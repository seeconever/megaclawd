# MEGA CLAWD · engine architecture

The film is one three.js (r160, WebGL2) scene graph drawn through a custom multi-pass pipeline. Every frame is a pure
function of film time `t` (frame `f = t × 24`), so frames render in any order and the headless render is resumable.
Production rules (story, shots, art direction, ownership) live in [CONTRACT.md](../CONTRACT.md); this file is the
technical manual every department works against.

## Files (owner: engine unless noted)

| file | what |
|---|---|
| `index.html` | live scrub page (dev). Import map → `vendor/three` (no CDN) |
| `src/main.js` | boot, `ctx`, module loading, `pose(t)` / `render(t)`, `window.__mc` API for the tools |
| `src/pipeline.js` | the pass chain (`Pipeline`), `BASE_LOOK`, `mergeLook` |
| `src/pipeline-passes.js` | full-screen shaders: paint, ink, atmosphere, grade, present, debug |
| `src/pipeline-glsl.js` | MRT patch `mrt()`, `patchShader()`, shared GLSL (noise, cel shadow, overlay soft depth), material ids |
| `src/pipeline-materials.js` | `celMaterial`, `bgMaterial`, `fxMaterial`, `overlayMaterial`, `toonClawd`, `LIGHT` rig |
| `src/pipeline-kit.js` | painted sky, cloud cards / banks / floor, stars, glow sources, light shafts, end card |
| `src/pipeline-solids.js` | collision registry used by `tools/check.mjs` |
| `src/pipeline-util.js` | `onTwos`, `onThrees`, `rng`, easing, `curve`, `bump`, `spring` |
| `src/shots.js` | `SHOTS` (36), `CUES`, `SET_GROUPS` |
| `src/cams/index.js` | camera + look registry, placeholder cameras, set looks (day → dusk) |
| `src/cams/<team>.js` | **teams**: `CAMS` and `LOOKS` for the shots they own |
| `src/<team>.js` | **teams**: department modules (see the API below); engine placeholders until replaced |
| `src/assets/clawd/` | the mascot (GLB, `clawd.js`, emotion JSON) copied from `mascot/` so the repo is self-contained |
| `src/ui.js`, `player/player.html` | live UI (scrub, play, shot track) and the single-file player template |
| `tools/` | snap, render, render-audio, encode, build-player, check, sheet, lookdev (see below) |

## Passes

| pass | what | knobs (`LOOK`) |
|---|---|---|
| shadow | orthographic depth map of `ctx.shadowRoots` only (characters); cel + bg materials drop to their shade tone inside it (hard edge, 4 taps) | `shadow: { center, radius, dir?, k, bias }` (null = off) |
| reflection | mirrored camera across `y = water.level`, half res, everything below the plane discarded; objects with `userData.noReflect` hidden | `water: { on, level }` |
| main (MRT) | 2 targets, MSAA 4: **colour** (rgb HDR linear, **a = paint mask**) + **data** (view normal xy, linear depth m, material id) | `background` (clear colour) |
| paint | structure tensor → anisotropic Kuwahara on **BG pixels only**, depth-aware (taps from other depths / cel pixels get no weight), brush strokes along the structure, wobbly edges, pigment + hue drift, paper fibres; all noise anchored to the world point (sky: view direction) | `paint: { k, radius, stroke, wobble, vary, hue, paper, depthK }` |
| ink | lines on **CEL pixels only** (ids 1-99): silhouettes (neighbour farther than the surface slope predicts, near side only), inner lines at id changes and normal creases (thinner); width in px @1080 × `(focus / depth)^0.3`, pressure noise anchored to the world; ink = dark ink mixed with the darkened local colour | `ink: { k, width, min, max, ref, color, tint, press, inner, normThr }` |
| water slot | departments add full-screen passes: `ctx.pipeline.addPass('water', { material, enabled?(look), update?(look, t) })` | |
| atmosphere | height haze (aerial perspective, brighter toward the sun), low sea mist, screen-space light shafts from a world point | `haze`, `mist`, `shafts: { on, pos, k, thr, occ, radius, tint }` |
| overlay | the `ctx.overlay` scene (drawn energy, lightning, water FX), after paint + ink, soft depth test vs the main pass | |
| bloom | UnrealBloom on HDR values (> threshold) | `bloom: { strength, radius, threshold }` |
| grade | halation, chromatic softness, exposure, soft knee, saturation, split tone (lavender shadows / warm highs), lift, contrast, vignette, paper tooth (camera-anchored), film grain, **flash** (impact white), **fade** | `grade: { expo, sat, knee, contrast, vignette, grain, paper, halation, shTint, hiTint, tint, flash, flashCol, fade, fadeCol }` |

`BASE_LOOK` in `src/pipeline.js` holds every default. A frame's look = `BASE_LOOK` ← set look (`src/cams/index.js`,
coast sets blend day → dusk over 63-66 s) ← the owner's `LOOKS[shot]` ← `?look={json}`. `LOOK.passes.<name> = false`
turns a pass off. `LOOK.sun / amb / rim / hero` drive the shared light rig; `hero` is the anime character key (lights
cel characters independently of the sun; Clawd uses it).

## Materials and ids

* **Colour alpha = paint mask**: 1 = painted background (gets the gouache pass), 0 = clean (characters, props, FX, lettering).
* **Data id**: `0` BG (painted, never inked) · `1-99` CEL, inked (give the parts of one character different ids so lines
  fall at plate boundaries; `mat.nextId()` hands out 10-89; 7/8/9 = Clawd body / nubs / legs) · `100-199` cel without
  ink (decals, faces, lettering) · `200+` FX.
* `celMaterial(color, { id, ink, shade, hi, hero, hiT, hiAmt, spec, bevel, rimI, lock, recvShadow, map, emissive, side, wet, glow })`:
  two hard tones (lit = base × key, shade = cool lavender-blue `shadeOf(base)` × ambient), crisp highlight band, shaped
  spec on bevels (`bevel` = bevel radius in metres: 0.1 for Clawd-size props, ~6 for the 120 m mecha), anime rim.
* `bgMaterial(color, opts)`: same model, softer terminator, brush + pigment, id 0, mask 1.
* `fxMaterial(color, { k, additive, opacity, map, fresnel })`: HDR emissive (k > 1 blooms), id FX.
* `overlayMaterial({ color, k, map, additive, soft })` for `ctx.overlay`; custom overlay shaders use `ctx.glsl.OVERLAY`
  (`softDepth(viewDepth, soft)`) with the `tSceneData` / `uRes` uniforms from `ctx.glsl.U`.
* Any other material (built-ins, your own `ShaderMaterial`) is made MRT-capable automatically (`ensureMRT`, as BG id 0);
  call `ctx.mat.mrt(material, { id, normal, sky })` to choose. **Transparent materials write data = 0** and leave depth
  and ids untouched under normal / additive / premultiplied blending: glows never break the ink or the haze.
* Patching an engine material's shader: `ctx.glsl.patchShader(material, 'uniqueKey', (shader) => { ... })` (it keeps
  the program cache honest; a plain `onBeforeCompile` override can silently share another material's program).
* Texture `repeat` works on cel/bg maps (`uMapRep`).
* The renderer uses a logarithmic depth buffer (pier at 2 m and the town at 2 km in one frame; strato shots). Data depth
  is clamped to 60 km; anything farther than 30 km is treated as sky by the passes.

## Department module API

```js
// src/<team>.js
export async function create(ctx) {            // once; may await assets
  const g = new ctx.THREE.Group(); ctx.sets.coast.add(g);   // or ctx.scene / ctx.overlay
  return {
    update(t, shot) { },                       // pose everything for film time t (pure; hide what is not in the shot)
    afterCamera(t, shot) { },                  // optional: after the camera is placed (billboards, screen-facing FX)
    dispose() { },
    anchor(name) { },                          // whatever other departments need (published as ctx.modules.<team>)
  };
}
```
`shot = { id, t0, t1, set, owner, what, lt, d, k, t, f, groups, look }` (`lt` seconds into the shot, `k = lt / d`).
`ctx = { THREE, scene, overlay, sets, layers, camera, renderer, pipeline, mat / materials, kit, glsl, light, util,
water: { reflection }, shadowRoots, solids, onTwos, onThrees, rng(seed), cues, shots, shot, shotTime, FPS, DURATION,
FRAMES, asset(path), json(path), loadClawd(opts), label(text, obj), modules, state, q, scale, W, H }`.
Update order: world, sky, ocean, under, pilot, cockpit, mecha, meteor, fx-energy, fx-water (audio has no picture).
Rules: no `Math.random` / `Date` / accumulated state (use `rng(seed)`, `hash`, `curve`); characters on twos
(`ctx.onTwos(t)`), water FX on threes, camera and light on ones; never edit another team's file.

## Sets

`SHOTS[i].set` → visibility groups (`SET_GROUPS`): `town | pier | bay → coast`, `under`, `cockpit`, `sky`, `strato`,
`space`, `card` (end card, engine). The engine shows only the current shot's groups (`LOOK.show: ['sky']` adds more);
put set content into `ctx.sets.<group>`. Objects used across sets (Clawd, the mecha, the meteor) live in `ctx.scene` and
their owner toggles `visible`.

Provisional geography (metres, y up; world/mecha/water agree changes through the director):
coast — sea level y = 0, pier end at the origin, deck top y = 2.2, pier to the seawall at z = -42, town on the slope
toward -z, hills ~1 km back, bay toward +z, mecha site ~ (0, 0, 220). under — same frame, floor deepening to y ≈ -86 at
z = 250 where the mecha lies. sky — cloud layer 1.5-3.5 km. strato — y = altitude (35 km), Earth centre (0, -6371 km, 0).
space — same, ~120 km. cockpit — local, seat at the origin. Scales: Clawd body 0.5 m wide, MEGA CLAWD ~120 m, meteor ~1 km.

## Cameras and looks

`src/cams/<team>.js`: `export const CAMS = { s05: (lt, d, t, st) => ({ pos, look, fov, roll?, near?, far? }) }` and
`export const LOOKS = { s05: (lt, d, t, st) => ({ ...partial LOOK }) }`. `st = { shot, k, ctx }`, so a camera can
track `st.ctx.modules.mecha.anchor('head')`. Until a team fills its file, `DEFAULT_CAMS` in `src/cams/index.js` plays.
`near` defaults to 1 % of the camera-to-target distance, `far` to 60 km.

## Water, shadow, collisions

* Water: turn on `LOOK.water` and read `ctx.water.reflection = { texture, matrix, level, on }` (project the world point
  with `matrix`, sample `texture`). Mark the sea surface `userData.noReflect = true`.
* Shadow: push character roots into `ctx.shadowRoots`; set `LOOK.shadow = { center, radius }` around the contact area.
* Collisions: `ctx.solids.add(name, obj, { kind: 'box' | 'sphere' | 'points', group, pad, groups })`,
  `ctx.solids.allow(a, b, tol)` for intended contact, `ctx.solids.rest(a, on, { tol, when })` for "stands on".
  `tools/check.mjs` reports penetrations per shot.

## Tools

WORK = `%LOCALAPPDATA%\Temp\cmv-32\<team>` (or `MC_WORK`, else `./WORK/<team>`). Every tool takes `--team <name>`
(port range and WORK subfolder: engine 8930, mecha 8940, pilot 8950, world 8960, meteor 8970, water 8980, sound 8990).

| command | what |
|---|---|
| `node tools/snap.mjs --scale 1 s:s16 s:s16@0 t:41 f:300 all all3 "q:cam=0,60,300&at=0,60,0&fov=35&t=10=name:x" --sheet name --measure` | stills (+ contact sheet, Clawd hue) |
| `node tools/render.mjs [--from --to --chunk 96 --order shuffle --step 4 --scale]` | resumable PNG frames; run several in parallel |
| `node tools/render-audio.mjs` | `audio.html` → `soundtrack.wav` + `.m4a` |
| `node tools/encode.mjs [--crf 16]` | frames + WAV → H.264 High yuv420p BT.709 24 fps + AAC, faststart |
| `node tools/build-player.mjs` | `dist/megaclawd.html` + `dist/megaclawd_lite.html` (everything inlined) |
| `node tools/check.mjs [--only s15,s16] [--frames frames]` | page errors, collisions, luma jumps > 25 tv, blank / frozen frames |
| `node tools/sheet.mjs --dir <dir>` | contact sheet of a folder |
| `node tools/lookdev.mjs` | `docs/engine-lookdev.jpg` |

URL (`index.html`): `?t= | ?f= | ?shot=s16@0.5 | ?scale=1|2|4 | ?play=1 | ?cam=x,y,z&at=x,y,z&fov= | ?groups=coast,sky |
?look={json} | ?debug=id|depth|normal|mask|raw | ?labels=1 | ?<team>=0 | ?grain=0 | ?render=1`.

## Gotchas found while building the engine

* A camera inside a terrain or a house shows one flat colour: check `?debug=depth`.
* Kuwahara inverse tone map and haze of a bad depth made single 65504 pixels that bloom turns into white squares: the
  passes now clamp; if you see a square glow, probe your material's depth / colour for NaN.
* `onBeforeCompile` overrides on engine materials must use `patchShader` (program cache).
* Cloud cards use alpha-to-coverage (opaque, depth-writing): they haze correctly and hide cel objects behind them.
* Under the water there is no sky: set `LOOK.background` (the under look uses the haze colour).
