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
  const HQu = new Map([[SPH, SPHu], [HEMI, HEMIu], [CYL, CYLu], [TUBE, TUBEu], [CONE, CONEu]]); // buildings are drawn once, so they get the smoothest shapes

  /* ---------- batching ---------- */
  function put(P, x, y, z, sx, sy, sz, ry, rx, c, e, al, T) {
    if (HQ) { const h = (ULT ? HQu : HQm).get(P); if (h) P = h; }
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
  const FS = `precision mediump float;varying vec3 vP,vN;varying vec4 vC;varying float vE;
uniform sampler2D uBg,uFog,uDec;uniform float uG;uniform vec2 uW;uniform vec4 uDR;uniform vec3 uSun,uSunC,uAmb,uHaze,uCam,uDark;uniform float uHD;
uniform vec4 uLP[8];uniform vec3 uLC[8];
void main(){vec4 c=vC;vec3 nn=normalize(vN);bool inW=vP.x>=0.&&vP.z>=0.&&vP.x<=uW.x&&vP.z<=uW.y;
 if(uG>.5){vec2 gu=vP.xz/uW;gu=1.-abs(mod(gu,2.)-1.);c=texture2D(uBg,gu);vec2 du=(vP.xz-uDR.xy)/uDR.zw;if(du.x>0.&&du.y>0.&&du.x<1.&&du.y<1.){vec4 d=texture2D(uDec,du);c.rgb=mix(c.rgb,d.rgb,d.a);}nn=vec3(0.,1.,0.);}
 vec3 V=normalize(uCam-vP);vec3 L=uAmb*(.8+.2*nn.y)+uSunC*max(dot(nn,uSun),0.);
 for(int i=0;i<8;i++){vec3 d=uLP[i].xyz-vP;float r=uLP[i].w;if(r>0.){float k=max(0.,1.-length(d)/r);L+=uLC[i]*k*k*(.45+.55*max(dot(nn,normalize(d)),0.));}}
 float ao=uG>.5?1.:.64+.36*clamp(vP.y/7.,0.,1.);vec3 o=c.rgb*L*ao+c.rgb*vE;
 if(uG<.5&&vE<1.5){vec3 Hh=normalize(uSun+V);o+=uSunC*pow(max(dot(nn,Hh),0.),28.)*.26;o+=uAmb*pow(1.-max(dot(nn,V),0.),3.)*.38;}
 if(inW&&vE<2.9){float f=texture2D(uFog,vP.xz/uW).a;o=mix(o,uDark,f*.92);}
 float dd=length(vP-uCam);o=mix(o,uHaze,clamp((dd-uHD)/(uHD*1.6),0.,.75)*(1.-min(vE,1.)));
 gl_FragColor=vec4(o,c.a);}`;
  const VS2 = `attribute vec2 aQ;varying vec2 vQ;void main(){vQ=aQ;gl_Position=vec4(aQ,.9999,1.);}`;
  const FS2 = `precision mediump float;varying vec2 vQ;uniform vec3 uF,uR,uU,uZen,uHor,uSunD,uSunC;uniform float uTH,uAsp,uStar,uT;uniform vec4 uFl;
float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
void main(){vec3 d=normalize(uF+uR*vQ.x*uTH*uAsp+uU*vQ.y*uTH);float e=d.y;
 vec3 c=mix(uHor,uZen,clamp(e*1.8+.08,0.,1.));
 float s=max(dot(d,uSunD),0.);c+=uSunC*(smoothstep(.9975,.999,s)*2.5+pow(s,14.)*.35);
 if(uStar>0.&&e>-.05){vec3 g=floor(d*260.);float r=h(g);if(r>.9965)c+=vec3(uStar*(.55+.45*sin(uT*2.5+r*90.))*(r-.9965)*280.);}
 c=mix(c,uFl.rgb,uFl.a);gl_FragColor=vec4(c,1.);}`;
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
    ['uF', 'uR', 'uU', 'uZen', 'uHor', 'uSunD', 'uSunC', 'uTH', 'uAsp', 'uStar', 'uT', 'uFl'].forEach(k => U2[k] = gl.getUniformLocation(prog2, k)); U2.aQ = gl.getAttribLocation(prog2, 'aQ');
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
  function drawBuf(B, N, glb) {
    if (!N) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, glb); gl.bufferData(gl.ARRAY_BUFFER, B.subarray(0, N * FL), gl.DYNAMIC_DRAW); attrs(); gl.drawArrays(gl.TRIANGLES, 0, N);
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
  function buildStatic() {
    n = 0; const L = S.L, WW_ = WW, WH_ = WH; let s = 11 + S.lv * 97; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    const c3_ = col(L.bg[3]), c1_ = col(L.bg[1]), dk = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    for (let i = 0; i < 120; i++) {
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
    for (let i = 0; i < 44; i++) { // far ridges on the horizon (seen in first person)
      const a = i / 44 * Math.PI * 2 + r() * .1, R = 1150 + r() * 500, x = WW_ / 2 + Math.cos(a) * R, y = WH_ / 2 + Math.sin(a) * R * .8, w = 260 + r() * 300, h = (S.lv === 3 ? .35 : .55) * w * (.4 + r() * .6);
      put(HQ ? MTNS[i % 4] : CONE4, x, -2, y, w, h, w * (.7 + r() * .5), r() * 6, 0, dk(r() < .5 ? c3_ : c1_, .55 + r() * .25), 0);
    }
    if (S.lv === 1) put(SPH, WW_ / 2 - 700, 520, WH_ / 2 - 1500, 40, 28, 34, .5, 0, '#8a7a6a', .7);
    if (S.lv === 6) { let s2 = 77; const r2 = () => (s2 = s2 * 16807 % 2147483647) / 2147483647; for (let i = 0; i < 60; i++) { const x = r2() * WW_, z = r2() * WH_, hg = 6 + r2() * 12; put(CYL, x, 0, z, 1.4, hg, 1.4, 0, 0, '#3a1652', 0); put(SPH, x, hg, z, 5, 4, 5, 0, 0, r2() < .5 ? '#d070ff' : '#7df9ff', 1.6); } }
    const lk = LOOK[S.lv]; if (lk && lk.planet) { const p = lk.planet; put(SPH, WW_ / 2 + p.x, p.h - p.r, WH_ / 2 + p.y, p.r * 2, p.r * 2, p.r * 2, 0, 0, p.c, p.e || 1.1); if (p.c2) put(SPH, WW_ / 2 + p.x + p.r * .25, p.h - p.r * .7, WH_ / 2 + p.y + p.r * .3, p.r * .9, p.r * .6, p.r * .9, 0, 0, p.c2, 1.1); }
    gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * FL), gl.STATIC_DRAW); staticN = n; staticLv = S.lv + ':' + S.L.n + ':' + HQ; n = 0;
  }

  /* ---------- models ---------- */
  const T = () => (typeof TT !== 'undefined' ? TT : performance.now() / 1000);
  /* ---------- v19 models: buildings keep their unchanging parts in a cache, only moving parts are rebuilt ---------- */
  // unchanging parts of buildings are kept on the graphics card and only re-sent when something changes
  const BC = new WeakMap(); let DKn = 0, STL = [], bSig = '', bvb = null, bvN = 0, bId = 0;
  function cached(obj, key, fn, direct) {
    if (direct) { fn(); return; }
    let c = BC.get(obj);
    if (!c || c.k !== key) { const sv = n; ULT = true; try { fn(); } finally { ULT = false; } c = { k: key, a: buf.slice(sv * FL, n * FL), id: ++bId }; n = sv; BC.set(obj, c); }
    STL.push(c);
  }
  function drawStatic() {
    const sig = STL.map(c => c.id).join(',');
    if (sig !== bSig || !bvb) { bSig = sig; let tot = 0; STL.forEach(c => tot += c.a.length); const arr = new Float32Array(Math.max(tot, FL)); let o = 0; STL.forEach(c => { arr.set(c.a, o); o += c.a.length; });
      if (!bvb) bvb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bvb); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); bvN = tot / FL; }
    if (bvN) { gl.bindBuffer(gl.ARRAY_BUFFER, bvb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, bvN); }
  }
  function building(b) {
    const t = T(), m = b.lv || 1, isC = b.t === 'core', x = b.x + b.w / 2, y = b.y + b.w / 2;
    let sc = 1; if (b.pop != null && b.pop < .4) { if (b.pop < 0) return; sc = typeof easeBack === 'function' ? easeBack(b.pop / .4) : b.pop / .4; }
    const fl = b.hit > 0 ? .8 : 0, on = !b.off && !b.nc && !b.dis, s = sc, nt = DKn > .3, wl = on ? (nt ? 1.5 : .55) : 0;
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
        for (let i = -1; i <= 1; i++) for (const dz of [-3.5, 3.5]) B(i * 4.9, dz * .9 - .35, 5.22 + .435 * dz, 4.5, .5, 6.6, '#2348a8', on ? .3 : 0, 0, -.45);
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
        case 'solar': B(0, 7.2, .2, 15, .7, 1.2, G2, .5); for (const q of [-1, 1]) { Cm(q * 6.6, -6, 0, .7, 7.5, '#8e8a98'); B(q * 6.6, -6, 7.4, 4.4, .4, 4.6, '#2348a8', on ? .3 : 0, 0, -.6); } break;
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
    let p = at(f, R); box(p[0], p[1], hh - .55, 3.4, 1.1, 1, '#d9dde6', 0, a); p = at(f + .2, R); box(p[0], p[1], hh + .55, 2.4, .35, .5, '#3a3f4c', 0, a); p = at(f + .3, R - .52); box(p[0], p[1], hh - .3, 2.6, .3, .06, gc, 1.3, a);
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
    if (a.echo) { echoBoss(a); return; }
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
  function boss(a, ang, fl, sink) {
    const t = T(), x = a.x, y = a.y, sv = n; bossBody(a, ang, fl, t, x, y); if (sink) for (let i = sv; i < n; i++) buf[i * FL + 1] += sink;
  }
  // boss = its body plus an intimidation layer (glowing details, aura, embers; all turn red when enraged)
  const BCOL = { golem: '#7df9ff', worm: '#ff7a2a', scorch: '#ffb040', kraken: '#b05aff', queen: '#ff3050', colossus: '#ff6a2a' };
  function bossBody(a, ang, fl, t, x, y) {
    bossCore(a, ang, fl, t, x, y); if (a.ty === 'worm' && a.hid && !(S.cin && S.cin.k === 'boss')) return; bossFx(a, ang, fl, t, x, y);
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
      case 'worm': { // segmented sandworm rising out of a burrow
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
    const cv = document.getElementById('c'), dpr = R3.q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    { const now = performance.now(); if (R3.lf) { const d = Math.min(200, now - R3.lf); R3.ft = (R3.ft || 16) * .95 + d * .05; } R3.lf = now;
      if (R3.qs === 'auto' && R3.q === 'high' && S.run && !S.pz) { if (R3.ft > 34) { if (++R3.slowN > 150) { R3.q = 'low'; rectT = 0; if (typeof say === 'function') say('Switched to faster 3D graphics for smoother play. You can change this in Settings.'); } } else R3.slowN = 0; } }
    if (--rectT <= 0 || c3.style.display === 'none') {
      rectT = 30; const r = cv.getBoundingClientRect(), st = cv.parentNode.getBoundingClientRect();
      c3.style.display = 'block'; c3.style.left = (r.left - st.left) + 'px'; c3.style.top = (r.top - st.top) + 'px'; c3.style.width = r.width + 'px'; c3.style.height = r.height + 'px';
      let pw = Math.round(r.width * dpr), ph = Math.round(r.height * dpr); const mx = R3.q === 'low' ? 650000 : 1600000; if (pw * ph > mx) { const k = Math.sqrt(mx / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
      if (c3.width !== pw || c3.height !== ph) { c3.width = pw; c3.height = ph; }
    }
    if (!document.body.classList.contains('v3d')) document.body.classList.add('v3d');
    const t = T(), L = S.L, lk = LOOK[S.lv] || LOOK[0];
    HQ = R3.q !== 'low';
    if (staticLv !== S.lv + ':' + L.n + ':' + HQ) { buildStatic(); last.bg = -9; }
    if (t - last.bg > 1.5 || t < last.bg) { upload(texBg, bg); last.bg = t; }
    if (t - last.fog > .2 || t < last.fog) { upload(texFog, FOG); last.fog = t; }

    // camera
    const fdt = Math.min(.05, Math.max(0, t - (R3.lt == null ? t : R3.lt))); R3.lt = t;
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
      if (C.k === 'boss') { zT = .34 + .5 * e; pT = .1 + .34 * e; th = 24 * (1 - e) + 6; }
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
      let dyaw = R3.yaw - yawS; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; yawS += dyaw * (cm === 'fp' ? .4 : .22);
      fx = -Math.sin(yawS); fz = -Math.cos(yawS); TGT.x = P0.x; TGT.y = P0.y; const lp = R3.lp;
      if (cm === 'fp') { const sp_ = S.mv ? Math.min(1, Math.hypot(S.mv.x, S.mv.y) / 60) : 0, bob = S.drive ? 0 : Math.sin((S.walk || 0) * 11) * .35 * sp_, hop = (S.L.lowg && S.pv && !S.drive) ? Math.min(1, Math.hypot(S.pv.x, S.pv.y) / 60) * Math.abs(Math.sin((S.walk || 0) * 5)) * 9 : 0, eh = (S.drive ? 16 : 11.8) + bob + hop, fo = S.drive ? 3 : 1.4;
        eyeT = [P0.x + fx * fo, eh, P0.y + fz * fo]; tgtT = [eyeT[0] + fx * 100 * Math.cos(lp), eh - Math.sin(lp) * 100, eyeT[2] + fz * 100 * Math.cos(lp)]; fov = 1.1; near = 1; }
      else { const dd = 36 * R3.zoom; eyeT = [P0.x - fx * dd - fz * 5, 17 + dd * .1 + lp * 20, P0.y - fz * dd + fx * 5]; tgtT = [P0.x + fx * 16 - fz * 2.5, 7, P0.y + fz * 16 + fx * 2.5]; fov = .98; near = 1.5; }
    }
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
    gl.viewport(0, 0, c3.width, c3.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog2); gl.uniform3fv(U2.uZen, zen); gl.uniform3fv(U2.uHor, hor); gl.uniform3fv(U2.uSunD, sunD); gl.uniform3fv(U2.uSunC, ph < nt ? sunCol.map(v => v * (1 - stormK * .7)) : [0, 0, 0]); gl.uniform1f(U2.uStar, stars); gl.uniform1f(U2.uT, t); gl.uniform4fv(U2.uFl, fl);
    gl.disable(gl.BLEND); R3.sky();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.useProgram(prog); gl.uniformMatrix4fv(U.uM, false, new Float32Array(VP));
    gl.uniform2f(U.uW, WW, WH); gl.uniform3fv(U.uSun, sunD); gl.uniform3fv(U.uSunC, sunCol.map((v, i) => v * sunK * .78 * stc[i])); gl.uniform3fv(U.uAmb, lk.amb.map((v, i) => v * ambK * stc[i] * (1 - dk * .25) + (dk > .3 ? [.02, .03, .08][i] : 0)));
    gl.uniform3fv(U.uHaze, mix3(hor, lk.haze, .25)); gl.uniform3fv(U.uCam, eye); gl.uniform1f(U.uHD, 420 - (wall ? 260 : 120) * stormK); gl.uniform3f(U.uDark, .024, .016, .047);
    const LT = lights(dk); for (let i = 0; i < 8; i++) { const l = LT[i]; gl.uniform4f(U.lp[i], l ? l[0] : 0, l ? l[1] : 0, l ? l[2] : 0, l ? l[3] : 0); gl.uniform3f(U.lc[i], l ? l[4] : 0, l ? l[5] : 0, l ? l[6] : 0); }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texBg); gl.uniform1i(U.uBg, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texFog); gl.uniform1i(U.uFog, 1);

    // decals (flat things drawn with the 2D sprite code onto the ground)
    const dcx = Math.round((cm === 'top' ? TGT.x - sy * 70 : P0.x + fx * 110) - DS / 2), dcy = Math.round((cm === 'top' ? TGT.y - cy * 70 : P0.y + fz * 110) - DS / 2);
    R3.fn = (R3.fn || 0) + 1;
    if (R3.q !== 'low' || R3.fn % 2 === 0 || R3.ldx == null) { decals(dcx, dcy); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDec); upload(texDec, DEC); R3.ldx = dcx; R3.ldy = dcy; }
    else { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDec); }
    gl.uniform1i(U.uDec, 2); gl.uniform4f(U.uDR, R3.ldx, R3.ldy, DS, DS);

    // static scenery
    gl.uniform1f(U.uG, 0); gl.bindBuffer(gl.ARRAY_BUFFER, sb); attrs(); gl.drawArrays(gl.TRIANGLES, 0, staticN);
    // ground
    n = 0; put(BOX, WW / 2, -1, WH / 2, WW + 3600, 1, WH + 3600, 0, 0, '#ffffff', 0); gl.uniform1f(U.uG, 1); drawBuf(buf, n, vb); gl.uniform1f(U.uG, 0);
    // dynamic objects
    n = 0; tn = 0; STL = []; const tj0 = performance.now(); scene(cm); weather(t, stormK, wall, C); R3.tjs = (R3.tjs || 0) * .9 + (performance.now() - tj0) * .1; R3.vn = n + tn;
    if (cm === 'fp' && !S.drive && S.land <= 0) heldGun(eye, fx, fz, R3.lp);
    drawBuf(buf, n, vb); drawStatic();
    if (tn) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE); drawBuf(tbuf, tn, vb); gl.depthMask(true); gl.disable(gl.BLEND); }
    overlay(dk, cm);
  }

  function lights(dk) {
    if (dk < .05) return [];
    const K = .2 + dk * 1.1, out = [], add = (x, y, h, r, c, k) => { const C = col(c); out.push([x, h, y, r, C[0] * K * (k || 1), C[1] * K * (k || 1), C[2] * K * (k || 1), Math.hypot(x - TGT.x, y - TGT.y)]); };
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
    S.b.forEach(building);
    const SU = suitOf();
    if (S.land <= .55 && !S.drive && cm !== 'fp') { const sv = n; astro(S.p.x, S.p.y, Math.atan2(S.face.y, S.face.x), S.walk || 0, SU, null, 1); if (S.L.lowg && S.pv) { const hop = Math.min(1, Math.hypot(S.pv.x, S.pv.y) / 60) * Math.abs(Math.sin((S.walk || 0) * 5)) * 9; for (let i = sv; i < n; i++) buf[i * FL + 1] += hop; } }
    const b2 = S.p2; if (b2 && b2.x != null && !b2.drive) { let su2 = SU; try { su2 = SUITS.find(s => s.id === b2.suit) || SUITS[0]; } catch (e) {} astro(b2.x, b2.y, heading(b2, b2.fx < 0 ? Math.PI : 0), b2.walk || 0, su2, '#6cc8ff', 1); }
    if (S.land <= .55) S.npc.forEach(nn => { let jc_ = '#ff9a3d'; try { jc_ = JOBS[nn.c.job].col; } catch (e) {} astro(nn.x, nn.y, heading(nn, nn.f > 0 ? 0 : Math.PI), nn.walk || 0, { b: '#dfe1e8', p: '#b9bcc6', v: '#2a6bd8' }, jc_, .9); });
    if (S.land <= .55) { const hh = S.hero; if (hh) astro(hh.x, hh.y, heading(hh, hh.f > 0 ? 0 : Math.PI), hh.walk || 0, { b: '#f2e2b0', p: '#c9a85a', v: '#ffb020' }, '#ffd23f', 1);
      const dg = S.dog; if (dg) { const ang = heading(dg, dg.f > 0 ? 0 : Math.PI), ca = Math.cos(ang), sa = Math.sin(ang), at = (f, q) => [dg.x + ca * f - sa * q, dg.y + sa * f + ca * q], wk = Math.sin((dg.walk || 0) * 14) * .8, dig = dg.dig > 0 ? Math.sin(T() * 30) * .3 : 0; let p;
        for (const [f, q, ph] of [[2.5, 1.6, 1], [2.5, -1.6, -1], [-2.5, 1.6, -1], [-2.5, -1.6, 1]]) { p = at(f + wk * ph, q); box(p[0], p[1], 0, 1.2, 3, 1.2, '#7d8494', 0, ang); }
        box(dg.x, dg.y, 3, 7.5, 3.4, 4.2, '#c9ccd6', 0, ang, dig); p = at(4.6, 0); box(p[0], p[1], 5 - (dg.dig > 0 ? 2 : 0), 3.6, 3.2, 3.4, '#dfe1e8', 0, ang); p = at(6.6, 0); box(p[0], p[1], 5.6 - (dg.dig > 0 ? 2 : 0), 1, 1, 2.4, '#5fe08a', 1.6, ang); for (const q of [-.9, .9]) { p = at(6.2, q); box(p[0], p[1], 6.6 - (dg.dig > 0 ? 2 : 0), .7, .7, .7, '#7df9ff', 2.2, ang); } p = at(2.9, 0); box(p[0], p[1], 4.6, 1.1, 3.8, 4.6, '#ff3a3a', .4, ang); p = at(.6, 0); box(p[0], p[1], 6.4, .4, 5, .4, '#c9ccd6', 0, ang); put(SPH, p[0], 11.8, p[1], 1.4, 1.4, 1.4, 0, 0, '#ff3a6a', 2.2);
        for (const q of [-1, 1]) { p = at(4.2, q * 1.3); box(p[0], p[1], 8 - (dg.dig > 0 ? 2 : 0), .8, 2, .8, '#7d8494', 0, ang); } p = at(-4.4, 0); box(p[0], p[1], 5.4, 1, 1, 2.6, '#ff7a3d', .8, ang + Math.sin(T() * 12) * .5); }
      const so = S.sto; if (so && so.k !== 'flicker') { const t = T(), pu = .6 + .4 * Math.sin(t * 3), x = so.x, y = so.y;
        if (so.k === 'crystal') { for (let i = 0; i < 6; i++) { const a = i * 1.05, r = i ? 5 : 0, h = i ? 9 + (i % 3) * 4 : 16; put(CONE, x + Math.cos(a) * r, 0, y + Math.sin(a) * r, 4, h, 4, a, (i ? .35 : 0), i % 2 ? '#c070ff' : '#8a3ad0', 1.2 * pu); } put(SPH, x, 6, y, 22, 14, 22, 0, 0, '#b070ff', 1.4, .22 * pu, true); }
        if (so.k === 'door') { put(CYL, x, 0, y, 38, 1.4, 38, 0, 0, '#4a3a32', 0); put(CYL, x, 1.2, y, 30, .6, 30, 0, 0, '#2a1e1a', 0); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; put(SPH, x + Math.cos(a) * 11, 1.6, y + Math.sin(a) * 11, 3, 1.2, 3, 0, 0, '#d070ff', 1.8 * pu); } put(SPH, x, 1.8, y, 6, 1.6, 6, 0, 0, '#d070ff', 2 * pu); }
        if (so.k === 'eye') { put(CYL, x, .2, y, 92, .5, 36, 0, 0, '#2a1410', 0); put(CYL, x, .5, y, 26, .5, 26, 0, 0, '#ff4a1a', 1.6 * pu); put(CYL, x, .8, y, 7, .5, 20, 0, 0, '#000000', 0); }
        if (so.k === 'shadow') { const sx = x + Math.sin(t * .25) * 60; for (let i = 0; i < 9; i++) { const a = i * .7; box(sx + Math.cos(a) * 70, y + Math.sin(a) * 30, .2, 60, .4, 1.6, '#7df9ff', 1.6 * pu, a); } put(CYL, sx, .4, y, 180, .4, 76, Math.sin(t * .2) * .3, 0, '#050a1e', 0, .5, true); put(CYL, sx - 70, .5, y + 10, 80, .4, 28, 0, 0, '#050a1e', 0, .35, true); }
        if (so.k === 'song') { for (let i = 0; i < 3; i++) { const r = ((t * 14 + i * 14) % 42) * 2 + 8; put(CYL, x, .4, y, r, .3, r, 0, 0, '#b070ff', 1.5, Math.max(0, 1 - r / 92) * .7, true); } }
        if (!so.sc) put(SPH, x, 24 + Math.sin(t * 3) * 2, y, 3, 3, 3, 0, 0, '#d070ff', 2.2); }
      const gd = S.gd; if (gd) { const B = (typeof BOSS !== 'undefined' && BOSS[gd.ty]) || {}; const sv = n, st0 = tn, K = .4; try { alien({ ty: gd.ty, x: gd.x, y: gd.y, r: B.r || 30, boss: 1, hp: 1, mh: 1, fl: 0, stun: 0, f: gd.f, face: gd.f, rise: 0 }); } catch (e) { box(gd.x, gd.y, 0, 10, 12, 10, '#7df9ff', .6, 0); }
        for (let i = sv; i < n; i++) { const o = i * FL; buf[o] = gd.x + (buf[o] - gd.x) * K; buf[o + 1] *= K; buf[o + 2] = gd.y + (buf[o + 2] - gd.y) * K; } for (let i = st0; i < tn; i++) { const o = i * FL; tbuf[o] = gd.x + (tbuf[o] - gd.x) * K; tbuf[o + 1] *= K; tbuf[o + 2] = gd.y + (tbuf[o + 2] - gd.y) * K; } } }
    if (S.rv) rover(S.rv, heading(S.rv, S.rv.f < 0 ? Math.PI : 0), rskin());
    S.al.forEach(alien);
    S.allies.forEach(a => { if (a.freed) { try { alien({ ty: 'grunt', x: a.x, y: a.y, r: 8, hp: 1, mh: 1, fl: 0, stun: 0, rise: 0, f: a.face, face: a.face, walk: a.walk || 0, sp: 1 }); } catch (e) {} return; } const ang = heading(a, a.face > 0 ? 0 : Math.PI), ca = Math.cos(ang), sa = Math.sin(ang), at = (f, q) => [a.x + ca * f - sa * q, a.y + sa * f + ca * q], w = Math.sin(T() * 9 + a.x) * .5; let p;
      for (const q of [-1, 1]) { p = at(Math.sin(w * q) * 1.5, q * 2); box(p[0], p[1], 0, 2.4, 6, 2.4, '#5a6170', 0, ang); box(p[0], p[1], 0, 3.4, 1.2, 3, '#3a3f4c', 0, ang); }
      box(a.x, a.y, 5.6, 6, 6.6, 7.4, '#8a93a6', 0, ang); p = at(3.1, 0); box(p[0], p[1], 7.4, .5, 3, 4, '#2a2833', 0, ang); box(p[0], p[1], 8.6, .6, .8, 2.6, '#5fe08a', 1.4, ang);
      put(SPH, a.x, 12, a.y, 5.4, 4.6, 5.4, ang, 0, '#c9d2dc', 0); p = at(2.1, 0); box(p[0], p[1], 13.4, 1.4, 1.4, 4, '#7df9ff', 1.6, ang);
      p = at(1, 4.8); box(p[0], p[1], 7.4, 6, 2.2, 2.2, '#5a6170', 0, ang); p = at(4.2, 4.8); put(SPHm, p[0], 8.5, p[1], 1, 1, 1, 0, 0, '#7df9ff', 2);
      p = at(1, -4.8); box(p[0], p[1], 6.6, 2, 4, 2, '#5a6170', 0, ang); p = at(-1, -1.5); put(CYLm, p[0], 16.4, p[1], .3, 4, .3, 0, 0, '#cccccc', 0); put(SPHm, p[0], 20.4, p[1], 1, 1, 1, 0, 0, Math.floor(T() * 3) % 2 ? '#ff7a3d' : '#7a3010', 1.2); });
    if (S.drone && S.dr && S.dr.x != null) { const D = S.dr, dy = D.y + 4, hh = 14 + Math.sin(T() * 3) * 1.2, sp = T() * 40;
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
    S.bul.forEach(b => { const a = Math.atan2(b.vy || 0, b.vx || 1), z = b.pi ? 1.5 : 1; box(b.x - Math.cos(a) * 3, b.y - Math.sin(a) * 3, 5.2, 7 * z, 1.6 * z, 1.6 * z, b.col, 2.4, a); put(SPHm, b.x, 4.6, b.y, 4 * z, 4 * z, 4 * z, 0, 0, b.col, 2.2, .35, true); });
    S.eb.forEach(e => { put(SPH, e.x, 3, e.y, 5, 5, 5, T() * 6, 0, e.c || '#d8ff6a', 1.6); put(SPHm, e.x, 1.6, e.y, 9, 8, 9, 0, 0, e.c || '#d8ff6a', 1.8, .25, true); });
    S.beams.forEach(b => beam(b.x, b.y, 9, b.x2, b.y2, 6, 1.4, b.c, 2.2));
    (S.gib || []).forEach(g => box(g.x, g.y, g.h, g.s, g.s, g.s, g.c, .15, g.r, g.r * .7));
    S.pt.forEach(q => { const k = clamp(q.l / q.ml, 0, 1), s = q.s * (.4 + .6 * k); box(q.x, q.y, 3 + (1 - k) * 6 + (q.h || 0), s, s, s, q.c, 1.4); });
    S.pods.forEach(q => pod(q.x, q.y, q.h, q.k));
    if (S.lp && S.land > 1.05) pod(S.lp.x, S.lp.y, (S.land - 1.05) / 1.35 * 240, 'land'); else if (S.lp && S.land <= 1.05) pod(S.lp.x, S.lp.y, 0, 'land-done');
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
    const sh = (x, y, rx, ry, a) => { DX.fillStyle = `rgba(0,0,0,${a || .32})`; DX.beginPath(); DX.ellipse(x, y, rx, ry, 0, 0, 7); DX.fill(); };
    try {
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

  function proj(x, h, y) { const m = VP, w = m[3] * x + m[7] * h + m[11] * y + m[15]; if (w <= .1) return null; const px = (m[0] * x + m[4] * h + m[8] * y + m[12]) / w, py = (m[1] * x + m[5] * h + m[9] * y + m[13]) / w; return [(px * .5 + .5) * W, (1 - (py * .5 + .5)) * H, w]; }
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

  /* ---------- public API ---------- */
  R3.on = () => (R3.want || R3.tmpOn) && R3.ok && typeof S !== 'undefined' && !!S;
  R3.tmpOn = false;
  R3.tmp = v => { if (v && !gl) { try { R3.ok = init(); } catch (e) { R3.ok = false; } } R3.tmpOn = !!v && R3.ok; if (!R3.tmpOn && !R3.want) R3.hide(); else rectT = 0; };
  R3.cam = 'top'; R3.lp = .1; R3.cm = 'top';
  R3.CAMS = ['top', 'chase', 'fp'];
  R3.setCam = m => { if (!R3.CAMS.includes(m)) m = 'top'; if (m !== 'top' && R3.cam === 'top' && typeof S !== 'undefined' && S && S.face) { const f = S.face, l = Math.hypot(f.x, f.y) || 1; R3.yaw = Math.atan2(-f.x / l, -f.y / l); yawS = R3.yaw; }
    if (m === 'top' && R3.cam !== 'top') { R3.yaw = Math.round(R3.yaw / (Math.PI / 4)) * Math.PI / 4; }
    R3.cam = m; R3.lp = m === 'fp' ? .1 : .15; try { LS.set('cam3d', m); } catch (e) {} };
  R3.fpl = () => R3.on() && R3.cm !== 'top';
  R3.fwd = () => [-Math.sin(yawS), -Math.cos(yawS)];
  R3.look = (dx, dy) => { R3.yaw -= dx * .0055; R3.lp = clamp(R3.lp + dy * .004, -.45, .75); };
  R3.draw = () => { try { frame(); } catch (e) { console.warn('3D view error, switching to 2D', e); R3.ok = false; R3.hide(); } };
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
  R3.rot = (dx, dy, dt) => { if (!R3.on()) return [dx, dy]; if (dt && R3.cm !== 'top') { R3.yaw -= dx * 2.5 * dt; dx = 0; } const c = Math.cos(yawS), s = Math.sin(yawS); return [c * dx + s * dy, -s * dx + c * dy]; };
  R3.unrot = (wx, wy) => { const c = Math.cos(yawS), s = Math.sin(yawS); return [c * wx - s * wy, s * wx + c * wy]; };
  R3.turn = d => { R3.yaw += d; };
  R3.zoomBy = k => { R3.zoom = clamp(R3.zoom * k, .55, 1.8); };
  R3.hq = () => HQ;
  R3.pick = (cx, cy) => {
    if (!BAS) return null; const r = document.getElementById('c').getBoundingClientRect(), nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2;
    const d = nrm([BAS.f[0] + BAS.r[0] * nx * BAS.th * BAS.asp + BAS.u[0] * ny * BAS.th, BAS.f[1] + BAS.r[1] * nx * BAS.th * BAS.asp + BAS.u[1] * ny * BAS.th, BAS.f[2] + BAS.r[2] * nx * BAS.th * BAS.asp + BAS.u[2] * ny * BAS.th]);
    if (d[1] >= -.01) return null; const t = -EYE[1] / d[1]; return { x: EYE[0] + d[0] * t, y: EYE[2] + d[2] * t };
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
