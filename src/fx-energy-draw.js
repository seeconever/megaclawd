// =====================================================================================================================
// MEGA CLAWD · drawn energy FX primitives (owner: meteor). Shared by src/meteor.js and src/fx-energy.js.
// Everything here lives in ctx.overlay: drawn after paint + ink, soft depth test against the main pass, HDR colour
// (values > 1 bloom). Shapes are drawn like anime FX cels: OPAQUE flat colour layers with hard antialiased edges around a
// white-hot core (only the core glows), never alpha mush. Pure: geometry and uniforms are rebuilt every frame.
//
//   strokes(ctx, { max, order, soft })  batch of camera-facing ribbons along world polylines (lightning, sparks, streaks)
//                                       and round dots (streak heads). line(points, style) / dot(pos, style) inside
//                                       begin(camera) .. end()
//   flame(ctx, { mode, palette })       axis billboard (a plane through the axis turned to the camera; it fades out when
//                                       seen along the axis): 'fire' = bow + burning tail in opaque layers with backward
//                                       flame tongues, 'jet' = thruster flame with shock diamonds, 'smoke' = opaque
//                                       2-tone puffy smoke with an ink outline, 'shell' = drawn bow-shock cone (vapour)
//   sheath(ctx, geometry)               plasma sheath hugging the body silhouette: thick white-hot bow shock on the
//                                       leading face, thin bands along the flanks streaming into the trail
//   ring(ctx)                           shockwave on a plane: bright edge line + puffy vapour band + inner wash
//   glare(ctx)                          camera-facing flash: hard core, halo band, tapered rays, soft bloom halo
//   impactFrame(ctx)                    full-screen anime impact frame: flat white (or deep blue) with the characters as
//                                       hard silhouettes and radial speed lines from a screen point
//   flashEnv(t, t0, { peak, pre, up, hold, down })   frame-exact flash envelope (ramps, never a jump > 25 tv)
//   PAL, col(x, k), lerpPal(a, b, k)    palettes (outer -> core) and HDR colour helpers
// =====================================================================================================================
import * as THREE from 'three';
import { NOISE, OVERLAY, U } from './pipeline-glsl.js';

const V3 = THREE.Vector3;
export const col = (x, k = 1) => (Array.isArray(x) ? new THREE.Color(x[0], x[1], x[2]) : x?.isColor ? x.clone() : new THREE.Color(x)).multiplyScalar(k);

// palettes: outer -> inner layer (linear HDR after col())
export const PAL = {
  fire:   [0xd02a14, 0xff6a12, 0xffc030, 0xfff6e0],
  blaze:  [0xc81e10, 0xf24a12, 0xffa22a, 0xfff0d0],
  jet:    [0x1438d8, 0x1e9cff, 0x8ee8ff, 0xf4ffff],
  ember:  [0x8a1c10, 0xd8481a, 0xff9a30, 0xffe6b0],
  smoke:  [0x8c86b4, 0xf4ecdc, 0xffffff, 0xff9a5a],   // shade lavender, lit cream, (unused), warm underglow
  vapour: [0xa8b0e6, 0xffffff, 0xffffff, 0xffd8b0],
};

// premultiplied "over" blending; a fragment with alpha output 0 is purely additive
function premult(m) {
  m.transparent = true; m.depthTest = false; m.depthWrite = false; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  return m;
}
const ovU = () => ({ tSceneData: U.tSceneData, uRes: U.uRes });

// ---------------------------------------------------------------------------------------------------------------------
// STROKES: camera-facing ribbons + round dots. Per vertex: colour (rgb HDR, a alpha), par = (core width 0..1, core
// brightness, softness 0 = flat cel band .. 1 = soft falloff (+2 = round dot), over 0 = additive .. 1 = opaque over).
// ---------------------------------------------------------------------------------------------------------------------
export function strokes(ctx, { max = 8192, order = 6, soft = 12, name = 'fx-strokes' } = {}) {
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(max * 3), UV = new Float32Array(max * 2), CO = new Float32Array(max * 4), PA = new Float32Array(max * 4), IX = new Uint32Array(max * 3);
  const attr = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr(P, 3)); g.setAttribute('aUv', attr(UV, 2)); g.setAttribute('aCol', attr(CO, 4)); g.setAttribute('aPar', attr(PA, 4));
  g.setIndex(attr(IX, 1));
  const mat = premult(new THREE.ShaderMaterial({ uniforms: { ...ovU(), uSoft: { value: soft } },
    vertexShader: /* glsl */`attribute vec2 aUv; attribute vec4 aCol, aPar; varying vec2 vUv; varying vec4 vCol, vPar; varying float vZ;
      void main(){ vUv = aUv; vCol = aCol; vPar = aPar; vec4 mv = viewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`${OVERLAY} uniform float uSoft; varying vec2 vUv; varying vec4 vCol, vPar; varying float vZ;
      void main(){
        bool dotM = vPar.z > 1.5; float sf = dotM ? vPar.z - 2.0 : vPar.z;
        float av = dotM ? length(vUv) : abs(vUv.y), aa = clamp(fwidth(av) * 1.3, 0.02, 0.6);
        float band = 1.0 - smoothstep(1.0 - aa * 1.6, 1.0, av);
        float outer = mix(band, pow(max(1.0 - av, 0.0), 1.7), sf);
        float core = vPar.x > 0.0 ? 1.0 - smoothstep(vPar.x - aa, vPar.x + aa, av) : 0.0;
        vec3 c = mix(vCol.rgb, vec3(vPar.y), core);
        float a = max(outer, core) * vCol.a * softDepth(vZ, uSoft);
        if (a < 0.002) discard;
        gl_FragColor = vec4(c * a, a * vPar.w); }` }));
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; mesh.visible = false; ctx.overlay.add(mesh);
  let nv = 0, ni = 0, camPos = new V3(), pxK = 0;
  const _a = new V3(), _b = new V3(), _t = new V3(), _s = new V3(), _v = new V3(), _r = new V3(), _u = new V3(), _f = new V3(), C0 = new THREE.Color(), C1 = new THREE.Color();
  const vec = (p, o) => (p.isVector3 ? o.copy(p) : o.set(p[0], p[1], p[2]));
  const put = (x, y, z, u, v, c, a, s) => { const j = nv++; P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = z; UV[j * 2] = u; UV[j * 2 + 1] = v;
    CO[j * 4] = c.r; CO[j * 4 + 1] = c.g; CO[j * 4 + 2] = c.b; CO[j * 4 + 3] = a; PA[j * 4] = s[0]; PA[j * 4 + 1] = s[1]; PA[j * 4 + 2] = s[2]; PA[j * 4 + 3] = s[3]; return j; };
  const _c = new THREE.Color();
  const api = {
    mesh, get count() { return nv; },
    begin(camera) { nv = 0; ni = 0; camPos.setFromMatrixPosition(camera.matrixWorld); _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize(); _u.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      _f.setFromMatrixColumn(camera.matrixWorld, 2).normalize().negate(); pxK = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / 1080; return api; },
    // px size (1080p) of a world length at a point
    pxAt(p, len) { vec(p, _a); const depth = Math.max(0.01, _a.sub(camPos).dot(_f)); return len / (pxK * depth); },
    // pts: [[x,y,z] | Vector3, ...] (>= 2). s: { w half width m, px min half width (1080p px), taper [w0, w1] (width mult at the ends,
    //   linear) or fn(u) -> mult, col / col2 (start / end colour, hex | [r,g,b] linear HDR), k (colour gain), a / a2 (alpha),
    //   core (core width 0..1), coreK (core brightness), soft (0..1), over (0..1) }
    line(pts, s = {}) {
      const n = pts.length; if (n < 2 || nv + n * 2 > max || ni + (n - 1) * 6 > max * 3) return false;
      C0.copy(col(s.col ?? 0xffffff, s.k ?? 1)); C1.copy(s.col2 != null ? col(s.col2, s.k ?? 1) : C0);
      const w = s.w ?? 1, px = s.px ?? 0, a0 = s.a ?? 1, a1 = s.a2 ?? a0, par = [s.core ?? 0.35, s.coreK ?? 3, s.soft ?? 0, s.over ?? 0];
      const tp = typeof s.taper === 'function' ? s.taper : s.taper ? (u) => s.taper[0] + (s.taper[1] - s.taper[0]) * u : () => 1;
      const base = nv;
      for (let i = 0; i < n; i++) {
        vec(pts[i], _a); vec(pts[Math.min(n - 1, i + 1)], _t); vec(pts[Math.max(0, i - 1)], _b); _t.sub(_b);
        _v.subVectors(camPos, _a); _s.crossVectors(_t, _v); if (_s.lengthSq() < 1e-12) _s.copy(_r); _s.normalize();
        const u = i / (n - 1), depth = Math.max(0.01, -_v.dot(_f)), m = tp(u);
        const hw = Math.max(w * m, m > 0 ? px * pxK * depth * Math.min(1, m * 4) : 0);
        _c.setRGB(C0.r + (C1.r - C0.r) * u, C0.g + (C1.g - C0.g) * u, C0.b + (C1.b - C0.b) * u);
        for (const sd of [-1, 1]) put(_a.x + _s.x * hw * sd, _a.y + _s.y * hw * sd, _a.z + _s.z * hw * sd, u, sd, _c, a0 + (a1 - a0) * u, par);
      }
      for (let i = 0; i < n - 1; i++) { const v = base + i * 2; IX[ni++] = v; IX[ni++] = v + 1; IX[ni++] = v + 2; IX[ni++] = v + 1; IX[ni++] = v + 3; IX[ni++] = v + 2; }
      return true;
    },
    // round camera-facing dot: s = { w radius m, px min radius (1080p px), col, k, a, core, coreK, soft (0 hard disc .. 1 glow), over }
    dot(p, s = {}) {
      if (nv + 4 > max || ni + 6 > max * 3) return false;
      vec(p, _a); const depth = Math.max(0.01, _v.subVectors(_a, camPos).dot(_f)), r = Math.max(s.w ?? 0, (s.px ?? 3) * pxK * depth);
      _c.copy(col(s.col ?? 0xffffff, s.k ?? 1)); const a = s.a ?? 1, par = [s.core ?? 0.4, s.coreK ?? 3, 2 + (s.soft ?? 0), s.over ?? 0], base = nv;
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(_a.x + (_r.x * x + _u.x * y) * r, _a.y + (_r.y * x + _u.y * y) * r, _a.z + (_r.z * x + _u.z * y) * r, x, y, _c, a, par);
      IX[ni++] = base; IX[ni++] = base + 1; IX[ni++] = base + 2; IX[ni++] = base + 1; IX[ni++] = base + 3; IX[ni++] = base + 2;
      return true;
    },
    end() {
      for (const k of ['position', 'aUv', 'aCol', 'aPar']) { const at = g.getAttribute(k); at.needsUpdate = true; at.clearUpdateRanges?.(); }
      g.index.needsUpdate = true; g.setDrawRange(0, ni); mesh.visible = ni > 0; return api; },
    hide() { nv = ni = 0; mesh.visible = false; },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// FLAME: an axis billboard (plane through the axis, turned toward the camera). Coordinates in units of the head radius R:
// X along the axis (0 = head centre, + toward the tail), Y across. Envelope = bow-shock parabola ahead of the head that
// widens into the tail and tapers to the end. 4 OPAQUE layers (outer -> core), each edge broken by its own row of
// backward-pointing flame tongues (sawtooth + noise, redrawn with uT on twos). AA from the pixel size in R units (never
// from fwidth of the shape value: that blew up at the billboard border and drew dashed lines). The billboard fades out
// when it is seen along its axis (uEdgeMin).
// ---------------------------------------------------------------------------------------------------------------------
const FLAME_VS = /* glsl */`uniform vec3 uC, uA; uniform float uR, uFront, uLen, uWmax;
  varying vec2 vP; varying float vZ, vEdge;
  void main(){ vec3 V = normalize(cameraPosition - uC); vec3 S = cross(uA, V); float sl = length(S); S = sl > 1e-4 ? S / sl : vec3(1.0, 0.0, 0.0);
    vEdge = sl; float x = mix(-uFront * 1.08, uLen, position.x), y = position.y * uWmax * 1.45;
    vP = vec2(x, y); vec3 w = uC + (uA * x + S * y) * uR;
    vec4 mv = viewMatrix * vec4(w, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`;
const FLAME_HEAD = /* glsl */`${NOISE} ${OVERLAY}
  uniform float uR, uFront, uRc, uLen, uWmax, uTaper, uT, uScroll, uNs, uWob, uTongue, uCoreLen, uK, uOp, uSeed, uSoft, uOver, uDiam, uEdgeMin, uNear, uLitSide, uShell;
  uniform vec3 uC0, uC1, uC2, uC3, uInkC; uniform vec4 uTh; varying vec2 vP; varying float vZ, vEdge;
  // backward-pointing tongue: grows along X to a pointed tip, then drops back to the body (flame tongue / torn vapour)
  float tooth(float u, float side, float seed){ float i = floor(u), t = fract(u);
    return pow(t, 1.6) * (1.0 - smoothstep(0.68, 1.0, t)) * (0.5 + 0.8 * h12(vec2(i, side * 3.1 + seed))); }
  float fadeA(){ return softDepth(vZ, uSoft) * uOp * smoothstep(uEdgeMin, uEdgeMin + 0.2, vEdge) * smoothstep(uNear * 0.5, uNear, vZ); }`;
const FLAME_FS = /* glsl */`${FLAME_HEAD}
  void main(){
    float X = vP.x, Y = vP.y, aY = abs(Y), side = Y > 0.0 ? 1.0 : -1.0;
    float xs = X + uFront; if (xs <= 0.0) discard;
    float tl = clamp(X / max(uLen, 1e-3), 0.0, 1.0);
    float w = min(sqrt(2.0 * uRc * xs), uWmax) * pow(max(1.0 - tl, 0.0), uTaper);
    if (w < 1e-3) discard;
    float px = fwidth(Y) + 1e-5;
    float tS = uT * uScroll, grow = smoothstep(-uFront, 0.8, X);
    float wb = (fbm2(vec2(X * uNs * 0.7 - tS * 0.6, uSeed * 1.9)) - 0.5) * uWob * grow;
    float we = w * (1.0 + wb);
    // per layer: the edge position (fraction of the envelope) minus backward tongues
    float heat = exp(-max(X, 0.0) / max(uCoreLen, 1e-3)) * uK;
    float th1 = mix(1.15, uTh.y, clamp(heat * 1.5, 0.0, 1.0)), th2 = mix(1.15, uTh.z, clamp(heat * 1.2, 0.0, 1.0)), th3 = mix(1.15, uTh.w, heat);
    float amp = uTongue * grow * (0.6 + tl * 0.6);
    float e0 = we * (1.0 - amp * 0.42 + amp * 0.7 * tooth(X * uNs * 1.1 - tS * 1.3 + side * 0.37, side, uSeed));
    float e1 = we * (1.0 - th1) * (1.0 - amp * 0.28 + amp * 0.5 * tooth(X * uNs * 1.5 - tS * 1.6 + side * 0.61 + 3.0, side, uSeed + 1.0));
    float e2 = we * (1.0 - th2) * (1.0 - amp * 0.25 + amp * 0.45 * tooth(X * uNs * 1.9 - tS * 1.9 + side * 0.13 + 7.0, side, uSeed + 2.0));
    float e3 = we * (1.0 - th3) * (1.0 - amp * 0.2 + amp * 0.35 * tooth(X * uNs * 2.4 - tS * 2.2 + side * 0.83 + 11.0, side, uSeed + 3.0));
    float b0 = smoothstep(-px, px, e0 - aY), b1 = smoothstep(-px, px, e1 - aY), b2 = smoothstep(-px, px, e2 - aY), b3 = smoothstep(-px, px, e3 - aY);
    // drawn speed streaks: thin lines along the axis inside the layers (the next layer's colour), scrolling back
    { float yn = Y / max(we, 1e-3) * 7.0, si = floor(yn), sf = fract(yn) - 0.5, h = h12(vec2(si, uSeed + 9.0));
      float x0 = h * uLen * 0.5 + fract(-tS * 0.35 + h * 3.0) * uLen * 0.3, l = (0.15 + 0.35 * h12(vec2(si, uSeed + 4.0))) * uLen;
      float sw = 0.09 * (1.0 - smoothstep(0.0, 1.0, (X - x0) / max(l, 1e-3))), on = step(0.35, h) * step(x0, X) * step(X, x0 + l) * grow;
      float ln = on * (1.0 - smoothstep(sw - px * 7.0 / max(we, 1e-3), sw + px * 7.0 / max(we, 1e-3), abs(sf)));
      b2 = max(b2, ln * b1 * (1.0 - b2) * 0.9); b1 = max(b1, ln * b0 * (1.0 - b1)); }
    #ifdef JET
      float dm = abs(fract(X * uDiam) - 0.5) * 2.0;
      float dia = (1.0 - smoothstep(0.25, 0.32, dm + aY / max(we, 1e-3) * 0.9)) * step(0.3, X) * (1.0 - smoothstep(uLen * 0.25, uLen * 0.5, X));
      b3 = max(b3, dia * b1);
    #endif
    vec3 c = uC0; c = mix(c, uC1, b1); c = mix(c, uC2, b2); c = mix(c, uC3, b3);
    float a = b0 * fadeA();
    if (a < 0.002) discard;
    gl_FragColor = vec4(c * a, a * uOver);
  }`;
// smoke: a chain of opaque round puffs (spaced uNs R apart, scrolling back on twos, growing toward the tail), each in
// two flat tones (lit cream crescent toward the light / lavender shade) with an ink outline, the front puff's edge inked
// where it overlaps the one behind, paper grain, a warm underglow near the head.
const SMOKE_FS = /* glsl */`${FLAME_HEAD}
  float envW(float x){ float xs = x + uFront; if (xs <= 0.0) return 0.0; float tl = clamp(x / max(uLen, 1e-3), 0.0, 1.0);
    return min(sqrt(2.0 * uRc * xs), uWmax * (0.55 + 0.45 * smoothstep(0.0, 0.5, tl))) * (1.0 - smoothstep(0.72, 1.0, tl)); }
  void main(){
    float X = vP.x, Y = vP.y; if (X + uFront <= 0.0) discard;
    // puffs stay round on screen: distances along the (foreshortened) axis are scaled by sin(axis, view) = vEdge
    float px = fwidth(Y) + 1e-5, ef = clamp(vEdge, 0.2, 1.0), S = max(uNs, 0.05) / ef, off = uT * uScroll, i0 = floor((X - off) / S);
    // one bumpy silhouette (union of puffs) inked only on its outline; the shade tone = the part of each puff not covered
    // by the same puffs shifted toward the light (crescent shadows on the far side of every bump)
    vec2 L = normalize(vec2(-0.45, 0.9 * uLitSide));
    float dmin = 1e9, dl = 1e9;
    for (int j = -4; j <= 4; j++) { float i = i0 + float(j);
      float cx = (i + 0.5 + (h12(vec2(i, uSeed)) - 0.5) * 0.7) * S + off, wl = envW(cx); if (wl <= 0.0) continue;
      float r = wl * (0.45 + 0.55 * h12(vec2(i, uSeed + 1.0))), cy = (h12(vec2(i, uSeed + 2.0)) - 0.5) * wl * 0.9;
      vec2 q = vec2((X - cx) * ef, Y - cy);
      dmin = min(dmin, length(q) - r); dl = min(dl, length(q - L * r * 0.32) - r * 0.92); }
    float cov = smoothstep(-px, px, -dmin) * smoothstep(-uFront, -uFront + 0.4, X);
    if (cov < 0.002) discard;
    float lit = smoothstep(-px, px, -dl);
    vec3 c = mix(uC0, uC1, lit);
    float warm = exp(-max(X - 0.3, 0.0) / max(uCoreLen, 1e-3)) * uK;
    c = mix(c, uC3, warm * (1.0 - lit * 0.6) * 0.85);
    float ink = 1.0 - smoothstep(px * 1.0, px * 2.4, -dmin);
    c = mix(c, uInkC, ink * 0.8);
    c *= 1.0 + (n2(vP * 31.0 + uSeed) - 0.5) * 0.07 + (n2(vP * 7.0 + uSeed * 2.0) - 0.5) * 0.05;
    float a = cov * fadeA();
    gl_FragColor = vec4(c * a, a * uOver);
  }`;
// shell: the drawn bow-shock cone of vapour around a fast head: a smooth paraboloid crescent of thickness uShell (fraction
// of the envelope) in two tones with ink on both edges, its inner edge torn by backward teeth and its end breaking into wisps
const SHELL_FS = /* glsl */`${FLAME_HEAD}
  void main(){
    float X = vP.x, Y = vP.y, aY = abs(Y), side = Y > 0.0 ? 1.0 : -1.0;
    float xs = X + uFront; if (xs <= 0.0) discard;
    float tl = clamp(X / max(uLen, 1e-3), 0.0, 1.0);
    float w = min(sqrt(2.0 * uRc * xs), uWmax); if (w < 1e-3) discard;
    float px = fwidth(Y) + 1e-5, sx = X * 1.6 - uT * uScroll;
    float edge = w * (1.0 + (fbm2(vec2(sx * 0.5, uSeed + side)) - 0.5) * uWob);
    float th = uShell * w * (1.0 - 0.5 * tl) * (0.55 + 0.45 * smoothstep(-uFront, 0.0, X));
    float ie = edge - th * (1.0 + 1.2 * tooth(sx + side * 0.3, side, uSeed + 4.0) * smoothstep(0.0, 0.3, tl));
    float f = edge - aY, g = aY - ie;
    float cov = smoothstep(-px, px, f) * smoothstep(-px, px, g) * (1.0 - smoothstep(0.5, 0.95, tl + 0.3 * tooth(sx * 1.7 + side, side, uSeed + 6.0)));
    if (cov < 0.002) discard;
    float lit = smoothstep(-px, px, Y * uLitSide + w * 0.05);
    vec3 c = mix(uC0, uC1, lit);
    c = mix(c, uC3, exp(-max(X + uFront, 0.0) / max(uCoreLen, 1e-3)) * uK * 0.8);
    float ink = max(1.0 - smoothstep(px * 1.0, px * 2.2, f), 1.0 - smoothstep(px * 0.8, px * 1.8, g));
    c = mix(c, uInkC, ink * 0.75);
    c *= 1.0 + (n2(vP * 31.0 + uSeed) - 0.5) * 0.06;
    float a = cov * fadeA();
    gl_FragColor = vec4(c * a, a * uOver);
  }`;
export function flame(ctx, { mode = 'fire', palette = PAL.fire, order = 3, soft = 40, seed = 1, name = 'fx-flame' } = {}) {
  const geo = new THREE.PlaneGeometry(1, 2, 64, 1).translate(0.5, 0, 0);
  const smokeLike = mode === 'smoke' || mode === 'shell';
  const u = { ...ovU(), uC: { value: new V3() }, uA: { value: new V3(0, 0, 1) }, uR: { value: 1 }, uFront: { value: 1.25 }, uRc: { value: 1.0 }, uLen: { value: 8 },
    uWmax: { value: 1.9 }, uTaper: { value: 0.7 }, uT: { value: 0 }, uScroll: { value: 3 }, uNs: { value: 0.45 }, uWob: { value: 0.3 }, uTongue: { value: 0.6 },
    uCoreLen: { value: 2.0 }, uK: { value: 1 }, uOp: { value: 1 }, uSeed: { value: seed }, uSoft: { value: soft }, uOver: { value: 1 },
    uDiam: { value: 0.9 }, uLitSide: { value: 1 }, uEdgeMin: { value: 0.12 }, uNear: { value: 0 }, uShell: { value: mode === 'shell' ? 0.22 : 0 }, uInkC: { value: col(0x2a2240) },
    uC0: { value: col(palette[0]) }, uC1: { value: col(palette[1]) }, uC2: { value: col(palette[2]) }, uC3: { value: col(palette[3]) }, uTh: { value: new THREE.Vector4(0.0, 0.3, 0.56, 0.8) } };
  // DoubleSide: the billboard basis (axis, axis x view) makes its front face point away from the camera
  const mat = premult(new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide, vertexShader: FLAME_VS, fragmentShader: mode === 'smoke' ? SMOKE_FS : mode === 'shell' ? SHELL_FS : FLAME_FS, defines: mode === 'jet' ? { JET: '' } : {} }));
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; mesh.visible = false; ctx.overlay.add(mesh);
  const api = { mesh, u,
    // o: { pos (centre), axis (unit, toward the tail), R (m), front, rc, len, wmax, taper (R units), t, scroll, ns, wob, tongue, coreLen, k (heat 0..1),
    //      op, colors: [4], gain, th: [4], diam, litSide, over, edgeMin, shell, ink }
    set(o) {
      if (o.pos) (o.pos.isVector3 ? u.uC.value.copy(o.pos) : u.uC.value.fromArray(o.pos)); if (o.axis) (o.axis.isVector3 ? u.uA.value.copy(o.axis) : u.uA.value.fromArray(o.axis)).normalize();
      const map = { R: 'uR', front: 'uFront', rc: 'uRc', len: 'uLen', wmax: 'uWmax', taper: 'uTaper', t: 'uT', scroll: 'uScroll', ns: 'uNs', wob: 'uWob', tongue: 'uTongue',
        coreLen: 'uCoreLen', k: 'uK', op: 'uOp', diam: 'uDiam', litSide: 'uLitSide', over: 'uOver', seed: 'uSeed', soft: 'uSoft', edgeMin: 'uEdgeMin', near: 'uNear', shell: 'uShell' };
      for (const [k, n] of Object.entries(map)) if (o[k] != null) u[n].value = o[k];
      const pal = o.colors || palette;
      pal.forEach((c, i) => u['uC' + i].value.copy(col(c, (o.gain ?? 1) * (i === 3 && !smokeLike ? (o.coreGain ?? 1.7) : 1))));
      if (o.th) u.uTh.value.fromArray(o.th); if (o.ink != null) u.uInkC.value.copy(col(o.ink));
      mesh.visible = (o.op ?? u.uOp.value) > 0.001; return api; },
    hide() { mesh.visible = false; } };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// SHEATH: plasma sheath that hugs the body's real silhouette from every angle. Nested back-face hulls of the body mesh
// (outer red -> orange -> yellow -> white inner), pushed out along the radial direction: THICK on the leading face (a
// compressed white-hot bow shock with thin coloured rims) and thin along the flanks, pulled back along the tail into
// flame tongues (spiky noise, redrawn on twos). Only back faces draw and the soft depth test hides them behind the body,
// so each layer shows as an opaque band around the silhouette that streams into the trail.
// geometry = the body geometry (unit space) with RADIAL normals.
// ---------------------------------------------------------------------------------------------------------------------
const SHEATH_VS = /* glsl */`${NOISE}
  uniform vec3 uTail, uCen; uniform float uR, uE, uEh, uL, uTime, uScroll, uAmp, uSeed, uK; varying float vZ;
  void main(){ vec3 nw = normalize(mat3(modelMatrix) * normal); vec4 pw4 = modelMatrix * vec4(position, 1.0); vec3 pw = pw4.xyz;
    float ct = dot(nw, uTail), tail = max(ct, 0.0), head = max(-ct, 0.0), hs = smoothstep(0.1, 0.95, head);
    vec3 rel = (pw - uCen) / uR; float al = dot(rel, uTail); vec3 ac = rel - uTail * al;
    float nz = fbm3(ac * 2.4 + uTail * (al * 0.9 - uTime * uScroll) + uSeed);
    float spike = pow(max(nz - 0.36, 0.0) * 2.3, 2.0);
    float e = mix(uE, uEh, hs) * uK;
    float l = uL * pow(tail, 1.3) * uK * (0.4 + 1.9 * spike + 0.4 * nz);
    pw += nw * (e + uAmp * (nz - 0.4) * (0.1 + tail) * uK) * uR + uTail * l * uR;
    vec4 mv = viewMatrix * vec4(pw, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`;
export function sheath(ctx, geometry, { palette = PAL.fire, order = 4, soft = 40, seed = 5, name = 'fx-sheath' } = {}) {
  // band: [push at the flanks, push at the leading face, tail pull (R units), noise amplitude]   outer red -> white core.
  const BANDS = [[0.085, 0.2, 3.0, 0.1], [0.056, 0.165, 1.7, 0.07], [0.03, 0.135, 0.7, 0.04], [0.012, 0.105, 0.16, 0.015]];
  const GAIN = [1, 1, 1.05, 1.8];
  const shared = { uTail: { value: new V3(0, 1, 0) }, uCen: { value: new V3() }, uR: { value: 1 }, uTime: { value: 0 }, uScroll: { value: 2.2 }, uSeed: { value: seed }, uK: { value: 1 },
    ...ovU(), uSoft: { value: soft }, uOp: { value: 1 }, uNear: { value: 0 } };
  const meshes = BANDS.map(([e, eh, l, amp], i) => {
    const u = { ...shared, uE: { value: e }, uEh: { value: eh }, uL: { value: l }, uAmp: { value: amp }, uCol: { value: col(palette[i], GAIN[i]) } };
    const m = premult(new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, vertexShader: SHEATH_VS,
      fragmentShader: /* glsl */`${OVERLAY} uniform vec3 uCol; uniform float uOp, uSoft, uNear; varying float vZ;
        void main(){ float a = uOp * softDepth(vZ, uSoft) * smoothstep(uNear * 0.5, uNear, vZ); if (a < 0.002) discard; gl_FragColor = vec4(uCol * a, a); }` }));
    const mesh = new THREE.Mesh(geometry, m); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = order + i * 0.01; mesh.name = name + i; mesh.visible = false;
    ctx.overlay.add(mesh); return mesh; });
  const api = { meshes, u: shared, BANDS,
    // o: { matrix (body matrixWorld incl. scale), pos (centre), tail (unit), R (m), k (0 = collapsed .. 1), t, scroll, op, colors: [4], push / pull / head (mult), near (m) }
    set(o) {
      for (const m of meshes) { if (o.matrix) m.matrix.copy(o.matrix); m.matrixWorld.copy(m.matrix); }
      if (o.pos) shared.uCen.value.copy(o.pos); if (o.tail) shared.uTail.value.copy(o.tail).normalize();
      for (const [k, n] of Object.entries({ R: 'uR', k: 'uK', t: 'uTime', scroll: 'uScroll', op: 'uOp', seed: 'uSeed', soft: 'uSoft', near: 'uNear' })) if (o[k] != null) shared[n].value = o[k];
      meshes.forEach((m, i) => { const u = m.material.uniforms; if (o.colors) u.uCol.value.copy(col(o.colors[i], GAIN[i] * (o.gain ?? 1)));
        u.uE.value = BANDS[i][0] * (o.push ?? 1); u.uEh.value = BANDS[i][1] * (o.head ?? o.push ?? 1); u.uL.value = BANDS[i][2] * (o.pull ?? 1);
        m.visible = (o.op ?? 1) > 0.001 && (o.k ?? shared.uK.value) > 0.001 && (o.bands ?? 4) > 3 - i; });
      return api; },
    hide() { for (const m of meshes) m.visible = false; } };
  return api;
}

// flash envelope (grade.flash / FX intensity) for an event at frame round(t0 * fps): `pre` frames ramp in BEFORE the event
// (so the brightness climbs into the cut), `up` more frames to the peak, `hold`, then a decay over `down` frames.
// Pure and frame-exact.
export function flashEnv(t, t0, { peak = 1, pre = 0, up = 2, hold = 2, down = 9, fps = 24 } = {}) {
  const i = Math.round(t * fps) - Math.round(t0 * fps), n = pre + up;
  if (i < -pre) return 0;
  if (i < up) { const k = (i + pre + 1) / (n + 1); return peak * k * (0.65 + 0.35 * k); }
  if (i < up + hold) return peak;
  const k = (i - up - hold) / down; return k >= 1 ? 0 : peak * Math.pow(1 - k, 2.2);
}
export const lerpPal = (a, b, k) => a.map((c, i) => col(c).lerp(col(b[i]), Math.min(1, Math.max(0, k))));

// ---------------------------------------------------------------------------------------------------------------------
// RING: shockwave on a plane (normal n). r = current radius (m); bright edge line (white core, tinted band), a puffy
// two-tone vapour band just inside it (cumulus-like inner edge), a faint inner wash. Wobbly edge redrawn on twos.
// ---------------------------------------------------------------------------------------------------------------------
export function ring(ctx, { order = 2, soft = 80, name = 'fx-ring' } = {}) {
  const u = { ...ovU(), uR: { value: 1 }, uW: { value: 0.3 }, uLine: { value: 0.02 }, uMax: { value: 1 }, uK: { value: 1 }, uOp: { value: 1 }, uT: { value: 0 }, uSeed: { value: 1 },
    uWob: { value: 0.03 }, uCol: { value: col(0xbfe8ff, 2.2) }, uVap: { value: col(0xffffff) }, uVapSh: { value: col(0xb4b8e8) }, uWash: { value: 0.12 }, uVapOp: { value: 0.9 }, uSoft: { value: soft } };
  const mat = premult(new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vQ; varying float vZ; uniform float uMax; void main(){ vQ = position.xy * uMax; vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`${NOISE} ${OVERLAY} uniform float uR, uW, uLine, uK, uOp, uT, uSeed, uWob, uWash, uVapOp, uSoft; uniform vec3 uCol, uVap, uVapSh; varying vec2 vQ; varying float vZ;
      void main(){ float r = length(vQ), th = atan(vQ.y, vQ.x);
        float n = fbm2(vec2(th * 3.0 + uSeed, uT * 1.5 + uSeed)) - 0.5;
        float rr = r + n * uWob * uR;
        float aa = max(fwidth(r), 1e-4) * 1.2;
        float line = 1.0 - smoothstep(uLine - aa, uLine + aa, abs(rr - uR));
        float lcore = 1.0 - smoothstep(uLine * 0.35 - aa, uLine * 0.35 + aa, abs(rr - uR));
        float pv = fbm2(vec2(th * 9.0 + uSeed * 3.0, uT * 2.0)) - 0.5, pb = n2(vec2(th * 26.0 + uSeed, uT * 3.0)) - 0.5;
        float inner = uR - uW * (1.0 + pv * 0.9 + pb * 0.35);
        float vap = smoothstep(inner - aa, inner + aa, rr) * (1.0 - smoothstep(uR - aa, uR + aa, rr));
        float lit = smoothstep(-aa, aa, rr - mix(inner, uR, 0.45 + pb * 0.4));
        vec3 vc = mix(uVapSh, uVap, lit);
        float wash = (1.0 - smoothstep(uR * 0.2, uR, rr)) * uWash * step(rr, uR);
        float a = vap * uVapOp;
        vec3 c = vc * a;
        c += (uCol * line + vec3(3.0) * lcore) * uK + uCol * wash * uK;
        float sd = softDepth(vZ, uSoft); c *= uOp * sd; a *= uOp * sd;
        if (max(c.r, max(c.g, a)) < 0.002) discard;
        gl_FragColor = vec4(c, a); }` }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; mesh.visible = false; ctx.overlay.add(mesh);
  const Z = new V3(0, 0, 1);
  const api = { mesh, u,
    // o: { pos, normal, r (m), w vapour band width (m), line half width (m), k, op, t, seed, wob, color, vapour, vapourShade, wash, vapOp }
    set(o) {
      if (o.pos) (o.pos.isVector3 ? mesh.position.copy(o.pos) : mesh.position.fromArray(o.pos));
      if (o.normal) mesh.quaternion.setFromUnitVectors(Z, (o.normal.isVector3 ? o.normal.clone() : new V3().fromArray(o.normal)).normalize());
      const r = o.r ?? u.uR.value, w = o.w ?? u.uW.value, M = r + Math.max(w, o.line ?? u.uLine.value) * 0.2 + r * (o.wob ?? u.uWob.value) * 2 + (o.line ?? u.uLine.value) * 2;
      u.uR.value = r; u.uW.value = w; u.uMax.value = M; mesh.scale.setScalar(M);
      for (const [k, n] of Object.entries({ line: 'uLine', k: 'uK', op: 'uOp', t: 'uT', seed: 'uSeed', wob: 'uWob', wash: 'uWash', vapOp: 'uVapOp', soft: 'uSoft' })) if (o[k] != null) u[n].value = o[k];
      if (o.color != null) u.uCol.value.copy(col(o.color, o.colorK ?? 2.2)); if (o.vapour != null) u.uVap.value.copy(col(o.vapour)); if (o.vapourShade != null) u.uVapSh.value.copy(col(o.vapourShade));
      mesh.updateMatrix(); mesh.visible = (o.op ?? u.uOp.value) > 0.001 && r > 0; return api; },
    hide() { mesh.visible = false; } };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// GLARE: camera-facing flash (impact, burst, reactor core, star heads). size = radius in metres (or px with sizePx).
// Hard white core, a flat colour halo band, N tapered rays (lengths redrawn on twos), soft halo for bloom.
// ---------------------------------------------------------------------------------------------------------------------
export function glare(ctx, { order = 8, soft = 30, name = 'fx-glare' } = {}) {
  const u = { ...ovU(), uCol: { value: col(0xffd27a) }, uCore: { value: 0.08 }, uHalo: { value: 0.2 }, uRays: { value: 8 }, uRayLen: { value: 0.95 }, uRayW: { value: 0.035 },
    uK: { value: 1 }, uOp: { value: 1 }, uT: { value: 0 }, uSeed: { value: 1 }, uRot: { value: 0 }, uGlow: { value: 0.6 }, uCoreK: { value: 5 }, uSoft: { value: soft } };
  const mat = premult(new THREE.ShaderMaterial({ uniforms: u,
    vertexShader: /* glsl */`varying vec2 vQ; varying float vZ; void main(){ vQ = position.xy; vec4 mv = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float s = length(modelMatrix[0].xyz); mv.xy += position.xy * s; vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`${NOISE} ${OVERLAY} uniform vec3 uCol; uniform float uCore, uHalo, uRays, uRayLen, uRayW, uK, uOp, uT, uSeed, uRot, uGlow, uCoreK, uSoft; varying vec2 vQ; varying float vZ;
      void main(){ float r = length(vQ), th = atan(vQ.y, vQ.x); float aa = max(fwidth(r), 1e-4) * 1.2;
        float core = 1.0 - smoothstep(uCore - aa, uCore + aa, r);
        float hw = uHalo * (1.0 + (n2(vec2(th * 2.5 + uSeed, uT * 6.0)) - 0.5) * 0.12);
        float halo = 1.0 - smoothstep(hw - aa, hw + aa, r);
        float k = th / 6.2831853 * uRays + uRot; float id = floor(k + 0.5); float fk = abs(k - id);
        float len = uRayLen * (0.35 + 0.65 * h12(vec2(id + uSeed * 7.0, floor(uT * 12.0 + 0.001))));
        float arc = fk * 6.2831853 / uRays * r;
        float wid = uRayW * (1.0 - smoothstep(0.0, len, r));
        float ray = uRays > 0.5 ? (1.0 - smoothstep(wid - aa, wid + aa, arc)) * step(r, len) : 0.0;
        float glow = pow(max(1.0 - r, 0.0), 3.0) * uGlow;
        vec3 c = uCol * glow * 0.6 + uCol * 1.6 * max(halo, ray) + vec3(uCoreK) * core;
        c *= uK * uOp * softDepth(vZ, uSoft);
        if (max(c.r, max(c.g, c.b)) < 0.002) discard;
        gl_FragColor = vec4(c, 0.0); }` }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; mesh.visible = false; ctx.overlay.add(mesh);
  const api = { mesh, u,
    // o: { pos, size (m) | sizePx (+ camera), color, core, halo, rays, rayLen, rayW, k, op, t, seed, rot, glow, coreK }
    set(o, camera = ctx.camera) {
      if (o.pos) (o.pos.isVector3 ? mesh.position.copy(o.pos) : mesh.position.fromArray(o.pos));
      let s = o.size ?? mesh.scale.x;
      if (o.sizePx != null) { const d = Math.max(1e-3, mesh.position.clone().applyMatrix4(camera.matrixWorldInverse).z * -1); s = o.sizePx * d * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / 1080; }
      mesh.scale.setScalar(Math.max(s, 1e-4)); mesh.updateMatrix();
      for (const [k, n] of Object.entries({ core: 'uCore', halo: 'uHalo', rays: 'uRays', rayLen: 'uRayLen', rayW: 'uRayW', k: 'uK', op: 'uOp', t: 'uT', seed: 'uSeed', rot: 'uRot', glow: 'uGlow', coreK: 'uCoreK', soft: 'uSoft' }))
        if (o[k] != null) u[n].value = o[k];
      if (o.color != null) u.uCol.value.copy(col(o.color));
      mesh.visible = (o.op ?? u.uOp.value) * (o.k ?? u.uK.value) > 0.001; return api; },
    hide() { mesh.visible = false; } };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// IMPACT FRAME: the anime "impact frame" for 1-2 frames at a flash peak. Full screen: flat paper white (or a colour),
// every inked character pixel (data id 1-199) a hard silhouette, plus radial speed lines (tapered wedges, hashed per
// angle, redrawn every frame) from a screen point. Opaque; drawn last in the overlay.
// ---------------------------------------------------------------------------------------------------------------------
export function impactFrame(ctx, { order = 20, name = 'fx-impact-frame' } = {}) {
  const u = { ...ovU(), uBg: { value: col(0xfffcf4) }, uSil: { value: col(0x0a0c1c) }, uLine: { value: col(0x0a0c1c) }, uC: { value: new THREE.Vector2(0.5, 0.5) },
    uN: { value: 150 }, uSeed: { value: 1 }, uK: { value: 1 }, uLineK: { value: 1 }, uAsp: { value: 16 / 9 } };
  const mat = premult(new THREE.ShaderMaterial({ uniforms: u,
    vertexShader: /* glsl */`varying vec2 vS; void main(){ vS = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`${NOISE} uniform sampler2D tSceneData; uniform vec2 uRes, uC; uniform vec3 uBg, uSil, uLine; uniform float uN, uSeed, uK, uLineK, uAsp; varying vec2 vS;
      void main(){ vec4 d = texture2D(tSceneData, gl_FragCoord.xy / uRes); float id = d.w;
        float sil = (id > 0.5 && id < 199.5 && d.z < 30000.0) ? 1.0 : 0.0;
        vec2 q = (vS - uC) * vec2(uAsp, 1.0); float r = length(q), th = atan(q.y, q.x) / 6.2831853 + 0.5;
        float k = th * uN, i = floor(k), fk = fract(k);
        float on = step(0.45, h12(vec2(i, uSeed))), w = (0.08 + 0.32 * h12(vec2(i + 7.0, uSeed))) * smoothstep(0.05 + 0.3 * h12(vec2(i, uSeed + 3.0)), 0.9, r);
        float aa = fwidth(k) * 1.2 + 1e-4;
        float line = on * (1.0 - smoothstep(w - aa, w + aa, abs(fk - 0.5) * 2.0)) * uLineK;
        vec3 c = mix(uBg, uLine, line); c = mix(c, uSil, sil);
        gl_FragColor = vec4(c * uK, uK); }` }));
  mat.depthTest = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; mesh.visible = false; ctx.overlay.add(mesh);
  const api = { mesh, u,
    // o: { center: [x, y] screen 0..1 (bottom-left origin), bg, sil, line, n (line slots), seed, k (0..1 coverage), lineK }
    set(o = {}) {
      if (o.center) u.uC.value.set(o.center[0], o.center[1]);
      if (o.bg != null) u.uBg.value.copy(col(o.bg, o.bgK ?? 1)); if (o.sil != null) u.uSil.value.copy(col(o.sil)); if (o.line != null) u.uLine.value.copy(col(o.line));
      for (const [k, n] of Object.entries({ n: 'uN', seed: 'uSeed', k: 'uK', lineK: 'uLineK' })) if (o[k] != null) u[n].value = o[k];
      u.uAsp.value = ctx.camera?.aspect ?? 16 / 9; mesh.visible = (o.k ?? 1) > 0.001; return api; },
    hide() { mesh.visible = false; } };
  return api;
}

// pools: begin() each frame, next() hands out the next free instance (null when exhausted), end() hides the rest
export function pool(make, n) { const list = Array.from({ length: n }, (_, i) => make(i)); let used = 0;
  return { list, begin() { used = 0; }, next() { return used < n ? list[used++] : null; }, end() { for (let i = used; i < n; i++) list[i].hide(); } }; }
export const glarePool = (ctx, n, opts = {}) => pool((i) => glare(ctx, { ...opts, name: (opts.name || 'fx-glare') + i }), n);
export const ringPool = (ctx, n, opts = {}) => pool((i) => ring(ctx, { ...opts, name: (opts.name || 'fx-ring') + i }), n);
export const flamePool = (ctx, n, opts = {}) => pool((i) => flame(ctx, { ...opts, seed: (opts.seed ?? 1) + i, name: (opts.name || 'fx-flame') + i }), n);
