// MOBILEN I JOBBEN (Carl 2026-09-30, Burgarbaren på iPhone i liggande läge: "sakerna på disken
// … fastnar bakom"). Telefonen beskär scenen i höjdled – mest i NÄRA och med Safaris adressfält.
// Kollar: passets tid och poäng står i pixelremsan (inte som en mörk rad över scenen), bilden
// följer figuren i höjdled – disken med tallrikarna syns vid disken, nedre bordsraden när man
// gått ner – och den står stilla (fast beskärning) i staden.
//   node tools/mobil-jobb-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const pw = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const browser = await pw.chromium.launch();
// iPhone 13 mini liggande, med adressfältet (mest beskärning) – NÄRA och VID
for (const [zoom, vh] of [['nara', 330], ['vid', 330], ['nara', 375]]) {
  const tag = `${zoom}${vh === 330 ? ' + adressfält' : ''}`;
  console.log(`\niPhone 13 mini ${tag}`);
  const ctx = await browser.newContext({ viewport: { width: 812, height: vh }, screen: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((z) => { try { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'G', look: {}, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 590, money: 250, hunger: 60, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 })); localStorage.setItem('snabbfilen_hud', 'pix'); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_zoom', z); localStorage.setItem('snabbfilen_zoom_dator', '1'); } catch { /* ok */ } }, zoom);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  await page.goto(`http://localhost:${PORT}/index.html?mobfill=1&world=mj${Date.now().toString(36)}`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 60000 });
  await wait(900);
  await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); window.SF.go('jobbburgare', { onDone: () => {} }); });
  await wait(1200);
  await page.evaluate(() => { const d = window.SF.scene._debug; for (let i = 0; i < 4; i++) d.forcePlate(i); });
  // gå fram till disken
  await page.evaluate(() => window.SF.scene.down(110, 96));
  await wait(2500);
  const top = await page.evaluate(() => ({ safe: { ...window.SF.view.safe }, y: window.SF.scene.worldY, hud: !!window.SF.shiftHud && performance.now() - window.SF.shiftHud.at < 600, crop: !!window.SF.view.crop && window.SF.view.crop.ch > window.SF.view.crop.ah + 1 }));
  ok(top.hud, `${tag}: passets tid och poäng står i remsan överst (inte över scenen)`);
  ok(top.safe.y0 <= 58 - 14, `${tag}: vid disken syns tallrikarna på disken (synligt från rad ${top.safe.y0}, disken ${58 - 14})`);
  await page.screenshot({ path: `tools/out/mobil-jobb-${zoom}-${vh}-disken.png` });
  // ner till nedre bordsraden
  await page.evaluate(() => window.SF.scene.down(200, 206));
  await wait(3500);
  const bot = await page.evaluate(() => ({ safe: { ...window.SF.view.safe }, y: window.SF.scene.worldY }));
  ok(bot.safe.y1 >= 205 && bot.y > 190, `${tag}: nere vid borden följer bilden med (synligt till rad ${bot.safe.y1}, figuren på ${Math.round(bot.y)})`);
  if (top.crop) ok(bot.safe.y0 > top.safe.y0, `${tag}: bilden flyttade sig nedåt (${top.safe.y0} → ${bot.safe.y0})`);
  await page.screenshot({ path: `tools/out/mobil-jobb-${zoom}-${vh}-borden.png` });
  // staden: fast beskärning (egen kamera) – ingen följning i höjdled
  await page.evaluate(() => { window.SF.go('city'); });
  await wait(900);
  const city = await page.evaluate(() => ({ hud: !!window.SF.shiftHud && performance.now() - window.SF.shiftHud.at < 600 }));
  ok(!city.hud, `${tag}: i staden står klockan och mätarna i remsan igen`);
  await ctx.close();
}
await browser.close();
ok(!errs.length, errs.length ? 'fel: ' + errs.join(' | ') : 'inga pageerror');
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
