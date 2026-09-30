// JOBBA TILLSAMMANS på Vårdcentralen: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna väntrum – och ensam går allt
// som förut: ropa in, fram till luckan, rätt rum); Kalle bjuder in Julia via startdialogens
// 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra, exakt EN skiftledare,
// rubriken blir VÅRDCENTRALEN IHOP; ledarens patienter (samma besvär, nummerlapp och läge) syns hos
// medarbetaren; medarbetaren ropar in en patient (hen går till medarbetarens lucka och är LÅST åt hen),
// ger rummet medan patienten är på väg – poängen är MEDARBETARENS när patienten kommer fram – och
// skickar en annan till fel rum (felet är hens, personalen skickar vidare och alla hör det); båda
// trycker NÄSTA samtidigt och får var sin patient vid var sin lucka; ledarens dörrklick rör inte
// medarbetarens patient (låset); klickar båda på SAMMA väntande patient ropas hen in EN gång (den andra
// ser HANN FÖRE!); ett önskemål som kommer två gånger räknas en gång; lagets räkning är synkad;
// ledarbyte utan id-krockar – patienten den gamla ledaren hade vid luckan släpps och den nya ledaren
// skickar hen, patienten som var på väg in går vidare; lönebeskedet delar lika.
// (Vårdcentralen står inte i COOP_JOBS förrän den släpps – provet slår på det i båda sidorna.)
//   node tools/coop-vard-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8818)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tvard' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: vårdcentralen är öppen (08–17); båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { vard: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'vard' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('vard'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'vard', 'jobbvard'); });
const J = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));
const pats = (p) => D(p, 'D.patients()');
const pat = async (p, id) => ((await pats(p)) || []).find((x) => x.id === id) || null;
const atWin = async (p) => ((await pats(p)) || []).filter((x) => x.state === 'called' || x.state === 'desk');
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const act = (p, key, a) => D(p, `D.act(${J(key)}, ${J(a)})`);
const idle = (p) => D(p, 'D.idle()');
const hann = async (p) => ((await D(p, 'D.popLog()')) || []).filter((s) => s === 'HANN FÖRE!').length;
const waitIdle = (p) => until(() => idle(p), 6000, 100);
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 120);
const force = (p, sym) => D(p, `D.forcePatient(${J(sym)})`);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };
// rätt rum för besvären
const RUM = { feber: 'lakare', hosta: 'lakare', vaccin: 'ssk', blod: 'labb', arm: 'akut', akut: 'akut' };
const RI = { lakare: 0, ssk: 1, labb: 2, akut: 3 };

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia jobbar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbvard', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på vårdcentralen erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbvard' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i receptionen (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const pSoloA = await pats(A), pSoloB = await pats(B);
ok(pSoloA?.length === 0 && pSoloB?.length > 0, `egna väntrum: Kalle tömmer sitt – Julias patienter är kvar (${pSoloA?.length}/${pSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'VÅRDCENTRALEN' && (await D(B, 'D.title()')) === 'VÅRDCENTRALEN', 'ensam heter passet bara VÅRDCENTRALEN');
// ensam går allt som förut: ropa in, fram till luckan, rätt rum
{
  const id = await force(A, 'blod');
  const called = await D(A, `D.call(${id})`);
  await D(A, 'D.arrive()');
  await D(A, `D.send('labb', ${id})`);
  const s = await stats(A), p = await pat(A, id);
  ok(called && s.ok === 1 && s.fel === 0 && p?.state === 'toDoor' && p?.room === 2, `ensam: BLODPROV ropas in och skickas till LABB = rätt (ok ${s.ok}, ${p?.state})`);
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
await A.waitForFunction(() => SF.sceneName === 'jobbvard' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Vårdcentralen/.test(inv1 || ''), `Julia får inbjudan till vårdcentralen (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbvard' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i receptionen (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'VÅRDCENTRALEN IHOP' && (await D(G, 'D.title()')) === 'VÅRDCENTRALEN IHOP', 'rubriken är VÅRDCENTRALEN IHOP hos båda');

// provlugn hos ledaren: inga nya patienter, väntrummet tomt; ledaren vid lucka 1, medarbetaren vid lucka 2
await D(L, 'D.calm()');
await D(L, 'D.lucka(0)');
await D(G, 'D.lucka(1)');
const empty = await until(async () => { const p = await pats(G); return p && p.length === 0 ? 1 : null; }, 6000, 300);
ok(!!empty, `${gn} ser att väntrummet töms hos ledaren`);

// 2. ledarens patienter syns hos medarbetaren – samma besvär, nummerlapp och läge
const pBlod = await force(L, 'blod'), pFeber = await force(L, 'feber');
await force(L, 'vaccin');
const lp = await pats(L);
const seesPats = await until(async () => {
  const gp = await pats(G);
  if (!gp || gp.length !== 3) return null;
  return lp.every((p) => gp.some((x) => x.id === p.id && x.sym === p.sym && x.num === p.num && x.state === p.state && Math.abs(x.x - p.x) < 3 && Math.abs(x.y - p.y) < 3)) ? gp : null;
}, 6000, 250);
ok(!!seesPats, `${gn} ser ledarens patienter: ${lp.map((p) => `${p.sym} (nr ${p.num}, ${p.state})`).join(', ')}`);
await wait(600);   // (positionerna vid luckorna hinner ut i världen)
await snap(G, 'vard-ihop-medarbetaren-vantrum');

// 3. MEDARBETAREN ropar in, ger rummet medan patienten går och får poängen när hen kommer fram
{
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L) };
  await waitIdle(G);
  await act(G, 'ropa', pBlod);
  const calledL = await until(async () => { const p = await pat(L, pBlod); return p && (p.state === 'called' || p.state === 'desk') && p.by === gId ? p : null; }, 5000, 100);
  ok(!!calledL && calledL.win === 1, `${gn} klickar på bubblan: patienten är inropad hos ledaren, till ${gn}s lucka (lucka ${calledL ? calledL.win + 1 : '?'}) och LÅST åt ${gn}`);
  const nuG = await until(async () => { const n = await D(G, 'D.nu()'); return n && n.win === 1 && n.no === String(calledL?.num % 1000).padStart(3, '0') ? n : null; }, 4000, 100);
  ok(!!nuG, `NU-tavlan hos ${gn} visar numret ${nuG?.no} till lucka 2`);
  const seesMine = await until(async () => { const p = await pat(G, pBlod); return p && (p.state === 'called' || p.state === 'desk') && p.by === gId ? p : null; }, 4000, 100);
  ok(!!seesMine, `${gn} ser sin patient på väg till luckan (${seesMine?.state})`);
  // dörren medan patienten fortfarande går: rummet blir hens mål
  await waitIdle(G);
  await act(G, 'skicka', 'labb');
  const dest = await until(async () => { const p = await pat(L, pBlod); return p && (p.dest === 2 || p.room === 2) ? p : null; }, 4000, 100);
  ok(!!dest, `${gn} klickar på LABB – hos ledaren är det patientens mål (${dest?.state}, mål ${dest?.dest}, rum ${dest?.room})`);
  const paid = await until(async () => { const s = await stats(G); return s.ok === before.g.ok + 1 ? s : null; }, 15000, 200);
  const lagP = await until(async () => { const l = await lag(L), g = await lag(G); return l.ok === before.lag.ok + 1 && g.ok === before.lag.ok + 1 ? l : null; }, 4000, 150);
  const inRoom = await pat(L, pBlod);
  ok(!!paid && !!lagP && (await stats(L)).ok === before.l.ok && (!inRoom || inRoom.room === 2),
    `patienten kommer fram och går till LABB: RÄTT RUM är ${gn}s poäng (ok ${paid?.ok}), laget ${lagP?.ok} – ledaren fick inget`);
}
// fel rum: felet är medarbetarens, personalen skickar vidare – och det hörs hos medarbetaren också
{
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L) };
  await waitIdle(G);
  await act(G, 'ropa', pFeber);
  await until(async () => (await pat(L, pFeber))?.by === gId, 5000, 100);
  await D(L, 'D.arrive()');
  await until(async () => (await pat(G, pFeber))?.state === 'desk', 4000, 100);
  await waitIdle(G);
  await act(G, 'skicka', 'akut');
  const fel = await until(async () => { const s = await stats(G); return s.fel === before.g.fel + 1 && s.felrum === before.g.felrum + 1 ? s : null; }, 5000, 100);
  const lagF = await until(async () => { const l = await lag(L), g = await lag(G); return l.fel === before.lag.fel + 1 && g.fel === before.lag.fel + 1 ? l : null; }, 4000, 150);
  ok(!!fel && !!lagF && (await stats(L)).fel === before.l.fel, `FEBER → AKUTEN: felet är ${gn}s (fel ${fel?.fel}), laget också – inte ledarens`);
  const heard = await until(async () => { const tk = await D(G, 'D.talk()'); return tk?.[3] && /FEL RUM/.test(tk[3].text) ? tk[3].text : null; }, 12000, 80);
  ok(!!heard, `${gn} hör akutens personal: "${heard}"`);
  const rerouted = await until(async () => { const p = await pat(L, pFeber); return !p || p.room === 0 ? 1 : null; }, 12000, 200);
  ok(!!rerouted, 'personalen skickar vidare patienten till LÄKAREN hos ledaren');
  await snap(G, 'vard-ihop-medarbetaren-felrum');
}

// 4. båda trycker NÄSTA samtidigt: var sin patient vid var sin lucka – och låset håller
{
  await D(L, 'D.calm()');   // (nytt väntrum – ingen hinner tröttna under provet)
  for (const s of ['vaccin', 'hosta', 'arm']) await force(L, s);
  await until(async () => ((await pats(G)) || []).filter((p) => p.state === 'wait').length === 3, 5000, 150);
  await bothIdle(L, G);
  await Promise.all([act(L, 'nasta'), act(G, 'nasta')]);
  const two = await until(async () => { const w = await atWin(L); return w.length === 2 && w.some((p) => p.by === lId) && w.some((p) => p.by === gId) ? w : null; }, 5000, 100);
  const mineL = two?.find((p) => p.by === lId), mineG = two?.find((p) => p.by === gId);
  ok(!!two && mineL.id !== mineG.id && mineL.win === 0 && mineG.win === 1,
    `båda trycker NÄSTA: ${ln} får nr ${mineL?.num} vid lucka 1, ${gn} nr ${mineG?.num} vid lucka 2 (${two ? 'två olika' : 'timeout'})`);
  await D(L, 'D.arrive()');
  await until(async () => (await pat(G, mineG?.id))?.state === 'desk', 4000, 100);
  await bothIdle(L, G);
  // låset: ledaren klickar på medarbetarens patient – och på en dörr när hen själv inte har någon
  const h0 = await hann(L);
  await act(L, 'ropa', mineG.id);
  const b1 = { l: await stats(L), g: await stats(G) };
  await act(L, 'skicka', RUM[mineL.sym]);
  const sentL = await until(async () => (await stats(L)).ok === b1.l.ok + 1, 3000, 100);
  await act(L, 'skicka', 'lakare');
  await wait(500);
  const still = await pat(L, mineG.id);
  ok((await hann(L)) > h0 && !!sentL && still?.state === 'desk' && still?.by === gId && (await stats(G)).ok === b1.g.ok,
    `låset: ${ln} kan inte ropa in eller skicka ${gn}s patient (den står kvar vid lucka 2, låst åt ${gn}) – ${ln} skickar bara sin egen`);
  await waitIdle(G);
  await act(G, 'skicka', RUM[mineG.sym]);
  const sentG = await until(async () => (await stats(G)).ok === b1.g.ok + 1, 5000, 100);
  ok(!!sentG && (await stats(L)).ok === b1.l.ok + 1, `${gn} skickar sin egen patient till rätt rum – poängen är ${gn}s`);
  await snap(L, 'vard-ihop-ledaren-tva-luckor');
}

// 5. samtidigt: båda klickar på SAMMA väntande patient – hen ropas in EN gång, den andra ser HANN FÖRE!
{
  await D(L, 'D.calm()');
  const x = await force(L, 'vaccin');
  await until(async () => (await pat(G, x))?.state === 'wait', 5000, 150);
  await bothIdle(L, G);
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([act(L, 'ropa', x), act(G, 'ropa', x)]);
  await bothIdle(L, G);
  await wait(900);
  const w = await atWin(L), px = await pat(L, x);
  const winnerId = px?.by, winner = winnerId === lId ? L : G, loser = winner === L ? G : L, loserN = loser === G ? gn : ln;
  ok(w.length === 1 && w[0].id === x && (winnerId === lId || winnerId === gId), `båda klickar på samma patient – hen ropas in EN gång (låst åt ${winnerId === lId ? ln : gn}, ${w.length} vid luckorna)`);
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  const b = { w: await stats(winner), l: await stats(loser) };
  if (winner === L) await D(L, 'D.arrive()'); else { await D(L, 'D.arrive()'); await until(async () => (await pat(G, x))?.state === 'desk', 4000, 100); }
  await waitIdle(winner);
  await act(winner, 'skicka', 'ssk');
  const wp = await until(async () => (await stats(winner)).ok === b.w.ok + 1, 5000, 100);
  ok(!!wp && (await stats(loser)).ok === b.l.ok, 'vinnaren skickar patienten till SJUKSKÖTERSKAN – poängen räknas EN gång');
}

// 6. ett önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  await D(L, 'D.calm()');
  for (const s of ['hosta', 'feber', 'blod']) await force(L, s);
  await until(async () => ((await pats(G)) || []).filter((p) => p.state === 'wait').length === 3, 5000, 150);
  await bothIdle(L, G);
  const sent = await D(G, "D.twice('nasta')");
  await bothIdle(L, G);
  await wait(900);
  const w = await atWin(L);
  ok(sent && w.length === 1 && w[0].by === gId, `samma "NÄSTA" två gånger: EN patient ropas in (${w.length} vid luckorna, låst åt ${gn})`);
  await D(L, 'D.arrive()');
  await until(async () => (await pat(G, w[0]?.id))?.state === 'desk', 4000, 100);
  await bothIdle(L, G);
  const b = { g: await stats(G), lag: await lag(L) };
  const sent2 = await D(G, `D.twice('skicka', ${J(RUM[w[0]?.sym])})`);
  await bothIdle(L, G);
  await wait(1000);
  const a = { g: await stats(G), lag: await lag(L) };
  ok(sent2 && a.g.ok === b.g.ok + 1 && a.lag.ok === b.lag.ok + 1, `samma "skicka till rätt rum" två gånger: räknas EN gång (laget ${b.lag.ok} → ${a.lag.ok}, ${gn} ${b.g.ok} → ${a.g.ok})`);
}

// 7. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss && l.boxes === g.boxes ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade, ${same?.boxes} akutbonus hos båda`);
}

// 8. LEDARBYTE: ledaren (med en patient vid luckan) går medan en ny patient kommer in – medarbetaren tar
// över inom sekunder, patienten vid luckan släpps och skickas av den nya ledaren, den som var på väg
// in går vidare och nya patienter krockar inte med gamla id:n
{
  await D(L, 'D.calm()');
  await bothIdle(L, G);
  const p2 = await D(L, 'D.komIn()');
  const inG = await until(async () => { const p = await pat(G, p2); return p && ['in', 'toTicket', 'ticket'].includes(p.state) ? p : null; }, 4000, 80);
  ok(!!inG, `${gn} ser en patient komma in genom skjutdörrarna (id ${p2}, ${inG?.state})`);
  const p1 = await force(L, 'vaccin');
  await act(L, 'ropa', p1);
  await D(L, 'D.arrive()');
  const lockedL = await until(async () => { const p = await pat(G, p1); return p && p.state === 'desk' && p.by === lId ? p : null; }, 4000, 100);
  ok(!!lockedL, `${gn} ser ${ln}s patient vid lucka 1 (låst åt ${ln})`);
  const onWay = await pat(G, p2);
  ok(!!onWay && ['in', 'toTicket', 'ticket', 'toSeat', 'sit'].includes(onWay.state), `patienten är fortfarande på väg in när ${ln} går (${onWay?.state})`);
  const seenIds = ((await pats(G)) || []).map((p) => p.id);
  const maxId = Math.max(...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const freed = await until(async () => { const p = await pat(G, p1); return p && p.state === 'desk' && p.by === '' ? p : null; }, 8000, 250);
  ok(!!freed, `patienten ${ln} hade vid luckan är släppt (ingen har låset) – ingen patient blir stående`);
  const b = { g: await stats(G), lag: await lag(G) };
  await waitIdle(G);
  await act(G, 'skicka', 'ssk');
  const sentNew = await until(async () => { const s = await stats(G), l = await lag(G); return s.ok === b.g.ok + 1 && l.ok === b.lag.ok + 1 ? s : null; }, 6000, 150);
  ok(!!sentNew, `${gn} skickar den släppta patienten till SJUKSKÖTERSKAN som ny ledare – poängen räknas (ok ${b.g.ok} → ${sentNew?.ok})`);
  const walked = await until(async () => { const p = await pat(G, p2); return p && ['ticket', 'toSeat', 'sit', 'wait', 'toSpot'].includes(p.state) ? p : null; }, 15000, 250);
  ok(!!walked, `patienten som var på väg in går vidare hos den nya ledaren (${walked?.state}${walked?.num != null ? ', nr ' + walked.num : ''})`);
  await force(G, 'hosta');
  const ids = ((await pats(G)) || []).map((p) => p.id), fresh = ids.filter((id) => !seenIds.includes(id));
  ok(fresh.length > 0 && fresh.every((id) => id > maxId) && new Set(ids).size === ids.length, `inga id-krockar (patienterna ${ids.join(', ')}; de nya > ${maxId})`);
}

// 9. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
{
  await D(G, 'D.calm()');
  const lg = await lag(G);
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lg.ok} rätt`).test(slip || '') && /Akutfall först/.test(slip || ''),
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
