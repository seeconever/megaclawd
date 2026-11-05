// MEGA CLAWD · cameras + looks for the mecha department (owner: mecha). Shots: s11 s13 s15 s16 s19 s20 s21 s24 s25 s27 s28 s31 s34.
//   CAMS[id](lt, d, t, st) -> { pos, look, fov, roll?, near? }     LOOKS[id](lt, d, t, st) -> partial LOOK
// Cameras run on ones (raw t). Tracking shots lock onto the analytic flight paths (PATH in src/mecha.js) or the meteor
// contact point (anchor 'catch', on ones), never onto the on-twos drawings, so the giant does not strobe against the BG.
// Scale rule: big = low and slow; macro shots fill the frame with one part (visor, reactor), wides keep the town / Earth.
import { lerp, ease, sstep, clamp, hash, easeIO, easeIn, easeOut } from '../pipeline-util.js';
import { PATH, SITE } from '../mecha.js';

const add = (...vs) => vs.reduce((a, b) => a.map((x, i) => x + b[i]));
const mul = (v, k) => v.map(x => x * k);
const mix = (a, b, k) => a.map((x, i) => lerp(x, b[i], k));
const arr = (v) => [v.x, v.y, v.z];
const mech = (st) => st.ctx.modules.mecha;
const ON = (t) => Math.floor(t * 24 + 1e-6);
// camera shake on ones: amplitude in metres, decorrelated per axis
const shake = (t, amp, seed = 0) => [0, 1, 2].map(i => (hash(ON(t) * 1.7 + seed + i * 31.1) - 0.5) * 2 * amp);
// strato frame of the catch (meteor -> mecha approach direction is (0, -1, 0.3)): up toward the meteor, fwd = the face side
const UP = [0, 0.958, -0.287], FWD = [0, 0.287, 0.958], RIGHT = [1, 0, 0];
const rel = (C, r, u, f) => add(C, mul(RIGHT, r), mul(UP, u), mul(FWD, f));
const catchPt = (st) => { const m = mech(st); const c = m?.anchor('catch'); return c && Number.isFinite(c.x) && c.lengthSq() > 1 ? arr(c) : [0, 35200, -60]; };
const bodyFrame = (st) => mech(st)?.frame?.();
const C28 = [0, 35360.8, -108.2];

export const CAMS = {
  // CU visor on the bay floor: drift in toward the sleeping face, eyes light up
  s11: (lt, d, t, st) => { const f = bodyFrame(st); if (!f) return { pos: [30, -30, 160], look: [0, -40, 250], fov: 40 };
    const v = arr(mech(st).anchor('visor')), k = ease(lt / d);
    const pos = add(v, mul(arr(f.fwd), lerp(74, 64, k)), mul(arr(f.right), lerp(-20, -15, k)), mul(arr(f.up), lerp(-40, -35, k)));
    return { pos, look: add(v, mul(arr(f.up), 6), mul(arr(f.right), -2)), fov: 50 }; },
  // macro: the chest reactor ignites, the petals shift; a jolt at the ignition. Low beside the silt, the visor glow above
  s13: (lt, d, t, st) => { const f = bodyFrame(st); if (!f) return { pos: [10, -50, 180], look: [0, -60, 220], fov: 38 };
    const r = arr(mech(st).anchor('reactor')), k = ease(lt / d), j = t > 27.3 ? shake(t, 0.35 * Math.exp(-(t - 27.3) * 3), 5) : [0, 0, 0];
    const pos = add(r, mul(arr(f.fwd), lerp(40, 35, k)), mul(arr(f.right), lerp(16, 13, k)), mul(arr(f.up), lerp(-27, -24, k)), j);
    return { pos, look: add(r, mul(arr(f.up), 7), mul(arr(f.right), 1)), fov: 40 }; },
  // the rise: low over the bay beside the pier, open sea + cumulus behind; the camera tilts up with the head
  s15: (lt, d, t) => { const k = lt / d;
    return { pos: mix([-96, 6.5, 52], [-90, 7.5, 60], ease(k)), look: [8, lerp(12, 40, easeIO(clamp(k * 1.25, 0, 1))), 225], fov: 40 }; },
  // low angle from the pier past the trembling cup on the bollard, longer lens: the horizon sits low in the frame, the giant
  // fills the upper ~75 %, the sun is cheated just above the top edge behind its shoulder (rim + shafts, LOOKS.s16)
  s16: (lt, d, t, st) => { const cw = st.ctx.modules.pilot?.cupWorld?.(t); const cup = cw?.pos ? arr(cw.pos) : [1.25, 2.62, -0.4];
    const tr = shake(t, 0.003 + 0.005 * sstep(37.1, 37.3, t) * Math.exp(-Math.max(0, t - 37.3) * 2.5), 3);
    const pos = add(cup, [0.3, -0.1, -1.35], tr);
    return { pos, look: add(pos, [-0.04, lerp(0.26, 0.275, ease(lt / d)), 1]), fov: 40, near: 0.03 }; },
  // crouch in the surf, arms unfold, thrusters flare (from the sea side, 3/4). Locked-off (slow push only): the 9 m drop
  // and the hold read against a still frame; high enough to see the glow + foam ring on the water under the feet
  s19: (lt, d, t) => { const k = ease(lt / d), j = shake(t, 0.25 * sstep(42.9, 43.4, t), 9);
    return { pos: add(mix([-112, 30, 448], [-104, 29, 438], k), j), look: [6, 36, 225], fov: 40 }; },
  // LAUNCH: wide, a little higher so the shock ring reads as a ring on the bay; the giant leaves the frame top
  s20: (lt, d, t, st) => { const y = PATH.launchY(t, st.ctx.cues.launch), j = shake(t, 1.6 * Math.exp(-Math.max(0, t - 43.6) * 2.2) * (t > 43.6 ? 1 : 0), 13);
    return { pos: add([300 - 5 * lt, 82 + 0.6 * lt, 930 - 9 * lt], j), look: [20, lerp(34, Math.min(y + 10, 300), easeIn(clamp((t - 43.68) / 1.3, 0, 1))), 225], fov: 44 }; },
  // tracking alongside the climb up the cloud-free column (PATH.s21): wide and a little below, so the soles and the long
  // trails are in frame; drawn wisps stream down past the lens (mecha-fx)
  s21: (lt, d, t) => { const c = arr(PATH.s21(t)), f = lt / d;
    return { pos: add(c, [-230 + 20 * f, -110 + 20 * f, 250 - 20 * f]), look: add(c, [0, -22, 0]), fov: 50, roll: lerp(-3, 3, f) }; },
  // the catch shots: long lens from ~680 m out to the side, just below the contact plane, so the hands meet the rock right
  // on its lower silhouette (the fingers dug into the edge read in profile against the sky) and the giant is ~40 % of the
  // frame height. C = the contact point (anchor 'catch', on ones).
  // IMPACT: from the right, the flash + the shockwave
  s24: (lt, d, t, st) => { const C = catchPt(st), j = shake(t, 7 * Math.exp(-Math.max(0, t - 51.0) * 2.4), 17), k = lt / d;
    // fix round: front-right (~18 deg) instead of the side, so both clamp hands read on the rock's face
    return { pos: add(rel(C, lerp(190, 180, k), -80, lerp(590, 570, k)), j), look: rel(C, 0, -44, 0), fov: 25 }; },
  // strain: CLOSE on the left hand in profile, just under the rock line: the fingers driven into the rock edge, crumbs,
  // dust, the red-hot forearm; the giant's head (visor, buckling top edge) fills the lower right. The hand rests at
  // body-local x -76 (rel RIGHT -76 from C); the camera tracks C (on ones), never the on-twos hand.
  s25: (lt, d, t, st) => { const C = catchPt(st), k = ease(lt / d), j = shake(t, 0.5, 23);
    return { pos: add(rel(C, lerp(-205, -196, k), -30, lerp(92, 86, k)), j), look: rel(C, -50, -16, 6), fov: 36 }; },
  // surge: nearly frontal (a little right), so the cyan front is seen running from the reactor out to both arms
  s27: (lt, d, t, st) => { const C = catchPt(st), k = ease(lt / d), j = shake(t, 0.6 * (1 - sstep(57, 58, t)), 29);
    return { pos: add(rel(C, lerp(150, 140, k), -70, lerp(420, 400, k)), j), look: rel(C, 0, -50, 0), fov: 32 }; },
  // the push: low 3/4 from the left, both arms + both contacts; the body drops away from the rock as the arms straighten
  // The camera is held back in world space (60 %) while the rock starts to rise, so the shove reads as rock + giant
  // going UP in frame; it catches up over the last second. C28 = the contact point at 59.0 s (meteor module, measured).
  s28: (lt, d, t, st) => { const Cl = catchPt(st), k = ease(lt / d), j = shake(t, t > 59.42 && t < 59.9 ? 2.2 : 0.7, 37);
    const lock = Math.hypot(...Cl.map((x, i) => x - C28[i])) < 600 ? 0.6 * (1 - sstep(60.4, 61.4, t)) : 0, C = mix(Cl, C28, lock);
    // fix round: front-left (~22 deg) instead of the side, so both hands on the rock read through the push
    return { pos: add(rel(C, lerp(-200, -190, k), -66, lerp(480, 465, k)), j), look: rel(C, -6, -44, 0), fov: 28 }; },
  // falling back at dusk, smoking: from the face side a little below, falling with it; the warm dusk sky + the shooting
  // stars behind it, the cloud sea's horizon low in the frame, speed lines streaming up
  s31: (lt, d, t) => { const c = arr(PATH.s31(t)), k = lt / d;
    return { pos: add(c, [lerp(160, 168, k), lerp(-38, -28, k), lerp(225, 215, k)]), look: add(c, [0, -10, 0]), fov: 46, roll: lerp(-5, -3, k) }; },
  // kneeling in the bay at dusk, steaming; push in as the visor eyes soften into a smile (high enough for the ripple rings)
  s34: (lt, d, t) => { const k = easeIO(lt / d);
    return { pos: mix([-122, 34, -10], [-108, 36, 16], k), look: mix([4, 40, 214], [6, 44, 212], k), fov: 37 }; },
};

// looks are evaluated before the modules pose the frame: everything here is analytic in t (never read last frame's state)
const mechaShadow = (c, r = 160) => ({ center: c, radius: r, k: 1 });
const SUN = [0.3, 0.62, 0.72];
// underwater shots take the water team's under look (fog pass + god rays + light rig) with our overrides merged in
const under = (st, extra) => st.ctx.modules.under?.look?.(extra) ?? extra;
// s16: the sun is cheated to peek over the giant's top edge, left of the antenna, as seen from the cup (backlit, rim + shafts)
const SUN16 = [0.123, 0.469, 0.874];
// backlit bay shots: the armour's hero key comes from the camera's upper right (mecha.js HERO_SHOTS), the sun stays a rim
const HERO15 = [-0.74, 0.61, -0.27], HERO16 = [-0.49, 0.57, -0.65], HERO34 = [-0.69, 0.68, -0.27];
// strato: a softer anime rim (the default lavender-white rim outlined the whole body in the catch shots)
const STRATO_RIM = { color: 0xfff0e0, k: 0.45 };
// s31: the low dusk sun 3/4 behind the falling giant (a warm sky glow behind it, a hot rim on its silhouette)
const SUN31 = [-0.82, 0.16, -0.55];
export const LOOKS = {
  s11: (lt, d, t, st) => under(st, { underwater: { density: 0.0016 }, bloom: { strength: 0.5, threshold: 1.05 } }),
  s13: (lt, d, t, st) => under(st, { underwater: { density: 0.0018 }, bloom: { strength: 0.5, threshold: 1.05 }, grade: { halation: 0.12 } }),
  s15: (lt, d) => ({ shadow: { ...mechaShadow([0, PATH.riseY(lt / d) + 77, 225], 170), dir: HERO15 }, hero: { dir: HERO15, color: 0xfff4ea, k: 1.0 } }),
  s16: (lt, d, t, st) => ({ sun: { dir: SUN16 }, rim: { dir: SUN16, color: 0xfff1d8, k: 1.8 }, amb: { k: 1.15 }, haze: { sunScatter: 0.75 }, bloom: { strength: 0.55 },
    hero: { dir: HERO16, color: 0xfff4ea, k: 1.0 },
    shafts: { on: true, pos: add(CAMS.s16(lt, d, t, st).pos, mul(SUN16, 6000)), k: 0.6, thr: 0.8, occ: 1, radius: 0.6, tint: 0xfff2dc }, grade: { halation: 0.2 } }),
  s19: () => ({ shadow: mechaShadow([0, 62, 225], 170), bloom: { strength: 0.55 } }),
  s20: (lt, d, t, st) => ({ shadow: mechaShadow([0, PATH.launchY(t, st.ctx.cues.launch) + 72, 225], 200), bloom: { strength: 0.6 } }),
  s21: () => ({ bloom: { strength: 0.6 } }),
  // impact flash: ramps over 3 frames, then clears fast so the catch reads by mid-shot
  s24: (lt, d, t) => { const k = t - 51.0, fl = k < 0 ? 0 : k < 2 / 24 ? 0.35 + 0.65 * k * 12 : Math.exp(-(k - 2 / 24) * 7);
    return { rim: STRATO_RIM, grade: { flash: 0.9 * fl, flashCol: 0xfff6e8 }, bloom: { strength: 0.55, threshold: 1.05 } }; },
  s25: (lt, d, t) => ({ rim: STRATO_RIM, grade: { tint: 0xfff0e6, halation: 0.15 }, bloom: { strength: 0.5, threshold: 1.05 } }),
  s27: () => ({ rim: { ...STRATO_RIM, k: 0.25 }, bloom: { strength: 0.55, threshold: 1.05 }, grade: { halation: 0.12 } }),
  s28: () => ({ rim: STRATO_RIM, bloom: { strength: 0.55, threshold: 1.05 }, grade: { halation: 0.15 } }),
  s31: () => ({ sun: { dir: SUN31, color: 0xffb27a, k: 1.0 }, amb: { sky: 0xa898e8, ground: 0xb08a90, k: 1.0 }, rim: { dir: SUN31, color: 0xffc89a, k: 1.6 },
    haze: { color: 0xf6c0a4 }, grade: { tint: 0xffeadc, hiTint: 0xfff0e0, shTint: 0xe8e4ff, sat: 1.15 } }),
  s34: () => ({ shadow: { ...mechaShadow([0, 50, 225], 170), dir: HERO34 }, hero: { dir: HERO34, color: 0xffd8bc, k: 1.0 }, rim: { dir: [0.15, 0.1, 0.98], color: 0xffc89a, k: 1.5 }, bloom: { strength: 0.6 } }),
};
