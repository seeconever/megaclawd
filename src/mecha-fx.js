// MEGA CLAWD · mecha FX (owner: mecha). Everything that hangs off, pours off or rises off the giant:
//   kelp        cel ribbons (inked, double-sided): float up under water, hang and drip in the bay, gone after the launch
//   barnacles   instanced cel bumps clustered on the lower plates and feet (bay scenes only)
//   water       sheets running down the armour + free-falling streams from the overhangs (on threes, fade as it drains)
//   steam       anime smoke "hooks": two-tone curled puffs that rise, grow and erode (cooling armour, s31 s33-s35)
//   silt        sandy clouds rolling along the bay floor (under), a burst when the reactor ignites, swirls off the visor
//               when the eyes light (s11), bubbles (under API) + a small fish school at the visor for scale
//   trails      tapered blue thruster trails from the soles (sky / strato), down to the sea in the launch
//   contact     the grip on the meteor (s24-s28): rock crumbs packed round every fingertip, chips flying off, dust, a dark
//               contact shadow on the rock, sparks (fx-energy), cracks running out from the fingers in the push (s28)
//   water       s19 sole glow through the surf + a boiling foam ring + steam; s20 the dark shock ring on the sea with a white
//               rim and spray mist, a water column dragged up behind the soles; s34 ripples + foam rings at every entry point
//   air         drawn cloud wisps streaming past the climb (s21), speed lines (s28 push, s31 fall)
// createMechaFX(ctx, R, M) -> { update(t, shot, c, api), afterCamera(t, shot), hideAll(), dispose() }
import * as THREE from 'three';
import { bandZ, bandX, cylS } from './mecha-kit.js';

const V3 = THREE.Vector3, PI = Math.PI;
const SITE = { x: 0, z: 225 };          // the coast stance point (mecha.js SITE)
const arr = (v) => [v.x, v.y, v.z];

export function createMechaFX(ctx, R, M) {
  const { kit, mat, util } = ctx;
  const { clamp, lerp, sstep, hash } = util;
  const G = new THREE.Group(); G.name = 'mecha-fx'; ctx.scene.add(G);
  const rnd = (i, s = 0) => hash(i * 12.9898 + s * 78.233);

  // =================================================================================================================
  // KELP
  // =================================================================================================================
  // kelp grows in CLUSTERS (2-4 ribbons from one holdfast, mixed lengths / leans / sway phases), never a comb
  const kelpAnchors = [];
  const ka = (parent, p, n, len, w, lean = 0, ph = 0) => kelpAnchors.push({ parent, p: new V3(...p), n: new V3(...n).normalize(), len, w, lean, ph });
  const cluster = (parent, p, n, seed, scale = 1) => { const m = 2 + Math.floor(rnd(seed, 1) * 2.99);
    for (let j = 0; j < m; j++) { const r = rnd(seed, 10 + j), r2 = rnd(seed, 20 + j);
      ka(parent, [p[0] + (r - 0.5) * 2.4, p[1] + (r2 - 0.5) * 1.6, p[2]], n, scale * (5 + 17 * Math.pow(rnd(seed, 30 + j), 1.4)), 1.1 + 1.2 * r2, (r - 0.5) * 1.1, r * 6.28 + seed); } };
  // front: under the visor (clear of the cheek guards) and along the brow; uneven spacing
  [[-27, 3], [-9, 5], [4, 6], [23, 7]].forEach(([x, s], i) => cluster(R.body, [x + (rnd(i, 3) - 0.5) * 5, -20.6, 38.6], [0, -0.3, 1], s));
  [[-38, 11], [-14, 12], [19, 13], [33, 14]].forEach(([x, s], i) => { if (rnd(i, 4) < 0.75) cluster(R.body, [x, 30.5, 38.8], [0, 0.2, 1], s, 0.8); });
  for (const sx of [-1, 1]) {
    [[-17, 21], [-2, 22], [14, 23]].forEach(([z, s]) => cluster(R.body, [sx * 62.2, 18 + 6 * rnd(s, sx), z + (rnd(s, 2) - 0.5) * 6], [sx, 0, 0], s + sx * 7));
    [[-12, 31], [9, 32]].forEach(([z, s]) => cluster(R.body, [sx * 62.6, -47, z], [sx, -0.6, 0], s + sx * 5, 0.7));
  }
  for (const A of R.arms) [[-0.6, 41], [1.1, 42]].forEach(([a, s]) => cluster(A.fore, [9 + 6 * rnd(a, 7), -14.4 * Math.cos(a), 14.4 * Math.sin(a)], [0, -Math.cos(a), Math.sin(a)], s, 0.8));
  for (const L of R.legs) if (rnd(L.sx + L.sz * 3, 5) > 0.35) cluster(L.thigh, [0, -2, 12.6], [0, 0, 1], 50 + L.sx + L.sz * 2, 0.6);
  const NK = 9, kelp = kelpAnchors.map((k, i) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NK + 1) * 2 * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((NK + 1) * 2 * 3), 3));
    const idx = []; for (let j = 0; j < NK; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    const m = new THREE.Mesh(g, M.kelp); m.frustumCulled = false; m.userData.noSolid = true; G.add(m); return { ...k, mesh: m, seed: i * 1.731 };
  });
  const _a = new V3(), _n = new V3(), _q = new THREE.Quaternion();
  function updateKelp(ct, mode, k) {
    for (const s of kelp) {
      s.mesh.visible = k > 0.01; if (!s.mesh.visible) continue;
      s.parent.updateMatrixWorld(true); _a.copy(s.p).applyMatrix4(s.parent.matrixWorld); s.parent.getWorldQuaternion(_q); _n.copy(s.n).applyQuaternion(_q);
      const pos = s.mesh.geometry.attributes.position.array, nor = s.mesh.geometry.attributes.normal.array;
      const grav = mode === 'under' ? new V3(0.15, 1, 0.05).normalize() : new V3(0, -1, 0);
      const side0 = new V3().crossVectors(_n, grav); if (side0.lengthSq() < 1e-3) side0.set(1, 0, 0); side0.normalize();
      let p = _a.clone().addScaledVector(_n, 0.6), dir = _n.clone();
      const seg = s.len * k / NK, pts = [];
      for (let j = 0; j <= NK; j++) {
        pts.push(p.clone());
        const f = j / NK, sw = mode === 'under' ? 0.55 * Math.sin(ct * (1.1 + 0.5 * rnd(s.seed, 8)) + s.ph + j * 0.55) : 0.18 * Math.sin(ct * 1.1 + s.ph + j * 0.4);
        dir.lerp(grav, mode === 'under' ? 0.35 : 0.55).addScaledVector(side0, sw * f + s.lean * (mode === 'under' ? 0.35 : 0.12)).normalize();
        p = p.clone().addScaledVector(dir, seg);
      }
      for (let j = 0; j <= NK; j++) {
        const f = j / NK, tan = (j < NK ? pts[j + 1].clone().sub(pts[j]) : pts[j].clone().sub(pts[j - 1])).normalize();
        const tw = 0.5 * Math.sin(s.seed * 3 + j * 0.7), side = side0.clone().applyAxisAngle(tan, tw), w = s.w * (0.55 + 0.65 * Math.sin(PI * Math.min(1, f * 1.15 + 0.08))) * (j === NK ? 0.25 : 1);
        const nn = new V3().crossVectors(tan, side).normalize();
        for (let e = 0; e < 2; e++) { const q = pts[j].clone().addScaledVector(side, (e ? 0.5 : -0.5) * w); pos.set([q.x, q.y, q.z], (j * 2 + e) * 3); nor.set([nn.x, nn.y, nn.z], (j * 2 + e) * 3); }
      }
      s.mesh.geometry.attributes.position.needsUpdate = true; s.mesh.geometry.attributes.normal.needsUpdate = true; s.mesh.geometry.computeBoundingSphere();
    }
  }

  // =================================================================================================================
  // BARNACLES (instanced on the body + feet)
  // =================================================================================================================
  // a barnacle = an irregular volcano cone with an open crater (lathe, wall dips inside), lumpy per vertex, three variants
  const barnVar = [0, 1, 2].map(v => { const prof = [[0.0, 0.0], [1.0, 0.0], [0.92, 0.18], [0.66, 0.62], [0.5, 0.86], [0.42, 0.9], [0.34, 0.66], [0.2, 0.55]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof, 9 + v); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.22 * Math.sin(a * (3 + v) + v * 1.7) + 0.1 * Math.sin(a * 7 + v);
      p.setX(i, x * k); p.setZ(i, z * k * (0.8 + 0.1 * v)); p.setY(i, p.getY(i) * (1 + 0.15 * Math.sin(a * 2 + v))); }
    g.computeVertexNormals(); return g; });
  const barnGeo = barnVar[0];
  const barnacles = [];
  { const B = R.B, sZ = bandZ(B), sX = bandX(B), list = [];
    const put = (p, n, s) => list.push([p, n, s]);
    for (let i = 0; i < 900; i++) {
      const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3), cl = Math.sin(r1 * 40) * Math.sin(r2 * 31);   // clustered acceptance
      if (cl < 0.15) continue;
      const which = i % 4;
      let p, n;
      if (which < 2) { const sx = which ? 1 : -1, s = lerp(-52, -30, r1), z = lerp(-21, 21, r2); [p, n] = sZ(sx > 0 ? s : 198 - s, z); p.addScaledVector(n, 1.9); }
      else if (which === 2) { const s = lerp(-53, -36, r1), x = lerp(-44, 44, r2); [p, n] = sX(s, x); p.addScaledVector(n, 1.9); }
      else { const s = lerp(181, 196, r1), x = lerp(-44, 44, r2); [p, n] = sX(s, x); p.addScaledVector(n, 1.8); }
      put(p, n, 0.6 + 1.1 * r3 * r3);
      // cluster: two or three smaller ones leaning off the big one
      if (r3 > 0.55) for (let j = 0; j < 2 + (i % 2); j++) { const a = rnd(i, 20 + j) * 6.28, t1 = new V3(0, 1, 0).cross(n); if (t1.lengthSq() < 1e-3) t1.set(1, 0, 0); t1.normalize(); const t2 = n.clone().cross(t1);
        put(p.clone().addScaledVector(t1, Math.cos(a) * 1.6).addScaledVector(t2, Math.sin(a) * 1.6), n, 0.35 + 0.45 * rnd(i, 30 + j)); }
    }
    const byVar = [[], [], []]; list.forEach((it, i) => byVar[i % 3].push(it));
    byVar.forEach((lst, v) => { const im = new THREE.InstancedMesh(barnVar[v], M.barn, lst.length); im.frustumCulled = false; im.userData.noSolid = true;
      lst.forEach(([p, n, s], i) => { const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rnd(i, v + 40) * 6.28));
        im.setMatrixAt(i, new THREE.Matrix4().compose(p, q, new V3(s * 1.1, s * (0.6 + 0.6 * rnd(i, 7 + v)), s))); });
      R.body.add(im); barnacles.push(im); });
    const fS = cylS(18.6, 17.0, 3.6, -4.3);
    for (const L of R.legs) { const fl = [];
      for (let i = 0; i < 70; i++) { const a = rnd(i, 11) * 2 * PI * 17.8, v = rnd(i, 12) * 3.2; if (Math.sin(a * 0.4 + L.sx) < -0.2) continue; const [p, n] = fS(a, v); p.addScaledVector(n, 1.4); fl.push([p, n, 0.5 + 0.8 * rnd(i, 13)]); }
      const fm = new THREE.InstancedMesh(barnGeo, M.barn, fl.length); fm.frustumCulled = false; fm.userData.noSolid = true;
      fl.forEach(([p, n, s], i) => fm.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), new V3(s, s, s))));
      L.foot.add(fm); barnacles.push(fm); }
  }

  // =================================================================================================================
  // WATER: sheets on the armour + free-falling streams (on threes)
  // =================================================================================================================
  const waterMat = () => { const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uK: { value: 1 }, uSeed: { value: 0 }, uLen: { value: 1 }, uCol: { value: new THREE.Color(0xeafcff) }, uSh: { value: new THREE.Color(0x8fd2f0) } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // a drawn water sheet: ragged wobbling side edges, a translucent film with a few bright streaks, a foamy lip at the
    // top, breaking into drops toward the bottom; scrolls down on threes
    fragmentShader: /* glsl */`${ctx.glsl.NOISE} uniform float uT, uK, uSeed, uLen; uniform vec3 uCol, uSh; varying vec2 vUv;
      void main(){ float y = (1.0 - vUv.y) * uLen, x = vUv.x, yt = y * 0.045 - uT * 1.4;
        float wob = (n2(vec2(yt * 1.3, uSeed)) - 0.5) * 0.35;
        float w = 0.5 - 0.42 * (1.0 - 0.45 * smoothstep(0.0, 1.0, y / uLen));
        float edge = 1.0 - smoothstep(w - 0.05, w, abs(x - 0.5 - wob));
        float str = n2(vec2(x * 6.0 + uSeed, yt)) * 0.6 + n2(vec2(x * 15.0 + uSeed * 2.0, yt * 2.0)) * 0.4;
        float streak = smoothstep(0.62, 0.66, str);
        float brk = smoothstep(0.55, 1.0, y / uLen);   // breaks up near the bottom
        float holes = smoothstep(0.35 + 0.5 * brk, 0.4 + 0.5 * brk, n2(vec2(x * 10.0 + uSeed, yt * 3.0)));
        float lip = 1.0 - smoothstep(1.0, 3.5, y);
        float a = edge * max(max(0.42 * holes, streak * (0.9 - 0.5 * brk)), lip * 0.9) * uK * (1.0 - smoothstep(0.88, 1.0, y / uLen));
        if (a < 0.03) discard;
        vec3 c = mix(uSh, uCol, max(streak, lip));
        gl_FragColor = vec4(c, a); }` });
    mat.keepMask(m); mat.mrt(m, { id: mat.ID.FX }); return m; };
  // emitters: [parent, local point, local outward normal, width, mode] mode 0 = sheet down the armour, 1 = free fall
  const wEm = [];
  for (const sx of [-1, 1]) {
    for (const z of [-10, 13]) wEm.push([R.body, new V3(sx * 64.0, 44, z), new V3(sx, 0, 0), 16 + 6 * rnd(z, sx), 0]);
    wEm.push([R.body, new V3(sx * 62.8, -47, 5 * sx), new V3(sx, 0, 0), 9, 1]);
  }
  for (const x of [-22, 24]) wEm.push([R.body, new V3(x, 44, -40.8), new V3(0, 0, -1), 20, 0]);
  for (const A of R.arms) wEm.push([A.fore, new V3(13, -15.5, 0), new V3(0, -1, 0), 8, 1]);
  wEm.push([R.body, new V3(0, -47, 43), new V3(0, 0, 1), 9, 1]);
  const water = wEm.map(([parent, p, n, w, mode], i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), waterMat()); m.frustumCulled = false; m.userData.noSolid = true; G.add(m);
    m.material.uniforms.uSeed.value = i * 3.7; return { parent, p, n, w, mode, m }; });
  function updateWater(ft, k) {
    for (const s of water) {
      s.m.visible = k > 0.02; if (!s.m.visible) continue;
      s.parent.updateMatrixWorld(true); const top = s.p.clone().applyMatrix4(s.parent.matrixWorld); s.parent.getWorldQuaternion(_q);
      const nW = s.n.clone().applyQuaternion(_q); nW.y = 0; if (nW.lengthSq() < 1e-4) nW.set(0, 0, 1); nW.normalize();
      const len = top.y - 0.5; if (len < 1) { s.m.visible = false; continue; }
      const hk = clamp(1.25 - len / 140, 0.25, 1);     // parts just out of the water pour hardest
      s.m.position.copy(top);
      if (s.mode === 0) { s.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, 1, 0).cross(nW).normalize(), new V3(0, 1, 0), nW)); s.m.scale.set(s.w, len, 1); }
      else { const cam = ctx.camera.position.clone().sub(top); cam.y = 0; cam.normalize(); s.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, 1, 0).cross(cam).normalize(), new V3(0, 1, 0), cam)); s.m.scale.set(s.w * 0.5, len, 1); }
      const u = s.m.material.uniforms; u.uT.value = ft; u.uK.value = k * hk; u.uLen.value = len;
    }
  }

  // =================================================================================================================
  // PUFFS: steam hooks, smoke, silt (two-tone cel smoke sprites that rise, grow and erode)
  // =================================================================================================================
  const puffTex = kit.canvasTex(1024, 256, (c, w, h) => {
    // 4 cells: hook right, hook left, round puff, wisp, each a union of round lobes (cumulus-like anime smoke).
    // A = a smooth density field (1 in the lobe cores -> 0 at the rim: the shader's rising threshold erodes it into
    // separate shrinking lobes), R = lit (a smaller lobe shifted up-left inside each lobe) vs shade (the lower-right rim)
    const lobes = [[], [], [], []];
    for (const dir of [1, -1]) { const L = lobes[dir > 0 ? 0 : 1];   // column rising into a curl over the top
      [[0, 222, 46], [6, 186, 44], [10, 150, 40], [10, 116, 36]].forEach(([x, y, r]) => L.push([128 + dir * (x - 22), y, r]));
      for (let i = 0; i < 5; i++) { const a = Math.PI - i * 0.78, R = 40; L.push([128 + dir * (8 + Math.cos(a) * R), 86 - Math.sin(a) * R, 31 - i * 3.6]); }
      L.push([128 + dir * 40, 214, 30], [128 - dir * 52, 206, 26]); }
    lobes[2].push([128, 140, 62]); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + 0.4; lobes[2].push([128 + Math.cos(a) * 58, 140 + Math.sin(a) * 46, 32 + 10 * Math.abs(Math.sin(i * 2.3))]); }
    for (let i = 0; i < 7; i++) { const f = i / 6; lobes[3].push([128 + Math.sin(f * 4.2) * 26, 222 - f * 180, 34 - f * 18]); }
    const img = c.createImageData(w, h), D = img.data;
    for (let cell = 0; cell < 4; cell++) for (let y = 0; y < h; y++) for (let x = 0; x < 256; x++) {
      let a = 0, lit = 0;
      for (const [cx, cy, r] of lobes[cell]) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) a = Math.max(a, Math.pow(1 - d * d, 0.75));
        const dl = Math.hypot(x - (cx - 0.24 * r), y - (cy - 0.3 * r)) / (0.8 * r); if (dl < 1) lit = 1; }
      const i = (y * w + cell * 256 + x) * 4; D[i] = lit ? 255 : 70; D[i + 1] = 0; D[i + 2] = 0; D[i + 3] = Math.round(a * 255);
    }
    c.putImageData(img, 0, 0);
  }, { srgb: false });
  const puffMat = () => { const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { map: { value: puffTex }, uCell: { value: 0 }, uThr: { value: 0.3 }, uLit: { value: new THREE.Color(0xffffff) }, uSh: { value: new THREE.Color(0xb6b4d8) }, uOp: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D map; uniform float uCell, uThr, uOp; uniform vec3 uLit, uSh; varying vec2 vUv;
      void main(){ vec4 tx = texture2D(map, vec2((uCell + vUv.x) * 0.25, vUv.y)); float aa = fwidth(tx.a) + 0.01;
        float a = smoothstep(uThr - aa, uThr + aa, tx.a) * uOp; if (a < 0.02) discard;
        float lit = smoothstep(0.55, 0.6, tx.r);
        gl_FragColor = vec4(mix(uSh, uLit, lit), a); }` });
    mat.keepMask(m); mat.mrt(m, { id: mat.ID.FX }); return m; };
  const NP = 150, puffs = Array.from({ length: NP }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), puffMat()); m.frustumCulled = false; m.userData.noSolid = true; m.visible = false; G.add(m); return m; });
  let puffN = 0;
  const puff = (pos, size, cell, thr, lit, sh, op = 1, rot = 0) => { if (puffN >= NP) return; const m = puffs[puffN++]; m.visible = true; m.position.copy(pos); m.scale.set(size, size, 1);
    const u = m.material.uniforms; u.uCell.value = cell; u.uThr.value = thr; u.uLit.value.set(lit); u.uSh.value.set(sh); u.uOp.value = op; m.userData.rot = rot; };
  // steam emitters on the cooling armour (body-local)
  const steamEm = [[0, 50, 6], [-36, 48, -8], [36, 48, -8], [-62, 34, 4], [62, 34, 4], [-22, 46, 20], [24, 46, 18], [0, 30, -40]].map(p => new V3(...p));
  function steam(ft, k, lit, sh, wind) {
    const per = 0.5, life = 2.2;
    steamEm.forEach((e, i) => { const w = e.clone().applyMatrix4(R.body.matrixWorld);
      for (let j = 0; j < 4; j++) { const birth = Math.floor((ft - i * 0.13) / per - j) * per + i * 0.13, age = ft - birth; if (age < 0 || age > life) continue; const f = age / life, sd = Math.floor(birth / per) * 7 + i;
        const p = w.clone().add(new V3(wind * 18 * f + (rnd(sd, 1) - 0.5) * 6, 6 + 34 * Math.pow(f, 0.8), (rnd(sd, 2) - 0.5) * 6));
        puff(p, (10 + 22 * f) * k, rnd(sd, 3) > 0.5 ? 0 : 1, 0.25 + 0.62 * f * f, lit, sh, sstep(0, 0.1, f)); } });
  }

  // =================================================================================================================
  // THRUSTER TRAILS (additive tapered ribbons, camera-facing about their axis)
  // =================================================================================================================
  const trailMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uK: { value: 1 }, uT: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`${ctx.glsl.NOISE} uniform float uK, uT; varying vec2 vUv;
      void main(){ float v = 1.0 - vUv.y, x = abs(vUv.x - 0.5) * 2.0; float w = mix(0.35, 1.0, v);
        float core = 1.0 - smoothstep(0.0, 0.35 * w, x), sheath = 1.0 - smoothstep(0.2 * w, w, x);
        float br = 0.7 + 0.3 * n2(vec2(v * 14.0 - uT * 6.0, 0.5));
        float a = (sheath * 0.55 + core * 0.6) * pow(1.0 - v, 1.4) * br * uK;
        gl_FragColor = vec4(mix(vec3(0.3, 0.7, 1.6), vec3(1.0, 1.05, 1.25), core) * 1.4, a); }` });
  kit.addBlend(trailMat); mat.mrt(trailMat, { id: mat.ID.FX });
  const trails = R.legs.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), trailMat); m.frustumCulled = false; m.userData.noSolid = true; G.add(m); return m; });
  function updateTrails(k, len, ft) {
    R.legs.forEach((L, i) => { const m = trails[i]; m.visible = k > 0.01; if (!m.visible) return;
      const p = L.sole.getWorldPosition(new V3()), down = new V3(0, -1, 0).applyQuaternion(L.foot.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const cam = ctx.camera.position.clone().sub(p); const x = down.clone().cross(cam).normalize(), z = x.clone().cross(down).normalize();
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, down.clone().negate(), z)); m.position.copy(p); m.scale.set(16, len, 1); });
    trailMat.uniforms.uK.value = k; trailMat.uniforms.uT.value = ft;
  }

  // =================================================================================================================
  // FLAT DRAWN SHAPES ON THE SEA: ripple rings, ragged foam rings, the launch shock ring, the sole glow (pool, on threes)
  // =================================================================================================================
  const flatMat = (additive) => { const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uIn: { value: 0.8 }, uSoft: { value: 0.04 }, uCol: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uRimW: { value: 0 }, uA: { value: 1 }, uKind: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // kind 0 = crisp ring (inner radius uIn), 1 = soft glow disc, 2 = ragged foam ring with holes; uRimW = a lighter outer rim
    fragmentShader: /* glsl */`${ctx.glsl.NOISE} uniform float uIn, uSoft, uRimW, uA, uKind, uSeed; uniform vec3 uCol, uRim; varying vec2 vUv;
      void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
        float rag = uKind > 1.5 ? (n2(vec2(a * 2.5 + uSeed, uSeed * 0.7)) - 0.5) * 0.16 : 0.0;
        float outer = 1.0 - smoothstep(0.97 - uSoft + rag, 0.97 + rag, r);
        float body = outer * smoothstep(uIn - uSoft + rag * 0.6, uIn + rag * 0.6, r);
        if (uKind > 0.5 && uKind < 1.5) body = pow(max(0.0, 1.0 - r), 1.6);
        float rim = uRimW > 0.0 ? smoothstep(0.97 - uRimW - uSoft + rag, 0.97 - uRimW + rag, r) * outer : 0.0;
        float holes = uKind > 1.5 ? smoothstep(0.32, 0.42, n2(vec2(a * 7.0 + uSeed * 3.0, r * 5.0 + uSeed))) : 1.0;
        float al = body * uA * holes; if (al < 0.01) discard;
        gl_FragColor = vec4(mix(uCol, uRim, rim), al); }` });
    if (additive) kit.addBlend(m); else mat.keepMask(m); mat.mrt(m, { id: mat.ID.FX }); return m; };
  const NF = 64, flats = Array.from({ length: NF }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2), flatMat(i >= NF - 8));
    m.frustumCulled = false; m.userData.noSolid = true; m.userData.noReflect = true; m.visible = false; m.renderOrder = 2; G.add(m); return m; });
  let flatN = 0, glowN = NF - 8;
  // upright additive glows at the waterline (s19: the sole thrusters seen through the surf)
  const glows = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(kit.addBlend(new THREE.SpriteMaterial({ map: kit.glowTexture(), color: 0x60c8ff, depthTest: true })));
    mat.mrt(s.material, { id: mat.ID.FX }); s.visible = false; s.userData.noSolid = true; s.userData.noReflect = true; G.add(s); return s; });
  // kind: 0 ring, 1 glow (additive pool), 2 foam
  const flat = (x, y, z, rad, kind, { inner = 0.8, col = 0xffffff, rim = 0xffffff, rimW = 0, a = 1, seed = 0, soft = 0.04 } = {}) => {
    const m = kind === 1 ? (glowN < NF ? flats[glowN++] : null) : (flatN < NF - 8 ? flats[flatN++] : null); if (!m) return;
    m.visible = true; m.position.set(x, y, z); m.scale.set(rad, 1, rad); const u = m.material.uniforms;
    u.uIn.value = inner; u.uKind.value = kind; u.uCol.value.set(col); u.uRim.value.set(rim); u.uRimW.value = rimW; u.uA.value = a; u.uSeed.value = seed; u.uSoft.value = soft; };
  const seaY = (x, z, t) => ctx.modules.ocean?.height?.(x, z, t) ?? 0;

  // =================================================================================================================
  // ROCK CONTACT (strato): crumbs packed round the fingertips, flying chips, a dark contact shadow on the rock
  // =================================================================================================================
  const rockMat = mat.cel(0x5a4a48, { id: mat.nextId(), shade: 0x2a2232, hi: 0xb08a70, hiAmt: 0.5, spec: 0.2, bevel: 0.3 });
  const chipGeo = [new THREE.IcosahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1.2, 0)].map(g => { const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + 0.4 * rnd(i, 1)), p.getY(i) * (0.6 + 0.3 * rnd(i, 2)), p.getZ(i) * (0.8 + 0.4 * rnd(i, 3))); g.computeVertexNormals(); return g; });
  const NCH = 180, chips = chipGeo.map(g => { const im = new THREE.InstancedMesh(g, rockMat, NCH); im.frustumCulled = false; im.userData.noSolid = true; im.count = 0; im.visible = false; G.add(im); return im; });
  const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _s = new V3();
  const chip = (p, size, seed) => { const im = chips[Math.floor(rnd(seed, 5) * 2.999)]; if (im.count >= NCH) return;
    _qq.setFromEuler(new THREE.Euler(rnd(seed, 6) * 6.3, rnd(seed, 7) * 6.3, rnd(seed, 8) * 6.3)); im.setMatrixAt(im.count++, _m4.compose(p, _qq, _s.setScalar(size))); im.visible = true; };
  const shadowTex = kit.canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.85)'); g.addColorStop(0.62, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, { srgb: false });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x140c18, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  mat.keepMask(shadowMat); mat.mrt(shadowMat, { id: mat.ID.FX });
  const shadows = [0, 1, 2, 3, 4, 5, 6, 7].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat); m.frustumCulled = false; m.userData.noSolid = true; m.visible = false; G.add(m); return m; });
  function contact(t, c, api) {
    const fe = ctx.modules['fx-energy'], live = ctx.state?.id ? ctx.state.id === c.shotId : true, ft = ctx.onTwos(t);
    const n = c.pose.layout?.n?.clone() || new V3(0, 1, 0), down = n.clone().negate();
    const t1 = new V3(0, 1, 0).cross(n); if (t1.lengthSq() < 1e-3) t1.set(1, 0, 0); t1.normalize(); const t2 = n.clone().cross(t1);
    const age = t - (c.S.contactT ?? 0);
    R.arms.forEach((A, ai) => {
      const palm = A.palm.getWorldPosition(new V3());
      // contact shadow: a dark pool on the rock above the palm
      const sh = shadows[ai], hit = palm.clone().addScaledVector(n, 5.5 - 0.15);
      sh.visible = true; sh.position.copy(hit); sh.quaternion.setFromUnitVectors(new V3(0, 0, 1), down); sh.scale.setScalar(30);
      A.fingers.forEach((f, fi) => { const tip = f.tip.getWorldPosition(new V3()), sd = ai * 10 + fi;
        // a dark crater where each finger is driven in (the rock surface sits ~1.2 m below the tip, toward the mecha)
        const cr = shadows[2 + ai * 3 + fi]; cr.visible = true; cr.position.copy(tip).addScaledVector(down, 1.35); cr.quaternion.setFromUnitVectors(new V3(0, 0, 1), down); cr.scale.setScalar(11);
        // crumbs packed round the tip, sitting on the rock (static, they jitter on twos)
        for (let j = 0; j < 9; j++) { const a = rnd(sd, j) * 6.28 + Math.floor(ft * 12) * 0.05 * (j % 2), rr = 1.8 + 3.2 * rnd(sd, j + 10);
          chip(tip.clone().addScaledVector(t1, Math.cos(a) * rr).addScaledVector(t2, Math.sin(a) * rr).addScaledVector(down, 0.6 + 0.6 * rnd(sd, j + 20)), 0.9 + 1.5 * rnd(sd, j + 30), sd * 50 + j); }
        // chips flying off (period 0.5 s, phase per piece), falling away from the rock
        for (let j = 0; j < 4; j++) { const per = 0.5, ph = ((ft + rnd(sd, j + 40) * per) % per) / per, a = rnd(sd, j + 50) * 6.28, sp = 14 + 18 * rnd(sd, j + 60);
          const p = tip.clone().addScaledVector(t1, Math.cos(a) * sp * ph).addScaledVector(t2, Math.sin(a) * sp * ph).addScaledVector(down, 6 * ph + 22 * ph * ph);
          chip(p, (0.6 + 1.0 * rnd(sd, j + 70)) * (1 - 0.5 * ph), sd * 77 + j + Math.floor((ft + rnd(sd, j + 40) * per) / per) * 13); }
        // sparks at one finger per hand (the meteor team adds the palm sparks)
        if (live && fi === 0 && fe?.sparks && c.shotId === 's24') fe.sparks(tip.clone().addScaledVector(down, 0.5), down.clone(), t, { key: 'mecha-tip' + ai, k: 0.5, spread: 60, scale: 1.0, seed: 11 + ai });
      });
      // dust: grey-brown puffs rolling out of the contact (two-tone, eroding)
      for (let j = 0; j < 4; j++) { const per = 1.2, ph = ((ft + j * per / 4) % per) / per, a = rnd(ai, j + 80) * 6.28 + Math.floor((ft + j * per / 4) / per);
        const p = hit.clone().addScaledVector(t1, Math.cos(a) * (8 + 18 * ph)).addScaledVector(t2, Math.sin(a) * (8 + 18 * ph)).addScaledVector(down, 3 + 10 * ph);
        puff(p, 10 + 18 * ph, 2, 0.3 + 0.5 * ph * ph, 0xd9c6b4, 0x8a7a92, 1 - ph * 0.3, a); }
      // cracks running out from the fingers while it pushes (s28): blue lightning along the rock surface
      if (live && c.S.pushK > 0 && fe?.lightning) A.fingers.forEach((f, fi) => { const tip = f.tip.getWorldPosition(new V3()), a = (fi / 3 + ai * 0.17) * 6.28 + 0.4, L = 18 + 70 * c.S.pushK;
        const b = tip.clone().addScaledVector(t1, Math.cos(a) * L).addScaledVector(t2, Math.sin(a) * L).addScaledVector(down, 0.6);
        fe.lightning(tip.clone().addScaledVector(down, 0.6), b, t, { key: `mecha-crack${ai}${fi}`, k: 0.6, width: 0.9, branches: 1, seed: 7 + ai * 3 + fi, jag: 0.18 }); });
    });
    void age;
  }
  function contactEnd() { for (const im of chips) im.instanceMatrix.needsUpdate = true; }

  // =================================================================================================================
  // SPEED LINES (overlay): thin white streaks along the motion, around the frame edges only, on twos
  // =================================================================================================================
  const streakTex = kit.canvasTex(16, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w, h * 0.3); c.lineTo(w / 2, h); c.lineTo(0, h * 0.3); c.closePath(); c.fill(); }, { srgb: false });
  const speedMat = mat.overlay({ color: 0xffffff, k: 1.0, map: streakTex, additive: true, soft: 1 }); speedMat.uniforms.uOp.value = 0.55;
  const speeds = Array.from({ length: 36 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), speedMat); m.frustumCulled = false; m.visible = false; m.renderOrder = 20; ctx.overlay.add(m); return m; });
  function speedLines(t, dirW, k) {
    const cam = ctx.camera, ft = Math.floor(t * 12), D = 30, th = Math.tan((cam.fov || 45) * PI / 360) * D, asp = cam.aspect || 16 / 9;
    const Rv = new V3(), Uv = new V3(), Fv = new V3(); cam.matrixWorld.extractBasis(Rv, Uv, Fv);
    const sd = dirW.clone().normalize(), sx = sd.dot(Rv), sy = sd.dot(Uv), ang = Math.atan2(sy, sx) - PI / 2;
    speeds.forEach((m, i) => { const s = i * 7.3 + ft * 0.91, side = rnd(s, 1) * 2 - 1, edge = 0.45 + 0.55 * rnd(s, 2);
      // positions spread across the frame width, kept out of the centre third
      let x = side * asp * th, y = (rnd(s, 3) * 2 - 1) * th; if (Math.abs(x) < asp * th * 0.38 && Math.abs(y) < th * 0.6) x = Math.sign(x || 1) * asp * th * (0.4 + 0.5 * edge);
      m.visible = k > 0.01; m.position.copy(cam.position).addScaledVector(Fv, -D).addScaledVector(Rv, x).addScaledVector(Uv, y);
      m.quaternion.copy(cam.quaternion); m.rotateZ(ang); m.scale.set(th * 0.012 * (0.6 + rnd(s, 4)), th * (0.5 + 0.9 * rnd(s, 5)), 1); });
    speedMat.uniforms.uOp.value = 0.5 * k;
  }

  // =================================================================================================================
  // CLOUD WISPS streaming past the climb (s21): drawn two-tone puffs fixed in the sky around the climb column
  // =================================================================================================================
  function wisps(t, api) {
    const cam = ctx.camera.position, body = api.anchor('center'), toCam = cam.clone().sub(body); toCam.y = 0; const camA = Math.atan2(toCam.z, toCam.x), camD = toCam.length();
    let n = 0;
    for (let i = 0; i < 60 && n < 34; i++) { const y = 1150 + i * 30, a = rnd(i, 1) * 6.28, r = 70 + 230 * rnd(i, 2);
      const ax = -200 + 40 * Math.sin(((y - 1150) / 420) * 0.8), az = 300 - 30 * (y - 1150) / 420;   // the column axis at that height
      // never between the camera and the giant
      let da = Math.abs(((a - camA + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI); if (da < 0.5 && r < camD + 40) continue;
      const p = new V3(ax + Math.cos(a) * r, y, az + Math.sin(a) * r); if (Math.abs(p.y - cam.y) > 260) continue;
      puff(p, 45 + 90 * rnd(i, 3), 2, 0.3 + 0.25 * rnd(i, 4), 0xffffff, 0xc5c6ee, 0.85, rnd(i, 5) * 6.28); n++; }
  }

  // =================================================================================================================
  // FISH (s11 s13): a small school drifting across the visor, 1.4 m each: the scale cue next to the 80 m glass (on twos)
  // =================================================================================================================
  const fishGeo = (() => { const b = new THREE.SphereGeometry(0.5, 10, 6).scale(1.4, 0.55, 0.28), tl = new THREE.ConeGeometry(0.32, 0.6, 4).rotateZ(PI / 2).scale(1, 1, 0.25).translate(-0.95, 0, 0);
    const g = new THREE.BufferGeometry(); const parts = [b.toNonIndexed(), tl.toNonIndexed()]; const pos = [], nor = [];
    for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; })();
  const fishMat = mat.cel(0xa8e4f0, { id: mat.nextId(), shade: 0x4c84b0, hi: 0xf0ffff, hiAmt: 0.6, spec: 0.5, bevel: 0.1 });
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, 16); fish.frustumCulled = false; fish.userData.noSolid = true; fish.visible = false; G.add(fish);
  function school(t, api) {
    const ct = ctx.onTwos(t), f = api.frame(), v = api.anchor('visor');
    for (let i = 0; i < 16; i++) { const ph = rnd(i, 1), lane = (ct * 4.5 + ph * 30) % 120 - 60, wob = Math.sin(ct * 3 + i) * 0.8;
      const p = v.clone().addScaledVector(f.right, lane + (rnd(i, 2) - 0.5) * 6).addScaledVector(f.up, 12 + 10 * rnd(i, 3) + wob).addScaledVector(f.fwd, 7 + 6 * rnd(i, 4));
      const heading = f.right.clone().addScaledVector(f.up, 0.15 * Math.cos(ct * 3 + i)).normalize();
      _qq.setFromUnitVectors(new V3(1, 0, 0), heading); fish.setMatrixAt(i, _m4.compose(p, _qq, _s.setScalar(1.4 * (0.8 + 0.4 * rnd(i, 5))))); }
    fish.instanceMatrix.needsUpdate = true; fish.visible = true;
  }

  // a red / white channel buoy in the bay (s15 s16): a 3.4 m scale cue in front of the 120 m giant, bobbing on threes
  const buoy = new THREE.Group(); buoy.name = 'mecha-scale-buoy'; G.add(buoy);
  { const red = mat.cel(0xd9483c, { id: mat.nextId(), shade: 0x8e3442, hi: 0xff8a70, hiAmt: 0.5, spec: 0.4, bevel: 0.1 }), white = mat.cel(0xf4eee2, { id: mat.nextId(), shade: 0xa6a2c4, hiAmt: 0.4, bevel: 0.1 }),
      dark = mat.cel(0x34343e, { id: mat.nextId(), shade: 0x1c1c26, hiAmt: 0.3, bevel: 0.05 });
    const add = (g, m, y = 0) => { const o = new THREE.Mesh(g, m); o.position.y = y; o.userData.noSolid = true; buoy.add(o); };
    add(new THREE.CylinderGeometry(1.25, 1.6, 1.6, 18), red, -0.2); add(new THREE.CylinderGeometry(1.2, 1.25, 0.5, 18), white, 0.85); add(new THREE.CylinderGeometry(0.75, 1.2, 1.0, 18), red, 1.55);
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; add(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 6).translate(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), dark, 2.8); }
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 12), dark, 3.55); add(new THREE.SphereGeometry(0.22, 10, 8), white, 3.75); }
  buoy.visible = false;
  const BUOY = [-42, 113];

  // the water column dragged up behind the soles at the launch (s20): a sheet standing on the sea, camera-facing
  const column = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), waterMat()); column.frustumCulled = false; column.userData.noSolid = true; column.visible = false; G.add(column);
  column.material.uniforms.uSeed.value = 17.3;

  let last = null;
  return {
    hideAll() { last = null; for (const s of kelp) s.mesh.visible = false; for (const b of barnacles) b.visible = false; for (const w of water) w.m.visible = false; for (const p of puffs) p.visible = false; for (const m of trails) m.visible = false; puffN = 0;
      for (const m of flats) m.visible = false; flatN = 0; glowN = NF - 8; for (const im of chips) { im.count = 0; im.visible = false; } for (const m of shadows) m.visible = false;
      fish.visible = false; column.visible = false; buoy.visible = false; for (const m of speeds) m.visible = false; for (const g of glows) g.visible = false; },
    update(t, shot, c, api) {
      const ct = ctx.onTwos(t), ft = ctx.onThrees(t); c.shotId = shot.id;
      for (const b of barnacles) b.visible = c.kelp > 0.01;
      updateKelp(ct, c.set, c.kelp);
      // water off the armour (bay)
      let wk = 0;
      if (c.set === 'coast') wk = { s15: 1, s16: lerp(0.9, 0.55, sstep(35.5, 38, t)), s19: 0.3, s20: 0.6 * (1 - sstep(43.6, 44.4, t)), s33: 0.3, s34: 0.18, s35: 0.15 }[shot.id] ?? 0;
      last = { ft, wk, trails: c.S.trails ? 1 : 0, len: c.set === 'strato' ? 320 : c.set === 'coast' ? Math.max(20, api.anchor('soleL').y + 4) : 260, ct, c, api, t };
      const under = ctx.modules.under, live = ctx.state?.id ? ctx.state.id === shot.id : true, wfx = ctx.modules['fx-water'];
      // scale cue: the buoy (s15 s16)
      if (shot.id === 's15' || shot.id === 's16') { buoy.visible = true; const [bx, bz] = BUOY;
        buoy.position.set(bx, seaY(bx, bz, ft) - 0.75, bz); buoy.rotation.set(0.07 * Math.sin(ft * 2.1), 0, 0.09 * Math.sin(ft * 1.7 + 1)); }
      // s15: wide drawn sheets pouring off the top edge, the brow ends and the shoulders (fx-water draws them, our anchors),
      // and a foam skirt of spray jets of different heights round the waterline
      if (shot.id === 's15' && live) { const f = api.frame(), B = R.body.matrixWorld;
        const an = [[-36, 47, 31, 0, 20], [-12, 47.5, 31, 0, 22], [12, 47.5, 31, 0, 22], [36, 47, 31, 0, 20], [-34, 31, 40, 0, 14], [34, 31, 40, 0, 14], [-63, 40, -10, -1, 18], [63, 40, 10, 1, 18]]
          .map(([x, y, z, s, w]) => ({ p: arr(new V3(x, y, z).applyMatrix4(B)), n: arr(s ? f.right.clone().multiplyScalar(s) : f.fwd), w, world: true }));
        wfx?.sheets?.(R.root, an, 1, t);
        const c0 = api.anchor('center');
        for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28, ex = Math.cos(a) * 68, ez = Math.sin(a) * 44, per = 0.75 + 0.5 * rnd(i, 1), ph = ((ft + rnd(i, 2) * per) % per) / per, cyc = Math.floor((ft + rnd(i, 2) * per) / per);
          // spray jets: narrow drawn columns (wisp cell) of very different heights, base on the water
          const p = c0.clone().addScaledVector(f.right, ex).addScaledVector(f.fwd, ez); p.y = 0; const h = (6 + 34 * Math.pow(rnd(i * 7 + cyc, 3), 1.8)) * Math.sin(ph * PI);
          if (h < 2) continue; puff(p.setY(h * 0.42), h, 3, 0.26 + 0.5 * ph * ph, 0xffffff, 0xb4c8e8, 1, 0); } }
      // s11 s13: the fish school; s11 the eyes light: silt swirls rolling off the visor frame (drawn puffs, on threes) + bubbles
      if (c.set === 'under') { school(t, api);
        const ek = ft - ctx.cues.eyes;
        if (ek > 0 && shot.id === 's11') { const f = api.frame(), v = api.anchor('visor');
          for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + 0.3, ph = Math.min(1, ek / 1.4), sw = a + ph * 0.9 * (i % 2 ? 1 : -1);
            const p = v.clone().addScaledVector(f.right, Math.cos(sw) * (44 + 18 * ph)).addScaledVector(f.up, Math.sin(sw) * (26 + 14 * ph)).addScaledVector(f.fwd, 4 + 10 * ph * rnd(i, 3));
            puff(p, (9 + 9 * rnd(i, 1)) * (0.6 + 0.9 * ph), 2, 0.3 + 0.5 * ph * ph, 0xe8fbf4, 0x86c4cc, 0.95, sw); }
          if (live) { under?.siltBurst?.([v.x, v.y - 20, v.z], ctx.cues.eyes, 1.2); under?.bubbles?.(arr(v.clone().addScaledVector(f.up, 24)), ctx.cues.eyes + 0.1, 16, 1.6); } }
      }
      // s19: the soles light up under the surf: blue glow through the water, a boiling foam ring, steam growing
      if (c.S.surf) { const k = clamp(c.thrust, 0, 1);
        R.legs.forEach((L, li) => { const s = L.sole.getWorldPosition(new V3()), y = seaY(s.x, s.z, t) + 0.35;
          // the glow seen through the water (a flat pool for high cameras + an upright glow at the waterline for low ones)
          flat(s.x, y, s.z, 22 + 10 * k, 1, { col: 0x5cd0ff, a: 0.35 + 0.75 * k });
          const g = glows[li]; g.visible = true; g.position.set(s.x, y + 1.5, s.z); g.scale.set(70 + 30 * k, 16 + 8 * k, 1); g.material.color.setRGB(0.25, 0.75, 1.6).multiplyScalar(0.35 + 1.0 * k);
          // the boiling ring: a collar of white foam lumps round the foot (camera-facing, readable from the low surf angle)
          for (let j = 0; j < 10; j++) { const a = j / 10 * 6.28 + rnd(li, j) * 0.4, bob = Math.sin(ft * 9 + j * 2.1 + li);
            puff(new V3(s.x + Math.cos(a) * (19 + 5 * k), y + 1 + (2 + 3 * k) * (0.5 + 0.5 * bob), s.z + Math.sin(a) * (19 + 5 * k)), (6 + 5 * k) * (0.8 + 0.4 * rnd(li, j + 9)), 2, 0.32 + 0.12 * bob, 0xffffff, 0xa8c0e4, 1, a); }
          // steam: grows toward the end of the shot
          const n = Math.round(1 + 4 * k);
          for (let j = 0; j < n; j++) { const per = 0.9, ph = ((ft + j * per / n) % per) / per, a = rnd(L.sx + L.sz * 2, j) * 6.28 + Math.floor((ft + j * per / n) / per);
            puff(new V3(s.x + Math.cos(a) * (15 + 8 * k), y + 4 + 22 * ph * (0.5 + k), s.z + Math.sin(a) * (15 + 8 * k)), (10 + 14 * ph) * (0.6 + 0.6 * k), j % 2, 0.28 + 0.55 * ph * ph, 0xffffff, 0xb8c4e4, 0.9, 0); } }); }
      // s20: the shock ring flattens the sea (dark ring, white rim, spray mist on the front) + the water column
      if (c.S.shock && c.set === 'coast') { const fe = ctx.modules['fx-energy'], rr = fe?.ringRadius ? fe.ringRadius(t, ctx.cues.launch) : 650 * clamp((t - ctx.cues.launch) / 1.3, 0, 1);
        if (rr > 1) { const age = t - ctx.cues.launch;
          flat(SITE.x, 0.4, SITE.z, rr, 0, { inner: 0.8, col: 0x163a7a, rim: 0xffffff, rimW: 0.035, a: 0.7 * (1 - sstep(1.0, 1.6, age)) });
          flat(SITE.x, 0.5, SITE.z, rr * 0.985, 2, { inner: 0.93, col: 0xffffff, a: 0.85 * (1 - sstep(1.0, 1.6, age)), seed: Math.floor(ft * 8) * 0.31 });
          for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + rnd(i, 1) * 0.2, h = 6 + 18 * rnd(i, 2);
            puff(new V3(SITE.x + Math.cos(a) * rr, h * (0.6 + age * 0.6), SITE.z + Math.sin(a) * rr), (28 + 26 * rnd(i, 3)) * (0.7 + 0.5 * age), 2, 0.3 + 0.4 * sstep(0.3, 1.6, age), 0xffffff, 0xb6c0e6, 0.9, a); } } }
      // s24-s28: the grip on the rock
      if (c.S.contact && c.set === 'strato' && c.pose.layout) contact(t, c, api);
      // s25: each buckling jolt blows steam + sparks off the top edge
      if (c.S.bendT) { const fe = ctx.modules['fx-energy'], edges = [[60, 44, -8], [-60, 44, 8], [16, 47.5, 7]].map(p => new V3(...p).applyMatrix4(R.body.matrixWorld)), upW = api.frame().up;
        c.S.bendT.forEach((t0, j) => { const a = ft - t0; if (a < 0 || a > 1.4) return;
          edges.forEach((e, i) => { for (let q = 0; q < 3; q++) puff(e.clone().addScaledVector(upW, 4 + 26 * a).add(new V3((rnd(i + j * 3, q) - 0.5) * 14, 0, (rnd(i, q + 5) - 0.5) * 14)), (8 + 20 * a) * (0.7 + 0.3 * q), q % 2, 0.28 + 0.5 * a * a / 2, 0xffffff, 0xb4b6dc, 1, 0); });
          if (live && fe?.sparks && a < 0.4) edges.forEach((e, i) => fe.sparks(e, upW.clone(), t, { key: `mecha-bend${i}`, k: 1, spread: 70, scale: 1.4, seed: 20 + i + j * 5 })); }); }
      // s34: rings of ripples + foam where the hands and the legs go into the sea
      if (c.S.ripples) { const pts = R.arms.map(A => [A.palm.getWorldPosition(new V3()), 13]).concat(R.legs.map(L => [L.knee.getWorldPosition(new V3()), 16]));
        pts.forEach(([p, r0], i) => { const y = seaY(p.x, p.z, t) + 0.3;
          flat(p.x, y + 0.05, p.z, r0 + 3, 2, { inner: 0.55, col: 0xffffff, a: 0.95, seed: i * 2.3 + Math.floor(ft * 8) * 0.41 });
          for (let j = 0; j < 3; j++) { const ph = ((ft * 0.55 + j / 3 + rnd(i, 1)) % 1);
            flat(p.x, y, p.z, r0 + 6 + 44 * ph, 0, { inner: 0.86 + 0.06 * ph, col: 0xfff4ea, a: 0.8 * (1 - ph), soft: 0.02 }); }
          // the foam collar hugging the limb (camera-facing lumps, bobbing on threes)
          for (let j = 0; j < 9; j++) { const a = j / 9 * 6.28 + rnd(i, j) * 0.5, bob = Math.sin(ft * 7 + j * 1.9 + i);
            puff(new V3(p.x + Math.cos(a) * r0, y + 0.8 + 1.2 * (0.5 + 0.5 * bob), p.z + Math.sin(a) * r0), 4.5 + 2.5 * rnd(i, j + 4), 2, 0.34 + 0.1 * bob, 0xfff6ee, 0xa898c8, 1, a); } }); }
      // steam / smoke (hooks on threes)
      const dusk = sstep(63, 66, t);
      if (c.S.steam) steam(ft, 1, dusk > 0.5 ? 0xfff0e2 : 0xffffff, dusk > 0.5 ? 0xa596c8 : 0xb4b6dc, c.set === 'sky' ? -0.5 : 0.35);
      if (c.set === 'under') {   // the reactor ignition kicks silt out sideways along the floor (the water team's default
        // silt rises along the flanks from CUES.eyes: ctx.modules.under.defaultSilt, switched on in mecha.js)
        const rk = ft - ctx.cues.reactor;
        if (rk > 0 && rk < 1.6) { const f = api.frame(); const rp = api.anchor('reactor');
          for (let i = 0; i < 6; i++) { const sx = i % 2 ? 1 : -1, j = Math.floor(i / 2), out = 22 + 12 * j + 34 * (1 - Math.exp(-rk * 2.2));
            const p = rp.clone().addScaledVector(f.right, sx * out).addScaledVector(f.fwd, -4 + 7 * j); p.y = (ctx.modules.under?.floor?.(p.x, p.z) ?? p.y - 14) + 3 + 2 * j + 5 * rk;
            puff(p, (10 + 6 * j) * (0.6 + 0.8 * rk), 2, 0.3 + 0.42 * sstep(0.2, 1.6, rk), 0xe6fbf6, 0x8ccad0, 1, sx * 0.4); } }
      }
      if (c.S.smoke) {   // s31: two smoke trails left behind the falling giant (from the head end and the hot shoulder),
        // drifting back against its sideways motion; older puffs are bigger and more eroded
        const off = c.S.smokeDir || new V3(-0.35, 1, 0).normalize();
        for (const [k, local] of [[0, new V3(0, 46, -20)], [1, new V3(-60, 20, -10)]]) { const src = local.applyMatrix4(R.body.matrixWorld);
          for (let i = 0; i < 11; i++) { const f = i / 10, along = 20 + 520 * f * (0.8 + 0.2 * f);
            const p = src.clone().addScaledVector(off, along).add(new V3(Math.sin(f * 7 + k * 2) * 12 * f, 0, Math.cos(f * 5 + k) * 12 * f));
            puff(p, (34 + 120 * f) * (k ? 0.75 : 1), 2, 0.3 + 0.45 * f, 0xffe0cc, 0x9a86b0, 1 - 0.5 * f, i * 0.7 + k); } }
      }
      contactEnd();
    },
    afterCamera() {   // camera-facing pieces (everything that needs this frame's camera is placed here)
      if (last) { const { c, api, t } = last;
        // the grip must stay readable: the shot owner re-issues the meteor's palm sparks (same keys, documented replace)
        // smaller, spraying off sideways from the fingertips instead of a glare ball over the hand
        const fe = ctx.modules['fx-energy'];
        if (c.S.contact && fe?.sparks && (c.shotId === 's25' || c.shotId === 's28') && ctx.state?.id === c.shotId) {
          const n = c.pose.layout?.n || new V3(0, 1, 0);
          R.arms.forEach(A => { const tip = A.fingers[1].tip.getWorldPosition(new V3());
            fe.sparks(tip, n.clone().negate(), t, { key: 'meteor-strain' + (A.name === 'L' ? 0 : 1), k: 0.55, spread: 80, scale: 1.2, seed: A.name === 'L' ? 3 : 10 }); }); }
        if (c.S.wisps) wisps(t, api);
        if (c.S.speed) speedLines(t, c.S.speedDir || api.frame().up, 1);
        if (c.S.column) { const s = api.anchor('soleL').add(api.anchor('soleR')).multiplyScalar(0.5), h = s.y - 6; column.visible = h > 4;
          if (column.visible) { const cam = ctx.camera.position.clone().sub(s); cam.y = 0; cam.normalize();
            column.position.set(s.x, s.y - 6, s.z); column.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, 1, 0).cross(cam).normalize(), new V3(0, 1, 0), cam));
            column.scale.set(46, h, 1); const u = column.material.uniforms; u.uT.value = -last.ft; u.uK.value = 1 - sstep(44.2, 44.9, t); u.uLen.value = h; } } }
      for (let i = 0; i < puffN; i++) { const m = puffs[i]; m.quaternion.copy(ctx.camera.quaternion); m.rotateZ(m.userData.rot || 0); }
      if (last) { updateWater(last.ft, last.wk); updateTrails(last.trails, last.len, last.ct); }
    },
    dispose() { G.removeFromParent(); },
  };
}
