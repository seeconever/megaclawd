// MEGA CLAWD · FX WATER (owner: water) — every splash, sheet, drip, spray and wave in the film, drawn as bold cel anime FX
// with real mass, animated ON THREES (8 drawings / s, each event keeps its own drawing clock from its start time).
//   crowns   continuous thin water walls with a scalloped rim pulled into fingers (src/fx-water-kit.js crownBatch): the
//            pier-jump crown (s09), the boil bursts (s14), the hull crown of the splash-down (s32)
//   masses   opaque cel lumps (2 hard tones, sky-lit tops, a rim only on the outer silhouette, inked): the plume column,
//            its rope jets, Worthington jets, foam domes (s14), the churn under the curtains, the pier spouts (s33)
//   fronts   the s20 spray wall and the wave fronts (s32 surge ring, s33 wave into the seawall): continuous walls along a ring
//   drops    drawn droplets / spray clumps / steam / streaks (overlay sprites, crisp SDF edges, cel 2 tones + highlight)
//   flat     foam patches + ripple rings lying on the water
//   sheets   sheets of water (overlay ribbons with streaks: opaque at the base, torn into strands + drops at the end):
//            curtains pouring off the giant (s15, s16), the seawall break (s33)
// Default events follow the story cues (CUES in src/shots.js), so every shot works with no calls; other departments can
// place / override events from their update() (requests are per frame, consumed in this module's afterCamera).
//
// API: ctx.modules['fx-water'] === ctx.modules.water = {
//   splash({ pos: [x,y,z], t0, size = 1 })           crown splash; size 1 = little Clawd (crown ~0.8 m). Replaces the default
//                                                     s09 pier-jump splash (pilot.splash) when called.
//   sheets(object, anchors = null, amount = 1, t)     water pouring off a rising object (s15, s16). anchors: null = automatic from
//                                                     the object's bounds (top edges -> waterline), or [{ p: [x,y,z] object-local,
//                                                     n: [x,y,z] outward, w: width m }]. amount 0..1 (1 = just surfaced).
//   drips(object, anchors = null, amount = 1, t)      dripping water / kelp drips from an object (anchors as above, w ignored)
//   rain(center, radius, amount, t)                   water raining down around a point (replaces the s16 default rain)
//   boil(center, radius, k, t)                        boiling foam on the bulge (s14); k 0..1 intensity
//   sprayRing(center, t0, size = 1)                   launch shockwave ring of spray on the sea (s20)
//   plume(pos, t0, size = 1)                          the colossal splash-down plume (s32)
//   splashdownT() -> s                                when the giant hits the bay: mecha.splashdownT if published, else the
//                                                     first instant its hull touches the sea in s32 (found once by bisection
//                                                     of the mecha's own pure pose), else CUES.splashdown. Keys the plume, the
//                                                     s32 white-out accent and the camera shake.
//   wave = { front(t) -> z of the crest on the pier axis, radius(t), height(x, z, t) -> extra sea height, breakT }
//   bulgeHeight(x, z, t)                              the s14 bulge (for the world's ocean)
//   sheetsMode                                        'full' (default: this module hangs the curtains) | 'around' (mecha draws them)
// }
// Defaults by shot: s09 splash · s14 boil · s15 / s16 curtains + drips (+ s16 rain from the giant, bollard + cup hits) ·
// s19 surf foam · s20 spray ring · s32 plume (+ smoke trails, speed lines, hull crown, surge ring, reflection) ·
// s33 wave front + seawall break + pier spouts + plume collapse · s34 drips + foam around the kneeling giant.
import * as THREE from 'three';
import { lumpBatch, spriteBatch, ribbonBatch, crownBatch, K, setFogFromLook, hash, clamp, smooth } from './fx-water-kit.js';

const V3 = THREE.Vector3;
const G = 9.8;
const TAU = Math.PI * 2;
// drawing age of an event on threes, measured from its own start: drawings at t0, t0 + 1/8, ... (centred in the interval)
const ageOf = (t, t0) => { const a = t - t0; if (a < -1e-6) return -1; return (Math.floor(a * 8 + 1e-6) + 0.5) / 8; };
const h1 = (a) => hash(a);
const SITE = [0, 0, 225];   // the giant's bay site (rise, launch, splash-down)

const REFL_VS = /* glsl */`attribute vec2 aUv2; varying vec2 vUv; varying float vZ; varying vec3 vW;
  void main(){ vUv = aUv2; vW = position; vec4 mv = viewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`;

export async function create(ctx) {
  const { cues } = ctx;
  // ---- batches ----
  const mass = lumpBatch(ctx, { max: 500, lit: 0xffffff, body: 0xe4f4ff, shade: 0xa8c4f0, deep: 0x8ca6e4, crev: 0, glow: 0.3, top: 0.6, hi: 0xffffff, rimCol: 0xfffaf0, rim: 0.8, hiT: 0.5, bodyT: -0.1, disp: 0.2, freq: 1.5, ink: true, name: 'fxw-mass' });
  // the splash-down masses: 2 hard tones (a warm white-peach lit side, brighter than any cloud; a cool blue-lavender shade),
  // vertical striations of rushing water, broad billows rather than cauliflower knobs
  const big = lumpBatch(ctx, { max: 700, lit: 0xffffff, body: 0xfff0e2, shade: 0xa8b6ec, deep: 0x96a6e4, crev: 0, glow: 0.12, top: 0.4, streak: 0.5, ambLift: 0.5, hi: 0xffffff, rimCol: 0xffe2b8, rim: 1,
    hiT: 0.62, bodyT: -0.04, disp: 0.3, freq: 0.95, detail: 4, ink: true, outer: true, rimW: 0.6, white: 0.65, emis: 0.14, name: 'fxw-big' });
  const rope = lumpBatch(ctx, { max: 1400, lit: 0xffffff, body: 0xfff0e2, shade: 0xa8b6ec, deep: 0x9aa8e4, crev: 0, glow: 0.15, top: 0.5, ambLift: 0.5, hi: 0xffffff, rimCol: 0xfff4e4, rim: 0.7,
    hiT: 0.62, bodyT: -0.04, disp: 0.14, freq: 1.4, detail: 3, ink: true, white: 0.65, emis: 0.12, name: 'fxw-rope' });
  const sea = lumpBatch(ctx, { max: 200, lit: 0x9ee6f2, body: 0x4fb4dc, shade: 0x2f80c8, deep: 0x2a70bc, crev: 0, glow: 0.35, top: 0.7, hi: 0xffffff, rimCol: 0xe8ffff, rim: 0.5, hiT: 0.8, bodyT: 0.0, disp: 0.15, freq: 1.2, detail: 3, ink: true, name: 'fxw-sea' });
  const foamL = lumpBatch(ctx, { max: 400, lit: 0xffffff, body: 0xf6faff, shade: 0xbcc6ee, deep: 0xb0bcec, crev: 0, glow: 0.2, top: 0.8, ambLift: 0.55, hi: 0xffffff, rimCol: 0xffffff, rim: 0.5,
    hiT: 0.95, bodyT: -0.15, disp: 0.42, freq: 1.7, ink: true, name: 'fxw-foam-mass' });
  const crowns = crownBatch(ctx, { maxRings: 72, segs: 240, lit: 0xffffff, shade: 0xc2d2f4, rimCol: 0xfff6e6, rim: 0.85, white: 0.5, name: 'fxw-crowns' });
  // wave fronts (the s32 surge ring, the s33 wave rolling into the seawall): one continuous wall of sea water along the ring,
  // sea-blue body turning to a white scalloped lip that leans forward
  const waveC = crownBatch(ctx, { maxRings: 3, segs: 720, rows: 6, lit: 0xffffff, shade: 0xbcc8ee, seaLit: 0x5cc4e2, seaShade: 0x2a78c2, rim: 0.6, bodyT: -0.1, name: 'fxw-wavefront' });
  const drops = spriteBatch(ctx, { max: 9000, lit: 0xffffff, shade: 0xc4d6f2, hi: 0xffffff, line: 0x6a96d8, lineK: 0.5, soft: 0.8, dot: 0, name: 'fxw-drops' });
  // the dark trough running ahead of a wave front (flat strokes lying on the sea)
  const dark = spriteBatch(ctx, { max: 400, flat: true, lit: 0x1f4f8c, shade: 0x1f4f8c, lineK: 0, soft: 0.25, sort: false, cres: 0, dot: 0, name: 'fxw-trough' });
  const mist = spriteBatch(ctx, { max: 2000, lit: 0xfbfbff, shade: 0xcac4ee, hi: 0xffffff, lineK: 0, soft: 3.0, name: 'fxw-mist' });
  const flat = spriteBatch(ctx, { max: 4000, flat: true, lit: 0xf6fbff, shade: 0xc8e0f6, lineK: 0, soft: 0.25, sort: false, name: 'fxw-foam' });
  const sheetsB = ribbonBatch(ctx, { maxRibbons: 160, segs: 26, lit: 0xffffff, body: 0xd2eeff, shade: 0x8cb6e6, speed: 16, soft: 1.0, opaque: 1, name: 'fxw-sheets' });
  const wallC = crownBatch(ctx, { maxRings: 2, segs: 720, rows: 7, lit: 0xffffff, shade: 0xbcc4ee, rimCol: 0xfff6e6, rim: 0.7, name: 'fxw-spraywall' });
  const allB = [mass, big, rope, sea, foamL, crowns, waveC, wallC, drops, dark, mist, flat, sheetsB];
  // the drawn impact frame of the splash-down (on ones): a cream-white core + a radial burst of spikes, ink speed lines
  // between them over a darkened frame, then one ramp frame. Screen-space overlay quad.
  const impU = { uC: { value: new THREE.Vector2() }, uN: { value: 0 }, uK: { value: 0 }, uAsp: { value: ctx.W / ctx.H || 16 / 9 }, uCore: { value: 0.15 }, uDark: { value: 0.2 },
    uCol: { value: new THREE.Color(0xfff3e2) }, uInk: { value: new THREE.Color(0x231c40) } };
  const imp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: impU,
    vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`uniform vec2 uC; uniform float uN, uK, uAsp, uCore, uDark; uniform vec3 uCol, uInk; varying vec2 vP;
      float hh(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
      void main(){ vec2 d = (vP - uC) * vec2(uAsp, 1.0); float r = length(d), an = atan(d.y, d.x) / 6.2831853 + 0.5;
        float sc = an * 44.0, id = floor(sc), f = fract(sc);
        float len = mix(0.45, 2.4, hh(id * 1.7)) * (1.0 - 0.3 * uN);
        float spike = step(abs(f - 0.5), 0.5 * (1.0 - smoothstep(0.0, len, r)) * (0.55 + 0.45 * hh(id * 5.3))) * step(hh(id * 3.1), 0.8);
        float core = step(r, uCore * (1.0 - 0.4 * uN) * (1.0 + 0.14 * sin(an * 6.2831853 * 9.0)));
        float lines = step(0.962, hh(floor(an * 420.0) + 5.0)) * step(uCore * 1.5, r);
        if (max(core, spike) > 0.5) gl_FragColor = vec4(uCol, uK);
        else gl_FragColor = vec4(uInk, uK * (uDark + 0.6 * lines)); }` }));
  imp.frustumCulled = false; imp.renderOrder = 999; imp.visible = false; imp.name = 'fxw-impact-frame'; ctx.overlay.add(imp);
  const _ip = new V3();
  // plume reflection on the sea (overlay quad: a bright vertical smear broken into horizontal ripple dashes)
  const reflU = { tSceneData: ctx.glsl.U.tSceneData, uRes: ctx.glsl.U.uRes, uT: { value: 0 }, uCol: { value: new THREE.Color(0xf4e8f4) }, uK: { value: 0 } };
  const reflM = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, uniforms: reflU, vertexShader: REFL_VS,
    fragmentShader: /* glsl */`${ctx.glsl.NOISE} ${ctx.glsl.OVERLAY} uniform vec3 uCol; uniform float uT, uK; varying vec2 vUv; varying float vZ; varying vec3 vW;
      void main(){ float u = vUv.x, v = vUv.y; float w = 1.0 - smoothstep(0.25, 0.5, abs(u - 0.5) + (n2(vec2(v * 9.0, uT)) - 0.5) * 0.12);
        float dash = step(0.42, n2(vec2(u * 7.0 + uT * 0.3, v * 46.0 - uT * 2.0)) * 0.75 + n2(vec2(u * 19.0, v * 120.0)) * 0.25);
        float a = w * dash * pow(1.0 - v, 1.3) * uK; float d = sceneDepth(); if (d < 1e-3) d = 1e9;
        a *= step(abs(d - vZ), 0.025 * vZ + 1.0);   // only where the sea itself lies right under the quad (never over the billows)
        if (a < 0.004) discard; gl_FragColor = vec4(uCol, a); }` });
  const reflGeo = new THREE.BufferGeometry(); reflGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  reflGeo.setAttribute('aUv2', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2)); reflGeo.setIndex([0, 1, 2, 1, 3, 2]);
  const refl = new THREE.Mesh(reflGeo, reflM); refl.frustumCulled = false; refl.visible = false; refl.name = 'fxw-plume-reflection'; ctx.overlay.add(refl);

  const R = { splash: [], sheets: [], drips: [], rain: [], boil: [], ring: [], plume: [] };
  if (ctx.modules.ocean && 'useBreakFX' in ctx.modules.ocean) ctx.modules.ocean.useBreakFX = false;
  const fxq = (ctx.q?.get('fxw') || '').split(',').filter(Boolean);
  const on = (k) => fxq.length === 0 || (fxq[0].startsWith('only:') ? fxq[0].slice(5).split('+').includes(k) : !fxq.includes('-' + k));
  const seaY = (x, z, t) => ctx.modules.ocean?.height ? ctx.modules.ocean.height(x, z, t) : 0;

  // ---------------------------------------------------------------------------------------------------------------------
  // CROWN SPLASH: impact burst -> a continuous crown wall (flared, scalloped rim pulled into fingers that pinch off drops)
  // -> collapse -> Worthington jet with its pinched drop -> cel foam + complete ripple rings drawn on the water.
  // ---------------------------------------------------------------------------------------------------------------------
  function crown([x0, y0, z0], t0, S, t, opt = {}) {
    const age = ageOf(t, t0); if (age < 0 || age > 2.6) return;
    const sd = t0 * 7.13 + S, wy = opt.y ?? y0;
    // the impact drawing: a squat flared burst + needles of water straight up
    if (age < 0.13) {
      crowns.add({ c: [x0, wy - 0.02 * S, z0], rx0: S * 0.16, rz0: S * 0.16, rx1: S * 0.42, rz1: S * 0.42, h: S * 0.32, fingers: 11, fk: 0.7, seed: sd });
      for (let i = 0; i < 6; i++) { const a = h1(sd + i * 5.3) * TAU, r = S * 0.08 * h1(i + sd), h = S * (0.35 + 0.4 * h1(sd * 2 + i));
        mass.add(x0 + Math.cos(a) * r, wy + h * 0.5, z0 + Math.sin(a) * r, S * 0.028, h * 0.5, S * 0.028, sd + 20 + i, Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15, 0.4, 0.3);
        drops.add(x0 + Math.cos(a) * r, wy + h * 1.04, z0 + Math.sin(a) * r, S * 0.055, K.DROP, 1, 0, 1, 0, 0.6, h1(i)); }
    }
    // the crown wall: rises and flares, its fingers tip with drops, then it slumps back (age 0.95)
    const kw = clamp(age / 0.95), H = S * 0.8 * Math.sin(Math.PI * Math.pow(kw, 0.8)) * (age < 0.95 ? 1 : 0), r0 = S * (0.2 + 0.32 * (1 - Math.exp(-age * 5)));
    if (H > 0.03 * S) {
      const o = { c: [x0, wy - 0.02 * S, z0], rx0: r0, rz0: r0, rx1: r0 * 1.25 + H * 0.4, rz1: r0 * 1.25 + H * 0.4, h: H, fingers: 10, fk: 0.35 + 0.3 * kw, seed: sd };
      crowns.add(o);
      if (kw > 0.2) for (let i = 0; i < o.fingers; i++) { const p = crowns.tip(o, i), q = h1(sd + i * 3.3), ox = p[0] - x0, oz = p[2] - z0, ol = Math.hypot(ox, oz) || 1;
        drops.add(p[0] + ox / ol * S * 0.05, p[1] + S * (0.05 + 0.06 * q), p[2] + oz / ol * S * 0.05, S * (0.05 + 0.03 * q), K.DROP, 1, ox / ol * 0.5, 1, oz / ol * 0.5, 0.5, q); }
    }
    // flung drops (ballistic, from the crown rim)
    for (let i = 0; i < 30; i++) { const la = 0.08 + 0.35 * h1(sd + i * 2.3), aa = age - la; if (aa < 0) continue;
      const a = h1(sd + i * 4.1) * TAU, vh = S ** 0.5 * (0.6 + 1.2 * h1(i + sd)), vv = S ** 0.5 * (1.8 + 1.8 * h1(i * 3 + sd));
      const x = x0 + Math.cos(a) * (r0 * 1.3 + vh * aa), z = z0 + Math.sin(a) * (r0 * 1.3 + vh * aa), y = wy + S * 0.6 + vv * aa - 0.5 * G * aa * aa;
      if (y < wy) continue; const vy = vv - G * aa;
      drops.add(x, y, z, S * (0.025 + 0.04 * h1(i * 11 + sd)), i % 5 ? K.DROP : K.CLUMP, 1, Math.cos(a) * vh, vy, Math.sin(a) * vh, clamp(Math.hypot(vh, vy) * 0.25, 0, 2.2), h1(i)); }
    // Worthington jet: the column shooting up from the collapsing cavity, pinching off a drop at its tip
    const ja = age - 0.55, J = ja > 0 ? S * 0.95 * Math.sin(Math.PI * clamp(ja / 1.0)) * (ja < 1.0 ? 1 : 0) : 0;
    if (J > 0.04 * S) { for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5, w = S * 0.065 * (1.3 - u * 0.75); mass.add(x0, wy + J * u * 0.92, z0, w, J * 0.13, w, sd + 50 + i, 0, 1, 0, 0.35, 0.1); }
      crowns.add({ c: [x0, wy - 0.01, z0], rx0: S * 0.07, rz0: S * 0.07, rx1: S * 0.2, rz1: S * 0.2, h: S * 0.08 * clamp(ja * 3), fingers: 7, fk: 0.4, seed: sd + 3 });
      drops.add(x0, wy + J * 1.04 + S * 0.12 * clamp(ja * 2), z0, S * 0.085, K.DROP, 1, 0, 1, 0, 0.3, 0.3); }
    if (opt.noFlat) return;
    // cel foam patches + complete ripple rings drawn on the water (each sits on the local wave height)
    for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + h1(sd + i) * 0.3, r = r0 * (0.9 + 0.4 * h1(i * 3)) + S * 0.15 * age, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      flat.add(x, seaY(x, z, t) + 0.04, z, S * (0.14 + 0.16 * h1(i * 7)), K.FOAM, 1 - smooth(1.2, 2.6, age), 0, 0, 0, 0.3, h1(i * 13 + sd)); }
    for (let i = 0; i < 3; i++) { const ra = age - i * 0.3; if (ra < 0) continue;
      flat.add(x0, seaY(x0, z0, t) + 0.06, z0, S * (1.0 + 1.6 * ra) * 2, K.RING, 0.9 * (1 - smooth(0.6, 2.0, ra)), 0, 0, 0, 0, h1(i + sd)); }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // SPLASH-DOWN (s32 -> s34). T0 = the hull's first contact.
  //   before contact  smoke trails continued from s31 + vertical speed lines (they stop on the hit frame)
  //   impact (ones)   a drawn impact frame: a cream-white core and a radial burst of spikes over a darkened frame, then two
  //                   ramp frames (screen overlay; every luma step stays under the QC gate)
  //   hull crown      drawings 1-5 on threes: thin white crown sheets thrown outward and up around the hull, the rim torn
  //                   into spikes that fling drops; billows only from the 3rd drawing; every radius only ever grows
  //   column          opaque streaming billows (2 hard tones from a drawn key: a warm white-peach lit side brighter than any
  //                   cloud, a cool blue-lavender shade; vertical striations) rising to ~340 m; ragged crown sheets and spike
  //                   jets at the top, base mist, a skirt that keeps spreading over the foam; curtains fall off the crown
  //   surge ring      a breaking wave on the world's ring radius: a turquoise body, a white lip curling forward, a dark
  //                   trough ring ahead of it, foam behind; drawn on the camera's half of the ring
  // ---------------------------------------------------------------------------------------------------------------------
  const plumeTop = (age, S = 1) => S * (age < 2.2 ? 360 * (1 - Math.exp(-age / 0.75)) : Math.max(0, 360 * (1 - Math.exp(-2.2 / 0.75)) - 75 * (age - 2.2) ** 2));
  const skirtR = (age, S = 1) => S * (76 + 90 * (1 - Math.exp(-age * 1.3)));
  const Rp = (u, S, age, fallK) => S * (36 + 44 * Math.pow(1 - u, 5) + 30 * smooth(0.7, 1, u)) * (0.6 + 0.4 * clamp(age / 0.6)) * (1 + 0.5 * fallK);
  const _cr = new V3(), _cu = new V3(), _cf = new V3();
  // a drawn key for the splash masses: from the camera's left (the sun side), above and a little toward the camera, so the
  // lit side is a broad warm shape on the left and the tops, the shade a clean cool shape on the right
  function keyFor(cam) { cam.matrixWorld.extractBasis(_cr, _cu, _cf);
    return new V3().addScaledVector(_cr, -0.62).add(new V3(0, 0.66, 0)).addScaledVector(_cf, 0.45).normalize(); }
  function plume([x0, y0, z0], t0, S, t, cam, body = null, surge = true) {
    const age = ageOf(t, t0); if (age < 0 || age > 9.5) return;
    const sd = 91.7, Ht = plumeTop(age, S), fallK = smooth(2.2, 3.8, age), gone = age > 4.3, cp = cam?.position;
    big.uniforms.uAxis.value.set(x0, y0, z0, Ht);
    const dcx = cp ? cp.x - x0 : 0, dcz = cp ? cp.z - z0 : -1, dcl = Math.hypot(dcx, dcz) || 1;
    const facing = (a, lim) => Math.cos(a) * dcx / dcl + Math.sin(a) * dcz / dcl > lim;      // on the camera's side of the ring
    // the body (while it is still above the sea): billows are kept off it so nothing renders through the hull
    const hit = (x, y, z, r) => body && !(x + r < body.min.x || x - r > body.max.x || y + r < body.min.y || y - r > body.max.y || z + r < body.min.z || z - r > body.max.z);
    // ---- the hull crown: thin sheets punched up around the hull, spiky rim, slumping by the 6th drawing ----
    if (age < 0.7) { const k = age / 0.7, rx = S * (62 + 70 * (1 - Math.exp(-age * 5))), rz = rx * 0.88;
      const hc = S * 58 * Math.sin(Math.PI * (0.08 + 0.92 * Math.pow(k, 0.55))) * (1 - 0.35 * smooth(0.5, 1, k)), fl = hc * (0.7 + 0.5 * k);
      const o1 = { c: [x0, y0 - 1, z0], rx0: rx, rz0: rz, rx1: rx + fl, rz1: rz + fl, h: hc, fingers: 44, fk: 1.6, seed: 4.1, wob: 0.07 };
      crowns.add(o1);
      crowns.add({ ...o1, rx0: rx * 0.84, rz0: rz * 0.84, rx1: rx * 0.84 + fl * 0.8, rz1: rz * 0.84 + fl * 0.8, h: hc * 0.7, fingers: 33, fk: 1.8, seed: 8.7 });
      // the rim tears into spikes: a string of drops flung on from every finger tip
      for (let i = 0; i < o1.fingers; i++) { const p = crowns.tip(o1, i), q = h1(sd + i * 3.3), ox = p[0] - x0, oz = p[2] - z0, ol = Math.hypot(ox, oz) || 1;
        for (let m = 0; m < 3; m++) { const s = S * (5 + 9 * m) * (0.6 + 0.6 * q) * (0.4 + k);
          drops.add(p[0] + ox / ol * s, p[1] + s * (0.9 - 0.25 * m), p[2] + oz / ol * s, S * (3.4 - 0.8 * m) * (0.7 + 0.5 * q), K.DROP, 1, ox / ol, 1.1 - 0.5 * m, oz / ol, 1.4, q); } } }
    // ---- the skirt: billows rolling outward over the foam from the 3rd drawing on (the base of the column) ----
    const gsk = smooth(0.18, 0.5, age) * (1 - smooth(4.0, 5.5, age)), rs = skirtR(age, S);
    for (let i = 0; i < 64 && gsk > 0.01; i++) { const a = i / 64 * TAU + (h1(sd + i * 1.3) - 0.5) * 0.12, q = h1(sd + i * 3.7), q2 = h1(sd + i * 5.9);
      const br = S * (4 + 16 * q * q) * (0.4 + 0.6 * gsk), rr = rs * (0.6 + 0.42 * q2), y = br * (0.1 + 0.45 * (1 - q2)) + S * 10 * (1 - q2) * gsk;
      const x = x0 + Math.cos(a) * rr, z = z0 + Math.sin(a) * rr; if (hit(x, y0 + y, z, br * 0.8)) continue;
      big.add(x, y0 + y, z, br * 1.25, br * (0.8 + 0.4 * q), br * 1.1, sd + 700 + i, Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45, 1.0, (q - 0.5) * 0.25); }
    // ---- the column: streaming billows stretched along the rise, flaring into a crown cup at the top ----
    const gc = smooth(0.15, 0.4, age);
    if (!gone && Ht > 10 && gc > 0.01) for (let i = 0; i < 130; i++) { const u = Math.pow((i + h1(sd + i * 1.31)) / 130, 0.85), a = h1(sd + i * 2.77) * TAU;
      const hh = Ht * u; if (hh < 4) continue;
      const R0 = Rp(u, S, age, fallK), top = u > 0.8, rf = top ? 0.78 + 0.22 * h1(sd + i * 5.03) : 0.5 + 0.5 * Math.sqrt(h1(sd + i * 5.03));
      const br = R0 * (top ? 0.3 : 0.36 + 0.2 * h1(sd + i * 7.1)) * (1 - 0.3 * fallK) * gc, r = R0 * rf * 0.82;
      const sy = br * (top ? 1.1 : 1.5 + 0.9 * (1 - u)) * (1 + 0.3 * fallK);
      const x = x0 + Math.cos(a) * r, y = y0 + hh - sy * 0.3 * (1 - u), z = z0 + Math.sin(a) * r;
      if (hit(x, y, z, br * 0.8)) continue;
      big.add(x, y, z, br, sy, br, sd + i, 0, 1, 0, 0.8, (h1(i * 3.3) - 0.5) * 0.25); }
    // ---- the ragged crown at the top: two rings of thin sheets with long spiky fingers, drops torn off the tips ----
    if (!gone && Ht > 120) { const Rt = Rp(0.86, S, age, fallK), hcw = Ht * 0.17 * (1 - 0.6 * fallK) * smooth(120, 200, Ht);
      const oc = { c: [x0, y0 + Ht * 0.84, z0], rx0: Rt * 0.8, rz0: Rt * 0.8, rx1: Rt * 0.95 + hcw * 0.25, rz1: Rt * 0.95 + hcw * 0.25, h: hcw, fingers: 26, fk: 1.25, seed: 13.1, wob: 0.08 };
      crowns.add(oc);
      crowns.add({ ...oc, c: [x0, y0 + Ht * 0.79, z0], rx0: Rt * 0.92, rz0: Rt * 0.92, rx1: Rt * 1.1 + hcw * 0.35, rz1: Rt * 1.1 + hcw * 0.35, h: hcw * 0.7, fingers: 19, seed: 21.7 });
      for (let i = 0; i < oc.fingers; i++) { const p = crowns.tip(oc, i), q = h1(i * 5.3 + 2), ox = p[0] - x0, oz = p[2] - z0, ol = Math.hypot(ox, oz) || 1;
        for (let m = 0; m < 2; m++) drops.add(p[0] + ox / ol * S * (4 + 7 * m), p[1] + S * (5 + 6 * m) * (1 - fallK * 2), p[2] + oz / ol * S * (4 + 7 * m), S * (2.6 - 0.7 * m) * (0.7 + 0.5 * q), K.DROP, 1 - fallK, ox / ol * 0.4, 1 - 2 * fallK, oz / ol * 0.4, 1.5, q); } }
    // ---- spike jets: thin tapering jets fired out and up from the upper column, a string of drops at each tip ----
    const gj = smooth(0.25, 0.6, age) * (1 - smooth(2.4, 3.4, age));
    for (let j = 0; j < 30 && gj > 0.01 && !gone; j++) { const a = (j + 0.6 * h1(sd + j * 9.1)) / 30 * TAU, ub = 0.5 + 0.45 * h1(sd + j * 3.7);
      const R0 = Rp(ub, S, age, fallK) * 0.95, v0 = S * (55 + 45 * h1(j * 2.2)), el = 0.35 + 0.6 * h1(j * 5.5);
      const bx = x0 + Math.cos(a) * R0, by = y0 + Ht * ub, bz = z0 + Math.sin(a) * R0, w = S * (2.4 + 2.0 * h1(j * 1.9)) * gj;
      const Tl = Math.min(age - 0.1, 0.8 + 0.5 * h1(j * 3.1)); if (Tl <= 0.02) continue;
      let px0 = 0, py0 = 0;
      for (let m = 0; m < 9; m++) { const u = (m + 0.5) / 9, s = u * Tl, px = v0 * Math.cos(el) * s, py = v0 * Math.sin(el) * s - 0.5 * G * s * s;
        const r = w * (1.15 - 0.85 * u), seg = Math.hypot(px - px0, py - py0); px0 = px; py0 = py;
        const vx = v0 * Math.cos(el), vy = v0 * Math.sin(el) - G * s, vl = Math.hypot(vx, vy) || 1;
        rope.add(bx + Math.cos(a) * px, by + py, bz + Math.sin(a) * px, r, Math.max(r * 1.6, seg * 0.75), r, sd + 200 + j * 17 + m, Math.cos(a) * vx / vl, vy / vl, Math.sin(a) * vx / vl, 0.45, 0.06 - 0.1 * u); }
      for (let m = 0; m < 4; m++) { const s = Tl * (1.05 + 0.08 * m), px = v0 * Math.cos(el) * s, py = v0 * Math.sin(el) * s - 0.5 * G * s * s, vy = v0 * Math.sin(el) - G * s;
        drops.add(bx + Math.cos(a) * px, by + py, bz + Math.sin(a) * px, w * (0.6 - 0.1 * m), K.DROP, gj, Math.cos(a) * v0 * Math.cos(el), vy, Math.sin(a) * v0 * Math.cos(el), 1.6, h1(j + m)); } }
    // ---- curtains falling off the crown (from the last second of s32): ragged sheets hanging outside the column ----
    const gcur = smooth(0.75, 1.3, age) * (1 - smooth(3.8, 4.6, age));
    if (gcur > 0.01) for (let i = 0; i < 18; i++) { const a = (i + 0.5 * h1(i * 7.3)) / 18 * TAU; if (!facing(a, -0.25)) continue;
      const Rt = Rp(0.84, S, age, fallK) * (1.05 + 0.15 * h1(i * 3.1)), top = y0 + Ht * (0.8 - 0.1 * h1(i * 5.1));
      const L = Math.min(top - S * 4, S * (60 + 120 * h1(i * 2.9)) * gcur + 30 * Math.max(0, age - 1.2) ** 2 * S), pts = [], ws = [];
      for (let m = 0; m <= 8; m++) { const f = m / 8, rr = Rt + S * (4 + 26 * f * f); pts.push([x0 + Math.cos(a) * rr, top - L * f, z0 + Math.sin(a) * rr]); ws.push(S * (15 + 14 * h1(i)) * (1 - 0.6 * f)); }
      sheetsB.add(pts, ws, { seed: h1(i * 9.7), alpha: 1, normal: [Math.cos(a), 0.15, Math.sin(a)] }); }
    // ---- base mist: white spray clouds rolling out over the skirt (lifted, never grey) ----
    for (let i = 0; i < 24; i++) { const a = h1(sd + i * 3.9) * TAU; if (!facing(a, -0.5)) continue; const q = h1(i * 2.7), rr = rs * (0.85 + 0.4 * q);
      mist.add(x0 + Math.cos(a) * rr, y0 + S * (8 + 20 * q) * clamp(age / 0.6), z0 + Math.sin(a) * rr, S * (36 + 30 * q) * clamp(age / 0.5 + 0.25), K.MIST,
        0.9 * smooth(0.12, 0.4, age) * (1 - smooth(4, 7, age)), 0, 1, 0, 0, h1(i * 5)); }
    // ---- base spray: low clumps thrown wide around the foot ----
    const gs = 1 - smooth(2.8, 4.2, age);
    for (let i = 0; i < 90; i++) { const a = h1(sd + i * 4.4) * TAU, q = h1(i * 2.9), aa = age - 0.2 * q; if (aa < 0) continue;
      const v = S * (30 + 26 * h1(i * 6.1)), el = 0.55 + 0.5 * h1(i * 1.3), kd = 0.5, dist = v * Math.cos(el) / kd * (1 - Math.exp(-kd * aa)), y = v * Math.sin(el) / kd * (1 - Math.exp(-kd * aa)) - 0.5 * G * aa * aa;
      if (y < 0) continue; const vy = v * Math.sin(el) * Math.exp(-kd * aa) - G * aa, x = x0 + Math.cos(a) * (rs * 0.7 + dist), z = z0 + Math.sin(a) * (rs * 0.7 + dist);
      if (hit(x, y0 + y, z, S * 3)) continue;
      drops.add(x, y0 + y, z, S * (1.8 + 2.4 * q), i % 3 ? K.DROP : K.CLUMP, gs, Math.cos(a) * v * Math.cos(el), vy, Math.sin(a) * v * Math.cos(el), 1.2, q); }
    // ---- fall-back: once the column tops out, white streaks fall outside its silhouette ----
    if (age > 1.6) for (let i = 0; i < 220; i++) { const a = h1(i * 1.9) * TAU, rr = Rp(0.5, S, age, fallK) * (1.05 + 0.5 * h1(i * 5.5)), ph = (age * 0.45 + h1(i * 3.7)) % 1, yy = Math.max(0, Ht + S * 30) * (1 - ph);
      drops.add(x0 + Math.cos(a) * rr, y0 + yy, z0 + Math.sin(a) * rr, S * 1.4, K.STREAK, 0.85 * smooth(1.6, 2.4, age) * (1 - smooth(4.6, 6.0, age)), 0, -1, 0, 8, h1(i)); }
    // ---- the surge ring: a breaking wave rolling out on the world's ring, the camera's half only ----
    const wr = WAVE.ring(t), rho = wr.rho, hS = S * (15 * Math.exp(-age * 0.8) + 5) * (1 - smooth(3.0, 4.4, age)) * smooth(rs * 0.92, rs * 1.05, rho);
    if (rho > 20 && hS > 0.3 && surge) {
      const front = (x, z) => smooth(-0.15, 0.1, ((x - x0) * dcx + (z - z0) * dcz) / (Math.hypot(x - x0, z - z0) * dcl + 1e-3)) * (z < -40 ? 0 : 1);
      waveC.add({ c: [x0, -0.6, z0], rx0: rho - hS * 0.9, rz0: rho - hS * 0.9, rx1: rho + hS * 0.2, rz1: rho + hS * 0.2, h: hS, curl: 0.85, fingers: Math.round(rho * TAU / 7), fk: 0.25, wob: 0.004, seed: 3.3, hf: front });
      // the dark trough running ahead of it, foam behind it
      for (let i = 0; i < 90; i++) { const a = Math.atan2(dcz, dcx) + (i / 89 - 0.5) * 3.0, rr = rho + hS * (1.5 + 0.3 * h1(i * 2.3)), x = x0 + Math.cos(a) * rr, z = z0 + Math.sin(a) * rr;
        if (z < -40) continue; const sa = ((a / TAU) % 1 + 1) % 1;
        dark.add(x, 0.32, z, hS * (0.9 + 0.5 * h1(i * 5.1)), K.CLUMP, 0.8, 0, 0, 0, rr * 0.035 / (hS * 0.9) * 1.6, sa, 0); }
      for (let i = 0; i < 140; i++) { const a = h1(i * 4.7) * TAU; if (!facing(a, -0.1)) continue; const q = h1(i * 3.7), rr = rho - hS * (1.5 + 5 * q), x = x0 + Math.cos(a) * rr, z = z0 + Math.sin(a) * rr;
        if (z < -40) continue; flat.add(x, 0.4, z, S * (5 + 7 * q), K.FOAM, 0.95, 0, 0, 0, 0.3, h1(i * 7.1)); } }
    // foam on the sea inside the skirt (white cel rafts)
    for (let i = 0; i < 120; i++) { const a = h1(sd + i * 9.3) * TAU, rr = Math.sqrt(h1(i * 2.2)) * Math.max(rho, rs) * 1.02, x = x0 + Math.cos(a) * rr, z = z0 + Math.sin(a) * rr;
      const dc = cp ? Math.hypot(x - cp.x, z - cp.z) : 100;
      flat.add(x, 0.35, z, S * (12 + 14 * h1(i * 4.4)), K.FOAM, clamp(age / 0.4) * (1 - smooth(5, 7.5, age)) * (1 - smooth(300, 460, dc)) * 0.95, 0, 0, 0, 0.3, h1(i * 7.1)); }
    // the plume's reflection on the sea toward the camera: starts outside the skirt, drawn only where the sea is the
    // surface right under it (never over the billows)
    if (cp && !gone && Ht > 5) { const ux = dcx / dcl, uz = dcz / dcl, wv = Rp(0.25, S, age, fallK) * 1.2, r0 = Math.max(rs, rho) * 1.05, Lr = Math.min(Ht * 0.8, dcl * 0.6);
      const p = refl.geometry.attributes.position.array, b0 = [x0 - uz * wv + ux * r0, z0 + ux * wv + uz * r0], b1 = [x0 + uz * wv + ux * r0, z0 - ux * wv + uz * r0];
      p.set([b0[0], 0.25, b0[1], b1[0], 0.25, b1[1], b0[0] + ux * Lr, 0.25, b0[1] + uz * Lr, b1[0] + ux * Lr, 0.25, b1[1] + uz * Lr]);
      refl.geometry.attributes.position.needsUpdate = true; reflU.uK.value = 0.6 * clamp(age / 0.4) * (1 - fallK); reflU.uT.value = Math.floor(t * 8) / 8; refl.visible = true; }
  }
  // the fall (before contact): white smoke trails continued from s31 + speed lines along the falling giant; the speed lines
  // stop on the hit frame, the trails thin out over 4 frames
  function fall(mech, t, T0, cam) {
    const a = t - T0; if (a > 0.17) return;
    const k = 1 - smooth(0.0, 0.17, a);
    for (const [n, w] of [['top', 7], ['shoulderL', 6], ['shoulderR', 6], ['back', 8]]) { const p = mech.anchor(n); if (!p || !Number.isFinite(p.y)) continue;
      for (let i = 0; i < 22; i++) { const s = 8 + i * 10 + 5 * h1(i * 3.1 + w), q = h1(i * 7.7 + w);
        mist.add(p.x + (q - 0.5) * w * (1 + i * 0.1), p.y + s, p.z + (h1(i * 2.3 + w) - 0.5) * w, w * (2.0 + i * 0.12), K.MIST, 0.95 * k * (1 - i / 26), 0, 1, 0, 0.8, q); } }
    const c = mech.anchor('center'); if (!c || a >= 0) return;
    for (let i = 0; i < 46; i++) { const q = h1(i * 4.1), ang = q * TAU, rr = 70 + 50 * h1(i * 9.9), ph = (Math.floor(t * 8) * 0.37 + h1(i * 2.2)) % 1;
      drops.add(c.x + Math.cos(ang) * rr, c.y + 40 + 120 * ph, c.z + Math.sin(ang) * rr * 0.4 - 30, 1.6 + 1.6 * q, K.STREAK, 0.7, 0, 1, 0, 30 + 30 * q, q); }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // SHEETS + DRIPS off a rising object (anchors from its world bounds unless given): thick curtains hang off the top and
  // shoulder edges, fall, break into ropes and drops at their ends; drops only fall under the edges; white cel foam where
  // they hit the sea.
  // ---------------------------------------------------------------------------------------------------------------------
  const _b = new THREE.Box3(), _p = new V3(), _n = new V3();
  function autoAnchors(obj) {
    // the giant: anchors from its body frame (its bounds also hold FX children far above the armour)
    const mech = ctx.modules.mecha;
    if (mech?.frame && obj === mech.root) { const f = mech.frame(), D = mech.DIM || { W: 120, H: 90, D: 72 }, out = [];
      const pt = (r, u, w) => f.center.clone().addScaledVector(f.right, r).addScaledVector(f.up, u).addScaledVector(f.fwd, w);
      for (const s of [-1, 1]) {
        for (const k of [0.3, 0.42]) out.push({ p: pt(s * D.W * k, D.H / 2 - 1, D.D / 2).toArray(), n: f.fwd.toArray(), w: 9 + 3 * h1(k * 7 + s), world: true });   // front top corners
        for (const k of [-0.25, 0.1, 0.4]) out.push({ p: pt(s * D.W / 2, D.H / 2 - 4, D.D * k).toArray(), n: f.right.clone().multiplyScalar(s).toArray(), w: 10 + 4 * h1(k * 5 + s), world: true }); }   // shoulders
      return out; }
    _b.setFromObject(obj); if (_b.isEmpty()) return [];
    const mn = _b.min, mx = _b.max, W = mx.x - mn.x, D = mx.z - mn.z, top = mx.y;
    const out = []; const ins = 0.12;
    const edge = (x0, z0, x1, z1, nx, nz, n, drop) => { for (let i = 0; i < n; i++) { const u = (i + 0.5) / n + (h1(i * 3.3 + x0) - 0.5) * 0.4 / n;
      out.push({ p: [x0 + (x1 - x0) * u, top - drop - 0.05 * (W + D) * (0.3 + 0.7 * Math.abs(u - 0.5) * 2), z0 + (z1 - z0) * u], n: [nx, 0, nz], w: 7 + 6 * h1(i * 7 + z0) }); } };
    edge(mn.x + W * 0.04, mn.z, mn.x + W * 0.24, mn.z, 0, -1, 2, 0);                                    // front top corners (the
    edge(mx.x - W * 0.24, mn.z, mx.x - W * 0.04, mn.z, 0, -1, 2, 0);                                    // face stays readable)
    edge(mn.x, mn.z + D * ins, mn.x, mx.z - D * ins, -1, 0, Math.max(2, Math.round(D / 16)), 4);       // left shoulder
    edge(mx.x, mn.z + D * ins, mx.x, mx.z - D * ins, 1, 0, Math.max(2, Math.round(D / 16)), 4);        // right shoulder
    return out.map(a => ({ ...a, world: true }));
  }
  function pour(obj, anchors, amount, t, withDrips = true, onlyDrips = false, edgeSheets = true) {
    if (!obj || amount <= 0.01) return;
    const ft = Math.floor(t * 8 + 1e-6) / 8;
    const list = anchors?.length ? anchors : autoAnchors(obj);
    _b.setFromObject(obj); const bx = _b.clone();
    list.forEach((an, i) => {
      if (an.world) _p.fromArray(an.p); else _p.fromArray(an.p).applyMatrix4(obj.matrixWorld);
      _n.fromArray(an.n || [0, 0, -1]); if (!an.world) _n.transformDirection(obj.matrixWorld); _n.y = 0; if (_n.lengthSq() < 1e-6) _n.set(0, 0, -1); _n.normalize();
      const top = _p.y; if (top < 1) return;
      const W = (an.w || 6) * (0.45 + 0.55 * amount), sd = i * 7.77 + 3, side = new V3(-_n.z, 0, _n.x);
      if (!onlyDrips) {
        // the curtain: over the lip (out ~2 m), a thick falling sheet hugging the face, kicked out as it falls
        const pts = [], ws = [], N = 10, fall = top + 0.5;
        for (let k = 0; k <= N; k++) { const f = k / N, y = top + 0.9 - fall * f, o = 1.4 + 2.8 * f * f + 0.8 * Math.sin(f * 3 + sd) * f;
          pts.push([_p.x + _n.x * o, Math.max(0.2, y), _p.z + _n.z * o]); ws.push(W * (1.0 - 0.3 * f + 0.15 * Math.sin(f * 5 + sd))); }
        if (edgeSheets) sheetsB.add(pts, ws, { seed: h1(sd), alpha: clamp(amount * 1.8) * (0.9 + 0.1 * h1(sd + 1)), normal: [_n.x, 0, _n.z] });
        // where the curtain breaks up: ropes of water + drops under it (only under this edge)
        if (edgeSheets) for (let j = 0; j < 7; j++) { const q = h1(sd * 1.3 + j * 2.9), ph = (ft * (0.6 + 0.3 * q) + q) % 1, o = (q - 0.5) * W * 0.9;
          const y = top * (0.45 - 0.45 * ph), off = 2.0 + 4.0 * (1 - y / top) ** 2 + 0.8;
          drops.add(_p.x + _n.x * off + side.x * o, y, _p.z + _n.z * off + side.z * o, W * 0.06 * (0.7 + 0.6 * q), j % 3 ? K.DROP : K.CLUMP, 1, 0, -1, 0, 2.5, q); }
        // impact churn where the curtain hits the sea: white cel foam mounds + clumps (no grey mist)
        const bx2 = _p.x + _n.x * 6.5, bz2 = _p.z + _n.z * 6.5;
        for (let j = 0; j < 3; j++) { const q = h1(sd + j * 3), ph = (ft * 1.3 + q) % 1;
          foamL.add(bx2 + side.x * (q - 0.5) * W, 0.8 + 1.5 * Math.sin(Math.PI * ph) * amount, bz2 + side.z * (q - 0.5) * W, W * 0.28, (2.2 + 2.5 * Math.sin(Math.PI * ph)) * amount + 0.6, W * 0.22, sd * 3 + j, 0, 1, 0, 0.9, 0); }
        for (let j = 0; j < 5; j++) { const a = h1(sd + j * 3) * TAU, ph = (ft * 1.7 + h1(sd + j)) % 1;
          drops.add(bx2 + Math.cos(a) * W * 0.6 * ph, 1 + 8 * Math.sin(Math.PI * ph) * amount, bz2 + Math.sin(a) * W * 0.6 * ph, 1.4 + 1.6 * h1(j + sd), K.CLUMP, 1 - ph * 0.6, Math.cos(a), 2 - 4 * ph, Math.sin(a), 0.3, h1(j * 9 + sd)); }
        for (let j = 0; j < 4; j++) flat.add(bx2 + side.x * (h1(sd + j) - 0.5) * W * 1.4, 0.3, bz2 + side.z * (h1(sd + j) - 0.5) * W * 1.4 + (h1(sd + j * 2) - 0.5) * 4, 5 + 4 * h1(j), K.FOAM, 0.95 * amount, 0, 0, 0, 0.3, h1(sd * 3 + j));
      }
      // drips: thin streams + drops falling off the lip between curtains (period-looped on threes), under the edge only
      if (withDrips) for (let j = 0; j < 6; j++) { const s3 = h1(sd * 1.7 + j * 5.1), off = (s3 - 0.5) * W * 1.6, ph = (ft * (0.45 + 0.3 * h1(j + sd)) + s3) % 1;
        const fallT = Math.sqrt(2 * top / G), tt = ph * fallT * 1.25, y = top - 0.5 * G * tt * tt; if (y < 0.3) continue;
        drops.add(_p.x + _n.x * (1.4 + 0.8 * tt) + side.x * off, y, _p.z + _n.z * (1.4 + 0.8 * tt) + side.z * off, 0.6 + 0.6 * s3, K.DROP, 1, 0, -1, 0, clamp(G * tt * 0.12, 0.3, 5), s3); }
    });
    // foam collar where the body meets the sea: white cel foam patches + low foam mounds
    const cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2, rx = (bx.max.x - bx.min.x) / 2, rz = (bx.max.z - bx.min.z) / 2;
    if (bx.min.y < 0.5 && bx.max.y > 0) for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, rr = 1.04 + 0.16 * h1(i * 3.7) + 0.05 * Math.sin(ft * 3 + i);
      flat.add(cx + Math.cos(a) * rx * rr, 0.3, cz + Math.sin(a) * rz * rr, 7 + 8 * h1(i * 5.1), K.FOAM, 0.95 * clamp(amount * 2 + 0.3), 0, 0, 0, 0.3, h1(i + ft * 0.01));
      if (i % 3 === 0) foamL.add(cx + Math.cos(a) * rx * 1.02, 0.4, cz + Math.sin(a) * rz * 1.02, 5 + 3 * h1(i), 1.2 + 1.4 * amount * h1(i * 2.1), 4.5, 900 + i, 0, 1, 0, 0.9, 0); }
  }

  // RAIN FROM THE GIANT (s16 pier): drops only inside the giant's silhouette footprint (they fall out of it toward the
  // camera), splash crowns on the bollard top, a bead running down the cup, droplet rings on the near sea, spray at its feet.
  function rainGiant(t, cam, mech) {
    const ft = Math.floor(t * 8 + 1e-6) / 8, cp = cam.position, deckY = ctx.modules.world?.pier?.deckY ?? 2.2;
    _b.setFromObject(mech.root); if (_b.isEmpty()) return;
    const fr = mech.frame?.(), Dm = mech.DIM || { W: 120, H: 90 };
    const top = fr ? fr.center.y + Dm.H / 2 : _b.max.y, mid = fr ? [fr.center.x, fr.center.z] : [(_b.min.x + _b.max.x) / 2, (_b.min.z + _b.max.z) / 2], hw = fr ? Dm.W * 0.48 : (_b.max.x - _b.min.x) / 2;
    const D = Math.hypot(mid[0] - cp.x, mid[1] - cp.z);
    for (let i = 0; i < 260; i++) { const s = h1(i * 3.71), u = (h1(i * 1.3) - 0.5) * 1.6, d = 4 + 70 * Math.pow(h1(i * 2.9), 1.6), f = d / D;
      // the column of air in front of the giant: x across its width, height from its top (projected) down to the sea
      const gx = mid[0] + u * hw, gz = _b.min.z, x = cp.x + (gx - cp.x) * f, z = cp.z + (gz - cp.z) * f;
      const yTop = cp.y + (top - cp.y) * f, H = Math.max(1, yTop), sp = 10 + 5 * s, ph = (ft * sp / H + h1(i * 5.3)) % 1, y = yTop - ph * H; if (y < 0.05) continue;
      drops.add(x, y, z, (d < 8 ? 0.03 : 0.05 + 0.002 * d) + 0.015 * s, d < 10 ? K.DROP : K.STREAK, 0.9, -0.05, -1, 0, d < 10 ? 2.4 : 6 + 4 * s, s);
      if (ph > 0.9 && d < 40) { const k = (ph - 0.9) / 0.1; flat.add(x, seaY(x, z, t) + 0.03, z, (0.15 + 0.5 * k) * (0.5 + d * 0.03), K.RING, 0.8 * (1 - k), 0, 0, 0, 0, s); } }
    // the bollard + cup (pilot): small splash crowns on the bollard top, a bead running down the cup
    const P = ctx.modules.pilot, cw = P?.cupWorld?.(t);
    if (cw?.pos) { const c = cw.pos, bt = c.y ?? deckY + 0.4;
      for (let i = 0; i < 4; i++) { const per = 0.45 + 0.35 * h1(i * 7.1), tb = Math.floor((t + h1(i * 3.3) * per) / per) * per - h1(i * 3.3) * per, q = h1(i * 5.5 + Math.floor(tb * 10));
        const a = q * TAU, r = 0.08 + 0.05 * h1(i * 9.1 + tb); const px = c.x + Math.cos(a) * r, pz = c.z + Math.sin(a) * r;
        crown([px, bt, pz], tb, 0.03, t, { noFlat: true }); }
      const bead = (t * 0.06 + 0.3) % 1, bx = c.x + (cp.x - c.x) * 0.0, cr = 0.052;
      const dv = new V3(cp.x - c.x, 0, cp.z - c.z).normalize();
      drops.add(bx + dv.x * cr + 0.012, bt + 0.11 - 0.07 * bead, c.z + dv.z * cr, 0.012, K.DROP, 1, 0, -1, 0, 0.6, 0.5); }
    // white spray at the giant's feet
    for (let i = 0; i < 26; i++) { const a = h1(i * 2.2) * TAU, q = h1(i * 6.6), ph = (ft * 0.9 + q) % 1, x = mid[0] + Math.cos(a) * hw * 0.85, z = mid[1] + Math.sin(a) * (_b.max.z - _b.min.z) * 0.45;
      drops.add(x, 2 + 12 * Math.sin(Math.PI * ph), z, 4 + 4 * q, K.CLUMP, 1 - ph * 0.5, 0, 1, 0, 0.3, q);
      drops.add(x + 3 * (q - 0.5), 1 + 7 * Math.sin(Math.PI * ((ph + 0.5) % 1)), z, 2.5 + 2 * q, K.DROP, 1, 0, 1, 0, 0.8, q); }
  }
  // generic rain around a point (API rain(center, radius, amount, t))
  function rainAt([cx, cy, cz], rad, amount, t) {
    if (amount <= 0.01) return;
    const ft = Math.floor(t * 8 + 1e-6) / 8, n = Math.round(300 * amount);
    for (let i = 0; i < n; i++) { const s = h1(i * 3.71), x = cx + (h1(i * 1.3) - 0.5) * 2 * rad, z = cz + (h1(i * 2.9) - 0.5) * 2 * rad;
      const top = cy + rad * 1.2, H = top, sp = 9 + 4 * s, ph = (ft * sp / H + h1(i * 5.3)) % 1, y = top - ph * H;
      drops.add(x, y, z, 0.03 + 0.02 * s, K.STREAK, 0.9, -0.15, -1, -0.1, 7 + 4 * s, s);
      if (ph > 0.88) { const k = (ph - 0.88) / 0.12; flat.add(x, 0.02, z, 0.06 + 0.22 * k, K.RING, 0.8 * (1 - k), 0, 0, 0, 0, s); } }
  }

  // BOIL on the bulge (s14): domes of white boiling foam swell (drawn bubbles on them) and burst into crowns + steam that
  // rises into the sky; foam rafts and a scalloped churning ring on the bulge. Sits on the world's ocean bulge.
  const bulgeHeight = (x, z, t, c = SITE, r = 95) => { const k = smooth(28.75, 31.4, t) * (1 - smooth(31.7, 33.4, t)); const d = Math.hypot(x - c[0], z - c[2]) / r;
    return k * 7.5 * Math.exp(-d * d * 2.5); };
  function boil([cx, , cz], rad, k, t, rafts = false) {
    if (k <= 0.01) return;
    const ft = Math.floor(t * 8 + 1e-6) / 8, oc = ctx.modules.ocean, bu = oc?.bulge?.(t);
    if (bu) { cx = bu.x; cz = bu.z; rad = bu.r * 0.8; }
    const hAt = (x, z) => oc?.height ? oc.height(x, z, t) : bulgeHeight(x, z, t, [cx, 0, cz], rad);
    for (let i = 0; i < 60; i++) { const s = h1(i * 4.13), a = s * TAU, rr = rad * 0.8 * Math.pow(h1(i * 2.71), 0.7), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (k < h1(i * 3.3) * 0.85) continue;
      const life = 0.75 + 0.75 * h1(i * 7.7), ph = ((ft + h1(i * 9.9) * life) % life) / life, cyc = Math.floor((ft + h1(i * 9.9) * life) / life);
      flat.add(x, hAt(x, z) + 0.4, z, (10 + 16 * h1(i * 5.5 + cyc)) * (0.55 + 0.6 * ph), K.FOAM, (1 - ph * ph) * 0.95, 0, 0, 0, 0.3, h1(i + cyc * 0.37)); }
    if (rafts) return;
    for (let i = 0; i < 22; i++) { const s = h1(i * 8.31), a = s * TAU, rr = rad * 0.65 * Math.sqrt(h1(i * 6.17)), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (k < h1(i * 1.9) * 0.9) continue;
      const life = 0.9 + 0.7 * h1(i * 2.2), ph = ((ft + h1(i * 5.5) * life) % life) / life, cyc = Math.floor((ft + h1(i * 5.5) * life) / life);
      const y = hAt(x, z), r2 = (6 + 8 * h1(i * 1.1 + cyc)) * (0.6 + 0.4 * k);
      // a dome of white boiling foam swells (bubbles drawn on its skin, a scalloped foam skirt), then bursts
      if (ph < 0.45) { const db = Math.sin(Math.PI * 0.5 * ph / 0.45);
        foamL.add(x, y + r2 * 0.05 * db, z, r2 * db, r2 * 0.62 * db, r2 * db, i * 3.3 + cyc, 0, 1, 0, 1.0, 0.05);
        for (let b = 0; b < 7; b++) { const ba = h1(i * 7 + b + cyc) * TAU, bl = 0.35 + 0.5 * h1(b * 3.3 + i), bpos = [x + Math.cos(ba) * r2 * db * bl * 0.9, y + r2 * 0.62 * db * Math.sqrt(1 - bl * bl) * 0.95, z + Math.sin(ba) * r2 * db * bl * 0.9];
          const pop = ((ph * 7 + h1(b + i)) % 1); drops.add(bpos[0], bpos[1], bpos[2], r2 * (0.06 + 0.08 * h1(b * 9 + i)) * (pop < 0.8 ? 1 : 1.6), pop < 0.8 ? K.BUBBLE : K.RING, pop < 0.8 ? 1 : 1 - (pop - 0.8) * 5, 0, 1, 0, 0, h1(b)); }
        for (let b = 0; b < 12; b++) { const ba = b / 12 * TAU + h1(i + b) * 0.3; flat.add(x + Math.cos(ba) * r2 * db * 1.05, y + 0.35, z + Math.sin(ba) * r2 * db * 1.05, r2 * 0.4, K.FOAM, 0.95, 0, 0, 0, 0.3, h1(i * 3 + b + cyc)); } }
      const tb = cyc * life - h1(i * 5.5) * life + 0.45 * life;
      crown([x, y, z], tb, r2 * 1.0, t, { noFlat: true });
      if (ph >= 0.45) mist.add(x, y + r2 * (1.2 + 3 * (ph - 0.45)), z, r2 * (1.8 + 2.4 * (ph - 0.45)), K.MIST, 0.6 * (1 - (ph - 0.45) / 0.55), 0, 1, 0, 0, h1(i * 2 + cyc)); }
    // churning foam ring at the edge of the bulge (scalloped patches)
    for (let i = 0; i < 70; i++) { const a = i / 70 * TAU + ft * 0.03, rr = rad * (1.0 + 0.12 * h1(i * 3.1)), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      flat.add(x, hAt(x, z) + 0.35, z, 8 + 8 * h1(i * 8.1), K.FOAM, 0.85 * k, 0, 0, 0, 0.3, h1(i + Math.floor(ft * 8 / 3) * 0.17)); }
  }

  // SPRAY RING (s20 launch): the shockwave flattens the sea; an opaque white spray wall (lavender shade side) rides the
  // shock front, flares outward and tears at its rim into tapering fingers that pinch off drops; cel foam at the foot.
  function sprayRing([cx, , cz], t0, S, t) {
    const age = ageOf(t, t0); if (age < 0 || age > 4) return;
    const fe = ctx.modules['fx-energy'], rr0 = fe?.ringRadius ? fe.ringRadius(t0 + age, t0) : S * (35 + 230 * (1 - Math.exp(-age * 0.95)));
    const R0 = Math.max(S * 20, rr0 * 0.97), H = S * (14 + 30 * Math.exp(-age * 1.1)) * clamp(age / 0.15), fade = 1 - smooth(2.4, 4, age), fb = smooth(1.0, 2.6, age);
    // the curtain: one continuous wall of white spray along the shock front, flaring out, its rim torn into fingers + drops
    const ow = { c: [cx, -0.3, cz], rx0: R0, rz0: R0, rx1: R0 + H * 0.6, rz1: R0 + H * 0.6, h: H * fade * (1 - 0.3 * fb), fingers: Math.max(20, Math.round(R0 * TAU / 22)), fk: 0.22, wob: 0.012, seed: 2.7 };
    wallC.add(ow);
    // a lower, ragged second sheet in front of it (depth in the curtain, the fingers do not line up)
    wallC.add({ ...ow, rx0: R0 * 1.01, rz0: R0 * 1.01, rx1: R0 * 1.01 + H * 0.7, rz1: R0 * 1.01 + H * 0.7, h: ow.h * 0.62, fingers: Math.round(ow.fingers * 1.37), fk: 0.4, seed: 5.9 });
    for (let i = 0; i < ow.fingers; i += 2) { const p = wallC.tip(ow, i), q = h1(i * 3.1), ox = p[0] - cx, oz = p[2] - cz, ol = Math.hypot(ox, oz) || 1;
      drops.add(p[0] + ox / ol * S * 2 * q, p[1] + S * (1 + 3 * q) - 6 * fb * q, p[2] + oz / ol * S * 2 * q, S * (1.6 + 2 * q), i % 4 ? K.DROP : K.CLUMP, fade, ox / ol, 0.8 - 1.4 * q, oz / ol, 0.6, q); }
    for (let i = 0; i < 120; i++) { const a = h1(i * 2.2) * TAU, rr = R0 * (0.82 + 0.16 * h1(i * 6.6)); flat.add(cx + Math.cos(a) * rr, 0.25, cz + Math.sin(a) * rr, S * (8 + 10 * h1(i)), K.FOAM, 0.8 * fade, 0, 0, 0, 0.3, h1(i * 3)); }
  }

  // THE WAVE (s33): the ring wave from the splash-down (the world's ocean carries it: ocean.wave(t)) rolls in as a drawn wave
  // front (a sea-blue body with a white lip curling forward) and slams into the seawall: a sheet of water shoots up the
  // wall, curls over the quay and falls as spray; tall white spouts burst up between the pier piles as the crest runs along.
  const SEAWALL_Z = -42, WALL_TOP = 3.5;
  const WAVE = { c: SITE, t0: cues.splashdown + 0.05, wall: SEAWALL_Z, breakT: cues.wave,
    ring(t) { const w = ctx.modules.ocean?.wave?.(t); if (w) return { cx: w.cx, cz: w.cz, rho: w.rho, h: w.h };
      const k = (t - this.t0) / (this.breakT - this.t0); if (k <= 0) return { cx: SITE[0], cz: SITE[2], rho: 0, h: 0 };
      return { cx: SITE[0], cz: SITE[2], rho: (SITE[2] - SEAWALL_Z) * Math.pow(k, 0.72), h: 2.05 * smooth(0, 0.25, k) * (1 - smooth(1.02, 1.3, k)) }; },
    hitX(x) { const oc = ctx.modules.ocean; if (oc?.wave) { const w = oc.wave(this.breakT); if (w.hitX) return w.hitX(x); }
      return this.t0 + (this.breakT - this.t0) * Math.pow(Math.hypot(x - SITE[0], SEAWALL_Z - SITE[2]) / (SITE[2] - SEAWALL_Z), 1 / 0.72); },
    hitZ(z) { return this.t0 + (this.breakT - this.t0) * Math.pow(Math.max(0, SITE[2] - z) / (SITE[2] - SEAWALL_Z), 1 / 0.72); },
    radius(t) { return this.ring(t).rho; }, front(t) { const r = this.ring(t); return r.cz - r.rho; },
    height(x, z, t) { const r = this.ring(t); if (r.rho <= 0) return 0; const s = (Math.hypot(x - r.cx, z - r.cz) - r.rho) / 9; return r.h * (s > 0 ? Math.exp(-s * s * 4) : Math.exp(-s * s * 0.6)); } };
  function wave(t, camera) {
    const ft = Math.floor(t * 8 + 1e-6) / 8, r = WAVE.ring(ft), cp = camera.position;
    // the rolling wave front: one continuous wall along the crest (sea-blue body, white scalloped lip leaning forward),
    // growing as it shoals toward the seawall, gone past it (the break takes over there)
    if (r.rho > 0 && r.h > 0.05) {
      const hw = 2.6 * clamp(r.h / 1.5);
      waveC.add({ c: [r.cx, r.h * 0.75 - 0.2, r.cz], rx0: r.rho - 1.2, rz0: r.rho - 1.2, rx1: r.rho + 1.3, rz1: r.rho + 1.3, h: hw, fingers: Math.round(r.rho * TAU / 3.2), fk: 0.22, wob: 0.0015, seed: 7.1,
        hf: (x, z) => z < SEAWALL_Z + 1.0 ? 0 : (1 + 0.9 * smooth(30, 2, z - SEAWALL_Z)) * smooth(SEAWALL_Z + 1.0, SEAWALL_Z + 2.5, z) });
      for (let i = 0; i < 80; i++) { const a = -Math.PI / 2 + (i / 79 - 0.5) * 1.5, x = r.cx + Math.cos(a) * (r.rho + 1.5), z = r.cz + Math.sin(a) * (r.rho + 1.5);
        if (z < SEAWALL_Z + 2 || Math.abs(x) > 240) continue; const q = h1(i * 5.1 + Math.floor(ft * 8) * 0.31), dc = Math.hypot(x - cp.x, z - cp.z); if (dc < 5) continue;
        const hk = hw * (1 + 0.9 * smooth(30, 2, z - SEAWALL_Z)), ux = -Math.cos(a), uz = -Math.sin(a);
        if (i % 2 === 0) drops.add(x + ux * 0.6, hk * (1.0 + 0.35 * q) + r.h * 0.4, z + uz * 0.6, 0.5 + 0.6 * q, K.CLUMP, 1, ux, 0.3, uz, 0.3, q, 1);
        flat.add(x - ux * 4, seaY(x - ux * 4, z - uz * 4, t) + 0.25, z - uz * 4, 3 + 3 * q, K.FOAM, 0.9 * (1 - smooth(60, 160, dc)), 0, 0, 0, 0.3, q); } }
    // the break along the seawall: per 2.4 m of wall, as the ring arrives a sheet of water shoots up the wall face, curls
    // over the quay and falls; spray flies landward
    for (let i = 0; i < 110; i++) { const x = -132 + i * 2.4 + (h1(i * 1.7) - 0.5) * 1.2, q = h1(i * 3.9), q2 = h1(i * 8.3), age = ageOf(t, WAVE.hitX(x) + 0.18 * q2); if (age < 0 || age > 3) continue;
      const swell = 0.5 + 0.5 * Math.sin(x * 0.11 + 1.7) * Math.sin(x * 0.037), H = (3.5 + 11 * q * (0.4 + 0.6 * swell)) * Math.sin(Math.PI * clamp(age / (1.2 + 0.6 * q))) * (age < 1.2 + 0.6 * q ? 1 : 0), curl = 0.6 + (2 + 4 * q2) * clamp(age / 1.2);
      const near = Math.hypot(x - cp.x, WALL_TOP + 4 - cp.y, SEAWALL_Z - cp.z);
      if (H > 0.5 && near > 9) { const pts = [], ws = [];
        for (let k = 0; k <= 8; k++) { const s = k / 8; pts.push([x, WALL_TOP + 0.1 + H * Math.sin(s * Math.PI * 0.62) - (s > 0.62 ? (s - 0.62) * H * 0.6 : 0), SEAWALL_Z + 0.5 - curl * s * s]); ws.push(6.8 * (0.9 + 0.55 * s)); }
        if (q2 > 0.12 && near > 16) sheetsB.add(pts, ws, { seed: q, alpha: 1, normal: [0, 0.25, 1] });   // whole sheets only: a near one would be a ghost
        const tp = pts[5]; for (let j = 0; j < 3; j++) { const u = h1(i * 3.3 + j * 1.7); drops.add(tp[0] + (u - 0.5) * 2.6, tp[1] + (u - 0.3) * 1.5, tp[2] - u * 1.2, 0.7 + 0.9 * u, K.CLUMP, 1, 0, 0.4, -1, 0.3, u, 1); } }
      for (let j = 0; j < 5; j++) { const u = h1(i * 7 + j), a = age - 0.1 * u; if (a < 0) continue; const v = 8 + 8 * u, y = WALL_TOP + v * a - 0.5 * G * a * a; if (y < 0.3) continue;
        drops.add(x + (u - 0.5) * 2.5, y, SEAWALL_Z - (1.5 + 5 * u) * a, (0.3 + 0.45 * u) * (near < 12 ? 0.45 : 1), j % 2 ? K.CLUMP : K.DROP, 1, 0, v - G * a, -2.5, 0.8, u, 1); }
      if (i % 3 === 0) mist.add(x, WALL_TOP + 2 + 5 * clamp(age / 0.8), SEAWALL_Z - 1.5 - 3 * age, (4 + 5 * q) * clamp(near / 40, 0.35, 1), K.MIST, 0.6 * (1 - smooth(1.4, 3, age)) * smooth(20, 34, near), 0, 1, 0, 0, q);
      for (let j = 0; j < 2; j++) flat.add(x + (h1(i + j) - 0.5) * 3, 0.35, SEAWALL_Z + 1.5 + 3 * h1(i * 3 + j), 2.5 + 2.5 * h1(j + i), K.FOAM, 0.9 * (1 - smooth(1.8, 3, age)), 0, 0, 0, 0.3, h1(i * 5 + j)); }
    // the burst reaching the camera: big drawn drops streaking past the lens (only when it is near)
    const ca = ageOf(t, WAVE.hitX(cp.x));
    if (ca >= 0 && ca < 1.6 && Math.abs(cp.z - SEAWALL_Z) < 12) { const fwd = new V3(); camera.getWorldDirection(fwd); const rt = new V3().crossVectors(fwd, new V3(0, 1, 0)).normalize();
      for (let i = 0; i < 60; i++) { const u = h1(i * 2.71), a = ca - 0.4 * u; if (a < 0) continue;
        const d = 1.2 + 4 * h1(i * 1.3), side = (h1(i * 5.5) - 0.5) * 3.2 * d * 0.6, up = (h1(i * 7.7) - 0.4) * 2.0 * d * 0.5 + 3 * a - 4.9 * a * a;
        drops.add(cp.x + fwd.x * d + rt.x * side, cp.y + up, cp.z + fwd.z * d + rt.z * side, 0.02 + 0.05 * h1(i * 9.9), i % 4 ? K.DROP : K.CLUMP, 1 - smooth(1.0, 1.6, ca), 0.2, -1, 0.6, 1.2, u, 1); } }
    // the pier: tall white spouts burst up between the piles as the crest runs along it (rope columns + drops)
    for (let i = 0; i < 11; i++) { const z = -2.2 - i * 4, age = ageOf(t, WAVE.hitZ(z)); if (age < 0 || age > 1.8) continue;
      for (const side of [-1, 1]) { const q = h1(i * 13 + (side > 0 ? 50 : 0)), Hs = (4 + 4 * q) * Math.sin(Math.PI * clamp(age / 1.4)) * (age < 1.4 ? 1 : 0); if (Hs < 0.3) continue;
        const x = side * (2.1 + 0.4 * q);
        for (let m = 0; m < 6; m++) { const f = (m + 0.5) / 6, r = 0.55 * (1.1 - 0.6 * f) * (0.8 + 0.4 * q);
          rope.add(x + side * f * f * 1.2, Hs * f, z + (q - 0.5) * 0.8, r, Hs / 6 * 0.75, r, 1200 + i * 17 + m + (side > 0 ? 7 : 0), side * 0.25 * f, 1, 0, 0.5, 0.1 - 0.12 * f); }
        for (let j = 0; j < 4; j++) { const u = h1(i * 7 + j + side), a = age - 0.1 * u, v = 4 + 4 * u, y = Hs + v * a * 0.3 - 0.5 * G * Math.max(0, a - 0.6) ** 2; if (y < 0.2) continue;
          drops.add(x + side * (0.6 + 1.5 * u) * a, y, z + (u - 0.5) * 1.6, 0.14 + 0.16 * u, j % 2 ? K.CLUMP : K.DROP, 1, side * 0.4, -0.5, 0, 0.8, u); } } }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // splash-down contact time: the mecha's own value if it publishes one, else the first instant the giant's hull touches
  // the sea in s32 (bisection of the mecha's pure pose; computed once, then the mecha is re-posed at the current time)
  let contactCache = null;
  const shotById = (id) => ctx.shot?.[id] || (Array.isArray(ctx.shots) ? ctx.shots.find(s => s.id === id) : null);
  function contactT() {
    const mech = ctx.modules.mecha, pub = mech?.splashdownT;
    if (typeof pub === 'number' && Number.isFinite(pub)) return pub;
    if (typeof pub === 'function') { const v = pub(); if (Number.isFinite(v)) return v; }
    if (contactCache != null) return contactCache;
    const s32 = shotById('s32'), cur = ctx.state;
    if (!mech?.update || !mech.root || !s32) return cues.splashdown;
    const snap = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v.length]));
    // a self-contained s32 state (no dependence on whatever shot was posed before: the answer is the same in any order)
    const st = (tq) => ({ ...s32, groups: ['coast', 'sky'], look: {}, t: tq, lt: tq - s32.t0, d: s32.t1 - s32.t0, k: (tq - s32.t0) / (s32.t1 - s32.t0), f: Math.round(tq * 24) });
    const minY = (tq) => { mech.update(tq, st(tq)); mech.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(mech.root).min.y; };
    let res = cues.splashdown;
    try { let lo = s32.t0, hi = s32.t0 + 1.4;
      if (minY(lo) <= 0.5) res = lo; else if (minY(hi) > 0.5) res = cues.splashdown;
      else { for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (minY(m) > 0.5) lo = m; else hi = m; } res = hi; }
    } catch (e) { res = cues.splashdown; }
    try { if (cur?.groups) { mech.update(cur.t, cur); mech.root.updateMatrixWorld(true); } } catch (e) { /* the module update loop re-poses it */ }
    for (const k of Object.keys(R)) R[k].length = snap[k];
    contactCache = res; return res;
  }

  // ---------------------------------------------------------------------------------------------------------------------
  const api = {
    splash({ pos, t0, size = 1 }) { R.splash.push([pos, t0, size]); },
    sheets(object, anchors = null, amount = 1, t) { R.sheets.push([object, anchors, amount, t]); },
    drips(object, anchors = null, amount = 1, t) { R.drips.push([object, anchors, amount, t]); },
    rain(center, radius, amount, t) { R.rain.push([center, radius, amount, t]); },
    boil(center, radius, k, t) { R.boil.push([center, radius, k, t]); },
    sprayRing(center, t0, size = 1) { R.ring.push([center, t0, size]); },
    plume(pos, t0, size = 1) { R.plume.push([pos, t0, size]); },
    wave: WAVE, bulgeHeight, sheetsMode: 'full',
    splashdownT: () => contactT(),
    update(t, shot) {
      if (!shot.groups.includes('under')) setFogFromLook(shot.look);
      // s10: the water department directs Clawd's dive (path from under.clawdSink); runs after pilot.update
      const pilot = ctx.modules.pilot, under = ctx.modules.under;
      if (shot.id === 's10' && pilot?.root && under?.clawdSink) {
        const s = under.clawdSink(t);
        if (pilot.place) pilot.place({ pos: s.pos, rotX: s.rot[0], rotY: s.rot[1], rotZ: s.rot[2], emo: s.emo, pose: s.pose, wet: 0, visible: true });
        else { const r = pilot.root, c = pilot.clawd; if (r.parent !== ctx.scene) ctx.scene.add(r);
          r.visible = true; r.position.fromArray(s.pos); r.rotation.set(s.rot[0], s.rot[1], s.rot[2], 'YXZ');
          if (c) { c.setEmotion(s.emo); c.pose({ ...c.emotionPose(s.emo), armL: s.pose.armL, armR: s.pose.armR, squash: s.pose.squash }); } }
      }
    },
    afterCamera(t, shot) {
      const cam = ctx.camera, id = shot.id, coast = shot.groups.includes('coast');
      const ft = Math.floor(t * 8 + 1e-6) / 8;
      // dusk: white water stays white (light colours renormalised), no orange crescents on drops
      const dusk = smooth(63, 66, t);
      for (const b of [mass, big, rope, foamL, crowns, waveC, wallC]) b.uniforms.uLiftL.value = 0.65 * dusk;
      drops.uniforms.uLift.value = mist.uniforms.uLift.value = flat.uniforms.uLift.value = 0.7 * dusk; sheetsB.uniforms.uLift.value = 0.6 * dusk;
      drops.uniforms.uCres.value = 1 - 0.8 * dusk;
      // the splash-down masses get a drawn key from the camera's sun side (the dusk sun sits behind them): a clean 2-tone
      // split, a broad warm lit side + tops, a cool shade side
      const pk = id === 's32' || id === 's33' || id === 's34' ? 1 : 0, kd = pk ? keyFor(cam) : new V3(0, 1, 0);
      for (const b of [big, rope, foamL, crowns, waveC]) b.uniforms.uKeyOv.value.set(kd.x, kd.y, kd.z, pk);
      mass.begin(ft); big.begin(ft); rope.begin(ft); sea.begin(ft); foamL.begin(ft); crowns.begin(); waveC.begin(); wallC.begin(); drops.begin(); dark.begin(); mist.begin(); flat.begin(); sheetsB.begin(ft); refl.visible = false;
      imp.visible = false;
      if (coast) {
        const mech = ctx.modules.mecha, mroot = mech?.root?.visible ? mech.root : null;
        const site = SITE;
        // splashes (s09 default: where the pilot says Clawd hits the water)
        const ps = ctx.modules.pilot?.splash, spl = R.splash.length ? R.splash : (id === 's09' ? [[ps?.pos || [-0.79, 0, 1.3], ps?.t ?? cues.splash, 1]] : []);
        if (on('splash')) for (const [p, t0, s] of spl) crown(p, t0, s, t, { y: seaY(p[0], p[2], t) });
        // s14 boil (s15: only the foam rafts linger, no more bursts flinging drops over the bay)
        const bl = R.boil.length ? R.boil.map(b => [...b, false]) : (id === 's14' ? [[site, 70, smooth(28.6, 31.0, t), t, false]] : id === 's15' ? [[site, 70, 1 - smooth(31.6, 33.5, t), t, true]] : []);
        if (on('boil')) for (const [c, r, k, , rafts] of bl) boil(c, r, k, t, rafts);
        // s15 / s16 / s19 water off the giant: curtains off the top + shoulder edges, drips, churn, foam collar
        const sh = R.sheets.length ? R.sheets : (mroot && (id === 's15' || id === 's16' || id === 's19') ? [[mroot, null, id === 's15' ? 1 : id === 's16' ? 0.75 : 0.25, t]] : []);
        if (on('sheets')) for (const [o, an, am] of sh) pour(o, an, am, t, true, false, R.sheets.length > 0 || api.sheetsMode === 'full');
        const dr = R.drips.length ? R.drips : (mroot && id === 's34' ? [[mroot, null, 0.35, t]] : []);
        if (on('drips')) for (const [o, an, am] of dr) pour(o, an, am, t, true, true);
        // s16: rain from the giant over the pier
        if (on('rain')) { if (R.rain.length) for (const [c, r, am] of R.rain) rainAt(c, r, am, t); else if (id === 's16' && mroot) rainGiant(t, cam, mech); }
        // s20 launch ring
        const rg = R.ring.length ? R.ring : (id === 's20' || id === 's21' ? [[site, cues.launch, 1]] : []);
        if (on('ring')) for (const [c, t0, s] of rg) sprayRing(c, t0, s, t);
        // s32 plume (+ its collapse in s33 / s34), keyed off the hull's contact
        const T0 = api.splashdownT();
        let body = null;
        if (id === 's32' && mroot) { body = new THREE.Box3().setFromObject(mroot); if (body.max.y < 0) body = null; else body.expandByScalar(2); }
        if (on('plume') && id === 's32' && mroot && t < T0 + 0.3) fall(mech, t, T0, cam);
        const pl = R.plume.length ? R.plume : (id === 's32' || id === 's33' || id === 's34' ? [[[site[0], 0, site[2] + 10], T0, 1]] : []);
        if (on('plume')) for (const [p, t0, s] of pl) plume(p, t0, s, t, cam, body, id === 's32');
        // the impact frame on the hit (ones): frame 0 the full burst, frame 1 a smaller ramp
        const n = Math.floor((t - T0) * 24 + 1e-6);
        if (on('plume') && id === 's32' && n >= 0 && n <= 1) { const p = pl[0]?.[0] || [site[0], 0, site[2] + 10];
          _ip.set(p[0], 28, p[2]).project(cam); impU.uC.value.set(_ip.x, _ip.y); impU.uN.value = n; impU.uK.value = [1, 0.7][n]; impU.uDark.value = [0.24, 0.1][n];
          impU.uAsp.value = (ctx.W && ctx.H) ? ctx.W / ctx.H : cam.aspect || 16 / 9; imp.visible = true; }
        if (on('wave') && id === 's33') wave(t, cam);
      }
      mass.end(); big.end(); rope.end(); sea.end(); foamL.end(); crowns.end(); waveC.end(); wallC.end(); drops.end(cam); dark.end(); mist.end(cam); flat.end(); sheetsB.end();
      for (const k of Object.keys(R)) R[k].length = 0;
    },
    dispose() { for (const b of allB) b.mesh.removeFromParent(); refl.removeFromParent(); imp.removeFromParent(); } };
  ctx.modules.water = api;
  return api;
}
