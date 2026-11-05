// =====================================================================================================================
// MEGA CLAWD · METEOR (owner: meteor) — the ~1 km burning rock: knapped basalt with glowing tapered fissures and a
// white-hot leading face, its plasma sheath + burning trail + smoke + bow-shock cone (drawn anime FX in opaque cel
// layers), the blue seams with lightning (s28), the burst into glowing fragments (s29) and the shooting-star shower over
// the dusk town (s30, s31, s35).
// Every frame is a pure function of film time t: position on ones (cameras track it), tumble + FX drawings on twos,
// lightning on threes.
//
// API  ctx.modules.meteor
//   root, body, RADIUS (m), rock { planes, contact: { n, d } (unit space) }   the rock lives in ctx.scene
//   update(t, shot)          pure; safe to call from another module first (the mecha does: the meteor is the master in
//                            strato and the mecha raycasts root to put its palms on the real rock surface)
//   anchor(name) -> Vector3  current frame: 'core' centre, 'front' leading surface point, 'contact' centre of the flat
//                            contact facet (the face toward the mecha), 'contactNormal', 'up' unit (mecha -> meteor),
//                            'tail' trail direction
//   pathAt(t) -> { pos, quat, vel, heat }   pure path for s06 (space) and s17 (sky)
//   SPACE_CAM(t) -> { pos, look, up }       the s06 camera rig that frames the path (used by cams/meteor.js)
//   setHeat(k)               override the heat for this frame (0 cold .. 0.6 red-hot crust .. 1 entry, white-hot tip)
//   chunks, burstAt          the burst pieces (meshes in ctx.scene, posed in s29) and CUES.shatter
//   shootingStars(t, { rate, count, dir: [x,y,z], elev: [sin lo, sin hi], k, seed })   show the shower this frame (call
//                            from update(); s30 s31 s35 show it automatically). Streaks are anchored to sky directions
//                            around the camera; `rate` = streaks per second over the whole sky band (s30 ~ 80 visible)
//   sky(t, { dir: [x,y,z] world unit, kind: 'point' | 'streak', k })   the far meteor seen from the coast; automatic in
//                            s07 (one orange point in the sky, camera-relative); call it to place it yourself
//   STRATO = { core, up }    catch geometry: rock centre at CUES.impact and the up axis (mecha -> meteor)
// Strato (s22-s29): the meteor comes down along -up, is caught at CUES.impact, shoves the mecha ~140 m back (s24-s25),
// is held (s26-s27), pushed up (s28) and bursts at CUES.shatter (s29). Its flat contact facet faces the mecha.
// Heat: entry 1.0; s22-s23 heat only on the grazing rim + a white leading edge (silhouette staging); caught (s24+) it cools
// to a red-hot crust (0.62 by 54.5 s); s28 blue seams grow out of the contact facet (uSplit) with lightning in them.
// Automatic FX requests to ctx.modules['fx-energy'] (keys 'meteor-*'): impact flash + rings at CUES.impact (s24), strain
// sparks at the mecha's palms (s25, s28); only for the live shot (the mecha also poses us with other shot objects).
// s17 uses the world's massif: ctx.modules.sky.setHot(meteor glow) + setSplit(k) every frame (the walls part as the meteor
// punches through the top of the massif, 38.6-39.5 s).
// =====================================================================================================================
import * as THREE from 'three';
import { rockShape, rockGeometry, rockMaterial, buildChunks, buildShards, chunkMaterial, crackNet, packCracks } from './meteor-rock.js';
import { strokes, flame, sheath as sheathFx, ring, glare, glarePool, impactFrame, PAL, flashEnv, lerpPal } from './fx-energy-draw.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion, D2R = Math.PI / 180;
const hh = (k, i) => { const s = Math.sin(k * 12.9898 + i * 78.233 + 0.5) * 43758.5453; return s - Math.floor(s); };   // stateless per-item random

export async function create(ctx) {
  const { util, cues } = ctx, { ease, easeOut, easeIn, sstep, clamp, lerp } = util;
  const RADIUS = 600, IMPACT = cues.impact, SHATTER = cues.shatter, CRACK = cues.crack;
  const rock = rockShape(6);
  const heatCracks = crackNet(rock, { seed: 21, mains: 5 });
  const splitCracks = crackNet(rock, { split: true, start: rock.contact.n, mains: 7, seed: 11, steps: 30, step: 0.05, w0: 0.026 });
  const rockMat = rockMaterial(ctx, rock, packCracks([...heatCracks, ...splitCracks]));
  const RU = rockMat.uniforms;
  const root = new THREE.Group(); root.name = 'meteor'; ctx.scene.add(root);
  const body = new THREE.Mesh(rockGeometry(rock, 56), rockMat); body.name = 'meteor-rock'; body.scale.setScalar(RADIUS); root.add(body);
  ctx.solids.add('meteor', body, { kind: 'points', points: 2000, groups: ['strato'] });
  const spill = ctx.light.addPoint({ pos: root, color: 0xff8a48, intensity: 0, range: 6000 });
  ctx.label('METEOR', root);

  // drawn FX (overlay)
  const trail = flame(ctx, { mode: 'fire', order: 3, soft: 80, seed: 3, name: 'meteor-trail' });
  const smoke = flame(ctx, { mode: 'smoke', order: 1, soft: 150, seed: 7, palette: PAL.smoke, name: 'meteor-smoke' });
  const shell = flame(ctx, { mode: 'shell', order: 5, soft: 200, seed: 9, palette: PAL.vapour, name: 'meteor-shell' });   // s17: the drawn bow-shock cone
  // the sheath hulls push out along the radial direction (the lumpy rock's vertex normals fold at its concave creases)
  const sheathGeo = body.geometry.clone(); { const p = sheathGeo.attributes.position, n = sheathGeo.attributes.normal, v = new V3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); } n.needsUpdate = true; }
  const sheath = sheathFx(ctx, sheathGeo, { order: 4, soft: 60, seed: 5, name: 'meteor-sheath' });
  const lines = strokes(ctx, { max: 20000, order: 7, soft: 4, name: 'meteor-lines' });
  const shards = strokes(ctx, { max: 60000, order: 6, soft: 60, name: 'meteor-shards' });
  const heads = glarePool(ctx, 16, { order: 9, name: 'meteor-head' });
  const ringA = ring(ctx, { order: 2, soft: 300, name: 'meteor-ringA' }), ringB = ring(ctx, { order: 2, soft: 300, name: 'meteor-ringB' });
  const flashG = glare(ctx, { order: 10, name: 'meteor-flash' });
  const impactF = impactFrame(ctx, { name: 'meteor-impact-frame' });
  const ALL_FX = [trail, smoke, shell, sheath, ringA, ringB, flashG, impactF];

  // burst: convex Voronoi pieces of the same rock (big + mid) and instanced small shards
  const chunkMat = chunkMaterial(ctx), shardMat = chunkMaterial(ctx, { instanced: true });
  const burst = new THREE.Group(); burst.name = 'meteor-burst'; burst.visible = false; ctx.scene.add(burst);
  const pieces = buildChunks(rock, { n: 64, perLump: 3, seed: 9 }), maxSize = Math.max(...pieces.map(c => c.size));
  const chunks = pieces.map((c, i) => { const m = new THREE.Mesh(c.geo, chunkMat); m.scale.setScalar(RADIUS); m.name = 'meteor-chunk' + i; m.userData.noRay = true; burst.add(m);
    const R = ctx.rng(100 + i); return { ...c, rel: c.size / maxSize, mesh: m, spinAx: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), spin: 0.5 + 1.6 * R(), sp: R() }; });
  const NSM = 70, smallShapes = buildShards({ n: 6, seed: 31 });
  const smalls = smallShapes.map((s, k) => { const im = new THREE.InstancedMesh(s.geo, shardMat, NSM); im.name = 'meteor-shards' + k; im.frustumCulled = false; im.userData.noRay = true;
    const heat = new Float32Array(NSM); for (let i = 0; i < NSM; i++) heat[i] = 0.15 + 0.8 * hh(k * 100 + i, 41);
    s.geo.setAttribute('aHeatI', new THREE.InstancedBufferAttribute(heat, 1)); burst.add(im); return im; });

  // ---------------------------------------------------------------------------------------------------------------
  const TUMBLE_AX = new V3(0.35, 1, 0.22).normalize();
  const _q = new Q(), _v = new V3(), _m4 = new THREE.Matrix4();
  const S = { on: false, set: null, pos: new V3(), quat: new Q(), vel: new V3(0, -1, 0), speed: 0, heat: 1, up: new V3(0, 1, 0), C: new V3(), scale: 1, heatOverride: null };
  const tumble = (q0, tt, w) => q0.clone().multiply(new Q().setFromAxisAngle(TUMBLE_AX, w * tt));

  // ---- s06 space: the camera hangs high over the limb looking down 21 deg (the limb fills the lower third); the rock
  // dives from upper left toward the limb (trail streaming back up-left) and ignites as it reaches the glow band.
  const SPC = { cam: new V3(0, 121000, 0), pitch: -21 * D2R, D: 3400 };
  const SPF = new V3(0, Math.sin(SPC.pitch), -Math.cos(SPC.pitch)), SPR = new V3(1, 0, 0), SPU = new V3().crossVectors(SPR, SPF);
  const DIVE = new V3().addScaledVector(SPR, 0.74).addScaledVector(SPU, -0.56).addScaledVector(SPF, 0.38).normalize();
  const SP0 = SPC.cam.clone().addScaledVector(SPF, SPC.D).addScaledVector(SPR, -560).addScaledVector(SPU, 330);
  const SPACE_Q = new Q().setFromEuler(new THREE.Euler(0.4, 1.1, -0.3));
  const SPACE_CAM = (t) => { const k = clamp((t - 12) / 2); const pos = SPC.cam.clone().addScaledVector(DIVE, 150 * k).addScaledVector(SPF, 120 * ease(k));
    return { pos, look: pos.clone().addScaledVector(SPF, 1000).addScaledVector(SPU, -12 * k), up: SPU.clone() }; };
  // ---- s17 sky: from high behind the world's cumulus massif down through the top of the massif (38.75 s) and out toward
  // the camera, so the rock grows to ~40 % of the frame with its white-hot face unoccluded
  const massif = () => ctx.modules.sky?.MASSIF ?? { x: 3200, z: 9500, base: 1400, w: 7600, h: 8600 };
  const SKY_D = new V3(-0.42, -0.5, -0.76).normalize(), SKY_V = 6000, SKY_T = 38.8;
  const skyPath = (t) => { const M = massif(), top = new V3(M.x + 600, M.base + M.h * 0.92, M.z - 5000);
    return { pos: top.addScaledVector(SKY_D, SKY_V * (t - SKY_T)), vel: SKY_D.clone().multiplyScalar(SKY_V) }; };
  const SKYQ = new Q().setFromEuler(new THREE.Euler(-0.5, 0.4, 0.9)), SKY_SCALE = 2.2;
  function pathAt(t) {
    const tt = ctx.onTwos(t);
    if (t < 30) { const k = t - 12; return { pos: SP0.clone().addScaledVector(DIVE, 380 * k), quat: tumble(SPACE_Q, tt, 0.24), vel: DIVE.clone().multiplyScalar(18000), heat: sstep(cues.ignite - 0.1, 13.3, t) }; }
    const p = skyPath(t); return { pos: p.pos, quat: tumble(SKYQ, tt, 0.16), vel: p.vel, heat: 1.0 };
  }

  // strato: the meteor is the master. Core at the catch, up axis = from the mecha to the meteor (the mecha's UAPP negated)
  const STRATO = { core: new V3(0, 35700, -210), up: new V3(0, 1, -0.3).normalize(), twist: 0.6 };
  const qContact = new Q().setFromAxisAngle(STRATO.up, STRATO.twist).multiply(new Q().setFromUnitVectors(rock.contact.n, STRATO.up.clone().negate()));
  const stratoX = (t) => {   // metres along up from the catch point: falls in, shoves the mecha back, held, pushed up
    if (t < IMPACT) return 360 * (IMPACT - t);
    const x55 = -140 * (1 - Math.exp(-4 * 1.2));
    if (t < 55) return -140 * (1 - Math.exp(-(t - IMPACT) * 1.2));
    return t < 59 ? x55 : x55 + 280 * easeIn(clamp((t - 59) / 2.6));
  };
  function strato(t, tt) {
    const U = STRATO.up, side = new V3().crossVectors(U, new V3(1, 0, 0)).normalize();
    S.up.copy(U); S.pos.copy(STRATO.core).addScaledVector(U, stratoX(Math.min(t, SHATTER)));
    if (t < IMPACT) { S.quat.copy(qContact).multiply(_q.setFromAxisAngle(TUMBLE_AX, 0.12 * (tt - IMPACT))); S.vel.copy(U).multiplyScalar(-360); S.heat = 1.0; }
    else { const shake = 0.0035 * Math.sin(tt * 61) * (sstep(51, 51.3, t) * (1 - sstep(52, 53, t)) + sstep(59.0, 59.6, t));
      S.quat.copy(qContact).multiply(_q.setFromAxisAngle(side, shake)); S.vel.copy(U).multiplyScalar(-1);
      S.heat = 0.92 - 0.62 * sstep(IMPACT + 0.3, 53.8, t) + 0.12 * sstep(CRACK, SHATTER, t); }
    S.speed = S.vel.length();
    S.C.copy(S.pos).addScaledVector(U, -rock.contact.d * RADIUS);
  }

  // ---------------------------------------------------------------------------------------------------------------
  let starReq = null, skyReq = null, frame = -1, look = { fis: 1, rim: 0, split: 0, blue: 0 };
  const api = {
    root, body, RADIUS, rock, STRATO, burstAt: SHATTER, pathAt, chunks, SPACE_CAM,
    setHeat(k) { S.heatOverride = { f: ctx.state?.f, k }; },
    anchor(name) {
      if (name === 'core') return S.pos.clone();
      if (name === 'front') { _v.copy(S.vel).normalize(); return S.pos.clone().addScaledVector(_v, RADIUS * S.scale * rock.radial(_v.clone().applyQuaternion(S.quat.clone().invert()))); }
      if (name === 'contact') return S.C.clone();
      if (name === 'contactNormal') return S.up.clone().negate();
      if (name === 'up') return S.up.clone();
      if (name === 'tail') return S.vel.clone().normalize().negate();
      return S.pos.clone();
    },
    shootingStars(t, o = {}) { starReq = { f: Math.round(t * 24), o }; return 0; },
    sky(t, o = {}) { skyReq = { f: Math.round(t * 24), o }; },

    update(t, shot) {
      const id = shot.id, g = shot.groups, tt = ctx.onTwos(t); frame = shot.f;
      S.on = false; S.set = null; S.scale = 1;
      for (const f of ALL_FX) f.hide(); burst.visible = false; spill.intensity = 0;
      let heat = 1, sheathK = 1, len = 10, trailOp = 1, smokeOp = 0, lightK = 0, lightR = 6000, push = 1, head = 1, pull = 1, wmax = 1.05, slow = 1;
      look = { fis: 1, rim: 0, split: 0, blue: 0 };
      if (g.includes('space') && id === 's06') {
        const p = pathAt(t); S.on = true; S.set = 'space'; S.pos.copy(p.pos); S.quat.copy(p.quat); S.vel.copy(p.vel); S.speed = p.vel.length();
        const ig = p.heat; heat = 0.12 + 0.9 * ig; sheathK = ig; len = 1.5 + 8.5 * ease(ig); trailOp = ig > 0.02 ? 1 : 0;
        look.fis = 0.35 + 0.75 * ig; lightK = 0.6 * ig; lightR = 3000;
      } else if (g.includes('sky') && id === 's17') {
        const p = pathAt(t); S.on = true; S.set = 'sky'; S.scale = SKY_SCALE; S.pos.copy(p.pos); S.quat.copy(p.quat); S.vel.copy(p.vel); S.speed = p.vel.length();
        heat = 1.05; len = 13; smokeOp = 1; lightK = 2.0; lightR = 9000; look.fis = 1.2;
        ctx.modules.sky?.setHot?.(S.pos.clone(), 0xff7a30, 4200); ctx.modules.sky?.setSplit?.(sstep(38.6, 39.5, t));
      } else if (g.includes('strato') && /^s2[2-9]$/.test(id) && (id !== 's29' || t < SHATTER)) {
        strato(t, tt); S.on = true; S.set = 'strato'; heat = S.heat;
        const contact = t >= IMPACT, ca = t - IMPACT;
        // approach: heat only on the grazing rim + the white leading edge (two silhouettes); caught: the bow shock collapses
        // into a thin sheath, the trail burns out, the smoke drifts off; s28-29 the seams split open blue
        look.rim = contact ? 0.45 * sstep(CRACK, SHATTER, t) : id === 's23' ? 1 : 0.6;
        sheathK = contact ? 0.7 * (1 - sstep(0, 0.7, ca)) : 1; push = contact ? 1 : id === 's23' ? 0 : 0.5; head = contact ? 1 : id === 's23' ? 0.5 : 0.8;
        pull = contact ? 1 : 0.4; wmax = contact ? 1.05 : id === 's23' ? 0.55 : 0.75;
        len = contact ? 3 + 13 * Math.exp(-ca * 4) : 10; trailOp = contact ? 1 - sstep(0.1, 0.9, ca) : 1;
        smokeOp = contact ? 0.25 + 0.75 * Math.exp(-ca * 1.5) : id === 's23' ? 0 : 1; lightK = contact ? 1.0 : 1.1; lightR = 2600;
        look.split = clamp((t - CRACK) / (SHATTER - CRACK - 0.25)); look.blue = sstep(CRACK, CRACK + 0.5, t); look.fis = 1 + 0.6 * sstep(CRACK, SHATTER, t);
        slow = id === 's23' ? 0.35 : 1;
        const fx = ctx.modules['fx-energy'], live = shot.id === ctx.state?.id;   // the mecha also poses us for other shots: no FX then
        if (!live) { /* posing only */ }
        else if (id === 's24' || id === 's23') fx?.impact?.(S.C.clone(), IMPACT, { key: 'meteor-impact', normal: S.up.clone(), size: RADIUS * 1.6 });
        else if (id === 's25' || id === 's28') { const M = ctx.modules.mecha; let pts = [S.C.clone()];
          try { const a = M?.anchor?.('palmL'), b = M?.anchor?.('palmR'); if (a && b && a.distanceTo(b) > 1) pts = [a, b]; } catch (e) { /* mecha API mid-rebuild */ }
          pts.forEach((p, i) => fx?.sparks?.(p, S.up.clone().negate(), t, { key: 'meteor-strain' + i, k: id === 's28' ? 1.3 : 1, spread: 75, scale: 2.6, seed: 3 + i * 7 })); }
      }
      if (S.heatOverride && S.heatOverride.f === frame) heat = S.heatOverride.k;
      root.visible = S.on; body.scale.setScalar(RADIUS * S.scale);
      if (S.on) {
        root.position.copy(S.pos); root.quaternion.copy(S.quat); root.updateMatrixWorld(true);
        const qi = S.quat.clone().invert(), front = S.vel.clone().normalize(), R = RADIUS * S.scale;
        RU.uRotM.value.setFromMatrix4(_m4.makeRotationFromQuaternion(S.quat)); RU.uFrontO.value.copy(front).applyQuaternion(qi);
        RU.uHeat.value = heat; RU.uRimHeat.value = look.rim; RU.uFis.value = look.fis; RU.uSplit.value = look.split; RU.uBlue.value = look.blue; RU.uScale.value = R;
        spill.intensity = lightK; spill.range = lightR;
        const tail = front.clone().negate(), sky = S.set === 'sky', near = R * 0.3;
        const pal = S.set === 'space' ? lerpPal(PAL.ember, PAL.fire, sstep(0.2, 0.9, sheathK)) : sky ? PAL.blaze : PAL.fire;
        trail.set({ pos: S.pos, axis: tail, R, front: 0.16, rc: 2.4, wmax: sky ? 1.3 : wmax, len, taper: 1.35, t: tt, scroll: 3.0 * slow, ns: 0.5, wob: 0.2, tongue: 1.3,
          coreLen: sky ? 4.5 : 2.4, k: sheathK, op: trailOp * (sheathK > 0.01 ? 1 : 0), colors: pal, edgeMin: 0.14, near, th: [0, 0.32, 0.6, 0.83] });
        sheath.set({ matrix: body.matrixWorld, pos: S.pos, tail, R, k: sheathK, t: tt, scroll: 2.4 * slow, op: sheathK > 0.01 ? 1 : 0, colors: pal, near, push, head, pull });
        if (smokeOp > 0) smoke.set({ pos: S.pos, axis: tail, R, front: -1.2, rc: 2.2, wmax: sky ? 1.8 : 2.2, len: sky ? 24 : len * 2.4, t: tt, scroll: Math.min(5, S.speed / R) * 0.4 * slow, ns: 1.5,
          wob: 0.25, k: 1, coreLen: 3, op: smokeOp, litSide: 1, edgeMin: 0.12, near, colors: PAL.smoke, ink: 0x3a3060 });
        if (sky) {   // the drawn bow-shock cone: vapour arcs around the head, torn into wisps toward the end
          shell.set({ pos: S.pos, axis: tail, R, front: 1.45, rc: 1.0, wmax: 3.4, len: 5.0, t: tt, scroll: 2.0, wob: 0.1, k: 0.6, coreLen: 0.8, op: sstep(38.1, 38.5, t),
            litSide: -1, edgeMin: 0.15, near, shell: 0.17, colors: PAL.vapour, ink: 0x40387a });
        }
      }
      // burst (s29 after CUES.shatter): chunks fly out of the rock's last pose
      if (id === 's29' && t >= SHATTER) {
        strato(SHATTER, ctx.onTwos(SHATTER)); S.set = 'burst'; burst.visible = true; root.visible = false;
        poseBurst(t);
      }
    },

    afterCamera(t, shot) {
      const cam = ctx.camera, id = shot.id, f = shot.f;
      // camera-dependent rock uniforms: 1080p pixel size (crack widths, ink), real-pixel AA, rock radius in px (crack LOD)
      { const tf = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), hReal = ctx.renderer.domElement.height || 1080;
        RU.uPx.value = tf / 1080; RU.uAAk.value = 1080 / hReal; RU.uRpx.value = RU.uScale.value / Math.max(1, cam.position.distanceTo(S.pos)) / tf * 1080; }
      lines.begin(cam); shards.begin(cam); heads.begin();
      if (S.on && S.set === 'strato' && t >= CRACK) drawCracks(t, Math.floor(f / 3));
      if (S.on && S.set === 'strato' && id === 's29') drawPreBurst(t);

      if (S.set === 'burst') drawBurst(t);
      if (id === 's29') drawImpactFrame(t, f);
      const sr = skyReq && skyReq.f === f ? skyReq.o : null;
      if (sr || id === 's07') drawSky(t, id, sr || {});
      const rq = starReq && starReq.f === f ? starReq.o : null;
      const auto = { s30: { rate: 700, k: 1 }, s31: { rate: 420, k: 1 }, s35: { rate: 420, k: 0.95 } }[id];
      if (rq || auto) drawStars(t, { ...(auto || {}), ...(rq || {}) }, shot);
      lines.end(); shards.end(); heads.end();
    },
    dispose() { root.removeFromParent(); burst.removeFromParent(); },
  };

  // ---- s28-s29 lightning: bolts that leap between two points of the same grown blue seam (both ends inside the seam),
  // saturated blue body + white core + a soft blue glow, tapered; redrawn on threes ----
  const _mW = new THREE.Matrix4();
  function drawCracks(t, draw) {
    const split = RU.uSplit.value, pre = 1 + 0.25 * sstep(SHATTER - 0.25, SHATTER, t), cam = ctx.camera.position;
    _mW.compose(S.pos, S.quat, new V3(RADIUS, RADIUS, RADIUS));
    const toW = (p, lift) => p.clone().multiplyScalar(1 + lift).applyMatrix4(_mW);
    splitCracks.forEach((c, ci) => {
      let n = 0; while (n < c.pts.length && c.birth[n] < split - 0.04) n++; if (n < 4 || c.level > 1) return;
      const R = ctx.rng(1000 + draw * 31 + ci * 7), nb = c.level === 0 ? 2 : 1;
      for (let b = 0; b < nb; b++) {
        if (R() > 0.45 + 0.3 * split) continue;
        const span = 3 + Math.floor(R() * 5), a0 = Math.floor(R() * Math.max(1, n - span)), a1 = Math.min(n - 1, a0 + span); if (a1 - a0 < 2) continue;
        const mid = toW(c.pts[(a0 + a1) >> 1], 0); if (mid.clone().sub(S.pos).normalize().dot(cam.clone().sub(mid).normalize()) < 0.15) continue;   // only on the faces we see
        const pts = [], m = (a1 - a0) * 2, h = 0.006 + 0.01 * R();
        for (let i = 0; i <= m; i++) { const u = i / m, fi = a0 + u * (a1 - a0), i0 = Math.floor(fi), i1 = Math.min(a1, i0 + 1);
          const base = c.pts[i0].clone().lerp(c.pts[i1], fi - i0), lift = 0.004 + Math.sin(u * Math.PI) * h;
          const p = toW(base, lift); if (i > 0 && i < m) p.add(new V3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(RADIUS * 0.014 * Math.sin(u * Math.PI)));
          pts.push(p); }
        const tp = (u) => 0.3 + 0.7 * Math.sin(u * Math.PI);
        lines.line(pts, { w: 0, px: 3.6, col: 0x1f6cff, k: 0.55 * pre, a: 0.55, soft: 1, core: 0, taper: tp });
        lines.line(pts, { w: 0, px: 1.7, col: 0x3fa8ff, k: 1.35 * pre, core: 0.3, coreK: 2.2 * pre, a: 1, taper: tp });
      }
    });
  }
  // ---- s29 first frames: the rock about to blow (glare at the contact facet + a glowing ring of the seams) ----
  function drawPreBurst(t) {
    const k = sstep(SHATTER - 0.3, SHATTER, t), tt = ctx.onTwos(t);
    heads.next()?.set({ pos: S.C.clone().addScaledVector(S.up, 20), size: RADIUS * (0.22 + 0.3 * k), color: 0x9ad8ff, core: 0.06, halo: 0.14, rays: 12, rayLen: 1, rayW: 0.025,
      k: 0.45 + 0.6 * k, t: tt, seed: 21, glow: 0.2, coreK: 4, rot: 0.04 * tt });
  }

  // ---- burst ----
  // big + mid chunks fly out of the rock's last pose (biased up, away from the giant), spin on twos and cool; the small
  // instanced shards fly faster; thousands of glowing streaks fan out (bright head dots, tapered tails, gold / orange /
  // some blue, speed and length varied, decelerating so they end as spreading points rather than rain)
  const BURST_VIEW = new V3(0.23, -0.73, 0.64).normalize();
  const _dm = new THREE.Matrix4(), _dq = new Q(), _ds = new V3();
  function poseBurst(t) {
    const centre = S.pos, tau = t - SHATTER, up = S.up, tw = ctx.onTwos(tau);
    for (const c of chunks) {
      const off = c.seed.clone().applyQuaternion(qContact).multiplyScalar(RADIUS), dir = off.clone().normalize().addScaledVector(up, 0.5).normalize();
      dir.addScaledVector(BURST_VIEW, -0.5 * dir.dot(BURST_VIEW)).normalize();
      const vel = (650 + 1500 * c.sp) * (1.3 - 0.5 * c.rel), drag = 0.5, fly = (1 - Math.exp(-drag * tau)) / drag;
      c.mesh.position.copy(centre).add(off).addScaledVector(dir, vel * fly);
      c.mesh.quaternion.copy(qContact).multiply(_q.setFromAxisAngle(c.spinAx, c.spin * tw * 0.6));
      c.mesh.scale.setScalar(RADIUS * (1 - 0.2 * sstep(0.6, 2.4, tau)));
    }
    smalls.forEach((im, k) => { for (let i = 0; i < NSM; i++) { const j = k * NSM + i, u1 = hh(j, 1), u2 = hh(j, 2), z = 2 * u1 - 1, a = u2 * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const dir = new V3(Math.cos(a) * s, z, Math.sin(a) * s).addScaledVector(up, 0.45).normalize(), sp = 900 + 2400 * Math.pow(hh(j, 3), 1.3), drag = 0.6, fly = (1 - Math.exp(-drag * tau)) / drag;
      const p = centre.clone().addScaledVector(dir, RADIUS * 0.55 * hh(j, 4) + sp * fly), size = (14 + 46 * Math.pow(hh(j, 5), 2)) * (1 - 0.3 * sstep(0.8, 2.4, tau));
      _dq.setFromAxisAngle(new V3(hh(j, 6) - 0.5, hh(j, 7) - 0.5, hh(j, 8) - 0.5).normalize(), (1 + 3 * hh(j, 9)) * tw);
      im.setMatrixAt(i, _dm.compose(p, _dq, _ds.setScalar(size))); } im.instanceMatrix.needsUpdate = true; });
    chunkMat.uniforms.uHot.value = 1.25 - 0.62 * sstep(0.15, 2.4, tau); shardMat.uniforms.uHot.value = 1.2 - 0.55 * sstep(0.2, 2.4, tau);
  }
  // impact frames at the burst: 2 frames of flat white with the characters as hard silhouettes and radial speed lines
  // (black, then blue), then straight back to colour
  function drawImpactFrame(t, f) {
    const fi = f - Math.round(SHATTER * 24); if (fi < 0 || fi > 1) return;
    const sc = STRATO.core.clone().addScaledVector(STRATO.up, stratoX(SHATTER)).project(ctx.camera);
    impactF.set({ center: [sc.x * 0.5 + 0.5, sc.y * 0.5 + 0.5], bg: fi === 0 ? 0xfffcf4 : 0xf2f8ff, sil: fi === 0 ? 0x0a0c1c : 0x0a2a90, line: fi === 0 ? 0x0a0c1c : 0x1a5cff,
      n: 170, seed: fi * 13 + 3, k: 1, lineK: 1 });
  }
  const NSH = 2400;
  function drawBurst(t) {
    const tau = t - SHATTER, up = S.up, centre = S.pos, f = Math.round(t * 24), cam = ctx.camera, tt = ctx.onTwos(t), camPos = cam.position;
    const fl = flashEnv(t, SHATTER, { peak: 1, up: 1, hold: 1, down: 10 });
    flashG.set({ pos: centre, size: RADIUS * (1.0 + 1.4 * easeOut(clamp(tau / 0.35))), color: 0xcfeaff, core: 0.08, halo: 0.16, rays: 16, rayLen: 1.1, rayW: 0.022,
      k: fl * 0.8, t: tt, seed: 4, glow: 0.15, coreK: 4, rot: 0.08 * tt });
    const fb = sstep(0.0, 0.1, tau) * (1 - sstep(0.3, 1.1, tau));   // fireball remnant
    if (fb > 0.01) heads.next()?.set({ pos: centre, size: RADIUS * (0.7 + 0.5 * easeOut(clamp(tau / 1.0))), color: 0xff8a2a, core: 0.16 * fb, halo: 0.34, rays: 9, rayLen: 0.9,
      rayW: 0.05, k: 0.85 * fb, t: tt, seed: 12, glow: 0.2, coreK: 3, rot: 0.03 * tt });
    const rA = RADIUS * (1.1 + 4.2 * easeOut(clamp(tau / 0.9))), fA = 1 - sstep(0.45, 1.1, tau);
    if (fA > 0.01) ringA.set({ pos: centre, normal: camPos.clone().sub(centre).normalize(), r: rA, w: rA * 0.07, line: rA * 0.01, k: 1.4 * fA, op: fA, t: tt, seed: 2, wob: 0.025,
      color: 0xcfeaff, vapour: 0xffffff, vapourShade: 0xb8bce8, vapOp: 0.85 * fA, wash: 0 });
    const rB = RADIUS * (1.5 + 7.5 * easeOut(clamp(tau / 2.0))), fB = 0;
    if (fB > 0.01) ringB.set({ pos: centre, normal: up, r: rB, w: rB * 0.06, line: rB * 0.006, k: 1.1 * fB, op: fB, t: tt, seed: 5, wob: 0.03,
      color: 0xffe2b0, vapour: 0xfff8f0, vapourShade: 0xc0b4e0, vapOp: 0.85 * (1 - sstep(0.5, 2.0, tau)), wash: 0 });
    // glowing streaks
    const dir = new V3(), tw2 = Math.floor(f / 2);
    for (let i = 0; i < NSH; i++) {
      const u1 = hh(i, 1), u2 = hh(i, 2), u3 = hh(i, 3), u4 = hh(i, 4);
      const z = 2 * u1 - 1, a = u2 * Math.PI * 2, s = Math.sqrt(1 - z * z);
      dir.set(Math.cos(a) * s, z, Math.sin(a) * s).addScaledVector(up, 0.4).normalize();
      const sp = 900 + 3800 * Math.pow(u3, 1.4), drag = 0.6 + 0.5 * u4, r0 = RADIUS * 0.5 * (0.3 + u4);
      const age = tau - 0.04 * hh(i, 6), life = 1.8 + 1.6 * hh(i, 5); if (age <= 0 || age > life + 0.8) continue;
      const fly = (1 - Math.exp(-drag * age)) / drag, head = centre.clone().addScaledVector(dir, r0 + sp * fly);
      const dist = head.distanceTo(camPos), near = sstep(120, 400, dist); if (near <= 0) continue;
      const v = sp * Math.exp(-drag * age), tl = Math.max(10, v * (0.025 + 0.045 * hh(i, 9)));
      const fade = (1 - sstep(life * 0.75, life + 0.8, age)) * near, tw = 0.85 + 0.15 * Math.sin(tw2 * 1.7 + i);
      const tail = head.clone().addScaledVector(dir, -tl), kind = hh(i, 8), cool = sstep(0.3, 2.4, age), big = hh(i, 7) < 0.12;
      const blue = kind < 0.14, orange = kind > 0.62;
      const tc = blue ? 0x1e6cff : orange ? lerpHex(0xff4a10, 0xb81a10, cool) : lerpHex(0xffa020, 0xe0501a, cool);
      const hc = blue ? 0xc8ecff : orange ? 0xffa040 : 0xffd070;
      shards.line([tail, tail.clone().lerp(head, 0.55), head], { w: 0, px: big ? 2.4 : 1.5, col: tc, col2: hc, k: (big ? 1.3 : 1.1) * fade * tw, core: 0.35, coreK: (big ? 2.4 : 1.8) * fade * tw,
        a: fade, taper: [0.05, 1] });
      shards.dot(head, { px: big ? 4.2 : 2.6, col: hc, k: 1.6 * fade * tw, a: fade, core: 0.4, coreK: 2.6 * fade, soft: 0.45 });
    }
  }
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  const lerpHex = (a, b, k) => { _ca.setHex(a).lerp(_cb.setHex(b), k); return [_ca.r, _ca.g, _ca.b]; };

  // ---- the far meteor seen from the coast (s07: one point of the sky glows orange) ----
  function drawSky(t, id, o) {
    const cam = ctx.camera, F = new V3(), Rv = new V3(), U = new V3(); cam.matrixWorld.extractBasis(Rv, U, F); F.negate();
    const kind = o.kind || 'point', tt = ctx.onTwos(t);
    const dir = o.dir ? new V3().fromArray(o.dir).normalize() : F.clone().addScaledVector(Rv, -0.2).addScaledVector(U, 0.2).normalize();
    const head = cam.position.clone().addScaledVector(dir, 40000);
    if (kind === 'streak') {
      const k = o.k ?? 1, tailDir = Rv.clone().multiplyScalar(0.62).addScaledVector(U, 0.62).addScaledVector(F, 0.45).normalize();
      lines.line([head.clone().addScaledVector(tailDir, 2500), head], { w: 6, px: 1.3, col: 0xbfe0ff, k: 1.6 * k, core: 0.5, coreK: 3 * k, a: k, taper: [0.1, 1] });
      heads.next()?.set({ pos: head, sizePx: 16, color: 0xdff0ff, core: 0.18, halo: 0.34, rays: 4, rayLen: 1, rayW: 0.04, k: k * 1.2, t: tt, seed: 3, glow: 0.8, coreK: 4, rot: 0.125 }, cam);
      return;
    }
    const k = o.k ?? sstep(14.0, 15.0, t), pulse = 0.88 + 0.12 * Math.sin(tt * 9);
    heads.next()?.set({ pos: head, sizePx: 40 + 26 * k, color: 0xff8a3a, core: 0.13, halo: 0.3, rays: 6, rayLen: 0.95, rayW: 0.05, k: k * pulse * 1.3, t: tt, seed: 8, glow: 1.4, coreK: 3.5 }, cam);
    const tailDir = Rv.clone().multiplyScalar(-0.5).addScaledVector(U, 0.8).normalize();
    if (k > 0.01) lines.line([head.clone().addScaledVector(tailDir, 700 * k), head], { w: 14, px: 2, col: 0xff6a2a, k: 1.4 * k, core: 0.4, coreK: 2.5 * k, a: k * 0.9, taper: [0.1, 1] });
  }

  // ---- shooting-star shower: parallel streaks (a perspective radiant) anchored to sky directions around the camera;
  // staggered starts, varied speed / length, warm gold heads with a glow dot, gold or cyan tapered tails ----
  function drawStars(t, o, shot) {
    const cam = ctx.camera, F = new V3(); cam.getWorldDirection(F);
    const D = new V3().fromArray(o.dir || [-0.28, -0.6, -0.75]).normalize(), rate = o.rate ?? 400, k = o.k ?? 1, seed = o.seed ?? 77;
    const el = o.elev || [0.06, 0.8], tf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), asp = cam.aspect || 16 / 9;
    const k0 = Math.floor((t - 1.6) * rate), k1 = Math.floor(t * rate); let n = 0;
    const camI = cam.matrixWorldInverse, pv = new V3();
    for (let j = k0; j <= k1; j++) {
      const tj = (j + hh(j, seed)) / rate, life = 0.45 + 0.85 * hh(j, seed + 1), age = t - tj; if (age < 0 || age > life) continue;
      const az = hh(j, seed + 2) * Math.PI * 2, se = el[0] + (el[1] - el[0]) * Math.pow(hh(j, seed + 3), 1.3), ce = Math.sqrt(1 - se * se);
      const dist = 26000 + 22000 * hh(j, seed + 4), p0 = cam.position.clone().add(new V3(Math.cos(az) * ce, se, Math.sin(az) * ce).multiplyScalar(dist));
      const sp = 5500 + 9500 * hh(j, seed + 5), dj = D.clone().addScaledVector(new V3(hh(j, 9) - 0.5, hh(j, 10) - 0.5, hh(j, 11) - 0.5), 0.08).normalize();
      const head = p0.clone().addScaledVector(dj, sp * age), tail = head.clone().addScaledVector(dj, -sp * Math.min(age, 0.1 + 0.22 * hh(j, seed + 6)));
      pv.copy(head).applyMatrix4(camI); if (pv.z > -100) continue;
      if (Math.abs(pv.x / -pv.z) > tf * asp * 1.15 || Math.abs(pv.y / -pv.z) > tf * 1.15) continue;
      const env = sstep(0, 0.07, age) * (1 - sstep(life * 0.6, life, age)) * k, big = hh(j, seed + 7) < 0.18, cyan = hh(j, seed + 8) < 0.22;
      shards.line([tail, tail.clone().lerp(head, 0.6), head], { w: 0, px: big ? 2.8 : 1.9, col: cyan ? 0x28c4ff : 0xff6a1e, col2: cyan ? 0xc8f6ff : 0xffc860,
        k: (big ? 1.8 : 1.5) * env, core: 0.38, coreK: (big ? 3.0 : 2.2) * env, a: env, taper: [0.03, 1] });
      shards.dot(head, { px: big ? 4.2 : 2.9, col: 0xffc860, k: 2.0 * env, a: env, core: 0.45, coreK: 3.2 * env, soft: 0.5 });
      n++;
    }
    api.starCount = n;
    return n;
  }
  return api;
}
