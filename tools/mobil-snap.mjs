// Mobilfyllningen i bild och siffror: spelet ska fylla HELA ytan under HUD-raden
// på varje enhet (?mobfill=1 slår på fyllningen för testrobotar). Kontrollerar:
// ingen skroll, canvasen täcker #app exakt, remsan lika bred som spelbilden,
// staden ser MER värld (A.W växer), fasta scener 384×216 i centrerad ruta,
// och att gamla 384×216-läget är orört utan flaggan (testbaslinjerna står).
//   node tools/mobil-snap.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch();
const SAVE = JSON.stringify({ v: 1, day: 3, min: 600, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false });

async function boot(w, h, dpr, { fill = true } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 900, hasTouch: w < 900 });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(m.text()));
  const u = `http://localhost:${PORT}/index.html?nomenu${fill ? '&mobfill=1' : ''}&world=mf${Math.random().toString(36).slice(2, 7)}`;
  await p.goto(u);
  await p.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'kalle', name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }));
    localStorage.setItem('snabbfilen_save1', s);
    localStorage.setItem('snabbfilen_hud', 'pix'); // spelarnas läge: mätarremsan ovanför spelbilden
  }, SAVE);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(900);
  return { c, p };
}

const geo = (p) => p.evaluate(() => {
  const r = (el) => { const b = el?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
  const strip = document.getElementById('hudpix');
  return {
    app: r(document.getElementById('app')), cv: r(document.getElementById('scene')),
    strip: strip && !strip.classList.contains('hidden') ? r(strip) : null,
    scrollX: document.documentElement.scrollWidth - window.innerWidth,
    scrollY: document.documentElement.scrollHeight - window.innerHeight,
    W: SF.W, H: SF.H, pxs: SF.pxs, view: { ...SF.view }, scene: SF.sceneName,
  };
});

async function fillCase(name, w, h, dpr) {
  const { c, p } = await boot(w, h, dpr);
  const setZoom = async (z) => { await p.evaluate((zz) => { localStorage.setItem('snabbfilen_zoom', zz); window.dispatchEvent(new Event('resize')); }, z); await p.waitForTimeout(200); };
  // NÄRA (mobilens standard): klassiska 384-bilden – samma som på datorn – förstorad tills skärmen täcks
  await setZoom('nara');
  const r = await geo(p);
  const stripH = r.strip ? r.strip.h : 0;
  ok(r.cv.w >= r.app.w - 2 || r.cv.h >= r.app.h - stripH - 3, `${name}: NÄRA – rummet täcker skärmen (canvas ${r.cv.w | 0}×${r.cv.h | 0}, app ${r.app.w | 0}×${r.app.h | 0})`);
  ok(r.W === 384 && r.H === 216 && !r.view.boxed, `${name}: NÄRA – klassiska vyn utan ram`);
  ok(r.scrollX <= 0 && r.scrollY <= 0, `${name}: ingen skroll (${r.scrollX}, ${r.scrollY})`);
  ok(r.strip && Math.abs(r.strip.w - r.app.w) <= 2 && r.strip.y <= r.app.y + 2, `${name}: mätarremsan spänner över hela bredden`);
  ok(await p.evaluate(() => !!document.getElementById('hud-zoom')), `${name}: 🔍-knappen finns i HUD-raden`);
  await p.screenshot({ path: `tools/out/mobil-${name}-rum.png` });
  await p.evaluate(() => SF.go('city'));
  await p.waitForTimeout(800);
  const n = await geo(p);
  ok(n.W === 384 && (n.cv.w >= n.app.w - 2 || n.cv.h >= n.app.h - stripH - 3), `${name}: NÄRA – staden i klassiska vyn, fyller skärmen`);
  await p.screenshot({ path: `tools/out/mobil-${name}-stad-nara.png` });
  // VID: ser mer värld
  await setZoom('vid');
  const s = await geo(p);
  ok(s.W === s.view.w && s.W > 384, `${name}: VID – staden ser MER värld på bredden (A.W ${s.W} av vyn ${s.view.w})`);
  ok(s.H >= 216 && s.H >= Math.min(s.view.h, 400), `${name}: VID – staden använder höjden (A.H ${s.H}, vy ${s.view.h})`);
  await p.screenshot({ path: `tools/out/mobil-${name}-stad.png` });
  await p.evaluate(() => SF.go('mat'));
  await p.waitForTimeout(500);
  const m2 = await geo(p);
  ok(m2.W === Math.min(m2.view.w, 768) && m2.W > 384, `${name}: VID – mataffären ser mer butik (A.W ${m2.W})`);
  await p.screenshot({ path: `tools/out/mobil-${name}-mat.png` });
  await p.evaluate(() => SF.go('kafe'));
  await p.waitForTimeout(500);
  const k2 = await geo(p);
  ok(k2.W === Math.min(k2.view.w, 640) && k2.W > 384 && k2.H === 216, `${name}: VID – kaféet ser mer lokal (A.W ${k2.W})`);
  await p.evaluate(() => SF.go('mobler'));
  await p.waitForTimeout(700);
  const i2 = await geo(p);
  ok(i2.W > 384 && i2.H === Math.min(i2.view.h, 388), `${name}: VID – Möbeljätten ser mer varuhus (A.W ${i2.W}, A.H ${i2.H})`);
  await p.screenshot({ path: `tools/out/mobil-${name}-ikea.png` });
  // RAM: hela bilden med pixelram
  await p.evaluate(() => SF.go('room'));
  await p.waitForTimeout(400);
  await setZoom('ram');
  const r2 = await geo(p);
  ok(r2.view.boxed && Math.abs(r2.app.w - r2.cv.w) <= 2, `${name}: RAM – hela bilden med pixelram`);
  await c.close();
}

console.log('— fyllning på riktiga enheter —');
await fillCase('iphone13mini-liggande', 812, 375, 3);
await fillCase('iphone13mini-staende', 375, 812, 3);
await fillCase('pixel5', 851, 393, 2.75);
await fillCase('dator', 1366, 768, 1);

console.log('— testrobotarnas gamla läge (utan ?mobfill) —');
{
  const { c, p } = await boot(1280, 820, 1, { fill: false });
  const r = await geo(p);
  ok(r.W === 384 && r.H === 216 && !r.view.boxed && r.view.w === 384, 'utan flaggan: exakt gamla 384×216-läget');
  ok(Math.abs(r.cv.w - 384 * r.pxs) <= 1, `utan flaggan: canvasens CSS-bredd är heltalsskalan (${r.cv.w | 0} = 384×${r.pxs})`);
  await c.close();
}

console.log('— vänd på mobilen —');
{
  const { c, p } = await boot(375, 812, 3); // robot utan ?rothint: skylten hålls undan
  ok(await p.evaluate(() => document.getElementById('rotate').classList.contains('hidden')), 'robot utan flagga: ingen vändskylt');
  await c.close();
}
{
  const c = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill=1&rothint=1&world=rot${Math.random().toString(36).slice(2, 6)}`);
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.getElementById('rotate').classList.contains('hidden')), 'stående mobil: vändskylten visas');
  await p.screenshot({ path: 'tools/out/mobil-vandskylt.png' });
  await p.click('#rotate-anyway');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById('rotate').classList.contains('hidden')), '"Spela stående ändå" gömmer skylten resten av sessionen');
  await c.close();
}

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
