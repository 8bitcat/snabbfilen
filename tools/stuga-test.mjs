// 🏡 RÖDA STUGAN på Solön (js/scenes/stuga.js + js/solon/stuga-inne.js):
//   1. Röda stugans dörr på Solön frågar om hyran (150 kr) – betalar man kommer man in; de andra stugorna är uthyrda
//   2. platserna finns; kaminen piggar upp (en gång om dagen), kaffet mättar (en gång), gästboken och dagboken läses
//   3. sängen: Sova-rutan → natten spelas i stugan → ny dag 07:00, man är kvar i stugan, veckorutan kommer
//   4. nyckeln gäller morgonen efter (gå ut och in utan att betala), men inte nästa kväll
//   5. UT → Solön framför röda stugan; inga fel i sidan
//   node tools/stuga-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=stuga${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Stugan', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 19 * 60, money: 500, hunger: 60, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.evaluate(() => { window.__toasts = []; const T = document.querySelector('#toasts'); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push(n.textContent)))).observe(T, { childList: true }); });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const toasts = () => D(() => window.__toasts.splice(0));
const klickGo = () => D(() => { const b = document.querySelector('#modal:not(.hidden) .btn-go'); if (!b) return false; b.click(); return true; });
const inne = () => p.waitForFunction(() => window.SF.sceneName === 'stuga' && !!window.SF.scene?._debug?.sover, null, { timeout: 15000 }).then(() => true).catch(() => false);
await stang(); await D(() => { SF.solonFran = { farja: true }; SF.go('solon'); }); await sleep(1800); await stang();

// 1. dörren och hyran
ok(!!(await D(() => SF.scene._debug.spot('stuga-rod'))) && !!(await D(() => SF.scene._debug.spot('stuga-gul'))), 'stugorna finns på Solön');
await D(() => SF.scene._debug.act('stuga-gul')); await sleep(300);
ok((await toasts()).some((t) => /Uthyrd hela sommaren/.test(t)), 'gula stugan är uthyrd');
await D(() => SF.scene._debug.act('stuga-rod')); await sleep(300);
ok(/Röda stugan/.test(await modal()) && /150 kr/.test(await modal()), 'röda stugan frågar om hyran (150 kr)');
const m0 = await D(() => SF.game.money);
await klickGo();
ok(await inne(), 'man kommer in i stugan');
await sleep(800);
ok((await D(() => SF.game.money)) === m0 - 150 && (await D(() => SF.game.stugaHyrd())), 'hyran dragen, nyckeln gäller');

// 2. platserna, kaminen, kaffet, böckerna
const spots = await D(() => SF.scene._debug.spots());
ok(['ut', 'sang', 'kamin', 'bord', 'gastbok', 'veranda', 'fonster', 'bokhylla', 'gungstol', 'hylla'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);
const e0 = await D(() => SF.game.energy);
await D(() => SF.scene._debug.act('kamin')); await sleep(300);
ok((await D(() => SF.game.energy)) === Math.min(100, e0 + 6) && (await toasts()).some((t) => /vedträ/.test(t)), 'kaminen piggar upp (+6)');
await D(() => SF.scene._debug.act('kamin')); await sleep(300);
ok((await D(() => SF.game.energy)) === Math.min(100, e0 + 6), 'bara en gång om dagen');
const h0 = await D(() => SF.game.hunger);
await D(() => SF.scene._debug.act('bord')); await sleep(300);
const h1 = await D(() => SF.game.hunger);
ok(h1 >= Math.min(100, h0 + 10) && (await toasts()).some((t) => /Kaffe ur pannan/.test(t)), `kaffe och bulle mättar (+12: ${Math.round(h0)} → ${Math.round(h1)})`);
await D(() => SF.scene._debug.act('gastbok')); await sleep(300);
ok(/–/.test(await D(() => SF.scene._debug.prat()) || ''), 'gästboken läses');
await D(() => SF.scene._debug.act('bokhylla')); await sleep(300);
ok(/Huldas dagbok/.test(await D(() => SF.scene._debug.prat()) || ''), 'Huldas dagbok läses');
await D(() => SF.scene._debug.act('veranda')); await sleep(300);
ok((await toasts()).some((t) => /verandan/.test(t)), 'verandan');

// 3. natten
const d0 = await D(() => SF.game.day);
await D(() => SF.scene._debug.act('sang')); await sleep(300);
ok(/Sova/.test(await modal()), 'sängen frågar om man vill sova');
await klickGo(); await sleep(300);
ok(await D(() => SF.scene._debug.sover()), 'natten spelas i stugan');
await D(() => SF.scene._debug.natt());
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden)'), null, { timeout: 8000 }).catch(() => {});
await sleep(400);
ok((await D(() => SF.game.day)) === d0 + 1 && (await D(() => SF.game.min)) === 7 * 60 && (await D(() => SF.sceneName)) === 'stuga', 'ny dag 07:00 – man vaknar i stugan');
ok(!!(await D(() => document.querySelector('#modal:not(.hidden)'))), 'veckorutan kommer på morgonen');
await stang(); await sleep(900);
ok((await toasts()).some((t) => /God morgon/.test(t)), 'god morgon-hälsningen');

// 4. nyckeln gäller morgonen, inte nästa kväll
ok(await D(() => SF.game.stugaHyrd()), 'nyckeln gäller på morgonen');
await D(() => SF.scene._debug.act('ut'));
const ute = await p.waitForFunction(() => window.SF.sceneName === 'solon', null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1200);
const pos = await D(() => SF.scene._debug.pos());
ok(ute && pos.x > 640 && pos.x < 680 && pos.y > 380 && pos.y < 400, `UT → Solön framför röda stugan (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
const m1 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('stuga-rod'));
ok(await inne() && (await D(() => SF.game.money)) === m1, 'in igen utan att betala');
await sleep(500);
await D(() => { SF.game.min = 19 * 60; });
ok(!(await D(() => SF.game.stugaHyrd())), 'på kvällen behövs en ny hyra');

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
