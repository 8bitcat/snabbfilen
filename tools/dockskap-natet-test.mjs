// 👫 LEKA IHOP I DOCKSKÅPET (js/net/dockdela.js + js/scenes/dockskap.js, v0.168) – tvåspelartest över riktiga
// PeerJS-molnet i en egen värld. Carl 2026-11-22: "man ska kunna bjuda in sina kompisar i dockskåpsläget … kompisen
// ska också kunna trycka på allting, båda ska se animationerna när kompisen gör något".
//   1. Mira och Leo är i Pixelstaden och öppnar var sitt Dockskåp (pausmenyvägen). Mira ställer ut ett piano och
//      bjuder in Leo (👫). Leo får rutan "Leka ihop?" och trycker Kom! → han är gäst hos Mira och ser hennes piano.
//   2. Mira trycker på pianot i Leka → Leo ser samma reaktion. Leo tänder lampan → Mira ser den tänd. Leo ställer
//      in en figur → Mira ser den. Leos hand syns hos Mira där han pekar. Mira slår på natten → natt hos Leo.
//   3. Leo går hem: sitt eget hus igen (inget piano), och Miras fil är orörd hos honom. Mira ser att han gick.
//   node tools/dockskap-natet-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
const WORLD = 'dk' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?nomenu&world=${WORLD}&nettest=1`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch();
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);
const SAVE = { v: 1, day: 3, min: 600, money: 3000, hunger: 80, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } };
async function player(name, id, color) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 620 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${String(e.stack || e.message).split(String.fromCharCode(10)).slice(0, 4).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load|ERR_/i.test(m.text()) && errors.push(`[${name}] ${m.text()}`));
  await page.goto(URL);
  await page.evaluate(([n, id, c, s]) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id, name: n, look: { skin: '#eabf98', shirt: c }, color: c }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
  }, [name, id, color, SAVE]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.worldInfo && !!window.SF.game, null, { timeout: 20000 });
  await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
  active.add(page);
  return { name, context, page };
}
async function until(fn, ms = 20000, step = 250) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}
const E = (p, fn, arg) => p.page.evaluate(fn, arg);
const dbg = (p, expr) => p.page.evaluate(`(() => { const d = window.SF.scene._debug; return (${expr}); })()`);
const tryck = async (p, x, y) => { await E(p, ([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [x, y]); await sleep(60); };

// ---------- 1. båda i världen, var sitt Dockskåp; inbjudan ----------
const M = await player('Mira', 'av-mira', '#e04848'), L = await player('Leo', 'av-leo', '#2d7ff9');
const ihop = await until(async () => (await E(M, () => window.SF.worldInfo().open && window.SF.worldInfo().online >= 2)) && (await E(L, () => window.SF.worldInfo().open && window.SF.worldInfo().online >= 2)), 40000);
ok(ihop, `Mira och Leo är i samma värld (${WORLD})`);
for (const p of [M, L]) {
  await E(p, () => window.SF.openDockskap());
  await p.page.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
  await sleep(400);
}
const leoId = await dbg(L, 'd.myId()'), miraId = await dbg(M, 'd.myId()');
ok(!!leoId && !!miraId && leoId !== miraId, `båda har spelar-id (Mira ${String(miraId).slice(0, 6)}…, Leo ${String(leoId).slice(0, 6)}…)`);
await dbg(M, "d.setLage('bygga')");
ok(await dbg(M, "d.place('piano', 0, 300, 200)") && !(await dbg(L, "d.deco(0).some((d) => d.k === 'piano')")), 'Mira ställer ut ett piano – Leo har inget piano hemma');
ok(await dbg(M, `d.bjudIn('${leoId}', 'Leo')`), 'Mira bjuder in Leo (👫)');
const rutan = await until(() => E(L, () => !document.getElementById('modal').classList.contains('hidden') && /Leka ihop/.test(document.querySelector('#modal h2')?.textContent || '')));
ok(rutan && await E(L, () => /Mira/.test(document.querySelector('#modal')?.textContent || '')), 'Leo får rutan "👫 Leka ihop?" med Miras namn');
await L.page.click('#modal .dlg-foot .btn:has-text("Kom!")');
const gast = await until(async () => { const nv = await dbg(L, 'd.natv()'); return nv?.roll === 'gast' && nv.hus === true; });
ok(gast, 'Leo är gäst hos Mira och har fått huset');
ok(await until(() => dbg(L, "d.deco(0).some((d) => d.k === 'piano')"), 5000), 'Leo ser Miras piano');
ok(await E(L, () => !JSON.parse(localStorage.getItem('snabbfilen_dockskap') || '{}').rooms?.[0]?.deco?.some((d) => d.k === 'piano')), 'Leos egen sparfil är orörd (inget piano där)');
ok(await until(async () => (await dbg(M, 'd.natv()'))?.gaster?.length === 1), 'Mira ser en gäst i huset');
ok(await until(() => E(M, () => /Leo/.test(document.querySelector('#dock-lage [data-vanner]')?.textContent || '') || /1/.test(document.querySelector('#dock-lage [data-vanner]')?.textContent || ''))), 'Miras 👫-knapp visar gästen');

// ---------- 2. trycken och ändringarna går åt båda hållen ----------
await dbg(M, "d.setLage('leka')"); await dbg(M, 'd.goRoom(0)'); await dbg(L, 'd.goRoom(0)');
const iP = await dbg(M, "d.findDeco(0, 'piano')"), spP = await dbg(M, `d.spot(0, ${iP})`);
await tryck(M, spP.x, spP.y);
ok(await until(async () => /^piano:/.test((await dbg(L, 'd.senaste()'))?.k || ''), 6000), 'Mira trycker på pianot – Leo ser samma reaktion (melodi, noter)');
const iL = await dbg(L, "d.findDeco(0, 'lampa')"), spL = await dbg(L, `d.spot(0, ${iL})`);
await dbg(L, "d.setLage('leka')");
await tryck(L, spL.x, spL.y);
const iLM = await dbg(M, "d.findDeco(0, 'lampa')");
ok(await dbg(L, `d.lit(0, ${iL})`) === true && await until(() => dbg(M, `d.lit(0, ${iLM})`), 6000), 'Leo tänder lampan – tänd hos Mira också');
ok(await dbg(L, "d.placeDoll('bot3', 0, 200, 200)") && await until(() => dbg(M, "d.dolls().some((d) => d.id === 'bot3')"), 6000), 'Leo ställer in en figur – Mira ser den');
await E(L, () => { window.SF.scene.down(120, 150); });
await sleep(150);
await E(L, () => { window.SF.scene.move(140, 160); window.SF.scene.move(160, 170); });
const hand = await until(async () => { const pk = await dbg(M, 'd.pek()'); return pk.length === 1 && pk[0].namn === 'Leo' ? pk[0] : false; }, 6000);
await E(L, () => window.SF.scene.up(160, 170));
ok(!!hand, `Leos hand syns hos Mira (${hand ? `rum ${hand.room}, ${hand.x}, ${hand.y}` : 'saknas'})`);
await M.page.click('#dock-lage [data-natt2]');
ok(await until(() => dbg(L, 'd.natt()'), 6000), 'Mira slår på natten – natt hos Leo');

// ---------- 3. Leo går hem ----------
await dbg(L, 'd.gaHem()');
await sleep(300);
ok((await dbg(L, 'd.natv()')) === null && !(await dbg(L, "d.deco(0).some((d) => d.k === 'piano')")) && !(await dbg(L, 'd.natt()')), 'Leo är hemma igen: sitt eget hus, inget piano, dag');
ok(await until(async () => (await dbg(M, 'd.natv()'))?.gaster?.length === 0), 'Mira ser att Leo gick hem');
ok(await dbg(M, "d.deco(0).some((d) => d.k === 'piano')") && await dbg(M, 'd.natt()'), 'Miras hus är som hon lämnade det (piano, natt)');
for (const p of [M, L]) await E(p, () => window.SF.leaveDockskap());

clearInterval(activity);
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await browser.close(); console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT'); process.exit(fails ? 1 : 0);
