// JOBBA TILLSAMMANS på Kaféet: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass); Kalle (Proffs) bjuder in
// Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser
// varandra, exakt EN skiftledare; ledarens gäster och monter syns hos medarbetaren; medarbetaren
// tar ett bakverk (montern minskar EN gång, hos ledaren) och serverar en gäst – och det är
// BARISTAN som får poängen; tar båda det sista bakverket eller serverar samma gäst samtidigt får
// bara en det; lagets räkning är synkad; ledarbyte utan id-krockar; lönebeskedet delar lika.
//   node tools/coop-kafe-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8811)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'kcoop' + Math.random().toString(36).slice(2, 8);
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
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { kafe: n === 'Kalle' ? 6 : 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'kafe', 'jobbkafe'); });
// klick på en plats i kaféet (_debug.spots) via scenens down(x, y)
const clickSpot = (p, name, i = 0) => p.evaluate(([n, i]) => { const s = SF.scene._debug.spots[n]; const [x, y] = Array.isArray(s[0]) ? s[i] : s; SF.scene.down(x, y); }, [name, i]);
const idle = (p) => D(p, 'D.idle()');

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia jobbar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbkafe', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Vanligt pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på Kaféet erbjuder 💼 Jobba ihop');
await clickBtn(A, /Vanligt pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbkafe' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra på Kaféet (${seeA}/${seeB}) – båda kör sitt eget pass`);
const gA = await D(A, 'D.customersDbg()'), gB = await D(B, 'D.customersDbg()');
ok(gA?.length > 0 && gB?.length > 0, `båda har egna gäster vid disken (${gA?.length}/${gB?.length})`);
await A.evaluate(() => { SF.shiftJob = null; SF.shiftPlan = null; SF.coop = null; SF.go('city'); });
await B.evaluate(() => SF.go('city'));
await wait(800);

// 1. IHOP: Kalle bjuder in Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ihop/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
await clickBtn(A, /Jobba ihop/);
await until(() => A.evaluate(() => document.querySelector('#modal [data-bjud]') ? 1 : 0), 5000, 200);
const bjudTxt = await A.evaluate(() => document.querySelector('#modal [data-bjud]')?.textContent || '');
await A.evaluate(() => document.querySelector('#modal [data-len="langt"]')?.click());
await A.evaluate(() => document.querySelector('#modal [data-bjud]')?.click());
await A.waitForFunction(() => SF.sceneName === 'jobbkafe' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Kaféet/.test(inv1 || ''), `Julia får inbjudan till Kaféet (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbkafe' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
const planB = await B.evaluate(() => ({ ...SF.shiftPlan, sid: SF.coop?.sid })), planA = await A.evaluate(() => ({ ...SF.shiftPlan, sid: SF.coop?.sid }));
ok(planB.lvl === 3 && planB.len === 'langt' && planB.seconds === planA.seconds && planB.sid && planB.sid === planA.sid,
  `Julia jobbar på Kalles nivå och passlängd: ${planB.lvl}, ${planB.len}, ${planB.seconds} s, samma pass ${planB.sid}`);
// förläng passet så att proven hinner klart (scenen läser samma planobjekt varje bildruta)
await A.evaluate(() => { SF.shiftPlan.seconds = 900; });
await B.evaluate(() => { SF.shiftPlan.seconds = 900; });

const synced = await until(async () => {
  const a = await D(A, 'D.coop()'), b = await D(B, 'D.coop()');
  return a && b && a.mates === 1 && b.mates === 1 && a.settled && b.settled ? { a, b } : null;
}, 25000, 400);
ok(!!synced, `kollegan syns i jobbscenen hos båda (${synced ? 'mates 1 och 1' : 'timeout'})`);
const seen = await A.evaluate(() => SF.worldFolksHere().length), seen2 = await B.evaluate(() => SF.worldFolksHere().length);
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra bakom disken (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const hud = await D(L, 'D.lag()');
ok(hud && hud.maxN === 2, `passet räknas som delat (${hud?.maxN} pers)`);

// provlugn hos ledaren: inga egna gäster, bagaren tar paus
await D(L, 'D.calm()');
await D(L, 'D.bake(false)');
const empty = await until(async () => ((await D(G, 'D.customersDbg()')) || [1]).length === 0, 6000, 300);
ok(!!empty, `${gn} ser att disken töms hos ledaren`);

// 2. ledarens gäst syns hos medarbetaren
const g1 = await D(L, 'D.forceCustomer(1, 0)'); // cappuccino + kanelbulle
const seesCust = await until(async () => ((await D(G, 'D.customersDbg()')) || []).find((k) => k.i === g1?.id && k.st === 'wait' && k.d === 1 && k.p === 0 && k.spot === g1.spot) || null, 6000, 300);
ok(!!seesCust, `${gn} ser ledarens gäst (id ${g1?.id}, CAPPUCCINO + KANELBULLE, plats ${g1?.spot})`);

// 3. montern: ledarens räkning syns; medarbetaren tar en bulle → montern minskar EN gång
await D(L, 'D.setStock(0, 2)');
const seesStock = await until(async () => ((await D(G, 'D.stock()')) || [])[0] === 2, 6000, 300);
ok(!!seesStock, `${gn} ser ledarens monter (2 kanelbullar kvar)`);
await clickSpot(G, 'monter', 0);
const tookG = await until(async () => ((await D(G, 'D.carrying()')) || {}).pastry === 0, 10000, 300);
ok(!!tookG, `${gn} tar en kanelbulle ur montern via ledaren`);
const stL = await D(L, 'D.stock()'), carryL = await D(L, 'D.carrying()');
ok(stL?.[0] === 1 && carryL?.pastry === null, `montern hos ledaren minskade EN gång (${stL?.[0]} kvar) – ledaren fick ingen bulle`);
const stG = await until(async () => ((await D(G, 'D.stock()')) || [])[0] === 1, 4000, 300);
ok(!!stG, `${gn}s monter visar samma (1 kvar)`);

// 4. medarbetaren gör en cappuccino och serverar gästen → får poängen
await D(G, 'D.makeDrink(1)');
await clickSpot(G, 'gast', g1?.spot ?? 0);
const servedG = await until(async () => { const s = await D(G, 'D.stats'); return s && s.ok >= 2 ? s : null; }, 12000, 300);
ok(!!servedG, `${gn} serverar dryck + bakverk och FÅR POÄNGEN (ok: ${servedG?.ok})`);
const lStats = await D(L, 'D.stats');
ok(lStats && lStats.ok === 0, `ledaren fick INTE poängen (${ln}: ok ${lStats?.ok})`);
const handsG = await D(G, 'D.carrying()');
ok(handsG && handsG.cup === null && handsG.pastry === null, `${gn}s händer är tomma efter serveringen`);
const custL = await until(async () => ((await D(L, 'D.customersDbg()')) || []).find((k) => k.i === g1?.id && k.gd && k.gp && k.st !== 'wait') || null, 6000, 300);
ok(!!custL, `gästen fick allt hos ledaren och är nöjd (${custL?.st}) – serveringen gällde i den delade världen`);
const lag1 = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.ok === 2 && g.ok === 2 ? { l, g } : null; }, 6000, 300);
ok(!!lag1, `lagets räkning är synkad (${lag1 ? lag1.g.ok : '?'} rätt hos båda – lönen delas lika)`);

// 5. samtidigt: det SISTA bakverket – bara en får det
await D(L, 'D.setStock(1, 1)');
await until(async () => ((await D(G, 'D.stock()')) || [])[1] === 1, 6000, 300);
await Promise.all([L, G].map((p) => p.evaluate(() => { const D2 = SF.scene._debug; D2.place(D2.spots.monter[1][0], 120, 'up'); })));
await Promise.all([L, G].map((p) => clickSpot(p, 'monter', 1)));
await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
await wait(600);
const pL = (await D(L, 'D.carrying()'))?.pastry, pG = (await D(G, 'D.carrying()'))?.pastry;
const st5 = await D(L, 'D.stock()');
ok((pL === 1) + (pG === 1) === 1 && st5?.[1] === 0, `båda sträcker sig efter den sista kladdkakan – bara EN får den (${ln}: ${pL}, ${gn}: ${pG}, kvar ${st5?.[1]})`);
const st5g = await until(async () => ((await D(G, 'D.stock()')) || [])[1] === 0, 4000, 300);
ok(!!st5g, 'montern är tom hos båda – ingen dubblett');

// 6. samtidigt: SAMMA gäst – bara en servering räknas
const g2 = await D(L, 'D.forceCustomer(0, -1)'); // espresso, inget bakverk
await until(async () => ((await D(G, 'D.customersDbg()')) || []).some((k) => k.i === g2?.id && k.st === 'wait'), 6000, 300);
const before6 = { lag: (await D(L, 'D.lag()')).ok, l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok };
await Promise.all([L, G].map((p) => p.evaluate((s) => { const D2 = SF.scene._debug; D2.makeDrink(0); D2.place(D2.spots.gast[s][0], 120, 'up'); }, g2?.spot ?? 0)));
await Promise.all([L, G].map((p) => clickSpot(p, 'gast', g2?.spot ?? 0)));
await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
await wait(1500);
const after6 = { lag: (await D(L, 'D.lag()')).ok, l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok };
const cups = [(await D(L, 'D.carrying()'))?.drink, (await D(G, 'D.carrying()'))?.drink];
ok(after6.lag === before6.lag + 1 && (after6.l - before6.l) + (after6.g - before6.g) === 1,
  `båda serverar samma espressogäst – EN poäng (lag ${before6.lag} → ${after6.lag}; ${ln} +${after6.l - before6.l}, ${gn} +${after6.g - before6.g})`);
ok(cups.filter((d) => d === 0).length === 1, `den som hann sist har kvar sin espresso (${ln}: ${cups[0]}, ${gn}: ${cups[1]})`);
const lag6 = await until(async () => ((await D(G, 'D.lag()')) || {}).ok === after6.lag, 4000, 300);
ok(!!lag6, `lagets räkning synkad efteråt (${after6.lag})`);

// 7. LEDARBYTE: ledaren lämnar – medarbetaren tar över inom sekunder, världen fortsätter
// och nya gäster krockar inte med gamla id:n
{
  const maxId = Math.max(g1?.id ?? -1, g2?.id ?? -1, ...((await D(G, 'D.customersDbg()')) || []).map((k) => k.i));
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 400);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const fresh = await until(async () => ((await D(G, 'D.customersDbg()')) || []).find((k) => k.i > maxId) || null, 10000, 300);
  ok(!!fresh, `världen fortsätter hos den nya ledaren – en ny gäst kommer in med NYTT id (${fresh?.i} > ${maxId})`);
  const forced = await D(G, 'D.forceCustomer()');
  const ids = ((await D(G, 'D.customersDbg()')) || []).map((k) => k.i);
  ok(!forced || (forced.id > maxId && new Set(ids).size === ids.length), `inga id-krockar (${ids.join(', ')})`);
}

// 8. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
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
