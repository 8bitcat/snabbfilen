// Regressionstest för 🎁 PRESENTERNA (js/core/presenter.js, notiser.js setExtraNotiser, mobilens app, game.js presenter).
// Carl 2026-10-12: "presenter … notiser på morgonen som säger att man fått en present, så alla loggar in och tittar …
// större presenter … det kan också vara pengar i spelet". Klockan styrs med window.__presentNu.
//   • vid start kommer dagens present: hälsning, röd prick på mobilen, siffra på appen 🎁 Presenter
//   • uppackningen: tryck på paketet → gåvan visas och hamnar där den ska (plånboken, garderoben, förrådet, kylskåpet)
//   • samma dag igen: ingen ny present; före kl. 6 nästa morgon: ingen ny; efter kl. 6: en ny
//   • var sjunde present är STOR (tre saker); högst tre dagspresenter väntar
//   • appen: presentnotisen kl. 16 i dag och de tre närmaste dagarna (7101–7104), "STOR" när den stora kommer –
//     inte på lördagar (lördagsfestens notis) och inte i dag om dagens present redan är öppnad (Carl 2026-10-13)
// Kör: node tools/presenter-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const T0 = new Date(2026, 9, 12, 9, 0).getTime();   // 12 oktober kl. 9 (lokal tid)
const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((T0) => {
  window.__presentNu = T0;
  window.__toasts = [];
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true });
  // låtsas-appen: bara notismodulen (fångar det som schemaläggs)
  window.__notiser = [];
  window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: {
    checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
    getPending: async () => ({ notifications: window.__notiser.map((n) => ({ id: n.id })) }),
    cancel: async ({ notifications }) => { const bort = new Set(notifications.map((n) => n.id)); window.__notiser = window.__notiser.filter((n) => !bort.has(n.id)); },
    schedule: async ({ notifications }) => { window.__notiser.push(...notifications); },
  } } };
}, T0);
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=pr${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1'); localStorage.setItem('snabbfilen_notiser', 'pa');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-pr', name: 'Present', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 10 * 60, money: 500, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await sleep(800); await stang();
const PR = (fn, arg) => p.evaluate(async ([fn, arg]) => { const m = await import('/js/core/presenter.js'); return new Function('m', 'SF', 'arg', `return (${fn})(m, SF, arg);`)(m, window.SF, arg); }, [fn.toString(), arg]);
const state = () => p.evaluate(() => JSON.parse(JSON.stringify(window.SF.game.presenter)));

// ---- dagens present ----
await p.waitForFunction(() => window.SF.game.presenter.ko.length === 1, null, { timeout: 8000 }).catch(() => {});
let s = await state();
ok(s.ko.length === 1 && s.ko[0].typ === 'dag' && s.dag === '2026-10-12-m', `vid start (kl. 9) kommer morgonpresenten (${JSON.stringify(s)})`);
await sleep(2800);
ok(await p.evaluate(() => window.__toasts.some((t) => /Du har fått en present/.test(t))), 'hälsningen: "🎁 Du har fått en present! Öppna den i mobilen"');
await p.click('#hud-mobil'); await sleep(400);
ok(await p.evaluate(() => !document.querySelector('#hud-mobil .ny').classList.contains('hidden')), 'röd prick på mobilen');
ok(await p.evaluate(() => document.querySelector('#mobilen [data-badge="presenter"]')?.textContent === '1' && !!document.querySelector('#mobilen [data-app="presenter"] img')), 'appen 🎁 Presenter har pixelikonen och siffran 1');
await p.evaluate(() => document.querySelector('#mobilen [data-app="presenter"]').click()); await sleep(400);
ok(await p.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent === '🎁 Presenter' && document.querySelectorAll('#modal [data-oppna]').length === 1), 'appen visar presenten med Öppna!');

// ---- uppackningen ----
const fore = await p.evaluate(() => ({ money: SF.game.money, kladder: SF.game.wardrobe.length, forrad: SF.game.storage.length, kyl: JSON.stringify(SF.game.fridge), kort: Object.values(SF.game.kort || {}).reduce((a, b) => a + b, 0) }));
await p.evaluate(() => document.querySelector('#modal [data-oppna]').click()); await sleep(400);
ok(await p.evaluate(() => /Dagens present/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && !!document.querySelector('#modal .pr-cv')), 'uppackningen öppnas med paketet');
await p.evaluate(() => document.querySelector('#modal .pr-cv').click());
await p.waitForFunction(() => !document.querySelector('#modal .pr-gavor')?.classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
await p.waitForFunction(() => [...document.querySelectorAll('#modal .pr-gava .pr-bild')].every((b) => b.children.length), null, { timeout: 6000 }).catch(() => {});   // (bilderna ritas in strax efter korten)
const gava = await p.evaluate(() => ({ n: document.querySelectorAll('#modal .pr-gava').length, txt: document.querySelector('#modal .pr-gavor')?.innerText || '', bild: !!document.querySelector('#modal .pr-gava canvas, #modal .pr-gava .pr-emoji') }));
ok(gava.n === 1 && gava.bild, `gåvan visas med bild: ${gava.txt.replace(/\s+/g, ' ')}`);
const efter = await p.evaluate(() => ({ money: SF.game.money, kladder: SF.game.wardrobe.length, forrad: SF.game.storage.length, kyl: JSON.stringify(SF.game.fridge), kort: Object.values(SF.game.kort || {}).reduce((a, b) => a + b, 0) }));
const fick = efter.money > fore.money || efter.kladder > fore.kladder || efter.forrad > fore.forrad || efter.kyl !== fore.kyl || efter.kort > fore.kort;   // (🃏 ett pixelkort hamnar i albumet)
ok(fick, `gåvan hamnade där den ska (pengar ${fore.money}→${efter.money}, plagg ${fore.kladder}→${efter.kladder}, förråd ${fore.forrad}→${efter.forrad})`);
s = await state();
ok(s.ko.length === 0 && s.antal === 1, 'presenten är öppnad (antal 1, kön tom)');
await stang();

// ---- samma dag, före kl. 6, efter kl. 6 ----
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await sleep(3800); await stang();
ok((await state()).ko.length === 0, 'samma dag igen (omladdning): ingen ny present');
const koll = (t) => PR((m, SF, t) => { window.__presentNu = t; return m.presenterKoll(SF, { tyst: true }); }, t);
ok(!(await koll(T0 + 8 * 3600000)), 'samma dag kl. 17: ingen ny present än (kvällspresenten kommer kl. 18)');
ok(await koll(T0 + 9 * 3600000) && (await state()).dag === '2026-10-12-k', 'kl. 18: kvällspresenten kommer');
ok(!(await koll(T0 + 20 * 3600000)), 'nästa morgon kl. 5: ingen present än (natten hör till kvällen)');
ok(await koll(T0 + 22 * 3600000) && (await state()).dag === '2026-10-13-m', 'nästa morgon kl. 7: morgonpresenten');
// en sparfil från före 0.116.2 (bara datumet): dagens morgonpresent räknas som hämtad
await p.evaluate(() => { SF.game.presenter.dag = '2026-10-13'; });
ok(!(await koll(T0 + 23 * 3600000)) && (await state()).dag === '2026-10-13-m', 'gammal sparfil (bara datumet): morgonpresenten räknas som hämtad');

// ---- stor present var sjunde ----
await p.evaluate(() => { SF.game.presenter.ko = []; SF.game.presenter.antal = 6; SF.game.presenter.dag = ''; });
await PR((m, SF) => m.presenterKoll(SF, { tyst: true }));
s = await state();
ok(s.ko[0]?.typ === 'stor', 'den sjunde presenten är STOR');
await p.evaluate(async () => { const m = await import('/js/core/presenter.js'); m.oppna(SF, 0); });
await sleep(300);
await p.evaluate(() => document.querySelector('#modal .pr-cv').click());
await p.waitForFunction(() => !document.querySelector('#modal .pr-gavor')?.classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
const storG = await p.evaluate(() => document.querySelectorAll('#modal .pr-gava').length);
ok(storG >= 3, `den stora presenten har tre (eller fyra) saker (${storG})`);
await stang();

// ---- högst tre väntar ----
await p.evaluate(() => { SF.game.presenter.ko = [{ typ: 'dag' }, { typ: 'dag' }, { typ: 'dag' }]; SF.game.presenter.dag = '2000-01-01'; });
ok(!(await PR((m, SF) => m.presenterKoll(SF, { tyst: true }))) && (await state()).ko.length === 3, 'högst tre dagspresenter väntar');

// ---- notiserna kl. 7 och kl. 19 (Carl 2026-10-13) ----
const planera = (t) => p.evaluate(async (t) => { const n = await import('/js/core/notiser.js'); window.__notiser = []; await n.planera(new Date(t)); return window.__notiser.filter((x) => (x.id >= 7101 && x.id <= 7104) || (x.id >= 7121 && x.id <= 7124)).map((x) => ({ id: x.id, body: x.body, ts: +new Date(x.schedule.at), dag: new Date(x.schedule.at).getDay(), datum: new Date(x.schedule.at).getDate(), kl: new Date(x.schedule.at).getHours() + ':' + String(new Date(x.schedule.at).getMinutes()).padStart(2, '0') })).sort((x, y) => x.ts - y.ts); }, t);
await p.evaluate(() => { SF.game.presenter.ko = []; SF.game.presenter.antal = 4; SF.game.presenter.dag = '2000-01-01'; });   // (inga presenter hämtade)
const notiser = await planera(new Date(2026, 9, 13, 6, 0).getTime());   // tisdag kl. 6
ok(notiser.length === 8 && notiser.filter((n) => n.kl === '7:00').length === 4 && notiser.filter((n) => n.kl === '19:00').length === 4 && notiser[0].datum === 13, `kl. 7 och kl. 19 i dag och de tre närmaste dagarna (${notiser.map((n) => n.datum + '/10 ' + n.kl).join(', ')})`);
ok(notiser.some((n) => /^🎁 God morgon! En present väntar/.test(n.body)) && notiser.some((n) => /^🎁 Kvällspresenten är redo i Pixelstaden/.test(n.body)), `texterna: "God morgon! …" och "Kvällspresenten är redo …"`);
ok(notiser.filter((n) => /STOR/.test(n.body)).length >= 1 && /STOR/.test(notiser.find((n) => n.datum === 14 && n.kl === '7:00')?.body || ''), `STOR när den sjunde presenten kommer (14/10 kl. 7): ${notiser.filter((n) => /STOR/.test(n.body)).map((n) => n.datum + '/10 ' + n.kl).join(', ')}`);
const torsdag = await planera(new Date(2026, 9, 15, 9, 0).getTime());
ok(!torsdag.some((n) => n.dag === 6 && n.kl === '19:00') && torsdag.some((n) => n.dag === 6 && n.kl === '7:00'), `lördag: morgonnotisen men ingen kvällsnotis (då kommer festnotisen kl. 17.45): ${torsdag.map((n) => n.datum + '/10 ' + n.kl).join(', ')}`);
await p.evaluate(async () => { const m = await import('/js/core/presenter.js'); SF.game.presenter.dag = m.passNu(new Date(2026, 9, 13, 8, 0).getTime()); SF.game.presenter.ko = []; });
const oppnad = await planera(new Date(2026, 9, 13, 8, 0).getTime());
ok(oppnad[0]?.datum === 13 && oppnad[0].kl === '19:00', `morgonpresenten redan öppnad: nästa notis är kvällens kl. 19 (${oppnad.slice(0, 3).map((n) => n.datum + '/10 ' + n.kl).join(', ')})`);
const sent = await planera(new Date(2026, 9, 13, 20, 0).getTime());
ok(!sent.some((n) => n.datum === 13) && sent[0]?.kl === '7:00', 'kl. 20: inga notiser för i dag – nästa är i morgon kl. 7');

// ---- frågan om notiser efter en öppnad present + raden i appen (notiserna är av) ----
await p.evaluate(() => { localStorage.setItem('snabbfilen_notiser', 'av'); localStorage.removeItem('snabbfilen_notiser_fragad'); SF.game.presenter.ko = [{ typ: 'dag' }]; });
await p.evaluate(async () => { const m = await import('/js/core/presenter.js'); m.openPresenter(SF); });
await sleep(300);
ok(await p.evaluate(() => !!document.querySelector('#modal [data-notispa]')), 'appen 🎁 Presenter: "🔔 Notiserna är av … Slå på" när de är av');
await p.evaluate(async () => { const m = await import('/js/core/presenter.js'); m.oppna(SF, 0); });
await sleep(300);
await p.evaluate(() => document.querySelector('#modal .pr-cv').click());
await p.waitForFunction(() => !document.querySelector('#modal .pr-gavor')?.classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
await sleep(600);
await p.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go').click());
await sleep(500);
ok(/Vill du få notiser/.test(await p.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'efter en öppnad present: "🔔 Vill du få notiser?"');
await p.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Ja tack/.test(b.textContent)).click());
await sleep(600);
ok((await p.evaluate(() => localStorage.getItem('snabbfilen_notiser'))) === 'pa', 'Ja tack → notiserna är på');
await stang();

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
