// ⚽ MATCHDAGEN (js/scenes/matchdag.js + js/arenan/match.js, Arenan steg 2):
//   1. biljettluckan på Arenatorget: stängd på kvällen; på dagen KBK – dagens motståndare för 30 kr → läktaren
//   2. Kjells rop: rätt knapp höjer stämningen, fel sänker den, för sent sänker den
//   3. anfallen: med full stämning gör KBK mål; målskytten är en KBK-spelare
//   4. halvtid: korven kostar 25 kr; andra halvlek startar av sig själv
//   5. slutsignalen: resultatet, lycka, och man står på Arenatorget igen vid arenans dörr
//   6. inga fel i sidan
//   node tools/matchdag-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
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
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=match${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Match', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 15 * 60, money: 300, hunger: 40, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.evaluate(() => { window.__toasts = []; const T = document.querySelector('#toasts'); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push(n.textContent)))).observe(T, { childList: true }); });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const toasts = () => D(() => window.__toasts.splice(0));
const klickGo = () => D(() => { const b = document.querySelector('#modal:not(.hidden) .btn-go'); if (!b) return false; b.click(); return true; });
const state = () => D(() => SF.scene._debug.state());
const money = () => D(() => SF.game.money);
await stang(); await D(() => { SF.arenaFran = { buss: 'pixeltorget' }; SF.go('arenan'); });
await p.waitForFunction(() => window.SF.sceneName === 'arenan' && !!window.SF.scene?._debug?.lage, null, { timeout: 15000 });
await sleep(1200); await stang();

// 1. biljettluckan
await D(() => { SF.game.min = 21 * 60; }); await D(() => SF.scene._debug.act('biljett')); await sleep(300);
ok((await toasts()).some((t) => /Biljettluckan är stängd/.test(t)), 'på kvällen är biljettluckan stängd');
await D(() => { SF.game.min = 15 * 60; }); await D(() => SF.scene._debug.act('biljett')); await sleep(300);
const md = await modal();
ok(/Biljettluckan/.test(md) && /KBK – Pixelbergs IF/.test(md) && /30 kr/.test(md), `biljetten: KBK – Pixelbergs IF för 30 kr (${md.slice(0, 60)}…)`);
const m0 = await money();
await klickGo();
const kom = await p.waitForFunction(() => window.SF.sceneName === 'matchdag' && !!window.SF.scene?._debug?.state, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(600);
let st = await state();
ok(kom && (await money()) === m0 - 30 && st.halv === 1 && st.S.kbk === 0 && st.S.gast === 0 && st.motst === 'PIF', `på läktaren: 0–0 mot PIF, 30 kr dragna (${JSON.stringify(st)})`);

// 2. Kjells rop
await D(() => SF.scene._debug.stamning(50));
await D(() => SF.scene._debug.force('heja'));
const s1 = await D(() => SF.scene._debug.press('heja'));
ok(s1 === 60 && (await state()).streak === 1, `rätt rop: stämningen 50 → ${s1}, 1 i rad`);
await D(() => SF.scene._debug.force('klappa'));
const s2 = await D(() => SF.scene._debug.press('sjung'));
ok(s2 === 54 && (await state()).streak === 0, `fel rop: stämningen 60 → ${s2}, raden bruten`);
await D(() => { SF.scene._debug.stamning(50); SF.scene._debug.force('vagen'); SF.scene._debug.tick(3.2); });
st = await state();
ok(st.cue === null && st.stamning < 46, `för sent: ropet försvinner och stämningen sjunker (${st.stamning})`);
await D(() => SF.scene._debug.force('vagen')); await D(() => SF.scene._debug.press('vagen')); await D(() => SF.scene._debug.tick(0.5)); await sleep(300);
ok((await state()).streak === 1, 'VÅGEN går runt läktaren');

// 3. anfallen
let mal = 0;
for (let k = 0; k < 12 && !mal; k++) { await D(() => { SF.scene._debug.stamning(100); SF.scene._debug.anfall('kbk'); SF.scene._debug.tick(0.3); }); mal = (await state()).S.kbk; }
ok(mal >= 1, `med full stämning gör KBK mål (${mal} efter försöken)`);
const sk = await D(() => SF.scene._debug.skyttar());
ok(sk.length >= 1 && sk.every((n) => typeof n === 'string' && n.length > 1), `målskytten är en KBK-spelare (${sk.join(', ')})`);
await D(() => { SF.scene._debug.stamning(100); SF.scene._debug.anfall('gast'); SF.scene._debug.tick(1.5); });
ok((await state()).anfall === null, 'bortalagets anfall avgörs och blåses av');

// 4. halvtid
await D(() => { SF.scene._debug.hoppa(45); SF.scene._debug.tick(0.1); });
st = await state();
ok(st.paus > 0 && st.halv === 1 && st.cue === null, `halvtid efter 45 minuter (paus ${st.paus} s)`);
const m1 = await money();
await D(() => SF.scene._debug.korv());
ok((await money()) === m1 - 25 && (await state()).korv === true, 'korven i pausen kostar 25 kr');
await D(() => SF.scene._debug.korv());
ok((await money()) === m1 - 25, 'bara en korv');
await D(() => SF.scene._debug.tick(7));
st = await state();
ok(st.halv === 2 && st.paus <= 0 && st.minut >= 45, `andra halvlek startar av sig själv (minut ${st.minut})`);

// 5. slutsignalen
await D(() => { SF.scene._debug.hoppa(45); SF.scene._debug.tick(0.1); });
st = await state();
ok(st.done === true && st.minut === 90, `slutsignal vid 90' (${JSON.stringify(st.S)})`);
await sleep(600);
ok((await toasts()).some((t) => /KBK VANN|Oavgjort|Förlust/.test(t)), 'resultatet berättas');
await D(() => SF.scene._debug.tick(3.2));
const ute = await p.waitForFunction(() => window.SF.sceneName === 'arenan' && !!window.SF.scene?._debug?.pos, null, { timeout: 10000 }).then(() => true).catch(() => false);
await sleep(800);
const pos = ute ? await D(() => SF.scene._debug.pos()) : { x: 0, y: 0 };
ok(ute && Math.abs(pos.x - 700) < 40 && pos.y > 196 && pos.y < 240, `tillbaka på Arenatorget vid arenans dörr (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
await stang();

ok(errs.length === 0, errs.length ? 'fel i sidan: ' + errs.slice(0, 3).join(' | ') : 'inga fel i sidan');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
