// MEGA CLAWD · 巨神 — the score (owner: sound). An original orchestral score synthesized with src/audio-kit.js, locked
// to CUES and SHOTS (src/shots.js): every time below is a cue or a shot's t0 / t1 plus an offset. One motif carries the
// film: a summer phrase in D major that the meteor interrupts on an unresolved E, returns as a heroic brass call when
// MEGA CLAWD rises and launches, comes back softly at dusk, resolves (E -> D) exactly on Clawd's sip, and plays once
// more on a music box under the end card.
//   A  s01-s04   summer: felt piano motif, strings, harp sparkle (D major, 80 bpm; the high A lands on the glint)
//   B  s05-s09   the meteor: Bb(#11) drone under the hanging E, space swell + timpani, look sting, frown horn call, run
//                (the roll and the run stop 80 ms before the splash: the splash is heard alone)
//   C  s10-s12   under the sea: choir "oo", harp (D lydian), the eyes' amber chord, cockpit pulse (G -> A) from the seat
//   D  s13-s16   awakening: Bb -> C brass + choir crescendo (reactor), D major tutti + heroic motif on the rise
//   E  s17-s19   threat: D minor ostinato (3+3+2), lever stabs, A dominant build cut 150 ms before the launch (a breath)
//   F  s20-s22   launch + climb: D major hit, driving 120 bpm, brass motif, Bb swell into the cut to silence
//   G  s23       near silence (quiet bus): one string harmonic, a heartbeat, the inhale
//   H  s24-s28   impact tutti, strain (half-step grind), cockpit pulse locked to the red beacons, surge lift
//                F -> G -> Bb -> C, cut 150 ms before the shatter
//   I  s29-s31   glory chord, then the motif at dusk (strings + piano, 76 bpm)
//   K  s34-s35   gentle ending: G -> A -> D, the motif resolves on the sip
//   L  s36       music box motif under the end card (the last D rings out before the fade)
// The tutti levels per shot are set in src/audio.js (MUS_DB): the impact is the loudest moment, not one more wall.
import { mtof } from './audio-kit.js';

// the motif: [beat, midi, beats] — D A G F# | E F# D | B D E A | E (hangs)
export const MOTIF = [[0, 74, 1], [1, 81, 1.5], [2.5, 79, 0.5], [3, 78, 1], [4, 76, 1.5], [5.5, 78, 0.5], [6, 74, 2], [8, 71, 1], [9, 74, 1], [10, 76, 1], [11, 81, 1], [12, 76, 4]];
// beacon half-period in s26 (src/cockpit.js: beacons pulse with sin(8t + ph), ph 0 / pi): pi / 8 s
export const BEACON = Math.PI / 8;

export function score(K, bus, C, shots) {
  const { mus, wet, quiet } = bus, SH = Object.fromEntries(shots.map(s => [s.id, s])), T0 = (id) => SH[id].t0, T1 = (id) => SH[id].t1;
  const P = (t, m, v, x = 0.08, len = 3) => K.piano(t, m, v, mus, x, len);

  // ---------------- A. summer (s01-s04) ----------------
  const bA = (b) => C.glint - 11 * 0.75 + b * 0.75;          // 80 bpm; beat 11 (the high A) = the glint
  [62, 66, 69, 74, 76, 78, 81, 86].forEach((m, i) => K.harp(T0('s01') + 0.25 + i * 0.085, m, 0.42 - i * 0.02, wet, -0.4 + i * 0.11));
  for (const [b, m, d] of MOTIF.slice(0, 11)) P(bA(b), m, b === 11 ? 0.42 : 0.6, 0.12, Math.max(2.2, d * 0.75 + 1.6));   // the high A on the glint 3 dB softer (the glint itself is the accent)
  P(bA(12), 76, 0.5, 0.12, 4.6);                              // the E that is left hanging
  const LH = [[50, 57, 64, 66, 69, 66, 64, 57], [47, 54, 61, 62, 66, 62, 61, 54], [43, 50, 57, 59, 66, 59, 57, 50]];
  LH.forEach((bar, k) => bar.forEach((m, i) => P(bA(k * 4 + i * 0.5), m, i === 0 ? 0.36 : 0.24, -0.15 + 0.04 * i, i === 0 ? 3.2 : 1.8)));
  P(bA(12), 46, 0.3, -0.2, 4); P(bA(12.5), 53, 0.2, -0.1, 3.5);
  for (const [b, m] of MOTIF.slice(7, 11)) K.bell(bA(b), mtof(m + 12), 0.016, mus, { parts: K.PARTS.celesta, pan: 0.3 });
  K.strings(T0('s01'), bA(4), [50, 57, 62, 66], { v: 0.03, a: 1.6, rel: 0.5, cut: 1500, dst: mus });
  K.strings(bA(4), bA(8), [47, 54, 62, 66], { v: 0.03, a: 0.5, rel: 0.5, cut: 1500, dst: mus });
  K.strings(bA(8), bA(12), [43, 50, 59, 62], { v: 0.032, a: 0.5, rel: 0.5, cut: 1600, dst: mus });

  // ---------------- B. the meteor (s05-s09) ----------------
  const T4 = bA(12), s06 = T0('s06'), s07 = T0('s07'), s08 = T0('s08');
  K.strings(T4, s06 + 0.1, [46, 53, 62, 64], { v: 0.034, a: 0.9, rel: 0.5, cut: 1100, trem: 0.25, dst: mus });
  K.strings(T4, C.splash - 0.1, [34], { v: 0.03, a: 2.5, rel: 0.05, cut: 380, dst: mus });
  K.strings(C.streak, s06, [88], { v: 0.008, a: 0.7, rel: 0.4, cut: 6000, trem: 0.4, tremHz: 9, vib: 4, dst: wet });
  K.brass(s06, s07 - s06, [38, 45, 50, 53], { v: 0.045, swell: true, mellow: true, rel: 0.12, dst: mus });
  K.strings(s06, s07 - 0.05, [50, 57, 62, 63], { v: 0.024, a: 1.5, rel: 0.1, cut: 3000, trem: 0.6, tremHz: 13, dst: mus });
  K.timpRoll(C.ignite, s07 - 0.03, 38, 0.04, 0.3, mus);
  // the cut to the town: a low hit, short brass (0.5 s) so 1-4 kHz is free for the gulls at C.gulls
  K.timp(s07, 38, 0.45, mus); K.drum(s07, 0.2, mus); K.brass(s07, 0.5, [34, 41, 46], { v: 0.07, mellow: true, rel: 0.3, dst: mus });
  K.strings(C.gulls + 0.4, C.look - 0.05, [81, 82], { v: 0.011, a: 0.8, rel: 0.1, cut: 5000, trem: 0.7, tremHz: 12, vib: 3, dst: mus });
  for (const dt of [0.9, 1.12, 1.72, 1.94]) K.timp(s07 + dt, 38, 0.18, mus);
  K.cymbal(s08 - 0.45, 0.85, 0.035, mus, { swell: true });
  K.timp(C.look, 38, 0.7, mus); K.brass(C.look, 0.6, [46, 50, 53, 58, 62], { v: 0.085, rel: 0.7, dst: mus });
  K.strings(C.look, C.frown, [58, 62, 65], { v: 0.025, a: 0.2, rel: 0.3, cut: 2400, trem: 0.4, dst: mus });
  [[C.frown, 50, 0.28], [C.frown + 0.3, 57, 0.28], [C.frown + 0.6, 62, 0.9]].forEach(([t, m, d]) => K.brass(t, d, [m, m - 12], { v: 0.075, mellow: true, rel: 0.35, dst: mus }));
  // the jump: snare roll from the leap + a string run up to the splash; both stop 80 ms before it (the splash is alone)
  const SP = C.splash - 0.08;
  K.strings(C.frown, SP, [38, 50], { v: 0.035, a: 0.25, rel: 0.04, cut: 900, dst: mus });
  const LEAP = T0('s09') + 0.78;   // pilot.js: the crouch ends and Clawd leaves the planks at s09 + 0.76
  for (let t = LEAP, i = 0; t < SP - 0.02; t += 0.045, i++) K.snare(t, 0.06 + 0.24 * (t - LEAP) / (SP - LEAP), mus, i % 2 ? 0.1 : -0.1);
  K.stringNotes([62, 64, 65, 67, 69, 70, 72, 74].map((m, i) => [SP - 0.47 + i * 0.058, m, 0.05, 0.6 + i * 0.07]), { v: 0.06, rel: 0.035, dst: mus });

  // ---------------- C. under the sea (s10-s12) ----------------
  const s10 = T0('s10'), s11 = T0('s11'), s12 = T0('s12');
  K.choir(s10 - 0.05, s11 + 0.15, [62, 66, 69, 73], { v: 0.05, a: 1.6, rel: 0.6, vowel: 'u', dst: wet });
  K.strings(s10 - 0.05, s12, [38, 45], { v: 0.028, a: 1.8, rel: 0.2, cut: 480, dst: mus });
  const ARP = [62, 69, 76, 80, 81, 76, 69, 74];
  for (let t = s10 + 0.45, i = 0; t < s12 - 0.2; t += 0.42, i++) if (Math.abs(t - C.eyes) > 0.12) K.harp(t, ARP[i % ARP.length] + (t > C.eyes ? -3 : 0), 0.3, wet, ((i * 0.37) % 1) * 1.2 - 0.6);
  K.choir(s11, C.eyes - 0.1, [64, 68, 71, 74], { v: 0.045, a: 0.4, rel: 0.06, vowel: 'u', dst: wet });   // 100 ms of air before the eyes
  for (const m of [74, 81, 86]) K.bell(C.eyes, mtof(m), 0.048, wet, { parts: K.PARTS.chime, pan: (m - 81) / 10 });
  K.choir(C.eyes, s12 + 0.1, [59, 62, 66, 71], { v: 0.06, a: 0.35, rel: 0.4, vowel: 'o', dst: wet });
  K.brass(C.eyes, 1.4, [47, 54], { v: 0.05, swell: true, mellow: true, rel: 0.4, dst: mus });
  // cockpit pulse (100 bpm eighths) starts when Clawd lands in the seat; the first beat -4 dB under the seat thump
  const b8 = 0.3, AUP = C.seat + 0.7;
  for (let t = C.seat, i = 0; t < C.reactor - 0.05; t += b8, i++) { const m = t < AUP ? 43 : 45, k = i === 0 ? 0.63 : 1; K.stringNotes([[t, m, 0.16, (i % 2 ? 0.7 : 1) * k], [t, m + 12, 0.16, 0.5 * k]], { v: 0.065, cut: 1500, dst: mus }); }
  K.strings(s12, AUP, [55, 59, 62], { v: 0.024, a: 0.4, rel: 0.2, cut: 1800, dst: mus });
  K.strings(AUP, C.reactor - 0.12, [57, 61, 64], { v: 0.028, a: 0.3, rel: 0.1, cut: 2000, dst: mus });

  // ---------------- D. awakening (s13-s16) ----------------
  const R = C.reactor, Cc = R + 2.1, s17 = T0('s17');
  K.brass(R, Cc - R, [34, 41, 46, 50], { v: 0.08, swell: true, rel: 0.1, dst: mus });
  K.choir(R, Cc, [58, 62, 65], { v: 0.06, a: 1.8, rel: 0.15, vowel: 'a', dst: wet });
  K.timpRoll(R + 0.4, Cc - 0.05, 46, 0.04, 0.3, mus);
  K.brass(Cc, C.rise - Cc, [36, 43, 48, 52], { v: 0.1, swell: true, rel: 0.08, dst: mus });
  K.choir(Cc, C.rise, [60, 64, 67, 72], { v: 0.075, a: 1.6, rel: 0.1, vowel: 'a', dst: wet });
  K.timpRoll(Cc, C.rise - 0.04, 48, 0.1, 0.35, mus);
  for (let t = Cc, i = 0; t < C.rise - 0.1; t += 0.25, i++) K.stringNotes([[t, i % 4 === 3 ? 43 : 36, 0.14, i % 2 ? 0.7 : 1]], { v: 0.06, cut: 1600, dst: mus });
  K.stringNotes([60, 62, 64, 65, 67, 69, 71, 72, 73].map((m, i) => [C.rise - 0.5 + i * 0.05, m, 0.06, 0.6 + i * 0.05]), { v: 0.07, dst: mus });
  K.cymbal(C.rise - 1.2, 1.2, 0.05, mus, { swell: true });
  // the rise: D major tutti + the motif in brass (72 bpm)
  const bD = (b) => C.rise + b * 60 / 72;
  K.timp(C.rise, 38, 0.35, mus); K.drum(C.rise, 0.2, mus); K.cymbal(C.rise, 3.0, 0.07, mus);
  for (const [b, m, d] of MOTIF.slice(0, 7)) { const len = d * 60 / 72 * 0.92; K.brass(bD(b), len, [m - 12], { v: 0.075, rel: 0.25, bright: 0.8, dst: mus, pan: -0.1 }); K.brass(bD(b), len, [m - 24], { v: 0.07, mellow: true, rel: 0.25, dst: mus, pan: 0.15 }); }
  const CH_D = [[bD(0), bD(4), [38, 45, 50, 54, 57]], [bD(4), bD(6), [43, 50, 55, 59, 62]], [bD(6), s17 - 0.05, [38, 45, 50, 54, 57, 62]]];
  for (const [t0, t1, ch] of CH_D) {
    K.strings(t0, t1, ch, { v: 0.05, a: 0.15, rel: 0.3, cut: 2600, dst: mus });
    K.choir(t0, t1, ch.slice(2).map(m => m + 12), { v: 0.06, a: 0.25, rel: 0.4, vowel: 'a', dst: wet });
    K.brass(t0, t1 - t0 - 0.1, ch.slice(0, 3), { v: 0.05, mellow: true, rel: 0.3, dst: mus });
    K.timp(t0, ch[0] < 40 ? 38 : 43, 0.5, mus);
  }
  K.timpRoll(s17 - 1.1, s17 - 0.05, 38, 0.1, 0.45, mus);

  // ---------------- E. threat (s17-s19) ----------------
  const s18 = T0('s18'), s19 = T0('s19'), BL = C.launch - 0.15;   // BL: the build stops here, a breath, then the launch
  K.timp(s17, 38, 0.4, mus); K.drum(s17, 0.2, mus); K.brass(s17, 0.9, [50, 53, 57, 62], { v: 0.09, rel: 0.6, dst: mus }); K.brass(s17, 0.9, [38, 45], { v: 0.04, mellow: true, rel: 0.6, dst: mus });
  K.cymbal(s17, 3.5, 0.05, mus, { f: 1800 });
  K.choir(s17, s18, [50, 53, 58], { v: 0.05, a: 0.5, rel: 0.4, vowel: 'o', dst: wet });
  const OST = [38, 38, 50, 38, 38, 50, 51, 38], ACC = [1, 0.6, 0.8, 1, 0.6, 0.8, 1, 0.6];
  for (let t = s17, i = 0; t < BL - 0.1; t += 0.25, i++) { const up = t >= s19 ? 7 : 0; K.stringNotes([[t, OST[i % 8] + up, 0.15, ACC[i % 8]]], { v: 0.075, cut: 1500, dst: mus, rel: t > BL - 0.4 ? 0.04 : 0.12 }); }
  K.brass(C.levers, 0.35, [50, 53, 57, 62], { v: 0.09, rel: 0.3, dst: mus }); K.timp(C.levers, 38, 0.6, mus);
  for (let t = C.levers, i = 0; t < s19 - 0.05; t += 0.05, i++) K.snare(t, 0.04 + 0.12 * (t - C.levers), mus, i % 2 ? 0.12 : -0.12);
  K.strings(s19, BL, [57, 61, 64, 69], { v: 0.04, a: 1.8, rel: 0.03, cut: 2000, trem: 0.5, tremHz: 13, dst: mus });
  K.brass(s19, BL - s19, [45, 52, 57, 61], { v: 0.11, swell: true, rel: 0.03, dst: mus });
  K.timpRoll(C.launch - 1.0, BL - 0.01, 45, 0.12, 0.55, mus);
  K.cymbal(C.launch - 1.1, BL - 0.05 - (C.launch - 1.1), 0.06, mus, { swell: true });
  K.stringNotes([62, 64, 66, 67, 69, 71, 73, 74, 76].map((m, i) => [BL - 0.45 + i * 0.05, m, 0.045, 0.6 + i * 0.05]), { v: 0.075, rel: 0.03, dst: mus });

  // ---------------- F. launch + climb (s20-s22) ----------------
  const L0 = C.launch, s21 = T0('s21'), s22 = T0('s22'), s23 = T0('s23');
  K.timp(L0, 38, 0.25, mus); K.drum(L0, 0.12, mus); K.cymbal(L0, 3.0, 0.06, mus);
  K.brass(L0, 1.1, [50, 54, 57, 62, 66], { v: 0.08, rel: 0.5, dst: mus }); K.brass(L0, 1.1, [38, 45], { v: 0.04, mellow: true, rel: 0.5, dst: mus });
  K.choir(L0, s21 + 0.1, [62, 66, 69, 74], { v: 0.065, a: 0.08, rel: 0.5, vowel: 'a', dst: wet });
  for (let t = L0 + 0.5, i = 0; t < s23 - 0.05; t += 0.25, i++) {
    const m = t < s21 + 2 ? 38 : t < s22 ? 43 : t < s22 + 1 ? 45 : 46;
    K.stringNotes([[t, i % 2 ? m + 12 : m, 0.15, i % 4 === 0 ? 1 : 0.7]], { v: 0.065, cut: 1700, dst: mus });
    if (i % 2 === 0) K.timp(t, m, i % 4 === 0 ? 0.32 : 0.16, mus);
  }
  const bF = (b) => s21 + b * 0.5;
  for (const [b, m, d] of MOTIF.slice(0, 7)) { const len = d * 0.5 * 0.9; K.brass(bF(b), len, [m - 12], { v: 0.09, rel: 0.2, bright: 1, dst: mus }); K.brass(bF(b), len, [m], { v: 0.05, rel: 0.2, bright: 0.7, dst: mus, pan: 0.2 }); }
  for (const [t0, t1, ch] of [[s21, s21 + 2, [50, 54, 57, 62]], [s21 + 2, s22, [50, 55, 59, 62]], [s22, s22 + 1, [49, 52, 57, 61]]]) K.strings(t0, t1, ch, { v: 0.04, a: 0.1, rel: 0.15, cut: 3000, dst: mus });
  K.brass(s22 + 1, s23 - s22 - 1.01, [34, 41, 46, 50, 53], { v: 0.08, swell: true, rel: 0.03, dst: mus });
  K.choir(s22 + 1, s23 - 0.02, [58, 62, 65, 70], { v: 0.05, a: 0.9, rel: 0.03, vowel: 'a', dst: wet });
  K.timpRoll(s22 + 1, s23 - 0.03, 46, 0.08, 0.4, mus);
  K.cymbal(s22 + 1.1, s23 - s22 - 1.12, 0.045, mus, { swell: true });

  // ---------------- G. near silence (s23), on the quiet bus ----------------
  K.strings(s23 + 0.03, C.impact - 0.02, [93], { v: 0.006, a: 0.3, rel: 0.02, cut: 7000, vib: 3, dst: quiet });
  K.drum(s23 + 0.35, 0.12, quiet, { f: 46, len: 0.6 }); K.drum(s23 + 0.62, 0.08, quiet, { f: 46, len: 0.5 });

  // ---------------- H. impact, strain, surge, crack (s24-s28) ----------------
  const I0 = C.impact, s25 = T0('s25'), s26 = T0('s26'), s28 = T0('s28');
  // the hit chord is voiced high (the low notes mellow and soft): its weight comes from the world's boom, its edge reaches phones
  K.timp(I0, 38, 0.3, mus); K.drum(I0, 0.15, mus, { f: 44, len: 2.2 }); K.cymbal(I0, 4.0, 0.08, mus, { f: 3200 });
  K.brass(I0, 0.8, [50, 53, 58, 62, 65], { v: 0.1, rel: 0.9, dst: mus }); K.brass(I0, 0.8, [38, 45], { v: 0.045, mellow: true, rel: 0.9, dst: mus });
  K.choir(I0, s25 + 0.1, [62, 65, 70, 74], { v: 0.085, a: 0.05, rel: 1.0, vowel: 'a', dst: wet });
  for (let t = s25, i = 0; t < s26 - 0.05; t += 0.5, i++) K.brass(t, 0.45, [38 + (i % 2), 50 + (i % 2)], { v: 0.06 + 0.012 * i, mellow: true, rel: 0.12, dst: mus });
  K.strings(s25, s26, [62, 63, 65], { v: 0.03, a: 0.8, rel: 0.2, cut: 2600, trem: 0.6, tremHz: 13, dst: mus, dyn: (t) => 0.6 + 0.4 * (t - s25) / (s26 - s25) });
  for (const [dt, v] of [[0.1, 0.4], [0.9, 0.3], [1.6, 0.45], [2.1, 0.35]]) K.timp(s25 + dt, 38, v, mus);
  // s26 cockpit: the pulse is locked to the red beacons (eighths = half a beacon half-period, on the beacon phase)
  for (let k = Math.ceil(s26 / (BEACON / 2)), i = 0; k * BEACON / 2 < C.surge - 0.05; k++, i++) K.stringNotes([[k * BEACON / 2, 38, 0.12, i % 2 ? 0.6 : 1], [k * BEACON / 2, 50, 0.12, 0.5]], { v: 0.07, cut: 1300, dst: mus });
  K.strings(s26, C.surge - 0.02, [74, 75], { v: 0.02, a: 1.6, rel: 0.05, cut: 4000, trem: 0.7, tremHz: 14, dst: mus });
  const S0 = C.surge, BS = C.shatter - 0.15;   // BS: the build stops here, a breath, then the shatter
  K.brass(S0, 1.0, [41, 48, 53, 57], { v: 0.1, swell: true, rel: 0.05, dst: mus });
  K.brass(S0 + 1.0, s28 - S0 - 1.0, [43, 50, 55, 59], { v: 0.11, swell: true, rel: 0.05, dst: mus });
  K.choir(S0, S0 + 1.0, [57, 60, 65], { v: 0.06, a: 0.6, rel: 0.05, vowel: 'a', dst: wet });
  K.choir(S0 + 1.0, s28, [59, 62, 67], { v: 0.07, a: 0.3, rel: 0.05, vowel: 'a', dst: wet });
  K.timpRoll(S0, s28 - 0.02, 41, 0.1, 0.5, mus);
  for (let t = S0, i = 0; t < BS - 0.1; t += 0.25, i++) { const m = t < S0 + 1 ? 41 : t < s28 ? 43 : t < C.crack ? 46 : 48; K.stringNotes([[t, i % 2 ? m + 12 : m, 0.15, i % 4 === 0 ? 1 : 0.7]], { v: 0.07, cut: 1800, dst: mus, rel: t > BS - 0.4 ? 0.04 : 0.12 }); }
  // the crack: the brass that lands on it starts 3 dB down for 150 ms (the rock's snap is heard first)
  const crackG = K.gain(1, mus); K.env(crackG.gain, [[C.crack - 0.01, 1], [C.crack, 0.71], [C.crack + 0.15, 0.71], [C.crack + 0.25, 1]]);
  const PUSH = [[s28, 62, 0.48, mus], [s28 + 0.5, 65, 0.48, mus], [C.crack, 67, 0.72, crackG], [C.crack + 0.75, 69, BS - C.crack - 0.78, mus]];
  for (const [t, m, d, dst] of PUSH) K.brass(t, d, [m, m - 12], { v: 0.085, rel: 0.03, dst });
  for (const [t0, t1, ch, dst] of [[s28, C.crack, [34, 46, 50, 53, 58], mus], [C.crack, BS, [36, 48, 52, 55, 60], crackG]]) {
    K.strings(t0, t1, ch.slice(1), { v: 0.045, a: 0.15, rel: 0.03, cut: 3000, dst: mus });
    K.choir(t0, t1, ch.slice(2).map(m => m + 12), { v: 0.06, a: 0.3, rel: 0.03, vowel: 'a', dst: wet });
    K.brass(t0, t1 - t0 - 0.03, ch.slice(0, 2), { v: 0.06, mellow: true, rel: 0.03, dst });
  }
  K.timp(C.crack, 48, 0.4, mus); K.timpRoll(C.crack + 0.8, BS - 0.01, 48, 0.12, 0.55, mus);
  K.cymbal(C.crack + 0.5, BS - 0.05 - C.crack - 0.5, 0.07, mus, { swell: true });

  // ---------------- I. glory, then the motif at dusk (s29-s33) ----------------
  const G0 = C.shatter, s30 = T0('s30'), s34 = T0('s34');
  K.timp(G0, 38, 0.35, mus); K.drum(G0, 0.15, mus); K.cymbal(G0, 3.5, 0.05, mus);
  K.brass(G0, 1.8, [38, 45, 50, 54, 57, 62, 66], { v: 0.065, rel: 1.4, dst: mus });
  K.choir(G0, s30 - 0.1, [62, 66, 69, 74, 78], { v: 0.045, a: 0.08, rel: 1.4, vowel: 'a', dst: wet });
  K.strings(G0, s30, [50, 57, 62, 66, 69, 74], { v: 0.036, a: 0.1, rel: 1.2, cut: 3200, dst: mus });
  [98, 93, 90, 86, 81, 78, 74, 69].forEach((m, i) => K.bell(G0 + 0.15 + i * 0.12, mtof(m - 12), 0.02, wet, { parts: K.PARTS.glock, pan: 0.5 - i * 0.12 }));
  const bI = (b) => s30 - 0.4 + b * 60 / 76;
  for (const [b, m, d] of MOTIF.slice(0, 7)) { const len = d * 60 / 76; K.stringNotes([[bI(b), m, len * 0.95, 0.9]], { v: 0.045, cut: 3200, a: 0.12, rel: 0.4, dst: mus, pan: 0.1 }); P(bI(b), m, 0.42, 0.15, 2.6); }
  for (const [t0, t1, ch] of [[bI(0), bI(4), [50, 57, 62, 66]], [bI(4), bI(6), [47, 54, 62, 66]], [bI(6), C.splashdown + 0.1, [43, 50, 59, 62]]]) {
    K.strings(t0, t1, ch, { v: 0.036, a: 0.7, rel: 0.5, cut: 1500, dst: mus });
    ch.forEach((m, i) => K.harp(t0 + i * 0.11, m + 12, 0.24, wet, -0.3 + i * 0.2));
  }
  K.strings(C.splashdown + 0.1, s34 + 0.1, [45, 52, 57, 61], { v: 0.02, a: 1.5, rel: 0.6, cut: 1000, dst: mus });

  // ---------------- K. gentle ending (s34-s35) ----------------
  const s35 = T0('s35'), A35 = s35 + 0.75;   // A35: the A chord, just after Clawd flops onto the deck (+0.65)
  K.strings(s34, C.smile, [50, 57, 62, 66], { v: 0.036, a: 0.8, rel: 0.3, cut: 1400, dst: mus });
  [50, 57, 62, 66].forEach((m, i) => P(s34 + 0.05 + i * 0.22, m, 0.26, -0.1 + i * 0.07, 2.6));
  K.strings(C.smile, A35, [43, 55, 59, 62], { v: 0.038, a: 0.5, rel: 0.3, cut: 1400, dst: mus });
  K.strings(A35, C.sip, [45, 57, 61, 64], { v: 0.04, a: 0.4, rel: 0.3, cut: 1500, dst: mus });
  K.strings(C.sip, C.card + 1.1, [38, 50, 57, 62, 66], { v: 0.042, a: 0.25, rel: 1.4, cut: 1600, dst: mus });
  for (const [t, m] of [[C.smile, 71], [C.smile + 0.75, 74], [A35, 76], [s35 + 1.35, 78], [s35 + 1.75, 76], [C.sip, 74]]) P(t, m, t === C.sip ? 0.6 : 0.52, 0.12, t === C.sip ? 3.8 : 2.6);
  [43, 50, 55].forEach((m, i) => P(C.smile + i * 0.12, m, 0.22, -0.2, 2.4));
  [45, 52, 57].forEach((m, i) => P(A35 + i * 0.1, m, 0.22, -0.2, 2.2));   // rolled before the first wet step (s35 + 1.0)
  [38, 50, 57, 62, 66, 69].forEach((m, i) => K.harp(C.sip + i * 0.07, m + 12, 0.28, wet, -0.4 + i * 0.16));

  // ---------------- L. music box under the end card (s36) ----------------
  // the motif once, from just before the card; the last D lands 1.7 s before the end and rings out under the fade
  const M0 = C.card - 0.1;
  for (const [dt, m] of [[0, 86], [0.4, 93], [0.95, 91], [1.15, 90], [1.5, 88], [1.7, 90], [1.9, 86]]) K.bell(M0 + dt, mtof(m), 0.021, wet, { parts: K.PARTS.musicBox, pan: 0.05, tick: 0.12 });
  for (const [dt, m] of [[0, 62], [0.95, 69], [1.5, 67], [1.9, 62]]) K.bell(M0 + dt, mtof(m), 0.013, wet, { parts: K.PARTS.musicBox, pan: -0.1, tick: 0.08 });
  K.strings(C.card + 0.1, C.card + 2.4, [50, 57, 62, 66], { v: 0.02, a: 1.2, rel: 0.9, cut: 1200, dst: mus });
}
