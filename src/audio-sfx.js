// MEGA CLAWD · 巨神 — sound design (owner: sound). Ambience beds locked to SHOTS (a level per shot and layer, one-frame
// crossfades at every cut, so the world changes exactly with the picture) and effects locked to CUES and to the shots'
// t0 / t1 (src/shots.js); Clawd's foley follows the acting in src/pilot.js (offsets from the shot it plays in).
// Everything is synthesized with src/audio-kit.js; insects, rain, sparkle, bubbles, debris and crackle are rendered
// sample by sample in JS (seeded), the rest are Web Audio voices.
// Every big hit has a body small speakers can play: a broadband transient (2-6 kHz), a mid layer (metal, water, plasma)
// and saturated harmonics of its sub (120-450 Hz); the subs themselves are kept modest (the world bus is high-passed at
// 32 Hz in src/audio.js).
//   sfx(K, bus, C, SHOTS, D) -> marks: [{ name, t, need }] foley events that are not CUES (checked by the analysis)
import { mtof, smooth, rng } from './audio-kit.js';
import { BEACON } from './audio-score.js';

// level of one layer at film time t: the shot's value, crossfaded over `xf` each side of a cut
export function shotLevel(SHOTS, table, key, xf = 1 / 24) {
  const val = (s, t) => { const v = table[s.id]?.[key]; return typeof v === 'function' ? v(t) : (v ?? 0); };
  return (t) => {
    let i = SHOTS.findIndex(s => t >= s.t0 && t < s.t1); if (i < 0) i = t < SHOTS[0].t0 ? 0 : SHOTS.length - 1;
    const s = SHOTS[i];
    if (i > 0 && t - s.t0 < xf) return val(SHOTS[i - 1], t) + (val(s, t) - val(SHOTS[i - 1], t)) * (0.5 + (t - s.t0) / (2 * xf));
    if (i < SHOTS.length - 1 && s.t1 - t < xf) return val(s, t) + (val(SHOTS[i + 1], t) - val(s, t)) * (0.5 - (s.t1 - t) / (2 * xf));
    return val(s, t);
  };
}

// ambience layers per shot (0..1, or a function of t for a change inside the shot) + machines (reactor hum, sole
// thrusters, meteor roar), from CUES and the shot table
export function tables(C, SH) {
  const AMB = {
    s01: { surf: 0.8, cic: 0.8, wind: 0.35 },
    s02: { surf: 0.3, cic: 0.8, wind: 0.55 },
    s03: { lap: 1.0, surf: 0.35, cic: 0.35, wind: 0.25 },
    s04: { lap: 0.6, cic: 0.25, wind: 0.12 },
    s05: { hiwind: 0.85 },
    s06: { space: 0.6 },
    s07: { surf: 0.55, cic: (t) => 0.8 * (1 - smooth((t - C.gulls + 0.08) / 0.3)), wind: 0.2, rumble: 0.35 },
    s08: { lap: 0.55, rumble: 0.6 },
    s09: { lap: 0.7, rumble: 0.75 },
    s10: { uw: 1.0 }, s11: { uw: 0.85 }, s12: { hum: 1.0, uw: 0.4 }, s13: { uw: 1.0 },
    s14: { surf: 0.7, rumble: 0.6, wind: 0.25 },
    s15: { surf: 0.4, wind: 0.4, rumble: 0.5 },
    s16: { lap: 0.5, wind: 0.3 },
    s17: { hiwind: 0.5 },
    s18: { hum: 1.0 },
    s19: { surf: 0.9, wind: 0.4 },
    s20: { surf: 0.5, wind: 0.3 },
    s21: { hiwind: 0.67 },
    s22: { strato: 1.0 },
    s23: { strato: 0.1 },
    s24: { strato: 0.5 }, s25: { strato: 0.5 }, s26: { hum: 0.8 }, s27: { strato: 0.5 }, s28: { strato: 0.5 }, s29: { strato: 0.45 },
    s30: { eve: 1.0, surf: 0.25 },
    s31: { hiwind: 0.35 },
    s32: { surf: 0.5, eve: 0.3 },
    s33: { surf: 0.55, eve: 0.5 },
    s34: { eve: 0.8, lap: 0.55 },
    s35: { eve: 0.9, lap: 0.5 },
    s36: { eve: (t) => 0.6 * (1 - smooth((t - C.card - 0.8) / 2.4)) },
  };
  const MACH = {
    s06: { roar: (t) => smooth((t - C.ignite) / 0.5) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 1.3 * t)) * 0.35 },
    s13: { reactor: (t) => 0.7 * smooth((t - C.reactor) / 0.6) },
    s14: { reactor: 0.3 }, s15: { reactor: 0.55 }, s16: { reactor: 0.65 }, s18: { reactor: 0.8 },
    s17: { roar: 0.75 },
    s19: { reactor: 0.55, thrust: (t) => smooth((t - C.launch + 0.8) / 0.6) * 0.7 * (1 - 0.6 * smooth((t - C.launch + 0.18) / 0.03)) },
    s20: { reactor: 0.3, thrust: (t) => 0.25 + 0.55 * smooth((t - C.launch) / 0.05) },
    s21: { reactor: 0.25, thrust: 0.67 },
    s22: { thrust: 0.45, roar: (t) => 0.25 + 0.35 * smooth((t - SH.s22.t0) / 2) },
    s24: { thrust: 0.3, roar: 0.2, reactor: 0.25 },
    s25: { thrust: 0.55, roar: 0.6, reactor: 0.5 },
    s26: { reactor: 0.6 },
    s27: { thrust: 0.6, roar: 0.5, reactor: 0.7 },
    s28: { thrust: 0.5, roar: 0.4, reactor: 0.65 },
    s29: { reactor: (t) => 0.7 * (1 - smooth((t - C.shatter - 0.1) / 1.8)), thrust: (t) => 0.6 * (1 - smooth((t - C.shatter - 0.1) / 1.2)) },
    s31: { reactor: 0.15 }, s34: { reactor: 0.12 },
  };
  return { AMB, MACH };
}

export function sfx(K, bus, C, SHOTS, D) {
  const { amb, sfx: fx, big, dry, quiet, pass } = bus, sr = K.sr, r = K.r;
  const SH = Object.fromEntries(SHOTS.map(s => [s.id, s])), T0 = (id) => SH[id].t0, T1 = (id) => SH[id].t1;
  const { AMB, MACH } = tables(C, SH), lvA = (k) => shotLevel(SHOTS, AMB, k), lvM = (k) => shotLevel(SHOTS, MACH, k);
  const sw = (t, p, a = 1) => 0.5 + 0.5 * Math.sin(2 * Math.PI * t / p + a);
  const marks = [], mark = (name, t, need = ['mid', 'hi']) => { marks.push({ name, t, need }); return t; };

  // ================= ambience beds (continuous, whole film; gains follow the shot table) =================
  { const L = lvA('surf'), s = K.layer(0, D, { color: 'pink', type: 'lowpass', f: 800, q: 0.5, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.13 * L(t) * (0.5 + 0.5 * sw(t, 5.3) * (0.6 + 0.4 * sw(t, 7.9, 2))));
    const foam = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 2100, q: 0.6, dst: amb });
    K.curve(foam.g.gain, 0, D, (t) => 0.035 * L(t) * Math.pow(sw(t, 5.3) * (0.6 + 0.4 * sw(t, 7.9, 2)), 3)); }
  { const L = lvA('lap'), s = K.layer(0, D, { color: 'brown', type: 'lowpass', f: 480, q: 0.7, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.16 * L(t) * (0.55 + 0.45 * sw(t + 0.4 * Math.sin(t * 2.3), 1.15))); }
  { const L = lvA('wind'), s = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 500, q: 0.7, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.07 * L(t) * (0.6 + 0.4 * sw(t, 6.1) * sw(t, 2.7, 1)));
    K.curve(s.f.frequency, 0, D, (t) => 380 + 420 * sw(t, 9.3, 0.5)); }
  { const L = lvA('hiwind'), s = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 650, q: 0.45, dst: amb, f2: 2600, type2: 'lowpass' });
    K.curve(s.g.gain, 0, D, (t) => 0.2 * L(t) * (0.7 + 0.3 * sw(t, 1.7) * sw(t, 4.1, 2)));
    K.curve(s.f.frequency, 0, D, (t) => 450 + 500 * sw(t, 3.3, 1));
    const wh = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 1200, q: 7, dst: amb });
    K.curve(wh.g.gain, 0, D, (t) => 0.06 * L(t) * sw(t, 2.9));
    K.curve(wh.f.frequency, 0, D, (t) => 900 + 600 * sw(t, 5.7, 2)); }
  { const L = lvA('space'), s = K.layer(0, D, { color: 'brown', type: 'lowpass', f: 140, q: 0.7, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.3 * L(t) * (0.6 + 0.4 * sw(t, 1.3))); }
  { const L = lvA('rumble'), s = K.layer(0, D, { color: 'brown', type: 'lowpass', f: 170, q: 0.6, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.3 * L(t) * (0.75 + 0.25 * sw(t, 2.3))); }
  { const L = lvA('uw'), s = K.layer(0, D, { color: 'brown', type: 'lowpass', f: 320, q: 0.8, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.3 * L(t) * (0.7 + 0.3 * sw(t, 3.7)));
    const pr = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 900, q: 1.5, dst: amb });
    K.curve(pr.g.gain, 0, D, (t) => 0.02 * L(t) * sw(t, 2.2)); }
  // cockpit hum (dry): dips 4 dB for 150 ms when Clawd lands in the seat
  { const L = lvA('hum'), g = K.gain(0, dry), seatDip = (t) => 1 - 0.37 * smooth((t - C.seat + 0.01) / 0.01) * (1 - smooth((t - C.seat - 0.15) / 0.1));
    K.curve(g.gain, 0, D, (t) => L(t) * seatDip(t), 400);
    K.osc('sine', 49, 0, D, K.gain(0.04, g)); K.osc('sawtooth', 98, 0, D, K.gain(0.012, K.filter('lowpass', 320, 0.7, g)));
    const air = K.layer(0, D, { color: 'pink', type: 'lowpass', f: 600, dst: g }); air.g.gain.value = 0.035; }
  { const L = lvA('eve'), s = K.layer(0, D, { color: 'pink', type: 'lowpass', f: 620, q: 0.5, dst: amb });
    K.curve(s.g.gain, 0, D, (t) => 0.12 * L(t) * (0.45 + 0.55 * sw(t, 6.4) * (0.7 + 0.3 * sw(t, 9.1, 1))));
    const w = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 420, q: 0.6, dst: amb }); K.curve(w.g.gain, 0, D, (t) => 0.025 * L(t)); }
  { const L = lvA('strato'), s = K.layer(0, D, { color: 'pink', type: 'bandpass', f: 1500, q: 0.5, dst: amb, f2: 4000, type2: 'lowpass' });
    K.curve(s.g.gain, 0, D, (t) => 0.06 * L(t) * (0.7 + 0.3 * sw(t, 2.1)));
    const lo = K.layer(0, D, { color: 'brown', type: 'lowpass', f: 110, dst: amb }); K.curve(lo.g.gain, 0, D, (t) => 0.12 * L(t)); }

  // cicadas: a "jiii" sizzle bed + "miin-min-min" phrases, all through one gate that follows the shot level (until s08)
  const CIC = T0('s08'), cicL = lvA('cic'), cic = K.gain(0, K.filter('lowpass', 7000, 0.5, amb)); K.curve(cic.gain, 0, CIC, (t) => cicL(t));
  { const s = K.layer(0, CIC, { color: 'pink', type: 'bandpass', f: 4300, q: 1.4, dst: cic }); s.g.gain.value = 0.0078;
    s.f.disconnect(); const tr = K.gain(0.6, s.g); s.f.connect(tr); K.osc('sine', 83, 0, CIC, K.gain(0.4, tr.gain)); }
  for (const [t, x, k, f] of [[T0('s01') + 0.1, -0.6, 0.9, 3150], [T0('s01') + 1.9, 0.5, 0.7, 3420], [T0('s02') + 0.05, 0.25, 1.0, 3300], [T0('s02') + 1.2, -0.4, 0.8, 3050], [T0('s03') + 1.3, 0.6, 0.6, 3250], [T0('s04') + 0.2, -0.5, 0.5, 3400], [T0('s06') - 0.1, 0.3, 0.6, 3200]])
    K.play(minmin(f, rng(Math.round(f + t * 10))), t, K.pan(x, cic), { v: 0.021 * k });

  // ================= machines (continuous; per-shot levels) =================
  { const L = lvM('reactor'), g = K.gain(0, fx), R0 = T0('s12') + 0.5, surge = (t) => 1 + 0.55 * smooth((t - C.surge) / 1.6) - 0.55 * smooth((t - C.shatter) / 2.0);
    K.curve(g.gain, R0, D, (t) => L(t) * (0.8 + 0.2 * sw(t, 0.8)));
    const lp = K.filter('lowpass', 700, 0.8, g);
    for (const [f, v, type] of [[55, 0.09, 'sine'], [110, 0.05, 'sawtooth'], [165, 0.025, 'sine'], [56.2, 0.05, 'sine']]) { const o = K.osc(type, f, R0, D, K.gain(v, lp)); K.curve(o.frequency, R0, D, (t) => f * surge(t), 60); }
    for (const [f, v] of [[1760, 0.006], [1766, 0.006], [2640, 0.003]]) { const o = K.osc('sine', f, R0, D, K.gain(v, g)); K.curve(o.frequency, R0, D, (t) => f * surge(t), 60); } }
  { const L = lvM('thrust'), a = T0('s18'), b = T0('s30') + 2, s = K.layer(a, b, { color: 'pink', type: 'bandpass', f: 330, q: 0.5, dst: fx, f2: 2600, type2: 'lowpass' });
    K.curve(s.g.gain, a, b, (t) => 0.3 * L(t) * (0.85 + 0.15 * sw(t, 0.31)));
    const hiss = K.layer(a, b, { color: 'pink', type: 'bandpass', f: 1800, q: 0.6, dst: fx }); K.curve(hiss.g.gain, a, b, (t) => 0.04 * L(t));
    const sub = K.gain(0, fx); K.curve(sub.gain, a, b, (t) => 0.04 * L(t)); K.osc('sine', 41, a, b, sub); }
  { const L = lvM('roar'), a = T0('s06'), b = C.shatter + 0.4, s = K.layer(a, b, { color: 'brown', type: 'lowpass', f: 650, q: 0.6, dst: fx });
    K.curve(s.g.gain, a, b, (t) => 0.45 * L(t) * (0.8 + 0.2 * sw(t, 0.9)));
    const mid = K.layer(a, b, { color: 'pink', type: 'bandpass', f: 380, q: 0.5, dst: fx }); K.curve(mid.g.gain, a, b, (t) => 0.14 * L(t));
    const cr = K.gain(0, K.filter('lowpass', 5200, 0.6, fx)); K.curve(cr.gain, a, b, (t) => L(t));
    K.play(crackle(b - a, 60, 0.16), a, cr); }

  // ================= effects =================
  // --- s01-s04 summer: gulls far off, the furin, laundry, the pier, Clawd eating (pilot.js poseSitting)
  const s01 = T0('s01'), s02 = T0('s02'), s03 = T0('s03'), s04 = T0('s04');
  gull(s01 + 0.9, { v: 0.018, pan: -0.5, n: 2, f: 1250 }); gull(s01 + 2.3, { v: 0.014, pan: 0.6, n: 3, f: 1100 }); gull(s03 + 1.2, { v: 0.025, pan: 0.45, n: 3 });
  for (const [t, v, x, n] of [[s02 + 0.2, 0.03, 0.35, 3], [s02 + 0.95, 0.02, 0.35, 2], [s02 + 1.55, 0.026, 0.3, 4], [s01 + 0.6, 0.006, 0.4, 2], [s03 + 2.4, 0.005, -0.3, 2]]) furin(t, v, x, n);
  laundry(s02, T1('s02'));
  for (let t = s03 + 0.15; t < T0('s05'); t += 0.75 + 0.55 * r()) lapSlap(t, 0.05 * (t < s04 ? 1 : 0.6), (r() - 0.5) * 0.8);
  for (const [dt, x] of [[0.6, -0.6], [1.8, 0.5], [2.9, -0.3]]) { boatKnock(s03 + dt, 0.035, x); creak(s03 + dt + 0.12, 0.35, 0.012, 170 + 60 * r(), x); }
  iceScrape(s03 + 0.05, s03 + 0.4, 0.55, 0.2);                 // dig 1 (in shot from the cut, scoop full at +0.3)
  bite(mark('bite', s03 + 1.04, ['hi']));                       // 'shaku': the bite leaves the spoon
  spoonTick(mark('rimTick', s03 + 2.75, ['hi']));               // the spoon taps the cup rim, going in for scoop 2
  iceScrape(s03 + 2.85, s04 + 0.55, 0.7, 0.18);                // dig 2 (through the s04 macro)
  spoon(s04 + 0.28);                                            // the macro scoop accent
  glint(C.glint);
  // --- s05-s07 the meteor arrives; the town reacts
  streak(C.streak, T1('s05'));
  ignite(C.ignite);
  { const s07 = T0('s07'), ch = K.gain(1, fx); K.env(ch.gain, [[s07, 1], [s07 + 0.3, 1], [s07 + 0.38, 0]]); furin(s07 + 0.02, 0.02, 0.3, 2, ch); }
  flaps(C.gulls, 1.7, 9, 0.17, true);
  K.burst(C.gulls, 0.8, { color: 'pink', type: 'bandpass', f: 1700, f1: 800, q: 0.6, a: 0.008, v: 0.15, tau: 0.22, dst: fx });   // the flock lifts off
  for (const [dt, x, f, v, n] of [[0.02, -0.4, 1180, 0.14, 4], [0.12, 0.35, 1320, 0.11, 3], [0.3, 0.65, 1020, 0.09, 3], [0.55, -0.2, 1400, 0.075, 3], [0.8, -0.65, 1250, 0.06, 2], [1.2, 0.1, 1100, 0.045, 2]]) gull(C.gulls + dt, { v, pan: x, f, n });
  // --- s08-s09 the decision, the jump (pilot.js poseCupAndJump: crouch +0.62..+0.76 into s09, leap at +0.76)
  for (let t = T0('s08') + 0.1; t < C.splash - 0.15; t += 0.8 + 0.5 * r()) lapSlap(t, 0.04, (r() - 0.5) * 0.8);
  iceSlip(C.look + 0.7); plop(mark('icePlop', C.look + 1.1, ['hi']), 0.09);   // the frozen bite slides off the spoon into the sea
  cupDown(C.cupDown);
  const leap = mark('pushOff', T0('s09') + 0.76); pushOff(T0('s09') + 0.62, leap);
  K.burst(leap + 0.02, C.splash - leap - 0.02, { color: 'pink', type: 'bandpass', f: 450, f1: 1500, q: 0.8, pts: [[leap + 0.02, 0], [leap + 0.14, 0.03], [C.splash - 0.04, 0.05], [C.splash, 0]], dst: fx });
  splashSmall(C.splash);
  // --- s10-s13 under the sea, the eyes, the cockpit, the reactor
  const s10 = T0('s10'), s11 = T0('s11');
  K.play(bubbles(1.6, 70, 0.05, 260, 1300), s10, fx);
  K.play(bubbles(2.0, 14, 0.03, 300, 900), s10 + 1.0, fx);
  K.sweep(s10 + 1.6, 2.2, { f0: 74, f1: 58, v: 0.05, a: 0.7, tau: 1.0, dst: fx, type: 'triangle' });
  K.burst(s11, 2.0, { color: 'pink', type: 'lowpass', f: 500, a: 0.6, v: 0.06, tau: 0.8, dst: fx });
  powerOn(C.eyes);
  seat(C.seat); panels(C.seat + 0.15); for (const [dt, x] of [[1.1, -0.35], [1.28, 0.35]]) clunk(C.seat + dt, 0.05, x, 420, dry);   // grips the levers
  reactorIgnite(C.reactor);
  plateClank(C.reactor + 0.45, 0.08, -0.3); plateClank(C.reactor + 0.85, 0.07, 0.3);
  // --- s14-s16 the bay boils, the rise, the rain of sea water
  const s14 = T0('s14'), s16 = T0('s16');
  K.play(bubbles(C.rise - s14 - 0.05, 110, 0.07, 70, 260, 0.08, 0.2, true), s14 + 0.05, K.filter('lowpass', 1400, 0.6, fx));
  K.burst(s14, C.rise - s14, { color: 'brown', type: 'lowpass', f: 140, a: 2.6, v: 0.2, tau: 1.5, dst: fx });
  for (const [dt, x] of [[0.4, -0.6], [1.2, 0.5], [2.0, -0.2], [2.6, 0.6]]) { creak(s14 + dt, 0.45, 0.02, 140 + 80 * r(), x); boatKnock(s14 + dt + 0.2, 0.04, x); }
  waterRoar(C.rise, T1('s15'));
  groan(C.rise + 0.1, 3.8, 0.07, 41, fx);
  flaps(C.rise + 0.3, 1.6, 7, 0.035);
  for (const [dt, x, f] of [[0.5, -0.5, 1200], [1.0, 0.4, 1350], [1.7, 0.7, 1050], [2.6, -0.2, 1250]]) gull(C.rise + dt, { v: 0.022, pan: x, f, n: 3 });
  rain(s16, T1('s16'), 1.0);
  rattle(s16 + 0.05, T1('s16'));
  // --- s17-s20 the threat, levers, unfold, launch
  const s17 = T0('s17'), s19 = T0('s19'), BL = C.launch - 0.15;
  { const split = K.gain(1, fx); split.connect(K.grit(fx, { drive: 6, v: 1.5 })); K.sweep(s17, 1.6, { f0: 75, f1: 34, v: 0.14, a: 0.01, tau: 0.5, dst: split }); }
  K.burst(s17, 2.0, { color: 'pink', type: 'bandpass', f: 1800, f1: 380, q: 0.5, a: 0.25, v: 0.11, tau: 1.0, dst: fx });
  clunk(C.levers, 0.1, -0.2, 260, dry); clunk(C.levers + 0.03, 0.09, 0.2, 240, dry); K.drum(C.levers, 0.32, dry, { f: 70, len: 0.4 });
  { const lp = K.filter('lowpass', 2600, 1.5, dry); K.sweep(C.levers + 0.05, s19 - C.levers - 0.05, { type: 'sawtooth', f0: 110, f1: 660, glide: s19 - C.levers - 0.1, dst: lp, pts: [[C.levers + 0.05, 0], [C.levers + 0.2, 0.03], [s19 - 0.08, 0.04], [s19, 0]] }); }
  K.burst(s19 + 0.05, 1.4, { color: 'pink', type: 'lowpass', f: 700, a: 0.35, v: 0.1, tau: 0.6, dst: fx });
  unfold(C.unfold);
  K.burst(C.launch - 0.8, 0.65, { color: 'pink', type: 'bandpass', f: 600, f1: 2000, q: 0.6, pts: [[C.launch - 0.8, 0], [C.launch - 0.78, 0.1], [BL - 0.04, 0.07], [BL, 0]], dst: fx });   // the soles flare (cut for the breath)
  launch(C.launch, 0.4);
  // --- s21-s23 the climb, the edge of space, near silence
  for (const [dt, x] of [[0.3, -0.7], [1.4, 0.6], [2.3, -0.4]]) K.burst(T0('s21') + dt, 0.9, { color: 'pink', type: 'bandpass', f: 900, f1: 500, q: 0.6, a: 0.3, v: 0.08, tau: 0.3, dst: fx, pan: x });
  { const s23 = T0('s23'); K.burst(s23 + 0.55, C.impact - s23 - 0.55, { color: 'pink', type: 'bandpass', f: 380, f1: 1600, q: 0.7, pts: [[s23 + 0.55, 0], [C.impact - 0.02, 0.045], [C.impact, 0]], dst: quiet });   // the inhale
    const s = K.layer(s23, C.impact + 0.02, { color: 'pink', type: 'bandpass', f: 2200, q: 0.7, dst: quiet }); K.env(s.g.gain, [[s23, 0], [s23 + 0.1, 0.01], [C.impact - 0.05, 0.01], [C.impact, 0]]); }
  // --- s24-s29 impact, strain, alarms, surge, crack, shatter
  impact(C.impact);
  const s25 = T0('s25'), s26 = T0('s26'), s28 = T0('s28');
  groan(s25, 2.6, 0.13, 44, fx); groan(s26, 2.1, 0.14, 39, fx); groan(s28, 2.6, 0.08, 48, fx);
  K.play(creaks(2.4, 9, 0.06), s25 + 0.1, K.filter('bandpass', 1400, 0.8, fx));
  K.play(creaks(2.4, 10, 0.06), s28 + 0.1, K.filter('bandpass', 1600, 0.8, fx));
  // red alarm: a two-tone siren, one tone per beacon half-cycle (cockpit.js: sin(8t + ph), ph 0 / pi), high on the
  // beacon pair with the front light, low on the other
  for (let k = Math.floor(s26 / BEACON); k * BEACON < T1('s26') - 0.06; k++) alarm(Math.max(k * BEACON, s26 + 0.004), (k + 1) * BEACON, k % 2 ? 660 : 880, k % 2 ? 0.15 : -0.15);
  K.play(rattleMetal(T1('s26') - s26), s26, K.filter('bandpass', 1500, 0.7, dry));
  surge(C.surge);
  rockCrack(C.crack);
  K.play(zaps(C.shatter - C.crack - 0.2), C.crack, K.filter('bandpass', 2600, 0.6, fx));
  shatter(C.shatter);
  // --- s30-s33 dusk, the fall, splash-down, the wave
  const s30 = T0('s30'), s31 = T0('s31'), s34 = T0('s34'), s35 = T0('s35');
  for (const [t, x, f, k] of [[s30 + 0.1, -0.5, 4650, 0.45], [s30 + 1.25, 0.6, 4380, 0.38], [s30 + 2.4, -0.2, 4800, 0.3], [T0('s32') + 1.9, 0.5, 4500, 0.35], [T0('s33') + 1.7, -0.6, 4700, 0.4], [T0('s33') + 2.0, 0.4, 4550, 0.6], [s35 + 2.4, 0.55, 4480, 0.4], [C.card + 1.1, -0.3, 4600, 0.3]])
    K.play(higurashi(f, rng(Math.round(f * 3 + t))), t, K.pan(x, K.filter('lowpass', 6800, 0.5, amb)), { v: 0.045 * k });
  for (const [t, x] of [[s30 + 0.5, -0.4], [s30 + 1.4, 0.5], [s30 + 2.3, 0.1], [s35 + 0.25, -0.3]]) shootingStar(t, 0.02, x);
  K.burst(s31, 2.1, { color: 'pink', type: 'bandpass', f: 400, f1: 1500, q: 0.6, a: 1.7, v: 0.15, tau: 2, dst: fx });   // the fall
  for (const [t, f, x] of [[s31 + 0.3, 3300, -0.3], [s31 + 0.85, 2700, 0.4], [s31 + 1.5, 3600, 0.1], [s34 + 0.4, 3100, 0.3], [s34 + 1.4, 2800, -0.3]]) K.bell(t, f, 0.008, fx, { parts: K.PARTS.glass, pan: x, tick: 0.2 });   // cooling armour ticks
  splashdown(C.splashdown);
  waveCrash(C.wave);
  // --- s34-s36 steam, smile, the climb out, the sip, the card
  K.burst(s34, T1('s34') - s34 + 0.1, { color: 'pink', type: 'bandpass', f: 2600, q: 0.9, a: 0.4, v: 0.016, tau: 1.6, dst: fx });
  creak(s34 + 0.55, 0.6, 0.02, 95, 0.2);
  for (const [t, m] of [[C.smile, 86], [C.smile + 0.14, 93]]) K.bell(t, mtof(m), 0.025, fx, { parts: K.PARTS.chime, pan: 0.15 });
  climbOut(s35);
  sip(C.sip);
  for (let t = s35 + 1.3; t < C.card - 0.1; t += 0.25 + 0.35 * r()) K.play(drops(0.3, 0.02, 1400, 3000, 2), t, fx);

  return marks;

  // ================= sound makers =================
  // a broadband transient: the crack at the front of a hit (2-6 kHz), with a lower-mid body
  function crackT(t, v, pan = 0, f = 3500, dst = fx) {
    K.burst(t, 0.12, { color: 'white', type: 'bandpass', f, q: 0.55, a: 0.0015, v, tau: 0.028, pan, dst });
    K.burst(t, 0.2, { color: 'pink', type: 'bandpass', f: f * 0.4, q: 0.7, a: 0.002, v: v * 0.7, tau: 0.05, pan, dst });
  }
  // a big metal clang in the mids (inharmonic plate partials)
  function metal(t, f, v, pan = 0, dst = fx) { K.bell(t, f, v, dst, { parts: [[1, 1, 0.9], [1.47, 0.7, 0.6], [2.09, 0.55, 0.45], [2.56, 0.4, 0.3], [3.38, 0.3, 0.2]], pan, tick: 0.3 }); }
  // metal screech: three detuned saws in a narrow, falling band with a fast wobble (armour grinding on rock)
  function screech(t, len, v, pan = 0) { K.at(t, () => {
    const out = K.pan(pan, fx), bp = K.filter('bandpass', 2600, 2.5, out), g = K.gain(0, bp);
    K.env(g.gain, K.perc(t, len, 0.03, v, len * 0.35));
    K.curve(bp.frequency, t, t + len, (x) => 2600 - 900 * (x - t) / len, 200);
    for (const [f, d] of [[1830, -6], [2410, 4], [3170, 9]]) { const o = K.osc('sawtooth', f, t, t + len + 0.02, K.gain(0.4, g), { det: d }); K.curve(o.frequency, t, t + len, (x) => f * (1 - 0.18 * (x - t) / len) * (1 + 0.012 * Math.sin((x - t) * 2 * Math.PI * 23 + f)), 400); }
  }); }
  function gull(t, { v = 0.03, pan = 0, n = 3, f = 1150, dst = fx, gap = 0.2 } = {}) { K.at(t, () => {
    const out = K.pan(pan, dst), bp = K.filter('bandpass', 1700, 1.6, K.filter('lowpass', 4200, 0.7, out));
    for (let i = 0, tt = t; i < n; i++, tt += gap * (0.85 + 0.3 * r())) {
      const ff = f * (0.94 + 0.12 * r()), len = 0.16 + 0.08 * r() + (i === 0 ? 0.08 : 0), g = K.gain(0, bp);
      K.env(g.gain, [[tt, 0], [tt + 0.025, v], [tt + len * 0.6, v * 0.8], [tt + len, 0]]);
      const o = K.osc('sawtooth', ff * 0.72, tt, tt + len + 0.02, g); o.frequency.setValueAtTime(ff * 0.72, tt); o.frequency.linearRampToValueAtTime(ff * 1.12, tt + 0.045); o.frequency.exponentialRampToValueAtTime(ff * 0.62, tt + len);
      K.osc('sine', 38, tt, tt + len + 0.02, K.gain(ff * 0.03, o.frequency));
    }
  }); }
  // wing flaps; sync: the first stroke of the first three birds exactly on t0, the rest within 40 ms
  function flaps(t0, len, birds, v, sync = false) {
    for (let b = 0; b < birds; b++) {
      const rate = 6 + 2.5 * r(), x = (r() - 0.5) * 1.6, st = t0 + (sync ? (b < 3 ? 0 : 0.04 * r()) : 0.12 * r()), f = 650 + 600 * r();
      for (let k = 0; st + k / rate < t0 + len; k++) K.burst(st + k / rate, 0.08, { color: 'pink', type: 'bandpass', f, q: 0.9, a: 0.004, v: v * (1 - k / (len * rate)) * (0.6 + 0.4 * r()), tau: 0.025, pan: x * (1 - 0.3 * k / (len * rate)), dst: fx });
    }
  }
  function furin(t, v, pan, strikes = 3, dst = fx) {
    for (let i = 0, tt = t; i < strikes; i++, tt += 0.09 + 0.14 * r()) K.bell(tt, 2480 * (1 + 0.012 * (i % 2)), v * (i === 0 ? 1 : 0.5 + 0.35 * r()), dst, { parts: K.PARTS.furin, pan, a: 0.0018, tick: 0.05 });
  }
  function laundry(t0, t1) { K.at(t0, () => {
    const s = K.layer(t0, t1 + 0.1, { color: 'pink', type: 'bandpass', f: 750, q: 0.7, dst: fx, pan: -0.35 });
    K.curve(s.g.gain, t0, t1 + 0.05, (t) => 0.06 * smooth((t - t0) / 0.15) * (1 - smooth((t - t1 + 0.1) / 0.15)) * (0.35 + 0.65 * Math.pow(sw(t + 0.15 * Math.sin(t * 5.1), 0.115), 2)) * (0.6 + 0.4 * sw(t, 1.3)), 400);
  }); }
  function lapSlap(t, v, pan) {
    K.burst(t, 0.3, { color: 'pink', type: 'bandpass', f: 420 + 250 * r(), q: 0.8, a: 0.03, v, tau: 0.09, pan, dst: fx });
    K.sweep(t + 0.04, 0.12, { f0: 220 + 60 * r(), f1: 140, v: v * 0.25, a: 0.006, tau: 0.04, pan, dst: fx });
  }
  function boatKnock(t, v, pan) { K.bell(t, 230 + 60 * r(), v, fx, { parts: [[1, 1, 0.05], [2.7, 0.35, 0.03]], pan, tick: 0.3 }); }
  function creak(t, len, v, f, pan, bf = 850, dst = fx) { K.at(t, () => {
    const out = K.pan(pan, dst), g = K.gain(0, K.filter('bandpass', bf, 3, out)); K.env(g.gain, K.sus(t, t + len * 0.8, Math.min(0.06, len * 0.3), v, len * 0.2));
    const o = K.osc('sawtooth', f, t, t + len + 0.02, g); K.curve(o.frequency, t, t + len, (x) => f * (1 + 0.12 * Math.sin((x - t) * 23) * Math.sin((x - t) * 7.1)), 300);
  }); }
  // shaved ice under the spoon: crunchy grains (bright) over a scrape, density and level following the dig
  function iceScrape(t0, t1, v, rough) { K.at(t0, () => {
    const len = t1 - t0, gr = [];
    for (let x = 0; x < len; x += 0.006 + 0.022 * r()) { const k = Math.sin(Math.PI * Math.min(1, x / len)) ** 0.5; gr.push({ t: x, pan: 0.1 + 0.1 * (r() - 0.5), len: 0.02, fn: K.gNoise(0.0005, 0.0015 + 0.004 * r(), 0.09 * v * k * (0.3 + 0.7 * r()), 0.75 + 0.2 * r(), Math.round(t0 * 1000 + x * 1e4)) }); }
    K.play(K.grainBuffer(len + 0.05, gr), t0, K.filter('bandpass', 3400, 0.6, fx));
    K.burst(t0, len, { color: 'pink', type: 'bandpass', f: 2600, q: 1.2, pts: [[t0, 0], [t0 + 0.04, 0.012 * v], [t1 - 0.05, 0.016 * v * (1 + rough)], [t1, 0]], dst: fx, pan: 0.1 });
  }); }
  // 'shaku': three quick crunch clusters as the ice leaves the spoon in his mouth + a soft mouth thump. The crunch lives
  // at 2-6 kHz (band-pass 3.5 kHz + low-pass 7 kHz, 1.5 ms grain attacks): crisp, not a hiss
  function bite(t) { K.at(t, () => {
    const gr = []; for (const [c, a] of [[0, 1], [0.035, 0.8], [0.075, 0.55]]) for (let i = 0; i < 9; i++) gr.push({ t: c + 0.012 * r(), pan: 0, len: 0.02, fn: K.gNoise(0.0015, 0.002 + 0.003 * r(), 0.1 * a * (0.5 + 0.5 * r()), 0.85, 700 + i + Math.round(c * 1000)) });
    K.play(K.grainBuffer(0.15, gr), t, K.filter('bandpass', 3500, 0.8, K.filter('lowpass', 7000, 0.7, fx)));
    K.burst(t + 0.01, 0.1, { color: 'pink', type: 'lowpass', f: 600, a: 0.004, v: 0.03, tau: 0.03, dst: fx });
  }); }
  function spoonTick(t) { K.bell(t, 2900, 0.014, fx, { parts: K.PARTS.glass, pan: 0.12, tick: 0.5 }); }
  function spoon(t) { K.at(t, () => {
    const gr = []; for (let i = 0; i < 46; i++) { const x = Math.pow(r(), 0.8) * 0.3; gr.push({ t: x, pan: 0.05, len: 0.03, fn: K.gNoise(0.0007, 0.003 + 0.006 * r(), 0.2 * (0.4 + 0.6 * r()) * (1 - x / 0.36), 0.6, 9 + i) }); }
    K.play(K.grainBuffer(0.4, gr), t, K.filter('bandpass', 3000, 0.7, fx));
    K.burst(t, 0.22, { color: 'pink', type: 'bandpass', f: 1700, q: 1.0, a: 0.02, v: 0.025, tau: 0.08, dst: fx });
  }); }
  // the frozen bite slides off the spoon: a tiny wet squeak
  function iceSlip(t) { K.sweep(t, 0.12, { type: 'triangle', f0: 2300, f1: 1700, v: 0.006, a: 0.01, tau: 0.05, dst: K.filter('bandpass', 2000, 2, fx) }); }
  function plop(t, v) { K.sweep(t, 0.09, { f0: 900, f1: 1900, v, a: 0.002, tau: 0.03, dst: fx, pan: 0.2 }); K.burst(t, 0.08, { color: 'white', type: 'bandpass', f: 3000, q: 0.8, a: 0.002, v: v * 0.5, tau: 0.015, dst: fx, pan: 0.2 }); }
  function glint(t) {
    K.bell(t, 2637, 0.015, fx, { parts: K.PARTS.glock, pan: 0.35, tick: 0.02 }); K.bell(t + 0.07, 3520, 0.011, fx, { parts: K.PARTS.glock, pan: 0.45, tick: 0.02 });
    K.burst(t - 0.03, 0.5, { color: 'pink', type: 'bandpass', f: 5000, f1: 7500, q: 2, a: 0.05, v: 0.006, tau: 0.15, dst: fx, pan: 0.4 });
  }
  function streak(t0, t1) { K.at(t0, () => {
    const g = K.gain(0, K.pan(0.25, fx)); K.env(g.gain, [[t0, 0], [t0 + 0.5, 0.018], [t1 - 0.2, 0.022], [t1, 0]]);
    const o = K.osc('sine', 1900, t0, t1 + 0.02, g); o.frequency.setValueAtTime(1900, t0); o.frequency.exponentialRampToValueAtTime(1450, t1);
    K.osc('sine', 6, t0, t1, K.gain(9, o.frequency));
    K.burst(t0, t1 - t0, { color: 'pink', type: 'bandpass', f: 1650, f1: 1300, q: 4, pts: [[t0, 0], [t0 + 0.6, 0.012], [t1 - 0.15, 0.014], [t1, 0]], dst: fx, pan: 0.25 });
  }); }
  // the plasma sheath ignites: sub drop, the roar rising, and a tearing plasma layer (1-3 kHz) + crackle up to the cut
  function ignite(t) {
    const end = T0('s07');
    K.sweep(t, 1.6, { f0: 95, f1: 38, v: 0.08, a: 0.03, tau: 0.45, dst: fx });
    K.burst(t, 1.6, { color: 'pink', type: 'bandpass', f: 260, f1: 1300, q: 0.6, a: 0.25, v: 0.13, tau: 1.0, dst: fx });
    K.burst(t, end - t, { color: 'pink', type: 'bandpass', f: 900, f1: 2600, q: 0.8, pts: [[t, 0], [t + 0.025, 0.32], [t + 0.5, 0.24], [end - 0.08, 0.38], [end, 0]], dst: fx });
    crackT(t, 0.2, 0.2, 2400);
    K.play(crackle(end - t, 110, 0.45), t, K.filter('bandpass', 2600, 0.6, fx), { pts: [[t, 1], [end - 0.05, 1], [end, 0]] });
  }
  function cupDown(t) {
    K.bell(t, 2093, 0.035, fx, { parts: K.PARTS.glass, pan: 0.15, tick: 0.2 });
    K.bell(t, 520, 0.03, fx, { parts: [[1, 1, 0.05], [2.7, 0.4, 0.03]], pan: 0.15, tick: 0 });
    K.bell(t + 0.004, 940, 0.07, fx, { parts: [[1, 1, 0.03], [2.3, 0.5, 0.02]], pan: 0.15, tick: 0.3 });   // glass base on the bollard cap
    K.burst(t, 0.06, { color: 'pink', type: 'bandpass', f: 900, q: 0.7, a: 0.002, v: 0.09, tau: 0.012, dst: fx, pan: 0.15 });
  }
  // the crouch on the planks (creak) and the push (plank knock + a low thump)
  function pushOff(t0, tl) {
    creak(t0, tl - t0 + 0.03, 0.05, 210, 0.1, 1100);
    K.bell(tl, 340, 0.15, fx, { parts: [[1, 1, 0.06], [2.4, 0.5, 0.035], [3.9, 0.25, 0.02]], tick: 0.4, pan: 0.1 });
    K.burst(tl, 0.12, { color: 'pink', type: 'bandpass', f: 1400, q: 0.7, a: 0.002, v: 0.12, tau: 0.03, dst: fx, pan: 0.1 });
    K.burst(tl, 0.06, { color: 'white', type: 'bandpass', f: 4000, q: 0.8, a: 0.0015, v: 0.35, tau: 0.02, dst: fx, pan: 0.1 });
    K.sweep(tl, 0.2, { f0: 130, f1: 70, v: 0.08, a: 0.003, tau: 0.05, dst: fx });
  }
  // Clawd hits the sea: thump, body splash, the crown ('ksh', 2-6 kHz, 250 ms), drops; the camera is still above water.
  // A small splash: rounded attacks (8 ms on the body), no peak for the limiter
  function splashSmall(t) {
    K.sweep(t, 0.3, { f0: 170, f1: 70, v: 0.18, a: 0.003, tau: 0.07, dst: fx });
    K.burst(t, 0.7, { color: 'white', type: 'bandpass', f: 1500, f1: 800, q: 0.6, a: 0.008, v: 0.5, tau: 0.1, lvl: 0.3, tau2: 0.3, dst: fx });
    K.burst(t, 0.25, { color: 'pink', type: 'bandpass', f: 600, q: 0.7, a: 0.003, v: 0.4, tau: 0.06, dst: fx });
    K.burst(t + 0.006, 0.25, { color: 'white', type: 'bandpass', f: 3800, q: 0.5, a: 0.002, v: 0.3, tau: 0.08, dst: fx });
    K.play(drops(0.6, 0.1, 1800, 5200, 40), t + 0.04, fx);
  }
  // the eyes light up: a deep thump + saw rise under the sea (muffled), and on the pass bus (not muffled, underwater
  // reverb): a relay 'ka-chunk' and a rising 'whumm'
  function powerOn(t) { K.at(t, () => {
    K.drum(t, 0.3, fx, { f: 40, len: 1.0 });
    const lp = K.filter('lowpass', 900, 1.2, fx); K.sweep(t, 1.8, { type: 'sawtooth', f0: 42, f1: 110, glide: 0.9, v: 0.05, a: 0.02, tau: 0.9, dst: lp });
    lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.9);
    for (const [dt, f, v] of [[0, 780, 0.05], [0.045, 520, 0.07]]) { K.bell(t + dt, f, v, pass, { parts: [[1, 1, 0.04], [2.6, 0.5, 0.025], [4.1, 0.3, 0.015]], tick: 0.5 }); K.burst(t + dt, 0.07, { color: 'pink', type: 'bandpass', f: f * 2.2, q: 0.8, a: 0.0015, v: v * 0.8, tau: 0.014, dst: pass }); }
    const bp = K.filter('bandpass', 400, 1.5, pass); bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.9);
    K.sweep(t + 0.02, 1.3, { type: 'sawtooth', f0: 70, f1: 280, glide: 0.9, v: 0.05, a: 0.08, tau: 0.7, dst: bp });
  }); }
  // Clawd lands in the seat: body thump, cushion 'thup' (600 Hz, what a phone plays), the seat frame clacks + a tick,
  // a spring squeak
  function seat(t) {
    K.drum(t, 0.5, dry, { f: 85, len: 0.35, skin: 0.5 });
    K.burst(t, 0.25, { color: 'pink', type: 'lowpass', f: 900, a: 0.003, v: 0.13, tau: 0.06, dst: dry });
    K.burst(t, 0.2, { color: 'pink', type: 'bandpass', f: 600, q: 0.8, a: 0.003, v: 0.12, tau: 0.04, dst: dry });
    K.burst(t + 0.008, 0.05, { color: 'white', type: 'bandpass', f: 2500, q: 0.9, a: 0.0015, v: 0.05, tau: 0.01, dst: dry, pan: 0.15 });
    K.bell(t + 0.01, 1480, 0.07, dry, { parts: [[1, 1, 0.04], [2.3, 0.6, 0.025], [3.7, 0.35, 0.015]], tick: 0.5, pan: 0.15 });
    creak(t + 0.05, 0.2, 0.02, 520, -0.1, 1900, dry);
  }
  function panels(t0) {
    [81, 86, 88, 93, 86, 90, 98].forEach((m, i) => K.sweep(t0 + i * 0.11, 0.1, { f0: mtof(m), v: 0.03, a: 0.004, tau: 0.04, dst: dry, pan: -0.5 + i * 0.15 }));
    for (let i = 0; i < 6; i++) K.burst(t0 + 0.05 + i * 0.13, 0.03, { color: 'white', type: 'bandpass', f: 3000, q: 1, a: 0.001, v: 0.012, tau: 0.004, dst: dry, pan: 0.5 - i * 0.17 });
    K.sweep(t0 - 0.05, 1.2, { type: 'triangle', f0: 180, f1: 520, glide: 0.8, v: 0.01, a: 0.25, tau: 0.6, dst: dry });
  }
  function clunk(t, v, pan, f, dst = fx) { K.bell(t, f, v, dst, { parts: [[1, 1, 0.05], [2.4, 0.6, 0.035], [3.9, 0.3, 0.02]], pan, tick: 0.3 }); K.burst(t, 0.08, { color: 'pink', type: 'lowpass', f: 900, a: 0.002, v: v * 0.5, tau: 0.02, dst, pan }); }
  // the chest reactor ignites (under the sea): deep drum + saw rise (muffled); the electric snap + chime on the pass bus
  function reactorIgnite(t) { K.at(t, () => {
    K.drum(t, 0.5, fx, { f: 38, len: 2.0 });
    K.sweep(t, 2.6, { type: 'sawtooth', f0: 30, f1: 55, glide: 1.2, v: 0.05, a: 0.05, tau: 1.5, dst: K.filter('lowpass', 500, 0.7, fx) });
    crackT(t, 0.25, 0, 2000, pass);
    K.bell(t + 0.02, 1760, 0.03, pass, { parts: K.PARTS.chime, pan: 0 });
    K.sweep(t + 0.01, 0.9, { type: 'sawtooth', f0: 220, f1: 880, glide: 0.6, v: 0.06, a: 0.01, tau: 0.35, dst: K.filter('bandpass', 1200, 1.2, pass) });
  }); }
  function plateClank(t, v, pan, f = 95) { K.bell(t, f, v, fx, { parts: [[1, 1, 0.5], [2.31, 0.5, 0.3], [3.82, 0.3, 0.18], [5.6, 0.15, 0.1]], pan, tick: 0.12 }); K.burst(t, 0.3, { color: 'brown', type: 'lowpass', f: 400, a: 0.004, v: v * 0.5, tau: 0.08, dst: fx, pan }); }
  // the rise: the head breaks the surface (a water burst), then sheets of water roar off the armour
  function waterRoar(t0, t1) { K.at(t0, () => {
    K.burst(t0, 1.2, { color: 'white', type: 'bandpass', f: 1800, q: 0.5, a: 0.004, v: 0.22, tau: 0.25, dst: fx });
    K.burst(t0, 0.5, { color: 'pink', type: 'bandpass', f: 800, q: 0.6, a: 0.004, v: 0.32, tau: 0.12, dst: fx });
    const s = K.layer(t0, t1 + 0.1, { color: 'pink', type: 'bandpass', f: 700, q: 0.4, dst: fx, f2: 3200, type2: 'lowpass' });
    K.env(s.g.gain, [[t0, 0], [t0 + 0.7, 0.24], [t0 + 2.4, 0.31], [t1 - 0.05, 0.28], [t1 + 0.03, 0]]);
    const lo = K.layer(t0, t1 + 0.1, { color: 'brown', type: 'lowpass', f: 300, dst: fx }); K.env(lo.g.gain, [[t0, 0], [t0 + 0.8, 0.22], [t1 - 0.05, 0.22], [t1 + 0.03, 0]]);
    K.play(drops(t1 - t0 - 0.6, 0.05, 900, 3000, 160), t0 + 0.6, fx, { pts: [[t0 + 0.6, 1], [t1 - 0.05, 1], [t1 + 0.02, 0]] });
  }); }
  function groan(t0, len, v, f, dst) { K.at(t0, () => {
    const out = K.gain(0, dst); K.env(out.gain, K.sus(t0, t0 + len - 0.3, 0.35, v, 0.3));
    const src = K.gain(1), seed = f * 13;
    for (const [bf, q, g] of [[230, 5, 1], [520, 6, 0.6], [1100, 7, 0.25]]) { const bp = K.filter('bandpass', bf, q, K.gain(g * 2.5, out)); src.connect(bp); K.curve(bp.frequency, t0, t0 + len, (t) => bf * (1 + 0.15 * Math.sin((t - t0) * 1.7 + seed))); }
    const o = K.osc('sawtooth', f, t0, t0 + len + 0.02, src); K.curve(o.frequency, t0, t0 + len, (t) => f * (1 + 0.07 * Math.sin((t - t0) * 4.1 + seed) + 0.05 * Math.sin((t - t0) * 9.7)), 200);
    K.osc('sawtooth', f * 1.51, t0, t0 + len + 0.02, K.gain(0.5, src));
  }); }
  function rain(t0, t1, k) { K.at(t0, () => {
    K.play(drops(t1 - t0, 0.04 * k, 1200, 4200, 220), t0, fx, { pts: [[t0, 0], [t0 + 0.05, 1], [t1 - 0.05, 1], [t1 + 0.01, 0]] });
    const s = K.layer(t0, t1 + 0.05, { color: 'pink', type: 'lowpass', f: 2600, q: 0.5, dst: fx }); K.env(s.g.gain, [[t0, 0], [t0 + 0.06, 0.07 * k], [t1 - 0.05, 0.06 * k], [t1 + 0.01, 0]]);
  }); }
  function rattle(t0, t1) {
    const gr = []; for (let t = 0; t < t1 - t0; t += 0.045 + 0.03 * r()) { const step = 0.5 + 0.5 * Math.pow(sw(t, 0.83), 4); gr.push({ t, pan: -0.2, len: 0.15, fn: K.gBell(2700 + 400 * r(), K.PARTS.glass, 0.0012, 0.03 * step * (0.4 + 0.6 * r()), 0.15) }); }
    K.play(K.grainBuffer(t1 - t0 + 0.2, gr), t0, fx, { pts: [[t0, 1], [t1 - 0.04, 1], [t1, 0]] });
  }
  function unfold(t) { K.at(t, () => {
    const lp = K.filter('bandpass', 1300, 1.2, fx); K.sweep(t, 1.0, { type: 'sawtooth', f0: 220, f1: 470, glide: 0.65, v: 0.03, a: 0.08, tau: 0.8, dst: lp });
    for (const [dt, x] of [[0, -0.4], [0.35, 0.4], [0.7, 0]]) plateClank(t + dt, 0.14, x, 78);
    K.burst(t + 0.15, 0.5, { color: 'white', type: 'bandpass', f: 3300, q: 0.9, a: 0.04, v: 0.018, tau: 0.15, dst: fx });
  }); }
  // a boom: sub sweeps (modest) through a soft saturator + parallel grit (their harmonics at 120-450 Hz), blast noise
  function boom(t, v) { K.at(t, () => {
    const split = K.gain(1); split.connect(K.shaper(2.0, big)); split.connect(K.grit(big, { drive: 7, v: 1.6 }));
    K.sweep(t, 2.6, { f0: 70, f1: 30, glide: 1.8, v: v * 0.12, a: 0.01, tau: 0.9, dst: split });
    K.sweep(t, 0.6, { f0: 140, f1: 50, glide: 0.15, v: v * 0.2, a: 0.004, tau: 0.12, dst: split });
    K.burst(t, 0.9, { color: 'pink', type: 'bandpass', f: 2000, f1: 600, q: 0.35, a: 0.004, v: v * 0.5, tau: 0.18, dst: big });
    K.burst(t, 2.0, { color: 'pink', type: 'bandpass', f: 700, q: 0.7, a: 0.02, v: v * 0.3, tau: 0.6, dst: big });
    K.burst(t, 3.8, { color: 'brown', type: 'lowpass', f: 240, a: 0.05, v: v * 0.08, tau: 1.3, dst: big });
  }); }
  // the launch: boom + a broadband crack, the air 'whoomp' (1-3 kHz, the body a phone plays), the shockwave, the ring of
  // spray; the second loudest moment of the film, well over its own build-up
  function launch(t, v) {
    boom(t, v);
    crackT(t, 0.5, 0, 2800); crackT(t + 0.012, 0.2, 0.3, 5000);
    K.burst(t + 0.004, 0.9, { color: 'pink', type: 'bandpass', f: 2800, f1: 1000, q: 0.8, a: 0.006, v: 0.3, tau: 0.2, dst: big });
    K.sweep(t + 0.004, 0.5, { type: 'triangle', f0: 1900, f1: 900, glide: 0.35, v: 0.05, a: 0.006, tau: 0.14, dst: K.filter('bandpass', 1500, 0.9, big) });
    K.burst(t + 0.02, 1.5, { color: 'pink', type: 'bandpass', f: 2400, f1: 300, q: 0.5, a: 0.01, v: 0.14, tau: 0.5, dst: big });
    K.burst(t + 0.06, 1.6, { color: 'white', type: 'bandpass', f: 2000, q: 0.5, a: 0.03, v: 0.4, tau: 0.6, dst: K.filter('lowpass', 8000, 0.7, fx) });
    K.play(drops(1.2, 0.05, 1200, 4000, 70), t + 0.3, fx);
  }
  // the impact: boom, white crack, the colossal clang (104 Hz) + plate clangs in the mids, the arms' armour screeching
  // on the rock, debris, the long blast
  function impact(t) {
    boom(t, 1.0);
    K.burst(t, 0.9, { color: 'white', type: 'lowpass', f: 7000, f1: 900, q: 0.5, a: 0.002, v: 0.26, tau: 0.2, dst: big });
    K.bell(t + 0.005, 104, 0.06, big, { parts: [[1, 1, 1.2], [2.31, 0.6, 0.8], [3.82, 0.45, 0.5], [5.6, 0.25, 0.3], [7.9, 0.12, 0.2]], tick: 0 });
    crackT(t, 0.28, 0, 3200); crackT(t + 0.01, 0.18, -0.3, 5500);
    metal(t + 0.004, 610, 0.09, 0.2); metal(t + 0.02, 890, 0.06, -0.25);
    screech(t + 0.06, 1.8, 0.05, 0.15);
    K.play(debris(1.8, 160, 0.14), t + 0.015, K.filter('bandpass', 3200, 0.5, fx));
    K.burst(t + 0.04, 2.6, { color: 'pink', type: 'bandpass', f: 3200, f1: 240, q: 0.5, a: 0.015, v: 0.25, tau: 0.9, dst: big });
    K.burst(t + 0.1, 3.6, { color: 'pink', type: 'bandpass', f: 1100, q: 0.6, a: 0.15, v: 0.25, tau: 1.6, dst: fx });
    K.burst(t + 0.2, 1.4, { color: 'brown', type: 'lowpass', f: 500, a: 0.1, v: 0.06, tau: 0.8, dst: fx });
  }
  function creaks(len, n, v) {
    const gr = [];
    for (let c = 0; c < n; c++) { const st = r() * (len - 0.4), rate = 35 + 50 * r(), d = 0.12 + 0.25 * r(), x = (r() - 0.5) * 1.2;
      for (let k = 0; k < d * rate; k++) gr.push({ t: st + k / rate + 0.003 * r(), pan: x, len: 0.02, fn: K.gNoise(0.0005, 0.0025, v * Math.sin(Math.PI * k / (d * rate)), 0.7, c * 100 + k) }); }
    return K.grainBuffer(len + 0.1, gr);
  }
  // one siren tone over a beacon half-cycle [t0, t1): opens on the light, peaks with it (mid-way), closes before the next
  function alarm(t0, t1, f, pan) { K.at(t0, () => {
    const out = K.pan(pan, dry), g = K.gain(0, K.filter('lowpass', 2300, 0.8, out)), pk = (t0 + t1) / 2, v = 0.045;
    K.env(g.gain, [[t0, 0], [t0 + 0.012, v * 0.6], [Math.max(pk, t0 + 0.02), v], [t1 - 0.04, v * 0.55], [t1 - 0.012, 0]]);
    K.osc('square', f, t0, t1, g); K.osc('sine', f * 2, t0, t1, K.gain(0.3, g));
  }); }
  function rattleMetal(len) {
    const gr = []; for (let t = 0; t < len; t += 1 / 22 * (0.8 + 0.4 * r())) gr.push({ t, pan: (r() - 0.5) * 0.6, len: 0.05, fn: K.gBell(1200 + 400 * r(), [[1, 1, 0.012], [2.3, 0.5, 0.007]], 0.0006, 0.08 * (0.5 + 0.5 * r()) * (0.6 + 0.4 * t / len), 0.05) });
    return K.grainBuffer(len + 0.1, gr);
  }
  function surge(t) { K.at(t, () => {
    const lp = K.filter('lowpass', 400, 6, fx); lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(4200, t + 1.6);
    K.sweep(t, C.shatter - t, { type: 'sawtooth', f0: 110, f1: 1320, glide: 1.6, dst: lp, pts: [[t, 0], [t + 0.05, 0.045], [t + 1.6, 0.05], [C.shatter - 0.18, 0.03], [C.shatter - 0.15, 0]] });
    K.sweep(t, 1.8, { type: 'sine', f0: 220, f1: 2640, glide: 1.6, v: 0.02, a: 0.05, tau: 1.2, dst: fx });
    K.play(zaps(1.2, 0.5), t + 0.1, K.filter('bandpass', 3000, 0.6, fx));
    K.drum(t, 0.3, fx, { f: 45, len: 1.2 });
  }); }
  // the meteor cracks: the white crack, a bright snap (2-6 kHz), a low split, fracture grit
  function rockCrack(t) { K.at(t, () => {
    K.burst(t, 0.5, { color: 'white', type: 'lowpass', f: 4000, f1: 600, a: 0.002, v: 0.22, tau: 0.06, dst: big });
    crackT(t, 0.25, 0.1, 4200);
    K.sweep(t, 0.7, { f0: 90, f1: 38, glide: 0.4, v: 0.12, a: 0.003, tau: 0.16, dst: big });
    const gr = []; for (let i = 0; i < 30; i++) { const x = Math.pow(r(), 1.5) * 0.5; gr.push({ t: x, pan: (r() - 0.5), len: 0.05, fn: K.gNoise(0.0008, 0.008, 0.2 * (1 - x * 1.6), 0.5, 300 + i) }); }
    K.play(K.grainBuffer(0.6, gr), t, K.filter('bandpass', 2800, 0.5, fx));
  }); }
  function zaps(len, k = 1) {
    const gr = [];
    for (let c = 0, t = 0; t < len; c++, t += 0.12 + 0.25 * r()) { const n = 8 + Math.floor(20 * r()), x = (r() - 0.5) * 1.4;
      for (let i = 0; i < n; i++) gr.push({ t: t + i * 0.004 * (0.5 + r()), pan: x, len: 0.012, fn: K.gNoise(0.0006, 0.0015 + 0.002 * r(), 0.18 * k * (0.4 + 0.6 * r()), 0.85, c * 77 + i) }); }
    return K.grainBuffer(len + 0.1, gr);
  }
  // the meteor bursts: boom, crack, glowing fragments (D major pentatonic glock grains over 3.6 s)
  function shatter(t) { K.at(t, () => {
    const split = K.gain(1); split.connect(K.shaper(2.0, big)); split.connect(K.grit(big, { drive: 7, v: 1.4 }));
    K.sweep(t, 2.2, { f0: 62, f1: 30, glide: 1.6, v: 0.08, a: 0.008, tau: 0.55, dst: split });
    crackT(t, 0.16, -0.2, 3200); crackT(t + 0.015, 0.1, 0.3, 5200);
    K.burst(t, 1.3, { color: 'white', type: 'bandpass', f: 3400, f1: 1400, q: 0.5, a: 0.003, v: 0.1, tau: 0.22, dst: big });
    K.burst(t, 2.5, { color: 'brown', type: 'lowpass', f: 300, a: 0.01, v: 0.07, tau: 0.9, dst: big });
    const PEN = [74, 76, 78, 81, 83], gr = [];
    for (let i = 0; i < 340; i++) { const x = 3.6 * Math.pow(r(), 2.2), f = mtof(PEN[Math.floor(r() * 5)] + 12 * (1 + Math.floor(r() * 2))) * (1 + 0.003 * (r() - 0.5));
      gr.push({ t: 0.02 + x, pan: (r() - 0.5) * 1.8, len: 0.9, fn: K.gBell(f, K.PARTS.glock, 0.0015, 0.013 * (0.35 + 0.65 * r()) * (1 - x / 4.2), 0.9) }); }
    for (let i = 0; i < 60; i++) { const x = Math.pow(r(), 2) * 1.2; gr.push({ t: x, pan: (r() - 0.5) * 1.6, len: 0.03, fn: K.gNoise(0.0006, 0.004, 0.06 * (1 - x / 1.3), 0.7, 900 + i) }); }
    K.play(K.grainBuffer(4.6, gr), t, K.filter('lowpass', 7500, 0.5, fx));
  }); }
  function shootingStar(t, v, pan) {
    K.burst(t, 0.9, { color: 'pink', type: 'bandpass', f: 2600, f1: 900, q: 1.2, a: 0.3, v, tau: 0.3, dst: fx, pan });
    K.bell(t + 0.75, mtof(93 + Math.floor(r() * 3) * 2), v * 0.5, fx, { parts: K.PARTS.celesta, pan: pan * 0.5, tick: 0 });
  }
  // the giant hits the bay: a modest sub + grit, the body of the water hit (whump 0.5-1 kHz + 'ksh' 1.5-4 kHz), the
  // plume roar, spray, the rain of drops
  function splashdown(t) { K.at(t, () => {
    const split = K.gain(1); split.connect(K.shaper(2.0, big)); split.connect(K.grit(big, { drive: 6, v: 1.2 }));
    K.sweep(t, 2.6, { f0: 58, f1: 28, glide: 2.0, v: 0.07, a: 0.01, tau: 0.75, dst: split });
    K.burst(t, 0.6, { color: 'pink', type: 'bandpass', f: 750, q: 0.5, a: 0.004, v: 0.65, tau: 0.13, dst: fx });
    K.burst(t + 0.004, 0.9, { color: 'pink', type: 'bandpass', f: 1400, q: 0.6, a: 0.004, v: 0.4, tau: 0.2, dst: fx });
    K.burst(t + 0.006, 1.4, { color: 'white', type: 'bandpass', f: 2300, q: 0.45, a: 0.005, v: 0.4, tau: 0.3, lvl: 0.3, tau2: 0.8, dst: K.filter('lowpass', 8000, 0.7, fx) });   // 'ksh', no hiss above 8 kHz
    K.burst(t, 3.6, { color: 'pink', type: 'lowpass', f: 2600, f1: 600, a: 0.03, v: 0.1, tau: 0.9, lvl: 0.35, tau2: 1.6, dst: big });
    K.burst(t + 0.05, 2.6, { color: 'white', type: 'bandpass', f: 1900, q: 0.5, a: 0.08, v: 0.07, tau: 0.8, dst: fx });
    K.play(drops(3.6, 0.04, 900, 3500, 200), t + 1.0, fx, { pts: [[t + 1.0, 0], [t + 1.4, 1], [t + 3.2, 0.6], [t + 4.6, 0]] });
  }); }
  function waveCrash(t) { K.at(t, () => {
    K.sweep(t, 0.9, { f0: 80, f1: 42, glide: 0.5, v: 0.2, a: 0.01, tau: 0.25, dst: big });
    K.burst(t, 2.6, { color: 'pink', type: 'lowpass', f: 2000, f1: 520, a: 0.05, v: 0.38, tau: 0.9, dst: big });
    K.burst(t + 0.05, 2.0, { color: 'white', type: 'bandpass', f: 2500, q: 0.6, a: 0.05, v: 0.11, tau: 0.7, dst: fx });
    K.burst(t + 0.8, 1.7, { color: 'white', type: 'bandpass', f: 3100, q: 0.7, a: 0.4, v: 0.016, tau: 0.8, dst: fx });
    K.play(drops(1.4, 0.03, 1200, 3800, 120), t + 0.3, fx);
  }); }
  // s35, pilot.js poseReturn (lt = t - s35.t0): pulls on the ladder +0.14 / +0.42, belly flop onto the planks +0.65
  // (the strongest contact), shake-off +0.70..+0.92 (five flicks of spray), two wet steps, the nub on the glass +1.38,
  // the cup lifts off the bollard +1.48
  function climbOut(t0) {
    for (const [dt, v, x] of [[0.14, 0.45, -0.1], [0.42, 0.28, 0.1]]) wetSlap(mark('pull', t0 + dt), v, x);
    K.play(drops(0.5, 0.03, 1500, 3500, 14), t0 + 0.16, fx);
    flop(mark('flop', t0 + 0.65, ['lo', 'mid', 'hi']));
    for (let i = 0; i < 5; i++) { const a = 0.1 + 0.2 * i, t = t0 + 0.7 + 0.22 * a; if (i === 0) mark('shake', t); spray(t, 0.24 * (1 - 0.6 * a), i % 2 ? 0.45 : -0.45); }
    for (const [dt, x, v] of [[1.0, -0.15, 0.17], [1.19, 0.15, 0.12]]) wetStep(mark('step', t0 + dt), v, x);
    K.bell(t0 + 1.38, 3300, 0.006, fx, { parts: K.PARTS.glass, pan: 0.1, tick: 0.5 });
    const lift = mark('cupLift', t0 + 1.48);
    K.bell(lift, 2093, 0.03, fx, { parts: K.PARTS.glass, pan: 0.1, tick: 0.25 }); K.bell(lift, 640, 0.18, fx, { parts: [[1, 1, 0.03], [2.3, 0.4, 0.02]], pan: 0.1, tick: 0.3 }); K.burst(lift, 0.08, { color: 'pink', type: 'bandpass', f: 900, q: 0.8, a: 0.003, v: 0.1, tau: 0.03, dst: fx, pan: 0.1 });
    K.burst(lift - 0.01, 0.08, { color: 'white', type: 'bandpass', f: 2500, q: 1.2, a: 0.01, v: 0.03, tau: 0.03, dst: fx, pan: 0.1 });
  }
  function wetSlap(t, v, x) {
    K.burst(t, 0.2, { color: 'pink', type: 'bandpass', f: 1100, q: 0.8, a: 0.004, v: v * 1.1, tau: 0.06, dst: fx, pan: x });
    K.burst(t, 0.2, { color: 'pink', type: 'bandpass', f: 500, q: 0.8, a: 0.004, v: v * 0.9, tau: 0.06, dst: fx, pan: x });
    K.burst(t, 0.06, { color: 'white', type: 'bandpass', f: 3200, q: 0.8, a: 0.002, v: v * 0.35, tau: 0.012, dst: fx, pan: x });
    K.bell(t + 0.003, 1250, v * 0.2, fx, { parts: [[1, 1, 0.08], [2.76, 0.4, 0.04]], pan: x, tick: 0 });   // the metal ladder rail
  }
  function flop(t) {
    K.burst(t, 0.25, { color: 'pink', type: 'bandpass', f: 650, q: 0.6, a: 0.003, v: 0.25, tau: 0.07, dst: fx });
    K.burst(t, 0.18, { color: 'white', type: 'bandpass', f: 2600, q: 0.6, a: 0.002, v: 0.113, tau: 0.04, dst: fx });
    K.sweep(t, 0.2, { f0: 140, f1: 75, v: 0.16, a: 0.003, tau: 0.05, dst: fx });
    K.play(drops(0.22, 0.03, 1200, 3800, 12), t + 0.01, fx);
    creak(t + 0.03, 0.25, 0.02, 150, 0);
  }
  function spray(t, v, x) {
    K.burst(t, 0.1, { color: 'white', type: 'bandpass', f: 3400, q: 0.7, a: 0.004, v, tau: 0.03, dst: fx, pan: x });
    K.play(drops(0.2, v * 0.35, 2000, 5000, 6), t + 0.005, fx);
  }
  function wetStep(t, v, x) {
    K.burst(t, 0.12, { color: 'pink', type: 'bandpass', f: 900, q: 0.9, a: 0.003, v, tau: 0.03, dst: fx, pan: x });
    K.burst(t + 0.008, 0.1, { color: 'white', type: 'bandpass', f: 3200, q: 0.7, a: 0.002, v: v * 2.2, tau: 0.04, dst: fx, pan: x });
    K.bell(t, 300, v * 0.6, fx, { parts: [[1, 1, 0.05], [2.4, 0.4, 0.03]], pan: x, tick: 0.3 });
  }
  function sip(t) { K.at(t, () => {
    const g = K.gain(0, K.filter('bandpass', 1150, 2, fx)); K.env(g.gain, [[t, 0], [t + 0.05, 0.035], [t + 0.3, 0.029], [t + 0.38, 0]]);
    const tr = K.gain(0.5, g); K.osc('sine', 27, t, t + 0.4, K.gain(0.5, tr.gain)); K.noiseSrc(t, t + 0.4, tr, 'pink');
    K.sweep(t + 0.42, 0.14, { f0: 300, f1: 140, v: 0.04, a: 0.006, tau: 0.05, dst: fx });
    K.bell(t + 0.58, mtof(98), 0.012, fx, { parts: K.PARTS.celesta, pan: 0.2, tick: 0 }); K.bell(t + 0.66, mtof(102), 0.01, fx, { parts: K.PARTS.celesta, pan: 0.3, tick: 0 });
  }); }

  // ================= JS-rendered textures =================
  function drops(len, v, f0, f1, n = Math.round(len * 80)) {
    const gr = []; for (let i = 0; i < n; i++) { const f = f0 * Math.pow(f1 / f0, r()); gr.push({ t: r() * len, pan: (r() - 0.5) * 1.6, len: 0.05, fn: K.gChirp(f, f * (1.2 + 0.4 * r()), 0.03 + 0.02 * r(), 0.0008, 0.008 + 0.01 * r(), v * (0.3 + 0.7 * r())) }); }
    return K.grainBuffer(len + 0.08, gr);
  }
  function bubbles(len, n, v, f0, f1, tau = 0.03, blen = 0.08, swell = false) {
    const gr = []; for (let i = 0; i < n; i++) { const x = swell ? len * Math.sqrt(r()) : len * Math.pow(r(), 1.6), f = f0 * Math.pow(f1 / f0, r());
      gr.push({ t: x, pan: (r() - 0.5) * 1.2, len: blen + 0.04, fn: K.gChirp(f, f * (1.5 + 0.5 * r()), blen, 0.002, tau, v * (0.4 + 0.6 * r())) }); }
    return K.grainBuffer(len + 0.15, gr);
  }
  function crackle(len, rate, v) {
    const gr = []; for (let t = 0; t < len; t += 1 / rate * (0.3 + 1.4 * r())) gr.push({ t, pan: (r() - 0.5) * 1.4, len: 0.02, fn: K.gNoise(0.0005, 0.0015 + 0.004 * r(), v * Math.pow(r(), 2), 0.5 + 0.4 * r(), Math.round(t * 1000)) });
    return K.grainBuffer(len, gr);
  }
  // debris: bright ticks + tiny metal pings, dense at the start, thinning out
  function debris(len, n, v) {
    const gr = [];
    for (let i = 0; i < n; i++) { const x = len * Math.pow(r(), 1.8), a = v * (0.3 + 0.7 * r()) * Math.pow(1 - x / (len * 1.05), 1.5);
      gr.push(r() < 0.7 ? { t: x, pan: (r() - 0.5) * 1.6, len: 0.03, fn: K.gNoise(0.0005, 0.002 + 0.006 * r(), a, 0.9, 1200 + i) }
        : { t: x, pan: (r() - 0.5) * 1.6, len: 0.1, fn: K.gBell(2000 + 3500 * r(), [[1, 1, 0.03], [2.4, 0.5, 0.015]], 0.0006, a * 0.6, 0.1) }); }
    return K.grainBuffer(len + 0.1, gr);
  }
  // minmin-zemi: "miiin min min min min miii" (tonal ~3.2 kHz, rough AM), one phrase
  function minmin(f, rr) {
    const segs = [[0, 0.75, 1.0, 1.0]]; for (let k = 0; k < 5; k++) segs.push([0.95 + k * 0.33, 0.22, 0.85 + 0.15 * rr(), 1.04]); segs.push([2.65, 0.7, 0.75, 0.97]);
    const n = Math.round(3.5 * sr), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; let a = 0, fm = 1;
      for (const [s0, d, amp, up] of segs) if (t >= s0 && t < s0 + d) { const x = (t - s0) / d; a = amp * smooth(x / 0.12) * smooth((1 - x) / 0.25); fm = 1 + (up - 1) * x; }
      ph += 2 * Math.PI * f * fm / sr; y[i] = a * (Math.sin(ph) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 170 * t)) + 0.15 * Math.sin(2 * ph)); }
    const b = K.ctx.createBuffer(1, n, sr); b.copyToChannel(y, 0); return b;
  }
  // higurashi: "kana-kana-kana" — a run of falling pulses that slows down and fades
  function higurashi(f0, rr) {
    const np = 18 + Math.floor(rr() * 8), pulses = []; let t = 0.02; for (let k = 0; k < np; k++) { pulses.push(t); t += 0.075 + 0.065 * k / np; }
    const n = Math.round((t + 0.2) * sr), y = new Float32Array(n);
    pulses.forEach((p0, k) => { const amp = smooth((k + 1) / 3) * (1 - 0.7 * k / np), ff = f0 * (1 - 0.05 * k / np); let ph = 0; const i0 = Math.round(p0 * sr), m = Math.round(0.075 * sr);
      for (let i = 0; i < m && i0 + i < n; i++) { const x = i / sr, fr = ff * (1.04 - 0.16 * x / 0.075); ph += 2 * Math.PI * fr / sr; y[i0 + i] += amp * Math.sin(ph) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 380 * x)) * K.gEnv(i, 0.006, 0.03); } });
    const b = K.ctx.createBuffer(1, n, sr); b.copyToChannel(y, 0); return b;
  }
}
