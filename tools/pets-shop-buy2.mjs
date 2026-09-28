// Köper två djur i rad i djuraffären och tar en bild efter det andra köpet – för att se
// att kvittot är EN toast per köp och att nästa dialog inte täcks av staplade toasts.
//   node tools/pets-shop-buy2.mjs --out tools/out/fix/buy2.png [--first katt-siames --second hund-golden --third kanin-vadur]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const port = arg('port', '8788');
const out = arg('out', 'tools/out/fix/buy2.png');
const ids = [arg('first', 'katt-siames'), arg('second', 'hund-golden'), arg('third', 'kanin-vadur')];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1240, height: 820 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${port}/index.html?world=djur${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Snap', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 20000, hunger: 90, energy: 90, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0 }));
  localStorage.removeItem('snabbfilen_pets1');
});
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { const S = window.SF; S.game.min = 12 * 60; S.go('djur'); const keep = () => { S.game.min = 12 * 60; requestAnimationFrame(keep); }; keep(); });
await page.waitForTimeout(800);

for (let i = 0; i < 2; i++) {
  await page.evaluate((id) => window.SF.scene._debug.open(id), ids[i]);
  await page.waitForTimeout(400);
  await page.locator('.dlg-foot .btn-go').click();
  await page.waitForTimeout(250);
  const toasts = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.className + ' | ' + t.textContent));
  console.log(`köp ${i + 1} (${ids[i]}): ${toasts.length} toast(s)`);
  for (const t of toasts) console.log('   ' + t);
}
// tredje dialogen öppnas direkt efter det andra köpet – toastarna ska inte täcka rubrik/porträtt/kön
await page.evaluate((id) => window.SF.scene._debug.open(id), ids[2]);
await page.waitForTimeout(300);
const png = await page.screenshot();
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, png);
console.log('skrev', out);
console.log('köpt:', JSON.stringify(await page.evaluate(() => window.SF.scene._debug.bought())));
console.log('pengar:', await page.evaluate(() => window.SF.game.money));
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
