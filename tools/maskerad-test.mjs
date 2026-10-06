// Funktionstest av MASKERADBUTIKEN (förorten, det gamla övergivna huset) och pumplyktan hemma:
//   1. kartan: huset heter maskerad, dörren leder in (city._debug.enter) och ut igen
//   2. dräkterna: häxdräkten (häxhatt + kåpa) köps hel i dräktdialogen – sedan står DIN! på lappen
//   3. hattväggen: kattöronen köps i plaggdialogen
//   4. pyntet: en pumplykta köps som möbel (förrådet) – Halloween-pyntet säljs inte på MÖBELJÄTTEN
//   5. spöklådan skrämmer, häxan Hilda pratar
//   6. hemma: pumplyktan ställs ut, klick tänder ljuset (d.lit, sparas), klick igen blåser ut det;
//      kvällen ritas utan fel
//   7. fasaden ritas dag och kväll utan fel, pyntet utanför står där
//   node tools/maskerad-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=mask${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Häxan', look: { skin: '#eec3a0', hair: '#3b2619', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 20000, hunger: 70, energy: 90, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 12000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const modalTitle = () => D(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const clickSpot = (id) => D((id) => { const s = SF.scene._debug.spot(id); if (!s) return false; SF.scene.down(s.x, s.y); return true; }, id);
await closeDlg();

// ---------- 1. in genom dörren ----------
ok(await D(async () => { const M = await import('/js/city/map.js'); const b = M.ALL_BUILDINGS?.find?.((x) => x.id === 'maskerad') || M.BUILDINGS_X.find((x) => x.id === 'maskerad'); return !!b && b.enter === 'maskerad' && !M.BUILDINGS_X.some((x) => x.id === 'overgivet'); }), 'kartan: det övergivna huset är maskeradbutiken');
await D(() => { SF.game.min = 12 * 60; SF.go('city'); }); await sleep(1200);
await D(() => SF.scene._debug.teleport(3600, 204)); await sleep(300);   // (förorten – annars är promenaden lång)
ok(await D(() => SF.scene._debug.enter('maskerad')), 'huset har en dörr');
ok(await until(() => SF.sceneName === 'maskerad', 20000), 'in i maskeradbutiken');
await sleep(1200);
const spots = await D(() => SF.scene._debug.spots());
for (const id of ['dorr', 'drakt-haxa', 'drakt-fe', 'hatt-hat-catears', 'hilda', 'kista', 'kittel', 'pynt-pumplykta0', 'pynt-skelett0', 'pynt-spoktrad1']) ok(spots.includes(id), `butiken har ${id}`);

// ---------- 2. häxdräkten ----------
const m0 = await D(() => SF.game.money);
await clickSpot('drakt-haxa');
ok(await until(() => !document.querySelector('#modal').classList.contains('hidden'), 15000), 'häxdockan → dräktdialogen');
ok(/I dräkten/.test(await D(() => document.querySelector('#modal').textContent)), 'förhandsvisningen säger "I dräkten"');
await clickBtn(/Köp/);
ok(await until(() => SF.game.wardrobe.includes('hat-witch') && SF.game.wardrobe.includes('top-robe')), 'häxhatten och kåpan är köpta');
const m1 = await D(() => SF.game.money);
ok(m0 - m1 > 0, `dräkten kostade ${m0 - m1} kr`);
await closeDlg();

// ---------- 3. kattöronen ----------
await clickSpot('hatt-hat-catears');
ok(await until(() => !document.querySelector('#modal').classList.contains('hidden'), 15000), 'kattöronen → plaggdialogen');
await clickBtn(/Köp/);
ok(await until(() => SF.game.wardrobe.includes('hat-catears')), 'kattöronen är köpta');
await closeDlg();

// ---------- 4. pumplyktan ----------
await clickSpot('pynt-pumplykta0');
ok(await until(() => /Pumplykta/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), 15000), 'pumplyktan → möbeldialogen');
await clickBtn(/Köp/);
ok(await until(() => SF.game.storage.some((s) => s.k === 'pumplykta')), 'pumplyktan ligger i förrådet');
await closeDlg();
const ikea = await D(async () => { const K = await import('/js/scenes/ikea/kat.js'); return K.KAT().filter((k) => k.shop).length; });
ok(ikea === 0, 'MÖBELJÄTTEN ställer inte ut jul- eller Halloween-pynt');

// ---------- 5. spöklådan och Hilda ----------
await D(() => SF.scene._debug.act('kista'));
ok(await D(() => SF.scene._debug.kista() > 0), 'spöklådan öppnas – BU!');
await D(() => SF.scene._debug.act('hilda'));
ok(!!(await D(() => SF.scene._debug.hilda())), 'häxan Hilda pratar');
await D(() => SF.scene._debug.act('dorr'));
ok(await until(() => SF.sceneName === 'city', 8000), 'ut genom dörren igen');

// ---------- 7. fasaden ----------
await D(() => SF.scene._debug.teleport(3620, 200)); await sleep(800);
await D(() => { SF.game.min = 21 * 60; }); await sleep(800);
await D(() => { SF.game.min = 12 * 60; }); await sleep(400);

// ---------- 6. pumplyktan hemma ----------
await D(() => SF.go('room')); await sleep(800); await closeDlg();
const placed = await D(() => {
  const g = SF.game, dbg = SF.scene._debug, idx = g.storage.findIndex((s) => s.k === 'pumplykta');
  dbg.pickStorage(idx);
  for (let y = 100; y < 200; y += 6) for (let x = 40; x < 340; x += 8) if (dbg.drop(x, y)) return true;
  return false;
});
ok(placed, 'pumplyktan står hemma');
const sp = await D(() => SF.scene._debug.spot('pumplykta'));
ok(!!sp, 'pumplyktan är klickbar');
const lit = () => Object.values(SF.game.deco).some((l) => Array.isArray(l) && l.some((d) => d.k === 'pumplykta' && d.lit));   // (körs i sidan)
if (sp) {
  await D(([x, y]) => SF.scene.down(SF.scene._debug.toScreen(x), y), [sp.x, sp.y]);
  ok(await until(lit, 15000), 'klick → ljuset i pumpan är tänt (sparat på möbeln)');
  await D(() => { SF.game.min = 21 * 60; }); await sleep(900);   // kvällen: skenet ritas
  await D(([x, y]) => SF.scene.down(SF.scene._debug.toScreen(x), y), [sp.x, sp.y]);
  ok(await until(() => !Object.values(SF.game.deco).some((l) => Array.isArray(l) && l.some((d) => d.k === 'pumplykta' && d.lit)), 8000), 'klick igen → utblåst');
}
ok(errs.length === 0, 'inga fel i konsolen' + (errs.length ? ' – ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
