// Regressionstest för 🩺 DJURKLINIKEN (js/scenes/shop-djurklinik.js) och 🐕 AGILITYCUPEN i hundparken
// (js/scenes/agility.js, tassbacken.js agilityAnmalan/efterAgility). Carl 2026-10-12: "bygg allting inklusive stadsdelarna".
//   • kliniken: hälsokoll (120 kr) → djuret gladare + pet.klinik = dagen; vaccination (200 kr) → pet.vacc,
//     och knappen är spärrad medan skyddet räcker; papegojan Kakan pratar; vågen väger djuret
//   • hälsokollen ger extra hälsopoäng på utställningen i en vecka (showPoang)
//   • agility: anmälan i hundparken (50 kr), loppet med hinder/tunnel/slalom/vippbräda (felfritt när man
//     trycker rätt), tillbaka vid parkens grind med resultatet, rosetten (utst.agility) och hunden tränad (agil)
// Kör: node tools/djurklinik-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT). SHOTS=1 sparar bilder.
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=dk${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-dk', name: 'Dina', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 12, min: 10 * 60, money: 2000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload().catch(() => {});   // (ett avbrutet reload kan hända – sidan laddas ändå, vänta på SF nedan)
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
const shot = (n) => (process.env.SHOTS ? p.screenshot({ path: `tools/out/${n}.png` }).catch(() => {}) : null);
const scen = () => p.evaluate(() => SF.sceneName);
const hundId = await p.evaluate(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const S = petStore(), h = S.adopt('hund', 'collie', 'hona', 'Saga', SF.game.home, { day: SF.game.day - 30, stage: 'vuxen' });
  h.happy = 60; S.save(); return h.id;
});
const hund = () => p.evaluate(async (id) => { const { petStore } = await import('/js/pets/sim.js'); const q = petStore().petById(id); return { happy: q.happy, klinik: q.klinik, vacc: q.vacc, agil: q.agil | 0, utst: q.utst || null, stage: q.stage }; }, hundId);
ok((await hund()).stage === 'vuxen', 'adopt(…, { stage: "vuxen" }) ger ett vuxet djur');

// ================= kliniken =================
await p.evaluate(() => { SF.tassFran = { y: 292 }; SF.go('tassbacken'); }); await sleep(1500);
await p.evaluate(() => SF.scene._debug.teleport(385, 196)); await sleep(300);
await p.evaluate(() => SF.scene._debug.act('klinik'));
await p.waitForFunction(() => SF.sceneName === 'djurklinik', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'djurklinik', 'in på djurkliniken');
await sleep(1200); await shot('djurklinik');
await p.evaluate(() => SF.scene._debug.act('kakan')); await sleep(300);
ok(/KAKA|HEJ|DOKTORN|VOFF/i.test(await p.evaluate(() => SF.scene._debug.tova() || '')), 'papegojan Kakan pratar');
await p.evaluate(() => SF.scene._debug.act('vag')); await sleep(200);
ok(/SAGA: \d+,\d KG/.test(await p.evaluate(() => SF.scene._debug.vag() || '')), `vågen väger Saga (${await p.evaluate(() => SF.scene._debug.vag())})`);
const h0 = await hund(), m0 = await p.evaluate(() => SF.game.money);
await p.evaluate(() => SF.scene._debug.act('bord'));
await p.waitForFunction(() => /Djurkliniken/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
await shot('djurklinik-meny');
await p.evaluate(() => document.querySelector('#modal [data-beh="koll"]').click()); await sleep(800);
await shot('djurklinik-koll');
await p.evaluate(() => SF.scene._debug.snabba()); await sleep(400);
const h1 = await hund();
ok(h1.happy > h0.happy && h1.klinik === 12, `hälsokollen: gladare (${Math.round(h0.happy)} → ${Math.round(h1.happy)}) och pet.klinik = dag 12`);
ok(m0 - (await p.evaluate(() => SF.game.money)) === 120, 'hälsokollen kostar 120 kr');
ok(/Saga är frisk och glad/.test(await p.evaluate(() => window.__toasts.join(' | '))), '"🩺 Saga är frisk och glad!"');
// vaccinationen och spärren
await sleep(300);
await p.evaluate(() => SF.scene._debug.act('bord')); await sleep(400);
await p.evaluate(() => document.querySelector('#modal [data-beh="vaccin"]').click()); await sleep(500);
await p.evaluate(() => SF.scene._debug.snabba()); await sleep(400);
ok((await hund()).vacc === 12, 'vaccinationen: pet.vacc = dag 12');
await p.evaluate(() => SF.scene._debug.act('bord')); await sleep(400);
ok(await p.evaluate(() => document.querySelector('#modal [data-beh="vaccin"]')?.disabled === true), 'vaccinera igen: spärrat medan skyddet räcker');
await stang();
// hälsopoängen på utställningen
const bonus = await p.evaluate(async (id) => { const { showPoang } = await import('/js/scenes/utstallning.js'); const { petStore } = await import('/js/pets/sim.js'); const q = petStore().petById(id); const med = showPoang(q, 12, 0, 0.5).halsa, utan = showPoang({ ...q, klinik: undefined }, 12, 0, 0.5).halsa; return { med, utan }; }, hundId);
ok(bonus.med > bonus.utan, `klinikbesöket ger extra hälsopoäng på utställningen (${bonus.utan} → ${bonus.med})`);
await p.evaluate(() => SF.scene._debug.act('dorr'));
await p.waitForFunction(() => SF.sceneName === 'tassbacken', null, { timeout: 8000 }).catch(() => {});

// ================= agilitycupen =================
await p.evaluate(() => SF.scene._debug.teleport(1018, 300)); await sleep(300);
await p.evaluate(() => SF.scene._debug.act('agility'));
await p.waitForFunction(() => /Agilitycupen/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
ok(await p.evaluate(() => !!document.querySelector('#modal [data-hund]')), 'agilitycupen: Saga kan anmälas');
await p.evaluate(() => document.querySelector('#modal [data-hund]').click());
await p.waitForFunction(() => SF.sceneName === 'agility', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'agility', 'loppet börjar (egen scen)');
// spelar loppet: hoppa före hinder och däck, tryck i slalom, låt bli i tunneln och på vippbrädan
await p.evaluate(() => {
  SF.scene._debug.skipStart();
  window.__ag = setInterval(() => {
    const n = SF.scene?._debug?.nasta?.(); if (!n) return;
    if ((n.typ === 'hopp' || n.typ === 'dack') && n.rel > 12 && n.rel < 20) SF.scene._debug.tryck();
    if (n.typ === 'slalom' && n.rel < 0) SF.scene._debug.tryck();
  }, 15);
});
await sleep(3000); await shot('agility');
await p.waitForFunction(() => SF.sceneName === 'tassbacken', null, { timeout: 60000 }).catch(() => {});
await p.evaluate(() => clearInterval(window.__ag));
ok((await scen()) === 'tassbacken', 'efter målgången: tillbaka i Tassbacken');
await p.waitForFunction(() => /Saga/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
const ar = await p.evaluate(() => ({ h: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '', body: document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || '', pos: SF.scene._debug.pos() }));
ok(/Saga: 🥇/.test(ar.h) && /0 fel/.test(ar.body), `felfritt lopp: Saga vinner agilitycupen ("${ar.h}")`);
ok(ar.pos.y > 320 && Math.abs(ar.pos.x - 1018) < 30, `man står vid hundparkens grind (${Math.round(ar.pos.x)}, ${Math.round(ar.pos.y)})`);
await shot('agility-resultat');
const h2 = await hund();
ok(h2.utst?.agility?.[0] === 1 && h2.agil === 1, `rosetten och träningen sparas (${JSON.stringify(h2.utst)}, agil ${h2.agil})`);
await stang();
await p.evaluate(() => SF.scene._debug.act('agility')); await sleep(400);
ok(await p.evaluate(() => document.querySelector('#modal [data-hund]')?.disabled === true), 'samma dag igen: "Tävlat i dag"');

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
