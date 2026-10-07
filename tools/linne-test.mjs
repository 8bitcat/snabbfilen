// Funktionstest av LINNÉSTADEN (v4) – den nya stadsdelen väster om centrum (x −1200–0):
//   1. kartkontraktet håller (validateMap) och världen börjar i CITY.X0
//   2. stadsdelen finns: områdesskylten, husen med egen konst (inga reservfasader), trottoarmöblerna
//   3. man kan gå dit från centrum (gånggrid + walk.js över x 0) och runt på torget och i Lindparken
//   4. folklivet: fotgängare i Linnéstaden; trafiken: bilar på Pixelgatan väster om x 0
//   5. bussen stannar vid MARKNADSTORGET, taxin hittar dit (kartan har ikonerna)
//   6. kvällen: fönster, skyltfönster, lyktor och ljusslingor lyser utan fel
//   node tools/linne-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/favicon|ERR_|404/.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=linne${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Linnea', look: { skin: '#eec3a0', hair: '#7a4a24', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 11 * 60, money: 20000, hunger: 70, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 12000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(150); } return false; };
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });

// ---------- 1 ----------
const m1 = await D(async () => { const M = await import('/js/city/map.js'); return { bad: M.validateMap(), x0: M.CITY.X0, n: M.BUILDINGS_L.length, d: M.districtAt(-600, 300).id }; });
ok(m1.bad.length === 0, 'kartkontraktet håller' + (m1.bad.length ? ' – ' + m1.bad.slice(0, 3).join(' | ') : ''));
ok(m1.x0 === -1200 && m1.d === 'linne', `världen börjar i x ${m1.x0}, x −600 hör till Linnéstaden`);
ok(m1.n >= 19, `${m1.n} hus i Linnéstaden`);

// ---------- 2 ----------
await D(() => SF.go('city')); await sleep(1500);
await D(() => SF.scene._debug.district('linne')); await sleep(600);
ok(await D(() => SF.scene._debug.districtNow() === 'LINNÉSTADEN'), 'man står i Linnéstaden');
const art = await D(async () => {
  const L = await import('/js/city/buildings-linne.js'), M = await import('/js/city/map.js');
  const missing = M.BUILDINGS_L.filter((b) => !L.BUILDING_ART[b.kind]).map((b) => b.id);
  let painted = 0, items = 0, obs = 0;
  for (const b of M.BUILDINGS_L) {
    const A = L.BUILDING_ART[b.kind];
    for (const night of [false, true]) { const c = A.paint(b, night, { snow: night ? 1 : 0 }); if (c && c.width === b.w + 16) painted++; }
    items += A.items(b).length; obs += A.obstacles(b).length;
  }
  return { missing, painted, items, obs, n: M.BUILDINGS_L.length };
});
ok(art.missing.length === 0, 'varje hus har egen konst' + (art.missing.length ? ' – saknas: ' + art.missing.join(', ') : ''));
ok(art.painted === art.n * 2, `alla ${art.n} hus målas dag och natt (med snö)`);
ok(art.items > 30 && art.items === art.obs, `${art.items} trottoarmöbler med hinder`);
await sleep(800);
await p.locator('#scene').screenshot({ path: 'tools/out/linne-dag.png' }).catch(() => {});

// ---------- 3: gå dit från centrum ----------
await D(() => SF.scene._debug.teleport(120, 296)); await sleep(300);
const steps = await D(() => SF.scene._debug.walkTo(-700, 300));
ok(steps > 0, 'en väg från centrum till Marknadstorget');
ok(await until(() => { const q = SF.scene._debug.pos(); return q.x < -650; }, 16000), 'figuren går västerut in i Linnéstaden');
ok(await D(() => SF.scene._debug.walkable(-744, 420) && SF.scene._debug.walkable(-168, 340) && !SF.scene._debug.walkable(-1160, 336)), 'torget och promenaden är gåbara, pallkragarna inte');
await D(() => SF.scene._debug.teleport(-300, 340)); await sleep(200);
ok((await D(() => SF.scene._debug.walkTo(-168, 440))) > 0, 'en väg runt musikpaviljongen');

// ---------- 4: livet och trafiken ----------
const life = await D(async () => {
  await new Promise((r) => setTimeout(r, 4000));
  const S = SF.scene._debug.sim(), ppl = S.life._debug?.peds?.() || [];
  const cars = S.traffic.vehicles?.() || [];
  const nav = S.life._debug?.nav, wn = nav ? nav.nodes.filter((n) => n.x < 0).length : 0;
  return { n: ppl.length, west: ppl.filter((q) => q.x < 0).length, cars: cars.length, carsW: cars.filter((c) => c.axis === 'x' && c.x0 < 0).length, wn };
});
console.log('   (folk', life.n, 'varav', life.west, 'i Linnéstaden; fordon', life.cars, 'varav', life.carsW, 'väster om x 0)');
ok(life.wn > 40, `gångnätet når in i Linnéstaden (${life.wn} noder)`);
ok(life.west > 0, 'fotgängare i Linnéstaden');
ok(life.cars > 0, 'trafiken kör');

// ---------- 5: bussen och taxin ----------
await D(() => SF.scene._debug.teleport(640, 296)); await sleep(300);
await D(() => SF.scene._debug.busTo('marknadstorget'));
ok(await until(() => { const q = SF.scene._debug.pos(); return Math.abs(q.x - -560) < 120 && SF.scene._debug.districtNow() === 'LINNÉSTADEN'; }, 20000), 'bussen kör till MARKNADSTORGET');
const tq = await D(async () => { const C = await import('/js/city/citymap.js'), M = await import('/js/city/map.js'); const b = M.buildingById('l_kafe'); const q = C.taxiQuote({ x: 640, y: 296 }, b); const info = C._mapInfo(); C.renderCityMap(); return { kr: q.kr, m: q.m, x0: info.x0, w: info.w, s: info.surfaceAt(-744, 400) }; });
ok(tq.kr > 25 && tq.m > 0, `taxin till Kafé Linden kostar ${tq.kr} kr (${tq.m} m)`);
ok(tq.x0 <= -1200 && tq.s === 'torg', 'kartan börjar vid Linnéstaden och visar torget');
await D(() => SF.openCityMap?.());

// ---------- 6: kvällen ----------
await D(() => { SF.game.min = 21 * 60; }); await sleep(300);
await D(() => SF.scene._debug.teleport(-740, 300)); await sleep(1500);
await p.locator('#scene').screenshot({ path: 'tools/out/linne-kvall.png' }).catch(() => {});
await D(() => SF.scene._debug.weather({ kind: 'regn', intensity: 1, season: 'host', temp: 8 })); await sleep(900);
await D(() => SF.scene._debug.weather({ kind: 'sno', intensity: 1, season: 'vinter', temp: -4, snowCover: 1 })); await sleep(900);
await D(() => SF.scene._debug.weather(null)); await sleep(300);
ok(errs.length === 0, 'inga fel i konsolen' + (errs.length ? ' – ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
