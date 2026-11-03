// Red Dust Outpost · Adventure VFX: GPU particles, warp streaks, shockwave rings, rocks and wind-swept grass
import * as THREE from 'three';

// soft round particle sprite drawn on a canvas
let SOFT = null;
function soft() { if (SOFT) return SOFT; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.75)'); gr.addColorStop(.6, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SOFT = new THREE.CanvasTexture(c); SOFT.colorSpace = THREE.SRGBColorSpace; return SOFT; }

// One particle pool per scene. emit() spawns, update() simulates (drag, gravity, growth, fade) on the CPU and uploads once per frame.
export function makeFX(scene, max = 3000, additive = true) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), dat = new Float32Array(max * 2), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('dat', new THREE.BufferAttribute(dat, 2).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: soft() }, scale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: true,
    vertexShader: 'attribute vec2 dat; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); vA = dat.y * smoothstep(.6, 3.5, -mv.z); gl_PointSize = clamp(dat.x * scale / max(.1,-mv.z), 0., 256.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); if (gl_FragColor.a < .004) discard; }' });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const P = []; for (let i = 0; i < max; i++) P.push({ life: 0 }); let head = 0; const tc = new THREE.Color();
  function emit(p, v, color, size, life, n = 1, spread = 0, o = {}) { tc.set(color);
    for (let k = 0; k < n; k++) { const q = P[head]; head = (head + 1) % max;
      q.x = p.x + (Math.random() - .5) * (o.jit || 0); q.y = p.y + (Math.random() - .5) * (o.jit || 0); q.z = p.z + (Math.random() - .5) * (o.jit || 0);
      q.vx = v.x + (Math.random() - .5) * spread; q.vy = v.y + (Math.random() - .5) * spread; q.vz = v.z + (Math.random() - .5) * spread;
      q.r = tc.r; q.g = tc.g; q.b = tc.b; q.s0 = size * (.7 + Math.random() * .6); q.grow = o.grow || 1; q.life = q.max = life * (.7 + Math.random() * .6); q.grav = o.grav || 0; q.drag = o.drag ?? .6; q.a = o.a ?? 1; q.fadeIn = o.fadeIn || 0; } }
  function update(dt, cam, h) { if (cam) mat.uniforms.scale.value = (h || innerHeight) / (2 * Math.tan(cam.fov * Math.PI / 360));
    for (let i = 0; i < max; i++) { const q = P[i]; if (q.life <= 0) { dat[i * 2 + 1] = 0; continue; } q.life -= dt; const k = Math.max(0, q.life / q.max), dr = Math.pow(1 - Math.min(.99, q.drag), dt);
      q.vx *= dr; q.vy = q.vy * dr - q.grav * dt; q.vz *= dr; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z; col[i * 3] = q.r; col[i * 3 + 1] = q.g; col[i * 3 + 2] = q.b;
      const age = 1 - k; dat[i * 2] = q.s0 * (1 + age * (q.grow - 1)); dat[i * 2 + 1] = q.a * k * (q.fadeIn ? Math.min(1, age / q.fadeIn) : 1); }
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.dat.needsUpdate = true; }
  return { emit, update, pts, dispose() { scene.remove(pts); g.dispose(); mat.dispose(); } };
}

// expanding glowing ring (scan complete, landing shockwave, collect)
export function makeRings(scene) { const L = [], geo = new THREE.RingGeometry(.86, 1, 64);
  return { add(p, color, r1 = 6, life = .8, face = null) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.copy(p); if (face) m.lookAt(face); else m.rotation.x = -Math.PI / 2; scene.add(m); L.push({ m, t: 0, life, r1 }); },
    update(dt) { for (let i = L.length - 1; i >= 0; i--) { const r = L[i]; r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(.2 + k * r.r1); r.m.material.opacity = .9 * (1 - k) * (1 - k); if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); L.splice(i, 1); } } } }; }

// warp streaks: thin bright lines that rush past the camera at high speed
export function makeWarp(scene, n = 260) { const pos = new Float32Array(n * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), ls = new THREE.LineSegments(g, m); ls.frustumCulled = false; scene.add(ls);
  const S = []; for (let i = 0; i < n; i++) S.push(new THREE.Vector3((Math.random() - .5) * 60, (Math.random() - .5) * 40, -Math.random() * 120));
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  return { update(dt, cam, speed, vel) { const k = THREE.MathUtils.clamp((speed - 70) / 160, 0, 1); m.opacity += (k * .55 - m.opacity) * Math.min(1, dt * 4); ls.visible = m.opacity > .01; if (!ls.visible) return;
    const len = 2 + k * 14; for (let i = 0; i < n; i++) { const s = S[i]; s.z += speed * dt * .6; if (s.z > 8) { s.set((Math.random() - .5) * 60, (Math.random() - .5) * 40, -120); if (Math.abs(s.x) < 4 && Math.abs(s.y) < 3) s.x += 8; }
      tmp.copy(s).applyQuaternion(cam.quaternion).add(cam.position); tmp2.set(s.x, s.y, s.z - len).applyQuaternion(cam.quaternion).add(cam.position); pos.set([tmp.x, tmp.y, tmp.z, tmp2.x, tmp2.y, tmp2.z], i * 6); }
    g.attributes.position.needsUpdate = true; } }; }

// cinematic grade: vignette, gentle chromatic aberration at the edges, film grain, contrast and saturation lift
export const CineShader = { uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .26 }, ca: { value: .0007 }, grain: { value: .012 }, sat: { value: 1.12 }, con: { value: 1.06 }, warm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, ca, grain, sat, con, warm; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time*7.13) * 43758.5453); }
  void main(){ vec2 d = vUv - .5; float r2 = dot(d,d); vec2 o = d * ca * (1. + r2 * 4.);
    vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
    float l = dot(c, vec3(.2126,.7152,.0722)); c = mix(vec3(l), c, sat); c = (c - .5) * con + .5; c += vec3(.02,.008,-.012) * warm;
    c *= 1. - vig * smoothstep(.12, .75, r2 * 2.); c += (h(vUv * 913.) - .5) * grain; gl_FragColor = vec4(max(c, 0.), 1.); }` };

// scattered rocks: three lumpy rock shapes, instanced in the hundreds, following the terrain height
function rockGeo(seed) { const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 2) * .22 + Math.sin(v.z * 5.3 + seed * 3) * .1 + Math.sin((v.x + v.z) * 9 + seed) * .04; v.multiplyScalar(1 + n); v.y *= .62; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; }
export function scatterRocks(scene, H, color, count, area, avoid) { const mat = new THREE.MeshStandardMaterial({ color, roughness: .93, metalness: .02, flatShading: false }), out = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let k = 0; k < 3; k++) { const n = Math.floor(count / 3), im = new THREE.InstancedMesh(rockGeo(k * 1.7 + 1), mat, n); im.castShadow = im.receiveShadow = true; let j = 0;
    for (let i = 0; i < n * 3 && j < n; i++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * area, x = Math.cos(a) * d, z = Math.sin(a) * d; if (avoid && avoid(x, z)) continue;
      const big = Math.random() < .06, sc = big ? 1.6 + Math.random() * 3 : .12 + Math.pow(Math.random(), 2.2) * 1.1; e.set(Math.random() * .4, Math.random() * 6.28, Math.random() * .4); q.setFromEuler(e); s.set(sc * (.8 + Math.random() * .5), sc, sc * (.8 + Math.random() * .5)); p.set(x, H(x, z) + sc * .12, z);
      m4.compose(p, q, s); im.setMatrixAt(j++, m4); im.setColorAt(j - 1, new THREE.Color(color).multiplyScalar(.75 + Math.random() * .45)); }
    im.count = j; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im); out.push(im); }
  return out; }

// wind-swept grass: thousands of tapered blades, swaying in a vertex shader; clustered around the player so it always surrounds you
export function makeGrass(scene, H, n = 26000, R = 70, avoid) { const blade = new THREE.PlaneGeometry(.09, .7, 1, 4); blade.translate(0, .35, 0); const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i) / .7; bp.setX(i, bp.getX(i) * (1 - y * .9)); } blade.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, side: THREE.DoubleSide }); const U = { time: { value: 0 } };
  mat.onBeforeCompile = sh => { sh.uniforms.time = U.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float hgt = position.y / .7; vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); float w = sin(time*1.7 + wp.x*.35 + wp.z*.21) * .5 + sin(time*3.1 + wp.x*.9) * .2; transformed.x += w * hgt * hgt * .35; transformed.z += w * hgt * hgt * .18;`);
  };
  const im = new THREE.InstancedMesh(blade, mat, n); im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color(), off = []; for (let i = 0; i < n; i++) off.push([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 6.28, .6 + Math.random() * .9, Math.random()]);
  let cx = 1e9, cz = 1e9;
  const wrap = (w, c) => c + ((((w - c) % (2 * R)) + 3 * R) % (2 * R)) - R;
  function place(px, pz) { cx = px; cz = pz; for (let i = 0; i < n; i++) { const o = off[i], x = wrap(o[0] * R, px), z = wrap(o[1] * R, pz); const dd = Math.hypot(x - px, z - pz); let sc = o[3] * THREE.MathUtils.clamp((R - dd) / (R * .35), 0, 1); if (avoid && avoid(x, z)) sc = 0;
      e.set(0, o[2], (o[4] - .5) * .3); q.setFromEuler(e); s.set(sc, sc * (.8 + o[4] * .7), sc); p.set(x, H(x, z) - .02, z); m4.compose(p, q, s); im.setMatrixAt(i, m4); c.setHSL(.22 + o[4] * .05, .38 + o[4] * .15, .17 + o[4] * .09); im.setColorAt(i, c); }
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  return { im, update(dt, t, px, pz) { U.time.value = t; if (Math.hypot(px - cx, pz - cz) > 3) place(px, pz); } }; }
