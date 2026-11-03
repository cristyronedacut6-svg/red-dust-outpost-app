"""Bake the Giant Worm (CC-BY-4.0, Vasian-Digital3D on Sketchfab) as a skinned, animated model for the HD view.
Indexed mesh (shared vertices) + up to 4 bone weights per vertex + animation clips sampled at 10 fps as bone matrices."""
import base64, json, sys
import numpy as np
from skin import Rig, skinned_mesh, pose
from glb import simplify

b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
R = Rig('user/giant_worm.glb')
P, Jn, W, C, F = skinned_mesh(R)
# a per-face color (mean of corners) for the simplifier
FC = C[F].mean(1)
V, F2, FC2, _ = simplify(P[F], FC, int(sys.argv[2]) if len(sys.argv) > 2 else 11000, None)
# skin attributes for the simplified vertices: copy from the nearest original vertex
from scipy.spatial import cKDTree
_, near = cKDTree(P).query(V)
J2, W2 = Jn[near], W[near]
# vertex colors: average of the faces around each vertex (smooth look)
VC = np.zeros((len(V), 3)); cnt = np.zeros(len(V))
for k in range(3): np.add.at(VC, F2[:, k], FC2); np.add.at(cnt, F2[:, k], 1)
VC /= np.maximum(cnt, 1)[:, None]
# normalize: bake mesh->meters scale into the vertices so matrices stay well scaled
M0 = R.skin_mats(0.0); s0 = abs(np.linalg.det(M0[1][:3, :3])) ** (1 / 3) or 1.0
for k in range(len(M0)):
    d = abs(np.linalg.det(M0[k][:3, :3]))
    if d > 1e-12: s0 = d ** (1 / 3); break
Vm = V * s0; Sinv = np.eye(4); Sinv[:3, :3] /= s0
# vertex normals (smooth) in the scaled bind space
a, b, c = Vm[F2[:, 0]], Vm[F2[:, 1]], Vm[F2[:, 2]]; fn = np.cross(b - a, c - a)
VN = np.zeros_like(Vm)
for k in range(3): np.add.at(VN, F2[:, k], fn)
VN /= np.maximum(np.linalg.norm(VN, axis=1, keepdims=True), 1e-12)
# orient triangles outward relative to normals (consistent winding for back-face culling)
cen = Vm[F2].mean(1); flip = (np.einsum('ij,ij->i', fn, VN[F2].mean(1)) < 0); F2[flip] = F2[flip][:, ::-1]
CLIPS = {'idle': (56, 64), 'slam': (24, 28.6), 'lunge': (89.5, 94.2), 'combo': (80.5, 85.2), 'hurt': (49.5, 55), 'roar': (64.5, 68.8)}
FPS = 10
hi = [i for i, j in enumerate(R.joints) if R.J['nodes'][j]['name'].startswith('b_head_root')][0]
jw = [i for i, j in enumerate(R.joints) if R.J['nodes'][j]['name'].startswith('b_head_jaw')][0]
clips = {}; allm = []
for nm, (t0, t1) in CLIPS.items():
    n = int(round((t1 - t0) * FPS)) + 1; fr = []; heads = []
    for i in range(n):
        t = t0 + i / FPS; Wd = R.world(t); Ms = np.stack([Wd[j] @ R.ibm[k] for k, j in enumerate(R.joints)]) @ Sinv
        fr.append(Ms[:, :3, :]); heads.append(np.r_[Wd[R.joints[hi]][:3, 3], Wd[R.joints[jw]][:3, 3]])
    clips[nm] = (np.array(fr), np.array(heads))
# rest-of-world bounds at the idle start, to place the ground
Q = pose(Vm, J2, W2, np.concatenate([clips['idle'][0][0], np.tile([[[0, 0, 0, 1]]], (len(R.joints), 1, 1))], 1))
lo, hi_ = Q.min(0), Q.max(0); print('idle bbox', lo.round(2), hi_.round(2))
rec = {'nv': int(len(Vm)), 'nf': int(len(F2)), 'nb': len(R.joints), 'fps': FPS, 'p': b64(Vm.astype(np.float32)), 'n': b64(np.round(VN * 127).astype(np.int8)), 'c': b64(np.round(np.clip(np.clip(VC, 0, 1) ** (1 / 2.2) * 1.15 + .03, 0, 1) * 255).astype(np.uint8)),
       'f': b64(F2.astype(np.uint16) if len(Vm) < 65536 else F2.astype(np.uint32)), 'j': b64(J2.astype(np.uint8)), 'w': b64(np.round(W2 * 255).astype(np.uint8)), 'clips': {}, 'bbox': [lo.round(3).tolist(), hi_.round(3).tolist()],
       'credit': 'Giant Worm by Vasian-Digital3D (sketchfab.com/Vasian-Digital3D), CC-BY-4.0'}
for nm, (fr, hd) in clips.items():
    q = np.empty(fr.shape, np.int16); q[..., :3] = np.round(np.clip(fr[..., :3], -1.99, 1.99) * 16000); q[..., 3] = np.round(np.clip(fr[..., 3], -4, 4) * 8000)
    rec['clips'][nm] = {'n': int(len(fr)), 'm': b64(q), 'h': b64(hd.astype(np.float32))}
    print(nm, len(fr), 'frames', 'mat range', fr[..., :3].min().round(2), fr[..., :3].max().round(2), 't', fr[..., 3].min().round(2), fr[..., 3].max().round(2))
js = '/* Giant Worm by Vasian-Digital3D (https://sketchfab.com/Vasian-Digital3D), CC-BY-4.0 (creativecommons.org/licenses/by/4.0). Simplified, skinned and clipped for the HD view. */\nwindow.RDO_WORM=' + json.dumps(rec, separators=(',', ':')) + ';\n'
open(sys.argv[1], 'w').write(js); print('verts', len(Vm), 'tris', len(F2), 'bytes', len(js))
