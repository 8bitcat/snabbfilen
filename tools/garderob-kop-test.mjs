// Garderoben hela vägen (integrationen av klädkatalogen i game.js + main.js):
//  1. en gammal sparfil med 'kind:v' migreras till katalog-id – inget försvinner, och de gamla
//     nycklarna står kvar som alias så att en äldre version fortfarande känner igen plaggen
//  2. köp i riktiga dialoger: ett NYTT katalogplagg i klädaffären, ett par skor i skobutiken,
//     en accessoar i accessoarbutiken och en ny frisyr hos frisören – in i alla fyra genom
//     stadens dörrar (downtowns SKOBUTIKEN, ACCESSOARER och FRISÖR har enter i js/city/map.js)
//  3. omladdning: allt finns kvar, syns i garderoben hemma (avatarredigeraren) och oköpta
//     katalogplagg är fortfarande låsta; frisyr och hårfärg går INTE att byta hemma
//     (setAvatarSalon – det gör man hos frisören), men en ny figur väljer fritt;
//     dagboken räknar köpen mot hela katalogen
//  4. game.js-API:t: REA −25 %, för lite pengar, redan köpt, gamla anropen (clothesLocked/buyClothes)
//   (server: python -m http.server <port> --bind 127.0.0.1 i spelmappen)
//   node tools/garderob-kop-test.mjs [--shots mapp]      (port 8788; annan: SMOKE_PORT=/PORT=)
import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const shotDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|ERR_|Failed to load resource|WebSocket/i.test(m.text()) && errs.push(m.text()));

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };
const ev = (fn, arg) => page.evaluate(fn, arg);
const D = (fn, ...a) => ev(([fn, a]) => { const v = window.SF.scene._debug[fn]; return typeof v === 'function' ? v(...a) : v; }, [fn, a]);
const waitFor = async (fn, ms = 8000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await page.waitForTimeout(100); } return false; };
const shot = async (name) => { if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` }).catch(() => {}); };
const closeAnyModal = () => ev(() => document.querySelector('#modal:not(.hidden) [data-close], #modal:not(.hidden) .dlg-foot .btn')?.click());
const stored = () => ev(() => JSON.parse(localStorage.getItem('snabbfilen_save1') || 'null'));
const W = (fn, ...a) => ev(async ([fn, a]) => { const m = await import('/js/data/wardrobe.js'); const it = m.itemById(a[0]); return fn === 'item' ? (it && { id: it.id, name: it.name.replace(/­/g, ''), price: it.price, slot: it.slot, legacy: it.legacy || null, free: !!it.free }) : null; }, [fn, a]);

// In genom stadens dörr: till stadsdelen, gå till husets dörr (city _debug.enter) och vänta
// på butikens scen. Klockan hålls på lunch så att alla butiker är öppna.
async function viaDoor(district, house, scene) {
  const b = await ev(([d, h]) => {
    const S = window.SF; S.game.min = 12 * 60; S.go('city');
    S.scene._debug.district(d);
    const b = S.scene._debug.buildings.find((x) => x.id === h);
    return b ? { sign: b.sign, enter: b.enter || null } : null;
  }, [district, house]);
  const walking = !!b?.enter && await ev((h) => window.SF.scene._debug.enter(h), house);
  const inside = walking && await waitFor((s) => { if (window.SF.game.min > 13 * 60) window.SF.game.min = 12 * 60; return window.SF.sceneName === s; }, 30000, scene);
  ok(inside, `dörren ${b?.sign || house} i ${district} leder in (enter: ${b?.enter || 'saknas'} → scen ${scene})`);
  if (!inside) await ev((s) => window.SF.go(s), scene); // resten av testet går ändå att köra
  await page.waitForTimeout(400);
}

// omladdning med nytt försök: ibland avbryts den av en navigering som redan pågår (ERR_ABORTED)
async function reload() {
  for (let i = 0; ; i++) {
    try { await page.reload(); return; } catch (e) { if (i >= 2) throw e; await page.waitForTimeout(600); }
  }
}

async function boot() {
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await closeAnyModal();
  await page.waitForTimeout(200);
}

// ================= 1. gammal sparfil med 'kind:v' =================
console.log('— gammal sparfil (kind:v) migreras —');
const OLD = ['hat:cap', 'top:hoodie', 'phones:true'];
await page.goto(`http://localhost:${PORT}/index.html?world=gk${Date.now().toString(36)}`);
await ev((old) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Garderob', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', top: 'hoodie', shirt: '#3a7bd5', pants: '#2d3a5c', hat: 'cap' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 20000, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: old }));
}, OLD);
await reload();
await boot();
let g = await ev(() => { const g = window.SF.game; return { w: [...g.wardrobe], keep: [...(g._keep?.wardrobe || [])], owns: ['hat-cap', 'top-hoodie', 'phones-over', 'top-suit'].map((id) => g.ownsWardrobe(id)), ids: g.ownedWardrobeIds(), lockPhones: g.clothesLocked('phones', true), lockSuit: g.clothesLocked('top', 'suit')?.name || null }; });
ok(['hat-cap', 'top-hoodie', 'phones-over'].every((id) => g.w.includes(id)), `katalog-id efter laddningen (${g.w.join(', ')})`);
ok(OLD.every((k) => g.w.includes(k)), 'de gamla nycklarna står kvar som alias');
ok(g.keep.length === 0, `inget hamnade i _keep (${g.keep.join(', ') || 'tomt'})`);
ok(g.owns.join() === 'true,true,true,false', `ownsWardrobe: keps, huvtröja, hörlurar ägs – kavajen inte (${g.owns.join()})`);
ok(['top-tee', 'bottom-jeans', 'hat-cap', 'top-hoodie', 'phones-over'].every((id) => g.ids.includes(id)) && !g.ids.includes('top-suit'), `ownedWardrobeIds: basplagg + de tre (${g.ids.length} st)`);
ok(g.lockPhones === null && g.lockSuit === 'Kavaj med slips', 'gamla API:t: clothesLocked(phones) = ägd, (top, suit) = låst');
await ev(() => window.SF.game.save());
let s = await stored();
ok([...OLD, 'hat-cap', 'top-hoodie', 'phones-over'].every((k) => s.wardrobe.includes(k)), 'sparfilen har både katalog-id och gamla nycklar (äldre versioner känner igen plaggen)');
const money0 = await ev(() => window.SF.game.money);

// ================= 2a. klädaffären: ett nytt katalogplagg =================
console.log('— klädaffären: nytt katalogplagg —');
await ev(() => { window.SF.game.event = null; });
await viaDoor('CENTRUM', 'klader', 'klader');
// en ställning på plan 1 med en ny överdel (utan gammal nyckel) som man inte äger
const pick = await ev(async () => {
  const m = await import('/js/data/wardrobe.js');
  const g = window.SF.game;
  for (const p of window.SF.scene._debug.places()) {
    if (!p.id || p.kind !== 'rack') continue;
    const idx = p.items.findIndex((id) => { const it = m.itemById(id); return it && it.slot === 'top' && !it.legacy && !it.free && !g.ownsWardrobe(id); });
    if (idx >= 0) return { place: p.id, idx, id: p.items[idx] };
  }
  return null;
});
ok(!!pick, `en ställning med en ny överdel: ${pick?.place} → ${pick?.id}`);
const topId = pick?.id;
const topInfo = await W('item', topId);
await D('open', 'rack-' + pick.place);
ok(await waitFor(() => document.querySelectorAll('#modal .klg-card').length > 3, 9000), 'klick på ställningen → bläddringsdialogen');
await ev((i) => document.querySelectorAll('#modal .klg-card')[i].click(), pick.idx);
ok(await waitFor((n) => (document.querySelector('#modal .dlg-head h2')?.textContent || '').replace(/­/g, '').includes(n), 4000, topInfo.name), `köpdialogen för ${topInfo.name}`);
await shot('1-klader-dialog');
let before = await ev(() => window.SF.game.money);
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(300);
g = await ev((id) => ({ money: window.SF.game.money, owns: window.SF.game.ownsWardrobe(id), w: window.SF.game.wardrobe.includes(id), top: window.SF.avatar.look.top }), topId);
ok(g.owns && g.w && before - g.money === topInfo.price, `${topInfo.name} köpt för ${topInfo.price} kr (${before - g.money}) och sparad som katalog-id`);
await closeAnyModal();

// ================= 2b. skobutiken =================
console.log('— skobutiken —');
await viaDoor('DOWNTOWN', 'skor', 'skor');
const shoeId = (await D('items')).find((it) => !it.owned && it.id !== 'shoes-cleats')?.id;
const shoeInfo = await W('item', shoeId);
ok(!!shoeId && !shoeInfo.legacy, `en sko man inte äger: ${shoeId}`);
await D('open', shoeId, 0);
ok(await waitFor(() => !!document.querySelector('#modal:not(.hidden) .dlg-foot .btn-go'), 4000), `köpdialogen för ${shoeInfo.name}`);
await shot('2-skor-dialog');
before = await ev(() => window.SF.game.money);
await ev(() => document.querySelector('#modal .dlg-foot .btn-go').click());
await page.waitForTimeout(300);
g = await ev((id) => ({ money: window.SF.game.money, owns: window.SF.game.ownsWardrobe(id), shoe: window.SF.avatar.look.shoeType }), shoeId);
ok(g.owns && before - g.money === shoeInfo.price, `${shoeInfo.name} köpta för ${shoeInfo.price} kr (${before - g.money}), på fötterna: ${g.shoe}`);
await closeAnyModal();

// ================= 2c. accessoarbutiken =================
console.log('— accessoarbutiken —');
await viaDoor('DOWNTOWN', 'accessoarer', 'accessoarer');
const accId = await ev(async () => {
  const m = await import('/js/data/wardrobe.js');
  return m.itemsForSlot('glasses').find((it) => !it.legacy && !it.free && !window.SF.game.ownsWardrobe(it.id))?.id || null;
});
const accInfo = await W('item', accId);
ok(!!accId, `nya glasögon man inte äger: ${accId}`);
await D('open', accId);
ok(await waitFor(() => [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].some((b) => /Köp/.test(b.textContent)), 4000), `köpdialogen för ${accInfo.name}`);
await shot('3-acc-dialog');
before = await ev(() => window.SF.game.money);
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Köp/.test(b.textContent)).click());
await page.waitForTimeout(300);
g = await ev((id) => ({ money: window.SF.game.money, owns: window.SF.game.ownsWardrobe(id), glasses: window.SF.avatar.look.glasses }), accId);
ok(g.owns && before - g.money === accInfo.price, `${accInfo.name} köpta för ${accInfo.price} kr (${before - g.money}), på: ${g.glasses}`);
await closeAnyModal();

// ================= 2d. frisören =================
console.log('— frisören —');
await viaDoor('DOWNTOWN', 'frisor', 'frisor');
await page.waitForTimeout(200);
await D('sit', 1);
await D('samiNow');
ok(await waitFor(() => !!document.querySelector('.dlg-frisor'), 10000), 'i stolen: frisyrväljaren öppnas');
await page.click('.fr-chip[data-g="Rakat"]');
await page.click('.fr-tile[data-style="mohawk"]');
await shot('4-frisor-valjare');
before = await ev(() => window.SF.game.money);
await page.click('.fr-go');
await page.waitForTimeout(200);
await D('finish');
await page.waitForTimeout(200);
g = await ev(() => ({ money: window.SF.game.money, style: window.SF.avatar.look.style }));
ok(g.style === 'mohawk' && before - g.money === 100, `ny frisyr: ${g.style} för ${before - g.money} kr`);
await closeAnyModal();

// ================= 3. omladdning → garderoben hemma =================
console.log('— omladdning: garderoben hemma —');
const bought = [topId, shoeId, accId];
await ev(() => window.SF.go('city'));
await reload();
await boot();
g = await ev((ids) => ({ owns: ids.map((id) => window.SF.game.ownsWardrobe(id)), money: window.SF.game.money, style: window.SF.avatar.look.style, keep: [...(window.SF.game._keep?.wardrobe || [])] }), [...bought, 'hat-cap', 'top-hoodie', 'phones-over']);
ok(g.owns.every(Boolean), `efter omladdning äger man alla sex (${g.owns.join()})`);
ok(g.money === money0 - topInfo.price - shoeInfo.price - accInfo.price - 100, `pengarna stämmer (${money0} → ${g.money})`);
ok(g.style === 'mohawk', 'frisyren finns kvar');
ok(g.keep.length === 0, 'inga katalog-id i _keep');
s = await stored();
ok([...bought, ...OLD].every((k) => s.wardrobe.includes(k)), 'sparfilen: nya katalog-id + de gamla nycklarna');

await ev(() => window.SF.go('room'));
await page.waitForTimeout(300);
await ev(() => { const p = window.SF.scene._debug.spot('garderob'); window.SF.scene.down(p.x, p.y); });
ok(await waitFor(() => !!document.querySelector('.av-tab[data-tab="top"]'), 8000), 'garderoben (avatarredigeraren) öppnas hemma');
// visar en flik med alla grupper ("Alla") och returnerar rutornas plagg-id + låstexten
async function tab(id) {
  await page.click(`.av-tab[data-tab="${id}"]`);
  await page.waitForTimeout(300);
  const all = await page.$('.av-panel .av-chip[data-g="*"]');
  if (all) { await all.click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(500); // rutorna ritas lat
  return ev(() => ({
    items: [...document.querySelectorAll('.av-panel [data-item]')].map((b) => b.dataset.item),
    notown: [...document.querySelectorAll('.av-panel .av-notown[data-item]')].map((b) => b.dataset.item),
    more: [...document.querySelectorAll('.av-panel .av-more')].map((p) => p.textContent).join(' '),
    styleTiles: document.querySelectorAll('.av-panel [data-k="style"]').length,
    salon: document.querySelector('.av-panel [data-salon="style"]')?.getAttribute('title') || null,
    hairColors: document.querySelectorAll('.av-panel [data-k="hair"], .av-panel [data-k="hair2"], .av-panel [data-k="hairFx"]').length,
    salonText: document.querySelector('.av-panel')?.textContent || '',
  }));
}
const lockedOf = (slot, owned) => ev(async ([slot, owned]) => { const m = await import('/js/data/wardrobe.js'); return m.itemsForSlot(slot).filter((it) => !it.free && !owned.includes(it.id)).map((it) => it.id); }, [slot, owned]);
let t = await tab('top');
await shot('5-garderob-top');
let locked = await lockedOf('top', [topId, 'top-hoodie']);
ok(t.items.includes(topId) && !t.notown.includes(topId), `Överdel: ${topInfo.name} (nytt katalogplagg) går att välja`);
ok(t.items.includes('top-hoodie') && t.items.includes('top-tee'), 'Överdel: huvtröjan (gammal sparfil) och basplaggen finns');
ok(locked.length > 50 && locked.every((id) => !t.items.includes(id)) && /🔒\s*\d+ fler/.test(t.more), `Överdel: ${locked.length} oköpta är låsta (${t.more.trim()})`);
t = await tab('shoes');
await shot('6-garderob-skor');
locked = await lockedOf('shoes', [shoeId]);
ok(t.items.includes(shoeId) && locked.every((id) => !t.items.includes(id)), `Skor: ${shoeInfo.name} finns, ${locked.length} oköpta låsta`);
t = await tab('glasses');
await shot('7-garderob-glasogon');
locked = await lockedOf('glasses', [accId]);
ok(t.items.includes(accId) && locked.every((id) => !t.items.includes(id)), `Glasögon: ${accInfo.name} finns, ${locked.length} oköpta låsta`);
t = await tab('hat');
ok(t.items.includes('hat-cap') && t.items.includes('phones-over'), 'Huvud: kepsen och hörlurarna från den gamla sparfilen');
t = await tab('hair');
await shot('8-garderob-har');
ok(t.salon === 'Tuppkam' && await ev(() => window.SF.avatar.look.style) === 'mohawk', `Hår: frisyren från frisören syns (${t.salon})`);
ok(t.styleTiles === 0 && /Frisören/.test(t.salonText), `Hår: frisyren byts hos frisören, inte hemma (${t.styleTiles} frisyrrutor)`);
t = await tab('hairColor');
ok(t.hairColors === 0 && /Frisören/.test(t.salonText), `Hårfärg: fixas hos frisören, inga färgval hemma (${t.hairColors})`);
await page.click('.av-cancel');
await page.waitForTimeout(200);
// en NY figur (Nytt spel) väljer frisyr och hårfärg fritt – spärren gäller bara den man spelar
const fresh = await ev(async () => {
  const av = await import('/js/core/avatar.js');
  av.openAvatarEditor({ fresh: true });
  document.querySelector('.av-tab[data-tab="hair"]').click();
  document.querySelector('.av-panel .av-chip[data-g="*"]')?.click(); // alla frisyrgrupper
  const n = document.querySelectorAll('.av-panel [data-k="style"]').length;
  document.querySelector('.av-tab[data-tab="hairColor"]').click();
  const c = document.querySelectorAll('.av-panel [data-k="hair"]').length;
  document.querySelector('.dlg-foot .av-cancel')?.click();
  return { n, c, salon: av.avatarSalon() };
});
ok(fresh.n > 80 && fresh.c > 0 && fresh.salon.style && fresh.salon.color, `ny figur: alla ${fresh.n} frisyrer och hårfärgerna går att välja (spärren på: ${JSON.stringify(fresh.salon)})`);
await closeAnyModal();

// dagboken räknar mot hela katalogen
await page.click('#hud-diary');
await page.waitForTimeout(300);
const diary = await ev(() => document.querySelector('#modal:not(.hidden) .dlg-body')?.textContent || document.querySelector('#modal:not(.hidden)')?.textContent || '');
const cnt = await ev(() => window.SF.game.wardrobeCount());
ok(cnt.owned === 6 && cnt.of > 300 && new RegExp(`Köpta plagg\\s*${cnt.owned} av ${cnt.of}`).test(diary), `dagboken: Köpta plagg ${cnt.owned} av ${cnt.of}`);
await closeAnyModal();

// ================= 4. game.js-API:t =================
console.log('— game.js: priser och köp —');
const api = await ev(async () => {
  const m = await import('/js/data/wardrobe.js');
  const g = window.SF.game;
  const free = m.WARDROBE.filter((it) => !it.free && !it.legacy && !g.ownsWardrobe(it.id));
  const a = free[0], b = free[free.length - 1];
  const out = {};
  g.event = { id: 'rea' };
  out.rea = [g.itemPrice(a), Math.round(a.price * 0.75), g.itemPrice(a.id)];
  let m0 = g.money; const r1 = g.buyWardrobe(a.id);
  out.reaBuy = [r1.ok, m0 - g.money, r1.price];
  g.event = null;
  out.again = g.buyWardrobe(a.id).ok;
  out.freeBuy = g.buyWardrobe('top-tee').ok;
  out.unknown = g.buyWardrobe('top-finnsinte').ok;
  const keep = g.money; g.money = 10;
  const r2 = g.buyWardrobe(b.id); out.poor = [r2.ok, r2.msg, g.money, g.ownsWardrobe(b.id)];
  g.money = keep;
  m0 = g.money; const r3 = g.buyClothes('top', 'suit');
  out.old = [r3.ok, m0 - g.money, g.wardrobe.includes('top-suit'), g.wardrobe.includes('top:suit'), g.clothesLocked('top', 'suit')];
  out.aliases = [g.ownsItem('hat:cap'), g.ownsWardrobe('top:suit'), g.itemPrice('top:suit'), g.ownedItemIds().length === g.ownedWardrobeIds().length];
  return out;
});
ok(api.rea[0] === api.rea[1] && api.rea[2] === api.rea[1], `REA: itemPrice −25 % (${api.rea.join(' / ')})`);
ok(api.reaBuy[0] && api.reaBuy[1] === api.rea[1] && api.reaBuy[2] === api.rea[1], `REA-köp drar ${api.reaBuy[1]} kr`);
ok(api.again === false && api.freeBuy === false && api.unknown === false, 'redan köpt, basplagg och okänt id går inte att köpa');
ok(api.poor[0] === false && /råd/.test(api.poor[1]) && api.poor[2] === 10 && !api.poor[3], `för lite pengar: inget köp (${api.poor[1]})`);
ok(api.old[0] && api.old[1] === 1500 && api.old[2] && api.old[3] && api.old[4] === null, 'gamla buyClothes(top, suit): 1500 kr, katalog-id + gamla nyckeln');
ok(api.aliases[0] && api.aliases[1] && api.aliases[2] === 1500 && api.aliases[3], 'ownsItem/itemPrice förstår gamla nycklar, ownedItemIds = ownedWardrobeIds');

// ================= 5. äldre version: sparfilen går att läsa med den gamla koden =================
// (den gamla load() behöll bara SORTIMENT-nycklar och lade resten i _keep – så länge de gamla
//  nycklarna står kvar ser en äldre flik sina plagg, och katalog-id:n skrivs tillbaka orörda)
s = await stored();
const SORT = await ev(async () => (await import('/js/game.js')).SORTIMENT.map((x) => `${x.kind}:${x.v}`));
const oldSees = s.wardrobe.filter((k) => SORT.includes(k));
ok(['hat:cap', 'top:hoodie', 'phones:true', 'top:suit'].every((k) => oldSees.includes(k)), `en äldre version ser ${oldSees.length} plagg (${oldSees.join(', ')})`);

console.log(errs.length ? '\nKONSOLFEL:\n' + errs.join('\n') : '\nInga konsolfel.');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
