// Red Dust Outpost · realistic planet shading for Adventure Mode.
// Physically-motivated, cheap: per-pixel sunlight with a soft terminator, real darkness on the night side,
// sun glint on oceans, sunset-coloured atmosphere at the day/night line, cloud lighting and planet shadows on rings.
// Costs only pixels on the few planets on screen, so it stays smooth on phones.
import * as THREE from 'three';

const SUN = new THREE.Color(1.0, 0.96, 0.9);
const COMMON_VS = `varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;

// surface: albedo map lit by the Sun; Earth gets ocean glint, city lights (when a night map is supplied) and sky colour at the limb
export function planetMaterial(map, o = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, night: { value: null }, hasNight: { value: 0 }, sunPos: { value: new THREE.Vector3() }, sunCol: { value: SUN.clone().multiplyScalar(o.sun || 1.55) },
      atmo: { value: new THREE.Color(o.atmo || 0x000000) }, atmoK: { value: o.atmoK || 0 }, ocean: { value: o.ocean ? 1 : 0 }, amb: { value: o.amb ?? .006 }, rough: { value: o.rough ?? 1 } },
    vertexShader: COMMON_VS,
    fragmentShader: `uniform sampler2D map; uniform sampler2D night; uniform float hasNight, atmoK, ocean, amb, rough; uniform vec3 sunPos, sunCol, atmo; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
    void main(){ vec3 N = normalize(vWN), L = normalize(sunPos - vWP), V = normalize(cameraPosition - vWP); float ndl = dot(N, L);
      vec3 alb = texture2D(map, vUv).rgb;
      // soft terminator (light wraps a little through the atmosphere), true dark night side
      float lit = clamp(ndl * .92 + .08 * smoothstep(-.18, .12, ndl), 0., 1.); float day = smoothstep(-.1, .2, ndl);
      // reddened light near the terminator: sunlight crosses more air at sunrise/sunset
      vec3 sc = mix(sunCol * vec3(1., .55, .32), sunCol, smoothstep(-.02, .35, ndl));
      vec3 col = alb * sc * lit + alb * amb;
      if (ocean > .5) { float water = smoothstep(.02, .12, alb.b - max(alb.r, alb.g) * .85); vec3 H = normalize(L + V); float sp = pow(max(dot(N, H), 0.), 160.) * 1.6 + pow(max(dot(N, H), 0.), 28.) * .05;
        col += sc * sp * water * day; col = mix(col, col * vec3(.82, .9, 1.05), water * .35); }
      if (hasNight > .5) { vec3 nl = texture2D(night, vUv).rgb; col += nl * nl * vec3(1., .78, .5) * 2.4 * (1. - smoothstep(-.12, .08, ndl)); }
      // in-scattered sky colour, strongest at the limb on the day side, orange along the terminator
      float fr = pow(1. - max(dot(N, V), 0.), 2.6), term = exp(-pow((ndl - .02) / .16, 2.));
      col += atmoK * (atmo * fr * smoothstep(-.2, .45, ndl) * 1.3 + vec3(1., .45, .18) * fr * term * .55);
      col = mix(col, col + atmo * .06 * atmoK, smoothstep(-.1, .5, ndl));
      gl_FragColor = vec4(col, 1.); }` });
  Object.defineProperty(m, 'map', { get() { return m.uniforms.map.value; }, set(v) { m.uniforms.map.value = v; } });
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
      float fw = pow(max(dot(-V, L), 0.), 8.) * .8;
      vec3 col = c * f * 1.7 * lit + vec3(1., .5, .2) * f * term * 1.1 + c * f * fw;
      gl_FragColor = vec4(col, clamp(f * (lit + term), 0., 1.)); }`,
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
  return new THREE.ShaderMaterial({ uniforms: { map: { value: map }, sunPos: { value: new THREE.Vector3() }, pc: { value: new THREE.Vector3() }, pr: { value: planetR }, sunCol: { value: SUN.clone().multiplyScalar(1.4) } },
    vertexShader: COMMON_VS,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunPos, pc, sunCol; uniform float pr; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
    void main(){ vec4 t = texture2D(map, vUv); vec3 L = normalize(sunPos - vWP), oc = pc - vWP; float tca = dot(oc, L), d2 = dot(oc, oc) - tca * tca;
      float sh = tca > 0. ? smoothstep(pr * pr * .92, pr * pr * 1.04, d2) : 1.; float back = abs(dot(normalize(vWN), L));
      gl_FragColor = vec4(t.rgb * sunCol * (.25 + .75 * back) * (.04 + .96 * sh), t.a); }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false });
}
// keep every planet shader's sun/planet positions current (call once per frame)
export function updatePlanetUniforms(list, sunPos) { for (const it of list) { const u = it.mat.uniforms; if (u.sunPos) u.sunPos.value.copy(sunPos); if (u.pc && it.mesh) it.mesh.getWorldPosition(u.pc.value); } }
