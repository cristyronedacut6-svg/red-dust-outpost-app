"""Story mode balance bot: plays each world with the real game code, fast-forwarded, no rendering.
usage: storybot.py RUNS [levels like 0,1,2]"""
import time, sys, json
from playwright.sync_api import sync_playwright
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
LVS = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '0,1,2,3,4,5').split(',')]
PROF = sys.argv[3] if len(sys.argv) > 3 else 'avg'
BOT = r"""
window.__SB = function (lv, prof) {
  P = newP(lv); TW = lv; LS.set('tut', 1); start(); if (S.arr) arriveEnd(); S.tu = null;
  const K = prof === 'new' ? { aim: .55, build: 2.2, turrets: .6, slack: 1.6 } : { aim: .85, build: 1, turrets: 1, slack: 1 };
  const core = () => S.b.find(b => b.t === 'core'); const C0 = core(); const cx = C0.x + 8, cy = C0.y + 8;
  let t = 0, bt = 0, minHp = 100, minCore = 1, log = [], built = {};
  const spot = () => { for (let r = 2; r < 9; r++) for (let k = 0; k < r * 8; k++) { const a = k / (r * 8) * 6.283 + r, x = Math.round((cx + Math.cos(a) * r * 18) / 16) * 16, y = Math.round((cy + Math.sin(a) * r * 18) / 16) * 16; if (free(x, y)) return [x, y]; } return null; };
  const tryBuild = t => { if (!canBuy(t)) return false; const p = spot(); if (!p) return false; const n0 = S.b.length; place(t, p[0], p[1]); if (S.b.length > n0) { built[t] = (built[t] || 0) + 1; return true; } return false; };
  const cnt = t => S.b.filter(b => b.t === t).length;
  const L = LV[lv];
  // is this spot inside a telegraphed hazard? (the red zones a player sees and steps out of)
  const inHz = (x, y) => { for (const h of S.hz) { const d = Math.hypot(x - h.x, y - h.y);
      if (h.k === 'circle' || h.k === 'fire' || h.k === 'spike') { if (d < (h.r || 18) + 7) return true; }
      else if (h.k === 'donut') { if (d > h.r1 - 7 && d < h.r2 + 7) return true; }
      else if (h.k === 'cone') { let da = Math.abs(((Math.atan2(y - h.y, x - h.x) - h.a) + 9.42) % 6.283 - 3.14); if (d < h.r + 7 && da < h.arc / 2 + .15) return true; }
      else if (h.k === 'beam') { if (segD(x, y, h.x, h.y, h.x + Math.cos(h.a) * h.len, h.y + Math.sin(h.a) * h.len) < h.w / 2 + 9) return true; }
      else if (h.k === 'line') { if (segD(x, y, h.x, h.y, h.x2, h.y2) < h.w / 2 + 9) return true; }
      else if (h.k === 'shock') { if (Math.abs(d - h.r) < 16) return true; }
      else if (h.r && d < h.r + 6) return true; } return false; };
  const dodgeSkill = prof === 'new' ? .55 : prof === 'good' ? .97 : .85; let dodgeT = 0, dodging = null;
  for (let f = 0; f < 20 * 60 * 8; f++) {
    if (S.over || S.winT > 0) break;
    if (S.pz) { const b = [...document.querySelectorAll('#ov button, #ev button, .evc button')].find(x => x.offsetParent); if (b) b.click(); S.pz = 0; }
    if (S.arr) arriveEnd();
    const dt = 1 / 20; t += dt;
    // the player: hold fire, go after the alien closest to the core
    fireHeld = true; let tg = null, d = 1e9; for (const a of S.al) { const q = Math.hypot(a.x - cx, a.y - cy); if (q < d) { d = q; tg = a; } }
    const p = S.p, gx = tg && d < 340 ? tg.x : cx + 20, gy = tg && d < 340 ? tg.y : cy + 20, dx = gx - p.x, dy = gy - p.y, dd = Math.hypot(dx, dy), sp = 95 * K.aim;
    let mvx = dd > (tg ? 60 : 10) ? dx / dd : 0, mvy = dd > (tg ? 60 : 10) ? dy / dd : 0;
    if ((dodgeT -= dt) <= 0) { dodgeT = .25; dodging = null; if (inHz(p.x, p.y) && Math.random() < dodgeSkill) { let best = null, bs = 1e9; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, nx = p.x + Math.cos(a) * 45, ny = p.y + Math.sin(a) * 45; if (inHz(nx, ny)) continue; const sc = Math.hypot(nx - gx, ny - gy); if (sc < bs) { bs = sc; best = [Math.cos(a), Math.sin(a)]; } } dodging = best; } }
    if (dodging) { mvx = dodging[0]; mvy = dodging[1]; }
    p.x += mvx * (dodging ? 110 : sp) * dt; p.y += mvy * (dodging ? 110 : sp) * dt;
    try { update(dt); HOOK('frame', dt); } catch (e) { log.push('err ' + e.message); break; }
    // building, like a sensible player
    if ((bt -= dt) <= 0) { bt = K.build; const r = S.res;
      const want = [];
      if (cnt('turret') < Math.min(2, Math.round((1 + S.sol) * K.turrets))) want.push('turret');
      if (r.pw < 45 * K.slack || cnt('solar') < 2) want.push(L.sun < .5 && canBuy('rtg') ? 'rtg' : 'solar');
      if (cnt('battery') < 1 + (L.nt > .6 ? 1 : 0)) want.push('battery');
      if (r.o2 < 55 / K.slack) want.push('o2'); if (r.fd < 55 / K.slack) want.push('farm');
      if (r.rad > 30 * K.slack) want.push('shield');
      if (cnt('turret') < Math.round((1 + S.sol * 1.2) * K.turrets)) want.push('turret');
      if (cnt('drill') < 1) want.push('drill');
      for (const w of want) if (tryBuild(w)) break;
      // spend spare coins on upgrades for the core and turrets? (kept simple: none)
    }
    const c = core(); if (c && c.hp != null && c.mh) minCore = Math.min(minCore, c.hp / c.mh); minHp = Math.min(minHp, S.hp);
  }
  const res = { lv, world: L.n, mats: Math.round(S.mats || 0), hz: S.hz.length, win: S.winT > 0, failed: !!S.failed, why: S.why || '', sol: S.sol, t: Math.round(t), minHp: Math.round(minHp), minCore: +minCore.toFixed(2), built, crewLeft: (S.crew || []).length, log: log.slice(0, 3) };
  S.run = false; return res; };
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 560}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://localhost:8093/index.html'); time.sleep(2)
    pg.evaluate("LS.set('tut',1);LS.set('intro',1);LS.set('sfx',0);LS.set('mus',0);for(let i=0;i<7;i++)LS.set('nf'+i,1)"); pg.reload(); time.sleep(3)
    pg.evaluate(BOT + ';0')
    out = []
    for lv in LVS:
        for i in range(RUNS):
            r = pg.evaluate(f"__SB({lv},'{PROF}')"); out.append(r)
            print(json.dumps(r), flush=True)
            pg.evaluate("try{if(S)S.run=false;init();title()}catch(e){}")
    print('errors', errs[:5])
    b.close()
