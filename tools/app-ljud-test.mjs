// Regressionstest: LJUDET I APPEN (js/core/ljudfiler.js). Ljudfilerna (assets/audio) följer inte med
// spelpaketen till appen, så appen ska hämta musiken och de inspelade ljuden från webben:
//   • i appen (låtsad Capacitor): manifesten och ljudfilerna hämtas från 8bitcat.github.io/snabbfilen/assets/audio/
//     – inte från appens eget paket – och avkodas (musiken spelar)
//   • på webben: från sidan själv, som förut
//   • spelpaketet (version.json) innehåller fortfarande inga ljudfiler (små uppdateringar)
// Webbens adresser fångas av testet och besvaras med filerna på disken (inget nät behövs).
// Kör: node tools/app-ljud-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const TYPES = { '.mp3': 'audio/mpeg', '.json': 'application/json', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

async function run(app) {
  const p = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  const errs = [], webb = [], lokalt = [];
  p.on('pageerror', (e) => errs.push(e.message));
  if (app) await p.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, Plugins: {} }; });
  await p.route('https://8bitcat.github.io/snabbfilen/assets/audio/**', (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.replace('/snabbfilen/', ''));
    webb.push(rel);
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) });
  });
  p.on('request', (q) => { const u = q.url(); if (u.startsWith(`http://localhost:${PORT}/assets/audio/`)) lokalt.push(u); });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=ljud${app ? 'app' : 'webb'}${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.removeItem('snabbfilen_mute'); localStorage.setItem('snabbfilen_music', '1');
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 12 * 60, money: 250, hunger: 70, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  await p.mouse.click(600, 400);   // (ljudet startar efter första klicket)
  await p.waitForTimeout(6000);
  const base = await p.evaluate(async () => (await import('/js/core/ljudfiler.js')).AUDIO_BASE);
  await p.close();
  return { errs, webb, lokalt, base };
}

const A = await run(true);
ok(A.base === 'https://8bitcat.github.io/snabbfilen/assets/audio/', `appen: ljudet hämtas från webben (${A.base})`);
ok(A.webb.some((u) => /rec\/manifest-/.test(u)), `appen: ljudmanifesten från webben (${A.webb.filter((u) => /manifest/.test(u)).length} st)`);
ok(A.webb.some((u) => /\.(mp3|ogg|wav)$/.test(u)), `appen: ljudfiler från webben (${A.webb.filter((u) => /\.(mp3|ogg|wav)$/.test(u)).length} st, t.ex. ${A.webb.find((u) => /music\//.test(u)) || A.webb.find((u) => /\.(mp3|ogg|wav)$/.test(u))})`);
ok(A.webb.some((u) => /music\/.+\.mp3$/.test(u)), 'appen: stadens musik hämtades');
ok(!A.lokalt.length, `appen: inget ljud från appens eget paket (${A.lokalt.length})`);
ok(!A.errs.length, `appen: inga fel${A.errs.length ? ' – ' + A.errs.slice(0, 2).join(' | ') : ''}`);

const W = await run(false);
ok(W.base.startsWith(`http://localhost:${PORT}/assets/audio/`), `webben: ljudet från sidan själv (${W.base})`);
ok(W.lokalt.some((u) => /music\/.+\.mp3$/.test(u)) && !W.webb.length, `webben: musiken från sidan, inget från 8bitcat.github.io (${W.lokalt.length} lokalt)`);
ok(!W.errs.length, `webben: inga fel${W.errs.length ? ' – ' + W.errs.slice(0, 2).join(' | ') : ''}`);

const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
ok(Array.isArray(ver.files) && !ver.files.some((f) => f.startsWith('assets/audio/')), 'spelpaketet (version.json) har inga ljudfiler');

await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
