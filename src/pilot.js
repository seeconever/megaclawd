// =====================================================================================================================
// MEGA CLAWD · PILOT (owner: pilot) — little Clawd, the cup of blue shaved ice, the spoon-straw; Clawd's acting in every
// shot he appears in (pier s03 s04 s08 s09 s35, dive s10, cockpit s12 s18 s26). Cockpit set: src/cockpit.js.
// Clawd = the mascot from src/assets/clawd (GLB + emotion JSON), engine cel look (toonClawd: ink, 2 hard tones +
// highlight, palette lock -> body hue 13-18) + our cel finish / hull ink / face decals (src/pilot-look.js). Rig extensions (hips,
// nub IK, wrist, gaze): src/pilot-rig.js. Props + speed FX: pilot-props.js.
//
// API  ctx.modules.pilot = {
//   clawd, toon, rig, root            the mascot (root = world placement group; body width 0.5 m = CLAWD_SCALE)
//   cup, spoon                         prop objects (cup.group = THREE.Group, origin = centre of the cup bottom)
//   CLAWD_SCALE, spots                 { sit, stand, cupDeck, cupBollard, ladder, edgeZ, deckY, bollard }  (world, metres)
//   cupWorld(t) -> { pos: Vector3, onBollard: bool, melt }   where the cup is at film time t (s16 / s35 / any coast shot)
//   splash = { t: CUES.splash, pos: [x, 0, z] }               Clawd hits the water (s09), 2 m out from the pier face, clear of the ladder
//   anchor(name) -> Vector3            'head' | 'face' | 'mouth' | 'nubL' | 'nubR' | 'feet' | 'body' | 'cup' | 'spoon'
//   place({ pos, rotY, rotX, emo, pose, wet, visible })        another team poses Clawd in its own shot (call in your
//                                      update(); e.g. water s10). pose = rig.pose() params (armL, armR, squash, lean ...)
//   melt(t) -> 0..1                    how far the ice has melted (0 until the cup is set down, 1 by s35)
//   jumpPath(t) -> { k, c, rotX, vel } s09 leap: body pivot (world), somersault pitch, direction; continuous in t (camera on ones)
//   ladder, drips                      our pier ladder (only if the world has none) and the water drops off soaked Clawd
// }
// Geography (provisional, docs/ARCHITECTURE.md): pier deck top y = world.pier.deckY, pier end edge z = world.pier.end[2],
// bay toward +z. Clawd sits at the pier end beside the bollard nearest the ladder (the bollard is measured by raycast).
// Shadows: body / nubs / legs cast the cel shadow (face decals never do); the cup only while it rests on the deck or the
// bollard, the spoon never (no prop shadows printed across his face).
// Cockpit acting: nubs ease from a raised pose into the lever sockets (ctx.modules.cockpit.socket / alignSocket).
// Timing: Clawd + held props on twos (ctx.onTwos), camera on ones (src/cams/pilot.js).
// =====================================================================================================================
import * as THREE from 'three';
import { createRig, placeProp, aimY } from './pilot-rig.js';
import { makeCup, makeSpoon, makeLadder, makeDrips, makeGlint, makeFocusLines, makeStreaks, CUP } from './pilot-props.js';
import { clawdLook } from './pilot-look.js';

const V3 = THREE.Vector3, DEG = Math.PI / 180;
const PIER_SHOTS = ['s03', 's04', 's08', 's09', 's35'], COCK_SHOTS = ['s12', 's18', 's26'];

export async function create(ctx) {
  const { mat, util, cues } = ctx;
  const { sstep, clamp, lerp, ease, easeOut, easeIn, bump, curve, hash } = util;
  const CLAWD_SCALE = 0.5;
  const { clawd, toon } = await ctx.loadClawd();
  const root = new THREE.Group(); root.name = 'clawd'; root.add(clawd.root); clawd.root.scale.setScalar(CLAWD_SCALE); ctx.scene.add(root);
  root.rotation.order = 'YXZ';
  const rig = createRig(clawd, { scale: CLAWD_SCALE });
  const look = clawdLook(ctx, { clawd, toon });   // cel finish, hull ink, face decals (src/pilot-look.js)
  // shadow casters: body, nubs, legs - not the face decals (they would print ink streaks under the eyes)
  for (const c of rig.squash.children) if (c !== clawd.nodes.face) ctx.shadowRoots.push(c);
  const body = toon.bodyMesh || clawd.nodes.body;

  // ---- props --------------------------------------------------------------------------------------------------------
  const cup = makeCup(ctx), spoon = makeSpoon(ctx), drips = makeDrips(ctx, 26), glint = makeGlint(ctx);
  let glintK = 0;   // this frame's glint strength (set in update, drawn in afterCamera)
  ctx.scene.add(cup.group, spoon.group, drips.group);
  // props cast the cel shadow only while they rest on the deck / bollard (no straw or cup shadows printed across his face)
  const setCast = (o, on) => { const i = ctx.shadowRoots.indexOf(o); if (on && i < 0) ctx.shadowRoots.push(o); if (!on) { if (i >= 0) ctx.shadowRoots.splice(i, 1); o.traverse(m => m.layers.disable(30)); } };

  // ---- pier geography (measured, so a rebuilt pier keeps working) ----------------------------------------------------
  const W = ctx.modules.world, pier = W?.pier || {};
  const deckY = pier.deckY ?? 2.2, endZ = pier.end?.[2] ?? 0;
  // the bollard nearest the end ladder gets the cup: Clawd jumps from beside it and climbs back up the ladder next to it
  const ladX = pier.ladder ? (pier.ladder.x ?? pier.ladder[0]) : -0.75;
  const bols = pier.bollards?.length ? pier.bollards : [[-1.25, deckY, -0.4], [1.25, deckY, -0.4]];
  const bol = bols.reduce((a, b) => Math.abs(b[0] - ladX) < Math.abs(a[0] - ladX) ? b : a);
  const sB = bol[0] >= ladX ? 1 : -1;                  // +1: bollard on Clawd's right when he faces the bay (+z)
  const ray = new THREE.Raycaster();
  const hit = (o, d, far = 10) => { ray.set(o, d); ray.far = far; const h = ray.intersectObject(ctx.sets.coast, true).filter(h => h.object.visible !== false && !h.object.userData.noSolid);
    return h[0] || null; };
  ctx.sets.coast.updateMatrixWorld(true);
  const hb = hit(new V3(bol[0], deckY + 3, bol[2]), new V3(0, -1, 0));
  const bolTop = hb && hb.point.y > deckY + 0.05 && hb.point.y < deckY + 1.2 ? hb.point.y : deckY + 0.41;
  const hr = hit(new V3(bol[0] - sB, bolTop - 0.012, bol[2]), new V3(sB, 0, 0), 1.2);
  const capR = hr ? clamp(Math.abs(bol[0] - hr.point.x), 0.06, 0.4) : 0.17;
  const B = new V3(bol[0], deckY, bol[2]);
  const xSt = B.x - sB * (capR + 0.3);                // where Clawd stands to set the cup down (bollard-side nub toward it)
  const he = hit(new V3(xSt, deckY - 0.06, endZ + 2), new V3(0, 0, -1), 4);
  const edgeZ = he && Math.abs(he.point.z - endZ) < 0.6 ? he.point.z : endZ;
  const xSit = xSt - sB * 0.6;                         // where he sits eating (clear of the ladder rails and the bollard)
  const spots = {
    deckY, edgeZ, bollard: B.clone(), bollardTop: bolTop, bollardR: capR, side: sB,
    sit: new V3(xSit, deckY, edgeZ - 0.03),
    stand: new V3(xSt, deckY, B.z),
    cupDeck: new V3(xSit + 0.45, deckY, edgeZ - 0.08),
    cupBollard: new V3(B.x - sB * (capR - CUP.R0 - 0.012), bolTop, B.z),
    ladder: new V3(ladX, deckY, edgeZ),
  };
  const NUB_B = sB > 0 ? 'R' : 'L', NUB_B35 = sB > 0 ? 'L' : 'R';   // bollard-side nub facing the bay (s09) / the town (s35)
  // ladder: the world's if it has one, else ours (bolted to the pier end face)
  let ladder = null;
  if (!pier.ladder) { ladder = makeLadder(ctx, { x: ladX, zFace: edgeZ, deckY, bottom: -1.0, half: 0.2 }); ctx.sets.coast.add(ladder); ctx.solids.add('pier-ladder', ladder, { kind: 'box', groups: ['coast'], pad: -0.01 }); }
  // the leap lands 2 m out from the pier face, angled away from the ladder (toward the middle of the pier end)
  const SPLASH = new V3(xSt - sB * 0.75, 0, edgeZ + 2.0), TAKEOFF = 18.86, JUMP_YAW = Math.atan2(SPLASH.x - xSt, SPLASH.z - B.z);

  // ---- solids ---------------------------------------------------------------------------------------------------------
  ctx.solids.add('clawd', body, { kind: 'box', groups: ['coast', 'cockpit', 'under'], pad: -0.01 });
  ctx.solids.add('cup', cup.paper, { kind: 'box', groups: ['coast'] });
  ctx.solids.add('spoon', spoon.tube, { kind: 'points', groups: ['coast'], points: 40 });
  ctx.solids.allow('clawd', 'pier-deck', 0.03); ctx.solids.allow('cup', 'pier-deck', 0.01); ctx.solids.allow('spoon', 'cup', 0.2); ctx.solids.allow('spoon', 'clawd', 0.06);
  for (const b of pier.bollards || []) ctx.solids.allow('cup', 'bollard' + b[0], 0.01);
  ctx.solids.allow('clawd', 'pier-ladder', 0.03); ctx.solids.allow('clawd', 'lever-L', 0.012); ctx.solids.allow('clawd', 'lever-R', 0.012);
  // the spoon must stay out of the mound where it is frozen in the air (s08): an invisible core box of the mound + the bowl
  const icePx = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.06, 0.084), new THREE.MeshBasicMaterial({ visible: false }));
  icePx.position.y = CUP.H + 0.034; icePx.raycast = () => {}; cup.group.add(icePx); icePx.visible = false;
  ctx.solids.add('ice', icePx, { kind: 'box', group: 'cup', groups: ['coast'] });
  ctx.solids.add('spoon-bowl', spoon.bowl, { kind: 'points', group: 'spoon', groups: ['coast'], points: 60 });
  ctx.solids.allow('spoon-bowl', 'cup', 0.2); ctx.solids.allow('spoon-bowl', 'clawd', 0.06);
  ctx.label('PILOT: Clawd', root); ctx.label('PILOT: cup', cup.group);

  // ---- helpers --------------------------------------------------------------------------------------------------------
  const L2W = (p) => rig.toWorld(p);
  const placeRoot = (p, rotY = 0, rotX = 0, rotZ = 0) => { root.position.copy(p); root.rotation.set(rotX, rotY, rotZ, 'YXZ'); root.updateMatrixWorld(true); };
  const bodyMinY = () => { body.updateMatrixWorld(true); return new THREE.Box3().setFromObject(body, true).min.y; };
  // settle: feet ('feet') or the body bottom ('seat') exactly on surface y (no float, no sink)
  const settle = (y, mode = 'feet') => { root.updateMatrixWorld(true); const lo = mode === 'feet' ? rig.feetMinY() : bodyMinY(); root.position.y += y - lo; root.updateMatrixWorld(true); };
  const SIT_LEGS = (kick = 0, kick2 = 0) => ({ BL: { sy: 0.36 }, BR: { sy: 0.36 }, FL: { rx: 8 + kick, sy: 1.05 }, FR: { rx: 8 + kick2, sy: 1.05 } });
  const melt = (t) => t < cues.cupDown ? 0 : clamp(Math.pow((t - cues.cupDown) / (75.6 - cues.cupDown), 0.8), 0, 1);
  const tiptoe = (k) => ({ squash: -0.16 * k, legs: { FL: { sy: 1 + 0.3 * k }, FR: { sy: 1 + 0.3 * k }, BL: { sy: 1 + 0.3 * k }, BR: { sy: 1 + 0.3 * k } } });
  const glintDir = new V3(0.12, 0.62, 0.78).normalize();   // the meteor's first glint (sky over the bay)
  const SKY_POINT = new V3(0.2, 0.58, -0.79).normalize();   // s08: where the orange point burns (high over his right shoulder, in frame)
  const focus = makeFocusLines(ctx), streaks = makeStreaks(ctx, 7);
  const MOUTH = new V3(0.0, 0.43, 0.30);                   // rig-local spot in front of the mouth
  const inkOpts = (shot) => ({ inkCol: shot.id === 's26' ? 0x26090b : shot.id === 's12' ? 0x161a2c : null, fill: shot.id === 's26' ? 0x5a1c3a : null });

  // hold the spoon-straw in the right nub with its bowl at world point T (wrist free, grip at the nub tip)
  function spoonTo(T, prefLocal, side = 'R') {
    const pref = L2W(prefLocal), dir = pref.clone().sub(T).normalize(), Lw = spoon.L - 0.017;
    rig.reach(side, T.clone().addScaledVector(dir, Lw), { prefer: prefLocal.clone().sub(new V3(side === 'R' ? 0.46 : -0.46, 0.5, 0)) });
    const grip = rig.gripWorld(side), up = L2W(new V3(0, 1.2, 0.6)).sub(L2W(new V3(0, 0, 0)));
    placeProp(spoon.group, grip, aimY(T.clone().sub(grip), up));
  }
  // spoon standing in the cup (left there by Clawd): leaning on the rim
  function spoonInCup(lean = 0.32, spin = 2.4, depth = 0.05) {
    const c = cup.group, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, spin, 0, 'YXZ'));
    const tipLocal = new V3(0, CUP.H + 0.02 - depth, 0), dir = new V3(0, -1, 0).applyQuaternion(q);   // bowl down into the ice
    const grip = tipLocal.clone().addScaledVector(dir, -(spoon.L - 0.017));
    const qq = c.quaternion.clone().multiply(aimY(dir, new V3(0, 0, 1)));
    placeProp(spoon.group, c.localToWorld(grip), qq);
  }
  // the cup held by a nub: cup upright, its wall touching the nub tip
  // follow: the cup is carried (not resting on anything) -> if the nub cannot reach the planned spot, the cup moves to the nub
  function cupInNub(side, cupPos, tilt = null, follow = false) {
    const yC = 0.042, sx = side === 'R' ? 1 : -1;
    cup.group.position.copy(cupPos); cup.group.quaternion.copy(tilt || new THREE.Quaternion()); cup.group.updateMatrixWorld(true);
    const toward = rig.toWorld(new V3(sx * 0.46, 0.5, 0)).sub(cupPos); toward.y = 0; toward.normalize();
    const wall = cup.group.localToWorld(new V3(0, yC, 0)).addScaledVector(toward, cup.radiusAt(yC) + 0.004);
    const r = rig.reach(side, wall);
    if (follow && r.err > 0.001) { cup.group.position.add(r.tipW.clone().sub(wall)); cup.group.updateMatrixWorld(true); }
    return r;
  }

  // ---- choreography ---------------------------------------------------------------------------------------------------
  // returns nothing; poses rig + root + props for coast shots (s01..s09 sitting / placing / jumping, s35 return)
  function poseSitting(ct, id) {
    // s03 eat -> s04 scoop (macro) -> s08 looks up, freeze, determined. Before s03 he is already sitting and eating.
    const lt3 = ct - 5.0;
    let emo = 'happy', mix = null, mixT = 0, squash = 0, tilt = 0, lean = 0, turn = 0, lookX = 0, lookY = 0, gazeX = 0, gazeY = 0, blink = 0, kick = 0, kick2 = 0;
    // spoon bowl target (world) + nub preference (rig-local)
    const C = spots.cupDeck, iceTop = C.clone().add(new V3(-0.006, CUP.H + 0.03, 0.004));
    const above = C.clone().add(new V3(-0.03, CUP.H + 0.12, 0.01)), mouth = () => L2W(MOUTH), prefEat = new V3(0.52, 0.47, 0.26), prefDig = new V3(0.66, 0.42, 0.02);
    let tgt = 'dig', k = 0, bite = 0, dents = [{ a: Math.PI * 0.95, d: 0.75, h: 0.72 }];
    if (ct < 7.3) {   // s03 + earlier coast shots: dig -> lift -> eat -> bliss
      const ph = ct < 5.0 ? 4.6 : ct;   // before s03: hold the first dig pose
      if (ph < 5.4) { tgt = 'dig'; k = sstep(4.6, 5.4, ph); bite = ph > 5.3 ? 1 : 0; dents = [{ a: Math.PI * 0.95, d: 0.75 * k, h: 0.72 }]; }
      else if (ph < 5.95) { tgt = 'lift'; k = ease((ph - 5.4) / 0.55); bite = 1; emo = 'happy'; mix = 'yum'; mixT = sstep(5.6, 5.85, ph); }
      else if (ph < 6.25) { tgt = 'eat'; k = 1; bite = ph < 6.04 ? 1 : 0; emo = ph < 6.04 ? 'yum' : 'happy'; squash = 0.1 * bump(ph, 6.08, 0.05, 0.04, 0.15); }
      else { tgt = 'rest'; k = ease((ph - 6.25) / 0.5); emo = 'happy'; squash = 0.07 * Math.max(0, Math.sin((ph - 6.25) * 22)) * Math.exp(-(ph - 6.25) * 3);
        tilt = 5 * Math.sin((ph - 6.4) * 26) * bump(ph, 6.6, 0.2, 0.3, 0.35); }
      kick = 18 * Math.max(0, Math.sin(ph * 6.2)) * (ph > 6.2 ? 1.6 : 0.6); kick2 = 18 * Math.max(0, Math.sin(ph * 6.2 + 2.4)) * (ph > 6.2 ? 1.6 : 0.6);
      blink = bump(ph, 5.2, 0.05, 0.04, 0.06);
    } else if (ct < 9.3) {   // second scoop (end of s03 -> s04 macro): down, dig, lift a bite
      const d0 = 7.3;
      if (ct < 7.8) { tgt = 'rest2dig'; k = ease((ct - d0) / 0.5); }
      else { tgt = 'dig2'; k = sstep(7.8, 9.15, ct); bite = ct > 9.05 ? 1 : 0; }
      dents = [{ a: Math.PI * 0.95, d: 0.75, h: 0.72 }, { a: Math.PI * 0.62, d: 0.9 * sstep(7.9, 9.0, ct), h: 0.62 }];
      emo = 'happy'; kick = 10 * Math.max(0, Math.sin(ct * 5.5)); kick2 = 10 * Math.max(0, Math.sin(ct * 5.5 + 2.4)); lookX = 0.5; lookY = -0.4;
      emo = 'curious'; mix = 'happy'; mixT = 0.6;
    } else {   // glint (9.3) -> hold the bite -> (s05..s07 elsewhere) -> s08: snaps his head back to the sky (body tilts back,
      // pupils up), the spoon freezes in the air, eyes widen -> determined frown (still looking up)
      dents = [{ a: Math.PI * 0.95, d: 0.75, h: 0.72 }, { a: Math.PI * 0.62, d: 0.9, h: 0.62 }];
      tgt = 'hold'; k = ease((ct - 9.3) / 0.8); bite = 1;
      emo = 'curious'; lookX = 0.4; lookY = -0.3;
      if (ct >= 16.0) { k = 1; emo = 'happy'; mix = 'yum'; mixT = 0.35; lookX = 0.2; lookY = -0.2; }
      if (ct >= cues.look) { const a = sstep(cues.look, cues.look + 0.2, ct);
        emo = a < 0.5 ? 'surprised' : 'shocked'; mix = null; lookX = 0.35 * a; lookY = lerp(-0.2, 1.0, a); gazeX = 0.35 * a; gazeY = a; turn = 10 * a;
        lean = -14 * a + 4 * bump(ct, cues.look + 0.02, 0.02, 0.02, 0.06); squash = -0.08 * a + 0.06 * bump(ct, cues.look, 0.02, 0.02, 0.05); }
      if (ct >= cues.frown) { const a = sstep(cues.frown, cues.frown + 0.2, ct); emo = 'surprised'; mix = 'determined'; mixT = a; gazeY = 0.8; gazeX = 0.3; turn = 10;
        lookY = lerp(1.0, 0.75, a); lean = lerp(-14, -10, a); squash = lerp(-0.08, 0.06, a) - 0.06 * bump(ct, cues.frown + 0.35, 0.06, 0.05, 0.12); }
      blink = bump(ct, cues.look - 0.1, 0.04, 0.03, 0.05);
    }
    rig.pose({ emo, mix, mixT, squash, tilt, lean, turn, lookX, lookY, gazeX, gazeY, blink, armL: -12, armR: 0, legs: SIT_LEGS(kick, kick2) });
    placeRoot(spots.sit.clone(), 0); settle(deckY, 'seat');
    rig.armAngles('L', { yaw: 10, roll: -18 });
    // spoon bowl target
    const eatT = mouth(), digA = iceTop.clone().add(new V3(-0.016, 0.004, 0)), digB = iceTop.clone().add(new V3(-0.004, -0.012, 0.004));
    const dig2A = C.clone().add(new V3(-0.03, CUP.H + 0.045, 0.024)), dig2B = C.clone().add(new V3(-0.012, CUP.H + 0.024, 0.016));
    // rest (bliss beat): the spoon angled down and away from his face, bowl out over the deck beside him
    const hold = L2W(new V3(0.42, 0.5, 0.52)), rest = L2W(new V3(0.86, 0.18, 0.36));
    let T, pref = prefDig;
    if (tgt === 'dig') { T = digA.clone().lerp(digB, k); }
    else if (tgt === 'lift') { const fr = L2W(new V3(0.32, 0.5, 0.62)); T = digB.clone().lerp(above, sstep(0, 0.35, k)).lerp(fr, sstep(0.3, 0.7, k)).lerp(eatT, sstep(0.65, 1, k)); pref = prefDig.clone().lerp(prefEat, k); }
    else if (tgt === 'eat') { T = eatT; pref = prefEat; }
    else if (tgt === 'rest') { T = eatT.clone().lerp(rest, k); pref = prefEat.clone().lerp(new V3(0.62, 0.62, 0.1), k); }
    else if (tgt === 'rest2dig') { T = rest.clone().lerp(above, sstep(0, 0.6, k)).lerp(dig2A, sstep(0.5, 1, k)); pref = new V3(0.62, 0.62, 0.1).lerp(prefDig, k); }
    else if (tgt === 'dig2') { const s = Math.sin(k * Math.PI * 3) * 0.003; T = dig2A.clone().lerp(dig2B, sstep(0, 0.55, k)).lerp(dig2B.clone().add(new V3(0.0, 0.07, -0.012)), sstep(0.8, 1, k)); T.y += s; }
    else if (tgt === 'hold') { const lifted = dig2B.clone().add(new V3(0.0, 0.07, -0.012)); T = lifted.lerp(hold, ct >= 16.0 ? 1 : 0.0); pref = ct >= 16 ? prefEat : prefDig; }
    spoonTo(T, pref);
    spoon.set({ bite });
    // a bite that slides off (s08): falls past the pier edge
    cup.group.position.copy(spots.cupDeck); cup.group.quaternion.identity(); cup.group.updateMatrixWorld(true);
    return { dents };
  }

  function poseCupAndJump(ct) {   // s09: set the cup down on the bollard (cupDown), jump off the pier (splash)
    const t0 = 18.0, S = spots.stand.clone(), cupTop = spots.cupBollard.clone();
    const nb = NUB_B, no = nb === 'R' ? 'L' : 'R', sx = nb === 'R' ? 1 : -1;
    let squash = 0, lean = 0, legs = null;
    const holdK = 1 - sstep(cues.cupDown + 0.02, cues.cupDown + 0.09, ct);           // nub on the cup
    const toe = 1 - sstep(cues.cupDown + 0.05, cues.cupDown + 0.18, ct);             // tiptoe while reaching
    if (ct < 18.6) {
      const tt = tiptoe(toe); squash = tt.squash; legs = tt.legs; lean = 3 * toe;
      const relief = sstep(cues.cupDown + 0.02, cues.cupDown + 0.1, ct);
      rig.pose({ emo: relief > 0.5 ? 'determined' : 'nervous', mix: relief > 0.5 ? null : 'determined', mixT: 0.55, squash, lean, tilt: -4 * sx * toe,
        lookX: 0.55 * sx * (1 - relief), lookY: 0.3 * (1 - relief) + 0.15 * relief, legs });
      placeRoot(S, 0); settle(deckY, 'feet');
      // the cup comes down the last 2.5 cm, a tiny wobble after release
      // carefully: held up over the cap edge, eased down (slow last centimetre), set down at cupDown
      const kd = clamp((ct - t0) / (cues.cupDown - t0 - 0.04), 0, 1), down = 1 - (kd < 0.7 ? 0.8 * ease(kd / 0.7) : 0.8 + 0.2 * easeOut((kd - 0.7) / 0.3));
      const c = cupTop.clone().add(new V3(-spots.side * 0.03 * down, 0.05 * down, 0));
      const wob = ct > cues.cupDown ? 2.2 * DEG * Math.sin((ct - cues.cupDown) * 38) * Math.exp(-(ct - cues.cupDown) * 9) : 0;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, wob));
      cupInNub(nb, c, q);
      if (holdK < 0.999) {   // let go: the nub swings away from the cup
        const P = rig.arms[nb].position.clone();
        rig.armAngles(nb, { yaw: lerp(0, 10, holdK), roll: lerp(-30, 75, holdK), slide: [(P.y - 0.5) * holdK, P.z * holdK] });
      }
      rig.armAngles(no, { yaw: 5, roll: -15 + 30 * toe });
      spoonInCup(0.32, 2.4, 0.05);
      return;
    }
    // jump: turn to the water + crouch (4 drawings, 18.6-18.86) -> stretched take-off (TAKEOFF) -> high outward arc,
    // tucked into a cannonball somersault -> splash (CUES.splash) 2 m out from the pier face
    cup.group.position.copy(cupTop); cup.group.quaternion.identity(); cup.group.updateMatrixWorld(true); spoonInCup(0.32, 2.4, 0.05);
    if (ct < TAKEOFF) { const a = sstep(18.6, 18.8, ct), yaw = JUMP_YAW * sstep(18.58, 18.7, ct);
      rig.pose({ emo: 'determined', squash: 0.3 * a - 0.08 * bump(ct, 18.84, 0.03, 0.02, 0.03), squashXZ: 1 + 0.07 * a, lean: 18 * a, armL: lerp(10, -50, a), armR: lerp(10, -50, a), lookY: -0.35,
        legs: { FL: { rx: -14 * a, sy: 1 - 0.18 * a }, FR: { rx: -14 * a, sy: 1 - 0.18 * a }, BL: { rx: 16 * a, sy: 1 - 0.18 * a }, BR: { rx: 16 * a, sy: 1 - 0.18 * a } } });
      placeRoot(S, yaw); settle(deckY, 'feet'); return; }
    const J = jumpPath(ct), k = J.k;
    const stretch = 1 - sstep(0.06, 0.2, k), tuck = sstep(0.16, 0.3, k) * (1 - sstep(0.86, 1.0, k));
    rig.pose({ emo: tuck > 0.5 ? 'squint' : 'determined', squash: -0.3 * stretch + 0.2 * tuck, squashXZ: tuck > 0.01 ? 1 + 0.08 * tuck : null,
      armL: lerp(lerp(150, 10, tuck), 150, sstep(0.88, 1, k)), armR: lerp(lerp(150, 10, tuck), 150, sstep(0.88, 1, k)), lookY: lerp(0.3, -0.5, tuck),
      legs: Object.fromEntries(['FL', 'FR', 'BL', 'BR'].map(n => [n, { rx: lerp(n[0] === 'F' ? -40 : -50, n[0] === 'F' ? 70 : -70, tuck), sy: lerp(1.15, 0.55, tuck) }])) });
    // pivot the somersault about the body centre (not the feet)
    const off = new V3(0, -0.13, 0).applyEuler(new THREE.Euler(J.rotX, JUMP_YAW, 0, 'YXZ'));
    placeRoot(J.c.clone().add(off), JUMP_YAW, J.rotX);
  }
  // the leap (continuous in t, so the camera can follow it on ones): body pivot + somersault pitch.
  // y: a parabola in k with the apex 0.52 m over the take-off at k 0.3; the horizontal run is front-loaded (clears the
  // deck edge and the ladder rails by > 0.35 m), then the body keeps sinking under the water after the splash
  function jumpPath(t) {
    const S = spots.stand, k = clamp((t - TAKEOFF) / (cues.splash - TAKEOFF), 0, 1.7);
    const y0 = deckY + 0.13, y1 = SPLASH.y + 0.02, B2 = (y0 - y1) / 0.4, A2 = 0.6 * B2;
    const y = k <= 1 ? y0 + A2 * k - B2 * k * k : y1 - (k - 1) * 2.4;
    const p = 1 - Math.pow(1 - Math.min(k, 1), 1.6);
    const x = lerp(S.x, SPLASH.x, p), z = lerp(S.z, SPLASH.z, p) + Math.max(0, k - 1) * 0.4;
    return { k, c: new V3(x, y, z), rotX: (k <= 1 ? 330 * ease(sstep(0.1, 0.95, k)) : 330 + 40 * (k - 1)) * DEG, vel: new V3(SPLASH.x - S.x, (A2 - 2 * B2 * Math.min(k, 1)) / 1, SPLASH.z - S.z) };
  }

  // s35 beats (film time): climb, shake off, two steps to the bollard, take the cup, turn round to the bay (camera),
  // look into it (cup tipped toward us: melted blue water), sad wobble -> happy anyway, straw up, sip (CUES.sip), love
  const R35 = { shake: 76.05, walk: 76.25, take: 76.5, turn: 76.8, look: 77.05, sad: 77.15, happy: 77.32, up: 77.45 };
  const FACE35 = Math.atan2(1.1, 1.35);   // he turns to face the s35 camera (cams/pilot.js: stand + (1.1, 0.33, 1.35))
  function poseReturn(ct) {
    const t0 = 75.5, lt = ct - t0, L = spots.ladder, S = spots.stand, cupTop = spots.cupBollard.clone();
    const nb = NUB_B35, no = nb === 'R' ? 'L' : 'R', sx = nb === 'R' ? 1 : -1;
    const railZ = (pier.ladder?.z ?? edgeZ + 0.07) + 0.06, railX = 0.2;
    let emo = 'relief', mix = null, mixT = 0, squash = 0, lean = 0, tilt = 0, turn = 0, lookX = 0, lookY = 0, blink = 0, legs = null;
    cup.group.position.copy(cupTop); cup.group.quaternion.identity(); cup.group.updateMatrixWorld(true);
    let cupHeld = false;
    const top = new V3(L.x, deckY, edgeZ - 0.15), CL = R35.shake - t0;
    if (lt < CL) {   // climbing: two pulls hugging the ladder rails, over the edge, a belly flop onto the deck
      const u = lt * 0.7 / CL;   // the climb drawings, timed on a 0.7 s chart
      const p1 = ease(clamp(u / 0.28, 0, 1)), p2 = ease(clamp((u - 0.3) / 0.24, 0, 1)), on = sstep(0.5, 0.64, u);
      const y = deckY - 0.25 + 0.12 * p1 + 0.13 * p2, z = lerp(railZ + 0.17, top.z, on);
      squash = -0.07 * Math.sin(p1 * Math.PI) - 0.07 * Math.sin(p2 * Math.PI) + 0.24 * bump(u, 0.65, 0.03, 0.02, 0.06);
      lean = lerp(4, 24, on) * (1 - sstep(0.62, 0.7, u));
      emo = 'strain'; mix = 'determined'; mixT = 0.35; if (u > 0.6) { emo = 'relief'; mix = null; }
      legs = { FL: { rx: -35 * p1 + 35 * p2 }, FR: { rx: 35 * p1 - 35 * p2 }, BL: { rx: -25 + 20 * p2 }, BR: { rx: 25 * p1 - 20 } };
      rig.pose({ emo, mix, mixT, squash, lean, legs });
      placeRoot(new V3(L.x, y, z), Math.PI);
      if (on > 0.5) settle(deckY, 'feet');
      // nubs hug the ladder rails (outer sides), then grab the rail tops over the deck edge
      const gy = Math.min(deckY + 0.05, root.position.y + 0.3), gz = lerp(railZ, edgeZ - 0.06, on);
      for (const [s, k] of [['L', -1], ['R', 1]]) rig.reach(s, new V3(L.x - k * (railX + 0.035), gy, gz));
    } else if (ct < R35.walk) {   // shake off the water (drops fly)
      const a = (ct - R35.shake) / (R35.walk - R35.shake);
      emo = 'squint'; turn = 18 * Math.sin(a * Math.PI * 5) * (1 - a); squash = 0.05 * Math.sin(a * Math.PI * 5);
      rig.pose({ emo, squash, turn, armL: 30 + 25 * Math.sin(a * 31), armR: 30 - 25 * Math.sin(a * 31) });
      placeRoot(top, Math.PI); settle(deckY, 'feet');
    } else if (ct < R35.take) {   // two steps to the bollard
      const a = clamp((ct - R35.walk) / (R35.take - R35.walk), 0, 1), e = ease(a), st = Math.sin(a * Math.PI * 2);
      emo = 'happy'; lookX = 0.5 * sx; squash = 0.04 * Math.abs(st); tilt = 4 * st;
      rig.pose({ emo, squash, tilt, lookX, armL: 20 + 15 * st, armR: 20 - 15 * st, legs: { FL: { rx: 22 * st }, BR: { rx: 22 * st }, FR: { rx: -22 * st }, BL: { rx: -22 * st } } });
      placeRoot(top.clone().lerp(S, e), Math.PI); settle(deckY, 'feet');
      rig.armAngles(nb, { roll: lerp(20, 45, sstep(0.6, 1, a)) });
    } else {   // take the cup (bollard-side nub), turn round, look in: melted -> happy anyway -> sip through the spoon-straw
      const take = sstep(R35.take + 0.08, R35.turn, ct), toe = sstep(R35.take - 0.04, R35.take + 0.06, ct) * (1 - sstep(R35.turn - 0.12, R35.turn - 0.02, ct));
      const spin = ease(sstep(R35.turn, R35.look - 0.02, ct));     // pi (facing the town) -> FACE35 (facing the camera on the bay side)
      const tt = tiptoe(toe); legs = tt.legs; squash = tt.squash + 0.06 * bump(ct, R35.turn + 0.12, 0.06, 0.04, 0.08);
      emo = 'curious'; lookX = 0.6 * sx * (1 - spin); lookY = lerp(0.55, -0.5, spin);
      if (ct > R35.sad) { emo = 'teary'; mix = 'sad'; mixT = 0.5; lookX = 0.15 * sx; lookY = -0.7; tilt = -4 * sx; }
      if (ct > R35.happy) { emo = 'happy'; mix = null; lookX = 0; lookY = 0; tilt = 0; squash = -0.07 * bump(ct, R35.happy + 0.05, 0.04, 0.03, 0.08); }
      if (ct > cues.sip - 0.04) { emo = 'sip'; squash = 0.05 * Math.max(0, Math.sin((ct - cues.sip) * 16)) * (1 - sstep(78.15, 78.3, ct)); }
      if (ct > 78.15) { emo = 'sip'; mix = 'love'; mixT = sstep(78.15, 78.3, ct); squash = -0.04 * sstep(78.15, 78.3, ct); }
      blink = bump(ct, R35.sad - 0.03, 0.03, 0.02, 0.04);
      rig.pose({ emo, mix, mixT, squash, lookX, lookY, blink, tilt: ct > cues.sip ? -3 * sx : tilt, legs });
      placeRoot(S.clone(), lerp(Math.PI, FACE35, spin)); settle(deckY, 'feet');
      // cup path: bollard top -> up and out in front of him (rig-local, bollard side) -> tipped toward the camera to look in
      // -> up to his face for the sip
      const lookIn = L2W(new V3(sx * 0.24, 0.3, 0.56)), sipP = L2W(new V3(sx * 0.32, 0.36, 0.46));
      let cp = cupTop.clone();
      if (ct > R35.take + 0.08) { const up = cupTop.clone().add(new V3(0, 0.035, 0)), mid = up.clone().lerp(lookIn, 0.5).add(new V3(0, 0.03, 0));
        mid.addScaledVector(L2W(new V3(0, 0.5, 1)).sub(L2W(new V3(0, 0.5, 0))).setY(0).normalize(), 0.04);   // swing out in front of him (clear of his corner and the cap)
        cp = take < 0.3 ? cupTop.clone().lerp(up, ease(take / 0.3)) : take < 0.65 ? up.clone().lerp(mid, ease((take - 0.3) / 0.35)) : mid.clone().lerp(lookIn, ease((take - 0.65) / 0.35)); }
      if (ct > R35.up) cp = lookIn.clone().lerp(sipP, sstep(R35.up, cues.sip - 0.04, ct));
      // tip the cup toward the camera (his front) while he looks in, then a small tilt to the straw
      const tip = sstep(R35.look - 0.04, R35.look + 0.06, ct) * (1 - sstep(R35.up, R35.up + 0.1, ct));
      const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.75 * tip, 0, sx * 0.12 * sstep(R35.up, cues.sip, ct), 'YXZ')).premultiply(root.quaternion.clone());
      if (ct > R35.take) { cupInNub(nb, cp, ct > R35.take + 0.08 ? tiltQ : null, take > 0.02); cupHeld = true; }
      else { cup.group.position.copy(cp); cup.group.updateMatrixWorld(true); }
      rig.armAngles(no, { yaw: 0, roll: ct > cues.sip ? 35 + 8 * Math.sin((ct - cues.sip) * 9) : -15 });
    }
    // spoon-straw: in the cup; while sipping, its top end at his mouth, the bowl end down in the blue water
    if (cupHeld && ct > R35.up) {
      const k = sstep(R35.up, cues.sip - 0.04, ct), M = L2W(MOUTH.clone().add(new V3(0, -0.005, 0.0)));
      const B0 = cup.group.localToWorld(new V3(0, 0.012, 0)), away = B0.clone().sub(M); away.y = 0; away.normalize();
      const Lb = spoon.L - 0.017; let T = B0.clone();
      for (let r = 0; r <= 1.001; r += 0.05) { T = B0.clone().addScaledVector(away, r * (CUP.R0 - 0.01)); if (T.distanceTo(M) >= Lb) break; }
      if (T.distanceTo(M) < Lb) { const h2 = T.clone().sub(M).setY(0).lengthSq(); T.y = M.y - Math.sqrt(Math.max(0, Lb * Lb - h2)); }
      const restTip = cup.group.localToWorld(new V3(0, 0.02, 0));
      const restGrip = restTip.clone().addScaledVector(new V3(0, 1, 0).applyEuler(new THREE.Euler(0.32, 2.4, 0, 'YXZ')).applyQuaternion(cup.group.quaternion), Lb);
      const grip = restGrip.lerp(M, k), tip = restTip.lerp(T, k), d = tip.sub(grip).normalize();
      placeProp(spoon.group, grip, aimY(d, new V3(0, 0, 1)));
    } else spoonInCup(0.32, 2.4, 0.06);
    return { cupHeld };
  }

  // ---- cockpit acting (s12 drop in + grip, s18 shove, s26 strain) -----------------------------------------------------
  function poseCockpit(ct, id) {
    const CK = ctx.modules.cockpit, st = ctx.state, f = st.f;
    const seat = new V3().fromArray(CK?.seat || [0, 0.5, 0]), seatY = CK?.seatTop ?? seat.y;
    let emo = 'determined', mix = null, mixT = 0, squash = 0, lean = 0, tilt = 0, lookX = 0, lookY = 0, blink = 0, y = seatY, grip = 1, rotZ = 0, kick = 0;
    if (id === 's12') {   // drop through the hatch (nubs up) -> land (squash) -> look around as the panels boot -> grip the levers
      const tLand = cues.seat;
      // falling from the hatch from the first frame of the cut (constant acceleration, legs first into frame)
      if (ct < tLand) { const k = clamp((ct - 24.5) / (tLand - 24.5), 0, 1); y = seatY + 1.55 * (1 - k * k); squash = -0.14 * sstep(0.5, 0.95, k); emo = 'determined'; mix = 'surprised'; mixT = 0.55; }
      else { squash = 0.17 * bump(ct, tLand + 0.02, 0.02, 0.04, 0.16) - 0.05 * bump(ct, tLand + 0.26, 0.06, 0.02, 0.12);
        emo = ct < 25.5 ? 'surprised' : 'determined'; mix = ct < 25.5 ? 'determined' : null; mixT = 0.5;
        lookX = 0.55 * bump(ct, 25.55, 0.12, 0.12, 0.12) - 0.55 * bump(ct, 25.85, 0.1, 0.1, 0.12); lookY = 0.1 + 0.25 * bump(ct, 25.55, 0.12, 0.2, 0.15); }
      grip = sstep(26.12, 26.48, ct); kick = 8 * Math.max(0, Math.sin((ct - tLand) * 9)) * Math.exp(-Math.max(0, ct - tLand) * 3);
      blink = bump(ct, 26.6, 0.04, 0.03, 0.05);
    } else if (id === 's18') {   // anticipation: sinks back + pulls the levers toward him, then the thrust (stretch forward)
      emo = 'determined'; lean = lerp(-4, 14, sstep(cues.levers - 0.04, cues.levers + 0.06, ct)) - 6 * bump(ct, cues.levers - 0.12, 0.18, 0.04, 0.06);
      squash = -0.09 * bump(ct, cues.levers + 0.04, 0.03, 0.08, 0.2) + 0.08 * bump(ct, cues.levers - 0.14, 0.14, 0.04, 0.06);
      lookY = 0.15; if (ct > cues.levers - 0.2) { mix = 'angry'; mixT = 0.35 * sstep(cues.levers - 0.2, cues.levers, ct); }
    } else if (id === 's26') {
      emo = 'strain'; const sh = Math.sin(ct * 61) * 0.6 + Math.sin(ct * 37) * 0.4;
      squash = 0.03 + 0.02 * sh; tilt = 1.6 * Math.sin(ct * 23); lean = 7 + 2 * sh;
      rotZ = 0.6 * Math.sin(ct * 47) * DEG;
    }
    const up = ct < cues.seat && id === 's12' ? 75 : 0;   // nubs up while dropping through the hatch
    rig.pose({ emo, mix, mixT, squash, lean, tilt, lookX, lookY, blink, armL: up, armR: up, legs: SIT_LEGS(kick, kick * 0.8) });
    placeRoot(new V3(seat.x, y, seat.z), 0, 0, rotZ);
    if (y <= seatY + 1e-4 || id !== 's12') settle(seatY, 'seat');
    // nubs into the lever sockets: from a raised rest pose to the socket (eased), then plugged in; the socket cup swivels
    // onto the nub so the tip sits inside it from any angle
    if (CK?.levers?.length === 2 && !(id === 's12' && ct < cues.seat)) {
      CK.poseLevers?.(st.t ?? ct, st);   // levers are posed from t (pure), before we read the sockets
      for (const [s, i] of [['L', 0], ['R', 1]]) {
        const sock = CK.socket(i), e = ease(grip), sx = s === 'R' ? 1 : -1;
        const T = e >= 1 ? sock : L2W(new V3(sx * 0.62, 0.62, 0.12)).lerp(sock, e);
        rig.reach(s, T);
        if (e > 0.85) CK.alignSocket?.(i, rig.dirWorld(s), f);
      }
    }
  }

  function poseDive(ct) {   // s10 default (the water team may re-pose via place()): swimming down toward the mecha
    const lt = ct - 19.5, sw = Math.sin(lt * 9);
    rig.pose({ emo: 'determined', squash: -0.05 + 0.04 * sw, armL: 40 + 50 * sw, armR: 40 + 50 * sw, lookY: -0.4,
      legs: { FL: { rx: -30 + 20 * sw }, FR: { rx: -30 - 20 * sw }, BL: { rx: -40 - 20 * sw }, BR: { rx: -40 + 20 * sw } } });
    placeRoot(new V3(0.3 - lt * 0.05, -2.4 - lt * 2.6, 4.5 + lt * 2.2), 0, 62 * DEG);
  }

  // ---- public API + per-frame update ----------------------------------------------------------------------------------
  let override = null;
  const api = {
    clawd, toon, rig, root, cup, spoon, ladder, drips, CLAWD_SCALE, spots,
    splash: { t: cues.splash, pos: SPLASH.toArray() },
    jumpPath,
    melt,
    cupWorld(t) { const onB = t >= cues.cupDown; return { pos: (onB ? spots.cupBollard : spots.cupDeck).clone(), onBollard: onB, melt: melt(t) }; },
    anchor(name) {
      root.updateMatrixWorld(true);
      if (name === 'cup') return cup.group.getWorldPosition(new V3());
      if (name === 'spoon') return spoon.group.localToWorld(spoon.tip.clone());
      if (name === 'nubL' || name === 'nubR') return rig.tipWorld(name.slice(3));
      const p = { head: new V3(0, 0.9, 0), face: new V3(0, 0.55, 0.3), mouth: MOUTH, feet: new V3(0, 0, 0), body: new V3(0, 0.52, 0) }[name] || new V3(0, 0.52, 0);
      return rig.toWorld(p.clone());
    },
    place(o = {}) { override = o; apply(o); },
    update(t, shot) {
      override = null;
      const ct = ctx.onTwos(t), id = shot.id, coast = shot.groups.includes('coast');
      // visibility: Clawd on the pier until he jumps (s09), in the cockpit for s12/s18/s26, back on the pier in s35
      const onPier = coast && (t < 19.5 || id === 's35'), inCock = COCK_SHOTS.includes(id), diving = id === 's10';
      root.visible = onPier || inCock || diving;
      cup.group.visible = spoon.group.visible = coast;
      setCast(spoon.group, false); setCast(cup.group, coast && !(id === 's35' && ctx.onTwos(t) > R35.take) && id !== 's04');
      drips.group.visible = id === 's35' || id === 's12';
      toon.setGlow(0); toon.setWet(id === 's35' ? 1 : id === 's12' ? 0.45 : id === 's18' ? 0.25 : id === 's26' ? 0.2 : 0);
      if (ladder) ladder.visible = coast;
      spoon.set({ bite: 0 });   // the bite only exists where poseSitting puts it (frames stay pure)
      let dents = [{ a: Math.PI * 0.95, d: 0.75, h: 0.72 }, { a: Math.PI * 0.62, d: 0.9, h: 0.62 }];
      if (coast) {
        if (t < 18.0) { const r = poseSitting(ct, id); dents = r.dents; }
        else if (t < 19.5) poseCupAndJump(ct);
        else if (id === 's35') poseReturn(ct);
        else { cup.group.position.copy(spots.cupBollard); cup.group.quaternion.identity(); cup.group.updateMatrixWorld(true);
          // s16: the cup trembles on the bollard as the giant rises (on twos)
          if (id === 's16') { const a = 1.6 * DEG * (Math.sin(ct * 71) + 0.6 * Math.sin(ct * 43)), b = 1.2 * DEG * Math.sin(ct * 59);
            cup.group.quaternion.setFromEuler(new THREE.Euler(a, 0, b)); cup.group.position.y += 0.0015 * Math.abs(Math.sin(ct * 83)); cup.group.updateMatrixWorld(true); }
          spoonInCup(0.32, 2.4, 0.05); }
        // glint in the syrup (s04): flashes at CUES.glint, flares, lingers
        const g = t < cues.glint - 0.05 ? 0 : bump(t, cues.glint + 0.06, 0.1, 0.12, 0.5) * 1.0 + sstep(cues.glint, cues.glint + 0.25, t) * 0.55 * (1 - sstep(10.0, 10.4, t));
        glintK = id === 's04' ? g : 0;
        cup.set({ melt: melt(t), dents, t: ctx.onThrees(t), sparkle: id === 's04' ? 1 : 0.5, level: id === 's35' ? lerp(0.62, 0.12, sstep(cues.sip, 78.3, ctx.onTwos(t))) : 0.62,
          ripple: id === 's35' ? ctx.onThrees(t) - R35.take : -1, warm: id === 's08' ? sstep(16.3, 16.9, t) : 0 });
        // s08: the orange point in the sky over the bay that he looks up at (the meteor team draws it)
        if (id === 's08') ctx.modules.meteor?.sky?.(t, { dir: SKY_POINT.toArray(), kind: 'point', k: sstep(cues.look - 0.3, cues.look + 0.1, t) * (1 + 0.3 * sstep(cues.frown, 18, t)) });
        // s35: a dense shower of shooting stars over the town behind him
        if (id === 's35') ctx.modules.meteor?.shootingStars?.(t, { rate: 760, k: 1.25, elev: [0.1, 0.75] });
      } else if (inCock) poseCockpit(ct, id);
      else if (diving) poseDive(ct);
      icePx.visible = id === 's08';   // spoon-vs-mound test only where the spoon must stay out of the ice
      // drips off soaked Clawd
      if (drips.group.visible && root.visible) {
        const src = [new V3(-0.4, 0.2, 0.2), new V3(0.4, 0.25, 0.1), new V3(0, 0.16, 0.25), new V3(-0.2, 0.17, -0.2), new V3(0.55, 0.45, 0), new V3(-0.55, 0.45, 0)].map(p => rig.toWorld(p));
        drips.set(t, src, id === 's35' ? 0.34 - 0.14 * sstep(77, 78.5, t) : 0.22, id === 's35' ? deckY : (ctx.modules.cockpit?.seatTop ?? 0.4) - 0.5);
      }
    },
    afterCamera(t, shot) { if (root.visible) look.update(ctx.camera, inkOpts(shot)); cup.pxScale(ctx.H / 1080);
      const id = shot.id, cam = ctx.camera, dr = Math.floor(ctx.onTwos(t) * 12);
      const gp = id === 's04' ? cup.glintPoint(cam.position, glintDir, spoon.group.localToWorld(spoon.tip.clone()), 0.035) : null;
      glint.set(gp, glintK, cam, 250, id === 's04' ? 1 : 0);
      // speed FX on twos: motion streaks behind the leap (s09), focus lines on the lever thrust (s18) and the seat landing (s12)
      const ct = ctx.onTwos(t), J = id === 's09' && ct >= TAKEOFF && ct < cues.splash ? jumpPath(ct) : null;
      streaks.set(J ? 1 - sstep(0.85, 1, J.k) : 0, cam, J?.c, J?.vel || new V3(0, 0, 1), 0.16, dr);
      const fk = id === 's18' ? sstep(cues.levers - 0.14, cues.levers, ct) * (1 - sstep(cues.levers + 0.25, cues.levers + 0.42, ct))
        : id === 's12' ? 0.7 * bump(ct, cues.seat + 0.04, 0.0, 0.04, 0.12) : 0;
      focus.set(fk, cam, dr); },
    dispose() { root.removeFromParent(); cup.group.removeFromParent(); spoon.group.removeFromParent(); drips.group.removeFromParent(); ladder?.removeFromParent(); },
  };
  function apply(o) {
    if (o.visible === false) { root.visible = false; return; }
    root.visible = true; rig.pose(o.pose ? { emo: o.emo || 'determined', ...o.pose } : { emo: o.emo || 'determined' });
    if (o.wet != null) toon.setWet(o.wet);
    if (o.pos) placeRoot(new V3().fromArray(o.pos.toArray ? o.pos.toArray() : o.pos), o.rotY || 0, o.rotX || 0, o.rotZ || 0);
  }
  return api;
}
