// 🦁 FODERKÖKET – djurskötarjobbet (js/jobs/jobb-djur.js, JOBS.djurskotare):
//   1. personalhuset i Djurparken startar jobbet (passets ruta "Djurparken") → scenen jobbdjur
//   2. djuren kommer till luckorna: rätt mat = +1 ok (MUMS), fel mat = fel (NEJ!), för sent = missad (hungrig)
//   3. åtta rätt i rad = MATRUNDA UTAN MISS (boxes)
//   4. lådorna och luckorna går att klicka på, 1–6 väljer mat
//   5. passet slutar → lönebeskedet → Ta lönen → tillbaka till Djurparken vid personalhuset, lönen inne
//   6. inga fel i sidan
//   node tools/djurjobb-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=zjob${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Skötare', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 300, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const J = (fn, a) => p.evaluate(([f, a]) => (new Function('d', 'g', 'a', 'return (' + f + ')(d, g, a)'))(SF.scene._debug, SF.game, a), [fn.toString(), a]);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const head = () => D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
await stang(); await D(() => { SF.djurparkFran = { buss: 'pixeltorget', betalt: true, inne: true }; SF.go('djurparken'); }); await sleep(1800); await stang();

// 1. personalhuset startar jobbet
ok(await D(() => SF.jobReady('djurskotare')), 'jobbet djurskotare har en jobbscen');
await D(() => SF.scene._debug.teleport(1964, 234)); await sleep(300);
await D(() => SF.scene._debug.act('personal'));
await p.waitForFunction(() => /Djurparken/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
ok(/Djurparken/.test(await head()), `personalhuset öppnar passets ruta (${await head()})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobbdjur', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobbdjur startar');
await sleep(600);
await J((d) => d.auto(false));   // (provet styr själv vilka djur som kommer)

// 2. maten
const i0 = await J((d) => d.force('lejon'));
ok(i0 >= 0, `lejonet kommer till en lucka (${i0})`);
ok((await J((d) => d.valj('kott'))) === 'kott', 'man väljer KÖTT');
let s = await J((d, g, a) => d.servera(a), i0);
ok(s.ok === 1 && s.fel === 0, `rätt mat → ok 1 (${JSON.stringify(s)})`);
const i1 = await J((d) => d.force('apa'));
await J((d) => d.valj('fisk'));
s = await J((d, g, a) => d.servera(a), i1);
ok(s.fel === 1 && s.ok === 1, `fel mat → fel 1 (${JSON.stringify(s)})`);
await J((d) => d.valj('fisk'));   // (lägger ifrån sig hinken)
const i2 = await J((d) => d.force('pingvin'));
await J((d) => d.tick(8));
s = await J((d) => d.stats);
ok(s.miss === 1, `för sent → hungrigt djur 1 (${JSON.stringify(s)})`);
ok(i2 >= 0 && (await J((d) => d.state())).luckor.filter(Boolean).length <= 2, 'djuren som ätit eller gått lämnar luckan');

// 3. matrundan
const RATT = { lejon: 'kott', elefant: 'ho', giraff: 'lov', apa: 'banan', pingvin: 'fisk', bjorn: 'bar' };
const arter = Object.keys(RATT);
await J((d) => d.tick(3));   // (de som ätit eller gått hinner lämna luckorna)
for (let k = 0; k < 8; k++) {
  const art = arter[k % 6];
  let i = await J((d, g, a) => d.force(a), art);
  if (i < 0) { await J((d) => d.tick(3)); i = await J((d, g, a) => d.force(a), art); }
  await J((d, g, a) => d.valj(a), RATT[art]);
  s = await J((d, g, a) => d.servera(a), i);
  await J((d) => d.tick(2));
  if (s.ok !== 2 + k) break;
}
ok(s.boxes === 1 && s.ok === 9, `åtta rätt i rad → en matrunda utan miss (${JSON.stringify(s)})`);

// 4. klick och tangenter
const ls = await J((d) => d.ladaSpot(3));
await D((q) => SF.scene.down(q.x, q.y), ls); await sleep(100);
ok((await J((d) => d.state())).hall === 'banan', 'klick på lådan BANANER väljer bananerna');
await D(() => SF.scene.key('5')); await sleep(100);
ok((await J((d) => d.state())).hall === 'fisk', 'tangenten 5 = FISK');
await J((d) => d.tick(4));
const i3 = await J((d) => d.force('pingvin'));
const lsp = await J((d, g, a) => d.luckSpot(a), i3);
await D((q) => SF.scene.down(q.x, q.y), lsp); await sleep(100);
s = await J((d) => d.stats);
ok(s.ok === 10, `klick på luckan serverar (${JSON.stringify(s)})`);

// 5. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => /Passet är slut/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
ok(/Passet är slut/.test(await head()), 'lönebeskedet kommer');
const body = await D(() => document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || '');
ok(/Matrundor/.test(body), 'bonusen för matrundan syns i beskedet');
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const ute = await p.waitForFunction(() => window.SF.sceneName === 'djurparken', null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1200);
const pos = await D(() => SF.scene._debug.pos());
ok(ute && Math.abs(pos.x - 1964) < 30 && pos.y < 260 && (await D(() => SF.scene._debug.betalt())), `tillbaka i Djurparken vid personalhuset (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
const m1 = await D(() => SF.game.money);
ok(m1 > m0 && (await D(() => SF.game.jobs.djurskotare)) === 1, `lönen kom in (${m0} → ${m1} kr) och passet räknas`);

ok(!errs.length, `inga fel i sidan${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
