// =====================================================================================================================
// MEGA CLAWD · MECHA department (owner: mecha) — the 120 m giant built in Clawd's silhouette.
//   src/mecha.js        this module: rig solver (leg IK on the ground, arm IK + clamp-hand grip on the meteor), the per-shot
//                       choreography (pure function of t, characters on twos), runtime states, the public API
//   src/mecha-build.js  construction (armour slabs, visor, reactor, legs, telescoping arms, three-finger hands, thrusters)
//   src/mecha-kit.js    geometry kit (bevelled plates on parametric surfaces, merged parts)
//   src/mecha-paint.js  palette + cel materials with procedural panel lines / bolts / vents / hazard / wear, heat, surge, wet
//   src/mecha-face.js   the visor face: the mascot's own emotion shapes as glowing amber displays
//   src/mecha-fx.js     kelp, barnacles, drips + water sheets, steam hooks, silt, thruster trails
//   src/cams/mecha.js   cameras + looks of s11 s13 s15 s16 s19 s20 s21 s24 s25 s27 s28 s31 s34
//
// PUBLIC API  ctx.modules.mecha = {
//   root                      Object3D in ctx.scene (world placement; hidden when the mecha is not in the shot)
//   anchors                   { cockpit, hatch, visor, eyeL, eyeR, reactor, chest, top, center, back, bottom,
//                               handL, handR (= palmL / palmR), shoulderL, shoulderR, soleFL, soleFR, soleBL, soleBR } (Object3D)
//   anchor(name) -> Vector3   world position of an anchor ('head' = 'top'; 'soleL' / 'soleR' = mean of the left / right
//                             soles; 'catch' = the meteor contact point in s22-s29)
//   pose                      the last solved pose (read-only): { set, heading, wet, heat, surge, reactor, thrust, unfold, face }
//   setFace(emotion, opts)    visor face (any mascot emotion; opts = { mix, t, blink, lookX, lookY, power })
//   setReactor(k)             chest reactor 0 = dark, 1 = lit, 2 = surge overdrive
//   setThrust(k)              sole thrusters 0..1.6
//   setWet(k) setHeat(k, dirWorld) setSurge(k, radius) setUnfold(k)   state setters. update(t) drives all of them every
//                             frame from the choreography; call them after it (e.g. from afterCamera) to override one frame
//   frame() -> { center, right, up, fwd }   body basis in world space (fwd = where the visor looks)
//   UAPP                      strato approach axis (meteor -> mecha), shared with the meteor module
//   DIM, SCALE                dimensions in metres (body 120 x 90 x 72, hip height 32.1); SCALE = 120 (mascot units -> m)
// }
// Also exported: PATH (analytic flight / rise paths on ones, used by src/cams/mecha.js), SITE (coast stance point).
// Geography: under = asleep on the bay bed at z 252, back sunk in the silt, tilted back 40 deg, visor up toward the light
// and facing the shore (top front edge ~13 m below the surface); coast = standing in the bay at (0, -14, 225): facing the
// pier / town in s15 s16 s34, turned seaward (heading 0.35) for the crouch + launch s19 s20; sky = PATH.s21 / PATH.s31;
// strato = the meteor is the master: the body hangs below the rock's contact facet, palms 12.5 m off the real surface
// (raycast), the three clamp fingers splay until their tips bite 0.5 m into it (see catchPose() / grip()).
// Collision solids (group 'mecha'): body, thighs, shins, feet, upper arms, forearms, palms, distal finger segments
// (fingers x meteor allowed 1.2 m: the intended bite).
// =====================================================================================================================
import * as THREE from 'three';
import { mechaMaterials } from './mecha-paint.js';
import { buildMecha, DIM } from './mecha-build.js';
import { createFace } from './mecha-face.js';
import { createMechaFX } from './mecha-fx.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion, PI = Math.PI, D2R = PI / 180;
export const SITE = new V3(0, -14, 225);       // coast: where the mecha stands (feet)
// flight paths (body centre, world) as pure functions of raw film time t: translation on ones, the drawings on twos.
// Shared with src/cams/mecha.js so tracking cameras lock onto the giant without strobing.
export const PATH = {
  // s15 root height by shot fraction: the visor is half out at k 0.4, the shoulder sockets clear by k 0.8, then it settles
  riseY: (k) => { const e = Math.min(1, Math.max(0, k * 1.25)), s = e * e * (3 - 2 * e); return -112 + 56 * s + 2 * Math.max(0, Math.min(1, (k - 0.8) / 0.2)); },
  // s19 / s20 stand 6 m higher in the surf than s15 s16 s34 (the knees stay above the water in the crouch)
  launchY: (t, launch) => { const tau = Math.max(0, t - (launch + 0.08)); return SITE.y + 6 + 34 * tau + 170 * tau * tau; },
  // s21 climbs a cloud-free column at (-200, 300): >= 160 m between the body (r 95) and any cloud lobe, the camera and its
  // line of sight clear too (checked against the world's sky-set cloud spheres); clouds only pass as drawn wisps
  s21: (t) => { const k = t - 45; return new V3(-200 + 40 * Math.sin(k * 0.8), 1150 + 420 * k + 20 * k * k, 300 - 30 * k); },
  s31: (t) => { const k = t - 67; return new V3(60 * k, 4600 - 150 * k - 25 * k * k, 0); },
};
const HERO_SHOTS = ['s15', 's16', 's34'];   // backlit bay shots: armour lit by LOOK.hero (cams/mecha.js LOOKS)
const SHOW = new Set(['s10', 's11', 's13', 's15', 's16', 's19', 's20', 's21', 's22', 's23', 's24', 's25', 's27', 's28', 's29', 's31', 's32', 's33', 's34', 's35']);

export async function create(ctx) {
  const { util, cues } = ctx;
  const { clamp, lerp, sstep, ease, easeIO, easeOut, easeIn, curve, hash, spring } = util;
  const { M, MU } = mechaMaterials(ctx);
  const R = buildMecha(ctx, { M, MU });
  const face = await createFace(ctx);
  R.faceSlot.add(face.group);
  ctx.scene.add(R.root);
  ctx.shadowRoots.push(R.root);
  const FX = createMechaFX(ctx, R, M);
  if (ctx.modules.under) ctx.modules.under.defaultSilt = true;   // the water team's silt along the flanks (s11 s13; its documented switch)
  const eyeLight = ctx.light.addPoint({ pos: R.anchors.visor, offset: new V3(0, 0, 0), color: 0xffa040, intensity: 0, range: 70 });
  const BODY_Y = DIM.LEG + 45;

  // ---- collision solids -------------------------------------------------------------------------------------------
  const solid = (n, o, kind = 'box', pad = 0) => ctx.solids.add('mecha-' + n, o, { kind, group: 'mecha', pad });
  solid('body', R.body.children.find(c => c.name === 'body'), 'box', -1.5);
  // engine (director, draft): the s28 compression brings the box proxy's top corner 0.44 m into the rock for 3 frames;
  // the real top edge is bevelled (~6 m radius) and clears it, so allow 0.6 m on this pair only
  ctx.solids.allow('mecha-body', 'meteor', 0.6);
  // each solid is the part's own merged mesh group (looked up by Part name, never a child joint group)
  const part = (grp, name) => grp.children.find(c => c.name === name);
  for (const L of R.legs) { solid('thigh' + L.name, part(L.thigh, 'thigh' + L.name)); solid('shin' + L.name, part(L.knee, 'shin' + L.name)); solid('foot' + L.name, part(L.foot, 'foot' + L.name)); }
  for (const A of R.arms) { solid('upper' + A.name, part(A.upper, 'upper' + A.name)); solid('fore' + A.name, part(A.fore, 'fore' + A.name)); solid('hand' + A.name, part(A.wrist, 'palm' + A.name), 'box', -0.4);
    // clamp fingers: the tips are driven ~1.2 m into the rock on purpose (the grip, covered by crumbs + dust), deeper is a clip
    A.fingers.forEach((f, i) => { solid(`finger${A.name}${i}`, f.dist, 'box', -0.3); ctx.solids.allow(`mecha-finger${A.name}${i}`, 'meteor', 1.9); }); }

  // ---- state setters ----------------------------------------------------------------------------------------------
  const st = { set: null, heading: 0, wet: 0, heat: 0, surge: 0, reactor: 0, thrust: 0, unfold: 0, face: 'neutral' };
  const api = {
    root: R.root, anchors: R.anchors, DIM, SCALE: 120, pose: st, rig: R, face,
    setFace(e, o = {}) { face.set(e, o.mix ? { mix: o.mix, t: o.t } : {}); face.pose({ blink: o.blink || 0, lookX: o.lookX || 0, lookY: o.lookY || 0 }); face.power(o.power ?? 1); st.face = e;
      eyeLight.intensity = 1.6 * Math.min(1.2, face.level); },
    setReactor(k) { st.reactor = k; R.crystal.material.uniforms.uK.value = k; R.glowR.set(Math.min(1.3, k * 0.75)); },
    setThrust(k, t = 0, len = 70) { st.thrust = k; for (const L of R.legs) L.thr.set(k, len, t); },
    setWet(k) { st.wet = k; MU.uMWet.value = k; },
    // heat glows only near the plane through `plane` (world point) with normal `dir` (toward the heat source); without a
    // plane it sits 30 m above the top of the body along `dir`
    setHeat(k, dir = null, plane = null) { st.heat = k; MU.uMHeat.value = k; if (dir) MU.uMHeatDir.value.copy(dir).normalize();
      const p = plane || R.anchors.top.getWorldPosition(_v).addScaledVector(MU.uMHeatDir.value, 30); MU.uMHeatP.value.set(p.x, p.y, p.z, 1); },
    // surge front: `radius` = distance (m) the cyan front has run along the conduit reactor -> shoulder socket -> arm -> hand
    setSurge(k, radius = 0) { st.surge = k; MU.uMSurgeK.value = k; MU.uMSurge.value.w = radius; },
    setUnfold(k) { st.unfold = k; },
    // visor glint strength (0 = off, 1 = default); it sits in the upper corner on the key light's side
    setGlint(k) { st.glint = k; },
    // the hinged plates buckle (0..1, s25)
    setBend(k) { st.bend = k; R.bends.forEach((b, i) => b.g.quaternion.setFromAxisAngle(b.axis, b.max * clamp(k * (1.25 - 0.2 * i), 0, 1))); },
    anchor(name) {
      if (name === 'head') name = 'top';
      if (name === 'palmL' || name === 'palmR') name = 'hand' + name.slice(-1);
      if (name === 'soleL' || name === 'soleR') { const s = name.slice(-1); return R.anchors['soleF' + s].getWorldPosition(new V3()).add(R.anchors['soleB' + s].getWorldPosition(new V3())).multiplyScalar(0.5); }
      if (name === 'catch') return lastCatch.clone();
      const o = R.anchors[name]; return o ? o.getWorldPosition(new V3()) : R.root.getWorldPosition(new V3());
    },
    // body basis in world space: { center, right, up, fwd (the face direction) }
    frame() { const q = R.body.getWorldQuaternion(new Q()); return { center: R.body.getWorldPosition(new V3()), right: new V3(1, 0, 0).applyQuaternion(q), up: new V3(0, 1, 0).applyQuaternion(q), fwd: new V3(0, 0, 1).applyQuaternion(q) }; },
    UAPP: null,
  };
  const _v = new V3(), _q = new Q();
  let lastCatch = new V3();
  const GLINT0 = R.glint.material.color.clone(), id34 = (id) => id === 's33' || id === 's34' || id === 's35';

  // ---- rig solver -------------------------------------------------------------------------------------------------
  // pose p = { pos (root, world), quat, drop, fwd, lean, roll, turn (deg), legs: { mode: 'ground'|'fly', a: [thigh, knee] },
  //            arms: [R, L] { unfold, yaw, pitch, elbow, target (world), pole (body-local), palmDir (world), grip: { p, n } | open } }
  function solve(p) {
    const { root, rig, body } = R;
    root.position.copy(p.pos); root.quaternion.copy(p.quat); rig.position.set(0, 0, 0); rig.quaternion.identity();
    body.position.set(0, BODY_Y - (p.drop || 0), p.fwd || 0);
    body.rotation.set((p.lean || 0) * D2R, (p.turn || 0) * D2R, (p.roll || 0) * D2R, 'YXZ');
    root.updateMatrixWorld(true);
    for (const L of R.legs) solveLeg(L, p.legs || { mode: 'fly', a: [0, 0] }, p);
    R.arms.forEach((A, i) => solveArm(A, (p.arms && p.arms[i]) || {}, p));
    // smear drawing (s20 launch): the whole rig stretches up from the feet for one drawing
    const sm = p.smear || 0; rig.scale.set(1 - 0.12 * sm, 1 + 0.26 * sm, 1 - 0.12 * sm);
    root.updateMatrixWorld(true);
    R.updatePistons(); root.updateMatrixWorld(true);
  }
  const L1 = 14, L2 = 12, ANK = 6.1;
  function solveLeg(L, lg, p) {
    L.thigh.rotation.set(0, 0, 0); L.knee.rotation.set(0, 0, 0); L.ankle.rotation.set(0, 0, 0); L.foot.quaternion.identity();
    if (lg.mode === 'ground') {
      const off = lg.feet?.[L.name] || [0, 0, 0];
      const sole = new V3(L.sx * DIM.HIP[0] + off[0], (lg.ground || 0) + off[1], L.sz * DIM.HIP[1] + off[2]);
      const w = R.rig.localToWorld(sole.clone()).add(new V3(0, ANK, 0).applyQuaternion(R.root.quaternion));
      L.hip.updateMatrixWorld(true); const a = L.hip.worldToLocal(w);
      const ya = a.y, za = a.z; let d = Math.hypot(ya, za); d = clamp(d, 2, L1 + L2 - 0.02);
      const phiA = Math.atan2(-za, -ya), al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const p1 = phiA - al; const ky = -L1 * Math.cos(p1), kz = -L1 * Math.sin(p1);
      const p2 = Math.atan2(-(za - kz), -(ya - ky));
      L.thigh.rotation.x = p1; L.knee.rotation.x = p2 - p1;
    } else {
      const [a0, a1] = lg.a || [0, 0]; L.thigh.rotation.x = a0; L.knee.rotation.x = a1;
    }
    // feet level with the root (flat on the ground / thrust along the root's -y), keeping the hip yaw
    L.knee.updateMatrixWorld(true); L.knee.getWorldQuaternion(_q).invert();
    L.foot.quaternion.copy(_q).multiply(R.root.quaternion).multiply(new Q().setFromAxisAngle(new V3(0, 1, 0), L.hip.rotation.y));
    if (lg.mode !== 'ground' && lg.footFree) L.foot.quaternion.identity();
  }
  const FING = { closed: [0, 0], open: [0.78, -0.22] };
  const WRIST0 = 9, WRIST_EXT = 18;   // wrist position on the forearm: folded (hand inside the nub) -> extended
  function solveArm(A, a, p) {
    const u = clamp(a.unfold ?? 0, 0, 1);
    const kBoom = sstep(0.0, 0.4, u), kUp = sstep(0.15, 0.62, u), kExt = sstep(0.3, 0.75, u), kRot = sstep(0.5, 1.0, u), kOpen = sstep(0.55, 0.9, u);
    const boom = 18 * kBoom, Lu = 30 * kUp, ext = WRIST_EXT * kExt;
    A.boom.position.x = boom; A.upper.position.x = Lu; A.elbow.position.set(Lu, 0, 0); A.wrist.position.x = WRIST0 + ext;
    A.shoulder.quaternion.identity(); A.elbow.quaternion.identity(); A.wrist.quaternion.identity();
    if (a.target && u > 0.99) ik(A, a, Lu, ext);
    else { A.shoulder.rotation.set(0, -A.sx * (a.yaw || 0) * D2R * kRot, (a.pitch || 0) * D2R * kRot, 'YZX'); A.elbow.rotation.set(0, 0, (a.elbow || 0) * D2R * kRot);
      if (a.wrist) A.wrist.rotation.set(0, 0, a.wrist * D2R * kRot); }
    // fingers
    const open = a.open ?? 1, sp = lerp(FING.closed[0], FING.open[0], kOpen * open), cu = lerp(FING.closed[1], FING.open[1], kOpen * open);
    A.fingers.forEach(f => { f.prox.rotation.set(0, 0, sp + (a.spread || 0)); f.dist.rotation.set(0, 0, cu + (a.curl || 0)); });
    if (a.grip && u > 0.99) grip(A, a.grip);
  }
  // two-bone arm IK to a world target for the palm anchor (+ wrist aim, 2 refinement passes)
  function ik(A, a, Lu, ext) {
    const L2a = 2 + WRIST0 + ext + DIM.PALM + 1.2;
    let target = a.target.clone();
    for (let it = 0; it < 3; it++) {
      R.root.updateMatrixWorld(true);
      const T = A.shoulder.parent.worldToLocal(target.clone());   // boom frame (shoulder at the origin)
      let d = T.length(); const dir = T.clone().divideScalar(Math.max(d, 1e-4)); d = clamp(d, Math.abs(Lu - L2a) + 0.5, Lu + L2a - 0.05);
      const ca = (Lu * Lu - L2a * L2a + d * d) / (2 * d), h = Math.sqrt(Math.max(0, Lu * Lu - ca * ca));
      // pole (elbow direction) in the body frame per side: x = outward, y = up, z = the face side (the left base is turned 180)
      const pp = a.pole || [0.3, -0.6, -0.5], pole = new V3(pp[0], pp[1], pp[2] * A.sx); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      const E = dir.clone().multiplyScalar(ca).addScaledVector(pole, h), P = dir.clone().multiplyScalar(d);
      const xu = E.clone().normalize(), xf = P.clone().sub(E).normalize(); let zh = xu.clone().cross(xf);
      if (zh.lengthSq() < 1e-6) zh = pole.clone().cross(dir); zh.normalize();
      const yb = zh.clone().cross(xu);
      A.shoulder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xu, yb, zh));
      A.elbow.rotation.set(0, 0, Math.atan2(xu.clone().cross(xf).dot(zh), xu.dot(xf)));
      // wrist: palm faces palmDir (limited to 55 degrees)
      A.wrist.quaternion.identity();
      if (a.palmDir) { R.root.updateMatrixWorld(true); const pd = a.palmDir.clone().normalize();
        const inv = A.fore.getWorldQuaternion(new Q()).invert(); const dl = pd.applyQuaternion(inv);
        const qf = new Q().setFromUnitVectors(new V3(1, 0, 0), dl); const ang = 2 * Math.acos(clamp(qf.w, -1, 1));
        A.wrist.quaternion.copy(new Q().slerp(qf, ang > 55 * D2R ? 55 * D2R / ang : 1)); }
      R.root.updateMatrixWorld(true);
      const now = A.palm.getWorldPosition(new V3()); const err = a.target.clone().sub(now); if (err.length() < 0.05) break;
      target.add(err);
    }
  }
  // fingers spread until their tips touch the surface plane(s): tip in the finger-base frame = Rz(sp)[(L,0,0) + Rz(cu) tipOff]
  function grip(A, g) {
    R.root.updateMatrixWorld(true);
    for (const f of A.fingers) {
      let gp = g.p, gn = g.n;
      if (g.surface) { const o = f.fb.getWorldPosition(new V3()); const h = g.surface(o.clone().addScaledVector(gn, 12), gn.clone().negate()); if (h) { gp = h.p; gn = h.n; } }
      const inv = f.fb.getWorldQuaternion(new Q()).invert(); const pl = f.fb.worldToLocal(gp.clone()), nl = gn.clone().applyQuaternion(inv);
      const cu = g.curl ?? -0.5, Z = new V3(0, 0, 1), tipAt = (sp) => f.H.clone().add(f.TIP.clone().applyAxisAngle(Z, cu)).applyAxisAngle(Z, sp);
      const fn = (sp) => tipAt(sp).sub(pl).dot(nl) - (g.gap ?? 0.25);
      // the tip reaches farthest forward at spMax; from there opening wider pulls it back: bisect on that branch
      const t0 = f.H.clone().add(f.TIP.clone().applyAxisAngle(Z, cu)), spMax = Math.max(-0.2, Math.atan2(-t0.y, t0.x));
      let lo = spMax, hi = 1.9; if (fn(lo) > 0) { f.prox.rotation.z = lo; f.dist.rotation.z = cu; continue; }
      for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fn(m) < 0) lo = m; else hi = m; }
      f.prox.rotation.z = hi; f.dist.rotation.z = cu;
    }
  }

  // ---- meteor contact ---------------------------------------------------------------------------------------------
  // The meteor (meteor team) is the master in s22-s29: its update is pure, so it is posed for t first, then the mecha
  // places its palms on the real rock surface (raycast against the meteor meshes).
  const ray = new THREE.Raycaster();
  const UAPP = new V3(0, -1, 0.3).normalize();   // approach direction (meteor -> mecha), strato frame
  api.UAPP = UAPP;
  function meteorSurface(o, d) {
    const m = ctx.modules.meteor; if (!m?.root) return null;
    ray.set(o, d.clone().normalize()); ray.far = 6000; const hits = ray.intersectObject(m.root, true).filter(h => h.object.isMesh && h.face && !h.object.userData.noRay);
    if (!hits.length) return null; const h = hits[0];
    return { p: h.point.clone(), n: h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize() };
  }
  function catchLayout(t, shot) {
    const m = ctx.modules.meteor;
    if (m?.update) { try { m.update(t, shot); } catch (e) { /* meteor not ready */ } }
    let core = m?.root ? m.root.getWorldPosition(new V3()) : new V3(0, 35700, -210);
    if (m?.anchor) { const c = m.anchor('core'); if (c && Number.isFinite(c.x)) core = c; }
    m?.root?.updateMatrixWorld(true);
    const hit = meteorSurface(core.clone().addScaledVector(UAPP, 4000), UAPP.clone().negate());
    const rad = m?.RADIUS ?? 500;
    return { core, C: hit ? hit.p : core.clone().addScaledVector(UAPP, rad), n: hit ? hit.n : UAPP.clone(), hit: !!hit };
  }

  // ---- choreography -----------------------------------------------------------------------------------------------
  const qY = (a) => new Q().setFromAxisAngle(new V3(0, 1, 0), a);
  const qX = (a) => new Q().setFromAxisAngle(new V3(1, 0, 0), a);
  const rootFor = (bodyCentre, quat, drop = 0) => bodyCentre.clone().sub(new V3(0, BODY_Y - drop, 0).applyQuaternion(quat));
  const floorAt = (x, z) => ctx.modules.under?.floor?.(x, z) ?? (-6 - Math.min(Math.max(z, 0), 300) * 0.32 - 3 * Math.sin(x * 0.05) * Math.cos(z * 0.04));
  const shake = (ct, amp, seed = 1) => (hash(Math.floor(ct * 12) + seed) - 0.5) * 2 * amp;
  const FOLD = [{ unfold: 0 }, { unfold: 0 }];

  // under: asleep on the bay floor (86 m of water: the 90 m block cannot stand upright under it), sunk back-first into the
  // silt and tilted back 40 degrees, facing the shore (-z), the visor looking up toward the light. Numbers: body centre
  // 15 m above the bed -> top front edge ~13 m below the surface, reactor housing ~5 m above the silt, legs buried.
  const LIE = { z: 252, tilt: 40, lift: 15 };
  function lying(ct) {
    const quat = qY(PI).multiply(qX(-LIE.tilt * D2R));
    const bc = new V3(0, floorAt(0, LIE.z) + LIE.lift + 0.25 * Math.sin(ct * 0.9), LIE.z);
    return { pos: rootFor(bc, quat), quat, legs: { mode: 'fly', a: [0.2, -0.3] }, arms: FOLD };
  }
  // coast headings: it rises and stands facing the pier / town (s15 s16, the kneel s34), then turns seaward toward the
  // meteor for the crouch + launch (s19 s20)
  const HEAD_SEA = 0.35, HEAD_TOWN = PI - 0.2;
  function standing(y = SITE.y, drop = 0, extra = {}, heading = HEAD_SEA) {
    const quat = qY(heading); return { pos: new V3(SITE.x, y, SITE.z), quat, drop, legs: { mode: 'ground', ground: 0 }, arms: FOLD, ...extra };
  }
  // strato catch: body below the contact, hands on the rock. comp = how far the meteor has shoved it in (m, + = closer:
  // the elbows bend); keep comp >= 2.5, below that the arms can no longer reach the rest targets
  const PALM_GAP = 5.5;
  function catchPose(t, shot, ct, { gap = 0, comp = 0, lean = 8, reach = 1 } = {}) {
    const L = catchLayout(t, shot);
    const up = UAPP.clone().negate(), fwd = new V3(0, 0, 1).addScaledVector(up, -up.z).normalize();
    const quat = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(up.clone().cross(fwd).normalize(), up, fwd));
    // body-local hand rest targets (shoulder joints sit at x = +-74): arms up beside the head
    const hy = 61 - comp * 0.7, hx = 76, hz = 4;
    const bodyQ = quat.clone().multiply(qX(lean * D2R));   // the same pitch solve() gives the body (lean > 0 = face pitched down)
    const midLocal = new V3(0, hy, hz).applyQuaternion(bodyQ);
    const bc = L.C.clone().addScaledVector(L.n, PALM_GAP + gap).sub(midLocal);
    lastCatch.copy(L.C);
    // the body pitches FORWARD by `lean` (braced under the rock like a weightlifter, the face toward the cameras below)
    const pose = { pos: rootFor(bc, quat), quat, lean, legs: { mode: 'fly', a: [-0.25, 0.5] }, arms: [], layout: L };
    for (const sx of [1, -1]) {
      const local = new V3(sx * hx, hy, hz).applyQuaternion(bodyQ), aim = bc.clone().add(local);
      let target = aim.clone(), n = L.n.clone();
      const h = meteorSurface(aim.clone().addScaledVector(L.n, 60), L.n.clone().negate());
      // the palm stops PALM_GAP short of the rock; the three clamp fingers splay until their tips bite into the surface
      if (h && gap < 1) { target = h.p.clone().addScaledVector(h.n, PALM_GAP); n = h.n; } else target.addScaledVector(L.n, gap);
      pose.arms.push({ unfold: 1, target, pole: [0.55, -0.35, -0.75], palmDir: n.clone().negate(),
        grip: gap < 1 ? { p: target.clone().addScaledVector(n, -PALM_GAP), n, curl: -0.55, gap: -1.2, surface: meteorSurface } : null, open: 1 });
    }
    return pose;
  }

  function choreo(t, shot) {
    const ct = ctx.onTwos(t), id = shot.id, lt = ct - shot.t0, S = {};
    let pose, face = ['determined', {}], reactor = ct > cues.reactor ? 1 : 0, thrust = 0, wet = 0, heat = 0, heatDir = null, surge = 0, surgeR = 0, kelp = 0;
    const set = shot.groups.includes('under') ? 'under' : shot.groups.includes('coast') ? 'coast' : shot.groups.includes('sky') ? 'sky' : shot.groups.includes('strato') ? 'strato' : 'none';
    if (set === 'under') {
      pose = lying(ct); kelp = 1;
      // eyes: dark -> power-on flicker at the cue -> on; one slow blink
      const ek = ct - cues.eyes, flick = [0.55, 0.1, 0.95, 0.35, 1.2, 1.0];
      const pw = ek < 0 ? 0.0 : ek < 0.5 ? flick[Math.min(5, Math.floor(ek * 12))] : 1;
      const blink = sstep(23.95, 24.05, ct) * (1 - sstep(24.15, 24.25, ct));
      face = ek < 0 ? ['sleepy', { power: 0 }] : ct < cues.reactor ? ['neutral', { power: pw, blink, lookY: 0.5 * sstep(23.4, 24.0, ct) }] : ['determined', { power: 1.05, lookY: 0.3 }];
      // reactor ignition: sputter then catch
      const rk = ct - cues.reactor; reactor = rk < 0 ? 0 : rk < 0.35 ? [0.4, 0.05, 0.8, 0.25][Math.min(3, Math.floor(rk * 12))] : Math.min(1.25, 1 + 0.25 * sstep(0.35, 0.6, rk));
      S.petals = rk < 0.3 ? 0 : spring(ct, cues.reactor + 0.3, 2.2, 0.45);
      if (rk > 0) { pose.roll = shake(ct, 0.12 * (1 - sstep(0.4, 1.2, rk)), 5); }
    } else if (set === 'coast') {
      wet = 1; kelp = 1;
      if (id === 's15') {   // the rise: the top of the head breaks the surface, then the visor, then the shoulder sockets
        const k = (ct - shot.t0) / (shot.t1 - shot.t0); const y = PATH.riseY(k);
        pose = standing(y, 0, { legs: { mode: 'fly', a: [0.12, -0.24] }, lean: lerp(11, 3, ease(k)), roll: 2.0 * Math.sin(ct * 1.3) }, HEAD_TOWN);
        face = ['determined', { lookY: 0.1 + 0.25 * sstep(33.5, 35, ct) }]; }
      else if (id === 's16') {   // the last stride up onto its feet, then it straightens and looks up at the sky
        const k = sstep(35.5, 37.2, ct); const y = lerp(-50, SITE.y, easeOut(k)); const land = ct > 37.2 ? spring(ct, 37.2, 1.6, 0.5) : 0;
        pose = standing(y, 2.5 * Math.sin(Math.min(1, land) * PI) * (1 - sstep(37.2, 38, ct)), { legs: k < 0.999 ? { mode: 'fly', a: [0.12 * (1 - k), -0.24 * (1 - k)] } : { mode: 'ground', ground: 0 }, lean: lerp(6, -3, sstep(36.4, 37.6, ct)) }, HEAD_TOWN);
        face = ['determined', { lookY: 0.6 * sstep(36.2, 37.2, ct), lookX: 0.08 }]; }
      else if (id === 's19') {   // crouch (9 m down, then a held key), the arms unfold, the soles light up under the surf
        const kc = sstep(41.55, 41.95, ct), un = clamp((ct - cues.unfold) / 1.25, 0, 1), set = 0.6 * Math.max(0, Math.sin(clamp((ct - 41.95) / 0.25, 0, 1) * PI));
        pose = standing(SITE.y + 6, 9 * easeIO(kc) + set, { lean: 7 * kc, arms: [0, 1].map(() => ({ unfold: un, yaw: 28, pitch: -38, elbow: 48, open: 1 })) });
        thrust = 0.15 + 0.75 * sstep(42.2, 43.45, ct); face = ['determined', { lookY: 0.35 * kc }]; wet = 1; kelp = 1 - sstep(42.8, 43.4, ct); S.surf = 1; }
      else if (id === 's20') {   // launch: 4-frame hold in the deepest crouch, a 2-frame stretch (smear), then it is gone
        const tl = ct - cues.launch;
        const y = PATH.launchY(t, cues.launch), crouch = ct < 43.67, smear = !crouch && ct < 43.75 ? 1 : 0;
        const up = sstep(43.67, 43.92, ct);   // arms swing from low-back up over the head (fists up, as in the climb)
        pose = standing(y, crouch ? 12.5 : lerp(-1, -2, sstep(43.75, 44, ct)), { lean: crouch ? 9 : lerp(-2, -6, up),
          legs: crouch ? { mode: 'ground', ground: 0 } : { mode: 'fly', a: [lerp(-0.05, -0.12, up), lerp(0.05, 0.25, up)] }, smear,
          arms: [0, 1].map((_, i) => ({ unfold: 1, yaw: lerp(18, 22, up), pitch: lerp(-72, 52 + 4 * i, up), elbow: lerp(64, 16, up), open: lerp(1, 0.05, up) })) });
        thrust = crouch ? 0.9 : 1.0 + 0.5 * (1 - sstep(0.1, 0.5, tl)); face = ['determined', { lookY: 0.6 }]; wet = 1 - 0.5 * sstep(0, 1.2, tl); kelp = 0;
        S.trails = crouch ? 0 : 1; S.column = crouch ? 0 : 1; S.shock = 1; }
      else if (id === 's32') {   // splash-down (water team's shot): falls back-first into the bay
        const k = clamp((t - shot.t0) / 0.7, 0, 1.4); const bc = new V3(SITE.x, lerp(190, -40, k), SITE.z + 10);
        const quat = qY(PI).multiply(qX(-1.05)); pose = { pos: rootFor(bc, quat), quat, legs: { mode: 'fly', a: [-0.3, 0.6] }, arms: [0, 1].map(() => ({ unfold: 1, yaw: 10, pitch: 30, elbow: 25, open: 0.6 })) };
        face = ['relief', { power: 0.8 }]; reactor = 0.6; heat = 0; kelp = 0; wet = 0.5; }
      else {   // s33 s34 s35: kneeling in the bay, steaming; the visor eyes soften into a smile at the cue
        const breathe = 0.5 + 0.5 * Math.sin(ct * 1.3), H = PI - 0.25;
        pose = standing(SITE.y, 15 + 0.8 * breathe, { lean: lerp(12, 7, sstep(cues.smile - 0.2, cues.smile + 0.6, ct)), legs: { mode: 'ground', ground: 0, feet: { FR: [0, 0, 6], FL: [0, 0, 6], BR: [0, 0, -4], BL: [0, 0, -4] } } }, H);
        // the hands rest in the water beside the front feet, fingers down (palms pressed into the sea)
        const qH = qY(H), bcK = new V3(SITE.x, SITE.y + BODY_Y - 15, SITE.z);
        pose.arms = [1, -1].map(sx => ({ unfold: 1, target: bcK.clone().add(new V3(sx * 86, -50 + 0.6 * breathe, 30).applyQuaternion(qH)), pole: [0.2, 0.6, -0.8],
          palmDir: new V3(sx * 0.25, -1, 0.3).applyQuaternion(qH), open: 0.55 }));
        const sm = sstep(cues.smile, cues.smile + 0.5, ct);
        face = sm <= 0 ? ['gentle', { power: 0.95, lookY: 0.2 }] : ['happy', { mix: 'gentle', t: 1 - sm, power: 0.95 + 0.15 * sm, lookY: 0.2 }];
        reactor = 0.7; wet = 0.8; kelp = 0; S.steam = 1; S.ripples = 1;
      }
    } else if (set === 'sky') {
      if (id === 's31') {   // falling back-first at dusk, face up, limbs trailing, smoking, the armour cooling
        const k = ct - shot.t0; const bc = PATH.s31(t);
        // pitched back ~35 deg (back-first toward the bay) but the face still turned to the low camera on its face side
        const quat = qY(0.6 + 0.1 * k).multiply(qX(-0.62 - 0.05 * k)).multiply(new Q().setFromAxisAngle(new V3(0, 0, 1), 0.18 + 0.04 * k));
        pose = { pos: rootFor(bc, quat), quat, legs: { mode: 'fly', a: [-0.45, 0.8] },
          arms: [0, 1].map((_, i) => ({ unfold: 1, yaw: 38 + 6 * i + 4 * Math.sin(ct * 2.2 + i), pitch: 8 - 6 * i, elbow: 24, open: 0.6 })) };
        heat = 0.6 * (1 - sstep(67, 69.2, ct)); heatDir = new V3(0, 1, 0).applyQuaternion(quat).add(new V3(0, 0.6, 0)).normalize();
        face = ['relief', { power: 0.85, blink: 0.35 }]; reactor = 0.6; S.steam = 1; S.smoke = 1; S.speed = 1; S.speedDir = new V3(0, 1, 0);
        // the shooting-star shower all around the fall (meteor API), denser than the default
        if (shot.id === ctx.state?.id) ctx.modules.meteor?.shootingStars?.(t, { rate: 150, elev: [-0.1, 0.85], k: 1, seed: 31 });
      } else {   // s21: climbing through the cloud tops
        const k = ct - 45; const bc = PATH.s21(t);
        const quat = qY(-0.35 + 0.22 * k).multiply(qX(0.18));
        pose = { pos: rootFor(bc, quat), quat, lean: -6, legs: { mode: 'fly', a: [-0.12, 0.25] }, arms: [0, 1].map((_, i) => ({ unfold: 1, yaw: 22, pitch: 52 + 4 * i, elbow: 16, open: 0.05 })) };
        thrust = 1.15; face = ['determined', { lookY: 0.7 }]; S.trails = 1; S.wisps = 1;
      }
    } else if (set === 'strato') {
      thrust = 1.2; heatDir = UAPP.clone().negate(); face = ['determined', { lookY: 0.75 }];
      if (id === 's22' || id === 's23') { const gap = id === 's22' ? lerp(1400, 260, easeIn((ct - 48) / 2)) : lerp(260, 6, (ct - 50) / 1.0);
        pose = catchPose(t, shot, ct, { gap }); S.trails = 1; }
      else if (id === 's24') { const k = ct - cues.impact, sp = spring(ct, cues.impact, 1.6, 0.35);
        pose = catchPose(t, shot, ct, { comp: 10 * sp, lean: 5 + 4 * sp }); pose.roll = shake(ct, 3 * Math.exp(-k * 2.2), 3);
        face = k < 0.17 ? ['shocked', { lookY: 0.6 }] : ['strain', { lookY: 0.4 }]; thrust = 1.35; heat = 0.25 * sstep(0, 1.5, k); S.contact = k > 0 ? 1 : 0; S.contactT = cues.impact; }
      else if (id === 's25') { const k = (ct - 52.5) / 2.5;
        pose = catchPose(t, shot, ct, { comp: lerp(10, 17, ease(k)), lean: 8 + 1.5 * k }); pose.roll = shake(ct, 1.4, 7); pose.drop = shake(ct, 0.5, 9);
        face = ['strain', { lookY: 0.4 }]; heat = lerp(0.35, 1.0, ease(k)); thrust = 1.45 + 0.1 * Math.sin(ct * 23);
        // the hinged plates buckle in three jolts (held between them), each one with a burst of steam + sparks off the top edge
        S.bend = [53.1, 53.7, 54.3].reduce((a, t0, i) => a + (ct >= t0 ? (i === 0 ? 0.4 : 0.3) : 0), 0); S.bendT = [53.1, 53.7, 54.3]; S.topSteam = 1; S.contact = 1; }
      else if (id === 's27') { const k = (ct - cues.surge);
        pose = catchPose(t, shot, ct, { comp: lerp(17, 13, ease(k / 2)), lean: 8 }); pose.roll = shake(ct, 0.8 * (1 - sstep(0, 1, k)), 11);
        // the cyan front runs along the conduit: shoulders at ~1.0 s, in the hands by ~1.9 s
        reactor = 1.25 + 0.6 * sstep(0, 0.35, k); surge = sstep(0, 0.12, k); surgeR = k < 1 ? 10 + 90 * k : 100 + 69 * (k - 1);
        heat = lerp(0.6, 0.15, sstep(0.1, 1.2, k)); face = k < 0.8 ? ['strain', { lookY: 0.4 }] : ['angry', { lookY: 0.45, power: 1.1 }]; thrust = 1.5; S.contact = 1; }
      else if (id === 's28') {   // THE PUSH. keys: compress (elbows bend) -> 4-frame hold -> straighten over 4 drawings -> hold
        const k = (ct - 59) / 2.5, push = sstep(59.42, 59.75, ct), stepP = Math.floor(push * 4 + 1e-6) / 4;
        const comp = ct < 59.42 ? lerp(13, 18, sstep(59.0, 59.25, ct)) : lerp(18, 2.5, stepP);
        pose = catchPose(t, shot, ct, { comp, lean: lerp(7.5, 3, stepP) }); pose.roll = shake(ct, ct < 59.42 ? 1.0 : 0.4, 37);
        S.pushK = stepP; S.contact = 1; S.speed = push > 0 ? 1 : 0;
        // the reactor surges again for the push; the soles flash 1.6 -> 2.2
        // a second cyan pulse races reactor -> hands with the push (0.5 s), then the seams go dark again
        reactor = ct < 59.42 ? 1.6 : 2.1; surge = ct < 59.42 ? 0 : 1 - sstep(59.95, 60.4, ct); surgeR = 10 + 320 * Math.max(0, ct - 59.42); heat = lerp(0.3, 0.15, k);
        face = ['angry', { lookY: 0.5, power: 1.1 }]; thrust = ct < 59.42 ? 1.6 : ct < 59.75 ? 2.2 : lerp(2.2, 1.7, sstep(59.75, 60.5, ct)); }
      else {   // s29: the meteor bursts above the raised arms
        const k = ct - 61.5; const t28 = 61.45, sh28 = ctx.shot.s28;
        pose = catchPose(t28, { ...shot, ...sh28, id: 's28', lt: t28 - sh28.t0, k: 1 }, ct, { comp: 2.5, lean: 3 }); ctx.modules.meteor?.update?.(t, shot);
        pose.arms.forEach(a => { a.grip = null; a.open = 1; }); pose.pos.addScaledVector(UAPP, 60 * easeOut(clamp(k / 2, 0, 1)));
        reactor = lerp(2.0, 1.0, sstep(0, 2, k)); surge = 0; surgeR = 0; heat = 0.3 * (1 - sstep(0, 2, k)); face = ['happy', { lookY: 0.5 }]; thrust = lerp(1.4, 0.5, sstep(0, 2, k)); }
    }
    return { pose, face, reactor, thrust, wet, heat, heatDir, surge, surgeR, kelp, set, S };
  }

  api.update = (t, shot) => {
    const on = SHOW.has(shot.id) && !ctx.q.has('nomecha');
    R.root.visible = on; FX.hideAll();
    if (!on) { eyeLight.intensity = 0; R.legs.forEach(L => L.thr.set(0)); return; }
    const c = choreo(t, shot); st.set = c.set;
    if (!c.pose) { R.root.visible = false; return; }
    solve(c.pose);
    api.setFace(c.face[0], c.face[1]);
    R.antenna.rotation.x = c.set === 'strato' ? -1.45 : 0;   // the mast folds flat for the catch
    face.frame(new V3(0, 1, 0).applyQuaternion(R.body.getWorldQuaternion(_q)), R.anchors.visor.getWorldPosition(_v), ctx.onThrees(t));
    api.setReactor(c.reactor); api.setThrust(c.thrust, ctx.onTwos(t), c.set === 'coast' ? 50 : 62);
    // backlit bay shots (s15 s16 s34): the armour takes the anime hero key from the camera side (LOOKS.hero), not the sun
    { const hk = HERO_SHOTS.includes(shot.id) ? 1 : 0;
      if (hk !== st.heroK) { st.heroK = hk; R.root.traverse(o => { for (const m of [].concat(o.material || [])) if (m.uniforms?.uHero) m.uniforms.uHero.value = hk; }); } }
    api.setWet(c.wet); api.setHeat(c.heat, c.heatDir, c.set === 'strato' && c.pose.layout ? c.pose.layout.C : null); api.setSurge(c.surge, c.surgeR);
    MU.uMBodyInv.value.copy(R.body.matrixWorld).invert();
    api.setBend(c.S.bend || 0);
    MU.uMTime.value = ctx.onThrees(t);
    // visor glint: upper corner on the key light's side (mirrored), dimmer under water and at dusk
    { const kd = ctx.light.u.uKeyDir.value, rx = new V3(1, 0, 0).applyQuaternion(R.body.getWorldQuaternion(_q)).dot(kd);
      const gk = c.set === 'under' ? 0.35 : id34(shot.id) ? 0.4 : 1; st.glint = gk;
      R.glint.scale.x = rx > 0 ? -1 : 1; R.glint.material.color.copy(GLINT0).multiplyScalar(gk); }
    // reactor petals shift outward when it ignites
    const pk = c.S.petals ?? (st.reactor > 0.5 ? 1 : 0);
    R.petals.forEach(p => { p.mesh.position.set(1.8 * pk, 0, 0.3 * pk); });
    if (ctx.q.get('mfx') !== '0') FX.update(t, shot, c, api);
    if (ctx.q.has('mwet')) api.setWet(+ctx.q.get('mwet'));
    if (ctx.q.has('mthr')) api.setThrust(+ctx.q.get('mthr'));
    if (ctx.q.has('mheat')) MU.uMHeat.value = +ctx.q.get('mheat');
  };
  api.afterCamera = (t, shot) => { if (!R.root.visible) return; R.glowR.update(ctx.camera, 6); FX.afterCamera?.(t, shot); };
  api.dispose = () => { R.root.removeFromParent(); FX.dispose?.(); };
  return api;
}
