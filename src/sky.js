// MEGA CLAWD · SKY (owner: world) — painted skies, towering cumulus, the cloud layer, the stratosphere and the Earth.
//   coast  : high-key summer sky (deep ultramarine zenith -> pale cyan horizon, warm toward the sun, sun disc) blending to a
//            warm colourful dusk over 63-66 s; a ring of towering sculpted cumulus (src/sky-clouds.js) over the hills and the
//            sea + fair-weather cumulus; first stars at dusk.
//   sky    : the same sky seen from 0.5-4 km: a field of cumulus whose tops sit at ~2.6-3.6 km (the giant climbs through
//            them, s21), the MASSIF (a cumulus wall the meteor splits in two, s17) and the sea far below.
//   strato / space : local frame, altitude = y. A painted Earth (ocean, cloud fields, haze) under a bright limb band and a
//            deep-blue (strato) / black (space) sky. VISUAL radius R = 1000 km (exaggerated curvature).
// API (ctx.modules.sky):
//   R                         visual Earth radius used by the strato / space domes (m)
//   sunDir()                  coast sun direction [x, y, z] (= the engine's day look)
//   cloudTop                  top of the sky-set cloud field (m)
//   anchor(name) -> Vector3   'massif' (centre of the cumulus wall, sky set), 'massifTop'
//   dusk(t) -> 0..1           day -> dusk blend for the coast (62.6-64.0 s; ocean, cat and cams/world.js follow it)
//   setSplit(k)               0..1: part the massif into two walls (default: driven by time over s17, kept split after)
//   setHot(pos, color, r)     a hot light inside the clouds (the meteor's glow), reset every frame by update()
//   coastClouds / skyClouds   the cloud systems; their painted key is aimed per frame in afterCamera (CLOUD_KEY overrides)
//   s05 / s07: the sky asks ctx.modules.meteor.sky() to draw the far meteor (white streak / orange point) at S05_STREAK /
//   S07_GLOW and paints an orange halo around the s07 point in the dome
import * as THREE from 'three';
import { createCloudSystem, cumulusTower, cumulusPuff, CLOUD_DAY, CLOUD_DUSK, lerpPalette } from './sky-clouds.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);
const DAY = { zen: 0x1648c0, hi: 0x2a66dc, mid: 0x5c9ef2, low: 0x9ccdfb, hor: 0xdcf0ff, horSun: 0xf4f8ff, sun: 0xfff4dc, wisp: 0.55 };
const DUSK = { zen: 0x2a2c86, hi: 0x5246a8, mid: 0xa070b8, low: 0xf2967e, hor: 0xf4a6a0, horSun: 0xffd28a, sun: 0xffc070, wisp: 0.8 };
const DUSK_T0 = 62.6, DUSK_T1 = 64.0;
// s05: the streak travels ~100 px down-left over the shot (world directions from the s05 camera, above the massif)
const S05_STREAK = [0.455, 0.71, 0.537], S05_STREAK_END = [0.53, 0.648, 0.522];
// s07: the glowing point (upper left of the frame) creeps ~40 px over the shot, so it reads as something moving
const S07_GLOW = [-0.735, 0.63, -0.253], S07_GLOW_END = [-0.7565, 0.6096, -0.2479], S07_TAIL = [0.716, 0.679, -0.169];   // falls down-left, tail up-right (s07 screen)
// painted cloud key per shot: the towers always show a lit white (dusk: peach-gold) mass, even when the camera faces the sun
const CLOUD_KEY = {};
const slerpDir = (a, b, k) => new V3().fromArray(a).normalize().lerp(new V3().fromArray(b).normalize(), k).normalize().toArray();
const HIGH = { zen: 0x0f3cb4, hi: 0x2058d4, mid: 0x4a90ee, low: 0x9ccaf8, hor: 0xe6f4ff, horSun: 0xfff8ea, sun: 0xfff8e8, wisp: 0.3 };

function skyDome(ctx, pal) {
  const { glsl } = ctx;
  const u = { uSunDir: { value: new V3(0.3, 0.62, 0.72).normalize() }, uSunCol: { value: C(pal.sun) }, uSunR: { value: 0.0105 }, uWisp: { value: pal.wisp },
    uZen: { value: C(pal.zen) }, uHi: { value: C(pal.hi) }, uMid: { value: C(pal.mid) }, uLow: { value: C(pal.low) }, uHor: { value: C(pal.hor) }, uHorSun: { value: C(pal.horSun) }, uSunK: { value: 1 },
    uHot: { value: new THREE.Vector4(0, 1, 0, 0) }, uHotCol: { value: C(0xff7a2a) }, uHotTail: { value: new V3(0, 1, 0) } };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: u,
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${glsl.NOISE}
      uniform vec3 uSunDir, uSunCol, uZen, uHi, uMid, uLow, uHor, uHorSun, uHotCol, uHotTail; uniform float uSunR, uWisp, uSunK; uniform vec4 uHot; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float e = d.y;
        float sa = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5, sd = dot(d, uSunDir);
        // brushed banding (seamless: noise on the direction, stretched across elevation)
        float bs = (n3(d * vec3(5.0, 70.0, 5.0)) - 0.5) * 0.6 + (n3(d * vec3(20.0, 240.0, 20.0) + 7.0) - 0.5) * 0.4;
        float ee = e + bs * 0.006;
        vec3 hor = mix(uHor, uHorSun, pow(sa, 4.0) * 0.75 + pow(max(sd, 0.0), 5.0) * 0.5);
        vec3 col = mix(hor, uLow, smoothstep(-0.01, 0.07, ee));
        col = mix(col, uMid, smoothstep(0.05, 0.24, ee)); col = mix(col, uHi, smoothstep(0.2, 0.52, ee)); col = mix(col, uZen, smoothstep(0.48, 0.95, ee));
        col = mix(col, mix(uLow, uHorSun, 0.5), pow(max(sd, 0.0), 14.0) * 0.45 * (1.0 - smoothstep(0.1, 0.5, e)));
        col *= 1.0 + bs * 0.035;
        // high cirrus wisps: long brushed streaks, thin, sun-warmed
        vec2 pp = d.xz / max(e + 0.08, 0.03), wp = vec2(dot(pp, vec2(0.8, 0.6)), dot(pp, vec2(-0.6, 0.8)));   // cirrus plane, wind-stretched
        float w = fbm2(wp * vec2(0.45, 2.2) + 3.0) + 0.3 * fbm2(wp * vec2(1.8, 8.8));
        float wm = smoothstep(0.72, 0.86, w) * smoothstep(0.08, 0.2, e) * (1.0 - smoothstep(0.45, 0.75, e)) * uWisp;
        col = mix(col, mix(vec3(1.0), uHorSun, 0.35) * (0.9 + 0.2 * sa), wm * 0.55);
        // sun: crisp disc + glow
        float a = acos(clamp(sd, -1.0, 1.0));
        col += uSunCol * uSunK * (smoothstep(uSunR * 1.12, uSunR * 0.95, a) * 7.0 + exp(-a * 7.0) * 0.35 + exp(-a * 30.0) * 0.6);
        // a hot point of the sky (the meteor still far away, s07): a wide pale-gold veil (lightens the blue, never muddies it
        // toward magenta), then a smooth warm-orange radial halo, no ring edge
        if (uHot.w > 0.0) { float ha = acos(clamp(dot(d, uHot.xyz), -1.0, 1.0));
          col = mix(col, vec3(1.0, 0.93, 0.8), clamp(exp(-ha * 14.0) * 0.32 * uHot.w, 0.0, 1.0));
          col = mix(col, uHotCol * (1.1 + 1.6 * exp(-ha * 70.0)), clamp((exp(-ha * 42.0) * 0.7 + exp(-ha * 95.0) * 0.4) * uHot.w, 0.0, 0.95));
          // its short burning tail (back along its path): a tapered warm streak with a soft glow, so it reads as moving
          vec3 T = uHotTail, HT = uHot.xyz - T; float sk = clamp(dot(d - T, HT) / max(dot(HT, HT), 1e-8), 0.0, 1.0), dl = length(d - T - HT * sk);
          float tw = mix(0.0008, 0.0048, sk);
          col = mix(col, mix(uHotCol, vec3(1.0, 0.92, 0.65), sk * sk) * (1.1 + sk), clamp((smoothstep(tw, tw * 0.4, dl) + exp(-dl / (tw * 2.5)) * 0.45) * pow(sk, 0.9) * uHot.w, 0.0, 0.97)); }
        gl_FragColor = vec4(col, 1.0); }` });
  glsl.mrt(m, { id: 0, sky: true });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50000, 64, 32), m); dome.frustumCulled = false; dome.renderOrder = -10; dome.raycast = () => {};
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  dome.setHot = (dir, k, col = 0xff7a2a, tail = null) => { if (!dir || !(k > 0)) { u.uHot.value.w = 0; return; } const v = new V3().fromArray(dir).normalize(); u.uHot.value.set(v.x, v.y, v.z, k); u.uHotCol.value.set(col);
    u.uHotTail.value.copy(tail ? new V3().fromArray(tail).normalize() : v); };
  dome.setPal = (p) => { for (const k of ['zen', 'hi', 'mid', 'low', 'hor', 'horSun']) u['u' + k[0].toUpperCase() + k.slice(1)].value.copy(p[k]); u.uSunCol.value.copy(p.sun); u.uWisp.value = p.wisp; };
  return dome;
}
const lerpPal = (a, b, k) => { const o = {}; for (const key of ['zen', 'hi', 'mid', 'low', 'hor', 'horSun', 'sun']) o[key] = C(a[key]).lerp(C(b[key]), k); o.wisp = a.wisp + (b.wisp - a.wisp) * k; return o; };

// Earth seen from the stratosphere / space: analytic sphere (visual radius R). Painted, saturated: deep-blue ocean with
// current streaks, a coastline (island chain, shallows), cloud systems (cumulus fields + one spiral storm in view of s22),
// and crisp limb bands (white line, cyan, deep blue) instead of an airbrushed glow.
function earthDome(ctx, R, { zen, mid, limb, hot, space }) {
  const { glsl } = ctx;
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uR: { value: R }, uSun: { value: new V3(0.5, 0.35, 0.8).normalize() }, uZen: { value: C(zen) }, uMidC: { value: C(mid) }, uLimb: { value: C(limb) }, uHot: { value: C(hot) },
      uSpace: { value: space }, uOcean: { value: C(0x0d3aa6) }, uOcean2: { value: C(0x1d62cc) }, uShallow: { value: C(0x2aa6c8) }, uLand: { value: C(0x4f8a46) }, uLand2: { value: C(0xb89a64) },
      uCyan: { value: C(0x6ad4ff) }, uCloud: { value: C(0xffffff) }, uCloudSh: { value: C(0x9aa4e0) }, uNight: { value: C(0x0c1436) },
      uStorm: { value: new V3(-0.09, 0.993, -0.07).normalize() } },
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${glsl.NOISE}
      uniform float uR, uSpace; uniform vec3 uSun, uZen, uMidC, uLimb, uHot, uOcean, uOcean2, uShallow, uLand, uLand2, uCyan, uCloud, uCloudSh, uNight, uStorm; varying vec3 vD;
      // cloud systems (~40 km) broken into cumulus fields (~8 km) and puffs (~2 km), plus a spiral storm
      float clouds(vec3 p){
        float c = fbm3(p * 24.0) * 0.55 + fbm3(p * 110.0 + 4.0) * 0.3 + fbm3(p * 480.0 + 9.0) * 0.15;
        vec3 q = p - uStorm * dot(p, uStorm); vec3 ta = normalize(cross(uStorm, vec3(0.0, 0.0, 1.0))), tb = cross(uStorm, ta);
        vec2 l = vec2(dot(q, ta), dot(q, tb)) / 0.034; float r = length(l), a = atan(l.y, l.x);
        float arms = sin(a * 2.0 + log(max(r, 0.02)) * 5.0) * 0.5 + 0.5;
        float storm = (smoothstep(1.0, 0.35, r) * (0.45 + 0.55 * arms) + smoothstep(0.18, 0.08, r) * 0.6) * (1.0 - smoothstep(0.03, 0.0, r) * 0.9);
        return max(c, 0.42 + storm * 0.3 + (fbm3(p * 300.0) - 0.5) * 0.08 * storm); }
      void main(){ vec3 d = normalize(vD); vec3 o = cameraPosition + vec3(0.0, uR, 0.0); float r0 = length(o); vec3 up = o / r0;
        float hc = -sqrt(max(0.0, 1.0 - uR * uR / (r0 * r0))), e = dot(d, up), above = e - hc, k = above / (1.0 - hc);
        float sa = dot(normalize(d - up * e + 1e-5), normalize(uSun - up * dot(uSun, up) + 1e-5)) * 0.5 + 0.5;
        float bn = n3(d * 90.0) - 0.5;
        // sky over the limb: crisp painted bands (white line, cyan, deep blue) on the zenith colour + a faint airglow
        vec3 col = mix(uMidC, uZen, smoothstep(0.08, mix(0.5, 0.3, uSpace), k));
        col = mix(col, mix(uMidC, uCyan, 0.35), smoothstep(0.072, 0.064, above + bn * 0.003));
        col = mix(col, uCyan, smoothstep(0.028, 0.023, above + bn * 0.002));
        col = mix(col, uLimb, smoothstep(0.0085, 0.0065, above));
        col += uHot * exp(-max(above, 0.0) * mix(60.0, 200.0, uSpace)) * 0.12 * (0.7 + 0.5 * sa);
        float b = dot(o, d), c = r0 * r0 - uR * uR, disc = b * b - c;
        if (disc > 0.0 && -b - sqrt(disc) > 0.0) {
          vec3 p = normalize(o + d * (-b - sqrt(disc)));
          float below = -above, lit = smoothstep(-0.08, 0.12, dot(p, uSun));
          // ocean: deep saturated blue, painted current streaks
          vec3 s = mix(uOcean, uOcean2, smoothstep(0.4, 0.75, fbm3(p * vec3(40.0, 40.0, 120.0))) * 0.7);
          // coastline hint: an island chain with shallows
          float ln = fbm3(p * 16.0 + 2.0) * 0.75 + fbm3(p * 90.0 + 7.0) * 0.25;
          s = mix(s, uShallow, smoothstep(0.585, 0.615, ln) * 0.8);
          s = mix(s, mix(uLand, uLand2, smoothstep(0.45, 0.6, fbm3(p * 200.0))), smoothstep(0.618, 0.624, ln));
          // clouds: two flat tones split by a hard terminator on the slope toward the sun
          float cv = clouds(p), e1 = 0.002, cvx = clouds(p + vec3(e1, 0.0, 0.0)), cvz = clouds(p + vec3(0.0, 0.0, e1));
          float cm = smoothstep(0.52, 0.535, cv + (n3(p * 1800.0) - 0.5) * 0.015);
          vec3 tg = normalize(cross(p, vec3(0.0, 1.0, 0.0)) + 1e-5); float slope = dot(vec2(cvx - cv, cvz - cv), normalize(vec2(dot(uSun, tg), dot(uSun, cross(tg, p))) + 1e-5));
          vec3 cc = mix(uCloudSh, uCloud, smoothstep(-0.001, 0.0015, -slope + (cv - 0.6) * 0.02));
          s = mix(s, cc, cm);
          s = mix(uNight, s, lit);
          // the atmosphere over the surface near the limb: a deep-blue haze band, then the cyan rim (crisp edges)
          s = mix(s, mix(uOcean2, uCyan, 0.25), smoothstep(0.05, 0.04, below + bn * 0.003) * 0.55);
          s = mix(s, uCyan, smoothstep(0.014, 0.01, below) * 0.85);
          col = s; }
        gl_FragColor = vec4(col, 1.0); }` });
  glsl.mrt(m, { id: 0, sky: true });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50000, 96, 48), m); dome.frustumCulled = false; dome.renderOrder = -10; dome.raycast = () => {};
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  return dome;
}

export async function create(ctx) {
  const { THREE: T, kit, sets, glsl, util, rng } = ctx;
  // ---- coast: sky dome + towering cumulus ring + fair-weather cumulus + dusk stars -------------------------------------
  const coastSky = skyDome(ctx, DAY); sets.coast.add(coastSky);
  const R1 = rng(3201), coastClouds = [];
  // [x, z, w, h, lean, anvil]: an asymmetric sky — over the sea (s14, s30) one massive anvil tower + smaller ones
  const towers = [[-5200, -14500, 5600, 8800, [0.05, 0.02], 0], [2600, -11500, 4200, 6400, [-0.04, 0.0], 0], [9500, -16500, 5200, 7800, [0.03, -0.02], 0], [-12500, -9000, 3800, 5200, [0.06, 0.0], 0],
    [-9800, 19500, 4000, 5200, [0.02, 0.0], 0], [4200, 22500, 8800, 11800, [-0.03, 0.02], 0.55], [13500, 13500, 4600, 6400, [0.04, 0.0], 0], [-17000, 5000, 4200, 6200, [0.0, 0.0], 0],
    [17500, -3000, 4400, 5800, [-0.05, 0.0], 0], [-2000, -24000, 6000, 9000, [0.02, 0.0], 0], [-3600, 15000, 2600, 3000, [0.0, 0.0], 0], [1500, 17000, 3400, 3300, [0.02, 0.0], 0]];
  for (const [x, z, w, h, lean, anvil] of towers) coastClouds.push(cumulusTower(R1, { x, z, base: 1000 + R1() * 400, w, h, lean, anvil }));
  for (let i = 0; i < 26; i++) { const a = R1() * Math.PI * 2, r = 2600 + Math.pow(R1(), 0.7) * 9000, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 500 + R1() * 1300; coastClouds.push(cumulusPuff(R1, { x, z, base: 850 + R1() * 300, w, h: w * (0.45 + 0.35 * R1()) })); }
  const coastCS = createCloudSystem(ctx, coastClouds, { name: 'coast-cumulus' }); sets.coast.add(coastCS.mesh);
  const stars = kit.starField({ count: 900, radius: 42000, seed: 32, minE: 0.18, size: [0.8, 2.6], bright: 1.2, mask: 0.2 }); stars.visible = false; sets.coast.add(stars);

  // ---- sky set: cumulus field around the climb + the massif + the sea far below -----------------------------------------
  const skySky = skyDome(ctx, HIGH); sets.sky.add(skySky);
  const R2 = rng(3202), skyClouds = [];
  const MASSIF = { x: 3200, z: 9500, base: 1400, w: 7600, h: 8600 };
  skyClouds.push(cumulusTower(R2, { x: MASSIF.x, z: MASSIF.z, base: MASSIF.base, w: MASSIF.w, h: MASSIF.h, lean: [-0.02, 0.0], crown: 1.1 }));
  skyClouds.push(cumulusTower(R2, { x: MASSIF.x - 4800, z: MASSIF.z + 2500, base: 1400, w: 4600, h: 6200, lean: [0.03, 0] }));
  skyClouds.push(cumulusTower(R2, { x: MASSIF.x + 5200, z: MASSIF.z + 1800, base: 1400, w: 5000, h: 6800, lean: [-0.03, 0] }));
  const far = [[-9000, 14000, 6000, 8000], [14000, 6000, 5200, 7000], [-14000, -6000, 5600, 7400], [6000, -15000, 6400, 8600], [-4000, -13000, 4800, 6000], [16000, -9000, 5000, 6400]];
  for (const [x, z, w, h] of far) skyClouds.push(cumulusTower(R2, { x, z, base: 1400 + R2() * 200, w, h }));
  const CLOUD_TOP = 3300;
  for (let i = 0; i < 44; i++) { const a = R2() * Math.PI * 2, r = 350 + Math.pow(R2(), 0.75) * 6500, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 600 + R2() * 1500, h = (CLOUD_TOP - 1500) * (0.55 + 0.6 * R2());
    if (Math.hypot(x - MASSIF.x, z - MASSIF.z) < 4800 || Math.hypot(x + 7200, z + 2400) < 3600) continue;   // (clear of the massif and of the s05 camera)
    skyClouds.push(w > 1500 && R2() < 0.4 ? cumulusTower(R2, { x, z, base: 1500, w, h: h * 1.5, budget: 110 }) : cumulusPuff(R2, { x, z, base: 1500, w, h, budget: 72 })); }
  const skyCS = createCloudSystem(ctx, skyClouds, { name: 'sky-cumulus' }); sets.sky.add(skyCS.mesh);
  const seaFar = new T.Mesh(new T.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), ctx.mat.bg(0x1d5cc0, { pig: 0.25, brush: 0.1, hiAmt: 0 }));
  sets.sky.add(seaFar);

  // ---- strato + space -------------------------------------------------------------------------------------------------
  const R = 1000000;
  const strato = earthDome(ctx, R, { zen: 0x10288c, mid: 0x2e6ae0, limb: 0xd4f2ff, hot: 0xeaf8ff, space: 0 }); sets.strato.add(strato);
  const space = earthDome(ctx, R, { zen: 0x03061a, mid: 0x0c1e5a, limb: 0x8cc8ff, hot: 0xd8f0ff, space: 1 }); sets.space.add(space);
  const spaceStars = kit.starField({ count: 2200, radius: 42000, seed: 11, minE: -0.4, size: [0.7, 2.6], bright: 1.3, mask: 0.0 }); sets.space.add(spaceStars);
  const stratoStars = kit.starField({ count: 500, radius: 42000, seed: 12, minE: 0.25, size: [0.6, 1.8], bright: 0.5, mask: 0.0 }); sets.strato.add(stratoStars);

  // ---- state ----------------------------------------------------------------------------------------------------------
  let split = 0, splitOverride = null;
  const massifRow = 0, massifCx = MASSIF.x;
  const splitFn = (k) => k > 0 ? (row, x, y) => row === massifRow ? [Math.sign(x - massifCx + 1e-3) * k * 1900 * (0.55 + 0.45 * util.sstep(MASSIF.base, MASSIF.base + MASSIF.h, y)), 0, 0] : null : null;
  const api = {
    R, cloudTop: CLOUD_TOP, coastClouds: coastCS, skyClouds: skyCS, MASSIF,
    sunDir: () => [0.3, 0.62, 0.72],
    anchor(name) {
      if (name === 'massif') return new V3(MASSIF.x, MASSIF.base + MASSIF.h * 0.45, MASSIF.z);
      if (name === 'massifTop') return new V3(MASSIF.x, MASSIF.base + MASSIF.h, MASSIF.z);
      return new V3();
    },
    setSplit(k) { splitOverride = k; },
    setHot(pos, color = 0xff8a3a, radius = 6000) { skyCS.setHot(pos, color, radius); },
    // day -> dusk (complete by s30's first frame: the strato shots s22-s29 hide the change)
    dusk: (t) => util.sstep(DUSK_T0, DUSK_T1, t),
    update(t, shot) {
      const g = shot.groups, dusk = api.dusk(t);
      splitOverride = null; skyCS.setHot(null); coastSky.setHot(null);
      const sun = new V3().fromArray(shot.look.sun.dir).normalize(), meteor = ctx.modules.meteor;
      // the far meteor before it arrives: s05 a tiny white streak high above the massif, s07 one point of the sky glows orange
      // (the meteor department draws the streak / point at our direction; the sky adds the orange halo around it)
      if (shot.id === 's05') { const c0 = ctx.cues.streak, dir = slerpDir(S05_STREAK, S05_STREAK_END, util.sstep(c0, 12.0, t) * 0.7 + (t - c0) / (12.0 - c0) * 0.3);
        meteor?.sky?.(t, { dir, kind: 'streak', k: util.sstep(c0, c0 + 0.5, t) }); }
      if (shot.id === 's07') { const k = util.sstep(14.0, 15.0, t), dir = slerpDir(S07_GLOW, S07_GLOW_END, Math.min(1, Math.max(0, (t - 14.0) / 2.0)));
        const tail = new V3().fromArray(dir).addScaledVector(new V3().fromArray(S07_TAIL), 0.1 * k).normalize().toArray();
        coastSky.setHot(dir, k * (0.92 + 0.08 * Math.sin(ctx.onTwos(t) * 9)), 0xff9440, tail); meteor?.sky?.(t, { dir, kind: 'point', k }); }
      if (g.includes('coast')) {
        coastSky.setPal(lerpPal(DAY, DUSK, dusk)); coastSky.material.uniforms.uSunDir.value.copy(sun);
        coastCS.palette(lerpPalette(CLOUD_DAY, CLOUD_DUSK, dusk));
        stars.visible = dusk > 0.05; stars.material.uniforms.uB.value = 1.1 * util.sstep(0.3, 1, dusk);
      }
      if (g.includes('sky')) {
        skySky.setPal(lerpPal(HIGH, DUSK, dusk)); skySky.material.uniforms.uSunDir.value.copy(sun);
        skyCS.palette(lerpPalette(CLOUD_DAY, CLOUD_DUSK, dusk));
        // the split: s17 opens the massif into two walls (keeps open afterwards)
        const k = util.sstep(38.4, 39.8, t);
        if (k !== split) { split = k; skyCS.setOffsets(splitFn(split)); }
      }
      if (g.includes('strato') || g.includes('space')) { strato.material.uniforms.uSun.value.copy(sun); space.material.uniforms.uSun.value.copy(sun); }
    },
    afterCamera(t, shot) {
      // the painted cloud key: from the sun's side of the frame, above and slightly behind the camera, so every tower shows
      // ~60 % lit white (dusk: peach-gold) mass and ~40 % lavender shadow (CLOUD_KEY overrides per shot)
      { const cam = ctx.camera, Rv = new V3(), U = new V3(), F = new V3(); cam.matrixWorld.extractBasis(Rv, U, F);   // F = toward the camera
        Rv.y = 0; Rv.normalize(); const sun = new V3().fromArray(shot.look.sun.dir), side = sun.dot(Rv) < -0.05 ? -1 : 1;
        const key = CLOUD_KEY[shot.id] ?? Rv.multiplyScalar(side * 0.62).add(new V3(0, 0.66, 0)).addScaledVector(new V3(F.x, 0, F.z).normalize(), 0.3).normalize().toArray();
        coastCS.setKey(key); skyCS.setKey(key); }
      // a split requested by another department during its update (after ours) is applied here, before the render
      if (splitOverride != null && shot.groups.includes('sky') && splitOverride !== split) { split = splitOverride; skyCS.setOffsets(splitFn(split)); }
    },
    dispose() {},
  };
  return api;
}
