// HUSSKYLTEN och KYRKOGÅRDEN (Carl 2026-09-29):
//  1) ett bostadshus man inte bor i (Tornhuset) visar en skylt – ingen flyttknapp, ingen tid går;
//     👁 Titta in har ingen flyttknapp heller; 🔑 Till Bostadsbyrån går in till mäklaren
//  2) hemma (Betongvägen 1 när man bor i Lilla rummet) går man in som förut
//  3) kyrkogården: man går från norra grinden till södra utan att gravar eller häck står i vägen
// Kör: node tools/husskylt-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 20000, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }
const head = () => page.locator('#modal:not(.hidden) .dlg-head h2').textContent().catch(() => '');

await page.goto(`http://localhost:${PORT}/index.html?world=hs${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Grannen', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 30000, hunger: 90, energy: 95, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());

// 1) Tornhuset: skylten
await page.evaluate(() => { window.SF.game.min = 12 * 60; window.SF.go('city'); window.SF.scene._debug.enter('tornhuset'); });
ok(await until(async () => /TORNHUSET/i.test(await head()), 30000), `Tornhuset visar en skylt (${await head()})`);
const skylt = await page.evaluate(() => ({ move: document.querySelectorAll('#modal:not(.hidden) [data-move]').length, text: document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || '', min: window.SF.game.min, home: window.SF.game.home, scene: window.SF.sceneName }));
ok(skylt.move === 0, 'skylten har ingen flyttknapp');
ok(/Takvåningen/.test(skylt.text) && /Bostadsbyrån/.test(skylt.text), 'skylten berättar vilken bostad det är och att mäklaren ordnar flytten');
ok(skylt.scene === 'city' && skylt.home === 'rum', 'man står kvar på gatan och bor kvar där man bor');
await page.click('#modal:not(.hidden) .homelook');
ok(await until(async () => /Takvåningen/.test(await head()), 8000), '👁 Titta in visar bostaden inifrån');
const titta = await page.evaluate(() => [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].map((b) => b.textContent));
ok(!titta.some((t) => /Flytta hit/.test(t)), `ingen flyttknapp när man tittar in från skylten (${titta.join(' | ')})`);
await page.evaluate(() => [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].find((b) => /Tillbaka/.test(b.textContent))?.click());
ok(await until(async () => /TORNHUSET/i.test(await head()), 5000), '← Tillbaka leder till skylten igen');
await page.click('#modal:not(.hidden) .dlg-foot .btn-go');
ok(await until(() => page.evaluate(() => window.SF.sceneName === 'bostad'), 40000), '🔑 Till Bostadsbyrån – figuren går dit och in till mäklaren');

// 2) hemma går man in som förut
await page.evaluate(() => { window.SF.go('city'); window.SF.scene._debug.enter('hoghus'); });
ok(await until(() => page.evaluate(() => window.SF.sceneName === 'room'), 40000), 'Betongvägen 1 (där man bor) leder hem som förut');

// 3) kyrkogården: norra grinden → mittgången → södra grinden
await page.evaluate(() => { window.SF.go('city'); window.SF.scene._debug.teleport(1070, 500); });
await sleep(400);
// varje sträcka ska gås rakt (ingen omväg runt en grav eller häck): figurens x (eller y) avviker högst 3 px
for (const [x, y, axel] of [[1070, 567, 'x'], [1050, 567, 'y'], [1050, 632, 'x']]) {
  await page.evaluate(([tx, ty]) => window.SF.scene._debug.walkTo(tx, ty), [x, y]);
  let maxAv = 0, framme = false;
  for (let i = 0; i < 60 && !framme; i++) {
    await sleep(80);
    const p = await page.evaluate(() => window.SF.scene._debug.pos());
    const start = axel === 'x' ? x : y, v = axel === 'x' ? p.x : p.y;
    maxAv = Math.max(maxAv, Math.abs(v - start) > 25 ? 0 : Math.abs(v - start));
    framme = Math.hypot(p.x - x, p.y - y) < 3;
  }
  ok(framme && maxAv <= 3, `kyrkogårdens gång till (${x},${y}) går rakt utan hinder (avvikelse ${maxAv} px)`);
}

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
