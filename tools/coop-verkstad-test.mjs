// JOBBA TILLSAMMANS i Bilverkstaden: två riktiga webbläsare i samma värld.
// Kollar: jobbar man var för sig ser man INTE varandra (egna pass, egna bilar – och ensam går allt
// som förut: hela däckbytet steg för steg och ett riktigt klick på panelen); Kalle bjuder in Julia via
// startdialogens 💼 Jobba ihop → 💼 Bjud & börja och hon trycker Häng med!; båda ser varandra, exakt
// EN skiftledare, rubriken blir BILVERKSTADEN IHOP; ledarens bilar (samma modell, färg, fel och läge)
// syns hos medarbetaren; medarbetaren gör ett HELT däckbyte hos ledaren – hissar, tar skruvdragaren
// (den är i hens händer och ingen annanstans), skruvar ur varje skruv, tar av hjulet (dragaren hamnar
// på golvet), lägger det gamla i stapeln, sätter på ett nytt, skruvar i kryss (bonusen är hens), tar
// slangen, fyller lagom luft och sänker – och det är MEDARBETAREN som får poängen; medarbetaren lagar
// ett gammalt fel (håller inne vid fronten, skiftledaren lagar åt hen, delen förbrukas); sänker båda
// samma klara bil samtidigt betalar den EN gång (den andra ser HANN FÖRE!); tar båda samma
// skruvdragare får bara en den; ett önskemål som kommer två gånger räknas en gång; lagets räkning är
// synkad; ledarbyte utan id-krockar – skruvdragaren den gamla ledaren bar kommer hem till vagnen och
// bilen som var på väg in parkerar hos den nya ledaren; lönebeskedet delar lika.
// (Bilverkstaden står inte i COOP_JOBS förrän den släpps – provet slår på det i båda sidorna.)
//   node tools/coop-verkstad-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8817)
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
    // kl 12: verkstaden är öppen; båda är nybörjare
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { bilverkstad: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  // släppet lägger till 'bilverkstad' i COOP_JOBS – här slås det på i sidan (main.js onInvite läser samma Set)
  await p.evaluate(() => import('/js/jobs/shift.js').then((m) => { m.COOP_JOBS.add('bilverkstad'); }));
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);
const clickBtn = (p, re) => p.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('#modal button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
const startFlow = (p) => p.evaluate(async () => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(SF, 'bilverkstad', 'jobbverkstad'); });
const J = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));
const cars = (p) => D(p, 'D.cars()');
const carAt = async (p, bay) => ((await cars(p)) || []).find((c) => c.bay === bay) || null;
const tire = (p, bay) => D(p, `D.tire(${bay})`);
const wr = (p) => D(p, 'D.wrenches()');
const carrying = (p) => D(p, 'D.carrying()');
const idle = (p) => D(p, 'D.idle()');
// hjulet när mekanikern står still och inte väntar på svar – i EN läsning (svaret kan komma emellan två)
const idleTire = (p, bay) => D(p, `D.idle() ? D.tire(${bay}) : null`);
const stats = (p) => D(p, '({ ...D.stats })');
const lag = (p) => D(p, 'D.lag()');
const hands = (p) => D(p, 'D.hands()');
const act = (p, key, a, b, v) => D(p, `D.act(${J(key)}, ${J(a)}, ${J(b)}, ${J(v)})`);
const hann = async (p) => ((await D(p, 'D.popLog()')) || []).filter((s) => s === 'HANN FÖRE!').length;
const waitIdle = (p) => until(() => idle(p), 6000, 100);
const bothIdle = (a, b) => until(async () => (await idle(a)) && (await idle(b)), 6000, 120);
const snap = async (p, name) => { if (process.env.SNAP_DIR) await p.screenshot({ path: `${process.env.SNAP_DIR}/${name}.png` }); };

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');

// 0. VAR FÖR SIG: Julia jobbar sitt eget pass, Kalle börjar ett eget – ingen dyker upp hos den andra
await B.evaluate(() => SF.go('jobbverkstad', { onDone: () => SF.go('city') }));
await startFlow(A);
await until(() => A.evaluate(() => /Jobba ett pass/.test(document.querySelector('#modal')?.textContent || '') ? 1 : 0), 5000, 200);
const flowTxt = await A.evaluate(() => document.querySelector('#modal').textContent);
ok(/Jobba ihop/.test(flowTxt), 'startdialogen i verkstaden erbjuder 💼 Jobba ihop');
await clickBtn(A, /Jobba ett pass/);
await A.waitForFunction(() => SF.sceneName === 'jobbverkstad' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
await wait(5000);
const soloA = await D(A, 'D.coop()'), soloB = await D(B, 'D.coop()');
const seeA = await A.evaluate(() => SF.worldFolksHere().length), seeB = await B.evaluate(() => SF.worldFolksHere().length);
ok(soloA?.mates === 0 && soloB?.mates === 0 && seeA === 0 && seeB === 0 && soloA.leader && soloB.leader && !soloA.active && !soloB.active,
  `var för sig: ingen ser den andra i verkstaden (${seeA}/${seeB}) – båda kör sitt eget pass`);
await D(A, 'D.calm()');
await wait(800);
const cSoloA = await cars(A), cSoloB = await cars(B);
ok(cSoloA?.length === 0 && cSoloB?.length > 0, `egna verkstäder: Kalle tömmer sin – Julias bilar är kvar (${cSoloA?.length}/${cSoloB?.length})`);
ok((await D(A, 'D.title()')) === 'BILVERKSTADEN' && (await D(B, 'D.title()')) === 'BILVERKSTADEN', 'ensam heter passet bara BILVERKSTADEN');
// ensam går allt som förut: ett helt däckbyte steg för steg (kryssmönster = +1, däckbytet = +3) …
{
  await D(A, "D.forceCar('kombi', { bay: 2, wheel: 0, tire: 'sommar', raised: true })");
  const steps = [];
  for (const s of ['skruvar', 'däck av', 'nytt däck', 'skruva fast', 'luft', 'sänk']) steps.push((await D(A, `D.step(${J(s)}, { bay: 2 })`))?.ok);
  const s = await stats(A);
  ok(steps.every(Boolean) && s.ok === 4 && s.dack === 1 && s.kryss === 1 && s.fel === 0, `ensam: hela däckbytet ger 3 + kryssbonus (ok ${s.ok}, däck ${s.dack}, kryss ${s.kryss}, steg ${steps.join(',')})`);
}
// … och ett riktigt klick på panelen hissar en bil som står nere
{
  await D(A, "D.forceCar('olja', { bay: 0 })");
  const p = await D(A, "D.spot('panel:0')");
  await A.evaluate(([x, y]) => { SF.scene.down(x, y); SF.scene.up(); }, [p.x, p.y]);
  const up = await until(async () => { const c = await carAt(A, 0); return c && c.state === 'wait' ? c : null; }, 8000, 200);
  ok(!!up, 'ensam med klick: panelen hissar bilen (den står uppe och väntar)');
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
await A.waitForFunction(() => SF.sceneName === 'jobbverkstad' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
ok(/Bjud & börja/.test(bjudTxt), `Kalle trycker "${bjudTxt.trim()}" och går in på passet`);
const inv1 = await until(() => B.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? el.textContent : ''; }), 10000, 300);
ok(/Bilverkstan/.test(inv1 || ''), `Julia får inbjudan till verkstaden (${(inv1 || '').replace(/\s+/g, ' ').slice(0, 70)})`);
await clickBtn(B, /Häng med/);
await B.waitForFunction(() => SF.sceneName === 'jobbverkstad' && !!SF.scene?._debug?.coop, null, { timeout: 10000 });
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
ok((await D(L, 'D.title()')) === 'BILVERKSTADEN IHOP' && (await D(G, 'D.title()')) === 'BILVERKSTADEN IHOP', 'rubriken är BILVERKSTADEN IHOP hos båda');

// provlugn hos ledaren: inga bilar, verktygen hemma
await D(L, 'D.calm()');
const empty = await until(async () => { const c = await cars(G); return c && c.length === 0 ? 1 : null; }, 6000, 300);
ok(!!empty, `${gn} ser att lyftarna töms hos ledaren`);

// 2. ledarens bilar syns hos medarbetaren – samma modell, färg, fel och läge
await D(L, "D.forceCar('kombi', { bay: 2, wheel: 0, tire: 'sommar', patience: 600 })");
await D(L, "D.forceCar('olja', { bay: 1, raised: true, patience: 600 })");
const lc = await cars(L);
const seesCars = await until(async () => {
  const gc = await cars(G);
  if (!gc || gc.length !== 2) return null;
  return lc.every((c) => gc.some((x) => x.id === c.id && x.bay === c.bay && x.kind === c.kind && x.color === c.color && x.fault === c.fault && x.state === c.state)) ? gc : null;
}, 6000, 250);
ok(!!seesCars, `${gn} ser ledarens bilar: ${lc.map((c) => `${c.kind} (fel ${c.fault}, ${c.state}) på lyft ${c.bay}`).join(', ')}`);
const want = (await tire(L, 2))?.want;

// 3. MEDARBETAREN gör ett helt däckbyte hos ledaren – varje steg ändrar ledarens verkstad
{
  await act(G, 'panel', 2);
  const upL = await until(async () => (await carAt(L, 2))?.state === 'wait', 8000, 200);
  const upG = await until(async () => (await carAt(G, 2))?.state === 'wait', 4000, 200);
  ok(!!upL && !!upG, `${gn} hissar bilen med panelen – den står uppe hos ledaren`);
  await waitIdle(G);
  await act(G, 'vagn', 0);
  const held = await until(async () => (await carrying(G)) === 'skruvdragare', 5000, 150);
  const wL = await until(async () => { const w = (await wr(L))?.[0]; return w && w.at === 'hand' && w.by === gId ? w : null; }, 3000, 150);
  const hL = ((await hands(L)) || []).find((h) => h.id === gId);
  ok(!!held && !!wL && hL?.carrying === 'skruvdragare', `${gn} tar skruvdragaren på vagnen – hos ledaren är den i ${gn}s händer och ingen annanstans`);
  // skruvarna ur: första klicket på hjulet startar första skruven, sedan en i taget i navbubblan
  await waitIdle(G);
  await act(G, 'hjul', 2);
  const spun = await until(async () => { const tj = await tire(L, 2); return tj?.spin && (await carAt(L, 2))?.spinBy === gId ? tj.spin : null; }, 4000, 60);
  ok(!!spun, `${gn}s skruv snurrar hos ledaren (skruven är ${gn}s)`);
  const fel0 = (await lag(L)).fel;
  for (let i = 0; i < 16; i++) {
    const tj = await until(async () => { const x = await idleTire(G, 2); return x && !x.spin ? x : null; }, 4000, 60);
    if (!tj || !tj.bolts.some(Boolean)) break;
    await act(G, 'bult', 2, tj.bolts.findIndex(Boolean));
  }
  const outL = await until(async () => { const tj = await tire(L, 2); return tj && tj.bolts.every((b) => !b) && !tj.spin ? tj : null; }, 5000, 150);
  ok(!!outL && (await lag(L)).fel === fel0, `${gn} skruvar ur alla ${outL?.n ?? '?'} skruvar en i taget – de är ute hos ledaren, inga FÖR SNABBT`);
  await snap(G, 'verkstad-ihop-medarbetaren-skruvar');
  // hjulet av: det gamla däcket i händerna, skruvdragaren på golvet
  await waitIdle(G);
  await act(G, 'hjul', 2);
  const off = await until(async () => (await tire(L, 2))?.tire === 'off' && /^gammalt:/.test((await carrying(G)) || ''), 5000, 150);
  const floorW = ((await wr(L)) || []).find((w) => w.at === 'floor');
  ok(!!off && !!floorW, `${gn} tar av hjulet – navet är bart hos ledaren och skruvdragaren ligger på golvet`);
  const piles0 = await D(L, 'D.piles()');
  await waitIdle(G);
  await act(G, 'stapel', 0);
  const piled = await until(async () => { const p = await D(L, 'D.piles()'); return p && p[0] === piles0[0] + 1 && (await carrying(G)) === null ? p : null; }, 5000, 150);
  ok(!!piled, `det gamla däcket ligger i stapeln hos ledaren (${piles0[0]} → ${piled?.[0]})`);
  // nytt däck på
  await waitIdle(G);
  await act(G, 'dack', want);
  const nw = await until(async () => (await carrying(G)) === 'hjul:' + want, 5000, 150);
  await waitIdle(G);
  await act(G, 'hjul', 2);
  const on = await until(async () => (await tire(L, 2))?.tire === 'new' && (await carrying(G)) === null, 5000, 150);
  ok(!!nw && !!on, `${gn} hämtar ett ${want}däck och sätter på det – det sitter på navet hos ledaren`);
  // skruvdragaren från golvet och skruvarna i kryss: bonusen är medarbetarens
  const before = { g: await stats(G), l: await stats(L), lag: await lag(L) };
  await waitIdle(G);
  await act(G, 'golv', floorW.id);
  await until(async () => (await carrying(G)) === 'skruvdragare', 5000, 150);
  const n = (await tire(G, 2)).n, order = n === 4 ? [0, 2, 1, 3] : [0, 2, 4, 1, 3];
  for (const k of order) {
    await until(async () => { const x = await idleTire(G, 2); return x && !x.spin; }, 4000, 60);
    await act(G, 'bult', 2, k);
    await until(async () => (await tire(G, 2))?.bolts[k], 4000, 60);
  }
  const inL = await until(async () => { const tj = await tire(L, 2); return tj && tj.bolts.every(Boolean) && !tj.spin ? tj : null; }, 5000, 150);
  const kr = await until(async () => { const s = await stats(G); return s.kryss === before.g.kryss + 1 && s.ok === before.g.ok + 1 ? s : null; }, 4000, 150);
  const lagK = await until(async () => { const l = await lag(L), g = await lag(G); return l.ok === before.lag.ok + 1 && g.ok === before.lag.ok + 1 ? l : null; }, 4000, 150);
  ok(!!inL && !!kr && !!lagK && (await stats(L)).ok === before.l.ok && (await lag(L)).fel === fel0,
    `${gn} skruvar fast i kryss (${inL?.order}) – KRYSSMÖNSTER-bonusen är ${gn}s, laget +1, ledaren fick inget (och inga fel)`);
  // slangen och lagom luft
  await waitIdle(G);
  await act(G, 'kompressor');
  const hose = await until(async () => (await carrying(G)) === 'slang' && (await D(L, 'D.hose()')) === gId, 5000, 150);
  ok(!!hose, `${gn} tar luftslangen – hos ledaren är det ${gn} som har den`);
  await waitIdle(G);
  await D(G, 'D.luft(2, 0.75)');
  const aired = await until(async () => { const tj = await tire(L, 2); return tj?.aired && (await carAt(L, 2))?.state === 'ready' ? tj : null; }, 5000, 150);
  ok(!!aired, `${gn} fyller lagom luft (${aired?.air}) – bilen är KLAR hos ledaren`);
  const stowed = await until(async () => (await D(L, 'D.hose()')) === null && (await carrying(G)) === null, 5000, 200);
  ok(!!stowed, 'slangen rullas in av sig själv – den hänger på kompressorn igen hos båda');
  // sänk: kunden betalar – poängen är medarbetarens
  const b2 = { g: await stats(G), l: await stats(L), lag: await lag(L) };
  await waitIdle(G);
  await act(G, 'panel', 2);
  const paid = await until(async () => { const s = await stats(G); return s.ok === b2.g.ok + 3 && s.dack === b2.g.dack + 1 ? s : null; }, 5000, 150);
  const lagP = await until(async () => { const l = await lag(L), g = await lag(G); return l.ok === b2.lag.ok + 3 && g.ok === b2.lag.ok + 3 ? l : null; }, 4000, 150);
  ok(!!paid && !!lagP && (await stats(L)).ok === b2.l.ok, `${gn} sänker lyften: kunden betalar +3 till ${gn} (ok ${paid?.ok}), laget ${lagP?.ok} – ledaren fick inget`);
  await snap(L, 'verkstad-ihop-ledaren-efter-dackbytet');
}

// 4. ett gammalt fel: medarbetaren håller inne vid fronten med rätt del – skiftledaren lagar åt hen
{
  // fel del först: felet är medarbetarens (och lagets) – inte ledarens
  const f0 = { g: (await stats(G)).fel, l: (await stats(L)).fel, lag: (await lag(L)).fel };
  await waitIdle(G);
  await act(G, 'del', 2);
  await until(async () => (await carrying(G)) === 2, 5000, 150);
  await D(G, 'D.holdAt(1)');
  const wf = await until(async () => { const s = await stats(G); return s.fel === f0.g + 1 ? s : null; }, 5000, 150);
  const lagF = await until(async () => { const l = await lag(L), g = await lag(G); return l.fel === f0.lag + 1 && g.fel === f0.lag + 1 ? l : null; }, 4000, 150);
  await D(G, 'D.release()');
  ok(!!wf && !!lagF && (await stats(L)).fel === f0.l, `fel del (lampor till oljebytet): ${gn} får felet (fel ${wf?.fel}), laget också – inte ledaren`);
  await waitIdle(G);
  await act(G, 'del', 1);
  const part = await until(async () => (await carrying(G)) === 1, 5000, 150);
  await D(G, 'D.holdAt(1)');
  const lock = await until(async () => (await carAt(L, 1))?.rb === gId, 4000, 100);
  const fixed = await until(async () => (await carAt(L, 1))?.state === 'ready', 8000, 150);
  const used = await until(async () => (await carrying(G)) === null, 3000, 150);
  await D(G, 'D.release()');
  ok(!!part && !!lock && !!fixed && !!used, `${gn} lagar oljan (lagningen låst åt ${gn}) – bilen är KLAR hos ledaren och oljedunken är förbrukad`);
  // ledaren sänker den själv: poängen är ledarens
  const b3 = { l: await stats(L), g: await stats(G) };
  await act(L, 'panel', 1);
  const lp = await until(async () => (await stats(L)).ok === b3.l.ok + 1, 4000, 150);
  ok(!!lp && (await stats(G)).ok === b3.g.ok, `${ln} sänker den lagade bilen själv – poängen är ${ln}s`);
}

// 5. samtidigt: båda sänker SAMMA klara bil – den betalar EN gång, den andra ser HANN FÖRE!
{
  await D(L, "D.forceCar('lampa', { bay: 3, raised: true, patience: 600 })");
  await D(L, 'D.ready(3)');
  await until(async () => (await carAt(G, 3))?.state === 'ready', 5000, 150);
  await bothIdle(L, G);
  const b4 = { l: await stats(L), g: await stats(G), lag: await lag(L), h: [await hann(L), await hann(G)] };
  await Promise.all([act(L, 'panel', 3), act(G, 'panel', 3)]);
  await bothIdle(L, G);
  await wait(900);
  const a4 = { l: await stats(L), g: await stats(G), lag: await lag(L), lagG: await lag(G) };
  const wins = (a4.l.ok - b4.l.ok) + (a4.g.ok - b4.g.ok);
  ok(wins === 1 && a4.lag.ok === b4.lag.ok + 1 && a4.lagG.ok === b4.lag.ok + 1, `båda sänker lyft 3 – kunden betalar EN gång (${ln} +${a4.l.ok - b4.l.ok}, ${gn} +${a4.g.ok - b4.g.ok}, laget +${a4.lag.ok - b4.lag.ok})`);
  const loser = a4.l.ok > b4.l.ok ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > b4.h[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
}

// 6. samtidigt: SAMMA skruvdragare på vagnen – bara en får den, den finns på ETT ställe
{
  await until(async () => { const w = (await wr(L))?.[1]; return w && w.at === 'cart' && w.cart === 1; }, 4000, 150);
  await until(async () => (await wr(G))?.[1]?.at === 'cart', 4000, 150);
  await bothIdle(L, G);
  const h0 = [await hann(L), await hann(G)];
  await Promise.all([act(L, 'vagn', 1), act(G, 'vagn', 1)]);
  await bothIdle(L, G);
  await wait(900);
  const cL = await carrying(L), cG = await carrying(G), w1 = (await wr(L))[1];
  const wins = (cL === 'skruvdragare' ? 1 : 0) + (cG === 'skruvdragare' ? 1 : 0);
  const winnerId = cL === 'skruvdragare' ? lId : gId;
  ok(wins === 1 && w1.at === 'hand' && w1.by === winnerId, `båda tar skruvdragaren på vagn 2 – bara EN får den (${ln}: ${cL ?? '-'}, ${gn}: ${cG ?? '-'})`);
  const winner = cL === 'skruvdragare' ? L : G, loser = winner === L ? G : L, loserN = loser === G ? gn : ln;
  ok((await hann(loser)) > h0[loser === L ? 0 : 1], `den som kom sist (${loserN}) ser HANN FÖRE!`);
  // tillbaka på vagnen
  await act(winner, 'vagn', 1);
  const back = await until(async () => { const w = (await wr(L))[1], g = (await wr(G))[1]; return w.at === 'cart' && g.at === 'cart' && (await carrying(winner)) === null ? 1 : null; }, 5000, 150);
  ok(!!back, 'skruvdragaren ligger på vagnen igen hos båda');
}

// 7. ett önskemål som kommer två gånger (svaret dröjde) räknas EN gång
{
  await D(L, "D.forceCar('batteri', { bay: 0, raised: true, patience: 600 })");
  await D(L, 'D.ready(0)');
  await until(async () => (await carAt(G, 0))?.state === 'ready', 5000, 150);
  await bothIdle(L, G);
  const b5 = { g: await stats(G), lag: await lag(L) };
  const sent = await D(G, "D.twice('panel', 0)");
  await bothIdle(L, G);
  await wait(1000);
  const a5 = { g: await stats(G), lag: await lag(L) };
  ok(sent && a5.g.ok === b5.g.ok + 1 && a5.lag.ok === b5.lag.ok + 1, `samma "sänk lyften" två gånger: kunden betalar EN gång (laget ${b5.lag.ok} → ${a5.lag.ok}, ${gn} ${b5.g.ok} → ${a5.g.ok})`);
}

// 8. lagets räkning är densamma hos båda
{
  const same = await until(async () => { const l = await lag(L), g = await lag(G); return l && g && l.ok === g.ok && l.fel === g.fel && l.miss === g.miss ? l : null; }, 5000, 250);
  ok(!!same, `lagets räkning synkad: ${same?.ok} rätt, ${same?.fel} fel, ${same?.miss} missade hos båda`);
}

// 9. LEDARBYTE: ledaren (med en skruvdragare i händerna) går medan en bil kör in – medarbetaren tar
// över inom sekunder, skruvdragaren kommer hem till vagnen, bilen parkerar och nya bilar krockar inte
// med gamla id:n
{
  await until(async () => !(await carAt(L, 2)), 15000, 300);   // (däckbytets bil har kört ut)
  await bothIdle(L, G);
  await act(L, 'vagn', 1);
  await until(async () => (await carrying(L)) === 'skruvdragare', 4000, 150);
  const lh = await until(async () => ((await hands(G)) || []).find((h) => h.id === lId && h.carrying === 'skruvdragare') || null, 4000, 150);
  ok(!!lh, `${gn} ser att ${ln} bär en skruvdragare`);
  await D(L, "D.forceCar('sedan', { bay: 2, drive: true, patience: 600 })");
  const drv = await until(async () => { const c = await carAt(G, 2); return c && c.state === 'drive' ? c : null; }, 5000, 100);
  ok(!!drv, `${gn} ser bilen köra in genom porten (id ${drv?.id})`);
  const seenIds = ((await cars(G)) || []).map((c) => c.id);
  const maxId = Math.max(...seenIds);
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 300);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  const home = await until(async () => { const w = (await wr(G))?.[1]; return w && w.at === 'cart' ? w : null; }, 8000, 250);
  ok(!!home, `skruvdragaren ${ln} bar ligger på vagnen igen – ingen skruvdragare försvann`);
  const parked = await until(async () => { const c = (await cars(G)).find((x) => x.id === drv.id); return c && ['park', 'raise', 'wait'].includes(c.state) ? c : null; }, 15000, 300);
  ok(!!parked, `bilen som var på väg in parkerar på lyften hos den nya ledaren (${parked?.state})`);
  const freeBay = await G.evaluate(() => [0, 1, 2, 3].find((b) => !SF.scene._debug.cars().some((c) => c.bay === b)));
  if (freeBay !== undefined) await D(G, `D.forceCar('pickup', { bay: ${freeBay}, raised: true, patience: 600 })`);
  const ids = ((await cars(G)) || []).map((c) => c.id), fresh = ids.filter((id) => !seenIds.includes(id));
  ok(fresh.length > 0 && fresh.every((id) => id > maxId) && new Set(ids).size === ids.length, `inga id-krockar (bilarna ${ids.join(', ')}; de nya > ${maxId})`);
  // den nya ledaren jobbar själv – poängen räknas
  const before = { g: (await stats(G)).ok, lag: (await lag(G)).ok };
  await D(G, 'D.repair(true)');
  const after = { g: (await stats(G)).ok, lag: (await lag(G)).ok };
  ok(after.g > before.g && after.g - before.g === after.lag - before.lag, `${gn} lagar en bil själv som ledare – poängen räknas (ok ${before.g} → ${after.g}, laget ${before.lag} → ${after.lag})`);
}

// 10. passet tar slut hos den som är kvar: lönebeskedet delar lagets rätt lika
{
  const lg = await lag(G);
  await G.evaluate(() => { SF.shiftPlan.seconds = (SF.scene._debug.time() + 1) / 1.5; });   // (verkstadens pass = 1,5 × planens)
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
