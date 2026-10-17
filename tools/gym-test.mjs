// 💪 PIXEL GYM (js/scenes/shop-gym.js, v0.138) – Carl 2026-10-17: "skapa ett gym … lyfta vikter, slå på boxsäcken,
// dansa, köra gruppklass … för att gå snabbare när man jobbar och bära flera brickor".
//   1. huset i förorten: dörren PIXEL GYM leder in till gymmet (SCENE_DOORS/SCENES)
//   2. receptionen: dagskortet kostar 30 kr första gången om dagen, ett pass tar 10 energi, trött → nej
//   3. de fyra minispelen går att spela och ger poäng i rätt gren: hantlarna (styrka), boxsäcken (styrka),
//      dansgolvet (rytm + halv kondition), gruppasset (kondition); miss ger mindre; tredje passet en fjärdedel
//   4. nivåerna: kondition nivå 1 → gymFart 1.08; styrka nivå 2 → gymBar 2; formen överlever en omladdning
//   5. på jobbet: walkable.js räknar farten × gymFart i jobbscenerna (inte i stan)
//   node tools/gym-test.mjs      (servern på 8788; annan port: SMOKE_PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=gym${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-gym', name: 'Gymmy', look: { skin: '#e0a97f', hair: '#3b2619', style: 'ponytail', shirt: '#e04848' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 10 * 60, money: 500, hunger: 80, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload().catch(() => {}); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await sleep(800);
const D = (fn, arg) => p.evaluate(fn, arg);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || ''));
const klicka = (txt) => D((t) => [...document.querySelectorAll('#modal button')].find((b) => b.textContent.includes(t))?.click(), txt);

// ---- 1. huset i stan ----
await stang(); await D(() => SF.go('city')); await sleep(1500); await stang();
const hus = await D(() => { const b = SF.scene._debug.buildings.find((x) => x.id === 'gym'); return b ? { x: b.x, w: b.w, enter: b.enter, sign: b.sign, district: b.district, row: b.row } : null; });
ok(hus && hus.enter === 'gym' && hus.district === 'FÖRORTEN' && hus.x > 3600 && hus.x < 3800 && hus.row === 's', `PIXEL GYM står i förortens södra rad (x ${hus?.x}, ${hus?.w} px brett)`);
await D(() => SF.scene._debug.teleport(3784, 652)); await sleep(300); await D(() => SF.scene._debug.enter('gym')); await sleep(3000); await stang();
ok((await D(() => SF.sceneName)) === 'gym', 'dörren leder in till gymmet');
const spots = await D(() => SF.scene._debug.spots());
ok(['disk', 'hantlar', 'box', 'dans', 'klass', 'dorr'].every((s) => spots.includes(s)), `platserna: ${spots.join(', ')}`);

// ---- 2. receptionen och dagskortet ----
await D(() => SF.scene._debug.act('disk')); await sleep(300);
ok(/dagskort/i.test(await modal()) && /Styrka/.test(await modal()), 'receptionen: dagskortet och formen');
await klicka('Köp dagskort'); await sleep(300);
ok((await D(() => SF.game.money)) === 470 && (await D(() => SF.game.gym.kort)) === 4, 'dagskortet kostar 30 kr och gäller i dag');
await stang();
await D(() => { SF.game.energy = 8; });
ok(!(await D(() => SF.scene._debug.start('vikter'))) && !(await D(() => SF.scene._debug.spel())), 'för trött (energi 8): inget pass');
await D(() => { SF.game.energy = 90; });

// ---- 3. hantlarna: tio lyft i takt → styrka ----
ok(await D(() => SF.scene._debug.start('vikter')), 'hantlarna startar');
ok((await D(() => SF.game.energy)) === 80 && (await D(() => SF.game.money)) === 470, 'passet tar 10 energi, dagskortet gäller (inga fler kronor)');
for (let i = 0; i < 10; i++) { await D(() => SF.scene._debug.lyft()); await sleep(60); }
await sleep(400);
const s1 = await D(() => SF.scene._debug.spel());
ok(s1?.klar && s1.reps === 10, `tio lyft i takt → passet klart (${s1?.reps} lyft)`);
ok(/SUVERÄNT|BRA/.test(await modal()) && /Styrka/.test(await modal()), 'resultatrutan: Styrka');
const f1 = await D(() => SF.scene._debug.form());
ok(f1.styrka === 24, `fulla poäng: 24 styrka (${f1.styrka})`);
await klicka('Klart'); await sleep(200);

// ---- 3. boxsäcken ----
ok(await D(() => SF.scene._debug.start('box')), 'boxsäcken startar');
for (let i = 0; i < 300; i++) { await D(() => SF.scene._debug.sla(true)); await sleep(80); const s = await D(() => SF.scene._debug.spel()); if (!s || s.klar || s.hits >= 16) break; }
await D(() => SF.scene._debug.snabba(30)); await sleep(500);
const s2 = await D(() => SF.scene._debug.spel());
ok(s2?.klar && s2.hits >= 10, `boxsäcken: ${s2?.hits} träffar → klart`);
const f2 = await D(() => SF.scene._debug.form());
ok(f2.styrka > f1.styrka && f2.nivaer.styrka >= 1, `styrkan växer (${f2.styrka} poäng, nivå ${f2.nivaer.styrka})`);
await klicka('Klart'); await sleep(200);

// ---- 3. gruppasset: rätt rörelser → kondition ----
ok(await D(() => SF.scene._debug.start('klass')), 'gruppasset startar');
for (let i = 0; i < 80; i++) { await D(() => { SF.scene._debug.gor(true); SF.scene._debug.hoppa(); }); await sleep(80); const s = await D(() => SF.scene._debug.spel()); if (!s || s.klar) break; }
await sleep(300);
const s3 = await D(() => SF.scene._debug.spel());
ok(s3?.klar && s3.ratt >= 15, `gruppasset: ${s3?.ratt} av 20 rätt → klart`);
const f3 = await D(() => SF.scene._debug.form());
ok(f3.kondition >= 18 && f3.nivaer.kondition === 0, `kondition ${f3.kondition} poäng (nivå 0 ännu)`);
await klicka('Klart'); await sleep(200);

// ---- 3. dansgolvet: alla noter → rytm + halv kondition ----
ok(await D(() => SF.scene._debug.start('dans')), 'dansgolvet startar');
for (let i = 0; i < 45; i++) { await D(() => SF.scene._debug.dansa()); await sleep(40); const s = await D(() => SF.scene._debug.spel()); if (!s || !s.noter) break; }
await D(() => SF.scene._debug.snabba(5)); await sleep(400);
const s4 = await D(() => SF.scene._debug.spel());
ok(s4?.klar && s4.poang >= 60, `dansgolvet: ${s4?.poang} poäng → klart`);
const f4 = await D(() => SF.scene._debug.form());
ok(f4.rytm >= 20 && f4.kondition > f3.kondition, `rytm ${f4.rytm} och kondition ${f4.kondition} (halva poängen)`);
await klicka('Klart'); await sleep(200);

// ---- 3. tredje passet i en gren ger en fjärdedel ----
await D(() => SF.scene._debug.start('vikter')); for (let i = 0; i < 10; i++) { await D(() => SF.scene._debug.lyft()); await sleep(40); } await sleep(300); await klicka('Klart'); await sleep(200);
const f5a = await D(() => SF.scene._debug.form());
await D(() => SF.scene._debug.start('vikter')); for (let i = 0; i < 10; i++) { await D(() => SF.scene._debug.lyft()); await sleep(40); } await sleep(300);
ok(/fjärdedel/.test(await modal()), 'tredje hantelpasset i dag: en fjärdedel');
await klicka('Klart'); await sleep(200);
const f5 = await D(() => SF.scene._debug.form());
ok(f5.styrka - f5a.styrka === 6, `…6 poäng i stället för 24 (${f5.styrka - f5a.styrka})`);

// ---- 4. nivåerna och vad de ger ----
await D(() => { SF.game.gym.kondition = 40; SF.game.gym.styrka = 100; SF.game.save(); });
const f6 = await D(() => SF.scene._debug.form());
ok(f6.nivaer.kondition === 1 && Math.abs(f6.fart - 1.08) < 1e-9, `kondition nivå 1 → fötterna 8 % snabbare (${f6.fart})`);
ok(f6.nivaer.styrka === 2 && f6.bar === 2, `styrka nivå 2 → två brickor i taget (${f6.bar})`);
await p.reload().catch(() => {}); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await sleep(800);
const sparat = await D(() => ({ ...SF.game.gym }));
ok(sparat.kondition === 40 && sparat.styrka === 100 && sparat.kort === 4 && sparat.pass?.vikter === 3, `formen överlever omladdningen (${JSON.stringify(sparat)})`);

// ---- 5. farten på jobbet ----
await stang();
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; SF.go('city'); }); await sleep(1200); await stang();
const fartStan = await D(async () => { const w = await import('/js/scenes/walkable.js'); const wk = w.createWalker({ spawn: [100, 150] }); wk.walkTo(300, 150); wk.update(0.5); return wk.px - 100; });
await D(() => { SF.sceneName = 'jobb-prov'; });
const fartJobb = await D(async () => { const w = await import('/js/scenes/walkable.js'); const wk = w.createWalker({ spawn: [100, 150] }); wk.walkTo(300, 150); wk.update(0.5); return wk.px - 100; });
await D(() => { SF.sceneName = 'city'; });
ok(Math.abs(fartStan - 31) < 0.01 && Math.abs(fartJobb - 31 * 1.08) < 0.01, `walkable: ${fartStan} px/halvsekund i stan, ${fartJobb.toFixed(2)} på jobbet (× gymFart)`);

// ---- 5b. Burgarbaren: styrka nivå 2 → två brickor i bunten, rätt tallrik går ur bunten när man serverar ----
await stang();
await D(() => { SF.game.jobs = { burgare: 2 }; SF.game.save(); SF.go('jobbburgare', { onDone: () => SF.go('city') }); });
await p.waitForFunction(() => SF.scene?._debug?.plates, null, { timeout: 10000 }); await sleep(500);
ok((await D(() => SF.scene._debug.kap())) === 2, 'Burgarbaren: bunten rymmer två brickor (styrka nivå 2)');
const bunt = await D(async () => {
  const Dg = SF.scene._debug;
  Dg.forcePlate(0); Dg.forcePlate(1);
  Dg.pickPlate(0);                       // bär rätt 0
  const annan = Dg.plates().find((q) => q.d === 1), spot = Dg.counterSpot(annan.slot);
  SF.scene.down(spot.x, spot.y - 8);     // klick på den andra tallriken: med plats i bunten tas den med
  for (let i = 0; i < 20 && Dg.carried().length < 2; i++) await new Promise((res) => setTimeout(res, 300));
  return { burna: Dg.carried(), kvar: Dg.plates().length };
});
ok(bunt.burna.length === 2 && bunt.burna.includes(0) && bunt.burna.includes(1), `två tallrikar i bunten (${JSON.stringify(bunt.burna)})`);
await D(() => { SF.scene.key('Escape'); }); await sleep(400); await stang();
ok(errs.length === 0, 'inga fel i sidan' + (errs.length ? ' – ' + errs.join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
