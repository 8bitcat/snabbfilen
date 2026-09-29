// FLYGTERMINALEN: dörren i staden leder in i hallen, stationschefen erbjuder incheckningen,
// passet ger lön och man står kvar i terminalen; flygjobben går efter 20 (men inte efter 23),
// ett nattpass som når midnatt slutar med nattbussen hem – ingen kollaps – och den som
// smiter från bagagepasset hamnar också i terminalen.
// Kör: node tools/terminal-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000, step = 200) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }
const scene = () => page.evaluate(() => window.SF.sceneName);
const head = () => page.locator('#modal:not(.hidden) .dlg-head h2').textContent().catch(() => '');

await page.goto(`http://localhost:${PORT}/index.html?world=te${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Flygis', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 10 * 60, money: 200, hunger: 90, energy: 95, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());

// 1) dörren i staden → terminalen
await page.evaluate(() => { const A = window.SF; A.game.min = 10 * 60; A.go('city'); A.scene._debug.enter('flyg'); });
ok(await until(async () => (await scene()) === 'terminal', 30000), 'flygplatsens dörr leder in i terminalen');

// 2) stationschefen → incheckningspasset → lönen → kvar i terminalen
await page.evaluate(() => { const p = window.SF.scene._debug.spot('incheckning'); window.SF.scene.down(p.x, p.y); });
ok(await until(async () => /Incheckningen/.test(await head()), 20000), `stationschefen erbjuder incheckningspasset (${await head()})`);
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'jobbincheck'), 'passet börjar vid disken');
const before = await page.evaluate(() => window.SF.game.money);
await page.evaluate(() => { for (let i = 0; i < 70; i++) window.SF.scene.update(1); });
ok(await until(async () => /Passet är slut/.test(await head())), 'passet tar slut med lönebesked');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'terminal'), 'efter lönen står man kvar i terminalen');
const dag = await page.evaluate(() => ({ money: window.SF.game.money, min: window.SF.game.min, jobs: window.SF.game.jobs.incheckning }));
ok(dag.jobs === 1 && dag.min >= 14 * 60 && dag.min < 14 * 60 + 45, `passet räknas och tar fyra timmar (${dag.jobs} pass, klockan ${(dag.min / 60).toFixed(2)})`); // (klockan går även medan man går)
ok(dag.money >= before, `lönen kom in (${before} → ${dag.money} kr)`);

// 3) öppettider: flygjobben går på kvällen, andra jobb stänger 20, sista nattpasset 23
const tider = await page.evaluate(() => { const g = window.SF.game; g.energy = 90; g.min = 21 * 60; const a = g.canWork('incheckning').ok, b = g.canWork('flygplats').ok, c = g.canWork('posten').ok; g.min = 23 * 60 + 20; const d = g.canWork('incheckning').ok; return { a, b, c, d }; });
ok(tider.a && tider.b, 'incheckningen och bagaget går att jobba 21:00');
ok(!tider.c, 'Posten har stängt 21:00 som förut');
ok(!tider.d, 'efter 23:00 går inget nattpass');

// 4) nattpass som når midnatt: nattbussen hem, ingen kollaps
await page.evaluate(() => { const g = window.SF.game; g.min = 21 * 60; g.energy = 90; g.hunger = 90; window.SF.startJob('incheckning'); });
ok(await until(async () => /Incheckningen/.test(await head())), 'nattpasset erbjuds 21:00');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'jobbincheck'), 'nattpasset börjar');
await page.evaluate(() => { for (let i = 0; i < 70; i++) window.SF.scene.update(1); });
ok(await until(async () => /Passet är slut/.test(await head())), 'nattpasset tar slut');
const knapp = await page.locator('#modal:not(.hidden) .dlg-foot .btn-go').textContent();
ok(/åk hem/i.test(knapp), `knappen säger att man åker hem (${knapp})`);
const natt = await page.evaluate(() => ({ min: window.SF.game.min, collapsed: window.SF.game.collapsed }));
ok(natt.min === 24 * 60 - 1 && !natt.collapsed, `klockan stannar 23:59 utan kollaps (${natt.min}, kollaps ${natt.collapsed})`);
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'room'), 'nattbussen tar en hem');
ok(await until(async () => /Sov/.test(await head()), 5000), `sömnfrågan kommer direkt (${await head()})`);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());

// 5) smita från bagagepasset → tillbaka i terminalen
await page.evaluate(() => { const g = window.SF.game; g.day += 1; g.min = 9 * 60; g.energy = 90; window.SF.startJob('flygplats'); });
ok(await until(async () => /Flygplatsen/.test(await head())), 'bagagepasset erbjuds');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'jobbflyg'), 'bagagepasset börjar');
await page.evaluate(async () => { const s = await import('./js/jobs/shift.js'); s.abortShift(window.SF); });
await page.click('#modal:not(.hidden) .dlg-foot .btn-red');
ok(await until(async () => (await scene()) === 'terminal'), 'den som smiter hamnar i terminalen');

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
