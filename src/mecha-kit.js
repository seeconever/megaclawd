// MEGA CLAWD · mecha geometry kit (owner: mecha). Armour as bevelled slabs grown from parametric base surfaces.
//
//   Every mecha geometry carries the same attributes, so parts merge freely:
//     position, normal, uv, aPD (vec4: plate-local u, v and half-size hu, hv, in metres), aPK (vec2: seed, kind)
//   aPD / aPK drive the procedural plate detail in mecha-paint.js (panel lines, bolts, vents, hazard stripes, wear).
//
//   Base surfaces S(u, v) -> [point, normal], u / v in metres of arc length:
//     rrect(a, b, r)            rounded-rectangle perimeter (2D), s = 0 at (+a, 0), counter-clockwise
//     bandX / bandY / bandZ     the rounded body block swept around the x / y / z axis (v = coordinate along that axis)
//     cylS(r0, r1, len)         frustum along +y (u around, v up), capS(...) a square patch on a sphere (corner guards)
//     planeS(o, eu, ev)         a plane
//   slab(S, u0, u1, v0, v1, o)  armour plate: raised by t, 45-degree chamfer b, side walls sunk into the hull, hard creases
//   extrude(shape, depth, o)    a THREE.Shape plate (holes allowed) with bevel; the front cap gets the plate detail
//   Part                        collects (material key, geometry, matrix) and merges per material into one Group
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
export const KIND = { NONE: 0, PANEL: 1, VENT: 2, HAZARD: 3, PLAIN: 4, GRILLE: 5, RIB: 6 };

// ---------------------------------------------------------------------------------------------------------------------
// base surfaces
// ---------------------------------------------------------------------------------------------------------------------
export function rrect(a, b, r) {
  const fa = a - r, fb = b - r, q = Math.PI * r / 2;
  const arc = (cx, cy, a0) => (l) => { const t = a0 + l / r; return [cx + r * Math.cos(t), cy + r * Math.sin(t), Math.cos(t), Math.sin(t)]; };
  const segs = [[fb, l => [a, l, 1, 0]], [q, arc(fa, fb, 0)], [2 * fa, l => [fa - l, b, 0, 1]], [q, arc(-fa, fb, Math.PI / 2)],
    [2 * fb, l => [-a, fb - l, -1, 0]], [q, arc(-fa, -fb, Math.PI)], [2 * fa, l => [-fa + l, -b, 0, -1]], [q, arc(fa, -fb, Math.PI * 1.5)], [fb, l => [a, -fb + l, 1, 0]]];
  const P = segs.reduce((s, x) => s + x[0], 0);
  return { P, a, b, r, at(s) { s = ((s % P) + P) % P; for (const [len, f] of segs) { if (s <= len) return f(s); s -= len; } return segs[8][1](fb); } };
}
// body block (half extents hx, hy, hz, corner radius r, centre c) swept around an axis
export const bandX = (B) => { const pr = rrect(B.hz, B.hy, B.r); return (u, v) => { const [z, y, nz, ny] = pr.at(u); return [new V3(v, B.cy + y, z), new V3(0, ny, nz)]; }; };
export const bandZ = (B) => { const pr = rrect(B.hx, B.hy, B.r); return (u, v) => { const [x, y, nx, ny] = pr.at(u); return [new V3(x, B.cy + y, v), new V3(nx, ny, 0)]; }; };
export const bandY = (B) => { const pr = rrect(B.hx, B.hz, B.r); return (u, v) => { const [x, z, nx, nz] = pr.at(u); return [new V3(x, v, z), new V3(nx, 0, nz)]; }; };
// frustum along +y from radius r0 (v = 0) to r1 (v = len); u = arc length at the mean radius, u = 0 toward +z
export const cylS = (r0, r1, len, y0 = 0) => { const rm = (r0 + r1) / 2, dr = (r1 - r0) / len;
  return (u, v) => { const a = u / rm, r = r0 + dr * v, c = Math.cos(a), s = Math.sin(a);
    return [new V3(r * s, y0 + v, r * c), new V3(s, -dr, c).normalize()]; }; };
// cylinder along +x (u around from +y toward +z, v along x)
export const cylX = (r, x0 = 0) => (u, v) => { const a = u / r, c = Math.cos(a), s = Math.sin(a); return [new V3(x0 + v, r * c, r * s), new V3(0, c, s)]; };
// square patch on a sphere (centre c, radius R) around direction d, tangents e1 / e2
export const capS = (c, R, d, e1, e2) => (u, v) => { const n = d.clone().addScaledVector(e1, u / R).addScaledVector(e2, v / R).normalize(); return [c.clone().addScaledVector(n, R), n]; };
export const planeS = (o, eu, ev) => { const n = eu.clone().cross(ev).normalize(); return (u, v) => [o.clone().addScaledVector(eu, u).addScaledVector(ev, v), n.clone()]; };

// ---------------------------------------------------------------------------------------------------------------------
// geometry builders
// ---------------------------------------------------------------------------------------------------------------------
function fromArrays(pos, pd, pk, crease = 32) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPD', new THREE.Float32BufferAttribute(pd, 4));
  g.setAttribute('aPK', new THREE.Float32BufferAttribute(pk, 2));
  const uv = new Float32Array(pos.length / 3 * 2); for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = pd[i * 4]; uv[i * 2 + 1] = pd[i * 4 + 1]; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return toCreasedNormals(g, crease * Math.PI / 180);
}
// triangle sink with winding fixed against an outward direction
function triSink() {
  const pos = [], pd = [], pk = [], e1 = new V3(), e2 = new V3();
  return { pos, pd, pk, tri(a, b, c, out, da, db, dc, k) {
    e1.subVectors(b, a); e2.subVectors(c, a); if (e1.cross(e2).dot(out) < 0) { [b, c] = [c, b]; [db, dc] = [dc, db]; }
    for (const [p, d] of [[a, da], [b, db], [c, dc]]) { pos.push(p.x, p.y, p.z); pd.push(...d); pk.push(...k); } } };
}

// Armour slab on surface S over [u0,u1] x [v0,v1]. t = thickness above the surface, b = chamfer, sink = wall depth below.
export function slab(S, u0, u1, v0, v1, { t = 1.6, b = 0.5, step = 2.5, sink = 1.0, kind = KIND.PANEL, seed = 0, crease = 32, ustep = step, vstep = step, closed = false } = {}) {
  b = Math.min(b, (u1 - u0) / 3, (v1 - v0) / 3);
  const ax = (a0, a1, st) => { const n = Math.max(1, Math.ceil((a1 - a0 - 2 * b) / st)), o = [a0, a0 + b]; for (let i = 1; i < n; i++) o.push(a0 + b + (a1 - a0 - 2 * b) * i / n); o.push(a1 - b, a1); return o; };
  const us = ax(u0, u1, ustep), vs = ax(v0, v1, vstep), NU = us.length, NV = vs.length;
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, hu = (u1 - u0) / 2, hv = (v1 - v0) / 2;
  const top = [], base = [], nrm = [], D = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const edge = i === 0 || j === 0 || i === NU - 1 || j === NV - 1, [p, n] = S(us[i], vs[j]);
    top.push(p.clone().addScaledVector(n, edge ? t - b : t)); base.push(p.clone().addScaledVector(n, -sink)); nrm.push(n);
    D.push([us[i] - uc, vs[j] - vc, hu, hv]);
  }
  const id = (i, j) => j * NU + i, K = [seed, kind], K0 = [seed, 0], Z = [0, 0, 0, 0], T = triSink();
  for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) {
    const a = id(i, j), b2 = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
    const out = nrm[a].clone().add(nrm[c]);
    T.tri(top[a], top[b2], top[c], out, D[a], D[b2], D[c], K); T.tri(top[a], top[c], top[d], out, D[a], D[c], D[d], K);
  }
  // walls around the border loop
  const loop = []; for (let i = 0; i < NU; i++) loop.push([i, 0]); for (let j = 1; j < NV; j++) loop.push([NU - 1, j]);
  for (let i = NU - 2; i >= 0; i--) loop.push([i, NV - 1]); for (let j = NV - 2; j > 0; j--) loop.push([0, j]);
  const cen = S(uc, vc)[0];
  for (let k = 0; k < loop.length; k++) {
    const A = id(...loop[k]), B = id(...loop[(k + 1) % loop.length]);
    const mid = top[A].clone().add(top[B]).multiplyScalar(0.5), out = mid.clone().sub(cen);
    const nn = nrm[A].clone().add(nrm[B]).normalize(); out.addScaledVector(nn, -out.dot(nn));   // outward = tangential away from the centre
    T.tri(top[A], top[B], base[B], out, Z, Z, Z, K0); T.tri(top[A], base[B], base[A], out, Z, Z, Z, K0);
  }
  if (closed) for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) {   // underside (free-standing shells)
    const a = id(i, j), b2 = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1), out = nrm[a].clone().add(nrm[c]).negate();
    T.tri(base[a], base[b2], base[c], out, Z, Z, Z, K0); T.tri(base[a], base[c], base[d], out, Z, Z, Z, K0);
  }
  return fromArrays(T.pos, T.pd, T.pk, crease);
}

// THREE.Shape plate extruded along +z (front cap at z = depth + bevel) with plate detail on the front cap
export function extrude(shape, depth, { bevel = 0.5, seg = 1, kind = KIND.PANEL, seed = 0, curve = 12, crease = 32 } = {}) {
  let g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: curve, steps: 1 });
  if (g.index) g = g.toNonIndexed();
  g.computeBoundingBox(); const bb = g.boundingBox, c = bb.getCenter(new V3()), h = bb.getSize(new V3()).multiplyScalar(0.5);
  const p = g.attributes.position, n = p.count, pd = new Float32Array(n * 4), pk = new Float32Array(n * 2), zf = bb.max.z;
  for (let i = 0; i < n; i += 3) {
    const front = [0, 1, 2].every(k => Math.abs(p.getZ(i + k) - zf) < 1e-3);
    for (let k = 0; k < 3; k++) { const j = i + k;
      if (front) { pd[j * 4] = p.getX(j) - c.x; pd[j * 4 + 1] = p.getY(j) - c.y; pd[j * 4 + 2] = h.x; pd[j * 4 + 3] = h.y; pk[j * 2] = seed; pk[j * 2 + 1] = kind; } }
  }
  const pos = Array.from(p.array);
  return fromArrays(pos, Array.from(pd), Array.from(pk), crease);
}
// shapes
export function roundRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x0 = cx - w / 2, y0 = cy - h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0); s.lineTo(x0 + w, y0 + h - r);
  s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2); s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5); return s;
}
export function polyShape(pts, holes = []) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(...p)));
  for (const h of holes) s.holes.push(h instanceof THREE.Path ? h : new THREE.Path(h.map(p => new THREE.Vector2(...p)))); return s; }
export const ngon = (n, r, a0 = 0, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(a0 + i * 2 * Math.PI / n), cy + r * Math.sin(a0 + i * 2 * Math.PI / n)]);
export function roundRectPath(w, h, r, cx = 0, cy = 0) { const s = roundRectShape(w, h, r, cx, cy); const p = new THREE.Path(); p.curves = s.curves; p.currentPoint = s.currentPoint; return p; }

// any three.js geometry -> mecha attribute layout (kind applies to every face)
export function std(geo, { kind = KIND.NONE, seed = 0, flat = false, crease = 0 } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  g.computeBoundingBox(); const c = g.boundingBox.getCenter(new V3()), h = g.boundingBox.getSize(new V3()).multiplyScalar(0.5);
  const pd = new Float32Array(n * 4), pk = new Float32Array(n * 2), p = g.attributes.position;
  for (let i = 0; i < n; i++) { pd[i * 4] = p.getX(i) - c.x; pd[i * 4 + 1] = p.getY(i) - c.y; pd[i * 4 + 2] = h.x; pd[i * 4 + 3] = h.y; pk[i * 2] = seed; pk[i * 2 + 1] = kind; }
  g.setAttribute('aPD', new THREE.BufferAttribute(pd, 4)); g.setAttribute('aPK', new THREE.BufferAttribute(pk, 2));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (flat) g.computeVertexNormals(); else if (crease) g = toCreasedNormals(g, crease * Math.PI / 180);
  else if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aPD', 'aPK'].includes(k)) g.deleteAttribute(k);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------
// Part: geometry collector -> one mesh per material
// ---------------------------------------------------------------------------------------------------------------------
export class Part {
  constructor(name) { this.name = name; this.items = new Map(); }
  add(key, geo, m = null) { const g = m ? geo.clone().applyMatrix4(m) : geo; if (!this.items.has(key)) this.items.set(key, []); this.items.get(key).push(g); return this; }
  build(mats) {
    const grp = new THREE.Group(); grp.name = this.name;
    for (const [key, list] of this.items) {
      const g = mergeGeometries(list, false); if (!g) { console.error('[mecha] merge failed', this.name, key); continue; }
      g.computeBoundingSphere(); const m = new THREE.Mesh(g, mats[key]); m.name = this.name + ':' + key; m.userData.matKey = key; m.frustumCulled = false; grp.add(m);
    }
    return grp;
  }
}
// matrix helpers
export const M = {
  t: (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z),
  r: (x, y, z, order = 'XYZ') => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z, order)),
  s: (x, y, z) => new THREE.Matrix4().makeScale(x, y, z),
  trs: (p, r, s = [1, 1, 1]) => new THREE.Matrix4().compose(new V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new V3(...s)),
  // basis: x axis along `dir`, origin p
  along: (p, dir, up = new V3(0, 1, 0)) => { const x = dir.clone().normalize(), z = new V3().crossVectors(x, Math.abs(x.dot(up)) > 0.95 ? new V3(0, 0, 1) : up).normalize(), y = new V3().crossVectors(z, x);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(p); },
  mul: (...ms) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4()),
};
// hex bolt heads (merged), at points p with normal n
export function bolts(list, { r = 0.55, h = 0.45, seg = 6 } = {}) {
  const proto = std(new THREE.CylinderGeometry(r, r * 1.08, h, seg, 1).translate(0, h / 2, 0), { flat: true });
  const gs = []; const q = new THREE.Quaternion();
  for (const [p, n] of list) { q.setFromUnitVectors(new V3(0, 1, 0), n.clone().normalize()); gs.push(proto.clone().applyMatrix4(new THREE.Matrix4().compose(p, q, new V3(1, 1, 1)))); }
  return gs.length ? mergeGeometries(gs, false) : null;
}
