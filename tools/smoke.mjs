// Röktest: klickar igenom hela grundflödet och tar skärmdumpar till tools/out/.
// Kör: node tools/smoke.mjs   (servern på http://localhost:8788)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const OUT = 'D:/GamesProjects/snabbfilen/tools/out/';
fs.mkdirSync(OUT, { recursive: true });
// egen liten testvärld så att testet aldrig möter riktiga spelare
const URL = 'http://localhost:8788/index.html?world=t' + Date.now().toString(36);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);

// 1. Avatarredigeraren öppnas direkt (ingen sparad avatar)
ok(await page.locator('.dlg-avatar').count() === 1, 'avatarredigeraren öppnas vid första start');
await shot('01-avatar-editor');
await page.fill('#av-name', 'Testina');
await page.click('.av-save');
await page.waitForTimeout(400);

// 2. Välkomstdialog → välj bostad
ok((await page.locator('.dlg-head h2').textContent())?.includes('Välkommen'), 'välkomstdialogen visas');
await shot('02-valkommen');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(300);
ok((await page.locator('.dlg-head h2').textContent())?.includes('Bostadsbyrån'), 'bostadsvalet visas');
await shot('03-bostadsval');
await page.click('[data-move="rum"]');
await page.waitForTimeout(500);

// 3. Rummet
const scene = () => page.evaluate(() => window.SF.sceneName);
ok(await scene() === 'room', 'hamnar i rummet efter bostadsvalet');
await shot('04-rummet');

// 4. Kylskåpet: ät nudlarna man startar med
await page.evaluate(() => window.SF.scene.down(236, 150));
await page.waitForTimeout(900);
ok((await page.locator('.dlg-head h2').textContent())?.includes('Kylskåpet'), 'kylskåpet öppnas');
await shot('05-kylskap');
const hungerBefore = await page.evaluate(() => window.SF.game.hunger);
await page.click('[data-eat="nudlar"]');
await page.waitForTimeout(300);
const hungerAfter = await page.evaluate(() => window.SF.game.hunger);
ok(hungerAfter > hungerBefore, `äta höjer mättheten (${hungerBefore} → ${hungerAfter})`);
await page.click('.dlg-foot .btn');
await page.waitForTimeout(200);

// 5. Ut till staden – dag
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(400);
await shot('06-staden-dag');
// natt
await page.evaluate(() => { window.SF.game.min = 22 * 60; });
await page.waitForTimeout(400);
await shot('07-staden-natt');
await page.evaluate(() => { window.SF.game.min = 10 * 60; });

// 6. Matbutiken: köp en pizza hem
await page.evaluate(() => window.SF.openFoodShop());
await page.waitForTimeout(300);
await shot('08-matbutik');
const moneyBefore = await page.evaluate(() => window.SF.game.money);
await page.click('[data-buy="pizza"]');
await page.waitForTimeout(300);
const after = await page.evaluate(() => ({ money: window.SF.game.money, fridge: window.SF.game.fridge }));
ok(after.money === moneyBefore - 65, `pizza kostade 65 kr (${moneyBefore} → ${after.money})`);
ok(after.fridge.pizza === 1, 'pizzan ligger i kylskåpet');
await page.evaluate(() => window.SF.game.save());
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 7. Jobben: alla tre minispelen ritar utan fel, och mekaniken ger poäng
for (const [job, name] of [['flygplats', '09-flygplatsen'], ['frukt', '10-fruktfabriken'], ['klader', '11-kladaffaren']]) {
  await page.evaluate((j) => { window.__stats = null; window.SF.go(j, { onDone: (s) => (window.__stats = s) }); }, job);
  await page.waitForTimeout(2600);
  await shot(name);
  // dra/klicka på riktigt: hämta en sak på bandet och lägg den rätt
  const res = await page.evaluate((j) => {
    const sc = window.SF.scene;
    const it = sc._items.find((i) => i.x > 30 && i.x < 370);
    if (!it) return null;
    if (j === 'frukt') {
      // vänta in en frukt som ordern behöver (spawnen är viktad mot dem)
      return new Promise((resolve) => {
        const t0 = Date.now();
        const tryClick = () => {
          const slot = sc._order().need.find((n) => n.got < n.n);
          const right = sc._items.find((i) => i.f === slot.f && i.x > 30 && i.x < 370);
          if (right) { sc.down(right.x, right.y); resolve(sc._stats); }
          else if (Date.now() - t0 > 6000) resolve(null);
          else setTimeout(tryClick, 120);
        };
        tryClick();
      });
    } else {
      sc.down(it.x, it.y);
      const bx = (it.cat + 0.5) * (384 / 4);
      sc.move(bx, 170); sc.up(bx, 170);
    }
    return sc._stats;
  }, job);
  await page.waitForTimeout(400);
  await shot(name + '-b');
  ok(await scene() === job, `${job}: minispelet kör`);
  ok(res === null || (res.ok === 1 && res.fel === 0), `${job}: rätt sak på rätt plats gav poäng (${JSON.stringify(res)})`);
}

// 8. Snabbspola ett pass klart: flygplatsen med riggade siffror
await page.evaluate(() => {
  window.SF.game.min = 10 * 60;
  window.SF.go('flygplats', { onDone: null });
});
await page.waitForTimeout(300);
const payday = await page.evaluate(() => {
  const g = window.SF.game, before = g.money;
  const r = g.endShift('flygplats', 100);
  return { before, after: g.money, pay: r.finalPay, min: g.min };
});
ok(payday.after === payday.before + payday.pay, `lönen betalas ut (${payday.before} → ${payday.after})`);
ok(payday.min === 14 * 60, 'passet tog 4 timmar');

// 9. Sova → ny dag
await page.evaluate(() => window.SF.go('room'));
const day1 = await page.evaluate(() => window.SF.game.day);
await page.evaluate(() => window.SF.sleepFlow());
await page.waitForTimeout(300);
await shot('12-sova');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(300);
const morn = await page.evaluate(() => ({ day: window.SF.game.day, min: window.SF.game.min, energy: window.SF.game.energy }));
ok(morn.day === day1 + 1 && morn.min === 7 * 60, `ny dag efter sömn (dag ${morn.day}, 07:00)`);
ok(morn.energy > 50, `utvilad på morgonen (energi ${morn.energy})`);
await page.evaluate(() => { window.SF.game.event = null; }); // slumphändelsen ska inte störa priskontrollerna nedan
await shot('13-morgon');

// 10. Omladdning: sparfilen håller
await page.reload();
await page.waitForTimeout(800);
const loaded = await page.evaluate(() => ({ day: window.SF.game.day, money: window.SF.game.money, scene: window.SF.sceneName, name: window.SF.avatar.name }));
ok(loaded.day === morn.day, `dagen överlever omladdning (dag ${loaded.day})`);
ok(loaded.name === 'Testina', 'avataren överlever omladdning');
ok(loaded.scene === 'room', 'startar hemma efter omladdning');
await shot('14-omladdad');

// 11. Klädaffären: handla en huvtröja → låses upp i garderoben
await page.evaluate(() => { window.SF.game.money = 2000; window.SF.openKladaffar(); });
await page.waitForTimeout(200);
await page.click('.dlg-foot .btn:nth-child(2)'); // 🛍️ Handla kläder
await page.waitForTimeout(200);
await shot('15-kladshop');
await page.click('.prow:has-text("Huvtröja") [data-shop]');
await page.waitForTimeout(200);
const w = await page.evaluate(() => ({ wardrobe: window.SF.game.wardrobe, money: window.SF.game.money }));
ok(w.wardrobe.includes('top:hoodie'), 'huvtröjan ligger i garderoben');
ok(w.money === 2000 - 250, `huvtröjan kostade 250 kr (${w.money} kvar)`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 12. Garderoben: köpta plagg är öppna, resten har hänglås
await page.evaluate(() => window.SF.go('room'));
await page.evaluate(() => window.SF.scene.down(139, 150));
await page.waitForTimeout(900);
await page.click('.av-tab[data-tab="top"]');
await page.waitForTimeout(300);
const locks = await page.evaluate(() => ({
  locked: [...document.querySelectorAll('.av-panel .av-tile.locked')].map((b) => JSON.parse(b.dataset.v)),
  hoodieLocked: !!document.querySelector('.av-panel .av-tile.locked[data-v=\'"hoodie"\']'),
  worn: window.SF.avatar.look.top,
}));
const expectLocked = ['sweater', 'shirt', 'jacket'].filter((v) => v !== locks.worn); // det man har på sig visas som valt, inte låst
ok(!locks.hoodieLocked && expectLocked.every((v) => locks.locked.includes(v)) && locks.locked.length === expectLocked.length,
  `köpta plagg öppna, resten låsta (låsta: ${locks.locked.join(', ')} · på sig: ${locks.worn})`);
await shot('16-garderob-las');
await page.click('.av-cancel');
await page.waitForTimeout(200);

// 12b. Personalrabatt: hög nivå på klädaffärsjobbet ger billigare kläder
const rabatt = await page.evaluate(() => {
  const g = window.SF.game;
  g.jobs.klader = 9; g.money = 1000; // Mästare → 15 % rabatt
  const before = g.money;
  const r = g.buyClothes('hat', 'beanie');
  return { price: r.price, delta: before - g.money, disc: g.clothesDiscount() };
});
ok(rabatt.disc === 0.15 && rabatt.price === 128 && rabatt.delta === 128, `personalrabatt 15 % på mössan (128 i stället för 150 kr)`);

// 12c. Dagshändelser: REA sänker priset, extrapass dubblar lönen, rekord sparas
const ev = await page.evaluate(() => {
  const g = window.SF.game;
  const utanRea = g.clothesPrice({ price: 200 });
  g.event = { id: 'rea' };
  const medRea = g.clothesPrice({ price: 200 });
  g.event = { id: 'dubbel', job: 'flygplats' };
  const before = g.money;
  const r1 = g.endShift('flygplats', 100, { ok: 5 });
  const r2 = g.endShift('flygplats', 100, { ok: 3 });
  g.event = null;
  return { utanRea, medRea, pay1: r1.finalPay, doubled: r1.doubled, rec1: r1.newRecord, rec2: r2.newRecord, delta: g.money - before, best: g.best.flygplats };
});
ok(ev.utanRea === 170 && ev.medRea === 128, `REA: 200 kr-plagg kostar 128 med rea+rabatt (${ev.medRea})`);
ok(ev.doubled && ev.pay1 === 200 && ev.delta === 400, `extrapass ger dubbel lön (${ev.pay1} kr × 2 pass)`);
ok(ev.rec1 && !ev.rec2 && ev.best.ok === 5, `rekord sparas rätt (5 rätt, andra passet inget rekord)`);

// 12d. Dagboken 📊: din resa hittills
await page.click('#hud-diary');
await page.waitForTimeout(200);
ok((await page.locator('.dlg-head h2').textContent())?.includes('Din resa'), 'dagboken öppnas');
await shot('22-dagbok');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 13. Möbelhörnan: köp en soffa till rummet
await page.evaluate(() => { window.SF.game.money = 5000; window.SF.openHousing(); });
await page.waitForTimeout(200);
await page.click('.dlg-foot .btn'); // 🛋️ Möbelhörnan
await page.waitForTimeout(200);
await page.click('[data-furn="soffa"]');
await page.waitForTimeout(200);
ok(await page.evaluate(() => window.SF.game.furniture.includes('soffa')), 'soffan är köpt');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await shot('17-rum-med-soffa');

// 14. Slutmålet: Villan + 10 000 kr → gratulationsdialog
await page.evaluate(() => { window.SF.game.home = 'villa'; window.SF.game.money = 15000; window.SF.game.save(); });
await page.waitForTimeout(600);
ok((await page.locator('.dlg-head h2').textContent().catch(() => ''))?.includes('lyckats'), 'vinstdialogen visas');
await shot('18-vinst');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(200);

// 15. Öppna världen: ingen kod – två spelare hamnar automatiskt i samma värld
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
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: { flygplats: 0, frukt: 0, klader: 0 }, earned: 0, wardrobe: [], furniture: [], won: false }));
});
await guest.reload();
let guestIn = false;
for (let i = 0; i < 50 && !guestIn; i++) {
  await guest.waitForTimeout(200);
  guestIn = await guest.evaluate(() => window.SF.worldInfo().open && window.SF.worldInfo().role === 'client');
}
ok(guestIn, 'andra spelaren anslöt automatiskt som klient – ingen kod');
ok(await page.evaluate(() => window.SF.worldInfo().online) === 2, 'värden räknar 2 online');

// båda går ut i staden och ser varandra
await page.evaluate(() => window.SF.go('city'));
await guest.evaluate(() => window.SF.go('city'));
let seen = 0;
for (let i = 0; i < 20 && seen !== 1; i++) {
  await page.waitForTimeout(250);
  seen = await page.evaluate(() => window.SF.worldFolksHere().length);
}
ok(seen === 1, 'spelarna ser varandra på gatan i Pixelstaden');
await shot('19-stad-tva-spelare');

// gästen åker hem till första spelarens villa via 👥-listan
const hostId = await guest.evaluate(() => window.SF.playersList()[0]?.id);
await guest.evaluate((id) => window.SF.visitPlayer(id), hostId);
await guest.waitForTimeout(400);
ok(await guest.evaluate(() => window.SF.sceneName) === 'visit', 'gästen är hemma hos den andra');
ok(await guest.evaluate(() => window.SF.visitTarget?.home) === 'villa', 'gästen ser villan (värdens bostad)');

// värden går hem – nu är båda i samma rum och ser varandra
await page.evaluate(() => window.SF.go('room'));
let inRoom = 0;
for (let i = 0; i < 20 && inRoom !== 1; i++) {
  await page.waitForTimeout(250);
  inRoom = await page.evaluate(() => window.SF.worldFolksHere().length);
}
ok(inRoom === 1, 'värden ser besökaren i sitt rum');

// gästen promenerar genom rummet – syns vandringen hos värden?
await guest.evaluate(() => window.SF.scene.down(80, 190));
let folk = null;
for (let i = 0; i < 32; i++) {
  await page.waitForTimeout(250);
  folk = await page.evaluate(() => window.SF.worldFolksHere()[0] || null);
  if (folk && folk.x > 0 && folk.x < 120) break;
}
ok(folk && folk.x < 120, `gästens promenad syns hos värden (x=${Math.round(folk?.x ?? -1)})`);
// …och en emote når fram innan den slocknar (2,6 s)
await guest.evaluate(() => window.SF.sendEmote('❤️'));
let emote = null;
for (let i = 0; i < 10 && emote !== '❤️'; i++) {
  await page.waitForTimeout(150);
  emote = await page.evaluate(() => window.SF.worldFolksHere()[0]?.emote || null);
}
ok(emote === '❤️', `emoten syns hos värden (${emote})`);
await shot('20-vard-med-besok');
await guest.screenshot({ path: OUT + '21-gast-pa-besok.png' });

// gästen går hem via dörren
await guest.evaluate(() => window.SF.scene.down(342, 190));
let back = false;
for (let i = 0; i < 32 && !back; i++) {
  await guest.waitForTimeout(250);
  back = await guest.evaluate(() => window.SF.sceneName === 'city');
}
ok(back, 'gästen gick hem genom dörren och är i sin egen stad');
let emptyRoom = -1;
for (let i = 0; i < 20 && emptyRoom !== 0; i++) {
  await page.waitForTimeout(250);
  emptyRoom = await page.evaluate(() => window.SF.worldFolksHere().length);
}
ok(emptyRoom === 0, 'värdens rum är tomt igen (men båda är kvar i världen)');
ok(await page.evaluate(() => window.SF.worldInfo().online) === 2, 'fortfarande 2 online i världen');
await ctx2.close();

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
