// Red Dust Outpost · MOON SURVIVAL
// First-person survival at the lunar south pole, built on the Adventure surface engine (real Moon gravity and physics,
// the per-world ground, NASA 3D models). No aliens: the Moon itself is the danger.
// Numbers, costs, texts and the story live in survival_data.js (edited by the design team).
import * as THREE from 'three';
import * as D from './survival_data.js';
import { makeRover } from './adv_rover.js';
import { AUD } from './adv_audio.js';
import { buildHab, HAB_R } from './survival_hab.js';
import { makeVoice } from './survival_voice.js';

const KEY = 'rdo2-surv', V3 = THREE.Vector3, TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a), clamp = THREE.MathUtils.clamp;
function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export function makeSurvival(R, api) {
  let st = null, on = false, hud = null, built = [], caches = [], rover = null, lamp = null, ghost = null, bsel = -1, brot = 0, panel = null;
  let IN = null, earth = null, fcT = 0, fc = '', zoom = false, touchZoom = false, samples = [], ship = null, menuDone = false, idleT = 120, walked = 0;
  const VOX = makeVoice({ state: () => st, voiceOn: () => (api.voiceOn ? api.voiceOn() : true), radio: () => AUD.radio(), host: () => hud });
  const vo = (ev, o) => { try { return VOX.play(ev, o); } catch (e) { return false; } };
  let use = { t: 0, target: null }, mouseDown = false, touchUse = false, touchJet = false, thrustK = 0, latR = 0, look = null, wasG = true, lastVy = 0, sunT = 0, sunlit = true, tSave = 0, tSec = 0, flare = null, inside = false;
  const S = () => R.surf.S, H = (x, z) => R.surf.H(x, z);
  const sd = new V3(1, .04, 0), TH = new V3();

  /* ---------------- state and saving ---------------- */
  const today = () => new Date().toISOString().slice(0, 10);
  const twistOf = day => D.DAILY[[...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % D.DAILY.length];
  function fresh(mode = 'normal', diff = 'normal') { const daily = mode === 'daily', tw = daily ? twistOf(today()) : null; return { v: 1, mode, diff: mode === 'daily' ? 'normal' : diff, day: daily ? today() : null, twist: tw ? tw.id : null,
    inv: { scrap: 0, elec: 0, regolith: 0, ice: 0 }, vit: { hp: 100, o2: tw && tw.id === 'leak' ? 80 : 100, pw: 100, tc: 22, dose: 0, leak: tw && tw.id === 'leak' ? 1 : 0, food: 90, water: 90 }, jet: 100,
    carry: [], done: [], rp: 0, upg: {}, rescue: null,
    t: 0, sunA: 2.4, builds: [], loot: null, lander: { o2: D.LANDER.o2, pw: D.LANDER.power, meals: D.FOOD.start.meals, water: D.FOOD.start.water, kits: D.LANDER.kits }, base: { pw: 0, o2: 0, iceQ: 0, water: 0, meals: 0, grow: 0 }, goal: 0,
    flags: { iceCut: 0 }, stats: { flares: 0, sheltered: 0, deaths: 0, o2made: 0, powered: 0, total: 0, inside: 0 },
    next: { flare: D.DANGER.flareFirstMin * 60 * (((D.DIFF || {})[diff] || {}).flare || 1), meteor: (D.DANGER.meteorFirstMin || 5) * 60 + rnd(0, 120) }, pos: null }; }
  // pitch demo: a guided 3-minute run for presenting the game. Starts with materials, can't fail, scripted beats.
  function freshDemo() { const f = fresh('demo', 'easy'); Object.assign(f.inv, { scrap: 22, elec: 9, regolith: 0 }); f.next.meteor = 1e9; f.next.flare = 1e9; f.dm = 0; f.dmT = 0; return f; }
  const keyOf = mode => mode === 'daily' ? KEY + '-daily' : mode === 'demo' ? KEY + '-demo' : KEY;
  function load(mode = 'normal') { try { const s = JSON.parse(localStorage.getItem(keyOf(mode)) || 'null'); if (!s || s.v !== 1) return null; if (mode === 'daily' && (s.day !== today() || s.over)) return null;
    // older saves: fill in what newer versions added
    const f = fresh(mode); for (const k of ['carry', 'done', 'rp', 'upg']) if (s[k] == null) s[k] = f[k]; s.vit.food ??= 90; s.vit.water ??= 90; s.lander.meals ??= f.lander.meals; s.lander.kits ??= f.lander.kits; s.lander.water ??= f.lander.water; for (const k of ['water', 'meals', 'grow']) s.base[k] ??= 0; s.mode ??= mode; return s; } catch (e) { return null; } }
  function save() { if (!st) return; try { const P = S().player.position; st.pos = [P.x, P.z]; localStorage.setItem(keyOf(st.mode), JSON.stringify(st)); } catch (e) {} }
  const U = id => !!(st && st.upg && st.upg[id]);
  const DF = k => ((D.DIFF && D.DIFF[(st && st.diff) || 'normal']) || {})[k] ?? 1;
  const TW = id => !!(st && st.twist === id);
  const flareLen = () => st && st.mode === 'demo' ? 35 : D.DANGER.flareSec;
  const elev = () => TW('shadow') ? 2.5 : D.SUN.elevationDeg;
  const o2Min = () => D.SUIT.o2Min * DF('o2') * (U('tank') ? 1.3 : 1) * (TW('leak') ? .8 : 1), pwMin = () => D.SUIT.powerMin * DF('pw') * (U('cell') ? 1.3 : 1), fuelSec = () => D.JET.fuelSec * (U('thrust') ? 1.5 : 1), gk = () => U('tools') ? .7 : 1;
  // time points: full rate outside, a quarter while safe inside, nothing for time skipped in the bunk (no farming by resting)
  const tPts = () => st.pts ?? st.t, score = () => Math.floor((tPts() * D.SCORE.perSec + st.goal * D.SCORE.perGoal + st.done.length * D.SCORE.perSample) * DF('score'));
  const has = c => Object.entries(c).every(([k, n]) => (st.inv[k] || 0) >= n);
  const pay = c => { for (const k in c) st.inv[k] -= c[k]; };
  const costTxt = c => Object.entries(c).map(([k, n]) => `${D.RES[k].icon}${n}`).join(' ');
  const count = id => st.builds.filter(b => b.id === id).length;

  /* ---------------- sun, shadow, temperature ---------------- */
  function sunDir() { const el = elev() * Math.PI / 180, a = st.sunA; sd.set(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a)); return sd; }
  // march from a point toward the Sun over the real terrain heights: if the ground rises above the ray, the point is in shadow
  function inSun(x, y, z, d = sd) { let s = 1.5; for (let i = 0; i < 46; i++) { const px = x + d.x * s, pz = z + d.z * s, py = y + d.y * s; if (Math.abs(px) > 1500 || Math.abs(pz) > 1500) return true; if (H(px, pz) > py) return false; s *= 1.16; } return true; }
  // Earth from the lunar south pole: it hangs almost still, just above the horizon (it only wobbles a few degrees: libration)
  const ED = new V3(Math.sin(D.EARTH.azDeg * Math.PI / 180) * Math.cos(D.EARTH.elDeg * Math.PI / 180), Math.sin(D.EARTH.elDeg * Math.PI / 180), Math.cos(D.EARTH.azDeg * Math.PI / 180) * Math.cos(D.EARTH.elDeg * Math.PI / 180));
  const seesEarth = (x, y, z) => inSun(x, y, z, ED);
  const inCrater = (x, z) => Math.hypot(x - D.CRATER.x, z - D.CRATER.z) < D.CRATER.r * .62;

  /* ---------------- meshes ---------------- */
  const M = { white: new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: .55, metalness: .2 }), foil: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: .3, metalness: .85 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x8a8d91, roughness: .5, metalness: .6 }), dark: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: .6, metalness: .4 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1b2a55, roughness: .25, metalness: .7, emissive: 0x050a18 }), orange: new THREE.MeshStandardMaterial({ color: 0xe0662a, roughness: .5 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x66e0ff }), red: new THREE.MeshBasicMaterial({ color: 0xff4a3a }), regolith: new THREE.MeshStandardMaterial({ color: 0x6f6b66, roughness: 1 }) };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), cyl = (r, h, m, s = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, s), m);
  function shadowAll(g) { g.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); return g; }
  function nasa(name, width, g, noShadow) { // a NASA 3D Resources model, scaled to a real width; the box stands in until it loads
    api.loader.load('models/nasa/' + name + '.glb', gl => { const o = gl.scene; try { api.fixMat(o); } catch (e) {} const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new V3()), k = width / Math.max(sz.x, sz.z, .01);
      o.scale.setScalar(k); bb.setFromObject(o); o.position.y -= bb.min.y; while (g.children.length) g.remove(g.children[0]); shadowAll(o); if (noShadow) o.traverse(n => { if (n.isMesh) n.castShadow = false; }); g.add(o); }, undefined, () => {}); }
  function makeMesh(id) { const g = new THREE.Group();
    if (id === 'solar') { const m = cyl(.12, 6.2, M.grey); m.position.y = 3.1; g.add(m); const p = new THREE.Group(); p.position.y = 4.4; const pan = box(2.4, 3.6, .08, M.panel); p.add(pan); const fr = box(2.5, .08, .12, M.grey); fr.position.y = 1.82; p.add(fr); g.add(p); g.userData.pivot = p; const b = cyl(.6, .3, M.grey); b.position.y = .15; g.add(b); }
    else if (id === 'battery') { const b = box(1.8, 1.1, 1.1, M.white); b.position.y = .55; g.add(b); const s = box(1.82, .12, 1.12, M.dark); s.position.y = .85; g.add(s); const l = box(.5, .08, .02, M.glow); l.position.set(0, .6, .56); g.add(l); g.userData.light = l; }
    else if (id === 'hab') { const c = cyl(2.9, 3.2, M.white, 24); c.position.y = 1.6; g.add(c); nasa('habitat-demonstration-unit', 7.2, g); }
    else if (id === 'ice') { const t = cyl(.75, 2.2, M.white); t.position.y = 1.1; g.add(t); const t2 = cyl(.45, 1.6, M.foil); t2.position.set(1.2, .8, 0); g.add(t2); const p = box(1.2, .12, .12, M.grey); p.position.set(.6, 1.5, 0); g.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), M.glow); l.position.set(0, 2.3, 0); g.add(l); g.userData.light = l; }
    else if (id === 'berm') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), M.regolith); m.scale.set(4.2, 1.9, 1.7); g.add(m); }
    else if (id === 'antenna') { const m = cyl(.1, 3, M.grey); m.position.y = 1.5; g.add(m); const h = new THREE.Group(); h.position.y = 3; g.add(h);
      if (matchMedia('(pointer:coarse)').matches) { // phones: a light hand-built laser telescope (the NASA LLCD model alone is ~183k triangles)
        const fork = box(.9, .12, .5, M.grey); h.add(fork); for (const sx of [-.42, .42]) { const arm = box(.08, .6, .3, M.grey); arm.position.set(sx, .3, 0); h.add(arm); }
        const tube = cyl(.26, 1, M.white, 14); tube.rotation.x = Math.PI / 2 - .25; tube.position.y = .42; h.add(tube); const lens = new THREE.Mesh(new THREE.CircleGeometry(.22, 16), M.dark); lens.position.set(0, .54, .5); lens.rotation.x = -.25; h.add(lens);
        const led = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M.glow); led.position.set(.3, .1, .26); h.add(led); }
      else { const d = box(.8, .8, .8, M.white); h.add(d); nasa('lunar-laser-communications-demonstration-llcd', 1.6, h, true); } }
    return shadowAll(g); }
  function cacheMesh(i, big) { const g = new THREE.Group(); const n = big ? 5 : 2 + (i % 2);
    for (let k = 0; k < n; k++) { const b = box(rnd(.7, 1.2), rnd(.5, .8), rnd(.6, 1), k % 2 ? M.white : M.foil); b.position.set(rnd(-1.2, 1.2), .3, rnd(-1.2, 1.2)); b.rotation.set(rnd(-.2, .2), rnd(0, 3), rnd(-.25, .25)); g.add(b); }
    if (big) { const body = cyl(1.4, 1.6, M.foil, 8); body.position.y = .9; body.rotation.z = .5; g.add(body); for (let k = 0; k < 4; k++) { const l = cyl(.06, 2.2, M.grey, 6); const a = k * TAU / 4; l.position.set(Math.cos(a) * 1.6, .6, Math.sin(a) * 1.6); l.rotation.set(Math.sin(a) * .7, 0, Math.cos(a) * .9); g.add(l); } }
    const bc = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), M.red); bc.position.y = big ? 2 : 1.1; g.add(bc); g.userData.beacon = bc; shadowAll(g);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7a40, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 30; g.add(beam); g.userData.beam = beam; return g; }

  /* ---------------- world setup ---------------- */
  function placeWorld() { const s = S(), scn = s.scn;
    // supply caches and two wrecked cargo landers, always in the same places
    if (!st.loot) st.loot = []; caches = [];
    for (let i = 0; i < D.CACHES + 2; i++) { const big = i >= D.CACHES; let a = hash(i + 3) * TAU, d = big ? 210 + hash(i + 9) * 60 : 45 + hash(i + 5) * 330, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (inCrater(x, z) && !big) { x = -x; z = Math.abs(z); } if (big) { const ca = hash(i) * 1.2 - .6; x = D.CRATER.x + Math.sin(ca) * D.CRATER.r * 1.08; z = D.CRATER.z + Math.cos(ca) * D.CRATER.r * 1.08; }
      if (st.loot[i] == null) { const L = big ? { scrap: 10, elec: 5 } : D.CACHE_LOOT[i % D.CACHE_LOOT.length]; st.loot[i] = TW('scarce') ? { scrap: Math.ceil(L.scrap * 2 / 3), elec: Math.ceil(L.elec * 2 / 3) } : { ...L }; }
      const m = cacheMesh(i, big); m.position.set(x, H(x, z), z); scn.add(m); caches.push({ i, x, z, m, big }); if (st.loot[i].scrap + st.loot[i].elec === 0) { m.userData.beacon.visible = false; m.userData.beam.visible = false; } }
    (st.drops || []).forEach((dp, k) => { const i = D.CACHES + 2 + k; const m = cacheMesh(i, false); m.position.set(dp.x, H(dp.x, dp.z), dp.z); scn.add(m); caches.push({ i, x: dp.x, z: dp.z, m, big: false }); if (st.loot[i].scrap + st.loot[i].elec === 0) { m.userData.beacon.visible = false; m.userData.beam.visible = false; } });
    // science samples: a few special rocks, each in the kind of place it would really be found
    samples = []; const sm = new THREE.MeshStandardMaterial({ color: 0x8fb7c9, roughness: .4, metalness: .1, emissive: 0x0a2a36 });
    D.SAMPLES.forEach((o, i) => { if (st.done.includes(o.id) || st.carry.includes(o.id)) return; const h1 = hash(i * 13 + 2), h2 = hash(i * 7 + 5); let x, z;
      if (o.where === 'crater') { const a = h1 * TAU, d = D.CRATER.r * (.12 + h2 * .3); x = D.CRATER.x + Math.cos(a) * d; z = D.CRATER.z + Math.sin(a) * d; }
      else if (o.where === 'rim') { const a = (h1 - .5) * 2.4, d = D.CRATER.r * (1.1 + h2 * .25); x = D.CRATER.x + Math.sin(a) * d; z = D.CRATER.z + Math.cos(a) * d; }
      else { const a = h1 * TAU, d = 120 + h2 * 300; x = Math.cos(a) * d; z = Math.abs(Math.sin(a)) * d * .8 + 40; }
      const g = new THREE.Group(), r = new THREE.Mesh(new THREE.DodecahedronGeometry(.22, 0), sm); r.position.y = .12; r.rotation.set(h1 * 3, h2 * 3, 0); g.add(r);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 14, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x55d6e8, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 7; g.add(beam);
      g.position.set(x, H(x, z), z); scn.add(shadowAll(g)); samples.push({ o, x, z, g }); });
    // the broken lunar rover next to your lander
    if (!st.flags.rover) { try { rover = makeRover('lrv', api.loader, api.fixMat); rover.place(14, 10, .8, H); rover.g.rotation.z = .12; scn.add(rover.g); } catch (e) { rover = { g: new THREE.Group(), st: { x: 14, z: 10 } }; } }
    // what you have built
    built = []; st.builds.forEach(b => addBuild(b, true));
    // helmet lamp
    lamp = new THREE.SpotLight(0xfff4e0, 0, 60, .42, .55, 1.2); lamp.castShadow = false; scn.add(lamp); scn.add(lamp.target);
    // nothing to collect from Adventure mode here
    (s.cols || []).forEach(c => { c.got = true; if (c.m) c.m.visible = false; }); }
  function addBuild(b, quiet) { const def = D.BUILD.find(x => x.id === b.id), m = makeMesh(b.id); m.position.set(b.x, H(b.x, b.z), b.z); m.rotation.y = b.ry || 0; S().scn.add(m); built.push({ b, def, m, lit: true }); if (b.id === 'solar') { b.dust ??= 0; m.traverse(n => { if (n.isMesh && n.material === M.panel) { n.material = M.panel.clone(); m.userData.pm = n.material; } }); }
    if (!quiet) { api.sfx('bld'); built[built.length - 1].pop = 0; m.scale.setScalar(.05); shake(.25); for (let i = 0; i < 24; i++) { const a = Math.random() * TAU; S().dust.emit(new V3(b.x, H(b.x, b.z) + .1, b.z), new V3(Math.cos(a) * 2, 1 + Math.random() * 1.5, Math.sin(a) * 2), S().dc, .14, 1.6, 1, .2, { grow: 1, drag: 0, grav: 1.62, a: .85 }); } } }

  /* ---------------- HUD ---------------- */
  function css() { if (document.getElementById('svCss')) return; const c = document.createElement('style'); c.id = 'svCss'; c.textContent = `
  #adv.surv #aSuit,#adv.surv #aScn,#adv.surv #aSpd,#adv.surv #aLand,#adv.surv #aMis,#adv.surv #aHud,#adv.surv #aMap,#adv.surv #aHan,#adv.surv .lab,#adv.surv #aDrv,#adv.surv #aCraft{display:none!important}
  #sv .svp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,8,12,.6);pointer-events:auto}
  #sv{position:absolute;inset:0;pointer-events:none;font:600 13px/1.3 system-ui,sans-serif;color:#e8f1f5;text-shadow:0 1px 2px #000}
  #sv .cross{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(0,0,0,.4)}
  #sv .ring{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border-radius:50%;background:conic-gradient(#55D6E8 var(--p),transparent 0);-webkit-mask:radial-gradient(circle,transparent 18px,#000 19px);mask:radial-gradient(circle,transparent 18px,#000 19px);opacity:.9}
  #sv .prompt{position:absolute;left:50%;top:calc(50% + 34px);transform:translateX(-50%);background:rgba(10,16,24,.72);padding:5px 10px;border-radius:8px;white-space:nowrap;font-size:13px}
  #sv .prompt b{color:#F4A259}
  #sv .vit{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:14px;width:210px;display:grid;gap:5px}
  #sv .bar{position:relative;height:20px;background:rgba(10,16,24,.7);border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,.12)}
  #sv .bar i{position:absolute;inset:0 auto 0 0;display:block;transition:width .3s}
  #sv .bar span{position:relative;padding-left:7px;line-height:20px;font-size:12px}
  #sv .bar.hp i{background:#c0392b}#sv .bar.o2 i{background:#2e86c1}#sv .bar.pw i{background:#d4ac0d}#sv .bar.tc i{background:#7f8c8d}#sv .bar.jt i{background:#8e44ad}#sv .bar.fd i{background:#b9770e}#sv .bar.wt i{background:#17a589}#sv .bar{height:17px}#sv .bar span{line-height:17px;font-size:11px}#sv .goal .sc2{display:block;margin-top:4px;color:#F4A259;font-size:12px}#sv .rescue{position:absolute;left:50%;top:118px;transform:translateX(-50%);background:rgba(20,70,110,.85);padding:5px 12px;border-radius:6px;display:none}
  #sv .bar.warn{animation:svw .8s infinite}@keyframes svw{50%{border-color:#ff5a4a}}
  #sv .inv{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:6px}
  #sv .inv div{min-width:52px;text-align:center;background:rgba(10,16,24,.7);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:4px 6px;font-size:15px}
  #sv .inv small{display:block;font-size:10px;opacity:.7}
  #sv .goal{position:absolute;left:max(12px,env(safe-area-inset-left));top:52px;max-width:300px;background:rgba(10,16,24,.66);border-left:3px solid #55D6E8;padding:7px 10px;border-radius:4px}
  #sv .goal small{display:block;opacity:.65;font-size:11px;letter-spacing:.05em}
  #sv .env{position:absolute;left:50%;top:52px;transform:translateX(-50%);background:rgba(10,16,24,.66);padding:4px 12px;border-radius:12px;font-size:12px;white-space:nowrap}
  #sv .env .sun{color:#ffd866}#sv .env .sh{color:#7fb3ff}
  #sv .alarm{position:absolute;left:50%;top:84px;transform:translateX(-50%);background:rgba(160,30,20,.85);padding:6px 14px;border-radius:6px;font-size:14px;display:none;text-align:center}
  #sv .bld{position:absolute;left:50%;bottom:74px;transform:translateX(-50%);display:none;gap:6px;pointer-events:auto}
  #sv .bld button{background:rgba(10,16,24,.82);color:#e8f1f5;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;font:600 12px system-ui;min-width:74px;cursor:pointer}
  #sv .bld button.sel{border-color:#55D6E8;box-shadow:0 0 0 1px #55D6E8}#sv .bld button.no{opacity:.45}
  #sv .bld button b{display:block;font-size:18px}
  #sv .btns{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:128px;display:none;gap:8px;flex-direction:column;pointer-events:auto}
  #sv .btns button{width:64px;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(10,16,24,.7);color:#fff;font:700 12px system-ui}
  @media (pointer:coarse){#sv .btns{display:flex}}
  #sv .svc{background:#101820;border:1px solid rgba(85,214,232,.35);border-radius:14px;padding:18px 20px;max-width:min(560px,92vw);max-height:86vh;overflow:auto}
  #sv .svc h2{margin:0 0 8px;font-size:20px}#sv .svc p{font-weight:400;line-height:1.45}
  #sv .svc .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  #sv .svc button{background:#55D6E8;color:#06131a;border:0;border-radius:8px;padding:9px 14px;font:700 13px system-ui;cursor:pointer}
  #sv .svc button.sec{background:#26323d;color:#e8f1f5}
  #sv .sc{display:grid;grid-template-columns:28px 1fr 46px;gap:6px 8px;align-items:center;margin:4px 0}
  #sv .sc .b{height:9px;background:#26323d;border-radius:5px;overflow:hidden}#sv .sc .b i{display:block;height:100%;background:#55D6E8}
  #sv .tint{position:absolute;inset:0;background:radial-gradient(circle,transparent 40%,rgba(255,120,40,.35));opacity:0;transition:opacity .6s}
  #sv .gd{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:none;text-align:center;white-space:nowrap;font-size:12px;transition:opacity .2s}
  #sv .gd .ic{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:rgba(85,214,232,.9);color:#06131a;font-size:16px;box-shadow:0 0 0 3px rgba(85,214,232,.3),0 2px 8px rgba(0,0,0,.6)}
  #sv .gd.urg .ic{background:rgba(255,90,70,.95);box-shadow:0 0 0 3px rgba(255,90,70,.35);animation:svp 1s infinite}@keyframes svp{50%{transform:scale(1.15)}}
  #sv .gd .ar{position:absolute;left:50%;top:50%;width:0;height:0;margin:-6px 0 0 -6px;border:6px solid transparent;border-left:10px solid #55D6E8;transform-origin:-9px 6px;display:none}
  #sv .gd.edge .ar{display:block}#sv .gd.urg .ar{border-left-color:#ff5a46}
  #sv .gd .lb{display:block;margin-top:3px;background:rgba(10,16,24,.7);padding:2px 7px;border-radius:8px}
  #sv .goal .hint{display:block;margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,.12);color:#9fe8f3;font-size:12px;font-weight:600}
  #sv .goal .hint.urg{color:#ff8a7a}
  #sv .btns button.pulse{animation:svp 1s infinite;border-color:#55D6E8}
  #sv .fl{position:absolute;left:50%;top:calc(50% - 30px);transform:translateX(-50%);font-size:15px;font-weight:800;color:#9fe8f3;pointer-events:none;animation:svfl 1s ease-out forwards}
  @keyframes svfl{0%{opacity:0;transform:translate(-50%,8px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-34px)}}
  #sv .ban{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;display:none}
  #sv .ban.on{display:block;animation:svban 3.2s ease-out forwards}
  #sv .ban b{display:block;font-size:30px;letter-spacing:.06em;color:#7dffb0;text-shadow:0 0 18px rgba(80,255,160,.55),0 2px 4px #000}
  #sv .ban i{display:block;font-style:normal;font-size:22px;color:#F4A259;margin-top:2px}#sv .ban span{display:block;font-size:14px;margin-top:6px;opacity:.9}
  @keyframes svban{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}20%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%)}}
  #sv.banon .alarm,#sv.banon .rescue{opacity:.12;transition:opacity .3s}
  #sv .vs{position:absolute;left:calc(50% + 34px);top:calc(50% - 9px);font-size:13px;font-weight:800;display:none}
  #sv .vs.bad{color:#ff6a5a;animation:svw .5s infinite}
  /* landscape phones: everything has to fit in ~360 px of height, and thumbs need USE and JET in reach */
  @media (max-height:520px){
    #sv .vit{width:150px;right:calc(52px + env(safe-area-inset-right));bottom:auto;top:46px;gap:1px}#sv .bar{height:12px!important}#sv .bar span{line-height:12px!important;font-size:9px!important;padding-left:5px}
    #sv .btns{bottom:calc(84px + env(safe-area-inset-bottom));gap:5px;display:none;grid-template-columns:repeat(2,54px);gap:6px;flex-direction:unset}
    #sv .btns button{width:54px;height:40px;font-size:11px;border-radius:10px}
    #sv .inv{bottom:6px;gap:4px}#sv .inv div{min-width:38px;font-size:12px;padding:2px 4px}#sv .inv small{font-size:8.5px}
    #sv .goal{top:46px;max-width:225px;font-size:11.5px;padding:5px 8px}#sv .goal .hint{font-size:11px}#sv .goal .sc2{font-size:11px}
    #sv .env{left:250px;right:215px;top:48px;transform:none;white-space:normal;text-align:center;font-size:10.5px;padding:3px 8px}
    #sv .alarm{left:250px;right:215px;transform:none;top:auto;bottom:calc(50% + 46px);font-size:12px}
    #sv .rescue{left:250px;right:215px;top:auto;bottom:calc(50% + 46px);transform:none;font-size:12px;text-align:center}
    #sv .prompt{font-size:12px;top:calc(50% + 28px)}
    #sv .bld{bottom:52px;gap:4px;max-width:calc(100% - 340px)}#sv .bld button{min-width:52px;padding:4px 5px;font-size:10px}#sv .bld button b{font-size:15px}
    #sv .svc{padding:12px 14px;max-height:92vh}#sv .svc h2{font-size:17px}#sv .svc p{font-size:13px;margin:6px 0}#sv .svc button{padding:7px 11px;min-height:38px}
    #sv .ban b{font-size:22px}#sv .ban i{font-size:17px}
    .svvo{bottom:52px!important;max-width:44vw!important;font-size:12px!important;padding:5px 9px!important}
  }
  @media (max-height:520px) and (pointer:coarse){#sv .btns{display:grid}}
  #sv .hurt{position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(200,0,0,.8);opacity:0;transition:opacity .3s}`; document.head.appendChild(c); }
  function buildHUD() { css(); hud = document.createElement('div'); hud.id = 'sv'; hud.innerHTML = `<div class="tint"></div><div class="hurt"></div><div class="env"></div><div class="alarm"></div><div class="rescue"></div><div class="goal"></div>
    <div class="ban"><b></b><i></i><span></span></div><div class="vs"></div><div class="gd"><span class="ic"></span><i class="ar"></i><span class="lb"></span></div><div class="cross"></div><div class="ring" style="--p:0%;display:none"></div><div class="prompt" style="display:none"></div>
    <div class="vit"><div class="bar hp"><i></i><span></span></div><div class="bar o2"><i></i><span></span></div><div class="bar pw"><i></i><span></span></div><div class="bar tc"><i></i><span></span></div><div class="bar jt"><i></i><span></span></div><div class="bar fd"><i></i><span></span></div><div class="bar wt"><i></i><span></span></div></div>
    <div class="inv"></div><div class="bld"></div>
    <div class="btns"><button data-b="use">USE</button><button data-b="build">BUILD</button><button data-b="zoom">ZOOM</button><button data-b="jet">JET</button><button data-b="lamp">LAMP</button><button data-b="patch" style="display:none">PATCH</button></div>`;
    R.root.appendChild(hud); R.root.classList.add('surv');
    const bu = hud.querySelector('[data-b=use]'); bu.addEventListener('pointerdown', e => { e.preventDefault(); touchUse = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bu.addEventListener(ev, () => touchUse = false));
    const bz = hud.querySelector('[data-b=zoom]'); bz.addEventListener('pointerdown', e => { e.preventDefault(); touchZoom = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bz.addEventListener(ev, () => touchZoom = false));
    const bj = hud.querySelector('[data-b=jet]'); bj.addEventListener('pointerdown', e => { e.preventDefault(); touchJet = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bj.addEventListener(ev, () => touchJet = false));
    hud.querySelector('[data-b=build]').onclick = () => toggleBuild(); hud.querySelector('[data-b=lamp]').onclick = () => toggleLamp(); hud.querySelector('[data-b=patch]').onclick = () => patch(); }
  const $ = q => hud.querySelector(q);
  function bar(cls, v, txt, warn) { const b = $('.bar.' + cls); b.querySelector('i').style.width = clamp(v, 0, 100) + '%'; const s = b.querySelector('span'); if (s._t !== txt) { s.textContent = txt; s._t = txt; } b.classList.toggle('warn', !!warn); }
  function hudUpdate(envT) { const v = st.vit;
    bar('hp', v.hp, `♥ Health ${Math.ceil(v.hp)}`, v.hp < 30); const mo = !inside && prevV.ro2 > .01 && v.o2 < 50 ? Math.max(0, v.o2 / prevV.ro2 / 60) : null, mp = !inside && prevV.rpw > .01 && v.pw < 50 ? Math.max(0, v.pw / prevV.rpw / 60) : null, fm = m => m == null ? '' : m < 1 ? ` · ${Math.round(m * 60)} s left` : ` · ~${Math.round(m)} min left`;
    bar('o2', v.o2, `O₂ ${Math.ceil(v.o2)}%${v.leak ? ' · LEAK!' : ''}${fm(mo)}`, v.o2 < 20 || v.leak); bar('pw', v.pw, `⚡ Suit power ${Math.ceil(v.pw)}%${fm(mp)}`, v.pw < 15);
    bar('tc', clamp((v.tc + 20) / .6, 0, 100), `🌡 Suit ${Math.round(v.tc)} °C`, v.tc < 8 || v.tc > 38); bar('jt', st.jet, `🚀 Jetpack fuel ${Math.ceil(st.jet)}%`, st.jet < 10); bar('fd', v.food, `🍲 Food ${Math.ceil(v.food)}%`, v.food < 15); bar('wt', v.water, `💧 Water ${Math.ceil(v.water)}%`, v.water < 15);
    const inv = Object.keys(D.RES).map(k => `<div>${D.RES[k].icon} ${st.inv[k] || 0}<small>${D.RES[k].n}</small></div>`).join('') + `<div>🧪 ${st.carry.length}<small>Samples</small></div><div>🔬 ${st.rp}<small>Research</small></div>`; if ($('.inv')._t !== inv) { $('.inv').innerHTML = inv; $('.inv')._t = inv; }
    const ang = ((Math.atan2(sd.x, sd.z) - Math.atan2(-Math.sin(S().camYaw), -Math.cos(S().camYaw))) * 180 / Math.PI + 540) % 360 - 180, dir = Math.abs(ang) < 30 ? 'ahead' : Math.abs(ang) > 150 ? 'behind you' : ang > 0 ? 'to your left' : 'to your right';
    const P = S().player.position; let nc = null, nd = 1e9; caches.forEach(c => { const L = st.loot[c.i]; if (L.scrap + L.elec > 0) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < nd) { nd = d; nc = c; } } });
    let cTxt = ''; if (nc && nd > 4) { const ca = ((Math.atan2(nc.x - P.x, nc.z - P.z) - Math.atan2(-Math.sin(S().camYaw), -Math.cos(S().camYaw))) * 180 / Math.PI + 540) % 360 - 180; cTxt = ` · 📦 cache ${Math.round(nd)} m ${Math.abs(ca) < 20 ? 'ahead' : ca > 0 ? '◀ left' : 'right ▶'}`; }
    const e = `${sunlit ? '<span class="sun">☀ IN SUNLIGHT</span>' : '<span class="sh">● IN SHADOW</span>'} · ground ${envT} °C · Sun ${dir}${cTxt}${built.length ? ` · base ⚡${Math.round(st.base.pw)} O₂${Math.round(st.base.o2)}` : ''}${fc ? ' · ' + fc : ''}`; if ($('.env')._t !== e) { $('.env').innerHTML = e; $('.env')._t = e; }
    const g = D.GOALS[st.goal], gt = g ? `<small>OBJECTIVE ${st.goal + 1} / ${D.GOALS.length}${g.area ? ' · ' + D.AREAS.find(a => a.id === g.area).n.toUpperCase() : ''}</small>${g.t}` : '<small>ALL OBJECTIVES DONE</small>Keep your base alive. Press <b>Tab</b> for your base report.';
    const G0 = GUIDE.cur, gt2 = gt + (G0 && G0.t ? `<span class="hint${G0.urg ? ' urg' : ''}">➜ ${G0.t}</span>` : '') + `<span class="sc2">Score ${score().toLocaleString()}${st.mode === 'daily' ? ' · DAILY: ' + twistOf(st.day).n : st.diff && st.diff !== 'normal' ? ' · ' + D.DIFF[st.diff].n : ''}</span>`; if ($('.goal')._t !== gt2) { $('.goal').innerHTML = gt2; $('.goal')._t = gt2; }
    $('[data-b=patch]').style.display = v.leak ? '' : 'none'; }
  function alarm(t) { const a = $('.alarm'); a.style.display = t ? 'block' : 'none'; if (t && a._t !== t) { a.innerHTML = t; a._t = t; } }
  function hurt(k) { $('.hurt').style.opacity = k; }

  /* ---------------- panels (intro, habitat, report, death) ---------------- */
  function show(html, onBind) { close(); panel = document.createElement('div'); panel.className = 'svp'; panel.innerHTML = `<div class="svc">${html}</div>`; hud.appendChild(panel); try { document.exitPointerLock(); } catch (e) {} if (onBind) onBind(panel); }
  function close() { if (panel) { panel.remove(); panel = null; } }
  function intro() { const touch = matchMedia('(pointer:coarse)').matches, tw = st.mode === 'daily' ? twistOf(st.day) : null;
    const keys = touch ? [['Left stick', 'walk'], ['Drag right side', 'look'], ['USE (hold)', 'gather, open, repair'], ['BUILD', 'build menu'], ['JET (hold)', 'jetpack'], ['ZOOM', 'visor zoom'], ['LAMP', 'helmet light']]
      : [['WASD', 'walk · Shift run'], ['Mouse', 'look (click to lock)'], ['E (hold)', 'gather, open, repair'], ['B', 'build menu'], ['Space (hold)', 'jump, then jetpack'], ['F', 'helmet lamp'], ['P', 'patch a suit leak'], ['Z', 'visor zoom'], ['Tab', 'base report']];
    show(`<h2>🌑 ${D.SITE.n}</h2><p><b>${D.STORY.callsign}</b>, ${D.STORY.intro[0]}</p>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13px;margin:8px 0;padding:10px;background:#0a1219;border-radius:8px"><b style="grid-column:1/-1;color:#55D6E8">Your first moves</b>
      ${st.mode === 'demo' ? `<span>1.</span><span>Press ${touch ? 'BUILD' : '<b>B</b>'} and put a solar tower where the ghost turns green.</span><span>2.</span><span>Build the habitat, then walk in through the airlock.</span><span>3.</span><span>Follow the <b style="color:#55D6E8">blue marker</b>: the big moments come on cue.</span>` : `<span>1.</span><span>Follow the <b style="color:#55D6E8">blue marker</b> to a supply cache and hold ${touch ? 'USE' : 'E'}.</span><span>2.</span><span>Build a solar tower in the sunlight, then your habitat.</span><span>3.</span><span>Watch the bars on the right: oxygen, power, food, water.</span>`}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:3px 12px;font-size:12px;opacity:.85">${keys.map(([k, d]) => `<span><b style="color:#F4A259">${k}</b> ${d}</span>`).join('')}</div>
    ${st.mode === 'demo' ? '<p><b>🎤 Pitch demo:</b> you start with materials, nothing can kill you, and the big moments come on cue: build, go inside, a solar flare, Earth on the horizon, the rescue ship.</p>' : ''}${tw ? `<p><b>📅 Daily challenge · ${tw.n}:</b> ${tw.d} One life only.</p>` : st.diff && st.diff !== 'normal' ? `<p>${D.DIFF[st.diff].icon} <b>${D.DIFF[st.diff].n}</b>: ${D.DIFF[st.diff].d}</p>` : ''}
    <div class="row"><button id="svGo">Start surviving</button></div>`, p => p.querySelector('#svGo').onclick = () => { close(); vo('start', { once: true }); if (st.mode === 'daily') setTimeout(() => vo('daily'), 500); }); }
  function habPanel() { const v = st.vit, b = st.base; inside = true;
    show(`<h2>🏠 Inside the habitat</h2><p>Warm, pressurised and shielded. You heal faster in here.</p>
      <p>Base power <b>${Math.round(b.pw)}</b> · Base oxygen <b>${Math.round(b.o2)}%</b> · Ice waiting <b>${b.iceQ}</b></p>
      <div class="row"><button id="hR">Refill suit (O₂ and power)</button>${v.leak ? '<button id="hP">Patch suit</button>' : ''}<button class="sec" id="hT">Base report</button><button class="sec" id="hX">Go outside</button></div>
      <p style="opacity:.7;font-size:12px">${D.BUILD.find(x => x.id === 'hab').fact}</p>`, p => {
      p.querySelector('#hR').onclick = () => { const need = 100 - v.o2, got = Math.min(need, b.o2); v.o2 += got; b.o2 -= got; const pn = 100 - v.pw, pg = Math.min(pn, b.pw); v.pw += pg; b.pw -= pg; v.tc = 22; if (b.pw > 5) st.jet = 100; api.toast(got < need ? '⚠ The base is short of oxygen. Make more from ice.' : '✅ Suit refilled.', 2200); habPanel(); };
      if (v.leak) p.querySelector('#hP').onclick = () => { v.leak = 0; api.toast('🩹 Suit patched.', 1600); habPanel(); };
      p.querySelector('#hT').onclick = () => report(); p.querySelector('#hX').onclick = () => close(); }); }
  function scores() { const s = st.stats, f = st.flags, c = count;
    return { power: Math.min(100, c('solar') * 22 + c('battery') * 12 + (s.total ? s.powered / s.total : 0) * 34), habitat: c('hab') ? Math.min(100, 70 + s.inside / 12) : 0,
      life: c('ice') ? Math.min(100, 40 + s.o2made / 6) : 0, mobility: f.rover ? Math.min(100, 70 + (f.drove ? 30 : 0)) : 0,
      comms: c('antenna') ? (f.reported ? 100 : 55) : 0, safety: Math.min(100, (c('berm') ? 30 : 0) + s.sheltered * 25 + Math.max(0, 30 - s.deaths * 10) * (c('berm') ? 1 : .5)) }; }
  function report(win) { const sc = scores(), tot = Math.round(Object.values(sc).reduce((a, b) => a + b, 0) / 6), grade = tot >= 90 ? 'A' : tot >= 75 ? 'B' : tot >= 55 ? 'C' : tot >= 35 ? 'D' : 'E';
    const rows = D.AREAS.map(a => `<div class="sc"><span>${a.icon}</span><div><div style="font-size:12px">${a.n}</div><div class="b"><i style="width:${Math.round(sc[a.id])}%"></i></div></div><b>${Math.round(sc[a.id])}</b></div>`).join('');
    show(`<h2>📋 Base Design Report · grade ${grade} (${tot}/100)</h2>${win ? `<p><b>${D.STORY.win}</b></p>` : ''}
      <p style="font-size:13px;opacity:.8">Scored on the six areas of NASA's Moon Base Student Challenge (2026–27): power, habitat, life support, mobility, communications and astronaut safety. <i>Red Dust Outpost is not affiliated with NASA.</i></p>${rows}
      <p style="font-size:12px;opacity:.7">Survived ${Math.floor(st.t / 60)} min · ${st.stats.flares} solar flares · ${st.stats.deaths} suit failures · ${Math.round(st.stats.o2made)}% oxygen made from ice · dose ${st.vit.dose.toFixed(1)} mSv</p>
      <div class="row"><button id="rX">Back to the base</button></div>`, p => p.querySelector('#rX').onclick = () => close()); }
  function die(cause) { const s = st.stats; s.deaths++; const lost = {}, dl = D.DANGER.deathLoss ?? .5; for (const k in st.inv) { lost[k] = Math.floor(st.inv[k] * dl); st.inv[k] -= lost[k]; } calm(D.DANGER.graceAfterDeathSec || 0); shake(1.3); api.sfx('hurt');
    const hab = st.builds.find(b => b.id === 'hab'), P = S().player.position, sx = hab ? hab.x + 5 : -8, sz = hab ? hab.z + 5 : -4; P.set(sx, H(sx, sz), sz); S().vel.set(0, 0, 0);
    Object.assign(st.vit, { hp: 70, o2: 85, pw: 85, tc: 20, leak: 0 }); vo('dead', { urgent: true });
    show(`<h2>☠ Suit failure</h2><p>${cause}</p><p>You wake up ${hab ? 'in the habitat' : 'in your lander'}. You dropped ${Math.round(dl * 100)}% of what you carried${Object.values(lost).some(n => n) ? ': ' + Object.entries(lost).filter(([, n]) => n).map(([k, n]) => `${n} ${D.RES[k].icon}`).join(' ') : ''}. Nothing else will go wrong for a few minutes: catch your breath.</p><div class="row"><button id="dX">Try again</button></div>`, p => p.querySelector('#dX').onclick = () => close()); }

  // one crisis at a time: push the next danger back so the player gets a calm window
  function calm(sec) { const N = st.next; if (!sec) return; N.meteor = Math.max(N.meteor, st.t + sec); if (!flare && N.flare < st.t + sec) N.flare = st.t + sec + 30; }

  /* ---------------- game feel: shake, floaters, banners, alarms ---------------- */
  let shakeA = 0, beepT = 0, heartT = 0; const prevV = { o2: null, pw: null, t: 0, ro2: 0, rpw: 0 };
  function shake(a) { shakeA = Math.min(1.6, Math.max(shakeA, a)); }
  function floater(t) { if (!hud) return; const f = document.createElement('div'); f.className = 'fl'; f.innerHTML = t; hud.appendChild(f); setTimeout(() => f.remove(), 1000); }
  function banner(big, pts, small) { const b = $('.ban'); b.querySelector('b').textContent = big; b.querySelector('i').textContent = pts || ''; b.querySelector('span').innerHTML = small || ''; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); hud.classList.add('banon'); clearTimeout(banner.t); banner.t = setTimeout(() => hud && hud.classList.remove('banon'), 3200); }
  function feel(dt) { const v = st.vit, s = S();
    // camera shake (applied after the surface engine has placed the camera this frame)
    if (shakeA > .01) { const k = shakeA * shakeA; R.cam.position.x += (Math.random() - .5) * .14 * k; R.cam.position.y += (Math.random() - .5) * .1 * k; R.cam.rotateZ((Math.random() - .5) * .03 * k); shakeA *= Math.exp(-dt * 5); }
    // how fast oxygen and power are going, so the bars can say how many minutes are left
    if ((prevV.t -= dt) <= 0) { if (prevV.o2 != null) { prevV.ro2 = prevV.ro2 * .6 + (prevV.o2 - v.o2) * .4; prevV.rpw = prevV.rpw * .6 + (prevV.pw - v.pw) * .4; } prevV.o2 = v.o2; prevV.pw = v.pw; prevV.t = 1; }
    // alarms: a beep when air or power is nearly gone, a heartbeat when hurt
    if (!inside && (v.o2 < 15 || v.pw < 10 || v.leak) && (beepT -= dt) <= 0) { beepT = v.o2 < 8 || v.pw < 5 ? 1.6 : 3.2; api.sfx('alarm'); }
    if (v.hp < 35 && (heartT -= dt) <= 0) { heartT = v.hp < 18 ? .7 : 1.1; api.sfx('heart'); }
    // vertical speed while airborne: red when the landing would hurt
    const vs = $('.vs'); if (!s.onGround && !inside && !s.drive && s.vel.y < -1.5) { const sp = -s.vel.y, t = `↓ ${sp.toFixed(1)} m/s`; vs.style.display = 'block'; if (vs._t !== t) { vs._t = t; vs.textContent = t; } vs.classList.toggle('bad', sp > D.SUIT.fallSafe); } else vs.style.display = 'none';
    // buildings pop up when placed
    built.forEach(B => { if (B.pop != null) { B.pop += dt; const k = Math.min(1, B.pop / .55), c1 = 1.70158, e = 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); B.m.scale.setScalar(Math.max(.05, e)); if (k >= 1) { B.m.scale.setScalar(1); B.pop = null; } } }); }
  const minsLeft = r => r > .02 ? Math.max(0, Math.round(r)) : null;

  /* ---------------- solid things: you can't walk through buildings, crates, the lander or the rover ---------------- */
  const SOLID = { hab: 3.3, berm: 2.6, battery: 1.1, ice: 1.2, solar: .7, antenna: .6 };
  function collide() { const s = S(); if (inside || s.drive || !s.onGround && s.vel.y > 2) return; const P = s.player.position, pr = .45; let mx = 0, mz = 0;
    const push = (x, z, r) => { const dx = P.x - x, dz = P.z - z, d = Math.hypot(dx, dz), R0 = r + pr; if (d >= R0 || d < 1e-4) return; const k = (R0 - d) / d; mx += dx * k; mz += dz * k;
      const nx = dx / d, nz = dz / d, vn = s.vel.x * nx + s.vel.z * nz; if (vn < 0) { s.vel.x -= vn * nx; s.vel.z -= vn * nz; } };
    for (const B of built) push(B.b.x, B.b.z, SOLID[B.b.id] || .8); for (const c of caches) if (Math.abs(c.x - P.x) < 6 && Math.abs(c.z - P.z) < 6) push(c.x, c.z, c.big ? 1.9 : 1.05);
    push(-12, -8, 2.4); if (rover && !st.flags.rover) push(rover.st.x, rover.st.z, 1.5);
    if (mx || mz) { P.x += mx; P.z += mz; const gy = H(P.x, P.z); if (P.y < gy) P.y = gy; R.cam.position.x += mx; R.cam.position.z += mz; } }
  // look speed (menu setting), for mouse and touch
  const LOOKS = { slow: .65, normal: 1, fast: 1.45 }; let lookK = (() => { try { return LOOKS[localStorage.getItem(KEY + '-look')] || 1; } catch (e) { return 1; } })();

  /* ---------------- interaction ---------------- */
  function forward() { const c = R.cam, f = new V3(); c.getWorldDirection(f); return f; }
  function findTarget() { const P = S().player.position, f = forward(), fx = new V3(f.x, 0, f.z).normalize(), list = [];
    const add = (x, z, r, o, cone = .55) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz) - r; if (d > 3.4) return; const dot = (dx * fx.x + dz * fx.z) / Math.max(.01, Math.hypot(dx, dz)); if (dot > cone || d < .6) list.push([d * .6 - dot * 2, o]); };
    caches.forEach(c => { const L = st.loot[c.i]; if (L.scrap + L.elec > 0) add(c.x, c.z, c.big ? 2 : 1.2, { kind: 'cache', c, t: D.GATHER.cacheSec * gk(), label: `Salvage ${c.big ? 'the wrecked lander' : 'supply cache'} <small>(${L.scrap}🔩 ${L.elec}💾 left)</small>` }); });
    samples.forEach(sm => add(sm.x, sm.z, 1, { kind: 'sample', sm, t: 1.2 * gk(), label: `Collect sample: <b>${sm.o.n}</b>` }, .35));
    add(-12, -8, 3, { kind: 'lander', t: .8, label: `Your lander: refill <small>(O₂ ${Math.round(st.lander.o2)}% · power ${Math.round(st.lander.pw)}% left)</small>` });
    if (rover && !st.flags.rover) add(rover.st.x, rover.st.z, 1.8, { kind: 'rover', t: 2.5, label: has(D.ROVER.cost) ? `Repair the lunar rover <small>${costTxt(D.ROVER.cost)}</small>` : `Broken lunar rover — needs ${costTxt(D.ROVER.cost)}`, ok: has(D.ROVER.cost) });
    built.forEach(B => { const b = B.b, r = b.id === 'hab' ? 3.4 : b.id === 'berm' ? 3 : 1.2;
      if (b.id === 'hab') add(b.x, b.z, r, { kind: 'hab', B: b, t: .4, label: 'Enter the habitat (airlock)' });
      else if (b.id === 'ice') add(b.x, b.z, r, { kind: 'ice', t: .6, label: st.inv.ice ? `Load ${st.inv.ice} ice into the processor` : `Ice processor <small>(${st.base.iceQ} ice waiting)</small>`, ok: st.inv.ice > 0 });
      else if (b.id === 'antenna') { const see = seesEarth(b.x, H(b.x, b.z) + 3.2, b.z); add(b.x, b.z, r, { kind: 'antenna', t: 1.5, label: !see ? 'Laser comms: <b>Earth is hidden</b> behind the terrain from here' : st.goal >= D.GOALS.length - 1 ? 'Send your base report to Earth' : 'Laser comms terminal: linked to Earth ✓', ok: see && st.goal >= D.GOALS.length - 1 }); }
      else if (b.id === 'solar' && (b.dust || 0) > 5) add(b.x, b.z, r, { kind: 'clean', B, t: D.DUST.cleanSec * gk(), label: `Brush the dust off the panel <small>(dust ${Math.round(b.dust)}% · power −${Math.round(b.dust * D.DUST.loss)}%)</small>` });
      else add(b.x, b.z, r, { kind: 'info', t: 0, label: `${B.def.icon} ${B.def.n}${b.id === 'solar' ? (B.lit ? ' · in sunlight ✓' : ' · in shadow ✗') + ` · dust ${Math.round(b.dust || 0)}%` : ''}`, ok: false }); });
    if (list.length) return list.sort((a, b) => a[0] - b[0])[0][1];
    if (S().camPitch > .42 && S().onGround) { const crat = inCrater(P.x, P.z); if (crat) return { kind: 'ice', dig: 1, t: D.GATHER.iceSec * gk(), label: 'Cut ice from the frozen crater floor' }; return { kind: 'dig', t: D.GATHER.digSec * gk(), label: 'Dig regolith' }; }
    return null; }
  function act(o) { const v = st.vit;
    if (o.kind === 'cache') { const L = st.loot[o.c.i]; const k = L.elec > 0 && (L.scrap === 0 || Math.random() < .4) ? 'elec' : 'scrap'; L[k]--; st.inv[k]++; api.sfx('col'); floater(`+1 ${D.RES[k].icon}`); if (!vo('cache', { once: true })) {} if (L.scrap + L.elec === 0) { vo('cacheEmpty', { cool: 40, skipIfBusy: true }); o.c.m.userData.beacon.visible = false; o.c.m.userData.beam.visible = false; api.toast('📦 Cache empty', 1200); } }
    else if (o.kind === 'dig') { st.inv.regolith++; floater('+1 🪨'); api.sfx('col'); vo('dig', { once: true }); }
    else if (o.kind === 'sample') { st.carry.push(o.sm.o.id); S().scn.remove(o.sm.g); samples = samples.filter(x => x !== o.sm); api.sfx('coin'); if (!vo('sample', { once: true })) vo('sampleMore', { skipIfBusy: true }); api.toast(`🧪 <b>${o.sm.o.n}</b> collected. Analyse it in the habitat’s geology glovebox.`, 3000); }
    else if (o.kind === 'clean') { o.B.b.dust = 0; vo('clean', { cool: 60, skipIfBusy: true }); api.toast('🧹 Panel clean. Full power again.', 1600); }
    else if (o.kind === 'ice' && o.dig) { st.inv.ice++; st.flags.iceCut++; floater('+1 🧊'); api.sfx('col'); vo('ice', { once: true }); }
    else if (o.kind === 'ice') { if (st.inv.ice > 0) { st.base.iceQ += st.inv.ice; st.inv.ice = 0; api.toast('🧊 Ice loaded. The processor makes oxygen while the base has power.', 2400); } }
    else if (o.kind === 'lander') { const L = st.lander; if (v.food < 70 && L.meals > 0) { L.meals--; v.food = Math.min(100, v.food + D.FOOD.meal); } if (v.water < 80 && L.water >= 10) { L.water -= 10; v.water = Math.min(100, v.water + D.FOOD.drink); }
      const a = Math.min(100 - v.o2, st.lander.o2); v.o2 += a; st.lander.o2 -= a; const b = Math.min(100 - v.pw, st.lander.pw); v.pw += b; st.lander.pw -= b; if (D.JET.refillAtLander) st.jet = 100; if (v.leak) { if (L.kits > 0) { L.kits--; v.leak = 0; api.toast(`🩹 Suit patched with a lander repair kit (${L.kits} left).`, 2200); } else if (st.inv.scrap) { v.leak = 0; st.inv.scrap--; } }
      api.toast(st.lander.o2 < 1 ? '⚠ The lander has no oxygen left. You need a habitat and ice.' : `Refilled. Lander reserve: O₂ ${Math.round(st.lander.o2)}%, power ${Math.round(st.lander.pw)}%, ${st.lander.meals} meals, water ${st.lander.water}`, 2600); }
    else if (o.kind === 'rover' && o.ok) { pay(D.ROVER.cost); st.flags.rover = 1; vo('rover', { once: true }); try { S().scn.remove(rover.g); } catch (e) {} const P = S().player.position; P.set(rover.st.x - 2, H(rover.st.x - 2, rover.st.z), rover.st.z); rover = null; api.toast('🚙 Rover repaired! Press <b>G</b> to drive, G again to park.', 3200); fact(D.ROVER.fact); }
    else if (o.kind === 'hab') enterHab(o.B);
    else if (o.kind === 'antenna' && o.ok) { st.flags.reported = 1; if (!st.rescue) st.rescue = { eta: st.t + D.RESCUE.etaSec }; vo('report', { urgent: true }); report(true); } }

  /* ---------------- building ---------------- */
  function toggleBuild() { if (bsel >= 0) return endBuild(); vo('build', { once: true }); bsel = 0; renderBuildBar(); setGhost(); }
  function endBuild() { bsel = -1; $('.bld').style.display = 'none'; if (ghost) { S().scn.remove(ghost); ghost = null; } }
  function renderBuildBar() { const el = $('.bld'); el.style.display = 'flex'; el.innerHTML = D.BUILD.map((b, i) => `<button data-i="${i}" class="${i === bsel ? 'sel' : ''} ${has(b.cost) ? '' : 'no'}"><b>${b.icon}</b>${i + 1}. ${b.n}<br><small>${costTxt(b.cost)}</small></button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => { bsel = +b.dataset.i; renderBuildBar(); setGhost(); }); }
  function setGhost() { if (ghost) S().scn.remove(ghost); ghost = makeMesh(D.BUILD[bsel].id); ghost.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.transparent = true; n.material.opacity = .45; n.castShadow = false; } }); S().scn.add(ghost);
    const d = D.BUILD[bsel]; api.toast(`${d.icon} <b>${d.n}</b> · ${costTxt(d.cost)}<br><small>${d.desc}</small>`, 3000); }
  function ghostPos() { const P = S().player.position, f = forward(), fx = new V3(f.x, 0, f.z).normalize(), dist = D.BUILD[bsel].id === 'hab' ? 9 : 6; const x = P.x + fx.x * dist, z = P.z + fx.z * dist; return [x, z]; }
  function canPlace(x, z, id) { const sl = Math.hypot(H(x + 1.5, z) - H(x - 1.5, z), H(x, z + 1.5) - H(x, z - 1.5)) / 3; if (sl > .3) return 'too steep';
    const r = id === 'hab' ? 4.5 : id === 'berm' ? 3.5 : 1.8; for (const B of built) if (Math.hypot(B.b.x - x, B.b.z - z) < r + 2) return 'too close to another building';
    for (const c of caches) if (Math.hypot(c.x - x, c.z - z) < r + 2) return 'too close to a cache'; if (Math.hypot(x + 12, z + 8) < r + 4) return 'too close to your lander'; return ''; }
  function stepGhost() { if (!ghost) return; const [x, z] = ghostPos(), d = D.BUILD[bsel], why = canPlace(x, z, d.id), lit = d.id === 'solar' ? inSun(x, H(x, z) + 5.5, z) : d.id === 'antenna' ? seesEarth(x, H(x, z) + 3.2, z) : true;
    ghost.position.set(x, H(x, z), z); ghost.rotation.y = brot; const ok = !why && has(d.cost); ghost.traverse(n => { if (n.isMesh) n.material.color.set(ok ? (lit ? 0x66ff99 : 0xffd040) : 0xff5040); });
    showPrompt(why ? `Can't build here: ${why}` : !has(d.cost) ? `Need ${costTxt(d.cost)}` : `<b>E / click</b> build ${d.n}${d.id === 'solar' ? (lit ? ' · in sunlight ✓' : ' · <b>in shadow</b> — it won’t make power here') : d.id === 'antenna' ? (lit ? ' · Earth in view ✓' : ' · <b>Earth hidden</b> — no link from here') : ''} · <b>R</b> rotate · <b>B</b> cancel`, 0); return ok ? [x, z] : null; }
  function place() { const p = stepGhost(); if (!p) return; const d = D.BUILD[bsel]; pay(d.cost); const b = { id: d.id, x: p[0], z: p[1], ry: brot }; st.builds.push(b); addBuild(b); fact(d.fact); endBuild(); save(); vo('b_' + d.id, { once: true }); if (d.id === 'hab') setTimeout(() => api.toast('🏠 Habitat built! Walk to it, look at it and <b>hold E</b> (or USE) to go inside.', 4200), 1800); }

  /* ---------------- controls ---------------- */
  function toggleLamp() { st.lamp = !st.lamp; api.sfx('click'); }
  function patch() { if (!st.vit.leak) return; const rg = D.SUIT.patchRegolith || 2;
    if (st.inv.scrap >= 1) { st.inv.scrap--; st.vit.leak = 0; vo('patched'); api.toast('🩹 Suit patched with scrap metal.', 1500); return; }
    if (st.inv.regolith >= rg) { st.inv.regolith -= rg; st.vit.leak = 0; vo('patched'); api.toast(`🩹 Hole plugged with packed regolith (−${rg} 🪨). Not pretty, but it holds.`, 2200); return; }
    api.toast(`No scrap! Look down and <b>hold E to dig ${rg} regolith</b>, then press <b>P</b> to plug the hole. Or get to the lander or habitat.`, 3500); }
  function key(e, down) { if (!on) return false; const k = e.key.toLowerCase();
    if (!down) { if (k === 'e') R.keys.e = 0; return false; }
    if (panel) { if (k === 'escape' || k === 'e' || k === 'enter') { close(); return true; } return true; }
    if (k === 'e') { R.keys.e = 1; e.preventDefault(); return true; }
    if (k === 'b') { toggleBuild(); return true; } if (k === 'escape' && bsel >= 0) { endBuild(); return true; }
    if (bsel >= 0 && k >= '1' && k <= String(D.BUILD.length)) { bsel = +k - 1; renderBuildBar(); setGhost(); return true; } if (bsel >= 0 && k === 'r') { brot += Math.PI / 4; return true; }
    if (k === 'f') { toggleLamp(); return true; } if (k === 'p') { patch(); return true; } if (k === 'tab') { e.preventDefault(); report(); return true; }
    if (k === 'g') { if (!st.flags.rover) { api.toast('The rover is broken. Repair it first (look for it next to your lander).', 2200); return true; } st.flags.drove = 1; return false; }
    if (k === 'c') { R.keys.c = 1; return true; } if (k === 'z') { R.keys.z = 1; return true; } if (k === 'l' || k === 'm' || k === 'k' || k === 'n' || k === 'h') return true; return false; }
  function bindInput() { const cv = R.ren ? R.ren.domElement : R.root.querySelector('canvas');
    const onMove = e => { if (document.pointerLockElement !== cv || panel) return; const s = S(); s.camYaw -= e.movementX * .0024 * lookK; s.camPitch = clamp(s.camPitch + e.movementY * .0019 * lookK, .05, 1.2); };
    const onDown = e => { if (e.pointerType === 'touch' || e.button !== 0 || panel) return; if (document.pointerLockElement !== cv) { try { cv.requestPointerLock(); } catch (er) {} return; } if (bsel >= 0) place(); else mouseDown = true; };
    const onUp = () => { mouseDown = false; };
    const tS = e => { for (const t of e.changedTouches) if (t.clientX > innerWidth * .45 && !look) look = { id: t.identifier, x: t.clientX, y: t.clientY }; };
    const tM = e => { for (const t of e.changedTouches) if (look && t.identifier === look.id) { const s = S(); s.camYaw -= (t.clientX - look.x) * .006 * lookK; s.camPitch = clamp(s.camPitch + (t.clientY - look.y) * .005 * lookK, .05, 1.2); look.x = t.clientX; look.y = t.clientY; } };
    const tE = e => { for (const t of e.changedTouches) if (look && t.identifier === look.id) look = null; };
    cv.addEventListener('mousemove', onMove); document.addEventListener('mousemove', onMove); cv.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp);
    cv.addEventListener('touchstart', tS, { passive: true }); cv.addEventListener('touchmove', tM, { passive: true }); cv.addEventListener('touchend', tE); cv.addEventListener('touchcancel', tE);
    unbind = () => { cv.removeEventListener('mousemove', onMove); document.removeEventListener('mousemove', onMove); cv.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); cv.removeEventListener('touchstart', tS); cv.removeEventListener('touchmove', tM); cv.removeEventListener('touchend', tE); cv.removeEventListener('touchcancel', tE); try { document.exitPointerLock(); } catch (e) {} }; }
  let unbind = () => {};
  function showPrompt(t, p) { const pr = $('.prompt'), ring = $('.ring'); pr.style.display = t ? 'block' : 'none'; if (t && pr._t !== t) { pr.innerHTML = t; pr._t = t; } ring.style.display = p > 0 ? 'block' : 'none'; ring.style.setProperty('--p', Math.round(p * 100) + '%'); }
  let factT = 0; function fact(t) { if (!t) return; factT = 7; api.toast('🔭 ' + t, 6500); }

  /* ---------------- pitch demo script ---------------- */
  function demoStep(dt) { const v = st.vit, N = st.next; st.dmT += dt; if (v.hp < 30) v.hp = 30; if (v.o2 < 35) v.o2 = 35; if (v.pw < 35) v.pw = 35;   // the demo can't fail
    const hb = st.builds.find(b => b.id === 'hab');
    if (st.dm === 0 && hb) { st.dm = 1; st.dmT = 0; }
    if (st.dm === 1 && inside) { st.dm = 2; st.dmT = 0; }
    if (st.dm === 2 && !inside) { st.dm = 3; st.dmT = 0; N.flare = st.t + 25; }   // stepping outside triggers the flare
    if (st.dm === 1 && st.dmT > 45 && !inside) { st.dm = 3; st.dmT = 0; N.flare = st.t + 25; }   // presenter skipped the interior
    if (st.dm === 3 && st.stats.flares > 0) { st.dm = 4; st.dmT = 0; vo('earth', { once: true }); }
    if (st.dm === 4 && ((R.keys.z || touchZoom) && st.dmT > 2 || st.dmT > 30)) { st.dm = 5; st.dmT = 0; }
    if (st.dm === 5 && st.dmT > (R.keys.z || touchZoom ? 4 : 1)) { st.dm = 6; st.flags.reported = 1; st.rescue = { eta: st.t + 36 }; api.toast('📡 Mission Control: <b>supply ship launched</b>. ETA 36 seconds.', 4000); vo('report', { urgent: true }); } }
  function demoGuide() { if (st.mode !== 'demo') return null;
    if (st.dm === 4 || st.dm === 5) { const P = S().player.position; return { x: P.x + ED.x * 400, z: P.z + ED.z * 400, icon: '🌍', lb: 'Earth', t: `Turn toward Earth on the horizon and hold <b>${matchMedia('(pointer:coarse)').matches ? 'ZOOM' : 'Z'}</b> to zoom your visor` }; }
    if (st.dm === 1 && !inside) { const hb = st.builds.find(b => b.id === 'hab'); return { x: hb.x, z: hb.z, icon: '🏠', lb: 'habitat', t: 'Walk to the habitat and hold <b>E</b> to go inside' }; }
    if (st.dm === 2 && inside) return { t: 'This is NASA’s Habitat Demonstration Unit layout. Look around, then use the <b>airlock</b> to go back out.' };
    return null; }

  /* ---------------- the guide: always one clear next step ---------------- */
  // Picks what matters most right now (danger first, then the objective) and shows it as a marker in the world
  // plus one line of plain instructions under the objective.
  const GUIDE = { cur: null, t: 0 };
  const lack = c => Object.entries(c).filter(([k, n]) => (st.inv[k] || 0) < n);
  function nearCache(want) { const P = S().player.position; let best = null, bd = 1e9;
    caches.forEach(c => { const L = st.loot[c.i]; if (L.scrap + L.elec <= 0) return; if (want && !want.some(([k]) => L[k] > 0)) return; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; best = c; } }); return best; }
  function shelterSpot() { const P = S().player.position; let best = null, bd = 1e9; for (const b of st.builds) if (b.id === 'hab' || b.id === 'berm') { const d = Math.hypot(b.x - P.x, b.z - P.z); if (d < bd) { bd = d; best = b; } } return best; }
  function refillSpot() { const hb = st.builds.find(b => b.id === 'hab'); if (hb && (st.base.o2 > 10 || st.lander.o2 < 3)) return { x: hb.x, z: hb.z, n: 'the habitat' }; return { x: -12, z: -8, n: 'your lander' }; }
  function gatherStep(cost, what) { const L = lack(cost); if (!L.length) return null; const c = nearCache(L);
    const txt = L.map(([k, n]) => `${n - (st.inv[k] || 0)} ${D.RES[k].icon}`).join(' + ');
    return c ? { x: c.x, z: c.z, icon: '📦', t: `Get ${txt} for the ${what}: hold <b>E</b> at the supply cache`, lb: 'cache' } : { t: `Need ${txt} for the ${what}. Mission Control is sending a supply pod…` }; }
  function buildStep(id) { const d = D.BUILD.find(b => b.id === id); return { t: `Press <b>B</b> (BUILD), pick <b>${d.icon} ${d.n}</b>${id === 'solar' ? ' and put it where the ghost turns <b>green</b> (sunlight)' : id === 'antenna' ? ' and put it where the ghost turns <b>green</b> (Earth in view)' : ''}, then <b>E</b>`, build: 1 }; }
  function guideTarget() { const v = st.vit, g = D.GOALS[st.goal], c = count, P = S().player.position; const dg = !flare && demoGuide(); if (dg) return dg;
    if (inside) return { t: v.o2 < 90 || v.pw < 90 ? 'Refill your suit at the <b>EVA station</b>. The <b>airlock</b> takes you back outside.' : 'Eat at the galley, drink at the water dispenser, analyse samples at the geology glovebox. Airlock = outside.' };
    if (flare) { const sh = shelterSpot(); if (sh) return { x: sh.x, z: sh.z, icon: '☢', urg: 1, lb: sh.id === 'hab' ? 'shelter' : 'shield', t: `${flare.on ? 'Flare!' : 'Flare coming!'} Get ${sh.id === 'hab' ? 'inside the habitat' : 'right next to your regolith shield'}` };
      return { urg: 1, t: 'Flare! No shelter yet. Stay put and keep your health up. Build a habitat or a regolith shield before the next one.' }; }
    const rg = D.SUIT.patchRegolith || 2;
    if (v.leak) { if (st.inv.scrap >= 1 || st.inv.regolith >= rg) return { urg: 1, t: 'Suit leak! Press <b>P</b> (PATCH) now' }; const r = refillSpot(); return { x: r.x, z: r.z, icon: '🩹', urg: 1, lb: 'patch', t: `Suit leak! Look down and hold <b>E</b> to dig ${rg} regolith, then <b>P</b>. Or get to ${r.n}.` }; }
    if (v.o2 < 30 || v.pw < 25 || v.food < 18 || v.water < 18) { const r = refillSpot(); const w = v.o2 < 30 ? 'Oxygen' : v.pw < 25 ? 'Suit power' : v.food < 18 ? 'Food' : 'Water'; return { x: r.x, z: r.z, icon: '⛽', urg: 1, lb: 'refill', t: `${w} low: go to ${r.n} and hold <b>E</b>` }; }
    if (st.rescue && !st.rescued) { const pd = st.rescue.pad; return pd ? { x: pd[0], z: pd[1], icon: '🚀', lb: 'landing zone', t: 'The supply ship is coming. Watch it land, but not too close!' } : null; }
    if (!g) { const sm = samples[0]; return sm ? { x: sm.x, z: sm.z, icon: '🧪', lb: 'sample', t: 'Explore: collect the glowing blue science samples' } : { t: 'Keep the base running. Press Tab for your base report.' }; }
    const cost = id => D.BUILD.find(b => b.id === id).cost;
    if (g.id === 'salvage') { const c0 = nearCache(); return c0 ? { x: c0.x, z: c0.z, icon: '📦', lb: 'cache', t: `Walk to the blinking <b>supply cache</b> and hold <b>E</b> (${st.inv.scrap}/6 🔩 ${st.inv.elec}/3 💾)` } : null; }
    if (g.id === 'solar') { if (c('solar') && !built.some(B => B.b.id === 'solar' && B.lit)) return { t: 'Your solar tower is in <b>shadow</b>. Build another where the ghost turns green.', build: 1 }; return gatherStep(cost('solar'), 'solar tower') || buildStep('solar'); }
    if (g.id === 'hab') return gatherStep(cost('hab'), 'habitat') || buildStep('hab');
    if (g.id === 'ice') { if (st.flags.iceCut < 4) { if (inCrater(P.x, P.z)) return { t: `Look down and hold <b>E</b> to cut ice (${st.flags.iceCut}/4). It's dark: <b>F</b> = helmet lamp. Mind your suit power!` };
        const dx = D.CRATER.x - P.x, dz = D.CRATER.z - P.z, L = Math.hypot(dx, dz), k = (L - D.CRATER.r * .55) / L; return { x: P.x + dx * k, z: P.z + dz * k, icon: '🧊', lb: 'ice', t: `Go down into the dark crater for ice (${st.flags.iceCut}/4). It's very cold: fill your suit first.` }; }
      if (!c('ice')) return gatherStep(cost('ice'), 'ice processor') || buildStep('ice');
      return null; }
    if (g.id === 'berm') { if (!c('berm')) { const need = D.BUILD.find(b => b.id === 'berm').cost.regolith; if (st.inv.regolith < need) return { t: `Look down at the ground and hold <b>E</b> to dig regolith (${st.inv.regolith}/${need})` }; return buildStep('berm'); }
      const b = st.builds.find(x => x.id === 'berm'); return { x: b.x, z: b.z, icon: '⛰️', lb: 'shield', t: 'A flare is coming. Wait next to your shield and survive it.' }; }
    if (g.id === 'rover') { const gs = gatherStep(D.ROVER.cost, 'rover'); if (gs) return gs; return rover ? { x: rover.st.x, z: rover.st.z, icon: '🚙', lb: 'rover', t: 'Walk to the broken rover and hold <b>E</b> to repair it' } : null; }
    if (g.id === 'antenna') { const ant = st.builds.find(b => b.id === 'antenna'); if (!ant) return gatherStep(cost('antenna'), 'laser comms') || buildStep('antenna');
      if (!st.link) return { t: 'Earth is hidden from your antenna. Build another on higher ground where the ghost turns green.', build: 1 };
      return { x: ant.x, z: ant.z, icon: '📡', lb: 'comms', t: 'Hold <b>E</b> at the laser comms terminal to send your base report to Earth' }; }
    return null; }
  const gv = new V3();
  function guideStep(dt) { if ((GUIDE.t -= dt) <= 0) { GUIDE.t = .5; GUIDE.cur = guideTarget(); const bb = hud.querySelector('[data-b=build]'); if (bb) bb.classList.toggle('pulse', !!(GUIDE.cur && GUIDE.cur.build) && bsel < 0); }
    const G0 = GUIDE.cur, el = $('.gd'); if (!G0 || G0.x == null || panel || inside || bsel >= 0) { el.style.display = 'none'; return; }
    const P = S().player.position, d = Math.hypot(G0.x - P.x, G0.z - P.z); if (d < 4) { el.style.display = 'none'; return; }
    gv.set(G0.x, H(G0.x, G0.z) + 2, G0.z).project(R.cam); const W = innerWidth, Hh = innerHeight; let x = (gv.x * .5 + .5) * W, y = (-gv.y * .5 + .5) * Hh; const behind = gv.z > 1;
    const m = 46, top = 120, bot = Hh - 190; let off = behind || x < m || x > W - m || y < top || y > bot;
    if (behind) { // behind you: show it on the left or right edge, at eye height, pointing the way to turn
      const yaw = S().camYaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), tx = G0.x - P.x, tz = G0.z - P.z, side = fx * tz - fz * tx; x = side > 0 ? W - m : m; y = Hh * .45; } el.classList.toggle('edge', off); el.classList.toggle('urg', !!G0.urg);
    if (off) { const cx = W / 2, cy = Hh * .45; if (!behind) { x = clamp(x, m, W - m); y = clamp(y, top, bot); } el.querySelector('.ar').style.transform = `rotate(${Math.atan2(y - cy, x - cx)}rad)`; }
    el.style.display = 'block'; el.style.left = x + 'px'; el.style.top = y + 'px';
    const lbl = `${G0.lb || ''} ${Math.round(d)} m`; if (el._l !== lbl) { el._l = lbl; el.querySelector('.lb').textContent = lbl; } if (el._i !== G0.icon) { el._i = G0.icon; el.querySelector('.ic').textContent = G0.icon || '➜'; } }
  // safety net: if there is no longer enough scrap and electronics left on the Moon to finish (suit failures, a tower built in shadow…),
  // Mission Control drops a supply pod near the base. The game can never get stuck.
  function ensureSupplies() { const need = { scrap: 0, elec: 0 }, add = c => { for (const k in c) if (k in need) need[k] += c[k]; }, c = count, cost = id => D.BUILD.find(b => b.id === id).cost;
    if (!built.some(B => B.b.id === 'solar' && B.lit) && st.goal <= 1) add(cost('solar')); if (!c('hab')) add(cost('hab')); if (!c('ice')) add(cost('ice')); if (!st.flags.rover) add(D.ROVER.cost); if (!c('antenna') || (!st.link && c('antenna'))) add(cost('antenna'));
    const have = { scrap: st.inv.scrap, elec: st.inv.elec }; caches.forEach(cc => { const L = st.loot[cc.i]; have.scrap += L.scrap; have.elec += L.elec; });
    const def = { scrap: Math.max(0, need.scrap - have.scrap), elec: Math.max(0, need.elec - have.elec) }; if (!def.scrap && !def.elec) return;
    const hb = st.builds.find(b => b.id === 'hab'), bx = hb ? hb.x : -12, bz = hb ? hb.z : -8; let x = bx + 18, z = bz + 6;
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; x = bx + Math.cos(a) * 18; z = bz + Math.sin(a) * 18; if (!canPlace(x, z, 'battery')) break; }
    st.drops = st.drops || []; const i = D.CACHES + 2 + st.drops.length; st.drops.push({ x, z }); st.loot[i] = { scrap: def.scrap + 3, elec: def.elec + 2 };
    const m = cacheMesh(i, false); m.position.set(x, H(x, z), z); S().scn.add(m); caches.push({ i, x, z, m, big: false });
    api.toast('📦 Mission Control: <b>we dropped a supply pod</b> next to your base. Follow the marker.', 4500); vo('goal', { skipIfBusy: true }); save(); }

  /* ---------------- goals ---------------- */
  function goals() { const g = D.GOALS[st.goal]; if (!g) return; const c = count, f = st.flags; let done = false;
    if (g.id === 'salvage') done = (st.inv.scrap >= 6 && st.inv.elec >= 3) || st.builds.length > 0; else if (g.id === 'solar') done = built.some(B => B.b.id === 'solar' && B.lit);
    else if (g.id === 'hab') done = c('hab') > 0; else if (g.id === 'ice') done = c('ice') > 0 && f.iceCut >= 4; else if (g.id === 'berm') done = c('berm') > 0 && st.stats.sheltered > 0;
    else if (g.id === 'rover') done = !!f.rover; else if (g.id === 'antenna') done = !!f.reported;
    if (done) { st.goal++; api.sfx('up'); setTimeout(() => api.sfx('big'), 180); const n = D.GOALS[st.goal]; banner('OBJECTIVE COMPLETE', `+${Math.round(D.SCORE.perGoal * DF('score'))}`, n ? 'Next: ' + n.t : 'All objectives done!'); shake(.2); if (n) vo('goal', { skipIfBusy: true }); save(); goals(); } }

  /* ---------------- main step ---------------- */
  let lastInp = { x: 0, y: 0 };
  function pre(dt, inp) { if (!on || !menuDone) { inp.x = inp.y = 0; inp.jump = inp.jumpPress = false; return; } const s = S(); lastInp = { x: inp.x, y: inp.y, run: inp.run }; if (panel || inside) { inp.x = inp.y = 0; inp.jump = inp.jumpPress = false; }
    const held = !panel && !inside && (R.keys[' '] || R.thr || touchJet), down = !panel && (R.keys.c || R.keys.control); inp.jump = inp.jumpPress; inp.look = 0;
    s.traction = D.MOVE.traction; s.newton = true; TH.set(0, 0, 0); let lat = 0;
    if (st.jet > 0 && !s.drive && !panel) { const air = !s.onGround;
      if (held && !inp.jumpPress && (air || s.vel.y <= 0)) TH.y = D.JET.up; if (down && air) TH.y = -D.JET.up * .6;
      if (air && Math.hypot(inp.x, inp.y) > .1) { const y = s.camYaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y), l = Math.min(1, Math.hypot(inp.x, inp.y)), n = Math.hypot(inp.x, inp.y);
        TH.x = (rx * inp.x - fx * inp.y) / n * D.JET.side * l; TH.z = (rz * inp.x - fz * inp.y) / n * D.JET.side * l; lat = inp.x; } }
    const mag = TH.length(); s.thrust = mag > 0 ? TH : null; thrustK = mag / D.JET.up; latR += (lat - latR) * Math.min(1, dt * 4);
    if (mag > 0) st.jet = Math.max(0, st.jet - dt * 100 / fuelSec() * Math.min(1.4, thrustK)); }
  function step(dt) { if (!on || !menuDone || st.over) return; const s = S(), P = s.player.position, v = st.vit; dt = Math.min(dt, .1); st.t += dt; st.pts = (st.pts ?? st.t) + dt * (inside ? (D.SCORE.insideK ?? .25) : 1);
    if (earth) earth.position.copy(R.cam.position).addScaledVector(ED, D.EARTH.dist);
    { const tf = (R.keys.z || touchZoom) && !inside ? 16 : s._fov || 60; if (Math.abs(R.cam.fov - tf) > .05) { R.cam.fov += (tf - R.cam.fov) * Math.min(1, dt * 8); R.cam.updateProjectionMatrix(); } }   // visor zoom: Earth is only 2° wide, like a thumbnail at arm's length
    if ((fcT -= dt) <= 0) { fcT = 6; forecast(); }
    st.sunA = (st.sunA + dt * TAU / (D.SUN.circleMin * 60)) % TAU; sunDir(); s.polar = { sd };
    sunT -= dt; if (sunT <= 0) { sunT = .25; sunlit = inSun(P.x, P.y + 1.5, P.z); }
    const crat = inCrater(P.x, P.z), envT = crat ? D.TEMP.crater : sunlit ? D.TEMP.sun : D.TEMP.shadow, driving = !!s.drive;
    // lamp
    const f = forward(); if (s.helmet) lamp.position.copy(R.cam.position); else lamp.position.set(P.x, P.y + 1.7, P.z); lamp.target.position.copy(lamp.position).addScaledVector(f, 10); lamp.intensity += ((st.lamp ? 90 : 0) - lamp.intensity) * Math.min(1, dt * 8);
    // suit
    const run = (R.keys.shift || R.bst) && Math.hypot(s.vel.x, s.vel.z) > 3, sheltered = inside || built.some(B => (B.b.id === 'berm' && Math.hypot(B.b.x - P.x, B.b.z - P.z) < B.def.shelter) || (B.b.id === 'hab' && Math.hypot(B.b.x - P.x, B.b.z - P.z) < 4));
    if (!inside) { v.o2 -= dt * 100 / (o2Min() * 60) * (run ? D.SUIT.runO2X : 1) + (v.leak ? D.SUIT.leakPerSec * DF('leak') * dt : 0); v.pw -= dt * 100 / (pwMin() * 60) * (crat ? D.SUIT.craterX : sunlit ? 1 : D.SUIT.heaterX) * (driving ? .5 : 1) + (st.lamp ? D.SUIT.lampDrain * dt * 100 / (pwMin() * 60) : 0); }
    else { v.tc += (22 - v.tc) * Math.min(1, dt); }
    v.o2 = clamp(v.o2, 0, 100); v.pw = clamp(v.pw, 0, 100);
    if (!inside) { if (v.pw > 0) v.tc += (22 - v.tc) * Math.min(1, dt * .5); else v.tc += (envT * .2 - v.tc) * dt * .025; }
    // health
    v.food = clamp(v.food - dt * 100 / (D.FOOD.foodMin * DF('food') * 60), 0, 100); v.water = clamp(v.water - dt * 100 / (D.FOOD.waterMin * DF('food') * 60), 0, 100);
    let dmg = 0, why = ''; if (v.food <= 0 || v.water <= 0) { dmg += D.FOOD.starve; why = v.water <= 0 ? 'You ran out of water.' : 'You ran out of food.'; }
    if (v.o2 <= 0) { dmg += D.HEALTH.suffocate; why = why || 'You ran out of oxygen.'; } if (v.tc < 5 || v.tc > 42) { dmg += D.HEALTH.cold; why = why || (v.tc < 5 ? 'Your suit froze: the battery ran flat in the cold.' : 'Your suit overheated.'); }
    if (flare && flare.on && !sheltered) { dmg += D.HEALTH.flare * DF('flareDmg'); v.dose += dt * 4; why = why || 'Radiation from the solar flare.'; }
    v.dose += dt * D.DANGER.backgroundDose / 86400 * 60;   // shown in mSv; background dose sped up 60×
    // falls: Moon gravity is 1/6 of Earth's, so you fall slowly, but a long drop still hurts
    if (!s.onGround) lastVy = s.vel.y; if (s.onGround && !wasG && !driving) { const imp = -lastVy; s.camDip = Math.min(.45, Math.max(0, imp) * .07); if (imp > 1.5) try { AUD.step(Math.min(2, imp / 3)); } catch (e) {} if (imp > D.SUIT.fallSafe) { v.hp -= (imp - D.SUIT.fallSafe) * D.SUIT.fallDamage; api.toast(`🦴 Hard landing (${imp.toFixed(1)} m/s)`, 1500); hurt(.8); shake(Math.min(1.4, .4 + (imp - D.SUIT.fallSafe) * .2)); api.sfx('hurt'); setTimeout(() => hurt(0), 300); if (v.hp <= 0) why = 'A fall broke your suit seal.'; } } wasG = s.onGround;
    v.hp -= dmg * dt; if (!dmg && v.o2 > 15 && v.pw > 0) v.hp += (inside ? D.HEALTH.regenInside : D.HEALTH.regen) * dt; v.hp = clamp(v.hp, 0, 100); hurt(dmg ? .35 + .25 * Math.sin(st.t * 6) : 0);
    if (v.hp <= 0) { if (st.mode === 'daily') { gameOver(why || 'Your suit failed.'); return; } die(why || 'Your suit failed.'); return; }
    s.camDip = (s.camDip || 0) * Math.exp(-dt * 5); s.camRoll = -latR * .05;
    if (s.onGround && !driving && !inside) { const sp = Math.hypot(s.vel.x, s.vel.z); st._fd = (st._fd || 0) + sp * dt; if (st._fd > 1.15 && sp > .6) { st._fd = 0; try { AUD.step(Math.min(1.2, .5 + sp / 6)); } catch (e) {} } }   // footsteps, felt not heard
    { const jet = s.player.userData.jet; if (jet) jet.scale.setScalar(thrustK > 0 ? 1 + thrustK * .6 + Math.random() * .4 : .01);
      if (thrustK > 0 && s.fx && jet && Math.random() < dt * 30) { const jp = jet.getWorldPosition(new V3()); s.fx.emit(jp, new V3(-TH.x * 2 + s.vel.x, -6 * Math.max(.3, TH.y / D.JET.up) + s.vel.y, -TH.z * 2 + s.vel.z), 0x9fe6ff, .35, .3, 3, 1.2, { grow: 2 });
        const gy = H(P.x, P.z); if (P.y - gy < 4 && TH.y > 0) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, sp = 1.5 + Math.random() * 2.5, up = .6 + Math.random() * 1.2; s.dust.emit(new V3(P.x, gy + .05, P.z), new V3(Math.cos(a) * sp, up, Math.sin(a) * sp), s.dc, .12, 2 * up / 1.62, 1, .1, { grow: 1, drag: 0, grav: 1.62, a: .8 }); } } }   // airless: dust flies in clean arcs, no billowing
    // dust kicked up by your thrusters or the rover settles on nearby panels
    if (thrustK > 0 || (driving && Math.hypot(s.vel.x, s.vel.z) > 1)) built.forEach(B => { if (B.b.id === 'solar' && Math.hypot(B.b.x - P.x, B.b.z - P.z) < 15) B.b.dust = Math.min(100, (B.b.dust || 0) + D.DUST.nearThrust * dt); });
    if (st.mode === 'demo') demoStep(dt); rescueStep(dt); guideStep(dt); if ((st._sup = (st._sup || 0) - dt) <= 0) { st._sup = 10; ensureSupplies(); }
    if (!inside) { walked += Math.hypot(s.vel.x, s.vel.z) * dt; if (walked > 12) vo('move', { once: true }); if (thrustK > 0 && !s.onGround) vo('jet', { once: true });
      if (!sunlit && !crat && st.t > 20) vo('shadow', { once: true, skipIfBusy: true }); if (crat) vo('crater', { once: true }); if ((R.keys.z || touchZoom)) vo('earth', { once: true });
      if (built.some(B => B.b.id === 'solar' && B.b.dust > 30)) vo('dust', { once: true, skipIfBusy: true }); }
    if (!panel && !VOX.busy && !flare) { idleT -= dt; if (idleT <= 0) { idleT = rnd(140, 220); vo('idle'); } }
    // dangers: solar flares and micrometeorites
    const N = st.next, warn = st.link ? D.DANGER.flareWarnWithAntennaSec : D.DANGER.flareWarnSec;
    if (!flare && st.t > N.flare - warn) { flare = { at: N.flare, on: false }; vo('flareWarn', { urgent: true }); }
    if (flare) { const left = flare.at - st.t; if (left > 0) alarm(`☢ SOLAR FLARE in ${Math.ceil(left)} s — get inside the habitat or behind a regolith shield`); else if (left > -flareLen()) { if (!flare.on) { flare.on = true; flare.hit = false; flare.out = 0; shake(.5); api.sfx('alarm'); } if (!sheltered) { flare.out += dt; if (flare.out > (D.DANGER.flareGraceSec ?? 15)) flare.hit = true; } alarm(`☢ SOLAR FLARE · ${Math.ceil(flareLen() + left)} s · ${sheltered ? 'you are sheltered ✓' : flare.hit ? 'TAKE SHELTER!' : `TAKE SHELTER! (${Math.max(0, Math.ceil((D.DANGER.flareGraceSec ?? 15) - flare.out))} s)`}`); $('.tint').style.opacity = .8; }
      else { const fh = flare.hit; st.stats.flares++; if (!flare.hit) st.stats.sheltered++; flare = null; N.flare = st.t + (TW('flares') ? rnd(3, 5) : rnd(...D.DANGER.flareEveryMin) * DF('flare')) * 60; alarm(''); $('.tint').style.opacity = 0; api.toast('☢ The flare is over.', 2000); vo(fh ? 'flareHit' : 'flareSafe'); } }
    if (D.GOALS[st.goal] && D.GOALS[st.goal].id === 'berm' && count('berm') && !flare && N.flare > st.t + (D.DANGER.shieldFlareSec || 150) + warn) { N.flare = st.t + (D.DANGER.shieldFlareSec || 150) + warn * .5; api.toast('📡 Mission Control: <b>a solar flare is building up</b> on the Sun. Your shield is about to get its first test.', 4500); }
    if (st.t > N.meteor && (flare || Math.abs(N.flare - st.t) < (D.DANGER.calmSec || 0))) N.meteor = st.t + (D.DANGER.calmSec || 60);
    if (st.t > N.meteor) { N.meteor = st.t + rnd(...D.DANGER.meteorEveryMin) * 60; if (Math.random() < Math.min(.8, D.DANGER.meteorChance * DF('meteor')) && !inside && !driving) { v.leak = 1; hurt(1); setTimeout(() => hurt(0), 250); shake(1.1); api.sfx('hit'); setTimeout(() => api.sfx('hurt'), 120); vo('leak', { urgent: true }); api.toast('💥 A micrometeorite punctured your suit! Oxygen is leaking. Press <b>P</b> to patch it (1 🔩 scrap, or 2 🪨 regolith) or refill at the lander or habitat.', 4500); } }
    // base: power grid, oxygen from ice
    tSec -= dt; if (tSec <= 0) { tSec = 1; let prod = 0, useP = 0, cap = 0;
      built.forEach(B => { const id = B.b.id; if (id === 'solar') { B.lit = inSun(B.b.x, H(B.b.x, B.b.z) + 5.5, B.b.z); B.b.dust = Math.min(100, (B.b.dust || 0) + D.DUST.perMin / 60 * (U('lotus') ? .4 : 1) * (TW('dusty') ? 3 : 1)); if (B.lit) prod += B.def.power * (1 - D.DUST.loss * B.b.dust / 100); if (B.m.userData.pm) B.m.userData.pm.color.setHex(0x1b2a55).lerp(new THREE.Color(0x6f6b66), B.b.dust / 100 * .85); } if (id === 'battery') cap += B.def.store; if (B.def.use && id !== 'ice') useP += B.def.use; if (id === 'hab') cap += 40; });
      const ant = built.find(B => B.b.id === 'antenna'); st.link = !!(ant && seesEarth(ant.b.x, H(ant.b.x, ant.b.z) + 3.2, ant.b.z)); if (ant && !st.link) useP -= ant.def.use;
      const ice = built.find(B => B.b.id === 'ice'), o2cap = count('hab') ? D.BUILD.find(b => b.id === 'hab').o2 : 100;
      if (ice && st.base.iceQ > 0 && st.base.o2 < o2cap) useP += ice.def.use;
      st.base.pw = clamp(st.base.pw + prod - useP, 0, cap); const powered = st.base.pw > 0 || prod >= useP; st.stats.total++; if (built.length && powered) st.stats.powered++;
      if (ice && powered && st.base.iceQ > 0 && st.base.o2 < o2cap) { ice.prog = (ice.prog || 0) + 1; if (ice.prog >= 8) { ice.prog = 0; st.base.iceQ--; st.base.o2 = Math.min(o2cap, st.base.o2 + ice.def.perIce); st.base.water = Math.min(200, st.base.water + D.FOOD.waterPerIce); st.stats.o2made += ice.def.perIce; } }
      // the atrium's plants grow a meal now and then, if the base has power and water
      if (count('hab') && powered && st.base.water >= D.FOOD.growWater && st.base.meals < D.FOOD.mealsMax) { st.base.grow++; if (st.base.grow >= D.FOOD.growSec) { st.base.grow = 0; st.base.meals++; st.base.water -= D.FOOD.growWater; } }
      built.forEach(B => { if (B.m.userData.light) B.m.userData.light.visible = powered; });
      if (inside) st.stats.inside++; goals(); }
    built.forEach(B => { if (B.m.userData.pivot) B.m.userData.pivot.rotation.y = Math.atan2(sd.x, sd.z); });
    caches.forEach(c => { if (c.m.userData.beacon.visible) c.m.userData.beacon.scale.setScalar(Math.sin(st.t * 4 + c.i) > .6 ? 1.6 : .6); });
    // use / gather / build
    if (inside && IN && IN.g.visible) stepInside(dt, panel ? { x: 0, y: 0 } : lastInp);   // keep the camera inside even while a panel is open
    else if (panel) { showPrompt('', 0); } else if (bsel >= 0) { stepGhost(); if (R.keys.e || touchUse) { R.keys.e = 0; touchUse = false; place(); } }
    else if (!driving) { const tg = findTarget(), holding = R.keys.e || mouseDown || touchUse;
      if (tg && use.target && tg.kind === use.target.kind && tg.c === use.target.c) tg.t = use.target.t; if (!tg || !use.target || tg.kind !== use.target.kind || tg.c !== use.target.c) use.t = 0; use.target = tg;
      if (tg) { const can = tg.ok !== false && tg.t > 0; if (holding && can) { use.t += dt; if (use.t >= tg.t) { use.t = 0; act(tg); if (tg.kind === 'hab' || tg.kind === 'rover' || tg.kind === 'antenna') { R.keys.e = 0; mouseDown = touchUse = false; } } } else use.t = 0;
        showPrompt(`${can ? '<b>Hold E</b> ' : ''}${tg.label}`, can ? use.t / tg.t : 0); } else showPrompt('', 0); }
    else showPrompt('', 0);
    collide(); hudUpdate(envT); feel(dt); tSave -= dt; if (tSave <= 0) { tSave = 20; save(); }
    if (v.o2 < 20 && !st.w1) { st.w1 = 1; vo('o2low', { urgent: true }); } if (v.o2 > 30) st.w1 = 0;
    if (v.pw < 15 && !st.w2) { st.w2 = 1; vo('pwlow'); } if (v.food < 20 && !st.w3) { st.w3 = 1; vo('hungry'); } if (v.food > 35) st.w3 = 0; if (v.water < 20 && !st.w4) { st.w4 = 1; vo('thirsty'); } if (v.water > 35) st.w4 = 0; if (v.tc < 8 && !st.w5) { st.w5 = 1; vo('cold'); } if (v.tc > 14) st.w5 = 0; if (v.pw > 25) st.w2 = 0; }

  /* ---------------- Earth on the horizon ---------------- */
  function makeEarth() { const tl = new THREE.TextureLoader(), m = new THREE.MeshStandardMaterial({ roughness: .9, metalness: 0, emissive: 0x0a1426, emissiveIntensity: .35 });
    tl.load('models/tex/earth.webp', t => { t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.needsUpdate = true; }); tl.load('models/tex/earth_night.webp', t => { t.colorSpace = THREE.SRGBColorSpace; m.emissiveMap = t; m.emissive.set(0x6a7a96); m.needsUpdate = true; });
    // Earth seen from the Moon is about 2° across (four times the full Moon seen from Earth)
    const e = new THREE.Mesh(new THREE.SphereGeometry(D.EARTH.dist * Math.tan(Math.PI / 180), 48, 32), m); e.rotation.z = .41; e.renderOrder = -1; S().scn.add(e); return e; }
  /* ---------------- the habitat interior (modelled on NASA's Habitat Demonstration Unit), walkable in first person ---------------- */
  const IY = 2600;   // the interior is built high above the site, out of sight; you are "in" it while the airlock is closed
  function buildInterior() { const h = buildHab({ nasa: (n, w, g) => nasa(n, w, g) }); h.g.visible = false; S().scn.add(h.g); return { g: h.g, st: h.stations, scr: h.screens, R0: HAB_R, pos: new V3(), t: 0, hab: null }; }
  function paint(key, title, lines, col = '#55d6e8') { const S0 = IN.scr[key]; if (!S0) return; const c = S0.c.getContext('2d'), W = S0.c.width, Hh = S0.c.height, fs = Math.max(14, Math.round(Hh / (lines.length + 2.2)));
    c.fillStyle = '#071018'; c.fillRect(0, 0, W, Hh); c.fillStyle = col; c.font = `bold ${fs + 2}px system-ui`; c.fillText(title, 16, fs + 8);
    c.font = `${fs}px system-ui`; lines.forEach((l, i) => { c.fillStyle = /☢|⚠/.test(l) ? '#ff6a5a' : '#e8f1f5'; c.fillText(l, 16, fs * 2 + 16 + i * (fs + 6)); }); S0.t.needsUpdate = true; }
  function screens() { const b = st.base, v = st.vit;
    paint('tele', 'BASE STATUS · ' + D.STORY.callsign, [`Power stored  ${Math.round(b.pw)}`, `Oxygen tank   ${Math.round(b.o2)}%`, `Water  ${Math.round(b.water)}   Meals  ${b.meals}`, `Ice waiting   ${b.iceQ}`, `Earth link    ${st.link ? 'ONLINE' : 'no line of sight'}`, fc || '', flare ? (flare.on ? '☢ SOLAR FLARE IN PROGRESS' : '☢ Flare warning') : '']);
    paint('tele2', 'SCORE', [score().toLocaleString(), `${Math.floor(st.t / 60)} min`], '#F4A259');
    paint('geo', 'GEO LAB', [`Samples to analyse: ${st.carry.length}`, `Research points: ${st.rp}`], '#F4A259');
    paint('med', 'CREW HEALTH', [`Heart ${Math.round(70 + Math.sin(st.t * 3) * 4)} bpm`, `Health ${Math.round(v.hp)}%`, `Dose ${v.dose.toFixed(1)} mSv`], '#ff8a7a');
    paint('farm', 'ATRIUM', [`Crops: ${b.meals} meals · growing ${Math.round(b.grow / D.FOOD.growSec * 100)}%`], '#9cff8a'); }
  function enterHab(hb) { if (!IN) IN = buildInterior(); IN.hab = hb; IN.g.position.set(hb.x, IY, hb.z); IN.g.visible = true; inside = true; endBuild();
    IN.pos.set(HAB_R - 1.1, 0, 0); S().camYaw = Math.PI / 2; S().camPitch = .38; $('.tint').style.background = '#000'; $('.tint').style.opacity = 1; setTimeout(() => { $('.tint').style.opacity = 0; $('.tint').style.background = ''; }, 500);
    if (!vo('hab', { once: true })) vo('habAgain', { cool: 120, skipIfBusy: true }); api.sfx('whoosh'); api.toast('🏠 Airlock cycled. Dust brushed off. You are inside: warm, pressurised and shielded.', 2600); screens(); }
  function exitHab() { if (!IN) return; inside = false; IN.g.visible = false; const hb = IN.hab, P = S().player.position, x = hb.x + 4.6, z = hb.z; P.set(x, H(x, z), z); S().vel.set(0, 0, 0); S().camYaw = -Math.PI / 2; api.sfx('whoosh'); api.toast('Outside. Mind your oxygen.', 1600); }
  function stepInside(dt, inp) { const I = IN, s = S(); I.t += dt; const y = s.camYaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y), sp = (inp.run ? 2.2 : 1.4);
    I.pos.x += (rx * inp.x - fx * inp.y) * sp * dt; I.pos.z += (rz * inp.x - fz * inp.y) * sp * dt;
    const r = Math.hypot(I.pos.x, I.pos.z); if (r > I.R0 - .95) I.pos.multiplyScalar((I.R0 - .95) / r); if (r < .45) I.pos.multiplyScalar(.45 / Math.max(.01, r));   // furniture along the wall, ladder in the middle
    const walk = Math.hypot(inp.x, inp.y) > .1, bob = walk ? Math.sin(I.t * 7) * .02 : 0, hp = new V3(I.g.position.x + I.pos.x, IY + 1.6 + bob, I.g.position.z + I.pos.z), lp = -(s.camPitch - .35) * 1.4;
    R.cam.position.copy(hp); R.cam.lookAt(hp.x - Math.sin(y) * Math.cos(lp) * 10, hp.y + Math.sin(lp) * 10, hp.z - Math.cos(y) * Math.cos(lp) * 10);
    s.dl.intensity = 0; s.hemi.intensity = .1; s.scn.environmentIntensity = .12; lamp.intensity = 0;
    if (panel) { use.t = 0; showPrompt('', 0); return; }
    let best = null, bd = 9; const f = new V3(); R.cam.getWorldDirection(f); for (const t of I.st) { const dx = t.x - I.pos.x, dz = t.z - I.pos.z, d = Math.hypot(dx, dz), dot = (dx * f.x + dz * f.z) / Math.max(.01, d); if (d < 1.6 && dot > .45 && d < bd) { bd = d; best = t; } }
    const holding = R.keys.e || mouseDown || touchUse, need = best ? (best.id === 'med' ? 2 : .5) : 1;
    if (best) { if (holding) { use.t += dt; if (use.t >= need) { use.t = 0; R.keys.e = 0; mouseDown = touchUse = false; station(best.id); } } else use.t = 0; showPrompt(`<b>Hold E</b> ${best.label}`, use.t / need); } else { use.t = 0; showPrompt('', 0); }
    if ((I.sT = (I.sT || 0) - dt) <= 0) { I.sT = 1; screens(); } }
  function station(id) { const v = st.vit, b = st.base;
    if (id === 'airlock') exitHab();
    else if (id === 'eva') { if (v.leak) { v.leak = 0; api.toast('🩹 Suit patched at the EVA workstation.', 1800); }
      const need = 100 - v.o2, got = Math.min(need, b.o2); v.o2 += got; b.o2 -= got; const pn = 100 - v.pw, pg = Math.min(pn, b.pw); v.pw += pg; b.pw -= pg; if (b.pw > 5 || st.lander.pw > 0) st.jet = 100; v.tc = 22; api.sfx('coin');
      api.toast(got < need - .5 ? `⚠ Base oxygen ran short (suit ${Math.round(v.o2)}%). Make more from ice.` : '✅ Suit refilled: oxygen, power and jetpack fuel.', 2600); }
    else if (id === 'med') { const mins = 5; st.t += mins * 60; st.sunA = (st.sunA + TAU * mins / D.SUN.circleMin) % TAU; v.hp = Math.min(100, v.hp + 35); vo('rest'); v.food = Math.max(0, v.food - 8); v.water = Math.max(0, v.water - 10); api.toast(`😴 You rested ${mins} minutes. Health +35. The Sun moved ${Math.round(360 * mins / D.SUN.circleMin)}° around the sky.`, 3000); }
    else if (id === 'hyg') { v.hp = Math.min(100, v.hp + 5); api.toast('🚿 Clean. Lunar dust is sharp and clingy: Apollo crews said it smelled like spent gunpowder.', 3200); }
    else if (id === 'galley') { if (b.meals > 0 && v.food < 95) { b.meals--; v.food = Math.min(100, v.food + D.FOOD.meal); vo('eat', { cool: 90, skipIfBusy: true }); api.toast(`🍲 You ate a meal from the atrium. ${b.meals} left.`, 2200); }
      else api.toast(b.meals ? 'You are not hungry.' : `🌱 No meals ready. Plants need power and water (${Math.round(b.water)} water stored). Bring ice to the processor.`, 3000); }
    else if (id === 'stow') { if (b.water >= 10 && v.water < 95) { b.water -= 10; v.water = Math.min(100, v.water + D.FOOD.drink); vo('drink', { cool: 90, skipIfBusy: true }); api.toast('💧 You drank recycled water.', 1800); } else api.toast(b.water < 10 ? 'The water tank is empty. Melt ice in the processor.' : 'You are not thirsty.', 2400); }
    else if (id === 'geo') geoPanel();
    else if (id === 'tele') telePanel(); }
  function geoPanel() { const got = st.carry.map(id => D.SAMPLES.find(x => x.id === id)).filter(Boolean); let gain = 0; got.forEach(o => { gain += o.rp; st.done.push(o.id); }); st.rp += gain; st.carry = []; if (gain) vo('geo', { skipIfBusy: true });
    const facts = got.map(o => `<p><b>🧪 ${o.n}</b> · +${o.rp} research<br><span style="opacity:.85">${o.fact}</span></p>`).join('');
    const ups = D.UPGRADES.map(u => `<button class="${st.upg[u.id] ? 'sec' : ''}" data-u="${u.id}" ${st.upg[u.id] || st.rp < u.cost ? 'disabled' : ''}>${st.upg[u.id] ? '✓ ' : ''}${u.n} · ${u.cost} 🔬</button>`).join('');
    show(`<h2>🔬 Geology lab glovebox</h2>${facts || '<p>No new samples. Look for glowing blue markers around the site: the crater floor, the rim and the plains.</p>'}
      <p><b>Research points: ${st.rp}</b> · samples analysed ${st.done.length} / ${D.SAMPLES.length}</p><p style="font-size:12px;opacity:.8">${D.UPGRADES.map(u => `<b>${u.n}</b>: ${u.desc}`).join('<br>')}</p><div class="row">${ups}<button class="sec" id="gX">Close</button></div>`,
      p => { p.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const u = D.UPGRADES.find(x => x.id === b.dataset.u); if (st.rp >= u.cost && !st.upg[u.id]) { st.rp -= u.cost; st.upg[u.id] = 1; api.sfx('coin'); vo('upgrade'); save(); geoPanel(); } }); p.querySelector('#gX').onclick = () => close(); });
    if (gain) save(); }
  function telePanel() { show(`<h2>🖥 Tele-robotics workstation</h2><p>Score <b>${score().toLocaleString()}</b> · survived ${Math.floor(st.t / 60)} min · ${st.goal} objectives · ${st.done.length} samples analysed</p>
      <div class="row"><button id="tR">Base Design Report</button><button id="tB">Leaderboard</button><button class="sec" id="tX">Close</button></div>`,
      p => { p.querySelector('#tR').onclick = () => report(); p.querySelector('#tB').onclick = () => board(st.mode === 'daily'); p.querySelector('#tX').onclick = () => close(); }); }
  // when will the Sun leave (or reach) your solar towers? look ahead around the sky
  function forecast() { const towers = built.filter(B => B.b.id === 'solar'); if (!towers.length) { fc = ''; return; } const a0 = st.sunA, now = towers.some(B => B.lit); let mins = null;
    for (let k = 1; k <= 72; k++) { st.sunA = a0 + k * TAU / 72; sunDir(); const lit = towers.some(B => inSun(B.b.x, H(B.b.x, B.b.z) + 5.5, B.b.z)); if (lit !== now) { mins = k * D.SUN.circleMin / 72; break; } }
    st.sunA = a0; sunDir(); fc = mins == null ? (now ? 'Solar towers: sunlit all the way round ✓' : 'Solar towers: in shadow all the way round ✗') : now ? `Solar towers go dark in ~${Math.round(mins)} min` : `Sunlight returns to your towers in ~${Math.round(mins)} min`; }

  /* ---------------- rescue: the supply ship lands after your report reaches Earth ---------------- */
  function rescueStep(dt) { const R0 = st.rescue; if (!R0 || st.rescued) { if ($('.rescue')) $('.rescue').style.display = 'none'; return; } const left = R0.eta - st.t, el = $('.rescue'); el.style.display = 'block';
    const pad = R0.pad || (R0.pad = (() => { const hb = st.builds.find(b => b.id === 'hab'), bx = hb ? hb.x : 0, bz = hb ? hb.z : 0; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, x = bx + Math.cos(a) * 26, z = bz + Math.sin(a) * 26; if (!canPlace(x, z, 'hab')) return [x, z]; } return [bx + 26, bz]; })());
    el.textContent = left > 0 ? `🚀 Supply ship ETA ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} · it will land ${Math.round(Math.hypot(pad[0] - S().player.position.x, pad[1] - S().player.position.z))} m from you` : '🚀 Supply ship landing!';
    const T = 32; if (left < T && !ship) { ship = new THREE.Group(); nasa('lm', 9, ship); S().scn.add(ship); vo('approach', { urgent: true }); }
    if (ship) { const k = clamp(1 - left / T, 0, 1), gy = H(pad[0], pad[1]), y = gy + 260 * Math.pow(1 - k, 2.2); ship.position.set(pad[0], y, pad[1]);
      const s = S(); if (k < 1 && Math.random() < dt * 40) { s.fx.emit(new V3(pad[0], y - .2, pad[1]), new V3((Math.random() - .5) * 2, -14, (Math.random() - .5) * 2), 0xffd9a0, 1.2, .5, 4, 2, { grow: 2.5 });
        if (y - gy < 30) for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, sp = 6 + Math.random() * 8, up = .5 + Math.random() * 1.5; s.dust.emit(new V3(pad[0], gy + .1, pad[1]), new V3(Math.cos(a) * sp, up, Math.sin(a) * sp), s.dc, .2, 2 * up / 1.62 + .5, 1, .3, { grow: 1, drag: 0, grav: 1.62, a: .8 }); } }   // the plume blasts dust out in flat, fast arcs
      shipK = k < 1 ? .9 : 0;
      if (k >= 1) { st.rescued = 1; shipK = 0; api.sfx('lnd'); vo('landed', { urgent: true }); finish(true); } } }
  let shipK = 0;
  function bests() { try { return JSON.parse(localStorage.getItem(KEY + '-best') || '{}'); } catch (e) { return {}; } }
  function keepBest(sc) { const b = bests(); if (st.mode === 'daily') { b.daily = b.daily || {}; b.daily[st.day] = Math.max(b.daily[st.day] || 0, sc); } else b.best = Math.max(b.best || 0, sc); try { localStorage.setItem(KEY + '-best', JSON.stringify(b)); } catch (e) {} return b; }
  async function submit(sc) { const N = window.NET; if (!N || !N.on || !N.rpc) return 'Saved on this device (online scores are off).';
    try { await N.boot(); const r = await N.rpc('submit_survival', { p_daily: st.mode === 'daily', p_score: sc, p_seconds: Math.min(86400, Math.floor(st.t)), p_objectives: Math.min(7, st.goal), p_samples: Math.min(12, st.done.length) });
      return `🏆 You are #${r.rank} of ${r.players}${r.new_best ? ' · new personal best!' : ''}`; }
    catch (e) { return /does not exist|function/i.test(e.message || '') ? 'Saved on this device. (The online Moon Survival board is not switched on yet.)' : 'Saved on this device. Online: ' + (e.message || 'not sent'); } }
  async function board(daily) { const N = window.NET; let rows = null, note = '';
    if (N && N.on && N.rpc) { try { await N.boot(); rows = await N.rpc('get_survival_board', { p_daily: !!daily, p_limit: 20 }); } catch (e) { note = 'The online Moon Survival board is not switched on yet. Your best scores on this device:'; } } else note = 'Online scores are off. Your best scores on this device:';
    const b = bests(), list = rows && rows.length ? rows.map(r => `<div class="sc"><span>#${r.rank}</span><div>${(N.esc || String)(r.name)}${r.is_me ? ' (you)' : ''}</div><b>${Number(r.score).toLocaleString()}</b></div>`).join('')
      : `<p>Best ever: <b>${(b.best || 0).toLocaleString()}</b><br>Best today (daily): <b>${((b.daily || {})[today()] || 0).toLocaleString()}</b></p>`;
    show(`<h2>🏆 Moon Survival · ${daily ? 'today’s daily challenge' : 'all time'}</h2>${note ? `<p style="font-size:13px;opacity:.8">${note}</p>` : ''}${list}<div class="row"><button id="lbO">${daily ? 'All-time board' : 'Today’s daily board'}</button><button class="sec" id="lbX">Close</button></div>`,
      p => { p.querySelector('#lbO').onclick = () => board(!daily); p.querySelector('#lbX').onclick = () => close(); }); }
  async function finish(rescued) { if (st.mode === 'demo') { show(`<h2>🚀 Pitch demo complete</h2><p>That was a 3-minute taste of Moon Survival: build at the lunar south pole, shelter from a solar flare, find Earth on the horizon, and get rescued. A full mission takes 25 to 35 minutes.</p><div class="row"><button id="fK" class="sec">Keep exploring</button><button id="fT">Back to the title</button></div>`, p => { p.querySelector('#fK').onclick = () => close(); p.querySelector('#fT').onclick = () => api.exit(); }); return; }
    const sc = score(); if (st.mode === 'daily') st.over = 1; keepBest(sc); save();   // a daily ends at the rescue (or the first suit failure)
    show(`<h2>${rescued ? '🚀 Rescued! Mission complete' : '☠ Mission over'}</h2><p>${rescued ? 'The supply ship touched down beside your base. Fresh oxygen, food and a crew to take over. You built the first base at the lunar south pole.' : ''}</p>
      <p style="font-size:26px;margin:6px 0"><b>${sc.toLocaleString()}</b> points</p><p style="font-size:12px;opacity:.75">${Math.floor(tPts())} for time out on the surface + ${st.goal} objectives × ${D.SCORE.perGoal} + ${st.done.length} samples × ${D.SCORE.perSample}${DF('score') !== 1 ? ` · × ${DF('score')} (${D.DIFF[st.diff].n})` : ''}</p><p style="font-size:13px;opacity:.85">${Math.floor(st.t / 60)} min survived · ${st.goal} objectives · ${st.done.length} samples analysed${st.mode === 'daily' ? ' · daily: ' + twistOf(st.day).n : ''}</p>
      <p id="svRank" style="font-size:13px">Sending your score…</p><div class="row"><button id="fB">Leaderboard</button><button id="fR">Base report</button>${rescued && st.mode !== 'daily' ? '<button class="sec" id="fK">Keep playing</button>' : ''}<button class="sec" id="fT">Back to the title</button></div>`,
      p => { p.querySelector('#fB').onclick = () => board(st.mode === 'daily'); p.querySelector('#fR').onclick = () => report(); if (rescued && st.mode !== 'daily') p.querySelector('#fK').onclick = () => close(); p.querySelector('#fT').onclick = () => api.exit(); });
    const msg = await submit(sc); const el = hud && hud.querySelector('#svRank'); if (el) el.textContent = msg; }
  function gameOver(why) { st.over = 1; vo('dead', { urgent: true }); finish(false).then(() => { const el = hud && hud.querySelector('#svRank'); if (el) el.insertAdjacentHTML('beforebegin', `<p>${why} In the daily challenge there is no second chance.</p>`); }); }
  /* ---------------- the mission menu ---------------- */
  function diffMenu(go) { const L = Object.entries(D.DIFF || { normal: { n: 'Normal', icon: '🌑', d: '' } });
    show(`<h2>✚ New mission · how hard?</h2><div class="row" style="flex-direction:column;align-items:stretch">${L.map(([k, o]) => `<button data-d="${k}" class="${k === 'normal' ? '' : 'sec'}">${o.icon} <b>${o.n}</b> · ${o.d}</button>`).join('')}<button class="sec" id="dB">◀ Back</button></div>
      <p style="font-size:12px;opacity:.7">This replaces your saved mission. Scores from every difficulty go on the same board; Hard earns 1.5× points, Easy 0.6×.</p>`,
      p => { p.querySelectorAll('[data-d]').forEach(b => b.onclick = () => go(fresh('normal', b.dataset.d))); p.querySelector('#dB').onclick = () => menu(); }); }
  function dailyDone() { try { const d = JSON.parse(localStorage.getItem(KEY + '-daily') || 'null'); return !!(d && d.day === today() && d.over); } catch (e) { return false; } }
  function menu() { const has = !!load('normal'), dsave = load('daily'), tw = twistOf(today()), b = bests(), dd = dailyDone();
    show(`<h2>🌑 Moon Survival · ${D.SITE.n}</h2><p style="opacity:.85">How long can you last at the lunar south pole? Build a base, find water, survive the cold, the flares and the dust.</p>
      <div class="row" style="flex-direction:column;align-items:stretch">${has ? '<button id="mC">▶ Continue your mission</button>' : ''}<button id="mN" class="${has ? 'sec' : ''}">✚ New mission</button>
      <button id="mD" ${dd ? 'disabled class="sec"' : ''}>📅 Daily challenge · <b>${tw.n}</b>: ${dd ? `done for today (${((b.daily || {})[today()] || 0).toLocaleString()} points). A new one tomorrow!` : tw.d + (dsave ? ' (continue)' : '')}</button><button class="sec" id="mP">🎤 Pitch demo · a guided 3-minute run</button><button class="sec" id="mL">🏆 Leaderboard</button><button class="sec" id="mK">🖱 Look speed: <b>${Object.keys(LOOKS).find(k => LOOKS[k] === lookK) || 'normal'}</b></button></div>
      <p style="font-size:12px;opacity:.7">Best score ${(b.best || 0).toLocaleString()} · today’s daily best ${((b.daily || {})[today()] || 0).toLocaleString()}. Daily challenge: one life, the same twist for everyone today.</p>`,
      p => { const go = st0 => { close(); start(st0); };
        if (has) p.querySelector('#mC').onclick = () => go(load('normal')); p.querySelector('#mN').onclick = () => diffMenu(go);
        p.querySelector('#mD').onclick = () => { if (!dailyDone()) go(dsave || fresh('daily')); }; p.querySelector('#mL').onclick = () => { board(false); }; p.querySelector('#mP').onclick = () => go(freshDemo()); p.querySelector('#mK').onclick = () => { const ks = Object.keys(LOOKS), cur = ks.find(k => LOOKS[k] === lookK) || 'normal', nx = ks[(ks.indexOf(cur) + 1) % ks.length]; lookK = LOOKS[nx]; try { localStorage.setItem(KEY + '-look', nx); } catch (e) {} menu(); }; }); }

  /* ---------------- start / end ---------------- */
  function begin() { on = true; menuDone = false; const s = S(); s.arrive = null; if (!s.helmet) api.helmet(); buildHUD(); bindInput(); earth = makeEarth(); s._fov = R.cam.fov;
    { const c = s.dl.shadow.camera; s._shc = [c.left, c.far]; c.left = c.bottom = -150; c.right = c.top = 150; c.far = 900; c.updateProjectionMatrix(); s.dl.shadow.normalBias = .08; }   // the low Sun throws shadows a long way: cover a wider area
    st = fresh(); s.polar = { sd: sunDir() }; menu(); }
  function start(st0) { st = st0; if (st.jet == null) st.jet = 100; const s = S(); clearWorld();
    if (st.t < 1) { const P = s.player.position; for (let i = 0; i < 36; i++) { sunDir(); if (inSun(P.x, P.y + 1.5, P.z) && inSun(P.x + 8, H(P.x + 8, P.z + 6) + 5, P.z + 6)) break; st.sunA = (st.sunA + TAU / 36) % TAU; } }   // a new mission starts in sunlight
    s.polar = { sd: sunDir() }; placeWorld(); flare = null; menuDone = true;
    { const N = st.next; if (N.flare < st.t + 30) N.flare = st.t + 75; if (N.meteor < st.t + 30) N.meteor = st.t + 90; }   // coming back mid-flare must not count as sheltering; give a moment to get your bearings
    if (st.pos) { const [x, z] = st.pos; s.player.position.set(x, H(x, z), z); }
    if (st.t < 5) intro(); else { vo('welcome'); api.toast(`Welcome back, ${D.STORY.callsign}. Mission time ${Math.floor(st.t / 60)} min.`, 2600); } save(); }
  function clearWorld() { const scn = S().scn; caches.forEach(c => scn.remove(c.m)); built.forEach(B => scn.remove(B.m)); samples.forEach(x => scn.remove(x.g)); if (rover) scn.remove(rover.g); if (ship) scn.remove(ship); if (lamp) { scn.remove(lamp); scn.remove(lamp.target); }
    caches = []; built = []; samples = []; rover = null; ship = null; if (IN) { IN.g.visible = false; } inside = false; }
  function end() { if (!on) return; VOX.stop(); if (menuDone) save(); on = false; menuDone = false; unbind(); endBuild(); close(); try { hud.remove(); } catch (e) {} R.root.classList.remove('surv'); try { const s = S(); if (s._fov) { R.cam.fov = s._fov; R.cam.updateProjectionMatrix(); } if (earth) s.scn.remove(earth); earth = null; if (IN) { s.scn.remove(IN.g); IN = null; } inside = false; if (s._shc) { const c = s.dl.shadow.camera; c.left = c.bottom = -s._shc[0] * -1; c.left = c.bottom = s._shc[0]; c.right = c.top = -s._shc[0]; c.far = s._shc[1]; c.updateProjectionMatrix(); } s.polar = null; s.traction = 0; s.newton = false; s.thrust = null; s.camDip = 0; s.camRoll = 0; if (lamp) { s.scn.remove(lamp); s.scn.remove(lamp.target); } } catch (e) {} }
  return { get on() { return on; }, site: D.SITE, begin, end, pre, step, key, reset: () => { try { localStorage.removeItem(KEY); } catch (e) {} }, hasSave: () => !!load('normal'), thrustK: () => Math.max(thrustK, shipK), breath: () => st ? clamp((30 - st.vit.o2) / 30, 0, 1) * .8 + (thrustK > 0 ? .3 : 0) : 0, _st: () => st, _build: (id, x, z) => { const b = { id, x, z, ry: 0 }; st.builds.push(b); addBuild(b, true); }, _built: () => built, _caches: () => caches, _start: m => start(fresh(m || "normal")), _samples: () => samples, _fx: { banner: (...a) => banner(...a), floater: t => floater(t), shake: a => shake(a) }, _station: id => station(id), _score: () => score(), _enter: () => { const B = built.find(b => b.b.id === "hab"); if (B) enterHab(B.b); }, _exit: () => exitHab(), _fc: () => fc };
}
