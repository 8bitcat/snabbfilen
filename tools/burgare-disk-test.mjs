// Diskfixen: aldrig två tallrikar på samma plats, köket fyller alla sex och
// respekterar spelarens reservation, upptagen plats = byta, ledig = ställa ner
// (närmaste lediga, generöst klick), full disk = FULLT-besked och rätten behålls.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const PORT = process.env.SMOKE_PORT || '8788';
await p.goto('http://localhost:' + PORT + '/index.html?nomenu&world=dsk' + Math.random().toString(36).slice(2, 6));
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'kalle', name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { burgare: 2 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.evaluate(() => SF.go('jobbburgare', { onDone: () => SF.go('city') }));
await p.waitForFunction(() => SF.scene?._debug?.plates, null, { timeout: 10000 });

const r = await p.evaluate(() => {
  const D = SF.scene._debug;
  for (let i = 0; i < 9; i++) D.forcePlate(i % 4);
  const pl = D.plates();
  return { n: pl.length, unika: new Set(pl.map((x) => x.slot)).size };
});
ok(r.n === 6 && r.unika === 6, `nio försök ger exakt sex tallrikar på sex OLIKA platser (${r.n} st, ${r.unika} unika)`);

const r2 = await p.evaluate(async () => {
  const D = SF.scene._debug;
  D.pickPlate(0); // bär rätt 0
  const spot = D.counterSpot(1); // UPPTAGEN plats: ska BYTA, aldrig stapla
  SF.scene.down(spot.x, spot.y - 8);
  for (let i = 0; i < 14 && D.carrying() === 0; i++) await new Promise((res) => setTimeout(res, 400));
  const pl = D.plates();
  return { unika: new Set(pl.map((x) => x.slot)).size === pl.length, carry: D.carrying() };
});
ok(r2.unika && r2.carry === 1, `upptagen plats = byta rätt, aldrig stapla (bär nu rätt ${r2.carry})`);

const r2b = await p.evaluate(async () => {
  const D = SF.scene._debug;
  D.pickPlate(0);
  const taken = new Set(D.plates().map((x) => x.slot));
  let freeI = 0;
  for (let i = 0; i < 6; i++) if (!taken.has(i)) freeI = i;
  const target = D.counterSpot(freeI);
  SF.scene.down(target.x + 9, target.y - 8); // 9 px snett – ska ändå ta närmaste LEDIGA
  for (let i = 0; i < 14 && D.carrying() !== null; i++) await new Promise((res) => setTimeout(res, 400));
  const pl = D.plates();
  return { n: pl.length, unika: new Set(pl.map((x) => x.slot)).size, carry: D.carrying() };
});
ok(r2b.n === r2b.unika && r2b.carry === null, `nedställning tar närmaste LEDIGA plats, reserverad under gången (${r2b.n} st unika, bär: ${r2b.carry})`);

const r3 = await p.evaluate(async () => {
  const D = SF.scene._debug;
  D.pickPlate(0);
  D.forcePlate(1); // disken full igen, jag bär en rätt
  const spot = D.counterSpot(2);
  SF.scene.down(spot.x + 14, spot.y - 8); // mellan platserna, allt fullt → FULLT-besked
  await new Promise((res) => setTimeout(res, 600));
  return { n: D.plates().length, carry: D.carrying() };
});
ok(r3.n === 6 && r3.carry !== null, `full disk: rätten behålls i händerna med FULLT-besked (${r3.n} st, bär: ${r3.carry})`);
await p.screenshot({ path: 'tools/out/disk-full.png', clip: { x: 0, y: 40, width: 640, height: 260 } });
console.log(errs.length ? 'KONSOLFEL: ' + errs.join(' | ') : 'Inga konsolfel.');
ok(errs.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? fails + ' FEL' : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
