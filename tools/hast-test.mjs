// Funktionstest av HÄSTEN (game.js HAST_*/buyHast/mataHast/borstaHast/hoppResultat, js/landet/hast-art.js,
// js/scenes/landet.js stallet/rida/hinderbanan, js/scenes/hopp.js):
//   1. stallet: köp en häst (färg + namn) – den står i hagen
//   2. mata och borsta (trivseln), rid ut (fortare, man sitter på hästen)
//   3. hinderbanan: lätt klass öppen, de andra låsta; felfri runda → 1:a plats, pris, nästa klass öppnas
//   4. inga hopp = rivningar (4 fel var) → sist; en häst som inte trivs vägrar
//   5. natten: hungrig häst → trivseln sjunker; stallhyran på måndagen; går man in i stan stannar hästen
//   node tools/hast-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'hast') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 10 * 60, money: 20000, hunger: 80, energy: 100, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, lycka: 60 };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=hs${Date.now().toString(36)}`);
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Ryttaren', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, SAVE);
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(700);
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; };
const title = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
const text = () => D(() => document.querySelector('#modal:not(.hidden)')?.innerText || '');
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const closeDlg = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
// en hoppning: hoppar vid "avstand" px före varje hinder (null = hoppar aldrig) – körs i sidan
const hoppning = (avstand) => D((av) => new Promise((ok) => {
  const d = SF.scene._debug; d.skipStart();
  const iv = setInterval(() => {
    if (SF.sceneName !== 'hopp') { clearInterval(iv); ok(true); return; }
    const n = SF.scene._debug?.nasta?.();
    if (av != null && n != null && n < av && n > av - 14) SF.scene._debug.hoppa();
  }, 16);
}), avstand);

// ---------- 1. köpa en häst ----------
await D(() => { SF.landetFran = { y: 290 }; SF.go('landet'); }); await sleep(1800);
await D(() => SF.scene._debug.act('stall')); await sleep(200);
ok(/hästar till salu/.test(await title()), 'stallet: hästar till salu');
await D(() => document.querySelector('#modal [data-farg="svart"]').click()); await sleep(150);
await D(() => { const i = document.querySelector('#modal .hast-namn'); i.value = 'Blixten'; i.dispatchEvent(new Event('input')); });
const m0 = await D(() => SF.game.money);
await clickBtn(/Köp/); await sleep(300);
const H0 = await D(() => SF.game.hast);
ok(H0 && H0.namn === 'Blixten' && H0.farg === 'svart' && (await D(() => SF.game.money)) === m0 - 12000, 'köpte svarta Blixten för 12 000 kr');
ok((await D(() => SF.scene._debug.djur().filter((d) => d.egen).length)) === 1, 'Blixten står i hästhagen');
// ---------- 2. sköta, rida ----------
await D(() => SF.scene._debug.act('stall')); await sleep(200);
ok(/Blixten/.test(await title()), 'stallet: Blixtens ruta');
const t0 = await D(() => SF.game.hast.trivsel);
await clickBtn(/Borsta/); await sleep(150);
ok((await D(() => SF.game.hast.borstad)) === (await D(() => SF.game.day)) && (await D(() => SF.game.hast.trivsel)) > t0, 'borstad – trivseln steg');
await clickBtn(/Rid ut/); await sleep(200);
ok(await D(() => SF.scene._debug.rider()) && Math.round(await D(() => SF.scene._debug.fart())) === 242, 'rider ut på Blixten (fart 110 × 2,2)');
await D(() => { SF.scene._debug.teleport(1600, 300); SF.scene._debug.walkTo(1400, 300); }); await sleep(500);
await shot('01-rider');
// ---------- 3. hinderbanan ----------
await D(() => SF.scene._debug.act('ridbana')); await sleep(200);
ok(/Hinderbanan/.test(await title()), 'ridbanan: hinderbanan');
ok((await D(() => [...document.querySelectorAll('#modal [data-klass]')].map((b) => b.disabled).join(','))) === 'false,true,true', 'lätt klass öppen, medel och svår låsta');
await D(() => document.querySelector('#modal [data-klass="latt"]').click());
ok(await until(() => SF.sceneName === 'hopp', 6000), 'in på hinderbanan');
await sleep(400); await shot('02-start');
await hoppning(34);
ok(await until(() => SF.sceneName === 'landet', 8000), 'efter målet: tillbaka till ridbanan');
ok(await until(() => /1:a plats/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), 6000), `felfri runda: ${await title()}`);
ok(/Felfri runda/.test(await text()) && /500\skr/.test(await text()) && /Medelsvår klass/.test(await text()), 'felfritt → 500 kr och medelsvår klass öppen');
ok((await D(() => SF.game.hast.klass)) === 1 && (await D(() => SF.game.hast.rosetter.latt[0])) === 1, 'en blå rosett i lätt klass');
ok(await D(() => SF.scene._debug.rider()), 'man sitter kvar på hästen vid banan');
await closeDlg();
// ---------- 4. inga hopp ----------
await D(() => { SF.go('hopp', { klass: 'medel', onDone: (r) => { window.__hopp = r; SF.landetFran = { bana: true }; SF.go('landet'); } }); }); await sleep(400);
await hoppning(null);
const res = await D(() => window.__hopp);
ok(res && res.fel === 36 && res.rivna === 9, `hoppar man inte rivs alla 9 hinder (${JSON.stringify(res)})`);
const sist = await D((r) => SF.game.hoppResultat(r.klass, r.fel, r.tid), res);
ok(sist.plats === 4 && sist.pris === 0, 'med 36 fel kommer man sist och får inget pris');
// en häst som inte trivs vägrar
await D(() => { SF.game.hast.trivsel = 0; SF.game.hast.hopp = 3; SF.go('hopp', { klass: 'latt', onDone: (r) => { window.__hopp = r; SF.landetFran = { bana: true }; SF.go('landet'); } }); }); await sleep(400);
await hoppning(34);
const res2 = await D(() => window.__hopp);
ok(res2.vagran > 0 && res2.fel === res2.vagran * 4 + res2.rivna * 4, `trivsel 0: hästen vägrar (${res2.vagran} vägringar)`);
await shot('03-efter');
// ---------- 5. natten, stallhyran, staden ----------
const natt = await D(() => { const g = SF.game; g.hast.trivsel = 60; g.hast.matad = g.day - 1; g.day = 7; g.hast.matad = 5; g.hast.borstad = 5; const m = g.money; g.sleep(); return { trivsel: g.hast.trivsel, hyra: g.hast.stallhyra, natt: g.gladNatt.map((x) => x.t) }; });
ok(natt.trivsel < 60 && natt.natt.some((t) => /Blixten var hungrig/.test(t)), `hungrig och oborstad natt: trivseln sjönk till ${natt.trivsel}`);
ok(natt.hyra === 250, 'måndag: stallhyran 250 kr');
await D(() => { SF.game.min = 12 * 60; SF.landetFran = { y: 250 }; SF.go('landet'); }); await sleep(1500);
await D(() => { SF.ridHast = true; SF.scene.rideChanged(); SF.scene.down(2, 130); });
ok(await until(() => SF.sceneName === 'city', 12000) && !(await D(() => SF.ridHast)), 'in i stan: hästen stannar i stallet');
// sparas
await D(() => SF.game.save());
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await sleep(500);
ok((await D(() => SF.game.hast?.namn)) === 'Blixten' && (await D(() => SF.game.hast.klass)) === 1, 'hästen och klassen sparas');

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
