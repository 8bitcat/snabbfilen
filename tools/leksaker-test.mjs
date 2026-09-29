// Leksakslådan: dörren i staden leder in, man köper en squishy-dumpling, klämmer på en
// leksak, och köpet finns kvar efter omladdning (sparfältet toys i game.js).
// Kör: node tools/leksaker-test.mjs   (servern på 8788, eller SMOKE_PORT)
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
const URL = `http://localhost:${PORT}/index.html?world=lk${Date.now().toString(36)}`;
await page.goto(URL);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Leka', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 12 * 60, money: 500, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());

// dörren i staden
const map = await page.evaluate(async () => { const m = await import('./js/city/map.js'); const b = m.ALL_BUILDINGS.find((x) => x.id === 'leksaker'); return { finns: !!b, sign: b?.sign, problem: m.validateMap ? m.validateMap() : [] }; });
ok(map.finns && map.sign === 'LEKSAKSLÅDAN', `Leksakslådan står i staden (${map.sign})`);
ok(Array.isArray(map.problem) && map.problem.length === 0, `kartan är konsekvent (${(map.problem || []).join('; ') || 'inga problem'})`);
// (v3: Lilla rummet ligger i förortens höghus på andra sidan floden – figuren ställs en bit bort på
// trottoaren framför affären och går därifrån till dörren, så att testet prövar dörren och inte promenaden)
await page.evaluate(() => { const A = window.SF; A.game.min = 12 * 60; A.go('city'); const d = A.scene._debug, b = d.buildings.find((x) => x.id === 'leksaker'); d.teleport((b.door.x0 + b.door.x1) / 2 + 70, b.base + 22); d.enter('leksaker'); });
let inne = false;
for (let i = 0; i < 60 && !inne; i++) { await page.waitForTimeout(250); inne = await page.evaluate(() => window.SF.sceneName === 'leksaker'); }
ok(inne, 'dörren leder in i leksaksaffären');

// köp och kläm
const kop = await page.evaluate(() => { const g = window.SF.game, before = g.money; const r = window.SF.scene._debug.buy('dumpling-rosa'); return { r, before, after: g.money, toys: { ...(g.toys || {}) } }; });
ok(kop.r?.ok && kop.after < kop.before && kop.toys['dumpling-rosa'] >= 1, `köpte en rosa dumpling (${kop.before} → ${kop.after} kr)`);
const klam = await page.evaluate(() => { try { const r = window.SF.scene._debug.squeeze(0); return r !== undefined; } catch (e) { return String(e); } });
ok(klam === true, 'klämbordet svarar när man klämmer');
await page.evaluate(() => window.SF.game.save());

// omladdning: köpet finns kvar
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(500);
const kvar = await page.evaluate(() => ({ ...(window.SF.game.toys || {}) }));
ok(kvar['dumpling-rosa'] >= 1, `köpet finns kvar efter omladdning (${JSON.stringify(kvar)})`);

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
