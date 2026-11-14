// Photo-scanned rocks (Poly Haven, CC0): nine real rock scans, including Poly Haven's moon-rock set, scattered as boulder fields across the plain
// and as a carpet of stones that travels with the astronaut. Each scan keeps its own surface detail (colour, normal, roughness and
// cavity maps); the colour is normalised and tinted to the world's ground, so the same scans sit naturally on the Moon, Mars or Vesta.
import * as THREE from 'three';

const IDS = ['moon_rock_01', 'moon_rock_02', 'moon_rock_03', 'moon_rock_04', 'moon_rock_05', 'moon_rock_06', 'moon_rock_07', 'rock_07', 'rock_09'];
let LIB = null;
const lum = c => .2126 * c.r + .7152 * c.g + .0722 * c.b;

// average brightness of a scan's colour map (linear), so every rock can be normalised to the same albedo before tinting
function avgLum(tex) { try { const im = tex.image, cv = document.createElement('canvas'); cv.width = cv.height = 16; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 16, 16); const d = g.getImageData(0, 0, 16, 16).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) { const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; s += .2126 * f(d[i]) + .7152 * f(d[i + 1]) + .0722 * f(d[i + 2]); }
    return Math.max(.03, s / 256); } catch (e) { return .2; } }

function lib(loader) { if (LIB) return LIB;
  LIB = Promise.all(IDS.map(id => new Promise(res => loader.load(`models/rocks/${id}/${id}.gltf`, g => {
    const ms = []; g.scene.traverse(o => { if (o.isMesh) ms.push(o); }); if (!ms.length) return res(null); ms.sort((a, b) => a.name.localeCompare(b.name));
    const lod = ms.map(o => o.geometry), bb = new THREE.Box3().setFromBufferAttribute(lod[0].attributes.position), sz = bb.getSize(new THREE.Vector3()), k = 1 / Math.max(sz.x, sz.z, 1e-4);
    for (const geo of lod) { geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k, k); geo.computeBoundingSphere(); }
    const m = ms[0].material; res({ id, lod, h: sz.y * k, map: m.map, nrm: m.normalMap, arm: m.roughnessMap, L: m.map ? avgLum(m.map) : .2 });
  }, undefined, () => res(null))))).then(a => a.filter(Boolean));
  return LIB; }

// one material per scan per landing: the scan's maps, colour normalised to brightness 1 and partly desaturated, then tinted per instance
function rockMat(r, sat) { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: r.map, normalMap: r.nrm, roughnessMap: r.arm, aoMap: r.arm, aoMapIntensity: 1, roughness: 1, metalness: 0 });
  m.normalScale.setScalar(1.15); const gain = 1 / r.L, base = THREE.Material.prototype.onBeforeCompile;
  m.onBeforeCompile = function (sh, rr) { if (base) base.call(this, sh, rr); sh.uniforms.rdSat = { value: sat }; sh.uniforms.rdGain = { value: gain };
    sh.fragmentShader = 'uniform float rdSat; uniform float rdGain;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
      vec4 sdc = texture2D( map, vMapUv ); float sl = dot( sdc.rgb, vec3( .2126, .7152, .0722 ) ); sdc.rgb = mix( vec3( sl ), sdc.rgb, rdSat ) * rdGain; diffuseColor *= sdc;
    #endif`); };
  m.customProgramCacheKey = () => 'rdScanRock'; return m; }

const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

/* o: { H, Hn (fine height for the carpet), tint (THREE.Color, the ground albedo), sat, n (boulders), nc (carpet stones), area, avoid, alive () => bool } */
export function scanRocks(scene, loader, o) { const api = { ims: [], carpet: null, update() {}, dispose() { for (const im of api.ims) { im.removeFromParent(); im.material.dispose(); } api.ims.length = 0; } };
  lib(loader).then(L => { if (!L.length || (o.alive && !o.alive())) return; const { H, tint, area, avoid } = o, Hn = o.Hn || H, mats = L.map(r => rockMat(r, o.sat ?? .35));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), qy = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), nv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const pose = (hf, x, z, sc, r, i, sink) => { const ee = Math.max(.25, sc * .5), nx = hf(x - ee, z) - hf(x + ee, z), nz = hf(x, z - ee) - hf(x, z + ee); nv.set(nx, 2 * ee, nz).normalize(); qs.setFromUnitVectors(up, nv);
      e.set((hash(i, 3.3) - .5) * .5, hash(i, 7.7) * 6.283, (hash(i, 5.1) - .5) * .5); qy.setFromEuler(e); q.copy(qs).multiply(qy);
      s.set(sc * (.8 + hash(i, 9.9) * .45), sc * (.7 + hash(i, 4.4) * .6), sc * (.8 + hash(i, 6.6) * .45)); p.set(x, hf(x, z) - r.h * s.y * sink, z); return m4.compose(p, q, s); };
    const col = i => c.copy(tint).multiplyScalar(.72 + hash(i, 2.9) * .42);
    // boulder fields: a few clusters (ejecta blocks around impact sites) plus a sparse scatter; sizes follow a steep power law, so big ones are rare
    const fields = []; for (let i = 0; i < 7; i++) { const a = hash(i, 1.3) * 6.283, d = 60 + hash(i, 8.2) * (area - 140); fields.push([Math.cos(a) * d, Math.sin(a) * d, 14 + hash(i, 3.7) * 34]); }
    const big = L.map((r, k) => { const im = new THREE.InstancedMesh(r.lod[Math.min(1, r.lod.length - 1)], mats[k], Math.ceil(o.n / L.length) + 2); im.count = 0; im.castShadow = im.receiveShadow = true; return im; });
    const mid = L.map((r, k) => { const im = new THREE.InstancedMesh(r.lod[Math.min(2, r.lod.length - 1)], mats[k], Math.ceil(o.n * 2 / L.length) + 2); im.count = 0; im.castShadow = im.receiveShadow = true; return im; });
    for (let i = 0, tries = 0; i < o.n * 3 && tries < o.n * 12; tries++) { const t = tries; let x, z; if (hash(t, 11.1) < .45) { const f = fields[Math.floor(hash(t, 12.7) * fields.length)], a = hash(t, 13.3) * 6.283, d = Math.pow(hash(t, 14.9), .8) * f[2]; x = f[0] + Math.cos(a) * d; z = f[1] + Math.sin(a) * d; }
      else { const a = hash(t, 15.5) * 6.283, d = 18 + Math.pow(hash(t, 16.1), .9) * area; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      if (Math.abs(x) > area || Math.abs(z) > area || (avoid && avoid(x, z))) continue;
      const u = hash(t, 17.3), sc = u < .06 ? 2.2 + hash(t, 18.1) * 3.6 : .35 + Math.pow(hash(t, 19.7), 2.2) * 1.8, k = Math.floor(hash(t, 20.3) * L.length), im = (sc > 1.6 ? big : mid)[k];
      if (im.count >= im.instanceMatrix.count) continue; im.setMatrixAt(im.count, pose(H, x, z, sc, L[k], t, .18 + hash(t, 21.1) * .2)); im.setColorAt(im.count, col(t)); im.count++; i += sc > 1.6 ? 3 : 1; }
    for (const im of [...big, ...mid]) { if (!im.count) { im.dispose(); continue; } im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); scene.add(im); api.ims.push(im); }
    // the carpet: small scanned stones with fixed world positions, wrapping around the astronaut as they walk (the lowest-detail version of each scan)
    const R = 26, per = Math.ceil(o.nc / L.length), car = L.map((r, k) => { const im = new THREE.InstancedMesh(r.lod[r.lod.length - 1], mats[k], per); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im); api.ims.push(im); return im; });
    const off = []; for (let i = 0; i < per * L.length; i++) off.push([hash(i, 31.1) * 2 - 1, hash(i, 32.7) * 2 - 1, .05 + Math.pow(hash(i, 33.3), 2.6) * .42]);
    const wrap = (w, ctr) => ctr + ((((w - ctr) % (2 * R)) + 3 * R) % (2 * R)) - R; let cx = 1e9, cz = 1e9;
    const place = (px, pz) => { cx = px; cz = pz; for (let i = 0; i < off.length; i++) { const k = i % L.length, j = Math.floor(i / L.length), im = car[k], x = wrap(off[i][0] * R, px), z = wrap(off[i][1] * R, pz);
        let sc = off[i][2] * THREE.MathUtils.clamp((R - Math.hypot(x - px, z - pz)) / (R * .3), 0, 1); if (avoid && avoid(x, z)) sc = 0; if (sc < .01) { m4.makeScale(0, 0, 0); im.setMatrixAt(j, m4); continue; }
        im.setMatrixAt(j, pose(Hn, x, z, sc, L[k], i + 500, .25)); im.setColorAt(j, col(i + 500)); }
      for (const im of car) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; } };
    api.update = (px, pz) => { if (Math.hypot(px - cx, pz - cz) > 2.5) place(px, pz); };
  });
  return api; }
