// Regressionstest för STARTGUIDEN (js/core/startguide.js) – första dagen för en ny spelare:
//   • ny spelare (ingen sparfil): välkomstrutan → Till husvagnen → listan FÖRSTA DAGEN 0/7 syns
//   • ut i stan: steget bockas av och 🧭-pilen pekar på Burgarbaren
//   • in på Burgarbaren: Doris säger till, JOBBA HÄR → Servera pulserar → Jobba ett pass pulserar
//   • i serveringsjobbet: första serverade kunden bockar av steget, passet slut → lönen bockar av
//   • ät (mättnaden stiger) och sov (ny dag) → "Bra jobbat!" och listan försvinner
//   • en omladdning mitt i första dagen fortsätter där man var; × → Hoppa över stänger guiden
//   • inga fel i konsolen
// Kör: node tools/startguide-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
const sleep = (ms) => page.waitForTimeout(ms);
const D = (fn, a) => page.evaluate(fn, a);
async function waitFor(fn, ms = 10000, arg) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D(fn, arg)) return true; await sleep(100); } return false; }
const panel = () => D(() => { const e = document.querySelector('#startguide'); return e && !e.classList.contains('hidden') ? e.innerText.replace(/\s+/g, ' ') : null; });
const step = () => D(async () => (await import('/js/core/startguide.js')).guideStep());

// ---- ny spelare: figuren finns, men ingen sparfil (?guide: robotarna får guiden) ----
await page.goto(`http://localhost:${PORT}/index.html?nomenu&guide&world=sg${Date.now().toString(36)}`);
await D(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
ok(await waitFor(() => /Till husvagnen/.test(document.querySelector('#modal:not(.hidden)')?.innerText || '')), 'nya spelare får välkomstrutan');
await D(() => [...document.querySelectorAll('#modal button')].find((b) => /Till husvagnen/.test(b.textContent))?.click());
await sleep(1200);
await D(() => { const m = document.querySelector('#modal'); if (!m.classList.contains('hidden')) { m.classList.add('hidden'); m.innerHTML = ''; } });
let p = await panel();
ok(p && /FÖRSTA DAGEN 0\/7/.test(p) && /Gå ut ur husvagnen/.test(p), `listan syns i husvagnen (${p})`);
ok(await step() === 'ut', 'första steget: gå ut ur husvagnen');

// ---- ut i stan: pilen till Burgarbaren ----
await D(() => window.SF.go('city'));
ok(await waitFor(() => window.SF.guide?.id === 'burgare', 4000), '🧭-pilen pekar på Burgarbaren');
ok(await step() === 'dit', 'nästa steg: gå till Burgarbaren');
// pilen tas bort med × – och kommer tillbaka först nästa gång man går ut
await D(() => { window.SF.guide = null; });
await sleep(700);
ok(await D(() => !window.SF.guide), 'borttagen pil kommer inte tillbaka direkt');

// ---- omladdning mitt i första dagen: guiden fortsätter ----
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await sleep(1000);
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
ok(await step() === 'dit', 'efter omladdning: guiden fortsätter på samma steg');

// ---- in på Burgarbaren genom dörren ----
await D(() => window.SF.go('city'));
await sleep(1500);
ok(await waitFor(() => window.SF.guide?.id === 'burgare', 3000), 'pilen tillbaka när man går ut igen');
await D(() => { const d = window.SF.scene._debug; d.teleport(1146, 146); d.enter('burgare'); }); // (nära dörren – hela vägen från husvagnen tar en halv minut)
ok(await waitFor(() => window.SF.sceneName === 'burgarbar', 5000), 'in genom dörren till Burgarbaren');
ok(await waitFor(async () => (await import('/js/core/startguide.js')).guideStep() === 'jobb', 3000), 'nästa steg: fråga Doris om jobb');
await sleep(1500);
ok(await D(() => !!window.SF.scene._debug.sgSaid().jobb), 'Doris säger till om jobbet (pratbubbla)');
// pilen och lappen i bildkanten: Doris syns inte från dörren – lappen leder dit och öppnar jobbet
const sg = await D(() => window.SF.scene._debug.sg());
ok(sg.target === 'jobb', `pilen pekar mot Doris (mål: ${sg.target})`);
ok(!!sg.edge, `Doris utanför bild: lapp i bildkanten (${sg.edge ? Math.round(sg.edge.x) + ',' + Math.round(sg.edge.y) : '–'})`);
if (sg.edge) await D((e) => window.SF.scene.down(e.x, e.y), sg.edge);
else await D(() => window.SF.scene._debug.jobs());
ok(await waitFor(() => !!document.querySelector('#modal:not(.hidden) [data-jobb]'), 10000), 'lappen: figuren går till Doris och jobbrutan öppnas');
ok(await D(() => !!document.querySelector('#modal [data-jobb="burgare"].sg-pulse')), 'Servera-knappen pulserar');
await D(() => document.querySelector('#modal [data-jobb="burgare"]').click());
await sleep(400);
ok(await D(() => !!document.querySelector('#modal .btn.sg-pulse')), '"Jobba ett pass" pulserar');
await D(() => document.querySelector('#modal .btn.sg-pulse').click());
ok(await waitFor(() => window.SF.sceneName === 'jobbburgare', 5000), 'passet börjar (serveringsjobbet)');
ok(await waitFor(async () => (await import('/js/core/startguide.js')).guideStep() === 'servera', 3000), 'nästa steg: servera första kunden');
ok(await D(() => document.querySelector('#startguide').classList.contains('hidden')), 'listan göms under passet (handen visar vägen)');

// ---- första kunden ----
await D(() => { const d = window.SF.scene._debug; const w = d.forceCustomer(); d.forcePlate(w); });
await sleep(500);
await D(() => { const d = window.SF.scene._debug; const i = d.plates().findIndex(() => true); d.pickPlate(i); d.serve(true); });
ok(await waitFor(async () => (await import('/js/core/startguide.js')).guideStep() === 'lon', 3000), 'första kunden serverad → steget bockat');

// ---- passet tar slut (60 s) → lönen ----
ok(await waitFor(() => /Lön|lön|💵/.test(document.querySelector('#modal:not(.hidden)')?.innerText || ''), 75000), 'passet slut: lönebeskedet');
ok(await waitFor(async () => (await import('/js/core/startguide.js')).guideStep() === 'mat', 3000), 'lönen bockar av passet → nästa steg: ät något');
await D(() => { [...document.querySelectorAll('#modal button')].pop()?.click(); });
await sleep(800);
await D(() => { const m = document.querySelector('#modal'); if (!m.classList.contains('hidden')) { m.classList.add('hidden'); m.innerHTML = ''; } });

// ---- ät på Burgarbaren ----
await D(() => { if (window.SF.sceneName !== 'burgarbar') window.SF.go('burgarbar'); });
await sleep(1200);
ok(await waitFor(() => window.SF.scene._debug.sg?.().target === 'disk', 3000), 'efter passet pekar pilen mot kassan (BESTÄLL HÄR)');
await D(() => { const d = window.SF.scene._debug; d.forceBuy(0); d.eatFast(); });
ok(await waitFor(async () => (await import('/js/core/startguide.js')).guideStep() === 'sov', 4000), 'mättnaden steg → nästa steg: gå hem och sov');

// ---- sov → klart ----
await D(() => window.SF.go('city'));
ok(await waitFor(() => window.SF.guide?.id === 'husvagn', 4000), '🧭-pilen pekar hem till husvagnen');
await D(() => { window.SF.game.sleep(); window.SF.game.save(); });
ok(await waitFor(() => /Bra jobbat/.test(document.querySelector('#modal:not(.hidden)')?.innerText || ''), 4000), 'ny dag → "Bra jobbat!"');
ok(await step() === null && !(await panel()), 'guiden är klar och listan borta');

// ---- hoppa över: starta om och tryck × ----
await D(async () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; (await import('/js/core/startguide.js')).startGuide(window.SF, { force: true }); });
await sleep(600);
await D(() => document.querySelector('#startguide [data-sg="skip"]').click());
await sleep(200);
await D(() => [...document.querySelectorAll('#modal button')].find((b) => /Hoppa över/.test(b.textContent))?.click());
await sleep(400);
ok(await step() === null && !(await panel()), '× → Hoppa över stänger guiden');

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
