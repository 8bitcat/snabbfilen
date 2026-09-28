// Klicktest för djuraffären: klickar på varje djur/vara som en spelare (via _debug.spot),
// väntar tills figuren gått dit och dialogen öppnats, stänger den. Köper sen en valp och en säck.
//   node tools/pets-shop-test.mjs
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1240, height: 820 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:8788/index.html?world=djurtest${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 20000, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  localStorage.removeItem('snabbfilen_pets1');
});
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => window.SF.go('djur'));
await page.waitForTimeout(300);
const box = await page.locator('#scene').boundingBox();
const ids = ['katt', 'hund', 'kanin', 'sack-katt', 'sack-kanin', 'sack-hund', 'kattklostrad', 'kattkorg', 'kattlada', 'kaninbur', 'hundkorg', 'matskal', 'vattenskal', 'koppel', 'leksak-boll', 'leksak-ben', 'pall', 'hund-mops', 'kanin-vadur', 'katt-svart'];
let ok = 0;
for (const id of ids) {
  const p = await page.evaluate((id) => window.SF.scene._debug.spot(id), id);
  if (!p) { console.log('SAKNAS', id); continue; }
  await page.mouse.click(box.x + p.x / 384 * box.width, box.y + p.y / 216 * box.height);
  let title = null;
  for (let i = 0; i < 60 && !title; i++) {
    await page.waitForTimeout(250);
    title = await page.evaluate(() => { const m = document.querySelector('#modal'); return m && !m.classList.contains('hidden') ? m.querySelector('h2')?.textContent : null; });
  }
  console.log(title ? 'OK ' : 'MISS', id.padEnd(14), title || JSON.stringify(await page.evaluate(() => ({ x: window.SF.scene.worldX, y: window.SF.scene.worldY }))));
  if (title) ok++;
  await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
  await page.waitForTimeout(150);
}
// köp: en valp + en säck
await page.evaluate(() => window.SF.scene._debug.open('hund-corgi'));
await page.waitForTimeout(300);
await page.locator('.dlg-foot .btn-go').click();
await page.waitForTimeout(200);
await page.evaluate(() => window.SF.scene._debug.open('sack-kanin'));
await page.waitForTimeout(300);
await page.locator('[data-q="1"]').click(); await page.locator('[data-q="1"]').click();
await page.locator('.dlg-foot .btn-go').click();
await page.waitForTimeout(200);
const res = await page.evaluate(() => ({ bought: window.SF.scene._debug.bought(), money: window.SF.game.money, pets: JSON.parse(localStorage.getItem('snabbfilen_pets1') || '{}'), corgiKvar: window.SF.scene._debug.actors().filter((a) => a.breed === 'corgi').length }));
console.log('köpt:', JSON.stringify(res.bought));
console.log('pengar:', res.money, '· corgis kvar i affären:', res.corgiKvar);
console.log('djur:', JSON.stringify(res.pets.pets?.map((p) => [p.name, p.species, p.breed, p.sex, p.stage, p.home])), 'förråd:', JSON.stringify(res.pets.inventory));
// dörren
const d = await page.evaluate(() => window.SF.scene._debug.spot('dorr'));
await page.mouse.click(box.x + d.x / 384 * box.width, box.y + d.y / 216 * box.height);
await page.waitForTimeout(5000);
console.log('scen efter dörren:', await page.evaluate(() => window.SF.sceneName));
console.log(`${ok}/${ids.length} dialoger öppnades.`, errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
