// Ett helt däckbyte med riktiga klick och riktig gång (scene.down/up på
// _debug.spot-punkter), plus felen: för snabbt klick, fel hjul, fel däck, för
// mycket luft (PANG) och för lite luft.   node tools/verkstad-dack-test.mjs [bay=2]  (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const BAY = +(process.argv[2] ?? 2);
const OUT = 'tools/out/verkstad/';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/buildings-|stadsmodulen|city\.js/.test(m.text()) && errs.push(m.text()));
await page.goto(`http://localhost:${process.env.SMOKE_PORT || process.env.VPORT || 8788}/index.html?world=klick${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Snap', look: { skin: '#e0a97f', hair: '#3b2619', style: 'short', shirt: '#d9433b', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  localStorage.removeItem('snabbfilen_verkstad_tips');
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await page.waitForTimeout(300);
await page.evaluate(() => { window.SF.game.min = 12 * 60; window.SF.go('jobbverkstad', { onDone: (s) => (window.__done = s) }); });
await page.waitForTimeout(200);
const D = (fn, arg) => page.evaluate(([f, a]) => { const d = window.SF.scene._debug; return new Function('d', 'a', 's', 'return (' + f + ')(d, a, s)')(d, a, window.SF.scene); }, [fn.toString(), arg]);
await D((d) => { d.autoCars(false); });
const snap = async (name) => { const url = await page.evaluate(() => document.querySelector('#scene').toDataURL('image/png')); fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64')); };
const sleep = (ms) => page.waitForTimeout(ms);
async function waitFor(fn, arg, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D(fn, arg)) return true; await sleep(60); } return false; }
const click = (id) => D((d, id, s) => { const p = d.spot(id); if (!p) return null; s.down(p.x, p.y); s.up(); return p; }, id);
const idle = () => waitFor((d) => d.idle());
const tire = () => D((d, b) => d.tire(b), BAY);
const stats = () => D((d) => ({ ...d.stats }));
const B = BAY;

// 1. bilen kör in och ställer sig på lyften
await D((d, b) => d.forceCar(b % 2 ? 'sedan' : 'kombi', { bay: b, wheel: b % 2 ? 1 : 0, tire: 'sommar', drive: true }), B);
ok(await waitFor((d, b) => d.tire(b)?.state === 'park', B, 12000), 'bilen körde in och står på lyften');
await click(`hjul:${B}`); await idle();
ok((await tire()).state === 'park', 'klick på hjulet innan lyften är uppe gör inget');
// 2. hissa med panelen
await click(`panel:${B}`);
ok(await waitFor((d, b) => d.tire(b)?.state === 'wait', B), 'panelen: lyften gick upp');
await snap('k1-uppe');
// 3. skruvdragaren
await click('skruvdragare');
ok(await waitFor((d) => d.carrying() === 'skruvdragare'), 'hämtade skruvdragaren på vagnen');
// fel hjul: klicka på det andra hjulet med skruvdragaren
const fel0 = (await stats()).fel;
await click(`hjul:${B}:${B % 2 ? 'bak' : 'fram'}`); await idle(); await sleep(100);
ok((await stats()).fel === fel0 + 1, 'skruva på fel hjul ger fel');
// 4. skruvarna ut: gå till hjulet (första skruven startar), klicka resten en i taget
await click(`hjul:${B}`); await idle(); await sleep(80);
ok(!!(await tire()).spin, 'vid hjulet: första skruven snurrar');
await snap('k2-skruvar');
const fel1 = (await stats()).fel;
await click(`bult:${B}:2`); await sleep(50);                              // för snabbt
ok((await stats()).fel === fel1 + 1, 'klick medan skruven snurrar = FÖR SNABBT (fel)');
for (let i = 0; i < 12 && (await tire()).bolts.some(Boolean); i++) {
  await waitFor((d, b) => !d.tire(b).spin, B, 2000);
  const k = (await tire()).bolts.findIndex(Boolean);
  if (k >= 0) await click(`bult:${B}:${k}`);
  await sleep(80);
}
await waitFor((d, b) => !d.tire(b).spin, B, 2000);
ok((await tire()).bolts.every((b) => !b), 'alla skruvar ute');
// 5. däcket av → stapeln
await click(`hjul:${B}`); await idle();
ok(await waitFor((d) => /^gammalt:/.test(d.carrying() || '')), 'bär det gamla däcket');
ok((await D((d) => d.wrenches().some((w) => w.at === 'floor'))), 'skruvdragaren lades på golvet');
await snap('k3-bar-gammalt');
const piles0 = await D((d) => d.piles());
await click('stapel');
ok(await waitFor((d) => d.carrying() === null), 'det gamla däcket ligger i stapeln');
ok((await D((d) => d.piles())).reduce((a, v) => a + v, 0) === piles0.reduce((a, v) => a + v, 0) + 1, 'stapeln växte');
// 6. fel däck först, sedan rätt
await click('dack:vinter');
ok(await waitFor((d) => d.carrying() === 'hjul:vinter'), 'tog ett vinterdäck (fel sort)');
const fel2 = (await stats()).fel;
await click(`hjul:${B}`); await idle(); await sleep(100);
ok((await stats()).fel === fel2 + 1 && (await tire()).tire === 'off', 'fel sort på hjulet = FEL DÄCK');
await click('dack:vinter'); await waitFor((d) => d.carrying() === null);   // tillbaka
await click('dack:sommar');
ok(await waitFor((d) => d.carrying() === 'hjul:sommar'), 'tog ett sommardäck');
await snap('k4-bar-nytt');
await click(`hjul:${B}`); await idle(); await sleep(80);
ok((await tire()).tire === 'new', 'nya däcket sitter på navet');
// 7. skruvdragaren igen (på golvet) och skruva fast i kryssmönster
await click('skruvdragare');
ok(await waitFor((d) => d.carrying() === 'skruvdragare'), 'tog skruvdragaren från golvet');
await click(`hjul:${B}`); await idle(); await sleep(80);
const first = (await tire()).spin?.i ?? -1;
const n = (await tire()).n, order = n === 4 ? [0, 2, 1, 3] : [0, 2, 4, 1, 3];
const start = order.indexOf(first) >= 0 ? order.indexOf(first) : 0;
for (let m = 1; m < n; m++) {
  await waitFor((d, b) => !d.tire(b).spin, B, 2000);
  await click(`bult:${B}:${order[(start + m) % n]}`);
  await sleep(60);
}
await waitFor((d, b) => d.tire(b).bolts.every(Boolean) && !d.tire(b).spin, B, 3000);
const st7 = await stats();
ok((await tire()).bolts.every(Boolean), 'alla skruvar i');
ok(st7.kryss === 1, `kryssmönster gav bonus (kryss ${st7.kryss}, ordning ${(await tire()).order})`);
// 8. luftslangen: håll in för länge = PANG, sedan lagom
await click('kompressor');
ok(await waitFor((d) => d.carrying() === 'slang'), 'tog luftslangen vid kompressorn');
const fel3 = (await stats()).fel;
let p = await D((d, b, s) => { const q = d.spot('hjul:' + b); s.down(q.x, q.y); return q; }, B);
await idle();
await waitFor((d, b) => d.tire(b).air > 0.5, B, 5000); await snap('k5-luft');
await waitFor((d, b) => d.tire(b).air === 0 || d.tire(b).air > 0.99, B, 5000);
await sleep(200);
ok((await stats()).fel >= fel3 + 1 && (await tire()).air < 0.2, 'för mycket luft: PANG (fel) och däcket tömdes');
await D((d, a, s) => s.up());
// för lite: fyll lite och släpp
await D((d, b, s) => { const q = d.spot('hjul:' + b); s.down(q.x, q.y); }, B);
await waitFor((d, b) => d.tire(b).air > 0.3, B, 4000);
await D((d, a, s) => s.up());
ok(!(await tire()).aired, 'för lite luft: inte klart än');
await D((d, b, s) => { const q = d.spot('hjul:' + b); s.down(q.x, q.y); }, B);
await waitFor((d, b) => d.tire(b).air >= 0.7, B, 4000);
await D((d, a, s) => s.up());
await sleep(100);
ok((await tire()).aired && (await tire()).state === 'ready', `lagom luft: klart (${(await tire()).air})`);
await snap('k6-klar');
// 9. sänk
const ok0 = (await stats()).ok;
await click(`panel:${B}`);
ok(await waitFor((d) => d.stats.dack === 1), 'sänkte lyften: kunden betalade');
ok((await stats()).ok >= ok0 + 3, 'däckbytet gav +3');
ok(await waitFor((d, b) => !d.cars().some((c) => c.bay === b), B, 9000), 'bilen körde ut');
await snap('k7-ut');
console.log('stats', JSON.stringify(await stats()), 'speltid', (await D((d) => d.time())).toFixed(1), 's');
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
ok(!errs.length, 'inga konsolfel');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
