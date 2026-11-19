// 🎭 TEATERN – skådespelarjobbet (js/jobs/jobb-teater.js, JOBS.teater, v5):
//   1. teaterdörren i Gamla stan startar jobbet (passets ruta "Teatern") → scenen jobbteater
//   2. regissören ropar poser: rätt knapp = +1 ok och applåder, fel knapp = fel + tomat, för sent = missad
//   3. tio rätt i rad = STÅENDE OVATIONER (boxes)
//   4. knapparna går att klicka på (spot) och 1–4 på tangentbordet fungerar
//   5. passet slutar → lönebeskedet → Ta lönen → tillbaka till Gamla stan vid teaterdörren, lönen inne
//   6. inga fel i sidan
//   node tools/teater-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=teat${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Skådis', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 300, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const J = (fn, a) => p.evaluate(([f, a]) => (new Function('d', 'g', 'a', 'return (' + f + ')(d, g, a)'))(SF.scene._debug, SF.game, a), [fn.toString(), a]);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const head = () => D(() => document.querySelector('#modal:not(.hidden) h2')?.textContent || '');
await stang(); await D(() => { SF.gamlaFran = { buss: 'pixeltorget' }; SF.go('gamlastan'); }); await sleep(1800); await stang();

// 1. dörren startar jobbet
ok(await D(() => SF.jobReady('teater')), 'jobbet teater har en jobbscen');
await D(() => SF.scene._debug.act('teater'));
await p.waitForFunction(() => /Teatern/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
ok(/Teatern/.test(await head()), `teaterdörren öppnar passets ruta (${await head()})`);
const m0 = await D(() => SF.game.money);
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const inne = await p.waitForFunction(() => window.SF.sceneName === 'jobbteater', null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(inne, 'scenen jobbteater startar');
await sleep(600);

// 2. poserna
const c0 = await J((d) => d.force('jubla'));
ok(c0 === 'jubla', 'regissören ropar en pose (jubla)');
let s = await J((d) => d.press('jubla'));
ok(s.ok === 1 && s.fel === 0, `rätt pose → ok 1 (${JSON.stringify(s)})`);
await J((d) => d.force('buga'));
s = await J((d) => d.press('snurra'));
ok(s.fel === 1 && s.ok === 1, `fel pose → fel 1 (${JSON.stringify(s)})`);
await J((d) => d.force('vinka'));
await J((d) => d.tick(6));
s = await J((d) => d.stats);
ok(s.miss === 1, `för sent → missad 1 (${JSON.stringify(s)})`);

// 3. ovationer
for (let i = 0; i < 10; i++) { const c = await J((d) => d.force('snurra')); await J((d, g, a) => d.press(a), c); }
s = await J((d) => d.stats);
ok(s.boxes === 1 && s.ok === 11, `tio rätt i rad → en stående ovation (${JSON.stringify(s)})`);

// 4. klick och tangenter
await J((d) => d.force('buga'));
const sp = await J((d) => d.spot(0));
await D((q) => SF.scene.down(q.x, q.y), sp); await sleep(100);
s = await J((d) => d.stats);
ok(s.ok === 12, 'klick på knappen BUGA räknas');
await J((d) => d.force('vinka'));
await D(() => SF.scene.key('2')); await sleep(100);
s = await J((d) => d.stats);
ok(s.ok === 13, 'tangenten 2 = VINKA');

// 5. passet slutar
await J((d) => d.finish());
await p.waitForFunction(() => /Passet är slut/.test(document.querySelector('#modal:not(.hidden) h2')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
ok(/Passet är slut/.test(await head()), 'lönebeskedet kommer');
const body = await D(() => document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || '');
ok(/Stående ovationer/.test(body) && /Missade/.test(body), 'bonusen för ovationer och den missade repliken syns i beskedet');
await p.click('#modal:not(.hidden) .dlg-foot .btn-go');
const ute = await p.waitForFunction(() => window.SF.sceneName === 'gamlastan', null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1200);
const pos = await D(() => SF.scene._debug.pos());
ok(ute && Math.abs(pos.x - 1229) < 30 && pos.y < 230, `tillbaka i Gamla stan vid teaterdörren (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
const m1 = await D(() => SF.game.money);
ok(m1 > m0 && (await D(() => SF.game.jobs.teater)) === 1, `lönen kom in (${m0} → ${m1} kr) och passet räknas`);

ok(!errs.length, `inga fel i sidan${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
