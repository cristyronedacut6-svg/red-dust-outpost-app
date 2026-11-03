"""Skinned glTF support for the model baker: node hierarchy, animation sampling, skinning matrices."""
import numpy as np
from glb import load_glb, acc, nodemat


def quat_mat(q):
    x, y, z, w = q / (np.linalg.norm(q) or 1)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def slerp(a, b, t):
    d = np.dot(a, b)
    if d < 0: b = -b; d = -d
    if d > .9995: r = a + (b - a) * t; return r / np.linalg.norm(r)
    th = np.arccos(d); s = np.sin(th); return (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / s


class Rig:
    def __init__(self, path, anim=0):
        J, B = load_glb(path); self.J, self.B = J, B
        self.parent = {}
        for i, n in enumerate(J['nodes']):
            for c in n.get('children', []): self.parent[c] = i
        self.roots = J['scenes'][J.get('scene', 0)]['nodes']
        self.trs = []
        for n in J['nodes']:
            self.trs.append({'t': np.array(n.get('translation', [0, 0, 0]), float), 'r': np.array(n.get('rotation', [0, 0, 0, 1]), float), 's': np.array(n.get('scale', [1, 1, 1]), float), 'm': np.array(n['matrix'], float).reshape(4, 4).T if 'matrix' in n else None})
        self.ch = []
        if J.get('animations'):
            an = J['animations'][anim]
            for c in an['channels']:
                s = an['samplers'][c['sampler']]; tg = c['target']
                if 'node' not in tg or tg['path'] not in ('translation', 'rotation', 'scale'): continue
                self.ch.append((tg['node'], tg['path'][0], acc(J, B, s['input']).ravel(), acc(J, B, s['output'])))
            self.dur = max(c[2].max() for c in self.ch)
        else: self.dur = 0
        sk = J['skins'][0]; self.joints = sk['joints']; self.ibm = acc(J, B, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)

    def world(self, t):
        loc = {}
        over = {}
        for node, p, ti, vo in self.ch:
            if t <= ti[0]: v = vo[0]
            elif t >= ti[-1]: v = vo[-1]
            else:
                k = np.searchsorted(ti, t) - 1; u = (t - ti[k]) / (ti[k + 1] - ti[k])
                v = slerp(vo[k], vo[k + 1], u) if p == 'r' else vo[k] * (1 - u) + vo[k + 1] * u
            over.setdefault(node, {})[p] = v
        W = {}
        def mat(i):
            d = self.trs[i]
            if d['m'] is not None and i not in over: return d['m']
            o = over.get(i, {}); M = np.eye(4); M[:3, :3] = quat_mat(o.get('r', d['r'])) * o.get('s', d['s']); M[:3, 3] = o.get('t', d['t']); return M
        def go(i, P):
            W[i] = P @ mat(i)
            for c in self.J['nodes'][i].get('children', []): go(c, W[i])
        for r in self.roots: go(r, np.eye(4))
        return W

    def skin_mats(self, t):
        W = self.world(t)
        return np.stack([W[j] @ self.ibm[k] for k, j in enumerate(self.joints)])

    def joint_pos(self, t, name):
        W = self.world(t)
        for j in self.joints:
            if self.J['nodes'][j].get('name', '').startswith(name): return W[j][:3, 3]


def skinned_mesh(rig):
    """vertex positions (mesh space), joints (V,4), weights (V,4), per-vertex colors, triangle indices"""
    import io
    from PIL import Image
    from glb import srgb_to_lin
    J, B = rig.J, rig.B
    Ps, Js, Ws, Cs, Fs = [], [], [], [], []; base = 0; imgs = {}
    def image(ti):
        if ti in imgs: return imgs[ti]
        tex = J['textures'][ti]; src = tex.get('source', (tex.get('extensions', {}).get('EXT_texture_webp') or {}).get('source'))
        im = J['images'][src]; bv = J['bufferViews'][im['bufferView']]
        pic = Image.open(io.BytesIO(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB'); pic.thumbnail((1024, 1024))
        imgs[ti] = np.asarray(pic, float) / 255; return imgs[ti]
    for ni, n in enumerate(J['nodes']):
        if 'mesh' not in n or 'skin' not in n: continue
        for pr in J['meshes'][n['mesh']]['primitives']:
            A = pr['attributes']; P = acc(J, B, A['POSITION'])[:, :3]; jn = acc(J, B, A['JOINTS_0']).astype(int); w = acc(J, B, A['WEIGHTS_0'])
            w = w / np.maximum(w.sum(1, keepdims=True), 1e-9)
            col = np.ones((len(P), 3)); mat = J['materials'][pr['material']] if 'material' in pr else {}; pbr = mat.get('pbrMetallicRoughness', {})
            bt = pbr.get('baseColorTexture')
            if bt is not None:
                img = image(bt['index']); uv = acc(J, B, A['TEXCOORD_%d' % bt.get('texCoord', 0)]); h, wd = img.shape[:2]
                col = srgb_to_lin(img[(np.mod(uv[:, 1], 1) * (h - 1)).astype(int), (np.mod(uv[:, 0], 1) * (wd - 1)).astype(int)])
            col = col * np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3])
            idx = acc(J, B, pr['indices']).astype(np.int64).reshape(-1, 3)
            Ps.append(P); Js.append(jn); Ws.append(w); Cs.append(col); Fs.append(idx + base); base += len(P)
    return np.concatenate(Ps), np.concatenate(Js), np.concatenate(Ws), np.concatenate(Cs), np.concatenate(Fs)


def pose(P, Jn, W, M):
    out = np.zeros_like(P); Ph = np.c_[P, np.ones(len(P))]
    for k in range(4):
        T = M[Jn[:, k]]; out += W[:, k:k + 1] * np.einsum('nij,nj->ni', T[:, :3, :], Ph)
    return out
