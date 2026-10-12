// Regressionstest för 🐾 TASSBACKEN (js/scenes/tassbacken.js + js/tassbacken/karta.js) och ✂️ DJURTRIMMAREN
// (js/scenes/shop-trimmare.js, js/pets/trim.js). Carl 2026-10-12: "bygg allting inklusive stadsdelarna …
// kan vi ha olika frisyrer för våra katter".
//   • västerut förbi stadsgränsen på Pixelgatan → Tassbacken (och österut tillbaka till stan)
//   • ens katt på promenad följer med in i Tassbacken
//   • djurtrimmaren: välj frisyr + färg, betala, trimningen spelas upp och frisyren sparas på djuret
//   • alla sex frisyrer ger en annan bild än den naturliga pälsen (katt, hund och kanin)
//   • frisyren finns kvar efter omladdning; okända stilar rensas bort ur sparfilen
// Kör: node tools/tassbacken-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT). SHOTS=1 sparar bilder.
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=tb${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-tb', name: 'Tassa', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 11 * 60, money: 3000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
// en vuxen katt som är ute på promenad med en
const kattId = await p.evaluate(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const S = petStore(), k = S.adopt('katt', 'tigrerad', 'hona', 'Misse', SF.game.home, { day: SF.game.day - 20 });
  k.stage = 'vuxen'; k.out = true; S.save();
  return k.id;
});
const scen = () => p.evaluate(() => SF.sceneName);
const shot = (n) => (process.env.SHOTS ? p.screenshot({ path: `tools/out/${n}.png` }).catch(() => {}) : null);

// ---- stan → Tassbacken ----
await p.evaluate(() => SF.go('city')); await sleep(1200);
await p.evaluate(() => SF.scene._debug.teleport(-1170, 292)); await sleep(400);
await shot('tassbacken-skylt');
await p.evaluate(() => SF.scene._debug.walkTo(-1197, 292));
await p.waitForFunction(() => SF.sceneName === 'tassbacken', null, { timeout: 12000 }).catch(() => {});
ok((await scen()) === 'tassbacken', 'västerut förbi stadsgränsen: in i Tassbacken');
await sleep(2500);
const in1 = await p.evaluate(() => ({ pos: SF.scene._debug.pos(), pets: SF.scene._debug.pets(), djur: SF.scene._debug.djur().length }));
ok(in1.pos.x > 1600 && in1.pos.y > 270 && in1.pos.y < 306, `man kommer in vid östra kanten på samma trottoar (${Math.round(in1.pos.x)}, ${Math.round(in1.pos.y)})`);
ok(in1.pets.some((f) => f.name === 'Misse'), `katten på promenad följer med (${in1.pets.map((f) => f.name).join(', ')})`);
ok(in1.djur > 15, `Tassbacken lever: ${in1.djur} djur (hundar i koppel, i parken, katter, kaniner, änder)`);
await shot('tassbacken-in');
// en titt västerut över hela stadsdelen
for (const [x, y, n] of [[1100, 296, 'tassbacken-trim'], [700, 300, 'tassbacken-hall'], [450, 480, 'tassbacken-damm'], [1000, 420, 'tassbacken-park'], [200, 296, 'tassbacken-hem']]) { await p.evaluate(([x, y]) => SF.scene._debug.teleport(x, y), [x, y]); await sleep(500); await shot(n); }
const ej = await p.evaluate(() => [SF.scene._debug.walkable(450, 404), SF.scene._debug.walkable(1450, 384), SF.scene._debug.walkable(1018, 300)]);
ok(!ej[0] && !ej[1] && ej[2], 'dammen och fontänen går inte att gå i, trottoaren går');
// stängda hus: en skylt berättar vad som kommer
await p.evaluate(() => SF.scene._debug.act('hall')); await sleep(300);
ok(/Utställningshallen – öppnar snart/.test(await p.evaluate(() => window.__toasts.join(' | '))), 'utställningshallen: "öppnar snart" med vad som kommer');

// ---- trimmaren ----
await p.evaluate(() => SF.scene._debug.teleport(1099, 196)); await sleep(300);
await p.evaluate(() => SF.scene._debug.act('trim'));
await p.waitForFunction(() => SF.sceneName === 'trimmaren', null, { timeout: 8000 }).catch(() => {});
ok((await scen()) === 'trimmaren', 'in genom dörren till Klipp & Klo');
await sleep(800);
await shot('trimmaren');
const pengar0 = await p.evaluate(() => SF.game.money);
await p.evaluate(() => SF.scene._debug.act('bord'));
await p.waitForFunction(() => /Klipp & Klo/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
ok(await p.evaluate(() => document.querySelectorAll('#modal [data-stil]').length === 7), 'dialogen visar sex frisyrer + Naturlig');
await p.evaluate(() => document.querySelector('#modal [data-stil="lejon"]').click()); await sleep(150);
await p.evaluate(() => document.querySelector('#modal [data-farg="rosa"]').click()); await sleep(150);
const knapp = await p.evaluate(() => document.querySelector('#modal .btn-go')?.textContent || '');
ok(/340/.test(knapp), `lejonklipp + färg kostar 340 kr ("${knapp}")`);
await shot('trimmaren-dialog');
await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await sleep(1200);
const s1 = await p.evaluate(() => SF.scene._debug.seq());
ok(s1 && !s1.klar && s1.s === 'lejon', 'Misse står på trimbordet: badet börjar');
await sleep(2400); await shot('trimmaren-fon');
await p.evaluate(() => SF.scene._debug.snabba()); await sleep(600);
const efter = await p.evaluate(async (id) => { const { petStore } = await import('/js/pets/sim.js'); return { fr: petStore().petById(id)?.frisyr, money: SF.game.money, toasts: window.__toasts.join(' | ') }; }, kattId);
ok(efter.fr?.s === 'lejon' && efter.fr?.f === 'rosa', `frisyren sparas på katten (${JSON.stringify(efter.fr)})`);
ok(pengar0 - efter.money === 340, `340 kr dras (${pengar0} → ${efter.money})`);
ok(/Misse fick 🦁 Lejonklipp \(rosa\)/.test(efter.toasts), '"✨ Misse fick 🦁 Lejonklipp (rosa)!"');
await sleep(1200); await shot('trimmaren-klar');

// ---- alla frisyrer syns (katt, hund, kanin – från sidan och framifrån) ----
const olika = await p.evaluate(async () => {
  const { drawPet } = await import('/js/pets/sprites.js'), { FRISYRER } = await import('/js/pets/trim.js');
  const sig = (pet, dir) => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); drawPet(g, 32, 56, pet, 'idle', 0, dir); const d = g.getImageData(0, 0, 64, 64).data; let s = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + i) % 1e9; return s; };
  const fel = [];
  for (const [sp, br] of [['katt', 'tigrerad'], ['hund', 'labrador'], ['kanin', 'brun']]) for (const dir of ['right', 'down']) {
    const bas = { id: 'x-' + sp, species: sp, breed: br, sex: 'hona', stage: 'vuxen', seed: 'q' }, s0 = sig(bas, dir);
    for (const F of FRISYRER) if (sig({ ...bas, frisyr: { s: F.id, f: 'bla' } }, dir) === s0) fel.push(`${sp}/${dir}/${F.id}`);
  }
  return fel;
});
ok(!olika.length, `alla sex frisyrer syns på katt, hund och kanin${olika.length ? ' – SAKNAS: ' + olika.join(', ') : ''}`);

// ---- ut igen och tillbaka till stan ----
await p.evaluate(() => SF.scene._debug.act('dorr'));
await p.waitForFunction(() => SF.sceneName === 'tassbacken', null, { timeout: 8000 }).catch(() => {});
const ut = await p.evaluate(() => SF.scene._debug.pos());
ok((await scen()) === 'tassbacken' && Math.abs(ut.x - 1099) < 12, `ut ur trimmaren: framför dörren (${Math.round(ut.x)}, ${Math.round(ut.y)})`);
await sleep(1500); await shot('tassbacken-lejon');
await p.evaluate(() => SF.scene._debug.teleport(1660, 292)); await sleep(300);
await p.evaluate(() => SF.scene._debug.walkTo(1679, 292));
await p.waitForFunction(() => SF.sceneName === 'city', null, { timeout: 12000 }).catch(() => {});
const stan = await p.evaluate(() => ({ s: SF.sceneName, x: SF.scene._debug?.pos?.()?.x ?? SF.cityPos?.[0] }));
ok(stan.s === 'city' && stan.x < -1150, `österut: tillbaka i stan vid västra stadsgränsen (x ${Math.round(stan.x)})`);

// ---- sparfilen: frisyren finns kvar, skräp rensas ----
await p.evaluate(async () => { const raw = JSON.parse(localStorage.getItem('snabbfilen_pets1')); raw.pets.push({ ...raw.pets[0], id: 'skrap', name: 'Skräp', frisyr: { s: 'hacka<script>', f: 'x' } }); localStorage.setItem('snabbfilen_pets1', JSON.stringify(raw)); });
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800);
const spar = await p.evaluate(async (id) => { const { petStore } = await import('/js/pets/sim.js'); const S = petStore(); return { misse: S.petById(id)?.frisyr, skrap: S.petById('skrap') ? S.petById('skrap').frisyr ?? null : 'saknas' }; }, kattId);
ok(spar.misse?.s === 'lejon', 'frisyren finns kvar efter omladdning');
ok(spar.skrap === null || spar.skrap === 'saknas', `okänd frisyr rensas ur sparfilen (${JSON.stringify(spar.skrap)})`);

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
