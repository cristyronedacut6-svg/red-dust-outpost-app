"""Tiny glTF-binary (.glb) reader + vertex-clustering simplifier + texture-to-vertex-color baker.
Outputs triangle soups (positions, per-face colors) in meters, Y up."""
import json, struct, io
import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(path):
    b = open(path, 'rb').read()
    magic, ver, ln = struct.unpack('<4sII', b[:12])
    assert magic == b'glTF', path
    o, J, BIN = 12, None, None
    while o < ln:
        cl, ct = struct.unpack('<II', b[o:o + 8]); d = b[o + 8:o + 8 + cl]; o += 8 + cl
        if ct == 0x4E4F534A: J = json.loads(d)
        elif ct == 0x004E4942: BIN = d
    return J, BIN


def acc(J, BIN, i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; t = CT[a['componentType']]; n = NC[a['type']]; cnt = a['count']
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', 0); isz = np.dtype(t).itemsize
    if st and st != isz * n: arr = np.ndarray((cnt, n), dtype=t, buffer=BIN, offset=off, strides=(st, isz))
    else: arr = np.frombuffer(BIN, dtype=t, count=cnt * n, offset=off).reshape(cnt, n)
    arr = arr.astype(np.float64)
    if a.get('normalized') and t != np.float32: arr /= np.iinfo(t).max
    return arr


def nodemat(nd):
    if 'matrix' in nd: return np.array(nd['matrix'], dtype=np.float64).reshape(4, 4).T
    t = nd.get('translation', [0, 0, 0]); x, y, z, w = nd.get('rotation', [0, 0, 0, 1]); s = nd.get('scale', [1, 1, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M


def srgb_to_lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def triangles(path):
    """returns P (F,3,3) positions, C (F,3) linear-ish colors 0..1 (as displayed), names (F,) node names"""
    J, BIN = load_glb(path)
    imgs = {}
    def image(ti):
        if ti in imgs: return imgs[ti]
        tex = J['textures'][ti]; src = tex.get('source', (tex.get('extensions', {}).get('EXT_texture_webp') or {}).get('source'))
        if src is None: imgs[ti] = None; return None
        im = J['images'][src]
        if 'bufferView' in im:
            bv = J['bufferViews'][im['bufferView']]; data = BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
            pic = Image.open(io.BytesIO(data)).convert('RGB')
            if max(pic.size) > 1024: pic.thumbnail((1024, 1024))
            imgs[ti] = np.asarray(pic, dtype=np.float64) / 255.0
        else: imgs[ti] = None
        return imgs[ti]
    outP, outC, outN = [], [], []
    def walk(ni, M, path_name):
        nd = J['nodes'][ni]; M2 = M @ nodemat(nd); nm = path_name + '/' + nd.get('name', str(ni))
        if 'mesh' in nd:
            for pr in J['meshes'][nd['mesh']]['primitives']:
                if pr.get('mode', 4) != 4: continue
                A = pr['attributes']; P = acc(J, BIN, A['POSITION'])[:, :3]
                idx = acc(J, BIN, pr['indices']).astype(np.int64).ravel() if 'indices' in pr else np.arange(len(P))
                idx = idx[:len(idx) // 3 * 3].reshape(-1, 3)
                Pw = (np.c_[P, np.ones(len(P))] @ M2.T)[:, :3]
                col = np.ones((len(P), 3))
                mat = J['materials'][pr['material']] if 'material' in pr and 'materials' in J else {}
                pbr = mat.get('pbrMetallicRoughness', {})
                f = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3])
                bt = pbr.get('baseColorTexture')
                if bt is not None and ('TEXCOORD_%d' % bt.get('texCoord', 0)) in A:
                    img = image(bt['index'])
                    if img is not None:
                        uv = acc(J, BIN, A['TEXCOORD_%d' % bt.get('texCoord', 0)])
                        h, w = img.shape[:2]; u = np.mod(uv[:, 0], 1.0); v = np.mod(uv[:, 1], 1.0)
                        col = img[(v * (h - 1)).astype(int), (u * (w - 1)).astype(int)]
                        col = srgb_to_lin(col)
                if 'COLOR_0' in A: col = col * acc(J, BIN, A['COLOR_0'])[:, :3]
                col = col * f
                outP.append(Pw[idx]); outC.append(col[idx].mean(axis=1)); outN.extend([nm] * len(idx))
        for c in nd.get('children', []): walk(c, M2, nm)
    sc = J['scenes'][J.get('scene', 0)]
    for r in sc['nodes']: walk(r, np.eye(4), '')
    return np.concatenate(outP), np.concatenate(outC), np.array(outN)


def simplify(P, C, target, names=None):
    """vertex clustering on a grid; returns (Vpos (V,3), F (F,3) indices, Fcol (F,3), Fname)"""
    pts = P.reshape(-1, 3); lo, hi = pts.min(0), pts.max(0); ext = (hi - lo).max()
    best = None
    for res in [8, 12, 16, 22, 30, 40, 52, 66, 84, 106, 130, 145, 160, 180, 200, 225, 250, 285, 320, 360, 400, 460, 520, 600, 700, 820, 1000, 1300, 1700, 2400]:
        cell = ext / res; key = np.floor((pts - lo) / cell).astype(np.int64)
        k1 = key[:, 0] * 1000003 + key[:, 1] * 1009 + key[:, 2]
        uniq, inv = np.unique(k1, return_inverse=True)
        F = inv.reshape(-1, 3)
        ok = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
        n = ok.sum()
        if n > target * 1.5 and best is not None: break
        V = np.zeros((len(uniq), 3)); cnt = np.zeros(len(uniq)); np.add.at(V, inv, pts); np.add.at(cnt, inv, 1); V /= cnt[:, None]
        Fo = F[ok]; srt = np.sort(Fo, axis=1); _, ui = np.unique(srt, axis=0, return_index=True); ui.sort()
        best = (V, Fo[ui], C[ok][ui], (names[ok][ui] if names is not None else None))
        if n > target: break
    return best


def smooth_normals(V, F, crease_deg=48):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    fn = np.cross(b - a, c - a); area = np.linalg.norm(fn, axis=1, keepdims=True); fnu = fn / np.maximum(area, 1e-12)
    vf = [[] for _ in range(len(V))]
    for fi, f in enumerate(F):
        for v in f: vf[v].append(fi)
    cs = np.cos(np.radians(crease_deg)); N = np.zeros((len(F), 3, 3))
    for fi, f in enumerate(F):
        for k, v in enumerate(f):
            nb = vf[v]; d = fnu[nb] @ fnu[fi]; sel = np.array(nb)[d > cs]
            s = fn[sel].sum(0); l = np.linalg.norm(s); N[fi, k] = s / l if l > 1e-12 else fnu[fi]
    return N
