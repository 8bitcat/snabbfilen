// Överdelar + tryck/mönster på överdelen. Se docs/PEOPLE-ARKITEKTUR.md.
//
// Motorn ritar själv bålens grundyta i tröjfärgen (R.shirt) och ärmarna. En post
// i TOP_REG lägger till detaljerna ovanpå: krage, dragkedja, knappar, ficka …
//   { label, group?, sleeve: 'short'|'long'|'none', sleeveAt?(R, j), front(R), back(R), side(R), prep?, krokar }
//   sleeve    – ärmlängd: 'short' (3 px tyg, sen hud), 'long' (tyg till handen), 'none' (bara hud)
//   sleeveAt  – valfri: ramp för ärmens rad j (0 = axeln), t.ex. randiga ärmar.
//               Returnera undefined för tröjfärgen. Anropas för stående/gående armar
//               (framifrån, bakifrån och från sidan – kolla R.side om det bara ska gälla en vy).
// Mått framifrån/bakifrån: bålen är x = 12-R.tw … 11+R.tw, y = R.ty0 … R.ty1-1.
// Från sidan: x = 9 … 15, y = R.torsoTop … R.ty1-1 (ryggen åt vänster, bröstet åt höger).
// Färger: R.shirt (tröjan), R.acc (detaljfärgen look.accent), R.print (look.print2), R.skin.
//
// Ändra inte de gamla posterna – de är pixellåsta av tools/people-regress.mjs.
import { TAG, mix, ramp, far, toneOf } from './util.js';

// halsringning som på en t-shirt
const neckTee = (R) => { const { rect, put, skin, ty0, K } = R; rect(11, ty0, 2, 1, skin.lo); if (!K) { put(11, ty0 + 1, skin.lo); put(12, ty0 + 1, skin.lo); } };
const stripesFB = (R) => { const { rect, put, acc, ty0, ty1, tw } = R; for (let y = ty0 + 2; y < ty1 - 1; y += 2) { rect(13 - tw, y, tw * 2 - 3, 1, acc.base); put(10 + tw, y, acc.lo); } };
const vestFB = (R) => { const { rect, put, skin, shirt, ty0, tw, back } = R; rect(12 - tw + 1, ty0, tw * 2 - 2, 1, skin.base); put(12 - tw, ty0, skin.lo); put(11 + tw, ty0, skin.lo); put(10, ty0, shirt.base); put(13, ty0, shirt.base); if (!back) rect(11, ty0 + 1, 2, 1, skin.lo); };
const dotsFB = (R) => { const { put, acc, ty0, ty1, tw } = R; for (let y = ty0 + 1; y < ty1 - 1; y++) for (let x = 12 - tw + 1; x < 11 + tw; x++) if ((x * 3 + y * 7) % 5 === 0) put(x, y, acc.base); };

export const TOP_REG = {
  tee: {
    label: 'T-shirt', group: 'T-shirts & linnen', sleeve: 'short',
    front(R) { neckTee(R); const { rect, put, acc, ty0, K, L } = R; if (!L.apron && !K) { rect(13, ty0 + 3, 2, 2, acc.base); put(13, ty0 + 3, acc.hi); } },
  },
  stripes: {
    label: 'Randig', group: 'T-shirts & linnen', sleeve: 'short',
    sleeveAt(R, j) { return !R.side && j % 2 === 1 ? R.acc : undefined; },
    front(R) { stripesFB(R); neckTee(R); },
    back: stripesFB,
    side(R) { const { rect, acc, torsoTop, ty1 } = R; for (let y = torsoTop + 1; y < ty1; y++) if ((y - torsoTop) % 2 === 0) rect(10, y, 5, 1, acc.base); },
  },
  hoodie: {
    label: 'Huv\u00adtröja', group: 'Tröjor', sleeve: 'long',
    front(R) { const { rect, put, shirt, ty0, ty1, tw } = R;
      rect(12 - tw + 1, ty0, tw * 2 - 2, 1, shirt.lo);
      put(10, ty0 + 1, 0xf2f0ea); put(10, ty0 + 2, 0xf2f0ea); put(13, ty0 + 1, 0xf2f0ea); put(13, ty0 + 3, 0xf2f0ea);
      rect(12 - tw + 2, ty1 - 3, tw * 2 - 4, 1, shirt.lo); }, // magficka
    back(R) { const { rect, put, shirt, ty0 } = R; rect(9, ty0, 6, 3, shirt.lo); rect(10, ty0, 4, 2, shirt.base); put(10, ty0, shirt.hi); },
    side(R) { const { rect, put, shirt, torsoTop } = R; rect(8, torsoTop, 3, 3, shirt.lo); put(9, torsoTop, shirt.base); },
  },
  jacket: {
    label: 'Jacka', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, ty1 } = R;
      rect(11, ty0, 2, ty1 - ty0, acc.base); put(11, ty0 + 1, acc.hi);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo); },
    side(R) { R.rect(15, R.torsoTop, 1, R.hipTop - R.torsoTop, R.acc.base); },
  },
  sweater: {
    label: 'Tröja', group: 'Tröjor', sleeve: 'long',
    front(R) { const { rect, shirt, skin, ty0 } = R; rect(10, ty0, 4, 1, shirt.lo); rect(11, ty0, 2, 1, skin.lo); },
  },
  shirt: { // skjorta: krage + knappar i detaljfärgen
    label: 'Skjorta', group: 'Skjortor', sleeve: 'short',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1 } = R;
      rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo);
      put(10, ty0, acc.hi); put(13, ty0, acc.hi); put(10, ty0 + 1, acc.base); put(12, ty0 + 1, acc.base); put(13, ty0 + 1, acc.lo);
      for (let y = ty0 + 2; y < ty1 - 1; y++) put(11, y, shirt.lo);
      for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, acc.base); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.acc.base); },
    side(R) { const { rect, put, acc, torsoTop } = R; rect(13, torsoTop, 3, 1, acc.base); put(15, torsoTop + 1, acc.lo); },
  },
  vest: { // linne: bara axelband överst, hud på axlarna
    label: 'Linne', group: 'T-shirts & linnen', sleeve: 'none',
    front: vestFB, back: vestFB,
    side(R) { const { rect, put, skin, shirt, torsoTop } = R; rect(9, torsoTop, 7, 1, skin.base); put(15, torsoTop, skin.hi); put(11, torsoTop, shirt.base); put(9, torsoTop, skin.lo); },
  },
  hawaii: { // mönstrad skjorta: prickar i detaljfärgen
    label: 'Hawaii', group: 'Skjortor', sleeve: 'short',
    front(R) { dotsFB(R); const { rect, put, skin, ty0 } = R; rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo); put(12, ty0 + 1, skin.lo); },
    back: dotsFB,
    side(R) { const { put, acc, torsoTop, hipTop } = R; for (let y = torsoTop + 1; y < hipTop; y++) for (let x = 10; x < 15; x++) if ((x * 3 + y * 7) % 5 === 0) put(x, y, acc.base); },
  },
  suit: { // kavaj: vit skjorta, slips i detaljfärgen, slag
    label: 'Kavaj', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, ty1 } = R;
      rect(11, ty0, 2, 2, 0xf4f1ea); put(11, ty0 + 2, 0xf4f1ea); put(12, ty0 + 2, 0xf4f1ea);
      put(12, ty0 + 1, acc.hi);
      for (let y = ty0 + 2; y < ty1 - 2; y++) put(12, y, acc.base);
      put(12, ty1 - 2, acc.lo);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo); },
    back(R) { const { rect, shirt, ty0, tw } = R; rect(12 - tw + 1, ty0, tw * 2 - 2, 1, shirt.lo); },
    side(R) { const { rect, put, shirt, acc, torsoTop } = R; rect(13, torsoTop, 3, 2, 0xf4f1ea); put(14, torsoTop + 1, acc.base); put(13, torsoTop, shirt.lo); },
  },
};

// =====================================================================================
// NYA ÖVERDELAR (2026-09). Hjälpare först, sedan posterna, som läggs till i TOP_REG
// längst ner (efter de pixellåsta). Mått framifrån: bålen x = xl … xr (xl = 12-tw,
// xr = 11+tw), rad R.ty0 är axelraden (en pixel smalare på varje sida), R.ty1-1 är
// bålens nedersta rad. Armarna ligger utanför bålen (x = xl-2, xl-1 och xr+1, xr+2).
// Från sidan: bålen x = 9 … 15 (ryggen x 9–10, bröstet x 14–15); närmaste armen täcker
// x 11–13 från rad ty0+1. Huvudet slutar på raden ovanför ty0 (hakan x 9–14 framifrån).
// =====================================================================================

// fasta färger (ramper) för detaljer som inte följer spelarens färgval
const WHITE = ramp(0xf4f1ea);   // vit skjorta, krage, knappar
const METAL = ramp(0xb9bfc9);   // dragkedjor, spännen, stetoskop
const GOLD = ramp(0xe2b53c);    // guldknappar, galoner, polisbricka
const INK = ramp(0x2a2630);     // svart: bälten, slipsar, radio
const FUR = ramp(0xece4d4);     // pälskant (parkas, tomtejacka)
const REFLEX = ramp(0xdfe3ea);  // reflexband (silver)
const NEON = ramp(0xe8e04a);    // reflexgult

const xl = (R) => 12 - R.tw, xr = (R) => 11 + R.tw;
// lodrät linje x, rad y0 … y1-1
const vline = (R, x, y0, y1, c) => { for (let y = y0; y < y1; y++) R.put(x, y, c); };
// är färgen en ton i tröjans ramp? (så att mönster inte målar över tryck och detaljer)
const onShirt = (R, c) => toneOf(c, R.shirt) != null;
// ärmarnas mudd/manschett: ärmpixeln närmast handen (eller närmast bar arm på kortärmat)
const cuffs = (R, c) => R.pattern(TAG.sleeve, (x, y) => (R.tagAt(x, y + 1) === TAG.skin ? c : null));
// allt ärmtyg i en annan ramp (collegejackans ärmar, vit skjorta under västen …)
const sleevesIn = (R, c) => R.pattern(TAG.sleeve, (x, y, k) => (onShirt(R, k) ? c : null));
// mönster på bål + ärmar (fn(x, y) → ramp | null), bara på tröjfärgade pixlar
const allOver = (R, tag, fn) => R.pattern(tag, (x, y, k) => (onShirt(R, k) ? fn(x, y) : null));
// ramp mitt emellan två färger (rutor, tonade mönster)
const between = (a, b, t = 0.5) => ramp(mix(a.base, b.base, t));
// ljus/mörk variant av en ramp (tonen behålls när den används i R.pattern)
const lighter = (r) => ({ hi: r.hi, base: r.hi, lo: r.base, dk: r.lo });
// t-shirtens halsringning (utan tröjans märke)
const teeNeck = (R) => { const { rect, skin, ty0, K } = R; rect(11, ty0, 2, 1, skin.lo); if (!K) rect(11, ty0 + 1, 2, 1, skin.lo); };
// bar hud på bålens rad y från x a till b (med skuggning i kanterna)
const skinRow = (R, y, a, b) => { const { rect, put, skin } = R; rect(a, y, b - a + 1, 1, skin.base); put(a, y, skin.hi); put(b, y, skin.lo); };

// Rockskört nedanför midjan (kroken beforeTorso): n rader, flare = extra bredd längst ner,
// open = framkanten öppen i mitten (byxorna syns). Ritas med TAG.torso så att tryck följer med.
// Sittande blir skörtet högst 2 rader (det ligger i knät).
const hemRows = (R, n) => (R.sit ? Math.min(n, 2) : n);
function coatHem(R, nA, nK = 1, { flare = 0, open = false, slit = true } = {}) {
  const { rect, put, shirt, hy, K, tw } = R;
  const n = hemRows(R, K ? nK : nA);
  if (n <= 0) return;
  R.tag = TAG.torso;
  for (let j = 0; j < n; j++) {
    const y = hy + j, e = flare && n > 2 ? Math.floor((j * (flare + 1)) / n) : 0;
    if (!R.side) {
      const a = 12 - tw - e, b = 11 + tw + e;
      rect(a, y, b - a + 1, 1, j === n - 1 ? shirt.lo : shirt.base);
      put(a, y, shirt.hi); put(b, y, shirt.lo); put(b - 1, y, shirt.lo);
      if (open && j >= 1) { put(11, y, R.pants.lo); put(12, y, R.pants.base); }
      else if (slit && !R.back) put(12, y, shirt.lo);
      else if (slit && R.back && j >= n - 2) put(11, y, shirt.dk);
    } else {
      const a = 9 - e, b = 15 + e;
      rect(a, y, b - a + 1, 1, j === n - 1 ? shirt.lo : shirt.base);
      put(a, y, shirt.lo); put(b, y, shirt.hi);
    }
  }
}

const TOPS_NEW = {
  // ---------------- T-shirts & linnen ----------------
  tank: { // tanktop: djupa ärmhål, rund halsringning med kant, racerrygg
    label: 'Tank­top', group: 'T-shirts & linnen', sleeve: 'none',
    front(R) { const { put, skin, shirt, acc, ty0, K } = R; const a = xl(R), b = xr(R), sL = Math.max(9, a + 2), sR = 23 - sL;
      skinRow(R, ty0, a + 1, b - 1); put(sL, ty0, shirt.base); put(sR, ty0, shirt.lo);
      put(a, ty0 + 1, skin.hi); put(b, ty0 + 1, skin.lo); if (!K) { put(a, ty0 + 2, skin.hi); put(b, ty0 + 2, skin.lo); }
      if (K) { put(11, ty0 + 1, acc.base); put(12, ty0 + 1, acc.lo); }
      else { put(11, ty0 + 1, skin.lo); put(12, ty0 + 1, skin.lo); put(sL + 1, ty0 + 1, acc.base); put(sR - 1, ty0 + 1, acc.lo); put(11, ty0 + 2, acc.base); put(12, ty0 + 2, acc.lo); } },
    back(R) { const { put, skin, shirt, ty0, K } = R; const a = xl(R), b = xr(R);
      skinRow(R, ty0, a + 1, b - 1); put(11, ty0, shirt.base); put(12, ty0, shirt.lo);
      put(a, ty0 + 1, skin.hi); put(a + 1, ty0 + 1, skin.base); put(b - 1, ty0 + 1, skin.base); put(b, ty0 + 1, skin.lo);
      if (!K) { put(a, ty0 + 2, skin.hi); put(b, ty0 + 2, skin.lo); put(a + 2, ty0 + 1, skin.lo); put(b - 2, ty0 + 1, skin.lo); } },
    side(R) { const { rect, put, skin, shirt, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, skin.base); put(15, torsoTop, skin.hi); put(12, torsoTop, shirt.base); put(10, torsoTop, skin.lo); put(15, torsoTop + 1, skin.lo); put(14, torsoTop + 1, acc.base); put(15, torsoTop + 2, acc.lo); },
  },
  crop: { // magtröja: bar mage med navel
    label: 'Mag­tröja', group: 'T-shirts & linnen', sleeve: 'short',
    front(R) { const { rect, put, skin, shirt, ty1, K } = R; const a = xl(R), b = xr(R), n = K ? 2 : 3;
      teeNeck(R);
      for (let y = ty1 - n; y < ty1; y++) skinRow(R, y, a, b);
      rect(a + 1, ty1 - n - 1, b - a - 1, 1, shirt.lo);
      if (!K) put(11, ty1 - 2, skin.lo); },
    back(R) { const { rect, shirt, ty1, K } = R; const a = xl(R), b = xr(R), n = K ? 2 : 3;
      for (let y = ty1 - n; y < ty1; y++) skinRow(R, y, a, b);
      rect(a + 1, ty1 - n - 1, b - a - 1, 1, shirt.lo); },
    side(R) { const { rect, put, skin, shirt, ty1, K } = R; const n = K ? 2 : 3;
      for (let y = ty1 - n; y < ty1; y++) { rect(9, y, 7, 1, skin.base); put(9, y, skin.lo); put(15, y, skin.hi); }
      rect(10, ty1 - n - 1, 6, 1, shirt.lo); },
  },
  ringer: { // t-shirt med kontrastkant runt halsen och ärmarna
    label: 'Ringer-tee', group: 'T-shirts & linnen', sleeve: 'short',
    front(R) { const { put, acc, ty0, K } = R; teeNeck(R);
      put(10, ty0, acc.base); put(13, ty0, acc.lo);
      if (K) { put(11, ty0 + 1, acc.base); put(12, ty0 + 1, acc.lo); }
      else { put(10, ty0 + 1, acc.base); put(13, ty0 + 1, acc.lo); put(11, ty0 + 2, acc.base); put(12, ty0 + 2, acc.lo); } },
    back(R) { R.rect(10, R.ty0, 4, 1, R.acc.base); },
    side(R) { const { rect, put, acc, torsoTop } = R; rect(11, torsoTop, 5, 1, acc.base); put(15, torsoTop + 1, acc.lo); },
    afterArms(R) { cuffs(R, R.acc); },
  },
  vneck: { // v-ringad t-shirt
    label: 'V-ringad', group: 'T-shirts & linnen', sleeve: 'short',
    front(R) { const { rect, put, skin, shirt, ty0, K } = R;
      rect(10, ty0, 4, 1, skin.base); put(10, ty0, skin.lo); put(13, ty0, skin.lo);
      rect(11, ty0 + 1, 2, 1, skin.lo);
      if (!K) { put(11, ty0 + 2, skin.lo); put(12, ty0 + 2, shirt.lo); put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo); } },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); },
    side(R) { const { put, skin, torsoTop } = R; put(14, torsoTop, skin.lo); put(15, torsoTop, skin.base); put(15, torsoTop + 1, skin.lo); },
  },
  raglan: { // baseballtröja: ärmar och axlar i detaljfärgen, snett sömmen mot halsen
    label: 'Baseball­tröja', group: 'T-shirts & linnen', sleeve: 'long',
    front(R) { raglanFB(R); teeNeck(R); R.put(10, R.ty0, R.acc.base); R.put(13, R.ty0, R.acc.lo); },
    back(R) { raglanFB(R); R.rect(10, R.ty0, 4, 1, R.acc.base); },
    side(R) { const { rect, put, acc, torsoTop } = R; rect(10, torsoTop, 5, 1, acc.base); put(15, torsoTop, acc.hi); put(10, torsoTop + 1, acc.lo); put(14, torsoTop + 1, acc.base); },
    afterArms(R) { sleevesIn(R, R.acc); },
  },
  tube: { // tubtopp: axlarna bara, resår överst
    label: 'Tub­topp', group: 'Toppar', sleeve: 'none',
    front(R) { tubeFB(R); if (!R.K) { R.put(10, R.ty0 + 1, R.skin.lo); R.put(13, R.ty0 + 1, R.skin.lo); } },
    back(R) { tubeFB(R); R.put(11, R.ty0 + 1, R.skin.lo); },
    side(R) { const { rect, put, skin, shirt, torsoTop, K } = R; const n = K ? 1 : 2;
      for (let j = 0; j < n; j++) { const y = torsoTop + j; rect(j ? 9 : 10, y, j ? 7 : 6, 1, skin.base); put(j ? 9 : 10, y, skin.lo); put(15, y, skin.hi); }
      rect(9, torsoTop + n, 7, 1, shirt.hi); put(9, torsoTop + n, shirt.base); },
  },
  offShoulder: { // off-shoulder: bara axlar, volang tvärs över bröst och överarmar
    label: 'Off-shoulder', group: 'Toppar', sleeve: 'short',
    front(R) { offFB(R); if (!R.K) R.put(11, R.ty0, R.skin.lo); },
    back(R) { offFB(R); },
    side(R) { const { rect, put, skin, shirt, torsoTop } = R; rect(10, torsoTop, 6, 1, skin.base); put(10, torsoTop, skin.lo); put(15, torsoTop, skin.hi);
      for (let x = 9; x < 16; x++) put(x, torsoTop + 1, x & 1 ? shirt.hi : shirt.lo); },
    afterArms(R) { const { ty0, skin, shirt } = R; const frill = lighter(shirt);
      R.pattern(TAG.sleeve, (x, y) => (y === ty0 ? skin : y === ty0 + 1 ? ((x & 1) ? frill : far(shirt)) : null)); },
  },

  // ---------------- Skjortor ----------------
  polo: { // piké: platt krage, knappslå, ribbade ärmkanter, litet märke
    label: 'Piké­tröja', group: 'Skjortor', sleeve: 'short',
    front(R) { const { put, rect, skin, shirt, acc, ty0, K } = R;
      rect(9, ty0, 6, 1, shirt.hi); rect(11, ty0, 2, 1, skin.lo);
      put(10, ty0 + 1, shirt.hi); put(13, ty0 + 1, shirt.hi); put(11, ty0 + 1, skin.lo); put(12, ty0 + 1, shirt.lo);
      if (K) put(12, ty0 + 2, acc.base);
      else { put(11, ty0 + 2, shirt.lo); put(12, ty0 + 2, acc.base); put(11, ty0 + 3, shirt.lo); put(12, ty0 + 3, acc.lo); put(14, ty0 + 3, acc.base); } },
    back(R) { const { rect, shirt, ty0 } = R; rect(9, ty0, 6, 1, shirt.hi); rect(10, ty0 + 1, 4, 1, shirt.lo); },
    side(R) { const { rect, put, shirt, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop + 1, shirt.hi); put(15, torsoTop + 1, shirt.lo); put(15, torsoTop + 2, acc.base); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  flannel: { // flanellskjorta: rutmönster i detaljfärgen, krage, knappar, bröstfickor
    label: 'Flanell­skjorta', group: 'Skjortor', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, ty0, ty1, K } = R;
      allOver(R, TAG.torso, plaid(R));
      rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.hi); put(12, ty0 + 1, shirt.hi);
      vline(R, 12, ty0 + 2, ty1 - 1, shirt.lo);
      for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, WHITE.lo);
      if (!K) { rect(8, ty0 + 2, 3, 1, shirt.dk); rect(14, ty0 + 2, 3, 1, shirt.dk); } },
    back(R) { allOver(R, TAG.torso, plaid(R)); R.rect(10, R.ty0, 4, 1, R.shirt.hi); },
    side(R) { allOver(R, TAG.torso, plaid(R)); const { rect, put, shirt, torsoTop } = R; rect(13, torsoTop, 3, 1, shirt.hi); put(15, torsoTop + 1, shirt.lo); },
    afterArms(R) { allOver(R, TAG.sleeve, plaid(R)); cuffs(R, far(R.shirt)); },
  },
  blouse: { // blus: rund krage i detaljfärgen, små knappar, puffärmar
    label: 'Blus', group: 'Skjortor', sleeve: 'short',
    front(R) { const { rect, put, skin, acc, ty0, ty1, K } = R;
      rect(9, ty0, 6, 1, acc.hi); rect(11, ty0, 2, 1, skin.lo);
      rect(9, ty0 + 1, 6, 1, acc.base); put(9, ty0 + 1, acc.lo); put(14, ty0 + 1, acc.lo); put(11, ty0 + 1, acc.lo);
      if (!K) for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, acc.base); },
    back(R) { const { rect, acc, ty0 } = R; rect(9, ty0, 6, 1, acc.base); rect(10, ty0 + 1, 4, 1, acc.lo); },
    side(R) { const { rect, put, acc, torsoTop } = R; rect(12, torsoTop, 4, 1, acc.hi); put(15, torsoTop + 1, acc.base); put(14, torsoTop + 1, acc.lo); },
    afterArms(R) { puff(R); },
  },
  oxford: { // långärmad skjorta: krage, knappslå, bröstficka och ljusa manschetter
    label: 'Lång­ärmad skjorta', group: 'Skjortor', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, ty0, ty1, K } = R;
      rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.hi); put(13, ty0 + 1, shirt.hi); put(12, ty0 + 1, shirt.dk);
      vline(R, 11, ty0 + 2, ty1 - 1, shirt.lo);
      for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, WHITE.base);
      if (!K) { put(14, ty0 + 3, shirt.lo); put(15, ty0 + 3, shirt.lo); put(14, ty0 + 4, shirt.lo); } },
    back(R) { const { rect, shirt, ty0, tw } = R; rect(10, ty0, 4, 1, shirt.hi); rect(13 - tw, ty0 + 2, tw * 2 - 3, 1, shirt.lo); },
    side(R) { const { rect, put, shirt, torsoTop } = R; rect(12, torsoTop, 4, 1, shirt.hi); put(15, torsoTop + 1, shirt.hi); put(15, torsoTop + 3, WHITE.base); },
    afterArms(R) { cuffs(R, lighter(R.shirt)); },
  },
  bowling: { // bowlingskjorta: två kontrastränder på framsidan, öppen krage, ok på ryggen
    label: 'Bowling­skjorta', group: 'Skjortor', sleeve: 'short',
    front(R) { const { rect, put, skin, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, 1, skin.lo); if (!K) put(11, ty0 + 1, skin.lo);
      put(10, ty0, acc.hi); put(13, ty0, acc.hi); put(10, ty0 + 1, acc.base); put(13, ty0 + 1, acc.lo); if (!K) put(12, ty0 + 1, acc.lo);
      vline(R, 9, ty0 + 1, ty1 - 1, acc.base); vline(R, 14, ty0 + 1, ty1 - 1, acc.lo);
      if (!K) { put(12, ty0 + 3, WHITE.base); put(12, ty0 + 5, WHITE.base); } },
    back(R) { const { rect, acc, ty0 } = R; const a = xl(R), b = xr(R); rect(a + 1, ty0, b - a - 1, 1, acc.base); rect(a, ty0 + 1, b - a + 1, 1, acc.lo); },
    side(R) { const { rect, put, acc, torsoTop, ty1 } = R; rect(12, torsoTop, 4, 1, acc.hi); vline(R, 15, torsoTop + 1, ty1 - 1, acc.base); put(10, torsoTop + 1, acc.lo); put(9, torsoTop + 1, acc.lo); },
    afterArms(R) { cuffs(R, R.acc); },
  },
  western: { // westernskjorta: spetsigt ok i detaljfärgen, pärlknappar
    label: 'Western­skjorta', group: 'Skjortor', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      rect(a + 1, ty0, b - a - 1, 1, acc.base); rect(a, ty0 + 1, b - a + 1, 1, acc.base); put(a, ty0 + 1, acc.hi); put(b, ty0 + 1, acc.lo);
      put(9, ty0 + 2, acc.base); put(14, ty0 + 2, acc.lo);
      rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.base); put(13, ty0 + 1, shirt.lo); put(12, ty0 + 1, shirt.lo);
      for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, WHITE.hi);
      if (!K) { put(9, ty0 + 4, WHITE.base); put(14, ty0 + 4, WHITE.base); } },
    back(R) { const { rect, acc, ty0 } = R; const a = xl(R), b = xr(R); rect(a + 1, ty0, b - a - 1, 1, acc.base); rect(a, ty0 + 1, b - a + 1, 1, acc.base); rect(11, ty0 + 2, 2, 1, acc.lo); },
    side(R) { const { rect, put, shirt, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, acc.base); rect(9, torsoTop + 1, 2, 1, acc.lo); rect(14, torsoTop + 1, 2, 1, acc.base); put(14, torsoTop, shirt.hi); put(15, torsoTop + 3, WHITE.hi); },
    afterArms(R) { cuffs(R, R.acc); },
  },
  tunic: { // tunika: lång ner över höfterna, broderad halsslits och fåll
    label: 'Tunika', group: 'Skjortor', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 3, 1, { slit: false }); },
    front(R) { const { put, skin, acc, ty0, K } = R;
      put(11, ty0, skin.lo); put(12, ty0, skin.lo); put(11, ty0 + 1, skin.lo);
      put(10, ty0, acc.base); put(13, ty0, acc.lo); put(10, ty0 + 1, acc.base); put(12, ty0 + 1, acc.base);
      if (!K) { put(11, ty0 + 2, acc.lo); put(9, ty0 + 1, acc.lo); put(14, ty0 + 1, acc.lo); }
      tunicHem(R); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.acc.base); tunicHem(R); },
    side(R) { const { put, acc, torsoTop } = R; put(14, torsoTop, acc.base); put(15, torsoTop, acc.lo); put(15, torsoTop + 1, acc.base); tunicHem(R); },
    afterArms(R) { cuffs(R, R.acc); },
  },

  // ---------------- Västar ----------------
  waistcoat: { // kostymväst över vit skjorta: v-ringning, knappar, paspelfickor
    label: 'Kostym­väst', group: 'Västar', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      put(a + 1, ty0, WHITE.hi); put(b - 1, ty0, WHITE.lo);
      rect(10, ty0, 4, 1, WHITE.hi); rect(11, ty0 + 1, 2, K ? 1 : 2, WHITE.base);
      put(12, ty0 + 1, acc.base); if (!K) put(12, ty0 + 2, acc.lo);
      put(10, ty0 + 1, shirt.hi); put(13, ty0 + 1, shirt.lo);
      vline(R, 12, ty0 + (K ? 2 : 3), ty1, shirt.dk);
      for (let y = ty0 + (K ? 3 : 4); y < ty1; y += 2) put(11, y, acc.hi);
      if (!K) { rect(8, ty0 + 5, 2, 1, shirt.dk); rect(14, ty0 + 5, 2, 1, shirt.dk); }
      put(11, ty1 - 1, shirt.base); },
    back(R) { const { rect, put, shirt, ty0, ty1 } = R; const a = xl(R), b = xr(R);
      put(a + 1, ty0, WHITE.hi); put(b - 1, ty0, WHITE.lo); rect(10, ty0, 4, 1, WHITE.base);
      rect(a + 1, ty0 + 1, b - a - 1, ty1 - ty0 - 2, shirt.lo); rect(a + 1, ty0 + 1, 1, ty1 - ty0 - 2, shirt.base);
      rect(10, ty1 - 3, 4, 1, shirt.dk); put(11, ty1 - 3, METAL.base); },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(13, torsoTop, 3, 1, WHITE.hi); put(15, torsoTop + 1, WHITE.base); vline(R, 15, torsoTop + 2, ty1, shirt.lo); put(10, torsoTop, WHITE.lo); },
    afterArms(R) { sleevesIn(R, WHITE); cuffs(R, far(WHITE)); },
  },
  slipover: { // stickad väst över skjorta (ärmarna i detaljfärgen)
    label: 'Slip­over', group: 'Västar', sleeve: 'long',
    front(R) { vNeckCollar(R); const { put, acc, ty0 } = R; put(xl(R) + 1, ty0, acc.hi); put(xr(R) - 1, ty0, acc.lo); put(xl(R), ty0 + 1, acc.hi); put(xr(R), ty0 + 1, acc.lo); ribHem(R); },
    back(R) { const { rect, put, acc, shirt, ty0 } = R; rect(10, ty0, 4, 1, acc.base); put(11, ty0, shirt.lo); put(12, ty0, shirt.lo); put(xl(R) + 1, ty0, acc.hi); put(xr(R) - 1, ty0, acc.lo); ribHem(R); },
    side(R) { const { put, acc, torsoTop } = R; put(14, torsoTop, acc.hi); put(15, torsoTop, acc.base); put(15, torsoTop + 1, acc.lo); put(10, torsoTop, acc.lo); ribHem(R); },
    afterArms(R) { sleevesIn(R, R.acc); cuffs(R, far(R.acc)); },
  },

  // ---------------- Tröjor ----------------
  college: { // collegetröja: ribbad rund hals, mudd och fåll
    label: 'College­tröja', group: 'Tröjor', sleeve: 'long',
    front(R) { teeNeck(R); crewRib(R); ribHem(R); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); ribHem(R); },
    side(R) { const { rect, put, shirt, torsoTop } = R; rect(12, torsoTop, 4, 1, shirt.lo); put(15, torsoTop + 1, shirt.lo); ribHem(R); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  vsweater: { // v-ringad stickad tröja med skjortkrage under
    label: 'V-tröja', group: 'Tröjor', sleeve: 'long',
    front(R) { vNeckCollar(R); ribHem(R); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); ribHem(R); },
    side(R) { const { put, acc, shirt, torsoTop } = R; put(14, torsoTop, acc.hi); put(15, torsoTop, acc.base); put(15, torsoTop + 1, shirt.lo); ribHem(R); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  cardigan: { // kofta: öppen fram med tröja under (detaljfärgen), knappkant, fickor
    label: 'Kofta', group: 'Tröjor', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, ty1 - ty0, acc.base); put(11, ty0 + 1, acc.hi); rect(11, ty0, 2, 1, skin.lo);
      put(10, ty0, acc.base); put(13, ty0, acc.lo);
      vline(R, 10, ty0 + 1, ty1, shirt.lo); vline(R, 13, ty0 + 1, ty1, shirt.lo);
      for (let y = ty0 + 2; y < ty1 - 1; y += 2) put(10, y, shirt.hi);
      if (!K) { rect(8, ty1 - 3, 2, 1, shirt.dk); rect(14, ty1 - 3, 2, 1, shirt.dk); }
      ribHem(R, true); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); ribHem(R); },
    side(R) { const { put, acc, shirt, torsoTop, ty1 } = R; vline(R, 15, torsoTop, ty1, acc.base); vline(R, 14, torsoTop + 1, ty1, shirt.lo); put(14, torsoTop, acc.lo); ribHem(R); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  turtleneck: { // polotröja (stickad polo): hög vikt krage som går upp mot hakan
    label: 'Polo­tröja', group: 'Tröjor', sleeve: 'long',
    front(R) { turtleFB(R); R.rect(10, R.ty0 + 1, 4, 1, R.shirt.lo); ribHem(R); },
    back(R) { turtleFB(R); ribHem(R); },
    side(R) { const { rect, put, shirt, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.base); put(10, torsoTop, shirt.lo); put(15, torsoTop, shirt.hi); put(9, torsoTop - 1, shirt.lo); put(9, torsoTop, shirt.lo); rect(11, torsoTop + 1, 5, 1, shirt.lo); ribHem(R); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  cable: { // flätstickad tröja: två flätor och en mittfläta
    label: 'Flät­stickad', group: 'Tröjor', sleeve: 'long',
    front(R) { teeNeck(R); crewRib(R); cables(R, true); ribHem(R); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); cables(R, false); ribHem(R); },
    side(R) { const { put, shirt, torsoTop, ty1 } = R; for (let y = torsoTop + 1; y < ty1 - 1; y++) { const k = (y - torsoTop) % 4 < 2; put(14, y, k ? shirt.lo : shirt.hi); put(15, y, k ? shirt.hi : shirt.lo); } R.rect(12, torsoTop, 4, 1, shirt.lo); ribHem(R); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  nordic: { // islandströja: mönstrat ok runt halsen, band på ärmarna och nedtill
    label: 'Island­ströja', group: 'Tröjor', sleeve: 'long',
    front(R) { nordicYoke(R); R.rect(11, R.ty0, 2, 1, R.skin.lo); },
    back(R) { nordicYoke(R); R.rect(11, R.ty0, 2, 1, R.acc.lo); },
    side(R) { const { put, acc, torsoTop, ty1 } = R;
      for (let x = 10; x < 16; x++) { if (!(x & 1)) put(x, torsoTop, acc.base); put(x, torsoTop + 1, acc.base); if (x & 1) put(x, torsoTop + 2, acc.lo); }
      put(9, torsoTop + 1, acc.lo); for (let x = 9; x < 16; x += 2) put(x, ty1 - 2, acc.base); },
    afterArms(R) { const { ty0, acc } = R; R.pattern(TAG.sleeve, (x, y, k) => (!onShirt(R, k) ? null : y === ty0 + 1 || y === ty0 || (y === ty0 + 2 && (x & 1)) ? acc : null)); cuffs(R, R.acc); },
  },
  zipHoodie: { // huvtröja med dragkedja, snören och sneda fickor
    label: 'Zip-hoodie', group: 'Tröjor', sleeve: 'long',
    front(R) { const { rect, put, shirt, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      rect(a + 1, ty0, b - a - 1, 1, shirt.lo); put(10, ty0, shirt.hi); put(13, ty0, shirt.hi);
      vline(R, 12, ty0 + 1, ty1, METAL.base); put(12, ty0 + 1, METAL.hi); put(11, ty0 + 1, shirt.lo);
      put(10, ty0 + 1, WHITE.base); put(10, ty0 + 2, WHITE.lo); put(13, ty0 + 1, WHITE.base); if (!K) put(13, ty0 + 3, WHITE.lo);
      if (!K) { put(a + 2, ty1 - 3, shirt.dk); put(a + 1, ty1 - 2, shirt.dk); put(b - 2, ty1 - 3, shirt.dk); put(b - 1, ty1 - 2, shirt.dk); }
      ribHem(R); },
    back(R) { const { rect, put, shirt, ty0, K } = R;
      rect(9, ty0, 6, K ? 2 : 3, shirt.lo); rect(10, ty0, 4, K ? 1 : 2, shirt.base); put(10, ty0, shirt.hi); ribHem(R); },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(8, torsoTop, 3, 3, shirt.lo); put(9, torsoTop, shirt.base); vline(R, 15, torsoTop + 1, ty1, METAL.base); put(15, torsoTop, shirt.lo); ribHem(R); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  fleece: { // fleecetröja med halvlång dragkedja, ståkrage och kontrastkanter
    label: 'Fleece­tröja', group: 'Tröjor', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, K } = R; const a = xl(R), b = xr(R);
      standCollar(R);
      vline(R, 12, ty0, ty0 + (K ? 2 : 4), METAL.base); put(12, ty0 + (K ? 2 : 4), METAL.hi);
      put(a + 1, ty0, acc.hi); put(b - 1, ty0, acc.lo); put(a, ty0 + 1, acc.hi); put(b, ty0 + 1, acc.lo);
      if (!K) { rect(14, ty0 + 4, 2, 1, shirt.dk); put(15, ty0 + 4, METAL.lo); }
      hemIn(R, acc); },
    back(R) { const { put, acc, ty0 } = R; standCollar(R); put(xl(R) + 1, ty0, acc.hi); put(xr(R) - 1, ty0, acc.lo); hemIn(R, acc); },
    side(R) { const { rect, put, shirt, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop - 1, shirt.hi); put(9, torsoTop, shirt.base); vline(R, 15, torsoTop, torsoTop + 3, METAL.base); put(11, torsoTop, acc.base); hemIn(R, acc); },
    afterArms(R) { cuffs(R, R.acc); },
  },

  // ---------------- Jackor & kavajer ----------------
  blazer: { // blazer: slag, tröja under i detaljfärgen, bröstnäsduk, lockfickor
    label: 'Blazer', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      const v = K ? 2 : 3;
      rect(11, ty0, 2, v, acc.base); rect(11, ty0, 2, 1, skin.lo);
      vline(R, 10, ty0, ty0 + v, shirt.hi); vline(R, 13, ty0, ty0 + v, shirt.hi); put(13, ty0 + v - 1, shirt.base);
      vline(R, 12, ty0 + v, ty1, shirt.lo); put(11, ty0 + v, shirt.hi);
      put(11, ty0 + v + 1, shirt.dk); if (!K) put(11, ty0 + v + 3, shirt.dk);
      if (!K) { put(14, ty0 + 3, WHITE.hi); put(15, ty0 + 3, shirt.lo); rect(8, ty1 - 3, 2, 1, shirt.dk); rect(14, ty1 - 3, 2, 1, shirt.dk); } },
    back(R) { const { rect, shirt, ty0, ty1 } = R; rect(10, ty0, 4, 1, shirt.lo); vline(R, 11, ty0 + 2, ty1, shirt.lo); put2(R, 11, ty1 - 2, shirt.dk); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1 } = R; rect(14, torsoTop, 2, 3, shirt.hi); put(15, torsoTop, acc.base); put(15, torsoTop + 1, acc.lo); rect(14, ty1 - 3, 2, 1, shirt.dk); },
  },
  bomber: { // bomberjacka: ribbstickad krage, mudd och fåll i detaljfärgen, dragkedja
    label: 'Bomber­jacka', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, skin, acc, ty0, ty1, K } = R;
      rect(9, ty0, 6, 1, acc.base); rect(11, ty0, 2, 1, skin.lo); put(9, ty0, acc.hi); put(14, ty0, acc.lo);
      vline(R, 12, ty0 + 1, ty1 - (K ? 1 : 2), METAL.base); put(12, ty0 + 1, METAL.hi);
      bandHem(R, acc, K ? 1 : 2); },
    back(R) { const { rect, acc, ty0, K } = R; rect(9, ty0, 6, 1, acc.base); bandHem(R, acc, K ? 1 : 2); },
    side(R) { const { rect, put, acc, torsoTop, ty1, K } = R; rect(10, torsoTop, 6, 1, acc.base); put(15, torsoTop, acc.hi); vline(R, 15, torsoTop + 1, ty1 - 2, METAL.base); bandHem(R, acc, K ? 1 : 2); },
    afterArms(R) { cuffs(R, R.acc); if (!R.side && !R.eat && !R.carry && !R.K) { R.put(xl(R) - 2, R.ty0 + 2, METAL.base); R.put(xl(R) - 1, R.ty0 + 2, METAL.lo); } },
  },
  denim: { // jeansjacka: krage, bröstfickor med lock, kontrastsömmar, midjeband
    label: 'Jeans­jacka', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, 1, skin.lo); rect(11, ty0 + 1, 2, 1, acc.base);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.hi); put(13, ty0 + 1, shirt.hi);
      vline(R, 12, ty0 + 2, ty1, shirt.lo);
      for (let y = ty0 + 3; y < ty1; y += 3) put(11, y, GOLD.lo);
      if (!K) { rect(8, ty0 + 2, 3, 1, shirt.lo); rect(13, ty0 + 2, 3, 1, shirt.lo); put(9, ty0 + 3, GOLD.lo); put(14, ty0 + 3, GOLD.lo);
        vline(R, 9, ty0 + 4, ty1 - 2, shirt.hi); vline(R, 14, ty0 + 4, ty1 - 2, shirt.hi); }
      rect(xl(R), ty1 - 2, xr(R) - xl(R) + 1, 1, shirt.hi); },
    back(R) { const { rect, shirt, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      rect(10, ty0, 4, 1, shirt.hi); rect(a, ty0 + 2, b - a + 1, 1, shirt.hi); rect(a, ty1 - 2, b - a + 1, 1, shirt.hi);
      if (!K) { vline(R, 9, ty0 + 3, ty1 - 2, shirt.lo); vline(R, 14, ty0 + 3, ty1 - 2, shirt.lo); } },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(13, torsoTop, 3, 1, shirt.hi); put(15, torsoTop + 1, shirt.hi); rect(14, torsoTop + 2, 2, 1, shirt.lo); put(14, torsoTop + 3, GOLD.lo); rect(9, ty1 - 2, 7, 1, shirt.hi); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  leather: { // skinnjacka (MC): breda slag, sned dragkedja, bälte, blank axel
    label: 'Skinn­jacka', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R; const a = xl(R);
      rect(11, ty0, 2, 2, acc.base); rect(11, ty0, 2, 1, skin.lo);
      rect(9, ty0, 2, 2, shirt.hi); rect(13, ty0, 2, 2, shirt.hi); put(10, ty0 + 2, shirt.hi); put(13, ty0 + 2, shirt.hi); put(14, ty0 + 1, shirt.base);
      if (K) vline(R, 12, ty0 + 2, ty1 - 1, METAL.base);
      else { put(13, ty0 + 3, METAL.hi); put(12, ty0 + 4, METAL.base); vline(R, 11, ty0 + 5, ty1 - 1, METAL.base); put(14, ty0 + 5, METAL.lo); put(15, ty0 + 6, METAL.lo); }
      put(a + 1, ty0 + 1, shirt.hi); put(a + 1, ty0 + 2, shirt.hi);
      if (!K) { rect(a, ty1 - 2, xr(R) - a + 1, 1, shirt.dk); put(a + 2, ty1 - 2, METAL.base); } },
    back(R) { const { rect, put, shirt, ty0, ty1, K } = R; const a = xl(R); rect(10, ty0, 4, 1, shirt.hi); rect(a, ty0 + 2, xr(R) - a + 1, 1, shirt.lo); put(a + 1, ty0 + 1, shirt.hi); if (!K) rect(a, ty1 - 2, xr(R) - a + 1, 1, shirt.dk); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1, K } = R; rect(13, torsoTop, 3, 2, shirt.hi); put(15, torsoTop, acc.base); vline(R, 15, torsoTop + 2, ty1 - 1, METAL.base); if (!K) { rect(9, ty1 - 2, 7, 1, shirt.dk); put(15, ty1 - 2, METAL.base); } },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  puffer: { // dunjacka: vadderade band, hög krage, dragkedja
    label: 'Dun­jacka', group: 'Jackor & kavajer', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 1, 0); },
    front(R) { quilt(R); standCollar(R); vline(R, 12, R.ty0 + 1, R.ty1 + (R.K ? 0 : hemRows(R, 1)), R.shirt.dk); },
    back(R) { quilt(R); standCollar(R); },
    side(R) { quilt(R); const { rect, put, shirt, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop - 1, shirt.hi); put(9, torsoTop, shirt.base); vline(R, 15, torsoTop + 1, R.ty1, shirt.dk); },
    afterArms(R) { const { ty0, shirt } = R; allOver(R, TAG.sleeve, (x, y) => ((y - ty0) % 3 === 2 ? far(shirt) : null)); cuffs(R, far(far(shirt))); },
  },
  parka: { // parkas: pälskantad luva, knäppning, stora fickor, lång
    label: 'Parkas', group: 'Rockar & kappor', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 3, 1); },
    front(R) { const { rect, put, shirt, ty0, ty1, hy, K } = R;
      furRow(R, 8, 15, ty0); put(8, ty0 - 1, FUR.lo); put(15, ty0 - 1, FUR.lo);
      vline(R, 12, ty0 + 1, ty1, shirt.lo); for (let y = ty0 + 2; y < ty1; y += 2) put(11, y, METAL.lo);
      if (!K) { rect(8, ty1 - 3, 2, 1, shirt.dk); rect(14, ty1 - 3, 2, 1, shirt.dk); if (hemRows(R, 3) >= 2) { rect(8, hy, 2, 1, shirt.dk); rect(14, hy, 2, 1, shirt.dk); } }
      rect(xl(R) + 1, ty1 - 1, xr(R) - xl(R) - 1, 1, shirt.lo); put(11, ty1, WHITE.lo); },
    back(R) { const { rect, shirt, ty0, K } = R; rect(9, ty0 + 1, 6, K ? 2 : 3, shirt.lo); rect(10, ty0 + 1, 4, K ? 1 : 2, shirt.base); furRow(R, 8, 15, ty0); R.put(8, ty0 - 1, FUR.lo); R.put(15, ty0 - 1, FUR.lo); },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(8, torsoTop, 2, 3, shirt.lo); put(9, torsoTop, shirt.base); furRow(R, 8, 10, torsoTop - 1); vline(R, 15, torsoTop + 1, ty1, shirt.lo); put(14, torsoTop, FUR.base); put(15, torsoTop, FUR.hi); },
  },
  trench: { // trenchcoat: dubbelknäppt, skärp, axelklaffar, till knäna
    label: 'Trench­coat', group: 'Rockar & kappor', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 6, 3, { flare: 1 }); },
    front(R) { const { rect, put, shirt, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      rect(11, ty0, 2, 2, acc.base); put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); rect(9, ty0 + 1, 2, 1, shirt.hi); rect(13, ty0 + 1, 2, 1, shirt.hi); put(11, ty0 + 2, shirt.hi); put(12, ty0 + 2, shirt.hi);
      put(a + 1, ty0, shirt.lo); put(b - 1, ty0, shirt.dk);
      vline(R, 12, ty0 + 3, ty1 - 1, shirt.lo);
      if (!K) { put(10, ty0 + 3, shirt.dk); put(14, ty0 + 3, shirt.dk); put(10, ty0 + 5, shirt.dk); put(14, ty0 + 5, shirt.dk); }
      rect(a, ty1 - 1, b - a + 1, 1, shirt.lo); put(a, ty1 - 1, shirt.base); rect(11, ty1 - 1, 2, 1, METAL.lo); if (!K) put(10, ty1, shirt.lo); },
    back(R) { const { rect, shirt, ty0, ty1 } = R; const a = xl(R), b = xr(R); rect(10, ty0, 4, 1, shirt.hi); rect(a, ty0 + 2, b - a + 1, 1, shirt.lo); put2(R, a + 1, ty0, shirt.lo); rect(a, ty1 - 1, b - a + 1, 1, shirt.lo); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1, K } = R; rect(13, torsoTop, 3, 1, shirt.hi); put(15, torsoTop, acc.base); put(15, torsoTop + 1, shirt.hi); if (!K) { put(15, torsoTop + 3, shirt.dk); put(15, torsoTop + 5, shirt.dk); } rect(9, ty1 - 1, 7, 1, shirt.lo); put(15, ty1 - 1, METAL.lo); put(12, torsoTop, shirt.lo); },
  },
  coat: { // rock/kappa: enkelknäppt med slag, halvlång
    label: 'Rock', group: 'Rockar & kappor', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 4, 2); },
    front(R) { const { rect, put, shirt, acc, ty0, ty1, hy, K } = R;
      rect(11, ty0, 2, 2, acc.base); put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.hi); put(13, ty0 + 1, shirt.hi); put(11, ty0 + 2, shirt.hi);
      vline(R, 12, ty0 + 2, ty1, shirt.lo);
      for (let y = ty0 + 3; y < ty1; y += K ? 2 : 3) put(11, y, shirt.dk);
      if (!K && hemRows(R, 4) >= 3) { rect(8, hy + 1, 2, 1, shirt.dk); rect(14, hy + 1, 2, 1, shirt.dk); } },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.hi); },
    side(R) { const { rect, put, shirt, acc, torsoTop } = R; rect(14, torsoTop, 2, 2, shirt.hi); put(15, torsoTop, acc.base); put(15, torsoTop + 3, shirt.dk); put(15, torsoTop + 6, shirt.dk); },
  },
  windbreaker: { // vindjacka i 90-talsstil: färgblock över bröst och ärmar, halv dragkedja
    label: 'Vind­jacka', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { windBand(R); const { rect, put, shirt, ty0 } = R; rect(9, ty0, 6, 1, shirt.hi); vline(R, 12, ty0, ty0 + 2, METAL.base); put(12, ty0 + 1, METAL.hi); hemIn(R, far(shirt)); },
    back(R) { windBand(R); R.rect(9, R.ty0, 6, 1, R.shirt.hi); hemIn(R, far(R.shirt)); },
    side(R) { windBand(R); const { rect, shirt, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.hi); R.put(15, torsoTop + 1, METAL.base); hemIn(R, far(shirt)); },
    afterArms(R) { const { ty0, acc, K } = R; const y = ty0 + (K ? 1 : 2); R.pattern(TAG.sleeve, (x, yy, k) => (!onShirt(R, k) ? null : yy === y ? acc : yy === y + 1 ? WHITE : null)); cuffs(R, far(R.shirt)); },
  },
  varsity: { // collegejacka: ärmar i detaljfärgen, randig ribbkrage och fåll, tryckknappar
    label: 'College­jacka', group: 'Jackor & kavajer', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1 } = R;
      rect(9, ty0, 6, 1, shirt.dk); put(9, ty0, acc.base); put(14, ty0, acc.lo); rect(11, ty0, 2, 1, skin.lo);
      vline(R, 12, ty0 + 1, ty1, shirt.lo); for (let y = ty0 + 1; y < ty1 - 1; y += 2) put(11, y, WHITE.hi);
      varsityHem(R); },
    back(R) { const { rect, put, shirt, acc, ty0 } = R; rect(9, ty0, 6, 1, shirt.dk); put(10, ty0, acc.base); put(13, ty0, acc.base); varsityHem(R); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1 } = R; rect(10, torsoTop, 6, 1, shirt.dk); put(12, torsoTop, acc.base); vline(R, 15, torsoTop + 1, ty1, shirt.lo); put(15, torsoTop + 2, WHITE.hi); varsityHem(R); },
    afterArms(R) { sleevesIn(R, R.acc); cuffs(R, far(far(R.shirt))); },
  },
  track: { // träningsjacka: ståkrage, hel dragkedja, ränder längs ärmarna
    label: 'Tränings­jacka', group: 'Sport', sleeve: 'long',
    front(R) { const { put, acc, ty0, ty1 } = R; standCollar(R); vline(R, 12, ty0, ty1, METAL.base); put(12, ty0 + 1, METAL.hi); put(xl(R) + 1, ty0, acc.base); put(xr(R) - 1, ty0, acc.lo); hemIn(R, far(R.shirt)); },
    back(R) { const { put, acc, ty0 } = R; standCollar(R); put(xl(R) + 1, ty0, acc.base); put(xr(R) - 1, ty0, acc.lo); hemIn(R, far(R.shirt)); },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop - 1, shirt.hi); vline(R, 15, torsoTop, ty1, METAL.base); rect(11, torsoTop, 3, 1, R.acc.base); hemIn(R, far(shirt)); },
    afterArms(R) { armStripe(R, R.acc); cuffs(R, far(R.shirt)); },
  },
  downVest: { // dunväst över långärmad tröja (ärmarna i detaljfärgen)
    label: 'Dun­väst', group: 'Västar', sleeve: 'long',
    front(R) { quilt(R); standCollar(R); const { put, acc, ty0, ty1 } = R; vline(R, 12, ty0 + 1, ty1, R.shirt.dk); put(xl(R) + 1, ty0, acc.hi); put(xr(R) - 1, ty0, acc.lo); put(xl(R), ty0 + 1, acc.hi); put(xr(R), ty0 + 1, acc.lo); },
    back(R) { quilt(R); standCollar(R); const { put, acc, ty0 } = R; put(xl(R) + 1, ty0, acc.hi); put(xr(R) - 1, ty0, acc.lo); put(xl(R), ty0 + 1, acc.hi); put(xr(R), ty0 + 1, acc.lo); },
    side(R) { quilt(R); const { rect, put, shirt, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop - 1, shirt.hi); put(11, torsoTop, acc.base); put(12, torsoTop, acc.lo); vline(R, 15, torsoTop + 1, R.ty1, shirt.dk); },
    afterArms(R) { sleevesIn(R, R.acc); cuffs(R, far(R.acc)); },
  },
  hiVis: { // varselväst med reflexband över t-shirt (ärmarna i detaljfärgen)
    label: 'Varsel­väst', group: 'Uniformer & yrken', sleeve: 'short',
    front(R) { hiVisFB(R); const { rect, put, skin, acc, ty0, ty1 } = R; rect(11, ty0, 2, 1, skin.lo); put(10, ty0, acc.base); put(13, ty0, acc.lo); vline(R, 12, ty0 + 1, ty1, R.shirt.lo); },
    back(R) { hiVisFB(R); R.rect(10, R.ty0, 4, 1, R.acc.base); },
    side(R) { const { rect, put, acc, torsoTop, ty1, K } = R; rect(10, torsoTop, 5, 1, acc.base); for (const y of K ? [ty1 - 2] : [torsoTop + 3, ty1 - 3]) { rect(9, y, 7, 1, REFLEX.base); put(15, y, REFLEX.hi); } },
    afterArms(R) { sleevesIn(R, R.acc); },
  },

  // ---------------- Sport ----------------
  football: { // fotbollströja: v-krage och ärmkanter i detaljfärgen, klubbmärke
    label: 'Fotbolls­tröja', group: 'Sport', sleeve: 'short',
    front(R) { const { put, skin, acc, ty0, K } = R;
      put(10, ty0, acc.base); put(13, ty0, acc.lo); put(11, ty0, skin.lo); put(12, ty0, skin.lo);
      put(11, ty0 + 1, acc.base); put(12, ty0 + 1, acc.lo);
      if (!K) { put(14, ty0 + 2, acc.hi); put(15, ty0 + 2, acc.base); put(14, ty0 + 3, acc.base); put(15, ty0 + 3, acc.lo); } },
    back(R) { R.rect(10, R.ty0, 4, 1, R.acc.base); },
    side(R) { const { rect, put, skin, acc, torsoTop } = R; rect(12, torsoTop, 3, 1, acc.base); put(15, torsoTop, skin.lo); put(15, torsoTop + 1, acc.lo); },
    afterArms(R) { cuffs(R, R.acc); },
  },
  basket: { // basketlinne: breda axelband, djupa ärmhål med kant, sidoränder
    label: 'Basket­linne', group: 'Sport', sleeve: 'none',
    front(R) { basketFB(R, true); },
    back(R) { basketFB(R, false); },
    side(R) { const { rect, put, skin, shirt, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, skin.base); put(10, torsoTop, skin.lo); rect(12, torsoTop, 2, 1, shirt.base); put(14, torsoTop, acc.base); put(15, torsoTop, skin.hi); put(15, torsoTop + 1, acc.lo); put(11, torsoTop, acc.lo); },
  },
  hockey: { // hockeytröja: axelok, ränder nedtill och på ärmarna, snörad krage
    label: 'Hockey­tröja', group: 'Sport', sleeve: 'long',
    front(R) { hockeyFB(R); const { put, skin, ty0, K } = R; put(11, ty0, skin.lo); put(12, ty0, skin.lo); if (!K) { put(11, ty0 + 1, skin.lo); put(12, ty0 + 1, WHITE.base); } },
    back(R) { hockeyFB(R); },
    side(R) { const { rect, acc, torsoTop, ty1, K } = R; rect(10, torsoTop, 6, 2, acc.base); R.put(15, torsoTop, acc.hi); rect(9, ty1 - 3, 7, 1, acc.base); if (!K) rect(9, ty1 - 2, 7, 1, WHITE.base); },
    afterArms(R) { const { ty0, acc } = R; R.pattern(TAG.sleeve, (x, y, k) => (!onShirt(R, k) ? null : y <= ty0 + 1 ? acc : R.tagAt(x, y + 2) === TAG.skin ? acc : R.tagAt(x, y + 3) === TAG.skin ? WHITE : null)); },
  },

  // ---------------- Uniformer & yrken ----------------
  chef: { // kockrock: dubbelknäppt, ståkrage, uppvikta ärmar
    label: 'Kock­rock', group: 'Uniformer & yrken', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, ty1, K } = R;
      rect(9, ty0, 6, 1, shirt.hi); put(14, ty0, shirt.base); put(11, ty0, shirt.lo);
      put(12, ty0 + 1, shirt.lo); vline(R, 13, ty0 + 2, ty1, shirt.lo);
      for (let y = ty0 + 2; y < ty1 - 1; y += 2) { put(9, y, acc.base); put(14, y, acc.lo); }
      if (!K) { put(10, ty0 + 2, METAL.hi); put(10, ty0 + 3, METAL.lo); } },
    back(R) { const { rect, shirt, ty0 } = R; rect(9, ty0, 6, 1, shirt.hi); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1 } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop - 1, shirt.hi); for (let y = torsoTop + 2; y < ty1 - 1; y += 2) put(15, y, acc.base); },
    afterArms(R) { cuffs(R, lighter(R.shirt)); },
  },
  nurse: { // sjukhustunika: v-ringning, bröstficka med pennor, namnbricka, kort fåll
    label: 'Sjukhus­tunika', group: 'Uniformer & yrken', sleeve: 'short',
    beforeTorso(R) { coatHem(R, 1, 0, { slit: false }); },
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      rect(10, ty0, 4, 1, skin.base); put(10, ty0, skin.lo); put(13, ty0, skin.lo); rect(11, ty0 + 1, 2, 1, skin.lo);
      if (!K) { put(11, ty0 + 2, skin.lo); put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo); put(12, ty0 + 2, shirt.lo); }
      const py = ty0 + (K ? 2 : 3);
      put(14, py - 1, acc.base); put(15, py - 1, 0xc9323a); rect(13, py, 3, 1, shirt.lo);
      put(9, py, WHITE.hi); put(10, py, acc.base);
      if (!K) { rect(8, ty1 - 2, 2, 1, shirt.lo); rect(14, ty1 - 2, 2, 1, shirt.lo); } },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); },
    side(R) { const { put, skin, shirt, acc, torsoTop, K } = R; put(14, torsoTop, skin.lo); put(15, torsoTop, skin.base); put(15, torsoTop + 1, skin.lo); const py = torsoTop + (K ? 2 : 3); put(15, py - 1, acc.base); put(14, py - 1, 0xc9323a); put(14, py, shirt.lo); put(15, py, shirt.lo); },
  },
  police: { // polisuniform: axelklaffar, slips, bröstfickor, bricka, reflextext på ryggen
    label: 'Polis­uniform', group: 'Uniformer & yrken', sleeve: 'long',
    front(R) { const { rect, put, shirt, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(11, ty0, INK.hi); put(12, ty0, INK.base);
      vline(R, 12, ty0 + 1, ty0 + (K ? 3 : 5), INK.base); put(11, ty0 + 1, shirt.lo);
      put(a + 1, ty0, shirt.dk); put(b - 1, ty0, shirt.dk);
      if (!K) { rect(8, ty0 + 3, 3, 1, shirt.dk); rect(13, ty0 + 3, 3, 1, shirt.dk); put(14, ty0 + 2, GOLD.hi); put(15, ty0 + 2, GOLD.lo); put(9, ty0 + 2, INK.base); put(9, ty0 + 1, INK.lo);
        rect(a, ty1 - 1, b - a + 1, 1, INK.base); put(11, ty1 - 1, METAL.base); }
      else put(14, ty0 + 2, GOLD.hi); },
    back(R) { const { rect, put, shirt, ty0, ty1, K } = R; const a = xl(R), b = xr(R); const y = ty0 + (K ? 1 : 2);
      rect(10, ty0, 4, 1, shirt.hi); put(a + 1, ty0, shirt.dk); put(b - 1, ty0, shirt.dk);
      rect(a + 1, y, b - a - 1, 2, NEON.base); for (let x = a + 2; x < b - 1; x++) if (x % 3 !== 1) put(x, y + (x & 1), INK.lo);
      if (!K) rect(a, ty1 - 1, b - a + 1, 1, INK.base); },
    side(R) { const { put, shirt, torsoTop, ty1, K } = R; put(13, torsoTop, shirt.dk); put(14, torsoTop, shirt.hi); put(15, torsoTop, INK.base); vline(R, 15, torsoTop + 1, torsoTop + 4, INK.base); put(14, torsoTop + 2, GOLD.hi); if (!K) R.rect(9, ty1 - 1, 7, 1, INK.base); },
    afterArms(R) { if (!R.side && !R.eat && !R.carry && !R.K) { R.put(xl(R) - 2, R.ty0 + 2, R.acc.base); R.put(xr(R) + 2, R.ty0 + 2, R.acc.lo); } },
  },
  astronaut: { // rymddräkt: halsring, kontrollpanel, livsuppehållare på ryggen, handskar
    label: 'Rymd­dräkt', group: 'Uniformer & yrken', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 1, 0, { slit: false });
      if (R.side) { const { rect, put, torsoTop, K } = R; rect(6, torsoTop + 1, 3, K ? 5 : 7, PACK.base); rect(6, torsoTop + 1, 3, 1, PACK.hi); vline(R, 6, torsoTop + 2, torsoTop + (K ? 6 : 8), PACK.lo); put(7, torsoTop + 3, METAL.lo); put(7, torsoTop + 5, METAL.lo); } },
    front(R) { const { rect, put, acc, ty0, ty1, K } = R;
      neckRing(R);
      const py = ty0 + 2; rect(10, py, 4, K ? 2 : 3, METAL.lo); rect(10, py, 4, 1, METAL.base);
      put(10, py + 1, 0xd83a3a); put(11, py + 1, 0x46c35a); put(12, py + 1, 0x3a8ae0); put(13, py + 1, NEON.base);
      if (!K) { put(8, ty0 + 2, acc.base); put(8, ty0 + 3, acc.lo); put(14, py + 3, acc.lo); put(15, py + 4, acc.lo); rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, METAL.lo); } },
    back(R) { const { rect, put, ty0, K, tw } = R; neckRing(R); const h = K ? 4 : 6;
      rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, h, PACK.base); rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, 1, PACK.hi); vline(R, 10 + tw, ty0 + 2, ty0 + 1 + h, PACK.lo);
      rect(10, ty0 + 3, 4, 1, METAL.lo); if (!K) rect(10, ty0 + 5, 4, 1, METAL.lo); put(12 - tw + 1, ty0 + h, PACK.lo); },
    side(R) { const { rect, put, torsoTop } = R; rect(10, torsoTop, 6, 1, METAL.base); put(9, torsoTop - 1, METAL.lo); put(15, torsoTop, METAL.hi); put(15, torsoTop + 2, 0xd83a3a); put(15, torsoTop + 3, 0x46c35a); },
    afterArms(R) { cuffs(R, METAL); gloves(R, GLOVE); if (!R.side && !R.eat && !R.carry && !R.K) R.put(xl(R) - 2, R.ty0 + 2, R.acc.base); },
  },
  firefighter: { // brandmansjacka: reflexband på kropp och ärmar, ståkrage, spännen
    label: 'Brandmans­jacka', group: 'Uniformer & yrken', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 2, 1); },
    front(R) { fireBands(R); standCollar(R); const { put, shirt, ty0, ty1 } = R; vline(R, 12, ty0 + 1, ty1, shirt.dk); for (let y = ty0 + 1; y < ty1; y += 3) put(11, y, METAL.base); },
    back(R) { fireBands(R); standCollar(R); },
    side(R) { fireBands(R); const { rect, put, shirt, torsoTop } = R; rect(10, torsoTop, 6, 1, shirt.hi); put(9, torsoTop - 1, shirt.hi); vline(R, 15, torsoTop + 1, R.ty1, shirt.dk); },
    afterArms(R) { R.pattern(TAG.sleeve, (x, y, k) => (!onShirt(R, k) ? null : R.tagAt(x, y + 1) === TAG.skin ? REFLEX : R.tagAt(x, y + 2) === TAG.skin ? NEON : null)); },
  },
  doctor: { // läkarrock: öppen, lång, stetoskop runt halsen, penna i bröstfickan
    label: 'Läkar­rock', group: 'Uniformer & yrken', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 5, 2, { open: true }); },
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, ty1 - ty0, acc.base); put(11, ty0 + 1, acc.hi); rect(11, ty0, 2, 1, skin.lo);
      vline(R, 10, ty0, ty0 + 3, shirt.hi); vline(R, 13, ty0, ty0 + 3, shirt.hi); vline(R, 10, ty0 + 3, ty1, shirt.lo); vline(R, 13, ty0 + 3, ty1, shirt.lo);
      vline(R, 9, ty0, ty0 + (K ? 2 : 3), STETH); vline(R, 14, ty0, ty0 + (K ? 3 : 4), STETH); put(14, ty0 + (K ? 3 : 4), METAL.hi);
      if (!K) { rect(15, ty0 + 3, 1, 1, shirt.lo); put(15, ty0 + 2, 0x3a7bd5); rect(8, ty1 - 2, 2, 1, shirt.lo); } },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.hi); },
    side(R) { const { put, shirt, acc, torsoTop, ty1 } = R; vline(R, 15, torsoTop, ty1, acc.base); vline(R, 14, torsoTop, torsoTop + 2, shirt.hi); vline(R, 14, torsoTop + 2, torsoTop + 5, STETH); put(14, torsoTop + 5, METAL.hi); put(10, torsoTop, STETH); },
  },
  pilot: { // pilotskjorta: axelklaffar med guld, vingar, slips
    label: 'Pilot­uniform', group: 'Uniformer & yrken', sleeve: 'long',
    front(R) { const { put, shirt, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(11, ty0, INK.hi); put(12, ty0, INK.base); vline(R, 12, ty0 + 1, ty0 + (K ? 3 : 5), INK.base); put(11, ty0 + 1, shirt.lo);
      put(a + 1, ty0, INK.base); put(b - 1, ty0, INK.base);
      put(13, ty0 + 2, GOLD.lo); put(14, ty0 + 2, GOLD.hi); put(15, ty0 + 2, GOLD.lo);
      vline(R, 11, ty0 + 2, ty1 - 1, shirt.lo); },
    back(R) { const { put, shirt, ty0 } = R; R.rect(10, ty0, 4, 1, shirt.hi); put(xl(R) + 1, ty0, INK.base); put(xr(R) - 1, ty0, INK.base); },
    side(R) { const { put, shirt, torsoTop, K } = R; put(13, torsoTop, INK.base); put(14, torsoTop, shirt.hi); put(15, torsoTop, INK.base); vline(R, 15, torsoTop + 1, torsoTop + (K ? 3 : 5), INK.base); put(14, torsoTop + 2, GOLD.hi); },
    afterArms(R) { const { ty0 } = R; R.pattern(TAG.sleeve, (x, y) => (y === ty0 ? GOLD : null)); },
  },
  sailor: { // sjömanströja: stor krage med vit rand, röd knut, fyrkantig krage på ryggen
    label: 'Sjömans­tröja', group: 'Uniformer & yrken', sleeve: 'long',
    front(R) { const { rect, put, skin, acc, ty0, K } = R;
      rect(9, ty0, 2, 1, acc.base); rect(13, ty0, 2, 1, acc.lo); rect(11, ty0, 2, 1, skin.lo);
      put(9, ty0 + 1, WHITE.base); put(10, ty0 + 1, acc.base); put(11, ty0 + 1, WHITE.hi); put(12, ty0 + 1, WHITE.base); put(13, ty0 + 1, acc.lo); put(14, ty0 + 1, WHITE.lo);
      put(10, ty0 + 2, WHITE.base); put(11, ty0 + 2, acc.base); put(12, ty0 + 2, acc.lo); put(13, ty0 + 2, WHITE.lo);
      const ky = ty0 + (K ? 2 : 3); put(11, ky, SCARF.base); put(12, ky, SCARF.lo);
      if (!K) { put(11, ky + 1, SCARF.lo); put(12, ky + 2, SCARF.lo); } },
    back(R) { const { rect, put, acc, ty0, K } = R; const a = xl(R) + 1, b = xr(R) - 1, n = K ? 3 : 4;
      rect(a, ty0, b - a + 1, n, acc.base); put(b, ty0, acc.lo); rect(a, ty0 + n - 1, b - a + 1, 1, acc.lo);
      rect(a + 1, ty0 + n - 2, b - a - 1, 1, WHITE.base); vline(R, a + 1, ty0, ty0 + n - 2, WHITE.base); vline(R, b - 1, ty0, ty0 + n - 2, WHITE.lo); },
    side(R) { const { rect, put, acc, torsoTop, K } = R; const n = K ? 3 : 4; rect(9, torsoTop, 3, n, acc.base); vline(R, 10, torsoTop, torsoTop + n - 1, WHITE.base); rect(12, torsoTop, 3, 1, acc.base); put(15, torsoTop + 1, WHITE.base); put(15, torsoTop + (K ? 2 : 3), SCARF.base); },
    afterArms(R) { cuffs(R, R.acc); },
  },
  workshirt: { // arbetsskjorta: två bröstfickor med lock, namnlapp, kortärmad
    label: 'Arbets­skjorta', group: 'Uniformer & yrken', sleeve: 'short',
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo); put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.hi); put(13, ty0 + 1, shirt.hi); put(12, ty0 + 1, shirt.lo);
      vline(R, 12, ty0 + 2, ty1 - 1, shirt.lo);
      const py = ty0 + (K ? 2 : 3); rect(8, py, 3, 1, shirt.dk); rect(13, py, 3, 1, shirt.dk);
      if (!K) { put(9, py + 1, WHITE.hi); put(10, py + 1, WHITE.base); put(9, py + 2, acc.base); vline(R, 14, py + 1, py + 3, shirt.lo); } },
    back(R) { const { rect, shirt, ty0 } = R; rect(10, ty0, 4, 1, shirt.hi); rect(xl(R), ty0 + 2, xr(R) - xl(R) + 1, 1, shirt.lo); },
    side(R) { const { rect, put, shirt, torsoTop, K } = R; rect(12, torsoTop, 4, 1, shirt.hi); rect(14, torsoTop + (K ? 2 : 3), 2, 1, shirt.dk); put(15, torsoTop + 1, shirt.hi); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },
  raincoat: { // regnjacka: blank, tryckknappar, luva på ryggen, lång
    label: 'Regn­jacka', group: 'Rockar & kappor', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 3, 1); },
    front(R) { const { rect, put, shirt, ty0, ty1, K } = R; const a = xl(R);
      standCollar(R); put(10, ty0 + 1, WHITE.lo); put(13, ty0 + 1, WHITE.lo);
      vline(R, 12, ty0 + 1, ty1, shirt.lo); for (let y = ty0 + 2; y < ty1; y += 2) put(11, y, WHITE.base);
      put(a + 1, ty0 + 2, shirt.hi); put(a + 2, ty0 + 1, WHITE.hi); if (!K) { put(a + 1, ty0 + 3, WHITE.hi); rect(14, ty0 + 4, 2, 1, shirt.dk); } },
    back(R) { const { rect, put, shirt, ty0, K } = R; rect(9, ty0, 6, K ? 2 : 3, shirt.lo); rect(10, ty0, 4, K ? 1 : 2, shirt.base); put(10, ty0, WHITE.hi); put(xl(R) + 1, ty0 + 2, shirt.hi); },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(8, torsoTop, 2, 3, shirt.lo); put(9, torsoTop, shirt.base); rect(10, torsoTop, 6, 1, shirt.hi); vline(R, 15, torsoTop + 1, ty1, shirt.lo); put(15, torsoTop + 2, WHITE.base); put(14, torsoTop + 1, WHITE.hi); },
    afterArms(R) { cuffs(R, far(R.shirt)); },
  },

  // ---------------- Toppar ----------------
  corset: { // korsettopp: hjärtformad urringning, snörning, pinnar, spets nedtill
    label: 'Korsett­topp', group: 'Toppar', sleeve: 'none',
    front(R) { corsetFB(R); const { put, skin, ty0 } = R; put(11, ty0 + 1, skin.lo); put(12, ty0 + 1, skin.lo); },
    back(R) { corsetFB(R); },
    side(R) { const { rect, put, skin, shirt, torsoTop, ty1 } = R; rect(10, torsoTop, 6, 1, skin.base); put(10, torsoTop, skin.lo); put(15, torsoTop, skin.hi); rect(9, torsoTop + 1, 7, 1, shirt.hi); vline(R, 14, torsoTop + 2, ty1, shirt.lo); vline(R, 10, torsoTop + 2, ty1, shirt.lo); },
  },
  peplum: { // peplumtopp: utsvängd volang över höfterna, båtringning
    label: 'Peplum­topp', group: 'Toppar', sleeve: 'short',
    beforeTorso(R) { const { rect, put, shirt, hy, K } = R; R.tag = TAG.torso; const n = K ? 1 : 2;
      for (let j = 0; j < n; j++) {
        const y = hy + j, a = (R.side ? 9 : xl(R)) - 1 - j, b = (R.side ? 15 : xr(R)) + 1 + j;
        rect(a, y, b - a + 1, 1, shirt.base); put(a, y, shirt.hi); put(b, y, shirt.lo);
        for (let x = a + 1 + j; x < b; x += 2) put(x, y, shirt.lo);
      } },
    front(R) { const { rect, skin, ty0 } = R; rect(10, ty0, 4, 1, skin.lo); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); },
    side(R) { const { put, skin, torsoTop } = R; put(14, torsoTop, skin.lo); put(15, torsoTop, skin.base); },
  },
  wrap: { // omlottopp: snett överslag och knytband i sidan
    label: 'Omlott­topp', group: 'Toppar', sleeve: 'long',
    front(R) { const { rect, put, skin, shirt, ty0, ty1, K } = R;
      rect(10, ty0, 4, 1, skin.base); put(10, ty0, skin.lo); rect(11, ty0 + 1, 3, 1, skin.lo); put(12, ty0 + 2, skin.lo);
      put(9, ty0, shirt.hi); put(10, ty0 + 1, shirt.hi); put(11, ty0 + 2, shirt.hi); put(12, ty0 + 3, shirt.hi); if (!K) put(13, ty0 + 4, shirt.hi);
      const by = ty1 - 2; put(14, by, shirt.hi); put(15, by, shirt.base); put(13, by, shirt.lo); put(15, by + 1, shirt.lo); put(16, by + 1, shirt.lo); put(15, by + 2, shirt.dk); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.shirt.lo); },
    side(R) { const { put, skin, shirt, torsoTop, ty1 } = R; put(14, torsoTop, skin.lo); put(15, torsoTop, skin.base); put(15, torsoTop + 1, skin.lo); put(15, torsoTop + 2, shirt.hi); put(15, ty1 - 2, shirt.hi); put(16, ty1 - 1, shirt.lo); put(16, ty1, shirt.dk); },
  },
  lace: { // spetsblus: hög volangkrage, genombruten spets på oket och ärmarna
    label: 'Spets­blus', group: 'Skjortor', sleeve: 'long',
    front(R) { laceYoke(R); const { rect, put, acc, ty0, ty1 } = R; rect(9, ty0, 6, 1, acc.hi); put(10, ty0, acc.lo); put(12, ty0, acc.lo); put(14, ty0, acc.lo); for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, acc.base); },
    back(R) { laceYoke(R); R.rect(9, R.ty0, 6, 1, R.acc.hi); },
    side(R) { laceYoke(R); const { rect, put, acc, torsoTop } = R; rect(10, torsoTop, 6, 1, acc.hi); put(9, torsoTop - 1, acc.base); put(16, torsoTop - 1, acc.lo); },
    afterArms(R) { const { ty0, skin, acc } = R; R.pattern(TAG.sleeve, (x, y, k) => (!onShirt(R, k) ? null : y <= ty0 + 2 && ((x + y) & 1) ? skin : null)); cuffs(R, acc); },
  },

  // ---------------- Fest & maskerad ----------------
  tuxedo: { // smoking: blanka slag, fluga, vit skjorta med knappar, vita manschetter
    label: 'Smoking', group: 'Fest & maskerad', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, ty1, K } = R; const v = K ? 2 : 4;
      rect(11, ty0, 2, v, WHITE.base); put(11, ty0 + 1, WHITE.hi);
      put(10, ty0, acc.base); put(11, ty0, acc.lo); put(12, ty0, acc.dk); put(13, ty0, acc.base);
      vline(R, 10, ty0 + 1, ty0 + v, shirt.hi); vline(R, 13, ty0 + 1, ty0 + v, shirt.hi);
      if (!K) { put(12, ty0 + 2, INK.base); put(12, ty0 + 3, INK.base); }
      vline(R, 12, ty0 + v, ty1, shirt.lo); put(11, ty0 + v + 1, shirt.dk);
      if (!K) put(14, ty0 + 3, WHITE.hi); },
    back(R) { const { rect, shirt, ty0 } = R; rect(10, ty0, 4, 1, shirt.hi); },
    side(R) { const { rect, put, shirt, acc, torsoTop } = R; put(15, torsoTop, acc.base); put(14, torsoTop, acc.lo); rect(15, torsoTop + 1, 1, 2, WHITE.base); put(14, torsoTop + 1, shirt.hi); put(14, torsoTop + 2, shirt.hi); },
    afterArms(R) { cuffs(R, WHITE); },
  },
  hero: { // superhjältedräkt: åtsittande, bälte med spänne, mantel i detaljfärgen
    label: 'Super­hjälte', group: 'Fest & maskerad', sleeve: 'long',
    front(R) { const { rect, put, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
      put(a + 1, ty0, acc.base); put(b - 1, ty0, acc.lo); put(10, ty0, GOLD.hi); put(13, ty0, GOLD.base);
      rect(a, ty1 - 1, b - a + 1, 1, GOLD.lo); rect(11, ty1 - 1, 2, 1, GOLD.hi); if (!K) put(12, ty1 - 1, GOLD.base); },
    back(R) { const { rect, ty1 } = R; rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, GOLD.lo); },
    side(R) { const { rect, ty1 } = R; rect(9, ty1 - 1, 7, 1, GOLD.lo); R.put(15, ty1 - 1, GOLD.hi); },
    afterArms(R) { capeOver(R, R.acc); cuffs(R, R.acc); },
    last(R) { capeBehind(R, R.acc, R.acc); },
  },
  vampire: { // vampyrkappa: hög krage, rött foder (detaljfärgen), vit skjorta med brosch
    label: 'Vampyr­kappa', group: 'Fest & maskerad', sleeve: 'long',
    front(R) { const { rect, put, shirt, acc, ty0, ty1, K } = R;
      rect(10, ty0, 4, ty1 - ty0, WHITE.base); vline(R, 10, ty0, ty1, WHITE.hi); vline(R, 13, ty0, ty1, WHITE.lo);
      put(11, ty0 + 1, 0xb0182a); put(12, ty0 + 1, 0xd83a4a); put(11, ty0, GOLD.base); put(12, ty0, GOLD.lo);
      if (!K) { put(11, ty0 + 3, WHITE.lo); put(12, ty0 + 4, WHITE.lo); }
      vline(R, 9, ty0, ty1, acc.base); vline(R, 14, ty0, ty1, acc.lo);
      vampCollar(R); },
    back(R) { vampCollar(R); },
    side(R) { const { put, acc, torsoTop, ty1 } = R; vline(R, 15, torsoTop, ty1, WHITE.base); vline(R, 14, torsoTop, ty1, acc.base); put(9, torsoTop - 1, R.shirt.base); put(9, torsoTop - 2, R.shirt.base); put(8, torsoTop - 3, R.shirt.hi); put(10, torsoTop - 1, acc.lo); },
    afterArms(R) { capeOver(R, R.shirt); },
    last(R) { capeBehind(R, R.shirt, R.acc); },
  },
  poncho: { // poncho: täcker axlar och överarmar, ränder, fransar; tröja under i detaljfärgen
    label: 'Poncho', group: 'Fest & maskerad', sleeve: 'long',
    afterArms(R) { sleevesIn(R, R.acc); ponchoCape(R); },
  },
  kimono: { // kimono: omlott med krage i detaljfärgen, obi i tryckfärgen, vida ärmar
    label: 'Kimono', group: 'Fest & maskerad', sleeve: 'long', uses: ['print2'],
    beforeTorso(R) { coatHem(R, 5, 2, { slit: false }); },
    front(R) { const { put, skin, acc, ty0, ty1, K } = R;
      put(10, ty0, acc.base); put(11, ty0, skin.lo); put(12, ty0, WHITE.base); put(13, ty0, acc.lo);
      put(11, ty0 + 1, acc.base); put(12, ty0 + 1, WHITE.lo); put(13, ty0 + 1, acc.lo); put(12, ty0 + 2, acc.base);
      vline(R, 13, ty0 + 2, ty1 + hemRows(R, K ? 2 : 5), R.shirt.lo); obi(R); },
    back(R) { const { rect, put, acc, print, ty0, ty1, K } = R; rect(10, ty0, 4, 1, acc.base); obi(R);
      const by = ty1 - (K ? 3 : 4); rect(10, by, 4, K ? 2 : 3, print.base); rect(10, by, 4, 1, print.hi); put(13, by + 1, print.lo); if (!K) rect(11, by + 3, 2, 1, print.lo); },
    side(R) { const { rect, put, acc, print, torsoTop, ty1, K } = R; put(14, torsoTop, acc.base); put(15, torsoTop, acc.lo); put(15, torsoTop + 1, acc.base); obi(R); const by = ty1 - (K ? 3 : 4); rect(7, by, 2, K ? 2 : 3, print.base); put(7, by, print.hi); },
    afterArms(R) { bellSleeves(R, R.shirt); },
  },
  gi: { // karatedräkt: tjockt omlottslag, bälte i detaljfärgen med knut och hängande ändar
    label: 'Karate­dräkt', group: 'Sport', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 2, 1, { slit: false }); },
    front(R) { const { rect, put, skin, shirt, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, 1, skin.lo); put(12, ty0 + 1, skin.lo);
      put(9, ty0, shirt.hi); put(10, ty0, shirt.hi); put(10, ty0 + 1, shirt.hi); put(11, ty0 + 1, shirt.hi); put(11, ty0 + 2, shirt.hi); put(12, ty0 + 2, shirt.hi); if (!K) put(12, ty0 + 3, shirt.hi);
      put(13, ty0, shirt.hi); put(14, ty0, shirt.hi); put(13, ty0 + 1, shirt.lo);
      vline(R, 13, ty0 + (K ? 3 : 4), ty1 - 1, shirt.lo);
      const by = ty1 - 2; rect(xl(R), by, xr(R) - xl(R) + 1, 1, acc.base); rect(11, by, 2, 1, acc.hi); put(11, by + 1, acc.base); put(10, by + 2, acc.lo); put(12, by + 1, acc.lo); if (!K) { put(10, by + 3, acc.lo); put(13, by + 2, acc.lo); } },
    back(R) { const { rect, shirt, acc, ty0, ty1 } = R; rect(10, ty0, 4, 1, shirt.hi); rect(xl(R), ty1 - 2, xr(R) - xl(R) + 1, 1, acc.base); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1 } = R; rect(13, torsoTop, 3, 1, shirt.hi); put(15, torsoTop + 1, shirt.hi); rect(9, ty1 - 2, 7, 1, acc.base); put(16, ty1 - 1, acc.lo); put(16, ty1, acc.lo); },
    afterArms(R) { cuffs(R, lighter(R.shirt)); },
  },
  robe: { // trollkarlskåpa: fotsid, vida ärmar, rep i midjan, luva på ryggen
    label: 'Troll­karls­kåpa', group: 'Fest & maskerad', sleeve: 'long',
    beforeTorso(R) { robeHem(R); },
    front(R) { const { rect, put, acc, ty0, ty1, K } = R;
      teeNeck(R); put(10, ty0, acc.base); put(13, ty0, acc.lo);
      vline(R, 12, ty0 + (K ? 1 : 2), R.hy + hemRows(R, R.shoeTop - R.hy), acc.lo);
      rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, acc.base); put(11, ty1, acc.base); put(11, ty1 + 1, acc.lo); put(10, ty1 + 1, acc.lo); },
    back(R) { const { rect, put, shirt, acc, ty0, ty1, K } = R; rect(9, ty0, 6, K ? 3 : 4, shirt.lo); rect(10, ty0, 4, K ? 2 : 3, shirt.base); put(10, ty0, acc.base); put(13, ty0, acc.lo); rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, acc.base); },
    side(R) { const { rect, put, shirt, acc, torsoTop, ty1 } = R; rect(7, torsoTop, 3, 3, shirt.lo); put(8, torsoTop, acc.base); rect(9, ty1 - 1, 7, 1, acc.base); put(15, ty1, acc.lo); put(15, ty1 + 1, acc.lo); },
    afterArms(R) { bellSleeves(R, R.shirt); cuffs(R, R.acc); },
  },
  bathrobe: { // morgonrock: sjalkrage, skärp med knut och ändar, knälång
    label: 'Morgon­rock', group: 'Fest & maskerad', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 5, 2, { slit: false }); },
    front(R) { const { rect, put, skin, shirt, ty0, ty1, hy, K } = R;
      rect(11, ty0, 2, 1, skin.base); put(12, ty0 + 1, skin.lo);
      rect(9, ty0, 2, 1, shirt.hi); put(10, ty0 + 1, shirt.hi); put(11, ty0 + 1, shirt.hi); put(11, ty0 + 2, shirt.hi); put(12, ty0 + 2, shirt.hi);
      rect(13, ty0, 2, 1, shirt.hi); put(13, ty0 + 1, shirt.base);
      vline(R, 13, ty0 + 3, ty1 + hemRows(R, K ? 2 : 5), shirt.lo);
      rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, shirt.lo); put(14, ty1 - 1, shirt.hi); put(14, ty1, shirt.lo); put(15, ty1, shirt.lo); put(14, ty1 + 1, shirt.dk);
      if (!K && hemRows(R, 5) >= 3) rect(8, hy + 1, 2, 1, shirt.dk); },
    back(R) { const { rect, shirt, ty0, ty1 } = R; rect(9, ty0, 6, 1, shirt.hi); rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, shirt.lo); },
    side(R) { const { rect, put, shirt, torsoTop, ty1 } = R; rect(12, torsoTop, 4, 1, shirt.hi); put(15, torsoTop + 1, shirt.hi); rect(9, ty1 - 1, 7, 1, shirt.lo); put(16, ty1 - 1, shirt.lo); put(16, ty1, shirt.dk); },
  },
  pyjamas: { // pyjamasskjorta: passpoal i detaljfärgen runt krage, knappslå, ficka och ärmar
    label: 'Pyjamas', group: 'Fest & maskerad', sleeve: 'long',
    front(R) { const { rect, put, skin, acc, ty0, ty1, K } = R;
      rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo);
      put(10, ty0, acc.hi); put(13, ty0, acc.base); put(10, ty0 + 1, acc.base); put(13, ty0 + 1, acc.lo); put(12, ty0 + 1, acc.lo);
      vline(R, 12, ty0 + 2, ty1, acc.base);
      for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(11, y, WHITE.base);
      if (!K) rect(14, ty0 + 3, 2, 1, acc.base); },
    back(R) { R.rect(10, R.ty0, 4, 1, R.acc.base); },
    side(R) { const { rect, put, acc, torsoTop, ty1 } = R; rect(12, torsoTop, 4, 1, acc.base); vline(R, 15, torsoTop + 1, ty1, acc.base); put(14, torsoTop + 3, acc.lo); },
    afterArms(R) { cuffs(R, R.acc); },
  },
  pirate: { // piratrock: lång, guldkant och guldknappar, vit skjorta med volang, skärp, stora ärmuppslag
    label: 'Pirat­rock', group: 'Fest & maskerad', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 5, 2, { flare: 1, open: true }); },
    front(R) { const { rect, put, acc, ty0, ty1, hy, K } = R;
      rect(11, ty0, 2, ty1 - ty0, WHITE.base); put(11, ty0 + 1, WHITE.hi); put(12, ty0 + 1, WHITE.lo); put(11, ty0 + 2, WHITE.lo); put(12, ty0 + 2, WHITE.hi);
      const end = hy + hemRows(R, K ? 2 : 5);
      vline(R, 10, ty0, end, GOLD.lo); vline(R, 13, ty0, end, GOLD.base);
      for (let y = ty0 + 2; y < ty1 - 2; y += 2) { put(9, y, GOLD.hi); put(14, y, GOLD.hi); }
      rect(xl(R), ty1 - 2, xr(R) - xl(R) + 1, 1, INK.base); rect(11, ty1 - 2, 2, 1, GOLD.hi); put(xl(R), ty1 - 2, acc.base); },
    back(R) { const { rect, shirt, ty0, ty1 } = R; rect(10, ty0, 4, 1, shirt.hi); rect(xl(R), ty1 - 2, xr(R) - xl(R) + 1, 1, INK.base); },
    side(R) { const { rect, put, torsoTop, ty1 } = R; vline(R, 15, torsoTop, ty1, WHITE.base); vline(R, 14, torsoTop, ty1, GOLD.base); rect(9, ty1 - 2, 7, 1, INK.base); put(15, ty1 - 2, GOLD.hi); put(15, torsoTop + 1, WHITE.hi); },
    afterArms(R) { R.pattern(TAG.sleeve, (x, y, k) => (!onShirt(R, k) ? null : R.tagAt(x, y + 1) === TAG.skin ? R.acc : R.tagAt(x, y + 2) === TAG.skin ? lighter(R.acc) : null)); },
  },
  armor: { // ringbrynja med vapenrock i tröjfärgen, bälte
    label: 'Ring­brynja', group: 'Fest & maskerad', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 2, 1, { slit: false }); },
    front(R) { armorFB(R); },
    back(R) { armorFB(R); },
    side(R) { const { rect, put, acc, torsoTop, ty1 } = R; for (let x = 10; x < 16; x++) put(x, torsoTop, mail(x, torsoTop).base); vline(R, 9, torsoTop, ty1, MAIL.lo); rect(10, torsoTop + 1, 6, 1, acc.base); rect(9, ty1 - 1, 7, 1, INK.base); put(15, ty1 - 1, GOLD.base); },
    afterArms(R) { R.pattern(TAG.sleeve, (x, y) => mail(x, y)); },
  },
  santa: { // tomtejacka: vit pälskant fram, nedtill och vid ärmarna, svart bälte
    label: 'Tomte­jacka', group: 'Fest & maskerad', sleeve: 'long',
    beforeTorso(R) { coatHem(R, 2, 1, { slit: false }); },
    front(R) { const { rect, ty0, ty1, hy, K } = R; const a = xl(R), b = xr(R), end = hy + hemRows(R, K ? 1 : 2);
      furRow(R, 9, 14, ty0); for (let y = ty0 + 1; y < end; y++) { R.put(11, y, (y & 1) ? FUR.base : FUR.lo); R.put(12, y, (y & 1) ? FUR.lo : FUR.base); }
      furRow(R, a, b, end - 1);
      rect(a, ty1 - 1, b - a + 1, 1, INK.base); rect(10, ty1 - 1, 4, 1, GOLD.base); rect(11, ty1 - 1, 2, 1, INK.lo); },
    back(R) { const { rect, ty0, ty1, hy, K } = R; furRow(R, 9, 14, ty0); furRow(R, xl(R), xr(R), hy + hemRows(R, K ? 1 : 2) - 1); rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, INK.base); },
    side(R) { const { rect, torsoTop, ty1, hy, K } = R; furRow(R, 10, 15, torsoTop); for (let y = torsoTop; y < hy + hemRows(R, K ? 1 : 2); y++) R.put(15, y, FUR.base); furRow(R, 9, 15, hy + hemRows(R, K ? 1 : 2) - 1); rect(9, ty1 - 1, 7, 1, INK.base); R.put(15, ty1 - 1, GOLD.base); },
    afterArms(R) { cuffs(R, FUR); },
  },
  lucia: { // luciasärk: fotsid, vit, med rött band i midjan (detaljfärgen)
    label: 'Lucia­särk', group: 'Fest & maskerad', sleeve: 'long',
    beforeTorso(R) { robeHem(R); },
    front(R) { const { rect, put, acc, ty1, K } = R; teeNeck(R); const a = xl(R), b = xr(R), n = K ? 1 : 2;
      rect(a, ty1 - n, b - a + 1, n, acc.base); rect(a, ty1 - n, b - a + 1, 1, acc.hi); put(b, ty1 - 1, acc.lo);
      put(14, ty1 - n - 1, acc.base); put(15, ty1 - n - 1, acc.lo); put(14, ty1, acc.lo); put(15, ty1, acc.base); put(15, ty1 + 1, acc.lo); if (!K) { put(14, ty1 + 1, acc.lo); put(15, ty1 + 2, acc.dk); } },
    back(R) { const { rect, acc, ty1, K } = R; const n = K ? 1 : 2; rect(xl(R), ty1 - n, xr(R) - xl(R) + 1, n, acc.base); rect(10, ty1 - n - 1, 4, 1, acc.lo); },
    side(R) { const { rect, put, acc, torsoTop, ty1, K } = R; const n = K ? 1 : 2; rect(9, ty1 - n, 7, n, acc.base); put(15, torsoTop, R.skin.lo); put(16, ty1 - 1, acc.lo); put(16, ty1, acc.lo); },
    afterArms(R) { cuffs(R, lighter(R.shirt)); },
  },
  folk: { // folkdräktsväst: liv i tröjfärgen över vit särk, broderad kant, snörning, brosch
    label: 'Folk­dräkt', group: 'Fest & maskerad', sleeve: 'long',
    front(R) { const { rect, put, acc, ty0, ty1, K } = R;
      rect(10, ty0, 4, K ? 2 : 3, WHITE.base); put(10, ty0, WHITE.hi); put(13, ty0, WHITE.lo); put(11, ty0 + 1, GOLD.hi); put(12, ty0 + 1, GOLD.lo);
      put(xl(R) + 1, ty0, WHITE.hi); put(xr(R) - 1, ty0, WHITE.lo);
      vline(R, 10, ty0 + (K ? 2 : 3), ty1, acc.base); vline(R, 13, ty0 + (K ? 2 : 3), ty1, acc.lo);
      for (let y = ty0 + (K ? 2 : 3); y < ty1; y++) { put(11, y, (y & 1) ? acc.hi : WHITE.base); put(12, y, (y & 1) ? WHITE.base : acc.hi); }
      rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, acc.base); },
    back(R) { const { rect, put, acc, ty0, ty1 } = R; put(xl(R) + 1, ty0, WHITE.hi); put(xr(R) - 1, ty0, WHITE.lo); rect(10, ty0, 4, 1, WHITE.base); rect(xl(R), ty1 - 1, xr(R) - xl(R) + 1, 1, acc.base); vline(R, 11, ty0 + 1, ty1 - 1, acc.lo); },
    side(R) { const { rect, put, acc, torsoTop, ty1 } = R; rect(13, torsoTop, 3, 2, WHITE.base); vline(R, 14, torsoTop + 2, ty1, acc.base); vline(R, 15, torsoTop + 2, ty1, WHITE.base); rect(9, ty1 - 1, 7, 1, acc.base); put(15, torsoTop + 1, GOLD.base); },
    afterArms(R) { sleevesIn(R, WHITE); cuffs(R, far(WHITE)); folkPuff(R); },
  },
};

// ---------- hjälpare för toppar, fest & maskerad ----------
const MAIL = ramp(0x9aa0ab);    // ringbrynja
const mail = (x, y) => ((x + y) & 1 ? far(MAIL) : (x & 1 ? MAIL : lighter(MAIL)));
function corsetFB(R) { // korsett: bara axlar, snörning i detaljfärgen, pinnar, spets
  const { rect, put, skin, shirt, acc, ty0, ty1 } = R; const a = xl(R), b = xr(R);
  skinRow(R, ty0, a + 1, b - 1);
  rect(a, ty0 + 1, b - a + 1, 1, shirt.hi); put(a, ty0 + 1, skin.hi); put(b, ty0 + 1, skin.lo);
  for (let y = ty0 + 2; y < ty1; y++) { put(11, y, (y & 1) ? acc.base : shirt.dk); put(12, y, (y & 1) ? shirt.dk : acc.lo); }
  vline(R, 9, ty0 + 2, ty1, shirt.lo); vline(R, 14, ty0 + 2, ty1, shirt.lo);
  put(11, ty1, shirt.lo); put(12, ty1, shirt.dk);
}
function laceYoke(R) { // genombruten spets (hud skymtar) på axlar och bröst
  const { skin, ty0, K } = R; const n = K ? 2 : 3;
  R.pattern(TAG.torso, (x, y, k) => (!onShirt(R, k) ? null : y > ty0 && y <= ty0 + n && ((x + y) & 1) ? skin : null));
}
function vampCollar(R) { // hög kappkrage bakom huvudet (tomma pixlar fylls först)
  const { put, has, shirt, acc, ty0 } = R;
  const pix = [[7, ty0 - 1, shirt.base], [7, ty0 - 2, shirt.base], [6, ty0 - 3, shirt.hi], [8, ty0 - 1, acc.base], [16, ty0 - 1, shirt.lo], [16, ty0 - 2, shirt.lo], [17, ty0 - 3, shirt.base], [15, ty0 - 1, acc.lo], [6, ty0 - 2, shirt.lo], [17, ty0 - 2, shirt.dk]];
  for (const [x, y, c] of pix) if (!has(x, y)) put(x, y, c);
}
const capeEnd = (R) => (R.sit ? R.hy + 1 : R.K ? R.hy + 3 : R.legTop + 4);
function capeOver(R, c) { // manteln bakifrån (över rygg och armar) och från sidan (längs ryggen)
  const { rect, put, ty0 } = R; const end = capeEnd(R);
  if (R.side) { for (let y = ty0; y <= end; y++) put(9, y, y === end ? c.lo : c.base); return; }
  if (!R.back) return;
  for (let y = ty0; y <= end; y++) {
    const e = (y - ty0) >> 3, t = y === ty0 ? 2 : 0, a = xl(R) - 2 - e + t, b = xr(R) + 2 + e - t;
    rect(a, y, b - a + 1, 1, y === end ? c.lo : c.base); put(a, y, c.hi); put(b, y, c.lo);
    if (y > ty0 + 2 && y < end) { put(10, y, c.lo); put(14, y, c.lo); }
  }
}
function capeBehind(R, c, lin) { // manteln bakom figuren (kroken last: fyller bara tomma pixlar)
  if (R.back) return;
  const { has, put, ty0 } = R; const end = capeEnd(R);
  if (R.side) {
    for (let y = ty0 + 1; y <= end; y++) {
      const e = Math.min(3, (y - ty0) >> 2) + ((R.walkA || R.walkB) && y > R.hy ? 1 : 0);
      for (let x = 8 - e; x <= 8; x++) if (!has(x, y)) put(x, y, x === 8 - e ? c.lo : y === end ? c.lo : c.base);
    }
    return;
  }
  for (let y = ty0 + 1; y <= end; y++) {
    const e = (y - ty0) >> 3, a = xl(R) - 3 - e, b = xr(R) + 3 + e;
    for (let x = a; x <= b; x++) if (!has(x, y)) put(x, y, y === end ? lin.dk : x === a ? lin.base : lin.lo);
  }
}
function ponchoCape(R) { // ponchon ritas över armarna: trapets, ränder, fransar
  const { rect, put, shirt, acc, print, skin, ty0, K } = R; const n = K ? 4 : 6;
  const rows = [];
  if (R.side) {
    for (let k = 0; k < n + 1; k++) { const a = k === 0 ? 10 : k === 1 ? 9 : 8, b = k === 0 ? 15 : 16; rows.push([a, b]); }
  } else {
    const A = xl(R), B = xr(R);
    for (let k = 0; k < n; k++) { const e = Math.min(3, k === 0 ? -1 : k); rows.push([A - e, B + e]); }
    rows.push([A, B]); rows.push([A + 2, B - 2]); if (!K) rows.push([10, 13]);
  }
  rows.forEach(([a, b], k) => {
    const y = ty0 + k, stripe = k === 2 ? acc : k === 4 ? print : null, c = stripe || shirt;
    rect(a, y, b - a + 1, 1, c.base); put(a, y, c.hi); put(b, y, c.lo);
  });
  // fransar under nederkanten
  rows.forEach(([a, b], k) => { const next = rows[k + 1]; for (let x = a; x <= b; x++) if (!next || x < next[0] || x > next[1]) if (!((x + k) & 1)) put(x, ty0 + k + 1, acc.lo); });
  if (!R.back && !R.side) rect(11, ty0, 2, 1, skin.lo);
  if (R.side) put(15, ty0, skin.lo);
}
function obi(R) { // kimonons obi (bälte) i tryckfärgen med snodd i detaljfärgen
  const { rect, print, acc, ty1, K } = R; const a = R.side ? 9 : xl(R), w = R.side ? 7 : xr(R) - xl(R) + 1, n = K ? 2 : 3;
  rect(a, ty1 - n, w, n, print.base); rect(a, ty1 - n, w, 1, print.hi); rect(a, ty1 - 1, w, 1, print.lo);
  rect(a, ty1 - n + 1, w, 1, K ? print.base : acc.base);
}
function bellSleeves(R, c) { // vida ärmar: en pixel extra utåt nedanför armbågen
  if (R.eat || R.carry) return;
  const pts = [];
  R.each(TAG.sleeve, (x, y) => { if (y >= R.ty0 + 3) pts.push([x, y]); });
  if (R.side) {
    const minX = {};
    for (const [x, y] of pts) if (x >= 10 && (minX[y] === undefined || x < minX[y])) minX[y] = x;
    for (const y in minX) R.put(minX[y] - 1, +y, c.lo);
    return;
  }
  for (const [x, y] of pts) {
    if (x < 12 && !R.has(x - 1, y)) R.put(x - 1, y, c.base);
    else if (x >= 12 && !R.has(x + 1, y)) R.put(x + 1, y, c.lo);
  }
}
function robeHem(R) { // fotsid kjortel (trollkarlskåpa, luciasärk)
  const n = R.shoeTop - R.hy;
  coatHem(R, n, n, { flare: 2, slit: false });
}
function armorFB(R) { // ringbrynjans axlar/sidor + vapenrock med kant och bälte
  const { rect, put, acc, ty0, ty1, hy, K } = R; const a = xl(R), b = xr(R);
  for (let x = a + 1; x < b; x++) put(x, ty0, mail(x, ty0).base);
  for (let y = ty0 + 1; y < ty1; y++) { put(a, y, mail(a, y).base); put(b, y, mail(b, y).base); }
  rect(a + 1, ty0 + 1, b - a - 1, 1, acc.base);
  vline(R, a + 1, ty0 + 2, hy + hemRows(R, K ? 1 : 2), acc.lo); vline(R, b - 1, ty0 + 2, hy + hemRows(R, K ? 1 : 2), acc.lo);
  rect(a, ty1 - 1, b - a + 1, 1, INK.base); if (!R.back) rect(11, ty1 - 1, 2, 1, GOLD.base);
  if (!R.back && !K) { put(11, ty0, R.skin.lo); put(12, ty0, R.skin.lo); }
}
function folkPuff(R) { // puffärmar på särken
  if (R.eat || R.carry) return;
  const { put, ty0, K } = R;
  if (R.side) { put(10, ty0 + 1, WHITE.lo); put(14, ty0 + 1, WHITE.hi); return; }
  const a = xl(R) - 3, b = xr(R) + 3;
  put(a, ty0 + 1, WHITE.hi); put(b, ty0 + 1, WHITE.lo); if (!K) { put(a, ty0 + 2, WHITE.base); put(b, ty0 + 2, WHITE.lo); }
}

// ---------- fler fasta färger och hjälpare ----------
const PACK = ramp(0xe6e8ec);    // rymddräktens ryggsäck
const GLOVE = ramp(0xdde0e7);   // rymdhandskar
const STETH = 0x4a4f5a;         // stetoskopets slang
const SCARF = ramp(0xc9323a);   // sjömansknuten
function windBand(R) { // vindjackans färgblock + vit rand
  const { ty0, acc, K } = R; const y = ty0 + (K ? 1 : 2);
  R.pattern(TAG.torso, (x, yy, k) => (!onShirt(R, k) ? null : yy === y ? acc : yy === y + 1 ? WHITE : null));
}
function varsityHem(R) { // collegejackans fåll: mörk ribb med rand
  const { rect, shirt, acc, ty1, K } = R; const a = R.side ? 9 : xl(R), w = R.side ? 7 : xr(R) - xl(R) + 1;
  rect(a, ty1 - 1, w, 1, shirt.dk); if (!K) rect(a, ty1 - 2, w, 1, acc.base);
}
function armStripe(R, c) { // rand längs ärmens yttersida (från sidan: mitt på ärmen)
  const { has, tagAt } = R;
  R.pattern(TAG.sleeve, (x, y, k) => {
    if (!onShirt(R, k)) return null;
    if (R.side) return tagAt(x - 1, y) === TAG.sleeve && tagAt(x + 1, y) === TAG.sleeve ? c : null;
    return (x < 12 ? !has(x - 1, y) : !has(x + 1, y)) ? c : null;
  });
}
function hiVisFB(R) { // varselvästens reflexband och axelband
  const { rect, put, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
  put(a + 1, ty0, R.acc.hi); put(b - 1, ty0, R.acc.lo);
  const ys = K ? [ty1 - 2] : [ty0 + 3, ty1 - 3];
  for (const y of ys) { rect(a, y, b - a + 1, 1, REFLEX.base); put(a, y, REFLEX.hi); put(b, y, REFLEX.lo); }
  vline(R, 9, ty0, ys[0], REFLEX.base); vline(R, 14, ty0, ys[0], REFLEX.lo);
}
function basketFB(R, front) { // basketlinnets ärmhål, halsringning och sidoränder
  const { rect, put, skin, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
  put(a + 1, ty0, skin.hi); put(b - 1, ty0, skin.lo); put(a, ty0 + 1, skin.hi); put(b, ty0 + 1, skin.lo);
  put(a + 1, ty0 + 1, acc.base); put(b - 1, ty0 + 1, acc.lo); put(a, ty0 + 2, acc.base); put(b, ty0 + 2, acc.lo);
  vline(R, a, ty0 + 3, ty1 - 1, acc.base); vline(R, b, ty0 + 3, ty1 - 1, acc.lo);
  rect(11, ty0, 2, 1, skin.base); put(10, ty0, acc.base); put(13, ty0, acc.lo);
  if (front && !K) { rect(11, ty0 + 1, 2, 1, skin.lo); put(10, ty0 + 1, acc.base); put(13, ty0 + 1, acc.lo); put(11, ty0 + 2, acc.base); put(12, ty0 + 2, acc.lo); }
  else { put(11, ty0 + 1, acc.base); put(12, ty0 + 1, acc.lo); }
}
function hockeyFB(R) { // hockeytröjans ok och ränder nedtill
  const { rect, put, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
  rect(a + 1, ty0, b - a - 1, 1, acc.base); rect(a, ty0 + 1, b - a + 1, 1, acc.base); put(b, ty0 + 1, acc.lo);
  rect(a, ty1 - 3, b - a + 1, 1, acc.base); put(b, ty1 - 3, acc.lo);
  if (!K) { rect(a, ty1 - 2, b - a + 1, 1, WHITE.base); put(b, ty1 - 2, WHITE.lo); }
}
function neckRing(R) { // rymddräktens halsring
  const { rect, put, ty0 } = R;
  rect(9, ty0, 6, 1, METAL.base); put(9, ty0, METAL.hi); put(14, ty0, METAL.lo); put(8, ty0 - 1, METAL.lo); put(15, ty0 - 1, METAL.dk);
}
function gloves(R, c) { // handskar: färga om händerna (hud nära armarnas ände)
  const { ty0, hy } = R;
  R.pattern(TAG.skin, (x, y) => (y >= ty0 - 2 && y < hy + 2 ? c : null), R.skin);
}
function fireBands(R) { // brandmansjackans reflexband (gult + silver)
  const { rect, ty0, ty1, hy, K } = R; const a = R.side ? 9 : xl(R), w = R.side ? 7 : xr(R) - xl(R) + 1;
  const low = K ? ty1 - 2 : Math.min(ty1, hy + hemRows(R, 2) - 3);
  if (!K) { rect(a, ty0 + 3, w, 1, NEON.base); rect(a, ty0 + 4, w, 1, REFLEX.base); }
  rect(a, low, w, 1, NEON.base); rect(a, low + 1, w, 1, REFLEX.base);
}

// ---------- fler hjälpare ----------
function put2(R, x, y, c) { R.put(x, y, c); R.put(x, y + 1, c); }
function crewRib(R) { // ribbad rund halskant runt t-shirthalsen
  const { put, shirt, ty0, K } = R;
  put(10, ty0, shirt.lo); put(13, ty0, shirt.lo);
  if (K) { put(11, ty0 + 1, shirt.lo); put(12, ty0 + 1, shirt.lo); }
  else { put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo); put(11, ty0 + 2, shirt.lo); put(12, ty0 + 2, shirt.lo); }
}
function ribHem(R, split = false) { // ribbad nederkant (varannan pixel mörk)
  const { put, shirt, ty1 } = R; const y = ty1 - 1;
  if (R.side) { for (let x = 10; x < 16; x++) put(x, y, x & 1 ? shirt.lo : shirt.dk); return; }
  for (let x = xl(R) + 1; x < xr(R); x++) if (!split || (x !== 11 && x !== 12)) put(x, y, x & 1 ? shirt.lo : shirt.dk);
}
function hemIn(R, c) { // nederkant i en annan färg (kantband)
  const { rect, ty1 } = R;
  if (R.side) rect(10, ty1 - 1, 6, 1, c.lo); else rect(xl(R) + 1, ty1 - 1, xr(R) - xl(R) - 1, 1, c.lo);
}
function bandHem(R, c, n) { // bred ribbad fåll (bomberjacka)
  const { put, ty1 } = R; const a = R.side ? 9 : xl(R), b = R.side ? 15 : xr(R);
  for (let j = 0; j < n; j++) for (let x = a; x <= b; x++) put(x, ty1 - 1 - j, (x + j) & 1 ? c.base : c.lo);
}
function vNeckCollar(R) { // v-ringning med skjortkrage i detaljfärgen
  const { put, shirt, acc, ty0, K } = R;
  put(10, ty0, shirt.lo); put(13, ty0, shirt.lo); put(11, ty0, acc.hi); put(12, ty0, acc.hi);
  put(11, ty0 + 1, acc.base); put(12, ty0 + 1, acc.lo);
  if (!K) { put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo); put(11, ty0 + 2, shirt.lo); put(12, ty0 + 2, shirt.lo); }
}
function standCollar(R) { // ståkrage som når upp bredvid hakan (fram/bak)
  const { rect, put, shirt, ty0 } = R;
  rect(9, ty0, 6, 1, shirt.hi); put(14, ty0, shirt.base); put(8, ty0 - 1, shirt.hi); put(15, ty0 - 1, shirt.base);
}
function turtleFB(R) { // polokrage: hög, vikt, med ribbor
  const { rect, put, shirt, ty0 } = R;
  rect(9, ty0, 6, 1, shirt.hi); put(14, ty0, shirt.base); put(10, ty0, shirt.base); put(12, ty0, shirt.base);
  put(8, ty0 - 1, shirt.hi); put(15, ty0 - 1, shirt.base);
}
function cables(R, front) { // flätor: sicksack i ljus/mörk ton
  const { put, shirt, ty0, ty1 } = R;
  for (let y = ty0 + (front ? 3 : 1); y < ty1 - 1; y++) {
    const k = (y - ty0) % 4 < 2;
    put(9, y, k ? shirt.lo : shirt.hi); put(10, y, k ? shirt.hi : shirt.lo);
    put(13, y, k ? shirt.hi : shirt.lo); put(14, y, k ? shirt.lo : shirt.hi);
  }
}
function nordicYoke(R) { // islandströjans ok + band nedtill
  const { put, acc, ty0, ty1, K } = R; const a = xl(R), b = xr(R);
  for (let x = a + 1; x < b; x++) if (!(x & 1)) put(x, ty0, acc.base);
  for (let x = a; x <= b; x++) put(x, ty0 + 1, x === b ? acc.lo : acc.base);
  for (let x = a; x <= b; x++) if (x & 1) put(x, ty0 + 2, acc.lo);
  if (!K) for (let x = a + 1; x <= b; x += 4) put(x, ty0 + 3, acc.base);
  for (let x = a + 1; x < b; x += 2) put(x, ty1 - 2, acc.base);
}
function quilt(R) { // vadderade band var tredje rad
  const { ty0, shirt } = R;
  R.pattern(TAG.torso, (x, y, k) => (!onShirt(R, k) ? null : (y - ty0) % 3 === 2 ? far(shirt) : (y - ty0) % 3 === 0 && y > ty0 && x < 12 ? lighter(shirt) : null));
}
function furRow(R, a, b, y) { // pälskant: ljus/skuggad varannan pixel
  for (let x = a; x <= b; x++) R.put(x, y, (x + y) & 1 ? FUR.base : FUR.lo);
}

// ---------- hjälpare som posterna ovan använder ----------
function raglanFB(R) { // raglanärmarnas sneda axelsöm
  const { rect, acc, ty0 } = R; const a = xl(R), b = xr(R);
  for (let k = 0; k < 3; k++) {
    const l0 = a + (k === 0 ? 1 : 0), l1 = 9 - k, r0 = 14 + k, r1 = b - (k === 0 ? 1 : 0);
    if (l1 >= l0) rect(l0, ty0 + k, l1 - l0 + 1, 1, acc.base);
    if (r1 >= r0) rect(r0, ty0 + k, r1 - r0 + 1, 1, acc.lo);
  }
}
function tubeFB(R) { // tubtopp: axelraderna bar hud, resår i ljus ton
  const { rect, put, shirt, ty0, K } = R; const a = xl(R), b = xr(R), n = K ? 1 : 2;
  for (let j = 0; j < n; j++) skinRow(R, ty0 + j, j ? a : a + 1, j ? b : b - 1);
  rect(a, ty0 + n, b - a + 1, 1, shirt.hi); put(b, ty0 + n, shirt.base);
}
function offFB(R) { // off-shoulder: axelraden bar hud, volang under
  const { put, shirt, ty0 } = R; const a = xl(R), b = xr(R);
  skinRow(R, ty0, a + 1, b - 1);
  for (let x = a; x <= b; x++) put(x, ty0 + 1, x & 1 ? shirt.hi : shirt.lo);
}
function puff(R) { // puffärmar: en pixel bredare vid axeln när armarna hänger
  if (R.eat || R.carry) return;
  const { put, shirt, ty0, K } = R;
  if (R.side) { put(10, ty0 + 1, shirt.lo); put(14, ty0 + 1, shirt.hi); if (!K) put(14, ty0 + 2, shirt.base); return; }
  const a = xl(R) - 3, b = xr(R) + 3;
  put(a + 1, ty0, shirt.hi); put(b - 1, ty0, shirt.base);
  put(a, ty0 + 1, shirt.hi); put(b, ty0 + 1, shirt.lo);
  if (!K) { put(a, ty0 + 2, shirt.base); put(b, ty0 + 2, shirt.lo); }
}
function plaid(R) { // flanellrutor: linjer var tredje pixel, mörkare där de korsas
  const mid = between(R.shirt, R.acc, 0.55), y0 = R.ty0;
  return (x, y) => { const v = x % 3 === 1, h = (y - y0) % 3 === 2; return v && h ? R.acc : v || h ? mid : null; };
}
function tunicHem(R) { // broderi längs tunikans fåll
  const { put, acc, hy, K, sit } = R;
  const y = hy + hemRows(R, K ? 1 : 3) - 1;
  if (R.side) { for (let x = 9; x < 16; x += 2) put(x, y, acc.base); return; }
  for (let x = xl(R); x <= xr(R); x += 2) put(x, y, acc.base);
  if (!K && !sit) for (let x = xl(R) + 1; x <= xr(R); x += 2) put(x, y - 1, acc.lo);
}

Object.assign(TOP_REG, TOPS_NEW);

// ---------- tryck/mönster på överdelen (look.topPrint, färg look.print2 → R.print) ----------
// Ritas direkt efter bålens grundyta och FÖRE plaggets detaljer (krage, dragkedja …),
// med R.tag = TAG.torso. Enklast: R.pattern(TAG.torso, (x, y) => villkor ? R.print : null)
// – skuggningen (hi/base/lo/dk) följer med. Vill mönstret synas på ärmarna också:
// lägg samma sak i kroken afterArms(R) med TAG.sleeve.
//
// Två sorter: MÖNSTER (allover – bål, rockskört och ärmar, bara på tröjfärgade pixlar så att
// plaggens ärmar i andra färger och detaljer lämnas ifred) och MOTIV (en liten bild mitt på
// bröstet; siffror även på ryggen, en strimma av motivet syns från sidan).

// fasta tryckfärger
const RED = ramp(0xd83a3a), ORANGE = ramp(0xf08a24), YELLOW = ramp(0xf2c93a), GREEN = ramp(0x46a35a), BLUE = ramp(0x2f6fc8),
  PURPLE = ramp(0x8e5bd1), SE_BLUE = ramp(0x1f5aa6), SE_YELLOW = ramp(0xf2c318), BROWN = ramp(0x4a2c1c), PINK = ramp(0xf07aa8);
const RAINBOW = [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE];
const md = (a, n) => ((a % n) + n) % n;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// allover-mönster: fn(R) ger (x, yy) => ramp | null där yy = rad räknat från axelraden
function overall(label, fn) {
  const run = (R, tag) => { const f = fn(R), y0 = R.ty0; allOver(R, tag, (x, y) => f(x, y - y0)); };
  return { label, group: 'Mönster', front(R) { run(R, TAG.torso); }, back(R) { run(R, TAG.torso); }, side(R) { run(R, TAG.torso); }, afterArms(R) { run(R, TAG.sleeve); } };
}
// motivets bläck: x = tryckfärgen, o = mörk tryckfärg, w k y r g b = vitt/svart/gult/rött/grönt/blått, B Y = flaggans blå/gula
const INKS = { x: (R) => R.print, o: (R) => far(R.print), w: () => WHITE, k: () => INK, y: () => YELLOW, r: () => RED, g: () => GREEN, b: () => BLUE, B: () => SE_BLUE, Y: () => SE_YELLOW, p: () => PINK };
// stämpla en bild (rader av tecken) mitt på bröstet/ryggen – bara på bålens pixlar, tonen behålls
// (over = får även måla på plaggets detaljer – används för t-shirtens lilla bröstficka)
function stamp(R, bmp, dy = 0, over = false) {
  const h = bmp.length, w = bmp[0].length, x0 = 12 - (w >> 1) - (w & 1), y0 = R.ty0 + (R.K ? 1 : 2) + dy;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = bmp[j][i]; if (ch === '.') continue;
    const x = x0 + i, y = y0 + j, t = R.tagAt(x, y);
    if (t !== TAG.torso && !(over && t === TAG.top)) continue;
    R.put(x, y, INKS[ch](R)[toneOf(R.get(x, y), R.shirt) || 'base']);
  }
}
function motif(label, big, small, { back = false, hint = 'x' } = {}) {
  const pick = (R) => (R.K ? small : big);
  return {
    label, group: 'Tryck',
    front(R) { stamp(R, pick(R)); },
    // den vanliga t-shirten har en liten ficka på bröstet – trycket läggs ovanpå den
    afterTorso(R) { if (R.front && !R.K && R.id.top === 'tee') stamp(R, pick(R), 0, true); },
    back: back ? (R) => stamp(R, pick(R)) : undefined,
    side: hint ? (R) => { const y = R.ty0 + (R.K ? 2 : 3), c = INKS[hint](R); for (const yy of [y, y + 1]) if (R.tagAt(15, yy) === TAG.torso) R.put(15, yy, yy === y ? c.base : c.lo); } : undefined,
  };
}
// siffror 3×5 för tröjnummer
const DIGITS = {
  0: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], 1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'], 2: ['xxx', '..x', 'xxx', 'x..', 'xxx'],
  3: ['xxx', '..x', '.xx', '..x', 'xxx'], 5: ['xxx', 'x..', 'xxx', '..x', 'xxx'], 7: ['xxx', '..x', '.x.', '.x.', '.x.'], 9: ['xxx', 'x.x', 'xxx', '..x', 'xxx'],
};
const number = (s) => DIGITS[0].map((_, j) => [...s].map((d) => DIGITS[d][j]).join('.'));
function numberPrint(label, s) { const bmp = number(s); return motif(label, bmp, bmp, { back: true, hint: null }); }

export const TOP_PRINT_REG = {
  none: { label: 'Inget' },
  // ---------------- mönster ----------------
  thinStripes: overall('Tunna ränder', (R) => (x, yy) => (yy > 0 && yy % 2 === 0 ? R.print : null)),
  wideStripes: overall('Breda ränder', (R) => (x, yy) => (md(yy - 1, 4) >= 2 ? R.print : null)),
  pinstripe: overall('Kritstreck', (R) => (x) => (md(x, 3) === 0 ? R.print : null)),
  vStripes: overall('Lodränder', (R) => (x) => (md(x, 4) >= 2 ? R.print : null)),
  diagonal: overall('Snedränder', (R) => (x, yy) => (md(x + yy, 4) === 0 ? R.print : null)),
  rainbow: overall('Regnbåge', () => (x, yy) => (yy > 0 ? RAINBOW[md(yy - 1, 6)] : null)),
  gingham: overall('Gingham', (R) => { const mid = between(R.shirt, R.print); return (x, yy) => { const a = md(x >> 1, 2), b = md(yy >> 1, 2); return a && b ? R.print : a || b ? mid : null; }; }),
  checker: overall('Schackrutor', (R) => (x, yy) => (md((x >> 1) + (yy >> 1), 2) ? R.print : null)),
  tartan: overall('Skotskrutigt', (R) => { const mid = between(R.shirt, R.print, 0.45); return (x, yy) => { const v = md(x, 4) === 0, h = md(yy, 4) === 2; return v && h ? far(R.print) : v || h ? R.print : md(x, 4) === 2 && md(yy, 2) === 0 ? mid : null; }; }),
  argyle: overall('Argyle', (R) => { const mid = between(R.shirt, R.print, 0.5); return (x, yy) => { const u = md(x + (md(yy >> 2, 2) ? 2 : 0), 4) - 1.5, v = md(yy, 4) - 1.5; return Math.abs(u) + Math.abs(v) <= 1.5 ? R.print : md(x + yy, 4) === 0 ? mid : null; }; }),
  dots: overall('Prickar', (R) => (x, yy) => ((md(yy, 4) === 1 && md(x, 4) === 1) || (md(yy, 4) === 3 && md(x, 4) === 3) ? R.print : null)),
  hearts: overall('Hjärtan', (R) => (x, yy) => { const s = md(yy >> 2, 2) ? 2 : 0, u = md(x + s, 5), v = md(yy, 4); return (v === 0 && (u === 0 || u === 2)) || (v === 1 && u <= 2) || (v === 2 && u === 1) ? R.print : null; }),
  stars: overall('Stjärnor', (R) => (x, yy) => { const s = md(yy / 3 | 0, 2) ? 3 : 0, u = md(x + s, 6), v = md(yy, 6); return (u === 1 && v === 1) ? YELLOW : (Math.abs(u - 1) + Math.abs(v - 1) === 1) ? R.print : null; }),
  flowers: overall('Blommor', (R) => (x, yy) => { const u = md(x + (md(yy >> 2, 2) ? 2 : 0), 4), v = md(yy, 4); return u === 1 && v === 1 ? YELLOW : Math.abs(u - 1) + Math.abs(v - 1) === 1 ? R.print : null; }),
  xmas: overall('Julmönster', (R) => (x, yy) => (yy === 2 ? (md(x, 2) ? R.print : null) : yy === 3 ? R.print : yy === 4 ? (md(x, 2) ? null : R.print) : (yy === 1 || yy === 5) ? (md(x, 3) === 0 ? RED : null) : md(x, 4) === 1 && md(yy, 3) === 1 && yy > 5 ? WHITE : null)),
  camo: overall('Kamouflage', (R) => { const dark = far(R.print), mid = between(R.shirt, R.print, 0.5); return (x, yy) => { const h = hash((x + 1) >> 1, (yy + 7) >> 1) % 6; return h < 2 ? R.print : h === 2 ? dark : h === 3 ? mid : null; }; }),
  leopard: overall('Leopard', (R) => (x, yy) => { const u = md(x + (md(yy >> 2, 2) ? 2 : 0), 4), v = md(yy, 4); return u === 1 && v === 1 ? R.print : (u === 0 && v === 1) || (u === 1 && v === 0) || (u === 2 && v === 2) ? BROWN : null; }),
  zebra: overall('Zebra', (R) => (x, yy) => (md(x + [0, 1, 1, 0][md(yy, 4)] + (yy >> 2), 3) === 0 ? R.print : null)),
  tieDye: overall('Batik', (R) => { const mid = between(R.shirt, R.print, 0.5); return (x, yy) => { const dx = x - 11.5, dy = yy - 4, d = Math.floor(Math.hypot(dx, dy) * 0.8 + Math.atan2(dy, dx) * 0.95 + 20); return md(d, 3) === 0 ? R.print : md(d, 3) === 1 ? mid : null; }; }),
  ombre: overall('Tonad', (R) => { const a = between(R.shirt, R.print, 0.35), b = between(R.shirt, R.print, 0.7); return (x, yy) => { const t = yy / (R.K ? 6 : 9); return t > 0.75 ? R.print : t > 0.5 ? b : t > 0.25 ? a : null; }; }),
  twoTone: overall('Tvåfärgad', (R) => (x) => ((R.side ? x >= 13 : R.back ? x < 12 : x >= 12) ? R.print : null)),
  splatter: overall('Färgstänk', (R) => (x, yy) => { const h = hash(x, yy + 3) % 9; return h === 0 ? R.print : h === 1 ? far(R.print) : h === 2 ? YELLOW : null; }),
  flames: overall('Flammor', (R) => { // lågorna slår upp från plaggets nederkant (även rockskört)
    const H = R.K ? [2, 4, 3, 5, 2, 3] : [3, 6, 4, 7, 3, 5]; let low = R.ty1 - 1;
    R.each(TAG.torso, (x, y) => { if (y > low) low = y; });
    const bottom = low - R.ty0;
    return (x, yy) => { const d = bottom - yy, h = H[md(x, 6)]; return d < h - 3 ? YELLOW : d < h - 1 ? ORANGE : d < h ? R.print : null; }; }),

  // ---------------- motiv ----------------
  star: motif('Stjärna', ['..x..', 'xxxxx', '.xxx.', '.x.x.', 'x...x'], ['..x..', 'xxxxx', '.xxx.', '.x.x.']),
  heart: motif('Hjärta', ['wx.xx', 'xxxxx', 'xxxxx', '.xxx.', '..x..'], ['xx.xx', 'xxxxx', '.xxx.', '..x..']),
  bolt: motif('Blixt', ['..xx', '.xx.', 'xxxx', '.xx.', 'xx..'], ['..x', '.xx', 'xx.', 'x..']),
  skull: motif('Döds­skalle', ['.xxx.', 'xxxxx', 'xkxkx', 'xxxxx', '.x.x.'], ['.xxx.', 'xkxkx', 'xxxxx', '.x.x.']),
  cat: motif('Katt', ['x...x', 'xxxxx', 'xkxkx', 'xxrxx', '.xxx.'], ['x...x', 'xxxxx', 'xkxkx', '.xrx.']),
  smiley: motif('Smiley', ['.xxx.', 'xkxkx', 'xxxxx', 'xkkkx', '.xxx.'], ['.xxx.', 'xkxkx', 'xkkkx', '.xxx.']),
  alien: motif('Rymd­varelse', ['x...x', '.xxx.', 'xkxkx', 'xxxxx', 'x.x.x'], ['.xxx.', 'xkxkx', 'xxxxx', 'x.x.x']),
  paw: motif('Tass', ['.x.x.', 'x...x', '.xxx.', 'xxxxx', '.xxx.'], ['.x.x.', 'x...x', '.xxx.', '.xxx.']),
  crown: motif('Krona', ['x.x.x', 'xxxxx', 'xrxbx', 'xxxxx'], ['x.x.x', 'xxxxx', 'xrxbx', 'xxxxx']),
  note: motif('Musik­not', ['..xx', '..xo', '..x.', 'xxx.', 'xx..'], ['..xx', '..x.', 'xxx.', 'xx..']),
  letterS: motif('Bokstav S', ['.xxxo', 'x...o', '.xxx.', 'o...x', 'oxxx.'], ['xxx', 'x..', 'xxx', '..x', 'xxx']),
  pixelLogo: motif('Pixel­logga', ['rryy', 'rryy', 'ggbb', 'ggbb'], ['ry', 'gb'], { hint: 'r' }),
  flagSE: motif('Svenska flaggan', ['BBYBBB', 'BBYBBB', 'YYYYYY', 'BBYBBB', 'BBYBBB'], ['BYBBB', 'YYYYY', 'BYBBB', 'BYBBB'], { hint: 'B' }),
  num7: numberPrint('Nummer 7', '7'),
  num10: numberPrint('Nummer 10', '10'),
  num23: numberPrint('Nummer 23', '23'),
  num99: numberPrint('Nummer 99', '99'),
};
