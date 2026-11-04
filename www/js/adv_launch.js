// Red Dust Outpost · launch from Earth: an SLS lift-off at Kennedy Space Center that starts every journey.
// Countdown at sunrise, RS-25 start and the steam cloud, booster ignition and lift-off, the long-lens tracking shot,
// the vapour cone at Max-Q, booster separation, core-stage cutoff and separation, upper-stage ignition, then orbit.
// The rocket is NASA's SLS Block 1 model (NASA 3D Resources), split into its real stages so they can separate.
import * as THREE from 'three';
import { makeFX } from './adv_fx.js';
import { mergeGeometries } from './vendor/three/utils/BufferGeometryUtils.js';

const lerp = THREE.MathUtils.lerp, ss = THREE.MathUtils.smoothstep, clamp = THREE.MathUtils.clamp;
// real flight profile used for the telemetry (mission seconds → km, km/h)
const PROF = [[0, 0, 0], [30, 1.2, 600], [70, 11, 1600], [132, 48, 5000], [300, 140, 13000], [486, 160, 27600], [520, 165, 28000]];
const prof = t => { for (let i = 1; i < PROF.length; i++) if (t <= PROF[i][0]) { const a = PROF[i - 1], b = PROF[i], k = (t - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; } return PROF[PROF.length - 1].slice(1); };
// sequence time (s) → mission time T (s, negative before lift-off)
const SEQ = [[0, -10], [9.8, 0], [15, 6], [21, 40], [26, 70], [31, 132], [37, 486], [42, 520]];
const missionT = s => { for (let i = 1; i < SEQ.length; i++) if (s <= SEQ[i][0]) { const a = SEQ[i - 1], b = SEQ[i]; return lerp(a[1], b[1], (s - a[0]) / (b[0] - a[0])); } return 520; };

function plumeMat(col, diamonds) {
  return new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, k: { value: 0 }, col: { value: new THREE.Color(col) }, dia: { value: diamonds ? 1 : 0 }, vac: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time, k, dia, vac; uniform vec3 col; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float a = 1. - vUv.y, e = pow(abs(dot(normalize(vN), normalize(vV))), 1.2), fl = .85 + .15 * sin(time * 50. + a * 40.);
        float shock = dia > .5 ? (.55 + .45 * pow(max(sin(a * 34. - 1.2), 0.), 6.) * (1. - vac)) : 1.;              // Mach diamonds in the thick low air
        float core = pow(1. - a, 2.2) * (1. - vac * .5) + pow(1. - a, .7) * vac * .35;
        vec3 c = mix(col, vec3(1.), pow(1. - a, 3.) * .8) * (1.4 + 1.6 * k);
        gl_FragColor = vec4(c, k * core * e * fl * shock); }` });
}

export function makeLaunch(ctx) {
  const scn = new THREE.Scene(), cam = ctx.cam, root = ctx.root, L = { t: 0, done: false, phase: '' };
  // ---- sky: blue at the ground, black at the edge of space, with the rising Sun
  const sd = new THREE.Vector3(.86, .16, -.48).normalize(), SU = { alt: { value: 0 }, sd: { value: sd } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.ShaderMaterial({ uniforms: SU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float alt; uniform vec3 sd; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y, k = max(dot(d, sd), 0.);
        vec3 zen = vec3(.16, .36, .78), hor = vec3(.95, .74, .55), gnd = vec3(.32, .33, .3);
        vec3 c = h > 0. ? mix(hor, zen, pow(h, .45)) : mix(hor * .8, gnd, smoothstep(0., .08, -h));
        c += vec3(1., .72, .42) * pow(k, 6.) * .55 * (1. - alt) + vec3(1., .95, .85) * pow(k, 900.) * 9.;
        c = mix(c, vec3(.0, .0, .01) + vec3(1.) * pow(k, 1500.) * 9., alt);   // thin air: the sky turns black, a blue limb remains
        gl_FragColor = vec4(c, 1.); }` }));
  scn.add(sky); scn.fog = new THREE.FogExp2(0xc4cfdc, .00016);
  const stars = new THREE.Mesh(new THREE.SphereGeometry(8800, 32, 16), new THREE.MeshBasicMaterial({ map: null, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); scn.add(stars);
  scn.add(new THREE.HemisphereLight(0xc8dcff, 0x4a4234, .75)); const sun = new THREE.DirectionalLight(0xffe0b8, 3.2); sun.position.copy(sd).multiplyScalar(500); scn.add(sun); scn.add(sun.target);
  const eng = new THREE.PointLight(0xffa860, 0, 900, 1.3); scn.add(eng);
  if (ctx.env) new THREE.TextureLoader().load('models/tex/hd/sky_earth.webp', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scn.environment = t; scn.environmentIntensity = .7; }, undefined, () => {});
  // ---- Kennedy: marsh, the Atlantic to the east, the pad, the VAB on the horizon
  const ground = new THREE.Group(); scn.add(ground);
  { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#5d6a3a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${60 + Math.random() * 60},${70 + Math.random() * 50},${30 + Math.random() * 30},.35)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 6); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.colorSpace = THREE.SRGBColorSpace;
    const land = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshStandardMaterial({ map: t, roughness: 1 })); land.rotation.x = -Math.PI / 2; ground.add(land);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 14000), new THREE.MeshStandardMaterial({ color: 0x2c5878, roughness: .12, metalness: .2 })); sea.rotation.x = -Math.PI / 2; sea.position.set(1500 + 4500, .3, 0); ground.add(sea);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(60, 14000), new THREE.MeshStandardMaterial({ color: 0xd8caa0, roughness: 1 })); beach.rotation.x = -Math.PI / 2; beach.position.set(1480, .2, 0); ground.add(beach);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(58, 64, 5, 8), new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: .95 })); pad.position.y = 2.5; ground.add(pad);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(14, 5.2, 120), new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 1 })); trench.position.y = 2.6; ground.add(trench);
    for (const [x, z, h] of [[-38, 30, 22], [40, -34, 18], [-44, -40, 26], [36, 42, 20]]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(.4, .6, h * 4, 6), new THREE.MeshStandardMaterial({ color: 0x9a9a96, metalness: .6, roughness: .5 })); tw.position.set(x, h * 2, z); ground.add(tw); }   // lightning masts
    const wt = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: .6 })); wt.position.set(-180, 70, 140); ground.add(wt); const wl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 62, 8), wt.material); wl.position.set(-180, 31, 140); ground.add(wl); }   // water tower for the deluge
  const fit = (url, h, place) => ctx.loader.load(url, gl => { const m = gl.scene; if (ctx.fixMat) ctx.fixMat(m); const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()), k = h / Math.max(s.y, .001); m.scale.setScalar(k); const b2 = new THREE.Box3().setFromObject(m); m.position.y -= b2.min.y; place(m, b2); ground.add(m); }, undefined, () => {});
  fit('models/nasa/vehicle-assembly-building-vab.glb', 160, (m, b) => { m.position.x += -1700 - (b.min.x + b.max.x) / 2; m.position.z += -2600 - (b.min.z + b.max.z) / 2; });
  // the mobile launcher: a deck the rocket stands on, and a 118 m lattice tower with the crew access arm and umbilicals
  { const steel = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: .55, metalness: .6 }), G = [], box = (w, h, d, x, y, z, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx || rz) g.applyEuler ? null : 0; const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)).setPosition(x, y, z); g.applyMatrix4(m); G.push(g); };
    box(52, 7.5, 40, 0, 8.75, 0);                                                                                  // deck
    const tx = -21, H = 118, w = 11; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.9, H, .9, tx + dx * w / 2, 12.5 + H / 2, dz * w / 2);
    for (let y = 12.5; y < 12.5 + H; y += 6) { box(w, .5, .5, tx, y, w / 2); box(w, .5, .5, tx, y, -w / 2); box(.5, .5, w, tx + w / 2, y, 0); box(.5, .5, w, tx - w / 2, y, 0); box(.32, Math.hypot(w, 6), .32, tx, y + 3, w / 2, 0, Math.atan2(w, 6)); box(.32, Math.hypot(w, 6), .32, tx, y + 3, -w / 2, 0, -Math.atan2(w, 6)); box(.32, Math.hypot(w, 6), .32, tx + w / 2, y + 3, 0, Math.atan2(w, 6), 0); }
    for (const [y, len] of [[88, 15], [70, 13], [45, 14], [30, 14]]) box(len, 2.4, 2.4, tx + w / 2 + len / 2, y, 0);   // crew access arm and umbilical arms
    box(14, 3, 14, tx, 12.5 + H + 1.5, 0); box(.6, 22, .6, tx, 12.5 + H + 14, 0);                                   // top deck and lightning rod
    const tower = new THREE.Mesh(mergeGeometries(G), steel); tower.castShadow = true; ground.add(tower); }
  // ---- the rocket (stages as separate parts)
  const rkt = new THREE.Group(); rkt.position.set(0, 12.5, 0); scn.add(rkt); const P = {}, mats = { core: new THREE.MeshStandardMaterial({ color: 0xc66a2e, roughness: .82 }), srb_l: new THREE.MeshStandardMaterial({ color: 0xeeeee8, roughness: .5 }), upper: new THREE.MeshStandardMaterial({ color: 0xe9e9e3, roughness: .45, metalness: .05 }) }; mats.srb_r = mats.srb_l;
  ctx.loader.load('models/nasa/sls-stages.glb', gl => { gl.scene.traverse(n => { if (n.isMesh) { n.geometry.computeVertexNormals(); n.material = mats[n.name] || mats.upper; n.castShadow = true; } }); for (const n of ['srb_l', 'srb_r', 'core', 'upper']) { const o = gl.scene.getObjectByName(n); if (o) { const g = new THREE.Group(); o.position.set(0, 0, 0); o.updateMatrixWorld(true); const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); o.position.copy(c).negate(); g.position.copy(c); g.add(o); rkt.add(g); P[n] = g; } }   /* each stage pivots about its own centre when it tumbles away */ fallback.visible = false; }, undefined, () => {});
  const fallback = new THREE.Group(); rkt.add(fallback); { const c = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 65, 24), mats.core); c.position.y = 32.5; fallback.add(c); for (const x of [6.3, -6.3]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 54, 16), mats.srb_l); s.position.set(x, 27, 0); fallback.add(s); } const u = new THREE.Mesh(new THREE.ConeGeometry(4, 33, 24), mats.upper); u.position.y = 81; fallback.add(u); }
  // engines: four RS-25 under the core, one nozzle per booster, one RL10 on the upper stage
  const mkPlume = (col, dia, x, y, z, r, len, par) => { const geo = new THREE.CylinderGeometry(r * .55, r * 1.6, 1, 20, 6, true); geo.translate(0, -.5, 0); const m = new THREE.Mesh(geo, plumeMat(col, dia)); m.position.set(x, y, z); m.scale.set(1, len, 1); m.userData.len = len; m.frustumCulled = false; (par || rkt).add(m); return m; };
  const rs25 = [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]].map(([x, z]) => mkPlume(0xa8c8ff, 1, x, .2, z, 1.1, 34));
  const srbF = [6.25, -6.25].map(x => mkPlume(0xffc070, 1, x, -1, 0, 1.9, 70)), rl10 = mkPlume(0xb8d0ff, 0, 0, 64.4, 0, .9, 12);
  const smoke = makeFX(scn, 5000, false), fire = makeFX(scn, 2600, true), vap = makeFX(scn, 1500, false);
  const vcone = new THREE.Mesh(new THREE.ConeGeometry(14, 26, 32, 1, true), new THREE.ShaderMaterial({ uniforms: { k: { value: 0 }, time: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float k, time; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e = 1. - abs(dot(normalize(vN), normalize(vV))), n = .6 + .4 * sin(vUv.x * 60. + time * 9.) * sin(vUv.y * 13. - time * 5.); gl_FragColor = vec4(vec3(.96), k * e * n * smoothstep(0., .25, vUv.y) * smoothstep(1., .55, vUv.y) * .8); }' }));
  vcone.rotation.x = Math.PI; vcone.position.y = 52; rkt.add(vcone);   // the Prandtl–Glauert condensation cloud around Max-Q
  // Earth seen from the edge of space (built when needed)
  let earth = null; const mkEarth = () => { if (earth) return; earth = new THREE.Group(); const R = 6000, em = new THREE.MeshStandardMaterial({ map: ctx.earthMap || null, roughness: .9, color: ctx.earthMap ? 0xffffff : 0x2a5a9a }), m = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), em); earth.add(m);
    new THREE.TextureLoader().load('models/tex/hd/earth_4k.webp', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; em.map = t; em.color.set(0xffffff); em.needsUpdate = true; }, undefined, () => {});   /* the HD pack's 4K Blue Marble */
    if (ctx.cloudMap) { const c = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 96, 64), new THREE.MeshStandardMaterial({ alphaMap: ctx.cloudMap, color: 0xffffff, transparent: true, depthWrite: false, roughness: 1 })); earth.add(c); }
    const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.018, 96, 64), new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, uniforms: { sd: { value: sd } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 sd; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float f = pow(1. - abs(dot(normalize(vN), v)), 3.); gl_FragColor = vec4(vec3(.35, .6, 1.) * f * 1.6 * (.3 + .7 * max(dot(-normalize(vN), sd), 0.)), f); }' }));
    earth.add(atm); m.rotation.set(.3, 2.1, 0); scn.add(earth); };
  // ---- overlay: countdown, event captions, telemetry, skip
  const ov = document.createElement('div'); ov.id = 'aLaunch'; ov.innerHTML = `<style>#aLaunch{position:absolute;inset:0;z-index:9;pointer-events:none;font-family:var(--disp,system-ui);color:#fff}
    #aLaunch .cd{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font:200 clamp(64px,14vw,150px)/1 var(--disp,system-ui);letter-spacing:.04em;text-shadow:0 0 40px rgba(0,0,0,.5);opacity:0;transition:opacity .25s}
    #aLaunch .ev{position:absolute;left:50%;bottom:18%;transform:translateX(-50%);font:600 clamp(12px,2vw,16px)/1.2 var(--disp,system-ui);letter-spacing:.42em;text-transform:uppercase;opacity:0;transition:opacity .5s;text-shadow:0 1px 8px rgba(0,0,0,.8);white-space:nowrap}
    #aLaunch .tm{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(14px,4vw,46px);font:500 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.12em;opacity:.92;text-shadow:0 1px 4px #000}
    #aLaunch .tm b{display:block;font:300 clamp(15px,2.6vw,22px)/1.1 var(--disp,system-ui);letter-spacing:.04em}
    #aLaunch .tl{position:absolute;left:calc(18px + env(safe-area-inset-left));top:calc(16px + env(safe-area-inset-top));font:600 10px var(--disp,system-ui);letter-spacing:.3em;opacity:.8}
    #aLaunch .sk{pointer-events:auto;position:absolute;right:calc(14px + env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top));background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:999px;padding:7px 14px;font:600 12px var(--disp,system-ui);letter-spacing:.08em}
    #aLaunch .fd{position:absolute;inset:0;background:#000;opacity:1;transition:opacity 1.2s}#aLaunch .fd.w{background:#fff}</style>
    <div class="fd"></div><div class="tl">KENNEDY SPACE CENTER · LAUNCH COMPLEX 39B</div><div class="cd"></div><div class="ev"></div>
    <div class="tm"><div>MISSION TIME<b id="lT">T−00:10</b></div><div>ALTITUDE<b id="lA">0.0 km</b></div><div>SPEED<b id="lV">0 km/h</b></div></div><button class="sk">Skip launch</button>`;
  root.appendChild(ov); const $ = q => ov.querySelector(q); setTimeout(() => { $('.fd').style.opacity = 0; }, 60);
  $('.sk').onclick = () => finish(true);
  const ev = (txt, ms = 2600) => { const e = $('.ev'); e.textContent = txt; e.style.opacity = 1; clearTimeout(e._t); e._t = setTimeout(() => e.style.opacity = 0, ms); };
  const fired = new Set(), once = (k, f) => { if (!fired.has(k)) { fired.add(k); f(); } };
  // ---- motion state
  const S = { y: 0, x: 0, vy: 0, tilt: 0, vel: new THREE.Vector3(), lift: 9.8, srb: null, core: null };
  const sep = [];   // separated parts: { g, v, w }
  function detach(g, v, w) { if (!g) return; scn.attach(g); sep.push({ g, v, w }); }
  let prevPos = new THREE.Vector3();
  function step(dt) { if (L.done) return; L.t += dt; const t = L.t, T = missionT(t), lt = t - S.lift;
    // countdown digits, callouts
    const cd = $('.cd'); if (t < S.lift) { const n = Math.ceil(-T); cd.textContent = n > 0 ? n : ''; cd.style.opacity = n > 0 && n <= 10 ? 1 : 0; } else cd.style.opacity = 0;
    if (t > .4) once('c10', () => ctx.say('T minus ten.', 1)); if (t > 3.5) once('go', () => ev('Go for launch')); if (t > 6.6) once('mes', () => { ev('Main engine start'); ctx.say('Main engine start.', 1); ctx.sfx('burst'); });
    if (t > S.lift) once('lo', () => { ev('Lift-off', 3200); ctx.say('Booster ignition, and lift-off!', 1); ctx.sfx('liftoff'); }); if (t > 21.5) once('mq', () => { ev('Max-Q · maximum aerodynamic pressure'); ctx.say('Through max Q.', 1); });
    if (t > 27) once('srb', () => { ev('Booster separation'); ctx.say('Booster separation confirmed.', 1); ctx.sfx('burst'); S.srb = t; ['srb_l', 'srb_r'].forEach((n, i) => { detach(P[n], new THREE.Vector3((i ? -1 : 1) * 9, -6, 0), new THREE.Vector3(0, 0, (i ? 1 : -1) * .5)); }); srbF.forEach(p => p.visible = false); });
    if (t > 32) once('meco', () => { ev('Main engine cutoff · core stage separation'); ctx.say('Main engine cutoff. Core stage separation.', 1); S.core = t; rs25.forEach(p => p.visible = false); detach(P.core, new THREE.Vector3(0, -14, 0), new THREE.Vector3(.12, 0, .05)); });
    if (t > 33.4) once('rl10', () => { ev('Upper stage ignition'); ctx.say('Upper stage ignition.', 1); });
    if (t > 38) once('orbit', () => { ev('Orbit', 3000); ctx.say('Welcome to orbit.', 1); });
    // flight: slow and heavy at first, then faster and faster; pitch over toward the Atlantic
    if (t >= S.lift) { const a = 2.4 + lt * .55 + Math.max(0, lt - 6) * 2.2 + Math.max(0, lt - 12) * 7; S.vy += a * dt; S.tilt = clamp((lt - 4) * .055, 0, 1.25); S.y += S.vy * Math.cos(S.tilt) * dt; S.x += S.vy * Math.sin(S.tilt) * dt; }
    rkt.position.set(S.x, 12.5 + S.y, 0); rkt.rotation.set(0, 0, -S.tilt * .9); rkt.position.y += t > S.lift - 3 && t < S.lift + 2 ? (Math.random() - .5) * .08 : 0;
    const alt = clamp((S.y - 2500) / 40000, 0, 1), space = t > 26; SU.alt.value = Math.max(alt, space ? ss(t, 26, 30) : 0); if (!stars.material.map) { const st = typeof ctx.starTex === 'function' ? ctx.starTex() : ctx.starTex; if (st) { stars.material.map = st; stars.material.needsUpdate = true; } } stars.visible = !!stars.material.map; stars.material.opacity = SU.alt.value * .9; scn.fog.density = .00016 * (1 - SU.alt.value);
    // engines
    const k1 = t > 6.6 ? ss(t, 6.6, 7.6) : 0, k2 = t > S.lift - .2 ? ss(t, S.lift - .2, S.lift + .3) : 0, vac = clamp(S.y / 30000, 0, 1);
    for (const p of rs25) { p.material.uniforms.k.value = k1; p.material.uniforms.time.value = t; p.material.uniforms.vac.value = vac; p.scale.set(1 + vac * 2.5, p.userData.len * (1 + vac * 1.5), 1 + vac * 2.5); }
    for (const p of srbF) { p.material.uniforms.k.value = k2; p.material.uniforms.time.value = t; p.material.uniforms.vac.value = vac; p.scale.set(1 + vac * 3, p.userData.len * (1 + vac * 2), 1 + vac * 3); }
    rl10.material.uniforms.k.value = t > 33.4 ? ss(t, 33.4, 34) : 0; rl10.material.uniforms.time.value = t; rl10.material.uniforms.vac.value = 1;
    const wp = rkt.localToWorld(new THREE.Vector3(0, 0, 0)); eng.position.copy(wp).add(new THREE.Vector3(0, -12, 0)); eng.intensity = (k1 * 1.6 + k2 * 6) * (1 - SU.alt.value) * 900 * (S.srb ? .4 : 1);
    // pad: steam explodes out of the flame trench, then a towering exhaust column
    if (k1 > 0 && S.y < 400) { const n = Math.ceil((k1 * 6 + k2 * 14) * dt * 30); for (let i = 0; i < n; i++) { const s = Math.random() < .5 ? 1 : -1; smoke.emit(new THREE.Vector3((Math.random() - .5) * 10, 6, s * (40 + Math.random() * 20)), new THREE.Vector3((Math.random() - .5) * 18, 8 + Math.random() * 14, s * (30 + Math.random() * 40)), 0xf2f0ea, 14 + Math.random() * 10, 7 + Math.random() * 4, 1, 4, { grow: 4, drag: .45, a: .55, grav: -1.2 }); } }
    if (k2 > 0 && !S.srb) { const base = rkt.localToWorld(new THREE.Vector3(0, -6, 0)), dn = new THREE.Vector3(Math.sin(S.tilt * .9), -Math.cos(S.tilt * .9), 0); for (let i = 0; i < dt * 60; i++) { smoke.emit(base.clone().add(new THREE.Vector3((Math.random() - .5) * 14, 0, (Math.random() - .5) * 14)), dn.clone().multiplyScalar(30 + Math.random() * 20), 0xe6e2da, 8 + Math.random() * 6, 9, 1, 6, { grow: 3.4, drag: .9, a: .5 * (1 - SU.alt.value) }); fire.emit(base, dn.clone().multiplyScalar(90), 0xffb060, 5, .35, 1, 10, { grow: 2 }); } }
    if (t > 6.6 && t < S.lift + 1.5) for (let i = 0; i < 3; i++) fire.emit(new THREE.Vector3((Math.random() - .5) * 8, 7, (Math.random() - .5) * 8), new THREE.Vector3((Math.random() - .5) * 30, 10 + Math.random() * 20, (Math.random() - .5) * 30), 0xffd890, .6, .6, 1, 2, { grow: .6, grav: 9.8 });   // sparks from the hydrogen burn-off igniters
    // venting vapour during the countdown
    if (t < S.lift) for (let i = 0; i < 2; i++) vap.emit(rkt.localToWorld(new THREE.Vector3((Math.random() - .5) * 8, 30 + Math.random() * 30, 4.3)), new THREE.Vector3(1 + Math.random(), -1.5, 1.5), 0xffffff, 3, 3, 1, 1, { grow: 3, drag: .5, a: .35 });
    // Max-Q vapour cone
    vcone.material.uniforms.k.value = t > 20 && t < 24.5 ? Math.sin((t - 20) / 4.5 * Math.PI) : 0; vcone.material.uniforms.time.value = t;
    // separated stages fall away and tumble
    for (const s of sep) { s.g.position.addScaledVector(s.v, dt); s.v.y -= 2 * dt; s.g.rotation.x += s.w.x * dt; s.g.rotation.y += s.w.y * dt; s.g.rotation.z += s.w.z * dt; if (S.srb && t - S.srb < 1.2 && (s.g === P.srb_l || s.g === P.srb_r)) { const top = s.g.localToWorld(new THREE.Vector3(0, 24, 0)); fire.emit(top, new THREE.Vector3((s.g === P.srb_l ? 1 : -1) * 20, 0, 0), 0xffc080, 2.2, .4, 2, 3, { grow: 2.4 }); smoke.emit(top, new THREE.Vector3((s.g === P.srb_l ? 1 : -1) * 6, 0, 0), 0xdddddd, 3, 2, 1, 2, { grow: 3, a: .5 }); } }
    smoke.update(dt, cam); fire.update(dt, cam); vap.update(dt, cam);
    // the planet below appears when we leave the air
    if (space) { mkEarth(); ground.visible = false; scn.fog.density = 0; earth.position.set(rkt.position.x, rkt.position.y - 6000 - 320, 0); earth.children[0].rotation.y += dt * .01; }
    camera(dt, t, lt);
    // telemetry
    const [km, kmh] = prof(Math.max(0, T)), mm = Math.floor(Math.abs(T) / 60), sec = Math.floor(Math.abs(T) % 60);
    $('#lT').textContent = `T${T < 0 ? '−' : '+'}${String(mm).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; $('#lA').textContent = km.toFixed(1) + ' km'; $('#lV').textContent = Math.round(kmh).toLocaleString() + ' km/h';
    if (ctx.audio) ctx.audio({ eng: Math.min(1, k1 * .6 + k2) * (1 - SU.alt.value), boost: k2 * (S.srb ? 0 : 1) * (1 - SU.alt.value), wind: S.y > 300 && !space ? Math.min(1, S.vy / 300) : 0, dt });   // sound fades to silence in vacuum
    if (t > 41) finish(false);
  }
  // ---- cinematography: one shot per phase, with hard cuts like a real broadcast
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  function shot(pos, at, fov, dt, k = 1) { cam.position.lerp(pos, k >= 1 ? 1 : Math.min(1, dt * k)); look.lerp(at, k >= 1 ? 1 : Math.min(1, dt * k * 1.4)); cam.lookAt(look); if (Math.abs(cam.fov - fov) > .01) { cam.fov = fov; cam.updateProjectionMatrix(); } }
  function camera(dt, t, lt) { const r = rkt.position, mid = tmp.set(r.x, r.y + 45, r.z), shake = (a) => cam.position.add(new THREE.Vector3((Math.random() - .5) * a, (Math.random() - .5) * a, (Math.random() - .5) * a));
    if (t < 6.4) { const p = t / 6.4; look.set(0, 50, 0); shot(new THREE.Vector3(lerp(330, 250, p), lerp(30, 22, p), lerp(340, 260, p)), new THREE.Vector3(0, 48, 0), 30, dt, 1); }
    else if (t < S.lift + .8) { look.set(0, 18, 0); shot(new THREE.Vector3(78, 7, 92), new THREE.Vector3(0, 20, 0), 46, dt, 1); shake(t > S.lift - .3 ? .5 : .15); }
    else if (t < 15.5) { look.copy(r).add(new THREE.Vector3(0, 10, 0)); shot(new THREE.Vector3(-26, 112, 24), tmp.copy(r).add(new THREE.Vector3(0, 6, 0)), 62, dt, 1); shake(.25); }
    else if (t < 21) { const p = (t - 15.5) / 5.5; shot(new THREE.Vector3(1100, 40, 1500), mid, lerp(14, 4.2, p), dt, 1); shake(.6 * (1 - p)); }
    else if (t < 26) { shot(tmp.copy(r).add(new THREE.Vector3(70, 30, 95)), new THREE.Vector3(r.x, r.y + 40, r.z), 40, dt, 1); }
    else if (t < 31.5) { const q = rkt.localToWorld(new THREE.Vector3(10, 66, 14)); shot(q, rkt.localToWorld(new THREE.Vector3(0, -40, 0)), 58, dt, 1); }
    else { const p = rkt.localToWorld(new THREE.Vector3(0, 75, 0)); shot(p.clone().add(new THREE.Vector3(-30, 10, 45)), p.clone().add(new THREE.Vector3(70, -10, -15)), 52, dt, 1); }   /* along the flight path: the stage, the blue limb, black space */
    sky.position.copy(cam.position); stars.position.copy(cam.position); }
  function finish(skipped) { if (L.done) return; L.done = true; const fd = $('.fd'); fd.classList.add('w'); fd.style.transition = 'opacity .7s'; fd.style.opacity = 1;
    setTimeout(() => { ov.remove(); dispose(); ctx.onDone && ctx.onDone(skipped); }, skipped ? 80 : 750); }
  function dispose() { smoke.dispose(); fire.dispose(); vap.dispose(); scn.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  return { scn, step, finish, get t() { return L.t; } };
}
