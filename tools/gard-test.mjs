// Funktionstest av BONDGÅRDEN (game.js HOMES 'gard', GARDSDJUR, fodra/samlaAgg/mjolka/klippa/kopDjur/saljGard,
// room.js PLANS.gard + utsikten 'landet', js/scenes/landet.js gården/ladugården/gårdsbutiken, week.js):
//   1. Gården i landet är till salu (insats 16 000) – köp → bonde, djuren ingår
//   2. hemma på gården: fyra rum med lantkök, spis och receptbok; ytterdörren leder ut i landet
//   3. ladugården: fodra djuren (kostar efter antalet), köp fler djur
//   4. hönsen → ägg, korna → mjölk (till skafferiet), fåren → ull (en gång i veckan)
//   5. hungriga djur ger inget och tär på lyckan; morgonrutan påminner
//   6. gårdsbutiken: sälj ägg, mjölk och ull
//   node tools/gard-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'gard') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 10 * 60, money: 30000, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, lycka: 60 };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=gd${Date.now().toString(36)}`);
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Bonden', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, SAVE);
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
const toasts = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '));
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
const djurAntal = () => D(() => { const c = {}; for (const d of SF.scene._debug.djur()) c[d.sort] = (c[d.sort] || 0) + 1; return c; });

// ---------- 1. köpa gården ----------
await D(() => { SF.landetFran = { y: 200 }; SF.go('landet'); }); await sleep(1800);
await D(() => SF.scene._debug.act('gard')); await sleep(200);
ok(/Gården till salu/.test(await title()) && /16\s000\skr/.test(await text()), 'gården till salu: insats 16 000 kr');
const m0 = await D(() => SF.game.money);
await clickBtn(/Köp gården/); await sleep(300);
ok((await D(() => SF.game.home)) === 'gard' && (await D(() => SF.game.money)) === m0 - 16000, 'köpt – man bor på Gården');
const B0 = await D(() => SF.game.bonde);
ok(B0 && B0.djur.hona === 6 && B0.djur.ko === 2 && B0.djur.far === 4, 'djuren ingår: 6 höns, 2 kor, 4 får');
const da = await djurAntal();
ok(da.hona === 6 && da.ko === 2 && da.far === 4, `i hagarna står ens egna djur (${JSON.stringify(da)})`);
ok(/du är bonde/.test(await toasts()), 'besked: du är bonde!');
// ---------- 2. hemma ----------
await D(() => SF.scene._debug.act('gard'));
ok(await until(() => SF.sceneName === 'room', 8000), 'dörren: HEM – in på gården');
await sleep(800);
const rum = await D(() => SF.scene._debug.apt?.().rooms.map((r) => r.name).join(','));
ok(rum === 'VARDAGSRUM,SOVRUM,LANTKÖK,BADRUM', `fyra rum (${rum})`);
await shot('01-hemma');
const funk = await D(() => { const out = []; for (let i = 0; i < 4; i++) for (const q of SF.scene._debug.room(i).props()) if (q.fn) out.push(q.fn); return out; });
ok(['sova', 'garderob', 'ata', 'laga', 'recept', 'toalett', 'tvatta'].every((f) => funk.includes(f)), `säng, garderob, kylskåp, spis, receptbok, toalett och badkar (${[...new Set(funk)].join(',')})`);
const fit = await D(() => [0, 1, 2, 3].every((i) => SF.scene._debug.room(i).allFit()));
ok(fit, 'alla startmöbler står rätt i alla rum');
await D(() => { const s = SF.scene._debug.spot('dorr'); SF.scene.down(s.x, s.y); });
ok(await until(() => SF.sceneName === 'landet', 10000), 'ytterdörren leder ut på gårdsplanen i landet');
await sleep(1200);
const pos = await D(() => SF.scene._debug.pos());
ok(Math.abs(pos.x - 769) < 20 && pos.y > 186 && pos.y < 210, `man står vid gårdens dörr (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
// ---------- 5. hungriga djur ----------
await D(() => { SF.game.bonde.fodrad = SF.game.day - 2; });
let r = await D(() => SF.game.samlaAgg());
ok(!r.ok && /hungriga/.test(r.msg), 'hungriga höns värper inte');
// ---------- 3. ladugården ----------
await D(() => SF.scene._debug.act('lada')); await sleep(200);
ok(/Ladugården/.test(await title()) && /hungriga/.test(await text()), 'ladugården: djuren är hungriga');
const kost = await D(() => SF.game.fodderKostnad());
ok(kost === 6 * 1 + 2 * 8 + 4 * 3, `fodret kostar efter antalet djur (${kost} kr)`);
const m1 = await D(() => SF.game.money);
await clickBtn(/Fodra djuren/); await sleep(200);
ok((await D(() => SF.game.bonde.fodrad)) === (await D(() => SF.game.day)) && (await D(() => SF.game.money)) === m1 - kost, 'fodrade – djuren är mätta');
await D(() => document.querySelector('#modal [data-kop="ko"]').click()); await sleep(300);
ok((await D(() => SF.game.bonde.djur.ko)) === 3, 'köpte en ko');
ok(await until(() => SF.scene._debug.djur().filter((d) => d.sort === 'ko').length === 3, 3000), 'den nya kon springer ut i hagen');
await closeDlg();
// ---------- 4. ägg, mjölk, ull ----------
await D(() => SF.scene._debug.teleport(1170, 196)); await sleep(300);
await D(() => { const d = SF.scene._debug.djurSkarm('hona'); SF.scene.down(d.x, d.y); });
ok(await until(() => (SF.game.skafferi.agg | 0) === 6, 10000), 'klick på en höna: 6 ägg till skafferiet');
r = await D(() => SF.game.samlaAgg());
ok(!r.ok && /redan samlat/.test(r.msg), 'en gång om dagen');
r = await D(() => SF.game.mjolka());
ok(r.ok && (await D(() => SF.game.skafferi.mjolk)) === 9, 'mjölkade 3 kor: 9 liter');
r = await D(() => SF.game.klippa());
ok(r.ok && (await D(() => SF.game.bonde.ull)) === 8, 'klippte 4 får: 8 kg ull');
r = await D(() => SF.game.klippa());
ok(!r.ok && /om 7 dagar/.test(r.msg), 'ullen växer en vecka');
await D(() => SF.scene._debug.teleport(880, 200)); await sleep(600); await shot('02-garden-agd');
// ---------- 6. gårdsbutiken ----------
await D(() => SF.scene._debug.act('butik')); await sleep(200);
ok(/Gårdsbutiken/.test(await title()), 'gårdsbutiken öppnar');
const m2 = await D(() => SF.game.money);
await D(() => document.querySelectorAll('#modal [data-salj="ull"]')[1].click()); await sleep(200);
ok((await D(() => SF.game.money)) === m2 + 8 * 50 && (await D(() => SF.game.bonde.ull)) === 0, 'sålde 8 kg ull för 400 kr');
await D(() => document.querySelectorAll('#modal [data-salj="agg"]')[0].click()); await sleep(200);
ok((await D(() => SF.game.skafferi.agg)) === 5, 'sålde ett ägg (5 kvar till köket)');
await closeDlg();
// ---------- 5. morgonen ----------
const natt = await D(() => { const g = SF.game; g.bonde.fodrad = g.day - 1; const l = g.lycka; g.sleep(); return { gladNatt: g.gladNatt.map((x) => x.t) }; });
ok(natt.gladNatt.includes('Hungriga djur'), 'en natt med ofodrade djur tär på lyckan');
await D(async () => { const m = await import('./js/core/week.js'); m.openWeek(SF, { morning: true }); }); await sleep(200);
ok(/Fodra djuren i ladugården/.test(await text()) && /Samla äggen/.test(await text()) && /Mjölka korna/.test(await text()), 'morgonrutan: fodra, samla ägg, mjölka');
await closeDlg();
// sparas
await D(() => SF.game.save());
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await sleep(500);
ok((await D(() => SF.game.home)) === 'gard' && (await D(() => SF.game.bonde.djur.ko)) === 3, 'gården och djuren sparas');

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
