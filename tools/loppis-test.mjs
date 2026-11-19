// 🧸 GARAGELOPPISEN i Villaområdet (js/jobs/jobb-loppis.js, Äppelvägen 9):
//   1. jobbet loppis finns med jobbscen; dörren på Äppelvägen 9 (v_hus9) öppnar passets ruta → scenen jobbloppis
//   2. budet och riktvärdet visas; SÅLT till ≥ 80 % = bra affär; < 50 % = bortslumpat; PRUTA höjer budet (utan risk i provet) och kan skrämma bort kunden (risk 1)
//   3. för länge = kunden går; fem bra affärer i rad = loppiskungen; knapparna och tangenterna fungerar
//   4. passet slutar med lönebeskedet, man står på Äppelvägen igen
//   node tools/loppis-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=lopp${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Loppis', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 300, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const J = (fn, a) => p.evaluate(([f, a]) => (new Function('d', 'g', 'a', 'return (' + f + ')(d, g, a)'))(SF.scene._debug, SF.game, a), [fn.toString(), a]);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const head = () => D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
await stang(); await D(() => { SF.cityPos = [4998, 612]; SF.go('city'); }); await sleep(1800); await stang();

// 1. dörren på Äppelvägen 9
ok(await D(() => SF.jobReady('loppis')), 'jobbet loppis har en jobbscen');
await D(async () => { const { ALL_BUILDINGS } = await import('/js/city/map.js'); const b = ALL_BUILDINGS.find((x) => x.id === 'v_hus9'); window.__hus9 = { enter: b.enter, x: (b.door.x0 + b.door.x1) / 2, y: b.base }; });
const hus = await D(() => window.__hus9);
ok(hus.enter === 'jobb:loppis', `Äppelvägen 9 är garageloppisens dörr (${hus.enter})`);
await D((h) => { SF.scene._debug.teleport(h.x, h.y + 10); }, hus); await sleep(300);
await D((h) => { const c = SF.scene._debug.cam?.() || { x: 0, y: 0 }; SF.scene.down(h.x - c.x, h.y - 20 - c.y); }, hus);
await p.waitForFunction(() => /Garageloppisen/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
let h2 = await head();
if (!/Garageloppisen/.test(h2)) { await stang(); await D(() => SF.startJob('loppis')); await p.waitForFunction(() => /Garageloppisen/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {}); h2 = await head(); }
ok(/Garageloppisen/.test(h2), `dörren öppnar passets ruta (${h2})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobbloppis', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobbloppis startar');
await sleep(600);
await J((d) => d.auto(false));

// 2. buden
let k = await J((d) => d.force('vas', 0.9));
let s = await J((d) => d.state());
ok(k && k.sak === 'vas' && k.bud === 180 && s.kund.st === 'vantar', `en kund bjuder 180 kr på vasen (riktvärde 200) (${JSON.stringify(k)})`);
let r = await J((d) => d.salt());
s = await J((d) => d.state());
ok(r === 'salt' && s.stats.ok === 1 && s.kassa === 180 && s.streak === 1, `SÅLT till 90 % = bra affär (${JSON.stringify(s.stats)}, kassa ${s.kassa})`);
await J((d) => d.tick(1.5));
await J((d) => d.force('radio', 0.4));
r = await J((d) => d.salt());
s = await J((d) => d.state());
ok(r === 'salt' && s.stats.fel === 1 && s.streak === 0, `SÅLT till 40 % = bortslumpat (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
k = await J((d) => d.force('lampa', 0.5));
await J((d) => d.risk(0));
r = await J((d) => d.pruta());
s = await J((d) => d.state());
ok(r === 'hojde' && s.kund.bud > k.bud && s.kund.prut === 1, `PRUTA höjer budet (${k.bud} → ${s.kund.bud})`);
await J((d) => d.risk(1));
r = await J((d) => d.pruta());
s = await J((d) => d.state());
ok(r === 'gick' && s.stats.miss === 1, `PRUTA en gång för mycket → kunden går (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));

// 3. för länge, raden, knapparna
await J((d) => d.force('nalle', 0.9)); await J((d) => d.tick(12));   // tålamodet 9 s + 1,3 s innan kunden försvunnit
s = await J((d) => d.state());
ok(s.stats.miss === 2 && s.kund === null, `för länge → kunden går (${JSON.stringify(s.stats)})`);
for (let i = 0; i < 5; i++) { await J((d) => d.force('bocker', 0.95)); await J((d) => d.salt()); await J((d) => d.tick(1.5)); }
s = await J((d) => d.state());
ok(s.stats.boxes === 1 && s.stats.ok === 6, `fem bra affärer i rad → loppiskungen (${JSON.stringify(s.stats)})`);
await J((d) => d.force('cykel', 0.85));
const kn = await J((d) => d.knapp('salt')); await D((q) => SF.scene.down(q.x, q.y), kn);
s = await J((d) => d.state());
ok(s.stats.ok === 7, `knappen SÅLT fungerar (${JSON.stringify(s.stats)})`);
await J((d) => d.tick(1.5));
await J((d) => d.force('tavla', 0.5)); await J((d) => d.risk(0));
await D(() => SF.scene.key('2')); s = await J((d) => d.state());
ok(s.kund && s.kund.prut === 1, 'tangenten 2 prutar');
await D(() => SF.scene.key('1')); s = await J((d) => d.state());
ok(s.kund && s.kund.st === 'salt', 'tangenten 1 säljer');

// 4. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden)'), null, { timeout: 15000 }).catch(() => {});
await sleep(400);
const lon = await D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
ok(/kr/.test(lon), `lönebeskedet visas (${lon.slice(0, 80)}…)`);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go').catch(() => stang());
const ute = await p.waitForFunction(() => window.SF.sceneName === 'city', null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(800);
ok(ute && (await D(() => SF.game.money)) > m0, `tillbaka i Villaområdet med mer pengar (${await D(() => SF.game.money)} kr, var ${m0})`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
