// MEGA CLAWD · camera + look registry (owner: engine).
// Each department fills src/cams/<team>.js for the shots it owns (CONTRACT.md):
//   export const CAMS  = { s05: (lt, d, t, st) => ({ pos: [x,y,z], look: [x,y,z], fov, roll?, near?, far? }) };
//   export const LOOKS = { s05: (lt, d, t, st) => ({ ...partial LOOK, see BASE_LOOK in src/pipeline.js }) };
// lt = seconds into the shot, d = shot length, t = film time, st = { shot, k: lt/d, ctx } (ctx.modules.* = department APIs,
// so a camera can track e.g. ctx.modules.mecha.anchor('head')). Camera moves on ones (raw t), never on twos.
// Resolution order per shot: DEFAULT_CAMS here  <-  team CAMS.   Looks: BASE_LOOK <- SET_LOOK(set, t) <- team LOOKS.
import { curve, lerp, sstep, ease } from '../pipeline-util.js';
import { END_CARD_LOOK } from '../pipeline-kit.js';
import * as mecha from './mecha.js';
import * as pilot from './pilot.js';
import * as world from './world.js';
import * as meteor from './meteor.js';
import * as water from './water.js';

export const TEAM_CAMS = { mecha, pilot, world, meteor, water };

const L = (a, b, k) => a.map((v, i) => lerp(v, b[i], ease(k)));
const mv = (p0, p1, look, fov = 40, o = {}) => (lt, d) => ({ pos: L(p0, p1, lt / d), look, fov, ...o });
const mvl = (p0, p1, l0, l1, fov = 40, o = {}) => (lt, d) => ({ pos: L(p0, p1, lt / d), look: L(l0, l1, lt / d), fov, ...o });

// Placeholder framings (provisional geography, docs/ARCHITECTURE.md): pier end at the origin, deck y = 2.2, the bay toward +z,
// the town toward -z, mecha site ~ (0, 0, 220). Sky / strato / space sets use their own local frames.
export const DEFAULT_CAMS = {
  s01: mv([30, 45, 520], [26, 40, 470], [-20, 20, -260], 38),
  s02: mv([-40, 30, -70], [-40.5, 29.5, -71], [-62, 16, -120], 40),
  s03: mv([-2.6, 3.3, 3.9], [-2.3, 3.2, 3.5], [0, 2.55, 0], 34, { near: 0.03 }),
  s04: mv([0.25, 2.85, 0.75], [0.22, 2.82, 0.7], [0.05, 2.55, 0.2], 28, { near: 0.01 }),
  s05: mv([0, 900, 0], [0, 905, 0], [600, 4000, 6000], 50),
  s06: mv([0, 120000, 4200], [0, 120000, 4000], [0, 119300, 0], 35, { far: 2e6 }),
  s07: mv([-30, 9, -45], [-29.5, 9.2, -45.5], [-10, 40, 40], 45),
  s08: mv([0.12, 2.78, 1.4], [0.1, 2.76, 1.3], [0, 2.6, 0], 30, { near: 0.02 }),
  s09: mv([3.6, 3.4, -1.0], [3.4, 3.3, -0.8], [0, 2.4, 0.8], 38, { near: 0.03 }),
  s10: mvl([1.5, -3, 3], [1.5, -8, 6], [0, -40, 140], [0, -42, 150], 50),
  s11: (lt, d, t, st) => { const a = st.ctx.modules.mecha?.anchor('head')?.toArray() ?? [0, -40, 250]; return { pos: [a[0] + 30, a[1] + 45 - lt, a[2] - 70], look: a, fov: 40 }; },
  s12: mv([0, 1.6, 2.6], [0, 1.5, 2.3], [0, 1.0, 0], 42, { near: 0.02 }),
  s13: (lt, d, t, st) => { const a = st.ctx.modules.mecha?.anchor('reactor')?.toArray() ?? [0, -40, 250]; return { pos: [a[0] + 12, a[1] + 18, a[2] - 25 + lt], look: a, fov: 35 }; },
  s14: mv([-40, 34, -62], [-40, 34, -61], [0, 5, 220], 42),
  s15: mvl([90, 8, 40], [88, 8, 42], [0, 30, 220], [0, 70, 220], 45),
  s16: mv([0.4, 2.6, -1.0], [0.4, 2.6, -1.0], [0, 70, 220], 55, { near: 0.05 }),
  s17: mv([0, 1800, 0], [0, 1810, 0], [3000, 4000, 9000], 50),
  s18: mv([0.6, 1.6, 1.2], [0.55, 1.6, 1.1], [0, 1.3, 0], 34, { near: 0.02 }),
  s19: mv([150, 15, 120], [145, 14, 122], [0, 40, 220], 40),
  s20: mvl([380, 30, -40], [380, 32, -40], [0, 60, 220], [0, 150, 220], 45),
  s21: mvl([-300, 2800, -200], [-300, 3200, -200], [0, 2850, 0], [0, 3260, 0], 45),
  s22: mv([600, 34900, 1400], [600, 34950, 1400], [0, 35400, 0], 45, { far: 2e6 }),
  s23: mv([300, 35000, 700], [300, 35000, 690], [0, 35100, 0], 40),
  s24: mv([400, 35050, 800], [420, 35060, 820], [0, 35100, 0], 45),
  s25: mv([220, 35080, 380], [230, 35080, 390], [0, 35100, 0], 42),
  s26: mv([0.35, 1.55, 0.9], [0.33, 1.55, 0.88], [0, 1.35, 0], 30, { near: 0.02 }),
  s27: mv([160, 35100, 260], [150, 35100, 250], [0, 35100, 0], 40),
  s28: mv([300, 35050, 520], [310, 35040, 530], [0, 35150, 0], 45),
  s29: mv([700, 35000, 1300], [720, 35000, 1340], [0, 35300, 0], 50),
  s30: mv([-40, 18, -120], [-40, 18.5, -119], [10, 150, 300], 50),
  s31: mvl([-400, 3000, -300], [-400, 2800, -300], [0, 3000, 0], [0, 2700, 0], 45),
  s32: mv([-200, 20, -60], [-198, 20, -60], [0, 30, 220], 45),
  s33: mv([-25, 10, -46], [-24, 10, -46], [0, 2, 30], 50),
  s34: mv([60, 12, 60], [58, 12, 62], [0, 40, 220], 42),
  s35: mv([-2.2, 3.2, 3.4], [-2.0, 3.1, 3.1], [0, 2.6, 0], 36, { near: 0.03 }),
  s36: () => ({ pos: [0, 0, 5], look: [0, 0, 0], fov: 40 }),
};

// Set looks (bright high-key). t = film time (dusk blends in from 63-66 s for the coast sets).
const DAY = {
  sun: { dir: [0.3, 0.62, 0.72], color: 0xfff6ea, k: 1.0 },
  amb: { sky: 0xb4c4ff, ground: 0x9c8e86, k: 0.95 },
  haze: { color: 0xc6dcff, density: 0.00018, h0: 0, falloff: 0.0011, max: 0.55, sunScatter: 0.3, sky: 0.3 },
  water: { on: true, level: 0 },
  shafts: { on: false },
};
const DUSK = {
  sun: { dir: [0.15, 0.1, 0.98], color: 0xffb27a, k: 1.0 },
  amb: { sky: 0x9a8ee0, ground: 0x8e6a72, k: 0.9 },
  rim: { color: 0xffc89a, k: 1.2 },
  hero: { color: 0xffd6b0, k: 1.0 },
  haze: { color: 0xf0b8a8, density: 0.0004, h0: 0, falloff: 0.001, max: 0.75, sunScatter: 0.8, sky: 0.4 },
  water: { on: true, level: 0 },
  grade: { hiTint: 0xfff0e0, shTint: 0xe8e4ff, sat: 1.16 },
};
export const SET_LOOKS = {
  town: DAY, pier: DAY, bay: DAY,
  under: { sun: { dir: [0.1, 1, 0.25], color: 0xd8fff8, k: 0.9 }, amb: { sky: 0x7fe0f0, ground: 0x2a8aa8, k: 0.95 }, rim: { color: 0xc8fff8, k: 0.8 },
    hero: { dir: [0.15, 1, 0.35], color: 0xeafffa, k: 1.05 }, background: 0x1488b4,
    haze: { color: 0x1488b4, density: 0.008, h0: 0, falloff: 0, max: 0.88, sunScatter: 0.35, sky: 0 },
    shafts: { on: true, pos: [0, 0, 120], k: 0.55, thr: 0.5, occ: 1, radius: 0.9, decay: 0.975, tint: 0xd8fff4 },
    water: { on: false }, grade: { tint: 0xf0ffff } },
  cockpit: { sun: { dir: [0.2, 1, 0.4], color: 0xfff0dc, k: 0.9 }, amb: { sky: 0xa8c0f0, ground: 0x7a6a74, k: 1.0 },
    haze: { density: 0 }, water: { on: false }, grade: { vignette: 0.22 } },
  sky: { sun: { dir: [0.3, 0.62, 0.72], color: 0xfff8ee, k: 1.05 }, amb: { sky: 0xb8c8ff, ground: 0xe0e4f4, k: 1.0 },
    haze: { color: 0xd4e4ff, density: 0.00006, h0: 1500, falloff: 0.0003, max: 0.6, sunScatter: 0.3, sky: 0.2 }, water: { on: false } },
  strato: { sun: { dir: [0.5, 0.35, 0.8], color: 0xffffff, k: 1.15 }, amb: { sky: 0x8aa4f0, ground: 0xc8d4f4, k: 0.9 },
    haze: { color: 0xa8c4ff, density: 0.00001, h0: 30000, falloff: 0.0001, max: 0.4, sunScatter: 0.2, sky: 0.5 }, water: { on: false },
    grade: { sat: 1.15, contrast: 1.08 } },
  space: { sun: { dir: [0.6, 0.3, 0.75], color: 0xffffff, k: 1.2 }, amb: { sky: 0x4c5aa0, ground: 0x2a3060, k: 0.7 },
    haze: { density: 0 }, water: { on: false }, grade: { contrast: 1.1 } },
  card: END_CARD_LOOK,
};
const mixLook = (a, b, k) => k <= 0 ? a : k >= 1 ? b : { ...b, ...lerpLook(a, b, k) };
function lerpLook(a, b, k) {   // numeric/array/hex lerp of the fields both looks share (sun, amb, haze, rim, hero, grade colours)
  const out = {};
  for (const key of Object.keys(b)) { const x = a[key], y = b[key];
    if (y && typeof y === 'object' && !Array.isArray(y)) out[key] = x && typeof x === 'object' ? lerpLook(x, y, k) : y;
    else if (Array.isArray(y) && Array.isArray(x)) out[key] = x.map((v, i) => lerp(v, y[i], k));
    else if (typeof y === 'number' && typeof x === 'number') out[key] = /color|sky|ground|Tint|Col|lift/i.test(key) && (x > 255 || y > 255) ? hexLerp(x, y, k) : lerp(x, y, k);
    else out[key] = k < 0.5 ? x ?? y : y; }
  return out;
}
const hexLerp = (a, b, k) => { const c = (h, s) => (h >> s) & 255; let o = 0; for (const s of [16, 8, 0]) o |= Math.round(lerp(c(a, s), c(b, s), k)) << s; return o; };
const PIER_SHADOW = { center: [0, 2.4, 0], radius: 1.6, k: 1 };   // Clawd's cel shadow on the deck (pilot LOOKS refine it)
export function setLook(set, t) {
  if (set === 'town' || set === 'pier' || set === 'bay') { const l = mixLook(DAY, DUSK, sstep(63.0, 66.0, t)); return set === 'pier' ? { ...l, shadow: PIER_SHADOW } : l; }
  return SET_LOOKS[set] || DAY;
}

// camera for a shot at film time t (team CAMS override the placeholders)
export function camFor(shot, t, ctx) {
  const lt = t - shot.t0, d = shot.t1 - shot.t0, st = { shot, k: lt / d, ctx };
  const team = TEAM_CAMS[shot.owner]?.CAMS?.[shot.id];
  return (team || DEFAULT_CAMS[shot.id] || DEFAULT_CAMS.s01)(lt, d, t, st);
}
export function lookFor(shot, t, ctx) {
  const lt = t - shot.t0, d = shot.t1 - shot.t0, st = { shot, k: lt / d, ctx };
  const team = TEAM_CAMS[shot.owner]?.LOOKS?.[shot.id];
  return { set: setLook(shot.set, t), shot: team ? team(lt, d, t, st) : null };
}
export { curve };
