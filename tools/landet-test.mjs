// Funktionstest av LANDET (js/scenes/landet.js, js/landet/karta.js + djur.js, city.js stadsgränsen):
//   1. österut på Pixelgatan förbi skylten LANDET → ut på landet (frisk luft gör en glad)
//   2. djuren: kor, får, höns och hästar betar och går – men håller sig i sina hagar
//   3. klicka på en ko: man går dit och den säger MUUU (lite gladare)
//   4. traktorn skördar vetefältet rad för rad
//   5. gården och stallet (till salu/snart), ridbanan
//   6. bussen från hållplatsen LANDET till Betongtorget (10 kr); västerut tillbaka in i staden
//   7. cykeln går att åka här; kvällen och natten ritas utan fel
//   node tools/landet-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'landet') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 11 * 60, money: 500, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, lycka: 50, fordon: [{ id: 'stadscykel', c: '#3a7bd5' }] };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=la${Date.now().toString(36)}`);
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Bonden', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, SAVE);
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const toasts = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '));
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };

// ---------- 1. ut på landet ----------
await D(() => { SF.cityPos = [3900, 296]; SF.go('city'); }); await sleep(1500);
await D(() => SF.scene._debug.teleport(3900, 296)); await sleep(300);
const gl0 = await D(() => SF.game.lycka);
await D(() => SF.scene.down(383, 120));   // längst ut till höger på skärmen (skylten/gatan)
ok(await until(() => SF.sceneName === 'landet', 15000), 'österut förbi skylten LANDET: ut på landet');
await sleep(1500);
ok((await D(() => SF.game.lycka)) > gl0 || /Frisk luft/.test(await toasts()), 'frisk luft på landet gör en glad');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x < 40 && pos.y > 180 && pos.y < 310, `man kommer ut på landsvägen i väster (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
await shot('01-in');
// ---------- 2. djuren ----------
const D0 = await D(() => SF.scene._debug.djur());
const n = (s) => D0.filter((d) => d.sort === s).length;
ok(n('ko') === 6 && n('far') === 9 && n('hona') === 6 && n('hast') === 4, `kor, får, höns och hästar (${n('ko')}/${n('far')}/${n('hona')}/${n('hast')})`);
await sleep(9000);
const D1 = await D(() => SF.scene._debug.djur());
ok(D1.some((d, i) => Math.hypot(d.x - D0[i].x, d.y - D0[i].y) > 3), 'djuren går omkring');
ok(D1.every((d) => d.x >= d.pen[0] && d.x <= d.pen[2] && d.y >= d.pen[1] && d.y <= d.pen[3] + 2), 'alla djur håller sig i sina hagar');
// ---------- 3. klicka på en ko ----------
await D(() => SF.scene._debug.teleport(380, 205)); await sleep(500);
const gl1 = await D(() => SF.game.lycka);
await D(() => { const k = SF.scene._debug.djurSkarm('ko'); SF.scene.down(k.x, k.y); });
ok(await until(() => /MU|Muu/i.test(SF.scene._debug.prat() || ''), 12000), `kon säger: ${await D(() => SF.scene._debug.prat())}`);
ok((await D(() => SF.game.lycka)) > gl1, 'att klappa kon gör en glad');
await shot('02-ko');
// ---------- 4. traktorn ----------
const t0 = await D(() => SF.scene._debug.traktor());
await sleep(5000);
const t1 = await D(() => SF.scene._debug.traktor());
ok(Math.abs(t1.x - t0.x) > 20 || t1.rad !== t0.rad, `traktorn kör (x ${t0.x} → ${t1.x}, rad ${t0.rad} → ${t1.rad})`);
// ---------- 5. gården, stallet ----------
await D(() => SF.scene._debug.act('gard')); await sleep(150);
ok(/Gården till salu/.test(await D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'gården: till salu (köprutan)');
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await D(() => SF.scene._debug.act('stall')); await sleep(150);
ok(/Stallet/.test(await toasts()), 'stallet: hästar snart');
await D(() => SF.scene._debug.teleport(880, 205)); await sleep(500); await shot('03-garden');
await D(() => SF.scene._debug.teleport(1880, 420)); await sleep(500); await shot('04-ridbanan');
// ---------- 7. cykeln, kvällen, natten ----------
await D(() => { SF.game.setAker('stadscykel'); SF.scene.rideChanged(); });
ok(Math.round(await D(() => SF.scene.worldRide ? 1 : 0)) === 1, 'på cykeln även på landet');
for (const min of [19 * 60, 22 * 60]) { await D((m) => { SF.game.min = m; }, min); await sleep(400); }
await shot('05-natt');
await D(() => { SF.game.min = 12 * 60; SF.game.setAker(null); SF.scene.rideChanged(); });
// ---------- 6. bussen och vägen tillbaka ----------
await D(() => SF.scene._debug.act('buss')); await sleep(200);
ok(/Busshållplats LANDET/.test(await D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'busshållplatsen: Linje 4 till Betongtorget');
const m0 = await D(() => SF.game.money);
await D(() => [...document.querySelectorAll('#modal button')].find((b) => /Åk till stan/.test(b.textContent)).click());
ok(await until(() => SF.sceneName === 'city', 8000), 'bussen tar en till stan');
await sleep(800);
const cp = await D(() => SF.scene._debug.pos());
ok((await D(() => SF.game.money)) === m0 - 10 && cp.x > 3100 && cp.x < 3400, `biljetten 10 kr, framme vid Betongtorget (${Math.round(cp.x)})`);
// gå ut igen och tillbaka västerut
await D(() => { SF.landetFran = { y: 250 }; SF.go('landet'); }); await sleep(1800);
await D(() => SF.scene.down(2, 130));
ok(await until(() => SF.sceneName === 'city', 12000), 'västerut: tillbaka in i staden');
await sleep(600);
const cp2 = await D(() => SF.scene._debug.pos());
ok(cp2.x > 3900, `vid stadsgränsen på Pixelgatan (${Math.round(cp2.x)}, ${Math.round(cp2.y)})`);

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
