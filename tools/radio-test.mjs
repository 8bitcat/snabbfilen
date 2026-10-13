// Regressionstest för 🚗 RADIOBILARNA på Pixelberg (js/scenes/pixelberg.js updRadio/krock, js/net/world.js 'radio:<färg>'):
//   • en runda kostar en kupong; man kör med piltangenterna (riktiga tangenttryck) och bilen vänder sig åt det hållet
//   • två spelare (Mira och Leo) i samma värld: de ser varandras bilar (olika färger) och krockar –
//     "💥 Du krockade med Leo!" hos Mira och "💥 Du krockade med Mira!" hos Leo
//   • rundan tar slut: "Bom bom! Krockar: N" och man står vid ingången; Escape avslutar en runda i förtid
// Kör: node tools/radio-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
const WORLD = 'radio' + Date.now().toString(36);
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
  await page.waitForFunction(() => SF.sceneName === 'pixelberg' && !!SF.scene?._debug?.radio, null, { timeout: 15000 });
  await page.evaluate(() => SF.scene._debug.radioPark(true));   // besökarnas bilar parkerar längst in
  active.add(page);
  return { namn, context, page };
}
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); } }
const E = (p, fn, a) => p.page.evaluate(fn, a);
const toasts = (p) => E(p, () => window.__toasts.join(' | '));

const M = await spelare('Mira', '#e04848');
const L = await spelare('Leo', '#3a7bd5');
ok(await until(async () => (await E(M, () => SF.worldInfo().online)) >= 2 && (await E(L, () => SF.worldInfo().online)) >= 2), 'Mira och Leo är i samma värld');
ok(await until(async () => (await E(M, async () => (await import('/js/net/world.js')).worldFolksHere(SF).length)) === 1), 'de ser varandra på Pixelberg');

// ---- Mira kliver i en bil ----
const p0 = await E(M, () => SF.game.money);
await E(M, () => SF.scene._debug.act('radio')); await sleep(300);
const m0 = await E(M, () => SF.scene._debug.radio());
ok(m0.aka && (await E(M, () => SF.game.money)) === p0 - 20 && /piltangenterna/.test(await toasts(M)), `Mira i en radiobil (färg ${m0.aka?.c}), en kupong 20 kr`);
// ---- riktiga tangenttryck: vänster ----
await M.page.bringToFront();
await M.page.keyboard.down('ArrowLeft'); await sleep(700); await M.page.keyboard.up('ArrowLeft');
const m1 = await E(M, () => SF.scene._debug.radio());
ok(m1.aka.x < m0.aka.x - 15 && m1.aka.dir === 'left', `piltangenten: bilen kör åt vänster (${Math.round(m0.aka.x)} → ${Math.round(m1.aka.x)}, ${m1.aka.dir})`);
await sleep(1500);
const m2 = await E(M, () => SF.scene._debug.radio());
ok(Math.hypot(m2.aka.vx, m2.aka.vy) < 20, 'släpper man tangenten rullar bilen till stopp');

// ---- Leo kliver i en bil – en annan färg ----
ok(await until(async () => (await E(L, () => SF.scene._debug.radio())).kompisar.some((k) => k.namn === 'Mira'), 10000), 'Leo ser Miras bil');
await E(L, () => SF.scene._debug.act('radio')); await sleep(300);
const l0 = await E(L, () => SF.scene._debug.radio());
ok(l0.aka && l0.aka.c !== m0.aka.c, `Leo får en annan färg (${l0.aka?.c} mot Miras ${m0.aka.c})`);
ok(await until(async () => (await E(M, () => SF.scene._debug.radio())).kompisar.some((k) => k.namn === 'Leo' && Math.abs(k.x - l0.aka.x) < 3 && Math.abs(k.y - l0.aka.y) < 3), 10000), 'Mira ser Leos bil där den står');
if (SHOTS) await M.page.screenshot({ path: 'tools/out/radio-tva.png' });

// ---- krocken ----
const lp = (await E(M, () => SF.scene._debug.radio())).kompisar.find((k) => k.namn === 'Leo');
await E(M, ([x, y]) => SF.scene._debug.radioSatt(x - 34, y, 72, 0), [lp.x, lp.y]);
ok(await until(async () => /Du krockade med Leo/.test(await toasts(M)), 4000, 100), 'hos Mira: "💥 Du krockade med Leo!"');
if (SHOTS) await M.page.screenshot({ path: 'tools/out/radio-krock.png' });
ok(await until(async () => /Du krockade med Mira/.test(await toasts(L)), 6000, 150), 'hos Leo: "💥 Du krockade med Mira!" (Miras bil kom farande)');
const m3 = await E(M, () => SF.scene._debug.radio());
ok(m3.aka.krockar >= 1 && m3.aka.vx < 30, `Miras bil studsade tillbaka (krockar ${m3.aka.krockar}, fart ${Math.round(m3.aka.vx)})`);

// ---- rundan tar slut ----
await E(M, () => SF.scene._debug.snabba(50)); await sleep(500);
const m4 = await E(M, () => ({ r: SF.scene._debug.radio(), pos: SF.scene._debug.pos(), t: window.__toasts.join(' | ') }));
ok(!m4.r.aka && /Bom bom! Krockar: \d+/.test(m4.t) && m4.pos.y > 418, `rundan slut: "Bom bom! Krockar: …" och Mira står vid ingången (y ${Math.round(m4.pos.y)})`);
ok(await until(async () => !(await E(L, () => SF.scene._debug.radio())).kompisar.length, 10000), 'Leo ser att Mira klev ur');
// ---- Escape ----
await L.page.bringToFront();
await L.page.keyboard.press('Escape'); await sleep(400);
ok(!(await E(L, () => SF.scene._debug.radio())).aka, 'Escape: Leo kliver ur i förtid');

clearInterval(activity);
await browser.close();
ok(!errors.length, `inga fel i sidan${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
