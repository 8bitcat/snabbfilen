// JOBBA TILLSAMMANS på Flygplatsen (bagaget): två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna band – och ensam går allt som
// förut: rätt vagn ger poäng, fel vagn avdrag); Kalle bjuder in Julia via startdialogens 💼 Jobba ihop →
// 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra, exakt EN skiftledare, rubriken blir
// FLYGPLATSEN IHOP och bandet går lite fortare; ledarens band (samma väskor, rullar hos medarbetaren
// också) och vagnar syns hos medarbetaren, och det ledaren bär syns också; medarbetaren tar en väska
// från bandet (den försvinner EN gång, hos ledaren – som vet att hen bär den) och lastar den i rätt vagn
// – och det är MEDARBETAREN som får poängen; fel vagn är medarbetarens fel; ett vagn-önskemål som kommer
// två gånger räknas en gång; sträcker sig båda efter samma väska får bara en den (den andra ser HANN
// FÖRE!); lagets räkning är synkad; ledarbyte utan id-krockar – väskan den gamla ledaren bar läggs
// tillbaka på bandet och bandet rullar vidare; lönebeskedet delar lika.
// (Flygplatsen står inte i COOP_JOBS förrän den släpps – provet slår på den i båda sidorna.)
//   node tools/coop-flyg-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8823)
//   SNAP_DIR=<mapp> sparar skärmbilder av båda sidorna mitt i det gemensamma passet.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'tflyg' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: bagaget går; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { flygplats: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'flygplats' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => m.COOP_JOBS.add('flygplats')));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'flygplats', 'jobbflyg'); });
// ställ bagagearbetaren där klicket leder och klicka (scenens down(x, y), som ett riktigt klick):
// 'band:<id>' 'vagn:<0-3>'
const readyAt = (p, where) => p.evaluate((w) => { const D2 = SF.scene._debug; const s = D2.standAt(w); if (!s) return false; D2.teleport(s[0], s[1]); return true; }, where);
const clickSpot = (p, where) => p.evaluate((w) => { const s = SF.scene._debug.spot(w); if (!s) return false; SF.scene.down(s[0], s[1]); return true; }, where);
const act = async (p, where) => (await readyAt(p, where)) && clickSpot(p, where);
const idle = (p) => D(p, 'D.idle()');
const belt = (p) => D(p, 'D.items()');
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const carts = (p) => D(p, 'D.carts()');
const carrying = (p) => D(p, 'D.carrying()');
const count = async (p, txt) => ((await D(p, 'D.pops()')) || []).filter((s) => s === txt).length;
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 150);
const onBelt = (p, id) => until(async () => ((await belt(p)) || []).some((x) => x.id === id), 6000, 150);
const offBelt = (p, id) => until(async () => !((await belt(p)) || [{ id }]).some((x) => x.id === id), 5000, 150);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia bär väskor på sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbflyg', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på Flygplatsen erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbflyg' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i bagagehallen (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const bSoloA = await belt(A), bSoloB = await belt(B);
ok(bSoloA?.length === 0 && bSoloB?.length > 0, `egna band: Kalle tömmer sitt – Julias väskor rullar vidare (${bSoloA?.length}/${bSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'FLYGPLATSEN' && (await D(B, 'D.title()')) === 'FLYGPLATSEN', 'ensam heter passet bara FLYGPLATSEN');
{
  const sb = await D(B, 'D.forcePick() ? D.forceDrop(true) : null');
  await D(A, 'D.forceBag(2, 100)');
  const sa = await D(A, 'D.forcePick() ? D.forceDrop(false) : null');
  const sp = await D(A, 'D.speed()');
  ok(sb?.ok === 1 && sb.fel === 0 && sa?.fel === 1 && sa.ok === 0 && (await lag(A)).maxN === 1 && Math.abs(sp.v - sp.solo) < 0.01,
    `ensam går allt som förut: rätt vagn = poäng (Julia ok ${sb?.ok}), fel vagn = avdrag (Kalle fel ${sa?.fel}), bandet i vanlig fart (${sp?.v})`);
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
await A.waitForFunction(() => SF.sceneName === 'jobbflyg' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Flygplatsen/.test(inv1 || ''), `Julia får inbjudan till Flygplatsen (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbflyg' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i bagagehallen (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const gId = (await D(G, 'D.coop()'))?.myId, lId = (await D(L, 'D.coop()'))?.myId;
const lagN = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'FLYGPLATSEN IHOP' && (await D(G, 'D.title()')) === 'FLYGPLATSEN IHOP', 'rubriken är FLYGPLATSEN IHOP hos båda');

// 2. ledarens band syns hos medarbetaren – samma väskor, och de rullar (lite fortare ihop)
{
  await D(L, 'D.calm()');
  const empty = await until(async () => { const b = await belt(G); return b && b.length === 0 ? 1 : null; }, 6000, 300);
  ok(!!empty, `${gn} ser att bandet töms hos ledaren`);
  const sp = await D(L, 'D.speed()');
  const spG = await until(async () => { const s = await D(G, 'D.speed()'); return s && Math.abs(s.v - sp.v) < 0.6 ? s : null; }, 4000, 200);
  ok(Math.abs(sp.v - sp.solo * 1.1) < 0.2 && !!spG, `ihop går bandet 10 % fortare (${sp.solo} → ${sp.v} px/s) – hos ${gn} i ledarens fart (${spG?.v})`);
  const b1 = await D(L, 'D.forceBag(0, 60)');
  const b2 = await D(L, 'D.forceBag(2, 130)');
  const seesBelt = await until(async () => {
    const b = await belt(G); if (!b) return null;
    const a1 = b.find((x) => x.id === b1.id), a2 = b.find((x) => x.id === b2.id);
    return a1 && a2 && a1.cat === 0 && a2.cat === 2 ? b : null;
  }, 6000, 200);
  ok(!!seesBelt, `${gn} ser ledarens väskor på bandet (id ${b1?.id} till A, ${b2?.id} till C)`);
  const [bl, bg] = await Promise.all([belt(L), belt(G)]);
  const dx = [b1, b2].map((i) => Math.abs((bl.find((x) => x.id === i.id)?.x ?? -99) - (bg.find((x) => x.id === i.id)?.x ?? 99)));
  ok(dx.every((d) => d <= 10), `väskorna ligger på samma ställe hos båda (skillnad ${dx.join(' / ')} px)`);
  const gx1 = (await belt(G)).find((x) => x.id === b1.id)?.x;
  await wait(1200);
  const gx2 = (await belt(G)).find((x) => x.id === b1.id)?.x;
  ok(gx2 > gx1 + 8, `bandet rullar hos ${gn} också (x ${gx1} → ${gx2})`);

  // 3. vagnarna är gemensamma – och det ledaren bär syns hos medarbetaren
  const okL0 = (await stats(L)).ok;
  await D(L, `D.pickId(${b1.id})`);
  const lHolds = await until(async () => ((await D(G, 'D.held()')) || {})[lId] === b1.id, 5000, 200);
  ok((await carrying(L))?.id === b1.id && !!lHolds, `${ln} tar väskan ${b1.id} – ${gn} ser den i ${ln}s famn`);
  await D(L, 'D.cartAct(0)');
  const cartSeen = await until(async () => ((await carts(G)) || [])[0]?.includes(b1.id), 6000, 200);
  ok(!!cartSeen && (await stats(L)).ok === okL0 + 1, `${ln} lastar den i vagn A (LONDON) – den ligger där hos ${gn} också`);
  const noHold = await until(async () => !((await D(G, 'D.held()')) || { [lId]: 1 })[lId], 4000, 200);
  ok(!!noHold, `${ln}s famn är tom hos ${gn} också`);
  await D(L, `D.pickId(${b2.id})`);
  await D(L, 'D.cartAct(2)');
  await snap(G, 'flyg-ihop-medarbetaren');
}

// 4. medarbetarens handling ändrar ledarens värld: tar en väska från bandet (klick)
let mine = null;
{
  const b3 = await D(L, 'D.forceBag(1, 40)');
  mine = b3;
  await onBelt(G, b3.id);
  await act(G, `band:${b3.id}`);
  const tookG = await until(async () => { const c = await carrying(G); return c && c.id === b3.id ? c : null; }, 8000, 200);
  ok(!!tookG, `${gn} klickar på väskan och tar den från bandet via ledaren (id ${b3.id}, till B)`);
  const bL = await belt(L), cL = await carrying(L), hL = await D(L, 'D.held()');
  ok(bL && !bL.some((x) => x.id === b3.id) && cL === null, `den är borta från bandet hos ledaren – togs EN gång (${ln} bär ingenting)`);
  ok(hL?.[gId] === b3.id, `ledaren vet att ${gn} bär väska ${b3.id} (${JSON.stringify(hL)})`);
  ok(!!(await offBelt(G, b3.id)), `${gn}s band visar samma`);
}

// 5. ... och lastar den i rätt vagn (klick) → poängen är medarbetarens
{
  const before = { l: await stats(L), g: await stats(G), lag: await lag(L) };
  await act(G, 'vagn:1');
  const inCart = await until(async () => ((await carts(L)) || [])[1]?.includes(mine.id), 8000, 200);
  ok(!!inCart, `${gn}s väska ligger i vagn B (OSLO) hos ledaren`);
  const sG = await until(async () => { const s = await stats(G); return s && s.ok === before.g.ok + 1 ? s : null; }, 6000, 200);
  ok(!!sG, `${gn} FÅR POÄNGEN för väskan (ok ${before.g.ok} → ${sG?.ok})`);
  ok((await stats(L)).ok === before.l.ok, `ledaren fick INTE poängen (${ln}: ok ${before.l.ok})`);
  ok((await carrying(G)) === null && !((await D(L, 'D.held()')) || {})[gId], `${gn}s famn är tom – också i ledarens bok`);
  const lag5 = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === before.lag.ok + 1 && g.ok === l.ok ? l : null; }, 6000, 200);
  ok(!!lag5, `lagets räkning är synkad (${lag5 ? lag5.ok : '?'} rätt hos båda)`);
  ok(!!(await until(async () => ((await carts(G)) || [])[1]?.includes(mine.id), 4000, 200)), `${gn} ser den i vagnen också`);
}

// 6. fel vagn: felet är medarbetarens (och lagets) – FEL VAGN! syns hos båda
{
  const b = await D(L, 'D.forceBag(3, 50)');
  await onBelt(G, b.id);
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L), pl: await count(L, 'FEL VAGN!') };
  await D(G, `D.pickId(${b.id})`);
  await until(async () => (await carrying(G))?.id === b.id, 6000, 200);
  await act(G, 'vagn:0');
  const sG = await until(async () => { const s = await stats(G); return s && s.fel === before.g.fel + 1 ? s : null; }, 6000, 200);
  const felSync = await until(async () => { const l = await lag(L), g = await lag(G); return l.fel === before.lag.fel + 1 && g.fel === l.fel ? l : null; }, 5000, 200);
  ok(!!sG && !!felSync && (await stats(L)).fel === before.l.fel && (await count(L, 'FEL VAGN!')) > before.pl,
    `${gn} lastar en väska till ROM i vagn A: FEL är ${gn}s (fel ${sG?.fel}), i laget (${felSync?.fel}) – ${ln} ser FEL VAGN!`);
}

// 7. ett vagn-önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  const b = await D(L, 'D.forceBag(2, 50)');
  await onBelt(G, b.id);
  await D(G, `D.pickId(${b.id})`);
  await until(async () => (await carrying(G))?.id === b.id, 6000, 200);
  const before = { lag: (await lag(L)).ok, g: (await stats(G)).ok };
  const sent = await D(G, 'D.dropTwice(2)');
  await until(async () => await idle(G), 6000, 200);
  await wait(1200);
  const c2 = ((await carts(L)) || [])[2] || [];
  const after = { lag: (await lag(L)).ok, g: (await stats(G)).ok };
  ok(sent && c2.filter((x) => x === b.id).length === 1 && after.lag === before.lag + 1 && after.g === before.g + 1,
    `samma önskemål två gånger: EN gång i vagn C, EN poäng (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g})`);
}

// 8. samtidigt: SAMMA väska – bara en får den, den andra ser HANN FÖRE!
{
  const r = await D(L, 'D.forceBag(0, 70)');
  await onBelt(G, r.id);
  await bothIdle(L, G);
  const h0 = [await count(L, 'HANN FÖRE!'), await count(G, 'HANN FÖRE!')];
  const lag0 = (await lag(L)).ok;
  await Promise.all([L, G].map((p) => D(p, `D.pickId(${r.id})`)));
  await bothIdle(L, G);
  await wait(800);
  const cL = await carrying(L), cG = await carrying(G);
  ok(((cL?.id === r.id) + (cG?.id === r.id)) === 1 && !((await belt(L)) || []).some((x) => x.id === r.id),
    `båda sträcker sig efter samma väska – bara EN får den (${ln}: ${cL?.id ?? '-'}, ${gn}: ${cG?.id ?? '-'})`);
  const winner = cL?.id === r.id ? L : G, loser = winner === L ? G : L, loserN = loser === G ? gn : ln;
  ok((await count(loser, 'HANN FÖRE!')) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  ok(!!(await offBelt(G, r.id)), 'väskan är borta från bandet hos båda – ingen dubblett');
  const w0 = (await stats(winner)).ok;
  await D(winner, 'D.cartAct(0)');
  const once = await until(async () => { const l = await lag(L), g = await lag(G); return l.ok === lag0 + 1 && g.ok === l.ok ? l : null; }, 6000, 200);
  await wait(600);
  ok(!!once && (await lag(L)).ok === lag0 + 1 && (await stats(winner)).ok === w0 + 1, `den räknas EN gång när den lastas (laget ${lag0} → ${once?.ok})`);
}

// 9. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade hos båda`);
  await snap(L, 'flyg-ihop-ledaren');
}

// 10. LEDARBYTE: ledaren går med en väska i famnen – medarbetaren tar över inom sekunder, väskan
// läggs tillbaka på bandet, bandet rullar vidare och nya väskor krockar inte med gamla id:n
{
  const kept = await D(L, 'D.forceBag(3, 40)');
  const hold = await D(L, 'D.forceBag(1, 160)');
  await D(L, `D.pickId(${hold.id})`);
  const seesHold = await until(async () => ((await D(G, 'D.held()')) || {})[lId] === hold.id && ((await belt(G)) || []).some((x) => x.id === kept.id), 6000, 200);
  ok(!!seesHold, `${gn} ser ${ln} bära väska ${hold.id} när ${ln} går`);
  const seenIds = [...((await belt(G)) || []).map((x) => x.id), ...((await carts(G)) || []).flat(), ...Object.values((await D(G, 'D.held()')) || {})];
  const maxId = Math.max(kept.id, hold.id, ...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const back = await until(async () => ((await belt(G)) || []).find((x) => x.id === hold.id) || null, 8000, 250);
  ok(!!back && !((await D(G, 'D.held()')) || {})[lId], `väskan ${ln} bar läggs tillbaka på bandet (id ${hold.id}, x ${back?.x}) – ingen bär den längre`);
  const x1 = ((await belt(G)) || []).find((x) => x.id === kept.id)?.x;
  await wait(1500);
  const x2 = ((await belt(G)) || []).find((x) => x.id === kept.id)?.x;
  ok(x1 !== undefined && x2 > x1 + 10, `bandet rullar vidare hos den nya ledaren (x ${x1} → ${x2})`);
  const fresh = await until(async () => ((await belt(G)) || []).find((x) => x.id > maxId) || null, 12000, 300);
  ok(!!fresh, `nya väskor kommer ut ur luckan hos den nya ledaren – NYTT id (${fresh?.id} > ${maxId})`);
  const forced = await D(G, 'D.forceBag(2, 200)');
  const ids = [...((await belt(G)) || []).map((x) => x.id), ...((await carts(G)) || []).flat()];
  ok(forced.id > maxId && new Set(ids).size === ids.length, `inga id-krockar (bandet och vagnarna: ${ids.join(', ')}; ny väska ${forced.id})`);
}

// 11. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
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
