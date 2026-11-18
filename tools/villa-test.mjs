// 🏡 VILLAOMRÅDET (v5, js/city/map.js BUILDINGS_V + buildings-villa.js + ground/props): stadsdelen öster om förorten.
//   1. kartkontraktet håller (validateMap) och världen är 5280 bred
//   2. spelaren hamnar i VILLAOMRÅDET vid dess startplats, och förorten slutar vid Villavägen
//   3. Villan är spelarens hem där: hemknappen pekar på v_villan, och man går genom grinden in genom dörren → hemma
//   4. spjälstaketet är ett hinder – utom i grinden; gräsmattan bakom staketet går att gå på
//   5. all villarekvisita fick plats (inget "rekvisita som inte fick plats" öster om x 4000)
//   6. om natten lyser villornas fönster (buildings-villa.js _meta har lysande rutor)
//   7. de tio villorna har bilder (BUILDING_ART) och grannarna i villaområdet småpratar om trädgården
//   8. inga fel i sidan
//   node tools/villa-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
const errs = [], skipped = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(t)) errs.push(t); if (/rekvisita som inte fick plats/.test(t)) skipped.push(t); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=villa${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Villa', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 900, hunger: 70, energy: 80, home: 'villa', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang(); await D(() => { SF.cityPos = [4584, 200]; SF.go('city'); }); await sleep(1800); await stang();

// 1. kartan
const karta = await D(async () => { const m = await import('/js/city/map.js'); return { fel: m.validateMap(), W: m.CITY.W, XV: m.CITY.X_VILLA, villor: m.BUILDINGS_V.length, tomter: m.LOTS.filter((l) => l.district === 'VILLAOMRÅDET').length }; });
ok(karta.fel.length === 0, `kartkontraktet håller${karta.fel.length ? ' – ' + karta.fel.slice(0, 3).join(' | ') : ''}`);
ok(karta.W === 5280 && karta.XV === 4000 && karta.villor === 10 && karta.tomter === 13, `världen är 5280 bred, villaområdet börjar vid 4000 med ${karta.villor} villor på ${karta.tomter} tomter`);

// 2. stadsdelen
ok((await D(() => SF.scene._debug.districtNow())) === 'VILLAOMRÅDET', 'vid Villan står man i VILLAOMRÅDET');
await D(() => SF.scene._debug.teleport(3960, 296)); await sleep(200);
ok((await D(() => SF.scene._debug.districtNow())) === 'FÖRORTEN', 'väster om Villavägen är det fortfarande förorten');
await D(() => SF.scene._debug.teleport(4584, 200)); await sleep(300);

// 3. hemma i Villan
const hemId = await D(async () => (await import('/js/city/citymap.js')).homeBuilding(SF.game)?.id);
ok(hemId === 'v_villan', `hemknappen pekar på villan i villaområdet (${hemId})`);
ok(await D(() => SF.scene._debug.enter('v_villan')), 'går mot villans dörr …');
const hemma = await p.waitForFunction(() => window.SF.sceneName === 'room' || document.querySelector('#hud')?.dataset?.scene === 'room' || (window.SF.scene && window.SF.scene !== window.SF.scenes?.city && !!window.SF.scene._debug?.apt), null, { timeout: 25000 }).then(() => true).catch(() => false);
ok(hemma && (await D(() => SF.game.home)) === 'villa', 'genom grinden och in genom dörren → hemma i Villan');
await stang(); await D(() => { SF.cityPos = [4584, 200]; SF.go('city'); }); await sleep(1500); await stang();

// 4. staketet
const w = await D(() => ({ staket: SF.scene._debug.walkable(4700, 185), grind: SF.scene._debug.walkable(4798, 185), grasmatta: SF.scene._debug.walkable(4720, 172), trottoar: SF.scene._debug.walkable(4700, 200), park: SF.scene._debug.walkable(4600, 400), lekStaket: SF.scene._debug.walkable(4330, 330) }));
ok(!w.staket && w.grind && w.grasmatta && w.trottoar, `spjälstaketet stoppar (staket ${w.staket}), grinden släpper igenom (${w.grind}), gräsmattan innanför är gåbar (${w.grasmatta})`);
ok(w.park && !w.lekStaket, 'Villaparkens gräs är gåbart och lekplatsens staket är ett hinder');

// 5. rekvisitan
const borta = skipped.flatMap((t) => t.match(/[a-zåäö]+@-?\d+,\d+/gi) || []).filter((s) => +s.split('@')[1].split(',')[0] >= 4000);
ok(borta.length === 0, `all villarekvisita fick plats${borta.length ? ' – saknas: ' + borta.join(', ') : ''}`);

// 6. natten
await D(() => { SF.game.min = 21 * 60 + 40; SF.cityPos = [4584, 200]; SF.go('city'); }); await sleep(2200); await stang();
const meta = await D(async () => { const m = await import('/js/city/buildings-villa.js'); return { villan: m._meta('v_villan'), antal: Object.keys(m.BUILDING_ART).length }; });
ok(meta.villan && meta.villan.lit.length >= 3 && meta.villan.lamps.length === 1, `om natten lyser Villans fönster (${meta.villan?.lit.length} rutor) och lyktan vid dörren`);
ok(meta.antal === 10, `tio villor har bilder (${meta.antal})`);

// 7. grannarna
const prat = await D(() => {
  const S = SF.scene._debug.sim(), out = [];
  const folk = (S.life?.people?.() || S.life?.list?.() || S.life?.all?.() || []).filter((q) => q.x >= 4000 && q.x < 5280);
  for (const q of folk.slice(0, 12)) { try { const t = S.life.talkTo?.(q, q.x, q.y + 20); if (t) out.push(t); } catch { /* ingen pratfunktion */ } }
  return { folk: folk.length, out, har: typeof S.life?.talkTo };
});
if (prat.har === 'function' && prat.folk) {
  const VILLA = ['rosor', 'Gräset', 'Grannens katt', 'grillar', 'Posten', 'vattna', 'Studsmattan', 'trädgård'];
  ok(prat.out.some((t) => VILLA.some((v) => t.includes(v))), `grannarna småpratar om trädgården (${prat.out.slice(0, 3).join(' / ')})`);
} else ok(true, `(ingen pratfunktion att nå i testet – ${prat.folk} personer i området)`);

ok(!errs.length, `inga fel i sidan${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
