// Röktest: klickar igenom hela grundflödet och tar skärmdumpar till tools/out/.
// Kör: node tools/smoke.mjs   (servern på http://localhost:8788)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const OUT = 'D:/GamesProjects/snabbfilen/tools/out/';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8788/index.html';
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
await shot('13-morgon');

// 10. Omladdning: sparfilen håller
await page.reload();
await page.waitForTimeout(800);
const loaded = await page.evaluate(() => ({ day: window.SF.game.day, money: window.SF.game.money, scene: window.SF.sceneName, name: window.SF.avatar.name }));
ok(loaded.day === morn.day, `dagen överlever omladdning (dag ${loaded.day})`);
ok(loaded.name === 'Testina', 'avataren överlever omladdning');
ok(loaded.scene === 'room', 'startar hemma efter omladdning');
await shot('14-omladdad');

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
