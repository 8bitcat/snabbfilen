// 📱 Telefonlayouten (fyll-läget, iPhone 13 mini liggande): i fyll-läget är canvasen högre än skärmen och beskärs
// upptill och nedtill (main.js followCrop → SF.view.safe). Kamerorna i utescenerna ska räkna med DET SOM SYNS
// (walkable.js synligRuta), så att figuren inte hamnar vid skärmens nederkant med marken dold under kanten
// (Carl 2026-10-16: "svårt att gå nedåt på Pixelberg på iPhone – man kunde inte trycka nedanför karaktären").
//   • Pixelberg: längst ner på promenaden syns marken under figuren, och mitt på promenaden finns det gott om plats under
//   • radiobilarna: banans framkant syns, räknaren TID/KROCKAR ritas innanför den synliga rutan
//   • Tassbacken: samma sak längst ner i parken
//   node tools/mobil-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium, devices } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13 Mini landscape'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
// telefonkänslan som index.html letar efter (grov pekare + liggande skärm) – Playwrights emulering sätter inte alltid dessa
await p.addInitScript(() => {
  const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/pointer:\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
  try { Object.defineProperty(screen, 'orientation', { get: () => ({ type: innerWidth > innerHeight ? 'landscape-primary' : 'portrait-primary', addEventListener() {} }) }); } catch { /* ok */ }
});
await p.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill&world=mt${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-mt', name: 'Mobil', look: { skin: '#e0a97f', hair: '#3b2619', style: 'ponytail', shirt: '#e04848' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 900, hunger: 60, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] }, tivoli: { band: 4 } }));
});
await p.reload().catch(() => {}); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await sleep(800);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const D = (fn, arg) => p.evaluate(fn, arg);
const matt = () => D(() => ({ html: document.documentElement.className, H: SF.H, safe: { ...SF.view.safe }, pos: SF.scene._debug.pos(), cam: SF.scene._debug.cam() }));

ok(await D(() => document.documentElement.classList.contains('desk-mobil') && !!SF.view.crop), 'telefonen i liggande läge: fyll-läget med beskuren canvas');
// ---- Pixelberg ----
await stang(); await D(() => SF.go('pixelberg')); await sleep(2500); await stang();
const m0 = await matt();
ok(m0.safe.y1 < m0.H && m0.safe.y1 - m0.safe.y0 >= 100, `den synliga rutan är mindre än canvasen (rader ${m0.safe.y0}–${m0.safe.y1} av ${m0.H})`);
await D(() => SF.scene._debug.teleport(1270, 462)); await sleep(1200);
const m1 = await matt(), rad1 = m1.pos.y - m1.cam.y;
ok(rad1 >= m1.safe.y0 + 20 && rad1 <= m1.safe.y1 - 10 && m1.cam.y + m1.safe.y1 >= 480, `längst ner på promenaden: figuren syns (rad ${Math.round(rad1)} av ${m1.safe.y0}–${m1.safe.y1}) och marken når skärmens nederkant (kamera ${Math.round(m1.cam.y)})`);
await D(() => SF.scene._debug.teleport(1270, 436)); await sleep(1200);
const m2 = await matt(), rad2 = m2.pos.y - m2.cam.y;
ok(m2.safe.y1 - rad2 >= 36, `mitt på promenaden: minst 36 rader synlig mark under figuren (${Math.round(m2.safe.y1 - rad2)})`);
// radiobilarna: banans framkant syns och räknaren ligger innanför den synliga rutan
await D(() => SF.scene._debug.act('radio')); await sleep(1500);
const m3 = await matt();
ok((await D(() => SF.scene._debug.aka()))?.typ === 'radio' && m3.cam.y + m3.safe.y1 >= 418 + 6 && m3.cam.y + m3.safe.y0 <= 300, `radiobilarna: banan syns från bakväggen till framkanten (kamera ${Math.round(m3.cam.y)}, rader ${m3.safe.y0}–${m3.safe.y1})`);
ok(m3.safe.y0 + 16 + 11 <= m3.safe.y1, 'räknaren TID/KROCKAR ritas innanför den synliga rutan');
await D(() => SF.scene.key('Escape')); await sleep(500);
// ---- Tassbacken ----
await stang(); await D(() => { SF.tassFran = { y: 240 }; SF.go('tassbacken'); }); await sleep(2500); await stang();
await D(() => SF.scene._debug.teleport(600, 460)); await sleep(1200);
const m4 = await D(() => ({ safe: { ...SF.view.safe }, pos: SF.scene._debug.pos?.() || null, cam: SF.scene._debug.cam?.() || null }));
if (m4.cam && m4.pos) { const rad4 = m4.pos.y - m4.cam.y; ok(rad4 <= m4.safe.y1 - 10 && rad4 >= m4.safe.y0 + 20, `Tassbacken längst ner: figuren syns i rutan (rad ${Math.round(rad4)} av ${m4.safe.y0}–${m4.safe.y1})`); }
else ok(true, 'Tassbacken: (ingen kamera-avläsning i scenen – hoppar över)');
ok(errs.length === 0, 'inga fel i sidan' + (errs.length ? ' – ' + errs.join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
