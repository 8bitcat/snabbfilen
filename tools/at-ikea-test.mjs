// Möbeljätten – matregeln (samma som i alla matställen), med RIKTIGA klick:
//   KIOSKEN (plan 1): köp korv → korven i händerna → dörren med korven = "DU MÅSTE SÄTTA
//   DIG OCH ÄTA UPP!" och man stannar inne → sätt dig vid bistrobordet → klick bort =
//   "ÄT UPP FÖRST! 😋" och man sitter kvar → mättheten kommer bit för bit → uppätet:
//   tallriken försvinner och man kan gå ut. Plus mjukglassen.
//   RESTAURANGEN (plan 2): bricka → kassan → rulltrappan med brickan = nej → sitter och
//   äter bit för bit (mätthet + energi) → uppätet: brickan försvinner, rulltrappan går.
// Priser, mättnad och tid (g.passTime 5/15 min) ska vara som förut.
//   node tools/at-ikea-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=atik${Math.random().toString(36).slice(2, 7)}`);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'kalle', name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 720, money: 500, hunger: 40, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });

const wait = (ms) => p.waitForTimeout(ms);
const ev = (fn, arg) => p.evaluate(fn, arg);
const down = (pt) => ev((q) => SF.scene.down(q.x, q.y), pt);
const meal = () => ev(() => SF.scene._debug?.meal?.() ?? null);
const said = () => ev(() => SF.scene._debug?.speech?.() ?? null);
const pos = () => ev(() => SF.scene._debug.pos());
const state = () => ev(() => ({ h: SF.game.hunger, e: SF.game.energy, m: SF.game.money, min: SF.game.min }));
async function until(fn, ms = 6000, step = 100) { for (let i = 0; i < ms / step; i++) { const v = await fn(); if (v) return v; await wait(step); } return null; }
async function dialog(txt, ms = 6000) { return until(async () => (await p.locator('.dlg-head h2').textContent().catch(() => ''))?.includes(txt), ms, 150); }
// klockan står still (bara maten får flytta den) + hur mycket mättheten sjunker per minut
const HPM = await ev(() => {
  SF.game.tickReal = () => {};
  const g = SF.game, probe = Object.create(Object.getPrototypeOf(g));
  Object.assign(probe, { min: 600, hunger: 50, energy: 50 });
  probe.passTime(10);
  return (50 - probe.hunger) / 10;
});
// väntar ut ätandet och samlar mättheten efter varje tugga
async function eatWatch(ms = 20000) {
  const hs = [], stages = new Set();
  for (let i = 0; i < ms / 80; i++) {
    const [m, s] = await Promise.all([meal(), state()]);
    if (!m) break;
    hs.push(s.h); stages.add(m.stages.join(','));
    if (m.st === 'done') return { done: true, hs, stages, m };
    await wait(80);
  }
  return { done: false, hs, stages };
}
const ups = (hs) => hs.reduce((a, h, i) => a + (i && h > hs[i - 1] + 1e-6 ? 1 : 0), 0);
const DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';
const leaveBlock = () => ev(() => (SF.scene.leaveBlock ? SF.scene.leaveBlock() : 'saknas'));
async function buyKorv(what = 'Korv med bröd') {
  await down(await ev(() => SF.scene._debug.spot('korv')));
  const d = await dialog('Bistron');
  if (d) await p.locator('.dlg-foot button', { hasText: what }).click();
  await wait(60);
  return d;
}

// ================= KIOSKEN =================
await ev(() => SF.go('mobler'));
await wait(300);
const chk = await ev(() => SF.scene._debug.check());
ok(!chk.some((s) => /bistro|P1:.*(nå|klicka)/.test(s)), `bistroborden går att nå och klicka (varuhusets kontroll: ${chk.filter((s) => /P1/.test(s)).length} fel på plan 1)`);
const s0 = await state();
await down(await ev(() => SF.scene._debug.spot('korv')));
ok(await dialog('Bistron'), 'klick på korvkiosken: figuren går dit och kioskdialogen öppnas');
await p.locator('.dlg-foot button', { hasText: 'Korv med bröd' }).click();
await wait(60);
let m = await meal(), s = await state();
ok(m?.kind === 'kiosk' && m.held && s.m === s0.m - 10, `köpt korv: 10 kr dras och korven är i händerna (${s0.m} → ${s.m} kr, i händerna: ${m?.held})`);
ok(Math.abs(s.h - s0.h) < 0.01, `mättheten kommer inte vid köpet (${s0.h} → ${s.h}) – först vid bordet`);
// med korven: dörren direkt (figuren är på väg till ett bord)
await down(await ev(() => SF.scene._debug.screen('utgang')));
ok((await said())?.includes('DU MÅSTE SÄTTA DIG OCH ÄTA UPP'), `dörren med korven på väg till bordet: "${await said()}"`);
// en bit bort inne i utgångshallen: man går dit med korven, bordet släpps
await down(await ev(() => SF.scene._debug.toScreen(160, 336)));
await until(async () => !(await pos()).walking, 4000);
m = await meal();
ok(m?.st === 'carry' && m.held && m.seat === null, `går inne i utgångshallen med korven i händerna (läge ${m?.st})`);
const before = await pos();
await down(await ev(() => SF.scene._debug.screen('utgang')));
await wait(60);
ok((await said()) === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!', `klick på utgången med korven: "${await said()}"`);
await wait(1200);
let q = await pos();
ok(await ev(() => SF.sceneName) === 'mobler' && Math.hypot(q.x - before.x, q.y - before.y) < 1 && (await meal())?.held, 'man stannar inne med korven – ingen promenad mot dörren');
await down(await ev(() => SF.scene._debug.toScreen(330, 300))); // kassorna – utanför utgångshallen
await wait(300);
q = await pos();
ok((await said()) === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!' && q.x < 256, 'bort till kassorna med korven: samma besked, man stannar i utgångshallen');
await down(await ev(() => SF.scene._debug.screen('bistrobord', 0)));
m = await until(async () => { const x = await meal(); return x?.seated ? x : null; }, 5000);
ok(m && m.tray, 'klick på bistrobordet: figuren sätter sig och korven ligger på bordet');
const seatPos = await pos();
await down(await ev(() => SF.scene._debug.toScreen(200, 320)));
await wait(60);
ok((await said()) === 'ÄT UPP FÖRST! 😋', `klick bort medan man äter: "${await said()}"`);
await down(await ev(() => SF.scene._debug.screen('utgang')));
await wait(60);
ok((await said()) === DORR, `klick på utgången medan man äter: "${await said()}" (samma replik som Kaféet och dinern)`);
ok(await ev(() => SF.scene.leaveBlock?.()) === DORR, 'leaveBlock() spärrar mitt i korven');
await wait(400);
q = await pos();
m = await meal();
ok(m?.seated && Math.hypot(q.x - seatPos.x, q.y - seatPos.y) < 0.5 && await ev(() => SF.sceneName) === 'mobler', 'man sitter kvar vid bordet i varuhuset');
let r = await eatWatch();
ok(r.done && ups(r.hs) >= 2 && r.stages.has('1'), `korven äts bit för bit: mättheten steg ${ups(r.hs)} gånger, halväten korv syntes (${[...r.stages].join(' → ')})`);
s = await state();
const expK = Math.min(100, Math.round(Math.min(100, Math.round(s0.h + 7)) + 8));
ok(Math.abs(s.h - (expK - Math.min(expK, 5 * HPM))) < 0.02 && Math.abs(s.min - (s0.min + 5)) < 0.02, `korven mättar +15 och tar 5 minuter som förut (mätthet ${s.h.toFixed(2)}, klockan +${(s.min - s0.min).toFixed(2)} min)`);
await wait(1300);
m = await meal();
ok(!m || !m.tray, 'uppätet: tallriken försvinner från bordet');
await down(await ev(() => SF.scene._debug.screen('utgang')));
ok(await until(async () => (await ev(() => SF.sceneName)) === 'city', 6000), 'uppätet: nu går man ut genom dörren');

// mjukglassen: samma regel, 5 kr och +5
await ev(() => SF.go('mobler'));
await wait(300);
const g0 = await state();
await down(await ev(() => SF.scene._debug.spot('korv')));
ok(await dialog('Bistron'), 'kiosken igen');
await p.locator('.dlg-foot button', { hasText: 'Mjukglass' }).click();
m = await until(async () => { const x = await meal(); return x?.seated ? x : null; }, 5000);
ok(m?.kind === 'kiosk' && m.items[0] === 'glass', 'mjukglassen bärs till ett bistrobord och äts sittande');
r = await eatWatch();
s = await state();
ok(r.done && s.m === g0.m - 5 && Math.abs(s.h - (Math.min(100, Math.round(Math.min(100, Math.round(g0.h + 2)) + 3)) - 5 * HPM)) < 0.02, `mjukglassen: 5 kr, +5 mätthet bit för bit (${g0.h.toFixed(2)} → ${s.h.toFixed(2)})`);
await wait(2600);
ok(!(await meal()), 'efter glassen reser man sig av sig själv');

// ================= RESTAURANGEN =================
await ev(() => { SF.game.hunger = 20; SF.go('mobler'); SF.scene._debug.floor(2); }); // hungrig: inget tak i vägen
await wait(300);
const r0 = await state();
await down(await ev(() => SF.scene._debug.spot('restaurang')));
ok(await dialog('Restaurangen'), 'restaurangens meny öppnas');
await p.click('[data-plus="kaffe"]');
await p.click('.dlg-foot .btn-go');
await wait(60);
m = await meal();
ok(m?.kind === 'rest' && m.st === 'line' && m.held, 'brickan i händerna på väg till kassan');
const esc = await ev(() => SF.scene._debug.screen('rulltrappa'));
if (esc) {
  await down(esc);
  await wait(60);
  ok((await said()) === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!' && !(await ev(() => SF.scene._debug.rideState())), 'rulltrappan med brickan: "DU MÅSTE SÄTTA DIG OCH ÄTA UPP!", ingen åktur');
} else ok(false, 'rulltrappan syns inte i bild från restaurangen');
m = await until(async () => { const x = await meal(); return x && x.st !== 'line' ? x : null; }, 8000);
s = await state();
ok(m && s.m === r0.m - 69, `betalt i kassan: köttbullar + kaffe = 69 kr (${r0.m} → ${s.m})`);
if (m?.held) { // på väg till bordet: ut i gången = nej
  const pp = await pos();
  await down(await ev(([x]) => SF.scene._debug.toScreen(x, 372), [pp.x]));
  await wait(60);
  ok((await said()) === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!', 'ut ur restaurangen med brickan: samma besked');
}
m = await until(async () => { const x = await meal(); return x?.seated ? x : null; }, 6000);
ok(m && m.tray, 'figuren sätter sig vid ett ledigt bord med brickan');
await down({ x: 20, y: 120 });
await wait(60);
ok((await said()) === 'ÄT UPP FÖRST! 😋' && (await meal())?.seated, 'klick bort vid bordet: "ÄT UPP FÖRST! 😋" och man sitter kvar');
const hr = r0.h, er = r0.e; // klockan står still: inget har ändrat dem sedan köpet
r = await eatWatch();
s = await state();
ok(r.done && ups(r.hs) >= 3 && r.stages.size >= 4, `restaurangmaten äts bit för bit (${ups(r.hs)} steg: ${[...r.stages].join(' → ')})`);
let hx = hr;
for (const part of [22, 23, 1, 2]) hx = Math.min(100, Math.round(hx + part));
ok(Math.abs(s.h - (hx - Math.min(hx, 15 * HPM))) < 0.02 && s.e === Math.min(100, Math.round(Math.min(100, Math.round(er + 3)) + 3)), `mätthet +48 och energi +6 som förut (mätthet ${s.h.toFixed(2)}, energi ${er} → ${s.e})`);
ok(Math.abs(s.min - (r0.min + 15)) < 0.02, `måltiden tar 15 minuter som förut (+${(s.min - r0.min).toFixed(2)})`);
await wait(1300);
ok(!(await meal())?.tray, 'uppätet: brickan försvinner');
const pp2 = await pos();
await down(await ev(([x]) => SF.scene._debug.toScreen(x - 60, 366), [pp2.x])); // ut i gången
await wait(100);
q = await pos();
ok(!(await meal()) && q.walking, 'uppätet: man reser sig och går ut i gången');
await wait(800);
await down(await ev(() => SF.scene._debug.spot('rulltrappa')));
ok(await until(async () => !!(await ev(() => SF.scene._debug.rideState())), 8000), 'uppätet: nu går rulltrappan');

// ================= ALLA BORD UPPTAGNA =================
await ev(() => SF.go('mobler'));
await wait(300);
await ev(() => SF.scene._debug.fullHouse(true));
await down(await ev(() => SF.scene._debug.spot('korv')));
ok(await dialog('Bistron'), 'kiosken när alla bistrobord är upptagna');
await p.locator('.dlg-foot button', { hasText: 'Korv med bröd' }).click();
await wait(200);
m = await meal();
ok(m?.st === 'carry' && m.held && (await said())?.includes('ALLA BORD ÄR UPPTAGNA'), `alla bord upptagna: korven stannar i händerna ("${await said()}")`);
await ev(() => SF.scene._debug.fullHouse(false));
ok(await until(async () => (await meal())?.seated, 5000), 'ett bord blir ledigt: figuren sätter sig där och äter');
// uppäten korv + scenbyte: inget räknas dubbelt
r = await eatWatch();
s = await state();
await ev(() => SF.go('city'));
let s2 = await state();
ok(r.done && Math.abs(s2.h - s.h) < 0.01 && Math.abs(s2.min - s.min) < 0.01, `uppäten korv och sedan scenbyte: inget räknas dubbelt (${s.h.toFixed(2)} → ${s2.h.toFixed(2)})`);

// ================= SCENBYTE MITT I MATEN (👥 Gå dit, jobbinbjudan, somnar vid midnatt) =================
// Betald mat går aldrig förlorad: exit() räknar in resten (mättnad/energi + tiden), som Kaféet och dinern.
await ev(() => SF.go('mobler'));
await wait(300);
ok(await leaveBlock() === null, 'leaveBlock() = null utan mat (man får gå)');
const k0 = await state();
ok(await buyKorv(), 'kiosken: korv igen');
ok(await leaveBlock() === DORR && (await said()) === DORR, `leaveBlock() med korven i händerna: "${await said()}"`);
await ev(() => SF.go('city'));
s = await state();
const expC = Math.min(100, Math.round(k0.h + 15));
ok(s.m === k0.m - 10 && Math.abs(s.h - (expC - Math.min(expC, 5 * HPM))) < 0.02 && Math.abs(s.min - (k0.min + 5)) < 0.02,
  `scenbyte med korven i händerna: korven räknas in, +15 och 5 min (mätthet ${k0.h.toFixed(2)} → ${s.h.toFixed(2)}, klockan +${(s.min - k0.min).toFixed(2)})`);

// mitt i restaurangmaten: det som var kvar räknas in, summan blir exakt +48/+6 och 15 min
await ev(() => { SF.game.hunger = 20; SF.go('mobler'); SF.scene._debug.floor(2); });
await wait(300);
const p0 = await state();
await down(await ev(() => SF.scene._debug.spot('restaurang')));
ok(await dialog('Restaurangen'), 'restaurangens meny igen');
await p.click('[data-plus="kaffe"]');
await p.click('.dlg-foot .btn-go');
m = await until(async () => { const x = await meal(); return x?.seated && x.got.fill > 0 && x.st === 'eat' ? x : null; }, 12000, 60);
ok(m && m.stages.some((st) => st < 2), `mitt i maten (tuggor: ${m?.stages.join(',')}, hittills +${m?.got.fill})`);
ok(await leaveBlock() === DORR, 'leaveBlock() spärrar mitt i restaurangmaten');
await ev(() => SF.go('city'));
s = await state();
const hp = Math.min(100, p0.h + 48);
ok(s.m === p0.m - 69 && Math.abs(s.h - (hp - Math.min(hp, 15 * HPM))) < 0.02 && s.e === Math.min(100, Math.round(p0.e + 6)) && Math.abs(s.min - (p0.min + 15)) < 0.02,
  `scenbyte mitt i restaurangmaten: resten räknas in (mätthet ${p0.h} → ${s.h.toFixed(2)}, energi ${p0.e} → ${s.e}, klockan +${(s.min - p0.min).toFixed(2)})`);

// somnade vid midnatt (dagen har redan gått när scenen byts): maten räknas in, klockan rörs inte
await ev(() => SF.go('mobler'));
await wait(300);
const n0 = await state();
ok(await buyKorv(), 'kiosken: en sista korv');
await ev(() => { SF.game.day += 1; SF.go('city'); SF.game.day -= 1; });
s = await state();
ok(s.m === n0.m - 10 && Math.abs(s.h - Math.min(100, Math.round(n0.h + 15))) < 0.02 && Math.abs(s.min - n0.min) < 0.01,
  `somnat vid midnatt mitt i korven: +15 mätthet men ingen extra tid (${n0.h.toFixed(2)} → ${s.h.toFixed(2)}, klockan +${(s.min - n0.min).toFixed(2)})`);

// obetald bricka (på väg till kassan): släpps bara – inga pengar, ingen mat
await ev(() => { SF.go('mobler'); SF.scene._debug.floor(2); });
await wait(300);
const u0 = await state();
await down(await ev(() => SF.scene._debug.spot('restaurang')));
ok(await dialog('Restaurangen'), 'restaurangens meny en tredje gång');
await p.click('.dlg-foot .btn-go');
await wait(40);
m = await meal();
if (m?.st === 'line') {
  await ev(() => SF.go('city'));
  s = await state();
  ok(s.m === u0.m && Math.abs(s.h - u0.h) < 0.01 && Math.abs(s.min - u0.min) < 0.01, `scenbyte med obetald bricka: ingen mat och inga pengar (${u0.m} → ${s.m} kr)`);
} else ok(false, `brickan var inte på väg till kassan (läge ${m?.st})`);

console.log(errs.length ? 'KONSOLFEL: ' + errs.join(' | ') : 'Inga konsolfel.');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
