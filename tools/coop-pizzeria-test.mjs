// JOBBA TILLSAMMANS på Pizzerian: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass); Kalle bjuder in Julia via
// startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra,
// exakt EN skiftledare, extrabordet rullas fram; ledarens kunder och ugnens pizzor syns hos
// medarbetaren; medarbetaren tar ut en pizza ur den GEMENSAMMA ugnen (den försvinner EN gång, hos
// ledaren), packar den och serverar – och det är BAGAREN som får poängen; medarbetaren skjuter in
// en pizza i ledarens ugn (bänken är var och ens egen); tar båda samma pizza eller serverar samma
// kund samtidigt får bara en det; lagets räkning är synkad; ledarbyte utan id-krockar och ugnen
// gräddar vidare; lönebeskedet delar lika.
// (Pizzerian står inte i COOP_JOBS förrän den släpps – provet slår på den i båda sidorna.)
//   node tools/coop-pizzeria-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8812)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'pcoop' + Math.random().toString(36).slice(2, 8);
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; return !!c; };
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 250) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await wait(step); } return v; };

const browser = await chromium.launch();
async function boot(name) {
  const c = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=${WORLD}`);
  await p.evaluate((n) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: n.toLowerCase(), name: n, look: { skin: '#eabf98', shirt: n === 'Kalle' ? '#3a78d8' : '#d84a8a' }, color: '#3a78d8' }));
    // kl 12: pizzerian är öppen (11–23); båda är nybörjare – solo 4 bord, ihop 5
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { pizzeria: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'pizzeria' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('pizzeria'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'pizzeria', 'jobbpizzeria'); });
// ställ bagaren vid en station och klicka på den (scenens down(x, y), som ett riktigt klick)
const readyAt = (p, stand) => p.evaluate((st) => { const D2 = SF.scene._debug; const [x, y] = D2.standAt(st); D2.place(x, y, 'down'); }, stand);
const clickSpot = (p, spot) => p.evaluate((sp) => { const [x, y] = SF.scene._debug.spot(sp); SF.scene.down(x, y); }, spot);
// ställ bagaren vid kunden och klicka på hen
const readyServe = (p, id) => p.evaluate((i) => { const D2 = SF.scene._debug; const sp = D2.servePointOf(i); if (sp) D2.place(sp[0], sp[1], 'left'); return !!sp; }, id);
const clickCust = (p, id) => p.evaluate((i) => { const c = SF.scene._debug.customerSpot(i); if (c) SF.scene.down(c[0], c[1]); return !!c; }, id);
const idle = (p) => D(p, 'D.idle()');
const custOf = async (p, id) => ((await D(p, 'D.customersDbg()')) || []).find((k) => k.i === id) || null;

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia bakar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbpizzeria', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på Pizzerian erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbpizzeria' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i pizzerian (${seeA}/${seeB}) – båda kör sitt eget pass`);
const gA = await D(A, 'D.customersDbg()'), gB = await D(B, 'D.customersDbg()');
ok(gA?.length > 0 && gB?.length > 0, `båda har egna kunder i matsalen (${gA?.length}/${gB?.length})`);
const bordSolo = [(await D(A, 'D.lag()'))?.bord, (await D(B, 'D.lag()'))?.bord];
ok(bordSolo[0] === 4 && bordSolo[1] === 4, `nybörjare ensam: 4 bord (${bordSolo.join('/')})`);
await A.evaluate(() => { SF.shiftJob = null; SF.shiftPlan = null; SF.coop = null; SF.go('city'); });
await B.evaluate(() => SF.go('city'));
await wait(800);

// 1. IHOP: Kalle bjuder in Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ihop/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
await clickBtn(A, /Jobba ihop/);
await until(() => A.evaluate(() => document.querySelector('#modal [data-bjud]') ? 1 : 0), 5000, 200);
const bjudTxt = await A.evaluate(() => document.querySelector('#modal [data-bjud]')?.textContent || '');
await A.evaluate(() => document.querySelector('#modal [data-bjud]')?.click());
await A.waitForFunction(() => SF.sceneName === 'jobbpizzeria' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Pizzerian/.test(inv1 || ''), `Julia får inbjudan till Pizzerian (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbpizzeria' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
const planB = await B.evaluate(() => ({ ...SF.shiftPlan, sid: SF.coop?.sid })), planA = await A.evaluate(() => ({ ...SF.shiftPlan, sid: SF.coop?.sid }));
ok(planB.lvl === planA.lvl && planB.seconds === planA.seconds && planB.sid && planB.sid === planA.sid,
  `Julia jobbar på Kalles plan: nivå ${planB.lvl}, ${planB.seconds} s, samma pass ${planB.sid}`);
// förläng passet så att proven hinner klart (scenen läser samma planobjekt varje bildruta)
await A.evaluate(() => { SF.shiftPlan.seconds = 900; });
await B.evaluate(() => { SF.shiftPlan.seconds = 900; });

const synced = await until(async () => {
  const a = await D(A, 'D.coop()'), b = await D(B, 'D.coop()');
  return a && b && a.mates === 1 && b.mates === 1 && a.settled && b.settled ? { a, b } : null;
}, 25000, 400);
ok(!!synced, `kollegan syns i jobbscenen hos båda (${synced ? 'mates 1 och 1' : 'timeout'})`);
const seen = await A.evaluate(() => SF.worldFolksHere().length), seen2 = await B.evaluate(() => SF.worldFolksHere().length);
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i köket (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const lagL = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.maxN === 2 && g.maxN === 2 && l.bord === 5 && g.bord === 5 ? l : null; }, 5000, 300);
ok(!!lagL, `passet räknas som delat (2 pers) och extrabordet är framme hos båda (${lagL?.bord ?? '?'} bord)`);

// provlugn hos ledaren: inga egna kunder, tom ugn
await D(L, 'D.calm()');
await D(L, 'D.forceOven(0, null)');
await D(L, 'D.forceOven(1, null)');
const empty = await until(async () => ((await D(G, 'D.customersDbg()')) || [1]).length === 0 && ((await D(G, 'D.oven()')) || [1]).every((o) => !o), 6000, 300);
ok(!!empty, `${gn} ser att matsalen och ugnen töms hos ledaren`);

// 2. ledarens kund syns hos medarbetaren
const c1 = await D(L, 'D.forceCustomer(2, false)'); // HAWAII, äter här
const c1L = await custOf(L, c1?.id);
const seesCust = await until(async () => { const k = await custOf(G, c1?.id); return k && k.st === 'sit' && k.w === 2 && !k.take && k.ti === c1L?.ti ? k : null; }, 6000, 300);
ok(!!seesCust, `${gn} ser ledarens kund (id ${c1?.id}, HAWAII, bord ${c1L?.ti})`);

// 3. ugnen är gemensam: ledarens pizza syns och gräddas hos medarbetaren
const pid = await D(L, 'D.forceOven(0, 2, 0)'); // rå hawaii på plats 0
const seesPz = await until(async () => { const o = ((await D(G, 'D.oven()')) || [])[0]; return o && o.id === pid && o.kind === 2 ? o : null; }, 6000, 300);
ok(!!seesPz, `${gn} ser ledarens pizza i ugnen (id ${pid}, HAWAII)`);
const baking = await until(async () => { const o = ((await D(G, 'D.oven()')) || [])[0]; return o && o.bake >= 1 ? o : null; }, 6000, 300);
ok(!!baking, `den gräddas hos ${gn} också (${baking?.bake} s)`);
await D(L, "D.step('grädda')");
const golden = await until(async () => { const o = ((await D(G, 'D.oven()')) || [])[0]; return o && o.stage === 3 ? o : null; }, 6000, 300);
ok(!!golden, `${gn} ser att den blev gyllene hos ledaren`);

// 4. medarbetaren tar ut pizzan ur den gemensamma ugnen → den försvinner EN gång, hos ledaren
await readyAt(G, 'ugn0');
await clickSpot(G, 'ugn0');
const tookG = await until(async () => { const c = await D(G, 'D.carrying()'); return c && c.kind === 2 && c.on === 'spade' && c.stage === 3 ? c : null; }, 10000, 300);
ok(!!tookG, `${gn} tar ut den gyllene hawaiin via ledaren`);
const ovL = await D(L, 'D.oven()'), carryL = await D(L, 'D.carrying()');
ok(ovL && !ovL[0] && !ovL[1] && carryL === null, `ugnen hos ledaren är tom – pizzan togs ut EN gång (${ln} bär ingen)`);
const ovG = await until(async () => { const o = await D(G, 'D.oven()'); return o && !o[0] && !o[1]; }, 4000, 300);
ok(!!ovG, `${gn}s ugn visar samma (tom)`);

// 5. medarbetaren packar på tallrik (passet är ens eget) och serverar kunden → får poängen
await readyAt(G, 'tallrik');
await clickSpot(G, 'tallrik');
const plated = await until(async () => { const c = await D(G, 'D.carrying()'); return c && c.on === 'tallrik' ? c : null; }, 6000, 300);
ok(!!plated, `${gn} lägger pizzan på en tallrik`);
await readyServe(G, c1?.id);
await clickCust(G, c1?.id);
const servedG = await until(async () => { const s = await D(G, 'D.stats'); return s && s.ok >= 1 ? s : null; }, 12000, 300);
ok(!!servedG, `${gn} serverar hawaiin och FÅR POÄNGEN (ok: ${servedG?.ok})`);
const lStats = await D(L, 'D.stats');
ok(lStats && lStats.ok === 0, `ledaren fick INTE poängen (${ln}: ok ${lStats?.ok})`);
const handsG = await D(G, 'D.carrying()');
ok(handsG === null, `${gn}s händer är tomma efter serveringen`);
const custL = await until(async () => { const k = await custOf(L, c1?.id); return k && k.st === 'eat' ? k : null; }, 6000, 300);
ok(!!custL, 'kunden äter hos ledaren – serveringen gällde i den delade matsalen');
const eatG = await until(async () => { const k = await custOf(G, c1?.id); return k && k.st === 'eat' ? k : null; }, 6000, 300);
ok(!!eatG, `${gn} ser också kunden äta`);
const lag1 = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.ok === 1 && g.ok === 1 ? { l, g } : null; }, 6000, 300);
ok(!!lag1, `lagets räkning är synkad (${lag1 ? lag1.g.ok : '?'} rätt hos båda – lönen delas lika)`);

// 6. medarbetarens handling ändrar ledarens värld: bygger en margherita på SIN bänk och skjuter in den
await D(G, "D.step('deg')");
const benchL = await D(L, 'D.bench()'), benchG = await D(G, 'D.bench()');
ok(benchG && benchL === null, `bänken är var och ens egen (${gn} har en deg, ${ln}s bänk är tom)`);
await D(G, "D.step('sas')");
await D(G, "D.step('ost')");
await D(G, "D.step('lyft')");
await readyAt(G, 'ugn1');
await clickSpot(G, 'ugn1');
const inL = await until(async () => { const o = await D(L, 'D.oven()'); const pz = o && o.find((x) => x && x.kind === 0); return pz && pz.stage <= 2 ? pz : null; }, 10000, 300);
ok(!!inL, `${gn}s rå margherita står i ugnen hos ledaren (id ${inL?.id})`);
const handsG2 = await D(G, 'D.carrying()');
ok(handsG2 === null, `${gn} släppte den ur händerna`);
const inG = await until(async () => ((await D(G, 'D.oven()')) || []).some((x) => x && x.id === inL?.id), 4000, 300);
ok(!!inG, `${gn} ser den i ugnen (samma id)`);

// 7. samtidigt: SAMMA pizza – bara en får den
await D(L, 'D.forceOven(1, null)');
const race = await D(L, 'D.forceOven(0, 3, 6)'); // gyllene capricciosa, ensam i ugnen
await until(async () => { const o = await D(G, 'D.oven()'); return o && o[0]?.id === race && !o[1]; }, 6000, 300);
await Promise.all([L, G].map((p) => readyAt(p, 'ugn0')));
await Promise.all([L, G].map((p) => clickSpot(p, 'ugn0')));
await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
await wait(800);
const hL = await D(L, 'D.carrying()'), hG = await D(G, 'D.carrying()');
const ov7 = await D(L, 'D.oven()');
ok(((hL?.kind === 3) + (hG?.kind === 3)) === 1 && ov7 && !ov7[0] && !ov7[1],
  `båda sträcker sig efter samma capricciosa – bara EN får den (${ln}: ${hL?.kind ?? '-'}, ${gn}: ${hG?.kind ?? '-'}, ugnen tom)`);
const ov7g = await until(async () => { const o = await D(G, 'D.oven()'); return o && !o[0] && !o[1]; }, 4000, 300);
ok(!!ov7g, 'ugnen är tom hos båda – ingen dubblett');
await D(L, "D.step('släng')");
await D(G, "D.step('släng')");

// 8. samtidigt: SAMMA kund – bara en servering räknas
const c2 = await D(L, 'D.forceCustomer(1, true)'); // VESUVIO, TA MED
await until(async () => { const k = await custOf(G, c2?.id); return k && k.st === 'sit'; }, 6000, 300);
const before8 = { lag: (await D(L, 'D.lag()')).ok, l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok };
await Promise.all([L, G].map((p) => p.evaluate(() => SF.scene._debug.makePizza(1, 'kartong'))));
await Promise.all([L, G].map((p) => readyServe(p, c2?.id)));
await Promise.all([L, G].map((p) => clickCust(p, c2?.id)));
await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
await wait(1500);
const after8 = { lag: (await D(L, 'D.lag()')).ok, l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok };
const boxes = [await D(L, 'D.carrying()'), await D(G, 'D.carrying()')];
ok(after8.lag === before8.lag + 1 && (after8.l - before8.l) + (after8.g - before8.g) === 1,
  `båda serverar samma TA MED-kund – EN poäng (lag ${before8.lag} → ${after8.lag}; ${ln} +${after8.l - before8.l}, ${gn} +${after8.g - before8.g})`);
ok(boxes.filter((c) => c && c.on === 'kartong' && c.kind === 1).length === 1, `den som hann sist har kvar sin kartong (${ln}: ${boxes[0]?.on ?? '-'}, ${gn}: ${boxes[1]?.on ?? '-'})`);
const lag8 = await until(async () => ((await D(G, 'D.lag()')) || {}).ok === after8.lag, 4000, 300);
ok(!!lag8, `lagets räkning synkad efteråt (${after8.lag})`);
const leaving = await until(async () => { const k = await custOf(G, c2?.id); return !k || k.st === 'leave' ? 1 : null; }, 6000, 300);
ok(!!leaving, `${gn} ser kunden gå med sin kartong`);

// 9. LEDARBYTE: ledaren lämnar – medarbetaren tar över inom sekunder, ugnen gräddar vidare
// och nya kunder/pizzor krockar inte med gamla id:n
{
  await D(L, 'D.forceOven(1, null)');
  const kept = await D(L, 'D.forceOven(0, 4, 0.5)'); // kebabpizza som hinner gräddas en stund
  await until(async () => ((await D(G, 'D.oven()')) || [])[0]?.id === kept, 6000, 300);
  const ids0 = [...((await D(G, 'D.customersDbg()')) || []).map((k) => k.i), ...((await D(G, 'D.oven()')) || []).filter(Boolean).map((o) => o.id)];
  const maxId = Math.max(c1?.id ?? -1, c2?.id ?? -1, pid ?? -1, race ?? -1, inL?.id ?? -1, kept ?? -1, ...ids0);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 400);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const b1 = ((await D(G, 'D.oven()')) || [])[0];
  await wait(1500);
  const b2 = ((await D(G, 'D.oven()')) || [])[0];
  ok(b1 && b2 && b2.id === kept && b2.bake > b1.bake + 1, `ugnen gräddar vidare hos den nya ledaren (${b1?.bake} → ${b2?.bake} s)`);
  const fresh = await until(async () => ((await D(G, 'D.customersDbg()')) || []).find((k) => k.i > maxId) || null, 12000, 300);
  ok(!!fresh, `matsalen fortsätter hos den nya ledaren – en ny kund kommer in med NYTT id (${fresh?.i} > ${maxId})`);
  const forced = await D(G, 'D.forceCustomer()');
  const npz = await D(G, 'D.forceOven(1, 0, 0)');
  const ids = ((await D(G, 'D.customersDbg()')) || []).map((k) => k.i);
  ok((!forced || forced.id > maxId) && npz > maxId && new Set(ids).size === ids.length, `inga id-krockar (kunder ${ids.join(', ')}; ny pizza ${npz})`);
}

// 10. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
{
  const lagOk = (await D(G, 'D.lag()'))?.ok;
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lagOk} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lagOk} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
