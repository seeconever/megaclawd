// =====================================================================================================================
// MEGA CLAWD · COCKPIT (owner: pilot) — the pilot cabin inside MEGA CLAWD's head, sized for a 0.5 m pilot.
// A round cabin (r 1.45 m, ceiling 2.2 m): a low kid-size bucket seat on a hydraulic post, two control levers with tall
// ridged grips (the nub tip presses a swivel pad on the inner side of the grip, two small jaws hug it), a curved console with
// hand-lettered screens (src/cockpit-displays.js), button banks, side switch panels, a rear wall dressed with pipes, tall
// display columns, a big 巨神 stencil plate and two red alarm beacons, a lamp band all around the cabin (cyan / boot
// cascade / red chase), the entry hatch in the ceiling (Clawd drops in through it in s12) and the big curved visor window
// with the HUD on the glass; outside it a painted view (src/cockpit-view.js): underwater (s12), sky + meteor (s18),
// the stratosphere with the meteor in MEGA CLAWD's hands (s26).
// Local frame = set group 'cockpit' (at the world origin): seat at the origin, the pilot faces +z, floor y = 0.
//
// API  ctx.modules.cockpit = {
//   seat: [x, y, z]          where Clawd's root sits (seat pan top y = seatTop)
//   seatTop                   seat pan top (m)
//   levers: [L, R]            lever pivots (Object3D, rotation.x = push angle)
//   socket(i) -> Vector3      world point where nub tip i presses its lever's grip pad (0 = Clawd's L nub at -x, 1 = R)
//   alignSocket(i, dirW, f)   swivel pad i onto the nub direction (world unit vector) for frame f (pilot calls it)
//   poseLevers(t, shot)       pose the levers for film time t (pure; the pilot calls it before reaching for the sockets)
//   state(t, shot) -> { on, alarm, mode, push, shake, grip }   the cabin state for film time t
//   group, view, screens      the cabin root group, the painted outside view, the display painter
//   cups                      the swivel pads (solids 'lever-L' / 'lever-R')
// }
// Timing: levers / lamps on twos with Clawd, screens + camera shake on ones.
// =====================================================================================================================
import * as THREE from 'three';
import { makeScreens } from './cockpit-displays.js';
import { makeView, METEOR } from './cockpit-view.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = THREE.Vector3, DEG = Math.PI / 180;
const RW = 1.45, CEIL = 2.2;
const WIN = { r: 1.3, y0: 0.98, y1: 1.95, a: 62 * DEG };   // visor window (cylinder section)
const SEAT_TOP = 0.5;
const LEV = { x: 0.35, y: 0.31, z: 0.06, rest: -6, push: 14, T: [-0.034, 0.34, 0] };   // pivot, angles (deg), nub contact point (local, x * side)
const HATCH_R = 0.36;

// wall plates: panel grid with bevels, rivets, vents, label plates, hazard strips, access hatches (deterministic)
function panelTexture(kit, seed = 3) {
  return kit.canvasTex(2048, 512, (c, w, h) => {
    let s = seed; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    c.fillStyle = '#dfe4ee'; c.fillRect(0, 0, w, h);
    const rows = [0, 96, 256, 400, 512];
    for (let r = 0; r < rows.length - 1; r++) for (let x = 0; x < w;) {
      const pw = 128 * (1 + Math.floor(R() * 3)), y0 = rows[r], ph = rows[r + 1] - y0, x1 = Math.min(w, x + pw);
      const tone = 214 + Math.floor(R() * 34); c.fillStyle = `rgb(${tone - 6},${tone - 2},${tone + 8})`; c.fillRect(x + 3, y0 + 3, x1 - x - 6, ph - 6);
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(x + 4, y0 + 4, x1 - x - 8, 3); c.fillRect(x + 4, y0 + 4, 3, ph - 8);
      c.fillStyle = 'rgba(40,46,66,0.45)'; c.fillRect(x + 4, y0 + ph - 7, x1 - x - 8, 3); c.fillRect(x1 - 7, y0 + 4, 3, ph - 8);
      c.fillStyle = 'rgba(30,34,50,0.85)'; for (const [dx, dy] of [[12, 12], [x1 - x - 12, 12], [12, ph - 12], [x1 - x - 12, ph - 12]]) { c.beginPath(); c.arc(x + dx, y0 + dy, 3.4, 0, Math.PI * 2); c.fill(); }
      const f = R(), cx = (x + x1) / 2, cy = y0 + ph / 2;
      if (f < 0.22) { c.fillStyle = 'rgba(28,32,46,0.85)'; for (let i = 0; i < 6; i++) { const yy = cy - 30 + i * 11; c.beginPath(); c.roundRect(cx - 40, yy, 80, 5, 2.5); c.fill(); } }
      else if (f < 0.4) { c.fillStyle = R() < 0.5 ? '#f2d36a' : '#efe6d2'; c.fillRect(cx - 44, cy - 13, 88, 26); c.strokeStyle = 'rgba(30,30,40,0.8)'; c.lineWidth = 2; c.strokeRect(cx - 44, cy - 13, 88, 26);
        c.fillStyle = '#23232c'; c.font = '700 17px "Bahnschrift", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(['HYD-07', 'PWR 3B', 'COOL 2', 'CL-01', 'VALVE 9', 'LINK A'][Math.floor(R() * 6)], cx, cy + 1); }
      else if (f < 0.5) { c.save(); c.beginPath(); c.rect(x + 8, y0 + ph - 30, x1 - x - 16, 18); c.clip(); c.fillStyle = '#f2c230'; c.fillRect(x, y0 + ph - 30, x1 - x, 18);
        c.fillStyle = '#1c1c22'; for (let k = x - 20; k < x1; k += 22) { c.beginPath(); c.moveTo(k, y0 + ph - 12); c.lineTo(k + 11, y0 + ph - 30); c.lineTo(k + 22, y0 + ph - 30); c.lineTo(k + 11, y0 + ph - 12); c.fill(); } c.restore(); }
      else if (f < 0.6 && ph > 120) { c.strokeStyle = 'rgba(30,34,50,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 34, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(30,34,50,0.8)'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.arc(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 3, 0, Math.PI * 2); c.fill(); } }
      else if (f < 0.68) { c.fillStyle = '#f2c230'; c.beginPath(); c.moveTo(cx, cy - 18); c.lineTo(cx + 20, cy + 14); c.lineTo(cx - 20, cy + 14); c.closePath(); c.fill();
        c.fillStyle = '#1c1c22'; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillText('!', cx, cy + 10); }
      else if (f < 0.76) { c.fillStyle = 'rgba(30,34,50,0.7)'; c.font = '700 26px "Yu Gothic UI", sans-serif'; c.textAlign = 'center'; c.fillText(['注意', '整備', '高圧', '冷却'][Math.floor(R() * 4)], cx, cy + 8); }
      c.strokeStyle = 'rgba(24,28,42,0.95)'; c.lineWidth = 3; c.strokeRect(x + 1.5, y0 + 1.5, x1 - x - 3, ph - 3);
      x = x1;
    }
  }, { repeat: true });
}
const flipU = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); return geo; };

export async function create(ctx) {
  const { mat, kit, util } = ctx;
  const { sstep, clamp, lerp, bump } = util, cues = ctx.cues;
  const g = new THREE.Group(); g.name = 'cockpit'; ctx.sets.cockpit.add(g);
  const id = () => mat.nextId();
  // ---- materials ----------------------------------------------------------------------------------------------------
  const panelTex = panelTexture(kit, 3), panelTex2 = panelTexture(kit, 11);
  const hazTex = kit.canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1c22'; for (let x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, 0); c.lineTo(x + 32, 0); c.lineTo(x + 16, h); c.fill(); } }, { repeat: true });
  const gratTex = kit.canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(25,28,40,0.85)'; for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 6, h); c.fillRect(0, 0, w, 6); c.fillRect(0, 128, w, 6); }, { repeat: true });
  panelTex.repeat.set(2, 1); panelTex2.repeat.set(1, 0.5); hazTex.repeat.set(10, 1); gratTex.repeat.set(10, 10);
  const M = {
    wall: mat.cel(0x7484a4, { id: id(), map: panelTex, bevel: 0.05, hiAmt: 0.35, spec: 0.25, side: THREE.DoubleSide }),
    wall2: mat.cel(0x6a7898, { id: id(), map: panelTex2, bevel: 0.05, hiAmt: 0.35, spec: 0.25, side: THREE.DoubleSide }),
    dark: mat.cel(0x2a303f, { id: id(), bevel: 0.03, hiAmt: 0.4, spec: 0.5 }),
    hull: mat.cel(0x4f5b76, { id: id(), bevel: 0.03, hiAmt: 0.45, spec: 0.45 }),
    hullD: mat.cel(0x4f5b76, { id: id(), bevel: 0.03, hiAmt: 0.45, spec: 0.45, side: THREE.DoubleSide }),
    cream: mat.cel(0xcfc4ae, { id: id(), bevel: 0.03, hiAmt: 0.35, spec: 0.15 }),
    creamD: mat.cel(0xcfc4ae, { id: id(), bevel: 0.03, hiAmt: 0.35, spec: 0.15, side: THREE.DoubleSide }),
    terra: mat.cel(0xcc6a4a, { id: id(), bevel: 0.03, hiAmt: 0.55, spec: 0.4 }),
    terraD: mat.cel(0xa04c36, { id: id(), bevel: 0.02, hiAmt: 0.4, side: THREE.DoubleSide }),
    bronze: mat.cel(0xc89a52, { id: id(), bevel: 0.02, hiAmt: 0.7, spec: 0.8, specThr: 0.95 }),
    steel: mat.cel(0x939bad, { id: id(), bevel: 0.01, hiAmt: 0.6, spec: 0.8 }),
    rubber: mat.cel(0x343842, { id: id(), bevel: 0.01, hiAmt: 0.35 }),
    haz: mat.cel(0xffffff, { id: id(), map: hazTex, bevel: 0.02 }),
    floor: mat.cel(0x4c5468, { id: id(), map: gratTex, hiAmt: 0.25, spec: 0.1 }),
    btn: mat.cel(0xffffff, { id: id(), bevel: 0.006, hiAmt: 0.7, spec: 0.7 }),
    red: mat.cel(0xe23b2e, { id: id(), bevel: 0.005, hiAmt: 0.7, spec: 0.8 }),
    cushion: mat.cel(0x34406a, { id: id(), bevel: 0.02, hiAmt: 0.35, spec: 0.2 }),
  };
  const add = (geo, m, p = [0, 0, 0], r = [0, 0, 0], parent = g) => { const o = new THREE.Mesh(geo, m); o.position.fromArray(p); o.rotation.set(r[0], r[1], r[2]); parent.add(o); return o; };
  const arc = (r0, r1, h, a0, a1, segs = 48) => new THREE.CylinderGeometry(r1, r0, h, segs, 1, true, a0, a1 - a0);   // r1 top, r0 bottom
  const rb = (w, h, d, r = 0.01) => new RoundedBoxGeometry(w, h, d, 2, r);
  const onArc = (o, r, a, y) => { o.position.set(Math.sin(a) * r, y, Math.cos(a) * r); o.lookAt(0, y, 0); return o; };   // faces the cabin centre (+z local)

  // ---- shell: floor, walls, ribs, ceiling, hatch ---------------------------------------------------------------------
  add(new THREE.CircleGeometry(1.46, 64).rotateX(-Math.PI / 2), M.floor);
  add(flipU(arc(RW, RW, CEIL, WIN.a, Math.PI * 2 - WIN.a, 64)), M.wall, [0, CEIL / 2, 0]);
  add(flipU(arc(RW, RW, WIN.y0, -WIN.a, WIN.a, 40)), M.wall2, [0, WIN.y0 / 2, 0]);
  add(arc(1.4, 1.4, CEIL - WIN.y1, -WIN.a, WIN.a, 40), M.hullD, [0, (CEIL + WIN.y1) / 2, 0]);
  for (let a = WIN.a + 0.22; a < Math.PI * 2 - WIN.a; a += 0.4) { const rib = add(rb(0.08, CEIL, 0.07, 0.015), M.hull); onArc(rib, 1.415, a, CEIL / 2); }
  add(arc(1.44, 1.44, 0.07, WIN.a, Math.PI * 2 - WIN.a, 64), mat.cel(0xffffff, { id: id(), map: hazTex, side: THREE.DoubleSide }), [0, 0.035, 0]);   // hazard skirting
  for (const y of [0.42, 1.62]) add(new THREE.TorusGeometry(1.385, 0.026, 8, 64, Math.PI * 2 - 2 * WIN.a - 0.1), y > 1 ? M.bronze : M.terraD, [0, y, 0], [Math.PI / 2, 0, Math.PI / 2 + WIN.a + 0.05]);
  const ceil = add(new THREE.RingGeometry(HATCH_R, 1.46, 64, 1).rotateX(Math.PI / 2), M.hullD, [0, CEIL, 0]);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) { const b = add(rb(0.07, 0.06, 1.0, 0.01), M.dark); b.position.set(Math.sin(a) * 0.92, CEIL - 0.03, Math.cos(a) * 0.92); b.rotation.y = a; }
  // hatch: hazard ring, dark shaft with rungs, the lid hinged open
  add(new THREE.TorusGeometry(HATCH_R + 0.01, 0.035, 10, 48).rotateX(Math.PI / 2), M.haz, [0, CEIL - 0.02, 0]);
  add(new THREE.CylinderGeometry(HATCH_R, HATCH_R, 1.4, 32, 1, true), mat.cel(0x262a36, { id: id(), side: THREE.DoubleSide, hiAmt: 0.2 }), [0, CEIL + 0.7, 0]);
  for (let y = CEIL + 0.15; y < CEIL + 1.3; y += 0.22) add(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI).rotateY(Math.PI / 2), M.steel, [0, y, -HATCH_R + 0.01], [0, 0, 0]);
  const lid = new THREE.Group(); lid.position.set(0, CEIL, -HATCH_R - 0.03); lid.rotation.x = -100 * DEG; g.add(lid);
  add(new THREE.CylinderGeometry(HATCH_R - 0.01, HATCH_R - 0.01, 0.05, 32).translate(0, 0, HATCH_R).rotateX(Math.PI / 2), M.hull, [0, 0, 0], [0, 0, 0], lid);
  add(new THREE.TorusGeometry(0.16, 0.018, 8, 24), M.bronze, [0, 0.04, HATCH_R], [Math.PI / 2, 0, 0], lid);

  // ---- rear wall dressing: pipes, display columns, stencil plate, beacons ---------------------------------------------
  for (const [a, r, m] of [[Math.PI - 0.32, 0.035, M.bronze], [Math.PI + 0.32, 0.035, M.bronze], [Math.PI - 0.95, 0.05, M.terraD], [Math.PI + 0.95, 0.05, M.terraD], [Math.PI - 1.18, 0.028, M.steel], [Math.PI + 1.18, 0.028, M.steel]]) {
    const x = Math.sin(a) * (1.36 - r), z = Math.cos(a) * (1.36 - r); add(new THREE.CylinderGeometry(r, r, CEIL, 12), m, [x, CEIL / 2, z]);
    for (const y of [0.3, 0.95, 1.55, 2.0]) add(new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.04, 12), M.dark, [x, y, z]); }
  const scr = makeScreens(kit), screenMesh = [];
  const screen = (tex, w, h, a, y, r = 0.955, k = 1.5, frameM = M.dark) => { const back = add(rb(w + 0.04, h + 0.04, 0.03, 0.01), frameM); onArc(back, r + 0.012, a, y);
    const s = add(new THREE.PlaneGeometry(w, h), mat.fx(0xffffff, { k, map: tex })); onArc(s, r - 0.006, a, y); screenMesh.push(s); return s; };
  screen(scr.tallL.tex, 0.2, 0.4, Math.PI + 0.62, 1.0, 1.3, 1.4); screen(scr.tallR.tex, 0.2, 0.4, Math.PI - 0.62, 1.0, 1.3, 1.4);
  for (const a of [1.68, -1.68]) screen(scr.warn.tex, 0.3, 0.15, a, 1.6, 1.3, 1.5, M.haz);   // big warning panels high on the side walls (s26)
  const plateTex = kit.canvasTex(1024, 320, (c, w, h) => { c.fillStyle = '#c8694a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f3e8d2'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#f3e8d2'; c.font = '800 190px "Yu Mincho", "MS Mincho", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(w * 0.3, h * 0.52); c.rotate(-0.03); c.fillText('巨神', 0, 0); c.restore();
    c.font = '800 70px "Bahnschrift", sans-serif'; c.fillText('CLAWD-01', w * 0.73, h * 0.38); c.font = '700 40px "Bahnschrift", sans-serif'; c.fillText('PILOT BAY · 操縦席', w * 0.73, h * 0.68); });
  const plate = add(rb(0.62, 0.2, 0.025, 0.008), M.hull); onArc(plate, 1.33, Math.PI, 1.42);
  const plateF = add(new THREE.PlaneGeometry(0.58, 0.18), mat.cel(0xffffff, { id: mat.ID.NOINK + 22, ink: false, map: plateTex, hiAmt: 0.3 })); onArc(plateF, 1.316, Math.PI, 1.42);
  const beacons = [];
  for (const sx of [-1, 1]) { const a = Math.PI + sx * 0.62, y = 1.3;
    const hb = add(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 16), M.dark); onArc(hb, 1.34, a, y - 0.04); hb.rotateX(-Math.PI / 2);
    const dome = add(new THREE.SphereGeometry(0.045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat.fx(0xff3a2a, { k: 0.3 })); onArc(dome, 1.3, a, y); dome.rotateX(Math.PI / 2);
    const gsrc = kit.glowSource({ color: 0xff3a2a, intensity: 0, core: 0.03, halo: 0.32, glow: 1.3, spill: 2.2, range: 2.6 }); gsrc.position.set(Math.sin(a) * 1.27, y, Math.cos(a) * 1.27); g.add(gsrc);
    beacons.push({ dome, gsrc, ph: sx > 0 ? 0 : Math.PI }); }
  // lamp band all around the cabin (painted strip, emissive)
  const band = add(flipU(arc(1.368, 1.368, 0.035, WIN.a + 0.04, Math.PI * 2 - WIN.a - 0.04, 64)), mat.fx(0xffffff, { k: 1.6, map: scr.lamps.tex }), [0, 1.74, 0]); band.material.side = THREE.DoubleSide;
  add(arc(1.374, 1.374, 0.07, WIN.a + 0.02, Math.PI * 2 - WIN.a - 0.02, 64), M.hullD, [0, 1.74, 0]);

  // ---- seat: low kid-size bucket (his upper body clears the backrest) -----------------------------------------------
  const seat = new THREE.Group(); seat.name = 'pilot-seat'; g.add(seat);
  add(new THREE.CylinderGeometry(0.22, 0.26, 0.04, 32), M.dark, [0, 0.02, -0.02], [0, 0, 0], seat);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.36, 20), M.steel, [0, 0.22, -0.02], [0, 0, 0], seat);
  for (const y of [0.1, 0.3]) add(new THREE.TorusGeometry(0.075, 0.016, 8, 20).rotateX(Math.PI / 2), M.bronze, [0, y, -0.02], [0, 0, 0], seat);
  const pan = add(rb(0.62, 0.07, 0.44, 0.025), M.cream, [0, SEAT_TOP - 0.065, -0.01], [0, 0, 0], seat);
  add(rb(0.54, 0.035, 0.38, 0.015), M.cushion, [0, SEAT_TOP - 0.018, -0.01], [0, 0, 0], seat);                        // cushion (navy: no second terracotta block under him)
  const BH = 0.32, back = add(new THREE.CylinderGeometry(0.62, 0.62, BH, 32, 1, true, Math.PI - 0.5, 1.0), M.creamD, [0, SEAT_TOP + BH / 2 - 0.02, 0.37], [0, 0, 0], seat);
  add(new THREE.CylinderGeometry(0.595, 0.595, BH - 0.07, 32, 1, true, Math.PI - 0.42, 0.84), M.terraD, [0, SEAT_TOP + BH / 2 - 0.02, 0.37], [0, 0, 0], seat);
  add(new THREE.TorusGeometry(0.62, 0.014, 6, 32, 1.0), M.bronze, [0, SEAT_TOP + BH - 0.02, 0.37], [Math.PI / 2, 0, -Math.PI / 2 - 0.5], seat);   // backrest top trim
  for (const sx of [-1, 1]) add(rb(0.045, 0.09, 0.4, 0.02), M.cream, [sx * 0.292, SEAT_TOP + 0.015, -0.02], [0, 0, 0], seat);       // low bolsters (under the nubs)
  const emb = kit.canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#c8694a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f3e8d2'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#f3e8d2'; c.font = '800 64px "Bahnschrift", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CLAWD-01', w * 0.42, h / 2);
    c.font = '800 60px "Yu Mincho", serif'; c.fillText('巨神', w * 0.86, h / 2); });
  const embM = mat.cel(0xffffff, { id: mat.ID.NOINK + 21, ink: false, map: emb, hiAmt: 0.3 });
  add(new THREE.PlaneGeometry(0.3, 0.094), embM, [0, SEAT_TOP + 0.15, -0.262], [0, Math.PI, 0], seat);                    // on the back of the backrest
  ctx.solids.add('cockpit-seat', pan, { kind: 'box', groups: ['cockpit'] });

  // ---- levers: pedestal, boot, stick, tall ridged rubber grip with a red thumb button; the nub tip presses a swivel pad
  // on the inner side of the grip and two small bronze jaws hug the last centimetre of the nub (the grip stays visible
  // above and below the nub, nothing swallows it)
  const levers = [], cups = [], leds = [], align = [null, null], vib = [];
  const vibTex = kit.canvasTex(256, 256, (c, w, h) => { c.lineCap = 'round';
    for (const [s, k] of [[-1, 0], [1, 1]]) for (let i = 0; i < 3; i++) { const r = 54 + i * 22, a0 = s < 0 ? Math.PI * 0.78 : -Math.PI * 0.22, a1 = a0 + Math.PI * 0.44;
      c.strokeStyle = 'rgba(40,10,14,0.9)'; c.lineWidth = 11 - i * 2; c.beginPath(); c.arc(w / 2, h / 2, r, a0, a1); c.stroke();
      c.strokeStyle = '#fff6ee'; c.lineWidth = 6 - i * 1.4; c.beginPath(); c.arc(w / 2, h / 2, r, a0 + 0.04, a1 - 0.04); c.stroke(); } }, { srgb: true });
  for (const sx of [-1, 1]) {
    add(rb(0.11, 0.3, 0.17, 0.02), M.hull, [sx * LEV.x, 0.15, LEV.z]); add(new THREE.BoxGeometry(0.112, 0.03, 0.172), M.haz, [sx * LEV.x, 0.27, LEV.z]);
    const pv = new THREE.Group(); pv.position.set(sx * LEV.x, LEV.y, LEV.z); g.add(pv); levers.push(pv);
    add(new THREE.CylinderGeometry(0.026, 0.05, 0.07, 16), M.rubber, [0, 0.02, 0], [0, 0, 0], pv);
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.24, 12), M.steel, [0, 0.12, 0], [0, 0, 0], pv);
    add(new THREE.CylinderGeometry(0.031, 0.03, 0.022, 16), M.bronze, [0, 0.236, 0], [0, 0, 0], pv);
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 16), M.rubber, [0, 0.355, 0], [0, 0, 0], pv);
    for (let y = 0.262; y < 0.455; y += 0.024) add(new THREE.TorusGeometry(0.026, 0.0045, 6, 16).rotateX(Math.PI / 2), M.rubber, [0, y, 0], [0, 0, 0], pv);
    add(new THREE.CylinderGeometry(0.024, 0.031, 0.026, 16), M.bronze, [0, 0.478, 0], [0, 0, 0], pv);
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 12), M.red, [0, 0.499, 0], [0, 0, 0], pv);
    const led = add(new THREE.TorusGeometry(0.031, 0.0042, 6, 24).rotateX(Math.PI / 2), mat.fx(0x56e8ff, { k: 0.2 }), [0, 0.466, 0], [0, 0, 0], pv); leds.push(led);
    const T = new V3(sx * LEV.T[0], LEV.T[1], LEV.T[2]);
    // the pad: local +x = the nub direction (pointing out of the nub into the pad), origin = where the nub tip sits
    const cup = new THREE.Group(); cup.position.copy(T); pv.add(cup); cups.push(cup);
    add(new THREE.CylinderGeometry(0.044, 0.046, 0.008, 24).rotateZ(Math.PI / 2), M.dark, [0.005, 0, 0], [0, 0, 0], cup);
    add(new THREE.TorusGeometry(0.045, 0.0035, 6, 28).rotateY(Math.PI / 2), M.bronze, [0.002, 0, 0], [0, 0, 0], cup);
    for (const s of [1, -1]) {   // jaws over the top and bottom of the nub tip
      const jaw = add(new THREE.TorusGeometry(0.06, 0.006, 6, 12, 1.0).rotateZ(Math.PI / 2 - 0.5).rotateY(Math.PI / 2), M.bronze, [-0.011, 0, 0], [s > 0 ? 0 : Math.PI, 0, 0], cup);
      add(new THREE.BoxGeometry(0.02, 0.008, 0.016), M.bronze, [-0.002, s * 0.058, 0], [0, 0, 0], cup); }
    // vibration lines (s26): a billboard of drawn strokes around the grip, shown while the levers rattle
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat.fx(0xffffff, { k: 1.0, map: vibTex, opacity: 0.999 })); v.position.set(0, 0.36, 0); v.visible = false; v.renderOrder = 12; pv.add(v); vib.push(v);
  }

  // ---- console: desk arc, lower body, screen panel, screens, buttons, lamps -----------------------------------------
  const CA = 68 * DEG;
  add(arc(0.9, 0.9, 0.64, -CA, CA, 48), M.hullD, [0, 0.32, 0]);
  add(new THREE.RingGeometry(0.6, 0.94, 48, 1, Math.PI / 2 - CA, 2 * CA).rotateX(-Math.PI / 2), mat.cel(0x2a303f, { id: id(), bevel: 0.03, hiAmt: 0.4, spec: 0.5, side: THREE.DoubleSide }), [0, 0.66, 0]);
  add(new THREE.TorusGeometry(0.6, 0.018, 8, 48, 2 * CA), M.bronze, [0, 0.66, 0], [Math.PI / 2, 0, Math.PI / 2 - CA]);
  add(arc(0.94, 1.02, 0.34, -CA, CA, 48), M.hullD, [0, 0.83, 0]);           // screen panel, tilted back
  add(new THREE.RingGeometry(0.98, 1.46, 48, 1, Math.PI / 2 - WIN.a, 2 * WIN.a).rotateX(-Math.PI / 2), mat.cel(0x2a303f, { id: id(), side: THREE.DoubleSide }), [0, WIN.y0 - 0.005, 0]);   // window sill
  screen(scr.main.tex, 0.46, 0.23, 0, 0.83); screen(scr.radar.tex, 0.21, 0.21, -0.48, 0.83); screen(scr.gauges.tex, 0.3, 0.15, 0.48, 0.83);
  screen(scr.stripL.tex, 0.24, 0.053, -0.85, 0.72, 0.95); screen(scr.stripR.tex, 0.24, 0.053, 0.85, 0.72, 0.95);
  const BN = 84, btn = new THREE.InstancedMesh(rb(0.032, 0.014, 0.032, 0.006), M.btn, BN), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const caps = [0xe8dfca, 0xc8694a, 0x56d8ff, 0xffc35a, 0x8a92a4, 0x6fe08a];
  for (let i = 0; i < BN; i++) { const row = i % 3, col = Math.floor(i / 3), a = -CA + 0.08 + (col / (BN / 3 - 1)) * (2 * CA - 0.16); if (Math.abs(a) < 0.3 && row < 2) { m4.makeScale(0, 0, 0); btn.setMatrixAt(i, m4); continue; }
    const r = 0.7 + row * 0.07; q.setFromAxisAngle(new V3(0, 1, 0), a); m4.compose(new V3(Math.sin(a) * r, 0.668, Math.cos(a) * r), q, new V3(1, 1, 1)); btn.setMatrixAt(i, m4);
    btn.setColorAt(i, new THREE.Color(caps[(i * 7 + row * 3) % caps.length])); }
  g.add(btn);
  const lampG = new THREE.SphereGeometry(0.018, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lamps = [];
  for (let i = 0; i < 14; i++) { const a = -CA + 0.1 + i * (2 * CA - 0.2) / 13; const l = add(lampG, mat.fx(0x6fe08a, { k: 1.6 })); l.position.set(Math.sin(a) * 1.0, 1.005, Math.cos(a) * 1.0); lamps.push(l); }
  // ---- side switch panels (left / right walls) ----------------------------------------------------------------------
  const tog = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.045, 6).translate(0, 0.022, 0), M.steel, 64), base = new THREE.InstancedMesh(rb(0.03, 0.02, 0.03, 0.005), M.dark, 64);
  let n = 0;
  for (const sx of [-1, 1]) { const a = sx * 92 * DEG, pnl = add(rb(0.5, 0.42, 0.06, 0.02), M.hull); onArc(pnl, 1.32, a, 1.15); pnl.rotateX(-0.25);
    const face = add(rb(0.44, 0.36, 0.02, 0.01), M.cream); onArc(face, 1.29, a, 1.15); face.rotateX(-0.25);
    for (let i = 0; i < 32; i++) { const u = (i % 8) / 7 - 0.5, v = Math.floor(i / 8) / 3 - 0.5, loc = new V3(u * 0.36, v * 0.26, 0.015);
      const o = new THREE.Object3D(); o.position.copy(face.position); o.quaternion.copy(face.quaternion); o.translateX(loc.x); o.translateY(loc.y); o.translateZ(0.015); o.rotateX(Math.PI / 2 + (i % 3 ? 0.4 : -0.4)); o.updateMatrix();
      tog.setMatrixAt(n, o.matrix); o.rotateX(-Math.PI / 2); o.updateMatrix(); base.setMatrixAt(n, o.matrix); n++; }
    const gauge = add(new THREE.CircleGeometry(0.06, 24), mat.fx(0xffffff, { k: 1.3, map: scr.gauges.tex })); onArc(gauge, 1.27, a - sx * 0.12, 1.47); screenMesh.push(gauge); }
  g.add(tog, base);
  // overhead panel above the window + the front red beacon
  add(arc(1.3, 1.25, 0.16, -0.9, 0.9, 32), M.hullD, [0, 2.08, 0]);
  const beaconF = kit.glowSource({ color: 0xff3a2a, intensity: 0, core: 0.035, halo: 0.35, glow: 1.4, spill: 2.5, range: 3.2 }); beaconF.position.set(0, 2.12, 0.95); g.add(beaconF);
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 16), M.dark, [0, 2.17, 0.95]);
  // ---- visor window: frame, mullions, glass + HUD, painted view outside ---------------------------------------------
  for (const y of [WIN.y0 + 0.03, WIN.y1 - 0.02]) add(arc(1.33, 1.33, 0.08, -WIN.a - 0.02, WIN.a + 0.02, 48), mat.cel(0xcc6a4a, { id: id(), bevel: 0.03, hiAmt: 0.55, spec: 0.4, side: THREE.DoubleSide }), [0, y, 0]);
  for (const a of [-WIN.a, -WIN.a / 2, WIN.a / 2, WIN.a]) { const mu = add(rb(0.08, WIN.y1 - WIN.y0 + 0.05, 0.1, 0.02), M.terra); onArc(mu, 1.33, a, (WIN.y0 + WIN.y1) / 2);
    for (const y of [WIN.y0 + 0.12, (WIN.y0 + WIN.y1) / 2, WIN.y1 - 0.12]) { const bolt = add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8).rotateX(Math.PI / 2), M.bronze); onArc(bolt, 1.275, a, y); } }
  const hudM = mat.fx(0xffffff, { k: 1.25, map: scr.hud.tex, additive: true, side: THREE.DoubleSide });
  const glass = add(flipU(arc(WIN.r, WIN.r, WIN.y1 - WIN.y0, -WIN.a, WIN.a, 48)), hudM, [0, (WIN.y0 + WIN.y1) / 2, 0]); glass.renderOrder = 10;
  const view = makeView(ctx); g.add(view.mesh);
  // ---- conduits + cables under the console, coolant ring on the floor ------------------------------------------------
  for (let i = 0; i < 5; i++) { const a0 = -1.0 + i * 0.5, pts = [new V3(Math.sin(a0) * 0.88, 0.5, Math.cos(a0) * 0.88), new V3(Math.sin(a0 + 0.15) * 0.75, 0.18 + 0.05 * (i % 2), Math.cos(a0 + 0.15) * 0.75), new V3(Math.sin(a0 + 0.3) * 0.88, 0.05, Math.cos(a0 + 0.3) * 0.88)];
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.014, 6), i % 2 ? M.rubber : M.terraD); }
  const coolant = add(new THREE.TorusGeometry(1.2, 0.035, 10, 64, Math.PI * 1.1), mat.fx(0x56d8ff, { k: 1.4 }), [0, 0.04, 0], [Math.PI / 2, 0, Math.PI * 0.95]);

  // ---- lights: screen spill (in front of the pilot, low), window light, side amber, beacons ---------------------------
  const P = (pos) => { const o = new THREE.Object3D(); o.position.fromArray(pos); g.add(o); return o; };
  const L = ctx.light;
  const ptScreen = L.addPoint({ pos: P([0, 0.8, 0.62]), color: 0x56d8ff, intensity: 0, range: 1.3 });
  const ptWin = L.addPoint({ pos: P([0, 1.6, 1.5]), color: 0xffffff, intensity: 0, range: 3.0 });
  const ptSide = L.addPoint({ pos: P([-0.9, 1.0, 0.3]), color: 0xffc35a, intensity: 0, range: 1.4 });
  const ptRear = L.addPoint({ pos: P([0, 1.5, -1.1]), color: 0x56d8ff, intensity: 0, range: 2.0 });

  // ---- solids --------------------------------------------------------------------------------------------------------
  ctx.solids.add('cockpit-seatback', back, { kind: 'points', group: 'cockpit-seat', groups: ['cockpit'], points: 400 });
  cups.forEach((c, i) => ctx.solids.add('lever-' + 'LR'[i], c, { kind: 'points', groups: ['cockpit'], points: 300 }));
  ctx.solids.allow('clawd', 'cockpit-seat', 0.03);
  ctx.label('COCKPIT', g);

  // ---- state + per-frame ----------------------------------------------------------------------------------------------
  const MODE = { s12: 'under', s18: 'sky', s26: 'strato' };
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const api = {
    seat: [0, SEAT_TOP - 0.075, 0.0], seatTop: SEAT_TOP, levers, cups, group: g, view, screens: scr,
    socket(i) { const c = cups[i]; c.updateMatrixWorld(true); return c.getWorldPosition(new V3()); },
    alignSocket(i, dirW, f) { align[i] = { d: dirW.clone().normalize(), f }; api._applyAlign(i, f); },
    _applyAlign(i, f) { const c = cups[i], a = align[i]; const sx = i ? 1 : -1;
      let d = a && a.f === f ? a.d.clone() : new V3(sx, 0, 0);
      c.parent.updateMatrixWorld(true); c.parent.getWorldQuaternion(_q); d.applyQuaternion(_q.clone().invert());   // -> lever local
      c.quaternion.setFromUnitVectors(new V3(1, 0, 0), d); c.updateMatrixWorld(true); },
    state(t, shot) {
      const id = shot.id, ct = ctx.onTwos(t);
      const on = id === 's12' ? sstep(25.3, 26.0, t) : 1, alarm = id === 's26' ? 1 : 0;
      const push = id === 's18' ? -0.25 * bump(ct, cues.levers - 0.1, 0.12, 0.02, 0.05) + sstep(cues.levers - 0.05, cues.levers + 0.06, ct)
        : id === 's26' ? 1 + 0.06 * Math.sin(ct * 43) + 0.04 * Math.sin(ct * 71) : 0;
      const grip = id === 's12' ? sstep(26.12, 26.48, ct) : 1;
      return { on, alarm, mode: MODE[id] || 'sky', push, shake: id === 's26' ? 1 : 0, grip };
    },
    // pose the levers for film time t (pure; the pilot calls this before it reaches for the sockets)
    poseLevers(t, shot) { const s = api.state(t, shot), ct = ctx.onTwos(t);
      levers.forEach((l, i) => { l.rotation.set(lerp(LEV.rest, LEV.push, s.push) * DEG + s.shake * 3.2 * DEG * Math.sin(ct * 53 + i * 2), 0, (i ? -1 : 1) * 2.2 * DEG * s.shake * (0.55 + 0.45 * Math.sin(ct * 59 + i))); l.updateMatrixWorld(true);   // rattles, biased outward (clear of his body)
        api._applyAlign(i, shot.f); }); },
    update(t, shot) {
      if (!shot.groups.includes('cockpit')) return;
      const s = api.state(t, shot); api.poseLevers(t, shot);
      view.set({ mode: s.mode, t, shake: s.shake, glow: 1 + 0.15 * Math.sin(t * 9) * s.alarm });
      // console lamps: boot cascade from the centre out, then green / amber; alarm = red chase
      lamps.forEach((l, i) => { const u = Math.abs(i / (lamps.length - 1) - 0.5) * 2, lit = s.on * 1.25 - u > 0 ? 1 : 0.06; let col = i % 4 === 3 ? 0xffc35a : 0x6fe08a, k = 1.6 * lit;
        if (s.alarm) { col = 0xff3a2a; k = 0.5 + 2.4 * Math.max(0, Math.sin(t * 12 - i * 0.9)); }
        l.material.uniforms.uCol.value.set(col); l.material.uniforms.uK.value = k; });
      screenMesh.forEach((m, i) => { const st = clamp((s.on * 1.3 - (i % 5) * 0.06) * 3, 0, 1), flick = st > 0 && st < 1 ? (Math.floor(t * 24) % 2 ? 0.4 : 1) : 1;
        m.material.uniforms.uK.value = 1.5 * (0.08 + 0.92 * st) * flick; });
      band.material.uniforms.uK.value = 1.7;
      coolant.material.uniforms.uK.value = (0.1 + 0.8 * s.on) * (s.alarm ? 1.4 : 1); coolant.material.uniforms.uCol.value.set(s.alarm ? 0xff5a3a : 0x56d8ff);
      leds.forEach(l => { l.material.uniforms.uK.value = s.alarm ? 0.6 + 1.8 * Math.max(0, Math.sin(t * 12)) : 0.15 + 2.2 * s.grip * s.on; l.material.uniforms.uCol.value.set(s.alarm ? 0xff4a3a : 0x56e8ff); });
      // vibration lines around the rattling grips (on twos: the strokes jump between two drawings)
      const ph = Math.floor(ctx.onTwos(t) * 12) % 2;
      vib.forEach((v, i) => { v.visible = s.shake > 0; v.scale.setScalar(ph ^ i ? 1.0 : 1.14); v.userData.spin = (ph ? 0.12 : -0.1) * (i ? 1 : -1); });
      for (const b of beacons) { const k = s.alarm ? Math.pow(Math.max(0, Math.sin(t * 8 + b.ph)), 2) : 0; b.gsrc.set(k * 1.4); b.dome.material.uniforms.uK.value = 0.35 + 3.2 * k; }
      beaconF.set(s.alarm ? 0.25 + 1.1 * Math.max(0, Math.sin(t * 8)) : 0);
      ptScreen.intensity = (s.alarm ? 0.5 : 1.25) * s.on; ptScreen.color.set(s.alarm ? 0xff5040 : 0x56d8ff);
      ptRear.intensity = s.alarm ? 0 : 0.8 * s.on;
      ptSide.intensity = 0.6 * s.on * (s.alarm ? 0 : 1);
      ptWin.intensity = s.mode === 'under' ? 1.1 : s.mode === 'sky' ? 1.0 : 1.6; ptWin.color.set(s.mode === 'under' ? 0x6ff0e8 : s.mode === 'sky' ? 0xfff0dc : 0xff8a4a);
      api._s = s;
    },
    afterCamera(t, shot) {
      if (!shot.groups.includes('cockpit')) return;
      const s = api._s; beaconF.update(ctx.camera, 0.05); for (const b of beacons) b.gsrc.update(ctx.camera, 0.05);
      // vibration strokes face the camera; the HUD glass hides when the camera looks in from outside the visor
      for (const v of vib) if (v.visible) { v.parent.getWorldQuaternion(_q); v.quaternion.copy(_q.invert().multiply(ctx.camera.quaternion)); v.rotateZ(v.userData.spin || 0); }
      const cp = ctx.camera.position; glass.visible = Math.hypot(cp.x, cp.z) < WIN.r - 0.01;
      // HUD target: where the camera sees the painted meteor, intersected with the glass cylinder -> [u, v]
      let target = null;
      if (s.mode !== 'under') { const [az, el] = METEOR[s.mode], d = new V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), far = d.multiplyScalar(6);
        const o = ctx.camera.position, dir = far.clone().sub(o).normalize();
        const A = dir.x * dir.x + dir.z * dir.z, B = 2 * (o.x * dir.x + o.z * dir.z), C = o.x * o.x + o.z * o.z - WIN.r * WIN.r, disc = B * B - 4 * A * C;
        if (disc > 0) { const k = (-B + Math.sqrt(disc)) / (2 * A), p = o.clone().addScaledVector(dir, k), a = Math.atan2(p.x, p.z); target = [1 - (a + WIN.a) / (2 * WIN.a), (p.y - WIN.y0) / (WIN.y1 - WIN.y0)]; } }
      scr.draw(t, { on: s.on, alarm: s.alarm, mode: s.mode, load: s.alarm ? 1.0 : 0.35 + 0.3 * s.push, thrust: s.mode === 'sky' ? 0.3 + 0.6 * clamp(s.push, 0, 1) : s.alarm ? 1 : 0.15, target });
    },
    dispose() { g.removeFromParent(); },
  };
  return api;
}
