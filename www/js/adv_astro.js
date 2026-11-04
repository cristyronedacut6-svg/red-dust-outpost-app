// Red Dust Outpost · a fully jointed astronaut with a procedural gait engine.
// Real joints (hips, knees, ankles, spine, neck, shoulders, elbows, wrists) driven by a walk/run cycle that blends into
// the Apollo "bunny hop" lope in low gravity, idle breathing, airborne poses, landing squash and leaning into turns.
// Front of the body faces +Z (the game rotates the player group to face the way it moves).
import * as THREE from 'three';

let ENV = null;
function visorEnv() { if (ENV) return ENV; const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#0b1426'); gr.addColorStop(.42, '#6d8fb8'); gr.addColorStop(.5, '#ffe7c0'); gr.addColorStop(.56, '#8a6a4a'); gr.addColorStop(1, '#241a12'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(255,255,240,.95)'; g.beginPath(); g.arc(70, 34, 7, 0, 7); g.fill(); ENV = new THREE.CanvasTexture(c); ENV.mapping = THREE.EquirectangularReflectionMapping; ENV.colorSpace = THREE.SRGBColorSpace; return ENV; }
let FAB = null;
function fabricNormal() { if (FAB) return FAB; const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N), h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = Math.sin(x / N * Math.PI * 2 * 24) * .5 + Math.sin(y / N * Math.PI * 2 * 24) * .5 + (Math.random() - .5) * .6;   // woven Beta-cloth weave
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x], o = (y * N + x) * 4, l = Math.hypot(dx * .25, dy * .25, 1);
    im.data[o] = (-dx * .25 / l * .5 + .5) * 255; im.data[o + 1] = (-dy * .25 / l * .5 + .5) * 255; im.data[o + 2] = (1 / l * .5 + .5) * 255; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); FAB = new THREE.CanvasTexture(c); FAB.wrapS = FAB.wrapT = THREE.RepeatWrapping; FAB.repeat.set(3, 3); return FAB; }

export function makeAstronaut(o = {}) {
  const suit = new THREE.MeshStandardMaterial({ color: o.suit || 0xeeeeea, roughness: .82, normalMap: fabricNormal(), normalScale: new THREE.Vector2(.35, .35) });
  const soft = new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: .9 }), metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: .35, metalness: .85, envMap: visorEnv(), envMapIntensity: .8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: .6, metalness: .3 }), red = new THREE.MeshStandardMaterial({ color: 0xc8322c, roughness: .7 });
  const visor = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: .06, metalness: 1, envMap: visorEnv(), envMapIntensity: 1.6 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: .25, metalness: .05, envMap: visorEnv(), envMapIntensity: .5 });
  const M = (geo, mat, x = 0, y = 0, z = 0, p) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (p || null) && p.add(m); return m; };
  const J = (p, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); p.add(j); return j; };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14), ring = (r, t) => new THREE.TorusGeometry(r, t, 8, 22);

  const root = new THREE.Group(), body = J(root, 0, 0, 0), hips = J(body, 0, .98, 0);
  // pelvis and the soft lower torso
  { const p = M(cap(.16, .12), suit, 0, .02, 0, hips); p.rotation.z = Math.PI / 2; p.scale.set(1, 1.25, .95); M(ring(.19, .025), metal, 0, .12, 0, hips).rotation.x = Math.PI / 2; }
  const spine = J(hips, 0, .12, 0), chest = J(spine, 0, .14, 0);
  { const t = M(cap(.2, .22), suit, 0, .16, 0, chest); t.scale.set(1.18, 1, .82);
    M(new THREE.BoxGeometry(.24, .13, .09), soft, 0, .2, .17, chest); M(new THREE.BoxGeometry(.2, .03, .02), dark, 0, .24, .22, chest);           // display & control module on the chest
    for (let i = 0; i < 4; i++) M(new THREE.CylinderGeometry(.012, .012, .02, 8), [red, metal, dark, metal][i], -.07 + i * .045, .17, .22, chest).rotation.x = Math.PI / 2;
    const pack = M(new THREE.BoxGeometry(.44, .56, .22), shell, 0, .2, -.22, chest); pack.geometry.translate(0, 0, 0);                            // life-support backpack (PLSS)
    M(new THREE.BoxGeometry(.4, .1, .18), soft, 0, .52, -.22, chest); M(new THREE.CylinderGeometry(.025, .025, .5, 8), metal, .2, .2, -.12, chest); M(new THREE.CylinderGeometry(.025, .025, .5, 8), metal, -.2, .2, -.12, chest);
    M(new THREE.BoxGeometry(.06, .035, .002), red, -.13, .33, .17, chest); }                                                                          // mission patch
  const neck = J(chest, 0, .44, 0); M(ring(.13, .03), metal, 0, 0, 0, neck).rotation.x = Math.PI / 2;
  const head = J(neck, 0, .02, 0);
  { M(new THREE.SphereGeometry(.2, 28, 20), shell, 0, .19, -.015, head);
    const v = M(new THREE.SphereGeometry(.203, 28, 20, -Math.PI * .42, Math.PI * .84, Math.PI * .2, Math.PI * .46), visor, 0, .19, .0, head);      // gold sun visor, front
    v.rotation.y = 0; M(new THREE.BoxGeometry(.06, .025, .03), dark, .14, .32, .05, head); M(new THREE.BoxGeometry(.06, .025, .03), dark, -.14, .32, .05, head); }  // helmet lights
  const arm = s => { const sh = J(chest, s * .27, .35, 0); M(ring(.075, .022), metal, 0, 0, 0, sh).rotation.z = Math.PI / 2; M(new THREE.SphereGeometry(.085, 14, 10), suit, 0, -.02, 0, sh);
    M(cap(.07, .18), suit, 0, -.15, 0, sh); const el = J(sh, 0, -.3, 0); M(new THREE.SphereGeometry(.068, 12, 8), suit, 0, 0, 0, el); M(cap(.062, .17), suit, 0, -.13, 0, el);
    const wr = J(el, 0, -.27, 0); M(ring(.055, .016), metal, 0, 0, 0, wr).rotation.x = Math.PI / 2; const gl = M(new THREE.BoxGeometry(.075, .11, .05), soft, 0, -.07, .005, wr); gl.geometry.translate(0, 0, 0);
    M(new THREE.BoxGeometry(.03, .05, .04), soft, s * .045, -.05, .02, wr); return { sh, el, wr }; };
  const leg = s => { const hp = J(hips, s * .1, -.02, 0); M(cap(.09, .26), suit, 0, -.2, 0, hp); const kn = J(hp, 0, -.44, 0); M(new THREE.SphereGeometry(.085, 12, 8), suit, 0, 0, .01, kn);
    M(cap(.078, .26), suit, 0, -.2, 0, kn); const an = J(kn, 0, -.43, 0); M(ring(.07, .018), metal, 0, -.02, 0, an).rotation.x = Math.PI / 2;
    const bt = M(new THREE.BoxGeometry(.13, .1, .28), soft, 0, -.06, .045, an); M(new THREE.BoxGeometry(.135, .025, .29), dark, 0, -.105, .045, an); return { hp, kn, an }; };
  const L = { aL: arm(1), aR: arm(-1), lL: leg(1), lR: leg(-1) };

  // ---- gait engine ----
  const st = { ph: 0, air: 0, idle: 1, land: 0, lean: 0, yawPrev: null, bank: 0, t: 0 }, cur = new Map();
  const set = (obj, ax, v, k) => { const key = obj.uuid + ax, c = cur.has(key) ? cur.get(key) : 0, n = c + (v - c) * k; cur.set(key, n); obj.rotation[ax] = n; };
  return { root, update(dt, s) {
    // s: { spd (m/s, horizontal), ground, vy, g, run (bool), hold (jetpack), yaw }
    if (s.seat) { const k = Math.min(1, dt * 6); body.position.y += (-.62 - body.position.y) * k; body.rotation.z = 0; set(hips, 'x', -.12, k); set(hips, 'y', 0, k); set(hips, 'z', 0, k); set(spine, 'x', .08, k); set(spine, 'y', 0, k); set(neck, 'x', .02, k);
      for (const lg of [L.lL, L.lR]) { set(lg.hp, 'x', -1.45, k); set(lg.hp, 'z', lg === L.lL ? .08 : -.08, k); set(lg.kn, 'x', 1.5, k); set(lg.an, 'x', -.05, k); }
      set(L.aL.sh, 'x', -.75, k); set(L.aL.sh, 'z', .12, k); set(L.aL.el, 'x', -.7, k); set(L.aR.sh, 'x', -.35, k); set(L.aR.sh, 'z', -.25, k); set(L.aR.el, 'x', -.5, k); set(L.aL.wr, 'x', 0, k); set(L.aR.wr, 'x', 0, k); return; }
    st.t += dt; const g = s.g ?? 9.81, low = THREE.MathUtils.clamp((9.81 - g) / 8.2, 0, 1), run = s.run ? 1 : 0, spd = s.spd || 0;
    const mv = THREE.MathUtils.smoothstep(spd, .25, 1.4), k = Math.min(1, dt * 14);
    st.air += ((s.ground ? 0 : 1) - st.air) * Math.min(1, dt * (s.ground ? 12 : 6)); st.land = Math.max(0, st.land - dt * 3.2);
    if (s.landed) st.land = Math.min(1, Math.abs(s.landed) / 9);
    // stride: longer when running and much longer, slower and bouncier in low gravity (Apollo crews loped and hopped)
    const stride = (2.3 + run * 1.6) * (1 + low * 1.1); if (s.ground) st.ph = (st.ph + dt * spd / stride * Math.PI * 2) % (Math.PI * 200);
    const off = Math.PI * (1 - low * .82);               // left/right phase offset: 180° walking, near-together hops on the Moon
    const pL = st.ph, pR = st.ph + off, A = (.42 + run * .28) * (1 - low * .25), K = 1.0 + run * .5;
    const hipA = p => -A * Math.sin(p), kneeA = p => .12 + K * Math.pow(Math.max(0, Math.cos(p)), 1.6) * (1 - low * .35) + low * .35 * Math.max(0, -Math.sin(p * 2 - .4));
    const w = mv * (1 - st.air), id = (1 - mv) * (1 - st.air), ai = st.air;
    // turning: bank into the turn like a person does
    if (s.yaw != null) { if (st.yawPrev != null) { let dy = s.yaw - st.yawPrev; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; st.bank += (THREE.MathUtils.clamp(-dy / Math.max(dt, 1e-3) * .06 * mv, -.22, .22) - st.bank) * Math.min(1, dt * 6); } st.yawPrev = s.yaw; }
    const breathe = Math.sin(st.t * 1.7), bob = w * ((.03 + run * .02) * Math.cos(st.ph * 2) * (1 - low) + low * (.12 + run * .1) * Math.abs(Math.sin(st.ph))) - st.land * .16 - id * .005 * (1 - breathe);
    body.position.y += (bob - body.position.y) * k; body.rotation.z += (st.bank - body.rotation.z) * k;
    const lean = w * (.06 + run * .12 + low * .14) + ai * .05 + st.land * .25;
    set(hips, 'x', lean * .4, k); set(hips, 'y', w * .09 * Math.sin(pL) * (1 - low), k); set(hips, 'z', w * .035 * Math.cos(pL) * (1 - low), k);
    set(spine, 'x', lean * .6 + id * .015 * breathe, k); set(spine, 'y', -w * .12 * Math.sin(pL) * (1 - low), k);
    set(neck, 'x', -lean * .7, k); set(head, 'y', id * .35 * Math.sin(st.t * .23) * Math.sin(st.t * .11), Math.min(1, dt * 2)); set(head, 'x', id * .06 * Math.sin(st.t * .17), Math.min(1, dt * 2));
    for (const [lg, p] of [[L.lL, pL], [L.lR, pR]]) {
      const hw = hipA(p) * w, kw = kneeA(p) * w;
      const hipT = hw + ai * (lg === L.lL ? -.45 : -.15) + id * 0 - st.land * .55, kneeT = kw + ai * (lg === L.lL ? .75 : .4) + id * .05 + st.land * 1.05;
      set(lg.hp, 'x', hipT, k); set(lg.hp, 'z', (lg === L.lL ? 1 : -1) * (.04 + ai * .08 + low * .05 * w), k); set(lg.kn, 'x', kneeT, k);
      set(lg.an, 'x', -(hipT + kneeT) * .75 + w * .25 * Math.max(0, Math.sin(p + .9)) - ai * .15, k); }
    for (const [am, p, sgn] of [[L.aL, pR, 1], [L.aR, pL, -1]]) {
      const swing = -(.32 + run * .3) * Math.sin(p) * (1 - low * .5) * w;
      set(am.sh, 'x', swing + id * (.04 + .015 * breathe) + ai * .18 - low * .25 * w + st.land * -.3, k);
      set(am.sh, 'z', sgn * (.16 + low * .22 * w + ai * .55 + id * .02 * breathe), k);   // the bulky suit holds the arms a little away from the body
      set(am.el, 'x', -(.28 + run * .55 + low * .35 * w) * Math.max(w, id * .8) - ai * .35, k); set(am.wr, 'x', -.1 - run * .2 * w, k); }
  } };
}
