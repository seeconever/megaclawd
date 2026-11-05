# MEGA CLAWD · 巨神 — the prompt

Paste everything below the line into Fable 5.5 (Claude Code, a machine with a GPU, Node 20+ and ffmpeg). Our run had
the Clawd mascot model (clawd.glb + emotion library) in the folder; without it, Clawd is built from the description
below. Series: Fable 5.5 Anime Lab.

---

Make an 82-second theatrical anime short, **MEGA CLAWD · 巨神**, entirely in code, from this one prompt. three.js in the
browser, every frame rendered by code, every sound synthesized. No video model, no image model, no stock art, no audio
samples, no hand-drawn frames. Run it like a studio: you are the director. Build the engine first, then run agent teams
in parallel, and have an independent art director check every team's work before you accept it.

## WHAT TO DELIVER

1. **MegaClawd.mp4**: 1920×1080, 24 fps CFR, 82.0 s = 1968 frames, H.264 High yuv420p BT.709 (tagged, tv range),
   AAC 192k 48 kHz, faststart.
2. **A single offline HTML player**: one file with three.js, every module, every asset and the soundtrack inlined. It
   plays the film live in WebGL2 with a scrub bar and a shot track (a full 1080p build and a lite 960×540 build).
3. **A public-ready repo**: `index.html` (live scrub: `?t= ?f= ?shot=s16 ?scale= ?play=1 ?cam=x,y,z&at=x,y,z&fov=
   ?look={json} ?debug=id|depth|normal|mask|raw`), `src/` (engine + one module per department), `tools/` (stills,
   resumable render, audio render, encode, player build, QC, contact sheets), `CONTRACT.md` (production bible),
   `README.md`, MIT `LICENSE`, three.js r160 vendored (no CDN), `npm run build` = audio → film → player → mp4.

## STYLE REFERENCE

A bright summer theatrical anime blockbuster: the skies, cumulus and glittering sea of a Ghibli / Shinkai summer film,
the weight and scale of classic super-robot anime, FX drawn like hand-painted effect cels. Cel characters with ink
over gouache painted backgrounds. Bright, saturated, high-key. Drama comes from scale and contrast, never from darkness.

## LENGTH, SHOTS, CHARACTERS

82 s, 36 shots, 24 fps, wordless (no dialogue, no subtitles). Cast: little Clawd (the pilot), MEGA CLAWD (the giant),
the meteor, the town. Animals: a calico cat and gulls. No people anywhere.

**Clawd**: a 0.5 m vinyl-toy creature, terracotta `#D97757` (hue 13-18, never orange, never pink). One wide rounded
block is his head and body (W 1.0 : H 0.74 : D 0.56, soft bevel); a flat face with two big glossy black eyes with
white highlights and a small mouth; two round side nubs as arms; four short stubby legs. All acting is in the face
(build an expression library: happy, surprised, shocked, determined, strain / squint, gritted, relief, starry, gentle)
and the body (squash, lean, nub gestures). Cel + ink like everything else. On model in every shot.

**MEGA CLAWD** (~120 m tall, body ~120 × 90 × 72 m): a heavy anime mecha in Clawd's exact silhouette. The same wide
rounded block (head and torso are one block), four short heavy armoured legs, two side nubs. Terracotta armour plates,
overlapping, sculpted, bevelled; cream and charcoal secondary plates; bronze joints; panel lines, bolts, vents, hazard
stripes, edge chips and grime; hand-lettered markings `CLAWD-01` and `巨神`. The face is a dark glass visor where
Clawd's eyes and mouth appear as glowing amber displays (the same shapes as Clawd's expressions). A faceted crystal
reactor below the visor glows blue. Blue thrusters in the soles. From s19 the side nubs telescope out into big armoured
arms with three-finger clamp hands. Barnacles and kelp on it in the bay, ripped away in the sky. Every plate is real
geometry, readable from every angle.

**The cockpit** (inside the head): a round cabin ~3 m across, a bucket seat on a hydraulic post, two control levers
whose grips are sockets for Clawd's nubs, a curved console with hand-lettered screens (cyan line-art on deep navy,
amber accents, red when the alarm runs), button banks, an overhead panel with warning lamps and a red beacon, a hatch
in the ceiling, the big curved visor window with a HUD on the glass and the outside world beyond it.

**The meteor** (~1 km): knapped dark basalt, a polyhedron of big flat cuts and chips (not a noisy potato), glowing
red-orange fissures along facet edges, a banded white-hot leading face. On entry: a plasma sheath (bow shock of
orange-white fire), a long burning trail, drawn two-tone smoke. At the climax it cracks with blue lightning, then bursts
into chunks with molten cores and thousands of glowing fragments that become shooting stars.

**The town**: an original Japanese seaside town on green hills. ~600 houses with kawara tile roofs (gable, hip, pent),
plaster and dark wood walls, balconies with laundry, shop awnings, TV antennas; telephone poles with sagging wires; a
vermilion shrine torii on the hill with stone steps; a school; a fish market; a vending machine with a made-up brand; a
porch with a glass furin wind chime. A harbour: a seawall with steps down to the pier, tetrapods, two breakwaters with
red and white lighthouses, small fishing boats with squid lamps riding the swell. A wooden pier (planks, piles with a
weed line, iron bollards, an end ladder, a lamp post). Wooded headlands close the bay.

**The cup**: a paper shaved-ice cup (white paper, red 氷 flag motif, blue waves) heaped with blue-syrup ice, and a
spoon-straw. By s35 the ice has melted into blue water.

## ART DIRECTION (take literally)

- **Bright, high-key theatrical anime blockbuster.** A blazing summer day: deep-blue sky, towering white cumulus with
  lavender shadow sides, cobalt-to-turquoise sea, white foam, saturated colour. Underwater = luminous cyan with god
  rays, never black. The ending is a warm colourful dusk with shooting stars.
- **Cel anime**: two hard tones + a crisp highlight, cool lavender-blue shadows, confident ink lines with pressure
  variation, gouache painted backgrounds (Kuwahara-type brush filter on background pixels only).
- **Dense detail, real volume**: sculpted silhouettes, panel lines, bolts, markings, wear. No flat sprites pasted on 3D
  for main subjects. Contact and scale must read.
- **Timing**: characters on twos (12 drawings/s), water FX on threes, camera on ones. Held key poses, snappy accents.
  Huge things move slowly and heavily.
- **Every shot has one readable action.** A viewer always understands what is happening and why.

## SCENE (shot by shot; times in seconds, frame = round(t × 24))

- **s01 · 0.0–3.0 · town.** Wide establishing from over the bay: the harbour town climbing green hills, tiled roofs,
  the torii on the hill, breakwaters and lighthouses, fishing boats, gulls gliding. Towering cumulus fills a deep-blue
  sky; sun glitter on the cobalt sea. Slow push in toward the pier.
- **s02 · 3.0–5.0 · town.** Rooftop: a calico cat asleep on hot pent-roof tiles (breathing, an ear flick), laundry
  flapping on a balcony pole, the furin on the porch rings, its paper strip swinging.
- **s03 · 5.0–8.5 · pier.** Clawd sits at the very end of the pier, legs dangling over turquoise water, the cup of
  blue shaved ice in his nub, happy, swaying a little. Boats bob behind him.
- **s04 · 8.5–10.0 · pier.** Macro: the spoon scoops ice; at 9.3 a bright glint from the sky flares in the glossy
  blue syrup.
- **s05 · 10.0–12.0 · sky.** Looking up past the cumulus into deep blue: at 10.6 a tiny white streak draws a line high
  above the clouds.
- **s06 · 12.0–14.0 · space.** Over the planet's bright limb the meteor tumbles into the atmosphere; at 12.4 its
  plasma sheath ignites into a bow shock and a long burning trail.
- **s07 · 14.0–16.0 · town.** At 14.2 the gulls burst from the quay wires, the furin stops dead, and behind the roofs
  one point of the sky glows orange.
- **s08 · 16.0–18.0 · pier.** CU Clawd: at 16.4 he looks up, spoon frozen halfway; eyes widen; at 17.3 a determined
  frown.
- **s09 · 18.0–19.5 · pier.** At 18.5 he carefully sets the cup on an iron bollard (a little pat), turns and jumps off
  the end of the pier: crown splash at 19.3.
- **s10 · 19.5–22.5 · under.** Clawd sinks through luminous cyan, bubbles streaming up, god rays fanning down, the
  pier piles behind. Below, past a rocky drop-off, a colossal shape in his silhouette lies on the sandy bed, covered in
  kelp and barnacles.
- **s11 · 22.5–24.5 · under.** CU the giant's dark visor, tiny Clawd swimming in front of it: at 23.0 two huge Clawd
  eyes light up amber; silt swirls off the armour.
- **s12 · 24.5–27.0 · cockpit.** At 25.2 Clawd drops through the ceiling hatch into the seat; the screens boot one by
  one, the HUD wakes on the visor glass; he grips the two levers with his nubs.
- **s13 · 27.0–28.5 · under.** Macro: at 27.3 the chest reactor ignites blue, light pulses out, armour plates shift
  and lock, silt bursts.
- **s14 · 28.5–31.5 · bay.** Town in the foreground (roofs, wires, seawall); out in the bay the sea bulges and boils
  into a white dome; the boats rock.
- **s15 · 31.5–35.5 · bay.** MEGA CLAWD rises: the top of the head and the amber visor, then the shoulders. Sheets of
  water pour off every plate, kelp hangs, gulls scatter. Slow and heavy: it takes the whole shot.
- **s16 · 35.5–38.0 · pier.** Low angle from the pier: the giant towers against the sun, water raining down; in the
  foreground the ice cup on the bollard trembles.
- **s17 · 38.0–40.0 · sky.** The meteor, now huge and burning red, splits a cumulus massif into two walls, hot orange
  light inside the clouds.
- **s18 · 40.0–41.5 · cockpit.** CU Clawd, determined; at 40.4 he shoves both levers forward; the HUD locks onto the
  meteor.
- **s19 · 41.5–43.5 · bay.** The giant crouches in the surf; at 42.0 the nubs unfold into arms with clamp hands; the
  sole thrusters flare blue under the water.
- **s20 · 43.5–45.0 · bay.** LAUNCH at 43.6: it leaps; a shockwave flattens the sea in a ring of spray.
- **s21 · 45.0–48.0 · sky.** Tracking shot: MEGA CLAWD climbs through the cloud tops, blue thruster trails, the sea
  far below, the last kelp torn away.
- **s22 · 48.0–50.0 · strato.** The curve of the Earth, deep-blue sky; the burning meteor coming in, MEGA CLAWD
  rising to meet it.
- **s23 · 50.0–51.0 · strato.** Near silence: the two silhouettes about to meet against the limb.
- **s24 · 51.0–52.5 · strato.** IMPACT at 51.0: the hands catch the meteor; a white flash (ramped over 3 frames),
  impact lines, a shockwave ring spreading through the clouds below.
- **s25 · 52.5–55.0 · strato.** Strain: armour glowing hot orange on the meteor side, plates buckling, sparks at the
  hands; the meteor shoves the giant back down.
- **s26 · 55.0–57.0 · cockpit.** Red alarms, screens red, the beacon spinning; Clawd straining (squint, gritted
  teeth), the levers shaking in his nubs.
- **s27 · 57.0–59.0 · strato.** At 57.0 the reactor surges: blue light runs along the panel lines from the chest into
  the arms.
- **s28 · 59.0–61.5 · strato.** MEGA CLAWD pushes the meteor up; at 60.0 it cracks, blue lightning crawling in the
  cracks.
- **s29 · 61.5–64.0 · strato.** At 61.6 the meteor bursts into thousands of glowing fragments spreading across the
  sky.
- **s30 · 64.0–67.0 · town.** Dusk (the sky blends to warm orange, pink and violet over 63-66 s): the fragments fall
  as a shower of shooting stars over the town; the cat on the roof sits up and watches.
- **s31 · 67.0–69.0 · sky.** MEGA CLAWD falls back, smoking, the armour cooling from orange back to terracotta, stars
  streaking around it.
- **s32 · 69.0–71.0 · bay.** Splash-down at 69.2: a colossal plume of white water.
- **s33 · 71.0–73.5 · bay.** The wave rolls toward the town and breaks on the seawall at 71.8, spray over the pier.
- **s34 · 73.5–75.5 · bay.** MEGA CLAWD kneels in the bay, steaming; at 74.6 its visor eyes soften into a smile.
- **s35 · 75.5–78.5 · pier.** Soaked Clawd climbs the ladder onto the pier, dripping; finds the cup on the bollard:
  the ice has melted into blue water. At 77.6 he drinks it anyway, happy. Shooting stars above.
- **s36 · 78.5–82.0 · card.** End card: "Fable 5.5" in brush lettering, a red 寓話 seal, the title MEGA CLAWD 巨神.

Put these in one file (`src/shots.js`): `SHOTS` (id, t0, t1, set, owner, what) and `CUES` (glint 9.3, streak 10.6,
ignite 12.4, gulls 14.2, look 16.4, frown 17.3, cupDown 18.5, splash 19.3, eyes 23.0, seat 25.2, reactor 27.3, rise
31.5, levers 40.4, unfold 42.0, launch 43.6, impact 51.0, surge 57.0, crack 60.0, shatter 61.6, splashdown 69.2, wave
71.8, smile 74.6, sip 77.6, card 78.5). Picture, sound and QC all read this one clock.

## SOUND (synthesized, no samples)

Web Audio on an `OfflineAudioContext`, rendered to WAV, deterministic (seeded noise only). An original orchestral
score built on one summer motif in D major: felt piano, strings and harp at the start; the meteor interrupts it on an
unresolved E; under the sea a choir and harp; the motif returns as a heroic brass call when MEGA CLAWD rises and
launches; near silence at 50-51 s (one string harmonic, a heartbeat); impact tutti, a grinding strain, a lift on the
surge into a glory chord on the shatter; the motif softly at dusk; it resolves E → D exactly on Clawd's sip; once more
on a music box under the end card. Sound design locked to SHOTS and CUES: surf, cicadas, wind, the furin, gulls,
splashes, bubbles, the reactor, servos, thrusters, the launch, the impact, alarms, lightning, the shatter, the
splash-down, the wave. Ambience changes on the exact frame of every cut. The world goes underwater (low-pass) or into
the cockpit hull with the picture. Master to -14 LUFS integrated, true peak ≤ -1 dBTP. You can't hear, so measure:
loudness per section, spectrum, cue onsets vs CUES, clicks; re-check the WAV and the AAC with ffmpeg's EBU R128.

## ENGINE (build this first)

One three.js scene graph, a custom multi-pass pipeline:
shadow (character-only shadow map, painted lighting) → mirror reflection for the sea → main pass with MRT (colour +
data buffer: view normal, linear depth, material id) → **paint** (depth-aware anisotropic Kuwahara on background pixels
only, brush strokes along the structure, paper grain anchored to the world, sky to the view direction) → **ink** (on
cel pixels only: silhouettes from depth, inner lines at id changes and normal creases, pressure noise anchored to the
world, width by distance) → water passes → **atmosphere** (height haze, sea mist, light shafts) → **overlay** scene
(drawn energy, lightning, water FX, soft depth test) → **bloom** → **grade** (halation, lavender shadows / warm highs,
contrast, vignette, grain, impact flash, fade).
Conventions: material id classes (background / inked cel / cel without ink / FX); transparent materials never write
depth or ids (glows never break the ink or the haze); a logarithmic depth buffer (a 2 m pier and a 2 km town in one
frame, and the stratosphere); units in metres. Sets as visibility groups (coast, under, cockpit, sky, strato, space,
card). Every frame is a pure function of film time: no `Math.random`, no `Date`, no state carried between frames, so
frames render in any order and the render is resumable and parallel. A collision registry: every team registers its
solids, a check tool poses every frame and reports penetrations.
Department module API: `create(ctx) → { update(t, shot), afterCamera?(t, shot), dispose(), ...anchors }`, published as
`ctx.modules.<team>` so teams hand each other positions (the cup on the bollard, the seat, the meteor's contact facet,
splash points). Per-team camera and look files (`src/cams/<team>.js`) override placeholder cameras.
The film must play end to end with placeholders before any department starts.

## HOW TO RUN THE TEAMS

1. **Engine** (first, alone): repo skeleton, vendored three.js, the pipeline, materials, `src/shots.js`, the camera /
   look registry, a placeholder module for every department, the tools (snap, render, render-audio, encode,
   build-player, check, sheet), a lookdev sheet (one still per set). Freeze and document the module API.
2. **Six departments in parallel**, each owning its files and its shots' cameras, never editing another team's file
   (requests go to the director): **mecha** (s11 s13 s15 s16 s19 s20 s21 s24 s25 s27 s28 s31 s34), **pilot** (Clawd,
   the cup, the cockpit: s03 s04 s08 s09 s12 s18 s26 s35), **world** (town, harbour, pier, sea surface, skies, clouds,
   stratosphere, Earth: s01 s02 s05 s07 s14 s22 s30 s33), **meteor** (meteor + all energy FX: plasma, reactor,
   thrusters, shockwaves, lightning, shatter, shooting stars: s06 s17 s23 s29), **water** (underwater bay, splashes,
   sheets, plume, wave, spray: s10 s32), **sound** (the whole film); the engine / director owns s36 (end card) and
   integration. A shot can contain other teams' assets: the owner
   sets camera and look, the others deliver through their module API. Each team keeps a status section current so work
   can resume after a limit.
3. **Independent art director per department**: a fresh agent that did not build the work. It gets only this
   prompt's standards, the department's stills (first / middle / last frame of each shot at 1080p) and the check
   report; for sound: the render-audio report (loudness per section, spectrum, cue onsets, R128) and a sound sheet
   image. It judges every shot against the ANIME QUALITY STANDARD and IT MUST NOT LOOK LIKE and returns a ranked fix
   list. The department fixes and re-renders. Up to two fix rounds; whatever is still weak goes to the director.
4. **Director integration**: reconcile geography (pier, seawall, sea floor, mecha site), cross-team contacts (Clawd in
   the seat, nubs on the levers, the cup on the bollard, the hands on the meteor, splash positions on the water), set
   looks across cuts, sound on the cues, the end card. Full-film check: 0 page errors, 0 collisions, luma rules.
5. **Render**: frames in parallel (resumable chunks), check the rendered frames, encode the MP4, build the player,
   write the README with real numbers.

## ANIME QUALITY STANDARD

- Cel shading: exactly two hard tones + one crisp highlight band on characters and the mecha; shade tones are cool
  lavender-blue, not grey and not black. A hero key light for characters, independent of the sun.
- Ink: visible, confident outlines with pressure variation, thicker on silhouettes, thinner inside; lines fall at
  plate boundaries; no crawling or broken ink on distant objects (swap far props to painted versions).
- Backgrounds: gouache, with visible brush structure and paper; the paint pass touches background pixels only.
  Characters, props, lettering and FX stay clean.
- Clawd: ink outline visible, terracotta hue 13-18 in every lighting (measure it), face readable in every shot he is in.
- Timing: characters on twos, water FX on threes, camera on ones. Anticipation, overshoot, settle. Holds on key
  poses. Giants move slowly; small things snap.
- FX are drawn like effect cels: flat colour bands with hard edges around white-hot cores; water as cel masses with 2-3
  tones, a highlight and a backlit rim, drops with crisp edges.
- Scale reads: haze on distance, the town and boats as rulers next to the giant, water and gulls sized to scale.
- Collisions: nothing passes through Clawd, the mecha, the boats, the pier or the props. Feet rest on the ground,
  hands grip the levers and the meteor, the cup sits on the bollard. Run the collision check before every report.
- Luma: high-key. No frame-to-frame jump above 25 tv levels except the impact and shatter flashes, and those ramp over
  2-3 frames. No blank or frozen frames.
- Every frame should pass as a still from a theatrical anime film.

## IT MUST NOT LOOK LIKE

- CGI: glossy plastic, PBR reflections, smooth gradient shading, ambient-occlusion soup.
- Boxes and primitives: untextured blocks for houses, a sphere meteor, a scaled-up toy as the mecha.
- Vector or clip art: flat fills with no paint, no ink, no volume.
- Murk: dark, grey, desaturated, foggy, a bloom haze over everything, a black ocean.
- Floating or sliding: props hovering above surfaces, feet sliding, a cup that isn't touching the bollard, hands that
  don't touch the levers.
- Clipping: anything passing through anything.
- 2D sprites pasted on 3D for the main subjects; cardboard clouds with visible edges.
- Particle mush for fire, water or energy; noise-ball explosions.
- 60 fps smoothness on characters; tweened, floaty animation; jitter.
- Screen-anchored paper or grain that slides over the moving image ("shower door").
- People, real brands, real logos, on-screen text other than the hand-lettered markings, the cockpit screens and the
  end card.
- A video-game HUD over the film.

## WHAT YOU ARE FREE TO CHANGE

Camera angles, lenses and compositions; exact timing inside a shot as long as the cues hold; the number of houses,
boats and clouds; extra background life (sparrows, a crab on the pier, a fish school); extra expressions for Clawd; the
arrangement of the score. Not free: the story order, the cup at both ends, MEGA CLAWD in Clawd's silhouette, no people,
82 s / 36 shots / 24 fps / 1920×1080, the end card.

## THE LOOP: render → inspect frames → fix

Never report a shot as done from reading code. For every shot: render stills at full 1080p (first, middle and last
frame), open them and look at them, make a contact sheet of all 36 shots, measure (Clawd's hue, mean luma, collisions,
page errors), and ask: would this pass as a frame from a theatrical anime film? Is the action readable? Does the scale
read? Is anything floating or clipping? If not, fix it and render again. Keep looping until every frame is right.
After the full render, check every rendered frame (luma jumps, blank, frozen), look at the frames around every cut and
every cue, watch the MP4 at 24 fps, and compare the sound report with the cues. Then ship: the MP4, the single-file
player and the repo.
