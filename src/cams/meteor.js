// MEGA CLAWD · cameras + looks for the meteor department (owner: meteor). Shots: s06 s17 s23 s29.
//   s06  space: high over the planet, looking down 21 deg so the limb (cloud swirls, terminator, bright rim) fills the
//        lower third; the rock dives from the upper left toward the limb and the sheath ignites as it reaches the glow
//   s17  sky: low in front of the world's cumulus massif; the burning meteor comes over the top of the massif, punches
//        through it (the walls part: sky.setSplit, synced in meteor.js) and grows to ~40 % of the frame toward the camera
//   s23  strato: near silence. Wide side profile, the Earth's curve low in frame: Mega Clawd's silhouette lower left with
//        its arms up, the meteor's dark underside upper right with a hot rim and a white leading edge, the sky gap between
//        them closing (camera tracks the giant on ones). The impact flash ramps in over the last 3 frames.
//   s29  strato: low 3/4 side view of the arms pushed up into the cracked rock (blue lightning), the burst (2 impact
//        frames), then a crane up + pull back until the fragment fan spreads over the Earth's curve and the cloud deck
// lt = seconds into the shot, d = shot length, t = film time, st = { shot, k, ctx }. Camera on ones (raw t).
import * as THREE from 'three';
import { ease, easeOut, easeIO, sstep, clamp } from '../pipeline-util.js';
import { flashEnv } from '../fx-energy-draw.js';
import { CUES } from '../shots.js';

const V3 = THREE.Vector3;
const arr = (v) => [v.x, v.y, v.z];
// s23: analytic (on ones) frame that follows Mega Clawd's body while the meteor closes in. Contact point at the catch
// C_imp = STRATO.core - up * contact.d * RADIUS; the meteor falls at 360 m/s along -up, the mecha's gap shrinks 260 -> 6 m,
// so the body centre drifts from +100 m to -6 m along up (minus ~60 m from the hands to the body centre)
function gapFrame(st, t) {
  const m = st.ctx.modules.meteor, U = m?.STRATO?.up?.clone() ?? new V3(0, 0.958, -0.287);
  const Cimp = m?.STRATO ? m.STRATO.core.clone().addScaledVector(U, -m.rock.contact.d * m.RADIUS) : new V3(0, 35140, 0);
  const k = clamp(t - 50, 0, 1), G = Cimp.addScaledVector(U, 360 * (1 - k) - (260 - 254 * k) - 60);
  const R = new V3(1, 0, 0), F = new V3().crossVectors(R, U).normalize();
  return { G, U, R, F };
}
// small camera shake (pure): decaying jitter after t0
const shake = (t, t0, amp, dur = 1.2) => { if (t < t0) return [0, 0]; const k = Math.exp(-(t - t0) * 3 / dur) * amp, f = Math.round(t * 24);
  return [Math.sin(f * 2.31) * k, Math.cos(f * 1.73 + 1) * k]; };

export const CAMS = {
  s06: (lt, d, t, st) => {
    const c = st.ctx.modules.meteor?.SPACE_CAM?.(t) ?? { pos: new V3(0, 121000, 0), look: new V3(0, 120640, -934) };
    return { pos: arr(c.pos), look: arr(c.look), fov: 40, roll: -4 + 1.5 * (lt / d), near: 5, far: 2e6 };
  },
  s17: (lt, d, t, st) => {   // low, in front of the world's cumulus massif, looking up at its top; slow push in
    const M = st.ctx.modules.sky?.MASSIF ?? { x: 3200, z: 9500, base: 1400, h: 8600 }, e = ease(lt / d);
    const pos = new V3(M.x + 900 - 150 * e, 2200 + 120 * e, M.z - 17800 + 700 * e);
    const m = st.ctx.modules.meteor?.pathAt(t).pos ?? new V3(M.x, M.base + M.h, M.z);
    const look = new V3(M.x + 200, M.base + M.h * 0.7, M.z - 3000).lerp(m, 0.3 + 0.12 * e);
    return { pos: arr(pos), look: arr(look), fov: 42, roll: -3 + 1.5 * e, near: 10, far: 120000 };
  },
  s23: (lt, d, t, st) => {   // wide side profile: giant lower left, the meteor's underside upper right, the Earth low
    const { G, U, R } = gapFrame(st, t), e = ease(lt / d), Z = new V3(0, 0, -1);
    const look = G.clone().addScaledVector(U, 235).addScaledVector(Z, 330);
    const pos = G.clone().addScaledVector(R, 1700 - 60 * e).addScaledVector(U, 225).addScaledVector(Z, 300);
    return { pos: arr(pos), look: arr(look), fov: 38, roll: 14 + 1.5 * e, near: 5, far: 2e6 };
  },
  s29: (lt, d, t, st) => {   // low 3/4 side view of the push, the burst, then crane up + pull back over the Earth
    const m = st.ctx.modules.meteor, U = m?.STRATO?.up?.clone() ?? new V3(0, 0.958, -0.287), R = new V3(1, 0, 0), F = new V3().crossVectors(R, U).normalize();
    const core = m?.anchor('core') ?? new V3(0, 35835, -251), body = core.clone().addScaledVector(U, -((m?.rock?.contact?.d ?? 0.75) * (m?.RADIUS ?? 600) + 75));
    const tb = Math.max(0, t - CUES.shatter - 0.04), k = easeIO(clamp(tb / 2.3)), kp = easeOut(clamp(tb / 2.3));
    const [jx, jy] = shake(t, CUES.shatter, 9, 0.8);
    const H = new V3(R.x * 0.82, 0, F.z * 0.57).normalize();   // horizontal pull-back direction (3/4 side)
    const p0 = body.clone().addScaledVector(R, 560).addScaledVector(F, 200).addScaledVector(U, 40);
    const p1 = core.clone().addScaledVector(H, 3600).add(new V3(0, -300, 0));
    const pos = p0.clone().lerp(p1, kp);
    const l0 = body.clone().addScaledVector(U, 200), l1 = p1.clone().addScaledVector(H, -5000).add(new V3(0, -160, 0));
    const look = l0.clone().lerp(l1, k).addScaledVector(R, jx).addScaledVector(F, jy);
    return { pos: arr(pos), look: arr(look), fov: 54 + 4 * k, roll: -7 + 6 * k + jx * 0.06, near: 5, far: 2e6 };
  },
};

export const LOOKS = {
  s06: (lt, d, t) => ({
    sun: { dir: [0.86, 0.3, -0.4], color: 0xfff2e2, k: 1.25 }, amb: { sky: 0x6a6cb8, ground: 0x4a4a88, k: 0.95 },
    rim: { dir: [-0.6, 0.5, 0.6], color: 0x9ab8ff, k: 0.6 },
    haze: { density: 0, sky: 0, max: 0 }, mist: { k: 0 },
    bloom: { strength: 0.5, radius: 0.55, threshold: 1.1 }, ink: { width: 2.4 },
    grade: { contrast: 1.1, sat: 1.18, vignette: 0.22, lift: 0x02030c, halation: 0.18 } }),
  s17: (lt, d, t) => ({
    sun: { dir: [0.5, 0.55, -0.67], color: 0xfff8ee, k: 1.05 }, amb: { sky: 0xb8c4ff, ground: 0xe4dcf0, k: 1.0 },
    rim: { dir: [0.2, 0.6, 0.8], color: 0xffb080, k: 0.8 },
    haze: { color: 0xc8dcff, density: 0.000028, h0: 1500, falloff: 0.00022, max: 0.45, sunScatter: 0.2, sky: 0.12 },
    bloom: { strength: 0.55, radius: 0.6, threshold: 1.1 }, ink: { width: 2.2 },
    grade: { sat: 1.16, contrast: 1.07, halation: 0.18, vignette: 0.16 } }),
  s23: (lt, d, t) => {
    // the sun behind the pair (their shadow sides face the camera): two dark silhouettes, an orange heat rim on top
    const fl = flashEnv(t, CUES.impact, { peak: 1, pre: 3, up: 2, hold: 2, down: 9 });
    return { sun: { dir: [-0.78, 0.42, 0.46], color: 0xfff0dc, k: 1.05 },
      amb: { sky: 0x5a66b8, ground: 0x2c3470, k: 0.62 }, rim: { dir: [0, 0.958, -0.287], color: 0xff9448, k: 2.0 },
      bloom: { strength: 0.5 + 0.4 * fl, radius: 0.55, threshold: 1.1 }, ink: { width: 2.6 },
      grade: { sat: 1.18, contrast: 1.1, vignette: 0.2, halation: 0.18, lift: 0x04041a, expo: 1 + 1.8 * fl, flash: 0.4 * fl, flashCol: 0xfff6e8 } };
  },
  s29: (lt, d, t) => {
    // f(shatter) and the next frame are impact frames (flat white + silhouettes, drawn by meteor.js): neutral grade there
    const fi = Math.round(t * 24) - Math.round(CUES.shatter * 24);
    if (fi === 0 || fi === 1) return { bloom: { strength: 0.15, threshold: 1.5 }, grade: { expo: 1, flash: 0, vignette: 0, halation: 0, contrast: 1.05, sat: 1.1, grain: 0.01 } };
    const pre = fi < 0 ? 1 : 0, post = fi > 1 ? Math.max(0, 1 - (fi - 2) / 8) : 0;
    return { sun: { dir: [0.4, 0.5, 0.75], color: 0xffffff, k: 1.0 }, amb: { sky: 0x7088d8, ground: 0x8a94c4, k: 0.75 },
      bloom: { strength: 0.4, radius: 0.5, threshold: 1.25 }, ink: { width: 2.2 },
      grade: { sat: 1.2, contrast: 1.08, halation: 0.12, vignette: 0.18, expo: 1.0 + 0.35 * pre + 0.2 * post - 0.1 * sstep(62.6, 64, t), flash: 0.1 * pre, flashCol: 0xe8f4ff } };
  },
};
