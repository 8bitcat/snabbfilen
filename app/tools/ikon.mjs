// Ritar appikonen (1024×1024) och startbilden (2732×2732) i spelets pixelstil: en figur på moppe i
// snabbfilen, Pixelstaden i skymning bakom. Allt ritas på ett 64×64-rutnät med spelets egna
// figurer/fordon (js/core/fordon-art.js) och förstoras ×16 utan utjämning – ett pixelkorn.
//   node app/tools/ikon.mjs        (servern på 8788; annan port: PORT=…)
// Skriver app/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png och Splash.imageset/*.png
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XC = path.join(APP, 'ios/App/App/Assets.xcassets');
const PORT = process.env.PORT || 8788;

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://localhost:${PORT}/version.json`);
const out = await p.evaluate(async () => {
  const { drawRide } = await import('/js/core/fordon-art.js');
  // Pixelstad-typsnittet (fet) för startbildens rubrik
  const ff = new FontFace('Pixelstad', 'url(/assets/fonts/pixelstad-fet.otf)', { weight: '700' });
  await ff.load(); document.fonts.add(ff);

  const N = 64;
  const scene = () => {
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const P = (x, y, col) => R(x, y, 1, 1, col);
    const hash = (a, b2) => { let h = (a * 374761393 + b2 * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // himlen i skymning: band med en ditherrad mellan varje
    const SKY = [[0, '#21183a'], [7, '#2e2152'], [13, '#482c69'], [19, '#6e3775'], [25, '#9c4474'], [30, '#c9556a'], [35, '#e8715a'], [40, '#f59b4e']];
    for (let i = 0; i < SKY.length; i++) {
      const [y0, col] = SKY[i], y1 = i + 1 < SKY.length ? SKY[i + 1][0] : 45;
      R(0, y0, N, y1 - y0, col);
      if (i > 0) for (let x = 0; x < N; x += 2) P(x + (y0 & 1), y0, SKY[i - 1][1]);
    }
    for (const [x, y, k] of [[5, 3, 1], [14, 7, 0], [24, 2, 0], [33, 5, 1], [52, 3, 0], [59, 9, 1], [43, 11, 0], [3, 13, 0]]) { P(x, y, k ? '#f4f1ea' : '#b8a8d8'); }
    // solnedgången: randig sol bakom staden
    const sx = 44, sy = 31, sr = 13;
    for (let y = sy - sr; y <= sy + sr; y++) for (let x = sx - sr; x <= sx + sr; x++) {
      const d = Math.hypot(x - sx + 0.5, y - sy + 0.5);
      if (d > sr) continue;
      const band = y < sy - 6 ? '#ffe36a' : y < sy ? '#ffc84a' : '#ffa53e';
      if (y > sy - 3 && (y - sy) % 3 === 0) continue;   // ränderna
      P(x, y, d > sr - 1 ? '#ff9a3a' : band);
    }
    // staden: siluetter i två toner, kantljus mot solen, tända fönster
    const HUS = [[0, 9, 33], [9, 8, 26], [17, 7, 36], [24, 9, 32], [33, 6, 38], [39, 8, 34], [47, 8, 37], [55, 9, 30]];
    HUS.forEach(([x, w, top], i) => {
      const col = i % 2 ? '#2b2042' : '#352851';
      R(x, top, w, 45 - top, col);
      R(x, top, w, 1, '#5c4372');
      R(x + w - 1, top + 1, 1, 44 - top, i % 2 ? '#3a2b55' : '#46355f');
      for (let y = top + 3; y < 42; y += 3) for (let xx = x + 2; xx < x + w - 2; xx += 2) {
        const h = hash(xx, y);
        if (h < 0.42) P(xx, y, h < 0.14 ? '#fff0a8' : '#ffc94a');
      }
    });
    R(12, 22, 1, 4, '#5c4372'); P(12, 21, '#ff5a5a');   // antennen med lampa
    // trottoaren och gatan – den gula kantlinjen och snabbfilens streckade linje
    R(0, 45, N, 1, '#b6aebf'); R(0, 46, N, 2, '#8d8597'); R(0, 48, N, 1, '#5d5667');
    R(0, 49, N, 15, '#3b3742');
    for (let y = 56; y < N; y++) for (let x = (y & 1); x < N; x += 2) P(x, y, '#34303b');
    R(0, 50, N, 1, '#e8b23a');
    for (let x = -2; x < N; x += 10) R(x, 55, 6, 1, '#f4f1ea');
    // fartstrecken bakom mopeden
    for (const [x, y, w] of [[1, 27, 7], [3, 33, 9], [0, 39, 6], [2, 52, 5]]) { R(x, y, w, 1, '#f4f1ea'); R(x + w, y, 2, 1, '#c9b8e0'); }
    // figuren på mopeden (spelets egen moppe och figur, med hjälm och avgaser)
    const look = { skin: '#eec3a0', hair: '#6b4226', style: 'short', shirt: '#ffd23f', pants: '#2d3a5c' };
    drawRide(g, 'moppe', 35, 58, 'right', 0.31, true, look, '#d9433b');
    return c;
  };
  const big = (src, size, scale, bg, dy = 0, title) => {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    const w = src.width * scale, x = Math.round((size - w) / 2), y = Math.round((size - w) / 2) + dy;
    g.drawImage(src, x, y, w, w);
    if (title) {
      // rubriken ritas i 1× och förstoras – samma pixelkorn som bilden
      const t = document.createElement('canvas'); t.width = 120; t.height = 20;
      const tg = t.getContext('2d'); tg.font = '700 16px Pixelstad'; tg.textBaseline = 'top'; tg.textAlign = 'center';
      tg.fillStyle = '#1c1a22'; tg.fillText(title, 61, 3); tg.fillStyle = '#e04848'; tg.fillText(title, 60, 2);
      g.drawImage(t, Math.round(size / 2 - 60 * scale), y + w + 2 * scale, 120 * scale, 20 * scale);
    }
    return c.toDataURL('image/png');
  };
  const s = scene();
  return { ikon: big(s, 1024, 16, '#1c1a22'), splash: big(s, 2732, 8, '#1c1a22', -110, 'PIXELCITY'), liten: big(s, 256, 4, '#1c1a22') };
});
await b.close();
const save = (f, d) => { fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); console.log('skrev', path.relative(APP, f)); };
save(path.join(XC, 'AppIcon.appiconset/AppIcon-512@2x.png'), out.ikon);
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) save(path.join(XC, 'Splash.imageset', f), out.splash);
if (process.env.PREVIEW) save(process.env.PREVIEW, out.liten);
