// Red Dust Outpost · Adventure surface recipes (v90)
// Each landing world gets its own ground: a tileable texture with two zones (loose sand/dust and bedrock),
// its own terrain shapes, a natural rock field and a far horizon. Mars is the benchmark.
// Science notes: SCIENCE.md (Jezero geology: Mars 2020 / HiRISE descriptions; rock sizes follow a power law as measured
// at the Viking, Pathfinder and Mars 2020 sites; Huygens saw rounded cobbles on Titan).
import * as THREE from 'three';

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); a *= .5; f *= 2; } return s; }
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// periodic (tileable) value noise: the lattice wraps every P cells
const hp = (x, y, P, s) => hash(((x % P) + P) % P + s * 17.3, ((y % P) + P) % P - s * 9.1);
function tvn(x, y, P, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hp(xi, yi, P, s), b = hp(xi + 1, yi, P, s), c = hp(xi, yi + 1, P, s), d = hp(xi + 1, yi + 1, P, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function tfbm(x, y, P, o, s) { let r = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { r += a * tvn(x * f, y * f, P * f, s + i); a *= .5; f *= 2; } return r; }
// sedimentary layers: flat treads and steep risers
const terrace = (h, st) => { const q = h / st, f = q - Math.floor(q); return (Math.floor(q) + ss(.6, 1, f)) * st; };

/* ---------------- recipes ---------------- */
// tile: metres per texture repeat · plates: bedrock fractured into plates · ripple: wind ripples in the sand zone
// clasts: small stones baked into the texture · bump: relief strength · rough: material roughness
// rock: rock shape (angular = broken, faceted; rounded = worn) · far: [height of the far horizon (m), radius where it peaks]
export const SURF = {
  mars: { tile: 14, plates: 7, ripple: 1, clasts: 260, bump: 1, rough: .93, rock: 'angular', rockN: 1.5, dust: .32,
    far: [170, 1500], C: { dust: '#a8603a', dust2: '#8f5232', sand: '#3a2b24', bed: '#c2a68e', rock: ['#4a3a32', '#5e4a3e', '#35302c', '#6e5848', '#57504a'], dustTop: '#b06c44' } },
};

/* Mars benchmark: the floor of Jezero Crater (procedural, guided by HiRISE / Mars 2020 descriptions).
   West: the eroded front of the ancient river delta, a layered escarpment ~30 m high. A delta remnant butte (like "Kodiak")
   to the south-east. Dark basaltic sand collects in the lows and forms ripple fields; pale fractured bedrock is exposed on
   higher ground and on every steep face; ochre dust covers the rest. The crater rim rises far beyond. */
SURF.mars.make = (seed, o = {}) => { const G = o.dem ? 0 : 1;   // G = 0 on real-elevation (DEM) sites: no invented landforms
  const edge = z => -270 + (fbm(z * .006 + 2.2, 3.1, 4) - .5) * 170;
  const butte = (x, z) => Math.hypot(x - 235, z + 255) / (72 + (fbm(x * .02, z * .02 + 5, 3) - .5) * 34);
  const dunes = (x, z) => ss(70, 150, z) * ss(390, 300, z) * ss(-120, -40, x) * ss(520, 420, x);
  const shape = (x, z, h) => {
    const r = Math.hypot(x, z), t = ss(edge(z) + 25, edge(z) - 70, x);
    let add = t * (30 + (fbm(x * .01, z * .01 + 9, 3) - .5) * 14), b = butte(x, z);
    if (b < 1.25) add = Math.max(add, ss(1.2, .7, b) * (30 + (fbm(x * .03, z * .03, 2) - .5) * 8));
    if (add > .5) add = terrace(add + (fbm(x * .05, z * .05 + 3, 2) - .5) * 1.6, 5.2);
    h += add;
    // transverse ripple ridges: ~24 m apart, up to ~1.6 m high, crests running north-west
    const d = dunes(x, z); if (d > 0) { const ph = (x * .78 + z * .62) / 24 * 6.283 + fbm(x * .01, z * .01 + 1, 3) * 5, p = (ph / 6.283) % 1, pr = p < .68 ? p / .68 : (1 - p) / .32; h += d * (pr * pr * 1.6 - .5); }
    // the crater rim: rising, uneven, terraced
    if (r > 500) { const q0 = r - 500, q = q0 * q0 / (q0 + 90), rid = Math.abs(fbm(x * .012 + 4, z * .012, 4) - .5) * 2; h += q * (.18 + .3 * fbm(x * .004 + 11, z * .004, 3)) + (1 - rid) * Math.min(1, q / 120) * 9; }
    return h; };
  const paint = (x, z, h, k, up, c, C) => {
    const sl = 1 - up, dn = fbm(x * .011 + 40, z * .011, 3), fine = fbm(x * .06, z * .06 + 7, 2);
    c.copy(C.dust).lerp(C.dust2, fine * .9);
    let rock = Math.max(ss(.1, .26, sl), ss(.52, .64, dn) * ss(.2, .55, k));
    const tread = G * (ss(edge(z) + 10, edge(z) - 30, x) + ss(1.15, .9, butte(x, z))); rock = Math.max(rock, Math.min(1, tread) * (.55 + .45 * ss(.06, .16, sl)));
    rock = Math.min(1, rock);
    let sand = Math.max(ss(.47, .3, k + (dn - .5) * .35), G * dunes(x, z) * .95) * (1 - rock);
    c.lerp(C.sand, Math.min(1, sand * 1.1)).lerp(C.bed, rock * .9);
    c.multiplyScalar(1 - ss(.3, .75, sl) * .22);
    return [rock, Math.min(1, sand + .5 * (1 - rock))]; };
  const hot = !G ? null : rnd => { if (rnd() < .6) { const z = (rnd() - .5) * 1300; return [edge(z) + 8 + rnd() * 45, z]; } const a = rnd() * 6.283, d = 1 + rnd() * .5; return [235 + Math.cos(a) * 74 * d, -255 + Math.sin(a) * 74 * d]; };
  return { shape, paint, hot, edge };
};

/* ---------------- ground texture (512², RGBA data) ----------------
   R: sand-zone albedo · G: sand-zone height · B: rock-zone albedo · A: rock-zone height */
const TEXC = {};
export function featTex(id) {
  if (TEXC[id]) return TEXC[id]; const R = SURF[id], N = 512, P = 16, d = new Uint8Array(N * N * 4), sh = new Float32Array(N * N), sa = new Float32Array(N * N), rh = new Float32Array(N * N), ra = new Float32Array(N * N), s = id.length * 7 + id.charCodeAt(1);
  const W = []; for (let k = 0; k < 3; k++) W.push([1 + Math.floor(hash(k, s) * 3), 1 + Math.floor(hash(s, k) * 3), hash(k * 3, s) * 6.283]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, u = x / N, v = y / N, g = tfbm(u * P, v * P, P, 4, s), g2 = tfbm(u * P * 4, v * P * 4, P * 4, 2, s + 9);
    let rp = 0; if (R.ripple) { let w = 0; for (const [a, b, ph] of W) w += Math.sin((a * u + b * v) * 6.283 + ph) * .55; const p = ((11 * u + 3 * v) * 1 + w / 6.283 * 1.6 + 8) % 1, pr = p < .7 ? p / .7 : (1 - p) / .3; rp = (pr * pr * (3 - 2 * pr)) * R.ripple * (.65 + .35 * tvn(u * 6, v * 6, 6, s)); }
    sh[i] = .25 + rp * .5 + g * .2 + g2 * .08; sa[i] = .7 + (g - .5) * .2 + (g2 - .5) * .14 + (rp - .5) * .05;
    rh[i] = .4 + g * .25 + g2 * .1; ra[i] = .74 + (g - .5) * .22 + (g2 - .5) * .16; }
  if (R.plates) { const C = R.plates, cs = N / C, pts = []; for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + .15 + hash(i, j + s) * .7) * cs, (j + .15 + hash(j + s, i) * .7) * cs]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ci = Math.floor(x / cs), cj = Math.floor(y / cs); let f1 = 1e9, f2 = 1e9, id1 = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = (ci + di + C) % C, jj = (cj + dj + C) % C, q = pts[jj * C + ii], px = q[0] + (ci + di - ii) * cs, py = q[1] + (cj + dj - jj) * cs, dd = Math.hypot(x - px, y - py); if (dd < f1) { f2 = f1; f1 = dd; id1 = jj * C + ii; } else if (dd < f2) f2 = dd; }
      const i = y * N + x, cr = ss(0, 3.2, f2 - f1), hv = hash(id1, s + 3);
      rh[i] = rh[i] * .35 + (.6 + hv * .25 - f1 / cs * .18) * cr + .08 * (1 - cr); ra[i] = ra[i] * .6 + (.3 + hv * .22) * cr + .1 * (1 - cr) + (1 - cr) * .14; } }
  if (R.pits) { const pr = rng(s + 5); for (let k = 0; k < R.pits; k++) { const cx = pr() * N, cy = pr() * N, r = 2 + Math.pow(pr(), 2.5) * 22, dep = .18 + pr() * .2, fresh = pr();
      for (let dy = -Math.ceil(r * 1.5); dy <= Math.ceil(r * 1.5); dy++) for (let dx = -Math.ceil(r * 1.5); dx <= Math.ceil(r * 1.5); dx++) { const d2 = Math.hypot(dx, dy) / r; if (d2 >= 1.5) continue; const X = (Math.floor(cx) + dx + N) % N, Y = (Math.floor(cy) + dy + N) % N, i = Y * N + X;
        const prof = d2 < 1 ? (d2 * d2 - 1) * dep : (1.5 - d2) * 2 * .3 * dep * (d2 - 1) * 4; sh[i] += prof; rh[i] += prof * .7; if (d2 < 1.25 && fresh > .8) { sa[i] += .05 * (1.25 - d2); ra[i] += .04; } } } }
  if (R.lineae) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N, i = y * N + x; let l = 0;
      for (let k = 0; k < 5; k++) { const a = 1 + (k % 3), b = (k * 2 + 1) % 4 - 1, f = Math.abs(Math.sin((a * u + b * v) * 6.283 * (4 + k * 3) + k)); l = Math.max(l, Math.pow(1 - f, 14)); }
      sh[i] += l * .25; rh[i] += l * .2; sa[i] -= l * .1; ra[i] -= l * .08; } }
  const rr = rng(s); for (let k = 0; k < (R.clasts || 0); k++) { const cx = rr() * N, cy = rr() * N, r = 1.4 + Math.pow(rr(), 3) * 7, th = rr() * 6.283, el = .6 + rr() * .4, hh = .25 + rr() * .3, al = rr() < .5 ? -.22 : .14, sides = 5 + Math.floor(rr() * 3), zone = rr();
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) { const a = Math.atan2(dy, dx) - th, poly = Math.cos(Math.PI / sides) / Math.cos(((a % (6.283 / sides)) + 6.283 / sides) % (6.283 / sides) - Math.PI / sides), dd = Math.hypot(dx, dy * (1 / el)) / (r * poly); if (dd >= 1) continue;
      const X = (Math.floor(cx) + dx + N) % N, Y = (Math.floor(cy) + dy + N) % N, i = Y * N + X, b = Math.sqrt(1 - dd * dd) * hh;
      if (zone < .55) { sh[i] += b; sa[i] += al * (1 - dd * .5); } else { rh[i] += b * .8; ra[i] += al * .8 * (1 - dd * .5); } } }
  const q = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let i = 0; i < N * N; i++) { d[i * 4] = q(sa[i]); d[i * 4 + 1] = q(sh[i]); d[i * 4 + 2] = q(ra[i]); d[i * 4 + 3] = q(rh[i]); }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return (TEXC[id] = t);
}

// shader pieces for the terrain material
export const GLSL_HEAD = `uniform sampler2D ftex; uniform float ftile, fbump; varying vec2 vZn;
vec3 rdoBump(vec3 sp, vec3 sn, vec2 dh, float fd) { vec3 sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, sn), r2 = cross(sn, sx); float det = dot(sx, r1) * fd; vec3 gr = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * sn - gr); }
float rdoH(vec2 u, float z) { vec4 f = texture2D(ftex, u); return mix(f.g, f.a, z); }`;
export const GLSL_ALB = `{ vec2 fu = vTWP.xz / ftile, fu2 = mat2(.8, -.6, .6, .8) * fu * .37 + .21; float wv = smoothstep(.72, .84, texture2D(map, vMapUv * .017 + .3).r);
  vec4 f1 = texture2D(ftex, fu), f2 = texture2D(ftex, fu2); vec4 f = mix(f1, f2, wv); float alb = mix(f.r, f.b, vZn.x);
  diffuseColor.rgb *= .5 + .68 * alb; }`;
export const GLSL_BUMP = `{ float dist = length(vTWP - cameraPosition), fade = 1. - smoothstep(45., 170., dist);
  if (fade > 0.) { vec2 fu = vTWP.xz / ftile, fu2 = mat2(.8, -.6, .6, .8) * fu * .37 + .21, dx = dFdx(fu), dy = dFdy(fu); float wv = smoothstep(.72, .84, texture2D(map, vMapUv * .017 + .3).r);
    float z = vZn.x, amp = fbump * mix(vZn.y, 1., z) * fade, h0 = mix(rdoH(fu, z), rdoH(fu2, z), wv), hx = mix(rdoH(fu + dx, z), rdoH(fu2 + mat2(.8, -.6, .6, .8) * dx * .37, z), wv), hy = mix(rdoH(fu + dy, z), rdoH(fu2 + mat2(.8, -.6, .6, .8) * dy * .37, z), wv);
    normal = rdoBump(-vViewPosition, normal, vec2(hx - h0, hy - h0) * amp, faceDirection); } }`;

/* far horizon: a ring of terrain from the edge of the walkable area out to the sky, so the world never ends in a cliff
   (airless worlds have no haze to hide an edge) */
export function farRing(id, H, size, W, R) {
  const r0 = size * .49, r1 = 3300, th = 160, rs = 14, pos = [], cols = [], idx = [], c = new THREE.Color(), C0 = new THREE.Color(W.gr[0]), C1 = new THREE.Color(W.gr[1]), C2 = new THREE.Color(W.gr[2]);
  const [pk, pr] = R && R.far ? R.far : [W.amp * 4 + 10, 1700];
  for (let j = 0; j <= rs; j++) { const f = j / rs, r = r0 + (r1 - r0) * Math.pow(f, 1.6);
    for (let i = 0; i <= th; i++) { const a = i / th * 6.283, x = Math.cos(a) * r, z = Math.sin(a) * r, e = j === 0 ? H(x, z) : null;
      const ridge = fbm(Math.cos(a) * 3 + 20, Math.sin(a) * 3 + r * .0015, 5), prof = Math.exp(-Math.pow((r - pr) / (pr * .55), 2)), hf = pk * prof * (.35 + ridge * 1.2) - (r > pr ? (r - pr) * .03 : 0);
      const y = j === 0 ? e : THREE.MathUtils.lerp(H(Math.cos(a) * r0, Math.sin(a) * r0), hf, ss(r0, r0 + 360, r));
      pos.push(x, y, z); const k = Math.min(1, Math.max(0, .45 + ridge * .5 - prof * .1)); if (k < .5) c.copy(C0).lerp(C1, k * 2); else c.copy(C1).lerp(C2, (k - .5) * 2); if (R && R.C) c.lerp(new THREE.Color(R.C.dust), .5); cols.push(c.r, c.g, c.b); } }
  for (let j = 0; j < rs; j++) for (let i = 0; i < th; i++) { const a = j * (th + 1) + i, b = a + th + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); m.receiveShadow = false; return m;
}

/* rock field: seeded; clustered on crater rims, at the foot of scarps and in loose groups; sizes follow a power law
   (many pebbles, few boulders); partly buried; rocks wear a coat of dust on their tops where there is dust */
function rockShape(kind, seed, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new THREE.Vector3(), rr = rng(seed * 977 + 13);
  if (kind === 'angular') { const cuts = []; for (let k = 0; k < 7; k++) { const n = new THREE.Vector3(rr() - .5, (rr() - .5) * .9, rr() - .5).normalize(); cuts.push([n, .45 + rr() * .4]); }
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); for (const [n, dd] of cuts) { const e = v.dot(n) - dd; if (e > 0) v.addScaledVector(n, -e); } v.y *= .66; v.x *= 1 + rr() * .02; p.setXYZ(i, v.x, v.y, v.z); } }
  else for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 2) * .2 + Math.sin(v.z * 5.3 + seed * 3) * .08; v.multiplyScalar(1 + n); v.y *= .6; p.setXYZ(i, v.x, v.y, v.z); }
  const out = kind === 'angular' ? g.toNonIndexed() : g; out.computeVertexNormals(); return out;
}
export function rockField(scene, H, id, R, count, area, avoid, craters) {
  const rr = rng(id.length * 31 + id.charCodeAt(0)), C = R.C, cols = C.rock.map(h => new THREE.Color(h)), dustC = { value: new THREE.Color(C.dustTop || C.dust) }, dustK = { value: R.dust || 0 };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: R.rough, metalness: 0, flatShading: R.rock === 'angular' });
  mat.onBeforeCompile = sh => { sh.uniforms.dustC = dustC; sh.uniforms.dustK = dustK; sh.fragmentShader = 'uniform vec3 dustC; uniform float dustK;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    { float up = (vec4(normal, 0.) * viewMatrix).y; diffuseColor.rgb = mix(diffuseColor.rgb, dustC, smoothstep(.45, .9, up) * dustK); }`); };
  const pick = () => { const u = rr();
    if (u < .3 && craters.length) { const [cx, cz, r] = craters[Math.floor(rr() * craters.length)], a = rr() * 6.283, d = r * (.85 + Math.pow(rr(), 1.6) * .9); return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; }
    if (u < .55 && R.hot) return R.hot(rr);
    if (u < .85) { const a = rr() * 6.283, d = rr() * area, cx = Math.cos(a) * d, cz = Math.sin(a) * d, s = 4 + rr() * 14; return [cx + (rr() + rr() - 1) * s, cz + (rr() + rr() - 1) * s]; }
    const a = rr() * 6.283, d = Math.sqrt(rr()) * area; return [Math.cos(a) * d, Math.sin(a) * d]; };
  const big = [], small = []; let tries = 0;
  while (big.length + small.length < count && tries++ < count * 9) { const [x, z] = pick(); if (Math.hypot(x, z) > area * 1.05 || (avoid && avoid(x, z))) continue;
    { const g = Math.hypot(H(x + 1.5, z) - H(x - 1.5, z), H(x, z + 1.5) - H(x, z - 1.5)) / 3; if (rr() > .4 + Math.min(.6, g * 2.2)) continue; }   // blocks gather on slopes, crater walls and scarps
    const s = Math.min(3.2, .07 * Math.pow(1 - rr() * .999, -1 / 1.55)); (s > .45 ? big : small).push([x, z, s]); }
  const out = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const put = (list, detail) => { const geos = [0, 1, 2].map(k => rockShape(R.rock, k + id.length, detail)), per = Math.ceil(list.length / 3);
    geos.forEach((geo, k) => { const part = list.slice(k * per, (k + 1) * per); if (!part.length) return; const im = new THREE.InstancedMesh(geo, mat, part.length); im.castShadow = detail > 1; im.receiveShadow = true;
      part.forEach(([x, z, s], j) => { e.set((rr() - .5) * .5, rr() * 6.283, (rr() - .5) * .5); q.setFromEuler(e); sc.set(s * (.75 + rr() * .6), s * (.8 + rr() * .4), s * (.75 + rr() * .6)); p.set(x, H(x, z) - s * (.12 + rr() * .3) * .6, z);
        m4.compose(p, q, sc); im.setMatrixAt(j, m4); c.copy(cols[Math.floor(rr() * cols.length)]).multiplyScalar((.82 + rr() * .3) * .74); im.setColorAt(j, c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im); out.push(im); }); };
  put(big, 2); put(small, 1); out.stats = { big: big.length, small: small.length }; return out;
}

/* near-field stones: thousands of cobbles and pebbles in a disc that follows the explorer. Each 2 m ground cell always
   holds the same stones (hashed from its position), so walking never makes them pop or shuffle. */
export function pebbleField(scene, H, id, R, n, avoid) {
  const RAD = 38, CELL = 2, cols = R.C.rock.map(h => new THREE.Color(h)), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: R.rough, metalness: 0, flatShading: R.rock === 'angular' });
  const dustC = { value: new THREE.Color(R.C.dustTop || R.C.dust) }, dustK = { value: R.dust || 0 };
  mat.onBeforeCompile = sh => { sh.uniforms.dustC = dustC; sh.uniforms.dustK = dustK; sh.fragmentShader = 'uniform vec3 dustC; uniform float dustK;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    { float up = (vec4(normal, 0.) * viewMatrix).y; diffuseColor.rgb = mix(diffuseColor.rgb, dustC, smoothstep(.45, .9, up) * dustK); }`); };
  const ims = [0, 1].map(k => { const im = new THREE.InstancedMesh(rockShape(R.rock, 7 + k, 1), mat, Math.ceil(n / 2)); im.count = 0; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false; scene.add(im); return im; });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(); let lx = 1e9, lz = 1e9;
  function update(px, pz) { if (Math.hypot(px - lx, pz - lz) < 3) return; lx = px; lz = pz; const cnt = [0, 0], cap = ims[0].instanceMatrix.count;
    const i0 = Math.floor((px - RAD) / CELL), i1 = Math.floor((px + RAD) / CELL), j0 = Math.floor((pz - RAD) / CELL), j1 = Math.floor((pz + RAD) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = (i + .5) * CELL, cz = (j + .5) * CELL; if (Math.hypot(cx - px, cz - pz) > RAD) continue;
      const patch = fbm(cx * .045 + 3, cz * .045, 2), k = Math.floor(hash(i, j) * 4 * patch * patch * 2.2);
      for (let s = 0; s < k; s++) { const h1 = hash(i * 7 + s, j * 3 - s), h2 = hash(j * 5 + s, i * 11 + s), h3 = hash(i + s * 13, j + s * 17), x = (i + h1) * CELL, z = (j + h2) * CELL; if (avoid && avoid(x, z)) continue;
        const w = (i + j + s) & 1; if (cnt[w] >= cap) continue; const sz = Math.min(.55, .045 * Math.pow(1 - h3 * .995, -1 / 1.7));
        e.set((h1 - .5) * .6, h2 * 6.283, (h3 - .5) * .6); q.setFromEuler(e); sc.set(sz * (.8 + h2 * .5), sz * (.7 + h1 * .5), sz * (.8 + h3 * .5)); p.set(x, H(x, z) - sz * .22, z); m4.compose(p, q, sc);
        const im = ims[w]; im.setMatrixAt(cnt[w], m4); c.copy(cols[Math.floor(hash(i - s, j + s) * cols.length)]).multiplyScalar((.8 + h1 * .35) * .74); im.setColorAt(cnt[w], c); cnt[w]++; } }
    ims.forEach((im, w) => { im.count = cnt[w]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }); }
  return { update, ims };
}

/* ---------------- the other five worlds, built to the Mars standard ---------------- */
// common painter: a three-step colour ramp by height, bedrock / blocky zone on steep ground and in patches,
// young bright ejecta around some craters (airless worlds), plus each world's own features (o.extra)
function painter(o) { const lo = new THREE.Color(o.lo), mid = new THREE.Color(o.mid), hi = new THREE.Color(o.hi), rk = new THREE.Color(o.rockZ), t = new THREE.Color();
  return (x, z, h, k, up, c, C, craters) => { const sl = 1 - up, dn = fbm(x * .009 + 70, z * .009, 3), fine = fbm(x * .05 + 3, z * .05, 2), kk = Math.min(1, Math.max(0, k + (fine - .5) * .25));
    if (kk < .5) c.copy(lo).lerp(mid, kk * 2); else c.copy(mid).lerp(hi, (kk - .5) * 2);
    let rock = Math.min(1, Math.max(ss(o.slope[0], o.slope[1], sl), ss(.6, .72, dn) * (o.patch || 0)));
    if (o.ejecta && craters) for (const [cx, cz, r, young] of craters) { if (!young || r > 45) continue; const d = Math.hypot(x - cx, z - cz) / r; if (d < 2.1) { const e = ss(2.1, 1.05, d) * (d > .85 ? 1 : .5); c.lerp(t.set(o.ejecta), e * .4); rock = Math.max(rock, ss(1.5, 1, d) * .8); } }
    c.lerp(rk, rock * (o.rockMix || .5));
    let rip = o.ripple ? (1 - rock) * ss(.5, .3, kk) : .75;
    if (o.extra) rip = o.extra(x, z, h, kk, sl, c, rock, rip);
    c.multiplyScalar(1 - ss(.3, .8, sl) * (o.slopeDark || .2));
    return [rock, Math.min(1, rip)]; }; }

// MOON: mature grey regolith peppered with micro-craters; blocky, brighter ejecta around young craters; no wind, no ripples
Object.assign(SURF, {
  moon: { tile: 9, pits: 260, clasts: 300, bump: .9, rough: .98, rock: 'angular', rockN: 1.2, dust: .25, far: [70, 1400],
    C: { dust: '#77736d', rock: ['#5a5753', '#6e6a65', '#47443f', '#83807a'], dustTop: '#8a8680' },
    make: (seed, o = {}) => ({ paint: painter({ lo: '#55524e', mid: '#77736d', hi: '#97938c', rockZ: '#8a867f', slope: [.12, .34], patch: .4, ejecta: '#b4b0a8', slopeDark: .1 }) }) },
  // MERCURY: darker and browner than the Moon (low-reflectance material), bright bluish "hollows" (MESSENGER), and a lobate thrust scarp
  mercury: { tile: 9, pits: 300, clasts: 260, bump: .9, rough: .97, rock: 'angular', rockN: 1.1, dust: .2, far: [110, 1500],
    C: { dust: '#5e5954', rock: ['#4a4642', '#57524d', '#3c3936', '#6a655f'], dustTop: '#6a655f' },
    make: (seed, o = {}) => { const G = o.dem ? 0 : 1, scarp = (x, z) => 230 + Math.sin(z * .004 + 1) * 90 + (fbm(z * .01, 4, 3) - .5) * 40;
      return { shape: (x, z, h) => h + G * ss(scarp(x, z) + 20, scarp(x, z) - 25, x) * (26 + (fbm(x * .01, z * .01, 3) - .5) * 10),
        paint: painter({ lo: '#46423e', mid: '#5f5a54', hi: '#7a746c', rockZ: '#6e6862', slope: [.12, .34], patch: .35, ejecta: '#9c9890', slopeDark: .1,
          extra: (x, z, h, k, sl, c, rock, rip) => { const hv = fbm(x * .03 + 21, z * .03, 3); if (hv > .66) c.lerp(new THREE.Color('#9fb0c4'), ss(.66, .74, hv) * .7); return rip; } }) }; } },
  // EUROPA (Conamara Chaos): bright water ice; double ridges with reddish-brown salts along them; tilted ice rafts in a darker hummocky matrix
  europa: { tile: 11, lineae: 1, clasts: 90, bump: .8, rough: .55, rock: 'angular', rockN: .7, dust: 0, far: [30, 1400],
    C: { dust: '#909497', rock: ['#a4a8ac', '#94989c', '#82796e', '#b0b3b6'], dustTop: '#b0b3b6' },
    make: (seed, o = {}) => { const G = o.dem ? 0 : 1;
      const ridge = (x, z) => { let m = 0; for (let i = 0; i < 4; i++) { const a = i * 1.1 + .4, d = Math.abs((x * Math.cos(a) + z * Math.sin(a)) - (i * 170 - 260) + (fbm(x * .003 + i, z * .003, 2) - .5) * 60); m = Math.max(m, ss(30, 9, d) * (1 - ss(5, 0, d) * .6)); } return m; };
      const raft = (x, z) => { const v = fbm(x * .006 + 9, z * .006 - 4, 3); return ss(.53, .57, v); };
      return { shape: (x, z, h) => h + G * (ridge(x, z) * 13 + raft(x, z) * (7 + (fbm(x * .02, z * .02, 2) - .5) * 4) + (1 - raft(x, z)) * (fbm(x * .08, z * .08 + 7, 2) - .5) * 2.2),
        paint: painter({ lo: '#6e6256', mid: '#8c9093', hi: '#a2a6aa', rockZ: '#9ca1a5', slope: [.15, .4], patch: 0, slopeDark: .05,
          extra: (x, z, h, k, sl, c, rock, rip) => { const r = G * ridge(x, z), m = G * (1 - raft(x, z)); c.lerp(new THREE.Color('#7a4a30'), r * .7).lerp(new THREE.Color('#9a7a60'), m * .6 * ss(.35, .6, fbm(x * .02, z * .02, 2))); return .2 + r * .5; } }) }; } },
  // TITAN (Kraken Mare shore): dark organic sand in long east-west dunes, rounded water-ice cobbles (as Huygens saw), damp dark ground by the sea
  titan: { tile: 12, ripple: .8, clasts: 200, bump: .9, rough: .9, rock: 'rounded', rockN: 1, dust: .15, far: [45, 1600],
    C: { dust: '#5a4024', rock: ['#6a604e', '#786c58', '#5a5242', '#84775f'], dustTop: '#6a4c2c' },
    make: (seed, o = {}) => { const G = o.dem ? 0 : 1, dune = (x, z) => { const ph = z / 110 * 6.283 + fbm(x * .004, z * .004 + 2, 3) * 4; const p = (((ph / 6.283) % 1) + 1) % 1; return Math.pow(Math.sin(p * 3.1416), 2); };
      return { shape: (x, z, h) => h + G * ss(-40, -160, x) * dune(x, z) * 7,
        paint: painter({ lo: '#2e2214', mid: '#4f3820', hi: '#6e5232', rockZ: '#7a6a52', slope: [.14, .38], patch: .25, ripple: 1, slopeDark: .15,
          extra: (x, z, h, k, sl, c, rock, rip) => { if (x > 250) c.multiplyScalar(1 - ss(250, 330, x) * .45); const d = G * ss(-40, -160, x) * dune(x, z); c.lerp(new THREE.Color('#3a2a16'), d * .4); return Math.max(rip, d); } }) }; } },
  // CERES (Occator Crater): very dark grey regolith, bright sodium-carbonate faculae on the crater floor, the crater wall far away
  ceres: { tile: 9, pits: 220, clasts: 220, bump: .85, rough: .97, rock: 'rounded', rockN: 1, dust: .15, far: [160, 1500],
    C: { dust: '#55555a', rock: ['#4a4a4f', '#5a5a60', '#3a3a3e', '#66666c'], dustTop: '#606066' },
    make: (seed, o = {}) => ({ paint: painter({ lo: '#323236', mid: '#48484d', hi: '#606066', rockZ: '#66666c', slope: [.12, .34], patch: .3, ejecta: '#85858c', slopeDark: .1,
      extra: (x, z, h, k, sl, c, rock, rip) => { const n = fbm(x * .02 + 5, z * .02, 3), d = Math.hypot(x - 90, z + 70) - (30 + n * 14), fr = Math.abs(Math.sin((x + z) * .09 + n * 6)); c.lerp(new THREE.Color('#f2f4f6'), ss(16, -4, d) * (.75 + .25 * ss(.15, .5, fr))); return rip; } }) }) },
});
