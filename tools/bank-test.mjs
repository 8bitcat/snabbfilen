// Funktionstest av banken (js/scenes/shop-bank.js + sparkontot i game.js): sätta in och
// ta ut i kassan med riktiga musklick, eget belopp, för stora belopp, dubbelklick,
// bankomaten, rådgivaren med räntekalkyl och kontoutdrag, räntan på måndag morgon (på det
// som legat kvar hela veckan, med tak), autogirot för hyran, att sparkontot överlever en
// omladdning, öppettiderna från staden och stängt läge, panelen i hörnet, dörren ut och
// kundernas liv (kön och kassorna). Med patcharna för main.js och week.js: räntan syns i
// veckosammanfattningen när man vaknar, dagboken visar banken och slutmålet räknar med den.
// Skärmbilder hamnar i tools/out/bank/.
//   node tools/bank-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'bank') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 11 * 60, money: 1000, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=bank${Date.now().toString(36)}`);
await page.evaluate((s) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(600);

const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const G = () => page.evaluate(() => { const g = window.SF.game; return { money: g.money, bank: g.bank, bankMin: g.bankMin, day: g.day, log: g.bankLog ? [...g.bankLog] : null }; });
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1') || 'null'));
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalTitle = () => page.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const modalText = () => page.evaluate(() => document.querySelector('#modal')?.innerText || '');
const clickIn = (sel) => page.evaluate((sel) => { const b = document.querySelector('#modal ' + sel); if (!b || b.disabled) return false; b.click(); return true; }, sel);
// stänger dialogen som en spelare gör (och väntar ut klickskyddet på 0,3 s efter stängningen)
const closeDlg = async () => { await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }); await page.waitForTimeout(450); };
const waitFor = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); } return false; };
const setClock = (min) => page.evaluate((m) => { window.SF.game.min = m; }, min);
// klicka på en punkt i vyn (spelpixlar) som en riktig spelare
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
async function clickSpot(id) {
  const p = await D('spot', id);           // låser kameran över platsen om den ligger utanför bild
  if (!p) throw new Error('ingen plats ' + id);
  await clickView(p.x, p.y);
  await D('lockCam', null);
}

// ---------- in i banken ----------
await page.evaluate(() => window.SF.go('bank'));
await page.waitForTimeout(500);
ok(await page.evaluate(() => window.SF.sceneName) === 'bank', 'SF.go(\'bank\') öppnar banken');
await D('hideNpcs');
const st0 = await D('state');
ok(st0.bank === 0 && st0.money === 1000, `startläge: ${st0.money} kr på fickan, ${st0.bank} kr på banken`);
ok((await D('spots')).includes('valv'), 'valvet, kassorna, bankomaten och rådgivaren är klickbara');

// ---------- öppettiderna följer huset i staden ----------
const cityBank = await page.evaluate(async () => { const m = await import('/js/city/map.js'); const b = m.buildingById?.('bank'); return b ? { open: b.open || null } : null; });
const hrs = await D('hours');
const wantHours = cityBank?.open || [9, 18];
ok(hrs.hours[0] === wantHours[0] && hrs.hours[1] === wantHours[1], `öppettiderna ${hrs.hours.join('–')} (staden: ${cityBank ? (cityBank.open ? cityBank.open.join('–') : 'dygnet runt') : 'inget bankhus – BANK_OPEN'})`);
ok(hrs.atm24 === (!!cityBank && !cityBank.open), `bankomaten lovas dygnet runt bara om staden släpper in en dygnet runt (${hrs.atm24})`);
ok(hrs.staff && hrs.open, 'kl. 11 är banken öppen och personalen på plats');

// ---------- kassan: sätt in och ta ut med riktiga klick ----------
await clickSpot('kassa0');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 9000), 'klick på kassa 1 → figuren går fram och kassadialogen öppnas');
ok(/Kassa 1/.test(await modalTitle()), `dialogens rubrik: ${await modalTitle()}`);
ok(/Sparkontot/.test(await modalText()) && /ränta/i.test(await modalText()) && /hela veckan/.test(await modalText()), 'dialogen visar sparkontot och räntan (på det som legat kvar hela veckan)');
ok((await D('state')).wins[0] === 'me', 'kassa 1 är min medan jag står där');
await page.screenshot({ path: OUT + 'kassa-dialog.png' });
ok(await clickIn('[data-in="500"]'), 'knappen Sätt in 500 går att trycka');
let g = await G();
ok(g.money === 500 && g.bank === 500, `insatt 500: fickan ${g.money}, banken ${g.bank}`);
ok(g.log?.at(-1)?.t === 'in' && g.log.at(-1).n === 500 && g.log.at(-1).d === 3, 'kontoutdraget: insättning 500 dag 3');
ok((await stored()).bank === 500, 'insättningen är sparad');
ok(/Insatt/.test(await modalText()), 'kvittot syns i dialogen');
ok(g.bankMin === 0 && await D('next') === 0 && /ger ränta från nästa vecka/.test(await modalText()), `nyinsatta pengar ger ränta från nästa vecka (veckans lägsta saldo ${g.bankMin}, räntan på måndag +${await D('next')})`);
ok(await clickIn('[data-ut="100"]'), 'Ta ut 100');
g = await G();
ok(g.money === 600 && g.bank === 400, `uttag 100: fickan ${g.money}, banken ${g.bank}`);
await page.fill('#bank-kr', '123');
await clickIn('[data-own="in"]');
g = await G();
ok(g.money === 477 && g.bank === 523, `eget belopp 123 insatt: fickan ${g.money}, banken ${g.bank}`);
ok(await page.evaluate(() => document.querySelector('#modal [data-in="1000"]')?.disabled === true), 'sätt in 1000 är gråad när fickan bara har 477');
await page.fill('#bank-kr', '99999');
await clickIn('[data-own="ut"]');
g = await G();
ok(g.money === 477 && g.bank === 523, 'för stort uttag → inget händer');
const r1 = await D('deposit', -5);
ok(!r1.ok && (await G()).bank === 523, 'negativt belopp nekas');
// dubbelklick med musen på en beloppsknapp: dialogen ritas om under musen, men det blir bara EN insättning
await page.waitForTimeout(450);
await page.dblclick('#modal [data-in="50"]');
await page.waitForTimeout(150);
g = await G();
ok(g.bank === 573 && g.money === 427, `dubbelklick på Sätt in 50 → en insättning (banken ${g.bank}, fickan ${g.money})`);
await page.waitForTimeout(450);
await clickIn('[data-in="50"]');
g = await G();
ok(g.bank === 623, `ett nytt klick en stund senare räknas (banken ${g.bank})`);
await page.screenshot({ path: OUT + 'kassa-kvitto.png' });
await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Kontoutdrag/.test(b.textContent))?.click());
ok(/Kontoutdrag/.test(await modalTitle()) && /Insättning/.test(await modalText()) && /Uttag i kassan/.test(await modalText()), 'kontoutdraget listar insättningar och uttag');
await page.screenshot({ path: OUT + 'kontoutdrag.png' });
await closeDlg();

// ---------- bankomaten ----------
await clickSpot('bankomat');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000), 'klick på bankomaten → figuren går dit och bankomaten öppnas');
ok(/Bankomat/.test(await modalTitle()), `rubrik: ${await modalTitle()}`);
ok(!(await modalText()).match(/Sätt in/i) || /bara ut/i.test(await modalText()), 'bankomaten tar bara ut');
await page.screenshot({ path: OUT + 'bankomat-dialog.png' });
ok(await clickIn('[data-atm="200"]'), 'uttag 200 i bankomaten');
g = await G();
ok(g.money === 577 && g.bank === 423 && g.log.at(-1).t === 'atm', `bankomaten: fickan ${g.money}, banken ${g.bank}, loggen ${g.log.at(-1).t}`);
ok(await waitFor(() => window.SF.scene._debug.state().atm.mode === 'cash', 3000), 'sedlarna kommer ut ur bankomaten');
await page.waitForTimeout(250);
await page.screenshot({ path: OUT + 'bankomat-sedlar.png' });
ok(await page.evaluate(() => document.querySelector('#modal [data-atm="1000"]') === null), 'bankomatens dialog stängdes vid uttaget');
// dubbelklick i bankomaten: första klicket tar ut och stänger, det andra får inte gå vidare ner i hallen
await page.waitForTimeout(3200);
await page.evaluate(() => window.SF.scene._debug.open('bankomat'));
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 9000), 'bankomaten öppnas igen');
await page.dblclick('#modal [data-atm="100"]');
await page.waitForTimeout(500);
g = await G();
const stA = await D('state');
ok(g.bank === 323 && g.log.at(-1).t === 'atm', `dubbelklick på 100 kr → ett uttag (banken ${g.bank})`);
ok(!(await modalOpen()) && stA.meWin === null && (await D('pos')).path === 0, 'andra klicket gick inte vidare till hallen (ingen kassa, figuren står kvar)');
await page.waitForTimeout(2500);

// ---------- rådgivaren ----------
await clickSpot('radgivare');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000), 'klick på rådgivaren → man sätter sig och dialogen öppnas');
ok(/Rådgivaren/.test(await modalTitle()) && /Räntekalkyl/.test(await modalText()), 'rådgivaren visar räntekalkylen');
ok(!/dygnet runt/.test(await modalText()) || hrs.atm24, 'rådgivaren lovar inte en bankomat dygnet runt som inte finns');
ok((await D('state')).seat, 'figuren sitter i besöksstolen');
ok(await D('interest', 1000) === 20 && await D('interest', 24) === 0 && await D('grow', 1000, 2) === 1040, 'räntan: 2 % av 1000 = 20, av 24 = 0, 1000 kr i två veckor = 1040');
ok(await D('interest', 100000) === 400, 'räntetaket: 100 000 kr ger 400 kr (räntan räknas på högst 20 000)');
await page.screenshot({ path: OUT + 'radgivaren.png' });
await closeDlg();

// ---------- sparkontopanelen täcker inga skyltar ----------
const vw = await page.evaluate(() => Math.max(384, Math.min(window.SF.W || 384, 672)));
let worst = { cover: 0, cam: 0 }, sides = new Set();
for (let cx = 0; cx <= 672 - vw; cx += 12) {
  await D('lockCam', cx);
  await page.waitForTimeout(60);
  const p = await D('panel');
  if (p) { sides.add(p.side + (p.mini ? '-liten' : '')); if (p.cover > worst.cover) worst = { cover: p.cover, cam: cx, side: p.side }; }
}
await D('lockCam', 150); await page.waitForTimeout(80);
await page.screenshot({ path: OUT + 'panel-vy-150.png' });
await D('lockCam', null);
ok(worst.cover <= 60, `panelen i hörnet täcker högst ${worst.cover} skyltpixlar (värst vid kameran ${worst.cam}, ${worst.side}) – sidor och lägen: ${[...sides].join('/')}`);

// ---------- räntan på måndag och autogirot ----------
// (Math.random stängs av under sömnen – annars kan morgonens händelse ge +20 kr på trottoaren)
const sleepRes = (setup, before = null) => page.evaluate(([s, before]) => {
  const g = window.SF.game, rnd = Math.random;
  Object.assign(g, s);
  if (before) for (const [fn, kr] of before) g[fn](kr);
  Math.random = () => 0.99;
  try { const r = g.sleep(); return { r, money: g.money, bank: g.bank, bankMin: g.bankMin, day: g.day, log: g.bankLog.slice(-2) }; } finally { Math.random = rnd; }
}, [setup, before]);
let s = await sleepRes({ day: 7, money: 500, bank: 1000, bankMin: 1000, home: 'rum' });
ok(s.day === 8 && s.bank === 1020 && s.r.interest === 20 && s.money === 150 && !s.r.rentFromBank, `söndag → måndag: räntan +${s.r.interest} (banken ${s.bank}), hyran ${s.r.rent} från fickan (${s.money})`);
ok(s.log.at(-1).t === 'ranta' && s.log.at(-1).n === 20 && s.log.at(-1).d === 8, 'räntan står i kontoutdraget på måndagen');
ok(s.bankMin === 1020, 'en ny räntevecka börjar med saldot efter räntan');
s = await sleepRes({ day: 14, money: 100, bank: 1000, bankMin: 1000 });
ok(s.bank === 770 && s.money === 0 && s.r.rentFromBank === 250 && s.log.at(-1).t === 'hyra', `autogiro: fickan räckte till 100, banken tog ${s.r.rentFromBank} (banken ${s.bank}, fickan ${s.money})`);
ok(s.bankMin === 770, 'veckans lägsta saldo efter autogirot = det som finns kvar');
s = await sleepRes({ day: 21, money: 100, bank: 0, bankMin: 0 });
ok(s.money === -250 && s.bank === 0, `tomt konto: skulden blir ${s.money} som förut`);
s = await sleepRes({ day: 22, money: 0, bank: 1000, bankMin: 1000 });
ok(s.bank === 1000 && !s.r.interest, 'ingen ränta en vanlig tisdag');
s = await sleepRes({ day: 28, money: -250, bank: 1000, bankMin: 1000 });
ok(s.bank === 1020 - 350 && s.money === -250, 'gammal skuld betalas inte automatiskt – bara veckans hyra tas från kontot');
// fusket: sätta in på söndagen och ta ut på måndagen ger ingen ränta
s = await sleepRes({ day: 35, money: 10350, bank: 0, bankMin: 0 }, [['bankDeposit', 10000]]);
ok(s.bank === 10000 && !s.r.interest && s.money === 0, `insatt 10 000 på söndagen → ingen ränta på måndagen (banken ${s.bank})`);
s = await sleepRes({ day: 42 }, [['bankWithdraw', 4000], ['bankDeposit', 4000]]);
ok(s.r.interest === 120 && s.bank === 10120 - 350, `uttag mitt i veckan sänker räntan: lägsta saldot 6 000 → +${s.r.interest}`);
s = await sleepRes({ day: 49, money: 1000, bank: 100000, bankMin: 100000 });
ok(s.r.interest === 400, `taket: 100 000 kr på banken ger +${s.r.interest} i veckan`);

// ---------- sparfilen överlever omladdning ----------
await page.evaluate(() => { const g = window.SF.game; g.day = 9; g.min = 11 * 60; g.money = 900; g.bank = 4321; g.bankMin = 1234; g.logBank('in', 4321); g.save(); });
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(400);
g = await G();
ok(g.bank === 4321 && g.bankMin === 1234 && g.log.length >= 5 && g.log.at(-1).n === 4321, `efter omladdning: banken ${g.bank}, lägsta saldot ${g.bankMin}, ${g.log.length} rader i kontoutdraget`);
ok(Array.isArray((await stored()).bankLog) && (await stored()).bankLog.length <= 12, 'kontoutdraget i sparfilen är högst 12 rader');

// ---------- kundernas liv: kön och kassorna ----------
await page.evaluate(() => window.SF.go('bank'));
await page.waitForTimeout(400);
await D('wakeNpcs');
let sawQueue = false, alwaysFree = true, stuck = 0;
for (let k = 0; k < 60; k++) {
  await page.waitForTimeout(500);
  const st = await D('state');
  if (st.queue > 0) sawQueue = true;
  if (!st.wins.some((w) => w === null)) alwaysFree = false;
  for (const n of st.npcs) if (n.state !== 'away' && !(await D('walkable', n.x, n.y))) stuck++;
  if (k === 24) await page.screenshot({ path: OUT + 'kunder.png' });
  if (st.served >= 2 && sawQueue && k > 30) break;
}
const stEnd = await D('state');
ok(stEnd.served >= 1, `kunder har blivit betjänade i kassorna (${stEnd.served})`);
ok(sawQueue, 'kunder har stått i kön');
ok(alwaysFree, 'en kassa har hela tiden varit ledig åt spelaren');
ok(stuck === 0, 'ingen kund har fastnat i ett hinder');
const save = async (name, url) => fs.writeFileSync(OUT + name, Buffer.from(url.split(',')[1], 'base64'));
await save('panorama.png', await D('panorama', 2));

// ---------- efter stängning: personalen går hem, bara bankomaten tar ut ----------
const [, close] = hrs.hours;
await setClock((close + 0.75) * 60);
ok(await waitFor(() => { const d = window.SF.scene._debug; return !d.hours().staff && d.tellersShown() === 0; }, 15000), `kl. ${close}:45: kassörerna har gått hem`);
ok(await waitFor(() => { const s = window.SF.scene._debug.state(); return s.queue === 0 && s.npcs.every((n) => n.state !== 'queue'); }, 20000), 'kön går hem när kassorna stängt');
await page.screenshot({ path: OUT + 'stangt.png' });
await save('pano-stangt.png', await D('panorama', 2));
await D('hideNpcs');
await D('teleport', 250, 172);
await clickSpot('kassa1');
await page.waitForTimeout(600);
ok(!(await modalOpen()) && /stängt/i.test(await D('said')), `kassan öppnas inte efter stängning: "${await D('said')}"`);
await page.waitForTimeout(500);
await clickSpot('radgivare');
await page.waitForTimeout(600);
ok(!(await modalOpen()) && /gått hem/.test(await D('said')), 'rådgivaren har gått hem');
await page.evaluate(() => window.SF.scene._debug.open('bankomat'));
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 9000) && /Bankomat/.test(await modalTitle()), 'bankomaten tar fortfarande ut');
await closeDlg();
await setClock(11 * 60);
ok(await waitFor(() => window.SF.scene._debug.tellersShown() === 3, 3000), 'kl. 11 är kassörerna tillbaka');

// ---------- ut genom karusselldörren ----------
await D('hideNpcs');
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 9000), 'klick på karusselldörren → ut i staden');

// ---------- när man vaknar: räntan och autogirot syns (main.js + week.js) ----------
await page.evaluate(() => { const g = window.SF.game; Object.assign(g, { day: 56, min: 22 * 60, money: 100, bank: 1000, bankMin: 1000, home: 'rum' }); window.SF.sleepFlow(); });
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 3000), 'sov-dialogen öppnas');
const sleepTxt = await modalText();
ok(/Räntan på sparkontot kommer i morgon bitti: \+20/.test(sleepTxt) && /banken tar 250/.test(sleepTxt), 'sov-dialogen säger att räntan kommer och att banken tar det som fattas av hyran');
await page.evaluate(() => { const rnd = Math.random; Math.random = () => 0.99; try { [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Sov/.test(b.textContent)).click(); } finally { Math.random = rnd; } });
ok(await waitFor(() => /God morgon/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 5000), 'veckosammanfattningen öppnas på morgonen');
const weekTxt = await modalText();
ok(/Räntan kom in: \+20/.test(weekTxt), 'veckosammanfattningen: "Räntan kom in: +20 kr på sparkontot"');
ok(/250 kr av hyran drogs från sparkontot/.test(weekTxt) && weekTxt.split('av hyran drogs').length === 2, 'veckosammanfattningen: autogirot tog 250 kr från sparkontot (en rad)');
ok(/På banken/.test(weekTxt), 'veckans läge visar pengarna på banken');
await page.screenshot({ path: OUT + 'vecka-ranta.png' });
await closeDlg();
await page.evaluate(() => { const g = window.SF.game; Object.assign(g, { day: 18, money: 100, bank: 5000, bankMin: 5000 }); window.SF.game.save(); });
const wk = await page.evaluate(async () => { const m = await import('/js/core/week.js'); const w = m.weekInfo(window.SF.game); return { need: w.need, saved: w.saved }; });
ok(wk.need === 0 && wk.saved === 5000, `hyresprognosen räknar med sparkontot (behöver tjäna ${wk.need})`);

// ---------- dagboken och slutmålet räknar med banken (main.js) ----------
await page.evaluate(() => document.querySelector('#hud-diary')?.click());
ok(await waitFor(() => /På banken/.test(document.querySelector('#modal')?.innerText || ''), 3000), 'dagboken visar raden 🏦 På banken');
await closeDlg();
await page.evaluate(() => { const g = window.SF.game; Object.assign(g, { home: 'villa', money: 5000, bank: 6000, bankMin: 6000, won: false }); });
ok(await waitFor(() => window.SF.game.won === true, 4000), 'slutmålet: Villan + 5 000 på fickan + 6 000 på banken räcker');
ok(/6 000 kr av dem på banken|av dem på banken/.test(await modalText()), 'gratulationen nämner pengarna på banken');
await closeDlg();

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'inga konsolfel');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
