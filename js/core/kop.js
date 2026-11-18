// 🛍️ BUTIKEN – köp i appen (Carl 2026-10-07: "köp i appen: pengar och bostäder"; 2026-11-18: "nej ingen fråga
// före köpet" – Apples egen köpruta räcker, föräldrar har "Be om att få köpa" i familjedelningen).
// Bara i iOS-appen Pixelcity (Capacitor + @capgo/native-purchases = StoreKit 2). På webben finns ingen butik,
// så appen i mobilen är dold där (butikFinns).
//   • Varorna (PRODUKTER): pengapåsar – förbrukningsvara, pengarna läggs i handkassan – och bostäder utan hyra –
//     engångsköp: insatsen 0 kr och hyran 0 kr/vecka så länge man bor där (game.js insats/hyra). De överlever
//     Nytt spel och följer med Apple-kontot till en ny telefon (Återställ köp, och tyst vid varje start).
//   • Köpta pengar räknas inte mot livsmålet 💰 Rikedom (game.js malStatus drar bort kopPengar()).
//   • Läget ligger i localStorage snabbfilen_kop – utanför sparfilen: { v, pengar, bostader, tx, logg }.
//   • Varje transaktion bokförs EN gång (transactionId): själva köpet, ett "Be om att få köpa" som föräldern
//     godkänner senare (transactionUpdated) och Återställ köp får aldrig ge dubbelt.
//   • Marknadsföringslagen: inga köpuppmaningar till barn – butiken öppnas bara av spelaren själv, inga rutor
//     som dyker upp, ingen figur i spelet som säger "köp". Priserna kommer från Apple i spelarens valuta.
// Test: tools/kop-test.mjs (låtsad Capacitor). Apple-sidan (produkterna, texterna): app/appstore.md.
import { $t } from './i18n.js';
import { openModal, closeModal, toast } from './ui.js';
import { play } from './sound.js';
import { fmt } from '../game.js';   // (cirkel med game.js – används bara inne i funktionerna)

const SKU = 'io.eightbitcat.pixelcity.';
export const PRODUKTER = [
  { id: 'pengar1000', sku: SKU + 'pengar.1000', typ: 'pengar', kr: 1000, icon: '💰', namn: $t('Pengapåse 1 000 kr'), text: $t('1 000 kr rakt i handkassan.') },
  { id: 'pengar10000', sku: SKU + 'pengar.10000', typ: 'pengar', kr: 10000, icon: '💰', namn: $t('Pengapåse 10 000 kr'), text: $t('10 000 kr rakt i handkassan.') },
  { id: 'lagenhet', sku: SKU + 'bostad.lagenhet', typ: 'bostad', hem: 'lagenhet', icon: '🏢', namn: $t('Lägenheten utan hyra'), text: $t('Flytta in utan insats och bo utan hyra – för alltid.') },
  { id: 'villa', sku: SKU + 'bostad.villa', typ: 'bostad', hem: 'villa', icon: '🏡', namn: $t('Villan utan hyra'), text: $t('Eget hus med trädgård, ingen insats och ingen hyra – för alltid.') },
  { id: 'takvaning', sku: SKU + 'bostad.takvaning', typ: 'bostad', hem: 'takvaning', icon: '🏙️', namn: $t('Takvåningen utan hyra'), text: $t('Högst upp i Tornhuset, ingen insats och ingen hyra – för alltid.') },
];
const TITEL = $t('🛍️ Butiken');

// ---------- läget (utanför sparfilen) ----------
const KEY = 'snabbfilen_kop';
let S = null;
const arBostad = (h) => PRODUKTER.some((p) => p.typ === 'bostad' && p.hem === h);
const tvatta = (p) => ({
  v: 1,
  pengar: Math.max(0, Math.round(+p?.pengar || 0)),
  bostader: Array.isArray(p?.bostader) ? [...new Set(p.bostader.filter(arBostad))] : [],
  tx: Array.isArray(p?.tx) ? p.tx.filter((t) => typeof t === 'string' && t).slice(-300) : [],
  logg: Array.isArray(p?.logg) ? p.logg.slice(-100) : [],
});
function las() {
  if (S) return S;
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* trasigt – börja om */ }
  S = tvatta(p);
  return S;
}
function spara() { try { localStorage.setItem(KEY, JSON.stringify(las())); } catch { /* fullt */ } }
export const agerBostad = (hem) => las().bostader.includes(hem);   // bostad utan hyra?
export const kopPengar = () => las().pengar;                         // köpta pengar totalt (dras från livsmålet Rikedom)
export const kopLage = () => JSON.parse(JSON.stringify(las()));      // (tester)

// ---------- Apple ----------
const plugin = () => { try { return window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.NativePurchases || null : null; } catch { return null; } };
export const butikFinns = () => !!plugin();
let priser = null;   // sku → { pris: "12,00 kr", titel } från Apple (spelarens valuta)
async function hamtaPriser() {
  const P = plugin();
  if (!P || priser) return priser;
  const r = await P.getProducts({ productIdentifiers: PRODUKTER.map((p) => p.sku), productType: 'inapp' });
  const m = {};
  for (const x of r?.products || []) if (x?.identifier) m[x.identifier] = { pris: String(x.priceString || ''), titel: String(x.title || '') };
  priser = m;
  return priser;
}
const arOppen = () => document.querySelector('#modal .dlg')?.dataset.title === TITEL;
const tack = (v) => (v.typ === 'pengar' ? $t`💰 ${fmt(v.kr)} ligger i handkassan – tack!` : $t`🔑 ${v.namn} är din – ingen insats och ingen hyra. Flytta in hos Bostadsbyrån!`);

// Bokför en transaktion från Apple – en gång per transactionId. Returnerar varan, eller null om inget hände.
export function bokfor(A, tx) {
  const prod = PRODUKTER.find((p) => p.sku === tx?.productIdentifier);
  if (!prod) return null;
  const st = las(), id = String(tx.transactionId || '');
  if (tx.revocationDate) {   // Apple tog tillbaka köpet (återbetalning): bostaden försvinner, pengar som redan är spenderade rörs inte
    if (prod.typ === 'bostad' && st.bostader.includes(prod.hem)) { st.bostader = st.bostader.filter((h) => h !== prod.hem); spara(); }
    return null;
  }
  if (id && st.tx.includes(id)) return null;   // redan bokförd (köpet + transactionUpdated, eller Återställ köp)
  if (id) { st.tx.push(id); if (st.tx.length > 300) st.tx.splice(0, st.tx.length - 300); }
  const g = A?.game;
  if (prod.typ === 'pengar') { st.pengar += prod.kr; if (g) { g.money += prod.kr; g.save?.(); } }
  else if (prod.typ === 'bostad') { if (!st.bostader.includes(prod.hem)) st.bostader.push(prod.hem); }
  st.logg.push({ t: new Date().toISOString().slice(0, 16), id: prod.id });
  if (st.logg.length > 100) st.logg.shift();
  spara();
  return prod;
}

let upptagen = false;
async function kopa(A, prod) {
  const P = plugin();
  if (!P || !prod || upptagen) return;
  if (prod.typ === 'bostad' && agerBostad(prod.hem)) { toast($t('Den är redan din.')); return; }
  upptagen = true;
  if (arOppen()) rita(A, prod.id);
  try {
    const tx = await P.purchaseProduct({ productIdentifier: prod.sku, productType: 'inapp', quantity: 1, isConsumable: prod.typ === 'pengar' });
    const v = bokfor(A, tx);
    if (v) { play('ok'); toast(tack(v), 'good'); }
    // ingen vara: transactionUpdated hann bokföra först – det är redan klart
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (/pending/i.test(msg)) toast($t('Köpet väntar på att bli godkänt (Be om att få köpa). Det kommer in i spelet när det är klart.'));
    else if (!/cancel/i.test(msg)) toast($t('Köpet gick inte igenom. Försök igen om en stund.'), 'bad');
  }
  upptagen = false;
  if (arOppen()) rita(A);
}

// Återställ köp: bostäderna från Apple-kontot (nya telefonen, efter Nytt spel). Pengapåsar återställs inte –
// det är förbrukningsvaror. tyst = vid start, utan Apples inloggningsruta och utan besked.
export async function aterstall(A, { tyst = false } = {}) {
  const P = plugin();
  if (!P) return 0;
  try {
    if (!tyst) await P.restorePurchases();
    const r = await P.getPurchases({ productType: 'inapp', onlyCurrentEntitlements: true });
    let n = 0;
    const st = las();
    for (const tx of r?.purchases || []) {
      const p = PRODUKTER.find((x) => x.sku === tx?.productIdentifier);
      if (p?.typ === 'bostad' && !tx.revocationDate && !st.bostader.includes(p.hem)) { st.bostader.push(p.hem); n++; }
    }
    if (n) spara();
    if (!tyst) { toast(n ? $t`${n} köp återställda.` : $t('Allt du köpt finns redan här.'), n ? 'good' : ''); if (arOppen()) rita(A); }
    return n;
  } catch {
    if (!tyst) toast($t('Det gick inte att återställa just nu. Försök igen om en stund.'), 'bad');
    return 0;
  }
}

// Vid start i appen: köp som godkänns senare (Be om att få köpa) kommer som transactionUpdated, och bostäderna
// hämtas tyst från Apple-kontot så att de finns på en ny telefon utan att man trycker något.
export function startKop(A) {
  const P = plugin();
  if (!P) return;
  try {
    P.addListener?.('transactionUpdated', (tx) => {
      const v = bokfor(A, tx);
      if (v) { play('ok'); toast(tack(v), 'good'); if (arOppen()) rita(A); }
    });
  } catch { /* äldre app utan händelser */ }
  setTimeout(() => { aterstall(A, { tyst: true }).catch(() => {}); }, 4000);
}

// ---------- rutan ----------
export function openButik(A) {
  if (!butikFinns()) { toast($t('Butiken finns i appen Pixelcity.')); return; }
  play('click');
  rita(A);
  hamtaPriser().then(() => { if (arOppen()) rita(A); }).catch(() => { if (arOppen()) rita(A, null, true); });
}
function rita(A, laddar = null, fel = false) {
  const g = A.game, st = las();
  const rows = PRODUKTER.map((p) => {
    const din = p.typ === 'bostad' && st.bostader.includes(p.hem);
    const pris = priser?.[p.sku]?.pris || '';
    const knapp = din ? `<span class="ok">${$t('✓ Din')}</span>`
      : `<button class="btn btn-small ${pris && !laddar ? 'btn-go' : ''}" data-kop="${p.id}" ${!pris || laddar ? 'disabled' : ''}>${laddar === p.id ? $t('Köper …') : pris || (fel ? '–' : '…')}</button>`;
    return `<div class="prow homerow"><span style="font-size:28px;text-align:center">${p.icon}</span><span class="nm">${p.namn}<br><small class="sp">${p.text}</small></span>${knapp}</div>`;
  }).join('');
  const dlg = openModal(TITEL, `<p style="font-size:var(--f2);margin-top:0">${$t('Köpen betalas med riktiga pengar via Apple och landar direkt i spelet.')} 💰 <b>${fmt(g.money)}</b></p>
    <div class="plist">${rows}</div>
    ${fel ? `<p class="bad" style="font-size:var(--f2);margin-bottom:0">${$t('Priserna gick inte att hämta just nu. Kolla att du har internet och öppna butiken igen.')}</p>` : ''}
    <p class="sp" style="font-size:var(--f2);margin-bottom:0">${$t('Köpta pengar räknas inte mot livsmålet Rikedom. En bostad du köpt följer med ditt Apple-konto – tryck Återställ köp på en ny telefon.')}</p>`, [
    { label: $t('Återställ köp'), onClick: () => aterstall(A) },
    { label: $t('Stäng'), onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-kop]').forEach((b) => (b.onclick = () => kopa(A, PRODUKTER.find((p) => p.id === b.dataset.kop))));
  return dlg;
}
