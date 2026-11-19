// 🦁 DJURPARKEN (js/scenes/djurparken.js + js/djurparken/*, stadsdel 3):
//   1. raden DJURPARKEN i hållplatsdialogen i stan → djurbussen kostar 10 kr → man står vid hållplatsen utanför grinden
//   2. platserna finns; grinden är stängd tills man betalat entrén i kassan (20 kr), stängt före 9
//   3. skyltarna berättar om djuren och djuren reagerar (lejonet ryter, elefanten sprutar)
//   4. klappzoo: klappa en get (😊), köp getfoder (5 kr) – getterna kommer
//   5. ponnyridningen: 15 kr för ett varv på Pricken, man sitter på ponnyn, sedan står man vid grinden igen
//   6. glasskiosken (hungern stiger) och souvenirkiosken (ballongen följer med)
//   7. påfågeln slår ut stjärten när man kommer nära
//   8. om natten sover djuren, och allt målas utan fel
//   9. djurbussen tillbaka → staden
//  10. inga fel i sidan
//   node tools/djurparken-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=zoo${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Zoo', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
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
for (let k = 0; k < 2 && !dlg; k++) {   // (andra försöket om figuren inte hann fram till kuren)
  await stang(); await D((b) => SF.scene.down(b.x, b.y), bs);
  dlg = await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-djur]'), null, { timeout: 12000 }).then(() => true).catch(() => false);
}
ok(dlg, 'hållplatsdialogen i stan har raden DJURPARKEN');
const m0 = await D(() => SF.game.money);
if (dlg) await D(() => document.querySelector('#modal [data-djur]')?.click());
else { await stang(); await D(() => { SF.djurparkFran = { buss: 'pixeltorget' }; SF.go('djurparken'); }); }
const kom = await p.waitForFunction(() => window.SF.sceneName === 'djurparken' && !!window.SF.scene?._debug?.betalt, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(kom && (await D(() => SF.game.money)) === m0 - (dlg ? 10 : 0), 'djurbussen tar en till Djurparken för 10 kr');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x < 140 && pos.y > 300 && pos.y < 380, `man kliver av vid hållplatsen utanför grinden (${Math.round(pos.x)}, ${Math.round(pos.y)})`);

// 2. platserna, grinden och kassan
const spots = await D(() => SF.scene._debug.spots());
ok(['buss', 'kassa', 'grind', 'parkskylt', 'skylt-lejon', 'skylt-elefant', 'skylt-giraff', 'skylt-pingvin', 'skylt-flamingo', 'skylt-bjorn', 'skylt-apor', 'skylt-klapp', 'klappgrind', 'foder', 'ponnygrind', 'glass', 'souvenir', 'personal', 'bro', 'pafagel'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);
ok(!(await D(() => SF.scene._debug.betalt())) && !(await D(() => SF.scene._debug.walkable(140, 286))), 'grinden är stängd innan man betalat');
await D(() => { SF.game.min = 7 * 60; }); await D(() => SF.scene._debug.act('kassa')); await sleep(300);
ok((await toasts()).some((t) => /stängd/.test(t)) && !(await D(() => SF.scene._debug.oppet())), 'klockan 7 är parken stängd');
await D(() => { SF.game.min = 13 * 60; }); await D(() => SF.scene._debug.act('kassa')); await sleep(300);
ok(/entré/i.test(await modal()) && /20 kr/.test(await modal()), 'kassan frågar om entrén (20 kr)');
const m1 = await D(() => SF.game.money);
ok(await klickGo(), 'man betalar'); await sleep(500);
ok((await D(() => SF.game.money)) === m1 - 20 && (await D(() => SF.scene._debug.betalt())) && (await D(() => SF.scene._debug.walkable(140, 286))), 'entrén betald – grinden är öppen');

// 3. skyltarna och djuren
await D(() => SF.scene._debug.teleport(876, 290)); await sleep(300);
await D(() => SF.scene._debug.act('skylt-lejon')); await sleep(400);
ok((await toasts()).some((t) => /LEJONEN/.test(t)) && (await D(() => SF.scene._debug.djur('lejon'))).some((d) => d.st === 'ryt'), 'lejonskylten berättar och lejonet ryter');
await D(() => SF.scene._debug.act('skylt-elefant')); await sleep(400);
ok((await D(() => SF.scene._debug.djur('elefant'))).some((d) => d.st === 'spray'), 'elefanten sprutar vatten');
const allaDjur = await D(() => SF.scene._debug.djur());
ok(allaDjur.length >= 24 && ['lejon', 'elefant', 'giraff', 'apa', 'pingvin', 'flamingo', 'bjorn', 'get', 'anka', 'pafagel'].every((a) => allaDjur.some((d) => d.art === a)), `alla arter finns (${allaDjur.length} djur)`);

// 4. klappzoo
await D(() => SF.scene._debug.teleport(300, 180)); await sleep(300);
ok(await D(() => SF.scene._debug.klappa(0)), 'man klappar en get');
await sleep(300);
ok(/Bä|Mäh/.test(await D(() => SF.scene._debug.prat()) || ''), 'geten bräker');
const m2 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('foder')); await sleep(2500);
ok((await D(() => SF.game.money)) === m2 - 5 && (await D(() => SF.scene._debug.mat())), 'getfodret kostar 5 kr');
ok((await D(() => SF.scene._debug.djur('klapp'))).some((d) => d.st === 'walk' || d.st === 'ata'), 'getterna kommer till fodret');

// 5. ponnyridningen
await D(() => SF.scene._debug.teleport(956, 338)); await sleep(300);
await D(() => SF.scene._debug.act('ponnygrind')); await sleep(300);
ok(/Pricken/.test(await modal()), 'ponnyridningen frågar om ett varv');
const m3 = await D(() => SF.game.money);
await klickGo(); await sleep(1500);
const pr = await D(() => SF.scene._debug.ponny());
ok(pr.rider !== null && pr.rider > 0.5 && (await D(() => SF.game.money)) === m3 - 15, `man sitter på Pricken (${pr.rider} s) för 15 kr`);
await D(() => SF.scene._debug.ridKlar()); await sleep(600);
const pos2 = await D(() => SF.scene._debug.pos());
ok((await toasts()).some((t) => /Pricken stannar/.test(t)) && (await D(() => SF.scene._debug.ponny())).rider === null && Math.abs(pos2.x - 956) < 20, `efter varvet står man vid grinden igen (${Math.round(pos2.x)}, ${Math.round(pos2.y)})`);

// 6. kioskerna
await D(() => SF.scene._debug.teleport(1240, 400)); await sleep(300);
const h0 = await D(() => SF.game.hunger), m4 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('glass')); await sleep(300);
ok(/Mjukglass/.test(await modal()), 'glasskiosken har mjukglass');
await D(() => document.querySelector('#modal [data-vara="strut"]')?.click()); await sleep(400);
ok((await D(() => SF.game.money)) === m4 - 15 && (await D(() => SF.game.hunger)) > h0, 'glassen kostar 15 kr och mättar');
await D(() => SF.scene._debug.act('souvenir')); await sleep(300);
await D(() => document.querySelector('#modal [data-vara="ballong"]')?.click()); await sleep(400);
ok(!!(await D(() => SF.scene._debug.ballong())) && (await D(() => SF.game.money)) === m4 - 25, 'ballongen följer med för 10 kr');

// 7. påfågeln
const pf = await D(() => SF.scene._debug.pafagel());
await D((q) => SF.scene._debug.teleport(q.x + 20, q.y + 2), pf); await sleep(900);
ok((await D(() => SF.scene._debug.pafagel())).st === 'fan', 'påfågeln slår ut stjärten när man kommer nära');

// 8. natten
await D(() => { SF.game.min = 21 * 60 + 30; }); await sleep(1200);
ok((await D(() => SF.scene._debug.djur('lejon'))).some((d) => d.st === 'sov') && (await D(() => SF.scene._debug.djur('bjorn'))).every((d) => d.st === 'sov'), 'om natten sover djuren');
ok(errs.length === 0, 'natten målas utan fel');

// 9. bussen hem
await D(() => { SF.game.min = 14 * 60; }); await D(() => SF.scene._debug.teleport(70, 340)); await sleep(300);
await D(() => SF.scene._debug.act('buss')); await sleep(300);
ok(/Djurbussen/.test(await modal()), 'bussen hem frågar');
await klickGo();
const hem = await p.waitForFunction(() => window.SF.sceneName === 'city', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(hem, 'djurbussen tillbaka → staden');

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
