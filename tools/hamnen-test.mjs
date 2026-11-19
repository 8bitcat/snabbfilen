// ⚓ FISKEHAMNEN (js/scenes/hamnen.js + js/hamnen/*, stadsdel 4):
//   1. raden FISKEHAMNEN i hållplatsdialogen i stan → hamnbussen kostar 10 kr → man står på hamnplanen
//   2. platserna finns
//   3. fiskmarknaden: färsk fisk till skafferiet (30 kr), rökt makrill mättar; Fisk & chips-vagnen säljer
//   4. båtaffären: roddbåten kostar 1 200 kr (för dyr med 500 kr), köps med 7 000 kr → g.bat
//   5. båtrampen: med egen båt lägger man ut direkt, vattnet går att åka på och land inte, lägg till igen;
//      utan båt hyr man en roddbåt för 60 kr
//   6. skeppshandeln och fisket från piren (metspö krävs), bussen hem frågar
//   7. färjan tar en till Solön för 20 kr
//   8. inga fel i sidan
//   node tools/hamnen-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=hamn${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Hamn', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 500, hunger: 40, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
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
await stang(); await D(() => SF.go('city')); await sleep(1500); await stang();

// 1. bussen dit
await D(async () => { const { busStopById } = await import('/js/city/map.js'); const s = busStopById('pixeltorget'); SF.scene._debug.teleport(s.x + 20, s.y + 6); }); await sleep(400);
const bs = await D(() => SF.scene._debug.busStop('pixeltorget'));
let dlg = false;
for (let k = 0; k < 2 && !dlg; k++) {
  await stang(); await D((b) => SF.scene.down(b.x, b.y), bs);
  dlg = await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-hamn]'), null, { timeout: 12000 }).then(() => true).catch(() => false);
}
ok(dlg, 'hållplatsdialogen i stan har raden FISKEHAMNEN');
const m0 = await D(() => SF.game.money);
if (dlg) await D(() => document.querySelector('#modal [data-hamn]')?.click());
else { await stang(); await D(() => { SF.hamnFran = { buss: 'pixeltorget' }; SF.go('hamnen'); }); }
const kom = await p.waitForFunction(() => window.SF.sceneName === 'hamnen' && !!window.SF.scene?._debug?.tur, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(kom && (await D(() => SF.game.money)) === m0 - (dlg ? 10 : 0), 'hamnbussen tar en till Fiskehamnen för 10 kr');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x < 140 && pos.y > 240 && pos.y < 300, `man kliver av på hamnplanen (${Math.round(pos.x)}, ${Math.round(pos.y)})`);

// 2. platserna
const spots = await D(() => SF.scene._debug.spots());
ok(['buss', 'kontor', 'magasin', 'stand-fisk', 'stand-rokt', 'stand-rakor', 'fiskbil', 'bataffar', 'trailer-rodd', 'trailer-motor', 'skeppshandel', 'rokeri', 'terminal', 'farja', 'fyr', 'fiska', 'ramp', 'kran', 'ankare', 'bat-anna', 'skylt'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);

// 3. marknaden och vagnen
await D(() => SF.scene._debug.teleport(620, 240)); await sleep(300);
const m1 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('stand-fisk')); await sleep(300);
ok(/Färsk fisk/.test(await modal()) && /30 kr/.test(await modal()), 'fiskståndet säljer färsk fisk för 30 kr');
await klickGo(); await sleep(400);
ok((await D(() => SF.game.money)) === m1 - 30 && (await D(() => SF.game.skafferi.fisk | 0)) === 1, 'fisken hamnar i skafferiet');
const h0 = await D(() => SF.game.hunger);
await D(() => SF.scene._debug.act('stand-rokt')); await sleep(300); await klickGo(); await sleep(400);
ok((await D(() => SF.game.money)) === m1 - 55 && (await D(() => SF.game.hunger)) > h0, 'rökt makrill kostar 25 kr och mättar');
await D(() => SF.scene._debug.act('fiskbil')); await sleep(300);
ok(/Fisk & chips/.test(await modal()), 'Fisk & chips-vagnen har en meny');
await D(() => document.querySelector('#modal [data-vara="fc"]')?.click()); await sleep(400);
ok((await D(() => SF.game.money)) === m1 - 95, 'fisk & chips kostar 40 kr');

// 4. båtaffären
await D(() => SF.scene._debug.teleport(1000, 250)); await sleep(300);
await D(() => SF.scene._debug.act('bataffar')); await sleep(300);
ok(/Roddbåt/.test(await modal()) && /1 200 kr/.test(await modal()), 'båtaffären säljer roddbåten för 1 200 kr');
ok(await D(() => document.querySelector('#modal [data-bat="rodd"]')?.disabled === true), 'med 405 kr går den inte att köpa');
await stang(); await D(() => { SF.game.money = 7000; }); await D(() => SF.scene._debug.act('bataffar')); await sleep(300);
await D(() => document.querySelector('#modal [data-bat="rodd"]')?.click()); await sleep(500);
ok((await D(() => SF.game.bat)) === 'rodd' && (await D(() => SF.game.money)) === 5800, 'roddbåten köpt → g.bat = rodd, 1 200 kr dragna');

// 5. båtrampen
await D(() => SF.scene._debug.teleport(1400, 286)); await sleep(300);
await D(() => SF.scene._debug.act('ramp')); await sleep(500);
const tur = await D(() => SF.scene._debug.tur());
ok(tur && tur.typ === 'rodd' && !tur.hyrd, `med egen båt lägger man ut direkt (${JSON.stringify(tur)})`);
ok((await D(() => SF.scene._debug.walkable(1000, 400))) && !(await D(() => SF.scene._debug.walkable(1000, 250))), 'på vattnet går det att åka, inte på land');
ok((await D(() => SF.scene._debug.spots())).join() === 'ramp', 'ute på vattnet finns bara rampen att lägga till vid');
await D(() => { const c = SF.scene._debug.cam(); SF.scene.down(1000 - c.x, 400 - c.y); }); await sleep(2500);
const pos2 = await D(() => SF.scene._debug.pos());
ok(pos2.x < 1380 && pos2.y > 330, `båten åker dit man klickar (${Math.round(pos2.x)}, ${Math.round(pos2.y)})`);
ok(await D(() => SF.scene._debug.landa()), 'man lägger till igen');
const pos3 = await D(() => SF.scene._debug.pos());
ok(!(await D(() => SF.scene._debug.tur())) && Math.abs(pos3.x - 1400) < 16 && pos3.y < 300 && (await toasts()).some((t) => /lägger till/.test(t)), `tillbaka på kajen vid rampen (${Math.round(pos3.x)}, ${Math.round(pos3.y)})`);
await D(() => { SF.game.bat = null; }); const m2 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('ramp')); await sleep(300);
ok(/Hyr roddbåt/.test(await modal()) && /60 kr/.test(await modal()), 'utan båt frågar rampen om hyra (60 kr)');
await klickGo(); await sleep(400);
const tur2 = await D(() => SF.scene._debug.tur());
ok(tur2 && tur2.hyrd && (await D(() => SF.game.money)) === m2 - 60, 'hyrbåten kostar 60 kr');
await D(() => SF.scene._debug.landa()); await sleep(200);

// 6. skeppshandeln, fisket, bussen
await D(() => SF.scene._debug.act('skeppshandel')); await sleep(300);
ok(/Skeppshandeln/.test(await modal()) && /metspö/i.test(await modal()), 'skeppshandeln säljer metspö');
await stang();
await D(() => SF.scene._debug.teleport(1574, 434)); await sleep(300);
await D(() => SF.scene._debug.act('fiska')); await sleep(300);
ok((await toasts()).some((t) => /metspö/.test(t)), 'fisket från piren kräver ett metspö');
await D(() => SF.scene._debug.act('buss')); await sleep(300);
ok(/Hamnbussen/.test(await modal()), 'bussen hem frågar');
await stang();

// 7. färjan till Solön
const m3 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('terminal')); await sleep(300);
ok(/Solö-färjan/.test(await modal()), 'terminalen säljer färjebiljett');
await klickGo();
const solon = await p.waitForFunction(() => window.SF.sceneName === 'solon', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(solon && (await D(() => SF.game.money)) === m3 - 20, 'färjan tar en till Solön för 20 kr');

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
