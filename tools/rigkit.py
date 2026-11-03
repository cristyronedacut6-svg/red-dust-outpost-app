"""Rig kit for the boss models: a simple pivot skeleton authored in rest-pose model space, skin weights
(auto from bone segments, or collapsed from an existing skin), Catmull-Rom keyframe clips, and export in the
same compact format as the worm (indexed mesh, 4 weights per vertex, Int16 3x4 bone matrices per frame).

Authoring space: glTF axes after normalizing (height 1, feet at y=0): +x = the creature's LEFT, +y = up, +z = forward.
Rotation vectors are in degrees (rx: +lean forward for an upward bone, rz: +tilt toward the creature's right (-x)).
Export converts to game space: forward is +x, (x,y,z) -> (z,y,-x)."""
import base64, json
import numpy as np

b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def rotvec(r):
    r = np.radians(np.asarray(r, float)); th = np.linalg.norm(r)
    if th < 1e-9: return np.eye(3)
    k = r / th; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(th) * K + (1 - np.cos(th)) * K @ K


class Skel:
    def __init__(self, bones):
        """bones: list of (name, parent or None, pivot xyz, tail xyz or None)"""
        self.names = [b[0] for b in bones]; self.idx = {n: i for i, n in enumerate(self.names)}
        self.par = [self.idx[b[1]] if b[1] else -1 for b in bones]
        self.piv = np.array([b[2] for b in bones], float)
        self.tail = [np.array(b[3], float) if b[3] is not None else None for b in bones]
        for i, p in enumerate(self.par): assert p < i, 'parents must come first: ' + self.names[i]

    def fk(self, pose):
        """pose: {bone: {'r':(3,), 't':(3,), 's':float or (3,)}} -> (nb,4,4) world matrices acting on rest-pose points"""
        nb = len(self.names); M = np.zeros((nb, 4, 4))
        for i in range(nb):
            q = pose.get(self.names[i], {}); R = rotvec(q.get('r', (0, 0, 0)))
            s = q.get('s', 1.0); S_ = np.diag(np.broadcast_to(np.asarray(s, float), (3,)))
            p = self.piv[i]; t = np.asarray(q.get('t', (0, 0, 0)), float)
            L = np.eye(4); L[:3, :3] = R @ S_; L[:3, 3] = p + t - (R @ S_) @ p
            M[i] = (M[self.par[i]] @ L) if self.par[i] >= 0 else L
        return M


def _flatten(keys, skel):
    """keys: [(time, pose)] -> times (K,), array (K, nb, 10) of r(3), t(3), s(3), present"""
    T = np.array([k[0] for k in keys], float); nb = len(skel.names); A = np.zeros((len(keys), nb, 9)); A[:, :, 6:9] = 1
    for ki, (_, pose) in enumerate(keys):
        for bn, q in pose.items():
            if bn not in skel.idx: continue
            i = skel.idx[bn]
            if 'r' in q: A[ki, i, 0:3] = q['r']
            if 't' in q: A[ki, i, 3:6] = q['t']
            if 's' in q: A[ki, i, 6:9] = np.broadcast_to(np.asarray(q['s'], float), (3,))
    return T, A


def sample_clip(skel, clip, t):
    """Catmull-Rom (cardinal, non-uniform) through the keys; loops wrap"""
    keys = clip['k']; T, A = _flatten(keys, skel); d = clip['d']; loop = clip.get('loop', False)
    if loop:
        T = np.concatenate([[T[-2] - d], T, [T[1] + d]]) if len(T) > 2 else np.concatenate([[T[0] - d], T, [T[-1] + d]])
        A = np.concatenate([A[-2:-1], A, A[1:2]]) if len(keys) > 2 else np.concatenate([A[-1:], A, A[:1]])
        t = t % d
    else:
        T = np.concatenate([[T[0] - 1], T, [T[-1] + 1]]); A = np.concatenate([A[:1], A, A[-1:]]); t = min(max(t, keys[0][0]), keys[-1][0])
    k = np.searchsorted(T, t, side='right') - 1; k = min(max(k, 1), len(T) - 3)
    t0, t1 = T[k], T[k + 1]; u = 0 if t1 <= t0 else (t - t0) / (t1 - t0)
    m0 = (A[k + 1] - A[k - 1]) / max(T[k + 1] - T[k - 1], 1e-6) * (t1 - t0)
    m1 = (A[k + 2] - A[k]) / max(T[k + 2] - T[k], 1e-6) * (t1 - t0)
    h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
    V = h00 * A[k] + h10 * m0 + h01 * A[k + 1] + h11 * m1
    pose = {}
    for i, n in enumerate(skel.names): pose[n] = {'r': V[i, 0:3], 't': V[i, 3:6], 's': V[i, 6:9]}
    return pose


def seg_dist(P, a, b):
    ab = b - a; l = max(ab @ ab, 1e-12); t = np.clip(((P - a) @ ab) / l, 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


def adjacency(nv, F):
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
    return E


def smooth_weights(W, F, it=4, keep=.4):
    E = adjacency(len(W), F); deg = np.bincount(E[:, 0], minlength=len(W)).astype(float)[:, None]
    for _ in range(it):
        acc = np.zeros_like(W); np.add.at(acc, E[:, 0], W[E[:, 1]]); W = keep * W + (1 - keep) * acc / np.maximum(deg, 1)
    return W


def auto_weights(V, F, skel, side_lock=None, power=5, it=4, bones=None):
    """weights from the distance to each bone's segment (pivot -> tail, or pivot -> first child).
    side_lock(i, V) -> bool mask of vertices allowed for bone i"""
    nb = len(skel.names); D = np.full((len(V), nb), 1e9)
    for i in range(nb):
        if bones is not None and skel.names[i] not in bones: continue
        a = skel.piv[i]; b = skel.tail[i]
        if b is None:
            ch = [j for j in range(nb) if skel.par[j] == i]; b = skel.piv[ch[0]] if ch else a + np.array([0, 1e-3, 0])
        d = seg_dist(V, a, b)
        if side_lock is not None: d = np.where(side_lock(i, V), d, 1e9)
        D[:, i] = d
    W = 1.0 / np.maximum(D, 1e-3) ** power; W /= W.sum(1, keepdims=True)
    return smooth_weights(W, F, it)


def top4(W):
    J = np.argsort(-W, axis=1)[:, :4]; w = np.take_along_axis(W, J, 1); w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    wq = np.round(w * 255).astype(int); wq[:, 0] += 255 - wq.sum(1)
    return J.astype(np.uint8), np.clip(wq, 0, 255).astype(np.uint8)


G2 = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], float)  # glTF (front +z) -> game (front +x)


def export(name, V, F, VC, Jn, Wq, skel, clips, anchors, fps=12, credit='', path=None, extra=None):
    """V (nv,3) rest positions in authoring space; anchors: [(bone, point xyz)]; clips: {name: clip};
    clip matrices: either authored via skel (dict with 'k') or precomputed {'mats': (n,nb,4,4)}"""
    Vg = V @ G2.T
    a, b, c = Vg[F[:, 0]], Vg[F[:, 1]], Vg[F[:, 2]]; fn = np.cross(b - a, c - a); VN = np.zeros_like(Vg)
    for k in range(3): np.add.at(VN, F[:, k], fn)
    VN /= np.maximum(np.linalg.norm(VN, axis=1, keepdims=True), 1e-12)
    # make normals point outward: compare with the direction from the local centroid (per height band) to the vertex
    cen = np.zeros_like(Vg)
    for lo in np.linspace(Vg[:, 1].min(), Vg[:, 1].max(), 9)[:-1]:
        m = (Vg[:, 1] >= lo - 1e-6) & (Vg[:, 1] <= lo + (Vg[:, 1].max() - Vg[:, 1].min()) / 8 + 1e-6)
        if m.any(): cen[m] = Vg[m].mean(0)
    out = np.einsum('ij,ij->i', VN, Vg - cen)
    if (out < 0).mean() > .5: VN = -VN; fn = -fn; print('flipped normals outward')
    flip = np.einsum('ij,ij->i', fn, VN[F].mean(1)) < 0; F = F.copy(); F[flip] = F[flip][:, ::-1]
    G4 = np.eye(4); G4[:3, :3] = G2; G4i = np.eye(4); G4i[:3, :3] = G2.T
    rec = {'nv': int(len(Vg)), 'nf': int(len(F)), 'nb': len(skel.names) if skel else 0, 'fps': fps, 'na': len(anchors),
           'p': b64(Vg.astype(np.float32)), 'n': b64(np.round(VN * 127).astype(np.int8)),
           'c': b64(np.round(np.clip(np.clip(VC, 0, 1) ** (1 / 2.2) * 1.12 + .03, 0, 1) * 255).astype(np.uint8)),
           'f': b64(F.astype(np.uint16) if len(Vg) < 65536 else F.astype(np.uint32)), 'j': b64(Jn), 'w': b64(Wq), 'clips': {},
           'bbox': [Vg.min(0).round(4).tolist(), Vg.max(0).round(4).tolist()], 'credit': credit}
    if extra: rec.update(extra)
    rng = [0, 0]
    for cn, clip in clips.items():
        if 'mats' in clip: Ms = clip['mats']
        else:
            n = int(round(clip['d'] * fps)) + (0 if clip.get('loop') else 1)
            Ms = np.stack([skel.fk(sample_clip(skel, clip, i / fps)) for i in range(n)])
        Mg = np.einsum('ij,fbjk,kl->fbil', G4, Ms, G4i)[:, :, :3, :]
        H = []
        for f in range(len(Ms)):
            row = []
            for bn, pt in anchors:
                bi = skel.idx[bn] if skel and isinstance(bn, str) else bn; q = Ms[f, bi] @ np.r_[pt, 1]; row.extend((G2 @ q[:3]).tolist())
            H.append(row)
        rng[0] = max(rng[0], np.abs(Mg[..., :3]).max()); rng[1] = max(rng[1], np.abs(Mg[..., 3]).max())
        q = np.empty(Mg.shape, np.int16); q[..., :3] = np.round(np.clip(Mg[..., :3], -1.99, 1.99) * 16000); q[..., 3] = np.round(np.clip(Mg[..., 3], -4, 4) * 8000)
        rec['clips'][cn] = {'n': int(len(Mg)), 'loop': bool(clip.get('loop', False)), 'm': b64(q), 'h': b64(np.array(H, np.float32))}
    js = '/* %s */\nwindow.RDO_BOSS=window.RDO_BOSS||{};window.RDO_BOSS.%s=' % (credit, name) + json.dumps(rec, separators=(',', ':')) + ';\n'
    if path: open(path, 'w').write(js)
    print(name, 'verts', len(Vg), 'tris', len(F), 'bones', rec['nb'], 'clips', len(clips), 'KB', len(js) // 1024, 'max rot/scale', round(rng[0], 2), 'max t', round(rng[1], 2))
    return rec


def prune_bridges(F, W, skel, maxd=2):
    """drop triangles whose corners belong to bones far apart in the tree (simplifier artifacts joining a fist to a leg)"""
    nb = len(skel.names); D = np.full((nb, nb), 99, int)
    for i in range(nb):
        D[i, i] = 0; a = i; d = 0; anc = {}
        while a >= 0: anc[a] = d; a = skel.par[a]; d += 1
        for j in range(nb):
            b = j; e = 0
            while b >= 0 and b not in anc: b = skel.par[b]; e += 1
            if b >= 0: D[i, j] = anc[b] + e
    dom = np.argmax(W, 1); t = dom[F]
    bad = (D[t[:, 0], t[:, 1]] > maxd) | (D[t[:, 1], t[:, 2]] > maxd) | (D[t[:, 0], t[:, 2]] > maxd)
    print('pruned bridge tris', int(bad.sum()), 'of', len(F)); return F[~bad]
