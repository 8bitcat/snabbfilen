// JOBBA TILLSAMMANS i Burgarköket: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna skenor); Kalle bjuder in
// Julia via startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser
// varandra, exakt EN skiftledare; ledarens lappar och grill syns hos medarbetaren; medarbetaren
// lägger en biff på grillen – den ligger där hos ledaren; den som börjar på ett tråg tar en lapp
// som ingen annan bygger (lappen märks, var sitt tråg); medarbetarens egna fel räknas i laget;
// medarbetaren tar den stekta biffen (EN gång), bygger sin burgare, ställer den på brickan och
// ringer – och det är KOCKEN som får poängen; en blixtsnabb läsk ger medarbetaren dricksen;
// sträcker sig båda efter samma biff får bara en den (den andra ser HANN FÖRE!); två läsk till en
// lapp och två som ringer = EN servering; lagets räkning är synkad; ledarbyte utan id-krockar och
// grillen steker vidare; lönebeskedet delar lagets rätt lika och har medarbetarens EGEN dricks.
// (Köket står inte i COOP_JOBS förrän det släpps – provet slår på det i båda sidorna.)
//   node tools/coop-kok-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8813)
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
    // kl 12: köket är öppet; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { kok: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'kok' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('kok'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'kok', 'jobbkok'); });
// ställ kocken vid en station och klicka på den (scenens down(x, y), som ett riktigt klick)
const readyAt = (p, stand) => p.evaluate((st) => { const D2 = SF.scene._debug; const [x, y] = D2.standAt(st); D2.place(x, y); }, stand);
const clickSpot = (p, spot) => p.evaluate((sp) => { const [x, y] = SF.scene._debug.spot(sp); SF.scene.down(x, y); }, spot);
const act = async (p, where) => { await readyAt(p, where); await clickSpot(p, where); };
const idle = (p) => D(p, 'D.idle()');
const st = (p) => D(p, 'D.state()');
const ords = (p) => D(p, 'D.orders()');

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia lagar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbkok', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt) && /dricks/i.test(flowTxt), 'startdialogen i köket erbjuder 💼 Jobba ihop (och berättar om dricksen)');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbkok' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i köket (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const oSoloA = await ords(A), oSoloB = await ords(B);
ok(oSoloA?.length === 0 && oSoloB?.length > 0, `egna skenor: Kalle tömmer sin – Julias lappar är kvar (${oSoloA?.length}/${oSoloB?.length})`);
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
await A.waitForFunction(() => SF.sceneName === 'jobbkok' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Burgarköket/.test(inv1 || ''), `Julia får inbjudan till Burgarköket (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbkok' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok(seen === 1 && seen2 === 1, `Kalle och Julia SER varandra i köket (${seen}/${seen2})`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);
const lagN = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.maxN === 2 && g.maxN === 2 ? l : null; }, 5000, 300);
ok(!!lagN, 'passet räknas som delat (2 pers) hos båda');
const lId = (await D(L, 'D.coop()')).myId, gId = (await D(G, 'D.coop()')).myId;

// provlugn hos ledaren: tom skena, tomma stationer
await D(L, 'D.calm()');
const empty = await until(async () => {
  const o = await ords(G), s = await st(G);
  return o && s && o.length === 0 && s.grill.every((b) => !b) && s.bricka.every((x) => !x) ? 1 : null;
}, 6000, 300);
ok(!!empty, `${gn} ser att skenan och stationerna töms hos ledaren`);

// 2. ledarens lappar och grill syns hos medarbetaren
const o1 = await D(L, "D.forceOrder('burgare')");
const o2 = await D(L, "D.forceOrder('gron')");
const g0 = await D(L, 'D.forceGrill(0, 0, 0)');
const seesOrders = await until(async () => { const o = await ords(G); return o && o.length === 2 && o[0].id === o1?.id && o[0].recept === 'burgare' && o[1].id === o2?.id && o[1].recept === 'gron' ? o : null; }, 6000, 300);
ok(!!seesOrders, `${gn} ser ledarens lappar (id ${o1?.id} BURGARE, ${o2?.id} GRÖNBURGARE)`);
const seesGrill = await until(async () => { const s = await st(G); return s?.grill[0]?.id === g0 ? s.grill[0] : null; }, 6000, 300);
ok(!!seesGrill, `${gn} ser ledarens biff på grillen (id ${g0})`);
const frying = await until(async () => { const s = await st(G); return s?.grill[0]?.tid >= 1 ? s.grill[0] : null; }, 6000, 300);
ok(!!frying, `den steker hos ${gn} också (${frying?.tid} s)`);
await D(L, 'D.forceGrill(0, null)');

// 3. medarbetarens handling ändrar ledarens värld: en rå biff på grillens mittplatta
await act(G, 'grill1');
const put = await until(async () => { const s = await st(L); return s?.grill[1] && s.grill[1].sida === 0 && s.grill[1].by === gId ? s.grill[1] : null; }, 8000, 300);
ok(!!put, `${gn} lägger en rå biff på grillen – den ligger där hos ledaren (id ${put?.id}, ${gn}s)`);
const handsG0 = (await st(G))?.carry;
ok(handsG0 === null, `${gn} har fortfarande tomma händer`);

// 4. var sitt tråg: ledaren börjar på BURGARE-lappen, medarbetaren får GRÖNBURGARE-lappen
await D(L, "D.step('underbrod')");
const claimSeen = await until(async () => { const x = ((await ords(G)) || []).find((q) => q.id === o1?.id); return x && x.kock === lId ? x : null; }, 6000, 300);
ok(!!claimSeen, `ledaren börjar på BURGARE-lappen – den märks som hens även hos ${gn}`);
await D(G, "D.step('underbrod')");
const trG = (await st(G))?.trag, trL = (await st(L))?.trag;
ok(trG?.recept === 'gron' && trL?.recept === 'burgare' && trG.lager.length === 1 && trL.lager.length === 1,
  `${gn} tar GRÖNBURGARE-lappen i stället – var sitt tråg (${ln}: ${trL?.recept}, ${gn}: ${trG?.recept})`);
const claimL = await until(async () => { const x = ((await ords(L)) || []).find((q) => q.id === o2?.id); return x && x.kock === gId ? x : null; }, 6000, 300);
ok(!!claimL, `GRÖNBURGARE-lappen är märkt som ${gn}s hos ledaren också`);

// 5. medarbetarens egna fel (fel lager på tråget) räknas i laget
const fel0 = (await D(L, 'D.lag()')).fel;
await D(G, "D.step('ost')");   // fel: nästa lager på grönburgaren är biffen
const sFel = await D(G, 'D.stats');
ok(sFel?.fel === 1, `${gn} lägger på osten för tidigt – OOPS (${gn}: fel ${sFel?.fel})`);
const felSync = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.fel === fel0 + 1 && g.fel === fel0 + 1 ? l : null; }, 6000, 300);
ok(!!felSync, `felet räknas i lagets räkning hos båda (${felSync?.fel ?? '?'})`);

// 6. medarbetaren tar den stekta biffen från den GEMENSAMMA grillen – EN gång, hos ledaren
await D(L, "D.step('stek')");   // allt på grillen blir klart hos ledaren (andra sidan stekt)
const ready = await until(async () => { const b = (await st(G))?.grill[1]; return b && b.id === put?.id && b.sida === 1 && b.tid >= 3 ? b : null; }, 6000, 250);
ok(!!ready, `${gn} ser att biffen är klar`);
await act(G, 'grill1');
const tookBiff = await until(async () => { const s = await st(G); return s?.carry?.typ === 'biff' && !s.carry.brand ? s : null; }, 8000, 250);
ok(!!tookBiff, `${gn} tar den stekta biffen via ledaren`);
const sL6 = await st(L);
ok(sL6 && sL6.grill[1] === null && sL6.carry === null, `plattan är tom hos ledaren – biffen togs EN gång (${ln} bär ingen)`);

// 7. medarbetaren bygger klart på SITT tråg, ställer grönburgaren på brickan och ringer → poängen är kockens
for (const s of ['biff', 'tomat', 'sallad', 'dressing', 'overbrod', 'trag']) await D(G, `D.step('${s}')`);
const burg = await st(G);
ok(burg?.carry?.typ === 'burgare' && burg.carry.recept === 'gron', `${gn} bygger grönburgaren på sitt tråg och lyfter den (${burg?.carry?.recept})`);
ok((await st(L))?.trag?.recept === 'burgare', `ledarens tråg är orört (${ln} bygger fortfarande sin BURGARE)`);
await act(G, 'bricka0');
const onTray = await until(async () => { const b = await D(L, 'D.brickan()'); return b && b[0] && b[0].typ === 'burgare' && b[0].recept === 'gron' && b[0].by === gId ? b[0] : null; }, 8000, 250);
ok(!!onTray, `${gn}s grönburgare står på brickan hos ledaren`);
ok((await st(G))?.carry === null, `${gn} släppte den ur händerna`);
const okL0 = (await D(L, 'D.stats')).ok;
await act(G, 'klocka');
const servedG = await until(async () => { const s = await D(G, 'D.stats'); return s && s.ok >= 1 ? s : null; }, 8000, 250);
ok(!!servedG, `${gn} ringer i klockan – grönburgaren serveras och ${gn} FÅR POÄNGEN (ok ${servedG?.ok})`);
const sL7 = await D(L, 'D.stats');
ok(sL7 && sL7.ok === okL0, `ledaren fick INTE poängen (${ln}: ok ${sL7?.ok})`);
const gone2 = await until(async () => { const o = await ords(L); return o && !o.some((q) => q.id === o2?.id) && o.some((q) => q.id === o1?.id) ? 1 : null; }, 4000, 250);
ok(!!gone2, 'GRÖNBURGARE-lappen är borta från skenan hos ledaren (BURGARE-lappen är kvar)');
const lag1 = await until(async () => { const l = await D(L, 'D.lag()'), g = await D(G, 'D.lag()'); return l && g && l.ok === 1 && g.ok === 1 ? l : null; }, 6000, 250);
ok(!!lag1, 'lagets räkning är synkad (1 rätt hos båda)');

// 8. dricksen till den som lagade: medarbetaren fyller en läsk i den GEMENSAMMA automaten, ställer
// den på brickan, en färsk läsklapp kommer och hen ringer direkt → blixtsnabbt = en tia
await act(G, 'lask');
const fills = await until(async () => { const m = (await st(L))?.maskin?.lask; return m ? m : null; }, 6000, 250);
ok(!!fills, `${gn} startar läskautomaten – koppen fylls hos ledaren`);
await until(async () => (await st(G))?.maskin?.lask?.fas === 'klar', 6000, 200);
await act(G, 'lask');
const cup = await until(async () => { const s = await st(G); return s?.carry?.typ === 'lask' ? s : null; }, 6000, 200);
ok(!!cup && (await st(L))?.maskin?.lask === null, `${gn} tar den färdiga läsken – automaten är tom hos ledaren`);
await act(G, 'bricka0');
await until(async () => ((await D(L, 'D.brickan()')) || [])[0]?.typ === 'lask' && ((await D(G, 'D.brickan()')) || [])[0]?.typ === 'lask', 6000, 200);
const o3 = await D(L, "D.forceOrder('lask')");
await until(async () => ((await ords(G)) || []).some((q) => q.id === o3?.id), 4000, 150);
const dr0 = { g: (await D(G, 'D.stats')).dricksKr, l: (await D(L, 'D.stats')).dricksKr };
await act(G, 'klocka');
const tip = await until(async () => { const s = await D(G, 'D.stats'); return s && s.dricksKr > dr0.g ? s : null; }, 6000, 200);
const lTip = (await D(L, 'D.stats'))?.dricksKr;
ok(!!tip && tip.dricksKr - dr0.g === 10 && tip.ok === 2, `blixtsnabb läsk: ${gn} får poängen OCH tian i dricks (+${tip ? tip.dricksKr - dr0.g : 0} kr, ok ${tip?.ok})`);
ok(lTip === dr0.l, `ledaren fick ingen dricks för ${gn}s läsk (${ln}: ${lTip} kr)`);

// 9. samtidigt: SAMMA biff – bara en får den, den andra ser HANN FÖRE!
const rb = await D(L, 'D.forceGrill(2, 1, 3.5)');   // en klar biff på tredje plattan
await until(async () => (await st(G))?.grill[2]?.id === rb, 6000, 200);
await Promise.all([L, G].map((p) => readyAt(p, 'grill2')));
await Promise.all([L, G].map((p) => clickSpot(p, 'grill2')));
await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
await wait(800);
const cL = (await st(L))?.carry, cG = (await st(G))?.carry, g2 = (await st(L))?.grill[2];
ok(((cL?.typ === 'biff') + (cG?.typ === 'biff')) === 1 && g2 === null,
  `båda sträcker sig efter samma biff – bara EN får den (${ln}: ${cL?.typ ?? '-'}, ${gn}: ${cG?.typ ?? '-'}, plattan tom)`);
const loser = cL?.typ === 'biff' ? G : L, loserN = loser === G ? gn : ln;
ok(((await D(loser, 'D.pops()')) || []).includes('HANN FÖRE!'), `den som kom sist (${loserN}) ser HANN FÖRE!`);
const g2g = await until(async () => (await st(G))?.grill[2] === null, 4000, 250);
ok(!!g2g, 'plattan är tom hos båda – ingen dubblett');
await D(L, "D.step('sopor')");
await D(G, "D.step('sopor')");

// 10. samtidigt: TVÅ läsk till EN lapp och båda ringer – lappen serveras en gång
await D(L, 'D.calm()');
await until(async () => ((await ords(G)) || [1]).length === 0 && ((await D(G, 'D.brickan()')) || [1]).every((x) => !x), 6000, 250);
const o4 = await D(L, "D.forceOrder('lask')");
await until(async () => ((await ords(G)) || []).some((q) => q.id === o4?.id), 6000, 200);
await Promise.all([L, G].map((p) => D(p, "D.give('lask')")));
await Promise.all([L, G].map((p) => act(p, 'bricka0')));
const two = await until(async () => { const b = await D(L, 'D.brickan()'); return b && b.filter((x) => x && x.typ === 'lask').length === 2 ? b : null; }, 8000, 250);
ok(!!two, 'båda ställer en läsk på brickan (två läsk, en lapp – den andra hamnar på nästa plats)');
await until(async () => ((await D(G, 'D.brickan()')) || []).filter(Boolean).length === 2, 4000, 200);
const before10 = { lag: (await D(L, 'D.lag()')).ok, l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok };
await Promise.all([L, G].map((p) => readyAt(p, 'klocka')));
await Promise.all([L, G].map((p) => clickSpot(p, 'klocka')));
await until(async () => (await idle(L)) && (await idle(G)), 6000, 250);
await wait(1200);
const after10 = { lag: (await D(L, 'D.lag()')).ok, l: (await D(L, 'D.stats')).ok, g: (await D(G, 'D.stats')).ok };
const left10 = ((await D(L, 'D.brickan()')) || []).filter(Boolean);
ok(after10.lag === before10.lag + 1 && (after10.l - before10.l) + (after10.g - before10.g) === 1,
  `båda ringer – lappen serveras EN gång (lag ${before10.lag} → ${after10.lag}; ${ln} +${after10.l - before10.l}, ${gn} +${after10.g - before10.g})`);
ok(left10.length === 1 && left10[0].typ === 'lask' && !((await ords(L)) || []).some((q) => q.id === o4?.id), 'lappen är borta och den andra läsken står kvar på brickan');
const lag10 = await until(async () => ((await D(G, 'D.lag()')) || {}).ok === after10.lag, 4000, 250);
ok(!!lag10, `lagets räkning synkad efteråt (${after10.lag})`);

// 11. LEDARBYTE: ledaren lämnar – medarbetaren tar över inom sekunder, grillen steker vidare
// och nya lappar/biffar krockar inte med gamla id:n
{
  await D(L, 'D.calm()');
  const kept = await D(L, 'D.forceGrill(0, 1, 0.2)');   // andra sidan hinner steka en stund
  await until(async () => (await st(G))?.grill[0]?.id === kept, 6000, 250);
  const maxOrd = Math.max(o1?.id ?? -1, o2?.id ?? -1, o3?.id ?? -1, o4?.id ?? -1);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 400);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const b1 = (await st(G))?.grill[0];
  await wait(1500);
  const b2 = (await st(G))?.grill[0];
  ok(b1 && b2 && b2.id === kept && b2.tid > b1.tid + 1, `grillen steker vidare hos den nya ledaren (${b1?.tid} → ${b2?.tid} s)`);
  const fresh = await until(async () => ((await ords(G)) || []).find((o) => o.id > maxOrd) || null, 12000, 300);
  ok(!!fresh, `skenan fortsätter hos den nya ledaren – en ny lapp med NYTT id (${fresh?.id} > ${maxOrd})`);
  const nyB = await D(G, 'D.forceGrill(1, 0, 0)');
  const nyO = await D(G, "D.forceOrder('glass')");
  const oids = ((await ords(G)) || []).map((o) => o.id);
  ok(nyB > kept && (!nyO || nyO.id > maxOrd) && new Set(oids).size === oids.length, `inga id-krockar (lappar ${oids.join(', ')}; ny biff ${nyB} > ${kept})`);
}

// 12. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika – dricksen är ens egen
{
  const lag = await D(G, 'D.lag()'), mine = await D(G, 'D.stats');
  await G.evaluate(() => { SF.shiftPlan.seconds = SF.scene._debug.time() + 1; });
  const slip = await until(() => G.evaluate(() => { const el = document.querySelector('#modal:not(.hidden)'); return el && /Passet är slut/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
  ok(/Jobbat ihop/.test(slip || '') && /2 pers/.test(slip || '') && new RegExp(`lagets ${lag.ok} rätt`).test(slip || ''),
    `lönebeskedet: jobbat ihop, 2 pers, lagets ${lag.ok} rätt delas lika (${(slip || '').replace(/\s+/g, ' ').slice(0, 90)})`);
  const rows = await G.evaluate(() => [...document.querySelectorAll('#modal div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()));
  const ratt = +(((rows.find((r) => /^✅ Rätt/.test(r)) || '').match(/^✅ Rätt\s*(\d+)/) || [])[1] ?? -1);
  ok(ratt === Math.round(lag.ok / 2), `rätt-raden är halva lagets (${ratt} av ${lag.ok})`);
  const tipRow = rows.find((r) => /^🪙 Dricks/.test(r)) || '';
  ok(mine.dricksKr >= 10 && tipRow.includes(String(mine.dricksKr)) && tipRow.includes(`${mine.dricks} ggr`), `dricksraden är ${gn}s EGEN dricks (${tipRow || 'saknas'})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
