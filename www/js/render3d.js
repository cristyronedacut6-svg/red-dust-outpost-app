/* Red Dust Outpost · mid-poly 3D view
   A small WebGL1 renderer with no libraries. The game logic stays 2D (x, y on the ground);
   this file draws the same world in 3D: x → X, y → Z, and height → Y. */
(function () {
  'use strict';
  const R3 = window.R3 = { yaw: 0, zoom: 1, ok: false, want: false };
  let gl, c3, prog, U = {}, vb, sb, texBg, texFog, texDec, DEC, DX, last = { bg: -9, fog: -9 }, staticN = 0, staticLv = -1;
  const DS = 512, FL = 11; // decal size, floats per vertex
  let buf = new Float32Array(FL * 60000), n = 0, tbuf = new Float32Array(FL * 12000), tn = 0;
  let VP = null, EYE = [0, 0, 0], BAS = null, TGT = { x: 700, y: 450 }, yawS = 0, zoomS = 1, pitS = .95, rectT = 0, prog2, U2 = {}, qb;
  R3.pitch = .75;
  const memo = new WeakMap();
  const try_ = f => { try { return f(); } catch (e) { return null; } };

  /* ---------- math ---------- */
  function persp(fy, a, nr, fr) { const f = 1 / Math.tan(fy / 2), d = nr - fr; return [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fr + nr) / d, -1, 0, 0, 2 * fr * nr / d, 0]; }
  function look(e, t, u) {
    let z = [e[0] - t[0], e[1] - t[1], e[2] - t[2]]; z = nrm(z); let x = nrm(cross(u, z)); const y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  }
  function mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /* ---------- colors ---------- */
  const CC = {};
  function col(c) {
    if (Array.isArray(c)) return c;
    if (CC[c]) return CC[c];
    let r = [1, 1, 1];
    if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); r = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }
    else if (c.startsWith('hsl')) { const m = c.match(/[\d.]+/g).map(Number); r = hsl(m[0] / 360, m[1] / 100, m[2] / 100); return r; }
    return (CC[c] = r);
  }
  function hsl(h, s, l) { const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }

  /* ---------- primitives: [x,y,z, nx,ny,nz] per vertex, flat normals ---------- */
  function mk(tris) { const o = []; for (const t of tris) { const [a, b, c] = t, nn = nrm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); [a, b, c].forEach(v => o.push(v[0], v[1], v[2], nn[0], nn[1], nn[2])); } return new Float32Array(o); }
  function quad(a, b, c, d) { return [[a, b, c], [a, c, d]]; }
  const BOX = (() => { const p = (x, y, z) => [x - .5, y, z - .5]; const v = [p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0), p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)];
    return mk([...quad(v[4], v[5], v[6], v[7]), ...quad(v[1], v[0], v[3], v[2]), ...quad(v[5], v[1], v[2], v[6]), ...quad(v[0], v[4], v[7], v[3]), ...quad(v[3], v[7], v[6], v[2]), ...quad(v[0], v[1], v[5], v[4])]); })();
  function ring(k, r, y, off = 0) { const o = []; for (let i = 0; i < k; i++) { const a = (i + off) / k * Math.PI * 2; o.push([Math.cos(a) * r, y, Math.sin(a) * r]); } return o; }
  function cylP(k) { const b = ring(k, .5, 0), t = ring(k, .5, 1), tr = []; for (let i = 0; i < k; i++) { const j = (i + 1) % k; tr.push(...quad(b[i], t[i], t[j], b[j])); tr.push([[0, 1, 0], t[j], t[i]]); tr.push([[0, 0, 0], b[i], b[j]]); } return mk(tr); }
  function coneP(k) { const b = ring(k, .5, 0), tr = []; for (let i = 0; i < k; i++) { const j = (i + 1) % k; tr.push([b[i], [0, 1, 0], b[j]]); tr.push([[0, 0, 0], b[i], b[j]]); } return mk(tr); }
  function sphP(hemi) { // low-poly sphere (lat-long 6x4) of radius .5, sitting on y=0
    const la = hemi ? 3 : 5, lo = 7, pt = (i, j) => { const th = (hemi ? i / la * Math.PI / 2 : i / la * Math.PI) , ph = j / lo * Math.PI * 2; const s = Math.sin(th); return [Math.cos(ph) * s * .5, (hemi ? 0 : .5) + Math.cos(th) * .5, Math.sin(ph) * s * .5]; };
    const tr = []; for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j); if (i === 0) tr.push([a, c, d]); else tr.push(...quad(a, b, c, d).map(t => [t[0], t[2], t[1]]).map(t => [t[0], t[2], t[1]])); }
    if (hemi) { const r = ring(lo, .5, 0); for (let j = 0; j < lo; j++) tr.push([[0, 0, 0], r[(j + 1) % lo], r[j]]); }
    return mk(tr.map(t => fixWind(t, hemi ? [0, 0, 0] : [0, .5, 0])));
  }
  function fixWind(t, c) { const [a, b, d] = t, nn = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - a[0], d[1] - a[1], d[2] - a[2]]), m = [(a[0] + b[0] + d[0]) / 3 - c[0], (a[1] + b[1] + d[1]) / 3 - c[1], (a[2] + b[2] + d[2]) / 3 - c[2]]; return dot(nn, m) < 0 ? [a, d, b] : t; }
  function tubeP(k) { const b = ring(k, .5, 0), t = ring(k, .5, 1), tr = []; for (let i = 0; i < k; i++) { const j = (i + 1) % k; tr.push(...quad(b[i], t[i], t[j], b[j])); } return mk(tr); }
  const TUBE = tubeP(14), CYL = cylP(8), CYL5 = cylP(5), CONE = coneP(7), CONE4 = coneP(4), SPH = sphP(false), HEMI = sphP(true);
  // smooth mid-poly versions, swapped in automatically on High graphics
  function sphS(la, lo, hemi) {
    const o = [], P = (i, j) => { const th = hemi ? i / la * Math.PI / 2 : i / la * Math.PI, ph = j / lo * Math.PI * 2, s = Math.sin(th), nx = Math.cos(ph) * s, ny = Math.cos(th), nz = Math.sin(ph) * s; return [nx * .5, (hemi ? 0 : .5) + ny * .5, nz * .5, nx, ny, nz]; };
    const T3 = (a, b, c) => o.push(...a, ...b, ...c);
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j); if (i > 0) T3(a, b, c); if (hemi || i < la - 1) T3(a, c, d); }
    if (hemi) for (let j = 0; j < lo; j++) { const a = j / lo * Math.PI * 2, b = (j + 1) / lo * Math.PI * 2; T3([0, 0, 0, 0, -1, 0], [Math.cos(a) * .5, 0, Math.sin(a) * .5, 0, -1, 0], [Math.cos(b) * .5, 0, Math.sin(b) * .5, 0, -1, 0]); }
    return new Float32Array(o);
  }
  function cylS(k, cap) {
    const o = [], V = (a, y, nx, ny, nz) => o.push(Math.cos(a) * .5, y, Math.sin(a) * .5, nx, ny, nz);
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, b = (i + 1) / k * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      V(a, 0, ca, 0, sa); V(a, 1, ca, 0, sa); V(b, 1, cb, 0, sb); V(a, 0, ca, 0, sa); V(b, 1, cb, 0, sb); V(b, 0, cb, 0, sb);
      if (cap) { o.push(0, 1, 0, 0, 1, 0); V(b, 1, 0, 1, 0); V(a, 1, 0, 1, 0); o.push(0, 0, 0, 0, -1, 0); V(a, 0, 0, -1, 0); V(b, 0, 0, -1, 0); } }
    return new Float32Array(o);
  }
  function coneS(k) {
    const o = [], q = 1 / Math.hypot(1, .5);
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, b = (i + 1) / k * Math.PI * 2, m = (a + b) / 2;
      o.push(Math.cos(a) * .5, 0, Math.sin(a) * .5, Math.cos(a) * q, .5 * q, Math.sin(a) * q, 0, 1, 0, Math.cos(m) * q, .5 * q, Math.sin(m) * q, Math.cos(b) * .5, 0, Math.sin(b) * .5, Math.cos(b) * q, .5 * q, Math.sin(b) * q);
      o.push(0, 0, 0, 0, -1, 0, Math.cos(a) * .5, 0, Math.sin(a) * .5, 0, -1, 0, Math.cos(b) * .5, 0, Math.sin(b) * .5, 0, -1, 0); }
    return new Float32Array(o);
  }
  // faceted boulders and mountains (flat shaded on purpose: chunky rock look)
  function rockP(seed) {
    let s = seed; const r = () => (s = s * 16807 % 2147483647) / 2147483647, la = 7, lo = 12, R = [];
    for (let i = 0; i <= la; i++) { R.push([]); for (let j = 0; j < lo; j++) R[i].push(.78 + r() * .3); }
    const pt = (i, j) => { j %= lo; const th = i / la * Math.PI, ph = j / lo * Math.PI * 2, rr = i === 0 ? .85 : i === la ? 1 : R[i][j], s2 = Math.sin(th); return [Math.cos(ph) * s2 * .5 * rr, Math.max(0, .5 + Math.cos(th) * .5 * rr), Math.sin(ph) * s2 * .5 * rr]; };
    const tr = []; for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j); if (i > 0) tr.push([a, b, c]); if (i < la - 1) tr.push([a, c, d]); }
    return mk(tr.map(t => fixWind(t, [0, .45, 0])));
  }
  function mtnP(seed) {
    let s = seed; const r = () => (s = s * 16807 % 2147483647) / 2147483647, k = 16, RR = [1, .86, .7, .52, .34, .16], HH = [0, .18, .38, .58, .78, .93], rings = [];
    for (let i = 0; i < RR.length; i++) { const row = []; for (let j = 0; j < k; j++) { const a = j / k * Math.PI * 2 + (i ? (r() - .5) * .3 : 0), rr = RR[i] * (i ? .75 + r() * .5 : .9 + r() * .2); row.push([Math.cos(a) * .5 * rr, HH[i] * (i ? .85 + r() * .3 : 1), Math.sin(a) * .5 * rr]); } rings.push(row); }
    const top = [(r() - .5) * .12, 1, (r() - .5) * .12], tr = [];
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < k; j++) { const a = rings[i][j], b = rings[i][(j + 1) % k], c = rings[i + 1][(j + 1) % k], d = rings[i + 1][j]; tr.push([a, c, b], [a, d, c]); }
    const L = rings[rings.length - 1]; for (let j = 0; j < k; j++) tr.push([L[j], top, L[(j + 1) % k]]);
    return mk(tr.map(t => fixWind(t, [0, .25, 0])));
  }
  const SPHh = sphS(9, 16, false), HEMIh = sphS(6, 20, true), CYLh = cylS(18, true), TUBEh = cylS(22, false), CONEh = coneS(16);
  const SPHu = sphS(12, 22, false), HEMIu = sphS(8, 26, true), CYLu = cylS(28, true), TUBEu = cylS(32, false), CONEu = coneS(26);
  const ROCKS = [rockP(7), rockP(19), rockP(33), rockP(51)], MTNS = [mtnP(3), mtnP(11), mtnP(29), mtnP(47)];
  const CYLm = cylS(12, true), SPHm = sphS(6, 10, false);
  const HQm = new Map([[SPH, SPHh], [HEMI, HEMIh], [CYL, CYLh], [TUBE, TUBEh], [CONE, CONEh]]); let HQ = true, ULT = false;
  const LODF = new Map([[SPH, [SPHm, SPHm, SPHh, SPHu]], [HEMI, [HEMI, HEMI, HEMIh, HEMIu]], [CYL, [CYL, CYL, CYLh, CYLu]], [TUBE, [TUBE, TUBE, TUBEh, TUBEu]], [CONE, [CONE, CONE, CONEh, CONEu]], [CYLm, [CYL5, CYLm, CYLm, CYLm]]]);
  const HQu = new Map([[SPH, SPHu], [HEMI, HEMIu], [CYL, CYLu], [TUBE, TUBEu], [CONE, CONEu]]); // buildings are drawn once, so they get the smoothest shapes

  /* ---------- batching ---------- */
  function put(P, x, y, z, sx, sy, sz, ry, rx, c, e, al, T) {
    let lodK = 1; if (!ULT && !GLW) { const L = LODF.get(P); if (L || P === BOX || P === SPHm) { const mx_ = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz)); lodK = mx_ / (Math.hypot(x - EYE[0], y - EYE[1], z - EYE[2]) + 4);
        if (lodK < .007) return; // smaller than a pixel or two: skip
        if (L) { P = (lodK < .025 && P === SPH && !T) ? SPH : L[lodK < .1 ? 0 : lodK < .3 ? 1 : (HDM && lodK > .55 && !T) ? 3 : 2]; } else if (P === SPHm) { if (lodK < .06) P = SPH; } else if (HDM && REAL && !T && mx_ > 2.5 && lodK > .06) P = RBOX; } }
    else if (HDM && !T) { const mx_ = Math.max(sx, sy, sz); if (P === BOX) { if (REAL && mx_ > 2.5) P = RBOX; } else if (mx_ > 6) { const u = HQu.get(P); if (u) P = u; } }
    if (HDM && !T && !GLW && e >= 1.5 && sx < 9 && sy < 9 && sz < 9 && lodK > .045) { GLW = true; try { put(SPHm, x, y + sy * .5 - sy * 1.4, z, sx * 2.8, sy * 2.8, sz * 2.8, 0, 0, c, 2, .17, true); } finally { GLW = false; } }
    if (HQ && ULT) { const h = HQu.get(P); if (h) P = h; } if (HDM) { if (T && P === BOX) P = SPHm; if (TER && !NOLIFT) y += THc(x, z); }
    const C = col(c), a = al == null ? 1 : al, cr = Math.cos(ry || 0), sr = Math.sin(ry || 0), cx = Math.cos(rx || 0), sxr = Math.sin(rx || 0);
    let B = T ? tbuf : buf, N = T ? tn : n; const need = (N + P.length / 6) * FL;
    if (need > B.length) { const nb = new Float32Array(Math.max(need, B.length * 2)); nb.set(B); B = nb; if (T) tbuf = B; else buf = B; }
    for (let i = 0; i < P.length; i += 6) {
      let px = P[i] * sx, py = P[i + 1] * sy, pz = P[i + 2] * sz, nx = P[i + 3] / sx, ny = P[i + 4] / sy, nz = P[i + 5] / sz;
      let t = py * cx - pz * sxr; pz = py * sxr + pz * cx; py = t; t = ny * cx - nz * sxr; nz = ny * sxr + nz * cx; ny = t;
      t = px * cr - pz * sr; pz = px * sr + pz * cr; px = t; t = nx * cr - nz * sr; nz = nx * sr + nz * cr; nx = t;
      const l = Math.hypot(nx, ny, nz) || 1, o = N * FL;
      B[o] = px + x; B[o + 1] = py + y; B[o + 2] = pz + z; B[o + 3] = nx / l; B[o + 4] = ny / l; B[o + 5] = nz / l; B[o + 6] = C[0]; B[o + 7] = C[1]; B[o + 8] = C[2]; B[o + 9] = a; B[o + 10] = e || 0; N++;
    }
    if (T) tn = N; else n = N;
  }
  // shorthand: thing at ground point (gx, gy) of the 2D world
  const box = (gx, gy, h, w, ht, d, c, e, ry, rx) => put(BOX, gx, h, gy, w, ht, d, ry, rx, c, e);
  const cyl = (gx, gy, h, w, ht, c, e, ry, rx, d) => put(CYL, gx, h, gy, w, ht, d || w, ry, rx, c, e);
  const cone = (gx, gy, h, w, ht, c, e, ry, rx) => put(CONE, gx, h, gy, w, ht, w, ry, rx, c, e);
  const sph = (gx, gy, h, w, ht, c, e, d, ry) => put(SPH, gx, h, gy, w, ht, d || w, ry || 0, 0, c, e);
  const hemi = (gx, gy, h, w, ht, c, e, al) => put(HEMI, gx, h, gy, w, ht, w, 0, 0, c, e, al, al != null && al < 1);
  function beam(x1, y1, h1, x2, y2, h2, w, c, e, al) { // thin box between two points
    const dx = x2 - x1, dy = y2 - y1, dh = h2 - h1, L = Math.hypot(dx, dy, dh) || .01, ry = Math.atan2(dy, dx), rx = 0;
    const Lg = Math.hypot(dx, dy); const pitch = Math.atan2(dh, Lg);
    // build along x then pitch (rotate around z) manually: approximate with a few boxes when pitched
    if (Math.abs(dh) < 1) { put(BOX, (x1 + x2) / 2, h1 - w / 2, (y1 + y2) / 2, Lg, w, w, ry, rx, c, e, al, al != null && al < 1); return; }
    const k = Math.max(1, Math.min(8, Math.round(L / 10))); for (let i = 0; i < k; i++) { const a = (i + .5) / k; put(BOX, x1 + dx * a, h1 + dh * a - w / 2, y1 + dy * a, Lg / k + w, Math.abs(dh) / k + w, w, ry, 0, c, e, al, al != null && al < 1); }
    void pitch;
  }

  /* ---------- GL setup ---------- */
  const VS = `attribute vec3 aP,aN;attribute vec4 aC;attribute float aE;uniform mat4 uM;varying vec3 vP,vN;varying vec4 vC;varying float vE;
void main(){vP=aP;vN=aN;vC=aC;vE=aE;gl_Position=uM*vec4(aP,1.);}`;
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec3 vP,vN;varying vec4 vC;varying float vE;
uniform sampler2D uBg,uFog,uDec;uniform float uG;uniform vec2 uW;uniform vec4 uDR;uniform vec3 uSun,uSunC,uAmb,uHaze,uCam,uDark;uniform float uHD;
uniform vec4 uLP[8];uniform vec3 uLC[8];uniform sampler2D uNz;uniform float uHDm;uniform vec3 uGa,uGb,uGc,uGd;uniform vec2 uRes;
uniform sampler2D uSh;uniform mat4 uLM;uniform float uShOn,uShT;uniform float uWid;uniform vec2 uWB;
float unp(vec4 v){return dot(v,vec4(1.,1./255.,1./65025.,1./16581375.));}
float shf(vec3 p){vec4 l=uLM*vec4(p,1.);vec3 q=l.xyz*.5+.5;if(q.x<.002||q.y<.002||q.x>.998||q.y>.998||q.z>1.)return 1.;float z=q.z-.0012,s=0.;
 s+=step(z,unp(texture2D(uSh,q.xy)));s+=step(z,unp(texture2D(uSh,q.xy+vec2(uShT,uShT*.4))));s+=step(z,unp(texture2D(uSh,q.xy-vec2(uShT,uShT*.4))));s+=step(z,unp(texture2D(uSh,q.xy+vec2(-uShT*.4,uShT))));s+=step(z,unp(texture2D(uSh,q.xy+vec2(uShT*.4,-uShT))));
 float e=smoothstep(.0,.08,min(min(q.x,q.y),min(1.-q.x,1.-q.y)));return mix(1.,s*.2,e);}
void main(){vec4 c=vC;vec3 nn=normalize(vN);float wl=0.;bool inW=vP.x>=0.&&vP.z>=0.&&vP.x<=uW.x&&vP.z<=uW.y;
 if(uG>.5){if(uHDm>.5){vec2 q=vP.xz;vec4 a=texture2D(uNz,q*.0021),b=texture2D(uNz,q*.0097),d=texture2D(uNz,q*.043),e=texture2D(uNz,q*.19);vec3 g=mix(uGa,uGb,smoothstep(.3,.7,a.r));g=mix(g,uGc,smoothstep(.45,.8,b.g)*.6);g*=.74+.5*d.b*(.7+.3*e.a);vec4 f=texture2D(uNz,q*.61),h2=texture2D(uNz,q*1.7+.37);float pb=smoothstep(.74,.8,f.r)*(.6+.4*h2.g),pl=smoothstep(.8,.86,f.r+(h2.b-.5)*.12);g*=1.-.32*pb;g+=uGc*pl*.16;g*=.93+.14*h2.a;float st=smoothstep(.55,.75,texture2D(uNz,vec2(q.x*.004,q.y*.03)).g);g=mix(g,uGb*1.08,st*.12);vec3 n0=normalize(vN);nn=normalize(n0+vec3(d.r-.5,0.,d.g-.5)*.8+vec3(e.b-.5,0.,e.r-.5)*.45+vec3(f.g-.5,0.,f.b-.5)*.35*pb);g=mix(g,uGd,smoothstep(.1,.34,1.-n0.y)*.75);g*=.94+.12*clamp(vP.y/30.,-1.,1.);g=mix(vec3(dot(g,vec3(.3,.59,.11))),g,.8);float bd=length(q-uWB);if(uWid<.5){float ma=smoothstep(.42,.62,texture2D(uNz,q*.00045+.11).g);g*=1.-.2*ma;vec2 rq=q-uWB-vec2(-900.,-1300.);float ry=smoothstep(.62,.9,texture2D(uNz,vec2(atan(rq.y,rq.x)/6.2832*5.,length(rq)*.00035)).r)*smoothstep(2600.,500.,length(rq));g*=1.+.3*ry;}else if(uWid<1.5){float rp=sin(dot(q,vec2(.83,.55))*.42+d.r*5.+b.g*3.);g*=.965+.045*rp;float lo=smoothstep(1.,-9.,vP.y)*smoothstep(.45,.62,texture2D(uNz,q*.0013+.4).b);g=mix(g,vec3(.24,.15,.12),lo*.55);}else if(uWid<2.5){float lr=smoothstep(.4,.65,texture2D(uNz,q*.0007+.7).r);g=mix(g,g*vec3(.74,.78,.9),lr*.6);float ho=smoothstep(.78,.83,texture2D(uNz,q*.0035+.21).b)*(.7+.3*e.r);g=mix(g,vec3(.62,.7,.84),ho*.6);}else if(uWid<3.5){vec2 w=q+(texture2D(uNz,q*.0005).rg-.5)*90.;float l1=abs(sin(dot(w,vec2(.6,.8))*.0062)),l2=abs(sin(dot(w,vec2(-.92,.38))*.0045+1.3)),l3=abs(sin(dot(w,vec2(.2,-.98))*.0081+.4));float bn=max(max(1.-smoothstep(.02,.11,l1),(1.-smoothstep(.015,.09,l2))*.9),(1.-smoothstep(.01,.06,l3))*.65),rg=max(1.-smoothstep(0.,.018,l1),1.-smoothstep(0.,.014,l2));g=mix(g,vec3(.62,.38,.25)*(.82+.3*d.b),bn*.7*(.7+.3*b.r));g=mix(g,vec3(.93,.96,1.),rg*.55);float ch=smoothstep(.66,.74,texture2D(uNz,q*.0006+.55).g);g=mix(g,g*vec3(.84,.74,.68),ch*.55);}else if(uWid<4.5){wl=smoothstep(.6,.66,texture2D(uNz,q*.0009+.31).g)*smoothstep(-1.,-7.,vP.y)*smoothstep(380.,520.,bd);g=mix(g,vec3(.05,.04,.03),wl);nn=normalize(mix(nn,vec3(0.,1.,0.),wl));g=mix(g,g*vec3(.55,.45,.38),smoothstep(-3.,-12.,vP.y)*.45);}else if(uWid<5.5){float fa=smoothstep(.7,.78,texture2D(uNz,q*.00032+.62).a)*(.55+.45*b.b);float fr=smoothstep(.6,.7,texture2D(uNz,q*.00032+.62).a)*(1.-fa);g=mix(g,vec3(.93,.94,.96),fa*.9);g=mix(g,g*1.35,fr*.5);}c=vec4(g,1.);vec2 du=(vP.xz-uDR.xy)/uDR.zw;if(du.x>0.&&du.y>0.&&du.x<1.&&du.y<1.){vec4 dc=texture2D(uDec,du);c.rgb=mix(c.rgb,dc.rgb,dc.a);}}else{vec2 gu=vP.xz/uW;gu=1.-abs(mod(gu,2.)-1.);c=texture2D(uBg,gu);vec2 du=(vP.xz-uDR.xy)/uDR.zw;if(du.x>0.&&du.y>0.&&du.x<1.&&du.y<1.){vec4 d=texture2D(uDec,du);c.rgb=mix(c.rgb,d.rgb,d.a);}nn=vec3(0.,1.,0.);}}
 if(uG<.5&&uHDm>.5&&vE<1.2){float gr=texture2D(uNz,vec2(vP.x+vP.y*.7,vP.z-vP.y*.5)*.09).b;c.rgb*=.86+.28*gr;}
 vec3 V=normalize(uCam-vP);float nd=dot(nn,uSun);float lt=uHDm>.5?(uG>.5?smoothstep(-.3,.6,nd):smoothstep(-.03,.12,nd)):max(nd,0.);if(uShOn>.5&&vE<1.2)lt*=shf(vP+normalize(vN)*.8);vec3 L=uAmb*(.8+.2*nn.y)*(uHDm>.5?(uG>.5?vec3(1.,1.,1.06):vec3(.9,.9,1.18)):vec3(1.))+uSunC*lt*(uHDm>.5?1.15:1.);
 for(int i=0;i<8;i++){vec3 d=uLP[i].xyz-vP;float r=uLP[i].w;if(r>0.){float k=max(0.,1.-length(d)/r);L+=uLC[i]*k*k*(.45+.55*max(dot(nn,normalize(d)),0.));}}
 float ao=(uG>.5||uHDm>.5)?1.:.64+.36*clamp(vP.y/7.,0.,1.);vec3 o=c.rgb*L*ao+c.rgb*vE;if(wl>.01){float fr=pow(1.-max(V.y,0.),3.);o=mix(o,uHaze*(.3+.9*fr)+uSunC*pow(max(dot(reflect(-V,vec3(0.,1.,0.)),uSun),0.),40.)*.9,wl*.88);}
 if(uG<.5&&vE<1.5){vec3 Hh=normalize(uSun+V);if(uHDm>.5){o+=uSunC*smoothstep(.955,.975,max(dot(nn,Hh),0.))*.34*lt;float rim=smoothstep(.55,.8,1.-max(dot(nn,V),0.));o+=rim*(uHaze*.6+uSunC*.42)*(.35+.65*lt);}else{o+=uSunC*pow(max(dot(nn,Hh),0.),28.)*.26;o+=uAmb*pow(1.-max(dot(nn,V),0.),3.)*.38;}}
 if(inW&&vE<2.9){float f=texture2D(uFog,vP.xz/uW).a;o=mix(o,uDark,f*(uHDm>.5?.72:.92));}
 float dd=length(vP-uCam);o=mix(o,uHaze,clamp((dd-uHD)/(uHD*1.6),0.,.75)*(1.-min(vE,1.)));
 if(uHDm>.5){float lu=dot(o,vec3(.299,.587,.114));o=mix(vec3(lu),o,1.18);o=o*1.06/(1.+o*.1);vec2 sp=gl_FragCoord.xy/uRes-.5;o*=1.-.38*dot(sp,sp);}
 gl_FragColor=vec4(o,c.a);}`;
  const VS2 = `attribute vec2 aQ;varying vec2 vQ;void main(){vQ=aQ;gl_Position=vec4(aQ,.9999,1.);}`;
  const FS2 = `#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec2 vQ;uniform vec3 uF,uR,uU,uZen,uHor,uSunD,uSunC;uniform float uTH,uAsp,uStar,uT;uniform vec4 uFl;uniform sampler2D uNz;uniform vec4 uCl;uniform float uHDs;
uniform vec4 uB1,uB2;uniform vec2 uBt,uSunK;
float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(vec3(i,1.)),b=h(vec3(i+vec2(1.,0.),1.)),c=h(vec3(i+vec2(0.,1.),1.)),e=h(vec3(i+vec2(1.,1.),1.));return mix(mix(a,b,f.x),mix(c,e,f.x),f.y);}
float fbm2(vec2 p){return vn(p)*.52+vn(p*2.07+3.1)*.3+vn(p*4.3+7.7)*.18;}
vec4 body(vec3 d,vec4 B,float ty){if(B.w<=0.)return vec4(0.);float ca=dot(d,B.xyz);if(ca<.5)return vec4(0.);vec3 bx=normalize(cross(B.xyz,vec3(0.,1.,0.))),by=cross(bx,B.xyz);
 vec2 p=vec2(dot(d,bx),dot(d,by))/sin(B.w);float q=length(p);
 if(q>1.){if(ty<1.5&&q<1.14){float g=smoothstep(1.14,1.,q);return vec4(vec3(.3,.5,1.)*g*.55*max(dot(normalize(bx*p.x/q+by*p.y/q),uSunD)+.3,0.),g*.6);}return vec4(0.);}
 float z=sqrt(max(0.,1.-q*q));vec3 N=normalize(bx*p.x+by*p.y-B.xyz*z);float ld=dot(N,uSunD),lam=smoothstep(-.04,.2,ld)*max(ld,.0)*1.6+smoothstep(-.04,.1,ld)*.25;
 float lat=asin(clamp(p.y,-1.,1.)),lon=atan(p.x,z);vec3 col;float em=0.;
 if(ty<1.5){float sp=uT*.012;float m=fbm2(vec2((lon+sp)*1.7,lat*2.3)+4.);bool land=m>.61;col=land?mix(vec3(.16,.26,.1),vec3(.42,.36,.22),smoothstep(.4,.7,fbm2(vec2(lon*5.,lat*5.)))):vec3(.02,.09,.3);
  if(abs(lat)>1.18)col=vec3(.9,.93,.97);float cl=smoothstep(.54,.7,fbm2(vec2((lon+sp*1.3)*2.6,lat*4.4)+11.));col=mix(col,vec3(.95),cl*.85);col=mix(col,vec3(.35,.55,1.),pow(1.-z,2.2)*.55);
  if(land&&ld<-.05&&cl<.3&&h(vec3(floor(vec2(lon,lat)*60.),3.))>.93)em=.25;}
 else if(ty<2.5){float bn=sin(lat*13.+fbm2(vec2(lon*2.4+uT*.004,lat*10.))*2.6);col=mix(vec3(.88,.8,.66),vec3(.6,.4,.27),smoothstep(-.3,.7,bn));col=mix(col,vec3(.5,.46,.42),smoothstep(.95,1.35,abs(lat)));
  float e=length(vec2((lon-.55)*1.,(lat+.38)*2.3));col=mix(col,vec3(.78,.36,.22),smoothstep(.2,.11,e));}
 else if(ty<3.5){col=vec3(.38,.33,.3)*(.65+.55*fbm2(p*3.+2.));}
 else col=vec3(.85,.82,.75);
 float a=smoothstep(1.,.96,q);return vec4(col*lam+col*em*vec3(1.,.6,.3)*4.,a);}
void main(){vec3 d=normalize(uF+uR*vQ.x*uTH*uAsp+uU*vQ.y*uTH);float e=d.y;
 vec3 c=mix(uHor,uZen,clamp(e*1.8+.08,0.,1.));
 float s=max(dot(d,uSunD),0.);c+=uSunC*(smoothstep(uSunK.x,uSunK.y,s)*2.5+pow(s,14.)*.35*clamp(uSunK.y>.9998?.5:1.,0.,1.));
 if(uStar>0.&&e>-.05){vec3 g=floor(d*260.);float r=h(g);if(r>.9965)c+=vec3(uStar*(.55+.45*sin(uT*2.5+r*90.))*(r-.9965)*280.);}
 if(uCl.a>0.&&e>0.){vec2 cp=d.xz/(e+.15)*.22+vec2(uT*.006,uT*.002);float cl=texture2D(uNz,cp).r*.62+texture2D(uNz,cp*2.9+.3).g*.38;cl=smoothstep(.5,.74,cl)*smoothstep(0.,.22,e);c=mix(c,uCl.rgb*(.75+.5*max(dot(d,uSunD),0.)),cl*uCl.a);}vec4 b1=body(d,uB1,uBt.x),b2=body(d,uB2,uBt.y);c=mix(c,max(b1.rgb,c*.6+b1.rgb),b1.a);c=mix(c,max(b2.rgb,c*.6+b2.rgb),b2.a);if(uHDs>.5)c=mix(vec3(dot(c,vec3(.3,.59,.11))),c,1.2);c=mix(c,uFl.rgb,uFl.a);gl_FragColor=vec4(c,1.);}`;
  function init() {
    c3 = document.createElement('canvas'); c3.id = 'c3';
    c3.style.cssText = 'position:absolute;left:0;top:0;display:none;pointer-events:none;z-index:-1';
    const cv = document.getElementById('c'); cv.parentNode.insertBefore(c3, cv);
    gl = c3.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false }) || c3.getContext('experimental-webgl');
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ['uM', 'uBg', 'uFog', 'uDec', 'uG', 'uW', 'uDR', 'uSun', 'uSunC', 'uAmb', 'uHaze', 'uCam', 'uHD', 'uDark'].forEach(k => U[k] = gl.getUniformLocation(prog, k));
    U.lp = []; U.lc = []; for (let i = 0; i < 8; i++) { U.lp.push(gl.getUniformLocation(prog, `uLP[${i}]`)); U.lc.push(gl.getUniformLocation(prog, `uLC[${i}]`)); }
    U.aP = gl.getAttribLocation(prog, 'aP'); U.aN = gl.getAttribLocation(prog, 'aN'); U.aC = gl.getAttribLocation(prog, 'aC'); U.aE = gl.getAttribLocation(prog, 'aE');
    vb = gl.createBuffer(); sb = gl.createBuffer();
    prog2 = gl.createProgram(); gl.attachShader(prog2, sh(gl.VERTEX_SHADER, VS2)); gl.attachShader(prog2, sh(gl.FRAGMENT_SHADER, FS2)); gl.linkProgram(prog2);
    if (!gl.getProgramParameter(prog2, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog2));
    ['uF', 'uR', 'uU', 'uZen', 'uHor', 'uSunD', 'uSunC', 'uTH', 'uAsp', 'uStar', 'uT', 'uFl', 'uB1', 'uB2', 'uBt', 'uSunK'].forEach(k => U2[k] = gl.getUniformLocation(prog2, k)); U2.aQ = gl.getAttribLocation(prog2, 'aQ');
    qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const tx = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); return t; };
    texBg = tx(); texFog = tx(); texDec = tx();
    gl.bindTexture(gl.TEXTURE_2D, texBg); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, texFog); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    DEC = document.createElement('canvas'); DEC.width = DEC.height = DS; DX = DEC.getContext('2d');
    c3.addEventListener('webglcontextlost', e => { e.preventDefault(); R3.ok = false; });
    return true;
  }
  function upload(t, src) { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
  function drawBuf(B, N, glb, shPass) {
    if (!N) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, glb); if (shPass !== 'reuse') { const bytes = N * FL * 4; if (!glb._cap || glb._cap < bytes) { glb._cap = Math.ceil(bytes * 1.5); gl.bufferData(gl.ARRAY_BUFFER, glb._cap, gl.DYNAMIC_DRAW); } gl.bufferSubData(gl.ARRAY_BUFFER, 0, B.subarray(0, N * FL)); }
    if (shPass === true) { gl.enableVertexAttribArray(U.aP); gl.vertexAttribPointer(U.aP, 3, gl.FLOAT, false, FL * 4, 0); } else attrs(); gl.drawArrays(gl.TRIANGLES, 0, N);
  }
  function attrs() {
    const s = FL * 4; gl.enableVertexAttribArray(U.aP); gl.vertexAttribPointer(U.aP, 3, gl.FLOAT, false, s, 0); gl.enableVertexAttribArray(U.aN); gl.vertexAttribPointer(U.aN, 3, gl.FLOAT, false, s, 12);
    gl.enableVertexAttribArray(U.aC); gl.vertexAttribPointer(U.aC, 4, gl.FLOAT, false, s, 24); gl.enableVertexAttribArray(U.aE); gl.vertexAttribPointer(U.aE, 1, gl.FLOAT, false, s, 40);
  }

  /* ---------- per-world look ---------- */
  const LOOK = [
    { sun: [1, .98, .94], amb: [.30, .30, .34], sky: [.02, .02, .05], haze: [.06, .06, .09], planet: { c: '#3b78c8', r: 90, x: 300, y: -1300, h: 520, c2: '#5fe08a' } },
    { sun: [1, .82, .66], amb: [.36, .26, .22], sky: [.62, .42, .30], haze: [.55, .38, .28] },
    { sun: [1.15, 1.08, .95], amb: [.30, .28, .26], sky: [.01, .01, .02], haze: [.07, .06, .06], planet: { c: '#fff3b0', r: 160, x: -500, y: -1500, h: 380, e: 2 } },
    { sun: [.82, .88, 1], amb: [.28, .32, .40], sky: [.01, .02, .05], haze: [.05, .07, .11], planet: { c: '#d9a77a', r: 360, x: 200, y: -1800, h: 650, c2: '#b06a3a' } },
    { sun: [.95, .66, .36], amb: [.38, .28, .18], sky: [.70, .45, .20], haze: [.62, .42, .20] },
    { sun: [.9, .92, 1], amb: [.28, .28, .32], sky: [.01, .01, .02], haze: [.05, .05, .07], planet: { c: '#c1440e', r: 40, x: -600, y: -1600, h: 560, e: 1.2 } },
    { sun: [.95, .8, 1.05], amb: [.32, .22, .38], sky: [.25, .1, .35], haze: [.3, .14, .4], planet: { c: '#7df9ff', r: 120, x: 400, y: -1500, h: 600, e: 1.3, c2: '#d070ff' } }];

  // sky colours: day zenith/horizon, sunset horizon, night zenith/horizon, stars by day (airless worlds show stars all day)
  const SKY = [
    { dz: [0, 0, .01], dh: [.07, .07, .09], sh: [.08, .07, .08], nz: [0, 0, .01], nh: [.03, .03, .05], st: 1 },
    { dz: [.36, .25, .2], dh: [.78, .57, .4], sh: [.32, .48, .78], nz: [.01, .01, .03], nh: [.06, .04, .06], st: 0 }, // Mars sunsets are blue!
    { dz: [0, 0, .01], dh: [.1, .08, .06], sh: [.12, .08, .05], nz: [0, 0, .01], nh: [.04, .03, .03], st: 1 },
    { dz: [0, .005, .02], dh: [.05, .07, .12], sh: [.08, .07, .12], nz: [0, 0, .02], nh: [.03, .04, .08], st: 1 },
    { dz: [.5, .34, .14], dh: [.8, .55, .25], sh: [.75, .4, .16], nz: [.06, .04, .02], nh: [.14, .09, .04], st: 0 },
    { dz: [0, 0, .01], dh: [.06, .06, .08], sh: [.07, .06, .08], nz: [0, 0, .01], nh: [.03, .03, .05], st: 1 },
    { dz: [.1, .03, .16], dh: [.42, .2, .55], sh: [.7, .3, .6], nz: [.02, 0, .05], nh: [.08, .03, .12], st: 1 }];
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hsh = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /* ---------- static scenery: mountains outside the map ---------- */
  function buildScenery() {
    n = 0; const L = S.L, WW_ = WW, WH_ = WH; let s = 11 + S.lv * 97; const r = () => (s = s * 16807 % 2147483647) / 2147483647, QK = R3.q === 'low' ? .4 : 1;
    const c3_ = col(L.bg[3]), c1_ = col(L.bg[1]), dk = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    for (let i = 0; i < (HDM ? 0 : 120 * QK); i++) {
      const side = i % 4, t = r(); let x, y; const d = 30 + r() * 260;
      if (side === 0) { x = t * (WW_ + 400) - 200; y = -d; } else if (side === 1) { x = t * (WW_ + 400) - 200; y = WH_ + d; } else if (side === 2) { x = -d; y = t * (WH_ + 400) - 200; } else { x = WW_ + d; y = t * (WH_ + 400) - 200; }
      const w = 60 + r() * 140, h = (S.lv === 3 ? .45 : .7) * w * (.5 + r() * .9), cc = r() < .5 ? c3_ : c1_;
      const mi = i % 4, rot = r() * 6, dd = w * (.7 + r() * .6);
      put(HQ ? MTNS[mi] : CONE4, x, -1, y, w, h, dd, rot, 0, dk(cc, .7 + r() * .4), 0);
      if (S.lv === 3 && r() < .4) put(HQ ? MTNS[mi] : CONE4, x, h * .68, y, w * .36, h * .33, dd * .36, rot, 0, [.9, .95, 1], .1);
    }
    for (let i = 0; i < 60; i++) { // scattered boulders near the edges, outside the play area
      const a = r() * Math.PI * 2, x = WW_ / 2 + Math.cos(a) * (WW_ / 2 + 20 + r() * 80), y = WH_ / 2 + Math.sin(a) * (WH_ / 2 + 20 + r() * 80), w = 8 + r() * 20;
      put(HQ ? ROCKS[i % 4] : SPH, x, -2, y, w, w * .6, w * (.7 + r() * .5), r() * 6, 0, dk(c3_, .8 + r() * .3), 0);
    }
    for (let i = 0; i < (HDM ? 0 : 44 * QK); i++) { // far ridges on the horizon (seen in first person)
      const a = i / 44 * Math.PI * 2 + r() * .1, R = 1150 + r() * 500, x = WW_ / 2 + Math.cos(a) * R, y = WH_ / 2 + Math.sin(a) * R * .8, w = 260 + r() * 300, h = (S.lv === 3 ? .35 : .55) * w * (.4 + r() * .6);
      put(HQ ? MTNS[i % 4] : CONE4, x, -2, y, w, h, w * (.7 + r() * .5), r() * 6, 0, dk(r() < .5 ? c3_ : c1_, .55 + r() * .25), 0);
    }
    if (HDM) { const c0 = core(), bx = c0 ? c0.x + 16 : WW_ / 2, bz = c0 ? c0.y + 16 : WH_ / 2; for (let i = 0; i < 150 * QK; i++) { const x = r() * WW_, z = r() * WH_; if (Math.hypot(x - bx, z - bz) < 170) continue; const w = 3 + r() * r() * 22; put(ROCKS[i % 4], x, -w * .15, z, w, w * (.45 + r() * .35), w * (.7 + r() * .5), r() * 6, 0, dk(r() < .5 ? c3_ : c1_, .75 + r() * .4), 0); }
      const DS_ = REAL && mdl('dsn'); if (DS_) drawModel(DS_, bx + 290, 0, bz - 170, 1.25, .7, 0); landmarks(bx, bz, r, dk, c1_, c3_); }
    if (S.lv === 6) { let s2 = 77; const r2 = () => (s2 = s2 * 16807 % 2147483647) / 2147483647; for (let i = 0; i < 60; i++) { const x = r2() * WW_, z = r2() * WH_, hg = 6 + r2() * 12; put(CYL, x, 0, z, 1.4, hg, 1.4, 0, 0, '#3a1652', 0); put(SPH, x, hg, z, 5, 4, 5, 0, 0, r2() < .5 ? '#d070ff' : '#7df9ff', 1.6); } }
    const lk = LOOK[S.lv]; if (lk && lk.planet && S.lv === 6) { const p = lk.planet; put(SPH, WW_ / 2 + p.x, p.h - p.r, WH_ / 2 + p.y, p.r * 2, p.r * 2, p.r * 2, 0, 0, p.c, p.e || 1.1); if (p.c2) put(SPH, WW_ / 2 + p.x + p.r * .25, p.h - p.r * .7, WH_ / 2 + p.y + p.r * .3, p.r * .9, p.r * .6, p.r * .9, 0, 0, p.c2, 1.1); }
    if (R3.noScen) n = 0; R3.scenN = n;
    gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * FL), gl.STATIC_DRAW); staticN = n; staticLv = S.lv + ':' + S.L.n + ':' + HQ + ':' + HDM + REAL + TERK + ':' + (R3.mv || 0); n = 0;
  }

  /* ---------- v88: pressurised walkways and utility pipes link the core to the modules people live and work in ---------- */
  const WLK = {}, WLT = { habitat: 1, o2: 1, farm: 1, medbay: 1, lab: 1 };
  function walkways() {
    const c = S.b.find(b => b.t === 'core'); if (!c) return; const cx = c.x + c.w / 2, cz = c.y + c.w / 2, nt = DKn > .3;
    const L = S.b.filter(b => WLT[b.t] && !b.ghost && !(b.pop != null && b.pop < .9) && Math.hypot(b.x + b.w / 2 - cx, b.y + b.w / 2 - cz) < 230);
    const key = L.map(b => b.t + (b.x | 0) + ',' + (b.y | 0)).join('|') + (nt ? 'n' : 'd') + c.w;
    cached(WLK, key, () => { for (const b of L) { const bx = b.x + b.w / 2, bz = b.y + b.w / 2, dx = bx - cx, dz = bz - cz, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
        const r0 = c.w * .62, r1 = b.w * .5, len = d - r0 - r1; if (len < 6) continue; const a = Math.atan2(dz, dx), mx = cx + ux * (r0 + len / 2), mz = cz + uz * (r0 + len / 2);
        put(BOX, mx, 0, mz, len, 1.2, 9.5, -a, 0, '#5a5f68', 0);                       // footing
        put(BOX, mx, 1.2, mz, len, 6.5, 7.5, -a, 0, '#d6dbe2', 0);                    // tube body
        put(BOX, mx, 7.7, mz, len, 1.4, 6, -a, 0, '#b9c0ca', 0);                      // roof
        put(BOX, mx, 4.2, mz, len, .9, 7.7, -a, 0, '#2b3442', 0);                      // window band
        const nw = Math.max(1, Math.floor(len / 9)); for (let i = 0; i < nw; i++) { const t = (i + .5) / nw - .5, wx = mx + ux * t * len, wz = mz + uz * t * len;
          put(BOX, wx, 4.1, wz, 2.6, 1.1, 7.9, -a, 0, nt ? '#ffe2a8' : '#7fb8d8', nt ? 2.2 : .35); }
        const px = -uz * 6.5, pz = ux * 6.5;                                             // utility pipe beside the walkway
        put(BOX, mx + px, 1.6, mz + pz, len, 1.3, 1.3, -a, 0, '#c9773a', 0); put(BOX, mx + px, 0, mz + pz, 1.2, 1.6, 1.2, -a, 0, '#6a6f78', 0); } });
  }
  /* ---------- v85: base lights. Light masts around the core, and a blinking beacon on every working module (orange and fast when it is badly damaged) ---------- */
  const BCH = { core: 34, habitat: 24, o2: 17, farm: 15, medbay: 17, battery: 11, drill: 22, turret: 17, tesla: 31, rtg: 13, reactor: 21, shield: 11 };
  function beacon(b) {
    if (b.ghost || (b.pop != null && b.pop < .4)) return; const h = BCH[b.t]; if (!h) return; const x = b.x + b.w / 2, y = b.y + b.w / 2, nt = DKn > .3, t = T();
    if (b.t === 'core') { const R = b.w * 1.25; if (!b._mast) Object.defineProperty(b, '_mast', { value: {}, enumerable: false });
      cached(b._mast, 'mast' + b.w + (nt ? 'n' : 'd'), () => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, px = x + Math.cos(a) * R, pz = y + Math.sin(a) * R;
          put(CYL, px, 0, pz, 1.1, 30, 1.1, 0, 0, '#9aa1ad', 0); put(BOX, px, 0, pz, 3.4, 1.2, 3.4, a, 0, '#3a3f4c', 0); put(BOX, px - Math.cos(a) * .9, 29.5, pz - Math.sin(a) * .9, 4.4, 2.2, 1.6, -a + Math.PI / 2, -.5, '#2a2d36', 0);
          put(BOX, px - Math.cos(a) * 1.6, 29.3, pz - Math.sin(a) * 1.6, 3.8, 1.6, .5, -a + Math.PI / 2, -.5, nt ? '#fff6dc' : '#c9ccd6', nt ? 2.6 : .2); } }); }
    if (b.off || b.nc || b.dis) return; const bad = b.m && b.hp < b.m * .35, ph = hsh(Math.floor(b.x) * 7 + Math.floor(b.y)), on = bad ? (t * 4 + ph) % 1 < .5 : (t * .9 + ph) % 1 < .14;
    if (!on) return; put(SPHm, x, h + 1.2, y, 1.3, 1.3, 1.3, 0, 0, bad ? '#ff9a2a' : '#ff3040', nt ? 2.6 : 1.8); }
  /* ---------- v85: every world gets its own landmarks, so a screenshot shows which world it is ---------- */
  function landmarks(bx, bz, r, dk, c1_, c3_) {
    const lv = S.lv, at = (dmin, dmax) => { const a = r() * Math.PI * 2, d = dmin + r() * (dmax - dmin); return [bx + Math.cos(a) * d, bz + Math.sin(a) * d * .9]; };
    if (lv === 1) { // Mars: layered mesas and buttes, like the sedimentary hills Curiosity climbs in Gale crater
      const BAND = ['#9c4725', '#b8603a', '#7f361b', '#c27045', '#8a3d20'];
      for (let i = 0; i < 9; i++) { const [x, z] = at(620, 1500), w = 90 + r() * 170, k = 3 + Math.floor(r() * 3); let y = -6;
        put(HQ ? MTNS[i % 4] : CONE4, x, -4, z, w * 1.55, w * .32, w * 1.4, r() * 6, 0, dk(c3_, .8), 0); // talus slope
        for (let j = 0; j < k; j++) { const hh = w * (.1 + r() * .07), sh = 1 - j * .09; put(CYL, x, y, z, w * sh, hh, w * sh * (.8 + r() * .1), i, 0, BAND[(i + j) % 5], 0); y += hh; }
        if (r() < .5) put(CYL, x + w * .2, y, z, w * .35, w * .12, w * .3, i, 0, BAND[i % 5], 0); }
      for (let i = 0; i < 26; i++) { const [x, z] = at(330, 900), w = 30 + r() * 50; put(HEMI, x, -w * .12, z, w * 2.2, w * .3, w * .8, r() * .6 + .6, 0, '#7a3a20', 0); } // dark basaltic sand dunes
    } else if (lv === 2) { // Mercury: lobate scarps (cliffs made as the planet cooled and shrank) and ancient boulders
      for (let i = 0; i < 4; i++) { const [x, z] = at(700, 1300), ry = r() * 6, L = 500 + r() * 500; for (let j = -3; j <= 3; j++) { const ox = Math.cos(ry) * j * L / 7, oz = Math.sin(ry) * j * L / 7, hh = 40 * (1 - Math.abs(j) / 4.2) + 10;
          put(BOX, x + ox, -6, z + oz, L / 6.5, hh, 90, -ry, .55, dk(c3_, .75 + r() * .2), 0); } }
      for (let i = 0; i < 40; i++) { const [x, z] = at(260, 1000), w = 6 + r() * 26; put(ROCKS[i % 4], x, -w * .2, z, w, w * .6, w * .8, r() * 6, 0, dk(c1_, .7 + r() * .3), 0); }
    } else if (lv === 3) { // Europa: chaos terrain, where the ice shell broke into rafts that tilted and froze again
      for (let i = 0; i < 14; i++) { const [x, z] = at(450, 1400), n_ = 3 + Math.floor(r() * 5);
        for (let j = 0; j < n_; j++) { const w = 40 + r() * 90, ox = (r() - .5) * 220, oz = (r() - .5) * 220; put(BOX, x + ox, -w * .2, z + oz, w, w * (.25 + r() * .35), w * (.6 + r() * .6), r() * 6, (r() - .5) * .5, r() < .6 ? '#dfeef8' : '#b9d4e6', 0); if (r() < .4) put(BOX, x + ox, w * .1, z + oz, w * .9, w * .08, w * .1, r() * 6, 0, '#9a6a4a', 0); } }
      for (let i = 0; i < 30; i++) { const [x, z] = at(250, 800), w = 4 + r() * 12; put(CONE4, x, -1, z, w, w * (1.2 + r() * 1.5), w, r() * 6, 0, '#e8f4fc', .05); } // sharp ice blades
    } else if (lv === 4) { // Titan: rounded water-ice cobbles, exactly what the Huygens probe photographed when it landed in 2005
      for (let i = 0; i < 160; i++) { const [x, z] = at(240, 900), w = 3 + r() * r() * 10; put(SPH, x, -w * .15, z, w, w * .55, w * (.8 + r() * .3), r() * 6, 0, r() < .5 ? '#c79a62' : '#a8794a', 0); }
    } else if (lv === 5) { // Ceres: Ahuna Mons, a lonely 4 km tall ice volcano with bright salt streaks down its sides
      const [x, z] = [bx - 1150, bz - 1050], R = 420, H = 260; put(CYL, x, -10, z, R * 2, H, R * 1.8, .3, 0, '#4c4a48', 0); put(HEMI, x, H - 12, z, R * 1.7, 70, R * 1.5, .3, 0, '#55524e', 0);
      put(CONE4, x, -12, z, R * 2.6, H * .5, R * 2.4, .9, 0, '#3f3d3a', 0);
      for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + r() * .2; put(BOX, x + Math.cos(a) * R * .93, H * .35, z + Math.sin(a) * R * .84, 14 + r() * 18, H * .62, 6, -a, 0, '#e6e8ec', .15); }
      for (let i = 0; i < 50; i++) { const [x2, z2] = at(260, 1000), w = 5 + r() * 20; put(ROCKS[i % 4], x2, -w * .2, z2, w, w * .55, w * .8, r() * 6, 0, dk(c1_, .7 + r() * .3), 0); }
    } else if (lv === 0) { // the Moon: big boulders thrown out by impacts, scattered around the craters
      for (let i = 0; i < 70; i++) { const [x, z] = at(260, 1100), w = 6 + r() * r() * 40; put(ROCKS[i % 4], x, -w * .2, z, w, w * .6, w * .85, r() * 6, 0, dk(c1_, .75 + r() * .35), 0); }
    }
  }
  /* ---------- models ---------- */
  const T = () => (typeof TT !== 'undefined' ? TT : performance.now() / 1000);
  /* ---------- v19 models: buildings keep their unchanging parts in a cache, only moving parts are rebuilt ---------- */
  // unchanging parts of buildings are kept on the graphics card and only re-sent when something changes
  const BC = new WeakMap(); let DKn = 0, STL = [], bSig = '', bvb = null, bvN = 0, bId = 0;
  function cached(obj, key, fn, direct) {
    if (direct) { fn(); return; }
    let c = BC.get(obj);
    if (HDM) key += '|hd' + TERK + (REAL ? 'r' : '') + (R3.mv || 0); if (!c || c.k !== key) { const sv = n; ULT = true; try { fn(); } finally { ULT = false; } c = { k: key, a: buf.slice(sv * FL, n * FL), id: ++bId }; n = sv; BC.set(obj, c); }
    STL.push(c);
  }
  function buildStatic() {
    const sig = STL.map(c => c.id).join(',');
    if (sig !== bSig || !bvb) { bSig = sig; let tot = 0; STL.forEach(c => tot += c.a.length); const arr = new Float32Array(Math.max(tot, FL)); let o = 0; STL.forEach(c => { arr.set(c.a, o); o += c.a.length; });
      if (!bvb) bvb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bvb); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); bvN = tot / FL; } }
  function drawStatic() { buildStatic();
    if (bvN) { gl.bindBuffer(gl.ARRAY_BUFFER, bvb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, bvN); }
  }
  function building(b) {
    const t = T(), m = b.lv || 1, isC = b.t === 'core', x = b.x + b.w / 2, y = b.y + b.w / 2;
    let sc = 1; if (b.pop != null && b.pop < .4) { if (b.pop < 0) return; sc = typeof easeBack === 'function' ? easeBack(b.pop / .4) : b.pop / .4; }
    const fl = b.hit > 0 ? .8 : 0, on = !b.off && !b.nc && !b.dis, s = sc, nt = DKn > .3, wl = on ? (nt ? 1.5 : .55) : 0;
    if (HDM && (REAL || b.t === 'farm') && hdBuilding(b, x, y, s, fl)) return;
    const B = (dx, dz, h, w, ht, d, c, e, ry, rx) => box(x + dx * s, y + dz * s, h * s, w * s, ht * s, d * s, c, (e || 0) + fl, ry, rx);
    const C = (dx, dz, h, w, ht, c, e, ry, rx, d) => cyl(x + dx * s, y + dz * s, h * s, w * s, ht * s, c, (e || 0) + fl, ry, rx, d && d * s);
    const Cm = (dx, dz, h, w, ht, c, e, ry, rx) => put(CYLm, x + dx * s, h * s, y + dz * s, w * s, ht * s, w * s, ry || 0, rx || 0, c, (e || 0) + fl);
    const Sp = (dx, dz, h, w, ht, d, c, e, ry) => put(SPH, x + dx * s, h * s, y + dz * s, w * s, ht * s, d * s, ry || 0, 0, c, (e || 0) + fl);
    const Sm = (dx, dz, h, w, c, e) => put(SPHm, x + dx * s, h * s, y + dz * s, w * s, w * s, w * s, 0, 0, c, (e || 0) + fl);
    const H = (dx, dz, h, w, ht, c, e) => put(HEMI, x + dx * s, h * s, y + dz * s, w * s, ht * s, w * s, 0, 0, c, (e || 0) + fl);
    const K = (dx, dz, h, w, ht, c, e, ry, rx) => put(CONE, x + dx * s, h * s, y + dz * s, w * s, ht * s, w * s, ry || 0, rx || 0, c, (e || 0) + fl);
    const Tb = (dx, dz, h, w, ht, c, e) => put(TUBE, x + dx * s, h * s, y + dz * s, w * s, ht * s, w * s, 0, 0, c, (e || 0) + fl);
    const ring = (n_, r, f) => { for (let i = 0; i < n_; i++) { const q = i / n_ * Math.PI * 2; f(Math.cos(q) * r, Math.sin(q) * r, q); } };
    const key = b.t + '|' + m + '|' + on + '|' + HQ + '|' + nt + '|' + (b.nc ? 1 : 0) + '|' + (b.t === 'wall' || b.t === 'shield' ? S.lv : '');
    const L = S.L.bg;
    cached(b, key, () => { switch (b.t) {
      case 'core': {
        C(0, 0, 0, 31, 2.4, '#4a4752'); C(0, 0, 2.4, 29.5, .8, '#ffcf4a', .15);
        ring(4, 13.5, (dx, dz, q) => { B(dx, dz, 0, 4, 1.4, 4, '#3a3a44', 0, q); Cm(dx, dz, 1.4, 1.4, 2, '#9aa3ad'); });
        C(0, 0, 3.2, 22, 9, '#e9eef3'); Tb(0, 0, 7, 22.5, .9, '#b9bfcc'); Tb(0, 0, 4, 22.4, .6, '#ff7a3d', .2);
        H(0, 0, 12.2, 22, 11, '#f4f6fa'); Tb(0, 0, 12.2, 22.5, 1.1, '#9aa3ad'); Tb(0, 0, 17.6, 17, .7, '#c9ccd6');
        ring(10, 11.1, (dx, dz, q) => { if (Math.abs(q - Math.PI / 2) < .35) return; B(dx, dz, 8.4, 2.8, 2, .5, '#9fd0ff', wl, q + Math.PI / 2); });
        B(0, 12.3, 3.2, 7.4, 7.6, 5, '#d9dde6'); B(0, 14.9, 3.2, 4.2, 6, .4, '#2a2833'); B(0, 15, 9.3, 7.6, .8, .6, '#ff7a3d'); B(0, 16.6, 0, 6, 1.4, 3.4, '#5d5966');
        for (const q of [-1, 1]) { C(q * 10.4, q * -3.5, 5.6, 7, 5.2, '#d9dde6', 0, -q * Math.PI / 2, Math.PI / 2); C(q * 15.4, q * -3.5, 5.6, 7.4, .7, '#9aa3ad', 0, -q * Math.PI / 2, Math.PI / 2); B(q * 13, q * -3.5 + 3.4, 5.2, 2.4, 1.6, .4, '#9fd0ff', wl * .8); }
        Cm(-6, -6, 17.5, 1.3, 8, '#bbbbbb'); Cm(12, -9, 0, 1, 25, '#bbbbbb'); B(12, -9, 6, 2.4, 2.4, 2.4, '#5d5966');
        Cm(5, -7, 17, .5, 6, '#dddddd'); Sm(5, -7, 23, .9, '#ffffff', .6);
        break; }
      case 'solar': { B(0, 0, 0, 7, 1.2, 7, '#4a4752'); Cm(0, 0, 1, 2.2, 4, '#8e8a98'); B(0, 0, 4.2, 4, 1, 1, '#5d5966'); B(0, 0, 4.5, 15.4, .8, 15.4, '#c9ccd6', 0, 0, -.45);
        for (let i = -1; i <= 1; i++) for (const dz of [-3.5, 3.5]) B(i * 4.9, dz * .9 - .35, 5.22 + .435 * dz, 4.5, .5, 6.6, dustC(b, '#2348a8'), on ? .3 * (1 - (b.dust || 0) * .7) : 0, 0, -.45);
        for (const dz of [-3.5, 3.5]) B(0, dz * .9 - .35, 5.5 + .435 * dz, 14.6, .4, .25, '#d9dde6', 0, 0, -.45);
        B(5.5, 5.5, 0, 3, 3, 2.4, '#e9eef3'); B(5.5, 6.75, 2, .8, .5, .1, on ? '#5fe08a' : '#663333', on ? 1.2 : 0); break; }
      case 'o2': { B(0, 0, 0, 14.5, 2, 14.5, '#24333d'); B(0, 0, 2, 13, .5, 13, '#5d5966');
        C(0, 0, 2, 11, 12, '#6fd8e8', on ? .2 : 0); for (const h of [4, 7.5, 11]) C(0, 0, h, 11.7, 1.2, '#24333d'); K(0, 0, 14, 8.5, 3, '#c9f6ff'); Cm(3, 3, 14, 1.4, 4, '#9aa3ad'); Cm(-2.5, -2, 15, 1, 3, '#9aa3ad');
        for (const q of [-1, 1]) { C(q * 5, 5, 2, 4, 8, '#e9eef3'); H(q * 5, 5, 10, 4, 2, '#e9eef3'); Tb(q * 5, 5, 6, 4.3, .6, '#2a6bd8', .2); }
        B(0, 5, 6, 9, 1, 1, '#9aa3ad'); Sm(0, 5, 6.5, 1.6, '#ff7a3d'); B(0, -5.7, 5, 2.4, 2.4, .4, '#ffffff', .2); B(0, -5.95, 5.6, .3, 1.2, .1, '#ff5466', .6); break; }
      case 'farm': { B(0, 0, 0, 15.5, 2.2, 15.5, '#5d5966'); B(0, 0, 2.2, 13.5, 1.6, 13.5, '#4a2f1f');
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const hh = 3 + ((i + j) % 2) * 1.5; Sp(-4.2 + i * 4.2, -4.2 + j * 4.2, 3.4, 3.4, hh, 3.4, j === 1 ? '#5fe08a' : '#3fbf5a', on ? .16 : 0, i + j); Sm(-4.2 + i * 4.2 + .8, -4.2 + j * 4.2, 3.4 + hh * .8, .9, i % 2 ? '#ff6b6b' : '#ffcf4a', .3); }
        ring(4, 9.6, (dx, dz) => Cm(dx * .74, dz * .74, 2.2, .8, 4, '#c9ccd6'));
        B(0, 0, 9.8, 12, .5, .8, '#ff6bd6', on ? (nt ? 1.8 : .9) : 0); Cm(6.5, -6.5, 0, 3, 5, '#7fb2d8'); H(6.5, -6.5, 5, 3, 1.4, '#7fb2d8'); break; }
      case 'pylon': { B(0, 0, 0, 6.5, 2, 6.5, '#5d5966');
        for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B(a * 1.5, c * 1.5, 2, .7, 18.5, .7, '#9a98a6');
        for (const h of [6, 11, 16]) { for (const q of [-1, 1]) { B(0, q * 1.5, h, 3.6, .45, .45, '#7a788a'); B(q * 1.5, 0, h, .45, .45, 3.6, '#7a788a'); } }
        B(0, 0, 20.3, 12, 1, 1.2, '#8e8a98'); for (const q of [-5, 0, 5]) { Cm(q, 0, 21.3, .7, 1.6, '#c9d2dc'); for (let k = 0; k < 3; k++) Cm(q, 0, 21.4 + k * .5, 1.8, .25, '#e9eef3'); } break; }
      case 'battery': { B(0, 0, 0, 15, 1.5, 13, '#3a3a44'); B(0, -6, 1.5, 14, 8, .5, '#5d5966');
        for (let i = -1; i <= 1; i++) { C(i * 4.6, .5, 1.5, 4.2, 9, '#4a4a55'); Tb(i * 4.6, .5, 3, 4.4, .6, '#ffcf4a', .25); Tb(i * 4.6, .5, 8.5, 4.4, .6, '#ffcf4a', .25); Cm(i * 4.6, .5, 10.5, 1.8, 1, i ? '#c9c6d4' : '#ff5466'); }
        B(0, -2.5, 10.4, 11, .4, .4, '#ff9a3d', .3); break; }
      case 'wall': { const c = L[3], c2 = L[1]; B(0, 0, 0, 16, 1.2, 16, c2);
        for (const dz of [-3.6, 3.6]) for (let i = -1; i <= 1; i++) Sp(i * 5.2, dz, .8, 5.8, 5.2, 7.4, (i + (dz > 0 ? 1 : 0)) % 2 ? c : c2, 0, i);
        for (const dx of [-2.6, 2.6]) Sp(dx, 0, 4.6, 6, 5, 12.5, c, 0, dx);
        Sp(0, 0, 8.4, 6.5, 4, 9, c2, 0, 1); for (const q of [-5, 0, 5]) { Cm(q, 6, 0, .7, 11, '#9aa3ad'); K(q, 6, 11, 1.4, 2.4, '#c9ccd6'); } B(0, 6, 9.5, 11, .5, .5, '#9aa3ad'); break; }
      case 'habitat': { B(0, 0, 0, 15, 2, 15, '#5d5966'); C(0, 0, 2, 14, 6, '#d9dde6'); H(0, 0, 8, 14, 7, '#f4f6fa');
        for (let i = 0; i < 3; i++) Tb(0, 0, 3 + i * 2.4, 14.4, .6, '#b9bfcc'); Tb(0, 0, 10.5, 12.4, .5, '#b9bfcc'); Tb(0, 0, 13, 8, .5, '#b9bfcc');
        ring(6, 7, (dx, dz, q) => { if (Math.abs(q - Math.PI / 2) < .3) return; B(dx, dz, 5, 1.6, 1.6, .6, '#fff1d0', wl, q + Math.PI / 2); });
        B(0, 6.6, 2, 3.2, 5, 1, '#3b78c8', on ? .4 : 0); B(0, 7.3, 7.4, 4, .5, 1.6, '#9aa3ad'); Cm(4, -3, 14.4, .6, 4, '#bbbbbb'); B(4, -3, 18.4, 6, .4, 3, '#2c5bc4', .25); break; }
      case 'shield': { C(0, 0, 0, 16, 4, L[3]); C(0, 0, 4, 13, 3.5, L[1]); C(0, 0, 7.5, 9.5, 3, L[3]); C(0, 0, 10.5, 5.5, 1.5, L[1]);
        ring(7, 7.6, (dx, dz, q) => Sp(dx, dz, 2.5, 3, 2.4, 3, L[4], 0, q)); Cm(0, 0, 12, .8, 3.4, '#bbbbbb'); B(0, 7.4, 2, 3.4, 3.4, .4, '#ffcf4a', .2); B(0, 7.65, 3.1, 1.2, 1.2, .1, '#2a2833'); break; }
      case 'drill': { B(0, 0, 0, 13.5, 2.6, 13.5, '#5d5966'); for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B(a * 5, c * 5, 2.6, 1.6, 14, 1.6, '#ff9a3d');
        for (const q of [-1, 1]) { B(0, q * 5, 9, 10, .8, .8, '#e07a2a'); B(q * 5, 0, 9, .8, .8, 10, '#e07a2a'); }
        B(0, 0, 16.4, 12.4, 2, 12.4, '#c0400a'); C(0, 0, 18.4, 5.5, 3.6, '#3a3a44'); Cm(2, 2, 22, .8, 3, '#9aa3ad');
        B(-5.6, 5.6, 0, 5, 3.6, 5, '#7a6a5a'); for (let i = 0; i < 3; i++) put(HQ ? ROCKS[i] : SPH, x + (-6.2 + i * 1.2) * s, 3.4 * s, y + (5 + i * .6) * s, 2.4 * s, 2 * s, 2.4 * s, i, 0, '#9aa0aa', fl); break; }
      case 'turret': { C(0, 0, 0, 12.5, 3.6, '#5a5a66'); Tb(0, 0, 3.6, 12.7, .8, '#ffcf4a', .2); C(0, 0, 3.6, 6.5, 2, '#3a3a44');
        ring(8, 6, (dx, dz, q) => B(dx, dz, 1, 1.2, 1.4, 2, '#3a3a44', 0, q)); break; }
      case 'tesla': { B(0, 0, 0, 13, 2.6, 13, '#3d3a46'); ring(4, 6.2, (dx, dz, q) => B(dx, dz, 2.6, 2, 2, 2, '#5d5966', 0, q + .78));
        C(0, 0, 2.6, 5, 12.4, '#6d6a78'); for (let i = 0; i < 6; i++) Tb(0, 0, 4.4 + i * 1.6, 6 + (i % 2) * .6, .9, '#b87333', .15);
        Tb(0, 0, 14.8, 11, 1.8, '#9aa3ad'); C(0, 0, 14.6, 3, 1.6, '#3d3a46'); break; }
      case 'rtg': { B(0, 0, 0, 11, 2, 11, '#3d3a46');
        for (let i = 0; i < 6; i++) B(-4.6 + i * 1.84, 5.6, .6, .9, .8, .3, i % 2 ? '#2a2833' : '#ffcf4a', .2);
        C(0, 0, 2, 6.4, 11, '#4a4752'); for (let i = 0; i < 8; i++) B(0, 0, 2.6, 13, 9.2, .9, '#6d6a78', 0, i * Math.PI / 8); C(0, 0, 12.6, 7, .8, '#5d5966'); Cm(0, 0, 13.4, 2.6, 1, '#3a3a44');
        B(0, 3.6, 4, 2.6, 2.6, .3, '#ffcf4a', .4); break; }
      case 'medbay': { B(0, 0, 0, 14, 8, 12, '#e9eef3'); B(0, 0, 8, 13, 1.6, 10.5, '#d9dde6'); B(0, 0, 9.6, 8.5, .5, 2.4, '#ff5466', 1); B(0, 0, 9.6, 2.4, .5, 8.5, '#ff5466', 1);
        B(0, 6.05, 2.4, 1.2, 4.4, .3, '#ff5466', .8); B(0, 6.05, 4, 4.4, 1.2, .3, '#ff5466', .8); for (const q of [-1, 1]) B(q * 4.6, 6.05, 3.6, 2.4, 2, .2, '#9fd0ff', on ? .6 : 0);
        B(7.05, 0, 0, .3, 6, 4, '#3b78c8', on ? .3 : 0); B(0, -6.2, 1, 10, 1, .6, '#ff5466', .3); Cm(-5, -4, 9.6, .5, 5, '#bbbbbb'); Sm(-5, -4, 14.6, .9, '#ffffff', .5); break; }
      case 'reactor': { B(0, 0, 0, 15.5, 3, 15.5, '#3d3a46'); ring(4, 6.8, (dx, dz, q) => B(dx, dz, 0, 3, 3.6, 3, '#ffcf4a', .3, q + .78));
        C(0, 0, 3, 7, 9, '#6d6a78'); put(CONE, x, 19 * s, y, 15 * s, 7 * s, 15 * s, 0, Math.PI, '#c9ccd6', fl); Tb(0, 0, 18.4, 15, .6, '#9aa3ad'); Cm(0, 0, 19, 1.6, 3, '#9aa3ad'); break; }
      default: B(0, 0, 0, 14, 10, 14, '#888');
    }
    // upgrades you can see: level 2 adds parts, level 3 adds gold trim and extras
    if (m >= 2 && !isC) { const G2 = m >= 3 ? '#ffcf4a' : '#9fd6ff';
      switch (b.t) {
        case 'solar': B(0, 7.2, .2, 15, .7, 1.2, G2, .5); for (const q of [-1, 1]) { Cm(q * 6.6, -6, 0, .7, 7.5, '#8e8a98'); B(q * 6.6, -6, 7.4, 4.4, .4, 4.6, dustC(b, '#2348a8'), on ? .3 : 0, 0, -.6); } break;
        case 'o2': C(0, -5.6, 2, 4, 9, '#e9eef3'); H(0, -5.6, 11, 4, 2, '#e9eef3'); Tb(0, -5.6, 7, 4.3, .6, G2, .4); break;
        case 'farm': for (const q of [-1, 1]) B(q * 4.6, 0, 9.4, .8, .5, 11, '#ff6bd6', on ? (nt ? 1.8 : .9) : 0); Cm(-6.5, 6.5, 0, 2.4, 6, '#7fb2d8'); break;
        case 'pylon': B(0, 0, 16.6, 9, .8, 1, '#8e8a98'); for (const q of [-3.5, 3.5]) Cm(q, 0, 17.4, .6, 1.2, '#c9d2dc'); break;
        case 'battery': for (const q of [-1, 1]) { C(q * 2.3, -3.8, 1.5, 3.2, 7.4, '#4a4a55'); Tb(q * 2.3, -3.8, 7, 3.4, .5, G2, .4); } break;
        case 'wall': B(0, 6.3, .6, 15, 7.2, .6, '#8e8a98'); B(0, 6.6, 3.6, 13, .6, .2, G2, .4); break;
        case 'habitat': C(0, 0, 14.6, 8, 4, '#d9dde6'); Tb(0, 0, 16.2, 8.4, .5, G2, .5); break;
        case 'shield': Tb(0, 0, 3, 16.4, 1, G2, .3); break;
        case 'drill': for (const q of [-1, 1]) B(q * 6.2, 0, 16.4, 1.4, 4, 1.4, '#ff9a3d'); B(0, 0, 20.2, 13.6, .8, 1.4, '#e07a2a'); break;
        case 'turret': Tb(0, 0, 1.8, 13.2, .8, G2, .4); break;
        case 'tesla': Tb(0, 0, 11.4, 13, 1.2, '#9aa3ad'); break;
        case 'rtg': for (let i = 0; i < 8; i++) B(0, 0, 3.6, 14.6, 4, .4, '#8e8a98', 0, i * Math.PI / 8 + Math.PI / 16); break;
        case 'medbay': B(-8.6, 0, 0, 3.2, 6, 9, '#e9eef3'); B(-10.25, 0, 2.4, .2, 2, 4, '#9fd0ff', on ? .6 : 0); break;
        case 'reactor': Tb(0, 0, 14.6, 12, .6, '#9aa3ad'); for (const q of [-1, 1]) { C(q * 6.4, -5.6, 0, 3, 6.4, '#c9ccd6'); H(q * 6.4, -5.6, 6.4, 3, 1.4, '#c9ccd6'); } break;
      } }
    if (m >= 3 && !isC) switch (b.t) {
        case 'solar': Cm(0, 0, 9, .5, 6, '#ffcf4a', .3); Sm(0, 0, 15, 1, '#ffcf4a', 1); break;
        case 'o2': Tb(0, 0, 13.6, 9.4, .8, '#ffcf4a', .7); break;
        case 'farm': Cm(0, 0, 13.5, .5, 2, '#ffcf4a', .3); Sm(0, 0, 15.6, 1.4, '#ffcf4a', 1); break;
        case 'pylon': Cm(0, 0, 22, .4, 6, '#ffcf4a', .4); K(0, 0, 28, .9, 2, '#ffcf4a', .6); break;
        case 'battery': for (let i = -1; i <= 1; i++) Tb(i * 4.6, .5, 6, 4.4, .6, '#ffcf4a', .6); break;
        case 'wall': for (let i = -2; i <= 2; i++) K(i * 3.2, -2, 11.4, 1.4, 4, '#c9ccd6'); break;
        case 'habitat': H(0, 0, 18.6, 6, 4, '#bfe8ff', .4); Cm(3, 2, 18.6, .4, 5, '#bbbbbb'); break;
        case 'shield': Tb(0, 0, 9, 10.4, .8, '#ffcf4a', .6); break;
        case 'drill': Tb(0, 0, 3, 13.8, .8, '#ffcf4a', .5); break;
        case 'tesla': for (const q of [-1, 1]) { Cm(q * 5.5, 5.5, 2.6, 1.6, 6, '#6d6a78'); Tb(q * 5.5, 5.5, 6.2, 2.6, .6, '#b87333', .3); Sm(q * 5.5, 5.5, 9, 1.4, '#7df9ff', 1.4); } break;
        case 'rtg': Tb(0, 0, 12, 7.4, .6, '#ffcf4a', .7); break;
        case 'medbay': C(0, 0, 10.1, 8, .3, '#3a3a44'); B(0, 0, 10.4, 2.6, .1, .5, '#ffffff', .6); B(0, 0, 10.4, .5, .1, 2.6, '#ffffff', .6); break;
        case 'reactor': ring(6, 7.6, (dx, dz, q) => B(dx, dz, 3, 1, 4, 1, '#7df9ff', .8, q)); break;
        case 'turret': break;
      }
    }, !!b.ghost || fl > 0 || s !== 1);
    // moving and blinking parts
    switch (b.t) {
      case 'core': { const bl = Math.floor(t * 2) % 2; put(SPHm, x + 12 * s, 25 * s, y - 9 * s, 2.2 * s, 2.2 * s, 2.2 * s, 0, 0, bl ? '#ff4040' : '#661010', bl ? 1.6 : 0);
        put(CONE, x - 6 * s, 28.5 * s, y - 6 * s, 9 * s, 3 * s, 9 * s, t * .4, Math.PI + .5, '#e9eef3', fl); put(SPHm, x - 6 * s, 26 * s, y - 6 * s, 1.3 * s, 1.3 * s, 1.3 * s, 0, 0, '#7df9ff', 1.2);
        put(BOX, x, 10.2 * s, y + 15.1 * s, 2 * s, .8 * s, .3 * s, 0, 0, '#ffcf4a', on && Math.floor(t * 1.5) % 2 ? 1.6 : .2); break; }
      case 'o2': if (on) for (let i = 0; i < 3; i++) { const k = (t * .8 + i / 3) % 1; put(SPH, x + 3 * s, (18 + k * 10) * s, y + 3 * s, (2 + k * 2.4) * s, (2 + k * 2.4) * s, (2 + k * 2.4) * s, 0, 0, '#e8fbff', .4, .65 - k * .65, true); } break;
      case 'farm': put(HEMI, x, 4 * s, y, 15 * s, 10 * s, 15 * s, 0, 0, '#cfe9f5', on ? .35 : .1, .3, true); break;
      case 'pylon': { const bl = Math.floor(t * 2) % 2; put(SPHm, x, 23 * s, y, 2.6 * s, 2.6 * s, 2.6 * s, 0, 0, bl ? '#ffcf4a' : '#a8801a', bl && on ? 1.5 : .2); break; }
      case 'battery': { const k = clamp(S.res.pw / Math.max(1, S.cap), .05, 1); for (let i = -1; i <= 1; i++) { const kk = clamp(k * 3 - (i + 1), 0, 1); if (kk > 0) box(x + i * 4.6 * s, y + 2.65 * s, 2.5 * s, 1.2 * s, 6.5 * kk * s, .3 * s, k < .25 ? '#ff5466' : '#5fe08a', 1.3); } break; }
      case 'habitat': put(SPHm, x + 5 * s, 7.4 * s, y + 5.6 * s, 1.2 * s, 1.2 * s, 1.2 * s, 0, 0, '#5fe08a', Math.floor(t * 1.5) % 2 && on ? 1.4 : 0); break;
      case 'shield': put(SPHm, x, 15.6 * s, y, 2.6 * s, 2.6 * s, 2.6 * s, 0, 0, '#ffcf4a', .5 + .4 * Math.sin(t * 3)); break;
      case 'drill': { const sp = on ? t * 9 : 0; put(CYLm, x, 4 * s, y, 3 * s, 12.4 * s, 3 * s, sp, 0, '#9aa3ad', fl); for (let i = 0; i < 4; i++) box(x, y, (5 + i * 2.8) * s, 4.4 * s, .5 * s, 1 * s, '#d8e2ea', fl, sp + i * .8);
        put(CONE, x, 4.4 * s, y, 5 * s, 4.4 * s, 5 * s, sp, Math.PI, '#d8e2ea', on ? .2 : 0); if (on) for (let i = 0; i < 2; i++) { const k = (t * 1.5 + i * .5) % 1; put(SPH, x + Math.cos(t * 3 + i * 3) * 6 * k, 1 + k * 3, y + Math.sin(t * 3 + i * 3) * 6 * k, 3 + k * 3, 2 + k * 2, 3 + k * 3, 0, 0, L[4], .1, .45 * (1 - k), true); } break; }
      case 'turret': { const a = b.a == null ? -1.57 : b.a, ca = Math.cos(a), sa = Math.sin(a), rc = b.cd != null && b.cd > .55 ? (b.cd - .55) * 2 : 0;
        put(SPH, x, 5 * s, y, 9 * s, 7 * s, 9 * s, a, 0, '#8a93a6', fl); box(x - ca * 3 * s, y - sa * 3 * s, 6 * s, 3 * s, 4 * s, 7 * s, '#5a6170', fl, a);
        for (const q of (m >= 3 ? [-1.4, 0, 1.4] : m === 2 ? [-1, 1] : [0])) { const px = x + (ca * (2 - rc) - sa * q * 1.5) * s, py = y + (sa * (2 - rc) + ca * q * 1.5) * s; put(CYLm, px, 8.6 * s, py, 1.5 * s, 7 * s, 1.5 * s, a - Math.PI / 2, Math.PI / 2, '#3a3f4c', fl); put(SPHm, px + ca * 7 * s, 8.6 * s, py + sa * 7 * s, 1 * s, 1 * s, 1 * s, 0, 0, '#ff5050', on ? 1 + rc * 2 : 0); }
        put(SPHm, x + ca * 3.9 * s, 10.4 * s, y + sa * 3.9 * s, 1.4 * s, 1.4 * s, 1.4 * s, 0, 0, '#ff3030', on ? 1.6 : 0); break; }
      case 'tesla': { const g = on ? .9 + .6 * Math.abs(Math.sin(t * 9)) : .1; put(SPH, x, 15.8 * s, y, 7.5 * s, 7.5 * s, 7.5 * s, t, 0, '#7df9ff', g + fl);
        if (on) { put(SPH, x, 14.6 * s, y, 11 * s, 11 * s, 11 * s, 0, 0, '#7df9ff', 2, .12 + .08 * Math.sin(t * 13), true); for (let i = 0; i < 3; i++) { const q = t * 7 + i * 2.1 + Math.sin(t * 31 + i) * .6, l = 6 + Math.sin(t * 23 + i) * 2; box(x + Math.cos(q) * (4 + l / 2) * s, y + Math.sin(q) * (4 + l / 2) * s, (19 + Math.sin(t * 17 + i) * 1.5) * s, l * s, .35 * s, .35 * s, '#e8fbff', 2.5, q); } } break; }
      case 'rtg': put(CYLm, x, 14.4 * s, y, 3.4 * s, .6 * s, 3.4 * s, 0, 0, '#ff9a3d', on ? 1.2 + .3 * Math.sin(t * 3) : .3); break;
      case 'medbay': { const bl = Math.floor(t * 3) % 2; if (on) { put(SPHm, x + 5.5 * s, 9.8 * s, y + 4.5 * s, 1.3 * s, 1.3 * s, 1.3 * s, 0, 0, bl ? '#ff3040' : '#3060ff', 1.6); put(SPHm, x - 5.5 * s, 9.8 * s, y + 4.5 * s, 1.3 * s, 1.3 * s, 1.3 * s, 0, 0, bl ? '#3060ff' : '#ff3040', 1.6); } break; }
      case 'reactor': { const g = on ? 1 + .5 * Math.sin(t * 4) : .1; put(TUBE, x, 3 * s, y, 9 * s, 1 * s, 9 * s, 0, 0, '#7df9ff', g); put(CYLm, x, 12 * s, y, 4.6 * s, 3 * s, 4.6 * s, 0, 0, '#7df9ff', g); break; }
    }
    if (m > 1 && !isC) for (let i = 0; i < m; i++) put(SPHm, b.x + b.w - 2 - i * 3, 1, b.y + b.w - 1, 2.2, 2.2, 2.2, 0, 0, '#ffcf4a', 1.2);
  }
  function astro(x, y, ang, walk, SU, job, scale, drive) {
    if (drive) return; const s = scale || 1, sw = Math.sin(walk * 11) * .55, ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca, ry = ang + Math.PI / 2;
    const at = (f, r) => [x + ca * f * s + px * r * s, y + sa * f * s + py * r * s];
    let p;
    for (const q of [-1, 1]) { const th = sw * q, hp = at(0, q * 1.5); put(CYL, hp[0], 5 * s, hp[1], 2.3 * s, 4.8 * s, 2.3 * s, ry, Math.PI + th, SU.p, 0);
      const fp_ = at(Math.sin(th) * 4.8 + .5, q * 1.5); box(fp_[0], fp_[1], Math.max(0, 5 - Math.cos(th) * 4.8 - 1) * s, 3.4 * s, 1.6 * s, 2.5 * s, '#4a4a55', 0, ang); }
    put(CYL, x, 4.4 * s, y, 4.8 * s, 5.4 * s, 5.8 * s, ang, 0, SU.b, 0); put(CYL, x, 4.4 * s, y, 5.1 * s, .9 * s, 6.1 * s, ang, 0, '#5a5a66', 0);
    p = at(2.2, 0); box(p[0], p[1], 6.4 * s, .7 * s, 2 * s, 3 * s, job || '#3b78c8', job ? .5 : .3, ang); p = at(2.45, -.7); box(p[0], p[1], 7.6 * s, .4 * s, .5 * s, .5 * s, '#5fe08a', 1.2, ang);
    p = at(-3.1, 0); box(p[0], p[1], 4.8 * s, 2.4 * s, 5.6 * s, 5.2 * s, SU.p, 0, ang);
    for (const q of [-1, 1]) { p = at(-4.3, q * 1.3); put(CYL, p[0], 5.2 * s, p[1], 1.5 * s, 4.6 * s, 1.5 * s, ang, 0, '#c9ccd6', 0); }
    p = at(-3.6, -1.9); box(p[0], p[1], 10.2 * s, .35 * s, 4 * s, .35 * s, '#bbbbbb', 0, ang); put(SPH, p[0], 14 * s, p[1], .9 * s, .9 * s, .9 * s, 0, 0, '#ff4040', Math.floor(T() * 2) % 2 ? 1.6 : .2);
    for (const q of [-1, 1]) { const gun = q > 0, th = gun ? 1.15 : -sw * q * .8, sh = at(0, q * 3.4); put(CYL, sh[0], 9.4 * s, sh[1], 1.9 * s, 4.4 * s, 1.9 * s, ry, Math.PI + th, SU.b, 0);
      const hd = at(Math.sin(th) * 4.4, q * 3.4); put(SPH, hd[0], (9.4 - Math.cos(th) * 4.4 - 1) * s, hd[1], 2 * s, 2 * s, 2 * s, ang, 0, SU.p, 0);
      if (gun) { p = at(Math.sin(th) * 4.4 + 2.2, q * 3.4); box(p[0], p[1], (9.4 - Math.cos(th) * 4.4 - .6) * s, 4.6 * s, 1.5 * s, 1.4 * s, '#4a4f5c', 0, ang); p = at(Math.sin(th) * 4.4 + 4.6, q * 3.4); box(p[0], p[1], (9.4 - Math.cos(th) * 4.4 - .2) * s, .6 * s, .7 * s, .7 * s, '#7df9ff', 1.4, ang); } }
    put(SPH, x, 9.6 * s, y, 6.6 * s, 6.3 * s, 6.6 * s, ang, 0, SU.b, 0);
    p = at(1.75, 0); put(SPH, p[0], 10.9 * s, p[1], 3.6 * s, 3.5 * s, 5 * s, ang, 0, SU.v, .4);
    p = at(2.7, -.9); put(SPH, p[0], 12.1 * s, p[1], .7 * s, .5 * s, 1.1 * s, ang, 0, '#ffffff', 1.4);
    if (SU.ears) { p = at(0, -1.8); put(CONE4, p[0], 14.3 * s, p[1], 1.6 * s, 2.4 * s, 1.6 * s, ang, 0, SU.b, 0); p = at(0, 1.8); put(CONE4, p[0], 14.3 * s, p[1], 1.6 * s, 2.4 * s, 1.6 * s, ang, 0, SU.b, 0); }
  }
  // first-person blaster held in front of the camera
  function heldGun(eye, fx, fz, lp) {
    const rx_ = -fz, rz_ = fx, a = Math.atan2(fz, fx); let w = null; try { w = WP[S.wp]; } catch (e) {}
    let rc = 0; try { rc = clamp(S.p.cd / Math.max(.05, w.cd), 0, 1); } catch (e) {}
    const bob = S.mv ? Math.sin((S.walk || 0) * 11) * .2 * Math.min(1, Math.hypot(S.mv.x, S.mv.y) / 60) : 0, f = 4.6 - rc * .7, dn = 2.5 + Math.sin(lp) * f + bob, R = 2.3;
    const at = (ff, rr) => [eye[0] + fx * ff + rx_ * rr, eye[2] + fz * ff + rz_ * rr], gc = (w && w.col) || '#7df9ff', hh = eye[1] - dn;
    if (HDM) { rifle(at(f - 1.4, R), hh - .1, a, .5, gc, rc > .72 ? (rc - .72) / .28 : 0); return; } let p = at(f, R); box(p[0], p[1], hh - .55, 3.4, 1.1, 1, '#d9dde6', 0, a); p = at(f + .2, R); box(p[0], p[1], hh + .55, 2.4, .35, .5, '#3a3f4c', 0, a); p = at(f + .3, R - .52); box(p[0], p[1], hh - .3, 2.6, .3, .06, gc, 1.3, a);
    p = at(f + 2.1, R); box(p[0], p[1], hh - .35, 1, .65, .65, '#2a2833', 0, a); p = at(f + 2.65, R); box(p[0], p[1], hh - .32, .3, .6, .6, gc, 1.5, a);
    p = at(f - .7, R + .15); box(p[0], p[1], hh - .2, 1.2, .45, 1.15, gc, .8, a); p = at(f - .9, R); put(SPH, p[0], hh - 2, p[1], 1.5, 1.6, 1.5, a, 0, suitOf().p, 0);
    if (rc > .72) { p = at(f + 3.2, R); put(SPH, p[0], hh - .75, p[1], 1 + Math.random() * .6, 1 + Math.random() * .6, 1 + Math.random() * .6, 0, 0, gc, 3, .85, true); }
  }
  function rover(r, ang, sk) { // six-wheel rocker-bogie rover
    const x = r.x, y = r.y, t = T(), ca = Math.cos(ang), sa = Math.sin(ang), at = (f, q) => [x + ca * f - sa * q, y + sa * f + ca * q], mv = S.drive ? (S.walk || 0) * 9 : 0;
    let p;
    for (const f of [-7.5, 0, 7.5]) for (const q of [-1, 1]) { p = at(f, q * 6.9 - 1.3); put(CYL, p[0], 3, p[1], 5.6, 2.6, 5.6, ang, Math.PI / 2, '#2a2833', 0);
      p = at(f, q * 6.9 - .3); put(CYLm, p[0], 3, p[1], 2.6, .7 + (q > 0 ? 1.3 : 0), 2.6, ang, Math.PI / 2, '#b9bdc6', 0);
      for (let k = 0; k < 3; k++) { const qa = mv + k * 1.05; p = at(f + Math.cos(qa) * 2.6, q * 6.9); box(p[0], p[1], 3 + Math.sin(qa) * 2.6 - .25, .9, .5, 2.7, '#4a4a55', 0, ang); } }
    for (const q of [-1, 1]) { p = at(-3.7, q * 5.3); box(p[0], p[1], 5.2, 9, 1, 1, '#8e8a98', 0, ang, 0); p = at(3.7, q * 5.3); box(p[0], p[1], 4.4, 9, 1, 1, '#8e8a98', 0, ang); p = at(0, q * 5.3); put(CYLm, p[0], 4.5, p[1], 2, 1.6, 2, ang, Math.PI / 2, '#5d5966', 0); }
    box(x, y, 4.2, 19, 3.6, 10, sk.b, 0, ang); p = at(9.4, 0); box(p[0], p[1], 4.4, 1.2, 2.6, 9, '#3a3a44', 0, ang);
    box(x, y, 7.8, 13, 2.6, 9, sk.t, 0, ang); p = at(-1, 0); box(p[0], p[1], 10.4, 11, .35, 9.4, '#2c5bc4', .25, ang);
    if (sk.pat === 'stripe') box(x, y, 7.9, 19.2, 3.8, 2.6, sk.s, 0, ang);
    for (const q of [-3.5, 3.5]) { p = at(9.8, q); box(p[0], p[1], 5, 1, 1.8, 2.2, '#fff3b0', S.drive ? 1.8 : .35, ang); }
    p = at(-6, 3); put(CYLm, p[0], 10.4, p[1], .9, 8, .9, 0, 0, '#bbbbbb', 0); box(p[0], p[1], 18.2, 2.6, 2, 3.6, '#e9eef3', 0, ang);
    p = at(-4.6, 3); put(SPHm, p[0], 18.6, p[1], 1.1, 1.1, 1.1, 0, 0, '#7df9ff', 1.2);
    p = at(-6.5, -3.4); put(CYLm, p[0], 10.4, p[1], .5, 3, .5, 0, 0, '#bbbbbb', 0); put(CONE, p[0], 15.4, p[1], 5, 1.8, 5, t * .5, Math.PI + .5, '#e9eef3', .1);
    if (Math.floor(t * 2) % 2) { p = at(-8.8, -3.8); put(SPHm, p[0], 10.6, p[1], .8, .8, .8, 0, 0, '#ff4040', 1.5); }
    if (S.drive) { const SU = suitOf(); p = at(1.5, 0); box(p[0], p[1], 10.4, 4, 3, 5, '#3a3a44', 0, ang); put(SPH, p[0], 11.2, p[1], 5.5, 5.5, 5.5, ang, 0, SU.b, 0); p = at(3.2, 0); put(SPH, p[0], 12.4, p[1], 2.6, 2.8, 3.8, ang, 0, SU.v, .45); }
  }
  const ALC = { charger: ['#ff8a3d', '#a04a14'], bomber: ['#ff5ad1', '#8a1a70'], grunt: ['#57c84d', '#2d7a2a'], fly: ['#4bb8ff', '#2470b0'], brute: ['#b04ad1', '#6a2490'], spit: ['#c8d84a', '#7a8a22'], queen: ['#e0405a', '#801830'] };
  // jointed legs: upper leg rises out from the hip, lower leg reaches down to the ground
  function legs(x, y, hip, ang, z, list, col, fl, ph, ground, thick) {
    list.forEach((off, i) => { const la = ang + off, sw = Math.sin(ph + i * 2.1), up = Math.max(0, sw) * .35;
      const hx = x + Math.cos(la) * z * .5, hy = y + Math.sin(la) * z * .5, L1 = z * .8, p1 = 2.05 - up * .5;
      put(CYLm, hx, hip, hy, thick, L1, thick, la - Math.PI / 2, Math.PI - p1, col, fl);
      const kx = hx + Math.cos(la) * L1 * Math.sin(p1), ky = hy + Math.sin(la) * L1 * Math.sin(p1), kh = hip - L1 * Math.cos(p1), p2 = .32, L2 = Math.max(1, (kh - ground - up * 2) / Math.cos(p2));
      put(SPHm, kx, kh - thick * .5, ky, thick * 1.3, thick * 1.3, thick * 1.3, 0, 0, col, fl);
      put(CYLm, kx, kh, ky, thick * .8, L2, thick * .8, la - Math.PI / 2, Math.PI - p2, col, fl);
    });
  }
  // the Echo: a floating dark mass with writhing tentacles, many eyes and one great eye that follows you
  function echoBoss(a) {
    const t = T(), R = a.r * 1.45, x = a.x, z = a.y, h = R * 1.35 + Math.sin(t * 1.3) * 3, fl = a.fl > 0, rage = a.hp < a.mh * .25, eyeOn = a.hp < a.mh * .6, P0 = S.p;
    const dx = P0.x - x, dz = P0.y - z, dl = Math.hypot(dx, dz) || 1, lx = dx / dl, lz = dz / dl, pu = .5 + .5 * Math.sin(t * 3);
    put(CYL, x, .3, z, R * 5.4, .3, R * 5.4, t * .1, 0, '#1a0628', 0); put(CYL, x, .55, z, R * 3.8, .3, R * 3.8, -t * .2, 0, rage ? '#7a0020' : '#3a0a50', .6 + .4 * pu, .55, true);
    for (let k = 0; k < 10; k++) { const a0 = k / 10 * 6.283 + t * .05;
      for (let j = 0; j <= 15; j++) { const u = j / 15, an = a0 + Math.sin(t * 1.7 + k * 1.3 + u * 4) * .4 * u, r = R * (.6 + u * 2.7), hh = Math.max(1.2, h * (1 - u) * (1 - u * .3) + Math.sin(u * Math.PI) * R * .35), s = R * (.44 - u * .33);
        put(SPH, x + Math.cos(an) * r, hh, z + Math.sin(an) * r, s, s, s, 0, 0, j > 12 ? '#5a1a6a' : '#22102c', 0);
        if (j % 4 === 2) put(SPH, x + Math.cos(an) * r, hh + s * .55, z + Math.sin(an) * r, s * .34, s * .34, s * .34, 0, 0, '#ff2a80', 1.2 + pu); } }
    put(SPH, x, h, z, R * 2, R * 1.85, R * 2, t * .1, 0, fl ? '#ffffff' : rage ? '#2e0a1a' : '#1c0a26', fl ? 1.5 : 0);
    for (let i = 0; i < 22; i++) { const a2 = i * 2.399, v = ((i * .37) % 1) * 1.6 - .8, rr = Math.sqrt(1 - v * v * .7); put(SPH, x + Math.cos(a2) * R * rr * .95, h + v * R * .85, z + Math.sin(a2) * R * rr * .95, R * .34, R * .28, R * .34, 0, 0, '#2c1238', 0); }
    for (let i = 0; i < 9; i++) { const a2 = i / 9 * 6.283 + t * .2; put(CONE, x + Math.cos(a2) * R * .55, h + R * .75, z + Math.sin(a2) * R * .55, R * .26, R * 1.1, R * .26, 0, .5, '#16061e', 0); put(SPH, x + Math.cos(a2) * R * .82, h + R * 1.7, z + Math.sin(a2) * R * .82, R * .1, R * .1, R * .1, 0, 0, '#ff2a80', 1.8 * pu); }
    for (let i = 0; i < 11; i++) { const a2 = i * 2.3 + .4, op = Math.max(0, Math.sin(t * .8 + i * 1.7)); if (op < .1) continue; const ex = x + Math.cos(a2) * R * .9, ez = z + Math.sin(a2) * R * .9, ey = h + Math.sin(i * 1.9) * R * .55;
      put(SPH, ex, ey, ez, R * .2, R * .16 * op, R * .2, 0, 0, '#ffe8f0', .4); put(SPH, ex + lx * R * .12, ey, ez + lz * R * .12, R * .1, R * .1 * op, R * .1, 0, 0, '#ff1040', 2); }
    const ph = t % 6, lid = (ph > 5.85 ? Math.abs((ph - 5.925) / .075) : 1) * (eyeOn ? 1 : .55), ey = h + R * .05, k1 = R * .92, k2 = R * 1.32, k3 = R * 1.52, dil = rage ? 1.8 : 1 + .2 * Math.sin(t * 1.4);
    put(SPH, x + lx * k1, ey, z + lz * k1, R * .95, R * .8 * lid, R * .95, 0, 0, '#e8dce4', 0);
    put(SPH, x + lx * k2, ey, z + lz * k2, R * .55, R * .55 * lid, R * .55, 0, 0, '#ff1040', 2.2);
    put(SPH, x + lx * k3, ey, z + lz * k3, R * .14 * dil, R * .5 * lid, R * .14 * dil, 0, 0, '#000000', 0);
    put(SPH, x + lx * k2, ey, z + lz * k2, R * 1.1, R * 1.1 * lid, R * 1.1, 0, 0, '#ff1040', 1.6, (.1 + .08 * pu) * lid, true);
    put(SPH, x, h, z, R * 3.2, R * 2.8, R * 3.2, 0, 0, rage ? '#ff1030' : '#5a10a0', 1.1, .04 + .03 * pu, true);
    if (rage) for (let i = 0; i < 8; i++) { const a2 = t * 1.5 + i * .785; put(CONE, x + Math.cos(a2) * R * 2.4, h + Math.sin(t * 2 + i) * R * .6, z + Math.sin(a2) * R * 2.4, R * .12, R * .5, R * .12, t * 3 + i, t * 2, '#3a0a20', .6); put(SPH, x + Math.cos(a2) * R * 2.4, h + Math.sin(t * 2 + i) * R * .6 + R * .25, z + Math.sin(a2) * R * 2.4, R * .07, R * .07, R * .07, 0, 0, '#ff2a50', 2.2); }
  }
  function alien(a) {
    if (a.echo) { if (skCfg(a)) { let sk = 0; if (S.cin && S.cin.k === 'boss') { const k = clamp(S.cin.t / (S.cin.dur * .45), 0, 1); sk = -(1 - k * (2 - k)) * 40; } boss(a, heading(a, 0), a.fl > 0 ? 1.2 : 0, sk); } else echoBoss(a); return; }
    if (a.gate) { const t = T(), r = a.r, fl = a.fl > 0; for (let i = 0; i < 3; i++) put(CYL, a.x, 14 + i * .2, a.y, r * (2.2 + i * .5), .6, r * (2.2 + i * .5), t * (i % 2 ? -1.3 : .9), Math.PI / 2, fl ? '#ffffff' : i % 2 ? '#7df9ff' : '#b070ff', 1.6, .55 - i * .12, true); put(SPH, a.x, 14, a.y, r * 1.8, r * 1.8, r * .4, 0, 0, '#05000a', 0); put(SPH, a.x, 14, a.y, r * 3.4, r * 3.4, r * 1, 0, 0, '#9a40ff', 1.4, .2, true); return; }
    if (a.ufo) { const t = T(), h = 18 + Math.sin(t * 3 + a.x) * 2, fl = a.fl > 0, c = fl ? '#ffffff' : '#a8b0c2'; put(SPH, a.x, h, a.y, 20, 5, 20, t * 2, 0, c, fl ? 2 : .1); put(SPH, a.x, h + 2.4, a.y, 9, 7, 9, 0, 0, '#7df9ff', 1); for (let k = 0; k < 8; k++) { const q = k / 8 * 6.283 + t * 2; put(SPH, a.x + Math.cos(q) * 8.5, h - .6, a.y + Math.sin(q) * 8.5, 2, 2, 2, 0, 0, (k + Math.floor(t * 6)) % 2 ? '#ff3a6a' : '#ffd23f', 2.2); } put(CYL, a.x, h - .5, a.y, 23, 1.2, 23, t * 2, 0, '#4a5266', .2); for (let k = 0; k < 6; k++) { const q = k / 6 * 6.283 - t * 3; put(BOX, a.x + Math.cos(q) * 11.5, h - .5, a.y + Math.sin(q) * 11.5, 2.2, 1.4, 1.2, -q, 0, '#2a3040', .2); } put(SPH, a.x, h - 2.2, a.y, 9, 2.4, 9, 0, 0, '#ff3a6a', 2.4); put(CONE, a.x, 0, a.y, 14, h - 2, 14, 0, 0, '#b070ff', 1.2, .16, 1); return; }
    const t = T(), fl = a.fl > 0 ? 1.2 : 0, x = a.x, y = a.y, z = a.r; let ang = heading(a, 0);
    let sink = a.rise > 0 ? -a.rise / .4 * z * 2.4 : 0;
    const ty = a.ty;
    if (ty === 'egg') { const w = a.hatch < 2 ? Math.sin(t * 40) * .15 : 0; put(SPH, x, 0, y, 9, 12, 9, 0, w, '#c9b0e8', fl + .1); put(SPH, x - 1.5, 6, y - 2, 3, 4, 3, 0, 0, '#e8dcf7', .3);
      for (let i = 0; i < 5; i++) put(SPHm, x + Math.cos(i * 1.3) * 4, 2 + i * 1.6, y + Math.sin(i * 1.3) * 4, 1.4, 1.4, 1.4, 0, 0, '#b05aff', .8 + .5 * Math.sin(t * 4 + i)); put(SPH, x, -.5, y, 13, 2, 13, 0, 0, '#5a3a7a', 0); return; }
    if (ty === 'tent') { const up = a.sl > 0 ? -5 : 0; for (let i = 0; i < 7; i++) { const o = Math.sin(t * 5 + i * .8) * i * .8; put(SPH, x + o, up + i * 3.6, y, Math.max(2.4, 8 - i), 4.6, Math.max(2.4, 8 - i), 0, 0, i % 2 ? '#7a4ab0' : '#9a6ad0', fl + .05); if (i % 2 === 0) put(SPHm, x + o + Math.max(1.2, 4 - i * .5), up + i * 3.6 + 2, y, 1, 1, 1, 0, 0, '#ffb0f0', .6); }
      put(SPHm, x + Math.sin(t * 5 + 5.6) * 5, up + 25, y, 2.6, 2.6, 2.6, 0, 0, '#ff6bd6', 1.2); return; }
    if (a.boss && S.cin && S.cin.k === 'boss') { const k = clamp(S.cin.t / (S.cin.dur * .45), 0, 1); sink -= (1 - k * (2 - k)) * (a.r * 2 + 12); }
    if (a.boss) return boss(a, ang, fl, sink);
    const c = ALC[ty] || ALC.grunt, c1 = a.rg ? '#ff2040' : c[0], c2 = c[1], hov = ty === 'fly' ? 7 + Math.sin(t * 6 + x) * 2 : 0, h0 = hov + sink, bob = Math.abs(Math.sin(a.an * Math.PI)) * 1.2;
    const S2 = z * 2.2, ca = Math.cos(ang), sa = Math.sin(ang), at = (f, q, h) => [x + ca * f - sa * q, y + sa * f + ca * q, h], ph = (a.an || 0) * Math.PI * 2 + t * 2;
    const P = (f, q, h, w, ht, d, col, e, ry) => { const p = at(f, q); put(SPH, p[0], h, p[1], w, ht, d, ry == null ? ang : ry, 0, col, (e || 0) + fl); };
    const Pm = (f, q, h, w, col, e) => { const p = at(f, q); put(SPHm, p[0], h, p[1], w, w, w, 0, 0, col, (e || 0) + fl); };
    const Kn = (f, q, h, w, ht, col, e, ry, rx) => { const p = at(f, q); put(CONE4, p[0], h, p[1], w, ht, w, ry == null ? ang : ry, rx || 0, col, (e || 0) + fl); };
    let eh = h0 + z * .5 + bob + S2 * .62, ef = z * .95, es = 2.2;
    if (ty === 'fly') { const fw = Math.sin(t * 30) * .7, bh = h0 + z * .3;
      P(-z * .6, 0, bh - 1, S2 * .8, S2 * .55, S2 * .55, c2); for (let i = 0; i < 3; i++) { const p = at(-z * (.25 + i * .35), 0); put(TUBE, p[0], bh - 1 + S2 * .275, p[1], S2 * (.5 - i * .06), .9, S2 * (.5 - i * .06), ang + Math.PI / 2, Math.PI / 2, '#ffcf4a', fl + .3); }
      P(z * .2, 0, bh, S2 * .75, S2 * .62, S2 * .62, c1); Kn(-z * 1.1, 0, bh - 1 + S2 * .2, 1.6, 4, '#f2e6d0', .2, ang + Math.PI / 2, Math.PI / 2 + .2);
      for (const q of [-1, 1]) { const p = at(0, q * z * .55); put(BOX, p[0], bh + S2 * .45, p[1], 3, .4, 11, ang, q * fw, '#bfe8ff', .5, .55, true); const p2 = at(-2, q * z * .5); put(BOX, p2[0], bh + S2 * .4, p2[1], 2.4, .4, 7, ang + q * .3, q * fw * .8, '#bfe8ff', .4, .45, true); }
      for (const q of [-1, 1]) for (let i = 0; i < 2; i++) { const p = at(z * (.2 - i * .4), q * z * .3); put(CYLm, p[0], bh - 3.5, p[1], .7, 3.6, .7, ang + q, .4 * q, c2, fl); }
      eh = bh + S2 * .45; ef = z * .75; es = 2.6;
    } else if (ty === 'brute') { const hip = h0 + z * .9, bh = h0 + z * .55;
      for (const q of [-1, 1]) for (const f of [-.45, .45]) { const p = at(f * z, q * z * .55); put(CYLm, p[0], h0, p[1], 3.6, hip - h0 + 1, 3.6, 0, 0, c2, fl); put(SPHm, p[0], h0, p[1], 4.2, 2, 4.6, 0, 0, '#2a1a30', fl); }
      P(0, 0, bh + bob, S2 * 1.1, S2 * .95, S2 * 1.05, c1); P(z * .45, 0, bh + S2 * .45 + bob, S2 * .62, S2 * .55, S2 * .6, c1);
      for (let i = 0; i < 3; i++) P(-z * .25 + i * z * .25, 0, bh + S2 * .78 + bob - Math.abs(i - 1) * 1.2, S2 * .38, S2 * .22, S2 * .7, c2);
      for (const q of [-1, 1]) { const sw = Math.sin(ph + (q > 0 ? 0 : Math.PI)) * .45, sh = at(z * .2, q * z * 1.05); put(CYLm, sh[0], bh + S2 * .7 + bob, sh[1], 3.2, S2 * .62, 3.2, ang + Math.PI / 2, Math.PI + sw, c1, fl);
        const hd = at(z * .2 + Math.sin(sw) * S2 * .62, q * z * 1.05); put(SPH, hd[0], bh + S2 * .7 + bob - Math.cos(sw) * S2 * .62 - 2.4, hd[1], 5, 4.4, 5, ang, 0, c2, fl);
        Kn(z * .55, q * z * .45, bh + S2 * .82 + bob, 2.4, 5.5, '#f2e6d0', .15, ang, q * -.5); P(0, q * z * .8, bh + S2 * .78 + bob, S2 * .35, S2 * .2, S2 * .35, '#3a1a4a'); }
      eh = bh + S2 * .62 + bob; ef = z * .95; es = 2.4;
    } else if (ty === 'bomber') { const fz = a.fuse != null, pf = fz ? 1.3 + .15 * Math.sin(t * 30) : 1 + .06 * Math.sin(t * 4);
      legs(x, y, h0 + z * .7, ang, z, [.8, -.8, 2.3, -2.3], c2, fl, ph, h0, 1.6);
      put(SPH, x, h0 + z * .3, y, S2 * 1.2 * pf, S2 * 1.1 * pf, S2 * 1.2 * pf, ang, 0, c1, fl + (fz ? 1.3 : .2));
      for (let i = 0; i < 6; i++) { const q = i * 1.05 + t * .5; put(SPHm, x + Math.cos(q) * S2 * .55 * pf, h0 + z * .3 + S2 * .55 * pf + Math.sin(i * 2) * 2, y + Math.sin(q) * S2 * .55 * pf, 2.2, 2.2, 2.2, 0, 0, '#ffe0f6', fz ? 2 : 1 + .5 * Math.sin(t * 6 + i)); }
      put(CYLm, x, h0 + z * .3 + S2 * 1.05 * pf, y, 1, 3, 1, 0, 0, '#3a2a30', fl); put(SPHm, x, h0 + z * .3 + S2 * 1.05 * pf + 3, y, 1.8, 1.8, 1.8, 0, 0, fz ? '#ffffff' : '#ffcf4a', fz ? 3 : 1.4);
      eh = h0 + z * .3 + S2 * .6 * pf; ef = z * 1.15 * pf;
    } else if (ty === 'charger') { const hip = h0 + z * .9;
      legs(x, y, hip, ang, z * 1.1, [.6, -.6, 2.5, -2.5], c2, fl, ph * 2, h0, 1.8);
      P(-z * .2, 0, h0 + z * .45 + bob, S2 * 1.45, S2 * .8, S2, c1, a.aim > 0 ? .8 : 0); P(z * .7, 0, h0 + z * .55 + bob, S2 * .7, S2 * .6, S2 * .75, c2);
      for (let i = 0; i < 4; i++) Kn(-z * .9 + i * z * .45, 0, h0 + z * .45 + S2 * .72 + bob, 2.4, 3.5, '#f2e6d0', .1, ang + Math.PI / 2, .35);
      Kn(z * 1.15, 0, h0 + z * 1.1, 3.6, 7.5, '#f2e6d0', .2, ang + Math.PI / 2, -1.2); Kn(z * .95, 0, h0 + z * 1.6, 2, 4, '#f2e6d0', .2, ang + Math.PI / 2, -.8);
      eh = h0 + z * .6 + bob + S2 * .4; ef = z * 1.05;
    } else { // grunt, spit and anything else: round body, jointed legs, antennae
      const bh = h0 + z * .5 + bob;
      legs(x, y, bh + z * .4, ang, z, [.75, -.75, 1.6, -1.6, 2.45, -2.45], c2, fl, ph, h0, 1.5);
      P(-z * .35, 0, bh - 1, S2 * .95, S2 * .82, S2 * .9, c2); P(z * .15, 0, bh, S2 * .9, S2 * .9, S2 * .9, c1); { const p = at(z * .3, 0); put(SPHm, p[0], bh + 1, p[1], S2 * .5, S2 * .45, S2 * .6, ang, 0, '#e8f0d0', fl); }
      const hb = bh + S2 * .55; P(z * .7, 0, hb - 1, S2 * .6, S2 * .52, S2 * .62, c1);
      for (const q of [-1, 1]) { Kn(z * 1.05, q * z * .25, hb - .5, 1.2, 3.6, '#f2e6d0', .1, ang + Math.PI / 2 + q * .3, -(Math.PI / 2 + .3)); const p = at(z * .55, q * z * .3); put(CYLm, p[0], hb + S2 * .4, p[1], .5, 5, .5, ang, q * .5, c2, fl); const p2 = at(z * .55, q * z * .3 + q * 2.4); put(SPHm, p2[0], hb + S2 * .4 + 4.5, p2[1], 1.4, 1.4, 1.4, 0, 0, '#fff36b', 1.2); }
      if (ty === 'spit') { P(-z * .7, 0, bh + S2 * .45, S2 * .7, S2 * .65, S2 * .7, '#e8ff7a', .9 + .4 * Math.sin(t * 5)); Pm(-z * .7, 0, bh + S2 * .9, 2.2, '#ffffff', 1.2); }
      eh = hb + S2 * .2; ef = z * .95;
    }
    for (const q of [-1, 1]) { const ex = x + ca * ef - sa * q * z * .4, ey = y + sa * ef + ca * q * z * .4; put(SPHm, ex, eh - es * .2, ey, es * 1.2, es * 1.2, es * 1.2, ang, 0, '#fff36b', 1.4); put(SPHm, ex + ca * es * .5, eh, ey + sa * es * .5, es * .5, es * .55, es * .5, ang, 0, '#1a0c06', 0); }
    if (a.elite) { for (let i = 0; i < 5; i++) put(CONE4, x + Math.cos(i * 1.26) * z * .5, eh + 3, y + Math.sin(i * 1.26) * z * .5, 2.5, 5, 2.5, 0, 0, '#ffcf4a', .8); put(SPH, x, h0 + z * .3 - 2, y, S2 * 1.4, S2 * 1.4, S2 * 1.4, 0, 0, '#b05aff', .9, .18, true); }
    if (ty === 'queen') for (let i = 0; i < 5; i++) put(CONE4, x + Math.cos(i * 1.26) * z * .6, eh + 3, y + Math.sin(i * 1.26) * z * .6, 3, 6, 3, 0, 0, '#ffcf4a', .6);
    if (a.stun > 0) stunStars(x, y, eh + 8);
  }
  function stunStars(x, y, h) { const t = T(); for (let i = 0; i < 3; i++) { const q = t * 5 + i * 2.1; box(x + Math.cos(q) * 7, y + Math.sin(q) * 7, h, 2, 2, 2, '#7df9ff', 1.5); } }
  // ---------- v37: skinned, animated boss models in HD (CC-BY-4.0 models, credited in the game's Sources list) ----------
  // one generic player: clip state machine (idle / walk / attack / roar / hurt / stagger / dash / channel), 0.22 s blends,
  // attack clips time-stretched so the impact frame lands when the telegraphed hazard fires, plus per-boss effects.
  const SKM = {};
  function skM(k) {
    if (k in SKM) return SKM[k]; const R = window.RDO_BOSS && window.RDO_BOSS[k]; if (!R) return (SKM[k] = null);
    try {
      const dec = (b, Ty) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Ty(u.buffer); };
      const clips = {}; for (const c in R.clips) { const q = R.clips[c], m = dec(q.m, Int16Array), mf = new Float32Array(m.length); for (let i = 0; i < m.length; i++) mf[i] = (i & 3) === 3 ? m[i] / 8000 : m[i] / 16000; clips[c] = { n: q.n, loop: q.loop, m: mf, h: dec(q.h, Float32Array) }; }
      return (SKM[k] = { nv: R.nv, nf: R.nf, nb: R.nb, na: R.na, fps: R.fps, P: dec(R.p, Float32Array), N: dec(R.n, Int8Array), C: dec(R.c, Uint8Array), F: R.nv < 65536 ? dec(R.f, Uint16Array) : dec(R.f, Uint32Array), J: dec(R.j, Uint8Array), W: dec(R.w, Uint8Array), clips, lo: R.bbox[0], hi: R.bbox[1],
        BM: new Float32Array(R.nb * 12), BT: new Float32Array(R.nb * 12), SP: new Float32Array(R.nv * 3), SN: new Float32Array(R.nv * 3) });
    } catch (e) { console.warn('boss model ' + k, e); return (SKM[k] = null); }
  }
  // which model each boss uses, its height in world units, and the clip for each attack index (see ATK in the game)
  const SKC = {
    golem: { m: 'golem', h: 52, atk: ['slam', 'smash', 'blast', 'throw', 'stomp', 'leap'], fx: 'crystal', c: '#7df9ff', c2: '#ffffff' },
    scorch: { m: 'cherub', h: 48, atk: ['dashprep', 'blast', 'slam', 'summon', 'spin', 'nova'], dash: [0], fx: 'fire', c: '#ffb040', c2: '#ff3a1a' },
    kraken: { m: 'kraken', h: 42, atk: ['smash', 'ring', 'beam', 'spit', 'quake', 'swirl'], still: 1, fx: 'ice', c: '#9fe8ff', c2: '#e8f8ff' },
    colossus: { m: 'colossus', h: 66, atk: ['throw', 'pull', 'slam', 'stomp', 'summon', 'pull'], fx: 'grav', c: '#b070ff', c2: '#ff8a3d' },
    queen: { m: 'blight', h: 48, atk: ['spray', 'leap', 'egg', 'burrow', 'vomit', 'sweep'], fx: 'blight', c: '#ff5a1a', c2: '#ffcf4a' },
    hivemind: { m: 'queen', h: 74, atk: ['tail', 'summon', 'slam', 'tailslam', 'summon', 'tail'], fx: 'acid', c: '#c070ff', c2: '#ff2a80', tint: [.85, .78, 1.2] },
    echo: { m: 'queen', h: 94, atk: ['tailslam', 'summon', 'spit', 'spit', 'tail', 'slam'], dash: [], fx: 'acid', c: '#ff2a80', c2: '#b070ff', tint: [.8, .7, 1.15], echo: 1 } };
  const IMPACT = { slam: 1, smash: 1, stomp: 1, leap: 1, tailslam: 1, quake: 1, ring: 1, burrow: 1, nova: 1 };
  function skCfg(a) { if (!REAL) return null; const C = SKC[a.echo ? 'echo' : (a.ty === 'colossus' && S.lv === 6) ? 'hivemind' : a.ty]; return C && skM(C.m) ? C : null; }
  function skSample(M, clip, tt, out) {
    const c = M.clips[clip], n = c.n, nb = M.nb, na = M.na; let f = tt * M.fps, i0, i1, u;
    if (c.loop) { f = ((f % n) + n) % n; i0 = Math.floor(f); i1 = (i0 + 1) % n; u = f - i0; } else { f = Math.min(n - 1, Math.max(0, f)); i0 = Math.floor(f); i1 = Math.min(n - 1, i0 + 1); u = f - i0; }
    const A = c.m, o0 = i0 * nb * 12, o1 = i1 * nb * 12; for (let i = 0; i < nb * 12; i++) out[i] = A[o0 + i] * (1 - u) + A[o1 + i] * u;
    const H = c.h, r = new Array(na * 3); for (let k = 0; k < na * 3; k++) r[k] = H[i0 * na * 3 + k] * (1 - u) + H[i1 * na * 3 + k] * u; return r;
  }
  const SKS = new WeakMap(), skh = i => { const s = Math.sin(i * 127.1 + 31.7) * 43758.5; return s - Math.floor(s); };
  function skBoss(a, C, ang, fl, t, x, y) {
    const M = skM(C.m), SC = C.h * (a.echo ? 1 : 1), cw = S.cin && S.cin.k === 'boss', has = c => !!M.clips[c];
    let st = SKS.get(a);
    if (!st) { st = { clip: 'idle', t0: t, sp: 1, once: 0, pclip: null, pt0: t, psp: 1, ft0: -9, lc: 0, atk: '', atT: -9, atD: 1, px: x, py: y, spd: 0, ang: null, eT: a.eT, imp: 0 }; SKS.set(a, st); }
    const play = (c, sp, once) => { if (!has(c)) c = 'idle'; if (st.clip === c && !once) { st.sp = sp; return; } st.pclip = st.clip; st.pt0 = st.t0; st.psp = st.sp; st.ft0 = t; st.clip = c; st.t0 = t; st.sp = sp; st.once = once; };
    const dur = c => (M.clips[c].n - (M.clips[c].loop ? 0 : 1)) / M.fps, done = () => st.once && (t - st.t0) * st.sp >= dur(st.clip);
    if (!st.intro) { st.intro = 1; play('roar', 1.1, 1); }
    // facing: smooth turn toward the target (fast along a dash, slow while winding up)
    { const T2 = typeof tgtP === 'function' ? tgtP(a) : S.p; let ta = Math.atan2(T2.y - y, T2.x - x); if (a.dsh > 0 && a.dvx != null) ta = Math.atan2(a.dvy, a.dvx);
      if (st.ang == null) st.ang = ta; let d = ta - st.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; st.ang += d * Math.min(1, FDT * (a.dsh > 0 ? 12 : (a.cast > 0 ? 2 : 4))); ang = st.ang; }
    { const v = Math.min(400, Math.hypot(x - st.px, y - st.py) / Math.max(FDT, .001)); st.spd += (v - st.spd) * Math.min(1, FDT * 5); st.px = x; st.py = y; }
    // state machine
    const stg = a.stun > 0 || a.stg > 0;
    if (a.roarT && a.roarT !== st.roarT) { st.roarT = a.roarT; play('roar', 1.2, 1); st.atk = 'roar'; st.atT = t; st.atD = dur('roar') / 1.2; }
    else if (stg) { if (st.clip !== 'stagger' && st.clip !== 'hurt') play('hurt', 1, 1); else if (st.clip === 'hurt' && done()) play('stagger', 1, 0); }
    else if (a.pull > 0 && has('pull')) { if (st.clip !== 'pull') { play('pull', 1.1, 0); st.atk = 'pull'; st.atT = t; st.atD = 3; } }
    else if (a.dsh > 0 && has('charge')) { if (st.clip !== 'charge') play('charge', 1.3, 0); }
    else if ((a.cast || 0) > st.lc + .05) {
      let c = C.atk[a.la] || C.atk[0]; if ((C.dash && C.dash.indexOf(a.la) >= 0) || (a.chn > 0 && has('dashprep'))) c = 'dashprep';
      if (!has(c)) c = has('slam') ? 'slam' : 'idle'; const D = Math.max(.75, (a.cast || 1) * 1.12);
      play(c, dur(c) / D, 1); st.atk = c; st.atT = t; st.atD = D; st.imp = 0;
    }
    else if (a.echo && a.eT != null && st.eT != null && a.eT > st.eT + .5) { const L = S.hz[S.hz.length - 1], c = L && L.k === 'beam' ? 'spit' : 'tailslam', D = 1.25; play(c, dur(c) / D, 1); st.atk = c; st.atT = t; st.atD = D; st.imp = 0; }
    st.lc = a.cast || 0; st.eT = a.eT; st.chn = a.chn;
    const loco = (st.clip === 'stagger' && !stg) || (st.clip === 'pull' && !(a.pull > 0)) || (st.clip === 'charge' && !(a.dsh > 0)) || (st.once && done() && !stg) || st.clip === 'idle' || st.clip === 'walk';
    if (loco && !(st.once && !done())) { if (st.spd > 7 && has('walk') && !C.still && !cw) play('walk', clamp(st.spd / (SC * .5), .55, 2.2), 0); else play('idle', a.rg ? 1.5 : 1, 0); }
    // pose with a short blend from the previous clip
    let hd = skSample(M, st.clip, (t - st.t0) * st.sp, M.BM); const fk = clamp((t - st.ft0) / .22, 0, 1);
    if (fk < 1 && st.pclip && has(st.pclip)) { const h2 = skSample(M, st.pclip, (t - st.pt0) * st.psp, M.BT), e = fk * fk * (3 - 2 * fk); for (let i = 0; i < M.BM.length; i++) M.BM[i] = M.BT[i] * (1 - e) + M.BM[i] * e; hd = hd.map((v, i) => h2[i] * (1 - e) + v * e); }
    const gy = TER ? THc(x, y) : 0, base = gy;
    const B = M.BM, P = M.P, Nn = M.N, Jn = M.J, Wt = M.W, SP = M.SP, SN = M.SN;
    for (let v = 0; v < M.nv; v++) {
      const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], nx = Nn[v * 3] / 127, ny = Nn[v * 3 + 1] / 127, nz = Nn[v * 3 + 2] / 127;
      let X = 0, Y = 0, Z = 0, A = 0, Bn = 0, Cn = 0;
      for (let k = 0; k < 4; k++) { const w = Wt[v * 4 + k]; if (!w) continue; const ww = w / 255, o = Jn[v * 4 + k] * 12;
        X += (B[o] * px + B[o + 1] * py + B[o + 2] * pz + B[o + 3]) * ww; Y += (B[o + 4] * px + B[o + 5] * py + B[o + 6] * pz + B[o + 7]) * ww; Z += (B[o + 8] * px + B[o + 9] * py + B[o + 10] * pz + B[o + 11]) * ww;
        A += (B[o] * nx + B[o + 1] * ny + B[o + 2] * nz) * ww; Bn += (B[o + 4] * nx + B[o + 5] * ny + B[o + 6] * nz) * ww; Cn += (B[o + 8] * nx + B[o + 9] * ny + B[o + 10] * nz) * ww; }
      const l = Math.hypot(A, Bn, Cn) || 1; SP[v * 3] = X; SP[v * 3 + 1] = Y; SP[v * 3 + 2] = Z; SN[v * 3] = A / l; SN[v * 3 + 1] = Bn / l; SN[v * 3 + 2] = Cn / l;
    }
    const need = (n + M.nf * 3) * FL; if (need > buf.length) { const nb = new Float32Array(Math.max(need, buf.length * 2)); nb.set(buf); buf = nb; }
    const cr = Math.cos(ang), sr = Math.sin(ang), rg = a.ph2 || a.rg || a.ph >= 3, Cc = M.C, Fi = M.F, flick = stg ? .25 + .2 * Math.sin(t * 20) : 0;
    const e = Math.min(fl, 1) * .3 + flick + (a.inv > 0 ? .35 : 0) + (a.rec > 0 ? .12 : 0), tn = C.tint || [1, 1, 1], tr = (rg ? 1.22 : a.ph >= 2 ? 1.08 : 1) * tn[0], tg_ = (rg ? .82 : 1) * tn[1], tb = (rg ? .8 : 1) * tn[2];
    for (let f = 0; f < M.nf * 3; f++) {
      const v = Fi[f], o = n * FL, px = SP[v * 3], py = SP[v * 3 + 1], pz = SP[v * 3 + 2], nx = SN[v * 3], nz = SN[v * 3 + 2];
      buf[o] = x + (px * cr - pz * sr) * SC; buf[o + 1] = base + py * SC; buf[o + 2] = y + (px * sr + pz * cr) * SC;
      buf[o + 3] = nx * cr - nz * sr; buf[o + 4] = SN[v * 3 + 1]; buf[o + 5] = nx * sr + nz * cr;
      buf[o + 6] = Cc[v * 3] / 255 * tr; buf[o + 7] = Cc[v * 3 + 1] / 255 * tg_; buf[o + 8] = Cc[v * 3 + 2] / 255 * tb; buf[o + 9] = 1; buf[o + 10] = e; n++;
    }
    const AN = []; for (let i = 0; i < M.na; i++) { const p = [hd[i * 3], hd[i * 3 + 1], hd[i * 3 + 2]]; AN.push([x + (p[0] * cr - p[2] * sr) * SC, base + p[1] * SC, y + (p[0] * sr + p[2] * cr) * SC]); }
    NOLIFT = true; try { skFx(a, C, M, st, AN, ang, t, x, y, gy, SC, stg, rg, cw); } finally { NOLIFT = false; }
  }
  // ---------- effects ----------
  function skFx(a, C, M, st, AN, ang, t, x, y, gy, SC, stg, rg, cw) {
    const ca = Math.cos(ang), sa = Math.sin(ang), pul = .5 + .5 * Math.sin(t * 7), col = rg ? '#ff3a2a' : C.c, p = (t - st.atT) / st.atD, at = st.atk, G = gOf() * 9;
    const head = AN[0], core = AN[1], hL = AN[2], hR = AN[3], R0 = SC * .55, T2 = typeof tgtP === 'function' ? tgtP(a) : S.p;
    const glow = (q, r, c, al) => put(SPHm, q[0], q[1] - r / 2, q[2], r, r, r, 0, 0, c, 2.4, al, al != null);
    // ground contact: dark footprint and a soft phase-colored ring
    put(CYL, x, gy + .12, y, R0 * 2.1, .2, R0 * 2.1, 0, 0, '#000000', 0, .28, true);
    put(TUBE, x, gy + .3, y, R0 * 2.6 * (1 + pul * .05), 1, R0 * 2.6 * (1 + pul * .05), t * .3, 0, col, 1.8, .16 + .12 * pul, true);
    // immune: golden shield bubble; weak point open: glowing core and spinning spikes; staggered: stars
    if (a.inv > 0) { put(SPHm, x, gy - SC * .05, y, R0 * 2.3, SC * 1.15, R0 * 2.3, t, 0, '#ffcf4a', 2.2, .1 + .08 * pul, true); for (let i = 0; i < 8; i++) { const q = t * 2 + i * .785; put(CONE4, x + Math.cos(q) * R0 * 1.15, gy + SC * (.3 + .5 * skh(i)), y + Math.sin(q) * R0 * 1.15, 1.2, 3, 1.2, q, 0, '#ffe680', 2.4); } }
    if (a.rec > 0 || stg) { const wr = 4 + pul * 3; glow(core, wr, '#fff3b0'); glow(core, wr * 2.6, '#ffb040', .3); for (let i = 0; i < 6; i++) { const q = t * 4 + i * 1.047; put(CONE, core[0] + Math.cos(q) * wr * 2, core[1] - 2, core[2] + Math.sin(q) * wr * 2, 1.3, 4, 1.3, q, Math.PI, '#ffd23f', 2.4); } }
    if (stg) for (let i = 0; i < 5; i++) { const q = t * 5 + i * 1.257; put(SPHm, head[0] + Math.cos(q) * 7, head[1] + 6 + Math.sin(q * 2) * 1.5, head[2] + Math.sin(q) * 7, 2, 2, 2, 0, 0, '#fff36b', 2.5); }
    // phase 3 / enraged: embers rising
    if (rg) for (let i = 0; i < 14; i++) { const k = (t * .45 + i * .071) % 1, q = i * 2.4 + t * .5, d = R0 * (.3 + .9 * skh(i)); put(BOX, x + Math.cos(q) * d, gy + k * SC * 1.3, y + Math.sin(q) * d, 1.2, 1.2, 1.2, q * 3, k * 6, i % 2 ? '#ff3a1a' : '#ffb040', 2.2 * (1 - k) + .3, 1 - k, true); }
    // walking: dust puffs
    if (st.clip === 'walk') for (let i = 0; i < 4; i++) { const k = (t * 1.6 + i * .25) % 1; put(SPHm, x - ca * R0 * (.2 + k) + Math.sin(i * 3) * R0 * .5, gy + k * 6, y - sa * R0 * (.2 + k) + Math.cos(i * 3) * R0 * .5, 5 + k * 10, 4 + k * 6, 5 + k * 10, 0, 0, S.L.bg[2], .15, .35 * (1 - k), true); }
    // impact: shockwave, flying debris on real gravity arcs, dust; one camera shake per hit
    if (IMPACT[at] && p > .8 && p < 1.9 && !cw) {
      const k = (p - .8) * st.atD, fx = at === 'slam' || at === 'smash' ? [(hL[0] + hR[0]) / 2, (hL[2] + hR[2]) / 2] : [x + ca * R0 * .3, y + sa * R0 * .3];
      if (!st.imp) { st.imp = 1; S.shk = Math.max(S.shk || 0, at === 'leap' || at === 'quake' || at === 'nova' ? 12 : 8); }
      const rr = 14 + k * 190; put(TUBE, fx[0], gy + .6, fx[1], rr, 1.6, rr, 0, 0, C.fx === 'fire' || C.fx === 'blight' ? '#ffb070' : C.fx === 'ice' ? '#e8f8ff' : '#ffe0b0', 2.4, Math.max(0, .85 - k * .8), true);
      put(TUBE, fx[0], gy + .4, fx[1], rr * .6, 1, rr * .6, 0, 0, col, 2.2, Math.max(0, .6 - k * .7), true);
      for (let i = 0; i < 14; i++) { const q = i * .449 + skh(i) * .5, v = 40 + skh(i + 9) * 50, vz = 40 + skh(i + 3) * 50, hh = vz * k - .5 * G * k * k; if (hh <= 0 && k > .2) continue; const d = v * k, sz = 1.8 + (i % 4) * 1.1;
        put(C.fx === 'crystal' && i % 2 ? CONE4 : ROCKS[i % 4], fx[0] + Math.cos(q) * d, gy + Math.max(0, hh), fx[1] + Math.sin(q) * d, sz, sz * (C.fx === 'crystal' && i % 2 ? 2 : .8), sz, k * 4 + i, k * 3, C.fx === 'crystal' && i % 2 ? C.c : C.fx === 'ice' ? '#e8f8ff' : S.L.bg[3], C.fx === 'crystal' && i % 2 ? 1.8 : 0); }
      const kk = clamp(k / 1.2, 0, 1); for (let i = 0; i < 5; i++) { const r = 10 + i * 5 + kk * 26; put(SPHm, fx[0] + Math.sin(i * 2) * 12, gy + i * 4 * (1 + kk), fx[1] + Math.cos(i * 2) * 12, r * .7, r * .5, r * .7, 0, 0, C.fx === 'ice' ? '#dff4ff' : S.L.bg[2], .15, .32 * (1 - kk), true); }
    }
    // roar: sound rings from the head
    if (at === 'roar' && p < 1) for (let i = 0; i < 3; i++) { const k = ((p * 2.2) + i * .33) % 1; put(TUBE, head[0] + ca * 4, head[1], head[2] + sa * 4, 8 + k * 70, 1, 8 + k * 70, ang - Math.PI / 2, Math.PI / 2, rg ? '#ff6a5a' : '#ffe8c0', 2, .5 * (1 - k), true); }
    const stream = (from, dir, len, nP, c1, c2, w, spread) => { for (let i = 0; i < nP; i++) { const k = (t * 2.6 + i / nP) % 1, j = (skh(i) - .5) * spread * k, d = k * len, qx = Math.cos(dir + j), qz = Math.sin(dir + j);
      put(SPHm, from[0] + qx * d, from[1] - k * from[1] * .55 + Math.sin(i * 5 + t * 9) * 2 - w * (1 + k) / 2, from[2] + qz * d, w * (1 + k * 1.5), w * (1 + k * 1.5), w * (1 + k * 1.5), 0, 0, k < .35 ? c1 : c2, 2.4 - k, .85 * (1 - k * .8), true); } };
    const charge = (q, k, c) => { const r = 2 + k * 9; glow(q, r, '#ffffff'); glow(q, r * 2.2, c, .35); for (let i = 0; i < 8; i++) { const qq = i * .785 + t * 3, d = (1 - ((t * 2 + i / 8) % 1)) * 24; put(SPHm, q[0] + Math.cos(qq) * d, q[1] + Math.sin(qq * 1.3) * d * .5, q[2] + Math.sin(qq) * d, 1.4, 1.4, 1.4, 0, 0, c, 2.4); } };
    switch (C.fx) {
      case 'crystal': { // moon golem: glowing crystal heart, crystal shards, a boulder it rips up and throws
        const wind = (a.cast || 0) > 0 && p < .82; glow(core, 5 + pul * 2 + (wind ? 3 : 0), wind ? '#ffffff' : C.c); glow(core, 14, C.c, .22 + (wind ? .2 : 0));
        for (const h of [hL, hR]) for (let i = 0; i < 3; i++) { const q = t * 2 + i * 2.1; put(CONE4, h[0] + Math.cos(q) * 5, h[1] + 3 + i * 2, h[2] + Math.sin(q) * 5, 1.4, 4.5, 1.4, q, .3, C.c, 1.6 + (wind ? 1 : 0)); }
        if (at === 'blast' && p > .3 && p < .82) charge(core, (p - .3) / .52, C.c);
        if (at === 'blast' && p > .8 && p < 1.3) { const k = (p - .8) / .5; for (let i = 0; i < 16; i++) { const q = ang + (skh(i) - .5) * 1.4, d = 10 + k * 160 * (.6 + .4 * skh(i + 5)); put(CONE4, core[0] + Math.cos(q) * d, core[1] - k * 20 * skh(i + 2), core[2] + Math.sin(q) * d, 1.6, 5, 1.6, q - Math.PI / 2, Math.PI / 2, C.c, 2.2, 1 - k * .6, true); } }
        if (at === 'throw') { const k = clamp((p - .8) / .35, 0, 1), from = p < .8 ? hR : [hR[0] + (T2.x - hR[0]) * k, hR[1] * (1 - k) + Math.sin(k * Math.PI) * 60 + gy * k, hR[2] + (T2.y - hR[2]) * k]; if (p < 1.15) put(ROCKS[1], from[0], from[1] - 6, from[2], 12, 10, 12, t * 3, t * 2, S.L.bg[3], .1); }
        if (at === 'leap' && p > .25 && p < .8) for (let i = 0; i < 6; i++) { const k = (t * 3 + i / 6) % 1; put(SPHm, x + Math.sin(i * 3) * 8, gy + k * 10, y + Math.cos(i * 2) * 8, 6 + k * 8, 6, 6 + k * 8, 0, 0, S.L.bg[2], .2, .4 * (1 - k), true); }
        break; }
      case 'fire': { // mercury cherub: burning claws, sun-ball chest, supernova
        for (const h of [hL, hR]) for (let i = 0; i < 5; i++) { const k = (t * 1.8 + i / 5) % 1; put(SPHm, h[0] + Math.sin(i * 7 + t * 5) * 2, h[1] + k * 12 - 3, h[2] + Math.cos(i * 5 + t * 4) * 2, 3.5 * (1 - k) + .5, 4 * (1 - k) + .5, 3.5 * (1 - k) + .5, 0, 0, k < .4 ? '#ffe066' : '#ff5a1a', 2.4, .9 - k * .7, true); }
        glow(head, 3 + pul, '#ffe066'); glow(core, 4 + pul * 2, '#ffb040', .5);
        if (at === 'blast' && p > .25 && p < .82) charge(core, (p - .25) / .57, '#ffcf4a');
        if (at === 'blast' && p >= .82 && p < 1.5) stream(core, ang, 300, 26, '#ffffff', '#ffcf4a', 6, .15);
        if (at === 'nova' && p > .3 && p < .86) { const k = (p - .3) / .56; glow(core, 6 + k * 16, '#ffffff'); glow(core, 14 + k * 30, '#ffb040', .25 + k * .2); }
        if (at === 'nova' && p >= .86 && p < 1.6) { const k = (p - .86) / .74; put(SPHm, x, gy - k * 40, y, 40 + k * 320, 40 + k * 160, 40 + k * 320, 0, 0, k < .3 ? '#ffffff' : '#ff7a2a', 2.6, .55 * (1 - k), true); }
        if (at === 'spin' && p < 1.1) { put(TUBE, x, core[1] - 4, y, R0 * 2.4, 2, R0 * 2.4, -t * 9, 0, '#ffb040', 2.4, .5, true); put(TUBE, x, core[1] - 10, y, R0 * 3, 1.5, R0 * 3, t * 7, 0, '#ff3a1a', 2.2, .35, true); }
        if (at === 'summon' && p > .55 && p < 1.3) for (let i = 0; i < 10; i++) { const k = (t * 1.5 + i / 10) % 1; put(SPHm, x + Math.cos(i * 2.4) * 30 * k, core[1] + 10 + k * 80, y + Math.sin(i * 2.4) * 30 * k, 4, 4, 4, 0, 0, '#ffcf4a', 2.4, 1 - k, true); }
        if (st.clip === 'charge' || st.clip === 'dashprep') for (let i = 0; i < 12; i++) { const k = (t * 3 + i / 12) % 1; put(SPHm, x - ca * (10 + k * 50) + Math.sin(i * 5) * 8, gy + 6 + skh(i) * SC * .6 + k * 6, y - sa * (10 + k * 50) + Math.cos(i * 4) * 8, 6 * (1 - k) + 1, 6 * (1 - k) + 1, 6 * (1 - k) + 1, 0, 0, k < .3 ? '#ffe066' : '#ff3a1a', 2.4, .8 * (1 - k), true); }
        break; }
      case 'ice': { // europa kraken: frost mist, ice crystals, freezing beam from its eye
        for (let i = 0; i < 8; i++) { const k = (t * .25 + i / 8) % 1, q = i * .785 + t * .2; put(SPHm, x + Math.cos(q) * R0 * (1 + k * .6), gy + 1 + k * 8, y + Math.sin(q) * R0 * (1 + k * .6), 16 + k * 12, 5 + k * 4, 16 + k * 12, 0, 0, '#e8f8ff', .3, .22 * (1 - k), true); }
        for (let i = 0; i < 9; i++) { const q = i * .7; put(CONE4, x + Math.cos(q) * R0 * 1.25, gy - 1, y + Math.sin(q) * R0 * 1.05, 5, 8 + (i % 3) * 4, 5, q, 0, '#e8f6ff', .5); }
        glow(head, 3 + pul * 1.5, rg ? '#ff4060' : '#ffe066');
        if ((at === 'beam') && p > .3 && p < .82) charge(head, (p - .3) / .52, '#9fe8ff');
        if (at === 'beam' && p >= .82 && p < 1.6) stream(head, ang, 380, 30, '#ffffff', '#9fe8ff', 6, .1);
        if (at === 'spit' && p > .4 && p < .82) glow(head, 4 + (p - .4) * 20, '#e8f8ff');
        if (at === 'swirl' && p < 1.1) for (let i = 0; i < 3; i++) put(TUBE, x, gy + 3 + i * 4, y, R0 * (2.2 + i * .5), 1.2, R0 * (2.2 + i * .5), t * (4 + i), 0, '#bfe8ff', 2, .35, true);
        break; }
      case 'grav': { // ceres colossus: gravity well while it pulls, purple energy in its fists, meteors it calls down
        for (const h of [hL, hR]) { glow(h, 3 + pul * 1.5, '#d8b0ff'); glow(h, 9, C.c, .25); }
        glow(head, 2.5, '#ff8a3d');
        if (st.clip === 'pull' || (at === 'pull' && a.pull > 0)) { for (let i = 0; i < 5; i++) { const k = 1 - ((t * .7 + i / 5) % 1), r = 20 + k * 200; put(TUBE, x, gy + .8 + i * .2, y, r, 1.4, r, t * (2 + i * .3), 0, i % 2 ? '#b070ff' : '#6a3aff', 2.2, .45 * (1 - k * .6), true); }
          for (let i = 0; i < 18; i++) { const k = 1 - ((t * .55 + i / 18) % 1), q = i * 2.4 + t * 2.2 * (1 - k), d = 30 + k * 190; put(ROCKS[i % 4], x + Math.cos(q) * d, gy + 4 + skh(i) * 20 * k, y + Math.sin(q) * d, 2.4, 2, 2.4, t * 3 + i, t, S.L.bg[3], 0); }
          put(SPHm, x + ca * R0 * .4, core[1] - 8, y + sa * R0 * .4, 16 + pul * 4, 16 + pul * 4, 16 + pul * 4, 0, 0, '#140428', 0); put(SPHm, x + ca * R0 * .4, core[1] - 14, y + sa * R0 * .4, 28, 28, 28, t, 0, '#b070ff', 2.2, .25, true); }
        if (at === 'summon' && p > .5 && p < 1.4) { for (const h of [hL, hR]) put(CYL, h[0], h[1], h[2], 3 + pul, 160, 3 + pul, 0, 0, '#d8b0ff', 2.4, .35, true); for (let i = 0; i < 8; i++) { const q = i * .785 + t; glow([x + Math.cos(q) * 70, gy + 150 + Math.sin(t * 3 + i) * 10, y + Math.sin(q) * 70], 8, '#ff8a3d', .7); } }
        if (at === 'throw') { const k = clamp((p - .8) / .35, 0, 1), from = p < .8 ? hR : [hR[0] + (T2.x - hR[0]) * k, hR[1] * (1 - k) + Math.sin(k * Math.PI) * 70 + gy * k, hR[2] + (T2.y - hR[2]) * k]; if (p < 1.15) { put(ROCKS[2], from[0], from[1] - 7, from[2], 14, 12, 14, t * 3, t * 2, '#4a3a3a', .1); glow(from, 6, '#ff8a3d', .5); } }
        break; }
      case 'acid': { // titan hive queen: acid drool, spray from the inner jaw, glowing tail stinger
        const tip = AN[4] || core; glow(tip, 2.5 + pul, C.c);
        for (let i = 0; i < 4; i++) { const k = (t * 1.3 + i * .25) % 1; put(SPHm, head[0] + Math.sin(i * 7) * 1.5, head[1] - k * (head[1] - gy), head[2] + Math.cos(i * 5) * 1.5, 1.4, 2, 1.4, 0, 0, C.tint ? C.c2 : C.c, 2, .8 * (1 - k), true); }
        if (at === 'spit' && p >= .8 && p < 1.4) stream(head, ang, C.echo ? 360 : 150, 24, C.echo ? '#ffffff' : '#e8ff9a', C.echo ? C.c : '#5fe08a', C.echo ? 7 : 4, C.echo ? .15 : 1.2);
        if (C.tint) { glow([head[0] + ca * 3, head[1] + 3, head[2] + sa * 3], (a.e2 || a.ph >= 2) ? 5 + pul * 2 : 3, a.e3 || rg ? '#ff1040' : C.c); put(TUBE, x, gy + .4, y, R0 * 3.2, 1.2, R0 * 3.2, -t * .3, 0, C.c2, 1.8 + pul * .6, .25, true);
          for (let i = 0; i < 16; i++) { const k = (t * .35 + i * .0625) % 1, q = i * 2.4 + t * .4, d = R0 * (.3 + 1.2 * skh(i)); put(SPHm, x + Math.cos(q) * d, gy + k * SC * 1.2, y + Math.sin(q) * d, 1.6, 1.6, 1.6, 0, 0, i % 2 ? C.c : C.c2, 2.2 * (1 - k) + .3, 1 - k, true); } }
        if (at === 'summon' && p > .5 && p < 1.2) for (let i = 0; i < 3; i++) { const k = ((p - .5) * 1.6 + i / 3) % 1; put(TUBE, head[0], head[1], head[2], 10 + k * 90, 1.2, 10 + k * 90, ang - Math.PI / 2, Math.PI / 2, C.c, 2, .45 * (1 - k), true); }
        if ((at === 'tail' || at === 'tailslam') && p > .6 && p < 1.1) for (let i = 0; i < 6; i++) { const k = i / 6; glow([tip[0] - ca * k * 14, tip[1], tip[2] - sa * k * 14], 3 - k * 2, C.c, .6 - k * .5); }
        if (st.clip === 'charge' || st.clip === 'dashprep') for (let i = 0; i < 8; i++) { const k = (t * 3 + i / 8) % 1; put(SPHm, x - ca * (10 + k * 40), gy + 2, y - sa * (10 + k * 40), 6, 2, 6, 0, 0, '#5fe08a', 1.6, .5 * (1 - k), true); }
        break; }
      case 'blight': { // the final boss: a fireborne blight queen. heat haze, embers, a burning maw, fire breath, vomit
        const mouth = AN[0], eye = AN[3] || head, eyeOn = a.e2, rage = a.e3;
        glow(mouth, 3 + pul * 2, '#ffcf4a'); glow(mouth, 10, '#ff5a1a', .3);
        glow([eye[0] + ca * 6, eye[1] + 4, eye[2] + sa * 6], eyeOn ? 6 + pul * 2 : 3, rage ? '#ff1040' : eyeOn ? '#ff2a50' : '#ffb040'); if (eyeOn) glow([eye[0] + ca * 6, eye[1] + 4, eye[2] + sa * 6], 16, '#ff1040', .25);
        for (let i = 0; i < 22; i++) { const k = (t * .4 + i * .045) % 1, q = i * 2.4 + t * .3, d = R0 * (.4 + 1.1 * skh(i)); put(BOX, x + Math.cos(q) * d, gy + k * SC * 1.4, y + Math.sin(q) * d, 1.3, 1.3, 1.3, q * 3, k * 6, i % 3 ? '#ff7a2a' : '#ffcf4a', 2.4 * (1 - k) + .3, 1 - k, true); }
        put(TUBE, x, gy + .5, y, R0 * 3, 1.2, R0 * 3, t * .2, 0, rage ? '#ff1040' : '#ff5a1a', 1.6 + .6 * pul, .3, true);
        if ((at === 'spray' || at === 'sweep') && p > .2 && p < 1.05) { const sw = at === 'sweep' ? Math.sin((p - .2) * 7) * .6 : 0; stream(mouth, ang + sw, 260, 34, '#fff3b0', '#ff5a1a', 7, .4); }
        if (at === 'vomit' && p > .5 && p < 1.2) for (let i = 0; i < 6; i++) { const k = ((p - .5) * 1.4 + i / 6) % 1, tx = T2.x + Math.sin(i * 3) * 40, tz = T2.y + Math.cos(i * 5) * 30; put(SPHm, mouth[0] + (tx - mouth[0]) * k, mouth[1] * (1 - k) + Math.sin(k * Math.PI) * 50 + gy * k - 4, mouth[2] + (tz - mouth[2]) * k, 7, 7, 7, 0, 0, '#ffb040', 2.6); }
        if (at === 'egg' && p < 1) glow(core, 8 + pul * 4, '#ff7a2a', .5);
        break; }
    }
    if (stg) stunStars(x, y, SC * .95);
  }
  // dodge roll: spin the just-drawn player model once around the axis across the roll direction, plus cyan afterimages
  function skRoll(sv) {
    if (S.ghost) for (const g of S.ghost) { const al = g.l / .22; put(SPHm, g.x, 2 + (S.jz || 0), g.y, 7, 12, 7, 0, 0, '#7df9ff', 1.6, .35 * al, true); }
    const d = S.dg; if (!d || !(d.t > 0)) return;
    const k = 1 - d.t / d.t0, an = (k * k * (3 - 2 * k)) * Math.PI * 2, c = Math.cos(an), s = Math.sin(an), ax = d.vy, az = -d.vx, cx = S.p.x, cz = S.p.y, cy = (HDM && TER ? THc(cx, cz) : 0) + 7 + (S.jz || 0);
    const rot = (o, px, py, pz) => { const dot = ax * px + az * pz, crx = -az * py, cry = az * px - ax * pz, crz = ax * py; buf[o] = px * c + crx * s + ax * dot * (1 - c); buf[o + 1] = py * c + cry * s; buf[o + 2] = pz * c + crz * s + az * dot * (1 - c); };
    for (let i = sv; i < n; i++) { const o = i * FL; rot(o, buf[o] - cx, buf[o + 1] - cy, buf[o + 2] - cz); buf[o] += cx; buf[o + 1] += cy; buf[o + 2] += cz; rot(o + 3, buf[o + 3], buf[o + 4], buf[o + 5]); }
  }
  // ---------- v42: sprite VFX (glow, flame, smoke, sparks, shock rings, ground decals) ----------
  // A procedural texture atlas + camera-facing quads. Additive blending for light (fire, sparks, energy), alpha for smoke and decals.
  const VX = { P: [], I: [], prog: null, tex: null, vb: null, buf: new Float32Array(9 * 6 * 3000), U: {} };
  const VEL = { // element palettes: core, main, deep, smoke
    fire: ['#fff3c0', '#ffa030', '#ff3a10', '#2a1a14'], ice: ['#ffffff', '#9fe8ff', '#3a8aff', '#c8e8ff'], crystal: ['#ffffff', '#7df9ff', '#3a7aff', '#b0c8e0'],
    acid: ['#f0ffc0', '#a8ff3a', '#2a9a20', '#3a4a20'], void: ['#ffe0ff', '#ff3ab0', '#7a10ff', '#1a0a2a'], sand: ['#fff0c0', '#ffb060', '#c06020', '#a07850'],
    grav: ['#f0e0ff', '#c070ff', '#5a20ff', '#2a2040'], energy: ['#ffffff', '#7df9ff', '#2a6bff', '#405060'], gold: ['#ffffff', '#ffe066', '#ff9a1a', '#504020'] };
  function vxTex() {
    const S_ = 128, cv = document.createElement('canvas'); cv.width = S_ * 4; cv.height = S_ * 4; const g = cv.getContext('2d'), im = g.createImageData(S_ * 4, S_ * 4), d = im.data;
    const hs = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return (hs(xi, yi) * (1 - u) + hs(xi + 1, yi) * u) * (1 - v) + (hs(xi, yi + 1) * (1 - u) + hs(xi + 1, yi + 1) * u) * v; };
    const fbm = (x, y) => vn(x, y) * .5 + vn(x * 2.1, y * 2.1) * .3 + vn(x * 4.3, y * 4.3) * .2;
    const cell = (ci, fn) => { const ox = (ci % 4) * S_, oy = Math.floor(ci / 4) * S_; for (let y = 0; y < S_; y++) for (let x = 0; x < S_; x++) { const u = (x + .5) / S_ * 2 - 1, v = (y + .5) / S_ * 2 - 1, r = Math.hypot(u, v), a = Math.max(0, Math.min(1, fn(u, v, r, x, y))), o = ((oy + y) * S_ * 4 + ox + x) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(a * 255); } };
    cell(0, (u, v, r) => Math.exp(-r * r * 4.5) * (1 - r * .2));                                              // glow
    cell(1, (u, v, r, x, y) => { const n = fbm(x / 18, y / 18 + 3); return Math.max(0, 1 - r * (1.05 + .6 * (1 - n))) * (.55 + .6 * n); }); // flame
    cell(2, (u, v, r, x, y) => { const n = fbm(x / 22 + 9, y / 22); return Math.max(0, 1 - r * (1.1 + .7 * (1 - n))) * (.35 + .65 * n) * .9; }); // smoke
    cell(3, (u, v) => Math.exp(-v * v * 40) * Math.max(0, 1 - Math.abs(u)) * (1 - Math.abs(u) * .3));     // spark streak
    cell(4, (u, v, r) => Math.exp(-Math.pow((r - .82) / .07, 2)));                                          // thin ring
    cell(5, (u, v, r) => Math.max(Math.exp(-r * r * 9), Math.exp(-u * u * 400) * (1 - Math.abs(v)), Math.exp(-v * v * 400) * (1 - Math.abs(u)))); // star flare
    cell(6, (u, v, r) => Math.exp(-Math.pow((r - .7) / .2, 2)) * (r < 1 ? 1 : 0));                         // soft shock ring
    cell(7, (u, v, r, x, y) => { const n = fbm(x / 10, y / 10), a = Math.atan2(v, u), ray = Math.pow(Math.abs(Math.sin(a * 7 + n * 3)), 6); return Math.max(0, 1 - r) * (.55 + .45 * n) * (r < .35 ? 1 : .4 + .6 * ray); }); // scorch decal
    // realistic explosion parts: billowing smoke, a turbulent fireball, a jagged debris chunk, a glowing ember, a grainy dust puff
    const BL = []; for (let i = 0; i < 16; i++) { const a = hs(i, 3) * 6.283, d = Math.pow(hs(i, 7), .6) * .42; BL.push([Math.cos(a) * d, Math.sin(a) * d * .9 - .04, .2 + hs(i, 11) * .26]); }
    cell(8, (u, v, r, x, y) => { let s = 0; for (const b of BL) { const q = Math.hypot(u - b[0], v - b[1]) / b[2]; s += Math.exp(-q * q * 1.6); } const n = fbm(x / 14 + 2, y / 14); return Math.min(1, s * .55) * (.55 + .45 * n) * Math.max(0, 1 - Math.pow(r, 6)); });
    cell(9, (u, v, r, x, y) => { const n = fbm(x / 16 + 5, y / 16 + 1), n2 = fbm(x / 7, y / 7); return Math.pow(Math.max(0, 1 - r * (.95 + .9 * (1 - n))), .65) * (.6 + .4 * n2); });
    cell(10, (u, v, r) => { const a = Math.atan2(v, u), R = .45 + .22 * Math.sin(a * 3 + 1) + .12 * Math.sin(a * 7 + 2); return Math.max(0, Math.min(1, (R - r) * 18)); });
    cell(11, (u, v, r) => Math.min(1, Math.exp(-r * r * 40) + .35 * Math.exp(-r * r * 7)));
    cell(12, (u, v, r, x, y) => { const n = fbm(x / 6, y / 6), n2 = fbm(x / 20 + 4, y / 20); return Math.max(0, 1 - r * (1 + .9 * (1 - n2))) * (.3 + .7 * n) * .85; });
    g.putImageData(im, 0, 0); return cv;
  }
  function vxInit() {
    if (VX.prog || !gl) return !!VX.prog;
    try {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec3 aP;attribute vec2 aT;attribute vec4 aC;uniform mat4 uM;varying vec2 vT;varying vec4 vC;void main(){vT=aT;vC=aC;gl_Position=uM*vec4(aP,1.);}'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D uX;varying vec2 vT;varying vec4 vC;void main(){float a=texture2D(uX,vT).a*vC.a;gl_FragColor=vec4(vC.rgb*a,a);}'));
      gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aT'); gl.bindAttribLocation(p, 2, 'aC'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      VX.U.uM = gl.getUniformLocation(p, 'uM'); VX.U.uX = gl.getUniformLocation(p, 'uX');
      VX.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, VX.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vxTex()); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.activeTexture(gl.TEXTURE0);
      VX.vb = gl.createBuffer(); VX.prog = p; return true;
    } catch (e) { console.warn('vfx', e); VX.prog = false; return false; }
  }
  const vcol = c => { const k = col(c); return [k[0], k[1], k[2]]; };
  const TH0 = (x, z) => (HDM && TER ? THc(x, z) : 0);
  // particle: {x,y,z, vx,vy,vz, g, dr, l, ml, s0, s1, c0, c1, a0, a1, tx, rot, vr, add, flat, str}
  function vxAdd(o) { if (VX.P.length > 2400) VX.P.shift(); o.ml = o.l; o.rot = o.rot || 0; VX.P.push(o); }
  function vxSpr(x, y, z, s, c, a, tx, add, flat, rot, str, vx, vy, vz) { VX.I.push({ x, y, z, s, c: vcol(c), a, tx: tx || 0, add: add !== false, flat, rot: rot || 0, str, vx, vy, vz }); }
  const rr = (a, b) => a + Math.random() * (b - a);
  // presets
  const FX = {
    explode(x, z, o) { const r = o.r || 20, E = VEL[o.el] || VEL.fire, y = TH0(x, z), big = r > 40;
      vxAdd({ x, y: y + r * .3, z, l: .22, s0: r * 2.2, s1: r * 3.2, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: 0, tx: 0, add: 1 });
      vxAdd({ x, y: y + r * .25, z, l: .12, s0: r * 1.4, s1: r * 2.6, c0: vcol('#ffffff'), c1: vcol(E[0]), a0: .9, a1: 0, tx: 5, add: 1 });
      for (let i = 0; i < (big ? 16 : 10); i++) { const q = rr(0, 6.283), sp = rr(.3, 1) * r * 1.4; vxAdd({ x, y: y + rr(2, r * .3), z, vx: Math.cos(q) * sp, vy: rr(r * .4, r * 1.6), vz: Math.sin(q) * sp, dr: 3, g: -8, l: rr(.45, .8), s0: r * rr(.4, .7), s1: r * rr(.8, 1.2), c0: vcol(E[1]), c1: vcol(E[2]), a0: 1, a1: 0, tx: 1, vr: rr(-2, 2), add: 1 }); }
      for (let i = 0; i < (big ? 22 : 14); i++) { const q = rr(0, 6.283), el = rr(.3, 1.2), sp = rr(r * 2, r * 5); vxAdd({ x, y: y + 3, z, vx: Math.cos(q) * sp * Math.cos(el * .5), vy: Math.sin(el) * sp * .7, vz: Math.sin(q) * sp * Math.cos(el * .5), g: 220, dr: 1.5, l: rr(.35, .8), s0: rr(2.5, 4.5), s1: 1, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); }
      for (let i = 0; i < (big ? 9 : 6); i++) { const q = rr(0, 6.283), sp = rr(.2, .6) * r; vxAdd({ x: x + Math.cos(q) * r * .3, y: y + rr(4, r * .4), z: z + Math.sin(q) * r * .3, vx: Math.cos(q) * sp, vy: rr(8, 24), vz: Math.sin(q) * sp, dr: 1.2, l: rr(1.2, 2.2), s0: r * .7, s1: r * 1.8, c0: vcol(E[3]), c1: vcol(E[3]), a0: .55, a1: 0, tx: 2, vr: rr(-.8, .8), add: 0 }); }
      vxAdd({ x, y: y + .6, z, l: .55, s0: r * .6, s1: r * 3.4, c0: vcol(E[1]), c1: vcol(E[2]), a0: .9, a1: 0, tx: 6, flat: 1, add: 1 });
      vxAdd({ x, y: y + .4, z, l: 4, s0: r * 2.1, s1: r * 2.3, c0: vcol('#000000'), c1: vcol('#000000'), a0: .55, a1: 0, tx: 7, flat: 1, add: 0, rot: rr(0, 6.28) });
      vxAdd({ x, y: y + .5, z, l: 1.2, s0: r * 1.6, s1: r * 1.8, c0: vcol(E[1]), c1: vcol(E[2]), a0: .7, a1: 0, tx: 7, flat: 1, add: 1, rot: rr(0, 6.28) }); },
    ring(x, z, o) { const E = VEL[o.el] || VEL.energy, y = TH0(x, z), r1 = o.r1 || 10, r2 = o.r2 || 80;
      vxAdd({ x, y: y + .7, z, l: .6, s0: r1 * 2, s1: r2 * 2.3, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: 0, tx: 4, flat: 1, add: 1 });
      vxAdd({ x, y: y + .5, z, l: .7, s0: r1 * 2, s1: r2 * 2.1, c0: vcol(E[1]), c1: vcol(E[2]), a0: .7, a1: 0, tx: 6, flat: 1, add: 1 });
      for (let i = 0; i < 24; i++) { const q = i / 24 * 6.283, rm = (r1 + r2) / 2; vxAdd({ x: x + Math.cos(q) * rm, y: y + 2, z: z + Math.sin(q) * rm, vx: Math.cos(q) * 60, vy: rr(30, 90), vz: Math.sin(q) * 60, g: 160, l: rr(.4, .7), s0: 3, s1: 1, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); } },
    cone(x, z, o) { const E = VEL[o.el] || VEL.fire, y = TH0(x, z), R = o.r || 80;
      for (let i = 0; i < 26; i++) { const q = o.a + rr(-o.arc / 2, o.arc / 2), sp = rr(R * 1.2, R * 2.6); vxAdd({ x, y: y + 6, z, vx: Math.cos(q) * sp, vy: rr(-5, 25), vz: Math.sin(q) * sp, dr: 2.2, l: rr(.35, .6), s0: 6, s1: rr(16, 26), c0: vcol(E[0]), c1: vcol(E[2]), a0: 1, a1: 0, tx: 1, vr: rr(-3, 3), add: 1 }); }
      for (let i = 0; i < 6; i++) { const q = o.a + rr(-o.arc / 2, o.arc / 2), d = rr(.3, .9) * R; vxAdd({ x: x + Math.cos(q) * d, y: y + 4, z: z + Math.sin(q) * d, vy: 14, dr: 1, l: rr(1, 1.6), s0: 14, s1: 30, c0: vcol(E[3]), c1: vcol(E[3]), a0: .45, a1: 0, tx: 2, add: 0 }); } },
    beam(x, z, o) { const E = VEL[o.el] || VEL.energy, y = TH0(x, z), ca = Math.cos(o.a), sa = Math.sin(o.a);
      for (let i = 0; i < 18; i++) { const d = i / 17 * o.len, px = x + ca * d, pz = z + sa * d; vxAdd({ x: px, y: TH0(px, pz) + 6, z: pz, l: .25, s0: o.w * 2.2, s1: o.w * 3, c0: vcol(E[0]), c1: vcol(E[1]), a0: .9, a1: 0, tx: 0, add: 1 });
        if (i % 2) vxAdd({ x: px, y: TH0(px, pz) + 3, z: pz, vx: rr(-40, 40), vy: rr(40, 110), vz: rr(-40, 40), g: 200, l: rr(.3, .6), s0: 3, s1: 1, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); }
      const ex = x + ca * o.len, ez = z + sa * o.len; vxAdd({ x: ex, y: TH0(ex, ez) + .5, z: ez, l: 2.5, s0: o.w * 2.5, s1: o.w * 2.8, c0: vcol('#000000'), c1: vcol('#000000'), a0: .45, a1: 0, tx: 7, flat: 1, add: 0, rot: rr(0, 6) }); },
    muzzle(x, z, o) { const y = TH0(x, z) + (o.h || 6), c = o.c || '#ffe066', ca = Math.cos(o.a), sa = Math.sin(o.a);
      vxAdd({ x, y, z, l: .06, s0: 9, s1: 12, c0: vcol('#ffffff'), c1: vcol(c), a0: 1, a1: 0, tx: 5, add: 1, rot: rr(0, 6) });
      vxAdd({ x, y, z, l: .09, s0: 12, s1: 16, c0: vcol(c), c1: vcol(c), a0: .7, a1: 0, tx: 0, add: 1 });
      for (let i = 0; i < 3; i++) { const q = o.a + rr(-.4, .4), sp = rr(90, 200); vxAdd({ x, y, z, vx: Math.cos(q) * sp, vy: rr(-10, 30), vz: Math.sin(q) * sp, l: rr(.08, .16), s0: 2.2, s1: .6, c0: vcol('#ffffff'), c1: vcol(c), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); } },
    hit(x, z, o) { const y = TH0(x, z) + (o.h || 6), c = o.c || '#ffe066', n = o.crit ? 10 : 5;
      vxAdd({ x, y, z, l: o.crit ? .18 : .1, s0: o.crit ? 16 : 8, s1: o.crit ? 26 : 12, c0: vcol('#ffffff'), c1: vcol(c), a0: 1, a1: 0, tx: o.crit ? 5 : 0, add: 1, rot: rr(0, 6) });
      for (let i = 0; i < n; i++) { const q = rr(0, 6.283), sp = rr(60, o.crit ? 220 : 140); vxAdd({ x, y, z, vx: Math.cos(q) * sp, vy: rr(20, 120), vz: Math.sin(q) * sp, g: 260, l: rr(.15, .35), s0: 2.4, s1: .5, c0: vcol('#ffffff'), c1: vcol(c), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); } },
    pillar(x, z, o) { const E = VEL[o.el] || VEL.gold, y = TH0(x, z);
      for (let i = 0; i < 8; i++) vxAdd({ x, y: y + i * 30, z, vy: 60, l: 1.1, s0: 60 - i * 3, s1: 30, c0: vcol(E[0]), c1: vcol(E[1]), a0: .55, a1: 0, tx: 0, add: 1 });
      FX.ring(x, z, { el: o.el, r1: 10, r2: 200 }); vxAdd({ x, y: y + 40, z, l: .5, s0: 120, s1: 220, c0: vcol('#ffffff'), c1: vcol(E[1]), a0: .9, a1: 0, tx: 5, add: 1 });
      for (let i = 0; i < 30; i++) { const q = rr(0, 6.283), d = rr(10, 60); vxAdd({ x: x + Math.cos(q) * d, y: y + rr(0, 20), z: z + Math.sin(q) * d, vy: rr(80, 260), l: rr(.6, 1.3), s0: 3, s1: 1, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); } },
    dust(x, z, o) { const y = TH0(x, z), c = o.c || '#a09080';
      for (let i = 0; i < (o.n || 6); i++) { const q = rr(0, 6.283), sp = rr(20, 60); vxAdd({ x, y: y + 2, z, vx: Math.cos(q) * sp, vy: rr(5, 20), vz: Math.sin(q) * sp, dr: 3, l: rr(.5, .9), s0: 6, s1: 16, c0: vcol(c), c1: vcol(c), a0: .4, a1: 0, tx: 2, add: 0 }); } },
    burst(x, z, o) { const E = VEL[o.el] || VEL.energy, y = TH0(x, z), r = o.r || 120;
      vxAdd({ x, y: y + 20, z, l: .5, s0: r, s1: r * 2.4, c0: vcol('#ffffff'), c1: vcol(E[1]), a0: 1, a1: 0, tx: 5, add: 1 });
      FX.ring(x, z, { el: o.el, r1: 10, r2: r }); FX.ring(x, z, { el: o.el, r1: r * .3, r2: r * 1.4 });
      for (let i = 0; i < 40; i++) { const q = rr(0, 6.283), d = rr(0, r); vxAdd({ x: x + Math.cos(q) * d, y: y + 300, z: z + Math.sin(q) * d, vy: -rr(700, 1000), l: rr(.25, .45), s0: 5, s1: 3, c0: vcol(E[0]), c1: vcol(E[1]), a0: 1, a1: .3, tx: 3, str: 1, add: 1 }); }
      for (let i = 0; i < 14; i++) { const q = rr(0, 6.283), d = rr(0, r * .8); vxAdd({ x: x + Math.cos(q) * d, y: y + 4, z: z + Math.sin(q) * d, vy: rr(20, 60), l: rr(.5, .9), s0: 20, s1: 50, c0: vcol(E[1]), c1: vcol(E[2]), a0: .9, a1: 0, tx: 1, add: 1 }); } } };
  /* ---------- realistic explosions (HD and Real views) ----------
     flash → turbulent fireball that rises on its own heat → billowing smoke lit orange from below, turning grey → debris on ballistic arcs
     with smoke trails → embers → a ground-hugging dust ring → scorch mark. Gravity and air are each world's own: on airless worlds the
     fireball is a brief flash (no oxygen) and the regolith flies out in a perfect dome and falls back slowly, with no smoke at all. */
  const WG = [.17, .38, .38, .13, .14, .03, .5], AIRW = [0, .55, 0, 0, 1.4, 0, .8];
  const SMK = [['#7c7a78', '#9a9894'], ['#7a4a32', '#b07a58'], ['#6a6662', '#8a8580'], ['#c8d8e8', '#eef6ff'], ['#8a5a28', '#c08a4a'], ['#6a6a70', '#8a8a92'], ['#5a3a6a', '#8a6a9a']];
  function realBoom(x, z, o) { const r = Math.max(8, o.r || 20), E = VEL[o.el] || VEL.fire, y = TH0(x, z), lv = S.lv || 0, air = AIRW[lv] ?? .5, gW = 220 * Math.max(.22, WG[lv] || .5), big = r > 40, Q = R3.q === 'low' ? .55 : 1, sm = SMK[lv] || SMK[0];
    const fire = !o.el || o.el === 'fire' || o.el === 'energy', E0 = fire ? '#fff6d8' : E[0], E1 = fire ? '#ffb040' : E[1], E2 = fire ? '#e0400c' : E[2];
    R3.flashes = R3.flashes || []; R3.flashes.push({ x, z, t: 0, r: r * 5, c: E1 });
    // flash
    vxAdd({ x, y: y + r * .35, z, l: .08, s0: r * 2.4, s1: r * 3.2, c0: vcol('#ffffff'), c1: vcol(E0), a0: .9, a1: 0, tx: 5, add: 1, rot: rr(0, 6) });
    vxAdd({ x, y: y + r * .3, z, l: .14, s0: r * 1.6, s1: r * 2.4, c0: vcol('#fff2c0'), c1: vcol(E1), a0: .7, a1: 0, tx: 0, add: 1 });
    // fireball: several turbulent lobes that swell, rise and cool from white to orange to deep red
    const fl = air > 0 ? 1 : .45, nF = Math.round((big ? 11 : 7) * Q);
    for (let i = 0; i < nF; i++) { const q = rr(0, 6.283), sp = rr(.25, .8) * r * (air > 0 ? 1.2 : 2.2), up = rr(.2, .7) * r;
      vxAdd({ x: x + rr(-.2, .2) * r, y: y + rr(.15, .5) * r, z: z + rr(-.2, .2) * r, vx: Math.cos(q) * sp, vy: up + r * .5 * air, vz: Math.sin(q) * sp, dr: 3.2, g: -r * .9 * air, l: rr(.45, .85) * fl, s0: r * rr(.6, .9), s1: r * rr(1.3, 1.9), c0: fire ? [.95, .62, .25] : vcol(E0), c1: fire ? [.5, .1, .02] : vcol(E2), a0: .85, a1: 0, ez: 1, tx: 9, rot: rr(0, 6), vr: rr(-1.2, 1.2), add: 1 });
      if (i % 2 === 0) vxAdd({ x: x + rr(-.15, .15) * r, y: y + rr(.2, .45) * r, z: z + rr(-.15, .15) * r, vx: Math.cos(q) * sp * .7, vy: up * .8 + r * .45 * air, vz: Math.sin(q) * sp * .7, dr: 3, g: -r * .8 * air, l: rr(.6, 1) * fl, s0: r * rr(.7, 1), s1: r * rr(1.4, 2), c0: fire ? [.85, .38, .08] : vcol(E1), c1: [.16, .1, .08], a0: .95, a1: 0, ez: 1, tx: 9, rot: rr(0, 6), vr: rr(-1, 1), add: 0 }); }
    // smoke: billows lit orange from below at first, then grey; they rise, spread and slowly fade (only where there is air)
    if (air > 0) { const nS = Math.round((big ? 16 : 9) * Q);
      for (let i = 0; i < nS; i++) { const q = rr(0, 6.283), d = rr(0, .5) * r, sp = rr(.15, .45) * r, life = rr(2.2, 4) * (air > 1 ? 1.4 : 1);
        const base = { x: x + Math.cos(q) * d, y: y + rr(.2, .6) * r, z: z + Math.sin(q) * d, vx: Math.cos(q) * sp, vy: rr(.4, .9) * r * .6 / Math.max(.6, air), vz: Math.sin(q) * sp, dr: 1.1 * air, l: life, rot: rr(0, 6), vr: rr(-.35, .35), add: 0 };
        vxAdd({ ...base, s0: r * rr(.8, 1.1), s1: r * rr(2.8, 3.8), c0: vcol(fire ? '#2a160c' : E[3]), c1: vcol(sm[0]), a0: 1, a1: 0, ez: 1, tx: 8 });
        vxAdd({ ...base, y: base.y + r * .25, s0: r * rr(.55, .8), s1: r * rr(2, 2.8), c0: vcol(fire ? '#e07020' : E[1]), c1: vcol(sm[1]), a0: .75, a1: 0, ez: 1, tx: 8, vr: -base.vr }); } }
    else { const nD = Math.round((big ? 40 : 24) * Q);   // the airless ejecta dome: dust on clean ballistic arcs, no drag, falling back in low gravity
      for (let i = 0; i < nD; i++) { const q = rr(0, 6.283), el = rr(.5, 1.25), sp = rr(.45, 1.15) * r * 1.5 * Math.sqrt(.4 / Math.max(.13, WG[lv])), lit = i % 3 !== 0;
        vxAdd({ x, y: y + 2, z, vx: Math.cos(q) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(q) * Math.cos(el) * sp, g: gW, bnc: 1, l: rr(1.8, 3.2), s0: r * rr(.4, .6), s1: r * rr(.9, 1.3), c0: lit ? [.95, .93, .88] : [.4, .39, .37], c1: lit ? [.8, .78, .74] : [.36, .35, .33], a0: .95, a1: 0, ez: 1, tx: lit ? 8 : 12, rot: rr(0, 6), add: 0 }); }
      vxAdd({ x, y: y + r * .3, z, l: .5, s0: r * 1.2, s1: r * 3, c0: [.9, .88, .84], c1: vcol(sm[1]), a0: .7, a1: 0, ez: 1, tx: 12, add: 0 }); }
    // debris: dark chunks on ballistic arcs with smoke trails, bouncing to a stop
    const nB = Math.round((big ? 14 : 7) * Q);
    for (let i = 0; i < nB; i++) { const q = rr(0, 6.283), el = rr(.35, 1.2), sp = rr(1.4, 3.2) * r * Math.sqrt(.45 / Math.max(.13, WG[lv]));
      vxAdd({ x, y: y + r * .2, z, vx: Math.cos(q) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(q) * Math.cos(el) * sp, g: gW, dr: .25 * air, bnc: 1, l: rr(1.6, 2.8), s0: rr(1.6, 3.4) * Math.min(2, r / 18), s1: rr(1.4, 3) * Math.min(2, r / 18), c0: vcol('#2a2624'), c1: vcol('#3a3430'), a0: 1, a1: .9, tx: 10, rot: rr(0, 6), vr: rr(-9, 9), add: 0, trail: air > 0 ? 12 : 0, tc: vcol(sm[0]) }); }
    // sparks and embers
    const nK = Math.round((big ? 30 : 16) * Q);
    for (let i = 0; i < nK; i++) { const q = rr(0, 6.283), el = rr(.2, 1.3), sp = rr(r * 2.2, r * 6);
      vxAdd({ x, y: y + 3, z, vx: Math.cos(q) * sp * Math.cos(el), vy: Math.sin(el) * sp * .8, vz: Math.sin(q) * sp * Math.cos(el), g: gW * 1.2, dr: 1.2 * air + .2, l: rr(.3, .7), s0: rr(2.5, 4.5), s1: 1, c0: vcol('#fff8e0'), c1: vcol(E1), a0: 1, a1: 0, tx: 3, str: 1, add: 1 }); }
    for (let i = 0; i < Math.round(nK * .5); i++) { const q = rr(0, 6.283), sp = rr(.4, 1.6) * r;
      vxAdd({ x, y: y + r * .4, z, vx: Math.cos(q) * sp, vy: rr(.5, 1.5) * r, vz: Math.sin(q) * sp, g: gW * .35, dr: .8 * air, bnc: 1, l: rr(1.2, 2.4), s0: rr(1.6, 2.6), s1: .8, c0: vcol('#ffd27a'), c1: vcol('#ff4a10'), a0: 1, a1: 0, tx: 11, add: 1 }); }
    // ground: a dust skirt racing outwards, a heat ring, and a lasting scorch mark
    vxAdd({ x, y: y + .8, z, l: .9, s0: r * .8, s1: r * 4.2, c0: vcol(sm[1]), c1: vcol(sm[0]), a0: .55, a1: 0, tx: 6, flat: 1, add: 0 });
    vxAdd({ x, y: y + .6, z, l: .35, s0: r * .5, s1: r * 3, c0: vcol(E1), c1: vcol(E2), a0: .8, a1: 0, tx: 4, flat: 1, add: 1 });
    vxAdd({ x, y: y + .4, z, l: 9, s0: r * 2.2, s1: r * 2.3, c0: vcol('#000000'), c1: vcol('#000000'), a0: .6, a1: 0, tx: 7, flat: 1, add: 0, rot: rr(0, 6.28) });
    vxAdd({ x, y: y + .5, z, l: 2.2, s0: r * 1.4, s1: r * 1.6, c0: vcol('#ff6a1a'), c1: vcol('#3a0a00'), a0: .8, a1: 0, tx: 7, flat: 1, add: 1, rot: rr(0, 6.28) }); }
  const oldExplode = FX.explode; FX.explode = (x, z, o) => (HDM && R3.realFx !== false) ? realBoom(x, z, o) : oldExplode(x, z, o);
  R3.fx = (k, x, z, o) => { try { if (FX[k] && VX.P.length < 2400) FX[k](x, z, o || {}); } catch (e) {} };
  R3.fxEl = VEL; R3._vx = VX; R3._dbg = () => ({ gl, prog, U, TER });
  // live per-frame sprites: bullets as glowing orbs/tracers, elemental telegraph rims on danger zones
  function vxLive(t) {
    try { vxLive2(t); } catch (e) {}
    for (const e of S.eb) { const y = TH0(e.x, e.y) + 5; vxSpr(e.x, y, e.y, 13, e.c || '#d8ff6a', .9, 0); vxSpr(e.x, y, e.y, 5.5, '#ffffff', 1, 0); }
    for (const b of S.bul) { const y = TH0(b.x, b.y) + 5.2 + (b.h0 || 0) * clamp(b.l / .7, 0, 1), c = (b.c || '#7df9ff'); vxSpr(b.x, y, b.y, 9, c, .9, 3, true, false, 0, 1, b.vx, 0, b.vy); vxSpr(b.x, y, b.y, 6, c, .6, 0); }
    const bs = S.al.find(a => a.boss && a.hp > 0), el = bs ? bossElR(bs) : 'fire', E = VEL[el] || VEL.fire;
    for (const h of S.hz) { if (h.k === 'circle' && h.t > 0 && h.t < (h.t0 || 1) + .01) { const k = 1 - h.t / (h.t0 || 1), y = TH0(h.x, h.y) + .45, pul = .6 + .4 * Math.sin(t * 14);
        vxSpr(h.x, y, h.y, h.r * 2.25, E[1], .5 + .4 * k * pul, 4, true, true); vxSpr(h.x, y + .05, h.y, h.r * 2 * k, E[2], .25 + .3 * k, 6, true, true); }
      else if (h.k === 'donut' && h.t > 0 && h.fl == null) { const k = 1 - h.t / (h.t0 || 1), y = TH0(h.x, h.y) + .45; vxSpr(h.x, y, h.y, h.r2 * 2.2, E[1], .4 + .4 * k, 4, true, true); vxSpr(h.x, y, h.y, h.r1 * 2.2, E[0], .3 + .3 * k, 4, true, true); } }
  }
  function bossElR(b) { return b.echo ? 'void' : (b.ty === 'colossus' && S.lv === 6) ? 'void' : ({ golem: 'crystal', worm: 'sand', scorch: 'fire', kraken: 'ice', queen: 'fire', colossus: 'grav' })[b.ty] || 'fire'; }
  R3.bossEl = bossElR;
  function vxDraw(dt) {
    if (!vxInit()) return; const t = T(); VX.I.length = 0; try { vxLive(t); } catch (e) {}
    const P = VX.P; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.l -= dt; if (p.l <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      if (p.vx != null) { const k = p.dr ? Math.exp(-p.dr * dt) : 1; p.vx *= k; p.vz *= k; p.vy = (p.vy || 0) * k - (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.bnc) { const gy = TH0(p.x, p.z) + p.s0 * .25; if (p.y < gy) { p.y = gy; p.vy = Math.abs(p.vy) * .3; p.vx *= .55; p.vz *= .55; p.vr = (p.vr || 0) * .5; if (Math.abs(p.vy) < 6) { p.vy = 0; p.g = 0; p.vx *= .2; p.vz *= .2; } } }
        if (p.trail && p.l > p.ml * .25 && Math.random() < dt * p.trail && P.length < 2300) vxAdd({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 4, vz: 0, dr: 2, l: rr(.8, 1.4), s0: p.s0 * 1.8, s1: p.s0 * 5, c0: p.tc || vcol('#6a645c'), c1: p.tc || vcol('#6a645c'), a0: .6, a1: 0, ez: 1, tx: 8, rot: rr(0, 6), add: 0 }); }
      else if (p.vy) p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt; }
    VX.addArr = null; if (!P.length && !VX.I.length) return;
    const B = BAS; if (!B) return; const R_ = B.r, U_ = B.u, F_ = B.f, out = [[], []];
    const quad = (x, y, z, s, r, g, b, a, tx, add, flat, rot, str, vx, vy, vz) => {
      const L = out[add ? 1 : 0]; if (L.length > 9 * 6 * 1400) return; const cu = (tx % 4) * .25, cv = Math.floor(tx / 4) * .25, du = .25, dv = .25, h = s / 2;
      let ax, ay, az, bx, by, bz;
      if (flat) { const c = Math.cos(rot), sn = Math.sin(rot); ax = c * h; ay = 0; az = sn * h; bx = -sn * h; by = 0; bz = c * h; }
      else if (str) { let l = Math.hypot(vx, vy, vz) || 1; let dx = vx / l, dy = vy / l, dz = vz / l; let sx = dy * F_[2] - dz * F_[1], sy = dz * F_[0] - dx * F_[2], sz = dx * F_[1] - dy * F_[0], sl = Math.hypot(sx, sy, sz) || 1; const len = Math.max(h * 2.2, Math.min(l * .045, 26)); ax = dx * len; ay = dy * len; az = dz * len; bx = sx / sl * h * .5; by = sy / sl * h * .5; bz = sz / sl * h * .5; }
      else { const c = Math.cos(rot), sn = Math.sin(rot); ax = (R_[0] * c + U_[0] * sn) * h; ay = (R_[1] * c + U_[1] * sn) * h; az = (R_[2] * c + U_[2] * sn) * h; bx = (-R_[0] * sn + U_[0] * c) * h; by = (-R_[1] * sn + U_[1] * c) * h; bz = (-R_[2] * sn + U_[2] * c) * h; }
      const v = (sa, sb, u, w) => L.push(x + ax * sa + bx * sb, y + ay * sa + by * sb, z + az * sa + bz * sb, cu + u * du, cv + w * dv, r, g, b, a);
      v(-1, -1, 0, 0); v(1, -1, 1, 0); v(1, 1, 1, 1); v(-1, -1, 0, 0); v(1, 1, 1, 1); v(-1, 1, 0, 1); };
    for (const p of P) { const k = 1 - p.l / p.ml, s = p.s0 + (p.s1 - p.s0) * (p.ez ? 1 - (1 - k) * (1 - k) : k), a = p.a0 + (p.a1 - p.a0) * (p.ez ? k * k : k), c0 = p.c0, c1 = p.c1 || c0; if (a <= .01) continue;
      quad(p.x, p.y, p.z, s, c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k, a, p.tx, p.add, p.flat, p.rot, p.str, p.vx || 0, p.vy || 0, p.vz || 0); }
    for (const q of VX.I) quad(q.x, q.y, q.z, q.s, q.c[0], q.c[1], q.c[2], q.a, q.tx, q.add, q.flat, q.rot, q.str, q.vx || 0, q.vy || 0, q.vz || 0);
    gl.useProgram(VX.prog); gl.uniformMatrix4fv(VX.U.uM, false, new Float32Array(VP)); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, VX.tex); gl.uniform1i(VX.U.uX, 5);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.bindBuffer(gl.ARRAY_BUFFER, VX.vb);
    for (let pass = 0; pass < 2; pass++) { const L = out[pass]; if (!L.length) continue; const fa = new Float32Array(L), bytes = fa.length * 4;
      if (!VX.vb._cap || VX.vb._cap < bytes) { VX.vb._cap = Math.ceil(bytes * 1.5); gl.bufferData(gl.ARRAY_BUFFER, VX.vb._cap, gl.DYNAMIC_DRAW); } gl.bufferSubData(gl.ARRAY_BUFFER, 0, fa);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
      if (pass === 0) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, fa.length / 9); if (pass === 1) VX.addArr = fa; }
    for (let i = 0; i < 3; i++) gl.disableVertexAttribArray(i);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.activeTexture(gl.TEXTURE0); gl.useProgram(prog);
  }
  // ---------- v43: element markers, blob shadows, lock-on reticle, skill fields; bloom post-process ----------
  VEL.steam = ['#ffffff', '#eef6ff', '#b8c8d8', '#dfe8f0']; VEL.electro = ['#ffffff', '#c39bff', '#7a3aff', '#3a2a5a']; VEL.pyro = VEL.fire; VEL.cryo = VEL.ice;
  FX.snow = (x, z, o) => { const y = TH0(x, z), r = o.r || 120; for (let i = 0; i < 26; i++) { const q = rr(0, 6.283), d = Math.sqrt(Math.random()) * r; vxAdd({ x: x + Math.cos(q) * d, y: y + rr(40, 110), z: z + Math.sin(q) * d, vx: rr(-15, 15), vy: -rr(40, 80), vz: rr(-15, 15), l: rr(.9, 1.6), s0: rr(3, 6), s1: 2, c0: vcol('#ffffff'), c1: vcol('#9fe8ff'), a0: .9, a1: 0, tx: 0, add: 1 }); } };
  FX.steam = (x, z, o) => { const y = TH0(x, z), r = o.r || 30; for (let i = 0; i < 12; i++) { const q = rr(0, 6.283), sp = rr(20, 70); vxAdd({ x, y: y + rr(4, 14), z, vx: Math.cos(q) * sp, vy: rr(20, 60), vz: Math.sin(q) * sp, dr: 1.6, l: rr(.8, 1.5), s0: r * .6, s1: r * 1.7, c0: vcol('#ffffff'), c1: vcol('#c8d8e8'), a0: .7, a1: 0, tx: 2, vr: rr(-1, 1), add: 0 }); } FX.ring(x, z, { el: 'steam', r1: 6, r2: r * 2 }); };
  const ELC = { pyro: '#ff7a2a', cryo: '#9fe8ff', electro: '#b98aff' };
  function vxLive2(t) {
    const now = performance.now() / 1000, sh = (x, z, s, a) => vxSpr(x, TH0(x, z) + .25, z, s, '#000000', a, 0, false, true);
    // soft blob shadows (grounding)
    if (S.land <= .55) { sh(S.p.x, S.p.y, 13 * (1 - Math.min(.5, (S.jz || 0) / 60)), .38); S.npc.forEach(n => sh(n.x, n.y, 11, .3)); if (S.hero) sh(S.hero.x, S.hero.y, 12, .32); }
    for (const a of S.al) { if (a.hid) continue; const r = a.boss ? (a.r || 16) * 4.2 : (a.r || 6) * 2.6; sh(a.x, a.y, r, a.boss ? .42 : .3);
      if (a.aura && a.aura.t > now) { const c = ELC[a.aura.el] || '#ffffff', h = TH0(a.x, a.y) + (a.boss ? 70 : (a.r || 6) * 2.4 + 9), pu = .75 + .25 * Math.sin(t * 8); vxSpr(a.x, h, a.y, (a.boss ? 14 : 8) * pu, c, .95, 0); vxSpr(a.x, h, a.y, a.boss ? 5 : 3, '#ffffff', 1, 0); }
      if (a.boss && a.ph >= 2 && !a.hid && Math.random() < (a.ph >= 3 ? .9 : .45)) { const q = rr(0, 6.283), d = (a.r || 14) * rr(.6, 1.6), c = a.ph >= 3 ? '#ff2a4a' : '#ffb040'; vxAdd({ x: a.x + Math.cos(q) * d, y: TH0(a.x, a.y) + rr(2, 20), z: a.y + Math.sin(q) * d, vx: rr(-6, 6), vy: rr(30, 70), vz: rr(-6, 6), l: rr(.6, 1.2), s0: rr(3, 6), s1: 1, c0: vcol('#ffffff'), c1: vcol(c), a0: .95, a1: 0, tx: 0, add: 1 }); }
      if (a.scT > now) vxSpr(a.x, TH0(a.x, a.y) + .6, a.y, (a.boss ? 90 : 30), '#b98aff', .35 + .2 * Math.sin(t * 10), 4, true, true); }
    // lock-on reticle
    if (S.lockOn) { const b = S.al.find(a => a.boss && a.hp > 0 && !a.hid); if (b) { const y = TH0(b.x, b.y); vxSpr(b.x, y + .7, b.y, 100 + 6 * Math.sin(t * 6), '#ff4060', .8, 4, true, true, t); vxSpr(b.x, y + 34, b.y, 26, '#ff4060', .9, 5, true, false, t * 2); } }
    // skill fields
    for (const f of [S.ff, S.bz]) { if (!f || f.t <= 0) continue; const y = TH0(f.x, f.y) + .6, c = f.el === 'cryo' ? '#9fe8ff' : '#ff7a2a'; vxSpr(f.x, y, f.y, f.r * 2.1, c, .55 + .2 * Math.sin(t * 6), 4, true, true); vxSpr(f.x, y, f.y, f.r * 2, c, .18, 6, true, true, t * .5);
      if (Math.random() < .5) vxAdd({ x: f.x + rr(-f.r, f.r) * .8, y: y + rr(0, 4), z: f.y + rr(-f.r, f.r) * .8, vy: rr(15, 40), l: rr(.5, 1), s0: 4, s1: 1, c0: vcol('#ffffff'), c1: vcol(c), a0: 1, a1: 0, tx: 0, add: 1 }); }
  }
  // bloom: copy the finished (antialiased) frame, keep only the brightest parts at 1/4 size, blur, add back on top
  const BL = { ok: null };
  function blInit() {
    if (BL.ok !== null) return BL.ok;
    try {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const VSq = 'attribute vec2 aP;varying vec2 vU;void main(){vU=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}';
      const mk = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VSq)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 vU;uniform sampler2D uS;uniform vec2 uD;uniform float uK;' + fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return { p, uS: gl.getUniformLocation(p, 'uS'), uD: gl.getUniformLocation(p, 'uD'), uK: gl.getUniformLocation(p, 'uK') }; };
      BL.bright = mk('void main(){vec3 c=(texture2D(uS,vU+uD*vec2(-1.,-1.)).rgb+texture2D(uS,vU+uD*vec2(1.,-1.)).rgb+texture2D(uS,vU+uD*vec2(-1.,1.)).rgb+texture2D(uS,vU+uD).rgb)*.25;float l=max(c.r,max(c.g,c.b));float s=l-min(c.r,min(c.g,c.b));c*=smoothstep(uK,uK+.16,l)*(.15+1.4*s*s);gl_FragColor=vec4(c,1.);}');
      BL.blur = mk('void main(){vec3 c=texture2D(uS,vU).rgb*.227;c+=(texture2D(uS,vU+uD*1.385).rgb+texture2D(uS,vU-uD*1.385).rgb)*.316;c+=(texture2D(uS,vU+uD*3.231).rgb+texture2D(uS,vU-uD*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}');
      BL.comp = mk('void main(){gl_FragColor=vec4(texture2D(uS,vU).rgb*uK,1.);}');
      // Elden Ring style grade for the Real view: lens fringing, muted colour, teal shadows / gold highlights, golden haze, heavy vignette, film grain
      BL.grade = mk('uniform vec3 uH;float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec2 d=vU-.5;float r2=dot(d,d);vec2 o=d*.0035*r2*4.;vec3 c=vec3(texture2D(uS,vU-o).r,texture2D(uS,vU).g,texture2D(uS,vU+o).b);'
        + 'float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,.8);c=c*c*(3.-2.*c)*.22+c*.78;l=dot(c,vec3(.299,.587,.114));'
        + 'c*=mix(vec3(.93,1.,1.05),vec3(1.08,1.,.84),smoothstep(.15,.85,l));c=c*.95+vec3(.022,.024,.026);'
        + 'float hz=smoothstep(.42,1.,vU.y)*.2;c=mix(c,uH*vec3(1.12,.98,.78)+vec3(.06,.05,.02),hz);'
        + 'c*=clamp(1.-smoothstep(.08,.5,r2)*.5,0.,1.);c+=(hs(vU*vec2(913.,577.)+uK)-.5)*.045;gl_FragColor=vec4(c,1.);}');
      BL.grade.uH = gl.getUniformLocation(BL.grade.p, 'uH');
      BL.qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, BL.qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const tx = () => { const t_ = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t_); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t_; };
      BL.scene = tx(); BL.a = tx(); BL.b = tx(); BL.fa = gl.createFramebuffer(); BL.fb = gl.createFramebuffer(); BL.w = 0; BL.h = 0; BL.ok = true;
    } catch (e) { console.warn('bloom', e); BL.ok = false; }
    return BL.ok;
  }
  function blSize(w, h) {
    if (BL.w === w && BL.h === h) return true; BL.w = w; BL.h = h; const qw = Math.max(16, w >> 2), qh = Math.max(16, h >> 2); BL.qw = qw; BL.qh = qh;
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, BL.scene); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    for (const [t_, f] of [[BL.a, BL.fa], [BL.b, BL.fb]]) { gl.bindTexture(gl.TEXTURE_2D, t_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, qw, qh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t_, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.activeTexture(gl.TEXTURE0); BL.ok = false; return false; } }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.activeTexture(gl.TEXTURE0); return true;
  }
  let GRH = [.6, .55, .5];
  function grade() {
    if (!REAL || R3.grade === false || !blInit() || !BL.grade) return; const w = c3.width, h = c3.height; if (!blSize(w, h)) return;
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, BL.scene); gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.bindBuffer(gl.ARRAY_BUFFER, BL.qb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const P = BL.grade; gl.useProgram(P.p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.uniform1i(P.uS, 6); gl.uniform2f(P.uD, 1 / w, 1 / h); gl.uniform1f(P.uK, (performance.now() / 1000) % 50); gl.uniform3fv(P.uH, GRH); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(0); gl.enable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE0); gl.useProgram(prog);
  }
  function bloom() {
    if (!HDM || R3.bloom === false || (R3.rs || 1) < .9 || !blInit()) return; const w = c3.width, h = c3.height; if (!blSize(w, h)) return;
    const pass = (P, src, dst, dx, dy, k, vw, vh) => { gl.useProgram(P.p); gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, vw, vh); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(P.uS, 6); gl.uniform2f(P.uD, dx, dy); gl.uniform1f(P.uK, k); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    const AA = VX.addArr; if (!AA || !AA.length) return;
    // 1) draw the glowing effect sprites (fire, sparks, beams, bullets) into a small buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, BL.fa); gl.viewport(0, 0, BL.qw, BL.qh); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(VX.prog); gl.uniformMatrix4fv(VX.U.uM, false, new Float32Array(VP)); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, VX.tex); gl.uniform1i(VX.U.uX, 5);
    gl.bindBuffer(gl.ARRAY_BUFFER, VX.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, AA);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.drawArrays(gl.TRIANGLES, 0, AA.length / 9); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disable(gl.BLEND); gl.activeTexture(gl.TEXTURE6);
    gl.bindBuffer(gl.ARRAY_BUFFER, BL.qb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    pass(BL.blur, BL.a, BL.fb, 1.4 / BL.qw, 0, 0, BL.qw, BL.qh); pass(BL.blur, BL.b, BL.fa, 0, 1.4 / BL.qh, 0, BL.qw, BL.qh);
    pass(BL.blur, BL.a, BL.fb, 2.6 / BL.qw, 0, 0, BL.qw, BL.qh); pass(BL.blur, BL.b, BL.fa, 0, 2.6 / BL.qh, 0, BL.qw, BL.qh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    pass(BL.comp, BL.a, null, 0, 0, R3.bloomK || 1.1, w, h);
    gl.disable(gl.BLEND); gl.disableVertexAttribArray(0); gl.enable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE0); gl.useProgram(prog);
  }
  function boss(a, ang, fl, sink) {
    const t = T(), x = a.x, y = a.y, sv = n; bossBody(a, ang, fl, t, x, y); if (sink) for (let i = sv; i < n; i++) buf[i * FL + 1] += sink;
  }
  // boss = its body plus an intimidation layer (glowing details, aura, embers; all turn red when enraged)
  const BCOL = { golem: '#7df9ff', worm: '#ff7a2a', scorch: '#ffb040', kraken: '#b05aff', queen: '#ff3050', colossus: '#ff6a2a' };
  function bossBody(a, ang, fl, t, x, y) {
    { const C = skCfg(a); if (C) { skBoss(a, C, ang, fl, t, x, y); return; } }
    bossCore(a, ang, fl, t, x, y); if (a.ty === 'worm' && REAL && wormM()) return; if (a.ty === 'worm' && a.hid && !(S.cin && S.cin.k === 'boss')) return; bossFx(a, ang, fl, t, x, y);
  }
  function bossFx(a, ang, fl, t, x, y) {
    const ca = Math.cos(ang), sa = Math.sin(ang), at = (f, s) => [x + ca * f - sa * s, y + sa * f + ca * s], rg = !!(a.ph2 || a.rg), st = a.stun > 0;
    const gc = rg ? '#ff2a2a' : BCOL[a.ty] || '#ff5050', pul = .5 + .5 * Math.sin(t * (rg ? 9 : 4)), R = (a.r || 20) * 1.7;
    const E = (f, s, h, w, c, e) => { const q = at(f, s); put(SPHm, q[0], h, q[1], w, w, w, 0, 0, c, (e || 0) + fl); };
    const G = (f, s, h, w, c, al) => { const q = at(f, s); put(SPH, q[0], h - w / 2, q[1], w, w, w, 0, 0, c, 2.5, al, true); };
    const K = (f, s, h, w, ht, c, e, ry, rx) => { const q = at(f, s); put(CONE4, q[0], h, q[1], w, ht, w, ry, rx || 0, c, (e || 0) + fl); };
    const out = (q, tilt) => [q - Math.PI / 2, tilt];
    // ground aura and rising embers
    put(TUBE, x, .3, y, R * 2 * (1 + pul * .06), 1.2, R * 2 * (1 + pul * .06), t * .3, 0, gc, 2, .28 + pul * .2, true);
    put(TUBE, x, .2, y, R * 1.5, 1, R * 1.5, -t * .5, 0, gc, 2, .14, true);
    for (let i = 0; i < (rg ? 16 : 9); i++) { const k = (t * .35 + i * .137) % 1, q = i * 2.4 + t * .6, d = R * (.4 + .7 * ((i * .37) % 1)); put(BOX, x + Math.cos(q) * d, k * 60, y + Math.sin(q) * d, 1.4, 1.4, 1.4, q * 3, k * 6, gc, 2.2 * (1 - k) + .3, 1 - k, true); }
    if (rg) put(SPH, x, -4, y, R * 1.7, R * 1.25, R * 1.7, 0, 0, '#ff1a1a', 2, .08 + .06 * pul, true);
    switch (a.ty) {
      case 'golem': { const cast = a.cd < .8, cr = st ? '#555a66' : rg ? '#ff6a6a' : '#9fe0ff', ce = st ? 0 : (cast ? 2.4 : 1 + .5 * pul);
        for (const s of [-8, -3.5, 3.5, 8]) { const q = at(12.2, s); put(BOX, q[0], 11 + Math.abs(s) * .3, q[1], .7, 15 - Math.abs(s) * .6, .7, ang + s * .05, 0, cr, ce, null); }
        for (const s of [-1, 1]) { const q = at(-1, s * 12.3); put(BOX, q[0], 13, q[1], 16, .7, .7, ang, 0, cr, ce * .8); }
        for (let i = 0; i < 6; i++) { const q = i * 1.05; K(9 + Math.cos(q) * 3.4, Math.sin(q) * 3.4, 40.5, 2.4, 5 + (i % 2) * 3, cr, ce, q, (Math.cos(q) * .3)); }
        for (const s of [-1, 1]) { G(13.2, s * 2.5, 37, 5.5, rg ? '#ff3030' : '#7df9ff', .3 + .2 * pul); for (let i = 0; i < 4; i++) K(-2 + i * 2.5, s * (24 + i % 2), 31 + (i % 2) * 2, 3, 7 + i, cr, ce * .9, i, s * .6); }
        for (let i = 0; i < 8; i++) { const q = i * .785 + .3; put(HQ ? ROCKS[i % 4] : SPH, x + Math.cos(q) * 20, -1, y + Math.sin(q) * 20, 6 + (i % 3) * 2, 3 + (i % 2) * 2, 6, q, 0, '#4a4f60', 0); }
        break; }
      case 'worm': { break; }
      case 'scorch': { const yy = 12 + Math.sin(t * 4) * 3;
        for (const s of [-1, 1]) { const q = at(9, s * 3.5); put(CONE4, q[0], yy + 7, q[1], 2.4, 9, 2.4, ang + Math.PI / 2, 1.0, '#3a1000', .4 + fl); E(13.4, s * 2.5, yy + 4.6, 1.6, '#ffffff', 3); G(13.4, s * 2.5, yy + 5.4, 4.5, '#fff3b0', .4); }
        for (let i = 0; i < 5; i++) { const k = (t * 2 + i * .2) % 1, q = at(-14 - k * 30, Math.sin(t * 8 + i) * 3 * k); put(SPH, q[0], yy + 2 + k * 4, q[1], 10 * (1 - k) + 2, 8 * (1 - k) + 2, 10 * (1 - k) + 2, 0, 0, i % 2 ? '#ffcf4a' : '#ff5020', 2.5, .55 * (1 - k), true); }
        put(SPH, x, yy - 4, y, 36, 20, 30, ang, 0, '#ff8a3a', 2.2, .06 + .05 * pul, true); break; }
      case 'kraken': { const T2 = typeof tgtP === 'function' ? tgtP(a) : S.p, la = Math.atan2(T2.y - y, T2.x - x), b = Math.sin(t * 2) * 2;
        for (let i = 0; i < 8; i++) { const q = i / 8 * 6.283 + .2; for (let j = 1; j < 7; j += 2) { const d = 15 + j * 5, wv = Math.sin(t * 3 + i + j * .7) * (2 + j), h = Math.sin(j / 5 * 2.6) * 16 + j * 1.5;
          put(SPHm, x + Math.cos(q) * d + Math.cos(q + 1.57) * wv, h + (8 - j * .8) * .85, y + Math.sin(q) * d * .8 + Math.sin(q + 1.57) * wv, 2.2, 2.2, 2.2, 0, 0, rg ? '#ff4060' : '#7df9ff', 1.2 + .8 * Math.sin(t * 5 + i + j)); } }
        for (let i = 0; i < 7; i++) { const q = la + Math.PI + (i - 3) * .32; put(CONE4, x + Math.cos(q) * 6, 40 + b - Math.abs(i - 3) * 2, y + Math.sin(q) * 6, 3, 9 - Math.abs(i - 3), 3, q - Math.PI / 2, .5, '#3a1a5a', .2 + fl); }
        for (const s of [-1, 1]) { const ex = x + Math.cos(la) * 15 - Math.sin(la) * s * 7, ey = y + Math.sin(la) * 15 + Math.cos(la) * s * 7; put(SPH, ex, 17 + b, ey, 12, 12, 12, 0, 0, rg ? '#ff3030' : '#ffe066', 2.5, .25 + .15 * pul, true); }
        for (let i = 0; i < 6; i++) { const q = t * .4 + i * 1.047, d = 46 + Math.sin(t + i) * 4; put(CONE4, x + Math.cos(q) * d, 6 + Math.sin(t * 1.3 + i) * 5, y + Math.sin(q) * d * .8, 3, 8, 3, q, Math.sin(t + i), '#e8f6ff', .5); }
        break; }
      case 'queen': { const hv = Math.sin(t * 3) * 1.5, c1 = rg ? '#ff2040' : '#e0405a', sw = Math.sin(t * 6) * .25;
        for (const s of [-1, 1]) { const q = at(15, s * 7); put(BOX, q[0], 14 + hv, q[1], 2, 12, 2, ang + s * .3, -s * (.5 + sw), '#3a0a14', fl); const q2 = at(19, s * 9); put(CONE4, q2[0], 22 + hv, q2[1], 2.6, 12, 2.6, ang + Math.PI / 2, -1.1 - sw, '#f2e6d0', .3 + fl); }
        for (let i = 0; i < 3; i++) { const q = at(-10 - i * 6, 0); put(TUBE, q[0], 7 + hv + i * .2, q[1], 25 - i * 4, 1.2, 27 - i * 4, ang, 0, rg ? '#ff3a3a' : '#ffcf4a', 1.4 + pul); }
        for (let i = 0; i < 7; i++) { const qa = i / 7 * 6.283; K(13 + Math.cos(qa) * 5, Math.sin(qa) * 5, 22 + hv, 2.4, 9 + (i % 2) * 4, '#ffcf4a', 1.2, qa, .25); }
        E(13, 0, 33 + hv, 2.6, rg ? '#ff2020' : '#7df9ff', 2.4); for (const s of [-1, 1]) G(16, s * 3.5, 18 + hv, 5, '#fff36b', .35 + .2 * pul);
        void c1; break; }
      case 'colossus': { const mg = 1.6 + (rg ? .6 : 0) + (a.pull > 0 ? .8 : 0);
        E(4, 0, 18, 7, '#ff8a2a', mg); G(4, 0, 21.5, 12, '#ff6a2a', .25 + .15 * pul);
        for (const s of [-1, 1]) { const q = at(8, s * 6); put(CONE4, q[0], 30, q[1], 4.5, 14, 4.5, ang + Math.PI / 2 * 0, s * .7, '#3a3640', .1 + fl); G(12, s * 4, 26.5, 6, '#fff3b0', .35); }
        for (let i = 0; i < 4; i++) { const k = (t * .8 + i * .25) % 1, q = at(Math.cos(i * 1.7) * 8, Math.sin(i * 1.7) * 8); put(SPHm, q[0], 14 - k * 14, q[1], 1.6, 2.4, 1.6, 0, 0, '#ff9a3d', 2); }
        for (let i = 0; i < 6; i++) { const q = i * 1.047 + .5; put(BOX, x + Math.cos(q) * 14, .4, y + Math.sin(q) * 14, 14, .5, 1.6, q, 0, '#ff7a2a', mg); }
        break; }
    }
  }
  function bossCore(a, ang, fl, t, x, y) {
    const ca = Math.cos(ang), sa = Math.sin(ang), at = (f, s) => [x + ca * f - sa * s, y + sa * f + ca * s];
    const P = (f, s, h, w, ht, d, c, e, ry) => { const q = at(f, s); put(SPH, q[0], h, q[1], w, ht, d, ry == null ? ang : ry, 0, c, (e || 0) + fl); };
    const Bx = (f, s, h, w, ht, d, c, e, ry) => { const q = at(f, s); put(BOX, q[0], h, q[1], w, ht, d, ry == null ? ang : ry, 0, c, (e || 0) + fl); };
    const Cn = (f, s, h, w, ht, c, e, ry) => { const q = at(f, s); put(CONE4, q[0], h, q[1], w, ht, w, ry == null ? ang : ry, 0, c, (e || 0) + fl); };
    const Cy = (f, s, h, w, ht, c, e) => { const q = at(f, s); put(CYL, q[0], h, q[1], w, ht, w, ang, 0, c, (e || 0) + fl); };
    const enr = a.ph2 ? .35 + .25 * Math.sin(t * 8) : 0, walk = Math.sin(t * 5 + x * .05);
    switch (a.ty) {
      case 'golem': { // crystal titan: heavy legs, glowing core, crystal back spikes, arms raise before a slam
        const cast = a.cd < .8, st = a.stun > 0, body = st ? '#8a8fa0' : '#56607a', dark = '#363d4f', cr = cast ? '#ffffff' : '#9fe0ff', ce = st ? 0 : (cast ? 2.2 : .9 + .4 * Math.sin(t * 3)) + enr;
        Bx(walk * 3, -6, 0, 9, 11, 9, dark); Bx(-walk * 3, 6, 0, 9, 11, 9, dark);
        Bx(0, 0, 10, 22, 8, 26, body); Bx(0, 0, 17, 24, 13, 30, body); Bx(1, 0, 29, 18, 6, 22, dark);
        P(10, 0, 18, 9, 9, 9, cr, ce); Bx(9, 0, 33, 9, 8, 10, body); Bx(13, -2.5, 36, 1.5, 2, 2, st ? '#555' : '#7df9ff', st ? 0 : 2); Bx(13, 2.5, 36, 1.5, 2, 2, st ? '#555' : '#7df9ff', st ? 0 : 2);
        const ah = cast ? 30 : 12; for (const s of [-1, 1]) { P(0, s * 19, 27, 13, 11, 13, body); Bx(2, s * 21, ah, 8, 15, 8, dark); P(3, s * 21, ah - 3, 11, 9, 11, body); Cn(0, s * 21, 34, 6, 12 + (cast ? 6 : 0), cr, ce * .7, ang + s); }
        [[-8, 0, 30, 16], [-11, -7, 27, 12], [-11, 7, 27, 12], [-5, -4, 33, 10], [-5, 5, 33, 9]].forEach(([f, s, h, l]) => Cn(f, s, h, 6, l, cr, ce * .8, ang + f));
        if (st) stunStars(x, y, 46); return;
      }
      case 'worm': { if (REAL && wormM()) { wormHD(a, ang, fl, t, x, y); return; } // segmented sandworm rising out of a burrow
        const cw = S.cin && S.cin.k === 'boss';
        if (a.hid && !cw) { for (let i = 0; i < 4; i++) { const k = i / 3; put(SPH, x - ca * k * 22 + Math.sin(t * 6 + i) * 2, -4 + (1 - k) * 2, y - sa * k * 22, 18 - k * 8, 8 - k * 3, 16 - k * 6, i, 0, S.L.bg[3], 0); } return; }
        const rise = cw ? 1 : a.st === 'up' ? clamp((4.5 - a.tm) * 4, 0, 1) : a.st === 'tele' ? .15 : 0, N = 9;
        put(CYL, x, -.6, y, 46, 1, 46, 0, 0, '#1a0c06', 0); for (let i = 0; i < 8; i++) { const q = i * .785; put(SPH, x + Math.cos(q) * 22, -3, y + Math.sin(q) * 22, 10, 6, 10, q, 0, S.L.bg[3], 0); }
        let hx = x, hy = y, hh = 0;
        for (let i = 0; i < N; i++) { const s = i / (N - 1), bend = s * s * 26, wob = Math.sin(t * 3 - s * 4) * 4 * s;
          const px = x + ca * bend - sa * wob, py = y + sa * bend + ca * wob, h = (s * 56 + Math.sin(s * 3.1) * 6) * rise - 10, r = (16 - s * 4) * (i === N - 1 ? 1.25 : 1);
          put(SPH, px, h, py, r * 1.5, r * 1.2, r * 1.5, ang, 0, i % 2 ? '#8a4a26' : '#b0602f', fl + enr * .5);
          if (i % 2 === 0 && i < N - 1) put(TUBE, px, h + r * .5, py, r * 1.55, 2, r * 1.55, ang, 0, '#5a2a12', fl);
          if (i > 0 && i < N - 1) for (const s2 of [-1, 1]) put(SPHm, px - sa * s2 * r * .72, h + r * .62, py + ca * s2 * r * .72, 2.6, 2.6, 2.6, 0, 0, a.ph2 ? '#ff3030' : '#ffcf4a', 1.4 + enr + .5 * Math.sin(t * 6 + i));
          hx = px; hy = py; hh = h; }
        put(CYL, hx, hh + 17, hy, 18, 2, 18, 0, 0, '#2a0a06', .2);
        for (let i = 0; i < 10; i++) { const q = i / 10 * 6.283 + t * .5; put(CONE4, hx + Math.cos(q) * 8, hh + 17, hy + Math.sin(q) * 8, 3, 6, 3, q, 0, '#f2e6d0', .2); }
        for (const s of [-1, 1]) put(BOX, hx + ca * 10 - sa * s * 6, hh + 12, hy + sa * 10 + ca * s * 6, 3, 3, 3, ang, 0, '#ffcf4a', 2);
        put(CYL, hx, hh + 16.2, hy, 13, 1, 13, 0, 0, '#ff4a1a', 1.8 + enr);
        for (let i = 0; i < 4; i++) { const q = i / 4 * 6.283 + .4 + Math.sin(t * 4) * .12; put(CONE4, hx + Math.cos(q) * 10, hh + 14, hy + Math.sin(q) * 10, 4.2, 18, 4.2, q - Math.PI / 2, .55 + Math.sin(t * 5) * .15, '#f2e6d0', .25 + fl); }
        return;
      }
      case 'scorch': { // flaming sun-manta
        const yy = 12 + Math.sin(t * 4) * 3, fw = Math.sin(t * 9) * .45, dash = a.dsh > 0;
        P(0, 0, yy, 22, 11, 16, '#ff8c3a', 1.2 + enr); P(3, 0, yy + 2, 11, 9, 10, '#fff3b0', 2); P(11, 0, yy + 1, 9, 8, 9, '#c0400a', .8);
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) Bx(-1 - k * 1.5, s * (9 + k * 5.5), yy + 4 + fw * k * 3.2, 13 - k * 2.4, 1.3, 6.5, ['#e05a1a', '#ff7a2a', '#ffa040', '#ffcf4a'][k], 1 + k * .25);
        for (let i = 0; i < 4; i++) { const q = at(-10 - i * 6, Math.sin(t * 10 + i) * 2); put(CONE4, q[0], yy + 2, q[1], 6 - i, 4, 6 - i, t * 5 + i, 0, i % 2 ? '#ffcf4a' : '#ff4020', 2); }
        for (let i = 0; i < 6; i++) { const q = i * 1.05 + t * 3; put(CONE4, x + Math.cos(q) * 9, yy + 9, y + Math.sin(q) * 9, 4, 7 + Math.sin(t * 20 + i) * 3, 4, q, 0, '#ffcf4a', 1.8); }
        Bx(13, -2.5, yy + 4, 1.5, 2, 2, '#000', 0); Bx(13, 2.5, yy + 4, 1.5, 2, 2, '#000', 0);
        if (dash) for (let i = 1; i < 5; i++) { const q = at(-i * 10, 0); put(SPH, q[0], yy, q[1], 18 - i * 3, 9 - i, 14 - i * 2, ang, 0, '#ff7a3d', 2, .5 - i * .1, true); }
        return;
      }
      case 'kraken': { // ice kraken bursting through a hole in Europa's ice
        const b = Math.sin(t * 2) * 2, T2 = typeof tgtP === 'function' ? tgtP(a) : S.p, la = Math.atan2(T2.y - y, T2.x - x);
        put(CYL, x, -.5, y, 64, 1, 50, 0, 0, '#0b2238', .3); put(TUBE, x, -1, y, 66, 3, 52, 0, 0, '#cfe9ff', .3);
        for (let i = 0; i < 9; i++) { const q = i * .7; put(CONE4, x + Math.cos(q) * 33, -1, y + Math.sin(q) * 26, 6, 7 + (i % 3) * 3, 6, q, 0, '#e8f6ff', .4); }
        for (let i = 0; i < 8; i++) { const q = i / 8 * 6.283 + .2; for (let j = 0; j < 7; j++) { const d = 15 + j * 5, wv = Math.sin(t * 3 + i + j * .7) * (2 + j), h = Math.sin(j / 5 * 2.6) * 16 + j * 1.5;
          put(SPH, x + Math.cos(q) * d + Math.cos(q + 1.57) * wv, h, y + Math.sin(q) * d * .8 + Math.sin(q + 1.57) * wv, 9 - j * .9, 8 - j * .8, 9 - j * .9, q, 0, j % 2 ? '#6a3a9a' : '#7a4ab0', fl + enr * .4); } }
        put(SPH, x, 4 + b, y, 30, 34, 28, la, 0, '#7a4ab0', fl + enr * .4); put(SPH, x - Math.cos(la) * 3, 26 + b, y - Math.sin(la) * 3, 24, 22, 22, la, 0, '#8d5ac4', fl);
        for (const s of [-1, 1]) { const ex = x + Math.cos(la) * 13 - Math.sin(la) * s * 7, ey = y + Math.sin(la) * 13 + Math.cos(la) * s * 7; put(SPH, ex, 20 + b, ey, 8, 8, 8, la, 0, '#ffe066', 1.6); put(SPH, ex + Math.cos(la) * 3, 22 + b, ey + Math.sin(la) * 3, 3.5, 4, 3.5, la, 0, '#111111', 0); }
        put(CONE4, x + Math.cos(la) * 14, 9 + b, y + Math.sin(la) * 14, 6, 6, 6, la, 0, '#3a1a5a', fl);
        return;
      }
      case 'queen': { // hive queen: crowned insect with big abdomen and wings
        const rg = a.rg, c1 = rg ? '#ff2040' : '#e0405a', c2 = rg ? '#a00020' : '#801830', e = rg ? .5 + enr : 0, hv = Math.sin(t * 3) * 1.5;
        P(-14, 0, 6 + hv, 30, 20, 24, c2, e); for (let i = 0; i < 3; i++) { const q = at(-8 - i * 7, 0); put(TUBE, q[0], 9 + hv, q[1], 20 - i * 3, 3, 22 - i * 3, ang, 0, '#3a0a14', fl); }
        P(2, 0, 9 + hv, 17, 15, 17, c1, e); P(13, 0, 12 + hv, 13, 12, 13, c1, e);
        for (let i = 0; i < 5; i++) Cn(13 + Math.cos(i * 1.26) * 4, Math.sin(i * 1.26) * 4, 23 + hv, 2.6, 6, '#ffcf4a', .8);
        for (const s of [-1, 1]) { Bx(18, s * 3, 13 + hv, 6, 1.5, 1.5, '#f2e6d0', .2, ang + s * .4); Bx(16, s * 3.5, 17 + hv, 2.4, 2.4, 2.4, '#fff36b', 2); }
        for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const f = 6 - i * 7, sw = Math.sin(t * 8 + i * 2 + (s > 0 ? 3 : 0)) * 3; Bx(f + sw, s * 13, 8, 2, 2, 12, '#3a0a14', fl, ang); Bx(f + sw, s * 20, 0, 2, 9, 2, '#3a0a14', fl); }
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const q = at(-6 - k * 2, s * (8 + k * 5)); put(BOX, q[0], 19 + hv + k * (2 + Math.sin(t * 25) * 1.5), q[1], 14 - k * 3, .8, 6, ang, 0, '#e8f4ff', .6, .3, true); }
        if (a.dsh > 0) for (let i = 1; i < 4; i++) { const q = at(-i * 12, 0); put(SPH, q[0], 6, q[1], 26 - i * 5, 14 - i * 2, 20 - i * 4, ang, 0, c1, 1, .35 - i * .08, true); }
        return;
      }
      case 'colossus': { // asteroid giant with magma cracks and orbiting rocks
        const st = '#6d6a78', mg = 1.4 + enr + (a.pull > 0 ? .8 : 0);
        [[0, 0, 10, 28], [-10, 6, 5, 16], [-9, -7, 6, 15], [-3, 0, 25, 20], [5, 4, 22, 12], [4, -5, 21, 11]].forEach(([f, s, h, w], i) => P(f, s, h - w * .45, w, w * .9, w, i % 2 ? '#5a5762' : st, 0, ang + i * 1.3));
        for (let i = 0; i < 7; i++) { const q = at(Math.cos(i * 1.9) * 9, Math.sin(i * 1.9) * 9); put(BOX, q[0], 6 + i * 3.4, q[1], 1.6, 7, 1.6, i, .3, '#ff9a3d', mg); }
        for (const s of [-1, 1]) { P(4, s * 20, 8 + walk * s * 2, 14, 13, 14, '#5a5762'); P(9, s * 21, 4, 9, 8, 9, st); }
        Bx(12, -4, 25, 3, 3, 3, '#fff3b0', 2.2); Bx(12, 4, 25, 3, 3, 3, '#fff3b0', 2.2);
        for (let i = 0; i < 5; i++) { const q = t * (a.pull > 0 ? 3 : 1) + i * 1.257, d = 34 + Math.sin(t + i) * 4; put(SPH, x + Math.cos(q) * d, 22 + Math.sin(q * 2) * 6, y + Math.sin(q) * d * .8, 6, 5, 6, q, 0, '#8a8796', .2); }
        if (a.pull > 0) { for (let i = 0; i < 2; i++) { const k = ((t * 1.4) + i * .5) % 1; put(TUBE, x, 1, y, (230 - k * 190) * 2, 5, (230 - k * 190) * 2, 0, 0, '#ff3a3a', 2, .45 * (1 - k) + .1, true); } }
        return;
      }
    }
  }
  function heading(o, def) {
    let m = memo.get(o); if (!m) { m = { x: o.x, y: o.y, a: def || 0 }; memo.set(o, m); }
    const dx = o.x - m.x, dy = o.y - m.y; if (dx * dx + dy * dy > .4) { const ta = Math.atan2(dy, dx); let d = ta - m.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; m.a += d * .35; m.x = o.x; m.y = o.y; }
    return m.a;
  }
  function suitOf() { try { return suit(); } catch (e) { return { b: '#f2f2f5', p: '#c9ccd6', v: '#2a6bd8' }; } }
  function rskin() { try { return (RSK.find(x => x.id === RSKIN && x.ok()) || RSK[0]); } catch (e) { return { b: '#b9bdc6', t: '#e3e6ec', s: '#8a3a2a' }; } }
  function pod(x, y, h, k) {
    const t = T(), fire = h > 2;
    put(CYL, x, h, y, 13, 1.6, 13, 0, 0, '#7a4a2a', fire ? .5 : 0); put(TUBE, x, h + .3, y, 13.4, 1, 13.4, 0, 0, '#3a2a20', 0);
    put(CONE, x, h + 1.6, y, 12.4, 12, 12.4, 0, 0, '#e9eef3', 0); put(TUBE, x, h + 5, y, 9.4, .8, 9.4, 0, 0, '#2a6bd8', .1); put(TUBE, x, h + 8.4, y, 6.4, .6, 6.4, 0, 0, '#ff7a3d', .1);
    put(CYLm, x, h + 12.4, y, 3, 2, 3, 0, 0, '#c9d2dc', 0); put(SPHm, x, h + 14.4, y, 1.2, 1.2, 1.2, 0, 0, Math.floor(t * 3) % 2 ? '#ff4040' : '#661010', 1.4);
    for (let i = 0; i < 3; i++) { const q = i * 2.09 + .5; box(x + Math.cos(q) * 4.3, y + Math.sin(q) * 4.3, h + 4.6, 1.6, 1.6, .4, '#9fd0ff', .9, q + Math.PI / 2); }
    if (!fire) for (let i = 0; i < 4; i++) { const q = i * Math.PI / 2 + .78; put(CYLm, x + Math.cos(q) * 6, 0, y + Math.sin(q) * 6, .7, h + 3, .7, 0, 0, '#9aa3ad', 0); put(CYLm, x + Math.cos(q) * 7, 0, y + Math.sin(q) * 7, 2.4, .5, 2.4, 0, 0, '#5d5966', 0); }
    if (fire) { put(CONE, x, h, y, 8, 12 + Math.random() * 8, 8, 0, Math.PI, '#ffcf4a', 2, .9, true); put(SPH, x, h - 4, y, 9, 6, 9, 0, 0, '#ff9a3d', 2, .5, true); }
    if (k === 'drop' && h > 50) { put(HEMI, x, h + 38, y, 36, 15, 36, 0, 0, '#ff7a3d', .5, .9, true); put(HEMI, x, h + 38.2, y, 30, 13, 30, 0, 0, '#ffffff', .4, .9, true); for (let i = 0; i < 6; i++) { const q = i * 1.047; beam(x + Math.cos(q) * 17, y + Math.sin(q) * 17, h + 38, x, y, h + 14, .3, '#dddddd', .2, null); } }
  }

  /* ---------- the frame ---------- */
  function frame() {
    if (R3.hold) return;   // a full-screen scene (like walking inside the outpost) covers the 3D view, so skip drawing it
    const cv = document.getElementById('c'), dpr = R3.q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    { const now = performance.now(); if (R3.lf) { const d = Math.min(200, now - R3.lf); R3.ft = (R3.ft || 16) * .95 + d * .05; } R3.lf = now;
      // adaptive resolution: drop the render scale when frames are slow, raise it back when there is headroom
      if (R3.rs == null) R3.rs = 1; if (S.run && !S.pz) { R3.slowC = R3.ft > 23 ? (R3.slowC || 0) + 1 : 0; R3.fastC = R3.ft < 15.5 ? (R3.fastC || 0) + 1 : 0;
        if (R3.slowC > 90 && R3.rs > .8) { R3.rs = Math.max(.8, R3.rs - .05); R3.slowC = 0; rectT = 0; }
        if (R3.fastC > 120 && R3.rs < 1) { R3.rs = Math.min(1, R3.rs + .05); R3.fastC = 0; rectT = 0; } }
      if (false && R3.qs === 'auto' && R3.q === 'high' && S.run && !S.pz) { if (R3.ft > 34) { if (++R3.slowN > 150) { R3.q = 'low'; rectT = 0; if (typeof say === 'function') say('Switched to faster 3D graphics for smoother play. You can change this in Settings.'); } } else R3.slowN = 0; } }
    if (--rectT <= 0 || c3.style.display === 'none') {
      rectT = 30; const r = cv.getBoundingClientRect(), st = cv.parentNode.getBoundingClientRect();
      c3.style.display = 'block'; c3.style.left = (r.left - st.left) + 'px'; c3.style.top = (r.top - st.top) + 'px'; c3.style.width = r.width + 'px'; c3.style.height = r.height + 'px';
      let pw = Math.round(r.width * dpr * (R3.rs || 1)), ph = Math.round(r.height * dpr * (R3.rs || 1)); const mx = R3.q === 'low' ? 650000 : 1600000; if (pw * ph > mx) { const k = Math.sqrt(mx / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
      if (c3.width !== pw || c3.height !== ph) { c3.width = pw; c3.height = ph; }
    }
    if (!document.body.classList.contains('v3d')) document.body.classList.add('v3d');
    const t = T(), L = S.L, lk = LOOK[S.lv] || LOOK[0];
    HDM = R3.hd && !!prog3; REAL = HDM && !!R3.real; if (HDM) terEnsure(); HQ = R3.q !== 'low' || HDM;
    if (staticLv !== S.lv + ':' + L.n + ':' + HQ + ':' + HDM + REAL + TERK + ':' + (R3.mv || 0)) { buildScenery(); last.bg = -9; }
    if (t - last.bg > 1.5 || t < last.bg) { upload(texBg, bg); last.bg = t; }
    if (t - last.fog > .2 || t < last.fog) { upload(texFog, FOG); last.fog = t; }

    // camera
    const fdt = Math.min(.05, Math.max(0, t - (R3.lt == null ? t : R3.lt))); R3.lt = t; FDT = fdt || .016;
    const C = S.cin, c0 = core();
    const ovr = !!(R3.photo || C || S.winT > 0 || (S.smo > 0 && S.kfoc) || (S.bint > 0 && S.bfoc) || S.land > 0 || S.over || !S.run);
    const cm = R3.cm = ovr ? 'top' : (R3.cam || 'top'); if (R3.lcm !== cm) { R3.ctr = R3.lcm == null ? 0 : .8; R3.lcm = cm; } R3.ctr = Math.max(0, (R3.ctr || 0) - fdt);
    const P0 = S.drive && S.rv ? S.rv : S.p;
    let eyeT, tgtT, fov = .78, near = 4, fx = 0, fz = -1;
    if (cm === 'top') {
    let tg = S.bint > 0 && S.bfoc ? S.bfoc : S.land > 0 && S.lp ? S.lp : S.drive && S.rv ? S.rv : S.mv ? { x: S.p.x + clamp(S.mv.x * .3, -40, 40), y: S.p.y + clamp(S.mv.y * .3, -30, 30) } : S.p, yT = R3.yaw, zT = R3.zoom, pT = .95, ys = .18, ts = .15, th = 0;
    if (R3.photo) { tg = R3.photo; pT = R3.pitch; ts = .3; }
    else if (C) { if (C.yaw0 == null) C.yaw0 = yawS; tg = C; yT = C.yaw0 + (C.orb || 0) * (C.t - C.dur / 2); zT = C.zoom || 1; pT = C.pit || .55; ys = .07; ts = .09;
      const u = clamp(C.t / C.dur, 0, 1), e = u * u * (3 - 2 * u);
      if (C.k === 'boss') { const sm = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }, L = (a, b, k) => a + (b - a) * k;
        if (u < .4) { const k = sm(u / .4); zT = L(.95, .7, k); pT = L(.09, .12, k); th = L(10, 18, k); }
        else if (u < .6) { const k = sm((u - .4) / .2); zT = L(.7, .38, k); pT = L(.12, .16, k); th = L(18, 40, k); ys = .1; }
        else { const k = sm((u - .6) / .4); zT = L(.38, .62, k); pT = L(.16, .26, k); th = L(40, 28, k); } }
      else if (C.k === 'phase') { const k = u < .3 ? u / .3 : 1, k2 = clamp((u - .3) / .7, 0, 1); zT = .76 - .24 * k * k + .12 * k2; pT = .1 + .08 * k2; th = 18 + 22 * k; }
      else if (C.k === 'meteor') { zT = 1.25; pT = .2 + .15 * e; th = 90 - 50 * e; }
      else if (C.k === 'supply') { th = Math.max(0, 260 * (1 - C.t / (C.dur * .8))) * .75; pT = .22; zT = .95; ts = .2; }
      else if (C.k === 'storm') { zT = 1.45; pT = .14 + .1 * e; th = 26; }
      else if (C.k === 'comms') { zT = .6; pT = .32; th = 18; } }
    else if (S.winT > 0 && c0) { tg = { x: c0.x + 16, y: c0.y + 16 }; R3.vy = (R3.vy == null ? yawS : R3.vy) + fdt * .5; yT = R3.vy; zT = .85; pT = .45; ys = .1; ts = .06; }
    else if (S.smo > 0 && S.kfoc) { tg = S.kfoc; zT = .55; pT = .55; ys = .1; ts = .12; }
    if (!(S.winT > 0)) R3.vy = null;
    TGT.x += (tg.x - TGT.x) * ts; TGT.y += (tg.y - TGT.y) * ts; if (Math.abs(tg.x - TGT.x) > 500 || Math.abs(tg.y - TGT.y) > 500) { TGT.x = tg.x; TGT.y = tg.y; }
    let dyaw = yT - yawS; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; yawS += dyaw * ys; zoomS += (zT - zoomS) * .12; pitS += (pT - pitS) * .12;
    const port = c3.height > c3.width, D = (port ? 300 : 215) * zoomS, pit = pitS, cy = Math.cos(yawS), sy = Math.sin(yawS);
    tgtT = [TGT.x, 6 + th, TGT.y]; eyeT = [tgtT[0] + sy * Math.cos(pit) * D, tgtT[1] + Math.sin(pit) * D, tgtT[2] + cy * Math.cos(pit) * D]; fx = -sy; fz = -cy;
    } else {
      if (S.lockOn && cm !== 'fp') { const lb = S.al.find(a => a.boss && a.hp > 0 && !a.hid); if (lb) { const dx = lb.x - S.p.x, dz = lb.y - S.p.y; if (Math.hypot(dx, dz) > 24) R3.yaw = Math.atan2(-dx, -dz); } else S.lockOn = false; }
      let dyaw = R3.yaw - yawS; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; yawS += dyaw * (cm === 'fp' ? .4 : S.lockOn ? .12 : .22);
      fx = -Math.sin(yawS); fz = -Math.cos(yawS); TGT.x = P0.x; TGT.y = P0.y; const lp = R3.lp;
      if (cm === 'fp') { const sp_ = S.mv ? Math.min(1, Math.hypot(S.mv.x, S.mv.y) / 60) : 0, bob = S.drive ? 0 : Math.sin((S.walk || 0) * 11) * .35 * sp_, hop = (S.L.lowg && S.pv && !S.drive) ? Math.min(1, Math.hypot(S.pv.x, S.pv.y) / 60) * Math.abs(Math.sin((S.walk || 0) * 5)) * 9 : 0, eh = (S.drive ? 16 : 11.8) + bob + hop, fo = S.drive ? 3 : 1.4;
        eyeT = [P0.x + fx * fo, eh, P0.y + fz * fo]; tgtT = [eyeT[0] + fx * 100 * Math.cos(lp), eh - Math.sin(lp) * 100, eyeT[2] + fz * 100 * Math.cos(lp)]; fov = 1.1; near = 1; }
      else if (cm === 'free') { const pit = clamp(.2 + lp * .9, -.08, 1.25), dd = (HDM ? 62 : 50) * R3.zoom; eyeT = [P0.x - fx * dd * Math.cos(pit), 10 + Math.sin(pit) * dd, P0.y - fz * dd * Math.cos(pit)]; tgtT = [P0.x, 10, P0.y]; fov = .95; near = 1.5; }
      else { const dd = (HDM ? 50 : 36) * R3.zoom; eyeT = [P0.x - fx * dd - fz * 5, 17 + dd * .1 + lp * 20, P0.y - fz * dd + fx * 5]; tgtT = [P0.x + fx * 16 - fz * 2.5, 7, P0.y + fz * 16 + fx * 2.5]; fov = .98; near = 1.5; }
    }
    if (HDM && TER) { const jz = S.drive ? (R3.air || 0) : (S.jz || 0); if (cm === 'top') { const ht = THc(tgtT[0], tgtT[2]); tgtT[1] += ht; eyeT[1] += ht; } else { const hp = THc(P0.x, P0.y); tgtT[1] += hp + jz * .9; eyeT[1] += hp + jz * (cm === 'fp' ? 1 : 1.05) + (S.glide ? 8 : 0); } const ge = THc(eyeT[0], eyeT[2]) + (cm === 'fp' ? 7 : 5); if (eyeT[1] < ge) eyeT[1] = ge; }
    if (!R3.CE || R3.ctr <= 0 || Math.hypot(eyeT[0] - R3.CE[0], eyeT[2] - R3.CE[2]) > 900) { R3.CE = eyeT.slice(); R3.CT = tgtT.slice(); }
    else { const k = 1 - Math.exp(-9 * Math.max(.008, fdt)); for (let i = 0; i < 3; i++) { R3.CE[i] += (eyeT[i] - R3.CE[i]) * k; R3.CT[i] += (tgtT[i] - R3.CT[i]) * k; } }
    R3.f2 = [fx, fz];
    const sh = S.shk > 0 && typeof SHK !== 'undefined' && SHK ? S.shk * (cm === 'fp' ? .25 : .6) : 0, jx = sh ? (Math.random() - .5) * sh : 0, jz = sh ? (Math.random() - .5) * sh : 0;
    const tgt = [R3.CT[0] + jx, R3.CT[1], R3.CT[2] + jz], eye = [R3.CE[0] + jx * .5, R3.CE[1], R3.CE[2] + jz * .5];
    EYE = eye; const asp = c3.width / c3.height, sy = -fx, cy = -fz;
    const V = look(eye, tgt, [0, 1, 0]), Pm = persp(fov, asp, near, 4000); VP = mul(Pm, V);
    const fz_ = nrm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), rx = nrm(cross(fz_, [0, 1, 0])), up = cross(rx, fz_);
    BAS = { f: fz_, r: rx, u: up, th: Math.tan(fov / 2), asp };
    R3.sky = () => { gl.useProgram(prog2); gl.disable(gl.DEPTH_TEST); gl.uniform3fv(U2.uF, fz_); gl.uniform3fv(U2.uR, rx); gl.uniform3fv(U2.uU, up); gl.uniform1f(U2.uTH, BAS.th); gl.uniform1f(U2.uAsp, asp);
      gl.bindBuffer(gl.ARRAY_BUFFER, qb); for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); gl.enableVertexAttribArray(U2.aQ); gl.vertexAttribPointer(U2.aQ, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(U2.aQ); gl.enable(gl.DEPTH_TEST); gl.useProgram(prog); };

    // lighting
    const ph = phase(), nt = L.nt; let dk = ph > nt ? .62 : ph > nt - .08 ? (ph - (nt - .08)) / .08 * .62 : ph < .05 ? (1 - ph / .05) * .62 * (S.sol > 1 ? 1 : 0) : 0; if (S.storm > 0) dk += .12; DKn = dk;
    const SK = SKY[S.lv] || SKY[0], sa = Math.PI * clamp(ph / nt, 0, 1), elev = ph < nt ? Math.sin(sa) : -.3, dayF = sm(-.05, .25, elev), setF = ph < nt ? 1 - sm(.05, .4, elev) : 0;
    const wall = S.lv === 1 || S.lv === 4, cinK = C && C.k === 'storm' ? clamp(C.t / C.dur, 0, 1) : 0, stormK = Math.max(S.storm > 0 ? Math.min(1, S.storm / 2, (14 - S.storm) / 1.5 + .4) : 0, cinK);
    const sunD = ph < nt ? nrm([Math.cos(sa) * .95, Math.max(.12, Math.sin(sa)), .38]) : nrm([-.35, .8, .45]);
    const sunCol = mix3(lk.sun, [1.1, .55, .28], setF * .7), sunK = Math.max(.12, (1 - dk * 1.35) * (.35 + .65 * dayF)) * (1 - stormK * (wall ? .45 : 0)), ambK = Math.max(.35, 1 - dk * .8);
    let stc = [1, 1, 1], fl = [0, 0, 0, 0];
    if (stormK > 0) {
      if (wall) stc = S.lv === 1 ? [1.08, .88, .72] : [1.05, .9, .7];
      else { const fc = [[1, .95, .7], [1, 1, 1], [1, .85, .6], [.7, .5, 1], [1, 1, 1], [.8, .9, 1], [.8, .5, 1]][S.lv]; fl = [fc[0], fc[1], fc[2], stormK * (.1 + .12 * Math.max(0, Math.sin(t * 7) * Math.sin(t * 2.3)))]; stc = [1 + .1 * fc[0], 1 + .1 * fc[1], 1 + .1 * fc[2]]; }
    }
    if (C && C.k === 'final') fl = [1, .1, .15, .12 + .1 * Math.sin(t * 6)];
    if (C && C.k === 'meteor') fl = [1, .55, .25, (typeof NOFL !== 'undefined' && NOFL ? .05 : .06 + .1 * Math.max(0, Math.sin(t * 5) * Math.sin(t * 1.7)))];
    let hor = mix3(mix3(SK.nh, SK.dh, dayF), SK.sh, setF * dayF * .9), zen = mix3(SK.nz, SK.dz, dayF);
    if (stormK > 0 && wall) { const dc = S.lv === 1 ? [.62, .42, .28] : [.5, .36, .18]; hor = mix3(hor, dc.map(v => v * (.4 + .6 * dayF)), stormK * .85); zen = mix3(zen, dc.map(v => v * (.3 + .5 * dayF)), stormK * .7); }
    const stars = Math.max(SK.st ? .9 : 0, 1 - dayF) * (stormK > 0 && wall ? 1 - stormK : 1) * (S.lv === 4 ? 0 : 1);
    const buildScene = () => { n = 0; tn = 0; OLN = 0; STL = []; const tj0 = performance.now(); scene(cm); weather(t, stormK, wall, C); R3.tjs = (R3.tjs || 0) * .9 + (performance.now() - tj0) * .1; R3.vn = n + tn;
      if (cm === 'fp' && !S.drive && S.land <= 0) { NOLIFT = true; try { heldGun(eye, fx, fz, R3.lp); } finally { NOLIFT = false; } } };
    let preS = false, shK = 0; R3.fn = (R3.fn || 0) + 1;
    if (shOn()) { try { buildScene(); preS = true; const span = clamp(170 * (R3.zoom || 1) * (cm === 'top' ? 1.25 : 1.1), 110, 420), snap = span * 2 / SH.size, cx = Math.round(tgt[0] / snap) * snap, cz = Math.round(tgt[2] / snap) * snap; shadowPass(sunD, [cx, HDM && TER ? THc(cx, cz) : 0, cz], span); shK = ph < nt ? clamp(elev * 4, 0, 1) : 0; } catch (e) { console.warn('shadow pass', e); SH.ok = false; } }
    gl.viewport(0, 0, c3.width, c3.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog2); gl.uniform3fv(U2.uZen, zen); gl.uniform3fv(U2.uHor, hor); gl.uniform3fv(U2.uSunD, sunD); gl.uniform3fv(U2.uSunC, ph < nt ? sunCol.map(v => v * (1 - stormK * .7)) : [0, 0, 0]); gl.uniform1f(U2.uStar, stars); gl.uniform1f(U2.uT, t); gl.uniform4fv(U2.uFl, fl); skyBodies(t);
    hdSky(); gl.disable(gl.BLEND); R3.sky();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.useProgram(prog); gl.uniformMatrix4fv(U.uM, false, new Float32Array(VP)); if (U.uShOn) gl.uniform1f(U.uShOn, preS && shK > .02 ? 1 : 0);
    hdU(L); gl.uniform2f(U.uW, WW, WH); gl.uniform3fv(U.uSun, sunD); gl.uniform3fv(U.uSunC, sunCol.map((v, i) => v * sunK * .78 * stc[i])); { const PS = S.lv === 0 ? [.03, .05, .1] : S.lv === 3 ? [.08, .06, .04] : null; gl.uniform3fv(U.uAmb, lk.amb.map((v, i) => v * ambK * (AIRW[S.lv] === 0 && HDM ? .7 : 1) * stc[i] * (1 - dk * .25) + (dk > .3 ? [.02, .03, .08][i] : 0) + (PS ? PS[i] * (.4 + dk) : 0))); }   /* Earthshine on the Moon, Jupitershine on Europa */
    GRH = mix3(hor, lk.haze, .25); gl.uniform3fv(U.uHaze, GRH); gl.uniform3fv(U.uCam, eye); gl.uniform1f(U.uHD, AIRW[S.lv] === 0 ? 1150 : 420 - (wall ? 260 : 120) * stormK);   /* v89: no air means no aerial perspective, so far hills stay as crisp as near ones (only the map edge fades) */ if (HDM) gl.uniform3f(U.uDark, .1, .08, .22); else gl.uniform3f(U.uDark, .024, .016, .047);
    const LT = lights(dk); for (let i = 0; i < 8; i++) { const l = LT[i]; gl.uniform4f(U.lp[i], l ? l[0] : 0, l ? l[1] : 0, l ? l[2] : 0, l ? l[3] : 0); gl.uniform3f(U.lc[i], l ? l[4] : 0, l ? l[5] : 0, l ? l[6] : 0); }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texBg); gl.uniform1i(U.uBg, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texFog); gl.uniform1i(U.uFog, 1);

    // decals (flat things drawn with the 2D sprite code onto the ground)
    const dcx = Math.round((cm === 'top' ? TGT.x - sy * 70 : P0.x + fx * 110) - DS / 2), dcy = Math.round((cm === 'top' ? TGT.y - cy * 70 : P0.y + fz * 110) - DS / 2);
    if (R3.q !== 'low' || R3.fn % 2 === 0 || R3.ldx == null) { decals(dcx, dcy); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDec); upload(texDec, DEC); R3.ldx = dcx; R3.ldy = dcy; }
    else { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDec); }
    gl.uniform1i(U.uDec, 2); gl.uniform4f(U.uDR, R3.ldx, R3.ldy, DS, DS);

    // static scenery
    gl.uniform1f(U.uG, 0); gl.bindBuffer(gl.ARRAY_BUFFER, sb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, staticN);
    // ground
    if (HDM) drawGround(); else { n = 0; put(BOX, WW / 2, -1, WH / 2, WW + 3600, 1, WH + 3600, 0, 0, '#ffffff', 0); gl.uniform1f(U.uG, 1); drawBuf(buf, n, vb); gl.uniform1f(U.uG, 0); }
    // dynamic objects
    if (!preS) buildScene();
    const dn_ = Math.min(n, OLN || n); drawBuf(buf, n, vb, preS ? 'reuse' : false); drawStatic(); if (HDM) outlines(dn_);
    if (tn) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE); drawBuf(tbuf, tn, vb); gl.depthMask(true); gl.disable(gl.BLEND); }
    try { vxDraw(Math.min(.05, FDT || .016)); } catch (e) { console.warn('vfx draw', e); }
    try { bloom(); } catch (e) { console.warn('bloom draw', e); BL.ok = false; }
    try { grade(); } catch (e) { console.warn('grade', e); R3.grade = false; }
    overlay(dk, cm);
  }

  /* ---------- the sky: real bodies with phases, and the Sun at its real relative size ---------- */
  const dirAE = (az, el) => [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
  const SUNF = [1, .66, 2.6, .19, .12, .36, 1];   // apparent size of the Sun vs. from Earth: Moon, Mars, Mercury, Europa, Titan, Ceres
  function skyBodies(t) { const lv = S.lv, f = Math.max(.16, SUNF[lv] || 1), z = [0, 0, 0, 0]; gl.uniform2f(U2.uSunK, Math.cos(.0707 * f), Math.cos(.0447 * f));
    let b1 = z, b2 = z, t1 = 0, t2 = 0;
    if (lv === 0) { b1 = [...dirAE(-1.32, .3), .034]; t1 = 1; }   // Earth hangs still, low over the horizon as seen from the south pole where Artemis will land, going through phases
    else if (lv === 1) { const ph = (t / 46) % 1, a = Math.PI * ph; b1 = [...nrm([-Math.cos(a), Math.sin(a) * .8 + .02, .32]), .0065]; t1 = 3; b2 = [...dirAE(.9, .75), .0026]; t2 = 4; }   // Phobos crosses the sky backwards, west to east; Deimos barely moves
    else if (lv === 3) { b1 = [...dirAE(-1.9, .3), .1]; t1 = 2; b2 = [...dirAE(-1.55, .4), .0045]; t2 = 4; }        // Jupiter fills 12° of Europa's sky; Io nearby
    gl.uniform4fv(U2.uB1, b1); gl.uniform4fv(U2.uB2, b2); gl.uniform2f(U2.uBt, t1, t2); }
  /* ---------- sun shadows (HD and Real views): depth from the Sun's point of view, packed into RGBA so it works on every WebGL1 device ---------- */
  const SH = { ok: null, size: 0 };
  function shInit() { if (SH.ok !== null) return SH.ok; try {
      const sh = (ty, src) => { const o = gl.createShader(ty); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec3 aP;uniform mat4 uL;void main(){gl_Position=uL*vec4(aP,1.);}'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvoid main(){vec4 e=fract(gl_FragCoord.z*vec4(1.,255.,65025.,16581375.));e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=e;}'));
      if (U.aP >= 0) gl.bindAttribLocation(p, U.aP, 'aP'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      SH.p = p; SH.uL = gl.getUniformLocation(p, 'uL'); SH.size = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), R3.q === 'low' ? 1024 : 2048);
      SH.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, SH.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SH.size, SH.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST)); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      SH.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, SH.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SH.size, SH.size);
      SH.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, SH.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, SH.tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, SH.rb);
      const okFb = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.activeTexture(gl.TEXTURE0);
      ['uSh', 'uLM', 'uShOn', 'uShT'].forEach(k => U[k] = gl.getUniformLocation(prog, k)); SH.ok = okFb; } catch (e) { console.warn('shadows', e); SH.ok = false; } return SH.ok; }
  const shOn = () => HDM && R3.shadows !== false && R3.q !== 'low' && shInit();
  function shadowPass(sunD, c, R) { const L = look([c[0] + sunD[0] * 900, c[1] + sunD[1] * 900, c[2] + sunD[2] * 900], c, [0, 1, 0]), n_ = 100, f_ = 1900;
    const O = [1 / R, 0, 0, 0, 0, 1 / R, 0, 0, 0, 0, -2 / (f_ - n_), 0, 0, 0, -(f_ + n_) / (f_ - n_), 1], M = mul(O, L);
    gl.bindFramebuffer(gl.FRAMEBUFFER, SH.fb); gl.viewport(0, 0, SH.size, SH.size); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.useProgram(SH.p); gl.uniformMatrix4fv(SH.uL, false, new Float32Array(M));
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    const one = (b, N) => { if (!N) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(U.aP); gl.vertexAttribPointer(U.aP, 3, gl.FLOAT, false, FL * 4, 0); gl.drawArrays(gl.TRIANGLES, 0, N); };
    one(sb, staticN); if (n) { drawBuf(buf, n, vb, true); } buildStatic(); one(bvb, bvN);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, c3.width, c3.height); gl.useProgram(prog); gl.enable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, SH.tex); gl.uniform1i(U.uSh, 4); gl.activeTexture(gl.TEXTURE0); gl.uniformMatrix4fv(U.uLM, false, new Float32Array(M)); gl.uniform1f(U.uShT, 1.1 / SH.size); return M; }
  function lights(dk) {
    const FLs = (R3.flashes || []).filter(f => (f.t += (FDT || .016)) < .45); R3.flashes = FLs;
    if (dk < .05 && !FLs.length) return [];
    const K = .2 + dk * 1.1, out = [], add = (x, y, h, r, c, k) => { const C = col(c); out.push([x, h + (HDM && TER ? THc(x, y) : 0), y, r, C[0] * K * (k || 1), C[1] * K * (k || 1), C[2] * K * (k || 1), Math.hypot(x - TGT.x, y - TGT.y)]); };
    if (FLs.length) { const fo = []; FLs.forEach(f => { const k = Math.pow(1 - f.t / .45, 2), C = col(f.c), h = 14 + (HDM && TER ? THc(f.x, f.z) : 0); fo.push([f.x, h, f.z, f.r, C[0] * 3.2 * k, C[1] * 2.6 * k, C[2] * 2 * k, 0]); }); if (dk < .05) return fo.slice(0, 4); out.push(...fo.slice(0, 2)); }   /* the blast lights up the ground and buildings around it */
    const c = core(); if (c) add(c.x + 16, c.y + 16, 34, 150, '#fff1d0', .8);
    if (S.cin && S.cin.k === 'boss') add(S.cin.x, S.cin.y, 50, 200, '#ff7070', 1.6);
    add(S.p.x + S.face.x * 10, S.p.y + S.face.y * 10, 16, 95, '#e8f4ff', 1);
    if (S.p2 && S.p2.x != null) add(S.p2.x, S.p2.y, 16, 80, '#e8f4ff', .8);
    if (S.drive && S.rv) add(S.rv.x + Math.cos(heading(S.rv, 0)) * 30, S.rv.y + Math.sin(heading(S.rv, 0)) * 30, 10, 110, '#fff3b0', 1.2);
    S.strikes.forEach(q => { if (q.t > 1.4) add(q.x, q.y, 30, 200, '#7df9ff', 2); });
    S.al.forEach(a => { if (a.boss && !a.hid) add(a.x, a.y, 26, 150, (a.ph2 || a.rg) ? '#ff3030' : (BCOL[a.ty] || '#ff8c3a'), 1.6); });
    S.hz.forEach(h => { if (h.k === 'fire') add(h.x, h.y, 6, 50, '#ff7a3d', 1); });
    const LC = { tesla: '#9fe8ff', o2: '#6fd8e8', farm: '#9dffb0', reactor: '#7df9ff', rtg: '#ff9a3d', medbay: '#ff9aa8', habitat: '#fff1d0', turret: '#ff6b6b', pylon: '#ffcf4a', battery: '#ffcf4a', solar: '#7fa8ff', drill: '#ffb070' };
    S.b.forEach(b => { if (b.t !== 'core' && !b.off && !b.nc && LC[b.t]) add(b.x + 8, b.y + 8, 18, 46, LC[b.t], .6); });
    const fixed = out.slice(0, 2), rest = out.slice(2).sort((a, b) => a[7] - b[7]);
    return fixed.concat(rest).slice(0, R3.q === 'low' ? 4 : 8);
  }

  function scene(cm) {
    const ST = R3.st = { a: n, ta: tn }; S.b.forEach(building); ST.bld = n - ST.a; if (HDM) { S.b.forEach(hdTierB); S.b.forEach(beacon); walkways(); }
    const SU = suitOf();
    if (S.land <= .55 && !S.drive && cm !== 'fp') { const sv = n; if (REAL) astroX(S.p.x, S.p.y, faceS(), S.walk || 0, SU, null, 1, 0, S.mv ? Math.min(1, Math.hypot(S.mv.x, S.mv.y) / 40) : 0, S.jz || 0, 1); else astro(S.p.x, S.p.y, Math.atan2(S.face.y, S.face.x), S.walk || 0, SU, null, 1); if (S.L.lowg && S.pv) { const hop = Math.min(1, Math.hypot(S.pv.x, S.pv.y) / 60) * Math.abs(Math.sin((S.walk || 0) * 5)) * 9; for (let i = sv; i < n; i++) buf[i * FL + 1] += hop; } if (S.jz) for (let i = sv; i < n; i++) buf[i * FL + 1] += S.jz; skRoll(sv); if (HDM && !REAL && S.glide) { const ang = Math.atan2(S.face.y, S.face.x), ca = Math.cos(ang), sa = Math.sin(ang), fl = Math.sin(T() * 6) * .04, hb = 11 + (S.jz || 0) - ca * 0 ; for (const q of [-1, 1]) { const px = -sa * q, pz = ca * q, bx = S.p.x - ca * 2, bz = S.p.y - sa * 2; put(BOX, bx + px * 7.6, hb, bz + pz * 7.6, 5.2, .35, 12.5, ang, q * (-.2 + fl), '#f4f7fb', .1); put(BOX, bx + px * 7.6 + ca * 2.4, hb + .15, bz + pz * 7.6 + sa * 2.4, .8, .4, 12.5, ang, q * (-.2 + fl), '#ff8a3d', .9); put(SPHm, bx + px * 13.6, hb - .8, bz + pz * 13.6, 1.1, 1.1, 1.1, 0, 0, '#7df9ff', 2); } } if (!REAL && S.emo && S.emo.k !== 'sit') { const hb = Math.abs(Math.sin((T() - S.emo.t0) * 7)) * 2.5; for (let i = sv; i < n; i++) buf[i * FL + 1] += hb; } }
    // low gravity: everyone on foot bounces the same way the player does (speed is measured from movement between frames)
    const lgHop = (o, sv) => { if (!S.L.lowg || !o) return; const now = performance.now(), lp = o._lp; let sp = 0; if (lp) { const dt_ = (now - lp[2]) / 1000; if (dt_ > .001 && dt_ < 1) sp = Math.hypot(o.x - lp[0], o.y - lp[1]) / dt_; } o._lsp = (o._lsp || 0) * .85 + Math.min(200, sp) * .15; o._lp = [o.x, o.y, now]; o._lw = (o._lw || 0) + Math.min(.05, FDT || .016) * Math.min(1, o._lsp / 45) * 2.2; const hop = Math.min(1, o._lsp / 45) * Math.abs(Math.sin(o._lw * 5)) * 9; if (hop > .05) for (let i = sv; i < n; i++) buf[i * FL + 1] += hop; };
    const b2 = S.p2; if (b2 && b2.x != null && !b2.drive) { let su2 = SU; try { su2 = SUITS.find(s => s.id === b2.suit) || SUITS[0]; } catch (e) {} const sv2 = n; (REAL ? astroX : astro)(b2.x, b2.y, heading(b2, b2.fx < 0 ? Math.PI : 0), b2.walk || 0, su2, '#6cc8ff', 1); lgHop(b2, sv2); }
    if (S.land <= .55) S.npc.forEach(nn => { let jc_ = '#ff9a3d'; try { jc_ = JOBS[nn.c.job].col; } catch (e) {} const svn = n; (REAL ? astroX : astro)(nn.x, nn.y, heading(nn, nn.f > 0 ? 0 : Math.PI), nn.walk || 0, { b: '#dfe1e8', p: '#b9bcc6', v: '#2a6bd8' }, jc_, .9); lgHop(nn, svn); });
    if (S.land <= .55) { const hh = S.hero; if (hh) { const svh = n; (REAL ? astroX : astro)(hh.x, hh.y, heading(hh, hh.f > 0 ? 0 : Math.PI), hh.walk || 0, { b: '#f2e2b0', p: '#c9a85a', v: '#ffb020' }, '#ffd23f', 1); lgHop(hh, svh); }
      const dg = S.dog, svd = n; if (dg && REAL) roboDog(dg); else if (dg) { const ang = heading(dg, dg.f > 0 ? 0 : Math.PI), ca = Math.cos(ang), sa = Math.sin(ang), at = (f, q) => [dg.x + ca * f - sa * q, dg.y + sa * f + ca * q], wk = Math.sin((dg.walk || 0) * 14) * .8, dig = dg.dig > 0 ? Math.sin(T() * 30) * .3 : 0; let p;
        for (const [f, q, ph] of [[2.5, 1.6, 1], [2.5, -1.6, -1], [-2.5, 1.6, -1], [-2.5, -1.6, 1]]) { p = at(f + wk * ph, q); box(p[0], p[1], 0, 1.2, 3, 1.2, '#7d8494', 0, ang); }
        box(dg.x, dg.y, 3, 7.5, 3.4, 4.2, '#c9ccd6', 0, ang, dig); p = at(4.6, 0); box(p[0], p[1], 5 - (dg.dig > 0 ? 2 : 0), 3.6, 3.2, 3.4, '#dfe1e8', 0, ang); p = at(6.6, 0); box(p[0], p[1], 5.6 - (dg.dig > 0 ? 2 : 0), 1, 1, 2.4, '#5fe08a', 1.6, ang); for (const q of [-.9, .9]) { p = at(6.2, q); box(p[0], p[1], 6.6 - (dg.dig > 0 ? 2 : 0), .7, .7, .7, '#7df9ff', 2.2, ang); } p = at(2.9, 0); box(p[0], p[1], 4.6, 1.1, 3.8, 4.6, '#ff3a3a', .4, ang); p = at(.6, 0); box(p[0], p[1], 6.4, .4, 5, .4, '#c9ccd6', 0, ang); put(SPH, p[0], 11.8, p[1], 1.4, 1.4, 1.4, 0, 0, '#ff3a6a', 2.2);
        for (const q of [-1, 1]) { p = at(4.2, q * 1.3); box(p[0], p[1], 8 - (dg.dig > 0 ? 2 : 0), .8, 2, .8, '#7d8494', 0, ang); } p = at(-4.4, 0); box(p[0], p[1], 5.4, 1, 1, 2.6, '#ff7a3d', .8, ang + Math.sin(T() * 12) * .5); }
      lgHop(dg, svd);
      const so = S.sto; if (so && so.k !== 'flicker') { const t = T(), pu = .6 + .4 * Math.sin(t * 3), x = so.x, y = so.y;
        if (so.k === 'crystal') { for (let i = 0; i < 6; i++) { const a = i * 1.05, r = i ? 5 : 0, h = i ? 9 + (i % 3) * 4 : 16; put(CONE, x + Math.cos(a) * r, 0, y + Math.sin(a) * r, 4, h, 4, a, (i ? .35 : 0), i % 2 ? '#c070ff' : '#8a3ad0', 1.2 * pu); } put(SPH, x, 6, y, 22, 14, 22, 0, 0, '#b070ff', 1.4, .22 * pu, true); }
        if (so.k === 'door') { put(CYL, x, 0, y, 38, 1.4, 38, 0, 0, '#4a3a32', 0); put(CYL, x, 1.2, y, 30, .6, 30, 0, 0, '#2a1e1a', 0); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; put(SPH, x + Math.cos(a) * 11, 1.6, y + Math.sin(a) * 11, 3, 1.2, 3, 0, 0, '#d070ff', 1.8 * pu); } put(SPH, x, 1.8, y, 6, 1.6, 6, 0, 0, '#d070ff', 2 * pu); }
        if (so.k === 'eye') { put(CYL, x, .2, y, 92, .5, 36, 0, 0, '#2a1410', 0); put(CYL, x, .5, y, 26, .5, 26, 0, 0, '#ff4a1a', 1.6 * pu); put(CYL, x, .8, y, 7, .5, 20, 0, 0, '#000000', 0); }
        if (so.k === 'shadow') { const sx = x + Math.sin(t * .25) * 60; for (let i = 0; i < 9; i++) { const a = i * .7; box(sx + Math.cos(a) * 70, y + Math.sin(a) * 30, .2, 60, .4, 1.6, '#7df9ff', 1.6 * pu, a); } put(CYL, sx, .4, y, 180, .4, 76, Math.sin(t * .2) * .3, 0, '#050a1e', 0, .5, true); put(CYL, sx - 70, .5, y + 10, 80, .4, 28, 0, 0, '#050a1e', 0, .35, true); }
        if (so.k === 'song') { for (let i = 0; i < 3; i++) { const r = ((t * 14 + i * 14) % 42) * 2 + 8; put(CYL, x, .4, y, r, .3, r, 0, 0, '#b070ff', 1.5, Math.max(0, 1 - r / 92) * .7, true); } }
        if (!so.sc) put(SPH, x, 24 + Math.sin(t * 3) * 2, y, 3, 3, 3, 0, 0, '#d070ff', 2.2); }
      const gd = S.gd; if (gd) { const B = (typeof BOSS !== 'undefined' && BOSS[gd.ty]) || {}; const sv = n, st0 = tn, K = .4; try { alien({ ty: gd.ty, x: gd.x, y: gd.y, r: B.r || 30, boss: 1, hp: 1, mh: 1, fl: 0, stun: 0, f: gd.f, face: gd.f, rise: 0 }); } catch (e) { box(gd.x, gd.y, 0, 10, 12, 10, '#7df9ff', .6, 0); }
        for (let i = sv; i < n; i++) { const o = i * FL; buf[o] = gd.x + (buf[o] - gd.x) * K; buf[o + 1] *= K; buf[o + 2] = gd.y + (buf[o + 2] - gd.y) * K; } for (let i = st0; i < tn; i++) { const o = i * FL; tbuf[o] = gd.x + (tbuf[o] - gd.x) * K; tbuf[o + 1] *= K; tbuf[o + 2] = gd.y + (tbuf[o + 2] - gd.y) * K; } } }
    if (S.rv) { const svr = n, ha = heading(S.rv, S.rv.f < 0 ? Math.PI : 0), RM = REAL && mdl('rover'); if (RM) { if (S.drive || !TER) drawModel(RM, S.rv.x, 0, S.rv.y, 8.6, ha + Math.PI / 2, 0); else cached(S.rv, 'rv' + Math.round(S.rv.x) + ':' + Math.round(S.rv.y) + ':' + ha.toFixed(2), () => { const s0 = n; drawModel(RM, S.rv.x, 0, S.rv.y, 8.6, ha + Math.PI / 2, 0); tiltR(s0, n, S.rv.x, S.rv.y, 16, 0); }); if (S.drive) { const ca = Math.cos(ha), sa = Math.sin(ha); put(SPHm, S.rv.x + ca * 9, 9, S.rv.y + sa * 9, 1.4, 1.4, 1.4, 0, 0, '#fff3b0', 2.2); } } else rover(S.rv, ha, rskin()); if (HDM && TER) rvPhys(svr, S.rv); }
    ST.crew = n - ST.a - ST.bld; const nAl = n, tAl = tn; S.al.forEach(a => { const sva = n; alien(a); const skc = a.boss && skCfg(a); if (HDM && a.boss && !a.hid && a.ty !== 'worm' && !skc) { bossAura(a); bossHD(a, heading(a, 0)); } if (a.boss && !a.hid && a.ty !== 'worm' && a.ph && !skc) bossPh(a); if (HDM && TER && !a.boss && a.ty !== 'fly' && !a.echo && !a.gate && !a.hid) tiltR(sva, n, a.x, a.y, 8); }); if (HDM && TER) { grass(); motes(); }
    ST.al = n - nAl; ST.alT = tn - tAl; S.allies.forEach(a => { if (!a.freed && REAL && mdl('robo')) { astroX(a.x, a.y, heading(a, a.face > 0 ? 0 : Math.PI), a.walk || 0, null, null, 1.3, 0, 1, 0, 0, 'robo'); return; } if (a.freed) { try { alien({ ty: 'grunt', x: a.x, y: a.y, r: 8, hp: 1, mh: 1, fl: 0, stun: 0, rise: 0, f: a.face, face: a.face, walk: a.walk || 0, sp: 1 }); } catch (e) {} return; } const ang = heading(a, a.face > 0 ? 0 : Math.PI), ca = Math.cos(ang), sa = Math.sin(ang), at = (f, q) => [a.x + ca * f - sa * q, a.y + sa * f + ca * q], w = Math.sin(T() * 9 + a.x) * .5; let p;
      for (const q of [-1, 1]) { p = at(Math.sin(w * q) * 1.5, q * 2); box(p[0], p[1], 0, 2.4, 6, 2.4, '#5a6170', 0, ang); box(p[0], p[1], 0, 3.4, 1.2, 3, '#3a3f4c', 0, ang); }
      box(a.x, a.y, 5.6, 6, 6.6, 7.4, '#8a93a6', 0, ang); p = at(3.1, 0); box(p[0], p[1], 7.4, .5, 3, 4, '#2a2833', 0, ang); box(p[0], p[1], 8.6, .6, .8, 2.6, '#5fe08a', 1.4, ang);
      put(SPH, a.x, 12, a.y, 5.4, 4.6, 5.4, ang, 0, '#c9d2dc', 0); p = at(2.1, 0); box(p[0], p[1], 13.4, 1.4, 1.4, 4, '#7df9ff', 1.6, ang);
      p = at(1, 4.8); box(p[0], p[1], 7.4, 6, 2.2, 2.2, '#5a6170', 0, ang); p = at(4.2, 4.8); put(SPHm, p[0], 8.5, p[1], 1, 1, 1, 0, 0, '#7df9ff', 2);
      p = at(1, -4.8); box(p[0], p[1], 6.6, 2, 4, 2, '#5a6170', 0, ang); p = at(-1, -1.5); put(CYLm, p[0], 16.4, p[1], .3, 4, .3, 0, 0, '#cccccc', 0); put(SPHm, p[0], 20.4, p[1], 1, 1, 1, 0, 0, Math.floor(T() * 3) % 2 ? '#ff7a3d' : '#7a3010', 1.2); });
    OLN = n;
    if (REAL && S.drone && S.dr && S.dr.x != null && mdl('heli')) { const D = S.dr; drawModel(mdl('heli'), D.x, 12 + Math.sin(T() * 3) * 1.2, D.y + 4, 14, T() * .4, 0); const rs = T() * 40; for (const k of [0, 1]) put(BOX, D.x, 19.6 + k * .9 + Math.sin(T() * 3) * 1.2, D.y + 4, 15, .15, 1.1, rs * (k ? -1 : 1), 0, '#2a2833', 0, .45, true); } else if (S.drone && S.dr && S.dr.x != null) { const D = S.dr, dy = D.y + 4, hh = 14 + Math.sin(T() * 3) * 1.2, sp = T() * 40;
      put(SPH, D.x, hh, dy, 6, 3, 6, 0, 0, '#c9d2dc', 0); put(SPHm, D.x, hh - 1, dy + 2.4, 1.4, 1.4, 1.4, 0, 0, '#2a2833', 0);
      for (let i = 0; i < 4; i++) { const q = i * Math.PI / 2 + .78, rx = D.x + Math.cos(q) * 6, rz = dy + Math.sin(q) * 6; box(D.x + Math.cos(q) * 3, dy + Math.sin(q) * 3, hh + 1.2, 6, .6, .8, '#5d5966', 0, q); put(CYLm, rx, hh + 1, rz, 1.4, 1.4, 1.4, 0, 0, '#3a3a44', 0); put(CYLm, rx, hh + 2.4, rz, 6, .15, 6, 0, 0, '#dddddd', .2, .35, true); box(rx, rz, hh + 2.45, 6, .2, .6, '#eeeeee', .2, sp + i); }
      put(SPHm, D.x, hh + 3, dy, 1, 1, 1, 0, 0, '#5fe08a', 1.6); }
    S.rocks.forEach(r => {
      if (r.met) { put(HQ ? ROCKS[Math.floor(r.x) % 4] : SPH, r.x, 0, r.y, 12, 8, 11, r.x, 0, '#2a2420', 0); for (let i = 0; i < 4; i++) box(r.x + Math.cos(i * 1.6 + r.x) * 3, r.y + Math.sin(i * 1.6 + r.x) * 3, 3 + (i % 2) * 2, 4, .6, .6, '#ff7a2a', 1.4 + .6 * Math.sin(T() * 5 + i), i * 1.6 + r.x); put(SPH, r.x, 0, r.y, 18, 6, 18, 0, 0, '#ff6a2a', 1.4, .18 + .08 * Math.sin(T() * 4), true); }
      else if (r.sup) { box(r.x, r.y, 0, 12, 9.5, 12, '#e9eef3', 0); for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(r.x + a * 5.6, r.y + c * 5.6, 0, 1.4, 10, 1.4, '#9aa3ad', 0); box(r.x, r.y, 3.6, 12.4, 2.4, 12.4, '#2a6bd8', .1); box(r.x, r.y, 9.5, 8, 1, 8, '#c9d2dc', 0); box(r.x, r.y + 6.1, 5.6, 3, 3, .3, '#3fbf5a', .4);
        put(SPHm, r.x, 10.6, r.y, 1.8, 1.8, 1.8, 0, 0, Math.floor(T() * 3) % 2 ? '#ffffff' : '#3fbf5a', 1.4); put(CYLm, r.x, 0, r.y, 1.2, 160, 1.2, 0, 0, '#5fe08a', 2, .12 + .06 * Math.sin(T() * 4), true); }
      else if (r.c) { box(r.x, r.y, 0, 10, 7, 9, '#7a4a14', 0, r.x); put(CYL, r.x, 5.2, r.y, 10, 3, 9, r.x, 0, '#9a5a10', 0); for (const q of [-3, 3]) box(r.x + Math.cos(r.x) * q, r.y + Math.sin(r.x) * q, 0, 1.2, 8.4, 9.4, '#ffcf4a', .4, r.x); box(r.x, r.y, 4.4, 2, 2.4, 9.6, '#ffe066', .8, r.x); }
      else { put(HQ ? ROCKS[Math.floor(r.x) % 4] : SPH, r.x, 0, r.y, 11, 7, 9, r.x * 1.7, 0, '#6d707a', 0);
        for (let i = 0; i < 4; i++) { const q = r.x * .7 + i * 1.7; put(CONE4, r.x + Math.cos(q) * 2.4, 3.6, r.y + Math.sin(q) * 2.4, 2.2 - i * .3, 5 - i * .6, 2.2 - i * .3, q, (i - 1.5) * .35, i % 2 ? '#d8e2ea' : '#9fd6ff', .55 + .2 * Math.sin(T() * 3 + i)); } }
    });
    S.bul.forEach(b => { const a = Math.atan2(b.vy || 0, b.vx || 1), z = b.pi ? 1.5 : 1, hb = 5.2 + (b.h0 || 0) * clamp(b.l / .7, 0, 1); if (HDM) { const ca_ = Math.cos(a), sa_ = Math.sin(a); put(SPHm, b.x - ca_ * 7, hb - .5 * z, b.y - sa_ * 7, 15 * z, 1.3 * z, 1.3 * z, a, 0, '#ffffff', 3.2); put(SPHm, b.x - ca_ * 8, hb - 1.6 * z, b.y - sa_ * 8, 19 * z, 3.4 * z, 3.4 * z, a, 0, b.col, 2.6, .5, true); put(SPHm, b.x, hb - 2.4 * z, b.y, 5 * z, 5 * z, 5 * z, 0, 0, b.col, 2.4, .3, true); return; } box(b.x - Math.cos(a) * 3, b.y - Math.sin(a) * 3, hb, 7 * z, 1.6 * z, 1.6 * z, b.col, 2.4, a); put(SPHm, b.x, hb - .6, b.y, 4 * z, 4 * z, 4 * z, 0, 0, b.col, 2.2, .35, true); });
    const nEb = n, tEb = tn; if (!VX.prog) S.eb.forEach(e => { put(SPH, e.x, 3, e.y, 5, 5, 5, T() * 6, 0, e.c || '#d8ff6a', 1.6); put(SPHm, e.x, 1.6, e.y, 9, 8, 9, 0, 0, e.c || '#d8ff6a', 1.8, .25, true); });
    ST.eb = n - nEb + (tn - tEb); const nPt = n; S.beams.forEach(b => beam(b.x, b.y, 9, b.x2, b.y2, 6, 1.4, b.c, 2.2));
    (S.gib || []).forEach(g => box(g.x, g.y, g.h, g.s, g.s, g.s, g.c, .15, g.r, g.r * .7));
    S.pt.forEach(q => { const k = clamp(q.l / q.ml, 0, 1), s = q.s * (.4 + .6 * k); box(q.x, q.y, 3 + (1 - k) * 6 + (q.h || 0), s, s, s, q.c, 1.4); });
    ST.pt = n - nPt; S.pods.forEach(q => pod(q.x, q.y, q.h, q.k));
    const LMm = REAL && mdl('lm'); if (S.lp && LMm) { const lh = S.land > 1.05 ? (S.land - 1.05) / 1.35 * 240 : 0; if (lh > 0) drawModel(LMm, S.lp.x + 18, lh, S.lp.y - 14, 4.4, .4, 0); else cached(S.lp, 'lm', () => drawModel(LMm, S.lp.x + 18, 0, S.lp.y - 14, 4.4, .4, 0)); if (lh > 2) { put(CONE, S.lp.x + 18, lh - 14, S.lp.y - 14, 7, 14, 7, 0, Math.PI, '#ffcf4a', 3, .85, true); put(SPHm, S.lp.x + 18, lh - 18, S.lp.y - 14, 12, 12, 12, 0, 0, '#ff7a3d', 2.4, .4, true); } } else if (S.lp && S.land > 1.05) pod(S.lp.x, S.lp.y, (S.land - 1.05) / 1.35 * 240, 'land'); else if (S.lp && S.land <= 1.05) pod(S.lp.x, S.lp.y, 0, 'land-done');
    if (S.flag) { const f = S.flag; cyl(f.x, f.y, 0, 1, f.h, '#dddddd'); if (f.h > 9) for (let i = 0; i < 6; i++) box(f.x + 1.5 + i * 2, f.y + Math.sin(T() * 8 + i) * 1.2, f.h - 8, 2, 8, .8, i >= 2 && i <= 4 ? '#3fbf5a' : '#2a6bd8', .1); }
    S.strikes.forEach(q => { if (q.t < 1.4) { put(CYL, q.x, 0, q.y, 2, 400, 2, 0, 0, '#7df9ff', 2, .25 + .2 * Math.sin(T() * 30), true); return; } const k = 1 - (q.t - 1.4) / .7, w = 26 * k + 2; put(CYL, q.x, 0, q.y, w * 2, 500, w * 2, 0, 0, '#7df9ff', 2, .35 * k, true); put(CYL, q.x, 0, q.y, w * .7, 500, w * .7, 0, 0, '#ffffff', 3, .9 * k, true); });
    if (S.dome > 0) { const c = core(); if (c) put(HEMI, c.x + 16, 0, c.y + 16, 172, 70, 172, 0, 0, '#9fd8ff', .8, .13 + .04 * Math.sin(T() * 4), true); }
    S.devils.forEach(d => { for (let i = 0; i < 4; i++) put(CONE, d.x, 30 - i * 7, d.y, 16 - i * 3, -8, 16 - i * 3, T() * 6 + i, 0, '#dca064', .2, .22, true); });
    S.portals.forEach(q => { const k = clamp(1 - q.t / 1.3, 0, 1); put(CYL, q.x, 0, q.y, 24 * k + 6, 22 * k + 2, 10 * k + 3, 0, 0, '#b05aff', 1.6, .35, true); });
    // build preview
    if (typeof ghost === 'function' && S.run && typeof sel !== 'undefined' && sel) { const g = ghost(); if (g) { const sv = n; building({ t: sel, x: g.x, y: g.y, w: 16, lv: 1, a: -1.57, pop: null, ghost: 1 }); for (let i = sv; i < n; i++) { buf[i * FL + 9] = .5; } moveToT(sv); } }
  }
  function weather(t, k, wall, C) {
    const tr = (P, x, y, z, sx, sy, sz, ry, c, e, a) => put(P, x, y, z, sx, sy, sz, ry, 0, c, e, a, true);
    // falling meteors (from meteor-shower danger circles)
    const MD = nrm([170, 300, -50]), MRX = Math.acos(MD[1]), MRY = Math.atan2(-MD[0], MD[2]);
    const met = (x, y, k2, big, sd) => { if (k2 <= 0 || k2 > 1) return; sd = sd || 0; const px = x + k2 * 170, ph = 6 + k2 * 300, pz = y - k2 * 50, s = big ? 17 : 7 + (sd % 3) * 1.5, m = big ? 1.6 : 1, cy = ph - s / 2;
      put(HQ ? ROCKS[sd % 4] : SPH, px, cy - s * .45, pz, s, s * .9, s, t * 4 + sd, t * 3 + sd, '#3a2a22', .7);
      tr(SPHm, px, cy - s * .9, pz, s * 1.8, s * 1.8, s * 1.8, 0, '#ff6a2a', 2.3, .45); tr(SPHm, px, cy - s * .65, pz, s * 1.3, s * 1.3, s * 1.3, 0, '#fff3b0', 2.8, .6);
      const fk = .85 + .15 * Math.sin(t * 30 + sd);
      put(CONE, px, cy, pz, s * 1.7, 150 * m, s * 1.7, MRY, MRX, '#3a3230', 0, .18, true);
      put(CONE, px, cy, pz, s * 1.5, 80 * m * fk, s * 1.5, MRY, MRX, '#ff5a1a', 2.4, .4, true);
      put(CONE, px, cy, pz, s * .95, 46 * m * fk, s * .95, MRY, MRX, '#ffd070', 2.8, .6, true);
      put(CONE, px, cy, pz, s * .5, 24 * m, s * .5, MRY, MRX, '#ffffff', 3, .75, true); };
    if (S.swall && S.swall.k === 'wall') { const w = S.swall, k = w.t / 12, wx = w.d > 0 ? -400 + k * (WW + 800) : WW + 400 - k * (WW + 800), wc = S.lv === 6 ? '#b070ff' : S.lv === 4 ? '#c89048' : '#c0703c'; for (let i = 0; i < 3; i++) tr(BOX, wx - i * 40 * w.d, 0, WH / 2, 70, 90 + i * 40, WH + 600, 0, wc, .2, .3 - i * .07); }
    if (S.fin) { const gx = WW / 2, gz = -230, gy = 300, GR = 170, t9 = T(); put(CYL, gx, gy, gz, GR * 2.2, 6, GR * 2.2, t9 * .4, Math.PI / 2, '#b070ff', 1.7, .6, true); put(CYL, gx, gy, gz + 4, GR * 1.7, 5, GR * 1.7, -t9 * .7, Math.PI / 2, '#7df9ff', 1.7, .4, true);
      put(SPH, gx, gy, gz, GR * 1.5, GR * 1.5, 30, 0, 0, '#05000a', 0); put(SPH, gx, gy, gz, GR * 3.2, GR * 3.2, 40, 0, 0, '#9a40ff', 1.3, .18, true);
      for (let i = 0; i < 24; i++) { const a9 = i / 24 * 6.283 + t9 * .3, on9 = (Math.floor(t9 * 3) + i) % 6 === 0; box(gx + Math.cos(a9) * GR * 1.3, gz, gy + Math.sin(a9) * GR * 1.3, 10, 22, 10, on9 ? '#ffffff' : '#5a2a8a', on9 ? 2 : .5, 0, 0); } }
    S.hz.forEach((h, hi) => { if (h.fx === 'met' && h.t > 0 && h.t < h.t0) met(h.x, h.y, h.t / h.t0, h.big, hi);
      if (h.fx === 'met' && h.t > 0 && h.t < .25) tr(CYL, h.x, 0, h.y, h.r * 2.4 * (1 - h.t * 3), .6, h.r * 2.4 * (1 - h.t * 3), 0, '#ffb070', 2.5, .5);
      if (h.k === 'beam' && h.t <= 0) { const L = h.len; tr(BOX, h.x + Math.cos(h.a) * L / 2, 1, h.y + Math.sin(h.a) * L / 2, L, 12, h.w * .9, h.a, h.c, 2.5, .45); tr(BOX, h.x + Math.cos(h.a) * L / 2, 3, h.y + Math.sin(h.a) * L / 2, L, 6, h.w * .35, h.a, '#ffffff', 3, .8); }
      if ((h.k === 'cone' || h.k === 'donut') && h.fl != null) { const R = h.k === 'cone' ? h.r : h.r2; tr(TUBE, h.x, 0, h.y, R * 2 * (1.2 - h.fl), 8, R * 2 * (1.2 - h.fl), 0, '#ffb070', 2, h.fl * 1.5); } });
    if (C && C.k === 'meteor') for (let i = 0; i < 18; i++) { const k2 = 1 - ((C.t * (1 + (i % 4) * .15) + i * .19) % 1.25) / 1.25; met(C.x + Math.cos(i * 2.4) * (90 + (i % 5) * 30), C.y + Math.sin(i * 2.4) * (70 + (i % 3) * 25), k2, i % 6 === 0, i); }
    // shooting stars on airless worlds at night
    if (SKY[S.lv].st || night()) for (let j = 0; j < 2; j++) { const cyc = Math.floor(t / 4.3 + j * .5), u = (t / 4.3 + j * .5) - cyc; if (hsh(cyc * 7 + j) > .45 && u < .25) { const a = hsh(cyc) * 6.28, cx = TGT.x + Math.cos(a) * 700, cz = TGT.y - 900 + Math.sin(a) * 200, q = u / .25; for (let i = 0; i < 5; i++) tr(BOX, cx + (q * 260) - i * 9, 520 - q * 120 + i * 4, cz, 7, 2, 2, -.43, '#ffffff', 3, (1 - q) * (.9 - i * .15)); } }
    // storms
    if (k > 0) {
      if (wall) { const dc = S.lv === 1 ? '#c8905a' : '#b88a50';
        for (let i = 0, nD = R3.q === 'low' ? 28 : 70; i < nD; i++) { const ox = (hsh(i) * 700 + t * (110 + hsh(i + 9) * 80)) % 700 - 350, oz = hsh(i + 3) * 500 - 250, hh = 2 + hsh(i + 5) * 60, s = 3 + hsh(i + 7) * 7; tr(BOX, TGT.x + ox, hh, TGT.y + oz, s * 2.5, s, s, .2, dc, .15, .22 * k); }
        if (C && C.k === 'storm') { const R = 1000 - 760 * clamp(C.t / C.dur, 0, 1); for (let i = 0; i < 3; i++) tr(TUBE, C.x, 0, C.y, (R + i * 40) * 2, 140 - i * 30, (R + i * 40) * 2, t * .3 + i, dc, .2, .5 - i * .12); }
      } else { const rc = ['#fff3b0', '#ffffff', '#ffcf4a', '#c9a8ff', '#ffffff', '#cfe0ff', '#e0b0ff'][S.lv];
        for (let i = 0; i < 26; i++) { const q = (t * 1.6 + hsh(i)) % 1, ox = hsh(i + 1) * 520 - 260, oz = hsh(i + 2) * 420 - 210; tr(BOX, TGT.x + ox, 260 * (1 - q), TGT.y + oz, .8, 30, .8, 0, rc, 2.5, .3 * k * (1 - q)); }
        if (C && C.k === 'storm') tr(SPH, C.x, 120, C.y - 600, 260, 260, 260, 0, rc, 2, .12 + .1 * Math.sin(t * 9)); }
    }
    if (C) {
      if (C.k === 'supply') { const h = Math.max(0, 260 * (1 - C.t / (C.dur * .8))); pod(C.x, C.y, h, 'drop'); if (h > 0) tr(CYL, C.x, 0, C.y, 30 * (1 - h / 260) + 6, 1, 30 * (1 - h / 260) + 6, 0, '#000000', 0, .25); }
      if (C.k === 'comms') { const c = core(); if (c) { tr(CYL, c.x + 27, 26, c.y - 8, 3, 500, 3, 0, '#7df9ff', 2.5, .35 + .25 * Math.sin(t * 20)); for (let i = 0; i < 3; i++) { const r = ((t * 70 + i * 40) % 120); tr(TUBE, c.x + 27, 30 + r * 1.5, c.y - 8, r, 2, r, 0, '#7df9ff', 2, (1 - r / 120) * .5); } } }
      if (C.k === 'final') { const c = core(); for (let i = 0; i < 5; i++) { const a = i * 1.257 + t * .2, x = (c ? c.x + 16 : TGT.x) + Math.cos(a) * 260, y = (c ? c.y + 16 : TGT.y) + Math.sin(a) * 200, k2 = clamp(C.t / C.dur, 0, 1); tr(CYL, x, 0, y, 30 * k2, 3, 14 * k2, 0, '#b05aff', 2, .5); tr(CYL, x, 0, y, 8, 200 * k2, 8, 0, '#b05aff', 2, .25); } }
    }
    (S.exp || []).forEach(e => { if (e.st === 2 || typeof expGoal !== 'function') return; const g = expGoal(e); if (!g) return; const pul = .6 + .4 * Math.sin(t * 5);
      if (e.st === 1) return; const pts = e.k === 'beacons' ? e.pts : [{ x: g.x, y: g.y }];
      pts.forEach(q => { const dn = q.done; cyl(q.x, q.y, 0, 1.6, dn ? 14 : 34, dn ? '#5fe08a' : '#dddddd', dn ? 1 : 3); box(q.x + 4, q.y, dn ? 10 : 28, 7, 5, 1, dn ? '#5fe08a' : '#ff7a3d', 3); if (!dn) tr(CYL, q.x, 0, q.y, 3, 220, 3, 0, '#ffcf4a', 3, .18 * pul); }); });
    if (S.winT > 0 && S.flag) { for (let i = 0; i < 8; i++) { const a = t * 2 + i * .785, c = core(); if (!c) break; box(c.x + 16 + Math.cos(a) * 40, c.y + 16 + Math.sin(a) * 40, 40 + Math.sin(t * 3 + i) * 10, 3, 3, 3, ['#ffcf4a', '#5fe08a', '#7df9ff', '#ff7a3d'][i % 4], 2, t * 4); } }
  }
  function moveToT(from) { // move vertices [from, n) to the transparent buffer
    const cnt = n - from; if (cnt <= 0) return; const need = (tn + cnt) * FL; if (need > tbuf.length) { const nb = new Float32Array(need * 2); nb.set(tbuf); tbuf = nb; }
    tbuf.set(buf.subarray(from * FL, n * FL), tn * FL); tn += cnt; n = from;
  }

  function decals(ox, oy) {
    const g0 = G; G = DX; DX.setTransform(1, 0, 0, 1, 0, 0); DX.clearRect(0, 0, DS, DS); DX.translate(-ox, -oy); DX.imageSmoothingEnabled = false;
    const sh = (x, y, rx, ry, a) => { DX.fillStyle = `rgba(0,0,0,${(a || .32) * (SH.ok && shOn() ? .45 : 1)})`; DX.beginPath(); DX.ellipse(x, y, rx, ry, 0, 0, 7); DX.fill(); };
    try {
      if (typeof drawPrints === 'function') drawPrints();
      if (typeof drawPOIs === 'function') drawPOIs();
      if (typeof drawSecrets === 'function') drawSecrets();
      if (typeof drawCables === 'function') drawCables();
      if (typeof drawHaz === 'function') drawHaz();
      if (typeof drawExp === 'function') drawExp();
      if (typeof drawEmg === 'function') drawEmg();
      if (typeof drawScen === 'function') drawScen();
      const cy0 = CAM.y; S.strikes.forEach(q => { CAM.y = q.y; drawReticle(q); }); CAM.y = cy0;
      S.ring.forEach(r => { DX.strokeStyle = `rgba(125,249,255,${r.l * 2.5})`; DX.lineWidth = 3; DX.beginPath(); DX.arc(r.x, r.y, r.r, 0, 7); DX.stroke(); });
      S.strikes.forEach(q => { if (q.t >= 1.4) { const k = 1 - (q.t - 1.4) / .7; DX.fillStyle = `rgba(200,255,255,${.6 * k})`; DX.beginPath(); DX.ellipse(q.x, q.y, 48 * k + 10, 48 * k + 10, 0, 0, 7); DX.fill(); } });
      // shadows
      S.b.forEach(b => { if (b.pop != null && b.pop < 0) return; sh(b.x + b.w / 2 + 3, b.y + b.w / 2 + 3, b.w * .62, b.w * .5); });
      S.al.forEach(a => sh(a.x + 2, a.y + 2, a.r * (a.boss ? 1.3 : 1.1), a.r * (a.boss ? 1 : .8), a.ty === 'fly' ? .2 : .32));
      if (!S.drive && S.land <= .55) sh(S.p.x + 1, S.p.y + 1, 5, 4); if (S.p2 && S.p2.x != null) sh(S.p2.x + 1, S.p2.y + 1, 5, 4);
      S.npc.forEach(q => sh(q.x + 1, q.y + 1, 4.5, 3.5)); S.allies.forEach(q => sh(q.x + 1, q.y + 1, 5, 4));
      if (S.rv) sh(S.rv.x + 2, S.rv.y + 2, 13, 9); S.rocks.forEach(r => sh(r.x + 1.5, r.y + 1.5, 6, 4.5, .25));
      S.pods.forEach(q => { const k = clamp(1 - q.h / 260, .3, 1); sh(q.x, q.y + 2, 8 * k, 6 * k); });
      if (S.dome > 0) { const c = core(); if (c) { DX.strokeStyle = `rgba(150,220,255,${.45 + .2 * Math.sin(T() * 4)})`; DX.lineWidth = 2; DX.beginPath(); DX.arc(c.x + 16, c.y + 16, 86, 0, 7); DX.stroke(); } }
      if (S.insp) { const b = S.insp; DX.strokeStyle = '#ffcf4a'; DX.lineWidth = 1.5; DX.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.w + 4); }
      if (typeof ghost === 'function' && S.run && sel) { const gg = ghost(); if (gg) { const ok = canBuy(sel); DX.strokeStyle = ok ? '#5fe08a' : '#ff5466'; DX.lineWidth = 1.5; DX.setLineDash([3, 2]); DX.strokeRect(gg.x + .5, gg.y + .5, 15, 15); DX.setLineDash([]); if (typeof drawGhostLink === 'function') drawGhostLink(gg); } }
    } catch (e) { if (!R3.err) { R3.err = 1; console.warn('3D decal', e); } }
    DX.setTransform(1, 0, 0, 1, 0, 0); G = g0;
  }

  function proj(x, h, y) { if (HDM && TER) h += THc(x, y); const m = VP, w = m[3] * x + m[7] * h + m[11] * y + m[15]; if (w <= .1) return null; const px = (m[0] * x + m[4] * h + m[8] * y + m[12]) / w, py = (m[1] * x + m[5] * h + m[9] * y + m[13]) / w; return [(px * .5 + .5) * W, (1 - (py * .5 + .5)) * H, w]; }
  R3.proj = proj;
  function overlay(dk, cm) {
    const oq = Math.min(R3.q === 'low' ? 1.5 : 2.5, Math.max(1, c3.width / W)), ow = Math.round(W * oq), oh = Math.round(H * oq); if (cv0().width !== ow || cv0().height !== oh) { cv0().width = ow; cv0().height = oh; }
    X.setTransform(oq, 0, 0, oq, 0, 0); X.clearRect(0, 0, W, H); X.globalAlpha = 1; X.imageSmoothingEnabled = true;
    if (S.lv == 4 && typeof drawRain === 'function') drawRain();
    if (S.storm > 0) { X.fillStyle = 'rgba(255,220,170,.45)'; for (let i = 0; i < 40; i++) { const y = (i * 53 + S.t * 40) % H, x = (i * 97 + S.t * 260) % (W + 40) - 20; X.fillRect(x, y, 14, 1); } }
    if (S.shel > 0) { X.fillStyle = 'rgba(125,249,255,.08)'; X.fillRect(0, 0, W, H); }
    if (S.hf > 0) { X.fillStyle = `rgba(255,0,30,${Math.min(.35, S.hf)})`; X.fillRect(0, 0, W, H); }
    { const eb = S.al.find(a => a.boss && (a.ph2 || a.rg)); if (eb && S.run && !S.cin) { const va = (typeof NOFL !== 'undefined' && NOFL) ? .1 : .1 + .08 * Math.sin(T() * 8), vg = X.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, `rgba(200,0,20,${va})`); X.fillStyle = vg; X.fillRect(0, 0, W, H); } }
    if (S.hp < 30 && S.run) { const va = .28 + .18 * Math.sin(T() * 7), vg = X.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); vg.addColorStop(0, 'rgba(255,0,30,0)'); vg.addColorStop(1, `rgba(255,0,30,${va})`); X.fillStyle = vg; X.fillRect(0, 0, W, H); }
    const bar = (x, h, y, w, k, c) => { const p = proj(x, h, y); if (!p) return; const s = clamp(300 / p[2], .6, 1.6), ww = w * s; X.fillStyle = '#300'; X.fillRect(p[0] - ww / 2, p[1], ww, 2); X.fillStyle = c; X.fillRect(p[0] - ww / 2, p[1], ww * clamp(k, 0, 1), 2); };
    S.b.forEach(b => { const cx = b.x + b.w / 2, cy = b.y + b.w / 2, h = b.t === 'core' ? 34 : b.t === 'pylon' ? 26 : 20;
      if (b.hp < b.m) bar(cx, h, cy, b.w, b.hp / b.m, b.hp / b.m < .35 ? (typeof CBC !== 'undefined' && CBC ? '#e69f00' : '#ff5050') : (typeof CBC !== 'undefined' && CBC ? '#56b4e9' : '#5fe08a'));
      const bl = Math.floor(T() * 2.5) % 2; if (b.dis) { const p = proj(cx, h * .5, cy); if (p) { X.font = 'bold 7px sans-serif'; X.textAlign = 'center'; X.fillStyle = '#000'; X.fillText('OFF', p[0] + .6, p[1] + .6); X.fillStyle = '#ff9a9a'; X.fillText('OFF', p[0], p[1]); } }
      else if ((b.off || b.nc) && bl) { const p = proj(cx, h + 6, cy); if (p) { X.font = '9px sans-serif'; X.textAlign = 'center'; X.fillText(b.nc ? '🔌' : '⚡', p[0], p[1]); } } });
    S.al.forEach(a => { if (a.hp < a.mh && !a.boss && !a.hid) bar(a.x, a.r * 2.6 + 6, a.y, a.r * 2, a.hp / a.mh, '#ff5050'); });
    S.allies.forEach(a => bar(a.x, 22, a.y, 10, a.life / 35, '#99ddff'));
    X.font = 'bold 8px "Chakra Petch",sans-serif'; X.textAlign = 'center';
    const label = (x, h, y, t, c) => { const p = proj(x, h, y); if (!p) return; X.fillStyle = '#000'; X.fillText(t, p[0] + 1, p[1] + 1); X.fillStyle = c || '#fff'; X.fillText(t, p[0], p[1]); };
    if (S.nTag && S.land <= .55 && !S.cin) { const q = S.nTag; try { label(q.x, 18, q.y, q.c.nm + ' · ' + JOBS[q.c.job].n); } catch (e) {} }
    if (S.p2 && S.p2.x != null && S.p2.name) label(S.p2.x, 20, S.p2.y, S.p2.name, '#9fe8ff');
    S.npc.forEach(q => { if (q.scared && Math.floor(T() * 6) % 2) label(q.x, 22, q.y, '!', '#ff5466'); });
    if (S.dog && S.dog.bk > 0) label(S.dog.x, 14, S.dog.y, '!', '#ffd23f'); { const HN = S.hnm || (typeof HERO !== 'undefined' && HERO); if (S.hero && HN) label(S.hero.x, 28, S.hero.y, '★' + HN.lv + ' ' + HN.nm, '#ffd23f'); } if (S.gd) label(S.gd.x, 34, S.gd.y, 'Guardian', '#7df9ff');
    X.font = 'bold 9px "Chakra Petch",monospace';
    S.ft.forEach(f => { const p = proj(f.x, 14, f.y); if (!p) return; X.globalAlpha = clamp(f.l * 1.5, 0, 1); const k = f.pop ? 1 + (f.pop - 1) * clamp((f.l - .4) / .25, 0, 1) : 1; X.save(); X.translate(p[0], p[1]); X.scale(k, k); X.fillStyle = '#000'; X.fillText(f.t, 1, 1); X.fillStyle = f.c; X.fillText(f.t, 0, 0); X.restore(); }); X.globalAlpha = 1;
    if (S.flash > 0) { X.fillStyle = `rgba(255,250,235,${Math.min(.85, S.flash) * (typeof NOFL !== 'undefined' && NOFL ? .3 : 1)})`; X.fillRect(0, 0, W, H); }
    if (S.cbo) { const k = S.cbo.t, sc = 1 + Math.max(0, k - 1) * 2, tx = 'x' + S.cbo.n + ' COMBO! +' + S.cbo.n + (CLEAN ? ' coins' : '💰'); X.save(); X.translate(W / 2, H * .68); X.scale(sc, sc); X.font = 'bold 18px "Pixelify Sans",monospace'; X.globalAlpha = clamp(k * 2, 0, 1); X.fillStyle = '#000'; X.fillText(tx, 2, 2); X.fillStyle = S.cbo.n >= 10 ? '#ff7a3d' : '#ffe066'; X.fillText(tx, 0, 0); X.restore(); }
    X.globalAlpha = 1; void dk;
    if (cm && cm !== 'top' && S.run && !S.cin) {
      if (cm === 'fp') { X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 1; X.beginPath(); X.arc(W / 2, H / 2, 5, 0, 7); X.stroke(); X.fillStyle = '#7df9ff'; X.fillRect(W / 2 - 1, H / 2 - 1, 2, 2); }
      const f = R3.f2 || [0, -1], P0 = S.drive && S.rv ? S.rv : S.p;
      S.al.forEach(a => { if (a.hid) return; const dx = a.x - P0.x, dy = a.y - P0.y, d = Math.hypot(dx, dy); if (d > 190 || d < 1) return; const c = (dx * f[0] + dy * f[1]) / d; if (c > .55) return;
        const side = (dx * -f[1] + dy * f[0]) / d, ang = Math.atan2(-c, side), ex = W / 2 + Math.cos(ang) * W * .42, ey = H / 2 + Math.sin(ang) * H * .4, al = clamp(1.3 - d / 190, .25, 1);
        X.save(); X.translate(ex, ey); X.rotate(ang); X.globalAlpha = al * (.7 + .3 * Math.sin(T() * 10)); X.fillStyle = a.boss ? '#ff2a2a' : '#ff5466'; X.beginPath(); X.moveTo(9, 0); X.lineTo(-5, -7); X.lineTo(-2, 0); X.lineTo(-5, 7); X.closePath(); X.fill(); X.restore(); });
      X.globalAlpha = 1;
    }
    if (typeof goalArrow === 'function') goalArrow();
    if (typeof raidArrow === 'function') raidArrow(); if (typeof drawGate === 'function') drawGate(); if (typeof drawStoryFx === 'function') drawStoryFx();
  }

    /* ---------- v29: HD view — anime-style cel shading, ink outlines, real hills and craters, planet physics ---------- */
  let OLN = 0, HDM = false, REAL = false, TER = null, TERK = '', gb = null, gN = 0, gKey = '', texNz = null, prog3 = null, U3 = {}, NOLIFT = false;
  const gOf = () => { const d = (S && S.L && S.L.data) || ''; let m = d.match(/gravity\s*([\d.]+)\s*m/i); if (m) return +m[1]; m = d.match(/gravity about (\d+)%/i); return m ? 9.81 * m[1] / 100 : 3.7; };
  // per world: hill height, craters, crater depth, dunes, ice ridges
  const TPRM = [[24, 16, 26, 0, 0], [30, 7, 18, 1, 0], [28, 20, 24, 0, 0], [12, 3, 10, 0, 1], [22, 4, 12, .6, 0], [26, 18, 22, 0, 0], [30, 6, 16, 0, 0]];
  const CLD = [[0, 0, 0, 0], [1, .88, .8, .5], [0, 0, 0, 0], [0, 0, 0, 0], [1, .74, .4, .85], [0, 0, 0, 0], [.86, .62, 1, .6]];
  function terEnsure() {
    const c = core(), bx = c ? c.x + 16 : WW / 2, bz = c ? c.y + 16 : WH / 2, key = S.lv + ':' + Math.round(bx) + ':' + Math.round(bz) + ':' + WW + 'x' + WH;
    if (key === TERK) return; TERK = key;
    const P = TPRM[S.lv] || TPRM[0]; let s = 7 + S.lv * 131; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    const cr = []; let guard = 0;
    while (cr.length < P[1] && guard++ < 600) { const x = -500 + r() * (WW + 1000), z = -500 + r() * (WH + 1000), rr = 36 + r() * r() * 170; if (Math.hypot(x - bx, z - bz) < 330 + rr) continue; cr.push([x, z, rr, P[2] * (.6 + r() * .7) * Math.min(1.6, rr / 110)]); }
    TER = { bx, bz, A: P[0], cr, du: P[3], ri: P[4], o1: r() * 6, o2: r() * 6, o3: r() * 6 };
  }
  function THc(x, z) {
    const T_ = TER; if (!T_) return 0;
    let h = T_.A * (.55 * Math.sin(x * .0052 + T_.o1) * Math.sin(z * .0061 + T_.o2) + .3 * Math.sin((x * .8 + z * .6) * .011 + T_.o3) + .15 * Math.sin((-x * .5 + z) * .024) * Math.sin(x * .019 + z * .005));
    if (T_.du) { const d = Math.sin(x * .016 + Math.sin(z * .0055) * 2.2); h += T_.A * .4 * T_.du * (d * d * d * d - .3); }
    if (T_.ri) { const q = Math.abs(Math.sin(x * .0072 + z * .0043 + Math.sin(z * .0025) * 1.5)); h += T_.A * .9 * Math.max(0, 1 - q * 9); }
    const cr = T_.cr; for (let i = 0; i < cr.length; i++) { const c = cr[i], dx = x - c[0], dz = z - c[1], d2 = (dx * dx + dz * dz) / (c[2] * c[2]); if (d2 > 2.6) continue; const d = Math.sqrt(d2); h += d < 1 ? -c[3] * (1 - d2) + c[3] * .32 * d2 * d2 : c[3] * .32 * Math.pow(Math.max(0, 1 - (d - 1) / .6), 2); }
    const ox = x < 0 ? -x : x > WW ? x - WW : 0, oz = z < 0 ? -z : z > WH ? z - WH : 0; if (ox || oz) { const m = Math.min(1, Math.hypot(ox, oz) / 650); h += m * m * (3 - 2 * m) * (200 + 80 * Math.sin(x * .0043 + z * .0031) + 40 * Math.sin(x * .011 - z * .009)); }
    const bd = Math.hypot(x - T_.bx, z - T_.bz); if (bd < 220) return 0; if (bd < 420) { const u = (bd - 220) / 200; h *= u * u * (3 - 2 * u); }
    return h;
  }
  function buildGround() {
    const xs = [], zs = [], ax = (a, lo, hi, st) => { for (let v = lo; v < hi; v += st) a.push(v); };
    ax(xs, -1800, -200, 100); ax(xs, -200, WW + 200, 14); ax(xs, WW + 200, WW + 1801, 100);
    ax(zs, -1800, -200, 100); ax(zs, -200, WH + 200, 14); ax(zs, WH + 200, WH + 1801, 100);
    const nx = xs.length, nz = zs.length, Hh = new Float32Array(nx * nz), NN = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = xs[i], z = zs[j], k = j * nx + i, e = 5; Hh[k] = THc(x, z); const gx = (THc(x + e, z) - THc(x - e, z)) / (2 * e), gz = (THc(x, z + e) - THc(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz); NN[k * 3] = -gx / l; NN[k * 3 + 1] = 1 / l; NN[k * 3 + 2] = -gz / l; }
    const arr = new Float32Array((nx - 1) * (nz - 1) * 6 * FL); let o = 0;
    const V = (i, j) => { const k = j * nx + i; arr[o] = xs[i]; arr[o + 1] = Hh[k]; arr[o + 2] = zs[j]; arr[o + 3] = NN[k * 3]; arr[o + 4] = NN[k * 3 + 1]; arr[o + 5] = NN[k * 3 + 2]; arr[o + 6] = 1; arr[o + 7] = 1; arr[o + 8] = 1; arr[o + 9] = 1; arr[o + 10] = 0; o += FL; };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { V(i, j); V(i, j + 1); V(i + 1, j + 1); V(i, j); V(i + 1, j + 1); V(i + 1, j); }
    if (!gb) gb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gb); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gN = o / FL; gKey = TERK;
  }
  function drawGround() { if (gKey !== TERK || !gb) buildGround(); gl.uniform1f(U.uG, 1); gl.disable(gl.CULL_FACE); gl.bindBuffer(gl.ARRAY_BUFFER, gb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, gN); gl.enable(gl.CULL_FACE); gl.uniform1f(U.uG, 0); }
  function mkNoise() {
    const N = 256, out = new Uint8Array(N * N * 4); let sd = 991; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
    for (let ch = 0; ch < 4; ch++) {
      let a = new Float32Array(N * N); for (let i = 0; i < a.length; i++) a[i] = rnd();
      const R = ch === 0 ? 3 : 2;
      for (let pass = 0; pass < 3; pass++) { const b = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let k = -R; k <= R; k++) s += a[y * N + ((x + k + N) % N)]; b[y * N + x] = s; } for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let k = -R; k <= R; k++) s += b[((y + k + N) % N) * N + x]; a[y * N + x] = s; } }
      let mn = 1e9, mx = -1e9; for (let i = 0; i < a.length; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
      for (let i = 0; i < a.length; i++) out[i * 4 + ch] = Math.round((a[i] - mn) / (mx - mn) * 255);
    }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.generateMipmap(gl.TEXTURE_2D); return t;
  }
  const VS3 = `attribute vec3 aP,aN;attribute vec4 aC;attribute float aE;uniform mat4 uM;uniform vec3 uCam;uniform float uOW;varying vec3 vC;
void main(){vC=aC.rgb;if(aE>1.15||aC.a<.98){gl_Position=vec4(2.,2.,2.,1.);return;}float d=length(uCam-aP);vec3 p=aP+aN*min(.1+d*.0021,1.5)*uOW;gl_Position=uM*vec4(p,1.);}`;
  const FS3 = `precision mediump float;varying vec3 vC;uniform vec3 uOC;void main(){gl_FragColor=vec4(vC*.34+uOC,1.);}`;
  function hdInit() {
    if (prog3) return;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS3)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS3));
    [['aP', U.aP], ['aN', U.aN], ['aC', U.aC], ['aE', U.aE]].forEach(([k, l]) => { if (l >= 0) gl.bindAttribLocation(p, l, k); });
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    ['uM', 'uCam', 'uOW', 'uOC'].forEach(k => U3[k] = gl.getUniformLocation(p, k));
    ['uHDm', 'uNz', 'uGa', 'uGb', 'uGc', 'uGd', 'uRes', 'uWid', 'uWB'].forEach(k => U[k] = gl.getUniformLocation(prog, k));
    ['uNz', 'uCl', 'uHDs'].forEach(k => U2[k] = gl.getUniformLocation(prog2, k));
    texNz = mkNoise(); prog3 = p;
  }
  function hdU(L) { // main program uniforms for the HD look
    if (!prog3) return;
    if (false && HDM && R3.qs === 'auto' && S.run && !S.pz) { if ((R3.ft || 16) > 42) { if (++R3.hdSlow > 240) { R3.hdSlow = 0; R3.setHD(false); HDM = false; try { LS.set('viewhd', 0); say('HD view was running slowly on this device, so the normal 3D view is back on. You can switch HD on again any time.'); viewLabel(); } catch (e) {} } } else R3.hdSlow = 0; }
    gl.uniform1f(U.uHDm, HDM ? 1 : 0); if (!HDM) return;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texNz); gl.uniform1i(U.uNz, 3); gl.activeTexture(gl.TEXTURE0);
    const B = L.bg.map(col); gl.uniform3fv(U.uGa, B[0]); gl.uniform3fv(U.uGb, B[2]); gl.uniform3fv(U.uGc, B[4]); gl.uniform3fv(U.uGd, B[3]); gl.uniform2f(U.uRes, c3.width, c3.height); gl.uniform1f(U.uWid, S.lv); gl.uniform2f(U.uWB, TER ? TER.bx : WW / 2, TER ? TER.bz : WH / 2);
  }
  function hdSky() { if (!prog3) return; gl.uniform1f(U2.uHDs, HDM ? 1 : 0); gl.uniform4fv(U2.uCl, HDM ? (CLD[S.lv] || CLD[0]) : [0, 0, 0, 0]); if (HDM) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texNz); gl.uniform1i(U2.uNz, 3); gl.activeTexture(gl.TEXTURE0); } }
  function outlines(dn) {
    gl.useProgram(prog3); gl.uniformMatrix4fv(U3.uM, false, new Float32Array(VP)); gl.uniform3fv(U3.uCam, EYE); gl.uniform1f(U3.uOW, R3.cm === 'fp' ? .55 : 1); gl.uniform3f(U3.uOC, .02, .014, .05);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
    if (dn) { gl.bindBuffer(gl.ARRAY_BUFFER, vb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, dn); }
    if (bvN) { gl.bindBuffer(gl.ARRAY_BUFFER, bvb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, bvN); }
    if (staticN) { gl.bindBuffer(gl.ARRAY_BUFFER, sb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, staticN); }
    gl.cullFace(gl.BACK); gl.useProgram(prog);
  }
  // lean a just-drawn model (vertices sv..en) so it sits flat on the slope under it; lift adds air time
  function tiltR(sv, en, x, z, e, lift) {
    const gx = (THc(x + e, z) - THc(x - e, z)) / (2 * e), gz = (THc(x, z + e) - THc(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz), nx = -gx / l, ny = 1 / l, nz = -gz / l, py = THc(x, z);
    let ax = nz, az = -nx; const s = Math.hypot(ax, az); lift = lift || 0; if (s < 1e-4 && !lift) return;
    const c = ny, si = s, t1 = 1 - c; if (s >= 1e-4) { ax /= s; az /= s; } else { ax = 1; az = 0; }
    const m00 = c + t1 * ax * ax, m01 = -si * az, m02 = t1 * ax * az, m10 = si * az, m11 = c, m12 = -si * ax, m20 = t1 * az * ax, m21 = si * ax, m22 = c + t1 * az * az;
    for (let i = sv; i < en; i++) { const o = i * FL, px = buf[o] - x, pY = buf[o + 1] - py, pz = buf[o + 2] - z, qx = buf[o + 3], qy = buf[o + 4], qz = buf[o + 5];
      buf[o] = x + m00 * px + m01 * pY + m02 * pz; buf[o + 1] = py + lift + m10 * px + m11 * pY + m12 * pz; buf[o + 2] = z + m20 * px + m21 * pY + m22 * pz;
      buf[o + 3] = m00 * qx + m01 * qy + m02 * qz; buf[o + 4] = m10 * qx + m11 * qy + m12 * qz; buf[o + 5] = m20 * qx + m21 * qy + m22 * qz; }
  }
  // rover suspension with the world's real gravity: it follows the ground, and flies off crests when gravity is weak
  const RV = { y: 0, v: 0, t: 0, g0: 0, lx: null, ly: null };
  function rvPhys(sv, rv) {
    const t = T(), dt = Math.min(.05, Math.max(0, t - RV.t)); RV.t = t; const g = gOf() * 9, gr = THc(rv.x, rv.y);
    if (RV.lx == null || Math.hypot(rv.x - RV.lx, rv.y - RV.ly) > 120 || !dt) { RV.y = gr; RV.v = 0; RV.g0 = gr; }
    const gv = dt > 0 ? (gr - RV.g0) / dt : 0; RV.lx = rv.x; RV.ly = rv.y; RV.g0 = gr;
    if (RV.y > gr + .05 || (S.drive && dt && gv < RV.v - g * dt * 1.5)) { RV.v -= g * dt; RV.y += RV.v * dt; if (RV.y <= gr) { RV.y = gr; RV.v = gv; } }
    else { RV.v = gv; RV.y = gr; }
    RV.y = Math.min(RV.y, gr + 60); R3.air = RV.y - gr;
    tiltR(sv, n, rv.x, rv.y, 12, RV.y - gr);
  }
  // HD astronaut: rounded, jointed, chibi proportions with a big glossy helmet
  function astroHD(x, y, ang, walk, SU, job, scale, drive, mvk, jz, me) {
    if (drive) return; const s = scale || 1, ca = Math.cos(ang), sa = Math.sin(ang), RY = ang + Math.PI / 2, t = T();
    mvk = mvk == null ? 1 : mvk; const air = (jz || 0) > 1.5, ph = walk * 11, sw = Math.sin(ph) * .62 * mvk, bob = (Math.abs(Math.cos(ph)) * .45 * mvk + Math.sin(t * 2.2) * .12) * s;
    const at = (f, r) => [x + (ca * f - sa * r) * s, y + (sa * f + ca * r) * s];
    const limb = (p, h, len, w, th, c) => { put(CYL, p[0], h - len * s * Math.cos(th) * 0, p[1], w * s, len * s, w * s, RY, Math.PI + th, c, 0); return [p[0] + ca * Math.sin(th) * len * s, h - Math.cos(th) * len * s, p[1] + sa * Math.sin(th) * len * s]; };
    const DK = '#3c4150', TRIM = job || '#ff8a3d', WH_ = SU.b, PN = SU.p; let p;
    for (const q of [-1, 1]) {
      const a1 = air ? -.8 + q * .15 : sw * q, kb = air ? 1.4 : Math.max(0, Math.sin(ph + (q > 0 ? 0 : Math.PI))) * .95 * mvk + .1;
      const hh = 6.2 * s + bob, kn = limb(at(-.1, q * 1.45), hh, 3.0, 2.7, a1, WH_);
      put(SPH, kn[0], kn[1] - 1.15 * s, kn[2], 2.4 * s, 2.4 * s, 2.4 * s, ang, 0, PN, 0);
      const ft = limb([kn[0], kn[2]], kn[1], 3.0, 2.4, a1 - kb, WH_), fh = Math.max(0, ft[1]), bf = [ft[0] + ca * .7 * s, ft[2] + sa * .7 * s];
      put(SPH, bf[0], fh - .3 * s, bf[1], 4.2 * s, 2.6 * s, 3.0 * s, ang, 0, DK, 0); put(BOX, bf[0], fh - .45 * s, bf[1], 4.3 * s, .6 * s, 3.0 * s, ang, 0, TRIM, .15);
    }
    const tb = 6.0 * s + bob;
    put(CYL, x, tb, y, 5.8 * s, 4.4 * s, 5.0 * s, ang, 0, WH_, 0); put(SPH, x, tb + 2.2 * s, y, 6.3 * s, 3.8 * s, 5.6 * s, ang, 0, WH_, 0);
    put(TUBE, x, tb - .2 * s, y, 6.2 * s, 1.1 * s, 5.4 * s, ang, 0, TRIM, .35);
    p = at(2.75, 0); put(BOX, p[0], tb + 1.4 * s, p[1], .8 * s, 2.4 * s, 3.2 * s, ang, 0, DK, 0);
    p = at(3.2, -.8); put(SPH, p[0], tb + 2.8 * s, p[1], .6 * s, .6 * s, .6 * s, 0, 0, '#5fe08a', 1.8);
    p = at(3.2, .8); put(SPH, p[0], tb + 2.8 * s, p[1], .6 * s, .6 * s, .6 * s, 0, 0, Math.floor(t * 2) % 2 ? '#ffcf4a' : '#7a5a10', 1.6);
    p = at(2.95, 0); put(BOX, p[0], tb + .7 * s, p[1], .3 * s, .45 * s, 2.6 * s, ang, 0, TRIM, .6);
    p = at(-3.4, 0); put(SPH, p[0], tb - .4 * s, p[1], 3.8 * s, 7.2 * s, 6.2 * s, ang, 0, PN, 0);
    for (const q of [-1, 1]) { p = at(-4.7, q * 1.55); put(CYL, p[0], tb + .1 * s, p[1], 1.8 * s, 5.4 * s, 1.8 * s, ang, 0, '#dfe3ea', 0); put(SPH, p[0], tb + 4.7 * s, p[1], 1.8 * s, 1.4 * s, 1.8 * s, 0, 0, '#dfe3ea', 0); }
    p = at(-5.6, 0); put(BOX, p[0], tb + .9 * s, p[1], .3 * s, 4 * s, .7 * s, ang, 0, TRIM, 1.3);
    p = at(-2.9, -2.5); put(CYL, p[0], tb + 5.4 * s, p[1], .35 * s, 4.4 * s, .35 * s, 0, 0, '#c9ccd6', 0); put(SPH, p[0], tb + 9.7 * s, p[1], 1 * s, 1 * s, 1 * s, 0, 0, '#ff4a4a', Math.floor(t * 2) % 2 ? 2 : .3);
    for (const q of [-1, 1]) {
      const gun = q > 0, sh_ = at(.1, q * 3.75), shH = tb + 3.7 * s;
      put(HEMI, sh_[0], shH - .3 * s, sh_[1], 3.1 * s, 2 * s, 3.1 * s, 0, 0, TRIM, .12);
      const aa = air ? 2.5 - (gun ? .3 : 0) : gun ? 1.1 : -sw * q * .85, el = limb(sh_, shH, 2.7, 2.3, aa, WH_);
      put(SPH, el[0], el[1] - 1.05 * s, el[2], 2.2 * s, 2.2 * s, 2.2 * s, 0, 0, PN, 0);
      const fa = aa + (gun ? .4 : air ? .25 : .35), hd = limb([el[0], el[2]], el[1], 2.5, 2.1, fa, WH_);
      put(SPH, hd[0], hd[1] - 1.25 * s, hd[2], 2.5 * s, 2.5 * s, 2.5 * s, ang, 0, '#f2f4f8', 0);
      if (gun && !(me && S.glide)) { let wc = '#7df9ff'; try { wc = WP[S.wp].col; } catch (e) {} rifle([hd[0] - ca * .6 * s, hd[2] - sa * .6 * s], hd[1] - .9 * s, ang, s, wc, me && S.fT != null ? Math.max(0, 1 - (t - S.fT) / .08) : 0); }
    }
    const hc = tb + 4.6 * s;
    put(TUBE, x, hc - .2 * s, y, 5.6 * s, 1.1 * s, 5.6 * s, 0, 0, '#c9ccd6', 0);
    put(SPH, x, hc, y, 8.2 * s, 7.8 * s, 8.2 * s, ang, 0, WH_, 0);
    p = at(1.95, 0); put(SPH, p[0], hc + 1.3 * s, p[1], 4.9 * s, 5.1 * s, 6.6 * s, ang, 0, SU.v, .45);
    p = at(4.05, -1.6); put(SPH, p[0], hc + 4.4 * s, p[1], .5 * s, 1.5 * s, 1.1 * s, ang, 0, '#ffffff', 1.9);
    p = at(4.0, 1.7); put(SPH, p[0], hc + 3.0 * s, p[1], .45 * s, .65 * s, .65 * s, ang, 0, '#ffffff', 1.4);
    for (const q of [-1, 1]) { p = at(-.2, q * 4.0); put(SPH, p[0], hc + 2.2 * s, p[1], 1.8 * s, 2.8 * s, 1.5 * s, ang, 0, TRIM, .25); }
    if (SU.ears) for (const q of [-1, 1]) { p = at(0, q * 2); put(CONE, p[0], hc + 6.6 * s, p[1], 1.9 * s, 2.8 * s, 1.9 * s, ang, 0, WH_, 0); }
    if (me && TER) hdExtras(x, y, ang, s, tb, hc, at, TRIM);
  }
  /* ---------- v30: HD rifle, flowing scarf (real gravity and air), glider wings, light motes, Echo grass ---------- */
  let GLW = false;
  // sci-fi rifle held along `ang`; G = grip point [x, z], h = barrel height, fl = muzzle flash 0..1
  function rifle(G, h, ang, s, col, fl) {
    const ca = Math.cos(ang), sa = Math.sin(ang), RY = ang + Math.PI / 2, FW = -Math.PI / 2, F = f => [G[0] + ca * f * s, G[1] + sa * f * s], WT = '#eef2f8', DK = '#2b313f';
    let p;
    p = F(-2.6); put(BOX, p[0], h - 1 * s, p[1], 3.4 * s, 1.9 * s, 1.1 * s, ang, 0, WT, 0);
    p = F(-4.4); put(BOX, p[0], h - 1.25 * s, p[1], .6 * s, 2.4 * s, 1.3 * s, ang, 0, DK, 0);
    p = F(.9); put(BOX, p[0], h - 1.15 * s, p[1], 4.6 * s, 2.4 * s, 1.75 * s, ang, 0, DK, 0);
    p = F(1.1); put(BOX, p[0], h + 1.1 * s, p[1], 4.8 * s, .45 * s, 1.25 * s, ang, 0, WT, 0);
    p = F(.5); put(BOX, p[0], h - .75 * s, p[1], 2.5 * s, 1.05 * s, 2.1 * s, ang, 0, col, 1.6);
    p = F(-.7); put(BOX, p[0], h - 3.1 * s, p[1], 1.1 * s, 2.2 * s, .95 * s, ang, -.25, DK, 0);
    p = F(3.2); put(CYL, p[0], h, p[1], 1.7 * s, 4.3 * s, 1.7 * s, RY, FW, WT, 0);
    for (let i = 0; i < 3; i++) { p = F(3.7 + i * 1.05); put(TUBE, p[0], h, p[1], 1.95 * s, .38 * s, 1.95 * s, RY, FW, col, 1.4); }
    p = F(4.1); put(BOX, p[0], h - 2.6 * s, p[1], 1 * s, 1.7 * s, .95 * s, ang, 0, DK, 0);
    p = F(7.4); put(CYL, p[0], h, p[1], .8 * s, 2.5 * s, .8 * s, RY, FW, DK, 0);
    p = F(9.8); put(CYL, p[0], h, p[1], 1.2 * s, .8 * s, 1.2 * s, RY, FW, col, 1.2);
    p = F(.5); put(CYL, p[0], h + 2.05 * s, p[1], 1 * s, 2.8 * s, 1 * s, RY, FW, DK, 0);
    p = F(3.35); put(SPHm, p[0], h + 1.6 * s, p[1], .5 * s, .85 * s, .85 * s, ang, 0, '#9ff7ff', 1.7);
    p = F(10.75); put(SPHm, p[0], h - .45 * s, p[1], .9 * s, .9 * s, .9 * s, 0, 0, col, 2);
    if (fl > 0) { p = F(11.6 + fl * 1.5); const k = fl * s;
      put(SPHm, p[0], h - 1.6 * k, p[1], 5.5 * k, 3.2 * k, 3.2 * k, ang, 0, '#ffffff', 3.2, .95, true);
      put(SPHm, p[0], h - 3.6 * k, p[1], 8 * k, 7.2 * k, 7.2 * k, ang, 0, col, 2.6, .5, true);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + T() * 9; put(BOX, p[0], h - .25 * k, p[1], 7 * k, .5 * k, .5 * k, ang, a, '#fff3b0', 3, .8, true); } }
  }
  // a scarf that hangs with the world's real gravity and flutters only where there is air
  const SCF = { p: null, t: 0 };
  function scarf(ax, ay, az, ang, col, jz, N, L, WD) {
    if (R3.noScarf) return; N = N || 7; L = L || 1.55; WD = WD || 2.3; const t = T(); let dt = Math.min(.04, Math.max(0, t - SCF.t)); SCF.t = t;
    if (!SCF.p || Math.hypot(SCF.p[0][0] - ax, SCF.p[0][2] - az) > 60) { SCF.p = []; for (let i = 0; i < N; i++) { const q = [ax - Math.cos(ang) * L * i * .7, ay - i * 1.2, az - Math.sin(ang) * L * i * .7]; SCF.p.push([q[0], q[1], q[2], q[0], q[1], q[2]]); } dt = 0; }
    const P = SCF.p, g = gOf() * 9, drag = [0, .02, 0, 0, .12, 0, .06][S.lv] || 0, wind = [0, 16, 0, 0, 7, 0, 9][S.lv] || 0, damp = 1 - .006 - drag;
    P[0][0] = ax; P[0][1] = ay; P[0][2] = az; P[0][3] = ax; P[0][4] = ay; P[0][5] = az;
    if (dt > 0) for (let i = 1; i < N; i++) { const q = P[i], vx = (q[0] - q[3]) * damp, vy = (q[1] - q[4]) * damp, vz = (q[2] - q[5]) * damp; q[3] = q[0]; q[4] = q[1]; q[5] = q[2];
      const wx = wind * (Math.sin(t * 1.3 + i * .8) * .5 + .7), wz = wind * Math.cos(t * .9 + i * .7) * .5;
      q[0] += vx + wx * dt * dt; q[1] += vy - g * dt * dt; q[2] += vz + wz * dt * dt; }
    for (let k = 0; k < 4; k++) for (let i = 1; i < N; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1, f = (d - L) / d;
      if (i === 1) { b[0] -= dx * f; b[1] -= dy * f; b[2] -= dz * f; } else { a[0] += dx * f * .5; a[1] += dy * f * .5; a[2] += dz * f * .5; b[0] -= dx * f * .5; b[1] -= dy * f * .5; b[2] -= dz * f * .5; } }
    const bx = -Math.cos(ang), bz = -Math.sin(ang);
    for (let i = 1; i < N; i++) { const q = P[i], want = 1.1 + i * .35, rel = (q[0] - ax) * bx + (q[2] - az) * bz; if (rel < want) { q[0] += bx * (want - rel) * .5; q[2] += bz * (want - rel) * .5; } const gr = THc(q[0], q[2]) + .4; if (q[1] < gr) q[1] = gr; }
    NOLIFT = true;
    try { for (let i = 1; i < N; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1;
      put(BOX, a[0], a[1] - jz, a[2], WD * (1 - i * .07), d + .2, .3, Math.atan2(-dx / d, dz / d), Math.acos(clamp(dy / d, -1, 1)), i >= N - 2 ? '#ffd23f' : col, .1); } }
    finally { NOLIFT = false; }
  }
  // player-only extras: scarf and glider wings
  function hdExtras(x, y, ang, s, tb, hc, at, trim) {
    const jz = S.jz || 0, nk = at(-2.5, 0);
    scarf(nk[0], THc(x, y) + jz + hc - .5 * s, nk[1], ang, '#ff4d5e', jz);
    if (S.glide) { const t = T(), fl = Math.sin(t * 6) * .04;
      for (const q of [-1, 1]) { let p = at(-3.6, q * 7.6); put(BOX, p[0], tb + 7.2 * s, p[1], 5.2 * s, .35 * s, 12.5 * s, ang, q * (-.2 + fl), '#f4f7fb', .1);
        p = at(-1.2, q * 7.6); put(BOX, p[0], tb + 7.35 * s, p[1], .8 * s, .4 * s, 12.5 * s, ang, q * (-.2 + fl), trim, .9);
        p = at(-3.6, q * 13.6); put(SPHm, p[0], tb + 6.3 * s, p[1], 1.1 * s, 1.1 * s, 1.1 * s, 0, 0, '#7df9ff', 2); }
      let p = at(-3.6, 0); put(BOX, p[0], tb + 6.6 * s, p[1], 1.2 * s, 1 * s, 3.4 * s, ang, 0, '#3c4150', 0); }
  }
  // drifting specks of light around you, tinted for each world
  function motes() {
    const t = T(), c = ['#fff6d0', '#ffd0a0', '#fff0c0', '#bfe8ff', '#ffcf80', '#e8eeff', '#e0a0ff'][S.lv] || '#ffffff', P0 = S.drive && S.rv ? S.rv : S.p;
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = 18 + (i * 37 % 72), x = P0.x + Math.cos(a + t * .05 * (i % 3 + 1)) * r, z = P0.y + Math.sin(a + t * .04 * (i % 2 + 1)) * r * .8, h = 5 + (i * 13) % 24 + Math.sin(t * .7 + i) * 3, k = .5 + .5 * Math.sin(t * 2 + i * 1.7);
      put(SPHm, x, h, z, .6, .6, .6, 0, 0, c, 2.2 + k, .5 + .4 * k, true); }
  }
  // swaying glowing grass on Echo
  function grass() {
    if (S.lv !== 6) return; const P0 = S.p, t = T(), cs = 24, gx0 = Math.floor((P0.x - 160) / cs), gz0 = Math.floor((P0.y - 130) / cs), c0 = core();
    for (let gx = gx0; gx < gx0 + 14; gx++) for (let gz = gz0; gz < gz0 + 11; gz++) {
      let hs = ((gx * 73856093) ^ (gz * 19349663)) >>> 0; const r = () => ((hs = (Math.imul(hs, 1103515245) + 12345) >>> 0) / 4294967296);
      if (r() < .4) continue; const x = gx * cs + r() * cs, z = gz * cs + r() * cs; if (x < 0 || z < 0 || x > WW || z > WH) continue; if (c0 && Math.hypot(x - c0.x - 16, z - c0.y - 16) < 95) continue;
      for (let k = 0; k < 3; k++) { const a = r() * 6.28, sw = Math.sin(t * 1.6 + x * .05 + k) * .28 + .1, hh = 5 + r() * 7; put(CONE, x + Math.cos(a) * 1.6, 0, z + Math.sin(a) * 1.6, 1.5, hh, 1.5, a, sw, k % 2 ? '#8a3ad0' : '#c070ff', .5); }
      if (r() < .3) put(SPHm, x, 6 + r() * 4, z, 1.2, 1.2, 1.2, 0, 0, '#7df9ff', 1.8);
    }
  }
  /* ---------- v31: real NASA 3D models in HD (astronaut, Perseverance rover, Apollo lander, habitat, RASSOR, Ingenuity, DSN dish) ---------- */
  const MDL = {}; let FDT = .016;
  function mdl(nm) {
    if (MDL[nm] !== undefined) return MDL[nm];
    if (nm.indexOf('boss:') === 0) { const B = skM(nm.slice(5)); if (!B) return (MDL[nm] = null); const nv = B.nf * 3, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3);
      for (let f = 0; f < nv; f++) { const v = B.F[f]; for (let j = 0; j < 3; j++) { P[f * 3 + j] = B.P[v * 3 + j]; N[f * 3 + j] = B.N[v * 3 + j] / 127; C[f * 3 + j] = B.C[v * 3 + j] / 255; } }
      return (MDL[nm] = { n: B.nf, nv, P, N, C, part: null, sk: false }); }
    const R = window.RDO_MODELS && window.RDO_MODELS[nm]; if (!R) return (MDL[nm] = null);
    try {
      const dec = (b, Ty) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Ty(u.buffer); };
      const p = dec(R.p, Int16Array), q = dec(R.q, Int8Array), c = dec(R.c, Uint8Array), nv = R.n * 3, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3);
      for (let i = 0; i < nv * 3; i++) { P[i] = p[i] / 32767 * R.ext[i % 3]; N[i] = q[i] / 127; }
      for (let f = 0; f < R.n; f++) for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) C[(f * 3 + k) * 3 + j] = c[f * 3 + j] / 255;
      return (MDL[nm] = { n: R.n, nv, P, N, C, part: R.part ? dec(R.part, Uint8Array) : null, sk: !!R.ba, ba: R.ba ? dec(R.ba, Uint8Array) : null, bb: R.bb ? dec(R.bb, Uint8Array) : null, bw: R.bw ? dec(R.bw, Uint8Array) : null, piv: R.piv, size: R.size });
    } catch (e) { console.warn('model', nm, e); return (MDL[nm] = null); }
  }
  // draw a baked model: (x, z) ground point, h height, sc units per meter, ry yaw, e glow, pose = 6 part matrices, tint = color multiplier
  function drawModel(M, x, h, z, sc, ry, e, pose, tint) {
    if (HDM && TER && !NOLIFT) h += THc(x, z);
    const need = (n + M.nv) * FL; if (need > buf.length) { const nb = new Float32Array(Math.max(need, buf.length * 2)); nb.set(buf); buf = nb; }
    const cr = Math.cos(ry), sr = Math.sin(ry), P = M.P, Nn = M.N, Cc = M.C, pt = M.part, t0 = tint ? tint[0] : 1, t1 = tint ? tint[1] : 1, t2 = tint ? tint[2] : 1; e = e || 0;
    for (let v = 0; v < M.nv; v++) {
      const i3 = v * 3; let px = P[i3], py = P[i3 + 1], pz = P[i3 + 2], nx = Nn[i3], ny = Nn[i3 + 1], nz = Nn[i3 + 2];
      if (pose && M.sk) { const ma = pose[M.ba[v]], mb = pose[M.bb[v]], w = M.bw[v] / 255, iw = 1 - w;
        const X = (ma[0] * px + ma[1] * py + ma[2] * pz + ma[3]) * iw + (mb[0] * px + mb[1] * py + mb[2] * pz + mb[3]) * w, Y = (ma[4] * px + ma[5] * py + ma[6] * pz + ma[7]) * iw + (mb[4] * px + mb[5] * py + mb[6] * pz + mb[7]) * w, Z = (ma[8] * px + ma[9] * py + ma[10] * pz + ma[11]) * iw + (mb[8] * px + mb[9] * py + mb[10] * pz + mb[11]) * w;
        const a = (ma[0] * nx + ma[1] * ny + ma[2] * nz) * iw + (mb[0] * nx + mb[1] * ny + mb[2] * nz) * w, b = (ma[4] * nx + ma[5] * ny + ma[6] * nz) * iw + (mb[4] * nx + mb[5] * ny + mb[6] * nz) * w, c = (ma[8] * nx + ma[9] * ny + ma[10] * nz) * iw + (mb[8] * nx + mb[9] * ny + mb[10] * nz) * w, l = Math.hypot(a, b, c) || 1;
        px = X; py = Y; pz = Z; nx = a / l; ny = b / l; nz = c / l; }
      else if (pose && pt) { const m = pose[pt[v]], X = m[0] * px + m[1] * py + m[2] * pz + m[3], Y = m[4] * px + m[5] * py + m[6] * pz + m[7], Z = m[8] * px + m[9] * py + m[10] * pz + m[11], a = m[0] * nx + m[1] * ny + m[2] * nz, b = m[4] * nx + m[5] * ny + m[6] * nz, c = m[8] * nx + m[9] * ny + m[10] * nz; px = X; py = Y; pz = Z; nx = a; ny = b; nz = c; }
      const o = n * FL; buf[o] = x + (px * cr - pz * sr) * sc; buf[o + 1] = h + py * sc; buf[o + 2] = z + (px * sr + pz * cr) * sc;
      buf[o + 3] = nx * cr - nz * sr; buf[o + 4] = ny; buf[o + 5] = nx * sr + nz * cr; buf[o + 6] = Cc[i3] * t0; buf[o + 7] = Cc[i3 + 1] * t1; buf[o + 8] = Cc[i3 + 2] * t2; buf[o + 9] = 1; buf[o + 10] = e; n++;
    }
  }
  // tiny affine helpers for the jointed astronaut
  const rotM = (ax, a) => { const c = Math.cos(a), s = Math.sin(a); return ax === 0 ? [1, 0, 0, 0, c, -s, 0, s, c] : ax === 1 ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const m3 = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  const aff = (R, p, t) => { t = t || [0, 0, 0]; return [R[0], R[1], R[2], p[0] - (R[0] * p[0] + R[1] * p[1] + R[2] * p[2]) + t[0], R[3], R[4], R[5], p[1] - (R[3] * p[0] + R[4] * p[1] + R[5] * p[2]) + t[1], R[6], R[7], R[8], p[2] - (R[6] * p[0] + R[7] * p[1] + R[8] * p[2]) + t[2]]; };
  const am = (A, B) => { const o = new Array(12); for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) o[i * 4 + j] = A[i * 4] * B[j] + A[i * 4 + 1] * B[4 + j] + A[i * 4 + 2] * B[8 + j]; o[i * 4 + 3] = A[i * 4] * B[3] + A[i * 4 + 1] * B[7] + A[i * 4 + 2] * B[11] + A[i * 4 + 3]; } return o; };
  const apt = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /* ---------- v32: robot dog, level-up base (each upgrade adds detail, like Clash of Clans), boss detail layer ---------- */
  // quadruped robot dog in the style of real legged robots: jointed legs with a diagonal trot, sensor head, lidar dome
  function roboDog(dg) {
    const ang = heading(dg, dg.f > 0 ? 0 : Math.PI), ca = Math.cos(ang), sa = Math.sin(ang), t = T(), at = (f, q) => [dg.x + ca * f - sa * q, dg.y + sa * f + ca * q], RY = ang + Math.PI / 2;
    const mv = memo.get(dg); const moving = mv ? Math.hypot(dg.x - mv.x, dg.y - mv.y) > .01 || true : true;
    const ph = (dg.walk || 0) * 14, dig = dg.dg > 0 || dg.dig > 0, bob = Math.abs(Math.sin(ph)) * .3, YEL = '#f2c230', DK = '#2b2f38', GR = '#cfd4dd', H0 = 7.4 + bob - (dig ? 1.4 : 0);
    const limb = (p, h, len, w, th, c) => { put(CYL, p[0], h, p[1], w, len, w, RY, Math.PI + th, c, 0); return [p[0] + ca * Math.sin(th) * len, h - Math.cos(th) * len, p[1] + sa * Math.sin(th) * len]; };
    for (const [f, q, o, front] of [[3.7, 1, 0, 1], [3.7, -1, Math.PI, 1], [-3.7, 1, Math.PI, 0], [-3.7, -1, 0, 0]]) {
      const s1 = Math.sin(ph + o) * .42, lift = Math.max(0, Math.cos(ph + o)) * .45, hip = at(f, q * 2.3), hh = H0 - 1.2;
      put(SPHm, hip[0], hh - 1.2, hip[1], 2.4, 2.4, 2.4, 0, 0, DK, 0);
      const kn = limb(hip, hh, 3.7, 1.35, s1 + (front ? -.55 : .55), YEL);
      put(SPHm, kn[0], kn[1] - .85, kn[2], 1.7, 1.7, 1.7, 0, 0, DK, 0);
      const ft = limb([kn[0], kn[2]], kn[1], 3.9, 1.05, s1 + (front ? .6 + lift : -.6 - lift), DK);
      put(SPHm, ft[0], Math.max(0, ft[1]) - .6, ft[2], 1.6, 1.3, 1.6, 0, 0, '#16181d', 0);
    }
    put(RBOX, dg.x, H0 - 1.6, dg.y, 10.2, 3.4, 4.8, ang, 0, GR, 0);
    put(RBOX, dg.x, H0 + 1.2, dg.y, 8.8, 1.1, 4.2, ang, 0, YEL, .05);
    for (const q of [-1, 1]) { let p = at(0, q * 2.55); put(RBOX, p[0], H0 - 1, p[1], 6.4, 1.8, .4, ang, 0, YEL, .05); p = at(3, q * 2.7); put(SPHm, p[0], H0 - .5, p[1], .55, .55, .55, 0, 0, '#5fe08a', 1.8); }
    const hd = dig ? 1.6 : 0; let p = at(5.8, 0); put(RBOX, p[0], H0 - 1.1 - hd, p[1], 3.2, 2.7, 3.8, ang, 0, DK, 0);
    p = at(7.45, 0); put(RBOX, p[0], H0 - .6 - hd, p[1], .45, 1.2, 3.1, ang, 0, '#7df9ff', 1.8);
    for (const q of [-1, 1]) { p = at(7.6, q * .9); put(SPHm, p[0], H0 - .3 - hd, p[1], .55, .55, .55, 0, 0, '#ffffff', 2.2); }
    p = at(-1.6, 0); put(CYL, p[0], H0 + 2.3, p[1], 2.6, .9, 2.6, 0, 0, DK, 0); put(HEMI, p[0], H0 + 3.15, p[1], 2.3, 1.5, 2.3, 0, 0, '#2a6bd8', .7);
    put(TUBE, p[0], H0 + 3.4, p[1], 2.5, .3, 2.5, t * 3, 0, '#7df9ff', 1.6);
    p = at(-3.6, 1); put(CYL, p[0], H0 + 2.3, p[1], .25, 4.6, .25, 0, 0, GR, 0); put(SPHm, p[0], H0 + 6.8, p[1], .8, .8, .8, 0, 0, Math.floor(t * 2) % 2 ? '#ff3a6a' : '#5a1020', 1.8);
    p = at(4.1, 0); put(TUBE, p[0], H0 - 1.9, p[1], 3.6, .6, 3.6, 0, 0, '#ff3a3a', .9);
    void moving;
  }
  // upgrade tiers: level 2 adds silver trim and corner lights, level 3 adds gold trim, pylons, a beacon and banners
  function hdTier(b, x, y) {
    const lv = b.lv || 1; if (lv < 2) return; const w = b.w, R = w * .62, gold = lv >= 3, tc = gold ? '#ffcf4a' : '#d9dee8', lc = gold ? '#ffd23f' : '#7df9ff';
    put(TUBE, x, .2, y, R * 2, 1.1, R * 2, 0, 0, tc, gold ? .5 : .15); put(CYL, x, 0, y, R * 2.05, .25, R * 2.05, 0, 0, '#3a3f4c', 0);
    for (let i = 0; i < 4; i++) { const q = i * Math.PI / 2 + Math.PI / 4, px = x + Math.cos(q) * R, pz = y + Math.sin(q) * R, ph = gold ? w * .75 : w * .4;
      put(CYL, px, 0, pz, 1.1, ph, 1.1, 0, 0, gold ? '#3a3f4c' : '#8a93a6', 0); put(SPHm, px, ph - .2, pz, 1.7, 1.7, 1.7, 0, 0, lc, 2);
      if (gold) { put(CONE, px, ph + 1.3, pz, 1.6, 2.4, 1.6, 0, 0, '#ffcf4a', .6); put(BOX, px + Math.cos(q) * 1.6, ph - 4, pz + Math.sin(q) * 1.6, .2, 3.4, 2.4, q, 0, i % 2 ? '#ff3a4a' : '#2a6bd8', .2); } }
    if (gold) { put(CYL, x, w * .95, y, .6, w * .25, .6, 0, 0, '#c9ccd6', 0); put(SPHm, x, w * 1.2, y, 2.4, 2.4, 2.4, 0, 0, '#ffd23f', 2.4); }
  }
  // the base core grows with every upgrade
  function coreUp(b, x, y) {
    const lv = b.lv || 1, w = b.w, DSN = mdl('dsn'), HAB = mdl('hab'), sc = 1.15 / 3.8 * w;
    // level 1: a radio mast
    put(CYL, x - w * .35, w * .55, y + w * .05, .5, w * .45, .5, 0, 0, '#c9ccd6', 0); put(SPHm, x - w * .35, w * 1, y + w * .05, 1.2, 1.2, 1.2, 0, 0, '#ff4040', 1.6);
    if (lv >= 2) { // solar wings, an airlock tube and a small deep-space dish
      for (const q of [-1, 1]) { put(CYL, x, w * .5, y + q * w * .45, .7, w * .35, .7, 0, Math.PI / 2 * q, '#8a93a6', 0);
        for (let k = 0; k < 3; k++) put(BOX, x - w * .3 + k * w * .3, w * .52, y + q * (w * .8 + 2), w * .27, .35, w * .32, 0, 0, '#2a4ea8', .25); }
      put(CYL, x + w * .55, 0, y + w * .1, w * .2, w * .22, w * .2, 0, 0, '#dfe3ea', 0); put(TUBE, x + w * .55, w * .1, y + w * .1, w * .22, w * .04, w * .22, 0, 0, '#ff8a3d', .4);
      if (DSN) drawModel(DSN, x - w * .55, 0, y - w * .55, .42, .9, 0);
    }
    if (lv >= 3) { // second habitat module, greenhouse dome, landing pad, gold trim and a flag
      if (HAB) drawModel(HAB, x + w * .1, 0, y - w * .95, sc * .75, Math.PI / 2, 0);
      put(CYL, x + w * .95, 0, y - w * .7, w * .5, 1, w * .5, 0, 0, '#c9ccd6', 0); put(HEMI, x + w * .95, 1, y - w * .7, w * .46, w * .32, w * .46, 0, 0, '#9fe8c8', .45);
      for (let i = 0; i < 5; i++) put(SPHm, x + w * .95 + Math.cos(i * 1.26) * w * .15, 2, y - w * .7 + Math.sin(i * 1.26) * w * .15, 2.4, 2.8, 2.4, 0, 0, '#5fe08a', .4);
      put(CYL, x - w * .1, .05, y + w * 1.15, w * .7, .4, w * .7, 0, 0, '#3a3f4c', 0); put(TUBE, x - w * .1, .3, y + w * 1.15, w * .62, .3, w * .62, 0, 0, '#ffcf4a', 1.2);
      for (let i = 0; i < 6; i++) { const q = i * 1.047; put(SPHm, x - w * .1 + Math.cos(q) * w * .33, .4, y + w * 1.15 + Math.sin(q) * w * .33, 1, 1, 1, 0, 0, '#7df9ff', 2); }
      put(CYL, x + w * .45, 0, y + w * .55, .45, w * 1.1, .45, 0, 0, '#dddddd', 0); put(BOX, x + w * .45 + 2.6, w * .85, y + w * .55, 5.2, 3.2, .25, 0, 0, '#2a6bd8', .15); put(BOX, x + w * .45 + 2.6, w * .85 + 1.1, y + w * .55, 5.2, .7, .3, 0, 0, '#ff3a4a', .2);
    }
  }
  function hdTierB(b) {
    if (b.pop != null && b.pop < .4) return; if ((b.lv || 1) < 2) return; const x = b.x + b.w / 2, y = b.y + b.w / 2;
    if (!b._tier) Object.defineProperty(b, '_tier', { value: {}, enumerable: false });
    cached(b._tier, 'tier' + b.t + b.w + ':' + b.lv, () => hdTier(b, x, y));
  }
  // boss detail layer: a clear glowing weak point, a wind-up warning before attacks, and a signature crown or halo for each boss
  function bossHD(a, ang) {
    const t = T(), x = a.x, y = a.y, ca = Math.cos(ang), sa = Math.sin(ang), at = (f, s) => [x + ca * f - sa * s, y + sa * f + ca * s], c = (a.ph2 || a.rg) ? '#ff2a2a' : (BCOL[a.ty] || '#ff5a7a'), st = a.stun > 0, pul = .5 + .5 * Math.sin(t * 5), R = (a.r || 16) * 1.7;
    if (a.ty === 'worm' && a.hid) return;
    const WP_ = { golem: [10, 18], scorch: [3, 13], kraken: [10, 12], queen: [2, 13], colossus: [8, 16], worm: [0, 30] }[a.ty] || [6, 14], wp = at(WP_[0], 0), wr = st ? 6 : 3.4 + pul;
    put(SPHm, wp[0], WP_[1] - wr / 2, wp[1], wr, wr, wr, 0, 0, st ? '#ffffff' : '#fff6d0', st ? 3.4 : 2.4);
    put(SPHm, wp[0], WP_[1] - wr * 1.2, wp[1], wr * 2.4, wr * 2.4, wr * 2.4, 0, 0, st ? '#ffffff' : c, 2.4, st ? .5 : .3, true);
    if (a.cd != null && a.cd < .9 && !st) { const k = 1 - a.cd / .9; put(TUBE, x, .4, y, R * (1.2 + k * 1.4) * 2, 1, R * (1.2 + k * 1.4) * 2, 0, 0, '#ff3a3a', 2.4, .25 + .5 * k, true); }
    const HZ = { golem: 40, scorch: 26, kraken: 44, queen: 30, colossus: 40, worm: 0 }[a.ty] || 34, hal = at(-4, 0), hy = HZ + Math.sin(t * 2) * 1.2;
    if (a.ty === 'golem' || a.ty === 'colossus') { put(TUBE, hal[0], hy, hal[1], 18, 1, 18, ang - Math.PI / 2, Math.PI / 2, c, 2.2); put(TUBE, hal[0], hy, hal[1], 13, .8, 13, ang - Math.PI / 2, Math.PI / 2 + Math.sin(t) * .2, '#ffffff', 1.6);
      for (let i = 0; i < 3; i++) { const q = t * 1.2 + i * 2.094; put(CONE, x + Math.cos(q) * R * 1.1, 18 + Math.sin(t * 2 + i) * 4, y + Math.sin(q) * R * 1.1, 3.2, 9, 3.2, q, .5, '#bff4ff', 1.8); } }
    else if (a.ty === 'queen') { for (let i = 0; i < 7; i++) { const q = i / 7 * 6.283 + t * .4, p = at(13 + Math.cos(q) * 5.5, Math.sin(q) * 5.5); put(CONE, p[0], 25 + Math.sin(t * 3 + i) * .6, p[1], 1.8, 5.5, 1.8, q, 0, '#ffd23f', 1.4); } put(TUBE, at(13, 0)[0], 24.6, at(13, 0)[1], 13, 1, 13, 0, 0, '#ffd23f', 1.6);
      for (let i = 0; i < 3; i++) { const p = at(-8 - i * 7, 0); put(TUBE, p[0], 10, p[1], 21 - i * 3, 1, 23 - i * 3, ang, 0, c, 1.8 + pul); } }
    else if (a.ty === 'kraken') { const T2 = S.p, la = Math.atan2(T2.y - y, T2.x - x); for (let i = 0; i < 6; i++) { const q = la + (i - 2.5) * .45, px = x - Math.cos(la) * 3 + Math.cos(q) * 9, pz = y - Math.sin(la) * 3 + Math.sin(q) * 9; put(CONE, px, 44, pz, 3.4, 10 + (i % 2) * 5, 3.4, q, -.25, '#d8f4ff', 1.2); }
      for (let i = 0; i < 10; i++) { const q = i * .628 + t * .3; put(SPHm, x + Math.cos(q) * 40, 2 + Math.sin(t + i) * 1.5, y + Math.sin(q) * 32, 6, 2.4, 6, 0, 0, '#e8f6ff', .6, .35, true); } }
    else if (a.ty === 'scorch') { const p = at(-6, 0); put(TUBE, p[0], 12, p[1], 34 + pul * 3, 1.6, 34 + pul * 3, ang - Math.PI / 2, Math.PI / 2, '#ffcf4a', 2.6, .8, true); put(SPHm, p[0], 1, p[1], 22, 22, 22, 0, 0, '#ff7a2a', 2.2, .18, true); }
    else if (a.ty === 'worm') { for (let i = 0; i < 12; i++) { const q = i / 12 * 6.283 + t * 1.5, d = 26 + Math.sin(t * 3 + i) * 3; put(SPHm, x + Math.cos(q) * d, (t * 8 + i * 5) % 30, y + Math.sin(q) * d, 3, 3, 3, 0, 0, S.L.bg[2], .3, .5, true); } }
  }
  /* ---------- v33: the Great Dust Worm in HD (Giant Worm by Vasian-Digital3D, CC-BY-4.0): skinned, animated, with attack effects ---------- */
  let WRM;
  /* the NASA and boss model data arrive after the title screen (they are big); when they land, forget the 'not loaded' answers so the real models appear */
  R3.modelsReady = () => { R3.mv = (R3.mv || 0) + 1; for (const k in SKM) if (!SKM[k]) delete SKM[k]; for (const k in MDL) if (!MDL[k]) delete MDL[k]; if (!WRM) WRM = undefined; };
  function wormM() {
    if (WRM !== undefined) return WRM; const R = window.RDO_WORM; if (!R) return (WRM = null);
    try {
      const dec = (b, Ty) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Ty(u.buffer); };
      const clips = {}; for (const k in R.clips) { const c = R.clips[k], m = dec(c.m, Int16Array), mf = new Float32Array(m.length); for (let i = 0; i < m.length; i++) mf[i] = (i & 3) === 3 ? m[i] / 8000 : m[i] / 16000; clips[k] = { n: c.n, m: mf, h: dec(c.h, Float32Array) }; }
      return (WRM = { nv: R.nv, nf: R.nf, nb: R.nb, fps: R.fps, P: dec(R.p, Float32Array), N: dec(R.n, Int8Array), C: dec(R.c, Uint8Array), F: R.nv < 65536 ? dec(R.f, Uint16Array) : dec(R.f, Uint32Array), J: dec(R.j, Uint8Array), W: dec(R.w, Uint8Array), clips, bot: -R.bbox[0][1], top: R.bbox[1][1] - R.bbox[0][1], BM: new Float32Array(R.nb * 12), BT: new Float32Array(R.nb * 12), SP: new Float32Array(R.nv * 3), SN: new Float32Array(R.nv * 3) });
    } catch (e) { console.warn('worm model', e); return (WRM = null); }
  }
  function wSample(M, clip, tt, loop, out) {
    const c = M.clips[clip], n = c.n, nb = M.nb, L = n - 1; let f = tt * M.fps;
    if (loop) { f = f % (2 * L); if (f > L) f = 2 * L - f; } else f = Math.min(L, Math.max(0, f));
    const i0 = Math.floor(f), i1 = Math.min(L, i0 + 1), u = f - i0, A = c.m, o0 = i0 * nb * 12, o1 = i1 * nb * 12;
    for (let i = 0; i < nb * 12; i++) out[i] = A[o0 + i] * (1 - u) + A[o1 + i] * u;
    const H = c.h, r = []; for (let k = 0; k < 6; k++) r.push(H[i0 * 6 + k] * (1 - u) + H[i1 * 6 + k] * u); return r;
  }
  const WST = new WeakMap();
  function wormHD(a, ang, fl, t, x, y) {
    const M = wormM(), cw = S.cin && S.cin.k === 'boss', G = gOf() * 9, SC = 24, sand = S.L.bg[2], dark = S.L.bg[3];
    let st = WST.get(a); if (!st) { st = { clip: 'idle', t0: t, sp: 1, once: 0, lc: 0, up: 0, upT: -9, pclip: null, pt0: 0, psp: 1, ploop: 1, ft0: -9, atk: -1, atT: -9, atD: 1 }; WST.set(a, st); }
    { const T2 = typeof tgtP === 'function' ? tgtP(a) : S.p, ta = Math.atan2(T2.y - y, T2.x - x); if (st.ang == null) st.ang = ta; let d = ta - st.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; st.ang += d * Math.min(1, FDT * 2.5); ang = st.ang; }
    const play = (c, sp, once) => { if (st.clip === c && !once) return; st.pclip = st.clip; st.pt0 = st.t0; st.psp = st.sp; st.ploop = !st.once; st.ft0 = t; st.clip = c; st.t0 = t; st.sp = sp; st.once = once; };
    const up = !a.hid || cw;
    if (up && !st.up) { st.upT = t; play('roar', 1.7, 1); } st.up = up ? 1 : 0;
    // underground: a dirt mound plows toward you; warning: glowing cracks, jumping rocks and dust
    if (!up) {
      const tele = a.st === 'tele', k = tele ? clamp(1 - a.tm / 1.1, 0, 1) : 0;
      put(HEMI, x, -1.5, y, 26 + k * 16, 7 + k * 6 + Math.sin(t * 9) * 1.2, 26 + k * 16, 0, 0, dark, 0);
      for (let i = 0; i < 7; i++) { const q = i * .9 + t * 2, d = 9 + (i % 3) * 4; put(ROCKS[i % 4], x + Math.cos(q) * d, 2 + Math.abs(Math.sin(t * 11 + i)) * (2 + k * 6), y + Math.sin(q) * d, 3, 2.2, 3, q, 0, dark, 0); }
      for (let i = 0; i < 6; i++) { const q = i * 1.05 + t, z = (t * 1.3 + i * .17) % 1; put(SPHm, x + Math.cos(q) * 12, z * 16, y + Math.sin(q) * 12, 5 + z * 7, 5 + z * 7, 5 + z * 7, 0, 0, sand, .2, .45 * (1 - z), true); }
      if (tele) { for (let i = 0; i < 12; i++) { const q = i / 12 * 6.283 + .3, L = 8 + k * 34; put(BOX, x + Math.cos(q) * L / 2, .25, y + Math.sin(q) * L / 2, L, .5, 1.3, q, 0, '#ff7a2a', 1.2 + k * 2.2); }
        put(CYL, x, .2, y, 20 + k * 30, .4, 20 + k * 30, 0, 0, '#ff4a1a', 1.4 + k * 2, .25 + .35 * k, true); }
      return;
    }
    if (a.roarT && a.roarT !== st.roarT) { st.roarT = a.roarT; play('roar', 1.3, 1); }
    if (a.stun > 0) { if (st.clip !== 'hurt') play('hurt', 1.5, 1); }
    else if ((a.cast || 0) > st.lc + .05) { const c = ['slam', 'lunge', 'combo', 'slam', 'lunge', 'roar'][a.la] || 'slam', D = Math.max(1.1, (a.cast || 1) * 1.15); play(c, (M.clips[c].n - 1) / M.fps / D, 1); st.atk = a.la; st.atT = t; st.atD = D; }
    st.lc = a.cast || 0;
    if (st.once && (t - st.t0) * st.sp * M.fps >= M.clips[st.clip].n - 1 && !(a.stun > 0)) play('idle', a.ph2 ? 1.7 : 1, 0);
    // pose: blend from the previous clip over 0.25 s
    let hd = wSample(M, st.clip, (t - st.t0) * st.sp, !st.once, M.BM); const fk = clamp((t - st.ft0) / .25, 0, 1);
    if (fk < 1 && st.pclip) { const h2 = wSample(M, st.pclip, (t - st.pt0) * st.psp, st.ploop, M.BT); for (let i = 0; i < M.BM.length; i++) M.BM[i] = M.BT[i] * (1 - fk) + M.BM[i] * fk; hd = hd.map((v, i) => h2[i] * (1 - fk) + v * fk); }
    // rise out of the ground, sink back down
    const re = cw ? 1 : clamp((t - st.upT) / .55, 0, 1), rise = 1 - Math.pow(1 - re, 3), sink = !cw && a.st === 'up' && a.tm < .45 && (a.cast || 0) <= 0 ? clamp((.45 - a.tm) / .45, 0, 1) : 0;
    const off = -(1 - rise + sink) * M.top * SC * 1.05, gy = (TER ? THc(x, y) : 0), base = gy + M.bot * SC + off;
    // skin the vertices
    const B = M.BM, P = M.P, Nn = M.N, Jn = M.J, Wt = M.W, SP = M.SP, SN = M.SN;
    for (let v = 0; v < M.nv; v++) {
      const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], nx = Nn[v * 3] / 127, ny = Nn[v * 3 + 1] / 127, nz = Nn[v * 3 + 2] / 127;
      let X = 0, Y = 0, Z = 0, A = 0, Bn = 0, Cn = 0;
      for (let k = 0; k < 4; k++) { const w = Wt[v * 4 + k]; if (!w) continue; const ww = w / 255, o = Jn[v * 4 + k] * 12;
        X += (B[o] * px + B[o + 1] * py + B[o + 2] * pz + B[o + 3]) * ww; Y += (B[o + 4] * px + B[o + 5] * py + B[o + 6] * pz + B[o + 7]) * ww; Z += (B[o + 8] * px + B[o + 9] * py + B[o + 10] * pz + B[o + 11]) * ww;
        A += (B[o] * nx + B[o + 1] * ny + B[o + 2] * nz) * ww; Bn += (B[o + 4] * nx + B[o + 5] * ny + B[o + 6] * nz) * ww; Cn += (B[o + 8] * nx + B[o + 9] * ny + B[o + 10] * nz) * ww; }
      const l = Math.hypot(A, Bn, Cn) || 1; SP[v * 3] = X; SP[v * 3 + 1] = Y; SP[v * 3 + 2] = Z; SN[v * 3] = A / l; SN[v * 3 + 1] = Bn / l; SN[v * 3 + 2] = Cn / l;
    }
    const need = (n + M.nf * 3) * FL; if (need > buf.length) { const nb = new Float32Array(Math.max(need, buf.length * 2)); nb.set(buf); buf = nb; }
    const cr = Math.cos(ang), sr = Math.sin(ang), rg = a.ph2 || a.rg, Cc = M.C, Fi = M.F, e = fl + (a.stun > 0 ? .3 : 0), tr = rg ? 1.25 : 1, tg_ = rg ? .8 : 1;
    for (let f = 0; f < M.nf * 3; f++) {
      const v = Fi[f], o = n * FL, px = SP[v * 3], py = SP[v * 3 + 1], pz = SP[v * 3 + 2], nx = SN[v * 3], nz = SN[v * 3 + 2];
      buf[o] = x + (px * cr - pz * sr) * SC; buf[o + 1] = base + py * SC; buf[o + 2] = y + (px * sr + pz * cr) * SC;
      buf[o + 3] = nx * cr - nz * sr; buf[o + 4] = SN[v * 3 + 1]; buf[o + 5] = nx * sr + nz * cr;
      buf[o + 6] = Cc[v * 3] / 255 * tr; buf[o + 7] = Cc[v * 3 + 1] / 255 * tg_; buf[o + 8] = Cc[v * 3 + 2] / 255 * tg_; buf[o + 9] = 1; buf[o + 10] = e; n++;
    }
    const W_ = p => [x + (p[0] * cr - p[2] * sr) * SC, base + p[1] * SC, y + (p[0] * sr + p[2] * cr) * SC];
    const H = W_(hd), Jw = W_([hd[3], hd[4], hd[5]]); NOLIFT = true;
    try {
      // glowing throat (the weak point) and drool of sand from the jaws
      const mo = [(H[0] * 2 + Jw[0]) / 3, (H[1] * 2 + Jw[1]) / 3, (H[2] * 2 + Jw[2]) / 3], pul = .5 + .5 * Math.sin(t * 7), ex = a.stun > 0 || a.rec > 0, wr = ex ? 7 + pul * 2 : 3 + pul;
      if (a.inv > 0) { put(SPHm, x, base - 2, y, 46, M.top * SC * 1.1, 46, 0, 0, '#ffcf4a', 2.2, .12 + .1 * pul, true); }
      if (a.rec > 0) for (let i = 0; i < 6; i++) { const q = t * 4 + i * 1.047; put(CONE, mo[0] + Math.cos(q) * 9, mo[1] - 2, mo[2] + Math.sin(q) * 9, 1.4, 4, 1.4, q, Math.PI, '#ffd23f', 2.4); }
      put(SPHm, mo[0], mo[1] - wr / 2, mo[2], wr, wr, wr, 0, 0, a.stun > 0 ? '#ffffff' : rg ? '#ff3a1a' : '#ffb040', 2.8);
      put(SPHm, mo[0], mo[1] - wr * 1.3, mo[2], wr * 2.6, wr * 2.6, wr * 2.6, 0, 0, rg ? '#ff2a1a' : '#ff8a3d', 2.4, .28, true);
      for (let i = 0; i < 5; i++) { const z = (t * 1.6 + i * .2) % 1; put(SPHm, Jw[0] + Math.sin(i * 7) * 2, Jw[1] - z * (Jw[1] - gy), Jw[2] + Math.cos(i * 5) * 2, 1.2, 1.2, 1.2, 0, 0, sand, .3, .7 * (1 - z), true); }
      // the hole it burst out of
      put(CYL, x, gy + .15, y, 52, .5, 52, 0, 0, '#1a0c06', 0); for (let i = 0; i < 10; i++) { const q = i * .628 + .2; put(ROCKS[i % 4], x + Math.cos(q) * 26, gy - 1, y + Math.sin(q) * 26, 9, 5, 8, q, 0, dark, 0); }
      // eruption: rocks thrown on real-gravity arcs, a dust column and a shockwave
      const ee = t - st.upT;
      if (ee < 2.2 && !cw) {
        for (let i = 0; i < 18; i++) { const q = i * .349 + Math.sin(i * 3) * .3, v = 38 + (i * 37 % 34), vz = 55 + (i * 53 % 45), hh = vz * ee - .5 * G * ee * ee; if (hh <= 0 && ee > .3) continue; const d = v * ee, sz = 2.4 + (i % 4) * 1.3; put(ROCKS[i % 4], x + Math.cos(q) * d, gy + Math.max(0, hh), y + Math.sin(q) * d, sz, sz * .8, sz, ee * 4 + i, ee * 3, i % 3 ? dark : sand, 0); }
        const k = clamp(ee / 1.6, 0, 1); for (let i = 0; i < 6; i++) { const r = 16 + i * 6 + k * 30; put(SPHm, x + Math.sin(i * 2) * 14 + 18, gy + i * 8 * (1 + k), y + Math.cos(i * 2) * 14, r * .7, r * .6, r * .7, 0, 0, sand, .15, .3 * (1 - k), true); }
        const rr = 20 + ee * 140; put(TUBE, x, gy + .5, y, rr, 1.4, rr, 0, 0, '#ffd8a8', 2.2, Math.max(0, .8 - ee * .45), true);
      }
      // attack effects
      const p = (t - st.atT) / st.atD;
      if (st.atk === 0 && p < 1.6) { if (p > .72) { const k = (p - .72) / .9; put(TUBE, x, gy + .4, y, 30 + k * 220, 1.4, 30 + k * 220, 0, 0, '#ffb070', 2.4, Math.max(0, .85 - k), true); }
        S.hz.forEach(h => { if (h.k !== 'beam' || Math.hypot(h.x - x, h.y - y) > 6) return; const act = h.t <= 0, ca = Math.cos(h.a), sa = Math.sin(h.a);
          for (let s2 = 1; s2 <= 7; s2++) { const d = s2 / 7 * h.len, j = Math.sin(t * 17 + s2 * 3 + h.a * 5), ht = act ? 8 + j * 5 + (7 - s2) : 1 + Math.abs(j); put(SPHm, x + ca * d, gy + ht * .3, y + sa * d, act ? 7 : 3, act ? ht : 2, act ? 7 : 3, 0, 0, act ? sand : '#ff7040', act ? .4 : 1.6, act ? .6 : .5, true); } }); }
      if (st.atk === 1 && p > .45 && p < 1.2) { const k = (p - .45) / .75; for (let i = 0; i < 14; i++) { const q = ang + (i / 13 - .5) * 3.3 * k, d = 40 + 50 * k; put(SPHm, x + Math.cos(q) * d, gy + 2 + Math.sin(i) * 2, y + Math.sin(q) * d, 9, 6, 9, 0, 0, sand, .2, .55 * (1 - k), true); } }
      S.hz.forEach(h => { if (h.k !== 'circle' || !h.why || h.why.indexOf('Spit') < 0 || h.t <= 0) return; const u = 1 - h.t / (h.t0 || 1), px = Jw[0] + (h.x - Jw[0]) * u, pz = Jw[2] + (h.y - Jw[2]) * u, ph = Jw[1] * (1 - u) + Math.sin(u * Math.PI) * 40;
        put(SPHm, px, ph - 2.5, pz, 5, 5, 5, 0, 0, '#a8ff3a', 2.6); put(SPHm, px, ph - 4.5, pz, 9, 9, 9, 0, 0, '#5fe08a', 2, .35, true);
        for (let k = 1; k < 5; k++) { const u2 = Math.max(0, u - k * .05); put(SPHm, Jw[0] + (h.x - Jw[0]) * u2, Jw[1] * (1 - u2) + Math.sin(u2 * Math.PI) * 40 - 1.5, Jw[2] + (h.y - Jw[2]) * u2, 3 - k * .5, 3 - k * .5, 3 - k * .5, 0, 0, '#a8ff3a', 2, .5 - k * .1, true); } });
      if (st.clip === 'roar' && (t - st.t0) * st.sp < 2.4) for (let i = 0; i < 2; i++) { const k = (((t - st.t0) * st.sp * .8) + i * .5) % 1; put(TUBE, H[0], H[1] - 2, H[2], 10 + k * 60, 1, 10 + k * 60, ang - Math.PI / 2, Math.PI / 2, '#ffe0b0', 2, .5 * (1 - k), true); }
    } finally { NOLIFT = false; }
    if (a.stun > 0) stunStars(x, y, M.top * SC * .9);
  }
  // rounded box (smooth bevels) used instead of hard boxes in HD
  const RBOX = (() => { const g = [-1, -.76, 0, .76, 1], r = .24, o = [], cl = v => Math.max(-(1 - r), Math.min(1 - r, v));
    const pt = (x, y, z) => { const cx = cl(x), cy = cl(y), cz = cl(z); let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; return [(cx + dx * r) * .5, (cy + dy * r) * .5 + .5, (cz + dz * r) * .5, dx, dy, dz]; };
    const face = (f) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const q = [[g[i], g[j]], [g[i + 1], g[j]], [g[i + 1], g[j + 1]], [g[i], g[j + 1]]].map(([u, v]) => pt(...f(u, v))); [[0, 1, 2], [0, 2, 3]].forEach(tr => { let A = q[tr[0]], B = q[tr[1]], C = q[tr[2]]; const nn = cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]), m = [(A[3] + B[3] + C[3]), (A[4] + B[4] + C[4]), (A[5] + B[5] + C[5])]; if (dot(nn, m) < 0) { const tmp = B; B = C; C = tmp; } o.push(...A, ...B, ...C); }); } };
    face((u, v) => [1, u, v]); face((u, v) => [-1, u, v]); face((u, v) => [u, 1, v]); face((u, v) => [u, -1, v]); face((u, v) => [u, v, 1]); face((u, v) => [u, v, -1]);
    return new Float32Array(o); })();
  // smooth turning for your astronaut
  const FCE = { a: null };
  function faceS() { const tA = Math.atan2(S.face.y, S.face.x); if (FCE.a == null) FCE.a = tA; let d = tA - FCE.a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; FCE.a += d * (1 - Math.exp(-13 * Math.max(.004, FDT))); return FCE.a; }
  // bosses in HD: energy shards orbit them, a glowing ground ring pulses, sparks rise
  // phase cues in 3D: gold shield while immune, gold spikes over the weak point in a punish window, stars when staggered
  function bossPh(a) {
    const t = T(), r = (a.r || 14) * 1.7, gy = HDM && TER ? THc(a.x, a.y) : 0, pul = .5 + .5 * Math.sin(t * 10);
    if (a.inv > 0) put(SPHm, a.x, gy + r * .7, a.y, r * 1.3, r * 1.3, r * 1.3, 0, 0, '#ffcf4a', 2.2, .14 + .1 * pul, true);
    if (a.rec > 0) for (let i = 0; i < 6; i++) { const q = t * 4 + i * 1.047; put(CONE, a.x + Math.cos(q) * r * .8, gy + r * 2.1 + pul * 2, a.y + Math.sin(q) * r * .8, 1.6, 5, 1.6, q, Math.PI, '#ffd23f', 2.4); }
    if (a.stg > 0) for (let i = 0; i < 5; i++) { const q = t * 5 + i * 1.257; put(SPH, a.x + Math.cos(q) * r * .7, gy + r * 2 + Math.sin(q * 2) * 2, a.y + Math.sin(q) * r * .7, 1.8, 1.8, 1.8, 0, 0, '#fff36b', 2.5); }
  }
  function bossAura(a) {
    const t = T(), c = (BCOL && BCOL[a.ty]) || '#ff5a7a', R_ = (a.r || 14) * 2.2;
    for (let i = 0; i < 10; i++) { const q = t * (i % 2 ? 1.1 : -.8) + i * .628, h = 6 + (i % 3) * 7 + Math.sin(t * 2 + i) * 2; put(CONE, a.x + Math.cos(q) * R_, h, a.y + Math.sin(q) * R_, 1.6, 4.5, 1.6, q, .4 * Math.sin(t + i), c, 2.4); }
    put(CYL, a.x, .3, a.y, R_ * 2.2, .3, R_ * 2.2, 0, 0, c, 1.8, .22 + .12 * Math.sin(t * 4), true);
    for (let i = 0; i < 8; i++) { const k = (t * .6 + i / 8) % 1, q = i * 2.4; put(SPHm, a.x + Math.cos(q) * R_ * .6, k * 40, a.y + Math.sin(q) * R_ * .6, 1, 1, 1, 0, 0, c, 2.6, 1 - k, true); }
  }
  // the NASA astronaut with a 10-bone skeleton (smooth skin at shoulders, elbows, hips, knees and neck); poses blend smoothly
  const PSM = {};
  function astroX(x, y, ang, walk, SU, job, scale, drive, mvk, jz, me, mname) {
    if (drive) return; const hero = job === '#ffd23f', M = mdl(mname || (me && (R3.cm === 'fp' || R3.cm === 'chase' || (R3.zoom || 1) < .75) ? 'astro' : 'astroL'));
    if (!M || !M.sk) return mname ? null : astroHD(x, y, ang, walk, SU, job, scale, drive, mvk, jz, me);
    const t = T(), pv = M.piv, H = 1.85, shX = pv.sh[0], shY = pv.sh[1], elX = pv.el, hpX = pv.hip[0], hpY = pv.hip[1], knY = pv.knee, nkY = pv.neck;
    mvk = mvk == null ? 1 : mvk; const ph = walk * 11, sw = Math.sin(ph) * mvk, air = (jz || 0) > 1.5;
    // pose channels: 0 tw,1 lean,2 roll,3 bob,4 nod,5 aRdn,6 aRsw,7 aLdn,8 aLsw,9 eR,10 eL,11 lR,12 lL,13 kR,14 kL,15 sR,16 sL,17 flip
    const A = [0, .04 * mvk, Math.sin(ph) * .03 * mvk, Math.abs(Math.cos(ph)) * .03 * mvk + Math.sin(t * 1.6) * .004, Math.sin(t * 1.3) * .03,
      1.3, -sw * .5, 1.3, sw * .5, .25 + Math.max(0, sw) * .3 * mvk, .25 + Math.max(0, -sw) * .3 * mvk,
      sw * .6, -sw * .6, Math.max(0, -Math.sin(ph - .6)) * 1.1 * mvk + .06, Math.max(0, Math.sin(ph - .6)) * 1.1 * mvk + .06, 0, 0, 0];
    const armed = me || hero || !!mname;
    if (armed) { A[5] = 1.32; A[6] = .95; A[9] = .75; A[7] = 1.18; A[8] = .75; A[10] = 1.05; A[0] = -.15; }
    if (air) { A[11] = .6; A[13] = 1.1; A[12] = -.15; A[14] = .5; A[5] = .45; A[6] = .25; A[7] = .45; A[8] = .25; A[9] = A[10] = .4; A[3] = 0;
      if (me && S.glide) { A[5] = A[7] = .05; A[6] = A[8] = -.1; A[9] = A[10] = .1; A[11] = A[12] = -.2; A[13] = A[14] = .3; A[1] = .5; } }
    const E = me ? S.emo : (S.emo && (S.emo.k === 'dance' || S.emo.k === 'party') && Math.hypot(x - S.p.x, y - S.p.y) < 110 ? S.emo : null);
    let showGun = armed && !(me && S.glide);
    if (E && (!air || E.k === 'flip')) {
      showGun = false; const et = t - E.t0 + (me ? 0 : (Math.abs(x * .37 + y * .11) % 1)), bt = et * 2.2 * Math.PI, b = Math.sin(bt), b2 = Math.sin(bt * 2), bs = b * Math.abs(b);
      if (E.k === 'dance' || E.k === 'party') { const mv_ = Math.floor(et / 2.73) % 4; A[3] = Math.abs(b2) * .06; A[11] = Math.max(0, b) * .45; A[12] = Math.max(0, -b) * .45; A[13] = Math.max(0, b) * .8 + .1; A[14] = Math.max(0, -b) * .8 + .1; A[4] = b2 * .08;
        if (mv_ === 0) { A[5] = -1 * bs + .1; A[6] = .35; A[7] = 1 * bs + .1; A[8] = .35; A[9] = .3 + .5 * Math.max(0, -b); A[10] = .3 + .5 * Math.max(0, b); A[2] = b * .14; A[0] = b * .25; }
        else if (mv_ === 1) { A[5] = -1 + b * .35; A[6] = .1; A[7] = -1 - b * .35; A[8] = .1; A[9] = A[10] = .2 + .3 * Math.abs(b2); A[2] = b * .22; }
        else if (mv_ === 2) { A[5] = .35 + bs * .5; A[6] = 1.1; A[7] = .35 - bs * .5; A[8] = 1.1; A[9] = 1.5 + b2 * .3; A[10] = 1.5 - b2 * .3; A[0] = bs * .4; A[1] = .08; }
        else { A[5] = .2; A[6] = 1.5 + b * .3; A[7] = .2; A[8] = 1.5 - b * .3; A[9] = A[10] = .4; A[1] = .12; A[0] = Math.sin(bt * .5) * 1.2; A[3] = Math.abs(b) * .05; } }
      else if (E.k === 'wave') { A[5] = -1.3; A[6] = .3; A[9] = .7 + Math.sin(et * 9) * .45; A[7] = 1.3; A[8] = 0; A[0] = .15; A[4] = .06; A[2] = Math.sin(et * 4.5) * .04; }
      else if (E.k === 'cheer') { A[5] = -1.3; A[6] = .15 + Math.sin(et * 12) * .1; A[7] = -1.3; A[8] = .15 - Math.sin(et * 12) * .1; A[9] = A[10] = .15; A[3] = Math.abs(Math.sin(et * 6)) * .12; A[13] = A[14] = Math.abs(Math.sin(et * 6)) * .5; }
      else if (E.k === 'sit') { A[11] = A[12] = 1.45; A[13] = A[14] = 1.35; A[15] = A[16] = .12; A[5] = A[7] = 1.45; A[6] = A[8] = .4; A[9] = A[10] = .9; A[3] = -(hpY - .08) * .95; A[1] = -.06; }
      else if (E.k === 'flip' && air) { const TT_ = 2 * 1.8 / gOf(); A[17] = Math.min(1, (t - E.t0) / TT_ * 1.1) * Math.PI * 2; A[5] = A[7] = -.2; A[6] = A[8] = 1.3; A[11] = A[12] = 1.2; A[13] = A[14] = 1.6; }
    }
    if (me && !E && !(air && S.glide)) {
      const ft = (typeof TT === 'number' && S.fT != null) ? TT - S.fT : 9, aim = ft < .45 ? 1 : 0, kick = Math.max(0, 1 - ft / .09);
      if (aim) { A[5] = 1.45; A[6] = 1.38 - kick * .3; A[9] = .12 + kick * .15; A[7] = 1.12; A[8] = 1.2 - kick * .2; A[10] = .62; A[0] = -.28; A[1] = .05 - kick * .06; A[4] = -.05; }
      A[1] += .13 * Math.min(1, mvk) * (air ? 0 : 1);
      const hf = S.hf > 0 ? Math.min(1, S.hf / .3) : 0; if (hf) { A[1] -= .3 * hf; A[4] -= .25 * hf; A[2] += .12 * hf; A[6] -= .4 * hf; A[8] -= .3 * hf; }
    }
    // v87: grounded movement. Low gravity gives the Apollo-style lope (higher knees, arms held out for balance);
    // you crouch to absorb the landing after a jump, kneel to work when you build, and hold the scanner out while scanning.
    if (!E) { if ((WG[S.lv] || .5) < .2 && mvk > .05 && !air) { A[13] *= 1.3; A[14] *= 1.3; A[6] *= .55; A[8] *= .55; A[5] -= .12; A[7] -= .12; A[1] += .06 * mvk; } }
    if (me && !E) { const tn = typeof TT === 'number' ? TT : t;
      if (PSM._air && !air) S.landT = tn; PSM._air = air;
      const lt = S.landT != null ? tn - S.landT : 9; if (lt < .3 && !air) { const k = 1 - lt / .3; A[13] += .9 * k; A[14] += .9 * k; A[11] += .4 * k; A[12] += .4 * k; A[3] -= .14 * k; A[1] += .12 * k; }
      const bt = S.bldT != null ? tn - S.bldT : 9; if (bt < .8 && mvk < .3 && !air) { showGun = false; const k = Math.min(1, bt / .12) * Math.min(1, (.8 - bt) / .15); A[11] = 1.15 * k; A[13] = 1.7 * k; A[12] = .25 * k; A[14] = .45 * k; A[3] = -.3 * k; A[1] = .25 * k; A[5] = 1.25; A[6] = 1.3; A[9] = .9 + Math.sin(bt * 32) * .25; A[7] = 1.1; A[8] = .9; A[10] = .7; }
      if (S.scanT > 0) { showGun = false; A[5] = 1.5; A[6] = 1.25; A[9] = .3; A[7] = 1.42; A[8] = 1.05; A[10] = .45; A[4] = .16 + Math.sin(tn * 3) * .03; A[0] = Math.sin(tn * 1.7) * .12; } }
    // smooth blending for you and the hero (critically damped); crew use the raw pose
    let Pz = A; if (me || hero) { const key = me ? 'me' : 'hero', pr = PSM[key], k = 1 - Math.exp(-14 * Math.max(.004, FDT));
      if (!pr || pr.length !== A.length) PSM[key] = A.slice(); else { for (let i = 0; i < A.length; i++) pr[i] += (A[i] - pr[i]) * (i === 17 ? 1 : k); } Pz = PSM[key]; }
    const G = am(aff(I3, [0, 0, 0], [0, Pz[3], 0]), aff(rotM(0, -Pz[17]), [0, H * .5, 0]));
    const Tm = am(G, aff(m3(rotM(1, Pz[0]), m3(rotM(0, Pz[1]), rotM(2, Pz[2]))), [0, hpY, 0]));
    const UR = am(Tm, aff(m3(rotM(0, -Pz[6]), rotM(2, Pz[5])), [-shX, shY, 0])), UL = am(Tm, aff(m3(rotM(0, -Pz[8]), rotM(2, -Pz[7])), [shX, shY, 0]));
    const FR = am(UR, aff(rotM(1, Pz[9]), [-elX, shY, 0])), FL = am(UL, aff(rotM(1, -Pz[10]), [elX, shY, 0]));
    const TR = am(G, aff(m3(rotM(0, -Pz[11]), rotM(2, Pz[15])), [-hpX, hpY, 0])), TL = am(G, aff(m3(rotM(0, -Pz[12]), rotM(2, -Pz[16])), [hpX, hpY, 0]));
    const SR = am(TR, aff(rotM(0, Pz[13]), [-hpX, knY, 0])), SL = am(TL, aff(rotM(0, Pz[14]), [hpX, knY, 0]));
    const pose = [Tm, am(Tm, aff(rotM(0, Pz[4]), [0, nkY, 0])), UR, UL, TR, TL, FR, FL, SR, SL];
    const sc = 17 / H * (scale || 1), ry = ang - Math.PI / 2, cr = Math.cos(ry), sr = Math.sin(ry), W = p => [x + (p[0] * cr - p[2] * sr) * sc, p[1] * sc, y + (p[0] * sr + p[2] * cr) * sc];
    drawModel(M, x, 0, y, sc, ry, 0, pose, hero ? [1.05, .9, .6] : job === '#6cc8ff' ? [.8, .9, 1.15] : null);
    if (showGun) { const hd = W(apt(FR, [-pv.hand, shY, 0])); let wc = '#7df9ff'; try { wc = WP[S.wp].col; } catch (e) {} rifle([hd[0] - Math.cos(ang) * 2, hd[2] - Math.sin(ang) * 2], hd[1] - .6, ang, .75, wc, me && S.fT != null ? Math.max(0, 1 - (t - S.fT) / .08) : 0); }
    if (me && TER) {
      const pb = W(apt(Tm, [-.15, 1.6, -.3])), J = S.jz || 0; put(CYL, pb[0], pb[1], pb[2], .35, 6.5, .35, 0, 0, '#c9ccd6', 0); put(SPHm, pb[0], pb[1] + 6.3, pb[2], .7, .7, .7, 0, 0, '#ff4a4a', 1.6); scarf(pb[0], THc(x, y) + J + pb[1] + 6.2, pb[2], ang, '#ff4d5e', J, 5, 1.2, 1.8);
      if (S.glide) { const bk = W(apt(Tm, [0, shY + .05, -.3])), ca = Math.cos(ang), sa = Math.sin(ang), fl = Math.sin(t * 6) * .04;
        for (const q of [-1, 1]) { const px = -sa * q, pz = ca * q;
          put(BOX, bk[0] + px * 7.6, bk[1] - .2, bk[2] + pz * 7.6, 5.2, .35, 12.5, ang, q * (-.2 + fl), '#f4f7fb', .1);
          put(BOX, bk[0] + px * 7.6 + ca * 2.4, bk[1] - .05, bk[2] + pz * 7.6 + sa * 2.4, .8, .4, 12.5, ang, q * (-.2 + fl), '#ff8a3d', .9);
          put(SPHm, bk[0] + px * 13.6, bk[1] - 1, bk[2] + pz * 13.6, 1.1, 1.1, 1.1, 0, 0, '#7df9ff', 2); } }
    }
  }
  // what each building looks like in HD: model, units per meter (times the building width), yaw
  const HDBM = { core: { m: 'hab', k: 1.15 / 3.8, r: 0 }, habitat: { m: 'hab', k: 1.3 / 3.8, r: 0 }, drill: { m: 'rassor', k: 1.15 / 1.55, r: Math.PI / 2 }, farm: { m: 'boss:plant', k: .8, r: 0 } };
  /* dust settling on solar panels (Moon, Mars, Mercury, Ceres): the blue cells turn the colour of the regolith */
  function dustC(b, base) { const d = Math.min(.85, b.dust || 0); if (d < .04) return base; const c0 = col(base), dc = S.lv === 1 ? [.55, .33, .2] : S.lv === 2 ? [.42, .4, .38] : [.5, .5, .52]; return [c0[0] + (dc[0] - c0[0]) * d * .8, c0[1] + (dc[1] - c0[1]) * d * .8, c0[2] + (dc[2] - c0[2]) * d * .8]; }
  function hdBuilding(b, x, y, s, fl) {
    const sp = HDBM[b.t], M = sp && mdl(sp.m); if (!M) return false;
    const dq = b.t === 'solar' ? Math.round((b.dust || 0) * 8) : 0; cached(b, 'hdm' + b.t + ':' + b.w + ':' + (b.lv || 1) + ':' + Math.round(s * 20) + ':' + (fl ? 1 : 0) + ':' + dq, () => { drawModel(M, x, 0, y, sp.k * b.w * s, sp.r, fl ? .6 : 0, undefined, dq ? [1 - dq * .02, 1 - dq * .045, 1 - dq * .075] : undefined); if (b.t === 'core') coreUp(b, x, y); });
    if (b.t === 'farm') { const t = T(), k = .8 * b.w * s, on = !b.off; put(CYL, x, k * .08, y, k * .46, k * .62, k * .46, 0, 0, '#bfe8ff', on ? .35 : .1, .22, true); put(TUBE, x, k * .55, y, k * .47, k * .02, k * .47, 0, 0, '#ff6bd6', on ? 1.6 + .4 * Math.sin(t * 2) : 0);
      if (on) for (let i = 0; i < 5; i++) { const z = (t * .3 + i / 5) % 1; put(SPHm, x + Math.sin(i * 2.4) * k * .12, k * (.12 + z * .5), y + Math.cos(i * 2.4) * k * .12, .7, .7, .7, 0, 0, '#9dffb0', 1.8, 1 - z, true); } }
    if (b.t === 'drill' && !b.off) { const t = T(); put(SPHm, x, 2 + Math.abs(Math.sin(t * 7)) * 1.5, y, 2.4, 2.4, 2.4, 0, 0, '#ffb070', 1.4); }
    if (b.t === 'core') { const t = T(); put(SPHm, x, b.w * .78 * s, y, 2, 2, 2, 0, 0, Math.floor(t * 2) % 2 ? '#5fe08a' : '#1a4a2a', 1.8); }
    return true;
  }
  R3.TH = (x, z) => (HDM && TER ? THc(x, z) : 0);
  R3.g = gOf; R3._scf = SCF;
  R3.hd = false;
  R3.setHD = v => {
    v = !!v; if (v && gl) { try { hdInit(); } catch (e) { console.warn('HD view unavailable', e); v = false; } }
    R3.hd = v; HDM = v && !!prog3; REAL = HDM && !!R3.real; staticLv = -1; rectT = 0; if (HDM && R3.cam !== 'fp' && R3.setCam) R3.setCam('free'); return HDM;
  };

  /* ---------- public API ---------- */
  R3.on = () => (R3.want || R3.tmpOn) && R3.ok && typeof S !== 'undefined' && !!S;
  R3.tmpOn = false;
  R3.tmp = v => { if (v && !gl) { try { R3.ok = init(); } catch (e) { R3.ok = false; } } R3.tmpOn = !!v && R3.ok; if (!R3.tmpOn && !R3.want) R3.hide(); else rectT = 0; };
  R3.cam = 'top'; R3.lp = .1; R3.cm = 'top';
  R3.CAMS = ['top', 'chase', 'free', 'fp'];
  R3.setCam = m => { if (!R3.CAMS.includes(m)) m = 'top'; if (m !== 'top' && R3.cam === 'top' && typeof S !== 'undefined' && S && S.face) { const f = S.face, l = Math.hypot(f.x, f.y) || 1; R3.yaw = Math.atan2(-f.x / l, -f.y / l); yawS = R3.yaw; }
    if (m === 'top' && R3.cam !== 'top') { R3.yaw = Math.round(R3.yaw / (Math.PI / 4)) * Math.PI / 4; }
    R3.cam = m; R3.lp = m === 'fp' ? .1 : .15; try { LS.set('cam3d', m); } catch (e) {} };
  R3.fpl = () => R3.on() && R3.cm !== 'top' && R3.cm !== 'free';
  R3.fwd = () => [-Math.sin(yawS), -Math.cos(yawS)];
  R3.look = (dx, dy) => { R3.yaw -= dx * .0055; R3.lp = clamp(R3.lp + dy * .004, -.45, .75); };
  R3.draw = () => { if (!R3.lzd && window.RDO_LAZY) { R3.lzd = 1; RDO_LAZY(); } try { frame(); } catch (e) { console.warn('3D view error, switching to 2D', e); R3.ok = false; R3.hide(); } };
  const cv0 = () => document.getElementById('c');
  R3.q = 'high'; R3.qs = 'auto'; R3.slowN = 0;
  R3.setQ = v => { R3.qs = v; R3.q = v === 'low' ? 'low' : 'high'; R3.slowN = 0; rectT = 0; };
  R3.hide = () => { if (c3) c3.style.display = 'none'; document.body.classList.remove('v3d'); };
  R3.set = v => {
    R3.want = !!v; try { LS.set('view3d', v ? 1 : 0); } catch (e) {}
    if (v && !gl) { try { R3.ok = init(); } catch (e) { console.warn('WebGL unavailable', e); R3.ok = false; } }
    if (!R3.on()) R3.hide(); else rectT = 0;
    return R3.on();
  };
  R3.rot = (dx, dy, dt) => { if (!R3.on()) return [dx, dy]; if (dt && R3.cm !== 'top' && R3.cm !== 'free') { R3.yaw -= dx * 2.5 * dt; dx = 0; } const c = Math.cos(yawS), s = Math.sin(yawS); return [c * dx + s * dy, -s * dx + c * dy]; };
  R3.unrot = (wx, wy) => { const c = Math.cos(yawS), s = Math.sin(yawS); return [c * wx - s * wy, s * wx + c * wy]; };
  R3.turn = d => { R3.yaw += d; };
  R3.zoomBy = k => { R3.zoom = clamp(R3.zoom * k, .55, 1.8); };
  R3.hq = () => HQ;
  R3.pick = (cx, cy) => {
    if (!BAS) return null; const r = document.getElementById('c').getBoundingClientRect(), nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2;
    const d = nrm([BAS.f[0] + BAS.r[0] * nx * BAS.th * BAS.asp + BAS.u[0] * ny * BAS.th, BAS.f[1] + BAS.r[1] * nx * BAS.th * BAS.asp + BAS.u[1] * ny * BAS.th, BAS.f[2] + BAS.r[2] * nx * BAS.th * BAS.asp + BAS.u[2] * ny * BAS.th]);
    if (d[1] >= -.01) return null; let t = -EYE[1] / d[1]; if (HDM && TER) for (let k = 0; k < 6; k++) { const px = EYE[0] + d[0] * t, pz = EYE[2] + d[2] * t; t = (THc(px, pz) - EYE[1]) / d[1]; } return { x: EYE[0] + d[0] * t, y: EYE[2] + d[2] * t };
  };
  R3.pickB = (cx, cy) => {
    if (!VP) return null; const r = document.getElementById('c').getBoundingClientRect(), sx = (cx - r.left) / r.width * W, sy = (cy - r.top) / r.height * H; let best = null, bd = 1e9;
    S.b.forEach(b => { const p = proj(b.x + b.w / 2, b.t === 'core' ? 12 : 6, b.y + b.w / 2); if (!p) return; const rad = b.w * 1.1 * clamp(300 / p[2], .5, 2), d = Math.hypot(p[0] - sx, p[1] - sy); if (d < rad && d < bd) { bd = d; best = b; } });
    return best;
  };
  R3.supported = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } };
  addEventListener('keydown', e => { if (!R3.on() || !S || !S.run) return; if (e.key === ',') R3.turn(-Math.PI / 4); if (e.key === '.') R3.turn(Math.PI / 4); if (e.key === '-') R3.zoomBy(1.15); if (e.key === '=' || e.key === '+') R3.zoomBy(1 / 1.15); });
  addEventListener('wheel', e => { if (!R3.on() || !S || !S.run) return; R3.zoomBy(e.deltaY > 0 ? 1.08 : 1 / 1.08); }, { passive: true });
  void try_;
})();
