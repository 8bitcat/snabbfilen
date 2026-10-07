// Regressionstest för SJÖBODEN INNE (js/scenes/shop-sjoboden.js) – fiskkrogen på piren i Linnéstaden:
//   • dörren i staden (enter 'fiskkrog') leder in i krogen
//   • menyn: rätt priser (fish & chips 69, räksmörgås 85, fisksoppa 79, sill 59, hjortronglass 39,
//     hallonsoda 15), mättnaden jämnt fördelad på tuggorna
//   • beställning med riktiga klick (disken → menyn → fish & chips + hallonsoda → Beställ)
//   • Maja friterar och lägger upp, brickan i händerna – med maten i händerna öppnas inte dörren
//   • sätt dig (klick på en ledig plats), ät tugga för tugga: mättnaden blir exakt rätternas,
//     lyckan går upp när allt är uppätet, sedan får man gå
//   • katten Sill vaknar när man klappar den, hummern Harald, utsikten, kvällen ritas utan fel
//   • scenen byts mitt i maten: resten räknas in (betald mat går aldrig förlorad)
// Kör: node tools/sjoboden-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
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
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=sjo${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 300, hunger: 30, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const sleep = (ms) => page.waitForTimeout(ms);
async function waitFor(fn, ms = 10000, arg) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(100); } return false; }

// ---- in genom dörren på piren ----
await page.evaluate(() => { window.SF.go('city'); });
await sleep(1500);
await page.evaluate(() => { const d = window.SF.scene._debug; d.teleport(-496, 914); d.enter('sjoboden'); });
ok(await waitFor(() => window.SF.sceneName === 'sjoboden' && !!window.SF.scene?._debug, 15000), 'dörren på piren leder in i Sjöboden');
await sleep(400);
const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const S = () => D('state');
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
async function clickSpot(id) {
  let p = await D('spot', id);
  if (!p) throw new Error('ingen plats ' + id);
  if (p.x < 6 || p.x > 378) { const c = await D('cam'); await D('lockCam', Math.max(0, c + p.x - 192)); p = await D('spot', id); await clickView(p.x, p.y); await D('lockCam', null); return; }
  await clickView(p.x, p.y);
}

// ---- menyn ----
const meny = await page.evaluate(() => window.SF.scene._debug.menu);
const byId = Object.fromEntries(meny.map((m) => [m.id, m]));
ok(byId.fishchips?.price === 69 && byId.raksmorgas?.price === 85 && byId.fisksoppa?.price === 79 && byId.sill?.price === 59 && byId.hjortron?.price === 39 && byId.soda?.price === 15, `priserna (${meny.map((m) => m.id + ' ' + m.price).join(', ')})`);
ok(meny.every((m) => m.fill > 0 && Number.isInteger(m.fill / m.bites) && Number.isInteger(m.energy / m.bites)), 'varje rätt mättar – jämnt fördelat på tuggorna');
ok(await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true })) === null, 'utan mat får man gå');

// ---- beställning med riktiga klick ----
await clickSpot('disk');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000), 'klick på disken → figuren går dit och menyn öppnas');
const menuText = await page.evaluate(() => document.querySelector('#modal').innerText);
ok(/Fish and chips[\s\S]*69\s*kr/.test(menuText) && /Räksmörgås[\s\S]*85\s*kr/.test(menuText) && /Hallonsoda[\s\S]*15\s*kr/.test(menuText), 'menyn visar rätterna med pris');
await page.click('[data-pick="fishchips"]');
await page.click('[data-pick="soda"]');
const bestall = await page.evaluate(() => document.querySelector('.dlg-foot .btn-go')?.innerText || '');
ok(/84\s*kr/.test(bestall), `beställknappen visar summan (${bestall.replace(/\s+/g, ' ').trim()})`);
const before = await S();
const glad0 = await page.evaluate(() => window.SF.game.lycka);
await page.click('.dlg-foot .btn-go');
await sleep(200);
let s = await S();
ok(s.money === before.money - 84, `betalt 84 kr (${before.money} → ${s.money})`);
ok(typeof await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true })) === 'string', 'betald mat: leaveBlock spärrar');
const acts = new Set();
let t0 = Date.now();
while (Date.now() - t0 < 30000) { s = await S(); if (s.cookAct) acts.add(s.cookAct); if (s.me === 'carry') break; await sleep(120); }
ok(s.me === 'carry', `Maja lagar maten och man får brickan i händerna (${[...acts].join(' → ')})`);
ok(acts.has('frit') && acts.has('lagg'), 'fisken friteras och läggs upp på tallriken');
await clickSpot('dorr');
await sleep(1500);
ok(await page.evaluate(() => window.SF.sceneName) === 'sjoboden' && (await S()).say === 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!', 'med maten i händerna kommer man inte ut');

// ---- sätt dig och ät ----
const seat = (await D('seats')).find((x) => !x.occ && x.id.startsWith('t'));
await clickSpot(seat.id);
ok(await waitFor(() => window.SF.scene._debug.state().me === 'sit', 12000), `satte sig vid bordet (${seat.id})`);
const h0 = (await S()).hunger;
ok(await waitFor(() => window.SF.scene._debug.state().tray && window.SF.scene._debug.state().hunger > 30.5, 8000), 'mättnaden kommer tugga för tugga medan man sitter');
await clickView(300, 200);
await sleep(300);
ok((await S()).say === 'ÄT UPP FÖRST! 😋' && (await S()).me === 'sit', 'mitt i maten sitter man kvar');
s = await D('eatFast');
ok(!s.order && Math.abs(s.got.fill - (byId.fishchips.fill + byId.soda.fill)) < 0.01, `allt uppätet: mättnad +${Math.round(s.got.fill)} (fish & chips ${byId.fishchips.fill} + soda ${byId.soda.fill})`);
const glad1 = await page.evaluate(() => window.SF.game.lycka);
ok(glad1 > glad0 && s.got.glad >= 2, `lyckan går upp när allt är uppätet (+${glad1 - glad0})`);
ok(await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true })) === null, 'uppätet: nu får man gå');

// ---- detaljerna ----
await clickSpot('katt');
ok(await waitFor(() => window.SF.scene._debug.state().cat, 10000), 'skeppskatten Sill vaknar när man klappar den');
await clickSpot('akvarium');
ok(await waitFor(() => /Harald/.test(window.SF.scene._debug.state().cookSay || ''), 10000), 'Maja berättar om hummern Harald i akvariet');
await D('jump');
await page.evaluate(() => { window.SF.game.min = 21.5 * 60; });
await sleep(800);
const pano = await D('panorama');
ok(typeof pano === 'string' && pano.length > 5000, 'kvällen: hela lokalen ritas (lyktorna tända, fyren blinkar)');

// ---- scenbyte mitt i maten ----
await page.evaluate(() => { window.SF.game.money = 300; window.SF.game.min = 13 * 60; });
const r = await D('forceBuy', ['fisksoppa']);
ok(r.ok, 'en fisksoppa till');
const hb = (await S()).hunger;
await page.evaluate(() => window.SF.go('city'));
await sleep(500);
const ha = await page.evaluate(() => window.SF.game.hunger);
ok(ha >= Math.min(100, hb + byId.fisksoppa.fill) - 0.5,`scenen byts mitt i: soppan räknas in ändå (${Math.round(hb)} → ${Math.round(ha)})`);

ok(errs.length === 0, 'inga fel i konsolen' + (errs.length ? ' – ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
