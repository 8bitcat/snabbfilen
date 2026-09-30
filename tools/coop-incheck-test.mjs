// JOBBA TILLSAMMANS i Incheckningen: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna köer – och ensam går allt som
// förut: pass, vikt, plats, lapp, band, kort); Kalle bjuder in Julia via startdialogens 💼 Jobba ihop →
// 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra, exakt EN skiftledare, rubriken blir
// INCHECKNINGEN IHOP, Julia börjar vid lappskrivaren; ledarens kö (samma resenärer, samma ordning och
// plats) syns hos medarbetaren; medarbetaren trycker GODKÄNN – hos ledaren är resenären då LÅST åt hen
// (ledarens VIKT-knapp säger KOLLEGANS RESENÄR); medarbetaren väger, ledaren sätter lappen på och skickar
// väskan MEDAN platsen väljs (ihop delar man: en vid skärmen, en med väskorna), medarbetaren väljer plats –
// kortet skrivs ut direkt – och ger boardingkortet: poängen är MEDARBETARENS; båda trycker NEKA på samma
// falska pass och båda trycker SKICKA samtidigt – det händer EN gång, den andra ser HANN FÖRE!; ett
// önskemål som kommer två gånger räknas en gång; lagets räkning är synkad; ledarbyte utan id-krockar –
// resenären den gamla ledaren checkade in släpps och den nya ledaren väger vidare, den som var på väg in
// ställer sig i kön; lönebeskedet delar lika.
// (Incheckningen står inte i COOP_JOBS förrän den släpps – provet slår på det i båda sidorna.)
//   node tools/coop-incheck-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8819)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tinch' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: flygplatsen är öppen; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { incheckning: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'incheckning' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => m.COOP_JOBS.add('incheckning')));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'incheckning', 'jobbincheck'); });
const J = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));
const st = (p) => D(p, 'D.state()');
const desk = async (p) => (await st(p))?.passenger || null;
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const act = (p, key, v) => D(p, `D.act(${J(key)}, ${J(v)})`);
const idle = (p) => D(p, 'D.idle()');
const count = async (p, txt) => ((await D(p, 'D.popLog()')) || []).filter((s) => s === txt).length;
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 120);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };
// resenären vid disken hos den andra: samma id och (valfritt) samma steg
const seesDesk = (p, id, step) => until(async () => { const s = await st(p); return s?.passenger?.id === id && s.passenger.state === 'desk' && (!step || s.step === step) ? s : null; }, 6000, 150);
const weighed = (p) => until(async () => ((await st(p))?.weigh >= 1 ? 1 : null), 4000, 100);

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia jobbar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbincheck', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen i incheckningen erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbincheck' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra vid disken (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const qSoloA = await D(A, 'D.all()'), qSoloB = await D(B, 'D.all()');
ok(qSoloA?.length === 0 && qSoloB?.length > 0, `egna köer: Kalle tömmer sin – Julias resenärer är kvar (${qSoloA?.length}/${qSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'INCHECKNINGEN' && (await D(B, 'D.title()')) === 'INCHECKNINGEN', 'ensam heter passet bara INCHECKNINGEN');
// ensam går allt som förut: pass, vikt, plats, lapp, band, kort
{
  await D(A, "D.forcePassenger('surf')");
  const s = await D(A, "D.step('alla')");
  const s2 = (await D(A, "(D.forcePassenger('fel-pass'), D.step('pass'))"));
  ok(s.stats.ok === 1 && s.stats.fel === 0 && s2.stats.ok === 2 && (await lag(A)).maxN === 1, `ensam: surfbrädan hela vägen (specialskåpet) och ett falskt pass nekat = 2 rätt (ok ${s2.stats.ok}, fel ${s2.stats.fel})`);
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
await A.waitForFunction(() => SF.sceneName === 'jobbincheck' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Incheckningen/.test(inv1 || ''), `Julia får inbjudan till incheckningen (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbincheck' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
const posB = await D(B, 'D.pos()');
ok(posB && posB[0] === 153 && posB[1] === 152, `Julia hoppar in vid lappskrivaren – väskorna är lediga (${J(posB)})`);
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra vid disken (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'INCHECKNINGEN IHOP' && (await D(G, 'D.title()')) === 'INCHECKNINGEN IHOP', 'rubriken är INCHECKNINGEN IHOP hos båda');

// 2. ledarens kö syns hos medarbetaren – samma resenärer, samma ordning, samma platser
{
  await D(L, 'D.calm()');
  const empty = await until(async () => { const a = await D(G, 'D.all()'); return a && a.length === 0 && !(await desk(G)) ? 1 : null; }, 6000, 300);
  ok(!!empty, `${gn} ser att kön och disken töms hos ledaren`);
  const d0 = (await D(L, "D.forcePassenger('latt', { wish: 'egal' })")).passenger;   // (disken upptagen – kön står still)
  await D(L, 'D.fill(3)');
  const lq = await D(L, 'D.queueList()');
  const seesQ = await until(async () => {
    const gq = await D(G, 'D.queueList()');
    if (!gq || gq.length !== lq.length) return null;
    return lq.every((p, i) => gq[i].id === p.id && gq[i].type === p.type && gq[i].name === p.name && gq[i].dest === p.dest && Math.abs(gq[i].x - p.x) < 3 && Math.abs(gq[i].y - p.y) < 3) ? gq : null;
  }, 6000, 250);
  ok(!!seesQ, `${gn} ser ledarens kö: ${lq.map((p) => `${p.name} till ${p.dest}`).join(', ')}`);
  const gd = await seesDesk(G, d0.id, 'pass');
  ok(!!gd && gd.passenger.code === d0.code && gd.passenger.weight === d0.weight && gd.passenger.fake === d0.fake,
    `${gn} ser samma resenär vid disken (${gd?.passenger.code}, ${gd?.passenger.weight} kg, steg ${gd?.step})`);
  await wait(600);
  await snap(G, 'incheck-ihop-medarbetaren-ko');
}

// 3. MEDARBETAREN checkar in (låset), ledaren tar väskan medan platsen väljs, medarbetaren ger kortet – och får poängen
{
  await D(L, 'D.calm()');
  const d0 = (await D(L, "D.forcePassenger('latt', { wish: 'egal' })")).passenger;
  await seesDesk(G, d0.id, 'pass');
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L) };
  await act(G, 'godkann');
  const locked = await until(async () => { const s = await st(L); return s.step === 'vikt' && s.passenger?.by === gId ? s : null; }, 5000, 100);
  ok(!!locked, `${gn} trycker GODKÄNN: hos ledaren är passet godkänt (steg ${locked?.step}) och resenären LÅST åt ${gn}`);
  await weighed(L);
  const k0 = await count(L, 'KOLLEGANS RESENÄR');
  await act(L, 'ok');
  await wait(300);
  ok((await count(L, 'KOLLEGANS RESENÄR')) > k0 && (await st(L)).step === 'vikt', `låset: ${ln}s VIKT-knapp säger KOLLEGANS RESENÄR – steget står kvar`);
  await weighed(G);
  await act(G, 'vikt');
  const pl = await until(async () => ((await st(L)).step === 'plats' ? 1 : null), 5000, 100);
  ok(!!pl, `${gn} väger (OK): hos ledaren är det dags för PLATS`);
  await until(async () => ((await st(G)).step === 'plats' ? 1 : null), 4000, 100);
  // ihop: ledaren tar väskan MEDAN platsen väljs – lappen på och iväg på bandet
  await act(L, 'lapp');
  await act(L, 'skicka');
  const bag = await st(L);
  ok(bag.step === 'plats' && bag.passenger.bagGone && (await stats(L)).fel === before.l.fel,
    `${ln} sätter lappen på och skickar väskan medan ${gn} väljer plats (steg ${bag.step}, väskan iväg: ${bag.passenger.bagGone})`);
  const gBag = await until(async () => { const s = await st(G); return s.passenger?.bagGone ? s : null; }, 4000, 100);
  ok(!!gBag, `${gn} ser att väskan är iväg`);
  await act(G, 'plats');
  const kort = await until(async () => { const s = await st(L); return s.step === 'kort' ? s : null; }, 5000, 100);
  ok(!!kort && kort.passenger.seat, `${gn} väljer plats ${kort?.passenger.seat}: boardingkortet skrivs ut direkt (steg ${kort?.step})`);
  await until(async () => ((await st(G)).cardReady ? 1 : null), 4000, 100);
  await act(G, 'kort');
  const paid = await until(async () => { const s = await stats(G); return s.ok === before.g.ok + 1 ? s : null; }, 8000, 150);
  const lagP = await until(async () => { const l = await lag(L), g = await lag(G); return l.ok === before.lag.ok + 1 && g.ok === before.lag.ok + 1 ? l : null; }, 4000, 150);
  ok(!!paid && !!lagP && (await stats(L)).ok === before.l.ok,
    `${gn} ger boardingkortet: RÄTT är ${gn}s poäng (ok ${paid?.ok}), laget ${lagP?.ok} – ledaren fick inget`);
  const gone = await until(async () => { const p = await desk(L); return !p || p.id !== d0.id ? 1 : null; }, 4000, 150);
  ok(!!gone, 'resenären går därifrån hos ledaren');
  await snap(L, 'incheck-ihop-ledaren');
}

// 4. samtidigt: båda trycker NEKA på samma falska pass – det räknas EN gång, den andra ser HANN FÖRE!
{
  await D(L, 'D.calm()');
  const d0 = (await D(L, "D.forcePassenger('fel-pass')")).passenger;
  await seesDesk(G, d0.id, 'pass');
  await bothIdle(L, G);
  const vL = await D(L, 'D.sig()'), vG = await D(G, 'D.sig()');
  const b = { l: await stats(L), g: await stats(G), lag: await lag(L), hl: await count(L, 'HANN FÖRE!'), hg: await count(G, 'HANN FÖRE!') };
  await Promise.all([act(L, 'neka', vL), act(G, 'neka', vG)]);
  await bothIdle(L, G);
  await wait(900);
  const a = { l: await stats(L), g: await stats(G), lag: await lag(L), hl: await count(L, 'HANN FÖRE!'), hg: await count(G, 'HANN FÖRE!') };
  const lWon = a.l.ok === b.l.ok + 1, gWon = a.g.ok === b.g.ok + 1;
  ok(a.lag.ok === b.lag.ok + 1 && lWon !== gWon && a.lag.fel === b.lag.fel, `båda nekar samma falska pass: EN rätt i laget (${b.lag.ok} → ${a.lag.ok}), till ${lWon ? ln : gn}`);
  ok(lWon ? a.hg > b.hg : a.hl > b.hl, `den som kom sist (${lWon ? gn : ln}) ser HANN FÖRE!`);
}
// …och båda trycker SKICKA samtidigt: väskan går EN gång
{
  await D(L, 'D.calm()');
  const d0 = (await D(L, "D.forcePassenger('latt', { wish: 'egal' })")).passenger;
  await act(L, 'godkann');
  await weighed(L);
  await act(L, 'vikt'); await act(L, 'plats'); await act(L, 'lapp');
  const band = await seesDesk(G, d0.id, 'band');
  await bothIdle(L, G);
  const vL = await D(L, 'D.sig()'), vG = await D(G, 'D.sig()');
  const b = { lag: await lag(L), hl: await count(L, 'HANN FÖRE!'), hg: await count(G, 'HANN FÖRE!') };
  await Promise.all([act(L, 'skicka', vL), act(G, 'skicka', vG)]);
  await bothIdle(L, G);
  await wait(900);
  const s = await st(L), a = { lag: await lag(L), hl: await count(L, 'HANN FÖRE!'), hg: await count(G, 'HANN FÖRE!') };
  ok(!!band && s.step === 'kort' && s.passenger.bagGone && a.lag.fel === b.lag.fel && (a.hl - b.hl) + (a.hg - b.hg) === 1,
    `båda trycker SKICKA: väskan går EN gång (steg ${s.step}), inga fel, EN ser HANN FÖRE! (${a.hl > b.hl ? ln : gn})`);
  await until(async () => ((await st(L)).cardReady ? 1 : null), 4000, 100);
  const bo = (await stats(L)).ok;
  await act(L, 'kort');   // (ledaren checkade in hen – ledaren ger kortet)
  ok(!!(await until(async () => ((await stats(L)).ok === bo + 1 ? 1 : null), 6000, 150)), `${ln} ger kortet till sin resenär – poängen är ${ln}s`);
}

// 5. ett önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  await D(L, 'D.calm()');
  const d0 = (await D(L, "D.forcePassenger('fel-pass')")).passenger;
  await seesDesk(G, d0.id, 'pass');
  await bothIdle(L, G);
  const b = { g: await stats(G), lag: await lag(L), hg: await count(G, 'HANN FÖRE!') };
  const sent = await D(G, "D.twice('neka')");
  await bothIdle(L, G);
  await wait(900);
  const a = { g: await stats(G), lag: await lag(L), hg: await count(G, 'HANN FÖRE!') };
  ok(sent && a.g.ok === b.g.ok + 1 && a.lag.ok === b.lag.ok + 1 && a.hg === b.hg,
    `samma "NEKA" två gånger: räknas EN gång (laget ${b.lag.ok} → ${a.lag.ok}, ${gn} ${b.g.ok} → ${a.g.ok}, ingen HANN FÖRE!)`);
}

// 6. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade hos båda`);
}

// 7. LEDARBYTE: ledaren (som checkat in resenären vid disken) går medan en ny resenär är på väg in –
// medarbetaren tar över inom sekunder, resenären vid disken släpps och den nya ledaren väger vidare,
// den som var på väg in ställer sig i kön och nya resenärer krockar inte med gamla id:n
{
  await D(L, 'D.calm()');
  const d0 = (await D(L, "D.forcePassenger('latt', { wish: 'egal' })")).passenger;
  await act(L, 'godkann');
  const p2 = await D(L, 'D.komIn()');
  const inG = await until(async () => { const p = ((await D(G, 'D.all()')) || []).find((x) => x.id === p2); return p && p.state === 'in' ? p : null; }, 4000, 80);
  ok(!!inG, `${gn} ser en resenär komma in (id ${p2}, ${inG?.state})`);
  const lockedL = await until(async () => { const p = await desk(G); return p && p.id === d0.id && p.by === lId ? p : null; }, 4000, 100);
  ok(!!lockedL, `${gn} ser ${ln}s resenär vid disken (låst åt ${ln})`);
  const seenIds = ((await D(G, 'D.all()')) || []).map((p) => p.id);
  const maxId = Math.max(...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const freed = await until(async () => { const p = await desk(G); return p && p.id === d0.id && p.by === '' ? p : null; }, 8000, 250);
  ok(!!freed, `resenären ${ln} checkade in är släppt (ingen har låset) – ingen resenär blir stående`);
  await weighed(G);
  await act(G, 'vikt');
  const goOn = await until(async () => { const s = await st(G); return s.step === 'plats' && s.passenger?.id === d0.id ? s : null; }, 5000, 150);
  ok(!!goOn, `${gn} väger vidare som ny ledare (steg ${goOn?.step})`);
  const walked = await until(async () => { const p = ((await D(G, 'D.all()')) || []).find((x) => x.id === p2); return p && p.state === 'queue' ? p : null; }, 15000, 250);
  ok(!!walked, `resenären som var på väg in ställer sig i kön hos den nya ledaren (${walked?.state}, x ${walked?.x})`);
  await D(G, 'D.fill(1)');
  const ids = ((await D(G, 'D.all()')) || []).map((p) => p.id), fresh = ids.filter((id) => !seenIds.includes(id));
  ok(fresh.length > 0 && fresh.every((id) => id > maxId) && new Set(ids).size === ids.length, `inga id-krockar (resenärerna ${ids.join(', ')}; de nya > ${maxId})`);
}

// 8. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
{
  await D(G, 'D.calm()');
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
