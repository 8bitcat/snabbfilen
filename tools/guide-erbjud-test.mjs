// Regressionstest för STARTGUIDEN TILL GAMLA SPELARE (offerGuide i js/core/startguide.js) – Carl 2026-10-10:
// kompisen som spelar på engelska "har inte fått tutorialen" (hen började före v0.96, då kom guiden bara för nya):
//   • en sparfil som aldrig har haft guiden → frågan "🧭 Startguiden" kommer en gång när spelet är lugnt
//   • Ja → guiden startar (listan syns); laddar man om kommer frågan inte igen
//   • Nej tack → ingen guide, och ingen fråga efter omladdning
//   • en sparfil som redan har haft guiden får ingen fråga
//   • på engelska: frågan och listan är på engelska
// Kör: node tools/guide-erbjud-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];
async function spel({ lang = '', guide = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  const url = `http://localhost:${PORT}/index.html?nomenu&guide${lang ? '&lang=' + lang : ''}&world=ge${Date.now().toString(36)}`;
  await p.goto(url);
  await p.evaluate((guide) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-gammal', name: 'Gammal', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 9, min: 11 * 60, money: 2400, hunger: 80, energy: 90, home: 'husvagn', fridge: {}, jobs: { burgare: 4 }, earned: 900, mal: { id: 'rik', niva: 'latt' } }));
    if (guide) localStorage.setItem('snabbfilen_startguide', JSON.stringify(guide));
  }, guide);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  return { ctx, p };
}
// stäng veckan/livsmålen som kommer vid start, men inte guidefrågan
const stangAndra = (p) => p.evaluate(() => { const h = document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''; if (h && !/🧭/.test(h)) { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; } });
async function vantaFraga(p, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await stangAndra(p);
    const h = await p.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
    if (/🧭/.test(h)) return h;
    await p.waitForTimeout(500);
  }
  return '';
}

// ---- en gammal sparfil utan guide: frågan → Ja ----
let s = await spel();
const fraga = await vantaFraga(s.p);
ok(/Startguiden/.test(fraga), `gammal sparfil utan guide: frågan kommer (${fraga})`);
await s.p.click('#modal .dlg-foot .btn-go'); await s.p.waitForTimeout(600);
// (listan är position: fixed – då är offsetParent alltid null, så storleken avgör)
const lista = await s.p.evaluate(() => { const e = document.querySelector('#startguide'); const r = e?.getBoundingClientRect(); return { syns: !!r && r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none', text: (e?.innerText || '').replace(/\s+/g, ' ').slice(0, 60) }; });
ok(lista.syns && /\d\/7/.test(lista.text), `Ja → startguidens lista syns (${lista.text})`);
await s.p.reload(); await s.p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
ok(!(await vantaFraga(s.p, 9000)), 'efter omladdningen kommer frågan inte igen');
await s.ctx.close();

// ---- Nej tack ----
s = await spel();
await vantaFraga(s.p);
await s.p.click('#modal .dlg-foot .btn:not(.btn-go)'); await s.p.waitForTimeout(500);
ok(await s.p.evaluate(() => { const e = document.querySelector('#startguide'); const r = e?.getBoundingClientRect(); return !e || !r.width || getComputedStyle(e).display === 'none'; }), 'Nej tack → ingen guide');
await s.p.reload(); await s.p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
ok(!(await vantaFraga(s.p, 9000)), 'Nej tack → ingen fråga efter omladdning');
await s.ctx.close();

// ---- har redan haft guiden ----
s = await spel({ guide: { on: false, done: { ut: true }, earned: 0, day: 1 } });
ok(!(await vantaFraga(s.p, 10000)), 'sparfil som redan haft guiden: ingen fråga');
await s.ctx.close();

// ---- på engelska ----
s = await spel({ lang: 'en' });
const en = await vantaFraga(s.p);
const enText = await s.p.evaluate(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
ok(/🧭/.test(en) && /guide/i.test(enText) && !/Vill du prova/.test(enText), `på engelska: frågan är på engelska (${enText.replace(/\s+/g, ' ').slice(0, 70)}…)`);
await s.ctx.close();

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
