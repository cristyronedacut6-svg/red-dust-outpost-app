// Red Dust Outpost · drivable rovers: the Apollo Lunar Roving Vehicle (Moon) and a Perseverance-style rover (Mars).
// Per-wheel suspension follows the real terrain height, the chassis pitches and rolls with it and can leave the ground in low gravity,
// wheels spin with distance, the front wheels steer, and the tyres leave tracks in the regolith.
import * as THREE from 'three';
import { makeAstronaut } from './adv_astro.js';

const mat = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function box(w, h, d, m, x, y, z, p) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; p.add(b); return b; }
function cyl(r1, r2, h, m, x, y, z, p, seg = 16) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); c.position.set(x, y, z); c.castShadow = true; p.add(c); return c; }
let MESHT = null;
function meshTex() { if (MESHT) return MESHT; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#8a8478'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#4a463e'; g.lineWidth = 2;
  for (let i = -64; i < 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }   // woven zinc-coated piano-wire tyre
  g.fillStyle = '#c8b070'; for (let i = 0; i < 64; i += 16) g.fillRect(i, 28, 9, 8);   // titanium chevron treads
  MESHT = new THREE.CanvasTexture(c); MESHT.wrapS = MESHT.wrapT = THREE.RepeatWrapping; MESHT.repeat.set(6, 1); return MESHT; }

// The NASA Perseverance model has its detailed wheels baked into its body mesh. Find each wheel (its tread touches the ground near the
// expected spot), cut its triangles out of the model and return them as separate meshes centred on the axle, so the real wheels can
// spin and steer instead of a second, low-poly stand-in wheel being drawn through them. m must already be in its final pose (rover space).
function cutWheels(m, spots, r0) {
  m.updateMatrixWorld(true); const v = new THREE.Vector3(), meshes = [];
  m.traverse(o => { const ge = o.geometry; if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.visible && ge && ge.attributes.position && !Array.isArray(o.material) && !ge.groups.length && !(ge.morphAttributes && ge.morphAttributes.position)) meshes.push(o); });
  const P = meshes.map(o => { const p = o.geometry.attributes.position, a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; } return a; });
  // 1) locate every wheel from the vertices of its tread near the ground: centre, width and radius (from the chord of the bottom arc)
  const wh = spots.map(([x0, z0]) => { let lo = Infinity; const inCol = (a, i) => Math.abs(a[i] - x0) < r0 * 1.3 && Math.abs(a[i + 2] - z0) < .4 && a[i + 1] < r0 * 2.2;
    for (const a of P) for (let i = 0; i < a.length; i += 3) if (inCol(a, i) && a[i + 1] < lo) lo = a[i + 1];
    if (!isFinite(lo)) return null; const h = r0 * .3; let n = 0, x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const a of P) for (let i = 0; i < a.length; i += 3) if (inCol(a, i) && a[i + 1] < lo + h) { n++; x1 = Math.min(x1, a[i]); x2 = Math.max(x2, a[i]); z1 = Math.min(z1, a[i + 2]); z2 = Math.max(z2, a[i + 2]); }
    if (n < 8) return null; const c = (x2 - x1) / 2, r = THREE.MathUtils.clamp((c * c + h * h) / (2 * h), r0 * .8, r0 * 1.25);
    return { x: (x1 + x2) / 2, z: (z1 + z2) / 2, hw: THREE.MathUtils.clamp((z2 - z1) / 2 + .02, .08, .3), r, y: lo + r, parts: [] }; });
  // 2) move every triangle that lies wholly inside a wheel's drum to that wheel
  meshes.forEach((o, mi) => { const ge = o.geometry, a = P[mi], idx = ge.index, nT = (idx ? idx.count : ge.attributes.position.count) / 3 | 0, keep = [], take = wh.map(() => []);
    const vi = k => idx ? idx.getX(k) : k; let moved = 0;
    const inW = (w, i) => { const dx = a[i * 3] - w.x, dy = a[i * 3 + 1] - w.y, R = w.r * 1.08; return Math.abs(a[i * 3 + 2] - w.z) <= w.hw && dx * dx + dy * dy <= R * R; };
    for (let t = 0; t < nT; t++) { const A = vi(t * 3), B = vi(t * 3 + 1), C = vi(t * 3 + 2); let j = -1;
      for (let q = 0; q < wh.length; q++) { const w = wh[q]; if (w && inW(w, A) && inW(w, B) && inW(w, C)) { j = q; break; } }
      if (j < 0) keep.push(A, B, C); else { take[j].push(A, B, C); moved++; } }
    if (!moved) return;
    const rest = new THREE.BufferGeometry(); for (const k in ge.attributes) rest.setAttribute(k, ge.attributes[k]); rest.setIndex(keep); o.geometry = rest;
    const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), flip = o.matrixWorld.determinant() < 0;
    take.forEach((list, j) => { if (!list.length) return; const w = wh[j], g = new THREE.BufferGeometry(), N = list.length;
      if (flip) for (let i = 0; i < N; i += 3) { const s = list[i + 1]; list[i + 1] = list[i + 2]; list[i + 2] = s; }
      for (const k in ge.attributes) { if (k === 'skinIndex' || k === 'skinWeight' || k === 'tangent') continue; const at = ge.attributes[k], s = at.itemSize, out = new Float32Array(N * s);
        for (let i = 0; i < N; i++) { const q = list[i];
          if (k === 'position') { out[i * 3] = a[q * 3] - w.x; out[i * 3 + 1] = a[q * 3 + 1] - w.y; out[i * 3 + 2] = a[q * 3 + 2] - w.z; }
          else if (k === 'normal') { v.fromBufferAttribute(at, q).applyMatrix3(nm).normalize(); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
          else { out[i * s] = at.getX(q); if (s > 1) out[i * s + 1] = at.getY(q); if (s > 2) out[i * s + 2] = at.getZ(q); if (s > 3) out[i * s + 3] = at.getW(q); } }
        g.setAttribute(k, new THREE.BufferAttribute(out, s)); }
      const pm = new THREE.Mesh(g, o.material); pm.castShadow = true; pm.receiveShadow = o.receiveShadow; w.parts.push(pm); }); });
  return wh;
}

export function makeRover(kind, loader, fixMat) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const W = []; let L;
  if (kind === 'lrv') {   // Apollo LRV: 3.1 m long, 2.3 m wheelbase, 1.8 m track, wire-mesh wheels 0.82 m across, top speed ~13 km/h
    L = { wb: 2.3, tr: 1.8, r: .41, clr: .35, vmax: 3.6, acc: 1.4, steer: .5, n: 'Lunar Roving Vehicle', seat: true };
    const al = mat(0xb8b8b2, .45, .7), gold = mat(0xc9a248, .35, .8), black = mat(0x25262a, .6), seat = mat(0x7a8a70, .9), tyre = new THREE.MeshStandardMaterial({ map: meshTex(), roughness: .8, metalness: .4, side: THREE.DoubleSide });   // open wire-mesh tyre: both faces, or its far side vanishes
    const fenM = new THREE.MeshStandardMaterial({ color: 0xb8b8b2, roughness: .45, metalness: .7, side: THREE.DoubleSide });
    box(2.6, .08, 1.15, al, 0, .55, 0, body); box(2.7, .05, .1, al, 0, .62, .58, body); box(2.7, .05, .1, al, 0, .62, -.58, body);            // chassis frame
    // two folding seats on tubular frames, high enough that a seated astronaut's boots rest on the floor pan instead of poking through it;
    // the seat backs stay low so the life-support backpack rides above them (as on the real LRV)
    for (const z of [.33, -.33]) { box(.55, .06, .5, seat, -.05, 1.02, z, body); box(.06, .22, .5, seat, -.32, 1.16, z, body); for (const x of [-.25, .15]) box(.05, .4, .45, al, x, .79, z, body); }
    box(.25, .32, .2, black, .45, .85, 0, body); cyl(.02, .02, .4, al, .45, 1.1, 0, body);                                                     // T-handle hand controller and console
    box(.5, .5, .04, black, .55, 1.2, 0, body).rotation.z = .3;
    const mast = cyl(.025, .025, 1.4, al, 1.15, 1.25, .35, body); const dish = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 8, 0, Math.PI * 2, 0, .55), mat(0xe8e8e0, .5, .2)); dish.position.set(1.15, 2.0, .35); dish.rotation.z = -1.1; body.add(dish);   // high-gain umbrella antenna
    box(.5, .35, .4, gold, -1.05, .82, 0, body); box(.6, .04, .45, al, -1.05, 1.0, 0, body);                                                  // gold-foil wrapped battery / tool pallet
    for (const z of [.55, -.55]) for (const x of [-1.25, 1.25]) cyl(.018, .018, 1.1, al, x * .5, .5, z, body).rotation.z = Math.PI / 2;            // tubular chassis rails
    box(.28, .2, .22, black, 1.3, .95, -.2, body); cyl(.06, .06, .06, black, 1.45, .95, -.2, body).rotation.z = Math.PI / 2;                      // GCTA colour TV camera
    const lga = cyl(.02, .02, .7, al, 1.25, 1.25, -.35, body); const helix = new THREE.Mesh(new THREE.TorusKnotGeometry(.035, .006, 40, 6, 6, 1), al); helix.position.set(1.25, 1.65, -.35); helix.rotation.x = Math.PI / 2; body.add(helix);   // low-gain helical antenna
    box(.5, .5, .06, mat(0x6a6a66, .8), -1.35, .9, 0, body); for (let i = 0; i < 3; i++) cyl(.015, .015, .55, mat(0x8a7a5a, .8), -1.45, .95 + i * .05, -.15 + i * .15, body);   // rear tool rack with geology tools
    for (const z of [.33, -.33]) { const belt = box(.04, .4, .01, mat(0x3a5a8a, .9), .12, 1.1, z + .2 * Math.sign(z), body); belt.rotation.z = -.5; }  // seat belts
    for (const [x, z] of [[1.15, .9], [1.15, -.9], [-1.15, .9], [-1.15, -.9]]) { const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p); const s = new THREE.Group(); p.add(s);
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(L.r, L.r, .23, 24, 1, true), tyre); wh.rotation.x = Math.PI / 2; wh.castShadow = true; s.add(wh); const hub = cyl(.12, .12, .25, al, 0, 0, 0, s, 12); hub.rotation.x = Math.PI / 2;
      // fender: a 144° arc over the top of the tyre, on the same axle as the wheel (it used to be turned across the wheel, a second curved cylinder through it)
      const fen = new THREE.Mesh(new THREE.CylinderGeometry(L.r + .06, L.r + .06, .3, 24, 1, true, -Math.PI * .4, Math.PI * .8), fenM); fen.rotation.x = -Math.PI / 2; fen.castShadow = true; p.add(fen);
      W.push({ p, s, x, z, steer: x > 0, y: 0, y0: L.r, ang: 0 }); }
  } else if (kind === 'pxr') {   // pressurized exploration rover: a crew cabin on six big balloon tyres, for long traverses away from the lander (original design, in the spirit of NASA's Artemis-era pressurized rover studies)
    L = { wb: 3.4, tr: 2.84, r: .58, clr: .62, vmax: 4.6, acc: 1.3, steer: .45, n: 'Pressurized exploration rover', seat: false };
    const white = mat(0xe9e7e2, .5, .05), panel = mat(0xd6d3cc, .62, .05), orange = mat(0xd8521e, .45, .1), dark = mat(0x22252a, .5, .35), al = mat(0xa9acb2, .38, .75), glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1218, roughness: .05, metalness: .2, clearcoat: 1, envMapIntensity: 1.6 });
    const tread = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const t = c.getContext('2d'); t.fillStyle = '#1d1e20'; t.fillRect(0, 0, 64, 128); t.fillStyle = '#3c3d40';
      for (let y = 0; y < 128; y += 16) { t.beginPath(); t.moveTo(0, y); t.lineTo(30, y + 7); t.lineTo(0, y + 12); t.fill(); t.beginPath(); t.moveTo(64, y + 8); t.lineTo(34, y + 15); t.lineTo(64, y + 20); t.fill(); }   // chevron lugs, offset left and right
      const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(1, 3); return tx; })();
    const tyre = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tread, bumpMap: tread, bumpScale: 6, roughness: .9 }), rim = mat(0xbfc2c6, .35, .7);
    // cabin: a long rounded box with a sloped, glazed nose; lower bodywork darker where the dust collects
    box(4.6, 1.5, 2.2, white, -.1, 1.75, 0, body); box(4.7, .35, 2.3, dark, -.1, .95, 0, body); box(4.4, .12, 2.24, orange, -.1, 1.15, 0, body);
    const nose = box(1.0, 1.1, 2.1, white, 2.35, 1.55, 0, body); nose.rotation.z = .5; const win = box(.06, .7, 1.7, glass, 2.55, 1.85, 0, body); win.rotation.z = .5;
    for (const z of [1.11, -1.11]) { box(.9, .5, .03, glass, 1.6, 2.0, z, body); box(1.1, 1.25, .05, panel, -.6, 1.7, z, body); box(1.12, .1, .06, orange, -.6, 2.38, z, body); }   // side windows and the hatch panels
    box(.08, 1.3, 1.3, dark, -2.42, 1.75, 0, body); cyl(.55, .55, .1, al, -2.5, 1.75, 0, body, 28).rotation.z = Math.PI / 2;                             // rear suitport docking ring
    box(3.2, .1, 1.9, al, -.4, 2.56, 0, body); for (let i = 0; i < 4; i++) box(.55, .32, .55, mat(0x8a7a62, .85), -1.5 + i * .75, 2.78, .5 * (i % 2 ? 1 : -1), body);   // roof rack with stowed cargo
    cyl(.03, .03, 1.1, al, -1.9, 3.1, .7, body); const dish = new THREE.Mesh(new THREE.SphereGeometry(.32, 18, 8, 0, Math.PI * 2, 0, .6), white); dish.position.set(-1.9, 3.6, .7); dish.rotation.z = -.6; body.add(dish);   // comms dish
    for (const z of [.85, -.85]) { box(.12, .2, .35, orange, 2.62, 1.05, z, body); const l = box(.05, .12, .28, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 2.2 }), 2.7, 1.32, z * .9, body); l.rotation.z = .5; }   // bumpers and headlights
    for (const [x, z] of [[1.7, 1.42], [1.7, -1.42], [0, 1.42], [0, -1.42], [-1.7, 1.42], [-1.7, -1.42]]) { const p = new THREE.Group();   /* tyres outboard of the 2.3 m cabin, not cutting into its sides */ p.position.set(x, 0, z); g.add(p); const s = new THREE.Group(); p.add(s);
      const wh = cyl(L.r, L.r, .5, tyre, 0, 0, 0, s, 32); wh.rotation.x = Math.PI / 2; const hb = cyl(.3, .3, .52, rim, 0, 0, 0, s, 32); hb.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) { const sp = box(.5, .06, .53, rim, 0, 0, 0, s); sp.rotation.z = i / 6 * Math.PI; sp.scale.set(.55, 1, 1); }             // hub spokes
      const arm = box(.7, .12, .12, dark, -Math.sign(x || 1) * .2, .35, -z * .2, p); arm.rotation.z = .4 * Math.sign(x || 1);                               // suspension arm up to the body
      W.push({ p, s, x, z, steer: x !== 0, y: 0, y0: L.r, ang: 0 }); }
  } else {   // Perseverance-style: 3 m long, six aluminium wheels on rocker-bogie suspension, mast camera, RTG power source at the back
    L = { wb: 2.0, tr: 2.2, r: .26, clr: .62, vmax: 3.2, acc: 1.0, steer: .42, n: 'Perseverance-style rover', seat: false };
    const white = mat(0xe8e6e0, .55, .1), al = mat(0xa8aab0, .4, .7), dark = mat(0x2c2e33, .55, .3), gold = mat(0xc9a248, .35, .8), wheel = mat(0x9a9ca2, .45, .7);
    box(2.2, .5, 1.5, white, 0, .95, 0, body); box(2.1, .06, 1.45, dark, 0, 1.22, 0, body); box(.5, .2, .5, gold, .3, 1.3, .3, body);
    const ms = cyl(.06, .06, 1.2, white, .85, 1.85, .5, body); const head = box(.35, .25, .25, white, .85, 2.5, .5, body); box(.08, .08, .02, dark, 1.0, 2.52, .38, body); box(.08, .08, .02, dark, 1.0, 2.52, .62, body);   // Mastcam-Z head
    const rtg = cyl(.22, .22, .7, dark, -1.25, 1.15, 0, body, 12); rtg.rotation.z = -.9; for (let i = 0; i < 8; i++) { const f = box(.02, .5, .34, dark, -1.25, 1.15, 0, body); f.rotation.set(i / 8 * Math.PI, 0, -.9); }   // finned RTG
    const arm = box(1.1, .08, .08, white, 1.6, 1.0, -.4, body); box(.25, .25, .25, al, 2.15, .85, -.4, body);   // robotic arm with turret
    const dish = cyl(.25, .25, .04, white, -.3, 1.3, -.45, body, 18); dish.rotation.z = Math.PI / 2;            // high-gain antenna
    for (const [x, z] of [[1.0, 1.1], [1.0, -1.1], [0, 1.1], [0, -1.1], [-1.0, 1.1], [-1.0, -1.1]]) { const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p); const s = new THREE.Group(); p.add(s);
      const wh = cyl(L.r, L.r, .4, wheel, 0, 0, 0, s, 20); wh.rotation.x = Math.PI / 2; for (let i = 0; i < 12; i++) { const c = box(.05, .03, .41, dark, Math.cos(i / 12 * 6.283) * L.r, Math.sin(i / 12 * 6.283) * L.r, 0, s); c.rotation.z = i / 12 * 6.283; }   // grousers
      W.push({ p, s, x, z, steer: x !== 0, y: 0, y0: L.r, ang: 0 }); }
    for (const z of [1.1, -1.1]) { const rk = box(2.1, .07, .07, al, 0, .7, z * .92, body); rk.userData.rocker = z; }   // rocker arms
  }
  let rider = null; if (L.seat) { rider = makeAstronaut({ loader }); rider.root.position.set(-.1, .78, .33); rider.root.rotation.y = Math.PI / 2; body.add(rider.root); }
  const st = { x: 0, z: 0, yaw: 0, v: 0, steer: 0, y: 0, vy: 0, pitch: 0, roll: 0, air: false, dist: 0 };
  // only the Perseverance-style rover swaps in the NASA model ('pxr' used to load it too, which replaced the pressurized cabin with a Mars rover)
  if (kind !== 'lrv' && kind !== 'pxr' && loader) loader.load('models/nasa/perseverance.glb', gl => { try { nasaPerse(gl.scene); } catch (e) { console.warn('rover model', e); } }, undefined, () => {});
  function nasaPerse(m) { if (fixMat) fixMat(m); const hold = new THREE.Group(); hold.add(m); m.updateMatrixWorld(true);
    // orient: longest horizontal axis = length; the mast head marks the front
    let bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()); if (sz.z > sz.x) { m.rotation.y = Math.PI / 2; m.updateMatrixWorld(true); }
    const head = m.getObjectByName('head'); bb.setFromObject(m); const cx = (bb.min.x + bb.max.x) / 2; if (head) { const hp = head.getWorldPosition(new THREE.Vector3()); if (hp.x < cx) { m.rotation.y += Math.PI; m.updateMatrixWorld(true); } }
    bb.setFromObject(m); sz = bb.getSize(new THREE.Vector3()); const k = 2.9 / sz.x; m.scale.multiplyScalar(k); m.updateMatrixWorld(true); bb.setFromObject(m); m.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); m.updateMatrixWorld(true);
    const wm0 = m.getObjectByName('Wheels_objs'), wm = wm0 && wm0.geometry ? wm0 : null;
    // 'Wheels_objs' is a flat part at axle height spanning all six wheel spots: use it to find the axles, then hide it (without it, look near the built-in wheel spots)
    const wb = wm ? new THREE.Box3().setFromObject(wm, true) : new THREE.Box3(new THREE.Vector3(-1 - L.r, 0, -1.1 - .2), new THREE.Vector3(1 + L.r, 2 * L.r, 1.1 + .2)); const cyW = (wb.min.y + wb.max.y) / 2, r = Math.max(.2, Math.min(.4, cyW)), wd = Math.min(.45, (wb.max.z - wb.min.z) * .16);   // the wheels touch the ground, so radius = axle height
    const xs = [wb.max.x - r, (wb.min.x + wb.max.x) / 2, wb.min.x + r], zs = [wb.max.z - wd / 2, wb.min.z + wd / 2]; let i = 0;
    if (!(isFinite(wb.min.x) && Math.abs(xs[0]) < 4 && Math.abs(zs[0]) < 3 && cyW > 0 && cyW < 1.2)) return;   // something odd about the model: keep the built-in rover
    const spots = []; for (const x of xs) for (const z of zs) spots.push([x, z]);
    // the model's own detailed wheels are part of its body mesh: cut them out and spin those; a stand-in wheel is only kept where none was found
    let cut = []; try { cut = cutWheels(m, spots, r); } catch (e) { console.warn('rover wheels', e); cut = []; }
    if (wm) wm.visible = false; let rs = 0, nr = 0;
    for (const [x, z] of spots) { const w = W[i], c = cut[i]; i++; if (!w) break;
      if (c && c.parts.length) { w.x = c.x; w.z = c.z; w.p.position.set(c.x, 0, c.z); w.y0 = c.y; w.s.scale.set(1, 1, 1); for (const o of w.s.children) o.visible = false; for (const o of c.parts) w.s.add(o); rs += c.r; nr++; }
      else { w.x = x; w.z = z; w.p.position.set(x, 0, z); w.y0 = cyW; w.s.scale.set(r / L.r, r / L.r, wd / .4); } }
    const rr = nr ? rs / nr : r, drop = L.r + L.clr - rr; st.y -= drop; st.vy = 0; L.r = rr; L.clr = 0; W.forEach(w => { w.y = null; });
    const fx = W.map(w => w.x), fz = W.map(w => w.z); L.wb = Math.max(...fx) - Math.min(...fx); L.tr = Math.max(...fz) - Math.min(...fz);
    body.clear(); body.add(hold); st.y = (st.y || 0); }
  return { g, L, st, rider, wheels: W,
    // also pose the model there, so a rover that is placed but never driven (the broken LRV in Story Mode) shows up where it is, not at the world origin
    place(x, z, yaw, H) { st.x = x; st.z = z; st.yaw = yaw; st.y = H(x, z) + L.r + L.clr; st.vy = 0; st.v = 0;
      g.position.set(x, st.y - L.r - L.clr, z); g.rotation.set(0, yaw, 0); for (const w of W) { w.y = L.r; w.p.position.y = w.y + (w.y0 || 0) - L.r; } },
    update(dt, inp, H, grav) {
      const thr = -(inp.y || 0), str = -(inp.x || 0), brake = inp.jump;
      // drive: accelerate toward the commanded speed, coast down on loose regolith, steer the front wheels (Ackermann-like turning circle)
      const tv = thr * L.vmax * (inp.run ? 1.35 : 1); st.v += THREE.MathUtils.clamp(tv - st.v, -L.acc * dt * (brake ? 3 : 1.4), L.acc * dt); if (brake) st.v *= Math.max(0, 1 - dt * 2.5);
      st.steer += (str * L.steer - st.steer) * Math.min(1, dt * 4); if (!st.air) st.yaw += st.v * Math.tan(st.steer) / L.wb * dt;
      const fx = Math.cos(st.yaw), fz = -Math.sin(st.yaw); st.x += fx * st.v * dt; st.z += fz * st.v * dt; st.dist += Math.abs(st.v) * dt;
      // suspension: sample the ground under every wheel and fit the chassis to it
      let sum = 0, fr = 0, bk = 0, lf = 0, rt = 0, nf = 0, nb = 0, nl = 0, nr = 0; const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
      for (const w of W) { const wx = st.x + w.x * cy + w.z * sy, wz = st.z - w.x * sy + w.z * cy, h = H(wx, wz); w.gh = h; sum += h; if (w.x > 0) { fr += h; nf++; } else if (w.x < 0) { bk += h; nb++; } if (w.z > 0) { lf += h; nl++; } else { rt += h; nr++; } }
      const groundY = sum / W.length + L.r + L.clr, pitchT = Math.atan2(fr / nf - bk / nb, L.wb), rollT = Math.atan2(lf / nl - rt / nr, L.tr);
      // spring-damper body: the springs push up hard, but only gravity pulls down, so over a crest in low gravity the rover floats free
      const sub = Math.max(1, Math.ceil(dt / .012)), h = dt / sub, K = 70, C = 15;
      for (let k = 0; k < sub; k++) { const err = groundY - st.y; let acc = K * err - C * st.vy; if (acc < -grav) acc = -grav; st.vy += acc * h; st.y += st.vy * h;
        if (st.y < groundY - .22) { st.y = groundY - .22; if (st.vy < 0) st.vy = 0; } }   // bump-stop at the end of the suspension travel
      const wasAir = st.air; st.air = st.y > groundY + .09; if (wasAir && !st.air && (st.lastVy || 0) < -1.4 && this.onLand) this.onLand(-st.lastVy); st.lastVy = st.vy;
      const kp = Math.min(1, dt * (st.air ? 1.2 : 6)); st.pitchV = (st.pitchV || 0) + ((pitchT - st.pitch) * 40 - (st.pitchV || 0) * 11) * dt; st.rollV = (st.rollV || 0) + ((rollT - st.roll) * 40 - (st.rollV || 0) * 11) * dt;
      if (st.air) { st.pitchV *= .98; st.rollV *= .98; } st.pitch += st.pitchV * dt; st.roll += st.rollV * dt; st.pitch += (pitchT - st.pitch) * kp * .15; st.roll += (rollT - st.roll) * kp * .15;
      g.position.set(st.x, st.y - L.r - L.clr, st.z); g.rotation.set(0, 0, 0); g.rotateY(st.yaw); g.rotateZ(st.pitch); g.rotateX(-st.roll);
      body.position.y = Math.sin(st.dist * 7) * .008 * Math.min(1, Math.abs(st.v));
      for (const w of W) { w.ang -= st.v * dt / L.r; w.s.rotation.z = w.ang; if (w.steer) w.p.rotation.y = w.x === 0 ? 0 : w.x > 0 ? st.steer : (L.seat ? -st.steer * .6 : -st.steer);   /* middle wheels of a six-wheeler stay straight */   // LRV had 4-wheel steering
        const local = THREE.MathUtils.clamp(w.gh + L.r - (st.y - L.r - L.clr), L.r - .2, L.r + .26); w.y = w.y == null ? local : w.y + (local - w.y) * Math.min(1, dt * 18); w.p.position.y = w.y + (w.y0 || 0) - L.r; }
      if (rider) rider.update(dt, { spd: 0, ground: true, g: grav, seat: true });
      return st; } };
}
