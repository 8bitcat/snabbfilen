// 📚 BIBLIOTEKET i Gamla stan (js/scenes/bibliotek.js + js/gamlastan/bibliotek-inne.js):
//   1. bibliotekets dörr i Gamla stan leder in – Greta hälsar, platserna finns
//   2. välj en bok → figuren går och sätter sig vid ett bord och läser → utläst: +1 utbildningspoäng, en timme på klockan
//   3. hyllans ruta visar böckerna; en redan läst bok ger ingen ny poäng men räknas som dagens andra
//   4. tredje boken samma dag stoppas av Greta ("ögonen behöver vila"); ny dag → två böcker igen
//   5. golvuret visar spelets klocka, Dewey spinner när man klappar, tidningen, jordgloben snurrar
//   6. natten målas utan fel (fönstret mörkt, lamporna tända)
//   7. poängen överlever en omladdning (sparfilen) och räknas in i livsmålet Utbildning
//   8. dörren UT → Gamla stan, framför bibliotekets dörr
//   9. inga fel i sidan
//   node tools/bibliotek-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=bib${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Boken', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 500, hunger: 60, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
const D = (fn, a) => p.evaluate(fn, a);
const spana = () => D(() => { window.__toasts = []; const T = document.querySelector('#toasts'); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push(n.textContent)))).observe(T, { childList: true }); });
await spana();
await sleep(900);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const toasts = () => D(() => window.__toasts.splice(0));
const inne = () => p.waitForFunction(() => window.SF.sceneName === 'bibliotek' && !!window.SF.scene?._debug?.las, null, { timeout: 15000 }).then(() => true).catch(() => false);
const laser = () => p.waitForFunction(() => window.SF.scene?._debug?.las?.().laser, null, { timeout: 10000 }).then(() => true).catch(() => false);
await stang(); await D(() => { SF.gamlaFran = { buss: 'pixeltorget' }; SF.go('gamlastan'); }); await sleep(1500); await stang();

// 1. in genom dörren
ok(await D(() => SF.scene._debug.spots().includes('bibliotek')), 'bibliotekets dörr finns i Gamla stan');
await D(() => SF.scene._debug.act('bibliotek'));
ok(await inne(), 'dörren leder in i Biblioteket');
await sleep(1400);
const spots = await D(() => SF.scene._debug.spots());
ok(['dorr', 'disk', 'hylla0', 'hylla1', 'hylla2', 'hylla3', 'hylla4', 'bord0', 'bord1', 'bord2', 'bord3', 'klocka', 'fonster', 'katt', 'sagohylla', 'eld', 'glob', 'tidningar', 'vagn', 'barn', 'stege', 'katalog'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);
ok(/Välkommen till Biblioteket/.test(await D(() => SF.scene._debug.prat()) || ''), 'Greta hälsar välkommen');

// 2. en bok: gå till bordet, läs, +1 poäng och en timme
const utb0 = await D(() => SF.game.utbPoang()), min0 = await D(() => SF.game.min);
ok(await D(() => SF.scene._debug.valj('historia', 0)), 'man tar en bok från hyllan HISTORIA');
ok((await toasts()).some((t) => /Du tar «/.test(t)), 'boken bekräftas');
ok(await laser(), 'figuren går till ett bord och börjar läsa');
const l1 = await D(() => SF.scene._debug.las());
ok(l1.sitter !== null && l1.bok === 'hist1', `sitter vid bord ${l1.sitter} med boken`);
await D(() => SF.scene._debug.klar()); await sleep(700);
const t2 = await toasts();
ok(t2.some((t) => /utläst! \+1/.test(t)), 'utläst: +1 utbildningspoäng');
ok((await D(() => SF.game.utbPoang())) === utb0 + 1 && (await D(() => SF.game.las.poang)) === 1, 'poängen räknas i livsmålet Utbildning');
const min1 = await D(() => SF.game.min);
ok(min1 >= min0 + 60 && min1 < min0 + 75, `läsningen tog en timme på klockan (${Math.round(min1 - min0)} min inkl. speltid)`);
ok(/fiskestugor/.test(await D(() => SF.scene._debug.prat()) || ''), 'det man lärt sig visas som en tanke');

// 3. hyllans ruta, samma bok igen
await D(() => SF.scene._debug.act('hylla0')); await sleep(300);
const m1 = await modal();
ok(/HISTORIA/.test(m1) && /Stadsporten 1699/.test(m1) && /Läst – ger ingen ny poäng/.test(m1), 'hyllans ruta visar de tre böckerna och vilken som är läst');
await D(() => document.querySelector('#modal [data-bok="hist1"]')?.click()); await sleep(200);
ok(await laser(), 'man kan läsa om en bok');
await D(() => SF.scene._debug.klar()); await sleep(700);
ok((await toasts()).some((t) => /läst den förut/.test(t)) && (await D(() => SF.game.las.poang)) === 1, 'omläsning ger ingen ny poäng');
ok((await D(() => SF.game.lasKvar())) === 0, 'dagens två böcker är lästa');

// 4. tredje boken stoppas, ny dag
ok(!(await D(() => SF.scene._debug.valj('natur', 0))), 'tredje boken samma dag går inte');
ok(/ögonen behöver vila/.test(await D(() => SF.scene._debug.prat()) || ''), 'Greta säger att ögonen behöver vila');
await D(() => { SF.game.day += 1; });
ok((await D(() => SF.game.lasKvar())) === 2, 'ny dag: två böcker igen');
ok(await D(() => SF.scene._debug.valj('natur', 0)) && (await laser()), 'man tar en bok från NATUR');
await D(() => SF.scene._debug.klar()); await sleep(700);
ok((await D(() => SF.game.las.poang)) === 2 && (await D(() => SF.game.utbPoang())) === utb0 + 2, 'andra boken: 2 poäng');

// 5. uret, Dewey, tidningen, jordgloben
await D(() => SF.scene._debug.act('klocka')); await sleep(300);
const nu = await D(() => Math.floor(SF.game.min) % 1440);
const urT = (await toasts()).map((t) => /Golvuret visar (\d\d):(\d\d)/.exec(t)).find(Boolean);
const urMin = urT ? (+urT[1]) * 60 + (+urT[2]) : -999;
ok(Math.abs(urMin - nu) <= 2, `golvuret visar spelets klocka (${urT ? urT[1] + ':' + urT[2] : '–'} mot ${Math.floor(nu / 60)}:${String(nu % 60).padStart(2, '0')})`);
await D(() => SF.scene._debug.act('katt')); await sleep(300);
ok(await D(() => SF.scene._debug.dewey()), 'Dewey spinner när man klappar honom');
await D(() => SF.scene._debug.act('tidningar')); await sleep(300);
ok((await toasts()).some((t) => /PIXELBLADET/.test(t)), 'dagens tidning har en rubrik');
await D(() => SF.scene._debug.act('glob')); await sleep(300);
ok(await D(() => SF.scene._debug.snurr()), 'jordgloben snurrar');

// 6. natten
await D(() => { SF.game.min = 21 * 60 + 30; }); await sleep(600);
ok(errs.length === 0, 'natten målas utan fel');

// 7. sparfilen
await D(() => SF.game.save());
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await spana(); await sleep(800);
ok((await D(() => SF.game.las.poang)) === 2 && (await D(() => SF.game.las.lasta.length)) === 2 && (await D(() => SF.game.utbPoang())) === utb0 + 2, 'poängen och de lästa böckerna finns kvar efter omladdning');

// 8. ut genom dörren
await stang(); await D(() => { SF.gamlaFran = { buss: 'pixeltorget' }; SF.go('gamlastan'); }); await sleep(1200); await stang();
await D(() => SF.scene._debug.act('bibliotek'));
ok(await inne(), 'in igen');
await sleep(600);
await D(() => SF.scene._debug.act('dorr'));
const ute = await p.waitForFunction(() => window.SF.sceneName === 'gamlastan' && !!window.SF.scene?._debug?.duvor, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1200);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: -1, y: -1 };
ok(ute && Math.abs(pos.x - 157) < 12 && pos.y > 196 && pos.y < 220, `UT leder till Gamla stan framför bibliotekets dörr (${pos.x}, ${pos.y})`);

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
