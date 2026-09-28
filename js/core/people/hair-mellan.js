// Nya frisyrer: lugg, mellanlångt och långt hår. Samlas i HAIR_REG av hair.js.
// Varje post byggs med hs(label, grupp, { front, back, side }) – hs klipper frisyren
// under täckande huvudbonader (se hair-kit.js). Id:n får aldrig byta namn efter släpp.
import { hs, capF, backStd, backShort, sideTop, sideStd, dims, row, col, mask, paint } from './hair-kit.js';

// Hår som hänger bakom kroppen: ritas bara där inget annat redan finns (armar, bål och
// öron ligger framför), så att långt hår syns bakom axlarna i stället för över dem.
const behind = (R, x, y, c) => { if (!R.has(x, y)) R.put(x, y, c); };
const behindRect = (R, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) behind(R, x + i, y + j, c); };

// ---------- framifrån ----------
// hårgardiner bredvid ansiktet: w px breda, från rad `from` till `end` (inklusive)
const curtF = (R, end, w = 2, from = R.h0 + 1) => {
  const { rect, put, hair: H } = R, xl = 8 - w;
  rect(xl, from, w, end - from + 1, H.base); rect(16, from, w, end - from + 1, H.lo);
  put(xl, from + 1, H.hi); put(xl, from + 2, H.hi);
  row(R, end, xl, 7, H.lo); row(R, end, 16, 15 + w, H.dk);
};
// rak lugg ner till strax ovanför ögonen (vuxna: över brynen)
const bangsF = (R, x0 = 8, x1 = 15) => {
  const { rect, put, hair: H, h0, K } = R, y1 = h0 + (K ? 3 : 4);
  rect(x0, h0 + 3, x1 - x0 + 1, y1 - h0 - 2, H.base); row(R, y1, x0, x1, H.lo);
  put(x0 + 2, h0 + 3, H.lo); put(x1 - 3, h0 + 3, H.lo);
  return y1;
};
// ---------- från sidan ----------
// långt hår bakom örat ner till raden end
const longS = (R, end, x0 = 7, w = 4) => {
  const { rect, hair: H, h0 } = R;
  sideStd(R, false); rect(x0, h0 + 1, w, end - h0, H.base); col(R, x0, h0 + 1, end, H.lo); row(R, end, x0, x0 + w - 1, H.lo);
};
// rak lugg från sidan
const bangsS = (R) => { const { rect, hair: H, h0, K } = R, y1 = h0 + (K ? 3 : 4); rect(13, h0 + 3, 4, y1 - h0 - 2, H.base); row(R, y1, 14, 16, H.lo); };
// ---------- bakifrån ----------
const backTo = (R, end) => backStd(R, end + 1, true); // x 6–17 ner till raden end
// hårstrån bakifrån: mörka lodräta streck
const strands = (R, y0, y1, xs = [9, 12, 15]) => { for (const x of xs) col(R, x, y0, y1, R.hair.lo); };

export const HAIR_MELLAN = {
  // ================= Lugg =================
  bobBangs: hs('Page med lugg', 'Lugg', {
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R; capF(R, 3); bangsF(R);
      rect(6, h0 + 1, 2, eyeRow + 3 - h0, H.base); rect(16, h0 + 1, 2, eyeRow + 3 - h0, H.lo); put(6, h0 + 2, H.hi); put(6, h0 + 3, H.hi);
      row(R, eyeRow + 3, 6, 7, H.lo); row(R, eyeRow + 3, 16, 17, H.dk); },
    back(R) { backStd(R, R.eyeRow + 4, true); },
    side(R) { const { rect, put, hair: H, h0, eyeRow } = R; sideStd(R, false); rect(7, h0 + 1, 4, eyeRow + 3 - h0, H.base); put(7, eyeRow + 2, H.lo); row(R, eyeRow + 3, 7, 10, H.lo); bangsS(R); },
  }),
  longBangs: hs('Långt med lugg', 'Lugg', {
    front(R) { const { chin } = dims(R); capF(R, 3); bangsF(R); curtF(R, chin + 2); },
    back(R) { const { chin } = dims(R); backTo(R, chin + 2); strands(R, R.h0 + 3, chin); },
    side(R) { const { chin } = dims(R); longS(R, chin + 2); bangsS(R); },
  }),
  babyBangs: hs('Kort lugg', 'Lugg', {
    front(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); capF(R, 2);
      row(R, h0 + 2, 8, 15, H.lo); put(10, h0 + 2, H.base); put(13, h0 + 2, H.base); curtF(R, chin, 2, h0 + 1); rect(7, h0 + 2, 1, 1, H.base); },
    back(R) { const { chin } = dims(R); backTo(R, chin); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); sideTop(R); rect(7, h0 + 1, 4, chin - h0, H.base); col(R, 7, h0 + 1, chin, H.lo); row(R, chin, 7, 10, H.lo);
      put(15, h0 + 2, H.lo); put(16, h0 + 2, H.lo); },
  }),
  sideBangs: hs('Sido­lugg', 'Lugg', {
    front(R) { const { rect, put, hair: H, h0, K } = R, { chin } = dims(R); capF(R, 3); curtF(R, chin + 2);
      rect(10, h0 + 3, 6, 1, H.base); rect(12, h0 + 4, 4, 1, H.base); put(9, h0 + 3, H.lo);
      if (!K) { put(14, h0 + 5, H.lo); put(15, h0 + 5, H.lo); } else { put(13, h0 + 4, H.lo); }
      put(11, h0 + 3, H.lo); put(13, h0 + 4, H.lo); put(11, h0 + 1, H.lo); put(12, h0 + 2, H.lo); put(9, h0, H.lo); },
    back(R) { const { chin } = dims(R); backTo(R, chin + 2); strands(R, R.h0 + 3, chin, [10, 14]); R.put(9, R.h0 - 1, R.hair.lo); },
    side(R) { const { rect, put, hair: H, h0, K } = R, { chin } = dims(R); longS(R, chin + 2); rect(13, h0 + 3, 4, 2, H.base); put(16, h0 + 5, K ? H.lo : H.base); row(R, h0 + 4, 14, 15, H.lo); },
  }),
  emo: hs('Emo­lugg', 'Lugg', {
    front(R) { const { rect, put, hair: H, h0, eyeRow, K } = R; capF(R, 3); put(9, h0 - 2, H.base); put(12, h0 - 2, H.base); put(10, h0 - 2, H.hi);
      const ends = [[h0 + 3, 7, 14], [h0 + 4, 7, 12], [h0 + 5, 7, 11], [eyeRow - 1, 7, 11], [eyeRow, 7, 10], [eyeRow + 1, 7, 9], [eyeRow + 2, 7, 8]];
      for (const [y, a, b] of ends) if (y > h0 + 2) row(R, y, a, b, H.base);
      for (const [y, , b] of ends) if (y > h0 + 2) put(b, y, H.lo);
      put(10, h0 + 3, H.lo); put(9, h0 + 4, H.lo); put(8, h0 + 5, H.hi); put(7, eyeRow + 2, H.lo); put(11, h0 + 2, H.lo);
      col(R, 16, h0 + 3, eyeRow + (K ? 0 : 1), H.lo); put(17, h0 + 3, H.lo); put(15, h0 + 3, H.base); },
    back(R) { const { put, hair: H, h0 } = R; const b = backShort(R); put(9, h0 - 2, H.base); put(12, h0 - 2, H.base); put(14, h0 - 2, H.lo);
      for (const [x, n] of [[8, 1], [9, 2], [11, 1], [12, 2], [14, 1], [15, 2]]) col(R, x, b, b + n - 1, n === 2 ? H.lo : H.base); },
    side(R) { const { rect, put, hair: H, h0, eyeRow } = R; sideStd(R); put(10, h0 - 2, H.base); put(13, h0 - 2, H.hi);
      rect(14, h0 + 3, 3, 2, H.base); rect(15, h0 + 5, 2, eyeRow - h0 - 4, H.base); put(16, eyeRow + 1, H.lo); put(14, h0 + 4, H.lo); put(15, eyeRow, H.lo);
      col(R, 8, h0 + 7, h0 + 8, H.lo); put(9, h0 + 7, H.base); },
  }),
  curtainBangs: hs('Gardin­lugg', 'Lugg', {
    front(R) { const { rect, put, hair: H, skin, h0 } = R, { chin } = dims(R); capF(R, 3); curtF(R, chin + 2);
      put(11, h0 + 1, skin.base); put(12, h0 + 1, skin.base); put(11, h0 + 2, skin.base); put(12, h0 + 2, skin.base); put(11, h0, H.lo); put(12, h0, H.lo);
      rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.lo); rect(7, h0 + 4, 2, 1, H.base); rect(15, h0 + 4, 2, 1, H.lo); put(10, h0 + 3, H.lo); put(13, h0 + 3, H.base); },
    back(R) { const { chin } = dims(R); backTo(R, chin + 2); strands(R, R.h0 + 3, chin, [9, 14]); R.put(12, R.h0 - 1, R.hair.lo); R.put(12, R.h0, R.hair.lo); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin + 2); put(14, h0 + 3, H.base); put(16, h0 + 4, H.base); put(15, h0 + 4, H.lo); put(16, h0 + 5, H.lo); },
  }),
  wispy: hs('Fransig lugg', 'Lugg', {
    front(R) { const { rect, put, hair: H, h0, K } = R, { chin } = dims(R); capF(R, 3); curtF(R, chin + 2);
      rect(8, h0 + 3, 8, 1, H.base); for (const x of [9, 12, 14]) put(x, h0 + 3, H.lo); if (!K) for (const x of [8, 10, 13, 15]) put(x, h0 + 4, x > 12 ? H.lo : H.base); },
    back(R) { const { chin } = dims(R); backTo(R, chin + 2); strands(R, R.h0 + 3, chin); },
    side(R) { const { put, hair: H, h0, K } = R, { chin } = dims(R); longS(R, chin + 2); put(14, h0 + 3, H.base); if (!K) { put(16, h0 + 4, H.lo); put(14, h0 + 4, H.lo); } },
  }),

  // ================= Mellanlångt =================
  lob: hs('Lång page', 'Mellanlångt', {
    front(R) { const { rect, put, hair: H, skin, h0 } = R, { chin } = dims(R); capF(R, 3); curtF(R, chin + 1);
      put(10, h0, skin.base); put(10, h0 - 1, H.lo); rect(11, h0 + 3, 5, 1, H.base); put(15, h0 + 4, H.lo); put(14, h0 + 3, H.lo); rect(8, h0 + 3, 2, 1, H.base); put(12, h0 + 1, H.lo); },
    back(R) { const { chin } = dims(R); backTo(R, chin + 1); R.put(10, R.h0 - 1, R.hair.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin + 1); rect(13, h0 + 3, 4, 1, H.base); put(16, h0 + 4, H.lo); },
  }),
  asymBob: hs('Sned page', 'Mellanlångt', {
    // kort på personens högra sida (framifrån bildens vänstra), långt på den vänstra
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chin } = dims(R); capF(R, 3);
      rect(6, h0 + 1, 2, eyeRow + 1 - h0, H.base); put(6, h0 + 2, H.hi); row(R, eyeRow + 1, 6, 7, H.lo);
      rect(16, h0 + 1, 2, chin + 3 - h0, H.lo); row(R, chin + 3, 16, 17, H.dk);
      rect(8, h0 + 3, 5, 1, H.base); put(8, h0 + 4, H.base); put(12, h0 + 3, H.lo); put(10, h0 + 1, H.lo); },
    back(R) { const { eyeRow, h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 2);
      for (let x = 6; x <= 17; x++) m.col(x, h0 + 1, Math.round(chin + 3 - (x - 6) * (chin + 2 - eyeRow) / 11));
      paint(R, m); },
    side(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chin } = dims(R);
      if (R.flip) { longS(R, chin + 3); return; }
      sideStd(R, false); rect(7, h0 + 1, 4, eyeRow + 1 - h0, H.base); col(R, 7, h0 + 1, eyeRow + 1, H.lo); row(R, eyeRow + 1, 7, 10, H.lo); put(14, h0 + 3, H.base); },
  }),
  shag: hs('Shag', 'Mellanlångt', {
    front(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 9, 13).row(h0 - 1, 8, 15).rect(7, h0, 10, 3)
        .col(6, h0 + 1, eyeRow).col(7, h0 + 1, chin - 1).set(5, eyeRow + 1).set(6, eyeRow + 1).col(6, eyeRow + 2, chin - 1).set(5, chin).set(6, chin)
        .col(17, h0 + 1, eyeRow).col(16, h0 + 1, chin - 1).set(18, eyeRow + 1).set(17, eyeRow + 1).col(17, eyeRow + 2, chin - 1).set(18, chin).set(17, chin);
      for (const x of [8, 9, 11, 12, 14, 15]) m.set(x, h0 + 3); m.set(9, h0 + 4); m.set(14, h0 + 4);
      paint(R, m); put(10, h0, H.lo); put(13, h0 + 1, H.lo); put(11, h0 - 1, H.hi); put(7, eyeRow, H.lo); put(16, eyeRow, H.dk); },
    back(R) { const { hair: H, h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 9, 13).row(h0 - 1, 8, 15).rect(7, h0, 10, 1);
      for (let x = 6; x <= 17; x++) m.col(x, h0 + 1, chin - 1 + ((x * 5) % 3));
      m.set(5, eyeRow + 1).set(18, eyeRow + 1).set(5, chin).set(18, chin);
      paint(R, m); strands(R, h0 + 2, chin - 2, [9, 13]); R.put(11, h0 + 4, H.lo); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 10, 13).row(h0 - 1, 9, 15).rect(8, h0, 9, 3).rect(7, h0 + 1, 4, chin - h0 - 1).set(6, eyeRow + 1).set(6, chin).set(8, chin).set(10, chin)
        .set(15, h0 + 3).set(16, h0 + 3).set(16, h0 + 4);
      paint(R, m); put(9, eyeRow, H.lo); put(12, h0 + 1, H.lo); },
  }),
  wolf: hs('Varg­frilla', 'Mellanlångt', {
    front(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 3, 10, 10).row(h0 - 3, 13, 13).row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(7, h0, 10, 3)
        .rect(6, h0 + 1, 2, chin + 2 - h0).rect(16, h0 + 1, 2, chin + 2 - h0).set(5, h0 + 4).set(5, eyeRow + 2).set(18, h0 + 5).set(18, eyeRow + 3)
        .row(h0 + 3, 8, 10).row(h0 + 3, 13, 15).set(8, h0 + 4).set(15, h0 + 4);
      m.cut(6, chin + 2); m.cut(17, chin + 1); m.cut(17, chin + 2);
      paint(R, m); for (const [x, y] of [[9, 0], [12, 1], [14, -1], [11, -2], [10, 2]]) put(x, h0 + y, H.lo); put(6, eyeRow + 3, H.lo); put(17, eyeRow + 1, H.dk); },
    back(R) { const { h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().set(10, h0 - 3).set(13, h0 - 3).row(h0 - 2, 8, 15).row(h0 - 1, 7, 16);
      for (let x = 6; x <= 17; x++) m.col(x, h0, chin + 2 + ((x * 7) % 3) - (x < 8 || x > 15 ? 1 : 0));
      m.set(5, h0 + 4).set(18, h0 + 5).set(5, eyeRow + 2).set(18, eyeRow + 3);
      paint(R, m); strands(R, h0 + 2, chin, [9, 12, 15]); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().set(11, h0 - 3).set(14, h0 - 3).row(h0 - 2, 9, 15).row(h0 - 1, 9, 16).rect(8, h0, 9, 3).rect(6, h0 + 1, 5, chin + 2 - h0)
        .set(5, h0 + 5).set(5, eyeRow + 3).set(15, h0 + 3).set(16, h0 + 3).set(16, h0 + 4);
      m.cut(6, chin + 2); m.cut(8, chin + 2);
      paint(R, m); put(8, eyeRow, H.lo); put(9, h0 + 3, H.lo); put(13, h0, H.lo); },
  }),
  flipped: hs('Utåt­vippat', 'Mellanlångt', {
    front(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 9, 14).row(h0 - 1, 7, 16).rect(6, h0, 12, 3).rect(6, h0 + 3, 2, chin - h0 - 4).rect(16, h0 + 3, 2, chin - h0 - 4)
        .row(chin - 1, 4, 7).row(chin - 1, 16, 19).set(4, chin - 2).set(19, chin - 2).set(5, chin - 2).set(18, chin - 2);
      paint(R, m); rect(8, h0 + 3, 4, 1, H.base); put(11, h0 + 3, H.lo); put(8, h0 + 4, H.lo); put(10, h0 + 1, H.lo); put(4, chin - 2, H.hi); },
    back(R) { const { h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 9, 14).row(h0 - 1, 7, 16).rect(6, h0, 12, chin - h0 - 1).row(chin - 1, 4, 19).set(4, chin - 2).set(19, chin - 2);
      paint(R, m); strands(R, h0 + 3, chin - 3, [10, 13]); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 10, 14).row(h0 - 1, 8, 16).rect(7, h0, 10, 3).rect(7, h0 + 3, 4, chin - h0 - 4).row(chin - 1, 5, 10).set(5, chin - 2).set(15, h0 + 3).set(16, h0 + 3);
      paint(R, m); put(12, h0 + 1, H.lo); },
  }),
  surfer: hs('Surfar­hår', 'Mellanlångt', {
    front(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R, { chin } = dims(R); capF(R, 3);
      put(11, h0 + 1, skin.base); put(12, h0 + 2, skin.base); put(11, h0, H.lo);
      rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.lo); put(8, h0 + 4, H.base); put(15, h0 + 4, H.lo);
      col(R, 6, h0 + 1, eyeRow - 2, H.base); col(R, 7, h0 + 3, eyeRow - 2, H.base); col(R, 17, h0 + 1, eyeRow - 2, H.lo); col(R, 16, h0 + 3, eyeRow - 2, H.lo); put(6, h0 + 2, H.hi);
      behindRect(R, 5, eyeRow - 2, 2, chin + 2 - eyeRow, H.base); behindRect(R, 17, eyeRow - 2, 2, chin + 2 - eyeRow, H.lo); behind(R, 5, chin + 1, H.lo); behind(R, 18, chin + 1, H.dk); },
    back(R) { const { put, hair: H } = R, { chin } = dims(R); backTo(R, chin + 1); for (const x of [7, 10, 13, 16]) put(x, chin + 2, H.lo); strands(R, R.h0 + 3, chin - 1, [9, 14]); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin + 1);
      put(8, chin + 2, H.lo); put(10, chin + 2, H.lo); rect(14, h0 + 3, 3, 1, H.base); put(16, h0 + 4, H.lo); put(9, h0 + 4, H.lo); },
  }),
  grunge: hs('Grunge', 'Mellanlångt', {
    front(R) { const { rect, put, hair: H, skin, h0 } = R, { chin } = dims(R);
      rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, 2, H.base); rect(9, h0 - 1, 2, 1, H.hi); put(11, h0, skin.base); put(12, h0 + 1, skin.base); put(12, h0, H.lo);
      rect(6, h0 + 1, 3, chin + 3 - h0, H.base); rect(15, h0 + 1, 3, chin + 3 - h0, H.lo); rect(8, h0 + 2, 3, 1, H.base); rect(13, h0 + 2, 3, 1, H.lo);
      col(R, 7, h0 + 3, chin + 2, H.lo); col(R, 16, h0 + 3, chin + 2, H.dk); put(6, h0 + 2, H.hi);
      for (const x of [6, 8, 15, 17]) put(x, chin + 3, x < 12 ? H.lo : H.dk); put(7, chin + 4, H.lo); put(16, chin + 4, H.dk); },
    back(R) { const { put, hair: H } = R, { chin } = dims(R); backTo(R, chin + 3); strands(R, R.h0 + 2, chin + 2, [8, 10, 13, 15]); for (const x of [7, 11, 14]) put(x, chin + 4, H.lo); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); longS(R, chin + 3); col(R, 9, h0 + 3, chin + 1, H.lo); put(8, chin + 4, H.lo); col(R, 14, h0 + 3, eyeRow - 2, H.base); put(15, h0 + 3, H.lo); },
  }),

  // ================= Långt hår =================
  veryLong: hs('Midje­långt', 'Långt hår', {
    front(R) { const { rect, hair: H, h0 } = R, { waist } = dims(R); capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); curtF(R, waist); R.put(7, waist, H.base); R.put(16, waist, H.lo); },
    back(R) { const { waist } = dims(R); backTo(R, waist); strands(R, R.h0 + 3, waist - 2, [9, 12, 15]); R.put(6, waist, R.hair.lo); R.put(17, waist, R.hair.dk); },
    side(R) { const { put, hair: H, h0 } = R, { waist } = dims(R); longS(R, waist); col(R, 9, h0 + 4, waist - 2, H.lo); put(10, waist, H.base); },
  }),
  longSide: hs('Långt med sidbena', 'Långt hår', {
    front(R) { const { rect, put, hair: H, skin, h0, K } = R, { chin } = dims(R); capF(R, 3);
      put(9, h0, skin.base); put(9, h0 - 1, H.lo); put(8, h0, H.base); put(10, h0 + 1, H.lo);
      rect(10, h0 + 3, 7, 1, H.base); rect(13, h0 + 4, 4, 1, H.base); if (!K) put(15, h0 + 5, H.lo); put(12, h0 + 3, H.lo); put(14, h0 + 4, H.lo);
      curtF(R, chin + 3); rect(18, h0 + 3, 1, chin - h0, H.dk); put(8, h0 + 3, H.base); },
    back(R) { const { chin } = dims(R); backTo(R, chin + 3); col(R, 5, R.h0 + 3, chin + 1, R.hair.base); strands(R, R.h0 + 3, chin + 1, [10, 14]); R.put(14, R.h0 - 1, R.hair.lo); R.put(14, R.h0, R.hair.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin + 3); rect(13, h0 + 3, 4, 1, H.base); put(16, h0 + 4, H.base); put(15, h0 + 4, H.lo); },
  }),
  layered: hs('Lager­klippt', 'Långt hår', {
    front(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); capF(R, 3);
      const m = mask().col(6, h0 + 1, eyeRow - 1).col(7, h0 + 1, chin + 3).rect(5, eyeRow, 2, chin - eyeRow + 1).rect(5, chin + 1, 2, 3)
        .col(17, h0 + 1, eyeRow - 1).col(16, h0 + 1, chin + 3).rect(17, eyeRow, 2, chin - eyeRow + 1).rect(17, chin + 1, 2, 3).set(8, h0 + 3).set(9, h0 + 3).set(14, h0 + 3).set(15, h0 + 3).set(8, h0 + 4).set(15, h0 + 4);
      m.cut(5, chin + 3);
      paint(R, m); put(5, eyeRow, H.hi); put(6, eyeRow - 1, H.lo); put(17, eyeRow - 1, H.dk); put(5, chin + 1, H.hi); put(6, chin, H.lo); },
    back(R) { const { h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 1);
      for (let x = 5; x <= 18; x++) m.col(x, x < 6 || x > 17 ? eyeRow : h0 + 1, chin + 4 - Math.round(Math.abs(x - 11.5) * 0.7));
      paint(R, m); strands(R, h0 + 3, chin, [9, 14]); col(R, 6, eyeRow, chin, R.hair.lo); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); longS(R, chin + 3); put(6, eyeRow, H.base); put(6, eyeRow + 1, H.lo); put(6, chin, H.lo); col(R, 9, eyeRow, chin + 1, H.lo); put(10, chin + 3, H.base); put(14, h0 + 3, H.base); put(16, h0 + 4, H.base); },
  }),
  overShoulder: hs('Över axeln', 'Långt hår', {
    // allt hår svept över personens vänstra axel (framifrån bildens högra)
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chin, chest } = dims(R); capF(R, 3);
      rect(9, h0 + 3, 8, 1, H.base); rect(12, h0 + 4, 5, 1, H.base); put(11, h0 + 3, H.lo); put(9, h0, H.lo); put(10, h0 + 1, H.lo); col(R, 7, h0 + 3, eyeRow - 2, H.base);
      const m = mask().rect(16, h0 + 1, 2, chin - h0).rect(16, chin, 3, chest - chin + 1).set(18, eyeRow).set(18, eyeRow + 1).cut(16, chest);
      paint(R, m, { split: 99 }); for (let y = eyeRow; y < chest; y++) put(17, y, (y & 1) ? H.lo : H.base); put(18, chest, H.dk); },
    back(R) { const { rect, put, hair: H, h0 } = R, { chin, chest } = dims(R); backStd(R, h0 + R.headH - 2, false);
      const m = mask().rect(6, h0 + 2, 3, chin - h0 - 2).rect(5, chin - 1, 4, chest - chin + 2).cut(8, chest);
      paint(R, m); for (let y = chin; y < chest; y++) put(6, y, (y & 1) ? H.lo : H.base); rect(9, h0 + 5, 3, 2, H.base); put(10, h0 + 6, H.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin, chest } = dims(R);
      if (!R.flip) { sideStd(R); put(15, h0 + 3, H.base); return; }
      sideStd(R, false); rect(7, h0 + 1, 4, chin - h0 - 1, H.base); col(R, 7, h0 + 1, chin - 1, H.lo);
      const m = mask().rect(10, chin - 2, 3, 2).rect(11, chin, 3, chest - chin); paint(R, m); for (let y = chin; y < chest; y++) put(12, y, (y & 1) ? H.lo : H.base); },
  }),
  sleek: hs('Rakt & blankt', 'Långt hår', {
    front(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R, { chin } = dims(R);
      rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, 2, H.base); rect(7, h0 + 2, 4, 1, H.base); rect(13, h0 + 2, 4, 1, H.base); put(11, h0, skin.base); put(11, h0 + 1, skin.base); put(12, h0, H.lo);
      curtF(R, chin + 4); col(R, 16, h0 - 1, h0 + 1, H.lo);
      rect(8, h0, 3, 1, H.hi); rect(13, h0, 2, 1, H.hi); rect(9, h0 - 1, 2, 1, H.hi); put(6, eyeRow, H.hi); put(6, eyeRow + 1, H.hi); put(16, eyeRow, H.base); },
    back(R) { const { rect, h0 } = R, { chin } = dims(R); backTo(R, chin + 4); rect(7, h0 + 2, 10, 1, R.hair.hi); rect(6, h0 + 3, 1, 1, R.hair.hi); col(R, 11, h0 - 1, h0 + 1, R.hair.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin + 4); rect(9, h0 + 1, 4, 1, H.hi); put(8, h0 + 5, H.hi); put(8, h0 + 6, H.hi); },
  }),
  longBehind: hs('Bakom öronen', 'Långt hår', {
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chest } = dims(R); capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); put(10, h0 + 3, H.lo);
      col(R, 7, h0 + 3, eyeRow - 2, H.base); col(R, 16, h0 + 3, eyeRow - 2, H.lo); col(R, 6, h0 + 1, eyeRow - 2, H.base); col(R, 17, h0 + 1, eyeRow - 2, H.lo); put(6, h0 + 2, H.hi);
      behindRect(R, 5, eyeRow - 2, 2, chest - eyeRow + 2, H.base); behindRect(R, 17, eyeRow - 2, 2, chest - eyeRow + 2, H.lo); },
    back(R) { const { chest } = dims(R); backTo(R, chest); strands(R, R.h0 + 3, chest - 2, [9, 12, 15]); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chest } = dims(R); sideStd(R, false); rect(7, h0 + 1, 4, chest - h0, H.base); col(R, 7, h0 + 1, chest, H.lo); row(R, chest, 7, 10, H.lo); put(10, h0 + 5, H.lo); },
  }),
  hime: hs('Prinsess­klipp', 'Långt hår', {
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chest } = dims(R); capF(R, 3); bangsF(R, 9, 14);
      rect(7, h0 + 3, 2, eyeRow + 3 - h0 - 2, H.base); rect(15, h0 + 3, 2, eyeRow + 3 - h0 - 2, H.lo); row(R, eyeRow + 3, 7, 8, H.lo); row(R, eyeRow + 3, 15, 16, H.dk); put(7, h0 + 3, H.hi);
      behindRect(R, 5, h0 + 1, 2, chest - h0, H.base); behindRect(R, 17, h0 + 1, 2, chest - h0, H.lo); put(6, h0 + 1, H.base); put(17, h0 + 1, H.lo); },
    back(R) { const { chest } = dims(R); backTo(R, chest); strands(R, R.h0 + 3, chest - 2, [10, 13]); },
    side(R) { const { rect, hair: H, h0, eyeRow } = R, { chest } = dims(R); longS(R, chest); bangsS(R); rect(12, h0 + 3, 2, eyeRow + 3 - h0 - 2, H.base); row(R, eyeRow + 3, 12, 13, H.lo); col(R, 12, h0 + 3, eyeRow + 2, H.lo); },
  }),
};
