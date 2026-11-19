// 🏟️ ARENAN (js/scenes/arenan.js + js/arenan/*, stadsdel 5, steg 1):
//   1. raden ARENAN i hållplatsdialogen i stan → arenabussen kostar 10 kr → man står på Arenatorget
//   2. platserna finns; arenan och simhallen berättar vad som kommer; statyn, fikat, korven
//   3. sportaffären: skridskor 300 kr (för dyra med 200 kr), köps med 900 kr → g.skridskor; halsduken 60 kr
//   4. skridskobanan: med egna skridskor åker man direkt, isen går att åka på (inte torget), spåren syns, ut genom grinden
//      (utan skridskor: hyra 25 kr)
//   5. KBK-planen: straffpunkten startar fem straffar – mål i en fri del, räddning i målvaktens del, resultatet efter fem
//   6. inga fel i sidan, bussen hem frågar
//   node tools/arenan-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=arena${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Arena', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
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
const klickGo = () => D(() => { const b = document.querySelector('#modal:not(.hidden) .btn-go'); if (!b) return false; b.click(); return true; });
await stang(); await D(() => SF.go('city')); await sleep(1500); await stang();

// 1. bussen dit
await D(async () => { const { busStopById } = await import('/js/city/map.js'); const s = busStopById('pixeltorget'); SF.scene._debug.teleport(s.x + 20, s.y + 6); }); await sleep(400);
const bs = await D(() => SF.scene._debug.busStop('pixeltorget'));
let dlg = false;
for (let k = 0; k < 2 && !dlg; k++) {
  await stang(); await D((b) => SF.scene.down(b.x, b.y), bs);
  dlg = await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-arena]'), null, { timeout: 12000 }).then(() => true).catch(() => false);
}
ok(dlg, 'hållplatsdialogen i stan har raden ARENAN');
const m0 = await D(() => SF.game.money);
if (dlg) await D(() => document.querySelector('#modal [data-arena]')?.click());
else { await stang(); await D(() => { SF.arenaFran = { buss: 'pixeltorget' }; SF.go('arenan'); }); }
const kom = await p.waitForFunction(() => window.SF.sceneName === 'arenan' && !!window.SF.scene?._debug?.lage, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(kom && (await D(() => SF.game.money)) === m0 - (dlg ? 10 : 0), 'arenabussen tar en till Arenan för 10 kr');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x < 140 && pos.y > 240 && pos.y < 320, `man kliver av på Arenatorget (${Math.round(pos.x)}, ${Math.round(pos.y)})`);

// 2. platserna
const spots = await D(() => SF.scene._debug.spots());
ok(['buss', 'sport', 'arena', 'biljett', 'simhall', 'staty', 'fikat', 'korv', 'choklad', 'bana', 'plan', 'flagga0', 'skylt'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);
await D(() => SF.scene._debug.act('arena')); await sleep(300);
ok((await toasts()).some((t) => /Matchdagen öppnar/.test(t)), 'arenan berättar att matchdagen kommer');
await D(() => SF.scene._debug.act('simhall')); await sleep(300);
ok((await toasts()).some((t) => /Simhallen öppnar/.test(t)), 'simhallen öppnar snart');
await D(() => SF.scene._debug.act('staty')); await sleep(300);
ok((await toasts()).some((t) => /Gunvor/.test(t)), 'statyn berättar om Gunvor');
const m1 = await D(() => SF.game.money), h0 = await D(() => SF.game.hunger);
await D(() => SF.scene._debug.act('korv')); await sleep(300);
ok((await D(() => SF.game.money)) === m1 - 25 && (await D(() => SF.game.hunger)) > h0, 'varmkorven kostar 25 kr och mättar');

// 3. sportaffären
await D(() => SF.scene._debug.act('sport')); await sleep(300);
ok(/Skridskor/.test(await modal()) && /300 kr/.test(await modal()), 'sportaffären säljer skridskor för 300 kr');
ok(await D(() => document.querySelector('#modal [data-vara="skridskor"]')?.disabled === true), 'med 175 kr går de inte att köpa');
await stang(); await D(() => { SF.game.money = 900; }); await D(() => SF.scene._debug.act('sport')); await sleep(300);
await D(() => document.querySelector('#modal [data-vara="skridskor"]')?.click()); await sleep(400);
ok((await D(() => SF.game.skridskor)) === true && (await D(() => SF.game.money)) === 600, 'skridskorna köpta → g.skridskor, 300 kr dragna');
await D(() => SF.scene._debug.act('sport')); await sleep(300);
await D(() => document.querySelector('#modal [data-vara="halsduk"]')?.click()); await sleep(400);
ok((await D(() => SF.game.money)) === 540 && (await toasts()).some((t) => /Heja KBK/.test(t)), 'halsduken kostar 60 kr');

// 4. skridskobanan
await D(() => SF.scene._debug.teleport(560, 336)); await sleep(300);
await D(() => SF.scene._debug.act('bana')); await sleep(500);
ok((await D(() => SF.scene._debug.lage())) === 'is' && (await toasts()).some((t) => /egna skridskor/.test(t)), 'med egna skridskor åker man direkt');
ok((await D(() => SF.scene._debug.walkable(560, 420))) && !(await D(() => SF.scene._debug.walkable(560, 300))), 'isen går att åka på, inte torget');
await D(() => { const c = SF.scene._debug.cam(); SF.scene.down(700 - c.x, 440 - c.y); }); await sleep(2500);
const pos2 = await D(() => SF.scene._debug.pos());
ok(pos2.x > 620 && pos2.y > 380 && (await D(() => SF.scene._debug.spar())) > 0, `man glider dit man klickar och spåren syns (${Math.round(pos2.x)}, ${Math.round(pos2.y)})`);
await D(() => SF.scene._debug.act('grind-is')); await sleep(500);
ok((await D(() => SF.scene._debug.lage())) === 'torg' && (await toasts()).some((t) => /röda kinder/.test(t)), 'ut genom grinden');
await D(() => { SF.game.skridskor = false; }); const m2 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('bana')); await sleep(300);
ok(/Hyr skridskor/.test(await modal()) && /25 kr/.test(await modal()), 'utan skridskor frågar banan om hyra (25 kr)');
await klickGo(); await sleep(400);
ok((await D(() => SF.scene._debug.lage())) === 'is' && (await D(() => SF.game.money)) === m2 - 25, 'hyrskridskorna kostar 25 kr');
await D(() => SF.scene._debug.act('grind-is')); await sleep(300);

// 5. straffarna
await D(() => SF.scene._debug.teleport(1052, 336)); await sleep(300);
await D(() => SF.scene._debug.act('plan')); await sleep(400);
ok((await D(() => SF.scene._debug.lage())) === 'plan' && (await D(() => SF.scene._debug.spots())).includes('straff'), 'in på KBK-planen');
await D(() => SF.scene._debug.teleport(1300, 420)); await sleep(200);
await D(() => SF.scene._debug.act('straff')); await sleep(300);
let st = await D(() => SF.scene._debug.straff());
ok(st && st.fas === 'sikta' && st.skott === 0, `straffarna startar (${JSON.stringify(st)})`);
const fri = (st.mv + 1) % 3;
ok((await D((z) => SF.scene._debug.skjut(z), fri)) === true, 'skott i en fri del = mål');
await D(() => SF.scene._debug.tick(1)); await sleep(100);
st = await D(() => SF.scene._debug.straff());
ok(st.skott === 1 && st.mal === 1 && st.fas === 'sikta', `efter skottet: 1 av 1 (${JSON.stringify(st)})`);
ok((await D((z) => SF.scene._debug.skjut(z), st.mv)) === false, 'skott i målvaktens del = räddning');
await D(() => SF.scene._debug.tick(1));
for (let k = 0; k < 3; k++) { st = await D(() => SF.scene._debug.straff()); await D((z) => SF.scene._debug.skjut(z), (st.mv + 1) % 3); await D(() => SF.scene._debug.tick(1)); }
await sleep(400);
ok((await D(() => SF.scene._debug.straff())) === null && (await toasts()).some((t) => /4 av 5 mål/.test(t)), 'fem straffar → resultatet 4 av 5');
await D(() => SF.scene._debug.act('grind-plan')); await sleep(300);
ok((await D(() => SF.scene._debug.lage())) === 'torg', 'ut från planen');

// 6. bussen hem
await D(() => SF.scene._debug.teleport(70, 290)); await sleep(300);
await D(() => SF.scene._debug.act('buss')); await sleep(300);
ok(/Arenabussen/.test(await modal()), 'bussen hem frågar');
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
