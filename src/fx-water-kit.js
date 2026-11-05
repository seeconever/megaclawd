// MEGA CLAWD · water FX kit (owner: water) — drawing primitives shared by src/under.js and src/fx-water.js.
//
//   lumpBatch(ctx, o)    cel water MASS: opaque instanced lumps (crowns, plume column, wave lip, boil domes, sea-floor silt).
//                        Three hard tones (shade / body / lit) + white highlight band + backlit rim, lit by the shared LIGHT
//                        rig (so dusk tints it), lumpy outline from vertex noise anchored to the lump, MRT id (inked when
//                        o.ink). begin() / add(x, y, z, sx, sy, sz, seed, ax?, ay?, az?) / end().  (ax.. = stretch axis)
//   spriteBatch(ctx, o)  drawn droplets, spray clumps, bubbles, mist puffs, foam flecks, glints, rain streaks: quads in the
//                        OVERLAY scene (after paint + ink, so no ink crosses them), SDF shapes with crisp 1-px edges, cel
//                        2 tones + highlight + a drawn rim line, motion stretch along the world velocity, soft depth vs the
//                        main pass, distance fog. o.flat = lie on the water plane (foam). begin() / add(...) / end(camera).
//   ribbonBatch(ctx, o)  falling sheets / streams of water: strips along a polyline (overlay), translucent body with
//                        bright streaks scrolling down (on threes), ragged edges, breaking into drops at the bottom.
//   beamBatch(ctx, o)    god rays: axial billboards (overlay, additive), soft or hard-edged (o.hard) anime shafts.
//   K                    sprite kinds: DROP, CLUMP, BUBBLE, MIST, FOAM, GLINT, STREAK, RING.
// Options shared by the overlay batches: lift 0..1 renormalises the light colour so white water stays white in dim light
// (dusk); the soft depth test treats pixels with no depth (sky) as infinitely far (FX rise into the sky unclipped).
// Every batch is rebuilt from scratch each frame by its caller from film time t (pure, order independent).
import * as THREE from 'three';
import { NOISE, OVERLAY } from './pipeline-glsl.js';

export const K = { DROP: 0, CLUMP: 1, BUBBLE: 2, MIST: 3, FOAM: 4, GLINT: 5, STREAK: 6, RING: 7 };
const C = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));
// soft depth vs the main pass; no depth written (sky / cleared) = infinitely far
const SOFT = /* glsl */`float wSoft(float vz, float soft){ float d = sceneDepth(); if (d < 1e-3) d = 1e9; return clamp((d - vz) / max(soft, 1e-4), 0.0, 1.0); }
vec3 unitL(vec3 c){ return c / max(max(c.r, max(c.g, c.b)), 1e-3); }`;

// ---------------------------------------------------------------------------------------------------------------------
// shared fog state for the overlay FX (set once per frame by the owner module from the shot LOOK)
// ---------------------------------------------------------------------------------------------------------------------
export const FOG = { uFogCol: { value: new THREE.Color(0.8, 0.85, 1) }, uFogD: { value: 0 }, uFogMax: { value: 0.9 }, uFogDeep: { value: new THREE.Color(0.1, 0.5, 0.7) },
  uFogY0: { value: 0 }, uFogY1: { value: -90 }, uFogGrad: { value: 0 } };
const FOG_GLSL = /* glsl */`uniform vec3 uFogCol, uFogDeep; uniform float uFogD, uFogMax, uFogY0, uFogY1, uFogGrad;
  vec3 wfog(vec3 col, float dist, float wy){ float f = clamp(1.0 - exp(-uFogD * dist), 0.0, uFogMax);
    vec3 fc = mix(uFogCol, uFogDeep, uFogGrad * smoothstep(uFogY0, uFogY1, wy)); return mix(col, fc, f); }`;
// day haze -> overlay fog (approximation of the engine's height haze at the FX height)
export function setFogFromLook(look, under = null) {
  if (under) { FOG.uFogCol.value.set(under.shallow); FOG.uFogDeep.value.set(under.deep); FOG.uFogD.value = under.density; FOG.uFogMax.value = 0.95; FOG.uFogGrad.value = 1;
    FOG.uFogY0.value = 0; FOG.uFogY1.value = under.floorY ?? -90; return; }
  const h = look.haze || {}; FOG.uFogCol.value.set(h.color ?? 0xc8dcff); FOG.uFogD.value = (h.density ?? 0) * (look.passes?.atmosphere === false ? 0 : 1);
  FOG.uFogMax.value = h.max ?? 0.75; FOG.uFogGrad.value = 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// LUMPS (opaque cel water masses, main scene)
// ---------------------------------------------------------------------------------------------------------------------
const LUMP_VS = /* glsl */`${NOISE}
attribute vec4 iSeed;            // x seed, y lumpiness, z tone shift (-1 darker .. 1 lighter), w spare
uniform float uT, uDisp, uFreq;
varying vec3 vN, vW, vO; varying vec4 vSeed; varying float vD;
void main(){
  vec3 p = position; vec3 n = normal;
  float s = iSeed.x * 17.3;
  // two-scale cauliflower bumps (big billows + small knobs), anchored to the lump, boiling slowly on threes
  float big = fbm3(p * uFreq + vec3(s, s * 0.7, uT * 0.5)) - 0.5;
  float small = n3(p * uFreq * 3.3 + s + vec3(0.0, uT * 0.8, 0.0)) - 0.5;
  float d = big * 1.25 + small * 0.45;
  vD = d;
  p += n * d * uDisp * iSeed.y;
  mat4 M = modelMatrix * instanceMatrix;
  vec4 w = M * vec4(p, 1.0); vW = w.xyz; vO = p; vSeed = iSeed;
  vN = normalize(transpose(inverse(mat3(M))) * n);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const LUMP_FS = /* glsl */`${NOISE}
vec3 unitL(vec3 c){ return c / max(max(c.r, max(c.g, c.b)), 1e-3); }
uniform vec3 uLit, uBody, uShade, uHi, uRimC, uKeyDir, uKeyCol, uSky, uGround, uRimDir, uRimCol, uDeep;
uniform float uRim, uHiT, uBodyT, uSatK, uEmis, uCrev, uGlowK, uTopK, uStreak, uAmbLift, uOuter, uRimW, uLiftL, uWhite; uniform vec4 uAxis, uKeyOv;
varying vec3 vN, vW, vO; varying vec4 vSeed; varying float vD;
${FOG_GLSL}
uniform float uFogOn;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N; vec3 V = normalize(cameraPosition - vW);
  float br = (n3(vO * 2.3 + vSeed.x * 31.0) - 0.5) * 0.35 + (n3(vO * 7.0 + vSeed.x * 9.0) - 0.5) * 0.12;
  // uKeyOv: a drawn key direction for this mass (w = 1), e.g. a 3/4 back key that splits a backlit column into 2 tones
  vec3 KD = uKeyOv.w > 0.5 ? normalize(uKeyOv.xyz) : normalize(uKeyDir);
  float nl = dot(N, KD) + br + vD * 0.9;
  float aa = fwidth(nl) * 0.8;
  vec3 amb = mix(mix(uGround, uSky, N.y * 0.5 + 0.5), vec3(1.0), uAmbLift);
  vec3 kcol = mix(uKeyCol, unitL(uKeyCol) * 0.95, uLiftL);
  kcol = mix(kcol, vec3(1.0), uWhite);                       // white water: the key colour only tints it (white-peach at dusk)
  amb = mix(amb, unitL(amb) * 0.9, uLiftL);
  vec3 shade = uShade * amb, body = uBody * mix(amb, kcol, 0.75), lit = uLit * kcol;
  vec3 col = mix(shade, body, smoothstep(uBodyT - aa, uBodyT + aa, nl));
  col = mix(col, lit, smoothstep(uHiT - aa, uHiT + aa, nl));
  // sky-lit tops: surfaces facing up catch the bright sky dome (a lighter band, hard edged)
  float tp = N.y + br * 0.6 + vD * 0.5; float ta = fwidth(tp) * 0.8 + 1e-4;
  col = mix(col, max(col, uBody * mix(uSky, uKeyCol, 0.45) * 1.05), smoothstep(0.62 - ta, 0.62 + ta, tp) * uTopK);
  // vertical striations along the lump's axis (rushing water), darker grooves + bright strands
  if (uStreak > 0.0) { float stv = n2(vec2(atan(vO.z, vO.x) * 2.6 + vSeed.x * 20.0, vO.y * 0.55 + vSeed.x * 3.0));
    float sa = fwidth(stv) + 1e-4;
    col = mix(col, col * 0.88, smoothstep(0.58 - sa, 0.58 + sa, stv) * uStreak);
    col = mix(col, max(col, lit * 0.98), smoothstep(0.8 - sa, 0.8 + sa, 1.0 - stv) * uStreak * 0.7); }
  // crevices between billows: a third, deeper tone (drawn as hard shapes, like the shadow pockets of an anime splash)
  float cv = fwidth(vD) * 0.8 + 1e-4;
  col = mix(col, uDeep * amb, smoothstep(-0.2 + cv, -0.2 - cv, vD) * uCrev);
  // backlit translucency: water lit from behind glows warm through its thin edges
  float bl = pow(max(dot(-V, KD), 0.0), 3.0);
  float edgeT = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  col += uKeyCol * uLit * bl * uGlowK * (0.25 + 0.75 * smoothstep(0.25 - aa, 0.45 + aa, edgeT + br * 0.4));
  col *= 1.0 + vSeed.z * 0.08;
  // white specular glint band where the lump turns to the key light
  vec3 H = normalize(KD + V); float sp = dot(N, H) + br * 0.05;
  col = mix(col, uHi * kcol * 1.15, smoothstep(0.955, 0.96, sp));
  // backlit rim (anime silver lining of spray against the sun). uOuter: only on the mass's OUTER silhouette (the surface
  // turns away from the column axis uAxis), stronger on the sun side, so inner billow edges never get a rim
  float fr = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  float rim = smoothstep(uRimW - aa, uRimW + 0.04 + aa, fr + br * 0.4) * smoothstep(-0.1, 0.35, dot(-V, normalize(uKeyDir)) + 0.25 * N.y);
  if (uOuter > 0.5) { vec2 ho = vW.xz - uAxis.xz; float outw = dot(normalize(N.xz + vec2(1e-5)), normalize(ho + vec2(1e-5)));
    float topR = smoothstep(0.55, 0.8, N.y) * smoothstep(uAxis.w * 0.82, uAxis.w * 0.95, vW.y);
    rim *= max(smoothstep(0.3, 0.6, outw), topR) * (0.55 + 0.45 * smoothstep(-0.2, 0.4, dot(N, normalize(uKeyDir)))); }
  col = mix(col, uRimC * kcol * 1.2, rim * uRim);
  col += uLit * uEmis;
  if (uFogOn > 0.5) col = wfog(col, length(vW - cameraPosition), vW.y);
  gl_FragColor = vec4(col, 0.0); }`;

export function lumpBatch(ctx, { max = 256, lit = 0xffffff, body = 0xdaf4ff, shade = 0x8cb4e8, deep = 0x6a8ad8, crev = 0.85, glow = 0.5, top = 0.6, streak = 0, ambLift = 0.3, hi = 0xffffff, rimCol = 0xffffff, rim = 0.85, hiT = 0.5, bodyT = -0.12,
  disp = 0.28, freq = 1.6, detail = 3, ink = true, id = null, fog = false, emis = 0, outer = false, rimW = 0.66, lift = 0, white = 0, parent = null, name = 'water-lumps' } = {}) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const mesh = new THREE.InstancedMesh(geo, null, max);
  const seedA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); seedA.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iSeed', seedA);
  const L = ctx.light.u;
  const m = new THREE.ShaderMaterial({ vertexShader: LUMP_VS, fragmentShader: LUMP_FS, side: THREE.FrontSide,
    uniforms: { uT: { value: 0 }, uDisp: { value: disp }, uFreq: { value: freq }, uLit: { value: C(lit) }, uBody: { value: C(body) }, uShade: { value: C(shade) }, uHi: { value: C(hi) },
      uRimC: { value: C(rimCol) }, uRim: { value: rim }, uHiT: { value: hiT }, uBodyT: { value: bodyT }, uSatK: { value: 1 }, uEmis: { value: emis }, uFogOn: { value: fog ? 1 : 0 },
      uDeep: { value: C(deep) }, uCrev: { value: crev }, uGlowK: { value: glow }, uTopK: { value: top }, uStreak: { value: streak }, uAmbLift: { value: ambLift },
      uOuter: { value: outer ? 1 : 0 }, uAxis: { value: new THREE.Vector4(0, 0, 0, 1e9) }, uRimW: { value: rimW }, uLiftL: { value: lift }, uWhite: { value: white }, uKeyOv: { value: new THREE.Vector4(0, 1, 0, 0) },
      uKeyDir: L.uKeyDir, uKeyCol: L.uKeyCol, uSky: L.uSky, uGround: L.uGround, uRimDir: L.uRimDir, uRimCol: L.uRimCol, ...FOG } });
  m.extensions = { derivatives: true };
  ctx.mat.mrt(m, { id: id ?? (ink ? ctx.mat.nextId() : ctx.mat.ID.FX + 10), normal: 'normalize(mat3(viewMatrix) * (gl_FrontFacing ? vN : -vN))' });
  mesh.material = m; mesh.count = 0; mesh.frustumCulled = false; mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  (parent || ctx.scene).add(mesh);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qy = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), A = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let n = 0;
  const api = { mesh, material: m, uniforms: m.uniforms,
    begin(t = 0) { n = 0; m.uniforms.uT.value = t; return api; },
    // centre, radii (sy along the stretch axis a if given, else world y), seed, lumpiness, tone shift, yaw (spin about the
    // lump's own axis before aligning: for an axis tilted toward azimuth a, yaw = -a - PI/2 puts local x tangential)
    add(x, y, z, sx, sy, sz, seed = 0, ax = 0, ay = 1, az = 0, lumpy = 1, tone = 0, yaw = 0) {
      if (n >= max || !(sx > 1e-4 && sy > 1e-4 && sz > 1e-4)) return api;
      P.set(x, y, z); S.set(sx, sy, sz); A.set(ax, ay, az); if (A.lengthSq() < 1e-8) A.copy(UP); A.normalize();
      Q.setFromUnitVectors(UP, A); if (yaw) Q.multiply(Qy.setFromAxisAngle(UP, yaw)); M4.compose(P, Q, S); mesh.setMatrixAt(n, M4);
      seedA.setXYZW(n, seed, lumpy, tone, 0); n++; return api; },
    end() { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; seedA.needsUpdate = true; mesh.visible = n > 0; return api; },
    get count() { return n; } };
  mesh.visible = false;
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// SPRITES (drawn droplets / spray / bubbles / mist / foam, overlay scene)
// ---------------------------------------------------------------------------------------------------------------------
const SPR_VS = /* glsl */`
attribute vec4 iA;   // x pos, y pos, z pos, w size (world metres, sprite width)
attribute vec4 iB;   // xyz world velocity (stretch direction), w stretch (extra length factor)
attribute vec4 iC;   // x kind, y alpha, z seed, w tone (0 = palette, 1 = lighter, -1 = darker)
uniform float uFlat, uPxH; uniform vec3 uKeyDir;
varying vec2 vQ; varying float vAsp, vKind, vAlpha, vSeed, vTone, vZ, vPx, vWy; varying vec3 vLv; varying float vDist;
void main(){
  vec3 c = iA.xyz; float sx = iA.w, asp = 1.0 + iB.w, sy = sx * asp;
  vec4 mv; vec2 ax, ay;
  if (uFlat > 0.5) {
    float a = iC.z * 6.2831; vec3 X = vec3(cos(a), 0.0, sin(a)), Z = vec3(-sin(a), 0.0, cos(a));
    vec3 w = c + X * position.x * sx + Z * position.y * sy;
    mv = viewMatrix * vec4(w, 1.0); ax = vec2(1.0, 0.0); ay = vec2(0.0, 1.0);
  } else {
    mv = viewMatrix * vec4(c, 1.0);
    vec3 v = mat3(viewMatrix) * iB.xyz; float L = length(v.xy);
    float r = iC.z * 6.2831;
    ay = L > 1e-5 ? v.xy / L : vec2(cos(r), sin(r)); ax = vec2(ay.y, -ay.x);
    mv.xy += ax * position.x * sx + ay * position.y * sy;
  }
  vQ = position.xy; vAsp = asp; vKind = iC.x; vAlpha = iC.y; vSeed = iC.z; vTone = iC.w; vZ = -mv.z; vWy = c.y;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  vPx = sx / max(vZ, 1e-3) * projectionMatrix[1][1] * 0.5 * uPxH;   // sprite width in pixels
  vec3 Lv = normalize(mat3(viewMatrix) * uKeyDir);
  vLv = vec3(dot(Lv.xy, ax), dot(Lv.xy, ay), Lv.z);
}`;
const SPR_FS = /* glsl */`${NOISE} ${OVERLAY} ${SOFT}
uniform vec3 uLit, uShade, uHi, uLine, uKeyCol, uSky; uniform float uSoft, uLineK, uOp, uFlat, uEmis, uNoFog, uLift, uCres, uDot;
${FOG_GLSL}
varying vec2 vQ; varying float vAsp, vKind, vAlpha, vSeed, vTone, vZ, vPx, vWy; varying vec3 vLv; varying float vDist;
void main(){
  vec2 p = vec2(vQ.x, vQ.y * vAsp);
  float aa = 1.2 / max(vPx, 1.0);
  int k = int(vKind + 0.5);
  float d = 1.0; vec3 n = vec3(0.0, 0.0, 1.0); float fill = 1.0, hiK = 1.0, lineK = uLineK; float a0 = 1.0;
  if (k == 0 || k == 6) {                       // DROP (teardrop, head leads) / STREAK (thin falling line)
    float r = k == 6 ? 0.22 : 0.48;
    float hc = 0.5 * vAsp - r, ty = -0.5 * vAsp;
    float dh = length(p - vec2(0.0, hc)) - r;
    float u = clamp((p.y - ty) / max(hc - ty, 1e-3), 0.0, 1.0);
    float dt = p.y < hc ? abs(p.x) - r * pow(u, 0.75) : 1e3;
    d = min(dh, dt);
    vec2 q = vec2(p.x / r, p.y < hc ? -0.2 : (p.y - hc) / r);
    n = vec3(q, sqrt(max(1.0 - dot(q, q), 0.04)));
    if (k == 6) { lineK = 0.0; hiK = 0.0; }
  } else if (k == 1 || k == 3) {                // CLUMP (spray blob) / MIST (soft spray puff)
    float an = atan(p.y, p.x);
    float r = 0.40 + 0.055 * sin(an * 3.0 + vSeed * 40.0) + 0.04 * sin(an * 5.0 + vSeed * 91.0) + 0.025 * sin(an * 9.0 + vSeed * 13.0);
    d = length(p) - r;
    hiK = 0.0;                                    // spray masses carry no glint dot (dots on blobs read as eyes)
    if (k == 3) { d += (fbm2(p * 5.0 + vSeed * 50.0) - 0.5) * 0.18; fill = 0.82; lineK *= 0.0; }
    vec2 q = p / 0.46; n = vec3(q, sqrt(max(1.0 - dot(q, q), 0.04)));
  } else if (k == 2) {                           // BUBBLE: drawn ring + crescent highlight + faint fill
    float rr = length(p); d = rr - 0.46;
    vec2 q = p / 0.46; n = vec3(q, sqrt(max(1.0 - dot(q, q), 0.04)));
  } else if (k == 4) {                           // FOAM (flat patch with holes)
    float an = atan(p.y, p.x);
    float r = 0.42 + 0.06 * sin(an * 4.0 + vSeed * 30.0) + 0.04 * sin(an * 7.0 + vSeed * 77.0);
    d = length(p) - r;
    float hole = n2(p * 7.0 + vSeed * 60.0) * 0.75 + n2(p * 15.0 + vSeed * 20.0) * 0.25;
    d = max(d, (0.42 - hole) * 0.25);
    lineK = 0.0; hiK = 0.0;
  } else if (k == 5) {                           // GLINT: 4-point star
    vec2 q = abs(p); d = min(q.x * 9.0 + q.y, q.y * 9.0 + q.x) * 0.11 - 0.05; d = min(d, length(p) - 0.07);
    lineK = 0.0; hiK = 0.0;
  } else if (k == 7) {                           // RING: expanding ripple / shock ring outline
    d = abs(length(p) - 0.44 - 0.01 * sin(atan(p.y, p.x) * 6.0 + vSeed * 20.0)) - 0.014;
    lineK = 0.0; hiK = 0.0;
  }
  float cov = 1.0 - smoothstep(-aa, aa, d);
  if (cov * vAlpha < 0.004) discard;
  vec3 N = normalize(n);
  float nl = dot(N, normalize(vLv)) + (n2(p * 3.0 + vSeed * 9.0) - 0.5) * 0.3;
  // water is never dark: the shade tone is sky-lit (lifted toward white), the lit tone is the key colour softened
  vec3 skyL = mix(uSky, vec3(1.0), 0.45);
  vec3 lit = uLit * mix(uKeyCol, vec3(1.0), 0.2), shade = uShade * mix(skyL, uKeyCol, 0.3);
  // lift: white water stays white in dim light (the light colour renormalised to unit value, a hint of its hue kept)
  lit = mix(lit, uLit * mix(unitL(uKeyCol), vec3(1.0), 0.65) * 0.94, uLift); shade = mix(shade, uShade * mix(unitL(skyL), vec3(1.0), 0.35) * 0.9, uLift);
  vec3 col = mix(shade, lit, smoothstep(-0.12, -0.04, nl));
  // backlit (light behind the drop): the drop glows through, a hot crescent on the light side (anime silver lining)
  float back = clamp(-normalize(vLv).z * 1.4, 0.0, 1.0);
  vec2 ld = normalize(vLv.xy + 1e-4);
  float rr = length(p) / 0.46, cs = dot(p / max(length(p), 1e-4), ld);
  col = mix(col, mix(shade, lit, 0.55), back * 0.55);
  float cres = smoothstep(0.55, 0.75, rr + 0.25 * cs) * smoothstep(0.1, 0.45, cs);
  col = mix(col, lit * 1.25, cres * back * ((k == 0 || k == 1) ? uCres : 0.0));
  col *= 1.0 + vTone * 0.12;
  // small highlight dot toward the light
  vec2 hp = ld * 0.2;
  float hl = 1.0 - smoothstep(0.085 - aa, 0.085 + aa, length(p - vec2(hp.x, hp.y + (k == 0 ? 0.5 * vAsp - 0.48 : 0.0))));
  col = mix(col, uHi * 1.15, hl * hiK * uDot * (1.0 - 0.5 * back));
  // drawn rim line (a little darker and cooler than the shade tone) just inside the outline; small sprites get none (on a
  // drop a few pixels wide the line would be the whole drop: a grey speck)
  float line = smoothstep(-aa * 3.2, -aa * 1.4, d);
  col = mix(col, mix(shade * 0.82, uLine * skyL, 0.35), line * lineK * smoothstep(5.0, 12.0, vPx));
  float alpha = cov * fill;
  if (k == 2) {
    float ring = 1.0 - smoothstep(0.0, aa * 2.0 + 0.05, abs(d + 0.045));
    float cres2 = smoothstep(0.08, 0.02, abs(length(p + ld * -0.03) - 0.32)) * step(0.35, dot(normalize(p + 1e-4), ld));
    col = mix(uShade * uSky * 1.1, lit, max(ring, cres2)); col = mix(col, uHi * 1.3, hl);
    alpha = cov * max(0.22, max(ring, max(cres2, hl)));
  }
  if (k == 5) { col = uHi * 2.2; }
  if (k == 6) { col = mix(lit, uHi, 0.3) * 1.05; alpha *= 0.85; }
  if (k == 7) { col = lit * 1.05; }
  col += uLit * uEmis;
  if (uNoFog < 0.5) col = wfog(col, vDist, vWy);
  float soft = wSoft(vZ, uSoft);
  gl_FragColor = vec4(col, alpha * vAlpha * soft * uOp); }`;

export function spriteBatch(ctx, { max = 2000, lit = 0xffffff, shade = 0x9cc4ec, hi = 0xffffff, line = 0x6c9ad8, lineK = 0.55, soft = 0.6, flat = false, emis = 0,
  noFog = false, sort = true, lift = 0, cres = 1, dot = 1, parent = null, name = 'water-sprites' } = {}) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute('position', base.getAttribute('position'));
  const mk = () => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const iA = mk(), iB = mk(), iC = mk(); geo.setAttribute('iA', iA); geo.setAttribute('iB', iB); geo.setAttribute('iC', iC);
  geo.instanceCount = 0;
  const L = ctx.light.u;
  const m = new THREE.ShaderMaterial({ vertexShader: SPR_VS, fragmentShader: SPR_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tSceneData: ctx.glsl.U.tSceneData, uRes: ctx.glsl.U.uRes, uPxH: { value: ctx.H }, uFlat: { value: flat ? 1 : 0 }, uLit: { value: C(lit) }, uShade: { value: C(shade) },
      uHi: { value: C(hi) }, uLine: { value: C(line) }, uLineK: { value: lineK }, uSoft: { value: soft }, uOp: { value: 1 }, uEmis: { value: emis }, uNoFog: { value: noFog ? 1 : 0 },
      uLift: { value: lift }, uCres: { value: cres }, uDot: { value: dot }, uKeyDir: L.uKeyDir, uKeyCol: L.uKeyCol, uSky: L.uSky, ...FOG } });
  m.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.name = name; mesh.visible = false;
  (parent || ctx.overlay).add(mesh);
  const tmp = []; let n = 0;
  const api = { mesh, material: m, uniforms: m.uniforms,
    begin() { n = 0; tmp.length = 0; return api; },
    // position, size (world m), kind, alpha, velocity (stretch dir), stretch (extra length factor), seed 0..1, tone
    add(x, y, z, size, kind = 0, alpha = 1, vx = 0, vy = 0, vz = 0, stretch = 0, seed = 0, tone = 0) {
      if (n >= max || !(size > 1e-5) || !(alpha > 0.003)) return api;
      tmp.push([x, y, z, size, vx, vy, vz, stretch, kind, Math.min(1, alpha), seed, tone]); n++; return api; },
    end(camera) {
      if (sort && camera) { const cp = camera.position; for (const s of tmp) s.d = (s[0] - cp.x) ** 2 + (s[1] - cp.y) ** 2 + (s[2] - cp.z) ** 2; tmp.sort((a, b) => b.d - a.d); }
      for (let i = 0; i < tmp.length; i++) { const s = tmp[i]; iA.setXYZW(i, s[0], s[1], s[2], s[3]); iB.setXYZW(i, s[4], s[5], s[6], s[7]); iC.setXYZW(i, s[8], s[9], s[10], s[11]); }
      geo.instanceCount = tmp.length; iA.needsUpdate = iB.needsUpdate = iC.needsUpdate = true; mesh.visible = tmp.length > 0; return api; },
    get count() { return n; } };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// RIBBONS (falling sheets / streams, overlay scene)
// ---------------------------------------------------------------------------------------------------------------------
const RIB_VS = /* glsl */`
attribute vec2 aUv2;      // x across 0..1, y along 0..1
attribute vec4 aR;        // x seed, y alpha, z length (m), w width (m)
varying vec2 vUv; varying vec4 vR; varying float vZ, vWy, vDist; varying vec3 vW;
void main(){ vUv = aUv2; vR = aR; vec4 mv = viewMatrix * vec4(position, 1.0); vZ = -mv.z; vW = position; vWy = position.y; vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const RIB_FS = /* glsl */`${NOISE} ${OVERLAY} ${SOFT}
uniform vec3 uLit, uBody, uShade, uKeyCol, uSky; uniform float uT, uSoft, uOp, uSpeed, uEmis, uLift, uOpq;
${FOG_GLSL}
varying vec2 vUv; varying vec4 vR; varying float vZ, vWy, vDist; varying vec3 vW;
void main(){
  float s = vR.x * 37.0, L = max(vR.z, 0.01), W = max(vR.w, 0.01);
  float x = vUv.x, y = vUv.y;                          // y: 0 top (source) .. 1 bottom
  float ym = y * L, xm = (x - 0.5) * W;                 // metres along / across
  float fl = ym - uT * uSpeed;                          // falling coordinate (streaks travel down)
  // ragged edges that narrow and wander as the sheet falls, breaking up toward the bottom
  float wob = (n2(vec2(fl * 0.35 / W, s)) - 0.5) * 0.5 + (n2(vec2(fl * 1.3 / W, s + 4.0)) - 0.5) * 0.25;
  float half_ = 0.5 - 0.18 * y + wob * (0.25 + 0.6 * y);
  float edge = half_ - abs(x - 0.5 + wob * 0.15 * y);
  // holes + drops: the sheet tears into strands and then drops near its end
  float tear = n2(vec2(xm / W * 3.0 + s, fl / W * 0.8)) * 0.7 + n2(vec2(xm / W * 9.0 - s, fl / W * 2.5)) * 0.3;
  float br = smoothstep(0.55, 1.0, y) * 0.55 + smoothstep(0.15, 0.9, y) * 0.12;
  float body = edge - (br - (tear - 0.5) * 0.3) * 0.25;
  float aa = fwidth(body) * 1.2 + 1e-4;
  float cov = smoothstep(-aa, aa, body) * smoothstep(0.0, 0.03, y) * (1.0 - smoothstep(0.97, 1.0, y));
  if (cov < 0.004) discard;
  // streaks: bright long strands travelling down + darker inner channels
  float st = n2(vec2(xm / W * 7.0 + s, fl / W * 0.25)), st2 = n2(vec2(xm / W * 17.0 - s, fl / W * 0.6));
  vec3 skyL = mix(uSky, vec3(1.0), 0.4);
  vec3 kc = mix(uKeyCol, unitL(uKeyCol) * 0.94, uLift), sl = mix(skyL, unitL(skyL) * 0.9, uLift);
  vec3 lit = uLit * mix(kc, vec3(1.0), 0.35), bodyC = uBody * mix(sl, kc, 0.45), shade = uShade * mix(sl, kc, 0.25);
  vec3 col = mix(shade, bodyC, smoothstep(0.36, 0.40, st));
  col = mix(col, lit, smoothstep(0.64, 0.68, st * 0.7 + st2 * 0.3));
  float rimL = smoothstep(aa * 4.0, aa * 1.5, body);      // bright drawn edge
  col = mix(col, lit * 1.1, rimL * 0.85);
  float a = mix(0.8, 1.0, max(smoothstep(0.62, 0.66, st * 0.7 + st2 * 0.3), rimL));
  // opaque mass at the base, translucent only where the sheet tears apart near its end
  a = mix(a, 1.0 - 0.45 * smoothstep(0.55, 1.0, y), uOpq);
  col += uLit * uEmis;
  col = wfog(col, vDist, vWy);
  float soft = wSoft(vZ, uSoft);
  gl_FragColor = vec4(col, cov * a * vR.y * soft * uOp); }`;

export function ribbonBatch(ctx, { maxRibbons = 64, segs = 24, lit = 0xffffff, body = 0xc6ecff, shade = 0x7eb2e4, speed = 14, soft = 1.0, emis = 0, lift = 0, opaque = 0, parent = null, name = 'water-ribbons' } = {}) {
  const vPer = (segs + 1) * 2, nV = maxRibbons * vPer;
  const pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), rr = new Float32Array(nV * 4), idx = [];
  for (let r = 0; r < maxRibbons; r++) for (let i = 0; i < segs; i++) { const a = r * vPer + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setIndex(idx);
  const P = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), U2 = new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage), R4 = new THREE.BufferAttribute(rr, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', P); geo.setAttribute('aUv2', U2); geo.setAttribute('aR', R4);
  const L = ctx.light.u;
  const m = new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tSceneData: ctx.glsl.U.tSceneData, uRes: ctx.glsl.U.uRes, uLit: { value: C(lit) }, uBody: { value: C(body) }, uShade: { value: C(shade) }, uT: { value: 0 }, uSoft: { value: soft },
      uOp: { value: 1 }, uSpeed: { value: speed }, uEmis: { value: emis }, uLift: { value: lift }, uOpq: { value: opaque }, uKeyCol: L.uKeyCol, uSky: L.uSky, ...FOG } });
  m.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.name = name; mesh.visible = false;
  (parent || ctx.overlay).add(mesh);
  const V3 = THREE.Vector3, a = new V3(), b = new V3(), tg = new V3(), side = new V3(), view = new V3(), nn = new V3();
  let r = 0;
  const api = { mesh, material: m, uniforms: m.uniforms,
    begin(t = 0) { r = 0; m.uniforms.uT.value = t; return api; },
    // pts: array of [x,y,z] (top -> bottom), width (m, or array per point), normal: [x,y,z] sheet normal (null = face camera)
    add(pts, width, { seed = 0, alpha = 1, normal = null, camera = null } = {}) {
      if (r >= maxRibbons || pts.length < 2 || !(alpha > 0.003)) return api;
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      const base = r * vPer; const wMax = Array.isArray(width) ? Math.max(...width) : width;
      for (let i = 0; i <= segs; i++) {
        const f = i / segs * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f)), u = f - j;
        a.fromArray(pts[j]); b.fromArray(pts[j + 1]); const p = a.clone().lerp(b, u); tg.copy(b).sub(a).normalize();
        if (normal) nn.fromArray(normal); else if (camera) nn.copy(camera.position).sub(p).normalize(); else nn.set(0, 0, 1);
        side.crossVectors(tg, nn); if (side.lengthSq() < 1e-8) side.set(1, 0, 0); side.normalize();
        const w = Array.isArray(width) ? width[Math.min(width.length - 1, Math.round(f))] : width;
        for (let s = 0; s < 2; s++) { const k = base + i * 2 + s, o = (s - 0.5) * w; pos[k * 3] = p.x + side.x * o; pos[k * 3 + 1] = p.y + side.y * o; pos[k * 3 + 2] = p.z + side.z * o;
          uv[k * 2] = s; uv[k * 2 + 1] = i / segs; rr[k * 4] = seed; rr[k * 4 + 1] = alpha; rr[k * 4 + 2] = len; rr[k * 4 + 3] = wMax; } }
      r++; return api; },
    end() { geo.setDrawRange(0, r * segs * 6); P.needsUpdate = U2.needsUpdate = R4.needsUpdate = true; mesh.visible = r > 0; return api; },
    get count() { return r; } };
  void view;
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// BEAMS (anime god rays: additive axial billboards in the overlay, soft edges, bright at the source, soft depth)
// ---------------------------------------------------------------------------------------------------------------------
const BEAM_VS = /* glsl */`attribute vec2 aUv2; attribute vec2 aB; varying vec2 vUv; varying vec2 vB; varying float vZ, vDist;
  void main(){ vUv = aUv2; vB = aB; vec4 mv = viewMatrix * vec4(position, 1.0); vZ = -mv.z; vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const BEAM_FS = /* glsl */`${NOISE} ${OVERLAY} ${SOFT} uniform vec3 uCol; uniform float uK, uSoft, uT, uNear, uHard;
  varying vec2 vUv; varying vec2 vB; varying float vZ, vDist;
  void main(){ float x = vUv.x, y = vUv.y;
    float edge = smoothstep(0.0, 0.42, x) * smoothstep(1.0, 0.58, x);
    float core = smoothstep(0.25, 0.5, x) * smoothstep(0.75, 0.5, x);
    float st = 0.75 + 0.25 * n2(vec2(x * 6.0 + vB.x * 30.0, y * 2.0 - uT * 0.3));
    float along = pow(1.0 - y, 1.6) * smoothstep(0.0, 0.05, y);
    float prof = edge * 0.65 + core * 0.35;
    // hard: a crisp-edged flat shaft with a brighter inner stripe (drawn anime ray), fading only along its length
    if (uHard > 0.5) { float aa = fwidth(x) * 1.5 + 1e-3; prof = smoothstep(0.0, aa, x) * smoothstep(1.0, 1.0 - aa, x) * (0.7 + 0.3 * step(abs(x - 0.42 - 0.1 * vB.x), 0.12)); st = 1.0;
      along = pow(1.0 - y, 1.15) * smoothstep(0.0, 0.03, y); }
    float a = prof * st * along * vB.y * smoothstep(uNear * 0.5, uNear, vDist);
    a *= wSoft(vZ, uSoft);
    gl_FragColor = vec4(uCol * uK * a, 1.0); }`;
export function beamBatch(ctx, { max = 48, color = 0xe8fff4, k = 0.35, soft = 3, near = 2.5, hard = 0, parent = null, name = 'water-beams' } = {}) {
  const nV = max * 4, pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), bb = new Float32Array(nV * 2), idx = [];
  for (let i = 0; i < max; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setIndex(idx);
  const P = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), U2 = new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage), B2 = new THREE.BufferAttribute(bb, 2).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', P); geo.setAttribute('aUv2', U2); geo.setAttribute('aB', B2);
  const m = new THREE.ShaderMaterial({ vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { tSceneData: ctx.glsl.U.tSceneData, uRes: ctx.glsl.U.uRes, uCol: { value: C(color) }, uK: { value: k }, uSoft: { value: soft }, uT: { value: 0 }, uNear: { value: near }, uHard: { value: hard } } });
  m.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.name = name; mesh.visible = false; (parent || ctx.overlay).add(mesh);
  const V3 = THREE.Vector3, a = new V3(), b = new V3(), d = new V3(), v = new V3(), s = new V3();
  let n = 0;
  const api = { mesh, material: m, uniforms: m.uniforms,
    begin(t = 0) { n = 0; m.uniforms.uT.value = t; return api; },
    // from (top) along unit dir for len metres, widths w0 (top) -> w1 (bottom), intensity, seed
    add(from, dir, len, w0, w1, intensity = 1, seed = 0, camera) {
      if (n >= max || !(intensity > 0.001)) return api;
      a.fromArray(from); d.fromArray(dir).normalize(); b.copy(a).addScaledVector(d, len);
      v.copy(camera.position).sub(a.clone().lerp(b, 0.5)).normalize(); s.crossVectors(d, v); if (s.lengthSq() < 1e-8) s.set(1, 0, 0); s.normalize();
      const q = [[a, -w0 / 2, 0, 0], [a, w0 / 2, 1, 0], [b, -w1 / 2, 0, 1], [b, w1 / 2, 1, 1]];
      q.forEach(([p, o, ux, uy], j) => { const k3 = (n * 4 + j) * 3, k2 = (n * 4 + j) * 2; pos[k3] = p.x + s.x * o; pos[k3 + 1] = p.y + s.y * o; pos[k3 + 2] = p.z + s.z * o;
        uv[k2] = ux; uv[k2 + 1] = uy; bb[k2] = seed; bb[k2 + 1] = intensity; });
      n++; return api; },
    end() { geo.setDrawRange(0, n * 6); P.needsUpdate = U2.needsUpdate = B2.needsUpdate = true; mesh.visible = n > 0; return api; } };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// CROWNS (continuous thin sheets of water: a splash crown wall, the hull crown of the splash-down; main scene, opaque,
// double sided, inked). The wall flares out from its base ring, its rim is scalloped and pulled up into fingers that the
// caller tips with drops. Two cel tones from the key light, a sky-lit top band, a backlit rim along the top edge.
//   add({ c: [x,y,z], rx0, rz0, rx1, rz1, h, fingers, fk, seed, yaw }) ; begin() / end()
// ---------------------------------------------------------------------------------------------------------------------
const CROWN_VS = /* glsl */`attribute vec4 aC; varying vec3 vN, vW; varying vec4 vC;
  void main(){ vN = normal; vW = position; vC = aC; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const CROWN_FS = /* glsl */`${NOISE}
vec3 unitL(vec3 c){ return c / max(max(c.r, max(c.g, c.b)), 1e-3); }
uniform vec3 uLit, uShade, uRimC, uKeyDir, uKeyCol, uSky, uGround, uSeaL, uSeaS; uniform float uRim, uBodyT, uLiftL, uSeaK, uFoamV, uWhite, uStrN, uStreakK, uTear; uniform vec4 uKeyOv;
varying vec3 vN, vW; varying vec4 vC;
void main(){
  // the attribute normal is oriented (outward / toward the wave's concave face); 'back' = we look at the other side
  vec3 V = normalize(cameraPosition - vW), N = normalize(vN); bool back = dot(N, V) < 0.0; if (back) N = -N;
  vec3 L = uKeyOv.w > 0.5 ? normalize(uKeyOv.xyz) : normalize(uKeyDir);
  float br = (n2(vec2(vC.x * 9.0 + vC.w * 17.0, vC.y * 2.5)) - 0.5) * 0.35;
  vec3 kc = mix(mix(uKeyCol, unitL(uKeyCol) * 0.95, uLiftL), vec3(1.0), uWhite), amb = mix(mix(uGround, uSky, N.y * 0.5 + 0.5), unitL(uSky) * 0.9, max(uLiftL, 0.4));
  // sea body -> white foam toward the rim (wave fronts): a hard-edged waterline on the wall, wobbling
  float foamK = uSeaK > 0.0 ? smoothstep(uFoamV - 0.02, uFoamV + 0.02, vC.y + (n2(vec2(vC.x * 140.0 + vC.w, vC.y * 3.0)) - 0.5) * 0.3) : 1.0;
  // the sea body takes only a little of the (dusk-orange) key: sea water stays blue-turquoise, never pink
  vec3 kcS = mix(kc, vec3(1.0), (1.0 - foamK) * 0.7), ambS = mix(amb, vec3(1.0), (1.0 - foamK) * 0.5);
  vec3 litC = mix(uSeaL, uLit, foamK), shC = mix(uSeaS, uShade, foamK);
  float nl = dot(N, L) + br; float aa = fwidth(nl) * 0.8 + 1e-3;
  kc = kcS; amb = ambS;
  vec3 col = mix(shC * amb, litC * kc, smoothstep(uBodyT - aa, uBodyT + aa, nl));
  if (back && uSeaK < 0.5) col = mix(shC * amb, litC * kc, 0.62);           // the inside of a thin crown wall: a light even tone
  float tp = N.y + br * 0.5; float ta = fwidth(tp) + 1e-3;
  col = mix(col, max(col, litC * mix(amb, kc, 0.5)), smoothstep(0.55 - ta, 0.55 + ta, tp) * 0.8);   // sky-lit top band
  // rushing water: vertical striations along the rise (dark grooves + bright strands), the sheet tearing into holes and
  // strands toward its rim (holes are cut, so the ink pass draws their edges)
  float sx = vC.x * uStrN + vC.w * 13.0;
  float stv = n2(vec2(sx, vC.y * 1.6 + vC.w)) * 0.7 + n2(vec2(sx * 2.7, vC.y * 3.0 - vC.w)) * 0.3;
  float sa = fwidth(stv) + 1e-4;
  col = mix(col, col * 0.84, smoothstep(0.6 - sa, 0.6 + sa, stv) * uStreakK * (1.0 - 0.6 * foamK * uSeaK));
  col = mix(col, max(col, litC * kc * 1.04), smoothstep(0.28 + sa, 0.28 - sa, stv) * uStreakK);
  float tear = n2(vec2(sx * 0.6, vC.y * 5.0 + vC.w * 3.0)) * 0.75 + n2(vec2(sx * 2.1, vC.y * 11.0)) * 0.25;
  if (uTear > 0.0 && tear > 1.02 - uTear * 0.42 * smoothstep(0.45, 0.95, vC.y)) discard;
  float fr = 1.0 - abs(dot(N, V));
  float rim = smoothstep(0.62, 0.7, fr + br * 0.3) * smoothstep(-0.2, 0.4, dot(-V, L)) * smoothstep(0.55, 0.85, vC.y);
  col = mix(col, uRimC * kc * 1.15, rim * uRim);
  gl_FragColor = vec4(col, 0.0); }`;
export function crownBatch(ctx, { maxRings = 48, segs = 64, rows = 7, lit = 0xffffff, shade = 0xb4c4ec, rimCol = 0xfff6e8, rim = 0.8, bodyT = -0.05, lift = 0, id = null,
  seaLit = null, seaShade = null, foamV = 0.6, white = 0, streaks = 90, streak = 0.8, tear = 1, name = 'water-crowns' } = {}) {
  const vPer = (segs + 1) * (rows + 1), nV = maxRings * vPer;
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), cc = new Float32Array(nV * 4), idx = [];
  for (let r = 0; r < maxRings; r++) for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) { const a = r * vPer + j * (segs + 1) + i, b = a + 1, c = a + segs + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setIndex(idx);
  const P = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), Nn = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage), Cc = new THREE.BufferAttribute(cc, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', P); geo.setAttribute('normal', Nn); geo.setAttribute('aC', Cc);
  const L = ctx.light.u;
  const m = new THREE.ShaderMaterial({ vertexShader: CROWN_VS, fragmentShader: CROWN_FS, side: THREE.DoubleSide,
    uniforms: { uLit: { value: C(lit) }, uShade: { value: C(shade) }, uRimC: { value: C(rimCol) }, uRim: { value: rim }, uBodyT: { value: bodyT }, uLiftL: { value: lift },
      uSeaL: { value: C(seaLit ?? lit) }, uSeaS: { value: C(seaShade ?? shade) }, uSeaK: { value: seaLit != null ? 1 : 0 }, uFoamV: { value: foamV }, uWhite: { value: white }, uStrN: { value: streaks }, uStreakK: { value: streak }, uTear: { value: tear },
      uKeyOv: { value: new THREE.Vector4(0, 1, 0, 0) },
      uKeyDir: L.uKeyDir, uKeyCol: L.uKeyCol, uSky: L.uSky, uGround: L.uGround } });
  m.extensions = { derivatives: true };
  ctx.mat.mrt(m, { id: id ?? ctx.mat.nextId(), normal: 'normalize(mat3(viewMatrix) * (gl_FrontFacing ? vN : -vN))' });
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.name = name; mesh.visible = false; ctx.scene.add(mesh);
  // o.hf(x, z) (optional): height factor at the base point (0 flattens the wall there, e.g. past a seawall)
  const at = (o, a, v) => { const fi = Math.round((o.fingers * a + o.seed * 7) / (Math.PI * 2));   // each finger its own length
    const fb = Math.pow(Math.max(0, Math.cos(o.fingers * a + o.seed * 7)), 3) * (0.3 + 1.0 * hash(fi * 1.37 + o.seed * 3.1)), v4 = v * v * v * v;
    const wob = 1 + o.wob * (Math.sin(a * 3 + o.seed * 11) + 0.6 * Math.sin(a * 7 - o.seed * 5));
    const ca = Math.cos(a + o.yaw), sa = Math.sin(a + o.yaw), hk = o.hf ? o.hf(o.c[0] + ca * o.rx0, o.c[2] + sa * o.rz0) : 1, h = o.h * hk;
    if (o.curl) {   // a breaking wave: the face rises from the sea, the lip curls forward (outward) over it and down
      const Th = Math.PI * (0.5 + 0.42 * o.curl), th = v * Th, sk = (o.rx1 - o.rx0) * v * hk;
      const ro = h * 0.72 * (1 - Math.cos(th)) + sk + fb * v4 * h * o.fk * 0.5, yo = h * Math.sin(th) * (1 + 0.08 * Math.sin(a * 4 + o.seed * 9)) + fb * v4 * h * o.fk * 0.35;
      return [o.c[0] + ca * (o.rx0 * wob + ro), o.c[1] + yo, o.c[2] + sa * (o.rz0 * wob + ro)]; }
    const fl = Math.pow(v, 1.6), rx = (o.rx0 + (o.rx1 - o.rx0) * fl * hk) * wob + fb * v4 * h * 0.18, rz = (o.rz0 + (o.rz1 - o.rz0) * fl * hk) * wob + fb * v4 * h * 0.18;
    return [o.c[0] + ca * rx, o.c[1] + h * v * (1 + 0.1 * Math.sin(a * 4 + o.seed * 9)) + fb * v4 * h * o.fk, o.c[2] + sa * rz]; };
  const colSign = new Float32Array(segs + 1);
  let r = 0;
  const api = { mesh, material: m, uniforms: m.uniforms,
    begin() { r = 0; return api; },
    add(o) { if (r >= maxRings || !(o.h > 1e-3)) return api; o = { fingers: 9, fk: 0.45, seed: 0, yaw: 0, wob: 0.06, ...o };
      const base = r * vPer, e = 1e-3;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= segs; i++) { const a = i / segs * Math.PI * 2, v = j / rows, k = base + j * (segs + 1) + i;
        const p = at(o, a, v), pa = at(o, a + e, v), pv = at(o, a, Math.min(1, v + e)), pv0 = at(o, a, Math.max(0, v - e));
        const ta = [pa[0] - p[0], pa[1] - p[1], pa[2] - p[2]], tv = [pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]];
        let nx = ta[1] * tv[2] - ta[2] * tv[1], ny = ta[2] * tv[0] - ta[0] * tv[2], nz = ta[0] * tv[1] - ta[1] * tv[0]; const nl = Math.hypot(nx, ny, nz) || 1;
        // orient outward (away from the ring axis); a curling wave keeps the base row's orientation all the way up the arc
        // (its concave face stays the front side under the lip)
        const ox = p[0] - o.c[0], oz = p[2] - o.c[2];
        if (o.curl) { if (j === 0) colSign[i] = nx * ox + nz * oz < 0 ? -1 : 1; if (colSign[i] < 0) { nx = -nx; ny = -ny; nz = -nz; } }
        else if (nx * ox + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        pos.set(p, k * 3); nor.set([nx / nl, ny / nl, nz / nl], k * 3); cc.set([i / segs, v, j === rows ? 1 : 0, o.seed], k * 4); }
      r++; return api; },
    end() { geo.setDrawRange(0, r * rows * segs * 6); P.needsUpdate = Nn.needsUpdate = Cc.needsUpdate = true; mesh.visible = r > 0; return api; },
    // world position of a finger tip (for the drops the fingers pinch off)
    tip(o, i) { o = { fingers: 9, fk: 0.45, seed: 0, yaw: 0, wob: 0.06, ...o }; return at(o, (i * Math.PI * 2 - o.seed * 7) / o.fingers, 1); },
    get count() { return r; } };
  return api;
}

// deterministic helpers
export const hash =(n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
