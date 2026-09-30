// JOBBA TILLSAMMANS på Macken: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna bilar); Kalle bjuder in
// Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser
// varandra, exakt EN skiftledare, rubriken blir BENSINMACKEN IHOP; ledarens bilar (samma bil,
// samma önskan, vid samma ö) och kioskkunder syns hos medarbetaren, och en bil som kör in rullar
// hos medarbetaren också; medarbetaren tar munstycket (det hänger inte längre i pumpen hos
// ledaren), tankar bilen (ledaren ser mätaren gå) och släpper i gröna zonen – och det är
// MEDARBETAREN som får poängen; tvättar rutan med rakan; kopplar in och drar ur laddkabeln;
// räcker över en vara till ledarens kund; ett önskemål som kommer två gånger räknas en gång;
// sträcker sig båda efter samma kund eller samma munstycke får bara en det (den andra ser HANN
// FÖRE!); lagets räkning är synkad; ledarbyte utan id-krockar – bilen som kör in rullar vidare och
// munstycket den gamla ledaren höll hänger i pumpen igen; lönebeskedet delar lika.
// (Macken står inte i COOP_JOBS förrän den släpps – provet slår på den i båda sidorna.)
//   node tools/coop-bensin-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8815)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'bcoop' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: macken är öppen; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { bensinmack: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'bensinmack' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('bensinmack'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'bensinmack', 'jobbbensin'); });
const cars = (p) => D(p, 'D.cars()');
const custs = (p) => D(p, 'D.customers()');
const isl = (p) => D(p, 'D.islands()');
const idle = (p) => D(p, 'D.idle()');
const stats = (p) => D(p, 'D.stats');
const lag = (p) => D(p, 'D.lag()');
const hann = async (p) => ((await D(p, 'D.pops()')) || []).filter((s) => s === 'HANN FÖRE!').length;
const carAt = async (p, i) => ((await cars(p)) || []).find((c) => c.isl === i && c.state !== 'out') || null;

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia jobbar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbbensin', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på macken erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbbensin' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra på macken (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const cSoloA = await cars(A), cSoloB = await cars(B);
ok(cSoloA?.length === 0 && cSoloB?.length > 0, `egna gårdar: Kalle tömmer sin – Julias bilar står kvar (${cSoloA?.length}/${cSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'BENSINMACKEN' && (await D(B, 'D.title()')) === 'BENSINMACKEN', 'ensam heter passet bara BENSINMACKEN');
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
await A.waitForFunction(() => SF.sceneName === 'jobbbensin' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Pixelmacken/.test(inv1 || ''), `Julia får inbjudan till macken (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbbensin' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra på macken (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'BENSINMACKEN IHOP' && (await D(G, 'D.title()')) === 'BENSINMACKEN IHOP', 'rubriken är BENSINMACKEN IHOP hos båda');

// provlugn hos ledaren: inga bilar, ingen vid disken
await D(L, 'D.calm()');
const empty = await until(async () => { const c = await cars(G), k = await custs(G); return c && k && c.length === 0 && k.length === 0 ? 1 : null; }, 6000, 300);
ok(!!empty, `${gn} ser att gården och disken töms hos ledaren`);

// 2. ledarens bilar och kunder syns hos medarbetaren – samma bil, samma önskan, samma ö
await D(L, "D.forceCar('95', true, 0)");
await D(L, "D.forceCar('EL', false, 1)");
await D(L, "D.forceCustomer('kaffe')");
const car0 = await carAt(L, 0), car1 = await carAt(L, 1);
const seesCars = await until(async () => {
  const c = await cars(G); if (!c) return null;
  const a = c.find((x) => x.id === car0.id), b = c.find((x) => x.id === car1.id);
  return a && b && a.isl === 0 && a.fuel === '95' && a.wash && a.kind === car0.kind && a.state === 'wait' && b.isl === 1 && b.fuel === 'EL' && b.state === 'wait' ? c : null;
}, 6000, 250);
ok(!!seesCars, `${gn} ser ledarens bilar vid pumparna (id ${car0?.id}: ${car0?.kind} vill ha 95 + tvätt vid ö 1, id ${car1?.id}: elbil vid ö 2)`);
const kund0 = ((await custs(L)) || []).find((k) => k.wish === 'kaffe');
const seesCust = await until(async () => ((await custs(G)) || []).find((k) => k.id === kund0?.id && k.wish === 'kaffe' && k.state === 'wait') || null, 6000, 250);
ok(!!seesCust, `${gn} ser ledarens kund vid kioskdisken (vill ha kaffe)`);

// 3. en bil som kör in rullar hos medarbetaren också – och står där den står hos ledaren
{
  const id = await D(L, "D.driveIn('D', 2)");
  const g1 = await until(async () => ((await cars(G)) || []).find((c) => c.id === id && c.state === 'in') || null, 4000, 100);
  const [cl, cg] = await Promise.all([cars(L), cars(G)]);
  const xl = cl?.find((c) => c.id === id)?.x, xg = cg?.find((c) => c.id === id)?.x;
  await wait(400);
  const g2 = ((await cars(G)) || []).find((c) => c.id === id);
  ok(!!g1 && g2 && (g2.x < g1.x - 5 || g2.y < g1.y - 5), `${gn} ser bilen köra in (x ${g1?.x} → ${g2?.x}, y ${g1?.y} → ${g2?.y})`);
  ok(xl !== undefined && xg !== undefined && Math.abs(xl - xg) <= 30, `bilen är på samma ställe hos båda medan den kör (${xl} / ${xg})`);
  const parked = await until(async () => { const a = ((await cars(L)) || []).find((c) => c.id === id), b = ((await cars(G)) || []).find((c) => c.id === id); return a && b && a.state === 'wait' && b.state === 'wait' && Math.abs(a.x - b.x) <= 1 ? b : null; }, 8000, 250);
  ok(!!parked, `bilen parkerar vid ö 3 hos båda (x ${parked?.x})`);
}

// 4. medarbetarens handling ändrar ledarens värld: tar 95-munstycket och tankar bilen
{
  const okL0 = (await stats(L)).ok;
  await D(G, "D.take(0, 'noz', 0)");
  const held = await until(async () => (await D(G, 'D.carrying()')) === '95', 6000, 200);
  ok(!!held, `${gn} tar 95-munstycket vid ö 1 via ledaren`);
  const iL = await isl(L);
  ok(iL?.[0]?.noz?.[0] === gId, `munstycket hänger inte i pumpen hos ledaren – ${gn} håller i det`);
  await D(G, `D.carAct(${car0.id})`);
  const fueling = await until(async () => (await D(G, 'D.busy()')) === 'fuel' ? 1 : null, 6000, 150);
  ok(!!fueling, `${gn} tankar bilen (mätaren går hos ${gn})`);
  const f1 = ((await cars(L)) || []).find((c) => c.id === car0.id);
  await wait(500);
  const f2 = ((await cars(L)) || []).find((c) => c.id === car0.id);
  ok(f1?.tk === gId && f2 && f2.fill > f1.fill, `ledaren ser att ${gn} tankar – mätaren går där också (${f1?.fill.toFixed(2)} → ${f2?.fill.toFixed(2)})`);
  await D(G, 'D.release(0.95)');
  const sG = await until(async () => { const s = await stats(G); return s && s.ok === 1 ? s : null; }, 6000, 200);
  ok(!!sG, `${gn} släpper i gröna zonen och FÅR POÄNGEN (ok ${sG?.ok})`);
  const cL = ((await cars(L)) || []).find((c) => c.id === car0.id);
  ok(cL?.fuelDone && (await stats(L)).ok === okL0, `bilen är full hos ledaren – och ledaren fick INTE poängen (${ln}: ok ${(await stats(L)).ok})`);
  const back = await until(async () => { const a = await isl(L), b = await isl(G); return a?.[0]?.noz?.[0] === 1 && b?.[0]?.noz?.[0] === 1 ? 1 : null; }, 4000, 200);
  ok(!!back && (await D(G, 'D.carrying()')) === null, `munstycket hänger i pumpen igen hos båda, ${gn}s händer är tomma`);
  const lag4 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === 1 && g.ok === 1 ? l : null; }, 5000, 250);
  ok(!!lag4, `lagets räkning är synkad (${lag4?.ok ?? '?'} rätt hos båda)`);

  // ... tvättar rutan med rakan → poängen är hens, bilen betalar och kör
  await D(G, "D.take(0, 'raka')");
  await until(async () => (await D(G, 'D.carrying()')) === 'raka', 6000, 200);
  await D(G, `D.carAct(${car0.id})`);
  const washing = await until(async () => (await D(G, 'D.busy()')) === 'wash' ? 1 : null, 6000, 150);
  const tvL = ((await cars(L)) || []).find((c) => c.id === car0.id)?.tv;
  ok(!!washing && tvL === gId, `${gn} tvättar rutan – ledaren ser vem som tvättar`);
  const sW = await until(async () => { const s = await stats(G); return s && s.ok === 2 ? s : null; }, 6000, 200);
  ok(!!sW, `rutan är blank – ${gn} får poängen (ok ${sW?.ok})`);
  const gone = await until(async () => { const c = ((await cars(L)) || []).find((x) => x.id === car0.id); return !c || c.state === 'pay' || c.state === 'out' ? 1 : null; }, 5000, 200);
  ok(!!gone && (await stats(L)).ok === okL0, `bilen betalar och kör hos ledaren (${ln} fick inga poäng för den)`);
  const rakaBack = await until(async () => (await isl(L))?.[0]?.raka === 1 ? 1 : null, 4000, 200);
  ok(!!rakaBack, 'rakan står i hinken igen hos ledaren');
}

// 5. laddkabeln: medarbetaren kopplar in elbilen och drar ur den när den är klar
{
  const ok0 = (await stats(G)).ok;
  await D(G, "D.take(1, 'kabel')");
  await until(async () => (await D(G, 'D.carrying()')) === 'kabel', 6000, 200);
  await D(G, `D.carAct(${car1.id})`);
  const plugged = await until(async () => { const c = ((await cars(L)) || []).find((x) => x.id === car1.id), i = await isl(L); return c && c.plug === 1 && i?.[1]?.cable === 0 ? c : null; }, 6000, 200);
  ok(!!plugged, `${gn} kopplar in elbilen – kabeln sitter i bilen hos ledaren`);
  const charged = await until(async () => { const a = ((await cars(L)) || []).find((x) => x.id === car1.id), b = ((await cars(G)) || []).find((x) => x.id === car1.id); return a && b && a.charge >= 1 && b.charge >= 1 ? 1 : null; }, 9000, 250);
  ok(!!charged, 'elbilen laddar klart – hos båda');
  await D(G, `D.carAct(${car1.id})`);
  const sE = await until(async () => { const s = await stats(G); return s && s.ok === ok0 + 1 ? s : null; }, 6000, 200);
  const cE = ((await cars(L)) || []).find((x) => x.id === car1.id);
  ok(!!sE && (!cE || cE.fuelDone) && (await isl(L))?.[1]?.cable === 1, `${gn} drar ur kabeln och får poängen (ok ${sE?.ok}) – kabeln hänger på stolpen igen`);
}

// 6. kiosken: medarbetaren räcker över en vara till ledarens kund
{
  await D(L, "D.forceCustomer('tidning')");
  const k = ((await custs(L)) || []).filter((q) => q.wish === 'tidning' && q.state === 'wait').pop();
  await until(async () => ((await custs(G)) || []).some((q) => q.id === k?.id), 5000, 200);
  const before = { l: (await stats(L)).ok, g: await stats(G), lag: (await lag(L)).ok };
  await D(G, "D.pickItem('tidning')");
  await D(G, `D.custAct(${k?.id})`);
  const sK = await until(async () => { const s = await stats(G); return s && s.kiosk === before.g.kiosk + 1 ? s : null; }, 6000, 200);
  ok(!!sK && sK.ok === before.g.ok + 1, `${gn} räcker över tidningen och FÅR POÄNGEN (ok ${sK?.ok}, kiosk ${sK?.kiosk})`);
  const kL = ((await custs(L)) || []).find((q) => q.id === k?.id);
  ok((!kL || (kL.state === 'out' && kL.got === 'tidning')) && (await stats(L)).ok === before.l, `kunden går nöjd hos ledaren (${kL?.state ?? 'gått'}) – ledaren fick inte poängen`);
  const lag6 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === before.lag + 1 && g.ok === before.lag + 1 ? l : null; }, 5000, 250);
  ok(!!lag6, `lagets räkning synkad (${lag6?.ok ?? '?'} rätt hos båda)`);
}

// 7. ett önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  await D(L, "D.forceCustomer('korv')");
  const k = ((await custs(L)) || []).filter((q) => q.wish === 'korv' && q.state === 'wait').pop();
  await until(async () => ((await custs(G)) || []).some((q) => q.id === k?.id), 5000, 200);
  const before = { lag: (await lag(L)).ok, g: (await stats(G)).ok };
  await D(G, "D.pickItem('korv')");
  const sent = await D(G, `D.twice('kund', ${k?.id})`);
  await until(async () => await idle(G), 6000, 250);
  await wait(1200);
  const after = { lag: (await lag(L)).ok, g: (await stats(G)).ok };
  ok(sent && after.lag === before.lag + 1 && after.g === before.g + 1, `samma önskemål två gånger: EN korv, EN poäng (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g})`);
}

// 8. samtidigt: SAMMA kund – bara en får servera, den andra ser HANN FÖRE!
{
  await D(L, "D.forceCustomer('kaffe')");
  const k = ((await custs(L)) || []).filter((q) => q.wish === 'kaffe' && q.state === 'wait').pop();
  await until(async () => ((await custs(G)) || []).some((q) => q.id === k?.id), 5000, 200);
  const h0 = [await hann(L), await hann(G)], s0 = [(await stats(L)).ok, (await stats(G)).ok], lag0 = (await lag(L)).ok;
  await Promise.all([L, G].map((p) => D(p, "D.pickItem('kaffe')")));
  await Promise.all([L, G].map((p) => D(p, `D.custAct(${k?.id})`)));
  await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
  await wait(800);
  const s1 = [(await stats(L)).ok, (await stats(G)).ok], lag1 = (await lag(L)).ok;
  const dl = s1[0] - s0[0], dg = s1[1] - s0[1];
  ok(dl + dg === 1 && lag1 === lag0 + 1, `båda räcker kaffe till samma kund – bara EN får poängen (${ln} +${dl}, ${gn} +${dg}, laget +${lag1 - lag0})`);
  const loser = dl === 1 ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  await D(L, 'D.drop()');
  await D(G, 'D.drop()');
}

// 9. samtidigt: SAMMA munstycke – bara en får det
{
  await until(async () => { const a = await isl(L), b = await isl(G); return a?.[2]?.noz?.[1] === 1 && b?.[2]?.noz?.[1] === 1 ? 1 : null; }, 4000, 200);
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([L, G].map((p) => D(p, "D.take(2, 'noz', 1)")));
  await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
  await wait(800);
  const cL = await D(L, 'D.carrying()'), cG = await D(G, 'D.carrying()');
  const holder = (await isl(L))?.[2]?.noz?.[1];
  ok(((cL === '98') + (cG === '98')) === 1 && holder === (cL === '98' ? lId : gId), `båda tar 98-munstycket vid ö 3 – bara EN får det (${ln}: ${cL ?? '-'}, ${gn}: ${cG ?? '-'})`);
  const loser = cL === '98' ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  await D(L, 'D.drop()');
  await D(G, 'D.drop()');
  const back = await until(async () => { const a = await isl(L), b = await isl(G); return a?.[2]?.noz?.[1] === 1 && b?.[2]?.noz?.[1] === 1 ? 1 : null; }, 4000, 200);
  ok(!!back, 'munstycket hänger i pumpen igen hos båda');
}

// 10. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade hos båda`);
}

// 11. LEDARBYTE: ledaren (med dieselmunstycket i handen) lämnar – medarbetaren tar över inom
// sekunder, bilen som kör in rullar vidare, munstycket hänger i pumpen igen och nya bilar/kunder
// krockar inte med gamla id:n
{
  await D(L, "D.take(1, 'noz', 2)");
  await until(async () => (await isl(G))?.[1]?.noz?.[2] === lId, 5000, 200);
  const kept = await D(L, "D.driveIn('95', 0)");
  await until(async () => ((await cars(G)) || []).some((c) => c.id === kept), 5000, 150);
  const seenIds = [...((await cars(G)) || []).map((c) => c.id), ...((await custs(G)) || []).map((k) => k.id)];
  const maxId = Math.max(car0.id, car1.id, kept, ...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const parked = await until(async () => { const c = ((await cars(G)) || []).find((x) => x.id === kept); return c && c.state === 'wait' && c.x === 196 ? c : null; }, 10000, 250);
  ok(!!parked, `bilen som körde in rullar vidare och parkerar vid ö 1 hos den nya ledaren (id ${kept})`);
  const nozBack = await until(async () => (await isl(G))?.[1]?.noz?.[2] === 1, 6000, 250);
  ok(!!nozBack, `dieselmunstycket ${ln} höll i hänger i pumpen igen`);
  await D(G, "D.forceCar('D', false, 2)");
  await D(G, "D.forceCustomer('korv')");
  const fresh = await carAt(G, 2);
  const cIds = ((await cars(G)) || []).map((c) => c.id), kIds = ((await custs(G)) || []).map((k) => k.id), ids = [...cIds, ...kIds];
  const newest = Math.max(...kIds);
  ok(fresh && fresh.id > maxId && newest > maxId && new Set(ids).size === ids.length, `inga id-krockar (bilarna ${cIds.join(', ')}; kunderna ${kIds.join(', ')}; de nya > ${maxId})`);
  // den nya ledaren tankar själv
  const before = { g: (await stats(G)).ok, lag: (await lag(G)).ok };
  await D(G, "D.take(2, 'noz', 2)");
  await D(G, `D.carAct(${fresh?.id})`);
  await D(G, 'D.release(0.95)');
  const after = { g: (await stats(G)).ok, lag: (await lag(G)).ok };
  ok(after.g === before.g + 1 && after.lag === before.lag + 1, `${gn} tankar själv som ledare – poängen räknas (ok ${before.g} → ${after.g}, laget ${before.lag} → ${after.lag})`);
}

// 12. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
{
  const lg = await lag(G);
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lg.ok} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lg.ok} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
  const rows = await G.evaluate(() => [...document.querySelectorAll('#modal div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()));
  const ratt = +(((rows.find((r) => /^✅ Rätt/.test(r)) || '').match(/^✅ Rätt\s*(\d+)/) || [])[1] ?? -1);
  const fel = +(((rows.find((r) => /^❌ Fel/.test(r)) || '').match(/^❌ Fel\s*(\d+)/) || [])[1] ?? -1);
  ok(ratt === Math.round(lg.ok / 2) && fel === Math.round(lg.fel / 2), `rätt- och fel-raderna är halva lagets (${ratt} av ${lg.ok}, ${fel} av ${lg.fel})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
