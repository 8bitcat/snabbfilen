// Granskningsbilder av 🛍️ Butiken till App Store Connect (en per produkt räcker – samma bild till alla fem):
// spelet med låtsad Capacitor/NativePurchases så att butiken syns, på svenska och engelska.
//   node butik-snap.mjs            → D:\GamesProjects\snabbfilen\app\store\iap\butik-<lang>.png (1200×760)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || 8788;
const UT = 'D:/GamesProjects/snabbfilen/app/store/iap';
fs.mkdirSync(UT, { recursive: true });
const SKU = 'io.eightbitcat.pixelcity.';
const PRIS = { 'pengar.1000': 12, 'pengar.10000': 49, 'bostad.lagenhet': 29, 'bostad.villa': 59, 'bostad.takvaning': 99, 'present.liten': 9, 'present.mellan': 29, 'present.stor': 59, 'dock.tradgard': 29, 'dock.slott': 39, 'dock.rymd': 39, 'evig.motorbat': 49, 'evig.stuga': 39, 'evig.arskort': 29 };
// 4:e argumentet 'slut': rulla ner till de sista varorna i listan (granskningsbild för nya varor), filnamnet får -slut
const SLUT = process.argv[4] === 'slut';
const browser = await chromium.launch();
// storleken: "BREDDxHÖJD@skala" (standard 1200x760@2); andra storlekar får måtten i filnamnet
const sizeArg = process.argv[3] || '1200x760@2';
const [W, H] = sizeArg.split('@')[0].split('x').map(Number), DSF = +(sizeArg.split('@')[1] || 1);
const suffix = sizeArg === '1200x760@2' ? '' : `-${W * DSF}x${H * DSF}`;
for (const lang of (process.argv[2] || 'sv,en').split(',')) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  const p = await ctx.newPage();
  await p.addInitScript(({ SKU, PRIS }) => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { NativePurchases: {
      getProducts: async ({ productIdentifiers }) => ({ products: productIdentifiers.map((id) => ({ identifier: id, title: id, description: '', price: PRIS[id.slice(SKU.length)], priceString: `${PRIS[id.slice(SKU.length)]},00 kr`, currencyCode: 'SEK' })) }),
      purchaseProduct: async () => { throw new Error('User cancelled'); },
      restorePurchases: async () => {}, getPurchases: async () => ({ purchases: [] }), addListener: async () => ({ remove() {} }),
    } } };
  }, { SKU, PRIS });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&lang=${lang}&world=snap${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Lily', look: { skin: '#e0a97f', hair: '#3b2619', style: 'ponytail', shirt: '#e04848' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 9, min: 14 * 60, money: 1450, bank: 2000, hunger: 80, energy: 85, home: 'rum', fridge: {}, jobs: {}, earned: 0, mal: { rik: 'normal', lycka: 'normal', utb: 'normal', karr: 'normal' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] } }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  await p.waitForTimeout(1500);
  await p.click('#hud-mobil'); await p.waitForTimeout(200);
  await p.click('#mobilen [data-app="butik"]');
  await p.waitForFunction(() => document.querySelectorAll('#modal:not(.hidden) [data-kop]:not([disabled])').length >= 5, null, { timeout: 5000 });
  if (SLUT) await p.evaluate(() => { const l = document.querySelector('#modal .plist'); l?.lastElementChild?.scrollIntoView({ block: 'end' }); });
  await p.waitForTimeout(300);
  const fil = suffix + (SLUT ? '-slut' : '');
  await p.screenshot({ path: `${UT}/butik-${lang}${fil}.png` });
  await p.screenshot({ path: `${UT}/butik-${lang}${fil}.jpg`, type: 'jpeg', quality: 92 });   // utan alfakanal, till App Store Connect
  console.log(`${UT}/butik-${lang}${fil}.png + .jpg`);
  await ctx.close();
}
await browser.close();
