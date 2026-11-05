# How MEGA CLAWD was made

MEGA CLAWD was built by agent teams in Claude Code, with Fable 5.5 as the model, organised like a small animation
studio: one director, an engine team, six departments, and an independent reviewer for each department. Everything they
shared lived in files: the production bible ([CONTRACT.md](../CONTRACT.md)), the engine manual
([ARCHITECTURE.md](ARCHITECTURE.md)), one status log per team (internal working notes, not part of this repo) and the
module API at the top of every source file. The full prompt is in [PROMPT.md](../PROMPT.md).

```
director ── CONTRACT.md (story, designs, art direction, 36 shots, ownership, quality gates)
   │
   ├─ 1. engine team ── pipeline, tools, module API, placeholders; the film plays end to end
   │
   ├─ 2. six departments in parallel ── mecha · pilot · world · meteor · water · sound
   │        │
   │        └─ 3. independent art director per department ── review → fixes (up to 2 rounds)
   │
   ├─ 4. director integration ── geography, cross-team contacts, looks across cuts, sound on cues
   │
   ├─ 5. draft render → human review → one fix pass
   │
   └─ 6. check → final render → encode → player → README
```

## 1. Director

The director session wrote `CONTRACT.md`: the story, the designs, the art direction, the 36 shots with times, which team
owns which files and shots, the engine passes and the quality gates every team must pass before reporting. It
dispatched the teams with short briefs, read their reports and decided anything that crossed team lines.

## 2. Engine first

One engine team built the foundation before anyone else started: the repo skeleton and vendored three.js r160, the
multi-pass anime pipeline (shadow, reflection, MRT main pass, paint, ink, water slot, atmosphere, overlay, bloom, grade),
the cel / paint / FX materials, `src/shots.js` (36 shots + the story cues), the camera and look registry, a placeholder
module for every department, and the tools (snap, render, render-audio, encode, build-player, check, sheet, lookdev).
The gate: the whole film plays end to end with placeholders, a lookdev sheet shows every set through the pipeline,
the check passes with 0 page errors, and the module API is frozen and documented. Not everything started from zero:
Clawd is the series' ready-made mascot (`clawd.glb` + its emotion library, copied into `src/assets/clawd`), and the
cel / ink / paint approach was ported from the kit of the earlier Anime Lab films.

## 3. Six departments in parallel

| team | owns | shots |
|---|---|---|
| mecha | `src/mecha*.js`, `src/cams/mecha.js` | s11 s13 s15 s16 s19 s20 s21 s24 s25 s27 s28 s31 s34 |
| pilot | `src/pilot*.js`, `src/cockpit*.js`, `src/cams/pilot.js` | s03 s04 s08 s09 s12 s18 s26 s35 |
| world | `src/world*.js`, `src/ocean*.js`, `src/sky*.js`, `src/cams/world.js` | s01 s02 s05 s07 s14 s22 s30 s33 |
| meteor | `src/meteor*.js`, `src/fx-energy*.js`, `src/cams/meteor.js` | s06 s17 s23 s29 |
| water | `src/under*.js`, `src/fx-water*.js`, `src/cams/water.js` | s10 s32 |
| sound | `src/audio*.js`, `audio.html`, `tools/render-audio.mjs` | the whole film |

Rules: a team edits only its own files; it hands things to other teams through its module API (anchors such as the
seat, the cup on the bollard, the meteor's contact facet, splash points); requests for another team's file go to the
director. Every team rendered stills of its own shots at full resolution, looked at them, ran the collision and luma
check, and kept its status section current so work could resume after a usage limit. Each team worked in its own port
range and work folder, so renders never collided.

## 4. Independent art director, up to two fix rounds

For each department a fresh agent that had not built the work reviewed it. It saw only the standards (art direction,
anime quality standard, the list of things the film must not look like), the department's stills (first / middle / last
frame of every shot) and the check report; for sound: the render-audio report (loudness per section, spectrum, cue
onsets, R128) and the `docs/team-sound.jpg` sheet. It returned a ranked list of fixes per shot. The department fixed and
re-rendered, and the reviewer looked again. At most two fix rounds; anything still weak went to the director.

| phase | agents |
|---|---|
| engine | 1 |
| department builds | 6 (the first run of 6 was killed by a network drop; 6 new agents resumed from the files on disk) |
| independent art-director reviews | 11 |
| department fix rounds | 10 |
| director integration | 1 |
| fix pass on the approved draft | 1 |
| final pass (render, check, players, README) | 1 |
| **total** | **31** (+6 dropped), about 8 hours of wall-clock time |

## 5. Director integration

The director pass joined the departments into one film: the shared geography (pier, seawall, sea floor, the mecha's
site), cross-team contacts (Clawd in the seat and on the levers, the cup on the bollard, the hands on the meteor, the
splashes on the water), looks that match across cuts (day → dusk), the soundtrack against the picture cues, and the
end card. Then the full-film check (`tools/check.mjs`): page errors, collisions of every registered solid, luma jumps
above 25 tv levels outside the two flashes, blank and frozen frames.

## 6. Draft, human review, one fix pass

The integrated film was rendered once as a draft and watched by a person, who approved it. One fix pass then took
only the worst reads from the director's own list of weak shots: the shaved ice soaked blue instead of plastic
white, the cockpit camera swinging round to show Clawd's face and both nubs on the levers, the wet armour back to
bright terracotta under a hero key, the fish scaled down next to Clawd, a closer s22 where the giant reads bigger under
the incoming meteor, and both hands on the meteor in the catch.

## 7. Render and ship

The final was rendered frame by frame in headless Chromium: about 0.32 s per frame at 1080p on an RTX 2060, two
processes in parallel, about 6 minutes for all 1968 frames. Every rendered frame was checked again: 0 page errors, 0
collisions between the 52 registered solids, no luma jump above 25 tv levels outside the two ramped flashes, no blank
or frozen frames. Then the frames were encoded with ffmpeg (H.264 High, BT.709, 24 fps, AAC) and the film was packed
into the single-file players in `dist/`. `npm run build` repeats the whole chain.

## What was hard

- **The network dropped in the middle of the department builds.** All six agents died at once. Because every team
  kept its code, its stills and its status log on disk, six fresh agents read those files and carried on from where
  the first ones stopped. Resumable files, not long agent memories, are what saved the run.
- **Reviews were cut after round 2 to ship a draft fast.** The departments were stopped mid fix-round and the director
  integrated their code as it stood. Some shots are still weaker than the rest: the clouds in s17 do not split into
  two walls, the s29 fragments read a little like toy polyhedra, and the s32 plume and the s33 wave are stiffer than
  the hand-drawn effects they imitate.
- **Showing a draft to a person early was worth more than a third review round.** The viewer approved the draft, so
  the last pass only had to fix the worst reads instead of reopening every shot.
- **One clock kept picture and sound together.** Every team read `CUES` in `src/shots.js`. The sound reviewer still
  caught two cues a few frames early; they moved to the first hull contact and the first white water.
- **Pure functions of time paid off.** Frames render in any order, so two processes split the film, a crashed render
  resumes, and determinism was checked by rendering the same frames in different orders.
