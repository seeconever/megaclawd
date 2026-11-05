// MEGA CLAWD · mecha construction (owner: mecha). Builds the 120 m giant in Clawd's silhouette from the mascot proportions
// (body 1.0 x 0.74 x 0.56 -> 120 x 90 x 72 m, four short legs, two side nubs) as a rig of merged armour parts.
// Mecha-local frame (like the mascot): +x = its right side (the viewer's right when it faces you), +y up, the face looks +z,
// origin on the ground between the feet when standing.
//
//   root ─ rig ─ body (centre y = LEG + 45) ─ visor (glass, amber face display), reactor (crystal + housing + petals)
//                    ├ shoulder R/L ─ upper (telescopes out of the side socket) ─ elbow ─ fore (the nub) ─ wrist ─ hand
//                    │                                                                     └ 3 clamp fingers (spread / curl)
//                    └ hip FR/FL/BR/BL ─ thigh ─ knee ─ shin ─ ankle ─ foot (sole thruster)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { KIND, bandX, bandY, bandZ, cylS, cylX, capS, slab, extrude, std, Part, M as MX, bolts, roundRectShape, roundRectPath, polyShape, ngon } from './mecha-kit.js';
import { PAL } from './mecha-paint.js';

const V3 = THREE.Vector3, PI = Math.PI;
export const DIM = { W: 120, H: 90, D: 72, R: 14, LEG: 32.1, HIP: [36, 21], SHOULDER: [56, -2.4, 0], UPPER: 30, FORE: 21, EXT: 9, PALM: 3,
  FING: [8.5, 7.5], EYE_Y: 7.2, VISOR_Z: 36.4 };

export function buildMecha(ctx, { M, MU }) {
  const { kit } = ctx;
  const B = { hx: 60, hy: 45, hz: 36, r: 14, cy: 0 };
  const sX = bandX(B), sY = bandY(B), sZ = bandZ(B);
  let seed = 1; const S = () => (seed += 1.37);
  const root = new THREE.Group(); root.name = 'mecha';
  const rig = new THREE.Group(); rig.name = 'mecha-rig'; root.add(rig);
  const body = new THREE.Group(); body.name = 'mecha-body'; body.position.set(0, DIM.LEG + 45, 0); rig.add(body);
  const anchors = {};
  const anchor = (name, parent, p) => { const o = new THREE.Object3D(); o.name = 'anchor:' + name; o.position.set(...p); parent.add(o); anchors[name] = o; return o; };

  // ===================================================================================================================
  // BODY
  // ===================================================================================================================
  const P = new Part('body');
  P.add('hull', std(new RoundedBoxGeometry(120, 90, 72, 6, 14), { kind: KIND.NONE }));
  const pl = (key, Sf, u0, u1, v0, v1, o = {}) => P.add(key, slab(Sf, u0, u1, v0, v1, { seed: S(), ...o }));
  // armour thickness: a charcoal under-layer 0.9 m wider than the plate above it, so every plate edge shows a dark step
  const under = (Sf, u0, u1, v0, v1, t = 1.0) => P.add('char2', slab(Sf, u0 - 0.9, u1 + 0.9, v0 - 0.9, v1 + 0.9, { t, b: 0.3, seed: S(), kind: KIND.NONE }));
  // separately hinged plates that buckle under the meteor (s25): Part built around its hinge point, rotated in mecha.js
  const bends = [];
  const bendPlate = (name, key, Sf, u0, u1, v0, v1, o, pivot, axis, maxDeg) => {
    const Pb = new Part(name); Pb.add(key, slab(Sf, u0, u1, v0, v1, { seed: S(), ...o }), MX.t(-pivot.x, -pivot.y, -pivot.z));
    const g = new THREE.Group(); g.name = name; g.position.copy(pivot); g.add(Pb.build(M)); bends.push({ g, axis: axis.clone().normalize(), max: maxDeg * PI / 180 }); return g; };
  const XL = 44.5;   // x extent of the front / top / back plates (the corner guards cover beyond)
  // --- front: brow (cream) over the top-front edge, chin + jaw under the visor, hazard lip ---
  under(sX, 27.6, 60.2, -XL, XL, 1.2);
  pl('terra3', sX, 27.6, 60.2, -XL, XL, { t: 2.3, b: 0.7, kind: KIND.PANEL });
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -XL : 12.6, x1 = sx < 0 ? -12.6 : XL;
    under(sX, -46.5, -21.2, x0, x1);
    pl(sx < 0 ? 'terra' : 'terra2', sX, -46.5, -21.2, x0, x1, { t: 1.9, kind: KIND.PANEL });
    pl('hazard', sX, -52.5, -47.2, x0, x1, { t: 1.5, b: 0.35, kind: KIND.HAZARD });
    // lower front: an intake grille beside the reactor + a maintenance hatch with a handle (warning triangle decal on it)
    P.add('char', extrude(roundRectShape(15, 6.4, 1.4), 1.0, { bevel: 0.4, kind: KIND.VENT, seed: S() }), MX.t(sx * 23.8, -27.0, 37.6));
    P.add('char2', extrude(roundRectShape(9.2, 7.6, 1.0), 0.7, { bevel: 0.3, kind: KIND.PLAIN, seed: S() }), MX.t(sx * 38.6, -26.6, 37.6));
    P.add('bronze', std(new RoundedBoxGeometry(4.2, 0.7, 0.7, 2, 0.25).translate(sx * 38.6, -29.6, 39.0), {}));
    // cheek guards: armour wedges over the visor's lower corners (breaks the screen rectangle, shows plate thickness)
    const ck = polyShape([[0, 0], [11.5, 0], [0, 14.5]].map(([x, y]) => [x * -sx, y]));
    P.add('char2', extrude(ck, 1.0, { bevel: 0.3, kind: KIND.NONE }), MX.t(sx * 45.4, -21.2, 37.4));
    P.add(sx < 0 ? 'terra2' : 'terra3', extrude(polyShape([[0, 0], [10.2, 0], [0, 12.8]].map(([x, y]) => [x * -sx, y])), 1.4, { bevel: 0.5, kind: KIND.PLAIN, seed: S() }), MX.t(sx * 44.9, -20.6, 38.4));
  }
  // --- top: three rows of shingles, cream centre stripe, vents at the back row (front-right shingle = hinged) ---
  const rows = [[60.9, 74.4, 2.0], [75.2, 88.7, 1.8], [89.5, 113.6, 2.0]];
  const cols = [[-XL, -9.2], [-8.4, 8.4], [9.2, XL]];
  rows.forEach(([u0, u1, t], r) => cols.forEach(([v0, v1], c) => {
    const centre = c === 1, key = centre ? (r % 2 ? 'cream2' : 'cream') : ((r + c) % 2 ? 'terra3' : 'terra');
    const o = { t: t + (centre ? 0.4 : 0), kind: r === 2 && !centre ? KIND.VENT : KIND.PANEL };
    if (r === 0 && c === 2) body.add(bendPlate('bendTop', key, sX, u0, u1, v0, v1, o, new V3(XL, 45, 7.4), new V3(0, 0, -1), 4));
    else pl(key, sX, u0, u1, v0, v1, o);
  }));
  // --- back: two big plates each side of a charcoal spine, lower skirt ---
  pl('terra2', sX, 114.4, 150.2, -XL, -2.6, { t: 1.8 }); pl('terra', sX, 114.4, 150.2, 2.6, XL, { t: 1.8 });
  pl('terra', sX, 151, 186.5, -XL, -2.6, { t: 1.8 }); pl('terra3', sX, 151, 186.5, 2.6, XL, { t: 1.8 });
  pl('char', sX, 110, 190, -2.2, 2.2, { t: 2.6, b: 0.5, kind: KIND.RIB });
  pl('hazard', sX, 187.3, 192.5, -XL, XL, { t: 1.5, b: 0.35, kind: KIND.HAZARD });
  // --- sides (Z band: right side s = y, left side s = 198 - y) ---
  const side = (sx, key, y0, y1, z0, z1, o) => sx > 0 ? pl(key, sZ, y0, y1, z0, z1, o) : pl(key, sZ, 198 - y1, 198 - y0, z0, z1, o);
  for (const sx of [-1, 1]) {
    // top-side edge (shoulder line): hinged at its lower edge, it buckles outward under the meteor (s25)
    { const key = sx > 0 ? 'terra' : 'terra2', o = { t: 2.1 }, pv = new V3(sx * 60, 29.4, 0);
      body.add(sx > 0 ? bendPlate('bendR', key, sZ, 29.4, 54.2, -21.4, 21.4, o, pv, new V3(0, 0, -1), 6) : bendPlate('bendL', key, sZ, 198 - 54.2, 198 - 29.4, -21.4, 21.4, o, pv, new V3(0, 0, 1), 6)); }
    under(sZ, sx > 0 ? 13.2 : 198 - 28.6, sx > 0 ? 28.6 : 198 - 13.2, -16.9, 16.9, 0.9);
    side(sx, sx > 0 ? 'terra3' : 'terra', 13.2, 28.6, -16.9, 16.9, { t: 1.7, kind: KIND.NONE });       // above the socket (markings)
    side(sx, sx > 0 ? 'terra2' : 'terra3', -25.6, -18.2, -16.9, 16.9, { t: 1.7, kind: KIND.VENT });    // below the socket (louvres)
    side(sx, 'hazard', -31.4, -26.4, -16.9, 16.9, { t: 1.5, b: 0.35, kind: KIND.HAZARD });
    side(sx, sx > 0 ? 'terra' : 'terra2', -50.5, -32.2, -21.4, 21.4, { t: 1.9, kind: KIND.PANEL });   // bottom-side skirt
    side(sx, 'char', -17.4, 12.6, -16.9, -15.2, { t: 1.2, kind: KIND.NONE });
    side(sx, 'char', -17.4, 12.6, 15.2, 16.9, { t: 1.2, kind: KIND.NONE });
  }
  // --- vertical edge guards (Y band): front cheeks + back guards, both sides ---
  const yb = (key, s0, s1) => pl(key, sY, s0, s1, -25.6, 25.2, { t: 2.2, kind: KIND.PANEL });
  yb('terra2', 17.4, 44.6); yb('terra3', 135.4, 162.6); yb('terra', 315.4, 342.6); yb('terra3', 197.4, 224.6);
  // --- corner guards (cream on top, charcoal below) ---
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new V3(sx * 46, sy * 31, sz * 22), d = new V3(sx, sy * 0.95, sz).normalize(), e1 = new V3(0, 1, 0).cross(d).normalize(), e2 = d.clone().cross(e1);
    P.add(sy > 0 ? (sz > 0 ? 'cream2' : 'cream') : 'char2', slab(capS(c, 14, d, e1, e2), -9.8, 9.8, -9.8, 9.8, { t: 2.8, b: 0.8, step: 1.4, seed: S(), kind: KIND.PLAIN }));
  }
  // --- side sockets (bronze ring + dark recess) ---
  for (const sx of [-1, 1]) {
    P.add('bronze', std(new THREE.TorusGeometry(16.4, 1.7, 10, 44).rotateY(PI / 2).translate(sx * 61.4, -2.4, 0), { crease: 40 }));
    P.add('hull', std(new THREE.CylinderGeometry(15.0, 15.0, 1.5, 40).rotateZ(PI / 2).translate(sx * 60.6, -2.4, 0), {}));
    // shoulder hood arching over the socket (terracotta shell + cream rim)
    const x0 = sx > 0 ? 57 : -66.8;
    P.add(sx > 0 ? 'terra2' : 'terra', slab(cylX(21.2, x0), -25, 25, sx > 0 ? 0 : 2.3, sx > 0 ? 7.5 : 9.8, { t: 2.2, step: 2, seed: S(), kind: KIND.PANEL }), MX.t(0, -2.4, 0));
    P.add('cream', slab(cylX(21.2, x0), -25.6, 25.6, sx > 0 ? 7.5 : 0, sx > 0 ? 9.8 : 2.3, { t: 2.9, b: 0.5, step: 2, seed: S(), kind: KIND.NONE }), MX.t(0, -2.4, 0));
  }
  // --- antenna mast (back-left of the top): its own hinged part, folds flat backward for the catch (strato) ---
  P.add('bronze', std(new THREE.CylinderGeometry(1.8, 2.2, 1.6, 12).translate(-30, 45 + 2.6, -12), { flat: true }));
  const antenna = new THREE.Group(); antenna.name = 'mecha-antenna'; antenna.position.set(-30, 45 + 3.2, -12); body.add(antenna);
  { const Pa = new Part('antenna');
    Pa.add('char', std(new THREE.CylinderGeometry(0.5, 0.9, 12.4, 8).translate(0, 6.2, 0), { flat: true }));
    Pa.add('cream', std(new THREE.BoxGeometry(5, 0.6, 0.6).translate(0, 9.4, 0), { flat: true }));
    Pa.add('bronze', std(new THREE.SphereGeometry(1.1, 10, 8), {}));
    antenna.add(Pa.build(M)); }
  // --- underside: hip sockets ---
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    P.add('bronze', std(new THREE.TorusGeometry(12.6, 1.4, 8, 32).rotateX(PI / 2).translate(sx * DIM.HIP[0], -45.3, sz * DIM.HIP[1]), { crease: 40 }));
  }
  // --- top hatch (the cockpit hatch Clawd drops through) ---
  P.add('bronze', std(new THREE.CylinderGeometry(8.6, 9.2, 1.4, 40).translate(0, 45 + 2.4 + 0.5, 7.5), { crease: 40 }));
  P.add('char', std(new THREE.CylinderGeometry(7.2, 7.6, 1.6, 40).translate(0, 45 + 2.4 + 1.0, 7.5), { crease: 40, kind: KIND.NONE }));
  { const bl = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 2 * PI; bl.push([new V3(8.2 * Math.cos(a), 45 + 2.4 + 1.2, 7.5 + 8.2 * Math.sin(a)), new V3(0, 1, 0)]); } P.add('char2', bolts(bl, { r: 0.45, h: 0.5 })); }
  P.add('char2', std(new RoundedBoxGeometry(1.4, 1.2, 9, 2, 0.4).translate(0, 45 + 2.4 + 2.2, 7.5), {}));
  // --- back: grille block with the "01" panel ---
  P.add('char', extrude(roundRectShape(34, 22, 3), 3.2, { bevel: 0.7, kind: KIND.GRILLE, seed: S() }), MX.mul(MX.t(-21, -18, -36 - 2.6), MX.r(0, PI, 0)));
  P.add('char', extrude(roundRectShape(34, 22, 3), 3.2, { bevel: 0.7, kind: KIND.GRILLE, seed: S() }), MX.mul(MX.t(21, -18, -36 - 2.6), MX.r(0, PI, 0)));
  // --- visor frame (charcoal), with bolts ---
  { const o = roundRectShape(89, 47.5, 7, 0, 3.75); o.holes.push(roundRectPath(80.6, 41.4, 5, 0, 3.6)); P.add('char', extrude(o, 2.0, { bevel: 0.7, kind: KIND.NONE }), MX.t(0, 0, 35.6)); }
  { const bl = []; for (let i = 0; i < 9; i++) { const x = -38 + i * 9.5; bl.push([new V3(x, 25.7, 39.0), new V3(0, 0, 1)], [new V3(x, -18.2, 39.0), new V3(0, 0, 1)]); }
    for (const y of [-8, 4, 16]) bl.push([new V3(-42.4, y, 39.0), new V3(0, 0, 1)], [new V3(42.4, y, 39.0), new V3(0, 0, 1)]);
    P.add('bronze', bolts(bl, { r: 0.65, h: 0.5 })); }
  // --- reactor housing (hex), bronze inner ring ---
  const RC = new V3(0, -31, 36);
  { const hx = polyShape(ngon(6, 11.5, 0), [ngon(6, 7.8, 0).reverse()]); P.add('char', extrude(hx, 3.2, { bevel: 0.8, kind: KIND.NONE }), MX.t(RC.x, RC.y, RC.z - 0.6));
    const hr = polyShape(ngon(6, 7.9, 0), [ngon(6, 6.3, 0).reverse()]); P.add('bronze', extrude(hr, 3.6, { bevel: 0.4, kind: KIND.NONE }), MX.t(RC.x, RC.y, RC.z - 0.4));
    const bl = ngon(6, 9.7, PI / 6).map(([x, y]) => [new V3(RC.x + x, RC.y + y, RC.z + 3.5), new V3(0, 0, 1)]); P.add('bronze', bolts(bl, { r: 0.75, h: 0.6 }));
    P.add('hull', std(new THREE.CylinderGeometry(7.9, 7.9, 2, 6).rotateX(PI / 2).translate(RC.x, RC.y, RC.z + 0.4), { flat: true })); }
  const bodyMesh = P.build(M); body.add(bodyMesh);

  // --- markings (hand-lettered decals) ---
  const decals = new THREE.Group(); decals.name = 'mecha-decals'; body.add(decals);
  const dmat = (tex, color) => { const m = M._decal(tex, color); return m; };
  const decal = (tex, color, w, h, pos, rotY) => { const m = new THREE.Mesh(std(new THREE.PlaneGeometry(w, h)), dmat(tex, color)); m.position.copy(pos); m.rotation.y = rotY; m.userData.noSolid = true; decals.add(m); return m; };
  const T = letteringTextures(kit);
  // CLAWD-01 on the clean side plate between the shoulder hood (top y ~21.7) and the shoulder line (y 29.4): whole and
  // unobstructed in the side views (s19 s21); 巨神 on the same plate on the right side
  decal(T.clawd, PAL.cream, 19.5, 5.4, new V3(-61.75, 25.6, 0), -PI / 2);
  decal(T.kanji, PAL.cream, 12.4, 6.2, new V3(61.75, 25.4, 0), PI / 2);
  decal(T.num, PAL.cream, 15, 11.5, new V3(-23.5, 14, -37.86), PI);
  decal(T.clawdSmall, PAL.cream, 15, 3.4, new V3(23.5, 14, -37.86), PI);
  decal(T.small, PAL.char, 11, 2.2, new V3(27, 47.06, 6), 0).rotation.set(-PI / 2, 0, 0);
  decal(T.warn, PAL.hazard, 4.6, 4.6, new V3(-38.6, -26.0, 38.68), 0);
  decal(T.warn, PAL.hazard, 4.6, 4.6, new V3(38.6, -26.0, 38.68), 0);

  // --- visor: dark glass + glint + the face display (mecha-face.js attaches into visor.faceSlot) ---
  const visor = new THREE.Group(); visor.name = 'mecha-visor'; body.add(visor);
  const glass = new THREE.Mesh(extrude(roundRectShape(81, 42, 5.2, 0, 3.6), 0.4, { bevel: 0.2, kind: KIND.NONE }), M.glass); glass.position.z = 35.8; visor.add(glass);
  const faceSlot = new THREE.Group(); faceSlot.position.set(0, 0, DIM.VISOR_Z + 0.25); visor.add(faceSlot);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(80, 41), glintMaterial(kit)); glint.position.set(0, 3.6, 37.2); glint.userData.noSolid = true; visor.add(glint);
  anchor('visor', body, [0, DIM.EYE_Y, 38]); anchor('eyeL', body, [-20.4, DIM.EYE_Y, 37]); anchor('eyeR', body, [20.4, DIM.EYE_Y, 37]);
  anchor('cockpit', body, [0, 22, 7.5]); anchor('hatch', body, [0, 49.5, 7.5]); anchor('top', body, [0, 47.5, 0]); anchor('center', body, [0, 0, 0]);
  anchor('chest', body, [0, -31, 40]); anchor('back', body, [0, 0, -40]); anchor('bottom', body, [0, -45, 0]);

  // --- reactor crystal (faceted, emissive) + shifting petals ---
  const reactor = new THREE.Group(); reactor.name = 'mecha-reactor'; reactor.position.copy(RC); body.add(reactor);
  const cg = new THREE.LatheGeometry([new THREE.Vector2(0, -1.5), new THREE.Vector2(6.0, 0.6), new THREE.Vector2(5.4, 3.8), new THREE.Vector2(2.2, 7.6), new THREE.Vector2(0, 8.6)], 6).rotateX(PI / 2).rotateZ(PI / 6);
  const crystal = new THREE.Mesh(std(cg, { flat: true }), crystalMaterial(ctx)); reactor.add(crystal);
  const petals = [];
  for (const a of [0.3, -0.3, PI - 0.3, PI + 0.3]) {
    const g = new THREE.Group(); g.rotation.z = a; reactor.add(g);
    const pp = new Part('petal'); const sh = polyShape([[10.6, -3.6], [17.8, -5.2], [17.8, 5.2], [10.6, 3.6]]);
    pp.add('char2', extrude(sh, 1.4, { bevel: 0.45, kind: KIND.PLAIN, seed: S() }), MX.t(0, 0, 1.9));
    pp.add('bronze', extrude(polyShape([[10.9, -3.0], [11.9, -3.2], [11.9, 3.2], [10.9, 3.0]]), 0.5, { bevel: 0.15, kind: KIND.NONE }), MX.t(0, 0, 3.4));
    const mesh = pp.build(M); g.add(mesh); petals.push({ g, mesh, a });
  }
  anchor('reactor', reactor, [0, 0, 6]);
  const glowR = kit.glowSource({ color: 0x58c8ff, core: 0.01, halo: 34, haloK: 0.5, glow: 90, glowK: 0.16, spill: 2.2, range: 70 }); glowR.position.set(0, 0, 7); reactor.add(glowR);
  glowR.userData.core.visible = false;

  // ===================================================================================================================
  // LEGS (front legs knee forward, back legs = the same leg turned 180 degrees)
  // ===================================================================================================================
  const legs = [];
  for (const [nm, sx, sz] of [['FR', 1, 1], ['FL', -1, 1], ['BR', 1, -1], ['BL', -1, -1]]) {
    const hip = new THREE.Group(); hip.name = 'hip' + nm; hip.position.set(sx * DIM.HIP[0], -45, sz * DIM.HIP[1]); hip.rotation.y = sz > 0 ? 0 : PI; body.add(hip);
    const thigh = new THREE.Group(); hip.add(thigh); const knee = new THREE.Group(); knee.position.y = -14; thigh.add(knee);
    const ankle = new THREE.Group(); ankle.position.y = -12; knee.add(ankle); const foot = new THREE.Group(); ankle.add(foot);
    const keyA = sx > 0 ? 'terra' : 'terra2', keyB = sx > 0 ? 'terra3' : 'terra';
    // thigh
    const Pt = new Part('thigh' + nm);
    Pt.add('bronze', std(new THREE.SphereGeometry(9.6, 24, 16), {}));
    Pt.add('char', std(new THREE.CylinderGeometry(9.2, 9.2, 14, 24).translate(0, -7, 0), {}));
    const tS = cylS(13.6, 12.6, 10, -12.5), tC = 2 * PI * 13.1;
    for (let q = 0; q < 4; q++) Pt.add(q === 0 ? 'cream' : (q % 2 ? keyA : keyB), slab(tS, (q - 0.5) * tC / 4 + 0.55, (q + 0.5) * tC / 4 - 0.55, 0, 10, { t: 1.6, seed: S(), kind: q === 2 ? KIND.RIB : KIND.PANEL }));
    Pt.add('char2', std(new THREE.CylinderGeometry(14.6, 13.6, 2.4, 28).translate(0, -1.6, 0), { crease: 40 }));
    // hip piston (front of the thigh, from the collar down to the knee guard)
    Pt.add('bronze', std(new THREE.CylinderGeometry(1.3, 1.3, 9, 10).translate(0, -7, 15.6), { crease: 40 }));
    Pt.add('char', std(new THREE.CylinderGeometry(2.0, 2.0, 4, 10).translate(0, -4, 15.6), { crease: 40 }));
    thigh.add(Pt.build(M));
    // knee: a heavy bronze hinge with bolted hub caps + a thick kneecap shield (terracotta, cream band)
    const Pk = new Part('knee' + nm);
    Pk.add('bronze', std(new THREE.CylinderGeometry(7.4, 7.4, 21, 24).rotateZ(PI / 2), { crease: 40 }));
    for (const s of [-1, 1]) {
      Pk.add('char', std(new THREE.CylinderGeometry(8.8, 8.8, 2.2, 24).rotateZ(PI / 2).translate(s * 10.8, 0, 0), { crease: 40 }));
      Pk.add('bronze', std(new THREE.CylinderGeometry(5.4, 6.0, 1.6, 20).rotateZ(-s * PI / 2).translate(s * 12.6, 0, 0), { crease: 40 }));
      Pk.add('char2', bolts(ngon(6, 4.1, 0).map(([a, b]) => [new V3(s * 13.4, a, b), new V3(s, 0, 0)]), { r: 0.55, h: 0.5 }));
    }
    // kneecap: in front of both the thigh and the shin armour (radius 16 from the hinge axis: clears both at any bend)
    Pk.add(keyA, slab(cylS(16.2, 16.0, 9, -5.0), -9.0, 9.0, 0, 9, { t: 2.2, b: 0.7, seed: S(), kind: KIND.PANEL }));
    knee.add(Pk.build(M));
    // shin (flares toward the foot) + a raised front shin guard with a hazard band
    const Ps = new Part('shin' + nm), sS = cylS(15.8, 13.2, 10.4, -11.4), sC = 2 * PI * 14.5;
    Ps.add('char', std(new THREE.CylinderGeometry(10.2, 12.0, 12, 24).translate(0, -6, 0), {}));
    for (let q = 0; q < 4; q++) Ps.add(q === 0 ? 'char2' : (q % 2 ? keyB : keyA), slab(sS, (q - 0.5) * sC / 4 + 0.55, (q + 0.5) * sC / 4 - 0.55, 0, 10.4, { t: 1.7, seed: S(), kind: q === 2 ? KIND.VENT : KIND.PANEL }));
    Ps.add(keyB, slab(cylS(17.6, 15.0, 10.4, -11.4), -9.4, 9.4, 1.6, 10.2, { t: 1.9, b: 0.6, seed: S(), kind: KIND.PANEL }));
    Ps.add('hazard', slab(cylS(17.6, 15.0, 10.4, -11.4), -9.4, 9.4, 0.0, 1.4, { t: 1.6, b: 0.3, seed: S(), kind: KIND.HAZARD }));
    Ps.add('bronze', std(new THREE.TorusGeometry(12.8, 1.5, 8, 30).rotateX(PI / 2).translate(0, -11.6, 0), { crease: 40 }));
    for (const s of [-1, 1]) Ps.add('bronze', std(new THREE.SphereGeometry(2.0, 12, 8).translate(s * 17.6, -7.5, 2.0), {}));   // piston mount
    knee.add(Ps.build(M)); // shin geometry lives in the knee frame
    // hydraulic pistons on both sides (thigh -> shin), re-aimed every frame by updatePistons()
    const pistons = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Object3D(); a.position.set(s * 17.4, -5.5, 2.0); thigh.add(a);
      const b = new THREE.Object3D(); b.position.set(s * 17.6, -7.5, 2.0); knee.add(b);
      const Pc = new Part('piston'); Pc.add('char', std(new THREE.CylinderGeometry(2.1, 2.1, 9, 14).translate(0, -4.5, 0), { crease: 40 }));
      Pc.add('char2', std(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 14).translate(0, -0.8, 0), { crease: 40 }));
      Pc.add('bronze', std(new THREE.SphereGeometry(2.0, 12, 8), {}));
      const Pr = new Part('rod'); Pr.add('bronze', std(new THREE.CylinderGeometry(1.05, 1.05, 10, 10).translate(0, 5, 0), { crease: 40 }));
      const cyl = Pc.build(M), rod = Pr.build(M); thigh.add(cyl); thigh.add(rod);
      pistons.push({ a, b, cyl, rod });
    }
    // foot: round drum + three armoured toe plates (outward, away from the body centre) + a heel plate
    const Pf = new Part('foot' + nm), fS = cylS(18.6, 17.0, 3.6, -4.3), fC = 2 * PI * 17.8;
    Pf.add('char', std(new THREE.CylinderGeometry(16.8, 17.8, 4.6, 32).translate(0, -2.6, 0), {}));
    for (let q = 0; q < 6; q++) Pf.add(q === 0 ? 'cream' : (q % 2 ? keyA : keyB), slab(fS, (q - 0.5) * fC / 6 + 0.45, (q + 0.5) * fC / 6 - 0.45, 0, 3.6, { t: 1.4, b: 0.4, seed: S(), kind: KIND.PLAIN }));
    Pf.add('char2', std(new THREE.CylinderGeometry(19.0, 19.0, 1.3, 36).translate(0, -5.0, 0), { crease: 40 }));
    Pf.add('bronze', std(new THREE.TorusGeometry(9.6, 1.0, 8, 30).rotateX(PI / 2).translate(0, -5.1, 0), { crease: 40 }));
    Pf.add('hull', std(new THREE.CylinderGeometry(8.6, 5.6, 1.6, 30, 1, true).translate(0, -5.2, 0), {}));
    // a fan of three overlapping toe plates (sabaton), outward only
    for (const [a, len, key] of [[-0.48, 8.5, keyB], [0, 10, keyA], [0.48, 8.5, keyB]]) {
      const m = MX.mul(MX.r(0, a, 0), MX.t(0, -2.6, 17.6), MX.r(0.12, 0, 0));
      Pf.add(key, std(new RoundedBoxGeometry(11, 2.6, len, 2, 0.9).translate(0, 0, len * 0.42), { crease: 40 }), m);
      Pf.add('char', std(new RoundedBoxGeometry(9.6, 1.0, len * 0.8, 1, 0.3).translate(0, -1.5, len * 0.4), { crease: 40 }), m);
      Pf.add('bronze', std(new THREE.CylinderGeometry(1.5, 1.5, 10.0, 12).rotateZ(PI / 2), { crease: 40 }), m);
    }
    foot.add(Pf.build(M));
    const thr = thruster(ctx); thr.position.y = -5.7; foot.add(thr);
    const sole = anchor('sole' + nm, foot, [0, -6.1, 0]);
    legs.push({ name: nm, sx, sz, hip, thigh, knee, ankle, foot, thr, sole, pistons });
  }

  // ===================================================================================================================
  // ARMS: shoulder (inside the side socket) -> telescoping upper arm -> elbow -> forearm (= the nub) -> wrist -> clamp hand
  // ===================================================================================================================
  const arms = [];
  for (const [nm, sx] of [['R', 1], ['L', -1]]) {
    const base = new THREE.Group(); base.name = 'shoulderBase' + nm; base.position.set(sx * DIM.SHOULDER[0], DIM.SHOULDER[1], DIM.SHOULDER[2]); base.rotation.y = sx > 0 ? 0 : PI; body.add(base);
    const boom = new THREE.Group(); boom.name = 'boom' + nm; base.add(boom);   // slides out of the side socket (x 0 -> 18)
    const Pb = new Part('boom' + nm);
    Pb.add('char', std(new THREE.CylinderGeometry(7.4, 7.4, 22, 28).rotateZ(PI / 2).translate(-11, 0, 0), {}));
    Pb.add('cream2', slab(cylX(8.4, -16), -13.2, 13.2, 0, 12, { t: 1.2, seed: S(), kind: KIND.RIB, ustep: 2 }));
    Pb.add('bronze', std(new THREE.SphereGeometry(9.4, 28, 18), {}));
    boom.add(Pb.build(M));
    const shoulder = new THREE.Group(); shoulder.name = 'shoulder' + nm; boom.add(shoulder);
    const upper = new THREE.Group(); shoulder.add(upper);
    const elbow = new THREE.Group(); shoulder.add(elbow);
    const fore = new THREE.Group(); elbow.add(fore);
    const wrist = new THREE.Group(); fore.add(wrist);
    const keyA = sx > 0 ? 'terra' : 'terra2', keyB = sx > 0 ? 'terra3' : 'terra';
    // upper arm: hydraulic core + armour sleeves (x in [-30, 0], slides so its end sits at the elbow)
    const Pu = new Part('upper' + nm), uS = cylX(8.8, -27), uC = 2 * PI * 8.8;
    Pu.add('char', std(new THREE.CylinderGeometry(6.4, 6.4, 30, 24).rotateZ(PI / 2).translate(-15, 0, 0), {}));
    for (let q = 0; q < 3; q++) Pu.add(q % 2 ? keyA : 'cream', slab(uS, q * uC / 3 + 0.5, (q + 1) * uC / 3 - 0.5, 0, 21, { t: 1.3, seed: S(), kind: KIND.PANEL }));
    Pu.add('bronze', std(new THREE.CylinderGeometry(10.6, 10.6, 2.4, 28).rotateZ(PI / 2).translate(-4.6, 0, 0), { crease: 40 }));
    Pu.add('char2', std(new THREE.CylinderGeometry(9.6, 9.6, 2, 24).rotateZ(PI / 2).translate(-29, 0, 0), {}));
    upper.add(Pu.build(M));
    // elbow joint (hinge axis = local z)
    const Pe = new Part('elbow' + nm);
    Pe.add('bronze', std(new THREE.CylinderGeometry(7.6, 7.6, 18, 28), { crease: 40 }).rotateX(PI / 2));
    Pe.add('char', std(new THREE.CylinderGeometry(9.4, 9.4, 2.4, 28).rotateX(PI / 2).translate(0, 0, 9.6), { crease: 40 }));
    Pe.add('char', std(new THREE.CylinderGeometry(9.4, 9.4, 2.4, 28).rotateX(PI / 2).translate(0, 0, -9.6), { crease: 40 }));
    elbow.add(Pe.build(M));
    // forearm (the nub): big armoured drum
    const Pa = new Part('fore' + nm), aS = cylX(12.6, 2.2), aC = 2 * PI * 12.6;
    Pa.add('hull', std(new THREE.CylinderGeometry(11.6, 11.6, 21, 32).rotateZ(PI / 2).translate(12.5, 0, 0), {}));
    for (let q = 0; q < 4; q++) Pa.add(q % 2 ? keyA : keyB, slab(aS, (q - 0.5) * aC / 4 + 0.6, (q + 0.5) * aC / 4 - 0.6, 3.0, 19.6, { t: 1.6, seed: S(), kind: q === 2 ? KIND.VENT : KIND.PANEL }));
    Pa.add('cream', slab(aS, -aC / 2, aC / 2, 0, 2.8, { t: 2.0, b: 0.5, seed: S(), kind: KIND.NONE, ustep: 2 }));
    Pa.add('bronze', std(new THREE.TorusGeometry(13.3, 1.6, 10, 40).rotateY(PI / 2).translate(21.4, 0, 0), { crease: 40 }));
    Pa.add('char', std(new THREE.CylinderGeometry(9.2, 9.2, 8, 28).rotateZ(PI / 2).translate(18.4, 0, 0), {}));   // inner sleeve (shows when extended)
    fore.add(Pa.build(M)); fore.position.x = 2.0;
    // wrist + palm + three clamp fingers: closed they form the dome cap at the end of the nub; each finger = one 120-degree
    // petal of an ellipsoid (rim radius CL.R, length CL.A), split into a proximal and a distal segment
    const Pw = new Part('palm' + nm);
    Pw.add('char', std(new THREE.CylinderGeometry(8.6, 8.6, 6, 28).rotateZ(PI / 2).translate(-3, 0, 0), {}));
    Pw.add('char2', std(new THREE.CylinderGeometry(10.0, 9.2, 3.2, 6).rotateZ(PI / 2).translate(1.6, 0, 0), { flat: true }));
    Pw.add('bronze', std(new THREE.CylinderGeometry(4.2, 4.2, 1.2, 20).rotateZ(PI / 2).translate(3.6, 0, 0), {}));
    wrist.add(Pw.build(M));
    const fingers = [], CL = { R: 10.4, A: 14, split: 0.86, tip: 1.48, w: 1.02 };
    const petal = (d, a) => { const rho = CL.R * Math.cos(a); return new V3(CL.A * Math.sin(a), rho * Math.cos(d) - CL.R, rho * Math.sin(d)); };
    const petalN = (d, a) => new V3(Math.sin(a) / CL.A, Math.cos(a) / CL.R * Math.cos(d), Math.cos(a) / CL.R * Math.sin(d)).normalize();
    const H = petal(0, CL.split + 0.01), TIPv = petal(0, CL.tip).sub(H);
    for (let f = 0; f < 3; f++) {
      const phi = f * 2 * PI / 3;
      const fb = new THREE.Group(); fb.position.set(DIM.PALM, CL.R * Math.cos(phi), CL.R * Math.sin(phi)); fb.rotation.x = phi; wrist.add(fb);   // local y = radial out, z = hinge
      const prox = new THREE.Group(); fb.add(prox); const dist = new THREE.Group(); dist.position.copy(H); prox.add(dist);
      const Pp = new Part('fingerP' + nm + f), Pd = new Part('fingerD' + nm + f);
      const Sp = (u, v) => { const d = u / CL.R, a = v / 12; return [petal(d, a), petalN(d, a)]; };
      const Sd = (u, v) => { const d = u / CL.R, a = v / 12; return [petal(d, a).sub(H), petalN(d, a)]; };
      Pp.add(f === 0 ? 'cream' : keyA, slab(Sp, -CL.R * CL.w, CL.R * CL.w, 0.3, CL.split * 12 - 0.15, { t: 0.7, b: 0.45, sink: 1.6, step: 1.2, closed: true, seed: S(), kind: KIND.PANEL }));
      Pp.add('bronze', std(new THREE.CylinderGeometry(1.5, 1.5, 13, 14).rotateX(PI / 2).translate(0.2, -0.8, 0), { crease: 40 }));
      Pd.add(f === 0 ? keyB : 'cream2', slab(Sd, -CL.R * CL.w * 0.98, CL.R * CL.w * 0.98, CL.split * 12 + 0.25, CL.tip * 12, { t: 0.7, b: 0.4, sink: 1.6, step: 1.0, closed: true, seed: S(), kind: KIND.PLAIN }));
      Pd.add('bronze', std(new THREE.CylinderGeometry(1.25, 1.25, 10.5, 14).rotateX(PI / 2).translate(0, -1.2, 0), { crease: 40 }));
      Pd.add('char2', std(new RoundedBoxGeometry(3.4, 1.0, 4.2, 1, 0.3), {}), MX.mul(MX.t(TIPv.x - 2.8, TIPv.y - 1.4, 0), MX.r(0, 0, -0.9)));
      // solid inner spines (charcoal) along each segment's chord: an opened finger reads as a heavy claw, not a hollow shell
      const spine = (Pt, a, b, w, th, key) => { const d = b.clone().sub(a), L = d.length(); d.normalize();
        const yo = new V3(-d.y, d.x, 0), mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(yo, -1.1);
        Pt.add(key, std(new RoundedBoxGeometry(L * 0.92, th, w, 2, 0.6), {}), new THREE.Matrix4().makeBasis(d, yo, new V3(0, 0, 1)).setPosition(mid)); };
      spine(Pp, new V3(0.6, -0.2, 0), H, 5.2, 2.4, 'char');
      spine(Pd, new V3(0, 0, 0), TIPv.clone().multiplyScalar(0.92), 4.4, 2.2, 'char2');
      prox.add(Pp.build(M)); dist.add(Pd.build(M));
      const tipA = new THREE.Object3D(); tipA.position.copy(TIPv); dist.add(tipA);
      fingers.push({ fb, prox, dist, phi, tip: tipA, H: H.clone(), TIP: TIPv.clone() });
    }
    const palm = anchor('hand' + nm, wrist, [DIM.PALM + 1.2, 0, 0]); anchors['palm' + nm] = palm;
    const sAnchor = anchor('shoulder' + nm, base, [0, 0, 0]);
    arms.push({ name: nm, sx, base, boom, shoulder, upper, elbow, fore, wrist, fingers, palm });
  }

  // re-aim the knee pistons after the leg pose (cylinder on the thigh mount, rod on the shin mount)
  const _pa = new V3(), _pb = new V3(), _pd = new V3(), UPV = new V3(0, 1, 0), DNV = new V3(0, -1, 0);
  function updatePistons() {
    for (const L of legs) { L.thigh.updateMatrixWorld(true);
      for (const p of L.pistons) { _pa.copy(p.a.position); L.thigh.worldToLocal(p.b.getWorldPosition(_pb)); _pd.subVectors(_pb, _pa).normalize();
        p.cyl.position.copy(_pa); p.cyl.quaternion.setFromUnitVectors(DNV, _pd); p.rod.position.copy(_pb); p.rod.quaternion.setFromUnitVectors(UPV, _pd.negate()); } }
  }
  return { root, rig, body, visor, faceSlot, glass, glint, reactor, crystal, petals, glowR, legs, arms, anchors, decals, antenna, B, bends, updatePistons };
}

// ---------------------------------------------------------------------------------------------------------------------
// special materials
// ---------------------------------------------------------------------------------------------------------------------
// faceted reactor crystal: three cel tones per facet, emissive by level (uK), no ink (FX id)
export function crystalMaterial(ctx) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uDark: { value: new THREE.Color(0x1e3a66) }, uMid: { value: new THREE.Color(0x3c86c8) }, uLite: { value: new THREE.Color(0xbfefff) },
      uGlow: { value: new THREE.Color(0x4cc4ff) }, uKeyDir: ctx.light.u.uKeyDir },
    vertexShader: /* glsl */`varying vec3 vN, vW, vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      vV = position; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform float uK; uniform vec3 uDark, uMid, uLite, uGlow, uKeyDir; varying vec3 vN, vW, vV;
      void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float l = dot(N, normalize(uKeyDir)), f = dot(N, V);
        vec3 c = l > 0.35 ? uLite : (l > -0.15 ? uMid : uDark);
        float hot = clamp(uK, 0.0, 2.0);
        vec3 inner = mix(uGlow, vec3(1.0), smoothstep(0.75, 0.98, f) * smoothstep(0.8, 2.0, hot)) * (0.55 + 1.15 * hot) * (l > 0.35 ? 1.25 : (l > -0.15 ? 1.0 : 0.72));
        vec3 col = mix(c * 0.9, inner, smoothstep(0.0, 0.6, hot));
        col += uGlow * hot * 0.8 * (1.0 - f);
        gl_FragColor = vec4(col, 1.0); }` });
  return ctx.mat.mrt(m, { id: ctx.mat.ID.FX });
}
// visor glint: a short double streak in the TOP-LEFT corner of the glass only, fading out downward, so it never crosses
// the eyes or the mouth. mecha.js mirrors it (scale.x) to the corner on the key light's side and sets its strength.
function glintMaterial(kit) {
  const tex = kit.canvasTex(256, 128, (c, w, h) => { c.clearRect(0, 0, w, h);
    const band = (x0, wd, a) => { c.save(); c.translate(x0, 0); c.transform(1, 0, -0.6, 1, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, h * 0.26); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.6, `rgba(255,255,255,${a * 0.7})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(wd, 0); c.lineTo(wd * 0.75, h * 0.26); c.lineTo(wd * 0.25, h * 0.26); c.closePath(); c.fill(); c.restore(); };
    band(30, 12, 0.85); band(47, 4, 0.6); }, { srgb: false, mips: true });
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.32, 0.38, 0.48), transparent: true, depthWrite: false });
  kit.addBlend(m); m.userData.k0 = 0.55; return m;
}
// sole thruster: nozzle glow disc + flame cone (blue core, shock diamonds) + glow sprite; group.set(k)
export function thruster(ctx) {
  const { kit, mat } = ctx;
  const g = new THREE.Group(); g.name = 'thruster';
  const disc = new THREE.Mesh(std(new THREE.CircleGeometry(7.6, 28).rotateX(PI / 2)), mat.fx(0x7fdcff, { k: 2.5 })); disc.userData.noSolid = true; g.add(disc);
  // flame: bright core near the nozzle, blue sheath, travelling shock diamonds; fades when seen down its axis (never
  // floods a camera that sits in the exhaust)
  const fm = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uK: { value: 1 }, uT: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vNv, vVv, vAx; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vVv = -mv.xyz; vNv = normalize(normalMatrix * normal);
      vAx = normalize(mat3(modelViewMatrix) * vec3(0.0, 1.0, 0.0)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform float uK, uT; varying vec2 vUv; varying vec3 vNv, vVv, vAx;
      void main(){ float v = 1.0 - vUv.y; vec3 V = normalize(vVv); float f = abs(dot(normalize(vNv), V));
        float side = 1.0 - smoothstep(0.75, 0.97, abs(dot(vAx, V)));
        float core = smoothstep(0.45, 0.95, f) * (1.0 - smoothstep(0.0, 0.45, v));
        float diamonds = 0.5 + 0.5 * cos((v * 7.0 - uT * 9.0) * 6.2831);
        float a = pow(1.0 - v, 1.8) * (0.2 + 0.8 * f) * (0.7 + 0.3 * diamonds) * mix(0.12, 1.0, side);
        vec3 c = mix(vec3(0.22, 0.6, 1.5), vec3(0.85, 0.97, 1.2), core) * (1.1 + 1.3 * core);
        gl_FragColor = vec4(c * min(uK, 1.2), a * clamp(uK, 0.0, 1.0) * 0.8); }` });
  kit.addBlend(fm); mat.mrt(fm, { id: mat.ID.FX });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 1.4, 1, 24, 1, true).translate(0, -0.5, 0), fm); cone.userData.noSolid = true; cone.frustumCulled = false; g.add(cone);
  const sp = new THREE.Sprite(kit.addBlend(new THREE.SpriteMaterial({ map: kit.glowTexture(), color: new THREE.Color(0x60c8ff), depthTest: true }))); sp.scale.setScalar(40); sp.position.y = -4; g.add(sp);
  const pt = ctx.light.addPoint({ pos: g, offset: new V3(0, -6, 0), color: 0x6ad0ff, intensity: 0, range: 60 });
  // k 0..2.2: above 1.3 the flame keeps growing (the s28 push flash)
  g.set = (k, len = 60, t = 0) => { g.visible = k > 0.01; const kk = Math.min(k, 2.2); disc.material.uniforms.uK.value = 0.6 + 1.5 * Math.min(k, 1.2) + 0.8 * Math.max(0, kk - 1.3);
    cone.scale.set(0.85 + 0.2 * Math.min(kk, 1.6), Math.max(0.01, len * (Math.min(k, 1.25) + 0.9 * Math.max(0, kk - 1.3))), 0.85 + 0.2 * Math.min(kk, 1.6));
    fm.uniforms.uK.value = Math.min(1.15, k); fm.uniforms.uT.value = t; sp.material.color.setHex(0x60c8ff).multiplyScalar(0.3 * Math.min(1.2, k) + 0.25 * Math.max(0, kk - 1.3)); sp.scale.setScalar(20 + 16 * Math.min(kk, 2.0)); pt.intensity = 2.0 * Math.min(1.2, k); };
  g.userData = { disc, cone, sprite: sp, point: pt };
  g.set(0); return g;
}

// hand-lettered markings (canvas): cream / charcoal paint with slight per-letter jitter + wear speckles
function letteringTextures(kit) {
  const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const paint = (w, h, draw, seed) => kit.canvasTex(w, h, (c) => { c.clearRect(0, 0, w, h); draw(c, w, h); const r = rng(seed);
    c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < w * h / 900; i++) { c.globalAlpha = 0.5 + r() * 0.5; c.beginPath(); c.arc(r() * w, r() * h, 0.6 + r() * 2.2, 0, 7); c.fill(); }
    for (let i = 0; i < 18; i++) { c.globalAlpha = 0.8; c.lineWidth = 1 + r() * 2; c.beginPath(); const x = r() * w, y = r() * h; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * w * 0.15, y + (r() - 0.5) * 8); c.stroke(); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; });
  const fnt = (size, font) => `${font[0]} ${size}px ${font[1]}`;
  const letters = (c, text, x0, y, size, font, spacing, seed) => { const r = rng(seed); c.fillStyle = '#fff'; c.font = fnt(size, font); c.textBaseline = 'middle'; let x = x0;
    for (const ch of text) { const wd = c.measureText(ch).width; c.save(); c.translate(x + wd / 2, y + (r() - 0.5) * size * 0.05); c.rotate((r() - 0.5) * 0.06); c.scale(1 + (r() - 0.5) * 0.05, 1);
      c.fillText(ch, -wd / 2, 0); c.restore(); x += wd + spacing; } return x - spacing - x0; };
  const fit = (c, text, size, font, spacing) => { c.font = fnt(size, font); let w = 0; for (const ch of text) w += c.measureText(ch).width + spacing; return w - spacing; };
  const BLOCK = ['italic 900', '"Arial Black", "Segoe UI Black", Impact, sans-serif'], JP = ['900', '"Yu Gothic UI", "Yu Gothic", "Meiryo", "MS Gothic", sans-serif'];
  return {
    clawd: paint(1024, 288, (c, w, h) => { const tw = fit(c, 'CLAWD-01', 220, BLOCK, 6); letters(c, 'CLAWD-01', (w - tw) / 2, h / 2 + 8, 220, BLOCK, 6, 3);
      c.fillStyle = '#fff'; c.fillRect(30, h - 26, w - 60, 10); c.fillRect(30, 14, w * 0.35, 8); }, 11),
    clawdSmall: paint(512, 116, (c, w, h) => { const tw = fit(c, 'CLAWD-01', 92, BLOCK, 3); letters(c, 'CLAWD-01', (w - tw) / 2, h / 2 + 4, 92, BLOCK, 3, 9); }, 21),
    kanji: paint(512, 256, (c, w, h) => { const tw = fit(c, '巨神', 230, JP, 4); letters(c, '巨神', (w - tw) / 2, h / 2 + 10, 230, JP, 4, 5); }, 13),
    num: paint(512, 400, (c, w, h) => { const tw = fit(c, '01', 380, BLOCK, 0); letters(c, '01', (w - tw) / 2, h / 2 + 20, 380, BLOCK, 0, 7); }, 17),
    small: paint(512, 102, (c, w, h) => { c.fillStyle = '#fff'; c.font = fnt(46, BLOCK); c.textBaseline = 'middle'; c.fillText('MC-01 HATCH', 10, h / 2); c.font = fnt(44, JP); c.fillText('搭乗口', 368, h / 2); }, 19),
    warn: paint(256, 256, (c, w, h) => { c.strokeStyle = '#fff'; c.lineWidth = 18; c.lineJoin = 'round'; c.beginPath(); c.moveTo(w / 2, 26); c.lineTo(w - 22, h - 34); c.lineTo(22, h - 34); c.closePath(); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(w / 2 - 9, 88, 18, 80); c.beginPath(); c.arc(w / 2, 190, 11, 0, 7); c.fill(); }, 23),
  };
}
