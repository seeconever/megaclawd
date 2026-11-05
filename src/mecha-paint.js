// MEGA CLAWD · mecha paint (owner: mecha). The armour palette as engine cel materials (2 hard tones + highlight + bevel spec,
// inked) with one shared shader patch:
//   plate detail   procedural, crisp at any distance: inset panel lines, splits, hatches, corner bolts, vents, hazard
//                  stripes, grilles, ribs, edge chips and grime (aPD / aPK attributes from mecha-kit.js)
//   heat           local, not a filter: only the faces turned to the meteor AND close to the rock (MU.uMHeatP = the contact
//                  plane point, uMHeatDir = its normal toward the rock) glow; the rest stays terracotta (s24 s25 s31)
//   surge          a saturated cyan front running from the reactor along a conduit (front -> shoulder socket -> arm -> hand),
//                  on the seams only: a hot head and a fading tail (MU.uMSurge.w = front distance along the conduit, s27 s28)
//   wet            value only (darker, never a hue shift) + bright runnels down the steep faces (bay scenes)
//   lock           every armour material keeps its model-sheet hue (engine palette lock 0.7): coloured ambient only cools
//                  the shade tone a little, the lit terracotta stays at hue 12-16 in any set (underwater, dusk, backlit)
// All materials share the MU uniform objects: set them once per frame (mecha.js).
import * as THREE from 'three';

const DECL = /* glsl */`
uniform float uMHeat, uMSurgeK, uMWet, uMTime, uMDetail, uMWear, uMLineK;
uniform vec3 uMHeatDir, uMHeatCol, uMSurgeCol; uniform vec4 uMSurge, uMHeatP; uniform mat4 uMBodyInv;
varying vec4 vPD; varying vec2 vPK;
float mLineD(float d, float w, float px){ return 1.0 - smoothstep(w, w + px, abs(d)); }
float mh1(float s){ return fract(sin(s * 78.233 + 1.31) * 43758.5453); }
`;
const DETAIL = /* glsl */`
  float mL = 0.0, mB = 0.0, mBr = 0.0, mW = 0.0, mG = 0.0, mDk = 0.0, mFade = 1.0, mSeam = 0.0, mSeamW = 0.0;
  vec2 mp = vPD.xy, mhs = vPD.zw;
  float mpx = max(max(length(vec2(dFdx(mp.x), dFdy(mp.x))), length(vec2(dFdx(mp.y), dFdy(mp.y)))), 1e-4);
  float mKind = floor(vPK.y + 0.5), mSd = vPK.x;
  if (mKind > 0.5 && uMDetail > 0.0) {
    float r1 = mh1(mSd), r2 = mh1(mSd + 1.7), r3 = mh1(mSd + 3.1), r4 = mh1(mSd + 5.3);
    vec2 q = mhs - abs(mp); float dE = min(q.x, q.y);
    float lw = clamp(0.12, mpx * 0.55, mpx * 1.3);
    mFade = 1.0 - smoothstep(0.3, 0.75, mpx);
    bool lx = mhs.x >= mhs.y; vec2 pl = lx ? mp : mp.yx, hl = lx ? mhs : mhs.yx;
    float ins = 1.0 + 0.7 * r1, inner = smoothstep(ins - mpx, ins + mpx, dE);
    // energy seams (heat / surge): a wider line on the plate rim + the inset line, never thinner than ~1.5 px
    float sw = max(0.22, mpx * 0.9); mSeam = max(mLineD(dE, sw * 1.4, mpx), mLineD(dE - ins, sw, mpx) * step(ins + 1.2, min(hl.x, hl.y)));
    // the energy conduit (surge): a bolder seam, >= ~2 px at any distance
    mSeamW = max(mLineD(dE, max(0.55, mpx * 2.2), mpx), mLineD(dE - ins, max(0.4, mpx * 1.5), mpx) * step(ins + 1.2, min(hl.x, hl.y)));
    if (min(hl.x, hl.y) > ins + 1.2 && mKind != 3.0) mL = max(mL, mLineD(dE - ins, lw, mpx));
    if (mKind == 1.0) {
      float a = (r3 - 0.5) * 1.1 * (hl.x - ins);
      if (r2 > 0.3 && hl.x > 7.0) mL = max(mL, mLineD(pl.x - a, lw, mpx) * inner);
      float b = (r1 - 0.5) * 1.2 * (hl.y - ins);
      if (r4 > 0.45 && hl.y > 5.0) mL = max(mL, mLineD(pl.y - b, lw, mpx) * inner * step(0.0, (pl.x - a) * (r2 - 0.62)));
      vec2 hc = vec2((r4 - 0.5) * max(hl.x - ins - 4.0, 0.0), (r3 - 0.5) * max(hl.y - ins - 3.0, 0.0));
      vec2 hd = abs(pl - hc) - vec2(1.5 + r2 * 1.2, 0.9 + r1 * 0.6);
      float hsd = length(max(hd, 0.0)) + min(max(hd.x, hd.y), 0.0) - 0.3;
      if (r1 > 0.35 && hl.x > 6.0 && hl.y > 4.5) mL = max(mL, mLineD(hsd, lw, mpx));
      if (r1 > 0.35 && hl.x > 6.0 && hl.y > 4.5) mDk = max(mDk, 0.08 * (1.0 - smoothstep(-mpx, mpx, hsd)));
    }
    if (mKind == 1.0 || mKind == 4.0 || mKind == 6.0) {   // bolts at the inset corners (+ long-edge midpoints)
      vec2 bq = vec2(hl.x - ins - 0.9, hl.y - ins - 0.9);
      if (bq.x > 0.8 && bq.y > 0.8) { vec2 ap = abs(pl);
        float d = length(ap - bq); if (hl.x > 11.0) d = min(d, length(vec2(ap.x, ap.y - bq.y)));
        float br = max(0.42, mpx * 1.1);
        mB = (1.0 - smoothstep(br - mpx, br, d)) * (1.0 - smoothstep(0.25, 0.5, mpx));
        mBr = mLineD(d - br, max(0.08, mpx * 0.5), mpx) * (1.0 - smoothstep(0.25, 0.5, mpx)); } }
    if (mKind == 2.0) {   // vent louvres
      float f = abs(fract(pl.y / 1.5) - 0.5), slot = 1.0 - smoothstep(0.22 - mpx / 1.5, 0.22 + mpx / 1.5, f);
      float lip = mLineD(f - 0.24, 0.035, mpx / 1.5);
      mDk = max(mDk, mix(slot * 0.72, 0.4, smoothstep(0.25, 0.5, mpx)) * inner * step(abs(pl.x), hl.x - ins - 0.6));
      mB = max(mB, lip * 0.5 * inner * (1.0 - smoothstep(0.2, 0.4, mpx)) * step(abs(pl.x), hl.x - ins - 0.6)); }
    if (mKind == 3.0) {   // hazard stripes (black on yellow)
      float s = abs(fract((mp.x + mp.y) / 3.4) - 0.5), aa = mpx / 3.4;
      mDk = max(mDk, smoothstep(0.25 - aa, 0.25 + aa, s) * 0.86); }
    if (mKind == 5.0) {   // grille
      vec2 g = fract(mp / 1.3) - 0.5; float hole = 1.0 - smoothstep(0.3 - mpx / 1.3, 0.3 + mpx / 1.3, length(g));
      mDk = max(mDk, mix(hole * 0.75, 0.35, smoothstep(0.25, 0.5, mpx)) * inner); }
    if (mKind == 6.0) {   // ribs
      float f = abs(fract(pl.x / 1.1) - 0.5); mL = max(mL, mLineD(f - 0.0, 0.06, mpx / 1.1) * inner * 0.8); }
    // wear: chipped paint near the edges, grime streaks running down
    float wn = n2(mp * 0.55 + mSd * 17.0) * 0.6 + n2(mp * 2.3 + mSd * 3.0) * 0.4;
    float wk = wn + 0.3 * exp(-max(dE, 0.0) * 1.1);
    mW = smoothstep(0.79 - mpx * 0.12, 0.79 + mpx * 0.12, wk) * uMWear * (1.0 - smoothstep(0.3, 0.7, mpx));
    mG = smoothstep(0.5, 0.95, n2(vec2(mp.x * 0.8 + mSd * 7.0, mp.y * 0.06))) * 0.13 * uMWear;
    mL *= uMLineK;
  }
  { float ink = mL * 0.6 * mFade;
    base *= 1.0 - ink; shade *= 1.0 - ink * 0.75; hiC *= 1.0 - ink;
    base *= 1.0 - mDk; shade *= 1.0 - mDk * 0.85; hiC *= 1.0 - mDk;
    vec3 metal = vec3(0.5, 0.48, 0.47);
    base = mix(base, metal, mW * 0.5); shade = mix(shade, metal * 0.5, mW * 0.5); hiC = mix(hiC, metal * 1.3, mW * 0.5);
    base *= 1.0 - mG; shade *= 1.0 - mG; hiC *= 1.0 - mG;
    base = mix(base, hiC * 1.08, mB * 0.55); shade = mix(shade, base * 0.85, mB * 0.4);
    base *= 1.0 - mBr * 0.55; shade *= 1.0 - mBr * 0.55; hiC *= 1.0 - mBr * 0.55; }
`;
const EMIS = /* glsl */`
  if (uMWet > 0.001) {
    // wet armour: value only (x 0.82, no hue shift) + thin runnels running straight down the steep faces (drawn lines, on threes)
    col *= 1.0 - 0.05 * uMWet;   // (was 0.18: the wet bay giant read maroon) wet = runnels + sheen, barely darker
    vec3 Th = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-4, 0.0, 0.0));
    float hc = dot(vW, Th) / 3.4, ci = floor(hc), cf = fract(hc) - 0.5;
    float r1 = mh1(ci * 1.37 + 0.5), r2 = mh1(ci * 2.11 + 3.0);
    float wob = 0.18 * sin(vW.y * 0.21 + r1 * 6.3) + (r2 - 0.5) * 0.5;
    float px = fwidth(hc) + 1e-4, wd = 0.035 + 0.05 * r2;
    float line = 1.0 - smoothstep(wd, wd + px * 1.2, abs(cf - wob * 0.6));
    float seg = smoothstep(0.5, 0.56, fract(vW.y * (0.012 + 0.01 * r1) + uMTime * (0.55 + 0.4 * r2) + r1)) * step(0.68, mh1(ci * 0.73 + 9.1));
    float steep = 1.0 - smoothstep(0.45, 0.75, abs(N.y));
    float rv = line * seg * steep * uMWet * (1.0 - smoothstep(0.35, 0.9, px));
    col = mix(col, col * mix(1.35, 1.5, lit), rv * 0.7);
    // sheen: a brighter band on the top faces (value only)
    float sh = smoothstep(0.75, 0.95, N.y) * smoothstep(0.62, 0.66, n2(vW.xz * 0.05 + 2.0)) * uMWet;
    col = mix(col, col * 1.3, sh * 0.5 * lit);
  }
  #ifndef M_NOHEAT
  if (uMHeat > 0.001) {
    // heat, localised: faces turned to the meteor near the rock, and anything within ~25 m of the contact plane (the hands,
    // the forearms, the top edge). The rest of the armour keeps its terracotta + lavender shade.
    float hn = n3(vW * 0.035 + 1.3);
    float dPl = dot(uMHeatP.xyz - vW, uMHeatDir);                       // metres below the rock plane
    float facing = smoothstep(0.25, 0.8, dot(N, uMHeatDir) + (hn - 0.5) * 0.3);
    float hf = uMHeat * clamp(max(facing * (1.0 - smoothstep(22.0, 60.0, dPl)), 1.0 - smoothstep(8.0, 30.0, dPl + (hn - 0.5) * 8.0)), 0.0, 1.0);
    hf = floor(hf * 3.0 + 0.5) / 3.0 * step(0.08, hf);                  // banded like a painted cel ramp, not a gradient
    // two cel tones: crimson in the shade, molten orange on the lit side
    vec3 hot = mix(vec3(0.72, 0.1, 0.04), vec3(1.45, 0.42, 0.09), lit) * (0.9 + 0.2 * hn);
    col = mix(col, hot, hf * 0.9);
    // only the hottest seams glow (orange, not a neon outline on every plate)
    col += vec3(1.5, 0.5, 0.1) * (mSeam * 0.9 + mBr * 0.6) * smoothstep(0.6, 0.95, hf) * (0.7 + 0.6 * hn) * mFade;
  }
  if (uMSurgeK > 0.001) {
    // surge: one cyan front travelling along the conduit on the armour surface: reactor (0, -31, 38) -> across the lower
    // front to the front-side corner (+-54, -6, 37) -> round the side edge into the shoulder socket (+-61.5, -2.4, 0) ->
    // out along the arm (|x| > 62). Seams only. Body-local coordinates.
    vec3 lp = (uMBodyInv * vec4(vW, 1.0)).xyz; float sx = sign(lp.x + 1e-3);
    vec3 R0 = vec3(0.0, -31.0, 38.0), K0 = vec3(sx * 54.0, -6.0, 37.0), S0 = vec3(sx * 61.5, -2.4, 0.0), sa = K0 - R0, sb = S0 - K0;
    float la = length(sa), lb = length(sb);
    float ua = clamp(dot(lp - R0, sa) / (la * la), 0.0, 1.0), ub = clamp(dot(lp - K0, sb) / (lb * lb), 0.0, 1.0);
    float ca = distance(lp, R0 + sa * ua), cb = distance(lp, K0 + sb * ub);
    float along, corr;
    if (abs(lp.x) > 62.0) { along = la + lb + distance(lp, S0); corr = 0.0; }
    else if (ca < cb) { along = ua * la; corr = ca; } else { along = la + ub * lb; corr = cb; }
    float mask = 1.0 - smoothstep(16.0, 24.0, corr);
    float Rf = uMSurge.w, dd = Rf - along;
    float head = smoothstep(-2.0, 0.0, dd) * (1.0 - smoothstep(0.0, 14.0, dd));
    float tail = step(0.0, dd) * exp(-dd / 60.0);
    float g = (head * 2.0 + tail * 1.6) * mask * uMSurgeK;
    // saturated cyan (hue ~192) on the lines, a white-hot core only at the head; a cyan wash band rides with the head
    vec3 sc = mix(uMSurgeCol, vec3(0.75, 1.0, 1.0), head * 0.5);
    float ln = clamp(mSeamW * 1.4 + mL * 0.6 + mBr * 0.8, 0.0, 1.0);
    col = mix(col, sc * (0.9 + 0.8 * head), clamp(ln * g, 0.0, 1.0));
    // the front itself: a cyan band of light sweeping over the plates (hard-edged, cel), a faint charge left behind it
    float band = smoothstep(0.35, 0.45, head);
    col = mix(col, col * 0.45 + uMSurgeCol * 0.75, band * mask * uMSurgeK * 0.75) + uMSurgeCol * tail * mask * uMSurgeK * 0.08;
  }
  #endif
`;

export function patchMecha(sh, MU, { glass = false } = {}) {
  Object.assign(sh.uniforms, MU);
  sh.vertexShader = sh.vertexShader.replace('void main(){', 'attribute vec4 aPD; attribute vec2 aPK; varying vec4 vPD; varying vec2 vPK;\nvoid main(){ vPD = aPD; vPK = aPK;');
  sh.fragmentShader = sh.fragmentShader.replace('void main(){', (glass ? '#define M_NOHEAT\n' : '') + DECL + 'void main(){')
    .replace('float nl = dot(N, KD) + br;', DETAIL + '\n  float nl = dot(N, KD) + br;')
    .replace('col *= 1.0 + (fbm3(vO * uPigF + 3.7) - 0.5) * uPig;', 'col *= 1.0 + (fbm3(vO * uPigF + 3.7) - 0.5) * uPig;\n' + EMIS);
}

// Palette (sRGB hex). Terracotta = the mascot body (hue 15), cooler lavender shade tones for the anime look.
export const PAL = {
  terra: 0xD97757, terraSh: 0xA4564A, terraHi: 0xF4A986,
  cream: 0xF2E8D2, creamSh: 0xA9A4C0, creamHi: 0xFFFDF4,
  char: 0x3C3D4A, charSh: 0x23222E, charHi: 0x5E6074,
  hull: 0x2B2A35, hullSh: 0x1A1922,
  bronze: 0xC48E4C, bronzeSh: 0x7C5640, bronzeHi: 0xF6D08A,
  hazard: 0xF4C238, hazardSh: 0xB08A4C,
  glass: 0x1A2340, glassSh: 0x0F1424, glassHi: 0x3C5288,
  kelp: 0x5C8A3A, kelpSh: 0x2F5440, barn: 0xD8D2C2, barnSh: 0x8E8CA0,
};

export function mechaMaterials(ctx) {
  const { mat, glsl } = ctx;
  const MU = { uMHeat: { value: 0 }, uMHeatDir: { value: new THREE.Vector3(0, 1, 0) }, uMHeatCol: { value: new THREE.Color(1.0, 0.33, 0.07) },
    uMHeatP: { value: new THREE.Vector4(0, 1e6, 0, 0) }, uMBodyInv: { value: new THREE.Matrix4() },
    uMSurge: { value: new THREE.Vector4(0, 0, 0, 0) }, uMSurgeK: { value: 0 }, uMSurgeCol: { value: new THREE.Color(0.0, 0.6, 1.0).multiplyScalar(1.15) },
    uMWet: { value: 0 }, uMTime: { value: 0 }, uMDetail: { value: 1 }, uMWear: { value: 1 }, uMLineK: { value: 1 } };
  const mk = (color, o = {}) => { const m = mat.cel(color, { id: mat.nextId(), bevel: 4, spec: 0.4, specThr: 0.972, rimI: 0.3, lock: 0.7, ...o });
    glsl.patchShader(m, o.glassPatch ? 'mechaGlass' : 'mechaPlate', sh => patchMecha(sh, MU, { glass: !!o.glassPatch })); return m; };
  const P = PAL;
  const M = {
    terra: mk(P.terra, { shade: P.terraSh, hi: P.terraHi, hiAmt: 0.6 }), terra2: mk(P.terra, { shade: P.terraSh, hi: P.terraHi, hiAmt: 0.6 }),
    terra3: mk(P.terra, { shade: P.terraSh, hi: P.terraHi, hiAmt: 0.6 }),
    cream: mk(P.cream, { shade: P.creamSh, hi: P.creamHi, hiAmt: 0.5 }), cream2: mk(P.cream, { shade: P.creamSh, hi: P.creamHi, hiAmt: 0.5 }),
    char: mk(P.char, { shade: P.charSh, hi: P.charHi, hiAmt: 0.45, spec: 0.5 }), char2: mk(P.char, { shade: P.charSh, hi: P.charHi, hiAmt: 0.45, spec: 0.5 }),
    hull: mk(P.hull, { shade: P.hullSh, hiAmt: 0.25, spec: 0.3 }),
    bronze: mk(P.bronze, { shade: P.bronzeSh, hi: P.bronzeHi, hiAmt: 0.75, hiT: 0.7, spec: 0.8, specThr: 0.96 }),
    hazard: mk(P.hazard, { shade: P.hazardSh, hiAmt: 0.4 }),
    glass: mk(P.glass, { shade: P.glassSh, hi: P.glassHi, hiT: 0.9, hiAmt: 0.7, spec: 0.9, specThr: 0.985, rimI: 0.15, glassPatch: true }),
    kelp: mk(P.kelp, { shade: P.kelpSh, side: THREE.DoubleSide, hiAmt: 0.3, spec: 0.2 }),
    barn: mk(P.barn, { shade: P.barnSh, hiAmt: 0.4, spec: 0.2 }),
  };
  M.glass.userData.noWear = true;
  // hand-lettered decal: paint colour where the texture alpha > 0.5 (no ink lines, id 100+), follows heat / wet like the plates
  let did = 0;
  M._decal = (tex, color) => { const m = mat.cel(color, { id: 120 + (did++ % 40), map: tex, bevel: 4, spec: 0.15, rimI: 0.2, hiAmt: 0.4 });
    glsl.patchShader(m, 'mechaDecal', sh => { sh.fragmentShader = sh.fragmentShader.replace('base *= tx.rgb; shade *= tx.rgb; hiC *= tx.rgb;', 'if (tx.a < 0.5) discard;'); patchMecha(sh, MU); });
    return m; };
  return { M, MU };
}
