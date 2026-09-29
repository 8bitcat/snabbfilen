// Regressionstest för PANTBANKEN (js/scenes/shop-pantbank.js + g.pant i game.js) och
// SKRAPLOTTERNA i närbutiken (js/scenes/skraplott.js + lotter-stället i shop-narbutik.js).
//   Pantbanken: sälja med riktiga klick (halva katalogpriset), startmöbler säljs inte, låna mot
//   pant (40 %, 20 % ränta, 7 dagar), säga nej, gå därifrån mitt i synandet, högst fyra panter,
//   lösa ut (och inte ha råd), sparfilen efter omladdning, förfallna lån efter 7 dagar (sista
//   dagen går bra, dagen efter behåller pantbanken möbeln), stängt efter 18, kunderna som prutar,
//   gitarrerna och papegojan. Dubbelklick på Sälj/Pantsätt får inte avbryta affären, och
//   repliken säger "nästa <veckodag> (dag N)".
//   Skraplotterna: rättvis slump (samma lott = samma utfall, vinstfrekvenserna, tre lika = vinst),
//   köp via stället med riktiga klick, skrapa med musen, pengarna, en halvskrapad lott överlever
//   en omladdning och skrapas klart på vägen ut, dagens följd av lotter stämmer med fröet, tio
//   per dag, ny dag = ny rulle, inte råd. Släpper man musen i ramen (zoomläget RAM) eller
//   avbryts pekningen (pointercancel) slutar lotten skrapa.
// Skärmbilder hamnar i tools/out/smast-pant/test/.
//   node tools/pant-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8746 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'smast-pant', 'test') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const info = (m) => console.log(`info: ${m}`);
const errs = [];

const browser = await chromium.launch();
let page = await browser.newPage({ viewport: { width: 1200, height: 760 } }); // let: sista delen byter till en sida i ram-läget
const watchErrors = (p) => {
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
};
watchErrors(page);
const STORAGE = [{ k: 'soffa', v: 2 }, { k: 'lampa', v: 1 }, { k: 'fiol', v: 0 }, { k: 'sang', v: 0, fx: 1 }, { k: 'tv', v: 1 }];
const SAVE = { v: 1, day: 3, min: 11 * 60, money: 1000, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: STORAGE, deco: {}, won: false };
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=pant${Date.now().toString(36)}`);
await page.evaluate((s) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(600);

const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const G = () => page.evaluate(() => { const g = window.SF.game; return { money: g.money, day: g.day, storage: g.storage.map((s) => ({ ...s })), pant: (g.pant || []).map((p) => ({ ...p })), pantNr: g.pantNr }; });
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1') || 'null'));
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalTitle = () => page.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const modalText = () => page.evaluate(() => document.querySelector('#modal')?.innerText || '');
const clickIn = (sel) => page.evaluate((sel) => { const b = document.querySelector('#modal ' + sel); if (!b || b.disabled) return false; b.click(); return true; }, sel);
const clickBtn = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modal .btn')].find((x) => new RegExp(src).test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const waitFor = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(80); } return false; };
const viewBox = () => page.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
const toClient = (r, x, y) => [r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h];
async function clickView(x, y) { const r = await viewBox(); const [cx, cy] = toClient(r, x, y); await page.mouse.click(cx, cy); }
async function clickSpot(id) {
  const p = await D('spot', id);          // låser kameran över platsen om den ligger utanför bild
  if (!p) throw new Error('ingen plats ' + id);
  await clickView(p.x, p.y);
  await D('lockCam', null);
}
async function shot(name) { await page.waitForTimeout(120); await page.screenshot({ path: OUT + name + '.png' }); }
async function pano(name, scene = 'pantbank') {
  const url = await page.evaluate(() => window.SF.scene._debug.panorama?.(2) || null);
  if (url) fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
}
const hasPatch = await page.evaluate(() => typeof window.SF.game.pawnStorage === 'function');
ok(hasPatch, 'game.js har pantlånet (pawnStorage/redeemPant/pantMorning – patchen pant-game.patch)');

// =====================================================================================
// PANTBANKEN
// =====================================================================================
const canGo = await page.evaluate(() => { try { window.SF.go('pantbank'); return true; } catch (e) { return String(e.message); } });
ok(canGo === true && await page.evaluate(() => window.SF.sceneName) === 'pantbank', `SF.go('pantbank') öppnar pantbanken (${canGo})`);
await page.waitForTimeout(500);
await D('hideNpcs');
await D('fast', 3);
const st0 = await D('state');
ok(st0.open && st0.hours[0] === 10 && st0.hours[1] === 18, `öppet kl. 11 (öppettider ${st0.hours.join('–')})`);
const spots = await D('spots');
ok(['lucka', 'dorr', 'gitarr0', 'papegoja', 'panter', 'klocka', 'tv', 'kassaskap', 'vitrin'].every((s) => spots.includes(s)), 'luckan, dörren, gitarrerna, papegojan, pantlagret, disklockan, tv-hyllan, kassaskåpet och glasskåpet är klickbara');
await pano('01-pantbanken');
await shot('01b-pantbanken-vy');

// ---------- priserna ----------
const pr = await D('prices', 'soffa');
ok(pr.katalog === 800 && pr.salj === 400 && pr.lan === 320 && pr.skuld === 384, `soffa 800 kr: sälj 400, lån 320, tillbaka 384 (${JSON.stringify(pr)})`);
const allOk = await page.evaluate(async () => {
  const { KATALOG } = await import('/js/game.js');
  return KATALOG.every((k) => { const p = window.SF.scene._debug.prices(k.kind); return p.salj === Math.round(k.price / 2) && p.lan === Math.max(1, Math.round(k.price * 0.4)) && p.skuld === Math.ceil(p.lan * 1.2 - 1e-9); });
});
ok(allOk, 'alla möbler i katalogen: sälj = halva priset, lån = 40 %, skuld = lånet + 20 % (uppåt till hel krona)');

// ---------- sälja med riktiga klick ----------
await clickSpot('lucka');
ok(await waitFor(() => /Pantbanken/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 12000), 'klick på luckan → figuren går fram → dialogen 💍 Pantbanken öppnas');
await shot('02-dialog-salj');
const txt1 = await modalText();
ok(/halva katalogpriset/i.test(txt1) && /INGA RETURER/i.test(txt1), 'säljfliken förklarar halva priset och inga returer');
ok(await page.evaluate(() => { const rows = [...document.querySelectorAll('#modal .prow')]; const fx = rows.find((r) => /Startmöbel/.test(r.textContent)); return !!fx && !!fx.querySelector('button[disabled]') && !fx.querySelector('[data-salj]'); }), 'startmöbeln (sängen) går inte att sälja – knappen är avstängd');
ok(await page.evaluate(() => document.querySelectorAll('#modal canvas').length >= 5), 'raderna visar möblernas bilder ur atlasen');
const m0 = (await G()).money;
ok(await clickIn('[data-salj="1"]'), 'klick på Sälj vid lampan');
ok(await waitFor(() => window.SF.scene._debug.state().deal?.phase === 'bud' && /sälja/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 12000), 'lampan läggs på disken, pantlånaren synar den med lupp och bjuder');
ok(/150/.test(await modalText()), 'budet är 150 kr (halva 300)');
await shot('03-bud-salj');
ok(await clickBtn(/Affär/), 'klick på 🤝 Affär');
let g1 = await G();
ok(g1.money === m0 + 150 && !g1.storage.some((s) => s.k === 'lampa'), `sålt: +150 kr (${m0} → ${g1.money}), lampan borta ur förrådet`);
ok((await stored()).money === g1.money, 'försäljningen är sparad');
ok(await waitFor(() => !window.SF.scene._debug.state().deal, 15000), 'pantlånaren hämtar pengar i kassaskåpet, räknar upp sedlarna och är klar');

// ---------- låna mot pant med riktiga klick ----------
await clickSpot('lucka');
ok(await waitFor(() => !!document.querySelector('#modal [data-tab="pant"]'), 12000), 'dialogen öppnas igen');
await clickIn('[data-tab="pant"]');
await page.waitForTimeout(150);
const txt2 = await modalText();
ok(/40 %/.test(txt2) && /20 %/.test(txt2) && /7 dagar/.test(txt2), 'lånefliken förklarar 40 %, 20 % ränta och 7 dagar');
await shot('04-dialog-lana');
const m1 = (await G()).money;
ok(await clickIn('[data-pant="0"]'), 'klick på Pantsätt vid soffan');
ok(await waitFor(() => window.SF.scene._debug.state().deal?.phase === 'bud', 12000), 'pantlånaren synar soffan och erbjuder ett lån');
ok(/384/.test(await modalText()) && /320/.test(await modalText()), 'budet: 320 kr nu, 384 kr tillbaka');
// en vecka bort är samma veckodag som i dag – repliken måste säga "nästa …" och dagnumret
const repl = (await modalText()).match(/«([^»]*)»/)?.[1] || '';
ok(/senast nästa [a-zåäö]+ \(dag 10\)/.test(repl), `pantlånarens replik säger "nästa <veckodag> (dag 10)" («${repl}»)`);
await shot('05-bud-lana');
ok(await clickBtn(/Låna/), 'klick på 🤝 Låna');
let g2 = await G();
const p1 = g2.pant[0];
ok(g2.money === m1 + 320 && !g2.storage.some((s) => s.k === 'soffa'), `lånat: +320 kr, soffan står i pantbanken (${m1} → ${g2.money})`);
ok(p1 && p1.k === 'soffa' && p1.v === 2 && p1.lan === 320 && p1.skuld === 384 && p1.dag === 3 && p1.sista === 10 && p1.nr === 1, `panten: ${JSON.stringify(p1)}`);
ok(JSON.stringify((await stored()).pant) === JSON.stringify(g2.pant) && (await stored()).pantNr === 1, 'panten och kvittonumret är sparade');
ok(await waitFor(() => !window.SF.scene._debug.state().deal, 15000), 'pantlånaren bär soffan till pantlagret');
ok((await D('state')).slots.some(([nr]) => nr === 1), 'soffan har en plats på hyllan PANTER');
await pano('06-soffan-pa-hyllan');

// ---------- säga nej ----------
const g3 = await G();
await D('teleport', 277, 146);
ok(await D('deal', 'pant', g3.storage.findIndex((s) => s.k === 'fiol')), 'ny affär: fiolen');
ok(await waitFor(() => window.SF.scene._debug.state().deal?.phase === 'bud', 12000), 'budet på fiolen');
ok(await clickBtn(/Nej tack/), 'klick på Nej tack');
const g4 = await G();
ok(g4.money === g3.money && g4.storage.some((s) => s.k === 'fiol') && g4.pant.length === 1, 'nej tack: inga pengar, fiolen kvar i förrådet');
ok(await waitFor(() => !window.SF.scene._debug.state().deal, 5000), 'fiolen läggs tillbaka');

// ---------- gå därifrån mitt i synandet ----------
await D('deal', 'salj', g4.storage.findIndex((s) => s.k === 'fiol'));
await page.waitForTimeout(250);
await D('teleport', 60, 180);
ok(await waitFor(() => !window.SF.scene._debug.state().deal, 5000), 'går man iväg medan pantlånaren synar lägger han tillbaka varan');
ok((await G()).storage.some((s) => s.k === 'fiol'), 'fiolen är kvar');
await D('teleport', 277, 146);

// ---------- dubbelklick på Sälj/Pantsätt i dialogen ----------
// första klicket stänger dialogen – det andra får inte landa på golvet och skicka iväg figuren
for (const [tab, attr, namn] of [['salj', 'data-salj', '💰 Sälj'], ['pant', 'data-pant', '🤝 Pantsätt']]) {
  await page.waitForTimeout(400); // klick direkt efter att en dialog stängts spärras i 350 ms
  await clickSpot('lucka');
  ok(await waitFor(() => !!document.querySelector('#modal [data-tab="salj"]'), 12000), `dialogen öppnas (dubbelklick på ${namn})`);
  await clickIn(`[data-tab="${tab}"]`);
  await page.waitForTimeout(150);
  const fi = (await G()).storage.findIndex((s) => s.k === 'fiol');
  const p0 = (await D('state')).pos;
  await page.dblclick(`#modal [${attr}="${fi}"]`);
  await page.waitForTimeout(400);
  const midt = await D('state');
  ok(midt.deal && midt.deal.phase !== 'tillbaka' && Math.hypot(midt.pos.x - p0.x, midt.pos.y - p0.y) < 3 && midt.pos.path === 0,
    `dubbelklick på ${namn}: figuren står kvar vid luckan och affären pågår (${p0.x},${p0.y} → ${midt.pos.x},${midt.pos.y}, ${midt.deal?.phase})`);
  ok(await waitFor(() => window.SF.scene._debug.state().deal?.phase === 'bud', 12000), `… och pantlånaren synar fiolen och bjuder`);
  ok(await clickBtn(/Nej tack/), 'Nej tack');
  ok(await waitFor(() => !window.SF.scene._debug.state().deal, 5000), 'fiolen läggs tillbaka');
}
await page.waitForTimeout(450);
await clickView(200, 190);
ok((await D('state')).pos.path > 0, 'efter spärren (350 ms) går figuren som vanligt när man klickar på golvet');
await D('teleport', 277, 146);

// ---------- högst fyra panter ----------
await page.evaluate(() => { const g = window.SF.game; g.storage.push({ k: 'piano', v: 0 }, { k: 'stol', v: 1 }, { k: 'matta', v: 0 }); g.save(); });
const pw = await page.evaluate(() => { const g = window.SF.game, out = []; for (const k of ['fiol', 'tv', 'piano', 'stol']) out.push(g.pawnStorage(g.storage.findIndex((s) => s.k === k))); return out.map((r) => r.ok); });
ok(pw.join() === 'true,true,true,false', `panter 2–4 går bra, den femte nekas (${pw.join()})`);
ok((await G()).pant.length === 4, 'fyra panter i pantbanken');
await pano('07-fyra-panter');

// ---------- lösa ut ----------
await page.evaluate(() => { window.SF.game.money = 10; });
const rFail = await D('redeem', 1);
ok(!rFail.ok && (await G()).pant.length === 4, 'inte råd att lösa ut (10 kr) → panten står kvar');
await page.evaluate(() => { window.SF.game.money = 1000; });
await clickSpot('lucka');
ok(await waitFor(() => !!document.querySelector('#modal [data-tab="panter"]'), 12000), 'dialogen öppnas');
await clickIn('[data-tab="panter"]');
await page.waitForTimeout(150);
ok(/kvitto nr 1/i.test(await modalText()) && /7 dagar kvar/.test(await modalText()), 'fliken Mina panter visar kvitto nr 1 och 7 dagar kvar');
await shot('08-mina-panter');
ok(await clickIn('[data-losa="1"]'), 'klick på Lös ut vid soffan');
const g5 = await G();
ok(g5.money === 1000 - 384 && g5.storage.some((s) => s.k === 'soffa' && s.v === 2) && !g5.pant.some((p) => p.nr === 1), `utlöst: −384 kr, soffan (samma färg/variant) tillbaka i förrådet`);
ok(await waitFor(() => !window.SF.scene._debug.state().deal, 15000), 'pantlånaren hämtar soffan på hyllan och lämnar över den i luckan');

// ---------- sparfilen efter omladdning ----------
const before = await G();
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(400);
const after = await G();
const norm = (list) => JSON.stringify(list.map((p) => Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)))));
ok(norm(after.pant) === norm(before.pant) && after.pantNr === before.pantNr && after.money === before.money, `panterna och kvittonumret överlever en omladdning (${after.pant.length} panter, nr ${after.pantNr})`);
if (norm(after.pant) !== norm(before.pant)) console.log('  före:', norm(before.pant), '\n  efter:', norm(after.pant));
// en pant med en möbel från en nyare version följer med orörd (den här versionen känner inte till den)
const keepOk = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('snabbfilen_save1'));
  raw.pant.push({ k: 'framtidsmobel', v: 3, nr: 99, lan: 50, skuld: 60, dag: 3, sista: 10, glitter: true });
  localStorage.setItem('snabbfilen_save1', JSON.stringify(raw));
  return true;
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(300);
const kept = await page.evaluate(() => { const g = window.SF.game; g.save(); const s = JSON.parse(localStorage.getItem('snabbfilen_save1')); return { inGame: g.pant.some((p) => p.k === 'framtidsmobel'), inSave: s.pant.some((p) => p.k === 'framtidsmobel' && p.glitter), n: g.pant.length, nr: g.pantNr }; });
ok(keepOk && !kept.inGame && kept.inSave && kept.n === 3, `en okänd pant (nyare version) ligger kvar orörd i sparfilen men inte i spelet (${JSON.stringify(kept)})`);
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('snabbfilen_save1')); raw.pant = raw.pant.filter((p) => p.k !== 'framtidsmobel'); localStorage.setItem('snabbfilen_save1', JSON.stringify(raw)); });
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(300);
await page.evaluate(() => window.SF.go('pantbank'));
await page.waitForTimeout(400);
await D('hideNpcs');
await D('fast', 3);

// ---------- förfallna lån ----------
const lost = await page.evaluate(() => {
  const g = window.SF.game, out = [];
  // alla panter är tagna dag 3 → sista dagen 10
  for (let d = 0; d < 7; d++) g.sleep();
  out.push({ day: g.day, n: g.pant.length, left: g.pantDaysLeft(g.pant[0]) });
  const money = g.money, st = g.storage.length;
  g.sleep();
  out.push({ day: g.day, n: g.pant.length, money: g.money, moneyBefore: money, st, stAfter: g.storage.length, rent: 0 });
  return out;
});
ok(lost[0].day === 10 && lost[0].n === 3 && lost[0].left === 0, `dag 10 = sista dagen: panterna finns kvar (${JSON.stringify(lost[0])})`);
ok(await page.evaluate(() => /Sista dagen/i.test(document.querySelector('#toasts')?.innerText || '')), 'på morgonen sista dagen kommer en påminnelse (toast)');
ok(lost[1].day === 11 && lost[1].n === 0 && lost[1].stAfter === lost[1].st, 'dag 11: lånen har förfallit – pantbanken behöll möblerna, inget kom tillbaka till förrådet');
ok(await page.evaluate(() => /behöll/i.test(document.querySelector('#toasts')?.innerText || '')), 'en toast berättar att pantbanken behöll möblerna');
ok((await stored()).pant.length === 0, 'de förfallna panterna är borta ur sparfilen');

// ---------- stängt ----------
await page.evaluate(() => { window.SF.game.min = 19 * 60; });
await page.evaluate(() => { for (let i = 0; i < 90; i++) window.SF.scene.update(1 / 60); });
const stc = await D('state');
ok(!stc.open && stc.shutter > 0.9, `kl. 19 är det stängt och rullgallret nere (${stc.shutter})`);
ok((await D('desk')) === false && !(await modalOpen()), 'luckan öppnar ingen dialog när det är stängt');
await pano('09-stangt');
await page.evaluate(() => { window.SF.game.min = 12 * 60; });
await page.evaluate(() => { for (let i = 0; i < 90; i++) window.SF.scene.update(1 / 60); });
ok((await D('state')).shutter < 0.1, 'kl. 12 är rullgallret uppe igen');

// ---------- kunderna, gitarrerna, papegojan ----------
const life = await page.evaluate(() => {
  const S = window.SF.scene, states = new Set();
  S._debug.npcNow();
  for (let i = 0; i < 60 * 70; i++) { S.update(1 / 60); states.add(S._debug.npc().state); }
  return [...states];
});
ok(['walk', 'haggle', 'away'].every((s) => life.includes(s)), `en kund kommer in, prutar vid luckan och går (${life.join(', ')})`);
await clickSpot('gitarr1');
ok(await waitFor(() => window.SF.scene._debug.state().pos.path === 0, 9000), 'klick på den röda elgitarren → figuren går dit och slår an ett ackord');
ok((await D('bird')) === 'talk', 'papegojan pratar');
await pano('10-kunder');

// ---------- ut genom dörren ----------
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'dörren → ut i staden');
const door = await page.evaluate(async () => { const m = await import('/js/city/map.js'); const b = (m.ALL_BUILDINGS || []).find((x) => x.id === 'pantbank'); return b ? { enter: b.enter || null, open: b.open || null } : null; });
if (door?.enter === 'pantbank') {
  await page.evaluate(() => { window.SF.game.min = 12 * 60; window.SF.scene._debug.enter('pantbank'); });
  ok(await waitFor(() => window.SF.sceneName === 'pantbank', 20000), 'dörren i förorten leder in i pantbanken');
} else info(`dörren i staden är inte inkopplad än (enter: ${door?.enter ?? 'saknas'}) – se notes`);

// =====================================================================================
// SKRAPLOTTERNA I NÄRBUTIKEN
// =====================================================================================
await page.evaluate(() => { const g = window.SF.game; g.money = 500; g.min = 14 * 60; g.save(); window.SF.go('narbutik'); });
await page.waitForTimeout(500);
await page.evaluate(() => window.SF.scene._debug.hideNpcs?.());

// ---------- rättvis slump ----------
const fair = await page.evaluate(async () => {
  const L = await import('/js/scenes/skraplott.js');
  const c = { 0: 0, 100: 0, 500: 0, 1000: 0 }; let bad = 0, same = true;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const salt = 1 + (i % 101) * 7919, day = 1 + Math.floor(i / 101), n = i % 10;
    const p = L.lottPrize(salt, day, n); c[p]++;
    const f = L.lottFields(salt, day, n, p);
    if (L.winOf(f) !== p || f.length !== 6) bad++;
    if (i % 997 === 0 && (L.lottPrize(salt, day, n) !== p || JSON.stringify(L.lottFields(salt, day, n)) !== JSON.stringify(f))) same = false;
  }
  return { f100: c[100] / N, f500: c[500] / N, f1000: c[1000] / N, bad, same, salts: L.lottPrize(111, 5, 0) === L.lottPrize(111, 5, 0) };
});
ok(fair.same && fair.salts, 'samma salt, dag och lottnummer ger alltid samma vinst och samma rutor');
ok(fair.bad === 0, 'tre lika belopp på lotten ⇔ vinst (aldrig tre lika av något annat)');
ok(Math.abs(fair.f100 - 1 / 12) < 0.01 && Math.abs(fair.f500 - 1 / 80) < 0.004 && Math.abs(fair.f1000 - 1 / 250) < 0.002, `vinstfrekvenser 100: ${(fair.f100 * 100).toFixed(2)} %, 500: ${(fair.f500 * 100).toFixed(2)} %, 1000: ${(fair.f1000 * 100).toFixed(2)} % (liten chans)`);

// ---------- köp vid stället med riktiga klick ----------
// välj ett salt där dagens första lott är en 500-vinst (så att vinstvägen provas på riktigt)
const winSalt = await page.evaluate(async () => {
  const L = await import('/js/scenes/skraplott.js'), g = window.SF.game;
  for (let s = 1; s < 200000; s++) if (L.lottPrize(s, g.day, 0) === 500) { g.lott = { salt: s, dag: g.day, n: 0, kopt: 0, vunnit: 0, open: null }; g.save(); return s; }
  return 0;
});
ok(winSalt > 0, `ett salt där dagens första lott vinner 500 kr (${winSalt})`);
const n0 = await page.evaluate(() => window.SF.scene._debug.lott());
ok(n0.left === 10 && !n0.open, `tio lotter på rullen i dag (${n0.left})`);
await clickSpot('lotter');
ok(await waitFor(() => /Lyckoskrap/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 12000), 'klick på lotter-stället → figuren går dit → dialogen 🍀 Lyckoskrap');
ok(/25 kr/.test(await modalText()) && /tre lika/i.test(await modalText()), 'dialogen säger 25 kr och tre lika');
const mL = (await G()).money;
ok(await clickBtn(/Köp en lott/), 'klick på Köp en lott');
const l1 = await D('lott');
ok((await G()).money === mL - 25 && l1.open && l1.ticket && l1.n === 1, `lotten köpt: −25 kr, lotten ligger uppe (${mL} → ${(await G()).money})`);
ok(JSON.stringify((await stored()).lott?.open?.fields) === JSON.stringify(l1.open.fields), 'den köpta lotten är sparad innan man skrapat');
const expect1 = await D('lottPrize', l1.salt, l1.dag, 0);
ok(expect1 === l1.open.prize && expect1 === 500 && l1.salt === winSalt, `lottens vinst är den förutbestämda för lott 0 i dag (${expect1} kr)`);
await shot('11-lotten-oskrapad');

// ---------- skrapa med musen ----------
const rects = await D('lottRects');
ok(rects?.length === 6, 'sex rutor att skrapa');
const box = await viewBox();
for (const [i, r] of rects.entries()) {
  // tre drag fram och tillbaka över rutan, som man skrapar på riktigt
  for (const fy of [0.25, 0.5, 0.78]) {
    const [ax, ay] = toClient(box, r.x + 1, r.y + r.h * fy), [bx, by] = toClient(box, r.x + r.w - 1, r.y + r.h * fy);
    await page.mouse.move(ax, ay); await page.mouse.down();
    await page.mouse.move(bx, by, { steps: 14 }); await page.mouse.up();
  }
  if (i === 1) { const rr = await D('lottRects'); ok(rr[0].done && rr[1].done && !rr[5].done, 'skrapade rutor blir synliga, de andra är kvar under silvret'); await shot('12-halvskrapad'); }
}
ok(await waitFor(() => !!window.SF.scene._debug.lott().result, 3000), 'alla sex rutor skrapade → lotten är avgjord');
const l2 = await D('lott');
ok(l2.result.prize === expect1 && !l2.open && (await G()).money === mL - 25 + expect1, `vinsten ${expect1} kr betalas ut (pengar nu ${(await G()).money})`);
ok((await stored()).money === (await G()).money && (await stored()).lott.vunnit === 500, 'vinsten är sparad');
await page.waitForTimeout(900);
await shot('13-lotten-vinst');

// ---------- halvskrapad lott överlever omladdning och skrapas klart på vägen ut ----------
await D('lottClose');
const r2 = await D('lottBuy');
ok(r2.ok, 'lott nr 2 köpt');
const open2 = (await D('lott')).open;
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.SF.go('narbutik'));
await page.waitForTimeout(300);
const l3 = await D('lott');
ok(l3.open && l3.open.n === open2.n && JSON.stringify(l3.open.fields) === JSON.stringify(open2.fields), 'den oskrapade lotten finns kvar efter omladdning – samma rutor');
const mB = (await G()).money;
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(200);
const l4 = await page.evaluate(() => window.SF.game.lott);
ok(!l4.open && (await G()).money === mB + open2.prize, `går man ut skrapas lotten klart i farten och vinsten (${open2.prize} kr) följer med`);

// ---------- dagens följd, tio per dag, ny dag ----------
await page.evaluate(() => { window.SF.game.money = 1000; window.SF.go('narbutik'); });
await page.waitForTimeout(300);
const seq = await page.evaluate(() => {
  const S = window.SF.scene._debug, g = window.SF.game, out = [];
  const L = S.lott();
  for (let k = L.n; k < 12; k++) {
    const m = g.money, r = S.lottBuy();
    if (!r.ok) { out.push({ k, ok: false, msg: r.msg }); continue; }
    const want = S.lottPrize(L.salt, g.day, k);
    S.lottReveal(); S.lottClose();
    out.push({ k, ok: true, want, got: g.money - m + 25 });
  }
  return { out, left: S.lott().left };
});
const bought = seq.out.filter((o) => o.ok);
ok(bought.length === 8 && bought.every((o) => o.want === o.got), `lott 3–10 i dag ger exakt de förutbestämda vinsterna (${bought.map((o) => o.got).join(', ')})`);
ok(seq.out.filter((o) => !o.ok).length === 2 && /slut/i.test(seq.out.find((o) => !o.ok).msg) && seq.left === 0, 'lott 11 och 12 nekas – högst tio per dag');
await page.evaluate(() => { window.SF.game.sleep(); });
ok((await D('lott')).left === 10, 'ny dag = ny rulle med tio lotter');
await page.evaluate(() => { window.SF.game.money = 20; });
const poor = await D('lottBuy');
ok(!poor.ok && (await G()).money === 20, 'med 20 kr går det inte att köpa en lott');

// ---------- släpper man musen UTANFÖR spelvyn slutar lotten skrapa ----------
// Zoomläget RAM på en stor skärm: spelvyn ligger mitt i canvasen med en pixelram runt om.
// Klick/släpp i ramen skickar main.js inte vidare till scenen – lotten måste ändå släppa.
await page.close();
page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
watchErrors(page);
await page.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill=1&world=pantram${Date.now().toString(36)}`);
await page.evaluate((s) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
  localStorage.setItem('snabbfilen_zoom', 'ram');
}, { ...SAVE, money: 500, min: 14 * 60 });
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.SF.go('narbutik'));
await page.waitForTimeout(500);
await page.evaluate(() => window.SF.scene._debug.hideNpcs?.());
const rv = await page.evaluate(() => ({ ...window.SF.view, W: window.SF.W, H: window.SF.H }));
if (!rv.boxed) info(`ram-läget gav ingen ram här (${JSON.stringify(rv)}) – släpp-provet hoppas över`);
else {
  ok((await D('lottBuy')).ok, 'ram-läget: en lott köpt');
  const rr = await D('lottRects');
  const vb = await viewBox();
  const f0 = rr[0], f5 = rr[5];
  // en punkt i ramen: ovanför eller till vänster om spelvyn (men på canvasen)
  const frame = rv.boxY > 2 ? [f0.x + 4, -Math.min(6, rv.boxY - 1)] : [-Math.min(6, rv.boxX - 1), f0.y + 4];
  const [ax, ay] = toClient(vb, f0.x + 1, f0.y + f0.h / 2), [bx, by] = toClient(vb, f0.x + f0.w - 1, f0.y + f0.h / 2);
  await page.mouse.move(ax, ay); await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 10 });
  const [fx, fy] = toClient(vb, frame[0], frame[1]);
  await page.mouse.move(fx, fy, { steps: 6 });
  await page.mouse.up(); // släpps i ramen – main.js skickar inget up() till scenen
  await shot('14-lotten-ram');
  // musen förs sedan över en annan ruta UTAN knapp nedtryckt
  const [cx, cy] = toClient(vb, f5.x + 1, f5.y + f5.h / 2), [dx, dy] = toClient(vb, f5.x + f5.w - 1, f5.y + f5.h / 2);
  await page.mouse.move(cx, cy, { steps: 6 }); await page.mouse.move(dx, dy, { steps: 14 });
  const after = await D('lottRects');
  ok(after[0].cover > 0.1, `draget över första rutan skrapade (${after[0].cover})`);
  ok(after[5].cover === 0 && !after[5].done, `efter släppet i ramen skrapar en vanlig musrörelse inte längre (ruta 6: ${after[5].cover})`);
  // pointercancel (t.ex. när mobilen tar över gesten) släpper också
  const [ex, ey] = toClient(vb, rr[4].x + 1, rr[4].y + rr[4].h / 2);
  await page.mouse.move(ex, ey); await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await page.evaluate((r) => { for (let k = 0; k <= 20; k++) window.SF.scene.move(r.x + r.w * k / 20, r.y + r.h / 2); }, rr[3]);
  ok((await D('lottRects'))[3].cover === 0, 'efter pointercancel skrapar rörelser inte heller');
  await page.mouse.up();
}

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'ok: inga konsolfel');
if (errs.length) fails++;
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
await browser.close();
process.exit(fails ? 1 : 0);
