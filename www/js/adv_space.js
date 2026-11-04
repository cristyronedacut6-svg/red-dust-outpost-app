// Red Dust Outpost · Adventure realism pass 11: things real space has that make it feel alive.
// Solar prominences, a real two-tailed comet, polar auroras, and the ice chunks that actually make up Saturn's rings.
import * as THREE from 'three';
import { makeFX, rockGeo } from './adv_fx.js';

const NZ = `float h1(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.), f * f * (3. - 2. * f)); }`;

/* prominences: arches of glowing plasma that rise off the Sun's limb along magnetic field lines and slowly flow */
export function makeProminences(sun, r, n = 7) {
  const U = { time: { value: 0 } }, mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: NZ + `uniform float time; varying vec2 vUv;
    void main(){ float a = vUv.x, ring = sin(vUv.y * 3.14159);
      float flow = n1(a * 22. - time * 1.6) * .6 + n1(a * 55. + time * 2.3) * .4, strand = .55 + .45 * n1(vUv.y * 9. + a * 6. + time * .4);
      float ends = smoothstep(0., .08, a) * smoothstep(1., .92, a), core = pow(ring, 1.5);
      vec3 c = mix(vec3(1., .25, .05), vec3(1., .75, .35), flow * core) * (1.6 + 2.4 * flow * core);
      gl_FragColor = vec4(c, ends * core * strand * (.35 + .65 * flow)); }` });
  const g = new THREE.Group(); sun.add(g); const L = [];
  for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2 + Math.random() * .5, ph = (Math.random() - .5) * 1.6, span = .12 + Math.random() * .22, hgt = r * (.12 + Math.random() * .22);
    const base = (t) => new THREE.Vector3(Math.cos(ph) * Math.cos(th + t), Math.sin(ph), Math.cos(ph) * Math.sin(th + t));
    const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24, d = base((u - .5) * span * 2); const lift = Math.sin(u * Math.PI) * hgt * (1 + .25 * Math.sin(u * 9 + i)); pts.push(d.multiplyScalar(r * .985 + lift)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r * (.012 + Math.random() * .014), 8, false), mat); tube.userData.ph = Math.random() * 6.28; g.add(tube); L.push(tube); }
  return { update(dt, t) { U.time.value = t; for (const m of L) m.scale.setScalar(1 + Math.sin(t * .15 + m.userData.ph) * .06); } };
}

/* aurora: curtains of light around the magnetic poles, brightest on the night side (Earth green/red, the giants violet) */
export function makeAurora(planet, r, c1, c2, tilt = 0) {
  const U = { time: { value: 0 }, sunPos: { value: new THREE.Vector3() }, pc: { value: new THREE.Vector3() }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: NZ + `uniform float time; uniform vec3 sunPos, pc, c1, c2; varying vec2 vUv; varying vec3 vWP;
    void main(){ float a = vUv.x * 6.2832, h = vUv.y;
      float rays = n1(a * 28. + time * .7) * .6 + n1(a * 71. - time * 1.3) * .4, fold = .5 + .5 * sin(a * 5. + time * .3 + n1(a * 3. + time * .1) * 4.);
      float vert = smoothstep(0., .12, h) * pow(1. - h, 1.6), night = 1. - smoothstep(-.25, .35, dot(normalize(vWP - pc), normalize(sunPos - pc)));
      vec3 c = mix(c1, c2, smoothstep(.45, 1., h));
      gl_FragColor = vec4(c * 2.2, vert * (.25 + .75 * rays) * (.4 + .6 * fold) * (.25 + .75 * night)); }` });
  const g = new THREE.Group(); g.rotation.z = tilt; planet.add(g);
  for (const s of [1, -1]) { const lat = 1.18, rr = r * Math.cos(lat) * 1.02, y = r * Math.sin(lat) * 1.02, hh = r * .1;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.05, rr, hh, 96, 1, true), mat); m.position.y = s * (y + hh * .45); if (s < 0) m.rotation.x = Math.PI; g.add(m); }
  return { update(dt, t, sun) { U.time.value = t; U.sunPos.value.copy(sun); planet.getWorldPosition(U.pc.value); } };
}

/* comet: icy nucleus on a long elliptical orbit. Near the Sun it wakes up: a glowing coma, a straight blue ion tail
   pointing exactly away from the Sun (blown by the solar wind) and a curved yellow-white dust tail lagging behind its path. */
export function makeComet(scn, sunPos, o = {}) {
  const q = o.q || 300, Q = o.Q || 1700, a = (q + Q) / 2, e = (Q - q) / (Q + q), T = o.T || 520, inc = o.inc ?? .35, w = o.w ?? 2.4;
  const g = new THREE.Group(); scn.add(g);
  const nuc = new THREE.Mesh(rockGeo(7), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 })); nuc.scale.set(1.6, 1.1, 1.2); g.add(nuc);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(230,255,250,1)'); gr.addColorStop(.2, 'rgba(160,230,220,.45)'); gr.addColorStop(1, 'rgba(120,200,200,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); g.add(coma);
  const ion = makeFX(scn, 1400, true), dust = makeFX(scn, 1400, true), rot = new THREE.Matrix4().makeRotationY(w).multiply(new THREE.Matrix4().makeRotationX(inc));
  const pos = new THREE.Vector3(), prev = new THREE.Vector3(), vel = new THREE.Vector3(), away = new THREE.Vector3(), tmp = new THREE.Vector3(); let M = o.M0 ?? 5.5, first = true;
  function kepler(M) { let E = M; for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E); return pos.set(x, 0, y).applyMatrix4(rot).add(sunPos); }
  return { g, pos, n: 'Comet', update(dt, cam) { prev.copy(pos); M = (M + dt * Math.PI * 2 / T) % (Math.PI * 2); kepler(M); g.position.copy(pos); if (first) { prev.copy(pos); first = false; }
      vel.copy(pos).sub(prev).divideScalar(Math.max(dt, 1e-4)); nuc.rotation.y += dt * .3; nuc.rotation.x += dt * .11;
      const rs = pos.distanceTo(sunPos), act = THREE.MathUtils.clamp((1750 - rs) / 1100, 0, 1);   // ices sublimate as it nears the Sun (game distances are compressed)
      coma.scale.setScalar(6 + act * 26); coma.material.opacity = .25 + act * .75; away.copy(pos).sub(sunPos).normalize();
      if (act > .02) { const k = dt * 90 * act;
        for (let i = 0; i < k; i++) { ion.emit(pos, tmp.copy(away).multiplyScalar(70 + Math.random() * 40), 0x6fb8ff, 2.2 + act * 3, 4 + act * 3, 1, 3, { drag: 0, grow: 2.2, a: .55 });
          dust.emit(pos, tmp.copy(away).multiplyScalar(14 + Math.random() * 12).addScaledVector(vel, -.35), 0xfff0d0, 3 + act * 4, 6 + act * 4, 1, 5, { drag: .02, grow: 2.6, a: .4 }); } }
      ion.update(dt, cam); dust.update(dt, cam); } };
}

/* Saturn's rings up close: when you fly into the ring plane, thousands of tumbling ice chunks appear around you,
   only where the ring is actually dense (the Cassini Division stays empty). One instanced draw call. */
export function makeRingField(ring, rIn, rOut, alphaAt, n = 1400) {
  const geo = rockGeo(3), mat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: .55, metalness: 0, emissive: 0x111111 });
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.visible = false; ring.add(im);
  const S = 70, off = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), loc = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const big = Math.random() < .06; off.push({ x: (Math.random() - .5) * S, y: (Math.random() - .5) * S, z: (Math.random() - .5) * (big ? 1.6 : .9), s: big ? .35 + Math.random() * .6 : .03 + Math.pow(Math.random(), 3) * .25, r: [Math.random() * 6, Math.random() * 6, Math.random() * 6], w: (Math.random() - .5) * .8 }); }
  return { ring: true, update(dt, t, shipWorld) { loc.copy(shipWorld); ring.worldToLocal(loc); const rad = Math.hypot(loc.x, loc.y);
      // ring local units are scaled with the planet; show only near the plane and inside the ring band
      const near = Math.abs(loc.z) < 26 && rad > rIn - S * .5 && rad < rOut + S * .5; im.visible = near; if (!near) return;
      for (let i = 0; i < n; i++) { const o = off[i]; p.set(o.x + S * Math.round((loc.x - o.x) / S), o.y + S * Math.round((loc.y - o.y) / S), o.z);
        const rr = Math.hypot(p.x, p.y), u = (rr - rIn) / (rOut - rIn), al = u < 0 || u > 1 ? 0 : alphaAt(u), d = Math.hypot(p.x - loc.x, p.y - loc.y), fade = THREE.MathUtils.smoothstep(S * .5, S * .38, d);
        const s = o.s * (al > .12 ? 1 : 0) * fade; e.set(o.r[0] + t * o.w, o.r[1] + t * o.w * .7, o.r[2]); q.setFromEuler(e); sc.set(s, s * .8, s * .9); m4.compose(p, q, sc); im.setMatrixAt(i, m4); }
      im.instanceMatrix.needsUpdate = true; } };
}
