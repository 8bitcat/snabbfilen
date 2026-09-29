// Funktionstest av accessoarbutiken (scen 'accessoarer'): hela katalogens accessoarer står
// framme och går att nå, köp via riktiga klick (figuren går dit → dialog → Köp), gamla
// sparfilers 'kind:v'-plagg räknas som ägda, för lite pengar, ta på/ta av, färgval bara där
// färgen syns, REA, hela sortimentet (rutnätet), spegelbilden, kunderna, dörren ut, att köpen
// sparas – och reserven när game.js saknar ownsItem/buyItem. Skärmbilder i tools/out/klad-acc/.
//   (server: python -m http.server 8788 --bind 127.0.0.1 i spelmappen)
//   node tools/accessoarer-test.mjs            (PORT=… för en annan port)
import { createRequire } from 'module';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = new URL('./out/klad-acc/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const SLOTS = ['hat', 'glasses', 'bag', 'neck', 'jewel', 'hairAcc', 'phones'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const URL0 = `http://localhost:${PORT}/index.html?world=acctest${Date.now().toString(36)}`;
async function fresh(save) {
  await page.goto(URL0);
  await page.evaluate((save) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify(save));
  }, save);
  await page.reload();
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.SF.go('accessoarer'); });
  await page.waitForTimeout(300);
}
const SAVE = { v: 1, day: 3, min: 14 * 60, money: 3000, hunger: 60, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: ['hat:cap'] };

let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FEL  ') + msg); if (!c) fails++; };
const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalText = () => page.evaluate(() => document.querySelector('#modal').innerText);
const clickBtn = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modal .dlg-foot .btn')].find((x) => new RegExp(src).test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return b ? 'disabled' : false; }, re.source);
const closeModal = () => page.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); document.querySelector('#modal').innerHTML = ''; });
const waitFor = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); } return false; };
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
async function clickSpot(id) {
  const p = await D('spot', id);
  if (!p) throw new Error('ingen plats ' + id);
  await clickView(p.x, p.y);
}
const shot = (name) => page.locator('#scene').screenshot({ path: fileURLToPath(new URL(name, OUT)) });
const savePng = (name, url) => fs.writeFileSync(new URL(name, OUT), Buffer.from(url.split(',')[1], 'base64'));

await fresh(SAVE);
ok(await page.evaluate(() => window.SF.sceneName) === 'accessoarer', 'scenen accessoarer öppnas med SF.go');

// ---- hela katalogen står framme, en gång var, och går att nå ----
const items = await D('items');
const want = await page.evaluate(async (slots) => { const m = await import('/js/data/wardrobe.js'); return slots.flatMap((s) => m.itemsForSlot(s).map((it) => it.id)); }, SLOTS);
const shown = items.map((d) => d.id);
ok(want.length > 100 && want.every((id) => shown.includes(id)), `alla ${want.length} accessoarer i katalogen står framme (${shown.length} varor)`);
ok(new Set(shown).size === shown.length, 'ingen vara står två gånger');
ok(items.every((d) => d.r[0] >= 0 && d.r[2] <= 980 && d.r[1] >= 0 && d.r[3] <= 216), 'alla klickrutor ligger i butiken');
const secs = await D('sections');
console.log('     avdelningar: ' + secs.map((s) => `${s.id} ${s.shown}/${s.n}`).join(', '));
let unreach = [];
for (const d of items) { const r = await D('reach', d.id); if (!r || !r.end || Math.hypot(r.end[0] - r.go[0], r.end[1] - r.go[1]) > 7) unreach.push(d.id + ' ' + JSON.stringify(r)); }
ok(unreach.length === 0, 'figuren kan gå fram till varje vara' + (unreach.length ? ': ' + unreach.slice(0, 5).join(' | ') : ''));
// klickrutorna krockar inte (utom halvt överlapp mellan grannar i disken)
const overl = [];
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
  const a = items[i].r, b = items[j].r, ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (ox > 3 && oy > 3) overl.push(items[i].id + '/' + items[j].id);
}
ok(overl.length === 0, 'varornas klickrutor överlappar inte' + (overl.length ? ': ' + overl.slice(0, 6).join(', ') : ''));

// ---- gamla sparfilens keps räknas som ägd ----
ok(await D('owns', 'hat-cap') === true, "gamla sparfilens 'hat:cap' = kepsen är DIN");
ok(await D('owns', 'hat-fedora') === false, 'fedoran är inte köpt än');
savePng('test-pano.png', await D('panorama'));
await shot('test-a-start.png');

// ---- köp med riktiga klick: fedoran på hattväggen ----
const money0 = await page.evaluate(() => window.SF.game.money);
const price = await D('price', 'hat-fedora');
await clickSpot('hat-fedora');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000), 'klick på fedoran → figuren går dit → köpdialogen öppnas');
const st1 = await D('state');
ok(st1.focus === 'hat-fedora' || Math.abs(st1.y - 127) < 6, `figuren står vid hattväggen (${st1.x},${st1.y})`);
let txt = await modalText();
ok(/Fedora/.test(txt) && new RegExp(String(price)).test(txt.replace(/\s/g, '')), `dialogen visar Fedora och priset ${price} kr`);
ok(await page.evaluate(() => document.querySelectorAll('#modal [data-c]').length > 5), 'fedoran har färgrutor att prova');
await page.screenshot({ path: new URL('test-b-dialog-fedora.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
ok(await clickBtn(/Köp/) === true, 'Köp-knappen går att trycka');
await page.waitForTimeout(250);
ok(!(await modalOpen()), 'dialogen stängs efter köpet');
ok(await page.evaluate(() => window.SF.game.money) === money0 - price, `pengarna dras (${money0} → ${money0 - price})`);
ok(await D('owns', 'hat-fedora') === true, 'fedoran är din');
ok(await page.evaluate(() => window.SF.avatar.look.hat) === 'fedora', 'du har fedoran på dig direkt');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1')));
ok(saved.money === money0 - price && saved.wardrobe.includes('hat-fedora'), 'köpet är sparat (pengar + garderob)');
{ const st = await D('state'); ok(!!(st.clerk || st.say), 'någon reagerar på köpet: ' + (st.clerk || st.say)); }
ok((await D('state')).bag, 'figuren bär en butikspåse efter köpet');
await page.waitForTimeout(300);
await shot('test-c-efter-kop.png');

// ---- ett gammalt plagg köpt i nya butiken behåller 'kind:v'-nyckeln ----
const r2 = await D('buy', 'glasses-round');
ok(r2.ok && await D('owns', 'glasses-round'), 'runda glasögon köpta');
const w2 = await page.evaluate(() => window.SF.game.wardrobe);
ok(w2.includes('glasses:round') || w2.includes('glasses-round'), 'glasögonen ligger i garderoben: ' + JSON.stringify(w2));

// ---- för lite pengar ----
await page.evaluate(() => { window.SF.game.money = 50; });
await D('open', 'jewel-goldset');
ok(await modalOpen(), 'guldsetet (2500 kr) öppnas');
ok(await clickBtn(/Köp/) === 'disabled', 'Köp-knappen är avstängd när man saknar pengar');
ok(/saknar/.test(await modalText()), 'dialogen säger hur mycket som fattas');
await closeModal();
const r3 = await D('buy', 'jewel-goldset');
ok(!r3.ok && await page.evaluate(() => window.SF.game.money) === 50, 'inget dras när man inte har råd');
await page.evaluate(() => { window.SF.game.money = 3000; });

// ---- ta av / ta på något man äger ----
await D('open', 'hat-fedora');
ok(/Den här är din/.test(await modalText()), 'ägd vara: dialogen säger att den är din');
ok(await clickBtn(/Ta av/) === true, 'fedoran på → knappen Ta av mig den');
ok(await page.evaluate(() => window.SF.avatar.look.hat) === null, 'fedoran är av');
await D('open', 'hat-fedora');
ok(await clickBtn(/Ta på/) === true, 'Ta på mig den');
ok(await page.evaluate(() => window.SF.avatar.look.hat) === 'fedora', 'fedoran är på igen');

// ---- färgval bara där färgen syns ----
const swatches = async (id) => { await D('open', id); const n = await page.evaluate(() => document.querySelectorAll('#modal [data-c]').length); await closeModal(); return n; };
ok(await swatches('bag-handbag') > 5, 'handväskan kan provas i olika färger');
ok(await swatches('neck-pearls') === 0, 'pärlhalsbandet har inga färgrutor (färgen syns inte)');
ok(await swatches('glasses-aviator') === 0, 'pilotglasögonen har inga färgrutor');
// väskan syns bäst bakifrån: dialogen vrider figuren
await D('open', 'bag-backpack');
ok(/Bakifrån|Från sidan/.test(await page.evaluate(() => document.querySelector('#modal [data-view]').textContent)), 'ryggsäcken visas bakifrån/från sidan');
await page.screenshot({ path: new URL('test-d-dialog-ryggsack.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
await closeModal();

// ---- REA ----
await page.evaluate(() => { window.SF.game.event = { id: 'rea' }; });
ok(await D('price', 'hat-beret') === Math.round(260 * 0.75), 'REA: basker 260 → 195 kr');
await D('open', 'hat-beret');
ok(/REA/.test(await modalText()), 'dialogen visar REA');
await closeModal();
await page.evaluate(() => { window.SF.game.event = null; });

// ---- hela sortimentet (rutnätet) och tillbaka ----
await clickSpot('skylt-hattar');
ok(await waitFor(() => document.querySelectorAll('#modal [data-id]').length > 0, 12000), 'klick på skylten HATTAR → hela sortimentet');
const nTiles = await page.evaluate(() => document.querySelectorAll('#modal [data-id]').length);
ok(nTiles === secs.find((s) => s.id === 'hattar').n, `rutnätet visar alla ${nTiles} hattar`);
ok(await page.evaluate(() => [...document.querySelectorAll('#modal canvas')].every((c) => c.width > 0)), 'varje ruta har en bild av dig med hatten');
await page.screenshot({ path: new URL('test-e-sortiment.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
await page.evaluate(() => document.querySelector('#modal [data-id="hat-cowboy"]').click());
await page.waitForTimeout(200);
ok(/Cowboy/.test(await modalText()), 'ruta → köpdialogen för cowboyhatten');
ok(await clickBtn(/Tillbaka/) === true, '← Tillbaka');
ok(await page.evaluate(() => document.querySelectorAll('#modal [data-id]').length) === nTiles, 'tillbaka i rutnätet');
await closeModal();
for (const s of ['glasogon', 'vaskor', 'hals', 'smycken', 'har', 'horlurar']) { await D('openKat', s); const n = await page.evaluate(() => document.querySelectorAll('#modal [data-id]').length); ok(n === secs.find((x) => x.id === s).n, `sortimentet ${s}: ${n} rutor`); if (s === 'smycken') await page.screenshot({ path: new URL('test-f-smycken.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') }); await closeModal(); }

// ---- spegeln visar den som står framför den ----
const glassSum = async () => page.evaluate(async () => {
  const url = window.SF.scene._debug.panorama(), img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = 980; c.height = 216; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(267, 19, 22, 97).data; let s = 0; for (let i = 0; i < d.length; i += 4) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return s;
});
await D('teleport', 600, 180);
const g0 = await glassSum();
await D('teleport', 278, 127); await D('face', 'up');
const g1 = await glassSum();
ok(g0 !== g1, 'spegelbilden syns när man står framför spegeln');
await D('lockCam', 150); await page.waitForTimeout(200);
await shot('test-g-spegel.png');
await D('lockCam', null);

// ---- smyckesdisken och hårbordet (golvmöbler) går att klicka ----
await clickSpot('jewel-watch');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 12000) && /Armbandsur/.test((await modalText()).replace(/\u00ad/g, '')), 'klick på klockan i smyckesdisken → dialogen');
await closeModal();
await clickSpot('hairacc-flowercrown');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 14000) && /Blomkrans/.test(await modalText()), 'klick på blomkransen på hårbordet → dialogen');
await closeModal();
await clickSpot('bag-guitar');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 14000) && /Gitarr/.test(await modalText()), 'klick på gitarren på väskväggen → dialogen');
await closeModal();
await clickSpot('neck-tie');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 14000) && /Slips/.test(await modalText()), 'klick på slipsen i halsvitrinen → dialogen');
await closeModal();

// ---- kunderna går runt och provar ----
const sh0 = await D('shoppers');
await D('tick', 25);
const sh1 = await D('shoppers');
ok(sh1.every((s, i) => s.x !== sh0[i].x || s.y !== sh0[i].y || s.state !== sh0[i].state), 'kunderna rör sig: ' + JSON.stringify(sh1.map((s) => s.state)));
let tried = false;
for (let i = 0; i < 12 && !tried; i++) { await D('tick', 5); tried = (await D('shoppers')).some((s) => s.trying); }
ok(tried, 'en kund provar något');
await D('lockCam', 380); await page.waitForTimeout(200); await shot('test-h-kassan.png');
await D('lockCam', 596); await page.waitForTimeout(200); await shot('test-i-vaskor.png');
await D('lockCam', 0); await page.waitForTimeout(200); await shot('test-j-hattar.png');
await D('lockCam', null);

// ---- köpen finns kvar efter omladdning ----
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { window.SF.go('accessoarer'); });
await page.waitForTimeout(200);
ok(await D('owns', 'hat-fedora') && await D('owns', 'glasses-round') && await D('owns', 'hat-cap'), 'efter omladdning: fedora, runda glasögon och kepsen är dina');

// ---- dörren ut ----
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'klick på dörren → ut i staden');

// ---- reserven: game.js utan ownsItem/buyItem/itemPrice ----
await fresh({ ...SAVE, wardrobe: ['hat:cap', 'hat-beret'] });
await page.evaluate(() => { const g = window.SF.game; g.ownsItem = undefined; g.buyItem = undefined; g.itemPrice = undefined; });
ok(await D('owns', 'hat-cap') && await D('owns', 'hat-beret'), 'reserven: kepsen (gammal nyckel) och baskern (nytt id) räknas');
const m0 = await page.evaluate(() => window.SF.game.money);
const rf = await D('buy', 'hat-straw');
ok(rf.ok && await page.evaluate(() => window.SF.game.money) === m0 - 290 && await D('owns', 'hat-straw'), 'reserven: köp av halmhatten fungerar');
const rl = await D('buy', 'bag-backpack');
ok(rl.ok && (await page.evaluate(() => window.SF.game.wardrobe)).includes('bag:backpack'), "reserven: ryggsäcken sparas med gamla nyckeln 'bag:backpack'");

// ---- mobil (fyll-läget NÄRA, pekskärm): mätarremsan tar två rader och bara ett band av
// butikens rader syns – den lodräta kameran ska visa hela väggen när man står vid den ----
const mob = await browser.newPage({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
mob.on('pageerror', (e) => errs.push('mobil: ' + e.message));
await mob.goto(URL0.replace('?', '?mobfill=1&'));
await mob.evaluate((save) => { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobil', look: { style: 'bob', hair: '#b7392b' }, color: '#3fc4ff' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(save)); }, SAVE);
await mob.reload(); await mob.waitForTimeout(900);
await mob.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); window.SF.game.event = null; window.SF.go('accessoarer'); });
await mob.waitForTimeout(500);
ok(await mob.evaluate(() => window.SF.sceneName === 'accessoarer' && window.SF.W >= 384), 'mobil: butiken ritas i fyll-läget (vy ' + await mob.evaluate(() => window.SF.W + '×' + window.SF.H) + ')');
const MD = (fn, ...a) => mob.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const mOpen = () => mob.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const mClose = () => mob.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); document.querySelector('#modal').innerHTML = ''; });
const mWait = async (fn, ms = 14000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await mob.evaluate(fn)) return true; await mob.waitForTimeout(120); } return false; };
// tryck med fingret mitt på platsen – och kolla att det är spelbilden som syns där (inte remsan)
async function mTap(id) {
  const s = await MD('spot', id);
  const p = await mob.evaluate(([x, y]) => { const A = window.SF, cv = document.querySelector('#scene'), r = cv.getBoundingClientRect(); const q = { x: r.left + (x + A.view.boxX) * r.width / (cv.width / A.pxs), y: r.top + (y + A.view.boxY) * r.height / (cv.height / A.pxs) }; q.hit = document.elementFromPoint(q.x, q.y) === cv; return q; }, [s.x, s.y]);
  if (p.hit) await mob.touchscreen.tap(p.x, p.y);
  return p.hit;
}
const mShot = (name) => mob.screenshot({ path: new URL(name, OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
const bnd = (await MD('camY')).band;
ok(bnd.v < 216, `mobil: bara skärmrad ${bnd.y0}–${bnd.y1} syns (${bnd.v} av 216 – NÄRA beskär)`);
// vid hattväggen (på golvet framför, inte vid en viss vara): hela väggen ända upp till takskyltarna
await MD('teleport', 124, 132); await mob.waitForTimeout(700);
const c1 = await MD('camY');
ok(c1.y <= 1 && (await MD('state')).focus === null, `mobil: vid hattväggen syns väggen ända upp (översta synliga raden ${Math.round(c1.y)})`);
await mShot('test-k-mobil.png');
ok(await mTap('hat-fedora') && await mWait(() => !document.querySelector('#modal').classList.contains('hidden')) && /Fedora/.test(await mob.evaluate(() => document.querySelector('#modal').innerText)), 'mobil: tryck på fedoran på ÖVERSTA hyllan → köpdialogen');
await mClose();
await MD('teleport', 354, 127); await mob.waitForTimeout(700);
const nGl = await mob.evaluate(async () => (await import('/js/data/wardrobe.js')).itemsForSlot('glasses').length);
ok(await mTap('skylt-glasogon') && await mWait(() => document.querySelectorAll('#modal [data-id]').length > 0) && await mob.evaluate(() => document.querySelectorAll('#modal [data-id]').length) === nGl, `mobil: tryck på takskylten GLASÖGON → alla ${nGl} bågar`);
await mClose();
const topRow = (slot) => items.filter((d) => d.slot === slot).sort((a, b) => a.r[1] - b.r[1])[0].id;
for (const id of [topRow('glasses'), topRow('neck'), topRow('bag')]) {
  const it = items.find((d) => d.id === id);
  await MD('teleport', (it.r[0] + it.r[2]) / 2, 150); await mob.waitForTimeout(700);
  ok(await mTap(id) && await mWait(() => !document.querySelector('#modal').classList.contains('hidden')), `mobil: översta raden går att trycka på (${id})`);
  if (id.startsWith('neck')) { await mob.waitForTimeout(200); await mClose(); await mob.waitForTimeout(500); await mShot('test-l-mobil-halsvitrin.png'); }
  await mClose();
}
// ner till smyckesdisken: bilden glider ner så att brickorna syns
await MD('teleport', 200, 127); await mob.waitForTimeout(700);
ok(await mTap('jewel-watch') && await mWait(() => !document.querySelector('#modal').classList.contains('hidden')), 'mobil: tryck på klockan i smyckesdisken → dialogen');
await mClose(); await mob.waitForTimeout(700);
const c2 = await MD('camY'), st2 = await MD('state'), watch = items.find((d) => d.id === 'jewel-watch');
ok(watch.r[3] + c2.ty <= c2.band.y1 && st2.y - 44 + c2.ty >= c2.band.y0, `mobil: vid disken syns både brickan och figuren (kameran på rad ${Math.round(c2.y)})`);
await mShot('test-m-mobil-disken.png');
ok(st2.focus === 'jewel-watch', `mobil: namnskylten gäller klockan man gick till (${st2.focus}) – inte grannen i samma ståplats`);
// längst ner i butiken: golvet och figuren syns, takskyltarna har glidit ur bild
await MD('teleport', 600, 208); await mob.waitForTimeout(800);
const c3 = await MD('camY'), st3 = await MD('state');
ok(c3.y > 40 && st3.y + c3.ty <= c3.band.y1, `mobil: längst ner följer kameran med (rad ${Math.round(c3.y)}, fötterna på skärmrad ${st3.y + c3.ty})`);
await mob.close();

// ---- datorn i VID-läget (fyll): kanterna beskärs – butikens ytterkanter ska ändå gå att nå ----
const vid = await browser.newPage({ viewport: { width: 1366, height: 768 } });
vid.on('pageerror', (e) => errs.push('vid: ' + e.message));
await vid.goto(URL0.replace('?', '?mobfill=1&'));
await vid.evaluate((save) => { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Vid', look: { style: 'bun', hair: '#6b4226' }, color: '#46a35a' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(save)); }, SAVE);
await vid.reload(); await vid.waitForTimeout(900);
await vid.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); window.SF.game.event = null; window.SF.go('accessoarer'); });
await vid.waitForTimeout(500);
const VD = (fn, ...a) => vid.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const vSafe = await vid.evaluate(() => window.SF.view.safe);
ok(vSafe.x0 > 0, `vid: fyll-läget beskär kanterna (synligt x ${vSafe.x0}–${vSafe.x1} av ${await vid.evaluate(() => window.SF.W)})`);
const edge = [items.reduce((a, b) => (b.r[0] < a.r[0] ? b : a)), items.reduce((a, b) => (b.r[2] > a.r[2] ? b : a))];
for (const [i, d] of edge.entries()) {
  await VD('teleport', i ? 960 : 20, 140); await vid.waitForTimeout(700);
  const c = await VD('cam');
  ok(i ? c + vSafe.x1 >= 980 : c + vSafe.x0 <= 0, `vid: vid ${i ? 'högra' : 'vänstra'} kanten syns butiken ända ut (synligt x ${Math.round(c + vSafe.x0)}–${Math.round(c + vSafe.x1)})`);
  const p = await VD('spot', d.id);
  const q = await vid.evaluate(([x, y]) => { const A = window.SF, cv = document.querySelector('#scene'), r = cv.getBoundingClientRect(); const o = { x: r.left + (x + A.view.boxX) * r.width / (cv.width / A.pxs), y: r.top + (y + A.view.boxY) * r.height / (cv.height / A.pxs) }; o.hit = document.elementFromPoint(o.x, o.y) === cv; return o; }, [p.x, p.y]);
  if (q.hit) await vid.mouse.click(q.x, q.y);
  let open = false;
  for (let k = 0; k < 100 && !open; k++) { await vid.waitForTimeout(120); open = await vid.evaluate(() => !document.querySelector('#modal').classList.contains('hidden')); }
  ok(q.hit && open, `vid: ${d.id} längst ${i ? 'till höger' : 'till vänster'} går att klicka på → dialogen`);
  await vid.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); document.querySelector('#modal').innerHTML = ''; });
  if (!i) { await vid.waitForTimeout(400); await vid.screenshot({ path: new URL('test-n-vid-vanster.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') }); }
}
await vid.close();

ok(errs.length === 0, 'inga konsolfel' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
console.log(fails ? `\n${fails} FEL` : '\nALLT OK');
await browser.close();
process.exit(fails ? 1 : 0);
