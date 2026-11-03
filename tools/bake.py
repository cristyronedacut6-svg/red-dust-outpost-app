"""Bake NASA 3D models (public domain, github.com/nasa/NASA-3D-Resources) into a compact JS file for the HD view.
Each model: triangle soup, origin at bottom-center, meters, Y up; quantized positions (int16), normals (int8), colors (uint8),
and for the astronaut a body-part id per triangle (0 torso, 1 head, 2 right arm, 3 left arm, 4 right leg, 5 left leg)."""
import base64, json, sys
import numpy as np
from glb import triangles, simplify, smooth_normals

SPEC = [  # name, file, target triangles, forward axis note
    ('astro', 'raw/astro.glb', 7000), ('astroL', 'raw/astro.glb', 2200), ('rover', 'raw/rover.glb', 7000),
    ('lm', 'raw/lm.glb', 5000), ('hab', 'raw/hab.glb', 3000), ('heli', 'raw/heli.glb', 1800),
    ('rassor', 'raw/rassor.glb', 3500), ('dsn', 'raw/dsn.glb', 4500)]
out = {}
for name, f, tg in SPEC:
    P, C, N = triangles(f)
    V, F, FC, _ = simplify(P, C, tg, N)
    lo, hi = V.min(0), V.max(0); ctr = (lo + hi) / 2
    V = V - np.array([ctr[0], lo[1], ctr[2]])  # bottom-center origin
    if name.startswith('astro'): V = V / (hi[1] - lo[1]) * 1.85  # model units -> a 1.85 m astronaut
    elif name == 'hab': V = V / 100.0  # centimeters -> meters
    NRM = smooth_normals(V, F, 50)
    Pt = V[F]  # (F,3,3)
    ext = np.abs(Pt.reshape(-1, 3)).max(0) + 1e-6
    q = np.round(Pt / ext * 32767).astype(np.int16)
    nq = np.round(np.clip(NRM, -1, 1) * 127).astype(np.int8)
    col = np.clip(FC, 0, 1) ** (1 / 2.2)  # back to display colors
    col = np.clip(col * 1.08 + .02, 0, 1)
    cq = np.round(col * 255).astype(np.uint8)
    rec = {'n': int(len(F)), 'ext': [round(float(e), 5) for e in ext], 'p': base64.b64encode(q.tobytes()).decode(),
           'q': base64.b64encode(nq.tobytes()).decode(), 'c': base64.b64encode(cq.tobytes()).decode(),
           'size': [round(float(v), 4) for v in (V.max(0) - V.min(0))]}
    if name.startswith('astro'):
        cen = Pt.reshape(-1, 3); H = 1.85; hs = np.abs(V[:, 0]).max(); h = cen[:, 1] / H; x = cen[:, 0]
        part = np.zeros(len(cen), np.uint8)
        arm = (np.abs(x) > .27 * hs) & (h > .55)
        part[arm & (x < 0)] = 2; part[arm & (x > 0)] = 3
        leg = (h < .465) & ~arm
        part[leg & (x < 0)] = 4; part[leg & (x >= 0)] = 5
        part[(h > .835) & ~arm & (np.abs(x) < .2 * hs) & (cen[:, 2] > -.08)] = 1
        rec['part'] = base64.b64encode(part.tobytes()).decode()
        rec['piv'] = {'sh': [round(.25 * hs, 4), round(.765 * H, 4)], 'hip': [round(.055 * hs, 4), round(.47 * H, 4)], 'neck': round(.835 * H, 4), 'hand': round(hs * .97, 4)}
        print(name, 'parts', np.bincount(part, minlength=6).tolist(), 'halfspan', round(hs, 3))
    out[name] = rec
    print(name, len(F), 'tris, size m', rec['size'])
js = '/* NASA 3D models (public domain, NASA 3D Resources: github.com/nasa/NASA-3D-Resources), simplified for the HD view */\nwindow.RDO_MODELS=' + json.dumps(out, separators=(',', ':')) + ';\n'
open(sys.argv[1], 'w').write(js); print('bytes', len(js))
