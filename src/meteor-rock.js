// =====================================================================================================================
// MEGA CLAWD · the meteor rock: geometry, crack network and cel shading (owner: meteor). Used by src/meteor.js.
//   rockShape(seed)                  union of knapped convex blocks: a main block (30 big cuts + 96 chips) and 6 lumps
//                                    (16 cuts + 22 chips each) kept off the contact facet -> a jagged silhouette with
//                                    concave creases. radial(dir) = surface radius (unit space), contact = the main
//                                    block's largest flat facet (the mecha's hands go there)
//   rockGeometry(rock, detail)       icosphere projected onto the union: the collision / raycast hull and the draw hull
//   crackNet(rock, opts)             branching crack polylines on the surface (3-5 main cracks, branches, twigs) that taper;
//                                    split: true = the s28 cracks that grow out of the contact facet (birth 0..1 per point)
//   packCracks(list)                 -> { tex, n, segOff } float texture read by the rock shader
//   rockMaterial(ctx, rock, cracks)  cel material that RAY-CASTS the exact union per pixel (the hull is only a proxy): exact
//                                    flat facets, silhouette and creases, exact depth for the ink pass (no triangle edges).
//                                    Charcoal basalt in 2 cel tones (lit / cool lavender shade) with per-facet value, strata,
//                                    grain and vesicles; dark pressure ink on facet edges; heat in hard per-facet bands
//                                    (lit facet orange / shade facet dark red -> yellow -> white-hot leading face); glowing
//                                    tapered fissures (red rim, orange, yellow core) and the blue-white split seams (s28-29).
//                                    Uniforms: uFrontO travel dir (object space), uHeat (1 entry .. 0.6 crust), uRimHeat (heat
//                                    only on the grazing rim: silhouette staging), uFis (fissure glow), uSplit (crack growth
//                                    0..1), uBlue (blue seam glow), uRpx (rock radius in 1080p px: crack LOD)
//   buildChunks(rock, opts) / buildShards(opts) / chunkMaterial(ctx)   the burst: convex Voronoi pieces of every block (crust
//                                    outside, molten core inside in hard bands by distance to the burst centre, an orange
//                                    inner-edge line) + instanced small shards
// Units: geometry is unit radius (~1); the meteor scales it by RADIUS (600 m).
// =====================================================================================================================
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './pipeline-util.js';

const V3 = THREE.Vector3;
const runit = (R) => { const z = 2 * R() - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z); return new V3(Math.cos(a) * s, z, Math.sin(a) * s); };

// A convex shape = planes { n, d } with n.x <= d in rock space (d measured from the rock origin, not the shape centre).
// Ray from the origin along dir: exit = min d/c over c = n.dir > 0, entry = max d/c over c < 0.
function exitOf(planes, dir, a = 0, b = planes.length) {
  let ex = 1e9, en = -1e9, k = -1;
  for (let i = a; i < b; i++) { const c = dir.dot(planes[i].n), r = planes[i].d / c;
    if (c > 1e-4) { if (r < ex) { ex = r; k = i; } } else if (c < -1e-4 && r > en) en = r; }
  return en < ex ? [ex, k] : [-1, -1];
}
function knapped(R, centre, size, ax, nBig, nChip, lo, hi) {   // a knapped convex block around `centre`
  const pl = [], sup = (n) => Math.hypot(ax[0] * n.x, ax[1] * n.y, ax[2] * n.z) * size;
  for (let i = 0; i < nBig; i++) { const y = 1 - 2 * (i + 0.5) / nBig, r = Math.sqrt(1 - y * y), a = i * 2.399963 + R() * 6;
    const n = new V3(Math.cos(a) * r, y, Math.sin(a) * r).addScaledVector(runit(R), 0.32).normalize();
    pl.push({ n, d: sup(n) * (lo + (hi - lo) * R()) + n.dot(centre), big: true }); }
  const loc = (n) => { let m = 1e9; for (const p of pl) { const c = n.dot(p.n); if (c > 1e-4) m = Math.min(m, (p.d - p.n.dot(centre)) / c); } return m; };
  for (let i = 0; i < nChip; i++) { const n = runit(R); pl.push({ n, d: loc(n) * (0.8 + 0.15 * R()) + n.dot(centre), big: false }); }   // chips
  pl.c = centre.clone();
  let rad = 0; for (let i = 0; i < 300; i++) rad = Math.max(rad, loc(runit(R)));   // bounding radius around the centre
  pl.rad = rad * 1.04; return pl;
}

// The rock = union of a knapped main block and a few knapped lumps (concave creases, a lumpy jagged silhouette).
// The surface along a ray from the origin = the farthest shape exit (star-shaped union, used by the hull projection).
export function rockShape(seed = 6) {
  const R = rng(seed);
  const main = knapped(R, new V3(), 1, [1.16, 0.86, 1.0], 30, 96, 0.70, 0.96);
  const mainExit = (dir) => exitOf(main, dir);
  // contact facet = the largest flat face of the main block (fibonacci area sampling)
  const area = new Float64Array(main.length), N = 20000;
  for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), a = i * 2.399963, d = new V3(Math.cos(a) * r, y, Math.sin(a) * r);
    const [m, k] = mainExit(d); if (k >= 0) area[k] += m * m / Math.max(d.dot(main[k].n), 0.05); }
  let ci = 0; for (let i = 0; i < main.length; i++) if (area[i] > area[ci]) ci = i;
  const cN = main[ci].n.clone();
  // lumps: kept away from the contact facet (the mecha's hands go there)
  const shapes = [main];
  for (let tries = 0; shapes.length < 7 && tries < 200; tries++) {
    const dir = runit(R); if (dir.dot(cN) > 0.15) continue;
    if (shapes.slice(1).some(s => s.dir.dot(dir) > 0.55)) continue;
    const ext = mainExit(dir)[0], size = 0.36 + 0.2 * R(), c = dir.clone().multiplyScalar(ext - size * (0.62 - 0.22 * R()));
    const s = knapped(R, c, size, [1 + 0.4 * R(), 0.75 + 0.3 * R(), 0.85 + 0.3 * R()], 16, 22, 0.76, 0.98); s.dir = dir; shapes.push(s);
  }
  const planes = [], ranges = [];
  for (const s of shapes) { ranges.push([planes.length, planes.length + s.length]); planes.push(...s); }
  const argmin = (dir) => { let best = -1, k = -1;
    for (const [a, b] of ranges) { const [ex, kk] = exitOf(planes, dir, a, b); if (ex > best) { best = ex; k = kk; } } return [best, k]; };
  const radial = (dir) => argmin(dir)[0];
  let mean = 0; for (let i = 0; i < 1500; i++) mean += radial(runit(R)); mean /= 1500;
  return { planes, ranges, shapes, main, radial, argmin, contact: { n: cN, d: main[ci].d, index: ci }, mean };
}

export function rockGeometry(rock, detail = 56) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); v.multiplyScalar(rock.radial(v)); p.setXYZ(i, v.x, v.y, v.z); }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}

// ---------------------------------------------------------------------------------------------------------------------
// CRACKS: polylines on the surface (unit space). A crack = { pts: [V3], w: [half width], birth: [0..1], level, split }.
// Heat cracks: `mains` long cracks with angular kinks, branches (level 1) and twigs (level 2) that taper to their tips.
// Split cracks: radiate from `start` (the contact facet), birth = path length from the start / longest path.
// ---------------------------------------------------------------------------------------------------------------------
export function crackNet(rock, { seed = 21, mains = 5, split = false, start = null, steps = 26, step = 0.052, w0 = 0.017, branchP = 0.2, twigP = 0.25, turn = 0.2, kink = 0.12 } = {}) {
  const R = rng(seed), out = [];
  const onS = (p) => { const d = p.clone().normalize(); return d.multiplyScalar(rock.radial(d)); };
  const walk = (p0, dir0, n, len0 = 0) => { let p = onS(p0), dir = dir0.clone(); const pts = [p.clone()], dist = [len0];
    for (let i = 0; i < n; i++) { const nrm = p.clone().normalize(); dir.addScaledVector(nrm, -dir.dot(nrm)).normalize();
      let a = (R() - 0.5) * 2 * turn; if (R() < kink) a += (R() < 0.5 ? -1 : 1) * (0.45 + 0.4 * R());
      dir.applyAxisAngle(nrm, a).normalize();
      const q = onS(p.clone().addScaledVector(dir, step * (0.7 + 0.6 * R())));
      dist.push(dist[dist.length - 1] + q.distanceTo(p)); p = q; pts.push(p.clone()); }
    return { pts, dist, dir }; };
  const tangentAt = (pts, i) => pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
  const addBranches = (c, level, wScale, maxLen) => {
    const n = c.pts.length; if (level > 2) return;
    for (let i = 3; i < n - 3; i++) {
      if (R() > (level === 1 ? branchP : twigP)) continue;
      const nrm = c.pts[i].clone().normalize(), side = R() < 0.5 ? -1 : 1, dir = tangentAt(c.pts, i).applyAxisAngle(nrm, side * (0.5 + 0.55 * R()));
      const len = Math.max(3, Math.floor((level === 1 ? 6 + 9 * R() : 3 + 4 * R()) * maxLen));
      const wj = c.w[i] * wScale, b = walk(c.pts[i], dir, len, c.dist[i]);
      const br = { pts: b.pts, dist: b.dist, w: b.pts.map((_, j) => wj * Math.pow(1 - j / len, 0.85)), level, split: c.split, birth: null };
      out.push(br); addBranches(br, level + 1, 0.6, 0.8);
    }
  };
  if (!split) {
    for (let m = 0; m < mains; m++) {
      const p0 = runit(R), t0 = new V3().crossVectors(p0, runit(R)).normalize(), n = Math.floor(steps * (0.75 + 0.5 * R()));
      const a = walk(p0, t0, n), ww = w0 * (0.8 + 0.4 * R());
      const c = { pts: a.pts, dist: a.dist, w: a.pts.map((_, j) => ww * Math.pow(Math.sin(Math.PI * Math.min(1, (j + 0.6) / (n + 0.6))), 0.55)), level: 0, split: false, birth: null };
      out.push(c); addBranches(c, 1, 0.55, 1);
    }
  } else {
    const s = (start || rock.contact.n).clone().normalize(), tA = new V3(1, 0, 0).cross(s); if (tA.lengthSq() < 1e-4) tA.set(0, 0, 1).cross(s); tA.normalize();
    const p0 = s.clone().multiplyScalar(rock.radial(s));
    for (let m = 0; m < mains; m++) { const dir = tA.clone().applyAxisAngle(s, (m + R() * 0.7) / mains * Math.PI * 2), n = Math.floor(steps * (0.75 + 0.5 * R()));
      const a = walk(p0, dir, n), ww = w0 * (0.85 + 0.3 * R());
      const c = { pts: a.pts, dist: a.dist, w: a.pts.map((_, j) => ww * (0.35 + 0.65 * Math.pow(1 - j / n, 0.7)) * Math.min(1, 0.4 + j * 0.3)), level: 0, split: true, birth: null };
      out.push(c); addBranches(c, 1, 0.6, 1);
    }
    const maxD = Math.max(...out.map(c => c.dist[c.dist.length - 1]));
    for (const c of out) c.birth = c.dist.map(d => d / maxD);
  }
  for (const c of out) if (!c.birth) c.birth = c.pts.map(() => 0);
  return out;
}
// pack cracks into a float texture: [headers: 2 texels per chunk of <= 10 segments][segments: 3 texels each]
// header0 = (centre xyz, bound radius), header1 = (first segment, count, split, level); seg = (a, wa) (b, wb) (birthA, birthB, 0, 0)
export function packCracks(list, W = 1024) {
  const heads = [], segs = [];
  for (const c of list) for (let i0 = 0; i0 < c.pts.length - 1; i0 += 10) {
    const i1 = Math.min(c.pts.length - 1, i0 + 10), first = segs.length / 3, cen = new V3();
    for (let i = i0; i <= i1; i++) cen.add(c.pts[i]); cen.divideScalar(i1 - i0 + 1);
    let r = 0, wm = 0; for (let i = i0; i <= i1; i++) { r = Math.max(r, c.pts[i].distanceTo(cen)); wm = Math.max(wm, c.w[i]); }
    for (let i = i0; i < i1; i++) { const a = c.pts[i], b = c.pts[i + 1]; segs.push([a.x, a.y, a.z, c.w[i]], [b.x, b.y, b.z, c.w[i + 1]], [c.birth[i], c.birth[i + 1], 0, 0]); }
    heads.push([cen.x, cen.y, cen.z, r + wm * 4 + 0.01], [first, i1 - i0, c.split ? 1 : 0, c.level]);
  }
  const all = [...heads, ...segs], H = Math.ceil(all.length / W), data = new Float32Array(W * H * 4);
  all.forEach((v, i) => data.set(v, i * 4));
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
  return { tex, n: heads.length / 2, segOff: heads.length };
}

// ---------------------------------------------------------------------------------------------------------------------
// ROCK MATERIAL
// ---------------------------------------------------------------------------------------------------------------------
export function rockMaterial(ctx, rock, packed, { base = 0x4c4442, shade = 0x45425f, hi = 0x6a6064, id = null } = {}) {
  const { mat, glsl } = ctx, NP = rock.planes.length, NS = rock.ranges.length;
  const m = mat.cel(base, { id: id ?? mat.nextId(), shade, hi, hiAmt: 0.5, hiT: 0.6, spec: 0, rimI: 0.25, rimW: 0.66, brush: 0.03, recvShadow: false });
  const sc = rock.shapes.map(s => { const c = s.c || new V3(); return new THREE.Vector4(c.x, c.y, c.z, s.rad || 1.5); });
  Object.assign(m.uniforms, {
    uPl: { value: rock.planes.map(p => new THREE.Vector4(p.n.x, p.n.y, p.n.z, p.d)) }, uRotM: { value: new THREE.Matrix3() }, uScale: { value: 600 }, uInfl: { value: 1.03 },
    uPx: { value: 0.001 }, uAAk: { value: 1 }, uFrontO: { value: new V3(0, -1, 0) }, uHeat: { value: 1 }, uRimHeat: { value: 0 }, uFis: { value: 1 }, uSplit: { value: 0 },
    uBlue: { value: 0 }, uRpx: { value: 500 }, uCrk: { value: packed.tex }, uCrkN: { value: packed.n }, uSegOff: { value: packed.segOff }, uSeedR: { value: 3.1 },
    uMeanR: { value: rock.mean }, uSC: { value: sc },
    // per-shot paint: lavender-grey shade floor (never the colour of the background), a cool bounce rim (direction toward the
    // bounce source, world), the ink colour
    uShadeMin: { value: new THREE.Color(0.075, 0.068, 0.13) }, uColdDir: { value: new V3(0, -1, 0) }, uColdCol: { value: new THREE.Color(0.2, 0.32, 0.62) }, uColdK: { value: 0 },
    uInkR: { value: new THREE.Color(0.022, 0.016, 0.035) } });
  const RA = rock.ranges.map(r => r[0]).join(', '), RB = rock.ranges.map(r => r[1]).join(', ');
  // ray vs each convex block (slab test over its planes), nearest entry wins
  const blocks = rock.ranges.map(([a, b], s) => /* glsl */`
    { vec3 oc = o - uSC[${s}].xyz; float bb = dot(oc, d), cc = dot(oc, oc) - uSC[${s}].w * uSC[${s}].w, disc = bb * bb - cc;
      if (disc > 0.0 && -bb - sqrt(disc) < best) {
        float tn = -1e9, tf = 1e9; int k = ${a};
        for (int i = ${a}; i < ${b}; i++){ vec4 q = uPl[i]; float dn = dot(q.xyz, d), num = q.w - dot(q.xyz, o);
          if (dn < -1e-7) { float tt = num / dn; if (tt > tn) { tn = tt; k = i; } }
          else if (dn > 1e-7) tf = min(tf, num / dn);
          else if (num < 0.0) tf = -1e9; }
        if (tn <= tf && tn > 0.0 && tn < best) { best = tn; bk = k; bs = ${s}; } } }`).join('');
  glsl.patchShader(m, 'meteorRockRT' + NP + '_' + NS, (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('varying vec3 vN, vW, vO, vIC, vON;', 'varying vec3 vNv, vW, vO, vIC, vON; varying vec3 vCamO; uniform float uInfl;\n#define vN vNv\n')
      .replace('vec4 p = vec4(position, 1.0);', 'vec4 p = vec4(position * uInfl, 1.0);')
      .replace('gl_Position = projectionMatrix * viewMatrix * w;', 'vCamO = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * w;');
    sh.fragmentShader = sh.fragmentShader.replace('varying vec3 vN, vW, vO, vIC, vON;', /* glsl */`varying vec3 vNv, vW, vO, vIC, vON; varying vec3 vCamO;
      uniform vec4 uPl[${NP}]; uniform vec4 uSC[${NS}]; uniform mat3 uRotM; uniform vec3 uFrontO, uStrata;
      uniform float uScale, uPx, uAAk, uHeat, uRimHeat, uFis, uSplit, uBlue, uRpx, uSeedR, uMeanR; uniform highp sampler2D uCrk; uniform int uCrkN, uSegOff;
      const int RA[${NS}] = int[${NS}](${RA}); const int RB[${NS}] = int[${NS}](${RB});
      vec3 gP = vec3(0.0), gW = vec3(0.0), gFN = vec3(0.0, 0.0, 1.0), gNW = vec3(0.0, 0.0, 1.0); float gVZ = 1.0, gEdge = 1.0, gEdgeC = 1.0, gCrease = 1.0; int gK = 0; bool gDone = false;
      // exact surface: ray from the camera (object space) through this hull pixel vs the union of convex blocks
      void rockHit(){ if (gDone) return; gDone = true;
        vec3 o = vCamO, d = normalize(vO - vCamO); float best = 1e9; int bk = -1, bs = 0;
        ${blocks}
        if (bk < 0) discard;
        gP = o + d * best; gK = bk; gFN = uPl[bk].xyz; gNW = normalize(uRotM * gFN);
        gW = cameraPosition + normalize(vW - cameraPosition) * best * uScale; gVZ = -(viewMatrix * vec4(gW, 1.0)).z;
        // distance to the facet border inside its own block, and to the creases with the other blocks (unit space)
        float e = 1e9, ec = 1.0;
        for (int i = RA[bs]; i < RB[bs]; i++){ if (i == bk) continue; vec4 q = uPl[i]; float c = dot(gFN, q.xyz);
          float di = (q.w - dot(q.xyz, gP)) / sqrt(max(1.0 - c * c, 0.0025)); if (di < e) { e = di; ec = c; } }
        float cr = 1e9;
        for (int s = 0; s < ${NS}; s++){ if (s == bs || distance(gP, uSC[s].xyz) > uSC[s].w + 0.05) continue; float g = -1e9, cc = 0.0;
          for (int i = RA[s]; i < RB[s]; i++){ vec4 q = uPl[i]; float gi = dot(q.xyz, gP) - q.w; if (gi > g) { g = gi; cc = dot(gFN, q.xyz); } }
          cr = min(cr, max(g, 0.0) / sqrt(max(1.0 - cc * cc, 0.0025))); }
        gEdge = e; gEdgeC = ec; gCrease = cr; }
      vec4 rockMrtH(){ rockHit(); return vec4((viewMatrix * vec4(gW, 1.0)).xyz, 1.0); }
      float rockFD(){ rockHit(); return 1.0 + gVZ; }
      vec4 cf(int i){ return texelFetch(uCrk, ivec2(i % 1024, i / 1024), 0); }
      // nearest heat fissure (sdH, wH) and split seam (sdS, wS): signed distance to the tapered stroke, unit space
      void crackField(vec3 P, float pxU, out float sdH, out float wH, out float sdS, out float wS){
        sdH = 1e9; wH = 1.0; sdS = 1e9; wS = 1.0;
        float lod1 = smoothstep(200.0, 300.0, uRpx), lod2 = smoothstep(420.0, 560.0, uRpx);
        for (int h = 0; h < 512; h++){ if (h >= uCrkN) break;
          vec4 H0 = cf(h * 2); vec3 dc = P - H0.xyz; if (dot(dc, dc) > H0.w * H0.w) continue;
          vec4 H1 = cf(h * 2 + 1); int s0 = int(H1.x + 0.5), n = int(H1.y + 0.5); bool split = H1.z > 0.5;
          float vis = H1.w < 0.5 ? 1.0 : H1.w < 1.5 ? lod1 : lod2;
          if (split ? uSplit <= 0.0 : (vis <= 0.0 || uFis <= 0.0)) continue;
          for (int j = 0; j < 10; j++){ if (j >= n) break; int si = uSegOff + (s0 + j) * 3;
            vec4 A = cf(si), B = cf(si + 1); vec3 ab = B.xyz - A.xyz;
            float u = clamp(dot(P - A.xyz, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
            float dd = length(P - A.xyz - ab * u), w = mix(A.w, B.w, u);
            if (split) { vec4 Cb = cf(si + 2); float b = mix(Cb.x, Cb.y, u); w *= smoothstep(b, b + 0.05, uSplit); if (w < 0.4 * pxU) continue;
              float we = max(w, 1.1 * pxU), sd = dd - we; if (sd < sdS) { sdS = sd; wS = we; } }
            else { w *= vis; if (w < (H1.w < 0.5 ? 0.25 : 0.5) * pxU) continue; float we = max(w, 1.0 * pxU), sd = dd - we; if (sd < sdH) { sdH = sd; wH = we; } }
          } } }
      #define vN gNW
      #define vW gW
      #define vO gP
      #define vMrtH rockMrtH()
      #define vMrtFD rockFD()
      `);
    sh.fragmentShader = sh.fragmentShader.replace('vec3 N = normalize(vN);', 'rockHit(); vec3 N = gNW;')
      .replace('float fd = length(vW - cameraPosition);', /* glsl */`{
        vec3 P = gP; float fid = float(gK);
        float pxU = uPx * gVZ / uScale, aaU = pxU * uAAk, aaP = uAAk;   // unit length of one 1080p pixel / of one real pixel
        vec3 Vv = normalize(cameraPosition - gW);
        // ---- heat: hard per-facet bands toward the travel direction (straight band edges inside a facet, steps at the
        // facet edges). Lit facet -> orange / yellow, shade facet -> dark red / orange, white-hot leading face.
        float sh = (1.0 - uHeat) * 0.62;
        float H = dot(gFN, uFrontO) * 0.55 + dot(P, uFrontO) / uMeanR * 0.45 + (h12(vec2(fid * 0.71, 9.1 + uSeedR)) - 0.5) * 0.1;
        float frs = 1.0 - clamp(dot(gNW, Vv), 0.0, 1.0);
        H -= uRimHeat * (1.0 - smoothstep(0.42, 0.8, frs)) * 0.6;
        float a2 = fwidth(H) * 0.6 + 1e-4;
        float b0 = smoothstep(0.30 + sh - a2, 0.30 + sh + a2, H) * step(0.05, uHeat);
        float b1 = smoothstep(0.52 + sh - a2, 0.52 + sh + a2, H), b2 = smoothstep(0.70 + sh - a2, 0.70 + sh + a2, H), b3 = smoothstep(0.85 + sh - a2, 0.85 + sh + a2, H);
        // ---- basalt: never darker than its lavender shade tone; per-facet value, flow strata, painted grain, vesicles
        col = max(col, shade * 0.55);
        col *= 0.86 + 0.28 * h12(vec2(fid * 1.37, 4.2 + uSeedR));
        float sv = dot(P, uStrata) * 13.0 + (n3(P * 2.1 + uSeedR) - 0.5) * 1.1, sf = fract(sv), saa = fwidth(sv) + 1e-4;
        col *= 1.0 - 0.1 * smoothstep(0.0, saa, sf) * (1.0 - smoothstep(0.14 - saa, 0.14 + saa, sf)) * (1.0 - b1);
        col *= 1.0 + (n3(P * 46.0 + uSeedR) - 0.5) * 0.12 + (n3(P * 150.0) - 0.5) * 0.06;
        { vec3 q = P * 24.0 + uSeedR * 1.7, qi = floor(q), qf = q - qi;
          if (h13(qi + 3.7) < 0.42) { vec3 vc = vec3(h13(qi + 1.1), h13(qi + 2.3), h13(qi + 5.9)) * 0.5 + 0.25, dv = qf - vc;
            float r = 0.1 + 0.13 * h13(qi + 8.8), dpl = dot(dv, gFN), rr = sqrt(max(r * r - dpl * dpl, 0.0)), dd = length(dv - gFN * dpl), qa = aaU * 24.0;
            float vis = smoothstep(1.0, 2.0, rr / (pxU * 24.0)) * (1.0 - b1);
            float pit = (1.0 - smoothstep(rr - qa, rr + qa, dd)) * vis, lip = dot(dv - gFN * dpl, transpose(uRotM) * KD) > 0.0 ? 1.0 : 0.0;
            col = mix(col, col * mix(0.5, 0.78, lip * smoothstep(rr * 0.55, rr * 0.75, dd)), pit); } }
        // ---- heat colours
        float Lt = lit;
        col = mix(col, col * 0.5 + mix(vec3(0.17, 0.03, 0.035), vec3(0.36, 0.075, 0.04), Lt), b0);
        col = mix(col, mix(vec3(0.5, 0.055, 0.04), vec3(1.5, 0.34, 0.07), Lt), b1);
        col = mix(col, mix(vec3(1.35, 0.42, 0.08), vec3(1.9, 1.15, 0.32), Lt), b2);
        col = mix(col, vec3(2.5, 2.25, 1.9), b3);
        // ---- facet edges: dark pressure ink; a thin warm highlight beside it on the edges facing the heat. Widths in
        // screen pixels from the derivative of the edge distance (foreshortened facets keep a solid line, no dashes)
        float ePx = gEdge / max(fwidth(gEdge) * uAAk, pxU * 0.05), cPx = gCrease / max(fwidth(gCrease) * uAAk, pxU * 0.05), press = 0.7 + 0.6 * n3(P * 8.0 + uSeedR);
        float sharp = 1.0 - smoothstep(0.9, 0.975, gEdgeC), iw = 0.9 * press;
        float ink = max((1.0 - smoothstep(iw - 0.5 * aaP, iw + 0.5 * aaP, ePx)) * sharp, (1.0 - smoothstep(1.1 * press - 0.5 * aaP, 1.1 * press + 0.5 * aaP, cPx)) * step(gCrease, 0.2));
        float hl = (smoothstep(iw + 0.2, iw + 0.2 + aaP, ePx) - smoothstep(iw + 1.6, iw + 1.6 + aaP, ePx)) * sharp * b0 * (1.0 - b2);
        col = mix(col, mix(vec3(1.3, 0.48, 0.14), vec3(2.0, 0.95, 0.35), b1), hl * 0.9);
        col = mix(col, mix(min(col * 0.32, vec3(0.035, 0.026, 0.05)), col * 0.45, b1), ink * (1.0 - b3) * 0.92);
        // ---- glowing fissures (tapered, red rim -> orange -> yellow core) and the blue-white split seams
        float sdH, wH, sdS, wS; crackField(P, pxU, sdH, wH, sdS, wS);
        if (sdH < wH * 6.0) {
          float dc = sdH + wH, cov = 1.0 - smoothstep(-0.5 * aaU, 0.5 * aaU, sdH);
          float mid = 1.0 - smoothstep(wH * 0.64 - 0.5 * aaU, wH * 0.64 + 0.5 * aaU, dc), core = 1.0 - smoothstep(wH * 0.3 - 0.5 * aaU, wH * 0.3 + 0.5 * aaU, dc);
          float fk = clamp(uFis, 0.0, 2.0);
          vec3 fc = mix(mix(vec3(0.62, 0.07, 0.03), vec3(1.8, 0.48, 0.09), mid), vec3(2.4, 1.7, 0.6), core) * fk;
          col += vec3(0.5, 0.1, 0.02) * fk * exp(-max(sdH, 0.0) / (wH * 1.6)) * (1.0 - cov) * (1.0 - b2) * 0.7;
          col = mix(col, fc, cov * min(fk * 1.5, 1.0));
        }
        if (sdS < wS * 8.0) {
          float dc = sdS + wS, cov = 1.0 - smoothstep(-0.5 * aaU, 0.5 * aaU, sdS);
          float mid = 1.0 - smoothstep(wS * 0.72 - 0.5 * aaU, wS * 0.72 + 0.5 * aaU, dc), core = 1.0 - smoothstep(wS * 0.36 - 0.5 * aaU, wS * 0.36 + 0.5 * aaU, dc);
          float bk = uBlue;
          vec3 sc = mix(mix(vec3(1.8, 0.5, 0.1), mix(vec3(1.8, 0.5, 0.1), vec3(0.12, 0.5, 1.9), bk), mid), mix(vec3(2.6, 1.9, 0.7), vec3(1.7, 2.5, 3.4), bk), core);
          col += mix(vec3(0.4, 0.08, 0.02), vec3(0.04, 0.16, 0.6), bk) * exp(-max(sdS, 0.0) / (wS * 1.6)) * (1.0 - cov) * 0.4;
          col = mix(col, sc, cov);
        }
      }
      float fd = length(vW - cameraPosition);`);
  });
  m.userData.rock = true;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// BURST PIECES
// ---------------------------------------------------------------------------------------------------------------------
// convex Voronoi chunks of the rock (unit space). Each: { geo (positions relative to its seed), seed: V3, size }
export function buildChunks(rock, { n = 60, perLump = 3, seed = 9 } = {}) {
  const R = rng(seed), out = [];
  const shapes = rock.shapes || [rock.planes];
  shapes.forEach((shape, si) => {
    const c0 = shape.c || new V3(), cnt = si === 0 ? n : perLump, seeds = [];
    const loc = (d) => { let m = 1e9; for (const p of shape) { const c = d.dot(p.n); if (c > 1e-4) m = Math.min(m, (p.d - p.n.dot(c0)) / c); } return m; };
    while (seeds.length < cnt) { const d = runit(R); seeds.push(c0.clone().addScaledVector(d, loc(d) * Math.pow(R(), 0.45) * 0.92)); }
    for (let j = 0; j < cnt; j++) chunkOf(shape.map(p => ({ n: p.n, d: p.d })), seeds, j, out, true);
  });
  return out;
}
// small shard shapes for instancing: Voronoi cells of a unit ball (all faces molten except a crust cap)
export function buildShards({ n = 6, seed = 31 } = {}) {
  const R = rng(seed), ball = [], out = [];
  for (let i = 0; i < 40; i++) { const nn = runit(R); ball.push({ n: nn, d: 1 }); }
  const seeds = []; for (let i = 0; i < 14; i++) seeds.push(runit(R).multiplyScalar(0.55 * Math.pow(R(), 0.5)));
  for (let j = 0; j < n; j++) chunkOf(ball, seeds, j, out, false);
  for (const s of out) { const k = 1 / s.size; s.geo.scale(k, k, k); s.geo.computeBoundingSphere(); s.size = 1; }
  return out;
}
// one Voronoi cell of a convex block as an exact polytope (crisp flat faces): every plane's face = a big square on the
// plane clipped by all the other half-spaces (Sutherland-Hodgman), fanned into triangles. Positions relative to the seed.
// Attributes: aInner (1 = cut face = molten core), aRock (rock-space position: the molten bands), aBary (polygon-edge
// distance helper: the components of the fan's inner diagonals are pushed to 1 so only real face edges draw lines).
function chunkOf(shape, seeds, j, out, crustOuter) {
  const n = seeds.length, s = seeds[j], pl = shape.map(p => ({ n: p.n, off: p.d - p.n.dot(s), inner: crustOuter ? 0 : 1 }));
  for (let k = 0; k < n; k++) if (k !== j) { const nn = seeds[k].clone().sub(s), L = nn.length(); nn.divideScalar(L); pl.push({ n: nn, off: L / 2, inner: 1 }); }
  const pos = [], nor = [], inr = [], rk = [], bar = []; let size = 0;
  for (let i = 0; i < pl.length; i++) {
    const p = pl[i], N = p.n, o = N.clone().multiplyScalar(p.off);
    const u = new V3().crossVectors(N, Math.abs(N.x) < 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0)).normalize(), v = new V3().crossVectors(N, u), S = 4;
    let poly = [[S, S], [-S, S], [-S, -S], [S, -S]].map(([a, b]) => o.clone().addScaledVector(u, a).addScaledVector(v, b));
    for (let jj = 0; jj < pl.length && poly.length >= 3; jj++) { if (jj === i) continue; const q = pl[jj], next = [];
      for (let k = 0; k < poly.length; k++) { const A = poly[k], B = poly[(k + 1) % poly.length], da = q.n.dot(A) - q.off, db = q.n.dot(B) - q.off;
        if (da <= 0) next.push(A); if ((da <= 0) !== (db <= 0)) next.push(A.clone().lerp(B, da / (da - db))); }
      poly = next; }
    if (poly.length < 3) continue;
    const m = poly.length;
    for (let k = 1; k < m - 1; k++) {
      // bary: component i = distance-to-opposite-edge helper; inner fan diagonals get 1 (never a line)
      const tri = [[poly[0], [1, 0, 0]], [poly[k], [0, 1, 0]], [poly[k + 1], [0, 0, 1]]];
      const e0 = true, e1 = k + 1 === m - 1, e2 = k === 1;   // edge opposite v0 (k,k+1) always a border; opposite vk = (0,k+1); opposite vk+1 = (0,k)
      const flip = new V3().subVectors(tri[1][0], tri[0][0]).cross(new V3().subVectors(tri[2][0], tri[0][0])).dot(N) < 0;
      const order = flip ? [0, 2, 1] : [0, 1, 2];
      for (const oi of order) { const [P, b] = tri[oi];
        pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); inr.push(p.inner); rk.push(P.x + s.x, P.y + s.y, P.z + s.z);
        bar.push(e0 ? b[0] : 1, e1 ? b[1] : 1, e2 ? b[2] : 1); size = Math.max(size, P.length()); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aInner', new THREE.Float32BufferAttribute(inr, 1)); g.setAttribute('aRock', new THREE.Float32BufferAttribute(rk, 3));
  g.setAttribute('aBary', new THREE.Float32BufferAttribute(bar, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.computeBoundingSphere(); out.push({ geo: g, seed: s.clone(), size });
}

// burst chunk material: outer faces = basalt crust (2 tones, per-face value, grain, dark ink at the face edges), inner
// faces = molten core in hard bands by distance to the burst centre (white -> yellow -> orange -> red) with an orange-hot
// edge line. uHot cools the bands (1 = fresh, 0 = dark red). Instanced shards: per-instance aHeatI replaces the distance.
export function chunkMaterial(ctx, { base = 0x4f4744, shade = 0x37344f, instanced = false } = {}) {
  const { mat, glsl } = ctx;
  const m = mat.cel(base, { id: mat.nextId(), shade, hiAmt: 0.45, hiT: 0.62, hi: 0x6e6468, spec: 0, rimI: 0.3, brush: 0.03, recvShadow: false });
  Object.assign(m.uniforms, { uHot: { value: 1 }, uSeedR: { value: 5.3 } });
  glsl.patchShader(m, 'meteorChunk' + (instanced ? 'I' : ''), (sh) => {
    sh.vertexShader = sh.vertexShader.replace('varying vec3 vN, vW, vO, vIC, vON;', `varying vec3 vN, vW, vO, vIC, vON; attribute float aInner; attribute vec3 aRock, aBary; varying float vInner, vHeatR; varying vec3 vBary;
        ${instanced ? 'attribute float aHeatI;' : ''}`)
      .replace('vec4 p = vec4(position, 1.0);', `vInner = aInner; vBary = aBary; vHeatR = ${instanced ? 'aHeatI' : 'length(aRock)'}; vec4 p = vec4(position, 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('varying vec3 vN, vW, vO, vIC, vON;', `varying vec3 vN, vW, vO, vIC, vON; varying float vInner, vHeatR; varying vec3 vBary; uniform float uHot, uSeedR;`)
      .replace('float fd = length(vW - cameraPosition);', /* glsl */`{
        float inr = step(0.5, vInner);
        float fh = fract(sin(dot(floor(vON * 7.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        col *= mix(0.84 + 0.32 * fh, 1.0, inr);
        col *= 1.0 + (n3(vO * 40.0 + uSeedR) - 0.5) * 0.12;
        // face-edge distance in px (fan diagonals excluded)
        vec3 bw = fwidth(vBary) + 1e-5, bp = vBary / bw; float ePx = min(bp.x, min(bp.y, bp.z));
        // molten bands by distance to the burst centre, cooling inward with uHot
        float h = clamp(uHot, 0.0, 1.4), r = vHeatR, ra = fwidth(r) * 0.7 + 1e-4;
        float m1 = 1.0 - smoothstep(0.92 * h - ra, 0.92 * h + ra, r), m2 = 1.0 - smoothstep(0.66 * h - ra, 0.66 * h + ra, r), m3 = 1.0 - smoothstep(0.42 * h - ra, 0.42 * h + ra, r);
        vec3 mol = mix(vec3(0.42, 0.05, 0.035), vec3(0.95, 0.12, 0.04), smoothstep(0.0, 0.3, h));
        mol = mix(mol, mix(vec3(0.8, 0.16, 0.04), vec3(1.25, 0.34, 0.07), lit), m1);
        mol = mix(mol, mix(vec3(1.4, 0.6, 0.12), vec3(1.7, 1.05, 0.28), lit), m2);
        mol = mix(mol, vec3(2.1, 1.85, 1.4), m3);
        col = mix(col, mol, inr);
        float line = 1.0 - smoothstep(1.0, 2.0, ePx);
        col = mix(col, mix(vec3(0.03, 0.022, 0.045), mix(vec3(1.5, 0.45, 0.08), vec3(2.0, 1.2, 0.35), m2), inr), line * 0.92);
      }
      float fd = length(vW - cameraPosition);`);
  });
  return m;
}

// surface random walks from a start direction (unit space), kept for compatibility: the split cracks as point lists
export function crackPaths(rock, start, opts = {}) {
  return crackNet(rock, { split: true, start, mains: opts.n ?? 7, seed: opts.seed ?? 11, steps: opts.steps ?? 30 }).map(c => ({ pts: c.pts, t0: c.birth[0], w: c.level === 0 ? 1 : 0.6, birth: c.birth, level: c.level }));
}
