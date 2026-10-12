// Regressionstest för 🏆 UTSTÄLLNINGSHALLEN i Tassbacken (js/scenes/utstallning.js) och 🐇 KANINHOPPNINGEN
// (js/scenes/kaninhopp.js). Carl 2026-10-12: "kan vi ha … kattutställning?".
//   • in i hallen från Tassbacken, anmälan vid disken (100 kr)
//   • katten går varvet i ringen, poserar tre gånger (visaren i det gröna) → domarna → resultatet
//   • en välskött, nytrimmad katt med perfekta poser vinner: rosett, prispengar, guldpokal i förrådet,
//     Best in Show – och får inte tävla igen samma dag
//   • kaninen hoppar banan felfritt (tryck före varje hinder) och placerar sig
//   • rosetterna sparas på djuren (pet.utst) och finns kvar efter omladdning
// Kör: node tools/utstallning-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT). SHOTS=1 sparar bilder.
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=ut${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-ut', name: 'Ulla', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 10 * 60, money: 3000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload().catch(() => {});   // (ett avbrutet reload kan hända – sidan laddas ändå, vänta på SF nedan)
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
const shot = (n) => (process.env.SHOTS ? p.screenshot({ path: `tools/out/${n}.png` }).catch(() => {}) : null);
// en välskött, nytrimmad katt och en kanin
const ids = await p.evaluate(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const S = petStore(), d = SF.game.day;
  const k = S.adopt('katt', 'skogkatt', 'hona', 'Misse', SF.game.home, { day: d - 30 });
  Object.assign(k, { stage: 'vuxen', hunger: 95, happy: 95, frisyr: { s: 'lejon', f: 'rosa', d }, minne: { sett: Date.now(), klapp: 40, lek: 12, boll: 6 } });
  const r = S.adopt('kanin', 'brun', 'hane', 'Stampe', SF.game.home, { day: d - 30 });
  Object.assign(r, { stage: 'vuxen', hunger: 90, happy: 90 });
  S.save();
  return { katt: k.id, kanin: r.id };
});
const scen = () => p.evaluate(() => SF.sceneName);
const djur = (id) => p.evaluate(async (id) => { const { petStore } = await import('/js/pets/sim.js'); const q = petStore().petById(id); return { utst: q?.utst || null, happy: q?.happy }; }, id);

// ---- in i hallen ----
await p.evaluate(() => { SF.tassFran = { y: 292 }; SF.go('tassbacken'); }); await sleep(1500);
await p.evaluate(() => SF.scene._debug.teleport(645, 196)); await sleep(300);
await p.evaluate(() => SF.scene._debug.act('hall'));
await p.waitForFunction(() => SF.sceneName === 'utstallning', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'utstallning', 'in genom porten till utställningshallen');
await sleep(1200); await shot('utstallning-hall');

// ---- kattutställningen ----
await p.evaluate(() => SF.scene._debug.act('anmalan'));
await p.waitForFunction(() => /Anmälan/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
ok(await p.evaluate(() => document.querySelectorAll('#modal [data-anmal]').length === 2), 'anmälan visar båda djuren');
await shot('utstallning-anmalan');
await p.evaluate((id) => document.querySelector(`#modal [data-anmal="${id}"]`).click(), ids.katt); await sleep(500);
const s0 = await p.evaluate(() => SF.scene._debug.show());
ok(s0 && (s0.fas === 'in' || s0.fas === 'varv'), `utställningen börjar (${s0?.fas})`);
ok((await p.evaluate(() => SF.game.money)) === 2900, 'anmälan kostar 100 kr');
await sleep(2600); await shot('utstallning-varv');
await p.evaluate(() => SF.scene._debug.tillPose());
await p.waitForFunction(() => SF.scene._debug.show()?.fas === 'pose', null, { timeout: 5000 }).catch(() => {});
ok((await p.evaluate(() => SF.scene._debug.show()?.fas)) === 'pose', 'efter varvet: posera');
await shot('utstallning-pose');
for (let i = 0; i < 3; i++) {
  await p.waitForFunction((i) => SF.scene._debug.show()?.forsok === i, i, { timeout: 5000 }).catch(() => {});
  await p.evaluate(() => { SF.scene._debug.centrera(); SF.scene.down(190, 120); });
  await sleep(250);
}
await p.waitForFunction(() => { const s = SF.scene._debug.show(); return !s || s.fas === 'domare' || s.fas === 'klar'; }, null, { timeout: 8000 }).catch(() => {});
const s1 = await p.evaluate(() => SF.scene._debug.show());
ok(s1 && s1.pose.length === 3 && s1.pose.every((x) => x === 2), `tre perfekta poser (${JSON.stringify(s1?.pose)})`);
await sleep(800); await shot('utstallning-domare');
await p.waitForFunction(() => /1:a plats/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
const res = await p.evaluate(() => ({ h: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '', body: document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || '', money: SF.game.money, pokal: SF.game.storage.filter((s) => s.k === 'pokal').map((s) => s.v) }));
ok(/Misse: 🥇 1:a plats/.test(res.h), `Misse vinner kattutställningen ("${res.h}")`);
ok(/BEST IN SHOW/.test(res.body), 'Best in Show!');
ok(res.money === 2900 + 400 + 500, `prispengarna: 400 + 500 för Best in Show (${res.money})`);
ok(res.pokal.includes(0), `guldpokalen ligger i förrådet (${JSON.stringify(res.pokal)})`);
await shot('utstallning-resultat');
const m1 = await djur(ids.katt);
ok(m1.utst?.katt?.[0] === 1 && m1.utst?.bis === 1, `rosetten och Best in Show sparas på katten (${JSON.stringify(m1.utst)})`);
await stang();
// samma dag igen: katten har redan tävlat
await p.evaluate(() => SF.scene._debug.act('anmalan')); await sleep(400);
ok(await p.evaluate((id) => document.querySelector(`#modal [data-anmal="${id}"]`)?.disabled === true, ids.katt), 'samma dag igen: "Tävlat i dag"');

// ---- kaninhoppningen ----
await p.evaluate((id) => document.querySelector(`#modal [data-anmal="${id}"]`).click(), ids.kanin);
await p.waitForFunction(() => SF.sceneName === 'kaninhopp', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'kaninhopp', 'kaninen tävlar i hoppning (egen scen)');
await p.evaluate(() => {
  SF.scene._debug.skipStart();
  window.__hopp = setInterval(() => { const n = SF.scene?._debug?.nasta?.(); if (n != null && n > 9 && n < 16) SF.scene._debug.hoppa(); }, 15);
});
await sleep(2500); await shot('kaninhopp');
await p.waitForFunction(() => SF.sceneName === 'utstallning', null, { timeout: 40000 }).catch(() => {});
await p.evaluate(() => clearInterval(window.__hopp));
ok((await scen()) === 'utstallning', 'efter målgången: tillbaka i hallen');
await p.waitForFunction(() => /Stampe/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
const hr = await p.evaluate(() => ({ h: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '', body: document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || '' }));
ok(/Stampe: 🥇/.test(hr.h) && /0 fel/.test(hr.body), `felfri runda: Stampe vinner kaninhoppningen ("${hr.h}")`);
await shot('kaninhopp-resultat');
const m2 = await djur(ids.kanin);
ok(m2.utst?.kanin?.[0] === 1, `rosetten sparas på kaninen (${JSON.stringify(m2.utst)})`);

// ---- efter omladdning ----
await p.reload().catch(() => {});   // (ett avbrutet reload kan hända – sidan laddas ändå, vänta på SF nedan)
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800);
const m3 = await djur(ids.katt);
ok(m3.utst?.katt?.[0] === 1 && m3.utst?.dag === 5, 'rosetterna finns kvar efter omladdning');

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
