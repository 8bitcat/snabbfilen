// Bostäderna (js/scenes/room.js + js/game.js + bostadsbyrån), Playwright mot servern
// på 8788:   node tools/homes-test.mjs        (annan port: SMOKE_PORT=8791)
//  1. flytta in i varje bostad (pengar sätts): husvagn, hoghus, radhus, takvaning,
//     rum, lagenhet, villa – gå igenom ALLA delrum via dörrarna i bakväggen
//  2. i varje bostad finns säng + kylskåp + garderob (som helhet, via startmöbleringen)
//     och startmöbleringen står rätt (allFit) i varje delrum
//  3. sov i sängen i varje bostad (dagen tickar, veckopanelen stängs)
//  4. mobilfyllningen: husvagn/hoghus/radhus/takvaning fyller hela 384 (gård/trapphus/
//     full planlösning – ingen contentBox), rum och lagenhet beskärs med contentBox
//  5. flytt fram och tillbaka: möbleringen per bostad (g.deco per hem:sub) och
//     förrådet ligger kvar orörda
//  6. bostadsbyråns posterImage(homeId) ger en egen bild för alla sju bostäder
// Bilder: tools/out/homes-*.png (en per bostad). Inga konsolfel får förekomma.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const OUT = 'D:/GamesProjects/snabbfilen/tools/out/';
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?world=ht${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Bostadstest', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 9 * 60, money: 100000, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 20000 });
await page.waitForTimeout(500);

const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const until = async (fn, arg, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(120); } return false; };
const closeModals = async () => { for (let i = 0; i < 4; i++) { const open = await ev(() => !document.getElementById('modal').classList.contains('hidden')); if (!open) return; await ev(() => (document.querySelector('#modal [data-close]') || [...document.querySelectorAll('#modal .dlg-foot .btn')].pop())?.click()); await wait(250); } };
const canvasPng = async (name, scale = 3) => {
  const url = await ev((s) => {
    const c = document.querySelector('#scene');
    const o = document.createElement('canvas'); o.width = 384 * s; o.height = 216 * s;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, scale);
  fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log('   → tools/out/' + name + '.png');
};
// klicka i rummets värld via scenens down (rummet har ingen kamera)
const sceneDown = (x, y) => ev(([x, y]) => window.SF.scene.down(x, y), [x, y]);

// Bostäderna: delrum, förväntad contentBox (null = fyller hela 384) och sängens sort
const HOMES = [
  { id: 'husvagn', subs: 1, cb: null },
  { id: 'hoghus', subs: 1, cb: null },
  { id: 'radhus', subs: 2, cb: null },
  { id: 'takvaning', subs: 3, cb: null },
  { id: 'rum', subs: 1, cb: 176 },
  { id: 'lagenhet', subs: 2, cb: 310 },
  { id: 'villa', subs: 3, cb: null },
];

for (const H of HOMES) {
  console.log(`\n${H.id}`);
  // flytta in (via game.moveTo som bostadsbyrån använder) och kom hem från staden
  const moved = await ev((id) => {
    const g = window.SF.game;
    g.money = 100000;
    const r = g.moveTo(id);
    window.SF.roomSub = 0;
    window.SF.go('city'); window.SF.go('room');
    return r;
  }, H.id);
  await wait(700);
  ok(moved.ok, `flyttade in (insats dragen: ${JSON.stringify(await ev(() => window.SF.game.money))} kr kvar)`);

  // contentBox-regeln (mobilfyllningen)
  const cb = await ev(() => window.SF.scene.contentBox || null);
  ok(H.cb === null ? cb === null : cb && cb.w === H.cb, `contentBox ${H.cb === null ? 'utelämnad (fyller hela 384)' : `beskär till ${H.cb} px`} (${JSON.stringify(cb)})`);

  // gå igenom alla delrum via dörrarna i bakväggen, kontrollera startmöbleringen
  ok(await ev(() => window.SF.scene._debug.allFit()), 'delrum 0: startmöbleringen står rätt (allFit)');
  const route = [...Array(H.subs).keys()].slice(1);
  if (route.length) route.push(0);
  for (const target of route) {
    const s = await ev((t) => window.SF.scene._debug.spot('sub' + t), target);
    if (!s) { ok(false, `dörren till delrum ${target} hittades inte`); continue; }
    await sceneDown(s.x, s.y);
    const came = await until((t) => window.SF.roomSub === t && !!window.SF.scene?._debug, target);
    ok(came, `gick genom dörren till delrum ${target}`);
    if (came && target !== 0) ok(await ev(() => window.SF.scene._debug.allFit()), `delrum ${target}: startmöbleringen står rätt (allFit)`);
  }

  // säng + kylskåp + garderob finns i bostaden som helhet (alla delrum är besökta
  // här, så startmöbleringen ligger seedad i g.deco)
  const all = await ev(() => {
    const g = window.SF.game;
    const kinds = [];
    for (const [k, list] of Object.entries(g.deco)) if (k.startsWith(g.home + ':')) for (const d of list) kinds.push(d.k);
    return kinds;
  });
  const hasBed = all.some((k) => ['sang', 'enkelsang'].includes(k));
  const hasFridge = all.some((k) => ['kylskap', 'kyl', 'koksspis', 'mikro'].includes(k));
  const hasWardrobe = all.some((k) => ['garderob', 'kladskap', 'linneskap'].includes(k));
  ok(hasBed && hasFridge && hasWardrobe, `säng + kylskåp + garderob finns i bostaden (${all.filter((k) => ['sang', 'enkelsang', 'kylskap', 'kyl', 'garderob', 'kladskap', 'linneskap'].includes(k)).join(', ')})`);

  // sov i sängen: gå till delrummet med sängen, klicka, Sov, stäng veckopanelen
  const bedSub = await ev((subs) => {
    const g = window.SF.game;
    for (let s = 0; s < subs; s++) if ((g.deco[`${g.home}:${s}`] || []).some((d) => d.k === 'sang' || d.k === 'enkelsang')) return s;
    return -1;
  }, H.subs);
  if (bedSub !== (await ev(() => window.SF.roomSub))) {
    const s = await ev((t) => window.SF.scene._debug.spot('sub' + t), bedSub);
    await sceneDown(s.x, s.y);
    await until((t) => window.SF.roomSub === t, bedSub);
  }
  const day0 = await ev(() => window.SF.game.day);
  const bedSpot = await ev(() => window.SF.scene._debug.spot('sang') || window.SF.scene._debug.spot('enkelsang'));
  await sceneDown(bedSpot.x, bedSpot.y);
  const dlgUp = await until(() => !document.getElementById('modal').classList.contains('hidden') && document.querySelector('#modal').textContent.includes('Sova'));
  ok(dlgUp, 'klick på sängen → sovdialogen öppnas');
  await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Sov'))?.click());
  const slept = await until((d) => window.SF.game.day === d + 1, day0, 8000);
  ok(slept, `sov till nästa morgon (dag ${day0} → ${day0 + 1})`);
  await wait(400);
  await closeModals(); // veckopanelen
  await wait(300);
  await canvasPng('homes-' + H.id);
}

// ---------- flytt fram och tillbaka: möblering + förråd ligger kvar ----------
console.log('\nflytt: möbleringen per bostad ligger kvar');
const kept = await ev(() => {
  const g = window.SF.game;
  g.money = 100000;
  g.moveTo('husvagn');
  window.SF.roomSub = 0; window.SF.go('city'); window.SF.go('room');
  return g.home;
});
await wait(600);
// köp en gosegroda (finns inte i någon startmöblering) och ställ ut den i husvagnen
const placed = await ev(() => {
  const g = window.SF.game;
  g.buyFurniture('gosegroda');
  const sc = window.SF.scene;
  sc.toggleDecor(true);
  const d = sc._debug;
  const idx = g.storage.findIndex((it) => it.k === 'gosegroda');
  if (!d.pickStorage(idx)) return { ok: false, why: 'pickStorage' };
  for (let y = 200; y > 100; y -= 8) for (let x = 20; x < 140; x += 8) if (d.canPlace(x, y)) { const r = d.drop(x, y); sc.toggleDecor(false); return { ok: r, x, y }; }
  sc.toggleDecor(false);
  return { ok: false, why: 'ingen plats' };
});
ok(placed.ok, `gosegrodan köpt och utställd i husvagnen (${placed.x},${placed.y})`);
const before = await ev(() => ({ deco: JSON.parse(JSON.stringify(window.SF.game.deco)), storage: JSON.parse(JSON.stringify(window.SF.game.storage)) }));
await ev(() => { const g = window.SF.game; g.buyFurniture('soptunna'); g.moveTo('takvaning'); window.SF.roomSub = 0; window.SF.go('city'); window.SF.go('room'); });
await wait(600);
await ev(() => { const g = window.SF.game; g.moveTo('husvagn'); window.SF.roomSub = 0; window.SF.go('city'); window.SF.go('room'); });
await wait(600);
const after = await ev(() => ({ home: window.SF.game.home, deco: JSON.parse(JSON.stringify(window.SF.game.deco)), storage: window.SF.game.storage.map((i) => i.k) }));
const groda0 = before.deco['husvagn:0'].find((d) => d.k === 'gosegroda');
const groda1 = after.deco['husvagn:0']?.find((d) => d.k === 'gosegroda');
ok(!!groda1 && groda1.x === groda0.x && groda1.y === groda0.y, `gosegrodan står kvar i husvagnen på ${groda0?.x},${groda0?.y} efter flytt bort och hem igen`);
ok(JSON.stringify(after.deco['husvagn:0']) === JSON.stringify(before.deco['husvagn:0']), 'hela husvagnens möblering är exakt densamma efter flytten');
const tak0 = Object.keys(before.deco).filter((k) => k.startsWith('takvaning:')).length;
const tak1 = Object.keys(after.deco).filter((k) => k.startsWith('takvaning:')).length;
ok(tak1 >= tak0, `takvåningens möblering ligger också kvar (${tak1} delrum seedade)`);
ok(after.storage.includes('soptunna'), 'förrådet följer med orört (soptunnan kvar)');

// ---------- bostadsbyrån: posterImage för alla sju ----------
console.log('\nbostadsbyrån: posterImage(homeId)');
const posters = await ev(async () => {
  const m = await import('/js/scenes/shop-bostad.js');
  const out = {};
  for (const id of ['husvagn', 'rum', 'hoghus', 'lagenhet', 'radhus', 'villa', 'takvaning']) {
    const c = m.posterImage(id);
    if (!c) { out[id] = null; continue; }
    const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, opaque = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) opaque++; sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000000007; }
    out[id] = { w: c.width, h: c.height, opaque, sum };
  }
  return out;
});
const ids = Object.keys(posters);
ok(ids.every((id) => posters[id] && posters[id].opaque > 3000), `alla sju planscher målas (${ids.map((i) => posters[i]?.opaque).join(', ')} täckta pixlar)`);
ok(new Set(ids.map((id) => posters[id]?.sum)).size === 7, 'alla sju planscher är olika bilder (ingen generisk dubblett)');

console.log(`\n${passes} ok, ${fails} fel`);
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
