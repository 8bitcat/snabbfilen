// JOBBA TILLSAMMANS i Tvätteriet: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna kunder – och ensam går
// allt som förut, även med klick); Kalle bjuder in Julia via startdialogens 💼 Jobba ihop →
// 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra, exakt EN skiftledare, rubriken blir
// TVÄTTERIET IHOP; ledarens kunder (samma nummer, samma program) och påsar på disken syns hos
// medarbetaren, och en maskin ledaren startar går (och blir klar) hos medarbetaren också; det
// ledaren bär syns hos medarbetaren; medarbetaren tar en påse från disken (den försvinner hos
// ledaren, som vet att hen bär den), tvättar, torkar, viker (platsen på vikbordet är låst åt
// hen) och lämnar påsen till kunden – och det är MEDARBETAREN som får poängen; fel maskin ger
// medarbetaren felet; ett önskemål som kommer två gånger räknas en gång (en maskin lastas EN
// gång, en kund får sin påse EN gång); sträcker sig båda efter samma påse eller samma färdiga
// tvätt får bara en den (den andra ser HANN FÖRE!); lagets räkning är synkad; ledarbyte utan
// id-krockar – tvätten den gamla ledaren bar hamnar på vikbordet och kunden som var på väg in
// sätter sig; lönebeskedet delar lika.
// (Tvätteriet står inte i COOP_JOBS förrän det släpps – provet slår på det i båda sidorna.)
//   node tools/coop-tvatt-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8816)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tcoop' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: tvätteriet är öppet; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { tvatteri: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'tvatteri' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('tvatteri'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'tvatteri', 'jobbtvatt'); });
const all = (p) => D(p, 'D.all()');
const counter = (p) => D(p, 'D.counter()');
const table = (p) => D(p, 'D.table()');
const mach = (p) => D(p, 'D.machines()');
const hands = (p) => D(p, 'D.hands()');
const carrying = (p) => D(p, 'D.carrying()');
const idle = (p) => D(p, 'D.idle()');
const stats = (p) => D(p, 'D.stats');
const lag = (p) => D(p, 'D.lag()');
const act = (p, key, i, v) => D(p, `D.act(${JSON.stringify(key)}, ${i}${v === undefined ? '' : ', ' + v})`);
const hann = async (p) => ((await D(p, 'D.pops()')) || []).filter((s) => s === 'HANN FÖRE!').length;
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 150);
// den nyaste kunden (högst id) – forceCustomer ger numret, provet vill ha id:t
const newest = async (p) => ((await all(p)) || []).reduce((b, k) => (!b || k.id > b.id ? k : b), null);
const slotOf = async (p, id) => ((await counter(p)) || []).findIndex((s) => s && s.id === id);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia jobbar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbtvatt', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen i tvätteriet erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbtvatt' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i tvätteriet (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const kSoloA = await all(A), kSoloB = await all(B);
ok(kSoloA?.length === 0 && kSoloB?.length > 0, `egna tvätterier: Kalle tömmer sitt – Julias kunder är kvar (${kSoloA?.length}/${kSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'TVÄTTERIET' && (await D(B, 'D.title()')) === 'TVÄTTERIET', 'ensam heter passet bara TVÄTTERIET');
// ensam går allt som förut: hela kedjan (rätt maskin → poäng, fel maskin → fel + missfärgat) …
await D(A, 'D.forceRight()');
await D(A, 'D.forceWrong()');
const sSolo = await stats(A);
ok(sSolo?.ok === 1 && sSolo?.fel === 1 && sSolo?.missfargat === 1, `ensam: rätt påse ger poäng, fel maskin ger fel och missfärgat (ok ${sSolo?.ok}, fel ${sSolo?.fel}, missfärgat ${sSolo?.missfargat})`);
// … och med riktiga klick: påsen på disken → VITT-maskinen
{
  await D(A, 'D.forceCustomer(0)');
  const k = await newest(A), si = await slotOf(A, k?.id);
  const sx = [33, 55, 77][si];
  await A.evaluate(([x]) => SF.scene.down(x, 80), [sx]);
  const held = await until(async () => { const c = await carrying(A); return (await idle(A)) && c && c.kind === 'bag' && c.id === k.id ? c : null; }, 8000, 150);
  await A.evaluate(() => SF.scene.down(110, 80));   // tvättmaskin 1 (VITT)
  const run = await until(async () => { const m = await mach(A); return (await idle(A)) && m?.washers[0].state === 'run' && m.washers[0].id === k.id ? 1 : null; }, 8000, 150);
  ok(!!held && !!run && (await carrying(A)) === null, `ensam med klick: påsen från disken in i VITT-maskinen (nr ${k?.num})`);
}
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
await A.waitForFunction(() => SF.sceneName === 'jobbtvatt' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Tvätteriet/.test(inv1 || ''), `Julia får inbjudan till tvätteriet (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbtvatt' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i tvätteriet (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'TVÄTTERIET IHOP' && (await D(G, 'D.title()')) === 'TVÄTTERIET IHOP', 'rubriken är TVÄTTERIET IHOP hos båda');

// provlugn hos ledaren: inga kunder, tomma maskiner
await D(L, 'D.calm()');
const empty = await until(async () => { const k = await all(G), c = await counter(G); return k && c && k.length === 0 && c.every((s) => !s) ? 1 : null; }, 6000, 300);
ok(!!empty, `${gn} ser att bänken och disken töms hos ledaren`);

// 2. ledarens kunder och påsar syns hos medarbetaren – samma nummer, samma program
await D(L, 'D.forceCustomer(0)');
const kA = await newest(L);
await D(L, 'D.forceCustomer(1)');
const kB = await newest(L);
const seesK = await until(async () => {
  const k = await all(G), c = await counter(G); if (!k || !c) return null;
  const a = k.find((x) => x.id === kA.id), b = k.find((x) => x.id === kB.id);
  return a && b && a.num === kA.num && a.cls === 0 && a.state === 'sit' && b.num === kB.num && b.cls === 1
    && c.some((s) => s && s.id === kA.id && s.kind === 'bag') && c.some((s) => s && s.id === kB.id) ? 1 : null;
}, 6000, 250);
ok(!!seesK, `${gn} ser ledarens kunder på bänken och deras påsar på disken (nr ${kA?.num} VITT, nr ${kB?.num} KULÖRT)`);

// 3. ledaren tar påsen och startar en maskin – medarbetaren ser vad ledaren bär och ser maskinen gå
{
  await act(L, 'disk', await slotOf(L, kB.id));
  const seesHeld = await until(async () => ((await hands(G)) || []).find((h) => h.id === lId && h.kind === 'bag' && h.oid === kB.id) || null, 5000, 200);
  ok(!!seesHeld && (await slotOf(G, kB.id)) < 0, `${gn} ser att ${ln} bär påsen nr ${kB.num} (den är borta från disken)`);
  await wait(700);   // (figuren glider fram till disken hos medarbetaren)
  await snap(G, 'tvatt-ihop-kollegan-bar-pasen');
  await act(L, 'tvatt', 2);   // tvättmaskin 3 = KULÖRT
  const run1 = await until(async () => { const m = await mach(G); return m && m.washers[2].state === 'run' && m.washers[2].id === kB.id ? m.washers[2] : null; }, 5000, 150);
  await wait(600);
  const run2 = (await mach(G))?.washers[2], runL = (await mach(L))?.washers[2];
  ok(!!run1 && run2 && run2.tt > run1.tt && Math.abs(run2.tt - runL.tt) < 1, `${gn} ser KULÖRT-maskinen tvätta nr ${kB.num} – tiden går hos båda (${run1?.tt} → ${run2?.tt}, ledaren ${runL?.tt})`);
  const klar = await until(async () => { const m = await mach(G); return m && m.washers[2].state === 'done' ? 1 : null; }, 9000, 250);
  ok(!!klar, `maskinen blir KLAR hos ${gn} också`);
}

// 4. medarbetarens handlingar ändrar ledarens värld – hela kedjan – och MEDARBETAREN får poängen
{
  await act(G, 'disk', await slotOf(G, kA.id));
  const held = await until(async () => { const c = await carrying(G); return c && c.kind === 'bag' && c.id === kA.id ? c : null; }, 6000, 200);
  ok(!!held, `${gn} tar påsen nr ${kA.num} från disken via ledaren`);
  const hL = await until(async () => ((await hands(L)) || []).find((h) => h.id === gId && h.oid === kA.id && h.kind === 'bag') || null, 3000, 150);
  ok(!!hL && (await slotOf(L, kA.id)) < 0, `påsen är borta från disken hos ledaren – ledaren vet att ${gn} bär den`);
  await bothIdle(L, G);
  await act(G, 'tvatt', 0);
  const w0 = await until(async () => { const m = await mach(L); return m && m.washers[0].state === 'run' && m.washers[0].id === kA.id ? 1 : null; }, 6000, 200);
  ok(!!w0 && (await until(async () => (await carrying(G)) === null, 3000, 150)), `${gn} lastar VITT-maskinen – den tvättar nr ${kA.num} hos ledaren`);
  await D(L, 'D.finishAll()');
  await until(async () => (await mach(G))?.washers[0].state === 'done', 4000, 150);
  await bothIdle(L, G);
  await act(G, 'tvatt', 0);
  const wet = await until(async () => { const c = await carrying(G); return c && c.kind === 'wet' ? c : null; }, 6000, 200);
  await bothIdle(L, G);
  await act(G, 'tork', 0);
  const d0 = await until(async () => { const m = await mach(L); return m && m.dryers[0].state === 'run' && m.dryers[0].id === kA.id ? 1 : null; }, 6000, 200);
  ok(!!wet && !!d0, `${gn} tömmer maskinen och lägger den blöta tvätten i torktumlaren hos ledaren`);
  await D(L, 'D.finishAll()');
  await until(async () => (await mach(G))?.dryers[0].state === 'done', 4000, 150);
  await bothIdle(L, G);
  await act(G, 'tork', 0);
  const dry = await until(async () => { const c = await carrying(G); return c && c.kind === 'dry' ? c : null; }, 6000, 200);
  await bothIdle(L, G);
  await act(G, 'bord', 1);
  const fold = await until(async () => (await D(G, 'D.folding()')) || null, 5000, 100);
  const lock = await until(async () => { const tb = await table(L); return tb && tb[1].fb === gId && tb[1].fo === kA.id ? 1 : null; }, 3000, 100);
  ok(!!dry && !!fold && !!lock, `${gn} viker på vikbordet – platsen är låst åt ${gn} hos ledaren`);
  await snap(G, 'tvatt-ihop-medarbetaren-viker');
  await snap(L, 'tvatt-ihop-ledaren-ser-vikningen');
  const folded = await until(async () => { const c = await carrying(G); return c && c.kind === 'folded' && c.id === kA.id ? c : null; }, 6000, 150);
  const unlocked = await until(async () => { const tb = await table(L); return tb && tb[1].fb === null ? 1 : null; }, 3000, 150);
  ok(!!folded && !!unlocked, `påsen är knuten – ${gn} bär den vikta påsen och platsen är ledig igen`);
  await bothIdle(L, G);
  const before = { l: (await stats(L)).ok, g: (await stats(G)).ok, lag: (await lag(L)).ok };
  await D(G, `D.deliver(${kA.id})`);
  const sG = await until(async () => { const s = await stats(G); return s && s.ok === before.g + 1 ? s : null; }, 6000, 200);
  ok(!!sG, `${gn} lämnar påsen till kund nr ${kA.num} och FÅR POÄNGEN (ok ${sG?.ok})`);
  const kL = ((await all(L)) || []).find((k) => k.id === kA.id);
  ok((!kL || (kL.state === 'leave' && kL.got)) && (await stats(L)).ok === before.l, `kunden går nöjd hos ledaren (${kL?.state ?? 'gått'}) – ledaren fick INTE poängen`);
  const lag4 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === before.lag + 1 && g.ok === before.lag + 1 ? l : null; }, 5000, 250);
  ok(!!lag4, `lagets räkning är synkad (${lag4?.ok ?? '?'} rätt hos båda)`);
}

// 5. fel maskin: felet är medarbetarens (och lagets)
let kE = null;
{
  await D(L, 'D.forceCustomer(1)');
  kE = await newest(L);
  await until(async () => (await slotOf(G, kE.id)) >= 0, 5000, 200);
  const before = { l: (await stats(L)).fel, g: (await stats(G)).fel, lag: (await lag(L)).fel };
  await act(G, 'disk', await slotOf(G, kE.id));
  await until(async () => (await carrying(G))?.id === kE.id, 6000, 200);
  await bothIdle(L, G);
  await act(G, 'tvatt', 5);   // MÖRKT – fel för en KULÖRT-påse
  const sF = await until(async () => { const s = await stats(G); return s && s.fel === before.g + 1 ? s : null; }, 6000, 200);
  const lagF = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.fel === before.lag + 1 && g.fel === before.lag + 1 ? l : null; }, 5000, 250);
  ok(!!sF && !!lagF && (await stats(L)).fel === before.l, `fel maskin: ${gn} får felet (fel ${sF?.fel}), laget också – inte ledaren`);
}

// 6. ett önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  await bothIdle(L, G);
  await D(L, 'D.forceCustomer(2)');
  const kC = await newest(L);
  await until(async () => (await slotOf(G, kC.id)) >= 0, 5000, 200);
  await act(G, 'disk', await slotOf(G, kC.id));
  await until(async () => (await carrying(G))?.id === kC.id, 6000, 200);
  await bothIdle(L, G);
  const fel0 = (await lag(L)).fel;
  const sent = await D(G, "D.twice('tvatt', 4)");   // tvättmaskin 5 = MÖRKT
  await bothIdle(L, G);
  await wait(800);
  const m = await mach(L);
  const inMach = [...m.washers, ...m.dryers].filter((x) => x.id === kC.id).length;
  const heldL = ((await hands(L)) || []).filter((h) => h.oid === kC.id).length;
  ok(sent && inMach === 1 && m.washers[4].id === kC.id && heldL === 0 && (await carrying(G)) === null && (await lag(L)).fel === fel0,
    `samma "lasta maskinen" två gånger: tvätten nr ${kC.num} finns i EN maskin, ingen bär en kopia`);
  // … och samma "lämna påsen" två gånger: EN påse, EN poäng
  await D(L, 'D.finishAll()');
  await until(async () => (await mach(G))?.washers[4].state === 'done', 4000, 150);
  await act(G, 'tvatt', 4);
  await until(async () => (await carrying(G))?.kind === 'wet', 6000, 200);
  await bothIdle(L, G);
  await act(G, 'tork', 1);
  await until(async () => (await mach(L))?.dryers[1].id === kC.id, 6000, 200);
  await D(L, 'D.finishAll()');
  await until(async () => (await mach(G))?.dryers[1].state === 'done', 4000, 150);
  await bothIdle(L, G);
  await act(G, 'tork', 1);
  await until(async () => (await carrying(G))?.kind === 'dry', 6000, 200);
  await bothIdle(L, G);
  await act(G, 'bord', 0);
  await until(async () => (await carrying(G))?.kind === 'folded', 8000, 150);
  await bothIdle(L, G);
  const before = { lag: (await lag(L)).ok, g: (await stats(G)).ok };
  const sent2 = await D(G, `D.twice('kund', ${kC.id})`);
  await bothIdle(L, G);
  await wait(1000);
  const after = { lag: (await lag(L)).ok, g: (await stats(G)).ok };
  ok(sent2 && after.lag === before.lag + 1 && after.g === before.g + 1 && (await carrying(G)) === null,
    `samma "lämna påsen" två gånger: EN påse, EN poäng (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g})`);
}

// 7. samtidigt: SAMMA påse på disken – bara en får den, den andra ser HANN FÖRE!
let kD = null;
{
  await D(L, 'D.forceCustomer(0)');
  kD = await newest(L);
  await until(async () => (await slotOf(G, kD.id)) >= 0, 5000, 200);
  const si = await slotOf(L, kD.id);
  const vL = await D(L, `D.sig('disk', ${si})`), vG = await D(G, `D.sig('disk', ${si})`);
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([act(L, 'disk', si, vL), act(G, 'disk', si, vG)]);
  await bothIdle(L, G);
  await wait(800);
  const cL = await carrying(L), cG = await carrying(G);
  const wins = (cL?.id === kD.id ? 1 : 0) + (cG?.id === kD.id ? 1 : 0);
  const heldL = ((await hands(L)) || []).filter((h) => h.oid === kD.id);
  ok(wins === 1 && vL === vG && (cL?.id === kD.id ? heldL.length === 0 : heldL.length === 1 && heldL[0].id === gId), `båda tar påsen nr ${kD.num} – bara EN får den (${ln}: ${cL ? cL.kind + ' ' + cL.num : '-'}, ${gn}: ${cG ? cG.kind + ' ' + cG.num : '-'})`);
  const winner = cL?.id === kD.id ? L : G, loser = winner === L ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  // påsen tillbaka på disken
  await act(winner, 'disk', si);
  const back = await until(async () => (await slotOf(L, kD.id)) === si && (await slotOf(G, kD.id)) === si ? 1 : null, 5000, 200);
  ok(!!back && (await carrying(L)) === null && (await carrying(G)) === null, 'påsen ligger på disken igen hos båda, händerna är tomma');
}

// 8. samtidigt: SAMMA färdiga tvätt i en maskin – bara en får ta ur den
{
  await bothIdle(L, G);
  await act(L, 'disk', await slotOf(L, kD.id));
  await act(L, 'tvatt', 1);
  await D(L, 'D.finishAll()');
  await until(async () => { const m = await mach(G); return m && m.washers[1].state === 'done' && m.washers[1].id === kD.id ? 1 : null; }, 5000, 150);
  const vL = await D(L, "D.sig('tvatt', 1)"), vG = await D(G, "D.sig('tvatt', 1)");
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([act(L, 'tvatt', 1, vL), act(G, 'tvatt', 1, vG)]);
  await bothIdle(L, G);
  await wait(800);
  const cL = await carrying(L), cG = await carrying(G);
  const wins = (cL?.kind === 'wet' ? 1 : 0) + (cG?.kind === 'wet' ? 1 : 0);
  ok(wins === 1 && (await mach(L)).washers[1].state === 'idle', `båda tömmer maskin 2 – bara EN får den blöta tvätten (${ln}: ${cL?.kind ?? '-'}, ${gn}: ${cG?.kind ?? '-'})`);
  const winner = cL?.kind === 'wet' ? L : G, loser = winner === L ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  // korgen på vikbordet – och ledaren tar den (den ska ledaren bära när hen går)
  await act(winner, 'bord', 2);
  await until(async () => (await table(L))?.[2].item?.id === kD.id, 5000, 200);
  await bothIdle(L, G);
  await act(L, 'bord', 2);
  const lHeld = await until(async () => { const c = await carrying(L); return c && c.kind === 'wet' && c.id === kD.id ? c : null; }, 5000, 200);
  ok(!!lHeld, `${ln} bär den blöta korgen nr ${kD.num}`);
}

// 9. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade hos båda`);
}

// 10. LEDARBYTE: ledaren (med den blöta korgen i händerna) går – medarbetaren tar över inom
// sekunder, korgen hamnar på vikbordet, kunden som är på väg in sätter sig och nya kunder
// krockar inte med gamla id:n
{
  await until(async () => ((await hands(G)) || []).some((h) => h.id === lId && h.oid === kD.id && h.kind === 'wet'), 5000, 200);
  const kW = await D(L, 'D.walkIn(1)');
  const walking = await until(async () => ((await all(G)) || []).find((k) => k.id === kW && k.state === 'walk') || null, 5000, 150);
  ok(!!walking, `${gn} ser kunden id ${kW} gå in genom dörren`);
  await wait(1500);
  const seenIds = ((await all(G)) || []).map((k) => k.id);
  const maxId = Math.max(kA.id, kB.id, kE.id, kD.id, kW, ...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const onTable = await until(async () => ((await table(G)) || []).find((s) => s.item && s.item.id === kD.id && s.item.kind === 'wet') || null, 8000, 250);
  ok(!!onTable, `den blöta korgen nr ${kD.num} som ${ln} bar ligger på vikbordet – ingen tvätt försvann`);
  const sat = await until(async () => { const k = ((await all(G)) || []).find((x) => x.id === kW); return k && k.state === 'sit' && k.dropped && (await slotOf(G, kW)) >= 0 ? k : null; }, 15000, 300);
  ok(!!sat, `kunden som var på väg in lämnar påsen på disken och sätter sig hos den nya ledaren (id ${kW})`);
  await D(G, 'D.forceCustomer(2)');
  const ids = ((await all(G)) || []).map((k) => k.id), fresh = ids.filter((id) => !seenIds.includes(id) && id !== kW);
  ok(fresh.length > 0 && fresh.every((id) => id > maxId) && new Set(ids).size === ids.length, `inga id-krockar (kunderna ${ids.join(', ')}; de nya > ${maxId})`);
  // den nya ledaren jobbar själv – poängen räknas
  const before = { g: (await stats(G)).ok, lag: (await lag(G)).ok };
  await D(G, 'D.forceRight()');
  const after = { g: (await stats(G)).ok, lag: (await lag(G)).ok };
  ok(after.g === before.g + 1 && after.lag === before.lag + 1, `${gn} lämnar en påse själv som ledare – poängen räknas (ok ${before.g} → ${after.g}, laget ${before.lag} → ${after.lag})`);
}

// 11. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
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
