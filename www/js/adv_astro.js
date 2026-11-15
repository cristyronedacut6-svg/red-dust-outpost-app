// Red Dust Outpost · the astronaut.
// The body you see is NASA's Z-2 planetary walking suit (a real prototype built for the Moon and Mars; model from NASA 3D Resources).
// NASA publishes it as a statue: one frozen pose, no skeleton. So it is rigged here, when it loads: the mesh is split into its 43 separate
// pieces (torso, backpack, upper arms, forearms and gloves, legs, boots, visor…), each piece is bound to a joint, and the pieces that span a
// joint (knee, wrist, hip) are blended across it. The bubble visor gets its own mirror-gold material.
// A simple jointed figure built from primitives stands in until the suit has loaded, and stays if it cannot load.
// Both are driven by one procedural gait engine: a walk/run cycle that blends into the Apollo "bunny hop" lope in low gravity, idle breathing
// and weight shifts, airborne and jetpack poses, landing squash, leaning into turns and into acceleration.
// Front of the body faces +Z (the game rotates the player group to face the way it moves).
import * as THREE from 'three';

const { clamp, smoothstep } = THREE.MathUtils;
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

/* ---------------------------------------------------------------- the Z-2 suit, rigged at load ---------------------------------------------------------------- */
// joint centres in the suit's own space (metres; feet on y = 0, facing +Z), measured from the model. Left side is +x; the right mirrors it.
const ZJ = { hips: [0, .95, .01], waist: [0, 1.03, 0], sh: [.305, 1.43, .1], el: [.3, 1.265, .33], wr: [.285, 1.125, .52], hp: [.16, .88, .02], kn: [.19, .5, .03], an: [.205, .2, .02] };
// the statue holds its arms out in front, 57 degrees up from hanging: this much rotation at the shoulder lets them hang, and a turn of the forearm brings the palms in toward the legs
const ARM_DOWN = .99, PALM_IN = 1.05;
// bone order: 0 hips, 1 chest (hard torso, helmet, backpack), then per leg thigh/shin/foot (left 2-4, right 5-7), then per arm upper/forearm/hand (left 8-10, right 11-13)
let Z2 = null;
function loadZ2(loader) { if (!Z2) Z2 = new Promise(res => { loader.load('models/nasa/z2-spacesuit.glb', gl => { try { res(buildZ2(gl.scene)); } catch (e) { console.warn('Z-2 suit rig', e); res(null); } }, undefined, () => { Z2 = null; res(null); }); }); return Z2; }
function buildZ2(scene) { scene.updateMatrixWorld(true); let src = null; scene.traverse(o => { if (o.isMesh && (!src || o.geometry.attributes.position.count > src.geometry.attributes.position.count)) src = o; }); if (!src || !src.geometry.index) throw new Error('no mesh');
  // the file stores positions, normals and uvs as packed integers: unpack them into plain floats in the model's upright, metre-sized space
  const g0 = src.geometry, A = g0.attributes, n = A.position.count, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), v = new THREE.Vector3(), M = src.matrixWorld, NM = new THREE.Matrix3().getNormalMatrix(M); let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(A.position, i).applyMatrix4(M); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
    v.fromBufferAttribute(A.normal, i).applyMatrix3(NM).normalize(); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z; uv[i * 2] = A.uv.getX(i); uv[i * 2 + 1] = A.uv.getY(i); }
  if (y1 - y0 < 1.6 || y1 - y0 > 2.3) throw new Error('unexpected suit size'); for (let i = 0; i < n; i++) pos[i * 3 + 1] -= y0;
  // connected pieces: weld vertices that share a position, then join every triangle's corners
  const ix = g0.index.array, key = new Map(), wid = new Int32Array(n); let nw = 0;
  for (let i = 0; i < n; i++) { const k = Math.round(pos[i * 3] * 2e4) + ',' + Math.round(pos[i * 3 + 1] * 2e4) + ',' + Math.round(pos[i * 3 + 2] * 2e4); let w = key.get(k); if (w === undefined) { w = nw++; key.set(k, w); } wid[i] = w; }
  const par = new Int32Array(nw); for (let i = 0; i < nw; i++) par[i] = i; const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  for (let i = 0; i < ix.length; i += 3) { uni(wid[ix[i]], wid[ix[i + 1]]); uni(wid[ix[i + 1]], wid[ix[i + 2]]); }
  const comp = new Map(), cid = new Int32Array(n); for (let i = 0; i < n; i++) { const r = find(wid[i]); let c = comp.get(r); if (!c) { c = { lo: [9, 9, 9], hi: [-9, -9, -9] }; comp.set(r, c); } cid[i] = r; for (let k = 0; k < 3; k++) { const q = pos[i * 3 + k]; if (q < c.lo[k]) c.lo[k] = q; if (q > c.hi[k]) c.hi[k] = q; } }
  // what each piece is, from where it sits: boots, cuffs, legs, shorts, pelvis, arms; everything else rides the rigid torso
  for (const c of comp.values()) { const lo = c.lo, hi = c.hi, cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2; c.s = cx >= 0 ? 0 : 1;
    if (hi[1] < .3) c.k = hi[1] - lo[1] < .1 ? 'shin' : 'foot'; else if (hi[1] < .8 && lo[1] > .15) c.k = 'leg'; else if (hi[1] < 1.1 && lo[1] > .6 && (hi[0] < .02 || lo[0] > -.02)) c.k = 'shorts'; else if (hi[1] < 1.2 && lo[1] > .6) c.k = 'hips';
    else if (cz > .2 && Math.abs(cx) > .2 && hi[1] < 1.5) c.k = hi[2] > .5 ? 'fore' : 'upper'; else c.k = 'chest';
    c.visor = lo[1] > 1.5 && hi[1] < 1.86 && hi[2] > .24 && lo[2] > .04 && hi[0] - lo[0] > .3; }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), dust = new Float32Array(n), ax = [0, -.551, .835];
  for (let i = 0; i < n; i++) { const c = comp.get(cid[i]), x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], L = 2 + c.s * 3, Ar = 8 + c.s * 3; let a = 1, b = 1, w = 0;
    if (c.k === 'foot') a = b = L + 2; else if (c.k === 'shin') a = b = L + 1; else if (c.k === 'leg') { a = L; b = L + 1; w = smoothstep(.57 - y, 0, .13); }                 // thigh above the knee, shin below, blended across 13 cm
    else if (c.k === 'shorts') { a = 0; b = L; w = smoothstep(1 - y, 0, .2); } else if (c.k === 'hips') a = b = 0; else if (c.k === 'upper') a = b = Ar;
    else if (c.k === 'fore') { a = Ar + 1; b = Ar + 2; const s = c.s ? -1 : 1, t = (x - s * ZJ.el[0]) * ax[0] + (y - ZJ.el[1]) * ax[1] + (z - ZJ.el[2]) * ax[2]; w = smoothstep(t, .19, .26); }   // forearm, then the glove past the wrist
    si[i * 4] = a; si[i * 4 + 1] = b; sw[i * 4] = 1 - w; sw[i * 4 + 1] = w;
    dust[i] = Math.max(smoothstep(.95 - y, 0, .9) * .8, c.k === 'fore' ? w * .45 : 0); }                                                      // dust clings to boots and shins, and to the gloves
  // triangles: the suit first, the visor bubble last, so the two can wear different materials
  const main = [], vis = []; for (let i = 0; i < ix.length; i += 3) (comp.get(cid[ix[i]]).visor ? vis : main).push(ix[i], ix[i + 1], ix[i + 2]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); geo.setIndex(main.concat(vis)); geo.addGroup(0, main.length, 0); if (vis.length) geo.addGroup(main.length, vis.length, 1); geo.computeBoundingSphere();
  const suit = src.material.clone(); suit.vertexColors = true; suit.metalness = 0; suit.roughness = Math.max(suit.roughness || 0, .8); suit.envMapIntensity = .8;
  const visor = new THREE.MeshPhysicalMaterial({ color: 0xc8963a, metalness: 1, roughness: .07, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: .04, side: THREE.DoubleSide });
  return { geo, mats: [suit, visor], dust, n, ball: new THREE.SphereGeometry(1, 18, 12), fab: new THREE.MeshStandardMaterial({ color: 0xcfccc4, roughness: .92 }) }; }
// one astronaut from the shared suit: its own skeleton, and its own dust colour
function z2Rig(T) { const body = new THREE.Group(), Bn = () => new THREE.Bone(), J = ZJ, bones = [], inv = [], reg = (b, p) => { bones.push(b); inv.push(new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2])); return b; };
  const hips = reg(Bn(), J.hips); hips.position.set(...J.hips); body.add(hips); const spine = reg(Bn(), J.waist); spine.position.set(J.waist[0] - J.hips[0], J.waist[1] - J.hips[1], J.waist[2] - J.hips[2]); hips.add(spine);
  const neck = new THREE.Object3D(), head = new THREE.Object3D(); spine.add(neck); neck.add(head); const L = {};
  for (const [k, s] of [['lL', 1], ['lR', -1]]) { const P = q => [s * q[0], q[1], q[2]], hpP = P(J.hp), knP = P(J.kn), anP = P(J.an), hp = reg(Bn(), hpP), kn = reg(Bn(), knP), an = reg(Bn(), anP);
    hp.position.set(hpP[0] - J.hips[0], hpP[1] - J.hips[1], hpP[2] - J.hips[2]); hips.add(hp); kn.position.set(knP[0] - hpP[0], knP[1] - hpP[1], knP[2] - hpP[2]); hp.add(kn); an.position.set(anP[0] - knP[0], anP[1] - knP[1], anP[2] - knP[2]); kn.add(an); L[k] = { hp, kn, an }; }
  // arm: shoulder joint (driven by the gait) > upper arm (holds the fixed lowering) > elbow joint (driven) > forearm (holds the fixed palm-in turn about its own length) > hand
  for (const [k, s] of [['aL', 1], ['aR', -1]]) { const P = q => [s * q[0], q[1], q[2]], shP = P(J.sh), elP = P(J.el), wrP = P(J.wr), sh = Bn(), fix = reg(Bn(), shP), el = Bn(), tw = reg(Bn(), elP), wr = reg(Bn(), wrP);
    sh.position.set(shP[0] - J.waist[0], shP[1] - J.waist[1], shP[2] - J.waist[2]); spine.add(sh); sh.add(fix); el.position.set(elP[0] - shP[0], elP[1] - shP[1], elP[2] - shP[2]); fix.add(el); el.add(tw); wr.position.set(wrP[0] - elP[0], wrP[1] - elP[1], wrP[2] - elP[2]); tw.add(wr);
    fix.rotation.x = ARM_DOWN; tw.quaternion.setFromAxisAngle(new THREE.Vector3(wrP[0] - elP[0], wrP[1] - elP[1], wrP[2] - elP[2]).normalize(), -s * PALM_IN); L[k] = { sh, el, wr };
    // soft joint covers: the statue's shoulder sockets and elbows are open tubes, which would gape once the arm moves, so a fabric ball sits in each
    const cs = new THREE.Mesh(T.ball, T.fab); cs.position.copy(sh.position); cs.scale.setScalar(.122); cs.castShadow = true; spine.add(cs); const ce = new THREE.Mesh(T.ball, T.fab); ce.scale.setScalar(.088); ce.castShadow = true; el.add(ce); }
  const g = new THREE.BufferGeometry(); for (const k in T.geo.attributes) g.setAttribute(k, T.geo.attributes[k]); g.setIndex(T.geo.index); for (const gr of T.geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex); g.boundingSphere = T.geo.boundingSphere;
  const col = new Float32Array(T.n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.SkinnedMesh(g, T.mats); mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4()); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  // the life-support read-out on the backpack: oxygen and jetpack fuel as two rows of lit segments, the way you would check a partner's suit
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const hudM = new THREE.Mesh(new THREE.PlaneGeometry(.17, .085), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.7, 1.7, 1.7) })), bez = new THREE.Mesh(new THREE.BoxGeometry(.19, .105, .018), new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: .5, metalness: .6 }));
  bez.position.set(0, 1.33 - J.waist[1], -.418); hudM.position.set(0, 1.33 - J.waist[1], -.4285); hudM.rotation.y = Math.PI; spine.add(bez); spine.add(hudM); bez.castShadow = true; let hk = '';
  const hud = (o2, jet, hasJet) => { const a = Math.round(clamp(o2, 0, 1) * 8), b = hasJet ? Math.round(clamp(jet, 0, 1) * 8) : -1, k = a + '/' + b; if (k === hk) return; hk = k; const c = cv.getContext('2d'); c.fillStyle = '#04090c'; c.fillRect(0, 0, 128, 64);
    const row = (y, lab, nOn, on, low) => { c.fillStyle = nOn <= 2 ? low : on; c.font = '700 15px ui-monospace,Menlo,monospace'; c.textBaseline = 'middle'; c.fillText(lab, 6, y + 1); for (let i = 0; i < 8; i++) { c.globalAlpha = i < nOn ? 1 : .16; c.fillRect(36 + i * 11, y - 8, 8, 16); } c.globalAlpha = 1; };
    row(b < 0 ? 32 : 19, 'O2', a, '#7df9ff', '#ff6a5a'); if (b >= 0) row(46, 'JT', b, '#ffcf4a', '#ff6a5a'); tex.needsUpdate = true; }; hud(1, 1, true);
  const tint = c => { const d = T.dust; for (let i = 0; i < T.n; i++) { const k = d[i]; col[i * 3] = 1 + (c.r * 1.25 - 1) * k; col[i * 3 + 1] = 1 + (c.g * 1.25 - 1) * k; col[i * 3 + 2] = 1 + (c.b * 1.25 - 1) * k; } g.attributes.color.needsUpdate = true; };
  return { body, mesh, hud, tint, J: { body, hips, spine, neck, head, L }, dispose() { g.dispose(); tex.dispose(); hudM.geometry.dispose(); hudM.material.dispose(); bez.geometry.dispose(); bez.material.dispose(); mesh.skeleton.dispose(); } }; }

/* ---------------------------------------------------------------- the astronaut ---------------------------------------------------------------- */
// o.loader: a GLTF loader (with the mesh decoder set). Given one, the Z-2 suit replaces the stand-in figure as soon as it has loaded.
export function makeAstronaut(o = {}) {
  const suit = new THREE.MeshStandardMaterial({ color: o.suit || 0xeeeeea, roughness: .82, normalMap: fabricNormal(), normalScale: new THREE.Vector2(.35, .35) });
  const soft = new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: .9 }), metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: .35, metalness: .85, envMap: visorEnv(), envMapIntensity: .8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: .6, metalness: .3 }), red = new THREE.MeshStandardMaterial({ color: 0xc8322c, roughness: .7 });
  const visor = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: .06, metalness: 1, envMap: visorEnv(), envMapIntensity: 1.6 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: .25, metalness: .05, envMap: visorEnv(), envMapIntensity: .5 });
  const M = (geo, mat, x = 0, y = 0, z = 0, p) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (p || null) && p.add(m); return m; };
  const Jn = (p, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); p.add(j); return j; };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14), ring = (r, t) => new THREE.TorusGeometry(r, t, 8, 22);

  const root = new THREE.Group(), body = Jn(root, 0, 0, 0), hips = Jn(body, 0, .98, 0);
  // pelvis and the soft lower torso
  { const p = M(cap(.16, .12), suit, 0, .02, 0, hips); p.rotation.z = Math.PI / 2; p.scale.set(1, 1.25, .95); M(ring(.19, .025), metal, 0, .12, 0, hips).rotation.x = Math.PI / 2; }
  const spine = Jn(hips, 0, .12, 0), chest = Jn(spine, 0, .14, 0);
  { const t = M(cap(.2, .22), suit, 0, .16, 0, chest); t.scale.set(1.18, 1, .82);
    M(new THREE.BoxGeometry(.24, .13, .09), soft, 0, .2, .17, chest); M(new THREE.BoxGeometry(.2, .03, .02), dark, 0, .24, .22, chest);           // display & control module on the chest
    for (let i = 0; i < 4; i++) M(new THREE.CylinderGeometry(.012, .012, .02, 8), [red, metal, dark, metal][i], -.07 + i * .045, .17, .22, chest).rotation.x = Math.PI / 2;
    M(new THREE.BoxGeometry(.44, .56, .22), shell, 0, .2, -.22, chest);                                                                             // life-support backpack (PLSS)
    M(new THREE.BoxGeometry(.4, .1, .18), soft, 0, .52, -.22, chest); M(new THREE.CylinderGeometry(.025, .025, .5, 8), metal, .2, .2, -.12, chest); M(new THREE.CylinderGeometry(.025, .025, .5, 8), metal, -.2, .2, -.12, chest);
    M(new THREE.BoxGeometry(.06, .035, .002), red, -.13, .33, .17, chest); }                                                                          // mission patch
  const neck = Jn(chest, 0, .44, 0); M(ring(.13, .03), metal, 0, 0, 0, neck).rotation.x = Math.PI / 2;
  const head = Jn(neck, 0, .02, 0);
  { M(new THREE.SphereGeometry(.2, 28, 20), shell, 0, .19, -.015, head);
    M(new THREE.SphereGeometry(.203, 28, 20, -Math.PI * .42, Math.PI * .84, Math.PI * .2, Math.PI * .46), visor, 0, .19, .0, head);                // gold sun visor, front
    M(new THREE.BoxGeometry(.06, .025, .03), dark, .14, .32, .05, head); M(new THREE.BoxGeometry(.06, .025, .03), dark, -.14, .32, .05, head); }  // helmet lights
  const arm = s => { const sh = Jn(chest, s * .27, .35, 0); M(ring(.075, .022), metal, 0, 0, 0, sh).rotation.z = Math.PI / 2; M(new THREE.SphereGeometry(.085, 14, 10), suit, 0, -.02, 0, sh);
    M(cap(.07, .18), suit, 0, -.15, 0, sh); const el = Jn(sh, 0, -.3, 0); M(new THREE.SphereGeometry(.068, 12, 8), suit, 0, 0, 0, el); M(cap(.062, .17), suit, 0, -.13, 0, el);
    const wr = Jn(el, 0, -.27, 0); M(ring(.055, .016), metal, 0, 0, 0, wr).rotation.x = Math.PI / 2; M(new THREE.BoxGeometry(.075, .11, .05), soft, 0, -.07, .005, wr);
    M(new THREE.BoxGeometry(.03, .05, .04), soft, s * .045, -.05, .02, wr); return { sh, el, wr }; };
  const leg = s => { const hp = Jn(hips, s * .1, -.02, 0); M(cap(.09, .26), suit, 0, -.2, 0, hp); const kn = Jn(hp, 0, -.44, 0); M(new THREE.SphereGeometry(.085, 12, 8), suit, 0, 0, .01, kn);
    M(cap(.078, .26), suit, 0, -.2, 0, kn); const an = Jn(kn, 0, -.43, 0); M(ring(.07, .018), metal, 0, -.02, 0, an).rotation.x = Math.PI / 2;
    M(new THREE.BoxGeometry(.13, .1, .28), soft, 0, -.06, .045, an); M(new THREE.BoxGeometry(.135, .025, .29), dark, 0, -.105, .045, an); return { hp, kn, an }; };
  // R: the joints the gait engine drives. It starts as the stand-in figure and is swapped for the Z-2's skeleton when that arrives.
  let R = { body, hips, spine, neck, head, L: { aL: arm(1), aR: arm(-1), lL: leg(1), lR: leg(-1) }, abd: 0, elb: 0 }, Z = null, dustC = null;
  const api = { root, update, z2: false, hud() {}, tint(c) { dustC = c.clone(); if (Z) Z.tint(dustC); }, dispose() { api.dead = true; if (Z) Z.dispose(); } };
  // the Z-2 stands on the same spot: its joints live inside the same 'body' group, so everything that reads the body (helmet camera, bob) still works
  if (o.loader) api.ready = loadZ2(o.loader).then(T => { if (!T || api.dead) return false; Z = z2Rig(T); hips.visible = false; while (Z.body.children.length) body.add(Z.body.children[0]); root.add(Z.mesh);
    R = { body, hips: Z.J.hips, spine: Z.J.spine, neck: Z.J.neck, head: Z.J.head, L: Z.J.L, abd: .1, elb: .1 }; cur.clear(); api.z2 = true; api.hud = Z.hud; api.spine = Z.J.spine; if (dustC) Z.tint(dustC); return true; }).catch(e => { console.warn('Z-2 suit', e); return false; });

  // ---- gait engine ----
  const st = { ph: 0, air: 0, land: 0, yawPrev: null, bank: 0, t: 0, jet: 0, spd: 0, acc: 0 }, cur = new Map();
  const set = (obj, ax, v, k) => { const key = obj.uuid + ax, c = cur.has(key) ? cur.get(key) : 0, n = c + (v - c) * k; cur.set(key, n); obj.rotation[ax] = n; };
  function update(dt, s) { const { hips, spine, neck, head, L } = R;
    // s: { spd (m/s, horizontal), ground, g, run (bool), hold (jetpack burning), yaw, landed (downward speed at touchdown), seat }
    if (s.seat) { const k = Math.min(1, dt * 6); body.position.y += (-.62 - body.position.y) * k; body.rotation.z = 0; set(hips, 'x', -.12, k); set(hips, 'y', 0, k); set(hips, 'z', 0, k); set(spine, 'x', .08, k); set(spine, 'y', 0, k); set(neck, 'x', .02, k);
      for (const lg of [L.lL, L.lR]) { set(lg.hp, 'x', -1.45, k); set(lg.hp, 'z', lg === L.lL ? .08 : -.08, k); set(lg.kn, 'x', 1.5, k); set(lg.an, 'x', -.05, k); }
      set(L.aL.sh, 'x', -.75, k); set(L.aL.sh, 'z', .12 + R.abd, k); set(L.aL.el, 'x', -.7, k); set(L.aR.sh, 'x', -.35, k); set(L.aR.sh, 'z', -.25 - R.abd, k); set(L.aR.el, 'x', -.5, k); set(L.aL.wr, 'x', 0, k); set(L.aR.wr, 'x', 0, k); return; }
    st.t += dt; const g = s.g ?? 9.81, low = clamp((9.81 - g) / 8.2, 0, 1), run = s.run ? 1 : 0, spd = s.spd || 0;
    const mv = smoothstep(spd, .25, 1.4), k = Math.min(1, dt * 14);
    st.air += ((s.ground ? 0 : 1) - st.air) * Math.min(1, dt * (s.ground ? 12 : 6)); st.land = Math.max(0, st.land - dt * 3.2); st.jet += ((s.hold && !s.ground ? 1 : 0) - st.jet) * Math.min(1, dt * 5);
    if (s.landed) st.land = Math.min(1, Math.abs(s.landed) / 9);
    // speeding up tips the body forward, braking tips it back (a person leans into the push)
    if (dt > 0) { st.acc += (clamp((spd - st.spd) / Math.max(dt, 1e-3), -14, 14) - st.acc) * Math.min(1, dt * 5); st.spd = spd; }
    // walking is always a real alternating stride (legs 180° apart), a little longer and floatier in low gravity; only sprinting in low
    // gravity turns into the Apollo "bunny hop" lope with the feet nearly together. (Letting all low-gravity walking hop made the legs
    // swing together and slide over the ground, so the astronaut looked as if it glided instead of walking.)
    const lope = low * run;
    const stride = (2.3 + run * 1.6) * (1 + low * .55 + lope * .45); if (s.ground) st.ph = (st.ph + dt * spd / stride * Math.PI * 2) % (Math.PI * 200);
    const off = Math.PI * (1 - lope * .78);              // left/right phase offset: 180° walking, near-together hops when loping
    const pL = st.ph, pR = st.ph + off, A = (.46 + run * .26) * (1 - lope * .2), K = 1.0 + run * .5;
    const hipA = p => -A * Math.sin(p), kneeA = p => .12 + K * Math.pow(Math.max(0, Math.cos(p)), 1.6) * (1 - lope * .35) + lope * .35 * Math.max(0, -Math.sin(p * 2 - .4));
    const w = mv * (1 - st.air), id = (1 - mv) * (1 - st.air), ai = st.air, jt = st.jet;
    // turning: bank into the turn like a person does
    if (s.yaw != null) { if (st.yawPrev != null) { let dy = s.yaw - st.yawPrev; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; st.bank += (clamp(-dy / Math.max(dt, 1e-3) * .06 * mv, -.22, .22) - st.bank) * Math.min(1, dt * 6); } st.yawPrev = s.yaw; }
    const breathe = Math.sin(st.t * 1.7), sway = Math.sin(st.t * .41) * Math.sin(st.t * .13 + 1), bob = w * ((.03 + run * .02) * Math.cos(st.ph * 2) * (1 - low) + low * (1 - lope) * .07 * Math.abs(Math.sin(st.ph)) + lope * (.12 + run * .1) * Math.abs(Math.sin(st.ph))) - st.land * .16 - id * .005 * (1 - breathe);
    body.position.y += (bob - body.position.y) * k; body.rotation.z += (st.bank - body.rotation.z) * k;
    const lean = w * (.06 + run * .12 + low * .14) + ai * .05 + st.land * .25 + st.acc * .011 * (1 - ai) + jt * .14;
    // standing still is never still: breathing, and the weight drifting from one leg to the other
    set(hips, 'x', lean * .4, k); set(hips, 'y', w * .09 * Math.sin(pL) * (1 - lope), k); set(hips, 'z', w * .035 * Math.cos(pL) * (1 - lope) + id * .022 * sway, k);
    set(spine, 'x', lean * .6 + id * .015 * breathe + jt * .008 * Math.sin(st.t * 43), k); set(spine, 'y', -w * .12 * Math.sin(pL) * (1 - lope), k); set(spine, 'z', -id * .016 * sway, k);
    set(neck, 'x', -lean * .7, k); set(head, 'y', id * .35 * Math.sin(st.t * .23) * Math.sin(st.t * .11), Math.min(1, dt * 2)); set(head, 'x', id * .06 * Math.sin(st.t * .17), Math.min(1, dt * 2));
    for (const [lg, p, sg] of [[L.lL, pL, 1], [L.lR, pR, -1]]) {
      const hw = hipA(p) * w, kw = kneeA(p) * w, first = lg === L.lL;
      // in the air: a jump tucks one leg more than the other; on the jetpack both hang loose under the thrust
      const hipT = hw + ai * ((first ? -.45 : -.15) * (1 - jt) - .2 * jt) - st.land * .55, kneeT = kw + ai * ((first ? .75 : .4) * (1 - jt) + .5 * jt) + id * (.05 + .03 * sg * sway) + st.land * 1.05;
      set(lg.hp, 'x', hipT, k); set(lg.hp, 'z', sg * (.04 + ai * .08 + low * .05 * w), k); set(lg.kn, 'x', kneeT, k);
      set(lg.an, 'x', -(hipT + kneeT) * .75 + w * .25 * Math.max(0, Math.sin(p + .9)) - ai * (.15 + .25 * jt), k); }
    for (const [am, p, sgn] of [[L.aL, pR, 1], [L.aR, pL, -1]]) {
      const swing = -(.32 + run * .3) * Math.sin(p) * (1 - lope * .5) * w;
      set(am.sh, 'x', swing + id * (.04 + .015 * breathe) + ai * .18 - low * .25 * w + st.land * -.3, k);
      set(am.sh, 'z', sgn * (.16 + R.abd + low * .22 * w + ai * (.55 - .2 * jt) + id * .02 * breathe), k);   // the bulky suit holds the arms a little away from the body
      set(am.el, 'x', -(.28 + R.elb + run * .55 + low * .35 * w) * Math.max(w, id * .8) - ai * .35 - jt * .2, k); set(am.wr, 'x', -.1 - run * .2 * w, k); }
  }
  return api;
}
