/* Adventure Mode — landing on worlds (walk around as an astronaut) and diving into gas giants. */
import * as THREE from 'three';
import { makeAstronaut } from './adv_astro.js';
import { makeRover } from './adv_rover.js';
import { makeFX, makeRings, scatterRocks, makeGrass, FOGSUN, FOGSUNC, fogHook } from './adv_fx.js';
import { SURF, featTex, GLSL_HEAD, GLSL_ALB, GLSL_BUMP, farRing, rockField, pebbleField } from './adv_terrain.js';

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); a *= .5; f *= 2; } return s; }
const col = h => new THREE.Color(h);
// no real atmosphere: dust flies in clean ballistic arcs and nothing drifts on a wind (Moon, Mercury, Europa, Ceres and the other airless bodies)
export const AIRLESS = W => !!W && /^(None|Almost none)/.test(W.air || 'None');

/* distance from the Sun in AU: the Sun's disc shrinks with distance (from Mars it is 2/3 the size; from Pluto a blinding star) */
const AU = { mercury: .39, venus: .72, earth: 1, moon: 1, mars: 1.52, phobos: 1.52, deimos: 1.52, vesta: 2.36, ceres: 2.77, io: 5.2, europa: 5.2, ganymede: 5.2, callisto: 5.2, titan: 9.5, enceladus: 9.5, mimas: 9.5, rhea: 9.5, iapetus: 9.5, dione: 9.5, tethys: 9.5, miranda: 19.2, titania: 19.2, ariel: 19.2, triton: 30, pluto: 39.5, charon: 39.5, arrokoth: 44.6 };
// real length of a solar day (hours). Game time runs 360× faster, so Earth's day takes 4 minutes, Mars 4.1, the Moon about 2 hours.
export const DAYH = { earth: 24, moon: 708.7, mars: 24.66, phobos: 7.65, deimos: 30.3, mercury: 4223, venus: 2802, io: 42.5, europa: 85.2, ganymede: 171.7, callisto: 400.5, titan: 382.7, enceladus: 32.9, mimas: 22.6, rhea: 108.4, iapetus: 1904, dione: 65.7, tethys: 45.3, miranda: 33.9, ariel: 60.5, titania: 208.9, oberon: 323, umbriel: 99.5, triton: 141, pluto: 153.3, charon: 153.3, ceres: 9.07, vesta: 5.34 };
const SHINE = { earth: [0x9cc4ff, .5], jupiter: [0xffe0b8, .6], saturn: [0xfff0c8, .35], mars: [0xffb080, .25], uranus: [0xb8f0ff, .2], neptune: [0x8aa8ff, .2], pluto: [0xe8d8c0, .12], charon: [0xc8c8cc, .1] };
const ICY = { europa: 1, enceladus: 1, mimas: .6, rhea: .7, tethys: .7, dione: .6, triton: .8, pluto: .7, ganymede: .4, titania: .5, miranda: .5, ariel: .5, iapetus: .4 };
const HDL = new THREE.TextureLoader(), hdTex = (n, f) => HDL.load('models/tex/hd/' + n, f, undefined, () => {});
// terrain extras shared by every world: cloud shadows, opposition surge and ice glints (one uniform set, swapped per landing)
const TU = { lavaMap: { value: null }, frost: { value: 0 }, lavaT: { value: 0 }, tsd: { value: new THREE.Vector3(-1500, 900, -1800).normalize() }, opp: { value: 0 }, cmap: { value: null }, cOn: { value: 0 }, cY: { value: 520 }, cOff: { value: new THREE.Vector2() }, cRep: { value: 5 }, ice: { value: 0 }, day: { value: 1 } };
/* world settings: gravity (m/s²), temperature, air, sky, fog, ground colours, terrain roughness, craters, extra features */
export const WORLD = {
  earth: { g: 9.81, t: 'about 15 °C', air: 'Nitrogen and oxygen (you could breathe it!)', sky: '#8ec3f0', fog: .0011, gr: ['#5d7a3a', '#8a9a5a', '#c9b98a'], amp: 3, cr: 0, sea: '#2a6aa8', site: 'Kennedy Space Center, Florida', sun: '#fff4e0' },
  moon: { g: 1.62, t: '−173 to 121 °C', air: 'None', sky: null, gr: ['#5c5a57', '#8e8b86', '#b9b6b0'], amp: 14, cr: 1, site: 'Sea of Tranquility (Apollo 11)', inSky: 'earth', sun: '#ffffff' },
  mars: { g: 3.71, t: 'about −63 °C', air: 'Very thin carbon dioxide', sky: '#c9a27a', fog: .0012, gr: ['#5e2e1c', '#a85a34', '#d08a58'], amp: 24, cr: .35, site: 'Jezero Crater', sun: '#ffe2bf' },
  mercury: { g: 3.7, t: '−180 to 430 °C', air: 'Almost none', sky: null, gr: ['#4e4a46', '#7d7670', '#a39b93'], amp: 16, cr: 1.2, site: 'Caloris Basin rim', sun: '#ffffff', bigSun: 2.6 },
  venus: { g: 8.87, t: 'about 465 °C (hot enough to melt lead)', air: 'Thick carbon dioxide with sulfuric-acid clouds', sky: '#d79a4a', fog: .016, gr: ['#5a3a1a', '#8a5a2a', '#b07a3a'], amp: 12, cr: .1, site: 'Maxwell Montes foothills', sun: '#ffd28a' },
  ceres: { g: .28, t: 'about −105 °C', air: 'None', sky: null, gr: ['#3e3e42', '#68686e', '#9a9aa0'], amp: 18, cr: 1, site: 'Occator Crater', sun: '#ffffff', salt: 1 },
  phobos: { g: .0057, gameG: .2, t: 'about −40 °C', air: 'None', sky: null, gr: ['#3a332e', '#5a4f46', '#7a6c60'], amp: 10, cr: 1.4, site: 'Stickney Crater', inSky: 'mars', sun: '#ffffff' },
  deimos: { g: .003, gameG: .15, t: 'about −40 °C', air: 'None', sky: null, gr: ['#5a4f46', '#7d6f62', '#9a8b7c'], amp: 6, cr: .8, site: 'Smooth dusty plain', inSky: 'mars', sun: '#ffffff' },
  io: { g: 1.8, t: 'about −130 °C (volcanoes up to 1,600 °C)', air: 'Thin sulfur dioxide', sky: null, gr: ['#8a6a1a', '#d8b84a', '#f2e28a'], amp: 16, cr: 0, site: 'Near the volcano Loki', inSky: 'jupiter', sun: '#fff0d0', lava: 1 },
  europa: { g: 1.31, t: 'about −160 °C', air: 'Almost none', sky: null, gr: ['#8a7a6a', '#c9c0b4', '#eef0f2'], amp: 6, cr: .1, site: 'Conamara Chaos', inSky: 'jupiter', sun: '#ffffff', cracks: 1 },
  ganymede: { g: 1.43, t: 'about −160 °C', air: 'Almost none', sky: null, gr: ['#4a4440', '#7e766e', '#b8b0a6'], amp: 12, cr: .8, site: 'Galileo Regio', inSky: 'jupiter', sun: '#ffffff' },
  callisto: { g: 1.24, t: 'about −140 °C', air: 'Almost none', sky: null, gr: ['#2e2a26', '#56504a', '#8a8278'], amp: 12, cr: 1.5, site: 'Valhalla basin', inSky: 'jupiter', sun: '#ffffff' },
  titan: { g: 1.35, t: 'about −179 °C', air: 'Thick nitrogen with methane haze', sky: '#c4863a', fog: .011, gr: ['#3a2a18', '#6a4a28', '#8a6a3a'], amp: 10, cr: 0, sea: '#1a1408', site: 'Shore of Kraken Mare (a methane sea)', sun: '#ffcc88' },
  enceladus: { g: .11, gameG: .3, t: 'about −198 °C', air: 'None (but water geysers!)', sky: null, gr: ['#9aa8b8', '#d8e2ec', '#ffffff'], amp: 8, cr: .3, site: 'Tiger stripes, south pole', inSky: 'saturn', sun: '#ffffff', geysers: 1 },
  mimas: { g: .064, gameG: .25, t: 'about −200 °C', air: 'None', sky: null, gr: ['#6a6a6e', '#a4a4a8', '#d8d8dc'], amp: 14, cr: 1.6, site: 'Inside Herschel Crater', inSky: 'saturn', sun: '#ffffff' },
  rhea: { g: .26, t: 'about −200 °C', air: 'Almost none', sky: null, gr: ['#6a6a6e', '#a8a8ac', '#dcdce0'], amp: 12, cr: 1.2, site: 'Inktomi crater', inSky: 'saturn', sun: '#ffffff' },
  dione: { g: .23, t: 'about −186 °C', air: 'Almost none', sky: null, gr: ['#6a6a6e', '#a0a0a6', '#d8d8de'], amp: 12, cr: 1, site: 'Wispy ice cliffs', inSky: 'saturn', sun: '#ffffff' },
  tethys: { g: .15, gameG: .25, t: 'about −187 °C', air: 'None', sky: null, gr: ['#7a7a7e', '#b8b8bc', '#e8e8ec'], amp: 12, cr: 1.1, site: 'Edge of Odysseus Crater', inSky: 'saturn', sun: '#ffffff' },
  iapetus: { g: .22, t: 'about −143 °C', air: 'None', sky: null, gr: ['#1e1a16', '#6a625a', '#e0dcd6'], amp: 16, cr: 1, site: 'The equatorial ridge', inSky: 'saturn', sun: '#ffffff' },
  miranda: { g: .079, gameG: .25, t: 'about −187 °C', air: 'None', sky: null, gr: ['#5a5a60', '#8e8e96', '#c0c0c8'], amp: 30, cr: .5, site: 'Top of Verona Rupes', inSky: 'uranus', sun: '#ffffff' },
  ariel: { g: .27, t: 'about −213 °C', air: 'None', sky: null, gr: ['#5a5a60', '#9a9aa2', '#d0d0d8'], amp: 12, cr: .8, site: 'Canyon floor', inSky: 'uranus', sun: '#ffffff' },
  umbriel: { g: .2, t: 'about −198 °C', air: 'None', sky: null, gr: ['#2a2a2e', '#4a4a50', '#6a6a72'], amp: 12, cr: 1.2, site: 'Dark cratered plain', inSky: 'uranus', sun: '#ffffff' },
  titania: { g: .38, t: 'about −203 °C', air: 'None', sky: null, gr: ['#5a5654', '#8e8a86', '#c0bcb8'], amp: 14, cr: 1, site: 'Messina Chasma', inSky: 'uranus', sun: '#ffffff' },
  oberon: { g: .35, t: 'about −198 °C', air: 'None', sky: null, gr: ['#4a4442', '#7a726e', '#a8a09a'], amp: 14, cr: 1.2, site: 'Hamlet crater', inSky: 'uranus', sun: '#ffffff' },
  triton: { g: .78, t: 'about −235 °C (one of the coldest places known)', air: 'Very thin nitrogen', sky: null, gr: ['#8a6a6a', '#c4a8a4', '#ecdcd8'], amp: 8, cr: .2, site: 'Cantaloupe terrain', inSky: 'neptune', sun: '#ffffff', geysers: 1 },
  pluto: { g: .62, t: 'about −230 °C', air: 'Very thin nitrogen haze', sky: '#1a2236', fog: .0008, gr: ['#7a5a3a', '#c8a882', '#f2e6d8'], amp: 10, cr: .2, site: 'Sputnik Planitia (the heart)', inSky: 'charon', sun: '#ffffff' },
  vesta: { g: .25, t: 'about −100 °C', air: 'None', sky: null, gr: ['#4a4642', '#7e7872', '#b8b0a8'], amp: 18, cr: 1.2, site: 'Rheasilvia basin', sun: '#ffffff' },
  charon: { g: .29, t: 'about −220 °C', air: 'None', sky: null, gr: ['#5a5a5e', '#8e8e92', '#c4c4c8'], amp: 14, cr: .7, site: 'Mordor Macula (red north pole)', inSky: 'pluto', sun: '#ffffff' },
};
const SKYP = { earth: ['#2a64c0', '#bcd8f2', '#ff8a3a', '#03060f'], mars: ['#6e4630', '#d6a77a', '#5f8fd8', '#050302'], venus: ['#6a3a14', '#e0a050', '#fff0b0', '#0a0603'], titan: ['#5a3a12', '#c88c40', '#ffd080', '#050301'], pluto: ['#050812', '#2a3a62', '#cfd8ff', '#010205'] };
const SKYG = { earth: ['#2f6fc0', '#c4def4', '#fff4dc'], mars: ['#7a4e34', '#d9ae84', '#9ec4e8'], venus: ['#7a4418', '#e2a456', '#fff0c0'], titan: ['#6a4416', '#d0984a', '#ffe0a0'], pluto: ['#050812', '#2a3a62', '#cfd8ff'] };
export const DIVE = {
  jupiter: { cols: ['#d9b48a', '#a8724a', '#f2e2c8', '#7a4a2a'], facts: ['Jupiter has no solid ground. The gas just gets thicker and hotter the deeper you go.', 'The Galileo probe parachuted into Jupiter on 7 December 1995 and sent data for about 58 minutes.', 'Deep inside, hydrogen is squeezed so hard it turns into a liquid metal.'], max: 1000 },
  saturn: { cols: ['#e8d3a2', '#c9ad75', '#f5e8c8', '#8a6a3a'], facts: ['Saturn’s winds can blow at about 1,800 km/h.', 'A giant six-sided jet stream, the hexagon, spins around Saturn’s north pole.', 'Cassini dived into Saturn on 15 September 2017 and sent data until the very end.'], max: 1000 },
  uranus: { cols: ['#a9e3ea', '#8fd0d9', '#5aa8b8', '#2a6a7a'], facts: ['Methane gas soaks up red light, which makes Uranus look blue-green.', 'Scientists think it may rain diamonds deep inside ice giants like Uranus.', 'Uranus is so tilted that each pole gets about 42 years of sunlight, then 42 years of darkness.'], max: 800 },
  neptune: { cols: ['#4f6fe0', '#3a52b8', '#7d97f0', '#1a2a6a'], facts: ['Neptune’s winds are the fastest in the solar system, about 2,000 km/h.', 'Voyager 2 saw a storm as big as Earth here in 1989: the Great Dark Spot.', 'Like Uranus, Neptune is an ice giant made mostly of water, methane and ammonia ices.'], max: 800 },
};

export function makeSurface(ctx) {
  // ctx: { ren, cam, loader, ui, card, toast, reward, scanned, objs(bodyId) -> [{o, at:[x,z], s, y, rot}], bodyFacts(id) }
  const S = { on: false, mode: null, body: null, scn: null, player: null, vel: new THREE.Vector3(), yaw: 0, camYaw: 0, camPitch: .35, items: [], cols: [], t: 0, onGround: true, depth: 0 };
  const glow = (c1, c2) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, c1); gr.addColorStop(.4, c2); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); };
  let H = () => 0;
  function terrain(id, W, site) {
    const size = id === 'earth' ? 1600 : 1400, seg = ctx.pre ? ctx.pre().seg : 300, geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const seed = id.length * 13.7 + id.charCodeAt(0), craters = [], R = SURF[id] || null, DEMS = !!(site && site.hm), RM = R ? R.make(seed, { dem: DEMS }) : null; S.RM = RM; S.R = R;
    const nc = Math.round(60 * (W.cr || 0)); for (let i = 0; i < nc; i++) { const a = hash(i, seed) * 6.283, d = 60 + hash(seed, i) * 620; craters.push([Math.cos(a) * d, Math.sin(a) * d, 8 + Math.pow(hash(i * 3, seed), 3) * 90, hash(i * 7, seed + 1) < .22]); }
    if (site && site.hm) { const N = site.N, hm = site.hm, sc = site.relief * size * 1.3, half = size / 2;
      H = (x, z) => { const u = THREE.MathUtils.clamp((x + half) / size * (N - 1), 0, N - 1.001), v = THREE.MathUtils.clamp((z + half) / size * (N - 1), 0, N - 1.001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
        const a = hm[j * N + i], b = hm[j * N + i + 1], c = hm[(j + 1) * N + i], d = hm[(j + 1) * N + i + 1]; return ((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv) * sc + (fbm(x * .05, z * .05 + seed, 3) - .5) * 1.4; }; }
    else H = (x, z) => { const fl = Math.min(1, Math.hypot(x, z) / 60) * (site && site.flat ? .15 : 1); let h = (fbm(x * .004 + seed, z * .004, 5) - .5) * W.amp * 2.2 * fl + (fbm(x * .03, z * .03 + seed, 3) - .5) * W.amp * .12;
      if (id === 'mars' && !RM) h += Math.hypot(x, z) > 520 ? (Math.hypot(x, z) - 520) * .35 : 0; // the crater rim around Jezero
      if (id === 'miranda') h += x > 250 ? 160 : 0;
      for (const [cx, cz, r] of craters) { const d = Math.hypot(x - cx, z - cz) / r; if (d < 1.4) h += d < 1 ? (d * d - 1) * r * .22 : (1.4 - d) * r * .28 * (d - 1) * 2.5; }
      if (RM && RM.shape) h = RM.shape(x, z, h);
      if (W.sea && x > 330) h = Math.min(h, -1.5 - (x - 330) * .05);
      return h * fl + h * (1 - fl) * .15; };
    const H0 = H(0, 0); if (site && site.hm) { const Hr = H; H = (x, z) => Hr(x, z) - H0; }
    const p = geo.attributes.position, KK = new Float32Array(p.count), lava = new Float32Array(p.count), cc = new Float32Array(p.count * 3), C0 = col(W.gr[0]), C1 = col(W.gr[1]), C2 = col(W.gr[2]), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = H(x, z); p.setY(i, h); const n = fbm(x * .02 + 9, z * .02, 4), k = THREE.MathUtils.clamp(.5 + h / ((site && site.hm ? site.relief * size * .5 : W.amp * 3) + 1) + (n - .5) * .7, 0, 1); KK[i] = k;
      if (k < .5) c.copy(C0).lerp(C1, k * 2); else c.copy(C1).lerp(C2, (k - .5) * 2);
      if (id === 'earth') { if (x > 300) c.lerp(col('#e8dcb0'), THREE.MathUtils.clamp((x - 300) / 30, 0, 1)); if (Math.abs(z) < 5 || Math.abs(x + 40) < 4) c.set('#6a6a68'); }
      if (W.salt && Math.hypot(x - 90, z + 70) < 30 + n * 14) c.set('#f4f6f8');
      if (W.lava) { const lv = fbm(x * .01, z * .01 + 3, 3); if (lv > .68) c.lerp(col('#2a1a10'), .7); lava[i] = THREE.MathUtils.smoothstep(lv, .7, .78) * (.6 + .4 * fbm(x * .08, z * .08, 2)); }
      if (W.cracks && Math.abs(Math.sin(x * .02 + fbm(x * .005, z * .005) * 8) + Math.sin(z * .017 + 2)) < .06) c.set('#9a5a3a');
      cc.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geo.setAttribute('lava', new THREE.BufferAttribute(lava, 1)); geo.computeVertexNormals();
    { const nn = geo.attributes.normal, rock = C0.clone().multiplyScalar(.8); for (let i = 0; i < p.count; i++) { const sl = 1 - nn.getY(i), k = THREE.MathUtils.smoothstep(sl, .12, .45); if (k > 0) { c.setRGB(cc[i * 3], cc[i * 3 + 1], cc[i * 3 + 2]).lerp(rock, k * (id === 'earth' ? .6 : .75)); cc.set([c.r, c.g, c.b], i * 3); } } geo.attributes.color.needsUpdate = true; }
    if (RM) { // the world's own ground recipe: colour zones (sand, dust, bedrock) and the zone each vertex belongs to
      const nn = geo.attributes.normal, zn = new Float32Array(p.count * 2), CC = {}; for (const k in R.C) if (typeof R.C[k] === 'string') CC[k] = col(R.C[k]);
      for (let i = 0; i < p.count; i++) { const z2 = RM.paint(p.getX(i), p.getZ(i), p.getY(i), KK[i], nn.getY(i), c, CC, DEMS ? null : craters); cc.set([c.r, c.g, c.b], i * 3); zn[i * 2] = z2[0]; zn[i * 2 + 1] = z2[1]; }
      geo.setAttribute('zn', new THREE.BufferAttribute(zn, 2)); geo.attributes.color.needsUpdate = true; }
    const dcv = document.createElement('canvas'); dcv.width = dcv.height = 256; const dg = dcv.getContext('2d'), im = dg.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const v = 200 + (fbm(x * .06, y * .06, 4) - .5) * 90 + (hash(x, y) - .5) * 40, o = (y * 256 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; }
    dg.putImageData(im, 0, 0); const dt = new THREE.CanvasTexture(dcv); dt.wrapS = dt.wrapT = THREE.RepeatWrapping; dt.repeat.set(size / 6, size / 6); dt.anisotropy = 8;
    // tileable normal map from a pebbly height field: gives the ground real bumps and grit under the sun
    const ncv = document.createElement('canvas'); ncv.width = ncv.height = 256; const ng = ncv.getContext('2d'), nim = ng.createImageData(256, 256), hgt = new Float32Array(256 * 256);
    { // tileable regolith: random periodic waves (integer frequencies wrap seamlessly) plus stamped pebbles and fine grit
      const W8 = []; for (let k = 0; k < 28; k++) { const f = 1 + Math.floor(hash(k, 7) * 22), th = hash(k, 13) * 6.283; W8.push([Math.round(Math.cos(th) * f), Math.round(Math.sin(th) * f), hash(k, 3) * 6.283, .5 / Math.sqrt(f)]); }
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { let h = 0; for (const [fx, fy, ph, am] of W8) h += Math.sin((fx * x + fy * y) / 256 * 6.283 + ph) * am; hgt[y * 256 + x] = h * .12 + (hash(x, y) - .5) * .06; }
      for (let k = 0; k < 420; k++) { const cx = hash(k, 91) * 256, cy = hash(k, 57) * 256, r = 1.5 + Math.pow(hash(k, 33), 3) * 9, hh = .15 + hash(k, 5) * .25;
        for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) { const d = Math.hypot(dx, dy) / r; if (d >= 1) continue; const X = (Math.floor(cx) + dx + 256) & 255, Y = (Math.floor(cy) + dy + 256) & 255; hgt[Y * 256 + X] += Math.sqrt(1 - d * d) * hh * (r / 6); } } }
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const hx = hgt[y * 256 + ((x + 1) & 255)] - hgt[y * 256 + ((x + 255) & 255)], hy = hgt[((y + 1) & 255) * 256 + x] - hgt[((y + 255) & 255) * 256 + x], nx = -hx * 6, ny = -hy * 6, l = Math.hypot(nx, ny, 1), o = (y * 256 + x) * 4; nim.data[o] = (nx / l * .5 + .5) * 255; nim.data[o + 1] = (ny / l * .5 + .5) * 255; nim.data[o + 2] = (1 / l * .5 + .5) * 255; nim.data[o + 3] = 255; }
    ng.putImageData(nim, 0, 0); const nt = new THREE.CanvasTexture(ncv); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(size / 9, size / 9); nt.anisotropy = 8;
    const mat = R ? new THREE.MeshStandardMaterial({ vertexColors: true, map: dt, roughness: R.rough, metalness: 0 }) : new THREE.MeshStandardMaterial({ vertexColors: true, map: dt, normalMap: nt, normalScale: new THREE.Vector2(1.1, 1.1), roughness: .95, metalness: 0 });
    const FU = R ? { ftex: { value: featTex(id) }, ftile: { value: R.tile }, fbump: { value: ctx.pre && ctx.pre().seg <= 200 ? 0 : .2 * R.bump } } : null;   // Low graphics: no surface relief (saves texture reads on weak phones) S.FU = FU;
    // break up texture tiling with a slow, large-scale brightness variation sampled from the same detail map at another scale
    mat.onBeforeCompile = sh => { fogHook(sh); Object.assign(sh.uniforms, TU);
      sh.vertexShader = 'attribute float lava; varying float vLava; varying vec3 vTWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vTWP = (modelMatrix * vec4(transformed, 1.)).xyz; vLava = lava;');
      sh.fragmentShader = 'varying float vLava; varying vec3 vTWP; uniform sampler2D lavaMap; uniform float frost, lavaT; uniform vec3 tsd; uniform float opp, cOn, cY, cRep, ice, day; uniform vec2 cOff; uniform sampler2D cmap;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float m1 = texture2D(map, vMapUv * .061 + .37).r, m2 = texture2D(map, vMapUv * .013 + .11).r; diffuseColor.rgb *= mix(.82, 1.12, m1) * mix(.88, 1.1, m2); }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // dawn frost on Mars: water-ice and CO2 frost on sun-facing ground that burns off as the Sun climbs (Viking 2 photographed it)
        if (frost > 0.) { float up = dot(normal, normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz)), fn = texture2D(map, vMapUv * .21 + .13).r, fn2 = texture2D(map, vMapUv * 1.7).r; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.8, .8, .84), frost * .32 * smoothstep(.78, .96, up) * smoothstep(.5, .66, fn) * (.6 + .4 * fn2)); }
        // Io: molten lava glowing through cracks in the crust, flickering
        if (vLava > .01) { vec3 lt = texture2D(lavaMap, vTWP.xz * .045 + vec2(lavaT * .004, 0.)).rgb; totalEmissiveRadiance += (vec3(1., .32, .05) * .6 + lt * lt * 2.2) * vLava * (1.2 + .5 * sin(lavaT * 2.3 + vTWP.x * .3) * sin(lavaT * 1.7 + vTWP.z * .25)); }`)
        .replace('#include <opaque_fragment>', `{ vec3 L = normalize(tsd), V = normalize(cameraPosition - vTWP); float sunUp = smoothstep(-.02, .15, L.y);
          // cloud shadows: follow the sunlight up to the cloud deck and read the same drifting cloud texture
          if (cOn > .5 && L.y > .05) { vec2 cp = vTWP.xz + L.xz / L.y * (cY - vTWP.y); vec2 cu = vec2((cp.x + 4500.) / 9000., (-cp.y + 4500.) / 9000.) * cRep + cOff; outgoingLight *= 1. - texture2D(cmap, cu).a * .5 * sunUp * day; }
          // opposition surge: airless regolith brightens sharply when the Sun is right behind you (the shadows hide behind the grains)
          outgoingLight *= 1. + opp * .55 * pow(max(dot(V, L), 0.), 14.) * sunUp;
          // ice glints: tiny crystal facets that catch the Sun
          if (ice > 0.) { vec3 cell = floor(vTWP * 7.); float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453); vec3 fn = normalize(vec3(fract(h * 13.1) - .5, 1.2, fract(h * 7.3) - .5));
            float gl = pow(max(dot(reflect(-L, fn), V), 0.), 90.) * step(.82, h) * ice * sunUp; outgoingLight += vec3(1., .98, .95) * gl * 3.; } }
        #include <opaque_fragment>`);
      if (FU) { Object.assign(sh.uniforms, FU);
        sh.vertexShader = 'attribute vec2 zn; varying vec2 vZn;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vZn = zn;');
        sh.fragmentShader = GLSL_HEAD + '\n' + sh.fragmentShader.replace('{ float m1 = texture2D(map', GLSL_ALB + '\n      { float m1 = texture2D(map').replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL_BUMP); } };
    mat.customProgramCacheKey = () => 'ter-' + (R ? id : 'std');
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.craters = DEMS ? [] : craters;
    // horizon skirt: an outer ring at the average height so the world never ends in an edge; the haze hides the seam
    if (R) m.add(farRing(id, H, size, W, R));
    else { const sk = new THREE.Mesh(new THREE.RingGeometry(size * .49, 3400, 64, 1), new THREE.MeshStandardMaterial({ color: C1.clone().lerp(C0, .3), roughness: 1 })); sk.rotation.x = -Math.PI / 2; sk.position.y = id === 'earth' ? -1.2 : H(size * .45, 0) - 2; m.add(sk); }
    return m;
  }
  function sky(id, W, scn) {
    if (W.sky) { const P = (SKYP[id] || [W.sky, W.sky, '#ffffff', '#020202']).map(c => col(c)); scn.background = P[1].clone(); scn.fog = new THREE.FogExp2(P[1].clone(), W.fog || .002);
      // physical-looking sky: blends day/night by sun elevation, sunset glow toward the Sun near the horizon, sharp sun disc and halo
      const U = { ss: { value: 1400 * Math.pow(AU[id] || 1, 2) }, zd: { value: P[0] }, hd: { value: P[1] }, sg: { value: P[2] }, ng: { value: P[3] }, sd: { value: new THREE.Vector3(-1500, 900, -1800).normalize() }, e: { value: .4 } }; S.skyU = U; S.skyP = P;
      const sd = new THREE.Mesh(new THREE.SphereGeometry(3500, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
        vertexShader: 'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform vec3 zd,hd,sg,ng,sd; uniform float e, ss; varying vec3 d;
        void main(){ float t = pow(max(d.y, 0.), .45), day = smoothstep(-.12, .2, e), k = max(dot(d, sd), 0.), low = 1. - smoothstep(.02, .38, e);
          vec3 zen = mix(ng, zd, day), hor = mix(ng * 1.6 + sg * .06 * smoothstep(-.25, 0., e), hd, day), c = mix(hor, zen, t);
          c = mix(c, sg, clamp(low * smoothstep(-.22, .02, e) * pow(k, 2.2) * (1. - t * .75) * 1.6, 0., 1.));
          c += sg * pow(k, 12.) * .35 * day + vec3(1., .96, .88) * (pow(k, ss) * 6. + pow(k, 120.) * .25) * smoothstep(-.04, .01, e);
          gl_FragColor = vec4(c, 1.); }` })); scn.add(sd);
      if (id === 'earth' || id === 'titan' || id === 'venus') { const ccv = document.createElement('canvas'); ccv.width = ccv.height = 256; const cg = ccv.getContext('2d'), cim = cg.createImageData(256, 256);
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const u = x / 256 * 6.283, v = y / 256 * 6.283, f = fbm(Math.cos(u) * 2 + 5, Math.sin(u) * 2 + Math.cos(v) * 2, 6) * .6 + fbm(Math.sin(v) * 4, Math.cos(u) * 4 + 3, 4) * .4, a = Math.max(0, (f - (id === 'earth' ? .5 : .35)) * 3.2), o = (y * 256 + x) * 4; cim.data[o] = cim.data[o + 1] = cim.data[o + 2] = 255; cim.data[o + 3] = Math.min(255, a * 255); }
        cg.putImageData(cim, 0, 0); const ct = new THREE.CanvasTexture(ccv); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(5, 5);
        const cl = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: .9, color: id === 'earth' ? 0xffffff : id === 'titan' ? 0xd8a060 : 0xf0d090 })); cl.rotation.x = -Math.PI / 2; cl.position.y = id === 'earth' ? 520 : 380; scn.add(cl); S.cloudL = cl; S.cloudBase = cl.material.color.clone(); }
      const st = ctx.stars(); if (st) { const sm = new THREE.Mesh(new THREE.SphereGeometry(3400, 32, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, color: 0xb0b0b0, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); scn.add(sm); S.starM = sm.material; } }
    else { scn.background = new THREE.Color('#000'); const st = ctx.stars(); if (st) { const s = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, color: 0x9a9a9a, fog: false })); scn.add(s); } }
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,240,1)', 'rgba(255,220,150,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sun.position.set(-1500, 900, -1800); sun.scale.setScalar(260 * (W.bigSun || 1) * Math.max(.22, Math.pow(1 / (AU[id] || 1), .75))); if (!W.sky) { scn.add(sun); S.sunSpr = sun; }
    if (!W.sky && (AU[id] || 1) > 4) { const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,255,1)', 'rgba(255,250,235,.9)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); core.position.copy(sun.position); core.scale.setScalar(26); scn.add(core); S.sunCore = core; }   // far out: a tiny, piercing point
    if (W.inSky) { const tex = ctx.texOf(W.inSky); const big = { earth: 120, mars: 260, jupiter: 900, saturn: 600, uranus: 420, neptune: 380, pluto: 300, charon: 260 }[W.inSky] || 200;
      const PU = { map: { value: tex }, night: { value: null }, hasN: { value: 0 }, sd: S.skyU ? S.skyU.sd : TU.tsd, rim: { value: new THREE.Color({ earth: 0x6aa8ff, saturn: 0xfff0c8, jupiter: 0xffe2b0, neptune: 0x7aa0ff, uranus: 0xa8f0ff, mars: 0xff9a6a, pluto: 0x9ab4ff }[W.inSky] || 0x000000) } };
      if (W.inSky === 'earth') new THREE.TextureLoader().load('models/tex/earth_night.webp', t => { t.colorSpace = THREE.SRGBColorSpace; PU.night.value = t; PU.hasN.value = 1; });
      const pl = new THREE.Mesh(new THREE.SphereGeometry(big, 64, 40), new THREE.ShaderMaterial({ uniforms: PU, fog: false,
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform sampler2D map, night; uniform float hasN; uniform vec3 sd, rim; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ vec3 N = normalize(vN); float ndl = dot(N, normalize(sd)), lit = clamp(ndl * .95 + .05 * smoothstep(-.15, .1, ndl), 0., 1.);
          vec3 c = texture2D(map, vUv).rgb * lit * 1.5; if (hasN > .5) { vec3 nl = texture2D(night, vUv).rgb; c += nl * nl * vec3(1., .8, .5) * 2. * (1. - smoothstep(-.1, .1, ndl)); }
          float fr = pow(1. - max(dot(N, vV), 0.), 3.); c += rim * fr * smoothstep(-.25, .4, ndl) * .9; gl_FragColor = vec4(c, 1.); }` })); pl.position.set(900, 1100, -2600); pl.rotation.y = 2.2; scn.add(pl);
      if (W.inSky === 'saturn') { const r = new THREE.Mesh(new THREE.RingGeometry(big * 1.25, big * 2.3, 96), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, transparent: true, opacity: .55, side: THREE.DoubleSide, fog: false })); r.rotation.x = -1.2; pl.add(r); } }
    if (W.sea) { // ocean: layered moving waves, sky reflection by Fresnel, sun glitter, fades into the haze at the horizon
      const OU = { nmap: { value: null }, hasN: { value: 0 }, time: { value: 0 }, deep: { value: col(W.sea).multiplyScalar(.45) }, sky: { value: S.skyP ? S.skyP[1].clone() : col('#bcd8f2') }, sd: S.skyU ? S.skyU.sd : { value: new THREE.Vector3(0, 1, 0) }, sunI: { value: 1 }, fogD: { value: W.fog || .0011 } }; S.seaU = OU;
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), new THREE.ShaderMaterial({ uniforms: OU, transparent: true, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position,1.); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform sampler2D nmap; uniform float hasN; uniform float time, sunI, fogD; uniform vec3 deep, sky, sd; varying vec3 wp;
        vec2 wv(vec2 p, vec2 dir, float f, float s){ float ph = dot(p, dir) * f + time * s; return dir * cos(ph) * f; }
        void main(){ vec2 p = wp.xz; vec2 g = wv(p, normalize(vec2(1., .3)), .05, 1.1) * .9 + wv(p, normalize(vec2(-.4, 1.)), .09, 1.6) * .5 + wv(p, normalize(vec2(.7, -.6)), .23, 2.4) * .22 + wv(p, normalize(vec2(-.9, -.2)), .51, 3.3) * .1;
          if (hasN > .5) { vec3 a = texture2D(nmap, p * .035 + vec2(time * .011, time * .007)).xzy * 2. - 1., b = texture2D(nmap, p * .061 - vec2(time * .006, -time * .009)).xzy * 2. - 1.; g += (a.xz + b.xz) * .22; }
          vec3 n = normalize(vec3(-g.x, 1., -g.y)), v = normalize(cameraPosition - wp); float fr = .02 + .98 * pow(1. - max(dot(n, v), 0.), 5.);
          vec3 c = mix(deep, sky, fr); vec3 h = normalize(sd + v); c += vec3(1., .95, .85) * pow(max(dot(n, h), 0.), 260.) * 3.5 * sunI;
          float dist = length(cameraPosition - wp); c = mix(c, sky, 1. - exp(-dist * fogD * .9)); gl_FragColor = vec4(c, .96); }` }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = -1; scn.add(sea); S.sea = sea; hdTex('waternormals.webp', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; OU.nmap.value = t; OU.hasN.value = 1; }); }
  }
  function playerModel() { const g = new THREE.Group();
    // a fully jointed astronaut with a real gait (the old NASA mesh was a single frozen T-pose)
    const rig = makeAstronaut(); g.add(rig.root); g.userData.rig = rig; rig.root.traverse(n => { if (n.isMesh) n.castShadow = true; });
    const jet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,255,1)', 'rgba(120,200,255,.6)'), blending: THREE.AdditiveBlending, depthWrite: false })); jet.position.set(0, 1.25, -.42); jet.scale.setScalar(.01); g.add(jet); g.userData.jet = jet;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(.6, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false })); sh.rotation.x = -Math.PI / 2; g.userData.sh = sh; return g; }
  let busy = 0;
  function placeModel(e, force) { if (e.loading || (!force && busy >= 3)) return; e.loading = 1; busy++; const done = () => { busy = Math.max(0, busy - 1); }; ctx.loader.load('models/nasa/' + (e.useLod ? 'lod/' : '') + (e.o.model || e.o.id) + '.glb', gl => { let m = gl.scene; if (ctx.fixMat) ctx.fixMat(m); if (e.r) { m.rotation.set(e.r[0], e.r[1], e.r[2], 'YXZ'); m.updateMatrixWorld(true); } if (e.stand) { const up = new THREE.Group(); up.add(m); up.rotation.x = Math.PI / 2; up.updateMatrixWorld(true); const m0 = m; m = up; m.userData.inner = m0; }   /* landed upright: engines / heat shield on the ground */ const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()), k = e.s / Math.max(s.x, s.y, s.z, .001); m.scale.setScalar(k); const b2 = new THREE.Box3().setFromObject(m); m.position.y -= b2.min.y; m.position.x -= (b2.min.x + b2.max.x) / 2; m.position.z -= (b2.min.z + b2.max.z) / 2; m.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); e.g.add(m); e.model = m; done(); }, undefined, () => { done(); e.loading = 0; e.fails = (e.fails || 0) + 1; if (e.fails >= 2 && !e.useLod) { e.useLod = 1; e.fails = 0; } else if (e.fails >= 3) e.model = new THREE.Group(); }); }
  function enter(body, kind, site) { FOGSUN.value.w = 0;
    const W = kind === 'dive' ? null : WORLD[body.id], scn = new THREE.Scene(); S.scn = scn; S.body = body; S.mode = kind; S.t = 0; S.items = []; S.cols = []; S.depth = 0; S.sea = null;
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x302820, .55); scn.add(hemi); S.hemi = hemi; S.sunSpr = S.sunCore = null; S.storm = null; S.rain = null; S.met = null; S.rover = null; S.drive = null; S.helmet = 0; S.o2 = 100; TU.frost.value = 0; S.cloudL = null; S.skyU = null; S.starM = null; S.seaU = null; S.devils = null; S.tod = .055; const dl = new THREE.DirectionalLight(W ? col(W.sun) : 0xffffff, 2.6); dl.position.set(-1500, 900, -1800); scn.add(dl); scn.add(dl.target); S.dl = dl;
    if (ctx.env) { scn.environment = ctx.env(); scn.environmentIntensity = .5; }
    if (body.id === 'earth') hdTex('sky_earth.webp', t => { if (S.scn !== scn) return; t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scn.environment = t; });   // a real sunrise sky (Poly Haven, CC0) reflected in suits, visors and craft
    if (body.id === 'io' && !TU.lavaMap.value) hdTex('lava.webp', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; TU.lavaMap.value = t; });
    const q = ctx.q ? ctx.q() : 'high'; if (kind !== 'dive') { dl.castShadow = true; const ms = ctx.pre ? ctx.pre().shadow : 2048; dl.shadow.mapSize.set(ms, ms); const c = dl.shadow.camera; c.left = c.bottom = -70; c.right = c.top = 70; c.near = 10; c.far = 600; dl.shadow.bias = -.0006; dl.shadow.normalBias = .4; }
    if (kind === 'dive') return enterDive(body, scn);
    sky(body.id, W, scn); const ter = terrain(body.id, W, site); scn.add(ter); S.site = site;
    TU.opp.value = AIRLESS(W) ? 1 : 0; TU.ice.value = ICY[body.id] || 0; TU.cOn.value = S.cloudL ? 1 : 0; TU.cmap.value = S.cloudL ? S.cloudL.material.map : null; TU.cY.value = S.cloudL ? S.cloudL.position.y : 520; TU.day.value = 1;
    TU.tsd.value.set(-1500, 900, -1800).normalize(); if (S.skyU) TU.tsd.value.copy(S.skyU.sd.value);
    // landing site: your capsule and a golden beacon (rest point)
    const pad = new THREE.Group(); scn.add(pad); pad.position.set(0, H(0, 0), 0);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.set(-16, 30, -12); pad.add(beam); S.beam = beam;
    const sh = ctx.ship ? ctx.ship() : { m: 'orion' }, cap = { o: { id: sh.m }, r: sh.r, g: new THREE.Group(), s: sh.id === 'sls' || sh.id === 'shuttle-stack' ? 9 : sh.id === 'shuttle-orbiter' ? 8 : 4 }; cap.g.position.set(-12, 0, -8); pad.add(cap.g); if (!['shuttle-orbiter', 'lm'].includes(sh.id)) cap.stand = 1; placeModel(cap, 1); S.capG = cap.g; S.capS = cap.s; S.launch = null;
    // NASA things that live on this world
    for (const it of ctx.objs(body.id, site)) { const g = new THREE.Group(), y = H(it.at[0], it.at[1]); g.position.set(it.at[0], y + (it.y || 0), it.at[1]); g.rotation.y = it.rot || 0; scn.add(g);
      const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,255,1)', ctx.scanned.has(it.o.id) ? 'rgba(125,249,255,.5)' : 'rgba(255,207,74,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false })); mk.scale.set(.03, .03, 1); mk.position.y = it.s * 1.1 + 2; g.add(mk);
      S.items.push({ o: it.o, g, s: it.s, mk, fly: it.fly, base: g.position.clone() }); }
    // collectibles: science samples (with facts) and star fragments
    const key = 'adv_col_' + body.id + (site ? '_' + site.id : ''), got = new Set(ctx.get(key, [])), facts = ctx.sampleFacts(body.id, site);
    const sm = new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x2a8aa8, emissiveIntensity: 1.2, roughness: .2, metalness: .3 }), fm = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa020, emissiveIntensity: 1.6, roughness: .3 });
    for (let i = 0; i < 18; i++) { const sample = i < 6, a = hash(i, body.id.length) * 6.283, d = 40 + hash(body.id.length, i * 7) * 520, x = Math.cos(a) * d, z = Math.sin(a) * d; if (W.sea && x > 320) continue;
      const m = new THREE.Mesh(sample ? new THREE.OctahedronGeometry(.7, 0) : new THREE.IcosahedronGeometry(.45, 0), sample ? sm : fm); m.position.set(x, H(x, z) + (sample ? 1 : 2.4), z); scn.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,255,.9)', sample ? 'rgba(125,249,255,.35)' : 'rgba(255,200,90,.4)'), blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(sample ? 4 : 3); m.add(halo);
      const c = { i, m, sample, fact: sample ? facts[i % facts.length] : null, got: got.has(i), key, gotSet: got }; m.visible = !c.got; S.cols.push(c); }
    if (W.geysers) for (let i = 0; i < 5; i++) { const x = 120 + i * 40, z = -150 + i * 25; S.items.push({ geyser: 1, g: geyser(scn, x, H(x, z), z) }); }
    if (body.id === 'titan') { const hs = []; for (let z = -600; z <= 600; z += 40) for (let x = -600; x <= 600; x += 40) hs.push(H(x, z)); hs.sort((a, b) => a - b); const lv = Math.min(hs[Math.floor(hs.length * .2)], H(4, 8) - .6);
      // liquid methane–ethane lakes: dark, mirror-smooth (Cassini's radar saw them flatter than any lake on Earth)
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: .04, metalness: .2, envMapIntensity: 1.5, transparent: true, opacity: .93 })); lake.rotation.x = -Math.PI / 2; lake.position.y = lv; lake.receiveShadow = true; scn.add(lake); }
    if (body.id === 'io') { const N = 2600, seed = new Float32Array(N * 2), g2 = new THREE.BufferGeometry(); for (let i = 0; i < N * 2; i++) seed[i] = Math.random(); g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g2.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
      const PU = { time: { value: 0 } }, plume = new THREE.Points(g2, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,   // a Pele-class plume on the horizon: a 300 km umbrella of sulfur
        vertexShader: 'attribute vec2 seed; uniform float time; varying float vA; void main(){ float ph = fract(time / 14. + seed.x), a = seed.y * 6.2832, sp = .2 + .8 * fract(seed.x * 13.7); vec3 v = vec3(cos(a) * sp, 1., sin(a) * sp); float t = ph * 2.; vec3 p = (v * t - vec3(0., .5 * t * t, 0.)) * 420.; vA = (1. - ph) * step(0., p.y); vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = clamp(2600. / -mv.z, 1., 5.); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.7, .8, 1.) * 1.3, smoothstep(.5, .1, d) * vA * .5); }' }));
      plume.position.set(-900, H(-900, -1500) - 20, -1500); plume.frustumCulled = false; scn.add(plume); S.items.push({ geyser: 1, g: new THREE.Group(), up: dt => { PU.time.value = S.t; } }); }
    S.prints = null;
    S.player = playerModel(); scn.add(S.player); scn.add(S.player.userData.sh);
    { const lamp = new THREE.SpotLight(0xfff4e0, 0, 60, .5, .6, 1.4); lamp.position.set(0, 1.7, -.1); lamp.target.position.set(0, .6, -8); S.player.add(lamp); S.player.add(lamp.target); S.lamp = lamp; } S.player.position.set(4, H(4, 4) + .1, 8); S.vel.set(0, 0, 0); S.yaw = Math.PI; S.camYaw = Math.PI;
    // VFX: glowing particles, soft dust, shockwave rings; rocks everywhere, grass on Earth
    S.fx = makeFX(scn, 2200, true); S.dust = makeFX(scn, 2600, false); S.rings = makeRings(scn); S.grass = null; S.peb = null; S.rocks = null; S.gc = col(W.gr[1]); S.dc = col(W.gr[2]).lerp(new THREE.Color(0xffffff), .08).multiplyScalar(.85);
    if (body.id !== 'earth') { const bt = new THREE.TextureLoader().load('models/tex/bootprint.png'); bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 4;
      const pg = new THREE.PlaneGeometry(.3, .5); pg.rotateX(-Math.PI / 2); const pm = new THREE.MeshStandardMaterial({ map: bt, color: S.dc.clone().multiplyScalar(.95), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
      const im = new THREE.InstancedMesh(pg, pm, 220); im.count = 0; im.receiveShadow = true; im.frustumCulled = false; scn.add(im); S.prints = { im, n: 0, d: 0, side: 1, last: null }; }

    const ultra = (ctx.q ? ctx.q() : 'high') === 'ultra' && !matchMedia('(pointer:coarse)').matches, nearPad = (x, z) => Math.hypot(x + 12, z + 8) < 14 || Math.hypot(x - 4, z - 8) < 6 || (W.sea && x > 300) || S.items.some(it => !it.geyser && Math.hypot(x - it.g.position.x, z - it.g.position.z) < it.s * .8 + 2);
    const PR = ctx.pre ? ctx.pre() : { grass: 18000, rocks: .6 };
    if (body.id === 'earth') { S.grass = makeGrass(scn, H, PR.grass, PR.grass > 20000 ? 75 : 60, (x, z) => nearPad(x, z) || Math.abs(x - 40) < 9); scatterRocks(scn, H, col('#8b8577'), Math.round(120 * PR.rocks), 600, nearPad); }
    else if (S.RM) { S.rocks = rockField(scn, H, body.id, Object.assign({ hot: S.RM.hot }, S.R), Math.max(120, Math.round(1400 * PR.rocks * (S.R.rockN || 1))), 640, nearPad, ter.userData.craters); S.peb = pebbleField(scn, H, body.id, S.R, Math.round(2400 * Math.max(.5, PR.rocks)), nearPad); }
    else scatterRocks(scn, H, col(W.gr[1]).lerp(col(W.gr[0]), .35), Math.max(60, Math.round(1500 * PR.rocks)), 640, nearPad);
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283; S.dust.emit(new THREE.Vector3(-12 + Math.cos(a) * 3, H(-12, -8) + .4, -8 + Math.sin(a) * 3), new THREE.Vector3(Math.cos(a) * 9, 1.2, Math.sin(a) * 9), S.dc, 1.6, 2.2, 1, 2, { grow: 3, drag: .7, a: .3, grav: W.g * .05 }); }
    S.rings.add(new THREE.Vector3(-12, H(-12, -8) + .3, -8), 0xffe6b0, 30, 1.2);
    S.gEff = Math.max(W.gameG || W.g, .05); ctx.ui(body, W, 'land'); S.on = true; S.arrive = ctx.noArrive ? null : { t0: 0, T: 5.2, yaw: S.camYaw + 2.2 };
    const n = ctx.objs(body.id, site).length; ctx.toast(`🛬 Landed: <b>${body.n}</b> · ${site ? site.n : W.site}<br><small>${n ? n + ' NASA site' + (n > 1 ? 's' : '') + ' nearby · ' : ''}${S.cols.filter(c => !c.got).length} glowing finds to collect</small>`, 4500);
  }
  function geyser(scn, x, y, z) { const n = 60, p = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xeaf6ff, size: 1.6, transparent: true, opacity: .8, depthWrite: false })); pts.position.set(x, y, z); pts.userData.seed = Math.random() * 10; scn.add(pts); return pts; }
  function enterDive(body, scn) { const D = DIVE[body.id]; S.D = D; scn.background = col(D.cols[0]); scn.fog = new THREE.Fog(col(D.cols[0]), 30, 420);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); for (let i = 0; i < 26; i++) { const x = 20 + Math.random() * 88, y = 20 + Math.random() * 88, r = 16 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    const ct = new THREE.CanvasTexture(cv); S.clouds = []; for (let i = 0; i < (ctx.mob ? 110 : 180); i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, color: col(D.cols[(i + 1) % 4]).multiplyScalar(.6 + Math.random() * .8), transparent: true, opacity: .55 + Math.random() * .4, depthWrite: false })); m.scale.setScalar(40 + Math.random() * 90); m.position.set((Math.random() - .5) * 700, (Math.random() - .5) * 500, (Math.random() - .5) * 700); scn.add(m); S.clouds.push(m); }
    S.player = new THREE.Group(); const sh = ctx.ship ? ctx.ship() : { m: 'orion' }, cap = { o: { id: sh.m }, r: sh.r, g: S.player, s: 4 }; placeModel(cap); scn.add(S.player); S.player.position.set(0, 0, 0); S.vel.set(0, 0, 0); S.yaw = 0; S.camYaw = 0;
    S.light = new THREE.PointLight(0xffffff, 0, 900, 1.2); scn.add(S.light); S.orbs = []; const om = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), om); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,255,1)', 'rgba(125,249,255,.6)'), blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(12); m.add(h); scn.add(m); S.orbs.push({ m, depth: 220 + i * 260, got: false, i, fact: D.facts[i] }); }
    S.factI = 0; ctx.ui(body, null, 'dive'); S.on = true; ctx.toast(`🌀 Diving into <b>${body.n}</b><br><small>Steer with the joystick · collect 3 glowing gas samples · climb back out before the pressure crushes you</small>`, 4500); }
  function step(dt, inp) {
    if (!S.on) return; S.t += dt; if (S.launch) { stepLaunch(dt); if (!S.on || !S.fx) return {}; S.fx.update(dt, ctx.cam); S.dust.update(dt, ctx.cam); S.rings.update(dt); if (S.grass) S.grass.update(dt, S.t, S.player.position.x, S.player.position.z); return {}; } const r = S.mode === 'dive' ? stepDive(dt, inp) : stepLand(dt, inp);
    if (S.mode !== 'dive') dayCycle(dt);
    if (S.fx && S.mode !== 'dive') { const P = S.player.position; if (!AIRLESS(WORLD[S.body.id]) && Math.random() < dt * 6) S.dust.emit(new THREE.Vector3(P.x + (Math.random() - .5) * 40, P.y + Math.random() * 8, P.z + (Math.random() - .5) * 40), new THREE.Vector3(1.2, .1, .4), S.dc, .25, 6, 1, .6, { drag: .1, a: .35, fadeIn: .3, grow: 1 });
      S.fx.update(dt, ctx.cam); S.dust.update(dt, ctx.cam); S.rings.update(dt); if (S.grass) S.grass.update(dt, S.t, P.x, P.z); if (S.peb) S.peb.update(P.x, P.z); }
    return r; }
  function stepLand(dt, inp) {
    if (S.fly) return stepFly(dt, inp); if (S.drive) return stepDrive(dt, inp);
    const P = S.player, W = WORLD[S.body.id], g = S.gEff, run = inp.run ? 2.1 : 1, speed = 5.2 * run;
    S.camYaw += inp.look * dt * 2.2; S.camPitch = THREE.MathUtils.clamp(S.camPitch + inp.lookY * dt * 1.5, .05, 1.2);
    const fx = -Math.sin(S.camYaw), fz = -Math.cos(S.camYaw), mx = inp.x * Math.cos(S.camYaw) + inp.y * fx * -1, mz = -inp.x * Math.sin(S.camYaw) + inp.y * fz * -1, l = Math.hypot(inp.x, inp.y);
    const tv = new THREE.Vector3(mx, 0, mz); if (l > .05) { tv.normalize().multiplyScalar(speed * Math.min(1, l)); S.yaw = Math.atan2(-tv.x, -tv.z) + Math.PI; }
    const k = Math.min(1, dt * (S.onGround ? 8 : 1.5)); S.vel.x += (tv.x - S.vel.x) * k; S.vel.z += (tv.z - S.vel.z) * k;
    const gy = H(P.position.x, P.position.z);
    if (inp.jumpPress && S.onGround) { S.vel.y = Math.min(4.6 + (run > 1 ? .8 : 0), Math.sqrt(2 * g * 30)); S.onGround = false; ctx.sfx('jump'); }
    S.vel.y -= g * dt; if (!S.onGround && inp.jump && S.vel.y < -1.6) S.vel.y = -1.6; // jetpack glide (hold jump)
    P.position.addScaledVector(S.vel, dt); const ng = H(P.position.x, P.position.z); if (S.sea && P.position.x > 330) { P.position.x = 330; S.vel.x = Math.min(0, S.vel.x); }
    if (P.position.y <= ng) { if (!S.onGround && S.vel.y < -6) ctx.sfx('lnd'); P.position.y = ng; S.vel.y = 0; S.onGround = true; } else if (P.position.y > ng + .2) S.onGround = false;
    const lim = 680; P.position.x = THREE.MathUtils.clamp(P.position.x, -lim, lim); P.position.z = THREE.MathUtils.clamp(P.position.z, -lim, lim);
    P.rotation.y += ((S.yaw - P.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 10);
    const moving = Math.hypot(S.vel.x, S.vel.z) > .5 && S.onGround, lowg = THREE.MathUtils.clamp(1 - W.g / 9.81, 0, 1), gf = 9 - lowg * 4.5, ga = .08 + lowg * .28; const rig = P.userData.rig; if (rig) { const landed = P.userData.wasG === false && S.onGround ? (P.userData.lastVy || 0) : 0; P.userData.wasG = S.onGround; if (!S.onGround) P.userData.lastVy = S.vel.y;
      rig.update(dt, { spd: Math.hypot(S.vel.x, S.vel.z), ground: S.onGround, g, run: run > 1, yaw: P.rotation.y, landed: landed < -2.5 ? landed : 0, hold: !S.onGround && inp.jump }); }
    else P.children.forEach(c => { if ((c.isGroup || c.isMesh) && !c.isLight) { c.position.y = moving ? Math.abs(Math.sin(S.t * gf * run)) * ga : 0; c.rotation.x = moving ? .12 * run : 0; } });
    if (S.prints && moving) { const F = S.prints, sp = Math.hypot(S.vel.x, S.vel.z); F.d += sp * dt; if (F.d > (.7 + lowg * .5) * run) { F.d = 0; F.side = -F.side; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), S.yaw + Math.PI), sx = Math.cos(S.yaw) * .13 * F.side, sz = -Math.sin(S.yaw) * .13 * F.side, x = P.position.x + sx, z = P.position.z + sz;
        m4.compose(new THREE.Vector3(x, H(x, z) + .03, z), q, new THREE.Vector3(F.side < 0 ? -1 : 1, 1, 1)); F.im.setMatrixAt(F.n % 220, m4); F.n++; if (F.n === 100 && S.body.id === 'moon' && ctx.trophy) ctx.trophy('a_boots'); F.im.count = Math.min(220, F.n); F.im.instanceMatrix.needsUpdate = true; } }
    if (S.lamp) { const dark = S.skyU ? 1 - THREE.MathUtils.smoothstep(S.skyU.e.value, -.08, .12) : 0; S.lamp.intensity += ((dark > .05 ? 40 * dark : 0) - S.lamp.intensity) * Math.min(1, dt * 3); S.lamp.visible = S.lamp.intensity > .5; }
    const jet = P.userData.jet; jet.scale.setScalar(!S.onGround && inp.jump ? 1.2 + Math.random() * .4 : .01);
    if (S.fx) { const hs = Math.hypot(S.vel.x, S.vel.z);
      if (moving && AIRLESS(W) && Math.random() < dt * (run > 1 ? 16 : 8)) { const gv = Math.max(.3, g || W.g || 1.6); for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, sp = .4 + Math.random() * 1.2, up = (.9 + Math.random() * 1.4) * Math.sqrt(gv / 1.62); S.dust.emit(new THREE.Vector3(P.position.x, ng + .05, P.position.z), new THREE.Vector3(Math.cos(a) * sp - S.vel.x * .1, up, Math.sin(a) * sp - S.vel.z * .1), S.dc, .13, (2 * up / gv) * 1.05, 1, .1, { grow: 1, drag: 0, grav: gv, a: .85 }); } }
      if (moving && !AIRLESS(W) && Math.random() < dt * (run > 1 ? 14 : 7)) S.dust.emit(new THREE.Vector3(P.position.x, ng + .1, P.position.z), new THREE.Vector3(-S.vel.x * .15, .6, -S.vel.z * .15), S.dc, .7, 1.2, 1, .8, { grow: 2.8, drag: .8, a: .35 });
      if (!S.onGround && inp.jump) { const jp = jet.getWorldPosition(new THREE.Vector3()); S.fx.emit(jp, new THREE.Vector3(S.vel.x * .3, -6, S.vel.z * .3), 0x9fe6ff, .45, .35, 3, 1.5, { grow: 2 }); if (P.position.y - ng < 3) S.dust.emit(new THREE.Vector3(P.position.x, ng + .1, P.position.z), new THREE.Vector3(0, .4, 0), S.dc, 1.2, 1, 2, 5, { grow: 3, drag: .9, a: .35 }); }
      if (S.wasAir && S.onGround && S.landV < -3) { if (AIRLESS(W)) { const gv = Math.max(.3, g || W.g || 1.6); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, sp = 1 + Math.random() * 3, up = (1 + Math.random() * 2.2) * Math.sqrt(gv / 1.62); S.dust.emit(new THREE.Vector3(P.position.x, ng + .05, P.position.z), new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp), S.dc, .14, (2 * up / gv) * 1.05, 1, .1, { grow: 1, drag: 0, grav: gv, a: .9 }); } } for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; S.dust.emit(new THREE.Vector3(P.position.x, ng + .1, P.position.z), new THREE.Vector3(Math.cos(a) * 4, .5, Math.sin(a) * 4), S.dc, 1, 1.2, 1, .5, { grow: 2.5, drag: .85, a: .4 }); } }
      S.wasAir = !S.onGround; if (!S.onGround) S.landV = S.vel.y; }
    if (S.dl && S.dl.castShadow) { S.dl.target.position.copy(P.position); S.dl.position.set(P.position.x - 300, P.position.y + 180, P.position.z - 360); }
    const sh = P.userData.sh; sh.position.set(P.position.x, ng + .05, P.position.z); sh.material.opacity = .35 * Math.max(0, 1 - (P.position.y - ng) / 8);
    // camera: behind and above, Genshin style
    const cd = 7.5, cx = P.position.x + Math.sin(S.camYaw) * cd * Math.cos(S.camPitch), cz = P.position.z + Math.cos(S.camYaw) * cd * Math.cos(S.camPitch); let cy = P.position.y + 1.6 + Math.sin(S.camPitch) * cd; cy = Math.max(cy, H(cx, cz) + .8);
    if (S.helmet) { const hp = new THREE.Vector3(P.position.x, P.position.y + 1.66 + (P.userData.rig ? P.userData.rig.root.children[0].position.y : 0), P.position.z); ctx.cam.position.copy(hp);   // inside the helmet: you see what the astronaut sees
      const lp = -(S.camPitch - .35) * 1.4; ctx.cam.lookAt(hp.x - Math.sin(S.camYaw) * Math.cos(lp) * 10, hp.y + Math.sin(lp) * 10, hp.z - Math.cos(S.camYaw) * Math.cos(lp) * 10); if (P.userData.rig) P.userData.rig.root.visible = false; }
    else if (S.arrive) { const A = S.arrive; if (!A.t0) A.t0 = performance.now() + 400; A.t = Math.max(0, performance.now() - A.t0) / 1000;   // the clock starts once the new scene is actually on screen
      if (P.userData.rig) P.userData.rig.root.visible = true;
      // smootherstep from a high, wide view of the site down to the usual shoulder camera; any movement hands control back early
      const k = Math.min(1, A.t / A.T), e = k * k * k * (k * (k * 6 - 15) + 10), yw = A.yaw + (S.camYaw - A.yaw) * e, pt = .62 + (S.camPitch - .62) * e, r = 110 + (cd - 110) * e;
      const ax = P.position.x + Math.sin(yw) * r * Math.cos(pt), az = P.position.z + Math.cos(yw) * r * Math.cos(pt), ay = Math.max(P.position.y + 1.6 + Math.sin(pt) * r, H(ax, az) + 2);
      ctx.cam.position.set(ax, ay, az); ctx.cam.lookAt(P.position.x, P.position.y + 1.4 * e, P.position.z);
      if (k >= 1 || Math.abs(inp.x || 0) + Math.abs(inp.y || 0) > .2) S.arrive = null; }
    else { if (P.userData.rig) P.userData.rig.root.visible = true; ctx.cam.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8)); ctx.cam.lookAt(P.position.x, P.position.y + 1.4, P.position.z); }
    if (S.beam) { const bd = Math.hypot(ctx.cam.position.x + 16, ctx.cam.position.z + 12); S.beam.material.opacity = THREE.MathUtils.clamp((bd - 12) / 30, 0, 1) * .18; }
    return things(dt, P);
  }
  function things(dt, P) {
    const F = S.fly, cr = F ? F.s * .6 + 3 : 0;
    let near = null, nd = 1e9, want = null, wd = 1e9;
    for (const it of S.items) { if (it.up) { it.up(dt); continue; } if (it.geyser) { const a = it.g.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const t = (S.t * .6 + i / a.count + it.g.userData.seed) % 1; a.setXYZ(i, Math.sin(i * 7.1) * t * 4, t * 60, Math.cos(i * 3.3) * t * 4); } a.needsUpdate = true; continue; }
      const d = it.g.position.distanceTo(P.position); if (!it.model && !it.loading && d < 300 + it.s * 2 && d < wd) { wd = d; want = it; } if (it.fly) { it.g.position.y = it.base.y + it.fly + Math.sin(S.t * 1.3) * .6; if (it.fly > 20) { const a = S.t * .08 + it.base.x; it.g.position.x = it.base.x + Math.cos(a) * 120; it.g.position.z = it.base.z + Math.sin(a) * 120; it.g.rotation.y = -a; } }
      it.mk.visible = d > it.s * 1.6; const r = Math.max(9, it.s * .9) + (F ? 28 : 0); if (d - r < nd) { nd = d - r; near = it; } }
    if (want) placeModel(want);
    S.ldN = S.items.filter(x => !x.geyser).length; S.ldK = S.items.filter(x => !x.geyser && x.model).length;
    for (const c of S.cols) { if (c.got) continue; c.m.rotation.y += dt * 1.6; c.m.position.y += Math.sin(S.t * 2 + c.i) * dt * .3; if (c.m.position.distanceTo(P.position) < 2.4 + cr) collect(c); }
    S.near = near && nd < 0 ? near : null; return { near: S.near };
  }
  // ---- flying NASA aircraft (Earth) and the Ingenuity helicopter (Mars) ----
  function fly(cr) { const P = S.player; if (!P) return;
    if (!cr) { if (S.craft) P.remove(S.craft); S.craft = null; S.fly = null; P.children.forEach(c => c.visible = true); P.userData.jet.scale.setScalar(.01); P.position.y = Math.max(P.position.y, H(P.position.x, P.position.z)); S.vel.set(0, -2, 0); S.onGround = false; S.yaw = S.fyaw || S.yaw; ctx.craftUI(false, {}); ctx.toast('🧑‍🚀 Back on foot', 1400); return; }
    P.children.forEach(c => c.visible = false); const g = new THREE.Group(); P.add(g); S.craft = g; S.fly = cr; P.rotation.set(0, 0, 0);
    const e = { o: { id: cr.m }, r: cr.r, g: new THREE.Group(), s: cr.s }; g.add(e.g); placeModel(e, 1); S.craftE = e;
    S.fyaw = S.camYaw + Math.PI; S.fpitch = cr.heli ? 0 : .18; S.fv = cr.heli ? 0 : cr.v; S.roll = 0; S.vel.set(0, 0, 0);
    if (!cr.heli) P.position.y = H(P.position.x, P.position.z) + 30; else P.position.y += .2;
    ctx.craftUI(true, cr); ctx.toast(cr.heli ? '🚁 <b>Ingenuity</b> · hold CLIMB to rise, release to land<br><small>Mars air is about 1% as thick as Earth’s, so the blades spin around 2,400 times a minute.</small>' : `✈ <b>${cr.n}</b> · joystick to steer, PULL UP to climb, THROTTLE for speed<br><small>Fly low over Kennedy Space Center and scan from the air.</small>`, 5000); }
  function stepFly(dt, inp) { const P = S.player, cr = S.fly, gH = H(P.position.x, P.position.z);
    S.camYaw += inp.look * dt * 2.2;
    if (cr.heli) {
      const fxv = -Math.sin(S.camYaw), fz = -Math.cos(S.camYaw), mx = inp.x * Math.cos(S.camYaw) + inp.y * fxv * -1, mz = -inp.x * Math.sin(S.camYaw) + inp.y * fz * -1, l = Math.hypot(inp.x, inp.y), sp = inp.run ? cr.vmax : cr.v;
      const tv = new THREE.Vector3(mx, 0, mz); if (l > .05) tv.normalize().multiplyScalar(sp * Math.min(1, l)); const air = P.position.y > gH + .3;
      if (!air) tv.multiplyScalar(0); S.vel.x += (tv.x - S.vel.x) * Math.min(1, dt * 2.5); S.vel.z += (tv.z - S.vel.z) * Math.min(1, dt * 2.5);
      const vy = inp.jump ? 5 : air ? -1.4 : 0; S.vel.y += (vy - S.vel.y) * Math.min(1, dt * 3); P.position.addScaledVector(S.vel, dt);
      const ng = H(P.position.x, P.position.z); if (P.position.y < ng) { P.position.y = ng; S.vel.y = 0; } if (P.position.y > ng + 60) P.position.y = ng + 60;
      if (l > .05) S.fyaw = Math.atan2(-S.vel.x, -S.vel.z); S.craft.rotation.set(-S.vel.length() / cr.vmax * .35, S.fyaw, 0, 'YXZ'); S.craft.position.y = air ? Math.sin(S.t * 3) * .05 : 0; const ro = S.craftE && S.craftE.model && S.craftE.model.getObjectByName('rotors_01'); if (ro) ro.rotation.y += dt * (air || inp.jump ? 45 : 0);
      const cd = 8, cx = P.position.x + Math.sin(S.camYaw) * cd * Math.cos(S.camPitch), cz = P.position.z + Math.cos(S.camYaw) * cd * Math.cos(S.camPitch); let cy = P.position.y + 1.6 + Math.sin(S.camPitch) * cd; cy = Math.max(cy, H(cx, cz) + .8);
      ctx.cam.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 6)); ctx.cam.lookAt(P.position.x, P.position.y + 1, P.position.z);
    } else {
      S.fyaw -= inp.x * dt * (cr.glide ? .55 : .85); S.roll += (-inp.x * .75 - S.roll) * Math.min(1, dt * 3);
      const ctl = THREE.MathUtils.clamp(-inp.y + (inp.jump ? 1 : 0), -1, 1); let tp = ctl * .55 + (cr.glide ? -.12 : 0); S.fpitch += (tp - S.fpitch) * Math.min(1, dt * 1.8);
      const tgt = (inp.run ? cr.vmax : cr.v) + (cr.glide ? Math.max(0, -S.fpitch) * 90 - Math.max(0, S.fpitch) * 40 : 0); S.fv += (tgt - S.fv) * Math.min(1, dt * .5); S.fv = Math.max(cr.v * .55, S.fv);
      const cp = Math.cos(S.fpitch), dir = new THREE.Vector3(-Math.sin(S.fyaw) * cp, Math.sin(S.fpitch), -Math.cos(S.fyaw) * cp); P.position.addScaledVector(dir, S.fv * dt);
      const floor = H(P.position.x, P.position.z) + cr.s * .3 + 1; if (P.position.y < floor) { P.position.y = floor; if (S.fpitch < .1) S.fpitch = .1; S.fv *= Math.pow(.6, dt); if (!S.pullT) { S.pullT = 2.5; ctx.toast('⚠ PULL UP!', 900); ctx.sfx('no'); } } S.pullT = Math.max(0, (S.pullT || 0) - dt);
      if (P.position.y > floor + 650) { P.position.y = floor + 650; S.fpitch = Math.min(S.fpitch, 0); }
      const lim = 660; if (Math.abs(P.position.x) > lim || Math.abs(P.position.z) > lim) { P.position.x = THREE.MathUtils.clamp(P.position.x, -lim, lim); P.position.z = THREE.MathUtils.clamp(P.position.z, -lim, lim); const back = Math.atan2(P.position.x, P.position.z); let d = back - S.fyaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; S.fyaw += d * Math.min(1, dt * 1.5); }
      S.craft.rotation.set(S.fpitch, S.fyaw, S.roll, 'YXZ');
      const cd = cr.s * 1.5 + 8, back = new THREE.Vector3(Math.sin(S.fyaw) * cd, cr.s * .35 + 3 - Math.sin(S.fpitch) * cd * .5, Math.cos(S.fyaw) * cd); const cpos = P.position.clone().add(back); cpos.y = Math.max(cpos.y, H(cpos.x, cpos.z) + 1.5);
      ctx.cam.position.lerp(cpos, Math.min(1, dt * 4)); ctx.cam.lookAt(P.position.x - Math.sin(S.fyaw) * 10, P.position.y + Math.sin(S.fpitch) * 10, P.position.z - Math.cos(S.fyaw) * 10);
      S.camYaw = S.fyaw + Math.PI;
    }
    if (S.dl && S.dl.castShadow) { S.dl.target.position.copy(P.position); S.dl.position.set(P.position.x - 300, P.position.y + 180, P.position.z - 360); }
    { const gh = H(P.position.x, P.position.z), alt = P.position.y - gh;
      if (cr.heli) { if (alt < 8 && (alt > .3 || inp.jump) && Math.random() < dt * 30) { const a = Math.random() * 6.283; S.dust.emit(new THREE.Vector3(P.position.x + Math.cos(a) * 1.2, gh + .15, P.position.z + Math.sin(a) * 1.2), new THREE.Vector3(Math.cos(a) * 5, .5, Math.sin(a) * 5), S.dc, 1.3, 1.4, 1, 1, { grow: 3, drag: .75, a: .35 * (1 - alt / 8) }); } }
      else { const b = new THREE.Vector3(Math.sin(S.fyaw), 0, Math.cos(S.fyaw)), sideV = new THREE.Vector3(Math.cos(S.fyaw), 0, -Math.sin(S.fyaw)), tail = P.position.clone().addScaledVector(b, cr.s * .45);
        if ((inp.run || cr.glide) && alt > 12) S.dust.emit(tail, new THREE.Vector3(0, 0, 0), 0xffffff, cr.s * .05, 2.4, 2, .2, { grow: 2.5, drag: .9, a: .2, jit: .2 });
        [-1, 1].forEach(sd => { if (Math.abs(S.roll) > .3 || inp.jump) S.dust.emit(P.position.clone().addScaledVector(sideV, sd * cr.s * .48), new THREE.Vector3(0, 0, 0), 0xffffff, cr.s * .04, .8, 1, .1, { grow: 3, drag: .9, a: .35 }); });
        if (alt < cr.s * .8) S.dust.emit(new THREE.Vector3(P.position.x, gh + .2, P.position.z), new THREE.Vector3(0, 1, 0), S.dc, cr.s * .25, 1.6, 2, 6, { grow: 3, drag: .8, a: .4 }); } }
    const sh = P.userData.sh, ng = H(P.position.x, P.position.z); sh.position.set(P.position.x, ng + .05, P.position.z); sh.scale.setScalar(cr.s * .45); sh.material.opacity = .35 * Math.max(0, 1 - (P.position.y - ng) / (cr.s * 4 + 10));
    if (S.beam) S.beam.material.opacity = 0;
    const r = things(dt, P); r.alt = Math.round(P.position.y - ng); r.spd = Math.round((cr.heli ? Math.hypot(S.vel.x, S.vel.z) : S.fv) * 3.6); return r; }
  // lift-off cinematic: you board, engines light, smoke billows, the ship climbs away and the camera watches from the ground
  function launch(cb) { if (!S.capG) return cb(); S.launch = { t: 0, cb, y0: S.capG.position.y }; if (S.fly) fly(null); S.player.visible = false; if (S.player.userData.sh) S.player.userData.sh.visible = false; ctx.toast('🚀 Lift-off!', 1600); }
  function stepLaunch(dt) { const L = S.launch, g = S.capG, W = WORLD[S.body.id]; L.t += dt; if (S.beam) S.beam.material.opacity = 0; const t = L.t, up = t < .7 ? 0 : 1.5 * 9 * Math.pow(t - .7, 2.2);
    g.position.y = L.y0 + up; g.position.x = -12 + (t < .7 ? (Math.random() - .5) * .12 : 0); const wp = g.getWorldPosition(new THREE.Vector3()), gy = H(-12, -8), base = new THREE.Vector3(wp.x, wp.y + .2, wp.z);
    const n = t < .7 ? 3 : 6; S.fx.emit(base, new THREE.Vector3(0, -14 - up * .2, 0), 0xffc070, S.capS * .35, .35, n, 4, { grow: 2, jit: .6 }); S.fx.emit(base, new THREE.Vector3(0, -8, 0), 0xffffff, S.capS * .2, .2, 3, 2, { grow: 1.5, jit: .4 });
    if (up < 40) for (let i = 0; i < 4; i++) { const a = Math.random() * 6.283; S.dust.emit(new THREE.Vector3(-12 + Math.cos(a) * 2, gy + .6, -8 + Math.sin(a) * 2), new THREE.Vector3(Math.cos(a) * (8 + Math.random() * 8), 1 + Math.random() * 2, Math.sin(a) * (8 + Math.random() * 8)), AIRLESS(W) ? S.dc : 0xd8d4cc, 3.5, 4, 1, 1.5, { grow: 3.5, drag: .55, a: AIRLESS(W) ? .45 : .6, grav: -.3 }); }
    if (t > .7 && t < .8) S.rings.add(new THREE.Vector3(-12, gy + .3, -8), 0xffd27a, 34, 1.4);
    const cp = new THREE.Vector3(14, gy + 3.5, 26), look = wp.clone(); look.y = Math.max(look.y, gy + 6); ctx.cam.position.lerp(cp.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(t > .7 && up < 30 ? .12 : 0)), Math.min(1, dt * 3)); ctx.cam.lookAt(look);
    if (t > 3.2) { const cb = L.cb; S.launch = null; S.player.visible = true; if (S.player.userData.sh) S.player.userData.sh.visible = true; cb(); } }
  // day/night cycle on worlds with air: a full day every 4 minutes; light, sky, fog, stars and ocean all follow the Sun
  function shine(day) { const W = WORLD[S.body.id], sp = W.inSky && SHINE[W.inSky]; if (!sp) return; if (!S.psl) { const l = new THREE.DirectionalLight(sp[0], 0); l.position.set(900, 1100, -2600); S.scn.add(l); S.scn.add(l.target); S.psl = l; }
    S.psl.target.position.copy(S.player.position); S.psl.position.copy(S.player.position).add(new THREE.Vector3(900, 1100, -2600).normalize().multiplyScalar(400)); S.psl.intensity = sp[1] * (1 - day * .85); }   // Earthshine / Jupitershine on the night side
  function airlessCycle(dt) { const W = WORLD[S.body.id]; S.tod = (S.tod + dt / ((DAYH[S.body.id] || 24) * 10)) % 1; const a = S.tod * Math.PI * 2, e = Math.sin(a) * .9, sd = new THREE.Vector3(-Math.cos(a) * .82, e, -.42).normalize(), day = THREE.MathUtils.smoothstep(e, -.03, .08);
    if (S.sunSpr) { S.sunSpr.position.copy(sd).multiplyScalar(2530); if (S.sunCore) S.sunCore.position.copy(S.sunSpr.position); } TU.tsd.value.copy(sd); TU.day.value = day;
    const dl = S.dl, pl = S.player ? S.player.position : new THREE.Vector3(); dl.intensity = 2.6 * day; dl.position.copy(pl).addScaledVector(sd, 420); dl.target.position.copy(pl); S.hemi.intensity = .03 + .35 * day; S.scn.environmentIntensity = .5 * (.05 + .95 * day); shine(day); }
  function dayCycle(dt) { const U = S.skyU; if (!U) return airlessCycle(dt); const W = WORLD[S.body.id]; S.tod = (S.tod + dt / ((DAYH[S.body.id] || 24) * 10)) % 1; const a = S.tod * Math.PI * 2, e = Math.sin(a) * .9;
    U.e.value = e; U.sd.value.set(-Math.cos(a) * .82, e, -.42).normalize(); const day = THREE.MathUtils.smoothstep(e, -.06, .22), low = 1 - THREE.MathUtils.smoothstep(e, .02, .4);
    const P = S.skyP, fogC = P[3].clone().multiplyScalar(1.6).lerp(P[1], day).lerp(P[2], low * day * .55); if (S.scn.fog) S.scn.fog.color.copy(fogC); S.scn.background.copy(fogC);
    { const k = AIRLESS(W) ? 0 : ({ mars: .95, earth: .6, titan: .55, venus: .45 }[S.body.id] ?? .5); FOGSUN.value.set(U.sd.value.x, U.sd.value.y, U.sd.value.z, k * day * (S.mode === 'dive' ? 0 : 1)); FOGSUNC.value.copy(col(W.sun || '#ffffff')).lerp(new THREE.Color(1, .55, .28), low * .8).multiplyScalar(S.body.id === 'mars' ? .55 : .7); }
    const dl = S.dl, pl = S.player ? S.player.position : new THREE.Vector3(); if (e > -.05) { dl.intensity = 2.6 * THREE.MathUtils.smoothstep(e, -.05, .2); dl.color.copy(col(W.sun || '#ffffff')).lerp(P[2].clone().lerp(new THREE.Color(1, .6, .35), .5), low * .7); dl.position.copy(pl).addScaledVector(U.sd.value, 420); }
    else { dl.intensity = .28; dl.color.setRGB(.6, .7, 1); dl.position.copy(pl).addScaledVector(U.sd.value, -420).setY(pl.y + 300); }   // moonlight / starlight
    dl.target.position.copy(pl); S.hemi.intensity = .06 + .5 * day; S.scn.environmentIntensity = .5 * (.1 + .9 * day); S.hemi.color.copy(P[1]).lerp(new THREE.Color(1, 1, 1), .4); if (S.starM) S.starM.opacity = 1 - THREE.MathUtils.smoothstep(e, -.15, .05);
    TU.tsd.value.copy(U.sd.value); TU.day.value = day; if (S.cloudL) { const m = S.cloudL.material; m.map.offset.x += dt * .0015; m.map.offset.y += dt * .0006; TU.cOff.value.copy(m.map.offset); m.color.copy(S.cloudBase).lerp(P[2], low * day * .8).multiplyScalar(.12 + .88 * day); m.opacity = .9 * (.3 + .7 * day); }
    if (S.seaU) { S.seaU.time.value = S.t; S.seaU.sky.value.copy(fogC); S.seaU.sunI.value = day; } shine(day); weather(dt, e, day, a, fogC); meteors(dt, e);
    if (S.body.id === 'mars' && low > .75 && day > .15 && day < .7 && ctx.trophy && !S.ssT) { S.ssT = 1; ctx.trophy('a_sunset'); }
    // Mars: wandering dust devils
    if (S.body.id === 'mars' && S.dust) { if (!S.devils) S.devils = [0, 1, 2].map(i => ({ x: 60 + i * 90, z: -120 + i * 110, a: i * 2, h: 0 }));
      for (const dv of S.devils) { dv.a += dt * .07; dv.x += Math.cos(dv.a) * dt * 3; dv.z += Math.sin(dv.a * 1.3) * dt * 3; const gy = H(dv.x, dv.z);
        for (let k = 0; k < 3; k++) { const r = 1 + Math.random() * 4, th = Math.random() * 6.283; S.dust.emit(new THREE.Vector3(dv.x + Math.cos(th) * r, gy + Math.random() * 2, dv.z + Math.sin(th) * r), new THREE.Vector3(-Math.sin(th) * 7, 4 + Math.random() * 7, Math.cos(th) * 7), S.dc, 1.4 + Math.random() * 1.6, 3.2, 1, 1, { grow: 3, drag: .25, a: .28 }); } } } }
  /* rovers: Apollo LRV on the Moon, a Perseverance-style rover on Mars */
  function drive(on) { const P = S.player, kind = S.body.id === 'moon' ? 'lrv' : S.body.id === 'mars' ? 'perse' : null; if (!kind || S.fly) return false;
    if (!on) { if (!S.drive) return false; const st = S.rover.st, sx = -Math.sin(st.yaw), sz = -Math.cos(st.yaw); P.position.set(st.x + sx * 2.2, H(st.x + sx * 2.2, st.z + sz * 2.2), st.z + sz * 2.2); S.vel.set(0, 0, 0); S.onGround = true; P.visible = true; S.drive = null; S.camYaw = Math.PI / 2 - st.yaw + Math.PI;
      ctx.toast('🧑‍🚀 Parked. The rover stays where you left it.', 1800); return true; }
    if (!S.rover) { S.rover = makeRover(kind, ctx.loader, ctx.fixMat); S.scn.add(S.rover.g); const tr = new THREE.InstancedMesh(new THREE.PlaneGeometry(.24, .42).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: S.dc.clone().multiplyScalar(.62), roughness: 1, transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 900); tr.count = 0; tr.frustumCulled = false; tr.receiveShadow = true; S.scn.add(tr); S.tracks = { im: tr, n: 0, d: 0 };
      S.rover.place(P.position.x + 3, P.position.z + 3, Math.PI / 2 - S.yaw, H); S.rover.onLand = v => { ctx.sfx('lnd'); for (let i = 0; i < 30; i++) { const a = Math.random() * 6.283; S.dust.emit(new THREE.Vector3(S.rover.st.x, H(S.rover.st.x, S.rover.st.z) + .1, S.rover.st.z), new THREE.Vector3(Math.cos(a) * 3, 1 + Math.random() * 2, Math.sin(a) * 3), S.dc, .15, 2, 1, .2, { grow: 1, drag: 0, grav: S.gEff, a: .9 }); } }; }
    else { const st = S.rover.st; if (Math.hypot(st.x - P.position.x, st.z - P.position.z) > 12) { ctx.toast('🚙 Walk back to your rover to drive it', 1800); return false; } }
    S.drive = S.rover; P.visible = false; ctx.toast(kind === 'lrv' ? '🚙 <b>Lunar Roving Vehicle</b> · joystick to drive, JUMP to brake<br><small>Apollo 15, 16 and 17 drove these 90 km in total. Top speed was about 13 km/h, and on bumps the wheels left the ground in the low gravity.</small>' : '🤖 <b>Perseverance-style rover</b> · driving by remote, like the team at JPL<br><small>The real rover drives about 0.15 km/h; this one is sped up. Six wheels on a rocker-bogie suspension climb over rocks as big as the wheels.</small>', 6000); return true; }
  function stepDrive(dt, inp) { const R = S.rover, st = R.update(dt, inp, H, S.gEff), P = S.player, W = WORLD[S.body.id]; P.position.set(st.x, st.y, st.z);
    const fx = Math.cos(st.yaw), fz = -Math.sin(st.yaw), sp = Math.abs(st.v);
    // tyre tracks behind the rear wheels
    if (!st.air && sp > .3) { const T = S.tracks; T.d += sp * dt; if (T.d > .38) { T.d = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw + Math.PI / 2);
      for (const w of R.wheels) { if (w.x > 0 && R.wheels.length > 4) continue; if (w.x > 0 && R.wheels.length === 4) continue; const wx = st.x + w.x * Math.cos(st.yaw) + w.z * Math.sin(st.yaw), wz = st.z - w.x * Math.sin(st.yaw) + w.z * Math.cos(st.yaw); m4.compose(new THREE.Vector3(wx, H(wx, wz) + .03, wz), q, new THREE.Vector3(R.L.r * 2.2, 1, 1)); T.im.setMatrixAt(T.n % 900, m4); T.n++; }
      T.im.count = Math.min(900, T.n); T.im.instanceMatrix.needsUpdate = true; } }
    // rooster tails: on the airless Moon the dust flies in perfect arcs and drops straight back (seen in the Apollo 16 rover film)
    if (S.dust && sp > 1 && !st.air && Math.random() < dt * 40) for (const w of R.wheels) { if (w.x > 0) continue; const wx = st.x + w.x * fx - w.z * fz * 0 + w.z * Math.sin(st.yaw), wz = st.z + w.x * fz + w.z * Math.cos(st.yaw);
      if (AIRLESS(W)) { const up = 1.2 + Math.random() * 1.6; S.dust.emit(new THREE.Vector3(wx, H(wx, wz) + .1, wz), new THREE.Vector3(-fx * sp * .7 + (Math.random() - .5), up, -fz * sp * .7 + (Math.random() - .5)), S.dc, .12, 2 * up / S.gEff, 2, .3, { grow: 1, drag: 0, grav: S.gEff, a: .85 }); }
      else S.dust.emit(new THREE.Vector3(wx, H(wx, wz) + .2, wz), new THREE.Vector3(-fx * sp * .3, .7, -fz * sp * .3), S.dc, .9, 1.6, 1, .6, { grow: 3, drag: .7, a: .3 }); }
    // chase camera
    const back = 8.5 + sp * .3, cx = st.x - fx * back, cz = st.z - fz * back, cy = Math.max(st.y + 3.2, H(cx, cz) + 1.2); ctx.cam.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 3.5)); const lk = S.drvLook || (S.drvLook = new THREE.Vector3(st.x, st.y, st.z)); lk.lerp(new THREE.Vector3(st.x + fx * 2, st.y + .6, st.z + fz * 2), Math.min(1, dt * 6)); ctx.cam.lookAt(lk);
    const sh = P.userData.sh; sh.material.opacity = 0; if (S.dl && S.dl.castShadow) { S.dl.target.position.copy(P.position); }
    return things(dt, P); }
  /* shooting stars: grains of comet dust burning up ~100 km overhead, on Earth and on Mars (Curiosity has photographed Martian meteors) */
  function meteors(dt, e) { const id = S.body.id; let M = S.met; if ((id !== 'earth' && id !== 'mars') || S.mode === 'dive' || e > -.06) { if (M) M.m.visible = false; return; }
    if (!M) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); g.setAttribute('t', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1]), 1)); g.setIndex([0, 1, 2, 2, 1, 3]);
      const mat = new THREE.ShaderMaterial({ uniforms: { a: { value: 0 }, c: { value: new THREE.Color() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
        vertexShader: 'attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: 'uniform float a; uniform vec3 c; varying float vT; void main(){ gl_FragColor = vec4(c * (1. + 3. * pow(vT, 8.)), a * pow(vT, 1.6)); }' });
      M = S.met = { m: new THREE.Mesh(g, mat), next: 2 + Math.random() * 4, t: 0, life: 0, s: new THREE.Vector3(), v: new THREE.Vector3(), n: 0 }; M.m.frustumCulled = false; M.m.renderOrder = 2; S.scn.add(M.m); }
    const dark = 1 - THREE.MathUtils.smoothstep(e, -.2, -.06); M.next -= dt;
    if (M.life <= 0 && M.next <= 0) { const P = S.player.position, az = Math.random() * 6.283, el = .45 + Math.random() * .7, R0 = 2600, big = Math.random() < .12; M.s.set(P.x + Math.cos(az) * Math.cos(el) * R0, P.y + Math.sin(el) * R0, P.z + Math.sin(az) * Math.cos(el) * R0);
      const dz = Math.random() * 6.283; M.v.set(Math.cos(dz), -.35 - Math.random() * .5, Math.sin(dz)).normalize().multiplyScalar(big ? 900 : 1200 + Math.random() * 700); M.life = M.max = big ? 1.6 + Math.random() * .8 : .35 + Math.random() * .55; M.big = big; M.t = 0;
      M.m.material.uniforms.c.value.set(big ? (id === 'mars' ? 0xffc890 : 0xb8ffd0) : 0xfff4e8); M.next = (id === 'earth' ? 2.5 : 5) + Math.random() * 7; M.n++;
      if (M.n === 2 && ctx.toast) ctx.toast(id === 'earth' ? '☄ <b>A shooting star.</b> A grain of comet dust no bigger than sand, burning up about 100 km overhead at up to 70 km/s.' : '☄ <b>A Martian meteor.</b> Mars sweeps up comet dust too; Curiosity has photographed meteors from the surface.', 5200); }
    M.m.visible = M.life > 0; if (M.life <= 0) return; M.life -= dt; M.t += dt; const k = M.t / M.max, fl = Math.sin(Math.min(1, k) * Math.PI), hd = M.s.clone().addScaledVector(M.v, M.t), tl = hd.clone().addScaledVector(M.v, -Math.min(M.t, M.big ? .5 : .22));
    const cam = ctx.cam.position, dir = hd.clone().sub(tl), side = dir.clone().cross(hd.clone().sub(cam)).normalize().multiplyScalar(M.big ? 5 : 2.4), p = M.m.geometry.attributes.position;
    p.setXYZ(0, tl.x - side.x * .3, tl.y - side.y * .3, tl.z - side.z * .3); p.setXYZ(1, tl.x + side.x * .3, tl.y + side.y * .3, tl.z + side.z * .3); p.setXYZ(2, hd.x - side.x, hd.y - side.y, hd.z - side.z); p.setXYZ(3, hd.x + side.x, hd.y + side.y, hd.z + side.z); p.needsUpdate = true;
    M.m.material.uniforms.a.value = fl * dark * (M.big ? 1 : .8) * (S.cloudL ? .85 : 1); }
  /* weather for each world */
  function weather(dt, e, day, a, fogC) { const id = S.body.id, P = S.player.position;
    if (id === 'mars') {
      TU.frost.value = (Math.cos(a) > 0 || e < -.05) ? 1 - THREE.MathUtils.smoothstep(e, .02, .32) : 0;      // frost forms at night and burns off after dawn
      const st = S.storm || (S.storm = { t: 0, next: 70 + Math.random() * 60, k: 0, base: S.scn.fog.density }); st.t += dt;
      if (!st.on && st.t > st.next) { st.on = 1; st.t = 0; ctx.toast('🌪 A dust storm is rolling in.<br><small>Real Martian storms can grow to cover the whole planet for weeks; Opportunity was lost to one in 2018.</small>', 5000); }
      if (st.on) { const T = 80; st.k = THREE.MathUtils.smoothstep(st.t, 0, 18) * (1 - THREE.MathUtils.smoothstep(st.t, T - 18, T)); if (st.t > T) { st.on = 0; st.t = 0; st.next = 140 + Math.random() * 120; st.k = 0; } }
      const k = st.k; S.scn.fog.density = st.base * (1 + 5 * k); const sc = new THREE.Color(.55, .36, .22).multiplyScalar(.25 + .75 * day); S.scn.fog.color.lerp(sc, k * .85); S.scn.background.copy(S.scn.fog.color); S.dl.intensity *= 1 - .7 * k; FOGSUN.value.w *= 1 + k;
      if (k > .02 && S.dust) for (let i = 0; i < dt * 140 * k; i++) S.dust.emit(new THREE.Vector3(P.x - 30 + Math.random() * 20, P.y + Math.random() * 7, P.z + (Math.random() - .5) * 50), new THREE.Vector3(16 + Math.random() * 8, (Math.random() - .3) * 2, 4 + Math.random() * 3), S.dc, 1.2 + Math.random() * 1.6, 2.2, 1, 1, { grow: 2, drag: .05, a: .22 * k });
    }
    if (id === 'titan') {   // methane drizzle: big slow drops (Titan's thick air and low gravity make rain fall about 1.6 m/s)
      if (!S.rain) { const N = 900, pos = new Float32Array(N * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8b888, transparent: true, opacity: .35, depthWrite: false })); ls.frustumCulled = false; S.scn.add(ls);
        const d = []; for (let i = 0; i < N; i++) d.push([(Math.random() - .5) * 60, Math.random() * 30, (Math.random() - .5) * 60]); S.rain = { ls, pos, d }; }
      const R = S.rain; for (let i = 0; i < R.d.length; i++) { const q = R.d[i]; q[1] -= dt * 1.6; q[0] += dt * .4; if (q[1] < -2) { q[1] = 28; q[0] = (Math.random() - .5) * 60; q[2] = (Math.random() - .5) * 60; }
        const x = P.x + q[0], y = P.y + q[1], z = P.z + q[2]; R.pos.set([x, y, z, x - .04, y + .35, z], i * 6); } R.ls.geometry.attributes.position.needsUpdate = true; }
    if (id === 'io') TU.lavaT.value = S.t; }
  function collect(c) { c.got = true; c.m.visible = false; if (S.fx) { S.fx.emit(c.m.position, new THREE.Vector3(0, 2, 0), c.sample ? 0x7df9ff : 0xffcf4a, .6, .9, 36, 9, { grow: .4, drag: .85 }); S.rings.add(c.m.position, c.sample ? 0x7df9ff : 0xffcf4a, 6, .7, ctx.cam.position); } c.gotSet.add(c.i); ctx.set(c.key, [...c.gotSet]); ctx.sfx(c.sample ? 'chime' : 'pop');
    if (c.sample) { ctx.reward(2, 25); ctx.toast(`🧪 <b>Science sample</b> +2 🔧<br><small>${c.fact}</small>`, 5200); } else { ctx.reward(1, 10); ctx.toast('⭐ Star fragment +1 🔧', 1400); }
    const left = S.cols.filter(x => !x.got).length; if (!left) { ctx.reward(15, 120); setTimeout(() => ctx.toast(`🏅 Everything collected on <b>${S.body.n}</b>! +15 🔧`, 3500), 1600); } }
  function stepDive(dt, inp) {
    const P = S.player, D = S.D; S.yaw -= inp.x * dt * 1.2; const desc = inp.jump ? -14 : 22 + (inp.run ? 30 : 0); S.depth = Math.max(0, S.depth + (inp.jump ? -40 : desc) * dt * 1.4);
    P.position.x += -Math.sin(S.yaw) * 20 * dt * (inp.y < -.2 ? 2 : 1); P.position.z += -Math.cos(S.yaw) * 20 * dt * (inp.y < -.2 ? 2 : 1); P.position.y = 0; P.rotation.set(-.6, S.yaw, 0);
    for (const c of S.clouds) { c.position.y += (inp.jump ? -60 : 50 + (inp.run ? 40 : 0)) * dt; if (c.position.y > 260) { c.position.y -= 520; c.position.x = P.position.x + (Math.random() - .5) * 700; c.position.z = P.position.z + (Math.random() - .5) * 700; } if (c.position.y < -260) c.position.y += 520; }
    const k = Math.min(1, S.depth / D.max), c0 = col(D.cols[0]).lerp(col(D.cols[3]), k).multiplyScalar(1 - k * .7); S.scn.background.copy(c0); S.scn.fog.color.copy(c0); S.scn.fog.far = 420 - k * 280;
    if (Math.random() < dt * (.3 + k)) { S.light.position.set(P.position.x + (Math.random() - .5) * 300, (Math.random() - .5) * 200, P.position.z + (Math.random() - .5) * 300); S.light.intensity = 4000; ctx.sfx('zap'); } S.light.intensity *= Math.pow(.02, dt);
    for (const o of S.orbs) { if (o.got) continue; const dd = o.depth - S.depth; o.m.visible = Math.abs(dd) < 160; o.m.position.set(P.position.x + Math.sin(o.i * 2.1) * 30, -dd * 1.5, P.position.z + Math.cos(o.i * 2.1) * 30 - 40);
      if (Math.abs(dd) < 18 && o.m.position.distanceTo(P.position) < 70) { o.got = true; o.m.visible = false; ctx.reward(3, 30); ctx.sfx('chime'); ctx.toast(`🧪 <b>Gas sample ${o.i + 1}/3</b> +3 🔧<br><small>${o.fact}</small>`, 5200); } }
    if (S.depth > D.max && !S.warn) { S.warn = 1; ctx.toast('⚠️ <b>Pressure critical!</b> Hold ⬆ CLIMB to get out!', 3000); ctx.sfx('alarm'); } if (S.depth < D.max * .9) S.warn = 0;
    if (S.depth > D.max * 1.25) { S.depth = D.max * .6; ctx.toast('💥 The pressure crushed the probe… a backup probe takes over.', 3000); ctx.sfx('boom'); }
    ctx.cam.position.lerp(new THREE.Vector3(P.position.x + Math.sin(S.yaw) * 14, 7, P.position.z + Math.cos(S.yaw) * 14), Math.min(1, dt * 6)); ctx.cam.lookAt(P.position.x, -4, P.position.z);
    return { depth: S.depth, max: D.max };
  }
  function exit() { FOGSUN.value.w = 0; if (S.fx) { S.fx.dispose(); S.dust.dispose(); S.fx = S.dust = null; S.grass = null; S.peb = null; } if (S.fly) { S.fly = null; S.craft = null; } if (S.player && S.player.userData.sh) S.player.userData.sh.scale.setScalar(1); S.on = false; if (S.scn) { S.scn.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } S.scn = null; S.items = []; S.cols = []; }
  return { S, enter, step, exit, fly, launch, drive, helmet: () => { S.helmet = S.helmet ? 0 : 1; return S.helmet; }, H: (x, z) => H(x, z) };
}
