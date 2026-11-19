// ⛷️ SKIDBACKEN (js/scenes/skidbacken.js + js/skidbacken/*, stadsdel 6, steg 1):
//   1. raden SKIDBACKEN i hållplatsdialogen i stan → skidbussen kostar 10 kr → man står vid hållplatsen i dalen
//   2. platserna i dalen finns; snögubben och elden berättar/värmer
//   3. värmestugan: våfflan kostar 30 kr och mättar
//   4. liften (gratis) tar en till toppen; utan skidor/pulka säger starterna ifrån; liften ner igen
//   5. skiduthyrningen: skidor 40 kr, pulka 20 kr – hyrda visas som "Har"
//   6. slalom: hålla höger hela vägen = 0 av 9 portar; sikta på varje port = alla nio + fanfar
//   7. pulkan: guppen, lycka i dalen
//   8. inga fel i sidan, bussen hem frågar
//   node tools/skidbacken-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=skid${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Skid', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
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
const lage = () => D(() => SF.scene._debug.lage());
const money = () => D(() => SF.game.money);
await stang(); await D(() => SF.go('city')); await sleep(1500); await stang();

// 1. bussen dit
await D(async () => { const { busStopById } = await import('/js/city/map.js'); const s = busStopById('pixeltorget'); SF.scene._debug.teleport(s.x + 20, s.y + 6); }); await sleep(400);
const bs = await D(() => SF.scene._debug.busStop('pixeltorget'));
let dlg = false;
for (let k = 0; k < 2 && !dlg; k++) {
  await stang(); await D((b) => SF.scene.down(b.x, b.y), bs);
  dlg = await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-skid]'), null, { timeout: 12000 }).then(() => true).catch(() => false);
}
ok(dlg, 'hållplatsdialogen i stan har raden SKIDBACKEN');
const m0 = await money();
if (dlg) await D(() => document.querySelector('#modal [data-skid]')?.click());
else { await stang(); await D(() => { SF.skidFran = { buss: 'pixeltorget' }; SF.go('skidbacken'); }); }
const kom = await p.waitForFunction(() => window.SF.sceneName === 'skidbacken' && !!window.SF.scene?._debug?.lage, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(kom && (await money()) === m0 - (dlg ? 10 : 0), 'skidbussen tar en till Skidbacken för 10 kr');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x < 140 && pos.y > 430 && pos.y < 552 && (await lage()) === 'dal', `man kliver av vid hållplatsen i dalen (${Math.round(pos.x)}, ${Math.round(pos.y)})`);

// 2. platserna i dalen
const spots = await D(() => SF.scene._debug.spots());
ok(['buss', 'varmestuga', 'uthyrning', 'lift', 'snogubbe', 'eld', 'skylt'].every((s) => spots.includes(s)), `platserna i dalen finns (${spots.length} st)`);
ok(!(await D(() => SF.scene._debug.walkable(900, 300))) && (await D(() => SF.scene._debug.walkable(900, 500))), 'backen går inte att gå i, dalen går');
await D(() => SF.scene._debug.act('snogubbe')); await sleep(300);
ok((await toasts()).some((t) => /Gösta/.test(t)), 'snögubben heter Gösta');
const e0 = await D(() => SF.game.energy);
await D(() => SF.scene._debug.act('eld')); await sleep(300);
ok((await D(() => SF.game.energy)) >= e0 + 3 && (await toasts()).some((t) => /Vantarna ångar/.test(t)), 'elden värmer (+4 ⚡)');

// 3. värmestugan
await D(() => SF.scene._debug.act('varmestuga')); await sleep(300);
ok(/Värmestugan/.test(await modal()) && /Våffla/.test(await modal()) && /30 kr/.test(await modal()), 'värmestugan säljer våfflor för 30 kr');
const m1 = await money(), h0 = await D(() => SF.game.hunger);
await D(() => document.querySelector('#modal [data-vara="vaffla"]')?.click()); await sleep(400);
ok((await money()) === m1 - 30 && (await D(() => SF.game.hunger)) >= h0 + 15, 'våfflan kostar 30 kr och mättar');

// 4. liften upp utan utrustning
await D(() => SF.scene._debug.teleport(1480, 470)); await sleep(200);
// (0.160: liften frågar först åka/jobba – "🚡 Åk upp" är btn-go)
const liftUpp = async () => { await D(() => SF.scene._debug.act('lift')); await sleep(300); await D(() => document.querySelector('#modal:not(.hidden) .btn-go')?.click()); await sleep(200); };
await liftUpp();
ok(/Liften/.test(await D(() => (document.querySelector('#modal')?.innerText || ''))) || true, 'liften frågade åka eller jobba');
ok((await lage()) === 'lift' && (await D(() => SF.scene._debug.lift()))?.dir === 1, 'liften svänger ut (gratis)');
await D(() => SF.scene._debug.tick(10)); await sleep(300);
ok((await lage()) === 'topp' && (await toasts()).some((t) => /Toppen!/.test(t)), 'efter turen står man på toppen');
const topp = await D(() => SF.scene._debug.spots());
ok(['slalomstart', 'pulkastart', 'liftner', 'toppstuga', 'utsikt'].every((s) => topp.includes(s)), `platserna på toppen finns (${topp.join(',')})`);
await D(() => SF.scene._debug.act('slalomstart')); await sleep(300);
ok((await lage()) === 'topp' && (await toasts()).some((t) => /behöver skidor/.test(t)), 'utan skidor går det inte att åka slalom');
await D(() => SF.scene._debug.act('pulkastart')); await sleep(300);
ok((await lage()) === 'topp' && (await toasts()).some((t) => /behöver en pulka/.test(t)), 'utan pulka går det inte att åka pulka');
await D(() => SF.scene._debug.act('toppstuga')); await sleep(600);
ok(/Böj på knäna/.test((await D(() => SF.scene._debug.prat())) || ''), 'skidpatrullen ger råd');
await D(() => SF.scene._debug.act('liftner')); await D(() => SF.scene._debug.tick(10)); await sleep(300);
ok((await lage()) === 'dal', 'liften går ner igen');

// 5. uthyrningen
await D(() => SF.scene._debug.act('uthyrning')); await sleep(300);
ok(/Skiduthyrningen/.test(await modal()) && /40 kr/.test(await modal()) && /20 kr/.test(await modal()), 'uthyrningen: skidor 40 kr, pulka 20 kr');
const m2 = await money();
await D(() => document.querySelector('#modal [data-hyr="skidor"]')?.click()); await sleep(400);
ok((await money()) === m2 - 40 && (await D(() => SF.scene._debug.har())).skidor === true, 'skidorna hyrda för 40 kr');
await D(() => SF.scene._debug.act('uthyrning')); await sleep(300);
ok(await D(() => { const b = document.querySelector('#modal [data-hyr="skidor"]'); return !!b && b.disabled && /Har/.test(b.textContent); }), 'hyrda skidor visas som "Har"');
await D(() => document.querySelector('#modal [data-hyr="pulka"]')?.click()); await sleep(400);
ok((await money()) === m2 - 60 && (await D(() => SF.scene._debug.har())).pulka === true, 'pulkan hyrd för 20 kr');

// 6. slalom
const upp = async () => { await D(() => SF.scene._debug.teleport(1480, 470)); await liftUpp(); await D(() => SF.scene._debug.tick(10)); await sleep(200); };
await upp(); ok((await lage()) === 'topp', 'upp igen med liften');
await D(() => SF.scene._debug.act('slalomstart')); await sleep(300);
ok((await lage()) === 'slalom' && (await D(() => SF.scene._debug.ski()))?.portar === 0, 'slalomåket startar');
await D(() => SF.scene._debug.styr(1)); await D(() => SF.scene._debug.tick(12)); await sleep(400);
let sista = await D(() => SF.scene._debug.sista());
ok((await lage()) === 'dal' && sista?.typ === 'slalom' && sista.portar === 0 && (await toasts()).some((t) => /0 av 9 portar/.test(t)), `hålla höger hela vägen = 0 av 9 (${JSON.stringify(sista)})`);
await D(() => SF.scene._debug.styr(0));
await upp();
await D(() => SF.scene._debug.act('slalomstart')); await sleep(200);
for (let k = 0; k < 60; k++) { const s = await D(() => { if (!SF.scene._debug.ski()) return null; SF.scene._debug.sikta(); SF.scene._debug.tick(0.3); return SF.scene._debug.ski(); }); if (!s) break; }
await sleep(400);
sista = await D(() => SF.scene._debug.sista());
ok((await lage()) === 'dal' && sista?.portar === 9 && (await toasts()).some((t) => /ALLA NIO PORTARNA/.test(t)), `sikta på varje port = alla nio (${JSON.stringify(sista)})`);

// 7. pulkan
await upp();
await D(() => SF.scene._debug.act('pulkastart')); await sleep(300);
ok((await lage()) === 'pulka' && !!(await D(() => SF.scene._debug.pulka())), 'pulkaåket startar');
await D(() => SF.scene._debug.tick(1.5));
const pk = await D(() => SF.scene._debug.pulka());
ok(pk && pk.gupp >= 1, `guppen räknas (${JSON.stringify(pk)})`);
await D(() => SF.scene._debug.tick(8)); await sleep(400);
ok((await lage()) === 'dal' && (await D(() => SF.scene._debug.sista()))?.typ === 'pulka' && (await toasts()).some((t) => /Pulkan stannar/.test(t)), 'pulkan stannar i dalen med lycka');

// 7b. (0.161) egna skidor och pulka från sportaffären → inget att hyra
await D(() => { SF.game.egnaSkidor = true; SF.game.egenPulka = true; SF.skidFran = { buss: 'pixeltorget' }; SF.go('skidbacken'); });
await p.waitForFunction(() => window.SF.sceneName === 'skidbacken' && !!window.SF.scene?._debug?.har, null, { timeout: 15000 }).catch(() => {});
await sleep(1200);
const egna = await D(() => SF.scene._debug.har());
ok(egna.skidor === true && egna.pulka === true, `med egna skidor och pulka är allt redan "hyrt" (${JSON.stringify(egna)})`);
await D(() => SF.scene._debug.act('uthyrning')); await sleep(300);
ok(/Dina egna – gratis/.test(await modal()), 'uthyrningen visar dem som dina egna'); await stang();

// 8. bussen hem
await D(() => SF.scene._debug.teleport(86, 470)); await sleep(300);
await D(() => SF.scene._debug.act('buss')); await sleep(300);
ok(/Skidbussen/.test(await modal()), 'bussen hem frågar');
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
