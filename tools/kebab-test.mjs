// Regressionstest för Kebab Grill (js/scenes/shop-kebab.js):
//   • menyn: rätt priser (kebabrulle 45, falafel 40, pommes 25, läsk 15) och mättnad per rätt
//   • beställning via riktiga klick (disken → menyn → rulle + läsk + vitlökssås → Beställ)
//   • kocken lagar maten och ställer fram den – figuren tar brickan i händerna
//   • ÄTREGELN: med maten i händerna öppnas inte dörren, mitt i maten sitter man kvar
//     (dörren och golvet ger repliken, scenen byts inte), leaveBlock() spärrar
//   • tugga för tugga: mättnaden kommer BARA när man sitter och blir exakt rättens mättnad
//   • betald mat går aldrig förlorad: resten räknas in när sidan laddas om (sf:before-reload)
//     och när scenen byts mitt i maten (exit)
//   • fliken byts / mobilen låses / sidan stängs (visibilitychange, pagehide): mätaren hoppar
//     INTE (tugga för tugga gäller fortfarande), men sparfilen har resten; menyns figurbyte
//     och en annan sparning skrivs aldrig över
//   • inte råd = ingen beställning, upptagen plats = replik, gästerna lever utan fel
//   • dörren ut fungerar när man ätit upp
//   • mobilen (844×390, fyll-läget NÄRA beskär ~55 rader upptill): kameran följer på höjden –
//     menytavlan och spetten syns vid disken, Deniz bekräftelse syns hela, borden längst fram
//     nås med tryck, pekskylten ritas innanför den synliga rutan
// Kör: node tools/kebab-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = 'tools/out/smast-kebab/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
const WORLD = 'kbtest' + Date.now().toString(36);
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=${WORLD}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 300, hunger: 30, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });

// in i grillen (scenen 'kebab' – finns den inte i main.js än byggs den direkt ur modulen)
async function enterKebab() {
  return page.evaluate(async () => {
    try { window.SF.go('kebab'); return 'SF.go'; } catch (e) {
      const m = await import('/js/scenes/shop-kebab.js');
      window.SF.scene?.exit?.(); window.SF.sceneName = 'kebab'; window.SF.scene = m.makeShopKebab(window.SF); window.SF.scene.enter?.();
      return 'modulen direkt (' + e.message + ')';
    }
  });
}
const how = await enterKebab();
await page.waitForTimeout(400);
ok(await page.evaluate(() => window.SF.sceneName === 'kebab' && !!window.SF.scene?._debug), `scenen kebab öppnas (${how})`);

const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const S = () => D('state');
const sleep = (ms) => page.waitForTimeout(ms);
async function waitFor(fn, ms = 10000, arg) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(100); } return false; }
// klicka på en punkt i vyn (spelpixlar) som en riktig spelare
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
// klicka på en plats; ligger den utanför bild riktas kameran dit först
async function clickSpot(id) {
  let p = await D('spot', id);
  if (!p) throw new Error('ingen plats ' + id);
  if (p.x < 6 || p.x > 378) {
    const c = await D('cam');
    await D('lockCam', Math.max(0, c + p.x - 192));
    p = await D('spot', id);
    await clickView(p.x, p.y);
    await D('lockCam', null);
    return;
  }
  await clickView(p.x, p.y);
}

// en ledig plats (pall = barstol vid fönstret). Gästerna kommer och går – är ingen av den
// sorten ledig väntar vi en stund, sedan duger vilken ledig plats som helst.
async function freeSeat(pall) {
  const want = (x) => !x.occ && x.id.startsWith('pall') === pall;
  for (let k = 0; k < 40; k++) { const f = (await D('seats')).find(want); if (f) return f; await sleep(500); }
  return (await D('seats')).find((x) => !x.occ);
}

// ---- menyn ----
const meny =await page.evaluate(() => window.SF.scene._debug.menu);
const byId = Object.fromEntries(meny.map((m) => [m.id, m]));
ok(byId.kebab?.price === 45 && byId.falafel?.price === 40 && byId.pommes?.price === 25 && byId.lask?.price === 15, `priserna: kebabrulle 45, falafel 40, pommes 25, läsk 15 (${meny.map((m) => m.id + ' ' + m.price).join(', ')})`);
ok(meny.every((m) => m.fill > 0 && Number.isInteger(m.fill / m.bites) && Number.isInteger(m.energy / m.bites)), 'varje rätt mättar – jämnt fördelat på tuggorna');
ok(byId.kebab.fill > byId.falafel.fill && byId.falafel.fill > byId.pommes.fill && byId.pommes.fill > byId.lask.fill, `mättnaden efter rätten: kebab ${byId.kebab.fill} > falafel ${byId.falafel.fill} > pommes ${byId.pommes.fill} > läsk ${byId.lask.fill}`);
ok(await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true })) === null, 'utan mat får man gå (leaveBlock = null)');

// ---- beställning med riktiga klick ----
await clickSpot('disk');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000), 'klick på disken → figuren går dit och menyn öppnas');
const menuText = await page.evaluate(() => document.querySelector('#modal').innerText);
ok(/Kebabrulle[\s\S]*45\s*kr/.test(menuText) && /Falafelrulle[\s\S]*40\s*kr/.test(menuText) && /Pommes[\s\S]*25\s*kr/.test(menuText) && /Läsk[\s\S]*15\s*kr/.test(menuText), 'menyn visar alla fyra rätterna med pris');
ok(/Vitlök/.test(menuText) && /Stark/.test(menuText) && /Mix/.test(menuText), 'såsvalet finns: vitlök, stark, mix');
await page.click('[data-pick="kebab"]');
await page.click('[data-pick="lask"]');
await page.click('[data-sas="vitlok"]');
const bestall = await page.evaluate(() => document.querySelector('.dlg-foot .btn-go')?.innerText || '');
ok(/60\s*kr/.test(bestall), `beställknappen visar summan (${bestall.replace(/\s+/g, ' ').trim()})`);
const before = await S();
await page.click('.dlg-foot .btn-go');
await sleep(200);
let s = await S();
ok(s.money === before.money - 60, `betalt 60 kr (${before.money} → ${s.money})`);
ok(s.order === true && (s.me === 'wait' || s.me === 'toCounter'), `beställningen ligger hos kocken (${s.me})`);
ok(s.sauce === 'vitlok', 'vitlökssås vald');
ok(typeof await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true })) === 'string', 'betald mat: leaveBlock spärrar');

// kocken lagar: spett → sallad → sås → rulla → läskkylen → fram på disken
const acts = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 30000) { s = await S(); if (s.cookAct) acts.add(s.cookAct); if (s.me === 'carry') break; await sleep(120); }
ok(s.me === 'carry', `maten är klar – figuren bär brickan (${s.me})`);
ok(acts.has('spett') && acts.has('sallad') && acts.has('kyl'), `kocken skar från spettet, fyllde ur salladsbaren och hämtade läsken (${[...acts].join(', ')})`);
const tray0 = await D('tray');
ok(tray0 && tray0.length === 2 && tray0.some((i) => i.id === 'kebab' && i.stage === 0) && tray0.some((i) => i.id === 'lask' && i.stage === 0), `brickan: kebabrulle + läsk, orörda (${JSON.stringify(tray0)})`);
await page.screenshot({ path: OUT + 'test-1-brickan.png' });

// ---- ätregeln: med maten i händerna öppnas inte dörren ----
const hCarry = s.hunger;
await clickSpot('dorr');
await sleep(700);
s = await S();
ok(await page.evaluate(() => window.SF.sceneName) === 'kebab', 'dörren med maten i händerna: man stannar inne');
ok(s.say === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!', `repliken: ${s.say}`);
ok(s.got.fill === 0 && s.hunger <= hCarry, 'ingen mättnad medan man bär maten');

// ---- sätt dig: klick på ett ledigt bord ----
await clickSpot('bord');
ok(await waitFor(() => !!window.SF.scene._debug.seated(), 12000), 'klick på ett ledigt bord → figuren sätter sig');
const seat = await D('seated');
// mitt i maten: dörren och golvet håller en kvar
await sleep(300);
await clickSpot('dorr');
await sleep(400);
s = await S();
ok(await page.evaluate(() => window.SF.sceneName) === 'kebab' && s.seat === seat, `mitt i maten: klick på dörren → sitter kvar (${s.say})`);
await clickSpot('golv');
await sleep(300);
s = await S();
ok(s.seat === seat && s.say === 'ÄT UPP FÖRST! 😋', `mitt i maten: klick på golvet → "ÄT UPP FÖRST!" och sitter kvar (${s.say})`);

// ---- tugga för tugga ----
const seen = new Set();
const t1 = Date.now();
while (Date.now() - t1 < 25000) { s = await S(); seen.add(s.got.fill); if (!s.tray && !s.order) break; await sleep(100); }
const steps = [...seen].sort((a, b) => a - b);
ok(steps.length >= 5, `mättnaden kom tugga för tugga (${steps.join(' → ')})`);
ok(s.got.fill === 60 && s.got.energy === 20, `uppätet: exakt kebabrullens + läskens mättnad 56+4=60 och energi 8+12=20 (${s.got.fill}/${s.got.energy})`);
ok(s.tray === null && s.order === false, 'brickan försvann först när allt var uppätet');
ok(await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true })) === null, 'uppätet: leaveBlock släpper');
await page.screenshot({ path: OUT + 'test-2-uppatet.png' });

// ---- en rulle per beställning, mättnaden efter rätten ----
let r = await D('forceBuy', ['falafel', 'kebab', 'pommes'], 'stark');
ok(r.ok && r.items.join(',') === 'falafel,pommes' && r.price === 65 && r.fill === 48 + 21, `bara en rulle per beställning: falafel + pommes = 65 kr, mättar ${r.fill}`);

// ---- sidan laddas om mitt i maten: resten räknas in och sparas direkt ----
ok(await waitFor(() => window.SF.scene._debug.state().me === 'carry', 30000), 'falafel + pommes klara');
const pall = await freeSeat(true);
await D('sit', pall.id);
ok(await waitFor((id) => window.SF.scene._debug.seated() === id, 12000, pall.id), `sätter sig vid fönstret (barstolen ${pall.id})`);
ok(await waitFor(() => window.SF.scene._debug.state().got.fill > 60, 8000), 'första tuggan av falafeln');
s = await S();
const gotBefore = s.got.fill;
await page.evaluate(() => window.dispatchEvent(new Event('sf:before-reload')));
s = await S();
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1')));
ok(s.got.fill === 60 + 69, `omladdning mitt i maten: resten räknades in (${gotBefore} → ${s.got.fill})`);
ok(Math.abs(saved.hunger - s.hunger) < 0.01, `och sparades direkt (sparad mättnad ${saved.hunger?.toFixed?.(1)} = ${s.hunger})`);
await D('tick', 12);
s = await S();
ok(s.got.fill === 60 + 69, `tuggorna efteråt ger inget extra (${s.got.fill})`);
ok(s.order === false, 'och maten tar slut som vanligt');

// ---- fliken byts / mobilen låses mitt i maten: mätaren hoppar inte, sparfilen har resten ----
await page.evaluate(() => { const g = window.SF.game; g.hunger = 20; g.energy = 30; g.money = 300; g.save(); });
r = await D('forceBuy', ['kebab', 'pommes'], 'vitlok');
ok(r.ok && r.price === 70 && r.fill === 77, `kebabrulle + pommes: 70 kr, mättar ${r.fill}`);
const got0 = (await S()).got;
// allt i EN evaluate: ingen bildruta hinner spara emellan
const hid = await page.evaluate(() => {
  const sc = window.SF.scene._debug, before = sc.state();
  Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
  Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  const after = sc.state(), disk = JSON.parse(localStorage.getItem('snabbfilen_save1'));
  delete document.visibilityState; delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
  return { before, after, disk };
});
ok(hid.before.me === 'wait' || hid.before.me === 'toCounter', `fliken byts medan ${'Deniz'} lagar maten (${hid.before.me})`);
ok(hid.after.hunger === hid.before.hunger && hid.after.energy === hid.before.energy && hid.after.got.fill === hid.before.got.fill && hid.after.me === hid.before.me,
  `mätaren hoppar INTE (mättnad ${hid.before.hunger} → ${hid.after.hunger}, ${hid.after.me})`);
ok(Math.abs(hid.disk.hunger - (hid.before.hunger + 77)) < 0.01 && Math.abs(hid.disk.energy - (hid.before.energy + 11)) < 0.01 && hid.disk.money === hid.after.money,
  `men sparfilen har hela måltiden om fliken dödas i bakgrunden (sparad mättnad ${hid.disk.hunger} = ${hid.before.hunger} + 77, energi ${hid.disk.energy})`);
ok(await waitFor(() => window.SF.scene._debug.state().me === 'carry', 30000), 'maten klar – tillbaka i fliken bär man brickan som vanligt');
const plats0 = await freeSeat(false);
await D('sit', plats0.id);
ok(await waitFor((id) => window.SF.scene._debug.seated() === id, 12000, plats0.id), `sätter sig (${plats0.id})`);
ok(await waitFor((f) => window.SF.scene._debug.state().got.fill > f, 8000, got0.fill), 'första tuggan');
// sidan stängs (pagehide) mitt i maten – och menyns figurbyte / en återställd sparning
const ph = await page.evaluate(() => {
  const sc = window.SF.scene._debug, g = window.SF.game, before = sc.state();
  window.dispatchEvent(new Event('pagehide'));
  const after = sc.state(), disk = JSON.parse(localStorage.getItem('snabbfilen_save1'));
  // figurbyte i menyn: sparningen byts och märks (sf_menu_skip) precis före omladdningen
  const other = JSON.stringify({ v: 1, day: 9, min: 600, money: 12345, hunger: 70, energy: 70, home: 'rum', fridge: {}, jobs: {}, earned: 0 });
  sessionStorage.setItem('sf_menu_skip', '1'); localStorage.setItem('snabbfilen_save1', other);
  window.dispatchEvent(new Event('pagehide'));
  Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  delete document.visibilityState;
  const keptSkip = localStorage.getItem('snabbfilen_save1') === other;
  sessionStorage.removeItem('sf_menu_skip');
  // en annan sparning utan märkning (annan dag och andra pengar) är inte heller vår
  window.dispatchEvent(new Event('pagehide'));
  const keptOther = localStorage.getItem('snabbfilen_save1') === other;
  g.save(); // tillbaka till testets egen sparning
  return { before, after, disk, keptSkip, keptOther };
});
const restF = 77 - (ph.before.got.fill - got0.fill), restE = 11 - (ph.before.got.energy - got0.energy);
ok(ph.after.hunger === ph.before.hunger && ph.after.got.fill === ph.before.got.fill && ph.after.seat === ph.before.seat && ph.after.order,
  `pagehide mitt i maten: mätaren hoppar inte och man sitter kvar (${ph.before.got.fill - got0.fill} av 77 ätet)`);
ok(Math.abs(ph.disk.hunger - Math.min(100, ph.before.hunger + restF)) < 0.01 && Math.abs(ph.disk.energy - Math.min(100, ph.before.energy + restE)) < 0.01,
  `sparfilen har resten (${restF}): ${ph.disk.hunger} = ${ph.before.hunger} + ${restF}`);
ok(ph.keptSkip, 'menyns figurbyte (sf_menu_skip): den nya sparningen skrivs INTE över');
ok(ph.keptOther, 'en annan sparning (annan dag/pengar) skrivs inte över');
const seenB2 = new Set();
const t3 = Date.now();
while (Date.now() - t3 < 30000) { s = await S(); seenB2.add(s.got.fill - got0.fill); if (!s.tray && !s.order) break; await sleep(100); }
const steps2 = [...seenB2].sort((a, b) => a - b);
ok(s.got.fill - got0.fill === 77 && s.got.energy - got0.energy === 11 && steps2.length >= 6,
  `tuggorna fortsätter som vanligt och blir exakt 77/11 (${steps2.join(' → ')})`);

// ---- scenen byts mitt i maten (somnar, 👥-menyn …): resten räknas in i exit() ----
await page.evaluate(() => { window.SF.game.hunger = 5; window.SF.game.energy = 10; });
r = await D('forceBuy', ['kebab'], 'mix');
ok(r.ok && r.price === 45 && r.fill === 56, 'kebabrulle 45 kr, mättar 56');
ok(await waitFor(() => window.SF.scene._debug.state().me === 'carry', 30000), 'rullen klar');
const plats = await freeSeat(false);
await D('sit', plats.id);
await waitFor((id) => window.SF.scene._debug.seated() === id, 12000, plats.id);
ok(await waitFor(() => window.SF.scene._debug.state().got.fill > 129 + 77, 8000), 'första tuggan');
s = await S();
const hMid = s.hunger, left = 60 + 69 + 77 + 56 - s.got.fill;
await page.evaluate(() => window.SF.go('city'));
await sleep(300);
const hAfter = await page.evaluate(() => window.SF.game.hunger);
ok(Math.abs(hAfter - (hMid + left)) < 0.6, `scenbyte mitt i maten: resten (${left}) räknades in (${hMid} → ${hAfter.toFixed(1)})`);

// ---- tillbaka in: inte råd, upptagen plats, gästerna ----
await enterKebab();
await sleep(300);
await page.evaluate(() => { window.SF.game.money = 10; });
r = await D('forceBuy', ['kebab']);
ok(!r.ok && /råd/.test(r.msg), `10 kr räcker inte till en rulle (${r.msg})`);
await D('openMenu', { main: 'kebab' });
ok(await page.evaluate(() => document.querySelector('.dlg-foot .btn-go')?.disabled === true), 'menyn: Beställ är gråad när man inte har råd');
await page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
await page.evaluate(() => { window.SF.game.money = 200; });
const taken = (await D('seats')).find((x) => x.occ === 'npc');
if (taken) {
  r = await D('forceBuy', ['pommes']);
  await waitFor(() => window.SF.scene._debug.state().me === 'carry', 30000);
  await clickSpot(taken.id);
  await sleep(300);
  s = await S();
  ok(/sitter någon redan/.test(s.say || ''), `upptagen plats (${taken.id}): "${s.say}"`);
  s = await D('eatFast');
  ok(s.order === false, 'pommesen uppätna');
} else ok(true, 'ingen stamgäst i dag – hoppar över testet med upptagen plats');

// gästerna: kommer in, köar, beställer, äter eller tar med sig – inga fel, disken svämmar inte över
const states = new Set();
let maxTrays = 0;
for (let k = 0; k < 20; k++) { await D('tick', 4); s = await S(); s.guests.forEach((x) => states.add(x)); maxTrays = Math.max(maxTrays, s.traysOnCounter); }
ok(states.has('queue') && (states.has('leave') || states.has('carry')), `gästerna lever (${[...states].join(', ')})`);
ok(maxTrays <= 3, `maten blir inte stående på disken (högst ${maxTrays})`);
await page.screenshot({ path: OUT + 'test-3-gaster.png' });

// ---- två spelare: Bosse ser mig SITTA på barstolen och kan inte ta platsen ----
const ctxB = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const pageB = await ctxB.newPage();
pageB.on('pageerror', (e) => errs.push('Bosse: ' + e.message));
await pageB.goto(`http://localhost:${PORT}/index.html?nomenu&world=${WORLD}`);
await pageB.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Bosse', look: { skin: '#8d5a3b', hair: '#111111', style: 'short', shirt: '#46a35a', pants: '#3c3c3c' }, color: '#3a7bd5' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 300, hunger: 60, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await pageB.reload();
await pageB.waitForFunction(() => !!window.SF?.game && !!window.SF.worldInfo, null, { timeout: 20000 });
const online = await waitFor(() => window.SF.worldInfo().online >= 2, 30000);
if (!online) ok(true, 'tvåspelardelen hoppades över – ingen uppkoppling mot världen just nu');
else {
  await pageB.evaluate(async () => { try { window.SF.go('kebab'); } catch { const m = await import('/js/scenes/shop-kebab.js'); window.SF.scene?.exit?.(); window.SF.sceneName = 'kebab'; window.SF.scene = m.makeShopKebab(window.SF); } });
  await page.evaluate(() => { window.SF.game.money = 200; });
  await D('forceBuy', ['falafel'], 'mix');
  await waitFor(() => window.SF.scene._debug.state().me === 'carry', 30000);
  const bar = await freeSeat(true);
  await D('sit', bar.id);
  await waitFor((id) => window.SF.scene._debug.seated() === id, 12000, bar.id);
  const DB = (fn, ...a) => pageB.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
  let seenB = null;
  const t2 = Date.now();
  while (Date.now() - t2 < 15000) {
    seenB = await pageB.evaluate(async () => { const w = await import('/js/net/world.js'); return w.worldFolksHere(window.SF).map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), sit: f.sit, eat: f.eat }))[0] || null; });
    if (seenB && seenB.sit) break;
    await sleep(250);
  }
  ok(!!seenB?.sit && seenB.x === bar.x && seenB.y === bar.y && seenB.eat, `Bosse ser mig sitta och äta på barstolen (${JSON.stringify(seenB)})`);
  const occB = await (async () => { for (let i = 0; i < 20; i++) { const o = (await DB('seats')).find((x) => x.id === bar.id)?.occ; if (o === 'remote') return o; await sleep(250); } return null; })();
  ok(occB === 'remote', 'barstolen är upptagen hos Bosse också');
  await DB('sit', bar.id);
  await sleep(2500);
  ok((await DB('state')).seat !== bar.id, 'Bosse sätter sig inte i knät på mig');
  await DB('lockCam', Math.max(0, bar.x - 150));
  await sleep(400);
  await pageB.screenshot({ path: OUT + 'test-4-bosse-ser-mig.png' });
  await D('eatFast');
}
await ctxB.close();

// ---- dörren ut när man ätit upp ----
await D('teleport', 230, 130);
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'klick på dörren när man ätit upp → ut i staden');

// ---- mobilen: 844×390 i fyll-läget NÄRA – överkanten beskärs, kameran följer på höjden ----
const ctxM = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const pm = await ctxM.newPage();
pm.on('pageerror', (e) => errs.push('mobilen: ' + e.message));
await pm.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill=1&world=${WORLD}m`);
await pm.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_zoom', 'nara');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobil', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 300, hunger: 30, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await pm.reload();
await pm.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await pm.evaluate(async () => { try { window.SF.go('kebab'); } catch { const m = await import('/js/scenes/shop-kebab.js'); window.SF.scene?.exit?.(); window.SF.sceneName = 'kebab'; window.SF.scene = m.makeShopKebab(window.SF); window.SF.scene.enter?.(); } });
const DM = (fn, ...a) => pm.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
// vänta tills skärmen har lagt sig (utan main.js-patchen byggs scenen utan fit() – rutan kan
// ändras en stund efteråt) och kameran står still
for (let k = 0, last = null, same = 0; k < 40 && same < 3; k++) {
  await pm.waitForTimeout(100);
  const now = JSON.stringify([await DM('safe'), await DM('camY')]);
  same = now === last ? same + 1 : 0; last = now;
}
const safe = await DM('safe');
ok(safe.y0 >= 30 && safe.y1 < 216, `mobilen beskär överkanten (synligt y ${safe.y0}–${safe.y1})`);
const inSafe = (p) => p && p.y >= safe.y0 && p.y <= safe.y1 && p.x >= safe.x0 && p.x <= safe.x1;
// tryck som en riktig spelare: vyns spelpixlar → skärmen (canvasen är förstorad och beskuren)
async function tapView(x, y) {
  const r = await pm.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await pm.touchscreen.tap(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
const vis = () => pm.evaluate(() => { const d = window.SF.scene._debug; return { camY: d.camY(), top: d.safe().y0 - d.camY(), bottom: d.safe().y1 - d.camY() }; });
let v = await vis();
ok(v.top <= 4, `vid dörren syns hela väggen (synliga världsrader ${v.top}–${v.bottom}, cam.y ${v.camY})`);
const diskM = await DM('spot', 'disk');
ok(inSafe(diskM), `disken går att trycka på (${JSON.stringify(diskM)})`);
await tapView(diskM.x, diskM.y);
ok(await pm.waitForFunction(() => !document.querySelector('#modal').classList.contains('hidden'), null, { timeout: 12000 }).then(() => true, () => false), 'tryck på disken → figuren går dit och menyn öppnas');
v = await vis();
ok(v.top <= 4 && v.camY > 0, `vid disken: menytavlan (y 4–47) och spetten syns hela (synligt ${v.top}–${v.bottom}, cam.y ${v.camY})`);
await pm.click('[data-pick="kebab"]');
await pm.click('[data-pick="lask"]');
await pm.click('.dlg-foot .btn-go');
await pm.waitForTimeout(250);
const cookTop = await DM('bubbleTop', 'cook'), cookSay = (await DM('state')).cookSay;
ok(cookSay && /tack/i.test(cookSay) && cookTop !== null && cookTop >= safe.y0, `Deniz bekräftelse syns hela ("${cookSay}", överkant ${cookTop} ≥ ${safe.y0})`);
await pm.screenshot({ path: OUT + 'mobil-1-disken.png' });
ok(await pm.waitForFunction(() => window.SF.scene._debug.state().me === 'carry', null, { timeout: 30000 }).then(() => true, () => false), 'maten klar – brickan i händerna');
// borden längst fram (t2) ligger under bild vid disken: tryck på golvet längst ner → kameran glider ner
const t2 = (await DM('seats')).find((x) => x.id === 't2b');
let sp2 = await DM('spot', 't2b');
ok(!inSafe(sp2), `vid disken ligger bordet längst fram under bild (y ${Math.round(sp2.y)} > ${safe.y1})`);
let taps = 0;
for (; taps < 3 && !inSafe(sp2); taps++) {
  await tapView(Math.max(safe.x0 + 20, Math.min(safe.x1 - 20, t2.x - 24 - (await DM('cam')))), safe.y1 - 6);
  await pm.waitForTimeout(2500); // figuren går, kameran glider efter
  sp2 = await DM('spot', 't2b');
}
ok(inSafe(sp2) && taps <= 2, `efter ${taps} tryck på golvet syns bordet längst fram (t2b på skärmen y ${Math.round(sp2.y)})`);
await tapView(sp2.x, sp2.y);
ok(await pm.waitForFunction(() => window.SF.scene._debug.seated() === 't2b', null, { timeout: 12000 }).then(() => true, () => false), 'tryck på stolen → figuren sätter sig och äter');
await pm.waitForTimeout(1200);
v = await vis();
const seatedM = await DM('spot', 't2b');
ok(v.bottom >= 200 && inSafe(seatedM), `vid bordet längst fram syns golvet och bordet (synligt ${v.top}–${v.bottom})`);
// Deniz ropar något när man sitter långt ner: bubblan glider ner under den synliga överkanten
await DM('cookSay', 'Vill du ha mer sås till rullen? Det finns gott om vitlök kvar!');
await pm.waitForTimeout(150);
const cookTop2 = await DM('bubbleTop', 'cook'), safe2 = await DM('safe');
ok(cookTop2 !== null && cookTop2 >= safe2.y0, `Deniz bubbla syns hela även från bordet (överkant ${cookTop2} ≥ ${safe2.y0}, kocken står ovanför bild)`);
// pekskylten: ritas innanför den synliga nederkanten
await DM('hover', 'dorr');
await pm.waitForTimeout(150);
const lab = await pm.evaluate(() => {
  const c = document.querySelector('#scene'), A = window.SF, sb = A.scene._debug.safe(), x = c.getContext('2d');
  const px = (gx, gy) => Array.from(x.getImageData(Math.floor((gx + 0.5) * A.pxs), Math.floor((gy + 0.5) * A.pxs), 1, 1).data).slice(0, 3);
  return { sb, line: px(sb.x0 + ((sb.x1 - sb.x0) >> 1), sb.y1 - 13), under: px(sb.x0 + ((sb.x1 - sb.x0) >> 1), sb.y1 - 12) };
});
ok(Math.abs(lab.line[0] - 0xe8) < 6 && Math.abs(lab.line[1] - 0xb2) < 6 && Math.abs(lab.line[2] - 0x30) < 6, `pekskylten ligger innanför den synliga nederkanten (y ${lab.sb.y1 - 14}, guldkant ${lab.line})`);
await pm.screenshot({ path: OUT + 'mobil-2-bordet.png' });
await DM('eatFast');
ok((await DM('state')).order === false, 'uppätet på mobilen också');
await ctxM.close();

console.log(errs.length ? 'KONSOLFEL: ' + errs.join(' | ') : 'inga konsolfel');
ok(errs.length === 0, 'inga fel i konsolen');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
