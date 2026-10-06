// Funktionstest av DRÄKTERNAS RÖRELSER (js/core/drakt.js) och de nya Halloween-dräkterna:
//   1. utan dräkt syns ingen 🎭-knapp
//   2. spökdräkten köps hel i maskeradbutiken och tas på – knappen visar 👻
//   3. ett tryck: rörelsen spelas för en själv (även utan nät) och skickas som emoten 👻 till världen
//   4. kompisarnas rörelser: en emote som hör till en dräkt ritas som rörelse (folkAction), andra
//      emotes som vanliga bubblor
//   5. varje dräkt har sin rörelse (fé 🪄, häxa ✨, vampyr 🧛, skelett 💀, pumpa 🎃, hjälte 🦸, ängel 😇)
//      och den ritas i alla fyra riktningar utan fel; bildrutorna 10 och 11 finns
//   6. rörelsen ritas i staden och hemma utan fel
//   node tools/drakt-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/favicon|ERR_|404/.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=drakt${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Spöket', look: { skin: '#eec3a0', hair: '#3b2619', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 20000, hunger: 70, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 12000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const btn = () => D(() => { const b = document.getElementById('hud-drakt'); return b ? { hidden: b.classList.contains('hidden'), txt: b.textContent } : null; });
await closeDlg();

// ---------- 1 ----------
await sleep(600);
ok((await btn())?.hidden === true, 'utan dräkt syns ingen 🎭-knapp');

// ---------- 2: spökdräkten ----------
await D(() => SF.go('maskerad')); await sleep(1500);
ok((await D(() => SF.scene._debug.spots())).includes('drakt-spoke'), 'spökdräkten finns bland dräkterna');
await D(() => SF.scene._debug.act('drakt-spoke'));
ok(await until(() => !document.querySelector('#modal').classList.contains('hidden'), 8000), 'spökdräkten → dräktdialogen');
await clickBtn(/Köp/);
ok(await until(() => SF.game.wardrobe.includes('hat-ghost')), 'spökdräkten är köpt');
await clickBtn(/Ta på mig dräkten/);
ok(await until(() => SF.avatar.look.hat === 'ghost', 6000), 'spökdräkten är på');
await closeDlg();
ok(await until(() => { const b = document.getElementById('hud-drakt'); return b && !b.classList.contains('hidden') && b.textContent === '👻'; }, 5000), '🎭-knappen visar 👻');

// ---------- 3: BU! ----------
await D(() => { window.__sent = []; const s = SF.sendEmote; SF.sendEmote = (e) => { window.__sent.push(e); try { s(e); } catch { /* utan nät */ } }; });
await D(() => document.getElementById('hud-drakt').click());
const act = await D(async () => { const M = await import('/js/core/drakt.js'); const a = M.myAction(); return a && { e: a.a.e, el: a.el }; });
ok(act?.e === '👻', 'tryck → spöket gör BU! (även utan nät)');
ok(await D(() => window.__sent.includes('👻')), 'rörelsen skickas som emoten 👻 till världen');
await sleep(700);
await p.locator('#scene').screenshot({ path: 'tools/out/drakt-bu.png' }).catch(() => {});
await until(async () => { const M = await import('/js/core/drakt.js'); return !M.myAction(); }, 5000);
ok(await D(async () => !(await import('/js/core/drakt.js')).myAction()), 'rörelsen tar slut av sig själv');

// ---------- 4 + 5: kompisarna och alla dräkter ----------
const r = await D(async () => {
  const M = await import('/js/core/drakt.js'), P = await import('/js/core/people.js');
  const base = { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' };
  const looks = {
    '🪄': { ...base, bag: 'fairyWings' }, '✨': { ...base, hat: 'witch' }, '🧛': { ...base, top: 'vampire' },
    '💀': { ...base, top: 'hoodie', topPrint: 'skeleton' }, '🎃': { ...base, top: 'puffer', topPrint: 'pumpkin' },
    '🦸': { ...base, top: 'hero' }, '😇': { ...base, hat: 'halo' }, '👻': { ...base, hat: 'ghost' },
  };
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
  const out = {};
  for (const [e, L] of Object.entries(looks)) {
    const a = M.actionFor(L);
    let drew = true;
    try { for (const dir of ['down', 'up', 'left', 'right']) for (const el of [0.1, 0.8, 1.6]) M.drawActing(ctx, 32, 56, L, dir, { a, el }); } catch (err) { drew = String(err); }
    out[e] = { got: a?.e, drew };
  }
  const folk = M.folkAction('kompis1', '👻'), plain = M.folkAction('kompis2', '😀');
  let frames = true;
  try { for (const f of [10, 11]) for (const dir of ['down', 'up', 'left', 'right']) P.drawPerson(ctx, 32, 56, looks['🪄'], dir, f); } catch (err) { frames = String(err); }
  return { out, folk: !!folk, plain: plain === null, frames };
});
for (const [e, v] of Object.entries(r.out)) ok(v.got === e && v.drew === true, `dräkten med ${e} har sin rörelse och ritas i alla riktningar${v.drew !== true ? ' – ' + v.drew : ''}`);
ok(r.folk && r.plain, 'en kompis dräktemote ritas som rörelse, en vanlig emote som bubbla');
ok(r.frames === true, 'bildrutorna 10 och 11 (armarna upp, trollspöet) ritas');

// ---------- 6: staden och hemma ----------
await D(() => SF.go('city')); await sleep(900);
await D(() => document.getElementById('hud-drakt').click()); await sleep(900);
await D(() => SF.go('room')); await sleep(900); await closeDlg();
await D(() => document.getElementById('hud-drakt').click()); await sleep(900);
ok(errs.length === 0, 'inga fel i konsolen' + (errs.length ? ' – ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
