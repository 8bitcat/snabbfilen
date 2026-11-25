// ⭐ BETYGSFRÅGAN (js/core/betyg.js, v0.179) – reglerna för när Apples betygsruta får visas. Appens tillägg ersätts av
// window.__betygTest (räknar anropen), annars är det samma kod som i appen.
//   • en helt ny spelare (dag 1, första glada ögonblicket) får ingen fråga
//   • dag 5 + ett nytt rekord på jobbet → frågan ställs (efter en kort paus)
//   • ett nytt glatt ögonblick samma dag → ingen ny fråga (högst var 120:e dag)
//   • 121 dagar senare → frågan får ställas igen
//   • på webben utan tillägget händer ingenting (inga fel)
//   • lördagsfestens present och lek ihop i Dockskåpet anropar samma funktion (koden importerar den)
// Kör: node tools/betyg-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const p = await browser.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=betyg${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'av-b', name: 'Bea', look: {}, color: '#ff5dc8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 500, hunger: 80, energy: 80, home: 'husvagn', jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
const B = (fn, a) => p.evaluate(fn, a);
// webben utan tillägg: inget händer
ok(await B(async () => { const m = await import('/js/core/betyg.js'); return m.betygOgonblick('lon') === false; }), 'webben (inget tillägg): ingen fråga och inga fel');
await B(() => { localStorage.removeItem('snabbfilen_betyg'); window.__betygAnrop = 0; window.__betygTest = { requestReview: () => { window.__betygAnrop++; return Promise.resolve(); } }; });
ok(await B(async () => { const m = await import('/js/core/betyg.js'); return m.betygOgonblick('lon', { fordrojning: 50 }) === false; }), 'en helt ny spelare (dag 1, första glada ögonblicket): ingen fråga');
await B(() => { window.SF.game.day = 5; });
ok(await B(async () => { const m = await import('/js/core/betyg.js'); return m.betygOgonblick('lon', { fordrojning: 50 }) === true; }), 'dag 5 + ett nytt rekord: frågan ställs');
await sleep(300);
ok(await B(() => window.__betygAnrop === 1), 'Apples ruta anropades en gång (efter pausen)');
ok(await B(async () => { const m = await import('/js/core/betyg.js'); return m.betygOgonblick('fest', { fordrojning: 50 }) === false; }), 'ett nytt glatt ögonblick samma dag: ingen ny fråga');
await B(() => { const s = JSON.parse(localStorage.getItem('snabbfilen_betyg')); s.senast -= 121 * 864e5; localStorage.setItem('snabbfilen_betyg', JSON.stringify(s)); });
ok(await B(async () => { const m = await import('/js/core/betyg.js'); return m.betygOgonblick('dock', { fordrojning: 50 }) === true; }), '121 dagar senare: frågan får ställas igen');
await sleep(300);
const lage = await B(async () => (await import('/js/core/betyg.js')).betygLage());
ok(lage.n === 2 && lage.orsak === 'dock' && (await B(() => window.__betygAnrop)) === 2, `två frågor totalt, senast efter leken i Dockskåpet (${JSON.stringify(lage)})`);
// kopplingarna i koden
const shift = fs.readFileSync('js/jobs/shift.js', 'utf8'), fest = fs.readFileSync('js/city/fest.js', 'utf8'), dock = fs.readFileSync('js/scenes/dockskap.js', 'utf8');
ok(/res\.newRecord\) betygOgonblick\('lon'\)/.test(shift) && /betygOgonblick\('fest'/.test(fest) && (dock.match(/betygOgonblick\('dock'/g) || []).length === 2, 'kopplad till nytt rekord, lördagsfestens present och lek ihop (värd och gäst)');
ok(/apple-itunes-app" content="app-id=6818844405"/.test(fs.readFileSync('index.html', 'utf8')), 'webbsidan har Apples smarta banner (Pixelcity)');
ok(!errs.length, `inga sidfel${errs.length ? ' – ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
