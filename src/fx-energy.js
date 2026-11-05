// =====================================================================================================================
// MEGA CLAWD · FX ENERGY (owner: meteor) — drawn energy effects for the whole film: impact flash + shockwave rings,
// strain sparks, blue lightning with a white core, the mecha's blue sole-thruster flames + trails, the reactor charge
// glow, the launch shockwave ring on the sea, the panel-line surge glow. All drawn like anime FX cels (opaque flat
// layers, hard edges, white-hot cores; src/fx-energy-draw.js) in the overlay layer; energy on ones/twos, lightning on threes.
//
// API  ctx.modules['fx-energy']  (also published as ctx.modules.fxEnergy)
//   Immediate mode: call these every frame you want the effect, from your update() (any module) or afterCamera()
//   (modules before fx-energy). Requests with the same `key` replace each other within a frame; nothing persists.
//   impact(pos, t0 = CUES.impact, { key, normal, size = 1500, k = 1 }) -> flash level      hard white glare (small core,
//                     long rays), radial impact lines, a fast spherical shock ring and a wide ring on the plane `normal`
//                     ("through the clouds below"). The glare ramps in over the 3 frames BEFORE t0 (call it from the shot
//                     before the cut too) so the brightness climbs into the impact instead of jumping.
//   flash(t, t0 = CUES.impact, { peak = 0.6, pre = 3, up = 2, hold = 2, down = 9 }) -> 0..1   PURE: use in LOOKS as
//                     grade.flash on both sides of the cut (s23 + s24) so the ramp is continuous (<= 25 tv / frame)
//   sparks(pos, normal, t, { key, k = 1, spread = 40 (deg), scale = 1 (m), seed })   strain sparks: a burst of 20-40
//                     streaks every 2 frames (white-yellow head, orange tail, 1-3 frame life) + a contact glare
//   lightning(a, b, t, { key, k = 1, width = 1.9 (px), branches = 3, seed, jag = 0.12 })   bolt between two points (on
//                     threes): saturated blue body, white core, soft blue glow, tapered
//   thruster({ key, anchor | pos, dir, size = 6, len = 7, k = 1, t, trail: { dir, length } | trailPath: (tau) => V3 })
//                     blue jet flame with shock diamonds from a nozzle (anchor: Object3D, its world position); dir = exhaust
//                     direction (unit); size = nozzle radius (m); trailPath(tau) = nozzle position tau seconds ago (pure)
//   reactor({ key, anchor | pos, k = 1, size = 8, t, pulse = true })   reactor charge glow: core, halo band, rays, rings
//   shockRing({ key, pos, normal, t0, t, speed, max, width, color, vapour })   generic expanding ring
//   seaRing(pos, t0 = CUES.launch, { key, max = 650 })   launch shockwave on the sea (s20: automatic at the mecha root)
//   ringRadius(t, t0 = CUES.launch, { max = 650, dur = 1.3 }) -> m   PURE radius of the sea ring (water: spray sync)
//   surge             panel-line surge: surge.patch(material, { mask: GLSL float expression of your panel-line mask,
//                     e.g. 'mSeam' }) once (any engine cel/bg material), then per frame surge.set({ origin: V3, t0, t,
//                     speed = 160 m/s, width = 12, k = 1, color = 0x4fd0ff }) or surge.off(). Saturated cyan-blue light
//                     ONLY on the mask: a white-hot travelling front and a fading tail behind it; the plates stay unlit.
//   draw              the primitives (strokes, flame, sheath, ring, glare, impactFrame) for departments that want their own
// Automatic: s20 sea ring at the mecha root (key 'launch'; the water team syncs its spray to ringRadius()).
// Note: the mecha draws its own sole thrusters (src/mecha-fx.js); thruster() is here for anyone who wants the drawn jet.
// =====================================================================================================================
import * as THREE from 'three';
import * as DRAW from './fx-energy-draw.js';
import { strokes, glarePool, ringPool, flamePool, PAL, col, flashEnv } from './fx-energy-draw.js';

const V3 = THREE.Vector3;
const hh = (k, i) => { const s = Math.sin(k * 12.9898 + i * 78.233 + 0.5) * 43758.5453; return s - Math.floor(s); };

export async function create(ctx) {
  const { cues, util } = ctx, { clamp, sstep, easeOut } = util;
  const lines = strokes(ctx, { max: 30000, order: 7, soft: 6, name: 'fx-lines' });
  const glares = glarePool(ctx, 20, { order: 9, soft: 4 });
  const jets = flamePool(ctx, 6, { mode: 'jet', palette: PAL.jet, order: 4, soft: 4, seed: 11, name: 'fx-jet' });
  const rings = ringPool(ctx, 8, { order: 2, soft: 30 });
  const req = new Map();
  let reqF = -1;
  const put = (type, key, o) => { const f = ctx.state?.f ?? -1; if (f !== reqF) { req.clear(); reqF = f; } req.set(type + ':' + key, { type, ...o }); };
  const wp = (o) => o.anchor ? o.anchor.getWorldPosition(new V3()) : o.pos?.isVector3 ? o.pos.clone() : new V3().fromArray(o.pos || [0, 0, 0]);
  const v3 = (x, d) => x == null ? d.clone() : x.isVector3 ? x.clone() : new V3().fromArray(x);

  // panel-line surge (shared uniforms; patched into any toon material)
  const SU = { uSurgeO: { value: new V3() }, uSurgeR: { value: -1 }, uSurgeW: { value: 12 }, uSurgeK: { value: 0 }, uSurgeCol: { value: col(0x4fd0ff, 2.2) } };
  const surge = {
    uniforms: SU,
    patch(m, { mask = '1.0' } = {}) {
      const mk = typeof mask === 'number' ? mask.toFixed(4) : mask;
      m.uniforms = m.uniforms || {}; Object.assign(m.uniforms, SU);
      ctx.glsl.patchShader(m, 'fxSurge:' + mk, (sh) => {
        sh.uniforms && Object.assign(sh.uniforms, SU);
        sh.fragmentShader = sh.fragmentShader.replace('void main(){', 'uniform vec3 uSurgeO, uSurgeCol; uniform float uSurgeR, uSurgeW, uSurgeK;\nvoid main(){')
          .replace('float fd = length(vW - cameraPosition);', /* glsl */`if (uSurgeK > 0.0) { float sd = length(vW - uSurgeO), aw = max(fwidth(sd), 1e-3), behind = uSurgeR - sd;
              float head = 1.0 - smoothstep(uSurgeW * 0.5 - aw, uSurgeW * 0.5 + aw, abs(behind));
              float tail = behind > 0.0 ? exp(-behind / (uSurgeW * 7.0)) : 0.0;
              float mk = clamp(${mk}, 0.0, 1.0);
              col = mix(col, uSurgeCol * (0.55 + 0.6 * tail) + vec3(2.6) * head, clamp((tail + head) * mk * uSurgeK, 0.0, 1.0)); }
            float fd = length(vW - cameraPosition);`);
      });
      return m;
    },
    set({ origin, t0 = cues.surge, t = ctx.state?.t ?? 0, speed = 160, width = 12, k = 1, color = null } = {}) {
      if (origin) SU.uSurgeO.value.copy(v3(origin, new V3())); SU.uSurgeR.value = Math.max(-1, (t - t0) * speed); SU.uSurgeW.value = width; SU.uSurgeK.value = t >= t0 ? k : 0;
      if (color != null) SU.uSurgeCol.value.copy(col(color, 2.2)); },
    off() { SU.uSurgeK.value = 0; },
  };

  const ringRadius = (t, t0 = cues.launch, { max = 470, dur = 1.3 } = {}) => t < t0 ? 0 : max * easeOut(clamp((t - t0) / dur)) ** 0.8;
  const flash = (t, t0 = cues.impact, o = {}) => flashEnv(t, t0, { peak: 0.6, pre: 3, up: 2, hold: 2, down: 9, ...o });

  const api = {
    draw: DRAW, surge, ringRadius, flash,
    impact(pos, t0 = cues.impact, o = {}) { put('impact', o.key || 'impact' + t0, { pos: v3(pos, new V3()), t0, ...o }); return flash(ctx.state?.t ?? t0, t0); },
    sparks(pos, normal, t, o = {}) { put('sparks', o.key || 'sparks', { pos: v3(pos, new V3()), normal: v3(normal, new V3(0, 1, 0)).normalize(), t, ...o }); },
    lightning(a, b, t, o = {}) { put('bolt', o.key || 'bolt' + (o.seed ?? 0), { a: v3(a, new V3()), b: v3(b, new V3()), t, ...o }); },
    thruster(o = {}) { put('jet', o.key || 'jet', { ...o }); },
    reactor(o = {}) { put('reactor', o.key || 'reactor', { ...o }); },
    shockRing(o = {}) { put('ring', o.key || 'ring', { ...o }); },
    seaRing(pos, t0 = cues.launch, o = {}) { put('ring', o.key || 'launch', { pos: v3(pos, new V3()), normal: [0, 1, 0], t0, sea: true, ...o }); },

    update(t, shot) {
      const M = ctx.modules.mecha, has = (pre) => reqF === shot.f && [...req.keys()].some(k => k.startsWith(pre));
      if (shot.id === 's20' && M?.root && !has('ring:launch')) { const p = M.root.getWorldPosition(new V3()); api.seaRing([p.x, 1.0, p.z], cues.launch, { key: 'launch' }); }
    },

    afterCamera(t, shot) {
      const cam = ctx.camera, f = shot.f; if (reqF !== f) { req.clear(); reqF = f; }
      lines.begin(cam); glares.begin(); jets.begin(); rings.begin();
      for (const r of req.values()) {
        if (r.type === 'impact') drawImpact(r, t);
        else if (r.type === 'sparks') drawSparks(r, t);
        else if (r.type === 'bolt') drawBolt(r, t);
        else if (r.type === 'jet') { const J = jets.next(); if (J) drawJet(r, t, J); }
        else if (r.type === 'reactor') drawReactor(r, t);
        else if (r.type === 'ring') drawRing(r, t);
      }
      lines.end(); glares.end(); jets.end(); rings.end(); req.clear(); reqF = -1;
    },
    dispose() {},
  };
  ctx.modules.fxEnergy = api;

  // ---- impact: hard glare (ramps in 3 frames before t0) + impact lines (first frames) + spherical shock + plane ring ----
  function drawImpact(r, t) {
    const size = r.size ?? 1500, k = r.k ?? 1, cam = ctx.camera, pos = r.pos, fl = flash(t, r.t0, { peak: 1 }), tau = t - r.t0;
    // the glare never covers more than ~half the frame height (silhouettes stay readable through the flash)
    const capPx = 520, sz = size * (0.55 + 0.6 * easeOut(clamp((tau + 0.125) / 0.4))), szPx = lines.pxAt(pos, sz);
    if (fl > 0.001) glares.next()?.set({ pos, sizePx: Math.min(szPx, capPx), color: 0xfff0d0, core: 0.06, halo: 0.1, rays: 14, rayLen: 1, rayW: 0.02,
      k: k * fl * 1.3, t: ctx.onTwos(t), seed: 7, glow: 0.12, coreK: 5, rot: 0.05 }, cam);
    if (tau < 0) return;
    // anime impact lines: radial white streaks in the camera plane, 0..0.35 s, redrawn on twos
    if (tau < 0.38) { const R = cam.matrixWorld, rx = new V3().setFromMatrixColumn(R, 0), uy = new V3().setFromMatrixColumn(R, 1), dr = Math.round(t * 24 / 2);
      const L = size * (0.9 + 2.4 * easeOut(tau / 0.38)), fade = 1 - sstep(0.2, 0.38, tau);
      for (let i = 0; i < 46; i++) { const a = (i + hh(i, dr) * 0.8) / 46 * Math.PI * 2, d = rx.clone().multiplyScalar(Math.cos(a)).addScaledVector(uy, Math.sin(a));
        const r0 = size * (0.35 + 0.45 * hh(i, dr + 3)), r1 = r0 + L * (0.4 + 0.6 * hh(i, dr + 5));
        lines.line([pos.clone().addScaledVector(d, r0), pos.clone().addScaledVector(d, r1)], { w: size * 0.01 * (0.5 + hh(i, dr + 7)), px: 1.2, col: 0xfff4e0, k: 1.6 * fade * k, core: 0.5, coreK: 3 * fade * k, a: fade, taper: [1, 0.05] }); } }
    const sph = rings.next(), pl = rings.next(); if (!sph || !pl) return;
    const rs = size * (0.6 + 3.2 * easeOut(clamp(tau / 0.6))), fs = 1 - sstep(0.35, 0.9, tau);
    sph.set({ pos, normal: cam.position.clone().sub(pos).normalize(), r: rs, w: rs * 0.1, line: rs * 0.012, k: 1.5 * fs * k, op: fs, t: ctx.onTwos(t), seed: 9, wob: 0.02, color: 0xe8f6ff, vapour: 0xffffff, vapourShade: 0xc4c8f0, vapOp: 0.85 * fs, wash: 0, soft: 30 });
    const rp = size * (1.0 + 9 * easeOut(clamp(tau / 1.5))), fp = 1 - sstep(0.9, 1.5, tau);
    pl.set({ pos, normal: r.normal || [0, 1, 0], r: rp, w: rp * 0.09, line: rp * 0.008, k: 1.3 * fp * k, op: fp, t: ctx.onTwos(t), seed: 4, wob: 0.03, color: 0xffeccc, vapour: 0xffffff, vapourShade: 0xb8bce8, vapOp: 0.9 * fp, wash: 0, soft: 60 });
  }
  // ---- strain sparks: a cluster of 20-40 drawn streaks bursts every 2 frames, each lives 1-3 frames (white-yellow head,
  // orange tail, tapered), plus a flickering contact glare ----
  function drawSparks(r, t) {
    const k = r.k ?? 1, sc = r.scale ?? 1, spread = THREE.MathUtils.degToRad(r.spread ?? 40), seed = r.seed ?? 3, n = r.normal;
    const ta = new V3().crossVectors(n, Math.abs(n.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize(), tb = new V3().crossVectors(n, ta);
    const e1 = Math.floor(t * 12 + 1e-6);
    for (let e = e1 - 1; e <= e1; e++) { const te = e / 12, cnt = Math.round((20 + 20 * hh(e, seed)) * Math.min(1.5, k));
      for (let i = 0; i < cnt; i++) { const j = e * 53 + i + seed * 1000, life = (1 + Math.floor(3 * hh(j, 2))) / 24, age = t - te + 0.5 / 24; if (age < 0 || age > life + 1e-4) continue;
        const a = hh(j, 3) * Math.PI * 2, c = Math.cos(spread * Math.sqrt(hh(j, 4))), s = Math.sqrt(1 - c * c);
        const dir = n.clone().multiplyScalar(c).addScaledVector(ta, Math.cos(a) * s).addScaledVector(tb, Math.sin(a) * s);
        const L = (6 + 15 * hh(j, 5)) * sc, u = age / life, r0 = (1.5 + 4 * hh(j, 6)) * sc;
        const head = r.pos.clone().addScaledVector(dir, r0 + L * (0.5 + 0.9 * u)).add(new V3(0, -3 * sc * u * u, 0)), tail = head.clone().addScaledVector(dir, -L * (0.55 + 0.45 * (1 - u)));
        const env = 1 - 0.5 * u, big = hh(j, 7) < 0.25;
        lines.line([tail, tail.clone().lerp(head, 0.6), head], { w: (big ? 0.55 : 0.32) * sc, px: big ? 2.0 : 1.4, col: 0xff6a14, col2: 0xfff2b0, k: 2.0 * env, core: 0.45, coreK: 3.6 * env, a: 1, taper: [0.08, 1] });
      } }
    glares.next()?.set({ pos: r.pos, size: 22 * sc, color: 0xffc86a, core: 0.12, halo: 0.26, rays: 8, rayLen: 1, rayW: 0.045, k: 1.0 * k * (0.75 + 0.25 * Math.sin(ctx.onTwos(t) * 17)), t: ctx.onTwos(t), seed: 2, glow: 0.5, coreK: 4 });
  }
  // ---- lightning: midpoint displacement, redrawn on threes; blue body, white core, soft blue glow ----
  function drawBolt(r, t) {
    const draw = Math.floor(t * 8), R = ctx.rng(5000 + draw * 13 + (r.seed ?? 0) * 101), L = r.a.distanceTo(r.b), jag = r.jag ?? 0.12, k = r.k ?? 1, w = r.width ?? 1.9;
    const zig = (a, b, lv) => { let pts = [a, b]; for (let l = 0; l < lv; l++) { const np = [pts[0]]; for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], d = p.distanceTo(q), m = p.clone().lerp(q, 0.4 + 0.2 * R());
      m.add(new V3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(d * jag * 3)); np.push(m, q); } pts = np; } return pts; };
    const tp = (u) => 0.35 + 0.65 * Math.sin(u * Math.PI);
    const main = zig(r.a, r.b, 5);
    lines.line(main, { w: 0, px: w * 2.2, col: 0x1f6cff, k: 0.9 * k, a: 0.6, soft: 1, core: 0, taper: tp });
    lines.line(main, { w: 0, px: w, col: 0x3fa8ff, k: 2.2 * k, core: 0.42, coreK: 4.0 * k, taper: tp });
    for (let b = 0; b < (r.branches ?? 3); b++) { const i0 = 2 + Math.floor(R() * (main.length - 4)), s = main[i0], e = s.clone().add(r.b.clone().sub(r.a).normalize().multiplyScalar(L * 0.2).add(new V3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(L * 0.3)));
      lines.line(zig(s, e, 3), { w: 0, px: w * 0.65, col: 0x3fa8ff, k: 1.8 * k, core: 0.35, coreK: 3.2 * k, taper: [1, 0.15] }); }
  }
  // ---- thruster: jet flame + nozzle glare + trail ----
  function drawJet(r, t, J) {
    const pos = wp(r), dir = v3(r.dir, new V3(0, -1, 0)).normalize(), size = r.size ?? 6, k = r.k ?? 1, tt = ctx.onTwos(t);
    J.set({ pos, axis: dir, R: size, front: 0.55, rc: 0.9, wmax: 1.25, len: (r.len ?? 7) * (0.75 + 0.25 * k), taper: 1.3, t: tt, scroll: 9, ns: 0.6, wob: 0.22, tongue: 0.5, coreLen: 2.8 * k + 0.4, k: Math.min(1, k),
      op: k > 0.01 ? 1 : 0, diam: 0.75, gain: 1, coreGain: 1.4, edgeMin: 0.05, soft: 2 });
    glares.next()?.set({ pos: pos.clone().addScaledVector(dir, size * 0.4), size: size * 2.6, color: 0x7ad8ff, core: 0.18, halo: 0.36, rays: 6, rayLen: 1, rayW: 0.05, k: 1.1 * k, t: tt, seed: 5, glow: 1.0, coreK: 4.5, soft: 2 });
    const tr = r.trail, tp = r.trailPath;
    if (tp) { const pts = []; for (let i = 0; i <= 14; i++) { const p = tp(i / 14 * (r.trailTime ?? 1.2)); if (p) pts.push(p.isVector3 ? p : new V3().fromArray(p)); }
      if (pts.length > 1) lines.line(pts, { w: size * 0.9, px: 1.5, col: 0x4ab8ff, col2: 0x2a5ad8, k: 1.5 * k, core: 0.3, coreK: 2.5 * k, a: 0.95, a2: 0, soft: 0.35, taper: (u) => (1 - u) * 0.7 + u * 2.2 }); }
    else if (tr) { const L = tr.length ?? 600, d = v3(tr.dir, dir).normalize(), p0 = pos.clone().addScaledVector(dir, size * (r.len ?? 7) * 0.6), pts = [];
      for (let i = 0; i <= 10; i++) pts.push(p0.clone().addScaledVector(d, L * i / 10));
      lines.line(pts, { w: size * 0.8, px: 1.5, col: 0x4ab8ff, col2: 0x2a5ad8, k: 1.5 * k, core: 0.3, coreK: 2.4 * k, a: 0.9, a2: 0, soft: 0.35, taper: (u) => 1 + u * 1.8 }); }
  }
  // ---- reactor charge glow ----
  function drawReactor(r, t) {
    const pos = wp(r), k = r.k ?? 1, size = r.size ?? 8, tt = ctx.onTwos(t);
    glares.next()?.set({ pos, size: size * (1 + 0.08 * Math.sin(tt * 14)), color: 0x5ec8ff, core: 0.16, halo: 0.34, rays: 8, rayLen: 1, rayW: 0.04, k: 1.2 * k, t: tt, seed: 9, glow: 1.1, coreK: 5, rot: tt * 0.15, soft: 2 });
    if (r.pulse !== false && k > 0.05) for (let i = 0; i < 2; i++) { const ph = ((tt * 1.6 + i * 0.5) % 1), R = rings.next(); if (!R) break;
      const rr = size * (0.5 + 2.2 * ph); R.set({ pos, normal: ctx.camera.position.clone().sub(pos).normalize(), r: rr, w: 0, line: Math.max(0.2, rr * 0.03), k: 1.1 * k * (1 - ph), op: 1, t: tt, seed: 6 + i, wob: 0.02,
        color: 0x6ad0ff, vapOp: 0, wash: 0, soft: 2 }); }
  }
  // ---- expanding ring (sea launch ring / generic) ----
  function drawRing(r, t) {
    const t0 = r.t0 ?? t, tau = t - t0; if (tau < 0) return;
    const max = r.max ?? 470, dur = r.dur ?? 1.3, rr = ringRadius(t, t0, { max, dur }); if (rr <= 0) return;
    const R = rings.next(); if (!R) return; const fade = 1 - sstep(dur * 0.55, dur * 1.25, tau);
    R.set({ pos: wp(r), normal: r.normal || [0, 1, 0], r: rr, w: rr * (r.sea ? 0.16 : 0.12), line: Math.max(0.6, rr * 0.012), k: (r.k ?? 1) * 1.3 * fade, op: fade, t: ctx.onThrees(t), seed: 3, wob: 0.03,
      color: r.color ?? 0xd8f4ff, vapour: r.vapour ?? 0xffffff, vapourShade: r.vapourShade ?? 0xa8c8e8, vapOp: (r.sea ? 0.92 : 0.8) * (1 - sstep(0.3, dur * 1.1, tau)), wash: r.sea ? 0.18 : 0.06, soft: r.sea ? 1.5 : 30 });
  }
  return api;
}
