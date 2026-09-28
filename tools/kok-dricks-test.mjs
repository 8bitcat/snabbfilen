// Dricksen i Burgarköket går in i lönen (Carls beslut 2026-09-28):
//  1) introdialogen berättar om dricksen
//  2) en snabbt serverad rätt ger dricks (+10 blixtsnabbt), en seg ger ingen
//  3) passets slut: lönebeskedet har en dricksrad och pengarna ökar med hela lönen
// Kör: node tools/kok-dricks-test.mjs [port]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.argv[2] || process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok: ' : 'FEL: ') + msg); if (!cond) fails++; };

await page.goto(`http://localhost:${PORT}/index.html?world=kd${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .btn-go')?.click(); });
await page.evaluate(() => { const g = window.SF.game; g.min = 12 * 60; g.hunger = 80; g.energy = 90; g.money = 500; window.SF.go('burgarbar'); });
await page.waitForTimeout(400);

// 1) Köket-knappen → introdialogen nämner dricksen
await page.evaluate(() => window.SF.scene._debug.jobs());
await page.evaluate(() => document.querySelector('#modal [data-jobb="kok"]').click());
await page.waitForTimeout(300);
const intro = await page.evaluate(() => document.querySelector('#modal')?.textContent || '');
ok(/Burgarköket/.test(intro), 'Köket öppnar arbetspassets intro');
ok(/dricks/i.test(intro), 'introt berättar att dricksen går in i lönen');
await page.evaluate(() => [...document.querySelectorAll('#modal button')].find((b) => /Jobba ett pass/.test(b.textContent)).click());
await page.waitForTimeout(500);
ok(await page.evaluate(() => window.SF.sceneName === 'jobbkok'), 'passet startar i köket');

// 2) blixtsnabb läsk → +10, seg glass → ingen dricks
const snabb = await page.evaluate(() => {
  const d = window.SF.scene._debug;
  d.forceOrder('lask');
  d.step('lask'); d.step('bricka'); d.step('klocka');
  return { ...d.stats };
});
ok(snabb.ok >= 1, `läsken serverades (rätt ${snabb.ok})`);
ok(snabb.dricksKr >= 10 && snabb.dricks >= 1, `snabb service gav dricks (${snabb.dricks} ggr, ${snabb.dricksKr} kr)`);
const seg = await page.evaluate(() => {
  const d = window.SF.scene._debug, fore = d.stats.dricksKr;
  d.forceOrder('glass'); d.rush(2);
  d.step('glass'); d.step('bricka'); d.step('klocka');
  return { fore, efter: d.stats.dricksKr, ok: d.stats.ok };
});
ok(seg.ok >= 2 && seg.efter === seg.fore, `seg service gav ingen dricks (${seg.fore} → ${seg.efter} kr)`);

// 3) snabbspola passet till slutet → lönebeskedet
const before = await page.evaluate(() => window.SF.game.money);
await page.evaluate(() => { for (let i = 0; i < 1300 && document.querySelector('#modal').classList.contains('hidden'); i++) window.SF.scene.update(0.05); });
await page.waitForTimeout(300);
const pay = await page.evaluate(() => {
  const m = document.querySelector('#modal');
  const rows = [...m.querySelectorAll('div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim());
  return { open: !m.classList.contains('hidden'), text: m.textContent.replace(/\s+/g, ' '), rows, money: window.SF.game.money, stats: { ...window.SF.scene._debug.stats } };
});
ok(pay.open && /Passet är slut/.test(pay.text), 'lönebeskedet visas när passet är slut');
const tipRow = pay.rows.find((r) => /^🪙 Dricks/.test(r));
ok(!!tipRow && tipRow.includes(String(pay.stats.dricksKr)), `lönebeskedet har dricksraden (${tipRow || 'saknas'})`);
const lonRow = pay.rows.find((r) => /^💰 Lön/.test(r)) || '';
const lon = +(lonRow.match(/(\d[\d\s]*)\s*kr/)?.[1] || '0').replace(/\s/g, '');
ok(pay.money - before === lon, `pengarna ökade med hela lönen (${before} → ${pay.money}, lön ${lon})`);
ok(lon >= pay.stats.dricksKr, `lönen innehåller dricksen (lön ${lon} ≥ dricks ${pay.stats.dricksKr})`);

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
