// Nya frisyrer: lockar, afro, dreads och twists. Samlas i HAIR_REG av hair.js.
// Varje post byggs med hs(label, grupp, { front, back, side }) – hs klipper frisyren
// under täckande huvudbonader (se hair-kit.js). Id:n får aldrig byta namn efter släpp.
import { hs, capF, backStd, sideTop, shaved, dims, nz, row, col, mask, paint, curls, sleekF, sleekB, sleekS, TIE } from './hair-kit.js';

const BEAD = 0xe0b24a, BEAD2 = 0xf4f1ea; // pärlor i dreads (guld + vit)

// rakade sidor (framifrån x 7/16 eller från sidan bakom örat)
const shavedSidesF = (R, y0, y1) => { const s = shaved(R); col(R, 7, y0, y1, s.a); col(R, 16, y0, y1, s.b); };
const shavedSideS = (R, y0) => { const s = shaved(R); R.rect(8, y0, 3, R.h0 + 7 - y0, s.a); R.put(8, R.h0 + 6, s.b); };
const shavedBackB = (R, y0) => { const s = shaved(R), y1 = R.h0 + R.headH - 4; R.rect(7, y0, 10, y1 - y0, s.a); R.rect(8, y1, 8, 1, s.a); col(R, 16, y0, y1 - 1, s.b); };

// korkskruvslock: 2 px bred spiral från y0 till y1 (inklusive), x = vänsterkolumnen
const ringlet = (R, x, y0, y1, dark) => {
  const { put, hair: H } = R;
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) % 3;
    put(x, y, k === 0 ? (dark ? H.base : H.hi) : k === 1 ? (dark ? H.lo : H.base) : (dark ? H.dk : H.lo));
    put(x + 1, y, k === 0 ? (dark ? H.lo : H.base) : k === 1 ? (dark ? H.dk : H.lo) : (dark ? H.base : H.hi));
  }
  put(x + (dark ? 1 : 0), y1 + 1, dark ? H.dk : H.lo);
};
// dread/loc: 1–2 px bred sträng med ränder, valfria pärlor
const loc = (R, x, y0, y1, w, dark, beads) => {
  const { put, hair: H } = R;
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0 + x) % 3 === 0;
    put(x, y, k ? (dark ? H.dk : H.lo) : dark ? H.lo : H.base);
    if (w > 1) put(x + 1, y, k ? H.dk : dark ? H.dk : H.lo);
  }
  if (beads) { // en eller två pärlor per lock, utspridda i höjdled
    const a = y0 + 3 + (nz(x, y0, 7) % 4);
    put(x, a, (x >> 1) % 2 ? BEAD : BEAD2);
    if (y1 - a > 6 && nz(x, 1, 8) < 50) put(x, a + 5, BEAD);
  }
};
// twist: kort stående spiral, spetsen uppåt
const twist = (R, x, yTip, yEnd) => {
  const { put, hair: H } = R;
  for (let y = yTip; y <= yEnd; y++) put(x, y, y === yTip ? H.hi : (y - yTip) % 2 ? H.lo : H.base);
};

export const HAIR_LOCKAR = {
  // ================= Lockar =================
  longCurly: hs('Långa lockar', 'Lockar', {
    front(R) { const { h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(6, h0, 12, 3).rect(4, h0 + 1, 4, chin + 4 - h0).rect(16, h0 + 1, 4, chin + 4 - h0)
        .set(8, h0 + 3).set(9, h0 + 3).set(14, h0 + 3).set(15, h0 + 3).set(12, h0 + 3);
      for (let y = h0 + 1; y <= chin + 4; y++) { if (nz(4, y, 1) < 40) m.cut(4, y); if (nz(19, y, 2) < 40) m.cut(19, y); }
      for (const x of [4, 6, 17, 19]) if (nz(x, chin + 4, 3) < 60) m.cut(x, chin + 4);
      paint(R, m, { tex: curls(11) }); },
    back(R) { const { h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(6, h0, 12, 2).rect(4, h0 + 1, 16, chin + 4 - h0);
      for (let y = h0 + 1; y <= chin + 4; y++) { if (nz(4, y, 1) < 40) m.cut(4, y); if (nz(19, y, 2) < 40) m.cut(19, y); }
      for (let x = 4; x <= 19; x++) if (nz(x, chin + 4, 4) < 45) m.cut(x, chin + 4);
      paint(R, m, { tex: curls(12) }); },
    side(R) { const { h0 } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 9, 15).row(h0 - 1, 8, 16).rect(7, h0, 10, 3).rect(4, h0 + 1, 7, chin + 4 - h0).set(15, h0 + 3).set(16, h0 + 3).set(16, h0 + 4);
      for (let y = h0 + 1; y <= chin + 4; y++) if (nz(4, y, 5) < 45) m.cut(4, y);
      for (let x = 4; x <= 10; x++) if (nz(x, chin + 4, 6) < 45) m.cut(x, chin + 4);
      paint(R, m, { tex: curls(13) }); },
  }),
  ringlets: hs('Kork­skruvar', 'Lockar', {
    front(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); capF(R, 3);
      for (const x of [8, 10, 13, 15]) put(x, h0 + 3, x > 12 ? H.lo : H.base); put(9, h0 + 1, H.lo); put(12, h0, H.lo); put(14, h0 + 1, H.lo);
      ringlet(R, 5, h0 + 1, chin + 3, false); ringlet(R, 17, h0 + 1, chin + 3, true); ringlet(R, 7, h0 + 3, R.eyeRow + 2, false); ringlet(R, 15, h0 + 3, R.eyeRow + 2, true); },
    back(R) { const { h0 } = R, { chin } = dims(R); backStd(R, h0 + 4, true);
      for (const [x, e] of [[5, 2], [7, 4], [9, 3], [11, 4], [13, 3], [15, 4], [17, 2]]) ringlet(R, x, h0 + 3, chin + e - 1, x >= 12); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); sideTop(R); put(15, h0 + 3, H.base); put(16, h0 + 3, H.lo);
      ringlet(R, 5, h0 + 2, chin + 3, true); ringlet(R, 7, h0 + 2, chin + 2, false); ringlet(R, 9, h0 + 3, chin, true); },
  }),
  curlyTop: hs('Lockig topp', 'Lockar', {
    front(R) { const { h0 } = R;
      const m = mask().row(h0 - 3, 9, 14).row(h0 - 2, 8, 15).rect(7, h0 - 1, 10, 3).set(8, h0 + 2).set(9, h0 + 2).set(11, h0 + 2).set(13, h0 + 2).set(15, h0 + 2).set(12, h0 + 3).set(9, h0 + 3);
      paint(R, m, { tex: curls(21, 1.3) }); shavedSidesF(R, h0 + 2, h0 + 5); },
    back(R) { const { h0 } = R; const m = mask().row(h0 - 3, 9, 14).row(h0 - 2, 8, 15).rect(7, h0 - 1, 10, 4); paint(R, m, { tex: curls(22, 1.3) }); shavedBackB(R, h0 + 3); },
    side(R) { const { h0 } = R, s = shaved(R);
      const m = mask().row(h0 - 3, 10, 15).row(h0 - 2, 9, 16).rect(8, h0 - 1, 9, 3).set(16, h0 + 2).set(17, h0 + 1).set(15, h0 + 2).set(16, h0 + 3);
      paint(R, m, { tex: curls(23, 1.3) }); R.rect(8, h0 + 2, 5, 1, s.a); shavedSideS(R, h0 + 3); col(R, 13, h0 + 2, h0 + 4, s.a); },
  }),
  curlyBob: hs('Lockig page', 'Lockar', {
    // hakans längd, volymen längst ner (triangelform), lockar i pannan
    front(R) { const { h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(6, h0, 12, 3)
        .rect(5, h0 + 3, 3, eyeRow - h0 - 3).rect(16, h0 + 3, 3, eyeRow - h0 - 3)
        .rect(4, eyeRow, 4, chin + 2 - eyeRow).rect(16, eyeRow, 4, chin + 2 - eyeRow)
        .set(8, h0 + 3).set(10, h0 + 3).set(13, h0 + 3).set(15, h0 + 3);
      for (const x of [4, 5, 6, 7, 16, 17, 18, 19]) if (nz(x, chin + 1, 14) < 45) m.cut(x, chin + 1);
      m.cut(4, eyeRow).cut(19, eyeRow);
      paint(R, m, { tex: curls(15, 1.3) }); },
    back(R) { const { h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(6, h0, 12, 3).rect(5, h0 + 3, 14, eyeRow - h0 - 3).rect(4, eyeRow, 16, chin + 2 - eyeRow);
      for (let x = 4; x <= 19; x++) if (nz(x, chin + 1, 16) < 45) m.cut(x, chin + 1);
      m.cut(4, eyeRow).cut(19, eyeRow);
      paint(R, m, { tex: curls(17, 1.3) }); },
    side(R) { const { h0, eyeRow } = R, { chin } = dims(R);
      const m = mask().row(h0 - 2, 9, 15).row(h0 - 1, 8, 16).rect(7, h0, 10, 3).rect(6, h0 + 3, 5, eyeRow - h0 - 3).rect(5, eyeRow, 6, chin + 2 - eyeRow)
        .set(15, h0 + 3).set(16, h0 + 3).set(16, h0 + 4).set(13, h0 + 3);
      for (let x = 5; x <= 10; x++) if (nz(x, chin + 1, 18) < 45) m.cut(x, chin + 1);
      m.cut(5, eyeRow);
      paint(R, m, { tex: curls(19, 1.3) }); },
  }),

  // ================= Afro =================
  twa: hs('Kort afro', 'Afro', {
    front(R) { const { h0, eyeRow } = R;
      const m = mask().row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(6, h0, 12, 2).row(h0 + 2, 7, 16).rect(6, h0 + 2, 2, eyeRow - h0 - 3).rect(16, h0 + 2, 2, eyeRow - h0 - 3);
      paint(R, m, { tex: curls(31, 1.4) }); },
    back(R) { const { h0, headH } = R;
      const m = mask().row(h0 - 2, 8, 15).row(h0 - 1, 7, 16).rect(6, h0, 12, headH - 4).row(h0 + headH - 4, 7, 16);
      paint(R, m, { tex: curls(32, 1.4) }); },
    side(R) { const { h0 } = R;
      const m = mask().row(h0 - 2, 9, 14).row(h0 - 1, 8, 16).rect(7, h0, 10, 2).row(h0 + 2, 7, 17).rect(7, h0 + 3, 4, 5).set(16, h0 + 2).set(13, h0 + 3).set(13, h0 + 4);
      m.cut(17, h0 + 2); paint(R, m, { tex: curls(33, 1.4) }); },
  }),
  bigAfro: hs('Stor afro', 'Afro', {
    // under en hatt trycks afron ihop lite (annars sticker den ut som vingar)
    front(R) { const { h0, headH, K } = R, sq = R.hatted ? 2 : 0;
      const m = mask().oval(11.5, h0 + 3, (K ? 8.5 : 9.5) - sq, (K ? 7.5 : 8.5) - sq / 2).cut(7, h0 + 3, 10, headH).cut(8, h0 + 2, 8, 1);
      m.set(8, h0 + 2).set(15, h0 + 2).set(11, h0 + 2);
      paint(R, m, { tex: curls(41, 1.2) }); },
    back(R) { const { h0, K } = R, sq = R.hatted ? 2 : 0; const m = mask().oval(11.5, h0 + 3, (K ? 8.5 : 9.5) - sq, (K ? 7.5 : 8.5) - sq / 2); paint(R, m, { tex: curls(42, 1.2) }); },
    side(R) { const { h0, headH, K } = R, sq = R.hatted ? 2 : 0;
      const m = mask().oval(9.5 + sq / 2, h0 + 3, (K ? 7.5 : 8.5) - sq, (K ? 7.5 : 8.5) - sq / 2).cut(12, h0 + 3, 7, headH).cut(17, 0, 7, 40);
      m.row(h0 + 3, 12, 13).set(16, h0 + 2);
      paint(R, m, { tex: curls(43, 1.2) }); },
  }),
  afroPuff: hs('Afro­puff', 'Afro', {
    front(R) { const { rect, h0 } = R; sleekF(R);
      const m = mask().oval(11.5, h0 - 2.5, 4, 2.6); paint(R, m, { tex: curls(51, 1.3) }); rect(10, h0 - 1, 4, 1, R.hatted ? R.hair.lo : TIE); },
    back(R) { const { rect, h0 } = R; sleekB(R, true); const m = mask().oval(11.5, h0 - 2.5, 4, 2.6); paint(R, m, { tex: curls(52, 1.3) }); rect(10, h0 - 1, 4, 1, TIE); },
    side(R) { const { put, h0 } = R; sleekS(R); const m = mask().oval(9, h0 - 2.3, 3.4, 2.6); paint(R, m, { tex: curls(53, 1.3) }); put(10, h0, TIE); put(11, h0, TIE); },
  }),
  afroPuffs: hs('Dubbla puffar', 'Afro', {
    front(R) { const { put, skin, h0 } = R; sleekF(R); put(11, h0, skin.base); put(11, h0 + 1, skin.base); put(11, h0 - 1, R.hair.lo);
      paint(R, mask().oval(6, h0 - 1.5, 3, 2.8), { tex: curls(61, 1.3) }); paint(R, mask().oval(17, h0 - 1.5, 3, 2.8), { tex: curls(62, 1.3) });
      put(8, h0 + 1, TIE); put(15, h0 + 1, TIE); },
    back(R) { const { put, h0 } = R; sleekB(R, true); col(R, 12, h0 - 1, h0 + R.headH - 5, R.hair.lo);
      paint(R, mask().oval(6, h0 - 1.5, 3, 2.8), { tex: curls(63, 1.3) }); paint(R, mask().oval(17, h0 - 1.5, 3, 2.8), { tex: curls(64, 1.3) }); put(8, h0 + 1, TIE); put(15, h0 + 1, TIE); },
    side(R) { const { put, h0 } = R; sleekS(R);
      paint(R, mask().oval(10.5, h0 - 2.5, 3, 2.6), { tex: curls(65, 1.3) }); put(10, h0, TIE); put(11, h0, TIE); },
  }),
  highTop: hs('High top', 'Afro', {
    front(R) { const { put, hair: H, h0 } = R;
      const m = mask().row(h0 - 5, 9, 14).rect(8, h0 - 4, 8, 6); paint(R, m, { tex: curls(71, 1.2) }); row(R, h0 - 5, 9, 13, H.hi); put(8, h0 - 4, H.hi); row(R, h0 + 1, 9, 14, H.lo);
      shavedSidesF(R, h0, h0 + 4); },
    back(R) { const { put, hair: H, h0 } = R; const m = mask().row(h0 - 5, 9, 14).rect(8, h0 - 4, 8, 5); paint(R, m, { tex: curls(72, 1.2) }); row(R, h0 - 5, 9, 13, H.hi); put(8, h0 - 4, H.hi);
      shavedBackB(R, h0 + 1); shavedSidesF(R, h0, h0); },
    side(R) { const { hair: H, h0 } = R, s = shaved(R);
      const m = mask().row(h0 - 5, 10, 15).rect(9, h0 - 4, 8, 5).row(h0 + 1, 13, 16); paint(R, m, { tex: curls(73, 1.2) }); row(R, h0 - 5, 10, 14, H.hi);
      R.put(8, h0, s.a); R.rect(8, h0 + 1, 5, 1, s.a); shavedSideS(R, h0 + 2); col(R, 13, h0 + 2, h0 + 3, s.a); },
  }),
  frohawk: hs('Frohawk', 'Afro', {
    front(R) { const { h0 } = R, s = shaved(R);
      R.rect(8, h0, 2, 3, s.a); R.rect(14, h0, 2, 3, s.b); shavedSidesF(R, h0 + 1, h0 + 4); R.put(7, h0, s.a); R.put(16, h0, s.b);
      const m = mask().row(h0 - 4, 10, 13).rect(9, h0 - 3, 6, 4).row(h0 + 1, 10, 13); paint(R, m, { tex: curls(81, 1.3) }); },
    back(R) { const { h0, headH } = R, s = shaved(R); R.rect(7, h0, 10, headH - 3, s.a); col(R, 16, h0, h0 + headH - 4, s.b);
      const m = mask().row(h0 - 4, 10, 13).rect(9, h0 - 3, 6, headH - 3).row(h0 + headH - 6, 10, 13); m.cut(9, h0 + headH - 7).cut(14, h0 + headH - 7); paint(R, m, { tex: curls(82, 1.3) }); },
    side(R) { const { h0 } = R, s = shaved(R);
      R.put(8, h0, s.a); R.rect(8, h0 + 1, 8, 1, s.a); R.rect(8, h0 + 2, 5, 1, s.a); shavedSideS(R, h0 + 3);
      const m = mask().row(h0 - 4, 10, 14).row(h0 - 3, 9, 16).rect(8, h0 - 2, 9, 2).row(h0, 9, 16).set(16, h0 + 1); paint(R, m, { tex: curls(83, 1.3) }); },
  }),
  afroFade: hs('Afro med fade', 'Afro', {
    // rund kort afro på hjässan, sidorna och nacken tonar ut mot huden
    front(R) { const { h0 } = R, s = shaved(R);
      const m = mask().row(h0 - 4, 9, 14).row(h0 - 3, 8, 15).rect(7, h0 - 2, 10, 3).row(h0 + 1, 8, 15).row(h0 + 2, 8, 15);
      paint(R, m, { tex: curls(85, 1.4) });
      col(R, 7, h0 + 1, h0 + 2, s.a); col(R, 16, h0 + 1, h0 + 2, s.b); col(R, 7, h0 + 3, h0 + 5, s.f); col(R, 16, h0 + 3, h0 + 5, s.f); },
    back(R) { const { rect, h0, headH } = R, s = shaved(R);
      const m = mask().row(h0 - 4, 9, 14).row(h0 - 3, 8, 15).rect(7, h0 - 2, 10, 4);
      paint(R, m, { tex: curls(86, 1.4) });
      rect(7, h0 + 2, 10, 2, s.a); col(R, 16, h0 + 2, h0 + 3, s.b); rect(7, h0 + 4, 10, headH - 8, s.f); rect(8, h0 + headH - 4, 8, 1, s.f); },
    side(R) { const { rect, put, h0 } = R, s = shaved(R);
      const m = mask().row(h0 - 4, 10, 14).row(h0 - 3, 9, 16).rect(8, h0 - 2, 9, 3).row(h0 + 1, 12, 16).row(h0 + 2, 14, 16);
      paint(R, m, { tex: curls(87, 1.4) });
      rect(8, h0 + 1, 4, 1, s.a); rect(8, h0 + 2, 6, 1, s.a); rect(8, h0 + 3, 3, 4, s.f); put(13, h0 + 3, s.f); put(13, h0 + 4, s.f); put(8, h0 + 6, s.b); },
  }),

  // ================= Dreads & twists =================
  dreadsBun: hs('Dreads i knut', 'Dreads & twists', {
    front(R) { const { put, hair: H, h0 } = R; sleekF(R);
      for (let x = 8; x <= 15; x += 2) for (let y = h0; y <= h0 + 2; y++) if ((x + y) % 2 === 0) put(x, y, H.lo);
      const m = mask().oval(11.5, h0 - 2.5, 3.8, 2.6); paint(R, m);
      for (let y = h0 - 4; y <= h0 - 1; y += 2) row(R, y, 9, 14, H.lo); for (const x of [9, 12, 14]) put(x, h0 - 3, H.dk); },
    back(R) { const { put, hair: H, h0 } = R; sleekB(R, true);
      const m = mask().oval(11.5, h0 - 2.5, 3.8, 2.6); paint(R, m); for (let y = h0 - 4; y <= h0 - 1; y += 2) row(R, y, 9, 14, H.lo);
      for (let y = h0 + 1; y < h0 + R.headH - 4; y++) { put(11, y, H.lo); put(12, y, H.dk); } },
    side(R) { const { put, hair: H, h0 } = R; sleekS(R);
      const m = mask().oval(9, h0 - 2.3, 3.4, 2.6); paint(R, m); for (let y = h0 - 4; y <= h0 - 1; y += 2) row(R, y, 7, 11, H.lo); put(8, h0 - 3, H.dk);
      for (let x = 9; x <= 15; x += 2) put(x, h0 + 1, H.lo); },
  }),
  dreadsTail: hs('Dreads­svans', 'Dreads & twists', {
    front(R) { const { put, hair: H, h0 } = R; sleekF(R);
      for (let x = 8; x <= 15; x += 2) for (let y = h0; y <= h0 + 2; y++) if ((x + y) % 2 === 0) put(x, y, H.lo); },
    back(R) { const { put, rect, hair: H, h0, headH } = R, { chest } = dims(R), b = h0 + headH - 3;
      sleekB(R, false); rect(10, b - 1, 4, 1, TIE);
      for (const [x, e, d] of [[9, 0, false], [10, 1, false], [11, 2, true], [12, 1, false], [13, 2, true], [14, 0, true]]) loc(R, x, b, chest - e, 1, d, false);
      put(9, b, H.base); put(14, b, H.lo); },
    side(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sleekS(R); put(8, h0 + 3, TIE); put(8, h0 + 4, TIE);
      loc(R, 7, h0 + 4, chest - 1, 1, false, false); loc(R, 6, h0 + 5, chest, 1, true, false); loc(R, 5, h0 + 6, chest - 2, 1, false, false); put(7, h0 + 3, H.base); },
  }),
  twists: hs('Twists', 'Dreads & twists', {
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R; rect(7, h0, 10, 2, H.lo); rect(8, h0 - 1, 8, 1, H.lo);
      for (let x = 7; x <= 16; x++) twist(R, x, h0 - 2 - (nz(x, 1, 91) % 2) - (x > 8 && x < 15 ? 1 : 0), h0 + 1);
      for (const x of [8, 10, 13, 15]) twist(R, x, h0 + 1, h0 + 3);
      for (const x of [6, 17]) { for (let y = h0; y < eyeRow - 1; y++) put(x, y, (y & 1) ? H.lo : x < 12 ? H.base : H.lo); put(x, eyeRow - 1, H.dk); } },
    back(R) { const { rect, put, hair: H, h0, headH } = R; rect(7, h0, 10, headH - 3, H.lo);
      for (let x = 7; x <= 16; x++) twist(R, x, h0 - 2 - (nz(x, 1, 92) % 2) - (x > 8 && x < 15 ? 1 : 0), h0 + headH - 3 - (x % 2));
      for (const x of [6, 17]) for (let y = h0; y < h0 + headH - 4; y++) put(x, y, (y & 1) ? H.lo : H.base); },
    side(R) { const { rect, hair: H, h0 } = R; rect(8, h0, 9, 2, H.lo); rect(8, h0 + 2, 3, 4, H.lo);
      for (let x = 8; x <= 16; x++) twist(R, x, h0 - 2 - (nz(x, 2, 93) % 2) - (x > 9 && x < 15 ? 1 : 0), h0 + 1);
      for (const x of [8, 9, 10]) twist(R, x, h0 + 2, h0 + 6 + (x === 9 ? 1 : 0)); twist(R, 16, h0 + 1, h0 + 3); twist(R, 7, h0, h0 + 5); },
  }),
  beadDreads: hs('Dreads med pärlor', 'Dreads & twists', {
    front(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); capF(R, 3);
      for (let x = 8; x <= 15; x += 2) for (let y = h0; y < h0 + 3; y++) if ((x + y) % 2 === 0) put(x, y, H.lo);
      loc(R, 5, h0 + 2, chin + 3, 1, false, false); loc(R, 6, h0 + 1, chin + 4, 1, false, true); loc(R, 7, h0 + 3, chin + 2, 1, false, false);
      loc(R, 18, h0 + 2, chin + 3, 1, true, true); loc(R, 17, h0 + 1, chin + 4, 1, true, false); loc(R, 16, h0 + 3, chin + 2, 1, true, false);
      put(9, h0 + 3, H.base); put(14, h0 + 3, H.lo); },
    back(R) { const { h0 } = R, { chin } = dims(R); backStd(R, h0 + 3, true);
      for (let x = 5; x <= 18; x++) loc(R, x, h0 + 2, chin + 2 + ((x * 5) % 3), 1, x > 11 || x % 2 === 1, x % 3 === 0); },
    side(R) { const { hair: H, h0 } = R, { chin } = dims(R); sideTop(R); R.put(15, h0 + 3, H.base); R.put(16, h0 + 3, H.lo);
      for (let x = 5; x <= 10; x++) loc(R, x, h0 + 2, chin + 2 + (x % 3), 1, x % 2 === 0, x === 6 || x === 9); },
  }),
  dreadHawk: hs('Dreads med rakade sidor', 'Dreads & twists', {
    // en rand dreads mitt på skallen som hänger ner på ryggen, sidorna rakade
    front(R) { const { rect, h0 } = R, s = shaved(R);
      rect(8, h0 - 1, 2, 1, s.a); rect(14, h0 - 1, 2, 1, s.b); rect(7, h0, 3, 3, s.a); rect(14, h0, 3, 3, s.b); col(R, 7, h0 + 3, h0 + 5, s.a); col(R, 16, h0 + 3, h0 + 5, s.b);
      for (let x = 10; x <= 13; x++) loc(R, x, h0 - 3 + (x === 10 || x === 13 ? 1 : 0), h0 + 1 + (x === 11 ? 1 : 0), 1, x >= 12, false); },
    back(R) { const { rect, h0, headH } = R, s = shaved(R), { chest } = dims(R);
      rect(8, h0 - 1, 8, 1, s.a); rect(7, h0, 10, headH - 3, s.a); col(R, 16, h0, h0 + headH - 4, s.b);
      for (let x = 9; x <= 14; x++) loc(R, x, h0 - 3 + (x === 9 || x === 14 ? 1 : 0), chest - ((x * 5) % 3), 1, x >= 12, x === 10 || x === 13); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R), { chest } = dims(R);
      rect(8, h0 + 1, 8, 1, s.a); rect(8, h0 + 2, 6, 1, s.a); rect(8, h0 + 3, 3, 4, s.a); put(13, h0 + 3, s.a); put(8, h0 + 6, s.b);
      const m = mask().row(h0 - 3, 10, 15).row(h0 - 2, 8, 16).rect(7, h0 - 1, 10, 2);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && (y + (x >> 1)) % 2 ? 'lo' : null) });
      for (const [x, y0, d] of [[8, h0 + 1, true], [7, h0 + 1, false], [6, h0, true], [5, h0 + 1, false]]) loc(R, x, y0, chest - (x % 3), 1, d, x === 6);
      put(16, h0 + 1, H.lo); },
  }),
};
