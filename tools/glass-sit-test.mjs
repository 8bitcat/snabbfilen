// Test (stadsputs-kiosk): spelaren klickar på varje glasplats, går dit och sätter sig.
//   node tools/glass-sit-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${process.env.SMOKE_PORT || process.env.PORT || 8788}/index.html?world=sitt${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 10, min: 14 * 60, money: 500, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { const S = window.SF; S.game.min = 14 * 60; S.go('city'); const keep = () => { S.game.min = 14 * 60; requestAnimationFrame(keep); }; keep(); });
await page.waitForTimeout(800);
const seats = await page.evaluate(() => window.SF.scene._debug.sim().props.seats().filter((s) => s.kind === 'glass').map((s) => ({ id: s.id, x: s.x, y: s.y, hit: s.hit })));
let ok = 0;
for (const s of seats) {
  // gå till parkgången nedanför, klicka mitt i platsens klickyta (den som sitter där får resa sig först)
  await page.evaluate(() => { const d = window.SF.scene._debug; d.standUp(); d.teleport(470, 474); d.lockCam(300, 330); });
  await page.waitForTimeout(250);
  const clicked = await page.evaluate((s) => {
    const d = window.SF.scene._debug, c = d.cam(), L = d.sim().life._debug;
    L.seatUse.delete(s.id);                                  // (testet: ingen fotgängare får ta platsen)
    window.SF.scene.down(s.x - c.x, (s.y - 6) - c.y);
    return d.pos();
  }, s);
  let sat = null;
  for (let i = 0; i < 40 && !sat; i++) { await page.waitForTimeout(150); sat = await page.evaluate(() => window.SF.scene._debug.sitting()); }
  const pass = sat === s.id;
  if (pass) ok++;
  console.log(`${pass ? '✓' : '✗'} ${s.id} (${s.x},${s.y}) → sitter på ${sat}`);
}
console.log(`${ok}/${seats.length} glasplatser gick att sätta sig på`);

// glasköpet vid ståndet (kiosken heter GLASS och säljer glass) + gamla glasskiosken borta
let buyOk = false;
const buy = await page.evaluate(async () => {
  const m = await import('./js/city/map.js');
  const d = window.SF.scene._debug; d.standUp();
  const before = { money: window.SF.game.money, hunger: window.SF.game.hunger };
  d.enter('kiosk');
  return { before, noOld: !m.ALL_BUILDINGS.some((b) => b.id === 'glasskiosk'), sign: m.ALL_BUILDINGS.find((b) => b.id === 'kiosk')?.sign };
});
for (let i = 0; i < 40; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => /Glasståndet/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''))) break; }
const dlgOk = await page.evaluate(() => /Glasståndet/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''));
if (dlgOk) {
  await page.click('#modal [data-glass="kula"]');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ money: window.SF.game.money, hunger: window.SF.game.hunger }));
  buyOk = after.money === buy.before.money - 12 && after.hunger > buy.before.hunger;
  console.log(`${buyOk ? '✓' : '✗'} glass köpt: ${buy.before.money} → ${after.money} kr, mätthet ${Math.round(buy.before.hunger)} → ${Math.round(after.hunger)}`);
} else console.log('✗ glasståndets dialog öppnades inte');
console.log(`${buy.noOld ? '✓' : '✗'} den gamla glasskiosken är borta ur kartan`);
console.log(`${buy.sign === 'GLASS' ? '✓' : '✗'} kiosken heter nu ${buy.sign}`);
console.log(errs.length ? errs.join('\n') : 'Inga konsolfel.');
await browser.close();
process.exit(ok === seats.length && buyOk && buy.noOld && buy.sign === 'GLASS' && !errs.length ? 0 : 1);
