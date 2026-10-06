// Funktionstest av JULVÅNINGEN (klädaffären plan 3) och brasan hemma:
//   1. trappan från plan 2:s nya trapphall upp till plan 3 och ner igen (riktiga klick)
//   2. julpyntet: klick på en adventsstjärna → möbeldialogen → köp → förrådet; pyntet säljs
//      inte i möbelvaruhuset (shop: 'jul')
//   3. julkläderna: tomtedockan → köpdialogen → köp
//   4. brasan i butiken: marshmallowspelet – gyllenbrun ger mest lycka, en som brinner måste
//      blåsas ut, en bränd ger nästan ingen
//   5. hemma: en öppen spis i vardagsrummet – tänd brasan (sparas på möbeln), grilla, släck
//   6. de blinkande sakerna byter bildruta, och ljusen ritas i kvällsmörkret utan fel
//   node tools/julvaning-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_|404/.test(m.text()) && errs.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=jul${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Tomten', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 14 * 60, money: 20000, hunger: 60, energy: 90, home: 'villa', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(600);
const hideModal = () => page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden')) { m.classList.add('hidden'); m.innerHTML = ''; } });
await hideModal();
const D = (fn, ...a) => page.evaluate(([fn, a]) => { const v = window.SF.scene._debug[fn]; return typeof v === 'function' ? v(...a) : v; }, [fn, a]);
const until = async (fn, ms = 10000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(120); } return false; };
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalTitle = () => page.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const clickBtn = (txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('#modal .dlg-foot .btn')].find((x) => x.textContent.includes(t)); b?.click(); return !!b; }, txt);
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene').getBoundingClientRect(); const A = window.SF; return { l: c.left, t: c.top, w: c.width, h: c.height, lw: document.querySelector('#scene').width / A.pxs, lh: document.querySelector('#scene').height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
async function clickSpot(id) {
  let p = await D('spot', id);
  if (!p) throw new Error('ingen plats ' + id);
  const vw = await D('view');
  if (p.x < 4 || p.x > vw - 4) {
    const c = await D('cam');
    await D('lockCam', Math.max(0, c.x + p.x - vw / 2));
    p = await D('spot', id);
    await clickView(p.x, p.y);
    await D('lockCam', null);
    return;
  }
  await clickView(p.x, p.y);
}

// ---------- 1: trappan plan 2 → plan 3 → plan 2 ----------
await page.evaluate(() => { window.SF.game.event = null; window.SF.go('klader'); });
await page.waitForTimeout(400);
await D('goFloor', 2);
ok((await D('spots')).includes('trappa3'), 'plan 2 har trappan upp till julvåningen');
await clickSpot('trappa3');
ok(await until(() => window.SF.scene._debug.floor() === 3 && !window.SF.scene._debug.climb(), 25000), 'gick upp för trappan till plan 3');
const ws = await page.evaluate(() => window.SF.scene.worldY);
ok(ws >= 2000 && ws < 2300, `worldY på plan 3 är 2000 + y (${Math.round(ws)})`);
ok(/JUL/.test(await page.evaluate(() => document.querySelector('.toast')?.textContent || '')), 'skylten säger JULVÅNINGEN');
const spots3 = await D('spots');
for (const id of ['brasa', 'kassa', 'storgran', 'juldocka0', 'julhatt0', 'mod-julKlader', 'pynt-adventsstjarna0', 'pynt-ljusgran0', 'pynt-julspis0', 'pynt-kulgran0']) ok(spots3.includes(id), `plan 3 har ${id}`);

// ---------- 2: köp julpynt ----------
const money0 = await page.evaluate(() => window.SF.game.money);
await clickSpot('pynt-adventsstjarna0');
ok(await until(() => /Adventsstjärna/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 15000), 'klick på stjärnan → möbeldialogen');
await clickBtn('Köp');
ok(await until(() => window.SF.game.storage.some((s) => s.k === 'adventsstjarna')), 'stjärnan ligger i förrådet');
ok(await page.evaluate((m) => window.SF.game.money === m - 220, money0), 'stjärnan kostade 220 kr');
await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
const ikea = await page.evaluate(async () => { const K = await import('/js/scenes/ikea/kat.js'); return { jul: K.KAT().filter((k) => k.shop === 'jul').length, gran: !!K.katOf('julgran'), ljusgran: !!K.katOf('ljusgran') }; });
ok(ikea.jul === 0 && ikea.gran && !ikea.ljusgran, 'möbelvaruhuset ställer inte ut julvåningens pynt (vanliga julgranen finns kvar där)');

// ---------- 3: köp tomtejackan ----------
await clickSpot('juldocka0');
ok(await until(() => !document.querySelector('#modal').classList.contains('hidden'), 15000), 'tomtedockan → köpdialogen');
await clickBtn('Köp');
ok(await until(() => window.SF.game.wardrobe.includes('top-santa')), 'tomtejackan är köpt');
await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
await hideModal();

// ---------- 4: marshmallows vid brasan ----------
await clickSpot('brasa');
ok(await until(() => !!window.SF.marshmallow, 15000), 'brasan → marshmallowspelet');
const lycka0 = await page.evaluate(() => window.SF.game.lycka);
await page.evaluate(() => window.SF.marshmallow.toggle());
ok(await until(() => window.SF.marshmallow.lv > 0.05, 4000), 'i elden rostas marshmallowen');
await page.evaluate(() => { window.SF.marshmallow.lv = 0.7; window.SF.marshmallow.eat(); });
ok(await page.evaluate((l) => window.SF.game.lycka === Math.min(100, l + 5), lycka0), 'gyllenbrun: +5 lycka');
ok(await page.evaluate(() => window.SF.marshmallow.perfect === 1 && window.SF.marshmallow.lv === 0), 'en perfekt – och en ny vit på pinnen');
await page.evaluate(() => { window.SF.marshmallow.lv = 0.98; window.SF.marshmallow.toggle(); });
ok(await until(() => window.SF.marshmallow.burning, 4000), 'för länge i elden → den fattar eld');
ok(await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].some((b) => /Blås/.test(b.textContent) && b.style.display !== 'none')), 'Blås!-knappen syns');
await page.evaluate(() => window.SF.marshmallow.blow());
ok(await page.evaluate(() => !window.SF.marshmallow.burning), 'utblåst');
const l1 = await page.evaluate(() => window.SF.game.lycka);
await page.evaluate(() => window.SF.marshmallow.eat());
ok(await page.evaluate((l) => window.SF.game.lycka - l <= 1, l1), 'en bränd ger högst 1 lycka');
await page.evaluate(() => window.SF.marshmallow.stop());
ok(await until(() => document.querySelector('#modal').classList.contains('hidden') && !window.SF.marshmallow), 'Klar stänger spelet');

// ---------- 1b: ner igen ----------
await clickSpot('trappa');
ok(await until(() => window.SF.scene._debug.floor() === 2 && !window.SF.scene._debug.climb(), 25000), 'ner för trappan till plan 2');
const p2 = await D('pos');
ok(p2.x > 1270, `nere vid julvåningens trappa i plan 2 (x ${p2.x})`);

// ---------- 6: blinkande pynt ----------
const anim = await page.evaluate(async () => {
  const R = await import('/js/scenes/room.js');
  const a = R.furnArt('ljusgirlang', 0); await new Promise((r) => setTimeout(r, 700)); const b = R.furnArt('ljusgirlang', 0);
  const c = R.furnArt('adventsstjarna', 2);
  return { a: a && [a.sx, a.sy], b: b && [b.sx, b.sy], c: !!c };
});
ok(anim.a && anim.b && (anim.a[0] !== anim.b[0] || anim.a[1] !== anim.b[1]), 'den blinkande girlangen byter bildruta');
ok(anim.c, 'adventsstjärnan finns i atlasen');

// ---------- 5: brasan hemma ----------
await page.evaluate(() => { window.SF.go('room'); });
await page.waitForTimeout(500);
await hideModal();
const placed = await page.evaluate(() => {
  const g = window.SF.game;
  g.storage.push({ k: 'spis', v: 0 }); g.storage.push({ k: 'ljusgran', v: 0 });
  const dbg = window.SF.scene._debug;
  const tryPlace = (idx) => { dbg.pickStorage(idx); for (let y = 100; y < 200; y += 8) for (let x = 40; x < 340; x += 10) if (dbg.drop(x, y)) return true; dbg.store(); return false; };
  const a = tryPlace(g.storage.length - 2);
  const b = tryPlace(g.storage.findIndex((s) => s.k === 'ljusgran'));
  return a && b;
});
ok(placed, 'spisen och den blinkande granen står hemma');
const sp = await D('spot', 'spis');   // (villan har redan en spis – det är den som står först)
ok(!!sp, 'spisen är klickbar hemma (brasan)');
if (sp) {
  await page.evaluate(([x, y]) => window.SF.scene.down(window.SF.scene._debug.toScreen(x), y), [sp.x, sp.y]);   // (rummets koordinater → skärmen, toScreen)
  ok(await until(() => /Brasan/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 15000), 'framme vid spisen → Brasan');
  await clickBtn('Tänd brasan');
  ok(await until(() => Object.values(window.SF.game.deco).some((l) => Array.isArray(l) && l.some((d) => d.k === 'spis' && d.lit))), 'brasan är tänd (sparad på möbeln)');
  await page.waitForTimeout(400);
  await page.evaluate(([x, y]) => window.SF.scene.down(window.SF.scene._debug.toScreen(x), y), [sp.x, sp.y]);   // (rummets koordinater → skärmen, toScreen)
  ok(await until(() => /Brasan brinner/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 15000), 'en tänd brasa: Grilla eller Släck');
  await clickBtn('Grilla');
  ok(await until(() => !!window.SF.marshmallow, 5000), 'grilla hemma');
  await page.evaluate(() => window.SF.marshmallow.stop());
  // kvällen: ljusen ritas ovanpå mörkret
  await page.evaluate(() => { window.SF.game.min = 21 * 60; });
  await page.waitForTimeout(800);
  await page.evaluate(([x, y]) => window.SF.scene.down(window.SF.scene._debug.toScreen(x), y), [sp.x, sp.y]);   // (rummets koordinater → skärmen, toScreen)
  await until(() => /Brasan brinner/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 15000);
  await clickBtn('Släck');
  ok(await until(() => !Object.values(window.SF.game.deco).some((l) => Array.isArray(l) && l.some((d) => d.k === 'spis' && d.lit))), 'brasan är släckt');
}
ok(errs.length === 0, 'inga fel i konsolen' + (errs.length ? ' – ' + errs.slice(0, 3).join(' | ') : ''));
if (process.argv.includes('--shots')) await page.screenshot({ path: process.argv[process.argv.indexOf('--shots') + 1] + '/jul-hemma.png' });
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
