// Nya frisyrer: uppsatt hår (knutar, tofsar), hästsvansar och flätor. Samlas i HAIR_REG
// av hair.js. Varje post byggs med hs(label, grupp, { front, back, side }) – hs klipper
// frisyren under täckande huvudbonader (se hair-kit.js). R.hatted = en täckande hatt sitter
// på: höga knutar/svansar flyttas då ner eller döljs. Id:n får aldrig byta namn efter släpp.
import { hs, capF, backStd, backShort, sideStd, shaved, dims, nz, row, col, mask, paint, plait, sleekF, sleekB, sleekS, TIE } from './hair-kit.js';

// ritas bara där inget annat redan finns (öra, bål, armar ligger framför)
export const behind = (R, x, y, c) => { if (!R.has(x, y)) R.put(x, y, c); };
// hängande svans, w px bred från vänsterkanten x0, rad y0…y1, smalnar av i slutet
export const hang = (R, x0, y0, y1, w = 2, dark = false, bh = false) => {
  const { hair: H } = R, P = bh ? (x, y, c) => behind(R, x, y, c) : R.put;
  for (let y = y0; y <= y1; y++) {
    const end = y >= y1 - 1 && w > 1, ww = end ? w - 1 : w, off = end ? (y === y1 ? w >> 1 : 0) : 0;
    for (let i = 0; i < ww; i++) P(x0 + off + i, y, i === ww - 1 && ww > 1 ? (dark ? H.dk : H.lo) : i === 0 && !dark && y === y0 + 1 ? H.hi : dark ? H.lo : H.base);
    if (ww > 2 && (y - y0) % 4 === 3) P(x0 + off + 1, y, dark ? H.dk : H.lo);
  }
};
// bubbelsvans: runda bubblor (rader 2-4-4-2 px för w = 4) med en snodd emellan, rad y0…y1
export const BUBBLE = [0, 1, 1, 0]; // 0 = smal rad (w-2), 1 = bred rad (w)
export const bubbles = (R, x0, y0, y1, w = 4, bh = false) => {
  const { hair: H } = R, P = bh ? (x, y, c) => behind(R, x, y, c) : R.put;
  let y = y0;
  while (y <= y1) {
    for (let j = 0; j < BUBBLE.length && y <= y1; j++, y++) {
      const ww = BUBBLE[j] ? w : w - 2, x = x0 + ((w - ww) >> 1), last = j === BUBBLE.length - 1 || y === y1;
      for (let i = 0; i < ww; i++) {
        const c = i === 0 ? (j === 0 ? H.hi : j === 1 ? H.hi : H.base) : i === ww - 1 ? (last ? H.dk : H.lo) : last ? H.lo : H.base;
        P(x + i, y, c);
      }
    }
    if (y <= y1 - 2) { for (let i = 0; i < w - 2; i++) P(x0 + 1 + i, y, TIE); y++; } else break;
  }
};
// knut (oval) med lindningsspår
export const bun = (R, cx, cy, rx, ry, tex = true) => {
  const m = mask().oval(cx, cy, rx, ry);
  // nedersta raden mot huvudet blir mörk (skarven syns)
  let yb = -1; for (let y = 0; y < 40; y++) for (let x = 0; x < 24; x++) if (m.on(x, y)) yb = y;
  paint(R, m, { tex: (x, y, t) => (y === yb && R.has(x, y + 1) ? 'lo' : tex && t === 'base' && (x * 2 + y * 3) % 5 === 0 ? 'lo' : null) });
};
// palmtofs: kort tofs rakt upp på hjässan som faller ut åt sidorna (x = tofsens vänstra kolumn)
export const palm = (R, x) => {
  const { put, rect, hair: H, h0 } = R;
  rect(x, h0 - 2, 2, 1, TIE);
  put(x, h0 - 3, H.base); put(x + 1, h0 - 3, H.lo);
  rect(x - 1, h0 - 4, 4, 1, H.base); put(x - 1, h0 - 4, H.hi); put(x + 2, h0 - 4, H.lo);
  rect(x - 2, h0 - 5, 6, 1, H.base); put(x - 2, h0 - 5, H.hi); put(x, h0 - 5, H.hi); put(x + 3, h0 - 5, H.lo);
  put(x - 3, h0 - 4, H.base); put(x - 4, h0 - 3, H.lo); put(x + 4, h0 - 4, H.lo); put(x + 5, h0 - 3, H.dk);
};
// flätmönster (tvärgående ljusa/mörka band) på en mask
export const braidTex = (vertical) => (x, y) => { const k = vertical ? (y * 2 + (x & 1)) % 4 : (x * 2 + (y & 1)) % 4; return k === 0 ? 'hi' : k === 2 ? 'lo' : k === 3 ? 'dk' : 'base'; };
export const braidBand = (R, m, vertical) => paint(R, m, { tex: braidTex(vertical) });
// mittbena (hudlinje) framifrån
export const partF = (R) => { const { put, skin, hair: H, h0 } = R; put(11, h0, skin.base); put(11, h0 + 1, skin.base); put(11, h0 - 1, H.lo); put(12, h0, H.lo); };

export const HAIR_UPPSATT = {
  // ================= Hästsvansar =================
  highPony: hs('Hög häst­svans', 'Hästsvansar', {
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R; sleekF(R);
      if (!R.hatted) { rect(11, h0 - 2, 2, 1, TIE); put(11, h0 - 3, H.hi); put(12, h0 - 3, H.base); put(12, h0 - 4, H.lo); }
      for (let y = h0; y <= eyeRow + 2; y++) { behind(R, 17, y, H.lo); if (y > h0 + 1 && y < eyeRow + 2) behind(R, 18, y, H.dk); } },
    back(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); sleekB(R, true);
      if (R.hatted) { rect(11, h0 + 2, 2, 1, TIE); hang(R, 10, h0 + 3, chin + 2, 3); return; }
      put(11, h0 - 3, H.hi); put(12, h0 - 3, H.base); rect(11, h0 - 2, 2, 1, TIE); hang(R, 10, h0 - 1, chin + 3, 3); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); sleekS(R);
      if (R.hatted) { put(8, h0 + 2, TIE); hang(R, 6, h0 + 3, chin + 1, 2, true); return; }
      const m = mask().row(h0 - 3, 6, 8).row(h0 - 2, 5, 8).rect(4, h0 - 1, 3, eyeRow - h0 + 2).rect(5, eyeRow + 1, 2, chin - eyeRow).set(5, chin + 1);
      paint(R, m); put(8, h0 - 2, TIE); put(9, h0 - 2, TIE); put(8, h0 - 1, TIE); put(5, h0 + 2, H.lo); put(5, eyeRow, H.lo); },
  }),
  lowPony: hs('Låg häst­svans', 'Hästsvansar', {
    front(R) { const { chin } = dims(R); sleekF(R); partF(R); hang(R, 17, chin - 2, chin + 3, 2, true, true); },
    back(R) { const { rect, hair: H, h0 } = R, { chest } = dims(R), b = h0 + R.headH - 3; sleekB(R, false); col(R, 11, h0 - 1, h0 + 2, H.lo);
      rect(11, b - 1, 2, 1, TIE); hang(R, 11, b, chest, 2); },
    side(R) { const { put, h0 } = R, { chest } = dims(R), y = h0 + R.headH - 5; sleekS(R); put(8, y, TIE); put(8, y + 1, TIE); hang(R, 6, y + 1, chest - 1, 2, true); put(7, y, R.hair.base); },
  }),
  sidePony: hs('Sido­svans', 'Hästsvansar', {
    // svansen över personens vänstra axel (framifrån bildens högra)
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chest } = dims(R); sleekF(R); rect(10, h0 + 3, 6, 1, H.base); put(13, h0 + 3, H.lo); put(15, h0 + 4, H.lo);
      col(R, 16, h0 + 3, eyeRow - 1, H.lo); put(17, eyeRow - 1, TIE); put(17, eyeRow, TIE); put(16, eyeRow, TIE); hang(R, 16, eyeRow + 1, chest, 3, true); },
    back(R) { const { put, h0, eyeRow } = R, { chest } = dims(R); sleekB(R, false); put(6, eyeRow - 1, TIE); put(6, eyeRow, TIE); put(7, eyeRow, TIE); hang(R, 5, eyeRow + 1, chest, 3); put(9, h0 + 3, R.hair.lo); },
    side(R) { const { put, h0, eyeRow } = R, { chest } = dims(R); sleekS(R); put(15, h0 + 3, R.hair.base);
      if (!R.flip) return;
      put(10, eyeRow - 1, TIE); put(10, eyeRow, TIE); hang(R, 9, eyeRow + 1, chest, 3); },
  }),
  bubblePony: hs('Bubbel­svans', 'Hästsvansar', {
    // framifrån syns bara en bubbla som sticker fram bakom nacken/axeln
    front(R) { const { chin } = dims(R); sleekF(R); partF(R); bubbles(R, 16, chin - 1, chin + 3, 4, true); },
    back(R) { const { rect, h0 } = R, { chest } = dims(R); sleekB(R, true); rect(11, h0 + 1, 2, 1, TIE); bubbles(R, 10, h0 + 2, chest, 4); },
    side(R) { const { put, rect, hair: H, h0 } = R, { chest } = dims(R); sleekS(R);
      rect(6, h0 + 1, 2, 1, H.base); put(8, h0 + 1, TIE); put(8, h0 + 2, TIE); bubbles(R, 4, h0 + 2, chest - 1, 4); },
  }),

  // ================= Uppsatt =================
  messyBun: hs('Rufsig knut', 'Uppsatt', {
    front(R) { const { put, hair: H, h0, eyeRow } = R; capF(R, 3); put(9, h0 + 1, H.lo); put(14, h0 + 2, H.lo);
      bun(R, 11.5, h0 - 2.4, 3.6, 2.5); put(8, h0 - 4, H.base); put(15, h0 - 5, H.lo); put(10, h0 - 5, H.hi); put(16, h0 - 3, H.lo);
      for (let y = h0 + 3; y <= eyeRow + 2; y++) { put(7, y, y % 2 ? H.base : H.lo); put(16, y, H.lo); } put(8, h0 + 3, H.base); put(15, h0 + 3, H.lo); },
    back(R) { const { put, hair: H, h0 } = R; const b = h0 + R.headH - 3; sleekB(R, true);
      bun(R, 11.5, h0 - 2.4, 3.6, 2.5); put(8, h0 - 4, H.base); put(15, h0 - 5, H.lo); put(10, h0 - 5, H.hi); put(16, h0 - 3, H.lo);
      put(9, b, H.lo); put(9, b + 1, H.lo); put(14, b, H.lo); },
    side(R) { const { put, hair: H, h0, eyeRow } = R; sideStd(R);
      bun(R, 9.5, h0 - 2.2, 3, 2.5); put(6, h0 - 4, H.base); put(12, h0 - 4, H.lo); put(8, h0 - 5, H.hi);
      for (let y = h0 + 3; y <= eyeRow + 2; y++) put(14, y, y % 2 ? H.base : H.lo); put(8, h0 + 7, H.lo); },
  }),
  lowBun: hs('Knut i nacken', 'Uppsatt', {
    front(R) { const { hair: H, h0, eyeRow } = R; capF(R, 3); partF(R);
      const m = mask().rect(6, h0 + 1, 2, eyeRow - h0 - 1).rect(16, h0 + 1, 2, eyeRow - h0 - 1).row(h0 + 3, 8, 9).row(h0 + 3, 14, 15); paint(R, m); R.put(7, eyeRow - 1, H.lo); },
    back(R) { const { hair: H, h0, eyeRow } = R; backShort(R); col(R, 11, h0 - 1, h0 + 3, H.lo);
      bun(R, 11.5, eyeRow + 3, 3.2, 2); },
    side(R) { const { hair: H, h0, eyeRow } = R; sideStd(R); R.rect(8, h0 + 3, 4, eyeRow - h0 - 3, H.base); col(R, 8, h0 + 3, eyeRow - 1, H.lo);
      bun(R, 7.5, eyeRow + 3, 2.2, 1.9); },
  }),
  halfUp: hs('Halv­upp­satt', 'Uppsatt', {
    front(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      rect(6, h0 + 1, 2, chin + 3 - h0, H.base); rect(16, h0 + 1, 2, chin + 3 - h0, H.lo); put(6, h0 + 2, H.hi); row(R, chin + 3, 6, 7, H.lo); row(R, chin + 3, 16, 17, H.dk);
      bun(R, 11.5, h0 - 2, 2.6, 1.6, false); put(10, h0 - 2, H.hi); },
    back(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R); backStd(R, chin + 4, true);
      for (let k = 0; k < 3; k++) { put(8 + k, h0 + 3 - k, H.lo); put(15 - k, h0 + 3 - k, H.lo); }
      bun(R, 11.5, h0 + 0.5, 2.6, 1.6, false); rect(11, h0 + 2, 2, 1, TIE); col(R, 10, h0 + 5, chin + 1, H.lo); col(R, 14, h0 + 5, chin + 1, H.lo); },
    side(R) { const { rect, hair: H, h0 } = R, { chin } = dims(R); sideStd(R, false); rect(7, h0 + 1, 4, chin + 3 - h0, H.base); col(R, 7, h0 + 1, chin + 3, H.lo); row(R, chin + 3, 7, 10, H.lo);
      bun(R, 8, h0 - 1, 2.2, 1.8, false); R.put(9, h0 + 1, TIE); },
  }),
  manBun: hs('Knut & under­cut', 'Uppsatt', {
    front(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(8, h0 - 1, 8, 1, H.base); rect(8, h0, 8, 2, H.base); rect(9, h0 - 1, 3, 1, H.hi); col(R, 15, h0, h0 + 1, H.lo); put(10, h0 + 1, H.lo); put(13, h0 + 1, H.lo); put(11, h0, H.lo);
      col(R, 7, h0, h0 + 5, s.a); col(R, 16, h0, h0 + 5, s.b); rect(8, h0 + 2, 1, 1, s.a); put(15, h0 + 2, s.b);
      if (!R.hatted) bun(R, 11.5, h0 - 2.5, 2.4, 1.6, false); },
    back(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R), y1 = h0 + R.headH - 4;
      rect(7, h0 + 2, 10, y1 - h0 - 2, s.a); rect(8, y1, 8, 1, s.a); col(R, 16, h0 + 2, y1 - 1, s.b);
      rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, 2, H.base); col(R, 16, h0, h0 + 1, H.lo); put(9, h0 + 1, H.lo); put(14, h0 + 1, H.lo);
      bun(R, 11.5, h0 - 0.5, 2.8, 2); rect(10, h0 + 2, 4, 1, R.hatted ? s.a : H.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(9, h0 - 1, 7, 1, H.base); rect(9, h0, 8, 2, H.base); rect(10, h0 - 1, 3, 1, H.hi); put(12, h0 + 1, H.lo); put(14, h0, H.lo); put(16, h0 + 1, H.lo);
      put(8, h0, s.a); put(8, h0 + 1, s.a); rect(8, h0 + 2, 6, 1, s.a); R.rect(8, h0 + 3, 3, 4, s.a); put(8, h0 + 6, s.b); col(R, 13, h0 + 3, h0 + 4, s.a);
      bun(R, 7.5, h0 - 0.5, 2.2, 2); },
  }),
  lowSpace: hs('Låga knutar', 'Uppsatt', {
    front(R) { const { hair: H, h0, eyeRow } = R; sleekF(R); partF(R);
      for (const cx of [5.5, 17.5]) { const m = mask().oval(cx, eyeRow + 2.5, 2.1, 1.9); for (let y = 0; y < 40; y++) for (let x = 0; x < 24; x++) if (m.on(x, y) && R.has(x, y)) m.cut(x, y); paint(R, m); }
      R.put(5, eyeRow + 1, H.hi); },
    back(R) { const { hair: H, h0, eyeRow } = R; sleekB(R, false); col(R, 11, h0 - 1, h0 + 3, H.lo); bun(R, 7.5, eyeRow + 2.5, 2.6, 2); bun(R, 15.5, eyeRow + 2.5, 2.6, 2); },
    side(R) { const { eyeRow } = R; sleekS(R); bun(R, 7.5, eyeRow + 2.5, 2.4, 2); },
  }),
  lowPigtails: hs('Låga tofsar', 'Uppsatt', {
    front(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); sleekF(R); partF(R);
      col(R, 6, h0 + 2, eyeRow, H.base); col(R, 17, h0 + 2, eyeRow, H.lo); put(6, h0 + 2, H.hi);
      put(6, eyeRow + 1, TIE); put(5, eyeRow + 1, TIE); put(17, eyeRow + 1, TIE); put(18, eyeRow + 1, TIE);
      hang(R, 5, eyeRow + 2, chin + 3, 2); hang(R, 17, eyeRow + 2, chin + 3, 2, true); },
    back(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); sleekB(R, false); col(R, 11, h0 - 1, h0 + R.headH - 5, H.lo);
      put(6, eyeRow + 1, TIE); put(7, eyeRow + 1, TIE); put(16, eyeRow + 1, TIE); put(17, eyeRow + 1, TIE); hang(R, 6, eyeRow + 2, chin + 3, 2); hang(R, 16, eyeRow + 2, chin + 3, 2, true); },
    side(R) { const { put, eyeRow } = R, { chin } = dims(R); sleekS(R); put(9, eyeRow + 1, TIE); put(10, eyeRow + 1, TIE); hang(R, 9, eyeRow + 2, chin + 3, 2, true); },
  }),
  palmTuft: hs('Palm­tofs', 'Uppsatt', {
    // under en täckande hatt klipps tofsen bort (hs)
    front(R) { sleekF(R); palm(R, 11); },
    back(R) { sleekB(R, true); palm(R, 11); },
    side(R) { sleekS(R); palm(R, 11); },
  }),

  // ================= Flätor =================
  boxer: hs('Boxer­flätor', 'Flätor', {
    front(R) { const { put, skin, h0, eyeRow } = R, { chin } = dims(R);
      braidBand(R, mask().rows([[h0 - 1, 8, 10], [h0, 7, 10], [h0 + 1, 7, 10], [h0 + 2, 7, 9]]), true);
      braidBand(R, mask().rows([[h0 - 1, 13, 15], [h0, 13, 16], [h0 + 1, 13, 16], [h0 + 2, 14, 16]]), true);
      for (let y = h0 - 1; y <= h0 + 2; y++) { put(11, y, y < h0 + 2 ? R.hair.lo : skin.base); put(12, y, y < h0 + 2 ? R.hair.dk : skin.base); }
      col(R, 7, h0 + 3, eyeRow - 2, R.hair.base); col(R, 16, h0 + 3, eyeRow - 2, R.hair.lo);
      plait(R, () => 5, eyeRow, chin + 3, false); plait(R, () => 17, eyeRow, chin + 3, true); },
    back(R) { const { hair: H, h0 } = R, { chin } = dims(R); backShort(R); col(R, 11, h0 - 1, h0 + R.headH - 4, H.dk); col(R, 12, h0 - 1, h0 + R.headH - 4, H.lo);
      plait(R, () => 8, h0 - 1, chin + 4, false); plait(R, () => 14, h0 - 1, chin + 4, true); },
    side(R) { const { h0, eyeRow } = R, { chin } = dims(R); sleekS(R);
      braidBand(R, mask().rows([[h0 - 1, 10, 15], [h0, 9, 15], [h0 + 1, 8, 10], [h0 + 2, 8, 10]]), false);
      plait(R, () => 8, h0 + 3, chin + 3, false); if (eyeRow) R.put(15, h0 + 3, R.hair.base); },
  }),
  frenchBraid: hs('Fransk fläta', 'Flätor', {
    front(R) { const { h0 } = R; sleekF(R); partF(R); braidBand(R, mask().rows([[h0 - 1, 10, 13], [h0, 10, 13], [h0 + 1, 11, 12]]), true); },
    back(R) { const { h0 } = R, { chest } = dims(R); sleekB(R, false);
      braidBand(R, mask().rect(10, h0 - 1, 4, 4).rect(10, h0 + 3, 4, R.headH - 6).rect(11, h0 + R.headH - 3, 2, 2), true);
      plait(R, () => 11, h0 + R.headH - 1, chest, false); },
    side(R) { const { h0 } = R, { chest } = dims(R); sleekS(R);
      braidBand(R, mask().rows([[h0 - 1, 9, 13], [h0, 8, 10], [h0 + 1, 8, 9], [h0 + 2, 8, 9], [h0 + 3, 8, 9], [h0 + 4, 8, 9]]), false);
      plait(R, () => 7, h0 + 5, chest - 1, false); },
  }),
  sideBraid: hs('Sido­fläta', 'Flätor', {
    // flätan över personens vänstra axel (framifrån bildens högra)
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R, { chest } = dims(R); capF(R, 3); rect(10, h0 + 3, 6, 1, H.base); rect(13, h0 + 4, 3, 1, H.lo); put(12, h0 + 3, H.lo);
      col(R, 7, h0 + 3, eyeRow - 2, H.base); rect(16, h0 + 1, 2, eyeRow - h0, H.lo); put(18, eyeRow, H.lo); plait(R, () => 16, eyeRow + 1, chest, true); },
    back(R) { const { rect, hair: H, h0, eyeRow } = R, { chest } = dims(R); backShort(R); rect(6, h0 + 2, 2, eyeRow - h0 - 1, H.base); col(R, 9, h0 + 1, h0 + 5, H.lo); plait(R, () => 6, eyeRow + 1, chest, false); },
    side(R) { const { hair: H, h0, eyeRow } = R, { chest } = dims(R); sleekS(R); R.put(15, h0 + 3, H.base);
      if (!R.flip) return; R.rect(8, h0 + 3, 3, eyeRow - h0 - 2, H.base); plait(R, (y) => (y < eyeRow + 4 ? 9 : 10), eyeRow + 1, chest, false); },
  }),
  crownBraid: hs('Flät­krona', 'Flätor', {
    front(R) { const { h0 } = R; capF(R, 3); braidBand(R, mask().row(h0 - 2, 9, 14).row(h0 - 1, 7, 16).rect(6, h0, 2, 4).rect(16, h0, 2, 4).row(h0, 8, 15).set(8, h0 - 2).set(15, h0 - 2), false); },
    back(R) { const { h0, eyeRow } = R; backShort(R); braidBand(R, mask().rect(6, h0 + 1, 2, eyeRow - h0 - 2).rect(16, h0 + 1, 2, eyeRow - h0 - 2).rect(6, eyeRow - 2, 12, 2), false); },
    side(R) { const { h0 } = R; sideStd(R);
      braidBand(R, mask().rows([[h0 - 2, 12, 16], [h0 - 1, 11, 16], [h0, 10, 12], [h0 + 1, 9, 11], [h0 + 2, 8, 10], [h0 + 3, 7, 9], [h0 + 4, 7, 9]]), false); },
  }),
  cornrows: hs('Corn­rows', 'Flätor', {
    front(R) { const { put, hair: H, skin, h0, eyeRow } = R, gap = mix2(R);
      for (let y = h0 - 1; y <= h0 + 2; y++) for (let x = 7; x <= 16; x++) {
        if (y === h0 - 1 && (x < 8 || x > 15)) continue;
        put(x, y, x % 2 ? gap : (y & 1) ? H.lo : x < 12 ? H.hi : H.base);
      }
      col(R, 7, h0 + 3, eyeRow - 3, H.lo); col(R, 16, h0 + 3, eyeRow - 3, H.dk); put(8, h0 + 2, skin.base); put(15, h0 + 2, skin.base); },
    back(R) { const { put, hair: H, h0, headH } = R, { chin } = dims(R), gap = mix2(R), b = h0 + headH - 4;
      for (let y = h0 - 1; y <= b; y++) for (let x = 7; x <= 16; x++) {
        if ((y === h0 - 1 || y === b) && (x < 8 || x > 15)) continue;
        put(x, y, x % 2 ? gap : (y & 1) ? H.lo : x < 12 ? H.hi : H.base);
      }
      for (const x of [8, 10, 12, 14]) for (let y = b + 1; y <= chin + 2 - (x % 4 ? 1 : 0); y++) put(x, y, (y & 1) ? H.lo : H.base); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R), gap = mix2(R);
      for (let y = h0 - 1; y <= h0 + 6; y++) for (let x = 8; x <= 16; x++) {
        if (y === h0 - 1 && (x < 9 || x > 15)) continue;
        if (y > h0 + 2 && x > 10) continue;
        put(x, y, y % 2 === 0 ? gap : (x & 1) ? H.lo : H.base);
      }
      for (const x of [8, 10]) for (let y = h0 + 7; y <= chin + 1; y++) put(x, y, (y & 1) ? H.lo : H.base); },
  }),
  boxBraids: hs('Box braids', 'Flätor', {
    front(R) { const { put, hair: H, skin, h0 } = R, { chest } = dims(R); capF(R, 3);
      for (const [x, y] of [[9, 0], [12, 1], [14, 0], [10, 2], [13, 2]]) put(x, h0 + y, mix2(R));
      for (const [x, e] of [[4, 2], [5, 0], [6, 1], [7, 3]]) mini(R, x, h0 + 1 + (x === 7 ? 2 : 0), chest - e, false);
      for (const [x, e] of [[19, 2], [18, 0], [17, 1], [16, 3]]) mini(R, x, h0 + 1 + (x === 16 ? 2 : 0), chest - e, true);
      put(8, h0 + 3, H.base); put(15, h0 + 3, H.lo); if (skin) put(11, h0 + 3, H.base); },
    back(R) { const { put, h0 } = R, { chest } = dims(R); backStd(R, h0 + 3, true);
      for (const [x, y] of [[9, 0], [12, 1], [15, 0]]) put(x, h0 + y, mix2(R));
      for (let x = 5; x <= 18; x++) mini(R, x, h0 + 2, chest - ((x * 7) % 3), x > 11); },
    side(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sideStd(R, false); put(12, h0 + 1, mix2(R)); put(14, h0, mix2(R));
      for (let x = 4; x <= 10; x++) mini(R, x, h0 + 2, chest - ((x * 5) % 3), x % 2 === 0); put(15, h0 + 3, H.base); },
  }),
  pippi: hs('Pippi­flätor', 'Flätor', {
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R; capF(R, 3); partF(R); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.lo);
      col(R, 7, h0 + 3, eyeRow - 2, H.base); col(R, 16, h0 + 3, eyeRow - 2, H.lo);
      stick(R, eyeRow - 2, false); },
    back(R) { const { eyeRow } = R; backShort(R); col(R, 11, R.h0 - 1, R.h0 + R.headH - 5, R.hair.lo); stick(R, eyeRow - 2, true); },
    side(R) { const { put, hair: H, h0, eyeRow } = R; sideStd(R);
      const y = eyeRow - 2; // flätan pekar utåt/bakåt – förkortad
      put(9, y, H.base); put(8, y - 1, H.lo); put(7, y - 1, H.base); put(6, y - 2, H.lo); put(5, y - 2, H.base); put(8, y, H.lo);
      put(4, y - 3, TIE); put(5, y - 3, TIE); put(3, y - 4, H.base); put(4, y - 4, H.hi); put(3, y - 3, H.lo); put(10, h0 + 3, H.lo); },
  }),
};

// ---------- hjälpare som används ovan (hoistade funktioner) ----------
// mörk skåra mellan flätrader (hårbotten syns)
export function mix2(R) { const s = shaved(R); return s.b; }
// smal fläta (1 px) med tydligt flätmönster, x = kolumnen
export function mini(R, x, y0, y1, dark) {
  const { put, hair: H } = R;
  if (x % 2) { for (let y = y0; y <= y1; y++) put(x, y, dark ? H.dk : H.lo); return; } // skåra
  for (let y = y0; y <= y1; y++) { const k = (y + (x >> 1)) % 3; put(x, y, k === 0 ? (dark ? H.base : H.hi) : k === 1 ? (dark ? H.lo : H.base) : dark ? H.dk : H.lo); }
  if (nz(x, y1, 9) < 60) put(x, y1 + 1, dark ? H.lo : H.base);
}
// Pippiflätor som står rakt ut från sidorna (framifrån/bakifrån), med snodd och tofs
export function stick(R, y, back) {
  const { put, hair: H } = R;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 6 : 17, d = side, dark = back ? side < 0 : side > 0;
    for (let k = 0; k < 5; k++) {
      const x = x0 + d * k, yy = y - (k >> 1);
      put(x, yy, (k & 1) ? (dark ? H.dk : H.lo) : dark ? H.lo : H.base);
      put(x, yy + 1, (k & 1) ? (dark ? H.lo : H.base) : dark ? H.dk : H.lo);
    }
    const xe = x0 + d * 5, ye = y - 2;
    put(xe, ye, TIE); put(xe, ye + 1, TIE);
    put(xe + d, ye - 1, H.base); put(xe + d, ye, H.lo); put(xe + d, ye + 1, H.base); put(xe + d, ye + 2, H.lo);
  }
}
