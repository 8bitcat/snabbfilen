// Bygger spelets möbelatlas ur de köpta EmanuelleDev-arken (Palssons Gård).
// Bara de sprites spelet använder bäddas in (licenskravet). Skriver
// assets/interior.png + frames till stdout. Kör: node tools/build-atlas.mjs
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const SRC = 'D:/GamesProjects/Palssons Gard/assets/Objects/Interior/';
// [namn, fil, sx, sy, sw, sh]
const PICKS = [
  ['sang', 'Beds.png', 7, 269, 33, 34],
  ['garderob', 'Closet.png', 69, 296, 35, 38],
  ['kylskap', 'Part 9 copiar.png', 160, 0, 16, 48],
  ['soffa', 'Sofa and armchair.png', 2, 11, 29, 20],
  ['fatolj', 'Sofa and armchair.png', 296, 107, 17, 20],
  ['tv', 'Part 2 copiar.png', 136, 72, 48, 23],
  ['bord', 'Tables and desks.png', 6, 230, 22, 20],
  ['bokhylla', 'Others.png', 39, 45, 34, 35],
  ['spis', 'Fireplace.png', 34, 6, 28, 42],
  ['lampa', 'Part 1 copiar.png', 17, 82, 14, 30],
];

const sheets = {};
for (const [, file] of PICKS) if (!sheets[file]) sheets[file] = fs.readFileSync(SRC + file).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ sheets, PICKS }) => {
  const imgs = {};
  for (const [file, b64] of Object.entries(sheets)) {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b64;
    await im.decode();
    imgs[file] = im;
  }
  const PAD = 2;
  const W = PICKS.reduce((a, p) => a + p[4] + PAD, PAD);
  const H = Math.max(...PICKS.map((p) => p[5])) + PAD * 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const frames = {};
  let cx = PAD;
  for (const [name, file, sx, sy, sw, sh] of PICKS) {
    x.drawImage(imgs[file], sx, sy, sw, sh, cx, PAD, sw, sh);
    frames[name] = [cx, PAD, sw, sh];
    cx += sw + PAD;
  }
  return { png: c.toDataURL('image/png'), frames };
}, { sheets, PICKS });
await browser.close();

fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/interior.png', Buffer.from(out.png.split(',')[1], 'base64'));
console.log('FRAMES = ' + JSON.stringify(out.frames));
