// Funktionstest av BIO PIXEL (js/scenes/shop-bio.js + js/scenes/bio/): biljettluckan och
// popcornbaren med riktiga musklick, ätregeln (popcornen följer inte med ut på gatan, sitter
// man och äter reser man sig inte), platsvakten som släpper in bara med biljett, att sätta sig
// i salongen → ljuset släcks, ridån går upp och filmen går (2 speltimmar, +energi, popcornen
// äts tugga för tugga), publiken som reagerar, eftertexterna och ljuset som tänds, att gå mitt
// i filmen, biljetten som lämnas tillbaka om man går utan att se filmen, sista biljetten 21:30,
// stängt före 12, soffan i foajén, omladdning mitt i maten och att scenen fyller en bred skärm.
// Dessutom: fliken som göms (mobilen låses) – allt provisoriskt inräknat och tillbaka igen när
// den syns, filmen belönas helt; popcorn som är betald men inte i handen än; "ät upp snabbt och
// gå" mitt i filmen; sen kväll (visningen slutar senast 23:30, ingen midnattskollaps, baren
// stänger) och mobilen i fyll-läget (pratbubblorna och duken i bild fast överkanten beskärs).
// Skärmbilder hamnar i tools/out/smast-bio/.
//   node tools/bio-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8744 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'smast-bio') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 14 * 60, money: 500, hunger: 60, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
const URL = `http://localhost:${PORT}/index.html?nomenu&world=bio${Date.now().toString(36)}`;
await page.goto(URL);
await page.evaluate((s) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(600);

const D = (fn, ...a) => page.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const ST = () => D('state');
const G = () => page.evaluate(() => { const g = window.SF.game; return { money: g.money, hunger: g.hunger, energy: g.energy, min: g.min, day: g.day }; });
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1') || 'null'));
const modalOpen = () => page.evaluate(() => !document.querySelector('#modal').classList.contains('hidden'));
const modalTitle = () => page.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '');
const modalText = () => page.evaluate(() => document.querySelector('#modal')?.innerText || '');
const clickIn = (sel) => page.evaluate((sel) => { const b = document.querySelector('#modal ' + sel); if (!b || b.disabled) return false; b.click(); return true; }, sel);
const closeDlg = async () => { await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }); await page.waitForTimeout(350); };
const waitFor = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); } return false; };
const setClock = (min) => page.evaluate((m) => { window.SF.game.min = m; }, min);
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const scene = () => page.evaluate(() => window.SF.sceneName);
async function clickView(x, y) {
  const r = await page.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await page.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
async function clickSpot(id) {
  const p = await D('spot', id);            // låser kameran över platsen om den ligger utanför bild
  if (!p) throw new Error('ingen plats ' + id);
  await clickView(p.x, p.y);
  await D('lockCam', null);
  return p;
}
const shot = (name) => page.screenshot({ path: OUT + name });
// vänta tills någon säger något som matchar (key = say/kass/godis/vakt i state())
const waitSay = (key, src, ms = 12000) => waitFor(([k, s]) => new RegExp(s).test(window.SF.scene._debug.state()[k] || ''), ms, [key, src]);
const saveUrl = (name, url) => fs.writeFileSync(OUT + name, Buffer.from(url.split(',')[1], 'base64'));

// ---------- programmet: samma sex filmer som fasaden, 20–40 s var ----------
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(500);
ok(await scene() === 'bio', "SF.go('bio') öppnar bion");
await D('hideFolk');
const films = await D('films');
const FASAD = ['PIXELHÄMNAREN 3', 'KÄRLEK PÅ PIXELGATAN', 'TURBOPOLIS', 'SOMMAR I STAN', 'SISTA NATTBUSSEN', 'AMORE PÅ SÖDER'];
ok(films.length === 6 && FASAD.every((t) => films.some((f) => f.titel === t)), `sex filmer, samma som på fasaden: ${films.map((f) => f.titel).join(', ')}`);
ok(films.every((f) => f.langd >= 20 && f.langd <= 40), `varje film är 20–40 s lång (${films.map((f) => f.langd).join(' / ')})`);
ok(films.every((f) => f.cues >= 3), 'varje film har minst tre ställen där publiken reagerar');
const cityBio = await page.evaluate(async () => { const m = await import('/js/city/map.js'); const b = m.buildingById?.('bio'); return b ? { open: b.open || null, enter: b.enter || null } : null; });
const hrs = await D('hours');
const want = cityBio?.open || [12, 24];
ok(hrs.hours[0] === want[0] && hrs.hours[1] === want[1], `öppettiderna ${hrs.hours.join('–')} är fasadens (${cityBio ? (cityBio.open || []).join('–') : 'inget bio-hus i staden'})`);
ok(hrs.open && hrs.tickets, 'kl. 14 är bion öppen och biljettluckan säljer');
let st = await ST();
ok(st.rum === 'foaje' && st.money === 500, `startläge: foajén, ${st.money} kr`);
saveUrl('pano-foaje.png', await D('panorama', 'foaje', 2));

// ---------- biljettluckan (riktiga klick) ----------
await clickSpot('lucka');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 9000), 'klick på luckan → figuren går fram och biljettdialogen öppnas');
ok(/Biljettluckan/.test(await modalTitle()), `rubrik: ${await modalTitle()}`);
ok(await page.evaluate(() => document.querySelectorAll('#modal [data-film]').length) === 6 && await page.evaluate(() => document.querySelectorAll('#modal canvas[data-po]').length) === 6, 'dialogen visar alla sex filmer med affisch');
ok(/90 kr/.test(await modalText()) && /2 timmar/.test(await modalText()), 'dialogen säger priset och att filmen tar 2 timmar');
await shot('biljettluckan.png');
ok(await clickIn('[data-film="turbo"]'), 'köp biljett till TURBOPOLIS');
await page.waitForTimeout(200);
st = await ST();
ok(st.biljett === 'turbo' && st.money === 410, `biljetten köpt: ${st.biljett}, ${st.money} kr kvar`);
ok((await stored()).money === 410, 'köpet är sparat');
ok(/TURBOPOLIS/.test(st.kass || ''), `kassörskan svarar: "${st.kass}"`);
await page.waitForTimeout(700);
await shot('foaje-biljett.png');

// ---------- popcornbaren ----------
await clickSpot('bar');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 9000), 'klick på baren → popcorndialogen');
ok(/popcorn/i.test(await modalTitle()) && /35 kr/.test(await modalText()), `rubrik: ${await modalTitle()}`);
ok(await clickIn('[data-buy]'), 'köp popcorn');
ok(await waitFor(() => !!window.SF.scene._debug.state().pop, 12000), 'Kevin fyller bägaren och räcker över den');
st = await ST();
ok(st.money === 375 && st.me === 'carry' && st.pop.left === 7, `popcorn i händerna (${st.pop.left}/${st.pop.total}), ${st.money} kr kvar`);
await page.waitForTimeout(400);
await shot('foaje-popcorn.png');

// ---------- ätregeln: ingen popcorn ut på gatan ----------
await clickSpot('dorr');
ok(await waitSay('say', 'SÄTTA DIG OCH ÄTA UPP'), `vid dörren säger figuren: "${(await ST()).say}"`);
ok(await scene() === 'bio' && (await ST()).door < 0.3, 'med popcorn i händerna kommer man inte ut – dörren öppnas inte ens');
const lb = await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true }));
ok(/ÄTA UPP/.test(lb || ''), `leaveBlock() stoppar huvudprogrammets knappar: "${lb}"`);

// ---------- platsvakten släpper in med biljett ----------
await clickSpot('salong');
ok(await waitFor(() => window.SF.scene._debug.state().rum === 'salong', 12000), 'platsvakten river biljetten och man går in i salongen');
st = await ST();
ok(st.aud >= 10, `publiken sitter redan där (${st.aud})`);
await page.waitForTimeout(900);
await shot('salong-innan.png');
saveUrl('pano-salong.png', await D('panorama', 'salong', 2));

// ---------- sätt dig → föreställningen ----------
const g0 = await G();
const seat = await clickSpot('plats');
ok(await waitFor(() => window.SF.scene._debug.state().me === 'sit', 15000), `figuren går till plats ${seat.id} och sätter sig`);
ok(await waitFor(() => !!window.SF.scene._debug.state().show, 3000), 'föreställningen börjar när man sitter');
st = await ST();
ok(st.biljett === null && st.show.film === 'turbo', 'biljetten är använd – TURBOPOLIS börjar');
const startMin = st.show.startMin;
await page.waitForTimeout(3200);
st = await ST();
ok(st.lights.dark > 0.5 && st.lights.open > 0.9, `ljuset är släckt (${st.lights.dark.toFixed(2)}) och ridån uppe (${st.lights.open.toFixed(2)})`);
await page.waitForTimeout(2800);
await shot('film-1.png');
// klick mitt i maten: man sitter kvar
const p1 = await D('spot', 'duk');
await clickView(p1.x, p1.y);
await page.waitForTimeout(300);
ok((await ST()).me === 'sit' && /ÄT UPP FÖRST/.test((await ST()).say || ''), 'klick under filmen med popcorn kvar → "ÄT UPP FÖRST!" och man sitter kvar');
// publiken reagerar när filmen säger till
let sawReact = false, sawBubble = false;
for (let k = 0; k < 40 && !(sawReact && sawBubble); k++) {
  await D('tick', 0.5);
  const s = await ST();
  if (s.reacting > 0) sawReact = true;
  if (s.bubbles.length) sawBubble = true;
  if (sawReact && sawBubble) await shot('publik-reagerar.png');
}
ok(sawReact, 'publiken reagerar på filmen (skrattar, ropar OJ, hejar)');
ok(sawBubble, 'någon i publiken säger något i en pratbubbla');
st = await ST();
ok(st.pop && st.pop.left < 7, `popcornen äts tugga för tugga under filmen (${st.pop?.left ?? 0}/7 kvar)`);
await shot('film-2.png');
saveUrl('pano-film.png', await D('panorama', 'salong', 2));
// till eftertexterna och ljuset
await D('tick', Math.max(0, (await ST()).show.total - (await ST()).show.t - 2));
st = await ST();
ok(st.show?.phase === 'slut', `eftertexterna rullar (${st.show?.phase})`);
await shot('eftertexter.png');
await D('fast');
st = await ST();
const g1 = await G();
ok(!st.show && st.reward?.full, 'filmen är slut och ljuset tänt');
ok(g1.min - startMin >= 120 && g1.min - startMin <= 128, `2 speltimmar har gått under visningen (${Math.round(g1.min - startMin)} min: ${Math.floor(startMin / 60)}:${String(Math.round(startMin % 60)).padStart(2, '0')} → ${Math.floor(g1.min / 60)}:${String(Math.round(g1.min % 60)).padStart(2, '0')})`);
ok(st.reward.energi === 15 && g1.energy === Math.min(100, g0.energy + 15 + 2), `energin: ${g0.energy} → ${g1.energy} (+15 filmen, +2 popcornen)`);
ok(g1.hunger > g0.hunger, `popcornen mättade: ${Math.round(g0.hunger)} → ${Math.round(g1.hunger)} (+14 minus två timmars hunger)`);
ok(!st.pop, 'bägaren är tom och borta');
ok(st.sett.includes('turbo'), 'TURBOPOLIS är sedd');
ok((await stored()).energy === g1.energy, 'belöningen är sparad');
await page.waitForTimeout(500);
await shot('efter-filmen.png');

// ---------- ut ur salongen och ut på gatan ----------
await D('tick', 1);
await clickSpot('utgang');
ok(await waitFor(() => window.SF.scene._debug.state().rum === 'foaje', 12000), 'utgången leder tillbaka till foajén');
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'skjutdörrarna leder ut i staden');

// ---------- utan biljett stoppar platsvakten ----------
await setClock(15 * 60);
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(400);
await D('hideFolk');
await clickSpot('salong');
ok(await waitSay('vakt', 'Biljett, tack'), `utan biljett säger platsvakten: "${(await ST()).vakt}"`);
await page.waitForTimeout(800);
ok((await ST()).rum === 'foaje', 'och man kommer inte in i salongen');

// ---------- biljetten lämnas tillbaka om man går utan att se filmen ----------
let m0 = (await G()).money;
ok((await D('buyTicket', 'amore')).ok && (await G()).money === m0 - 90, 'biljett till AMORE PÅ SÖDER köpt');
await clickSpot('dorr');
ok(await waitFor(() => window.SF.sceneName === 'city', 12000), 'går ut med biljetten i fickan');
ok((await G()).money === m0, `biljetten lämnades tillbaka (${(await G()).money} kr)`);

// ---------- soffan i foajén: sitt och ät, ätregeln ----------
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(300);
await D('hideFolk');
await D('buyPopcorn');
const h0 = (await G()).hunger;
await clickSpot('soffa');
ok(await waitFor(() => window.SF.scene._debug.state().seat?.startsWith('soffa'), 12000), 'med popcornen går man till soffan och sätter sig');
await page.waitForTimeout(2600);
await clickView(200, 150);
await page.waitForTimeout(300);
ok((await ST()).me === 'sit' && /ÄT UPP FÖRST/.test((await ST()).say || ''), 'sitter man och äter reser man sig inte ("ÄT UPP FÖRST!")');
await clickSpot('dorr');
await page.waitForTimeout(300);
ok((await ST()).me === 'sit' && /SÄTTA DIG OCH ÄTA UPP/.test((await ST()).say || ''), 'och dörren får vänta tills bägaren är tom');
await shot('soffan.png');
ok(await waitFor(() => !window.SF.scene._debug.state().pop, 20000), 'popcornen äts upp på soffan');
ok((await G()).hunger > h0, `mättheten steg på soffan (${Math.round(h0)} → ${Math.round((await G()).hunger)})`);

// ---------- gå mitt i filmen ----------
await D('buyTicket', 'sommar');
await D('goSalong');
await page.waitForTimeout(300);
const e0 = (await G()).energy;
await D('sit', (await D('spot', 'plats')).id);
await D('tick', 12);
await clickSpot('utgang');
ok(await waitFor(() => /mitt i filmen/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 3000), 'klick på utgången mitt i filmen → "Gå mitt i filmen?"');
await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Gå ut/.test(b.textContent))?.click());
ok(await waitFor(() => window.SF.scene._debug.state().rum === 'foaje', 12000), 'man går ut i foajén');
st = await ST();
const e1 = (await G()).energy;
ok(st.reward && !st.reward.full && e1 > e0 && e1 < e0 + 15, `halv film = lite energi (${Math.round(e0)} → ${Math.round(e1)})`);

// ---------- scenbyte mitt i maten: resten räknas in, inget försvinner ----------
await D('buyPopcorn');
const h1 = (await G()).hunger;
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(300);
ok((await G()).hunger >= Math.min(100, h1 + 13), `popcornen räknades in när scenen byttes (${Math.round(h1)} → ${Math.round((await G()).hunger)})`);
// omladdning mitt i maten
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(300);
await D('buyPopcorn');
const h2 = (await G()).hunger;
await page.evaluate(() => window.dispatchEvent(new Event('sf:before-reload')));
ok((await stored()).hunger >= Math.min(100, Math.round(h2 + 13)), 'omladdning mitt i maten: popcornen sparas inräknad');
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(200);
ok((await G()).hunger <= Math.min(100, h2 + 15), 'och räknas inte två gånger när scenen sedan byts');

// ---------- fliken göms (mobilen låses, ett sms): provisoriskt – sedan fortsätter allt ----------
// visibilitychange simuleras: document.visibilityState sätts och händelsen skickas
const hide = (hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  if (!h) { delete document.visibilityState; delete document.hidden; }
}, hidden);
// gott om pengar och plats i magen/orken, så att inget slår i taket (100) under provet
const fill = () => page.evaluate(() => { const g = window.SF.game; g.money = Math.max(g.money, 2000); g.hunger = 40; g.energy = 40; g.save(); });
await setClock(15 * 60);
await fill();
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(300);
await D('hideFolk');
m0 = (await G()).money;
await D('buyTicket', 'karlek');
await hide(true);
st = await ST();
ok(st.prov && st.biljett === 'karlek' && (await stored()).money === m0, `fliken göms i foajén med biljett: sparningen har pengarna (${(await stored()).money} kr) om mobilen stänger sidan, biljetten finns kvar i handen`);
await hide(false);
await page.waitForTimeout(150);
st = await ST();
ok(!st.prov && st.biljett === 'karlek' && st.money === m0 - 90 && (await stored()).money === m0 - 90, `tillbaka: biljetten gäller fortfarande och pengarna är som förut (${st.money} kr) – ingen tyst återbetalning`);
// mitt i filmen med popcorn
await D('buyPopcorn');
await D('goSalong');
const eMid0 = (await G()).energy;
await D('sit', (await D('spot', 'plats')).id);
await D('tick', 9);
const gMid = await G(), stMid = await ST();
await hide(true);
const sv = await stored();
st = await ST();
ok(st.prov && st.pop?.settled && sv.energy > gMid.energy && sv.hunger > gMid.hunger + 5, `fliken göms mitt i filmen: det sedda + resten av popcornen sparas provisoriskt (energi ${Math.round(gMid.energy)} → ${Math.round(sv.energy)}, mättnad ${Math.round(gMid.hunger)} → ${Math.round(sv.hunger)})`);
await page.waitForTimeout(700);
ok((await ST()).show.t === st.show.t, 'medan sidan är undanlagd står filmen still');
await hide(false);
await page.waitForTimeout(150);
st = await ST();
const gBack = await G();
ok(!st.prov && !st.show.given && !st.pop?.settled && Math.abs(gBack.energy - gMid.energy) < 0.01 && Math.abs(gBack.hunger - gMid.hunger) < 0.2, `tillbaka: det provisoriska är borttaget (energi ${Math.round(gBack.energy)}, popcornen ${st.pop?.left}/7 ej inräknad) – filmen fortsätter`);
await D('fast');
st = await ST();
const gEnd = await G();
ok(st.reward?.full && st.reward.energi === 15 && Math.round(gEnd.energy) === Math.min(100, Math.round(eMid0) + 15 + 2), `filmen belönas HELT ändå: energi ${Math.round(eMid0)} → ${Math.round(gEnd.energy)} (+15 filmen, +2 popcornen)`);
ok(!st.pop && gEnd.hunger > stMid.hunger, `popcornen åts upp som vanligt (mättnad ${stMid.hunger} → ${Math.round(gEnd.hunger)})`);
await D('goFoaje');

// ---------- popcornen är betald men Kevin fyller fortfarande bägaren ----------
await D('hideFolk');
await fill();
await D('teleport', 320, 140);
await clickSpot('bar');
ok(await waitFor(() => !document.querySelector('#modal').classList.contains('hidden'), 9000), 'popcorndialogen igen');
const hW = (await G()).hunger;
await clickIn('[data-buy]');
await page.waitForTimeout(100);
st = await ST();
ok(st.order && !st.pop && st.me === 'waitPop', 'betald – Kevin fyller bägaren (inte i handen än)');
const lbW = await page.evaluate(() => window.SF.scene.leaveBlock({ quiet: true }));
ok(/KEVIN FYLLER/.test(lbW || ''), `leaveBlock() spärrar även medan bägaren fylls: "${lbW}"`);
await page.evaluate(() => window.dispatchEvent(new Event('sf:before-reload')));
ok((await stored()).hunger >= Math.min(100, Math.round(hW + 13)), `omladdning medan Kevin fyller: hela bägaren sparas inräknad (${Math.round(hW)} → ${Math.round((await stored()).hunger)})`);
ok(await waitFor(() => !!window.SF.scene._debug.state().pop, 12000), 'Kevin räcker ändå över bägaren');
ok((await ST()).pop.settled, 'och tuggorna ger inget till (redan inräknad)');
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(200);
ok((await G()).hunger <= Math.min(100, hW + 15), `räknas inte två gånger när scenen byts (${Math.round((await G()).hunger)})`);

// ---------- gå mitt i filmen med popcorn: ät upp snabbt och gå ----------
await setClock(15 * 60);
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(300);
await D('hideFolk');
await fill();
await D('buyTicket', 'hamnaren');
await D('buyPopcorn');
await D('goSalong');
await D('sit', (await D('spot', 'plats')).id);
await D('tick', 10);
const hQ = (await G()).hunger, eQ = (await G()).energy;
await clickSpot('utgang');
ok(await waitFor(() => /mitt i filmen/.test(document.querySelector('#modal .dlg-head h2')?.textContent || ''), 3000), 'popcorn kvar + klick på utgången → frågan "Gå mitt i filmen?" (ätregeln stänger inte ute en)');
ok(/Ät upp snabbt/.test(await modalText()), 'dialogen erbjuder "Ät upp snabbt och gå"');
await page.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Ät upp snabbt/.test(b.textContent))?.click());
ok(await waitFor(() => window.SF.scene._debug.state().rum === 'foaje', 12000), 'man äter upp och går ut i foajén');
st = await ST();
ok(!st.pop && (await G()).hunger > hQ + 8 && (await G()).energy > eQ && st.reward && !st.reward.full, `resten av popcornen räknades in (${Math.round(hQ)} → ${Math.round((await G()).hunger)}) och lite energi för det sedda`);

// ---------- sen kväll: visningen slutar senast 23:30, ingen midnattskollaps ----------
await setClock(21 * 60);
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(300);
await D('hideFolk');
m0 = (await G()).money;
await D('buyTicket', 'nattbuss');
await setClock(23 * 60 + 37);
await D('goSalong');
await D('sit', (await D('spot', 'plats')).id);
st = await ST();
ok(!st.show && st.biljett === null && (await G()).money === m0 && /sista visning/i.test(st.say || ''), `23:37: ingen visning – biljetten blir pengar igen ("${st.say}")`);
ok(!(await D('buyPopcorn')).ok, 'godisbaren har stängt efter 23:30');
await D('goFoaje');
await setClock(21 * 60 + 10);
await D('buyTicket', 'nattbuss');
await setClock(22 * 60 + 50);
const day0 = (await G()).day;
await D('goSalong');
await D('sit', (await D('spot', 'plats')).id);
st = await ST();
ok(st.show && st.show.minEff >= 30 && st.show.minEff <= 40, `22:50: en kort visning (${Math.round(st.show?.minEff)} min, slutar 23:30) – man kommer in när filmen redan har börjat`);
// i riktig tid: spelets egen klocka (2 min/s) går också
ok(await waitFor(() => { const s = window.SF.scene._debug?.state?.(); return !s || (!s.show && s.reward); }, 40000) && !!(await ST()).reward?.full, 'visningen går klart i riktig tid');
const gLate = await G();
ok(await scene() === 'bio' && gLate.day === day0 && gLate.min < 23 * 60 + 45, `ingen kollaps: fortfarande dag ${gLate.day}, kl. ${clock(gLate.min)} efter filmen`);

// ---------- sista biljetten 21:30 och stängt före 12 ----------
await setClock(21 * 60 + 45);
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(300);
await D('hideFolk');
await clickSpot('lucka');
ok(await waitSay('kass', 'sista föreställning'), `kl. 21:45 säljs inga biljetter: "${(await ST()).kass}"`);
ok(!(await modalOpen()), 'ingen biljettdialog');
m0 = (await G()).money;
ok(!(await D('buyTicket', 'hamnaren')).ok && (await G()).money === m0, 'och inga pengar dras');
await shot('sen-kvall.png');
await setClock(10 * 60);
await page.evaluate(() => window.SF.go('bio'));
await page.waitForTimeout(400);
st = await ST();
ok(!st.open, 'kl. 10 är bion stängd');
await clickSpot('lucka');
ok(await waitSay('say', 'stängd'), `luckan är stängd: "${(await ST()).say}"`);
ok(!(await modalOpen()), 'ingen biljettdialog när det är stängt');
await clickSpot('salong');
ok(await waitSay('say', 'låst'), `salongen är låst: "${(await ST()).say}"`);
ok((await ST()).rum === 'foaje', 'man kommer inte in');
await shot('stangt.png');

// ---------- dörren från staden (om den är inkopplad i map.js/city.js) ----------
if (cityBio?.enter === 'bio') {
  await setClock(16 * 60);
  await page.evaluate(() => window.SF.go('city'));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.SF.scene._debug.enter('bio'));
  ok(await waitFor(() => window.SF.sceneName === 'bio', 60000), 'bions dörr i staden leder in i foajén');
} else console.log('(bions dörr i staden är inte inkopplad än – se notes)');

// ---------- bred skärm (mobilfyllning): foajén och salongen fyller bredden ----------
const wctx = await browser.newContext({ viewport: { width: 1000, height: 420 } });
const wide = await wctx.newPage();
wide.on('pageerror', (e) => errs.push(e.message));
const WURL = URL.replace('?nomenu', '?nomenu&mobfill=1');
await wide.goto(WURL);
await wide.evaluate((s) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Bred', look: { skin: '#c68a5c', hair: '#1d1714', style: 'afro', shirt: '#e07a2e', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await wide.reload();
await wide.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await wide.waitForTimeout(500);
await wide.evaluate(() => { window.SF.game.min = 19 * 60; window.SF.go('bio'); });
await wide.waitForTimeout(1200);
const vw = await wide.evaluate(() => window.SF.W);
ok(vw > 384, `bred skärm: vyn är ${vw} px bred (scenens viewMax)`);
await wide.screenshot({ path: OUT + 'bred-foaje.png' });
await wide.evaluate(() => { const d = window.SF.scene._debug; d.buyTicket('hamnaren'); d.goSalong(); d.sit(d.spot('plats').id); d.tick(16); });
await wide.waitForTimeout(400);
await wide.screenshot({ path: OUT + 'bred-salong.png' });
await wctx.close();

// ---------- mobilen i fyll-läget (NÄRA): över- och nederkant beskärs ----------
// 844×390 med pekskärm: spelet fyller skärmen och ~55 rader upptill skärs bort. Kameran
// följer figuren i höjdled, personalens pratbubblor syns hela och duken ligger i bild.
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const mob = await mctx.newPage();
mob.on('pageerror', (e) => errs.push(e.message));
await mob.goto(WURL);
await mob.evaluate((s) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Mobil', look: { skin: '#f2cca6', hair: '#a5692f', style: 'bob', shirt: '#2e9a5a', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await mob.reload();
await mob.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await mob.waitForTimeout(500);
await mob.evaluate(() => { window.SF.game.min = 16 * 60; window.SF.go('bio'); });
await mob.waitForTimeout(800);
const MD = (fn, ...a) => mob.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
const mSafe = await mob.evaluate(() => window.SF.view.safe);
ok(mSafe.y0 > 20, `mobilen beskär överkanten (safe ${mSafe.y0}–${mSafe.y1})`);
await MD('hideFolk');
async function mClickSpot(id) {
  const p = await MD('spot', id);
  const r = await mob.evaluate(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(), A = window.SF; return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / A.pxs, lh: c.height / A.pxs, bx: A.view.boxX, by: A.view.boxY }; });
  await mob.touchscreen.tap(r.l + (p.x + r.bx) / r.lw * r.w, r.t + (p.y + r.by) / r.lh * r.h);
  await MD('lockCam', null);
}
const mWait = async (fn, ms = 12000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await mob.evaluate(fn, arg)) return true; await mob.waitForTimeout(100); } return false; };
const inBand = (b, who) => { const x = b.list.find((q) => q.who === who); return x ? { ok: x.top >= b.y0 && x.bot <= b.y1, x } : { ok: false, x: null }; };
// platsvakten utan biljett
await mClickSpot('salong');
ok(await mWait(() => /Biljett, tack/.test(window.SF.scene._debug.state().vakt || '')), 'mobilen: platsvakten säger "Biljett, tack!"');
let bb = await MD('bubbles'), ib = inBand(bb, 'vakt');
ok(ib.ok && bb.camY > 0, `Haralds pratbubbla syns hela (rad ${ib.x?.top}–${ib.x?.bot}, synligt ${bb.y0}–${bb.y1}, kameran ${bb.camY} ner)`);
await mob.waitForTimeout(300);
await mob.screenshot({ path: OUT + 'mobil-vakt.png' });
// biljettluckan
await mClickSpot('lucka');
ok(await mWait(() => !document.querySelector('#modal').classList.contains('hidden')), 'mobilen: biljettdialogen');
await mob.evaluate(() => document.querySelector('#modal [data-film="sommar"]').click());
ok(await mWait(() => /SOMMAR I STAN/.test(window.SF.scene._debug.state().kass || '')), 'Greta svarar');
bb = await MD('bubbles'); ib = inBand(bb, 'kass');
ok(ib.ok, `Gretas pratbubbla syns hela (rad ${ib.x?.top}–${ib.x?.bot})`);
await mob.waitForTimeout(300);
await mob.screenshot({ path: OUT + 'mobil-lucka.png' });
// popcornbaren
await mClickSpot('bar');
ok(await mWait(() => !document.querySelector('#modal').classList.contains('hidden')), 'mobilen: popcorndialogen');
await mob.evaluate(() => document.querySelector('#modal [data-buy]').click());
ok(await mWait(() => /Varsågod/.test(window.SF.scene._debug.state().godis || '')), 'Kevin räcker över bägaren');
bb = await MD('bubbles'); ib = inBand(bb, 'godis');
ok(ib.ok, `Kevins pratbubbla syns hela (rad ${ib.x?.top}–${ib.x?.bot})`);
await mob.waitForTimeout(200);
await mob.screenshot({ path: OUT + 'mobil-kevin.png' });
// salongen: duken i bild när man sitter
await mClickSpot('salong');
ok(await mWait(() => window.SF.scene._debug.state().rum === 'salong'), 'mobilen: in i salongen');
await mob.waitForTimeout(600);
await mob.screenshot({ path: OUT + 'mobil-salong.png' });
// en ledig plats till vänster (nere till höger ligger huvudprogrammets emoji-rad över bilden)
const mSeat = (await MD('seats')).filter((q) => !q.occ && q.x < 170).sort((a, b) => a.y - b.y)[0];
await mClickSpot(mSeat.id);
ok(await mWait(() => window.SF.scene._debug.state().show?.phase === 'film', 15000), 'mobilen: filmen går');
await mob.waitForTimeout(2500);
let mv = await MD('view');
ok(mv.filmTop >= mv.y0 && mv.filmBot <= mv.y1, `hela duken i bild (rad ${mv.filmTop}–${mv.filmBot}, synligt ${mv.y0}–${mv.y1})`);
await mob.screenshot({ path: OUT + 'mobil-film.png' });
await mClickSpot('duk');
await mob.waitForTimeout(200);
bb = await MD('bubbles'); ib = inBand(bb, 'me');
ok(ib.ok && /ÄT UPP|SCH/.test(ib.x?.text || ''), `min egen pratbubbla hålls i bild fast jag sitter långt ner ("${ib.x?.text}", rad ${ib.x?.top}–${ib.x?.bot})`);
await mob.screenshot({ path: OUT + 'mobil-film-prat.png' });
await mctx.close();

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'inga konsolfel');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
