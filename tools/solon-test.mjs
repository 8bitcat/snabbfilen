// Regressionstest för ⛴️ SOLÖN (js/scenes/solon.js, js/solon/karta.js, js/city/pir.js färjeläget):
//   • färjeläget längst ut på bryggan vid Sjöboden: färjan och skylten; ett tryck → "⛴️ Solö-färjan" → 20 kr → Solön
//   • på Solön: man kliver i land på färjeläget, horisonten med Pixelstaden syns
//   • badet: ut i det grunda vattnet → figuren badar, första doppet om dagen ger lycka
//   • kiosken: en glasstrut (25 kr, mättar)
//   • natten: fyren lyser
//   • färjan tillbaka → stan, vid bryggan
// Kör: node tools/solon-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=solo${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-sol', name: 'Sol', look: { skin: '#e0a97f', hair: '#d19a1c', style: 'long', shirt: '#3a7bd5' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 500, hunger: 50, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const rubrik = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
const knapp = (re) => D((re) => { const b = [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].find((x) => new RegExp(re).test(x.textContent)); if (b) b.click(); return !!b; }, re);
await stang();

// ---- färjeläget i stan ----
await D(() => SF.go('city')); await sleep(800); await stang();
await D(async () => { const { PIER } = await import('/js/city/map.js'); SF.scene._debug.teleport(PIER.deck[0] + 30, PIER.deck[1] + 14); });
await sleep(900);
if (SHOTS) await p.screenshot({ path: 'tools/out/solon-farjelaget.png' });
const fa = await D(async () => { const { PIER } = await import('/js/city/map.js'); return !!SF.scene._debug && !!(await import('/js/city/pir.js')).openFarja && PIER.deck[0]; });
ok(!!fa, 'färjeläget finns på bryggan (openFarja)');
await D(async () => (await import('/js/city/pir.js')).openFarja(SF)); await sleep(300);
ok(/Solö-färjan/.test(await rubrik()), '"⛴️ Solö-färjan"');
const pengar0 = await D(() => SF.game.money);
await knapp('Åk till Solön'); await sleep(1500);
ok(await D(() => SF.sceneName === 'solon'), 'på Solön');
ok((await D(() => SF.game.money)) === pengar0 - 20, 'biljetten kostade 20 kr');
const pos0 = await D(() => SF.scene._debug.pos());
ok(pos0.y < 80 && pos0.x > 60 && pos0.x < 110, `man kliver i land på färjeläget (${Math.round(pos0.x)}, ${Math.round(pos0.y)})`);
await sleep(1200);
if (SHOTS) await p.screenshot({ path: 'tools/out/solon-brygga.png' });

// ---- stranden och badet ----
await D(() => SF.scene._debug.teleport(640, 262)); await sleep(1200);
if (SHOTS) await p.screenshot({ path: 'tools/out/solon-strand.png' });
await D(() => SF.scene._debug.teleport(420, 150)); await sleep(300);
await D(() => SF.scene._debug.walkTo(420, 122));
await p.waitForFunction(() => SF.scene._debug.badar(), null, { timeout: 6000 }).catch(() => {});
await sleep(700);
ok(await D(() => SF.scene._debug.badar()) && /Plask/.test(await D(() => window.__toasts.join(' | '))), 'badet: figuren badar i det grunda vattnet, "🌊 Plask!"');
if (SHOTS) await p.screenshot({ path: 'tools/out/solon-bad.png' });

// ---- kiosken ----
await D(() => SF.scene._debug.teleport(506, 312)); await sleep(500);
await D(() => SF.scene._debug.act('kiosk')); await sleep(300);
ok(/Solö-kiosken/.test(await rubrik()), 'kiosken öppnar');
const k0 = await D(() => ({ m: SF.game.money, h: SF.game.hunger }));
await D(() => document.querySelector('#modal [data-kiosk="strut"]').click()); await sleep(300);
const k1 = await D(() => ({ m: SF.game.money, h: SF.game.hunger }));
ok(k1.m === k0.m - 25 && k1.h > k0.h, `en glasstrut: 25 kr, mättare (${k0.h} → ${k1.h})`);
await stang();

// ---- natten och fyren ----
await D(() => { SF.game.min = 22 * 60; SF.scene._debug.teleport(1180, 200); }); await sleep(1200);
if (SHOTS) await p.screenshot({ path: 'tools/out/solon-natt.png' });
await D(() => { SF.game.min = 13 * 60; });

// ---- färjan tillbaka ----
await D(() => SF.scene._debug.act('farja')); await sleep(300);
ok(/Solö-färjan/.test(await rubrik()), 'färjan tillbaka: dialogen');
await knapp('tillbaka till stan'); await sleep(2200);
const tillbaka = await D(async () => { const { PIER } = await import('/js/city/map.js'); const q = SF.scene._debug.pos?.() || {}; return { scen: SF.sceneName, nara: Math.abs(q.x - PIER.deck[0]) < 60 && Math.abs(q.y - PIER.deck[1]) < 60 }; });
ok(tillbaka.scen === 'city' && tillbaka.nara, `tillbaka i stan vid bryggan (${JSON.stringify(tillbaka)})`);

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
