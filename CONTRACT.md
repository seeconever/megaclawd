# MEGA CLAWD · 巨神 — production contract

An 82-second, 24 fps, 1920×1080 anime short (36 shots, 1968 frames) rendered in the browser with three.js (WebGL2),
captured frame by frame with headless Chrome and encoded with ffmpeg. Original story, original designs.
Series: "Fable 5.5 Anime Lab". Repo-ready: this folder becomes a public GitHub repo at the end.

Read before you start: this file, our anime kit from the earlier Anime Lab films (cel Clawd, ink, painted BG, glow,
end card, render, sound, QC) and the mascot notes (`src/assets/clawd`). Do not edit anything outside this folder
(new mascot emotions only the documented way: add the JSON to `src/assets/clawd/emotions`).

## Art direction (take literally)
- **Bright, high-key theatrical anime blockbuster.** Blazing summer day: deep-blue sky, towering white cumulus with
  lavender shadow sides, cobalt-to-turquoise sea, white foam, saturated colour. Drama from scale and contrast, never murk.
  Underwater = luminous cyan with god rays. The ending is a warm dusk with shooting stars, still colourful.
- **Cel anime**: two hard tones + crisp highlight, cool lavender-blue shadows, confident ink lines with pressure variation,
  gouache painted backgrounds (Kuwahara-type brush filter on BG pixels only). Must NOT read as CGI, vector art, or boxes.
- **Dense detail, real volume**: sculpted silhouettes, panel lines, bolts, markings, wear. No flat 2D sprites pasted on 3D
  for main subjects. Contact and scale must read. Nothing clips, slides or floats (collision checks are mandatory).
- **Timing**: characters on twos (12 drawings/s), water FX on threes, camera on ones; held key poses, snappy accents;
  huge things move slowly and heavily.
- **Every shot has a readable action.** A viewer must always understand what is happening and why.

## Story
A blazing summer day in a small seaside town. Little Clawd sits at the end of the pier eating a cup of blue shaved ice.
A glint in the syrup: a meteor is entering the atmosphere, straight at the town. Clawd carefully puts his cup down on a
bollard and jumps into the bay. On the sea floor lies a colossal sleeping mecha built in his shape. Its eyes light up,
Clawd drops into the cockpit, and MEGA CLAWD rises from the bay with the sea pouring off its armour. It leaps, climbs
through the clouds to the edge of space and catches the burning meteor. The meteor shoves it back; the reactor surges
blue, Mega Clawd pushes, and the meteor bursts into a shower of harmless shooting stars over the town at dusk. Mega Clawd
falls back into the bay; the wave breaks on the seawall. Soaked little Clawd climbs onto the pier, finds his cup — the
ice has melted into blue water — and drinks it anyway, happy, under the shooting stars.

## Designs
- **Clawd (pilot)**: our mascot from the kit (`mascot/clawd.glb` via clawd.js), toon + ink per the kit. Terracotta,
  hue 13-18. Expressions from the emotion library (+ new ones the documented way).
- **MEGA CLAWD** (~120 m): a heavy anime mecha in Clawd's silhouette — the same wide rounded-block body (head and torso
  are one block), four short heavy armoured legs, two side "nubs". Terracotta armour plates (overlapping, sculpted,
  bevelled), cream and charcoal secondary plates, bronze joints, panel lines, bolts, hazard stripes, hand-lettered markings
  `CLAWD-01` + `巨神`. Front face: a dark glass visor where Clawd's eyes and mouth appear as glowing amber displays
  (same face shapes as the mascot emotions). Chest reactor: faceted crystal below the visor, glows blue. Soles: blue
  thrusters. The side nubs **unfold into big armoured arms with three-finger clamp hands** for the catch (s19 onwards).
  Barnacles/kelp on it in the bay scenes, washed off in the sky. On-model from every angle.
- **Meteor** (~1 km): jagged dark basalt with glowing red-orange fissures, white-hot leading face, plasma sheath and a
  long burning trail on entry; cracks with blue lightning at the climax; bursts into thousands of glowing fragments.
- **Town**: original Japanese seaside town — tiled roofs, telephone poles and wires, a shrine torii on the hill, laundry,
  a harbor with small fishing boats, a seawall, a wooden pier with iron bollards, a vending machine (made-up branding).
  No people. Animals: a sleeping cat on a roof, gulls, sparrows. A wind chime (furin) on a porch.

## Departments (each owns its files; never edit another team's files — ask the director via your report)
| team | owns | shots |
|---|---|---|
| engine (director) | `index.html`, `src/main.js`, `src/pipeline*.js`, `src/shots.js` (SHOTS, CUES), `src/cams/index.js`, `tools/`, `player/`, `package.json`, README | integration, s36 end card |
| mecha | `src/mecha*.js`, `src/cams/mecha.js` | s11 s13 s15 s16 s19 s20 s21 s24 s25 s27 s28 s31 s34 |
| pilot | `src/pilot*.js`, `src/cockpit*.js`, `src/cams/pilot.js` (Clawd, shaved ice, cockpit) | s03 s04 s08 s09 s12 s18 s26 s35 |
| world | `src/world*.js`, `src/ocean*.js`, `src/sky*.js`, `src/cams/world.js` (town, pier, sea surface, sky, clouds, stratosphere, Earth) | s01 s02 s05 s07 s14 s22 s30 s33 |
| meteor | `src/meteor*.js`, `src/fx-energy*.js`, `src/cams/meteor.js` (meteor, plasma, reactor charge, thrusters, shockwaves, lightning, shatter, shooting stars) | s06 s17 s23 s29 |
| water | `src/under*.js`, `src/fx-water*.js`, `src/cams/water.js` (underwater bay, rising sheets, splash, plume, wave, spray) | s10 s32 |
| sound | `src/audio*.js`, `audio.html`, `tools/render-audio.mjs` | whole film |
A shot listed under one owner can contain other teams' assets; the owner sets camera and look, the others deliver
assets through their module API (documented at the top of each file).

## Shots (times in seconds; frames = round(t*24))
| id | time | set | what happens |
|---|---|---|---|
| s01 | 0.0–3.0 | town | wide establishing: harbor town on green hills, towering cumulus, glittering sea; slow push in |
| s02 | 3.0–5.0 | town | rooftop: a cat asleep on hot tiles, laundry flapping, a furin rings |
| s03 | 5.0–8.5 | pier | Clawd at the end of the pier with a cup of blue shaved ice, legs dangling over the water, happy; boats bob |
| s04 | 8.5–10.0 | pier | macro: the spoon scoops ice; a bright glint in the sky reflected in the blue syrup |
| s05 | 10.0–12.0 | sky | a tiny white streak appears high above the cumulus |
| s06 | 12.0–14.0 | space | the meteor tumbles into the atmosphere over the planet's limb, plasma sheath igniting |
| s07 | 14.0–16.0 | town | gulls burst from the wires, the furin stops, one point of the sky glows orange |
| s08 | 16.0–18.0 | pier | CU Clawd looks up, spoon frozen; eyes widen, then a determined frown |
| s09 | 18.0–19.5 | pier | he carefully sets the cup on a bollard, then jumps off the pier into the sea (splash) |
| s10 | 19.5–22.5 | under | Clawd sinks through luminous cyan with god rays toward a colossal shape lying on the bay floor |
| s11 | 22.5–24.5 | under | CU the mecha's dark visor: two huge Clawd eyes light up amber, silt swirls |
| s12 | 24.5–27.0 | cockpit | Clawd drops into the pilot seat, panels light up, he grips the two levers with his nubs |
| s13 | 27.0–28.5 | under | macro: the chest reactor ignites blue, armour plates shift |
| s14 | 28.5–31.5 | bay | town in foreground; the bay bulges and boils, boats rock |
| s15 | 31.5–35.5 | bay | MEGA CLAWD rises from the bay: head, then shoulders; sheets of water pour off, kelp hangs, gulls scatter |
| s16 | 35.5–38.0 | pier | low angle from the pier: the giant towering against the sun, water raining down; the ice cup on the bollard trembles in the foreground |
| s17 | 38.0–40.0 | sky | the meteor, now huge and burning red, splits the cumulus into two walls |
| s18 | 40.0–41.5 | cockpit | CU Clawd, determined, shoves both levers forward |
| s19 | 41.5–43.5 | bay | Mega Clawd crouches in the surf, nubs unfold into arms, sole thrusters flare blue |
| s20 | 43.5–45.0 | bay | LAUNCH: it leaps; a shockwave flattens the sea in a ring of spray |
| s21 | 45.0–48.0 | sky | tracking shot: Mega Clawd climbs through the cloud tops, blue thruster trails |
| s22 | 48.0–50.0 | strato | curve of the Earth; the meteor coming in, Mega Clawd rising to meet it |
| s23 | 50.0–51.0 | strato | near silence: the two silhouettes about to meet |
| s24 | 51.0–52.5 | strato | IMPACT: the arms catch the meteor; white flash, shockwave ring through the clouds below |
| s25 | 52.5–55.0 | strato | strain: armour glowing hot, plates buckling, the meteor shoving it back down |
| s26 | 55.0–57.0 | cockpit | red alarms, Clawd straining (squint, gritted), levers shaking |
| s27 | 57.0–59.0 | strato | the reactor surges: blue light runs along the panel lines into the arms |
| s28 | 59.0–61.5 | strato | Mega Clawd pushes the meteor up; it cracks, blue lightning in the cracks |
| s29 | 61.5–64.0 | strato | the meteor bursts into thousands of glowing fragments spreading across the sky |
| s30 | 64.0–67.0 | town | dusk: the fragments fall as a shower of shooting stars over the town; the cat on the roof watches |
| s31 | 67.0–69.0 | sky | Mega Clawd falls back, smoking, armour cooling, stars around it |
| s32 | 69.0–71.0 | bay | splash-down in the bay: a colossal plume |
| s33 | 71.0–73.5 | bay | the wave rolls toward the town and breaks on the seawall, spray over the pier |
| s34 | 73.5–75.5 | bay | Mega Clawd kneels in the bay, steaming; its visor eyes soften into a smile |
| s35 | 75.5–78.5 | pier | soaked Clawd climbs onto the pier, finds the cup — melted into blue water — drinks it anyway, happy; shooting stars above |
| s36 | 78.5–82.0 | card | end card: "Fable 5.5" brush lettering + 寓話 seal, title MEGA CLAWD 巨神 |

## Engine (how it looks like anime) — engine team builds, everyone uses
three.js (WebGL2; vendored r160 in `vendor/`, no CDN), multi-pass:
| pass | what |
|---|---|
| shadow / reflection | character-only shadow map (painted lighting); mirrored camera for the sea |
| main (MRT) | colour + data buffer (view normal, depth, material id: bg / cel / fx) |
| paint | depth-aware Kuwahara brush filter on BG pixels only, paper grain anchored to world/camera direction |
| ink | ink lines on cel pixels only from id / depth / normal edges, pressure noise, thickness by distance |
| water | sea at kilometre scale: swell, whitecaps, glitter, foam, reflections |
| atmosphere | haze, spray, light shafts |
| overlay | drawn energy, lightning, water FX |
| bloom / grade | glow on emissives, high-key anime grade, film grain |
- Every frame is a pure function of time (`?t=` or frame index); frames render in any order; render is resumable.
- `src/shots.js`: `SHOTS` (id, t0, t1, set, owner, cam) and `CUES` (story beats for sound/FX: splash 19.3, eyes 23.0,
  reactor 27.3, rise 31.5, launch 43.6, impact 51.0, surge 57.0, shatter 61.6, splashdown 69.2, wave 71.8, sip 77.6).
- Tools: `tools/snap.mjs` (stills: by shot id, time, or query cam), `tools/render.mjs` (resumable segments → PNG),
  `tools/render-audio.mjs` (OfflineAudioContext → WAV), `tools/build-player.mjs` (single-file offline player:
  `dist/megaclawd.html` full + `dist/megaclawd_lite.html`), `tools/check.mjs` (collisions, luma jumps, blank/dup frames),
  `tools/sheet.mjs` (contact sheets). `npm run build` = audio → film → player → mp4.
- WORK = `%LOCALAPPDATA%\Temp\cmv-32\<team>`. Ports: engine 8930-8939, mecha 8940-8949, pilot 8950-8959,
  world 8960-8969, meteor 8970-8979, water 8980-8989, sound 8990-8999.

## Quality gates (every team, before reporting)
- Render your shots as stills (start / middle / end of each) at full res and look at them; compare with
  `anime-lab/ref/*.jpg`. If a frame doesn't look like a theatrical anime still, keep improving.
- Collision check: nothing passes through Clawd, the mecha, ships/boats, pier, props.
- Clawd: ink outline visible, 2 hard cel tones + highlight, terracotta hue 13-18, face readable.
- Luma jumps ≤ 25 tv levels per frame except at the impact/shatter flashes (ramp over 2-3 frames).
- Keep `STATUS.md` (team section) current so work can resume after a limit.
