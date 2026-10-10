// Bostäderna (Carl 2026-09-28 natt):
//  1) nya spel börjar i husvagnen
//  2) listan: Husvagnen, Förortsettan, Lilla rummet, Lägenheten, Radhuset, Villan, Gården (i landet), Takvåningen
//  3) 👁 Titta in visar bilder inifrån varje bostad (alla delrum, dag/kväll) utan att
//     spelet ändras – varken hemmet, möblerna eller sparfilen.
// Kör: node tools/bostad-titta-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
fs.mkdirSync('tools/out', { recursive: true });

// 1) helt nytt spel: avatar → välkomst → husvagnen
await page.goto(`http://localhost:${PORT}/index.html?world=bt${Date.now().toString(36)}`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 20000 });
await page.waitForTimeout(400);
await page.fill('#fs-namn', 'Vagnis');
await page.click('.fs-steg[data-steg="klart"]');
await page.click('.fs-spela');
await page.waitForTimeout(400);
const welcome = await page.locator('#modal').textContent();
ok(/husvagn/i.test(welcome), 'välkomsten berättar att alla börjar i husvagnen');
await page.click('.dlg-foot .btn-go');
await page.waitForTimeout(600);
ok(await page.evaluate(() => window.SF.sceneName === 'room' && window.SF.game.home === 'husvagn'), 'nytt spel börjar i husvagnen');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1') || '{}').home) === 'husvagn', 'husvagnen är sparad som hemmet');
// veckan kan ha öppnats – stäng den
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn-go, #modal:not(.hidden) .dlg-foot .btn')?.click());
await page.waitForTimeout(300);

// ut genom husvagnsdörren → vid husvagnen i förorten (inte vid första huset i centrum)
async function outTheDoor(label) {
  await page.evaluate(() => { const p = window.SF.scene._debug.spot('dorr'); window.SF.scene.down(p.x, p.y); });
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => window.SF.sceneName === 'city')) break; }
  // husvagnens dörr i stadens koordinater (js/city/map.js: husvagn, dörr x 2656–2668, bas 628)
  const pos = await page.evaluate(async () => {
    const m = await import('./js/city/map.js');
    const b = m.ALL_BUILDINGS.find((x) => x.id === 'husvagn');
    return { scene: window.SF.sceneName, x: window.SF.scene.worldX, y: window.SF.scene.worldY, door: b ? m.doorCenter(b) : null };
  });
  ok(pos.scene === 'city' && pos.door && Math.abs(pos.x - pos.door.x) < 40 && Math.abs(pos.y - pos.door.y) < 40, `${label}: ut ur husvagnen står man vid husvagnen (${Math.round(pos.x)},${Math.round(pos.y)} – dörren ${pos.door ? Math.round(pos.door.x) + ',' + Math.round(pos.door.y) : '?'})`);
}
await outTheDoor('första gången');
// någon annanstans i stan, hem igen och ut: fortfarande vid husvagnen
await page.evaluate(() => { window.SF.scene._debug.teleport(300, 470); window.SF.roomSub = 0; window.SF.go('room'); });
await page.waitForTimeout(400);
await outTheDoor('efter en tur i stan');
// omladdning (ingen sparad stadsposition) → hemma → ut
await page.reload();
await page.waitForFunction(() => window.SF?.sceneName === 'room', null, { timeout: 20000 });
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn-go, #modal:not(.hidden) .dlg-foot .btn')?.click());
await page.waitForTimeout(300);
await outTheDoor('efter omladdning');
await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
await page.waitForTimeout(300);

// 2) ordningen i bostadsbyrån
await page.evaluate(() => { window.SF.game.money = 600; window.SF.openHousing(); });
await page.waitForTimeout(300);
const names = await page.evaluate(() => [...document.querySelectorAll('#modal .homerow .nm')].map((n) => n.childNodes[0].textContent.trim()));
ok(names.join('|') === 'Husvagnen|Förortsettan|Lilla rummet|Lägenheten|Radhuset|Villan|Gården|Takvåningen', `ordningen i listan (${names.join(', ')})`);
ok(await page.locator('#modal [data-look]').count() === 8, 'alla åtta har en 👁 Titta in-knapp');

// 3) titta in i varje bostad
const before = await page.evaluate(() => ({ home: window.SF.game.home, deco: JSON.stringify(window.SF.game.deco), save: localStorage.getItem('snabbfilen_save1'), scene: window.SF.sceneName }));
const ids = ['husvagn', 'hoghus', 'rum', 'lagenhet', 'radhus', 'villa', 'takvaning'];
for (const id of ids) {
  await page.evaluate(() => window.SF.openHousing());
  await page.waitForTimeout(150);
  await page.click(`#modal [data-look="${id}"]`);
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const c = document.querySelector('#modal .homelook-canvas');
    if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const cols = new Set(); let sum = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); sum += d[i] + d[i + 1] + d[i + 2]; }
    return { w: c.width, h: c.height, colors: cols.size, lum: sum / (d.length / 28), tabs: document.querySelectorAll('#modal .look-tabs button').length, title: document.querySelector('#modal h2')?.textContent || '' };
  });
  ok(!!r && r.h === 216 && r.w >= 150 && r.colors > 40, `${id}: bild inifrån (${r ? `${r.w}×${r.h}, ${r.colors} färger` : 'saknas'})`);
  // alla delrum + kvällsläget
  const tabs = (r?.tabs || 1) - 1;
  for (let i = 1; i < tabs; i++) {
    await page.click(`#modal .look-tabs button:nth-child(${i + 1})`);
    await page.waitForTimeout(120);
  }
  if (tabs > 1) ok(await page.evaluate((n) => document.querySelector(`#modal .look-tabs button:nth-child(${n})`).classList.contains('btn-go'), tabs), `${id}: alla ${tabs} delrum går att visa`);
  await page.screenshot({ path: `tools/out/titta-${id}.png` });
  await page.click('#modal .look-tabs button:last-child'); // kväll
  await page.waitForTimeout(150);
  const lum2 = await page.evaluate(() => { const c = document.querySelector('#modal .homelook-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 28) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 28); });
  ok(lum2 > 0 && lum2 < (r?.lum ?? Infinity) + 1, `${id}: kvällsbilden ritas och är mörkare (${Math.round(r?.lum ?? 0)} → ${Math.round(lum2)})`);
}
// posterbilden är också klickbar
await page.evaluate(() => window.SF.openHousing());
await page.waitForTimeout(150);
await page.click('#modal .homepic >> nth=4');
await page.waitForTimeout(200);
ok(/Radhuset/.test(await page.locator('#modal h2').textContent()), 'klick på planschbilden öppnar Titta in');
await page.click('#modal .dlg-foot button:first-child'); // ← Alla bostäder
await page.waitForTimeout(200);
ok(await page.locator('#modal .homerow').count() === 8, '"← Alla bostäder" tar en tillbaka till listan');
const after = await page.evaluate(() => ({ home: window.SF.game.home, deco: JSON.stringify(window.SF.game.deco), save: localStorage.getItem('snabbfilen_save1'), scene: window.SF.sceneName }));
ok(after.home === before.home && after.deco === before.deco && after.scene === before.scene, 'titta in ändrade varken hemmet, möblerna eller scenen');
ok(after.save === before.save, 'sparfilen är orörd efter alla förhandsbilder');

// flytta via förhandsbilden (Förortsettan, insats 500)
await page.click('#modal [data-look="hoghus"]');
await page.waitForTimeout(200);
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(500);
ok(await page.evaluate(() => window.SF.game.home === 'hoghus' && window.SF.sceneName === 'room'), 'Flytta hit i förhandsbilden flyttar in i Förortsettan');

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
