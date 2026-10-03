// Ikonförslagen till appen (Pixelcity) – alla i spelets pixelstil med ett enda pixelkorn per ikon:
//   moppe     figuren på moppe i snabbfilen, randig solnedgång           (64×64 → ×16)
//   hopp      häst och ryttare över ett hinder på landet                 (64×64 → ×16)
//   familjen  två vuxna och ett barn framför Pixelstaden i skymning      (64×64 → ×16)
//   portratt  figuren som byst framför solen och staden                  (32×32 → ×32)
//   skylt     PIXEL CITY i neon på en nattsvart skylt                    (32×32 → ×32)
// Ikonerna använder spelets egna figurer/fordon/häst (people.js, fordon-art.js, hast-art.js).
// (Utsnitt ur spelets bild prövades 2026-10-03 men blev brus i hemskärmsstorlek.)
//   node app/tools/ikoner.mjs                 → app/store/ikoner/<id>.png (1024, RGB) + ark.png
//   node app/tools/ikoner.mjs --val <id>      → den valda blir appikonen + startbilden i Xcode-projektet
// Servern på 8788 (annan port: PORT=…).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP, 'store', 'ikoner');
const XC = path.join(APP, 'ios/App/App/Assets.xcassets');
const PORT = process.env.PORT || 8788;
const VAL = process.argv.includes('--val') ? process.argv[process.argv.indexOf('--val') + 1] : null;
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1152, height: 700 } });
p.on('pageerror', (e) => console.log('sidfel:', e.message));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=ikon${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Alva', look: { skin: '#eec3a0', hair: '#6b4226', style: 'short', shirt: '#ffd23f', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 60000, hunger: 80, energy: 100, home: 'villa', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, lycka: 70 }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(1200);

// ---------- de ritade ikonerna ----------
const ritade = await p.evaluate(async () => {
  const { drawRide } = await import('/js/core/fordon-art.js');
  const { drawHastRyttare } = await import('/js/landet/hast-art.js');
  const { personSprite } = await import('/js/core/people.js');
  const mk = (N) => { const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d'); return { c, g, R: (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); }, P: (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }; };
  const hash = (a, b2) => { let h = (a * 374761393 + b2 * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // himmel i band med en ditherrad mellan varje
  const sky = ({ R, P }, N, bands, end) => {
    for (let i = 0; i < bands.length; i++) {
      const [y0, col] = bands[i], y1 = i + 1 < bands.length ? bands[i + 1][0] : end;
      R(0, y0, N, y1 - y0, col);
      if (i > 0) for (let x = 0; x < N; x += 2) P(x + (y0 & 1), y0, bands[i - 1][1]);
    }
  };
  const sol = ({ P }, sx, sy, sr, stripes = true) => {
    for (let y = sy - sr; y <= sy + sr; y++) for (let x = sx - sr; x <= sx + sr; x++) {
      const d = Math.hypot(x - sx + 0.5, y - sy + 0.5);
      if (d > sr) continue;
      if (stripes && y > sy - 3 && (y - sy) % 3 === 0) continue;
      P(x, y, d > sr - 1 ? '#ff9a3a' : y < sy - 6 ? '#ffe36a' : y < sy ? '#ffc84a' : '#ffa53e');
    }
  };
  const stad = ({ R, P }, hus, bottom, win = 0.42) => {
    hus.forEach(([x, w, top], i) => {
      R(x, top, w, bottom - top, i % 2 ? '#2b2042' : '#352851');
      R(x, top, w, 1, '#5c4372');
      R(x + w - 1, top + 1, 1, bottom - top - 1, i % 2 ? '#3a2b55' : '#46355f');
      for (let y = top + 3; y < bottom - 3; y += 3) for (let xx = x + 2; xx < x + w - 2; xx += 2) { const h = hash(xx, y); if (h < win) P(xx, y, h < 0.14 ? '#fff0a8' : '#ffc94a'); }
    });
  };
  const SKYMNING = [[0, '#21183a'], [7, '#2e2152'], [13, '#482c69'], [19, '#6e3775'], [25, '#9c4474'], [30, '#c9556a'], [35, '#e8715a'], [40, '#f59b4e']];
  const stjarnor = ({ P }, list) => { for (const [x, y, k] of list) P(x, y, k ? '#f4f1ea' : '#b8a8d8'); };
  const out = {};

  // --- moppe ---
  { const N = 64, k = mk(N), { R } = k;
    sky(k, N, SKYMNING, 45);
    stjarnor(k, [[5, 3, 1], [14, 7, 0], [24, 2, 0], [33, 5, 1], [52, 3, 0], [59, 9, 1], [43, 11, 0], [3, 13, 0]]);
    sol(k, 44, 31, 13);
    stad(k, [[0, 9, 33], [9, 8, 26], [17, 7, 36], [24, 9, 32], [33, 6, 38], [39, 8, 34], [47, 8, 37], [55, 9, 30]], 45);
    R(12, 22, 1, 4, '#5c4372'); k.P(12, 21, '#ff5a5a');
    R(0, 45, N, 1, '#b6aebf'); R(0, 46, N, 2, '#8d8597'); R(0, 48, N, 1, '#5d5667'); R(0, 49, N, 15, '#3b3742');
    for (let y = 56; y < N; y++) for (let x = (y & 1); x < N; x += 2) k.P(x, y, '#34303b');
    R(0, 50, N, 1, '#e8b23a'); for (let x = -2; x < N; x += 10) R(x, 55, 6, 1, '#f4f1ea');
    for (const [x, y, w] of [[1, 27, 7], [3, 33, 9], [0, 39, 6], [2, 52, 5]]) { R(x, y, w, 1, '#f4f1ea'); R(x + w, y, 2, 1, '#c9b8e0'); }
    drawRide(k.g, 'moppe', 35, 58, 'right', 0.31, true, { skin: '#eec3a0', hair: '#6b4226', style: 'short', shirt: '#ffd23f', pants: '#2d3a5c' }, '#d9433b');
    out.moppe = k.c; }

  // --- hopp: häst och ryttare över ett hinder på landet ---
  { const N = 64, k = mk(N), { R, P } = k;
    sky(k, N, [[0, '#3b78d0'], [9, '#4d88dc'], [18, '#629be6'], [27, '#7fb1ee'], [35, '#a3cbf4'], [41, '#c6e1f8']], 46);
    const moln = (x, y, w) => { R(x + 2, y, w - 4, 1, '#ffffff'); R(x, y + 1, w, 2, '#ffffff'); R(x + 1, y + 3, w - 2, 1, '#d6e6f6'); R(x + 3, y - 1, Math.max(2, (w >> 1) - 2), 1, '#ffffff'); };
    moln(4, 8, 13); moln(44, 4, 11); moln(50, 17, 9);
    // böljande kullar: bortre, mellersta och ängen
    for (let x = 0; x < N; x++) {
      const y1 = Math.round(41 + 3 * Math.sin(x / 9 + 0.6)), y2 = Math.round(46 + 2 * Math.sin(x / 7 + 2.1));
      R(x, y1, 1, N - y1, '#4a8a3c'); P(x, y1, '#5d9e48');
      R(x, y2, 1, N - y2, '#65a845'); P(x, y2, '#7cbb55');
    }
    for (let y = 52; y < N; y++) for (let x = 0; x < N; x++) P(x, y, (x + y) % 2 ? '#6fb34b' : '#76b950');
    // träd på kullen och staketet långt bort
    const trad = (x, y) => { R(x - 2, y - 5, 5, 4, '#2f6b33'); R(x - 1, y - 6, 3, 1, '#2f6b33'); R(x - 1, y - 5, 2, 2, '#3f8040'); R(x, y - 1, 1, 2, '#6b4a2a'); };
    trad(6, 42); trad(11, 41); trad(57, 40);
    for (let x = 17; x < 52; x += 5) { const y = Math.round(41 + 3 * Math.sin(x / 9 + 0.6)) - 3; R(x, y, 1, 3, '#7a5230'); }
    for (let x = 17; x < 52; x++) P(x, Math.round(41 + 3 * Math.sin(x / 9 + 0.6)) - 2, '#9a6a3e');
    // hindret: rödvita bommar mellan två stöd
    const stod = (x) => { R(x, 45, 2, 16, '#f4f1ea'); for (let y = 46; y < 61; y += 4) R(x, y, 2, 2, '#d9433b'); R(x - 1, 60, 4, 1, '#3e6b2e'); };
    stod(21); stod(45);
    for (const y of [50, 54]) for (let x = 23; x < 45; x++) P(x, y, Math.floor((x - 23) / 3) % 2 ? '#f4f1ea' : '#d9433b');
    R(23, 61, 22, 1, '#4f8f3a');
    drawHastRyttare(k.g, 30, 61, 'right', 'hopp', 0, 'fux', { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, { hojd: 3 });
    out.hopp = k.c; }

  // --- familjen: två vuxna och ett barn framför staden ---
  { const N = 64, k = mk(N), { R, P } = k;
    sky(k, N, SKYMNING, 47);
    stjarnor(k, [[4, 4, 1], [18, 2, 0], [29, 6, 1], [47, 3, 0], [58, 8, 1], [38, 12, 0]]);
    sol(k, 32, 34, 15);
    stad(k, [[0, 10, 30], [10, 7, 36], [17, 8, 33], [25, 5, 39], [39, 6, 38], [45, 8, 31], [53, 11, 35]], 47);
    R(0, 47, N, 1, '#b6aebf'); R(0, 48, N, N - 48, '#8d8597');
    for (let y = 50; y < N; y += 4) R(0, y, N, 1, '#7a7284');
    for (let x = 3; x < N; x += 8) for (let y = 48; y < N; y++) if (((y - 48) >> 2) % 2 === (x >> 3) % 2) P(x, y, '#7a7284');
    const folk = [
      [{ skin: '#a06a43', hair: '#1d1714', style: 'afro', shirt: '#3a7bd5', pants: '#3f5f8f' }, 1],
      [{ skin: '#f6d7bf', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, 39],
      [{ skin: '#e0a97f', hair: '#ecd489', style: 'bob', shirt: '#46a35a', pants: '#2b2b30', kid: true, build: 4 }, 20],
    ];
    for (const [look, x] of folk) { k.g.fillStyle = 'rgba(20,12,30,.25)'; k.g.fillRect(x + 6, 61, 12, 2); k.g.drawImage(personSprite(look, 'down', 0), x, 61 - 39); }
    // ett hjärta ovanför barnet
    const hj = [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5]];
    for (const [x, y] of hj) P(29 + x, 22 + y, '#e04848'); P(30, 23, '#ff9a9a');
    out.familjen = k.c; }

  // --- porträtt: figuren som byst (32×32) ---
  { const N = 32, k = mk(N), { R, P } = k;
    sky(k, N, [[0, '#2e2152'], [5, '#482c69'], [10, '#6e3775'], [14, '#9c4474'], [18, '#c9556a'], [22, '#e8715a']], 26);
    P(3, 2, '#f4f1ea'); P(27, 4, '#b8a8d8'); P(22, 1, '#f4f1ea');
    sol(k, 16, 15, 11, false);
    stad(k, [[0, 6, 19], [6, 4, 23], [24, 4, 22], [28, 4, 18]], 32, 0.5);
    k.g.drawImage(personSprite({ skin: '#eec3a0', hair: '#6b4226', style: 'short', shirt: '#ffd23f', pants: '#2d3a5c' }, 'down', 0), 4, 2);
    out.portratt = k.c; }

  // --- skylt: PIXEL CITY i neon (32×32) ---
  { const N = 32, k = mk(N), { R, P } = k;
    sky(k, N, [[0, '#140f26'], [10, '#1c1534'], [20, '#241a40']], 32);
    for (const [x, y] of [[2, 2], [9, 4], [17, 1], [24, 3], [30, 5], [5, 29], [27, 28]]) P(x, y, '#b8a8d8');
    stad(k, [[0, 7, 27], [7, 5, 29], [20, 6, 28], [26, 6, 26]], 32, 0.5);
    R(1, 5, 30, 21, '#120d1e'); R(1, 5, 30, 1, '#3a2b55'); R(1, 25, 30, 1, '#3a2b55'); R(1, 6, 1, 19, '#3a2b55'); R(30, 6, 1, 19, '#3a2b55');
    R(8, 3, 1, 2, '#5c4372'); R(23, 3, 1, 2, '#5c4372');   // upphängningen
    const F = {
      P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'], I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
      X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'], E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
      L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'], C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
      T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    };
    const on = new Set();
    const ord = (w, x0, y0, col, glow, hi) => {
      let x = x0; const px = [];
      for (const ch of w) { F[ch].forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') px.push([x + i, y0 + j]); })); x += F[ch][0].length + 1; }
      for (const [x1, y1] of px) on.add(x1 + ',' + y1);
      for (const [x1, y1] of px) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!on.has((x1 + dx) + ',' + (y1 + dy))) P(x1 + dx, y1 + dy, glow);
      for (const [x1, y1] of px) P(x1, y1, col);
      for (const [x1, y1] of px.filter((_, i) => i % 5 === 0)) P(x1, y1, hi);
    };
    ord('PIXEL', 3, 8, '#ff6fd0', '#5a1f55', '#ffd0f0');
    ord('CITY', 6, 17, '#62e6ff', '#163f5a', '#d8f8ff');
    out.skylt = k.c; }

  const res = {};
  for (const [id, c] of Object.entries(out)) res[id] = { url: c.toDataURL('image/png'), n: c.width };
  return res;
});

await b.close();

// ---------- förstora till 1024 (ett pixelkorn = 16 resp. 32 px) och spara ----------
const alla = ritade;
const c2 = await chromium.launch();
const q = await c2.newPage();
const stora = await q.evaluate(async (alla) => {
  const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
  const res = {};
  for (const [id, { url }] of Object.entries(alla)) {
    const img = await load(url), c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, 1024, 1024);
    res[id] = c.toDataURL('image/png');
  }
  return res;
}, alla);
await c2.close();
for (const [id, url] of Object.entries(stora)) { fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(url.split(',')[1], 'base64')); }
console.log('ikoner:', Object.keys(stora).join(', '), '→', path.relative(process.cwd(), OUT));
if (VAL) {
  if (!stora[VAL]) throw new Error(`okänd ikon: ${VAL}`);
  const ikonFil = path.join(XC, 'AppIcon.appiconset/AppIcon-512@2x.png');
  fs.copyFileSync(path.join(OUT, VAL + '.png'), ikonFil);
  // startbilden: samma bild (512 px, ett pixelkorn = 8 resp. 16 px) på spelets mörka botten med PIXELCITY
  // under, i Pixelstad (vanlig vikt, em = 12 px × 8, tröskad till skarpa kanter). Telefonen visar mittbandet
  // av den kvadratiska bilden i liggande läge, så allt ligger nära mitten.
  const c3 = await chromium.launch(), s3 = await c3.newPage();
  await s3.goto(`http://localhost:${PORT}/version.json`);
  const splash = await s3.evaluate(async ({ url, n }) => {
    const ff = new FontFace('Pixelstad', 'url(/assets/fonts/pixelstad.otf)', { weight: '400' }); await ff.load(); document.fonts.add(ff);
    const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = url; });
    const S = 2732, sk = 512 / n, w = n * sk, k = 8;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#1c1a22'; g.fillRect(0, 0, S, S);
    const x = Math.round((S - w) / 2), y = Math.round((S - w) / 2) - 110;
    g.drawImage(img, x, y, w, w);
    const t = document.createElement('canvas'), f = `400 ${12 * k}px Pixelstad`;
    const m = t.getContext('2d'); m.font = f; const tw = Math.ceil(m.measureText('PIXELCITY').width) + 3 * k;
    t.width = tw; t.height = 16 * k;
    const q = t.getContext('2d'); q.font = f; q.textBaseline = 'alphabetic';
    q.fillStyle = '#0c0b10'; q.fillText('PIXELCITY', 2 * k, 11 * k); q.fillStyle = '#e04848'; q.fillText('PIXELCITY', k, 10 * k);
    const d = q.getImageData(0, 0, tw, t.height); for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 128 ? 0 : 255; q.putImageData(d, 0, 0);
    g.drawImage(t, Math.round((S - tw) / 2), y + w + 3 * k);
    return c.toDataURL('image/png');
  }, alla[VAL]);
  await c3.close();
  const splashFiler = ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'].map((f) => path.join(XC, 'Splash.imageset', f));
  for (const f of splashFiler) fs.writeFileSync(f, Buffer.from(splash.split(',')[1], 'base64'));
  // Apple nekar ikoner med alfakanal – PIL gör om ikonen och startbilderna till RGB
  execFileSync('python', ['-c', 'import sys\nfrom PIL import Image\nfor f in sys.argv[1:]: Image.open(f).convert("RGB").save(f, optimize=True)', ikonFil, ...splashFiler]);
  console.log('appikonen och startbilden =', VAL);
}
