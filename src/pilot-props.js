// MEGA CLAWD · PILOT props (owner: pilot): the cup of blue shaved ice (kakigori), the spoon-straw, the pier ladder,
// water drips and the syrup glint. Cel + ink (engine celMaterial), hand-painted canvas decals, all pure functions of t.
//   makeCup(ctx)    -> { group, paper, ice, water, set({ melt, dents, level, t, sparkle, ripple, warm }), H, R0, R1, top(), glintPoint() }
//   makeSpoon(ctx)  -> { group, bite, set({ bite }), L, grip, tip }   (local +y = from the grip toward the spoon bowl)
//   makeLadder(ctx, { x, z, deckY }) -> Group (iron pier ladder with grab rails; only built when the world has none)
//   makeDrips(ctx, n) -> { group, set(t, sources[], k) }  water drops falling off soaked Clawd (FX on threes)
//   makeGlint(ctx)  -> { set(pos, k, camera, px, sky) }     s04: painted sky reflection + the meteor streak in the syrup
//   makeFocusLines(ctx), makeStreaks(ctx, n)               anime speed FX in the overlay (impact focus lines, motion streaks)
// Sizes in metres (Clawd is 0.5 m wide). The cup: 8.5 cm paper cup, 10 cm across the rim, a 7 cm heaped mountain of ice.
import * as THREE from 'three';

const V3 = THREE.Vector3;
export const CUP = { H: 0.1, R0: 0.042, R1: 0.058, ICE_H: 0.082, ICE_R: 0.064 };

// ---------------------------------------------------------------------------------------------------------------------
// paper cup decal: classic kakigori flag motif — red 氷 on white paper, blue waves, a thin blue rim band
function cupTexture(kit) {
  return kit.canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#f7f2e8'; c.fillRect(0, 0, w, h);
    // paper fibre
    let s = 7; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(160,140,110,${0.03 + 0.04 * R()})`; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1); }
    // rim band (top) + base band
    c.fillStyle = '#2f6fd6'; c.fillRect(0, 0, w, 20); c.fillStyle = '#e8463a'; c.fillRect(0, 24, w, 6);
    c.fillStyle = '#2f6fd6'; c.fillRect(0, h - 12, w, 12);
    // waves (seigaiha-like curls along the bottom), hand-drawn wobble
    for (let row = 0; row < 2; row++) for (let i = -1; i < 18; i++) {
      const x0 = i * 64 + row * 32, y0 = h - 30 - row * 26;
      c.fillStyle = row ? '#5f9ff0' : '#2f6fd6'; c.beginPath(); c.moveTo(x0 - 34, y0 + 30);
      c.quadraticCurveTo(x0 - 30, y0 - 6, x0 + 2, y0 - 4); c.quadraticCurveTo(x0 + 26, y0 - 2, x0 + 22, y0 + 14);
      c.quadraticCurveTo(x0 + 10, y0 + 2, x0 + 2, y0 + 12); c.quadraticCurveTo(x0 + 16, y0 + 12, x0 + 34, y0 + 30); c.closePath(); c.fill();
      c.strokeStyle = '#f7f2e8'; c.lineWidth = 3; c.beginPath(); c.arc(x0 + 4, y0 + 12, 9, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    }
    // the 氷 flag: red brush kanji, twice around the cup (u = 0.5 faces -z, u = 0 / 1 faces +z)
    for (const cx of [w * 0.5, 0, w]) {
      c.save(); c.translate(cx, h * 0.47); c.rotate(-0.04);
      c.fillStyle = '#e23b2e'; c.font = 'bold 132px "Yu Mincho", "MS Mincho", "Noto Serif JP", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('氷', 0, 0); c.restore();
    }
    c.fillStyle = '#2f6fd6'; c.font = 'bold 22px "Arial Rounded MT Bold", "Segoe UI", sans-serif'; c.textAlign = 'center';
    c.fillText('KAKIGORI', w * 0.25, h * 0.52); c.fillText('KAKIGORI', w * 0.75, h * 0.52);
  });
}
// spoon-straw stripes (pink / white diagonal)
function stripeTexture(kit) {
  const t = kit.canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#ff6f9a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff4f6';
    for (let y = -64; y < h + 64; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 22); c.lineTo(w, y + 34); c.lineTo(0, y + 12); c.closePath(); c.fill(); } }, { repeat: true });
  t.repeat.set(1, 3); return t;
}

// ---------------------------------------------------------------------------------------------------------------------
// shaved-ice mound: a heaped, lumpy mountain; vertex colour = ice white -> blue syrup (top + drips); aSyr = gloss mask
const RINGS = 30, SEGS = 84;
function iceGeometry() {
  const g = new THREE.BufferGeometry(), n = (RINGS + 1) * SEGS + 1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSyr', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  const idx = [];
  // apex = vertex 0, ring r (1..RINGS+1) segment s -> 1 + (r-1)*SEGS + s
  for (let s = 0; s < SEGS; s++) idx.push(0, 1 + (s + 1) % SEGS, 1 + s);
  for (let r = 1; r <= RINGS; r++) for (let s = 0; s < SEGS; s++) {
    const a = 1 + (r - 1) * SEGS + s, b = 1 + (r - 1) * SEGS + (s + 1) % SEGS, c2 = 1 + r * SEGS + s, d = 1 + r * SEGS + (s + 1) % SEGS;
    idx.push(a, b, c2, b, d, c2);
  }
  g.setIndex(idx); return g;
}
const hsh = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// GLSL-order smoothstep(edge0, edge1, x) (THREE.MathUtils.smoothstep takes x first)
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const vn = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hsh(i) * (1 - u) + hsh(i + 1) * u; };
const vn2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hsh(a * 57.3 + b * 131.7); return (h(i, j) * (1 - ux) + h(i + 1, j) * ux) * (1 - uy) + (h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux) * uy; };
// shape: melt 0..1 (slump), dent { a (angle), d (depth 0..1), h (height 0..1) } = where the spoon dug
function shapeIce(g, { melt = 0, dents = [] }, R0, Hc) {
  const P = g.attributes.position, Nn = g.attributes.normal, Cc = g.attributes.color, S = g.attributes.aSyr;
  const Hm = CUP.ICE_H * (1 - 0.88 * melt) + 0.004, Rb = CUP.ICE_R * (1 - 0.1 * melt);
  const pos = (s, th) => {   // s = 0 apex .. 1 base edge, th angle
    const prof = Math.pow(Math.max(0, 1 - Math.pow(s, 2.1)), 0.62);   // a rounded, heaped mountain
    let r = Rb * s, y = Hm * prof;
    // fluffy clumps of shaved ice (big + fine), strongest on the flanks; slump with melt
    const cx = Math.cos(th), sz = Math.sin(th), on = (f, k, o) => vn2(cx * f * s + s * k + o, sz * f * s - s * k * 0.7 + o * 1.7) - 0.5;   // periodic in th
    // shaved-ice clumps: soft round bumps (cauliflower / cloud silhouette), big + mid + fine flakes
    const bump3 = (f, k, o) => { const v = on(f, k, o) + 0.5; return 1 - Math.pow(1 - v, 2); };
    const lump = on(2.4, 3.1, 4) * 0.01 + (bump3(7.5, 8.3, 9) - 0.6) * 0.014 + (bump3(16, 18, 2) - 0.6) * 0.008 + (bump3(30, 33, 6) - 0.6) * 0.004;
    const fl = Math.sin(Math.min(1, s) * Math.PI * 0.9) * (1 - 0.7 * melt);
    r += lump * (0.3 + fl) * 0.9; y += lump * 0.5 * fl;
    for (const dn of dents) { let da = Math.abs(((th - dn.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); const w = Math.exp(-(da * da) / 0.18) * Math.exp(-Math.pow((s - (1 - dn.h)) / 0.28, 2));
      r -= w * dn.d * 0.016; y -= w * dn.d * 0.018; }
    return new V3(Math.cos(th) * r, Hc + y, Math.sin(th) * r);
  };
  const setV = (i, p, s, th) => {
    P.setXYZ(i, p.x, p.y, p.z);
    // syrup: the top cap + drip lanes running down
    const lane = Math.pow(Math.max(0, Math.sin(th * 4 + 1.3 + 0.6 * Math.sin(th * 3))), 6) * 0.45 + Math.pow(Math.max(0, Math.sin(th * 7 + 0.4)), 10) * 0.3;
    const cap = 0.9 + 0.1 * melt + lane * 0.45 + (vn2(th * 4, s * 3) - 0.5) * 0.22;   // soaked: blue down the flanks, white only at the base
    const sy = ss(cap + 0.06, cap - 0.06, s);
    Cc.setXYZ(i, 1, 1, 1); S.setX(i, sy);   // colour = white; the shader paints the syrup from aSyr (hard cel edge)
  };
  setV(0, pos(0, 0), 0, 0);
  for (let r = 1; r <= RINGS + 1; r++) for (let s = 0; s < SEGS; s++) {
    const sv = Math.min(1, r / (RINGS + 1)), th = s / SEGS * Math.PI * 2, i = 1 + (r - 1) * SEGS + s;
    // the last ring tucks inside the rim (no gap between the mound and the paper)
    const p = r === RINGS + 1 ? new V3(Math.cos(th) * R0 * 0.97, Hc - 0.004, Math.sin(th) * R0 * 0.97) : pos(sv, th);
    setV(i, p, sv, th);
  }
  P.needsUpdate = true; Cc.needsUpdate = true; S.needsUpdate = true;
  g.computeVertexNormals(); g.attributes.normal.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
}

// shaved ice: matte cel snow (2 tones, a stippled flaky terminator, tiny lit flakes in the shade and shadow flakes in
// the light), the syrup = 2 tones of glossy blue with crisp white wet glints (no chrome / sky streaks); the painted sky
// reflection + the meteor streak in the syrup is the glint sprite (makeGlint), placed where the sky reflects
function patchIce(ctx, m, U) {
  ctx.glsl.patchShader(m, 'pilotIce', (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('varying vec2 vUv;', 'varying vec2 vUv; attribute float aSyr; varying float vSyr;')
      .replace('vUv = uv;', 'vUv = uv; vSyr = aSyr;');
    sh.fragmentShader = sh.fragmentShader.replace('varying vec2 vUv;', `varying vec2 vUv; varying float vSyr; uniform float uWarm, uDeepY;`)
      .replace('gl_FragColor = vec4(col, uMask);', `
      { // crisp syrup edge (the vertex field is smooth; the cel edge is one hard step), two blues (darker pooled on the summit)
        float sw = fwidth(vSyr) * 0.8 + 1e-4, syr = smoothstep(0.45 - sw, 0.45 + sw, vSyr);
        float dw = fwidth(vO.y) + 1e-5, deep = smoothstep(uDeepY - dw, uDeepY + dw, vO.y + (n3(vO * 120.0) - 0.5) * 0.006);
        col *= mix(vec3(1.0), mix(vec3(0.16, 0.52, 1.0), vec3(0.07, 0.3, 0.92), deep), syr);
        float ice = 1.0 - syr;
        // flakes: object-anchored stipple, two sizes
        float f1 = n3(vO * 900.0), f2 = n3(vO * 1700.0 + 4.7);
        vec3 shadeT = shade * (uSky * 0.6 + 0.4), litT = base * max(keyL, vec3(0.85));
        col = mix(col, shadeT, step(0.8, f1) * lit * ice * 0.55);
        col = mix(col, litT, step(0.84, f2) * (1.0 - lit) * ice * 0.8);
        // the ice keeps its white / blue (no tan under the warm s08 light): only a warm rim at the edge
        float lc = dot(col, vec3(0.2126, 0.7152, 0.0722)); vec3 cool = mix(vec3(lc), col, 0.35) * vec3(0.97, 0.99, 1.06);
        col = mix(col, mix(cool, col, 1.0 - ice), uWarm);
        float fr = 1.0 - clamp(dot(N, V), 0.0, 1.0);
        col += vec3(1.0, 0.55, 0.25) * smoothstep(0.62, 0.66, fr) * uWarm * 0.35;
        // syrup: crisp white wet glints (cel), small and sharp
        vec3 Hh = normalize(KD + V); float sp = dot(N, Hh);
        col = mix(col, vec3(1.0), smoothstep(0.972, 0.976, sp + (n3(vO * 300.0) - 0.5) * 0.02) * syr * 0.9); }
      gl_FragColor = vec4(col, uMask);`);
  });
}
// melted ice water (s35): deep blue with lighter ripple rings on threes, a crisp white highlight and a reflected
// shooting star (white head, gold tail) drifting across it
function patchWater(ctx, m, U) {
  ctx.glsl.patchShader(m, 'pilotWater', (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('varying vec2 vUv;', `varying vec2 vUv; uniform float uRip;`)
      .replace('gl_FragColor = vec4(col, uMask);', `
      { vec2 p = vUv - 0.5; float r = length(p) * 2.0;
        col = mix(vec3(0.07, 0.36, 0.92), vec3(0.2, 0.68, 1.0), lit) * (0.85 + 0.25 * min(keyL, vec3(1.2)));   // flat cel blue, kept blue at dusk
        float ring = 0.0;
        for (int i = 0; i < 3; i++) { float ph = fract(uRip * 0.9 + float(i) / 3.0); float rr = ph * 1.1;
          ring = max(ring, (1.0 - smoothstep(0.035, 0.06, abs(r - rr))) * (1.0 - ph)); }
        col = mix(col, col * 1.45 + vec3(0.05, 0.12, 0.2), ring * step(0.0, uRip) * 0.7);
        // crisp highlight lens
        float hl = 1.0 - smoothstep(0.0, 0.02, length((p - vec2(-0.18, 0.2)) * vec2(1.0, 2.2)) - 0.12);
        col = mix(col, vec3(1.0), hl * 0.85);
        // the reflected shooting star
        vec2 s0 = vec2(0.22 - 0.12 * fract(uRip * 0.5), -0.12 + 0.08 * fract(uRip * 0.5)); vec2 d = normalize(vec2(0.8, -0.5));
        vec2 q = p - s0; float al = dot(q, d), ac = abs(dot(q, vec2(-d.y, d.x)));
        float tail = (1.0 - smoothstep(0.004, 0.012, ac - 0.01 * smoothstep(0.0, -0.3, al))) * smoothstep(-0.32, 0.0, al) * (1.0 - smoothstep(0.0, 0.02, al));
        float head = 1.0 - smoothstep(0.015, 0.03, length(q));
        col = mix(col, mix(vec3(1.4, 1.0, 0.45), vec3(1.6, 1.55, 1.4), head), max(tail * 0.9, head) * step(0.0, uRip)); }
      gl_FragColor = vec4(col, uMask);`);
  });
}

export function makeCup(ctx) {
  const { THREE: T, mat, kit } = ctx;
  const g = new T.Group(); g.name = 'kakigori-cup';
  const H = CUP.H, R0 = CUP.R0, R1 = CUP.R1;
  const tex = cupTexture(kit);
  const paperM = mat.cel(0xffffff, { hero: true, id: mat.nextId(), map: tex, bevel: 0.01, hiAmt: 0.35, spec: 0.15 });
  const paper = new T.Mesh(new T.CylinderGeometry(R1, R0, H, 48, 1, true).translate(0, H / 2, 0), paperM); paper.name = 'cup-paper';
  const inner = new T.Mesh(new T.CylinderGeometry(R1 * 0.985, R0 * 0.985, H * 0.99, 48, 1, true).translate(0, H / 2 + 0.001, 0), mat.cel(0xe6dccb, { hero: true, id: paperM.userData.mrt?.u?.value, side: T.BackSide, hiAmt: 0.1 }));
  const bottom = new T.Mesh(new T.CircleGeometry(R0, 32).rotateX(-Math.PI / 2).translate(0, 0.002, 0), mat.cel(0xece4d4, { hero: true, id: mat.nextId(), side: T.DoubleSide }));
  const rim = new T.Mesh(new T.TorusGeometry(R1 + 0.0005, 0.0026, 8, 64).rotateX(Math.PI / 2).translate(0, H, 0), mat.cel(0xfbf8f0, { hero: true, id: mat.nextId(), bevel: 0.004, spec: 0.3 }));
  g.add(paper, inner, bottom, rim);
  // ice + syrup (the mound sits on the rim and over it: its base ring rides the rim top, the tuck hides behind the rim)
  const ICE_BASE = H + 0.003, TUCK = R1 * 0.975, U = { uWarm: { value: 0 }, uDeepY: { value: ICE_BASE + 0.062 } };
  const iceM = mat.cel(0xffffff, { hero: true, id: mat.nextId(), vertexColors: true, shade: 0xaebfee, hi: 0xffffff, hiT: 0.72, hiAmt: 0.0, spec: 0, bevel: 0.006, rimI: 0.25, brush: 0.14, brushF: 260, lock: 0.6 });
  patchIce(ctx, iceM, U);
  const iceG = iceGeometry(); shapeIce(iceG, {}, TUCK, ICE_BASE);
  const ice = new T.Mesh(iceG, iceM); ice.name = 'cup-ice'; g.add(ice);
  // ice crystals: tiny twinkles on the mound (FX points)
  const nS = 22, sp = new Float32Array(nS * 3), ph = new Float32Array(nS);
  for (let i = 0; i < nS; i++) { const a = hsh(i * 3.1) * Math.PI * 2, s = 0.25 + 0.7 * hsh(i * 7.7); sp[i * 3] = a; sp[i * 3 + 1] = s; ph[i] = hsh(i * 5.3) * 6.28; }
  const sparkG = new T.BufferGeometry(); sparkG.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(nS * 3), 3)); sparkG.setAttribute('aPh', new T.Float32BufferAttribute(ph, 1));
  const sparkM = kit.addBlend(new T.ShaderMaterial({ uniforms: { uT: { value: 0 }, uK: { value: 1 }, uPx: { value: 1 } },
    vertexShader: `attribute float aPh; uniform float uT, uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vA = pow(max(0.0, sin(uT * 2.3 + aPh * 3.0)), 6.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(0.0045 / -mv.z * 900.0 * uPx, 2.0, 16.0) * (0.5 + vA); }`,
    fragmentShader: `uniform float uK; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 60.0) + 0.6 * (exp(-abs(q.x) * 40.0) * exp(-abs(q.y) * 6.0) + exp(-abs(q.y) * 40.0) * exp(-abs(q.x) * 6.0));
      gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * a * vA * uK * 1.6, 1.0); }` }));
  ctx.mat.mrt(sparkM, { id: ctx.mat.ID.FX });
  const sparks = new T.Points(sparkG, sparkM); sparks.frustumCulled = false; g.add(sparks);
  // melted: blue water surface inside the cup (ripples, a highlight lens, a reflected shooting star)
  const waterM = mat.cel(0x2c9cff, { hero: true, id: mat.nextId(), shade: 0x1e5fd0, hiAmt: 0.0, spec: 0, bevel: 0.02, rimI: 0.0, lock: 0.92 });
  const wU = { uRip: { value: -1 } }; patchWater(ctx, waterM, wU);
  const wGeo = new T.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const water = new T.Mesh(wGeo, waterM); water.name = 'cup-water'; g.add(water);
  let lastShape = '';
  const api = { group: g, paper, ice, water, sparks, H, R0, R1, U, wU, tex,
    // radius of the paper wall at height y (0..H)
    radiusAt(y) { return R0 + (R1 - R0) * THREE.MathUtils.clamp(y / H, 0, 1); },
    set({ melt = 0, dents = [], level = 0.62, t = 0, sparkle = 1, ripple = -1, warm = 0 } = {}) {
      const key = melt.toFixed(3) + '|' + dents.map(d => [d.a, d.d, d.h].map(v => v.toFixed(3)).join(',')).join(';');
      if (key !== lastShape) { shapeIce(iceG, { melt, dents }, TUCK, ICE_BASE); lastShape = key; }
      ice.visible = melt < 0.985; sparks.visible = ice.visible && sparkle > 0.01;
      U.uWarm.value = warm; wU.uRip.value = ripple;
      // sparkle points on the current mound surface
      const P = sparkG.attributes.position; for (let i = 0; i < nS; i++) { const a = sp[i * 3], s = sp[i * 3 + 1];
        const Hm = CUP.ICE_H * (1 - 0.88 * melt) + 0.004, prof = Math.pow(Math.max(0, 1 - Math.pow(s, 2.1)), 0.62);
        P.setXYZ(i, Math.cos(a) * CUP.ICE_R * s * 1.0, ICE_BASE + Hm * prof + 0.002, Math.sin(a) * CUP.ICE_R * s * 1.0); }
      P.needsUpdate = true; sparkM.uniforms.uT.value = t; sparkM.uniforms.uK.value = sparkle * (1 - melt);
      // melted water: visible once the mound has slumped, level rises a little as the ice turns to water
      water.visible = melt > 0.55; const wy = H * (0.35 + 0.3 * level) * ss(0.55, 1.0, melt) + 0.004;
      const wr = api.radiusAt(wy) * 0.985; water.position.y = wy; water.scale.set(wr, 1, wr);
    },
    // world point of the top of the ice / water (for the spoon)
    top() { return new V3(0, H + CUP.ICE_H, 0); },
    // where the camera sees direction G reflected in the syrup (best syrup-wet vertex), world space
    glintPoint(camPos, G, avoid = null, avoidR = 0.03) {
      ice.updateMatrixWorld(true); const P = iceG.attributes.position, Nn = iceG.attributes.normal, S = iceG.attributes.aSyr;
      const nm = new THREE.Matrix3().getNormalMatrix(ice.matrixWorld), p = new V3(), n = new V3(), v = new V3(), r = new V3(); let best = -2, out = null;
      for (let i = 0; i < P.count; i++) { if (S.getX(i) < 0.3) continue;
        p.fromBufferAttribute(P, i).applyMatrix4(ice.matrixWorld); n.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize();
        v.copy(camPos).sub(p).normalize(); const nv = n.dot(v); if (nv < 0.35) continue; if (avoid && p.distanceTo(avoid) < avoidR) continue;
        r.copy(n).multiplyScalar(2 * nv).sub(v); const sc = r.dot(G) + 0.5 * nv; if (sc > best) { best = sc; out = p.clone().addScaledVector(n, 0.0015); } }
      return out;
    },
    pxScale(px) { sparkM.uniforms.uPx.value = px; },
  };
  api.set({});
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// spoon-straw (kakigori spoon straw): a striped straw with a flat spoon bowl. Local frame: grip at the origin,
// +y runs to the bowl tip (L), the bowl opens toward +z.
export function makeSpoon(ctx) {
  const { THREE: T, mat, kit } = ctx;
  const g = new T.Group(); g.name = 'spoon-straw';
  const L = 0.215, r = 0.0055, back = 0.012;   // back = straw end hidden inside the nub
  const tube = new T.Mesh(new T.CylinderGeometry(r, r, L - 0.03 + back, 10, 1, false).translate(0, (L - 0.03 - back) / 2, 0),
    mat.cel(0xffffff, { hero: true, id: mat.nextId(), map: stripeTexture(kit), bevel: 0.004, spec: 0.5, hiAmt: 0.6 }));
  // bowl: a flattened, slightly cupped spade (the hollow opens toward +z)
  const bowlG = new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5); bowlG.rotateX(-Math.PI / 2);
  bowlG.scale(0.013, 0.019, 0.0045); bowlG.translate(0, L - 0.017, 0);
  const pink = mat.cel(0xff6f9a, { hero: true, id: mat.nextId(), bevel: 0.004, spec: 0.3, hiAmt: 0.5, side: T.DoubleSide });
  const bowl = new T.Mesh(bowlG, pink);
  // a bite of shaved ice heaped in the bowl (shown after a scoop): a granular clumpy heap, blue syrup on top
  const biteG = new T.SphereGeometry(1, 28, 18), bp = biteG.attributes.position, col = [], syr = [];
  for (let i = 0; i < bp.count; i++) { let x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const lump = 1 + 0.2 * (vn2(x * 3.1 + z * 2.3 + 1.7, y * 3.3 - z * 1.9) - 0.5) + 0.12 * (vn2(x * 7.7 - y * 2.1, z * 6.9 + y * 5.3 + 3.1) - 0.5);
    x *= 0.0118 * lump; y *= 0.0158 * lump; z = Math.max(z * 0.0105 * lump, -0.0034) - 0.0006;
    bp.setXYZ(i, x, y + L - 0.017, z);
    const k = ss(0.003, 0.008, z + 0.15 * y + 0.0015 * Math.sin(x * 900));
    col.push(1, 1, 1); syr.push(k); }
  biteG.setAttribute('color', new T.Float32BufferAttribute(col, 3)); biteG.setAttribute('aSyr', new T.Float32BufferAttribute(syr, 1)); biteG.computeVertexNormals();
  const biteM = mat.cel(0xffffff, { hero: true, id: mat.nextId(), vertexColors: true, shade: 0xaebfee, hiAmt: 0.0, spec: 0, bevel: 0.004, rimI: 0.2, brush: 0.14, brushF: 900, lock: 0.6 });
  patchIce(ctx, biteM, { uWarm: { value: 0 }, uDeepY: { value: 9 } });
  const bite = new T.Mesh(biteG, biteM);
  g.add(tube, bowl, bite);
  return { group: g, bite, tube, bowl, L, grip: new V3(0, 0, 0), tip: new V3(0, L - 0.012, 0), set({ bite: b = 0 } = {}) { bite.visible = b > 0.5; } };
}

// ---------------------------------------------------------------------------------------------------------------------
// iron pier ladder on the end face of the pier (z = zFace, facing +z), centred on x; grab rails curve over onto the deck
export function makeLadder(ctx, { x = 0, zFace = 0, deckY = 2.2, bottom = -0.8, half = 0.3 } = {}) {
  const { THREE: T, mat } = ctx;
  const g = new T.Group(); g.name = 'pier-ladder';
  const iron = mat.cel(0x4a5060, { id: mat.nextId(), spec: 0.7, bevel: 0.02, hiAmt: 0.5 }), rust = mat.cel(0x9a5a3a, { id: mat.nextId(), bevel: 0.02 });
  const zr = zFace + 0.07;
  for (const sx of [-1, 1]) {
    const pts = [new V3(sx * half, bottom, zr), new V3(sx * half, deckY + 0.05, zr), new V3(sx * half, deckY + 0.22, zr - 0.02), new V3(sx * half, deckY + 0.28, zr - 0.14),
      new V3(sx * half, deckY + 0.2, zr - 0.27), new V3(sx * half, deckY + 0.02, zr - 0.3)];
    const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
    g.add(new T.Mesh(new T.TubeGeometry(curve, 48, 0.015, 8, false), iron));
    // brackets bolted to the pier face
    for (const y of [deckY - 0.25, deckY - 1.2]) { const b = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.08), iron); b.position.set(sx * half, y, zFace + 0.035); g.add(b); }
    const foot = new T.Mesh(new T.CylinderGeometry(0.04, 0.045, 0.025, 12), iron); foot.position.set(sx * half, deckY + 0.012, zr - 0.3); g.add(foot);
  }
  for (let y = deckY - 0.18, i = 0; y > bottom + 0.1; y -= 0.26, i++) {
    const rung = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, half * 2, 8).rotateZ(Math.PI / 2), i % 3 === 2 ? rust : iron); rung.position.set(0, y, zr); g.add(rung);
  }
  g.position.x = x; g.userData.rails = { half, zr, deckY };
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------
// the glint in the syrup (s04): a small painted reflection of the summer sky on the wet syrup (pale blue lens, white rim,
// a cloud) and, inside it, the meteor: a white-hot head with an orange tail that flares at CUES.glint. Two sprites in the
// overlay scene at the syrup point that reflects the meteor's sky direction; size in px @1080.
export function makeGlint(ctx) {
  const { THREE: T, kit } = ctx;
  const patchTex = kit.canvasTex(256, 256, (c, w, h) => {
    c.save(); c.translate(w / 2, h / 2); c.rotate(-0.25);
    c.fillStyle = '#4f9cff'; c.beginPath(); c.ellipse(0, 0, 104, 56, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9fd2ff'; c.beginPath(); c.ellipse(-6, -10, 90, 38, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-40, 14, 30, 13, 0, 0, Math.PI * 2); c.ellipse(-14, 18, 22, 11, 0, 0, Math.PI * 2); c.fill();   // a cumulus
    c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.ellipse(0, 0, 100, 52, 0, Math.PI * 1.08, Math.PI * 1.62); c.stroke();
    c.restore();
  }, { srgb: true });
  const streakTex = kit.canvasTex(256, 256, (c, w, h) => {
    c.save(); c.translate(w / 2, h / 2); c.rotate(-0.62);
    const g = c.createLinearGradient(-8, 0, 118, 0); g.addColorStop(0, 'rgba(255,190,90,1)'); g.addColorStop(0.5, 'rgba(255,120,40,0.7)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-8, -13); c.quadraticCurveTo(55, -4, 124, 0); c.quadraticCurveTo(55, 4, -8, 13); c.closePath(); c.fill();
    c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }, { srgb: false });
  const pm = ctx.mat.overlay({ color: 0xffffff, k: 1.0, map: patchTex, additive: false, soft: 0.02 });
  const sm = ctx.mat.overlay({ color: 0xffffff, k: 2.0, map: streakTex, additive: true, soft: 0.02 });
  const mk = (m, o) => { const s = new T.Mesh(new T.PlaneGeometry(1, 1), m); s.frustumCulled = false; s.visible = false; s.renderOrder = o; ctx.overlay.add(s); return s; };
  const patch = mk(pm, 50), streak = mk(sm, 51);
  return { mesh: streak, set(pos, k, camera, px = 150, sky = 1) {
    patch.visible = streak.visible = !!pos && sky > 0.01; if (!patch.visible) return;
    const d = camera.position.distanceTo(pos), wpp = 2 * d * Math.tan(camera.fov * Math.PI / 360) / 1080;   // metres per pixel @1080
    for (const s of [patch, streak]) { s.position.copy(pos).addScaledVector(camera.position.clone().sub(pos).normalize(), Math.min(0.01, d * 0.05)); s.quaternion.copy(camera.quaternion); }
    patch.scale.set(px * wpp, px * wpp * 0.8, 1); pm.uniforms.uOp.value = 0.92 * sky;
    streak.visible = k > 0.01; streak.scale.setScalar(px * wpp * (0.5 + 0.75 * Math.min(1.3, k))); sm.uniforms.uK.value = 1.5 + 4.5 * Math.min(1.4, k); sm.uniforms.uOp.value = Math.min(1, k * 1.5); } };
}

// ---------------------------------------------------------------------------------------------------------------------
// anime speed FX in the overlay scene (drawn after ink), redrawn on twos:
//   makeFocusLines(ctx) -> { set(k, camera, seed, { cx, cy, hole }) }   集中線: thin wedges from the frame edges toward a
//                          clear centre (impact / thrust frames); two drawings alternate on twos
//   makeStreaks(ctx, n)  -> { set(k, camera, centre, vel, radius, seed) } motion streaks trailing behind a moving body
function focusTex(kit, seed) {
  return kit.canvasTex(1024, 576, (c, w, h) => {
    let s = seed; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, r0 = 0.64 + R() * 0.24, wid = 0.002 + R() * 0.006, al = 0.4 + R() * 0.45;
      const ex = Math.cos(a), ey = Math.sin(a) * 0.62, far = 1.5;
      c.fillStyle = `rgba(255,255,255,${al})`; c.beginPath();
      c.moveTo(w / 2 + ex * r0 * w * 0.5, h / 2 + ey * r0 * w * 0.5);
      c.lineTo(w / 2 + (ex * far - ey * wid * 6) * w * 0.5, h / 2 + (ey * far + ex * wid * 6) * w * 0.5);
      c.lineTo(w / 2 + (ex * far + ey * wid * 6) * w * 0.5, h / 2 + (ey * far - ex * wid * 6) * w * 0.5); c.closePath(); c.fill(); }
  }, { srgb: false });
}
export function makeFocusLines(ctx) {
  const { THREE: T, kit } = ctx, texs = [focusTex(kit, 71), focusTex(kit, 913)];
  const m = ctx.mat.overlay({ color: 0xffffff, k: 1.0, map: texs[0], additive: false, soft: 0.0001 });
  const s = new T.Mesh(new T.PlaneGeometry(1, 1), m); s.frustumCulled = false; s.visible = false; s.renderOrder = 60; ctx.overlay.add(s);
  return { mesh: s, set(k, camera, seed = 0, { cx = 0, cy = 0 } = {}) {
    s.visible = k > 0.01; if (!s.visible) return;
    m.uniforms.map.value = texs[seed & 1]; m.uniforms.uOp.value = Math.min(1, k);
    const d = camera.near * 4, hh = 2 * d * Math.tan(camera.fov * Math.PI / 360), ww = hh * camera.aspect;
    s.position.copy(camera.position).add(new T.Vector3(cx * ww * 0.5, cy * hh * 0.5, -d).applyQuaternion(camera.quaternion));
    s.quaternion.copy(camera.quaternion); s.scale.set(ww * 1.25, hh * 1.25 * 1.0, 1); } };
}
export function makeStreaks(ctx, n = 7) {
  const { THREE: T, kit } = ctx;
  const tex = kit.canvasTex(256, 32, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, h * 0.2); c.lineTo(w, h * 0.48); c.lineTo(w, h * 0.52); c.lineTo(0, h * 0.8); c.closePath(); c.fill(); }, { srgb: false });
  const geo = new T.PlaneGeometry(1, 1).translate(0.5, 0, 0), list = [];
  for (let i = 0; i < n; i++) { const m = ctx.mat.overlay({ color: 0xffffff, k: 1.1, map: tex, additive: false, soft: 0.02 }); const s = new T.Mesh(geo, m); s.frustumCulled = false; s.visible = false; s.renderOrder = 55; ctx.overlay.add(s); list.push(s); }
  const X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3(), M = new T.Matrix4();
  return { set(k, camera, centre, vel, radius = 0.15, seed = 0) {
    list.forEach((s, i) => { s.visible = k > 0.01 && !!centre; if (!s.visible) return;
      X.copy(vel).normalize().negate(); const toCam = camera.position.clone().sub(centre).normalize();
      Y.crossVectors(toCam, X).normalize(); Z.crossVectors(X, Y);
      const r1 = hsh(i * 7.1 + seed * 3.3) - 0.5, r2 = hsh(i * 2.9 + seed * 5.7);
      const start = centre.clone().addScaledVector(Y, r1 * radius * 2.2).addScaledVector(X, radius * (0.6 + 0.5 * r2));
      M.makeBasis(X, Y, Z); s.quaternion.setFromRotationMatrix(M); s.position.copy(start);
      s.scale.set(radius * (2.5 + 3.5 * hsh(i * 4.3 + seed)) * k, radius * 0.1, 1); s.material.uniforms.uOp.value = Math.min(1, k); }); } };
}

// ---------------------------------------------------------------------------------------------------------------------
// water drips: drops that slide off soaked Clawd and fall (pure function of t; on threes). sources = world points.
export function makeDrips(ctx, n = 24) {
  const { THREE: T } = ctx;
  const g = new T.Group(); g.name = 'drips';
  const m = ctx.mat.cel(0xd6f2ff, { hero: true, id: ctx.mat.ID.NOINK + 7, ink: false, shade: 0x7fb4e8, hiAmt: 0.6, hiT: 0.4, spec: 0, rimI: 0 });
  const dropG = new T.SphereGeometry(1, 10, 8); { const p = dropG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setXYZ(i, p.getX(i) * (1 - 0.45 * Math.max(0, y)), y * (y > 0 ? 1.9 : 1), p.getZ(i) * (1 - 0.45 * Math.max(0, y))); } dropG.computeVertexNormals(); }   // teardrop
  const drops = []; for (let i = 0; i < n; i++) { const d = new T.Mesh(dropG.clone().scale(0.006, 0.006, 0.006), m); g.add(d); drops.push(d); }
  return { group: g, set(t, sources, k = 1, floorY = -1e9) {
    const ft = ctx.onThrees(t);
    drops.forEach((d, i) => { const src = sources[i % sources.length]; const per = 0.55 + 0.45 * hsh(i * 3.7), ph = hsh(i * 9.1) * per;
      const lt = ((ft + ph) % per) / per, fall = lt * per;   // seconds since the drop detached
      const y = src.y - 0.5 * 9.8 * fall * fall * 0.6;
      d.visible = k > hsh(i * 1.3) && y > floorY; d.position.set(src.x + (hsh(i * 2.1) - 0.5) * 0.06, y, src.z + (hsh(i * 4.4) - 0.5) * 0.06);
      d.scale.set(1, 1 + fall * 2.5, 1); });
  } };
}
