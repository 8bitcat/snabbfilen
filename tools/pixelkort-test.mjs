// Regressionstest för 🃏 PIXELKORTEN (js/core/pixelkort.js, kortapp.js, presenter.js, shop-leksaker.js kortstället,
// vannerapp.js dubbletter). Carl 2026-10-12: "pixelkort och byteshandel".
//   • 46 kort i sex serier, alla bilder ritas (med pixlar) i alla fyra sällsyntheter
//   • dragningen följer vikterna (vanliga oftast, legendariska sällan)
//   • komplett serie → 500 kr + guldpokal i förrådet (en gång)
//   • presenterna: dagens ibland ett kort, de stora ofta ett kortpaket
//   • kortstället vid kassan i leksaksaffären: köp ett paket (25 kr) → tre kort i albumet och tre kort i dialogen
//   • albumet i mobilen: flikar per serie, kort man har och tomma platser
//   • dubbletter kan väljas som vänskapsgåva; samlingen finns kvar efter omladdning
// Kör: node tools/pixelkort-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT). SHOTS=1 sparar bilder.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=pk${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-pk', name: 'Kortis', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 11 * 60, money: 1000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
const shot = (n) => (process.env.SHOTS ? p.screenshot({ path: `tools/out/${n}.png` }).catch(() => {}) : null);

// ---- korten och bilderna ----
const bild = await p.evaluate(async () => {
  const m = await import('/js/core/pixelkort.js'), tomma = [];
  for (const K of m.KORT) { const c = await m.kortBild(K.id); const d = c.getContext('2d').getImageData(3, 3, 26, 30).data; const farger = new Set(); for (let i = 0; i < d.length; i += 4) farger.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (farger.size < 6) tomma.push(K.id); }
  const serier = {}; for (const K of m.KORT) serier[K.serie] = (serier[K.serie] || 0) + 1;
  return { n: m.KORT.length, serier, rar: [0, 1, 2, 3].map((r) => m.KORT.filter((k) => k.rar === r).length), tomma };
});
ok(bild.n === 46 && Object.keys(bild.serier).length === 6 && bild.rar.every((x) => x > 0), `46 kort i sex serier, alla fyra sällsyntheterna (${JSON.stringify(bild.serier)} ${bild.rar})`);
ok(!bild.tomma.length, `alla kortbilder har ett motiv${bild.tomma.length ? ' – TOMMA: ' + bild.tomma.join(', ') : ''}`);
const drag = await p.evaluate(async () => { const m = await import('/js/core/pixelkort.js'); const n = [0, 0, 0, 0]; for (let i = 0; i < 4000; i++) n[m.kortById(m.draKort()).rar]++; return n; });
ok(drag[0] > drag[1] && drag[1] > drag[2] && drag[2] > drag[3] && drag[3] > 20 && drag[3] < 200, `dragningen: vanliga oftast, legendariska sällan (${drag.join(' / ')} av 4000)`);
// komplett serie
const serie = await p.evaluate(async () => {
  const m = await import('/js/core/pixelkort.js'), G = SF.game, m0 = G.money, p0 = G.storage.filter((s) => s.k === 'pokal' && s.v === 0).length;
  const klara = m.laggTill(G, m.serieKort('katter').map((k) => k.id)), igen = m.laggTill(G, ['svart']);
  return { klara: klara.map((s) => s.id), pengar: G.money - m0, pokaler: G.storage.filter((s) => s.k === 'pokal' && s.v === 0).length - p0, igen: igen.length, serier: G.kortSerier, dubbel: m.dubbletter(G).map((k) => k.id) };
});
ok(serie.klara.join() === 'katter' && serie.pengar === 500 && serie.pokaler === 1, `komplett serie Katter: 500 kr och en guldpokal (${JSON.stringify(serie)})`);
ok(serie.igen === 0 && serie.dubbel.includes('svart'), 'belöningen kommer bara en gång; den extra svarta katten är en dubblett');
// presenterna
const pres = await p.evaluate(async () => {
  const m = await import('/js/core/presenter.js'); let kort = 0, paket = 0;
  for (let i = 0; i < 600; i++) if (m.rulla(SF.game, 'dag').some((g) => g.slag === 'kort')) kort++;
  for (let i = 0; i < 200; i++) if (m.rulla(SF.game, 'stor').some((g) => g.slag === 'kortpaket' && g.ids.length === 3)) paket++;
  return { kort, paket };
});
ok(pres.kort > 40 && pres.kort < 150, `dagens present är ibland ett pixelkort (${pres.kort} av 600)`);
ok(pres.paket > 80, `de stora presenterna har ofta ett kortpaket med tre kort (${pres.paket} av 200)`);

// ---- kortstället i leksaksaffären ----
await p.evaluate(() => SF.go('leksaker')); await sleep(1500);
const sp = await p.evaluate(() => SF.scene._debug.spot('kortstall'));
ok(!!sp, 'kortstället finns vid kassan');
await p.evaluate(({ x, y }) => SF.scene.down(x, y), sp);
await p.waitForFunction(() => /Pixelkort/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
await shot('pixelkort-stall');
const fore = await p.evaluate(() => ({ money: SF.game.money, n: Object.values(SF.game.kort).reduce((a, b) => a + b, 0) }));
await p.evaluate(() => document.querySelector('#modal .btn-go').click());
await sleep(2000);
const efter = await p.evaluate(() => ({ money: SF.game.money, n: Object.values(SF.game.kort).reduce((a, b) => a + b, 0), visade: document.querySelectorAll('#modal .kt-nya .kt-ruta').length }));
ok(fore.money - efter.money === 25 && efter.n - fore.n === 3 && efter.visade === 3, `ett paket: 25 kr, tre kort i albumet och tre kort i dialogen (${JSON.stringify({ fore, efter })})`);
await shot('pixelkort-paket');
await stang();

// ---- albumet i mobilen ----
await p.evaluate(async () => { const m = await import('/js/core/kortapp.js'); await m.openKortApp(SF); });
await sleep(800);
const alb = await p.evaluate(() => ({ h: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '', flikar: document.querySelectorAll('#modal [data-flik]').length, rutor: document.querySelectorAll('#modal .kt-ruta').length, saknas: document.querySelectorAll('#modal .kt-ruta.kt-saknas').length, bilder: document.querySelectorAll('#modal .kt-cv').length }));
ok(/Pixelkort/.test(alb.h) && alb.flikar === 6 && alb.rutor === 9 && alb.saknas === 0 && alb.bilder === 9, `albumet: sex flikar, Katter komplett (9 kort) (${JSON.stringify(alb)})`);
await shot('pixelkort-album');
await p.evaluate(() => document.querySelector('#modal [data-flik="rar"]').click()); await sleep(800);
const rar = await p.evaluate(() => ({ rutor: document.querySelectorAll('#modal .kt-ruta').length, saknas: document.querySelectorAll('#modal .kt-ruta.kt-saknas').length }));
ok(rar.rutor === 4 && rar.saknas >= 1, `fliken Rariteter: 4 platser, de som saknas är tomma (${JSON.stringify(rar)})`);
await shot('pixelkort-rariteter');
await stang();
// appen finns i mobilen
ok(await p.evaluate(() => !!document.querySelector('#mobilen [data-app="kort"]')), 'appen 🃏 Pixelkort finns i mobilen');

// ---- efter omladdning ----
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800);
const spar = await p.evaluate(() => ({ svart: SF.game.kort.svart, serier: SF.game.kortSerier, n: Object.values(SF.game.kort).reduce((a, b) => a + b, 0) }));
ok(spar.svart >= 2 && spar.serier.includes('katter') && spar.n === efter.n, `samlingen finns kvar efter omladdning (${JSON.stringify(spar)})`);

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
