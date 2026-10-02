// Funktionstest av EGET FÖRETAG – FOODTRUCKEN (game.js TRUCK_*/buyTruck/truckDag/truckPass, js/core/foretag.js,
// js/jobs/jobb-truck.js luckan, js/core/truck-art.js + city.js, GARAGET-tavlan):
//   1. GARAGET: tavlan FOODTRUCK TILL SALU → köp → trucken står i parken
//   2. staden: trucken syns, klick → truckrutan (jobba i luckan / sköta företaget)
//   3. luckan: kunden beställer, man lagar, ställer på hyllan och lämnar ut – rätt = betalt,
//      fel = i soporna; låsta stationer kräver uppgradering; vinsten och ryktet efteråt
//   4. sköta företaget: uppgradera (grill → hamburgare), priser, anställa, flytta trucken
//   5. personalen håller öppet: dagsrapporten på morgonen, regn = färre kunder, platshyran på måndag
//   6. sparfilen; luckan stängd på natten; sälja trucken
//   node tools/truck-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 12 * 60, money: 20000, hunger: 80, energy: 100, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=tr${Date.now().toString(36)}`);
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Anna', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, SAVE);
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const title = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
const text = () => D(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });

// ---------- 1. köpet i garaget ----------
await D(() => SF.go('fordon')); await sleep(1200);
ok(!!(await D(() => SF.scene._debug.spot('foodtruck'))), 'GARAGET: tavlan FOODTRUCK TILL SALU');
await D(() => { const s = SF.scene._debug.spot('foodtruck'); SF.scene.down(s.x, s.y); });
ok(await until(() => /Foodtrucken/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'klick: figuren går dit och köprutan öppnas');
const m0 = await D(() => SF.game.money);
await clickBtn(/Köp/); await sleep(200);
ok((await D(() => SF.game.money)) === m0 - 14900 && (await D(() => SF.game.truck?.plats)) === 'parken', 'trucken köpt för 14 900 kr – den står i parken');
// ---------- 2. staden ----------
await D(() => { SF.cityPos = [800, 400]; SF.go('city'); }); await sleep(1500);
const tr = await D(() => SF.scene._debug.truck());
ok(tr && tr.plats === 'parken' && tr.open === false, 'trucken står i parken (stängd utan personal)');
await D(() => SF.scene._debug.teleport(800, 400)); await sleep(300);
await D(() => { const t = SF.scene._debug.truck(); SF.scene.down(t.x, t.y); });
ok(await until(() => /KÖK/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), 12000), `klick på trucken: truckrutan (${await title()})`);
ok(/Jobba i luckan/.test(await text()) && /Sköta företaget/.test(await text()), 'jobba i luckan / sköta företaget');
// ---------- 3. luckan ----------
await clickBtn(/Jobba i luckan/);
ok(await until(() => SF.sceneName === 'jobbtruck'), 'in i luckan');
await sleep(300);
ok((await D(() => SF.scene._debug.meny().sort().join(','))) === 'dricka,korv', 'från början: korv och dricka');
await D(() => SF.scene._debug.cook('burgare')); await sleep(100);
ok((await D(() => SF.scene._debug.shelf().filter(Boolean).length)) === 0, 'stora grillen är låst utan uppgradering');
const spot = await D(() => SF.scene._debug.force(['korv', 'dricka']));
await D(() => { const d = SF.scene._debug; d.cook('korv'); d.cook('dricka'); d.fastCook(); }); await sleep(200);
ok((await D(() => SF.scene._debug.shelf().filter(Boolean).sort().join(','))) === 'dricka,korv', 'korven grillad och drickan uppställd på hyllan');
for (let i = 0; i < 2; i++) { await D((spot) => { const d = SF.scene._debug, sh = d.shelf(); d.pick(sh.findIndex(Boolean)); d.serveTo(spot); }, spot); await sleep(100); }
let st = await D(() => SF.scene._debug.stats());
ok(st.ok === 1 && st.kr === 40 && st.sald.sort().join(',') === 'dricka,korv', `rätt till kunden: betalt 40 kr (${JSON.stringify(st)})`);
const spot2 = await D(() => SF.scene._debug.force(['korv']));
await D(() => { const d = SF.scene._debug; d.cook('dricka'); }); await sleep(100);
await D((spot) => { const d = SF.scene._debug, sh = d.shelf(); d.pick(sh.findIndex(Boolean)); d.serveTo(spot); }, spot2); await sleep(100);
st = await D(() => SF.scene._debug.stats());
ok(st.fel === 1 && st.ok === 1, 'fel rätt: FEL! och den åker i soporna');
const mA = await D(() => SF.game.money), rA = await D(() => SF.game.truck.rykte);
await D(() => SF.scene._debug.end());
ok(await until(() => /Luckan stänger/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), 6000), 'luckan stänger: lönebeskedet');
ok((await D(() => SF.game.money)) - mA === 30, `vinst: 40 kr försäljning − 10 kr råvaror = 30 kr`);
ok(/Vinst/.test(await text()) && /Ryktet/.test(await text()), 'beskedet visar vinsten och ryktet');
await clickBtn(/Ta vinsten/);
ok(await until(() => SF.sceneName === 'city'), 'tillbaka i staden vid trucken');
// ---------- 4. sköta företaget ----------
await D(async () => { const F = await import('./js/core/foretag.js'); F.openForetag(SF); }); await sleep(200);
ok(/företaget/i.test(await title()) && /Bokföringen/i.test(await text()), 'skötselrutan: plats, priser, meny, personal, bokföring');
await D(() => document.querySelector('#modal [data-uppg="grill"]').click()); await sleep(150);
ok((await D(() => SF.game.truckMeny().map((m) => m.id).includes('burgare'))), 'stor grill köpt: hamburgare på menyn');
await D(() => document.querySelector('#modal [data-pris="hog"]').click()); await sleep(150);
ok((await D(() => SF.game.truck.priser)) === 'hog', 'höga priser valda');
await D(() => document.querySelector('#modal [data-anstall]').click()); await sleep(150);
ok((await D(() => SF.game.truck.personal.length)) === 1, 'en anställd');
await D(() => document.querySelector('#modal [data-plats="downtown"]').click()); await sleep(250);
ok((await D(() => SF.game.truck.plats)) === 'downtown' && (await D(() => SF.scene._debug.truck()?.plats)) === 'downtown', 'trucken flyttad till Tjurtorget i downtown');
await closeDlg();
// ---------- 5. personalens dag ----------
await D(() => { SF.game.truck.priser = 'vanlig'; });
const dag = await D(() => { const g = SF.game; g.event = null; const m = g.money; const r = g.sleep(); return { r: r.truckDag, logg: g.truck.logg.length }; });
ok(dag.r && dag.r.kunder > 0 && dag.logg === 1, `dagsrapport: ${dag.r?.kunder} kunder, vinst ${dag.r?.vinst} kr`);
await D(async (td) => { const m = await import('./js/core/week.js'); m.openWeek(SF, { morning: true, truckDag: td }); }, dag.r); await sleep(200);
ok(/Foodtrucken i går/.test(await text()), 'morgonrutan: Foodtrucken i går …');
await closeDlg();
const regn = await D(() => { const g = SF.game; g.event = { id: 'regn' }; const a = g.truckDag(99); g.event = null; const b = g.truckDag(100); return [a.kunder, b.kunder]; });
ok(regn[0] < regn[1], `regn: färre kunder (${regn[0]} mot ${regn[1]})`);
const hyra = await D(() => { const g = SF.game; g.day = 7; g.truck.personal = []; const m = g.money; g.sleep(); return { platshyra: g.truck.platshyra }; });
ok(hyra.platshyra === 650, 'måndag: platshyran 650 kr för downtown');
// ---------- 6. sparfil, natt, sälja ----------
await D(() => SF.game.save());
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await sleep(500);
const T = await D(() => SF.game.truck);
ok(T && T.plats === 'downtown' && T.uppg.includes('grill'), 'trucken sparas (plats, uppgraderingar)');
await D(() => { SF.game.min = 22 * 60; }); await D(async () => { const F = await import('./js/core/foretag.js'); F.openTruck(SF); }); await sleep(200);
ok(!/Jobba i luckan/.test(await text()) && /öppnar 8:00/.test(await text()), 'kl 22: luckan är stängd');
await closeDlg();
const mS = await D(() => SF.game.money);
const kr = await D(() => SF.game.saljTruck());
ok(kr > 8000 && (await D(() => SF.game.money)) === mS + kr && !(await D(() => SF.game.truck)), `trucken såld tillbaka för ${kr} kr`);

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
