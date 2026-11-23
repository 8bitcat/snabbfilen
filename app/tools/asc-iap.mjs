// Pixelcitys köp i App Store Connect via App Store Connect API (nyckeln Codemagic, App Manager).
// Nyckelfilen läses bara här för att signera anropen – den skrivs aldrig ut.
//   node asc-iap.mjs lista              vad som finns: produkter, språk, pris, tillgänglighet, bild
//   node asc-iap.mjs prispunkter        Apples prispunkter i SEK för första produkten (nära våra priser)
//   node asc-iap.mjs allt               skapa det som saknas: produkter, språk, pris, länder, bild, Review Notes
import fs from 'fs';
import crypto from 'crypto';

const ISS = '08e19ca3-bbeb-4a09-8096-06f1e3eb6e4b', KID = '94H7H2CY53', APP = '6818844405';
const KEYFILE = 'C:/Users/palss/Downloads/AuthKey_94H7H2CY53.p8';
const PNG = 'D:/GamesProjects/snabbfilen/app/store/iap/butik-sv.png';
const key = fs.readFileSync(KEYFILE, 'utf8');
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: KID, typ: 'JWT' }), p = b64({ iss: ISS, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const API = 'https://api.appstoreconnect.apple.com';
async function call(method, path, body) {
  const r = await fetch(path.startsWith('http') ? path : API + path, { method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* tomt svar */ }
  if (!r.ok) { const e = new Error(`${method} ${path} → ${r.status}: ${txt.slice(0, 700)}`); e.status = r.status; throw e; }
  return j;
}
async function alla(path) { const out = []; let next = path; while (next) { const j = await call('GET', next); out.push(...(j.data || [])); next = j.links?.next || null; } return out; }
const tyst404 = (p) => p.catch((e) => { if (e.status === 404) return null; throw e; });

const REVIEW = 'Open the phone button (bottom right) → "Butik" (Shop). The shop lists the products with StoreKit prices. Money bags are consumables (added to the in-game wallet); rent-free homes are non-consumables (no deposit, no weekly rent in the game) with a "Restore Purchases" button in the same dialog. Gift boxes are consumables that place a present in the in-game phone\'s "Presenter" (Presents) app: each box\'s contents are fixed by type and listed in the shop before purchase (e.g. always 500 kr, one outfit and one card pack); only which specific outfit or furniture piece is drawn is random, uniformly among the items the player does not yet own. Purchased money does not count towards the in-game "Wealth" life goal. The shop only exists in the iOS app, never on the web version.';
const SKU = 'io.eightbitcat.pixelcity.';
const LOC = { sv: 'sv', en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pl: 'pl', it: 'it', pt: 'pt-PT' };
const PRODUKTER = [
  { namn: 'Pengapåse 1 000 kr', sku: SKU + 'pengar.1000', typ: 'CONSUMABLE', pris: 12, loc: {
    sv: ['Pengapåse 1 000 kr', '1 000 kr rakt i handkassan i Pixelstaden.'], en: ['Money Bag $1,000', '$1,000 straight into your pocket.'],
    es: ['Bolsa de dinero 1.000 €', '1.000 € directos a tu bolsillo.'], de: ['Geldbeutel 1.000 €', '1.000 € direkt in die Tasche.'],
    fr: ["Sac d'argent 1 000 €", '1 000 € directement dans ta poche.'], pl: ['Sakiewka 1 000 zł', '1 000 zł prosto do kieszeni.'],
    it: ['Sacco di soldi 1.000 €', '1.000 € dritti in tasca.'], pt: ['Saco de dinheiro 1.000 €', '1.000 € diretamente para o teu bolso.'] } },
  { namn: 'Pengapåse 10 000 kr', sku: SKU + 'pengar.10000', typ: 'CONSUMABLE', pris: 49, loc: {
    sv: ['Pengapåse 10 000 kr', '10 000 kr rakt i handkassan i Pixelstaden.'], en: ['Money Bag $10,000', '$10,000 straight into your pocket.'],
    es: ['Bolsa de dinero 10.000 €', '10.000 € directos a tu bolsillo.'], de: ['Geldbeutel 10.000 €', '10.000 € direkt in die Tasche.'],
    fr: ["Sac d'argent 10 000 €", '10 000 € directement dans ta poche.'], pl: ['Sakiewka 10 000 zł', '10 000 zł prosto do kieszeni.'],
    it: ['Sacco di soldi 10.000 €', '10.000 € dritti in tasca.'], pt: ['Saco de dinheiro 10.000 €', '10.000 € diretamente para o teu bolso.'] } },
  { namn: 'Lägenheten utan hyra', sku: SKU + 'bostad.lagenhet', typ: 'NON_CONSUMABLE', pris: 29, loc: {
    sv: ['Lägenheten utan hyra', 'Flytta in utan insats, bo utan hyra.'], en: ['The Apartment, rent-free', 'Move in with no deposit, live rent-free.'],
    es: ['El piso sin alquiler', 'Múdate sin entrada y vive sin alquiler.'], de: ['Stadtwohnung ohne Miete', 'Ohne Kaution einziehen, ohne Miete wohnen.'],
    fr: ["L'appartement sans loyer", 'Emménage sans caution, vis sans loyer.'], pl: ['Mieszkanie bez czynszu', 'Bez kaucji i bez czynszu, na zawsze.'],
    it: ["L'appartamento senza affitto", 'Senza caparra e senza affitto, per sempre.'], pt: ['O Apartamento sem renda', 'Sem entrada e sem renda, para sempre.'] } },
  { namn: 'Villan utan hyra', sku: SKU + 'bostad.villa', typ: 'NON_CONSUMABLE', pris: 59, loc: {
    sv: ['Villan utan hyra', 'Eget hus med trädgård, ingen hyra.'], en: ['The Villa, rent-free', 'Your own house with a garden, no rent.'],
    es: ['El chalet sin alquiler', 'Casa con jardín, sin entrada ni alquiler.'], de: ['Villa ohne Miete', 'Eigenes Haus mit Garten, keine Miete.'],
    fr: ['La villa sans loyer', 'Ta maison avec jardin, sans loyer.'], pl: ['Willa bez czynszu', 'Własny dom z ogrodem, bez czynszu.'],
    it: ['La villa senza affitto', 'Casa con giardino, senza affitto.'], pt: ['A Vivenda sem renda', 'Casa com jardim, sem renda.'] } },
  { namn: 'Takvåningen utan hyra', sku: SKU + 'bostad.takvaning', typ: 'NON_CONSUMABLE', pris: 99, loc: {
    sv: ['Takvåningen utan hyra', 'Högst upp i Tornhuset, ingen hyra.'], en: ['The Penthouse, rent-free', 'Top of Tower House, no deposit, no rent.'],
    es: ['El ático sin alquiler', 'Lo más alto de la torre, sin alquiler.'], de: ['Penthouse ohne Miete', 'Ganz oben im Turmhaus, keine Miete.'],
    fr: ['Le penthouse sans loyer', 'Tout en haut de la tour, sans loyer.'], pl: ['Penthouse bez czynszu', 'Na szczycie wieżowca, bez czynszu.'],
    it: ["L'attico senza affitto", 'In cima alla Torre, senza affitto.'], pt: ['A Penthouse sem renda', 'No topo da Torre, sem renda.'] } },
  // 🎁 presentlådor (v0.171, 2026-11-23 – Carl: "du kan sätta priserna"): förbrukningsvaror, hamnar i mobilens 🎁 Presenter
  { namn: 'Liten present', sku: SKU + 'present.liten', typ: 'CONSUMABLE', pris: 9, loc: {
    sv: ['Liten present', 'En sak värd minst 150 kr – alltid ny.'], en: ['Small Gift', 'One new item worth $150 or more.'],
    es: ['Regalo pequeño', 'Un objeto nuevo de 150 € o más.'], de: ['Kleines Geschenk', 'Ein neues Teil im Wert von 150 € oder mehr.'],
    fr: ['Petit cadeau', 'Un objet neuf de 150 € ou plus.'], pl: ['Mały prezent', 'Jedna nowa rzecz warta co najmniej 150 zł.'],
    it: ['Regalo piccolo', 'Un oggetto nuovo da 150 € o più.'], pt: ['Presente pequeno', 'Um item novo de 150 € ou mais.'] } },
  { namn: 'Mellanlådan', sku: SKU + 'present.mellan', typ: 'CONSUMABLE', pris: 29, loc: {
    sv: ['Mellanlådan', 'Alltid 500 kr, ett plagg och ett kortpaket.'], en: ['The Medium Box', 'Always $500, an outfit and a card pack.'],
    es: ['La caja mediana', 'Siempre 500 €, una prenda y un sobre.'], de: ['Die mittlere Kiste', 'Immer 500 €, ein Outfit und ein Kartenpack.'],
    fr: ['La boîte moyenne', 'Toujours 500 €, une tenue et un paquet.'], pl: ['Średnia skrzynka', 'Zawsze 500 zł, strój i paczka kart.'],
    it: ['La scatola media', 'Sempre 500 €, un capo e un pacchetto.'], pt: ['A caixa média', 'Sempre 500 €, uma peça e um pacote.'] } },
  { namn: 'Stora lådan', sku: SKU + 'present.stor', typ: 'CONSUMABLE', pris: 59, loc: {
    sv: ['Stora lådan', 'Alltid 1 500 kr, plagg, möbel, kort, pokal.'], en: ['The Big Box', 'Always $1,500, outfit, furniture, cards, cup.'],
    es: ['La caja grande', 'Siempre 1.500 €, prenda, mueble, sobre, copa.'], de: ['Die große Kiste', 'Immer 1.500 €, Outfit, Möbel, Karten, Pokal.'],
    fr: ['La grande boîte', 'Toujours 1 500 €, tenue, meuble, cartes.'], pl: ['Duża skrzynka', 'Zawsze 1 500 zł, strój, mebel, karty, puchar.'],
    it: ['La scatola grande', 'Sempre 1.500 €, capo, mobile, carte, coppa.'], pt: ['A caixa grande', 'Sempre 1.500 €, peça, móvel, cartas, taça.'] } },
];
for (const p of PRODUKTER) for (const [l, [n, d]] of Object.entries(p.loc)) { if (n.length > 30 || d.length > 45) throw new Error(`för lång text (${p.sku} ${l}): "${n}" ${n.length}/30, "${d}" ${d.length}/45`); }

const befintliga = () => alla(`/v1/apps/${APP}/inAppPurchasesV2?limit=200`);
async function status(iap) {
  const id = iap.id;
  const loc = await alla(`/v2/inAppPurchases/${id}/inAppPurchaseLocalizations?limit=50`);
  const sched = await tyst404(call('GET', `/v2/inAppPurchases/${id}/iapPriceSchedule`));
  const avail = await tyst404(call('GET', `/v2/inAppPurchases/${id}/inAppPurchaseAvailability`));
  const bild = await tyst404(call('GET', `/v2/inAppPurchases/${id}/appStoreReviewScreenshot`));
  let pris = '–', lander = '–';
  if (sched?.data) {
    const mp = await call('GET', `/v1/inAppPurchasePriceSchedules/${sched.data.id}/manualPrices?include=inAppPurchasePricePoint&limit=5`);
    const bas = await tyst404(call('GET', `/v1/inAppPurchasePriceSchedules/${sched.data.id}/baseTerritory`));
    const pp = (mp.included || []).find((x) => x.type === 'inAppPurchasePricePoints');
    pris = `${pp?.attributes?.customerPrice ?? 'satt'} (${bas?.data?.id || '?'})`;
  }
  if (avail?.data) {
    const t = await alla(`/v1/inAppPurchaseAvailabilities/${avail.data.id}/availableTerritories?limit=200`);
    lander = t.length + (avail.data.attributes.availableInNewTerritories ? '+nya' : '');
  }
  return { sku: iap.attributes.productId, namn: iap.attributes.name, typ: iap.attributes.inAppPurchaseType, state: iap.attributes.state, sprak: loc.map((l) => l.attributes.locale).sort().join(' ') || '–', pris, lander, bild: bild?.data ? (bild.data.attributes.assetDeliveryState?.state || 'finns') : '–', note: iap.attributes.reviewNote ? 'ja' : '–', id };
}

// Laddar upp en granskningsbild (jpg/png) till en produkt och väntar på Apples besked (COMPLETE eller FAILED + fel).
async function laddaUppBild(id, fil) {
  const buf = fs.readFileSync(fil), fileName = fil.split('/').pop();
  const r = await call('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', { data: { type: 'inAppPurchaseAppStoreReviewScreenshots', attributes: { fileName, fileSize: buf.length }, relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id } } } } });
  for (const op of r.data.attributes.uploadOperations) {
    const h = {}; for (const x of op.requestHeaders) h[x.name] = x.value;
    const u = await fetch(op.url, { method: op.method, headers: h, body: buf.subarray(op.offset, op.offset + op.length) });
    if (!u.ok) throw new Error(`uppladdningen: ${u.status} ${await u.text()}`);
  }
  await call('PATCH', `/v1/inAppPurchaseAppStoreReviewScreenshots/${r.data.id}`, { data: { type: 'inAppPurchaseAppStoreReviewScreenshots', id: r.data.id, attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } } });
  for (let i = 0; i < 20; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const j = await call('GET', `/v1/inAppPurchaseAppStoreReviewScreenshots/${r.data.id}`);
    const st = j.data.attributes.assetDeliveryState;
    if (st?.state === 'COMPLETE') return `COMPLETE (${fileName})`;
    if (st?.state === 'FAILED') return `FAILED ${JSON.stringify(st.errors)} (${fileName})`;
  }
  return 'väntar fortfarande';
}

const cmd = process.argv[2] || 'lista';
if (cmd === 'bild') {   // node asc-iap.mjs bild <fil> [del av produkt-ID] – byter ut (misslyckad) granskningsbild
  const fil = process.argv[3], filt = process.argv[4] || '';
  for (const iap of (await befintliga()).filter((x) => x.attributes.productId.includes(filt))) {
    const bild = await tyst404(call('GET', `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`));
    if (bild?.data) { await call('DELETE', `/v1/inAppPurchaseAppStoreReviewScreenshots/${bild.data.id}`); console.log(`- gammal bild borttagen (${bild.data.attributes.assetDeliveryState?.state})`); }
    console.log(iap.attributes.productId, await laddaUppBild(iap.id, fil));
  }
}
if (cmd === 'lista') {
  const list = await befintliga();
  for (const iap of list) console.log(await status(iap));
  if (!list.length) console.log('(inga produkter än)');
}
if (cmd === 'prispunkter') {
  const list = await befintliga();
  if (!list.length) throw new Error('ingen produkt att läsa prispunkter för');
  const pts = await alla(`/v2/inAppPurchases/${list[0].id}/pricePoints?filter[territory]=SWE&limit=200`);
  const pr = pts.map((p) => +p.attributes.customerPrice).sort((a, b) => a - b);
  console.log(`${pr.length} prispunkter i SEK för ${list[0].attributes.productId}. De under 150 kr:`, pr.filter((x) => x <= 150).join(', '));
}
if (cmd === 'allt') {
  const list = await befintliga();
  const terr = await alla('/v1/territories?limit=200');
  const png = fs.readFileSync(PNG), md5 = crypto.createHash('md5').update(png).digest('hex');
  for (const P of PRODUKTER) {
    let iap = list.find((x) => x.attributes.productId === P.sku);
    if (!iap) {
      const j = await call('POST', '/v2/inAppPurchases', { data: { type: 'inAppPurchases', attributes: { name: P.namn, productId: P.sku, inAppPurchaseType: P.typ, reviewNote: REVIEW }, relationships: { app: { data: { type: 'apps', id: APP } } } } });
      iap = j.data; console.log(`+ skapad: ${P.sku} (${iap.id})`);
    } else if (!iap.attributes.reviewNote) {   // (det Carl redan fyllt i rörs inte)
      await call('PATCH', `/v2/inAppPurchases/${iap.id}`, { data: { type: 'inAppPurchases', id: iap.id, attributes: { reviewNote: REVIEW } } });
      console.log(`~ Review Notes: ${P.sku}`);
    }
    const id = iap.id;
    // språken
    const har = await alla(`/v2/inAppPurchases/${id}/inAppPurchaseLocalizations?limit=50`);
    for (const [l, [name, description]] of Object.entries(P.loc)) {
      const locale = LOC[l], fin = har.find((x) => x.attributes.locale === locale);
      if (!fin) { await call('POST', '/v1/inAppPurchaseLocalizations', { data: { type: 'inAppPurchaseLocalizations', attributes: { locale, name, description }, relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id } } } } }); console.log(`  + ${locale}: ${name}`); }
      else if (fin.attributes.name !== name || fin.attributes.description !== description) console.log(`  (${locale} finns redan: "${fin.attributes.name}" / "${fin.attributes.description}" – lämnas)`);
    }
    // priset: Sverige som basland, Apples prispunkt närmast vårt pris
    const sched = await tyst404(call('GET', `/v2/inAppPurchases/${id}/iapPriceSchedule`));
    if (!sched?.data) {
      const pts = await alla(`/v2/inAppPurchases/${id}/pricePoints?filter[territory]=SWE&limit=200`);
      const pt = pts.map((p) => ({ id: p.id, pris: +p.attributes.customerPrice })).sort((a, b) => Math.abs(a.pris - P.pris) - Math.abs(b.pris - P.pris))[0];
      if (!pt) throw new Error(`inga prispunkter för ${P.sku}`);
      await call('POST', '/v1/inAppPurchasePriceSchedules', { data: { type: 'inAppPurchasePriceSchedules', relationships: { inAppPurchase: { data: { type: 'inAppPurchases', id } }, baseTerritory: { data: { type: 'territories', id: 'SWE' } }, manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${p0}' }] } } }, included: [{ type: 'inAppPurchasePrices', id: '${p0}', attributes: { startDate: null }, relationships: { inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: pt.id } } } }] });
      console.log(`  + pris ${pt.pris} kr${pt.pris !== P.pris ? ` (närmaste Apple-pris till ${P.pris})` : ''}`);
    }
    // alla länder, även nya
    const avail = await tyst404(call('GET', `/v2/inAppPurchases/${id}/inAppPurchaseAvailability`));
    if (!avail?.data) { await call('POST', '/v1/inAppPurchaseAvailabilities', { data: { type: 'inAppPurchaseAvailabilities', attributes: { availableInNewTerritories: true }, relationships: { inAppPurchase: { data: { type: 'inAppPurchases', id } }, availableTerritories: { data: terr.map((t) => ({ type: 'territories', id: t.id })) } } } }); console.log(`  + ${terr.length} länder`); }
    // granskningsbilden
    const bild = await tyst404(call('GET', `/v2/inAppPurchases/${id}/appStoreReviewScreenshot`));
    if (!bild?.data) console.log('  + granskningsbild:', await laddaUppBild(id, PNG));
  }
  console.log('--- läget nu:');
  for (const iap of await befintliga()) console.log(await status(iap));
}
