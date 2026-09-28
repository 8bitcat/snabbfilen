// Veckosammanfattningen i bild: kommer upp först när man kommer in (?week=1 för testrobotar),
// sju fönster med utsikt, större rutor, ingen sparmålsruta. Dator + mobil, vanlig dag,
// regndag och måndag med hyran.
//   node tools/week-snap.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const U = `http://localhost:${PORT}/index.html?nomenu&week=1&world=wk${Date.now().toString(36)}`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch();
const save = (o) => JSON.stringify({ v: 1, day: 3, min: 420, money: 250, hunger: 70, energy: 90, home: 'rum', fridge: { mjolk: 1 }, jobs: { burgare: 2 }, earned: 300, wardrobe: [], storage: [], deco: {}, won: false, ...o });
async function shot(name, w, h, o) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(m.text()));
  await p.goto(U);
  await p.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'kalle', name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }));
    localStorage.setItem('snabbfilen_save1', s);
  }, save(o));
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const d = document.querySelector('#modal .dlg-week');
    const wins = [...document.querySelectorAll('.wk-win')].map((c) => c.getBoundingClientRect());
    return {
      open: !!d, wins: wins.length, w: Math.round(wins[0]?.width || 0),
      goal: !!document.querySelector('.wk-goal'),
      overflow: document.documentElement.scrollWidth > innerWidth || (d && d.scrollWidth > d.clientWidth + 1),
      today: document.querySelector('.wk-day.today b')?.textContent, past: document.querySelectorAll('.wk-day.past').length,
    };
  });
  await p.screenshot({ path: `tools/out/week-${name}.png` });
  await c.close();
  return info;
}
const a = await shot('dator', 1280, 820, {});
ok(a.open, 'veckan är det första som kommer upp när man kommer in');
ok(a.wins === 7 && a.w >= 128, `sju fönster, stora (${a.w} px breda)`);
ok(!a.goal, 'ingen sparmålsruta');
ok(a.today === 'ONS' && a.past === 2, `onsdag i dag, två avklarade dagar (${a.today}, ${a.past})`);
ok(!a.overflow, 'inget som sticker ut i sidled');
const b = await shot('regn', 1280, 820, { day: 5, event: { id: 'regn' } });
ok(b.open && b.today === 'FRE', 'regndag på fredag');
const m = await shot('mandag', 1280, 820, { day: 8, money: 900 });
ok(m.open && m.today === 'MÅN', 'måndag vecka 2 (hyresdagen)');
const mob = await shot('mobil', 400, 860, {});
ok(mob.open && mob.wins === 7 && !mob.overflow, `mobil: sju fönster utan sidscroll (${mob.w} px)`);
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
