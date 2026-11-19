// 🏊 SIMHALLEN på Arenatorget (js/scenes/simhall.js + js/arenan/simhall-inne.js, Arenan steg 3):
//   1. simhallens dörr: stängt på natten; på dagen kostar entrén 40 kr → scenen simhall innanför dörren
//   2. vattnet kräver badkläder; omklädningsrummet byter om; stegen → man simmar, simtagen ger fart, längderna räknas, tio = simmärket
//   3. rutschkanan: klättra, åka, plask → man ligger i bassängen; upp via stegen
//   4. bubbelpoolen och bastun ger energi; Ulla pratar
//   5. ut → man står vid simhallens dörr på Arenatorget
//   6. inga fel i sidan
//   node tools/simhall-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=sim${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Sim', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 200, hunger: 60, energy: 60, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.evaluate(() => { window.__toasts = []; const T = document.querySelector('#toasts'); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push(n.textContent)))).observe(T, { childList: true }); });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const toasts = () => D(() => window.__toasts.splice(0));
const lage = () => D(() => SF.scene._debug.lage());
await stang(); await D(() => { SF.arenaFran = { buss: 'pixeltorget' }; SF.go('arenan'); }); await sleep(1800); await stang();

// 1. dörren
await D(() => { SF.game.min = 22 * 60; }); await D(() => SF.scene._debug.act('simhall')); await sleep(400);
ok((await D(() => SF.sceneName)) === 'arenan' && (await toasts()).some((t) => /Simhallen har öppet/.test(t)), 'på natten är simhallen stängd');
await D(() => { SF.game.min = 13 * 60; });
const m0 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('simhall'));
const inne = await p.waitForFunction(() => window.SF.sceneName === 'simhall' && !!window.SF.scene?._debug?.lage, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(inne && (await D(() => SF.game.money)) === m0 - 40, 'entrén kostar 40 kr → scenen simhall');
const pos0 = await D(() => SF.scene._debug.pos());
ok(pos0.x < 60 && pos0.y > 70 && pos0.y < 100 && (await lage()) === 'torr', `man står innanför dörren (${Math.round(pos0.x)}, ${Math.round(pos0.y)})`);
const spots = await D(() => SF.scene._debug.spots());
ok(['ut', 'omkl', 'kassa', 'stege', 'stege2', 'kana', 'bubbel', 'bastu', 'badvakt'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);

// 2. bassängen
await D(() => SF.scene._debug.act('stege')); await sleep(300);
ok((await lage()) === 'torr' && (await toasts()).some((t) => /Byt om/.test(t)), 'utan badkläder får man inte gå i');
await D(() => SF.scene._debug.act('omkl')); await sleep(300);
ok((await D(() => SF.scene._debug.bad())) === true, 'omklädningsrummet: ombytt');
await D(() => SF.scene._debug.act('stege')); await sleep(300);
let s = await D(() => SF.scene._debug.sim());
ok((await lage()) === 'sim' && s && s.langder === 0 && s.dir === 1, `nere i bassängen (${JSON.stringify(s)})`);
await D(() => { for (let k = 0; k < 3; k++) SF.scene._debug.simtag(); });
s = await D(() => SF.scene._debug.sim());
ok(s.v >= 80, `simtagen ger fart (${s.v})`);
await D(() => { for (let k = 0; k < 40; k++) { SF.scene._debug.simtag(); SF.scene._debug.tick(0.4); } });
s = await D(() => SF.scene._debug.sim());
ok(s.langder >= 2 && (await toasts()).some((t) => /längder/.test(t)), `längderna räknas och varannan ger lycka (${s.langder})`);
await D(() => { for (let k = 0; k < 140; k++) { SF.scene._debug.simtag(); SF.scene._debug.tick(0.4); } });
s = await D(() => SF.scene._debug.sim());
ok(s.langder >= 10 && (await toasts()).some((t) => /SIMMÄRKET/.test(t)), `tio längder → simmärket (${s.langder})`);
await D(() => SF.scene._debug.act('upp')); await sleep(300);
ok((await lage()) === 'torr' && (await toasts()).some((t) => /Upp ur bassängen/.test(t)), 'upp via stegen');

// 3. rutschkanan
await D(() => SF.scene._debug.act('kana')); await sleep(300);
ok((await lage()) === 'kana' && !!(await D(() => SF.scene._debug.kana())), 'rutschkanan: man klättrar upp');
await D(() => SF.scene._debug.tick(4.2)); await sleep(300);
s = await D(() => SF.scene._debug.sim());
ok((await lage()) === 'sim' && s && s.y < 130 && (await toasts()).some((t) => /PLASK/.test(t)), `plask → man ligger i bassängens övre bana (${JSON.stringify(s)})`);
await D(() => SF.scene._debug.act('upp2')); await sleep(300);
ok((await lage()) === 'torr', 'upp via den andra stegen');

// 4. bubbelpoolen, bastun, Ulla
const e0 = await D(() => SF.game.energy);
await D(() => SF.scene._debug.act('bubbel')); await sleep(200);
ok((await lage()) === 'bubbel', 'ner i bubbelpoolen');
await D(() => SF.scene._debug.tick(5.2)); await sleep(300);
ok((await lage()) === 'torr' && (await D(() => SF.game.energy)) >= e0 + 4 && (await D(() => SF.scene._debug.sista()))?.typ === 'bubbel', 'bubbelpoolen ger energi');
await D(() => SF.scene._debug.act('bastu')); await sleep(200);
ok((await lage()) === 'bastu', 'in i bastun');
await D(() => SF.scene._debug.tick(6.2)); await sleep(300);
ok((await lage()) === 'torr' && (await D(() => SF.scene._debug.sista()))?.typ === 'bastu' && (await toasts()).some((t) => /Ut ur bastun/.test(t)), 'bastun: ut efter en stund med energi');
await D(() => SF.scene._debug.act('badvakt')); await sleep(600);
ok(/Ulla/.test((await D(() => SF.scene._debug.prat())) || ''), 'badvakten Ulla pratar');

// 5. ut
await D(() => SF.scene._debug.act('ut'));
const ute = await p.waitForFunction(() => window.SF.sceneName === 'arenan' && !!window.SF.scene?._debug?.pos, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1200);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: 0, y: 0 };
ok(ute && pos.x > 1200 && pos.x < 1420, `ut → vid simhallens dörr på Arenatorget (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
