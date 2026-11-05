// MEGA CLAWD · UNDERWATER BAY (owner: water) — the luminous cyan bay where MEGA CLAWD sleeps (s10, s11, s13).
// Same coordinates as the coast: water surface y = 0, pier end at the origin, bay toward +z, metres.
// Bathymetry: a sandy shelf under the pier (y = -6: the world's pier pilings and seawall foot) breaks at z ~ 4 into a steep
// rocky drop-off that falls to the flat mecha bed y = -86 (|x| < 130, z 150..360; the giant lies at (0, -86, 250)).
// Look (bright, never black): luminous cyan water column (fog pass: aqua near the surface, clear blue at depth, a distance
// curve that keeps the middle ground clear and dissolves the far bay), hard-edged anime god rays fanning down from the sun,
// the surface seen from below (a crisp Snell window with the refracted sky, the sun hot spot and a bright rim; outside it a
// darker teal mirror with sparse ripple lines; the pier deck as a hard silhouette with joists and slits of light between
// the planks; cel foam where Clawd broke the surface), sparse caustic knots on up-facing ground only, gouache crags with
// crevice ink, algae and barnacles, giant kelp with gas bladders (olive-amber, swaying on threes), painted pilings with an
// algae band and a mussel / barnacle crust, 2-tone fish schools that turn as a wave (on twos), silt motes, bubbles.
// Everything is a pure function of film time.
//
// API: ctx.modules.under = {
//   floor(x, z)            -> sea-floor height (m)
//   clawdSink(t)           -> { pos: [x,y,z], rot: [rx,ry,rz], pose, emo, ts }: Clawd's dive in s10 (pure, on twos);
//                             fx-water applies it to the pilot's Clawd (or the pilot can call it itself)
//   clawdPath(t)           -> [x,y,z]: the same dive line on ones (raw t) for cameras
//   look(extra?)           -> LOOK partial for any underwater shot (fog pass + rays + light rig). mecha: merge it in LOOKS.s11/s13
//   caustics(material)     -> patches a celMaterial / bgMaterial so it receives the caustic light net while the under set shows
//   siltBurst(pos, t0, size = 1) -> a rolling silt cloud (call from update() every frame; s11 'silt swirls'). Without calls, s11/s13
//                             get default silt rising along the giant's flanks from CUES.eyes (when defaultSilt is true).
//   bubbles(pos, t0, n = 12, size = 1) -> a burst of rising bubbles (call from update() every frame)
//   UNDER                  -> the palette / fog numbers (shallow, deep, density, floorY)
// }
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { spriteBatch, lumpBatch, beamBatch, K, setFogFromLook, hash, clamp, smooth } from './fx-water-kit.js';

const V3 = THREE.Vector3;
export const UNDER = { shallow: 0x7ee8f2, deep: 0x1c94cc, surf: 0xeafffc, density: 0.0042, floorY: -90, rayCol: 0xe6fff6, sun: 0xf4fff0 };

// ---------------------------------------------------------------------------------------------------------------------
// bathymetry
// ---------------------------------------------------------------------------------------------------------------------
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
// the cliff edge: z of the shelf lip at lateral position x (right past the pier end at x = 0, curving out along the bay)
export const cliffZ = (x) => 3 + 0.0016 * x * x + 2.5 * Math.sin(x * 0.11) + 1.5 * Math.sin(x * 0.27 + 1.3);
export function floorHeight(x, z) {
  if (z < 0) return -6;
  const zc = cliffZ(x), dz = z - zc;
  const shelf = -6 - Math.min(z, zc) * 0.08 + 0.35 * Math.sin(x * 0.21 + z * 0.33);
  // near-vertical cliff (ledges from the sine terms), then the long talus slope down to the bed
  const wall = ss(0, 7, dz + 0.8 * Math.sin(z * 1.1 + x * 0.3)) * (34 + 4 * Math.sin(x * 0.07));
  const slope = Math.pow(ss(7, 150, dz), 0.85) * (86 - 7 - 34);
  let y = shelf - wall - slope;
  if (y < -86) y = -86;
  // bed: flat under the giant, gentle dunes elsewhere; the far bay mouth and the bay flanks rise again
  const bed = ss(110, 160, Math.abs(x)) + ss(340, 420, z);
  y += (1.2 * Math.sin(x * 0.045) * Math.cos(z * 0.031) + 2.5 * Math.sin(x * 0.011 + z * 0.017)) * ss(130, 170, z) * Math.min(1, bed);
  y += ss(380, 700, z) * 30 + ss(160, 420, Math.abs(x)) * 24 * ss(60, 160, z);
  return y;
}

// ---------------------------------------------------------------------------------------------------------------------
// caustics: world-anchored light net, broken into sparse knots, cel crisp, animated on threes. Only on up-facing ground
// (gone on vertical faces and overhangs), weaker with depth.
// ---------------------------------------------------------------------------------------------------------------------
const CAUS = { uCausT: { value: 0 }, uCausOn: { value: 0 }, uCausK: { value: 1.0 }, uCausCol: { value: new THREE.Color(0xf2fff4) }, uCausL: { value: new V3(0.1, 1, 0.25).normalize() } };
const CAUS_GLSL = /* glsl */`
uniform float uCausT, uCausOn, uCausK; uniform vec3 uCausCol, uCausL;
vec2 cHash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float cVor(vec2 x, float t){ vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 g = vec2(float(i), float(j)); vec2 o = cHash(n + g); o = 0.5 + 0.4 * sin(t * 0.8 + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(d2) - sqrt(d1); }
float causticNet(vec3 W, float t){
  vec2 p = W.xz - W.y * uCausL.xz / max(uCausL.y, 0.2);
  vec2 w = p + 1.3 * vec2(n2(p * 0.15 + t * 0.07), n2(p * 0.15 + 7.3 - t * 0.06)) + 0.35 * vec2(n2(p * 0.7 - t * 0.1), n2(p * 0.7 + 3.1));
  float a = cVor(w * 1.6, t);
  float wa = 0.01 + 0.06 * n2(p * 0.9 + t * 0.05);
  float la = 1.0 - smoothstep(wa, wa + 0.025, a);
  // sparse: the net survives only in drifting patches, swelling into bright knots there (the rest of the floor stays clean)
  float knot = smoothstep(0.6, 0.72, n2(p * 0.32 + vec2(t * 0.11, -t * 0.07)) * 0.75 + n2(p * 1.1 - t * 0.2) * 0.25);
  return la * knot; }
`;
let ctxGlsl = null;
function patchCaustics(m) {
  return m && m.userData?.toon ? (ctxGlsl.patchShader(m, 'underCaustics', (sh) => {
    Object.assign(sh.uniforms, CAUS);
    sh.fragmentShader = sh.fragmentShader.replace('void main(){', CAUS_GLSL + '\nvoid main(){')
      .replace('gl_FragColor = vec4(col, uMask);', `if (uCausOn > 0.5) { float cdist = length(vW - cameraPosition);
        float ck = causticNet(vW, uCausT) * smoothstep(0.42, 0.85, N.y) * exp(vW.y * 0.014) * (1.0 - smoothstep(50.0, 150.0, cdist)) * uCausK;
        col += uCausCol * ck * (0.35 + 0.65 * lit) * 0.38; }
      gl_FragColor = vec4(col, uMask);`);
  }), m) : m;
}
// painted crevice ink: a hard dark line where the surface folds inward (per-vertex attribute aCrev, 0..1)
function patchCrevice(m, ink = 0x1c3a52) {
  const u = { uCrevInk: { value: new THREE.Color(ink) } };
  return ctxGlsl.patchShader(m, 'underCrevice', (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute float aCrev; varying float vCrev;\n' + sh.vertexShader.replace('vec4 w = modelMatrix * p;', 'vCrev = aCrev; vec4 w = modelMatrix * p;');
    sh.fragmentShader = sh.fragmentShader.replace('void main(){', 'uniform vec3 uCrevInk; varying float vCrev;\nvoid main(){')
      .replace('gl_FragColor = vec4(col, uMask);', `{ float cv = vCrev + (n3(vO * 6.0) - 0.5) * 0.18; float ca = fwidth(cv) * 0.8 + 1e-3;
        col = mix(col, uCrevInk * (0.55 + 0.45 * vIC), smoothstep(0.55 - ca, 0.55 + ca, cv) * 0.92); }
      gl_FragColor = vec4(col, uMask);`);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// the underwater fog + god-ray pass (pipeline 'water' slot: after paint + ink, before atmosphere)
// ---------------------------------------------------------------------------------------------------------------------
const FOG_FS = (NOISE) => /* glsl */`${NOISE}
uniform sampler2D tDiffuse, tData; uniform vec2 uRes; uniform vec3 uCamPos, uCamR, uCamU, uCamF; uniform vec2 uTanH;
uniform vec3 uShallow, uDeep, uSun, uRayCol, uSunDir, uAbsCol; uniform float uDen, uDen2, uFloorY, uRayK, uRayScale, uT, uRayDepth, uSunK, uAbs, uRayMax, uGrad;
varying vec2 vUv;
vec3 rayDir(vec2 uv){ vec2 n = uv * 2.0 - 1.0; return uCamR * n.x * uTanH.x + uCamU * n.y * uTanH.y + uCamF; }
vec3 waterAt(float y){ return mix(uDeep, uShallow, pow(smoothstep(uFloorY, 0.0, y), uGrad)); }
float shaft(vec3 P){
  vec2 q = P.xz - P.y * uSunDir.xz / max(uSunDir.y, 0.2);
  float a = n2(q * uRayScale + vec2(uT * 0.05, 0.0)), b = n2(q * uRayScale * 2.9 + 11.0 - vec2(0.0, uT * 0.08)), c = n2(q * uRayScale * 0.37 + 5.0);
  float s = smoothstep(0.6, 0.7, a * 0.62 + b * 0.24 + c * 0.14) + 0.35 * smoothstep(0.74, 0.8, b);
  return s * exp(P.y / uRayDepth);
}
void main(){
  vec4 c0 = texture2D(tDiffuse, vUv); vec4 dat = texture2D(tData, vUv); float D = dat.z; bool sky = D > 30000.0 || D < 1e-3;
  bool cel = dat.w > 0.5 && dat.w < 99.5;
  vec3 rd = rayDir(vUv); vec3 dir = normalize(rd);
  float dist = sky ? 3000.0 : length(rd) * D;
  vec3 P = uCamPos + dir * dist;
  float yEnd = sky ? (dir.y > 0.0 ? 0.0 : uFloorY) : clamp(P.y, uFloorY, 0.0);
  // far away the water colour follows the view direction (bright overhead, deep blue below), not what the ray hit, so the
  // distant bed and the distant surface melt into one smooth gradient with no seam
  float yDir = clamp(uCamPos.y + dir.y * 140.0, uFloorY, 0.0);
  yEnd = mix(yEnd, yDir, smoothstep(40.0, 160.0, dist));
  vec3 fc = waterAt(mix(uCamPos.y, yEnd, 0.6));
  float sunF = pow(max(dot(dir, uSunDir), 0.0), 3.0);
  fc += uSun * sunF * uSunK;
  float f = max(1.0 - exp(-uDen * dist - uDen2 * dist * dist), smoothstep(280.0, 560.0, dist));   // no underwater 'horizon'
  float ab = clamp(uAbs * (0.6 * smoothstep(0.0, uFloorY, P.y) + 0.8 * (1.0 - exp(-dist * 0.012))), 0.0, 1.0);
  vec3 obj = c0.rgb * mix(vec3(1.0), uAbsCol, ab);
  vec3 col = sky ? fc : mix(obj, fc, f);
  // volumetric shafts: march the view ray through the world-anchored light-shaft field
  float md = min(dist, uRayMax); float acc = 0.0; float j = h12(gl_FragCoord.xy);
  const int N = 32;
  for (int i = 0; i < N; i++){ float u = (float(i) + j) / float(N); float s = u * u * md; vec3 X = uCamPos + dir * s;
    if (X.y > 0.0) continue;
    acc += shaft(X) * exp(-0.03 * s) * 2.0 * u * md / float(N); }
  vec3 ray = uRayCol * acc * uRayK * 0.022;
  // over characters the shafts brighten in the character's own hue (a cyan wash would push Clawd off his model hue)
  if (cel && !sky) ray = c0.rgb / max(max(c0.r, max(c0.g, c0.b)), 1e-3) * dot(ray, vec3(0.333)) * 0.7;
  col += ray;
  col = clamp(col, 0.0, 64.0);
  gl_FragColor = vec4(col, c0.a); }`;

// ---------------------------------------------------------------------------------------------------------------------
// the surface seen from below
// ---------------------------------------------------------------------------------------------------------------------
const SURF_FS = (NOISE) => /* glsl */`${NOISE} ${CAUS_GLSL}
uniform float uT, uDeckY; uniform vec3 uWin, uSkyHi, uRimC, uOut, uOutLine, uDeck, uDeckDark, uSunDir, uFoam, uFoamSh; uniform vec4 uChurn; varying vec3 vW;
void main(){
  vec3 V = normalize(cameraPosition - vW), I = -V; vec2 p = vW.xz; float dist = length(cameraPosition - vW);
  float e = 0.35; vec2 q1 = p * 0.16 + vec2(uT * 0.10, uT * 0.06), q2 = p * 0.47 - vec2(uT * 0.13, -uT * 0.09);
  float h = fbm2(q1) + 0.4 * fbm2(q2), hx = fbm2(q1 + vec2(e * 0.16, 0.0)) + 0.4 * fbm2(q2 + vec2(e * 0.47, 0.0)), hz = fbm2(q1 + vec2(0.0, e * 0.16)) + 0.4 * fbm2(q2 + vec2(0.0, e * 0.47));
  float fade = exp(-dist * 0.03); vec2 g = vec2(hx - h, hz - h) / e * fade;
  vec3 N = normalize(vec3(g.x * 0.5, -1.0, g.y * 0.5));                 // rippled surface normal, facing down into the water
  float cosT = dot(I, -N);
  // Snell window (critical angle 48.6 deg: a 97 deg cone around the vertical): crisp edge, a bright squeezed-horizon rim
  float win = smoothstep(0.646, 0.662, cosT);
  float rimB = win * (1.0 - smoothstep(0.662, 0.70, cosT + (n2(p * 2.0 + uT) - 0.5) * 0.02));
  vec3 T = refract(I, N, 1.333);
  // inside: the refracted sky (paler toward the rim), the sun's hot spot + its shimmering glow
  vec3 col = mix(uSkyHi, uWin, smoothstep(0.68, 0.98, cosT));
  float sd = dot(I, uSunDir) + (h - 0.6) * 0.012;
  col += vec3(1.0, 0.99, 0.92) * (smoothstep(0.9988, 0.9993, sd) * 1.4 + pow(max(sd, 0.0), 400.0) * 0.5 + pow(max(sd, 0.0), 40.0) * 0.12);
  col = mix(col, uRimC, rimB * 0.85);
  // the pier deck above, seen through the window with the refraction parallax: a hard dark silhouette, joists, cross
  // beams at each bent, thin bright slits of sky between the planks
  if (T.y > 0.05) {
    vec2 dq = p + T.xz * (uDeckY / T.y) + g * 0.06;
    float inD = step(abs(dq.x), 1.65) * step(dq.y, 0.2) * step(-42.0, dq.y);
    float slit = step(0.86, fract(dq.y / 0.2)) * step(abs(dq.x), 1.5);
    float joist = max(step(abs(abs(dq.x) - 1.42), 0.07), step(abs(abs(dq.x) - 0.55), 0.05));
    float cap = step(abs(fract((dq.y + 0.2) / 4.0 + 0.5) - 0.5) * 4.0, 0.16);
    vec3 dk = mix(uDeck, uSkyHi * 0.95, slit * (1.0 - joist) * (1.0 - cap));
    dk = mix(dk, uDeckDark, max(joist, cap));
    col = mix(col, dk, inD * win);
  }
  // outside: total internal reflection mirrors the deep water: a darker teal with sparse drawn ripple lines
  float lw = 0.012 + 0.01 * fade;
  float rl = (1.0 - smoothstep(lw, lw + 0.012, abs(h - 0.66 + 0.05 * n2(p * 0.9)))) * smoothstep(0.62, 0.3, cosT) * (1.0 - smoothstep(25.0, 90.0, dist));
  vec3 outC = mix(uOut, uOutLine, rl * 0.8);
  outC = mix(outC, uOut * 1.25, smoothstep(0.45, 0.646, cosT) * 0.6);   // lighter just outside the window
  col = mix(outC, col, win);
  // cel ripple bands + the caustic net inside the window (thinned), none in the mirror zone
  float band = step(0.64, h + 0.08 * n2(p * 1.3));
  col = mix(col, col * 1.06 + 0.03, band * win);
  float net = causticNet(vec3(p.x + g.x * 2.0, 0.0, p.y + g.y * 2.0), uT) * (1.0 - smoothstep(12.0, 60.0, dist));
  col = mix(col, vec3(1.0), net * win * 0.55);
  // churned water where Clawd broke the surface: cel foam (2 hard tones, scalloped bubble-clump edge, holes, drawn rings)
  vec2 cd = p - uChurn.xy; float cr = length(cd) / max(uChurn.z, 1e-3), an = atan(cd.y, cd.x);
  float sc = 0.86 + 0.08 * sin(an * 7.0 + uT * 2.0) + 0.05 * sin(an * 13.0 - uT * 3.0) + (n2(p * 3.0 + uT) - 0.5) * 0.2;
  float foam = step(cr, sc) * uChurn.w;
  float hole = step(0.68, n2(p * 5.5 + vec2(uT * 0.7, 0.0)) * 0.7 + n2(p * 13.0 - uT) * 0.3) * smoothstep(0.3, 0.8, cr);
  vec2 bq = p * 9.0 + vec2(0.0, uT * 2.0); vec2 bi = floor(bq), bf = fract(bq) - 0.5; float br = 0.18 + 0.2 * h12(bi);
  float ring = step(h12(bi + 3.1), 0.35) * (1.0 - smoothstep(0.02, 0.06, abs(length(bf) - br)));
  vec3 fc2 = mix(uFoam, uFoamSh, step(0.55, n2(p * 2.4 - uT * 0.4) + cr * 0.25));
  fc2 = mix(fc2, uFoamSh * 0.92, ring);
  col = mix(col, fc2, foam * (1.0 - hole));
  gl_FragColor = vec4(col, 1.0); }`;

export async function create(ctx) {
  const { sets, mat, cues, onThrees, onTwos, util } = ctx;
  ctxGlsl = ctx.glsl;
  const g = new THREE.Group(); g.name = 'under'; sets.under.add(g);
  const R = ctx.rng(1032);
  const floor = floorHeight;
  const inUnder = (shot) => shot.groups.includes('under');

  // ---- sea floor (painted, vertex colours: pale sand flats, teal rock on steep ground, grass patches; caustics) ----
  {
    const axis = (a, b, f) => { const o = [a]; while (o[o.length - 1] < b) o.push(o[o.length - 1] + f(o[o.length - 1])); return o; };
    const xs = axis(-500, 500, (x) => Math.abs(x) < 30 ? 0.8 : Math.abs(x) < 120 ? 2.5 : 8);
    const zs = axis(-46, 720, (z) => z < -12 ? 2 : z < 34 ? 0.6 : z < 80 ? 2 : z < 200 ? 4 : 8);
    const geo = new THREE.BufferGeometry(), gp = [], gi = [];
    for (const z of zs) for (const x of xs) gp.push(x, 0, z);
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; gi.push(a, c, b, b, c, d); }
    geo.setIndex(gi); geo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    const p = geo.attributes.position, col = [];
    const sand = new THREE.Color(0xbfeadc), sand2 = new THREE.Color(0x9edcd2), rock = new THREE.Color(0x4f98b0), grass = new THREE.Color(0x6cbc94), deepS = new THREE.Color(0xb4e4ec);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = floor(x, z); p.setY(i, y);
      const e = 0.8, sl = Math.hypot(floor(x + e, z) - floor(x - e, z), floor(x, z + e) - floor(x, z - e)) / (2 * e);
      const n = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.sin(z * 0.09) * 2.0) * Math.cos(z * 0.11 - x * 0.03);
      const c = sand.clone().lerp(sand2, n * 0.7).lerp(deepS, ss(-20, -80, y) * 0.5).lerp(rock, ss(0.45, 0.9, sl)).lerp(grass, ss(0.72, 0.95, n) * ss(-3, -10, y) * (1 - ss(-20, -40, y)) * 0.7);
      col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const fm = patchCaustics(mat.bg(0xffffff, { vertexColors: true, pig: 0.22, hiAmt: 0.3, cool: 0.5 }));
    const fl = new THREE.Mesh(geo, fm); fl.name = 'under-floor'; g.add(fl);
  }

  // ---- the surface seen from below ----
  const surfU = { uT: { value: 0 }, uDeckY: { value: (ctx.modules.world?.pier?.deckY ?? 2.2) - 0.35 },
    uWin: { value: new THREE.Color(0x6ccae2) }, uSkyHi: { value: new THREE.Color(0xa6e6ee) }, uRimC: { value: new THREE.Color(0xe0fbf2) },
    uOut: { value: new THREE.Color(0x2580a6) }, uOutLine: { value: new THREE.Color(0x5cb8d2) }, uDeck: { value: new THREE.Color(0x1d4c5c) }, uDeckDark: { value: new THREE.Color(0x0f3040) },
    uFoam: { value: new THREE.Color(0xf6fffe) }, uFoamSh: { value: new THREE.Color(0xa4dcec) },
    uChurn: { value: new THREE.Vector4(0, 0, 0, 0) }, uSunDir: { value: new V3(0.1, 1, 0.25).normalize() }, ...CAUS };
  const surfM = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: surfU,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: SURF_FS(ctx.glsl.NOISE) });
  ctx.mat.mrt(surfM, { id: ctx.mat.ID.BG, normal: 'normalize(mat3(viewMatrix) * vec3(0.0, -1.0, 0.0))' });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(Math.PI / 2), surfM); surf.position.y = 0; surf.name = 'under-surface'; g.add(surf);

  // ---- jagged rocks: gouache crags (2 tones, crisp creases, crevice ink, algae tops, barnacle specks; caustics) ----
  const vn = (x, y, z) => { const h = (a, b, c) => hash(a * 12.9898 + b * 78.233 + c * 37.719); const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf); const L = (a, b, k) => a + (b - a) * k;
    return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v), L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w); };
  const ridged = (x, y, z) => 1 - Math.abs(2 * vn(x, y, z) - 1);
  const protos = [];
  for (let k = 0; k < 7; k++) {
    let geo = new THREE.IcosahedronGeometry(1, 4); geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo);
    const p = geo.attributes.position, s = k * 7.31, tall = 0.6 + 0.6 * hash(k + 0.5), lean = (hash(k + 3.3) - 0.5) * 0.5;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // big lumps + sharp crag ridges + stratified ledges (crags, not facets)
      let r = 1 + 0.4 * (vn(x * 1.3 + s, y * 1.3, z * 1.3) - 0.5) + 0.28 * (ridged(x * 2.4, y * 2.4 + s, z * 2.4) - 0.5) + 0.1 * (ridged(x * 5.5 + s, y * 5.5, z * 5.5) - 0.5);
      let yy = y * tall * r; const step = 0.22 + 0.1 * hash(k * 3.1), lq = Math.round(yy / step) * step; yy = yy + (lq - yy) * 0.45;
      if (yy < -0.15) yy = -0.15 + (yy + 0.15) * 0.25;
      p.setXYZ(i, x * r + lean * yy, yy, z * r * (0.8 + 0.3 * hash(k))); }
    geo.computeVertexNormals();
    // crevice = how far the vertex sits inside its neighbours (concavity), from the index
    const idx = geo.index.array, nb = new Float32Array(p.count * 4);
    for (let t = 0; t < idx.length; t += 3) for (let a = 0; a < 3; a++) { const i = idx[t + a]; for (let b = 1; b < 3; b++) { const j = idx[t + (a + b) % 3]; nb[i * 4] += p.getX(j); nb[i * 4 + 1] += p.getY(j); nb[i * 4 + 2] += p.getZ(j); nb[i * 4 + 3]++; } }
    const nrm = geo.attributes.normal, crev = new Float32Array(p.count), vc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const c = nb[i * 4 + 3] || 1, dx = nb[i * 4] / c - p.getX(i), dy = nb[i * 4 + 1] / c - p.getY(i), dz = nb[i * 4 + 2] / c - p.getZ(i);
      crev[i] = clamp((dx * nrm.getX(i) + dy * nrm.getY(i) + dz * nrm.getZ(i)) * 34 + 0.12);
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = nrm.getY(i);
      // algae tufts on up-facing ledges (olive-green, hard patches), barnacle specks near the top, base colour elsewhere
      const alg = ny > 0.45 && vn(x * 3 + s, y * 3, z * 3) > 0.5 ? 1 : 0, barn = hash(i * 1.37 + k) > 0.94 && y > 0 ? 1 : 0;
      const c0 = alg ? [0.62, 0.86, 0.5] : barn ? [1.35, 1.35, 1.3] : [1, 1, 1]; vc.set(c0, i * 3); }
    geo.setAttribute('aCrev', new THREE.BufferAttribute(crev, 1)); geo.setAttribute('color', new THREE.BufferAttribute(vc, 3));
    const fg = toCreasedNormals(geo, 0.5); protos.push(fg);
  }
  const rockM = patchCrevice(patchCaustics(mat.bg(0xffffff, { pig: 0.18, cool: 0.55, soft: 0.012, hiAmt: 0.35, hiT: 0.6, brush: 0.14, shade: 0xa2bce4, vertexColors: true })));
  const rocks = []; // [x, z, size, proto, yaw, c]
  const clearOf = (x, z, r) => {
    if (Math.abs(x) < 110 + r && z > 165 - r && z < 335 + r) return false;            // the giant's bed
    if (Math.abs(x + 0.5) < 2.6 + r && z > -44 && z < 22) return false;                 // under the pier + Clawd's dive lane
    return true; };
  for (let i = 0; i < 420; i++) {
    const zone = R();
    let x, z, s;
    if (zone < 0.35) { x = (R() - 0.5) * 220; z = 8 + R() * 70; s = 0.6 + Math.pow(R(), 2.2) * 9; }            // drop-off edge + slope
    else if (zone < 0.55) { x = (R() - 0.5) * 120; z = -40 + R() * 54; s = 0.25 + Math.pow(R(), 3) * 2.2; }      // shelf pebbles + rocks
    else if (zone < 0.85) { const a = R() * Math.PI * 2, rr = 120 + R() * 90; x = Math.cos(a) * rr * 1.2; z = 250 + Math.sin(a) * rr; s = 2 + Math.pow(R(), 1.8) * 20; }  // ring of the bed
    else { x = (R() - 0.5) * 500; z = 60 + R() * 480; s = 3 + Math.pow(R(), 1.5) * 24; }
    if (!clearOf(x, z, s)) continue;
    rocks.push([x, z, s, Math.floor(R() * protos.length), R() * 6.28, R()]);
  }
  // hero crags framing the drop-off left and right of the dive lane
  rocks.push([-9, 22, 7, 5, 0.6, 0.2], [-14, 30, 10, 3, 2.1, 0.5], [8.5, 30, 6, 6, 1.2, 0.7], [16, 44, 13, 4, 0.2, 0.4], [-28, 46, 16, 2, 2.6, 0.3], [30, 70, 18, 1, 1.0, 0.6],
    [-5.5, 5.5, 2.2, 0, 0.4, 0.15], [4.6, 6.5, 2.6, 3, 2.2, 0.55], [-4.2, -2.5, 1.3, 6, 1.1, 0.8]);
  const rockCols = [0x5a9cb4, 0x6aa8b8, 0x5490b0, 0x76b0bc, 0x689cb0];
  protos.forEach((geo, pi) => {
    const list = rocks.filter(r => r[3] === pi); if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, rockM, list.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new V3(), P = new V3();
    list.forEach((r, i) => { const [x, z, s, , yaw, c] = r; P.set(x, floor(x, z) - 0.18 * s, z); Q.setFromEuler(new THREE.Euler((c - 0.5) * 0.25, yaw, (hash(c * 9) - 0.5) * 0.25));
      S.set(s * (0.9 + 0.4 * c), s * (0.8 + 0.5 * hash(c * 3)), s * (0.9 + 0.4 * hash(c * 5))); M.compose(P, Q, S); im.setMatrixAt(i, M); im.setColorAt(i, new THREE.Color(rockCols[Math.floor(c * 5) % 5])); });
    im.name = 'under-rocks'; g.add(im);
  });

  // ---- kelp: giant kelp (stipe, blades on gas bladders, a streaming canopy) in tall clusters framing the drop-off, short
  //      kelp on the shelf. Olive-amber, 2 tones, inked; sway on threes in the vertex shader ----
  const KT = { value: 0 };
  const bladders = [];
  {
    const pos = [], col = [], kk = [], idx = []; let base = 0;
    const strands = [];   // [x, z, h, giant]
    // clusters framing the drop-off: on the lip (8-15 m, up to the surface) and down the slope, where the forest rises
    // from the deep in tall columns toward the light (they stand at the sides of the s10 end frame)
    const clusters = [[-4.2, 6.5, 4], [3.6, 7.5, 4], [-7.5, 22, 5], [8, 26, 5], [-10.5, 32, 5], [11.5, 38, 4], [-15, 46, 4], [16, 52, 4], [-20, 62, 4], [22, 70, 4],
      [-26, 18, 4], [27, 22, 4], [-34, 38, 3], [36, 44, 3]];
    for (const [cx, cz, n] of clusters) for (let i = 0; i < n; i++) { const x = cx + (R() - 0.5) * 3.2, z = cz + (R() - 0.5) * 3.2, fy = floor(x, z);
      if (Math.abs(x + 0.5) < 2.2 && z < 22) continue;
      const deep = fy < -18, h = deep ? clamp(-fy - (3 + 9 * R()), 8, 34) : Math.min(8 + R() * 7, -fy - 0.8);
      strands.push([x, z, h, 1]); }
    for (let i = 0; i < 200; i++) {
      const zone = R(); let x, z, h;
      if (zone < 0.6) { x = (R() - 0.5) * 120; z = -38 + R() * 42; h = 2.6 + R() * 2.6; }               // shelf kelp (6 m deep)
      else { const a = R() * Math.PI * 2, rr = 125 + R() * 70; x = Math.cos(a) * rr * 1.15; z = 250 + Math.sin(a) * rr; h = 9 + R() * 8; }   // around the bed
      if (!clearOf(x, z, 1.5) || (Math.abs(x + 0.5) < 3.4 && z > -8 && z < 22)) continue;
      const fy = floor(x, z); if (fy + h > -0.6) h = -0.6 - fy; if (h < 1.5) continue;
      strands.push([x, z, h, zone >= 0.6 ? 1 : 0]);
    }
    strands.push([-3.4, -3.2, 4.8, 0], [-4.6, 2.4, 5.2, 0], [3.2, 1.5, 5.0, 0], [4.8, -2.2, 4.6, 0]);   // around the pier end
    const kc = [0x9a8a30, 0xa89434, 0xb08a2e, 0x8c8a34, 0xb89a3a, 0x988230];
    const ribbon = (pts, ws, angs, c, kh, ph, amp) => {
      pts.forEach((q, r) => { const a = angs[r], w = ws[r];
        for (const sgn of [-1, 1]) { pos.push(q[0] + Math.cos(a) * w * 0.5 * sgn, q[1], q[2] + Math.sin(a) * w * 0.5 * sgn);
          col.push(c.r, c.g, c.b); kk.push(kh[r], ph, amp); } });
      for (let r = 0; r < pts.length - 1; r++) { const a = base + r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      base += pts.length * 2; };
    for (const [x, z, h, giant] of strands) {
      const fy = floor(x, z), rows = Math.max(6, Math.round(h * 1.6)), yaw = R() * 6.28, ph = R() * 6.28, twist = (R() - 0.5) * 1.6;
      const c = new THREE.Color(kc[Math.floor(R() * kc.length)]), amp = (0.3 + 0.2 * R()) * Math.min(h, 10) * 0.12, lean = (R() - 0.5) * 0.4;
      const cl = (u) => [x + (0.3 * Math.sin(u * 3 + ph) + lean) * u * h * 0.12, fy + u * h, z + 0.3 * Math.cos(u * 2.4 + ph) * u * h * 0.1];
      // stipe: two crossed ribbons (reads round from any side)
      for (const ya of [yaw, yaw + Math.PI / 2]) { const sp = [], sw = [], sa = [], sk = [];
        for (let r = 0; r <= rows; r++) { const u = r / rows; sp.push(cl(u)); sw.push(0.05 + 0.035 * (1 - u)); sa.push(ya + twist * u); sk.push(u); }
        ribbon(sp, sw, sa, c.clone().multiplyScalar(0.8), sk, ph, amp); }
      // blades: long wavy ribbons streaming up and out, each on a gas bladder (giant kelp), alternating up the stipe
      const nf = Math.max(4, Math.round(h * (giant ? 1.7 : 1.4)));
      for (let f = 0; f < nf; f++) { const u0 = 0.12 + 0.86 * (f + 0.5) / nf + (R() - 0.5) * 0.04, b0 = cl(u0), side = yaw + (f % 2 ? 0 : Math.PI) + (R() - 0.5) * 0.8;
        const L = (giant ? 1.1 + 0.9 * R() : 0.6 + 0.6 * R()) * (u0 > 0.85 ? 1.4 : 1), W = (giant ? 0.17 : 0.13) + 0.08 * R(), up = 0.55 + 0.35 * R(), seg = 7;
        if (giant) bladders.push([b0[0] + Math.cos(side) * 0.07, b0[1] + 0.05, b0[2] + Math.sin(side) * 0.07, 0.05 + 0.025 * R(), Math.min(1, u0), ph, amp]);
        const fp = [], fw = [], fa = [], fk = [];
        for (let s = 0; s <= seg; s++) { const v = s / seg, out = Math.sin(v * 1.3) * L * (1 - up * 0.55) + 0.07, dy = v * L * up + 0.04;
          fp.push([b0[0] + Math.cos(side) * out, b0[1] + dy, b0[2] + Math.sin(side) * out]);
          // ruffled edge: width wobbles along the blade; tapered at both ends
          fw.push(W * Math.sin(Math.min(1, v * 1.15 + 0.08) * Math.PI) * (0.8 + 0.35 * Math.sin(s * 2.9 + f)) + 0.01); fa.push(side + Math.PI / 2 + 0.5 * v + 0.3 * Math.sin(s * 1.7)); fk.push(Math.min(1, u0 + v * L / h)); }
        ribbon(fp, fw, fa, c.clone().multiplyScalar(0.95 + 0.15 * R()), fk, ph, amp); }
      // canopy: blades streaming along the current at the top
      const top = cl(1);
      for (let b = 0; b < (giant ? 4 : 2); b++) { const tp = [], tw = [], ta = [], tk = [], da = yaw + b * 1.4, Lt = giant ? 1.6 + R() : 0.8;
        for (let s = 0; s <= 7; s++) { const v = s / 7; tp.push([top[0] + Math.cos(da) * v * Lt, top[1] + v * 0.35 - 0.2 * v * v, top[2] + Math.sin(da) * v * Lt]); tw.push(0.22 * Math.sin(Math.min(1, v * 1.1 + 0.1) * Math.PI) + 0.03); ta.push(da + Math.PI / 2 + 0.4 * Math.sin(s * 1.3)); tk.push(1); }
        ribbon(tp, tw, ta, c.clone().multiplyScalar(1.05), tk, ph, amp);
        if (giant) bladders.push([top[0], top[1] + 0.03, top[2], 0.075, 1, ph, amp]); }
    }
    const geo = new THREE.BufferGeometry(); geo.setIndex(idx); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 3)); geo.computeVertexNormals();
    const swayVS = (sh) => { sh.uniforms.uKT = KT;
      sh.vertexShader = 'attribute vec3 aK; uniform float uKT;\n' + sh.vertexShader.replace('vec4 w = modelMatrix * p;', `
        float kh = aK.x; float sw = sin(uKT * 0.9 + aK.y - kh * 1.2) * 0.7 + sin(uKT * 1.6 + aK.y * 2.3 - kh * 2.0) * 0.3;
        p.x += sw * aK.z * kh * kh; p.z += cos(uKT * 0.7 + aK.y * 1.3 - kh) * 0.6 * aK.z * kh * kh;
        vec4 w = modelMatrix * p;`); };
    const km = patchCaustics(mat.cel(0xffffff, { id: mat.nextId(), side: THREE.DoubleSide, vertexColors: true, hiAmt: 0.0, rimI: 0.3, spec: 0.0, backK: 0.88, trans: 0.22, shade: 0x6c7a86 }));
    ctx.glsl.patchShader(km, 'kelpSway', swayVS);
    const kelp = new THREE.Mesh(geo, km); kelp.name = 'under-kelp'; kelp.frustumCulled = false; g.add(kelp);
    // gas bladders (instanced amber floats, sway with their blade)
    const bg = new THREE.SphereGeometry(1, 10, 7); bg.scale(0.8, 1.15, 0.8);
    const bk = new Float32Array(bladders.length * 3); bladders.forEach((b, i) => bk.set([b[4], b[5], b[6]], i * 3));
    bg.setAttribute('aK', new THREE.InstancedBufferAttribute(bk, 3));
    const bm = mat.cel(0xc89a36, { id: mat.nextId(), hiAmt: 0.6, hiT: 0.55, spec: 0.5, rimI: 0.3, shade: 0x7c7a6a });
    ctx.glsl.patchShader(bm, 'kelpSwayB', (sh) => { sh.uniforms.uKT = KT;
      sh.vertexShader = 'uniform float uKT;\n' + sh.vertexShader.replace('vec4 w = modelMatrix * p;', `
        float kh = aK.x; float sw = sin(uKT * 0.9 + aK.y - kh * 1.2) * 0.7 + sin(uKT * 1.6 + aK.y * 2.3 - kh * 2.0) * 0.3;
        p.x += sw * aK.z * kh * kh; p.z += cos(uKT * 0.7 + aK.y * 1.3 - kh) * 0.6 * aK.z * kh * kh;
        vec4 w = modelMatrix * p;`).replace('void main(){', 'attribute vec3 aK;\nvoid main(){'); });
    const bim = new THREE.InstancedMesh(bg, bm, bladders.length), M = new THREE.Matrix4();
    bladders.forEach((b, i) => { M.makeScale(b[3], b[3], b[3]).setPosition(b[0], b[1], b[2]); bim.setMatrixAt(i, M); });
    bim.name = 'under-kelp-bladders'; bim.frustumCulled = false; g.add(bim);
  }

  // ---- pier pilings (the underwater half of the world's pier): painted wood grain, a dark-green algae band, a crust of
  //      mussels + barnacles near the waterline, cel shade side, inked ----
  {
    const pil = ctx.modules.world?.pier?.pilings || (() => { const a = []; for (let z = -40; z <= 0; z += 4) for (const x of [-1.4, 1.4]) a.push([x, z - 0.2, 0.17]); return a; })();
    const wood = new THREE.Color(0x7a6a52), woodD = new THREE.Color(0x5a4c3c), algae = new THREE.Color(0x2f6648), algaeL = new THREE.Color(0x4a8a4c);
    const pm = patchCaustics(mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, hiAmt: 0.25, hiT: 0.7, rimI: 0.35, spec: 0, shade: 0x6a7c98 }));
    const crustM = mat.cel(0xffffff, { id: mat.nextId(), vertexColors: false, hiAmt: 0.5, spec: 0.3, rimI: 0.2 });
    const shells = [];
    pil.forEach(([x, z, r], pi) => {
      const y0 = floor(x, z) - 0.3, L = -y0 + 0.4, rows = Math.ceil(L / 0.12);
      const geo = new THREE.CylinderGeometry(r, r * 1.06, L, 18, rows, true), p = geo.attributes.position, c = [];
      for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), wy = py + y0 + L / 2, an = Math.atan2(pz, px);
        // wood grain: wavering vertical streaks, a few dark knots
        const grain = vn(an * 4.5 + pi * 3, wy * 0.35, pi) * 0.7 + vn(an * 11 + pi, wy * 1.6, 2) * 0.3;
        let cc = wood.clone().lerp(woodD, grain > 0.55 ? 1 : 0);
        // algae band (dark green, ragged edges) from just under the crust down ~1.6 m, light green fuzz spots
        const top = -0.95 + 0.18 * Math.sin(an * 3 + pi), bot = -2.6 + 0.35 * Math.sin(an * 2 + pi * 1.7);
        if (wy < top && wy > bot) cc = (vn(an * 6, wy * 4, pi) > 0.62 ? algaeL : algae).clone();
        else if (wy <= bot && vn(an * 5 + 1, wy * 2, pi) > 0.7) cc = algae.clone();
        // waterline crust colour under the shells (blue-black mussel bed)
        if (wy >= top && wy < -0.12) cc = new THREE.Color(0x2a3248);
        c.push(cc.r, cc.g, cc.b);
        // pinch the radius a little (worn wood)
        const k = 1 + 0.03 * (vn(an * 3, wy * 0.8, pi) - 0.5); p.setX(i, px * k); p.setZ(i, pz * k); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, pm); m.position.set(x, y0 + L / 2, z); m.name = 'under-piling'; g.add(m);
      // the crust: mussels (dark elongated) + barnacles (white cones) in a band from -0.12 to ~ -1.0
      for (let i = 0; i < 46; i++) { const an = hash(pi * 31 + i * 1.7) * Math.PI * 2, wy = -0.15 - 0.85 * Math.pow(hash(pi * 7 + i * 2.3), 1.3), barn = hash(i * 3.1 + pi) > 0.55;
        shells.push([x + Math.cos(an) * r * 1.02, wy, z + Math.sin(an) * r * 1.02, an, barn, 0.035 + 0.03 * hash(i + pi * 2)]); }
    });
    const mg = new THREE.SphereGeometry(1, 8, 5); mg.scale(0.55, 1.1, 0.45);
    const bgeo = new THREE.ConeGeometry(1, 0.9, 7, 1, true); bgeo.rotateX(Math.PI / 2); bgeo.translate(0, 0, 0.45);
    const mus = shells.filter(s => !s[4]), bar = shells.filter(s => s[4]);
    const place = (geo, list, color) => { const im = new THREE.InstancedMesh(geo, crustM, list.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
      list.forEach(([x, y, z, an, , s], i) => { E.set(0.3 * Math.sin(i), -an + Math.PI / 2, 0.4 * Math.cos(i * 1.3)); Q.setFromEuler(E); M.compose(new V3(x, y, z), Q, new V3(s, s, s)); im.setMatrixAt(i, M);
        im.setColorAt(i, new THREE.Color(color).multiplyScalar(0.85 + 0.3 * hash(i * 9.1))); });
      im.name = 'under-crust'; g.add(im); };
    place(mg, mus, 0x30364e); place(bgeo, bar, 0xe8e2d2);
  }

  // ---- fish: 2-tone cel (blue-green back, silver belly, a dark eye), inked; schools on twos that turn as a wave, with a
  //      catch-light flash as each fish's flank swings to the light ----
  const fishGeo = (() => {
    const b = new THREE.SphereGeometry(0.5, 14, 8); b.scale(0.22, 0.36, 1.0);
    const bp = b.toNonIndexed(), a = bp.attributes.position.array;
    // tail fin (forked) + dorsal fin (thin triangles)
    const fin = [0, 0, -0.44, 0, 0.27, -0.8, 0, 0.05, -0.62, 0, 0, -0.44, 0, -0.05, -0.62, 0, -0.27, -0.8, 0, 0.16, -0.05, 0, 0.3, -0.22, 0, 0.17, -0.3];
    const arr = new Float32Array(a.length + fin.length); arr.set(a); arr.set(fin, a.length);
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const cols = []; for (let i = 0; i < arr.length / 3; i++) { const x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
      const eye = z > 0.26 && z < 0.36 && y > 0.0 && y < 0.09 && Math.abs(x) > 0.06;
      const back = y > -0.02 + 0.03 * Math.sin(z * 9);
      cols.push(...(eye ? [0.08, 0.1, 0.14] : back ? [0.17, 0.5, 0.56] : [0.92, 0.95, 0.98])); }
    m.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); m.computeVertexNormals(); return m; })();
  const fishM = mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, side: THREE.DoubleSide, hiAmt: 0.0, spec: 0.0, rimI: 0.35, shade: 0x8aa0c0 });
  // schools: c = centre, r = radius, n, size (m), dir = travel heading (rad), sp = speed, h = height, turn = film time of the
  // wave turn, shots, rel: 'giant' = placed over the sleeping giant (from the mecha's anchors)
  const SCHOOLS = [
    // s10 scale: Clawd is 0.5 m, so these are small fish (x = extra fish, own seeds: the other schools keep their layout)
    { c: [-3.2, -2.6, 4.5], r: 2.2, n: 40, x: 60, size: 0.07, dir: 0.4, sp: 0.5, h: 1.0, turn: 20.3, shots: ['s10'] },
    { c: [4.5, -5.5, 12], r: 3.5, n: 60, x: 90, size: 0.09, dir: 2.6, sp: 0.8, h: 1.4, turn: 21.2, shots: ['s10'] },
    { c: [0, 14, -12], r: 26, n: 220, x: 380, size: 0.2, dir: -0.25, sp: 2.4, h: 6, turn: 21.6, shots: ['s10'], rel: 'giant' },
    { c: [60, -55, 190], r: 18, n: 120, size: 0.45, dir: 1.2, sp: 0.6, h: 5, turn: 25, shots: ['s11', 's13'] },
    { c: [-70, -45, 215], r: 22, n: 140, size: 0.5, dir: -1.9, sp: 0.5, h: 7, turn: 27, shots: ['s11', 's13'] },
  ];
  const fishTotal = SCHOOLS.reduce((a, s) => a + s.n, 0), fishX = SCHOOLS.reduce((a, s) => a + (s.x || 0), 0);
  const fish = new THREE.InstancedMesh(fishGeo, fishM, fishTotal + fishX); fish.name = 'under-fish'; fish.frustumCulled = false; fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fish.setColorAt(0, new THREE.Color(1, 1, 1)); fish.instanceColor.setUsage(THREE.DynamicDrawUsage); g.add(fish);
  const fishSeed = Array.from({ length: fishTotal }, () => [R(), R(), R(), R()]);
  const RX = ctx.rng(1047), fishSeedX = Array.from({ length: fishX }, () => [RX(), RX(), RX(), RX()]);

  // ---- overlay FX: bubbles + silt motes (drawn sprites), silt clouds (lumps), god rays ----
  const bub = spriteBatch(ctx, { max: 2600, lit: 0xf4ffff, shade: 0x6cc8e0, line: 0x58b0d4, lineK: 0.4, soft: 0.25, name: 'under-bubbles' });
  const mote = spriteBatch(ctx, { max: 1400, lit: 0xeafff8, shade: 0xa8e4ea, lineK: 0, soft: 0.4, sort: false, name: 'under-motes' });
  const silt = lumpBatch(ctx, { max: 260, lit: 0xd8f4ec, body: 0xb4e2e0, shade: 0x6eaec4, hi: 0xf4fffc, rimCol: 0xe8fff8, rim: 0.5, hiT: 0.55, bodyT: -0.05, disp: 0.45, freq: 1.3, ink: false, fog: false, parent: g, name: 'under-silt' });
  const beams = beamBatch(ctx, { max: 64, color: 0xeafff6, k: 0.32, soft: 4, near: 3, name: 'under-beams' });
  const hero = beamBatch(ctx, { max: 16, color: 0xf2fff0, k: 0.3, soft: 2, near: 1.2, hard: 1, name: 'under-hero-rays' });
  const reqSilt = [], reqBub = [];

  // ---- Clawd's dive (s10): pure path, characters on twos ----
  // He enters head-first where the pilot's jump hits the water (pilot.splash), keeps tipping over into a held head-down
  // plunge (the key pose, face toward the camera below), rights himself at ~0.9 s and swims hard out over the drop-off,
  // levelling off above the abyss where the giant sleeps. Numbers: (-0.8, -1.7, 1.5) at 19.5 s -> (-0.6, -6.4, 13.5) at 22.5 s.
  const diveAt = (ts, p0) => { const u = clamp((ts - 0.45) / 2.75);
    return [p0[0] + 0.12 * Math.sin(ts * 1.3) + 0.2 * u, -(3.4 * (1 - Math.exp(-3 * ts)) + 0.95 * ts), p0[2] + 0.5 * ts + 10.6 * Math.pow(u, 1.3)]; };
  const diveStart = () => { const sp = ctx.modules.pilot?.splash; return [sp?.t ?? cues.splash, sp?.pos || [-0.79, 0, 1.3]]; };
  function clawdPath(t) { const [t0, p0] = diveStart(); return diveAt(Math.max(0, t - t0), p0); }
  function clawdSink(t) {
    const [t0, p0] = diveStart();
    const ts = Math.max(0, onTwos(t) - t0);
    const [x, y, z] = diveAt(ts, p0);
    // pitch: the jump's 0.73 -> tipping over to a held head-down 2.55 (0.2..0.8 s) -> righting into a forward swim (~0.6)
    const tip = util.ease(clamp(ts / 0.3)), right = util.ease(clamp((ts - 0.8) / 0.6));
    const rotX = 0.73 + (2.55 - 0.73) * tip + 0.04 * Math.sin(ts * 5) * (1 - right) + (0.62 - 2.55) * right + 0.06 * Math.sin(ts * 2.1) * right;
    const kick = Math.sin(ts * 8.5) * right, stroke = Math.sin(ts * 4.25) * right;
    const arms = 165 - 90 * right + 40 * stroke;                                // arms stretched past the head in the plunge, then strokes
    const pose = { squash: -0.08 * (1 - right) - 0.05 + 0.03 * kick, armL: arms, armR: arms, lookY: -0.3 + 0.5 * (1 - right), lookX: 0.05,
      legs: { FL: { rx: -30 + 18 * kick }, FR: { rx: -30 - 18 * kick }, BL: { rx: -40 - 18 * kick }, BR: { rx: -40 + 18 * kick } } };
    return { pos: [x, y, z], rot: [rotX, 0.05 * Math.sin(ts * 0.9), 0.08 * Math.sin(ts * 2.2) * right], pose, emo: 'determined', ts };
  }

  // ---- under look ----
  function look(extra = {}) {
    return { underwater: { on: true, shallow: UNDER.shallow, deep: UNDER.deep, density: UNDER.density, den2: 0, floorY: UNDER.floorY, rayK: 1.0, rayScale: 0.085, rayDepth: 45, sunK: 0.12, abs: 0.5, rayMax: 150, ...(extra.underwater || {}) },
      sun: { dir: [0.12, 1, 0.3], color: 0xf0fff8, k: 1.0 }, amb: { sky: 0x9cecf4, ground: 0x4aa6c4, k: 0.95 }, rim: { dir: [0.1, 0.6, -0.8], color: 0xd8fff8, k: 0.9 },
      hero: { dir: [0.2, 1, 0.45], color: 0xf2fffc, k: 1.08 }, haze: { density: 0 }, shafts: { on: false }, background: UNDER.deep, water: { on: false },
      bloom: { strength: 0.5, radius: 0.55, threshold: 1.0 }, grade: { tint: 0xf4ffff, sat: 1.12, shTint: 0xe8f4ff, hiTint: 0xfafffc, vignette: 0.14 },
      ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'underwater')) };
  }

  // the fog / ray pass
  const fogU = { tDiffuse: { value: null }, uShallow: { value: new THREE.Color(UNDER.shallow) }, uDeep: { value: new THREE.Color(UNDER.deep) }, uSun: { value: new THREE.Color(UNDER.sun) },
    uRayCol: { value: new THREE.Color(UNDER.rayCol) }, uSunDir: { value: new V3(0.12, 1, 0.3).normalize() }, uAbsCol: { value: new THREE.Color(0x3c9cd8) }, uDen: { value: UNDER.density }, uDen2: { value: 0 },
    uFloorY: { value: UNDER.floorY }, uRayK: { value: 1 }, uRayScale: { value: 0.085 }, uT: { value: 0 }, uRayDepth: { value: 45 }, uSunK: { value: 0.35 }, uAbs: { value: 0.25 }, uRayMax: { value: 150 }, uGrad: { value: 1.3 } };
  const fogM = new THREE.ShaderMaterial({ uniforms: fogU, vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: FOG_FS(ctx.glsl.NOISE), depthTest: false, depthWrite: false });
  ctx.pipeline.addPass('water', { material: fogM, enabled: (lk) => !!lk.underwater?.on,
    update: (lk, t) => { const u = lk.underwater; fogU.uShallow.value.set(u.shallow); fogU.uDeep.value.set(u.deep); fogU.uDen.value = u.density; fogU.uDen2.value = u.den2 || 0; fogU.uGrad.value = u.grad ?? 1.3; fogU.uFloorY.value = u.floorY;
      fogU.uRayK.value = u.rayK; fogU.uRayScale.value = u.rayScale; fogU.uRayDepth.value = u.rayDepth; fogU.uSunK.value = u.sunK; fogU.uAbs.value = u.abs; fogU.uRayMax.value = u.rayMax;
      fogU.uSunDir.value.fromArray(lk.sun.dir).normalize(); fogU.uT.value = onThrees(t); } });

  // fish placement (afterCamera: the giant's school reads the mecha's pose of this frame)
  const fM = new THREE.Matrix4(), fQ = new THREE.Quaternion(), fP = new V3(), fS = new V3(), fE = new THREE.Euler(), fC = new THREE.Color();
  function placeFish(t, shot) {
    const ct = onTwos(t); let fi = 0, xi = 0, shown = 0;
    const mech = ctx.modules.mecha; let gref = null;
    if (mech?.root?.visible && mech.anchor) { const v = mech.anchor('visor'), c = mech.anchor('center'); if (v && c && Number.isFinite(v.y)) gref = [c.x, Math.max(v.y, c.y), (v.z + c.z) / 2]; }
    for (const sc of SCHOOLS) { const vis = sc.shots.includes(shot.id) && (!sc.rel || gref);
      const base = sc.rel ? [gref[0] + sc.c[0], Math.min(-4, gref[1] + sc.c[1]), gref[2] + sc.c[2]] : sc.c;
      for (let i = 0, N = sc.n + (sc.x || 0); i < N; i++) { const ex = i >= sc.n, sid = ex ? 9000 + xi : fi, seed = ex ? fishSeedX[xi++] : fishSeed[fi++];
        if (!vis) continue; const [a, b, c, d] = seed;
        // school space: x along the travel heading, z across, y up; the turn sweeps through the school as a wave
        const lx = (a - 0.5) * 2 * sc.r, lz = (b - 0.5) * 1.4 * sc.r * Math.sqrt(1 - Math.min(0.95, Math.abs(a - 0.5) * 1.6)), ly = (c - 0.5) * sc.h;
        const delay = (lx / sc.r) * 0.35 + d * 0.08, tt = ct - delay;
        const turn = util.ease(clamp((tt - sc.turn) / 0.7)) * 1.1 * (sc.sp > 0 ? 1 : -1), hd = sc.dir + turn + 0.08 * Math.sin(ct * 1.7 + d * 9);
        const prog = sc.sp * (tt - 19) + (turn ? 0 : 0);
        const ox = Math.cos(sc.dir) * prog + Math.cos(hd) * lx * 0.3, oz = Math.sin(sc.dir) * prog + Math.sin(hd) * lx * 0.3;
        fP.set(base[0] + ox + Math.cos(sc.dir) * lx * 0.7 - Math.sin(hd) * lz, base[1] + ly + 0.12 * sc.h * Math.sin(ct * 1.3 + d * 9), base[2] + oz + Math.sin(sc.dir) * lx * 0.7 + Math.cos(hd) * lz);
        const wig = Math.sin(ct * 9 + d * 30) * 0.08;
        fE.set((c - 0.5) * 0.3 + 0.1 * Math.sin(ct * 2 + d * 5), Math.PI / 2 - hd + wig, (b - 0.5) * 0.35, 'YXZ');
        fQ.setFromEuler(fE); fS.setScalar(sc.size * (0.72 + 0.56 * d)); fM.compose(fP, fQ, fS); fish.setMatrixAt(shown, fM);
        // catch-light: the flank flashes as the fish swings through the turn (and a few random glints)
        const sw = Math.abs(Math.sin((tt - sc.turn) * 4.5)) * clamp(1 - Math.abs(tt - sc.turn - 0.35) / 0.5);
        const fl = Math.max(sw > 0.8 ? 1 : 0, hash(sid * 3.3 + Math.floor(ct * 12)) > 0.985 ? 1 : 0);
        fish.setColorAt(shown, fC.setScalar(1 + 0.9 * fl)); shown++; } }
    fish.count = shown; fish.instanceMatrix.needsUpdate = true; if (fish.instanceColor) fish.instanceColor.needsUpdate = true;
  }

  const api = { floor, clawdSink, clawdPath, look, UNDER, group: g, defaultSilt: false,   // mecha-fx.js draws the giant's own silt; set true for ours
    caustics: (m) => patchCaustics(m),
    siltBurst(pos, t0, size = 1) { reqSilt.push([pos.isVector3 ? pos.toArray() : pos, t0, size]); },
    bubbles(pos, t0, n = 12, size = 1) { reqBub.push([pos.isVector3 ? pos.toArray() : pos, t0, n, size]); },
    update(t, shot) {
      reqSilt.length = 0; reqBub.length = 0;
      const on = inUnder(shot); g.visible = on;
      CAUS.uCausOn.value = on ? 1 : 0;
      const ft = onThrees(t);
      CAUS.uCausT.value = ft; KT.value = ft; surfU.uT.value = ft;
      if (shot.look.sun?.dir) { CAUS.uCausL.value.fromArray(shot.look.sun.dir).normalize(); surfU.uSunDir.value.copy(CAUS.uCausL.value); }
      if (!on) { bub.mesh.visible = mote.mesh.visible = beams.mesh.visible = hero.mesh.visible = false; silt.begin(0).end(); fish.count = 0; return; }
      // churned surface above Clawd's entry (foam disc grows, then breaks up)
      const sp = ctx.modules.pilot?.splash, sp0 = sp?.pos || [-0.79, 0, 1.3], ke = ft - (sp?.t ?? cues.splash);
      surfU.uChurn.value.set(sp0[0], sp0[2], 0.7 + 1.1 * clamp(ke / 1.2), ke > 0 ? 1 - smooth(1.4, 2.8, ke) : 0);
      setFogFromLook(shot.look, shot.look.underwater ? { ...UNDER, ...shot.look.underwater } : UNDER);
    },
    afterCamera(t, shot) {
      if (!inUnder(shot)) return;
      placeFish(t, shot);
      const cam = ctx.camera, cp = cam.position, ft = onThrees(t);
      const L = new V3().fromArray(shot.look.sun?.dir || [0.12, 1, 0.3]).normalize(), D = L.clone().negate().toArray();
      // ---- god rays: world-anchored cells on the surface around the camera, slanting down along the light ----
      { const ox = cp.x + cp.y * L.x / L.y, oz = cp.z + cp.y * L.z / L.y, cell = 7, R0 = 6;
        beams.begin(ft); const bi = Math.floor(ox / cell), bj = Math.floor(oz / cell);
        for (let i = -R0; i <= R0; i++) for (let j = -R0; j <= R0; j++) { const X = bi + i, Z = bj + j, h1 = hash(X * 13.7 + Z * 71.3), h2 = hash(h1 * 41.1), h3 = hash(h2 * 17.9);
          if (h1 > 0.3) continue; const x = (X + h2) * cell, z = (Z + h3) * cell, w0 = 0.7 + 2.4 * h2 * h2, len = 30 + 45 * h3;
          const fl = 0.65 + 0.35 * Math.sin(ft * (0.8 + h3) + h1 * 40);
          beams.add([x, -0.2, z], D, len, w0, w0 * (1.8 + h1 * 2), fl * (0.5 + 0.8 * h3), h1, cam); }
        beams.end(); }
      // ---- s10 hero rays: 8 hard-edged shafts fanning down from the sun window over the dive, past Clawd (shimmer on threes) ----
      hero.begin(ft);
      if (shot.id === 's10') {
        const spots = [[-1.6, 0.3], [0.4, -0.6], [1.9, 1.4], [-3.1, 2.6], [0.9, 3.6], [-0.4, 6.4], [2.6, 8.8], [-2.4, 11.5]];
        spots.forEach(([sx, sz], i) => { const h1 = hash(i * 7.7 + 1.3), w0 = 0.35 + 0.7 * h1, fl = 0.7 + 0.3 * Math.sin(ft * 2.1 + i * 2.4);
          const o = new V3(-0.8 + sx, -0.05, 1.5 + sz);
          hero.add(o.toArray(), D, 24 + 10 * hash(i * 3.1), w0, w0 * (2.4 + h1), fl * (0.75 + 0.35 * hash(i * 5.3)), h1, cam); });
      }
      hero.end();
      // ---- bubbles: Clawd's entry cavity, the stream off his body and nubs, plus requested bursts ----
      bub.begin();
      const emit = (x, y, z, t0, i, sz, spread, up) => { const age = ft - t0; if (age < 0) return;
        const r1 = hash(i * 1.37 + t0), r2 = hash(i * 2.71 + t0 * 3), r3 = hash(i * 0.53 + 9.1), s = sz * (0.35 + 1.1 * Math.pow(r1, 2.2));
        const vr = up * (0.55 + 1.6 * s / sz * 0.5), yy = y + vr * age + 0.3 * age * age * (s / sz) * up, wob = 0.06 + s * 0.6;
        if (yy > -0.03) return;
        const ox = (r2 - 0.5) * spread * (1 + 0.6 * age), oz = (r3 - 0.5) * spread * (1 + 0.6 * age);
        bub.add(x + ox + wob * Math.sin(age * 9 + i), yy, z + oz + wob * Math.cos(age * 7 + i * 2), s * (1 + 0.15 * Math.sin(age * 20 + i)), K.BUBBLE, 1, 0, 1, 0, 0.12 * Math.sin(age * 15 + i), r2, 0); };
      if (shot.id === 's10') {
        const [ts0] = diveStart();
        // the entry column: a dense trail of bubbles hanging from the churn down to where he passed (it rises and thins)
        for (let i = 0; i < 300; i++) { const tb = ts0 + 0.5 * Math.pow(hash(i * 7.7), 1.5); const c = clawdPath(tb);
          emit(c[0] + (hash(i * 1.1) - 0.5) * 0.25, c[1] + 0.2, c[2] + (hash(i * 2.2) - 0.5) * 0.25, tb, i, 0.1, 0.5, 1.0); }
        // the stream off his body + both nubs (the air he carried down, streaming up behind him)
        const loc = [[0, 0.32, 0], [0.3, 0.18, 0.05], [-0.3, 0.18, 0.05]], Mr = new THREE.Matrix4(), Ev = new THREE.Euler();
        for (let i = 0; i < 240; i++) { const tb = ts0 + 0.1 + i * 0.0125; if (tb > ft) break; const s = clawdSink(tb), k = i % 3;
          if (hash(i * 5.1) > 0.85 - 0.6 * clamp(1 - (tb - ts0) / 2.4)) continue;
          Ev.set(s.rot[0], s.rot[1], s.rot[2], 'YXZ'); Mr.makeRotationFromEuler(Ev); const o = new V3().fromArray(loc[k]).applyMatrix4(Mr);
          emit(s.pos[0] + o.x, s.pos[1] + o.y + 0.22, s.pos[2] + o.z, tb, 1000 + i, k ? 0.04 : 0.055, 0.12, 1.0); }
      }
      for (const [p, t0, n, sz] of reqBub) for (let i = 0; i < n; i++) emit(p[0], p[1], p[2], t0 + 0.05 * hash(i + t0), 3000 + i, 0.08 * sz, 0.5 * sz, 1);
      bub.end(cam);
      // ---- silt motes: world-anchored cells around the camera (stable as the camera moves), drifting on threes ----
      mote.begin(); const cell = 3.2, rad = 7; const cx = Math.floor(cp.x / cell), cy = Math.floor(cp.y / cell), cz = Math.floor(cp.z / cell);
      for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) for (let k = -rad; k <= rad; k++) {
        const X = cx + i, Y = cy + j, Z = cz + k; if ((Y + 1) * cell > 0) continue;
        for (let m = 0; m < 2; m++) { const h1 = hash(X * 73.1 + Y * 19.7 + Z * 41.3 + m * 7.7), h2 = hash(h1 * 91.3), h3 = hash(h2 * 51.7), h4 = hash(h3 * 13.3);
          const x = (X + h1) * cell + 0.3 * Math.sin(ft * 0.5 + h2 * 9), y = (Y + h2) * cell - 0.05 * ft + 0.2 * Math.sin(ft * 0.4 + h4 * 7), z = (Z + h3) * cell + 0.3 * Math.cos(ft * 0.45 + h1 * 9);
          const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z); if (d > rad * cell || y > -0.2 || d < 0.6) continue;
          mote.add(x, y, z, 0.022 + 0.035 * h4 * h4, K.CLUMP, 0.75 * (1 - smooth(rad * cell * 0.6, rad * cell, d)), 0, 0, 0, 0, h3, 0); } }
      mote.end();
      // ---- silt clouds (rolling sandy masses): requests, or the default wake-up silt along the giant's flanks (s11, s13) ----
      silt.begin(ft);
      const bursts = reqSilt.slice();
      const mech = ctx.modules.mecha;
      if (!bursts.length && api.defaultSilt && (shot.id === 's11' || shot.id === 's13') && mech?.root?.visible) {
        const b = new THREE.Box3().setFromObject(mech.root); if (!b.isEmpty()) { const c = b.getCenter(new V3()), sx = (b.max.x - b.min.x) / 2, sz = (b.max.z - b.min.z) / 2;
          for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + 0.3, px = c.x + Math.cos(a) * sx * 1.02, pz = c.z + Math.sin(a) * sz * 1.02;
            bursts.push([[px, floor(px, pz), pz], cues.eyes - 0.3 + 0.25 * hash(i * 3.1), 5 + 4 * hash(i)]); } } }
      bursts.forEach(([p, t0, size], bi) => { const age = ft - t0; if (age < 0) return;
        for (let i = 0; i < 9; i++) { const h1 = hash(bi * 31 + i * 3.7), h2 = hash(h1 * 77), h3 = hash(h2 * 33), a = h1 * 6.28;
          const out = size * (0.3 + 1.4 * (1 - Math.exp(-age * (0.8 + h2)))) * (0.5 + h3), up = size * (0.15 + 0.9 * h2) * (1 - Math.exp(-age * 0.9));
          const r = size * (0.35 + 0.5 * h3) * (0.6 + 0.6 * clamp(age / 1.5)) * (1 - smooth(3.0, 6.0, age));
          silt.add(p[0] + Math.cos(a) * out, p[1] + r * 0.4 + up, p[2] + Math.sin(a) * out, r * 1.2, r * 0.8, r * 1.1, h1 * 50, 0, 1, 0, 1.2, h3 - 0.5); } });
      silt.end();
    },
    dispose() { g.removeFromParent(); bub.mesh.removeFromParent(); mote.mesh.removeFromParent(); hero.mesh.removeFromParent(); beams.mesh.removeFromParent(); },
  };
  ctx.modules.underwater = api;
  return api;
}
