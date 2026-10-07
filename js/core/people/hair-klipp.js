// Nya frisyrer (omgång 2 – frisören): kort hår, rakat, lugg, mellanlångt och långt hår.
// Samlas i HAIR_REG av hair.js. Varje post byggs med hs(label, grupp, { front, back, side }) –
// hs klipper frisyren under täckande huvudbonader (se hair-kit.js). Id:n får aldrig byta namn
// efter släpp. Koordinater och ljus: se hair-kit.js och docs/PEOPLE-ARKITEKTUR.md.
import { hs, capF, backStd, sideTop, sideStd, shaved, dims, nz, row, col, mask, paint } from './hair-kit.js';
import { buzzF, buzzS, buzzB } from './hair-kort.js';
import { WAVE, behind, curtF, longS, backTo, strands } from './hair-mellan.js';
import { plait } from './hair-kit.js';
import { $t, $n } from '../i18n.js';

// ---------- delade småbitar ----------
// målar masken bara där inget redan är ritat (håret hänger bakom kroppen/armarna)
const paintBehind = (R, m, o) => { const put = R.put, B = Object.create(R); B.put = (x, y, c) => { if (!R.has(x, y)) put(x, y, c); }; paint(B, m, o); };
// rakade tinningar framifrån, rad y0 … y1 (a = ljus sida, b = skuggsida)
const tempF = (R, y0, y1) => { const s = shaved(R); col(R, 7, y0, y1, s.a); col(R, 16, y0, y1, s.b); };
// rakad nacke bakifrån från rad y0
const napeB = (R, y0) => { const { rect, h0, headH } = R, s = shaved(R), y1 = h0 + headH - 4; if (y1 > y0) rect(7, y0, 10, y1 - y0, s.a); rect(8, y1, 8, 1, s.a); col(R, 16, y0, y1 - 1, s.b); };
// rakat bakom örat från sidan, rad y0 … nacken
const napeS = (R, y0) => { const s = shaved(R); R.rect(8, y0, 3, R.h0 + 7 - y0, s.a); R.put(8, R.h0 + 6, s.b); };
// mittbena framifrån
const partMid = (R) => { const { put, skin, hair: H, h0 } = R; put(11, h0, skin.base); put(11, h0 + 1, skin.base); put(11, h0 - 1, H.lo); put(12, h0, H.lo); };
// höften och knäna (rad) – för jättelångt hår
const hipOf = (R) => R.hy;
const kneeOf = (R) => R.legTop + (R.K ? 2 : 4);
// tunt, överkammat hår: hårstrån med huden emellan (var tredje pixel)
const thinTop = (R, y, x0, x1, ph) => { const s = shaved(R); for (let x = x0; x <= x1; x++) { const k = (x + ph) % 3; R.put(x, y, k === 0 ? s.f : k === 1 ? R.hair.base : R.hair.lo); } };
// vågornas inre skuggstreck (S-vågor, WAVE)
const waveOf = (R, y) => WAVE[(((y - R.h0) % 6) + 6) % 6];

export const HAIR_KLIPP = {
  // ================= Kort hår =================
  ivy: hs($t('Ivy League'), $n('Kort hår'), {
    // kort sidbena på personens högra sida (framifrån bildens vänstra), luggen svept åt andra hållet
    front(R) { const { put, hair: H, h0 } = R, s = shaved(R);
      paint(R, mask().rows([[h0 - 2, 10, 14], [h0 - 1, 8, 16], [h0, 7, 16], [h0 + 1, 7, 16], [h0 + 2, 11, 16]]));
      put(9, h0 - 1, s.f); put(9, h0, s.f); put(8, h0 + 1, H.lo);
      for (const [x, y] of [[11, 0], [12, -1], [13, 1], [14, 0], [15, 2], [12, 2]]) put(x, h0 + y, H.lo);
      put(10, h0 - 1, H.hi); put(11, h0 - 2, H.hi); put(12, h0 - 2, H.hi); put(10, h0, H.hi);
      col(R, 7, h0 + 2, h0 + 4, s.a); col(R, 16, h0 + 3, h0 + 4, s.b); put(8, h0 + 2, s.a); },
    back(R) { const { put, hair: H, h0 } = R;
      paint(R, mask().rows([[h0 - 2, 10, 14], [h0 - 1, 8, 15]]).rect(7, h0, 10, 3));
      for (const [x, y] of [[10, 0], [13, 1], [9, 2], [12, 2], [15, 1]]) put(x, h0 + y, H.lo);
      napeB(R, h0 + 3); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      paint(R, mask().rows([[h0 - 2, 11, 15], [h0 - 1, 9, 16], [h0, 8, 17], [h0 + 1, 8, 16], [h0 + 2, 13, 16]]));
      put(12, h0, H.lo); put(14, h0 + 1, H.lo); put(10, h0 + 1, H.lo); put(16, h0 + 2, H.lo);
      rect(8, h0 + 2, 5, 1, s.a); napeS(R, h0 + 3); put(13, h0 + 3, s.a); put(13, h0 + 4, s.a); },
  }),
  edgar: hs($t('Edgar'), $n('Kort hår'), {
    // rak, tjock lugg som ett streck över pannan, rundad topp och tonade sidor
    front(R) { const { put, hair: H, h0, eyeRow, K } = R, s = shaved(R), f = h0 + (K ? 2 : 3);
      paint(R, mask().rows([[h0 - 2, 9, 14], [h0 - 1, 8, 15]]).rect(7, h0, 10, f - h0 + 1));
      row(R, f, 8, 15, H.lo); put(16, f, H.dk); put(7, f, H.lo);
      for (const x of [9, 12, 14]) put(x, f - 1, H.lo); put(10, h0, H.lo); put(13, h0 + 1, H.lo);
      put(7, f + 1, s.a); put(16, f + 1, s.b); col(R, 7, f + 2, eyeRow - 1, s.f); col(R, 16, f + 2, eyeRow - 1, s.f); },
    back(R) { const { rect, put, hair: H, h0, headH } = R, s = shaved(R);
      paint(R, mask().rows([[h0 - 2, 9, 14], [h0 - 1, 8, 15]]).rect(7, h0, 10, 3));
      put(10, h0, H.lo); put(13, h0 + 1, H.lo);
      rect(7, h0 + 3, 10, 2, s.a); col(R, 16, h0 + 3, h0 + 4, s.b); rect(7, h0 + 5, 10, headH - 9, s.f); rect(8, h0 + headH - 4, 8, 1, s.f); },
    side(R) { const { rect, put, hair: H, h0, K } = R, s = shaved(R), f = h0 + (K ? 2 : 3);
      const m = mask().rows([[h0 - 2, 10, 14], [h0 - 1, 9, 16], [h0, 8, 17], [h0 + 1, 8, 17]]);
      for (let y = h0 + 2; y <= f; y++) m.row(y, 13, 17);
      paint(R, m); put(12, h0, H.lo); put(15, h0 + 1, H.lo); row(R, f, 14, 17, H.lo);
      rect(8, h0 + 2, 5, 1, s.a); rect(8, h0 + 3, 3, 4, s.f); put(8, h0 + 3, s.a); put(9, h0 + 3, s.a); put(13, f + 1, s.f); put(13, f + 2, s.f); },
  }),
  combOver: hs($t('Över­kamning'), $n('Kort hår'), {
    // tunt hår kammat över flinten från en låg bena ovanför örat – flinten lyser igenom
    front(R) { const { put, hair: H, skin, h0, eyeRow } = R, s = shaved(R);
      thinTop(R, h0, 8, 15, 0); thinTop(R, h0 + 1, 7, 16, 1); put(10, h0, skin.hi);
      put(7, h0 + 2, s.f); col(R, 7, h0 + 3, eyeRow - 1, H.base); put(6, h0 + 4, H.base); put(6, h0 + 5, H.lo);
      col(R, 16, h0 + 2, eyeRow - 1, H.lo); put(17, h0 + 1, H.lo); put(17, h0 + 2, H.dk); put(17, h0 + 5, H.lo); },
    back(R) { const { rect, put, hair: H, skin, h0, eyeRow, headH } = R, b = h0 + headH - 3;
      thinTop(R, h0, 8, 15, 2); thinTop(R, h0 + 1, 7, 16, 0); put(11, h0 + 2, skin.hi); put(12, h0 + 2, skin.hi);
      rect(7, eyeRow - 3, 10, b - eyeRow + 3, H.base); row(R, b - 1, 8, 15, H.lo); col(R, 16, eyeRow - 3, b - 2, H.lo);
      for (const x of [9, 12, 15]) put(x, eyeRow - 2, H.lo); put(8, eyeRow - 3, H.hi); put(9, eyeRow - 3, H.hi);
      put(6, eyeRow - 2, H.base); put(17, eyeRow - 2, H.lo); put(17, h0 + 1, H.lo); },
    side(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R;
      thinTop(R, h0, 9, 16, 1); thinTop(R, h0 + 1, 8, 15, 2); put(13, h0, skin.hi);
      rect(8, eyeRow - 3, 3, 5, H.base); col(R, 8, eyeRow - 2, eyeRow + 1, H.lo); put(10, eyeRow + 1, H.lo);
      put(11, eyeRow - 3, H.base); put(12, eyeRow - 3, H.lo); put(7, eyeRow - 2, H.base);
      if (R.flip) { put(17, h0 + 1, H.lo); put(17, h0 + 2, H.dk); } },
  }),
  receding: hs($t('Vikande hår­fäste'), $n('Kort hår'), {
    // kort hår med djupa vikar vid tinningarna och en spets mitt i pannan
    front(R) { const { put, hair: H, skin, h0, eyeRow } = R;
      paint(R, mask().row(h0 - 1, 9, 14).row(h0, 10, 13).row(h0 + 1, 11, 12).set(7, h0 + 1).set(16, h0 + 1).col(7, h0 + 2, eyeRow - 2).col(16, h0 + 2, eyeRow - 2));
      put(9, h0, skin.hi); put(8, h0 + 1, skin.hi); put(12, h0 - 1, H.lo); put(12, h0 + 1, H.lo); put(11, h0 - 1, H.hi); },
    back(R) { const { put, hair: H, h0 } = R;
      paint(R, mask().row(h0 - 1, 8, 15).rect(7, h0, 10, R.headH - 4));
      for (const x of [9, 12, 15]) put(x, h0 + 2, H.lo); put(10, h0 + 4, H.lo); put(13, h0 + 5, H.lo); put(11, h0 + 1, H.lo); },
    side(R) { const { put, hair: H, skin, h0 } = R, s = shaved(R);
      paint(R, mask().row(h0 - 1, 9, 13).row(h0, 8, 13).row(h0 + 1, 8, 12).row(h0 + 2, 8, 11).rect(8, h0 + 3, 3, 4));
      put(14, h0, skin.hi); put(15, h0 + 1, skin.hi); put(12, h0 + 1, H.lo); put(10, h0, H.lo); put(9, h0 + 4, H.lo);
      put(12, h0 + 3, s.a); put(13, h0 + 3, s.a); put(13, h0 + 4, s.a); },
  }),
  boyCut: hs($t('Pojk­lugg'), $n('Kort hår'), {
    // rundklippt med lugg ner mot ögonbrynen, håret över öronen och fransiga toppar
    front(R) { const { put, hair: H, h0, eyeRow, K } = R, full = h0 + (K ? 2 : 3);
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 7, 16]]).rect(6, h0, 12, full - h0 + 1);
      for (const x of [7, 8, 9, 11, 12, 14, 15, 16]) m.set(x, full + 1);
      for (let y = full + 1; y < eyeRow; y++) m.set(6, y).set(17, y);
      m.set(7, full + 2).set(16, full + 2).set(5, h0 + 2).set(18, h0 + 3);
      paint(R, m);
      for (const [x, y] of [[10, 0], [13, 1], [9, 2], [12, 2], [15, 2], [8, 1]]) put(x, h0 + y, H.lo); put(10, full + 1, H.dk); put(13, full + 1, H.dk); },
    back(R) { const { put, hair: H, h0, headH } = R, b = h0 + headH - 3;
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 7, 16]]).rect(6, h0, 12, b - h0);
      for (const x of [7, 8, 10, 11, 13, 14, 16]) m.set(x, b);
      m.cut(6, b - 1).cut(17, b - 1).set(5, h0 + 2).set(18, h0 + 3);
      paint(R, m); for (const [x, y] of [[9, 1], [12, 0], [14, 2], [10, 4], [13, 5], [8, 6], [15, 6]]) put(x, h0 + y, H.lo); },
    side(R) { const { put, hair: H, h0, eyeRow, K } = R, full = h0 + (K ? 2 : 3);
      const m = mask().rows([[h0 - 2, 10, 14], [h0 - 1, 8, 16]]).rect(7, h0, 10, full - h0 + 1).rect(7, full + 1, 4, eyeRow - full).col(11, full + 1, eyeRow - 2);
      m.set(15, full + 1).set(16, full + 1).set(17, full).set(6, h0 + 2).set(7, eyeRow + 1).set(9, eyeRow + 1);
      paint(R, m); put(12, h0, H.lo); put(14, h0 + 1, H.lo); put(10, h0 + 2, H.lo); put(9, eyeRow - 1, H.lo); put(16, full, H.lo); },
  }),

  // ================= Rakat =================
  tonsure: hs($t('Munk­frisyr'), $n('Rakat'), {
    // rakad hjässa, en krans av hår runt huvudet och en kort lugg
    front(R) { const { put, hair: H, skin, h0, eyeRow } = R;
      paint(R, mask().rect(7, h0 + 1, 10, 2).row(h0 + 3, 8, 15).col(7, h0 + 3, eyeRow - 1).col(16, h0 + 3, eyeRow - 1));
      for (const x of [9, 11, 14]) put(x, h0 + 3, H.lo); put(10, h0 + 2, H.lo); put(13, h0 + 2, H.lo);
      put(9, h0, skin.hi); put(10, h0, skin.hi); put(11, h0 - 0, skin.hi); },
    back(R) { const { put, hair: H, skin, h0, headH } = R, b = h0 + headH - 3;
      paint(R, mask().rect(7, h0 + 2, 10, b - h0 - 2).row(h0 + 1, 7, 8).row(h0 + 1, 15, 16));
      for (const x of [9, 12, 15]) put(x, h0 + 4, H.lo); put(11, b - 2, H.lo); put(13, b - 3, H.lo);
      put(10, h0, skin.hi); put(11, h0, skin.hi); put(12, h0 + 1, skin.hi); },
    side(R) { const { put, hair: H, skin, h0 } = R;
      paint(R, mask().row(h0 + 1, 13, 16).row(h0 + 2, 8, 16).rect(8, h0 + 3, 3, 4).set(15, h0 + 3).set(16, h0 + 3));
      put(12, h0, skin.hi); put(13, h0, skin.hi); put(11, h0 + 1, skin.hi); put(14, h0 + 2, H.lo); put(10, h0 + 2, H.lo); put(15, h0 + 3, H.lo); },
  }),
  rattail: hs($t('Rått­svans'), $n('Rakat'), {
    // snaggat med korta taggar på toppen och en lång tunn flätad svans i nacken (80-tal)
    front(R) { const { put, hair: H, h0 } = R, s = shaved(R);
      paint(R, mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 2).set(9, h0 - 2).set(11, h0 - 2).set(12, h0 - 3).set(14, h0 - 2));
      row(R, h0 + 2, 8, 15, s.a); tempF(R, h0 + 2, h0 + 4); put(10, h0, H.lo); put(13, h0 + 1, H.lo); put(12, h0 - 2, H.hi); },
    back(R) { const { put, hair: H, h0, headH } = R, { chest } = dims(R), b = h0 + headH - 3;
      paint(R, mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 2).set(9, h0 - 2).set(11, h0 - 2).set(12, h0 - 3).set(14, h0 - 2));
      put(10, h0, H.lo); put(13, h0 + 1, H.lo); napeB(R, h0 + 2);
      // svansen: en rand längre hår i nacken som blir en tunn fläta ner på ryggen
      col(R, 11, h0 + 3, b, H.base); col(R, 12, h0 + 3, b, H.lo);
      plait(R, () => 11, b + 1, chest - 1, false, false); put(11, chest, H.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R), { chest } = dims(R);
      paint(R, mask().row(h0 - 1, 9, 15).rect(8, h0, 9, 2).set(10, h0 - 2).set(12, h0 - 2).set(13, h0 - 3).set(14, h0 - 2));
      rect(8, h0 + 2, 5, 1, s.a); napeS(R, h0 + 3); put(13, h0 + 3, s.a); put(13, h0 + 4, s.a); put(12, h0, H.lo);
      plait(R, (y) => (y < h0 + R.headH ? 7 : 8), h0 + 6, chest - 1, false, false); put(8, chest, H.lo); },
  }),
  buzzHeart: hs($t('Snaggat med hjärta'), $n('Rakat'), {
    // snaggat med ett hjärta rakat på sidan och i nacken
    front(R) { const { put, skin, h0 } = R; buzzF(R); put(7, h0 + 2, skin.hi); put(16, h0 + 2, skin.base); },
    back(R) { const { put, skin, h0 } = R; buzzB(R);
      for (const [x, y] of [[0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]]) put(9 + x, h0 + 2 + y, x < 3 ? skin.hi : skin.base); },
    side(R) { const { put, skin, h0 } = R; buzzS(R);
      for (const [x, y] of [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) put(9 + x, h0 + 1 + y, skin.hi); },
  }),

  // ================= Lugg =================
  swoop: hs($t('Svepande lugg'), $n('Lugg'), {
    // kort bak och på sidorna, lång lugg svept snett över pannan mot högra ögat (bildens högra)
    front(R) { const { put, hair: H, h0, K } = R, s = shaved(R);
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 8, 16], [h0, 7, 17], [h0 + 1, 7, 17], [h0 + 2, 9, 17], [h0 + 3, 11, 17], [h0 + 4, 13, 17]]);
      if (!K) m.row(h0 + 5, 15, 16);
      paint(R, m);
      for (const [x, y] of [[11, 1], [13, 2], [15, 3], [10, -1], [12, 0], [14, 1], [16, 2]]) put(x, h0 + y, H.lo);
      for (const [x, y] of [[9, 0], [10, 1], [11, 2], [12, 3], [13, 4]]) put(x, h0 + y, H.hi);
      row(R, h0 + 2, 9, 10, H.lo); row(R, h0 + 3, 11, 12, H.lo); row(R, h0 + 4, 13, 14, H.lo); put(15, h0 + (K ? 4 : 5), H.dk); put(16, h0 + (K ? 4 : 5), H.dk);
      put(9, h0 - 1, H.hi); put(10, h0 - 2, H.hi); put(8, h0, H.hi);
      col(R, 7, h0 + 2, h0 + 4, s.a); put(8, h0 + 2, s.a); },
    back(R) { const { put, hair: H, h0 } = R;
      paint(R, mask().rows([[h0 - 2, 9, 14], [h0 - 1, 8, 15]]).rect(7, h0, 10, 3).set(6, h0 + 1).set(6, h0 + 2));
      for (const [x, y] of [[13, 0], [11, 1], [9, 2], [14, 2]]) put(x, h0 + y, H.lo); napeB(R, h0 + 3); },
    side(R) { const { rect, put, hair: H, h0, K } = R, s = shaved(R);
      const m = mask().rows([[h0 - 2, 10, 14], [h0 - 1, 9, 16], [h0, 8, 17], [h0 + 1, 8, 17], [h0 + 2, 13, 17]]);
      if (R.flip) { m.row(h0 + 3, 14, 17).row(h0 + 4, 15, 17); if (!K) m.set(16, h0 + 5); } // luggen hänger ner på den här sidan
      paint(R, m); put(12, h0, H.lo); put(14, h0 + 1, H.lo); put(16, h0 + 2, H.lo);
      rect(8, h0 + 2, 5, 1, s.a); napeS(R, h0 + 3); put(13, h0 + 3, s.a); if (!R.flip) put(13, h0 + 4, s.a); },
  }),
  micro: hs($t('Mini­lugg'), $n('Lugg'), {
    // kort, rak lugg högt upp i pannan och långt rakt hår
    front(R) { const { put, hair: H, h0 } = R, { chest } = dims(R);
      capF(R, 2); row(R, h0 + 2, 8, 15, H.base); row(R, h0 + 2, 9, 14, H.lo); put(10, h0 + 1, H.lo); put(13, h0 + 1, H.lo);
      curtF(R, chest, 2, h0 + 1); },
    back(R) { const { chest } = dims(R); backTo(R, chest); strands(R, R.h0 + 3, chest - 2, [9, 12, 15]); },
    side(R) { const { rect, hair: H, h0 } = R, { chest } = dims(R);
      sideTop(R); rect(7, h0 + 1, 4, chest - h0, H.base); col(R, 7, h0 + 1, chest, H.lo); row(R, chest, 7, 10, H.lo);
      row(R, h0 + 2, 14, 16, H.lo); col(R, 9, h0 + 5, chest - 2, H.lo); },
  }),

  // ================= Mellanlångt =================
  mop: hs($t('Mopp­topp'), $n('Mellanlångt'), {
    // 60-talets hjälmfrisyr: lugg ner till ögonbrynen, öronen täckta, rundad nacke
    front(R) { const { put, hair: H, h0, eyeRow, K } = R, f = h0 + (K ? 3 : 4), sb = eyeRow + 2;
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 7, 16]]).rect(6, h0, 12, f - h0 + 1).rect(5, h0 + 2, 3, sb - h0 - 1).rect(16, h0 + 2, 3, sb - h0 - 1);
      m.cut(5, sb).cut(18, sb).cut(5, h0 + 2).cut(18, h0 + 2);
      paint(R, m);
      for (const x of [9, 13]) col(R, x, h0 + 1, f - 1, H.lo); put(11, h0, H.lo); put(11, f, H.dk); put(15, f - 1, H.lo);
      col(R, 6, h0 + 4, sb - 2, H.lo); put(6, sb, H.lo); },
    back(R) { const { h0, headH, eyeRow } = R, b = h0 + headH - 2;
      const m = mask().rows([[h0 - 2, 9, 14], [h0 - 1, 7, 16]]).rect(6, h0, 12, b - h0 + 1).rect(5, h0 + 2, 14, eyeRow + 1 - h0);
      m.cut(6, b).cut(17, b).cut(5, h0 + 2).cut(18, h0 + 2);
      paint(R, m); strands(R, h0 + 1, b - 2, [9, 12, 15]); },
    side(R) { const { put, hair: H, h0, eyeRow, K } = R, f = h0 + (K ? 3 : 4), sb = eyeRow + 2;
      const m = mask().rows([[h0 - 2, 10, 14], [h0 - 1, 8, 16]]).rect(7, h0, 11, f - h0 + 1).rect(6, h0 + 1, 7, sb - h0);
      m.cut(6, sb).cut(12, sb).cut(6, h0 + 1).cut(17, h0);
      paint(R, m); col(R, 9, h0 + 3, sb - 2, H.lo); put(14, h0 + 1, H.lo); put(16, f, H.dk); put(12, h0 + 1, H.lo); },
  }),
  aLine: hs($t('A-linje'), $n('Mellanlångt'), {
    // page som är kort i nacken och längre fram – snett avklippt
    front(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R);
      capF(R, 3); rect(8, h0 + 3, 2, 1, H.base); rect(12, h0 + 3, 4, 1, H.base); put(14, h0 + 4, H.lo); put(15, h0 + 4, H.lo); put(10, h0, H.lo); put(10, h0 + 1, H.lo); put(13, h0 + 3, H.lo);
      const m = mask().rect(6, h0 + 1, 2, chin + 1 - h0).rect(16, h0 + 1, 2, chin + 1 - h0).set(7, chin + 2).set(8, chin + 2).set(16, chin + 2).set(15, chin + 2);
      paint(R, m); put(6, h0 + 2, H.hi); put(6, h0 + 3, H.hi); col(R, 7, chin - 3, chin, H.lo); col(R, 16, chin - 3, chin, H.dk); },
    back(R) { const { h0, headH } = R, nape = h0 + headH - 3;
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 1);
      for (let x = 6; x <= 17; x++) m.col(x, h0 + 1, Math.round(nape + Math.abs(x - 11.5) * 0.75));
      paint(R, m); strands(R, h0 + 2, nape - 2, [9, 14]); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R), nape = h0 + R.headH - 3;
      sideStd(R, false);
      const m = mask();
      for (let x = 6; x <= 12; x++) m.col(x, x < 11 ? h0 + 1 : h0 + 3, Math.round(nape + (x - 6) * (chin + 2 - nape) / 6));
      paint(R, m); put(14, h0 + 3, H.base); col(R, 9, h0 + 4, nape, H.lo); put(13, h0 + 3, H.base); },
  }),
  tucked: hs($t('Bakom örat'), $n('Mellanlångt'), {
    // hakans längd med sidbena; ena sidan (personens högra) instoppad bakom örat
    front(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R, { chin } = dims(R);
      capF(R, 3); put(9, h0, skin.base); put(9, h0 - 1, H.lo); rect(10, h0 + 3, 6, 1, H.base); put(15, h0 + 4, H.lo); put(12, h0 + 3, H.lo); put(8, h0 + 3, H.base); put(11, h0 + 1, H.lo);
      const m = mask().col(6, h0 + 1, eyeRow - 2).col(7, h0 + 3, eyeRow - 2).col(5, eyeRow - 1, chin + 1).col(6, eyeRow + 2, chin + 1);
      paint(R, m, { split: 99 }); put(6, h0 + 2, H.hi); put(7, eyeRow - 2, H.lo);
      rect(16, h0 + 1, 2, chin + 1 - h0, H.lo); row(R, chin + 1, 16, 17, H.dk); put(16, h0 + 3, H.base); put(18, eyeRow, H.lo); },
    back(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); backStd(R, chin + 2, true); strands(R, h0 + 3, chin, [10, 14]); put(14, h0 - 1, H.lo); put(14, h0, H.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, { chin } = dims(R);
      sideStd(R, false);
      if (!R.flip) { // örat syns, håret instoppat bakom
        rect(7, h0 + 1, 4, chin + 1 - h0, H.base); col(R, 7, h0 + 1, chin + 1, H.lo); row(R, chin + 1, 7, 10, H.lo); row(R, h0 + 3, 11, 13, H.base); put(13, h0 + 4, H.lo); return; }
      rect(7, h0 + 1, 6, chin + 1 - h0, H.base); col(R, 7, h0 + 1, chin + 1, H.lo); row(R, chin + 1, 7, 12, H.lo); col(R, 10, h0 + 4, chin - 1, H.lo);
      rect(13, h0 + 3, 3, 1, H.base); put(13, h0 + 4, H.base); put(14, h0 + 4, H.lo); },
  }),
  feathered: hs($t('Fjäder­klipp'), $n('Mellanlångt'), {
    // 70-tal: mittbena och håret som fjädrar bakåt och utåt vid sidorna i lager
    front(R) { const { put, hair: H, skin, h0, eyeRow } = R, { chin } = dims(R);
      capF(R, 2); put(11, h0, skin.base); put(11, h0 + 1, skin.base); put(11, h0 - 1, H.lo); put(12, h0, H.lo);
      put(9, h0 + 2, H.hi); put(10, h0 + 2, H.base); put(13, h0 + 2, H.base); put(14, h0 + 2, H.lo); put(8, h0 + 3, H.base); put(15, h0 + 3, H.lo);
      const m = mask();
      for (let y = h0 + 1; y <= chin + 2; y++) { const w = y <= h0 + 2 || y > chin ? 2 : 3; m.row(y, 8 - w, 7).row(y, 16, 15 + w); }
      m.set(4, eyeRow - 3).set(19, eyeRow - 3).set(4, chin - 1).set(19, chin - 1).cut(5, chin + 2).cut(18, chin + 2);
      paint(R, m);
      // fjädrarna: korta drag snett uppåt-utåt (bakåt) i varje lager
      for (const y of [h0 + 4, eyeRow + 1, chin]) { put(6, y, H.hi); put(5, y - 1, H.hi); put(7, y + 1, H.lo); put(17, y, H.lo); put(18, y - 1, H.lo); put(16, y + 1, H.dk); } },
    back(R) { const { put, hair: H, h0, eyeRow } = R, { chin } = dims(R); backTo(R, chin + 2);
      for (let x = 7; x <= 16; x++) { const d = Math.round(Math.abs(x - 11.5) * 0.45); put(x, eyeRow - d, H.lo); put(x, chin - d, H.lo); }
      put(5, eyeRow - 2, H.base); put(18, eyeRow - 2, H.lo); put(5, chin, H.base); put(18, chin, H.lo); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin + 2);
      for (const [x, y] of [[14, 3], [13, 3], [12, 4], [11, 3], [10, 4], [9, 5], [13, 2]]) put(x, h0 + y, H.hi);
      for (let y = h0 + 5; y <= chin; y += 3) { put(8, y, H.hi); put(9, y + 1, H.lo); }
      put(6, chin + 1, H.lo); put(6, chin, H.base); },
  }),
  bixie: hs($t('Bixie'), $n('Mellanlångt'), {
    // mellan page och pixie: rufsig topp, sidolugg och fransiga toppar vid öronen
    front(R) { const { put, hair: H, h0, eyeRow, K } = R;
      const m = mask().row(h0 - 2, 9, 10).row(h0 - 2, 12, 14).row(h0 - 1, 7, 16).rect(6, h0, 12, 3).row(h0 + 3, 10, 16).row(h0 + 4, 13, 16)
        .rect(6, h0 + 3, 2, eyeRow - h0 - 1).rect(16, h0 + 3, 2, eyeRow - h0 - 1).set(7, eyeRow + 1).set(16, eyeRow + 1).set(5, h0 + 3).set(18, h0 + 4).set(8, h0 + 3);
      if (!K) m.set(15, h0 + 5);
      paint(R, m);
      for (const [x, y] of [[11, 0], [13, 1], [9, 1], [12, 3], [14, 4], [15, 2]]) put(x, h0 + y, H.lo); put(6, eyeRow, H.lo); put(17, eyeRow, H.dk); put(11, h0 - 2, H.lo); },
    back(R) { const { put, hair: H, h0, eyeRow } = R, b = eyeRow + 2;
      const m = mask().row(h0 - 2, 9, 10).row(h0 - 2, 12, 14).row(h0 - 1, 7, 16).rect(6, h0, 12, b - h0);
      for (const x of [6, 8, 11, 14, 17]) m.cut(x, b - 1 + (x % 2));
      paint(R, m); strands(R, h0 + 2, b - 3, [9, 13]); put(11, h0 - 2, H.lo); },
    side(R) { const { put, hair: H, h0, eyeRow } = R;
      const m = mask().row(h0 - 2, 10, 11).row(h0 - 2, 13, 15).row(h0 - 1, 9, 16).rect(8, h0, 9, 3).rect(6, h0 + 1, 6, eyeRow - h0 + 1).row(h0 + 3, 13, 17).set(16, h0 + 4).set(17, h0 + 4)
        .set(7, eyeRow + 2).set(10, eyeRow + 2);
      m.cut(6, h0 + 1).cut(11, eyeRow + 1).cut(8, eyeRow + 1);
      paint(R, m); put(12, h0, H.lo); put(9, eyeRow - 1, H.lo); put(15, h0 + 3, H.lo); put(10, h0 + 2, H.lo); },
  }),

  // ================= Långt hår =================
  mermaid: hs($t('Sjö­jungfru'), $n('Långt hår'), {
    // jättelångt med stora vågor och mittbena; nedanför bröstet hänger håret bakom kroppen
    front(R) { const { rect, hair: H, h0 } = R, { chin, chest } = dims(R), end = hipOf(R);
      capF(R, 3); partMid(R); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      const m = mask(), mb = mask();
      for (let y = h0 + 1; y <= end; y++) {
        const o = waveOf(R, y), a = 5 - o, b = y < chin ? 7 : a + 3;
        (y <= chest ? m : mb).row(y, a, b).row(y, 23 - b, 23 - a);
      }
      const tex = (x, y) => { const o = waveOf(R, y); return y >= chin && (x === 7 - o || x === 16 + o) ? 'lo' : null; };
      paint(R, m, { tex }); paintBehind(R, mb, { tex }); },
    back(R) { const { h0 } = R, end = hipOf(R);
      const m = mask().row(h0 - 1, 8, 15).row(h0, 7, 16);
      for (let y = h0 + 1; y <= end; y++) { const o = waveOf(R, y); m.row(y, 5 - o, 18 + o); }
      for (let x = 3; x <= 20; x++) if (nz(x, end, 41) < 45) m.cut(x, end);
      paint(R, m, { tex: (x, y) => { const o = waveOf(R, y) - 1; return y > h0 + 2 && y < end - 1 && (x === 9 + o || x === 14 - o) ? 'lo' : null; } }); },
    side(R) { const { rect, put, hair: H, h0 } = R, end = hipOf(R);
      sideStd(R, false);
      const m = mask();
      for (let y = h0 + 1; y <= end; y++) { const o = waveOf(R, y); m.row(y, 5 - o, y <= h0 + 2 ? 8 : 10 - (y > h0 + R.headH ? 1 : 0)); }
      m.cut(5 - waveOf(R, end), end);
      paint(R, m, { tex: (x, y) => (y > h0 + 3 && x === 8 - waveOf(R, y) ? 'lo' : null) });
      rect(13, h0 + 3, 3, 1, H.base); put(15, h0 + 4, H.lo); },
  }),
  superLong: hs($t('Sago­långt'), $n('Långt hår'), {
    // rakt hår ända ner till knäna; nedanför bröstet hänger det bakom kroppen
    front(R) { const { rect, put, hair: H, h0 } = R, { waist } = dims(R), end = kneeOf(R);
      capF(R, 3); partMid(R); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); put(10, h0 + 3, H.lo);
      const mb = mask().rect(5, waist - 1, 2, end - waist + 2).rect(17, waist - 1, 2, end - waist + 2).cut(5, end).cut(18, end);
      paintBehind(R, mb);
      curtF(R, waist, 2, h0 + 1); col(R, 7, h0 + 6, waist - 1, H.lo); col(R, 16, h0 + 6, waist - 1, H.dk); },
    back(R) { const { h0 } = R, end = kneeOf(R);
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 1).rect(6, h0 + 1, 12, end - h0 - 1);
      for (const x of [6, 8, 10, 13, 15, 17]) m.cut(x, end - 1 + (x % 2 ? 0 : 1));
      paint(R, m); strands(R, h0 + 3, end - 3, [8, 10, 13, 15]); col(R, 12, R.h0 - 1, R.h0 + 1, R.hair.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R, end = kneeOf(R);
      sideStd(R, false);
      const m = mask().rect(6, h0 + 1, 5, R.headH).rect(6, h0 + R.headH + 1, 4, end - h0 - R.headH - 1).cut(9, end).cut(7, end);
      paint(R, m); col(R, 8, h0 + 4, end - 2, H.lo); rect(13, h0 + 3, 3, 1, H.base); put(15, h0 + 4, H.lo); },
  }),
  rocker: hs($t('Rock­frilla'), $n('Långt hår'), {
    // 80-talets stora rockfrilla: volym på toppen, taggigt och burrigt ner på bröstet
    front(R) { const { put, hair: H, h0 } = R, { chest } = dims(R);
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(5, h0, 14, 3).set(8, h0 - 4).set(13, h0 - 4).set(5, h0 - 1).set(18, h0 - 1);
      for (let y = h0 + 3; y <= chest; y++) m.row(y, 3 + (nz(3, y, 51) % 2), 7).row(y, 16, 20 - (nz(20, y, 52) % 2));
      for (const x of [8, 9, 12, 13, 14]) m.set(x, h0 + 3); m.set(8, h0 + 4).set(13, h0 + 4);
      for (const x of [3, 4, 5, 6, 17, 18, 19, 20]) if (nz(x, chest, 54) < 50) m.cut(x, chest);
      m.set(2, h0 + 6).set(21, h0 + 8).set(2, chest - 3);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && nz(x, y, 53) < 24 ? 'lo' : t === 'base' && nz(x, y, 55) > 90 ? 'hi' : null) });
      put(11, h0 - 1, H.lo); put(10, h0, H.lo); },
    back(R) { const { h0 } = R, { chest } = dims(R);
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(4, h0, 16, chest - h0 + 1).set(8, h0 - 4).set(13, h0 - 4);
      for (let y = h0 + 2; y <= chest; y++) { if (nz(3, y, 51) % 2) m.set(3, y); if (nz(20, y, 52) % 2) m.set(20, y); }
      for (let x = 3; x <= 20; x++) if (nz(x, chest, 56) < 50) m.cut(x, chest);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && ((x * 3 + (y >> 1)) % 5 === 0 || nz(x, y, 57) < 12) ? 'lo' : null) }); },
    side(R) { const { put, hair: H, h0 } = R, { chest } = dims(R);
      const m = mask().rows([[h0 - 3, 10, 15], [h0 - 2, 8, 16], [h0 - 1, 7, 17]]).rect(6, h0, 12, 3).rect(3, h0 + 1, 8, chest - h0).row(h0 + 3, 14, 17).set(16, h0 + 4).set(17, h0 + 4).set(9, h0 - 4).set(13, h0 - 4);
      for (let y = h0 + 1; y <= chest; y++) if (nz(2, y, 58) % 2) m.set(2, y);
      for (let x = 2; x <= 10; x++) if (nz(x, chest, 59) < 50) m.cut(x, chest);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && nz(x, y, 53) < 24 ? 'lo' : null) }); put(12, h0, H.lo); },
  }),
  hollywood: hs($t('Film­stjärne­vågor'), $n('Långt hår'), {
    // djup sidbena, en stor blank våg över pannan och inrullade toppar på axlarna (40-tal)
    front(R) { const { put, hair: H, skin, h0, eyeRow, K } = R, { chin } = dims(R), end = chin + 1;
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 3).row(h0 + 3, 11, 16).row(h0 + 4, 13, 16);
      if (!K) m.row(h0 + 5, 15, 16);
      for (let y = h0 + 1; y <= end; y++) { const o = waveOf(R, y + 2) >> 1; m.row(y, 5 - o, 7).row(y, 16, 18 + o); }
      m.row(end + 1, 4, 8).row(end + 1, 15, 19).cut(4, end + 1).cut(19, end + 1);
      paint(R, m);
      put(9, h0, skin.base); put(9, h0 - 1, H.lo); put(8, h0, H.hi); put(10, h0 - 1, H.hi); // benan
      for (const [x, y] of [[11, 1], [12, 2], [13, 3], [14, 4], [15, 5]]) put(x, h0 + y, H.hi); // vågens glans
      for (const [x, y] of [[10, 2], [11, 3], [13, 4]]) put(x, h0 + y, H.lo);
      row(R, end, 5, 7, H.hi); row(R, end, 16, 18, H.base); row(R, end + 1, 5, 7, H.lo); row(R, end + 1, 16, 18, H.dk); put(6, eyeRow, H.hi); put(17, eyeRow + 1, H.lo); },
    back(R) { const { put, hair: H, h0 } = R, { chin } = dims(R), end = chin + 1;
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 1);
      for (let y = h0 + 1; y <= end + 1; y++) { const o = y > end ? 1 : waveOf(R, y + 2) >> 1; m.row(y, 6 - o, 17 + o); }
      m.cut(5, end + 1).cut(18, end + 1);
      paint(R, m);
      for (let x = 7; x <= 16; x++) { put(x, h0 + 3 + ((x >> 1) % 2), H.hi); put(x, h0 + 7 + ((x >> 1) % 2), H.lo); }
      row(R, end, 6, 17, H.hi); row(R, end + 1, 6, 17, H.lo); put(14, h0 - 1, H.lo); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R), end = chin + 1;
      sideStd(R, false);
      const m = mask().row(h0 + 3, 12, 16).row(h0 + 4, 14, 16);
      for (let y = h0 + 1; y <= end; y++) m.row(y, 6 - (waveOf(R, y + 2) >> 1), 10);
      m.row(end + 1, 5, 11).cut(5, end + 1);
      paint(R, m);
      for (const [x, y] of [[13, 1], [12, 2], [14, 3], [15, 4]]) put(x, h0 + y, H.hi);
      row(R, end, 6, 10, H.hi); row(R, end + 1, 6, 11, H.lo); put(8, h0 + 5, H.lo); put(9, h0 + 8, H.lo); },
  }),
  longFront: hs($t('Fram­för axlarna'), $n('Långt hår'), {
    // långt rakt hår med mittbena, lagt framför båda axlarna ner på bröstet
    front(R) { const { rect, put, hair: H, h0 } = R, { chin, waist } = dims(R);
      capF(R, 3); partMid(R); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); put(10, h0 + 3, H.lo);
      const m = mask();
      for (let y = h0 + 1; y <= waist; y++) { if (y < chin) m.row(y, 6, 7).row(y, 16, 17); else m.row(y, 6, 8).row(y, 15, 17); }
      m.cut(6, waist).cut(8, waist).cut(15, waist).cut(17, waist).cut(6, waist - 1).cut(17, waist - 1);
      paint(R, m, { split: 15 }); col(R, 7, chin + 1, waist - 2, H.lo); col(R, 16, chin + 1, waist - 2, H.dk); put(6, h0 + 2, H.hi); put(6, h0 + 3, H.hi); },
    back(R) { const { put, hair: H, h0 } = R, { chin, shoulder } = dims(R);
      backStd(R, chin, true); strands(R, h0 + 3, chin - 2, [9, 14]);
      // håret delas vid nacken och läggs fram över axlarna
      const m = mask().rect(5, chin - 2, 2, shoulder - chin + 3).rect(17, chin - 2, 2, shoulder - chin + 3).set(7, chin).set(16, chin);
      paint(R, m); put(12, h0 - 1, H.lo); put(12, h0, H.lo); },
    side(R) { const { put, hair: H, h0 } = R, { chin, waist } = dims(R);
      sideStd(R, false);
      const m = mask().rect(7, h0 + 1, 4, chin - h0).row(chin, 9, 12).row(chin + 1, 10, 13).rect(11, chin + 2, 3, waist - chin - 2).cut(11, waist - 1).cut(13, waist - 1);
      paint(R, m); col(R, 12, chin + 1, waist - 2, H.lo); put(13, h0 + 3, H.base); put(14, h0 + 3, H.base); put(9, h0 + 4, H.lo); },
  }),
};
