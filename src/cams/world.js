// MEGA CLAWD · cameras + looks for the world department (owner: world). Shots: s01 s02 s05 s07 s14 s22 s30 s33.
//   export const CAMS  = { sXX: (lt, d, t, st) => ({ pos, look, fov, roll?, near?, far? }) }   camera on ones (raw t)
//   export const LOOKS = { sXX: (lt, d, t, st) => ({ ...partial LOOK }) }                    see BASE_LOOK (src/pipeline.js)
// st = { shot, k, ctx }: cameras read ctx.modules.world / mecha / meteor anchors (with fallbacks when a module is absent).
import { lerp, ease } from '../pipeline-util.js';

const L3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
// Catmull-Rom through evenly spaced samples (u = sample index, clamped)
function spline(S, u) { const n = S.length - 1, x = Math.min(n, Math.max(0, u)), i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(n, i + 2)];
  return p1.map((_, j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * f * f * f)); }
// fallback s22 flight path relative to meteor.STRATO.core, every 1/3 s from 48.0 s (a sample of mecha.anchor('center'))
const S22_PATH = [[-459, -519, 343], [-408, -649, 360], [-349, -750, 365], [-278, -790, 346], [-197, -740, 295], [-110, -566, 206], [-40, -330, 100]];
// engine draft: a smoothed fit of the giant's actual s22 centre (probed 2026-11-05, every 0.25 s from 48.0 s, rel. core)
const S22_FIT = [[-457, -448, 320], [-400, -580, 300], [-274, -726, 160], [-172, -821, 10], [-128, -831, 4], [-84, -787, 2], [-50, -675, 0], [-60, -460, 40], [-58, -175, 35]];
const catAt = (st) => st.ctx.modules.world?.anchor('cat')?.toArray() ?? [-38.1, 6.4, -55];

export const CAMS = {
  // wide establishing over the bay toward the town on its green hills; slow push in (ease in/out on ones)
  s01: (lt, d) => { const k = ease(lt / d); return { pos: L3([152, 34, 196], [128, 30.5, 152], k), look: L3([-60, 96, -320], [-62, 93, -320], k), fov: 38 }; },
  // a cat's-eye view at tile level along the pent roof: the kawara courses + the sleeping cat (face 3/4 to us) fill the
  // lower third, the laundry on the window pole mid-frame, the furin ringing under the eave (upper right), the headland,
  // the sea and the cumulus on the left (the eave line hides most of the road); a slow drift toward the cat
  s02: (lt, d, t, st) => { const c = catAt(st), k = ease(lt / d);
    return { pos: L3([c[0] + 1.38, c[1] + 0.27, c[2] - 0.1], [c[0] + 1.18, c[1] + 0.25, c[2] - 0.1], k), look: L3([c[0] - 2.5, c[1] + 0.92, c[2] + 0.6], [c[0] - 2.5, c[1] + 0.88, c[2] + 0.58], k), fov: 56, near: 0.02 }; },
  // sky set: looking up at the row of towering cumulus (tilted up past the sea band); the tiny streak appears high above
  // them and travels down-left
  s05: (lt, d) => { const k = ease(lt / d); return { pos: L3([-7200, 520, -2400], [-7150, 540, -2350], k), look: L3([2600, 9650, 9500], [2600, 9850, 9500], k), fov: 60 }; },
  // from the quay road under the cat's house, looking up at the row of gulls perched across the telecom cable (the furin
  // and the laundry in the right foreground, the towers rising behind the roofs); one point of the sky glows orange (upper
  // left) and falls, the gulls burst off seaward over the camera, the furin stops; a slight tilt up follows them
  s07: (lt, d) => { const k = ease(lt / d); return { pos: L3([-36.8, 5.4, -48.4], [-36.75, 5.38, -48.3], k), look: L3([-45, 12.4, -55], [-45, 13.1, -55], k), fov: 46, near: 0.05 }; },
  // from above the cat's house: the quay wires, the pier + the moored boats rolling on the surge (foreground), the bay
  // bulging and boiling (far centre), the glitter path, the towers over the sea
  s14: (lt, d) => { const k = ease(lt / d); return { pos: L3([-38, 19, -64], [-37.6, 18.8, -63.2], k), look: L3([55, -14, 190], [55, -13.4, 190], k), fov: 40 }; },
  // stratosphere, dutch angle: the camera rides alongside the giant's climb (live mecha anchor, so it stays framed whatever the choreography; the
  // spline is the fallback when the mecha module is absent), 3/4 front view of the visor, looking up past it at the
  // incoming rock (upper right) with the Earth's limb in the lower left; the offset widens as the two converge
  s22: (lt, d, t, st) => { const c = st.ctx.modules.meteor?.STRATO?.core?.toArray?.() ?? [0, 35700, -210], k = ease(lt / d), mod = st.ctx.modules;
    const P = (v) => [c[0] + v[0], c[1] + v[1], c[2] + v[2]];
    const p = mod.mecha?.anchor?.('center')?.toArray?.() ?? P(spline(S22_PATH, (t - 48.0) / 0.3267));
    const m = mod.meteor?.anchor?.('core')?.toArray?.() ?? P([0, 1034 - 344 * (t - 48), -310 + 103 * (t - 48)]);
    // engine (director, draft): an authored side rail on ones (same side as s23) instead of following the on-twos mecha
    // anchor: the limb low in frame, the meteor upper right, the giant lower left, both converging; slow push in.
    // The aim point is a smooth guess of the giant's line (never the raw anchor, so no pop at f1162).
    // fix round: the giant was a speck at 2 km. Now ~500 m off its smoothed line: opens on the limb with the rock's edge
    // upper right, then cranes down + tilts up so the rock's face comes in over the giant (~240 px tall, lower frame).
    void p; void m; const g = P(spline(S22_FIT, (t - 48.0) / 0.25)), kk = ease(Math.min(1, Math.max(0, (t - 48.0) / 1.2))), D = lerp(560, 430, k);
    const s = [0.2, 0, 0.98], R = [s[2], 0, -s[0]], h = lerp(-30, -360, kk), U = D * lerp(0.23, 0.84, kk) + h * 0.5 * kk;
    return { pos: [g[0] + s[0] * D, g[1] + h, g[2] + s[2] * D], look: [g[0] + R[0] * D * 0.1, g[1] + U, g[2] + R[2] * D * 0.1], fov: lerp(52, 64, kk), roll: lerp(8, 4, k), far: 2e6 }; },
  // dusk: low behind the cat sitting at the eave edge (lower right, head tilted up) with the pent-roof tiles and their
  // round eave caps under it, the bay, the sun path and the shooting stars over the cumulus; the camera tilts up with the
  // cat's gaze
  s30: (lt, d, t, st) => { const c = st.ctx.modules.world?.anchor('catSit')?.toArray() ?? [-38.2, 6.31, -54.65], k = ease(lt / d);
    return { pos: L3([c[0] + 0.85, c[1] + 0.42, c[2] - 0.65], [c[0] + 0.8, c[1] + 0.43, c[2] - 0.64], k), look: L3([c[0] - 0.9, c[1] + 0.15, c[2] + 10.65], [c[0] - 1.0, c[1] + 0.95, c[2] + 10.65], k), fov: 56, near: 0.02 }; },
  // from the quay above the seawall: the ring wave (a real face + crest) rolls in, lifting the boats and running under the
  // pier, slams the wall (the burst races along it toward the camera), white water spreads back out to sea; Mega Clawd
  // (visor in frame) + the settling plume beyond
  s33: (lt, d) => { const k = ease(lt / d), hit = 0.8, shake = lt > hit ? 0.08 * Math.sin(lt * 53) * Math.exp(-(lt - hit) * 2.4) : 0;
    return { pos: L3([-50, 9.5, -48], [-48.8, 9.3, -47.6], k).map((v, i) => v + (i === 1 ? shake : 0)), look: L3([2, 6, 40], [2, 6.8, 38], k), fov: 52 }; },
};

const DAYHAZE = { color: 0xc4dcff, density: 0.00012, h0: 0, falloff: 0.0012, max: 0.42, sunScatter: 0.25, sky: 0.22 };
// the engine's DUSK set look (src/cams/index.js) with a thinner haze so the cumulus keep their lavender / gold modelling
const DUSK = { sun: { dir: [0.15, 0.1, 0.98], color: 0xffb27a, k: 1.0 }, amb: { sky: 0x9a8ee0, ground: 0x8e6a72, k: 0.9 }, rim: { color: 0xffc89a, k: 1.2 },
  hero: { color: 0xffd6b0, k: 1.0 }, haze: { color: 0xf0b8a8, density: 0.00012, h0: 0, falloff: 0.001, max: 0.35, sunScatter: 0.8, sky: 0.4 },
  grade: { hiTint: 0xfff0e0, shTint: 0xe8e4ff, sat: 1.18 } };
export const LOOKS = {
  // (a little more aerial haze than the day sets: the rows of houses climbing the slope step back into it)
  s01: () => ({ haze: { ...DAYHAZE, density: 0.00017, max: 0.48 }, grade: { sat: 1.14, contrast: 1.05 } }),
  s02: (lt, d, t, st) => ({ shadow: { center: catAt(st), radius: 5, k: 1, bias: 0.0006 }, haze: { ...DAYHAZE, density: 0.00016 }, grade: { sat: 1.12 } }),
  // s05 is a pure sky shot: the sun swings behind the camera's left so the massif shows its sculpted lit side
  s05: () => ({ sun: { dir: [0.33, 0.6, -0.7] }, haze: { color: 0xd0e4ff, density: 0.00004, h0: 1500, falloff: 0.0003, max: 0.35, sunScatter: 0.3, sky: 0.15 }, grade: { sat: 1.12, contrast: 1.05 } }),
  s07: () => ({ shadow: { center: [-44, 9.5, -54], radius: 12, k: 1, bias: 0.0008 }, haze: DAYHAZE, grade: { sat: 1.12 } }),
  s14: () => ({ haze: { ...DAYHAZE, max: 0.3 }, grade: { sat: 1.12, contrast: 1.05 } }),
  s22: () => ({ haze: { color: 0xa8c4ff, density: 0.000006, h0: 30000, falloff: 0.0001, max: 0.25, sunScatter: 0.2, sky: 0.3 }, grade: { sat: 1.16, contrast: 1.06, expo: 1.14 } }),
  // s30 is fully dusk from its first frame (the engine's coast blend runs to 66 s; the sky / sea / cat switch by 64 s)
  s30: (lt, d, t, st) => ({ ...DUSK, shadow: { center: st.ctx.modules.world?.anchor('catSit')?.toArray() ?? [-38.2, 6.31, -54.65], radius: 2, k: 1, bias: 0.0006 } }),
  s33: () => ({ ...DUSK, mist: { k: 0.35, height: 8, color: 0xffd8c8 } }),
};
