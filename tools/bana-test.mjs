// Regressionstest för 🎢 BERG-OCH-DALBANAN MED EN KOMPIS (js/scenes/pixelberg.js banLage/aakare, js/net/world.js 'ak'):
//   • två spelare (Mira och Leo) i samma värld på Pixelberg; tåget går på klockan (window.__tivoliNu)
//   • Mira kliver på (plats 0); Leo ser henne i tåget och får plats 1 – "Du och Mira åker tillsammans!" hos båda
//   • ute på banan sitter båda i tåget (kameran följer vagnen); när nästa avgång börjar kliver båda av: "Wow, vilken fart!"
//   • är tåget ute ställer man sig i kön till nästa; ett tryck någon annanstans = lämna kön (kupongen tillbaka)
// Kör: node tools/bana-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
const WORLD = 'bana' + Date.now().toString(36);
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
  active.add(page);
  return { namn, context, page };
}
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); } }
const E = (p, fn, a) => p.page.evaluate(fn, a);
const klocka = (p, ms) => E(p, (ms) => { window.__tivoliNu = ms; }, ms);

const M = await spelare('Mira', '#e04848');
const L = await spelare('Leo', '#3a7bd5');
ok(await until(async () => (await E(M, () => SF.worldInfo().online)) >= 2 && (await E(L, () => SF.worldInfo().online)) >= 2), 'Mira och Leo är i samma värld');
ok(await until(async () => (await E(M, async () => (await import('/js/net/world.js')).worldFolksHere(SF).length)) === 1), 'de ser varandra på Pixelberg');

// ---- samma tåg ----
const BAS = Math.floor(Date.now() / 32000) * 32000 + 2000;   // (en avgång: 2 s in i påstigningen)
await klocka(M, BAS); await klocka(L, BAS);
await E(M, () => SF.scene._debug.akBana()); await sleep(300);
const m1 = await E(M, () => SF.scene._debug.bana());
ok(m1.aka && m1.aka.plats === 0 && m1.platser[0] === 'jag' && /sätter dig i vagn 1/.test(await E(M, () => window.__toasts.join(' | '))), `Mira kliver på (plats 0) – "Du sätter dig i vagn 1" (${JSON.stringify(m1.platser)})`);
ok(await until(async () => (await E(L, () => SF.scene._debug.bana())).platser[0] === 'Mira', 10000), 'Leo ser Mira i tåget');
await E(L, () => SF.scene._debug.akBana()); await sleep(300);
const l1 = await E(L, () => SF.scene._debug.bana());
ok(l1.aka?.plats === 1 && l1.platser[1] === 'jag' && l1.platser[0] === 'Mira', `Leo får platsen bredvid (${JSON.stringify(l1.platser)})`);
ok(await until(async () => /Du och Leo åker tillsammans/.test(await E(M, () => window.__toasts.join(' | '))), 10000), 'hos Mira: "🎢 Du och Leo åker tillsammans!"');
ok(/Du och Mira åker tillsammans/.test(await E(L, () => window.__toasts.join(' | '))), 'hos Leo: "🎢 Du och Mira åker tillsammans!"');
if (SHOTS) await M.page.screenshot({ path: 'tools/out/bana-station.png' });

// ---- ute på banan ----
await klocka(M, BAS + 15500); await klocka(L, BAS + 15500); await sleep(900);
const m2 = await E(M, () => SF.scene._debug.bana());
ok(!m2.station && m2.tau > 0 && m2.platser[0] === 'jag' && m2.platser[1] === 'Leo', `ute på banan: båda i tåget (${JSON.stringify(m2.platser)}, ${m2.tau.toFixed(1)} s)`);
if (SHOTS) { await M.page.screenshot({ path: 'tools/out/bana-tur-mira.png' }); await L.page.screenshot({ path: 'tools/out/bana-tur-leo.png' }); }
await klocka(M, BAS + 20500); await klocka(L, BAS + 20500); await sleep(700);
if (SHOTS) await M.page.screenshot({ path: 'tools/out/bana-tur2.png' });
// ---- nästa avgång: kliv av ----
await klocka(M, BAS + 32000); await klocka(L, BAS + 32000); await sleep(800);
const m3 = await E(M, () => ({ b: SF.scene._debug.bana(), t: window.__toasts.join(' | ') })), l3 = await E(L, () => ({ b: SF.scene._debug.bana(), t: window.__toasts.join(' | ') }));
ok(!m3.b.aka && !l3.b.aka && /vilken fart/.test(m3.t) && /vilken fart/.test(l3.t), 'nästa avgång: båda kliver av – "🎢 Wow, vilken fart!"');

// ---- kön ----
await klocka(M, BAS + 32000 + 14000); await sleep(200);
const p0 = await E(M, () => SF.game.money);
await E(M, () => SF.scene._debug.akBana()); await sleep(300);
const k = await E(M, () => ({ b: SF.scene._debug.bana(), t: window.__toasts.join(' | ') }));
ok(k.b.aka && k.b.aka.n === k.b.n + 1 && /ställer dig först i kön/.test(k.t), 'tåget är ute: i kön till nästa avgång');
await E(M, () => SF.scene.down(40, 40)); await sleep(300);
ok(!(await E(M, () => SF.scene._debug.bana())).aka && (await E(M, () => SF.game.money)) === p0, 'ett tryck någon annanstans: ur kön, kupongen tillbaka');

clearInterval(activity);
await browser.close();
ok(!errors.length, `inga fel i sidan${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
