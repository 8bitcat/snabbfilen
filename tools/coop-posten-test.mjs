// JOBBA TILLSAMMANS på Posten: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna band); Kalle bjuder in
// Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser
// varandra, exakt EN skiftledare, rubriken blir POSTEN IHOP; ledarens rullband (samma
// försändelser, rullar hos medarbetaren också), burar, hylla och kunder syns hos medarbetaren;
// medarbetaren tar en försändelse från bandet (den försvinner EN gång, hos ledaren) och lägger
// den i rätt bur – och det är SORTERAREN som får poängen; ett bur-önskemål som kommer två gånger
// räknas en gång; medarbetaren tar ett paket från den gemensamma hyllan och lämnar ut det till
// ledarens kund (poängen är hens); medarbetarens krasch räknas i laget; sträcker sig båda efter
// samma försändelse eller samma hyllpaket får bara en det (den andra ser HANN FÖRE!); lagets
// räkning är synkad; ledarbyte utan id-krockar och bandet rullar vidare; lönebeskedet delar lika.
// (Posten står inte i COOP_JOBS förrän den släpps – provet slår på den i båda sidorna.)
//   node tools/coop-posten-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8814)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'ocoop' + Math.random().toString(36).slice(2, 8);
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
    // kl 12: Posten är öppen; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { posten: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'posten' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('posten'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'posten', 'jobbposten'); });
// ställ sorteraren där klicket leder och klicka (scenens down(x, y), som ett riktigt klick):
// 'band:<id>' 'bur:<0-4>' 'hylla:<fack>' 'kund:<id>'
const readyAt = (p, where) => p.evaluate((w) => { const D2 = SF.scene._debug; const s = D2.standAt(w); if (!s) return false; D2.teleport(s[0], s[1]); return true; }, where);
const clickSpot = (p, where) => p.evaluate((w) => { const s = SF.scene._debug.spot(w); if (!s) return false; SF.scene.down(s[0], s[1]); return true; }, where);
const act = async (p, where) => (await readyAt(p, where)) && clickSpot(p, where);
const idle = (p) => D(p, 'D.idle()');
const belt = (p) => D(p, 'D.items()');
const hann = async (p) => ((await D(p, 'D.pops()')) || []).filter((s) => s === 'HANN FÖRE!').length;

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia sorterar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbposten', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen på Posten erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbposten' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i sorteringshallen (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const bSoloA = await belt(A), bSoloB = await belt(B);
ok(bSoloA?.length === 0 && bSoloB?.length > 0, `egna band: Kalle tömmer sitt – Julias försändelser rullar vidare (${bSoloA?.length}/${bSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'POSTEN' && (await D(B, 'D.title()')) === 'POSTEN', 'ensam heter passet bara POSTEN');
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
await A.waitForFunction(() => SF.sceneName === 'jobbposten' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Posten/.test(inv1 || ''), `Julia får inbjudan till Posten (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbposten' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i sorteringshallen (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const lagN = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
ok((await D(L, 'D.title()')) === 'POSTEN IHOP' && (await D(G, 'D.title()')) === 'POSTEN IHOP', 'rubriken är POSTEN IHOP hos båda');

// provlugn hos ledaren: tomt band, ingen vid disken
await D(L, 'D.calm()');
const empty = await until(async () => { const b = await belt(G), c = await D(G, 'D.customers()'); return b && c && b.length === 0 && c.length === 0 ? 1 : null; }, 6000, 300);
ok(!!empty, `${gn} ser att bandet och disken töms hos ledaren`);

// 2. ledarens band syns hos medarbetaren – samma försändelser, och de rullar
const i1 = await D(L, "D.forceItem(1, 'paketM', 60)");
const i2 = await D(L, "D.forceItem(4, 'glas', 110)");
const seesBelt = await until(async () => {
  const b = await belt(G); if (!b) return null;
  const a1 = b.find((x) => x.id === i1.id), a2 = b.find((x) => x.id === i2.id);
  return a1 && a2 && a1.reg === 1 && a1.kind === 'paketM' && a2.reg === 4 && a2.kind === 'glas' && a2.fragile ? b : null;
}, 6000, 250);
ok(!!seesBelt, `${gn} ser ledarens försändelser på bandet (id ${i1?.id} NORR-paket, ${i2?.id} ömtåligt UTRIKES)`);
const [bl, bg] = await Promise.all([belt(L), belt(G)]);
const dx = [i1, i2].map((i) => Math.abs((bl.find((x) => x.id === i.id)?.x ?? -99) - (bg.find((x) => x.id === i.id)?.x ?? 99)));
ok(dx.every((d) => d <= 10), `försändelserna ligger på samma ställe hos båda (skillnad ${dx.join(' / ')} px)`);
const gx1 = (await belt(G)).find((x) => x.id === i1.id)?.x;
await wait(1200);
const gx2 = (await belt(G)).find((x) => x.id === i1.id)?.x;
ok(gx2 > gx1 + 8, `bandet rullar hos ${gn} också (x ${gx1} → ${gx2})`);

// 3. hyllan och burarna är gemensamma
const shSame = await until(async () => { const a = await D(L, 'D.shelf()'), b = await D(G, 'D.shelf()'); return a && b && JSON.stringify(a) === JSON.stringify(b) ? a : null; }, 5000, 300);
ok(!!shSame, `${gn} ser samma utlämningshylla (${shSame ? shSame.filter((n) => n !== null).length : '?'} paket)`);
await D(L, "D.forcePick(2, 'brev')");
const idL = (await D(L, 'D.carrying()'))?.id;
await D(L, 'D.sort(true)');
const cageSeen = await until(async () => ((await D(G, 'D.cages()')) || [])[2]?.includes(idL), 6000, 250);
ok(!!cageSeen, `ledaren sorterar ett brev i SÖDER-buren – det ligger där hos ${gn} också (id ${idL})`);
const okL0 = (await D(L, 'D.stats')).ok;

// 4. ledarens kund syns hos medarbetaren
const num1 = await D(L, 'D.forceCustomer()');
const custSeen = await until(async () => ((await D(G, 'D.customers()')) || []).find((k) => k.num === num1 && k.state === 'wait') || null, 6000, 250);
ok(!!custSeen, `${gn} ser ledarens kund vid disken (avi nr ${num1})`);

// 5. medarbetarens handling ändrar ledarens värld: tar en försändelse från bandet (klick)
const i3 = await D(L, "D.forceItem(1, 'paketS', 40)");
await until(async () => ((await belt(G)) || []).some((x) => x.id === i3.id), 6000, 200);
await act(G, `band:${i3.id}`);
const tookG = await until(async () => { const c = await D(G, 'D.carrying()'); return c && c.src === 'belt' && c.id === i3.id ? c : null; }, 8000, 250);
ok(!!tookG, `${gn} tar försändelsen från bandet via ledaren (id ${i3?.id}, NORR)`);
const bL5 = await belt(L), cL5 = await D(L, 'D.carrying()');
ok(bL5 && !bL5.some((x) => x.id === i3.id) && cL5 === null, `den är borta från bandet hos ledaren – togs EN gång (${ln} bär ingenting)`);
const goneG = await until(async () => !((await belt(G)) || [{ id: i3.id }]).some((x) => x.id === i3.id), 4000, 250);
ok(!!goneG, `${gn}s band visar samma`);

// 6. ... och lägger den i rätt bur (klick) → poängen är sorterarens
await act(G, 'bur:1');
const inCage = await until(async () => ((await D(L, 'D.cages()')) || [])[1]?.includes(i3.id), 8000, 250);
ok(!!inCage, `${gn}s försändelse ligger i NORR-buren hos ledaren`);
const sG6 = await until(async () => { const s = await D(G, 'D.stats'); return s && s.ok === 1 ? s : null; }, 6000, 250);
ok(!!sG6 && sG6.sorterat === 1, `${gn} FÅR POÄNGEN för sorteringen (ok ${sG6?.ok}, sorterat ${sG6?.sorterat})`);
const sL6 = await D(L, 'D.stats');
ok(sL6?.ok === okL0, `ledaren fick INTE poängen (${ln}: ok ${sL6?.ok})`);
ok((await D(G, 'D.carrying()')) === null, `${gn}s händer är tomma`);
const lag6 = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.ok === 2 && g.ok === 2 ? l : null; }, 6000, 250);
ok(!!lag6, `lagets räkning är synkad (${lag6 ? lag6.ok : '?'} rätt hos båda)`);
const cageG = await until(async () => ((await D(G, 'D.cages()')) || [])[1]?.includes(i3.id), 4000, 250);
ok(!!cageG, `${gn} ser den i buren också`);

// 7. ett bur-önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  const before = { lag: (await D(L, 'D.lag()')).ok, g: (await D(G, 'D.stats')).ok };
  await D(G, "D.forcePick(3, 'paketS')");
  const dupId = (await D(G, 'D.carrying()'))?.id;
  const sent = await D(G, 'D.cageTwice(3)');
  await until(async () => await idle(G), 6000, 250);
  await wait(1200);
  const c3 = ((await D(L, 'D.cages()')) || [])[3] || [];
  const after = { lag: (await D(L, 'D.lag()')).ok, g: (await D(G, 'D.stats')).ok };
  ok(sent && c3.filter((x) => x === dupId).length === 1 && after.lag === before.lag + 1 && after.g === before.g + 1,
    `samma önskemål två gånger: EN gång i ÖSTER-buren, EN poäng (lag ${before.lag} → ${after.lag}, ${gn} ${before.g} → ${after.g})`);
}

// 8. hyllan och disken: medarbetaren hämtar kundens paket (klick) och lämnar ut det (klick)
{
  const shL = await D(L, 'D.shelf()'), cell = shL.indexOf(num1);
  await until(async () => ((await D(G, 'D.shelf()')) || [])[cell] === num1, 4000, 200);
  await act(G, `hylla:${cell}`);
  const parcel = await until(async () => { const c = await D(G, 'D.carrying()'); return c && c.src === 'shelf' && c.num === num1 ? c : null; }, 8000, 250);
  ok(!!parcel, `${gn} tar paket nr ${num1} från den gemensamma hyllan (fack ${cell})`);
  ok(((await D(L, 'D.shelf()')) || [])[cell] !== num1, 'facket är tomt hos ledaren – paketet togs EN gång');
  const before = { l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok, lag: (await D(L, 'D.lag()')).ok };
  const cust = ((await D(G, 'D.customers()')) || []).find((k) => k.num === num1);
  await act(G, `kund:${cust?.id}`);
  const servedG = await until(async () => { const s = await D(G, 'D.stats'); return s && s.kunder === 1 ? s : null; }, 8000, 250);
  ok(!!servedG && servedG.ok === before.g + 1, `${gn} lämnar ut paketet och FÅR POÄNGEN (ok ${servedG?.ok}, kunder ${servedG?.kunder})`);
  ok((await D(L, 'D.stats')).ok === before.l, `ledaren fick INTE poängen (${ln}: ok ${before.l})`);
  const custL = ((await D(L, 'D.customers()')) || []).find((k) => k.id === cust?.id);
  ok(!custL || custL.state === 'take' || custL.state === 'leave', `kunden tar emot paketet hos ledaren (${custL?.state ?? 'gått'})`);
  const lag8 = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.ok === before.lag + 1 && g.ok === before.lag + 1 ? l : null; }, 6000, 250);
  ok(!!lag8, `lagets räkning synkad (${lag8?.ok ?? '?'} rätt hos båda)`);
}

// 9. medarbetarens egna fel (sprang sönder ett glas) räknas i laget
{
  const fel0 = (await D(L, 'D.lag()')).fel;
  await D(G, "D.forcePick(0, 'glas')");
  await D(G, 'D.crash()');
  const sG = await D(G, 'D.stats');
  ok(sG?.fel === 1 && sG.krasch === 1, `${gn} skakar sönder ett glas – KRASCH (fel ${sG?.fel})`);
  const felSync = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.fel === fel0 + 1 && g.fel === fel0 + 1 ? l : null; }, 6000, 250);
  ok(!!felSync, `felet räknas i lagets räkning hos båda (${felSync?.fel ?? '?'})`);
}

// 10. samtidigt: SAMMA försändelse – bara en får den, den andra ser HANN FÖRE!
{
  const r = await D(L, "D.forceItem(0, 'kuvert', 60)");
  await until(async () => ((await belt(G)) || []).some((x) => x.id === r.id), 6000, 200);
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([L, G].map((p) => D(p, `D.pickId(${r.id})`)));
  await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
  await wait(800);
  const cL = await D(L, 'D.carrying()'), cG = await D(G, 'D.carrying()');
  ok(((cL?.id === r.id) + (cG?.id === r.id)) === 1 && !((await belt(L)) || []).some((x) => x.id === r.id),
    `båda sträcker sig efter samma kuvert – bara EN får det (${ln}: ${cL?.id ?? '-'}, ${gn}: ${cG?.id ?? '-'})`);
  const loser = cL?.id === r.id ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  const goneBoth = await until(async () => !((await belt(G)) || [{ id: r.id }]).some((x) => x.id === r.id), 4000, 250);
  ok(!!goneBoth, 'kuvertet är borta från bandet hos båda – ingen dubblett');
  await D(L, 'D.drop()');
  await D(G, 'D.drop()');
}

// 11. samtidigt: SAMMA hyllpaket – bara en får det
{
  const sh = await D(L, 'D.shelf()'), cell = sh.findIndex((n) => n !== null), n = sh[cell];
  await until(async () => ((await D(G, 'D.shelf()')) || [])[cell] === n, 4000, 200);
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([L, G].map((p) => D(p, `D.shelfAct(${cell}, ${n})`)));
  await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
  await wait(800);
  const cL = await D(L, 'D.carrying()'), cG = await D(G, 'D.carrying()');
  ok(((cL?.num === n) + (cG?.num === n)) === 1 && ((await D(L, 'D.shelf()')) || [])[cell] !== n,
    `båda tar paket nr ${n} från hyllan – bara EN får det (${ln}: ${cL?.num ?? '-'}, ${gn}: ${cG?.num ?? '-'})`);
  const loser = cL?.num === n ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  await D(L, 'D.drop()');
  await D(G, 'D.drop()');
}

// 12. LEDARBYTE: ledaren lämnar – medarbetaren tar över inom sekunder, bandet rullar vidare och
// nya försändelser/kunder krockar inte med gamla id:n
{
  const kept = await D(L, "D.forceItem(2, 'paketL', 40)");
  await until(async () => ((await belt(G)) || []).some((x) => x.id === kept.id), 6000, 250);
  const seenIds = [...((await belt(G)) || []).map((x) => x.id), ...((await D(G, 'D.customers()')) || []).map((k) => k.id), ...((await D(G, 'D.cages()')) || []).flat()];
  const maxId = Math.max(i1.id, i2.id, i3.id, idL ?? -1, kept.id, ...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 400);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const x1 = ((await belt(G)) || []).find((x) => x.id === kept.id)?.x;
  await wait(1500);
  const x2 = ((await belt(G)) || []).find((x) => x.id === kept.id)?.x;
  ok(x1 !== undefined && x2 > x1 + 10, `bandet rullar vidare hos den nya ledaren (x ${x1} → ${x2})`);
  const fresh = await until(async () => ((await belt(G)) || []).find((x) => x.id > maxId) || null, 12000, 300);
  ok(!!fresh, `kollegan i bilen lägger på nya försändelser hos den nya ledaren – NYTT id (${fresh?.id} > ${maxId})`);
  const forced = await D(G, "D.forceItem(3, 'ror', 100)");
  await D(G, 'D.forceCustomer()');
  const bIds = ((await belt(G)) || []).map((x) => x.id), kIds = ((await D(G, 'D.customers()')) || []).map((k) => k.id), ids = [...bIds, ...kIds];
  ok(forced.id > maxId && new Set(ids).size === ids.length, `inga id-krockar (bandet ${bIds.join(', ')}; kunderna ${kIds.join(', ')}; ny försändelse ${forced.id})`);
}

// 13. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
{
  const lag = await D(G, 'D.lag()');
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lag.ok} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lag.ok} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
  const rows = await G.evaluate(() => [...document.querySelectorAll('#modal div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()));
  const ratt = +(((rows.find((r) => /^✅ Rätt/.test(r)) || '').match(/^✅ Rätt\s*(\d+)/) || [])[1] ?? -1);
  const fel = +(((rows.find((r) => /^❌ Fel/.test(r)) || '').match(/^❌ Fel\s*(\d+)/) || [])[1] ?? -1);
  ok(ratt === Math.round(lag.ok / 2) && fel === Math.round(lag.fel / 2), `rätt- och fel-raderna är halva lagets (${ratt} av ${lag.ok}, ${fel} av ${lag.fel})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
