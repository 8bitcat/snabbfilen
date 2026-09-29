// Funktionstest av klädaffären (två våningar): hela katalogen på galgarna, köp med katalog-id
// via riktiga klick, bläddringsdialogen, trappan upp och ner, Kungsladugård-laget, de kända
// lagen, fotbollsskorna, matchställ-köpet (skorna får aldrig färga shortsen), "Ta på mig" när
// tröjmodellen redan är ens egen, lagfotot i stort, bollen på provplanen, sparningen och till
// sist en riktig mobil (pekskärm, NÄRA-läget) där väggen är beskuren och kameran följer i höjdled.
//   (server: python -m http.server <port> --bind 127.0.0.1 i spelmappen)
//   PORT=8751 node tools/klader-test.mjs [--shots mapp]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8751;
const shotDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const url = `http://localhost:${PORT}/index.html?world=kltest${Date.now().toString(36)}`;
await page.goto(url);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 14 * 60, money: 20000, hunger: 60, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: ['hat:cap'] }));
});
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { window.SF.game.event = null; window.SF.go('klader'); });
await page.waitForTimeout(300);

let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FEL  ') + msg); if (!c) fails++; };
const D = (fn, ...a) => page.evaluate(([fn, a]) => { const v = window.SF.scene._debug[fn]; return typeof v === 'function' ? v(...a) : v; }, [fn, a]);
const shot = async (name) => { if (!shotDir) return; const m = await page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden')); await (m ? page.screenshot({ path: `${shotDir}/${name}.png` }) : page.locator('#scene').screenshot({ path: `${shotDir}/${name}.png` })).catch(() => {}); };
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene').getBoundingClientRect(); const A = window.SF; return { l: c.left, t: c.top, w: c.width, h: c.height, lw: document.querySelector('#scene').width / A.pxs, lh: document.querySelector('#scene').height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
// klicka på en plats; ligger den utanför bild riktas kameran dit först
async function clickSpot(id) {
  let p = await D('spot', id);
  if (!p) throw new Error('ingen plats ' + id);
  const vw = await D('view');
  if (p.x < 4 || p.x > vw - 4) {
    const c = await D('cam');
    await D('lockCam', Math.max(0, c.x + p.x - vw / 2));
    p = await D('spot', id);
    await clickView(p.x, p.y);
    await D('lockCam', null);
    return;
  }
  await clickView(p.x, p.y);
}
const waitFor = async (fn, ms = 8000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); } return false; };
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalTitle = () => page.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const closeModal = () => page.evaluate(() => document.querySelector('#modal [data-close]')?.click());
const state = () => page.evaluate(() => ({ money: window.SF.game.money, wardrobe: [...window.SF.game.wardrobe], look: { ...window.SF.avatar.look } }));

// ---- katalogen: varje säljbar över-/underdel hänger någonstans, och alla går att rita på galge ----
const cover = await page.evaluate(async () => {
  const W = await import('/js/data/wardrobe.js');
  const G = await import('/js/scenes/klader/garment.js');
  const sell = W.WARDROBE.filter((it) => (it.slot === 'top' || it.slot === 'bottom') && !it.free);
  const places = window.SF.scene._debug.places();
  const seen = new Set(places.flatMap((p) => p.items));
  const missing = sell.filter((it) => !seen.has(it.id)).map((it) => it.id);
  const noImg = sell.filter((it) => !G.garmentImg(it)).map((it) => it.id);
  const wrongDept = places.filter((p) => p.dept === 'tjej' || p.dept === 'kille').flatMap((p) => p.items.filter((id) => { const d = W.itemById(id).dept; return d !== p.dept && d !== 'unisex'; }));
  return { n: sell.length, places: places.length, missing, noImg, wrongDept, problems: W.checkWardrobe() };
});
ok(cover.missing.length === 0, `alla ${cover.n} säljbara över-/underdelar hänger på någon av ${cover.places} ställningar${cover.missing.length ? ' – saknas: ' + cover.missing.join(', ') : ''}`);
ok(cover.noImg.length === 0, `alla plagg går att rita på galge${cover.noImg.length ? ' – inte: ' + cover.noImg.join(', ') : ''}`);
ok(cover.wrongDept.length === 0, `tjejavdelningen visar bara tjej + unisex, killavdelningen kille + unisex${cover.wrongDept.length ? ': ' + cover.wrongDept.join(', ') : ''}`);
ok(cover.problems.length === 0, 'klädkatalogen utan problem (checkWardrobe)' + (cover.problems.length ? ': ' + cover.problems.join(' | ') : ''));
ok(await page.evaluate(() => { const g = window.SF.game; return (typeof g.buyWardrobe === 'function' && typeof g.ownsWardrobe === 'function') || (typeof g.buyItem === 'function' && typeof g.ownsItem === 'function'); }), 'game.js kan köpa med katalog-id (buyWardrobe/ownsWardrobe eller buyItem/ownsItem – integratörens patch)');

// ---- plan 1: huvtröjan på dockan (samma som röktestet) ----
ok(await D('floor') === 1, 'man kommer in på plan 1 vid dörren');
await shot('klader-a-plan1');
const hoodie = (await D('dummies')).indexOf('top:hoodie');
ok(hoodie >= 0, 'huvtröjan står på en docka (gamla nyckeln i _debug.dummies)');
let s0 = await state();
await clickSpot('dummy' + hoodie);
ok(await waitFor(() => /Huvtröja/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 9000), 'klick på dockan → figuren går dit → köpdialogen "Huvtröja"');
await shot('klader-b-dlg-huvtroja');
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
let s1 = await state();
ok(s1.wardrobe.includes('top:hoodie') && s0.money - s1.money === 250, `huvtröjan köpt för 250 kr och sparad med gamla nyckeln (${s1.wardrobe.join(', ')})`);
ok(s1.look.top === 'hoodie', 'och man har den på sig');

// ---- plan 1: bläddra bland kjolarna och köp en ny katalogkjol ----
await clickSpot('rack-tjKjolar');
ok(await waitFor(() => /Kjolar/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && document.querySelectorAll('#modal .klg-card').length > 10, 9000), 'klick på klädställningen KJOLAR → bläddringsdialogen med alla kjolar');
const cards = await page.evaluate(() => [...document.querySelectorAll('#modal .klg-card')].map((b) => b.title));
const kjolar = (await D('places')).find((p) => p.id === 'tjKjolar');
ok(cards.length === kjolar.n, `dialogen visar alla ${kjolar.n} kjolar (${cards.length} kort)`);
await page.waitForTimeout(400);
ok(await page.evaluate(() => [...document.querySelectorAll('#modal .klg-card canvas')].length === document.querySelectorAll('#modal .klg-card').length), 'varje kort har en bild av MIG i plagget');
await shot('klader-c-bladdra-kjolar');
const tutuIdx = kjolar.items.indexOf('bottom-tutu');
ok(tutuIdx >= 0, 'tyllkjolen finns bland kjolarna');
s0 = await state();
await page.evaluate((i) => document.querySelectorAll('#modal .klg-card')[i].click(), tutuIdx);
ok(await waitFor(() => /Tyllkjol/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 3000), 'klick på kortet → köpdialogen för tyllkjolen (med ⬅️ Tillbaka)');
ok(await page.evaluate(() => /Tillbaka/.test(document.querySelector('#modal .dlg-foot').textContent)), 'tillbaka-knappen finns');
await page.evaluate(() => document.querySelectorAll('#modal [data-c]')[3]?.click()); // prova en annan färg
await shot('klader-d-dlg-tyllkjol');
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
s1 = await state();
ok(s1.wardrobe.includes('bottom-tutu') && s0.money - s1.money === 349, `tyllkjolen köpt med katalog-id för 349 kr (${s0.money - s1.money})`);
ok(s1.look.bottom === 'tutu', 'tyllkjolen sitter på figuren');
ok(await D('owns', 'bottom-tutu'), 'ownsWardrobe(bottom-tutu) = sant');

// ---- en tröja från killarnas vägg via bläddring ----
await clickSpot('mod-kiTrojor');
ok(await waitFor(() => /Tröjor/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 12000), 'killarnas väggmodul TRÖJOR → bläddringsdialogen');
await closeModal();

// ---- råd och REA ----
await page.evaluate(() => { window.SF.game.money = 20; });
await D('open', 'dummy' + (await D('dummies')).indexOf('top:suit'));
ok(await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go')?.disabled === true && /saknar/.test(document.querySelector('#modal').innerText)), 'för lite pengar → köpknappen avstängd och "du saknar …"');
await closeModal();
await page.evaluate(() => { window.SF.game.money = 20000; window.SF.game.event = { id: 'rea' }; });
await D('open', 'dummy' + (await D('dummies')).indexOf('top:suit'));
ok(await page.evaluate(() => /1\s?125/.test(document.querySelector('#modal').innerText) && /REA/.test(document.querySelector('#modal').innerText)), 'REA-dag: kavajen 1500 → 1125 kr');
await closeModal();
await page.evaluate(() => { window.SF.game.event = null; });

// ---- trappan upp ----
await clickSpot('trappa');
ok(await waitFor(() => !!window.SF.scene._debug.climb(), 12000), 'klick på trappan → figuren går dit och börjar gå uppför');
await page.waitForTimeout(900);
await shot('klader-e-i-trappan');
ok(await waitFor(() => window.SF.scene._debug.floor() === 2, 12000), 'uppe i taket → plan 2');
ok(await waitFor(() => !window.SF.scene._debug.climb(), 9000), 'kliver av trappan på plan 2');
const wy = await page.evaluate(() => window.SF.scene.worldY);
ok(wy >= 1000, `andra spelare ser mig på plan 2 (worldY ${Math.round(wy)} ≥ 1000)`);
await page.waitForTimeout(600);
await shot('klader-f-plan2');

// ---- Kungsladugård ----
const kungs = await D('kungs');
const WANT = [[3, 'Klara'], [5, 'Saga'], [6, 'Valencia'], [7, 'Alice'], [8, 'Nina'], [9, 'Alice'], [10, 'Märta'], [11, 'Isabelle'], [12, 'Elisa'], [13, 'Natalia'], [14, 'Kajsa'], [15, 'Moa'], [16, 'Isabella'], [17, 'Edessa'], [18, 'Julie'], [19, 'Ellen'], [20, 'Lily'], [23, 'Noomi'], [34, 'Julia']];
ok(kungs.length === 19 && WANT.every(([n, name], i) => kungs[i].n === n && kungs[i].name === name), 'hela Kungsladugård-laget står där: 19 spelare med rätt nummer och förnamn');
const julia = kungs.findIndex((k) => k.n === 34);
await clickSpot('kungs' + julia);
ok(await waitFor(() => /Kungsladugårds matchställ/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && /Nr 34 · Julia/.test(document.querySelector('#modal').innerText), 12000), 'klick på nr 34 → matchställdialogen "Nr 34 · Julia"');
ok(await page.evaluate(() => { const c = document.querySelector('#modal [data-back] canvas'); if (!c) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i + 1] > 230 && d[i + 2] > 220) n++; return n > 200; }), 'ryggen i stort i dialogen: vita tryckpixlar (nummer + förnamn)');
// vrid figurerna till ryggen: den nya har 34 på tröjan (ljusa sifferpixlar), den nuvarande inget nummer
await page.click('#modal [data-turn="1"]');
await page.click('#modal [data-turn="1"]');
const nr = await page.evaluate(() => {
  const n = (sel) => { const c = document.querySelector(`#modal [data-fig="${sel}"] canvas`); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 0xf4 && d[i + 1] === 0xf1 && d[i + 2] === 0xea && d[i + 3] === 255) k++; return k; };
  return { view: document.querySelector('#modal [data-view]').textContent, nu: n('now'), nytt: n('new') };
});
ok(nr.nytt > 0 && nr.nu === 0, `bakifrån i dialogen (${nr.view}): numret syns på den nya tröjan (${nr.nytt} px), inte på nuvarande kläder`);
await shot('klader-g-dlg-matchstall');
s0 = await state();
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
s1 = await state();
ok(s1.wardrobe.includes('top-football') && s1.wardrobe.includes('bottom-sportShorts') && !s1.wardrobe.includes('shoes-cleats'), 'tröja + shorts köpta (skorna var inte ikryssade)');
ok(s1.look.shirtNum === 34, `Julias tröja har nummer 34 på ryggen (shirtNum ${s1.look.shirtNum})`);
ok(s0.money - s1.money === 390 + 229, `betalt ${s0.money - s1.money} kr (390 + 229)`);
ok(s1.look.top === 'football' && s1.look.shirt === '#7a1f2e' && s1.look.accent === '#d9434b' && s1.look.bottom === 'sportShorts', 'figuren har vinröd matchtröja med ljusröda ärmslut och svarta shorts');

// ---- delvis ägt (tröja + shorts, inga skor): ett annat lags matchställ går att TA PÅ ----
const teams0 = await D('teams');
const malmo = teams0.findIndex((t) => t.city === 'MALMÖ');
await D('open', 'lag' + malmo);
await page.waitForTimeout(250);
const mbtn = await page.evaluate(() => { const b = document.querySelector('#modal .dlg-foot .btn-go'); return { dis: b.disabled, txt: b.textContent.trim() }; });
ok(!mbtn.dis && /Ta på mig i Malmös färger/.test(mbtn.txt), `tröja + shorts ägda, skorna inte: knappen "${mbtn.txt}" går att trycka`);
ok(await page.evaluate(() => /har du redan/.test(document.querySelector('#modal').innerText) && !/DIN\b/.test(document.querySelector('#modal').innerText)), 'dialogen säger att tröjan redan är min (samma modell för flera lag)');
await shot('klader-g2-malmo-delvis');
s0 = await state();
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
s1 = await state();
ok(s1.money === s0.money && s1.look.shirt === '#8ec8ef' && s1.look.pants === '#f4f1ea' && !(await modalOpen()), `Ta på: Malmös himmelsblå tröja + vita shorts, inget köp (shirt ${s1.look.shirt}, pants ${s1.look.pants})`);
ok(!('shirtNum' in s1.look), 'Malmös tröja har inget ryggnummer (bara Kungsladugårds spelare har nummer)');
const pl = await D('plates');
const ti = (c) => teams0.findIndex((t) => t.city === c);
ok(pl.teams[malmo] === 'PÅ DIG' && pl.teams[ti('STOCKHOLM')] === 'TA PÅ DIG' && pl.teams[ti('GÖTEBORG')] === 'PRIS' && pl.kit === 'TA PÅ DIG', `lapparna: Malmö PÅ DIG, Stockholm TA PÅ DIG, Göteborg pris, matchstället TA PÅ DIG (${pl.teams.join(', ')} · ${pl.kit})`);
// varje spelare har sitt eget nummer: tröjan är redan min → "Ta på" som nr 7 Alice och nr 23 Noomi
for (const n of [7, 23]) {
  await D('open', 'kungs' + kungs.findIndex((k) => k.n === n));
  await page.waitForTimeout(200);
  await page.click('#modal .dlg-foot .btn-go');
  await page.waitForTimeout(200);
  s1 = await state();
  ok(s1.look.shirtNum === n && s1.look.shirt === '#7a1f2e', `Kungsladugård nr ${n}: numret ${n} på ryggen (shirtNum ${s1.look.shirtNum})`);
}

// ---- fotbollsskorna på väggen ----
await clickSpot('skor-rosa');
ok(await waitFor(() => /Rosa fotbollsskor/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 12000), 'klick på de rosa fotbollsskorna → köpdialogen');
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
s1 = await state();
ok(s1.wardrobe.includes('shoes-cleats') && s1.look.shoeType === 'cleats' && s1.look.shoes === '#ff6fb5', 'fotbollsskorna köpta – rosa på fötterna');

// ---- kända lag ----
const teams = await D('teams');
ok(teams.length === 12 && teams.every((t) => /^[A-ZÅÄÖ]+$/.test(t.city)), `tolv kända lag, bara stadsnamn (${teams.map((t) => t.city).join(', ')})`);
const gbg = teams.findIndex((t) => t.city === 'GÖTEBORG');
await clickSpot('lag' + gbg);
ok(await waitFor(() => /Göteborgs matchställ/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 12000), 'klick på GÖTEBORG → Göteborgs matchställ');
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
s1 = await state();
ok(s1.wardrobe.includes('top-football-stripes') && s1.look.topPrint === 'vStripes' && s1.look.shirt === '#f4f1ea', 'den randiga tröjan köpt i blåvitt');
ok(s1.look.pants === '#1f4fa0', `Göteborgs blå shorts – fotbollsskorna (ägda) färgar inte shortsen (${s1.look.pants})`);

// ---- allt ägt: Malmö och Barcelona – "Ta på mig", skorna rör aldrig shortsen ----
for (const [city, shirt, pants] of [['MALMÖ', '#8ec8ef', '#f4f1ea'], ['BARCELONA', '#1f3f8f', '#1f3f8f']]) {
  await D('open', 'lag' + ti(city));
  await page.waitForTimeout(200);
  const txt = await page.evaluate(() => document.querySelector('#modal .dlg-foot .btn-go').textContent);
  await page.click('#modal .dlg-foot .btn-go');
  await page.waitForTimeout(200);
  s1 = await state();
  ok(/Ta på mig/.test(txt) && s1.look.shirt === shirt && s1.look.pants === pants && s1.look.shoes === '#26242c', `${city}: "${txt.trim()}" → tröja ${s1.look.shirt}, shorts ${s1.look.pants} (väntat ${pants}), svarta fotbollsskor`);
}

// ---- bollen på provplanen ----
await clickSpot('boll');
ok(await waitFor(() => window.SF.scene._debug.ball().st !== 'rest', 12000), 'klick på bollen → figuren går dit och skjuter');
await page.waitForTimeout(500);
await shot('klader-h-mal');
ok(await waitFor(() => window.SF.scene._debug.ball().st === 'rest', 6000), 'bollen rullar tillbaka');

// ---- MATCHSTÄLL-dockan: köp alla tre delarna → svarta shorts (granskarens fynd: skorna gjorde dem röda) ----
await page.evaluate(() => { const g = window.SF.game; g.wardrobe = g.wardrobe.filter((k) => !['top-football', 'bottom-sportShorts', 'shoes-cleats'].includes(k)); });
await D('open', 'matchstall');
await page.waitForTimeout(250);
ok(await page.evaluate(() => [...document.querySelectorAll('#modal [data-part]')].every((b) => b.checked && !b.disabled)), 'matchställsdockan: tröja, shorts och skor ikryssade');
ok(await page.evaluate(() => /1\s?318/.test(document.querySelector('#modal .dlg-foot .btn-go').textContent)), 'Köp (1 318 kr) = 390 + 229 + 699');
await shot('klader-g3-matchstall-allt');
s0 = await state();
await page.click('#modal .dlg-foot .btn-go');
await page.waitForTimeout(200);
s1 = await state();
ok(s0.money - s1.money === 1318 && ['top-football', 'bottom-sportShorts', 'shoes-cleats'].every((k) => s1.wardrobe.includes(k)), 'alla tre delarna köpta för 1 318 kr');
ok(s1.look.shirt === '#7a1f2e' && s1.look.pants === '#1d1d22' && s1.look.pants2 === '#1d1d22' && s1.look.shoeType === 'cleats' && s1.look.shoes === '#e4f22e', `matchstället på: vinröd tröja, SVARTA shorts (${s1.look.pants}), neongula fotbollsskor (${s1.look.shoes})`);
ok((await D('plates')).kit === 'PÅ DIG', 'matchställsdockans lapp: PÅ DIG');

// ---- lagfotot i stort ----
await D('open', 'lagfoto');
await page.waitForTimeout(250);
ok(await page.evaluate(() => /laget 2026/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && document.querySelectorAll('#modal .klp-roster span').length === 19 && !!document.querySelector('#modal [data-photo] canvas')), 'lagfotot öppnas i stort med alla 19 spelare (nummer + förnamn)');
await shot('klader-g4-lagfoto');
await closeModal();

// ---- sporten: bläddra bland fotbollströjorna ----
await clickSpot('rack-spFotboll');
ok(await waitFor(() => /Fotbollströjor/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && document.querySelectorAll('#modal .klg-card.own').length >= 2, 12000), 'FOTBOLLSTRÖJOR: bläddringen visar de köpta som ✓ DIN');
await closeModal();

// ---- trappan ner ----
await clickSpot('trappa');
ok(await waitFor(() => window.SF.scene._debug.floor() === 1 && !window.SF.scene._debug.climb(), 20000), 'trappan ner → tillbaka på plan 1');
// ---- dörren ut ----
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'dörren → ut i staden');

// ---- sparat: omladdning behåller alla köp (katalog-id + gamla nycklar) ----
const before = (await state()).wardrobe.sort();
await page.reload();
await page.waitForTimeout(900);
const after = await page.evaluate(() => [...window.SF.game.wardrobe].sort());
ok(JSON.stringify(before) === JSON.stringify(after), `köpen finns kvar efter omladdning (${after.join(', ')})`);
ok(await page.evaluate(() => { const g = window.SF.game, f = (g.ownsWardrobe || g.ownsItem).bind(g); return ['top-hoodie', 'bottom-tutu', 'top-football', 'shoes-cleats', 'hat-cap', 'top-tee'].every((id) => f(id)); }), 'ägt: gamla (hat:cap) och nya plagg + gratis basplagg');
ok(await page.evaluate(async () => { const { avatarCanWear } = await import('/js/core/avatar.js'); return avatarCanWear('bottom-tutu') && !avatarCanWear('bottom-gown'); }), 'garderoben hemma: köpt katalogplagg får bäras, oköpt är låst');

// ---- mobilvyn: butiken på en telefon ----
await page.setViewportSize({ width: 740, height: 360 });
await page.evaluate(() => window.SF.go('klader', { floor: 2 }));
await page.waitForTimeout(400);
ok(await D('floor') === 2, 'A.go("klader", { floor: 2 }) öppnar plan 2 direkt');
await shot('klader-i-mobil-plan2');
await D('open', 'lag' + gbg);
await page.waitForTimeout(300);
ok(await modalOpen(), 'matchställdialogen går att öppna på en liten skärm');
await shot('klader-j-mobil-dlg');
await closeModal();
ok(await page.evaluate(() => typeof window.SF.scene.exit === 'function'), 'scenen har exit() (pratbubblan stannar i butiken)');

// ---- riktig mobil: pekskärm 812×375, NÄRA-läget beskär upptill/nertill ----
{
  const ctx = await browser.newContext({ viewport: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await ctx.newPage();
  mp.on('pageerror', (e) => errs.push('mobil: ' + e.message));
  mp.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|WebSocket|ERR_|Failed to load resource/i.test(m.text()) && errs.push('mobil: ' + m.text()));
  const MD = (fn, ...a) => mp.evaluate(([fn, a]) => { const v = window.SF.scene._debug[fn]; return typeof v === 'function' ? v(...a) : v; }, [fn, a]);
  const mshot = async (name) => { if (shotDir) await mp.screenshot({ path: `${shotDir}/${name}.png` }).catch(() => {}); };
  await mp.goto(`http://localhost:${PORT}/index.html?mobfill=1&world=klmob${Date.now().toString(36)}`);
  await mp.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobil', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', top: 'tee', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 14 * 60, money: 20000, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [] }));
    localStorage.setItem('snabbfilen_zoom', 'nara'); localStorage.setItem('snabbfilen_zoom_dator', '1'); // provar NÄRA (valt med 🔍)
  });
  await mp.reload();
  await mp.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await mp.waitForTimeout(1000);
  await mp.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); window.SF.game.event = null; window.SF.go('klader', { floor: 2 }); });
  await mp.waitForTimeout(700);
  const bd = await MD('band');
  ok(bd.y0 > 0 && bd.y1 < 216, `mobilen beskär bilden (synligt radband ${bd.y0}–${bd.y1})`);
  const inBand = (y0, y1, b) => y0 >= b.y0 && y1 <= b.y1;
  // vid lagfotot: kameran lyfter väggen in i bild, namnskylten ligger inom bandet
  await MD('teleport', 75, 82);
  await mp.waitForTimeout(500);
  let cm = await MD('cam'), lb = await MD('label');
  ok(inBand(6 + cm.ty, 67 + cm.ty, bd), `lagfotot syns på mobilen (skärm-y ${6 + cm.ty}–${67 + cm.ty} inom ${bd.y0}–${bd.y1})`);
  ok(lb && lb.name === 'LAGFOTOT' && inBand(lb.y0, lb.y0 + lb.h, bd), `namnskylten LAGFOTOT inom bilden (${lb && lb.y0})`);
  await mshot('klader-m1-mobil-lagfoto');
  // fotbollsskorna på väggen
  await MD('teleport', 500, 82);
  await mp.waitForTimeout(500);
  cm = await MD('cam');
  ok(inBand(49 + cm.ty, 62 + cm.ty, bd), 'fotbollsskorna på väggen syns på mobilen');
  // främre raden: nr 34 Julia – lappen och namnskylten syns
  const kk = (await MD('kungs')).find((k) => k.n === 34);
  await MD('teleport', kk.x, kk.y + 32);
  await mp.waitForTimeout(600);
  cm = await MD('cam'); lb = await MD('label');
  ok(await MD('focus') === 'kungs18' && lb && /34 JULIA/.test(lb.name) && inBand(lb.y0, lb.y0 + lb.h, bd), `står vid nr 34: namnskylten "${lb && lb.name}" inom bilden`);
  ok(inBand(kk.y + 7 + cm.ty, kk.y + 22 + cm.ty, bd), 'nummerskylten under nr 34 syns (ritas överst när man står vid den)');
  await mshot('klader-m2-mobil-julia');
  // dialogen: knapparna syns utan att man scrollar
  await MD('open', 'kungs18');
  await mp.waitForTimeout(400);
  const fit = await mp.evaluate(() => { const f = document.querySelector('#modal:not(.hidden) .dlg-foot'); const r = f.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
  ok(fit.bottom <= fit.h + 1 && fit.top >= 0, `matchställdialogen på mobilen: Köp-knappen syns (fot ${Math.round(fit.top)}–${Math.round(fit.bottom)} av ${fit.h})`);
  await mshot('klader-m3-mobil-dlg');
  await mp.evaluate(() => document.querySelector('#modal [data-close]')?.click());
  // en riktig tryckning på lagfotot (skärm → värld med kamerans förskjutning): figuren står
  // en bit ut på golvet, så att fotots nederkant syns i bandet och kameran är förskjuten
  await MD('teleport', 200, 112);
  await mp.waitForTimeout(500);
  const sp = await MD('spot', 'lagfoto'), cm2 = await MD('cam');
  sp.y = Math.max(bd.y0 + 5, Math.min(sp.y, 57 + cm2.ty - 3)); // en synlig del av fotot
  const pt = await mp.evaluate(([x, y]) => { const A = window.SF, cv = document.querySelector('#scene'), r = cv.getBoundingClientRect(); const lw = cv.width / A.pxs, lh = cv.height / A.pxs; return { x: r.left + (x + A.view.boxX) * r.width / lw, y: r.top + (y + A.view.boxY) * r.height / lh }; }, [sp.x, sp.y]);
  if (pt.y > 0 && pt.y < 375) await mp.touchscreen.tap(pt.x, pt.y);
  ok(await mp.waitForFunction(() => /laget 2026/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), null, { timeout: 12000 }).then(() => true, () => false), `tryck på lagfotot (mobil, skärm-y ${Math.round(pt.y)}) → figuren går dit → fotot i stort`);
  await mshot('klader-m4-mobil-lagfoto-dlg');
  await ctx.close();
}

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
