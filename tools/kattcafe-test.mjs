// Regressionstest för ☕ KATTCAFÉ KURR (js/scenes/shop-kattcafe.js) och 🏡 TASSARNAS HEM (js/scenes/shop-djurhem.js)
// i Tassbacken. Carl 2026-10-12: "bygg allting inklusive stadsdelarna".
//   • kattcaféet: sju katter lever (kattgången, fönstret, klösträdet, golvet), klappa en katt (spinner + 😊),
//     fika vid disken (pengar → mättnad), sätta sig vid ett bord → en katt kommer upp på bordet,
//     fjäderspöet → katterna springer dit man klickar
//   • djurhemmet: veckans djur (4 hundar, 3 katter, 2 kaniner), adoptera ett vuxet djur (300 kr → det finns
//     hemma som VUXET), det försvinner ur djurhemmet; hjälpa till en gång om dagen; insamlingsbössan
//   • djurhemmets anteckningar sparas (g.djurhem) och finns kvar efter omladdning
// Kör: node tools/kattcafe-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT). SHOTS=1 sparar bilder.
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=kc${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-kc', name: 'Kalle', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 9, min: 10 * 60, money: 2000, hunger: 40, energy: 60, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload().catch(() => {});   // (ett avbrutet reload kan hända – sidan laddas ändå, vänta på SF nedan)
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
const shot = (n) => (process.env.SHOTS ? p.screenshot({ path: `tools/out/${n}.png` }).catch(() => {}) : null);
const scen = () => p.evaluate(() => SF.sceneName);

// ================= kattcaféet =================
await p.evaluate(() => { SF.tassFran = { y: 292 }; SF.go('tassbacken'); }); await sleep(1500);
await p.evaluate(() => SF.scene._debug.teleport(910, 196)); await sleep(300);
await p.evaluate(() => SF.scene._debug.act('kafe'));
await p.waitForFunction(() => SF.sceneName === 'kattcafe', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'kattcafe', 'in i Kattcafé Kurr');
await sleep(1500); await shot('kattcafe');
const k0 = await p.evaluate(() => SF.scene._debug.katter());
ok(k0.length >= 7 && ['gang', 'fonster', 'trad1', 'golv', 'korg'].every((pl) => k0.some((k) => k.plats === pl)), `minst sju katter: på kattgången, i fönstret, i klösträdet, på golvet och i korgen (${k0.map((k) => k.namn).join(', ')})`);
// klappa
await p.evaluate(() => SF.scene._debug.klappa('Pepparkaka')); await sleep(300);
const k1 = await p.evaluate(() => ({ k: SF.scene._debug.katter().find((q) => q.namn === 'Pepparkaka'), prat: SF.scene._debug.tova() }));
ok(k1.k.klapp && /Purrr|Mjau/i.test(k1.prat || ''), `klappa Pepparkaka: hon spinner ("${k1.prat}")`);
// fika
const f0 = await p.evaluate(() => ({ money: SF.game.money, hunger: SF.game.hunger }));
await p.evaluate(() => SF.scene._debug.act('disk'));
await p.waitForFunction(() => /Kattcafé Kurr/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
await shot('kattcafe-meny');
await p.evaluate(() => document.querySelector('#modal [data-fika="kattkaka"]').click()); await sleep(400);
const f1 = await p.evaluate(() => ({ money: SF.game.money, hunger: SF.game.hunger }));
ok(f0.money - f1.money === 35 && f1.hunger > f0.hunger, `kattkakan: 35 kr och mättare (${f0.hunger} → ${f1.hunger})`);
// sätta sig vid bordet → en katt kommer upp
await p.evaluate(() => SF.scene._debug.teleport(226, 152)); await sleep(200);
await p.evaluate(() => SF.scene._debug.act('bord0'));
await p.waitForFunction(() => SF.scene._debug.sitter() === 0, null, { timeout: 5000 }).catch(() => {});
ok((await p.evaluate(() => SF.scene._debug.sitter())) === 0, 'sätter sig vid bordet');
await p.waitForFunction(() => SF.scene._debug.katter().some((k) => k.paBord && k.state !== 'ga'), null, { timeout: 15000 }).catch(() => {});
ok(await p.evaluate(() => SF.scene._debug.katter().some((k) => k.paBord)), 'en katt kommer upp på bordet och håller sällskap');
await shot('kattcafe-bord');
// fjäderspöet
await p.evaluate(() => SF.scene._debug.act('disk')); await sleep(400);
await p.evaluate(() => document.querySelector('#modal [data-spo]').click()); await sleep(300);
ok(await p.evaluate(() => SF.scene._debug.spo()), 'fjäderspöet köpt (20 kr)');
await p.evaluate(() => SF.scene.down(300 - SF.scene._debug.cam(), 190)); await sleep(2500);
const k2 = await p.evaluate(() => SF.scene._debug.katter().filter((k) => k.plats === 'golv'));
ok(k2.some((k) => k.state === 'lek' || k.state === 'ga'), `golvkatterna springer efter fjäderspöet (${k2.map((k) => k.state).join(', ')})`);
await shot('kattcafe-spo');
await p.evaluate(() => SF.scene._debug.act('dorr'));
await p.waitForFunction(() => SF.sceneName === 'tassbacken', null, { timeout: 8000 }).catch(() => {});

// ================= djurhemmet =================
await p.evaluate(() => SF.scene._debug.teleport(177, 196)); await sleep(300);
await p.evaluate(() => SF.scene._debug.act('hem'));
await p.waitForFunction(() => SF.sceneName === 'djurhem', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'djurhem', 'in i Tassarnas hem');
await sleep(1500); await shot('djurhem');
const d0 = await p.evaluate(() => SF.scene._debug.djur());
const n = (sp) => d0.filter((d) => d.species === sp).length;
ok(n('hund') === 4 && n('katt') === 3 && n('kanin') === 2, `veckans djur: 4 hundar, 3 katter, 2 kaniner (${d0.map((d) => d.namn).join(', ')})`);
const valt = d0.find((d) => d.species === 'hund' && d.stage === 'vuxen') || d0[0];
await p.evaluate((id) => SF.scene._debug.visa(id), valt.id);
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) .btn-go'), null, { timeout: 5000 }).catch(() => {});
await shot('djurhem-djur');
const m0 = await p.evaluate(() => SF.game.money);
await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await sleep(500);
const ad = await p.evaluate(async (namn) => { const { petStore } = await import('/js/pets/sim.js'); const q = petStore().pets.find((x) => x.name === namn); return { finns: !!q, stage: q?.stage, species: q?.species, money: SF.game.money, kvar: SF.scene._debug.djur().map((d) => d.namn), toasts: window.__toasts.join(' | ') }; }, valt.namn);
ok(ad.finns && ad.species === valt.species, `${valt.namn} är adopterad och finns bland ens djur`);
ok(ad.stage === valt.stage, `${valt.namn} kommer hem som ${valt.stage} (inte som unge): ${ad.stage}`);
ok(m0 - ad.money === 300, `adoptionen kostar 300 kr (${m0} → ${ad.money})`);
ok(!ad.kvar.includes(valt.namn), `${valt.namn} bor inte kvar på djurhemmet`);
ok(new RegExp(`${valt.namn} har fått ett nytt hem`).test(ad.toasts), '"🏡 … har fått ett nytt hem – hos dig!"');
// hjälpa till (en gång om dagen)
const tid0 = await p.evaluate(() => SF.game.min);
await p.evaluate(() => SF.scene._debug.act('mat')); await sleep(300);
const h1 = await p.evaluate(() => ({ min: SF.game.min, hjalp: SF.game.djurhem.hjalp, day: SF.game.day }));
ok(h1.hjalp === h1.day && h1.min - tid0 >= 59, `hjälpa till: en timme vid matstationen (${tid0} → ${h1.min})`);
await p.evaluate(() => SF.scene._debug.act('mat')); await sleep(300);
ok(/redan hjälpt till/.test(await p.evaluate(() => SF.scene._debug.tova() || '')), 'samma dag igen: "Du har redan hjälpt till i dag"');
// insamlingsbössan
const b0 = await p.evaluate(() => SF.game.money);
await p.evaluate(() => SF.scene._debug.act('bossa')); await sleep(300);
await p.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /50/.test(b.textContent)).click()); await sleep(300);
ok(b0 - (await p.evaluate(() => SF.game.money)) === 50, 'insamlingsbössan: 50 kr');
await shot('djurhem-klar');
// efter omladdning
await p.reload().catch(() => {});   // (ett avbrutet reload kan hända – sidan laddas ändå, vänta på SF nedan)
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800);
const spar = await p.evaluate(() => SF.game.djurhem);
ok(spar.adopterade.length === 1 && spar.hjalp === 9, `djurhemmets anteckningar finns kvar efter omladdning (${JSON.stringify(spar)})`);

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
