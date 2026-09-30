// DEN LÖPANDE LÄGENHETEN (Carl 2026-09-30): bostadens rum ligger i rad i en bild, man går mellan
// dem genom öppningarna i mellanväggarna och kameran följer figuren – på datorn (fyll-läget, där
// sidorna beskärs) och på telefonen (samma skala som i staden).
//   node tools/lagenhet-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const pw = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
const OUT = 'tools/out/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HOMES = ['husvagn', 'rum', 'hoghus', 'lagenhet', 'radhus', 'villa', 'takvaning'];
const APT = { WALLW: 8, DY0: 124, DY1: 170 };
const DOOR = { x0: 28, x1: 62 };
const save = (home) => ({ v: 1, day: 3, min: 12 * 60, money: 900, hunger: 80, energy: 80, home, fridge: {}, jobs: {}, earned: 0 });
const errs = [];

async function boot(browser, opts, home, tag) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((s) => { try { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Hemma', look: { shirt: '#3a7bd5' }, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); localStorage.setItem('snabbfilen_hud', 'pix'); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_zoom', 'vid'); } catch { /* ok */ } }, save(home));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${home}/${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load|WebSocket/i.test(m.text()) && errs.push(`${home}/${tag} console: ${m.text()}`));
  await page.goto(`http://localhost:${PORT}/index.html?mobfill=1&world=lt${tag}${Date.now().toString(36)}`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 60000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); window.SF.roomSub = 0; window.SF.go('room'); });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('modal').classList.add('hidden'));
  return { ctx, page };
}
const aptOf = (page) => page.evaluate(() => ({ ...window.SF.scene._debug.apt(), me: window.SF.scene._debug.wme(), sub: window.SF.roomSub, AW: window.SF.W }));
// följ figuren tills den står i rummet to: sista läget före bytet (i öppningen?) och farten
async function follow(page, to, ms = 30000) {
  const t0 = Date.now(), samples = [];
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => ({ me: window.SF.scene._debug.wme(), sub: window.SF.roomSub, route: !!window.SF.scene._debug.apt().route, t: performance.now() }));
    samples.push(s);
    if (s.sub === to && !s.me.walking) break;
    await wait(60);
  }
  const k = samples.findIndex((s) => s.sub === to);
  const before = k > 0 ? samples[k - 1] : null;
  // farten medan figuren går genom rummen (världs-x per sekund, samma rum mellan proven)
  const v = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (a.route && b.route && a.me.room === b.me.room && b.me.walking && b.t > a.t) v.push(Math.hypot(b.me.wx - a.me.wx, b.me.y - a.me.y) / ((b.t - a.t) / 1000));
  }
  v.sort((a, b) => a - b);
  return { arrived: k >= 0, before, speed: v.length ? v[v.length >> 1] : 0, end: samples[samples.length - 1] };
}

const browser = await pw.chromium.launch();

// ---------- 1. datorn (fyll-läget): alla sju bostäderna ----------
console.log('\n1. datorn 1280×720');
for (const home of HOMES) {
  console.log(`\n${home}`);
  const { ctx, page } = await boot(browser, { viewport: { width: 1280, height: 720 } }, home, 'd');
  await wait(600);
  let a = await aptOf(page);
  const n = a.rooms.length, last = a.rooms[n - 1];
  const inner = a.rooms.every((r, i) => i === 0 || r.ox === a.rooms[i - 1].ox + a.rooms[i - 1].w + APT.WALLW);
  ok(n >= 2 && last.bath && a.rooms.filter((r) => r.bath).length === 1 && inner && a.W >= last.ox + last.w,
    `${a.rooms.map((r) => `${r.name} ${r.w}`).join(' | ')} i rad med ${n - 1} mellanvägg${n > 2 ? 'ar' : ''}, badrummet sist (${a.W} px)`);
  const [s0, s1] = a.seen;
  const scr = (wx) => wx - a.camX;
  ok(scr(a.me.wx) >= s0 + 8 && scr(a.me.wx) <= s1 - 8, `figuren syns (x ${Math.round(scr(a.me.wx))} i det synliga ${s0}–${s1} av ${a.AW})`);
  ok(scr(DOOR.x0) >= s0 && scr(DOOR.x1) <= s1, `ytterdörren (UT) syns i bild (${scr(DOOR.x0)}–${scr(DOOR.x1)})`);
  await page.screenshot({ path: `${OUT}lagenhet-${home}-dator.png` });
  // tryck på golvet i rummet bredvid (den del som syns – annars dit man når)
  const r1 = a.rooms[1];
  const sx = Math.min(s1 - 12, scr(r1.ox) + 40);
  const inR1 = sx + a.camX > r1.ox + 4;
  if (inR1) await page.evaluate(([x]) => window.SF.scene.down(x, 190), [sx]);
  else await page.evaluate(() => window.SF.scene._debug.goRoom(1, 40, 190));
  const f = await follow(page, 1);
  const by = f.before?.me;
  ok(f.arrived, `${inR1 ? 'tryck på golvet i ' + r1.name + ' (syns i bild)' : 'gå till ' + r1.name} → figuren går dit (roomSub 1)`);
  ok(!!by && by.y >= APT.DY0 && by.y <= APT.DY1 && by.x > a.rooms[0].w - 30, `gick genom öppningen i mellanväggen (sista läget i ${a.rooms[0].name}: ${by ? `${Math.round(by.x)},${Math.round(by.y)}` : '–'})`);
  ok(f.speed > 80 && f.speed < 115, `raskare gång genom rummen (${Math.round(f.speed)} px/s, annars 62)`);
  await wait(900);
  a = await aptOf(page);
  ok(a.sub === 1 && a.me.room === 1 && a.me.wx - a.camX >= a.seen[0] + 8 && a.me.wx - a.camX <= a.seen[1] - 8, `kameran följde med – figuren syns i ${r1.name} (${Math.round(a.me.wx - a.camX)})`);
  // Möblera: rummet man trycker i
  if (home === 'villa') {
    await page.evaluate(() => window.SF.scene.toggleDecor(true));
    await wait(300);
    a = await aptOf(page);
    ok(a.decorRoom === 1, `Möblera öppnas i rummet man står i (${a.decorRoom})`);
    const x0 = a.rooms[0].ox + a.rooms[0].w - 20 - a.camX;
    if (x0 >= a.seen[0]) {
      await page.evaluate(([x]) => window.SF.scene.down(x, 205), [x0]);
      await page.evaluate(([x]) => window.SF.scene.up(x, 205), [x0]);
      await wait(250);
      a = await aptOf(page);
      ok(a.decorRoom === 0, `tryck i ${a.rooms[0].name} medan man möblerar → Möblera byter till det rummet (${a.decorRoom})`);
    }
    await page.evaluate(() => window.SF.scene.toggleDecor(false));
    await wait(250);
    ok((await aptOf(page)).decorRoom === -1, 'Möblera stängs');
  }
  // tillbaka till första rummet (rummen emellan passeras) och till badrummet sist
  await page.evaluate((j) => window.SF.scene._debug.goRoom(j), n - 1);
  const fb = await follow(page, n - 1, 40000);
  ok(fb.arrived, `hela vägen till ${last.name}`);
  await wait(900);
  await page.screenshot({ path: `${OUT}lagenhet-${home}-dator-bad.png` });
  await page.evaluate(() => window.SF.scene._debug.goRoom(0));
  ok((await follow(page, 0, 40000)).arrived, `och tillbaka till ${a.rooms[0].name}`);
  await ctx.close();
}

// ---------- 2. telefonen (iPhone 13 mini liggande) ----------
console.log('\n2. iPhone 13 mini liggande');
for (const home of ['villa', 'rum', 'husvagn']) {
  const { ctx, page } = await boot(browser, { viewport: { width: 812, height: 375 }, screen: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, home, 'm');
  await wait(600);
  const a = await aptOf(page);
  const cv = await page.evaluate(() => { const r = document.getElementById('scene').getBoundingClientRect(); return { l: r.left, r: r.right, iw: innerWidth }; });
  const [s0, s1] = a.seen, mid = (s0 + s1) / 2;
  if (a.W >= s1 - s0) {
    ok(cv.l <= 1 && cv.r >= cv.iw - 1, `${home}: spelbilden täcker hela bredden (${Math.round(cv.l)}–${Math.round(cv.r)} av ${cv.iw})`);
    ok(a.camX >= -s0 - 0.5 && a.camX <= a.W - s1 + 0.5, `${home}: kameran håller sig inom lägenheten (camX ${Math.round(a.camX)})`);
  } else {
    const c = a.W / 2 - a.camX;
    ok(Math.abs(c - mid) <= 2, `${home}: lägenheten (${a.W} px) är smalare än skärmen – står i mitten (${Math.round(c)} ≈ ${Math.round(mid)})`);
  }
  await page.evaluate(() => window.SF.scene._debug.goRoom(1));
  ok((await follow(page, 1)).arrived, `${home}: gick till ${a.rooms[1].name}`);
  await wait(900);
  const b = await aptOf(page);
  const x = b.me.wx - b.camX;
  ok(x >= b.seen[0] + 8 && x <= b.seen[1] - 8 && (b.W < s1 - s0 || Math.abs(x - mid) < 40 || b.camX <= -s0 + 1 || b.camX >= b.W - s1 - 1), `${home}: figuren syns och kameran följer (x ${Math.round(x)}, mitten ${Math.round(mid)})`);
  await page.screenshot({ path: `${OUT}lagenhet-${home}-mini.png` });
  await ctx.close();
}

await browser.close();
ok(!errs.length, errs.length ? 'fel: ' + errs.join(' | ') : 'inga pageerror/console.error');
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
