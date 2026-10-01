// Funktionstest av MATLAGNINGEN HEMMA (game.js RAVAROR/RECEPT/cook, shop-mat.js råvarorna,
// room.js spisen + receptboken, kok.js spisrutan/receptboken med bilderna, koket.js köket):
//   1. mataffären: alla råvaror har en plats; klick på en fruktlåda → välj antal; storkok-mängder
//      i korgen; kassan grupperar likadana varor och lägger allt i skafferiet
//   2. hemma: spisen och receptboken står vid kylskåpet från början – och en gammal sparfil får dem
//   3. receptboken: alla recept med en bild av rätten; läs ett recept (en kvart) → du kan det
//   4. spisen: storkok ×5 kräver 5 av varje; Laga → köket
//   5. köket: guiden (pilen) leder hela vägen – storkok carbonara → 4 matlådor, kockvana och
//      kocknivå; fel sak på fel ställe säger "inte nu"; avbryter man går inget åt
//   6. alla recept går att laga från början till slut genom att följa pilen
//   7. kylskåpet: matlådorna värms och äts
//   node tools/kok-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'kok') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 10 * 60, money: 3000, hunger: 40, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
const start = async (save) => {
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=kok${Date.now().toString(36)}`);
  await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Kocken', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'wavy', shirt: '#7a1e2e', pants: '#1c1c1c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, save);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(700);
};
const sleep = (ms) => p.waitForTimeout(ms);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(80); } return false; };
const modalTitle = () => p.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const modalText = () => p.evaluate(() => document.querySelector('#modal')?.innerText || '');
const clickBtn = (re) => p.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = async () => { await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }); await sleep(400); };
async function click(sx, sy) {
  const c = await p.evaluate(([sx, sy]) => { const cv = document.getElementById('scene'), r = cv.getBoundingClientRect(), v = SF.view || {}; const lw = cv.width / SF.pxs, lh = cv.height / SF.pxs; return { x: r.left + (sx + (v.boxX || 0)) / lw * r.width, y: r.top + (sy + (v.boxY || 0)) / lh * r.height }; }, [sx, sy]);
  await p.mouse.click(c.x, c.y); await sleep(60);
}
async function clickSpot(id) {
  await p.evaluate((id) => { const d = SF.scene._debug, s0 = d.spot(id), c = d.cam(); d.lockCam(Math.round(s0.x + c.x - 192), Math.round(s0.y + c.y - 120)); }, id);
  const s = await p.evaluate((id) => SF.scene._debug.spot(id), id);
  await click(s.x, s.y);
}
const tick = (sec) => p.evaluate((s) => SF.scene._debug.tick(s), sec);
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
const G = () => p.evaluate(() => { const g = SF.game; return { money: g.money, sk: { ...g.skafferi }, recept: [...g.recept], kockat: { ...g.kockat }, kp: g.kockPortioner, lador: { ...g.matlador }, hunger: g.hunger, min: g.min }; });

// ---------- 1. mataffären ----------
await start(SAVE);
await p.evaluate(() => SF.go('mat'));
await until(() => SF.sceneName === 'mat' && !!SF.scene?._debug?.rava, 15000);
const RAVA = await p.evaluate(async () => (await import('/js/game.js')).RAVAROR.map((r) => ({ id: r.id, price: r.price })));
const spots = await p.evaluate(() => SF.scene._debug.rava());
ok(RAVA.every((r) => spots.some((s) => s.id === r.id)) && spots.length === RAVA.length, `alla ${RAVA.length} råvaror har en plats i butiken (${spots.length})`);
ok(['kyckling', 'kottfars', 'bacon'].every((id) => spots.find((s) => s.id === id)?.kind === 'freezer'), 'kyckling, köttfärs och bacon finns i frysen');
await clickSpot('r:applR');
await tick(8);
ok(await until(() => /Rött äpple/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 4000), 'klick på äppellådan → figuren går dit och man väljer hur många');
await shot('01-antal');
await clickBtn(/^5 st/);
ok((await p.evaluate(() => SF.scene._debug.basketIds().filter((x) => x === 'applR').length)) === 5, '5 äpplen i korgen');
for (const id of ['pasta', 'bacon', 'agg', 'ost']) await p.evaluate((id) => SF.scene._debug.addRava(id, 5), id);
const inBasket = await p.evaluate(() => SF.scene._debug.basketIds().length);
ok(inBasket === 25, `storkok-mängder ryms i korgen (${inBasket} varor)`);
await shot('02-korgen');
const money0 = (await G()).money;
await clickSpot('kassa');
await tick(10);
await p.evaluate(() => SF.scene._debug.tick(6));
const belt = await p.evaluate(() => SF.scene._debug.belt());
ok(!belt || belt.items.length <= 5, `kassan: likadana varor åker som en post på bandet (${belt ? belt.items.length : 'klart'})`);
ok(await until(() => /betala|kvitto|Kassa/i.test(document.querySelector('#modal')?.innerText || ''), 12000), 'kvittot öppnas');
await clickBtn(/Betala/);
await sleep(300);
const g1 = await G();
const sum = 5 * (RAVA.find((r) => r.id === 'applR').price + RAVA.find((r) => r.id === 'pasta').price + RAVA.find((r) => r.id === 'bacon').price + RAVA.find((r) => r.id === 'agg').price + RAVA.find((r) => r.id === 'ost').price);
ok(money0 - g1.money === sum, `betalt ${money0 - g1.money} kr (= ${sum} kr)`);
ok(g1.sk.applR === 5 && g1.sk.pasta === 5 && g1.sk.bacon === 5 && g1.sk.agg === 5 && g1.sk.ost === 5, `råvarorna ligger i skafferiet hemma: ${JSON.stringify(g1.sk)}`);
await closeDlg();

// ---------- 2. hemma: spisen och receptboken ----------
await p.evaluate(() => { SF.roomSub = 0; SF.go('room'); });
await sleep(800);
const deco = await p.evaluate(() => (SF.game.deco['rum:0'] || []).map((d) => d.k));
ok(deco.includes('koksspis') && deco.includes('receptbok'), `Lilla rummet: spisen och receptboken står där från början (${deco.join(', ')})`);
await shot('03-hemma');
// en gammal sparfil där rummet redan är möblerat utan spis och bok
await start({ ...SAVE, deco: { 'rum:0': [{ k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 71, y: 96, fx: 1 }, { k: 'kylskap', v: 0, x: 118, y: 94, fx: 1 }] } });
await p.evaluate(() => { SF.roomSub = 0; SF.go('room'); });
await sleep(900);
const deco2 = await p.evaluate(() => (SF.game.deco['rum:0'] || []).map((d) => d.k));
ok(deco2.includes('koksspis') && deco2.includes('receptbok'), 'gammal sparfil: spisen och receptboken ställs in i köket');

// ---------- 3. receptboken ----------
await p.evaluate(async () => { const g = SF.game; Object.assign(g.skafferi, { pasta: 5, bacon: 5, agg: 5, ost: 5 }); (await import('/js/scenes/kok.js')).openKok(SF, 'bok'); });
await sleep(400);
const book = await p.evaluate(() => {
  const pages = [...document.querySelectorAll('#modal .kok-page')];
  const blank = pages.filter((pg) => { const cv = pg.querySelector('canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n < 100; }).length;
  return { n: pages.length, blank, las: document.querySelectorAll('#modal [data-las]').length };
});
const RECEPT = await p.evaluate(async () => (await import('/js/game.js')).RECEPT.map((r) => r.id));
ok(book.n === RECEPT.length && book.blank === 0, `receptboken: ${book.n} recept, alla med en bild av rätten`);
ok(book.las === RECEPT.length - 3, `tre klassiker kan man redan – ${book.las} att läsa`);
await shot('04-receptboken');
await p.screenshot({ path: OUT + '04b-receptboken-dlg.png' });
const min0 = (await G()).min;
await p.evaluate(() => document.querySelector('#modal [data-las="carbonara"]').click());
await sleep(300);
const g3 = await G();
ok(g3.recept.includes('carbonara') && g3.min - min0 === 15, 'läste carbonara: du kan den nu (en kvart)');

// ---------- 4. spisen: storkok ----------
await p.evaluate(async () => (await import('/js/scenes/kok.js')).openKok(SF, 'laga'));
await sleep(300);
await p.evaluate(() => document.querySelector('#modal [data-port="5"]').click());
await sleep(300);
ok(await p.evaluate(() => !document.querySelector('#modal [data-laga="carbonara"]').disabled), 'storkok ×5: carbonara går att laga (5 av varje hemma)');
ok(await p.evaluate(() => document.querySelector('#modal [data-laga="omelett"]').disabled), 'omeletten fattas tomat – knappen är grå');
await p.screenshot({ path: OUT + '05-spisen.png' });
await p.evaluate(() => document.querySelector('#modal [data-laga="carbonara"]').click());
ok(await until(() => SF.sceneName === 'koket', 5000), 'Laga → köket');

// ---------- 5. köket ----------
const K = (fn, ...a) => p.evaluate(([fn, a]) => SF.scene._debug[fn](...a), [fn, a]);
const s0 = await K('state');
ok(s0.recipe === 'carbonara' && s0.portions === 5 && s0.target === 'rack:gryta1', `första steget: ${s0.step?.t} – pilen pekar på grytan (${s0.target})`);
// fel sak på fel ställe: bacon i grytan
await K('click', 'ing:bacon'); await K('click', 'rack:gryta1');
const s1 = await K('state');
ok(!s1.ves.gryta1.items.length, 'bacon i grytan (fel ställe): "inte nu" – inget hände');
await K('click', 'ing:bacon');   // lägg tillbaka
let guard = 0, shotMid = false;
while (guard++ < 300) {
  const s = await K('state');
  if (s.finished) break;
  if (!shotMid && s.cur >= 10) { shotMid = true; await shot('06-koket'); }
  if (!s.target) { await K('skip', 1); continue; }
  await K('click', s.target); await K('skip', 0.1);
}
ok((await K('state')).finished, 'storkok carbonara: guiden ledde hela vägen till tallriken');
ok(await until(() => /smaklig måltid/i.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 5000), 'resultatet: smaklig måltid!');
await shot('07-klart');
const g5 = await G();
ok(g5.lador.carbonara === 4 && !g5.sk.pasta && g5.kp === 5 && g5.kockat.carbonara === 5, `4 matlådor i kylen, råvarorna ×5 slut, 5 lagade portioner (${JSON.stringify(g5.lador)})`);
ok(/Hemmakock|kocknivå/i.test(await modalText()), 'kocknivån syns');
await clickBtn(/Tack för maten/);
ok(await until(() => SF.sceneName === 'room', 4000), 'tillbaka hemma');
// avbryt: inget går åt
await p.evaluate(() => { const g = SF.game; Object.assign(g.skafferi, { applR: 1, banan: 1, apels: 1 }); SF.kokPlan = { id: 'fruktsallad', n: 1 }; SF.go('koket'); });
await sleep(400);
await K('click', 'avbryt');
await clickBtn(/^Sluta/);
await sleep(300);
const g6 = await G();
ok(await p.evaluate(() => SF.sceneName === 'room') && g6.sk.applR === 1 && g6.sk.banan === 1, 'avbryter man går inga råvaror åt');

// ---------- 6. alla recept med pilen ----------
const stuck = [];
for (const id of RECEPT) {
  await p.evaluate(async (id) => { const g = SF.game, { receptOf } = await import('/js/game.js'); if (!g.recept.includes(id)) g.recept.push(id); for (const x of receptOf(id).ing) g.skafferi[x] = (g.skafferi[x] | 0) + 1; SF.kokPlan = { id, n: 1 }; SF.go('koket'); }, id);
  await sleep(150);
  let n = 0;
  while (n++ < 260) {
    const s = await K('state');
    if (s.finished) break;
    if (!s.target) { await K('skip', 1); continue; }
    await K('click', s.target); await K('skip', 0.1);
  }
  if (!(await K('state')).finished) stuck.push(id);
  await until(() => /smaklig/i.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 4000);
  await clickBtn(/Tack för maten/);
  await until(() => SF.sceneName === 'room', 3000);
}
ok(!stuck.length, `alla ${RECEPT.length} recept går att laga genom att följa pilen${stuck.length ? ' – fast: ' + stuck.join(', ') : ''}`);

// ---------- 7. kylskåpet: matlådorna ----------
const h0 = await p.evaluate(() => { SF.game.hunger = 20; return SF.game.hunger; });
const res = await p.evaluate(() => SF.game.eatMatlada('carbonara'));
const g7 = await G();
ok(res && g7.hunger > h0 && g7.lador.carbonara === 3, `en matlåda värmd och uppäten (+${res?.fill} mätthet, ${g7.lador.carbonara} kvar)`);

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'inga konsolfel');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
