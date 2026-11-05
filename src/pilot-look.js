// MEGA CLAWD · PILOT look (owner: pilot) — little Clawd's cel finish, applied on top of the engine toonClawd
// (src/pipeline-materials.js) through ctx.glsl.patchShader + uniforms, so the engine material stays untouched:
//   * hard 2-tone cel: no brush noise and no self-shadow on the terminator, one flat cool lavender shadow tone (no ground
//     bounce band), no airbrushed spec streaks, a hard-edged rim
//   * ONE crisp painted highlight: a tapered lens on the bevel that faces the key light (object space, rides with the
//     body) + a short sliver on top of each nub
//   * hand-inked outline: an inverted hull whose width follows Clawd's size on screen (~2.5 px wide shots, 7-8 px in CU),
//     thicker on the shadow side, with a slow world-anchored pressure wobble; the engine ink still draws the inner lines
//   * face decals write the body's id (7) + their surface normal into the data buffer, so the ink pass never sees an edge
//     around them (no stitched / dotted rims; their own shapes are the drawing)
//   * wet (s35, s12): flat white cel streaks on the lit bevel + slanted dashes on the upper corner (no glass beads)
// API  clawdLook(ctx, { clawd, toon }) -> { update(camera, { ink, inkCol, hiOn }), face: { [name]: material }, ink: material }
import * as THREE from 'three';

const V3 = THREE.Vector3;
export const LOOK_PAL = { shade: 0x9e5a66, ink: 0x2e1712, hi: 0xffe6d2 };

// candidate bevels of the rounded body (object space): normal of the bevel middle + the edge axis
const BEVELS = [
  [[0, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 0, 1]], [[-1, 1, 0], [0, 0, 1]], [[0, 1, -1], [1, 0, 0]],
  [[1, 0, 1], [0, 1, 0]], [[-1, 0, 1], [0, 1, 0]],
].map(([n, t]) => ({ n: new V3(...n).normalize(), t: new V3(...t) }));

export function clawdLook(ctx, { clawd, toon }) {
  const mats = toon.materials, body = toon.bodyMesh;
  body.geometry.computeBoundingBox();
  const FILL0 = mats.body.uniforms.uFill.value.clone();   // the engine's shadow fill (s26 swaps in a red-lavender one)
  const bb = body.geometry.boundingBox, C0 = bb.getCenter(new V3()), SX = bb.max.x - bb.min.x;
  const U = {
    uPhN: { value: new V3(0, 1, 1).normalize() }, uPhT: { value: new V3(1, 0, 0) }, uPhC: { value: C0.clone() }, uPhS: { value: SX },
    uPhU0: { value: 0.15 }, uPhLen: { value: 0.22 }, uPhW: { value: 0.045 }, uPhOn: { value: 1 }, uPhCol: { value: new THREE.Color(LOOK_PAL.hi) },
  };
  // ---- the cel finish (all three Clawd materials) ------------------------------------------------------------------
  for (const [part, m] of Object.entries(mats)) {
    Object.assign(m.uniforms, U);
    m.uniforms.uBrush.value = 0; m.uniforms.uRecv.value = 0; m.uniforms.uSpec.value = 0; m.uniforms.uHiAmt.value = 0;
    m.uniforms.uSoft.value = 0.004; m.uniforms.uShade.value.set(LOOK_PAL.shade); m.uniforms.uPtK.value = 0.45; m.uniforms.uLock.value = 0.72;
    ctx.glsl.patchShader(m, 'pilotCel_' + part, (sh) => {
      let fs = sh.fragmentShader;
      const rep = (a, b) => { if (!fs.includes(a)) console.warn('pilot-look: patch anchor missing', a.slice(0, 40)); fs = fs.replace(a, b); };
      // one flat shade tone (no ground-bounce band on the undersides)
      rep('uMask < 0.5 ? smoothstep(0.22, 0.3, hy) : hy', '1.0');
      // hard rim (no soft fresnel ramp across flat faces)
      rep('float rim = smoothstep(uRimW - 0.04, uRimW + 0.04, fr + br * 0.3) * smoothstep(0.0, 0.25, dot(N, uRimDir));',
        `float rimE = fr - uRimW, rimA = fwidth(fr) + 1e-4, rimD = dot(N, uRimDir);
         float rim = smoothstep(-rimA, rimA, rimE) * smoothstep(0.1, 0.1 + fwidth(rimD) + 0.004, rimD);`);
      const HI = part === 'body' ? /* glsl */`
        { // one painted highlight: a tapered lens on the bevel that faces the key (object space)
          float d = 1.0 - dot(normalize(vON), uPhN);
          float u = (dot(vO - uPhC, uPhT) / uPhS - uPhU0) / uPhLen;
          float w = uPhW * max(0.0, 1.0 - u * u) * (1.0 - 0.45 * smoothstep(-0.2, 1.0, u));
          float e = w - d, ea = fwidth(e) * 0.75 + 1e-5;
          float hl = smoothstep(-ea, ea, e) * step(0.5, lit) * uPhOn;
          // a small separate dot past the thin end (the classic anime "kira")
          float u2 = (dot(vO - uPhC, uPhT) / uPhS - uPhU0 - uPhLen * 1.45) / (uPhLen * 0.16);
          float e2 = uPhW * 0.55 * max(0.0, 1.0 - u2 * u2) - d, ea2 = fwidth(e2) * 0.75 + 1e-5;
          hl = max(hl, smoothstep(-ea2, ea2, e2) * step(0.5, lit) * uPhOn);
          col = mix(col, uPhCol * keyL, hl);
        }` : part === 'arm' ? /* glsl */`
        { // nub: a short crisp sliver where the nub barrel faces the key + viewer
          vec3 Hn = normalize(KD + V); float u = vO.x / 0.08;
          float e = dot(N, Hn) - (0.93 + 0.07 * u * u), ea = fwidth(e) * 0.75 + 1e-5;
          col = mix(col, uPhCol * keyL, smoothstep(-ea, ea, e) * step(0.5, lit) * step(abs(u), 0.95) * uPhOn);
        }` : '';
      rep('col += uRimCol * rim * uRimI * base * 1.6;', 'col += uRimCol * rim * uRimI * base * 1.6;\n' + HI);
      // wet: flat white cel streaks instead of glass beads
      rep('float bead = step(1.0 - uWetDen * uWet, hh) * onFace;', 'float bead = 0.0;');
      if (part === 'body') rep('col = mix(col, bc, inB);', /* glsl */`col = mix(col, bc, inB);
        { vec3 q = (vO - uPhC) / uPhS; float side = sign(dot(uPhT, vec3(1.0, 0.0, 0.0)) * uPhU0 + 1e-3);
          // dashed white line along the top-front bevel
          float d = 1.0 - dot(normalize(vON), normalize(vec3(0.0, 1.0, 1.0)));
          float dash = step(0.42, fract(q.x * 6.5 + 0.2)) * (1.0 - smoothstep(0.38, 0.46, abs(q.x)));
          float ln = smoothstep(0.018, 0.012, d) * dash;
          // two slanted dashes on the upper key-side corner of the front face + a short run down the side edge
          vec2 fp = vec2(q.x * side, q.y); vec2 c0 = fp - vec2(0.36, 0.2);
          float dl = dot(c0, vec2(0.7071, -0.7071)), al = dot(c0, vec2(0.7071, 0.7071));
          float s1 = smoothstep(0.016, 0.01, abs(dl)) * smoothstep(0.075, 0.055, abs(al));
          float s2 = smoothstep(0.012, 0.007, abs(dl + 0.045)) * smoothstep(0.035, 0.022, abs(al + 0.012));
          float front = step(0.75, vON.z);
          col = mix(col, vec3(1.04, 1.02, 1.0) * max(keyL, vec3(0.7)), clamp(ln + front * (s1 + s2), 0.0, 1.0) * uWet);
        }`);
      sh.fragmentShader = fs;
      sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 uBase,', 'uniform vec3 uPhN, uPhT, uPhC, uPhCol; uniform float uPhS, uPhU0, uPhLen, uPhW, uPhOn;\nuniform vec3 uBase,');
    });
  }

  // ---- ink hull ------------------------------------------------------------------------------------------------------
  const inkU = { uPx: { value: 3 }, uRes: { value: new THREE.Vector2(ctx.W, ctx.H) }, uCol: { value: new THREE.Color(LOOK_PAL.ink) }, uKD: ctx.light.u.uHeroDir };
  const ink = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: inkU,
    vertexShader: /* glsl */`uniform float uPx; uniform vec2 uRes; uniform vec3 uKD;
      float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0); vec3 nw = normalize(mat3(modelMatrix) * normal);
        vec4 c = projectionMatrix * viewMatrix * w, cn = projectionMatrix * viewMatrix * vec4(w.xyz + nw * 0.02, 1.0);
        vec2 d = cn.xy / cn.w - c.xy / c.w; d.x *= uRes.x / uRes.y; float L = length(d); d = L > 1e-7 ? d / L : vec2(0.0); d.x *= uRes.y / uRes.x;
        // brush pressure: heavier on the shadow side and underneath, a slow wobble anchored to the body
        float sh = smoothstep(-0.35, 0.65, -dot(nw, normalize(uKD)));
        float pr = 0.78 + 0.44 * vn(position * 2.3 + 1.7);
        float wpx = uPx * mix(0.6, 1.3, sh) * pr;
        c.xy += d * (wpx * 2.0 / uRes.y) * c.w; gl_Position = c; }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 0.0); }` });
  ctx.mat.mrt(ink, { id: ctx.mat.ID.NOINK + 2 });
  const hulls = [];
  for (const m of toon.meshes) { const h = new THREE.Mesh(m.geometry, ink); h.name = m.name + '_ink'; h.raycast = () => {}; h.userData.noSolid = true; m.add(h); hulls.push(h); }

  // ---- face decals: body id + surface normal in the data buffer (no ink edges around them), tinted by the light ----
  const tint = { value: new THREE.Color(1, 1, 1) }, face = {};
  for (const [name, em] of Object.entries(toon.face)) {
    const m = new THREE.MeshBasicMaterial({ color: em.color.clone(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    m.onBeforeCompile = (sh) => { sh.uniforms.uTint = tint; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uTint;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb *= uTint; gl_FragColor.a = 0.0;'); };
    m.customProgramCacheKey = () => 'pilotFace';
    face[name] = ctx.mat.mrt(m, { id: 7, normal: 'normalize(cross(dFdx(vMrtVP), dFdy(vMrtVP)))' });
  }
  const swap = new Map(Object.entries(toon.face).map(([k, v]) => [v, face[k]]));
  clawd.root.traverse(o => { if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material); });

  // ---- per frame (after the camera): ink width from the screen size, highlight bevel, face tint ----------------------
  const _b = new THREE.Box3(), _v = new V3(), _q = new THREE.Quaternion(), _p = new V3(), _n = new V3();
  const faceNode = clawd.nodes?.face;
  function screenHeight(camera) {   // body height on screen, px @1080
    body.updateMatrixWorld(true); _b.copy(bb).applyMatrix4(body.matrixWorld);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 8; i++) { _v.set(i & 1 ? _b.max.x : _b.min.x, i & 2 ? _b.max.y : _b.min.y, i & 4 ? _b.max.z : _b.min.z).project(camera);
      if (_v.z > 1) return 0; lo = Math.min(lo, _v.y); hi = Math.max(hi, _v.y); }
    return (hi - lo) * 0.5 * 1080;
  }
  return {
    face, ink, hulls,
    update(camera, { ink: inkK = 1, inkCol = null, hiOn = 1, glow = 0, fill = null, lock = 0.72 } = {}) {
      for (const m of Object.values(mats)) { m.uniforms.uFill.value.copy(fill != null ? new THREE.Color(fill) : FILL0); m.uniforms.uLock.value = lock; }
      const hPx = screenHeight(camera);
      inkU.uPx.value = Math.min(8.0, Math.max(2.3, 1.3 + hPx * 0.0075)) * inkK * (ctx.H / 1080);
      inkU.uRes.value.set(ctx.W, ctx.H);
      inkU.uCol.value.set(inkCol ?? LOOK_PAL.ink);
      // highlight: the bevel whose normal best faces the half vector (lit + visible), offset along its edge toward the key
      body.updateMatrixWorld(true); body.getWorldQuaternion(_q); const inv = _q.clone().invert();
      const KD = ctx.light.u.uHeroDir.value.clone().applyQuaternion(inv).normalize();
      const Vw = camera.position.clone().sub(body.getWorldPosition(_v)).normalize(), Vl = Vw.applyQuaternion(inv);
      const H = KD.clone().add(Vl).normalize();
      let best = null, bs = -1;
      for (const b of BEVELS) { const kd = b.n.dot(KD), vv = b.n.dot(Vl); if (kd < 0.3 || vv < 0.15) continue; const s = b.n.dot(H) + 0.15 * (b.n.y > 0.5 ? 1 : 0); if (s > bs) { bs = s; best = b; } }
      U.uPhOn.value = best && hiOn ? 1 : 0;
      if (best) { U.uPhN.value.copy(best.n); U.uPhT.value.copy(best.t); U.uPhU0.value = (KD.dot(best.t) >= 0 ? 1 : -1) * 0.13; }
      // face decal tint = the light on the face (same rule as the engine), never brighter than 1
      if (faceNode) { faceNode.getWorldPosition(_p); faceNode.getWorldQuaternion(_q); _n.set(0, 0, 1).applyQuaternion(_q);
        const L = ctx.light.lightAt(_p, _n, true).add(mats.body.uniforms.uFill.value), mx = Math.max(L.r, L.g, L.b, 1e-4);
        tint.value.copy(L).multiplyScalar(Math.min(1, mx) / mx).lerp(new THREE.Color(1, 1, 1).multiplyScalar(Math.min(1, mx)), 0.45);
        tint.value.lerp(new THREE.Color(1, 0.86, 0.7), Math.min(1, glow) * 0.8); }
    },
  };
}
