// MOBILEN I DATORNS UPPLÖSNING: en telefon i liggande läge lägger ut sidan som en datorskärm
// (1280 px bred, allt nedskalat lika mycket) – figurskaparen och menyerna får plats som på datorn,
// devicePixelRatio blir enhetspixlar per CSS-pixel (knivskarpa canvasar) i både Chromium och
// WebKit (iPhone). Stående telefon och datorn: som förut.
//   node tools/mobil-dator-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const pw = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const save = { v: 1, day: 2, min: 660, money: 500, hunger: 90, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0 };
async function boot(browser, opts, tag) {
  const ctx = await browser.newContext(opts);
  // sparfilen läggs in före första laddningen (WebKit hänger på page.reload i Windows-versionen)
  await ctx.addInitScript((s) => { try { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobil', look: {}, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); localStorage.setItem('snabbfilen_hud', 'pix'); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_zoom', 'vid'); } catch { /* ok */ } }, save);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/index.html?mobfill=1&world=md${tag}${Date.now().toString(36)}`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 60000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
const state = (page) => page.evaluate(() => ({ meta: document.querySelector('meta[name=viewport]').getAttribute('content'), desk: document.documentElement.classList.contains('desk-mobil'), iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, vv: visualViewport?.scale || 1 }));

for (const engine of ['chromium', 'webkit']) {
  console.log(`\n== ${engine}`);
  const browser = await pw[engine].launch();
  // 1) telefoner liggande – iPhone 13 mini (helskärm och med Safaris adressfält), iPhone 13,
  // en äldre iPhone (@2) och en Android (@2,625). Bredden väljs så att en CSS-pixel = HELA skärmpixlar.
  const PHONES = [
    ['iPhone 13 mini', 812, 375, 812, 375, 3],
    ['iPhone 13 mini + adressfält', 812, 375, 812, 330, 3],
    ['iPhone 13', 844, 390, 844, 390, 3],
    ['iPhone SE', 667, 375, 667, 340, 2],
    ['Android', 915, 412, 915, 380, 2.625],
  ];
  for (const [namn, sw, sh, vw, vh, d] of PHONES) {
    const { ctx, page, errs } = await boot(browser, { viewport: { width: vw, height: vh }, screen: { width: sw, height: sh }, deviceScaleFactor: d, hasTouch: true, isMobile: true }, 'l');
    const s = await state(page);
    const phys = Math.round(sw * d), k = Math.max(1, Math.round(phys / 1280)), wantW = Math.round(phys / k);
    ok(s.desk && s.iw === wantW, `${namn}: sidan läggs ut ${s.iw}×${s.ih} som på datorn (väntat bredd ${wantW})`);
    ok(Math.abs(s.dpr - k) < 0.02, `${namn}: en CSS-pixel = ${s.dpr.toFixed(3)} skärmpixlar (helt tal ${k})`);
    await page.evaluate(() => window.SF.go('city'));
    await page.waitForTimeout(700);
    const cv = await page.evaluate(() => { const c = document.getElementById('scene'), r = c.getBoundingClientRect(); return { bw: c.width, cssW: r.width, pxs: window.SF.pxs }; });
    ok(Math.abs(cv.bw - cv.cssW * s.dpr) < cv.bw * 0.03 && cv.pxs >= 2, `${namn}: spelbilden pixelexakt (${cv.bw} ≈ ${Math.round(cv.cssW * s.dpr)}, ${cv.pxs} per spelpixel)`);
    await page.evaluate(async () => { const av = await import('./js/core/avatar.js'); av.openAvatarEditor({}); });
    await page.waitForTimeout(500);
    const fit = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.av-tab')], foot = document.querySelector('#modal .dlg-foot')?.getBoundingClientRect(), dlg = document.querySelector('#modal .dlg')?.getBoundingClientRect();
      const tr = tabs.map((t) => t.getBoundingClientRect());
      return { n: tabs.length, tabsIn: tr.every((r) => r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth), footIn: !!foot && foot.bottom <= innerHeight + 1 && foot.top > 0, dlgH: dlg?.height, ih: innerHeight };
    });
    ok(fit.n >= 12 && fit.tabsIn && fit.footIn, `${namn}: figurskaparen får plats – alla ${fit.n} flikar och Spara-raden syns (dialogen ${Math.round(fit.dlgH)} av ${fit.ih})`);
    await page.screenshot({ path: `tools/out/mobil-dator-${engine}-${namn.replace(/[^a-z0-9]+/gi, '-')}.png` });
    ok(!errs.length, errs.length ? `${namn}: fel ` + errs.join(' | ') : `${namn}: inga fel`);
    await ctx.close();
  }
  // 2) telefon stående: vanlig bredd
  const st = await boot(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 's');
  const s2 = await state(st.page);
  ok(!s2.desk && /device-width/.test(s2.meta) && s2.iw === 390, `stående: vanlig bredd (${s2.iw})`);
  await st.ctx.close();
  // 3) datorn: orörd
  const dt = await boot(browser, { viewport: { width: 1280, height: 720 } }, 'd');
  const s3 = await state(dt.page);
  ok(!s3.desk && /device-width/.test(s3.meta) && s3.dpr === 1, `datorn: som förut (dpr ${s3.dpr})`);
  await dt.ctx.close();
  await browser.close();
}
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
