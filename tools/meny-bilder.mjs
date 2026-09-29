// Menybilder för granskning: öppnar de viktigaste dialogerna och menyerna på datorn (1280×720)
// och på iPhone 13 mini liggande (812×375 @3, med adressfält 812×330) och sparar skärmbilder i
// tools/out/meny/<enhet>-<namn>.png. Mäter också om något sticker utanför dialogen.
//   node tools/meny-bilder.mjs [--engine webkit]     (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const pw = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
const engine = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
const OUT = 'tools/out/meny/';
fs.mkdirSync(OUT, { recursive: true });
const save = { v: 1, day: 3, min: 11 * 60, money: 1500, hunger: 70, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0 };
const DEVICES = [
  ['dator', { viewport: { width: 1280, height: 720 } }],
  ['mini', { viewport: { width: 812, height: 330 }, screen: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
];
// [namn, hur man öppnar (i sidan)]
const MENUS = [
  ['vecka', () => import('./js/core/week.js').then((m) => m.openWeek(window.SF))],
  ['gubbe', () => import('./js/core/avatar.js').then((m) => m.openAvatarEditor({}))],
  ['meny', () => document.getElementById('hud-menu')?.click()],
  ['online', () => document.getElementById('hud-friends')?.click()],
  ['karta', () => window.SF.openMap('karta', 'burgare')],
  ['resan', () => document.getElementById('hud-diary')?.click()],
  ['mat', () => window.SF.openFoodShop?.()],
  ['bostad', () => window.SF.openHousing?.()],
  ['jobb', () => window.SF.startJob?.('frukt')],
];
const browser = await pw[engine].launch();
const report = [];
for (const [dev, opts] of DEVICES) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((s) => { try { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Granskare', look: {}, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); localStorage.setItem('snabbfilen_hud', 'pix'); localStorage.setItem('snabbfilen_tips_hus', '1'); } catch { /* ok */ } }, save);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/index.html?mobfill=1&world=mb${Date.now().toString(36)}`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
  await page.evaluate(() => window.SF.go('city'));
  await page.waitForTimeout(1000);
  for (const [name, open] of MENUS) {
    await page.evaluate(() => { document.querySelector('#modal')?.classList.add('hidden'); document.querySelector('.menu-overlay, #menu')?.classList?.add('hidden'); });
    await page.evaluate(`(${open.toString()})()`).catch(() => {});
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const d = document.querySelector('#modal:not(.hidden) .dlg') || document.querySelector('.menu-panel');
      if (!d) return null;
      const r = d.getBoundingClientRect(), out = [];
      for (const el of d.querySelectorAll('*')) { const q = el.getBoundingClientRect(); if (q.width && (q.right > r.right + 2 || q.left < r.left - 2)) out.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]); }
      return { w: Math.round(r.width), h: Math.round(r.height), ih: innerHeight, over: [...new Set(out)].slice(0, 5) };
    });
    report.push(`${dev} ${name}: ${m ? `${m.w}×${m.h} av ${m.ih}${m.over.length ? ' · STICKER UT: ' + m.over.join(', ') : ''}` : 'ingen dialog'}`);
    await page.screenshot({ path: `${OUT}${dev}-${name}.png` });
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
  }
  await ctx.close();
}
await browser.close();
console.log(report.join('\n'));
