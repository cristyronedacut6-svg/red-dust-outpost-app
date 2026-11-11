// Red Dust Outpost · Moon Survival · the habitat interior
// Modelled on NASA's Habitat Demonstration Unit (HDU / Deep Space Habitat): a vertical cylinder 5 m across with a 2 m barrel
// and domed ends, eight wall sections and two levels (the upper "inflatable loft" is shown through the ceiling hatch).
// Stations follow the HDU's real workstations: dust-mitigation airlock, General Maintenance/EVA workstation with a vent hood,
// Geology lab glovebox, Tele-robotics workstation, Medical Ops, Hygiene module, food-production "atrium" and stowage.
// Sources: NASA HDU fact sheet (2010); Kennedy et al., AIAA 2011-5020 (Deep Space Habitat configuration).
import * as THREE from 'three';
import { mergeGeometries } from './vendor/three/utils/BufferGeometryUtils.js';

export const HAB_R = 2.5, HAB_H = 2.6;   // inner radius and wall height (m)

export function buildHab(api) {
  const g = new THREE.Group(), stations = [], screens = {}, anim = [];
  // one merged mesh per material keeps this to a few dozen draw calls on phones
  const parts = {}; const mat = {
    wall: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: .8, metalness: .05, side: THREE.DoubleSide }),
    pad: new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: .95 }),                // soft acoustic wall padding
    floor: new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: .55, metalness: .6 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: .35, metalness: .8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: .5, metalness: .4 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2d4f78, roughness: .7 }),
    bag: new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 1 }),                   // cargo transfer bags (Nomex)
    yellow: new THREE.MeshStandardMaterial({ color: 0xd8b02a, roughness: .6 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb33a2e, roughness: .6 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2e7a33, roughness: .85, emissive: 0x08260c }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: .05, metalness: 0, transparent: true, opacity: .22, depthWrite: false }),
    led: new THREE.MeshBasicMaterial({ color: 0xfff3dd }), grow: new THREE.MeshBasicMaterial({ color: 0xd46cff }), cyan: new THREE.MeshBasicMaterial({ color: 0x55d6e8 }),
    ok: new THREE.MeshBasicMaterial({ color: 0x33ff77 }), warn: new THREE.MeshBasicMaterial({ color: 0xff5a3a }),
  };
  const add = (name, geo, x, y, z, ry = 0, rx = 0, rz = 0) => { geo = geo.index ? geo.toNonIndexed() : geo; const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); geo.applyMatrix4(m); (parts[name] = parts[name] || []).push(geo); };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), C = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s);
  // place something in a wall section: a = angle of the section centre, d = distance in from the wall, x = sideways, y = height
  const at = (a, d, x, y) => { const r = HAB_R - d, ca = Math.cos(a), sa = Math.sin(a); return [ca * r - sa * x, y, sa * r + ca * x]; };
  const put = (name, geo, a, d, x, y, extraRy = 0, rx = 0) => { const [px, py, pz] = at(a, d, x, y); add(name, geo, px, py, pz, -a - Math.PI / 2 + extraRy, rx); };

  /* ---- shell: barrel, padded panels, C-ribs (the HDU's steel ribs), floor grating, domed ceiling ---- */
  add('wall', new THREE.CylinderGeometry(HAB_R, HAB_R, HAB_H, 48, 1, true), 0, HAB_H / 2, 0);
  add('wall', new THREE.SphereGeometry(HAB_R, 48, 12, 0, Math.PI * 2, 0, Math.PI * .32), 0, HAB_H - HAB_R * Math.cos(Math.PI * .32) + .02, 0);
  add('floor', new THREE.CircleGeometry(HAB_R, 48), 0, 0, 0, 0, -Math.PI / 2);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; add('dark', B(.03, .01, HAB_R * 1.9), Math.cos(a) * 0, .005, 0, a); }   // floor plate seams
  for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; put('metal', B(.1, HAB_H, .08), a, .02, 0, HAB_H / 2); put('metal', B(.1, .08, .5), a, .26, 0, HAB_H - .05); }   // 8 ribs between sections
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put('pad', B(1.6, .35, .06), a, .05, 0, HAB_H - .35); put('metal', B(1.7, .03, .05), a, .08, 0, 1.05); }   // upper padding, handrail
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add('led', B(.9, .02, .16), Math.cos(a) * 1.3, HAB_H + .12, Math.sin(a) * 1.3, -a); }   // LED light panels
  add('dark', C(.48, .05, 24), 0, HAB_H + .3, 0); add('metal', new THREE.TorusGeometry(.5, .04, 6, 24), 0, HAB_H + .3, 0, 0, Math.PI / 2);   // loft hatch
  for (let k = 0; k < 9; k++) add('metal', B(.42, .03, .04), 0, .25 + k * .3, -.1); add('metal', B(.04, 2.9, .04), -.2, 1.45, -.12); add('metal', B(.04, 2.9, .04), .2, 1.45, -.12);   // ladder to the loft
  for (let i = 0; i < 2; i++) add(i ? 'yellow' : 'red', B(.06, HAB_H * .9, .06), Math.cos(i * 2.6) * (HAB_R - .12), HAB_H * .45, Math.sin(i * 2.6) * (HAB_R - .12));   // utility pipes
  add('dark', new THREE.TorusGeometry(HAB_R - .15, .03, 6, 64), 0, HAB_H - .02, 0, 0, Math.PI / 2);   // cable tray

  const sign = (txt, a, col = '#55d6e8') => { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#0b141b'; x.fillRect(0, 0, 256, 48); x.fillStyle = col; x.font = 'bold 26px system-ui'; x.fillText(txt, 12, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.62, .12), new THREE.MeshBasicMaterial({ map: t })); const [px, py, pz] = at(a, .07, 0, 2.02); m.position.set(px, py, pz); m.lookAt(0, 2.02, 0); g.add(m); };
  const screen = (key, a, d, x, y, w = .7, h = .42) => { const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t })); const [px, py, pz] = at(a, d, x, y); m.position.set(px, py, pz); m.lookAt(0, py, 0); g.add(m); put('dark', B(w + .05, h + .05, .03), a, d - .02, x, y); screens[key] = { c, t }; };
  const station = (id, a, label) => { const [x, , z] = at(a, .85, 0, 0); stations.push({ id, x, z, label }); };
  const S8 = i => i / 8 * Math.PI * 2;

  /* 0 · Dust-mitigation airlock */
  { const a = S8(0); put('metal', B(1.1, 2.05, .12), a, .06, 0, 1.03); put('dark', B(.9, 1.85, .05), a, .12, 0, 1.0); put('glass', B(.32, .32, .02), a, .15, 0, 1.55); put('metal', new THREE.TorusGeometry(.2, .03, 6, 20), a, .15, 0, 1.55);
    put('ok', B(.1, .05, .02), a, .14, .48, 1.95); put('dark', B(.5, .32, .02), a, .07, -.68, 1.25); put('metal', B(.06, .5, .06), a, .25, .68, .9); put('blue', B(.8, .4, .4), a, .3, .9, .2); sign('AIRLOCK · DUST', a);
    station('airlock', a, 'Airlock: go outside (dust brushed off)'); }
  /* 1 · General Maintenance / EVA workstation, with vent hood and the Z2 suit */
  { const a = S8(1); put('metal', B(1.3, .06, .55), a, .32, 0, .9); put('dark', B(1.3, .85, .5), a, .32, 0, .45); put('metal', B(1.1, .45, .45), a, .3, 0, 1.75); put('dark', B(1.1, .04, .5), a, .3, 0, 1.52);
    for (let k = 0; k < 7; k++) put(k % 2 ? 'red' : 'yellow', B(.04, .18 + (k % 3) * .05, .02), a, .07, -.45 + k * .15, 1.25);   // tools on the pegboard
    put('dark', B(1.2, .5, .03), a, .05, 0, 1.25); const sp = new THREE.Group(); const [sx, , sz] = at(a + .42, .55, 0, 0); sp.position.set(sx, 0, sz); sp.rotation.y = -(a + .42) - Math.PI / 2; g.add(sp); api.nasa('z2-spacesuit', .72, sp);
    sign('EVA / MAINTENANCE', a); station('eva', a, 'EVA workstation: refill suit oxygen, power and jetpack · patch suit'); }
  /* 2 · Geology lab glovebox */
  { const a = S8(2); put('dark', B(1.3, .85, .55), a, .32, 0, .45); put('metal', B(1.3, .05, .6), a, .3, 0, .9); put('glass', B(1.0, .55, .45), a, .32, 0, 1.2); put('metal', B(1.04, .04, .49), a, .32, 0, 1.49);
    for (const s of [-.22, .22]) put('dark', new THREE.TorusGeometry(.08, .025, 6, 18), a, .55, s, 1.15, 0, 0); for (let k = 0; k < 5; k++) put(k % 2 ? 'metal' : 'blue', B(.12, .05, .12), a, .3, -.36 + k * .18, .97);
    put('metal', C(.05, .35, 10), a, .3, .38, 1.12); put('dark', C(.09, .05, 12), a, .3, .38, 1.28); sign('GEO LAB · GLOVEBOX', a, '#F4A259'); screen('geo', a, .06, -.55, 1.68, .45, .28);
    station('geo', a, 'Geology glovebox: analyse samples · research upgrades'); }
  /* 3 · Tele-robotics workstation (the base computer) */
  { const a = S8(3); put('dark', B(1.3, .06, .5), a, .32, 0, .78); put('metal', B(1.3, .7, .06), a, .1, 0, .4); put('dark', B(.5, .5, .5), a, .9, 0, .25); put('blue', B(.5, .08, .5), a, .9, 0, .52);
    put('dark', C(.03, .15, 8), a, .4, .35, .88); put('red', new THREE.SphereGeometry(.035, 8, 6), a, .4, .35, .97); screen('tele', a, .08, 0, 1.38, .95, .55); screen('tele2', a, .1, .62, 1.3, .34, .26);
    sign('TELE-ROBOTICS', a); station('tele', a, 'Base computer: base report · score · leaderboard'); }
  /* 4 · Medical Operations */
  { const a = S8(4); put('metal', B(1.7, .08, .62), a, .45, 0, .6); put('blue', B(1.6, .1, .55), a, .45, 0, .69); put('pad', B(.35, .08, .45), a, .45, -.6, .78); for (const s of [-.75, .75]) put('metal', B(.05, .55, .05), a, .2, s, .3);
    put('pad', B(.5, .7, .3), a, .17, .55, 1.4); put('red', B(.12, .12, .02), a, .02, .55, 1.6); screen('med', a, .07, -.45, 1.45, .4, .28); sign('MEDICAL OPS', a, '#ff8a7a');
    station('med', a, 'Medical Ops: rest and heal (time passes)'); }
  /* 5 · Hygiene module */
  { const a = S8(5); put('pad', B(.95, 2.05, .06), a, .82, 0, 1.03); put('pad', B(.06, 2.05, .8), a, .45, -.47, 1.03); put('pad', B(.06, 2.05, .8), a, .45, .47, 1.03); put('metal', B(.05, .3, .04), a, .86, .3, 1.0);
    sign('HYGIENE', a); station('hyg', a, 'Hygiene module: wash off the dust (small heal)'); }
  /* 6 · Food-production atrium and galley */
  { const a = S8(6); for (let k = 0; k < 3; k++) { put('metal', B(1.25, .04, .42), a, .27, 0, .55 + k * .5); put('grow', B(1.15, .02, .06), a, .27, 0, .55 + k * .5 + .38); for (let p = 0; p < 6; p++) { const h = .1 + ((p * 7 + k * 3) % 5) * .035; put('green', new THREE.ConeGeometry(.07, h, 6), a, .27, -.5 + p * .2, .57 + k * .5 + h / 2); } }
    put('metal', B(.05, 1.55, .05), a, .06, -.62, .78); put('metal', B(.05, 1.55, .05), a, .06, .62, .78); screen('farm', a, .08, 0, 1.92, .5, .2); sign('ATRIUM · GALLEY', a, '#9cff8a');
    station('galley', a, 'Atrium and galley: eat a meal · check the crops'); }
  /* 7 · Stowage and water */
  { const a = S8(7); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) put('bag', B(.42, .3, .38), a, .3, -.45 + c * .45, .17 + r * .32, (r + c) % 2 ? .05 : -.04);
    put('blue', C(.2, .9, 16), a, .3, .75, .45); put('metal', B(.08, .12, .08), a, .5, .75, .75); sign('STOWAGE · WATER', a); station('stow', a, 'Water dispenser: drink'); }

  for (const k in parts) { const m = new THREE.Mesh(mergeGeometries(parts[k], false), mat[k]); m.receiveShadow = false; g.add(m); }
  const L1 = new THREE.PointLight(0xfff1dc, 3, 7, 1.6); L1.position.set(0, HAB_H - .2, 0); g.add(L1);
  const L2 = new THREE.PointLight(0xd46cff, 1.1, 2.2, 2); { const [x, y, z] = at(S8(6), .35, 0, 1.2); L2.position.set(x, y, z); } g.add(L2);   // pink grow-light glow
  const L3 = new THREE.PointLight(0x9fdcff, .7, 3, 2); { const [x, y, z] = at(S8(3), .6, 0, 1.3); L3.position.set(x, y, z); } g.add(L3);
  return { g, stations, screens };
}
