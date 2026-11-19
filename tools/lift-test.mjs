// 🚡 LIFTVÄRDEN – jobbet i Skidbackens dalstation (js/jobs/jobb-lift.js, Skidbacken steg 2):
//   1. jobbet liftvard finns med jobbscen; liften i Skidbacken frågar åka/jobba → passets ruta → scenen jobblift
//   2. giltigt kort → SLÄPP IN = rätt; gammalt kort → STOPP = rätt; lånat kort → SLÄPP IN = fel; för långsamt = smet förbi (missad)
//   3. barnet som behöver hjälp upp: klick i det gröna = rätt, för tidigt = fel
//   4. åtta rätt i rad = guldvanten; knapparna och tangenterna fungerar
//   5. passet slutar med lönebeskedet, man står vid liften i Skidbacken igen
//   node tools/lift-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=lift${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Lift', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 300, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const J = (fn, a) => p.evaluate(([f, a]) => (new Function('d', 'g', 'a', 'return (' + f + ')(d, g, a)'))(SF.scene._debug, SF.game, a), [fn.toString(), a]);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const head = () => D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
await stang(); await D(() => { SF.skidFran = { buss: 'pixeltorget' }; SF.go('skidbacken'); }); await sleep(1800); await stang();

// 1. liften frågar
ok(await D(() => SF.jobReady('liftvard')), 'jobbet liftvard har en jobbscen');
await D(() => SF.scene._debug.teleport(1480, 470)); await sleep(200);
await D(() => SF.scene._debug.act('lift')); await sleep(400);
ok(/Liften/.test(await modal()) && /Jobba/.test(await modal()), `liften frågar åka eller jobba (${(await modal()).slice(0, 50)}…)`);
await D(() => { const b = [...document.querySelectorAll('#modal:not(.hidden) button')].find((x) => /Jobba/.test(x.textContent)); b?.click(); });
await p.waitForFunction(() => /Liftvärden/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
ok(/Liftvärden/.test(await head()), `passets ruta (${await head()})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobblift', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobblift startar');
await sleep(600);
await J((d) => d.auto(false));

// 2. korten
let g = await J((d) => d.force('ok', false));
let s = await J((d) => d.state());
ok(g && g.problem === 'ok' && s.gast.start <= s.dag && s.gast.slut >= s.dag, `en gäst med giltigt kort (dag ${s.gast.start}–${s.gast.slut}, i dag ${s.dag})`);
let r = await J((d) => d.beslut(true));
s = await J((d) => d.state());
ok(r === 'ratt' && s.stats.ok === 1 && s.streak === 1, `SLÄPP IN på giltigt kort = rätt (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
g = await J((d) => d.force('gammal', false));
s = await J((d) => d.state());
ok(s.gast.slut < s.dag, `gammalt kort gäller till dag ${s.gast.slut} (i dag ${s.dag})`);
r = await J((d) => d.beslut(false));
s = await J((d) => d.state());
ok(r === 'ratt' && s.stats.ok === 2, `STOPP på gammalt kort = rätt (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
await J((d) => d.force('lanat', false));
r = await J((d) => d.beslut(true));
s = await J((d) => d.state());
ok(r === 'fel' && s.stats.fel === 1 && s.streak === 0, `SLÄPP IN på lånat kort = fel (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
await J((d) => d.force('framtid', false)); await J((d) => d.tick(11));
s = await J((d) => d.state());
ok(s.stats.miss === 1 && s.gast === null, `för långsamt → gästen smet förbi (${JSON.stringify(s.stats)})`);

// 3. barnet och stolen
await J((d) => d.force('ok', true)); await J((d) => d.startHjalp()); await J((d) => d.fonster(0.5));
r = await J((d) => d.hjalp());
s = await J((d) => d.state());
ok(r === 'ratt' && s.stats.ok === 3, `hjälp upp i det gröna = rätt (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
await J((d) => d.force('ok', true)); await J((d) => d.startHjalp()); await J((d) => d.fonster(0.1));
r = await J((d) => d.hjalp());
s = await J((d) => d.state());
ok(r === 'fel' && s.stats.fel === 2, `för tidigt = plums (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));

// 4. guldvanten, knappar, tangenter
for (let k = 0; k < 8; k++) { await J((d) => d.force('gammal', false)); await J((d) => d.beslut(false)); await J((d) => d.tick(1.5)); }
s = await J((d) => d.state());
ok(s.stats.boxes === 1 && s.streak >= 8, `åtta rätt i rad → guldvanten (${JSON.stringify(s.stats)}, rad ${s.streak})`);
await J((d) => d.force('ok', false));
const kn = await J((d) => d.knapp('in')); await D((q) => SF.scene.down(q.x, q.y), kn);
s = await J((d) => d.state());
ok(s.stats.ok === 12, `knappen SLÄPP IN fungerar (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
await J((d) => d.force('gammal', false)); await D(() => SF.scene.key('2'));
s = await J((d) => d.state());
ok(s.stats.ok === 13, `tangenten 2 = STOPP (${JSON.stringify(s.stats)})`);

// 5. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden)'), null, { timeout: 15000 }).catch(() => {});
await sleep(400);
const lon = await modal();
ok(/kr/.test(lon), `lönebeskedet visas (${lon.slice(0, 80)}…)`);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go').catch(() => stang());
const ute = await p.waitForFunction(() => window.SF.sceneName === 'skidbacken' && !!window.SF.scene?._debug?.pos, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(800);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: 0, y: 0 };
ok(ute && Math.abs(pos.x - 1480) < 40 && (await D(() => SF.game.money)) > m0, `tillbaka vid liften i Skidbacken med mer pengar (${Math.round(pos.x)}, ${Math.round(pos.y)}; ${await D(() => SF.game.money)} kr)`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
