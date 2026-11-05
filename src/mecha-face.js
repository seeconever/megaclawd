// MEGA CLAWD · visor face display (owner: mecha). Clawd's own face parts (src/assets/clawd, the emotion library) re-used as
// glowing amber shapes behind the dark visor glass: the same eyes / brows / mouths as the mascot, so every emotion reads
// as "that's Clawd". createFace(ctx, { scale }) -> { group, set(emotion, opts), pose(o), power(k) }.
//   set('neutral') | set('happy', { mix: 'gentle', t: 0.5 }); pose({ blink, lookX, lookY }); power(0..1.5) = brightness
import * as THREE from 'three';

const AMBER = 0xffa53a;
// mascot face material -> display colour, gain. The shapes sit just above the bloom threshold (1.0-1.05 in every look):
// a crisp drawn core with a narrow glow, never a blown-out blob. The power multiplier is capped at 1.12 in power().
const LUT = {
  clawd_ink: [AMBER, 1.12], clawd_shine: [0xfff3d6, 1.25], clawd_white: [0xffc070, 0.7], clawd_mouth: [0xff8c30, 1.05], clawd_tongue: [0xff6a40, 1.0],
  clawd_tongue_line: [0xffb070, 1.1], clawd_blush: [0xff7050, 0.6], clawd_heart: [0xff5a78, 1.1], clawd_water: [0x8fe6ff, 1.0],
};

export async function createFace(ctx, { scale = 120, depth = 6 } = {}) {
  const { clawd } = await ctx.loadClawd({ toon: false });
  const face = clawd.nodes.face; face.removeFromParent();
  const group = new THREE.Group(); group.name = 'mecha-face'; group.add(face);
  face.position.set(0, 0, 0); face.scale.set(scale, scale, depth);
  const byMat = new Map(Object.entries(clawd.materials).map(([k, v]) => [v, k]));
  const mats = {};
  // display shader: HDR amber with fine scanlines along the body's up axis (fade out when too small on screen) and a
  // faint refresh band rolling down on threes, so the shapes read as a lit screen behind the glass, not as stickers
  const U = { uUp: { value: new THREE.Vector3(0, 1, 0) }, uOrg: { value: new THREE.Vector3() }, uT: { value: 0 } };
  const mk = (key) => { const [c, k] = LUT[key] || [AMBER, 2];
    const m = new THREE.ShaderMaterial({ uniforms: { ...U, uCol: { value: new THREE.Color(c) }, uK: { value: k }, uLine: { value: 0.95 } },
      vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform vec3 uCol, uUp, uOrg; uniform float uK, uLine, uT; varying vec3 vW;
        void main(){ float h = dot(vW - uOrg, uUp), px = (fwidth(h) + 1e-4) / uLine;
          float s = abs(fract(h / uLine) - 0.5) * 2.0, dark = smoothstep(0.62 - px, 0.78 + px, s) * (1.0 - smoothstep(0.18, 0.45, px));
          float band = 1.0 + 0.22 * smoothstep(0.88, 1.0, fract(h * 0.011 - uT * 0.5));
          gl_FragColor = vec4(uCol * uK * (1.0 - 0.3 * dark) * band, 1.0); }` });
    m.userData.k0 = k; return ctx.mat.mrt(m, { id: ctx.mat.ID.FX }); };
  face.traverse(o => { if (!o.isMesh) return; const key = byMat.get(o.material) || 'clawd_ink'; o.material = mats[key] ||= mk(key); o.castShadow = o.receiveShadow = false; o.frustumCulled = false; o.userData.noSolid = true; });
  let pw = 1, cur = null;
  const api = { group, clawd,
    set(emotion, opts = {}) { const key = emotion + JSON.stringify(opts); if (key !== cur) { clawd.setEmotion(emotion, opts); cur = key; } },
    pose(o = {}) { clawd.pose(o); },
    power(k) { pw = k; for (const m of Object.values(mats)) m.uniforms.uK.value = m.userData.k0 * Math.min(k, 1.12); face.visible = k > 0.02; },
    // scanline frame: body up axis + a point on the visor (world), display time (on threes)
    frame(up, org, t) { U.uUp.value.copy(up); U.uOrg.value.copy(org); U.uT.value = t; },
    get level() { return pw; } };
  api.power(1);
  return api;
}
