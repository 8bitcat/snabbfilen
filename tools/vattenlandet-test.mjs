// 🌊 VATTENLANDET (js/scenes/vattenlandet.js + js/vattenlandet/*, stadsdel 7, steg 1):
//   1. raden VATTENLANDET i hållplatsdialogen i stan → vattenbussen kostar 10 kr → man står utanför staketet
//   2. kassan: stängd på kvällen; entré 40 kr öppnar vändkorset; utan betalning är staketet stängt
//   3. vågpoolen kräver badkläder; omklädningsrummet byter om; trappan ner → man simmar i poolen, sirenen när vågorna kommer, upp igen
//   4. rutschtornet: Röda tornadon → klättrar, åker, plaskar ner i landningspoolen med lycka
//   5. barnpoolen plaskar, solstolen vilar (+energi), duschen svalkar, kiosken säljer glass för 15 kr
//   6. badvakten Bosse pratar och visslar om man klickar i vattnet utan trappan
//   7. inga fel i sidan, bussen hem frågar
//   node tools/vattenlandet-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=vatten${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Vatten', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 200, hunger: 40, energy: 70, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
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
const lage = () => D(() => SF.scene._debug.lage());
const money = () => D(() => SF.game.money);
await stang(); await D(() => SF.go('city')); await sleep(1500); await stang();

// 1. bussen dit
await D(async () => { const { busStopById } = await import('/js/city/map.js'); const s = busStopById('pixeltorget'); SF.scene._debug.teleport(s.x + 20, s.y + 6); }); await sleep(400);
const bs = await D(() => SF.scene._debug.busStop('pixeltorget'));
let dlg = false;
for (let k = 0; k < 2 && !dlg; k++) {
  await stang(); await D((b) => SF.scene.down(b.x, b.y), bs);
  dlg = await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-vatten]'), null, { timeout: 12000 }).then(() => true).catch(() => false);
}
ok(dlg, 'hållplatsdialogen i stan har raden VATTENLANDET');
const m0 = await money();
if (dlg) await D(() => document.querySelector('#modal [data-vatten]')?.click());
else { await stang(); await D(() => { SF.vattenFran = { buss: 'pixeltorget' }; SF.go('vattenlandet'); }); }
const kom = await p.waitForFunction(() => window.SF.sceneName === 'vattenlandet' && !!window.SF.scene?._debug?.lage, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(kom && (await money()) === m0 - (dlg ? 10 : 0), 'vattenbussen tar en till Vattenlandet för 10 kr');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x < 230 && pos.y > 400 && (await lage()) === 'torr' && !(await D(() => SF.scene._debug.betalt())), `man kliver av utanför staketet (${Math.round(pos.x)}, ${Math.round(pos.y)})`);

// 2. kassan och vändkorset
const fore = await D(() => SF.scene._debug.spots());
ok(['buss', 'kassa', 'vandkors', 'skylt'].every((s) => fore.includes(s)) && !fore.includes('omkladning'), `innan man betalat finns bara entrén (${fore.join(',')})`);
ok(!(await D(() => SF.scene._debug.walkable(230, 310))), 'vändkorset är stängt');
await D(() => { SF.game.min = 20 * 60 + 30; }); await D(() => SF.scene._debug.act('kassa')); await sleep(300);
ok(!(await D(() => SF.scene._debug.betalt())) && (await toasts()).some((t) => /Kassan är stängd/.test(t)), 'på kvällen är kassan stängd');
await D(() => { SF.game.min = 13 * 60; }); await D(() => SF.scene._debug.act('kassa')); await sleep(300);
ok(/Kassan/.test(await modal()) && /40 kr/.test(await modal()), 'kassan: entré 40 kr');
const m1 = await money();
await klickGo(); await sleep(400);
ok((await money()) === m1 - 40 && (await D(() => SF.scene._debug.betalt())) && (await toasts()).some((t) => /Välkommen/.test(t)), 'betalt → vändkorset öppet');
ok(await D(() => SF.scene._debug.walkable(230, 310)), 'man kan gå in genom vändkorset');
const efter = await D(() => SF.scene._debug.spots());
ok(['omkladning', 'trappa', 'torn', 'barnpool', 'sol0', 'dusch', 'kiosk', 'badvakt'].every((s) => efter.includes(s)), `parkens platser finns (${efter.length} st)`);

// 3. vågpoolen
await D(() => SF.scene._debug.teleport(682, 376)); await sleep(200);
await D(() => SF.scene._debug.act('trappa')); await sleep(300);
ok((await lage()) === 'torr' && (await toasts()).some((t) => /Byt om/.test(t)), 'utan badkläder får man inte gå i');
await D(() => SF.scene._debug.act('omkladning')); await sleep(300);
ok((await D(() => SF.scene._debug.bad())) === true && (await toasts()).some((t) => /Ombytt/.test(t)), 'omklädningsrummet: ombytt till badkläder');
await D(() => SF.scene._debug.act('trappa')); await sleep(400);
ok((await lage()) === 'vag' && (await D(() => SF.scene._debug.spots())).join() === 'upp', 'trappan ner → man är i vågpoolen');
ok((await D(() => SF.scene._debug.walkable(860, 280))) && !(await D(() => SF.scene._debug.walkable(860, 400))), 'i poolen simmar man, inte på promenaden');
await D(() => { const c = SF.scene._debug.cam(); SF.scene.down(860 - c.x, 280 - c.y); }); await sleep(3000);
const pos2 = await D(() => SF.scene._debug.pos());
ok(pos2.x > 740 && pos2.y < 330, `man simmar dit man klickar (${Math.round(pos2.x)}, ${Math.round(pos2.y)})`);
await D(() => { SF.scene._debug.vagT(41.9); SF.scene._debug.tick(0.5); }); await sleep(300);
ok((await D(() => SF.scene._debug.vagor())) && (await toasts()).some((t) => /VÅGORNA KOMMER/.test(t)), 'sirenen: vågorna kommer');
await D(() => SF.scene._debug.act('upp')); await sleep(300);
ok((await lage()) === 'torr' && (await toasts()).some((t) => /Upp ur vattnet/.test(t)), 'upp via trappan');

// 4. rutschtornet
await D(() => SF.scene._debug.teleport(1210, 170)); await sleep(200);
await D(() => SF.scene._debug.act('torn')); await sleep(300);
ok(/Rutschtornet/.test(await modal()) && /Röda tornadon/.test(await modal()), 'tornet: tre kanor att välja');
await D(() => document.querySelector('#modal [data-kana="rod"]')?.click()); await sleep(300);
ok((await lage()) === 'kana' && (await D(() => SF.scene._debug.kana()))?.id === 'rod', 'Röda tornadon: man klättrar upp');
await D(() => SF.scene._debug.tick(7)); await sleep(400);
const sista = await D(() => SF.scene._debug.sista()), pos3 = await D(() => SF.scene._debug.pos());
ok((await lage()) === 'torr' && sista?.typ === 'kana' && sista.kana === 'rod' && pos3.y > 380 && (await toasts()).some((t) => /TVÅ VARV/.test(t)), `plask i landningspoolen (${JSON.stringify(sista)}, ${Math.round(pos3.x)}, ${Math.round(pos3.y)})`);

// 5. barnpoolen, solstolen, duschen, kiosken
await D(() => SF.scene._debug.act('barnpool')); await sleep(300);
ok((await D(() => SF.scene._debug.plask())) > 0 && (await toasts()).some((t) => /plaskar/.test(t)), 'barnpoolen: plask');
const e0 = await D(() => SF.game.energy);
await D(() => SF.scene._debug.act('sol0')); await sleep(200);
ok((await lage()) === 'sol' && !!(await D(() => SF.scene._debug.sol())), 'solstolen: man lägger sig');
await D(() => SF.scene._debug.tick(6.2)); await sleep(300);
ok((await lage()) === 'torr' && (await D(() => SF.game.energy)) >= e0 + 6 && (await toasts()).some((t) => /Utvilad/.test(t)), 'efter en stund: utvilad (+8 ⚡)');
await D(() => SF.scene._debug.act('dusch')); await sleep(300);
ok((await toasts()).some((t) => /Svalkande/.test(t)), 'duschen svalkar');
await D(() => SF.scene._debug.act('kiosk')); await sleep(300);
ok(/Kiosken/.test(await modal()) && /15 kr/.test(await modal()), 'kiosken: glass 15 kr');
const m2 = await money();
await D(() => document.querySelector('#modal [data-vara="glass"]')?.click()); await sleep(400);
ok((await money()) === m2 - 15 && (await toasts()).some((t) => /Mjukglass/.test(t)), 'glassen kostar 15 kr');

// 6. badvakten
await D(() => SF.scene._debug.act('badvakt')); await sleep(600);
ok(/Bosse/.test((await D(() => SF.scene._debug.prat())) || ''), 'badvakten Bosse pratar');
await D(() => SF.scene._debug.teleport(860, 400)); await sleep(200);
await D(() => { const c = SF.scene._debug.cam(); SF.scene.down(860 - c.x, 280 - c.y); }); await sleep(500);
ok(/SPRING INTE/.test((await D(() => SF.scene._debug.prat())) || '') && (await lage()) === 'torr', 'klick i vattnet utan trappan → Bosse visslar');

// 7. bussen hem
await D(() => SF.scene._debug.teleport(86, 470)); await sleep(300);
await D(() => SF.scene._debug.act('buss')); await sleep(300);
ok(/Vattenbussen/.test(await modal()), 'bussen hem frågar');
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
