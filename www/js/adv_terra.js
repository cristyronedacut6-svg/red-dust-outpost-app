// Red Dust Outpost · Adventure landscape realism.
// 1) Sun shadows and sky occlusion for the whole landscape, worked out from the height map on the CPU a slice at a time and
//    stored per vertex (crater walls shade their floors, hills throw long shadows at dawn). No extra render passes.
// 2) A ring of far mountains around the landing area so the horizon has a skyline, stitched to the edge of the terrain.
// 3) A reflection map made from each world's own sky and ground, so visors and metal mirror the place you are standing in.
// 4) The Sun as a camera sees it: a hard disc, a soft corona, diffraction spikes and faint lens ghosts.
// 5) Angular, fractured rocks and a carpet of pebbles that follows the astronaut.
// 6) Full 16-bit decoding of NASA's terrain models (the browser's own decoder throws away 8 of the 16 bits).
import * as THREE from 'three';
import { mergeVertices } from './vendor/three/utils/BufferGeometryUtils.js';

const { clamp, smoothstep } = THREE.MathUtils;
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); a *= .5; f *= 2; } return s; }
// ridged multifractal: sharp crests with smooth valleys, the classic shape of eroded and faulted mountain ranges
function ridged(x, y, o = 5) { let s = 0, a = .5, f = 1, w = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(vn(x * f, y * f) * 2 - 1); n *= n; s += n * a * w; w = clamp(n * 1.7, 0, 1); a *= .5; f *= 2.07; } return s; }
// make every triangle of an open, roughly horizontal surface face the sky (so one-sided materials and their shadows behave)
function upward(g) { g.computeVertexNormals(); const n = g.attributes.normal; let s = 0; for (let i = 0; i < n.count; i++) s += n.getY(i);
  if (s < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); } }

/* ---------------------------------------------------------------- far mountains ---------------------------------------------------------------- */
// [height in metres, style]. Style 0: rounded massifs (the Moon's Apennines, old icy moons). 1: sharp ridges and scarps. 2: stepped mesas and buttes.
export const MTN = { moon: [430, 0], mercury: [380, 1], mars: [520, 2], venus: [520, 0], ceres: [260, 0], phobos: [110, 0], deimos: [50, 0], io: [680, 1], europa: [85, 1], ganymede: [260, 0], callisto: [220, 0], titan: [260, 0],
  enceladus: [170, 1], mimas: [460, 0], rhea: [280, 0], dione: [380, 1], tethys: [440, 0], iapetus: [620, 1], miranda: [520, 1], ariel: [400, 1], umbriel: [240, 0], titania: [420, 1], oberon: [320, 0], triton: [130, 0], pluto: [440, 1], vesta: [380, 0], charon: [300, 0] };
// height of the land everywhere, including far beyond the walkable square: the real terrain inside, mountains rising outside it
export function farHeight(id, H, half, sea) { const M = MTN[id]; if (!M) return null; const amp = M[0], style = M[1], seed = id.length * 7.3 + id.charCodeAt(0) * .37, f = 1 / 1400;
  const fn = (x, z) => { const cx = clamp(x, -half, half), cz = clamp(z, -half, half), base = H(cx, cz), d = Math.max(Math.abs(x), Math.abs(z)), k = smoothstep(d, half, half + 560); if (k <= 0) return base;
    const r = Math.hypot(x, z), region = smoothstep(fbm(x * f * .8 + seed, z * f * .8 - seed, 2), .3, .58); let m;   // ranges stand in some directions; in others the plain runs to the horizon
    if (style === 0) m = Math.pow(fbm(x * f * 2.2 + seed, z * f * 2.2, 5), 1.7) * 2.7;
    else if (style === 1) m = ridged(x * f * 1.6 + seed, z * f * 1.6, 5) * 1.15;
    else { const q = ridged(x * f * 1.3 + seed, z * f * 1.3, 4); m = smoothstep(q, .26, .46) * .55 + smoothstep(q, .52, .68) * .42 + q * .16; }
    m *= amp * (.22 + .78 * region) * (.5 + .5 * smoothstep(r, half, 2300));
    let y = base * (1 - k * .5) + m * k - smoothstep(r, 3400, 5300) * (amp + 260);                                   // beyond the ranges the land drops under the horizon
    if (sea && x > 150) { const s = smoothstep(x, 150, 430); y = y * (1 - s) + Math.min(y, -4) * s; }
    return y; };
  fn.amp = amp; return fn; }
// the skyline mesh: a wide polar ring of land, plus a narrow curtain that hangs from the terrain's own edge so the two never show a gap.
// o.edge: the terrain's border vertices in order around the square, 6 numbers each (x, y, z, r, g, b).
export function makeFar(hx, mat, o) { const { half, size, na, nr, cols, edge } = o, r0 = half * .8, r1 = 5500, n1 = na + 1, N = n1 * (nr + 1);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), uv = new Float32Array(N * 2), idx = [], c = new THREE.Color(), rock = cols[0].clone().multiplyScalar(.78);
  for (let j = 0; j <= nr; j++) { const r = r0 + (r1 - r0) * Math.pow(j / nr, 1.85); for (let i = 0; i <= na; i++) { const a = i / na * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, d = Math.max(Math.abs(x), Math.abs(z)), k = j * n1 + i;
      let y = hx(x, z); if (d < half) y -= 5 + (half - d) * .6;                                                       // under the walkable terrain: tucked well below it
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / size + .5; uv[k * 2 + 1] = .5 - z / size; } }
  for (let j = 0; j < nr; j++) for (let i = 0; i < na; i++) { const a = j * n1 + i, b = a + 1, d = a + n1, e = d + 1; idx.push(a, b, d, b, e, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); upward(geo);
  const nn = geo.attributes.normal, amp = hx.amp || 300;
  for (let k = 0; k < N; k++) { const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], n = fbm(x * .004 + 9, z * .004, 3), t = clamp(.42 + y / (amp * 1.6) + (n - .5) * .6, 0, 1);
    if (t < .5) c.copy(cols[0]).lerp(cols[1], t * 2); else c.copy(cols[1]).lerp(cols[2], (t - .5) * 2);
    c.lerp(rock, smoothstep(1 - nn.getY(k), .1, .42) * .7); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('lava', new THREE.BufferAttribute(new Float32Array(N), 1));

  const ring = new THREE.Mesh(geo, mat); ring.receiveShadow = true; ring.frustumCulled = false;
  // curtain: one closed strip around the square, from each border vertex outward and down to below the ring
  const E = edge.length / 6, out = half + 46, cp = new Float32Array(E * 6), cc = new Float32Array(E * 6), cu = new Float32Array(E * 4), ci = [];
  for (let k = 0; k < E; k++) { const x = edge[k * 6], y = edge[k * 6 + 1], z = edge[k * 6 + 2], X = Math.abs(x) >= half - .01 ? Math.sign(x) * out : x, Z = Math.abs(z) >= half - .01 ? Math.sign(z) * out : z;
    cp.set([x, y, z, X, Math.min(y, hx(X, Z)) - 10, Z], k * 6); for (let q = 0; q < 2; q++) cc.set([edge[k * 6 + 3], edge[k * 6 + 4], edge[k * 6 + 5]], k * 6 + q * 3); cu.set([x / size + .5, .5 - z / size, X / size + .5, .5 - Z / size], k * 4);
    const a = k * 2, b = ((k + 1) % E) * 2; ci.push(a, a + 1, b, a + 1, b + 1, b); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.setAttribute('uv', new THREE.BufferAttribute(cu, 2)); cg.setIndex(ci); upward(cg);
  cg.setAttribute('lava', new THREE.BufferAttribute(new Float32Array(E * 2), 1));
  const curtain = new THREE.Mesh(cg, mat); curtain.receiveShadow = true; curtain.frustumCulled = false;
  return { ring, curtain }; }

/* ---------------------------------------------------------------- baked sunlight ---------------------------------------------------------------- */
// The landscape's shadows live in two small textures that every lit material in the game can read by world position: one covers the walkable
// square finely, the other covers the far land coarsely. Red = sunlight in the last finished bake, green = in the newest one (the shader blends
// between them, so shadows glide instead of jumping), blue = how much open sky the spot sees. Off (litP.w = 0) everywhere but on a landed world.
const W1 = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); W1.needsUpdate = true;
export const LIT = { litNearT: { value: W1 }, litFarT: { value: W1 }, litS: { value: new THREE.Vector4() }, litP: { value: new THREE.Vector4(0, 1, 0, 0) }, litCtr: { value: new THREE.Vector3() }, litNear: { value: new THREE.Vector2(-2, -1) } };
export const litHook = sh => { for (const k in LIT) sh.uniforms[k] = LIT[k]; };
if (!THREE.ShaderChunk.lights_fragment_end.includes('litNearT')) {
  THREE.ShaderChunk.lights_pars_begin = 'uniform sampler2D litNearT, litFarT; uniform vec4 litS, litP; uniform vec3 litCtr; uniform vec2 litNear;\n' + THREE.ShaderChunk.lights_pars_begin;
  // litP: x half-size of the square, y blend between the two bakes, z strength of the baked sunlight (0 at night), w on/off.
  // Near the astronaut (litCtr, litNear) the live shadow map takes over: it is sharper and never lags behind the Sun.
  THREE.ShaderChunk.lights_fragment_end += `
	float litSun = 1.0;
	if ( litP.w > 0.0 ) {
		vec3 litW = ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz + cameraPosition;
		vec4 litT = max( abs( litW.x ), abs( litW.z ) ) < litP.x ? texture2D( litNearT, litW.xz * litS.x + litS.y ) : vec4( texture2D( litFarT, litW.xz * litS.z + litS.w ).rg, 1.0, 1.0 );
		litSun = mix( 1.0, mix( litT.r, litT.g, litP.y ), smoothstep( litNear.x, litNear.y, distance( litW.xz, litCtr.xz ) ) * litP.z );
		reflectedLight.directDiffuse *= litSun; reflectedLight.directSpecular *= litSun;
		float litO = mix( 1.0, litT.b, 0.9 ); reflectedLight.indirectDiffuse *= litO; reflectedLight.indirectSpecular *= litO;
	}`;
  const ob = THREE.Material.prototype.onBeforeCompile; THREE.Material.prototype.onBeforeCompile = function (sh, r) { litHook(sh); if (ob) ob.call(this, sh, r); };
}
// geo: the terrain plane (seg x seg cells, already displaced). hx: far height function or null.
// st: work out the shadows on every st-th vertex (2 = a quarter of the work; the GPU blends between the points).
export function makeBake(geo, seg, size, hx, st = 2) {
  if (seg % st) st = 1; const n1 = seg + 1, N = n1 * n1, cell = size / seg, half = size / 2, P = geo.attributes.position, hg = new Float32Array(N), m1 = seg / st + 1, M = m1 * m1; let gMax = -1e9;
  for (let i = 0; i < N; i++) { const y = P.getY(i); hg[i] = y; if (y > gMax) gMax = y; }
  // coarse height map of the far land (57 m cells out to 3.6 km): mountain shadows reach across the plain at dawn and dusk
  const FN = 128, FR = 3600, fc = FR * 2 / (FN - 1), FM = FN * FN; let fg = null, fMax = -1e9;
  if (hx) { fg = new Float32Array(FM); for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) { const y = hx(-FR + i * fc, -FR + j * fc); fg[j * FN + i] = y; if (y > fMax) fMax = y; } }
  const near = (x, z) => { const u = (x + half) / cell, v = (z + half) / cell, i = Math.min(seg - 1, Math.max(0, Math.floor(u))), j = Math.min(seg - 1, Math.max(0, Math.floor(v))), fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j)), k = j * n1 + i;
    return (hg[k] * (1 - fu) + hg[k + 1] * fu) * (1 - fv) + (hg[k + n1] * (1 - fu) + hg[k + n1 + 1] * fu) * fv; };
  const far = (x, z) => { const u = (x + FR) / fc, v = (z + FR) / fc, i = Math.min(FN - 2, Math.max(0, Math.floor(u))), j = Math.min(FN - 2, Math.max(0, Math.floor(v))), fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j)), k = j * FN + i;
    return (fg[k] * (1 - fu) + fg[k + 1] * fu) * (1 - fv) + (fg[k + FN] * (1 - fu) + fg[k + FN + 1] * fu) * fv; };
  const PEN = .03;   // soft edge of the shadows, as the tangent of an angle (about 1.7 degrees: softer than the real Sun's half degree, which hides the grid)
  // sunlight reaching the point (x0, h0, z0) when the Sun stands in direction (dx, dz) with tangent of elevation te: 0 dark .. 255 lit
  function shade(x0, h0, z0, dx, dz, te) { if (te <= -PEN) return 0; let mc = te, t = cell * 1.5, k = 0;
    if (Math.abs(x0) <= half && Math.abs(z0) <= half) for (; k < 44; k++) { const x = x0 + dx * t, z = z0 + dz * t; if (x < -half || x > half || z < -half || z > half) break; const ry = h0 + te * t; if (ry > gMax) break;
      const c = (ry - near(x, z)) / t; if (c < mc) { mc = c; if (c < -PEN) return 0; } t += cell * (1 + k * .3); }
    if (fg) { const tx = dx > 1e-6 ? (half - x0) / dx : dx < -1e-6 ? (-half - x0) / dx : 1e9, tz = dz > 1e-6 ? (half - z0) / dz : dz < -1e-6 ? (-half - z0) / dz : 1e9; t = Math.max(t, Math.min(tx, tz) + 20, 30); let s = 42;
      for (k = 0; k < 26 && t < 4200; k++) { const ry = h0 + te * t; if (ry > fMax) break; const c = (ry - far(x0 + dx * t, z0 + dz * t)) / t; if (c < mc) { mc = c; if (c < -PEN) return 0; } t += s; s *= 1.13; } }
    const v = (mc + PEN) / (2 * PEN); return v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * v * (3 - 2 * v) * 255); }
  const tex = (d, n) => { const t = new THREE.DataTexture(d, n, n); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  const nd = new Uint8Array(M * 4).fill(255), nt = tex(nd, m1), fd = fg ? new Uint8Array(FM * 4).fill(255) : null, ft = fd ? tex(fd, FN) : W1, nN = new Uint8Array(M), nF = fg ? new Uint8Array(FM) : null;
  // sky occlusion, once: how much of the sky each point sees (hollows and crater floors receive less bounced light)
  { const D = [[3, 0], [2, 2], [0, 3], [-2, 2], [-3, 0], [-2, -2], [0, -3], [2, -2]];
    for (let lj = 0; lj < m1; lj++) for (let li = 0; li < m1; li++) { const i = li * st, j = lj * st, h0 = hg[j * n1 + i]; let s = 0;
      for (const [dx, dz] of D) { let m = 0; for (let q = 1; q <= 3; q += 2) { const ii = Math.min(seg, Math.max(0, i + dx * q)), jj = Math.min(seg, Math.max(0, j + dz * q)), sl = (hg[jj * n1 + ii] - h0) / (Math.hypot(dx, dz) * q * cell); if (sl > m) m = sl; } s += m; }
      nd[(lj * m1 + li) * 4 + 2] = Math.round(255 * (1 - Math.min(.72, s / 8 * 1.5))); } }
  LIT.litNearT.value = nt; LIT.litFarT.value = ft; LIT.litS.value.set(1 / (st * cell * m1), (half / (st * cell) + .5) / m1, 1 / (fc * FN), (FR / fc + .5) / FN); LIT.litP.value.set(fg ? half : 1e9, 1, 0, 1);
  let job = null, fade = 1, fadeDur = 1, lastDur = .3; const last = new THREE.Vector3(0, -1, 0), prev = new THREE.Vector3(), vel = new THREE.Vector3(), tmp = new THREE.Vector3();
  // one slice of work: phase 0 shades the walkable square, phase 1 the far land
  function run(ms) { const J = job, t0 = performance.now(); let n = 0;
    if (J.ph === 0) { for (; J.i < M; J.i++) { const i = J.i, ix = (i % m1) * st, iz = Math.floor(i / m1) * st; nN[i] = shade(-half + ix * cell, hg[iz * n1 + ix], -half + iz * cell, J.dx, J.dz, J.te); if ((++n & 255) === 0 && performance.now() - t0 > ms) { J.i++; return false; } } J.ph = 1; J.i = 0; }
    if (nF) for (; J.i < FM; J.i++) { const i = J.i; nF[i] = shade(-FR + (i % FN) * fc, fg[i], -FR + Math.floor(i / FN) * fc, J.dx, J.dz, J.te); if ((++n & 255) === 0 && performance.now() - t0 > ms) { J.i++; return false; } }
    return true; }
  function put(a, nx, n, first) { for (let i = 0; i < n; i++) { a[i * 4] = first ? nx[i] : a[i * 4 + 1]; a[i * 4 + 1] = nx[i]; } }
  function commit(first) { put(nd, nN, M, first); nt.needsUpdate = true; if (nF) { put(fd, nF, FM, first); ft.needsUpdate = true; } }
  function begin(sd) { const hl = Math.hypot(sd.x, sd.z) || 1e-6; job = { ph: 0, i: 0, dx: sd.x / hl, dz: sd.z / hl, te: Math.max(-.2, sd.y / hl), sd: sd.clone(), t: 0 }; }
  return { n1, cell, half,
    // height of the rendered ground at (x, z): a fast lookup into the mesh's own height grid
    h: (x, z) => near(Math.min(half, Math.max(-half, x)), Math.min(half, Math.max(-half, z))),
    // sunlight (0..1) at a point on the walkable ground, from the newest bake
    sunAt(x, z) { const u = clamp((x + half) / (cell * st), 0, m1 - 1.001), v = clamp((z + half) / (cell * st), 0, m1 - 1.001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * m1 + i;
      return ((nd[k * 4 + 1] * (1 - fu) + nd[(k + 1) * 4 + 1] * fu) * (1 - fv) + (nd[(k + m1) * 4 + 1] * (1 - fu) + nd[(k + m1 + 1) * 4 + 1] * fu) * fv) / 255; },
    init(sd) { begin(sd); run(1e9); commit(true); last.copy(sd); prev.copy(sd); vel.set(0, 0, 0); job = null; fade = 1; LIT.litP.value.y = 1; },
    // call every frame with the Sun's direction. ms: time budget for this frame's slice of work. sunK: 0 at night .. 1 by day.
    update(dt, sd, ms, sunK) { if (dt > 0) { tmp.copy(sd).sub(prev).divideScalar(Math.max(dt, 1e-3)); if (tmp.length() > .5) vel.set(0, 0, 0); else vel.lerp(tmp, Math.min(1, dt * 2)); prev.copy(sd); }
      if (job) { job.t += dt; if (run(ms)) { commit(false); last.copy(job.sd); lastDur = job.t; fadeDur = clamp(job.t, .35, 2.5); fade = 0; job = null; } }
      else if (fade >= 1 && sd.y > -.06 && last.angleTo(sd) > .0055) begin(tmp.copy(sd).addScaledVector(vel, lastDur + fadeDur * .5).normalize());   // aim a little ahead of the Sun, so the shadows are right when the blend finishes
      fade = Math.min(1, fade + dt / fadeDur); LIT.litP.value.y = fade; LIT.litP.value.z = sunK; },
    dispose() { nt.dispose(); if (fd) ft.dispose(); LIT.litNearT.value = W1; LIT.litFarT.value = W1; LIT.litP.value.set(0, 1, 0, 0); LIT.litNear.value.set(-2, -1); } }; }

/* ---------------------------------------------------------------- reflections ---------------------------------------------------------------- */
// a tiny sky-and-ground scene filtered into an environment map: black sky and bright regolith on airless worlds, the real sky colours elsewhere
let PM = null, PMR = null;
export function makeEnv(ren, zen, hor, gnd) { try { if (PMR !== ren) { if (PM) PM.dispose(); PM = new THREE.PMREMGenerator(ren); PMR = ren; }
    const s = new THREE.Scene(), g = new THREE.SphereGeometry(10, 32, 16), m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { zen: { value: zen }, hor: { value: hor }, gnd: { value: gnd } },
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 zen, hor, gnd; varying vec3 d; void main(){ float y = normalize(d).y; vec3 c = y > 0. ? mix(hor, zen, pow(y, .55)) : mix(hor, gnd, smoothstep(0., -.06, y)) * mix(1., .55, smoothstep(-.1, -1., y)); gl_FragColor = vec4(c, 1.); }' });
    s.add(new THREE.Mesh(g, m)); const rt = PM.fromScene(s, .035); g.dispose(); m.dispose(); return rt; } catch (e) { return null; } }

/* ---------------------------------------------------------------- the Sun ---------------------------------------------------------------- */
const cvs = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
let ST = null;
function sunTex() { if (ST) return ST;
  const disc = cvs(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.17, 'rgba(255,255,255,1)'); gr.addColorStop(.215, 'rgba(255,250,235,.5)'); gr.addColorStop(.36, 'rgba(255,240,215,.14)'); gr.addColorStop(1, 'rgba(255,235,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const halo = cvs(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(.14, 'rgba(255,246,228,.2)'); gr.addColorStop(.42, 'rgba(255,238,210,.05)'); gr.addColorStop(1, 'rgba(255,235,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  // diffraction spikes (the blades of a camera's iris) and one long horizontal streak, like bright light through an anamorphic lens
  const spikes = cvs(512, 512, g => { g.translate(256, 256); g.globalCompositeOperation = 'lighter';
    const ray = (a, len, wd, al) => { g.save(); g.rotate(a); const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(.25, `rgba(255,245,225,${al * .35})`); gr.addColorStop(1, 'rgba(255,240,215,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -wd); g.lineTo(len, 0); g.lineTo(0, wd); g.closePath(); g.fill(); g.restore(); };
    for (let i = 0; i < 12; i++) ray(i / 12 * Math.PI * 2 + .13, i % 2 ? 110 : 190, i % 2 ? 2 : 3, i % 2 ? .45 : .75); ray(0, 256, 2.2, .9); ray(Math.PI, 256, 2.2, .9); });
  const ghost = cvs(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(.72, 'rgba(255,255,255,.2)'); gr.addColorStop(.86, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  return ST = { disc, halo, spikes, ghost }; }
// o.disc: draw the Sun's own disc (airless worlds; where there is air the sky shader already draws it). o.size: apparent size factor.
export function makeSun(scn, o = {}) { const T = sunTex(), mk = (map, opt) => { const s = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }, opt))); s.renderOrder = 3; scn.add(s); return s; };
  const disc = o.disc ? mk(T.disc, { color: new THREE.Color(9, 8.6, 7.8) }) : null, halo = o.disc ? mk(T.halo, {}) : null, spikes = mk(T.spikes, { depthTest: false, opacity: 0 }), G = [];
  for (const [d, sz, c] of [[.42, .05, 0x9fd0ff], [.78, .028, 0xffd9a0], [1.32, .075, 0xa0ffd8], [1.75, .12, 0xffb0a0], [2.2, .04, 0xc0c8ff]]) { const g = mk(T.ghost, { depthTest: false, color: c, opacity: 0 }); g.userData = { d, sz }; G.push(g); }
  const v = new THREE.Vector3(), q = new THREE.Vector3(), D = 2530, base = D * .026 * (o.size || 1); let a = 0;
  return { disc, halo, spikes,
    // sd: unit direction to the Sun. vis: 0..1, how much of it clears the landscape. k: overall strength (daylight, storms).
    update(cam, sd, vis, k, dt) { if (disc) { disc.position.copy(cam.position).addScaledVector(sd, D); disc.scale.setScalar(base * 4.7); disc.material.opacity = k; halo.position.copy(disc.position); halo.scale.setScalar(base * 15); halo.material.opacity = k * .8; }
      v.copy(cam.position).addScaledVector(sd, D).project(cam); const on = v.z < 1 && Math.abs(v.x) < 1.25 && Math.abs(v.y) < 1.25 ? 1 : 0, edge = 1 - smoothstep(Math.max(Math.abs(v.x), Math.abs(v.y)), .85, 1.25), tg = on * vis * k * edge; a += (tg - a) * Math.min(1, (dt || .016) * 7);
      spikes.visible = a > .01; if (spikes.visible) { spikes.position.copy(cam.position).addScaledVector(sd, D); spikes.scale.set(base * 24 * (o.wide || 1), base * 24, 1); spikes.material.opacity = a * (o.spike ?? .7); }
      for (const g of G) { g.visible = a > .02; if (!g.visible) continue; const u = g.userData, f = 1 - u.d; q.set(v.x * f, v.y * f, .3).unproject(cam); const dist = q.distanceTo(cam.position); g.position.copy(q); g.scale.setScalar(u.sz * dist * 2.2); g.material.opacity = a * .2 * (o.ghost ?? 1); } },
    dispose() { [disc, halo, spikes, ...G].forEach(s => { if (s) { scn.remove(s); s.material.dispose(); } }); } }; }

/* ---------------------------------------------------------------- rocks ---------------------------------------------------------------- */
// a fractured rock: a noisy lump cut by a few random planes, which leaves the flat faces and sharp-ish edges of broken stone
export function rockGeo2(seed, cuts = 5, detail = 2) { let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); const p = g.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3(), R = k => hash(seed * 7.13 + k, seed + k * 3.7);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const w = 1 + (fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 1.7 + seed * 2, 3) - .5) * .55 + (fbm(v.x * 4 + seed, v.z * 4 + v.y * 3, 2) - .5) * .14; v.multiplyScalar(w); p.setXYZ(i, v.x, v.y, v.z); }
  for (let c = 0; c < cuts; c++) { n.set(R(c) * 2 - 1, R(c + 20) * 1.6 - .5, R(c + 40) * 2 - 1).normalize(); const d = .52 + R(c + 60) * .3; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const e = v.dot(n) - d; if (e > 0) { v.addScaledVector(n, -e); p.setXYZ(i, v.x, v.y, v.z); } } }
  const fl = .62 + R(99) * .28, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { p.setY(i, p.getY(i) * fl); uv[i * 2] = p.getX(i) * .5 + p.getY(i) * .31; uv[i * 2 + 1] = p.getZ(i) * .5 + p.getY(i) * .27; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; }
// rocks across the whole landing area: a few boulder fields, many scattered stones, each one tinted like the ground it sits on
export function scatterRocks2(scene, H, o) { const { count, area, avoid, tint, mat } = o, out = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const fields = []; for (let i = 0; i < 9; i++) { const a = hash(i, 4.2) * 6.283, d = 70 + hash(i, 9.1) * (area - 120); fields.push([Math.cos(a) * d, Math.sin(a) * d, 18 + hash(i, 2.2) * 40]); }
  for (let k = 0; k < 4; k++) { const n = Math.floor(count / 4), im = new THREE.InstancedMesh(rockGeo2(k * 2.3 + 1.1, 4 + k, k < 2 ? 2 : 1), mat, n); im.castShadow = im.receiveShadow = true; let j = 0;
    for (let i = 0; i < n * 4 && j < n; i++) { let x, z; if (hash(i, k * 3.1 + 5) < .34) { const f = fields[Math.floor(hash(i, k + 17) * fields.length)], a = Math.random() * 6.283, d = Math.pow(Math.random(), .7) * f[2]; x = f[0] + Math.cos(a) * d; z = f[1] + Math.sin(a) * d; } else { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * area; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      if (Math.abs(x) > area || Math.abs(z) > area || (avoid && avoid(x, z))) continue;
      const r = Math.random(), sc = r < .035 ? 1.8 + Math.random() * 3.4 : r < .2 ? .6 + Math.random() * 1.1 : .1 + Math.pow(Math.random(), 1.8) * .5; e.set((Math.random() - .5) * .5, Math.random() * 6.283, (Math.random() - .5) * .5); q.setFromEuler(e); s.set(sc * (.75 + Math.random() * .6), sc * (.7 + Math.random() * .5), sc * (.75 + Math.random() * .6)); p.set(x, H(x, z) - sc * .18, z);
      m4.compose(p, q, s); im.setMatrixAt(j, m4); im.setColorAt(j, c.copy(tint).multiplyScalar(.62 + Math.random() * .5)); j++; }
    im.count = j; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im); out.push(im); }
  return out; }
// pebbles and small stones around the astronaut: each has a fixed place in the world, and the carpet wraps around as you walk (like the grass on Earth)
export function makePebbles(scene, H, o) { const { n, R, tint, mat, avoid } = o, ims = [], per = Math.floor(n / 2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  for (let k = 0; k < 2; k++) { const im = new THREE.InstancedMesh(rockGeo2(31 + k * 5.7, 4, 1), mat, per); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); ims.push(im); }
  const off = []; for (let i = 0; i < per * 2; i++) off.push([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 6.283, .05 + Math.pow(Math.random(), 2.4) * .3, Math.random()]);
  const wrap = (w, ctr) => ctr + ((((w - ctr) % (2 * R)) + 3 * R) % (2 * R)) - R; let cx = 1e9, cz = 1e9;
  function place(px, pz) { cx = px; cz = pz; for (let i = 0; i < per * 2; i++) { const o2 = off[i], x = wrap(o2[0] * R, px), z = wrap(o2[1] * R, pz), dd = Math.hypot(x - px, z - pz); let sc = o2[3] * clamp((R - dd) / (R * .3), 0, 1); if (avoid && avoid(x, z)) sc = 0;
      e.set(o2[4] * .6, o2[2], o2[4] * .4); q.setFromEuler(e); s.set(sc * (.8 + o2[4] * .6), sc * (.55 + o2[4] * .4), sc); p.set(x, H(x, z) - sc * .22, z); m4.compose(p, q, s); const im = ims[i % 2], j = Math.floor(i / 2); im.setMatrixAt(j, m4); im.setColorAt(j, c.copy(tint).multiplyScalar(.6 + o2[4] * .5)); }
    for (const im of ims) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; } }
  return { ims, update(px, pz) { if (Math.hypot(px - cx, pz - cz) > 2.5) place(px, pz); } }; }

/* ---------------------------------------------------------------- 16-bit terrain models ---------------------------------------------------------------- */
// NASA's digital terrain models are 16-bit greyscale PNGs. Drawing one to a canvas keeps only 8 bits (256 height steps, which shows as terraces
// under a low Sun), so read the file directly: inflate the image data and undo the PNG row filters by hand.
export async function loadHeights16(url) { const buf = await (await fetch(url)).arrayBuffer(), d = new DataView(buf); if (d.getUint32(0) !== 0x89504e47 || !self.DecompressionStream) throw new Error('unsupported');
  let o = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0; const parts = [];
  while (o + 12 <= buf.byteLength) { const len = d.getUint32(o), type = String.fromCharCode(d.getUint8(o + 4), d.getUint8(o + 5), d.getUint8(o + 6), d.getUint8(o + 7));
    if (type === 'IHDR') { w = d.getUint32(o + 8); h = d.getUint32(o + 12); bd = d.getUint8(o + 16); ct = d.getUint8(o + 17); il = d.getUint8(o + 20); } else if (type === 'IDAT') parts.push(new Uint8Array(buf, o + 8, len)); else if (type === 'IEND') break; o += 12 + len; }
  if (bd !== 16 || ct !== 0 || il !== 0 || !w || w !== h) throw new Error('unsupported');
  const raw = new Uint8Array(await new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()), st = w * 2, out = new Float32Array(w * h), cur = new Uint8Array(st), prv = new Uint8Array(st); let p = 0;
  if (raw.length < (st + 1) * h) throw new Error('short');
  for (let y = 0; y < h; y++) { const ft = raw[p++]; for (let x = 0; x < st; x++) { const a = x >= 2 ? cur[x - 2] : 0, b = prv[x], c = x >= 2 ? prv[x - 2] : 0; let pr = 0;
      if (ft === 1) pr = a; else if (ft === 2) pr = b; else if (ft === 3) pr = (a + b) >> 1; else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = (raw[p++] + pr) & 255; }
    for (let x = 0; x < w; x++) out[y * w + x] = ((cur[x * 2] << 8) | cur[x * 2 + 1]) / 65535; prv.set(cur); }
  // the game's ground mesh is a little coarser than this data, and sampling one grid with another makes stripes (plain to see under a low Sun),
  // so the finest ripple, which the mesh could not show anyway, is blurred away first
  const tmp = new Float32Array(w * h); for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0, r = y * w; x < w; x++) tmp[r + x] = (out[r + Math.max(0, x - 1)] + 2 * out[r + x] + out[r + Math.min(w - 1, x + 1)]) * .25;
    for (let y = 0; y < h; y++) for (let x = 0, r = y * w, ra = Math.max(0, y - 1) * w, rb = Math.min(h - 1, y + 1) * w; x < w; x++) out[r + x] = (tmp[ra + x] + 2 * tmp[r + x] + tmp[rb + x]) * .25; }
  return { N: w, hm: out }; }
