// Red Dust Outpost · MOON SURVIVAL
// First-person survival at the lunar south pole, built on the Adventure surface engine (real Moon gravity and physics,
// the per-world ground, NASA 3D models). No aliens: the Moon itself is the danger.
// Numbers, costs, texts and the story live in survival_data.js (edited by the design team).
import * as THREE from 'three';
import * as D from './survival_data.js';
import { makeRover } from './adv_rover.js';

const KEY = 'rdo2-surv', V3 = THREE.Vector3, TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a), clamp = THREE.MathUtils.clamp;
function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export function makeSurvival(R, api) {
  let st = null, on = false, hud = null, built = [], caches = [], rover = null, lamp = null, ghost = null, bsel = -1, brot = 0, panel = null;
  let use = { t: 0, target: null }, mouseDown = false, touchUse = false, look = null, wasG = true, lastVy = 0, sunT = 0, sunlit = true, tSave = 0, tSec = 0, flare = null, inside = false;
  const S = () => R.surf.S, H = (x, z) => R.surf.H(x, z);
  const sd = new V3(1, .04, 0);

  /* ---------------- state and saving ---------------- */
  function fresh() { return { v: 1, inv: { scrap: 0, elec: 0, regolith: 0, ice: 0 }, vit: { hp: 100, o2: 100, pw: 100, tc: 22, dose: 0, leak: 0 },
    t: 0, sunA: 2.4, builds: [], loot: null, lander: { o2: D.LANDER.o2, pw: D.LANDER.power }, base: { pw: 0, o2: 0, iceQ: 0 }, goal: 0,
    flags: { iceCut: 0 }, stats: { flares: 0, sheltered: 0, deaths: 0, o2made: 0, powered: 0, total: 0, inside: 0 },
    next: { flare: D.DANGER.flareFirstMin * 60, meteor: rnd(...D.DANGER.meteorEveryMin) * 60 }, pos: null }; }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
  function save() { if (!st) return; try { const P = S().player.position; st.pos = [P.x, P.z]; localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const has = c => Object.entries(c).every(([k, n]) => (st.inv[k] || 0) >= n);
  const pay = c => { for (const k in c) st.inv[k] -= c[k]; };
  const costTxt = c => Object.entries(c).map(([k, n]) => `${D.RES[k].icon}${n}`).join(' ');
  const count = id => st.builds.filter(b => b.id === id).length;

  /* ---------------- sun, shadow, temperature ---------------- */
  function sunDir() { const el = D.SUN.elevationDeg * Math.PI / 180, a = st.sunA; sd.set(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a)); return sd; }
  // march from a point toward the Sun over the real terrain heights: if the ground rises above the ray, the point is in shadow
  function inSun(x, y, z) { let s = 1.5; for (let i = 0; i < 46; i++) { const px = x + sd.x * s, pz = z + sd.z * s, py = y + sd.y * s; if (Math.abs(px) > 1500 || Math.abs(pz) > 1500) return true; if (H(px, pz) > py) return false; s *= 1.16; } return true; }
  const inCrater = (x, z) => Math.hypot(x - D.CRATER.x, z - D.CRATER.z) < D.CRATER.r * .62;

  /* ---------------- meshes ---------------- */
  const M = { white: new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: .55, metalness: .2 }), foil: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: .3, metalness: .85 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x8a8d91, roughness: .5, metalness: .6 }), dark: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: .6, metalness: .4 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1b2a55, roughness: .25, metalness: .7, emissive: 0x050a18 }), orange: new THREE.MeshStandardMaterial({ color: 0xe0662a, roughness: .5 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x66e0ff }), red: new THREE.MeshBasicMaterial({ color: 0xff4a3a }), regolith: new THREE.MeshStandardMaterial({ color: 0x6f6b66, roughness: 1 }) };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), cyl = (r, h, m, s = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, s), m);
  function shadowAll(g) { g.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); return g; }
  function nasa(name, width, g) { // a NASA 3D Resources model, scaled to a real width; the box stands in until it loads
    api.loader.load('models/nasa/' + name + '.glb', gl => { const o = gl.scene; try { api.fixMat(o); } catch (e) {} const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new V3()), k = width / Math.max(sz.x, sz.z, .01);
      o.scale.setScalar(k); bb.setFromObject(o); o.position.y -= bb.min.y; while (g.children.length) g.remove(g.children[0]); g.add(shadowAll(o)); }, undefined, () => {}); }
  function makeMesh(id) { const g = new THREE.Group();
    if (id === 'solar') { const m = cyl(.12, 6.2, M.grey); m.position.y = 3.1; g.add(m); const p = new THREE.Group(); p.position.y = 4.4; const pan = box(2.4, 3.6, .08, M.panel); p.add(pan); const fr = box(2.5, .08, .12, M.grey); fr.position.y = 1.82; p.add(fr); g.add(p); g.userData.pivot = p; const b = cyl(.6, .3, M.grey); b.position.y = .15; g.add(b); }
    else if (id === 'battery') { const b = box(1.8, 1.1, 1.1, M.white); b.position.y = .55; g.add(b); const s = box(1.82, .12, 1.12, M.dark); s.position.y = .85; g.add(s); const l = box(.5, .08, .02, M.glow); l.position.set(0, .6, .56); g.add(l); g.userData.light = l; }
    else if (id === 'hab') { const c = cyl(2.9, 3.2, M.white, 24); c.position.y = 1.6; g.add(c); nasa('habitat-demonstration-unit', 7.2, g); }
    else if (id === 'ice') { const t = cyl(.75, 2.2, M.white); t.position.y = 1.1; g.add(t); const t2 = cyl(.45, 1.6, M.foil); t2.position.set(1.2, .8, 0); g.add(t2); const p = box(1.2, .12, .12, M.grey); p.position.set(.6, 1.5, 0); g.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), M.glow); l.position.set(0, 2.3, 0); g.add(l); g.userData.light = l; }
    else if (id === 'berm') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), M.regolith); m.scale.set(4.2, 1.9, 1.7); g.add(m); }
    else if (id === 'antenna') { const m = cyl(.1, 3, M.grey); m.position.y = 1.5; g.add(m); const h = new THREE.Group(); h.position.y = 3; g.add(h); const d = box(.8, .8, .8, M.white); h.add(d); nasa('lunar-laser-communications-demonstration-llcd', 1.6, h); }
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
      if (st.loot[i] == null) { const L = big ? { scrap: 10, elec: 5 } : D.CACHE_LOOT[i % D.CACHE_LOOT.length]; st.loot[i] = { ...L }; }
      const m = cacheMesh(i, big); m.position.set(x, H(x, z), z); scn.add(m); caches.push({ i, x, z, m, big }); if (st.loot[i].scrap + st.loot[i].elec === 0) { m.userData.beacon.visible = false; m.userData.beam.visible = false; } }
    // the broken lunar rover next to your lander
    if (!st.flags.rover) { try { rover = makeRover('lrv', api.loader, api.fixMat); rover.place(14, 10, .8, H); rover.g.rotation.z = .12; scn.add(rover.g); } catch (e) { rover = { g: new THREE.Group(), st: { x: 14, z: 10 } }; } }
    // what you have built
    built = []; st.builds.forEach(b => addBuild(b, true));
    // helmet lamp
    lamp = new THREE.SpotLight(0xfff4e0, 0, 60, .42, .55, 1.2); lamp.castShadow = false; scn.add(lamp); scn.add(lamp.target);
    // nothing to collect from Adventure mode here
    (s.cols || []).forEach(c => { c.got = true; if (c.m) c.m.visible = false; }); }
  function addBuild(b, quiet) { const def = D.BUILD.find(x => x.id === b.id), m = makeMesh(b.id); m.position.set(b.x, H(b.x, b.z), b.z); m.rotation.y = b.ry || 0; S().scn.add(m); built.push({ b, def, m, lit: true });
    if (!quiet) { api.sfx('lnd'); for (let i = 0; i < 24; i++) { const a = Math.random() * TAU; S().dust.emit(new V3(b.x, H(b.x, b.z) + .1, b.z), new V3(Math.cos(a) * 2, 1 + Math.random() * 1.5, Math.sin(a) * 2), S().dc, .14, 1.6, 1, .2, { grow: 1, drag: 0, grav: 1.62, a: .85 }); } } }

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
  #sv .bar.hp i{background:#c0392b}#sv .bar.o2 i{background:#2e86c1}#sv .bar.pw i{background:#d4ac0d}#sv .bar.tc i{background:#7f8c8d}
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
  #sv .hurt{position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(200,0,0,.8);opacity:0;transition:opacity .3s}`; document.head.appendChild(c); }
  function buildHUD() { css(); hud = document.createElement('div'); hud.id = 'sv'; hud.innerHTML = `<div class="tint"></div><div class="hurt"></div><div class="env"></div><div class="alarm"></div><div class="goal"></div>
    <div class="cross"></div><div class="ring" style="--p:0%;display:none"></div><div class="prompt" style="display:none"></div>
    <div class="vit"><div class="bar hp"><i></i><span></span></div><div class="bar o2"><i></i><span></span></div><div class="bar pw"><i></i><span></span></div><div class="bar tc"><i></i><span></span></div></div>
    <div class="inv"></div><div class="bld"></div>
    <div class="btns"><button data-b="use">USE</button><button data-b="build">BUILD</button><button data-b="lamp">LAMP</button><button data-b="patch" style="display:none">PATCH</button></div>`;
    R.root.appendChild(hud); R.root.classList.add('surv');
    const bu = hud.querySelector('[data-b=use]'); bu.addEventListener('pointerdown', e => { e.preventDefault(); touchUse = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bu.addEventListener(ev, () => touchUse = false));
    hud.querySelector('[data-b=build]').onclick = () => toggleBuild(); hud.querySelector('[data-b=lamp]').onclick = () => toggleLamp(); hud.querySelector('[data-b=patch]').onclick = () => patch(); }
  const $ = q => hud.querySelector(q);
  function bar(cls, v, txt, warn) { const b = $('.bar.' + cls); b.querySelector('i').style.width = clamp(v, 0, 100) + '%'; const s = b.querySelector('span'); if (s._t !== txt) { s.textContent = txt; s._t = txt; } b.classList.toggle('warn', !!warn); }
  function hudUpdate(envT) { const v = st.vit;
    bar('hp', v.hp, `♥ Health ${Math.ceil(v.hp)}`, v.hp < 30); bar('o2', v.o2, `O₂ ${Math.ceil(v.o2)}%${v.leak ? ' · LEAK!' : ''}`, v.o2 < 20 || v.leak); bar('pw', v.pw, `⚡ Suit power ${Math.ceil(v.pw)}%`, v.pw < 15);
    bar('tc', clamp((v.tc + 20) / .6, 0, 100), `🌡 Suit ${Math.round(v.tc)} °C`, v.tc < 8 || v.tc > 38);
    const inv = Object.keys(D.RES).map(k => `<div>${D.RES[k].icon} ${st.inv[k] || 0}<small>${D.RES[k].n}</small></div>`).join(''); if ($('.inv')._t !== inv) { $('.inv').innerHTML = inv; $('.inv')._t = inv; }
    const ang = ((Math.atan2(sd.x, sd.z) - Math.atan2(-Math.sin(S().camYaw), -Math.cos(S().camYaw))) * 180 / Math.PI + 540) % 360 - 180, dir = Math.abs(ang) < 30 ? 'ahead' : Math.abs(ang) > 150 ? 'behind you' : ang > 0 ? 'to your left' : 'to your right';
    const P = S().player.position; let nc = null, nd = 1e9; caches.forEach(c => { const L = st.loot[c.i]; if (L.scrap + L.elec > 0) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < nd) { nd = d; nc = c; } } });
    let cTxt = ''; if (nc && nd > 4) { const ca = ((Math.atan2(nc.x - P.x, nc.z - P.z) - Math.atan2(-Math.sin(S().camYaw), -Math.cos(S().camYaw))) * 180 / Math.PI + 540) % 360 - 180; cTxt = ` · 📦 cache ${Math.round(nd)} m ${Math.abs(ca) < 20 ? 'ahead' : ca > 0 ? '◀ left' : 'right ▶'}`; }
    const e = `${sunlit ? '<span class="sun">☀ IN SUNLIGHT</span>' : '<span class="sh">● IN SHADOW</span>'} · ground ${envT} °C · Sun ${dir}${cTxt}${built.length ? ` · base ⚡${Math.round(st.base.pw)} O₂${Math.round(st.base.o2)}` : ''}`; if ($('.env')._t !== e) { $('.env').innerHTML = e; $('.env')._t = e; }
    const g = D.GOALS[st.goal], gt = g ? `<small>OBJECTIVE ${st.goal + 1} / ${D.GOALS.length}${g.area ? ' · ' + D.AREAS.find(a => a.id === g.area).n.toUpperCase() : ''}</small>${g.t}` : '<small>ALL OBJECTIVES DONE</small>Keep your base alive. Press <b>Tab</b> for your base report.';
    if ($('.goal')._t !== gt) { $('.goal').innerHTML = gt; $('.goal')._t = gt; }
    $('[data-b=patch]').style.display = v.leak ? '' : 'none'; }
  function alarm(t) { const a = $('.alarm'); a.style.display = t ? 'block' : 'none'; if (t && a._t !== t) { a.innerHTML = t; a._t = t; } }
  function hurt(k) { $('.hurt').style.opacity = k; }

  /* ---------------- panels (intro, habitat, report, death) ---------------- */
  function show(html, onBind) { close(); panel = document.createElement('div'); panel.className = 'svp'; panel.innerHTML = `<div class="svc">${html}</div>`; hud.appendChild(panel); try { document.exitPointerLock(); } catch (e) {} if (onBind) onBind(panel); }
  function close() { if (panel) { panel.remove(); panel = null; } inside = false; }
  function intro() { show(`<h2>🌑 Moon Survival · ${D.SITE.n}</h2><p><b>${D.STORY.callsign}</b>, ${D.STORY.intro.join(' ')}</p>
    <p style="opacity:.8;font-size:13px"><b>Controls:</b> WASD move · mouse look (click to lock) · hold <b>E</b> or left mouse to use and gather · <b>B</b> build · <b>F</b> helmet lamp · <b>P</b> patch suit · <b>Tab</b> base report · Space jump · Shift run. On a phone: left stick to move, drag the right side to look.</p>
    <p style="opacity:.7;font-size:12px">${D.SITE.facts[0]}</p><div class="row"><button id="svGo">Start surviving</button>${load() && st.t > 5 ? '' : ''}</div>`, p => p.querySelector('#svGo').onclick = () => { close(); api.say(D.STORY.intro[0]); }); }
  function habPanel() { const v = st.vit, b = st.base; inside = true;
    show(`<h2>🏠 Inside the habitat</h2><p>Warm, pressurised and shielded. You heal faster in here.</p>
      <p>Base power <b>${Math.round(b.pw)}</b> · Base oxygen <b>${Math.round(b.o2)}%</b> · Ice waiting <b>${b.iceQ}</b></p>
      <div class="row"><button id="hR">Refill suit (O₂ and power)</button>${v.leak ? '<button id="hP">Patch suit</button>' : ''}<button class="sec" id="hT">Base report</button><button class="sec" id="hX">Go outside</button></div>
      <p style="opacity:.7;font-size:12px">${D.BUILD.find(x => x.id === 'hab').fact}</p>`, p => {
      p.querySelector('#hR').onclick = () => { const need = 100 - v.o2, got = Math.min(need, b.o2); v.o2 += got; b.o2 -= got; const pn = 100 - v.pw, pg = Math.min(pn, b.pw); v.pw += pg; b.pw -= pg; v.tc = 22; api.toast(got < need ? '⚠ The base is short of oxygen. Make more from ice.' : '✅ Suit refilled.', 2200); habPanel(); };
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
  function die(cause) { const s = st.stats; s.deaths++; const lost = {}; for (const k in st.inv) { lost[k] = Math.floor(st.inv[k] / 2); st.inv[k] -= lost[k]; }
    const hab = st.builds.find(b => b.id === 'hab'), P = S().player.position, sx = hab ? hab.x + 5 : -8, sz = hab ? hab.z + 5 : -4; P.set(sx, H(sx, sz), sz); S().vel.set(0, 0, 0);
    Object.assign(st.vit, { hp: 60, o2: 70, pw: 70, tc: 20, leak: 0 }); api.say('Suit failure.');
    show(`<h2>☠ Suit failure</h2><p>${cause}</p><p>You wake up ${hab ? 'in the habitat' : 'in your lander'}. You dropped half of what you carried.</p><div class="row"><button id="dX">Try again</button></div>`, p => p.querySelector('#dX').onclick = () => close()); }

  /* ---------------- interaction ---------------- */
  function forward() { const c = R.cam, f = new V3(); c.getWorldDirection(f); return f; }
  function findTarget() { const P = S().player.position, f = forward(), fx = new V3(f.x, 0, f.z).normalize(), list = [];
    const add = (x, z, r, o) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz) - r; if (d > 3.2) return; const dot = (dx * fx.x + dz * fx.z) / Math.max(.01, Math.hypot(dx, dz)); if (dot > .55 || d < .6) list.push([d - dot, o]); };
    caches.forEach(c => { const L = st.loot[c.i]; if (L.scrap + L.elec > 0) add(c.x, c.z, c.big ? 2 : 1.2, { kind: 'cache', c, t: D.GATHER.cacheSec, label: `Salvage ${c.big ? 'the wrecked lander' : 'supply cache'} <small>(${L.scrap}🔩 ${L.elec}💾 left)</small>` }); });
    add(-12, -8, 3, { kind: 'lander', t: .8, label: `Your lander: refill <small>(O₂ ${Math.round(st.lander.o2)}% · power ${Math.round(st.lander.pw)}% left)</small>` });
    if (rover && !st.flags.rover) add(rover.st.x, rover.st.z, 1.8, { kind: 'rover', t: 2.5, label: has(D.ROVER.cost) ? `Repair the lunar rover <small>${costTxt(D.ROVER.cost)}</small>` : `Broken lunar rover — needs ${costTxt(D.ROVER.cost)}`, ok: has(D.ROVER.cost) });
    built.forEach(B => { const b = B.b, r = b.id === 'hab' ? 3.4 : b.id === 'berm' ? 3 : 1.2;
      if (b.id === 'hab') add(b.x, b.z, r, { kind: 'hab', t: .4, label: 'Enter the habitat' });
      else if (b.id === 'ice') add(b.x, b.z, r, { kind: 'ice', t: .6, label: st.inv.ice ? `Load ${st.inv.ice} ice into the processor` : `Ice processor <small>(${st.base.iceQ} ice waiting)</small>`, ok: st.inv.ice > 0 });
      else if (b.id === 'antenna') add(b.x, b.z, r, { kind: 'antenna', t: 1.5, label: st.goal >= D.GOALS.length - 1 ? 'Send your base report to Earth' : 'Laser comms terminal: online' , ok: st.goal >= D.GOALS.length - 1 });
      else add(b.x, b.z, r, { kind: 'info', t: 0, label: `${B.def.icon} ${B.def.n}${b.id === 'solar' ? (B.lit ? ' · in sunlight ✓' : ' · in shadow ✗') : ''}`, ok: false }); });
    if (list.length) return list.sort((a, b) => a[0] - b[0])[0][1];
    if (S().camPitch > .55 && S().onGround) { const crat = inCrater(P.x, P.z); if (crat) return { kind: 'ice', dig: 1, t: D.GATHER.iceSec, label: 'Cut ice from the frozen crater floor' }; return { kind: 'dig', t: D.GATHER.digSec, label: 'Dig regolith' }; }
    return null; }
  function act(o) { const v = st.vit;
    if (o.kind === 'cache') { const L = st.loot[o.c.i]; const k = L.elec > 0 && (L.scrap === 0 || Math.random() < .4) ? 'elec' : 'scrap'; L[k]--; st.inv[k]++; api.sfx('coin'); if (L.scrap + L.elec === 0) { o.c.m.userData.beacon.visible = false; o.c.m.userData.beam.visible = false; api.toast('📦 Cache empty', 1200); } }
    else if (o.kind === 'dig') st.inv.regolith++;
    else if (o.kind === 'ice' && o.dig) { st.inv.ice++; st.flags.iceCut++; }
    else if (o.kind === 'ice') { if (st.inv.ice > 0) { st.base.iceQ += st.inv.ice; st.inv.ice = 0; api.toast('🧊 Ice loaded. The processor makes oxygen while the base has power.', 2400); } }
    else if (o.kind === 'lander') { const a = Math.min(100 - v.o2, st.lander.o2); v.o2 += a; st.lander.o2 -= a; const b = Math.min(100 - v.pw, st.lander.pw); v.pw += b; st.lander.pw -= b; if (v.leak && st.inv.scrap) { v.leak = 0; st.inv.scrap--; }
      api.toast(st.lander.o2 < 1 ? '⚠ The lander has no oxygen left. You need a habitat and ice.' : `Refilled. Lander reserve: O₂ ${Math.round(st.lander.o2)}%, power ${Math.round(st.lander.pw)}%`, 2200); }
    else if (o.kind === 'rover' && o.ok) { pay(D.ROVER.cost); st.flags.rover = 1; try { S().scn.remove(rover.g); } catch (e) {} const P = S().player.position; P.set(rover.st.x - 2, H(rover.st.x - 2, rover.st.z), rover.st.z); rover = null; api.toast('🚙 Rover repaired! Press <b>G</b> to drive, G again to park.', 3200); fact(D.ROVER.fact); }
    else if (o.kind === 'hab') habPanel();
    else if (o.kind === 'antenna' && o.ok) { st.flags.reported = 1; api.say(D.STORY.win); report(true); } }

  /* ---------------- building ---------------- */
  function toggleBuild() { if (bsel >= 0) return endBuild(); bsel = 0; renderBuildBar(); setGhost(); }
  function endBuild() { bsel = -1; $('.bld').style.display = 'none'; if (ghost) { S().scn.remove(ghost); ghost = null; } }
  function renderBuildBar() { const el = $('.bld'); el.style.display = 'flex'; el.innerHTML = D.BUILD.map((b, i) => `<button data-i="${i}" class="${i === bsel ? 'sel' : ''} ${has(b.cost) ? '' : 'no'}"><b>${b.icon}</b>${i + 1}. ${b.n}<br><small>${costTxt(b.cost)}</small></button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => { bsel = +b.dataset.i; renderBuildBar(); setGhost(); }); }
  function setGhost() { if (ghost) S().scn.remove(ghost); ghost = makeMesh(D.BUILD[bsel].id); ghost.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.transparent = true; n.material.opacity = .45; n.castShadow = false; } }); S().scn.add(ghost);
    const d = D.BUILD[bsel]; api.toast(`${d.icon} <b>${d.n}</b> · ${costTxt(d.cost)}<br><small>${d.desc}</small>`, 3000); }
  function ghostPos() { const P = S().player.position, f = forward(), fx = new V3(f.x, 0, f.z).normalize(), dist = D.BUILD[bsel].id === 'hab' ? 9 : 6; const x = P.x + fx.x * dist, z = P.z + fx.z * dist; return [x, z]; }
  function canPlace(x, z, id) { const sl = Math.hypot(H(x + 1.5, z) - H(x - 1.5, z), H(x, z + 1.5) - H(x, z - 1.5)) / 3; if (sl > .3) return 'too steep';
    const r = id === 'hab' ? 4.5 : id === 'berm' ? 3.5 : 1.8; for (const B of built) if (Math.hypot(B.b.x - x, B.b.z - z) < r + 2) return 'too close to another building';
    for (const c of caches) if (Math.hypot(c.x - x, c.z - z) < r + 2) return 'too close to a cache'; if (Math.hypot(x + 12, z + 8) < r + 4) return 'too close to your lander'; return ''; }
  function stepGhost() { if (!ghost) return; const [x, z] = ghostPos(), d = D.BUILD[bsel], why = canPlace(x, z, d.id), lit = d.id === 'solar' ? inSun(x, H(x, z) + 5.5, z) : true;
    ghost.position.set(x, H(x, z), z); ghost.rotation.y = brot; const ok = !why && has(d.cost); ghost.traverse(n => { if (n.isMesh) n.material.color.set(ok ? (lit ? 0x66ff99 : 0xffd040) : 0xff5040); });
    showPrompt(why ? `Can't build here: ${why}` : !has(d.cost) ? `Need ${costTxt(d.cost)}` : `<b>E / click</b> build ${d.n}${d.id === 'solar' ? (lit ? ' · in sunlight ✓' : ' · <b>in shadow</b> — it won’t make power here') : ''} · <b>R</b> rotate · <b>B</b> cancel`, 0); return ok ? [x, z] : null; }
  function place() { const p = stepGhost(); if (!p) return; const d = D.BUILD[bsel]; pay(d.cost); const b = { id: d.id, x: p[0], z: p[1], ry: brot }; st.builds.push(b); addBuild(b); fact(d.fact); renderBuildBar(); save(); }

  /* ---------------- controls ---------------- */
  function toggleLamp() { st.lamp = !st.lamp; api.sfx('click'); }
  function patch() { if (!st.vit.leak) return; if (st.inv.scrap < 1) return api.toast('You need 1 🔩 scrap to patch the suit (or go inside).', 2000); st.inv.scrap--; st.vit.leak = 0; api.toast('🩹 Suit patched.', 1500); }
  function key(e, down) { if (!on) return false; const k = e.key.toLowerCase();
    if (!down) { if (k === 'e') R.keys.e = 0; return false; }
    if (panel) { if (k === 'escape' || k === 'e' || k === 'enter') { close(); return true; } return true; }
    if (k === 'e') { R.keys.e = 1; e.preventDefault(); return true; }
    if (k === 'b') { toggleBuild(); return true; } if (k === 'escape' && bsel >= 0) { endBuild(); return true; }
    if (bsel >= 0 && k >= '1' && k <= String(D.BUILD.length)) { bsel = +k - 1; renderBuildBar(); setGhost(); return true; } if (bsel >= 0 && k === 'r') { brot += Math.PI / 4; return true; }
    if (k === 'f') { toggleLamp(); return true; } if (k === 'p') { patch(); return true; } if (k === 'tab') { e.preventDefault(); report(); return true; }
    if (k === 'g') { if (!st.flags.rover) { api.toast('The rover is broken. Repair it first (look for it next to your lander).', 2200); return true; } st.flags.drove = 1; return false; }
    if (k === 'l' || k === 'm' || k === 'k' || k === 'n') return true; return false; }
  function bindInput() { const cv = R.ren ? R.ren.domElement : R.root.querySelector('canvas');
    const onMove = e => { if (document.pointerLockElement !== cv || panel) return; const s = S(); s.camYaw -= e.movementX * .0024; s.camPitch = clamp(s.camPitch + e.movementY * .0019, .05, 1.2); };
    const onDown = e => { if (e.pointerType === 'touch' || e.button !== 0 || panel) return; if (document.pointerLockElement !== cv) { try { cv.requestPointerLock(); } catch (er) {} return; } if (bsel >= 0) place(); else mouseDown = true; };
    const onUp = () => { mouseDown = false; };
    const tS = e => { for (const t of e.changedTouches) if (t.clientX > innerWidth * .45 && !look) look = { id: t.identifier, x: t.clientX, y: t.clientY }; };
    const tM = e => { for (const t of e.changedTouches) if (look && t.identifier === look.id) { const s = S(); s.camYaw -= (t.clientX - look.x) * .006; s.camPitch = clamp(s.camPitch + (t.clientY - look.y) * .005, .05, 1.2); look.x = t.clientX; look.y = t.clientY; } };
    const tE = e => { for (const t of e.changedTouches) if (look && t.identifier === look.id) look = null; };
    cv.addEventListener('mousemove', onMove); document.addEventListener('mousemove', onMove); cv.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp);
    cv.addEventListener('touchstart', tS, { passive: true }); cv.addEventListener('touchmove', tM, { passive: true }); cv.addEventListener('touchend', tE); cv.addEventListener('touchcancel', tE);
    unbind = () => { cv.removeEventListener('mousemove', onMove); document.removeEventListener('mousemove', onMove); cv.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); cv.removeEventListener('touchstart', tS); cv.removeEventListener('touchmove', tM); cv.removeEventListener('touchend', tE); cv.removeEventListener('touchcancel', tE); try { document.exitPointerLock(); } catch (e) {} }; }
  let unbind = () => {};
  function showPrompt(t, p) { const pr = $('.prompt'), ring = $('.ring'); pr.style.display = t ? 'block' : 'none'; if (t && pr._t !== t) { pr.innerHTML = t; pr._t = t; } ring.style.display = p > 0 ? 'block' : 'none'; ring.style.setProperty('--p', Math.round(p * 100) + '%'); }
  let factT = 0; function fact(t) { if (!t) return; factT = 7; api.toast('🔭 ' + t, 6500); }

  /* ---------------- goals ---------------- */
  function goals() { const g = D.GOALS[st.goal]; if (!g) return; const c = count, f = st.flags; let done = false;
    if (g.id === 'salvage') done = (st.inv.scrap >= 6 && st.inv.elec >= 3) || st.builds.length > 0; else if (g.id === 'solar') done = built.some(B => B.b.id === 'solar' && B.lit);
    else if (g.id === 'hab') done = c('hab') > 0; else if (g.id === 'ice') done = c('ice') > 0 && f.iceCut >= 4; else if (g.id === 'berm') done = c('berm') > 0 && st.stats.sheltered > 0;
    else if (g.id === 'rover') done = !!f.rover; else if (g.id === 'antenna') done = !!f.reported;
    if (done) { st.goal++; api.sfx('coin'); const n = D.GOALS[st.goal]; api.toast(`✅ <b>Objective complete.</b>${n ? '<br>Next: ' + n.t : ''}`, 3600); if (n) api.say('Objective complete.'); save(); goals(); } }

  /* ---------------- main step ---------------- */
  function pre(dt, inp) { if (!on) return; if (panel) { inp.x = inp.y = 0; inp.jump = inp.jumpPress = false; } inp.jump = inp.jumpPress; inp.look = 0; }   // no jetpack on this mission
  function step(dt) { if (!on) return; const s = S(), P = s.player.position, v = st.vit; dt = Math.min(dt, .1); st.t += dt;
    st.sunA = (st.sunA + dt * TAU / (D.SUN.circleMin * 60)) % TAU; sunDir(); s.polar = { sd };
    sunT -= dt; if (sunT <= 0) { sunT = .25; sunlit = inSun(P.x, P.y + 1.5, P.z); }
    const crat = inCrater(P.x, P.z), envT = crat ? D.TEMP.crater : sunlit ? D.TEMP.sun : D.TEMP.shadow, driving = !!s.drive;
    // lamp
    const f = forward(); if (s.helmet) lamp.position.copy(R.cam.position); else lamp.position.set(P.x, P.y + 1.7, P.z); lamp.target.position.copy(lamp.position).addScaledVector(f, 10); lamp.intensity += ((st.lamp ? 90 : 0) - lamp.intensity) * Math.min(1, dt * 8);
    // suit
    const run = (R.keys.shift || R.bst) && Math.hypot(s.vel.x, s.vel.z) > 3, sheltered = inside || built.some(B => (B.b.id === 'berm' && Math.hypot(B.b.x - P.x, B.b.z - P.z) < B.def.shelter) || (B.b.id === 'hab' && Math.hypot(B.b.x - P.x, B.b.z - P.z) < 4));
    if (!inside) { v.o2 -= dt * 100 / (D.SUIT.o2Min * 60) * (run ? D.SUIT.runO2X : 1) + (v.leak ? D.SUIT.leakPerSec * dt : 0); v.pw -= dt * 100 / (D.SUIT.powerMin * 60) * (crat ? D.SUIT.craterX : sunlit ? 1 : D.SUIT.heaterX) * (driving ? .5 : 1) + (st.lamp ? D.SUIT.lampDrain * dt * 100 / (D.SUIT.powerMin * 60) : 0); }
    else { v.tc += (22 - v.tc) * Math.min(1, dt); }
    v.o2 = clamp(v.o2, 0, 100); v.pw = clamp(v.pw, 0, 100);
    if (!inside) { if (v.pw > 0) v.tc += (22 - v.tc) * Math.min(1, dt * .5); else v.tc += (envT * .2 - v.tc) * dt * .025; }
    // health
    let dmg = 0, why = ''; if (v.o2 <= 0) { dmg += D.HEALTH.suffocate; why = 'You ran out of oxygen.'; } if (v.tc < 5 || v.tc > 42) { dmg += D.HEALTH.cold; why = why || (v.tc < 5 ? 'Your suit froze: the battery ran flat in the cold.' : 'Your suit overheated.'); }
    if (flare && flare.on && !sheltered) { dmg += D.HEALTH.flare; v.dose += dt * 4; why = why || 'Radiation from the solar flare.'; }
    v.dose += dt * D.DANGER.backgroundDose / 86400 * 60;   // shown in mSv; background dose sped up 60×
    // falls: Moon gravity is 1/6 of Earth's, so you fall slowly, but a long drop still hurts
    if (!s.onGround) lastVy = s.vel.y; if (s.onGround && !wasG && !driving) { const imp = -lastVy; if (imp > D.SUIT.fallSafe) { v.hp -= (imp - D.SUIT.fallSafe) * D.SUIT.fallDamage; api.toast(`🦴 Hard landing (${imp.toFixed(1)} m/s)`, 1500); hurt(.8); setTimeout(() => hurt(0), 300); if (v.hp <= 0) why = 'A fall broke your suit seal.'; } } wasG = s.onGround;
    v.hp -= dmg * dt; if (!dmg && v.o2 > 15 && v.pw > 0) v.hp += (inside ? D.HEALTH.regenInside : D.HEALTH.regen) * dt; v.hp = clamp(v.hp, 0, 100); hurt(dmg ? .35 + .25 * Math.sin(st.t * 6) : 0);
    if (v.hp <= 0) { die(why || 'Your suit failed.'); return; }
    // dangers: solar flares and micrometeorites
    const N = st.next, warn = count('antenna') ? D.DANGER.flareWarnWithAntennaSec : D.DANGER.flareWarnSec;
    if (!flare && st.t > N.flare - warn) flare = { at: N.flare, on: false };
    if (flare) { const left = flare.at - st.t; if (left > 0) alarm(`☢ SOLAR FLARE in ${Math.ceil(left)} s — get inside the habitat or behind a regolith shield`); else if (left > -D.DANGER.flareSec) { if (!flare.on) { flare.on = true; flare.hit = false; api.say('Solar flare. Take shelter.'); } if (!sheltered) flare.hit = true; alarm(`☢ SOLAR FLARE · ${Math.ceil(D.DANGER.flareSec + left)} s · ${sheltered ? 'you are sheltered ✓' : 'TAKE SHELTER!'}`); $('.tint').style.opacity = .8; }
      else { st.stats.flares++; if (!flare.hit) st.stats.sheltered++; flare = null; N.flare = st.t + rnd(...D.DANGER.flareEveryMin) * 60; alarm(''); $('.tint').style.opacity = 0; api.toast('☢ The flare is over.', 2000); } }
    if (st.t > N.meteor) { N.meteor = st.t + rnd(...D.DANGER.meteorEveryMin) * 60; if (Math.random() < D.DANGER.meteorChance && !inside && !driving) { v.leak = 1; hurt(1); setTimeout(() => hurt(0), 250); api.say('Suit breach.'); api.toast('💥 A micrometeorite punctured your suit! Oxygen is leaking. Press <b>P</b> to patch it (1 🔩) or get inside.', 4500); } }
    // base: power grid, oxygen from ice
    tSec -= dt; if (tSec <= 0) { tSec = 1; let prod = 0, useP = 0, cap = 0;
      built.forEach(B => { const id = B.b.id; if (id === 'solar') { B.lit = inSun(B.b.x, H(B.b.x, B.b.z) + 5.5, B.b.z); if (B.lit) prod += B.def.power; } if (id === 'battery') cap += B.def.store; if (B.def.use && id !== 'ice') useP += B.def.use; if (id === 'hab') cap += 40; });
      const ice = built.find(B => B.b.id === 'ice'), o2cap = count('hab') ? D.BUILD.find(b => b.id === 'hab').o2 : 100;
      if (ice && st.base.iceQ > 0 && st.base.o2 < o2cap) useP += ice.def.use;
      st.base.pw = clamp(st.base.pw + prod - useP, 0, cap); const powered = st.base.pw > 0 || prod >= useP; st.stats.total++; if (built.length && powered) st.stats.powered++;
      if (ice && powered && st.base.iceQ > 0 && st.base.o2 < o2cap) { ice.prog = (ice.prog || 0) + 1; if (ice.prog >= 8) { ice.prog = 0; st.base.iceQ--; st.base.o2 = Math.min(o2cap, st.base.o2 + ice.def.perIce); st.stats.o2made += ice.def.perIce; } }
      built.forEach(B => { if (B.m.userData.light) B.m.userData.light.visible = powered; });
      if (inside) st.stats.inside++; goals(); }
    built.forEach(B => { if (B.m.userData.pivot) B.m.userData.pivot.rotation.y = Math.atan2(sd.x, sd.z); });
    caches.forEach(c => { if (c.m.userData.beacon.visible) c.m.userData.beacon.scale.setScalar(Math.sin(st.t * 4 + c.i) > .6 ? 1.6 : .6); });
    // use / gather / build
    if (panel) { showPrompt('', 0); } else if (bsel >= 0) { stepGhost(); if (R.keys.e || touchUse) { R.keys.e = 0; touchUse = false; place(); } }
    else if (!driving) { const tg = findTarget(), holding = R.keys.e || mouseDown || touchUse;
      if (tg && use.target && tg.kind === use.target.kind && tg.c === use.target.c) tg.t = use.target.t; if (!tg || !use.target || tg.kind !== use.target.kind || tg.c !== use.target.c) use.t = 0; use.target = tg;
      if (tg) { const can = tg.ok !== false && tg.t > 0; if (holding && can) { use.t += dt; if (use.t >= tg.t) { use.t = 0; act(tg); if (tg.kind === 'hab' || tg.kind === 'rover' || tg.kind === 'antenna') { R.keys.e = 0; mouseDown = touchUse = false; } } } else use.t = 0;
        showPrompt(`${can ? '<b>Hold E</b> ' : ''}${tg.label}`, can ? use.t / tg.t : 0); } else showPrompt('', 0); }
    else showPrompt('', 0);
    hudUpdate(envT); tSave -= dt; if (tSave <= 0) { tSave = 20; save(); }
    if (v.o2 < 20 && !st.w1) { st.w1 = 1; api.say('Warning. Oxygen low.'); } if (v.o2 > 30) st.w1 = 0;
    if (v.pw < 15 && !st.w2) { st.w2 = 1; api.say('Warning. Suit power low.'); } if (v.pw > 25) st.w2 = 0; }

  /* ---------------- start / end ---------------- */
  function begin(fresh0) { st = (!fresh0 && load()) || fresh(); on = true; const s = S(); s.arrive = null;
    if (st.t < 1) { const P = s.player.position; for (let i = 0; i < 36; i++) { sunDir(); if (inSun(P.x, P.y + 1.5, P.z) && inSun(P.x + 8, H(P.x + 8, P.z + 6) + 5, P.z + 6)) break; st.sunA = (st.sunA + TAU / 36) % TAU; } }   // a new mission starts in sunlight
    s.polar = { sd: sunDir() }; if (!s.helmet) api.helmet(); buildHUD(); placeWorld(); bindInput();
    if (st.pos) { const [x, z] = st.pos; s.player.position.set(x, H(x, z), z); s.arrive = null; }
    if (st.t < 5) intro(); else api.toast(`Welcome back, ${D.STORY.callsign}. Mission time ${Math.floor(st.t / 60)} min.`, 2600); }
  function end() { if (!on) return; save(); on = false; unbind(); endBuild(); close(); try { hud.remove(); } catch (e) {} R.root.classList.remove('surv'); try { const s = S(); s.polar = null; if (lamp) { s.scn.remove(lamp); s.scn.remove(lamp.target); } } catch (e) {} }
  return { get on() { return on; }, site: D.SITE, begin, end, pre, step, key, reset: () => { try { localStorage.removeItem(KEY); } catch (e) {} }, hasSave: () => !!load(), _st: () => st, _build: (id, x, z) => { const b = { id, x, z, ry: 0 }; st.builds.push(b); addBuild(b, true); }, _built: () => built, _caches: () => caches };
}
