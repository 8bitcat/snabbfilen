// JOBBA TILLSAMMANS på Finanshuset: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna kunder – och ensam går allt som
// förut: rätt läge = affär, fel knapp och för dyrt = fel, lapparna går inte att låsa); Kalle bjuder in
// Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra
// och sitter bredvid varandra vid desken, exakt EN skiftledare, rubriken blir FINANSHUSET IHOP; ledarens
// kurser och lappar syns hos medarbetaren (samma nummer, samma gränser); medarbetaren tar en lapp – den
// är LÅST åt henne hos ledaren (ledarens KÖP säger KOLLEGANS ORDER) – och gör affären: det är
// MEDARBETAREN som får poängen; fel knapp är medarbetarens fel; ett önskemål som kommer två gånger
// görs en gång; trycker båda KÖP på samma lapp blir det EN affär (den andra ser HANN FÖRE! och får
// inget fel), och tar båda samma lapp får EN den; en tagen lapp som går ut är missad hos den som tagit
// den; lagets räkning är synkad; ledarbyte utan nummerkrockar – den gamla ledarens lapp blir ledig,
// medarbetarens är kvar, kurserna rör sig igen och nya kunder får nya nummer; lönebeskedet delar lika.
// (Finanshuset står inte i COOP_JOBS förrän det släpps – provet slår på det i båda sidorna. Jobbet
// kräver examen i Ekonomi – båda har den i sparfilen.)
//   node tools/coop-finans-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8827)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tfinans' + Math.random().toString(36).slice(2, 8);
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
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: n.toLowerCase(), name: n, look: { skin: '#eabf98', shirt: n === 'Kalle' ? '#3a78d8' : '#d84a8a' }, color: n === 'Kalle' ? '#3a78d8' : '#d84a8a' }));
    // kl 12: börsen har öppet; båda har examen (Datorteknik + Ekonomi) och är nybörjare på jobbet
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { finans: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false,
      edu: { datorteknik: { lect: 4, day: 1, tenta: 1, tentaDay: 1, klar: true }, ekonomi: { lect: 4, day: 1, tenta: 1, tentaDay: 1, klar: true } } }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'finans' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => m.COOP_JOBS.add('finans')));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'finans', 'jobbfinans'); });
const inScene = (p) => p.waitForFunction(() => SF.sceneName === 'jobbfinans' && !!SF.scene?._debug?.coop, null, { timeout: 15000 });
// ett riktigt tryck (scenens down(x, y)): på KÖP/SÄLJ under skärm i – eller på lappen ('LAPP')
const press = (p, i, what) => p.evaluate(([j, w]) => { const s = SF.scene._debug.spot(j, w); SF.scene.down(s.x, s.y); return true; }, [i, what]);
const idle = (p) => D(p, 'D.idle()');
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const tickets = (p) => D(p, 'D.tickets()');
const stocks = (p) => D(p, 'D.stocks()');
const count = async (p, txt) => ((await D(p, 'D.pops()')) || []).filter((s) => s === txt).length;
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 150);
const sig = (list) => JSON.stringify((list || []).map((k) => (k ? [k.id, k.typ, k.lim, k.by] : 0)));
const deskSynced = (a, b) => until(async () => { const x = await tickets(a), y = await tickets(b); return x && y && sig(x) === sig(y) ? x : null; }, 6000, 200);
const force = (p, i, typ, dp) => D(p, `(() => { const p0 = D.stocks()[${i}].p; return D.force(${i}, '${typ}', Math.round((p0 + ${dp}) * 10) / 10); })()`);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia handlar på sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbfinans', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på Finanshuset erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await inScene(A);
await inScene(B);
await wait(5000);
{
  const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
  const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
  ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
    `var för sig: ingen ser den andra vid desken (${seeA}/${seeB}) – båda kör sitt eget pass`);
  await D(A, 'D.calm()');
  await wait(2500);
  const tA = await tickets(A), tB = await tickets(B);
  ok(tA.every((k) => !k) && tB.some((k) => k), `egna kunder: Kalles desk är tom – Julias kunder ringer vidare (${tB.filter(Boolean).length} lappar)`);
  ok((await D(A, 'D.title()')) === 'FINANSHUSET' && (await D(B, 'D.title()')) === 'FINANSHUSET' && (await D(A, 'D.seat()')) === 192,
    'ensam heter passet bara FINANSHUSET och man sitter mitt för desken');
  // precis som utbildade-jobb-test.mjs: rätt läge = affär, för billigt och fel knapp = fel
  await D(A, 'D.still(true)');
  await force(A, 0, 'KÖP', 5);
  const a1 = await D(A, "D.trade(0, 'KÖP').ok");
  await force(A, 1, 'SÄLJ', 50);
  const b1 = await D(A, "D.trade(1, 'SÄLJ').fel");
  await force(A, 2, 'KÖP', 5);
  const c1 = await D(A, "D.trade(2, 'SÄLJ').fel");
  await force(A, 3, 'KÖP', 5);
  const claimed = await D(A, 'D.claim(3)');
  await press(A, 3, 'KÖP');
  const s1 = await stats(A), lg = await lag(A);
  ok(a1 === 1 && b1 === 1 && c1 === 2 && s1.ok === 2 && claimed === null && lg.maxN === 1,
    `ensam går allt som förut: affär (${a1}), för billigt = fel, fel knapp = fel (${c1}), KÖP-knappen på skärmen (${s1.ok} affärer) – lappar låses inte`);
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
await inScene(A);
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Finanshuset/.test(inv1 || ''), `Julia får inbjudan till Finanshuset (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await inScene(B);
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
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'FINANSHUSET IHOP' && (await D(G, 'D.title()')) === 'FINANSHUSET IHOP', 'rubriken är FINANSHUSET IHOP hos båda');
{
  // man sitter bredvid varandra: olika stolar, och den andra syns där hen sitter
  const seats = await until(async () => {
    const sl = await D(L, 'D.seat()'), sg = await D(G, 'D.seat()');
    const xl = await G.evaluate(() => SF.worldFolksHere()[0]?.x), xg = await L.evaluate(() => SF.worldFolksHere()[0]?.x);
    return sl !== sg && Math.abs(xl - sl) <= 2 && Math.abs(xg - sg) <= 2 ? { sl, sg } : null;
  }, 8000, 300);
  ok(!!seats, `${ln} och ${gn} sitter bredvid varandra vid desken (stolarna vid x ${seats?.sl} och ${seats?.sg})`);
}

// 2. ledarens kurser och lappar syns hos medarbetaren
{
  await D(L, '(D.still(true), D.calm())');
  await D(L, 'D.setPrice(0, 100)');
  const price = await until(async () => { const s = await stocks(G); return s && Math.abs(s[0].p - 100) < 0.05 ? s : null; }, 6000, 200);
  ok(!!price, `${gn} ser ledarens kurs (PIXEL ${price?.[0].p} kr)`);
  const t1 = await force(L, 1, 'KÖP', 30);
  const t3 = await force(L, 3, 'SÄLJ', -30);
  const desk = await deskSynced(L, G);
  ok(!!desk && desk[1]?.id === t1.id && desk[1].typ === 'KÖP' && desk[1].lim === t1.lim && desk[3]?.id === t3.id && !desk[0] && !desk[2],
    `${gn} ser samma lappar (nr ${t1?.id}: KÖP under ${t1?.lim}, nr ${t3?.id}: SÄLJ över ${t3?.lim})`);
  const sp = await Promise.all([stocks(L), stocks(G)]);
  ok(sp[0].every((s, i) => Math.abs(s.p - sp[1][i].p) < 0.05), `samma kurser på alla fyra skärmarna (${sp[1].map((s) => s.p).join(' / ')})`);
  await snap(G, 'finans-ihop-medarbetaren');
}

// 3. medarbetaren tar lapp 1 – den är LÅST åt henne hos ledaren
{
  await press(G, 1, 'LAPP');
  const lockedL = await until(async () => ((await tickets(L)) || [])[1]?.by === gId, 6000, 150);
  const lockedG = await until(async () => ((await tickets(G)) || [])[1]?.by === gId, 6000, 150);
  ok(!!lockedL && !!lockedG, `${gn} klickar på lappen – den är hennes hos båda`);
  const before = { l: await stats(L), k: await count(L, 'KOLLEGANS ORDER') };
  await press(L, 1, 'KÖP');
  await wait(300);
  const tl = await tickets(L), sl = await stats(L);
  ok(tl[1]?.by === gId && sl.ok === before.l.ok && sl.fel === before.l.fel && (await count(L, 'KOLLEGANS ORDER')) > before.k,
    `${ln}s KÖP på den lappen säger KOLLEGANS ORDER – ingen affär, inget fel`);
}

// 4. medarbetaren gör affären (tryck på KÖP) → poängen är hennes
{
  const before = { l: await stats(L), g: await stats(G), lag: await lag(L), a: await count(L, 'AFFÄR KLAR!') };
  await press(G, 1, 'KÖP');
  const goneL = await until(async () => !((await tickets(L)) || [1, 1])[1], 6000, 150);
  ok(!!goneL, `${gn}s affär gick igenom hos ledaren – lappen är borta`);
  const sG = await until(async () => { const s = await stats(G); return s && s.ok === before.g.ok + 1 ? s : null; }, 6000, 200);
  ok(!!sG, `${gn} FÅR POÄNGEN för affären (ok ${before.g.ok} → ${sG?.ok})`);
  ok((await stats(L)).ok === before.l.ok && (await count(L, 'AFFÄR KLAR!')) > before.a, `ledaren fick INTE poängen (${ln}: ok ${before.l.ok}) men ser AFFÄR KLAR!`);
  const lag4 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === before.lag.ok + 1 && g.ok === l.ok ? l : null; }, 6000, 200);
  ok(!!lag4, `lagets räkning är synkad (${lag4 ? lag4.ok : '?'} affärer hos båda)`);
  ok(!!(await deskSynced(L, G)), `${gn}s desk visar samma`);
}

// 5. fel knapp: felet är medarbetarens (och lagets) – FEL KNAPP! syns hos ledaren
{
  await force(L, 2, 'KÖP', 30);
  await deskSynced(L, G);
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), pl: await count(L, 'FEL KNAPP!') };
  await press(G, 2, 'SÄLJ');
  const sG = await until(async () => { const s = await stats(G); return s && s.fel === before.g.fel + 1 ? s : null; }, 6000, 200);
  const felSync = await until(async () => { const l = await lag(L), g = await lag(G); return l.fel === before.lag.fel + 1 && g.fel === l.fel ? l : null; }, 5000, 200);
  ok(!!sG && !!felSync && (await stats(L)).fel === before.l.fel && (await count(L, 'FEL KNAPP!')) > before.pl && !(await tickets(L))[2],
    `${gn} trycker SÄLJ på en köporder: FEL är ${gn}s (fel ${sG?.fel}), i laget (${felSync?.fel}) – ${ln} ser FEL KNAPP!`);
}

// 6. ett önskemål som kommer två gånger (svaret dröjde) görs EN gång
{
  await deskSynced(L, G);
  const before = { lag: (await lag(L)).ok, g: (await stats(G)).ok, h: await D(L, 'D.handled()'), hf: await count(G, 'HANN FÖRE!') };
  const sent = await D(G, "D.tradeTwice(3, 'SÄLJ')");
  await until(async () => await idle(G), 6000, 200);
  await wait(1200);
  const after = { lag: (await lag(L)).ok, g: (await stats(G)).ok, h: await D(L, 'D.handled()'), hf: await count(G, 'HANN FÖRE!'), t3: (await tickets(L))[3] };
  ok(sent && !after.t3 && after.h === before.h + 1 && after.lag === before.lag + 1 && after.g === before.g + 1 && after.hf === before.hf,
    `samma SÄLJ två gånger: körs EN gång (${before.h} → ${after.h}), EN affär (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g}), ingen HANN FÖRE!`);
}

// 7. samtidigt: båda trycker KÖP på samma lapp – EN affär, den andra ser HANN FÖRE! (inget fel);
// och tar båda samma lapp får EN den
{
  await force(L, 0, 'KÖP', 30);
  await deskSynced(L, G);
  await bothIdle(L, G);
  const h0 = [await count(L, 'HANN FÖRE!'), await count(G, 'HANN FÖRE!')];
  const s0 = [await stats(L), await stats(G)], lag0 = await lag(L);
  await Promise.all([L, G].map((p) => press(p, 0, 'KÖP')));
  await bothIdle(L, G);
  await wait(900);
  const s1 = [await stats(L), await stats(G)], lag1 = await lag(L);
  const won = [s1[0].ok - s0[0].ok, s1[1].ok - s0[1].ok];
  ok(!(await tickets(L))[0] && lag1.ok === lag0.ok + 1 && won[0] + won[1] === 1 && lag1.fel === lag0.fel,
    `båda trycker KÖP på samma lapp – EN affär (laget ${lag0.ok} → ${lag1.ok}, inget fel; ${ln} +${won[0]}, ${gn} +${won[1]})`);
  const li = won[0] ? 1 : 0, loser = li ? G : L, loserN = li ? gn : ln;
  ok((await count(loser, 'HANN FÖRE!')) > h0[li] && s1[li].fel === s0[li].fel, `den som kom sist (${loserN}) ser HANN FÖRE! – inget fel`);

  await force(L, 2, 'SÄLJ', -30);
  await deskSynced(L, G);
  await bothIdle(L, G);
  const c0 = [await count(L, 'HANN FÖRE!'), await count(G, 'HANN FÖRE!')];
  await Promise.all([L, G].map((p) => press(p, 2, 'LAPP')));
  await bothIdle(L, G);
  await wait(900);
  const owner = (await tickets(L))[2]?.by, ownerG = (await tickets(G))[2]?.by;
  const lose = owner === lId ? G : L, loseI = owner === lId ? 1 : 0;
  ok((owner === lId || owner === gId) && owner === ownerG && (await count(lose, 'HANN FÖRE!')) > c0[loseI],
    `båda klickar på samma lapp – EN får den (${owner === lId ? ln : gn}), den andra ser HANN FÖRE!`);
}

// 8. en tagen lapp som går ut är missad hos den som tog den
{
  await force(L, 3, 'KÖP', -30);   // (kursen är över gränsen – ingen affär just nu)
  await deskSynced(L, G);
  await press(G, 3, 'LAPP');
  await until(async () => ((await tickets(L)) || [])[3]?.by === gId, 6000, 150);
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), kL: await count(L, 'KUNDEN LADE PÅ…'), kG: await count(G, 'KUNDEN LADE PÅ…') };
  await D(L, 'D.expire(3)');
  const sG = await until(async () => { const s = await stats(G); return s && s.miss === before.g.miss + 1 ? s : null; }, 6000, 200);
  const lagM = await until(async () => { const l = await lag(L), g = await lag(G); return l.miss === before.lag.miss + 1 && g.miss === l.miss ? l : null; }, 5000, 200);
  ok(!!sG && !!lagM && (await stats(L)).miss === before.l.miss && (await count(L, 'KUNDEN LADE PÅ…')) > before.kL && (await count(G, 'KUNDEN LADE PÅ…')) > before.kG,
    `${gn}s lapp går ut: missad hos ${gn} (${sG?.miss}) och laget (${lagM?.miss}) – KUNDEN LADE PÅ… hos båda`);
}

// 9. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} affärer, ${same?.fel} fel, ${same?.miss} missade hos båda`);
  await snap(L, 'finans-ihop-ledaren');
}

// 10. LEDARBYTE: ledaren går med en lapp – medarbetaren tar över inom sekunder, ledarens lapp blir
// ledig, hennes egen är kvar, kurserna rör sig igen och nya kunder får nya nummer
{
  await D(L, 'D.calm()');
  const k0 = await force(L, 0, 'KÖP', 30), k1 = await force(L, 1, 'SÄLJ', 40);
  await deskSynced(L, G);
  await press(G, 0, 'LAPP');
  await press(L, 1, 'LAPP');
  const claims = await until(async () => { const t = await tickets(G); return t && t[0]?.by === gId && t[1]?.by === lId ? t : null; }, 6000, 200);
  ok(!!claims, `${gn} har lapp ${k0?.id}, ${ln} har lapp ${k1?.id} när ${ln} går`);
  const maxId = Math.max(k0.id, k1.id, ...((await tickets(G)) || []).map((k) => (k ? k.id : 0)));
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const freed = await until(async () => { const t = await tickets(G); return t && t[1] && !t[1].by ? t : null; }, 8000, 250);
  ok(!!freed && freed[1].id === k1.id && freed[0]?.by === gId, `${ln}s lapp ${k1.id} blir ledig – ${gn}s lapp ${k0.id} är fortfarande hennes`);
  const p1 = (await stocks(G)).map((s) => s.p);
  await wait(2500);
  const p2 = (await stocks(G)).map((s) => s.p);
  ok(p1.some((p, i) => Math.abs(p - p2[i]) > 0.01), `kurserna rör sig igen hos den nya ledaren (${p1.join('/')} → ${p2.join('/')})`);
  await D(G, 'D.auto(true)');
  const fresh = await until(async () => { const t = await tickets(G); return (t || []).find((k) => k && k.id > maxId) || null; }, 12000, 300);
  ok(!!fresh, `nya kunder ringer hos den nya ledaren – NYTT nummer (${fresh?.id} > ${maxId})`);
  const ids = ((await tickets(G)) || []).filter(Boolean).map((k) => k.id);
  ok(new Set(ids).size === ids.length, `inga nummerkrockar (lapparna: ${ids.join(', ')})`);
  // hennes egen lapp: affären går igenom hos henne själv (nu som ledare)
  const s0 = await stats(G);
  await press(G, 0, 'KÖP');
  const s1 = await stats(G);
  ok(s1.ok === s0.ok + 1, `${gn} gör affären på sin lapp som ny ledare (ok ${s0.ok} → ${s1.ok})`);
}

// 11. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt, fel och missade lika
{
  await D(G, 'D.calm()');
  const lg = await lag(G);
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lg.ok} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lg.ok} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
  const rows = await G.evaluate(() => [...document.querySelectorAll('#modal div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()));
  const num = (re) => +(((rows.find((r) => re.test(r)) || '').match(new RegExp(re.source + '\\s*(\\d+)')) || [])[1] ?? -1);
  const ratt = num(/^✅ Rätt/), fel = num(/^❌ Fel/), miss = num(/^💨 Missade/);
  ok(ratt === Math.round(lg.ok / 2) && fel === Math.round(lg.fel / 2), `rätt- och fel-raderna är halva lagets (${ratt} av ${lg.ok}, ${fel} av ${lg.fel})`);
  ok(lg.miss >= 1 && miss === Math.round(lg.miss / 2), `missade delas också lika (${miss} av lagets ${lg.miss})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
