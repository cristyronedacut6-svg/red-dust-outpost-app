"""Bake NASA 3D models (public domain, github.com/nasa/NASA-3D-Resources) for the HD view, v2.
Astronaut gets Taubin smoothing and 2-bone skin weights (10 bones: torso, head, upper arms, thighs, forearms, shins)."""
import base64, json, sys
import numpy as np
from glb import triangles, simplify, smooth_normals

SPEC = [('astro', 'raw/astro.glb', 9000), ('astroL', 'raw/astro.glb', 2600), ('rover', 'raw/rover.glb', 12000),
        ('lm', 'raw/lm.glb', 9000), ('hab', 'raw/hab.glb', 3000), ('heli', 'raw/heli.glb', 4000),
        ('rassor', 'raw/rassor.glb', 6000), ('dsn', 'raw/dsn.glb', 8000), ('robo', 'raw/robo.glb', 7000)]
b64 = lambda a: base64.b64encode(a.tobytes()).decode()
def ss(e0, e1, x): t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def taubin(V, F, it=4, lam=.5, mu=-.53):
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
    deg = np.bincount(E[:, 0], minlength=len(V)).astype(float)[:, None]
    for _ in range(it):
        for k in (lam, mu):
            acc = np.zeros_like(V); np.add.at(acc, E[:, 0], V[E[:, 1]]); V = V + k * (acc / np.maximum(deg, 1) - V)
    return V

out = {}
for name, f, tg in SPEC:
    P, C, N = triangles(f)
    V, F, FC, _ = simplify(P, C, tg, N)
    lo, hi = V.min(0), V.max(0); ctr = (lo + hi) / 2
    V = V - np.array([ctr[0], lo[1], ctr[2]])
    astro = name.startswith('astro') or name == 'robo'
    if name == 'robo': V[:, 0] *= -1; V[:, 2] *= -1
    if astro: V = V / (hi[1] - lo[1]) * 1.85; V = taubin(V, F, 3); V[:, 1] -= V[:, 1].min()
    elif name == 'hab': V = V / 100.0
    NRM = smooth_normals(V, F, 80 if astro else 55)
    Pt = V[F]; ext = np.abs(Pt.reshape(-1, 3)).max(0) + 1e-6
    col = np.clip(np.clip(FC, 0, 1) ** (1 / 2.2) * 1.08 + .02, 0, 1)
    rec = {'n': int(len(F)), 'ext': [round(float(e), 5) for e in ext], 'p': b64(np.round(Pt / ext * 32767).astype(np.int16)),
           'q': b64(np.round(np.clip(NRM, -1, 1) * 127).astype(np.int8)), 'c': b64(np.round(col * 255).astype(np.uint8)),
           'size': [round(float(v), 4) for v in (V.max(0) - V.min(0))]}
    if astro:
        H = 1.85; hs = np.abs(V[:, 0]).max(); Q = Pt.reshape(-1, 3); h = Q[:, 1] / H; ax = np.abs(Q[:, 0]) / hs; R = Q[:, 0] < 0
        nv = len(Q); ba = np.zeros(nv, np.uint8); bb = np.zeros(nv, np.uint8); w = np.zeros(nv)
        up = R * 1 + 2 + 0; up = np.where(R, 2, 3); fo = np.where(R, 6, 7); th = np.where(R, 4, 5); sh = np.where(R, 8, 9)
        TH = dict(arm=.2, armh=.55, sh0=.22, sh1=.34, el0=.55, el1=.67, leg=.52, legs=.37, hp0=.43, hp1=.51, kn0=.22, kn1=.3, hd0=.78, nk0=.8, nk1=.85, hz=-.08)
        if name == 'robo': TH.update(arm=.23, armh=.6, sh0=.22, sh1=.32, el0=.5, el1=.62, leg=.55, legs=.4, hp0=.47, hp1=.55, kn0=.25, kn1=.33, hd0=.8, nk0=.81, nk1=.86, hz=-.2)
        armz = (h > TH['armh']) & (ax > TH['arm'])
        # shoulder (torso -> upper arm) and elbow (upper arm -> forearm)
        a_sh = ss(TH['sh0'], TH['sh1'], ax); a_el = ss(TH['el0'], TH['el1'], ax)
        m = armz & (ax <= .45); ba[m] = 0; bb[m] = up[m]; w[m] = a_sh[m]
        m = armz & (ax > .45); ba[m] = up[m]; bb[m] = fo[m]; w[m] = a_el[m]
        leg = (h < TH['leg']) & ~armz
        k_hip = 1 - ss(TH['hp0'], TH['hp1'], h); k_kn = 1 - ss(TH['kn0'], TH['kn1'], h)
        m = leg & (h >= TH['legs']); ba[m] = 0; bb[m] = th[m]; w[m] = k_hip[m]
        m = leg & (h < TH['legs']); ba[m] = th[m]; bb[m] = sh[m]; w[m] = k_kn[m]
        hd = (h > TH['hd0']) & ~armz & (ax < .2) & (Q[:, 2] > TH['hz'])
        ba[hd] = 0; bb[hd] = 1; w[hd] = ss(TH['nk0'], TH['nk1'], h[hd])
        rec['ba'] = b64(ba); rec['bb'] = b64(bb); rec['bw'] = b64(np.round(w * 255).astype(np.uint8))
        rec['piv'] = {'sh': [round((TH['sh0'] + .03) * hs, 4), round(((.765 if name != 'robo' else .8)) * H, 4)], 'el': round((TH['el0'] + TH['el1']) / 2 * hs, 4), 'hip': [round(.07 * hs, 4), round((TH['hp0'] + .04) * H, 4)], 'knee': round((TH['kn0'] + .04) * H, 4), 'neck': round(TH['nk0'] * H, 4), 'hand': round(hs * .97, 4)}
        print(name, 'skin bones', np.bincount(np.where(w > .5, bb, ba), minlength=10).tolist())
    out[name] = rec; print(name, len(F), 'tris')
js = '/* NASA 3D models (public domain, NASA 3D Resources: github.com/nasa/NASA-3D-Resources), simplified and skinned for the HD view */\nwindow.RDO_MODELS=' + json.dumps(out, separators=(',', ':')) + ';\n'
open(sys.argv[1], 'w').write(js); print('bytes', len(js))
