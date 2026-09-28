// Mobilen (Carl: "man ser inte skyltarna i staden, menyerna är för stora för mobilen så man
// förstår inte vad man ska göra"): iPhone 13 mini liggande (812×375, NÄRA-läget).
//  1) huvudmenyn: "Vem spelar?" och figuren syns utan att skrolla, knapparna ryms
//  2) staden: husens namn visas i överkanten när skyltarna är utanför bild, och ett tryck på
//     ett namn går dit och in; områdesskylten ligger inne i den synliga rutan
// Kör: node tools/mobil-stad-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const errs = [];
const SAVE = JSON.stringify({ v: 1, day: 3, min: 11 * 60, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false });
async function boot(q) {
  const c = await browser.newContext({ viewport: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/index.html?${q}&mobfill=1&world=ms${Math.random().toString(36).slice(2, 7)}`);
  await p.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'edessa', name: 'Edessa', look: { skin: '#8d5a3b', shirt: '#b84ad8' }, color: '#b84ad8' }));
    localStorage.setItem('snabbfilen_save1', s);
    localStorage.setItem('snabbfilen_hud', 'pix');
    localStorage.setItem('snabbfilen_zoom', 'nara');
  }, SAVE);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  return { c, p };
}

// 1) huvudmenyn
{
  const { c, p } = await boot('menu');
  await p.waitForSelector('.menu-panel', { timeout: 8000 });
  const m = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
    return { vh: innerHeight, vw: innerWidth, card: r('.menu-card'), sub: r('.menu-sub'), cont: r('[data-continue]'), panel: r('.menu-panel'), scroll: document.querySelector('.menu-panel').scrollHeight - document.querySelector('.menu-panel').clientHeight };
  });
  ok(m.card && m.card.bottom <= m.vh && m.card.top >= 0, `menyn: första figuren syns utan att skrolla (kortet ${m.card && Math.round(m.card.top)}–${m.card && Math.round(m.card.bottom)} av ${m.vh})`);
  ok(m.sub && m.sub.top >= 0 && m.sub.bottom <= m.vh, 'menyn: rubriken "Vem spelar?" syns');
  ok(m.cont && m.cont.bottom <= m.vh, 'menyn: Fortsätt-knappen syns');
  ok(m.scroll <= 4, `menyn: panelen behöver inte skrollas (${m.scroll} px)`);
  await p.screenshot({ path: 'tools/out/mobil-meny-liggande.png' });
  await c.close();
}

// 2) staden i NÄRA-läget
{
  const { c, p } = await boot('nomenu');
  await p.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
  await p.evaluate(() => { const A = window.SF; A.game.min = 11 * 60; A.go('city'); A.scene._debug.teleport(560, 300); });
  await p.waitForTimeout(4500);
  const view = await p.evaluate(() => ({ ...window.SF.view.safe, W: window.SF.W, H: window.SF.H }));
  const chips = await p.evaluate(() => window.SF.scene._debug.chips());
  ok(view.y0 > 0, `staden: NÄRA-läget beskär överkanten (synligt från rad ${view.y0})`);
  ok(chips.length >= 2, `staden: husnamn i överkanten (${chips.map((x) => x.label).join(', ')})`);
  ok(chips.every((x) => x.y >= view.y0 && x.x >= view.x0 - 1 && x.x + x.w <= view.x1 + 1), 'staden: namnen ligger inne i den synliga rutan');
  ok(chips.every((a, i) => chips.every((b, j) => i === j || a.y !== b.y || a.x + a.w + 2 <= b.x || b.x + b.w + 2 <= a.x)), 'staden: namnen överlappar inte varandra');
  await p.screenshot({ path: 'tools/out/mobil-stad-husnamn.png' });
  // tryck på ett namn → figuren går dit och in
  const target = chips.find((x) => x.id === 'kafe' || x.id === 'mat' || x.id === 'klader') || chips[0];
  const hit = await p.evaluate((t) => { window.SF.scene.down(t.x + t.w / 2, t.y + t.h / 2); return true; }, target);
  let entered = false;
  for (let i = 0; i < 40 && !entered; i++) { await p.waitForTimeout(250); entered = await p.evaluate(() => window.SF.sceneName !== 'city' || !document.querySelector('#modal').classList.contains('hidden')); }
  ok(hit && entered, `staden: tryck på namnet "${target?.label}" går dit och in`);
  await c.close();
}
ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
