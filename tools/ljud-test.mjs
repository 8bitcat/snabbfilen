// LJUDET (riktiga inspelningar, js/core/rec.js): efter första klicket laddas
// manifesten och stadens bädd (trafiken) tonar in; inne i caféet tonar caféets sorl in och gatan ut;
// effekterna (play) spelar inspelningen; simspråket och djuren spelar inspelade klipp; mute tystar
// allt och släpper bäddarna; musiken väljs. Inga konsolfel.
// Kör: node tools/ljud-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 20000, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }
const stats = () => page.evaluate(async () => (await import('./js/core/rec.js')).recStats());

await page.goto(`http://localhost:${PORT}/index.html?world=lj${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_mute', '0');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Lyssna', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(800);
// (spärren före första klicket sitter i sound.js – page.evaluate räknas som en gest i Chromium,
// så den går inte att mäta härifrån)
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await page.evaluate(() => { window.SF.game.min = 12 * 60; window.SF.go('city'); window.SF.scene._debug.teleport(420, 470); });
await page.mouse.click(40, 690);                       // första klicket (utanför spelet) låser upp ljudet
ok(await until(async () => (await stats()).manifest > 100), 'manifesten laddas efter första klicket');

// staden: trafikbädden tonar in
ok(await until(async () => ((await stats()).beds['stad-trafik'] || 0) > 0.05, 25000), `gatans bädd hörs i staden (${JSON.stringify((await stats()).beds)})`);

// caféet: sorlet in, gatan ut
await page.evaluate(() => window.SF.go('kafe'));
ok(await until(async () => ((await stats()).beds.cafe || 0) > 0.3, 25000), 'caféets sorl tonar in inne i caféet');
ok(await until(async () => !((await stats()).beds['stad-trafik'] > 0.05), 15000), `gatan tonar ut inne (${JSON.stringify((await stats()).beds)})`);

// effekterna: inspelningen spelas (efter att den laddats)
await page.evaluate(async () => { const s = await import('./js/core/sound.js'); s.play('coin'); });
await sleep(2500);
const f0 = (await stats()).played.sfx;
await page.evaluate(async () => { const s = await import('./js/core/sound.js'); s.play('coin'); s.play('click'); });
ok(await until(async () => (await stats()).played.sfx > f0), 'play() spelar den inspelade effekten');

// simspråket och djuren: inspelade klipp
await page.evaluate(async () => { const v = await import('./js/core/voices.js'); v.speak('Hej hej! Vad gör du?', { voice: 'Doris' }); v.animalSound('hund', 'glad'); v.meow(); });
await sleep(3000);
const p0 = await stats();
await page.evaluate(async () => { const v = await import('./js/core/voices.js'); v.speak('Vad gör du?', { voice: 'Doris' }); v.animalSound('hund', 'glad'); v.meow(); });
ok(await until(async () => (await stats()).played.person > p0.played.person), `rösten är en inspelning (${(await stats()).played.last})`);
ok(await until(async () => (await stats()).played.animal > p0.played.animal), 'djurlätena är inspelningar');

// mute: allt tyst, bäddarna släpps
await page.evaluate(async () => { const s = await import('./js/core/sound.js'); if (!s.isMuted()) s.toggleMute(); });
ok(await until(async () => Object.keys((await stats()).beds).length === 0, 8000), 'ljud av släpper bäddarna');
await page.evaluate(async () => { const s = await import('./js/core/sound.js'); if (s.isMuted()) s.toggleMute(); });
ok(await until(async () => ((await stats()).beds.cafe || 0) > 0.1, 15000), 'ljud på igen: caféet hörs igen');

// musiken
const mus = await page.evaluate(async () => { const m = await import('./js/core/music.js'); return m.musicStats(); });
ok(mus && (mus.want || mus.playing || mus.active !== undefined), `musiken väljs (${JSON.stringify({ want: mus?.want, playing: mus?.playing, on: mus?.on })})`);
const fel = (await stats()).failed;
ok(!fel.length, `alla ljudfiler som behövdes gick att ladda (${fel.join(', ') || 'inga fel'})`);

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
