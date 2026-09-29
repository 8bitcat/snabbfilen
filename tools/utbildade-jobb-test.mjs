// DE UTBILDADE JOBBEN: utan examen släpps man inte in; med examen i Datorteknik bygger man en
// dator på PIXEL DATA (rätt delar = rätt, fel modell = fel, färdig dator = bonus) och får lön;
// med examen i Ekonomi handlar man på Finanshuset (rätt läge = affär, för dyrt och fel knapp = fel).
// Kör: node tools/utbildade-jobb-test.mjs   (servern på 8788, eller SMOKE_PORT)
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
const scene = () => page.evaluate(() => window.SF.sceneName);
const D = (fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.SF.scene._debug, window.SF.game, a), [fn.toString(), arg]);

await page.goto(`http://localhost:${PORT}/index.html?world=uj${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Examinerad', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 10 * 60, money: 100, hunger: 90, energy: 95, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await page.evaluate(() => window.SF.go('city'));

// 1) utan examen
const utan = await page.evaluate(() => ({ d: window.SF.game.canWork('datorbygge'), f: window.SF.game.canWork('finans') }));
ok(!utan.d.ok && /Datorteknik/.test(utan.d.msg) && !utan.f.ok && /Ekonomi/.test(utan.f.msg), `utan examen släpps man inte in (${utan.d.msg})`);
await page.evaluate(() => window.SF.startJob('datorbygge'));
await sleep(600);
ok((await scene()) === 'city' && !/Pixel Data/.test(await head()), 'datorjobbet startar inte utan examen');

// 2) PIXEL DATA med examen i Datorteknik
await page.evaluate(() => { const g = window.SF.game; g.edu = { datorteknik: { lect: 4, day: 1, tenta: 1, tentaDay: 1, klar: true }, ekonomi: { lect: 4, day: 1, tenta: 1, tentaDay: 1, klar: true } }; g.min = 10 * 60; g.energy = 95; g.save(); window.SF.startJob('datorbygge'); });
ok(await until(async () => /Pixel Data/.test(await head())), 'med examen erbjuds passet på Pixel Data');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'jobbdatorbygge'), 'verkstaden öppnar');
const pengar0 = await page.evaluate(() => window.SF.game.money);
// en fel modell först
const fel1 = await D((d) => { const o = d.order(); const bad = { PX3: 'cpu5', PX5: 'cpu7', PX7: 'cpu3' }[o.cpu]; d.pick(bad); d.install(); return d.stats.fel; });
ok(fel1 === 1, 'fel processormodell räknas som fel och delen åker tillbaka');
// kylaren före processorn går inte
await D((d) => d.tool('kylare'));
ok((await D((d) => d.state().box.kylare)) === false, 'kylaren går inte på utan processor och kylpasta');
// resten rätt med riktiga klick: låda → datorlådan
for (const id of await D((d) => d.wanted())) {
  await page.evaluate((i) => { const p = window.SF.scene._debug.spot(i); window.SF.scene.down(p.x, p.y); }, id);
  await until(() => D((d, g, i) => d.state().carry === i, id), 6000, 100);
  await page.evaluate(() => { const p = window.SF.scene._debug.spot('lada'); window.SF.scene.down(p.x, p.y); });
  await until(() => D((d) => !d.state().carry), 6000, 100);
}
await D((d) => { d.tool('pasta'); d.tool('kylare'); });
const bygg = await D((d) => d.state());
ok(bygg.box.cpu && bygg.box.ram && bygg.box.ssd && bygg.box.psu && bygg.box.pasta && bygg.box.kylare, `alla delar sitter i (${JSON.stringify(bygg.box)})`);
await D((d) => d.power());
ok(await until(() => D((d) => d.stats.boxes === 1), 8000), 'startknappen → BIOS OK → färdig dator');
await D((d) => d.finish());
ok(await until(async () => /Passet är slut/.test(await head())), 'lönebeskedet kommer');
const body = await page.locator('#modal:not(.hidden) .dlg-body').textContent();
ok(/Färdiga (datorer|lådor)/.test(body), 'bonusen för färdiga datorer syns i lönebeskedet');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
const pengar1 = await page.evaluate(() => window.SF.game.money);
ok(pengar1 > pengar0, `lönen kom in (${pengar0} → ${pengar1} kr)`);

// 3) Finanshuset med examen i Ekonomi
await page.evaluate(() => { const g = window.SF.game; g.min = 10 * 60; g.energy = 95; window.SF.startJob('finans'); });
ok(await until(async () => /Finanshuset/.test(await head())), 'med examen erbjuds passet på Finanshuset');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(async () => (await scene()) === 'jobbfinans'), 'handelssalen öppnar');
const aff = await D((d) => {
  const p = d.stocks()[0].p;
  d.force(0, 'KÖP', p + 5); const a = d.trade(0, 'KÖP').ok;        // köp under gränsen: klar
  d.force(1, 'SÄLJ', d.stocks()[1].p + 50); const b = d.trade(1, 'SÄLJ').fel; // för billigt
  d.force(2, 'KÖP', d.stocks()[2].p + 5); const c = d.trade(2, 'SÄLJ').fel;   // fel knapp
  return { a, b, c };
});
ok(aff.a === 1, 'rätt läge → affären klar');
ok(aff.b === 1, 'sälja under kundens gräns → fel');
ok(aff.c === 2, 'fel knapp → fel');
// en riktig knapptryckning på skärmen
await D((d) => d.force(3, 'KÖP', d.stocks()[3].p + 5));
await page.evaluate(() => { const p = window.SF.scene._debug.spot(3, 'KÖP'); window.SF.scene.down(p.x, p.y); });
ok((await D((d) => d.stats.ok)) === 2, 'knappen KÖP på skärmen gör affären');
await D((d) => d.finish());
ok(await until(async () => /Passet är slut/.test(await head())), 'lönebeskedet kommer efter handeln');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
