// App Store-skärmbilderna till Pixelcity: spelet körs i telefonens/plattans riktiga storlek (fyll-läget,
// ?mobfill=1) och varje bild får en rubrik i spelets röda dialogstil ovanför.
//   iphone  6,9" liggande 2868×1320 (956×440 @3x)
//   ipad    13"  liggande 2752×2064 (1376×1032 @2x)
//   node app/tools/skarmbilder.mjs [iphone|ipad] [--bara id,id] [--rubriker]
//     → app/store/skarmbilder/<enhet>-<nr>-<id>.png (+ <enhet>-<id>-ra.png utan rubrik)
//     --bara      ta bara de här bilderna      --rubriker  gör bara om rubrikerna på redan tagna bilder
// Urvalet och ordningen är Carls (2026-10-03): staden, frisören, trädgården, husdjuren, festen i ett
// riktigt möblerat hem (app/tools/fest-hem.json), pizzerian, leksaksaffären, klädaffären – ingen häst.
// Servern på 8788 (annan port: PORT=…).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP, 'store', 'skarmbilder');
const PORT = process.env.PORT || 8788;
const FEST_HEM = JSON.parse(fs.readFileSync(path.join(APP, 'tools', 'fest-hem.json'), 'utf8'));   // villans vardagsrum, möblerat
fs.mkdirSync(OUT, { recursive: true });

const ENHETER = {
  iphone: { vp: [956, 440], dsf: 3 },
  ipad: { vp: [1376, 1032], dsf: 2 },
};
// rubrik + underrad per bild, i den ordning de visas i App Store (högst tio)
const BILDER = [
  { id: 'stan', rubrik: 'Ett helt liv i Pixelstaden', under: 'Jobba, handla, plugga och träffa folk' },
  { id: 'frisor', rubrik: 'Fixa dig hos frisören', under: 'Ny frisyr, ny hårfärg, ny stil' },
  { id: 'odla', rubrik: 'Odla i din trädgård', under: 'Så, vattna och skörda – laga mat av det' },
  { id: 'husdjur', rubrik: 'Skaffa eget husdjur', under: 'Kattungar, valpar och kaninungar som växer upp hemma' },
  { id: 'fest', rubrik: 'Bjud hem kompisarna', under: 'Inred ditt hem och ha fest' },
  { id: 'jobb', rubrik: 'Jobba dig uppåt', under: '14 jobb – från pizzabagare till chef' },
  { id: 'leksaker', rubrik: 'Shoppa i stan', under: 'Leksaker, möbler, mat och mycket mer' },
  { id: 'klader', rubrik: 'Klä dig som du vill', under: 'Kläder, skor och accessoarer' },
  { id: 'soder', rubrik: 'Upptäck hela staden', under: 'Söder, parken, förorten och downtown' },
  { id: 'kvall', rubrik: 'Staden lever dygnet runt', under: 'Dag och natt, sol och regn' },
];

const bara = process.argv.includes('--bara') ? process.argv[process.argv.indexOf('--bara') + 1].split(',') : null;
const val = ['iphone', 'ipad'].includes(process.argv[2]) ? process.argv[2] : null;
const browser = await chromium.launch();
for (const [enhet, E] of Object.entries(ENHETER)) {
  if ((val && val !== enhet) || process.argv.includes('--rubriker')) continue;
  const ctx = await browser.newContext({ viewport: { width: E.vp[0], height: E.vp[1] }, deviceScaleFactor: E.dsf, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('sidfel:', e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill=1&tradgard&world=store${Date.now().toString(36)}`);
  await p.evaluate((deco) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Alva', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, color: '#ff5dc8' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 12, min: 13 * 60, money: 48250, hunger: 82, energy: 91, home: 'villa', fridge: {}, jobs: { pizzeria: 6, kafe: 3 }, earned: 23400, wardrobe: [], storage: [], deco: { 'villa:0': deco }, won: false, lycka: 78 }));
  }, FEST_HEM);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const D = (fn, arg) => p.evaluate(fn, arg);
  const vila = (ms) => p.waitForTimeout(ms);
  const stad = async () => { await D(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; document.querySelector('#sf-update')?.remove(); }); };
  const ta = async (id) => { await stad(); await vila(150); await p.screenshot({ path: path.join(OUT, `${enhet}-${id}-ra.png`) }); console.log(enhet, id); };
  // klick i scenen på en klickbar sak (scenkoordinater → sidkoordinater, som tools/frisor-test.mjs)
  const klicka = async (id) => {
    const pt = await D((id) => {
      const A = window.SF, s = A.scene._debug.spot(id), cv = document.querySelector('#scene'), r = cv.getBoundingClientRect();
      if (!s) return null;
      const lw = cv.width / A.pxs, lh = cv.height / A.pxs;
      return { x: r.left + (s.x + A.view.boxX) * r.width / lw, y: r.top + (s.y + A.view.boxY) * r.height / lh };
    }, id);
    if (pt) await p.mouse.click(pt.x, pt.y);
    return !!pt;
  };
  const tillStad = async (distrikt, dx, min) => {
    await D((min) => { const A = window.SF; A.game.min = min; A.go('city'); }, min);
    await vila(800);
    await D(([d0, dx]) => { const A = window.SF, d = A.scene._debug.district(d0); A.scene._debug.teleport(d.spawn.x + dx, d.spawn.y); }, [distrikt, dx]);
    await vila(5000);
  };

  const SCENER = {
    stan: async () => { await tillStad('CENTRUM', 200, 13 * 60); },
    frisor: async () => {
      await D(() => { window.SF.game.min = 11 * 60; window.SF.go('frisor'); });
      await vila(2500);
      // figuren i stol 2, Sami klipper: ny frisyr och hårfärg mitt i klippningen
      await D(() => { const d = window.SF.scene._debug; d.sit(1); d.samiNow(); d.buy({ ...window.SF.avatar.look, style: 'bob', hair: '#c65fa0' }); d.seqAt(2.6); });
      await vila(400);
    },
    odla: async () => {
      await D(() => {
        const A = window.SF, g = A.game; g.min = 10 * 60;
        const gd = g.garden(), G = ['tomat', 'morot', 'potatis', 'paprika', 'lok', 'rodlok', 'tomat', 'morot'];
        gd.beds.forEach((_, i) => { gd.beds[i] = null; g.plant(i, G[i % G.length]); const b = gd.beds[i]; if (b) { b.v = [9, 2, 9, 3, 1, 9, 4, 2][i % 8]; b.vat = g.day; } });
        g.save(); A.go('tradgard');
      });
      await vila(3000);
    },
    husdjur: async () => {
      // djuraffären, hundavdelningen: rasporträtten, valparna i hagarna och poolen (Carl: "man ska se bild på djuren")
      await D(() => { window.SF.game.min = 14 * 60; window.SF.go('djur'); });
      await vila(1500);
      await D(() => { const d = window.SF.scene._debug; d.teleport(610, 150); d.lockCam(384); });
      await vila(3000);
    },
    husdjurHemma: async () => {
      await D(async () => {
        const { petStore } = await import('/js/pets/sim.js');
        const s = petStore(), g = window.SF.game;
        g.min = 14 * 60;
        s.reset();
        s.adopt('hund', '', 'hane', 'Bamse', g.home, { day: g.day - 9 });
        s.adopt('katt', '', 'hona', 'Misse', g.home, { day: g.day - 9 });
        s.adopt('kanin', '', 'hona', 'Stampe', g.home, { day: g.day - 9 });
        s.adopt('katt', '', 'hane', 'Sixten', g.home, { day: g.day - 2 });
        for (const k of ['matskal', 'sack-katt', 'sack-hund']) s.buyItem(k, 1);
        window.SF.go('city'); window.SF.roomSub = 0; window.SF.go('room');
      });
      await vila(6000);
    },
    fest: async () => {
      await D(() => { const A = window.SF; A.game.min = 19 * 60 + 55; A.game.festDag = 0; A.roomSub = 0; A.go('room'); });
      await vila(2000);
      await D(async () => { const F = await import('/js/core/fest.js'); F.startFest(window.SF, { n: 8, mat: 'tarta' }); window.SF.game.min = 20 * 60 + 20; });
      await vila(16000);
    },
    jobb: async () => { await D(() => { window.SF.go('jobbpizzeria', { onDone: () => {} }); }); await vila(10000); },
    leksaker: async () => { await D(() => { window.SF.game.min = 15 * 60; window.SF.go('leksaker'); }); await vila(3500); },
    klader: async () => { await D(() => { window.SF.game.min = 15 * 60; window.SF.go('klader'); }); await vila(3500); },
    soder: async () => { await tillStad('SÖDER', 300, 12 * 60); },
    kvall: async () => { await tillStad('PARKEN', 120, 21 * 60 + 30); },
  };
  for (const B of BILDER) {
    if (bara && !bara.includes(B.id)) continue;
    await SCENER[B.id]();
    await ta(B.id);
    await D(async () => { if (window.SF.fest) { try { const F = await import('/js/core/fest.js'); F.endFest(window.SF); } catch { /* ok */ } window.SF.fest = null; } });
  }
  await ctx.close();
}

// ---------- rubrikerna: spelets röda dialoghuvud ovanför bilden ----------
const c = await browser.newPage();
await c.goto(`http://localhost:${PORT}/version.json`);
for (const enhet of Object.keys(ENHETER)) {
  if (val && val !== enhet) continue;
  // bort med gamla numrerade bilder som inte längre finns i urvalet
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(enhet + '-') && /^[a-z]+-\d+-/.test(f) && !BILDER.some((B, i) => f === `${enhet}-${i + 1}-${B.id}.png`)) fs.rmSync(path.join(OUT, f));
  for (const [i, B] of BILDER.entries()) {
    const ra = path.join(OUT, `${enhet}-${B.id}-ra.png`);
    if (!fs.existsSync(ra)) continue;
    const url = await c.evaluate(async ({ src, B }) => {
      const ff = new FontFace('Pixelstad', 'url(/assets/fonts/pixelstad.otf)', { weight: '400' }); await ff.load(); document.fonts.add(ff);
      const img = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
      const W = img.width, H = img.height, u = Math.round(H / 220);            // u = ramens pixelkorn
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#1c1a22'; g.fillRect(0, 0, W, H);
      const band = Math.round(H * 0.17);
      // rubrikbandet: rött med ljus överkant och mörk underkant, som spelets dialoghuvud
      g.fillStyle = '#a31d24'; g.fillRect(0, 0, W, band);
      g.fillStyle = '#c3333a'; g.fillRect(0, 0, W, u);
      g.fillStyle = '#6a1218'; g.fillRect(0, band - u, W, u);
      // texten: Pixelstad i vanlig vikt (den feta tänder pixeln till höger och gör 'm' till en kloss) i en
      // heltalsmultipel av em = 12 px (docs/PIXELGRAFIK.md), ritad direkt i slutstorleken och tröskad
      // till skarpa kanter; rubriken får en hård skugga på en typsnittspixel
      const txt = (t, col, skugga, k) => {
        const f = `400 ${12 * k}px Pixelstad`, m = document.createElement('canvas').getContext('2d'); m.font = f;
        const w = Math.ceil(m.measureText(t).width) + 3 * k, c2 = document.createElement('canvas'); c2.width = w; c2.height = 16 * k;
        const q = c2.getContext('2d'); q.font = f; q.textBaseline = 'alphabetic';
        if (skugga) { q.fillStyle = skugga; q.fillText(t, 2 * k, 11 * k); }
        q.fillStyle = col; q.fillText(t, k, 10 * k);
        const d = q.getImageData(0, 0, w, c2.height);
        for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 128 ? 0 : 255;
        q.putImageData(d, 0, 0);
        return c2;
      };
      const k1 = Math.max(2, Math.round(band * 0.42 / 12)), k2 = Math.max(1, Math.round(band * 0.2 / 12));
      const t1 = txt(B.rubrik, '#ffffff', '#3a0a10', k1), t2 = txt(B.under, '#f6d2c8', null, k2);
      g.drawImage(t1, Math.round((W - t1.width) / 2), Math.round(band * 0.40 - 8 * k1));
      g.drawImage(t2, Math.round((W - t2.width) / 2), Math.round(band * 0.80 - 8 * k2));
      // spelbilden under, med ljus ram och hård skugga
      const top = band + Math.round(H * 0.035), avail = H - top - Math.round(H * 0.035);
      const sh = avail, sw = Math.round(W * sh / H), x = Math.round((W - sw) / 2);
      g.fillStyle = '#0c0b10'; g.fillRect(x + 2 * u, top + 2 * u, sw, sh);
      g.drawImage(img, x, top, sw, sh);
      g.strokeStyle = '#f4f1ea'; g.lineWidth = u; g.strokeRect(x - u / 2, top - u / 2, sw + u, sh + u);
      return cv.toDataURL('image/png');
    }, { src: 'data:image/png;base64,' + fs.readFileSync(ra).toString('base64'), B });
    fs.writeFileSync(path.join(OUT, `${enhet}-${i + 1}-${B.id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
console.log('klart →', path.relative(process.cwd(), OUT));
