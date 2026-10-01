// Funktionstest av FORDONEN (game.js FORDON/buyFordon/paintFordon/setAker, js/scenes/shop-fordon.js
// GARAGET + 🚲-knappen, js/core/fordon-art.js, city.js åkandet, world.js fd):
//   1. garagelängan i förorten är öppen 9–19 och leder in i GARAGET; Kenta pratar
//   2. fem fordon med prislappar; köpdialogen: färgerna, farten, priset; köp → åker på det
//   3. måla om ett fordon man har (150 kr); för dyrt = inget köp
//   4. i staden: farten = gångfarten × fordonets fart; andra ser fordonet (worldRide)
//   5. 🚲-knappen: syns bara med fordon; ett fordon = växla åka/gå, flera = välj i en ruta
//   6. allt sparas; en gammal sparfil utan fordon fungerar; fordonen ritas åt alla håll
//   7. första turen för dagen gör en glad
//   node tools/fordon-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'fordon') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = (extra = {}) => ({ v: 1, day: 3, min: 10 * 60, money: 20000, hunger: 80, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, ...extra });
const start = async (save) => {
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fd${Date.now().toString(36)}`);
  await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Åkaren', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, save);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(700);
};
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(80); } return false; };
const modalTitle = () => D(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
const modalText = () => D(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const lastToast = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).pop() || '');
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
const hud = () => D(() => { const b = document.getElementById('hud-fordon'); return b ? { hidden: b.classList.contains('hidden'), txt: b.textContent } : null; });

// ---------- 1. garaget ----------
await start(SAVE());
ok((await hud())?.hidden === true, '🚲-knappen syns inte utan fordon');
await D(() => SF.go('city')); await sleep(1200);
ok(await D(() => SF.scene._debug.enter('garage')), 'garagelängan har en dörr');
ok(await until(() => SF.sceneName === 'fordon', 15000), 'in i GARAGET');
await sleep(1200);
ok(!!(await D(() => SF.scene._debug.kenta())), `Kenta hälsar (${await D(() => SF.scene._debug.kenta())})`);
await shot('01-garaget');
const ids = ['begcykel', 'stadscykel', 'elspark', 'racer', 'moppe'];
ok((await D((ids) => ids.every((id) => !!SF.scene._debug.spot(id)), ids)), 'fem fordon står uppställda');

// ---------- 2. köp ----------
await D(() => { const s = SF.scene._debug.spot('stadscykel'); SF.scene.down(s.x, s.y); });
ok(await until(() => /Stadscykel med korg/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'klick på stadscykeln: figuren går dit och köpdialogen öppnas');
ok((await D(() => document.querySelectorAll('#modal [data-c]').length)) === 5, 'fem färger att välja');
ok(/1,7 × så fort/.test(await modalText()) && /1\s600\skr/.test(await modalText()), 'farten och priset står i dialogen');
await D(() => document.querySelector('#modal [data-c="#d9433b"]').click()); await sleep(150);
ok(await D(() => document.querySelector('#modal [data-c="#d9433b"]').classList.contains('on')), 'röd färg vald');
const m0 = await D(() => SF.game.money);
ok(await clickBtn(/Köp/), 'Köp-knappen');
await sleep(200);
ok((await D(() => SF.game.money)) === m0 - 1600, 'stadscykeln kostade 1 600 kr');
ok((await D(() => JSON.stringify(SF.game.fordon))) === JSON.stringify([{ id: 'stadscykel', c: '#d9433b' }]), 'den röda stadscykeln är din');
ok((await D(() => SF.game.akerMed)) === 'stadscykel', 'man åker på den direkt');
ok(/Grattis till stadscykeln/.test(await lastToast()), 'besked: Grattis till stadscykeln!');
const h1 = await hud();
ok(h1 && !h1.hidden && h1.txt === '🚲', `🚲-knappen syns nu (${JSON.stringify(h1)})`);
ok(/Din!/.test(await modalText()) && !(await D(() => [...document.querySelectorAll('#modal button')].some((b) => /Köp/.test(b.textContent)))), 'dialogen säger Din! och har ingen Köp-knapp');
await closeDlg();
// moppen också
await D(() => SF.scene._debug.act('moppe')); await sleep(200);
await clickBtn(/Köp/); await sleep(200);
ok((await D(() => SF.game.akerMed)) === 'moppe' && (await D(() => SF.game.fordon.length)) === 2, 'moppen köpt – nu åker man på den');
await closeDlg();
// ---------- 3. måla om, för dyrt ----------
await D(() => SF.scene._debug.act('stadscykel')); await sleep(200);
await D(() => document.querySelector('#modal [data-c="#46a35a"]').click()); await sleep(150);
const m1 = await D(() => SF.game.money);
ok(await clickBtn(/Måla om/), 'ny färg på en cykel man har: Måla om');
await sleep(150);
ok((await D(() => SF.game.fordonFarg('stadscykel'))) === '#46a35a' && (await D(() => SF.game.money)) === m1 - 150, 'ommålad grön för 150 kr');
await closeDlg();
await D(() => { SF.game.money = 100; });
await D(() => SF.scene._debug.act('racer')); await sleep(200);
await clickBtn(/Köp/); await sleep(150);
ok(!(await D(() => SF.game.hasFordon('racer'))) && /inte råd/.test(await lastToast()), 'för lite pengar: ingen racer');
await closeDlg();
await D(() => { SF.game.money = 20000; });
await shot('02-garaget-dina');
// ---------- 4. i staden ----------
await D(() => { const s = SF.scene._debug.spot('dorr'); SF.scene.down(s.x, s.y); });
ok(await until(() => SF.sceneName === 'city', 15000), 'ut genom rullporten till staden');
await sleep(800);
let f = await D(() => SF.scene._debug.fordon());
ok(f.id === 'moppe' && Math.round(f.speed) === 286, `på moppen: farten 110 × 2,6 = 286 (${JSON.stringify(f)})`);
ok(JSON.stringify(await D(() => SF.scene.worldRide)) === JSON.stringify({ id: 'moppe', c: '#e0a02a' }), 'andra spelare ser moppen (worldRide)');
// första turen för dagen gör en glad
const gl0 = await D(() => SF.game.lycka);
await D(() => { const s = SF.scene._debug.pos(); SF.scene._debug.walkTo(s.x - 120, s.y); });
await sleep(300);
ok((await D(() => SF.game.lycka)) > gl0, 'första turen för dagen: +lycka');
await sleep(800);
await shot('03-moppe-stan');
// ---------- 5. 🚲-knappen ----------
await p.click('#hud-fordon');
ok(await until(() => /Åka eller gå/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'två fordon: knappen frågar vad man vill ta');
ok((await D(() => document.querySelectorAll('#modal [data-f]').length)) === 3, 'valen: stadscykeln, moppen och att gå');
await D(() => document.querySelector('#modal [data-f=""]').click()); await sleep(200);
f = await D(() => SF.scene._debug.fordon());
ok(f.id === null && Math.round(f.speed) === 110, 'Gå: vanlig gångfart');
ok((await hud()).txt === '🚶' && (await D(() => SF.scene.worldRide)) === null, 'knappen visar 🚶 och andra ser en gå');
await p.click('#hud-fordon');
await until(() => !!document.querySelector('#modal [data-f="stadscykel"]'));
await D(() => document.querySelector('#modal [data-f="stadscykel"]').click()); await sleep(200);
f = await D(() => SF.scene._debug.fordon());
ok(f.id === 'stadscykel' && Math.round(f.speed) === 187, `stadscykeln: 110 × 1,7 = 187 (${f.speed})`);
await D(() => { const s = SF.scene._debug.pos(); SF.scene._debug.walkTo(s.x + 100, s.y); }); await sleep(400);
await shot('04-cykel-stan');
// ---------- 6. sparas ----------
await D(() => SF.game.save());
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await sleep(600);
ok((await D(() => SF.game.fordon.map((x) => x.id).join(','))) === 'stadscykel,moppe' && (await D(() => SF.game.akerMed)) === 'stadscykel', 'fordonen och valet finns kvar efter omladdning');
// ett fordon: knappen växlar direkt
await start(SAVE({ fordon: [{ id: 'elspark', c: '#2aa39a' }], akerMed: 'elspark' }));
await D(() => SF.go('city')); await sleep(1000);
ok((await hud()).txt === '🛴', 'elsparkcykeln: 🛴 i HUD:en');
await p.click('#hud-fordon'); await sleep(200);
ok((await D(() => SF.game.akerMed)) === null && !(await modalTitle()), 'ett fordon: tryck = gå (ingen ruta)');
await p.click('#hud-fordon'); await sleep(200);
ok((await D(() => SF.game.akerMed)) === 'elspark' && Math.round((await D(() => SF.scene._debug.fordon())).speed) === 209, 'tryck igen = åk (110 × 1,9)');
// gammal sparfil, trasiga fält
await start(SAVE({ fordon: [{ id: 'moppe', c: 'lila' }, { id: 'moppe', c: '#3a7bd5' }, { id: 'raket', c: '#ffffff' }], akerMed: 'raket' }));
ok((await D(() => JSON.stringify(SF.game.fordon))) === JSON.stringify([{ id: 'moppe', c: '#e0a02a' }, { id: 'raket', c: '#ffffff' }]) && (await D(() => SF.game.akerMed)) === null, 'trasig färg lagas, dubbletter bort, okänt fordon (nyare version) följer med orört');
await start(SAVE());
ok((await D(() => JSON.stringify(SF.game.fordon))) === '[]' && (await D(() => SF.game.aker)) === null, 'sparfil utan fordon: inga fordon');
// alla fordon åt alla håll ritas utan fel och syns
const drawn = await D(async () => {
  const F = await import('./js/core/fordon-art.js'); const G = await import('./js/game.js');
  const cv = document.createElement('canvas'); cv.width = 60; cv.height = 50; const c = cv.getContext('2d');
  const out = [];
  for (const fd of G.FORDON) for (const dir of ['left', 'right', 'up', 'down']) for (const mv of [false, true]) {
    c.clearRect(0, 0, 60, 50);
    F.drawRide(c, fd.id, 30, 46, dir, 0.4, mv, SF.avatar.look, fd.colors[1] || fd.colors[0]);
    const d = c.getImageData(0, 0, 60, 50).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    out.push(n);
  }
  return out;
});
ok(drawn.length === 40 && drawn.every((n) => n > 150), `alla fem fordon ritas åt alla fyra håll, stilla och i rörelse (minst ${Math.min(...drawn)} px)`);
// ---------- garaget stängt på kvällen ----------
await D(() => { SF.game.min = 20 * 60; SF.go('city'); }); await sleep(1000);
await D(() => SF.scene._debug.enter('garage'));
ok(await until(() => /stängt/.test([...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' ') + (document.querySelector('#modal:not(.hidden)')?.innerText || '')), 20000) && (await D(() => SF.sceneName)) === 'city', 'klockan 20: garaget har stängt');

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
