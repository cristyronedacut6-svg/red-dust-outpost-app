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

export function makeRover(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const W = []; let L;
  if (kind === 'lrv') {   // Apollo LRV: 3.1 m long, 2.3 m wheelbase, 1.8 m track, wire-mesh wheels 0.82 m across, top speed ~13 km/h
    L = { wb: 2.3, tr: 1.8, r: .41, clr: .35, vmax: 5, acc: 1.6, steer: .5, n: 'Lunar Roving Vehicle', seat: true };
    const al = mat(0xb8b8b2, .45, .7), gold = mat(0xc9a248, .35, .8), black = mat(0x25262a, .6), seat = mat(0x7a8a70, .9), tyre = new THREE.MeshStandardMaterial({ map: meshTex(), roughness: .8, metalness: .4 });
    box(2.6, .08, 1.15, al, 0, .55, 0, body); box(2.7, .05, .1, al, 0, .62, .58, body); box(2.7, .05, .1, al, 0, .62, -.58, body);            // chassis frame
    for (const z of [.33, -.33]) { box(.55, .06, .5, seat, -.05, .72, z, body); box(.06, .45, .5, seat, -.32, .95, z, body); }               // two folding seats
    box(.25, .32, .2, black, .45, .85, 0, body); cyl(.02, .02, .4, al, .45, 1.1, 0, body);                                                     // T-handle hand controller and console
    box(.5, .5, .04, black, .55, 1.2, 0, body).rotation.z = .3;
    const mast = cyl(.025, .025, 1.4, al, 1.15, 1.25, .35, body); const dish = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 8, 0, Math.PI * 2, 0, .55), mat(0xe8e8e0, .5, .2)); dish.position.set(1.15, 2.0, .35); dish.rotation.z = -1.1; body.add(dish);   // high-gain umbrella antenna
    box(.5, .35, .4, gold, -1.05, .82, 0, body); box(.6, .04, .45, al, -1.05, 1.0, 0, body);                                                  // gold-foil wrapped battery / tool pallet
    for (const [x, z] of [[1.15, .9], [1.15, -.9], [-1.15, .9], [-1.15, -.9]]) { const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p); const s = new THREE.Group(); p.add(s);
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(L.r, L.r, .23, 24, 1, true), tyre); wh.rotation.x = Math.PI / 2; wh.castShadow = true; s.add(wh); const hub = cyl(.12, .12, .25, al, 0, 0, 0, s, 12); hub.rotation.x = Math.PI / 2;
      const fen = new THREE.Mesh(new THREE.CylinderGeometry(L.r + .06, L.r + .06, .3, 20, 1, true, Math.PI * .1, Math.PI * .8), al); fen.rotation.set(Math.PI / 2, 0, Math.PI / 2); fen.position.set(0, 0, 0); p.add(fen);
      W.push({ p, s, x, z, steer: x > 0, y: 0, ang: 0 }); }
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
      W.push({ p, s, x, z, steer: x !== 0, y: 0, ang: 0 }); }
    for (const z of [1.1, -1.1]) { const rk = box(2.1, .07, .07, al, 0, .7, z * .92, body); rk.userData.rocker = z; }   // rocker arms
  }
  let rider = null; if (L.seat) { rider = makeAstronaut(); rider.root.position.set(-.1, .48, .33); rider.root.rotation.y = Math.PI / 2; body.add(rider.root); }
  const st = { x: 0, z: 0, yaw: 0, v: 0, steer: 0, y: 0, vy: 0, pitch: 0, roll: 0, air: false, dist: 0 };
  return { g, L, st, rider, wheels: W,
    place(x, z, yaw, H) { st.x = x; st.z = z; st.yaw = yaw; st.y = H(x, z) + L.r + L.clr; st.vy = 0; st.v = 0; },
    update(dt, inp, H, grav) {
      const thr = -(inp.y || 0), str = -(inp.x || 0), brake = inp.jump;
      // drive: accelerate toward the commanded speed, coast down on loose regolith, steer the front wheels (Ackermann-like turning circle)
      const tv = thr * L.vmax * (inp.run ? 1.35 : 1); st.v += THREE.MathUtils.clamp(tv - st.v, -L.acc * dt * (brake ? 3 : 1.4), L.acc * dt); if (brake) st.v *= Math.max(0, 1 - dt * 2.5);
      st.steer += (str * L.steer - st.steer) * Math.min(1, dt * 4); if (!st.air) st.yaw += st.v * Math.tan(st.steer) / L.wb * dt;
      const fx = Math.cos(st.yaw), fz = -Math.sin(st.yaw); st.x += fx * st.v * dt; st.z += fz * st.v * dt; st.dist += Math.abs(st.v) * dt;
      // suspension: sample the ground under every wheel
      let sum = 0, fr = 0, bk = 0, lf = 0, rt = 0, nf = 0, nb = 0, nl = 0, nr = 0; const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
      for (const w of W) { const wx = st.x + w.x * cy + w.z * sy, wz = st.z - w.x * sy + w.z * cy, h = H(wx, wz); w.gh = h; sum += h; if (w.x > 0) { fr += h; nf++; } else if (w.x < 0) { bk += h; nb++; } if (w.z > 0) { lf += h; nl++; } else { rt += h; nr++; } }
      const avg = sum / W.length, groundY = avg + L.r + L.clr, pitchT = Math.atan2(fr / nf - bk / nb, L.wb), rollT = Math.atan2(lf / nl - rt / nr, L.tr);
      // the chassis is a mass on springs: it can be thrown into the air over bumps, and comes down slowly in low gravity
      if (st.y > groundY + .02) { st.air = true; st.vy -= grav * dt; } else { const climb = (groundY - st.y) / Math.max(dt, 1e-3); st.vy = Math.max(st.vy, Math.min(climb, 6)); st.air = false; }
      st.y += st.vy * dt; if (st.y < groundY) { if (st.vy < -1.5 && this.onLand) this.onLand(-st.vy); st.y = groundY; st.vy = Math.max(0, st.vy * -.18); }
      const kk = Math.min(1, dt * (st.air ? 1.5 : 8)); st.pitch += (pitchT - st.pitch) * kk; st.roll += (rollT - st.roll) * kk;
      g.position.set(st.x, st.y - L.r - L.clr, st.z); g.rotation.set(0, 0, 0); g.rotateY(st.yaw); g.rotateZ(st.pitch); g.rotateX(-st.roll);
      body.position.y = Math.sin(st.dist * 7) * .012 * Math.min(1, Math.abs(st.v));
      for (const w of W) { w.ang -= st.v * dt / L.r; w.s.rotation.z = w.ang; if (w.steer) w.p.rotation.y = w.x > 0 ? st.steer : (L.seat ? -st.steer * .6 : -st.steer);   // LRV had 4-wheel steering
        const local = w.gh + L.r - (st.y - L.r - L.clr); w.p.position.y = THREE.MathUtils.clamp(local, L.r - .22, L.r + .3); }
      if (rider) rider.update(dt, { spd: 0, ground: true, g: grav, seat: true });
      return st; } };
}
