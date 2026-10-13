// Regressionstest för 🎡 PIXELBERG (js/scenes/pixelberg.js, js/pixelberg/karta.js, city.js bergbussen):
//   • stadens hållplats: raden "🎡 PIXELBERG" → bergbussen → tivolit
//   • biljettluckan: åkband (100 kr) – sedan är åkturerna gratis i dag
//   • karusellen: två varv på en häst · pariserhjulet: ett varv, högst upp syns staden
//   • lyckohjulet: ett snurr (10 kr) stannar på ett fält · sockervadd
//   • bergbussen ner till stan
// Kör: node tools/pixelberg-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=tiv${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-tiv', name: 'Tivolis', look: { skin: '#e0a97f', hair: '#3b2619', style: 'ponytail', shirt: '#e04848' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 600, hunger: 60, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1000);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const rubrik = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
await stang();

// ---- bergbussen från stadens hållplats ----
await D(() => SF.go('city')); await sleep(900); await stang();
const st = await D(async () => { const { busStopById } = await import('/js/city/map.js'); const s = busStopById('pixeltorget'); SF.scene._debug.teleport(s.x + 20, s.y + 6); return { x: s.x, y: s.y }; });
await sleep(500);
const bs = await D(() => SF.scene._debug.busStop('pixeltorget'));
await D((b) => SF.scene.down(b.x, b.y), bs);
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-berg]'), null, { timeout: 8000 }).catch(() => {});
ok(await D(() => !!document.querySelector('#modal [data-berg]')), 'hållplatsen: raden "🎡 PIXELBERG"');
const m0 = await D(() => SF.game.money);
await D(() => document.querySelector('#modal [data-berg]').click());
await p.waitForFunction(() => SF.sceneName === 'pixelberg', null, { timeout: 8000 }).catch(() => {});
ok(await D(() => SF.sceneName === 'pixelberg'), 'bergbussen → Pixelberg');
ok((await D(() => SF.game.money)) === m0 - 10, 'bussbiljetten 10 kr');
await sleep(1500);
if (SHOTS) await p.screenshot({ path: 'tools/out/pixelberg-entre.png' });

// ---- biljetter ----
await D(() => SF.scene._debug.act('biljett')); await sleep(300);
await D(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Åkband/.test(b.textContent)).click()); await sleep(300);
ok(await D(() => SF.scene._debug.band()), 'åkbandet köpt – åkturerna är gratis i dag');

// ---- karusellen ----
await D(() => SF.scene._debug.teleport(450, 390)); await sleep(500);
const mk = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('karusell')); await sleep(2500);
ok((await D(() => SF.scene._debug.aka()))?.typ === 'karusell' && (await D(() => SF.game.money)) === mk, 'karusellen: man rider på en häst (gratis med åkband)');
if (SHOTS) await p.screenshot({ path: 'tools/out/pixelberg-karusell.png' });
await D(() => SF.scene._debug.snabba(17)); await sleep(1200);
ok(!(await D(() => SF.scene._debug.aka())) && /Wiii/.test(await D(() => window.__toasts.join(' | '))), 'efter två varv: av karusellen, "🎠 Wiii!"');

// ---- pariserhjulet ----
await D(() => SF.scene._debug.teleport(830, 350)); await sleep(500);
await D(() => SF.scene._debug.act('hjul')); await sleep(400);
ok((await D(() => SF.scene._debug.aka()))?.typ === 'hjul', 'pariserhjulet: i gondolen');
for (let i = 0; i < 30 && !(await D(() => SF.scene._debug.aka()?.toppen)); i++) { await D(() => SF.scene._debug.snabba(0.5)); await sleep(60); }
await sleep(900);
ok(await D(() => SF.scene._debug.aka()?.toppen) && /Högst upp/.test(await D(() => window.__toasts.join(' | '))), 'högst upp: "🎡 Högst upp! Där nere ligger hela Pixelstaden"');
if (SHOTS) await p.screenshot({ path: 'tools/out/pixelberg-hjul.png' });
await D(() => SF.scene._debug.snabba(26)); await sleep(1000);
ok(!(await D(() => SF.scene._debug.aka())), 'efter ett varv: av hjulet');

// ---- lyckohjulet och godiset ----
await stang();
await D(() => SF.scene._debug.act('lycka')); await sleep(300);
const ml = await D(() => SF.game.money);
await D(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Snurra/.test(b.textContent)).click());
await sleep(600);
if (SHOTS) await p.screenshot({ path: 'tools/out/pixelberg-lyckohjul.png' });
await sleep(3500);
const lt = await D(() => document.querySelector('#modal .pb-lycka-text')?.textContent || '');
ok(/kortpaket|kr!|klubba|sockervadd|Nitlott/i.test(lt) && (await D(() => SF.game.money)) >= ml - 10, `lyckohjulet stannar: "${lt}"`);
await stang();
await D(() => SF.scene._debug.act('godis')); await sleep(300);
const hg = await D(() => SF.game.hunger);
await D(() => document.querySelector('#modal [data-godis="sockervadd"]').click()); await sleep(300);
ok((await D(() => SF.game.hunger)) > hg, 'en sockervadd');
await stang();

// ---- kvällen ----
await D(() => { SF.game.min = 21 * 60; SF.scene._debug.teleport(700, 380); }); await sleep(1200);
if (SHOTS) await p.screenshot({ path: 'tools/out/pixelberg-natt.png' });
await D(() => { SF.game.min = 13 * 60; SF.scene._debug.teleport(1300, 330); }); await sleep(1000);
if (SHOTS) await p.screenshot({ path: 'tools/out/pixelberg-bana.png' });

// ---- bergbussen ner ----
await D(() => SF.scene._debug.act('buss')); await sleep(300);
ok(/Bergbussen/.test(await rubrik()), 'bergbussens hållplats');
await D(() => document.querySelector('#modal [data-bb="pixeltorget"]').click());
await p.waitForFunction(() => SF.sceneName === 'city', null, { timeout: 8000 }).catch(() => {});
ok(await D(() => SF.sceneName === 'city'), 'ner till stan');

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
