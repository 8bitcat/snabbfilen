// 🏛️ MUSEET i Gamla stan (js/scenes/museum.js + js/gamlastan/museum-inne.js) och ☕ Gamla kaféet:
//   1. museets dörr: stängt på kvällen; på dagen → scenen museum vid dörren
//   2. platserna finns; föremålen berättar och räknas som sedda; tre klick på skelettet → vakten säger ifrån
//   3. Malte vill ha tre sedda föremål innan quizet; sedan tre frågor – alla rätt ger MUSEIDIPLOM och +1 utbildningspoäng, bara en gång om dagen
//   4. ut → man står vid museets dörr i Gamla stan; kaféet säljer kanelbullar
//   5. inga fel i sidan
//   node tools/museum-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=mus${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Musei', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 200, hunger: 40, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.evaluate(() => { window.__toasts = []; const T = document.querySelector('#toasts'); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push(n.textContent)))).observe(T, { childList: true }); });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const toasts = () => D(() => window.__toasts.splice(0));
await stang(); await D(() => { SF.gamlaFran = { buss: 'pixeltorget' }; SF.go('gamlastan'); }); await sleep(1800); await stang();

// 1. dörren
await D(() => { SF.game.min = 19 * 60; }); await D(() => SF.scene._debug.act('museum')); await sleep(400);
ok((await D(() => SF.sceneName)) === 'gamlastan' && (await toasts()).some((t) => /Museet har öppet/.test(t)), 'på kvällen är museet stängt');
await D(() => { SF.game.min = 13 * 60; }); await D(() => SF.scene._debug.act('museum'));
const inne = await p.waitForFunction(() => window.SF.sceneName === 'museum' && !!window.SF.scene?._debug?.sett, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(inne, 'museets dörr → scenen museum');
const pos0 = await D(() => SF.scene._debug.pos());
ok(pos0.x < 60 && pos0.y > 70 && pos0.y < 100, `man står innanför dörren (${Math.round(pos0.x)}, ${Math.round(pos0.y)})`);

// 2. föremålen
const spots = await D(() => SF.scene._debug.spots());
ok(['ut', 'disk', 'tavlor', 'krona', 'buss', 'sko', 'dino', 'fyr', 'kista', 'vakt'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);
await D(() => SF.scene._debug.act('disk')); await sleep(600);
ok(/föremål till|Välkommen/.test((await D(() => SF.scene._debug.prat())) || ''), 'Malte vill ha tre sedda föremål först');
await D(() => SF.scene._debug.act('krona')); await sleep(300);
ok((await toasts()).some((t) => /skatas bo/.test(t)) && (await D(() => SF.scene._debug.sett())).includes('krona'), 'kronan: skylten läses upp och räknas som sedd');
await D(() => SF.scene._debug.act('buss')); await sleep(200);
await D(() => SF.scene._debug.act('dino')); await sleep(600);
ok((await D(() => SF.scene._debug.sett())).length === 3 && /Tre föremål/.test((await D(() => SF.scene._debug.prat())) || ''), 'tre sedda → Malte ropar om quizet');
await D(() => SF.scene._debug.act('dino')); await D(() => SF.scene._debug.act('dino')); await sleep(400);
ok(/RÖR INTE/.test((await D(() => SF.scene._debug.prat())) || ''), 'tre klick på skelettet → Vera säger ifrån');

// 3. quizet
const p0 = await D(() => SF.game.las.poang);
await D(() => SF.scene._debug.act('disk')); await sleep(400);
ok(/Museiquizet/.test(await modal()), 'Malte erbjuder quizet');
await D(() => document.querySelector('#modal:not(.hidden) .btn-go')?.click()); await sleep(500);
for (let k = 0; k < 3; k++) {
  const fr = await D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
  ok(new RegExp(`Fråga ${k + 1} av 3`).test(fr), `fråga ${k + 1} visas (${fr})`);
  await D(() => document.querySelector('#modal:not(.hidden) [data-ratt="1"]')?.click()); await sleep(700);
}
await sleep(400);
const ts = await toasts();
ok(ts.some((t) => /MUSEIDIPLOM/.test(t)) && (await D(() => SF.game.las.poang)) === p0 + 1 && (await D(() => SF.game.las.museumDag)) === 5, `alla rätt → MUSEIDIPLOM och +1 utbildningspoäng (${p0} → ${await D(() => SF.game.las.poang)})`);
await D(() => SF.scene._debug.act('disk')); await sleep(300);
await D(() => document.querySelector('#modal:not(.hidden) .btn-go')?.click()); await sleep(500);
for (let k = 0; k < 3; k++) { await D(() => document.querySelector('#modal:not(.hidden) [data-ratt="1"]')?.click()); await sleep(700); }
await sleep(400);
ok((await D(() => SF.game.las.poang)) === p0 + 1 && (await toasts()).some((t) => /redan/.test(t)), 'diplomet bara en gång om dagen');
await D(() => { SF.game.min = 13 * 60; });

// 4. ut och kaféet
await D(() => SF.scene._debug.act('ut'));
const ute = await p.waitForFunction(() => window.SF.sceneName === 'gamlastan' && !!window.SF.scene?._debug?.pos, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1200);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: 0, y: 0 };
ok(ute && Math.abs(pos.x - 782) < 30, `ut → vid museets dörr i Gamla stan (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
await D(() => SF.scene._debug.act('kafe')); await sleep(400);
ok(/Gamla kaféet/.test(await modal()) && /Kanelbulle/.test(await modal()), 'kaféet: menyn med kanelbullar');
const m0 = await D(() => SF.game.money), h0 = await D(() => SF.game.hunger);
await D(() => document.querySelector('#modal [data-vara="bulle"]')?.click()); await sleep(400);
ok((await D(() => SF.game.money)) === m0 - 25 && (await D(() => SF.game.hunger)) >= h0 + 10, 'kanelbullen kostar 25 kr och mättar');
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
