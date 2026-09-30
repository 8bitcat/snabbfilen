// JOBBA TILLSAMMANS i Fruktfabriken: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna band – och ensam går allt som
// förut: rätt frukt ger poäng, fel frukt avdrag, full låda en färdig låda); Kalle bjuder in Julia via
// startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra, exakt
// EN skiftledare, rubriken blir FRUKTFABRIKEN IHOP och bandet går lite fortare; ledarens band (samma
// frukter, rullar hos medarbetaren också) och låda (ordersedeln och det som ligger i) syns hos
// medarbetaren, och det ledaren bär syns också; medarbetaren tar en frukt från bandet (den försvinner
// EN gång, hos ledaren – som vet att hen bär den) och lägger den i lådan – och det är MEDARBETAREN som
// får poängen; fel frukt är medarbetarens fel; ett låd-önskemål som kommer två gånger räknas en gång;
// sträcker sig båda efter samma frukt får bara en den (den andra ser HANN FÖRE!); lägger medarbetaren i
// SISTA frukten är lådan klar hos båda och lådbonusen hennes; lagets räkning är synkad; ledarbyte utan
// id-krockar – frukten den gamla ledaren bar läggs tillbaka på bandet, bandet rullar vidare och lådan
// är kvar; lönebeskedet delar rätt, fel och färdiga lådor lika.
// (Fruktfabriken står inte i COOP_JOBS förrän den släpps – provet slår på den i båda sidorna.)
//   node tools/coop-frukt-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8825)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tfrukt' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: fabriken går; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { frukt: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'frukt' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => m.COOP_JOBS.add('frukt')));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'frukt', 'jobbfrukt'); });
// ställ fruktplockaren där klicket leder och klicka (scenens down(x, y), som ett riktigt klick):
// 'band:<id>' 'lada'
const readyAt = (p, where) => p.evaluate((w) => { const D2 = SF.scene._debug; const s = D2.standAt(w); if (!s) return false; D2.teleport(s[0], s[1]); return true; }, where);
const clickSpot = (p, where) => p.evaluate((w) => { const s = SF.scene._debug.spot(w); if (!s) return false; SF.scene.down(s[0], s[1]); return true; }, where);
const act = async (p, where) => (await readyAt(p, where)) && clickSpot(p, where);
const idle = (p) => D(p, 'D.idle()');
const belt = (p) => D(p, 'D.items()');
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const order = (p) => D(p, 'D.order()');
const carrying = (p) => D(p, 'D.carrying()');
const count = async (p, txt) => ((await D(p, 'D.pops()')) || []).filter((s) => s === txt).length;
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 150);
const onBelt = (p, id) => until(async () => ((await belt(p)) || []).some((x) => x.id === id), 6000, 150);
const offBelt = (p, id) => until(async () => !((await belt(p)) || [{ id }]).some((x) => x.id === id), 5000, 150);
const sameBox = (a, b) => a && b && a.no === b.no && JSON.stringify(a.need) === JSON.stringify(b.need) && a.packed.join() === b.packed.join();
const boxSynced = (a, b) => until(async () => { const oa = await order(a), ob = await order(b); return sameBox(oa, ob) ? oa : null; }, 6000, 200);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };
const FR = ['äpple', 'banan', 'apelsin', 'päron', 'druvor'];

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia packar frukt på sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbfrukt', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen i Fruktfabriken erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbfrukt' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i packhallen (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const bSoloA = await belt(A), bSoloB = await belt(B);
ok(bSoloA?.length === 0 && bSoloB?.length > 0, `egna band: Kalle tömmer sitt – Julias frukter rullar vidare (${bSoloA?.length}/${bSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'FRUKTFABRIKEN' && (await D(B, 'D.title()')) === 'FRUKTFABRIKEN', 'ensam heter passet bara FRUKTFABRIKEN');
{
  // precis som smoke.mjs: rätt frukt i handen och ner i lådan
  const sb = await D(B, '(D.setCarry(Math.max(0, D.needFruit())), D.forceDrop())');
  const sa = await D(A, '(D.setCarry(D.wrongFruit()), D.forceDrop())');
  const sp = await D(A, 'D.speed()');
  ok(sb?.ok === 1 && sb.fel === 0 && sa?.fel === 1 && sa.ok === 0 && (await lag(A)).maxN === 1 && Math.abs(sp.v - sp.solo) < 0.01,
    `ensam går allt som förut: rätt frukt = poäng (Julia ok ${sb?.ok}), fel frukt = avdrag (Kalle fel ${sa?.fel}), bandet i vanlig fart (${sp?.v})`);
  // Kalle fyller hela lådan själv: en färdig låda, ny ordersedel
  const o0 = await order(A);
  const fill = await D(A, '(() => { const no = D.order().no; let n = 0; while (D.order().no === no && n < 20) { D.setCarry(D.needFruit()); D.forceDrop(); n++; } return n; })()');
  const o1 = await order(A), s1 = await stats(A);
  ok(s1.boxes === 1 && s1.ok === fill && o1.no === o0.no + 1 && o1.packed.length === 0 && (await count(A, 'LÅDA KLAR! +20')) === 1,
    `ensam: ${fill} rätt frukter fyller lådan – 1 färdig låda (${s1.boxes}), ny order nr ${o1.no}, tom låda`);
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
await A.waitForFunction(() => SF.sceneName === 'jobbfrukt' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Fruktfabriken/.test(inv1 || ''), `Julia får inbjudan till Fruktfabriken (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbfrukt' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i packhallen (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'FRUKTFABRIKEN IHOP' && (await D(G, 'D.title()')) === 'FRUKTFABRIKEN IHOP', 'rubriken är FRUKTFABRIKEN IHOP hos båda');

// 2. ledarens band syns hos medarbetaren – samma frukter, och de rullar (lite fortare ihop)
{
  await D(L, 'D.calm()');
  const empty = await until(async () => { const b = await belt(G); return b && b.length === 0 ? 1 : null; }, 6000, 300);
  ok(!!empty, `${gn} ser att bandet töms hos ledaren`);
  const sp = await D(L, 'D.speed()');
  const spG = await until(async () => { const s = await D(G, 'D.speed()'); return s && Math.abs(s.v - sp.v) < 0.6 ? s : null; }, 4000, 200);
  ok(Math.abs(sp.v - sp.solo * 1.1) < 0.2 && !!spG, `ihop går bandet 10 % fortare (${sp.solo} → ${sp.v} px/s) – hos ${gn} i ledarens fart (${spG?.v})`);
  const f1 = await D(L, 'D.forceFruit(0, 60)');
  const f2 = await D(L, 'D.forceFruit(2, 130)');
  const seesBelt = await until(async () => {
    const b = await belt(G); if (!b) return null;
    const a1 = b.find((x) => x.id === f1.id), a2 = b.find((x) => x.id === f2.id);
    return a1 && a2 && a1.f === 0 && a2.f === 2 ? b : null;
  }, 6000, 200);
  ok(!!seesBelt, `${gn} ser ledarens frukter på bandet (id ${f1?.id} ${FR[0]}, ${f2?.id} ${FR[2]})`);
  const [bl, bg] = await Promise.all([belt(L), belt(G)]);
  const dx = [f1, f2].map((i) => Math.abs((bl.find((x) => x.id === i.id)?.x ?? -99) - (bg.find((x) => x.id === i.id)?.x ?? 99)));
  ok(dx.every((d) => d <= 10), `frukterna ligger på samma ställe hos båda (skillnad ${dx.join(' / ')} px)`);
  const gx1 = (await belt(G)).find((x) => x.id === f1.id)?.x;
  await wait(1200);
  const gx2 = (await belt(G)).find((x) => x.id === f1.id)?.x;
  ok(gx2 > gx1 + 8, `bandet rullar hos ${gn} också (x ${gx1} → ${gx2})`);

  // 3. lådan är gemensam: samma ordersedel och samma frukter i – och det ledaren bär syns hos medarbetaren
  const no = await D(L, 'D.setOrder([[0, 3], [1, 3], [2, 2]])');
  const o3 = await boxSynced(L, G);
  ok(!!o3 && o3.no === no && o3.left === 8, `${gn} ser samma ordersedel (nr ${o3?.no}: 3 ${FR[0]}, 3 ${FR[1]}, 2 ${FR[2]})`);
  const okL0 = (await stats(L)).ok;
  await D(L, `D.pickId(${f1.id})`);
  const lHolds = await until(async () => ((await D(G, 'D.held()')) || {})[lId] === f1.id, 5000, 200);
  ok((await carrying(L))?.id === f1.id && !!lHolds, `${ln} tar frukten ${f1.id} – ${gn} ser den i ${ln}s hand`);
  await D(L, 'D.boxAct()');
  const inBox = await until(async () => { const o = await order(G); return o && o.packed.length === 1 && o.need[0][2] === 1 ? o : null; }, 6000, 200);
  ok(!!inBox && (await stats(L)).ok === okL0 + 1, `${ln} lägger den i lådan – den ligger där hos ${gn} också (${FR[0]} 1/3)`);
  const noHold = await until(async () => !((await D(G, 'D.held()')) || { [lId]: 1 })[lId], 4000, 200);
  ok(!!noHold, `${ln}s hand är tom hos ${gn} också`);
  await D(L, `D.pickId(${f2.id})`);
  await D(L, 'D.boxAct()');
  ok(!!(await boxSynced(L, G)), 'lådan är likadan hos båda (sedeln och frukterna i)');
  await snap(G, 'frukt-ihop-medarbetaren');
}

// 4. medarbetarens handling ändrar ledarens värld: tar en frukt från bandet (klick)
let mine = null;
{
  const f3 = await D(L, 'D.forceFruit(1, 40)');
  mine = f3;
  await onBelt(G, f3.id);
  await act(G, `band:${f3.id}`);
  const tookG = await until(async () => { const c = await carrying(G); return c && c.id === f3.id ? c : null; }, 8000, 200);
  ok(!!tookG, `${gn} klickar på frukten och tar den från bandet via ledaren (id ${f3.id}, ${FR[1]})`);
  const bL = await belt(L), cL = await carrying(L), hL = await D(L, 'D.held()');
  ok(bL && !bL.some((x) => x.id === f3.id) && cL === null, `den är borta från bandet hos ledaren – togs EN gång (${ln} bär ingenting)`);
  ok(hL?.[gId] === f3.id, `ledaren vet att ${gn} bär frukt ${f3.id} (${JSON.stringify(hL)})`);
  ok(!!(await offBelt(G, f3.id)), `${gn}s band visar samma`);
}

// 5. ... och lägger den i lådan (klick) → poängen är medarbetarens
{
  const before = { l: await stats(L), g: await stats(G), lag: await lag(L), o: await order(L) };
  await act(G, 'lada');
  const inBox = await until(async () => { const o = await order(L); return o && o.packed.length === before.o.packed.length + 1 && o.need[1][2] === before.o.need[1][2] + 1 ? o : null; }, 8000, 200);
  ok(!!inBox, `${gn}s ${FR[1]} ligger i lådan hos ledaren (${FR[1]} ${inBox?.need[1][2]}/3)`);
  const sG = await until(async () => { const s = await stats(G); return s && s.ok === before.g.ok + 1 ? s : null; }, 6000, 200);
  ok(!!sG, `${gn} FÅR POÄNGEN för frukten (ok ${before.g.ok} → ${sG?.ok})`);
  ok((await stats(L)).ok === before.l.ok, `ledaren fick INTE poängen (${ln}: ok ${before.l.ok})`);
  ok((await carrying(G)) === null && !((await D(L, 'D.held()')) || {})[gId], `${gn}s hand är tom – också i ledarens bok`);
  const lag5 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === before.lag.ok + 1 && g.ok === l.ok ? l : null; }, 6000, 200);
  ok(!!lag5, `lagets räkning är synkad (${lag5 ? lag5.ok : '?'} rätt hos båda)`);
  ok(!!(await boxSynced(L, G)), `${gn} ser den i lådan också`);
}

// 6. fel frukt: felet är medarbetarens (och lagets) – FEL FRUKT! syns hos båda, lådan är orörd
{
  const f = await D(L, 'D.forceFruit(3, 50)');
  await onBelt(G, f.id);
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), pl: await count(L, 'FEL FRUKT!'), o: await order(L) };
  await D(G, `D.pickId(${f.id})`);
  await until(async () => (await carrying(G))?.id === f.id, 6000, 200);
  await act(G, 'lada');
  const sG = await until(async () => { const s = await stats(G); return s && s.fel === before.g.fel + 1 ? s : null; }, 6000, 200);
  const felSync = await until(async () => { const l = await lag(L), g = await lag(G); return l.fel === before.lag.fel + 1 && g.fel === l.fel ? l : null; }, 5000, 200);
  const oAfter = await order(L);
  ok(!!sG && !!felSync && (await stats(L)).fel === before.l.fel && (await count(L, 'FEL FRUKT!')) > before.pl && oAfter.packed.length === before.o.packed.length,
    `${gn} lägger ett ${FR[3]} i lådan: FEL är ${gn}s (fel ${sG?.fel}), i laget (${felSync?.fel}) – ${ln} ser FEL FRUKT!, lådan orörd`);
}

// 7. ett låd-önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  const f = await D(L, 'D.forceFruit(2, 50)');
  await onBelt(G, f.id);
  await D(G, `D.pickId(${f.id})`);
  await until(async () => (await carrying(G))?.id === f.id, 6000, 200);
  const before = { lag: (await lag(L)).ok, g: (await stats(G)).ok, n: (await order(L)).packed.length };
  const sent = await D(G, 'D.dropTwice()');
  await until(async () => await idle(G), 6000, 200);
  await wait(1200);
  const after = { lag: (await lag(L)).ok, g: (await stats(G)).ok, n: (await order(L)).packed.length };
  ok(sent && after.n === before.n + 1 && after.lag === before.lag + 1 && after.g === before.g + 1,
    `samma önskemål två gånger: EN frukt i lådan (${before.n} → ${after.n}), EN poäng (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g})`);
}

// 8. samtidigt: SAMMA frukt – bara en får den, den andra ser HANN FÖRE!
{
  const r = await D(L, 'D.forceFruit(0, 70)');
  await onBelt(G, r.id);
  await bothIdle(L, G);
  const h0 = [await count(L, 'HANN FÖRE!'), await count(G, 'HANN FÖRE!')];
  const lag0 = (await lag(L)).ok;
  await Promise.all([L, G].map((p) => D(p, `D.pickId(${r.id})`)));
  await bothIdle(L, G);
  await wait(800);
  const cL = await carrying(L), cG = await carrying(G);
  ok(((cL?.id === r.id) + (cG?.id === r.id)) === 1 && !((await belt(L)) || []).some((x) => x.id === r.id),
    `båda sträcker sig efter samma frukt – bara EN får den (${ln}: ${cL?.id ?? '-'}, ${gn}: ${cG?.id ?? '-'})`);
  const winner = cL?.id === r.id ? L : G, loser = winner === L ? G : L, loserN = loser === G ? gn : ln;
  ok((await count(loser, 'HANN FÖRE!')) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  ok(!!(await offBelt(G, r.id)), 'frukten är borta från bandet hos båda – ingen dubblett');
  const w0 = (await stats(winner)).ok;
  await D(winner, 'D.boxAct()');
  const once = await until(async () => { const l = await lag(L), g = await lag(G); return l.ok === lag0 + 1 && g.ok === l.ok ? l : null; }, 6000, 200);
  await wait(600);
  ok(!!once && (await lag(L)).ok === lag0 + 1 && (await stats(winner)).ok === w0 + 1, `den räknas EN gång när den packas (laget ${lag0} → ${once?.ok})`);
}

// 9. LÅDAN KLAR: ledaren fyller på tills EN frukt fattas – medarbetaren lägger i den sista, lådan är
// klar hos båda och lådbonusen är hennes (laget har en färdig låda till)
{
  const filled = await D(L, '(() => { let n = 0; while (D.order().left > 1 && n < 20) { D.setCarry(D.needFruit()); D.forceDrop(); n++; } return D.order().left; })()');
  const need = await D(L, 'D.needFruit()');
  const f = await D(L, `D.forceFruit(${need}, 60)`);
  await onBelt(G, f.id);
  await boxSynced(L, G);
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), o: await order(L), kL: await count(L, 'LÅDA KLAR! +20'), kG: await count(G, 'LÅDA KLAR! +20') };
  await D(G, `D.pickId(${f.id})`);
  await until(async () => (await carrying(G))?.id === f.id, 6000, 200);
  await act(G, 'lada');
  const newOrder = await until(async () => { const o = await order(L); return o && o.no === before.o.no + 1 ? o : null; }, 8000, 200);
  ok(filled === 1 && !!newOrder && newOrder.packed.length === 0 && newOrder.left > 0,
    `${gn} lägger i sista frukten (${FR[need]}) – lådan är klar och ${ln} sätter upp order nr ${newOrder?.no} (tom låda)`);
  const sG = await until(async () => { const s = await stats(G); return s && s.boxes === before.g.boxes + 1 && s.ok === before.g.ok + 1 ? s : null; }, 6000, 200);
  ok(!!sG && (await stats(L)).boxes === before.l.boxes, `lådbonusen är ${gn}s – hon lade i sista frukten (lådor ${before.g.boxes} → ${sG?.boxes}; ${ln}: ${before.l.boxes})`);
  const lagB = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.boxes === before.lag.boxes + 1 && g.boxes === l.boxes ? l : null; }, 6000, 200);
  ok(!!lagB, `laget har en färdig låda till hos båda (${before.lag.boxes} → ${lagB?.boxes})`);
  ok(!!(await boxSynced(L, G)), `${gn} ser den nya ordersedeln och den tomma lådan`);
  const kl = await until(async () => (await count(L, 'LÅDA KLAR! +20')) > before.kL && (await count(G, 'LÅDA KLAR! +20')) > before.kG, 4000, 200);
  ok(!!kl, 'LÅDA KLAR! syns hos båda');
}

// 10. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss && l.boxes === g.boxes ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade, ${same?.boxes} lådor hos båda`);
  await snap(L, 'frukt-ihop-ledaren');
}

// 11. LEDARBYTE: ledaren går med en frukt i handen – medarbetaren tar över inom sekunder, frukten
// läggs tillbaka på bandet, bandet rullar vidare, lådan är kvar och nya frukter krockar inte med gamla id:n
{
  const kept = await D(L, 'D.forceFruit(3, 40)');
  const hold = await D(L, 'D.forceFruit(1, 160)');
  await D(L, `D.pickId(${hold.id})`);
  const seesHold = await until(async () => ((await D(G, 'D.held()')) || {})[lId] === hold.id && ((await belt(G)) || []).some((x) => x.id === kept.id), 6000, 200);
  ok(!!seesHold, `${gn} ser ${ln} bära frukt ${hold.id} när ${ln} går`);
  const oBefore = await boxSynced(L, G);
  const seenIds = [...((await belt(G)) || []).map((x) => x.id), ...Object.values((await D(G, 'D.held()')) || {})];
  const maxId = Math.max(kept.id, hold.id, ...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const back = await until(async () => ((await belt(G)) || []).find((x) => x.id === hold.id) || null, 8000, 250);
  ok(!!back && !((await D(G, 'D.held()')) || {})[lId], `frukten ${ln} bar läggs tillbaka på bandet (id ${hold.id}, x ${back?.x}) – ingen bär den längre`);
  const x1 = ((await belt(G)) || []).find((x) => x.id === kept.id)?.x;
  await wait(1500);
  const x2 = ((await belt(G)) || []).find((x) => x.id === kept.id)?.x;
  ok(x1 !== undefined && x2 > x1 + 10, `bandet rullar vidare hos den nya ledaren (x ${x1} → ${x2})`);
  const oAfter = await order(G);
  ok(!!oBefore && sameBox(oBefore, oAfter), `lådan och ordersedeln är kvar hos den nya ledaren (nr ${oAfter?.no}, ${oAfter?.packed.length} i lådan)`);
  const fresh = await until(async () => ((await belt(G)) || []).find((x) => x.id > maxId) || null, 12000, 300);
  ok(!!fresh, `nya frukter kommer ut ur vaskaren hos den nya ledaren – NYTT id (${fresh?.id} > ${maxId})`);
  const forced = await D(G, 'D.forceFruit(2, 200)');
  const ids = ((await belt(G)) || []).map((x) => x.id);
  ok(forced.id > maxId && new Set(ids).size === ids.length, `inga id-krockar (bandet: ${ids.join(', ')}; ny frukt ${forced.id})`);
}

// 12. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt, fel och färdiga lådor lika
{
  await D(G, 'D.calm()');
  const lg = await lag(G);
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lg.ok} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lg.ok} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
  const rows = await G.evaluate(() => [...document.querySelectorAll('#modal div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()));
  const num = (re) => +(((rows.find((r) => re.test(r)) || '').match(new RegExp(re.source + '\\s*(\\d+)')) || [])[1] ?? -1);
  const ratt = num(/^✅ Rätt/), fel = num(/^❌ Fel/), lador = num(/^📦 Färdiga lådor/);
  ok(ratt === Math.round(lg.ok / 2) && fel === Math.round(lg.fel / 2), `rätt- och fel-raderna är halva lagets (${ratt} av ${lg.ok}, ${fel} av ${lg.fel})`);
  ok(lg.boxes >= 1 && lador === Math.round(lg.boxes / 2), `färdiga lådor delas också lika (${lador} av lagets ${lg.boxes})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
