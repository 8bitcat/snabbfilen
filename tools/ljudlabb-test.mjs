// Ljudlabbet (ljud.html): sidan laddar utan fel, effekt-, röst- och djurknapparna spelar
// ljud (räknas i voices.js voicesStats), och avstängt ljud i spelet tystar sidan också.
// Kör: node tools/ljudlabb-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|404/.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };

await page.goto(`http://localhost:${PORT}/ljud.html`);
await page.evaluate(() => localStorage.setItem('snabbfilen_mute', '0'));
await page.reload();
await page.waitForFunction(() => window.__ljudlabb, null, { timeout: 15000 });
const info = await page.evaluate(() => window.__ljudlabb);
ok(info.sound && info.voices, `ljudmodulerna laddade (effekter ${info.sound}, röster ${info.voices}, ambiens ${info.ambience})`);
const counts = await page.evaluate(() => ({
  eff: document.querySelectorAll('#effekter button').length,
  pers: document.querySelectorAll('#personer button').length,
  djur: document.querySelectorAll('#djur button').length,
}));
ok(counts.eff === 15, `15 effektknappar (${counts.eff})`);
ok(counts.pers === 9, `9 röster att välja (${counts.pers})`);
ok(counts.djur >= 20, `djurknapparna finns (${counts.djur})`);

const stats = () => page.evaluate(async () => (await import('./js/core/voices.js')).voicesStats());
const s0 = await stats();
await page.click('#personer button:nth-child(1)');
await page.waitForTimeout(300);
const s1 = await stats();
ok(s1.started > s0.started, `en röst startade när Doris-knappen trycktes (${s0.started} → ${s1.started})`);
await page.click('#djur .grid button:nth-child(1)');
await page.waitForTimeout(300);
const s2 = await stats();
ok(s2.started > s1.started && (s2.byTag.hund || 0) > (s1.byTag.hund || 0), 'valpen skällde');
await page.click('#repliker .chip:nth-child(2)');
ok(await page.inputValue('#text') === 'Vad kostar den här?', 'replikvalet fyller i texten');
await page.click('#effekter button:nth-child(5)');
ok(await page.evaluate(() => document.querySelector('#effekter button:nth-child(5)').classList.contains('playing')), 'effektknappen lyser när den spelar');

// ljud av i spelet → bannern syns och rösterna tystnar
await page.evaluate(() => localStorage.setItem('snabbfilen_mute', '1'));
await page.reload();
await page.waitForFunction(() => window.__ljudlabb);
ok(await page.evaluate(() => !document.querySelector('#muted').classList.contains('hidden')), 'bannern "ljudet är avstängt" syns');
const m0 = await stats();
await page.click('#personer button:nth-child(2)');
await page.waitForTimeout(200);
const m1 = await stats();
ok(m1.started === m0.started, 'inget spelas när ljudet är avstängt');
await page.click('#unmute');
await page.click('#personer button:nth-child(2)');
await page.waitForTimeout(300);
const m2 = await stats();
ok(m2.started > m1.started, 'efter "Slå på ljudet" hörs rösterna');
ok(await page.evaluate(() => localStorage.getItem('snabbfilen_mute')) === '0', 'inställningen sparas som i spelet');

await page.screenshot({ path: 'tools/out/ljudlabb.png', fullPage: true });
ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
