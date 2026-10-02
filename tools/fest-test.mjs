// Funktionstest av FESTEN HEMMA (js/core/fest.js, room.js pyntet/gästerna/skräpet, main.js 🎉-knappen):
//   1. 🎉-knappen syns hemma; dialogen: storlek (bostaden sätter taket), mat, pris
//   2. festen börjar: pengarna dras, gästerna kommer in genom dörren och dansar, festlåten spelar
//   3. prata med en gäst; lyckan stiger under festen
//   4. avsluta festen: gästerna går hem och lämnar skräp – städa upp det
//   5. en fest om dagen, inte för sent, inte för dyrt; Lilla rummet rymmer bara en liten fest
//   6. går man hemifrån eller somnar tar festen slut; festdagen sparas
//   node tools/fest-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'fest') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = (extra = {}) => ({ v: 1, day: 3, min: 15 * 60, money: 2000, hunger: 50, energy: 90, home: 'villa', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, ...extra });
const start = async (save) => {
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fe${Date.now().toString(36)}`);
  await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Festis', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, save);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(700);
};
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const modalTitle = () => D(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
const modalText = () => D(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const toasts = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '));
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
const fest = () => D(() => SF.scene._debug.fest());
const hudFest = () => D(() => { const b = document.getElementById('hud-fest'); return b ? { hidden: b.classList.contains('hidden'), txt: b.textContent } : null; });

// ---------- 1. dialogen ----------
await start(SAVE());
await p.mouse.click(600, 700); await sleep(300);   // (ljudet får starta efter en pekning)
let h = await hudFest();
ok(h && !h.hidden && h.txt === '🎉', `🎉-knappen syns hemma (${JSON.stringify(h)})`);
await p.click('#hud-fest');
ok(await until(() => /Ha fest hemma/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'dialogen: Ha fest hemma!');
ok((await D(() => [...document.querySelectorAll('#modal [data-n]')].map((b) => b.dataset.n).join(','))) === '3,5,8', 'villan rymmer liten fest, fest och storfest (10 gäster)');
ok((await D(() => document.querySelectorAll('#modal [data-m]').length)) === 3, 'tre sorters festmat');
await D(() => document.querySelector('#modal [data-n="5"]').click()); await sleep(100);
await D(() => document.querySelector('#modal [data-m="pizza"]').click()); await sleep(100);
ok(/festen kostar\s225\skr/.test(await modalText()), 'fem gäster med pizza: 225 kr');
// ---------- 2. festen ----------
const m0 = await D(() => SF.game.money), gl0 = await D(() => SF.game.lycka), hu0 = await D(() => SF.game.hunger);
ok(await clickBtn(/Starta festen/), 'Starta festen');
await sleep(300);
ok((await D(() => SF.game.money)) === m0 - 225 && (await D(() => !!SF.fest)), 'festen har börjat – 225 kr');
ok((await D(() => SF.game.hunger)) > hu0 && (await D(() => SF.game.lycka)) > gl0, 'pizzan mättar och festen gör en glad');
ok(/Festen har börjat/.test(await toasts()), 'besked: Festen har börjat!');
ok(await until(() => SF.scene._debug.fest().gaster.filter((s) => s === 'dans' || s === 'mat').length >= 4, 20000), `gästerna kommer in och dansar (${(await fest()).gaster.join(',')})`);
ok((await hudFest()).txt === '🥳', 'knappen visar 🥳 under festen');
ok(await until(async () => { const m = await import('./js/core/music.js'); return m.musicStats().want === 'jukebox'; }), 'festlåten (jukeboxen) spelar');
ok(!!(await fest()).table, 'festbordet står framme');
await shot('01-fest');
// prata med en gäst
const gl1 = await D(() => SF.game.lycka);
const gpos = await D(() => { const F = SF.fest; const q = F.gaster.find((g) => g.state === 'dans' && !g.path.length); return q ? { x: SF.scene._debug.toScreen(q.x), y: q.y - 16 } : null; });
if (gpos) { await D((g) => SF.scene.down(g.x, g.y), gpos); }
ok(await until(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /😊/.test(t.textContent)) , 9000) || (await D(() => SF.game.lycka)) > gl1, 'prata med en gäst: hon/han presenterar sig och man blir gladare');
// ---------- 4. avsluta, skräpet ----------
await p.click('#hud-fest');
ok(await until(() => /Festen pågår/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'under festen: knappen frågar om man vill avsluta');
await clickBtn(/Avsluta festen/);
ok(await until(() => !SF.fest, 25000), 'gästerna går hem och festen tar slut');
ok(/Festen är slut/.test(await toasts()), 'besked: Festen är slut!');
const mess = await D(() => SF.scene._debug.festMess());   // (rummets koordinater – klicken går via lägenhetens kamera, toScreen)
ok(mess.length >= 1, `skräp på golvet efter festen (${mess.length} st)`);
ok((await hudFest()).txt === '🎉', 'knappen visar 🎉 igen');
await shot('02-skrapet');
for (const m of mess) {
  const n = await D(() => SF.scene._debug.festMess().length);
  await D((m) => SF.scene.down(SF.scene._debug.toScreen(m.x), m.y - 2), m);
  await until((n) => SF.scene._debug.festMess().length < n, 8000, n);
}
ok((await D(() => SF.scene._debug.festMess().length)) === 0 && /Rent och fint/.test(await toasts()), 'allt skräp städat: Rent och fint igen!');
// ---------- 5. reglerna ----------
let r = await D(async () => { const F = await import('./js/core/fest.js'); return F.startFest(SF, { n: 3 }); });
ok(!r.ok && /redan haft fest i dag/.test(r.msg), 'en fest om dagen');
await D(() => { SF.game.day++; SF.game.min = 21 * 60; });
r = await D(async () => { const F = await import('./js/core/fest.js'); return F.startFest(SF, { n: 3 }); });
ok(!r.ok && /för sent/.test(r.msg), 'kl 21: för sent för fest');
await D(() => { SF.game.min = 12 * 60; SF.game.money = 30; });
r = await D(async () => { const F = await import('./js/core/fest.js'); return F.startFest(SF, { n: 3, mat: 'tarta' }); });
ok(!r.ok && /inte råd/.test(r.msg), 'för lite pengar: ingen fest');
await D(() => { SF.game.money = 2000; SF.game.save(); });
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await sleep(500);
ok((await D(() => SF.game.festDag)) === 3 && (await D(() => SF.game.fester)) === 1, 'festdagen och antalet fester sparas');
// går man ut tar festen slut
r = await D(async () => { const F = await import('./js/core/fest.js'); return F.startFest(SF, { n: 3 }); });
ok(r.ok, 'ny dag: ny fest');
await D(() => { const s = SF.scene._debug.spot('dorr'); SF.scene.down(s.x, s.y); });
ok(await until(() => SF.sceneName === 'city' || !!document.querySelector('#modal:not(.hidden)'), 10000), 'ut genom dörren');
if (await D(() => !!document.querySelector('#modal:not(.hidden)'))) await clickBtn(/Ut i stan/);
ok(await until(() => !SF.fest, 8000) && /gick hem när du gick ut/.test(await toasts()), 'gästerna går hem när man går ut');
// Lilla rummet: bara en liten fest
await start(SAVE({ home: 'rum' }));
await p.click('#hud-fest');
await until(() => !!document.querySelector('#modal [data-n]'));
ok((await D(() => [...document.querySelectorAll('#modal [data-n]')].map((b) => b.dataset.n).join(','))) === '3', 'Lilla rummet: bara en liten fest (3 gäster)');
await clickBtn(/Inte nu/);
// somnar man tar festen slut
r = await D(async () => { const F = await import('./js/core/fest.js'); return F.startFest(SF, { n: 3 }); });
await D(() => { SF.game.min = 19 * 60; });
await D(() => { const s = SF.scene._debug.spot('sang'); SF.scene.down(s.x, s.y); });
await until(() => !!document.querySelector('#modal:not(.hidden)'), 9000);
await clickBtn(/Sov/);
ok(await until(() => !SF.fest, 8000), 'man lägger sig: festen tar slut');
await D(() => SF.scene.key?.(' '));

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
