// Bygger spelets möbelatlas ur de köpta EmanuelleDev-arken (Palssons Gård).
// Bara de sprites spelet använder bäddas in (licenskravet). Skriver
// assets/interior.png + js/data/frames.js. Kör: node tools/build-atlas.mjs
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const SRC = 'D:/GamesProjects/Palssons Gard/assets/Objects/Interior/';
const B = 'Beds.png', S = 'Sofa and armchair.png', C = 'Closet.png', T = 'Tables and desks.png';
const P1 = 'Part 1 copiar.png', P2 = 'Part 2 copiar.png', P9 = 'Part 9 copiar.png';
const O = 'Others.png', F = 'Fireplace.png', CH = 'Chairs.png', D = 'Dressers.png';

// [namn, fil, sx, sy, sw, sh] – namn = kind + variantindex
const PICKS = [
  // dubbelsängar (6 färger)
  ['sang0', B, 7, 269, 33, 34], ['sang1', B, 55, 269, 33, 34], ['sang2', B, 103, 269, 33, 34],
  ['sang3', B, 151, 269, 33, 34], ['sang4', B, 247, 269, 33, 34], ['sang5', B, 343, 269, 33, 34],
  // soffor (6)
  ['soffa0', S, 2, 11, 29, 20], ['soffa1', S, 34, 11, 29, 20], ['soffa2', S, 130, 11, 29, 20],
  ['soffa3', S, 162, 11, 29, 20], ['soffa4', S, 226, 11, 29, 20], ['soffa5', S, 290, 11, 29, 20],
  // fåtöljer (4)
  ['fatolj0', S, 296, 107, 17, 20], ['fatolj1', S, 136, 107, 17, 20], ['fatolj2', S, 200, 107, 17, 20], ['fatolj3', S, 264, 107, 17, 20],
  // garderober (4 – bruna raden)
  ['garderob0', C, 69, 296, 35, 38], ['garderob1', C, 181, 296, 35, 38], ['garderob2', C, 293, 296, 35, 38], ['garderob3', C, 405, 296, 35, 38],
  // kylskåp (2)
  ['kylskap0', P9, 160, 0, 16, 48], ['kylskap1', P9, 320, 0, 16, 48],
  // TV (2: platt + retro)
  ['tv0', P2, 136, 72, 48, 23], ['tv1', P2, 4, 10, 24, 20],
  // runda bord (4) + matbord (4)
  ['bordR0', T, 6, 230, 22, 20], ['bordR1', T, 37, 230, 22, 21], ['bordR2', T, 101, 230, 22, 21], ['bordR3', T, 133, 230, 22, 21],
  ['bordM0', T, 136, 8, 51, 20], ['bordM1', T, 136, 72, 51, 20], ['bordM2', T, 136, 104, 51, 20], ['bordM3', T, 136, 136, 51, 20],
  // stolar (4)
  ['stol0', CH, 2, 10, 13, 21], ['stol1', CH, 65, 10, 13, 21], ['stol2', CH, 2, 42, 13, 21], ['stol3', CH, 65, 42, 13, 21],
  // byråer (4)
  ['byra0', D, 0, 40, 48, 18], ['byra1', D, 64, 40, 48, 18], ['byra2', D, 128, 40, 48, 18], ['byra3', D, 192, 40, 48, 18],
  // bokhyllor (3)
  ['bokhylla0', O, 39, 45, 34, 35], ['bokhylla1', O, 1, 46, 30, 34], ['bokhylla2', O, 81, 48, 30, 32],
  // speglar (3)
  ['spegel0', O, 1, 7, 14, 25], ['spegel1', O, 17, 7, 14, 25], ['spegel2', O, 33, 7, 14, 25],
  // öppna spisar (3)
  ['spis0', F, 34, 6, 28, 42], ['spis1', F, 98, 6, 28, 42], ['spis2', F, 130, 6, 28, 42],
  // lampor (2) + sprite-växter (2)
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
  // egna frames ritade med kod i samma stil (mörk kontur, 3 toner)
  const CUSTOM = [['lampa0', 14, 36], ['lampa1', 14, 36], ['vaxtS0', 22, 40]];
  const PAD = 2, COLS = 12;
  const all = [...PICKS.map((p) => [p[0], p[4], p[5]]), ...CUSTOM];
  const cellW = Math.max(...all.map((p) => p[1])) + PAD;
  const cellH = Math.max(...all.map((p) => p[2])) + PAD;
  const W = COLS * cellW + PAD, H = Math.ceil(all.length / COLS) * cellH + PAD;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const frames = {};
  PICKS.forEach(([name, file, sx, sy, sw, sh], i) => {
    const cx = PAD + (i % COLS) * cellW, cy = PAD + ((i / COLS) | 0) * cellH;
    x.drawImage(imgs[file], sx, sy, sw, sh, cx, cy, sw, sh);
    frames[name] = [cx, cy, sw, sh];
  });
  const r = (px, py, w, h, c) => { x.fillStyle = c; x.fillRect(px, py, w, h); };
  CUSTOM.forEach(([name, w, h], j) => {
    const i = PICKS.length + j;
    const ox = PAD + (i % COLS) * cellW, oy = PAD + ((i / COLS) | 0) * cellH;
    if (name.startsWith('lampa')) {
      const shade = name === 'lampa0' ? ['#3a2618', '#f4e6c0', '#e0c890', '#fff8e0'] : ['#2a0e14', '#c9323a', '#9e1b22', '#e86a70'];
      const metal = name === 'lampa0' ? ['#5a4418', '#d8b24a', '#fbe7a0'] : ['#0e0d12', '#2a2d33', '#5a5f6a'];
      r(ox + 3, oy, 8, 1, shade[0]); r(ox + 2, oy + 1, 10, 1, shade[0]); r(ox + 1, oy + 2, 12, 8, shade[0]);
      r(ox + 3, oy + 1, 8, 1, shade[3]); r(ox + 2, oy + 2, 10, 7, shade[1]); r(ox + 9, oy + 2, 3, 7, shade[2]); r(ox + 3, oy + 2, 2, 5, shade[3]);
      r(ox + 6, oy + 10, 3, 22, metal[0]); r(ox + 7, oy + 10, 1, 22, metal[1]);
      r(ox + 2, oy + 32, 11, 4, metal[0]); r(ox + 3, oy + 32, 9, 2, metal[1]); r(ox + 4, oy + 32, 4, 1, metal[2]);
    } else {
      r(ox + 5, oy + 28, 12, 12, '#3a1a0e'); r(ox + 6, oy + 29, 10, 10, '#b5652f'); r(ox + 6, oy + 29, 10, 2, '#d8864a'); r(ox + 13, oy + 31, 3, 8, '#8a4a22');
      const leaf = (cx, cy, rx, ry) => {
        for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
          const d = Math.hypot(xx / rx, yy / ry);
          if (d >= 1) continue;
          x.fillStyle = d > 0.78 ? '#1a4a26' : xx === 0 ? '#7fd48a' : (xx + yy < 0 ? '#5fbf6e' : '#2f8f46');
          x.fillRect(ox + cx + xx, oy + cy + yy, 1, 1);
        }
      };
      r(ox + 10, oy + 14, 2, 15, '#2c6e3a');
      leaf(6, 18, 5, 4); leaf(16, 16, 5, 4); leaf(11, 8, 5, 5); leaf(5, 26, 4, 3); leaf(17, 25, 4, 3); leaf(12, 19, 4, 3);
    }
    frames[name] = [ox, oy, w, h];
  });
  return { png: c.toDataURL('image/png'), frames };
}, { sheets, PICKS });
await browser.close();

fs.mkdirSync('assets', { recursive: true });
fs.mkdirSync('js/data', { recursive: true });
fs.writeFileSync('assets/interior.png', Buffer.from(out.png.split(',')[1], 'base64'));
fs.writeFileSync('js/data/frames.js', '// Genererad av tools/build-atlas.mjs – redigera inte för hand.\nexport const FRAMES = ' + JSON.stringify(out.frames) + ';\n');
console.log('frames:', Object.keys(out.frames).length, '→ assets/interior.png + js/data/frames.js');
