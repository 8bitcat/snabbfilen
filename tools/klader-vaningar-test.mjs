// Två spelare i klädaffären (riktiga PeerJS-molnet, egen privat värld): när A byter våning
// ska B, som står på plan 2, inte se A glida in genom taket eller ut genom golvet (worldY
// hoppar ±1000 mellan våningarna). Med world.js-patchen (tx/ty i worldFolksHere) dyker A upp
// direkt på sin plats; utan den göms A under glidningen och syns när farten är nere.
//   PORT=8758 node tools/klader-vaningar-test.mjs   (servern: python -m http.server <port> --bind 127.0.0.1)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const WORLD = 'klfl' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?world=${WORLD}&nettest=1`;
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEL  ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
async function player(name, color) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 560 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`[${name}] ${e.message}`));
  await page.goto(URL);
  await page.evaluate(([n, c]) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: n, look: { skin: '#eabf98', shirt: c }, color: c }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, [name, color]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
  await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
  return page;
}
const keep = (pages) => setInterval(() => { for (const p of pages) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);
const A = await player('Anna', '#d9433b');
await sleep(2500);
const B = await player('Bosse', '#3a7bd5');
const iv = keep([A, B]);
// vänta tills de ser varandra
let seen = false;
for (let i = 0; i < 60 && !seen; i++) { seen = await B.evaluate(() => (window.SF.worldInfo?.().players || window.SF.worldInfo?.().n || 0) > 0).catch(() => false); if (!seen) await sleep(500); }
const info = await B.evaluate(() => window.SF.worldInfo?.());
console.log('världen', JSON.stringify(info).slice(0, 200));
await A.evaluate(() => window.SF.go('klader'));
await B.evaluate(() => { window.SF.go('klader'); window.SF.scene._debug.goFloor(2); window.SF.scene._debug.teleport(760, 160); });
await sleep(3000);
const Bf = () => B.evaluate(() => window.SF.scene._debug.folks());
ok((await Bf()).length === 0, 'B på plan 2 ser inte A (som är på plan 1)');
// A går upp: B samplar A:s y var 40 ms i 3 s
await A.evaluate(() => window.SF.scene._debug.goFloor(2));
const ys = [];
for (let i = 0; i < 75; i++) { const f = await Bf(); if (f.length) ys.push(f[0].y); await sleep(40); }
const aY = await A.evaluate(() => window.SF.scene._debug.pos().y);
console.log('A på plan 2, y =', aY, ' B såg y:', ys.join(','));
ok(ys.length > 0, 'B ser A när A kommit upp på plan 2');
ok(ys.length > 0 && Math.min(...ys) >= aY - 25, `A glider inte in från taket (lägsta y B såg: ${ys.length ? Math.min(...ys) : '-'}, A står på ${aY})`);
// A går ner igen: A ska försvinna direkt, inte glida ut genom golvet
await A.evaluate(() => window.SF.scene._debug.goFloor(1));
const ys2 = [];
for (let i = 0; i < 50; i++) { const f = await Bf(); if (f.length) ys2.push(f[0].y); await sleep(40); }
console.log('A tillbaka på plan 1 – B såg y:', ys2.join(','));
ok(ys2.every((y) => y <= aY + 25), `A glider inte ut genom golvet (högsta y B såg: ${ys2.length ? Math.max(...ys2) : '-'})`);
clearInterval(iv);
console.log(errs.length ? 'SIDFEL: ' + errs.join(' | ') : 'inga sidfel');
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
await browser.close();
process.exit(fails ? 1 : 0);
