// Stormarknaden – mat som äts HÄR (Carls regel för alla matställen, 2026-09-29):
// korven köps vid grillen (samma pris som prislappen, pengarna dras direkt) och hamnar
// I HANDEN – aldrig i korgen eller på bandet. Man sätter sig vid sittdisken och äter bit
// för bit (mättheten kommer tugga för tugga, summan = FOOD.fill, en kvart går när maten
// är slut). Sitter man och äter kommer man inte därifrån ("ÄT UPP FÖRST!"), med korven i
// handen kommer man inte ut genom dörren ("DU MÅSTE SÄTTA DIG OCH ÄTA UPP!"). ÄT HÄR-
// dialogen följer samma regel. Obetalda varor i korgen hanteras som förut.
// Allt görs med RIKTIGA musklick på canvasen (kameran låses över målet först).
//   node tools/at-mat-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
const OUT = 'tools/out/at-mat/';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];

const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 600, money: 500, hunger: 40, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=atm${Math.random().toString(36).slice(2, 7)}`);
await p.evaluate((s) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'kalle', name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });

// ---------- hjälpare ----------
const D = (fn, arg) => p.evaluate(fn, arg);
const sleep = (ms) => p.waitForTimeout(ms);
const until = async (fn, ms = 12000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(80); } return false; };
// spelpixlar på skärmen → klientkoordinater på canvasen (samma räkning som main.js toLocal, baklänges)
async function click(sx, sy) {
  const c = await D(([sx, sy]) => {
    const cv = document.getElementById('scene'), r = cv.getBoundingClientRect(), v = SF.view || {};
    const lw = cv.width / SF.pxs, lh = cv.height / SF.pxs;
    return { x: r.left + (sx + (v.boxX || 0)) / lw * r.width, y: r.top + (sy + (v.boxY || 0)) / lh * r.height };
  }, [sx, sy]);
  await p.mouse.click(c.x, c.y);
  await sleep(60);
}
// lås kameran så att världspunkten (wx, wy) syns och klicka där
async function clickWorld(wx, wy) {
  const { x, y } = await D(([wx, wy]) => {
    const d = SF.scene._debug;
    d.lockCam(Math.round(wx - 192), Math.round(wy - 120));
    const c = d.cam();
    return { x: wx - c.x, y: wy - c.y };
  }, [wx, wy]);
  await click(x, y);
}
// klicka på en klickbar plats (prislapp, dörr, kassa …) via _debug.spot
async function clickSpot(id) {
  await D((id) => { const d = SF.scene._debug, s0 = d.spot(id), c = d.cam(); d.lockCam(Math.round(s0.x + c.x - 192), Math.round(s0.y + c.y - 120)); }, id);
  const s = await D((id) => SF.scene._debug.spot(id), id);
  await click(s.x, s.y);
}
const unlock = () => D(() => SF.scene._debug.lockCam(null));
const dish = () => D(() => SF.scene._debug.dish());
const said = () => D(() => SF.scene._debug.said() || '');
const money = () => D(() => SF.game.money);
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
// spola fram scenen (gång och tuggor) utan att vänta i realtid
const tick = (sec) => D((s) => SF.scene._debug.tick(s), sec);
const FOODS = await D(async () => (await import('./js/game.js')).FOOD.map((f) => ({ ...f })));
const food = (id) => FOODS.find((f) => f.id === id);
const KORV = food('korv');
const saveKeys = () => D(() => Object.keys(JSON.parse(localStorage.getItem('snabbfilen_save1') || '{}')).sort().join(','));
const keysBefore = await saveKeys();

await D(() => SF.go('mat'));
await until(() => SF.sceneName === 'mat' && !!SF.scene?._debug?.dish);

// ---------- 1. korven köps vid grillen och hamnar i handen ----------
console.log('— korven vid grillen —');
ok(!!(await D(() => SF.scene._debug.spot('korv'))), 'korven står vid grillen med prislapp');
await D(() => SF.scene._debug.teleport(560, 330));
const m0 = await money(), h0 = await D(() => SF.game.hunger), fridge0 = await D(() => SF.game.fridge.korv || 0);
await clickSpot('korv');
ok(await until(() => SF.scene._debug.dish()?.where === 'hand', 10000), 'klick på korven → figuren går till grillen och får korven i handen');
ok((await money()) === m0 - KORV.price, `pengarna drogs direkt vid grillen: ${m0} → ${await money()} (${KORV.price} kr, samma som prislappen)`);
ok((await D(() => SF.scene._debug.vendorSaid().length)) > 0, `korvgubben säger något (${(await D(() => SF.scene._debug.vendorSaid()))[0]})`);
ok(Math.abs((await D(() => SF.game.hunger)) - h0) < 0.5, 'ingen mätthet vid köpet – den kommer när man äter');
ok(!(await D(() => SF.scene._debug.basketIds().includes('korv'))), 'korven ligger INTE i korgen');
ok((await D(() => SF.game.fridge.korv || 0)) === fridge0, 'korven hamnar inte i kylskåpet');
ok((await D(() => SF.scene._debug.pick('korv'))) === false && !(await D(() => SF.scene._debug.basketIds().includes('korv'))), 'korven kan inte plockas ner i korgen');
await sleep(250);
await shot('01-korv-i-handen');

// ---------- 2. med korven i handen: dörren, varorna och kassan är stängda ----------
console.log('— korven i handen —');
await tick(1.5); // figuren har kommit fram till grillen
const atGrill = await D(() => SF.scene._debug.pos());
await clickSpot('dorr');
ok((await said()) === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!', `dörren nekas direkt vid klicket: "${await said()}"`);
ok((await D(() => SF.scene._debug.pos().path)) === 0, 'figuren går inte ens mot dörren');
await tick(2);
const p2 = await D(() => SF.scene._debug.pos());
ok(Math.hypot(p2.x - atGrill.x, p2.y - atGrill.y) < 1, `figuren står kvar vid grillen (${Math.round(p2.x)},${Math.round(p2.y)})`);
ok((await D(() => SF.sceneName)) === 'mat', 'man kommer inte ut med korven i handen');
ok((await dish())?.where === 'hand', 'korven är kvar i handen');
// går man ända fram till dörren (klick på golvet bredvid) öppnas skjutdörrarna inte för en med korven
await D(() => SF.scene._debug.teleport(124, 382));
await tick(1);
ok((await D(() => SF.scene._debug.door())) < 0.05, `skjutdörrarna öppnas inte för korvbäraren (${await D(() => SF.scene._debug.door())})`);
await shot('02-dorren-med-korv');
await D(() => SF.scene._debug.teleport(560, 330));
await clickSpot('pizza');
await tick(8);
ok((await D(() => SF.scene._debug.basketIds().length)) === 0, 'händerna är fulla: pizzan kommer inte i korgen');
ok(/HÄNDERNA ÄR FULLA/i.test(await said()), `varor: "${await said()}"`);
await clickSpot('kassa');
await tick(8);
ok((await D(() => SF.scene._debug.belt())) === null, 'händerna är fulla: kassan startar inte');

// ---------- 3. sätt dig vid disken och ät bit för bit ----------
console.log('— sittdisken —');
await D(() => SF.scene._debug.teleport(640, 340));
const st = await D(() => { const d = SF.scene._debug; d.lockCam(400, 184); return d.stool(1); });
await click(st.x, st.y);
ok(await until(() => SF.scene._debug.dish()?.where === 'disk' && !!SF.scene._debug.sit(), 6000, null), 'klick på en pall → figuren sätter sig och korven ligger framför en');
ok((await dish())?.stage === 0, 'första tuggan väntar tills man suttit en stund');
await shot('03-korv-vid-disken');
// sitter och äter: inga klick får resa en
await click(40, 120);   // golvet
await sleep(120);
ok(!!(await D(() => SF.scene._debug.sit())) && (await dish())?.where === 'disk', 'klick på golvet: man sitter kvar');
ok((await said()).includes('ÄT UPP FÖRST'), `pratbubblan: "${await said()}"`);
await shot('04-at-upp-forst');
const ks = await D(() => SF.scene._debug.spot('korv'));
await click(ks.x, ks.y); // grillen igen
await sleep(80);
ok(!!(await D(() => SF.scene._debug.sit())) && (await D(() => SF.scene._debug.pos().path)) === 0, 'klick på grillen: man sitter kvar');
await D(() => SF.scene._debug.lockCam(0, 184));
const dr = await D(() => SF.scene._debug.spot('dorr'));
await click(dr.x, dr.y); // dörren
await sleep(80);
ok(!!(await D(() => SF.scene._debug.sit())) && (await D(() => SF.sceneName)) === 'mat', 'klick på dörren mitt i maten: man sitter kvar');
ok((await said()) === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!', `mot dörren mitt i maten: "${await said()}"`);
await D(() => SF.scene._debug.lockCam(400, 184));
// tuggorna: synkront steg för steg (ingen bildruta emellan, klockan står still) – varje
// tugga ger sin del av mättheten; de tuggor som hann tas under klicken ovan räknas med
const bites = await D(() => {
  const d = SF.scene._debug, g = SF.game;
  const out = { steps: [], shares: d.dish().shares, n: d.dish().n, stage0: d.dish().stage, bitingSeen: false };
  g.hunger = Math.round(g.hunger);
  out.h0 = g.hunger; out.min0 = g.min;
  let last = out.stage0, h = g.hunger;
  for (let i = 0; i < 30 * 12 && d.dish() && d.dish().stage < d.dish().n; i++) {
    d.tick(1 / 30);
    const x = d.dish();
    if (x?.biting) out.bitingSeen = true;
    if (x && x.stage !== last) { out.steps.push({ stage: x.stage, gain: g.hunger - h }); last = x.stage; h = g.hunger; }
  }
  out.hungerEnd = g.hunger; out.min1 = g.min;
  return out;
});
const rest = bites.shares.slice(bites.stage0).reduce((a, b) => a + b, 0);
ok(bites.n === 4 && bites.steps.length === bites.n - bites.stage0, `korven äts i ${bites.n} tuggor (${bites.stage0} redan tagna, ${bites.steps.length} till)`);
ok(bites.shares.reduce((a, b) => a + b, 0) === KORV.fill, `tuggorna tillsammans = ${KORV.fill} mätthet (${bites.shares.join('+')}) – samma som buyFood(eatNow)`);
ok(bites.steps.slice(0, -1).every((s) => s.gain === bites.shares[s.stage - 1]), `mättheten kommer bit för bit (${bites.steps.map((s) => s.gain.toFixed(2)).join(', ')})`);
ok(Math.abs(bites.hungerEnd - Math.min(100, bites.h0 + rest) + 15 * 0.05) < 0.01, `efter maten: mätthet ${bites.h0} → ${bites.hungerEnd} (+${rest} − en kvarts hunger)`);
ok(Math.abs(bites.min1 - bites.min0 - 15) < 1e-9, `att äta tar en kvart (g.passTime(15) när maten är slut): ${Math.round(bites.min0)} → ${Math.round(bites.min1)}`);
ok(bites.bitingSeen, 'figuren för korven till munnen vid tuggorna');
ok((await dish())?.stage === 4 && !!(await D(() => SF.scene._debug.sit())), 'servetten ligger kvar en kort stund efter sista tuggan');
await click(40, 120);
await sleep(80);
ok(!!(await D(() => SF.scene._debug.sit())), 'fortfarande sittande tills servetten försvunnit');
await tick(1.5);
ok((await dish()) === null, 'uppätet: servetten försvinner');
ok(/MUMS/.test(await said()), `pratbubblan: "${await said()}"`);
await shot('05-uppatet');
await click(40, 120);
await tick(0.3);
ok(!(await D(() => SF.scene._debug.sit())), 'uppätet: nu kan man resa sig och gå');

// ---------- 4. ÄT HÄR-dialogen: samma regel för de andra rätterna ----------
console.log('— ÄT HÄR-dialogen —');
await D(() => SF.scene._debug.teleport(680, 330));
await unlock();
const bar = await D(() => { const d = SF.scene._debug; d.lockCam(400, 184); return d.spot('athar'); });
await click(bar.x, bar.y);
await tick(3);
ok(await until(() => /Ät här/.test(document.querySelector('.dlg-head h2')?.textContent || ''), 5000), 'klick på ÄT HÄR → man sätter sig och dialogen öppnas');
ok((await p.locator('[data-eat="korv"]').count()) === 0 && (await p.locator('[data-grill]').count()) === 1, 'korven finns i dialogen som "Till grillen", inte som ÄT HÄR-rätt');
await p.screenshot({ path: OUT + '06-at-har-dialog.png' });
const MACKA = food('macka');
const m1 = await money(), h1 = await D(() => SF.game.hunger);
await p.click('[data-eat="macka"]');
await sleep(150);
ok((await money()) === m1 - MACKA.price - 5, `ostmackan: ${MACKA.price} + 5 kr (som förut) – ${m1} → ${await money()}`);
ok(Math.abs((await D(() => SF.game.hunger)) - h1) < 0.5, 'ingen mätthet vid beställningen');
ok((await dish())?.id === 'macka' && (await dish())?.where === 'disk', 'mackan står på disken framför en');
await click(40, 120);
await sleep(80);
ok(!!(await D(() => SF.scene._debug.sit())) && (await said()).includes('ÄT UPP FÖRST'), 'mitt i mackan: man sitter kvar ("ÄT UPP FÖRST!")');
await tick(2.4);
await shot('07-macka-halvaten');
const mid = await dish();
ok(mid && mid.stage > 0 && mid.stage < mid.n, `mackan minskar bit för bit (${mid?.stage}/${mid?.n})`);
await D(() => { SF.game.hunger = 30; });
await tick(6);
ok((await dish()) === null, 'mackan uppäten – tallriken borta');
const hm = await D(() => SF.game.hunger);
ok(hm > 30 + (MACKA.fill - mid.shares.slice(0, mid.stage).reduce((a, b) => a + b, 0)) - 2, `mättheten från resten av mackan kom (${hm})`);

// ---------- 5. "Till grillen" i dialogen ----------
console.log('— Till grillen —');
await click(bar.x, bar.y);
await tick(3);
ok(await until(() => !!document.querySelector('[data-grill]'), 5000), 'dialogen öppnas igen');
const m2 = await money();
await p.click('[data-grill]');
await sleep(100);
await tick(8);
ok((await dish())?.where === 'hand' && (await money()) === m2 - KORV.price, '"Till grillen" → figuren går till grillen och köper korven');

// ---------- 6. lämnar man scenen på annat sätt äts korven upp i farten ----------
console.log('— scenbyte med korven i handen —');
const fx = await D(() => { SF.game.hunger = 20; const min = SF.game.min; SF.go('city'); return { h: SF.game.hunger, min: SF.game.min - min }; });
ok(Math.abs(fx.h - (20 + KORV.fill - 0.75)) < 0.01 && fx.min === 15, `pengarna går inte förlorade: resten av korven räknas (mätthet ${fx.h}, +${fx.min} min)`);
await D(() => SF.go('mat'));
await until(() => SF.sceneName === 'mat' && !!SF.scene?._debug?.dish);
ok((await dish()) === null, 'ny sväng i butiken: inget i händerna');

// ---------- 6b. huvudprogrammets knappar och omladdning mitt i maten ----------
console.log('— leaveBlock och omladdning —');
const MSG_DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';
ok((await D(() => SF.scene.leaveBlock?.())) === null, 'leaveBlock() utan mat: null (man får gå)');
const buyKorv = async () => {
  await D(() => { SF.game.money = 500; SF.game.save(); SF.scene._debug.teleport(600, 330); });
  await clickSpot('korv');
  return until(() => SF.scene._debug.dish()?.where === 'hand', 10000);
};
ok(await buyKorv(), 'korven i handen igen');
ok((await D(() => SF.scene.leaveBlock({ quiet: true }))) === MSG_DORR, 'leaveBlock({ quiet }) med korven i handen: repliken tillbaka');
await D(() => SF.scene.leaveBlock());
ok((await said()) === MSG_DORR, `leaveBlock(): figuren säger "${await said()}"`);
// figurbyte/omstart i menyn byter eller tömmer sparningen innan omladdningen – pagehide får inte skriva över den
const guard = await D((o) => {
  const parked = localStorage.getItem('snabbfilen_save:kalle');
  sessionStorage.setItem('sf_menu_skip', '1');                 // menyn.reloadInto()
  localStorage.setItem('snabbfilen_save1', JSON.stringify(o));  // switchTo(): den andra figurens sparning
  window.dispatchEvent(new Event('pagehide'));
  const afterSwitch = JSON.parse(localStorage.getItem('snabbfilen_save1'));
  sessionStorage.removeItem('sf_menu_skip');
  localStorage.removeItem('snabbfilen_save1');                  // omstart utan flagga: sparningen tömd
  window.dispatchEvent(new Event('pagehide'));
  const afterRestart = localStorage.getItem('snabbfilen_save1');
  if (parked) localStorage.setItem('snabbfilen_save:kalle', parked); else localStorage.removeItem('snabbfilen_save:kalle');
  SF.game.save();
  return { money: afterSwitch.money, day: afterSwitch.day, restart: afterRestart, dish: !!SF.scene._debug.dish() };
}, { ...SAVE, money: 1234, day: 9 });
ok(guard.money === 1234 && guard.day === 9 && guard.restart === null && guard.dish, 'figurbyte/omstart: omladdningen skriver aldrig över den nya (eller tömda) sparningen');
// den automatiska uppdateringen (version-ui: 'sf:before-reload' → spara → ladda om)
const v = await D(() => {
  SF.game.hunger = 20;
  const min0 = SF.game.min;
  window.dispatchEvent(new Event('sf:before-reload'));
  const s = JSON.parse(localStorage.getItem('snabbfilen_save1'));
  return { dish: SF.scene._debug.dish(), h: SF.game.hunger, dmin: SF.game.min - min0, savedH: s.hunger };
});
ok(v.dish === null && Math.abs(v.h - (20 + KORV.fill - 0.75)) < 0.01 && v.dmin === 15 && v.savedH === v.h, `ny version mitt i korven: resten räknas och sparas före omladdningen (mätthet ${v.h}, +${v.dmin} min)`);
// F5 med korven i handen
ok(await buyKorv(), 'korven i handen igen (före F5)');
const r0 = await D(() => { SF.game.hunger = 20; SF.game.save(); return { m: SF.game.money, min: SF.game.min + (SF.game.day - 1) * 1440 }; });
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
const r1 = await D(() => ({ h: SF.game.hunger, m: SF.game.money, min: SF.game.min + (SF.game.day - 1) * 1440 }));
ok(r1.m === r0.m && r1.h > 20 + KORV.fill - 0.75 - 1.5 && r1.h <= 20 + KORV.fill - 0.75 && r1.min >= r0.min + 15, `F5 med korven i handen: betalda korven räknas (pengar ${r0.m} → ${r1.m}, mätthet 20 → ${r1.h.toFixed(2)}, +${Math.round(r1.min - r0.min)} min)`);
// F5 mitt i en ÄT HÄR-pizza vid disken
await D(() => SF.go('mat'));
await until(() => SF.sceneName === 'mat' && !!SF.scene?._debug?.dish);
await D(() => { SF.game.money = 500; SF.game.save(); SF.scene._debug.teleport(680, 330); });
const bar2 = await D(() => { const d = SF.scene._debug; d.lockCam(400, 184); return d.spot('athar'); });
await click(bar2.x, bar2.y);
await tick(3);
ok(await until(() => !!document.querySelector('[data-eat="pizza"]'), 5000), 'ÄT HÄR-dialogen igen');
await p.click('[data-eat="pizza"]');
await sleep(120);
await tick(2.6);
const pz = await D(() => { const d = SF.scene._debug.dish(); SF.game.hunger = 20; SF.game.save(); return { ...d, m: SF.game.money, min: SF.game.min + (SF.game.day - 1) * 1440 }; });
const pzRest = pz.shares.slice(pz.stage).reduce((a, b) => a + b, 0);
ok(pz.id === 'pizza' && pz.where === 'disk' && pz.stage > 0 && pz.stage < pz.n, `pizzan halväten vid disken (${pz.stage}/${pz.n}, ${pzRest} mätthet kvar)`);
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
const pz1 = await D(() => ({ h: SF.game.hunger, m: SF.game.money, min: SF.game.min + (SF.game.day - 1) * 1440 }));
ok(pz1.m === pz.m && pz1.h > 20 + pzRest - 0.75 - 1.5 && pz1.h <= 20 + pzRest - 0.75 && pz1.min >= pz.min + 15, `F5 mitt i pizzan: resten räknas (mätthet 20 → ${pz1.h.toFixed(2)}, ${pzRest} kvar)`);
await D(() => SF.go('mat'));
await until(() => SF.sceneName === 'mat' && !!SF.scene?._debug?.dish);

// ---------- 7. för lite pengar ----------
console.log('— för lite pengar —');
await D(() => { SF.game.money = 10; SF.scene._debug.teleport(600, 330); });
await clickSpot('korv');
await tick(3);
ok((await dish()) === null && (await money()) === 10, 'för lite pengar: ingen korv och inga pengar dras');
ok(/räcker inte/i.test(await said()), `pratbubblan: "${await said()}"`);
await D(() => { SF.game.money = 500; });

// ---------- 8. korgen och kassan fungerar som förut ----------
console.log('— korgen som förut —');
await unlock();
await clickSpot('pizza');
await tick(8);
ok((await D(() => SF.scene._debug.basketIds())).join() === 'pizza', 'pizzan hamnar i korgen som förut');
await clickSpot('dorr');
await tick(10);
ok(await until(() => /Obetalda/.test(document.querySelector('.dlg-head h2')?.textContent || ''), 5000), 'obetalda varor vid dörren: samma fråga som förut');
await p.screenshot({ path: OUT + '08-obetalda.png' });
await p.locator('.dlg-foot .btn', { hasText: 'Till kassan' }).click();
await tick(10);
ok(await until(() => SF.scene._debug.belt()?.done, 8000), 'till kassan: varorna slås in');
const m3 = await money();
await p.locator('.dlg-foot .btn-go').click();
await sleep(150);
ok((await money()) === m3 - food('pizza').price && (await D(() => SF.game.fridge.pizza)) === 1, 'betalt i kassan – pizzan i kylskåpet');
// röktestets väg (tools/smoke.mjs steg 5): _debug.pick + _debug.checkout
ok((await D(() => SF.scene._debug.pick('pizza'))) === true, 'röktestets _debug.pick lägger fortfarande pizzan i korgen');
const m4 = await money();
await D(() => SF.scene._debug.checkout());
ok((await money()) === m4 - food('pizza').price && (await D(() => SF.game.fridge.pizza)) === 2, 'röktestets _debug.checkout betalar som förut');
await unlock();
await clickSpot('dorr');
await tick(10);
ok(await until(() => SF.sceneName === 'city', 5000), 'tomma händer: ut genom dörren');

ok((await saveKeys()) === keysBefore, 'sparformatet är oförändrat (samma fält)');
console.log(errs.length ? 'KONSOLFEL: ' + errs.join(' | ') : 'Inga konsolfel.');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
