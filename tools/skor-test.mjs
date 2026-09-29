// Skobutiken (js/scenes/shop-skor.js, scen 'skor'): alla katalogens skor står i butiken, allt
// går att nå från dörren, man kan klicka på en sko, prova den på sin figur och köpa den (och ta
// på den), för lite pengar = inget köp, REA sänker priset, provhörnan visar alla skor,
// skoputsen blankar skorna, dörren leder ut – och köpet finns kvar efter omladdning. På mobilen
// (NÄRA-läget, bilden beskärs upp- och nertill) följer kameran i höjdled: alla väggarnas skor syns
// när man står vid dem och de översta raderna går att trycka på.
// Kör: node tools/skor-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const info = (m) => console.log('info: ' + m);
const WORLD = `sk${Date.now().toString(36)}`;
const START = 3000;
await page.goto(`http://localhost:${PORT}/index.html?world=${WORLD}`);
await page.evaluate((money) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Skotest', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c', shoes: '#1c1c1c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 12 * 60, money, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [] }));
}, START);
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
const closeDlg = () => page.evaluate(() => document.querySelector('#modal:not(.hidden) [data-close]')?.click());
const dlgTitle = () => page.evaluate(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
const D = (fn, arg) => page.evaluate(([fn, arg]) => window.SF.scene._debug[fn](...(arg ?? [])), [fn, arg]);

// ---- in i butiken: genom stadens dörr om stadsdelen kopplat in huset, annars direkt ----
const hus = await page.evaluate(async () => { const m = await import('./js/city/map.js'); const b = (m.ALL_BUILDINGS || []).find((x) => x.id === 'skor'); return b ? { sign: b.sign, enter: b.enter || null } : null; });
if (hus?.enter === 'skor') {
  await page.evaluate(() => { const A = window.SF; A.game.min = 12 * 60; A.go('city'); A.scene._debug.enter('skor'); });
  let inne = false;
  for (let i = 0; i < 80 && !inne; i++) { await page.waitForTimeout(250); inne = await page.evaluate(() => window.SF.sceneName === 'skor'); }
  ok(inne, `dörren i staden (${hus.sign}) leder in i skobutiken`);
} else {
  info(hus ? `huset ${hus.sign} står i staden men har ingen enter:'skor' än – stadsdelen kopplar dörren` : 'huset skor finns inte i kartan än');
  const r = await page.evaluate(() => { try { window.SF.go('skor'); return window.SF.sceneName; } catch (e) { return 'fel: ' + e.message; } });
  ok(r === 'skor', `scenen 'skor' går att öppna (${r})`);
}
// håll klockan på dagtid under testet
await page.evaluate(() => { const S = window.SF; const keep = () => { if (S.game && !window.__fri) S.game.min = 12 * 60; requestAnimationFrame(keep); }; keep(); });
await page.waitForTimeout(400);

// ---- sortimentet ----
const cat = await page.evaluate(async () => { const w = await import('./js/data/wardrobe.js'); return w.itemsForSlot('shoes').filter((it) => !it.free).map((it) => ({ id: it.id, price: it.price })); });
const items = await D('items');
const missing = cat.filter((c) => !items.some((i) => i.id === c.id));
const pairs = items.reduce((n, i) => n + i.shoes.length, 0);
ok(cat.length >= 20 && !missing.length, `alla ${cat.length} skor i katalogen står i butiken, ${pairs} skor på hyllorna (${missing.map((m) => m.id).join(', ') || 'inga saknas'})`);
const fotboll = items.find((i) => i.model === 'cleats');
ok(fotboll && fotboll.shoes.length === 5, `fotbollsskorna finns i fem färger (${fotboll?.shoes.length})`);
ok(items.every((i) => i.shoes.every((s) => s.x >= 0 && s.x + s.w <= 640 && s.y - s.h >= 0 && s.y <= 216)), 'alla skor står inne i butiken');
// prislapparna får inte krocka med varandra
const tagBoxes = items.map((i) => ({ id: i.id, x0: i.tag.x - 13, x1: i.tag.x + 13, y0: i.tag.y - 1, y1: i.tag.y + 8 }));
const krock = [];
for (let a = 0; a < tagBoxes.length; a++) for (let b = a + 1; b < tagBoxes.length; b++) {
  const A = tagBoxes[a], B = tagBoxes[b];
  if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1) krock.push(A.id + '/' + B.id);
}
ok(!krock.length, `prislapparna krockar inte (${krock.join(', ') || 'inga krockar'})`);

// ---- allt går att nå från dörren ----
const spots = await D('spots');
const bort = [];
for (const s of spots) if (s.id !== 'barn' && !(await D('canReach', [s.id]))) bort.push(s.id);
ok(!bort.length, `alla ${spots.length} platser går att gå till från dörren (${bort.join(', ') || 'alla nås'})`);

// ---- klicka på kängorna → figuren går dit → köpdialogen → köp och ta på ----
const kanga = items.find((i) => i.model === 'boots');
const p = await D('spot', ['g-boots']);
await page.evaluate((p) => window.SF.scene.down(p.x, p.y), p);
let t0 = '';
for (let i = 0; i < 40 && !t0.includes('Kängor'); i++) { await page.waitForTimeout(250); t0 = await dlgTitle(); }
ok(t0.includes('Kängor'), `klick på kängorna öppnar köpdialogen när figuren kommit fram ("${t0.trim()}")`);
const fore = await page.evaluate(() => window.SF.game.money);
await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go')?.click());
await page.waitForTimeout(300);
const efter = await page.evaluate(() => ({ money: window.SF.game.money, shoe: window.SF.avatar.look.shoeType, shoes: window.SF.avatar.look.shoes }));
const agerK = await D('owns', ['shoes-boots']);
ok(agerK && fore - efter.money === kanga.price, `köpte kängorna (${fore} → ${efter.money} kr, pris ${kanga.price})`);
ok(efter.shoe === 'boots', `figuren har kängorna på sig direkt (${efter.shoe}, ${efter.shoes})`);
const st = await D('state');
ok(st.box && /tack/i.test(st.say.clerk || ''), `kassörskan tackar och man bär kartongen ("${st.say.clerk}")`);
const igen = await D('buy', ['shoes-boots']);
ok(!igen.ok && (await page.evaluate(() => window.SF.game.money)) === efter.money, 'samma par går inte att köpa två gånger');
await D('open', ['shoes-boots']);
await page.waitForTimeout(200);
const agdKnapp = await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go')?.textContent || '');
ok(/Ta på mig/.test(agdKnapp), `ägda skor visar "Ta på mig dem" i stället för köp (${agdKnapp.trim()})`);
await closeDlg();

// ---- veckans sko: klick på podiet öppnar just den skon ----
const vecka = (await D('state')).vecka;
const vp = await D('spot', ['veckans']);
await page.evaluate((p) => window.SF.scene.down(p.x, p.y), vp);
let tv = '';
const vName = await page.evaluate(async (id) => (await import('./js/data/wardrobe.js')).itemById(id)?.name.replace(/­/g, ''), vecka);
for (let i = 0; i < 40 && !tv.includes(vName); i++) { await page.waitForTimeout(250); tv = await dlgTitle(); }
ok(!!vecka && tv.includes(vName), `VECKANS SKO-podiet öppnar veckans sko (${vecka} → "${tv.trim()}")`);
await closeDlg();

// ---- färgen man klickar på följer med in i dialogen ----
await D('open', ['shoes-cleats', 2]);
await page.waitForTimeout(200);
const vald = await page.evaluate(() => document.querySelector('#modal [data-c].on')?.dataset.c);
ok(vald === '#ff5fa8', `klick på de rosa fotbollsskorna provar dem i rosa (${vald})`);
await closeDlg();

// ---- för lite pengar ----
const kvarPengar = await page.evaluate(() => window.SF.game.money);
await page.evaluate(() => { window.SF.game.money = 50; });
const fattig = await D('buy', ['shoes-cowboyBoots']);
const st2 = await D('state');
ok(!fattig.ok && st2.money === 50 && !(await D('owns', ['shoes-cowboyBoots'])), `för lite pengar = inget köp (${fattig.msg || ''})`);
ok(!!st2.say.clerk, `kassörskan säger vad de kostar ("${st2.say.clerk}")`);
await D('open', ['shoes-cowboyBoots']);
await page.waitForTimeout(200);
const av = await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go')?.disabled);
ok(av === true, 'köpknappen är avstängd när pengarna inte räcker');
await closeDlg();
await page.evaluate((m) => { window.SF.game.money = m; }, kvarPengar);

// ---- REA ----
await page.evaluate(() => { window.SF.game.event = { id: 'rea' }; });
const rea = (await D('items')).find((i) => i.model === 'sneakers');
ok(rea.price === Math.round(499 * 0.75), `REA-dag: sneakers kostar ${rea.price} kr i stället för 499`);
await page.evaluate(() => { window.SF.game.event = null; });

// ---- provhörnan ----
await D('sit');
await page.waitForTimeout(300);
const prov = await page.evaluate(() => ({ title: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '', n: document.querySelectorAll('#modal .skk-it').length }));
ok(/Provhörnan/.test(prov.title) && prov.n === items.length, `provpallen öppnar provhörnan med alla ${prov.n} skomodeller`);
ok((await D('state')).mode === 'bench', 'figuren sitter på provpallen');
await page.evaluate(() => [...document.querySelectorAll('#modal .skk-it')].find((b) => /Blink/.test(b.textContent))?.click());
await page.waitForTimeout(200);
const t1 = await dlgTitle();
ok(t1.includes('Blinkskor'), `klick i provhörnan öppnar skon ("${t1.trim()}")`);
await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Alla skor/.test(b.textContent))?.click());
await page.waitForTimeout(200);
ok(/Provhörnan/.test(await dlgTitle()), '"Alla skor" går tillbaka till provhörnan');
await closeDlg();

// ---- skoputsen ----
await D('shine');
await D('tick', [4]);
const sh = await D('state');
ok(sh.mode === 'shine' && sh.shine === 'done' && sh.shiny, `skoputsaren borstar skorna blanka (${sh.shine}, "${sh.say.shiner}")`);
await D('teleport', [300, 150]);
ok((await D('state')).mode === 'free', 'man kliver ner ur putsstolen');

// ---- dörren ----
const dp = await D('spot', ['dorr']);
await page.evaluate((p) => window.SF.scene.down(p.x, p.y), dp);
let ute = false;
for (let i = 0; i < 40 && !ute; i++) { await page.waitForTimeout(250); ute = await page.evaluate(() => window.SF.sceneName === 'city'); }
ok(ute, 'dörren leder ut till staden');

// ---- omladdning: köpet finns kvar (kräver katalogköpen i game.js) ----
await page.evaluate(() => window.SF.game.save());
const harApi = await page.evaluate(() => typeof window.SF.game.buyItem === 'function' && typeof window.SF.game.ownsItem === 'function');
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(500);
const kvar = await page.evaluate(() => { const g = window.SF.game; return { money: g.money, owns: typeof g.ownsItem === 'function' ? g.ownsItem('shoes-boots') : (g.wardrobe || []).includes('shoes-boots') }; });
ok(kvar.money === START - kanga.price, `pengarna är dragna även efter omladdning (${kvar.money} kr)`);
if (harApi) ok(kvar.owns, 'kängorna finns kvar i garderoben efter omladdning');
else info(`game.js saknar ownsItem/buyItem (före integrationen) – kängorna ${kvar.owns ? 'finns' : 'finns inte'} i g.wardrobe efter omladdning`);

// ---- bred skärm (mobilfyllning): butiken visar mer, inga fel ----
const wide = await browser.newPage({ viewport: { width: 1700, height: 760 } });
wide.on('pageerror', (e) => errs.push('bred: ' + e.message));
await wide.goto(`http://localhost:${PORT}/index.html?world=${WORLD}w&mobfill=1`);
await wide.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await wide.waitForTimeout(600);
await wide.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await wide.evaluate(() => { window.SF.go('skor'); });
await wide.waitForTimeout(500);
const bred = await wide.evaluate(() => window.SF.scene._debug.state());
ok(bred.vw > 384, `bred skärm visar mer av butiken (vy ${bred.vw} px)`);

// ---- mobilen i NÄRA-läget: bilden beskärs upp- och nertill → kameran följer i höjdled ----
// (granskningen: sneakersväggens översta hyllrad och de fina skornas översta rad syntes inte)
const [MW, MH] = (process.env.MOBIL || '812x375').split('x').map(Number); // t.ex. MOBIL=915x412
const mctx = await browser.newContext({ viewport: { width: MW, height: MH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const mob = await mctx.newPage();
mob.on('pageerror', (e) => errs.push('mobil: ' + e.message));
await mob.goto(`http://localhost:${PORT}/index.html?world=${WORLD}m&mobfill=1`);
await mob.evaluate((money) => {
  localStorage.setItem('snabbfilen_zoom', 'nara');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobiltest', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c', shoes: '#1c1c1c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 12 * 60, money, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [] }));
}, START);
await mob.reload();
await mob.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await mob.waitForTimeout(700);
await mob.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await mob.evaluate(() => { const S = window.SF; S.go('skor'); const keep = () => { if (S.game) S.game.min = 12 * 60; requestAnimationFrame(keep); }; keep(); });
await mob.waitForTimeout(700);
const MD = (fn, arg) => mob.evaluate(([fn, arg]) => window.SF.scene._debug[fn](...(arg ?? [])), [fn, arg]);
const band0 = await MD('camY');
if (band0.top < 20) info(`mobilens NÄRA-läge beskär inte här (synligt ${band0.top}–${band0.low}) – höjdkameran provas inte`);
else {
  info(`mobilen NÄRA ${MW}×${MH}: synliga rader ${band0.top}–${band0.low} av 216 (${band0.vh} rader)`);
  const mItems = await MD('items'), mSpots = await MD('spots');
  const seen = [];
  // stå vid varje hylla på väggarna: hela gruppen (skor + prislapp) ska synas – även de översta raderna
  for (const it of mItems.filter((i) => ['A', 'B', 'C'].includes(i.where))) {
    const sp = mSpots.find((s) => s.id === it.spot);
    await MD('teleport', [sp.go[0], sp.go[1]]);
    await mob.waitForTimeout(60);
    const cy = await MD('camY'), cx = await MD('cam');
    const y0 = Math.min(...it.shoes.map((s) => s.y - s.h + 1)) + cy.dy, y1 = it.tag.y + 8 + cy.dy;
    const x0 = Math.min(...it.shoes.map((s) => s.x)) - cx, x1 = Math.max(...it.shoes.map((s) => s.x + s.w)) - cx;
    if (!(y0 >= cy.top && y1 <= cy.low && x0 >= 0 && x1 <= 384)) seen.push(`${it.model} (rad ${y0}–${y1}, synligt ${cy.top}–${cy.low})`);
  }
  ok(!seen.length, `mobilen: alla väggarnas skor syns när man står vid dem (${seen.join(', ') || 'alla i bild'})`);
  // översta raderna: tryck (touch) på skon där den syns på skärmen → köpdialogen
  for (const [id, namn] of [['g-sneakers', 'Sneakers'], ['g-heels', 'Klackskor'], ['g-ridingBoots', 'Ridstövlar']]) {
    const it = mItems.find((i) => i.spot === id), sp = mSpots.find((s) => s.id === id);
    await MD('teleport', [sp.go[0], sp.go[1] + 14]);
    await mob.waitForTimeout(900);
    const cy = await MD('camY'), cx = await MD('cam');
    const s0 = it.shoes[0], wx = s0.x + s0.w / 2, wy = s0.y - s0.h / 2;
    const tap = await mob.evaluate(([sx, sy]) => {
      const cv = document.querySelector('#scene'), r = cv.getBoundingClientRect(), A = window.SF;
      const lw = cv.width / A.pxs, lh = cv.height / A.pxs;
      const x = r.left + (sx + A.view.boxX) / lw * r.width, y = r.top + (sy + A.view.boxY) / lh * r.height;
      const hit = document.elementFromPoint(x, y);
      return { x, y, onCanvas: hit === cv };
    }, [wx - cx, wy + cy.dy]);
    const syns = tap.onCanvas && tap.y >= 0 && tap.y <= MH;
    if (syns) await mob.touchscreen.tap(tap.x, tap.y);
    let tt = '';
    for (let i = 0; i < 40 && syns && !tt.includes(namn); i++) { await mob.waitForTimeout(200); tt = await mob.evaluate(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '').replace(/­/g, '')); }
    ok(syns && tt.includes(namn), `mobilen: översta raden – ${namn} syns (skärm-y ${Math.round(tap.y)} px) och ett tryck öppnar köpdialogen ("${tt.trim()}")`);
    await mob.evaluate(() => document.querySelector('#modal:not(.hidden) [data-close]')?.click());
    await mob.waitForTimeout(200);
  }
  // längst fram: jätteskons podie och figurens fötter syns också
  const vs = mSpots.find((s) => s.id === 'veckans');
  await MD('teleport', [vs.go[0], vs.go[1]]);
  await mob.waitForTimeout(300);
  const cyF = await MD('camY');
  ok(206 + cyF.dy <= cyF.low && vs.go[1] + cyF.dy <= cyF.low, `mobilen: längst fram syns golvet ända ner (podiets fot på rad ${206 + cyF.dy}, synligt till ${cyF.low})`);
  await MD('teleport', [254, 102]);
  await mob.waitForTimeout(300);
  const cyD = await MD('camY');
  ok(cyD.wy <= 2 && 12 + cyD.dy >= cyD.top - 1, `mobilen: vid dörren syns skyltarna upptill (översta raden ${cyD.wy}, skylten på rad ${12 + cyD.dy})`);
}
await mctx.close();

// datorn (bred skärm, ingen beskärning) → höjdkameran står still
const cyPc = await wide.evaluate(() => window.SF.scene._debug.camY());
ok(cyPc.dy === 0 && cyPc.vh === 216, `datorn: hela höjden syns, ingen höjdförskjutning (dy ${cyPc.dy}, ${cyPc.vh} rader)`);

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
