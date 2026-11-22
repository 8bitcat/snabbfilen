// ❄️ FOTSPÅR I SNÖN (js/city/weather.js env.snowStep, js/scenes/city.js, js/city/life.js, v0.169). Carl 2026-11-22:
// "gör också så att det kan snöa i staden och att snön lägger sig och att det blir fotspår när man går".
//   1. tvingat snöväder med täcke 0,6: spelaren går 70 px → ett spårlager finns och det ligger spår längs vägen
//   2. stadens folk lämnar spår med tiden (spårlagret växer)
//   3. sol och plusgrader (täcke 0): spåren är borta
//   node tools/fotspar-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const E = (fn, arg) => p.evaluate(fn, arg);
async function until(fn, ms = 15000, step = 200) { const end = Date.now() + ms; for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); } }
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fs${Date.now().toString(36)}`);
await E(() => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'av-snö', name: 'Snö', look: {}, color: '#2d7ff9' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, money: 500, hunger: 80, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false })); });
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await E(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
await p.waitForFunction(() => window.SF?.sceneName === 'city' && !!window.SF.scene?._debug?.env, null, { timeout: 20000 });
await sleep(800);

// ---------- 1. snö med täcke: spelaren går och lämnar spår ----------
const w = await E(() => window.SF.scene._debug.weather({ kind: 'snö', intensity: 0.6, season: 'vinter', temp: -4, snow: 0.6 }));
await sleep(500);
ok(w && w.snowCover >= 0.6 && (await E(() => typeof window.SF.scene._debug.env.snowStep)) === 'function', `snöväder med täcke ${w?.snowCover} – env.snowStep finns`);
await E(() => window.SF.scene._debug.env.snowStepsCount());
const pos = await E(() => window.SF.scene._debug.pos());
let steg = await E(([x, y]) => window.SF.scene._debug.walkTo(x + 70, y), [pos.x, pos.y]);
let dir = 1;
if (!steg) { steg = await E(([x, y]) => window.SF.scene._debug.walkTo(x - 70, y), [pos.x, pos.y]); dir = -1; }
ok(steg > 0, `spelaren går ${dir > 0 ? 'österut' : 'västerut'} (${steg} vägpunkter)`);
await until(() => E(() => window.SF.scene._debug.arrived()), 20000);
const pos2 = await E(() => window.SF.scene._debug.pos());
const n1 = await E(() => window.SF.scene._debug.env.snowStepsCount());
ok(n1 >= 1, `spårlager finns (${n1} rutor)`);
const nara = await E(([x, y]) => window.SF.scene._debug.env.snowStepsAt(x, y, 10), [Math.round((pos.x + pos2.x) / 2), Math.round((pos.y + pos2.y) / 2)]);
ok(nara > 0, `fotspår längs vägen man gick (${nara} målade pixlar halvvägs)`);
ok((await E(([x, y]) => window.SF.scene._debug.env.snowStepsAt(x, y, 4), [pos2.x, pos2.y])) > 0, 'spår där man står nu');

// ---------- 2. stadens folk lämnar spår ----------
const pix0 = await E(() => { const e = window.SF.scene._debug.env; let n = 0; for (let tx = -5; tx <= 21; tx++) for (let ty = 0; ty <= 8; ty++) n += e.snowStepsAt(tx * 256 + 128, ty * 256 + 128, 127); return n; });
await sleep(6000);
const pix1 = await E(() => { const e = window.SF.scene._debug.env; let n = 0; for (let tx = -5; tx <= 21; tx++) for (let ty = 0; ty <= 8; ty++) n += e.snowStepsAt(tx * 256 + 128, ty * 256 + 128, 127); return n; });
ok(pix1 > pix0, `stadens folk trampar spår med tiden (${pix0} → ${pix1} pixlar)`);

// ---------- 3. snön smälter: spåren borta ----------
await E(() => window.SF.scene._debug.weather({ kind: 'sol', intensity: 0.3, season: 'sommar', temp: 20, snow: 0 }));
await sleep(400);
ok((await E(() => window.SF.scene._debug.env.snowStepsCount())) === 0, 'sol och plusgrader: spåren är borta');
await E(() => window.SF.scene._debug.weather(null));

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await b.close(); console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT'); process.exit(fails ? 1 : 0);
