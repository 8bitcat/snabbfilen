// Frisyrer + hårfärgseffekter. Se docs/PEOPLE-ARKITEKTUR.md.
//
// Varje post: { label, group?, front(R), back(R), side(R), ...krokar }.
//   front = framifrån ('down'), back = bakifrån ('up'), side = profil åt höger
//   ('left' speglas automatiskt). Rita med R.put/R.rect i spritens koordinater
//   (24×40, huvudets överkant R.h0, ögonraden R.eyeRow). Hårets färger: R.hair
//   (ramp hi/base/lo/dk), andra färgen R.hair2.
// Frisyren ritas EFTER ansiktet och FÖRE huvudbonader. Alla pixlar märks TAG.hair,
// så hårfärgseffekterna (HAIR_FX_REG) kan färga om dem med R.each/R.pattern.
//
// Ordningen här = ordningen i redigeraren. Ändra inte de gamla posterna – de är
// pixellåsta av tools/people-regress.mjs.
import { mix } from './util.js';
// De gamla hjälparna ligger (oförändrade) i hair-kit.js så att de nya frisyrfilerna kan
// dela dem utan cirkelberoende. De exporteras även härifrån som förut.
import { capF, TIE, braid, TAIL, tail, L2R, R2L, backStd, backShort, backLong, sideTop, sideStd } from './hair-kit.js';
import { HAIR_KORT } from './hair-kort.js';
import { HAIR_MELLAN } from './hair-mellan.js';
import { HAIR_LOCKAR } from './hair-lockar.js';
import { HAIR_UPPSATT } from './hair-uppsatt.js';
// omgång 2 (frisören): fler frisyrer i alla grupper + gruppen Kul
import { HAIR_KLIPP } from './hair-klipp.js';
import { HAIR_KRULL } from './hair-krull.js';
import { HAIR_FEST } from './hair-fest.js';
import { HAIR_FX } from './hair-fx.js';
export { capF, TIE, braid, tail, L2R, R2L, backStd, backShort, backLong, sideTop, sideStd };

// ---------- frisyrerna (de första 20 – pixellåsta) ----------
const HAIR_OLD = {
  short: {
    label: 'Kort', group: 'Kort hår',
    front(R) { const { rect, hair: H, h0 } = R; capF(R, 3); rect(7, h0 + 3, 1, 3, H.base); rect(16, h0 + 3, 1, 3, H.lo); rect(8, h0 + 3, 3, 1, H.base); },
    back(R) { backShort(R); },
    side(R) { sideStd(R); },
  },
  side: {
    label: 'Sidbena', group: 'Kort hår',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3); rect(7, h0 + 3, 1, 3, H.base); rect(16, h0 + 3, 1, 4, H.lo); rect(11, h0 + 3, 5, 1, H.base); put(15, h0 + 4, H.lo); put(10, h0, H.lo); },
    back(R) { backShort(R); },
    side(R) { const { rect, put, hair: H, h0 } = R; sideStd(R); rect(13, h0 + 3, 4, 1, H.base); put(16, h0 + 4, H.base); },
  },
  long: {
    label: 'Långt', group: 'Långt hår',
    front(R) { const { rect, put, hair: H, h0, headH } = R; capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      rect(6, h0 + 1, 2, headH + 3, H.base); rect(16, h0 + 1, 2, headH + 3, H.lo); put(6, h0 + 2, H.hi); put(6, h0 + 3, H.hi); },
    back(R) { backLong(R); },
    side(R) { const { rect, put, hair: H, h0, headH } = R; sideStd(R, false); rect(7, h0 + 1, 4, headH + 3, H.base); for (let y = h0 + 1; y < h0 + headH + 4; y++) put(7, y, H.lo); },
  },
  ponytail: {
    label: 'Häst\u00adsvans', group: 'Uppsatt',
    front(R) { const { rect, hair: H, h0 } = R; capF(R, 3); rect(8, h0 + 3, 4, 1, H.base); rect(7, h0 + 3, 1, 4, H.base); rect(16, h0 + 3, 1, 4, H.lo); rect(17, h0 + 4, 1, 5, H.lo); },
    back(R) { const { rect, put, hair: H, K } = R; const bottom = backShort(R); rect(11, bottom, 2, K ? 5 : 7, H.base); put(12, bottom + 1, H.lo); rect(11, bottom - 1, 2, 1, TIE); },
    side(R) { const { rect, put, hair: H, h0, eyeRow, K } = R; sideStd(R); rect(8, h0 + 3, 3, 3, H.base); rect(5, eyeRow - 2, 3, 2, H.base); rect(5, eyeRow, 2, K ? 4 : 6, H.base); put(5, eyeRow + 1, H.lo); put(7, eyeRow - 2, TIE); },
  },
  bun: {
    label: 'Knut', group: 'Uppsatt',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3); rect(10, h0 - 3, 4, 2, H.base); rect(11, h0 - 4, 2, 1, H.base); put(10, h0 - 3, H.hi); put(13, h0 - 2, H.lo); rect(7, h0 + 3, 1, 3, H.base); rect(16, h0 + 3, 1, 3, H.lo); rect(12, h0 + 3, 3, 1, H.base); },
    back(R) { const { rect, put, hair: H, h0 } = R; backShort(R); rect(10, h0 - 3, 4, 3, H.base); rect(11, h0 - 4, 2, 1, H.base); put(10, h0 - 3, H.hi); },
    side(R) { const { rect, put, hair: H, h0 } = R; sideStd(R); rect(6, h0 - 2, 4, 4, H.base); put(6, h0 - 2, H.hi); },
  },
  curly: {
    label: 'Lockigt', group: 'Lockar',
    front(R) { const { rect, put, has, hair: H, h0 } = R; rect(7, h0 - 2, 10, 5, H.base); rect(6, h0 - 1, 12, 4, H.base); rect(6, h0 + 3, 2, 4, H.base); rect(16, h0 + 3, 2, 4, H.lo);
      for (let y = h0 - 2; y < h0 + 7; y++) for (let x = 6; x < 18; x++) if (has(x, y) && (x * 3 + y * 5) % 4 === 0) put(x, y, (x + y) % 3 ? H.hi : H.lo);
      rect(8, h0 + 3, 8, 1, H.base); },
    back(R) { const { rect, put, has, hair: H, h0, headH } = R; rect(7, h0 - 2, 10, 2, H.base); rect(6, h0, 12, headH - 2, H.base);
      for (let y = h0 - 2; y < h0 + headH - 2; y++) for (let x = 6; x < 18; x++) if (has(x, y) && (x * 3 + y * 5) % 4 === 0) put(x, y, (x + y) % 3 ? H.hi : H.lo); },
    side(R) { const { rect, put, has, hair: H, h0 } = R; rect(8, h0 - 2, 9, 5, H.base); rect(6, h0, 5, 8, H.base);
      for (let y = h0 - 2; y < h0 + 8; y++) for (let x = 6; x < 18; x++) if (has(x, y) && (x * 3 + y * 5) % 4 === 0 && (y < h0 + 3 || x < 11)) put(x, y, (x + y) % 3 ? H.hi : H.lo); },
  },
  afro: {
    label: 'Afro', group: 'Lockar',
    front(R) { const { rect, put, has, hair: H, h0 } = R;
      for (let y = h0 - 5; y < h0 + 7; y++) { const dy = (y - (h0 + 0.5)) / 6.5; const hw = Math.round(Math.sqrt(Math.max(0, 1 - dy * dy)) * 8); if (y >= h0 + 3 && hw) { rect(12 - hw, y, hw - 5 + 1, 1, H.base); rect(16, y, hw - 4, 1, H.lo); } else if (hw) rect(12 - hw, y, hw * 2, 1, H.base); }
      for (let y = h0 - 5; y < h0 + 7; y++) for (let x = 3; x < 21; x++) if (has(x, y) && (x * 7 + y * 3) % 5 === 0 && (y < h0 + 3 || x < 7 || x > 16)) put(x, y, (x + y) % 2 ? H.hi : H.lo); },
    back(R) { const { rect, put, has, hair: H, h0 } = R;
      for (let y = h0 - 5; y < h0 + 9; y++) { const dy = (y - (h0 + 1)) / 7.5; const hw = Math.round(Math.sqrt(Math.max(0, 1 - dy * dy)) * 8); if (hw) rect(12 - hw, y, hw * 2, 1, H.base); }
      for (let y = h0 - 5; y < h0 + 9; y++) for (let x = 3; x < 21; x++) if (has(x, y) && (x * 7 + y * 3) % 5 === 0) put(x, y, (x + y) % 2 ? H.hi : H.lo); },
    side(R) { const { rect, put, has, hair: H, h0 } = R;
      for (let y = h0 - 5; y < h0 + 8; y++) { const dy = (y - (h0 + 0.5)) / 7; const hw = Math.round(Math.sqrt(Math.max(0, 1 - dy * dy)) * 7.5); if (hw) rect(11 - hw, y, y >= h0 + 3 ? Math.max(0, hw + 1) : hw * 2, 1, H.base); }
      for (let y = h0 - 5; y < h0 + 8; y++) for (let x = 3; x < 20; x++) if (has(x, y) && (x * 7 + y * 3) % 5 === 0 && (y < h0 + 3 || x < 11)) put(x, y, (x + y) % 2 ? H.hi : H.lo); },
  },
  spiky: {
    label: 'Taggigt', group: 'Kort hår',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3); for (let i = 0; i < 4; i++) { put(8 + i * 2, h0 - 2, H.base); } put(9, h0 - 3, H.hi); put(13, h0 - 3, H.base); rect(7, h0 + 3, 1, 2, H.base); rect(16, h0 + 3, 1, 2, H.lo); put(9, h0 + 3, H.base); put(13, h0 + 3, H.base); },
    back(R) { const { put, hair: H, h0 } = R; backShort(R); for (let i = 0; i < 4; i++) put(8 + i * 2, h0 - 2, H.base); },
    side(R) { const { put, hair: H, h0 } = R; sideStd(R); put(10, h0 - 2, H.base); put(12, h0 - 2, H.base); put(14, h0 - 2, H.base); put(11, h0 - 3, H.hi); },
  },
  bald: {
    label: 'Flint', group: 'Rakat',
    front(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R; rect(7, eyeRow - 2, 1, 3, H.base); rect(16, eyeRow - 2, 1, 3, H.lo); put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); },
    back(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R; rect(7, eyeRow - 1, 10, 2, mix(H.base, skin.base, 0.35)); rect(8, eyeRow + 1, 8, 1, mix(H.lo, skin.lo, 0.4)); put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); },
    side(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R; rect(8, eyeRow - 1, 2, 3, mix(H.base, skin.base, 0.35)); put(13, h0 + 1, skin.hi); },
  },
  mohawk: {
    label: 'Tuppkam', group: 'Rakat',
    front(R) { const { rect, put, hair: H, skin, h0 } = R; rect(10, h0 - 3, 4, 5, H.base); put(10, h0 - 3, H.hi); put(11, h0 - 2, H.hi); rect(7, h0 + 1, 1, 4, skin.lo); },
    back(R) { const { rect, put, hair: H, h0, headH } = R; rect(10, h0 - 3, 4, headH - 1, H.base); put(10, h0 - 3, H.hi); },
    side(R) { const { rect, put, hair: H, h0 } = R; rect(9, h0 - 3, 7, 3, H.base); rect(8, h0, 5, 2, H.base); put(10, h0 - 3, H.hi); },
  },
  bob: {
    label: 'Page', group: 'Mellanlångt',
    front(R) { const { rect, hair: H, h0, eyeRow } = R; capF(R, 4); rect(6, h0 + 1, 2, eyeRow + 3 - h0, H.base); rect(16, h0 + 1, 2, eyeRow + 3 - h0, H.lo); rect(8, h0 + 4, 8, 1, H.lo); },
    back(R) { backStd(R, R.eyeRow + 3, true); },
    side(R) { const { rect, put, hair: H, h0, eyeRow } = R; sideStd(R, false); rect(7, h0 + 1, 4, eyeRow + 3 - h0, H.base); put(7, eyeRow + 2, H.lo); rect(14, h0 + 3, 3, 1, H.base); },
  },
  buzz: {
    label: 'Snaggat', group: 'Rakat',
    front(R) { const { rect, hair: H, skin, h0 } = R; rect(8, h0, 8, 1, H.lo); rect(7, h0 + 1, 10, 2, mix(H.base, skin.base, 0.3)); rect(7, h0 + 3, 1, 2, H.lo); rect(16, h0 + 3, 1, 2, H.lo); },
    back(R) { const { rect, hair: H, skin, h0, headH } = R; rect(8, h0, 8, 1, H.lo); rect(7, h0 + 1, 10, headH - 4, mix(H.base, skin.base, 0.3)); },
    side(R) { const { rect, hair: H, skin, h0 } = R; rect(9, h0, 7, 1, H.lo); rect(8, h0 + 1, 8, 2, mix(H.base, skin.base, 0.3)); rect(8, h0 + 3, 3, 4, mix(H.base, skin.base, 0.3)); },
  },
  braids: {
    label: 'Flätor', group: 'Flätor',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); put(12, h0, H.lo); put(12, h0 + 1, H.lo);
      braid(R, 6, 7, h0 + 2, false); braid(R, 16, 15, h0 + 2, true); },
    back(R) { const { put, hair: H, h0 } = R; const bottom = backShort(R); braid(R, 8, 8, bottom - 1, false); braid(R, 14, 14, bottom - 1, true); put(12, h0, H.lo); put(12, h0 + 1, H.lo); },
    side(R) { const { rect, put, hair: H, h0, headH, K } = R; sideStd(R); // flätan hänger ner bakom örat
      const end = h0 + headH + (K ? 2 : 4);
      for (let y = h0 + 3; y < end; y++) { const o = (y - h0) % 2; put(8, y, o ? H.lo : H.base); put(9, y, o ? H.base : H.hi); }
      rect(8, end, 2, 1, TIE); put(8, end + 1, H.lo); put(9, end + 1, H.base); },
  },
  pigtails: {
    label: 'Tofsar', group: 'Uppsatt',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3); rect(8, h0 + 3, 8, 1, H.base); put(10, h0 + 3, H.lo); put(13, h0 + 3, H.lo); rect(7, h0 + 3, 1, 2, H.base); rect(16, h0 + 3, 1, 2, H.lo);
      tail(R, L2R, false); tail(R, R2L, true); },
    back(R) { backShort(R); tail(R, L2R, true); tail(R, R2L, true); },
    side(R) { const { put, hair: H, h0 } = R; sideStd(R); // tofs bakom huvudet
      TAIL.forEach((xs, j) => xs.forEach((x) => put(x + 2, h0 + j, j === 6 ? H.lo : H.base)));
      put(8, h0 + 1, TIE); put(8, h0 + 2, TIE); put(5, h0 + 3, H.hi); },
  },
  wavy: {
    label: 'Vågigt', group: 'Långt hår',
    front(R) { const { rect, put, hair: H, h0, headH } = R; capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      for (let j = 0; j < headH + 3; j++) {
        const y = h0 + 1 + j, out = ((j + 1) >> 1) % 2 === 1;
        rect(out ? 5 : 6, y, out ? 3 : 2, 1, H.base); rect(16, y, out ? 3 : 2, 1, H.lo);
        put(out ? 5 : 6, y, out ? H.hi : H.base); put(out ? 18 : 17, y, H.dk);
      }
      put(6, h0 + 2, H.hi); },
    back(R) { const { put, hair: H, h0 } = R; const bottom = backLong(R);
      for (let y = h0 + 1; y < bottom; y++) {
        const out = ((y - h0) >> 1) % 2 === 1;
        if (out) { put(5, y, H.base); put(18, y, H.lo); }
        if (y > h0 + 1 && y < bottom - 1) { const o = out ? 1 : 0; put(9 + o, y, H.lo); put(14 - o, y, H.lo); }
      } },
    side(R) { const { rect, put, hair: H, h0, headH } = R; sideStd(R);
      rect(7, h0 + 1, 4, headH + 3, H.base);
      for (let j = 0; j < headH + 3; j++) { const y = h0 + 1 + j, out = ((j + 1) >> 1) % 2 === 1; if (out) put(6, y, H.lo); else put(7, y, H.lo); if (j % 4 === 1) put(9, y, H.lo); } },
  },
  mullet: {
    label: 'Hockey\u00adfrilla', group: 'Mellanlångt',
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R; capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(7, h0 + 3, 1, 2, H.base); rect(16, h0 + 3, 1, 2, H.lo);
      rect(5, eyeRow + 1, 2, 6, H.base); rect(17, eyeRow + 1, 2, 6, H.lo); put(5, eyeRow + 1, H.hi); put(18, eyeRow + 6, H.dk); },
    back(R) { backLong(R); },
    side(R) { const { rect, put, hair: H, eyeRow } = R; sideStd(R); rect(6, eyeRow - 1, 3, 2, H.base); rect(6, eyeRow + 1, 2, 6, H.base); put(6, eyeRow + 1, H.lo); put(7, eyeRow + 6, H.lo); },
  },
  curtains: {
    label: 'Mitt\u00adbena', group: 'Mellanlångt',
    front(R) { const { rect, put, hair: H, skin, h0 } = R; capF(R, 2); rect(7, h0 + 2, 2, 4, H.base); rect(15, h0 + 2, 2, 4, H.lo);
      rect(8, h0 + 2, 3, 2, H.base); rect(13, h0 + 2, 3, 2, H.lo);
      put(12, h0, skin.base); put(12, h0 + 1, skin.base); put(11, h0, H.hi); put(13, h0, H.base); },
    back(R) { const { put, hair: H, h0 } = R; backShort(R); put(12, h0 - 1, H.lo); },
    side(R) { const { rect, put, hair: H, h0 } = R; sideStd(R); rect(14, h0 + 2, 3, 2, H.base); put(16, h0 + 3, H.lo); put(13, h0 - 1, H.lo); },
  },
  space: {
    label: 'Rymd\u00adknutar', group: 'Uppsatt',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3); rect(8, h0 + 3, 8, 1, H.base); rect(7, h0 + 3, 1, 2, H.base); rect(16, h0 + 3, 1, 2, H.lo);
      rect(6, h0 - 3, 3, 3, H.base); rect(15, h0 - 3, 3, 3, H.base);
      put(6, h0 - 3, H.hi); put(8, h0 - 1, H.lo); put(15, h0 - 3, H.hi); put(17, h0 - 1, H.lo); },
    back(R) { const { rect, put, hair: H, h0 } = R; backShort(R); rect(6, h0 - 3, 3, 3, H.base); rect(15, h0 - 3, 3, 3, H.base); put(6, h0 - 3, H.hi); put(15, h0 - 3, H.hi); },
    side(R) { const { rect, put, hair: H, h0 } = R; sideStd(R); rect(6, h0 - 3, 3, 3, H.base); put(6, h0 - 3, H.hi); rect(13, h0 - 2, 2, 1, H.lo); },
  },
  dreads: {
    label: 'Dreads', group: 'Lockar',
    front(R) { const { rect, put, hair: H, h0 } = R; capF(R, 3);
      for (let y = h0; y < h0 + 3; y++) for (let x = 7; x < 17; x++) if ((x + y) % 2 === 0) put(x, y, H.lo);
      rect(5, h0 + 2, 2, 8, H.base); rect(17, h0 + 2, 2, 8, H.lo);
      for (let j = 1; j < 8; j += 2) { put(5, h0 + 2 + j, H.lo); put(18, h0 + 2 + j, H.dk); }
      put(5, h0 + 2, H.hi); },
    back(R) { const { put, hair: H, h0 } = R; const bottom = backLong(R);
      for (let y = h0 + 1; y < bottom; y++) for (let x = 7; x < 17; x += 2) if ((x + y) % 2 === 0) put(x, y, H.lo); },
    side(R) { const { rect, hair: H, h0, headH } = R; // hjässa utan glanspixeln vid pannan
      rect(9, h0 - 1, 7, 1, H.base); rect(8, h0, 9, 3, H.base); rect(10, h0 - 1, 3, 1, H.hi);
      for (let i = 0; i < 5; i++) { const x = 6 + i * 2; rect(x, h0 + 2, 2, headH - 2 + (i % 3), i % 2 ? H.lo : H.base); } },
  },
  fade: {
    label: 'Fade', group: 'Rakat',
    front(R) { const { rect, hair: H, skin, h0 } = R; rect(9, h0 - 1, 6, 1, H.base); rect(8, h0, 8, 2, H.base); rect(9, h0 - 1, 3, 1, H.hi);
      rect(8, h0 + 2, 8, 1, mix(H.base, skin.base, 0.25));
      rect(7, h0 + 2, 1, 3, mix(H.base, skin.base, 0.45)); rect(16, h0 + 2, 1, 3, mix(H.lo, skin.base, 0.45)); },
    back(R) { const { rect, hair: H, skin, h0, headH } = R; rect(8, h0, 8, 1, H.base); rect(7, h0 + 1, 10, 2, mix(H.base, skin.base, 0.3)); rect(8, h0 + 3, 8, headH - 6, mix(H.base, skin.base, 0.45)); },
    side(R) { const { rect, hair: H, skin, h0 } = R; rect(9, h0, 7, 1, H.base); rect(8, h0 + 1, 8, 1, H.base); rect(8, h0 + 2, 8, 2, mix(H.base, skin.base, 0.3)); rect(8, h0 + 4, 3, 3, mix(H.base, skin.base, 0.45)); },
  },
};

// ---------- hela registret ----------
// Underrubrikerna i redigeraren kommer i den här ordningen; inom en rubrik står de gamla
// frisyrerna först och de nya efter (i filernas ordning). Frisyrer utan känd rubrik hamnar sist.
const GROUP_ORDER = ['Kort hår', 'Lugg', 'Rakat', 'Mellanlångt', 'Långt hår', 'Lockar', 'Afro', 'Dreads & twists', 'Uppsatt', 'Hästsvansar', 'Flätor', 'Kul'];
// några av de gamla frisyrerna flyttas till de nya underrubrikerna (bara rubriken – ritningen är orörd)
const REGROUP = { afro: 'Afro', dreads: 'Dreads & twists', ponytail: 'Hästsvansar' };
for (const id in REGROUP) HAIR_OLD[id] = { ...HAIR_OLD[id], group: REGROUP[id] };
const ALL = { ...HAIR_OLD, ...HAIR_KORT, ...HAIR_MELLAN, ...HAIR_LOCKAR, ...HAIR_UPPSATT, ...HAIR_KLIPP, ...HAIR_KRULL, ...HAIR_FEST };
const rank = (id) => { const g = GROUP_ORDER.indexOf(ALL[id].group); return g < 0 ? GROUP_ORDER.length : g; };
export const HAIR_REG = Object.fromEntries(Object.keys(ALL).map((id, i) => [id, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([id]) => [id, ALL[id]]));

// ---------- hårfärgseffekter (look.hairFx, andra färgen look.hair2 → R.hair2) ----------
// Körs direkt efter frisyren (samma vy). Typiskt: R.pattern(TAG.hair, (x, y) => villkor ? R.hair2 : null)
// – tonen (hi/base/lo/dk) behålls automatiskt. 'none' = ingen effekt. Effekterna ligger i hair-fx.js.
export const HAIR_FX_REG = {
  none: { label: 'Ingen' },
  ...HAIR_FX,
};
