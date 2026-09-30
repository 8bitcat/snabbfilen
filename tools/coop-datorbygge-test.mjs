// JOBBA TILLSAMMANS på Pixel Data (datorbygget): två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna verkstäder – och ensam går allt
// som förut: fel modell ger fel, rätt delar poäng, startknappen en färdig dator och nästa order); Kalle
// bjuder in Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda
// ser varandra, exakt EN skiftledare, rubriken blir PIXEL DATA IHOP; ledarens order och låda (vad som
// sitter i) syns hos medarbetaren, och delen ledaren bär syns också; medarbetaren tar en del ur hyllan
// (ledaren vet att hon bär den) och sätter i den – det är MEDARBETAREN som får poängen; fel modell är
// medarbetarens fel; ett önskemål som kommer två gånger görs en gång; sätter båda i samma sorts del
// samtidigt fylls platsen EN gång (den andra ser HANN FÖRE! och får inget fel); trycker medarbetaren på
// startknappen är datorbonusen hennes och nästa order kommer hos båda; lagets räkning är synkad;
// ledarbyte utan nummerkrockar – delen den gamla ledaren bar åker tillbaka, lådan och ordern är kvar
// och nästa order får ett nytt nummer; lönebeskedet delar rätt, fel och färdiga datorer lika.
// (Datorbygget står inte i COOP_JOBS förrän det släpps – provet slår på det i båda sidorna. Jobbet
// kräver examen i Datorteknik – båda har den i sparfilen.)
//   node tools/coop-datorbygge-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8827)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tdator' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: Pixel Data har öppet; båda har examen (Datorteknik + Ekonomi) och är nybörjare på jobbet
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { datorbygge: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false,
      edu: { datorteknik: { lect: 4, day: 1, tenta: 1, tentaDay: 1, klar: true }, ekonomi: { lect: 4, day: 1, tenta: 1, tentaDay: 1, klar: true } } }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'datorbygge' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => m.COOP_JOBS.add('datorbygge')));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'datorbygge', 'jobbdatorbygge'); });
const inScene = (p) => p.waitForFunction(() => SF.sceneName === 'jobbdatorbygge' && !!SF.scene?._debug?.coop, null, { timeout: 15000 });
// ställ byggaren där klicket leder och klicka (scenens down(x, y), som ett riktigt klick):
// en hylla (del-id, t.ex. 'cpu7'), 'lada' (datorlådan), 'start', 'pasta', 'kylare'
const readyAt = (p, where) => p.evaluate((w) => { const D2 = SF.scene._debug; const s = D2.standAt(w); if (!s) return false; D2.teleport(s[0], s[1]); return true; }, where);
const clickSpot = (p, where) => p.evaluate((w) => { const s = SF.scene._debug.spot(w); if (!s) return false; SF.scene.down(s.x, s.y); return true; }, where);
const act = async (p, where) => (await readyAt(p, where)) && clickSpot(p, where);
const idle = (p) => D(p, 'D.idle()');
const st = (p) => D(p, 'D.state()');
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const carrying = (p) => D(p, 'D.carrying()');
const held = (p) => D(p, 'D.held()');
const count = async (p, txt) => ((await D(p, 'D.pops()')) || []).filter((s) => s === txt).length;
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 150);
const sameBench = (a, b) => a && b && a.order.nr === b.order.nr && a.order.name === b.order.name && JSON.stringify(a.box) === JSON.stringify(b.box);
const benchSynced = (a, b) => until(async () => { const x = await st(a), y = await st(b); return sameBench(x, y) ? x : null; }, 6000, 200);
const carries = (p, id) => until(async () => (await carrying(p)) === id, 6000, 150);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia bygger på sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbdatorbygge', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på Pixel Data erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await inScene(A);
await inScene(B);
await wait(5000);
{
  const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
  const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
  ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
    `var för sig: ingen ser den andra i verkstaden (${seeA}/${seeB}) – båda kör sitt eget pass`);
  const b0 = await st(B);
  const nrA = await D(A, 'D.setOrder(2)');
  await D(A, "(D.pick('cpu7'), D.install())");
  await wait(600);
  const sA = await st(A), sB = await st(B);
  ok(sA.order.name === 'GAMING' && sA.order.nr === nrA && sA.box.cpu === 'PX7' && sB.order.nr === b0.order.nr && sB.order.name === b0.order.name && !sB.box.cpu,
    `egna verkstäder: Kalle tar order ${nrA} (GAMING) och sätter i en PX7 – Julias order ${sB.order.nr} (${sB.order.name}) och låda är orörda`);
  ok((await D(A, 'D.title()')) === 'PIXEL DATA' && (await D(B, 'D.title()')) === 'PIXEL DATA', 'ensam heter passet bara PIXEL DATA');
  // precis som utbildade-jobb-test.mjs: fel modell = fel, rätt delar = rätt, startknappen = en färdig dator
  const fel = await D(A, "(D.pick('ram8'), D.install(), D.stats.fel)");
  await D(A, "(['ram32', 'gpu8', 'ssd1', 'psu7'].forEach((id) => { D.pick(id); D.install(); }), D.tool('pasta'), D.tool('kylare'), D.power())");
  const built = await until(async () => { const s = await st(A); return s && s.boxes === 1 && s.order.nr === nrA + 1 ? s : null; }, 10000, 250);
  const s1 = await stats(A), lg = await lag(A);
  ok(fel === 1 && !!built && s1.ok === 7 && s1.fel === 1 && lg.maxN === 1 && (await count(A, 'FÄRDIG DATOR!')) === 1,
    `ensam går allt som förut: fel modell = fel (${fel}), 7 rätt, startknappen → 1 färdig dator och ny order nr ${built?.order.nr}`);
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
ok(/Pixel Data/.test(inv1 || ''), `Julia får inbjudan till Pixel Data (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
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
const seen = await A.evaluate(() => SF.worldFolksHere().length), seen2 = await B.evaluate(() => SF.worldFolksHere().length);
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i verkstaden (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'PIXEL DATA IHOP' && (await D(G, 'D.title()')) === 'PIXEL DATA IHOP', 'rubriken är PIXEL DATA IHOP hos båda');

// 2. ledarens order och låda syns hos medarbetaren – och delen ledaren bär
{
  const no = await D(L, 'D.setOrder(2)');   // GAMING: PX7, 32 GB, RX 80, 1 TB, 750 W
  const s2 = await benchSynced(L, G);
  ok(!!s2 && s2.order.nr === no && s2.order.name === 'GAMING', `${gn} ser samma order på skärmen (nr ${s2?.order.nr}: ${s2?.order.name})`);
  const okL0 = (await stats(L)).ok;
  await act(L, 'cpu7');
  const lHolds = await until(async () => ((await held(G)) || {})[lId] === 'cpu7', 6000, 200);
  ok((await carrying(L)) === 'cpu7' && !!lHolds, `${ln} tar en PX7 ur hyllan – ${gn} ser den i ${ln}s händer`);
  await act(L, 'lada');
  const inBox = await until(async () => { const s = await st(G); return s && s.box.cpu === 'PX7' ? s : null; }, 6000, 200);
  ok(!!inBox && (await stats(L)).ok === okL0 + 1, `${ln} sätter i processorn – den sitter i lådan hos ${gn} också`);
  const noHold = await until(async () => !((await held(G)) || { [lId]: 1 })[lId], 4000, 200);
  ok(!!noHold, `${ln}s händer är tomma hos ${gn} också`);
  await snap(G, 'dator-ihop-medarbetaren');
}

// 3. medarbetarens handling ändrar ledarens värld: tar 32 GB minne ur hyllan (klick)
{
  await act(G, 'ram32');
  ok(!!(await carries(G, 'ram32')), `${gn} klickar på minneslådan och tar 32 GB via ledaren`);
  const hL = await until(async () => ((await held(L)) || {})[gId] === 'ram32' ? await held(L) : null, 4000, 150);
  ok(!!hL && (await carrying(L)) === null, `ledaren vet att ${gn} bär 32 GB (${JSON.stringify(hL)}) – ${ln} bär ingenting`);
}

// 4. ... och sätter i det (klick) → poängen är medarbetarens
{
  const before = { l: await stats(L), g: await stats(G), lag: await lag(L) };
  await act(G, 'lada');
  const inBox = await until(async () => { const s = await st(L); return s && s.box.ram === '32 GB' ? s : null; }, 8000, 200);
  ok(!!inBox, `${gn}s minne sitter i lådan hos ledaren`);
  const sG = await until(async () => { const s = await stats(G); return s && s.ok === before.g.ok + 1 ? s : null; }, 6000, 200);
  ok(!!sG, `${gn} FÅR POÄNGEN för minnet (ok ${before.g.ok} → ${sG?.ok})`);
  ok((await stats(L)).ok === before.l.ok, `ledaren fick INTE poängen (${ln}: ok ${before.l.ok})`);
  ok((await carrying(G)) === null && !((await held(L)) || {})[gId], `${gn}s händer är tomma – också i ledarens bok`);
  const lag4 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === before.lag.ok + 1 && g.ok === l.ok ? l : null; }, 6000, 200);
  ok(!!lag4, `lagets räkning är synkad (${lag4 ? lag4.ok : '?'} rätt hos båda)`);
  ok(!!(await benchSynced(L, G)), `${gn} ser minnet i lådan och på orderskärmen`);
}

// 5. fel modell: felet är medarbetarens (och lagets) – FEL MODELL! syns hos ledaren, lådan orörd
{
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), pl: await count(L, 'FEL MODELL!') };
  await act(G, 'ssd5');   // GAMING vill ha 1 TB
  await carries(G, 'ssd5');
  await act(G, 'lada');
  const sG = await until(async () => { const s = await stats(G); return s && s.fel === before.g.fel + 1 ? s : null; }, 6000, 200);
  const felSync = await until(async () => { const l = await lag(L), g = await lag(G); return l.fel === before.lag.fel + 1 && g.fel === l.fel ? l : null; }, 5000, 200);
  const sL = await st(L);
  ok(!!sG && !!felSync && (await stats(L)).fel === before.l.fel && (await count(L, 'FEL MODELL!')) > before.pl && !sL.box.ssd && (await carrying(G)) === null,
    `${gn} sätter i en 500 GB: FEL är ${gn}s (fel ${sG?.fel}), i laget (${felSync?.fel}) – ${ln} ser FEL MODELL!, delen åkte tillbaka`);
}

// 6. ett önskemål som kommer två gånger (svaret dröjde) görs EN gång
{
  const before = { lag: (await lag(L)).ok, g: (await stats(G)).ok, h: await D(L, 'D.handled()'), hf: await count(G, 'HANN FÖRE!') };
  const sent = await D(G, "D.toolTwice('pasta')");
  await until(async () => await idle(G), 6000, 200);
  await wait(1200);
  const after = { lag: (await lag(L)).ok, g: (await stats(G)).ok, h: await D(L, 'D.handled()'), hf: await count(G, 'HANN FÖRE!'), pasta: (await st(L)).box.pasta };
  ok(sent && after.pasta && after.h === before.h + 1 && after.lag === before.lag + 1 && after.g === before.g + 1 && after.hf === before.hf,
    `samma önskemål (kylpasta) två gånger: körs EN gång (${before.h} → ${after.h}), EN poäng (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g}), ingen HANN FÖRE!`);
}

// 7. samtidigt: båda sätter i ett RX 80 – platsen fylls EN gång, den andra ser HANN FÖRE! (inget fel)
{
  await act(L, 'gpu8');
  await act(G, 'gpu8');
  await carries(L, 'gpu8');
  await carries(G, 'gpu8');
  await bothIdle(L, G);
  const h0 = [await count(L, 'HANN FÖRE!'), await count(G, 'HANN FÖRE!')];
  const s0 = [await stats(L), await stats(G)], lag0 = await lag(L);
  await Promise.all([L, G].map((p) => act(p, 'lada')));
  await bothIdle(L, G);
  await wait(900);
  const s1 = [await stats(L), await stats(G)], lag1 = await lag(L);
  const won = [s1[0].ok - s0[0].ok, s1[1].ok - s0[1].ok];
  ok((await st(L)).box.gpu === 'RX 80' && lag1.ok === lag0.ok + 1 && won[0] + won[1] === 1 && lag1.fel === lag0.fel,
    `båda sätter i ett RX 80 samtidigt – det sitter EN gång (laget ${lag0.ok} → ${lag1.ok} rätt, inget fel; ${ln} +${won[0]}, ${gn} +${won[1]})`);
  const li = won[0] ? 1 : 0, loser = li ? G : L, loserN = li ? gn : ln;
  ok((await count(loser, 'HANN FÖRE!')) > h0[li] && s1[li].fel === s0[li].fel && (await carrying(loser)) === null,
    `den som kom sist (${loserN}) ser HANN FÖRE! – inget fel, delen åkte tillbaka i hyllan`);
  ok(!!(await benchSynced(L, G)), 'lådan är likadan hos båda');
}

// 8. STARTKNAPPEN: ledaren sätter i resten, medarbetaren trycker på start – datorn blir klar hos båda,
// datorbonusen är hennes och nästa order kommer upp
{
  await D(L, "(D.pick('ssd1'), D.install(), D.pick('psu7'), D.install(), D.tool('kylare'))");
  const full = await benchSynced(L, G);
  ok(!!full && full.box.ssd && full.box.psu && full.box.kylare, `${gn} ser att allt sitter i (${JSON.stringify(full?.box)})`);
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), nr: full?.order.nr, kL: await count(L, 'FÄRDIG DATOR!'), kG: await count(G, 'FÄRDIG DATOR!') };
  await act(G, 'start');
  const fans = await until(async () => (await st(L))?.power, 4000, 100);
  ok(!!fans, `${gn} trycker på startknappen – fläktarna går igång hos ledaren`);
  const sG = await until(async () => { const s = await stats(G); return s && s.boxes === before.g.boxes + 1 ? s : null; }, 8000, 200);
  ok(!!sG && (await stats(L)).boxes === before.l.boxes, `datorbonusen är ${gn}s – hon tryckte på start (datorer ${before.g.boxes} → ${sG?.boxes}; ${ln}: ${before.l.boxes})`);
  const lagB = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.boxes === before.lag.boxes + 1 && g.boxes === l.boxes ? l : null; }, 6000, 200);
  ok(!!lagB, `laget har en färdig dator till hos båda (${before.lag.boxes} → ${lagB?.boxes})`);
  const next = await until(async () => { const s = await st(L); return s && s.order.nr === before.nr + 1 ? s : null; }, 8000, 200);
  const nextG = await benchSynced(L, G);
  ok(!!next && !!nextG && nextG.order.nr === before.nr + 1 && !nextG.box.cpu && !nextG.box.pasta, `kollegan bär iväg datorn – ny order nr ${nextG?.order.nr} (${nextG?.order.name}) i en tom låda hos båda`);
  const kl = await until(async () => (await count(L, 'FÄRDIG DATOR!')) > before.kL && (await count(G, 'FÄRDIG DATOR!')) > before.kG, 4000, 200);
  ok(!!kl, 'FÄRDIG DATOR! syns hos båda');
}

// 9. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.boxes === g.boxes ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.boxes} datorer hos båda`);
  await snap(L, 'dator-ihop-ledaren');
}

// 10. LEDARBYTE: ledaren går med minne i handen – medarbetaren tar över inom sekunder, delen åker
// tillbaka, lådan och ordern är kvar och nästa order får ett nummer över allt som synts
{
  const no = await D(L, 'D.setOrder(0)');   // KONTOR: PX3, 8 GB, inget grafikkort, 500 GB, 450 W
  await D(L, "(D.pick('cpu3'), D.install())");
  await act(L, 'ram8');
  const seesHold = await until(async () => ((await held(G)) || {})[lId] === 'ram8', 6000, 200);
  ok(!!seesHold, `${gn} ser ${ln} bära 8 GB när ${ln} går`);
  const oBefore = await benchSynced(L, G);
  const maxNr = Math.max(no, oBefore?.order.nr || 0);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const back = await until(async () => !((await held(G)) || { [lId]: 1 })[lId], 8000, 250);
  ok(!!back, `delen ${ln} bar åker tillbaka i hyllan – ingen bär den längre`);
  const oAfter = await st(G);
  ok(!!oBefore && sameBench(oBefore, oAfter), `lådan och ordern är kvar hos den nya ledaren (nr ${oAfter?.order.nr}, ${oAfter?.order.name}, PX3 i)`);
  // den nya ledaren bygger klart och trycker på start: nästa order får nytt nummer
  await D(G, "(['ram8', 'ssd5', 'psu4'].forEach((id) => { D.pick(id); D.install(); }), D.tool('pasta'), D.tool('kylare'), D.power())");
  const fresh = await until(async () => { const s = await st(G); return s && s.order.nr > maxNr ? s : null; }, 10000, 250);
  ok(!!fresh && fresh.order.nr === maxNr + 1, `datorn blir klar hos den nya ledaren – nästa order får NYTT nummer (${fresh?.order.nr} > ${maxNr})`);
  const forced = await D(G, 'D.setOrder(3)');
  ok(forced > fresh?.order.nr, `inga nummerkrockar (nästa order nr ${forced})`);
}

// 11. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt, fel och färdiga datorer lika
{
  const lg = await lag(G);
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lg.ok} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lg.ok} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
  const rows = await G.evaluate(() => [...document.querySelectorAll('#modal div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()));
  const num = (re) => +(((rows.find((r) => re.test(r)) || '').match(new RegExp(re.source + '\\s*(\\d+)')) || [])[1] ?? -1);
  const ratt = num(/^✅ Rätt/), fel = num(/^❌ Fel/), datorer = num(/^🖥️ Färdiga datorer/);
  ok(ratt === Math.round(lg.ok / 2) && fel === Math.round(lg.fel / 2), `rätt- och fel-raderna är halva lagets (${ratt} av ${lg.ok}, ${fel} av ${lg.fel})`);
  ok(lg.boxes >= 2 && datorer === Math.round(lg.boxes / 2), `färdiga datorer delas också lika (${datorer} av lagets ${lg.boxes})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
