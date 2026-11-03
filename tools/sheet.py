import sys, json, base64, numpy as np
from PIL import Image, ImageDraw
nm = sys.argv[1]; s = open('../red-dust-outpost/www/js/boss_%s.js' % nm).read(); R = json.loads(s[s.index('=', s.index('RDO_BOSS.')) + 1:].rstrip().rstrip(';'))
dec = lambda b, t: np.frombuffer(base64.b64decode(b), t)
V = dec(R['p'], np.float32).reshape(-1, 3); F = dec(R['f'], np.uint16 if R['nv'] < 65536 else np.uint32).reshape(-1, 3).astype(int)
C = dec(R['c'], np.uint8).reshape(-1, 3) / 255; J = dec(R['j'], np.uint8).reshape(-1, 4); W = dec(R['w'], np.uint8).reshape(-1, 4) / 255
nb = R['nb']; W_ = 240
def frame(cn, u):
    c = R['clips'][cn]; m = dec(c['m'], np.int16).reshape(c['n'], nb, 3, 4).astype(float); m[..., :3] /= 16000; m[..., 3] /= 8000
    f = min(c['n'] - 1, int(round(u * (c['n'] - 1)))); B = m[f]; out = np.zeros_like(V); Ph = np.c_[V, np.ones(len(V))]
    for k in range(4): out += W[:, k:k + 1] * np.einsum('nij,nj->ni', B[J[:, k]], Ph)
    return out
def draw(P, yaw=-.7, pit=-.25):
    cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pit), np.sin(pit)
    Rm = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Q = P @ Rm.T; T = Q[F]; n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    sh = .3 + .7 * np.clip(n @ np.array([.3, .8, .5]) / np.linalg.norm([.3, .8, .5]), 0, 1); col = (C[F].mean(1) * sh[:, None] * 255).clip(0, 255).astype(int)
    im = Image.new('RGB', (W_, W_), (36, 40, 56)); d = ImageDraw.Draw(im); sc = W_ * .42 / 1.0; ox, oy = W_ / 2, W_ * .82
    d.line([(0, oy), (W_, oy)], fill=(70, 70, 90))
    for i in np.argsort(T[:, :, 2].mean(1)): d.polygon([(ox + v[0] * sc, oy - v[1] * sc) for v in T[i]], fill=tuple(col[i]))
    return im
clips = list(R['clips'].keys()); us = [0, .45, .7, .84, 1.0]
sheet = Image.new('RGB', (W_ * len(us), W_ * len(clips)))
for r, cn in enumerate(clips):
    for k, u in enumerate(us):
        im = draw(frame(cn, u)); ImageDraw.Draw(im).text((4, 4), '%s %.2f' % (cn, u), fill=(255, 255, 120)); sheet.paste(im, (k * W_, r * W_))
sheet = sheet.resize((sheet.width // 2 * 1, sheet.height // 2 * 1)) if len(clips) > 8 else sheet
sheet.save('/tmp/claude-0/-home-claude/5a2e3b73-3293-5317-9c85-495b38bb986d/scratchpad/sh_%s.png' % nm); print(nm, clips)
