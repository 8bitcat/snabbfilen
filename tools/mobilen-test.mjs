// Regressionstest för MOBILEN (js/core/mobilen.js) – knapparna samlade i figurens mobil nere till höger:
//   • raden överst visar bara mätarna (inga synliga knappar), mobilknappen syns nere till höger
//   • mobilen öppnas med tio appar; varje app öppnar det den gamla knappen öppnade:
//     karta, kompisar, livsmål, veckan, dagboken, nyheter, inställningar (spelmenyn med inställningarna
//     utfällda – ljud, musik, zoom, språk …), röst och chatt
//   • Esc och ett tryck utanför stänger mobilen; en ny version ger en röd prick på mobilen
//   • telefonen i liggande läge: mobilen ryms på skärmen och knappen är minst 44 pt
//   • inga fel i konsolen
// Kör: node tools/mobilen-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];
async function boot(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.vp || { width: 1200, height: 760 }, ...(opts.mob ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${opts.mob ? '&mobfill=1' : ''}&world=mob${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 900, hunger: 70, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const D = (p, fn, a) => p.evaluate(fn, a);
const modalText = (p) => D(p, () => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const stang = (p) => D(p, () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
async function app(p, id) { await p.click('#hud-mobil'); await p.waitForTimeout(150); await p.click(`#mobilen [data-app="${id}"]`); await p.waitForTimeout(450); }

// ---- datorn ----
const { ctx, p } = await boot();
ok(await D(p, () => [...document.querySelectorAll('#hud button')].filter((b) => b.offsetParent).length === 0), 'raden överst: inga synliga knappar, bara mätarna');
ok(await D(p, () => { const r = document.querySelector('#hud-mobil')?.getBoundingClientRect(); return !!r && r.width > 40 && r.right > innerWidth - 40 && r.bottom > innerHeight - 40; }), 'mobilknappen syns nere till höger');
await p.click('#hud-mobil'); await p.waitForTimeout(250);
ok(await D(p, () => !document.querySelector('#mobilen').classList.contains('hidden') && document.querySelectorAll('#mobilen [data-app]').length === 10), 'mobilen öppnas med tio appar');
ok(await D(p, () => /\d\d:\d\d/.test(document.querySelector('[data-mob="klocka"]').textContent) && /dag \d/.test(document.querySelector('[data-mob="dag"]').textContent)), 'mobilen visar klockan och dagen');
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
ok(await D(p, () => document.querySelector('#mobilen').classList.contains('hidden')), 'Esc stänger mobilen');
await p.click('#hud-mobil'); await p.waitForTimeout(150);
await p.mouse.click(200, 300); await p.waitForTimeout(150);
ok(await D(p, () => document.querySelector('#mobilen').classList.contains('hidden')), 'ett tryck utanför stänger mobilen');

await app(p, 'karta');
ok(await D(p, () => !!document.querySelector('#modal:not(.hidden)') && document.querySelector('#mobilen').classList.contains('hidden')), 'Karta: kartan öppnas och mobilen stängs');
await stang(p);
await app(p, 'kompisar');
ok(!!(await modalText(p)), `Kompisar: kompisrutan öppnas (${(await modalText(p)).slice(0, 40)}…)`);
await stang(p);
await app(p, 'mal');
ok(/Livsmål|livsmål/.test(await modalText(p)), 'Livsmål: livsmålen öppnas');
await stang(p);
await app(p, 'vecka');
ok(!!(await modalText(p)), 'Veckan: veckorutan öppnas');
await stang(p);
await app(p, 'dagbok');
ok(!!(await modalText(p)), 'Dagboken: dagboken öppnas');
await stang(p);
await app(p, 'nyheter');
ok(/v\d+\.\d+/.test(await modalText(p)), 'Nyheter: nyheterna öppnas');
await stang(p);
await app(p, 'installningar');
const meny = await D(p, () => ({ open: !!document.querySelector('#menu:not(.hidden)'), installn: !document.querySelector('.menu-settings')?.classList.contains('hidden'), ljud: !!document.querySelector('[data-sound]'), zoom: !!document.querySelector('[data-zoom]'), sprak: !!document.querySelector('[data-lang]') }));
ok(meny.open && meny.installn, 'Inställningar: spelmenyn med inställningarna utfällda');
ok(meny.ljud && meny.zoom && meny.sprak, 'inställningarna har ljud, zoom och språk');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await app(p, 'rost');
ok(!!(await modalText(p)), 'Röst: röstchattens ruta öppnas');
await stang(p);
await app(p, 'chatt');
ok(await D(p, () => { const i = document.querySelector('#chat input, .chat input, input[maxlength]'); return !!i && !!i.offsetParent; }), 'Chatt: chattfältet öppnas');
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
// ny version → röd prick
await D(p, () => document.getElementById('hud-version')?.classList.add('ny'));
await p.waitForTimeout(600);
ok(await D(p, () => !document.querySelector('#hud-mobil .mob-badge.ny').classList.contains('hidden')), 'ny version: röd prick på mobilen');
await ctx.close();

// ---- telefonen i liggande läge ----
const M = await boot({ mob: true, vp: { width: 812, height: 375 } });
const k = await D(M.p, () => { const r = document.querySelector('#hud-mobil').getBoundingClientRect(); const s = window.visualViewport ? window.visualViewport.width / innerWidth : 1; return { w: r.width, pt: r.width * (812 / innerWidth) }; });
ok(k.pt >= 44, `telefonen: mobilknappen är ${Math.round(k.pt)} pt (minst 44)`);
await M.p.click('#hud-mobil'); await M.p.waitForTimeout(300);
const fit = await D(M.p, () => { const r = document.querySelector('#mobilen').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), h: innerHeight, w: innerWidth }; });
ok(fit.top >= 0 && fit.bottom <= fit.h && fit.left >= 0, `telefonen: mobilen ryms på skärmen (${JSON.stringify(fit)})`);
await M.p.screenshot({ path: 'tools/out/mobilen-telefon.png' });
await M.ctx.close();

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
