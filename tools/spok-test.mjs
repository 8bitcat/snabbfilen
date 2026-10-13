// Regressionstest för 👻 SPÖKHUSET på Pixelberg (js/pixelberg/spokhus.js, js/scenes/pixelberg.js akSpok/spokAkare,
// js/net/world.js 'spok:<avgång>:<plats>'):
//   • två spelare (Mira och Leo); spöktåget går på klockan (window.__tivoliNu)
//   • Mira kliver på (plats 0) och betalar en kupong; Leo ser henne i vagnen och får plats 1 – "Du och Mira åker
//     spöktåget tillsammans!" hos båda
//   • inne i huset: båda ser korridoren (spöket som säger BU!), samma ögonblick på klockan
//   • vagnen tillbaka vid perrongen och nästa avgång börjar: båda kliver av – "Puh! Du tog dig ut ur spökhuset!"
//   • är vagnen inne i huset ställer man sig i kön; ett tryck någon annanstans = lämna kön (kupongen tillbaka)
// Kör: node tools/spok-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
const WORLD = 'spok' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?nomenu&world=${WORLD}&nettest=1`;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch();
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);

async function spelare(namn, farg) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${namn}] ${e.message}`));
  await page.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
  await page.goto(URL);
  await page.evaluate(([n, c]) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-' + n, name: n, look: { skin: '#eabf98', shirt: c, hair: '#3b2619', style: 'long' }, color: c }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 500, hunger: 80, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
  }, [namn, farg]);
  await page.reload().catch(() => {});
  await page.waitForFunction(() => !!window.SF?.worldInfo && !!window.SF?.game, null, { timeout: 20000 });
  await sleep(800);
  await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; SF.pixelbergFran = { buss: 'test' }; SF.go('pixelberg'); });
  await page.waitForFunction(() => SF.sceneName === 'pixelberg' && !!SF.scene?._debug?.spok, null, { timeout: 15000 });
  active.add(page);
  return { namn, context, page };
}
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); } }
const E = (p, fn, a) => p.page.evaluate(fn, a);
const klocka = (p, ms) => E(p, (ms) => { window.__tivoliNu = ms; }, ms);
const toasts = (p) => E(p, () => window.__toasts.join(' | '));

const M = await spelare('Mira', '#e04848');
const L = await spelare('Leo', '#3a7bd5');
ok(await until(async () => (await E(M, () => SF.worldInfo().online)) >= 2 && (await E(L, () => SF.worldInfo().online)) >= 2), 'Mira och Leo är i samma värld');
ok(await until(async () => (await E(M, async () => (await import('/js/net/world.js')).worldFolksHere(SF).length)) === 1), 'de ser varandra på Pixelberg');

// ---- samma vagn ----
const BAS = Math.floor(Date.now() / 30000) * 30000 + 1500;   // (en avgång: 1,5 s in i påstigningen)
await klocka(M, BAS); await klocka(L, BAS);
await E(M, () => SF.scene._debug.teleport(2280, 400)); await E(L, () => SF.scene._debug.teleport(2300, 400));
const p0 = await E(M, () => SF.game.money);
await E(M, () => SF.scene._debug.akSpok()); await sleep(300);
const m1 = await E(M, () => SF.scene._debug.spok());
ok(m1.aka?.plats === 0 && m1.platser[0] === 'jag' && (await E(M, () => SF.game.money)) === p0 - 20 && /sätter dig i spökvagnen/.test(await toasts(M)), `Mira kliver på (plats 0, en kupong) (${JSON.stringify(m1.platser)})`);
ok(await until(async () => (await E(L, () => SF.scene._debug.spok())).platser[0] === 'Mira', 10000), 'Leo ser Mira i vagnen');
await E(L, () => SF.scene._debug.akSpok()); await sleep(300);
const l1 = await E(L, () => SF.scene._debug.spok());
ok(l1.aka?.plats === 1 && l1.platser[1] === 'jag' && l1.platser[0] === 'Mira', `Leo får platsen bredvid (${JSON.stringify(l1.platser)})`);
ok(await until(async () => /Du och Leo åker spöktåget tillsammans/.test(await toasts(M)), 10000), 'hos Mira: "👻 Du och Leo åker spöktåget tillsammans!"');
ok(/Du och Mira åker spöktåget tillsammans/.test(await toasts(L)), 'hos Leo: "👻 Du och Mira åker spöktåget tillsammans!"');
if (SHOTS) await M.page.screenshot({ path: 'tools/out/spok-perrong.png' });

// ---- inne i huset: BU! ----
const START = BAS - 1500;   // avgångens början
await klocka(M, START + (9 + 6.4) * 1000); await klocka(L, START + (9 + 6.4) * 1000); await sleep(700);
const m2 = await E(M, () => SF.scene._debug.spok()), l2 = await E(L, () => SF.scene._debug.spok());
ok(m2.inne && l2.inne && Math.abs(m2.i - 6.4) < 0.01 && m2.platser[0] === 'jag' && m2.platser[1] === 'Leo' && l2.platser[0] === 'Mira', `inne i huset: båda i vagnen, samma ögonblick (${m2.i.toFixed(1)} s, ${JSON.stringify(m2.platser)})`);
if (SHOTS) { await M.page.screenshot({ path: 'tools/out/spok-bu-mira.png' }); await L.page.screenshot({ path: 'tools/out/spok-bu-leo.png' }); }
// ---- ut och av ----
await klocka(M, START + 28500); await klocka(L, START + 28500); await sleep(500);
const m3 = await E(M, () => SF.scene._debug.spok());
ok(!m3.inne && m3.vagn.synlig && m3.aka, 'vagnen kommer ut genom utgången – Mira sitter kvar');
await klocka(M, START + 30500); await klocka(L, START + 30500); await sleep(800);
const m4 = await E(M, () => ({ s: SF.scene._debug.spok(), t: window.__toasts.join(' | ') })), l4 = await E(L, () => ({ s: SF.scene._debug.spok(), t: window.__toasts.join(' | ') }));
ok(!m4.s.aka && !l4.s.aka && /Puh! Du tog dig ut ur spökhuset/.test(m4.t) && /Puh! Du tog dig ut ur spökhuset/.test(l4.t), 'nästa avgång: båda kliver av – "👻 Puh! Du tog dig ut ur spökhuset!"');

// ---- kön ----
await klocka(M, START + 30000 + 12000); await sleep(200);
const k0 = await E(M, () => SF.game.money);
await E(M, () => SF.scene._debug.akSpok()); await sleep(300);
const k = await E(M, () => ({ s: SF.scene._debug.spok(), t: window.__toasts.join(' | ') }));
ok(k.s.aka && k.s.aka.n === k.s.n + 1 && /ställer dig först i kön/.test(k.t), 'vagnen är inne i huset: i kön till nästa');
await E(M, () => SF.scene.down(40, 40)); await sleep(300);
ok(!(await E(M, () => SF.scene._debug.spok())).aka && (await E(M, () => SF.game.money)) === k0, 'ett tryck någon annanstans: ur kön, kupongen tillbaka');

clearInterval(activity);
await browser.close();
ok(!errors.length, `inga fel i sidan${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
