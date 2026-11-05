// MEGA CLAWD · 巨神 — SOUND (owner: sound): the fully synthesized soundtrack, locked to SHOTS and CUES (src/shots.js).
// No samples: an original orchestral score (src/audio-score.js) + sound design (src/audio-sfx.js) built from the synth
// kit (src/audio-kit.js) on a Web Audio OfflineAudioContext, then mastered in JS (src/audio-master.js).
// API
//   create()                                      no picture (the engine loads every department; audio draws nothing)
//   renderSoundtrack(oac, { cues, shots, duration })  builds the whole graph on an OfflineAudioContext (2 ch, 48 kHz);
//                                                 the caller runs oac.startRendering(). Returns { marks, cues }: the foley
//                                                 events that are not CUES (name, t, bands) and the cues as played
//                                                 (CUES after the picture sync, see PICTURE), for the analysis
//   masterSoundtrack(L, R, sr)                    -> { L, R, ... } at MIX.target LUFS, true peak <= MIX.ceiling dBTP
//   analyze(L, R, sr, { shots, cues, gain, marks })  loudness / phone / band gains / spectrum / onsets / clicks
// audio.html wires these together; tools/render-audio.mjs writes the WAV + m4a. Deterministic: seeded noise only, no
// Math.random / Date; two renders differ only by float32 rounding in Chrome's mixer (<= -79 dBFS, `--verify`).
// Every time is a CUE or SHOT[id].t0 / t1 plus an offset: if the engine moves a cut or a cue, the sound follows.
//
// Mix: music (dry + "wet" choir/harp/bells) -> hall reverb -> air shelf; world (ambience + sfx + big hits) -> one filter
// that goes underwater (650 Hz) or into the cockpit hull (1.1 kHz) with the picture -> 32 Hz high-pass -> room / vast
// reverbs -> sub shelf -> soft clip; `pass` = world sounds that skip the picture filter (the eyes' relay under the sea)
// but keep its reverb; cockpit interior (dry) bus unfiltered; a quiet bus that survives the near-silence (50-51 s) when
// everything else is ducked to -40 dB. Before the big hits everything takes a short breath (a 6-8 dB dip, 100-150 ms).
// Cue -> sound map: CUES in src/shots.js; analysis sheet: docs/team-sound.jpg.
import { createKit, smooth } from './audio-kit.js';
import { score } from './audio-score.js';
import { sfx, shotLevel } from './audio-sfx.js';
import { master, analyze } from './audio-master.js';
export { analyze };

export const MIX = { target: -14, ceiling: -2.5 };   // engine draft: -1.8 gave AAC -0.5 dBTP; -2.5 keeps the AAC under -1   // -1.8 dBTP on the WAV: the AAC (player, MP4) adds ~0.6 dB, stays under -1 dBTP
const UNDER = ['s10', 's11', 's13'], COCKPIT = ['s12', 's18', 's26'];
// level per shot (dB), music and world. A hierarchy, not a plateau: summer (s01-s09) sits ~4-5 dB under the action
// (momentary ~-18, max -15 after the -14 LUFS normalisation), under the sea and dusk 1.5-3 dB down; the build-ups
// (s14, s16-s19, s22, s25-s28) sit under their payoffs; the launch is the second loudest moment and the impact the first
// (at the impact the world carries the hit and the orchestra sits under it: two full-level stems summing made the peaks)
const MUS_DB = { s01: -3.5, s02: -7, s03: -6.5, s04: -5, s05: -3.5, s06: -5, s07: -5.5, s08: -5.5, s09: -5.5, s10: -2, s11: -4, s12: -2, s13: -6,
  s14: -6, s15: -6.5, s16: -7, s17: -7, s18: -4.5, s19: -8, s20: -3, s21: -5, s22: -6, s24: -3, s25: -5, s26: -4, s27: -6.5, s28: -8, s29: -5.5,
  s30: -9, s31: -2, s32: -2, s33: -3.5, s34: -2, s35: -3.5, s36: -2 };
const WORLD_DB = { s01: -3.5, s02: -7, s03: -6.5, s04: -5, s05: -3.5, s06: -4, s07: -4.5, s08: -5.5, s09: -5.5, s10: -2, s11: -3.5, s12: -1.5, s13: -4,
  s14: -2, s15: -1.5, s16: -2, s17: -3, s18: -1, s19: -4.5, s20: -1, s21: -3, s22: -2, s24: -1.4, s25: -1.5, s26: -1, s27: -2, s28: -3, s29: -1.3,
  s30: -1.5, s31: -1.5, s32: -1, s33: -3.5, s34: -2, s35: -2.5 };
const dbg = (d) => Math.pow(10, d / 20);

// picture sync: events whose picture lands later than their CUE (measured on the frames). The sound follows the picture,
// t = max(CUE, shot.t0 + dt), so once the engine moves the CUE there (or later) the CUE wins and this is a no-op.
//   splashdown  mecha.js s32 pose (falls from shot.t0, keyed to the shot, not the cue): first contact + foam ring f1665
//   wave        the crest is whole on f1724, first white water on f1725 (water FX on threes)
export const PICTURE = { splashdown: ['s32', 0.375], wave: ['s33', 0.875] };
export function syncCues(cues, shots) {
  const SH = Object.fromEntries(shots.map(s => [s.id, s])), out = { ...cues };
  for (const [k, [id, dt]] of Object.entries(PICTURE)) if (k in out && SH[id]) out[k] = Math.max(out[k], +(SH[id].t0 + dt).toFixed(4));
  return out;
}

export function create() { return { update() {}, dispose() {} }; }

export async function renderSoundtrack(oac, { cues, shots, duration, solo = null }) {
  const K = createKit(oac, { seed: 3232 }), D = duration, C = syncCues(cues, shots), SH = Object.fromEntries(shots.map(s => [s.id, s]));
  const S = (n) => K.stereo(n), out = S(K.gain(1)), hp = S(K.filter('highpass', 24, 0.6, oac.destination)); out.connect(hp);

  // duck: everything but the quiet bus (reverb returns included) drops to -40 dB for the near silence (s23, back on the
  // impact frame), and takes a breath before the big hits: [cue, breath length, dip dB] (a 30 ms fade down, back up in
  // the last 6 ms before the cue, under the hit's attack)
  const SIL0 = SH.s23.t0, BREATH = [[C.eyes, 0.1, -6], [C.rise, 0.1, -5], [C.launch, 0.15, -8], [C.crack, 0.06, -4], [C.shatter, 0.15, -7]];
  const breath = (t) => { let g = 1; for (const [c, len, d] of BREATH) if (t > c - len - 0.03 && t < c) g *= dbg(d * smooth((t - (c - len - 0.03)) / 0.03) * (1 - smooth((t - c + 0.006) / 0.006))); return g; };
  const duckFn = (t) => breath(t) * (t > SIL0 && t < C.impact ? 0.01 + 0.99 * (1 - smooth((t - SIL0) / 0.035)) : 1);
  // music: per-shot level, -6 dB under Clawd's splash (until the cut under the sea), dips under the splash-down + wave
  const musShot = shotLevel(shots, Object.fromEntries(shots.map(s => [s.id, { g: dbg(MUS_DB[s.id] || 0) }])), 'g', 0.15);
  const musDuck = (t) => duckFn(t) * musShot(t) * (1 - 0.5 * smooth((t - C.splash + 0.04) / 0.02) * (1 - smooth((t - SH.s10.t0) / 0.3)))
    * (1 - 0.55 * smooth((t - C.splashdown + 0.05) / 0.12) * (1 - smooth((t - C.wave - 1.2) / 1.5)));

  // ---- music: dry + wet (choir, harp, bells) -> hall; muffled under the sea ----
  const musOut = S(K.gain(1, out)); K.curve(musOut.gain, 0, D, musDuck, 1000);
  const musAir = S(K.filter('highshelf', 4500, 0.707, musOut, 3.5));   // air on the orchestra (the saw ensembles are lowpassed dark)
  const musLP = S(K.filter('lowpass', 20000, 0.6, musAir));
  const mf = shotLevel(shots, Object.fromEntries(shots.map(s => [s.id, { f: Math.log(UNDER.includes(s.id) ? 2600 : 20000) }])), 'f');
  K.curve(musLP.frequency, 0, D, (t) => Math.exp(mf(t)), 200);
  const hall = K.reverb(K.ir(3.4, { rt60: 2.6, pre: 0.022, seed: 5 }), musLP, 1);
  const mus = S(K.gain(0.9, musLP)), wet = S(K.gain(0.8, musLP)); mus.connect(K.gain(0.2, hall)); wet.connect(K.gain(0.55, hall));

  // ---- world: ambience + sfx + big hits -> one filter that follows the picture (underwater / cockpit hull) -> 32 Hz
  // high-pass + low shelf (the sub layers cost headroom far beyond what they add in loudness) -> a soft peak clipper
  // (noise-like explosions hide it; quiet tonal sounds never reach the knee). Hits get their own clipper first. ----
  const worldShot = shotLevel(shots, Object.fromEntries(shots.map(s => [s.id, { g: dbg(WORLD_DB[s.id] || 0) }])), 'g', 0.15);
  const worldOut = S(K.gain(1, out)); K.curve(worldOut.gain, 0, D, (t) => duckFn(t) * worldShot(t), 1000);
  const worldClip = K.softClip(0.3, 0.58, worldOut), worldLow = S(K.filter('lowshelf', 80, 0.707, worldClip.input, -3.5));
  const worldHP = S(K.filter('highpass', 32, 0.7, worldLow)), worldLP = S(K.filter('lowpass', 20000, 0.7, worldHP));
  const wTable = Object.fromEntries(shots.map(s => [s.id, { f: Math.log(UNDER.includes(s.id) ? 650 : COCKPIT.includes(s.id) ? 1100 : 20000) }]));
  const wf = shotLevel(shots, wTable, 'f'); K.curve(worldLP.frequency, 0, D, (t) => Math.exp(wf(t)), 200);   // under the sea from the s10 cut
  const room = K.reverb(K.ir(1.3, { rt60: 0.8, pre: 0.008, bright: 0.7, seed: 11 }), worldLP, 1);
  const vast = K.reverb(K.ir(4.5, { rt60: 4.0, pre: 0.045, bright: 0.6, dark: 0.05, seed: 23 }), worldLP, 1);
  const clip = K.softClip(0.2, 0.4, worldLP), amb = S(K.gain(1, worldLP)), fx = S(K.gain(1, worldLP)), big = S(K.gain(1, clip.input));
  const pass = S(K.gain(1, worldHP)); pass.connect(K.gain(0.4, vast));
  const uwSend = K.gain(0, vast); K.curve(uwSend.gain, 0, D, (t) => 0.35 * Math.max(0, (Math.log(20000) - wf(t)) / (Math.log(20000) - Math.log(650))), 100);
  fx.connect(K.gain(0.12, room)); big.connect(K.gain(0.3, vast)); fx.connect(uwSend); amb.connect(uwSend);

  // ---- cockpit interior (not filtered), quiet bus (not ducked, dry) ----
  const dryOut = S(K.gain(1, out)); K.curve(dryOut.gain, 0, D, duckFn, 1000);
  const dry = S(K.gain(1, dryOut)); dry.connect(K.gain(0.15, room));
  const quiet = S(K.gain(1, out));
  if (solo) for (const [name, node] of [['music', musOut], ['world', worldOut], ['dry', dryOut], ['quiet', quiet]]) if (name !== solo) node.disconnect();   // stems for analysis

  // ---- build: persistent beds now, every voice just in time (checkpoints every STEP, LEAD ahead of its start) ----
  const bus = { mus, wet, quiet, amb, sfx: fx, big, dry, pass }, STEP = 0.5, LEAD = 0.1;
  K.deferred = true;
  score(K, bus, C, shots);
  const marks = sfx(K, bus, C, shots, D);
  K.flush(STEP + LEAD);
  for (let T = STEP; T < D; T += STEP) { const h = T + STEP + LEAD; oac.suspend(T).then(() => { K.flush(h); oac.resume(); }); }
  return { marks, cues: C };
}

export function masterSoundtrack(L, R, sr) { return master(L, R, sr, { target: MIX.target, ceiling: MIX.ceiling, fadeIn: 0.3, fadeOut: 0.7, clip: [-3.5, 3.3] }); }
