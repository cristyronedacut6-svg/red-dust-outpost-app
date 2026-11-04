// Red Dust Outpost · realistic planet shading for Adventure Mode.
// Physically-motivated, cheap: per-pixel sunlight with a soft terminator, real darkness on the night side,
// sun glint on oceans, sunset-coloured atmosphere at the day/night line, cloud lighting and planet shadows on rings.
// Costs only pixels on the few planets on screen, so it stays smooth on phones.
import * as THREE from 'three';

const SUN = new THREE.Color(1.0, 0.96, 0.9);
// the player's ship as a tiny occluder: its shadow falls on moons, planets and rings when you fly low (shared by every planet shader)
export const OCCS = { value: new THREE.Vector4(0, 0, 0, 0) };
const COMMON_VS = `varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;

// surface: albedo map lit by the Sun; Earth gets ocean glint, city lights (when a night map is supplied) and sky colour at the limb
export function planetMaterial(map, o = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, night: { value: null }, hasNight: { value: 0 }, sunPos: { value: new THREE.Vector3() }, sunCol: { value: SUN.clone().multiplyScalar(o.sun || 1.55) },
      atmo: { value: new THREE.Color(o.atmo || 0x000000) }, atmoK: { value: o.atmoK || 0 }, flow: { value: o.flow || 0 }, time: { value: 0 }, occ: { value: new THREE.Vector4(0, 0, 0, 0) }, occ2: { value: new THREE.Vector4(0, 0, 0, 0) }, ringMap: { value: null }, hasRing: { value: 0 }, ringN: { value: new THREE.Vector3(0, 1, 0) }, ringC: { value: new THREE.Vector3() }, ringR: { value: new THREE.Vector2(1, 2) }, occS: OCCS, grs: { value: new THREE.Vector4(0, 0, 0, 0) }, storm: { value: 0 }, ocean: { value: o.ocean ? 1 : 0 }, amb: { value: o.amb ?? .006 }, rough: { value: o.rough ?? 1 } },
    vertexShader: COMMON_VS,
    fragmentShader: `uniform sampler2D map; uniform sampler2D night; uniform float hasNight, atmoK, ocean, amb, rough, flow, time; uniform vec4 occ, occ2;
    uniform vec4 occS, grs; uniform float storm; float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    uniform sampler2D ringMap; uniform float hasRing; uniform vec3 ringN, ringC; uniform vec2 ringR;
    // the rings' own shadow on the planet: follow the ray toward the Sun to the ring plane and read how opaque the ring is there
    float ringShadow(vec3 p, vec3 L){ if (hasRing < .5) return 1.; float dn = dot(L, ringN); if (abs(dn) < 1e-4) return 1.; float t = dot(ringC - p, ringN) / dn; if (t <= 0.) return 1.;
      float r = length(p + L * t - ringC), u = (r - ringR.x) / (ringR.y - ringR.x); if (u < 0. || u > 1.) return 1.; return 1. - texture2D(ringMap, vec2(u, .5)).a * .88; }
    float eclipse(vec4 o, vec3 p, vec3 L){ if (o.w <= 0.) return 1.; vec3 oc = o.xyz - p; float tca = dot(oc, L); if (tca < 0.) return 1.; float d2 = dot(oc, oc) - tca * tca, r2 = o.w * o.w; return smoothstep(r2 * .78, r2 * 1.18, d2); } uniform vec3 sunPos, sunCol, atmo; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
    void main(){ vec3 N = normalize(vWN), L = normalize(sunPos - vWP), V = normalize(cameraPosition - vWP); float ndl = dot(N, L);
      vec3 alb;
      if (flow > 0.) { float T = 40., f1 = fract(time / T), f2 = fract(time / T + .5), w = abs(1. - 2. * f1);
        float sp = flow * (sin(vUv.y * 61.) * .6 + sin(vUv.y * 23. + 1.3) * .4) * .004;   // alternating jet streams, east and west
        vec3 a1 = texture2D(map, vec2(vUv.x + sp * f1 * T, vUv.y)).rgb, a2 = texture2D(map, vec2(vUv.x + sp * f2 * T, vUv.y)).rgb; alb = mix(a1, a2, w); }
      else alb = texture2D(map, vUv).rgb;
      if (grs.w > 0.) { vec2 q = vec2((vUv.x - grs.x) * 2., vUv.y - grs.y) / grs.z; q.x *= .55; float r = length(q);   // an oval about twice as wide as tall
        if (r < 1.6) { float ang = (1. - smoothstep(0., 1.4, r)) * (time * .35 + 3.) , cs = cos(ang), sn = sin(ang); vec2 rq = mat2(cs, -sn, sn, cs) * q; rq.x /= .55;
          vec2 uv2 = vec2(grs.x + rq.x * grs.z * .5, grs.y + rq.y * grs.z); vec3 sw = texture2D(map, uv2).rgb, sw2 = texture2D(map, uv2 * 1.7 + .31).rgb; float m = smoothstep(1.1, .55, r);
          float arms = .5 + .5 * sin(atan(rq.y, rq.x) * 2. + r * 6. - time * .2);   // two soft spiral cloud arms, not rings
          vec3 red = mix(vec3(.72, .36, .22), vec3(.86, .52, .34), arms * .6 + dot(sw2, vec3(.33)) * .4); alb = mix(alb, mix(sw, red * (.75 + .45 * dot(sw, vec3(.33))), .55), m * grs.w);
          alb = mix(alb, alb * vec3(1.1, 1.0, .9), smoothstep(1.6, 1.15, r) * (1. - m)); } }   // pale collar around the storm
      // soft terminator (light wraps a little through the atmosphere), true dark night side
      float sh = eclipse(occ, vWP, L) * eclipse(occ2, vWP, L) * ringShadow(vWP, L) * (.35 + .65 * eclipse(occS, vWP, L));   // a planet's shadow on its moons, a moon's shadow on its planet
      float lit = clamp(ndl * .92 + .08 * smoothstep(-.18, .12, ndl), 0., 1.) * sh; float day = smoothstep(-.1, .2, ndl) * sh;
      // reddened light near the terminator: sunlight crosses more air at sunrise/sunset
      vec3 sc = mix(sunCol * vec3(1., .55, .32), sunCol, smoothstep(-.02, .35, ndl));
      vec3 col = alb * sc * lit + alb * amb;
      if (ocean > .5) { float water = smoothstep(.02, .12, alb.b - max(alb.r, alb.g) * .85); vec3 H = normalize(L + V); float sp = pow(max(dot(N, H), 0.), 160.) * 1.6 + pow(max(dot(N, H), 0.), 28.) * .05;
        col += sc * sp * water * day; col = mix(col, col * vec3(.82, .9, 1.05), water * .35); }
      if (hasNight > .5) { vec3 nl = texture2D(night, vUv).rgb; col += nl * nl * vec3(1., .78, .5) * 2.4 * (1. - smoothstep(-.12, .08, ndl)); }
      if (storm > 0.) { vec2 cell = floor(vUv * vec2(90., 45.)); float tk = floor(time * 3.), h = hsh(cell + tk * 1.37);
        if (h > .9965) { vec2 f = fract(vUv * vec2(90., 45.)) - .5; float fl = exp(-dot(f, f) * 14.) * (1. - fract(time * 3.)) * hsh(cell + tk);   // a flash lights the cloud from inside
          col += vec3(.75, .82, 1.) * fl * 2.2 * storm * (1. - smoothstep(-.15, .05, ndl)); } }
      // in-scattered sky colour, strongest at the limb on the day side, orange along the terminator
      float fr = pow(1. - max(dot(N, V), 0.), 2.6), term = exp(-pow((ndl - .02) / .16, 2.));
      col += atmoK * (atmo * fr * smoothstep(-.2, .45, ndl) * 1.3 + vec3(1., .45, .18) * fr * term * .55);
      col = mix(col, col + atmo * .06 * atmoK, smoothstep(-.1, .5, ndl));
      gl_FragColor = vec4(col, 1.); }` });
  Object.defineProperty(m, 'map', { get() { return m.uniforms.map.value; }, set(v) { if (v && v.wrapS !== THREE.RepeatWrapping) { v.wrapS = THREE.RepeatWrapping; v.needsUpdate = true; } m.uniforms.map.value = v; } });
  return m;
}
// outer atmosphere shell (additive): glows on the lit limb, turns orange at the terminator, fades away on the night side
export function atmosphereMaterial(color, power = 4) {
  return new THREE.ShaderMaterial({ uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, sunPos: { value: new THREE.Vector3() } },
    vertexShader: COMMON_VS,
    fragmentShader: `uniform vec3 c, sunPos; uniform float p; varying vec3 vWN; varying vec3 vWP;
    void main(){ vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP), L = normalize(sunPos - vWP); float ndl = dot(N, L);
      float f = pow(1. - max(dot(N, V), 0.), p), lit = smoothstep(-.35, .3, ndl), term = exp(-pow((ndl + .05) / .2, 2.));
      // forward scattering: the limb blazes when you look toward the Sun through the air
      float fw = pow(max(dot(-V, L), 0.), 6.) * 2.6;
      vec3 col = c * f * 1.7 * lit + vec3(1., .5, .2) * f * term * 1.1 + mix(c, vec3(1., .72, .45), .45) * f * fw;
      gl_FragColor = vec4(col, clamp(f * (lit + term + fw), 0., 1.)); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}
// clouds: white alpha layer lit by the Sun, pink-orange at the terminator, invisible at night
export function cloudMaterial(map) {
  const m = new THREE.ShaderMaterial({ uniforms: { map: { value: map }, sunPos: { value: new THREE.Vector3() }, sunCol: { value: SUN.clone().multiplyScalar(1.5) } },
    vertexShader: COMMON_VS,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunPos, sunCol; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
    void main(){ vec4 t = texture2D(map, vUv); vec3 N = normalize(vWN), L = normalize(sunPos - vWP); float ndl = dot(N, L);
      float lit = clamp(ndl * .9 + .1 * smoothstep(-.15, .1, ndl), 0., 1.); vec3 sc = mix(sunCol * vec3(1., .5, .3), sunCol, smoothstep(0., .3, ndl));
      gl_FragColor = vec4(t.rgb * sc * lit + .004, t.a * (.25 + .75 * smoothstep(-.25, .1, ndl))); }`,
    transparent: true, depthWrite: false });
  return m;
}
// rings: lit from the Sun, with the planet's shadow falling across them
export function ringMaterial(map, planetR) {
  return new THREE.ShaderMaterial({ uniforms: { occS: OCCS, map: { value: map }, sunPos: { value: new THREE.Vector3() }, pc: { value: new THREE.Vector3() }, pr: { value: planetR }, sunCol: { value: SUN.clone().multiplyScalar(1.4) } },
    vertexShader: COMMON_VS,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunPos, pc, sunCol; uniform float pr; uniform vec4 occS; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
    void main(){ vec4 t = texture2D(map, vUv); vec3 L = normalize(sunPos - vWP), oc = pc - vWP; float tca = dot(oc, L), d2 = dot(oc, oc) - tca * tca;
      float sh = tca > 0. ? smoothstep(pr * pr * .92, pr * pr * 1.04, d2) : 1.; float back = abs(dot(normalize(vWN), L));
      if (occS.w > 0.) { vec3 o2 = occS.xyz - vWP; float t2 = dot(o2, L), d2s = dot(o2, o2) - t2 * t2; if (t2 > 0.) sh *= .3 + .7 * smoothstep(occS.w * occS.w * .6, occS.w * occS.w * 1.3, d2s); }
      gl_FragColor = vec4(t.rgb * sunCol * (.25 + .75 * back) * (.04 + .96 * sh), t.a); }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false });
}
// keep every planet shader's sun/planet positions current (call once per frame)
export function updatePlanetUniforms(list, sunPos, time = 0) { for (const it of list) { const u = it.mat.uniforms; if (u.time) u.time.value = time; if (u.sunPos) u.sunPos.value.copy(sunPos); if (u.pc && it.mesh) it.mesh.getWorldPosition(u.pc.value); if (it.ring) { it.ring.getWorldPosition(u.ringC.value); u.ringN.value.set(0, 0, 1).transformDirection(it.ring.matrixWorld); } } }

// the Sun: boiling granulation, dark sunspots, limb darkening and an HDR core that drives the bloom
const NOISE3 = `vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return -1. + 2. * fract(sin(p) * 43758.5453); }
float noise3(vec3 p){ vec3 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x), mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x), mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z); }`;
export function sunMaterial() {
  return new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN = normalize(normal); vP = position; vec4 w = modelMatrix * vec4(position,1.); vV = normalize(cameraPosition - w.xyz); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE3 + `uniform float time; varying vec3 vN; varying vec3 vP; varying vec3 vV;
    void main(){ vec3 p = normalize(vP); float t = time * .05;
      float g = noise3(p * 18. + t * 1.7) * .5 + noise3(p * 40. - t * 2.3) * .3 + noise3(p * 90. + t * 3.1) * .2;      // granulation
      float big = noise3(p * 3. + vec3(t * .3, 0., -t * .2)); float spots = smoothstep(.42, .55, big) * smoothstep(.0, .3, noise3(p * 7. + 4.));
      float mu = max(dot(normalize(vN), normalize(vV)), 0.); float limb = pow(mu, .45);                                    // limb darkening
      vec3 hot = vec3(1.0, .82, .45), warm = vec3(1.0, .42, .08);
      vec3 col = mix(warm, hot, .5 + g * 1.1) * (1.25 + g * 1.1) * mix(.3, 1., limb); col *= 1. - spots * .85;
      col += warm * pow(1. - mu, 3.) * .6;
      gl_FragColor = vec4(col, 1.); }` }); }
// corona: flickering additive shell around the Sun
export function coronaMaterial() {
  return new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE3 + `uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vV;
    void main(){ float mu = abs(dot(normalize(vN), normalize(vV))); float rim = pow(mu, 2.2); vec3 p = normalize(vP);
      float fl = noise3(p * 6. + vec3(0., time * .08, 0.)) * .5 + noise3(p * 14. - time * .12) * .5;
      float a = rim * (.55 + fl * .9); gl_FragColor = vec4(vec3(1., .62, .25) * a * 1.4, a); }` }); }
