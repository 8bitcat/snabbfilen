// Regressionstest för HUSVAGNENS ODLING (js/city/odling.js, map.js ODLING) – inhängad bakom husvagnen i staden:
//   • tre krukor och vattenkannan står innanför trästaketet; figuren går in genom grinden (gången väster om vagnen)
//   • klick på en mogen kruka → figuren går dit och skördar (till skafferiet), krukan blir tom
//   • klick på en torr kruka → vattnad i dag (kannan i handen, droppar ur strilen)
//   • klick på en tom kruka → fröpåsarna, så tomater → vattnad
//   • kannan: allt vattnat → besked; nästa dag torrt → kannan vattnar alla krukor
//   • husvagnens dörr leder rakt ut i stan (ingen trädgårdsscen för husvagnen längre)
//   • den som inte bor i husvagnen får ett besked och ingen fröruta
//   • inga fel i konsolen
// Kör: node tools/odling-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
const sleep = (ms) => page.waitForTimeout(ms);
const D = (fn, a) => page.evaluate(fn, a);
async function waitFor(fn, ms = 10000, arg) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D(fn, arg)) return true; await sleep(100); } return false; }
const SAVE = (home) => ({ v: 1, day: 4, min: 11 * 60, money: 250, hunger: 70, energy: 90, home, fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' },
  odling: { husvagn: { beds: [{ g: 'tomat', dag: 1, v: 5, vat: 4, torr: 0, vissen: false }, { g: 'morot', dag: 2, v: 2, vat: 3, torr: 0, vissen: false }, null], trad: { skord: 0 } } } });
async function boot(home) {
  await page.goto(`http://localhost:${PORT}/index.html?nomenu&tradgard&world=odl${Date.now().toString(36)}`);
  await D((s) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
  }, SAVE(home));
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await sleep(700);
  await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
}
const closeModal = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const beds = () => D(() => window.SF.scene._debug.odling().beds());
// klick i världen (världskoordinater → skärmkoordinater med kameran)
const clickWorld = (x, y) => D(([x, y]) => { const c = window.SF.scene._debug.cam(); window.SF.scene.down(x - c.x, y - c.y); }, [x, y]);

// ---- husvagnen: dörren leder rakt ut i stan ----
await boot('husvagn');
await D(() => window.SF.go('room'));
await sleep(1200);
await D(() => { const s = window.SF.scene._debug.spot('dorr'); window.SF.scene.down(s.x, s.y); });
let vart = false;
const ute = await waitFor(() => { if (/Vart vill du gå/.test(document.querySelector('#modal:not(.hidden)')?.innerText || '')) window.__vart = true; return window.SF.sceneName === 'city'; }, 10000);
vart = await D(() => !!window.__vart);
ok(ute && !vart, 'husvagnens dörr: rakt ut i stan, ingen fråga om tomten');
await closeModal();

// ---- i stan: odlingen bakom vagnen ----
await sleep(1200);
const O = await D(async () => (await import('/js/city/map.js')).ODLING);
ok(O && O.pots.length === 3, `odlingen finns: ${O?.pots.length} krukor, kannan på ${O?.can}`);
let B = await beds();
ok(B.map((b) => b.st).join(',') === 'mogen,torr,tom', `krukorna: ${B.map((b) => b.st).join(', ')}`);
ok(await D(() => window.SF.scene._debug.buildings.some((b) => b.id === 'husvagn')), 'husvagnen står kvar');

// från trottoaren framför vagnen till den mogna krukan: in genom grinden
await D(() => window.SF.scene._debug.teleport(3942, 648));
await sleep(400);
const path = [];
await clickWorld(O.pots[0][0], O.pots[0][1] - 10);
for (let i = 0; i < 80; i++) { path.push(await D(() => window.SF.scene._debug.pos())); await sleep(100); if ((await beds())[0].st !== 'mogen') break; }
B = await beds();
ok(B[0].st === 'tom', 'mogen kruka → skördat, krukan tom');
ok(await D(() => (window.SF.game.skafferi?.tomat | 0) > 0), `tomaterna i skafferiet (${await D(() => window.SF.game.skafferi?.tomat | 0)} st)`);
ok(path.some((p) => p && p.x >= O.gate[0] - 2 && p.x <= O.gate[1] + 2 && p.y >= O.rect[3] - 6 && p.y <= O.rect[3] + 8), 'figuren gick in genom grinden');
ok(!path.some((p) => p && p.y > O.rect[1] && p.y < O.rect[3] - 1 && (p.x < O.rect[0] || p.x > O.rect[2])), 'figuren gick inte genom staketet');

// den torra krukan → vattna
await clickWorld(O.pots[1][0], O.pots[1][1] - 10);
ok(await waitFor(() => window.SF.scene._debug.odling().beds()[1].st === 'vattnad', 8000), 'torr kruka → vattnad i dag');
ok(await D(() => window.SF.scene._debug.odling().watering() || window.SF.scene._debug.odling().drops() > 0), 'kannan i handen och droppar ur strilen');

// den tomma krukan → fröpåsarna → så tomater
await sleep(1500);
await clickWorld(O.pots[2][0], O.pots[2][1] - 10);
ok(await waitFor(() => !!document.querySelector('#modal:not(.hidden) [data-gr="tomat"]'), 8000), 'tom kruka → fröpåsarna');
await D(() => document.querySelector('#modal [data-gr="tomat"]').click());
await sleep(300);
B = await beds();
ok(B[2].st === 'vattnad' && B[2].b?.g === 'tomat', 'sådde tomater – vattnat och klart');

// kannan: allt vattnat → besked; nästa dag → kannan vattnar båda krukorna
await sleep(1500);
await clickWorld(O.can[0], O.can[1] - 6);
ok(await waitFor(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /redan vattnat/.test(t.textContent)), 8000), 'kannan: allt är redan vattnat i dag');
await D(() => { window.SF.game.sleep(); window.SF.game.min = 11 * 60; window.SF.game.save(); });
await closeModal();
B = await beds();
ok(B[2].st === 'torr' && B[1].st === 'mogen', `ny dag: de nysådda tomaterna torra, morötterna mogna (${B.map((b) => b.st).join(', ')})`);
await D(() => window.SF.go('city'));
await sleep(1500);
await D(() => window.SF.scene._debug.teleport(3940, 562));
await sleep(300);
await clickWorld(O.can[0], O.can[1] - 6);
ok(await waitFor(() => { const b = window.SF.scene._debug.odling().beds(); return b[2].st === 'vattnad' && !b.some((x) => x.st === 'torr'); }, 8000), 'kannan vattnade allt som var torrt');

// ---- den som inte bor i husvagnen ----
await boot('rum');
await D(() => window.SF.go('city'));
await sleep(1500);
await D(() => window.SF.scene._debug.teleport(3940, 562));
await sleep(300);
await D(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); });
await clickWorld(O.pots[2][0], O.pots[2][1] - 10);
ok(await waitFor(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /husvagnens odling/.test(t.textContent)), 8000), 'bor man inte i husvagnen: besked');
ok(await D(() => !document.querySelector('#modal:not(.hidden) [data-gr]')), '…och ingen fröruta');

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
