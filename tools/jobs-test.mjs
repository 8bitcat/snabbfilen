// De nya arbetsplatserna: dörren i staden leder in i rätt jobb, ett pass ger lön, och
// kaféet frågar "Fika eller jobba?". Djuraffärens dörr leder in i affären.
//   node tools/jobs-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?world=jobs${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Jobbaren', look: {}, color: '#e04848' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 12 * 60, money: 100, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });

// Gå in genom en byggnads dörr: ställ figuren vid dörren, klicka, och hantera dialogerna
// (skiftdialogen bekräftas) tills scenen byts. Returnerar den nya scenen, eller
// 'kafe-val' om kaféets fika/jobba-fråga dök upp.
async function walkIn(id, { pick = null } = {}) {
  await page.evaluate(() => { window.SF.game.min = 12 * 60; window.SF.go('city'); });
  await page.waitForTimeout(500);
  const started = await page.evaluate((bid) => {
    const d = window.SF.scene._debug;
    const s = d.spot?.(bid); if (!s) return false;
    const cam = d.cam?.() || { x: 0, y: 0 };
    d.teleport?.(s.x + cam.x, s.y + cam.y + 6);
    const s2 = d.spot(bid);
    window.SF.scene.down(s2.x, s2.y);
    return true;
  }, id);
  if (!started) return 'ingen dörr';
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const st = await page.evaluate(() => ({ scene: window.SF.sceneName, title: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '' }));
    if (st.scene !== 'city') return st.scene;
    if (/Kaf/.test(st.title)) {
      if (!pick) return 'kafe-val';
      await page.evaluate((t) => { const b = [...document.querySelectorAll('.dlg-foot .btn')].find((x) => x.textContent.includes(t)); b?.click(); }, pick);
    } else if (st.title) {
      await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn-go')?.click());
    }
    await page.waitForTimeout(250);
  }
  return await page.evaluate(() => window.SF.sceneName);
}
const stats = () => page.evaluate(() => { const d = window.SF.scene?._debug; const s = d?.stats; return typeof s === 'function' ? s() : s || null; });

const JOBS = [['pizzeria', 'jobbpizzeria'], ['posten', 'jobbposten'], ['bensinmack', 'jobbbensin'], ['bilverkstad', 'jobbverkstad'], ['tvatteri', 'jobbtvatt']];
for (const [building, scene] of JOBS) {
  const sc = await walkIn(building);
  ok(sc === scene, `${building}: dörren leder in i jobbet (${sc})`);
  await page.waitForTimeout(800);
  const st = await stats();
  ok(!!st && 'ok' in st, `${building}: passet är igång (stats ${JSON.stringify(st)})`);
}
ok((await walkIn('kafe')) === 'kafe-val', 'kaféet frågar fika eller jobba');
ok((await walkIn('kafe', { pick: 'Jobba' })) === 'jobbkafe', 'kaféet: "Jobba" startar baristapasset');
ok((await walkIn('kafe', { pick: 'Fika' })) === 'kafe', 'kaféet: "Fika" leder in i kaféet');
ok((await walkIn('djuraffar')) === 'djur', 'djuraffärens dörr leder in i affären');

// lön: pizzerians pass via debug-API
ok((await walkIn('pizzeria')) === 'jobbpizzeria', 'pizzerian igen för lönetestet');
const before = await page.evaluate(() => window.SF.game.money);
await page.waitForTimeout(800);
await page.evaluate(() => { const d = window.SF.scene._debug; d.forceCustomer?.(); d.makePizza?.(); d.serve?.(true); });
const st = await stats();
ok(!!st && st.ok >= 1, `pizzerian: en rätt pizza serverad (${JSON.stringify(st)})`);
await page.evaluate(() => window.SF.scene.update(1000)); // spola passet till slut
let paid = false;
for (let i = 0; i < 80 && !paid; i++) { await page.waitForTimeout(250); paid = await page.evaluate(() => window.SF.game.money > 100); }
ok(paid, `lönen betalades ut (${before} → ${await page.evaluate(() => window.SF.game.money)} kr)`);
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
