// Kontroller av hemmet (Playwright, servern på 8788):
//   node tools/room-check.mjs
//  A. Startmöbleringen i varje delrum står rätt från början (ingen flytt, ingen toast).
//  B. Väggsaker: gardiner får hänga över fönstret, tavlor inte; inget över dörrarna.
//  C. Tangenten R roterar inte monsteran (den har bara en vy).
//  D. fitRoom knuffar en väggsak som hänger 1 px för lågt uppåt i stället för till förrådet,
//     och ett högt skåp som stod vid bakväggen blir kvar vid väggen (närmaste plats, inte hörnet).
//  E. Fullt förråd: möbler som inte får plats står kvar (inne i lokalen) – inget försvinner,
//     förrådet växer inte förbi taket.
//  F. Förrådspanelen i Möblera-läget döljer aldrig canvasen (1180×760, 1366×768, 1280×720).
//  G. Kylskåpet (startmöbeln) har en ruta på 16×28 – ingen tom luft ovanför.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errs.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?world=rc${Date.now().toString(36)}`);
const SAVE = (home, deco = {}, storage = []) => ({ v: 1, day: 3, min: 600, money: 5000, hunger: 90, energy: 90, home, fridge: { pizza: 1 }, jobs: {}, earned: 0, wardrobe: [], storage, deco, won: false });
await page.evaluate((save) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Koll', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(save));
}, SAVE('rum'));
await page.reload();
await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 15000 });
await page.waitForTimeout(500);

// byt bostad/delrum med given möblering (deco = hela deco-objektet, storage = förrådet)
const enter = async (home, sub, deco = {}, storage = []) => {
  await page.evaluate(({ home, sub, deco, storage }) => {
    document.querySelector('#toasts').innerHTML = '';
    const g = window.SF.game;
    if (window.SF.sceneName === 'room') window.SF.scene.toggleDecor(false);
    g.home = home; g.deco = deco; g.storage = storage; g.save();
    window.SF.roomSub = sub;
    window.SF.go('room');
  }, { home, sub, deco, storage });
  await page.waitForTimeout(250);
};
const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
const state = () => page.evaluate(() => ({ deco: JSON.parse(JSON.stringify(window.SF.game.deco)), storage: JSON.parse(JSON.stringify(window.SF.game.storage)), allFit: window.SF.scene._debug.allFit(), partition: window.SF.scene._debug.partition }));

// ---------- A. startmöbleringen ----------
console.log('\nA. startmöbleringen står rätt i alla delrum');
for (const [home, subs] of [['rum', 1], ['lagenhet', 2], ['villa', 3]]) for (let sub = 0; sub < subs; sub++) {
  await enter(home, sub);
  const s = await state();
  const t = await toasts();
  // listan hemma ska vara exakt startmöbleringen (samma sort på samma plats – inget knuffat, inte ens tyst)
  const same = await page.evaluate((k) => { const a = window.SF.game.deco[k], b = window.SF.scene._debug.seeds(); return a.length === b.length && a.every((d, i) => d.k === b[i].k && d.x === b[i].x && d.y === b[i].y); }, `${home}:${sub}`);
  ok(s.allFit && same && !/knuffades|förråd|inte plats/i.test(t), `${home}:${sub} – ${s.deco[`${home}:${sub}`].length} startmöbler exakt där de seedas, ingen toast${t ? ` (toast: ${t})` : ''}`);
}
{ // kylskåpet i villans kök står till vänster om SOVRUM-dörren
  await enter('villa', 2);
  const r = await page.evaluate(() => { const d = window.SF.scene._debug; const k = window.SF.game.deco['villa:2'].find((d) => d.k === 'kylskap'); return { k, doors: d.doors, props: d.props().filter((p) => p.k === 'kylskap' || p.k === 'matstol') }; });
  ok(r.k.x === 270 && r.doors.every((dr) => r.k.x + 17 <= dr[0] || r.k.x - 1 >= dr[2]), `villans kylskåp på x=${r.k.x}, utanför dörrarna ${JSON.stringify(r.doors.map((d) => [d[0], d[2]]))}`);
  ok(r.props.filter((p) => p.k === 'matstol').length === 2, 'två matstolar vid köksbordet (inte gamingstolar)');
}

// ---------- B. fönsterregeln ----------
console.log('\nB. väggsaker och fönster');
{
  await enter('villa', 0, {}, [{ k: 'gardin', v: 3 }, { k: 'landskap', v: 0 }, { k: 'draperi', v: 1 }]);
  const r = await page.evaluate(() => {
    const d = window.SF.scene._debug; const sc = window.SF.scene;
    sc.toggleDecor(true);
    const out = { windows: d.windows };
    d.pickStorage(0); out.gardinOverWindow = d.canPlace(100, 45); out.gardinOverDoor = d.canPlace(45, 45);
    d.pickStorage(1); out.landskapOverWindow = d.canPlace(100, 45); out.landskapBeside = d.canPlace(200, 45); out.landskapOverDoor = d.canPlace(45, 45);
    d.pickStorage(2); out.draperiOverWindow = d.canPlace(157, 45);
    out.dropped = d.drop(157, 45); // draperiet hängs över fönster 2
    d.pickStorage(1); out.landskapOverDraperi = d.canPlace(157, 45);
    sc.toggleDecor(false);
    return out;
  });
  ok(r.windows.length === 3, `villans vardagsrum har ${r.windows.length} fönster: ${JSON.stringify(r.windows)}`);
  ok(r.gardinOverWindow === true && r.draperiOverWindow === true, 'gardin och draperi får hänga över fönstret');
  ok(r.landskapOverWindow === false && r.landskapBeside === true, 'landskapsmålningen får inte hänga över fönstret men bredvid');
  ok(r.gardinOverDoor === false && r.landskapOverDoor === false, 'inget får hänga över dörren');
  ok(r.dropped === true && r.landskapOverDraperi === false, 'draperiet hängdes upp – och tavlan får inte hänga över draperiet');
}

// ---------- C. R på monsteran ----------
console.log('\nC. R-tangenten och monsteran');
{
  await enter('villa', 0);
  const r = await page.evaluate(() => {
    const d = window.SF.scene._debug; const sc = window.SF.scene; const g = window.SF.game;
    sc.toggleDecor(true);
    const i = g.deco['villa:0'].findIndex((d) => d.k === 'vaxt');
    d.pick(i); sc.key('r'); sc.key('R'); d.rotate();
    const dropped = d.drop(g.deco['villa:0'][i].x + 10, g.deco['villa:0'][i].y);
    const j = g.deco['villa:0'].findIndex((d) => d.k === 'soffa');
    d.pick(j); sc.key('r');
    const soffaR = window.SF.scene._debug.canPlace(120, 190); // bara för att carry ska finnas kvar
    const rot = document.querySelector('#decor-rotate').textContent;
    sc.toggleDecor(false);
    return { dropped, r: g.deco['villa:0'][i].r, soffaR, rot, soffaSaved: g.deco['villa:0'][j].r };
  });
  ok(r.dropped && !r.r, `monsteran fick ingen rotation (r=${r.r})`);
  ok(/höger/.test(r.rot) && !r.soffaSaved, `soffan vrids med R (${r.rot}) – men avbruten vridning sparas inte (r=${r.soffaSaved})`);
}

// ---------- D. fitRoom: knuffa uppåt + skåp vid väggen ----------
console.log('\nD. fitRoom knuffar rätt');
{
  await enter('villa', 1, { 'villa:1': [{ k: 'sang', v: 1, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 250, y: 96, fx: 1 }, { k: 'tvattstall', v: 0, x: 100, y: 84 }] });
  const s = await state(); const t = await toasts();
  const tv = s.deco['villa:1'].find((d) => d.k === 'tvattstall');
  ok(tv && tv.y <= 83 && tv.y >= 80 && tv.x === 100 && s.storage.length === 0, `tvättstället 1 px för lågt knuffades upp till y=${tv?.y} (inte till förrådet); toast: ${t}`);
  ok(s.allFit && /knuffades/.test(t) && !/förråd/.test(t), 'toasten säger "knuffades" – inte "titta i förrådet"');
  // gammal sparfil i Lilla rummet (225 px brett förr): garderoben utanför ska hamna vid väggen
  await enter('rum', 0, { 'rum:0': [{ k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'kylskap', v: 0, x: 150, y: 94, fx: 1 }, { k: 'garderob', v: 0, x: 180, y: 96, fx: 1 }, { k: 'bokhylla', v: 0, x: 195, y: 140 }] });
  const s2 = await state(); const t2 = await toasts();
  const gd = s2.deco['rum:0'].find((d) => d.k === 'garderob'), bh = s2.deco['rum:0'].find((d) => d.k === 'bokhylla');
  ok(gd && gd.y === 96 && gd.x + 35 <= 176 - 5, `garderoben står kvar vid bakväggen (x=${gd?.x}, y=${gd?.y})`);
  ok(bh && bh.x + 34 <= 171 && s2.allFit, `bokhyllan flyttades in i lokalen (x=${bh?.x}, y=${bh?.y}); dass tillagt: ${s2.deco['rum:0'].some((d) => d.k === 'dass')}`);
  ok(/knuffades/.test(t2) && !/förråd/.test(t2), `bara startmöbler + en möbel knuffades → toast: ${t2}`);
  // bara startmöbler som knuffas → ingen toast alls
  await enter('rum', 0, { 'rum:0': [{ k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'kylskap', v: 0, x: 150, y: 94, fx: 1 }, { k: 'garderob', v: 0, x: 180, y: 96, fx: 1 }] });
  const t3 = await toasts();
  ok(!/knuffades|förråd|inte plats/.test(t3), `startmöbler som knuffas tyst ger ingen toast (${t3 || 'tyst'})`);
}

// ---------- E. fullt förråd ----------
console.log('\nE. fullt förråd – inget försvinner');
{
  const storage = Array.from({ length: 80 }, (_, i) => ({ k: 'stol', v: i % 4 }));
  const shelves = Array.from({ length: 40 }, (_, i) => ({ k: 'bredhylla', v: i % 3, x: 200 + (i % 4) * 30, y: 100 + ((i / 4) | 0) * 12, c: '#aa00' + String(i).padStart(2, '0') }));
  await enter('rum', 0, { 'rum:0': [{ k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, ...shelves] }, storage);
  await page.waitForTimeout(300);
  const s = await state(); const t = await toasts();
  const room = s.deco['rum:0'].filter((d) => d.k !== 'dass');
  ok(room.length === 41 && s.storage.length === 80, `41 möbler kvar i rummet, förrådet exakt 80 (${room.length} + ${s.storage.length})`);
  ok(shelves.every((sh) => room.some((d) => d.k === 'bredhylla' && d.c === sh.c)), 'alla 40 färgade hyllor finns kvar med sin färg');
  ok(room.every((d) => d.x >= 8 && d.x + 47 <= s.partition - 5 || d.k !== 'bredhylla'), 'hyllorna står inne i lokalen (går att plocka upp)');
  ok(/Förrådet är fullt/.test(t), `toast: ${t}`);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 15000 });
  await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
  await page.waitForTimeout(300);
  const s2 = await state();
  ok(s2.deco['rum:0'].filter((d) => d.k !== 'dass').length === 41 && s2.storage.length === 80, 'efter omladdning: fortfarande 41 + 80');
}

// ---------- F. panelen döljer inte canvasen ----------
console.log('\nF. förrådspanelen och canvasen');
for (const [w, h] of [[1180, 760], [1366, 768], [1280, 720], [1600, 900]]) {
  await page.setViewportSize({ width: w, height: h });
  await enter('villa', 0);
  const before = await page.evaluate(() => document.querySelector('#scene').getBoundingClientRect().width);
  await page.evaluate(() => window.SF.scene.toggleDecor(true));
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const c = document.querySelector('#scene').getBoundingClientRect(), p = document.querySelector('#decor-panel').getBoundingClientRect();
    return { cRight: c.right, pLeft: p.left, cw: c.width, hidden: Math.max(0, Math.round((c.right - p.left) / (c.width / 384))), on: document.body.classList.contains('decor-on') };
  });
  await page.evaluate(() => window.SF.scene.toggleDecor(false));
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => document.querySelector('#scene').getBoundingClientRect().width);
  ok(r.on && r.cRight <= r.pLeft, `${w}×${h}: canvasens högerkant ${Math.round(r.cRight)} ≤ panelens vänsterkant ${Math.round(r.pLeft)} (dolda spelpixlar: ${r.hidden})`);
  ok(before === after, `${w}×${h}: canvasen tillbaka i full storlek efter Klar (${before} px)`);
}
await page.setViewportSize({ width: 1180, height: 760 });

// ---------- G. kylskåpet ----------
console.log('\nG. kylskåpsrutan');
{
  await enter('rum', 0);
  const r = await page.evaluate(async () => {
    const { FRAMES } = await import('/js/data/frames.js');
    const p = window.SF.scene._debug.props().find((p) => p.k === 'kylskap');
    return { f: FRAMES.kylskap0, f1: FRAMES.kylskap1, solid: p?.solid, spot: window.SF.scene._debug.spot('kylskap'), n: Object.keys(FRAMES).length };
  });
  ok(r.f?.[2] === 16 && r.f?.[3] === 28 && !r.f1, `kylskap0 är 16×28 (${JSON.stringify(r.f)}), kylskap1 borttagen, ${r.n} rutor i atlasen`);
  ok(r.spot && r.spot.y > 66 && r.spot.y < 96, `kylskåpets klickyta börjar vid möbelns topp (mitt ${JSON.stringify(r.spot)})`);
}

console.log(errs.length ? '\nKONSOLFEL:\n' + errs.join('\n') : '\nInga konsolfel.');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
