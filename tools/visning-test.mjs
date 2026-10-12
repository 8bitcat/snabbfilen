// Regressionstest för 🖼️ VISNINGSMÖBLERNA (js/core/visning.js, room.js ATLAS + FRAMES, shop-bling.js visningGava,
// presenter.js pokaler). Carl 2026-10-12: "att man kan visa upp sina mobilskal … en dreamlandhylla hemma att sätta ut
// … du kan också ge dem pokaler att ha hemma".
//   • möbelarket blir utökat: rutorna mobilhylla0, smyckestavla0, vaskkrokar0, pokal0–2 ligger under originalet
//     och har pixlar (arket laddas om som dataURL)
//   • köper man sitt första mobilskal i BLING BLING får man mobilskalshyllan på köpet (i förrådet) – en gång
//   • hyllan visar skalets färg (pixlarna i rutan ändras när designerna ändras)
//   • första halsbandet ger smyckestavlan, första väskan väskkrokarna
//   • hyllan står bland förrådets saker och går att ställa ut (deco) – och ritas i rummet utan fel
// Kör: node tools/visning-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=vs${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-vs', name: 'Visa', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 5000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1500);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
// pixlarna i en ruta i det utökade arket: antal ritade pixlar + en signatur
const ruta = (namn) => p.evaluate(async (namn) => {
  const { ATLAS } = await import('/js/scenes/room.js'); const { FRAMES } = await import('/js/data/frames.js');
  for (let i = 0; i < 40 && !(ATLAS.complete && ATLAS.naturalHeight > 443); i++) await new Promise((r) => setTimeout(r, 100));
  const f = FRAMES[namn]; if (!f) return null;
  const c = document.createElement('canvas'); c.width = f[2]; c.height = f[3]; const g = c.getContext('2d'); g.drawImage(ATLAS, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  const d = g.getImageData(0, 0, f[2], f[3]).data; let n = 0, sum = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; sum = (sum * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2]) % 1e9; }
  return { n, sum, h: ATLAS.naturalHeight, y: f[1] };
}, namn);

// ---- det utökade arket ----
const r0 = await ruta('mobilhylla0'), pk = await ruta('pokal0'), st = await ruta('smyckestavla0'), vk = await ruta('vaskkrokar0');
ok(r0 && r0.h > 443 && r0.y >= 443, `möbelarket är utökat (höjd ${r0?.h}) och hyllans ruta ligger under originalet`);
ok(r0?.n > 100 && pk?.n > 50 && st?.n > 300 && vk?.n > 50, `hyllan, tavlan, krokarna och pokalen har pixlar (${r0?.n}, ${st?.n}, ${vk?.n}, ${pk?.n})`);

// ---- första mobilskalet i BLING BLING ----
await p.evaluate(() => SF.go('city')); await sleep(1200);
await p.evaluate(() => SF.scene._debug.teleport(-504, 150)); await sleep(500);
await p.evaluate(() => SF.scene._debug.enter('l_bling')); await sleep(1800);
await p.evaluate(() => SF.scene._debug.teleport(505, 170)); await sleep(500);
await p.evaluate(() => { const [x0, y0, x1, y1] = SF.scene._debug.spots().mobil, c = SF.scene._debug.cam(); SF.scene.down((x0 + x1) / 2 - c, (y0 + y1) / 2); });
await p.waitForFunction(() => /mobilskal/i.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => { document.querySelector('#modal [data-case="mint"]').click(); });
await sleep(200);
await p.evaluate(() => document.querySelector('#modal .btn-go').click());
await sleep(3500);
const s1 = await p.evaluate(() => ({ forrad: SF.game.storage.map((s) => s.k), toasts: window.__toasts.join(' | ') }));
ok(s1.forrad.filter((k) => k === 'mobilhylla').length === 1, `första mobilskalet: mobilskalshyllan i förrådet (${s1.forrad.join(', ')})`);
ok(/mobilskalshylla på köpet/.test(s1.toasts), '"🖼️ Du fick en mobilskalshylla på köpet – ställ ut den hemma …"');
const r1 = await ruta('mobilhylla0');
ok(r1 && r1.sum !== r0.sum, 'hyllan ritas om och visar det nya skalet');
// ett skal till: ingen hylla till
await p.evaluate(() => { const [x0, y0, x1, y1] = SF.scene._debug.spots().mobil, c = SF.scene._debug.cam(); SF.scene.down((x0 + x1) / 2 - c, (y0 + y1) / 2); });
await p.waitForFunction(() => /mobilskal/i.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => { document.querySelector('#modal [data-case="rosa"]').click(); });
await sleep(200);
await p.evaluate(() => document.querySelector('#modal .btn-go').click());
await sleep(1000);
ok((await p.evaluate(() => SF.game.storage.filter((s) => s.k === 'mobilhylla').length)) === 1, 'ett skal till ger ingen hylla till');

// ---- halsband och väska ----
await p.evaluate(() => SF.scene._debug.teleport(127, 170)); await sleep(500);
await p.evaluate(() => { const [x0, y0, x1, y1] = SF.scene._debug.spots().neck, c = SF.scene._debug.cam(); SF.scene.down((x0 + x1) / 2 - c, (y0 + y1) / 2); });
await p.waitForFunction(() => /halsband/i.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await sleep(800);
await p.evaluate(() => { const [x0, y0, x1, y1] = SF.scene._debug.spots().bag, c = SF.scene._debug.cam(); SF.scene.down((x0 + x1) / 2 - c, (y0 + y1) / 2); });
await p.waitForFunction(() => /väska/i.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await sleep(800);
const s2 = await p.evaluate(() => SF.game.storage.map((s) => s.k));
ok(s2.includes('smyckestavla') && s2.includes('vaskkrokar'), `första halsbandet och väskan: smyckestavlan och väskkrokarna (${s2.join(', ')})`);

// ---- hemma: ställ ut hyllan ----
await stang();
await p.evaluate(() => { SF.go('city'); }); await sleep(600);
await p.evaluate(() => { SF.roomSub = 0; SF.go('room'); }); await sleep(1200);
const ut = await p.evaluate(() => {
  const g = SF.game, i = g.storage.findIndex((s) => s.k === 'mobilhylla');
  const key = Object.keys(g.deco).find((k) => k.startsWith('husvagn')) || 'husvagn:0';
  const [it] = g.storage.splice(i, 1); (g.deco[key] ||= []).push({ ...it, x: 120, y: 60 }); g.save();
  return key;
});
await p.evaluate(() => { SF.go('city'); }); await sleep(500);
await p.evaluate(() => { SF.roomSub = 0; SF.go('room'); }); await sleep(1500);
ok(await p.evaluate((key) => SF.game.deco[key]?.some((d) => d.k === 'mobilhylla'), ut), 'mobilskalshyllan står hemma');
await p.screenshot({ path: 'tools/out/visning-hemma.png' }).catch(() => {});

// ---- pokalen i en present ----
const pok = await p.evaluate(async () => { const m = await import('/js/core/presenter.js'); let n = 0; for (let i = 0; i < 200; i++) if (m.rulla(SF.game, 'stor').some((g) => g.k === 'pokal')) n++; return n; });
ok(pok > 30 && pok < 120, `stora presenter innehåller ibland en pokal (${pok} av 200)`);

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
