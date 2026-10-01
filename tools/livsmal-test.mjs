// Funktionstest av LIVSMÅLEN och LYCKAN (game.js MAL/glad/malStatus, js/core/livsmal.js, week.js,
// HUD:en): nytt liv väljer livsmål efter välkomsten (förval och egna nivåer), en sparfil från före
// livsmålen får välja första gången och börjar på lycka 60, dagens tak per källa, passen tär på
// lyckan (mer för långa pass och det tredje i dag), lyckan påverkar lönen och sömnen, natten
// (vardagen, ledig dag, bostaden, möblerna, skulder) syns i veckorutan, dagboken och 🎯-rutan,
// och när alla fyra målen är nådda samtidigt kommer gratulationen – en gång.
//   node tools/livsmal-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'livsmal') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const AVATAR = { name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalTitle = () => page.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const modalText = () => page.evaluate(() => document.querySelector('#modal')?.innerText || '');
const clickIn = (sel) => page.evaluate((sel) => { const b = document.querySelector('#modal ' + sel); if (!b || b.disabled) return false; b.click(); return true; }, sel);
const clickBtn = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal .dlg-foot button')].find((x) => r.test(x.textContent)); if (!b) return false; b.click(); return true; }, re.source);
const waitFor = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); } return false; };
const closeDlg = async () => { await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }); await page.waitForTimeout(450); };
const start = async (save, query = '') => {
  await page.goto(`http://localhost:${PORT}/index.html?nomenu${query}&world=lm${Date.now().toString(36)}`);
  await page.evaluate(([s, av]) => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify(av)); if (s) localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, [save, AVATAR]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await page.waitForTimeout(700);
};

// ---------- ett nytt liv: välkomsten → livsmålen → veckan ----------
await start(null, '&mal&week');
ok(/Välkommen/.test(await modalTitle()), `nytt liv: välkomsten först (${await modalTitle()})`);
await clickBtn(/Till husvagnen/);
ok(await waitFor(() => /Välj dina livsmål/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 4000), 'efter välkomsten: välj dina livsmål');
ok(await page.evaluate(() => !document.querySelector('#modal [data-close]')), 'första valet går inte att klicka bort (inget ✕)');
ok(await page.evaluate(() => document.querySelectorAll('#modal .lm-row').length === 4 && document.querySelectorAll('#modal .lm-chip').length === 12), 'fyra mål med tre nivåer var');
ok(/3\s000 kr/.test(await modalText()) && /25\s000 kr/.test(await modalText()) && /Legendar/.test(await modalText()), 'nivåerna visar vad som krävs (3 000 kr … 25 000 kr, Legendar)');
await page.screenshot({ path: OUT + 'valj-livsmal.png' });
await clickIn('[data-alla="latt"]');
ok(await page.evaluate(() => [...document.querySelectorAll('#modal .lm-chip.on')].every((b) => b.dataset.niva === 'latt') && document.querySelectorAll('#modal .lm-chip.on').length === 4), '🌱 Allt lätt markerar lätt i alla fyra');
await clickIn('[data-mal="rik"][data-niva="svar"]');
await clickBtn(/siktar jag på/);
const mal = await page.evaluate(() => window.SF.game.mal);
ok(mal && mal.rik === 'svar' && mal.lycka === 'latt' && mal.utb === 'latt' && mal.karr === 'latt', `valet sparas: ${JSON.stringify(mal)}`);
ok(await waitFor(() => /Vecka|God morgon/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 4000), 'sedan veckan');
ok(await page.evaluate(() => document.querySelectorAll('#modal .lm-mini > span').length === 4), 'veckan visar de fyra livsmålen');
ok(/Lycka/.test(await modalText()), 'veckans läge visar lyckan');
await page.screenshot({ path: OUT + 'veckan.png' });
await closeDlg();
ok(await page.evaluate(() => window.SF.game.lycka === 60), 'lyckan börjar på 60');
ok(await page.evaluate(() => document.querySelector('#bar-lycka')?.style.width === '60%'), 'HUD:en har en lyckomätare (😊) på 60 %');
ok(await page.evaluate(() => !!document.querySelector('#hud-goals')), 'HUD:en har 🎯-knappen');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1')).mal?.rik === 'svar'), 'livsmålen ligger i sparfilen');

// ---------- lyckan: dagens tak, passen, lönen, sömnen ----------
const L = await page.evaluate(() => {
  const g = window.SF.game, out = {};
  g.lycka = 50;
  out.nytt = [g.glad(4, '', 'nytt', 10), g.glad(4, '', 'nytt', 10), g.glad(4, '', 'nytt', 10), g.glad(4, '', 'nytt', 10)];
  out.efter = g.lycka;
  out.ner = g.glad(-200); out.noll = g.lycka;
  g.lycka = 60; g.energy = 100; g.hunger = 80; g.min = 8 * 60; g.passIdag = 0; g.sistaPass = 0;
  const r1 = g.endShift('burgare', 100); g.min = 8 * 60;
  const r2 = g.endShift('burgare', 100); g.min = 8 * 60;
  const r3 = g.endShift('burgare', 100);
  out.pass = [r1.gladPass, r2.gladPass, r3.gladPass, r3.passIdag, g.lycka];
  g.min = 8 * 60; g.energy = 100;
  out.lang = g.endShift('burgare', 100, {}, { len: 'langt', gameMin: 360, energy: 50 }).gladPass;
  g.lycka = 90; g.min = 8 * 60; out.glad = g.endShift('burgare', 100).finalPay;
  g.lycka = 10; g.min = 8 * 60; out.nere = g.endShift('burgare', 100).finalPay;
  g.lycka = 50; g.min = 8 * 60; out.mitt = g.endShift('burgare', 100).finalPay;
  return out;
});
ok(L.nytt.join(',') === '4,4,2,0' && L.efter === 60, `dagens tak: nya saker ger högst +10 om dagen (${L.nytt.join(', ')})`);
ok(L.ner === -60 && L.noll === 0, 'lyckan går inte under 0');
ok(L.pass[0] === -3 && L.pass[1] === -3 && L.pass[2] === -7 && L.pass[3] === 3, `varje pass −3, det tredje i dag −7 (${L.pass.slice(0, 3).join(', ')})`);
ok(L.lang === -9, `ett långt pass (det fjärde i dag) tär mer: ${L.lang}`);
ok(L.glad === 105 && L.nere === 90 && L.mitt === 100, `lönen: glad (90) +5 % = ${L.glad}, nere (10) −10 % = ${L.nere}, mitt emellan = ${L.mitt}`);

// natten: vardagen, ledig dag, husvagnen, möblerna, skulder – och sömnen efter humöret
const N = await page.evaluate(() => {
  const g = window.SF.game, rnd = Math.random, out = {};
  Math.random = () => 0.9;                                                              // ingen dagshändelse
  try {
    const night = (lycka, prep) => { g.lycka = lycka; g.energy = 0; g.hunger = 0; g.money = 500; g.sistaPass = g.day; g.min = 22 * 60; prep?.(); g.sleep(); return { l: g.lycka, e: g.energy, n: g.gladNatt.map((x) => `${x.t} ${x.n}`) }; };
    g.home = 'husvagn'; g.deco = {};
    out.jobb = night(50);                                                               // jobbade i går
    out.ledig = night(50, () => { g.sistaPass = g.day - 1; });                          // ledig dag
    out.mobler = night(50, () => { g.deco['husvagn:0'] = Array.from({ length: 6 }, (_, i) => ({ k: 'lampa', v: 0, x: 40 + i * 10, y: 120 })); });
    out.skuld = night(50, () => { g.money = -100; });
    out.sovGlad = night(90).e; out.sovMitt = night(50).e; out.sovNere = night(10).e;
  } finally { Math.random = rnd; }
  return out;
});
ok(N.jobb.l === 40 && N.jobb.n.join('|') === 'Vardagen -3|Hungrig i sängen -3|Husvagnen -4', `natten efter ett jobb i husvagnen, hungrig: ${N.jobb.n.join(', ')} → ${N.jobb.l}`);
ok(N.ledig.n.includes('Ledig dag 6') && N.ledig.l === 46, `en ledig dag ger +6 (${N.ledig.l})`);
ok(N.mobler.n.includes('Fint möblerat 1'), 'möbler hemma (minst 5) ger +1 på morgonen');
ok(N.skuld.n.includes('Skulder -4'), 'skulder på morgonen tär på lyckan');
ok(N.sovGlad === N.sovMitt + 5 && N.sovNere === N.sovMitt - 5, `sömnen: glad +5 / nere −5 ork (${N.sovGlad} / ${N.sovMitt} / ${N.sovNere})`);
// veckorutan på morgonen visar natten
await page.evaluate(async () => { const m = await import('/js/core/week.js'); m.openWeek(window.SF, { morning: true }); });
ok(/Lyckan i natt/.test(await modalText()), 'veckorutan på morgonen: "Lyckan i natt" med skälen');
await page.screenshot({ path: OUT + 'morgon.png' });
await closeDlg();

// ---------- livsmålen: status, gratulationen en gång, dagboken, 🎯 ----------
await page.evaluate(() => {
  const g = window.SF.game;
  Object.assign(g, { mal: { rik: 'latt', lycka: 'latt', utb: 'latt', karr: 'latt' }, malKlar: 0, money: 2000, bank: 0, lycka: 70, hunger: 90, energy: 90 });
  g.edu = {}; for (const k of Object.keys(g.jobs)) g.jobs[k] = 0;
});
await page.waitForTimeout(400);
const S0 = await page.evaluate(() => window.SF.game.malStatus().map((s) => `${s.key}:${s.have}/${s.need}:${s.done ? 1 : 0}`));
ok(S0.join(' ') === 'rik:2000/3000:0 lycka:70/60:1 utb:0/4:0 karr:1/2:0', `status: ${S0.join(' ')}`);
await page.evaluate(() => document.querySelector('#hud-goals').click());
ok(await waitFor(() => /Dina livsmål/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 3000), '🎯 öppnar livsmålen');
ok(/1 av 4/.test(await modalText()) && await page.evaluate(() => document.querySelectorAll('#modal .lm-row.ok').length === 1), '🎯 visar 1 av 4 nådda (lyckan)');
await page.screenshot({ path: OUT + 'livsmal.png' });
await closeDlg();
await page.evaluate(() => { const g = window.SF.game; g.money = 3500; g.edu = { datorteknik: { lect: 4, day: 1, tenta: 0, tentaDay: 0, klar: false } }; });
await page.waitForTimeout(400);
ok(await page.evaluate(() => !window.SF.game.malKlar), 'tre av fyra räcker inte');
await page.evaluate(() => { window.SF.game.jobs.burgare = 3; });
ok(await waitFor(() => window.SF.game.malKlar > 0, 4000), 'alla fyra nådda samtidigt → livsmålen klara');
ok(/klarat livet i Pixelstaden/.test(await modalTitle()), `gratulationen: ${await modalTitle()}`);
await page.screenshot({ path: OUT + 'klart.png' });
await closeDlg();
await page.evaluate(() => { const g = window.SF.game; g.mal = { rik: 'svar', lycka: 'svar', utb: 'svar', karr: 'svar' }; g.money = 30000; g.lycka = 95; g.jobs.burgare = 12; g.edu.ekonomi = { lect: 4, klar: true }; g.edu.datorteknik.klar = true; });
await page.waitForTimeout(600);
ok(!(await modalOpen()), 'högre nivåer efteråt firas inte igen');
await page.evaluate(() => document.querySelector('#hud-diary').click());
ok(await waitFor(() => /Livsmålen/.test(document.querySelector('#modal')?.innerText || ''), 3000) && /ALLA NÅDDA/.test(await modalText()) && /Lycka/.test(await modalText()), 'dagboken visar lyckan och livsmålen');
await closeDlg();

// ---------- en sparfil från före livsmålen ----------
const OLD = { v: 1, day: 5, min: 10 * 60, money: 800, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
await start(OLD, '&mal');
ok(await page.evaluate(() => window.SF.game.lycka === 60 && window.SF.game.mal === null), 'gammal sparfil: lyckan 60, inga livsmål än');
ok(await waitFor(() => /Välj dina livsmål/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 4000), 'gammal sparfil: får välja livsmål först');
await clickBtn(/siktar jag på/);
ok(await page.evaluate(() => Object.values(window.SF.game.mal || {}).every((v) => v === 'normal')), 'förvalet är normal i alla fyra');
await closeDlg();
await page.evaluate(() => { window.SF.game.lycka = 77; window.SF.game.save(); });
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
ok(await page.evaluate(() => window.SF.game.lycka === 77 && window.SF.game.mal?.rik === 'normal'), 'lyckan och livsmålen överlever en omladdning');
ok(!/Välj dina livsmål/.test(await modalTitle()), 'valda livsmål frågas inte om igen');

// ---------- testrobotar utan ?mal slipper rutan ----------
await start(OLD);
ok(!/livsmål/i.test(await modalTitle()), 'utan ?mal: ingen livsmålsruta för robotarna (andra tester störs inte)');

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'inga konsolfel');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
