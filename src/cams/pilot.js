// MEGA CLAWD · cameras + looks for the pilot department (owner: pilot). Shots: s03 s04 s08 s09 s12 s18 s26 s35.
// Cameras are built from the measured pier spots (ctx.modules.pilot.spots) so a rebuilt pier keeps the framing.
// lt = seconds into the shot, d = shot length, t = film time, st = { shot, k, ctx }. Camera on ones (raw t).
import { lerp, sstep, ease, clamp, bump } from '../pipeline-util.js';
import { CUES } from '../shots.js';
const DEG = Math.PI / 180;

const P = (st) => st.ctx.modules.pilot, S = (st) => P(st)?.spots;
const add = (a, b) => a.map((v, i) => v + b[i]);
const mixA = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const arr = (v) => [v.x, v.y, v.z];
// hand-held drift (deterministic, on ones)
const drift = (t, a = 0.004, f = 0.7) => [a * Math.sin(t * f * 6.1 + 1.3) + a * 0.5 * Math.sin(t * f * 13.7), a * Math.sin(t * f * 5.3 + 0.4) + a * 0.4 * Math.sin(t * f * 11.1 + 2), 0];
// camera shake (s26 alarm): stacked sines, on ones
const shake = (t, a) => [a * (Math.sin(t * 53) * 0.6 + Math.sin(t * 31 + 1) * 0.4), a * (Math.sin(t * 47 + 2) * 0.6 + Math.sin(t * 29) * 0.4), a * 0.5 * Math.sin(t * 41 + 3)];

export const CAMS = {
  // s03: high-ish 3/4 from the water on his right: Clawd at the pier end, legs over the edge above the sparkling bay,
  // boats bobbing along the pier behind him, the town on the hills; slow push in
  s03: (lt, d, t, st) => { const s = S(st), c = [s.sit.x, s.deckY, s.sit.z], k = ease(lt / d);
    return { pos: add(add(c, mixA([1.95, 0.6, 1.75], [1.78, 0.55, 1.58], k)), drift(t, 0.003)), look: add(c, [-0.2, 0.14, -0.06]), fov: 25, near: 0.03 }; },
  // s04: macro from the town side toward the bay: the cup, the spoon digging, Clawd's nub holding the straw end (right),
  // the painted sky + the meteor streak flaring in the syrup at CUES.glint
  s04: (lt, d, t, st) => { const s = S(st), c = [s.cupDeck.x, s.deckY + 0.11, s.cupDeck.z], k = ease(lt / d);
    return { pos: add(c, [lerp(-0.2, -0.18, k), lerp(0.13, 0.12, k), lerp(-0.33, -0.3, k)]), look: add(c, [-0.09, 0.03, 0.05]), fov: 38, near: 0.01 }; },
  // s08: low 3/4 from his front-left, looking up past him: the face (spoon frozen) and the sky to his upper right where
  // the orange point burns; he tilts back and turns toward it; slow push
  s08: (lt, d, t, st) => { const s = S(st), c = [s.sit.x, s.deckY, s.sit.z], k = ease(lt / d);
    return { pos: add(add(c, mixA([0.3, -0.06, 0.9], [0.26, -0.1, 0.78], k)), drift(t, 0.0015)), look: add(c, mixA([0.05, 0.3, 0.0], [0.03, 0.42, -0.05], sstep(16.35, 16.75, t))), fov: 38, near: 0.02 }; },
  // s09: 3/4 profile from the water off the bollard side: the cup set down beside him (telephoto), then zoom out as he
  // crouches and leaps out over the bay in a high arc (left -> right), the splash 2 m out; bollard + cup stay in frame
  s09: (lt, d, t, st) => { const s = S(st), B = s.bollard, cupT = arr(s.cupBollard), sp = P(st).splash.pos, J = P(st).jumpPath(t);
    const k = ease(sstep(0.45, 0.9, lt)), kE = ease(sstep(1.12, 1.42, lt));
    const pos = [B.x - 2.75, s.deckY + lerp(0.36, 0.3, k), B.z + 3.6];
    // follow the leap (pivot, lagging toward the arc middle), then settle on bollard + cup + splash
    const arcMid = [lerp(B.x, sp[0], 0.45), s.deckY * 0.92, lerp(B.z, sp[2], 0.35)], jc = [J.c.x, J.c.y, J.c.z];
    const follow = mixA(arcMid, jc, 0.5 * sstep(0.8, 0.95, lt) * (1 - kE));
    const end = [lerp(B.x, sp[0], 0.6), lerp(s.deckY, 0, 0.5) + 0.12, lerp(B.z, sp[2], 0.55)];
    const look = mixA(mixA(add(cupT, [0.2, -0.04, 0.02]), follow, k), end, kE);
    return { pos, look, fov: lerp(15, lerp(30, 36, kE), k), near: 0.05 }; },
  // s35: low from the bay side (deck seen at a grazing angle): he climbs up the ladder toward us, shakes off, steps to the
  // bollard, takes the cup, turns round to us, tips it to look in (blue water), sips; the shower over the dusk town behind
  s35: (lt, d, t, st) => { const s = S(st), L = [s.ladder.x, s.deckY, s.edgeZ], c = [s.stand.x, s.deckY, s.stand.z];
    const k = sstep(0.55, 1.2, lt), k2 = ease(sstep(1.3, 1.8, lt));
    const look = mixA(mixA(add(L, [0.08, 0.04, 0]), add(c, [0.06, 0.28, 0.05]), k), add(c, [0.12, 0.3, 0.16]), k2);
    const pos = mixA(add(L, [0.95, 0.2, 1.9]), add(c, [1.1, 0.14, 1.35]), ease(sstep(0, 1.6, lt)));
    return { pos: add(pos, drift(t, 0.002)), look, fov: lerp(34, 27, k2), near: 0.03 }; },
  // cockpit (local frame: seat at the origin, Clawd faces +z). s12: high over his shoulder toward the visor window (the
  // underwater view, both levers): he drops in legs first through the hatch at the top of frame and lands; the panels
  // boot; the camera swings round to a high 3/4 front medium as his nubs press onto both lever grips
  s12: (lt, d, t, st) => { const kf = clamp((t - 24.5) / (CUES.seat - 24.5), 0, 1), sw = ease(sstep(0.78, 1.5, lt));   // swing on the landing, front for the boot + grip
    const th = lerp(152, 2, sw) * DEG, R = lerp(0.95 - 0.03 * sstep(0.5, 0.78, lt), 0.76, sw) - 0.05 * sstep(1.6, 2.5, lt), y = lerp(1.38, 0.96, sw);
    const look = mixA([-0.05, lerp(1.95, 1.05, ease(kf)), 0.62], [0.0, 0.6, 0.04], sw);
    return { pos: add([Math.sin(th) * R, y, Math.cos(th) * R], drift(t, 0.0015)), look, fov: lerp(60, 58, sw), near: 0.02 }; },
  // s18: low 3/4 front-left, both lever shafts on screen; anticipation pull back, then a punch-in on the thrust (CUES.levers)
  s18: (lt, d, t, st) => { const L = CUES.levers, back = 0.03 * bump(t, L - 0.1, 0.16, 0.02, 0.05), punch = sstep(L - 0.01, L + 0.07, t);
    const dir = [-0.42, 0, 0.91], r = 0.56 + back - 0.05 * punch;
    return { pos: add([dir[0] * r, 0.5 - 0.02 * punch, dir[2] * r], drift(t, 0.0012)), look: [0.05, 0.64, 0.02], fov: lerp(74, 66, punch), roll: -2 + 3 * punch, near: 0.02 }; },
  // s26: low wide 3/4 front-left, shaking: strain face, both nubs on the rattling grips, the flashing warning panel behind
  s26: (lt, d, t, st) => { const a = 0.006 + 0.003 * Math.sin(lt * 3);
    return { pos: add([-0.3, 0.52, 0.48], shake(t, a)), look: add([0.06, 0.72, -0.05], shake(t + 0.13, a * 0.6)), fov: lerp(60, 55, ease(lt / d)), roll: 4 + 1.5 * Math.sin(t * 2), near: 0.02 }; },
};

const pierShadow = (st, c, r = 0.9, dir) => ({ center: c, radius: r, k: 1, ...(dir ? { dir } : {}) });
export const LOOKS = {
  s03: (lt, d, t, st) => ({ shadow: pierShadow(st, [S(st).sit.x + 0.2, S(st).deckY + 0.2, S(st).sit.z], 1.0, [0.35, 0.85, 0.45]), hero: { dir: [0.4, 0.72, 0.58], color: 0xfff6ec, k: 1.0 } }),
  s04: (lt, d, t, st) => ({ shadow: pierShadow(st, [S(st).cupDeck.x, S(st).deckY + 0.1, S(st).cupDeck.z], 0.5, [-0.35, 0.8, -0.5]), ink: { width: 2.4 }, bloom: { strength: 0.45 },
    hero: { dir: [-0.35, 0.8, -0.5], color: 0xfff6ec, k: 1.0 }, rim: { dir: [0.2, 0.5, 0.85], color: 0xfff2e0, k: 1.1 } }),
  s08: (lt, d, t, st) => { const k = sstep(16.3, 16.9, t);
    return { shadow: pierShadow(st, [S(st).sit.x, S(st).deckY + 0.2, S(st).sit.z], 0.8, [0.3, 0.8, 0.5]), hero: { dir: [0.3, 0.62, 0.72], color: lerpHex(0xfff4ea, 0xffd2b0, k), k: 1.0 },
      rim: { dir: [0.25, 0.7, -0.67], color: 0xff9a50, k: 1.8 * k } }; },
  s09: (lt, d, t, st) => ({ shadow: pierShadow(st, [S(st).stand.x, S(st).deckY + 0.25, S(st).stand.z], 1.2, [-0.5, 0.75, 0.4]), hero: { dir: [-0.55, 0.7, 0.45], color: 0xfff4ea, k: 1.0 } }),
  // dusk: the sun sets over the bay behind the camera -> warm key from our side, a cool lavender rim from the town sky
  s35: (lt, d, t, st) => ({ shadow: pierShadow(st, [lerp(S(st).ladder.x, S(st).stand.x, sstep(0.8, 1.6, lt)), S(st).deckY + 0.2, S(st).stand.z], 1.3, [0.3, 0.7, 0.65]),
    hero: { dir: [0.35, 0.55, 0.76], color: 0xffd8bc, k: 1.0 }, rim: { dir: [-0.2, 0.4, -0.9], color: 0xa898ff, k: 1.3 } }),
};
// cockpit: navy cabin, cyan screen light, the outside light through the visor (+z); Clawd on the hero key
const cockShadow = { center: [0, 0.72, 0.05], radius: 0.75, k: 0.9, dir: [-0.25, 0.9, 0.35] };
LOOKS.s12 = (lt, d, t, st) => { const on = sstep(25.3, 26.0, t);
  return { shadow: cockShadow, sun: { dir: [0.0, 0.6, 1.0], color: 0x8fe8f0, k: lerp(0.55, 0.8, on) }, amb: { sky: 0x8aa8e8, ground: 0x4a5070, k: lerp(0.5, 0.85, on) },
    hero: { dir: mixA([0.15, -0.12, -0.98], [-0.35, 0.55, 0.75], on), color: lerpHex(0xc8f4ff, 0xfff0e4, on), k: lerp(1.0, 0.74, on) }, rim: { dir: mixA([0.1, 0.45, 1.0], [-0.2, 0.5, -1.0], on), color: 0x9ff0ff, k: 1.3 },
    grade: { vignette: 0.26 }, bloom: { strength: 0.45 } }; };
LOOKS.s18 = (lt, d, t) => ({ shadow: cockShadow, sun: { dir: [0.1, 0.55, 1.0], color: 0xf0f6ff, k: 0.9 }, amb: { sky: 0xb4bad6, ground: 0x646478, k: 0.85 },
  hero: { dir: [-0.35, 0.6, 0.72], color: 0xfff4dc, k: 0.9 }, rim: { dir: [0.3, 0.4, -1.0], color: 0xa8f2ff, k: 1.1 },
  grade: { vignette: 0.24, flash: 0.05 * bump(t, CUES.levers + 0.02, 0.08, 0.0, 0.1) }, bloom: { strength: 0.3, threshold: 1.25 } });
// s26 red alarm: a dark cabin swept by a rotating red beacon key (stepping on twos), near-black shadows; Clawd keeps his
// own warm key (stays terracotta) with a red-lavender shadow fill (pilot-look fill)
LOOKS.s26 = (lt, d, t) => { const tt = Math.floor(t * 12) / 12, a = tt * 7.5, beam = Math.pow(Math.max(0, Math.cos(a - 0.6)), 3);
  return { shadow: cockShadow, sun: { dir: [Math.cos(a), 0.4, Math.sin(a)], color: 0xff2414, k: 0.35 + 1.5 * beam }, amb: { sky: 0x40121e, ground: 0x12060a, k: 0.55 },
    hero: { dir: [-0.35, 0.55, 0.76], color: 0xffcdb4, k: 0.95 }, rim: { dir: [Math.cos(a), 0.3, Math.sin(a)], color: 0xff3a24, k: 0.6 + 1.6 * beam },
    grade: { vignette: 0.4 }, bloom: { strength: 0.6 } }; };
function lerpHex(a, b, k) { let o = 0; for (const s of [16, 8, 0]) o |= Math.round(lerp((a >> s) & 255, (b >> s) & 255, k)) << s; return o; }
