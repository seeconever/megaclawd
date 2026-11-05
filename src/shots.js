// MEGA CLAWD · story beats + shot list (owner: engine). Single source of truth for picture, sound and QC.
// Times in seconds; frame = round(t * 24). Frame f shows film time f / 24. 36 shots, 82.0 s, 1968 frames.
export const FPS = 24, DURATION = 82.0, FRAMES = Math.round(DURATION * FPS);

// Story beats (sound + FX sync). Names are stable: departments key their timing off these.
export const CUES = {
  glint: 9.3,        // the glint in the syrup (s04)
  streak: 10.6,      // the white streak above the cumulus (s05)
  ignite: 12.4,      // plasma sheath ignites (s06)
  gulls: 14.2,       // gulls burst from the wires (s07)
  look: 16.4,        // Clawd looks up (s08)
  frown: 17.3,       // determined frown (s08)
  cupDown: 18.5,     // the cup on the bollard (s09)
  splash: 19.3,      // Clawd hits the water
  eyes: 23.0,        // the mecha's visor eyes light up
  seat: 25.2,        // Clawd drops into the pilot seat
  reactor: 27.3,     // the chest reactor ignites
  rise: 31.5,        // MEGA CLAWD rises
  levers: 40.4,      // levers shoved forward
  unfold: 42.0,      // nubs unfold into arms
  launch: 43.6,      // the leap + shockwave
  impact: 51.0,      // the catch (white flash)
  surge: 57.0,       // reactor surge
  crack: 60.0,       // meteor cracks (blue lightning)
  shatter: 61.6,     // the meteor bursts
  splashdown: 69.375, // splash-down in the bay (first hull contact on screen, f1665)
  wave: 71.875,      // the wave breaks on the seawall (first white water, f1725)
  smile: 74.6,       // visor eyes soften into a smile
  sip: 77.6,         // Clawd drinks the melted ice
  card: 78.5,        // end card
};

// id, t0, t1, set, owner, what (CONTRACT.md). set = what is on screen (the engine shows the matching set groups).
export const SHOTS = [
  ['s01', 0.0, 3.0, 'town', 'world', 'wide establishing: harbor town, cumulus, glittering sea; slow push in'],
  ['s02', 3.0, 5.0, 'town', 'world', 'rooftop: cat asleep on hot tiles, laundry, furin rings'],
  ['s03', 5.0, 8.5, 'pier', 'pilot', 'Clawd at the end of the pier with blue shaved ice, legs dangling; boats bob'],
  ['s04', 8.5, 10.0, 'pier', 'pilot', 'macro: spoon scoops ice; glint in the sky reflected in the syrup'],
  ['s05', 10.0, 12.0, 'sky', 'world', 'a tiny white streak high above the cumulus'],
  ['s06', 12.0, 14.0, 'space', 'meteor', 'the meteor tumbles into the atmosphere over the limb, plasma igniting'],
  ['s07', 14.0, 16.0, 'town', 'world', 'gulls burst from the wires, furin stops, the sky glows orange at one point'],
  ['s08', 16.0, 18.0, 'pier', 'pilot', 'CU Clawd looks up, spoon frozen; eyes widen, then a determined frown'],
  ['s09', 18.0, 19.5, 'pier', 'pilot', 'sets the cup on a bollard, jumps off the pier (splash)'],
  ['s10', 19.5, 22.5, 'under', 'water', 'Clawd sinks through luminous cyan with god rays toward the colossal shape'],
  ['s11', 22.5, 24.5, 'under', 'mecha', 'CU visor: two huge Clawd eyes light up amber, silt swirls'],
  ['s12', 24.5, 27.0, 'cockpit', 'pilot', 'Clawd drops into the pilot seat, panels light up, grips the levers'],
  ['s13', 27.0, 28.5, 'under', 'mecha', 'macro: chest reactor ignites blue, armour plates shift'],
  ['s14', 28.5, 31.5, 'bay', 'world', 'town in foreground; the bay bulges and boils, boats rock'],
  ['s15', 31.5, 35.5, 'bay', 'mecha', 'MEGA CLAWD rises: head, shoulders, sheets of water, kelp, gulls'],
  ['s16', 35.5, 38.0, 'pier', 'mecha', 'low angle from the pier: the giant against the sun, the cup trembles'],
  ['s17', 38.0, 40.0, 'sky', 'meteor', 'the meteor, huge and burning red, splits the cumulus into two walls'],
  ['s18', 40.0, 41.5, 'cockpit', 'pilot', 'CU Clawd, determined, shoves both levers forward'],
  ['s19', 41.5, 43.5, 'bay', 'mecha', 'crouch in the surf, nubs unfold into arms, sole thrusters flare blue'],
  ['s20', 43.5, 45.0, 'bay', 'mecha', 'LAUNCH: the leap; a shockwave flattens the sea in a ring of spray'],
  ['s21', 45.0, 48.0, 'sky', 'mecha', 'tracking: climbing through the cloud tops, blue thruster trails'],
  ['s22', 48.0, 50.0, 'strato', 'world', 'curve of the Earth; the meteor coming, Mega Clawd rising to meet it'],
  ['s23', 50.0, 51.0, 'strato', 'meteor', 'near silence: the two silhouettes about to meet'],
  ['s24', 51.0, 52.5, 'strato', 'mecha', 'IMPACT: the arms catch the meteor; white flash, shockwave ring'],
  ['s25', 52.5, 55.0, 'strato', 'mecha', 'strain: armour glowing hot, plates buckling, shoved back down'],
  ['s26', 55.0, 57.0, 'cockpit', 'pilot', 'red alarms, Clawd straining, levers shaking'],
  ['s27', 57.0, 59.0, 'strato', 'mecha', 'reactor surge: blue light runs along the panel lines into the arms'],
  ['s28', 59.0, 61.5, 'strato', 'mecha', 'pushes the meteor up; it cracks, blue lightning in the cracks'],
  ['s29', 61.5, 64.0, 'strato', 'meteor', 'the meteor bursts into thousands of glowing fragments'],
  ['s30', 64.0, 67.0, 'town', 'world', 'dusk: shooting stars over the town; the cat watches'],
  ['s31', 67.0, 69.0, 'sky', 'mecha', 'Mega Clawd falls back, smoking, armour cooling, stars around it'],
  ['s32', 69.0, 71.0, 'bay', 'water', 'splash-down in the bay: a colossal plume'],
  ['s33', 71.0, 73.5, 'bay', 'world', 'the wave rolls toward the town, breaks on the seawall, spray over the pier'],
  ['s34', 73.5, 75.5, 'bay', 'mecha', 'Mega Clawd kneels in the bay, steaming; visor eyes soften into a smile'],
  ['s35', 75.5, 78.5, 'pier', 'pilot', 'soaked Clawd climbs onto the pier, drinks the melted ice, happy; shooting stars'],
  ['s36', 78.5, 82.0, 'card', 'engine', 'end card: Fable 5.5 brush lettering + 寓話 seal, MEGA CLAWD 巨神'],
].map(([id, t0, t1, set, owner, what], i) => ({ id, i, t0, t1, set, owner, what, f0: Math.round(t0 * FPS), f1: Math.round(t1 * FPS) }));

export const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
// shot containing film time t (frame-exact: uses the frame index so cuts land on whole frames)
export function shotAt(t) { const f = Math.round(t * FPS); return SHOTS.find(s => f >= s.f0 && f < s.f1) || SHOTS[SHOTS.length - 1]; }
// time of a point inside a shot: k = 0 first frame, 1 last frame
export const shotTime = (id, k = 0.5) => { const s = SHOT[id]; return (s.f0 + Math.round(k * (s.f1 - 1 - s.f0))) / FPS; };

// Where each set lives (visibility groups the engine toggles). Department content goes into ctx.sets.<group>.
//   coast  = town + harbour + pier + bay surface (one geography: pier end at the origin, see docs/ARCHITECTURE.md)
//   under  = the underwater bay (same coordinates as coast, below y = 0)
export const SET_GROUPS = { town: ['coast'], pier: ['coast'], bay: ['coast'], under: ['under'], cockpit: ['cockpit'], sky: ['sky'], strato: ['strato'], space: ['space'], card: [] };
export const GROUPS = ['coast', 'under', 'cockpit', 'sky', 'strato', 'space'];
