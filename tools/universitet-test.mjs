// PIXELHÖGSKOLAN: anmälan i expeditionen (terminsavgiften dras), föreläsning i Aula 1 via en
// bänk (2 timmar, en per dag, man kan inte gå mitt i), tentan i biblioteket (underkänd → omtenta
// nästa dag, godkänd med riktiga klick → examen och diplom), examen öppnar datorjobbet men inte
// finansjobbet, och allt ligger kvar efter omladdning.
// Kör: node tools/universitet-test.mjs   (servern på 8788, eller SMOKE_PORT)
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
const head = () => page.locator('#modal:not(.hidden) .dlg-head h2').textContent().catch(() => '');
const D = (fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.SF.scene._debug, window.SF.game, a), [fn.toString(), arg]);
const clickSpot = (id) => page.evaluate((i) => { const p = window.SF.scene._debug.spot(i); window.SF.scene.down(p.x, p.y); return p; }, id);

await page.goto(`http://localhost:${PORT}/index.html?world=uni${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Plugghäst', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 10 * 60, money: 2000, hunger: 90, energy: 95, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await page.evaluate(() => { window.SF.game.min = 10 * 60; window.SF.go('universitet'); });
ok(await until(() => page.evaluate(() => window.SF.sceneName === 'universitet')), 'Pixelhögskolan öppnar');

// 1) anmälan i expeditionen med riktiga klick
await clickSpot('expedition');
ok(await until(async () => /Studentexpeditionen/.test(await head())), 'studievägledaren öppnar kurslistan');
await page.click('#modal:not(.hidden) [data-kurs="datorteknik"]');
const efter = await D((d, g) => ({ money: g.money, edu: g.edu.datorteknik }));
ok(efter.money === 1400 && efter.edu && efter.edu.lect === 0, `antagen till Datorteknik, terminsavgiften dragen (${efter.money} kr)`);

// 2) föreläsning: klick på en ledig bänk → dialog → föreläsningen går
const bank = await D((d) => d.seats().find((s) => s.kind === 'aula' && !s.occ)?.id);
await clickSpot(bank);
ok(await until(async () => /Föreläsning/.test(await head()), 20000), `bänken ${bank} erbjuder föreläsningen`);
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(() => D((d) => !!d.state().lec)), 'föreläsningen börjar');
const block = await page.evaluate(() => window.SF.scene.leaveBlock?.());
ok(!!block, `man kan inte gå mitt i föreläsningen (${block})`);
const fore = await D((d, g) => g.min);
await D((d) => d.fastLecture());
const l1 = await D((d, g) => ({ lect: g.edu.datorteknik.lect, min: g.min, lec: d.state().lec }));
ok(l1.lect === 1 && !l1.lec && l1.min - fore >= 119, `föreläsning 1 av 4 klar och två timmar gick (${fore} → ${l1.min})`);
const igen = await D((d, g) => g.canLecture('datorteknik'));
ok(!igen.ok, `bara en föreläsning om dagen (${igen.msg})`);

// 3) tre dagar till → alla föreläsningar
for (let i = 0; i < 3; i++) await D((d, g) => { g.day += 1; g.min = 9 * 60; g.energy = 90; d.lecture('datorteknik'); d.fastLecture(); });
const l4 = await D((d, g) => g.edu.datorteknik.lect);
ok(l4 === 4, `alla fyra föreläsningarna gjorda (${l4})`);

// 4) tentan: först underkänd (alla fel), omtenta samma dag nekas
const fail = await D((d) => d.exam('datorteknik', [-1, -1, -1]));
ok(fail.edu && !fail.edu.klar, `underkänd med ${fail.right} rätt`);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
const samma = await D((d, g) => g.canExam('datorteknik'));
ok(!samma.ok, `omtentan är tidigast i morgon (${samma.msg})`);

// 5) nästa dag: godkänd med riktiga klick vid tentabordet
await D((d, g) => { g.day += 1; g.min = 11 * 60; d.teleport(600, 200); });
const facit = await D((d) => d.quiz('datorteknik'));
await clickSpot('tenta-0');
for (let i = 0; i < facit.length; i++) {
  ok(await until(async () => new RegExp(`fråga ${i + 1} av`).test(await head()), 20000), `tentafråga ${i + 1}: ${facit[i].q}`);
  await page.click(`#modal:not(.hidden) [data-svar="${facit[i].right}"]`);
}
ok(await until(async () => /EXAMEN/.test(await head())), 'godkänd – examensbeviset visas');
ok(await page.locator('#modal:not(.hidden) img[alt="Examensbevis"]').count() === 1, 'diplomet är en bild');
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
const jobb = await D((d, g) => ({ klar: g.edu.datorteknik.klar, dator: g.canWork('datorbygge'), finans: g.canWork('finans') }));
ok(jobb.klar, 'examen i Datorteknik');
ok(jobb.dator.ok, 'examen öppnar datorbyggjobbet');
ok(!jobb.finans.ok && /Ekonomi/.test(jobb.finans.msg), `finansjobbet kräver Ekonomi (${jobb.finans.msg})`);

// 6) omladdning: allt ligger kvar
await page.evaluate(() => window.SF.game.save());
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(500);
const kvar = await page.evaluate(() => window.SF.game.edu);
ok(kvar?.datorteknik?.klar === true && kvar.datorteknik.lect === 4, `examen finns kvar efter omladdning (${JSON.stringify(kvar)})`);

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
