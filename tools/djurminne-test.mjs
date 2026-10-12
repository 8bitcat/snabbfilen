// Regressionstest för 🐾 DJUREN MINNS DIG (js/pets/sim.js memory/seen, js/pets/layer.js hälsningen och djurmenyns
// minnen). Carl 2026-10-12: "djur som minns dig".
//   • katten har inte sett en på två dagar → när man kommer hem: "🐈 Misse har saknat dig!", pratbubblan
//     "JAG HAR SAKNAT DIG!" med hjärta, och hon blir gladare
//   • medan man är hemma minns hon att hon sett en (minne.sett uppdateras)
//   • ut och in igen direkt: ingen ny hälsning; borta en halvtimme: "HEJ! DU ÄR HEMMA!" och "sprang fram och hälsade"
//   • på natten (djuren sover) hälsar ingen
//   • djurmenyn: "💛 tillsammans i 5 dagar · klappad 8 gånger" (klappar räknas)
// Kör: node tools/djurminne-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=dm${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-dm', name: 'Djurvan', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 8, min: 12 * 60, money: 900, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
// en katt som har bott här i fem dagar, klappad sju gånger, och inte sett en på två dagar
const pid = await p.evaluate(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const S = petStore(), c = S.adopt('katt', 'tigrerad', 'hona', 'Misse', 'husvagn', { day: SF.game.day - 5 });
  c.homeDay = SF.game.day - 5; c.happy = 50;
  const m = S.memory(c); m.sett = Date.now() - 2 * 86400000; m.klapp = 7;
  S.save();
  return c.id;
});
const inUt = async (stay = 1800) => { await p.evaluate(() => { window.__toasts = []; SF.go('city'); }); await sleep(600); await p.evaluate(() => { SF.roomSub = 0; SF.go('room'); }); await sleep(stay); };
const bubbla = () => p.evaluate((id) => (SF.scene._debug?.petLayer?.()?._debug.bubbles() || []).find((b) => b.id === id)?.halsa || null, pid);
const katt = () => p.evaluate(async (id) => { const { petStore } = await import('/js/pets/sim.js'); const c = petStore().petById(id); return { happy: c.happy, sett: c.minne?.sett || 0, klapp: c.minne?.klapp || 0 }; }, pid);

// ---- två dagar borta ----
await inUt(400);
ok(await p.evaluate(() => SF.sceneName) === 'room', 'hemma i husvagnen');
ok((await bubbla()) === 'JAG HAR SAKNAT DIG!', 'pratbubblan över katten: "JAG HAR SAKNAT DIG!"');
await sleep(1200);
ok(await p.evaluate(() => window.__toasts.some((t) => /Misse har saknat dig/.test(t))), 'hälsningen: "🐈 Misse har saknat dig!"');
const k1 = await katt();
ok(k1.happy >= 60, `Misse blev gladare (${k1.happy})`);
await sleep(5500);
ok(Date.now() - (await katt()).sett < 15000, 'medan man är hemma minns hon att hon har sett en (minne.sett)');

// ---- ut och in direkt ----
await inUt();
ok(!(await bubbla()) && !(await p.evaluate(() => window.__toasts.some((t) => /Misse/.test(t)))), 'ut och in igen direkt: ingen ny hälsning');

// ---- en halvtimme borta ----
await p.evaluate(async (id) => { const { petStore } = await import('/js/pets/sim.js'); const S = petStore(); S.memory(S.petById(id)).sett = Date.now() - 30 * 60000; S.save(); }, pid);
await inUt(400);
ok((await bubbla()) === 'HEJ! DU ÄR HEMMA!', 'en halvtimme borta: "HEJ! DU ÄR HEMMA!"');
await sleep(1200);
ok(await p.evaluate(() => window.__toasts.some((t) => /Misse sprang fram och hälsade/.test(t))), '"🐈 Misse sprang fram och hälsade!"');

// ---- djurmenyn ----
await stang();
await p.evaluate((id) => { const L = SF.scene._debug.petLayer(); const s = L._debug.spot(id); L.down(s.x, s.y - 4); }, pid);
await sleep(500);
const meny = await p.evaluate(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
ok(/tillsammans i 5 dagar/.test(meny) && /klappad 7 gånger/.test(meny), `djurmenyn visar minnena (${(meny.match(/💛[^\n]*/) || [''])[0]})`);
await p.evaluate(() => [...document.querySelectorAll('#modal button')].find((b) => /Klappa/.test(b.textContent))?.click());
await sleep(300);
ok((await katt()).klapp === 8, 'klappen räknas (8 gånger)');

// ---- natten (sist: klockan får inte gå bakåt – då tror djurbutiken att det är ett nytt spel) ----
await p.evaluate(async (id) => { SF.game.min = 23 * 60 + 30; const { petStore } = await import('/js/pets/sim.js'); const S = petStore(); S.memory(S.petById(id)).sett = Date.now() - 3 * 86400000; S.save(); }, pid);
await inUt();
ok(!(await bubbla()), 'på natten sover djuren – ingen hälsning');


await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
