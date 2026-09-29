// Nya frisyrer: kort hår och rakat/snaggat. Samlas i HAIR_REG av hair.js.
// Varje post byggs med hs(label, grupp, { front, back, side }) – hs klipper frisyren
// under täckande huvudbonader (se hair-kit.js). Id:n får aldrig byta namn efter släpp.
import { hs, capF, backShort, sideTop, sideStd, shaved, nz, col, mask, paint } from './hair-kit.js';

// kort kalott utan lugg: hjässan + rows rader (framifrån/bakifrån)
export const topF = (R, rows = 2) => {
  const { rect, put, hair: H, h0 } = R;
  rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, rows, H.base);
  rect(9, h0 - 1, 3, 1, H.hi); rect(8, h0, 2, 1, H.hi);
  for (let j = 0; j < rows; j++) put(16, h0 + j, H.lo);
};
// rakad nacke bakifrån från rad y0 (nackens sista rad smalare)
export const shavedBack = (R, y0) => {
  const { rect, h0, headH } = R, s = shaved(R), y1 = h0 + headH - 4;
  if (y1 > y0) rect(7, y0, 10, y1 - y0, s.a);
  rect(8, y1, 8, 1, s.a);
  col(R, 16, y0, y1 - 1, s.b);
};
// rakad bakre del av skallen från sidan (bakom örat), rad y0 … nacken
export const shavedSide = (R, y0) => { const s = shaved(R); R.rect(8, y0, 3, R.h0 + 7 - y0, s.a); R.put(8, R.h0 + 6, s.b); };
// rakade tinningar framifrån (x 7 och 16), rad y0 … y1
export const shavedTemples = (R, y0, y1) => { const s = shaved(R); col(R, 7, y0, y1, s.a); col(R, 16, y0, y1, s.b); };
// snaggat (som 'buzz', men egna – de gamla är låsta)
export const buzzF = (R) => { const { rect, hair: H, h0 } = R, s = shaved(R); rect(8, h0, 8, 1, H.lo); rect(7, h0 + 1, 10, 2, s.a); rect(7, h0 + 3, 1, 2, s.a); rect(16, h0 + 1, 1, 4, s.b); };
export const buzzS = (R) => { const { rect, hair: H, h0 } = R, s = shaved(R); rect(9, h0, 7, 1, H.lo); rect(8, h0 + 1, 8, 2, s.a); rect(8, h0 + 3, 3, 4, s.a); };
export const buzzB = (R) => { const { rect, hair: H, h0, headH } = R, s = shaved(R); rect(8, h0, 8, 1, H.lo); rect(7, h0 + 1, 10, headH - 4, s.a); col(R, 16, h0 + 1, h0 + headH - 4, s.b); };
// punktagg: 2 px bred nertill, 1 px i spetsen
export const spike = (R, x, y0, tip, c) => { for (let y = y0; y >= tip; y--) R.rect(x, y, y - tip >= 2 ? 2 : 1, 1, c); };

export const HAIR_KORT = {
  // ================= Kort hår =================
  crew: hs('Kort­klippt', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; topF(R, 2);
      rect(8, h0 + 2, 8, 1, H.base); put(10, h0 + 2, H.lo); put(13, h0 + 2, H.lo); put(15, h0 + 2, H.lo);
      shavedTemples(R, h0 + 2, h0 + 4); },
    back(R) { topF(R, 2); shavedBack(R, R.h0 + 2); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(9, h0 - 1, 7, 1, H.base); rect(8, h0, 9, 2, H.base); rect(10, h0 - 1, 3, 1, H.hi); put(9, h0, H.hi);
      rect(13, h0 + 2, 4, 1, H.base); put(16, h0 + 2, H.lo); rect(8, h0 + 2, 5, 1, s.a); shavedSide(R, h0 + 3); put(13, h0 + 3, s.a); put(13, h0 + 4, s.a); },
  }),
  crop: hs('Fransk crop', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3);
      rect(8, h0 + 3, 8, 1, H.base); for (const x of [9, 12, 14]) put(x, h0 + 3, H.lo);
      put(11, h0, H.lo); put(14, h0 + 1, H.lo); put(10, h0 + 2, H.lo); put(13, h0 - 1, H.hi); put(12, h0 + 1, H.hi);
      shavedTemples(R, h0 + 3, h0 + 5); },
    back(R) { const { put, hair: H, h0 } = R; topF(R, 3); put(10, h0 + 1, H.lo); put(13, h0, H.lo); shavedBack(R, h0 + 3); },
    side(R) { const { put, hair: H, h0 } = R, s = shaved(R); sideTop(R);
      put(15, h0 + 3, H.base); put(16, h0 + 3, H.lo); put(12, h0, H.lo); put(14, h0 + 1, H.hi); put(10, h0 + 2, s.a);
      shavedSide(R, h0 + 3); put(13, h0 + 3, s.a); put(13, h0 + 4, s.a); },
  }),
  quiff: hs('Quiff', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; topF(R, 2);
      rect(9, h0 - 3, 5, 1, H.base); rect(8, h0 - 2, 7, 1, H.base);
      rect(9, h0 - 3, 2, 1, H.hi); put(8, h0 - 2, H.hi); put(13, h0 - 3, H.lo); put(14, h0 - 2, H.lo); put(15, h0 - 1, H.lo);
      put(11, h0 - 2, H.lo); put(12, h0 - 1, H.lo); put(10, h0 - 1, H.hi);
      put(8, h0 + 2, H.base); put(15, h0 + 2, H.lo); shavedTemples(R, h0 + 2, h0 + 4); },
    back(R) { const { rect, put, hair: H, h0 } = R; rect(9, h0 - 3, 5, 1, H.base); rect(8, h0 - 2, 7, 1, H.base); put(9, h0 - 3, H.hi); put(14, h0 - 2, H.lo);
      topF(R, 2); shavedBack(R, h0 + 2); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(12, h0 - 3, 4, 1, H.base); rect(11, h0 - 2, 7, 1, H.base); rect(9, h0 - 1, 9, 1, H.base); rect(8, h0, 9, 2, H.base);
      rect(12, h0 - 3, 3, 1, H.hi); put(11, h0 - 2, H.hi); put(10, h0 - 1, H.hi); put(9, h0, H.hi);
      put(17, h0 - 1, H.lo); put(16, h0, H.lo); put(15, h0 - 1, H.lo); put(14, h0 - 2, H.lo);
      rect(8, h0 + 2, 4, 1, s.a); shavedSide(R, h0 + 3); put(13, h0 + 2, s.a); put(13, h0 + 3, s.a); },
  }),
  pompadour: hs('Pompa­dour', 'Kort hår', {
    front(R) { const { put, hair: H, h0 } = R;
      const m = mask().rows([[h0 - 4, 9, 14], [h0 - 3, 8, 15], [h0 - 2, 7, 16], [h0 - 1, 7, 16], [h0, 7, 16], [h0 + 1, 7, 8], [h0 + 1, 15, 16]]).col(7, h0 + 2, h0 + 4).col(16, h0 + 2, h0 + 4);
      paint(R, m);
      for (let x = 9; x <= 14; x++) put(x, h0 - 1, H.lo); // rullens undersida
      put(9, h0 - 3, H.hi); put(10, h0 - 3, H.hi); put(8, h0 - 2, H.hi); put(12, h0 - 2, H.hi); put(13, h0 - 3, H.base);
      put(8, h0 + 1, H.lo); put(15, h0 + 1, H.lo); },
    back(R) { const { put, hair: H, h0 } = R; const m = mask().rows([[h0 - 4, 9, 14], [h0 - 3, 8, 15], [h0 - 2, 7, 16]]);
      backShort(R); paint(R, m); for (let y = h0 + 1; y < h0 + R.headH - 4; y++) for (const x of [9, 12, 15]) put(x, y, H.lo); },
    side(R) { const { put, hair: H, h0 } = R;
      const m = mask().rows([[h0 - 4, 11, 15], [h0 - 3, 10, 17], [h0 - 2, 9, 17], [h0 - 1, 8, 17], [h0, 8, 16], [h0 + 1, 8, 15], [h0 + 2, 8, 12]]).rect(8, h0 + 3, 3, 4);
      paint(R, m);
      for (let x = 14; x <= 17; x++) put(x, h0 - 1, H.lo); put(16, h0, H.dk);
      put(12, h0 - 3, H.hi); put(13, h0 - 3, H.hi); put(11, h0 - 2, H.hi);
      for (let y = h0 + 1; y < h0 + 7; y++) put(9, y, H.lo); },
  }),
  slick: hs('Bakåt­slickat', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; topF(R, 2);
      rect(10, h0 - 1, 4, 1, H.hi); put(9, h0, H.hi); put(12, h0, H.hi); // blankt
      put(8, h0 + 1, H.lo); put(15, h0 + 1, H.lo); put(11, h0 + 1, H.lo);
      col(R, 7, h0 + 2, h0 + 4, H.lo); col(R, 16, h0 + 2, h0 + 4, H.dk); },
    back(R) { const { put, hair: H, h0 } = R; backShort(R); for (let y = h0 + 1; y < h0 + R.headH - 4; y++) for (const x of [9, 12, 15]) put(x, y, H.lo); put(10, h0, H.hi); put(10, h0 + 1, H.hi); },
    side(R) { const { rect, put, hair: H, h0 } = R; sideTop(R); rect(8, h0 + 3, 3, 4, H.base);
      for (let x = 9; x <= 15; x += 2) put(x, h0 + 1, H.lo); for (let x = 10; x <= 14; x += 2) put(x, h0 + 2, H.lo);
      rect(11, h0 - 1, 3, 1, H.hi); put(15, h0 + 2, H.lo); put(16, h0 + 2, H.lo); put(8, h0 + 6, H.lo); },
  }),
  messy: hs('Rufsigt', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3);
      put(9, h0 - 2, H.hi); put(12, h0 - 2, H.base); put(13, h0 - 3, H.base); put(15, h0 - 2, H.lo); put(7, h0 - 1, H.base); put(6, h0 + 1, H.base); put(17, h0 + 1, H.lo); put(16, h0 - 1, H.lo);
      rect(7, h0 + 3, 1, 3, H.base); put(6, h0 + 4, H.base); rect(16, h0 + 3, 1, 3, H.lo); put(17, h0 + 3, H.lo);
      for (const [x, y] of [[8, 3], [9, 3], [11, 3], [13, 3], [14, 3], [9, 4], [13, 4]]) put(x, h0 + y, y === 4 ? H.lo : H.base);
      put(10, h0, H.lo); put(13, h0 + 1, H.lo); put(9, h0 + 2, H.lo); put(14, h0 + 2, H.lo); put(11, h0 + 1, H.hi); },
    back(R) { const { put, hair: H, h0 } = R; const b = backShort(R);
      put(9, h0 - 2, H.base); put(12, h0 - 2, H.base); put(14, h0 - 2, H.lo); put(6, h0 + 2, H.base); put(17, h0 + 4, H.lo); put(7, h0 - 1, H.base);
      for (const x of [8, 10, 13, 15]) put(x, b, H.lo); put(10, h0 + 2, H.lo); put(13, h0 + 4, H.lo); put(11, h0 + 1, H.hi); },
    side(R) { const { put, hair: H, h0 } = R; sideStd(R);
      put(11, h0 - 2, H.base); put(14, h0 - 2, H.base); put(13, h0 - 3, H.hi); put(9, h0 - 1, H.base); put(7, h0 + 1, H.base); put(7, h0 + 4, H.lo); put(17, h0 + 2, H.base); put(17, h0 + 3, H.lo);
      put(9, h0 + 7, H.lo); put(15, h0 + 4, H.base); put(12, h0 + 1, H.lo); put(10, h0 + 4, H.lo); },
  }),
  flatTop: hs('Flat top', 'Kort hår', {
    front(R) { const { rect, hair: H, h0 } = R;
      rect(8, h0 - 4, 8, 6, H.base); rect(8, h0 - 4, 7, 1, H.hi); R.put(15, h0 - 4, H.base); col(R, 15, h0 - 3, h0 + 1, H.lo); col(R, 8, h0 - 3, h0 - 1, H.hi);
      rect(9, h0 + 1, 6, 1, H.lo); shavedTemples(R, h0, h0 + 4); },
    back(R) { const { rect, put, hair: H, h0 } = R; rect(8, h0 - 4, 8, 5, H.base); rect(8, h0 - 4, 7, 1, H.hi); col(R, 15, h0 - 3, h0, H.lo); col(R, 8, h0 - 3, h0 - 1, H.hi); rect(9, h0, 6, 1, H.lo); put(8, h0, H.lo); shavedBack(R, h0 + 1); shavedTemples(R, h0, h0); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(9, h0 - 4, 8, 5, H.base); rect(9, h0 - 4, 8, 1, H.hi); col(R, 9, h0 - 3, h0, H.lo); rect(13, h0 + 1, 4, 1, H.base); put(16, h0 + 1, H.lo); put(16, h0, H.lo);
      put(8, h0, s.a); rect(8, h0 + 1, 5, 1, s.a); shavedSide(R, h0 + 2); put(13, h0 + 2, s.a); put(13, h0 + 3, s.a); },
  }),
  bowl: hs('Potta', 'Kort hår', {
    front(R) { const { put, hair: H, h0 } = R;
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 7, 16]]).rect(6, h0, 12, 4).rect(6, h0 + 4, 2, 2).rect(16, h0 + 4, 2, 2);
      paint(R, m); for (let x = 8; x <= 15; x++) put(x, h0 + 3, H.lo); put(10, h0 + 1, H.lo); put(13, h0 + 2, H.lo); },
    back(R) { const m = mask().rows([[R.h0 - 2, 9, 14], [R.h0 - 1, 7, 16]]).rect(6, R.h0, 12, R.headH - 3); paint(R, m); },
    side(R) { const { put, hair: H, h0 } = R;
      const m = mask().rows([[h0 - 2, 10, 14], [h0 - 1, 8, 16]]).rect(7, h0, 11, 4).rect(7, h0 + 4, 4, R.K ? 2 : 3);
      paint(R, m); put(17, h0 + 3, H.lo); put(16, h0 + 3, H.lo); put(15, h0 + 3, H.lo); put(13, h0 + 1, H.lo); },
  }),
  pixie: hs('Pixie', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3);
      rect(8, h0 + 3, 6, 1, H.base); rect(8, h0 + 4, 3, 1, H.base); if (!R.K) put(8, h0 + 5, H.lo); put(10, h0 + 4, H.lo); put(13, h0 + 3, H.lo);
      put(10, h0 + 1, H.lo); put(11, h0 + 2, H.lo); put(13, h0, H.hi);
      col(R, 7, h0 + 3, h0 + 6, H.base); put(7, h0 + 6, H.lo); col(R, 16, h0 + 3, h0 + 5, H.lo); },
    back(R) { const { put, hair: H } = R; const b = backShort(R); put(11, b, H.lo); put(12, b, H.lo); put(11, b + 1, H.dk); },
    side(R) { const { rect, put, hair: H, h0 } = R; sideStd(R);
      rect(14, h0 + 3, 3, 1, H.base); put(16, h0 + 4, H.base); put(15, h0 + 4, H.lo); col(R, 13, h0 + 3, h0 + 5, H.base); put(13, h0 + 5, H.lo); put(8, h0 + 7, H.lo); put(12, h0 + 1, H.lo); },
  }),
  tuft: hs('Kalufs', 'Kort hår', {
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3);
      col(R, 7, h0 + 3, h0 + 5, H.base); col(R, 16, h0 + 3, h0 + 5, H.lo); rect(8, h0 + 3, 2, 1, H.base); put(14, h0 + 3, H.lo); put(15, h0 + 3, H.base);
      put(11, h0 - 2, H.hi); put(12, h0 - 2, H.base); put(12, h0 - 3, H.hi); put(13, h0 - 3, H.base); put(13, h0 - 4, H.base); put(14, h0 - 4, H.lo); },
    back(R) { const { put, hair: H, h0 } = R; backShort(R); put(12, h0 - 2, H.base); put(11, h0 - 3, H.base); put(11, h0 - 4, H.lo); },
    side(R) { const { put, hair: H, h0 } = R; sideStd(R);
      put(14, h0 - 2, H.base); put(15, h0 - 2, H.hi); put(15, h0 - 3, H.base); put(16, h0 - 3, H.hi); put(16, h0 - 4, H.base); put(17, h0 - 4, H.lo); },
  }),

  hardPart: hs('Rakad bena', 'Kort hår', {
    // kort sidbena med en rakad linje på personens högra sida (framifrån bildens vänstra),
    // håret svept åt andra hållet, tonade tinningar
    front(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, 2, H.base); rect(11, h0 - 2, 4, 1, H.base);
      rect(11, h0 - 2, 2, 1, H.hi); rect(10, h0 - 1, 3, 1, H.hi); put(8, h0, H.hi); put(14, h0 - 2, H.lo); put(15, h0 - 1, H.lo); col(R, 16, h0, h0 + 1, H.lo);
      shavedTemples(R, h0 + 2, h0 + 4); put(8, h0 + 2, s.a);
      rect(10, h0 + 2, 6, 1, H.base); put(12, h0 + 1, H.lo); put(14, h0 + 2, H.lo); put(15, h0 + 2, H.lo); put(16, h0 + 2, H.lo);
      col(R, 9, h0 - 1, h0 + 1, s.f); },
    back(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R); topF(R, 2); rect(9, h0 - 2, 4, 1, H.base); put(9, h0 - 2, H.hi); put(12, h0 - 2, H.lo);
      shavedBack(R, h0 + 2); col(R, 14, h0 - 1, h0 + 1, s.f); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(9, h0 - 1, 7, 1, H.base); rect(8, h0, 9, 2, H.base); rect(10, h0 - 1, 3, 1, H.hi); put(9, h0, H.hi);
      if (R.flip) { // vänster sida: det svepta håret, ingen bena
        rect(10, h0 - 2, 5, 1, H.base); put(10, h0 - 2, H.hi); put(11, h0 - 2, H.hi); put(15, h0 - 1, H.lo);
        rect(13, h0 + 2, 4, 1, H.base); put(16, h0 + 2, H.lo); put(16, h0 + 3, H.lo); put(12, h0 + 1, H.lo);
      } else { rect(10, h0, 7, 1, s.f); put(16, h0 + 1, H.lo); put(15, h0 + 2, H.base); put(16, h0 + 2, H.lo); }
      rect(8, h0 + 2, 5, 1, s.a); shavedSide(R, h0 + 3); put(13, h0 + 3, s.a); put(13, h0 + 4, s.a); },
  }),

  // ================= Rakat & snaggat =================
  undercut: hs('Undercut', 'Rakat', {
    front(R) { const { put, hair: H, h0 } = R, s = shaved(R);
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 8, 16], [h0, 8, 17], [h0 + 1, 11, 17], [h0 + 2, 14, 17], [h0 + 3, 16, 17]]);
      paint(R, m, { split: 99 }); for (const [x, y] of [[10, 0], [12, 1], [14, 2], [11, -1], [13, 0]]) put(x, h0 + y, H.lo); put(17, h0 + 3, H.dk);
      put(7, h0, s.a); col(R, 7, h0 + 1, h0 + 5, s.a); put(8, h0 + 1, s.a); col(R, 16, h0 + 4, h0 + 5, s.b); },
    back(R) { const { put, hair: H, h0 } = R; const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 8, 16], [h0, 7, 16], [h0 + 1, 7, 17]]); paint(R, m);
      put(6, h0 + 1, H.lo); for (const x of [9, 12, 15]) put(x, h0, H.lo); shavedBack(R, h0 + 2); },
    side(R) { const { put, hair: H, h0 } = R, s = shaved(R);
      const m = mask().rows([[h0 - 2, 10, 15], [h0 - 1, 9, 17], [h0, 8, 17], [h0 + 1, 9, 17], [h0 + 2, 15, 17]]);
      paint(R, m); for (const x of [11, 13, 15]) put(x, h0, H.lo); put(16, h0 + 2, H.dk); put(17, h0 + 1, H.lo);
      put(8, h0 + 1, s.a); R.rect(8, h0 + 2, 6, 1, s.a); shavedSide(R, h0 + 3); put(13, h0 + 3, s.a); },
  }),
  sidecut: hs('Sidecut', 'Rakat', {
    // höger sida (framifrån bildens vänstra) rakad, resten långt och lagt åt andra hållet
    front(R) { const { rect, put, hair: H, h0, headH, K } = R, s = shaved(R), end = h0 + headH + (K ? 2 : 3);
      rect(10, h0 - 1, 6, 1, H.base); rect(9, h0, 8, 3, H.base); rect(11, h0 + 3, 5, 1, H.base); put(15, h0 + 4, H.lo);
      rect(10, h0 - 1, 2, 1, H.hi); put(9, h0, H.hi); put(12, h0 + 1, H.lo); put(14, h0 + 2, H.lo);
      rect(16, h0 + 1, 2, end - h0 - 1, H.lo); col(R, 18, h0 + 4, end - 1, H.dk); put(16, end - 1, H.dk);
      rect(7, h0, 2, 1, s.a); col(R, 7, h0 + 1, h0 + 5, s.a); col(R, 8, h0 + 1, h0 + 2, s.a); put(8, h0 - 1, s.a); },
    back(R) { const { rect, hair: H, h0, headH, K } = R, s = shaved(R), end = h0 + headH + (K ? 2 : 3);
      rect(8, h0 - 1, 6, 1, H.base); rect(6, h0, 9, end - h0, H.base); rect(8, h0 - 1, 3, 1, H.hi); rect(6, end - 1, 9, 1, H.lo); col(R, 5, h0 + 4, end - 1, H.lo);
      col(R, 14, h0, end - 2, H.lo); rect(15, h0, 2, headH - 4, s.a); col(R, 16, h0 + 1, h0 + headH - 5, s.b); R.put(14, h0 - 1, s.a); },
    side(R) { const { rect, put, hair: H, h0, headH, K } = R, s = shaved(R);
      if (R.flip) { // vänstervyn: den långa sidan
        sideStd(R, false); rect(7, h0 + 1, 5, headH + (K ? 1 : 2), H.base); col(R, 7, h0 + 1, h0 + headH + (K ? 1 : 2), H.lo); put(11, h0 + headH + (K ? 1 : 2), H.lo);
        rect(12, h0 + 3, 4, 1, H.base); put(13, h0 + 4, H.lo); return; }
      rect(9, h0 - 1, 7, 1, H.base); rect(10, h0, 7, 2, H.base); rect(10, h0 - 1, 3, 1, H.hi); put(16, h0 + 2, H.base); put(15, h0 + 2, H.lo);
      rect(8, h0, 2, 2, s.a); rect(8, h0 + 2, 7, 1, s.a); shavedSide(R, h0 + 3); col(R, 13, h0 + 3, h0 + 5, s.a); },
  }),
  buzzLines: hs('Snaggat med ränder', 'Rakat', {
    front(R) { const { put, skin, h0 } = R; buzzF(R); put(7, h0 + 2, skin.hi); put(8, h0 + 1, skin.hi); put(16, h0 + 2, skin.base); put(15, h0 + 1, skin.base); },
    back(R) { const { put, skin, h0 } = R; buzzB(R);
      for (const d of [0, 2]) { put(8, h0 + 4 + d, skin.hi); put(9, h0 + 3 + d, skin.hi); put(15, h0 + 4 + d, skin.base); put(14, h0 + 3 + d, skin.base); } },
    side(R) { const { put, skin, h0 } = R; buzzS(R);
      for (const [x, y] of [[8, 4], [9, 3], [10, 2], [11, 2], [12, 1], [13, 1], [8, 6], [9, 5], [10, 4]]) put(x, h0 + y, skin.hi); },
  }),
  buzzZig: hs('Snaggat med blixt', 'Rakat', {
    front(R) { const { put, skin, h0 } = R; buzzF(R); put(7, h0 + 1, skin.hi); put(7, h0 + 3, skin.hi); put(16, h0 + 1, skin.base); put(16, h0 + 3, skin.base); },
    back(R) { const { put, skin, h0 } = R; buzzB(R);
      for (let i = 0; i < 9; i++) put(8 + i, h0 + 4 + (i % 4 === 1 ? -1 : i % 4 === 3 ? 1 : 0), i > 4 ? skin.base : skin.hi); },
    side(R) { const { put, skin, h0 } = R; buzzS(R);
      for (const [x, y] of [[13, 1], [12, 1], [11, 2], [12, 3], [11, 3], [10, 4], [9, 5], [9, 4]]) put(x, h0 + y, skin.hi); },
  }),
  baldStubble: hs('Flint med stubb', 'Rakat', {
    front(R) { const { put, skin, h0, eyeRow } = R, s = shaved(R);
      for (let y = h0; y < eyeRow; y++) for (let x = 7; x <= 16; x++) {
        const edge = (x === 7 || x === 16) && y >= eyeRow - 3, top = y <= h0 + 1 && x >= 8 && x <= 15;
        if (edge || top) put(x, y, nz(x, y, 5) < 26 ? s.d : s.s);
      }
      put(10, h0 + 1, skin.hi); put(11, h0 + 1, skin.hi); },
    back(R) { const { put, skin, h0, headH } = R, s = shaved(R);
      for (let y = h0; y < h0 + headH - 3; y++) for (let x = 7; x <= 16; x++) { if (y === h0 && (x < 8 || x > 15)) continue; put(x, y, nz(x, y, 6) < 26 ? s.d : s.s); }
      put(10, h0 + 1, skin.hi); },
    side(R) { const { put, skin, h0 } = R, s = shaved(R);
      for (let y = h0; y < h0 + 7; y++) for (let x = 8; x <= 15; x++) { if (y === h0 && (x < 9 || x > 14)) continue; if (y > h0 + 1 && x > 10) continue; put(x, y, nz(x, y, 7) < 26 ? s.d : s.s); }
      put(13, h0 + 1, skin.hi); put(12, h0 + 1, skin.hi); },
  }),
  horseshoe: hs('Hårkrans', 'Rakat', {
    front(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R;
      rect(6, eyeRow - 3, 2, 3, H.base); put(5, eyeRow - 2, H.base); put(6, eyeRow - 3, H.hi); put(7, eyeRow - 1, H.lo);
      rect(16, eyeRow - 3, 2, 3, H.lo); put(18, eyeRow - 2, H.lo); put(17, eyeRow - 1, H.dk);
      put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); put(10, h0 + 2, skin.hi); },
    back(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R;
      const b = h0 + R.headH - 3; rect(6, eyeRow - 3, 12, b - eyeRow + 2, H.base); rect(7, b - 1, 10, 1, H.base); put(5, eyeRow - 2, H.base); put(18, eyeRow - 2, H.lo); rect(8, b - 1, 8, 1, H.lo);
      put(6, eyeRow - 3, H.hi); put(7, eyeRow - 3, H.hi); col(R, 17, eyeRow - 3, b - 2, H.lo); for (const x of [9, 12, 15]) put(x, eyeRow - 2, H.lo); put(8, eyeRow - 3, H.hi);
      put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); },
    side(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R;
      rect(8, eyeRow - 3, 3, 5, H.base); put(7, eyeRow - 2, H.base); rect(11, eyeRow - 3, 3, 1, H.base); put(13, eyeRow - 2, H.lo); col(R, 8, eyeRow - 2, eyeRow + 1, H.lo); put(10, eyeRow + 1, H.lo);
      put(12, h0 + 1, skin.hi); put(13, h0 + 1, skin.hi); },
  }),
  fauxhawk: hs('Faux­hawk', 'Rakat', {
    front(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(8, h0, 2, 2, s.a); rect(14, h0, 2, 2, s.b); shavedTemples(R, h0 + 1, h0 + 4); put(7, h0, s.a); put(16, h0, s.b);
      rect(10, h0 - 2, 4, 4, H.base); rect(9, h0 - 1, 6, 1, H.base); put(11, h0 - 3, H.hi); put(12, h0 - 3, H.base); put(12, h0 - 4, H.base);
      put(10, h0 - 2, H.hi); put(10, h0 - 1, H.hi); put(13, h0 - 2, H.lo); put(14, h0 - 1, H.lo); put(13, h0, H.lo); put(11, h0 + 2, H.base); put(12, h0 + 2, H.lo); },
    back(R) { const { rect, put, hair: H, h0, headH } = R, s = shaved(R);
      rect(7, h0, 10, headH - 3, s.a); col(R, 16, h0, h0 + headH - 4, s.b);
      rect(10, h0 - 2, 4, headH - 3, H.base); col(R, 13, h0 - 1, h0 + headH - 6, H.lo); put(10, h0 - 2, H.hi); put(11, h0 - 3, H.hi); put(12, h0 - 4, H.base); put(12, h0 - 3, H.base); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(9, h0 - 1, 7, 2, H.base); rect(10, h0 - 2, 6, 1, H.base); put(11, h0 - 3, H.base); put(13, h0 - 3, H.hi); put(15, h0 - 3, H.base); put(14, h0 - 4, H.base); put(16, h0 - 2, H.base);
      put(10, h0 - 2, H.hi); put(12, h0 - 2, H.hi); put(16, h0, H.lo);
      put(8, h0, s.a); rect(8, h0 + 1, 8, 1, s.a); put(16, h0 + 1, H.lo); rect(8, h0 + 2, 5, 1, s.a); shavedSide(R, h0 + 3); },
  }),
  punk: hs('Punk­taggar', 'Rakat', {
    front(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      shavedTemples(R, h0 + 1, h0 + 4); rect(8, h0, 8, 1, H.lo); put(7, h0, s.a); put(16, h0, s.b);
      spike(R, 11, h0 - 1, h0 - 5, H.base); put(11, h0 - 5, H.hi); put(11, h0 - 4, H.hi); put(12, h0 - 2, H.lo);
      spike(R, 9, h0 - 1, h0 - 4, H.base); put(9, h0 - 4, H.hi); put(9, h0 - 3, H.hi);
      spike(R, 13, h0 - 1, h0 - 4, H.lo); put(14, h0 - 1, H.dk);
      put(7, h0 - 1, H.base); put(6, h0 - 2, H.hi); put(8, h0 - 1, H.base); put(16, h0 - 1, H.lo); put(17, h0 - 2, H.lo); put(15, h0 - 1, H.lo); },
    back(R) { const { rect, put, hair: H, h0, headH } = R, s = shaved(R);
      rect(7, h0 + 1, 10, headH - 4, s.a); col(R, 16, h0 + 1, h0 + headH - 4, s.b); rect(8, h0, 8, 1, H.lo); rect(10, h0 + 1, 4, headH - 5, H.lo); col(R, 10, h0 + 1, h0 + headH - 5, H.base);
      spike(R, 11, h0 - 1, h0 - 5, H.base); spike(R, 9, h0 - 1, h0 - 4, H.base); spike(R, 13, h0 - 1, h0 - 4, H.lo);
      put(7, h0 - 1, H.base); put(6, h0 - 2, H.base); put(16, h0 - 1, H.lo); put(17, h0 - 2, H.lo); put(8, h0 - 1, H.base); put(15, h0 - 1, H.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      put(8, h0, s.a); rect(8, h0 + 1, 8, 1, s.a); rect(8, h0 + 2, 5, 1, s.a); shavedSide(R, h0 + 3); rect(9, h0, 7, 1, H.lo);
      // taggarna lutar bakåt
      for (const [x, tip] of [[9, 3], [11, 5], [13, 5], [15, 4]]) {
        rect(x, h0 - 1, 2, 1, H.base);
        for (let k = 2; k <= tip; k++) put(x - (k >> 1) + 1, h0 - k, k === tip ? H.hi : H.base);
      }
      put(16, h0, H.lo); },
  }),
};
