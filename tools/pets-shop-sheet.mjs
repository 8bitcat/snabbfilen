// Snabbtitt på husdjurssprites + prylar i skala (för djuraffären). node tools/pets-shop-sheet.mjs --out tools/out/djur-sheet.png
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const out = arg('out', 'tools/out/djur-sheet.png');
const S = +arg('scale', 4);
const DIR = arg('dir', 'right'), ANIM = arg('anim', 'idle');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:8788/index.html?world=sheet' + Date.now().toString(36));
const url = await page.evaluate(async ([S, process_dir, process_anim]) => {
  const sp = await import('/js/pets/sprites.js');
  const it = await import('/js/pets/items.js');
  const W = 380, H = 200;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#e9dcc4'; x.fillRect(0, 0, W, H);
  let px = 10, py = 30;
  const info = [];
  for (const [sp_, S_] of Object.entries(sp.SPECIES)) {
    for (const b of S_.breeds) {
      for (const stage of ['unge', 'vuxen']) {
        const pet = { species: sp_, breed: b.id, sex: 'hane', stage, id: b.id };
        sp.drawPet(x, px, py, pet, process_anim, 0.3, process_dir);
        const sz = sp.petSize(pet); info.push(`${sp_}/${b.id}/${stage}: ${sz.w}x${sz.h}`);
        px += stage === 'unge' ? 18 : 30;
      }
      if (px > W - 30) { px = 10; py += 28; }
    }
    px = 10; py += 28;
  }
  let ix = 12; const iy = H - 8;
  for (const id of Object.keys(it.PET_ITEMS)) { it.drawPetItem(x, id, ix, iy, { food: 0.8, foodKind: 'katt', left: 6, t: 0.4 }); ix += it.PET_ITEMS[id].w + 8; }
  const big = document.createElement('canvas'); big.width = W * S; big.height = H * S;
  const bx = big.getContext('2d'); bx.imageSmoothingEnabled = false; bx.drawImage(c, 0, 0, W * S, H * S);
  window._info = info;
  return big.toDataURL('image/png');
}, [S, DIR, ANIM]);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log((await page.evaluate(() => window._info)).join('\n'));
console.log('skrev', out, errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
