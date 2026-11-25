// Bilder till händelserna i App Store (app/tools/asc-event.mjs): eventkortet 1920×1080 (kort.jpg) och detaljsidan
// 1080×1920 (sida.jpg, mitten av samma scen beskuren på höjden) – för varje språk i mappen <locale>/, eftersom texten i
// spelet följer språket. Inga rubriker i bilden: App Store skriver händelsens namn själv på kortet.
//   node app/tools/event-snap.mjs jul|rymd [locale,locale…]     → app/store/event/<id>/<locale>/kort.jpg + sida.jpg
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || 8788;
const ID = process.argv[2];
const SPRAK = { sv: 'sv', 'en-US': 'en', 'es-ES': 'es', 'de-DE': 'de', 'fr-FR': 'fr', pl: 'pl', it: 'it', 'pt-PT': 'pt', 'pt-BR': 'pt', 'nl-NL': 'nl', no: 'nb', da: 'da', id: 'id', tr: 'tr', vi: 'vi' };
const valda = (process.argv[3] || Object.keys(SPRAK).join(',')).split(',');
if (!['jul', 'rymd'].includes(ID)) throw new Error('node event-snap.mjs jul|rymd');
const UT = path.resolve('app/store/event', ID);
const browser = await chromium.launch();
for (const locale of valda) {
  const lang = SPRAK[locale];
  const p = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&lang=${lang}&world=ev${Date.now().toString(36)}`);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'a', name: 'Alva', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, color: '#ff5dc8' })); localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 6, min: 600, money: 900, hunger: 80, energy: 80, home: 'husvagn', jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } })); });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.openDockskap(); });
  await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
  const d = (e) => p.evaluate(`(() => { const d = window.SF.scene._debug; return (${e}); })()`);
  await d("d.setLage('bygga')"); await p.waitForTimeout(300);
  if (ID === 'jul') {
    await d('d.goRoom(0)'); await p.waitForTimeout(300);
    await p.click('#dock-panel [data-flik="teman"]'); await p.waitForTimeout(300);
    await p.click('#dock-panel [data-tema="jul"]'); await p.waitForTimeout(400);
    await d("d.placeDoll('bot1', 0, 140, 190)"); await d("d.placeDoll('bot3', 0, 210, 196)");
  } else {
    const i = (await d('d.rooms().map((r) => r.id)')).indexOf('rymd');
    await d("d.unlock('rymd')"); await d(`d.goRoom(${i})`); await p.waitForTimeout(300);
    await d(`d.placeDoll('bot1', ${i}, 150, 196)`); await d(`d.place('utomjording', ${i}, 228, 200)`);
  }
  await d("d.setLage('leka')"); await p.waitForTimeout(300);
  // (julen i dagsljus – natten gjorde kortet för mörkt)
  // bara scenen: dölj panelerna och knapparna, scenens canvas fyller bilden
  await p.evaluate(() => { for (const s of ['#dock-panel', '#dock-lage', '#hud', '#hud-mobil', '#toasts']) document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden'; }); });
  await p.waitForTimeout(300);
  const box = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  const dir = path.join(UT, locale);
  fs.mkdirSync(dir, { recursive: true });
  const rå = path.join(dir, 'scen.png');
  await p.screenshot({ path: rå, clip: box });
  // kortet 1920×1080 (16:9) och sidan 1080×1920 (mitten) – ritas om i en tom sida med canvas
  const data = fs.readFileSync(rå).toString('base64');
  const q = await browser.newPage();
  for (const [fil, W, H] of [['kort.jpg', 1920, 1080], ['sida.jpg', 1080, 1920]]) {
    const url = await q.evaluate(async ([b64, W, H]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
      x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return c.toDataURL('image/jpeg', 0.92);
    }, [data, W, H]);
    fs.writeFileSync(path.join(dir, fil), Buffer.from(url.split(',')[1], 'base64'));
  }
  await q.close();
  fs.rmSync(rå);
  console.log(`${locale}: ${path.relative(process.cwd(), dir)} (kort.jpg, sida.jpg)${errs.length ? ' – sidfel: ' + errs[0] : ''}`);
  await p.close();
}
await browser.close();
