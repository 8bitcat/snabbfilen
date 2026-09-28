// Kontaktark ur den FÄRDIGA möbelatlasen: varje ruta i assets/interior.png (enligt
// js/data/frames.js) ritas förstorad med sin nyckel under, sorterad per sort, så att
// man kan syna att varje ruta är hel och rätt beskuren. Kör:
//   node tools/atlas-sheet.mjs [ut.png] [skala] [--only kind1,kind2] [--except kind1,kind2]   (default tools/out/atlas-ark.png, 3×)
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'tools/out/atlas-ark.png';
const scale = +(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 3);
const onlyI = process.argv.indexOf('--only');
const only = onlyI > 0 ? process.argv[onlyI + 1].split(',') : null;
const exceptI = process.argv.indexOf('--except');
const except = new Set(exceptI > 0 ? process.argv[exceptI + 1].split(',') : []);
const { FRAMES } = await import('../js/data/frames.js');
const png = fs.readFileSync('assets/interior.png').toString('base64');

// gruppera per sort (nyckel utan siffrorna på slutet), i frames.js-ordning
const groups = new Map();
for (const [key, f] of Object.entries(FRAMES)) {
  const kind = key.replace(/\d+$/, '');
  if (only && !only.includes(kind)) continue;
  if (except.has(kind)) continue;
  if (!groups.has(kind)) groups.set(kind, []);
  groups.get(kind).push({ key, f });
}

const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(async ({ png, groups, scale }) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + png;
  await img.decode();
  const PAD = 6 * scale, LBL = 12, COLS_W = 1400;
  // lägg ut sort för sort: alla varianter på en rad (radbryt vid kanten)
  const cells = [];
  let x = PAD, y = PAD, rowH = 0;
  for (const [kind, list] of groups) {
    const w = list[0].f[2] * scale + 4, h = list[0].f[3] * scale + LBL + 4;
    if (x + list.length * (w + 4) > COLS_W && x > PAD) { x = PAD; y += rowH + PAD; rowH = 0; }
    for (const it of list) {
      if (x + w > COLS_W) { x = PAD; y += rowH + PAD; rowH = 0; }
      cells.push({ ...it, x, y, w, h, kind });
      x += w + 4; rowH = Math.max(rowH, h);
    }
    x += PAD;
  }
  const H = y + rowH + PAD;
  const c = document.createElement('canvas'); c.width = COLS_W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, COLS_W, H);
  ctx.font = '10px monospace'; ctx.textBaseline = 'top';
  for (const cell of cells) {
    const [sx, sy, sw, sh] = cell.f;
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.fillStyle = '#c8c0b0'; ctx.fillRect(cell.x + 2, cell.y + 2, sw * scale, sh * scale);
    ctx.drawImage(img, sx, sy, sw, sh, cell.x + 2, cell.y + 2, sw * scale, sh * scale);
    ctx.fillStyle = '#000'; ctx.fillText(cell.key, cell.x + 2, cell.y + 3 + sh * scale);
  }
  return c.toDataURL('image/png');
}, { png, groups: [...groups], scale });
await browser.close();
fs.mkdirSync('tools/out', { recursive: true });
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(`${groups.size} sorter, ${[...groups.values()].reduce((a, l) => a + l.length, 0)} rutor → ${out}`);
