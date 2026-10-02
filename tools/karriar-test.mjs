// Funktionstest av KARRIÄRSTEGARNA (game.js ROLLER/KLADKOD/befordran/befordra/betalaChefslon,
// js/core/karriar.js intervjun, js/jobs/shift.js beslut + lön, Pixelhögskolans Ledarskap):
//   1. Proffs på Burgarbaren: passdialogen visar befattningen och att man kan söka befordran
//   2. efter passet: "Sök befordran" → chefen kollar kläderna (linne = kom tillbaka)
//   3. rätt klädd: tre frågor, två rätt = skiftledare; en intervju om dagen
//   4. skiftledaren väljer fokus inför passet (tempo = fler kunder och +10 %); lönen ×1,2
//   5. biträdande chef kräver Mästare + Ledarskap + skjorta; chef kräver Legendar, 3 pass som
//      biträdande chef och kavaj – och sätter priserna
//   6. chefslönen på måndagen (minst 2 pass i veckan), dagboken, sparfilen, kursen Ledarskap
//   node tools/karriar-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 10 * 60, money: 3000, hunger: 80, energy: 100, home: 'rum', fridge: {}, jobs: { burgare: 6 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, lycka: 60 };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=kr${Date.now().toString(36)}`);
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Chefen', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', top: 'tank', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, SAVE);
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const title = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
const text = () => D(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const toasts = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '));
// svara rätt på intervjun (frågebanken i karriar.js)
async function answerAll(right = 3) {
  for (let i = 0; i < 3; i++) {
    await until(() => /Intervju/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
    await D(async (wrong) => {
      const K = await import('./js/core/karriar.js');
      const q = document.querySelector('#modal p').textContent;
      const f = K.FRAGOR.find((x) => q.includes(x[0]));
      const btns = [...document.querySelectorAll('#modal [data-o]')];
      const b = wrong ? btns.find((x) => x.textContent !== f[1]) : btns.find((x) => x.textContent === f[1]);
      b.click();
    }, i >= right);
    await sleep(150);
  }
}
const shiftTo = async (stats, beslut = null) => {
  await D(() => { const g = SF.game; g.energy = 100; g.hunger = 80; g.min = 10 * 60; });
  await D(() => SF.startJob('burgare'));
  await until(() => /Burgarbaren/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
  if (beslut) for (const [k, v] of Object.entries(beslut)) await D(([k, v]) => document.querySelector(`#modal [data-${k}="${v}"]`)?.click(), [k, v]);
  await clickBtn(/Vanligt pass|Jobba ett pass/);
  await until(() => SF.sceneName === 'jobbburgare');
  await sleep(300);
  const plan = await D(() => ({ ...SF.shiftPlan }));
  await D(async (st) => { const m = await import('./js/jobs/shift.js'); m.endShiftNow(SF, st); }, stats);
  await until(() => /Passet är slut/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
  return plan;
};

// ---------- 1. passdialogen ----------
let b = await D(() => SF.game.befordran('burgare'));
ok(b.ok && b.nasta.id === 'skift', 'Proffs på Burgarbaren: kan söka befordran till skiftledare');
await D(() => SF.startJob('burgare'));
await until(() => /Burgarbaren/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
ok(/Befattning: Medarbetare/.test(await text()) && /söka befordran till Skiftledare/.test(await text()), 'passdialogen: befattning + du kan söka befordran');
ok(!(await D(() => !!document.querySelector('#modal [data-fokus]'))), 'medarbetare har inga beslut att fatta');
await closeDlg();
// ---------- 2. kläderna ----------
await shiftTo({ ok: 10, fel: 2 });
ok(/sök befordran till/.test(await text()) && (await clickBtn(/Sök befordran/)), 'efter passet: Sök befordran');
await until(() => /på Burgarbaren/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
ok(/prydliga kläder/.test(await text()), 'i linne: chefen vill se prydliga kläder');
await clickBtn(/Okej/);
ok(!(await D(() => SF.game.befordran('burgare').soktIdag)), 'fel kläder förbrukar ingen intervju');
// ---------- 3. intervjun ----------
await D(() => { SF.avatar.look.top = 'tee'; });
await D(async () => { const K = await import('./js/core/karriar.js'); K.openIntervju(SF, 'burgare'); });
await answerAll(1);
ok(/Inte den här gången/.test(await title()) && (await D(() => SF.game.roller.burgare | 0)) === 0, 'en rätt av tre: inte befordrad');
await clickBtn(/Okej/);
await D(async () => { const K = await import('./js/core/karriar.js'); K.openIntervju(SF, 'burgare'); });
await sleep(200);
ok(/redan pratat/.test(await toasts()), 'en intervju om dagen');
await D(() => { SF.game.day++; SF.game.min = 10 * 60; });
await D(async () => { const K = await import('./js/core/karriar.js'); K.openIntervju(SF, 'burgare'); });
await answerAll(3);
ok(/Befordrad/.test(await title()) && (await D(() => SF.game.roller.burgare)) === 1, 'tre rätt: skiftledare!');
await clickBtn(/Tack/);
// ---------- 4. skiftledaren ----------
await D(() => SF.startJob('burgare'));
await until(() => !!document.querySelector('#modal [data-fokus]'));
ok(!(await D(() => !!document.querySelector('#modal [data-pris]'))), 'skiftledaren väljer fokus men inte priser');
await closeDlg();
const m0 = await D(() => SF.game.money);
const plan = await shiftTo({ ok: 10, fel: 2 }, { fokus: 'tempo' });
const base = await D(async () => { const G = await import('./js/game.js'); return G.shiftPlan(3).pace; });
ok(Math.abs(plan.pace - base * 0.9) < 1e-6, `tempo: fler kunder (pace ${plan.pace.toFixed(3)} = ${base.toFixed(3)} × 0,9)`);
ok(/Skiftledare\s*×1,2/.test(await text()) && /Tempo/.test(await text()), 'lönebeskedet: Skiftledare ×1,2 och Tempo +10 %');
const lon = (await D(() => SF.game.money)) - m0;
ok(lon > 0, `lön för passet: ${lon} kr`);
await clickBtn(/Ta lönen/);
// ---------- 5. biträdande chef och chef ----------
await D(() => { SF.game.jobs.burgare = 9; SF.game.day++; });
b = await D(() => SF.game.befordran('burgare'));
ok(!b.ok && b.saknas.some((s) => /Ledarskap/.test(s)), `biträdande chef: saknar examen i Ledarskap (${b.saknas.join(', ')})`);
await D(() => { SF.game.edu.ledarskap = { lect: 3, day: 1, tenta: 1, tentaDay: 1, klar: true }; });
await D(async () => { const K = await import('./js/core/karriar.js'); K.openIntervju(SF, 'burgare'); });
await until(() => /på Burgarbaren/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
ok(/skjorta eller blus/.test(await text()), 'i t-shirt: biträdande chef kräver skjorta eller blus');
await clickBtn(/Okej/);
await D(() => { SF.avatar.look.top = 'blouse'; });
await D(async () => { const K = await import('./js/core/karriar.js'); K.openIntervju(SF, 'burgare'); });
await answerAll(2);
ok((await D(() => SF.game.roller.burgare)) === 2, 'i blus, två rätt: biträdande chef');
await clickBtn(/Tack/);
await D(() => { SF.game.jobs.burgare = 12; SF.game.day++; });
b = await D(() => SF.game.befordran('burgare'));
ok(!b.ok && b.saknas.some((s) => /3 pass till som biträdande chef/.test(s)), 'chef: kräver 3 pass som biträdande chef');
await D(() => { SF.game.rollPass.burgare = 3; SF.avatar.look.top = 'suit'; });
await D(async () => { const K = await import('./js/core/karriar.js'); K.openIntervju(SF, 'burgare'); });
await answerAll(3);
ok((await D(() => SF.game.roller.burgare)) === 3, 'i kavaj: chef på Burgarbaren!');
await clickBtn(/Tack/);
await D(() => SF.startJob('burgare'));
await until(() => !!document.querySelector('#modal [data-pris]'));
ok((await D(() => document.querySelectorAll('#modal [data-pris]').length)) === 3, 'chefen sätter priserna (låga, vanliga, höga)');
await closeDlg();
const plan2 = await shiftTo({ ok: 10, fel: 0 }, { fokus: 'noggrann', pris: 'hog' });
const base5 = await D(async () => { const G = await import('./js/game.js'); return G.shiftPlan(5).pace; });
ok(Math.abs(plan2.pace - base5 * 1.2) < 1e-6, 'höga priser: färre kunder (pace × 1,2)');
ok(/Chef\s*×1,7/.test(await text()) && /Höga priser/.test(await text()), 'lönebeskedet: Chef ×1,7 och höga priser');
await clickBtn(/Ta lönen/);
// ---------- 6. chefslönen, dagboken, sparfilen, kursen ----------
const lonSon = await D(() => { const g = SF.game; g.day = 7; g.veckoPass = { burgare: 2 }; const m = g.money; const r = g.sleep(); return { r: r.chefslon, rent: r.rent, diff: g.money - m }; });
ok(lonSon.r.length === 1 && lonSon.r[0].kr === 400 && [400, 420].includes(lonSon.diff + lonSon.rent), `måndag: chefslön 400 kr (${JSON.stringify(lonSon.r)})`);
const lonMiss = await D(() => { const g = SF.game; g.day = 14; g.veckoPass = { burgare: 1 }; return g.sleep().chefslon; });
ok(lonMiss[0].kr === 0, 'bara ett pass i veckan: ingen chefslön');
await D(() => document.getElementById('hud-diary').click());
ok(await until(() => /👔 Chef/.test(document.querySelector('#modal')?.innerText || '')), 'dagboken: 👔 Chef på Burgarbaren');
await closeDlg();
await D(() => SF.game.save());
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await sleep(500);
ok((await D(() => SF.game.roller.burgare)) === 3, 'befattningen sparas');
const kurs = await D(async () => { const G = await import('./js/game.js'); return G.COURSES.ledarskap; });
ok(kurs && kurs.job === null && kurs.lectures === 3, 'Pixelhögskolan har kursen Ledarskap');
const r = await D(() => { SF.game.edu = {}; SF.game.money = 2000; return SF.game.enroll('ledarskap'); });
ok(r?.ok, 'man kan anmäla sig till Ledarskap');

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
