// Moon Survival balance simulator. Mirrors the rules in www/js/survival.js step() and reads the live survival_data.js.
// A scripted player works the objective chain with realistic travel, safety margins and mistakes.
// usage: node sim.mjs [runs] [profile]   profile: new | avg | good | all
import fs from 'fs';
// reads the live game numbers (copied to an .mjs so Node treats it as a module)
import { copyFileSync } from 'fs'; const DATA = process.env.DATA || new URL('./data.mjs', import.meta.url).pathname; if (!process.env.DATA) copyFileSync(new URL('../../www/js/survival_data.js', import.meta.url).pathname, DATA);
const D = await import(DATA);
const T = JSON.parse(fs.readFileSync(new URL('./terrain.json', import.meta.url)));
const OUT = process.env.OUT || '';
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---- terrain from the real game ---- */
function H(x, z) { const u = clamp((x - T.lo) / T.st, 0, T.N - 1.001), v = clamp((z - T.lo) / T.st, 0, T.N - 1.001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, N = T.N, h = T.h;
  return (h[j * N + i] * (1 - fu) + h[j * N + i + 1] * fu) * (1 - fv) + (h[(j + 1) * N + i] * (1 - fu) + h[(j + 1) * N + i + 1] * fu) * fv; }
function sunDir(a, elDeg) { const el = elDeg * Math.PI / 180; return [Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a)]; }
function inSun(x, y, z, d) { let s = 1.5; for (let i = 0; i < 46; i++) { const px = x + d[0] * s, pz = z + d[2] * s, py = y + d[1] * s; if (Math.abs(px) > 740 || Math.abs(pz) > 740) return true; if (H(px, pz) > py) return false; s *= 1.16; } return true; }
const ED = (() => { const az = D.EARTH.azDeg * Math.PI / 180, el = D.EARTH.elDeg * Math.PI / 180; return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]; })();
const seesEarth = (x, z) => inSun(x, H(x, z) + 3.2, z, ED);
const inCrater = (x, z) => Math.hypot(x - D.CRATER.x, z - D.CRATER.z) < D.CRATER.r * .62;
function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/* ---- world layout (same formulas as placeWorld) ---- */
function caches(scarce) { const out = [];
  for (let i = 0; i < D.CACHES + 2; i++) { const big = i >= D.CACHES; let a = hash(i + 3) * TAU, d = big ? 210 + hash(i + 9) * 60 : 45 + hash(i + 5) * 330, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (inCrater(x, z) && !big) { x = -x; z = Math.abs(z); } if (big) { const ca = hash(i) * 1.2 - .6; x = D.CRATER.x + Math.sin(ca) * D.CRATER.r * 1.08; z = D.CRATER.z + Math.cos(ca) * D.CRATER.r * 1.08; }
    const L = big ? { scrap: 10, elec: 5 } : D.CACHE_LOOT[i % D.CACHE_LOOT.length]; out.push({ x, z, big, L: scarce ? (process.env.OLDSCARCE ? { scrap: Math.ceil(L.scrap / 2), elec: Math.ceil(L.elec / 2) } : { scrap: Math.ceil(L.scrap * 2 / 3), elec: Math.ceil(L.elec * 2 / 3) }) : { ...L } }); }
  return out; }

/* ---- player profiles ---- */
const PROFILES = {
  new:  { walk: 1.55, margin: 6,  react: 25, hesitate: 40, eatAt: 22, dustAt: 70, patch: 30, explore: .25, berm: 'late', shelterSkill: .6 },
  avg:  { walk: 1.3,  margin: 12, react: 10, hesitate: 15, eatAt: 35, dustAt: 50, patch: 8,  explore: .1,  berm: 'mid',  shelterSkill: .85 },
  good: { walk: 1.1,  margin: 18, react: 3,  hesitate: 4,  eatAt: 45, dustAt: 35, patch: 2,  explore: 0,   berm: 'early', shelterSkill: 1 },
};
const SPEED = 5.2;

export function run(seed, prof, opt = {}) {
  let rs = seed * 9301 + 49297; const rand = () => (rs = (rs * 9301 + 49297) % 233280) / 233280, rnd = (a, b) => a + rand() * (b - a);
  const tw = opt.twist || null, TW = id => tw === id, P = PROFILES[prof];
  const elev = TW('shadow') ? 2.5 : D.SUN.elevationDeg;
  const st = { t: 0, sunA: 2.4, inv: { scrap: 0, elec: 0, regolith: 0, ice: 0 }, vit: { hp: 100, o2: TW('leak') ? 80 : 100, pw: 100, tc: 22, food: 90, water: 90, leak: TW('leak') ? 1 : 0, dose: 0 }, jet: 100,
    lander: { o2: D.LANDER.o2, pw: D.LANDER.power, meals: D.FOOD.start.meals, water: D.FOOD.start.water, kits: D.LANDER.kits || 0 }, base: { pw: 0, o2: 0, iceQ: 0, water: 0, meals: 0, grow: 0 },
    builds: [], goal: 0, flags: { iceCut: 0 }, stats: { sheltered: 0, flares: 0, deaths: 0 }, next: { flare: D.DANGER.flareFirstMin * 60, meteor: (D.DANGER.meteorFirstMin ?? 0) * 60 + (D.DANGER.meteorFirstMin != null ? rnd(0, 120) : rnd(...D.DANGER.meteorEveryMin) * 60) }, upg: {} };
  const o2Min = () => D.SUIT.o2Min * (st.upg.tank ? 1.3 : 1) * (TW('leak') ? .8 : 1), pwMin = () => D.SUIT.powerMin * (st.upg.cell ? 1.3 : 1);
  const C = caches(TW('scarce')); const LANDER = [-12, -8], ROVER = [14, 10];
  // a new mission starts in sunlight (same search as start())
  for (let i = 0; i < 36; i++) { const d = sunDir(st.sunA, elev); if (inSun(0, H(0, 0) + 1.5, 0, d) && inSun(8, H(8, 6) + 5, 6, d)) break; st.sunA = (st.sunA + TAU / 36) % TAU; }
  let pos = [0, 0], flare = null, ev = [], goalT = [], minVit = 100, lowT = 0, idleT = 0, deathsBy = {}, link = false, rescueAt = null, done = false;
  const log = (k, x) => ev.push([Math.round(st.t), k, x]);
  const count = id => st.builds.filter(b => b.id === id).length, has = c => Object.entries(c).every(([k, n]) => (st.inv[k] || 0) >= n), pay = c => { for (const k in c) st.inv[k] -= c[k]; };
  const B = id => D.BUILD.find(b => b.id === id);
  const hab = () => st.builds.find(b => b.id === 'hab');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let sunlit = true;

  /* ---- the per-second world rules (from survival.js step) ---- */
  function tick(dt, here) { const v = st.vit; st.t += dt; st.sunA = (st.sunA + dt * TAU / (D.SUN.circleMin * 60)) % TAU; const sd = sunDir(st.sunA, elev);
    const inside = here === 'inside', crat = !inside && inCrater(pos[0], pos[1]);
    sunlit = inside || inSun(pos[0], H(pos[0], pos[1]) + 1.5, pos[1], sd);
    const envT = crat ? D.TEMP.crater : sunlit ? D.TEMP.sun : D.TEMP.shadow;
    const sheltered = inside || st.builds.some(b => (b.id === 'berm' && dist([b.x, b.z], pos) < B('berm').shelter) || (b.id === 'hab' && dist([b.x, b.z], pos) < 4));
    const lamp = crat || !sunlit;
    if (!inside) { v.o2 -= dt * 100 / (o2Min() * 60) + (v.leak ? D.SUIT.leakPerSec * dt : 0); v.pw -= dt * 100 / (pwMin() * 60) * (crat ? D.SUIT.craterX : sunlit ? 1 : D.SUIT.heaterX) + (lamp ? D.SUIT.lampDrain * dt * 100 / (pwMin() * 60) : 0); }
    else v.tc += (22 - v.tc) * Math.min(1, dt);
    v.o2 = clamp(v.o2, 0, 100); v.pw = clamp(v.pw, 0, 100);
    if (!inside) { if (v.pw > 0) v.tc += (22 - v.tc) * Math.min(1, dt * .5); else v.tc += (envT * .2 - v.tc) * dt * .025; }
    v.food = clamp(v.food - dt * 100 / (D.FOOD.foodMin * 60), 0, 100); v.water = clamp(v.water - dt * 100 / (D.FOOD.waterMin * 60), 0, 100);
    let dmg = 0, why = ''; if (v.food <= 0 || v.water <= 0) { dmg += D.FOOD.starve; why = v.water <= 0 ? 'water' : 'food'; }
    if (v.o2 <= 0) { dmg += D.HEALTH.suffocate; why = why || 'oxygen'; } if (v.tc < 5) { dmg += D.HEALTH.cold; why = why || 'cold'; }
    if (flare && flare.on && !sheltered) { dmg += D.HEALTH.flare; why = why || 'flare'; flare.hit = true; v.dose += dt * 4; }
    v.hp -= dmg * dt; if (!dmg && v.o2 > 15 && v.pw > 0) v.hp += (inside ? D.HEALTH.regenInside : D.HEALTH.regen) * dt; v.hp = clamp(v.hp, 0, 100);
    const lo = Math.min(v.o2, v.pw, v.food, v.water, v.hp); minVit = Math.min(minVit, lo); if (lo < 25) lowT += dt;
    // dangers
    const N = st.next, warn = link ? D.DANGER.flareWarnWithAntennaSec : D.DANGER.flareWarnSec;
    if (!flare && st.t > N.flare - warn) { flare = { at: N.flare, on: false, hit: false }; log('flareWarn'); }
    if (flare) { const left = flare.at - st.t; if (left <= 0 && left > -D.DANGER.flareSec) flare.on = true; else if (left <= -D.DANGER.flareSec) { st.stats.flares++; if (!flare.hit) st.stats.sheltered++; log(flare.hit ? 'flareHit' : 'flareSafe'); flare = null; N.flare = st.t + (TW('flares') ? rnd(3, 5) : rnd(...D.DANGER.flareEveryMin)) * 60; } }
    if (D.DANGER.shieldFlareSec && D.GOALS[st.goal] && D.GOALS[st.goal].id === 'berm' && count('berm') && !flare && N.flare > st.t + D.DANGER.shieldFlareSec + warn) N.flare = st.t + D.DANGER.shieldFlareSec + warn * .5;
    if (D.DANGER.calmSec && st.t > N.meteor && (flare || Math.abs(N.flare - st.t) < D.DANGER.calmSec)) N.meteor = st.t + D.DANGER.calmSec;
    if (st.t > N.meteor) { N.meteor = st.t + rnd(...D.DANGER.meteorEveryMin) * 60; if (rand() < D.DANGER.meteorChance && !inside) { v.leak = 1; st.leakT = st.t; log('leak'); } }
    // base grid, once a second
    st._g = (st._g || 0) + dt; while (st._g >= 1) { st._g -= 1; let prod = 0, useP = 0, cap = 0;
      for (const b of st.builds) { const def = B(b.id); if (b.id === 'solar') { b.lit = inSun(b.x, H(b.x, b.z) + 5.5, b.z, sd); b.dust = Math.min(100, (b.dust || 0) + D.DUST.perMin / 60 * (st.upg.lotus ? .4 : 1) * (TW('dusty') ? 3 : 1)); if (b.lit) prod += def.power * (1 - D.DUST.loss * b.dust / 100); }
        if (b.id === 'battery') cap += def.store; if (def.use && b.id !== 'ice') useP += def.use; if (b.id === 'hab') cap += 40; }
      const ant = st.builds.find(b => b.id === 'antenna'); link = !!(ant && seesEarth(ant.x, ant.z)); if (ant && !link) useP -= B('antenna').use;
      const ice = st.builds.find(b => b.id === 'ice'), o2cap = count('hab') ? B('hab').o2 : 100;
      if (ice && st.base.iceQ > 0 && st.base.o2 < o2cap) useP += B('ice').use;
      st.base.pw = clamp(st.base.pw + prod - useP, 0, cap); const powered = st.base.pw > 0 || prod >= useP; st.powT = (st.powT || 0) + (st.builds.length ? 1 : 0); if (st.builds.length && powered) st.powOk = (st.powOk || 0) + 1;
      if (ice && powered && st.base.iceQ > 0 && st.base.o2 < o2cap) { ice.prog = (ice.prog || 0) + 1; if (ice.prog >= 8) { ice.prog = 0; st.base.iceQ--; st.base.o2 = Math.min(o2cap, st.base.o2 + B('ice').perIce); st.base.water = Math.min(200, st.base.water + D.FOOD.waterPerIce); } }
      if (count('hab') && powered && st.base.water >= D.FOOD.growWater && st.base.meals < D.FOOD.mealsMax) { st.base.grow++; if (st.base.grow >= D.FOOD.growSec) { st.base.grow = 0; st.base.meals++; st.base.water -= D.FOOD.growWater; } }
      goals(); }
    if (v.hp <= 0) die(why);
    if (rescueAt && st.t >= rescueAt && !done) { done = true; log('rescued'); }
  }
  function die(why) { st.stats.deaths++; deathsBy[why] = (deathsBy[why] || 0) + 1; log('death', why); const dl = D.DANGER.deathLoss ?? .5; for (const k in st.inv) st.inv[k] -= Math.floor(st.inv[k] * dl); const g = D.DANGER.graceAfterDeathSec || 0; if (g) { st.next.meteor = Math.max(st.next.meteor, st.t + g); if (!flare && st.next.flare < st.t + g) st.next.flare = st.t + g + 30; }
    const h = hab(); pos = h ? [h.x + 5, h.z + 5] : [-8, -4]; Object.assign(st.vit, D.DANGER.deathLoss != null ? { hp: 70, o2: 85, pw: 85, tc: 20, leak: 0 } : { hp: 60, o2: 70, pw: 70, tc: 20, leak: 0 }); if (opt.oneLife) done = 'dead'; }
  function goals() { const g = D.GOALS[st.goal]; if (!g) return; const c = count, f = st.flags; let ok = false;
    if (g.id === 'salvage') ok = (st.inv.scrap >= 6 && st.inv.elec >= 3) || st.builds.length > 0; else if (g.id === 'solar') ok = st.builds.some(b => b.id === 'solar' && b.lit);
    else if (g.id === 'hab') ok = c('hab') > 0; else if (g.id === 'ice') ok = c('ice') > 0 && f.iceCut >= 4; else if (g.id === 'berm') ok = c('berm') > 0 && st.stats.sheltered > 0;
    else if (g.id === 'rover') ok = !!f.rover; else if (g.id === 'antenna') ok = !!f.reported;
    if (ok) { goalT.push([g.id, Math.round(st.t)]); st.goal++; goals(); } }

  /* ---- player actions, each advances time with tick() ---- */
  const speed = () => (st.flags.rover && st.flags.drive ? 9 : SPEED);
  let busy = 0;
  function walkTo(p, why) { let d = dist(pos, p) * P.walk; while (d > 0.5 && !done) { if (urgent(why)) { care(); return false; } const stp = Math.min(d, speed() * 1); const k = stp / (dist(pos, p) * P.walk || 1); pos = [pos[0] + (p[0] - pos[0]) * k, pos[1] + (p[1] - pos[1]) * k]; d -= stp; tick(1, 'out'); }
    pos = [p[0], p[1]]; return true; }
  function wait(sec, here = 'out') { for (let i = 0; i < sec && !done; i++) tick(1, here); }
  function hold(sec, here) { wait(Math.ceil(sec), here); }
  // the safety check a player makes (with their margin): can I get back to air and power from here?
  function refillPoint() { const h = hab(); if (h && (st.base.o2 > 15 || st.lander.o2 < 5)) return { p: [h.x, h.z], k: 'hab' }; if (st.lander.o2 > 3 || st.lander.pw > 3) return { p: LANDER, k: 'lander' }; return h ? { p: [h.x, h.z], k: 'hab' } : { p: LANDER, k: 'lander' }; }
  // the safety check a player makes (with their margin): what do I need to do right now, if anything?
  function needs() { const v = st.vit, R = refillPoint(), back = dist(pos, R.p) * P.walk / SPEED;
    const rg = D.SUIT.patchRegolith; if (v.leak && st.t - (st.leakT || 0) > P.patch && (st.inv.scrap > 0 || (rg && (st.inv.regolith >= rg || prof !== 'new')))) return 'patch';
    const S = shelterPoint(); if (flare && !flare.on && S && flare.at - st.t < shelterTime() + 10 && (st._shDec ??= rand() < P.shelterSkill)) return 'shelter';
    const o2need = back * 100 / (o2Min() * 60) + (v.leak ? D.SUIT.leakPerSec * back + 10 : 0) + P.margin, pwneed = back * 100 / (pwMin() * 60) * (inCrater(pos[0], pos[1]) ? D.SUIT.craterX : D.SUIT.heaterX) + P.margin;
    if (v.o2 < o2need || v.pw < pwneed || v.food < P.eatAt || v.water < P.eatAt || (v.leak && st.inv.scrap === 0)) { const near = dist(pos, R.p) < 3; if (near && st._refT && st.t - st._refT < 20) return null; return 'refill'; }
    return null; }
  const urgent = why => why !== 'refill' && why !== 'shelter' && !!needs();
  function shelterTime() { const S = shelterPoint(); return S ? dist(pos, S) * P.walk / SPEED : 999; }
  function shelterPoint() { let best = null, bd = 1e9; for (const b of st.builds) if (b.id === 'hab' || b.id === 'berm') { const d = dist(pos, [b.x, b.z]); if (d < bd) { bd = d; best = [b.x + (b.id === 'berm' ? 2 : 0), b.z]; } } return best; }
  function care() { const n = needs(); if (!n) return false; const v = st.vit;
    if (n === 'patch') { const rg = D.SUIT.patchRegolith; if (st.inv.scrap > 0) st.inv.scrap--; else { while (st.inv.regolith < rg && !done) { tick(D.GATHER.digSec, 'out'); st.inv.regolith++; } st.inv.regolith -= rg; } v.leak = 0; log('patch'); return true; }
    if (n === 'shelter') { const S = shelterPoint(); walkTo(S, 'shelter'); const h = hab(); const inHab = h && dist(pos, [h.x, h.z]) < 6; while (flare && !done) { tick(1, inHab ? 'inside' : 'out'); if (inHab) eatDrink(true); } st._shDec = undefined; return true; }
    const R = refillPoint(); walkTo(R.p, 'refill'); refill(R.k); st._refT = st.t; return true; }
  function eatDrink(inHab) { const v = st.vit, b = st.base; if (inHab) { if (v.food < 70 && b.meals > 0) { b.meals--; v.food = Math.min(100, v.food + D.FOOD.meal); } if (v.water < 70 && b.water >= 10) { b.water -= 10; v.water = Math.min(100, v.water + D.FOOD.drink); } } }
  function refill(k) { const v = st.vit;
    if (k === 'hab') { hold(2, 'inside'); const b = st.base, need = 100 - v.o2, got = Math.min(need, b.o2); v.o2 += got; b.o2 -= got; const pn = 100 - v.pw, pg = Math.min(pn, b.pw); v.pw += pg; b.pw -= pg; v.leak = 0; v.tc = 22; eatDrink(true);
      // rest inside a little if hurt
      if (v.hp < 60) wait(10, 'inside');
      if (v.o2 < 60 || v.pw < 40) { walkTo(LANDER, 'refill'); refill('lander'); } log('refillHab', Math.round(v.o2)); }
    else { hold(1, 'out'); const L = st.lander; if (v.food < 70 && L.meals > 0) { L.meals--; v.food = Math.min(100, v.food + D.FOOD.meal); } if (v.water < 80 && L.water >= 10) { L.water -= 10; v.water = Math.min(100, v.water + D.FOOD.drink); }
      const a = Math.min(100 - v.o2, L.o2); v.o2 += a; L.o2 -= a; const b2 = Math.min(100 - v.pw, L.pw); v.pw += b2; L.pw -= b2; if (v.leak) { if (L.kits > 0) { L.kits--; v.leak = 0; } else if (st.inv.scrap) { v.leak = 0; st.inv.scrap--; } } log('refillLander', Math.round(L.o2)); } }
  // salvage until we hold `need`
  function gather(need) { let guard = 0;
    const t0 = st.t; while (!has(need) && !done && guard++ < 200 && st.t - t0 < 1500) { if (care()) continue;
      let best = null, bd = 1e9; for (const c of C) if (c.L.scrap + c.L.elec > 0) { const useful = (need.scrap > st.inv.scrap && c.L.scrap) || (need.elec > st.inv.elec && c.L.elec); if (!useful) continue; const d = dist(pos, [c.x, c.z]); if (d < bd) { bd = d; best = c; } }
      if (!best) return false;
      if (!walkTo([best.x, best.z])) continue;
      while (best.L.scrap + best.L.elec > 0 && !done) { if (urgent()) break; hold(D.GATHER.cacheSec * (st.upg.tools ? .7 : 1), 'out'); const k = best.L.elec > 0 && (best.L.scrap === 0 || rand() < .4) ? 'elec' : 'scrap'; best.L[k]--; st.inv[k]++; } }
    return has(need); }
  function digReg(n) { while (st.inv.regolith < n && !done) { if (care()) continue; hold(D.GATHER.digSec, 'out'); st.inv.regolith++; } }
  function cutIce(n) { const cc = [D.CRATER.x, D.CRATER.z], toC = [cc[0] - pos[0], cc[1] - pos[1]], L0 = Math.hypot(...toC), k = (L0 - D.CRATER.r * .6) / L0, floor = [pos[0] + toC[0] * k, pos[1] + toC[1] * k];
    let got = 0; while (got < n && !done) { if (care()) continue; if (!inCrater(pos[0], pos[1])) { if (!walkTo(floor)) continue; }
      while (got < n && !done) { if (urgent()) break; hold(D.GATHER.iceSec * (st.upg.tools ? .7 : 1), 'out'); st.inv.ice++; st.flags.iceCut++; got++; } } }
  // where to build: near the lander, on a flat sunlit spot for solar, Earth in view for the antenna
  const BASE = opt.base || [6, -22];
  function siteFor(id) { const tries = []; for (let r = 4; r < 40; r += 3) for (let a = 0; a < TAU; a += TAU / 12) tries.push([BASE[0] + Math.cos(a) * r, BASE[1] + Math.sin(a) * r]);
    const sd = sunDir(st.sunA, elev), ok = p => st.builds.every(b => dist([b.x, b.z], p) > (b.id === 'hab' || id === 'hab' ? 8 : 5)) && dist(p, LANDER) > 8;
    for (const p of tries) { if (!ok(p)) continue; if (id === 'solar' && !inSun(p[0], H(p[0], p[1]) + 5.5, p[1], sd)) continue; if (id === 'antenna' && !seesEarth(p[0], p[1])) continue; return p; } return tries.find(ok); }
  function build(id) { const p = siteFor(id); if (!p) return false; if (!walkTo(p)) return false; if (!has(B(id).cost)) return false; pay(B(id).cost); st.builds.push({ id, x: p[0], z: p[1] }); log('build', id); wait(P.hesitate / 4); return true; }
  function dustCare() { for (const b of st.builds) if (b.id === 'solar' && b.dust > P.dustAt && dist(pos, [b.x, b.z]) < 120) { walkTo([b.x, b.z]); hold(D.DUST.cleanSec, 'out'); b.dust = 0; log('clean'); } }
  function feedBase() { // bring ice back for water/oxygen when the tank runs low
    if (count('ice') && count('hab') && st.base.o2 < 60 && st.base.iceQ < 2 && st.inv.ice === 0) { cutIce(4); const ice = st.builds.find(b => b.id === 'ice'); walkTo([ice.x, ice.z]); st.base.iceQ += st.inv.ice; st.inv.ice = 0; log('loadIce'); } }
  function wander(sec) { // a new player looks around, gets a bit lost
    const a = rand() * TAU; walkTo([pos[0] + Math.cos(a) * sec * 2, pos[1] + Math.sin(a) * sec * 2]); }

  /* ---- the game plan ---- */
  const plan = ['salvage', 'solar', 'hab', 'battery', 'ice', 'berm', 'rover', 'antenna'];
  if (P.berm === 'early') { plan.splice(plan.indexOf('berm'), 1); plan.splice(3, 0, 'berm'); }
  const LIMIT = opt.limit || 3600 * 1.5; let guard = 0;
  let lastT = -1, stall = 0;
  while (!done && st.t < LIMIT && guard++ < 20000) { if (st.t === lastT) { if (++stall > 50) { wait(5); stall = 0; } } else { stall = 0; lastT = st.t; }
    if (rand() < P.explore * .3) wander(15 + rand() * 30);
    if (care()) continue; dustCare(); feedBase();
    const g = D.GOALS[st.goal];
    if (st.flags.reported) { wait(5, count('hab') ? 'inside' : 'out'); continue; }
    // next thing on the plan we have not done
    const step = plan.find(s => s === 'salvage' ? st.goal === 0 : s === 'rover' ? !st.flags.rover : s === 'antenna' ? !count('antenna') : s === 'battery' ? !count('battery') && count('hab') : s === 'ice' ? !count('ice') || st.flags.iceCut < 4 : !count(s));
    if (!g) break;
    if (P.react) wait(Math.round(P.react / 5));
    if (step === 'salvage') { gather({ scrap: 6, elec: 3 }); continue; }
    if (step === 'ice') { if (st.flags.iceCut < 4) cutIce(4 - st.flags.iceCut); if (!count('ice')) { if (gather(B('ice').cost)) build('ice'); } const ice = st.builds.find(b => b.id === 'ice'); if (ice && st.inv.ice) { walkTo([ice.x, ice.z]); st.base.iceQ += st.inv.ice; st.inv.ice = 0; } continue; }
    if (step === 'berm') { digReg(B('berm').cost.regolith); build('berm'); continue; }
    if (step === 'rover') { if (gather(D.ROVER.cost)) { walkTo(ROVER); hold(2.5); pay(D.ROVER.cost); st.flags.rover = 1; log('rover'); } continue; }
    if (step === 'antenna') { if (gather(B('antenna').cost)) build('antenna'); continue; }
    if (step) { if (gather(B(step).cost)) build(step); else { wait(10); } continue; }
    // everything built: the last goal is the report; before that we may be waiting for a flare
    const ant = st.builds.find(b => b.id === 'antenna');
    if (g.id === 'antenna' && ant) { walkTo([ant.x, ant.z]); if (seesEarth(ant.x, ant.z)) { hold(1.5); st.flags.reported = 1; rescueAt = st.t + D.RESCUE.etaSec; log('report'); } else { wait(10); } continue; }
    idleT += 10; wait(10, count('hab') && dist(pos, [hab().x, hab().z]) < 8 ? 'inside' : 'out');
  }
  const pw = st.powT ? st.powOk / st.powT : 0;
  return { seed, prof, twist: tw, rescued: done === true, end: Math.round(st.t), goals: goalT, deaths: st.stats.deaths, deathsBy, minVit: Math.round(minVit), lowMin: +(lowT / 60).toFixed(1), idleMin: +(idleT / 60).toFixed(1), flares: st.stats.flares, sheltered: st.stats.sheltered, power: +pw.toFixed(2), left: { ...st.inv }, lander: { o2: Math.round(st.lander.o2), meals: st.lander.meals, water: st.lander.water }, ev };
}

/* ---- batch report ---- */
const N = +(process.argv[2] || 200), PRS = (process.argv[3] || 'all') === 'all' ? ['new', 'avg', 'good'] : [process.argv[3]], TWS = process.env.TWISTS ? process.env.TWISTS.split(',') : [null];
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const all = [];
for (const tw of TWS) for (const pr of PRS) { const R = []; for (let i = 0; i < N; i++) R.push(run(i + 1, pr, { twist: tw, oneLife: !!tw }));
  all.push(...R);
  const res = R.filter(r => r.rescued), gt = {}; for (const r of R) for (const [g, t] of r.goals) (gt[g] = gt[g] || []).push(t / 60);
  const deaths = {}; R.forEach(r => { for (const k in r.deathsBy) deaths[k] = (deaths[k] || 0) + r.deathsBy[k]; });
  console.log(`\n== ${pr}${tw ? ' · twist ' + tw : ''} · ${N} runs ==`);
  console.log(`rescued ${(res.length / N * 100).toFixed(0)}%  time to rescue p25/p50/p75: ${[.25, .5, .75].map(p => (pct(res.map(r => r.end / 60), p) || 0).toFixed(1)).join(' / ')} min`);
  console.log(`deaths per run avg ${(R.reduce((a, r) => a + r.deaths, 0) / N).toFixed(2)} · runs with ≥1 death ${(R.filter(r => r.deaths).length / N * 100).toFixed(0)}% · causes ${JSON.stringify(deaths)}`);
  console.log(`minutes with a vital <25%: p50 ${pct(R.map(r => r.lowMin), .5)} · lowest vital p50 ${pct(R.map(r => r.minVit), .5)} · idle waiting p50 ${pct(R.map(r => r.idleMin), .5)} min · base powered ${(pct(R.map(r => r.power), .5) * 100).toFixed(0)}%`);
  console.log('objective done at (median min): ' + D.GOALS.map(g => `${g.id} ${gt[g.id] ? pct(gt[g.id], .5).toFixed(1) + (gt[g.id].length < N ? ` (${Math.round(gt[g.id].length / N * 100)}%)` : '') : '—'}`).join(' · '));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(all.slice(0, 30), null, 1));
