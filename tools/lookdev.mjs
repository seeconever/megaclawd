// Engine lookdev proof: one still per set through the full pipeline (placeholders) -> docs/engine-lookdev.jpg
//   node tools/lookdev.mjs [--scale 1] [--w 640]
// Prints Clawd's measured body hue / sat (target hue 13-18) and the mean luma per panel.
import fs from 'node:fs';
import path from 'node:path';
import { openFilm, opt, WORK, REPO, FPS } from './lib.mjs';
import { makeSheet } from './sheet.mjs';

const PANELS = [
  ['town', 'cam=70,16,30&at=-40,48,-320&fov=46', 1.5],
  ['pier', 'cam=2.25,2.95,1.75&at=-0.15,2.56,0&fov=34', 6.75],
  ['under', 'cam=1.8,-4.4,3.8&at=0,-10,14&fov=52&look=' + encodeURIComponent(JSON.stringify({ shafts: { pos: [0, 0, 26], k: 0.6, thr: 0.8 } })), 21.0],
  ['sky', 'cam=-430,2960,-310&at=0,2870,0&fov=40', 46.5],
  ['strato', 'cam=260,35110,560&at=0,34985,0&fov=46', 49.0],
  ['cockpit', 'cam=0.85,1.5,1.0&at=0,1.05,0&fov=42', 25.75],
];
const out = path.join(WORK, 'lookdev'); fs.mkdirSync(out, { recursive: true });
const files = [], labels = [];
for (const [name, q, t] of PANELS) {
  const film = await openFilm({ query: q, quiet: true });
  const buf = await film.frame(t, 'jpeg', 0.95), f = path.join(out, `${name}.jpg`); fs.writeFileSync(f, buf);
  const m = await film.page.evaluate(() => window.__mc.measureClawd()), st = await film.page.evaluate(() => window.__mc.stats());
  const clawd = m && m.n > 20 ? ` · Clawd hue ${m.hue.toFixed(1)} sat ${m.sat.toFixed(2)}` : '';
  console.log(`${name}: t ${t} Y ${st.yavg}${clawd}${film.errors.length ? ' ERR ' + film.errors.length : ''}`);
  files.push(f); labels.push(`${name}${clawd}`); await film.close();
}
const sheet = makeSheet(files, labels, path.join(REPO, 'docs', 'engine-lookdev.jpg'), { cols: 3, w: +opt('w', 640), quality: 2 });
console.log('lookdev ->', sheet);
