// Nya kinder, smink och märken (spreds in i CHEEK_REG / MAKEUP_REG / MARK_REG i face.js).
//
// Ritordning: … mun → kinder → smink → märken → skägg → glasögon → frisyr.
// Smink: läppstift byter läppfärgen i prep(R) (R.lip) så att munnen ritas i den färgen;
// ögonskugga ritas i kroken afterHead (före ögonen) så att ögonen hamnar ovanpå.
// Färger: R.lipC (look.lipColor), R.shadowC (look.shadowColor), R.markC (look.markColor).
// Varje post har en egen standardfärg när spelaren inte valt någon (colorOr).
// Helansiktsmålningar färgar om huvudets hud med R.pattern(TAG.head, …) – från sidan bara
// ansiktsdelen (x ≥ 13, framför örat). Bakifrån syns inget av ansiktet.
import { mix, ramp, TAG } from './util.js';
import { pix as pixAny, pal, tint, colorOr, mouthRow, WHITE, SHINE, LASH } from './face-kit.js';

// ---------- hjälpare ----------
// Pixelkartor på huden klipps mot huvudets form: en kinddekor som når ut till kanten
// (t.ex. rad eyeRow+3 där ansiktet smalnar) får inte sticka ut utanför kinden.
const ON_FACE = new Set([TAG.head, TAG.face, TAG.brow]);
const pix = (R, x0, y0, rows, P, mode) => pixAny({ put: (x, y, c) => { if (ON_FACE.has(R.tagAt(x, y))) R.put(x, y, c); } }, x0, y0, rows, P, mode);
// tona bara huden (huvudets pixlar, ev. även ansiktsdetaljer som redan rosiga kinder)
const tintSkin = (R, x, y, c, t, face = false) => { const g = R.tagAt(x, y); if (g === TAG.head || (face && g === TAG.face)) tint(R, x, y, c, t); };
const tintSkinRect = (R, x, y, w, h, c, t, face) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) tintSkin(R, x + i, y + j, c, t, face); };
// samma punkt på båda kinderna (framifrån)
const both = (R, pts, fn) => { for (const [x, y] of pts) { fn(x, y); fn(23 - x, y); } };
// helansiktsmålning: färga om huden (tonen behålls); från sidan bara x ≥ xMin (framför örat)
const paintFace = (R, rp, xMin = 13) => R.pattern(TAG.head, (x) => (R.side && x < xMin ? null : rp));
const paintEars = (R, rp) => R.pattern(TAG.ear, () => rp, R.skin);
const mc = (R, def) => colorOr(R, 'markColor', 'markC', def);   // målningens färg
const lc = (R, def) => colorOr(R, 'lipColor', 'lipC', def);     // läppstiftets färg
const sc = (R, def) => colorOr(R, 'shadowColor', 'shadowC', def); // ögonskuggans färg

// ================= KINDER =================
export const CHEEKS_NEW = {
  blushing: {
    label: 'Rodnande', group: 'Färg',
    front(R) { const y = R.eyeRow + 2; both(R, [[8, y], [9, y], [8, y - 1]], (x, yy) => tintSkin(R, x, yy, 0xe04060, 0.5, true)); },
    side(R) { const y = R.eyeRow + 2; tintSkin(R, 13, y, 0xe04060, 0.5, true); tintSkin(R, 14, y, 0xe04060, 0.5, true); tintSkin(R, 14, y - 1, 0xe04060, 0.5, true); },
  },
  embarrassed: {
    label: 'Generad', group: 'Färg',
    // anime-rodnad: snedstreck över kinderna
    front(R) { const y = R.eyeRow + 1, c = 0xf06080; for (const [x, dy] of [[7, 1], [8, 0], [9, 1], [10, 0]]) { tintSkin(R, x, y + dy, c, 0.6, true); tintSkin(R, 23 - x, y + dy, c, 0.6, true); } },
    side(R) { const y = R.eyeRow + 1, c = 0xf06080; for (const [x, dy] of [[12, 1], [13, 0], [14, 1], [15, 0]]) tintSkin(R, x, y + dy, c, 0.6, true); },
  },
  sunKissed: {
    label: 'Solkyssta', group: 'Färg',
    // solbränd rand över näsan och kinderna
    front(R) { const y = R.eyeRow + 1; for (let x = 8; x <= 15; x++) { tintSkin(R, x, y, 0xe0603a, 0.28, true); tintSkin(R, x, y + 1, 0xe0603a, x > 9 && x < 14 ? 0.2 : 0.3, true); } },
    side(R) { const y = R.eyeRow + 1; for (let x = 13; x <= 17; x++) { tint(R, x, y, 0xe0603a, 0.28); tint(R, x, y + 1, 0xe0603a, 0.22); } },
  },
  apple: {
    label: 'Äppelkinder', group: 'Form',
    // runda kinder: ljus topp + rosig undersida
    front(R) { const y = R.eyeRow + 1; both(R, [[8, y], [9, y]], (x, yy) => R.put(x, yy, mix(R.skin.hi, 0xffffff, 0.2))); both(R, [[8, y + 1], [9, y + 1]], (x, yy) => tintSkin(R, x, yy, 0xe06070, 0.4, true)); },
    side(R) { const y = R.eyeRow + 1; R.put(14, y, mix(R.skin.hi, 0xffffff, 0.2)); tintSkin(R, 13, y + 1, 0xe06070, 0.4, true); tintSkin(R, 14, y + 1, 0xe06070, 0.4, true); },
  },
  cheekbones: {
    label: 'Höga kindben', group: 'Form',
    front(R) { const y = R.eyeRow + 1; both(R, [[8, y]], (x, yy) => R.put(x, yy, R.skin.hi)); both(R, [[8, y + 1], [8, y + 2]], (x, yy) => tintSkin(R, x, yy, R.skin.dk, 0.35)); },
    side(R) { const y = R.eyeRow + 1; R.put(14, y, R.skin.hi); tintSkin(R, 13, y + 1, R.skin.dk, 0.35); tintSkin(R, 13, y + 2, R.skin.dk, 0.35); },
  },
  hollow: {
    label: 'Insjunkna', group: 'Form',
    front(R) { const y = R.eyeRow + 2; both(R, [[8, y], [8, y + 1], [9, y + 1]], (x, yy) => tintSkin(R, x, yy, R.skin.dk, 0.4)); },
    side(R) { const y = R.eyeRow + 2; for (const [x, dy] of [[13, 0], [13, 1], [14, 1]]) tintSkin(R, x, y + dy, R.skin.dk, 0.4); },
  },
  dimples: {
    label: 'Smilgropar', group: 'Form',
    front(R) { const y = R.eyeRow + 3; tintSkin(R, 9, y, R.skin.dk, 0.55); tintSkin(R, 14, y, R.skin.dk, 0.55); },
    side(R) { tintSkin(R, 14, R.eyeRow + 3, R.skin.dk, 0.55); },
  },
  sweaty: {
    label: 'Svettdroppe', group: 'Roliga',
    // anime-svettdroppe vid tinningen
    front(R) { const y = R.eyeRow - 3; R.put(16, y, 0xa8dcf8); R.put(16, y + 1, 0x7cc8f0); R.put(15, y + 1, 0xe8f6fe); R.put(16, y + 2, 0x5aa8e0); },
    side(R) { const y = R.eyeRow - 4; R.put(15, y, 0xa8dcf8); R.put(15, y + 1, 0x7cc8f0); R.put(14, y + 1, 0xe8f6fe); R.put(15, y + 2, 0x5aa8e0); },
  },
};

// ================= SMINK =================
// ögonskugga: bandet mellan brynen och ögat (rad eyeRow−2) + ytterhörnet
const shadowF = (R, c, c2) => { const y = R.eyeRow - 2; both(R, [[8, y], [9, y], [10, y]], (x, yy) => R.put(x, yy, c)); if (c2 != null) both(R, [[8, y + 1]], (x, yy) => { if (R.tagAt(x, yy) === TAG.head) R.put(x, yy, c2); }); };
const shadowS = (R, c, c2) => { const y = R.eyeRow - 2; R.rect(14, y, 3, 1, c); if (c2 != null && R.tagAt(14, y + 1) === TAG.head) R.put(14, y + 1, c2); };
// eyeliner: en vinge snett ut från ytterhörnet
const linerF = (R, c) => { const E = R.eyeRow; if (R.K) { R.put(7, E - 1, c); R.put(16, E - 1, c); R.put(7, E - 2, c); R.put(16, E - 2, c); } else { R.put(8, E - 1, c); R.put(7, E - 2, c); R.put(15, E - 1, c); R.put(16, E - 2, c); } };
const linerS = (R, c) => { const E = R.eyeRow; R.put(R.K ? 13 : 14, E - 1, c); R.put(R.K ? 12 : 13, E - 2, c); };
// rouge i läppstiftets färg
const rougeF = (R, c, t) => { const y = R.eyeRow + 2; both(R, [[8, y], [9, y]], (x, yy) => tintSkin(R, x, yy, c, t, true)); };
const rougeS = (R, c, t) => { const y = R.eyeRow + 2; tintSkin(R, 13, y, c, t, true); tintSkin(R, 14, y, c, t, true); };
// glans på underläppen: ljusare pixel där munnen har läppfärgen
const glossOn = (R, xs) => { const y = mouthRow(R); for (const x of xs) if (R.get(x, y) === R.lip) { R.put(x, y, mix(R.lip, 0xffffff, 0.45)); return; } };

export const MAKEUP_NEW = {
  // --- läppar ---
  lipstick: { label: 'Läppstift', group: 'Läppar', uses: ['lipColor'], prep(R) { R.lip = lc(R, 0xc0304a).base; } },
  gloss: {
    label: 'Läppglans', group: 'Läppar', uses: ['lipColor'],
    prep(R) { R.lip = mix(lc(R, 0xe0607a).base, 0xffffff, 0.1); },
    front(R) { glossOn(R, [11, 12]); }, side(R) { glossOn(R, [16]); },
  },
  darkLips: { label: 'Mörkt läppstift', group: 'Läppar', uses: ['lipColor'], prep(R) { R.lip = lc(R, 0x6b2a3a).lo; } },
  natural: {
    label: 'Naturligt', group: 'Läppar',
    prep(R) { R.lip = mix(R.skin.lo, 0xd07a70, 0.5); },
    front(R) { rougeF(R, 0xe08070, 0.2); }, side(R) { rougeS(R, 0xe08070, 0.2); },
  },
  rouge: { label: 'Rouge', group: 'Kinder', uses: ['lipColor'], front(R) { rougeF(R, lc(R, 0xe0607a).base, 0.45); }, side(R) { rougeS(R, lc(R, 0xe0607a).base, 0.45); } },
  highlighter: {
    label: 'Highlighter', group: 'Kinder',
    front(R) { const E = R.eyeRow, c = mix(R.skin.hi, 0xffffff, 0.45); both(R, [[8, E + 1]], (x, y) => R.put(x, y, c)); if (R.tagAt(12, E) === TAG.head) R.put(12, E, c); },
    side(R) { const E = R.eyeRow, c = mix(R.skin.hi, 0xffffff, 0.45); R.put(14, E + 1, c); R.put(16, E, c); },
  },
  // --- ögon ---
  shadow: {
    label: 'Ögonskugga', group: 'Ögon', uses: ['shadowColor'],
    afterHead(R) { if (R.back) return; const c = sc(R, 0x8e5bd1); if (R.side) shadowS(R, c.base, c.lo); else shadowF(R, c.base, c.lo); },
  },
  smoky: {
    label: 'Smokey eyes', group: 'Ögon', uses: ['shadowColor'],
    afterHead(R) {
      if (R.back) return;
      const c = sc(R, 0x3a3440), E = R.eyeRow;
      if (R.side) { R.rect(13, E - 2, 4, 1, c.base); R.put(13, E - 1, c.lo); R.put(14, E - 1, c.lo); tintSkin(R, 14, E + 1, c.base, 0.35); tintSkin(R, 15, E + 1, c.base, 0.35); return; }
      both(R, [[7, E - 2], [8, E - 2], [9, E - 2], [10, E - 2], [7, E - 1], [8, E - 1]], (x, y) => R.put(x, y, x === 10 ? c.base : c.lo));
      both(R, [[8, E + 1], [9, E + 1], [10, E + 1]], (x, y) => tintSkin(R, x, y, c.base, 0.35));
    },
  },
  gold: {
    label: 'Guldskugga', group: 'Ögon',
    afterHead(R) { if (R.back) return; if (R.side) shadowS(R, 0xf0c040, 0xc8961e); else { shadowF(R, 0xf0c040, 0xc8961e); R.put(9, R.eyeRow - 2, 0xfff0a8); R.put(14, R.eyeRow - 2, 0xfff0a8); } },
  },
  rainbow: {
    label: 'Regnbågsskugga', group: 'Ögon',
    afterHead(R) {
      if (R.back) return;
      const y = R.eyeRow - 2, C = [0xe04848, 0xf0c030, 0x3a9ad5];
      if (R.side) { R.put(14, y, C[0]); R.put(15, y, C[1]); R.put(16, y, C[2]); return; }
      R.put(8, y, C[0]); R.put(9, y, C[1]); R.put(10, y, C[2]); R.put(15, y, C[0]); R.put(14, y, C[1]); R.put(13, y, C[2]);
    },
  },
  liner: { label: 'Eyeliner', group: 'Ögon', front(R) { linerF(R, LASH); }, side(R) { linerS(R, LASH); } },
  colorLiner: { label: 'Färgad eyeliner', group: 'Ögon', uses: ['shadowColor'], front(R) { linerF(R, sc(R, 0x3a7bd5).base); }, side(R) { linerS(R, sc(R, 0x3a7bd5).base); } },
  kohl: {
    label: 'Kajal', group: 'Ögon',
    // mörk ram runt ögonen, uppe och nere
    front(R) { const E = R.eyeRow; linerF(R, LASH); both(R, R.K ? [[8, E + 1], [9, E + 1]] : [[9, E + 1], [8, E + 1]], (x, y) => { if (R.tagAt(x, y) === TAG.head) R.put(x, y, mix(LASH, R.skin.lo, 0.35)); }); },
    side(R) { linerS(R, LASH); const y = R.eyeRow + 1; for (const x of R.K ? [14, 15] : [15]) if (R.tagAt(x, y) === TAG.head) R.put(x, y, mix(LASH, R.skin.lo, 0.35)); },
  },
  glitter: {
    label: 'Glitter', group: 'Fest', uses: ['shadowColor'],
    afterHead(R) { if (R.back) return; const c = sc(R, 0xb8a0f0); if (R.side) shadowS(R, c.hi, null); else shadowF(R, c.hi, null); },
    front(R) { const E = R.eyeRow; R.put(7, E - 3, SHINE); R.put(16, E - 1, SHINE); R.put(10, E + 1, 0xfff0a8); R.put(15, E + 1, 0xfff0a8); R.put(7, E + 1, SHINE); },
    side(R) { const E = R.eyeRow; R.put(13, E - 3, SHINE); R.put(16, E + 1, 0xfff0a8); R.put(13, E, SHINE); },
  },
  glitterTears: {
    label: 'Glittertårar', group: 'Fest', uses: ['shadowColor'],
    front(R) { const E = R.eyeRow, c = sc(R, 0x9ad0ff); both(R, [[9, E + 1], [9, E + 3]], (x, y) => R.put(x, y, SHINE)); both(R, [[9, E + 2], [8, E + 4]], (x, y) => { if (R.tagAt(x, y) === TAG.head) R.put(x, y, c.base); }); },
    side(R) { const E = R.eyeRow, c = sc(R, 0x9ad0ff); R.put(15, E + 1, SHINE); R.put(15, E + 2, c.base); R.put(15, E + 3, SHINE); },
  },
  glam: {
    label: 'Festsmink', group: 'Fest', uses: ['lipColor', 'shadowColor'],
    prep(R) { R.lip = lc(R, 0xc0304a).base; },
    afterHead(R) { if (R.back) return; const c = sc(R, 0x8e5bd1); if (R.side) shadowS(R, c.base, c.lo); else shadowF(R, c.base, c.lo); },
    front(R) { linerF(R, LASH); rougeF(R, lc(R, 0xc0304a).base, 0.35); glossOn(R, [11, 12]); },
    side(R) { linerS(R, LASH); rougeS(R, lc(R, 0xc0304a).base, 0.35); },
  },
  goth: {
    label: 'Gotiskt', group: 'Fest', uses: ['lipColor'],
    // blek hy, mörka ögon och svarta läppar
    prep(R) { R.lip = R.L.lipColor ? R.lipC.dk : 0x2a1d2a; },
    afterHead(R) { if (R.back) return; R.pattern(TAG.head, (x, y, c) => (R.side && x < 13 ? null : mix(c, 0xf2eef0, 0.45))); const c = 0x2a2030; if (R.side) shadowS(R, c, mix(c, R.skin.lo, 0.3)); else shadowF(R, c, mix(c, R.skin.lo, 0.3)); },
    front(R) { linerF(R, LASH); }, side(R) { linerS(R, LASH); },
  },
};

// ================= MÄRKEN: fräknar, ärr, plåster, ansiktsmålning, tatueringar =================
const FRECKLE = (R) => mix(R.skin.lo, 0x7a3a1a, 0.45);
const INK = 0x2a3044;                 // tatueringsbläck
const BAND = 0xe2b07e, PAD = 0xf6e6c8; // plåster
const SCAR = (R) => mix(R.skin.hi, 0xd88a90, 0.35);
const dots = (R, pts, c, dy = 0) => { for (const [x, y] of pts) { const yy = R.eyeRow + y + dy; if (R.tagAt(x, yy) === TAG.head) R.put(x, yy, c); } };
// eyeRow-relativa punkter (framifrån), med separata punkter från sidan
const Dots = (label, group, front, side, color) => ({
  label, group,
  front(R) { dots(R, front, color(R)); },
  side(R) { dots(R, side, color(R)); },
});

export const MARKS_NEW = {
  // --- fräknar & fläckar ---
  freckles: Dots('Fräknar', 'Fräknar & fläckar', [[8, 1], [10, 1], [9, 2], [13, 1], [15, 1], [14, 2]], [[13, 1], [15, 1], [14, 2]], FRECKLE),
  manyFreckles: Dots('Massor av fräknar', 'Fräknar & fläckar',
    [[7, 1], [9, 1], [11, 1], [8, 2], [10, 2], [12, 0], [14, 1], [16, 1], [13, 2], [15, 2], [8, 3], [15, 3], [10, -4], [13, -4]],
    [[12, 1], [14, 1], [16, 0], [13, 2], [15, 2], [14, 3], [15, -4]], FRECKLE),
  noseFreckles: Dots('Fräknar på näsan', 'Fräknar & fläckar', [[11, 1], [12, 1], [10, 2], [13, 2], [11, 0]], [[16, 1], [15, 2], [16, 0]], FRECKLE),
  beautyMark: Dots('Skönhetsfläck', 'Fräknar & fläckar', [[14, 3]], [[15, 3]], () => 0x3a2418),
  mole: Dots('Födelsemärke', 'Fräknar & fläckar', [[9, 1]], [[14, 1]], () => 0x4a2c1c),
  birthmark: {
    label: 'Kaffefläck', group: 'Fräknar & fläckar',
    front(R) { const E = R.eyeRow; for (const [x, y] of [[13, 1], [14, 1], [14, 2], [15, 2], [13, 2]]) tintSkin(R, x, E + y, 0x8a5a3a, 0.35); },
    side(R) { const E = R.eyeRow; for (const [x, y] of [[13, 1], [14, 1], [14, 2], [13, 2]]) tintSkin(R, x, E + y, 0x8a5a3a, 0.35); },
  },
  portWine: {
    label: 'Vinfläck', group: 'Fräknar & fläckar',
    front(R) { const E = R.eyeRow; for (const [x, y] of [[14, -2], [15, -2], [15, -1], [16, -1], [15, 0], [16, 0], [13, 1], [14, 1], [15, 1], [16, 1], [14, 2], [15, 2]]) tintSkin(R, x, E + y, 0x9a2a4a, 0.4, true); },
    side(R) { const E = R.eyeRow; for (const [x, y] of [[13, -2], [14, -2], [12, -1], [13, -1], [13, 0], [12, 1], [13, 1], [14, 1], [13, 2], [14, 2]]) tintSkin(R, x, E + y, 0x9a2a4a, 0.4, true); },
  },
  // --- rynkor (mörkare hud i veck, tonen under behålls) ---
  wrinkles: {
    label: 'Rynkor', group: 'Rynkor',
    // pannveck, kråkfötter vid ögonvrårna och veck från näsan ner mot mungiporna
    front(R) {
      const E = R.eyeRow, c = R.skin.dk;
      for (let x = 10; x <= 13; x++) tintSkin(R, x, E - 4, c, 0.3);
      both(R, [[7, E - 1], [8, E + 1]], (x, y) => tintSkin(R, x, y, c, 0.4));
      both(R, [[10, E + 2], [9, E + 3]], (x, y) => tintSkin(R, x, y, c, 0.45));
    },
    side(R) {
      const E = R.eyeRow, c = R.skin.dk;
      for (let x = 14; x <= 16; x++) tintSkin(R, x, E - 4, c, 0.3);
      tintSkin(R, 13, E - 1, c, 0.4); tintSkin(R, 14, E + 1, c, 0.4);
      tintSkin(R, 15, E + 2, c, 0.45); tintSkin(R, 14, E + 3, c, 0.45);
    },
  },
  laughLines: {
    label: 'Skrattrynkor', group: 'Rynkor',
    front(R) { const E = R.eyeRow; both(R, [[10, E + 2], [9, E + 3]], (x, y) => tintSkin(R, x, y, R.skin.dk, 0.45)); },
    side(R) { const E = R.eyeRow; tintSkin(R, 15, E + 2, R.skin.dk, 0.45); tintSkin(R, 14, E + 3, R.skin.dk, 0.45); },
  },
  // --- ärr, plåster & skador ---
  scarEye: {
    label: 'Ärr över ögat', group: 'Ärr & plåster',
    front(R) { const E = R.eyeRow, c = SCAR(R), d = mix(c, R.skin.dk, 0.4); for (const y of [-4, -3, -2]) R.put(9, E + y, y === -3 ? d : c); R.put(9, E + 1, c); R.put(9, E + 2, d); },
    side(R) { const E = R.eyeRow, c = SCAR(R), d = mix(c, R.skin.dk, 0.4); for (const y of [-4, -3, -2]) R.put(15, E + y, y === -3 ? d : c); R.put(15, E + 1, c); R.put(15, E + 2, d); },
  },
  scarCheek: {
    label: 'Ärr på kinden', group: 'Ärr & plåster',
    front(R) { const E = R.eyeRow, c = SCAR(R); R.put(13, E + 1, c); R.put(14, E + 2, c); R.put(15, E + 3, mix(c, R.skin.dk, 0.4)); R.put(15, E + 1, c); },
    side(R) { const E = R.eyeRow, c = SCAR(R); R.put(12, E + 1, c); R.put(13, E + 2, c); R.put(14, E + 3, mix(c, R.skin.dk, 0.4)); },
  },
  stitches: {
    label: 'Stygn', group: 'Ärr & plåster',
    front(R) { const E = R.eyeRow, c = 0x3a2028, s = mix(R.skin.lo, 0xa04050, 0.35); R.rect(13, E + 2, 4, 1, s); for (const x of [13, 15]) { R.put(x, E + 1, c); R.put(x, E + 3, c); } },
    side(R) { const E = R.eyeRow, c = 0x3a2028, s = mix(R.skin.lo, 0xa04050, 0.35); R.rect(12, E + 2, 4, 1, s); for (const x of [12, 14]) { R.put(x, E + 1, c); R.put(x, E + 3, c); } },
  },
  bandaid: {
    label: 'Plåster', group: 'Ärr & plåster',
    front(R) { pix(R, 13, R.eyeRow + 1, ['aPPa', 'aPPa'], { a: BAND, P: PAD }); },
    side(R) { pix(R, 12, R.eyeRow + 1, ['aPPa', 'aPPa'], { a: BAND, P: PAD }); },
  },
  bandaidNose: {
    label: 'Plåster på näsan', group: 'Ärr & plåster',
    front(R) { pix(R, 9, R.eyeRow + 1, ['aaPPaa'], { a: BAND, P: PAD }); },
    side(R) { pix(R, 14, R.eyeRow + 1, ['aPPa'], { a: BAND, P: PAD }); },
  },
  crossBandaid: {
    label: 'Korsplåster', group: 'Ärr & plåster',
    front(R) { pix(R, 7, R.eyeRow + 1, ['a.a', '.P.', 'a.a'], { a: BAND, P: PAD }); },
    side(R) { pix(R, 12, R.eyeRow + 1, ['a.a', '.P.', 'a.a'], { a: BAND, P: PAD }); },
  },
  blackEye: {
    label: 'Blåtira', group: 'Ärr & plåster',
    front(R) { const E = R.eyeRow; for (let y = E - 2; y <= E + 1; y++) for (let x = 13; x <= (R.K ? 16 : 15); x++) tintSkin(R, x, y, 0x4a2a6a, y === E + 1 || y === E - 2 ? 0.35 : 0.5); },
    side(R) { const E = R.eyeRow; for (let y = E - 2; y <= E + 1; y++) for (let x = 13; x <= 16; x++) tintSkin(R, x, y, 0x4a2a6a, 0.42); },
  },
  scrape: {
    label: 'Skrubbsår', group: 'Ärr & plåster',
    front(R) { const E = R.eyeRow; for (const [x, y, t] of [[7, 1, 0.4], [8, 1, 0.55], [8, 2, 0.4], [9, 2, 0.3], [7, 2, 0.3]]) tintSkin(R, x, E + y, 0xc03030, t); },
    side(R) { const E = R.eyeRow; for (const [x, y, t] of [[12, 1, 0.4], [13, 1, 0.55], [13, 2, 0.4], [14, 2, 0.3]]) tintSkin(R, x, E + y, 0xc03030, t); },
  },
  dirty: {
    label: 'Sotig', group: 'Ärr & plåster',
    front(R) { const E = R.eyeRow; for (const [x, y, t] of [[8, 2, 0.45], [9, 2, 0.3], [8, 1, 0.25], [14, 1, 0.35], [15, 1, 0.45], [15, 2, 0.25], [12, -4, 0.35], [13, -4, 0.25], [10, 3, 0.3]]) tintSkin(R, x, E + y, 0x3a2e24, t, true); },
    side(R) { const E = R.eyeRow; for (const [x, y, t] of [[13, 1, 0.45], [14, 2, 0.35], [12, 2, 0.25], [15, -4, 0.35], [14, 3, 0.3]]) tintSkin(R, x, E + y, 0x3a2e24, t, true); },
  },
  // --- ansiktsmålning (färg: look.markColor) ---
  heart: {
    label: 'Hjärta', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) { const c = mc(R, 0xe0304a); pix(R, 7, R.eyeRow + 1, ['h.c', 'ccC', '.C.'], { c: c.base, C: c.lo, h: c.hi }); },
    side(R) { const c = mc(R, 0xe0304a); pix(R, 12, R.eyeRow + 1, ['h.c', 'ccC', '.C.'], { c: c.base, C: c.lo, h: c.hi }); },
  },
  star: {
    label: 'Stjärna', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) { const c = mc(R, 0xf0c030); pix(R, 14, R.eyeRow + 1, ['.c.', 'chc', '.c.'], { c: c.base, h: c.hi }); },
    side(R) { const c = mc(R, 0xf0c030); pix(R, 12, R.eyeRow + 1, ['.c.', 'chc', '.c.'], { c: c.base, h: c.hi }); },
  },
  flag: {
    label: 'Svenska flaggan', group: 'Ansiktsmålning',
    front(R) { pix(R, 7, R.eyeRow + 1, ['bybb', 'yyyy', 'bybb'], { b: 0x2f6fc0, y: 0xf0c830 }); },
    side(R) { pix(R, 12, R.eyeRow + 1, ['byb', 'yyy', 'byb'], { b: 0x2f6fc0, y: 0xf0c830 }); },
  },
  finland: {
    label: 'Finska flaggan', group: 'Ansiktsmålning',
    front(R) { pix(R, 7, R.eyeRow + 1, ['wbww', 'bbbb', 'wbww'], { b: 0x2a5ab0, w: 0xf4f1ea }); },
    side(R) { pix(R, 12, R.eyeRow + 1, ['wbw', 'bbb', 'wbw'], { b: 0x2a5ab0, w: 0xf4f1ea }); },
  },
  denmark: {
    label: 'Danska flaggan', group: 'Ansiktsmålning',
    front(R) { pix(R, 7, R.eyeRow + 1, ['rwrr', 'wwww', 'rwrr'], { r: 0xc8202a, w: 0xf4f1ea }); },
    side(R) { pix(R, 12, R.eyeRow + 1, ['rwr', 'www', 'rwr'], { r: 0xc8202a, w: 0xf4f1ea }); },
  },
  supporter: {
    label: 'Supporterränder', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) { const c = mc(R, 0x2f6fc0); pix(R, 8, R.eyeRow + 1, ['cy', 'cy', 'cy'], { c: c.base, y: 0xf0c830 }, 1); },
    side(R) { const c = mc(R, 0x2f6fc0); pix(R, 13, R.eyeRow + 1, ['cy', 'cy', 'cy'], { c: c.base, y: 0xf0c830 }); },
  },
  warPaint: {
    label: 'Krigsmålning', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) { const c = mc(R, 0xd9433b); pix(R, 7, R.eyeRow + 1, ['ccc', '...', 'ccc'], { c: c.base }, 1); },
    side(R) { const c = mc(R, 0xd9433b); pix(R, 12, R.eyeRow + 1, ['ccc', '...', 'ccc'], { c: c.base }); },
  },
  eyeBlack: {
    label: 'Solstrimmor', group: 'Ansiktsmålning',
    front(R) { pix(R, 8, R.eyeRow + 1, ['kkk'], { k: 0x1c1a20 }, 1); },
    side(R) { pix(R, 13, R.eyeRow + 1, ['kkk'], { k: 0x1c1a20 }); },
  },
  bolt: {
    label: 'Blixt', group: 'Ansiktsmålning', uses: ['markColor'],
    // blixt snett över högra ögat (ögat ritas ovanpå)
    front(R) { const c = mc(R, 0xd9433b); pix(R, 13, R.eyeRow - 3, ['..c', '.c.', 'cc.', '.hc', '.c.', 'c..'], { c: c.base, h: c.hi }); R.draw('eyes'); },
    side(R) { const c = mc(R, 0xd9433b); pix(R, 13, R.eyeRow - 3, ['..c', '.c.', 'cc.', '.hc', '.c.', 'c..'], { c: c.base, h: c.hi }); R.draw('eyes'); },
  },
  heroMask: {
    label: 'Hjältemask', group: 'Ansiktsmålning', uses: ['markColor'],
    // ögonmask med knut bak – ögonen ritas ovanpå
    front(R) { const c = mc(R, 0x22222a), y = R.eyeRow - 2; R.rect(7, y, 10, 3, c.base); R.rect(7, y, 10, 1, c.hi); R.put(16, y + 1, c.lo); R.put(16, y + 2, c.lo); R.put(11, y + 2, R.skin.lo); R.put(12, y + 2, R.skin.lo); R.draw('eyes'); },
    side(R) { const c = mc(R, 0x22222a), y = R.eyeRow - 2; R.rect(9, y, 8, 3, c.base); R.rect(9, y, 8, 1, c.hi); R.put(8, y + 1, c.lo); R.put(7, y + 2, c.lo); R.draw('eyes'); },
    back(R) { const c = mc(R, 0x22222a), y = R.eyeRow - 2; R.rect(7, y, 10, 2, c.lo); R.put(11, y + 2, c.lo); R.put(12, y + 3, c.lo); },
    // bandet och knuten ligger utanpå håret (bakifrån och från sidan)
    afterHair(R) {
      if (R.front) return;
      const c = mc(R, 0x22222a), y = R.eyeRow - 2;
      const over = (x, yy, col) => { const t = R.tagAt(x, yy); if (t === TAG.hair || t === TAG.head) R.put(x, yy, col); };
      if (R.back) {
        for (let x = 7; x <= 16; x++) { over(x, y, c.base); over(x, y + 1, c.lo); }
        R.put(11, y, c.hi); R.put(12, y, c.hi); R.put(11, y + 2, c.lo); R.put(12, y + 2, c.base); R.put(12, y + 3, c.lo); R.put(11, y + 3, c.lo);
      } else {
        for (let x = 8; x <= 12; x++) { over(x, y, c.base); over(x, y + 1, c.lo); }
        R.put(8, y + 1, c.lo); R.put(7, y + 2, c.lo);
      }
    },
  },
  butterfly: {
    label: 'Fjäril', group: 'Ansiktsmålning', uses: ['markColor'],
    // vingar runt ögonen, kroppen längs näsryggen
    front(R) {
      const c = mc(R, 0x8e5bd1), E = R.eyeRow;
      pix(R, 7, E - 3, ['cc..', 'cCc.', 'cc..', 'cc..', '.cC.', '.c..'], { c: c.base, C: c.hi }, 1);
      R.put(11, E - 2, 0x2a2030); R.put(12, E - 2, 0x2a2030); R.put(11, E - 1, c.lo); R.put(12, E - 1, c.lo);
      R.draw('eyes');
    },
    side(R) { const c = mc(R, 0x8e5bd1), E = R.eyeRow; pix(R, 12, E - 3, ['..cc', '.cCc', '..cc', '..cc', '.Cc.', '..c.'], { c: c.base, C: c.hi }); R.draw('eyes'); },
  },
  whiskers: {
    label: 'Katt', group: 'Ansiktsmålning',
    front(R) { const E = R.eyeRow, k = 0x1c1a20; R.put(11, E + 2, 0xe07a8a); R.put(12, E + 2, 0xe07a8a); R.put(11, E + 1, 0x2a2030); R.put(12, E + 1, 0x2a2030); pix(R, 7, E + 1, ['kk.', '...', 'kk.'], { k }, 1); pix(R, 8, E + 2, ['k'], { k }, 1); },
    side(R) { const E = R.eyeRow, k = 0x1c1a20; R.put(17, E + 1, 0x2a2030); R.put(17, E + 2, 0xe07a8a); pix(R, 12, E + 1, ['kk', '..', 'kk'], { k }); },
  },
  bindi: {
    label: 'Bindi', group: 'Ansiktsmålning', uses: ['markColor'],
    // en prick mitt i pannan mellan brynen (två pixlar – mitten ligger mellan x 11 och 12)
    front(R) { const c = mc(R, 0xc8202a), y = R.eyeRow - 3; R.put(11, y, c.base); R.put(12, y, c.base); },
    side(R) { R.put(16, R.eyeRow - 3, mc(R, 0xc8202a).base); },
  },
  kissMark: {
    label: 'Pussmärke', group: 'Ansiktsmålning', uses: ['markColor'],
    // läppstiftsavtryck på kinden: över- och underläpp med munspringan emellan
    front(R) { const c = mc(R, 0xe0304a); pix(R, 13, R.eyeRow + 1, ['.cc.', 'cCCc', '.cc.'], { c: c.base, C: c.dk }); },
    side(R) { const c = mc(R, 0xe0304a); pix(R, 12, R.eyeRow + 1, ['.cc.', 'cCCc', '.cc.'], { c: c.base, C: c.dk }); },
  },
  drawnMustache: {
    label: 'Ritad mustasch', group: 'Ansiktsmålning', uses: ['markColor'],
    // tuschmustasch med uppsnurrade spetsar (funkar även på barn – till skillnad från riktigt skägg)
    front(R) { const c = mc(R, 0x1c1a24), y = R.eyeRow + 3; pix(R, 9, y - 1, ['c....c', '.cccc.'], { c: c.base }); },
    side(R) { const c = mc(R, 0x1c1a24), y = R.eyeRow + 3; pix(R, 14, y - 1, ['c..', '.cc'], { c: c.base }); },
  },
  tiger: {
    label: 'Tiger', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) {
      const c = mc(R, 0xf08a24), E = R.eyeRow, k = 0x2a1a14, w = 0xf6f0e4;
      paintFace(R, c);
      pix(R, 7, E + 1, ['kk', '..', 'kk'], { k }, 1); pix(R, 10, E - 4, ['k..', 'k..'], { k }, 1); pix(R, 11, E - 5, ['kk'], { k });
      pix(R, 10, E + 2, ['w..w', 'wwww'], { w }); R.put(11, E + 2, k); R.put(12, E + 2, k); R.draw('mouth');
    },
    side(R) {
      const c = mc(R, 0xf08a24), E = R.eyeRow, k = 0x2a1a14, w = 0xf6f0e4;
      paintFace(R, c);
      pix(R, 12, E + 1, ['kk', '..', 'kk'], { k }); pix(R, 14, E - 5, ['.k', 'k.'], { k });
      pix(R, 15, E + 2, ['ww', 'ww'], { w }); R.put(17, E + 1, k); R.put(17, E + 2, k); R.draw('mouth');
    },
  },
  clown: {
    label: 'Clown', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) {
      const c = mc(R, 0x3a7bd5), E = R.eyeRow, r = 0xd8282a;
      paintFace(R, ramp(0xf6f2ea));
      pix(R, 9, E - 3, ['c', '.', '.', '.', 'c'], { c: c.base }, 1);
      pix(R, 9, E + 3, ['r....r', '.rrrr.'], { r });
      pix(R, 11, E + 1, ['Rr', 'rd'], { r, R: 0xff8a80, d: 0xa01820 });
    },
    side(R) {
      const c = mc(R, 0x3a7bd5), E = R.eyeRow, r = 0xd8282a;
      paintFace(R, ramp(0xf6f2ea));
      pix(R, 15, E - 3, ['c', '.', '.', '.', 'c'], { c: c.base });
      pix(R, 14, E + 3, ['r..', '.rr'], { r });
      pixAny(R, 17, E + 1, ['Rr', 'rd'], { r, R: 0xff8a80, d: 0xa01820 }); // näsan sticker ut – oklippt
    },
  },
  skull: {
    label: 'Dödskalle', group: 'Ansiktsmålning', uses: ['markColor'],
    front(R) {
      const c = mc(R, 0xe0508a), E = R.eyeRow, k = 0x1c1a20;
      paintFace(R, ramp(0xeeeae2));
      pix(R, 8, E - 2, ['.k.', 'kkk', 'kkk', '.k.'], { k }, 1);
      R.put(9, E - 1, 0xffffff); R.put(14, E - 1, 0xffffff);
      pix(R, 11, E + 2, ['kk'], { k });
      pix(R, 9, E + 3, ['kkkkkk', '.k.k.k'], { k });
      R.put(11, E - 4, c.base); R.put(12, E - 4, c.base); R.put(7, E + 1, c.base); R.put(16, E + 1, c.base);
    },
    side(R) {
      const c = mc(R, 0xe0508a), E = R.eyeRow, k = 0x1c1a20;
      paintFace(R, ramp(0xeeeae2));
      pix(R, 14, E - 2, ['.k.', 'kkk', 'kkk', '.k.'], { k }); R.put(15, E - 1, 0xffffff);
      R.put(17, E + 1, k); R.put(17, E + 2, k);
      pix(R, 13, E + 3, ['kkkk', '.k.k'], { k }); R.put(13, E + 1, c.base);
    },
  },
  panda: {
    label: 'Panda', group: 'Ansiktsmålning',
    front(R) {
      const E = R.eyeRow, k = 0x1c1a20;
      paintFace(R, ramp(0xf2efe8)); paintEars(R, ramp(0x2a2830));
      pix(R, 7, E - 2, ['.kk.', 'kkkk', 'kkkk', '.kk.'], { k }, 1);
      R.put(9, E - 1, 0xffffff); R.put(14, E - 1, 0xffffff);
      pix(R, 11, E + 2, ['kk'], { k }); R.draw('mouth');
    },
    side(R) {
      const E = R.eyeRow, k = 0x1c1a20;
      paintFace(R, ramp(0xf2efe8)); paintEars(R, ramp(0x2a2830));
      pix(R, 13, E - 2, ['.kk', 'kkk', 'kkk', '.kk'], { k }); R.put(15, E - 1, 0xffffff);
      R.put(17, E + 1, k); R.put(17, E + 2, k); R.draw('mouth');
    },
    back(R) { paintEars(R, ramp(0x2a2830)); },
  },
  zombie: {
    label: 'Zombie', group: 'Ansiktsmålning',
    front(R) {
      const E = R.eyeRow;
      paintFace(R, ramp(0x8aa27a));
      for (const x of [8, 9, 10, 13, 14, 15]) tintSkin(R, x, E + 1, 0x3a2a4a, 0.45);
      pix(R, 13, E + 2, ['s.s', 'sss', 's.s'], { s: 0x3a2a30 });
    },
    side(R) {
      const E = R.eyeRow;
      paintFace(R, ramp(0x8aa27a));
      tintSkin(R, 14, E + 1, 0x3a2a4a, 0.45); tintSkin(R, 15, E + 1, 0x3a2a4a, 0.45);
      pix(R, 13, E + 2, ['s.s', 'sss', 's.s'], { s: 0x3a2a30 });
    },
  },
  // --- tatueringar (bläck) ---
  tearTattoo: Dots('Tår-tatuering', 'Tatueringar', [[15, 1], [15, 2]], [[14, 1], [14, 2]], () => INK),
  starTattoo: {
    label: 'Stjärntatuering', group: 'Tatueringar',
    front(R) { pix(R, 7, R.eyeRow + 1, ['.k.', 'k.k', '.k.'], { k: INK }); },
    side(R) { pix(R, 12, R.eyeRow + 1, ['.k.', 'k.k', '.k.'], { k: INK }); },
  },
  heartTattoo: {
    label: 'Hjärttatuering', group: 'Tatueringar',
    front(R) { pix(R, 14, R.eyeRow + 1, ['k.k', '.k.'], { k: INK }); },
    side(R) { pix(R, 13, R.eyeRow + 1, ['k.k', '.k.'], { k: INK }); },
  },
};
