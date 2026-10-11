// Regressionstest för 💼 JOBB och 🏠 HEM i mobilen (js/core/jobben.js) – Carl 2026-10-11: "en ikon i mobilen
// som visar vart alla jobb ligger och en ikon som visar vägen hem":
//   • Jobb: alla 14 jobb, närmast först, med område/öppettider/avstånd, nivå och lön; jobb som kräver en
//     examen säger vilken; 🧭 Visa vägen → pilen i stan pekar på huset, raden markeras nästa gång; 🚕 visar priset
//   • Hem: i stan → pilen pekar hem; hemma → "Du är redan hemma"; gården (på landet) → vägbeskrivning
//   • på engelska: appnamnen och listan är engelska och priset i spelets valuta ($)
//   • startguiden: har man inte använt mobilen efter en stund i stan sätter guiden pilen själv (ingen fastnar)
// Kör: node tools/jobben-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];
async function boot({ lang = '', home = 'husvagn', guide = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    window.__toasts = [];
    new MutationObserver(() => document.querySelectorAll('.toast').forEach((t) => { const s = t.textContent.trim(); if (s && !window.__toasts.includes(s)) window.__toasts.push(s); }))
      .observe(document, { subtree: true, childList: true });
  });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${lang ? '&lang=' + lang : ''}${guide ? '&guide' : ''}&world=jt${Date.now().toString(36)}`);
  await p.evaluate((home) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-jt', name: 'Jobbis', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 900, hunger: 80, energy: 90, home, fridge: {}, jobs: { burgare: 4 }, earned: 300, mal: { id: 'rik', niva: 'latt' } }));
  }, home);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const D = (p, fn, a) => p.evaluate(fn, a);
const stang = (p) => D(p, () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
async function app(p, id) { await p.click('#hud-mobil'); await p.waitForTimeout(200); await p.click(`#mobilen [data-app="${id}"]`); await p.waitForTimeout(450); }

// ---- svenska: jobblistan ----
let { ctx, p } = await boot();
ok(await D(p, () => !!document.querySelector('#mobilen [data-app="jobb"]') && !!document.querySelector('#mobilen [data-app="hem"]')), 'mobilen har appen Jobb och appen Hem');
await app(p, 'jobb');
const lista = await D(p, () => [...document.querySelectorAll('.jl-rad')].map((r) => ({ id: r.dataset.jobb, text: r.innerText.replace(/\s+/g, ' '), m: +((r.innerText.match(/(\d+) m bort/) || [])[1] ?? 0) })));
ok(lista.length === 14, `Jobb: alla ${lista.length} jobb i listan`);
ok(lista.every((r, i) => i === 0 || r.m >= lista[i - 1].m), `närmast först (${lista.slice(0, 3).map((r) => `${r.id} ${r.m} m`).join(', ')} …)`);
const burg = lista.find((r) => r.id === 'burgare');
ok(/Centrum/.test(burg?.text || '') && /öppet \d\d:\d\d–\d\d:\d\d/.test(burg?.text || '') && /Van|Proffs|Nybörjare/.test(burg?.text || '') && /per rätt/.test(burg?.text || ''), `en rad visar område, öppettider, nivå och lön (${(burg?.text || '').slice(0, 90)})`);
ok(/kräver examen i Datorteknik/.test(lista.find((r) => r.id === 'datorbygge')?.text || ''), 'Pixel Data: "kräver examen i Datorteknik"');
ok(/🚕 \d+ kr/.test(burg?.text || ''), 'taxipriset står på knappen');
await p.click('.jl-rad [data-visa="tvatteri"]'); await p.waitForTimeout(500);
ok(await D(p, () => window.SF.guide?.id === 'tvatteri' && !document.querySelector('#modal:not(.hidden)')), '🧭 Visa vägen → rutan stängs och pilen pekar på tvätteriet');
await app(p, 'jobb');
ok(await D(p, () => document.querySelector('.jl-rad[data-jobb="tvatteri"]')?.classList.contains('pil')), 'nästa gång är tvätteriets rad markerad (dit pekar pilen)');
await stang(p);

// ---- Hem (en bit bort från husvagnen – vid dörren säger staden "Framme" och tar bort pilen) ----
await D(p, () => window.SF.scene._debug.teleport(1146, 146)); await p.waitForTimeout(300);
await app(p, 'hem');
ok(await D(p, () => window.SF.guide?.id === 'husvagn'), 'Hem i stan → pilen pekar hem till husvagnen');
await D(p, () => window.SF.go('room')); await p.waitForTimeout(1200); await stang(p);
await app(p, 'hem');
ok(/redan hemma/.test(await D(p, () => window.__toasts.join(' | '))), 'Hem hemma → "Du är redan hemma."');
await ctx.close();

({ ctx, p } = await boot({ home: 'gard' }));
await app(p, 'hem');
ok(/Gården ligger på landet/.test(await D(p, () => window.__toasts.join(' | '))), 'bor man på gården → vägbeskrivning till landet');
await ctx.close();

// ---- engelska ----
({ ctx, p } = await boot({ lang: 'en' }));
const namn = await D(p, () => [document.querySelector('#mobilen [data-app="jobb"] .mob-namn')?.textContent, document.querySelector('#mobilen [data-app="hem"] .mob-namn')?.textContent]);
ok(namn[0] === 'Jobs' && namn[1] === 'Home', `på engelska heter apparna ${namn.join(' och ')}`);
await app(p, 'jobb');
const en = await D(p, () => ({ titel: document.querySelector('#modal .dlg-head h2')?.textContent || '', rad: document.querySelector('.jl-rad[data-jobb="burgare"]')?.innerText.replace(/\s+/g, ' ') || '' }));
ok(/Jobs/.test(en.titel) && /Burger Bar/.test(en.rad) && /\$\d/.test(en.rad) && /away/.test(en.rad) && !/kr\b|bort/.test(en.rad), `listan på engelska med $ (${en.rad.slice(0, 80)})`);
await ctx.close();

// ---- startguiden sätter pilen själv efter en stund ----
({ ctx, p } = await boot({ guide: true }));
await D(p, async () => { const m = await import('/js/core/startguide.js'); m.startGuide(window.SF, { force: true }); });
await p.waitForTimeout(800);
await D(p, () => { window.SF.guide = null; window.SF.go('city'); });
await p.waitForTimeout(1500);
ok(await D(p, () => !window.SF.guide && document.querySelector('#hud-mobil').classList.contains('sg-pulse')), 'guiden: först ingen pil – mobilen pulserar');
await p.waitForFunction(() => window.SF.guide?.id === 'burgare', null, { timeout: 40000 }).catch(() => {});
ok(await D(p, () => window.SF.guide?.id === 'burgare'), 'efter en stund utan mobilen sätter guiden pilen till Burgarbaren själv');
await ctx.close();

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
