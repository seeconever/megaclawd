// MEGA CLAWD · COCKPIT displays (owner: pilot): hand-lettered cockpit screens and the HUD on the visor glass, painted
// on 2D canvases every frame as a pure function of (t, state). Anime mecha UI: cyan line-art on deep navy, amber
// accents, red when the alarm runs. Lettering is "hand-drawn": every glyph gets a fixed small tilt / size / offset.
//   makeScreens(kit) -> { main, radar, gauges, stripL, stripR, hud, tallL, tallR, lamps, warn, draw(t, st) }   (each: { tex, w, h })
//   st = { on 0..1 (boot), alarm 0..1, mode 'under'|'sky'|'strato', load 0..1+, thrust 0..1, target: [u, v] | null }
const CY = '#6ff2ff', CY2 = '#2fb8e6', AMB = '#ffc35a', RED = '#ff4a3a', NAVY = '#0a1a33', WHITE = '#eafcff';
const JP = '"Yu Gothic UI", "Yu Gothic", "Meiryo", "MS Gothic", sans-serif', EN = '"Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif';
const hsh = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// hand-lettered text: per-glyph jitter (fixed by the glyph index + seed), optional glow
function hand(c, text, x, y, { size = 24, font = EN, color = CY, align = 'left', seed = 1, glow = 8, weight = 700, spacing = 0.04 } = {}) {
  c.save(); c.font = `${weight} ${size}px ${font}`; c.fillStyle = color; c.shadowColor = color; c.shadowBlur = glow; c.textBaseline = 'middle';
  const ws = [...text].map(ch => c.measureText(ch).width + size * spacing), W = ws.reduce((a, b) => a + b, 0);
  let px = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x;
  [...text].forEach((ch, i) => { const r = hsh(seed * 31 + i * 7.3); c.save(); c.translate(px + ws[i] / 2, y + (r - 0.5) * size * 0.08);
    c.rotate((hsh(seed * 17 + i * 3.1) - 0.5) * 0.09); const s = 1 + (r - 0.5) * 0.08; c.scale(s, s); c.textAlign = 'center'; c.fillText(ch, 0, 0); c.restore(); px += ws[i]; });
  c.restore(); return W;
}
const line = (c, pts, col, w = 2, glow = 6) => { c.save(); c.strokeStyle = col; c.lineWidth = w; c.shadowColor = col; c.shadowBlur = glow; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore(); };
const frame = (c, w, h, col) => { line(c, [[10, 30], [10, 10], [40, 10]], col, 3); line(c, [[w - 40, 10], [w - 10, 10], [w - 10, 30]], col, 3);
  line(c, [[10, h - 30], [10, h - 10], [40, h - 10]], col, 3); line(c, [[w - 40, h - 10], [w - 10, h - 10], [w - 10, h - 30]], col, 3); };
const bg = (c, w, h, alarm, on) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, alarm > 0.5 ? '#3a0a10' : '#0c2444'); g.addColorStop(1, alarm > 0.5 ? '#1a0408' : NAVY);
  c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalAlpha = 0.18; c.fillStyle = alarm > 0.5 ? '#ff6050' : '#5fe0ff';
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1); c.globalAlpha = 1; if (on < 1) { c.fillStyle = `rgba(0,0,0,${1 - on})`; c.fillRect(0, 0, w, h); } };

export function makeScreens(kit) {
  const mk = (w, h) => { const tex = kit.canvasTex(w, h, () => {}, { mips: false }); return { tex, w, h, c: tex.userData.canvas.getContext('2d') }; };
  const S = { main: mk(768, 384), radar: mk(384, 384), gauges: mk(512, 256), stripL: mk(512, 112), stripR: mk(512, 112), hud: mk(1536, 640),
    tallL: mk(256, 512), tallR: mk(256, 512), lamps: mk(2048, 32), warn: mk(512, 256) };
  S.draw = (t, st) => {
    const { on = 1, alarm = 0, mode = 'sky', load = 0.4, thrust = 0.3, target = null } = st, A = alarm > 0.5, blink = Math.floor(t * 4) % 2 === 0;
    const C1 = A ? RED : CY, C2 = A ? '#ff8a6a' : CY2;
    // ---- big warning panel (s26): hazard frame, 警告 OVERLOAD, flashing red / dark on twos ----
    { const { c, w, h } = S.warn, fl = A && Math.floor(t * 6) % 2 === 0;
      c.fillStyle = fl ? '#e8231c' : '#1a0306'; c.fillRect(0, 0, w, h);
      c.save(); c.beginPath(); c.rect(0, 0, w, h); c.rect(18, 18, w - 36, h - 36); c.clip('evenodd'); c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#16161c'; for (let x = -h; x < w + h; x += 36) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.lineTo(x + h + 18, 0); c.lineTo(x + 18, h); c.fill(); } c.restore();
      if (A) { hand(c, '警告', w / 2, h * 0.42, { size: 104, font: JP, color: fl ? '#fff4e8' : RED, align: 'center', seed: 201, glow: fl ? 4 : 16, weight: 900 });
        hand(c, 'OVERLOAD', w / 2, h * 0.78, { size: 40, color: fl ? '#fff4e8' : RED, align: 'center', seed: 202, glow: 6, weight: 800, spacing: 0.12 }); }
      else hand(c, '待機 STANDBY', w / 2, h / 2, { size: 40, font: JP, color: '#3a7a8a', align: 'center', seed: 203, glow: 0 }); }
    // ---- main status screen: CLAWD-01 silhouette + bars ----
    { const { c, w, h } = S.main; c.clearRect(0, 0, w, h); bg(c, w, h, alarm, on);
      if (on > 0.05) {
        hand(c, 'CLAWD-01', 26, 36, { size: 34, color: C1, seed: 3 }); hand(c, '巨神', 230, 38, { size: 30, font: JP, color: AMB, seed: 4 });
        hand(c, A ? '警告 OVERLOAD' : mode === 'under' ? '起動 BOOT' : '発進 LAUNCH', w - 24, 36, { size: 26, color: A ? (blink ? RED : '#ffd0c0') : AMB, align: 'right', seed: 5, font: JP });
        // mecha silhouette (front view: block body, visor, four legs, arms)
        c.save(); c.translate(150, 210); c.strokeStyle = C1; c.lineWidth = 3; c.shadowColor = C1; c.shadowBlur = 8;
        c.strokeRect(-80, -70, 160, 115); c.strokeRect(-56, -48, 112, 34); for (const x of [-60, -24, 24, 60]) c.strokeRect(x - 10, 45, 20, 40);
        c.strokeRect(-104, -30, 24, 34); c.strokeRect(80, -30, 24, 34);
        c.fillStyle = A ? (blink ? RED : '#7a1a10') : AMB; c.fillRect(-40, -40, 20, 18); c.fillRect(20, -40, 20, 18);
        c.beginPath(); c.arc(0, 18, 12, 0, Math.PI * 2); c.fillStyle = A ? '#ffb0a0' : '#8ff6ff'; c.fill(); c.restore();
        const bars = [['反応炉 REACTOR', A ? 1.0 : 0.55 + 0.05 * Math.sin(t * 3)], ['推力 THRUST', thrust], ['装甲 ARMOR', A ? 0.38 + 0.04 * Math.sin(t * 17) : 0.96], ['負荷 LOAD', Math.min(1, load)]];
        bars.forEach(([lab, v], i) => { const y = 112 + i * 62, x = 300; hand(c, lab, x, y, { size: 21, font: JP, color: C2, seed: 10 + i });
          c.strokeStyle = C2; c.lineWidth = 2; c.strokeRect(x, y + 16, 420, 22); const n = 20, k = Math.max(0, Math.min(1, v)) * on;
          for (let j = 0; j < n; j++) { if (j / n >= k) break; c.fillStyle = j > 15 ? RED : j > 11 ? AMB : C1; c.fillRect(x + 4 + j * 20.8, y + 20, 16, 14); }
          hand(c, `${Math.round(v * 100)}%`, x + 420, y, { size: 20, color: v > 0.85 ? RED : C1, align: 'right', seed: 20 + i }); });
        frame(c, w, h, C2);
      } }
    // ---- radar: sweep + the meteor blip ----
    { const { c, w, h } = S.radar; c.clearRect(0, 0, w, h); bg(c, w, h, alarm, on);
      if (on > 0.05) { const cx = w / 2, cy = h / 2 + 10, R = 150; c.save(); c.strokeStyle = C2; c.lineWidth = 1.5; c.shadowColor = C2; c.shadowBlur = 6;
        for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(cx, cy, R * r / 3, 0, Math.PI * 2); c.stroke(); }
        c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke(); c.restore();
        const a = t * 2.4; const g = c.createConicGradient ? c.createConicGradient(a - 0.9, cx, cy) : null;
        if (g) { g.addColorStop(0, 'rgba(111,242,255,0)'); g.addColorStop(0.14, A ? 'rgba(255,74,58,0.55)' : 'rgba(111,242,255,0.5)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); }
        const br = mode === 'under' ? 0.85 : mode === 'sky' ? 0.45 : 0.06, bx = cx + R * br * 0.3, by = cy - R * br;
        if (blink || A) { c.fillStyle = mode === 'strato' ? RED : AMB; c.shadowColor = c.fillStyle; c.shadowBlur = 14; c.beginPath(); c.arc(bx, by, mode === 'strato' ? 22 : 8, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; }
        hand(c, '索敵 SCAN', 16, 26, { size: 22, font: JP, color: C1, seed: 31 });
        hand(c, mode === 'strato' ? 'CONTACT' : `${(mode === 'under' ? 812 : 96 - (t % 10)).toFixed(1)} km`, w - 14, h - 22, { size: 22, color: A ? RED : AMB, align: 'right', seed: 32 }); } }
    // ---- gauges: two needle dials ----
    { const { c, w, h } = S.gauges; c.clearRect(0, 0, w, h); bg(c, w, h, alarm, on);
      if (on > 0.05) { [['出力', A ? 0.97 + 0.03 * Math.sin(t * 40) : 0.5 + 0.2 * thrust], ['圧力', A ? 0.9 + 0.08 * Math.sin(t * 23) : 0.35 + 0.05 * Math.sin(t * 2)]].forEach(([lab, v], i) => {
          const cx = 128 + i * 256, cy = 150, R = 92; c.save(); c.strokeStyle = C2; c.lineWidth = 3; c.shadowColor = C2; c.shadowBlur = 6; c.beginPath(); c.arc(cx, cy, R, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
          for (let k = 0; k <= 10; k++) { const a = Math.PI * (0.8 + 1.4 * k / 10); c.strokeStyle = k > 7 ? RED : C2; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
          const a = Math.PI * (0.8 + 1.4 * Math.min(1, v * on)); c.strokeStyle = A ? RED : AMB; c.lineWidth = 5; c.shadowColor = c.strokeStyle; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); c.stroke();
          c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fill(); c.restore();
          hand(c, lab, cx, cy + 62, { size: 26, font: JP, color: C1, align: 'center', seed: 40 + i }); }); } }
    // ---- strips: scrolling hand-lettered status lines ----
    for (const [S2, lines, sd] of [[S.stripL, A ? ['!! 過負荷 !!', 'ARM LOAD 312%', 'PLATE 7 BUCKLE', 'COOLANT LOW'] : ['SYS ALL GREEN', '姿勢制御 OK', 'HYDRO 正常', 'SONAR LINK'], 50],
      [S.stripR, A ? ['REACTOR MAX', '限界突破', 'HOLD ON!!', 'SURGE READY'] : ['PILOT CLAWD', 'SYNC 98.2%', '巨神 ONLINE', 'GO!'], 60]]) {
      const { c, w, h } = S2; c.clearRect(0, 0, w, h); bg(c, w, h, alarm, on);
      if (on > 0.05) { const k = Math.floor(t * 2.5); for (let i = 0; i < 2; i++) { const ln = lines[(k + i) % lines.length];
        hand(c, ln, 18, 30 + i * 48, { size: 30, font: JP, color: i ? C2 : (A && blink ? RED : C1), seed: sd + (k + i) % lines.length }); } } }
    // ---- HUD on the visor glass (additive line art; transparent elsewhere) ----
    { const { c, w, h } = S.hud; c.clearRect(0, 0, w, h); c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      if (on > 0.05) { const col = A ? RED : CY, a = on; c.globalAlpha = 0.75 * a;
        frame(c, w, h, col);
        // centre reticle + pitch ladder
        const cx = w / 2, cy = h * 0.48; line(c, [[cx - 60, cy], [cx - 18, cy]], col, 2); line(c, [[cx + 18, cy], [cx + 60, cy]], col, 2); line(c, [[cx, cy - 46], [cx, cy - 16]], col, 2);
        c.save(); c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 6; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 30, 0.3, Math.PI - 0.3); c.stroke(); c.restore();
        for (let i = -2; i <= 2; i++) { if (!i) continue; const y = cy + i * 70; line(c, [[cx - 260, y], [cx - 200, y]], col, 1.5, 4); line(c, [[cx + 200, y], [cx + 260, y]], col, 1.5, 4);
          hand(c, String(-i * 10), cx - 272, y, { size: 16, color: col, align: 'right', seed: 70 + i, glow: 4 }); }
        hand(c, mode === 'under' ? '深度 DEPTH 38.4m' : mode === 'sky' ? 'ALT 0042m' : '高度 ALT 35.1km', 40, 44, { size: 26, color: col, font: JP, seed: 80 });
        hand(c, A ? '警告 WARNING' : mode === 'under' ? 'SYSTEM 起動中...' : '目標 TARGET LOCK', w - 40, 44, { size: 26, color: A ? (blink ? RED : '#ffe0d0') : AMB, font: JP, align: 'right', seed: 81 });
        // target box (meteor) in HUD space
        if (target) { const [u, v] = target, x = u * w, y = (1 - v) * h, s = mode === 'strato' ? 160 : 46 + 6 * Math.sin(t * 6);
          c.globalAlpha = a; line(c, [[x - s, y - s + 16], [x - s, y - s], [x - s + 16, y - s]], A ? RED : AMB, 3); line(c, [[x + s - 16, y - s], [x + s, y - s], [x + s, y - s + 16]], A ? RED : AMB, 3);
          line(c, [[x - s, y + s - 16], [x - s, y + s], [x - s + 16, y + s]], A ? RED : AMB, 3); line(c, [[x + s - 16, y + s], [x + s, y + s], [x + s, y + s - 16]], A ? RED : AMB, 3);
          hand(c, mode === 'strato' ? '隕石 1.2km  PUSH!!' : '隕石 METEOR', x + s + 12, y - s + 10, { size: 22, font: JP, color: A ? RED : AMB, seed: 90 }); }
        if (A) { c.globalAlpha = blink ? 0.9 : 0.4; for (let i = 0; i < 12; i++) { const x = 60 + i * 120; c.fillStyle = RED; c.beginPath(); c.moveTo(x, h - 46); c.lineTo(x + 40, h - 46); c.lineTo(x + 70, h - 20); c.lineTo(x + 30, h - 20); c.closePath(); c.fill(); } }
        c.globalAlpha = 1; } }
    // ---- tall rear-wall columns: vertical bar meters + vertical hand-lettered kanji ----
    for (const [S2, word, sd] of [[S.tallL, A ? '限界' : '出力', 110], [S.tallR, A ? '危険' : '同調', 120]]) {
      const { c, w, h } = S2; c.clearRect(0, 0, w, h); bg(c, w, h, alarm, on);
      if (on > 0.05) { [...word].forEach((ch, i) => hand(c, ch, 40, 52 + i * 64, { size: 52, font: JP, color: i ? C2 : C1, seed: sd + i, align: 'center' }));
        for (let b = 0; b < 4; b++) { const x = 92 + b * 38, v = A ? 0.75 + 0.25 * Math.sin(t * (13 + b * 5) + b) : 0.45 + 0.3 * Math.sin(t * (1.3 + b * 0.7) + b * 2);
          const n = 14, k = Math.max(0, Math.min(1, v)) * on; for (let j = 0; j < n; j++) { const y = h - 26 - j * ((h - 60) / n); c.globalAlpha = j / n < k ? 1 : 0.16;
            c.fillStyle = j > 11 ? RED : j > 8 ? AMB : C1; c.fillRect(x, y - 12, 28, 10); } c.globalAlpha = 1; }
        hand(c, A ? 'MAX' : `${Math.round(60 + 30 * Math.sin(t * 0.7 + sd))}`, w - 16, 22, { size: 20, color: A ? RED : AMB, align: 'right', seed: sd + 9 }); frame(c, w, h, C2); } }
    // ---- lamp ring (wall band all around the cabin): steady cyan / boot cascade / red chase ----
    { const { c, w, h } = S.lamps, n = 56; c.fillStyle = '#10141e'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) { const x = (i + 0.5) * w / n, u = i / n, lit = Math.min(1, Math.max(0, (on * 1.25 - Math.abs(u - 0.5) * 2) * 4));
        let col = i % 7 === 3 ? AMB : CY, a = 0.15 + 0.85 * lit;
        if (A) { col = RED; a = 0.18 + 0.82 * Math.max(0, Math.sin(t * 10 - i * 0.55)) ** 2; }
        c.save(); c.globalAlpha = a; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.ellipse(x, h / 2, w / n * 0.28, h * 0.3, 0, 0, Math.PI * 2); c.fill(); c.restore(); } }
    for (const k of ['main', 'radar', 'gauges', 'stripL', 'stripR', 'hud', 'tallL', 'tallR', 'lamps', 'warn']) S[k].tex.needsUpdate = true;
  };
  return S;
}
