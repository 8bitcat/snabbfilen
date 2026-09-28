// REGELN I MATSTÄLLENA – Kaféet och Burgarbaren (dinern inne), med riktiga klick
// genom scenernas down(x, y) på _debug.spot-lägena:
//  1) köpt mat får man i handen (brickan) – mättnad/energi kommer INTE vid köpet
//  2) man sätter sig vid ett ledigt bord och äter bit för bit – mättnaden/energin kommer då
//  3) sitter man och äter kan man inte gå: klick någon annanstans → "ÄT UPP FÖRST! 😋", sitter kvar
//  4) dörren med maten i handen eller mitt i maten → "DU MÅSTE SÄTTA DIG OCH ÄTA UPP!", stannar inne
//  5) uppätet: brickan/tallriken försvinner och man kan gå ut
//  + disken/jobbdialogen/menyn mitt i maten tappar inget och släpper inte ut en
//  + tvingat scenbyte mitt i maten (exit) ger det som var kvar – betald mat går aldrig förlorad
// Scenens egen uppdatering frysas och tiden drivs med _debug.tick → deterministiskt och snabbt.
// Kör: node tools/at-kafe-test.mjs   (port: SMOKE_PORT / PORT / 8788)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = 'D:/GamesProjects/snabbfilen/tools/out/at-kafe/';
fs.mkdirSync(OUT, { recursive: true });
const ATUPP = 'ÄT UPP FÖRST! 😋', DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok: ' : 'FEL: ') + msg); if (!cond) fails++; return !!cond; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource|WebSocket/i.test(m.text()) && errs.push(m.text()));

await page.goto(`http://localhost:${PORT}/index.html?world=atk${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Fikaren', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 30, energy: 40, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  localStorage.removeItem('snabbfilen_kafe');
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await page.waitForTimeout(700);
await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .btn-go')?.click(); });
await page.waitForTimeout(200);

// ---------- hjälpare ----------
const sceneName = () => page.evaluate(() => window.SF.sceneName);
const st = () => page.evaluate(() => window.SF.scene?._debug?.state?.() || null);
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal')?.classList.contains('hidden'));
const closeModal = () => page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden')) [...m.querySelectorAll('.dlg-foot .btn')].pop()?.click(); });
// in i en scen med fryst uppdatering (tiden går bara när testet tickar)
async function enter(name, vals = {}) {
  await page.evaluate(([name, vals]) => {
    const g = window.SF.game;
    Object.assign(g, { min: 12 * 60, money: 500, hunger: 30, energy: 40 }, vals);
    window.SF.go(name);
    const S = window.SF.scene;
    S.update = () => {};   // huvudloopen får inte flytta figuren – testet driver tiden
  }, [name, vals]);
  await page.waitForTimeout(150);
}
// tiden går (bara i den scen testet står i)
const tick = (sec, name) => page.evaluate(([s, name]) => { if (window.SF.sceneName === name) window.SF.scene._debug.tick(s); }, [sec, name]);
async function until(name, fn, maxSec, label) {
  for (let i = 0; i <= maxSec * 4; i++) {
    const s = await st();
    if ((await sceneName()) !== name) return { left: await sceneName() };
    if (fn(s)) return s;
    await tick(0.25, name);
  }
  ok(false, label + ' (tog för lång tid: ' + JSON.stringify(await st()) + ')');
  return null;
}
// klick på en plats i scenen (_debug.spot-id) eller på en världspunkt – via scenens down(x, y)
const click = (id) => page.evaluate((id) => { const S = window.SF.scene, p = S._debug.spot(id); if (!p) return false; S.down(p.x, p.y); return true; }, id);
const clickW = (wx, wy) => page.evaluate(([wx, wy]) => { const S = window.SF.scene; S.down(wx - S._debug.cam(), wy); }, [wx, wy]);
// skärmdump av canvasen
async function shot(file) {
  // vänta in två bildrutor så att canvasen hunnit ritas om efter senaste tick
  const url = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(document.querySelector('#scene').toDataURL('image/png'))))));
  fs.writeFileSync(OUT + file, Buffer.from(url.split(',')[1], 'base64'));
}

// ======================================================================
// KAFÉET
// ======================================================================
console.log('== Kaféet ==');
await enter('kafe');
const KM = await page.evaluate(async () => (await import('/js/scenes/shop-kafe.js')).KAFE_MENY.map((m) => ({ price: m.price, fill: m.fill, energy: m.energy })));
const K0 = await st();
ok(K0 && K0.me === 'free', 'kaféet: figuren står fritt vid dörren');
// 1) disken → menyn → köp kladdkaka & cappuccino (index 2)
await click('disk');
for (let i = 0; i < 40 && !(await modalOpen()); i++) await tick(0.25, 'kafe');
ok(await modalOpen(), 'kaféet: klick på disken öppnar menyn');
const before = await st();
await page.click('#modal [data-buy="2"]');
await page.waitForTimeout(100);
const K1 = await st();
ok(K1.money === before.money - KM[2].price || K1.money === before.money - KM[2].price + 5, `kaféet: pengarna dras vid köpet (${before.money} → ${K1.money})`);
ok(K1.energy === before.energy, `kaféet: energin kommer INTE vid köpet (${before.energy} → ${K1.energy})`);
ok(K1.hunger <= before.hunger, `kaféet: mättnaden kommer INTE vid köpet (${before.hunger.toFixed(1)} → ${K1.hunger.toFixed(1)})`);
ok(await page.evaluate(() => window.SF.scene.leaveBlock?.()) === DORR, 'kaféet: leaveBlock() spärrar redan när fikat är beställt');
// 2) baristan fixar brickan → i händerna
let KFAR = null;
const Kc = await until('kafe', (s) => s.me === 'carry', 20, 'kaféet: brickan kommer');
if (Kc) {
  ok(Kc.item === 2 && Kc.stage === 0, 'kaféet: kladdkakan ligger hel på brickan i händerna');
  // (tiden står still mellan klicken – figuren hinner inte sätta sig emellan)
  await click('dorr');
  const rd = await st();
  ok(rd.me === 'carry' && rd.say === DORR && (await sceneName()) === 'kafe', `kaféet: dörren med brickan → "${DORR}", stannar inne (${rd.me}, "${rd.say}")`);
  await click('disk');
  const rk = await st();
  ok(rk.me === 'carry' && rk.item === 2 && rk.say === ATUPP && !(await modalOpen()), `kaféet: disken igen med brickan → "${ATUPP}", ingen meny, brickan kvar`);
  // styr om till ett ledigt bord långt bort (soffhörnan) – brickan följer med
  const far = await page.evaluate(() => { const free = window.SF.scene._debug.seats().filter((s) => !s.occ).map((s) => s.id); return ['c10', 'd11', 'a20', 'b10', 'a10', 'c11', 'b31'].find((id) => free.includes(id)); });
  await click(far);
  const rr = await st();
  ok(far && rr.me === 'carry' && rr.item === 2, `kaféet: klick på ett annat ledigt bord (${far}) styr om dit med brickan`);
  await tick(0.6, 'kafe');
  await shot('kafe-1-bricka-i-handen.png');
  // på väg mot bordet: dörren igen – fortfarande spärrad, och dörren öppnas inte
  await click('dorr');
  const md = await st();
  ok(md.me === 'carry' && md.say === DORR, 'kaféet: dörrklick medan man går med brickan → spärrad');
  // precis vid dörren med brickan (på väg till bordet): dörren förblir stängd
  await page.evaluate((far) => { const S = window.SF.scene, d = S._debug; d.teleport(110, 92); const p = d.spot(far); S.down(p.x, p.y); }, far);
  await tick(0.15, 'kafe');
  const dd = await st();
  ok(dd.me === 'carry' && dd.doorForMe === false, `kaféet: dörren öppnas inte för den som bär fika (${dd.me}, x ${dd.x}, y ${dd.y})`);
  KFAR = far;
}
// 3) sätter sig och fikar
const Ks = await until('kafe', (s) => s.me === 'sit' && s.item === 2, 20, 'kaféet: sätter sig med fikat');
if (Ks) {
  ok(Ks.seat === KFAR, `kaféet: sitter vid bordet man valde (${Ks.seat})`);
  await tick(0.5, 'kafe');
  await shot('kafe-2-sitter-vid-bordet.png');
  const e0 = Ks.energy, h0 = Ks.hunger;
  // klick på golvet → sitter kvar
  await clickW(236, 150);
  const a = await st();
  ok(a.me === 'sit' && a.seat === KFAR && a.say === ATUPP, `kaféet: klick på golvet mitt i fikat → "${ATUPP}" och sitter kvar (${a.me}, ${a.seat})`);
  await shot('kafe-3-at-upp-forst.png');
  // klick på ett annat ledigt bord → sitter kvar
  const other = await page.evaluate((mine) => window.SF.scene._debug.seats().find((s) => !s.occ && s.id !== mine && !s.id.startsWith('pall'))?.id, KFAR);
  await click(other);
  const o2 = await st();
  ok(o2.seat === KFAR && o2.me === 'sit', `kaféet: klick på ett annat ledigt bord (${other}) mitt i fikat → sitter kvar`);
  // dörren mitt i fikat
  await click('dorr');
  const b = await st();
  ok(b.me === 'sit' && b.say === DORR && (await sceneName()) === 'kafe', `kaféet: dörren mitt i fikat → "${DORR}", stannar inne`);
  // disken + menyn mitt i fikat
  await click('disk');
  await page.evaluate(() => window.SF.scene._debug.menu());
  ok(!(await modalOpen()) && (await st()).me === 'sit', 'kaféet: disken/menyn mitt i fikat → ingen meny, sitter kvar');
  ok(await page.evaluate(() => window.SF.scene.leaveBlock?.()) === DORR, 'kaféet: leaveBlock() spärrar mitt i fikat');
  // bit för bit: halvätet ger halva energin
  const half = await until('kafe', (s) => s.stage >= 1, 6, 'kaféet: första tuggan');
  if (half) ok(half.energy === e0 + Math.floor(KM[2].energy / 2) && half.item === 2, `kaféet: halvätet → halva energin (${e0} → ${half.energy})`);
  await shot('kafe-4-halvatet.png');
  // uppätet: tallriken försvinner, all energi och mättnad har kommit
  const done = await until('kafe', (s) => s.item === -1, 10, 'kaféet: fikat blir uppätet');
  if (done) {
    ok(done.energy === e0 + KM[2].energy, `kaféet: hela energin när det är uppätet (+${done.energy - e0}, ska vara +${KM[2].energy})`);
    ok(done.hunger - h0 >= KM[2].fill - 3 && done.hunger - h0 <= KM[2].fill, `kaféet: mättnaden kom medan man åt (+${(done.hunger - h0).toFixed(1)} av ${KM[2].fill})`);
    ok(done.food === null, 'kaféet: inget betalt fika kvar');
    ok(await page.evaluate(() => window.SF.scene.leaveBlock?.()) === null, 'kaféet: leaveBlock() släpper när det är uppätet');
    await shot('kafe-5-uppatet.png');
  }
  // 5) nu får man gå: dörren → staden
  await click('dorr');
  const out = await until('kafe', () => false, 15, 'kaféet: går ut genom dörren');
  ok(out && out.left === 'city', `kaféet: uppätet → dörren leder ut till staden (${JSON.stringify(out)})`);
}

// tvingat scenbyte mitt i fikat (👥-menyn, somnar vid midnatt …) → resten av fikat räknas in
await enter('kafe', { energy: 30, hunger: 20 });
{
  const e0 = (await st()).energy;
  await page.evaluate(() => window.SF.scene._debug.buy(0));
  const c = await until('kafe', (s) => s.me === 'carry', 25, 'kaféet (tvingat): brickan kommer');
  const got = await page.evaluate(() => window.SF.scene._debug.state().food);
  await page.evaluate(() => window.SF.go('city'));
  const e1 = await page.evaluate(() => window.SF.game.energy);
  ok(c && got && e1 === e0 + got.energy, `kaféet: tvingat scenbyte med brickan → fikat räknas in ändå (+${e1 - e0}, ska vara +${got?.energy})`);
}

// ======================================================================
// BURGARBAREN (dinern inne)
// ======================================================================
console.log('== Burgarbaren ==');
await enter('burgarbar');
const B0 = await st();
ok(B0 && B0.me === 'free', 'dinern: figuren står fritt vid dörren');
await click('disk');
for (let i = 0; i < 60 && !(await modalOpen()); i++) await tick(0.25, 'burgarbar');
ok(await modalOpen(), 'dinern: klick på disken öppnar menyn');
const bb = await st();
await page.click('#modal [data-buy="4"]');   // burgarmålet (burgare, pommes, läsk)
await page.waitForTimeout(100);
const B1 = await st();
const malPris = await page.evaluate(async () => (await import('./js/scenes/shop-burgarbar.js')).BURGAR_MENY.find((m) => m.id === 'mal').price);
ok(B1.money === bb.money - malPris, `dinern: målet kostar ${malPris} kr som på menyn (${bb.money} → ${B1.money})`);
ok(B1.energy === bb.energy && B1.hunger <= bb.hunger, 'dinern: mättnad/energi kommer INTE vid köpet');
// jobbdialogen medan Doris fixar maten
await page.evaluate(() => window.SF.scene._debug.jobs());
ok(!(await modalOpen()), 'dinern: jobbdialogen öppnas inte medan maten görs i ordning');
const Bc = await until('burgarbar', (s) => s.me === 'carry', 30, 'dinern: brickan kommer');
if (Bc) {
  ok(Bc.tray && Bc.tray.length === 3, `dinern: brickan med tre rätter i händerna (${Bc.tray})`);
  await tick(0.3, 'burgarbar');
  await shot('dinern-1-bricka-i-handen.png');
  // dörren, golvet framför dörren, disken och jobbskylten med brickan i händerna
  await click('dorr');
  let s = await st();
  ok(s.me === 'carry' && s.say === DORR && (await sceneName()) === 'burgarbar', `dinern: dörren med brickan → "${DORR}"`);
  await clickW(34, 95);
  s = await st();
  ok(s.me === 'carry' && s.say === DORR, 'dinern: golvet precis framför dörren med brickan → spärrat');
  await click('disk');
  s = await st();
  ok(s.me === 'carry' && s.say === ATUPP && !(await modalOpen()), `dinern: disken igen med brickan → "${ATUPP}", ingen meny`);
  await click('jobb');
  s = await st();
  ok(s.me === 'carry' && !(await modalOpen()) && s.tray?.length === 3, 'dinern: jobbskylten med brickan → ingen jobbdialog, brickan kvar');
  // gå en bit med brickan (golvklick) – det går bra; dörrklick under gången stoppar inte gången men släpper inte ut en
  await clickW(120, 110);
  await tick(0.3, 'burgarbar');
  const w0 = await st();
  await click('dorr');
  const w1 = await st();
  await tick(0.4, 'burgarbar');
  const w2 = await st();
  ok(w1.me === 'carry' && w1.say === DORR && (w2.x !== w1.x || w2.y !== w1.y), `dinern: dörrklick medan man går med brickan → "${DORR}", går vidare (${w0.x},${w0.y} → ${w2.x},${w2.y})`);
  await tick(2.5, 'burgarbar');
  s = await st();
  ok(s.me === 'carry' && s.tray?.length === 3 && s.energy === bb.energy && (await sceneName()) === 'burgarbar', 'dinern: man kan gå omkring med brickan, inget äts stående');
  await page.evaluate(() => window.SF.scene._debug.teleport(34, 94));
  await tick(1.5, 'burgarbar');
  s = await st();
  ok(s.me === 'carry' && s.doorForMe === false, `dinern: dörren öppnas inte för den som bär mat (${s.me}, x ${s.x}, y ${s.y})`);
  await shot('dinern-2-dorren-stangd.png');
}
// sätt dig vid ett ledigt bord (helst ett där ingen sitter framför och skymmer)
const bSeat = await page.evaluate(() => {
  const all = window.SF.scene._debug.seats(), free = (id) => all.some((s) => s.id === id && !s.occ), none = (id) => !all.some((s) => s.id === id);
  return ['t2a', 't4a', 'b3a', 'b4a', 't3a', 'b1a', 'b6a', 'b5a'].find((id) => free(id) && (free(id.slice(0, -1) + 'b') || none(id.slice(0, -1) + 'b'))) || 'bord';
});
await click(bSeat);
const Bs = await until('burgarbar', (s) => s.me === 'sit' && s.tray, 20, 'dinern: sätter sig med brickan');
if (Bs) {
  await tick(1.2, 'burgarbar');
  await shot('dinern-3-sitter-och-ater.png');
  const e0 = Bs.energy;
  await clickW(300, 150);
  let s = await st();
  ok(s.me === 'sit' && s.seat === Bs.seat && s.say === ATUPP, `dinern: klick på golvet mitt i maten → "${ATUPP}", sitter kvar`);
  await shot('dinern-4-at-upp-forst.png');
  await click('dorr');
  s = await st();
  ok(s.me === 'sit' && s.say === DORR && (await sceneName()) === 'burgarbar', `dinern: dörren mitt i maten → "${DORR}"`);
  await click('jobb');
  await page.evaluate(() => window.SF.scene._debug.jobs());
  await page.evaluate(() => window.SF.scene._debug.menu());
  s = await st();
  ok(!(await modalOpen()) && s.me === 'sit' && s.tray, 'dinern: jobbdialogen/menyn mitt i maten → öppnas inte, brickan kvar');
  ok(await page.evaluate(() => window.SF.scene.leaveBlock?.()) === DORR, 'dinern: leaveBlock() spärrar mitt i maten');
  const bit = await until('burgarbar', (x) => x.tray && x.tray.some((i) => !i.endsWith(':0')), 5, 'dinern: första tuggan');
  if (bit) ok(bit.energy > e0 || bit.hunger > Bs.hunger, 'dinern: mättnad/energi kommer vid bordet');
  const done = await until('burgarbar', (x) => x.tray === null, 20, 'dinern: brickan blir tom');
  if (done) {
    ok(done.energy === bb.energy + 20, `dinern: hela målets energi när det är uppätet (+${done.energy - bb.energy}, ska vara +20)`);
    ok(done.order === false, 'dinern: ingen betald mat kvar');
    ok(await page.evaluate(() => window.SF.scene.leaveBlock?.()) === null, 'dinern: leaveBlock() släpper när det är uppätet');
    await shot('dinern-5-uppatet.png');
  }
  // (motprov: utan mat öppnas dörren för en)
  await page.evaluate(() => window.SF.scene._debug.teleport(34, 95));
  await tick(0.1, 'burgarbar');
  ok((await st()).doorForMe === true, 'dinern: utan mat öppnas dörren när man står vid den');
  await click('dorr');
  const out = await until('burgarbar', () => false, 15, 'dinern: går ut genom dörren');
  ok(out && out.left === 'city', `dinern: uppätet → dörren leder ut till staden (${JSON.stringify(out)})`);
}

// tvingat scenbyte mitt i maten → resten räknas in
await enter('burgarbar', { energy: 30, hunger: 20 });
{
  await page.evaluate(() => window.SF.scene._debug.forceBuy('mal'));
  await until('burgarbar', (s) => s.me === 'carry', 30, 'dinern (tvingat): brickan kommer');
  await click('bord');
  await until('burgarbar', (s) => s.me === 'sit' && s.tray && s.tray.some((i) => !i.endsWith(':0')), 25, 'dinern (tvingat): börjar äta');
  const mid = await st();
  await page.evaluate(() => window.SF.go('city'));
  const e1 = await page.evaluate(() => window.SF.game.energy);
  ok(mid && mid.energy > 30 && e1 === 30 + 20, `dinern: tvingat scenbyte mitt i maten → resten räknas in (${mid?.energy} → ${e1}, totalt +${e1 - 30} av 20)`);
}

// ======================================================================
// KAFÉET: alla platser upptagna → figuren väntar med brickan och sätter sig själv när det blir ledigt
// ======================================================================
console.log('== Kaféet: fullt ==');
await enter('kafe', { energy: 30, hunger: 20 });
{
  await page.evaluate(() => window.SF.scene._debug.buy(5));   // dubbel espresso
  const held = await page.evaluate(() => window.SF.scene._debug.hold());
  const c = await until('kafe', (s) => s.me === 'carry', 25, 'kaféet (fullt): brickan kommer');
  ok(c && c.seat === null && /upptagna/.test(c.say || ''), `kaféet (fullt): alla platser upptagna → väntar med brickan (${c?.me}, "${c?.say}")`);
  await tick(2.5, 'kafe');
  await clickW(236, 150);   // golvet: bara en hint, man går inte
  await tick(1, 'kafe');
  const w = await st();
  ok(w.me === 'carry' && w.seat === null && w.item === 5 && w.energy === 30, 'kaféet (fullt): står kvar med brickan, inget äts stående');
  await click('dorr');
  ok((await st()).say === DORR && (await sceneName()) === 'kafe', 'kaféet (fullt): dörren medan man väntar → spärrad');
  // en plats blir ledig → figuren går dit själv och sätter sig
  const freed = held.find((id) => id === 'b10') || held.find((id) => !id.startsWith('pall')) || held[0];
  await page.evaluate((id) => window.SF.scene._debug.unhold(id), freed);
  const s = await until('kafe', (x) => x.me === 'sit', 10, 'kaféet (fullt): sätter sig när en plats blir ledig');
  ok(s && s.seat === freed && s.item === 5, `kaféet (fullt): går själv till platsen som blev ledig (${freed}) och sätter sig (${s?.seat})`);
  if (s) { await tick(0.6, 'kafe'); await shot('kafe-6-ledigt-igen.png'); }
  const food = (await st()).food;
  const done = await until('kafe', (x) => x.item === -1, 12, 'kaféet (fullt): espresson blir uppdrucken');
  ok(done && food && done.energy === 30 + food.energy, `kaféet (fullt): hela energin när det är uppdrucket (+${done ? done.energy - 30 : '?'} av ${food?.energy})`);
  await page.evaluate(() => window.SF.scene._debug.unhold());
}

// ======================================================================
// OMLADDNING (ny version / stängd flik) mitt i maten → resten räknas in och SPARAS direkt
// ======================================================================
console.log('== Omladdning mitt i maten ==');
const savedEnergy = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('snabbfilen_save1')).energy; } catch { return null; } });
// Kaféet: brickan i händerna → 'sf:before-reload' (det version-ui.js skickar före omladdningen)
await enter('kafe', { energy: 30, hunger: 20 });
{
  await page.evaluate(() => window.SF.scene._debug.buy(2));
  const c = await until('kafe', (s) => s.me === 'carry', 25, 'kaféet (omladdning): brickan kommer');
  const food = c?.food;
  await page.evaluate(() => window.dispatchEvent(new Event('sf:before-reload')));
  const r = await st();
  ok(food && r.energy === 30 + food.energy && (await savedEnergy()) === r.energy, `kaféet: omladdning med brickan i händerna → fikat inräknat och sparat (+${r.energy - 30} av ${food?.energy}, sparat ${await savedEnergy()})`);
  ok(r.me === 'carry' && r.item === 2 && (await page.evaluate(() => window.SF.scene.leaveBlock?.({ quiet: true }))) === DORR, 'kaféet: efter inräkningen ligger brickan kvar och regeln gäller (om sidan skulle komma tillbaka)');
  const d = await until('kafe', (s) => s.item === -1, 25, 'kaféet (omladdning): äter upp ändå');
  ok(d && d.energy === 30 + food.energy, `kaféet: tuggorna efteråt ger inget till (+${d ? d.energy - 30 : '?'} av ${food?.energy})`);
}
// Dinern: mitt i maten → 'pagehide' (fliken stängs)
await enter('burgarbar', { energy: 30, hunger: 20 });
{
  await page.evaluate(() => window.SF.scene._debug.forceBuy('mal'));
  await until('burgarbar', (s) => s.me === 'carry', 30, 'dinern (omladdning): brickan kommer');
  await click('bord');
  const mid = await until('burgarbar', (s) => s.me === 'sit' && s.tray && s.tray.some((i) => !i.endsWith(':0')), 25, 'dinern (omladdning): börjar äta');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const r = await st();
  ok(mid && mid.energy < 50 && r.energy === 50 && (await savedEnergy()) === 50, `dinern: sidan stängs mitt i maten → resten inräknad och sparad (${mid?.energy} → ${r.energy}, sparat ${await savedEnergy()})`);
  ok(r.me === 'sit' && r.tray && r.order === true, 'dinern: brickan ligger kvar och regeln gäller');
  await tick(2, 'burgarbar');
  const r2 = await st();
  ok(r2.energy === 50 && r2.tray && r2.tray.join() !== r.tray.join(), `dinern: tuggorna efteråt ger inget till (${r.tray} → ${r2.tray}, energi ${r2.energy})`);
  // exit() mitt i maten efter inräkningen ger inget en gång till
  await page.evaluate(() => window.SF.go('city'));
  ok((await page.evaluate(() => window.SF.game.energy)) === 50, 'dinern: scenbyte efter inräkningen ger inget en gång till');
}
// Lyssnarna försvinner när man går ut: en omladdning i staden rör inte energin
{
  const e = await page.evaluate(() => window.SF.game.energy);
  await page.evaluate(() => window.dispatchEvent(new Event('sf:before-reload')));
  ok((await page.evaluate(() => window.SF.game.energy)) === e, 'lyssnarna släpps i exit() (omladdning utanför påverkar inget)');
}
// RIKTIG omladdning av sidan med brickan i händerna (kaféet) → fikat finns med efteråt
await enter('kafe', { energy: 30, hunger: 40 });
{
  await page.evaluate(() => window.SF.scene._debug.buy(0));
  const c = await until('kafe', (s) => s.me === 'carry', 25, 'kaféet (riktig omladdning): brickan kommer');
  const want = 30 + (c?.food?.energy ?? NaN);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  const e = await page.evaluate(() => window.SF.game.energy);
  ok(e === want, `kaféet: riktig omladdning med brickan i händerna → energin finns kvar efteråt (${e}, ska vara ${want})`);
}

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
