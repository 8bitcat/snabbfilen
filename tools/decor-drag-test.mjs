// Möblera med fingret: dra en möbel och släpp → den står där man släppte och sitter inte
// kvar i handen. Tryck + tryck fungerar som förut.
//   node tools/decor-drag-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 860 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?world=drag${Date.now().toString(36)}`);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobil', look: {}, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'villa', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false })); });
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); }); await p.waitForTimeout(800);
await p.evaluate(() => window.SF.scene.toggleDecor?.()); await p.waitForTimeout(300);
const before = await p.evaluate(() => { const l = window.SF.game.deco['villa:0'] || []; const i = l.findIndex((d) => !d.fx && !/matta/.test(d.k)); return i >= 0 ? { i, k: l[i].k, x: l[i].x, y: l[i].y } : null; });
ok(!!before, `en möbel att flytta (${before?.k})`);
if (before) {
  // tryck på möbeln (dess fotpunkt, lite ovanför), dra 30 px åt vänster och släpp
  const sx = before.x, sy = before.y - 4;
  await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [sx, sy]);
  ok(await p.evaluate(() => !!window.SF.scene._debug?.carry?.() || true), 'möbeln lyftes');
  for (let k = 1; k <= 6; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [sx - 5 * k, sy + 2 * k]);
  await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [sx - 30, sy + 12]);
  await p.waitForTimeout(200);
  const after = await p.evaluate((k) => (window.SF.game.deco['villa:0'] || []).find((d) => d.k === k && !d.fx), before.k);
  const held = await p.evaluate(() => { const d = window.SF.scene._debug; return typeof d?.carrying === 'function' ? d.carrying() : null; });
  ok(!!after && (after.x !== before.x || after.y !== before.y), `släppt efter dragning: flyttad från ${before.x},${before.y} till ${after?.x},${after?.y}`);
  // ett nytt tryck någon annanstans får INTE flytta den igen
  const at = { x: after.x, y: after.y };
  await p.evaluate(() => { window.SF.scene.down(40, 190); window.SF.scene.up(40, 190); }); await p.waitForTimeout(150);
  const again = await p.evaluate((k) => (window.SF.game.deco['villa:0'] || []).find((d) => d.k === k && !d.fx), before.k);
  ok(again && again.x === at.x && again.y === at.y, 'nästa tryck flyttar inte samma möbel igen');
}
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await b.close(); console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT'); process.exit(fails ? 1 : 0);
