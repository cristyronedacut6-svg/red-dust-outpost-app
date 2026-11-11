// Red Dust Outpost · launch from Earth: an SLS lift-off at Kennedy Space Center that starts every journey.
// Countdown at sunrise, RS-25 start and the steam cloud, booster ignition and lift-off, the long-lens tracking shot,
// the vapour cone at Max-Q, booster separation, core-stage cutoff and separation, upper-stage ignition, then orbit.
// The rocket is NASA's SLS Block 1 built procedurally to its real dimensions, with every stage able to separate.
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

// ---- canvas textures for the rocket and the pad
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const rnd = (a, b) => a + Math.random() * (b - a);
function texOf(c, srgb) { const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
// core stage: sprayed-on orange foam, mottled and streaked, weld seams, the ribbed intertank, darker engine section
function foamTex() { const W = 1024, H = 2048, L = 64.6, py = y => (1 - y / L) * H, [c, g] = cvs(W, H), [b, gb] = cvs(W, H);
  g.fillStyle = '#c4672a'; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const x = Math.random() * W, y = Math.random() * H, r = rnd(2, 22), l = Math.random() < .5; g.fillStyle = l ? `rgba(226,140,78,${rnd(.03, .1)})` : `rgba(120,52,18,${rnd(.03, .1)})`; g.beginPath(); g.ellipse(x, y, r * rnd(.6, 1.6), r, 0, 0, 7); g.fill();
    gb.fillStyle = `rgba(${l ? 255 : 0},${l ? 255 : 0},${l ? 255 : 0},${rnd(.02, .07)})`; gb.beginPath(); gb.arc(x, y, r * .6, 0, 7); gb.fill(); }
  for (let i = 0; i < 700; i++) { const x = Math.random() * W, y = Math.random() * H, h = rnd(30, 260); g.fillStyle = `rgba(90,40,14,${rnd(.02, .06)})`; g.fillRect(x, y, rnd(1, 3), h); }      // drips and spray streaks
  for (let k = 0; k < 8; k++) { const x = k * W / 8 + rnd(-8, 8); g.fillStyle = 'rgba(232,150,90,.22)'; g.fillRect(x, py(40), 3, py(7) - py(40)); gb.fillStyle = 'rgba(255,255,255,.4)'; gb.fillRect(x, py(40), 4, py(7) - py(40)); }   // closeout seams on the LH2 tank
  for (const y of [7, 11.5, 16, 20.5, 25, 29.5, 34, 40, 47, 51.5, 56, 62, 64.4]) { const big = [7, 40, 47, 62].includes(y); g.fillStyle = `rgba(96,40,12,${big ? .45 : .14})`; g.fillRect(0, py(y) - 1.5, W, 3); if (big) { gb.fillStyle = 'rgba(0,0,0,.35)'; gb.fillRect(0, py(y) - 2, W, 4); } }
  for (let x = 0; x < W; x += 8) { gb.fillStyle = 'rgba(255,255,255,.75)'; gb.fillRect(x, py(46.6), 4, py(40.4) - py(46.6)); g.fillStyle = 'rgba(80,34,10,.25)'; g.fillRect(x + 4, py(46.6), 2, py(40.4) - py(46.6)); }   // intertank stringers
  const eg = g.createLinearGradient(0, py(7), 0, H); eg.addColorStop(0, 'rgba(70,30,10,.25)'); eg.addColorStop(1, 'rgba(20,12,8,.85)'); g.fillStyle = eg; g.fillRect(0, py(7), W, H - py(7));   // soot-dark engine section
  return [texOf(c, true), texOf(b)]; }
// white paint (boosters, adapters, fairings): faint panel lines, grime and joints
function paintTex(L, joints, dark) { const W = 512, H = 1024, py = y => (1 - y / L) * H, [c, g] = cvs(W, H), [b, gb] = cvs(W, H);
  g.fillStyle = '#f1f0eb'; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd(120, 180)},${rnd(115, 170)},${rnd(105, 160)},${rnd(.015, .05)})`; g.fillRect(Math.random() * W, Math.random() * H, rnd(1, 3), rnd(6, 80)); }
  for (const y of joints) { g.fillStyle = 'rgba(70,70,70,.65)'; g.fillRect(0, py(y) - 3, W, 6); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, py(y) - 6, W, 2); gb.fillStyle = 'rgba(255,255,255,.9)'; gb.fillRect(0, py(y) - 5, W, 10); }
  for (const [a, z] of dark || []) { g.fillStyle = '#1b1b1d'; g.fillRect(0, py(z), W, py(a) - py(z)); }
  for (let x = 0; x < W; x += W / 6) { g.fillStyle = 'rgba(150,150,150,.25)'; g.fillRect(x, 0, 1.5, H); }
  return [texOf(c, true), texOf(b)]; }
// a body of revolution with real UVs: u around, v = height (so the textures land where they belong)
function lathe(pts, seg = 96) { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), p = g.attributes.position, uv = g.attributes.uv; let a = 1e9, b = -1e9; for (let i = 0; i < p.count; i++) { a = Math.min(a, p.getY(i)); b = Math.max(b, p.getY(i)); } for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) - a) / (b - a)); return g; }
function bell(y0, len, rt, re, seg = 64) { const P = []; for (let i = 0; i <= 24; i++) { const t = i / 24; P.push([rt + (re - rt) * (1 - Math.pow(1 - t, 2.1)), y0 - t * len]); } return lathe(P.reverse(), seg); }
// ---- NASA's SLS Block 1 (Artemis I configuration), built to its real dimensions: 98 m tall, core stage 8.4 m across, boosters 3.7 m
function buildSLS(rkt) { const P = {}, [ft, fb] = foamTex(), [st, sb] = paintTex(54, [12.2, 21.0, 29.8, 38.6, 47.2], [[47.4, 48.1], [1.6, 3.2]]), [ut, ub] = paintTex(34, [8.6, 10, 16, 21.8]);
  const M = { foam: new THREE.MeshStandardMaterial({ map: ft, bumpMap: fb, bumpScale: .45, roughness: .88 }), srb: new THREE.MeshStandardMaterial({ map: st, bumpMap: sb, bumpScale: 1.2, roughness: .5 }),
    white: new THREE.MeshStandardMaterial({ map: ut, bumpMap: ub, bumpScale: 1, roughness: .42 }), grey: new THREE.MeshStandardMaterial({ color: 0x8d8f93, roughness: .5, metalness: .4 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x5b5450, roughness: .38, metalness: .85, side: THREE.DoubleSide }), srbN: new THREE.MeshStandardMaterial({ color: 0x2c2b2b, roughness: .7, metalness: .2, side: THREE.DoubleSide }),
    silver: new THREE.MeshStandardMaterial({ color: 0xd2d5da, roughness: .28, metalness: .9 }), dark: new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: .6, metalness: .3 }) };
  const part = (name, build) => { const inner = new THREE.Group(); build(inner); inner.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); const c = new THREE.Box3().setFromObject(inner).getCenter(new THREE.Vector3()), g = new THREE.Group(); inner.position.copy(c).negate(); g.position.copy(c); g.add(inner); rkt.add(g); P[name] = g; return g; };
  const add = (par, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  // core stage with the four RS-25s, the LOX feedlines and the launch vehicle stage adapter (which leaves with the core)
  part('core', g => { add(g, lathe([[0, 3.6], [3.3, 3.6], [3.55, 4.5], [3.95, 5.7], [4.2, 6.9], [4.2, 64.6], [0, 64.6]], 128), M.foam);
    add(g, new THREE.CircleGeometry(3.3, 48).rotateX(Math.PI / 2), M.dark, 0, 3.58, 0);
    for (const [x, z] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) { add(g, bell(3.5, 3.2, .34, 1.15), M.nozzle, x, 0, z); add(g, new THREE.CylinderGeometry(.55, .45, .9, 24), M.grey, x, 3.7, z); }
    for (const a of [1.32, 1.82]) { const x = Math.cos(a) * 4.45, z = Math.sin(a) * 4.45; add(g, new THREE.CylinderGeometry(.27, .27, 40, 16), M.foam, x, 27, z); add(g, new THREE.CylinderGeometry(.34, .34, .5, 16), M.grey, x, 46.8, z); }   // LOX feedlines down the outside
    add(g, new THREE.BoxGeometry(.5, 56, .7), M.foam, 0, 35, -4.3);   // systems tunnel
    add(g, lathe([[4.2, 64.6], [4.2, 65.4], [2.78, 73.2], [2.6, 73.2]], 128), M.white); });
  // the two five-segment boosters, with aft skirts, nozzles, nose cones, systems tunnels and attach struts
  for (const [n, sx] of [['srb_l', 6.3], ['srb_r', -6.3]]) part(n, g => { add(g, lathe([[0, .9], [1.0, .9], [2.6, .6], [2.55, 1.6], [2.2, 2.6], [1.86, 3.4], [1.86, 47.4], [1.8, 49.5], [1.55, 51.5], [1.1, 53], [.45, 53.8], [.2, 54], [0, 54.05]], 96), M.srb, sx, 0, 0);
    add(g, bell(1.0, 1.95, .7, 1.42, 48), M.srbN, sx, 0, 0); add(g, new THREE.BoxGeometry(.35, 43, .5), M.srb, sx + Math.sign(sx) * 1.95, 25.5, 0);
    for (const y of [6.6, 7.6]) add(g, new THREE.CylinderGeometry(.14, .14, 2.3, 8).rotateZ(Math.PI / 2), M.grey, sx - Math.sign(sx) * 2.95, y, y > 7 ? .7 : -.7);
    add(g, new THREE.BoxGeometry(2.4, .6, .9), M.grey, sx - Math.sign(sx) * 2.9, 44.5, 0);
    for (const z of [-1, 1]) add(g, new THREE.BoxGeometry(.4, 1.2, .5), M.dark, sx + Math.sign(sx) * .2, 50.3, z * 1.7); });   // separation motors
  // the upper stack: ICPS (hidden in the adapter until the core stage leaves), Orion stage adapter, service module, crew module
  part('upper', g => { add(g, lathe([[2.55, 65.6], [2.55, 72.9], [0, 73.0]], 96), M.white); add(g, bell(65.8, 1.6, .25, .75, 48), M.nozzle);
    add(g, lathe([[2.6, 73.2], [2.68, 74.6]], 96), M.grey); add(g, new THREE.CylinderGeometry(2.48, 2.48, 4.4, 64), M.silver, 0, 76.9, 0);
    add(g, lathe([[2.5, 79.2], [2.52, 80.5], [1.0, 83.6], [.6, 83.8]], 96), M.silver); });
  // the three service module fairing panels, then the launch abort system: boost protective cover and the tower
  for (let i = 0; i < 3; i++) part('fair' + i, g => { const geo = new THREE.CylinderGeometry(2.78, 2.78, 5.9, 32, 1, true, i * Math.PI * 2 / 3 + .02, Math.PI * 2 / 3 - .04); add(g, geo, M.white, 0, 77.6, 0); });
  part('las', g => { add(g, lathe([[2.8, 80.5], [2.8, 80.9], [2.2, 82.6], [1.5, 84.6], [.9, 86.6], [.62, 87.6], [.55, 88], [.55, 93.4], [.5, 93.5], [.5, 95.4], [.42, 96.2], [.2, 97.5], [0, 98]], 96), M.white);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, m = add(g, bell(0, .9, .14, .3, 20), M.dark, Math.cos(a) * .7, 89.4, Math.sin(a) * .7); m.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); }
    add(g, new THREE.CylinderGeometry(.56, .56, .35, 24), M.dark, 0, 93.5, 0); });
  return P; }
// ---- billowing smoke and steam: camera-facing puffs from a 4-variant cauliflower texture, lit by the Sun on one side and by the engines from below
function puffTex() { const S = 512, [c, g] = cvs(S, S);
  for (let v = 0; v < 4; v++) { const ox = (v % 2) * 256, oy = Math.floor(v / 2) * 256; for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, d = Math.pow(Math.random(), .7) * 70, x = ox + 128 + Math.cos(a) * d, y = oy + 128 + Math.sin(a) * d * .9, r = rnd(26, 58) * (1 - d / 140);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(.6, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; return t; }
function makeSmoke(scene, max) { const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const A = (n, k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * k), k); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; };
  const aP = A('ip', 3), aC = A('ic', 3), aD = A('id', 4);   // id: size, alpha, rotation, heat*4+variant
  const U = { map: { value: puffTex() }, sunV: { value: new THREE.Vector3() }, sunC: { value: new THREE.Color(1.5, 1.32, 1.1) }, amb: { value: new THREE.Color(.52, .58, .68) }, glow: { value: new THREE.Color(1, .42, .1) } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 ip, ic; attribute vec4 id; varying vec2 vUv; varying vec3 vC; varying float vA, vH; varying vec2 vR;
      void main(){ float r = id.z, v = mod(id.w, 4.); vH = floor(id.w / 4.) / 64.; vec2 q = position.xy; vR = vec2(cos(r) * q.x - sin(r) * q.y, sin(r) * q.x + cos(r) * q.y);
        vUv = (uv + vec2(mod(v, 2.), floor(v / 2.))) * .5; vC = ic; vec4 mv = modelViewMatrix * vec4(ip, 1.); vA = id.y * smoothstep(1., 8., -mv.z); mv.xy += vR * id.x; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunV, sunC, amb, glow; varying vec2 vUv; varying vec3 vC; varying float vA, vH; varying vec2 vR;
      void main(){ vec4 t = texture2D(map, vUv); float a = t.a * vA; if (a < .004) discard; vec2 p = vR * 2.; vec3 n = normalize(vec3(p, sqrt(max(.05, 1. - dot(p, p))) + (t.a - .5)));
        float l = clamp(dot(n, sunV) * .6 + .45, 0., 1.), lb = clamp(-n.y * .6 + .4, 0., 1.);
        vec3 c = vC * (amb + sunC * l) + glow * vH * (3. + 5. * lb); gl_FragColor = vec4(c, min(a, 1.)); }` });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 4; scene.add(mesh);
  const Q = []; let head = 0; for (let i = 0; i < max; i++) Q.push({ life: 0 }); const tc = new THREE.Color(), sv = new THREE.Vector3();
  function emit(p, v, color, size, life, n = 1, spread = 0, o = {}) { tc.set(color); for (let k = 0; k < n; k++) { const q = Q[head]; head = (head + 1) % max;
      q.x = p.x; q.y = p.y; q.z = p.z; q.vx = v.x + (Math.random() - .5) * spread; q.vy = v.y + (Math.random() - .5) * spread; q.vz = v.z + (Math.random() - .5) * spread;
      q.r = tc.r; q.g = tc.g; q.b = tc.b; q.s0 = size * (.7 + Math.random() * .6); q.grow = o.grow || 1; q.life = q.max = life * (.7 + Math.random() * .6); q.grav = o.grav || 0; q.drag = o.drag ?? .6; q.a = o.a ?? 1; q.rot = Math.random() * 6.283; q.wr = (Math.random() - .5) * .4; q.heat = o.heat || 0; q.var = Math.floor(Math.random() * 4); } }
  function update(dt, cam, sunDir) { if (cam && sunDir) U.sunV.value.copy(sunDir).transformDirection(cam.matrixWorldInverse); let n = 0;
    for (let i = 0; i < max; i++) { const q = Q[i]; if (q.life <= 0) continue; q.life -= dt; if (q.life <= 0) continue; const k = q.life / q.max, age = 1 - k, dr = Math.pow(1 - Math.min(.99, q.drag), dt);
      q.vx *= dr; q.vy = q.vy * dr - q.grav * dt; q.vz *= dr; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 1) { q.y = 1; q.vy = Math.abs(q.vy) * .2; } q.rot += q.wr * dt;
      aP.array[n * 3] = q.x; aP.array[n * 3 + 1] = q.y; aP.array[n * 3 + 2] = q.z; aC.array[n * 3] = q.r; aC.array[n * 3 + 1] = q.g; aC.array[n * 3 + 2] = q.b;
      const h = Math.min(63, Math.floor(q.heat * Math.exp(-age * 5) * 63)); aD.array[n * 4] = q.s0 * (1 + age * (q.grow - 1)); aD.array[n * 4 + 1] = q.a * Math.min(1, k * 2.2) * Math.min(1, age * 12); aD.array[n * 4 + 2] = q.rot; aD.array[n * 4 + 3] = h * 4 + q.var; n++; }
    g.instanceCount = n; mesh.visible = n > 0; if (n) { aP.needsUpdate = aC.needsUpdate = aD.needsUpdate = true; aP.updateRanges && aP.clearUpdateRanges && (aP.clearUpdateRanges(), aP.addUpdateRange(0, n * 3), aC.clearUpdateRanges(), aC.addUpdateRange(0, n * 3), aD.clearUpdateRanges(), aD.addUpdateRange(0, n * 4)); } }
  return { emit, update, dispose() { scene.remove(mesh); g.dispose(); mat.dispose(); U.map.value.dispose(); } };
}
// ---- Launch Complex 39B: scrubland and marsh, the Atlantic with real wave normals, the crawlerway, the hardstand and flame trench, three lightning towers and their catenary wires
function buildPad(ground, steelMat) { const [gc, gg] = cvs(1024, 1024); gg.fillStyle = '#56633a'; gg.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 16000; i++) { const t = Math.random(); gg.fillStyle = t < .45 ? `rgba(${rnd(70, 110)},${rnd(85, 115)},${rnd(40, 60)},.3)` : t < .8 ? `rgba(${rnd(110, 150)},${rnd(115, 135)},${rnd(70, 90)},.22)` : `rgba(${rnd(35, 55)},${rnd(50, 70)},${rnd(30, 40)},.35)`; gg.fillRect(Math.random() * 1024, Math.random() * 1024, rnd(2, 10), rnd(2, 10)); }
  const gt = texOf(gc, true); gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(380, 380);
  const land = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); land.rotation.x = -Math.PI / 2; land.receiveShadow = true; ground.add(land);
  for (let i = 0; i < 26; i++) { const r = rnd(120, 1300), a = rnd(0, 6.283), x = Math.cos(a) * r, z = Math.sin(a) * r; if (x > 1300 || Math.hypot(x, z) < 160) continue; const m = new THREE.Mesh(new THREE.CircleGeometry(rnd(20, 90), 24), new THREE.MeshStandardMaterial({ color: 0x29404a, roughness: .15, metalness: .1 })); m.rotation.x = -Math.PI / 2; m.scale.y = rnd(.4, 1); m.position.set(x, .15, z); ground.add(m); }   // marsh ponds
  const seaM = new THREE.MeshStandardMaterial({ color: 0x1f4c68, roughness: .07, metalness: .05 }), sea = new THREE.Mesh(new THREE.PlaneGeometry(40000, 60000), seaM); sea.rotation.x = -Math.PI / 2; sea.position.set(21500, .3, 0); ground.add(sea);
  new THREE.TextureLoader().load('models/tex/hd/waternormals.webp', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(600, 900); seaM.normalMap = t; seaM.normalScale.set(.7, .7); seaM.needsUpdate = true; }, undefined, () => {});
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(70, 60000), new THREE.MeshStandardMaterial({ color: 0xd8caa0, roughness: 1 })); beach.rotation.x = -Math.PI / 2; beach.position.set(1480, .2, 0); ground.add(beach);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(14, 60000), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 })); surf.rotation.x = -Math.PI / 2; surf.position.set(1518, .35, 0); ground.add(surf);   // breaking surf line
  // concrete: hardstand, ramp and the crawlerway toward the Vehicle Assembly Building
  const [cc, cg] = cvs(512, 512); cg.fillStyle = '#9b9890'; cg.fillRect(0, 0, 512, 512); for (let i = 0; i < 5000; i++) { cg.fillStyle = `rgba(${rnd(60, 160)},${rnd(60, 155)},${rnd(55, 145)},.18)`; cg.fillRect(Math.random() * 512, Math.random() * 512, rnd(1, 5), rnd(1, 5)); } for (let k = 0; k < 512; k += 64) { cg.fillStyle = 'rgba(40,40,40,.35)'; cg.fillRect(k, 0, 2, 512); cg.fillRect(0, k, 512, 2); }
  const ct = texOf(cc, true); ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(6, 6); const conc = new THREE.MeshStandardMaterial({ map: ct, roughness: .95 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(60, 72, 5, 64), conc); pad.position.y = 2.5; pad.receiveShadow = pad.castShadow = true; ground.add(pad);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(14, 5.3, 132), new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 1 })); trench.position.y = 2.6; ground.add(trench);
  const dir = new THREE.Vector3(-1700, 0, -2600).normalize(), ang = Math.atan2(dir.x, dir.z), [rc, rg] = cvs(256, 256); rg.fillStyle = '#b5a99a'; rg.fillRect(0, 0, 256, 256); for (let i = 0; i < 6000; i++) { rg.fillStyle = `rgba(${rnd(120, 200)},${rnd(110, 180)},${rnd(100, 170)},.4)`; rg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const rt = texOf(rc, true); rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(2, 120); const rock = new THREE.MeshStandardMaterial({ map: rt, roughness: 1 });   // Alabama river rock, as on the real crawlerway
  for (const off of [-13.5, 13.5]) { const lane = new THREE.Mesh(new THREE.PlaneGeometry(12, 3000), rock); lane.rotation.order = 'YXZ'; lane.rotation.set(-Math.PI / 2, ang, 0); const c = dir.clone().multiplyScalar(1580); lane.position.set(c.x + Math.cos(ang) * off, .25, c.z - Math.sin(ang) * off); ground.add(lane); }
  // three 180 m lightning towers with catenary wires, like the real system around Pad 39B
  const T = [[-270, 160], [290, -70], [-40, -300]], G = [], box = (w, h, d, x, y, z, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)).setPosition(x, y, z)); G.push(g); };
  for (const [x, z] of T) { const H = 180; for (let y = 0; y < H; y += 9) { const w = 7 - y / H * 4, w2 = 7 - (y + 9) / H * 4; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.5, 9.2, .5, x + dx * (w + w2) / 4, y + 4.5, z + dz * (w + w2) / 4);
      box(w2, .3, .3, x, y + 9, z + w2 / 2); box(w2, .3, .3, x, y + 9, z - w2 / 2); box(.3, .3, w2, x + w2 / 2, y + 9, z); box(.3, .3, w2, x - w2 / 2, y + 9, z); box(.2, Math.hypot(w, 9), .2, x, y + 4.5, z + w / 2, 0, Math.atan2(w, 9)); box(.2, Math.hypot(w, 9), .2, x + w / 2, y + 4.5, z, Math.atan2(w, 9), 0); } }
  const towers = new THREE.Mesh(mergeGeometries(G), steelMat); towers.castShadow = true; ground.add(towers);
  const mast = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: .6 }); for (const [x, z] of T) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .9, 24, 10), mast); m.position.set(x, 192, z); ground.add(m); }
  const wire = [], cat = (a, b, sag) => { for (let i = 0; i < 24; i++) { const t0 = i / 24, t1 = (i + 1) / 24; for (const t of [t0, t1]) { const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); wire.push(p); } } };
  const tops = T.map(([x, z]) => new THREE.Vector3(x, 202, z)); for (let i = 0; i < 3; i++) cat(tops[i], tops[(i + 1) % 3], 40); for (const t of tops) { const out = t.clone().setY(0).normalize().multiplyScalar(320); out.y = 2; cat(t, out, 25); }
  const wl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x3a3c40, transparent: true, opacity: .8 })); ground.add(wl);
  // water tower for the sound suppression deluge
  const wt = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 20), new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: .5 })); wt.position.set(-230, 78, 190); wt.castShadow = true; ground.add(wt); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .6, l = new THREE.Mesh(new THREE.CylinderGeometry(.6, .8, 72, 8), steelMat); l.position.set(-230 + Math.cos(a) * 6, 36, 190 + Math.sin(a) * 6); ground.add(l); }
  return { sea: seaM }; }

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
  scn.add(new THREE.HemisphereLight(0xc8dcff, 0x4a4234, .75)); const sun = new THREE.DirectionalLight(0xffe0b8, 3.2); sun.position.copy(sd).multiplyScalar(500); scn.add(sun); scn.add(sun.target); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); { const c = sun.shadow.camera; c.left = c.bottom = -95; c.right = c.top = 95; c.near = 1; c.far = 1500; } sun.shadow.bias = -.0005; sun.shadow.normalBias = .05;
  const eng = new THREE.PointLight(0xffa860, 0, 900, 1.3); scn.add(eng);
  if (ctx.env) new THREE.TextureLoader().load('models/tex/hd/sky_earth.webp', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scn.environment = t; scn.environmentIntensity = .7; }, undefined, () => {});
  // ---- Kennedy: marsh, the Atlantic to the east, the pad, the VAB on the horizon
  const ground = new THREE.Group(); scn.add(ground);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: .55, metalness: .6 }), PAD = buildPad(ground, steel);
  const fit = (url, h, place) => ctx.loader.load(url, gl => { const m = gl.scene; if (ctx.fixMat) ctx.fixMat(m); const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()), k = h / Math.max(s.y, .001); m.scale.setScalar(k); const b2 = new THREE.Box3().setFromObject(m); m.position.y -= b2.min.y; place(m, b2); ground.add(m); }, undefined, () => {});
  fit('models/nasa/vehicle-assembly-building-vab.glb', 160, (m, b) => { m.position.x += -1700 - (b.min.x + b.max.x) / 2; m.position.z += -2600 - (b.min.z + b.max.z) / 2; });
  // the mobile launcher: a deck the rocket stands on, and a 118 m lattice tower with the crew access arm and umbilicals
  { const G = [], box = (w, h, d, x, y, z, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx || rz) g.applyEuler ? null : 0; const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)).setPosition(x, y, z); g.applyMatrix4(m); G.push(g); };
    box(52, 7.5, 40, 0, 8.75, 0);                                                                                  // deck
    const tx = -21, H = 118, w = 11; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.9, H, .9, tx + dx * w / 2, 12.5 + H / 2, dz * w / 2);
    for (let y = 12.5; y < 12.5 + H; y += 6) { box(w, .5, .5, tx, y, w / 2); box(w, .5, .5, tx, y, -w / 2); box(.5, .5, w, tx + w / 2, y, 0); box(.5, .5, w, tx - w / 2, y, 0); box(.32, Math.hypot(w, 6), .32, tx, y + 3, w / 2, 0, Math.atan2(w, 6)); box(.32, Math.hypot(w, 6), .32, tx, y + 3, -w / 2, 0, -Math.atan2(w, 6)); box(.32, Math.hypot(w, 6), .32, tx + w / 2, y + 3, 0, Math.atan2(w, 6), 0); }
    for (const [y, len] of [[88, 15], [70, 13], [45, 14], [30, 14]]) box(len, 2.4, 2.4, tx + w / 2 + len / 2, y, 0);   // crew access arm and umbilical arms
    box(14, 3, 14, tx, 12.5 + H + 1.5, 0); box(.6, 22, .6, tx, 12.5 + H + 14, 0);                                   // top deck and lightning rod
    const tower = new THREE.Mesh(mergeGeometries(G), steel); tower.castShadow = tower.receiveShadow = true; ground.add(tower); }
  // ---- the rocket (stages as separate parts)
  const rkt = new THREE.Group(); rkt.position.set(0, 12.5, 0); scn.add(rkt); const P = buildSLS(rkt);
  // engines: four RS-25 under the core, one nozzle per booster, one RL10 on the upper stage
  const mkPlume = (col, dia, x, y, z, r, len, par) => { const geo = new THREE.CylinderGeometry(r * .55, r * 1.6, 1, 48, 24, true); geo.translate(0, -.5, 0); const m = new THREE.Mesh(geo, plumeMat(col, dia)); m.position.set(x, y, z); m.scale.set(1, len, 1); m.userData.len = len; m.frustumCulled = false; (par || rkt).add(m); return m; };
  const rs25 = [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]].map(([x, z]) => mkPlume(0xa8c8ff, 1, x, .2, z, 1.1, 34));
  const srbF = [6.25, -6.25].map(x => mkPlume(0xffc070, 1, x, -1, 0, 1.9, 70)), rl10 = mkPlume(0xb8d0ff, 0, 0, 64.2, 0, .7, 12);
  // white-hot cores inside the booster plumes and a glow at every nozzle exit
  const srbC = [6.25, -6.25].map(x => mkPlume(0xfff2c8, 0, x, -1, 0, 1.05, 34));
  const glowT = (() => { const [c, g] = cvs(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(.25, 'rgba(255,200,120,.55)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const glw = (x, y, z, s, par) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); m.position.set(x, y, z); m.userData.s = s; m.scale.setScalar(s); (par || rkt).add(m); return m; };
  const gS = [6.25, -6.25].map(x => glw(x, -1.4, 0, 9)), gR = [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]].map(([x, z]) => glw(x, 0, z, 4));
  const smoke = makeSmoke(scn, 4200), fire = makeFX(scn, 2600, true), vap = smoke;
  const vcone = new THREE.Mesh(new THREE.ConeGeometry(14, 26, 32, 1, true), new THREE.ShaderMaterial({ uniforms: { k: { value: 0 }, time: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float k, time; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e = 1. - abs(dot(normalize(vN), normalize(vV))), n = .6 + .4 * sin(vUv.x * 60. + time * 9.) * sin(vUv.y * 13. - time * 5.); gl_FragColor = vec4(vec3(.96), k * e * n * smoothstep(0., .25, vUv.y) * smoothstep(1., .55, vUv.y) * .8); }' }));
  vcone.rotation.x = Math.PI; vcone.position.y = 52; rkt.add(vcone);   // the Prandtl–Glauert condensation cloud around Max-Q
  // Earth seen from the edge of space (built when needed)
  let earth = null; const mkEarth = () => { if (earth) return; earth = new THREE.Group(); const R = 6000, em = new THREE.MeshStandardMaterial({ map: ctx.earthMap || null, roughness: .9, color: ctx.earthMap ? 0xffffff : 0x2a5a9a }), m = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), em); earth.add(m);
    { const TLd = new THREE.TextureLoader(), set = t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; em.map = t; em.color.set(0xffffff); em.needsUpdate = true; }; TLd.load('models/tex/hd/earth_day4k.webp', set, undefined, () => TLd.load('models/tex/hd/earth_4k.webp', set, undefined, () => {})); }   /* the HD pack's 4K Blue Marble */
    { const cm = new THREE.MeshStandardMaterial({ alphaMap: ctx.cloudMap || null, color: 0xffffff, transparent: true, depthWrite: false, roughness: 1, opacity: ctx.cloudMap ? 1 : 0 }), c = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 128, 96), cm); earth.add(c); c.rotation.copy(m.rotation);
      new THREE.TextureLoader().load('models/tex/hd/earth_clouds4k.webp', t => { t.anisotropy = 16; cm.alphaMap = t; cm.opacity = 1; cm.needsUpdate = true; }, undefined, () => {}); earth.userData.cl = c; }
    const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.018, 96, 64), new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, uniforms: { sd: { value: sd } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 sd; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float f = pow(1. - abs(dot(normalize(vN), v)), 3.); gl_FragColor = vec4(vec3(.35, .6, 1.) * f * 1.6 * (.3 + .7 * max(dot(-normalize(vN), sd), 0.)), f); }' }));
    earth.add(atm); m.rotation.set(.3, 2.1, 0); if (earth.userData.cl) earth.userData.cl.rotation.copy(m.rotation); scn.add(earth); };
  // ---- overlay: countdown, event captions, telemetry, skip
  const ov = document.createElement('div'); ov.id = 'aLaunch'; ov.innerHTML = `<style>#aLaunch{position:absolute;inset:0;z-index:9;pointer-events:none;font-family:var(--disp,system-ui);color:#fff}
    #aLaunch .cd{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font:200 clamp(64px,14vw,150px)/1 var(--disp,system-ui);letter-spacing:.04em;text-shadow:0 0 40px rgba(0,0,0,.5);opacity:0;transition:opacity .25s}
    #aLaunch .ev{position:absolute;left:50%;bottom:18%;transform:translateX(-50%);font:600 clamp(12px,2vw,16px)/1.2 var(--disp,system-ui);letter-spacing:.42em;text-transform:uppercase;opacity:0;transition:opacity .5s;text-shadow:0 1px 8px rgba(0,0,0,.8);white-space:nowrap}
    #aLaunch .tm{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(14px,4vw,46px);font:500 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.12em;opacity:.92;text-shadow:0 1px 4px #000}
    #aLaunch .tm b{display:block;font:300 clamp(15px,2.6vw,22px)/1.1 var(--disp,system-ui);letter-spacing:.04em}
    #aLaunch .tl{position:absolute;left:calc(18px + env(safe-area-inset-left));top:calc(16px + env(safe-area-inset-top));font:600 10px var(--disp,system-ui);letter-spacing:.3em;opacity:.8}
    #aLaunch .sk{pointer-events:auto;position:absolute;right:calc(14px + env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top));background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:999px;padding:7px 14px;font:600 12px var(--disp,system-ui);letter-spacing:.08em}
    #aLaunch .fd{position:absolute;inset:0;background:#000;opacity:1;transition:opacity 1.2s}#aLaunch .fd.w{background:#fff}
    #aLaunch .ac{position:absolute;left:50%;bottom:24%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:10px;pointer-events:auto;text-align:center}
    #aLaunch .ac.on{display:flex;animation:laIn .35s ease-out}@keyframes laIn{from{opacity:0;transform:translate(-50%,14px)}}
    #aLaunch .ac p{margin:0;font:600 clamp(12px,1.8vw,15px)/1.3 var(--disp,system-ui);letter-spacing:.18em;text-transform:uppercase;text-shadow:0 1px 8px #000}
    #aLaunch .ac button{position:relative;overflow:hidden;min-width:min(78vw,300px);padding:16px 26px;border-radius:999px;border:2px solid #fff;background:rgba(232,93,4,.85);color:#fff;font:800 clamp(17px,2.6vw,22px) var(--disp,system-ui);letter-spacing:.14em;box-shadow:0 0 0 6px rgba(232,93,4,.25),0 10px 30px rgba(0,0,0,.5);animation:laP 1.1s infinite;touch-action:none;-webkit-user-select:none;user-select:none}
    #aLaunch .ac button i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.35)}
    #aLaunch .ac button.go{background:rgba(30,150,80,.9);box-shadow:0 0 0 6px rgba(30,150,80,.3),0 10px 30px rgba(0,0,0,.5)}
    @keyframes laP{50%{box-shadow:0 0 0 14px rgba(232,93,4,0),0 10px 30px rgba(0,0,0,.5)}}
    #aLaunch .ac small{font:500 11px var(--disp,system-ui);opacity:.75;letter-spacing:.1em}
    @media (max-height:520px){#aLaunch .ac{bottom:22%;gap:6px}#aLaunch .ac p{font-size:11px;letter-spacing:.12em;max-width:80vw}#aLaunch .ac button{padding:12px 20px}#aLaunch .ac small{display:none}#aLaunch .tm{bottom:6px}}
    #aLaunch .rt{position:absolute;left:50%;top:24%;transform:translateX(-50%);font:800 clamp(18px,3vw,26px) var(--disp,system-ui);letter-spacing:.12em;color:#7dffb0;text-shadow:0 0 18px rgba(80,255,160,.5),0 2px 6px #000;opacity:0;transition:opacity .3s}</style>
    <div class="fd"></div><div class="tl">KENNEDY SPACE CENTER · LAUNCH COMPLEX 39B</div><div class="cd"></div><div class="ev"></div>
    <div class="tm"><div>MISSION TIME<b id="lT">T−00:10</b></div><div>ALTITUDE<b id="lA">0.0 km</b></div><div>SPEED<b id="lV">0 km/h</b></div></div><button class="sk">Skip launch</button><div class="ac"><p></p><button><i></i><span></span></button><small></small></div><div class="rt"></div>`;
  root.appendChild(ov); const $ = q => ov.querySelector(q); setTimeout(() => { $('.fd').style.opacity = 0; }, 60);
  $('.sk').onclick = () => finish(true);
  const TX = {}, tx = (q, v) => { if (TX[q] !== v) { TX[q] = v; $(q).textContent = v; } };   /* touch the DOM only when the text changes */
  const ev = (txt, ms = 2600) => { const e = $('.ev'); e.textContent = txt; e.style.opacity = 1; clearTimeout(e._t); e._t = setTimeout(() => e.style.opacity = 0, ms); };
  const fired = new Set(), once = (k, f) => { if (!fired.has(k)) { fired.add(k); f(); } };
  // ---- you fly it: the flight director asks for GO, you hold to light the engines, you call each staging in slow motion
  const G = { cur: null, hold: false, prog: 0, score: 0, n: 0 }, ac = $('.ac'), acB = ac.querySelector('button');
  const GATES = [
    { id: 'go', at: 3.3, stop: true, p: 'Flight director: all stations are GO', b: 'GO FOR LAUNCH', sm: 'tap · or press Space', go: 1 },
    { id: 'ign', at: 6.5, stop: true, hold: 1.1, p: 'Main engines ready', b: 'HOLD TO IGNITE', sm: 'hold · or hold Space' },
    { id: 'srb', at: 26.2, slow: .22, win: [26.7, 27.6], auto: 28.4, p: 'Boosters are burning out', b: 'SEPARATE BOOSTERS', sm: 'tap when the boosters burn out' },
    { id: 'core', at: 31.2, slow: .22, win: [31.7, 32.6], auto: 33.4, p: 'Core stage fuel almost gone', b: 'CUT OFF · SEPARATE', sm: 'tap at main engine cutoff' }];
  function gateOpen(g) { G.cur = g; G.prog = 0; G.hold = false; ac.querySelector('p').textContent = g.p; acB.querySelector('span').textContent = g.b; ac.querySelector('small').textContent = g.sm; acB.classList.toggle('go', !!g.go); acB.querySelector('i').style.width = '0'; ac.classList.add('on'); ctx.sfx && ctx.sfx('up'); }
  function rate(txt) { const r = $('.rt'); r.textContent = txt; r.style.opacity = 1; clearTimeout(r._t); r._t = setTimeout(() => r.style.opacity = 0, 1600); }
  function gateDone(manual) { const g = G.cur; if (!g) return; G.cur = null; ac.classList.remove('on');
    if (g.win) { G.n++; if (manual && L.t >= g.win[0] && L.t <= g.win[1]) { G.score++; rate('PERFECT TIMING'); } else if (manual) rate(L.t < g.win[0] ? 'A LITTLE EARLY' : 'A LITTLE LATE'); else rate('AUTO-SEQUENCER TOOK OVER');
      if (g.id === 'srb') S.srbAt = L.t; else S.coreAt = L.t; }
    if (g.id === 'go') ctx.say && ctx.say('We are GO for launch.', 1); }
  const press = d => { if (!G.cur) return; if (G.cur.hold) G.hold = d; else if (d) gateDone(true); };
  acB.addEventListener('pointerdown', e => { e.preventDefault(); press(true); }); addEventListener('pointerup', () => press(false)); acB.addEventListener('pointerleave', () => { if (G.cur && G.cur.hold) G.hold = false; });
  const kd = e => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); press(true); } }, ku = e => { if (e.code === 'Space' || e.code === 'Enter') press(false); };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  function gateTime(dt) { const t = L.t; if (!G.cur) { const g = GATES.find(x => !fired.has('g_' + x.id) && t >= x.at); if (g) { fired.add('g_' + g.id); gateOpen(g); } }
    const g = G.cur; if (!g) return dt;
    if (g.hold) { G.prog = Math.max(0, G.prog + (G.hold ? dt : -dt * 2)); acB.querySelector('i').style.width = Math.min(100, G.prog / g.hold * 100) + '%'; if (ctx.audio) ctx.audio({ eng: Math.min(.5, G.prog / g.hold * .5), dt }); if (G.prog >= g.hold) gateDone(true); return 0; }
    if (g.stop) return 0;
    if (g.win) { const now = t >= g.win[0] && t <= g.win[1]; if (acB._now !== now) { acB._now = now; acB.classList.toggle('go', now); acB.querySelector('span').textContent = now ? 'NOW!' : g.b; if (now) ctx.sfx && ctx.sfx('up'); } }
    if (g.auto && t >= g.auto) gateDone(false);
    return dt * (g.slow || 1); }
  // ---- motion state
  const S = { y: 0, x: 0, vy: 0, tilt: 0, vel: new THREE.Vector3(), lift: 9.8, srb: null, core: null };
  const sep = [];   // separated parts: { g, v, w }
  function detach(g, v, w) { if (!g) return; scn.attach(g); sep.push({ g, v, w }); }
  let prevPos = new THREE.Vector3(); const HV = new THREE.Vector3();
  function step(dt) { if (L.done) return; dt = gateTime(dt); L.t += dt; const t = L.t, T = missionT(t), lt = t - S.lift;
    // countdown digits, callouts
    const cd = $('.cd'); if (t < S.lift) { const n = Math.ceil(-T); tx('.cd', n > 0 ? String(n) : ''); cd.style.opacity = n > 0 && n <= 10 && !G.cur ? 1 : 0; } else cd.style.opacity = 0;
    if (t > .4) once('c10', () => ctx.say('T minus ten.', 1)); if (t > 3.5) once('go', () => ev('Go for launch')); if (t > 6.6) once('mes', () => { ev('Main engine start'); ctx.say('Main engine start.', 1); ctx.sfx('burst'); });
    if (t > S.lift) once('lo', () => { ev('Lift-off', 3200); ctx.say('Booster ignition, and lift-off!', 1); ctx.sfx('liftoff'); }); if (t > 21.5) once('mq', () => { ev('Max-Q · maximum aerodynamic pressure'); ctx.say('Through max Q.', 1); });
    if (S.srbAt != null && t >= S.srbAt) once('srb', () => { ev('Booster separation'); ctx.say('Booster separation confirmed.', 1); ctx.sfx('burst'); S.srb = t; ['srb_l', 'srb_r'].forEach((n, i) => { detach(P[n], new THREE.Vector3((i ? -1 : 1) * 9, -6, 0), new THREE.Vector3(0, 0, (i ? 1 : -1) * .5)); }); srbF.forEach(p => p.visible = false); });
    if (S.coreAt != null && t >= S.coreAt) once('meco', () => { ev('Main engine cutoff · core stage separation'); ctx.say('Main engine cutoff. Core stage separation.', 1); S.core = t; rs25.forEach(p => p.visible = false); detach(P.core, new THREE.Vector3(0, -14, 0), new THREE.Vector3(.12, 0, .05)); });
    if (t > 33.4) once('rl10', () => { ev('Upper stage ignition'); ctx.say('Upper stage ignition.', 1); });
    if (t > 34.6) once('fair', () => { ev('Service module fairing separation'); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + Math.PI / 3, g = P['fair' + i]; detach(g, new THREE.Vector3(Math.cos(a) * 7, 4, -Math.sin(a) * 7).applyQuaternion(rkt.quaternion), new THREE.Vector3(Math.sin(a) * .9, 0, Math.cos(a) * .9)); } });
    if (t > 35.3) once('las', () => { ev('Launch abort system jettison'); ctx.say('Launch abort system jettisoned.', 1); S.las = t; detach(P.las, new THREE.Vector3(0, 46, 0).applyQuaternion(rkt.quaternion), new THREE.Vector3(.02, 0, .03)); });
    if (t > 38) once('orbit', () => { ev('Orbit', 3000); rate(G.score === 2 ? '★★★ FLAWLESS ASCENT' : G.score === 1 ? '★★ GOOD ASCENT' : '★ ORBIT REACHED'); try { localStorage.setItem('adv_launch_best', Math.max(+localStorage.getItem('adv_launch_best') || 0, G.score + 1)); } catch (e) {} ctx.say('Welcome to orbit.', 1); });
    // flight: slow and heavy at first, then faster and faster; pitch over toward the Atlantic
    if (t >= S.lift) { const a = 2.4 + lt * .55 + Math.max(0, lt - 6) * 2.2 + Math.max(0, lt - 12) * 7; S.vy += a * dt; S.tilt = clamp((lt - 4) * .055, 0, 1.25); S.y += S.vy * Math.cos(S.tilt) * dt; S.x += S.vy * Math.sin(S.tilt) * dt; }
    rkt.position.set(S.x, 12.5 + S.y, 0); rkt.rotation.set(0, 0, -S.tilt * .9); rkt.position.y += t > S.lift - 3 && t < S.lift + 2 ? (Math.random() - .5) * .08 : 0;
    const alt = clamp((S.y - 2500) / 40000, 0, 1), space = t > 26; SU.alt.value = Math.max(alt, space ? ss(t, 26, 30) : 0); if (!stars.material.map) { const st = typeof ctx.starTex === 'function' ? ctx.starTex() : ctx.starTex; if (st) { stars.material.map = st; stars.material.needsUpdate = true; } } stars.visible = !!stars.material.map; stars.material.opacity = SU.alt.value * .9; scn.fog.density = .00016 * (1 - SU.alt.value);
    // engines
    const k1 = t > 6.6 ? ss(t, 6.6, 7.6) : 0, k2 = t > S.lift - .2 ? ss(t, S.lift - .2, S.lift + .3) : 0, vac = clamp(S.y / 30000, 0, 1);
    for (const p of rs25) { p.material.uniforms.k.value = k1; p.material.uniforms.time.value = t; p.material.uniforms.vac.value = vac; p.scale.set(1 + vac * 2.5, p.userData.len * (1 + vac * 1.5), 1 + vac * 2.5); }
    for (const p of srbC) { p.visible = !S.srb; p.material.uniforms.k.value = k2; p.material.uniforms.time.value = t * 1.3; p.material.uniforms.vac.value = vac; p.scale.set(1 + vac * 1.5, p.userData.len * (1 + vac), 1 + vac * 1.5); }
    gS.forEach(g => { g.visible = !S.srb; g.material.opacity = k2 * (.85 + Math.random() * .15); }); gR.forEach(g => { g.visible = !S.core; g.material.opacity = k1 * .8 * (.9 + Math.random() * .1); });
    for (const p of srbF) { p.material.uniforms.k.value = k2; p.material.uniforms.time.value = t; p.material.uniforms.vac.value = vac; p.scale.set(1 + vac * 3, p.userData.len * (1 + vac * 2), 1 + vac * 3); }
    rl10.material.uniforms.k.value = t > 33.4 ? ss(t, 33.4, 34) : 0; rl10.material.uniforms.time.value = t; rl10.material.uniforms.vac.value = 1;
    const wp = rkt.localToWorld(new THREE.Vector3(0, 0, 0)); eng.position.copy(wp).add(new THREE.Vector3(0, -12, 0)); eng.intensity = (k1 * 1.6 + k2 * 6) * (1 - SU.alt.value) * 900 * (S.srb ? .4 : 1);
    // pad: steam explodes out of the flame trench, then a towering exhaust column
    if (k1 > 0 && S.y < 400) { const n = Math.ceil((k1 * 6 + k2 * 14) * dt * 30); for (let i = 0; i < n; i++) { const s = Math.random() < .5 ? 1 : -1; smoke.emit(new THREE.Vector3((Math.random() - .5) * 10, 6, s * (40 + Math.random() * 20)), new THREE.Vector3((Math.random() - .5) * 18, 8 + Math.random() * 14, s * (30 + Math.random() * 40)), 0xf2f0ea, 14 + Math.random() * 10, 8 + Math.random() * 4, 1, 4, { grow: 4.2, drag: .45, a: .6, grav: -1.2, heat: k2 > 0 ? .7 : .35 }); } }
    if (k2 > 0 && S.y < 160) { const n = dt * 46 * (1 - S.y / 160); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 22 + Math.random() * 26; smoke.emit(new THREE.Vector3(Math.cos(a) * 30, 5 + Math.random() * 4, Math.sin(a) * 30), new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp), 0xece8e0, 16 + Math.random() * 10, 10, 1, 4, { grow: 4.5, drag: .55, a: .7, grav: -.6, heat: .8 }); } }   // the ground cloud rolls out around the pad
    if (k2 > 0 && !S.srb) { const base = rkt.localToWorld(new THREE.Vector3(0, -6, 0)), dn = new THREE.Vector3(Math.sin(S.tilt * .9), -Math.cos(S.tilt * .9), 0); for (let i = 0; i < dt * 60; i++) { smoke.emit(base.clone().add(new THREE.Vector3((Math.random() - .5) * 14, 0, (Math.random() - .5) * 14)), dn.clone().multiplyScalar(30 + Math.random() * 20), 0xe6e2da, 8 + Math.random() * 6, 11, 1, 6, { grow: 3.6, drag: .9, a: .62 * (1 - SU.alt.value), heat: S.y < 600 ? .9 : .5 }); fire.emit(base, dn.clone().multiplyScalar(90), 0xffb060, 5, .35, 1, 10, { grow: 2 }); } }
    if (t > 6.6 && t < S.lift + 1.5) for (let i = 0; i < 3; i++) fire.emit(new THREE.Vector3((Math.random() - .5) * 8, 7, (Math.random() - .5) * 8), new THREE.Vector3((Math.random() - .5) * 30, 10 + Math.random() * 20, (Math.random() - .5) * 30), 0xffd890, .6, .6, 1, 2, { grow: .6, grav: 9.8 });   // sparks from the hydrogen burn-off igniters
    // sound suppression: the deluge floods the deck and the trench with water just before ignition (about 1.7 million litres in under a minute)
    if (t > 4.2 && t < S.lift + 6 && S.y < 60) { const k = Math.min(1, (t - 4.2) * .8); for (let i = 0; i < dt * 70 * k; i++) { const a = Math.random() * 6.283, r = 9 + Math.random() * 3; smoke.emit(new THREE.Vector3(Math.cos(a) * r, 12.8, Math.sin(a) * r), new THREE.Vector3(-Math.cos(a) * 5, 9 + Math.random() * 5, -Math.sin(a) * 5), 0xeef3f8, 1.2, 1.6, 1, 2, { grow: 3, drag: .2, grav: 9.8, a: .5 }); } }
    // venting vapour during the countdown
    if (t < S.lift) for (let i = 0; i < 2; i++) vap.emit(rkt.localToWorld(new THREE.Vector3((Math.random() - .5) * 8, 30 + Math.random() * 30, 4.3)), new THREE.Vector3(1 + Math.random(), -1.5, 1.5), 0xffffff, 3, 3, 1, 1, { grow: 3, drag: .5, a: .35 });
    // Max-Q vapour cone
    vcone.material.uniforms.k.value = t > 20 && t < 24.5 ? Math.sin((t - 20) / 4.5 * Math.PI) : 0; vcone.material.uniforms.time.value = t;
    // separated stages fall away and tumble
    for (const s of sep) { s.g.position.addScaledVector(s.v, dt); s.v.y -= 2 * dt; s.g.rotation.x += s.w.x * dt; s.g.rotation.y += s.w.y * dt; s.g.rotation.z += s.w.z * dt; if (S.srb && t - S.srb < 1.2 && (s.g === P.srb_l || s.g === P.srb_r)) { const top = s.g.localToWorld(new THREE.Vector3(0, 24, 0)); fire.emit(top, new THREE.Vector3((s.g === P.srb_l ? 1 : -1) * 20, 0, 0), 0xffc080, 2.2, .4, 2, 3, { grow: 2.4 }); smoke.emit(top, new THREE.Vector3((s.g === P.srb_l ? 1 : -1) * 6, 0, 0), 0xdddddd, 3, 2, 1, 2, { grow: 3, a: .5 }); } }
    if (S.las && t - S.las < 1.6 && P.las) { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, p = P.las.localToWorld(new THREE.Vector3(Math.cos(a) * .9, 89.2, Math.sin(a) * .9).add(P.las.children[0].position)); fire.emit(p, new THREE.Vector3(Math.cos(a) * 30, -20, Math.sin(a) * 30).applyQuaternion(P.las.quaternion), 0xffd8a0, 1.4, .3, 1, 4, { grow: 2.5 }); } }
    // shadows follow the rocket off the pad; the sea's waves roll
    if (S.y < 600) { sun.target.position.set(rkt.position.x, Math.min(rkt.position.y, 60), 0); sun.position.copy(sun.target.position).addScaledVector(sd, 700); } sun.castShadow = !space;
    if (PAD.sea.normalMap) { PAD.sea.normalMap.offset.x += dt * .004; PAD.sea.normalMap.offset.y += dt * .002; }
    smoke.update(dt, cam, sd); fire.update(dt, cam);
    // the planet below appears when we leave the air
    if (space) { mkEarth(); ground.visible = false; scn.fog.density = 0; earth.position.set(rkt.position.x, rkt.position.y - 6000 - 320, 0); earth.children[0].rotation.y += dt * .01; if (earth.userData.cl) earth.userData.cl.rotation.y += dt * .0112; }
    camera(dt, t, lt);
    { const hp = rkt.localToWorld(HV.set(0, -8, 0)).project(cam), on = hp.z < 1 && Math.abs(hp.x) < 1.4 && Math.abs(hp.y) < 1.4; L.heat = on ? { x: hp.x * .5 + .5, y: hp.y * .5 + .5, k: Math.min(1, k1 * .5 + k2) * (1 - SU.alt.value) * 1.3 } : null; }
    // telemetry
    const [km, kmh] = prof(Math.max(0, T)), mm = Math.floor(Math.abs(T) / 60), sec = Math.floor(Math.abs(T) % 60);
    tx('#lT', `T${T < 0 ? '−' : '+'}${String(mm).padStart(2, '0')}:${String(sec).padStart(2, '0')}`); tx('#lA', km.toFixed(1) + ' km'); tx('#lV', Math.round(kmh).toLocaleString() + ' km/h');
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
  function finish(skipped) { if (L.done) return; L.done = true; removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true); const fd = $('.fd'); fd.classList.add('w'); fd.style.transition = 'opacity .7s'; fd.style.opacity = 1;
    setTimeout(() => { ov.remove(); dispose(); ctx.onDone && ctx.onDone(skipped); }, skipped ? 80 : 750); }
  function dispose() { smoke.dispose(); fire.dispose(); scn.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  return { scn, step, finish, get t() { return L.t; }, get heat() { return L.heat; } };
}
