// Regressionstest för PASSTIDEN PER JOBB (JOBS[id].tid i js/game.js, beginShift i js/jobs/shift.js) –
// Carl 2026-10-10: "tvätteriet och flygplatsen borde vara dubbelt så lång tid … fast klockan i spelet ska vara samma":
//   • tvätteriet och flygplatsen: 120 s att spela som nybörjare, Burgarbaren 60 s
//   • alla tre är fortfarande 4 timmar (240 min) på klockan, och klockan går fram 4 timmar när passet är slut
//   • jobbdialogen säger att man får dubbelt så lång tid (bara på de jobben)
//   • nivån och den längre passtiden staplas: tvätteriet som Legendar = 2 × 79 s
// Kör: node tools/passtid-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=pt${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-pt', name: 'Tid', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 10 * 60, money: 900, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.waitForTimeout(700);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();

// starta ett pass, läs planen och lämna det direkt
async function pass(job, scene, jobs = {}) {
  return p.evaluate(async ({ job, scene, jobs }) => {
    const g = window.SF.game; Object.assign(g.jobs, jobs); g.energy = 100; g.hunger = 90; g.min = 10 * 60;
    const m = await import('/js/jobs/shift.js');
    m.startShiftNow(window.SF, job, scene);
    await new Promise((r) => setTimeout(r, 600));
    const P = window.SF.shiftPlan;
    return { seconds: P?.seconds, gameMin: P?.gameMin, scene: window.SF.sceneName };
  }, { job, scene, jobs });
}
const ut = () => p.evaluate(async () => { window.SF.go('city'); await new Promise((r) => setTimeout(r, 400)); });

const tv = await pass('tvatteri', 'jobbtvatt');
ok(tv.scene === 'jobbtvatt' && tv.seconds === 120 && tv.gameMin === 240, `tvätteriet: ${tv.seconds} s att spela, ${tv.gameMin} min på klockan`);
await ut();
const fl = await pass('flygplats', 'jobbflyg');
ok(fl.seconds === 120 && fl.gameMin === 240, `flygplatsen: ${fl.seconds} s att spela, ${fl.gameMin} min på klockan`);
await ut();
const bu = await pass('burgare', 'jobbburgare');
ok(bu.seconds === 60 && bu.gameMin === 240, `Burgarbaren: ${bu.seconds} s som förut, ${bu.gameMin} min på klockan`);
await ut();
const leg = await pass('tvatteri', 'jobbtvatt', { tvatteri: 12 });
ok(leg.seconds === 158, `tvätteriet som Legendar: ${leg.seconds} s (2 × 79 s)`);
await ut();

// klockan: ett helt pass i tvätteriet (passet kortas till slutet) flyttar klockan 4 timmar
const klocka = await p.evaluate(async () => {
  const g = window.SF.game; g.jobs.tvatteri = 0; g.energy = 100; g.hunger = 90; g.min = 10 * 60;
  const fore = g.day * 1440 + g.min;
  const m = await import('/js/jobs/shift.js');
  m.startShiftNow(window.SF, 'tvatteri', 'jobbtvatt');
  await new Promise((r) => setTimeout(r, 800));
  const halv = window.SF.scene._debug?.time?.();
  window.SF.shiftPlan.seconds = (halv || 0) + 0.5;   // hoppa till passets slut (samma knep som samarbetstesterna)
  for (let i = 0; i < 60 && /^jobb/.test(window.SF.sceneName || ''); i++) await new Promise((r) => setTimeout(r, 200));
  return { min: g.day * 1440 + g.min - fore };
});
ok(klocka.min >= 240 && klocka.min <= 260, `ett pass i tvätteriet flyttar klockan ${klocka.min} min (4 timmar)`);
await stang();

// jobbdialogen
const text = async (job, scene) => { await p.evaluate(async ([j, s]) => { const m = await import('/js/jobs/shift.js'); m.startJobFlow(window.SF, j, s); }, [job, scene]); await p.waitForTimeout(300); const t = await p.evaluate(() => document.querySelector('#modal:not(.hidden)')?.innerText || ''); await stang(); return t; };
ok(/dubbelt så lång tid/.test(await text('tvatteri', 'jobbtvatt')), 'tvätteriets jobbdialog: "dubbelt så lång tid på dig"');
ok(!/dubbelt så lång tid/.test(await text('burgare', 'jobbburgare')), 'Burgarbarens jobbdialog säger inget om längre tid');

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
