// MEGA CLAWD · COCKPIT view (owner: pilot): what the pilot sees through the big visor window — a painted dome around the
// cabin (painted BG pixels: the gouache pass brushes it), one shader, three moods chosen per shot:
//   mode 0 'under'  (s12)  luminous cyan bay water, god rays from the surface, drifting silt, rocks, bubbles
//   mode 1 'sky'    (s18)  deep-blue sky, two walls of cumulus split by the burning meteor + its trail, the bay below
//   mode 2 'strato' (s26)  black-blue sky, the curve of the Earth, the 1 km meteor filling the view (glowing fissures,
//                          white-hot front) held by MEGA CLAWD's two terracotta arms with clamp hands
// Directions: az = atan(d.x, d.z) (0 = straight ahead, + = right... of the pilot = -x is left), el = asin(d.y).
// makeView(ctx) -> { mesh, set({ mode, t, shake, glow }), meteorUV(mode) -> [az, el] (for the HUD target box) }
export const METEOR = { sky: [-0.12, 0.34], strato: [0.0, 0.2] };   // [az, el] of the meteor centre per mode

export function makeView(ctx) {
  const { THREE } = ctx;
  const U = { uMode: { value: 1 }, uT: { value: 0 }, uShake: { value: 0 }, uGlow: { value: 1 }, uMS: { value: new THREE.Vector2(...METEOR.sky) }, uMT: { value: new THREE.Vector2(...METEOR.strato) } };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: true, uniforms: U,
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`${ctx.glsl.NOISE}
      uniform float uMode, uT, uShake, uGlow; uniform vec2 uMS, uMT; varying vec3 vD;
      float sat(float x){ return clamp(x, 0.0, 1.0); }
      // painted cumulus: billowy fbm silhouette above a flat base, lit tops, lavender shade
      vec3 cumulus(vec2 p, float base, float top, vec3 col, out float a){
        float h = (p.y - base) / (top - base); float n = fbm2(vec2(p.x * 3.2, p.y * 2.0) + 7.0) + 0.35 * fbm2(p * 9.0 + 3.0);
        a = smoothstep(0.0, 0.03, n - h * 0.85 - 0.18) * smoothstep(-0.02, 0.03, p.y - base);
        float nl = fbm2(vec2(p.x * 3.2, p.y * 2.0 - 0.06) + 7.0) - n; float lit = smoothstep(-0.02, 0.02, -nl + (h - 0.4) * 0.15);
        vec3 c = mix(vec3(0.66, 0.68, 0.9), vec3(0.93, 0.94, 1.0), lit); c = mix(c, vec3(1.0), smoothstep(0.55, 0.75, h) * lit);
        return c * col; }
      void main(){
        vec3 d = normalize(vD); float az = atan(d.x, d.z), el = asin(clamp(d.y, -1.0, 1.0));
        az += uShake * (sin(uT * 53.0) * 0.6 + sin(uT * 31.0) * 0.4) * 0.004; el += uShake * sin(uT * 47.0 + 1.0) * 0.003;
        vec3 col;
        if (uMode < 0.5) {   // ---- underwater ----
          float k = sat((el + 0.4) / 1.1);
          col = mix(vec3(0.03, 0.27, 0.36), vec3(0.18, 0.72, 0.8), pow(k, 0.9)); col = mix(col, vec3(0.75, 1.0, 0.97), smoothstep(0.55, 1.0, k));
          // god rays fanning down from the surface
          float ray = fbm2(vec2(az * 9.0 + el * 2.0, uT * 0.15)); ray = smoothstep(0.55, 0.75, ray) * smoothstep(-0.3, 0.6, el);
          col += vec3(0.55, 0.95, 0.9) * ray * 0.35;
          // seabed rocks + the bay floor at the bottom
          float rock = smoothstep(0.0, 0.02, -el - 0.12 + 0.08 * fbm2(vec2(az * 4.0, 1.0)));
          col = mix(col, mix(vec3(0.05, 0.3, 0.33), vec3(0.1, 0.42, 0.4), fbm2(vec2(az * 12.0, el * 12.0))), rock * 0.9);
          // drifting silt + bubbles
          vec2 sp = vec2(az * 40.0, el * 40.0 + uT * 0.6); vec2 ci = floor(sp), cf = fract(sp) - 0.5; float hh = h12(ci);
          col += vec3(0.8, 1.0, 1.0) * smoothstep(0.12, 0.02, length(cf - (vec2(h12(ci + 3.1), h12(ci + 7.7)) - 0.5) * 0.6)) * step(0.93, hh) * 0.5;
          vec2 bp = vec2(az * 14.0, el * 14.0 - uT * 1.2); vec2 bi = floor(bp), bf = fract(bp) - 0.5; float bh = h12(bi + 11.0);
          float br = length(bf - (vec2(h12(bi + 1.0), h12(bi + 2.0)) - 0.5) * 0.5); col += vec3(0.9, 1.0, 1.0) * (smoothstep(0.1, 0.08, br) - smoothstep(0.08, 0.05, br) * 0.6) * step(0.9, bh) * 0.8;
        } else if (uMode < 1.5) {   // ---- day sky + meteor ----
          float k = sat(el / 0.9);
          col = mix(vec3(0.74, 0.86, 1.0), vec3(0.28, 0.55, 0.96), smoothstep(0.0, 0.35, k)); col = mix(col, vec3(0.08, 0.3, 0.82), smoothstep(0.35, 1.0, k));
          vec2 mp = vec2(az, el) - uMS; float md = length(mp);
          // two walls of cumulus, split around the meteor's path
          float a1; vec3 c1 = cumulus(vec2(az * 0.8 - 0.6, el), 0.02, 0.5, vec3(1.0), a1); a1 *= smoothstep(0.08, 0.2, -(az - uMS.x) - 0.12 + el * 0.2);
          float a2; vec3 c2 = cumulus(vec2(az * 0.8 + 1.7, el), 0.02, 0.45, vec3(1.0), a2); a2 *= smoothstep(0.08, 0.2, (az - uMS.x) - 0.1 + el * 0.25);
          vec3 warm = vec3(1.0, 0.62, 0.38); float wk = exp(-md * 3.0) * 0.6;
          col = mix(col, c1 * mix(vec3(1.0), warm, wk), a1); col = mix(col, c2 * mix(vec3(1.0), warm, wk), a2);
          // trail (toward the upper right of the meteor), plasma halo, white-hot core
          vec2 td = normalize(vec2(0.55, 0.62)); float along = dot(mp, td), across = abs(dot(mp, vec2(-td.y, td.x)));
          float trail = smoothstep(0.0, 0.05, along) * exp(-along * 2.2) * smoothstep(0.02 + along * 0.12, 0.0, across);
          col += vec3(1.0, 0.45, 0.2) * trail * 1.6 + vec3(1.0, 0.9, 0.6) * trail * smoothstep(0.01 + along * 0.04, 0.0, across) * 1.5;
          col += vec3(1.0, 0.42, 0.18) * exp(-md * 18.0) * 2.0 * uGlow + vec3(1.0, 0.8, 0.5) * exp(-md * 60.0) * 3.0 * uGlow;
          col = mix(col, vec3(1.0, 0.98, 0.9) * 4.0, smoothstep(0.03, 0.022, md));
          // the bay below the horizon
          float sea = smoothstep(0.004, -0.004, el);
          vec3 sc = mix(vec3(0.16, 0.42, 0.78), vec3(0.06, 0.24, 0.6), sat(-el * 4.0)); sc += vec3(1.0) * step(0.88, fbm2(vec2(az * 60.0, el * 300.0) + uT)) * 0.35 * sat(1.0 + el * 6.0);
          col = mix(col, sc, sea);
        } else {   // ---- stratosphere: Earth, meteor, the arms ----
          col = mix(vec3(0.07, 0.16, 0.42), vec3(0.01, 0.02, 0.08), smoothstep(-0.1, 0.8, el));
          col += vec3(0.9) * step(0.995, h12(floor(vec2(az, el) * 300.0))) * smoothstep(0.1, 0.5, el);
          // Earth: curved horizon below, blue ocean + cloud swirls, bright limb
          float hz = -0.16 + 0.12 * az * az; float ed = el - hz;
          vec3 ec = mix(vec3(0.12, 0.38, 0.85), vec3(0.06, 0.2, 0.55), sat(-ed * 3.0)); float cl = fbm2(vec2(az * 6.0, ed * 18.0) + 2.0);
          ec = mix(ec, vec3(0.95, 0.97, 1.0), smoothstep(0.52, 0.6, cl)); col = mix(col, ec, smoothstep(0.003, -0.003, ed));
          col += vec3(0.45, 0.75, 1.0) * exp(-abs(ed) * 40.0) * 0.9;
          // the meteor: rough disc, rock shading, glowing fissures, white-hot lower face, plasma flaring at the rim
          vec2 mp = vec2(az, el) - uMT; float ang = atan(mp.y, mp.x); float R = 0.42 + 0.05 * fbm2(vec2(ang * 2.0, 3.0)) + 0.03 * sin(ang * 5.0);
          float md = length(mp) / R;
          if (md < 1.0) { vec2 q = mp / R; float z = sqrt(1.0 - min(1.0, dot(q, q))); vec3 n = normalize(vec3(q, z) + (vec3(fbm2(q * 5.0), fbm2(q * 5.0 + 3.0), 0.0) - 0.5) * 0.7);
            float lit = dot(n, normalize(vec3(-0.3, -0.7, 0.6))); vec3 rock = mix(vec3(0.09, 0.07, 0.08), vec3(0.3, 0.2, 0.17), smoothstep(-0.1, 0.2, lit));
            float fis = abs(fbm2(q * 4.0 + 9.0) - 0.5) + abs(fbm2(q * 9.0 + 2.0) - 0.5) * 0.5; float glow = smoothstep(0.06, 0.0, fis);
            rock = mix(rock, vec3(1.0, 0.42, 0.12) * 2.4 * uGlow, glow); rock += vec3(1.0, 0.75, 0.4) * smoothstep(0.02, 0.0, fis) * 1.5 * uGlow;
            float hot = smoothstep(-0.2, -0.85, q.y); rock = mix(rock, vec3(1.0, 0.93, 0.8) * 3.0, hot * smoothstep(0.75, 1.0, md) * 0.8 + hot * 0.25);
            col = rock; }
          col += vec3(1.0, 0.5, 0.2) * smoothstep(1.35, 1.0, md) * step(1.0, md) * (0.6 + 0.4 * fbm2(vec2(ang * 6.0, uT * 2.0))) * 1.6 * uGlow;
          // MEGA CLAWD's arms: from the lower corners up to the meteor, terracotta plates, bronze elbow, clamp fingers
          for (int s = 0; s < 2; s++) { float sx = s == 0 ? -1.0 : 1.0;
            vec2 a = vec2(sx * 1.0, -0.55), b = vec2(sx * 0.52, -0.02), p = vec2(az, el);
            vec2 pa = p - a, ba = b - a; float hh = sat(dot(pa, ba) / dot(ba, ba)); float dd = length(pa - ba * hh), w = mix(0.17, 0.11, hh);
            if (dd < w) { float side = dot(pa - ba * hh, normalize(vec2(-ba.y, ba.x))) / w * sx;
              vec3 ac = mix(vec3(0.62, 0.27, 0.18), vec3(0.85, 0.42, 0.28), step(0.0, side + 0.15 * sin(hh * 30.0) * 0.0));
              ac = mix(ac, vec3(0.2, 0.12, 0.12), smoothstep(0.9, 0.97, abs(side)));              // ink edge
              ac = mix(ac, vec3(0.25, 0.14, 0.12), step(0.985, fract(hh * 5.0)) * 0.8);           // panel lines
              ac = mix(ac, vec3(0.72, 0.56, 0.3), smoothstep(0.04, 0.0, abs(hh - 0.45)) );        // bronze elbow band
              ac += vec3(1.0, 0.5, 0.2) * hh * hh * 0.5 * uGlow;                                 // heat from the meteor
              col = ac; }
            // clamp fingers at b
            for (int f = 0; f < 3; f++) { float fa = (float(f) - 1.0) * 0.5 + (sx > 0.0 ? 2.2 : 0.95); vec2 tip = b + vec2(cos(fa), sin(fa)) * 0.12;
              vec2 fp = p - b, fb = tip - b; float fh = sat(dot(fp, fb) / dot(fb, fb)); if (length(fp - fb * fh) < 0.035 * (1.0 - fh * 0.4)) col = mix(vec3(0.36, 0.33, 0.36), vec3(0.6, 0.55, 0.55), step(0.5, fh)); } }
        }
        gl_FragColor = vec4(col, 1.0); }` });
  ctx.mat.mrt(m, { id: ctx.mat.ID.BG, sky: true });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(6, 64, 32, 0, Math.PI, 0, Math.PI), m);   // front hemisphere (+z)
  mesh.name = 'cockpit-view'; mesh.renderOrder = -8; mesh.raycast = () => {};
  const MODES = { under: 0, sky: 1, strato: 2 };
  return { mesh, U, set({ mode = 'sky', t = 0, shake = 0, glow = 1 } = {}) { U.uMode.value = MODES[mode] ?? 1; U.uT.value = t; U.uShake.value = shake; U.uGlow.value = glow; } };
}
