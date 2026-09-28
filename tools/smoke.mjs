// Röktest: klickar igenom hela grundflödet och tar skärmdumpar till tools/out/.
// Kör: node tools/smoke.mjs   (servern på http://localhost:8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const OUT = 'D:/GamesProjects/snabbfilen/tools/out/';
fs.mkdirSync(OUT, { recursive: true });
// egen liten testvärld så att testet aldrig möter riktiga spelare
const PORT = process.env.SMOKE_PORT || '8788';
const URL = `http://localhost:${PORT}/index.html?world=t` + Date.now().toString(36);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const scene = () => page.evaluate(() => window.SF.sceneName);

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 20000 });
await page.waitForTimeout(400);

// 1. Avatarredigeraren öppnas direkt
ok(await page.locator('.dlg-avatar').count() === 1, 'avatarredigeraren öppnas vid första start');
await shot('01-avatar-editor');
await page.fill('#av-name', 'Testina');
await page.click('.av-save');
await page.waitForTimeout(400);

// 2. Välkomstdialog → alla börjar i husvagnen (Carl 2026-09-28)
ok((await page.locator('.dlg-head h2').textContent())?.includes('Välkommen'), 'välkomstdialogen visas');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(500);
ok(await scene() === 'room', 'hamnar hemma efter välkomsten');
ok(await page.evaluate(() => window.SF.game.home) === 'husvagn', 'nya spelare börjar i husvagnen');
// resten av röktestet är byggt kring Lilla rummets planlösning (husvagnen testas i
// tools/homes-test.mjs och tools/bostad-titta-test.mjs) – flytta testfiguren dit
await page.evaluate(() => { window.SF.game.home = 'rum'; window.SF.game.save(); window.SF.roomSub = 0; window.SF.go('room'); });
await page.waitForTimeout(400);
await shot('04-rummet');

// 3. Kylskåpet: gå dit över golvet och ät
await page.evaluate(() => { const p = window.SF.scene._debug.spot('kylskap'); window.SF.scene.down(p.x, p.y); });
await page.waitForTimeout(2800);
ok((await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('Kylskåpet'), 'kylskåpet öppnas');
const hungerBefore = await page.evaluate(() => window.SF.game.hunger);
await page.click('[data-eat="nudlar"]');
await page.waitForTimeout(300);
ok(await page.evaluate(() => window.SF.game.hunger) > hungerBefore, 'äta höjer mättheten');
await page.click('.dlg-foot .btn');
await page.waitForTimeout(200);

// 3b. Klockan går av sig själv (2 spelminuter per sekund)
const m0 = await page.evaluate(() => window.SF.game.min);
await page.waitForTimeout(1500);
const m1 = await page.evaluate(() => window.SF.game.min);
ok(m1 - m0 >= 2 && m1 - m0 < 6, `klockan går av sig själv (+${(m1 - m0).toFixed(1)} min på 1,5 s)`);

// 4. Ut till gåbara staden
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(400);
await shot('06-staden-dag');
await page.evaluate(() => { window.SF.game.min = 22 * 60; });
await page.waitForTimeout(400);
await shot('07-staden-natt');
await page.evaluate(() => { window.SF.game.min = 10 * 60; });

// 4b. REGRESSION: klick på flyghuset ska öppna jobbintro (inte hänga)
await page.evaluate(() => { window.SF.citySub = 1; window.SF.go('city'); });
await page.waitForTimeout(300);
await shot('06b-arbetsomradet');
await page.evaluate(() => { const p = window.SF.scene._debug.spot('flyg'); window.SF.scene.down(p.x, p.y); });
let introSeen = false;
for (let i = 0; i < 80 && !introSeen; i++) { // staden är stor – promenaden tar en stund
  await page.waitForTimeout(300);
  introSeen = (await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('Flygplatsen');
}
ok(introSeen, 'flyghuset öppnar jobbintro (hängde inte)');
await page.click('.dlg-foot .btn'); // En annan gång
await page.waitForTimeout(200);
await page.evaluate(() => { window.SF.citySub = 0; });

// 4c. Staden v2: kartkontraktet stämmer, man kan gå runt ett södervänt hus till dörren, bussen går till förorten
const mapProblems = await page.evaluate(() => import('../js/city/map.js').then((m) => m.validateMap()));
ok(mapProblems.length === 0, `kartkontraktet v2 stämmer${mapProblems.length ? ': ' + mapProblems.slice(0, 3).join('; ') : ''}`);
await page.evaluate(() => { const d = window.SF.scene._debug; d.teleport(216, 476); d.enter('pizzeria'); }); // från parkgången bakom pizzerian
let around = false;
for (let i = 0; i < 60 && !around; i++) {
  await page.waitForTimeout(250);
  around = await page.evaluate(() => window.SF.scene._debug.arrived());
}
const atDoor = await page.evaluate(() => window.SF.scene._debug.pos());
ok(around && Math.abs(atDoor.x - 216) < 6 && atDoor.y > 640 && atDoor.y < 664, `gick runt pizzerian till dörren på söderfasaden (${Math.round(atDoor.x)},${Math.round(atDoor.y)})`);
await shot('06c-soder');
const busBefore = await page.evaluate(() => ({ min: window.SF.game.min, money: window.SF.game.money }));
await page.evaluate(() => { const d = window.SF.scene._debug; const p = d.busStop('SÖDERKYRKAN'); window.SF.scene.down(p.x, p.y); });
let busDlg = false;
for (let i = 0; i < 40 && !busDlg; i++) {
  await page.waitForTimeout(250);
  busDlg = (await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('SÖDERKYRKAN');
}
ok(busDlg, 'busshållplatsen öppnar resmålsdialogen');
await page.click('[data-bus="betongtorget"]');
let inSuburb = false;
for (let i = 0; i < 20 && !inSuburb; i++) {
  await page.waitForTimeout(250);
  inSuburb = await page.evaluate(() => window.SF.scene._debug.arrived() && window.SF.scene._debug.districtNow() === 'FÖRORTEN');
}
const busAfter = await page.evaluate(() => ({ min: window.SF.game.min, money: window.SF.game.money }));
ok(inSuburb && busAfter.money === busBefore.money - 10 && busAfter.min >= busBefore.min + 15, `bussen tog en till förorten (10 kr, +${Math.round(busAfter.min - busBefore.min)} min)`);
await shot('06d-fororten');

// 4d. Bussen på riktigt: väntande spelare kallar fram en buss → klick på dörren → dialog → ombord → framme
let busSeen = false;
for (let i = 0; i < 80 && !busSeen; i++) { // spelaren står vid hållplatsen – trafiken summonar en buss
  await page.waitForTimeout(250);
  busSeen = await page.evaluate(() => !!window.SF.scene._debug.sim().traffic.busAt?.('betongtorget'));
}
ok(busSeen, 'en buss kom fram när man väntade vid hållplatsen');
const doorClicked = await page.evaluate(() => {
  const d = window.SF.scene._debug, tr = d.sim().traffic;
  const bi = tr.busAt?.('betongtorget');
  if (!bi) return false;
  tr.hold('betongtorget', 30); // ge promenaden till dörren gott om tid
  const c = d.cam();
  window.SF.scene.down((bi.x0 + bi.x1) / 2 - c.x, bi.y - 20 - c.y);
  return true;
});
let lineDlg = false;
for (let i = 0; i < 40 && !lineDlg; i++) {
  await page.waitForTimeout(250);
  lineDlg = (await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('Linje 4');
}
ok(doorClicked && lineDlg, 'klick på bussdörren öppnar Linje 4-dialogen');
const rideBefore = await page.evaluate(() => window.SF.game.money);
await page.click('[data-bus="pixeltorget"]');
let riding = false;
for (let i = 0; i < 20 && !riding; i++) { await page.waitForTimeout(250); riding = await page.evaluate(() => !!window.SF.scene._debug.ride()); }
ok(riding && (await page.evaluate(() => window.SF.game.money)) === rideBefore - 10, 'ombord på bussen (10 kr) – resan är igång');
await shot('06e-ombord');
await page.evaluate(() => window.SF.scene.down(10, 10)); // klick under resan = hoppa fram
let offBus = false;
for (let i = 0; i < 80 && !offBus; i++) { await page.waitForTimeout(250); offBus = await page.evaluate(() => !window.SF.scene._debug.ride()); }
const offPos = await page.evaluate(() => window.SF.scene._debug.pos());
ok(offBus && Math.abs(offPos.x - 610) < 220, `klev av bussen vid Pixeltorget (${Math.round(offPos.x)},${Math.round(offPos.y)})`);

// 4e. Bänkarna: klick på en ledig parkbänk → figuren går dit och sätter sig; nästa klick reser den
const seatId = await page.evaluate(() => {
  const d = window.SF.scene._debug, S = d.sim();
  const p = d.pos();
  const s = S.props.seatNear?.(p.x, p.y, 900, (q) => q.kind === 'bank' && !S.life.seatBusy?.(q.id));
  if (!s) return null;
  d.teleport(s.walk.x, s.walk.y + (s.dir === 'up' ? -24 : 24));
  const c = d.cam();
  window.SF.scene.down(s.x - c.x, s.y - 4 - c.y);
  return s.id;
});
let sat = false;
for (let i = 0; i < 30 && !sat; i++) { await page.waitForTimeout(250); sat = await page.evaluate(() => !!window.SF.scene._debug.sitting()); }
ok(!!seatId && sat, `satte sig på en bänk (${seatId})`);
await shot('06f-bank');
await page.evaluate(() => { const d = window.SF.scene._debug, c = d.cam(), p = d.pos(); window.SF.scene.down(p.x - c.x, p.y + 40 - c.y); });
await page.waitForTimeout(600);
ok(await page.evaluate(() => !window.SF.scene._debug.sitting()), 'reste sig vid nästa klick');

// 5. Stormarknaden (gåbar): plocka en pizza i korgen och betala i kassan
await page.evaluate(() => window.SF.go('mat'));
await page.waitForTimeout(700);
const moneyBefore = await page.evaluate(() => window.SF.game.money);
ok(await page.evaluate(() => !!window.SF.scene._debug.spot('pizza')), 'pizzan står på en hylla med prislapp');
ok(await page.evaluate(() => window.SF.scene._debug.pick('pizza')), 'pizzan lades i korgen');
ok(await page.evaluate(() => window.SF.scene._debug.basket().some((b) => b.id === 'pizza')), 'korgen innehåller pizzan');
await shot('08-stormarknad');
await page.evaluate(() => window.SF.scene._debug.checkout());
let paid = false;
for (let i = 0; i < 60 && !paid; i++) { await page.waitForTimeout(250); paid = await page.evaluate(() => window.SF.game.fridge.pizza === 1); }
ok(paid && (await page.evaluate(() => window.SF.game.money)) === moneyBefore - 65, 'betalade 65 kr i kassan – pizzan ligger i kylskåpet');
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(300);

// 6. Jobben: gåbara med plocka/bära/servera
console.log('— jobben (gåbara) —');
// FRUKT: bär rätt frukt till lådan
await page.evaluate(() => { window.__stats = null; window.SF.go('jobbfrukt', { onDone: (s) => (window.__stats = s) }); });
await page.waitForTimeout(1200);
await shot('10-fruktfabriken');
const fr = await page.evaluate(() => {
  const d = window.SF.scene._debug;
  d.setCarry(Math.max(0, d.needFruit()));
  return d.forceDrop();
});
ok(fr && fr.ok === 1 && fr.fel === 0, `frukt: rätt frukt i lådan gav poäng (${JSON.stringify(fr)})`);
// FLYG: plocka väska, lägg i rätt vagn
await page.evaluate(() => { window.__stats = null; window.SF.go('jobbflyg', { onDone: (s) => (window.__stats = s) }); });
let fl = null;
for (let i = 0; i < 20 && !fl; i++) {
  await page.waitForTimeout(300);
  fl = await page.evaluate(() => { const d = window.SF.scene._debug; return d.forcePick() ? d.forceDrop(true) : null; });
}
await shot('09-flygplatsen');
ok(fl && fl.ok === 1 && fl.fel === 0, `flyg: väskan i rätt vagn gav poäng (${JSON.stringify(fl)})`);
// BURGARE: kund + tallrik + servering
await page.evaluate(() => { window.__stats = null; window.SF.go('jobbburgare', { onDone: (s) => (window.__stats = s) }); });
await page.waitForTimeout(600);
const bu = await page.evaluate(() => {
  const d = window.SF.scene._debug;
  const wish = d.forceCustomer();
  d.forcePlate(wish);
  d.pickPlate(0);
  return d.serve(true);
});
await page.waitForTimeout(400);
await shot('11-burgarbaren');
ok(bu && bu.ok === 1 && bu.fel === 0, `burgare: rätt mat till rätt kund gav poäng (${JSON.stringify(bu)})`);

// 7. Lön + sömn + omladdning
await page.evaluate(() => { window.SF.game.min = 10 * 60; window.SF.go('room'); });
const payday = await page.evaluate(() => {
  const g = window.SF.game, before = g.money;
  const r = g.endShift('flygplats', 100, { ok: 5 });
  return { before, after: g.money, pay: r.finalPay, min: g.min, rec: r.newRecord };
});
ok(payday.after === payday.before + payday.pay, 'lönen betalas ut');
ok(Math.abs(payday.min - 14 * 60) <= 8, `passet tog 4 timmar (klockan ${Math.floor(payday.min / 60)}:${String(payday.min % 60).padStart(2, '0')})`); // realtidsklockan kan hinna ticka några minuter
ok(payday.rec, 'rekord registrerades');
const day1 = await page.evaluate(() => window.SF.game.day);
await page.evaluate(() => window.SF.sleepFlow());
await page.waitForTimeout(300);
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(300);
ok(await page.evaluate(() => document.querySelectorAll('.wk-day').length === 7 && !!document.querySelector('.wk-day.today')), 'veckosammanfattningen visas när man vaknar');
await shot('13b-veckan');
await page.evaluate(() => document.querySelector('.dlg-foot .btn-go')?.click());
await page.waitForTimeout(200);
const morn = await page.evaluate(() => ({ day: window.SF.game.day, min: window.SF.game.min, energy: window.SF.game.energy }));
ok(morn.day === day1 + 1 && morn.min >= 7 * 60 && morn.min < 7 * 60 + 6, `ny dag efter sömn (dag ${morn.day}, ${Math.floor(morn.min / 60)}:${String(Math.floor(morn.min % 60)).padStart(2, '0')})`);
ok(morn.energy > 50, `utvilad på morgonen (energi ${morn.energy})`);
await page.evaluate(() => { window.SF.game.event = null; });
await page.reload();
await page.waitForTimeout(900);
ok(await page.evaluate(() => window.SF.game.day) === morn.day, 'dagen överlever omladdning');
ok(await page.evaluate(() => window.SF.avatar.name) === 'Testina', 'avataren överlever omladdning');

// 8. Klädaffären: mannekänger man går fram till
console.log('— butikerna (gåbara) —');
await page.evaluate(() => { window.SF.game.money = 2000; window.SF.game.event = null; window.SF.go('klader'); });
await page.waitForTimeout(400);
await shot('15-kladaffaren');
const hoodieIdx = await page.evaluate(() => window.SF.scene._debug.dummies.indexOf('top:hoodie'));
ok(hoodieIdx >= 0, 'huvtröjan står på en mannekäng');
await page.evaluate((i) => { const p = window.SF.scene._debug.spot('dummy' + i); window.SF.scene.down(p.x, p.y); }, hoodieIdx);
let buyDlg = false;
for (let i = 0; i < 16 && !buyDlg; i++) {
  await page.waitForTimeout(300);
  buyDlg = (await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('Huvtröja');
}
ok(buyDlg, 'köpdialogen öppnas vid mannekängen');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(300);
const w = await page.evaluate(() => ({ wardrobe: window.SF.game.wardrobe, money: window.SF.game.money }));
ok(w.wardrobe.includes('top:hoodie'), 'huvtröjan ligger i garderoben');
ok(w.money === 2000 - 250, `huvtröjan kostade 250 kr (${w.money} kvar)`);

// 8b. Garderoben: köpta plagg visas, resten döljs bakom "🔒 N fler i klädaffären"
await page.evaluate(() => window.SF.go('room'));
await page.evaluate(() => { const p = window.SF.scene._debug.spot('garderob'); window.SF.scene.down(p.x, p.y); });
await page.waitForTimeout(2800);
await page.click('.av-tab[data-tab="top"]');
await page.waitForTimeout(800); // rutorna ritas lat
const locks = await page.evaluate(() => ({
  items: [...document.querySelectorAll('.av-panel [data-item]')].map((b) => b.dataset.item),
  more: document.querySelector('.av-panel .av-more')?.textContent || '',
  worn: window.SF.avatar.look.top,
}));
const hidden = ['sweater', 'shirt', 'jacket', 'vest', 'hawaii', 'suit'].filter((v) => v !== locks.worn);
ok(locks.items.includes('top-hoodie') && hidden.every((v) => !locks.items.includes('top-' + v)) && /🔒\s*\d+ fler/.test(locks.more),
  `köpta plagg visas, resten dolda (${locks.items.join(', ')} · ${locks.more.trim()})`);
await shot('16-garderob-las');
await page.click('.av-cancel');
await page.waitForTimeout(200);

// 8c. REA-priset
const rea = await page.evaluate(() => {
  const g = window.SF.game;
  const utan = g.clothesPrice({ price: 200 });
  g.event = { id: 'rea' };
  const med = g.clothesPrice({ price: 200 });
  g.event = null;
  return { utan, med };
});
ok(rea.utan === 200 && rea.med === 150, `REA ger 25 % (200 → ${rea.med})`);

// 9. Möbelvaruhuset: gå fram till soffan och köp
await page.evaluate(() => { window.SF.game.money = 5000; window.SF.go('mobler'); });
await page.waitForTimeout(400);
await shot('18-mobelvaruhus');
await page.evaluate(() => { const p = window.SF.scene._debug.spot('soffa'); window.SF.scene.down(p.x, p.y); });
let sofaDlg = false;
for (let i = 0; i < 16 && !sofaDlg; i++) {
  await page.waitForTimeout(300);
  sofaDlg = (await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('Soffa');
}
ok(sofaDlg, 'soffans köpdialog öppnas i varuhuset');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(300);
ok(await page.evaluate(() => window.SF.game.storage.some((s) => s.k === 'soffa')), 'soffan ligger i förrådet');
// placera den hemma
const placed = await page.evaluate(() => {
  const g = window.SF.game;
  const i = g.storage.findIndex((s) => s.k === 'soffa');
  g.placeFromStorage(i, 0, 60, 180);
  return g.decoRoom(0).some((d) => d.k === 'soffa');
});
ok(placed, 'soffan placerades i rummet');
await page.evaluate(() => window.SF.go('room'));
await page.waitForTimeout(400);
await shot('17-rum-med-soffa');

// 10. Dagbok + vinst + delrum
await page.click('#hud-diary');
await page.waitForTimeout(200);
ok((await page.locator('.dlg-head h2').textContent())?.includes('Din resa'), 'dagboken öppnas');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.evaluate(() => { window.SF.game.home = 'villa'; window.SF.game.money = 15000; window.SF.game.save(); });
await page.waitForTimeout(600);
ok((await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('lyckats'), 'vinstdialogen visas');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(200);
await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
await page.waitForTimeout(400);
await shot('20-villan-vardagsrum');
await page.evaluate(() => { const p = window.SF.scene._debug.spot('sub1'); window.SF.scene.down(p.x, p.y); });
let inBedroom = false;
for (let i = 0; i < 16 && !inBedroom; i++) {
  await page.waitForTimeout(300);
  inBedroom = await page.evaluate(() => window.SF.roomSub === 1 && window.SF.sceneName === 'room');
}
ok(inBedroom, 'gick genom dörren till SOVRUM (delrum)');
await shot('21-villan-sovrum');
await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
await page.waitForTimeout(300);

// 11. Öppna världen: två spelare, besök, promenad, emote
console.log('— öppna världen (PeerJS-molnet) —');
let hostRole = null;
for (let i = 0; i < 50 && hostRole !== 'host'; i++) {
  await page.waitForTimeout(200);
  hostRole = await page.evaluate(() => (window.SF.worldInfo().open ? window.SF.worldInfo().role : null));
}
ok(hostRole === 'host', 'första spelaren blev världsvärd automatiskt');

const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const guest = await ctx2.newPage();
guest.on('pageerror', (e) => errors.push('[gäst] ' + e.message));
guest.on('console', (m) => m.type() === 'error' && errors.push('[gäst] ' + m.text()));
await guest.goto(URL);
await guest.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Kompis', look: { skin: '#eabf98', shirt: '#f28bb3' }, color: '#ff5dc8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: { flygplats: 0, frukt: 0, burgare: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await guest.reload();
await guest.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 20000 });
let guestIn = false;
for (let i = 0; i < 50 && !guestIn; i++) {
  await guest.waitForTimeout(200);
  guestIn = await guest.evaluate(() => window.SF.worldInfo().open && window.SF.worldInfo().role === 'client');
}
ok(guestIn, 'andra spelaren anslöt automatiskt – ingen kod');

// båda i staden (centrum) och ser varandra
await page.evaluate(() => { window.SF.citySub = 0; window.SF.go('city'); });
await guest.evaluate(() => { window.SF.citySub = 0; window.SF.go('city'); });
let seen = 0;
for (let i = 0; i < 20 && seen !== 1; i++) {
  await page.waitForTimeout(250);
  seen = await page.evaluate(() => window.SF.worldFolksHere().length);
}
ok(seen === 1, 'spelarna ser varandra i den gåbara staden');
await shot('19-stad-tva-spelare');

// gästen besöker villan
const hostId = await guest.evaluate(() => window.SF.playersList()[0]?.id);
await guest.evaluate(() => { window.SF.roomSub = 0; });
await guest.evaluate((id) => window.SF.visitPlayer(id), hostId);
await guest.waitForTimeout(400);
ok(await guest.evaluate(() => window.SF.sceneName) === 'visit', 'gästen är hemma hos den andra');
ok(await guest.evaluate(() => window.SF.visitTarget?.home) === 'villa', 'gästen ser villan');
await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
let inRoom = 0;
for (let i = 0; i < 20 && inRoom !== 1; i++) {
  await page.waitForTimeout(250);
  inRoom = await page.evaluate(() => window.SF.worldFolksHere().length);
}
ok(inRoom === 1, 'värden ser besökaren i sitt vardagsrum');
// promenad + emote
await guest.evaluate(() => { const p = window.SF.scene._debug.tile(1, 6); window.SF.scene.down(p.x, p.y); });
let folk = null;
for (let i = 0; i < 32; i++) {
  await page.waitForTimeout(250);
  folk = await page.evaluate(() => window.SF.worldFolksHere()[0] || null);
  if (folk && folk.x > 0 && folk.x < 130) break;
}
ok(folk && folk.x < 130, `gästens promenad syns hos värden (x=${Math.round(folk?.x ?? -1)})`);
await guest.evaluate(() => window.SF.sendEmote('❤️'));
let emote = null;
for (let i = 0; i < 10 && emote !== '❤️'; i++) {
  await page.waitForTimeout(150);
  emote = await page.evaluate(() => window.SF.worldFolksHere()[0]?.emote || null);
}
ok(emote === '❤️', 'emoten syns hos värden');
await shot('22-vard-med-besok');
// hem via dörren
await guest.evaluate(() => { const p = window.SF.scene._debug.spot('dorr'); window.SF.scene.down(p.x, p.y); });
let back = false;
for (let i = 0; i < 32 && !back; i++) {
  await guest.waitForTimeout(250);
  back = await guest.evaluate(() => window.SF.sceneName === 'city');
}
ok(back, 'gästen gick hem genom dörren');
let emptyRoom = -1;
for (let i = 0; i < 20 && emptyRoom !== 0; i++) {
  await page.waitForTimeout(250);
  emptyRoom = await page.evaluate(() => window.SF.worldFolksHere().length);
}
ok(emptyRoom === 0, 'värdens rum är tomt igen');
ok(await page.evaluate(() => window.SF.worldInfo().online) === 2, 'fortfarande 2 online');
await ctx2.close();

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
