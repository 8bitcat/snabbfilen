// 🛟 BADVAKTEN – jobbet i Vattenlandets torn (js/jobs/jobb-badvakt.js):
//   1. jobbet badvakt finns med jobbscen; tornet i Vattenlandet frågar prata/jobba → passets ruta → scenen jobbbadvakt
//   2. någon får kramp → klick på den kastar livbojen → räddad (rätt); klick på en som simmar lugnt = falskt alarm (fel); för sent = Bosse hoppar i (missad)
//   3. en som springer på kanten → visslan (rätt); springer runt = missad
//   4. sex räddningar i rad = guldvisslan (bonus); klick på en simmare och mellanslag fungerar
//   5. passet slutar med lönebeskedet, man står vid tornet i Vattenlandet igen
//   node tools/badvakt-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=badv${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Bosse', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
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
await stang(); await D(() => { SF.vattenFran = { buss: 'pixeltorget', betalt: true }; SF.go('vattenlandet'); }); await sleep(1800); await stang();

// 1. tornet
ok(await D(() => SF.jobReady('badvakt')), 'jobbet badvakt har en jobbscen');
await D(() => SF.scene._debug.teleport(1123, 428)); await sleep(200);
await D(() => SF.scene._debug.act('badvakt')); await sleep(400);
ok(/Badvaktstornet/.test(await modal()) && /Jobba/.test(await modal()), `tornet frågar prata eller jobba (${(await modal()).slice(0, 50)}…)`);
await D(() => { const b = [...document.querySelectorAll('#modal:not(.hidden) button')].find((x) => /Jobba/.test(x.textContent)); b?.click(); });
await p.waitForFunction(() => /Badvakten/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
ok(/Badvakten/.test(await head()), `passets ruta (${await head()})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobbbadvakt', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobbbadvakt startar');
await sleep(600);
await J((d) => { d.auto(false); d.vagT(10); });

// 2. kramp, livbojen, falskt alarm, för sent
let i = await J((d) => d.nod(2));
let s = await J((d) => d.state());
ok(i === 2 && s.simmare[2].st === 'nod', `simmare 2 får kramp (${s.simmare[2].st})`);
let r = await J((d) => d.radda(2));
await J((d) => d.tick(0.7));
s = await J((d) => d.state());
ok(r === 'boj' && s.stats.ok === 1 && s.simmare[2].st === 'raddad' && s.streak === 1, `livbojen kastas → räddad (${JSON.stringify(s.stats)})`);
r = await J((d) => d.radda(3));
s = await J((d) => d.state());
ok(r === 'fel' && s.stats.fel === 1 && s.streak === 0, `klick på en lugn simmare = falskt alarm (${JSON.stringify(s.stats)})`);
await J((d) => d.nod(4)); await J((d) => d.tick(9));
s = await J((d) => d.state());
ok(s.stats.miss === 1 && s.simmare[4].st !== 'nod', `för sent → Bosse fick hoppa i (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(2));

// 3. löparen
ok(await J((d) => d.spring()), 'ett barn börjar springa längs kanten');
await J((d) => d.tick(0.5));
ok(await J((d) => d.vissla()), 'visslan stoppar löparen (rätt)');
s = await J((d) => d.state());
ok(s.stats.ok === 2 && s.lopare === null, `… räknas (${JSON.stringify(s.stats)})`);
await J((d) => d.spring()); await J((d) => d.tick(8));
s = await J((d) => d.state());
ok(s.stats.miss === 2 && s.lopare === null, `springer hela vägen → missad (${JSON.stringify(s.stats)})`);

// 4. guldvisslan, klick, mellanslag
for (let k = 0; k < 6; k++) { const j = await J((d) => d.nod(-1)); await J((d, g, a) => d.radda(a), j); await J((d) => d.tick(0.7)); await J((d) => d.tick(1.8)); }
s = await J((d) => d.state());
ok(s.stats.boxes === 1 && s.streak >= 6, `sex räddningar i rad → guldvisslan (${JSON.stringify(s.stats)}, rad ${s.streak})`);
const j2 = await J((d) => d.nod(-1)); await J((d) => d.tick(0.1));
const sp = await J((d, g, a) => d.simSpot(a), j2); await D((q) => SF.scene.down(q.x, q.y), sp); await J((d) => d.tick(0.7));
s = await J((d) => d.state());
ok(s.stats.ok === 9, `klick på den som viftar räddar (${JSON.stringify(s.stats)})`);
await J((d) => d.spring()); await J((d) => d.tick(0.3)); await D(() => SF.scene.key(' '));
s = await J((d) => d.state());
ok(s.stats.ok === 10 && s.lopare === null, `mellanslag visslar (${JSON.stringify(s.stats)})`);

// 5. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden)'), null, { timeout: 15000 }).catch(() => {});
await sleep(400);
const lon = await modal();
ok(/kr/.test(lon), `lönebeskedet visas (${lon.slice(0, 80)}…)`);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go').catch(() => stang());
const ute = await p.waitForFunction(() => window.SF.sceneName === 'vattenlandet' && !!window.SF.scene?._debug?.pos, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(800);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: 0, y: 0 };
ok(ute && Math.abs(pos.x - 1123) < 40 && (await D(() => SF.scene._debug.betalt())) && (await D(() => SF.game.money)) > m0, `tillbaka vid tornet i Vattenlandet med mer pengar (${Math.round(pos.x)}, ${Math.round(pos.y)}; ${await D(() => SF.game.money)} kr)`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
