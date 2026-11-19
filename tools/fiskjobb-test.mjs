// 🐟 FISKMARKNADEN – fiskhandlarjobbet (js/jobs/jobb-fisk.js, Hamnen steg 3):
//   1. jobbet fiskhandel finns med jobbscen; marknadshallens dörr i Fiskehamnen frågar handla/jobba → passets ruta → scenen jobbfisk
//   2. fel fisk = fel; rätt fisk → vågen; PÅ GRAMMET = ok och raden växer; lite utanför = ok utan rad; långt utanför = fel
//   3. för sent = kunden går till fiskbilen (missad)
//   4. sex på grammet i rad = Brittas guldvåg (bonus)
//   5. klick och tangenter: låda, kund, vågen, mellanslag
//   6. passet slutar med lönebeskedet, man står vid marknadshallen igen
//   node tools/fiskjobb-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fiskj${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Britta', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
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
await stang(); await D(() => { SF.hamnFran = { buss: 'pixeltorget' }; SF.go('hamnen'); }); await sleep(1800); await stang();

// 1. dörren
ok(await D(() => SF.jobReady('fiskhandel')), 'jobbet fiskhandel har en jobbscen');
await D(() => SF.scene._debug.act('marknad')); await sleep(400);
ok(/Marknadshallen/.test(await modal()) && /Jobba/.test(await modal()), `marknadshallens dörr frågar handla eller jobba (${(await modal()).slice(0, 50)}…)`);
await D(() => { const b = [...document.querySelectorAll('#modal:not(.hidden) button')].find((x) => /Jobba/.test(x.textContent)); b?.click(); });
await p.waitForFunction(() => /Fiskmarknaden/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
ok(/Fiskmarknaden/.test(await head()), `passets ruta (${await head()})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobbfisk', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobbfisk startar');
await sleep(600);
await J((d) => d.auto(false));

// 2. fel fisk, rätt fisk, vågen
let i = await J((d) => d.force('torsk', 2));
ok(i >= 0 && (await J((d) => d.state())).kunder[i]?.fisk === 'torsk', `en kund vill ha 2 hg torsk (plats ${i})`);
await J((d) => d.valj('lax')); await J((d, g, a) => d.servera(a), i);
let s = await J((d) => d.state());
ok(s.stats.fel === 1 && s.kunder[i]?.st === 'arg' && s.vag === null, `fel fisk → fel 1, kunden sur (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));
i = await J((d) => d.force('torsk', 3));
await J((d) => d.valj('torsk')); const v = await J((d, g, a) => d.servera(a), i);
ok(v && v.i === i && v.mal > 0.5, `rätt fisk → vågen (mål ${v?.mal?.toFixed(2)})`);
let r = await J((d) => d.stoppa(true));
s = await J((d) => d.state());
ok(r === 'gron' && s.stats.ok === 1 && s.streak === 1, `visaren i det gröna → PÅ GRAMMET (${JSON.stringify(s.stats)}, rad ${s.streak})`);
await J((d) => d.tick(3));
i = await J((d) => d.force('rakor', 1)); await J((d) => d.valj('rakor')); await J((d, g, a) => d.servera(a), i);
r = await J((d) => d.stoppa('nara'));
s = await J((d) => d.state());
ok(r === 'ok' && s.stats.ok === 2 && s.streak === 0, `lite utanför → ok men raden bryts (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));
i = await J((d) => d.force('sill', 4)); await J((d) => d.valj('sill')); await J((d, g, a) => d.servera(a), i);
r = await J((d) => d.stoppa(false));
s = await J((d) => d.state());
ok(r === 'fel' && s.stats.fel === 2, `långt utanför → fel (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));

// 3. för sent
i = await J((d) => d.force('krabba', 1));
await J((d) => d.tick(10));
s = await J((d) => d.state());
ok(s.stats.miss === 1 && s.kunder[i] === null, `för sent → kunden gick till fiskbilen (${JSON.stringify(s.stats)})`);

// 4. guldvågen
for (let k = 0; k < 6; k++) { const j = await J((d) => d.force('lax', 2)); await J((d) => d.valj('lax')); await J((d, g, a) => d.servera(a), j); await J((d) => d.stoppa(true)); await J((d) => d.tick(2.6)); }
s = await J((d) => d.state());
ok(s.stats.boxes === 1 && s.stats.ok === 8, `sex på grammet i rad → Brittas guldvåg (${JSON.stringify(s.stats)})`);

// 5. klick och tangenter
i = await J((d) => d.force('makrill', 2));
const ls = await J((d) => d.ladaSpot(4)); await D((q) => SF.scene.down(q.x, q.y), ls);
ok((await J((d) => d.state())).hall === 'makrill', 'klick på lådan väljer makrill');
const ks = await J((d, g, a) => d.kundSpot(a), i); await D((q) => SF.scene.down(q.x, q.y), ks);
ok(!!(await J((d) => d.state())).vag, 'klick på kunden sätter fisken på vågen');
await D(() => SF.scene.key(' '));
s = await J((d) => d.state());
ok(s.vag === null && s.stats.ok + s.stats.fel === 11, `mellanslag stoppar visaren (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(3));
await D(() => SF.scene.key('1'));
ok((await J((d) => d.state())).hall === 'torsk', 'tangenten 1 = torsk');

// 6. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden)'), null, { timeout: 15000 }).catch(() => {});
await sleep(400);
const lon = await modal();
ok(/kr/.test(lon), `lönebeskedet visas (${lon.slice(0, 80)}…)`);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go').catch(() => stang());
const ute = await p.waitForFunction(() => window.SF.sceneName === 'hamnen' && !!window.SF.scene?._debug?.pos, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(800);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: 0, y: 0 };
ok(ute && pos.x > 400 && pos.x < 760 && (await D(() => SF.game.money)) > m0, `tillbaka i hamnen vid marknadshallen med mer pengar (${Math.round(pos.x)}, ${Math.round(pos.y)}; ${await D(() => SF.game.money)} kr)`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
