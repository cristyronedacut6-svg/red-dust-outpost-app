/* Red Dust Outpost · 3D story cutscenes
   A small WebGL1 renderer for the story scenes (Earth, launch, travel, outpost secured, mission complete).
   Planets use textures painted in code. If WebGL is missing, the game keeps its 2D pixel cutscenes. */
(function () {
  'use strict';
  const C3 = window.CUT3D = { ok: null, labels: [] };
  let gl = null, cvs = null, PM, PP, PS, PB, U = {}, UPa = {}, US = {}, UB = {}, MB = {}, pbuf, starB, starN = 0, bgB, rectT = 0;
  const TX = {}, parts = [], inst = [], PI2 = Math.PI * 2;

  /* ---------- math ---------- */
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k, ease = k => k * k * (3 - 2 * k);
  const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  function persp(fy, a, n, f) { const t = 1 / Math.tan(fy / 2), d = n - f; return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / d, -1, 0, 0, 2 * f * n / d, 0]; }
  function look(e, t, u) { let z = nrm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]); const x = nrm(cross(u, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; }
  function mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  // model matrix: scale, then rotate z, x, y, then move
  function model(tx, ty, tz, sx, sy, sz, ry, rx, rz) {
    ry = ry || 0; rx = rx || 0; rz = rz || 0;
    const cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx), sx_ = Math.sin(rx), cz = Math.cos(rz), sz_ = Math.sin(rz);
    const Rz = [[cz, -sz_, 0], [sz_, cz, 0], [0, 0, 1]], Rx = [[1, 0, 0], [0, cx, -sx_], [0, sx_, cx]], Ry = [[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]];
    const m3 = (A, B) => A.map((r, i) => [0, 1, 2].map(j => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
    const R = m3(Ry, m3(Rx, Rz)), S = [sx, sy, sz], M = new Array(16).fill(0);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) M[c * 4 + r] = R[r][c] * S[c];
    M[12] = tx; M[13] = ty; M[14] = tz; M[15] = 1; return M;
  }
  // rotate a local offset by the same y,x,z angles (for placing child parts)
  function rotV(v, ry, rx, rz) { const M = model(0, 0, 0, 1, 1, 1, ry, rx, rz); return [M[0] * v[0] + M[4] * v[1] + M[8] * v[2], M[1] * v[0] + M[5] * v[1] + M[9] * v[2], M[2] * v[0] + M[6] * v[1] + M[10] * v[2]]; }

  /* ---------- meshes: [x,y,z, nx,ny,nz, u,v] ---------- */
  function sphereM(la, lo) {
    const o = [], P = (i, j) => { const th = i / la * Math.PI, ph = j / lo * PI2, s = Math.sin(th), x = Math.cos(ph) * s, y = Math.cos(th), z = Math.sin(ph) * s; return [x, y, z, x, y, z, j / lo, i / la]; };
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j); if (i > 0) o.push(...a, ...b, ...c); if (i < la - 1) o.push(...a, ...c, ...d); }
    return new Float32Array(o);
  }
  function hemiM(la, lo) { // dome of radius 1 on y=0
    const o = [], P = (i, j) => { const th = i / la * Math.PI / 2, ph = j / lo * PI2, s = Math.sin(th), x = Math.cos(ph) * s, y = Math.cos(th), z = Math.sin(ph) * s; return [x, y, z, x, y, z, j / lo, i / la]; };
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j); if (i > 0) o.push(...a, ...b, ...c); o.push(...a, ...c, ...d); }
    return new Float32Array(o);
  }
  function cylM(k) { // radius 1, y from 0 to 1, with caps
    const o = [], V = (a, y, nx, ny, nz) => o.push(Math.cos(a), y, Math.sin(a), nx, ny, nz, a / PI2, y);
    for (let i = 0; i < k; i++) { const a = i / k * PI2, b = (i + 1) / k * PI2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      V(a, 0, ca, 0, sa); V(a, 1, ca, 0, sa); V(b, 1, cb, 0, sb); V(a, 0, ca, 0, sa); V(b, 1, cb, 0, sb); V(b, 0, cb, 0, sb);
      o.push(0, 1, 0, 0, 1, 0, .5, .5); V(b, 1, 0, 1, 0); V(a, 1, 0, 1, 0); o.push(0, 0, 0, 0, -1, 0, .5, .5); V(a, 0, 0, -1, 0); V(b, 0, 0, -1, 0); }
    return new Float32Array(o);
  }
  function coneM(k) { // radius 1 at y=0, tip at y=1
    const o = [], q = 1 / Math.hypot(1, 1);
    for (let i = 0; i < k; i++) { const a = i / k * PI2, b = (i + 1) / k * PI2, m = (a + b) / 2;
      o.push(Math.cos(a), 0, Math.sin(a), Math.cos(a) * q, q, Math.sin(a) * q, 0, 0, 0, 1, 0, Math.cos(m) * q, q, Math.sin(m) * q, 0, 1, Math.cos(b), 0, Math.sin(b), Math.cos(b) * q, q, Math.sin(b) * q, 1, 0);
      o.push(0, 0, 0, 0, -1, 0, .5, .5, Math.cos(a), 0, Math.sin(a), 0, -1, 0, 0, 0, Math.cos(b), 0, Math.sin(b), 0, -1, 0, 1, 0); }
    return new Float32Array(o);
  }
  function boxM() { // 1x1x1, y from 0 to 1, centered in x and z
    const p = (x, y, z) => [x - .5, y, z - .5], v = [p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0), p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)], o = [];
    const q = (a, b, c, d) => { const n = nrm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); [[a, 0, 0], [b, 1, 0], [c, 1, 1], [a, 0, 0], [c, 1, 1], [d, 0, 1]].forEach(([w, u, vv]) => o.push(w[0], w[1], w[2], n[0], n[1], n[2], u, vv)); };
    q(v[4], v[5], v[6], v[7]); q(v[1], v[0], v[3], v[2]); q(v[5], v[1], v[2], v[6]); q(v[0], v[4], v[7], v[3]); q(v[3], v[7], v[6], v[2]); q(v[0], v[1], v[5], v[4]);
    return new Float32Array(o);
  }
  function ringM(k, r0, r1) { // flat annulus in the xz plane (drawn without culling)
    const o = []; for (let i = 0; i < k; i++) { const a = i / k * PI2, b = (i + 1) / k * PI2, A = (r, t) => [Math.cos(t) * r, 0, Math.sin(t) * r, 0, 1, 0, (r - r0) / (r1 - r0), .5];
      const p1 = A(r0, a), p2 = A(r1, a), p3 = A(r1, b), p4 = A(r0, b); o.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4); }
    return new Float32Array(o);
  }
  const quadM = () => new Float32Array([-1, -1, 0, 0, 0, 1, 0, 1, 1, -1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, -1, -1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, -1, 1, 0, 0, 0, 1, 0, 0]);

  /* ---------- shaders ---------- */
  const VSM = `attribute vec3 aP,aN;attribute vec2 aU;uniform mat4 uVP,uM;varying vec3 vN,vW;varying vec2 vU;
void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=(uM*vec4(aN,0.)).xyz;vU=aU;gl_Position=uVP*w;}`;
  const FSM = `precision mediump float;varying vec3 vN,vW;varying vec2 vU;
uniform vec3 uCol,uLd,uCam,uAtm,uAmb;uniform float uE,uTex,uSpec,uAlpha,uAtmK,uNight,uUnlit,uTex2;uniform sampler2D uT,uT2;
void main(){vec4 tx=uTex>.5?texture2D(uT,vU):vec4(1.);vec3 base=uCol*tx.rgb;float a=uAlpha*tx.a;
 if(uUnlit>.5){gl_FragColor=vec4(base,a);return;}
 vec3 n=normalize(vN),v=normalize(uCam-vW);float d=dot(n,uLd),dl=max(d,0.);
 vec3 c=base*(uAmb+dl*vec3(1.,.97,.92));
 if(uSpec>0.){vec3 h=normalize(uLd+v);float m=uTex>.5?smoothstep(.04,.18,tx.b-tx.r):1.;c+=pow(max(dot(n,h),0.),uSpec)*.55*m*smoothstep(0.,.15,d);}
 if(uNight>0.&&uTex2>.5){float ci=texture2D(uT2,vU).r;c+=vec3(1.,.78,.42)*ci*uNight*(1.-smoothstep(-.15,.12,d));}
 float f=pow(1.-max(dot(n,v),0.),2.6);c+=uAtm*f*uAtmK*clamp(d+.45,0.,1.);
 c+=base*uE;gl_FragColor=vec4(c,a);}`;
  const VSP = `attribute vec3 aP;attribute vec2 aU;attribute vec4 aC;uniform mat4 uVP;varying vec2 vU;varying vec4 vC;void main(){vU=aU;vC=aC;gl_Position=uVP*vec4(aP,1.);}`;
  const FSP = `precision mediump float;varying vec2 vU;varying vec4 vC;uniform sampler2D uT;void main(){gl_FragColor=vec4(vC.rgb,vC.a*texture2D(uT,vU).a);}`;
  const VSS = `attribute vec3 aD;attribute float aB;uniform mat4 uVP;uniform float uPx;varying float vB;void main(){vec4 p=uVP*vec4(aD,0.);p.z=p.w*.9999;gl_Position=p;vB=aB;gl_PointSize=(1.+aB*1.6)*uPx;}`;
  const FSS = `precision mediump float;varying float vB;uniform float uK;void main(){gl_FragColor=vec4(vec3(.75+.25*vB),(.35+.65*vB)*uK);}`;
  const VSB = `attribute vec2 aQ;varying float vY;void main(){vY=aQ.y*.5+.5;gl_Position=vec4(aQ,.9999,1.);}`;
  const FSB = `precision mediump float;varying float vY;uniform vec3 uTop,uBot;void main(){gl_FragColor=vec4(mix(uBot,uTop,clamp(vY,0.,1.)),1.);}`;

  function init() {
    cvs = document.createElement('canvas'); cvs.id = 'c3cut'; cvs.style.cssText = 'position:absolute;left:0;top:0;display:none;pointer-events:none;z-index:-1';
    const cv = document.getElementById('c'); cv.parentNode.insertBefore(cvs, cv);
    gl = cvs.getContext('webgl', { antialias: true, alpha: false }) || cvs.getContext('experimental-webgl');
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    PM = pr(VSM, FSM); PP = pr(VSP, FSP); PS = pr(VSS, FSS); PB = pr(VSB, FSB);
    ['uVP', 'uM', 'uCol', 'uLd', 'uCam', 'uAtm', 'uAmb', 'uE', 'uTex', 'uSpec', 'uAlpha', 'uAtmK', 'uNight', 'uUnlit', 'uTex2', 'uT', 'uT2'].forEach(k => U[k] = gl.getUniformLocation(PM, k));
    U.aP = gl.getAttribLocation(PM, 'aP'); U.aN = gl.getAttribLocation(PM, 'aN'); U.aU = gl.getAttribLocation(PM, 'aU');
    UPa.uVP = gl.getUniformLocation(PP, 'uVP'); UPa.uT = gl.getUniformLocation(PP, 'uT'); UPa.aP = gl.getAttribLocation(PP, 'aP'); UPa.aU = gl.getAttribLocation(PP, 'aU'); UPa.aC = gl.getAttribLocation(PP, 'aC');
    US.uVP = gl.getUniformLocation(PS, 'uVP'); US.uPx = gl.getUniformLocation(PS, 'uPx'); US.uK = gl.getUniformLocation(PS, 'uK'); US.aD = gl.getAttribLocation(PS, 'aD'); US.aB = gl.getAttribLocation(PS, 'aB');
    UB.uTop = gl.getUniformLocation(PB, 'uTop'); UB.uBot = gl.getUniformLocation(PB, 'uBot'); UB.aQ = gl.getAttribLocation(PB, 'aQ');
    const mesh = a => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return { b, n: a.length / 8 }; };
    MB.sph = mesh(sphereM(40, 80)); MB.sphL = mesh(sphereM(18, 30)); MB.hemi = mesh(hemiM(14, 40)); MB.cyl = mesh(cylM(40)); MB.cone = mesh(coneM(40)); MB.box = mesh(boxM()); MB.ring = mesh(ringM(96, 1.25, 2.3)); MB.quad = mesh(quadM());
    // stars
    const st = []; let s = 77; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 1600; i++) { const u = r() * 2 - 1, t = r() * PI2, q = Math.sqrt(1 - u * u); st.push(q * Math.cos(t), u, q * Math.sin(t), Math.pow(r(), 3)); }
    starN = 1600; starB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, starB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(st), gl.STATIC_DRAW);
    bgB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bgB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    pbuf = gl.createBuffer();
    TX.glow = texC(cnv(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
    TX.puff = texC(cnv(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.6, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
    cvs.addEventListener('webglcontextlost', e => { e.preventDefault(); C3.ok = false; });
    return true;
  }

  /* ---------- textures painted in code ---------- */
  function cnv(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; }
  function texC(c, rep) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); void rep; return t; }
  function h3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vn(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const L = (a, b, k) => a + (b - a) * k, c = (i, j, k) => h3(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w); }
  function fbm(x, y, z, o) { let a = .5, f = 1, s = 0, t = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f, z * f); t += a; f *= 2.03; a *= .5; } return s / t; }
  // paint an equirectangular map: f(x,y,z,lat) returns [r,g,b] (0..255) or [r,g,b,a]
  function paint(w, h, f) {
    return cnv(w, h, (g) => { const im = g.createImageData(w, h), d = im.data;
      for (let j = 0; j < h; j++) { const th = (j + .5) / h * Math.PI, y = Math.cos(th), s = Math.sin(th);
        for (let i = 0; i < w; i++) { const ph = (i + .5) / w * PI2, c = f(Math.cos(ph) * s, y, Math.sin(ph) * s, 1 - th / Math.PI * 2), o = (j * w + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c.length > 3 ? c[3] : 255; } }
      g.putImageData(im, 0, 0); });
  }
  function craters(c, n, seed, dark, light) { const g = c.getContext('2d'), w = c.width, h = c.height; let s = seed; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const x = r() * w, y = h * (.12 + r() * .76), rad = (1.5 + Math.pow(r(), 3) * 14) * w / 384; g.fillStyle = dark; g.beginPath(); g.ellipse(x, y, rad, rad * .8, 0, 0, PI2); g.fill(); g.strokeStyle = light; g.lineWidth = Math.max(1, rad * .25); g.beginPath(); g.arc(x - rad * .15, y - rad * .1, rad, Math.PI * .9, Math.PI * 1.9); g.stroke(); } return c; }
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const sst = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const PAINT = {
    earth: () => paint(384, 192, (x, y, z, lat) => { const n = fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 5), ice = Math.abs(lat) > .82 ? 1 : 0;
      if (ice || Math.abs(lat) > .76 && n > .48) return [236, 242, 248];
      if (n > .53) { const k = sst(.53, .7, n), dry = fbm(x * 4, y * 4, z * 4 + 9, 3); return mixc(mixc([58, 128, 62], [150, 128, 78], cl(dry * 1.6 - .55 + Math.abs(lat) * -.2, 0, 1)), [120, 110, 90], k * .5); }
      const dp = sst(.3, .53, n); return mixc([14, 42, 110], [38, 112, 196], dp); }),
    earthN: () => paint(384, 192, (x, y, z) => { const n = fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 5); if (n <= .55) return [0, 0, 0]; const c = vn(x * 40, y * 40, z * 40); return c > .72 ? [255, 255, 255] : c > .6 ? [90, 90, 90] : [0, 0, 0]; }),
    clouds: () => paint(384, 192, (x, y, z) => { const n = fbm(x * 2.6 + 11, y * 3.4, z * 2.6, 5), a = sst(.5, .72, n) * 235; return [255, 255, 255, a]; }),
    moon: () => craters(paint(384, 192, (x, y, z) => { const n = fbm(x * 2, y * 2, z * 2, 5), m = fbm(x * .9 + 5, y * .9, z * .9, 3); let v = 150 + (n - .5) * 90; if (m < .43) v -= 45; return [v, v, v * 1.02]; }), 90, 5, 'rgba(70,70,74,.35)', 'rgba(230,230,235,.35)'),
    mars: () => paint(384, 192, (x, y, z, lat) => { const n = fbm(x * 2.2, y * 2.2, z * 2.2, 5), d = fbm(x * 1.1 + 4, y * 1.1, z * 1.1, 3); if (Math.abs(lat) > .84 + n * .06) return [240, 236, 230];
      let c = mixc([196, 98, 52], [226, 150, 92], n); if (d < .42) c = mixc(c, [110, 52, 32], .6); return c; }),
    mercury: () => craters(paint(384, 192, (x, y, z) => { const n = fbm(x * 2.4, y * 2.4, z * 2.4, 5); return mixc([96, 88, 82], [176, 166, 154], n); }), 160, 9, 'rgba(50,46,44,.4)', 'rgba(220,210,200,.35)'),
    europa: () => cnv(384, 192, (g, w, h) => { g.drawImage(paint(384, 192, (x, y, z) => { const n = fbm(x * 2.5, y * 2.5, z * 2.5, 4); return mixc([214, 200, 176], [246, 240, 228], n); }), 0, 0);
      let s = 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647; g.lineCap = 'round';
      for (let i = 0; i < 46; i++) { g.strokeStyle = `rgba(${140 + r() * 40},${70 + r() * 30},40,${.35 + r() * .4})`; g.lineWidth = .8 + r() * 2.2; g.beginPath(); let x = r() * w, y = h * (.1 + r() * .8); const a = r() * PI2; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.cos(a + (r() - .5) * .5) * 22; y += Math.sin(a + (r() - .5) * .5) * 12; g.lineTo(x, y); } g.stroke(); } }),
    titan: () => paint(384, 192, (x, y, z, lat) => { const n = fbm(x * 1.6, y * 4, z * 1.6, 4); return mixc([196, 128, 52], [236, 176, 90], cl(n * .8 + Math.cos(lat * 6) * .1, 0, 1)); }),
    echo: () => paint(384, 192, (x, y, z) => { const n = fbm(x * 2.4, y * 2.4, z * 2.4, 5), d = fbm(x * 5 + 2, y * 5, z * 5, 3); let c = mixc([58, 20, 96], [164, 90, 224], n); if (d > .62) c = mixc(c, [125, 249, 255], .55); return c; }),
    ceres: () => cnv(384, 192, (g, w, h) => { g.drawImage(craters(paint(384, 192, (x, y, z) => { const n = fbm(x * 2.3, y * 2.3, z * 2.3, 5); return mixc([70, 68, 70], [140, 136, 134], n); }), 110, 13, 'rgba(40,40,42,.4)', 'rgba(200,200,200,.3)'), 0, 0);
      const gr = g.createRadialGradient(w * .62, h * .42, 0, w * .62, h * .42, 9); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
    jupiter: () => cnv(384, 192, (g, w, h) => { g.drawImage(paint(384, 192, (x, y, z, lat) => { const tq = fbm(x * 3, y * 8, z * 3, 4), b = Math.sin((lat + tq * .08) * 26), c2 = Math.sin((lat + tq * .05) * 9);
        return mixc(mixc([214, 178, 136], [246, 232, 210], b * .5 + .5), [168, 110, 72], cl(-c2, 0, 1) * .45); }), 0, 0);
      g.fillStyle = 'rgba(190,80,50,.85)'; g.beginPath(); g.ellipse(w * .3, h * .64, 16, 8, 0, 0, PI2); g.fill(); }),
    saturn: () => paint(384, 192, (x, y, z, lat) => { const tq = fbm(x * 3, y * 8, z * 3, 3), b = Math.sin((lat + tq * .05) * 22); return mixc([206, 180, 128], [240, 222, 176], b * .5 + .5); }),
    rings: () => cnv(256, 4, (g, w) => { for (let i = 0; i < w; i++) { const k = i / w, gap = k > .58 && k < .64 ? .1 : 1, v = (.55 + .45 * Math.sin(k * 60) * Math.sin(k * 13)) * gap; g.fillStyle = `rgba(${Math.round(220 * v + 30)},${Math.round(200 * v + 26)},${Math.round(160 * v + 20)},${(.25 + .6 * v) * gap})`; g.fillRect(i, 0, 1, 4); } })
  };
  function tex(k) { if (!TX[k]) { const p = PAINT[k]; TX[k] = p ? texC(p()) : TX.glow; } return TX[k]; }

  /* ---------- draw helpers ---------- */
  let VP = null, EYE = [0, 0, 5], CR = [1, 0, 0], CU = [0, 1, 0], LD = nrm([.8, .35, .5]), AMB = [.08, .08, .1];
  function bindMesh(m) { gl.bindBuffer(gl.ARRAY_BUFFER, m.b); const s = 32; gl.enableVertexAttribArray(U.aP); gl.vertexAttribPointer(U.aP, 3, gl.FLOAT, false, s, 0); gl.enableVertexAttribArray(U.aN); gl.vertexAttribPointer(U.aN, 3, gl.FLOAT, false, s, 12); gl.enableVertexAttribArray(U.aU); gl.vertexAttribPointer(U.aU, 2, gl.FLOAT, false, s, 24); }
  function D(mk, M, o) {
    o = o || {}; const m = MB[mk]; bindMesh(m);
    gl.uniformMatrix4fv(U.uM, false, new Float32Array(M)); gl.uniform3fv(U.uCol, o.c ? colA(o.c) : [1, 1, 1]); gl.uniform1f(U.uE, o.e || 0);
    gl.uniform1f(U.uSpec, o.spec || 0); gl.uniform1f(U.uAlpha, o.a == null ? 1 : o.a); gl.uniform3fv(U.uAtm, o.atm ? colA(o.atm) : [0, 0, 0]); gl.uniform1f(U.uAtmK, o.atmK || 0);
    gl.uniform1f(U.uUnlit, o.unlit ? 1 : 0); gl.uniform1f(U.uNight, o.night || 0);
    if (o.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex(o.tex)); gl.uniform1f(U.uTex, 1); } else gl.uniform1f(U.uTex, 0);
    if (o.tex2) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex(o.tex2)); gl.uniform1f(U.uTex2, 1); } else gl.uniform1f(U.uTex2, 0);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
  }
  const CC = {};
  function colA(c) { if (Array.isArray(c)) return c; if (CC[c]) return CC[c]; let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return (CC[c] = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]); }
  // a glowing billboard that always faces the camera
  function glow(p, s, c, a, add) { const M = [CR[0] * s, CR[1] * s, CR[2] * s, 0, CU[0] * s, CU[1] * s, CU[2] * s, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1];
    gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, add === false ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE); gl.depthMask(false);
    D('quad', M, { c, a: a == null ? 1 : a, tex: 'glow', unlit: 1 }); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); }
  function planet(k, p, r, rot, o) { o = o || {};
    const atm = { earth: '#5aa8ff', mars: '#ff9a6a', titan: '#ffb050', europa: '#bcd8ff', jupiter: '#ffe0b0', saturn: '#ffe8b8' }[k];
    D('sph', model(p[0], p[1], p[2], r, r, r, rot || 0, o.tilt || 0, 0), { tex: k, spec: k === 'earth' ? 36 : 0, atm: atm || '#ffffff', atmK: atm ? (k === 'earth' ? 1.25 : .8) : .12, night: k === 'earth' ? 1.4 : 0, tex2: k === 'earth' ? 'earthN' : null });
    if (k === 'earth' && !o.noCloud) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); D('sph', model(p[0], p[1], p[2], r * 1.016, r * 1.016, r * 1.016, (rot || 0) * 1.25 + .7, o.tilt || 0, 0), { tex: 'clouds', a: .95 }); gl.depthMask(true); gl.disable(gl.BLEND); }
    if (atm && !o.noGlow) glow(p, r * 1.32, atm, k === 'earth' ? .5 : .3);
    if (k === 'saturn') { gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); D('ring', model(p[0], p[1], p[2], r, r, r, 0, .45, .2), { tex: 'rings' }); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); }
  }
  // particles (smoke, flames, fireworks, star dust), batched into one draw
  let PB2 = new Float32Array(9 * 6 * 600);
  function particles(list, add) {
    if (!list.length) return; const need = list.length * 54; if (PB2.length < need) PB2 = new Float32Array(need * 2); let o = 0;
    for (const q of list) { const s = q.s, c = q.c, a = q.a; const cr = [CR[0] * s, CR[1] * s, CR[2] * s], cu = [CU[0] * s, CU[1] * s, CU[2] * s];
      const V = (sx, sy, u, v) => { PB2[o++] = q.x + cr[0] * sx + cu[0] * sy; PB2[o++] = q.y + cr[1] * sx + cu[1] * sy; PB2[o++] = q.z + cr[2] * sx + cu[2] * sy; PB2[o++] = u; PB2[o++] = v; PB2[o++] = c[0]; PB2[o++] = c[1]; PB2[o++] = c[2]; PB2[o++] = a; };
      V(-1, -1, 0, 1); V(1, -1, 1, 1); V(1, 1, 1, 0); V(-1, -1, 0, 1); V(1, 1, 1, 0); V(-1, 1, 0, 0); }
    gl.useProgram(PP); gl.uniformMatrix4fv(UPa.uVP, false, new Float32Array(VP)); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, add ? TX.glow : TX.puff); gl.uniform1i(UPa.uT, 0);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferData(gl.ARRAY_BUFFER, PB2.subarray(0, o), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(UPa.aP); gl.vertexAttribPointer(UPa.aP, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(UPa.aU); gl.vertexAttribPointer(UPa.aU, 2, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(UPa.aC); gl.vertexAttribPointer(UPa.aC, 4, gl.FLOAT, false, 36, 20);
    gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, o / 9);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); useM();
  }
  function useM() { gl.useProgram(PM); gl.uniformMatrix4fv(U.uVP, false, new Float32Array(VP)); gl.uniform3fv(U.uLd, LD); gl.uniform3fv(U.uCam, EYE); gl.uniform3fv(U.uAmb, AMB); gl.uniform1i(U.uT, 0); gl.uniform1i(U.uT2, 1); }
  function starsDraw(k) { if (k <= 0) return; gl.useProgram(PS); for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); gl.uniformMatrix4fv(US.uVP, false, new Float32Array(VP)); gl.uniform1f(US.uPx, Math.max(1, cvs.width / 900)); gl.uniform1f(US.uK, k);
    gl.bindBuffer(gl.ARRAY_BUFFER, starB); gl.enableVertexAttribArray(US.aD); gl.vertexAttribPointer(US.aD, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(US.aB); gl.vertexAttribPointer(US.aB, 1, gl.FLOAT, false, 16, 12);
    gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawArrays(gl.POINTS, 0, starN); gl.disable(gl.BLEND); gl.depthMask(true); for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); useM(); }
  function sky(top, bot) { gl.useProgram(PB); for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); gl.uniform3fv(UB.uTop, top); gl.uniform3fv(UB.uBot, bot); gl.bindBuffer(gl.ARRAY_BUFFER, bgB); gl.enableVertexAttribArray(UB.aQ); gl.vertexAttribPointer(UB.aQ, 2, gl.FLOAT, false, 0, 0); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true); gl.disableVertexAttribArray(UB.aQ); }
  function camera(eye, tgt, fov) { const asp = cvs.width / cvs.height, f2 = asp < 1 ? fov * 1.35 : fov; VP = mul(persp(f2, asp, .1, 3000), look(eye, tgt, [0, 1, 0])); EYE = eye;
    const f = nrm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]); CR = nrm(cross(f, [0, 1, 0])); CU = cross(CR, f); }
  function proj(p) { const m = VP, w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; if (w <= .01) return null; return [((m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w * .5 + .5), (1 - ((m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w * .5 + .5))]; }
  const sfx = (k, x) => { try { if (typeof snd === 'function') snd(k, x); } catch (e) {} };

  /* ---------- models ---------- */
  // draw a part whose scale is flipped (bells pointing down) without losing its faces
  function D2(mk, M, o) { gl.disable(gl.CULL_FACE); D(mk, M, o); gl.enable(gl.CULL_FACE); }
  function rocket(p, ry, rz, boost, glowK) { // a detailed two-stage crew rocket, about 13.5 units tall, pointing along +y before rotation
    const P = (v) => { const r = rotV(v, ry, 0, rz); return [p[0] + r[0], p[1] + r[1], p[2] + r[2]]; }, M = (v, sx, sy, sz, r2) => { const q = P(v); return model(q[0], q[1], q[2], sx, sy, sz, ry + (r2 || 0), 0, rz); };
    const W = '#f2f4f8', DK = '#22242c';
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI2; D2('cone', M([Math.cos(a) * .3, .25, Math.sin(a) * .3], .2, -.55, .2), { c: '#3a3a44', spec: 30 }); }
    D('cyl', M([0, 0, 0], .64, .25, .64), { c: '#3a3a44' });
    D('cyl', M([0, .25, 0], .62, 6.35, .62), { c: W, spec: 22 });
    D('cyl', M([0, 4.6, 0], .628, .5, .628), { c: DK }); D('cyl', M([0, 1.15, 0], .628, .32, .628), { c: '#2a6bd8', spec: 20 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI2; D('box', model(...P([Math.cos(a) * .6, 2.2, Math.sin(a) * .6]), .06, 1.6, .34, ry - a, 0, rz), { c: i % 2 ? DK : W }); }
    D('box', model(...P([0, 3.1, .62]), .5, .3, .03, ry, 0, rz), { c: '#2a6bd8', e: .1 }); D('box', model(...P([0, 3.18, .64]), .5, .1, .02, ry, 0, rz), { c: '#3fbf5a', e: .2 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI2 + .78; D('box', model(...P([Math.cos(a) * .72, 6.05, Math.sin(a) * .72]), .32, .05, .28, ry - a, 0, rz), { c: '#8e8a98' }); }
    D('cyl', M([0, 6.6, 0], .64, .5, .64), { c: '#3a3a44', spec: 20 }); D('cyl', M([0, 6.62, 0], .65, .08, .65), { c: '#ff7a3d', e: .2 });
    D('cyl', M([0, 7.1, 0], .56, 1.6, .56), { c: W, spec: 22 });
    D('cyl', M([0, 8.7, 0], .62, 1.8, .62), { c: W, spec: 26 }); D('cyl', M([0, 9.55, 0], .625, .03, .625), { c: '#8e8a98' });
    D('cone', M([0, 10.5, 0], .62, 1.75, .62), { c: W, spec: 26 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI2 + .3; D('box', model(...P([Math.cos(a) * .6, 9.1, Math.sin(a) * .6]), .1, .22, .22, ry - a, 0, rz), { c: '#9fd0ff', e: .8 }); }
    D('cyl', M([0, 12.1, 0], .05, 1.25, .05), { c: '#c9ccd6' }); for (const q of [-1, 1]) D('box', M([q * .1, 12.4, 0], .04, .7, .04), { c: '#c9ccd6' });
    D('cone', M([0, 13.3, 0], .13, .5, .13), { c: '#ff4a2a', e: .3 }); D('cyl', M([0, 12.1, 0], .16, .3, .16), { c: '#ff4a2a' });
    if (boost) for (const q of [-1, 1]) { const bx = q * 1.0;
      D('cyl', M([bx, .3, 0], .36, 5.2, .36), { c: '#e9eef3', spec: 18 }); D('cyl', M([bx, 3.6, 0], .37, .25, .37), { c: '#ff7a3d', e: .1 }); D('cone', M([bx, 5.5, 0], .36, 1.1, .36), { c: '#ff7a3d', spec: 20 });
      D2('cone', M([bx, .35, 0], .3, -.6, .3), { c: '#3a3a44', spec: 30 }); for (const h of [1, 4.7]) D('box', M([q * .82, h, 0], .36, .1, .1), { c: '#8e8a98' }); }
    if (glowK > 0) { const b = P([0, -.5, 0]); glow(b, 1.7 * glowK + Math.random() * .3, '#ffffff', 1); glow(P([0, -2.2 * glowK, 0]), 2.8 * glowK, '#ff9a3d', .85);
      for (let i = 1; i <= 4; i++) glow(P([0, -i * 1.1 * glowK, 0]), (.7 - i * .1) * glowK + Math.random() * .1, '#bfe8ff', .7 - i * .12);
      if (boost) for (const q of [-1, 1]) { glow(P([q, -.3, 0]), 1.2 * glowK + Math.random() * .2, '#ffd27a', .95); glow(P([q, -1.6 * glowK, 0]), 1.8 * glowK, '#ff8a3d', .6); } }
  }
  function ship(p, ry, rz, glowK) { // deep-space ship: crew capsule, service module, radiators, two solar wings, dish
    const P = (v) => { const r = rotV(v, ry, 0, rz); return [p[0] + r[0], p[1] + r[1], p[2] + r[2]]; }, M = (v, sx, sy, sz, r2) => { const q = P(v); return model(q[0], q[1], q[2], sx, sy, sz, ry + (r2 || 0), 0, rz); };
    D2('cone', M([0, .15, 0], .58, -1, .58), { c: '#3a3a44', spec: 40 }); D('cyl', M([0, 0, 0], .74, .2, .74), { c: '#5d5966' });
    D('cyl', M([0, .2, 0], .72, 2.2, .72), { c: '#c9ccd6', spec: 30 }); D('cyl', M([0, 1.2, 0], .73, .2, .73), { c: '#ff7a3d', e: .15 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI2 + .78; D('box', model(...P([Math.cos(a) * .76, 1.1, Math.sin(a) * .76]), .04, 1.4, .5, ry - a, 0, rz), { c: '#f4f6fa', spec: 20 });
      for (let k = 0; k < 3; k++) D('box', model(...P([Math.cos(a) * .9, 2.15 + (k - 1) * .09, Math.sin(a) * .9]), .12, .05, .05, ry - a + (k - 1) * .4, 0, rz), { c: '#8e8a98' }); }
    D('cyl', M([0, 2.4, 0], .74, .1, .74), { c: '#3a3a44' });
    D('cone', M([0, 2.5, 0], .74, 1.4, .74), { c: '#f4f6fa', spec: 30 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI2 + .4; D('box', model(...P([Math.cos(a) * .52, 2.85, Math.sin(a) * .52]), .06, .16, .18, ry - a, 0, rz), { c: '#9fd0ff', e: 1 }); }
    D('cyl', M([0, 3.85, 0], .22, .35, .22), { c: '#8e8a98' }); D('cyl', M([0, 4.2, 0], .26, .06, .26), { c: '#3a3a44' });
    for (const q of [-1, 1]) { D('box', model(...P([0, 1.4, q * 1.2]), .08, .08, 1.0, ry, 0, rz), { c: '#8e8a98' });
      for (let k = 0; k < 3; k++) { const z = q * (1.8 + k * 1.05); D('box', model(...P([0, .75, z]), 1.15, 1.25, 1.0, ry, 0, rz), { c: '#1f3f9a', e: .12, spec: 50 }); D('box', model(...P([0, .7, z]), 1.2, 1.35, .04, ry, 0, rz), { c: '#c9ccd6' }); } }
    const dp = P([.9, 1.6, 0]); D('cyl', model(...P([.5, 1.6, 0]), .04, .5, .04, ry, 0, rz - Math.PI / 2), { c: '#c9ccd6' }); D('hemi', model(dp[0], dp[1], dp[2], .45, .14, .45, ry, 0, rz - Math.PI / 2), { c: '#f4f6fa', spec: 30 });
    if (Math.floor(TT() * 2) % 2) glow(P([0, 4.3, 0]), .12, '#ff4040', 1);
    if (glowK > 0) { glow(P([0, -.9, 0]), 1.4 + Math.random() * .25, '#e8fbff', 1); glow(P([0, -2.6, 0]), 2.4, '#5aa8ff', .6); for (let i = 1; i < 4; i++) glow(P([0, -1 - i * 1.2, 0]), .55 - i * .1, '#9fd6ff', .6 - i * .15); }
  }
  function station(p, rot) { // a space station: truss, golden solar wings, white modules, radiators
    const M = (x, y, z, sx, sy, sz, ry2) => { const r = rotV([x, y, z], rot, 0, 0); return model(p[0] + r[0], p[1] + r[1], p[2] + r[2], sx, sy, sz, rot + (ry2 || 0), 0, 0); };
    D('box', M(0, -.05, 0, 3.4, .1, .1), { c: '#c9ccd6' });
    for (const x of [-1.5, -1.05, 1.05, 1.5]) for (const z of [-1, 1]) { D('box', M(x, -.01, z * .62, .28, .02, 1.05), { c: '#b8862e', e: .1, spec: 60 }); D('box', M(x, -.03, z * .1, .03, .05, .2), { c: '#8e8a98' }); }
    for (const x of [-.45, .45]) D('box', M(x, -.01, .45, .3, .02, .6), { c: '#f4f6fa' });
D('cyl', model(...(() => { const r = rotV([0, 0, -.6], rot, 0, 0); return [p[0] + r[0], p[1] + r[1], p[2] + r[2]]; })(), .11, 1.2, .11, rot, Math.PI / 2, 0), { c: '#e9eef3', spec: 20 });
    for (const x of [-.25, .25]) { const r = rotV([x, 0, 0], rot, 0, 0); D('cyl', model(p[0] + r[0], p[1] + r[1], p[2] + r[2], .09, .5, .09, rot, 0, Math.PI / 2), { c: '#d9dde6', spec: 20 }); }
  }

  /* ---------- scenes ---------- */
  function flare(fwdK) { const f = nrm([CU[1] * CR[2] - CU[2] * CR[1], CU[2] * CR[0] - CU[0] * CR[2], CU[0] * CR[1] - CU[1] * CR[0]]), sp = [EYE[0] + LD[0] * 100, EYE[1] + LD[1] * 100, EYE[2] + LD[2] * 100], c = [EYE[0] + f[0] * 100, EYE[1] + f[1] * 100, EYE[2] + f[2] * 100];
    if (dot(LD, f) < .45) return; [[.35, 2.2, '#ffd890', .25], [.65, 1.2, '#9fd6ff', .22], [1.15, 3.4, '#b07aff', .14], [1.45, 1.6, '#7dffb0', .18]].forEach(([k, sz, col, a]) => glow([sp[0] + (c[0] - sp[0]) * k, sp[1] + (c[1] - sp[1]) * k, sp[2] + (c[2] - sp[2]) * k], sz * (fwdK || 1), col, a)); }
  function earthScene(st, cut) {
    const a = .4 + st * .06, eye = [Math.sin(a) * 6, 1.1 + Math.sin(st * .2) * .3, Math.cos(a) * 6]; camera(eye, [0, -.85, 0], .78); LD = nrm([.9, .3, .45]); AMB = [.05, .05, .07];
    gl.clearColor(0, 0, .01, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); starsDraw(1); useM();
    glow([-180, 70, -420], 230, '#3a1a6a', .22); glow([200, -40, -500], 180, '#0a3a5a', .2);
    glow([LD[0] * 120, LD[1] * 120, LD[2] * 120], 9, '#fff6d8', 1); glow([LD[0] * 120, LD[1] * 120, LD[2] * 120], 30, '#ffd890', .35);
    const R = 1.75; planet('earth', [0, 0, 0], R, TT() * .06, { tilt: .2 });
    const ma = TT() * .25, mp = [Math.cos(ma) * 3.6, Math.sin(ma) * .5 + .3, Math.sin(ma) * 3.6]; planet('moon', mp, .46, TT() * .05);
    const sx = ((st * 1.1) % 12) - 6, sp = [sx, 1.45, 2.4]; station(sp, st * .15 + .3);
    if (Math.floor(TT() * 2) % 2) glow([sp[0] + .2, sp[1] + .1, sp[2]], .07, '#ff4040', 1);
    if (sx > -.3 && sx < .3 && !cut.sb) { cut.sb = 1; sfx('sat'); } if (sx < -3) cut.sb = 0; flare(1);
  }
  function launchScene(st) {
    const lift = Math.max(0, st - 1.2), ry = .5 * 3.4 * lift * lift, k = cl(ry / 90, 0, 1);
    const ign = st > .6, shk = ign && st < 4 ? (Math.random() - .5) * .14 * (1 - cl(lift / 3, 0, 1)) : 0;
    const rb = [0, .8 + ry, 0], pan = Math.min(7, lift * 1.6);
    const eye = [14 - pan + shk, 3.4 + ry * .62 + shk, 17 - pan * .8], tgt = [0, 3.2 + ry, 0]; camera(eye, tgt, .8); LD = nrm([.6, .7, .4]); AMB = [.32, .36, .44];
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    sky(mix3([.22, .46, .86], [0, 0, .02], k), mix3([.66, .82, .97], [.03, .04, .1], k)); starsDraw(cl((k - .35) * 2, 0, 1)); useM();
    D('cyl', model(0, -.2, 0, 420, .2, 420), { c: '#4f7d48' }); D('cyl', model(0, -.15, 0, 26, .2, 26), { c: '#8b8f86' }); D('box', model(-40, -.12, 0, 80, .2, 3), { c: '#9aa0a8' });
    D('cyl', model(-90, -.18, 60, 60, .2, 40), { c: '#3a7ab8', spec: 40 });
    let s = 5; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const a = i / 26 * PI2 + r() * .2, d = 260 + r() * 90, w = 30 + r() * 60; D('cone', model(Math.cos(a) * d, -.5, Math.sin(a) * d, w, w * (.3 + r() * .4), w, r() * 6), { c: r() < .5 ? '#5d7f62' : '#6f7f80' }); }
    D('box', model(-70, 0, -30, 16, 22, 20), { c: '#d9dde6' }); D('box', model(-70, 14, -19.9, 6, 6, .2), { c: '#2a6bd8' }); D('box', model(-70, 8, -19.9, 4, 4, .2), { c: '#c0402a' }); D('box', model(-50, 0, -40, 10, 6, 8), { c: '#b9bdc6' });
    D('box', model(0, 0, 0, 9, .7, 9), { c: '#9aa0a8' }); D('box', model(0, .05, 0, 2.2, .7, 9.2), { c: '#3a3a44' }); if (ign) glow([0, .9, 3.5], 2.6, '#ff8a3d', .5);
    for (const [x, z] of [[2.6, -.6], [3.8, -.6], [2.6, .6], [3.8, .6]]) D('box', model(x, .7, z, .18, 15, .18), { c: '#c0402a' });
    for (let i = 0; i < 10; i++) { D('box', model(3.2, 1.6 + i * 1.4, -.6, 1.3, .1, .1), { c: '#c0402a' }); D('box', model(3.2, 1.6 + i * 1.4, .6, 1.3, .1, .1), { c: '#c0402a' }); D('box', model(2.6, 1.6 + i * 1.4, 0, .1, .1, 1.3), { c: '#c0402a' }); D('box', model(3.8, 1.6 + i * 1.4, 0, .1, .1, 1.3), { c: '#c0402a' }); }
    D('box', model(3.2, 15.7, 0, 1.6, .6, 1.6), { c: '#8e8a98' }); D('cyl', model(3.2, 16.3, 0, .05, 4, .05), { c: '#cccccc' });
    const arm = cl((st - .3) * 1.4, 0, 1) * 1.2; for (const h of [10, 6.5]) D('box', model(2.6 - Math.cos(arm) * 1.0, h, 0, 2, .3, .5, -arm), { c: '#8e8a98' });
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { D('cyl', model(x, 0, z, .12, 19, .12), { c: '#b9bdc6' }); D('cone', model(x, 19, z, .2, 1, .2), { c: '#b9bdc6' }); }
    for (const [x, z] of [[-9, 3], [9, -3]]) { D('cyl', model(x, 0, z, .1, 6, .1), { c: '#8e8a98' }); D('box', model(x, 6, z, 1, .6, .3, Math.atan2(-x, -z)), { c: '#fff3b0', e: k > .2 ? 2 : .6 }); }
    D('cyl', model(-8, 0, -8, .25, 8, .25), { c: '#8e8a98' }); D('sph', model(-8, 9.2, -8, 1.5, 1.4, 1.5), { c: '#e9eef3', spec: 30 });
    rocket(rb, .4, 0, true, ign ? cl((st - .6) * 2, 0, 1) * (1 + Math.random() * .15) : 0);
    for (let i = 0; i < 8; i++) { const cx = Math.sin(i * 2.7) * 120, cz = -140 - (i % 3) * 40, cy = 40 + (i % 4) * 9; for (let j = 0; j < 4; j++) inst.push({ x: cx + j * 7 + Math.sin(TT() * .1 + i) * 4, y: cy + Math.sin(j * 2.1) * 2, z: cz + j, s: 9 + (j % 2) * 3, c: [1, 1, 1], a: .32, alpha: 1 }); }
    if (ign) { const n = st < 4 ? 5 : 2; for (let i = 0; i < n; i++) { const a = Math.random() * PI2, v = 3 + Math.random() * 7, low = ry < 6;
        parts.push({ x: rb[0] + (Math.random() - .5), y: low ? .6 : rb[1] - 1, z: rb[2] + (Math.random() - .5), vx: low ? Math.cos(a) * v : (Math.random() - .5) * 1.5, vy: low ? Math.random() * 1.5 : -1 - Math.random() * 2, vz: low ? Math.sin(a) * v : (Math.random() - .5) * 1.5, l: 2.8, ml: 2.8, s0: 1.2, s1: low ? 5.5 : 3.8, c: [.92, .92, .94], add: 0 }); }
      if (st < 3.6) for (let i = 0; i < 2; i++) { const a = Math.random() * PI2, v = 6 + Math.random() * 6; parts.push({ x: rb[0], y: .8, z: rb[2], vx: Math.cos(a) * v, vy: Math.random() * 3, vz: Math.sin(a) * v, l: .6, ml: .6, s0: .5, s1: .1, c: [1, .7, .3], add: 1 }); } }
  }
  function travelScene(st, cut, to) {
    const k = cl(st / 7, 0, 1), e = ease(k), a = Math.sin(st * .25) * .25;
    camera([-3 + Math.sin(a) * 4, 3 + Math.sin(st * .3) * .4, 17], [2.5, -2.6, -12], .82); LD = nrm([-.3, .35, .9]); AMB = [.07, .07, .09];
    gl.clearColor(0, 0, .01, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); starsDraw(1); useM();
    glow([-160, 50, -420], 240, ['#3a1a6a', '#5a1a2a', '#5a3a0a', '#1a3a6a', '#4a2a0a', '#2a2a4a'][to] || '#3a1a6a', .25); glow([180, -60, -480], 160, '#0a3a5a', .2);
    const PLS = ['moon', 'mars', 'mercury', 'europa', 'titan', 'ceres', 'echo'], from = to === 0 ? 'earth' : PLS[to - 1], tk = PLS[to];
    if (to === 3) planet('jupiter', [60, 18, -130], 32 * (.55 + .45 * e), TT() * .03, { tilt: .05 });
    if (to === 4) planet('saturn', [62, 20, -130], 22 * (.55 + .45 * e), TT() * .03, { tilt: .15 });
    if (to === 2) { glow([70, 10, -150], 26, '#fff6d8', 1); glow([70, 10, -150], 70, '#ffb050', .45); }
    planet(from, [-30 - 22 * e, -3, -60], 16 * (1 - .78 * e), TT() * .04, { tilt: .2 });
    planet(tk, [30, -1, -70], 3 + 17 * e, TT() * .04, { tilt: .1 });
    const nA = to === 5 ? 14 : 5; for (let i = 0; i < nA; i++) { const sp = 6 + (i % 4) * 2, ph = ((st * sp + i * 13.7) % 90) / 90, x = 40 - ph * 80, y = Math.sin(i * 3.1) * 7 - 2, z = -6 - (i % 5) * 4, sz = .3 + (i % 3) * .25;
      D('sphL', model(x, y, z, sz * 1.3, sz, sz * 1.1, st * .8 + i, i), { c: i % 2 ? '#6d6a70' : '#857e78' }); }
    ship([0, Math.sin(TT() * 2) * .15, 0], .25, -Math.PI / 2, 1);
    for (let i = 0; i < 3; i++) parts.push({ x: 26 + Math.random() * 6, y: (Math.random() - .5) * 14, z: -Math.random() * 22 + 4, vx: -40 - Math.random() * 20, vy: 0, vz: 0, l: 1.2, ml: 1.2, s0: .07, s1: .07, c: [.8, .9, 1], add: 1 });
    if (st > 6.6 && !cut.arr) { cut.arr = 1; sfx('arrive'); } flare(1);
  }
  function astronaut(x, z, ang, wave, suitC) { const ca = Math.cos(ang), sa = Math.sin(ang);
    D('cyl', model(x, 0, z, .13, .5, .15, ang), { c: suitC }); D('sphL', model(x, .64, z, .17, .16, .17), { c: suitC, spec: 30 });
    D('sphL', model(x + ca * .08, .66, z + sa * .08, .1, .09, .12, -ang), { c: '#c88a2a', e: .3, spec: 60 }); D('box', model(x - ca * .14, .22, z - sa * .14, .16, .3, .2, -ang), { c: '#c9ccd6' });
    const wa = wave ? Math.sin(TT() * 7) * .5 : 0; D('box', model(x - sa * .17, .62, z + ca * .17, .06, .3, .06, -ang, 0, .6 + wa), { c: suitC }); }
  function conquerScene(st, cut, w) {
    const PLS = ['moon', 'mars', 'mercury', 'europa', 'titan', 'ceres', 'echo'], pk = PLS[w] || 'moon', ang = .6 + st * .11;
    camera([Math.sin(ang) * 12, 5.2, Math.cos(ang) * 12], [0, -1.1, 0], .8); LD = nrm([.7, .55, .35]); AMB = [.16, .16, .19];
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (w === 1) sky([.36, .26, .22], [.78, .58, .42]); else if (w === 4) sky([.44, .3, .12], [.84, .6, .3]); else starsDraw(1);
    useM();
    if (w === 0) planet('earth', [-60, 26, -80], 7, TT() * .06, { tilt: .2 });
    if (w === 3) planet('jupiter', [-70, 30, -120], 34, TT() * .02);
    if (w === 4) glow([-40, 30, -80], 10, '#ffe0a0', .4);
    if (w === 2) { glow([-50, 22, -70], 14, '#fff6d8', 1); glow([-50, 22, -70], 40, '#ffb050', .4); }
    planet(pk, [0, -60, 0], 60, 0, { noGlow: 1 });
    // the outpost
    D('cyl', model(0, -.2, 0, 4.4, .3, 4.4), { c: '#5d5966' }); for (let i = 0; i < 28; i++) { const a = i / 28 * PI2; D('box', model(Math.cos(a) * 4.25, .08, Math.sin(a) * 4.25, .35, .06, .16, -a), { c: i % 2 ? '#ffcf4a' : '#2a2833', e: .1 }); }
    D('cyl', model(0, 0, 0, 1.72, .45, 1.72), { c: '#d9dde6', spec: 20 }); D('hemi', model(0, .45, 0, 1.7, 1.55, 1.7), { c: '#f4f6fa', spec: 30 });
    for (const h of [.35, .75, 1.15]) { const rr = 1.72 * Math.sqrt(Math.max(0, 1 - Math.pow(h / 1.55, 2))) + .01; D('cyl', model(0, .45 + h, 0, rr, .035, rr), { c: '#b9bfcc' }); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI2; D('box', model(Math.cos(a) * 1.68, .55, Math.sin(a) * 1.68, .26, .2, .1, -a + Math.PI / 2), { c: '#fff1d0', e: 1.4 }); glow([Math.cos(a) * 1.85, .65, Math.sin(a) * 1.85], .2, '#ffd890', .5); }
    D('cyl', model(1.6, .7, 0, .26, 1.1, .26, 0, 0, -Math.PI / 2), { c: '#c9ccd6' });
    D('cyl', model(2.7, .75, 0, .7, 2.4, .7, 0, 0, -Math.PI / 2), { c: '#d9dde6', spec: 20 }); for (const x of [3.1, 3.9, 4.7]) D('cyl', model(x, .75, 0, .72, .06, .72, 0, 0, -Math.PI / 2), { c: '#9aa3ad' });
    D('box', model(3.9, 1.3, .55, .6, .18, .1), { c: '#9fd0ff', e: 1 });
    D('cyl', model(-1.2, .7, 2.2, .6, 2, .6, .9, 0, Math.PI / 2), { c: '#d9dde6', spec: 20 });
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); D('hemi', model(1.1, 0, 3.4, 1.1, .9, 1.1), { c: '#cfe9f5', a: .35, spec: 60 }); gl.disable(gl.BLEND);
    for (let i = 0; i < 5; i++) D('sphL', model(1.1 + Math.cos(i * 1.3) * .5, .15, 3.4 + Math.sin(i * 1.3) * .5, .22, .3, .22), { c: '#3fbf5a', e: .3 });
    for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) { const x = -3.4 + c2 * .9, z = -.6 + r2 * 1.1; D('cyl', model(x, 0, z, .05, .7, .05), { c: '#8e8a98' }); D('box', model(x, .7, z, .8, .05, .9, .3, -.5), { c: '#1f3f9a', e: .2, spec: 50 }); }
    D('cyl', model(1.6, 0, -2.2, .05, 1.8, .05), { c: '#bbbbbb' }); D('cone', model(1.6, 2.2, -2.2, .6, -.3, .6, TT() * .5, .4), { c: '#e9eef3' });
    for (let i = 0; i < 6; i++) { D('box', model(2.6, i * .5, -1.2, .04, .5, .04, 0, .1), { c: '#c9ccd6' }); } D('box', model(2.6, 3, -1.2, .1, .1, .1), { c: '#ff3030', e: Math.floor(TT() * 2) % 2 ? 2 : .2 }); if (Math.floor(TT() * 2) % 2) glow([2.6, 3.05, -1.2], .4, '#ff4040', .9);
    D('box', model(2.8, .14, 2.3, 1.1, .3, .65, .4), { c: '#b9bdc6' }); D('box', model(2.8, .44, 2.3, .7, .05, .55, .4), { c: '#1f3f9a', e: .2 });
    for (const f of [-1, 0, 1]) for (const q of [-1, 1]) { const ox = Math.cos(.4) * f * .38 - Math.sin(.4) * q * .36, oz = Math.sin(.4) * f * .38 + Math.cos(.4) * q * .36; D('cyl', model(2.8 + ox, .12, 2.3 + oz, .13, .08, .13, -.4, Math.PI / 2), { c: '#2a2833' }); }
    D('cyl', model(2.55, .44, 2.2, .025, .5, .025), { c: '#bbbbbb' }); D('box', model(2.55, .94, 2.2, .14, .1, .1, .4), { c: '#e9eef3' });
    const lx = -3.3, lz = -3.1; for (let i = 0; i < 4; i++) { const a = i / 4 * PI2 + .78; D('box', model(lx + Math.cos(a) * .55, 0, lz + Math.sin(a) * .55, .05, .7, .05, 0, 0, 0), { c: '#9aa3ad' }); D('cyl', model(lx + Math.cos(a) * .7, 0, lz + Math.sin(a) * .7, .14, .04, .14), { c: '#5d5966' }); }
    D('cyl', model(lx, .5, lz, .5, .9, .5), { c: '#c9ccd6', spec: 30 }); D('cone', model(lx, 1.4, lz, .5, .8, .5), { c: '#f4f6fa', spec: 30 }); D('box', model(lx, 1.6, lz + .4, .12, .12, .05), { c: '#9fd0ff', e: 1 });
    const fh = Math.min(1, st / 1.2) * 2.6; D('cyl', model(-.9, 0, -1.9, .03, fh, .03), { c: '#dddddd' });
    if (fh > 1.2) for (let i = 0; i < 12; i++) { const wv = Math.sin(TT() * 6 - i * .6) * .05 * i * .3; D('box', model(-.88 + i * .085, fh - .6 + wv, -1.9 + wv, .09, .55, .02), { c: i >= 4 && i <= 7 ? '#3fbf5a' : '#2a6bd8', e: .15 }); }
    astronaut(-.45, -1.5, .5, true, '#f2f2f5'); astronaut(-1.35, -1.35, 2.5, true, '#f2f2f5');
    for (let i = 0; i < 2; i++) { const a = TT() * .35 + i * 2.5; astronaut(Math.cos(a) * 2.9, Math.sin(a) * 2.9, a + Math.PI / 2, false, '#e9eef3'); }
    if (st > 1 && Math.random() < .05) { const fx = (Math.random() - .5) * 12, fy = 4.5 + Math.random() * 3, fz = (Math.random() - .5) * 10, cc = [[1, .88, .4], [1, .48, .24], [.42, .78, 1], [.37, .88, .54], [1, .42, .84]][Math.floor(Math.random() * 5)];
      for (let i = 0; i < 40; i++) { const u = Math.random() * 2 - 1, t = Math.random() * PI2, q = Math.sqrt(1 - u * u), v = 1.8 + Math.random() * 1.2; parts.push({ x: fx, y: fy, z: fz, vx: q * Math.cos(t) * v, vy: u * v, vz: q * Math.sin(t) * v, g: -1.2, l: 1.4, ml: 1.4, s0: .14, s1: .05, c: cc, add: 1 }); }
      for (let i = 0; i < 6; i++) parts.push({ x: fx, y: fy - i * .5, z: fz, vx: 0, vy: -.5, vz: 0, l: .5 + i * .1, ml: 1, s0: .1, s1: .05, c: [1, .9, .6], add: 1 });
      sfx('pop'); }
    void cut;
  }
  function titleScene(st, w) { // the title screen: the chosen world turning slowly in space
    const PLS = ['moon', 'mars', 'mercury', 'europa', 'titan', 'ceres', 'echo'], pk = PLS[w] || 'moon', port = cvs.height > cvs.width, a = Math.sin(st * .05) * .18;
    camera([Math.sin(a) * 8.4, .9, Math.cos(a) * 8.4], port ? [0, -1.6, 0] : [-2.6, .1, 0], .74); LD = nrm([-.65, .45, .6]); AMB = [.05, .05, .07];
    gl.clearColor(0, 0, .01, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); starsDraw(1); useM();
    glow([-260, 90, -520], 320, ['#3a1a6a', '#5a1a2a', '#5a3a0a', '#1a3a6a', '#4a2a0a', '#2a2a4a'][w] || '#3a1a6a', .3); glow([240, -90, -620], 230, '#0a3a5a', .24);
    const sp = [LD[0] * 160, LD[1] * 160, LD[2] * 160]; glow(sp, 10, '#fff6d8', 1); glow(sp, 36, '#ffd890', .3);
    if (w === 0) planet('earth', [-5.5, 2.4, -10], 1, TT() * .06, { tilt: .2 });
    if (w === 3) planet('jupiter', [-8, 2.6, -16], 3.6, TT() * .02, { tilt: .05 });
    if (w === 4) planet('saturn', [-8, 2.6, -16], 2.4, TT() * .02, { tilt: .2 });
    planet(pk, [0, 0, 0], 2.7, TT() * .045, { tilt: .25 });
    for (let i = 0; i < 2; i++) { const oa = TT() * (.3 + i * .12) + i * 2.6, p = [Math.cos(oa) * (3.6 + i * .7), Math.sin(oa * .8) * .7 + .3, Math.sin(oa) * (3.6 + i * .7)]; D('box', model(p[0], p[1] - .04, p[2], .12, .08, .08, -oa), { c: '#c9ccd6', spec: 30 }); D('box', model(p[0], p[1] - .02, p[2], .02, .02, .5, -oa), { c: '#2c5bc4', e: .4 }); if (Math.floor(TT() * 2 + i) % 2) glow(p, .08, '#ff4040', 1); }
  }
  // the warp gate, v2: six beams, a gate of rotating rune rings, an accretion storm, a saucer fleet, and the Echo
  const GT = [2.4, 1.2, -5], GSRC = [[-12, 6.5, -16], [-4, 8.5, -22], [9, 7.5, -20], [15, 1, -18], [12, -6.5, -16], [-1, -7.5, -20]];
  function ginst(x, y, z, s, c, a) { inst.push({ x, y, z, s, c, a: a == null ? 1 : a }); }
  function bolt(a, b, seed, c, w) { let s = seed; const r = () => (s = s * 16807 % 2147483647) / 2147483647, n = 16; let p = a.slice();
    for (let i = 1; i <= n; i++) { const k = i / n, j = i < n ? .55 * Math.sin(k * Math.PI) : 0, q = [a[0] + (b[0] - a[0]) * k + (r() - .5) * j, a[1] + (b[1] - a[1]) * k + (r() - .5) * j, a[2] + (b[2] - a[2]) * k + (r() - .5) * j * .4];
      for (let m = 0; m < 3; m++) { const u = m / 3; ginst(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u, w, c, 1); } p = q; } }
  function saucer(x, y, z, s, spin, tilt, i) {
    D('sphL', model(x, y, z, s, s * .2, s, spin, tilt), { c: '#9aa3b6', spec: 70 }); D('cyl', model(x, y - s * .02, z, s * 1.02, s * .05, s * 1.02, spin, tilt), { c: '#4a5266', spec: 40 });
    D('sphL', model(x, y + s * .13, z, s * .4, s * .34, s * .4, 0, tilt), { c: '#7df9ff', e: .9, spec: 90 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI2 + spin; ginst(x + Math.cos(a) * s * .95, y - s * .02, z + Math.sin(a) * s * .95, s * .22, (k + i) % 2 ? [1, .25, .4] : [1, .85, .3], 1); }
    glow([x, y - s * .2, z], s * 2.6, '#b070ff', .3); }
  function gateScene(st, cut, ph) {
    const t = TT(), G = GT, quake = ph === 3 ? .07 * cl(st / 1.5, 0, 1) : ph === 4 ? .14 * Math.max(0, 1 - st / 3) : ph === 1 ? .02 : 0, qx = Math.sin(t * 43) * quake, qy = Math.cos(t * 37) * quake;
    // camera choreography
    let eye, tgt, fov = .85;
    if (ph === 0) { const k = ease(cl(st / 7, 0, 1)); eye = [-9 + k * 7, -1 + k * 2.4, 9 + k * 6]; tgt = [-2 + k * 4, 1.5, -10 + k * 5]; }
    else if (ph === 1) { const k = ease(cl(st / 6, 0, 1)); eye = [-1.5 + Math.sin(st * .2) * 1.5, 1.2, 15 - k * 4.5]; tgt = [G[0] - .4, G[1], G[2]]; fov = .85 - k * .12; }
    else if (ph === 2) { eye = [-4.6 + Math.sin(st * .15) * .6, -1.1, 6.5]; tgt = [G[0] - 1.5, G[1] - .2, G[2]]; fov = .95; }
    else if (ph === 3) { const k = ease(cl(st / 9, 0, 1)); eye = [G[0] - 1.2 + Math.sin(st * .3) * .5, G[1] + .2, G[2] + 13.5 - k * 5.5]; tgt = [G[0], G[1], G[2] + 1]; fov = .8 - k * .15; }
    else { const k = ease(cl(st / 4, 0, 1)); eye = [-1 - k * 2, 1.4 + k, 11 + k * 6]; tgt = [G[0] * (1 - k), G[1], G[2] * (1 - k * .6)]; }
    camera([eye[0] + qx, eye[1] + qy, eye[2]], tgt, fov); LD = nrm([-.5, .4, .8]); AMB = [.07, .04, .1];
    const red = ph >= 3 && ph < 4 ? .03 + .02 * Math.sin(t * 3) : 0; gl.clearColor(.012 + red, 0, .025, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); starsDraw(1); useM();
    glow([G[0] + 6, G[1] + 3, G[2] - 30], 40, '#3a0a5a', .35); glow([G[0] - 14, G[1] - 6, G[2] - 34], 30, '#0a2a4a', .3);
    // Earth, with city lights on its dark side and red alert glints once the fleet comes
    planet('earth', [-6.5, -2.2, 1.5], 2.3, t * .05, { tilt: .2 });
    if (ph >= 2 && ph < 4) for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * .3; glow([-6.5 + Math.cos(a) * 2.45, -2.2 + Math.sin(a * 1.3) * 2, 1.5 + Math.sin(a) * .6 + 1.6], .5, '#ff3030', .4 + .4 * Math.sin(t * 8 + i)); }
    // the six doors and their beams
    const PLS = ['moon', 'mars', 'mercury', 'europa', 'titan', 'ceres'], open = ph === 0 ? cl((st - 2.6) / 3.4, 0, 1) : ph === 4 ? Math.max(0, 1 - st / 2.4) : 1;
    PLS.forEach((k, i) => { const p = GSRC[i], on = ph === 0 ? cl(st * .9 - i * .38, 0, 1) : ph === 4 ? open : 1; planet(k, p, .95, t * .1, { noGlow: 1 }); if (on <= 0) return;
      if (ph === 0 && !cut.hd[i] && on > .02) { cut.hd[i] = 1; sfx('beam'); if (typeof horSfx === 'function') horSfx('boom'); for (let m = 0; m < 30; m++) { const a = Math.random() * PI2, b = Math.random() * PI2, v = 2 + Math.random() * 3; parts.push({ x: p[0], y: p[1], z: p[2], vx: Math.cos(a) * Math.cos(b) * v, vy: Math.sin(b) * v, vz: Math.sin(a) * Math.cos(b) * v, l: .9, ml: .9, s0: .3, s1: 0, c: [.8, .5, 1], add: 1 }); } }
      glow(p, 3.2, '#c070ff', .75 * on); glow(p, 1.4, '#ffffff', .5 * on);
      const len = on, d = [G[0] - p[0], G[1] - p[1], G[2] - p[2]];
      for (let j = 0; j < 46; j++) { const u = j / 46 * len; ginst(p[0] + d[0] * u, p[1] + d[1] * u, p[2] + d[2] * u, .2, [.6, .3, 1], .9); ginst(p[0] + d[0] * u, p[1] + d[1] * u, p[2] + d[2] * u, .07, [1, .9, 1], 1); }
      for (let j = 0; j < 4; j++) { const u = ((t * .9 + j / 4 + i * .13) % 1) * len; ginst(p[0] + d[0] * u, p[1] + d[1] * u, p[2] + d[2] * u, .55, [.9, .7, 1], 1); } });
    // the gate itself
    if (ph === 0 && st > 2.6) { const k = cl((st - 2.6) / 3.4, 0, 1); glow(G, .6 + k * 3, '#ffffff', .8); glow(G, 1 + k * 7, '#b070ff', .5); if (!cut.core) { cut.core = 1; if (typeof horSfx === 'function') horSfx('rise'); } }
    if (open > 0 && (ph > 0 || st > 4)) { const o = ph === 0 ? cl((st - 4) / 2, 0, 1) : open, R = 3.3 * ease(o) * (1 + .025 * Math.sin(t * 6));
      if (ph >= 1 && !cut.shock) { cut.shock = 1; for (let m = 0; m < 90; m++) { const a = m / 90 * PI2; parts.push({ x: G[0], y: G[1], z: G[2], vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, vz: (Math.random() - .5) * 2, l: 1.4, ml: 1.4, s0: .5, s1: .1, c: [.85, .6, 1], add: 1 }); } }
      // accretion storm spiralling in
      for (let i = 0; i < 110; i++) { const f = ((t * .22 + i * .0091) % 1), a = i * 2.399 + t * (1.4 + f * 2.5), r = R * (2.4 - f * 1.55); ginst(G[0] + Math.cos(a) * r, G[1] + Math.sin(a) * r * .92, G[2] - f * .6, .1 + f * .16, f > .7 ? [1, .9, 1] : i % 3 ? [.7, .35, 1] : [.4, .9, 1], .35 + f * .65); }
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
      D('ring', model(G[0], G[1], G[2], R * .56, R * .56, R * .56, t * .7, Math.PI / 2), { c: '#b070ff', e: 1.6, unlit: 1, a: .8 });
      D('ring', model(G[0], G[1], G[2] + .05, R * .44, R * .44, R * .44, -t * 1.4, Math.PI / 2), { c: '#7df9ff', e: 1.6, unlit: 1, a: .5 });
      D('ring', model(G[0], G[1], G[2] - .05, R * .7, R * .7, R * .7, t * .35, Math.PI / 2), { c: '#ff2a6a', e: 1.2, unlit: 1, a: .22 });
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
      // rune blocks riding the rim
      for (let i = 0; i < 24; i++) { const a = i / 24 * PI2 + t * .5, rr = R * 1.32, on2 = (Math.floor(t * 3) + i) % 6 === 0; D('box', model(G[0] + Math.cos(a) * rr, G[1] + Math.sin(a) * rr, G[2], R * .07, R * .16, R * .07, 0, 0, a), { c: on2 ? '#ffffff' : '#5a2a8a', e: on2 ? 2 : .5, spec: 30 }); }
      // the black heart of the gate
      glow(G, R * 3.1, '#5a10a0', .5); glow(G, R * 1.25, '#000000', .97, false); glow(G, R * .95, '#000000', .9, false); glow(G, R * .6, '#ff1a5a', .12 + .1 * Math.sin(t * 4));
      // lightning crawling over the rim
      if (ph < 4) for (let b = 0; b < 3; b++) { const seed = Math.floor(t * 9) * 7 + b * 131; if ((seed % 5) > 2) continue; const a1 = (seed % 360) / 57.3, a2 = a1 + .6 + (seed % 7) * .12;
        bolt([G[0] + Math.cos(a1) * R * 1.2, G[1] + Math.sin(a1) * R * 1.2, G[2]], [G[0] + Math.cos(a2) * R * 1.75, G[1] + Math.sin(a2) * R * 1.75, G[2] + .3], seed + 1, [.85, .8, 1], .09); }
      if (Math.random() < .05 && ph < 4) sfx('crack'); }
    // the fleet
    if (ph >= 2 && ph < 4) { const n = ph === 2 ? Math.min(44, Math.floor(st * 9)) : 30;
      for (let i = 0; i < n; i++) { const u = ((t * .13 + i * .0227) % 1), sp = (i * 2.399) % PI2, row = i % 3;
        const x = G[0] + (-6.5 - G[0]) * u + Math.cos(sp) * (.8 + u * 3.4), y = G[1] + (-2.2 - G[1]) * u + Math.sin(sp) * (.8 + u * 2.6) + Math.sin(t * 3 + i) * .2, z = G[2] + (1.5 - G[2]) * u + Math.sin(sp * 2) * u * 2.5 + row * .6;
        saucer(x, y, z, .2 + u * .38, t * 4 + i, -.25 + Math.sin(t + i) * .1, i); }
      // three saucers scream right past the camera
      if (ph === 2) for (let i = 0; i < 3; i++) { const u = cl((st - 1.5 - i * 1.4) / 1.6, 0, 1); if (u <= 0 || u >= 1) continue; const x = G[0] - 1 + (eye[0] - G[0] + 2 + i) * u, y = G[1] + (eye[1] - G[1] - 1.2 + i * .6) * u, z = G[2] + (eye[2] - G[2] - 1.5) * u;
        saucer(x, y, z, .35 + u * .9, t * 6, -.4, i); if (!cut['fly' + i] && u > .55) { cut['fly' + i] = 1; sfx('whoosh'); } }
      if (ph === 2 && !cut.ufo) { cut.ufo = 1; sfx('warp'); sfx('alarm'); } }
    // the Echo
    if (ph >= 3) { const e = ph === 3 ? ease(cl(st / 2.6, 0, 1)) : Math.max(0, 1 - st / 1.6), R = 3.2 * e, bx = G[0], by = G[1], bz = G[2] + .4 + 1.6 * e, lx = Math.sin(t * .6) * .18 + (ph === 3 && st > 4 ? (eye[0] - bx) * .02 : 0);
      if (R > .05) {
        glow([bx, by, bz], R * 4, '#4a0070', .65); glow([bx, by, bz + R], R * 2.2, '#ff1a4a', .12 + .08 * Math.sin(t * 2));
        D('sph', model(bx, by, bz, R, R * .92, R * .95, t * .1), { c: '#1c0a26', spec: 30 });
        for (let i = 0; i < 26; i++) { const a = i * 2.399, h = ((i * .37) % 1) * 1.6 - .8, rr = Math.sqrt(1 - h * h * .7); D('sphL', model(bx + Math.cos(a) * R * rr * .95, by + h * R * .9, bz + Math.sin(a) * R * rr * .6 + R * .2, R * .2, R * .17, R * .2), { c: '#2e1238', spec: 25 }); }
        // tentacles reach out and grip the rim of the gate
        for (let k = 0; k < 10; k++) { const a = k / 10 * PI2 + .3, grip = [G[0] + Math.cos(a) * 3.3 * 1.15, G[1] + Math.sin(a) * 3.3 * 1.15, G[2] + .2];
          for (let j = 1; j <= 18; j++) { const u = j / 18, w = Math.sin(t * 2.4 + k * 1.7 + j * .8) * .35 * (1 - u * .7), base = [bx + Math.cos(a) * R * .8, by + Math.sin(a) * R * .8, bz];
            const x = base[0] + (grip[0] - base[0]) * u + Math.cos(a + 1.57) * w, y = base[1] + (grip[1] - base[1]) * u + Math.sin(a + 1.57) * w, z = base[2] + (grip[2] - base[2]) * u + Math.sin(u * Math.PI) * 1.4, s = R * (.36 - u * .26);
            D('sphL', model(x, y, z, s, s, s), { c: j > 14 ? '#5a1a6a' : '#2a0f36', spec: 35 }); if (j % 4 === 0) ginst(x, y, z + s * .6, s * .5, [1, .15, .4], .6 + .4 * Math.sin(t * 5 + j + k)); } }
        // many eyes open, one by one, then the great eye
        for (let i = 0; i < 9; i++) { const op = cl(st * 1.6 - i * .5, 0, 1) * (ph === 4 ? 0 : 1); if (op <= 0) continue; const a = i * 2.2 + .7, rr = R * (.55 + (i % 3) * .12), ex = bx + Math.cos(a) * rr, ey = by + Math.sin(a) * rr * .8, ez = bz + R * .72;
          D('sph', model(ex, ey, ez, R * .1, R * .1 * op, R * .05), { c: '#ffe8f0', e: .3 }); D('sph', model(ex + lx * R * .3, ey, ez + R * .04, R * .05, R * .05 * op, R * .02), { c: '#ff1a4a', e: 1.8 }); }
        const lid = ph === 3 ? cl((st - 1.2) / 1.2, 0, 1) : 1, dil = ph === 3 ? .7 + .3 * Math.sin(t * 1.3) : 1;
        D('sph', model(bx + lx * R, by, bz + R * .66, R * .64, R * .62 * lid, R * .42), { c: '#f2e6ef', spec: 80 });
        D('sph', model(bx + lx * R * 1.3, by, bz + R * 1.0, R * .36, R * .36 * lid, R * .08), { c: '#ff1040', e: 1.9 });
        D('sph', model(bx + lx * R * 1.35, by, bz + R * 1.07, R * .09 * dil, R * .28 * lid, R * .03), { c: '#000000' });
        glow([bx + lx * R * 1.3, by, bz + R * 1.15], R * 1.1, '#ff1040', (.4 + .3 * Math.sin(t * 5)) * lid);
        if (ph === 3 && !cut.roar) { cut.roar = 1; sfx('roar'); sfx('boss'); } } }
    if (ph === 4) { const f = Math.max(0, 1 - st / 1.4); glow(G, 34 * (1 - f) + 2, '#ffffff', f); glow(G, 60 * (1 - f), '#b070ff', f * .5);
      if (!cut.boom) { cut.boom = 1; sfx('bossdie'); for (let m = 0; m < 160; m++) { const a = Math.random() * PI2, b = (Math.random() - .5) * 2, v = 4 + Math.random() * 10; parts.push({ x: G[0], y: G[1], z: G[2], vx: Math.cos(a) * v, vy: b * v * .6, vz: Math.sin(a) * v * .5, l: 2, ml: 2, s0: .35, s1: 0, c: m % 3 ? [.8, .5, 1] : [1, 1, 1], add: 1 }); } } }
  }
  function homeScene(st, cut) {
    const a = st * .08 + .3; camera([Math.sin(a) * 15.5, 7.5, Math.cos(a) * 15.5], [0, -2.6, 0], .8); LD = nrm([.7, .4, .55]); AMB = [.06, .06, .08];
    gl.clearColor(0, 0, .01, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); starsDraw(1); useM();
    planet('earth', [0, 0, 0], 2.3, TT() * .06, { tilt: .2 });
    const PLS = ['moon', 'mars', 'mercury', 'europa', 'titan', 'ceres'], names = (typeof LV !== 'undefined' ? LV.map(l => l.n) : PLS); C3.labels = [];
    PLS.forEach((k, i) => { const an = i / 6 * PI2 + .4, fin = [Math.cos(an) * 7.5, Math.sin(i * 1.7) * 1.2, Math.sin(an) * 7.5], p = cl(st * .8 - i * .25, 0, 1);
      if (p <= 0) return; const e = ease(p), pos = [fin[0] * e, fin[1] * e, fin[2] * e];
      for (let j = 0; j < 9; j++) { const u = ((TT() * .5 + j / 9) % 1) * e; inst.push({ x: fin[0] * u, y: fin[1] * u, z: fin[2] * u, s: .09, c: [.47, .78, 1], a: 1 }); }
      planet(k, pos, .55 * (.3 + .7 * e), TT() * .1, { noGlow: 1 });
      if (p >= 1) { if (!cut.hd[i]) { cut.hd[i] = 1; sfx('chime', i); } const q = proj([pos[0], pos[1] - .95, pos[2]]); if (q) C3.labels.push({ x: q[0], y: q[1], t: names[i] || k }); } });
  }

  /* ---------- particles update ---------- */
  function stepParts(dt) {
    for (const q of parts) { q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.g) q.vy += q.g * dt; if (!q.add) { q.vx *= Math.pow(.6, dt); q.vz *= Math.pow(.6, dt); q.vy += .25 * dt; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].l <= 0) parts.splice(i, 1);
    if (parts.length > 900) parts.splice(0, parts.length - 900);
  }
  function drawParts() {
    const al = [], ad = [];
    for (const q of parts) { const k = cl(q.l / q.ml, 0, 1), s = lerp(q.s1, q.s0, k); (q.add ? ad : al).push({ x: q.x, y: q.y, z: q.z, s, c: q.c, a: q.add ? Math.min(1, k * 1.5) : k * .55 }); }
    if (al.length) { const e = EYE; al.sort((p, q) => Math.hypot(q.x - e[0], q.y - e[1], q.z - e[2]) - Math.hypot(p.x - e[0], p.y - e[1], p.z - e[2])); particles(al, false); }
    particles(ad.concat(inst), true); inst.length = 0;
  }

  /* ---------- frame ---------- */
  const TT = () => performance.now() / 1000;
  let lastKey = '', lastT = 0;
  function size() {
    const cv = document.getElementById('c'); if (--rectT > 0 && cvs.style.display === 'block') return; rectT = 30;
    const r = cv.getBoundingClientRect(), st = cv.parentNode.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.style.display = 'block'; cvs.style.left = (r.left - st.left) + 'px'; cvs.style.top = (r.top - st.top) + 'px'; cvs.style.width = r.width + 'px'; cvs.style.height = r.height + 'px';
    let pw = Math.round(r.width * dpr), ph = Math.round(r.height * dpr); const mx = 1700000; if (pw * ph > mx) { const k = Math.sqrt(mx / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
    if (cvs.width !== pw || cvs.height !== ph) { cvs.width = pw; cvs.height = ph; }
  }
  C3.supported = () => { if (C3.ok === null) { try { C3.ok = init(); } catch (e) { console.warn('3D cutscenes unavailable', e); C3.ok = false; } } return C3.ok; };
  // returns true when it drew the scene in 3D
  C3.draw = (sc, st, cut) => {
    if (!sc || !C3.supported() || !C3.ok) return false;
    try {
      size(); const key = sc.sc + ':' + (sc.to == null ? '' : sc.to) + ':' + (sc.w == null ? '' : sc.w) + ':' + (sc.ph == null ? '' : sc.ph); if (key !== lastKey) { parts.length = 0; lastKey = key; C3.labels = []; }
      const now = performance.now() / 1000, dt = Math.min(.05, Math.max(0, now - (lastT || now))); lastT = now;
      gl.viewport(0, 0, cvs.width, cvs.height); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);
      if (sc.sc !== 'home') C3.labels = [];
      switch (sc.sc) {
        case 'earth': earthScene(st, cut); break;
        case 'launch': launchScene(st); break;
        case 'travel': travelScene(st, cut, sc.to || 0); break;
        case 'conquer': conquerScene(st, cut, sc.w || 0); break;
        case 'home': homeScene(st, cut); break;
        case 'title': titleScene(st, sc.w || 0); break;
        case 'gate': gateScene(st, cut, sc.ph || 0); break;
        default: return false;
      }
      stepParts(dt); drawParts(); return true;
    } catch (e) { console.warn('3D cutscene error, using 2D', e); C3.ok = false; C3.hide(); return false; }
  };
  C3.hide = () => { if (cvs && cvs.style.display !== 'none') cvs.style.display = 'none'; rectT = 0; lastKey = ''; };
})();
