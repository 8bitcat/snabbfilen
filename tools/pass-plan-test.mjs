// PASSET EFTER VANAN (Carl 2026-09-30): passets plan (js/game.js shiftPlan) styr alla jobb –
// längden (P.seconds), kundtempot (P.pace) och extraplatserna (P.extra). En van väljer vanligt
// eller längre pass (1,5 × tiden, 6 timmar speltid).
//   node tools/pass-plan-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(m.text()));
const SAVE = (jobs = {}, min = 12 * 60) => ({ v: 1, day: 2, min, money: 100, hunger: 90, energy: 95, home: 'rum', fridge: {}, jobs, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, edu: { datorteknik: { klar: true }, ekonomi: { klar: true } } });
async function boot(save) {
  await page.goto(`http://localhost:${PORT}/index.html?world=plan${Date.now().toString(36)}`);
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Passaren', look: {}, color: '#e04848' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
  }, save);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
  await wait(300);
}
const modalText = () => page.evaluate(() => (document.getElementById('modal').classList.contains('hidden') ? '' : document.getElementById('modal').textContent));
const buttons = () => page.evaluate(() => [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].map((b) => b.textContent.trim()));

// 1. planen: nivå → längd, tempo, extraplatser
console.log('\n1. shiftPlan');
await boot(SAVE());
const plans = await page.evaluate(async () => { const m = await import('/js/game.js'); return [1, 2, 3, 4, 5].map((l) => m.shiftPlan(l)).concat([m.shiftPlan(2, 'langt'), m.shiftPlan(5, 'langt')]); });
ok(plans[0].seconds === 60 && plans[0].pace === 1 && plans[0].extra === 0 && plans[0].gameMin === 240, 'nybörjaren: 60 s, samma tempo som förut, inga extraplatser, 4 timmar');
ok(plans.slice(0, 5).every((p, i) => i === 0 || (p.seconds > plans[i - 1].seconds && p.pace < plans[i - 1].pace && p.extra === i)),
  `varje nivå: lite längre pass, fler kunder, en plats till (${plans.slice(0, 5).map((p) => `${p.seconds}s/${p.pace.toFixed(2)}`).join(' · ')})`);
ok(plans[5].len === 'langt' && Math.abs(plans[5].seconds - plans[1].seconds * 1.5) <= 1 && plans[5].gameMin === 360 && plans[5].energy > plans[1].energy,
  `längre pass: 1,5 × tiden (${plans[5].seconds} s), 6 timmar, mer ork (${plans[5].energy})`);

// 2. startdialogen: nybörjare ett pass; van vanligt/längre; längre bara t.o.m. 18:00
console.log('\n2. startdialogen');
const flow = async (job, scene) => { await page.evaluate(([j, s]) => import('/js/jobs/shift.js').then((m) => m.startJobFlow(window.SF, j, s)), [job, scene]); await wait(300); };
await flow('pizzeria', 'jobbpizzeria');
let b = await buttons();
ok(b.some((x) => /Jobba ett pass/.test(x)) && !b.some((x) => /Längre pass/.test(x)), `nybörjaren: bara "Jobba ett pass" (${b.join(' | ')})`);
ok(/fler kunder/.test(await modalText()), 'dialogen berättar att fler pass ger fler kunder och platser');
await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn')?.click());
await boot(SAVE({ pizzeria: 3 }));
await flow('pizzeria', 'jobbpizzeria');
b = await buttons();
ok(b.some((x) => /Vanligt pass/.test(x)) && b.some((x) => /Längre pass/.test(x)), `van: vanligt eller längre pass (${b.join(' | ')})`);
await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn')?.click());
await boot(SAVE({ pizzeria: 3 }, 19 * 60));
await flow('pizzeria', 'jobbpizzeria');
b = await buttons();
ok(b.some((x) => /Vanligt pass/.test(x)) && !b.some((x) => /Längre pass/.test(x)) && /senast 18:00/.test(await modalText()), 'kl 19: längre pass går inte (börjar senast 18:00)');
await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn')?.click());

// 3. ett längre pass hela vägen: 6 timmar speltid, lönen, mer ork
console.log('\n3. längre pass');
await boot(SAVE({ pizzeria: 3 }, 9 * 60));
await flow('pizzeria', 'jobbpizzeria');
await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((x) => /Längre pass/.test(x.textContent))?.click());
await page.waitForFunction(() => window.SF.sceneName === 'jobbpizzeria', null, { timeout: 10000 });
const p3 = await page.evaluate(() => ({ ...window.SF.shiftPlan }));
ok(p3.len === 'langt' && p3.lvl === 2 && p3.seconds === 97, `passet är långt på nivå Van (${p3.seconds} s)`);
// kort ner passet (samma plan, 3 s) och låt det ta slut
const before = await page.evaluate(() => ({ min: window.SF.game.min, energy: window.SF.game.energy, day: window.SF.game.day }));
await page.evaluate(() => { window.SF.shiftPlan.seconds = 3; });
await page.evaluate(() => { window.SF.game.min = 9 * 60; });
await page.waitForFunction(() => /Passet är slut/.test(document.querySelector('#modal:not(.hidden)')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
const slip = await modalText();
const after = await page.evaluate(() => ({ min: window.SF.game.min, energy: window.SF.game.energy }));
ok(/Längre pass/.test(slip) && /6 timmar/.test(slip), 'lönebeskedet visar det längre passet (6 timmar)');
ok(after.min >= 15 * 60 && after.min < 15 * 60 + 20, `klockan gick 6 timmar (09:00 → ${Math.floor(after.min / 60)}:${String(after.min % 60).padStart(2, '0')})`);
ok(before.energy - after.energy >= 50, `mer ork gick åt (${before.energy} → ${after.energy})`);
await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go')?.click());
await wait(400);
ok(await page.evaluate(() => !window.SF.shiftPlan && !window.SF.coop && !window.SF.shiftJob), 'efter passet är planen och passet nollställda');

// 4. alla jobb slutar efter planens tid (planen ställs in, passet kortas till 4 s)
console.log('\n4. alla jobb följer planen');
const ALL = [['flygplats', 'jobbflyg'], ['incheckning', 'jobbincheck'], ['frukt', 'jobbfrukt'], ['burgare', 'jobbburgare'], ['pizzeria', 'jobbpizzeria'], ['posten', 'jobbposten'],
  ['bensinmack', 'jobbbensin'], ['bilverkstad', 'jobbverkstad'], ['tvatteri', 'jobbtvatt'], ['kafe', 'jobbkafe'], ['vard', 'jobbvard'], ['kok', 'jobbkok'], ['datorbygge', 'jobbdatorbygge'], ['finans', 'jobbfinans']];
await boot(SAVE({}, 10 * 60));
for (const [job, scene] of ALL) {
  await page.evaluate(async ([j, s]) => {
    const g = await import('/js/game.js');
    window.__done = null;
    window.SF.shiftJob = j;
    window.SF.shiftPlan = { ...g.shiftPlan(5), seconds: 4 };
    window.__t0 = performance.now();
    window.SF.go(s, { onDone: (st) => { window.__done = { st, t: (performance.now() - window.__t0) / 1000 }; } });
  }, [job, scene]);
  const d = await page.waitForFunction(() => window.__done, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  ok(!!d && d.t >= 3.5 && d.t < 9, `${job}: passet slutade efter planens ${4} s (${d ? d.t.toFixed(1) + ' s' : 'aldrig'})`);
  await page.evaluate(() => { window.SF.shiftPlan = null; window.SF.shiftJob = null; window.SF.go('city'); });
  await wait(300);
}

// 5. fler platser: pizzerian får ett bord till, Burgarbaren ett per nivå
console.log('\n5. fler platser');
const seats = async (scene, lvl) => {
  await page.evaluate(async ([s, l]) => { const g = await import('/js/game.js'); window.SF.shiftPlan = g.shiftPlan(l); window.SF.go(s, { onDone: () => {} }); }, [scene, lvl]);
  await wait(500);
  return page.evaluate(() => { const d = window.SF.scene._debug; return d.lag ? d.lag().bord : d.tables ? d.tables().length : null; });
};
const b1 = await seats('jobbburgare', 1), b5 = await seats('jobbburgare', 5);
ok(b1 === 4 && b5 === 8, `Burgarbaren: 4 bord som nybörjare, 8 som Legendar (${b1}/${b5})`);
await page.evaluate(() => { window.SF.shiftPlan = null; window.SF.go('city'); });

ok(errors.length === 0, errors.length ? 'konsolfel: ' + errors.join(' | ') : 'inga konsolfel');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
