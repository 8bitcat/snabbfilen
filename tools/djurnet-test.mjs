// Regressionstest för 🐾 djurNET (js/pets/djurnet.js, js/core/djurnetapp.js, sim.js removePet/importPet):
//   • appen finns i mobilen; Sälj visar ens djur med värdet – ungen kan inte säljas än
//   • Lägg ut: värderingen rad för rad, priset (− / +), annonsen ligger ute
//   • klockan går → en familj budar ("📬 djurNET: … vill köpa …"), siffran på appen
//   • ✅ Sälj: djuret flyttar (borta ur husdjuren), pengarna kommer, familjen hämtar vid dörren; samma dag igen: nej
//   • nästa dag: en hälsning i 💌 Brevlådan med ett foto
//   • 🛒 Köp: dagens uppfödardjur – köpet flyttar hem till en (finns bland husdjuren)
// Kör: node tools/djurnet-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=dn${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-ramona', name: 'Ramona', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#d060a0' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 12, min: 10 * 60, money: 4000, hunger: 80, energy: 90, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
// tre katter: en vuxen skogkatt med rosetter, en ung tigrerad och en kattunge
await D(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const s = petStore(), h = SF.game.home, d = SF.game.day;
  const a = s.adopt('katt', 'skogkatt', 'hona', 'Morris', h, { day: d - 12, stage: 'vuxen' }); a.utst = { katt: [2, 1, 0], bis: 1 }; a.happy = 90;
  const b = s.adopt('katt', 'tigrerad', 'hane', 'Sixten', h, { day: d - 5, stage: 'ung' }); b.happy = 85;
  s.adopt('katt', 'svart', 'hane', 'Sotis', h, { day: d - 1 });
  s.save();
});
const djur = () => D(async () => (await import('/js/pets/sim.js')).petStore().pets.map((x) => x.name));
ok((await djur()).length === 3, `tre katter hemma (${(await djur()).join(', ')})`);

// ---- appen i mobilen ----
await D(() => document.querySelector('#hud-mobil').click()); await sleep(300);
ok(await D(() => !!document.querySelector('#mobilen [data-app="djurnet"]')), 'djurNET finns i mobilen');
await D(() => document.querySelector('#mobilen [data-app="djurnet"]').click()); await sleep(400);
ok(await D(() => /djurNET/.test(document.querySelector('#modal:not(.hidden) .dlg-head')?.textContent || '')), 'djurNET öppnas');
const rader = await D(() => [...document.querySelectorAll('#modal .dn-rad')].map((r) => ({ t: r.textContent, av: r.classList.contains('dn-av'), lagg: !!r.querySelector('[data-lagg]:not([disabled])') })));
ok(rader.length === 3 && rader.some((r) => /Sotis/.test(r.t) && r.av && !r.lagg && /för liten/.test(r.t)), 'Sälj: tre djur med värde – kattungen Sotis är för liten för att flytta');
if (SHOTS) await p.screenshot({ path: 'tools/out/djurnet-salj.png' });

// ---- lägg ut Morris ----
const morrisId = await D(async () => (await import('/js/pets/sim.js')).petStore().pets.find((x) => x.name === 'Morris').id);
await D((id) => document.querySelector(`#modal [data-lagg="${id}"]`).click(), morrisId); await sleep(300);
const v = await D(() => ({ rader: [...document.querySelectorAll('#modal .dn-vrad')].map((r) => r.textContent), pris: document.querySelector('#modal [data-pris]')?.textContent || '' }));
ok(v.rader.some((r) => /Best in Show/.test(r)) && v.rader.some((r) => /Rosetter/.test(r)) && /100 %/.test(v.pris), `värderingen rad för rad (${v.rader.length} rader), priset ${v.pris}`);
await D(() => document.querySelector('#modal [data-ned]').click());
ok(/90 %/.test(await D(() => document.querySelector('#modal [data-pris]').textContent)), 'priset sänks med −');
if (SHOTS) await p.screenshot({ path: 'tools/out/djurnet-varde.png' });
await D(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Lägg ut/.test(b.textContent)).click()); await sleep(300);
ok(await D(() => SF.game.djurnet.annonser.length === 1 && /ligger ute på djurNET/.test(window.__toasts.join(' | '))), 'annonsen ligger ute');
await stang();

// ---- klockan går → ett bud ----
await D(() => { SF.game.min += 180; }); await sleep(2600);
const bud = await D(() => ({ t: window.__toasts.join(' | '), b: SF.game.djurnet.annonser[0]?.bud }));
ok(bud.b && bud.b.belopp > 0 && /vill köpa Morris/.test(bud.t), `ett bud: ${bud.b?.familj} – ${bud.b?.belopp} kr`);
await D(() => document.querySelector('#hud-mobil').click()); await sleep(300);
ok(await D(() => document.querySelector('#mobilen [data-badge="djurnet"]')?.textContent === '1'), 'siffran 1 på djurNET-appen');
await D(() => document.querySelector('#mobilen [data-app="djurnet"]').click()); await sleep(400);
if (SHOTS) await p.screenshot({ path: 'tools/out/djurnet-bud.png' });

// ---- sälj ----
const m0 = await D(() => SF.game.money);
await D(() => document.querySelector('#modal [data-salj]').click()); await sleep(3200);
const s1 = await D(() => ({ rubrik: document.querySelector('#modal:not(.hidden) .dlg-head')?.textContent || '', pengar: SF.game.money, scen: !!document.querySelector('#modal .dn-scen') }));
ok(s1.scen && /hämtar Morris/.test(s1.rubrik) && s1.pengar === m0 + bud.b.belopp, `familjen hämtar Morris vid dörren – +${s1.pengar - m0} kr`);
if (SHOTS) await p.screenshot({ path: 'tools/out/djurnet-avsked.png' });
ok(!(await djur()).includes('Morris'), 'Morris har flyttat (inte bland husdjuren)');
await stang();
// samma dag igen: Sixten får inga bud
await D((id) => { void id; }, null);
await D(async () => { const { annonsera } = await import('/js/pets/djurnet.js'); const s = (await import('/js/pets/sim.js')).petStore(); annonsera(SF.game, s.pets.find((x) => x.name === 'Sixten').id, 100); SF.game.min += 300; });
await sleep(2600);
ok(await D(() => !SF.game.djurnet.annonser.find((a) => a.bud)), 'en försäljning om dagen: inga fler bud i dag');

// ---- nästa dag: hälsningen ----
await D(() => { SF.game.day += 1; SF.game.min = 9 * 60; }); await sleep(2600);
ok(/hälsning från .* om Morris/.test(await D(() => window.__toasts.join(' | '))), '"💌 djurNET: En hälsning från … om Morris!"');
await D(async () => (await import('/js/core/djurnetapp.js')).openDjurnet(SF, 'brev')); await sleep(400);
ok(await D(() => !!document.querySelector('#modal .dn-brev .dn-foto') && /Morris/.test(document.querySelector('#modal .dn-brev')?.textContent || '')), 'Brevlådan: hälsningen med ett foto av Morris');
if (SHOTS) await p.screenshot({ path: 'tools/out/djurnet-brev.png' });

// ---- köp från en uppfödare ----
await D(async () => (await import('/js/core/djurnetapp.js')).openDjurnet(SF, 'kop')); await sleep(400);
const n0 = (await djur()).length, k0 = await D(() => SF.game.money);
const kop = await D(() => { const b = document.querySelector('#modal [data-kop]:not([disabled])'); const namn = b?.closest('.dn-rad')?.querySelector('b')?.textContent || ''; b?.click(); return namn; });
await sleep(400);
ok(kop && (await djur()).length === n0 + 1 && (await D(() => SF.game.money)) < k0 && /flyttat hem till dig/.test(await D(() => window.__toasts.join(' | '))), `köpte ${kop.trim()} – flyttade hem direkt`);
if (SHOTS) await p.screenshot({ path: 'tools/out/djurnet-kop.png' });
// köpet syns inte längre i utbudet
ok(await D(() => document.querySelectorAll('#modal [data-kop]').length === 5), 'dagens utbud: fem kvar');

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
