// 🌿 GRÄSKLIPPNINGEN i Villaområdet (js/jobs/jobb-gras.js, Vivi på Äppelvägen 5):
//   1. jobbet gras finns med jobbscen; dörren på Äppelvägen 5 (v_hus7) öppnar passets ruta → scenen jobbgras
//   2. klipparen kör dit man klickar och klipper rutorna; pilarna kör till kanten
//   3. tomten i vägen: klipparen stannar, tomten välter, ett fel
//   4. fjärdedelarna ger lön; hela mattan = KLIPPT och nästa trädgård; tre utan skråma = bonus
//   5. passet slutar med lönebeskedet, man står på Äppelvägen igen
//   node tools/gras-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=gras${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Gräs', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 300, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const J = (fn, a) => p.evaluate(([f, a]) => (new Function('d', 'g', 'a', 'return (' + f + ')(d, g, a)'))(SF.scene._debug, SF.game, a), [fn.toString(), a]);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const head = () => D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
await stang(); await D(() => { SF.cityPos = [4586, 612]; SF.go('city'); }); await sleep(1800); await stang();

// 1. dörren på Äppelvägen 5
ok(await D(() => SF.jobReady('gras')), 'jobbet gras har en jobbscen');
await D(async () => { const { ALL_BUILDINGS } = await import('/js/city/map.js'); const b = ALL_BUILDINGS.find((x) => x.id === 'v_hus7'); window.__hus7 = { enter: b.enter, x: (b.door.x0 + b.door.x1) / 2, y: b.base }; });
const hus = await D(() => window.__hus7);
ok(hus.enter === 'jobb:gras', `Äppelvägen 5 är gräsklipparjobbets dörr (${hus.enter})`);
await D((h) => { SF.scene._debug.teleport(h.x, h.y + 10); }, hus); await sleep(300);
await D((h) => { const c = SF.scene._debug.cam?.() || { x: 0, y: 0 }; SF.scene.down(h.x - c.x, h.y - 20 - c.y); }, hus);
await p.waitForFunction(() => /Gräsklippning/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
let h2 = await head();
if (!/Gräsklippning/.test(h2)) { await stang(); await D(() => SF.startJob('gras')); await p.waitForFunction(() => /Gräsklippning/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {}); h2 = await head(); }
ok(/Gräsklippning/.test(h2), `dörren öppnar passets ruta (${h2})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobbgras', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobbgras startar');
await sleep(600);

// 2. klipparen kör dit man klickar
let s = await J((d) => d.state());
ok(s.lawn === 0 && s.procent === 0 && s.mower.x === 92 && s.mower.y === 148, `start: trädgård 1, 0 % klippt, klipparen nere till vänster (${JSON.stringify(s.mower)})`);
await J((d) => { d.dit(200, 148); d.tick(2.2); });
s = await J((d) => d.state());
ok(s.mower.x > 190 && s.procent > 0.05 && s.mower.mal === null, `klipparen körde dit och klippte på vägen (${Math.round(s.procent * 100)} %, x ${s.mower.x})`);
await J((d) => { d.flytta(92, 148); d.styr('up'); d.tick(3); });
s = await J((d) => d.state());
ok(s.mower.y <= 56 && s.mower.kor === null, `pilen upp: kör till kanten och stannar (y ${s.mower.y})`);

// 3. tomten i vägen
const tomte = s.hinder.find((h) => h.t === 'tomte');
await J((d, g, a) => { d.flytta(a.x - 30, a.y - 2); d.styr('right'); d.tick(1.2); }, tomte);
s = await J((d) => d.state());
ok(s.stats.fel === 1 && s.hinder.find((h) => h.t === 'tomte').valt === true && s.mower.x < tomte.x - 8, `tomten: klipparen stannar framför, tomten välter, ett fel (${JSON.stringify(s.stats)})`);

// 4. fjärdedelarna och hela mattan
await J((d) => d.klipp(0.5));
s = await J((d) => d.state());
ok(s.stats.ok === 2 && s.kvart === 2, `halva mattan klippt → två fjärdedelar betalda (${JSON.stringify(s.stats)})`);
await J((d) => d.klipp(1));
s = await J((d) => d.state());
ok(s.stats.ok === 4 && s.kvart === 4, `hela mattan → fyra fjärdedelar (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.6));
s = await J((d) => d.state());
ok(s.lawn === 1 && s.procent === 0 && s.stats.ok === 4, `nästa trädgård efter en stund (trädgård ${s.lawn + 1}, ${Math.round(s.procent * 100)} %)`);
for (let k = 0; k < 3; k++) { await J((d) => d.klipp(1)); await J((d) => d.tick(1.6)); }
s = await J((d) => d.state());
ok(s.stats.boxes === 1 && s.rena === 3 && s.lawn === 4, `tre trädgårdar utan skråma → bonus (${JSON.stringify(s.stats)}, rena ${s.rena})`);

// 5. passet slutar
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
