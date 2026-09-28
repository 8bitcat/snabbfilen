// Bilder av husdjurslagret i attrapprummet (tools/pets-room-preview.html) via Playwright.
//   node tools/pets-room-snap.mjs --scene hem --hour 12 --warm 4 --out tools/out/pets-room.png
//   node tools/pets-room-snap.mjs --scene prylar --out tools/out/pets-items.png
//   node tools/pets-room-snap.mjs --scene ute --warm 3 --seq 12 --dt 0.08 --crop 0,110,384,100 --out tools/out/pets-ute-seq.png
//   --seq N      N bildrutor med --dt sekunders mellanrum, staplade uppifrån och ned i en bild
//   --crop x,y,w,h  (logiska px) beskär varje ruta; --k 4 = skala; --js "PV.click(10,20)" körs före
//   --speed 60   spelminuter per sekund (simuleringen tickar), --seed 11
// Skriver ut konsolfel från sidan – "Inga konsolfel." betyder rent.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const port = arg('port', '8788');
const scene = arg('scene', 'hem');
const out = arg('out', `tools/out/pets-${scene}.png`);
const K = +arg('k', 4);
const hour = +arg('hour', 12);
const warm = +arg('warm', 2);
const seq = +arg('seq', 1);
const dt = +arg('dt', 0.08);
const crop = arg('crop', null);
const js = arg('js', null);
const js2 = arg('js2', null);
const speed = +arg('speed', 0);
const seed = +arg('seed', 11);
const cols = +arg('cols', 1);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 384 * K + 40, height: 216 * K + 300 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); else if (arg('log', false)) console.log('[sida]', m.text()); });
await page.goto(`http://localhost:${port}/tools/pets-room-preview.html?manual=1&k=${K}&scene=${scene}&hour=${hour}&speed=${speed}&v=${Date.now()}`);
await page.waitForFunction(() => window.PV && window.PV.ready, null, { timeout: 10000 });
await page.evaluate(({ scene, hour, seed }) => window.PV.setup(scene, { hour, seed }), { scene, hour, seed });
if (js) console.log('js →', await page.evaluate(js));
await page.evaluate((w) => { window.PV.advance(w); window.PV.render(); }, warm);
if (js2) console.log('js2 →', await page.evaluate(js2));

const [cx, cy, cw, ch] = crop ? String(crop).split(',').map(Number) : [0, 0, 384, 216];
const url = await page.evaluate(({ seq, dt, cx, cy, cw, ch, K, cols }) => {
  const src = document.getElementById('c');
  const rows = Math.ceil(seq / cols);
  const o = document.createElement('canvas');
  o.width = cw * K * cols + (cols - 1) * 4; o.height = ch * K * rows + (rows - 1) * 4;
  const x = o.getContext('2d');
  x.fillStyle = '#ff00ff'; x.fillRect(0, 0, o.width, o.height);
  for (let i = 0; i < seq; i++) {
    if (i) { window.PV.advance(dt); }
    window.PV.render();
    const c = i % cols, r = Math.floor(i / cols);
    x.drawImage(src, cx * K, cy * K, cw * K, ch * K, c * (cw * K + 4), r * (ch * K + 4), cw * K, ch * K);
  }
  return o.toDataURL('image/png');
}, { seq, dt, cx, cy, cw, ch, K, cols });
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
const infoTxt = await page.evaluate(() => document.getElementById('info').textContent);
console.log(infoTxt);
console.log('skrev', out);
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
