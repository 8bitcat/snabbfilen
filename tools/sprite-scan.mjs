// Skannar ett spritesheet och listar varje sprites bounding-box (via
// sammanhängande icke-transparenta pixlar). Kör: node tools/sprite-scan.mjs <png> [minW]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';
import path from 'path';

const file = process.argv[2];
const minSize = +(process.argv[3] || 8);
const b64 = fs.readFileSync(file).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const boxes = await page.evaluate(async ({ b64, minSize }) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;
  const solid = (i) => d[i * 4 + 3] > 10;
  const seen = new Uint8Array(W * H);
  const out = [];
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i0 = y * W + xx;
    if (seen[i0] || !solid(i0)) continue;
    // flood fill (med 2px hopp så närliggande delar slås ihop)
    let x0 = xx, x1 = xx, y0 = y, y1 = y;
    const q = [i0]; seen[i0] = 1;
    while (q.length) {
      const i = q.pop(), cy = (i / W) | 0, cx = i % W;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (!seen[ni] && solid(ni)) { seen[ni] = 1; q.push(ni); }
      }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out.filter((b) => b.w >= minSize && b.h >= minSize).sort((a, b) => (Math.round(a.y / 24) - Math.round(b.y / 24)) || (a.x - b.x));
}, { b64, minSize });
await browser.close();
console.log(path.basename(file));
boxes.forEach((b, i) => console.log(`${String(i).padStart(3)}: x=${b.x} y=${b.y} w=${b.w} h=${b.h}`));
