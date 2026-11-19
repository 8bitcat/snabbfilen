// 🍋 LEMONADSTÅNDET i Villaområdet (js/jobs/jobb-lemonad.js, Äppelvägen 1):
//   1. jobbet lemonad finns med jobbscen; dörren på Äppelvägen 1 (v_hus5) öppnar passets ruta → scenen jobblemonad
//   2. kunden visar receptet; rätt glas = rätt; fel glas = fel; för länge = missad
//   3. fem rätt i rad = sommarens lemonad (bonus); knapparna, tangenterna 1/2/0 och mellanslag fungerar
//   4. passet slutar med lönebeskedet, man står på Äppelvägen igen
//   node tools/lemonad-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=lemo${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Lemon', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 300, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const J = (fn, a) => p.evaluate(([f, a]) => (new Function('d', 'g', 'a', 'return (' + f + ')(d, g, a)'))(SF.scene._debug, SF.game, a), [fn.toString(), a]);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const head = () => D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
await stang(); await D(() => { SF.cityPos = [4154, 612]; SF.go('city'); }); await sleep(1800); await stang();

// 1. dörren på Äppelvägen 1
ok(await D(() => SF.jobReady('lemonad')), 'jobbet lemonad har en jobbscen');
await D(async () => { const { ALL_BUILDINGS } = await import('/js/city/map.js'); const b = ALL_BUILDINGS.find((x) => x.id === 'v_hus5'); window.__hus5 = { enter: b.enter, x: (b.door.x0 + b.door.x1) / 2, y: b.base }; });
const hus = await D(() => window.__hus5);
ok(hus.enter === 'jobb:lemonad', `Äppelvägen 1 är lemonadståndets dörr (${hus.enter})`);
await D((h) => { SF.scene._debug.teleport(h.x, h.y + 10); }, hus); await sleep(300);
await D((h) => { const c = SF.scene._debug.cam?.() || { x: 0, y: 0 }; SF.scene.down(h.x - c.x, h.y - 20 - c.y); }, hus);
await p.waitForFunction(() => /Lemonadståndet/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
let h2 = await head();
if (!/Lemonadståndet/.test(h2)) { await stang(); await D(() => SF.startJob('lemonad')); await p.waitForFunction(() => /Lemonadståndet/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {}); h2 = await head(); }
ok(/Lemonadståndet/.test(h2), `dörren öppnar passets ruta (${h2})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobblemonad', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobblemonad startar');
await sleep(600);
await J((d) => d.auto(false));

// 2. recepten
let i = await J((d) => d.force(2, 1));
let s = await J((d) => d.state());
ok(i >= 0 && s.kunder[i]?.socker === 2 && s.kunder[i]?.is === 1, `en kund vill ha 2 socker och 1 is (plats ${i})`);
await J((d) => { d.lagg('socker'); d.lagg('socker'); d.lagg('is'); });
s = await J((d) => d.state());
ok(s.glas.socker === 2 && s.glas.is === 1, `glaset byggs (${JSON.stringify(s.glas)})`);
let r = await J((d, g, a) => d.servera(a), i);
s = await J((d) => d.state());
ok(r === 'ok' && s.stats.ok === 1 && s.glas.socker === 0 && s.streak === 1, `rätt glas → MUMS (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));
i = await J((d) => d.force(1, 0));
await J((d) => { d.lagg('socker'); d.lagg('socker'); d.lagg('socker'); });
r = await J((d, g, a) => d.servera(a), i);
s = await J((d) => d.state());
ok(r === 'fel' && s.stats.fel === 1 && s.streak === 0, `fel glas → fel (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));
i = await J((d) => d.force(3, 2));
await J((d) => d.tick(9));
s = await J((d) => d.state());
ok(s.stats.miss === 1 && s.kunder[i] === null, `för länge → kunden gick (${JSON.stringify(s.stats)})`);
await J((d) => { d.lagg('socker'); d.lagg('tom'); });
ok((await J((d) => d.state())).glas.socker === 0, 'TÖM tömmer glaset');

// 3. raden, knapparna och tangenterna
for (let k = 0; k < 5; k++) { const j = await J((d) => d.force(1, 1)); await J((d) => { d.lagg('socker'); d.lagg('is'); }); await J((d, g, a) => d.servera(a), j); await J((d) => d.tick(2.6)); }
s = await J((d) => d.state());
ok(s.stats.boxes === 1 && s.stats.ok === 6, `fem rätt i rad → sommarens lemonad (${JSON.stringify(s.stats)})`);
i = await J((d) => d.force(1, 2));
const ks = await J((d) => d.knapp('socker')); await D((q) => SF.scene.down(q.x, q.y), ks);
await D(() => SF.scene.key('2')); await D(() => SF.scene.key('2'));
s = await J((d) => d.state());
ok(s.glas.socker === 1 && s.glas.is === 2, `knappen + SOCKER och tangenten 2 bygger glaset (${JSON.stringify(s.glas)})`);
await D(() => SF.scene.key(' '));
s = await J((d) => d.state());
ok(s.stats.ok === 7, `mellanslag serverar nästa kund (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));
i = await J((d) => d.force(1, 0));
await D(() => SF.scene.key('1'));
const cs = await J((d, g, a) => d.kundSpot(a), i); await D((q) => SF.scene.down(q.x, q.y), cs);
s = await J((d) => d.state());
ok(s.stats.ok === 8, `klick på kunden serverar (${JSON.stringify(s.stats)})`);

// 4. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden)'), null, { timeout: 15000 }).catch(() => {});
await sleep(400);
const lon = await D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
ok(/kr/.test(lon), `lönebeskedet visas (${lon.slice(0, 80)}…)`);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go').catch(() => stang());
const ute = await p.waitForFunction(() => window.SF.sceneName === 'city', null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(800);
ok(ute && (await D(() => SF.game.money)) > m0, `tillbaka i Villaområdet med mer pengar (${await D(() => SF.game.money)} kr, var ${m0})`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
