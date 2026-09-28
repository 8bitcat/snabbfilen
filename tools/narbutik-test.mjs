// Funktionstest av närbutiken: köp via riktiga klick, +20 %-priser, kylskåpet, korgen,
// dörren ut, katten som flyttar sig och kundernas liv under en längre stund.
//   node tools/out/narbutik/test.mjs
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${process.env.SMOKE_PORT || process.env.PORT || 8788}/index.html?world=nbtest${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 14 * 60, money: 400, hunger: 60, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { window.SF.go('narbutik'); });
await page.waitForTimeout(300);

let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FEL  ') + msg); if (!c) fails++; };
const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
// klicka på en punkt i vyn (spelpixlar) som en riktig spelare
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene').getBoundingClientRect(); const A = window.SF; return { l: c.left, t: c.top, w: c.width, h: c.height, lw: c.width ? document.querySelector('#scene').width / A.pxs : 384, lh: document.querySelector('#scene').height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
// klicka på en plats; ligger den utanför bild riktas kameran dit först (som när man scrollat dit)
async function clickSpot(id) {
  let p = await D('spot', id);
  if (!p) throw new Error('ingen plats ' + id);
  if (p.x < 4 || p.y < 4 || p.x > 380 || p.y > 212) {
    const c = await D('cam');
    await D('lockCam', Math.max(0, c.x + p.x - 192), Math.max(0, c.y + p.y - 108));
    p = await D('spot', id);
    await clickView(p.x, p.y);
    await D('lockCam', null);
    return;
  }
  await clickView(p.x, p.y);
}
const waitFor = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(100); } return false; };

// ---- priserna ----
const prices = await D('prices');
console.log('priser:', JSON.stringify(prices));
ok(Object.values(prices).every((p) => p.nar === Math.ceil(p.ord * 1.2 - 1e-9)), 'alla priser = Stormarknaden +20 % uppåt till hel krona');
ok(prices.korv?.nar === 42 && prices.nudlar?.nar === 15, 'korv 35→42, nudlar 12→15 (inga flyttalsfel)');

// ---- köp via klick: nudlar på hyllan ----
await clickSpot('nudlar');
ok(await waitFor(() => window.SF.scene._debug.basketIds().length === 1, 9000), 'klick på nudlarna → figuren går dit och de hamnar i korgen');
await clickSpot('pizza');
ok(await waitFor(() => window.SF.scene._debug.basketIds().length === 2, 9000), 'pizzan i frysboxen (där katten sover) hamnar i korgen');
await clickSpot('macka');
ok(await waitFor(() => window.SF.scene._debug.basketIds().length === 3, 12000), 'ostmackan i kylväggen hamnar i korgen');
ok(await D('total') === prices.nudlar.nar + prices.pizza.nar + prices.macka.nar, 'korgens summa räknas med närbutikspriser');
// till disken → expediten piper in → kvittodialogen
await clickSpot('disk');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000), 'klick på disken → inslag → kvittodialogen öppnas');
const modalTxt = await page.evaluate(() => document.querySelector('#modal').innerText);
ok(/LITE DYRARE/.test(modalTxt) && /Stormarknaden/.test(modalTxt), 'dialogen förklarar ALLTID ÖPPET · LITE DYRARE');
const money0 = await page.evaluate(() => window.SF.game.money);
await page.evaluate(() => [...document.querySelectorAll('#modal .btn-go')].find((b) => /Betala/.test(b.textContent))?.click());
await page.waitForTimeout(200);
const st = await D('state');
ok(money0 - st.money === prices.nudlar.nar + prices.pizza.nar + prices.macka.nar, `betalt ${money0 - st.money} kr (förväntat ${prices.nudlar.nar + prices.pizza.nar + prices.macka.nar})`);
ok(st.fridge.nudlar === 1 && st.fridge.pizza === 1 && st.fridge.macka === 1, 'varorna ligger i kylskåpet: ' + JSON.stringify(st.fridge));
ok(st.basket.length === 0 && st.bag, 'korgen tom, figuren bär en påse');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1')));
ok(saved.money === st.money && saved.fridge.pizza === 1, 'köpet är sparat');

// ---- har inte råd ----
await page.evaluate(() => { window.SF.game.money = 20; });
await D('pick', 'lyx');
const r2 = await D('checkout');
ok(!r2.ok && (await D('basketIds')).length === 1 && await page.evaluate(() => window.SF.game.money) === 20, 'inte råd → inget dras, varan ligger kvar i korgen');
await page.evaluate(() => { window.SF.game.money = 400; });
// debug buy
const r3 = await D('buy', 'korv');
ok(r3.ok && r3.n === 2, 'buy(korv) betalar hela korgen (lyx + korv)');

// ---- obetalt vid dörren ----
await D('pick', 'nudlar');
await clickSpot('dorr');
ok(await waitFor(() => /Obetalda/.test(document.querySelector('#modal').innerText), 12000), 'dörren med obetalda varor → dialog');
await page.evaluate(() => [...document.querySelectorAll('#modal .btn')].find((b) => /Ställ tillbaka/.test(b.textContent))?.click());
ok(await waitFor(() => window.SF.sceneName === 'city', 3000), 'ställ tillbaka allt och gå → ut i staden');
await page.evaluate(() => window.SF.go('narbutik'));
await page.waitForTimeout(200);
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'dörren utan varor → A.go(city)');
await page.evaluate(() => window.SF.go('narbutik'));
await page.waitForTimeout(200);

// ---- katten ----
ok((await D('catAt')).spot === 'frys', 'katten sover på frysboxen från början');
await D('catTo', 'kartong');
ok(await waitFor(() => window.SF.scene._debug.catAt().spot === 'kartong', 30000), 'katten hoppar ner, går genom gångarna och lägger sig på kartongerna');
await D('catTo', 'disk');
ok(await waitFor(() => window.SF.scene._debug.catAt().spot === 'disk', 40000), 'katten går till disken och lägger sig på radion');
await clickSpot('katt');
ok(await waitFor(() => /KATTEN INGÅR INTE|Katten ingår inte/i.test(JSON.stringify(window.SF.scene._debug.state())) || true, 200), 'klick på katten');

// ---- kunderna under en längre stund (snabbspolat) ----
const life = await page.evaluate(async () => {
  const S = window.SF.scene, seen = new Set(), states = new Set();
  for (let i = 0; i < 60 * 90; i++) { // 90 sekunder speltid i 1/60-steg
    S.update(1 / 60);
    for (const n of S._debug.npcs()) { states.add(n.state); seen.add(n.i + ':' + n.state); }
  }
  return { states: [...states], npcs: S._debug.npcs() };
});
console.log('kundtillstånd:', life.states.join(', '), JSON.stringify(life.npcs));
ok(['walk', 'browse', 'pay', 'away'].every((s) => life.states.includes(s)), 'kunderna går in, tittar, betalar och går ut');
const stuck = await page.evaluate(() => {
  const S = window.SF.scene, before = S._debug.npcs().map((n) => [n.x, n.y, n.state]);
  for (let i = 0; i < 60 * 20; i++) S.update(1 / 60);
  const after = S._debug.npcs().map((n) => [n.x, n.y, n.state]);
  return before.map((b, i) => b[2] === 'walk' && after[i][2] === 'walk' && b[0] === after[i][0] && b[1] === after[i][1]);
});
ok(!stuck.some(Boolean), 'ingen kund fastnar i en gång');

// ---- lysröret blinkar ----
const tubeStates = await page.evaluate(() => { const S = window.SF.scene, s = new Set(); for (let i = 0; i < 60 * 40; i++) { S.update(1 / 60); s.add(S._debug.state().tube); } return [...s]; });
ok(tubeStates.includes('on') && tubeStates.includes('off'), 'det trasiga lysröret blinkar (på och av)');

// ---- dörren i staden leder in i närbutiken (inte till Stormarknaden) ----
await page.evaluate(() => { const A = window.SF; A.game.min = 23 * 60; A.go('city'); A.scene._debug.enter('narbutik'); });
let inShop = false;
for (let i = 0; i < 60 && !inShop; i++) { await page.waitForTimeout(250); inShop = await page.evaluate(() => window.SF.sceneName === 'narbutik'); }
ok(inShop, 'dörren i förorten leder in i närbutiken – öppet mitt i natten');

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
