// Gör en riktig sparfil med en viss version av spelet (standard: den publicerade sidan)
// och sparar hela localStorage som testfixtur i tools/saves/v<version>.json.
// tools/save-compat.mjs laddar sedan varje fixtur med den nya koden och kontrollerar att
// inget försvinner. Kör detta en gång per släpp som ändrar sparformatet.
//   node tools/make-save-fixture.mjs                      (https://8bitcat.github.io/snabbfilen/)
//   node tools/make-save-fixture.mjs http://localhost:8788/
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'https://8bitcat.github.io/snabbfilen/').replace(/\/?$/, '/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(`${base}index.html?world=fixtur${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Fixtur', look: { skin: '#eabf98', shirt: '#f28bb3', hair: '#5a3825' }, color: '#ff5dc8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 640, money: 30000, hunger: 66, energy: 71, home: 'villa', fridge: {}, jobs: { flygplats: 0, frukt: 0, burgare: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(1500);
const version = await page.evaluate(async () => {
  const g = window.SF.game;
  for (const [k, v, c] of [['soffa', 0, '#3366ff'], ['lampa', 0, null], ['bokhylla', 0, '#aa5533'], ['spis', 0, null], ['matta', 0, '#22aa66']]) g.buyFurniture(k, v, c);
  g.placeFromStorage(0, 0, 140, 150);
  g.placeFromStorage(0, 1, 90, 140);
  g.placeFromStorage(0, 2, 200, 160);
  for (const s of [['hat', 'cap'], ['top', 'vest'], ['bottom', 'shorts']]) g.buyClothes(s[0], s[1]);
  g.buyFood('pizza'); g.buyFood('lyx'); g.buyFood('macka');
  g.jobs.burgare = 5; g.jobs.flygplats = 2; g.earned = 4321;
  g.best.burgare = { ok: 14, pay: 310 };
  g.save();
  window.SF.game.save();
  let v = null;
  try { v = (await import('./js/version.js')).VERSION; } catch { /* före versionshanteringen */ }
  return v || 'okand';
});
const data = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('snabbfilen')).map((k) => [k, localStorage.getItem(k)])));
await b.close();
const out = path.join(ROOT, 'tools/saves', `v${version}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ version, made: new Date().toISOString(), source: base, localStorage: data }, null, 2) + '\n');
const save = JSON.parse(data.snabbfilen_save1);
console.log(`✓ ${out}: ${Object.keys(data).length} nycklar, ${save.money} kr, ${save.wardrobe.length} plagg, ${Object.values(save.deco).flat().length} möbler, ${save.storage.length} i förrådet`);
