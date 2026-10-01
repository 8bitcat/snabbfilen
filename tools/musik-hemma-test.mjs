// Funktionstest av MUSIK HEMMA (js/core/hemmusik.js, room.js TV:n/skivsamlingen, music.js pickMusic):
//   1. TV:n frågar: titta en stund eller musik; musikdialogen har ALLA spelets låtar (12)
//   2. en låt spelar hemma i stället för hemma-låten, med TV:ns klang; noterna stiger från TV:n
//   3. filmlåtarna (KBK-signaturen) spelas av filmmusiken – stadens låt tystnar så länge
//   4. skivsamlingen spelar också (fullare klang, högre); Stäng av → hemma-låten igen
//   5. musiken står på när man går ut och in igen, men tystnar när man lägger sig
//   6. musik gör en glad (högst +6 om dagen); utan prylar finns ingen musik att sätta på
//   node tools/musik-hemma-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'musik-hemma') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = (storage) => ({ v: 1, day: 3, min: 10 * 60, money: 500, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage, deco: {}, won: false });
const start = async (save) => {
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=mh${Date.now().toString(36)}`);
  await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Lyssnaren', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'wavy', shirt: '#3a5a8a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, save);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(700);
};
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(80); } return false; };
const modalTitle = () => D(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
// (knapparna har sin kortkommandobokstav sist i texten: "Stäng S")
const realClick = async (re) => { const b = p.locator('#modal button', { hasText: re }).first(); await b.click(); await sleep(150); };
const STANG = /^\s*Stäng(?! av)/;
const mstats = () => D(async () => { const m = await import('./js/core/music.js'); return m.musicStats(); });
const lastToast = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).pop() || '');
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
// ställ ut förrådspost 0 på första lediga platsen (rutnät över golvet)
async function placeFirst() {
  return D(() => {
    const d = SF.scene._debug;
    if (!d.pickStorage(0)) return false;
    for (let y = 120; y < 230; y += 6) for (let x = 40; x < 330; x += 6) if (d.canPlace(x, y)) return d.drop(x, y);
    return false;
  });
}
const goSpot = (id) => D((id) => { const s = SF.scene._debug.spot(id); if (!s) return false; SF.scene.down(s.x, s.y); return true; }, id);

// ---------- 1. TV:n ----------
await start(SAVE([{ k: 'tv', v: 1 }, { k: 'skivor', v: 0 }]));
// en riktig klick först – ljudet får bara starta efter en pekning
await p.mouse.click(600, 700); await sleep(300);
ok(await placeFirst(), 'TV:n står i rummet');
ok(await placeFirst(), 'skivsamlingen står i rummet');
await sleep(300);
const props = await D(() => SF.scene._debug.props().filter((q) => q.k === 'tv' || q.k === 'skivor').map((q) => `${q.k}:${q.fn}`));
ok(props.includes('tv:tv') && props.includes('skivor:musik'), `TV:n och skivsamlingen har funktioner (${props.join(', ')})`);
const mus0 = await mstats();
ok(mus0.want === 'hemma' || mus0.want === 'natt', `hemma spelar hemma-låten (${mus0.want})`);
ok(await goSpot('tv'), 'klick på TV:n');
ok(await until(() => /TV/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), `TV:n frågar vad man vill göra (${await modalTitle()})`);
const btns = await D(() => [...document.querySelectorAll('#modal button')].map((b) => b.textContent));
ok(btns.some((t) => /Titta/.test(t)) && btns.some((t) => /Musik/.test(t)), `valen: titta en stund / musik (${btns.join(' | ')})`);
await realClick(/Musik/);
ok(/Musik på TV:n/.test(await modalTitle()), 'musikdialogen för TV:n');
ok((await D(() => document.querySelectorAll('#modal [data-lat]').length)) === 12, 'alla tolv låtar i spelet finns att välja');
ok(await D(() => /Catchy Swing/.test(document.querySelector('#modal').innerText) && /KBK-signaturen/.test(document.querySelector('#modal').innerText)), 'jukeboxlåten och fotbollsfilmens signatur finns med');

// ---------- 2. en låt ----------
const gl0 = await D(() => SF.game.lycka);
await p.locator('#modal [data-lat="jukebox"]').click(); await sleep(200);
ok((await D(() => SF.hemMusik?.id)) === 'jukebox', 'jukeboxlåten är på');
ok(/Catchy Swing på TV:n/.test(await lastToast()), 'besked: Catchy Swing på TV:n');
ok((await D(() => SF.game.lycka)) > gl0, 'musik gör en glad');
ok(await until(async () => { const m = await import('./js/core/music.js'); return m.musicStats().want === 'jukebox'; }), 'musiken byter till jukeboxlåten hemma');
ok((await D(() => document.querySelectorAll('#modal [data-stop]').length)) === 1, 'den som spelar har en Stäng av-knapp');
await realClick(STANG);
await sleep(600);
ok(await D(() => SF.scene._debug.notes?.() > 0), 'noter stiger från TV:n');
await shot('01-tv-musik');

// ---------- 3. filmlåten ----------
await goSpot('tv');
await until(() => /TV/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
await realClick(/Musik/);
await p.locator('#modal [data-lat="film-intro"]').click(); await sleep(400);
ok(await until(async () => { const f = await import('./js/scenes/bio/filmmusik.js'); return f.filmMusicPlaying(); }), 'KBK-signaturen spelar (filmmusiken)');
ok(await until(async () => { const m = await import('./js/core/music.js'); return !m.musicStats().want; }), 'stadens musik är tyst så länge');
await realClick(STANG);

// ---------- 4. skivsamlingen ----------
await goSpot('skivor');
ok(await until(() => /skivspelaren/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'skivsamlingen öppnar musiken direkt (skivspelaren)');
await p.locator('#modal [data-lat="parken"]').click(); await sleep(300);
ok(await until(async () => { const f = await import('./js/scenes/bio/filmmusik.js'); return !f.filmMusicPlaying(); }), 'filmlåten slutar när man byter');
ok(await until(async () => { const m = await import('./js/core/music.js'); const s = m.musicStats(); return s.want === 'parken'; }), 'Peaceful Days på skivspelaren');
const pk = await D(async () => { const h = await import('./js/core/hemmusik.js'); return h.hemPick(SF); });
ok(pk && pk.fx === 'none' && pk.lvl > 1.3, `skivspelaren: full klang och högre (${JSON.stringify(pk)})`);
// lyckan: högst +6 om dagen
await D(() => { for (let i = 0; i < 5; i++) document.querySelector('#modal [data-lat="soder"], #modal [data-lat="natt"]')?.click(); });
await sleep(200);
ok((await D(() => SF.game.lycka)) - gl0 <= 6.01, 'musiken ger högst +6 lycka om dagen');
await realClick(/Stäng av/);
ok(!(await D(() => SF.hemMusik)), 'Stäng av: musiken är av');
ok(await until(async () => { const m = await import('./js/core/music.js'); const w = m.musicStats().want; return w === 'hemma' || w === 'natt'; }), 'hemma-låten igen');
await realClick(STANG);

// ---------- 5. ut och in, sova ----------
await goSpot('skivor');
await until(() => !!document.querySelector('#modal [data-lat]'));
await p.locator('#modal [data-lat="kafe"]').click(); await sleep(200);
await realClick(STANG);
await D(() => SF.go('city')); await sleep(800);
ok(await until(async () => { const m = await import('./js/core/music.js'); return m.musicStats().want !== 'kafe'; }), 'ute i stan spelar stadens låt');
await D(() => { SF.roomSub = 0; SF.go('room'); }); await sleep(800);
ok(await until(async () => { const m = await import('./js/core/music.js'); return m.musicStats().want === 'kafe'; }), 'hemma igen: skivspelaren står kvar på Cat caffe');
await D(() => { SF.game.min = 22 * 60; });
await goSpot('sang');
ok(await until(() => !!document.querySelector('#modal:not(.hidden)')), 'sängen frågar om man vill sova');
await D(() => { const b = [...document.querySelectorAll('#modal button')].find((x) => /Sov/.test(x.textContent)); b?.click(); });
await sleep(400);
ok(!(await D(() => SF.hemMusik)), 'man stänger av musiken när man lägger sig');
await D(() => SF.scene.key?.(' '));   // spola fram natten

// ---------- 6. utan prylar ----------
await start(SAVE([]));
const fns = await D(() => SF.scene._debug.props().map((q) => q.fn).filter(Boolean));
ok(!fns.includes('tv') && !fns.includes('musik'), 'lilla rummet från början: ingen TV och ingen skivsamling');

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
