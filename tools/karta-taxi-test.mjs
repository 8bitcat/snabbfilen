// 🗺️ KARTAN + 🚕 TAXIN: 🗺️-knappen öppnar pixelkartan med "DU ÄR HÄR" och en knapp per hus;
// tryck på Burgarbaren → 🧭 Visa vägen → en pil i staden visar vägen (A*), nålen över dörren,
// lappen nere till vänster; tryck på lappen → figuren går dit → framme, pilen borta.
// 🚕-knappen: kartan i taxiläget → Kaféet → taxin kör fram till trottoarkanten, man kliver in,
// betalar, tiden går och man kliver ur vid kaféet. Inifrån hemmet: ut genom dörren och taxin
// kommer. Utan pengar går det inte att beställa. Avbeställning.
//   node tools/karta-taxi-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errors.push(m.text()));
async function until(fn, ms = 15000, step = 150) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }
const D = (fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.SF.scene._debug, window.SF.game, a), [fn.toString(), arg]);
const shot = (n) => page.locator('#scene').screenshot({ path: `tools/out/${n}.png` }).catch(() => {});

await page.goto(`http://localhost:${PORT}/index.html?world=kt${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Resenär', look: { skin: '#e0a97f', hair: '#3b2619', style: 'short', shirt: '#2f6db5', pants: '#2d3a5c' }, color: '#2f6db5' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 11 * 60, money: 500, hunger: 90, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(1200);
await D((d) => d.district('CENTRUM'));
await page.waitForTimeout(400);

// 1) kartan
ok(await page.evaluate(() => !!document.getElementById('hud-map') && !!document.getElementById('hud-taxi')), 'HUD:en har 🗺️ och 🚕');
await page.click('#hud-mobil'); await page.click('#mobilen [data-app="karta"]');
ok(await until(() => page.evaluate(() => /Kartan/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), '🗺️ öppnar kartan');
const kart = await page.evaluate(() => ({ icons: document.querySelectorAll('#modal .cm-ic').length, me: !!document.querySelector('#modal .cm-me'), cv: document.querySelector('#modal .cm-map canvas')?.width || 0 }));
ok(kart.icons >= 30 && kart.me && kart.cv >= 800, `pixelkartan med ${kart.icons} ställen och DU ÄR HÄR (${kart.cv} px bred)`);
await page.click('#modal .cm-ic[data-b="burgare"]');
const info = await page.evaluate(() => document.querySelector('#modal [data-info]')?.innerText || '');
ok(/BURGARBAREN/.test(info) && /m bort/.test(info) && /Taxi dit – \d+ kr/.test(info), `tryck på Burgarbaren: namn, avstånd och taxipris (${info.replace(/\s+/g, ' ').slice(0, 90)})`);
await page.locator('#modal').screenshot({ path: 'tools/out/karta-dialog.png' }).catch(() => {});

// 2) 🧭 visa vägen
await page.click('#modal [data-guide]');
ok(await page.evaluate(() => document.getElementById('modal').classList.contains('hidden') && window.SF.guide?.id === 'burgare'), 'Visa vägen: kartan stängs och pilen har ett mål');
await page.waitForTimeout(700);
const gd = await D((d) => d.guide());
ok(gd && gd.path > 0 && gd.next, `pilen följer gångvägen (${gd?.path} vägpunkter, nästa ${gd?.next?.map(Math.round)})`);
ok(gd && gd.rects.some((r) => r.kind === 'cancel') && gd.rects.some((r) => r.kind === 'go'), 'lappen nere till vänster: gå dit och × ta bort');
await shot('karta-pil');
// tryck på lappen → figuren går dit själv
const go = gd.rects.find((r) => r.kind === 'go' && r.r[1] > 150) || gd.rects.find((r) => r.kind === 'go');
await page.evaluate(([x, y]) => window.SF.scene.down(x, y), [(go.r[0] + go.r[2]) / 2, (go.r[1] + go.r[3]) / 2]);
ok(await until(() => page.evaluate(() => !window.SF.guide), 30000), 'tryck på lappen → figuren går dit – framme, pilen borta');
const at = await D((d) => d.pos());
ok(Math.abs(at.x - 1146) < 40, `figuren står vid Burgarbarens dörr (x ${Math.round(at.x)})`);

// 3) × tar bort pilen
await page.evaluate(() => window.SF.guideTo('kafe'));
await page.waitForTimeout(500);
const g2 = await D((d) => d.guide());
const cancel = g2.rects.find((r) => r.kind === 'cancel');
await page.evaluate(([x, y]) => window.SF.scene.down(x, y), [(cancel.r[0] + cancel.r[2]) / 2, (cancel.r[1] + cancel.r[3]) / 2]);
ok(await page.evaluate(() => !window.SF.guide), '× tar bort pilen');

// 4) långt bort: skylten i bildkanten
await page.evaluate(() => window.SF.guideTo('narbutik'));
await page.waitForTimeout(500);
const g3 = await D((d) => d.guide());
ok(g3 && g3.rects.filter((r) => r.kind === 'go').length >= 2, 'målet syns inte: en skylt i bildkanten pekar dit');
await shot('karta-kant');
await page.evaluate(() => { window.SF.guide = null; });

// 5) 🚕 taxin: från förorten till kaféet
await D((d) => d.district('FÖRORTEN'));
await page.waitForTimeout(400);
const money0 = await page.evaluate(() => window.SF.game.money), min0 = await page.evaluate(() => window.SF.game.min);
await page.click('#hud-mobil'); await page.click('#mobilen [data-app="taxi"]');
ok(await until(() => page.evaluate(() => /Vart ska taxin/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), '🚕 öppnar kartan i taxiläget');
await page.click('#modal .cm-ic[data-b="kafe"]');
const kr = await page.evaluate(() => +((document.querySelector('#modal [data-taxi]')?.textContent || '').match(/(\d+) kr/) || [])[1]);
ok(kr >= 25 && kr < 200, `taxin till kaféet kostar ${kr} kr`);
await page.click('#modal [data-taxi]');
const tq = await D((d) => d.taxi());
ok(tq && tq.dest === 'kafe' && tq.kr === kr, `taxin är beställd (${tq?.road} fil ${tq?.lane}, trottoarkanten ${tq && Math.round(tq.curb.x)},${tq?.curb.y})`);
ok(await until(() => D((d) => d.taxi()?.car?.state === 'framme'), 40000), 'taxin kör fram och stannar vid trottoarkanten');
await shot('taxi-framme');
ok(await until(() => page.evaluate(() => !window.SF.scene._debug.taxi()), 20000), 'man kliver in (taxin försvinner bakom toningen)');
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ money: window.SF.game.money, min: window.SF.game.min }));
const pos = await D((d) => d.pos());
ok(after.money === money0 - kr, `betalt ${money0 - after.money} kr (${kr})`);
ok(after.min > min0, `tiden gick (${min0} → ${after.min} min)`);
ok(Math.abs(pos.x - 1006) < 80 && pos.y < 260, `man klev ur vid kaféet (${Math.round(pos.x)},${Math.round(pos.y)})`);
await shot('taxi-framme-kafe');

// 6) inifrån hemmet: ut genom dörren, taxin kommer
await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
await page.waitForTimeout(800);
await page.evaluate(() => window.SF.taxiTo('mat'));
ok(await until(() => page.evaluate(() => window.SF.sceneName === 'city' && !!window.SF.scene._debug.taxi())), 'hemifrån: ut i stan och taxin är beställd');
const home = await D((d) => d.pos());
ok(home.x > 3032, `man står utanför husvagnen i förorten (x ${Math.round(home.x)})`);
// avbeställ via 🚕
await page.click('#hud-mobil'); await page.click('#mobilen [data-app="taxi"]');
ok(await until(() => page.evaluate(() => /Din taxi/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), '🚕 igen: "Din taxi" – avbeställ eller gå dit');
await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Avbeställ/.test(b.textContent))?.click());
ok(!(await D((d) => d.taxi())), 'taxin är avbeställd');

// 7) utan pengar
await page.evaluate(() => { window.SF.game.money = 3; });
await page.click('#hud-mobil'); await page.click('#mobilen [data-app="taxi"]');
await page.click('#modal .cm-ic[data-b="kafe"]');
ok(await page.evaluate(() => document.querySelector('#modal [data-taxi]')?.disabled), 'utan pengar går taxin inte att beställa');
await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga konsolfel');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
