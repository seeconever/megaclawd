// MEGA CLAWD · cameras + looks for the water department (owner: water). Shots: s10 s32.
// lt = seconds into the shot, d = shot length, t = film time, st = { shot, k, ctx }. Camera on ones (raw t).
//   UNDER_LOOK(t, ctx)  the underwater look (fog pass + god rays + light rig) for every 'under' shot; mecha s11/s13 can use it:
//                       LOOKS.s11 = (lt, d, t, st) => ({ ...UNDER_LOOK(t, st.ctx), ...yourOverrides })
// Tuning hooks (URL): s10 ?w1=x,y,z (camera offset from Clawd at the end) ?wf=fovA,fovB ; s32 ?p0= ?l0= ?fov=
import { ease, lerp } from '../pipeline-util.js';

export const UNDER_LOOK = (t, ctx, extra) => ctx.modules.under?.look?.(extra) ?? {};
const MECHA_BED = [0, -62, 250];
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const add3 = (a, b) => a.map((v, i) => v + b[i]);
const sub3 = (a, b) => a.map((v, i) => v - b[i]);
const nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const SUN_UNDER = nrm([0.12, 1, 0.3]);
const kp = (q, n, def) => q?.has(n) ? q.get(n).split(',').map(Number) : def;

// s10. Phase A (k < 0.42): the camera hangs just under the pier end, below the plunge, looking up the light: the sun's
// Snell window, the hard god rays fanning down, the deck silhouette and the churn; Clawd drops head-first through the
// frame (the aim lags behind him) while the surface recedes as the camera sinks. Phase B: he rights himself and swims
// out over the drop-off; the camera swings in behind and a little above him and tilts down past him (the lens lengthens
// 54 -> 24 deg) onto the abyss, where the colossal shape lies (revealed from ~55 %). End: Clawd ~1/10 of the frame height
// in the upper third, the giant filling the frame width below him, its far end dissolving into the depth haze.
function s10Rig(lt, d, t, st) {
  const k = lt / d, ctx = st.ctx, U = ctx.modules.under, q = ctx.q;
  const C = (tt) => U?.clawdPath ? U.clawdPath(tt) : [-0.8, -2 - (tt - 19.5) * 1.5, 1.5 + (tt - 19.5) * 3.5];
  const c = C(t);
  const giant = ctx.modules.mecha?.anchor?.('center')?.toArray?.() ?? MECHA_BED;
  // phase A rig: just past the pier end, low over the shelf, looking up; the aim lags behind his plunge (blended toward the
  // sun at the start so the window + its rays sit behind him)
  const kA = clamp01(k / 0.42);
  const pA = kp(q, 'w0', [-0.25, -5.3, 0.55]).map((v, i) => v + [0, 0.5, 0.45][i] * ease(kA));
  const lag = C(t - 0.12), dirA = nrm(mix3(nrm(sub3(add3(lag, [0, 0.25, 0]), pA)), SUN_UNDER, 0.3 * (1 - ease(kA))));
  // phase B rig: behind + above Clawd, aimed between him and the giant (he sits in the upper third)
  const off = kp(q, 'w1', [0.3, 1.45, -9.5]);
  const pB = add3(c, off);
  const dc = nrm(sub3(c, pB)), dg = nrm(sub3(giant, pB));
  const dirB = nrm(mix3(dg, dc, 0.36));
  // blend: the swing (k 0.36 -> 0.72), position eased, aim interpolated by angle
  const kb = sstep(0.36, 0.74, k);
  const pos = mix3(pA, pB, ease(kb));
  pos[2] = Math.max(pos[2], 0.8); pos[1] = Math.max(pos[1], -5.0);   // never back under the pier deck, never down on the shelf sand
  // ease the aim through a mid direction: as he passes overhead the camera follows him (dirClawd) before tilting to the abyss
  const dMid = nrm(sub3(c, pos));
  const dir = kb < 0.5 ? nrm(mix3(dirA, dMid, kb * 2)) : nrm(mix3(dMid, dirB, (kb - 0.5) * 2));
  const fv = kp(q, 'wf', [58, 26]);
  const fov = lerp(fv[0], fv[1], sstep(0.38, 0.9, k));
  return { pos, look: add3(pos, dir.map(v => v * 10)), fov, near: 0.05, c };
}

export const CAMS = {
  s10: (lt, d, t, st) => { const r = s10Rig(lt, d, t, st); return { pos: r.pos, look: r.look, fov: r.fov, near: r.near }; },
};

// s32: a 3/4 view from high over the left headland. The giant falls back-first, so its soles point at every camera near
// the pier; from up here its face (visor eyes), the outstretched arms and the smoke trails read. The aim rides the fall
// down to the hit point (on ones), holds through the impact (shake from the hit frame), then tilts up with the column
// while the long lens (38 deg) lets the plume blow out of the top of the frame by mid-shot. The surge ring then rolls
// toward the camera across the lower frame, the headland holds the left edge for scale.
const S32 = { p0: [-236, 118, -106], p1: [-222, 112, -90], site: [0, 0, 235], fov: 40 };
CAMS.s32 = (lt, d, t, st) => {
  const k = lt / d, q = st.ctx.q;
  const T0 = st.ctx.modules.water?.splashdownT?.() ?? 69.33;
  const pos = mix3(kp(q, 'p0', S32.p0), kp(q, 'p1', S32.p1), ease(k));
  // aim height: on the falling body (a little below its centre, so the smoke trails above it stay in frame), down to
  // the hit, then up with the rising column
  const a = t - T0;
  const yFall = lerp(160, 34, sstep(T0 - 0.36, T0 + 0.02, t));
  const yRise = lerp(34, 112, sstep(T0 + 0.12, T0 + 1.5, t));
  const y = a < 0.02 ? yFall : yRise;
  const look = kp(q, 'l0', null) ? mix3(kp(q, 'l0'), kp(q, 'l1', kp(q, 'l0')), ease(k)) : [S32.site[0] + 14, y, S32.site[2]];
  // impact shake from the hit frame: a hard first jolt, then a decaying rattle (on ones)
  const sh = a >= 0 ? Math.exp(-a * 3.2) * (a < 0.09 ? 2.2 : 1.2) : 0;
  const shake = [Math.sin(t * 61) * sh, Math.sin(t * 47 + 1.3) * sh * 0.8 + (a >= 0 && a < 0.05 ? -1.6 : 0), 0];
  return { pos, look: add3(look, shake), fov: kp(q, 'fov', [S32.fov])[0], roll: Math.sin(t * 37) * sh * 0.25, near: 0.5 };
};

export const LOOKS = {
  // the hero key follows the camera (anime character light): Clawd's visible side is always lit, keeping his terracotta hue
  s10: (lt, d, t, st) => { const r = s10Rig(lt, d, t, st), s = st.ctx.modules.under?.clawdSink?.(t), k = lt / d;
    const dir = s ? nrm(add3(nrm(r.pos.map((v, i) => v - s.pos[i])), [0.15, 0.45, 0.1])) : [0.2, 1, 0.45];
    // the water clears toward the end (distance curve: the middle ground stays readable, the far bay dissolves) so the
    // giant reads as a dark silhouette 240 m out with its far end melting into the haze
    const kr = sstep(0.45, 0.85, k);
    return UNDER_LOOK(t, st.ctx, { underwater: { density: lerp(0.0028, 0.0004, kr), den2: lerp(0, 0.0000085, kr), abs: lerp(0.7, 0.66, kr), deep: 0x137fbc, shallow: 0x74dcec, grad: 1.9, rayK: lerp(0.45, 0.6, kr) },
      // warm key + near-neutral fill: the cyan water would push his terracotta past hue 18 (gate 13-18)
      hero: { dir, color: 0xffe2d0, k: 0.92 }, amb: { sky: 0xc8d2dc, ground: 0xa2a8b2, k: 0.78 },
      grade: { tint: 0xffffff, sat: 1.1, shTint: 0xf2f6ff, hiTint: 0xfffaf2, vignette: 0.18, halation: 0.05, expo: lerp(0.76, 0.9, sstep(0.22, 0.5, k)) },
      bloom: { strength: 0.32, radius: 0.5, threshold: 1.15 } }); },
  // s32: a warm sunset rim + a lifted ambient on the falling giant (its terracotta and the visor eyes read against the dusk
  // sky). The hit accent is the drawn impact frame in fx-water (a cream-white radial burst on ones), not a grey grade wash.
  s32: () => ({ bloom: { strength: 0.45, radius: 0.55, threshold: 1.1 }, rim: { dir: [0.55, 0.55, 0.62], color: 0xffb27a, k: 2.0 },
    amb: { k: 1.3 }, grade: { vignette: 0.2 } }),
};
