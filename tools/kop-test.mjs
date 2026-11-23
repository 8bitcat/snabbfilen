// 🛍️ Butiken – köp i appen (js/core/kop.js). Sidan körs med en låtsad Capacitor (NativePurchases, StoreKit 2)
// som svarar som Apples sandlåda, och vi kontrollerar att
//   1. på webben (utan Capacitor) finns ingen Butik i mobilen
//   2. i appen: Butik i mobilen, fem varor med Apples priser i spelarens valuta
//   3. Pengapåse 1 000 kr: +1 000 kr i handkassan, bokfört i snabbfilen_kop, livsmålet 💰 Rikedom oförändrat
//   4. samma transaktion en gång till (transactionUpdated efter köpet) ger inget dubbelt – en ny ger igen
//   5. Villan utan hyra: ✓ Din, insats 0 och hyra 0 hos Bostadsbyrån, flytta in utan pengar, måndagshyran 0
//   6. "Be om att få köpa": köpet avvisas som pending, godkänns senare (transactionUpdated) → pengarna kommer
//   7. avbrutet köp: inget händer och inget felbesked
//   8. ny telefon (tömd lagring): villan hämtas tyst från Apple-kontot vid start; Återställ köp säger att allt finns
//   9. inga fel i sidan
//   node tools/kop-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const SKU = 'io.eightbitcat.pixelcity.';
const PRIS = { 'pengar.1000': 12, 'pengar.10000': 49, 'bostad.lagenhet': 29, 'bostad.villa': 59, 'bostad.takvaning': 99, 'present.liten': 9, 'present.mellan': 29, 'present.stor': 59, 'dock.tradgard': 29, 'dock.slott': 39 };

async function boot({ app = false, purchases = [], kop = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
  if (app) {
    await p.addInitScript(({ SKU, PRIS, purchases }) => {
      const I = (window.__iap = { calls: [], purchases: [...purchases], mode: 'ok', listeners: [], n: 100, restored: 0 });
      window.Capacitor = { isNativePlatform: () => true, Plugins: { NativePurchases: {
        getProducts: async ({ productIdentifiers }) => ({ products: productIdentifiers.map((id) => ({ identifier: id, title: id, description: '', price: PRIS[id.slice(SKU.length)], priceString: `${PRIS[id.slice(SKU.length)]},00 kr`, currencyCode: 'SEK' })) }),
        purchaseProduct: async (o) => {
          I.calls.push(o);
          if (I.mode === 'cancel') throw new Error('User cancelled');
          if (I.mode === 'pending') throw new Error('Transaction pending');
          const tx = { transactionId: 'tx' + (++I.n), productIdentifier: o.productIdentifier, purchaseDate: new Date().toISOString(), environment: 'Sandbox' };
          if (!/pengar|present/.test(o.productIdentifier)) I.purchases.push(tx);   // (förbrukningsvarorna är inga rättigheter att hämta igen)
          I.sist = tx;
          return tx;
        },
        restorePurchases: async () => { I.restored++; },
        getPurchases: async () => ({ purchases: I.purchases }),
        addListener: async (ev, fn) => { if (ev === 'transactionUpdated') I.listeners.push(fn); return { remove() {} }; },
      } } };
      I.emit = (tx) => I.listeners.forEach((f) => f(tx));
    }, { SKU, PRIS, purchases });
  }
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=kop${Date.now().toString(36)}`);
  await p.evaluate((kop) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Köpis', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 900, bank: 100, hunger: 70, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { rik: 'latt', lycka: 'normal', utb: 'normal', karr: 'normal' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] } }));
    if (kop) localStorage.setItem('snabbfilen_kop', JSON.stringify(kop));
  }, kop);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await sleep(900);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  await sleep(1000);
  return { ctx, p };
}
const D = (p, fn, a) => p.evaluate(fn, a);
const modalText = (p) => D(p, () => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const toasts = (p) => D(p, () => [...document.querySelectorAll('#toasts .toast')].map((t) => t.className.replace('toast', '').trim() + ':' + t.textContent));
const stang = (p) => D(p, () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const kopLage = (p) => D(p, () => JSON.parse(localStorage.getItem('snabbfilen_kop') || 'null'));
const rik = (p) => D(p, () => SF.game.malStatus().find((m) => m.key === 'rik').have);
async function oppnaButik(p) {
  await stang(p);
  // (mobilen kan stå öppen sedan förra steget – skuggan bakom den fångar då klicket på knappen)
  await D(p, () => { if (document.querySelector('#mobilen').classList.contains('hidden')) document.querySelector('#hud-mobil').click(); }); await sleep(150);
  await p.click('#mobilen [data-app="butik"]'); await sleep(300);
  await p.waitForFunction(() => document.querySelectorAll('#modal:not(.hidden) [data-kop]:not([disabled])').length >= 1, null, { timeout: 5000 }).catch(() => {});
}

// ---- 1. webben ----
{
  const { ctx, p } = await boot();
  await p.click('#hud-mobil'); await sleep(250);
  ok(await D(p, () => { const b = document.querySelector('#mobilen [data-app="butik"]'); return !!b && b.hidden; }), 'webben: Butiken finns i mobilen men är dold (inga köp utanför appen)');
  ok((await D(p, () => SF.game.insats('villa'))) === 8000 && (await D(p, () => SF.game.hyraFor('villa'))) === 1000, 'webben: villan kostar som vanligt (insats 8 000, hyra 1 000)');
  await ctx.close();
}

// ---- 2–7. appen ----
{
  const { ctx, p } = await boot({ app: true });
  await p.click('#hud-mobil'); await sleep(250);
  ok(await D(p, () => { const b = document.querySelector('#mobilen [data-app="butik"]'); return !!b && !b.hidden && b.offsetParent !== null && /Butik/.test(b.textContent); }), 'appen: 🛍️ Butik syns i mobilen');
  await oppnaButik(p);
  const t2 = await modalText(p);
  ok(/Butiken/.test(t2) && (await D(p, () => document.querySelectorAll('#modal [data-kop]').length)) === 10, 'Butiken öppnas med tio varor (pengapåsar, bostäder, presentlådor, trädgården, slottsvåningen)');
  ok(await D(p, () => [...document.querySelectorAll('#modal [data-kop]')].every((b) => !b.disabled && /\d+,00 kr/.test(b.textContent))), 'varje vara har Apples pris i kronor (och knappen är aktiv när priset kommit)');
  ok(/Pengapåse 1 000 kr/.test(t2) && /Villan utan hyra/.test(t2) && /Takvåningen utan hyra/.test(t2), 'varorna heter Pengapåse 1 000 kr, Villan utan hyra, Takvåningen utan hyra …');
  ok(/Återställ köp/.test(t2) && /räknas inte mot livsmålet/.test(t2), 'rutan har Återställ köp och förklarar att köpta pengar inte räknas mot livsmålet');

  // 3. pengapåsen
  const m0 = await D(p, () => SF.game.money), r0 = await rik(p);
  await p.click('#modal [data-kop="pengar1000"]'); await sleep(600);
  const m1 = await D(p, () => SF.game.money), r1 = await rik(p), L1 = await kopLage(p);
  ok(m1 === m0 + 1000, `Pengapåse 1 000 kr: handkassan ${m0} → ${m1}`);
  ok(L1?.pengar === 1000 && L1.tx?.length === 1 && L1.logg?.length === 1, 'köpet är bokfört i snabbfilen_kop (pengar 1000, en transaktion, en rad i loggen)');
  ok(r1 === r0, `livsmålet 💰 Rikedom är oförändrat (${r0} → ${r1})`);
  ok((await toasts(p)).some((t) => /good:.*1.000 kr ligger i handkassan/.test(t)), 'tack-rutan: "1 000 kr ligger i handkassan"');   // (hårt mellanslag i beloppet)
  ok(await D(p, () => window.__iap.calls[0]?.isConsumable === true && window.__iap.calls[0]?.productIdentifier === 'io.eightbitcat.pixelcity.pengar.1000'), 'Apple fick rätt produkt-ID och att påsen är en förbrukningsvara');

  // 4. samma transaktion igen → inget; ny transaktion → igen
  await D(p, () => window.__iap.emit(window.__iap.sist)); await sleep(300);
  ok((await D(p, () => SF.game.money)) === m1, 'samma transaktion en gång till (transactionUpdated) ger inga dubbla pengar');
  await D(p, () => window.__iap.emit({ transactionId: 'tx-senare', productIdentifier: 'io.eightbitcat.pixelcity.pengar.1000', purchaseDate: new Date().toISOString() })); await sleep(300);
  ok((await D(p, () => SF.game.money)) === m1 + 1000 && (await kopLage(p)).pengar === 2000, 'en ny transaktion via transactionUpdated ger pengarna (2 000 kr köpta totalt)');

  // 5. villan utan hyra
  await oppnaButik(p);
  await p.click('#modal [data-kop="villa"]'); await sleep(600);
  ok(await D(p, () => window.__iap.calls.at(-1)?.isConsumable === false), 'Villan köps som engångsköp (inte förbrukningsvara)');
  ok(/✓ Din/.test(await modalText(p)) && !(await D(p, () => !!document.querySelector('#modal [data-kop="villa"]'))), 'Villan visar ✓ Din i stället för en köpknapp');
  ok(await D(p, () => SF.game.insats('villa') === 0 && SF.game.hyraFor('villa') === 0 && SF.game.insats('takvaning') === 20000), 'villan: insats 0 och hyra 0 – takvåningen kostar som vanligt');
  await stang(p);
  await D(p, async () => { const m = await import('/js/shops/bostad.js'); m.openHousing(SF); }); await sleep(400);
  const t5 = await modalText(p);
  ok(/Villan Eget hus.*Din bostad.*ingen insats, ingen hyra/.test(t5) && /Takvåningen.*Insats 20 000 kr/.test(t5), 'Bostadsbyrån: Villan "Din bostad · ingen insats, ingen hyra", takvåningen med insats som vanligt');
  await D(p, () => { SF.game.money = 0; });
  const r5 = await D(p, () => SF.game.moveTo('villa'));
  ok(r5?.ok === true && (await D(p, () => SF.game.home === 'villa' && SF.game.money === 0 && SF.game.hyra === 0)), 'flyttar in i villan utan en krona, och veckohyran är 0');
  await stang(p);

  // 6. Be om att få köpa
  await D(p, () => { window.__iap.mode = 'pending'; SF.game.money = 500; });
  await oppnaButik(p);
  await p.click('#modal [data-kop="pengar10000"]'); await sleep(500);
  ok((await D(p, () => SF.game.money)) === 500 && (await toasts(p)).some((t) => /väntar på att bli godkänt/.test(t)), 'Be om att få köpa: inga pengar än, rutan säger att köpet väntar på godkännande');
  await D(p, () => window.__iap.emit({ transactionId: 'tx-godkant', productIdentifier: 'io.eightbitcat.pixelcity.pengar.10000', purchaseDate: new Date().toISOString() })); await sleep(300);
  ok((await D(p, () => SF.game.money)) === 10500, 'när föräldern godkänt kommer 10 000 kr in i spelet');

  // 7. avbrutet
  await D(p, () => { window.__iap.mode = 'cancel'; document.querySelector('#toasts').innerHTML = ''; });
  await oppnaButik(p);
  await p.click('#modal [data-kop="pengar1000"]'); await sleep(500);
  ok((await D(p, () => SF.game.money)) === 10500 && !(await toasts(p)).some((t) => /^bad:/.test(t)), 'avbrutet köp: inga pengar och inget felbesked');
  ok(await D(p, () => [...document.querySelectorAll('#modal [data-kop]')].every((b) => !b.disabled)), 'knapparna är aktiva igen efter ett avbrutet köp');
  await ctx.close();
}

// ---- 7b. 🎁 presentlådorna (v0.171): köpet lägger en present i mobilen, innehållet är det som står i butiken ----
{
  const { ctx, p } = await boot({ app: true });
  await oppnaButik(p);
  const t7 = await modalText(p);
  ok(/Liten present/.test(t7) && /Mellanlådan/.test(t7) && /Stora lådan/.test(t7) && /Alltid: 500 kr, ett plagg och ett kortpaket/.test(t7) && /alla lika troliga/.test(t7), 'butiken visar de tre lådorna med innehållet (och att slumpen är lika för allt man inte har)');
  const m7 = await D(p, () => SF.game.money);
  await p.click('#modal [data-kop="present-mellan"]'); await sleep(600);
  ok(await D(p, () => window.__iap.calls.at(-1)?.productIdentifier === 'io.eightbitcat.pixelcity.present.mellan' && window.__iap.calls.at(-1)?.isConsumable === true), 'Apple fick rätt produkt-ID och att lådan är en förbrukningsvara');
  const ko7 = await D(p, () => SF.game.presenter.ko.map((x) => x.typ + ':' + (x.storlek || '')));
  ok(ko7.includes('kop:mellan') && (await D(p, () => SF.game.money)) === m7 && (await toasts(p)).some((t) => /Presenten ligger i mobilen/.test(t)), `köpet lade Mellanlådan i 🎁 Presenter (${ko7.join(', ')}) och sa till – inga pengar direkt`);
  ok((await kopLage(p)).logg?.at(-1)?.id === 'present-mellan' && (await kopLage(p)).tx?.length === 1, 'köpet är bokfört i snabbfilen_kop');
  await stang(p);
  await D(p, async () => { const m = await import('/js/core/presenter.js'); m.openPresenter(SF); }); await sleep(300);
  ok(/Mellanlådan \(köpt\)/.test(await modalText(p)), 'appen 🎁 Presenter: "Mellanlådan (köpt)"');
  await D(p, () => document.querySelector(`#modal [data-oppna="${SF.game.presenter.ko.findIndex((x) => x.typ === 'kop')}"]`).click()); await sleep(300);   // (dagens present kan ligga först i kön)
  await D(p, () => document.querySelector('#modal .pr-cv').click());
  await p.waitForFunction(() => !document.querySelector('#modal .pr-gavor')?.classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
  const g7 = await D(p, () => [...document.querySelectorAll('#modal .pr-gava b')].map((b) => b.textContent));
  ok(g7.length === 3 && g7[0].replace(/\s/g, '') === '500kr' && g7.some((t) => /Kortpaket/.test(t)) && (await D(p, () => SF.game.money)) === m7 + 500 && (await D(p, () => SF.game.presenter.antal)) === 0, `mellanlådan: 500 kr, ett plagg och ett kortpaket (${g7.join(' · ')}) – räknas inte som dagspresent`);
  await stang(p);
  // stora lådan via transactionUpdated (köpet godkändes senare): fem saker, guldpokalen sist
  await D(p, () => window.__iap.emit({ transactionId: 'tx-stor', productIdentifier: 'io.eightbitcat.pixelcity.present.stor', purchaseDate: new Date().toISOString() })); await sleep(300);
  ok((await D(p, () => SF.game.presenter.ko.some((x) => x.typ === 'kop' && x.storlek === 'stor'))), 'Stora lådan via transactionUpdated hamnar i 🎁 Presenter');
  await D(p, async () => { const m = await import('/js/core/presenter.js'); m.oppna(SF, SF.game.presenter.ko.findIndex((x) => x.storlek === 'stor')); }); await sleep(300);
  await D(p, () => document.querySelector('#modal .pr-cv').click());
  await p.waitForFunction(() => !document.querySelector('#modal .pr-gavor')?.classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
  const g8 = await D(p, () => [...document.querySelectorAll('#modal .pr-gava b')].map((b) => b.textContent));
  ok(g8.length === 5 && g8[0].replace(/\s/g, '') === '1500kr' && /Pokal/i.test(g8.at(-1)), `stora lådan: 1 500 kr + plagg + möbel + kortpaket + guldpokal (${g8.join(' · ')})`);
  await stang(p);
  await ctx.close();
}

// ---- 7c. 🌳 Trädgården i Dockskåpet (v0.172): engångsköp som låser upp rummet, följer med Apple-kontot ----
{
  const { ctx, p } = await boot({ app: true });
  await oppnaButik(p);
  ok(/Trädgården i Dockskåpet/.test(await modalText(p)) && !(await kopLage(p))?.dock?.length, 'butiken visar Trädgården i Dockskåpet – inte köpt än');
  await p.click('#modal [data-kop="dock-tradgard"]'); await sleep(600);
  ok(await D(p, () => window.__iap.calls.at(-1)?.productIdentifier === 'io.eightbitcat.pixelcity.dock.tradgard' && window.__iap.calls.at(-1)?.isConsumable === false), 'Apple fick rätt produkt-ID och att rummet är ett engångsköp');
  ok((await kopLage(p))?.dock?.includes('tradgard') && /✓ Din/.test(await modalText(p)) && (await toasts(p)).some((t) => /upplåst/.test(t)), 'köpet: dock ["tradgard"] i snabbfilen_kop, ✓ Din i butiken, rutan säger att rummet är upplåst');
  await stang(p);
  await D(p, () => window.SF.openDockskap());
  await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
  await sleep(300);
  ok((await D(p, () => window.SF.scene._debug.locked(5))) === false && (await D(p, () => window.SF.scene._debug.dock())).includes('tradgard'), 'Dockskåpet: trädgården är upplåst');
  await D(p, () => window.SF.leaveDockskap()); await sleep(300);
  await ctx.close();
  // ny telefon: rummet hämtas tyst från Apple-kontot
  const tx = { transactionId: 'tx-dock', productIdentifier: 'io.eightbitcat.pixelcity.dock.tradgard', purchaseDate: new Date().toISOString() };
  const { ctx: ctx2, p: p2 } = await boot({ app: true, purchases: [tx] });
  await p2.waitForFunction(() => (JSON.parse(localStorage.getItem('snabbfilen_kop') || '{}').dock || []).includes('tradgard'), null, { timeout: 8000 }).catch(() => {});
  ok((await kopLage(p2))?.dock?.includes('tradgard'), 'ny telefon: trädgården hämtas tyst från Apple-kontot vid start');
  await ctx2.close();
}

// ---- 8. ny telefon ----
{
  const villa = { transactionId: 'tx-villa-gammal', productIdentifier: SKU + 'bostad.villa', purchaseDate: '2026-11-01T10:00:00Z' };
  const { ctx, p } = await boot({ app: true, purchases: [villa] });
  ok((await D(p, () => SF.game.insats('villa'))) === 8000, 'ny telefon: villan kostar som vanligt innan Apple-kontot lästs');
  await p.waitForFunction(() => SF.game.insats('villa') === 0, null, { timeout: 8000 }).catch(() => {});
  ok((await D(p, () => SF.game.insats('villa'))) === 0 && (await kopLage(p))?.bostader?.includes('villa'), 'villan hämtas tyst från Apple-kontot vid start (utan Apples inloggningsruta)');
  ok((await D(p, () => window.__iap.restored)) === 0, 'den tysta hämtningen vid start anropar inte restorePurchases');
  await oppnaButik(p);
  await D(p, () => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Återställ köp/.test(b.textContent)).click()); await sleep(400);
  ok((await D(p, () => window.__iap.restored)) === 1 && (await toasts(p)).some((t) => /finns redan här/.test(t)), 'Återställ köp: Apple tillfrågas och rutan säger att allt redan finns');
  await ctx.close();
}

ok(!errs.length, `inga fel i sidan${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
