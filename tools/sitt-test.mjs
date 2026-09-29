// SITTSYNKEN: två spelare i samma värld – den ena sätter sig, den andra ser figuren SITTA
// på samma plats (inte stå), platsen räknas som upptagen och släpps när man reser sig.
//  1) kaféet: Alva sätter sig vid ett bord → Bosse ser henne sittande, stolen är 'remote'
//  2) Bosse kan inte sätta sig på samma stol; reser Alva sig blir den ledig igen
//  3) parkbänken i staden: samma sak, Bosse får "upptaget"
// Kör: node tools/sitt-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const WORLD = 'si' + Date.now().toString(36);
const OUT = process.env.SITT_OUT || 'tools/out/sitt';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }

async function player(name, look) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(`${name}: ${m.text()}`));
  await page.goto(`http://localhost:${PORT}/index.html?world=${WORLD}`);
  await page.evaluate(([n, l]) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: n, look: l, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 60, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  }, [name, look]);
  await page.reload();
  await page.waitForFunction(() => window.SF?.worldInfo, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); });
  return { name, page };
}
const E = (p, fn, arg) => p.page.evaluate(fn, arg);
const folks = (p) => p.page.evaluate(async () => { const w = await import('./js/net/world.js'); return w.worldFolksHere(window.SF).map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), sit: f.sit, eat: f.eat, walking: f.walking })); });

const A = await player('Alva', { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#d53a7b', pants: '#2d3a5c' });
const B = await player('Bosse', { skin: '#8d5a3b', hair: '#111111', style: 'short', shirt: '#3a7bd5', pants: '#3c3c3c' });
ok(await until(async () => (await E(A, () => window.SF.worldInfo().online)) === 2 && (await E(B, () => window.SF.worldInfo().online)) === 2, 30000), 'båda är i samma värld');

// ---- 1) kaféet ----
for (const p of [A, B]) await E(p, () => { window.SF.game.min = 12 * 60; window.SF.go('kafe'); });
await sleep(900);
const seat = await E(A, () => { const d = window.SF.scene._debug; const f = d.freeSeat(); if (!f) return null; d.sit(f.id); return f.id; });
ok(!!seat, `Alva går till en ledig plats i kaféet (${seat})`);
ok(await until(async () => (await E(A, () => window.SF.scene._debug.state().me)) === 'sit'), 'Alva sitter');
const seatXY = await E(A, (id) => window.SF.scene._debug.seats().find((s) => s.id === id), seat);
let seen = null;
ok(await until(async () => { seen = (await folks(B))[0]; return seen && seen.sit && !seen.walking && Math.abs(seen.x - seatXY.x) < 2 && Math.abs(seen.y - seatXY.y) < 2; }, 12000), `Bosse ser Alva SITTA på platsen (${JSON.stringify(seen)})`);
ok(await until(async () => (await E(B, (id) => window.SF.scene._debug.seats().find((s) => s.id === id)?.occ, seat)) === 'remote', 5000), 'stolen är upptagen hos Bosse också');
await E(B, (xy) => { window.SF.scene._debug.lockCam(Math.max(0, xy.x - 190)); }, seatXY);
await sleep(300);
await B.page.screenshot({ path: `${OUT}/bosse-ser-alva-sitta.png` });

// 2) Bosse försöker ta samma stol
await E(B, (id) => window.SF.scene._debug.sit(id), seat);
await sleep(2500);
const bs = await E(B, () => window.SF.scene._debug.state());
ok(bs.seat !== seat, `Bosse sätter sig inte i knät på Alva (han sitter på ${bs.seat || 'ingen plats'})`);
// Alva reser sig
await E(A, () => window.SF.scene._debug.teleport(300, 214));
ok(await until(async () => { const f = (await folks(B))[0]; return f && !f.sit; }, 8000), 'reser sig Alva står hon upp hos Bosse också');
ok(await until(async () => (await E(B, (id) => window.SF.scene._debug.seats().find((s) => s.id === id)?.occ, seat)) !== 'remote', 5000), 'stolen blir ledig igen');

// ---- 3) parkbänken ----
for (const p of [A, B]) await E(p, () => { window.SF.go('city'); });
await sleep(1200);
const bench = await E(A, () => { const S = window.SF.scene._debug.sim(); const s = S.props.seats().find((q) => q.kind === 'glass') || S.props.seats()[0]; return s ? { id: s.id, x: s.x, y: s.y } : null; });
ok(!!bench, `det finns en bänkplats (${bench?.id})`);
await E(A, (s) => { const d = window.SF.scene._debug; d.teleport(s.x, s.y + 16); d.lockCam(s.x - 190, s.y - 150); d.sim().life._debug?.seatUse?.delete(s.id); const c = d.cam(); window.SF.scene.down(s.x - c.x, (s.y - 6) - c.y); }, bench);
ok(await until(async () => (await E(A, () => window.SF.scene._debug.sitting())) === bench.id), 'Alva sitter på bänken');
await E(B, (s) => { const d = window.SF.scene._debug; d.teleport(s.x + 30, s.y + 20); d.lockCam(s.x - 190, s.y - 150); }, bench);
ok(await until(async () => { const f = (await folks(B)).find((q) => Math.abs(q.x - bench.x) < 3 && Math.abs(q.y - bench.y) < 3); return f && f.sit; }, 12000), 'Bosse ser Alva sitta på bänken');
await sleep(300);
await B.page.screenshot({ path: `${OUT}/bosse-ser-alva-pa-banken.png` });
await E(B, (s) => { const d = window.SF.scene._debug; d.sim().life._debug?.seatUse?.delete(s.id); const c = d.cam(); window.SF.scene.down(s.x - c.x, (s.y - 6) - c.y); }, bench);
await sleep(2500);
ok((await E(B, () => window.SF.scene._debug.sitting())) !== bench.id, 'Bosse kan inte sätta sig på Alvas bänkplats');

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
