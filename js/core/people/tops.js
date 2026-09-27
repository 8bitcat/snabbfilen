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

// ---------- tryck/mönster på överdelen (look.topPrint, färg look.print2 → R.print) ----------
// Ritas direkt efter bålens grundyta och FÖRE plaggets detaljer (krage, dragkedja …),
// med R.tag = TAG.torso. Enklast: R.pattern(TAG.torso, (x, y) => villkor ? R.print : null)
// – skuggningen (hi/base/lo/dk) följer med. Vill mönstret synas på ärmarna också:
// lägg samma sak i kroken afterArms(R) med TAG.sleeve.
export const TOP_PRINT_REG = {
  none: { label: 'Inget' },
};
