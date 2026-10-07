// Leksaksaffären Leksakslådan – fasaden: neonskylten LEKSAKER och namnbrädan LEKSAKSLÅDAN (butikens namn,
// som inne på kassadisken). Egen modul; huvudagenten monterar huset i kartan.
//
// Kontrakt (docs/STADEN.md): BUILDING_ART.leksaker = {
//   paint(b, night, opts) → canvas     opts = { snow: 0|1, worn, season } – cachas av scenen per (hus, natt, snö)
//   live(ctx, b, st)                   varje bildruta efter bilden: dörren, modelltåget, ballongerna,
//                                      neonrören och glödlamporna (när det är öppet), vindsnurran, röken
//   glow(ctx, b, st)                   efter mörkret: skyltfönstret, neonskylten, glödlamporna, ljuspölen
//   items(b, st) → [{ x, y, draw }]    y-sorterat: barnen som stannar och tittar i fönstret, gatuprataren
//                                      och barnens pratbubblor (y ≥ 1e5 = överst)
//   obstacles(b) → [[x0, y0, x1, y1]]  gatupratarens fot på trottoaren
// }
// Bilden fungerar i alla rader: den är artBox(b).h hög och står på b.base (artPos), så canvasens
// rad r = världens y r + oy (oy = 0 i norra raden, 454 i södra) och kolumn c = världens x c + b.x − 8.
// Allt som live/glow/items behöver sparas i META i VÄRLDSKOORDINATER.
//
// Modelltåget: ett lok, en personvagn (med en nalle i fönstret) och ett flak (med en Klämkompis-kanin)
// kör motsols runt en oval bana (stadion: två raksträckor och två halvcirklar) på skyltfönstrets golv.
// Vagnarna är små voxelmodeller som strålföljs EN gång per riktning till färdiga pixelbilder i 16
// riktningar (22,5°) – ingenting skalas eller vrids medan spelet går, och positionen avrundas till
// hela pixlar. Bakre halvan av banan ritas bakom mellanlagret (klossarna och nallen med ballongerna),
// främre halvan framför. Tåget går bara när butiken är öppen; vid stängning rullar det vidare till
// "stationen" på framsträckan och bromsar mjukt in där – på natten står det still i stjärnljuset.
// Ångkorgen med squishy-dumplings står på en hylla på fönstrets vänstra vägg (i ögonhöjd).
import { Pix, SMALL, BIG, text, textW, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { CITY, artBox, baseOf, ART_OVER, ART_BELOW } from './map.js';
import { drawPerson } from '../core/people.js';
import { $t } from '../core/i18n.js';

const O = ART_OVER, DOOR_H = 34, OUT = 0x2a1a2c, WHITE = 0xffffff;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${clamp(a, 0, 1).toFixed(3)})`;
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const q = (t, x, y, n = 4) => Math.max(0, Math.min(n, Math.round(t * n + bayer(x, y) - 0.5))) / n;
const isOpen = (b, h) => !b.open || (h >= b.open[0] && h < b.open[1]);
const snowOf = (st) => ((st?.env?.weather?.snowCover || 0) > 0.5 ? 1 : 0);
const windOf = (st) => { const w = st?.env?.weather; return w ? (w.windNow ?? w.wind ?? 0) : 0; };

// Färgerna: rosa lockpanel, mintgröna snickerier, gräddvita lister, turkost fjällpannetak,
// plommonfärgad skylt med guldram, regnbågsmarkis och neon i åtta färger.
const C = {
  wall: 0xf4b0c4, wallL: 0xffd2dd, wallD: 0xcf8aa2,
  trim: 0xfff2e2, trimD: 0xd2bea8,
  mint: 0x74d0b6, mintL: 0xb4eed8, mintD: 0x3a9a84,
  roof: 0x5ab0c8, ridge: 0x2a6a86,
  plum: 0x2e2254, gold: 0xf2c24e, goldD: 0xa8781e,
  door: 0xf8d460, lav: 0x8272c4, lavD: 0x564a96,
  brick: 0xe4899c,
};
const RAINBOW = [0xe8464e, 0xf49a38, 0xf8d648, 0x66c258, 0x4898e0, 0x9868d8];
const NEON = [0xff4f9a, 0xff9a36, 0xffe046, 0x5ce06a, 0x46d8f4, 0x5a86ff, 0xb466ff, 0xff4f9a];
const WORD = $t('LEKSAKER');

// ================= små målarverktyg =================
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, q(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
}
// ljus från sydväst: runda saker får högdager uppe till vänster, skugga nere till höger
function tone(c, nx, ny, x, y) {
  const v = -0.62 * nx - 0.78 * ny + (bayer(x, y) - 0.5) * 0.35;
  return v > 0.42 ? mix(c, WHITE, 0.3) : v < -0.38 ? mul(c, 0.74) : c;
}
function blob(S, cx, cy, rx, ry, c, flat = false) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    S.px(x, y, flat ? c : tone(c, nx, ny, x, y));
  }
}
// pixelbild ur strängrader: pal = { tecken: färg }
function art(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), S = new Pix(w, h);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined && c !== null) S.px(i, j, c); } });
  return S;
}
const opaque = (S, x, y) => x >= 0 && y >= 0 && x < S.w && y < S.h && S.d[(y * S.w + x) * 4 + 3] > 0;
const colAt = (S, x, y) => { const i = (y * S.w + x) * 4; return (S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2]; };
// ny bild med en pixels kontur runt allt som syns
function outlined(S, col = OUT) {
  const T = new Pix(S.w + 2, S.h + 2);
  for (let y = -1; y <= S.h; y++) for (let x = -1; x <= S.w; x++) {
    if (opaque(S, x, y)) T.px(x + 1, y + 1, colAt(S, x, y), S.d[(y * S.w + x) * 4 + 3] / 255);
    else if (opaque(S, x - 1, y) || opaque(S, x + 1, y) || opaque(S, x, y - 1) || opaque(S, x, y + 1)) T.px(x + 1, y + 1, col);
  }
  return T;
}
function stamp(P, S, x, y, f = null) {
  for (let j = 0; j < S.h; j++) for (let i = 0; i < S.w; i++) {
    const k = (j * S.w + i) * 4, a = S.d[k + 3];
    if (!a) continue;
    const c = (S.d[k] << 16) | (S.d[k + 1] << 8) | S.d[k + 2];
    P.px(x + i, y + j, f ? f(c, x + i, y + j) : c, a / 255);
  }
}
// natt inne i butiken: mörkt och blåaktigt, varmt runt stjärnlampan (lamp = [x, y] i samma rum)
function nightTone(c, x, y, lamp) {
  let warm = 0;
  if (lamp) { const d = Math.hypot(x - lamp[0], (y - lamp[1]) * 1.3); warm = q(clamp(1 - d / 17, 0, 1), x, y, 4); }
  const k = mix(mul(c, 0.36 + 0.5 * warm), 0x141a3a, 0.22 * (1 - warm));
  return warm > 0 ? mix(k, 0xffb860, 0.22 * warm) : k;
}
function nightify(P, x0, y0, x1, y1, lamp) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const xx = x - P.ox, yy = y - P.oy;
    if (xx < 0 || yy < 0 || xx >= P.w || yy >= P.h) continue;
    const i = (yy * P.w + xx) * 4;
    if (!P.d[i + 3]) continue;
    const c = nightTone((P.d[i] << 16) | (P.d[i + 1] << 8) | P.d[i + 2], x, y, lamp);
    P.d[i] = (c >> 16) & 255; P.d[i + 1] = (c >> 8) & 255; P.d[i + 2] = c & 255;
  }
}
function canvasOf(S) { return S.flush(); }

// ================= husets geometri (canvas-koordinater + förskjutning till världen) =================
function geo(b) {
  const box = artBox(b), W = b.w + 2 * O, H = box.h, G = H - ART_BELOW;
  const base = baseOf(b), oy = base + ART_BELOW - H, ox = b.x - O;
  const L = O, R = O + b.w, yT = G - b.h;
  const dx0 = b.door.x0 - ox, dx1 = b.door.x1 - ox;
  // skyltfönstret tar den bredaste biten bredvid dörren; en smal bit på andra sidan blir ett squishy-torn
  const segL = [L + 4, dx0 - 5], segR = [dx1 + 5, R - 4];
  const wideL = segL[1] - segL[0] >= segR[1] - segR[0];
  const big = wideL ? segL : segR, other = wideL ? segR : segL;
  const win = { x0: big[0], x1: big[1], y0: G - 52, y1: G - 11 };
  const win2 = other[1] - other[0] >= 12 ? { x0: other[0], x1: other[1], y0: G - 46, y1: G - 11 } : null;
  const rowTop = b.row === 'f' ? G - (b.d || 20) : (b.top ?? (b.row === 's' ? CITY.FOOT_TOP_S : CITY.FOOT_TOP)) - oy;
  const roofTop = b.row === 'f' ? Math.max(6, yT - clamp(b.d || 20, 10, 30)) : Math.max(8, rowTop - 6, yT - 38);
  const sign = { x0: L + 1, x1: R - 1, y0: G - 89, y1: G - 65 };
  return { W, H, G, oy, ox, L, R, yT, dx0, dx1, win, win2, roofTop, sign, mx: (L + R) >> 1, base };
}

// ================= små leksaker (pixelbilder) =================
// Klämkompisarna – samma åtta EGNA figurer som butiken säljer (KOMPISAR i js/data/toys.js; nycklarna här
// är deras 'art') med samma färger och kännetecken, ritade i fasadens lilla format (7 px breda). Inga lånade
// figurer: ögonen sitter alltid I ansiktet, och varje figur har sitt eget märke (kaninens vikta öra, grodans
// blomma på bulan, pingvinens halsduk, rävens svanstipp, kattens fläckar, ankans skott på huvudet).
// Tecken: h ljus, w bas, W skugga, m mage/nos, p öronens insida, k ögon, b kinder, n näsa/näbb, N näbbens
// undersida; resten är figurens egna detaljer (se KOMPIS_PAL).
const INK = 0x2b1622;
const KOMPIS = {
  // Pösa – lavendelkanin med vikt öra (höger öra viker sig åt höger), rosa nos
  kanin: { col: 0xd6c2f2, m: 0xf6eefe, p: 0xffb4cc, n: 0xff8cb0, b: 0xff8cb0, rows: [
    '.h.....',
    '.wp.hwW',
    '.wp.pw.',
    '.hwwwW.',
    'hwwwwwW',
    'wkwwwkW',
    'wbwnwbW',
    '.wmmmW.',
    '.wW.wW.'] },
  // Brumme – honungsbjörn med runda öron och ljus nos (lappen på magen syns inte i det här formatet)
  bjorn: { col: 0xe2a462, m: 0xfbe6c4, p: 0xb8773c, rows: [
    'hh...hW',
    'hpwwwpW',
    'wwwwwwW',
    'wkwwwkW',
    'wbmkmbW',
    '.wmmmW.',
    'wWmmmWW',
    '.wW.wW.'] },
  // Lilja – mintgrön groda: två bulor på huvudet, en blomma på den vänstra, ögonen i ansiktet och ett litet leende
  groda: { col: 0x98dc9a, m: 0xe6f8cc, b: 0xff8aa8, f: 0xff8ac0, y: 0xffe04a, r: 0x7a3a4a, rows: [
    '.f.....',
    'fyf.hW.',
    'hfwwwwW',
    'wkwwwkW',
    'wbwwwbW',
    '.wrkrW.',
    '.wmmmW.',
    '.wW.wW.'] },
  // Isa – ljusblå pingvin med vit ansiktsmask, orange näbb och röd stickad halsduk
  pingvin: { col: 0x8cbcec, m: 0xffffff, n: 0xffb830, x: 0xffffff, r: 0xe0384a, R: 0xb02838, o: 0xffb040, rows: [
    '...h...',
    '.hwwwW.',
    'hxxwxxW',
    'wkxxxkW',
    'wbxnxbW',
    'rrxrrrR',
    '.rmmmW.',
    '.oo.oo.'] },
  // Glöd – nyfiken räv: mörka örontoppar, vita kinder, svans med vit tipp
  rav: { col: 0xf4944a, m: 0xfff2e2, t: 0x5a3426, x: 0xfff8f0, rows: [
    't.....t',
    'wm...mW',
    'hwwwwwW',
    'wkwwwkW',
    'mbmkmbm',
    '.wmmmWx',
    '.wmmmWw',
    '.wW.wW.'] },
  // Hoa – klok uggla: örontofsar, ljusa ögonskivor och orange näbb
  uggla: { col: 0xb48c68, m: 0xf4e2c4, n: 0xf2a23a, rows: [
    'h.....W',
    'hwwwwwW',
    'mmmwmmm',
    'mkmwmkm',
    'wbwnwbW',
    '.wmmmW.',
    'wWmmmWW',
    '.WW.WW.'] },
  // Mysan – trefärgad katt: orange fläck runt vänster öga och öra, mörk fläck på höger sida, rosa nos
  katt: { col: 0xfff2e4, m: 0xffffff, p: 0xffb0c4, n: 0xff8cb0, c: 0xf4a24e, d: 0x6a4a3c, rows: [
    'c.....d',
    'cp...pd',
    'ccwwwdd',
    'ckcwwkW',
    'wbwnwbW',
    '.wmmmW.',
    'wWmmmWW',
    '.wW.wW.'] },
  // Pipp – gul ankunge med ett grönt skott på huvudet och orange näbb
  anka: { col: 0xffe064, m: 0xfff4b4, n: 0xffa044, N: 0xe07a26, g: 0x7ad060, G: 0x3a9a44, o: 0xff9a3a, rows: [
    '.gG.Gg.',
    '...G...',
    '.hwwwW.',
    'hwwwwwW',
    'wkwwwkW',
    'wbnnnbW',
    '.wNNNW.',
    '.wmmmW.',
    '.oo.oo.'] },
};
const PLUSH_CACHE = {};
function plushSprite(kind) {
  if (!PLUSH_CACHE[kind]) {
    const K = KOMPIS[kind] || KOMPIS.kanin, c = K.col;
    const pal = {
      h: mix(c, WHITE, 0.3), w: c, W: mix(mul(c, 0.86), 0x8a70c8, 0.14), m: K.m, p: K.p ?? mix(c, 0xffb4cc, 0.6),
      k: INK, b: K.b ?? 0xff7c9c, n: K.n ?? INK, N: K.N ?? mul(K.n ?? INK, 0.82),
      f: K.f, y: K.y, x: K.x, r: K.r, R: K.R, o: K.o, t: K.t, c: K.c, d: K.d, g: K.g, G: K.G,
    };
    // konturen tonas mot figurens färg (som i toys.js), så att ljusa figurer inte får en kolsvart kant
    PLUSH_CACHE[kind] = outlined(art(K.rows, pal), mix(0x2e1a2c, c, 0.3));
  }
  return PLUSH_CACHE[kind];
}
// squishy-dumpling med veckad topp och kawaii-ansikte (7×6)
const DUMP_ART = ['..ada..', '.edaee.', 'eeeeeee', 'ekeeeke', 'ebeoebe', '.eeeee.'];
function dumplingSprite(col) {
  return outlined(art(DUMP_ART, { e: col, a: mul(col, 0.84), d: mix(col, 0xb89080, 0.35), k: 0x2a1a22, b: 0xff90aa, o: 0xb0404e }), mix(mul(col, 0.62), 0x6a4a50, 0.4));
}
// ballong (5×6) och stor ballong vid dörren (6×8); h = högdager, d = skugga
const BALLOON_S = ['.ccc.', 'chccc', 'chccc', 'ccccd', '.cdd.', '..d..'];
const BALLOON_L = ['.cccc.', 'chhccc', 'chcccc', 'cccccd', 'cccccd', '.ccdd.', '..dd..', '..d...'];
const HEART_L = ['cc..cc.', 'chcccc.', 'chccccd', 'cccccd.', '.cccd..', '..cd...', '...d...'];
function balloonSprite(rows, col) {
  return art(rows, { c: col, h: mix(col, WHITE, 0.6), d: mul(col, 0.7) });
}
// ballong med Pösas huvud (lavendelkaninen med det vikta örat) för dörren
const BUNNYB = ['.h....', '.wp.hW', '.wp.w.', 'hwwwwW', 'wkwwkW', 'bwnnwb', '.wwwW.', '..dd..', '..d...'];
// klossar: 5×5 framsida + 2 rader topp, en vit symbol på framsidan
const SYM = { a: ['.#.', '###', '#.#'], b: ['##.', '###', '##.'], c: ['.##', '#..', '.##'], h: ['#.#', '###', '.#.'], s: ['.#.', '###', '.#.'], o: ['###', '#.#', '###'] };
function block(P, x, y, c, sym) {
  for (let i = 0; i < 5; i++) { P.px(x + i, y - 2, mix(c, WHITE, 0.45)); P.px(x + i, y - 1, mix(c, WHITE, 0.28)); }
  P.px(x + 4, y - 2, mix(c, WHITE, 0.2));
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) P.px(x + i, y + j, i === 0 ? mix(c, WHITE, 0.12) : i === 4 || j === 4 ? mul(c, 0.72) : c);
  SYM[sym].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '#') P.px(x + 1 + i, y + 1 + j, mix(c, WHITE, 0.82)); });
}
function blocksSprite() {
  const S = new Pix(16, 19), fy = 17; // klossarnas framsidor: 5 hög, toppen 2 rader (översta klossens topp på rad 0)
  const cols = [[0xe8464e, 'a'], [0x4898e0, 'b'], [0xf8c838, 'c'], [0x66c258, 'h'], [0xf49a38, 's'], [0x9868d8, 'o']];
  block(S, 0, fy - 5, cols[0][0], cols[0][1]); block(S, 5, fy - 5, cols[1][0], cols[1][1]); block(S, 10, fy - 5, cols[2][0], cols[2][1]);
  block(S, 3, fy - 10, cols[3][0], cols[3][1]); block(S, 8, fy - 10, cols[4][0], cols[4][1]);
  block(S, 6, fy - 15, cols[5][0], cols[5][1]);
  return outlined(S, 0x3a2a3a);
}
// sittande nalle med rosett; vänster tass uppe (håller ballongsnörena). hat = tomtemössa (snö)
function teddySprite(hat) {
  const S = new Pix(18, 25), fur = 0xc98c52, muz = 0xf4dcb2, cx = 8.5, top = 3;
  blob(S, cx, top + 12.6, 5.3, 5, fur);                          // kroppen
  blob(S, cx, top + 13.6, 2.7, 2.8, mix(fur, muz, 0.55), true);  // magen
  blob(S, 14.5, top + 13.2, 1.9, 2.7, fur);                      // höger arm vilar
  blob(S, 5, top + 17.6, 2.8, 2.4, fur); blob(S, 12, top + 17.6, 2.8, 2.4, fur); // benen
  blob(S, 5, top + 18.1, 1.4, 1.3, muz, true); blob(S, 12, top + 18.1, 1.4, 1.3, muz, true); // trampdynor
  blob(S, 3.7, top + 1.8, 1.9, 1.9, fur); blob(S, 13.3, top + 1.8, 1.9, 1.9, fur); // öronen
  S.px(3, top + 1, mix(fur, muz, 0.6)); S.px(13, top + 1, mix(fur, muz, 0.6));
  blob(S, cx, top + 5.6, 5.1, 4.6, fur);                         // huvudet
  blob(S, cx, top + 7.4, 2.3, 1.6, muz, true);                   // nospartiet
  // vänster arm lyft snett upp och ut (håller ballongsnörena), tassen med ljus trampdyna
  blob(S, 2.7, top + 8.6, 1.7, 2.3, fur); blob(S, 1.9, top + 5.9, 1.7, 1.7, fur);
  S.px(1, top + 5, muz); S.px(2, top + 5, mix(fur, muz, 0.5));
  const ink = 0x2a1a18;
  S.px(6, top + 5, ink); S.px(11, top + 5, ink); S.px(6, top + 4, 0x6a4a3a); S.px(11, top + 4, 0x6a4a3a);
  S.px(8, top + 6, ink); S.px(9, top + 6, ink); S.px(8, top + 7, 0x7a4a3a);
  S.px(4, top + 7, 0xf29aa0); S.px(13, top + 7, 0xf29aa0);        // rosiga kinder
  // rosett i halsen
  const bow = 0xe63a52;
  for (const [x, y, c] of [[6, 10, bow], [7, 11, bow], [6, 11, mul(bow, 0.8)], [8, 10, 0xff7a8a], [9, 10, 0xff7a8a], [10, 11, bow], [11, 10, bow], [11, 11, mul(bow, 0.8)], [8, 11, mul(bow, 0.9)], [9, 11, mul(bow, 0.9)]]) S.px(x, y + top, c);
  if (hat) { // tomtemössa med vit kant och tofs
    for (let x = 3; x <= 13; x++) { S.px(x, top + 1, 0xf6f2ee); S.px(x, top + 2, x % 2 ? 0xe8e4e0 : 0xffffff); }
    for (let r = 0; r < 5; r++) for (let x = 4 + r; x <= 12 - r + (r > 2 ? 1 : 0); x++) S.px(x + (r > 2 ? r - 2 : 0), top - r, r === 0 ? 0xc8283a : 0xe03446);
    S.px(14, top - 4, 0xffffff); S.px(15, top - 4, 0xe8e4e0); S.px(14, top - 3, 0xe8e4e0);
  }
  return outlined(S, 0x4a2a1c);
}
// bambukorg (ångkorg) med tre squishy-dumplings
function steamerSprite() {
  const S = new Pix(17, 13);
  const bam = 0xd8b46c, bamD = 0x9a7438, bamL = 0xf4dca0;
  for (let x = 1; x < 16; x++) S.px(x, 6, mul(bamD, 0.8));        // insidan bakre kanten
  stamp(S, dumplingSprite(0xfff4e8), 5, 0);                       // bakre (vit)
  stamp(S, dumplingSprite(0xffcfdc), 0, 2);                       // rosa
  stamp(S, dumplingSprite(0xc8f0da), 8, 3);                       // mint
  for (let y = 8; y < 13; y++) for (let x = 0; x < 17; x++) {     // korgens framsida
    let c = (x & 1) ? bam : mix(bam, bamL, 0.35);
    if (y === 8) c = bamL; else if (y === 10) c = bamD; else if (y === 12) c = mul(bamD, 0.8);
    if ((x === 0 || x === 16) && y > 8) c = mul(bamD, 0.9);
    S.px(x, y, c);
  }
  return S;
}
// stjärnlampa (5×5)
const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
// vindsnurra: fyra blad i olika färger, 8 vridlägen (45°) – förberäknade pixelbilder
let PINWHEEL = null;
function pinwheelFrames() {
  if (PINWHEEL) return PINWHEEL;
  const cols = [0xff5a8a, 0xf8d648, 0x4ec0e8, 0x7ad062];
  PINWHEEL = [];
  for (let f = 0; f < 8; f++) {
    const S = new Pix(11, 11), a0 = (f * Math.PI) / 4;
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const dx = x + 0.5 - 5.5, dy = y + 0.5 - 5.5, r = Math.hypot(dx, dy);
      if (r > 5.3 || r < 0.6) continue;
      let a = Math.atan2(dy, dx) - a0; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const blade = Math.floor(a / (Math.PI / 2)), within = (a % (Math.PI / 2)) / (Math.PI / 2);
      // bladet är en snedställd triangel: bredare längre ut
      if (within > 0.2 + (r / 5.3) * 0.62) continue;
      const c = cols[blade];
      S.px(x, y, within < 0.25 ? mix(c, WHITE, 0.35) : r > 4.2 ? mul(c, 0.82) : c);
    }
    S.px(5, 5, 0xf8f4ea); S.px(5, 4, 0xd8d0c0);
    PINWHEEL.push(canvasOf(outlined(S, 0x3a2a3a)));
  }
  return PINWHEEL;
}

// ================= modelltåget: voxelmodeller → förberäknade pixelbilder =================
const VOX = {
  k: 0x1c1a24, K: 0x3c3a48, R: 0xa82232, r: 0xe83a42, b: 0x3a7ae2, B: 0x2452aa, y: 0xf8d040, o: 0xf0a030,
  W: 0xaee0ff, S: 0xd0d4dc, g: 0x4ab85a, G: 0x2a7a3a, w: 0xf8f4ee, n: 0xb07a4a, p: 0xff8ab0, l: 0xfff4a0, c: 0x6ad0f0,
  v: 0xd6c2f2,
};
// lokala koordinater: x = längs färdriktningen (0 = bak), y = tvärs, z = upp
const MODELS = {
  lok: { lx: 10, ly: 5, lz: 8, at(x, y, z) {
    const side = y === 0 || y === 4;
    if (z === 0) {
      if (side && [1, 2, 5, 7, 8].includes(x)) return x === 1 || x === 7 ? 'S' : 'k';   // hjulen
      if (x === 9 && y >= 1 && y <= 3) return 'r';                                  // plogen
      return 0;
    }
    if (z === 1) return side && [1, 2, 5, 7, 8].includes(x) ? 'k' : x === 9 ? 'k' : 'R'; // chassiet
    if (x <= 2) {                                                                    // hytten
      if (z <= 4) { if (z >= 3 && ((side && x === 1) || (x === 0 && y >= 1 && y <= 3))) return 'W'; return z === 2 ? 'y' : 'r'; }
      if (z === 5) return side || x === 0 ? 'R' : 'r';                               // taket
      return 0;
    }
    if (side && z === 2) return 'R';                                                 // gångbordet längs pannan
    if (y >= 1 && y <= 3 && z >= 2 && z <= 4) {                                     // pannan
      if (x === 9) return z === 3 && y === 2 ? 'l' : 'S';                           // fronten med lyktan
      if (x === 6) return 'y';
      return 'b';
    }
    if (x === 7 && y === 2 && (z === 5 || z === 6)) return 'k';                      // skorstenen
    if ((x === 6 || x === 8) && y === 2 && z === 6) return 'k';
    if (x === 5 && y === 2 && z === 5) return 'o';                                   // domen
    return 0;
  } },
  vagn: { lx: 9, ly: 5, lz: 7, at(x, y, z) {
    const side = y === 0 || y === 4, end = x === 0 || x === 8;
    if (z === 0) return side && [1, 2, 6, 7].includes(x) ? (x === 1 || x === 6 ? 'S' : 'k') : 0;
    if (z === 1) return 'K';
    if (z === 2) return end ? 'o' : 'y';
    if (z === 3 || z === 4) {                                                        // fönsterbandet (två rader högt)
      if (end) return y === 2 ? 'W' : 'o';
      if (!side) return 'y';
      if (x === 3 || x === 5) return 'y';
      return x === 4 ? (z === 4 ? 'n' : 'W') : 'W';                                  // en nallepassagerare i mitten
    }
    if (z === 5) return y === 0 || y === 4 || end ? 'R' : 'r';                       // taket med mörk kant
    return 0;
  } },
  flak: { lx: 8, ly: 5, lz: 8, at(x, y, z) {
    const side = y === 0 || y === 4, end = x === 0 || x === 7;
    if (z === 0) return side && [1, 2, 5, 6].includes(x) ? (x === 1 || x === 5 ? 'S' : 'k') : 0;
    if (z === 1) return 'K';
    if ((side || end) && z <= 3) return z === 3 ? 'G' : 'g';                        // flakets kanter
    // lasten: Pösa (lavendelkaninen med det vikta örat) åker med
    if (x >= 3 && x <= 4 && y >= 1 && y <= 3 && z >= 2 && z <= 5) return z === 5 && x === 4 && (y === 1 || y === 3) ? 'k' : 'v';
    if (x === 3 && y === 1 && z >= 6 && z <= 7) return z === 6 ? 'p' : 'v';             // rakt öra
    if (y === 3 && z === 6 && (x === 3 || x === 2)) return x === 3 ? 'p' : 'v';          // vikt öra (lutar bakåt)
    if (z === 2 && !side && !end) return ['r', 'c', 'y', 'p'][(x + y) % 4];           // färgglada bollar i botten
    return 0;
  } },
};
const HEADINGS = 16;
let TRAIN_SPR = null;
// strålföljning i samma snedprojektion som husen: sx = X, sy = −Z − Y/2 (Y = norrut, bort från kameran)
function voxSprite(M, th) {
  const R = Math.ceil(Math.hypot(M.lx, M.ly) / 2) + 1;
  const xs0 = -R - 1, xs1 = R, ys0 = -M.lz - Math.ceil(R / 2) - 2, ys1 = Math.ceil(R / 2) + 1;
  const w = xs1 - xs0 + 1, h = ys1 - ys0 + 1, S = new Pix(w, h);
  const c = Math.cos(th), s = Math.sin(th), LX = -Math.SQRT1_2, LY = -Math.SQRT1_2;
  for (let sy = ys0; sy <= ys1; sy++) for (let sx = xs0; sx <= xs1; sx++) {
    const X = sx + 0.5, yy = sy + 0.5;
    let px = null, py = null, pz = null;
    for (let Y = -R - 2; Y <= R + 2; Y += 0.06) {
      const Z = -yy - 0.5 * Y;
      if (Z >= M.lz) continue;
      if (Z < 0) break;
      const lx = X * c + Y * s + M.lx / 2, ly = -X * s + Y * c + M.ly / 2;
      const ix = Math.floor(lx), iy = Math.floor(ly), iz = Math.floor(Z);
      const key = ix >= 0 && iy >= 0 && ix < M.lx && iy < M.ly ? M.at(ix, iy, iz) : 0;
      if (key) {
        const base = VOX[key];
        let f;
        if (px === null || pz !== iz) f = 1.14;                               // toppen: strålen kom ovanifrån
        else {
          let nx = 0, ny = 0;
          if (px !== ix) nx = px > ix ? 1 : -1; else if (py !== iy) ny = py > iy ? 1 : -1;
          const wxn = nx * c - ny * s, wyn = nx * s + ny * c;
          f = 0.82 + 0.2 * (wxn * LX + wyn * LY);
        }
        S.px(sx - xs0, sy - ys0, key === 'l' ? base : f > 1 ? mix(base, WHITE, f - 1) : mul(base, f));
        break;
      }
      px = ix; py = iy; pz = iz;
    }
  }
  const T = outlined(S, 0x22182a);
  return { day: T, ax: -xs0 + 1, ay: -ys0 + 1 };
}
// en riktning i taget, första gången den behövs (sprider strålföljningen över bildrutorna)
function trainSprite(kind, i) {
  TRAIN_SPR ||= {};
  const list = TRAIN_SPR[kind] || (TRAIN_SPR[kind] = new Array(HEADINGS).fill(null));
  if (!list[i]) {
    const sp = voxSprite(MODELS[kind], (i * 2 * Math.PI) / HEADINGS);
    const N = new Pix(sp.day.w, sp.day.h);
    stamp(N, sp.day, 0, 0, (col) => mix(mul(col, 0.42), 0x141a3a, 0.2));
    list[i] = { day: canvasOf(sp.day), night: canvasOf(N), ax: sp.ax, ay: sp.ay };
  }
  return list[i];
}
function trainSprites() {
  for (const k of Object.keys(MODELS)) for (let i = 0; i < HEADINGS; i++) trainSprite(k, i);
  return TRAIN_SPR;
}
const CARS = [['lok', 0], ['vagn', 10], ['flak', 19]];
// banan i marken (Y norrut): framsträckan österut, östra kurvan norrut, bakre sträckan västerut, västra kurvan söderut
function trackAt(T, s) {
  const { Ls, r, len } = T, hl = Ls / 2, arc = Math.PI * r;
  s = ((s % len) + len) % len;
  if (s < Ls) return { X: -hl + s, Y: -r, th: 0 };
  s -= Ls;
  if (s < arc) { const a = -Math.PI / 2 + s / r; return { X: hl + r * Math.cos(a), Y: r * Math.sin(a), th: a + Math.PI / 2 }; }
  s -= arc;
  if (s < Ls) return { X: hl - s, Y: r, th: Math.PI };
  s -= Ls;
  const a = Math.PI / 2 + s / r;
  return { X: -hl + r * Math.cos(a), Y: r * Math.sin(a), th: a + Math.PI / 2 };
}
const headIdx = (th) => ((Math.round(th / ((2 * Math.PI) / HEADINGS)) % HEADINGS) + HEADINGS) % HEADINGS;

// ================= MÅLNINGEN =================
const META = {};
const metaKey = (b, night, snow) => b.id + ':' + (night ? 1 : 0) + ':' + (snow ? 1 : 0);
function metaFor(b, night, snow) {
  const k = metaKey(b, night, snow);
  if (!META[k]) paintLeksaker(b, night, { snow }); // live före paint (t.ex. i ett test): måla för att få lagren
  return META[k];
}

// fjällpannor (fiskfjäll) i turkost
function scaleTiles(P, x, y, w, h, c, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, row = Math.floor(j / 3), off = (row & 1) * 2;
    const lx = (i + off) % 4, ly = j % 3, col = Math.floor((i + off) / 4);
    let k = mul(c, 0.88 + hash(col, row, seed) * 0.22);
    if (hash(col, row, seed + 1) > 0.93) k = mix(k, 0xf4b0c4, 0.35);   // en och annan rosa panna
    if (ly === 2 && (lx === 0 || lx === 3)) k = mix(mul(c, 0.5), 0x1a2a3a, 0.2);
    else if (ly === 2) k = mul(k, 0.84);
    else if (ly === 0 && (lx === 1 || lx === 2)) k = mix(k, WHITE, 0.24);
    else if (lx === 3) k = mul(k, 0.9);
    P.px(X, Y, k);
  }
}
function paintRoof(P, g, b, snow) {
  const { L, R, yT, roofTop: rT } = g, w = b.w;
  // bortre takfallet i skugga bakom nocken
  scaleTiles(P, L + 1, rT - 4, w - 2, 4, mul(C.roof, 0.66), 11);
  P.hl(L + 1, rT - 5, w - 2, OUT);
  scaleTiles(P, L, rT + 1, w, yT - rT - 1, C.roof, 5);
  for (let y = rT + 1; y < rT + 7; y++) P.darken(L, y, w, 1, 0.8 + (y - rT) * 0.03);   // ljuset faller mot takfoten
  // nockpannor
  for (let x = L; x < R; x++) {
    const seg = (x - L) % 6;
    P.px(x, rT - 2, seg === 0 ? C.ridge : seg < 3 ? mix(C.roof, WHITE, 0.4) : mix(C.roof, WHITE, 0.15));
    P.px(x, rT - 1, seg === 0 ? mul(C.ridge, 0.8) : C.roof); P.px(x, rT, C.ridge);
  }
  // vindskivor i gräddvitt
  P.vl(L, rT - 5, yT - rT + 5, OUT); P.vl(L + 1, rT - 4, yT - rT + 4, C.trim); P.vl(L + 2, rT - 3, yT - rT + 3, C.trimD);
  P.vl(R - 1, rT - 5, yT - rT + 5, OUT); P.vl(R - 2, rT - 4, yT - rT + 4, C.trimD);
  // hängränna i mint
  P.hl(L - 1, yT - 3, w + 2, C.mintL); P.hl(L - 1, yT - 2, w + 2, C.mint); P.hl(L - 1, yT - 1, w + 2, C.mintD);
  if (snow) {
    // ett mjukt snötäcke: svaga vågor där pannraderna ligger under, gnistor, gråare bortre takfall
    for (let y = rT - 4; y < yT - 3; y++) for (let x = L + 1; x < R - 1; x++) {
      const j = y - rT - 1, row = Math.floor(j / 3), lx = ((x - L) + (row & 1) * 2) % 4, ly = ((j % 3) + 3) % 3;
      let c = y < rT - 1 ? 0xd4dcea : mix(0xf4f8fe, 0xe2eaf4, q((y - rT) / (yT - rT), x, y, 3) * 0.7);
      if (y >= rT && ly === 2 && (lx === 0 || lx === 3) && hash(x, y, 91) > 0.25) c = 0xcfdcea;   // pannornas bågar anas
      else if (y >= rT && ly === 0 && hash(x, y, 92) > 0.8) c = WHITE;
      if (hash(x, y, 93) > 0.985) c = WHITE;
      P.px(x, y, c);
    }
    for (let x = L; x < R; x++) P.px(x, rT - 2, 0xf8fbff);                                   // nocken
    // snökant som hänger ut över rännan, och istappar
    for (let x = L - 1; x < R + 1; x++) {
      P.px(x, yT - 4, WHITE); P.px(x, yT - 3, 0xf0f6fc);
      if (hash(x, 3, 94) > 0.35) P.px(x, yT - 2, 0xe6eef8);
    }
    for (let x = L + 1; x < R; x += 2) {
      const n = hash(x, 5, 95);
      if (n < 0.45) continue;
      const len = n > 0.85 ? 3 : n > 0.65 ? 2 : 1;
      for (let k = 0; k < len; k++) P.px(x, yT - 1 + k, k === len - 1 ? 0xb8dcf4 : 0xdcf0ff);
    }
  }
}
// en drake som fastnat på taket (svansen fladdrar i live); returnerar svansens fäste i canvas-koordinater
function paintKite(P, g, snow) {
  const cx = g.L + 17, cy = g.roofTop + 12, cols = [0xff5a8a, 0xf8d648, 0x4ec0e8, 0x7ad062];
  // skugga på pannorna
  for (let j = -6; j <= 6; j++) { const hw = 5 - Math.round(Math.abs(j) * 5 / 6); for (let i = -hw; i <= hw; i++) P.darken(cx + i + 2, cy + j + 2, 1, 1, 0.8); }
  for (let j = -6; j <= 6; j++) {
    const hw = 5 - Math.round(Math.abs(j) * 5 / 6);
    for (let i = -hw; i <= hw; i++) {
      const c = cols[(i < 0 ? 0 : 1) + (j < 0 ? 0 : 2)];
      P.px(cx + i, cy + j, i === 0 || j === 0 ? 0x8a5a3a : Math.abs(i) === hw ? mul(c, 0.78) : (i + j) % 5 === 0 ? mix(c, WHITE, 0.3) : c);
    }
  }
  // snöret ringlar ner över taket till rännan
  let x = cx, y = cy + 6;
  while (y < g.yT - 4) { y++; if (hash(x, y, 55) > 0.6) x += hash(x, y, 56) > 0.5 ? 1 : -1; P.px(x, y, 0xf4f0ea); }
  if (snow) for (let i = -3; i <= 3; i++) P.px(cx + i, cy - 6 + Math.abs(i), WHITE);
  return [cx, cy + 6];
}
// hängskylt med ett nallehuvud på vänstra hörnet
function paintHangSign(P, g) {
  const x = g.L - 7, y = g.sign.y0 - 22;
  P.hl(x - 1, y, 11, 0x3a2a30); P.hl(x - 1, y - 1, 2, 0x3a2a30); P.px(x + 9, y + 1, 0x3a2a30);  // konsolen
  P.line(x + 7, y, x + 9, y - 3, 0x3a2a30);
  P.px(x + 1, y + 1, 0x6a5a50); P.px(x + 6, y + 1, 0x6a5a50);                                   // kedjorna
  const cx = x + 3.5, cy = y + 7.5;
  for (let j = y + 2; j < y + 14; j++) for (let i = x - 2; i < x + 10; i++) {
    const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
    if (d > 5.6) continue;
    P.px(i, j, d > 4.6 ? C.goldD : d > 3.8 ? C.gold : tone(C.mint, (i + 0.5 - cx) / 4, (j + 0.5 - cy) / 4, i, j));
  }
  // nallehuvudet
  const fur = 0xc98c52;
  P.px(x + 1, y + 5, fur); P.px(x + 6, y + 5, fur);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6 - (j === 3 ? 2 : 0); i++) P.px(x + 1 + i + (j === 3 ? 1 : 0), y + 6 + j, fur);
  P.px(x + 2, y + 7, 0x2a1a18); P.px(x + 5, y + 7, 0x2a1a18); P.px(x + 3, y + 8, 0xf4dcb2); P.px(x + 4, y + 8, 0xf4dcb2); P.px(x + 3, y + 9, 0x2a1a18);
}
function paintChimney(P, g, snow) {
  const x = g.R - 26, top = g.roofTop - 9, bot = g.roofTop + 9;
  P.darken(x + 8, top + 5, 3, bot - top - 3, 0.7);
  for (let y = top + 2; y < bot; y++) for (let i = 0; i < 8; i++) {
    const row = Math.floor((y - top) / 2), off = (row & 1) * 2, bx = (i + off) % 4;
    let c = mul(C.brick, 0.9 + hash(Math.floor((i + off) / 4), row, 71) * 0.2);
    if ((y - top) % 2 === 1 || bx === 3) c = mix(C.brick, 0xfff0f0, 0.45);
    if (i === 0) c = mix(c, WHITE, 0.2); if (i === 7) c = mul(c, 0.78);
    P.px(x + i, y, c);
  }
  // ett vitt hjärta på skorstenen
  ['.#.#.', '#####', '.###.', '..#..'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(x + 1 + i, top + 5 + j, j === 0 ? WHITE : 0xfff0f4); });
  P.rect(x - 1, top, 10, 2, 0xf6efe6); P.hl(x - 1, top, 10, WHITE); P.hl(x - 1, top + 2, 10, mul(C.brick, 0.6));
  P.rect(x + 2, top - 1, 4, 1, 0x3a2a30);
  if (snow) { P.hl(x - 1, top - 1, 10, WHITE); P.hl(x, top - 2, 8, 0xeef4fa); }
  return [x + 4, top - 2];
}
// rosa lockpanel med gräddvita hörnbrädor
function paintWall(P, g, b) {
  const { L, R, yT, G } = g;
  for (let y = yT; y < G - 9; y++) for (let x = L; x < R; x++) {
    const j = (y - yT) % 3, joint = ((x - L) + Math.floor((y - yT) / 3) * 13) % 29 === 0;
    let c = mix(C.wall, mix(C.wall, C.wallL, 0.5), hash(x, y, 31) * 0.3);
    if (j === 0) c = mix(c, WHITE, 0.2); else if (j === 2) c = mul(c, 0.86);
    if (joint && j !== 0) c = mul(c, 0.8);
    P.px(x, y, c);
  }
  for (const [x0, lit] of [[L, true], [R - 3, false]]) {
    P.rect(x0, yT, 3, G - 9 - yT, C.trim);
    P.vl(x0, yT, G - 9 - yT, lit ? WHITE : C.trim); P.vl(x0 + 2, yT, G - 9 - yT, C.trimD);
  }
  // takfotslist med pepparkaksbård (små bågar) och skugga under
  P.hl(L, yT, b.w, 0xfff8f0); P.hl(L, yT + 1, b.w, C.trim); P.hl(L, yT + 2, b.w, C.trimD);
  for (let x = L; x < R; x++) { const k = (x - L) % 4; if (k === 1 || k === 2) P.px(x, yT + 3, C.trim); if (k === 0) P.px(x, yT + 3, C.trimD); }
  for (let x = L; x < R; x++) { const k = (x - L) % 4; P.px(x, yT + 4, 0x000000, k === 1 || k === 2 ? 0.2 : 0.1); }
}
// fönster på övervåningen: rundade hörn, mintkarm, gardiner och en Klämkompis i fönstret
function upperWindow(P, x, y, w, h, i, night, snow) {
  P.rect(x - 2, y - 2, w + 4, h + 3, OUT);
  P.rect(x - 1, y - 1, w + 2, h + 2, C.mint);
  P.hl(x - 1, y - 1, w + 2, C.mintL); P.vl(x - 1, y, h, C.mintL); P.vl(x + w, y, h, C.mintD);
  P.px(x - 2, y - 2, C.wall); P.px(x + w + 1, y - 2, C.wall); P.px(x - 1, y - 1, OUT); P.px(x + w, y - 1, OUT);
  for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) {
    const t = j / (h - 1);
    let c = night ? mix(0x243050, 0x121a2c, t) : mix(0xcfe8f6, 0x5a7a98, q(t, x + k, y + j, 3));
    const d = (k + j + i * 5) % 11; if (d < 2 && !night) c = mix(c, WHITE, 0.35);
    P.px(x + k, y + j, c);
  }
  P.px(x, y, C.mint); P.px(x + w - 1, y, C.mint);
  // gardiner med prickar
  const cc = [0xfff0f4, 0xf0fff6][i % 2], cw = 3;
  for (let j = 0; j < h - 1; j++) for (let k = 0; k < cw; k++) {
    const tie = j > h * 0.55 ? Math.round((j - h * 0.55) * 0.35) : 0;
    if (k >= cw - tie) continue;
    let c = k % 2 ? mul(cc, 0.86) : cc; if ((j + k) % 4 === 0) c = [0xff90b0, 0x70c8a0][i % 2];
    P.px(x + k, y + j, night ? mul(c, 0.4) : c); P.px(x + w - 1 - k, y + j, night ? mul(c, 0.36) : mul(c, 0.92));
  }
  P.hl(x, y, w, night ? 0x4a3a4a : cc);
  // Klämkompisen på fönsterbänken (innanför glaset)
  const sp = plushSprite(i % 2 ? 'groda' : 'kanin');
  stamp(P, sp, x + ((w - sp.w) >> 1), y + h - sp.h + 1, night ? (c) => nightTone(c, 0, 0, null) : null);
  // glasglans över
  for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) if ((k + j + i * 3) % 9 === 0) P.px(x + k, y + j, WHITE, night ? 0.05 : 0.16);
  // spröjs högt upp (ett litet överljus) – så att den inte skär genom Klämkompisens ansikte eller märke
  P.hl(x, y + 3, w, C.mint, 0.9); P.hl(x, y + 2, w, WHITE, 0.12);
  // fönsterbänk med blomlåda
  P.hl(x - 2, y + h + 1, w + 4, C.trim); P.hl(x - 2, y + h + 2, w + 4, C.trimD); P.darken(x - 1, y + h + 3, w + 2, 1, 0.8);
  for (let k = 0; k < w + 2; k++) {
    const hh = 1 + Math.floor(hash(x + k, i, 41) * 2);
    for (let j = 1; j <= hh; j++) P.px(x - 1 + k, y + h + 1 - j, (k + j) % 3 ? 0x3f8a34 : 0x62aa44);
    if (hash(x + k, i, 42) > 0.5) P.px(x - 1 + k, y + h + 1 - hh, [0xff6a9a, 0xffffff, 0xf8d040][Math.floor(hash(x + k, i, 43) * 3)]);
  }
  if (snow) { P.hl(x - 2, y + h, w + 4, 0xf4f8ff); P.hl(x - 2, y - 2, w + 4, 0xeef4fa); }
}
// namnbrädan: butikens namn LEKSAKSLÅDAN (samma namn och samma bokstavsfärger som skylten på kassadisken
// inne i butiken, js/scenes/shop-leksaker.js) på en vit bräda med rosa kant mellan övervåningens fönster.
// Klämkompisarna på neonskylten sitter precis under den. null om det inte finns plats (lågt eller smalt hus).
const NAME = $t('LEKSAKSLÅDAN'), NAME_COLS = [0xe8505a, 0xf49a4a, 0x4aa86a, 0x4a88d0, 0x8a5ad0];
function namePlateRect(g) {
  const w = textW(SMALL, NAME) + 6, h = 9, x0 = g.mx - (w >> 1), y0 = g.sign.y0 - 17;
  // under ljusslingan (lamporna når ner till yT + 9) och fritt från fönstrens karmar (L + 24 … R − 25)
  if (y0 < g.yT + 10 || x0 < g.L + 27 || x0 + w > g.R - 26) return null;
  return { x0, y0, w, h };
}
function paintNamePlate(P, g, snow) {
  const r = namePlateRect(g);
  if (!r) return null;
  const { x0, y0, w, h } = r, dk = 0xb45a7e;
  P.darken(x0 + 1, y0 + h, w, 1, 0.72); P.darken(x0 + w, y0 + 1, 1, h, 0.8);          // skugga på panelen
  P.rect(x0, y0, w, h, dk);
  vgrad(P, x0 + 1, y0 + 1, w - 2, h - 2, 0xfffcf8, 0xf6e8ec, 3);
  P.hl(x0 + 1, y0 + 1, w - 2, WHITE); P.hl(x0 + 1, y0 + h - 2, w - 2, 0xecd6de);
  P.px(x0, y0, mix(dk, C.wall, 0.5)); P.px(x0 + w - 1, y0, mix(dk, C.wall, 0.5));     // rundade hörn
  P.px(x0, y0 + h - 1, mix(dk, C.wall, 0.5)); P.px(x0 + w - 1, y0 + h - 1, mix(dk, C.wall, 0.5));
  // bokstäverna i kassadiskens fem färger, en färg per bokstav (Å:s ring hamnar i luftraden ovanför)
  let x = x0 + 3;
  [...NAME].forEach((ch, i) => { text(P, SMALL, ch, x, y0 + 2, NAME_COLS[i % NAME_COLS.length]); x += textW(SMALL, ch) + 1; });
  // två mässingsskruvar
  for (const sx of [x0 + 1, x0 + w - 2]) { P.px(sx, y0 + 4, 0xe8c060); P.px(sx, y0 + 5, 0xa8802a); }
  if (snow) for (let i = 0; i < w; i++) { P.px(x0 + i, y0 - 1, 0xf4f8ff); if (hash(i, 3, 97) > 0.6) P.px(x0 + i, y0 - 2, 0xeef4fa); }
  return r;
}
// gavel med klockform, rund ventil (en kanin kikar ut) och plats för vindsnurran
function paintGable(P, g, night, snow) {
  const { mx, yT } = g, hw = 22, gh = 21;
  const topAt = (x) => { const d = (x + 0.5 - mx) / hw; if (Math.abs(d) >= 1) return null; return yT - Math.round(gh * Math.pow((Math.cos(Math.PI * d) + 1) / 2, 0.85)); };
  // skugga på taket till höger om gaveln
  for (let x = mx; x < mx + hw + 3; x++) { const t = topAt(Math.min(x, mx + hw - 1)); if (t !== null) P.darken(x + 2, t + 2, 1, yT - t - 2, 0.78); }
  for (let x = mx - hw; x < mx + hw; x++) {
    const t = topAt(x); if (t === null) continue;
    for (let y = t; y < yT + 1; y++) {
      const j = (y - yT + 99) % 3;
      let c = mix(C.wallL, C.wall, 0.45 + hash(x, y, 33) * 0.2);
      if (j === 0) c = mix(c, WHITE, 0.18); else if (j === 2) c = mul(c, 0.88);
      P.px(x, y, c);
    }
    P.px(x, t, OUT); P.px(x, t + 1, C.trim); P.px(x, t + 2, x < mx ? WHITE : C.trimD);
    if (snow) { P.px(x, t - 1, 0xf4f8ff); if (hash(x, 1, 94) > 0.5) P.px(x, t - 2, 0xeef4fa); }
  }
  // rund ventil med mintram
  const cx = mx, cy = yT - 8, ro = 6.4, ri = 4.4;
  for (let y = Math.floor(cy - ro - 1); y <= cy + ro + 1; y++) for (let x = Math.floor(cx - ro - 1); x <= cx + ro + 1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > ro + 0.9) continue;
    if (d > ro) P.px(x, y, OUT);
    else if (d > ri) P.px(x, y, tone(C.mint, (x + 0.5 - cx) / ro, (y + 0.5 - cy) / ro, x, y));
    else {
      const t = (y + 0.5 - (cy - ri)) / (2 * ri);
      P.px(x, y, night ? mix(0x28304c, 0x141a2e, t) : mix(0xd8ecf8, 0x6a8aa8, q(t, x, y, 3)));
    }
  }
  // kaninen kikar upp i ventilen
  const bun = plushSprite('kanin');
  P.clip(Math.floor(cx - ri), Math.floor(cy - ri), Math.ceil(cx + ri), Math.ceil(cy + ri) + 1);
  stamp(P, bun, Math.round(cx) - 4, Math.round(cy) - 2, night ? (c) => nightTone(c, 0, 0, null) : null);
  P.clip();
  for (let y = Math.floor(cy - ri); y < cy + ri; y++) for (let x = Math.floor(cx - ri); x < cx + ri; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= ri && (x + y) % 7 === 0) P.px(x, y, WHITE, night ? 0.05 : 0.25);
  // pinnen till vindsnurran
  const pinTop = yT - gh - 6;
  P.vl(mx, pinTop, 6, 0x6a5a5a); P.vl(mx + 1, pinTop + 1, 5, 0x3a2a30);
  return { cx, cy, pin: [mx + 1, pinTop] };
}
// skylten: plommonfärgad tavla, guldram med glödlampor och LEKSAKER i neonrör (släckt = färgat glas)
function neonLetters(g) {
  const s = g.sign, inner = s.x1 - s.x0 - 10;
  const sc = textW(BIG, WORD, 2) <= inner ? 2 : 1;
  const tw = textW(BIG, WORD, sc), tx = s.x0 + (((s.x1 - s.x0) - tw) >> 1), ty = s.y0 + (((s.y1 - s.y0) - BIG.h * sc) >> 1);
  const out = []; let x = tx;
  for (let i = 0; i < WORD.length; i++) {
    const ch = WORD[i], x0 = x;
    eachTextPixel(BIG, ch, x0, ty, sc, (px, py) => out.push([px, py, i, (px - x0) % sc === 0 && (py - ty) % sc === 0]));
    x += textW(BIG, ch, sc) + sc;
  }
  return { px: out, sc, tx, ty, tw };
}
function paintSign(P, g, night, snow) {
  const s = g.sign, w = s.x1 - s.x0, h = s.y1 - s.y0;
  // listen ovanför skylten
  P.hl(g.L, s.y0 - 3, g.R - g.L, C.trim); P.hl(g.L, s.y0 - 2, g.R - g.L, C.trimD); P.hl(g.L, s.y0 - 1, g.R - g.L, 0x000000, 0.25);
  P.rect(s.x0, s.y0, w, h, OUT);
  P.rect(s.x0 + 1, s.y0 + 1, w - 2, h - 2, C.gold);
  P.hl(s.x0 + 1, s.y0 + 1, w - 2, 0xfff0b0); P.vl(s.x0 + 1, s.y0 + 1, h - 2, 0xffe08a);
  P.hl(s.x0 + 1, s.y1 - 2, w - 2, C.goldD); P.vl(s.x1 - 2, s.y0 + 1, h - 2, C.goldD);
  for (let y = s.y0 + 3; y < s.y1 - 3; y++) for (let x = s.x0 + 3; x < s.x1 - 3; x++) {
    let c = mix(C.plum, 0x40306e, q((y - s.y0) / h, x, y, 3) * 0.7);
    if (hash(x, y, 77) > 0.985) c = mix(c, 0xfff4c0, 0.5);            // små stjärnor i lacken
    P.px(x, y, c);
  }
  P.box(s.x0 + 2, s.y0 + 2, w - 4, h - 4, mul(C.goldD, 0.7));
  // glödlamporna i ramen (släckta)
  const bulbs = [];
  for (let x = s.x0 + 3; x < s.x1 - 2; x += 4) { bulbs.push([x, s.y0 + 1]); bulbs.push([x, s.y1 - 2]); }
  for (let y = s.y0 + 5; y < s.y1 - 4; y += 4) { bulbs.push([s.x0 + 1, y]); bulbs.push([s.x1 - 2, y]); }
  for (const [x, y] of bulbs) P.px(x, y, night ? 0x8a8070 : 0xf4ead0);
  // neonrören: glasrör i dämpade färger med ljus kant, fästskugga på tavlan
  const N = neonLetters(g);
  for (const [px, py] of N.px) P.px(px + 1, py + 1, 0x120c24);
  for (const [px, py, i, core] of N.px) { const c = mix(NEON[i], 0xa8a4b8, night ? 0.72 : 0.55); P.px(px, py, core ? mix(c, WHITE, 0.45) : c); }
  if (snow) { for (let x = s.x0 - 1; x < s.x1 + 1; x++) { P.px(x, s.y0 - 1, 0xf4f8ff); if (hash(x, 2, 95) > 0.55) P.px(x, s.y0 - 2, 0xeef4fa); } }
  return { bulbs, neon: N };
}
// regnbågsmarkis med bågad kappa
function paintAwning(P, g, snow) {
  const x = g.L - 3, w = g.R - g.L + 6, y = g.G - 64, h = 7, sw = 4;
  const stripe = (i) => RAINBOW[Math.floor((i + 600) / sw) % RAINBOW.length];
  for (let j = 0; j < h; j++) {
    const e = Math.round((j / h) * 2);
    for (let i = -e; i < w + e; i++) {
      const s = stripe(i), X = x + i, Y = y + j;
      let k = mix(mix(s, 0xfff8e8, 0.22), mul(s, 0.8), q(j / h, X, Y, 3));
      if (j === 0) k = mul(s, 0.55);
      if ((i + 600) % sw === 0 && j > 0) k = mix(k, WHITE, 0.12);
      P.px(X, Y, k);
    }
  }
  // kappan: vit kantlist + bågar i randens färg
  for (let i = -2; i < w + 2; i++) P.px(x + i, y + h, 0xfff6ea);
  for (let i = -2; i < w + 2; i++) {
    const k = (i + 600) % sw, s = stripe(i);
    P.px(x + i, y + h + 1, mul(s, 0.9));
    if (k === 1 || k === 2) P.px(x + i, y + h + 2, mul(s, 0.78));
  }
  P.hl(x - 2, y + h, w + 4, 0x000000, 0.08);
  // markisarmar
  for (const ax of [x + 3, x + w - 4]) P.line(ax, y + h + 7, ax + (ax < x + w / 2 ? -1 : 1), y + h - 1, 0x3a3444);
  if (snow) for (let i = -1; i < w + 1; i++) { P.px(x + i, y, WHITE); P.px(x + i, y + 1, hash(i, 1, 96) > 0.3 ? 0xf4f8ff : mix(stripe(i), WHITE, 0.5)); if (hash(i, 2, 96) > 0.7) P.px(x + i, y + 2, 0xeef4fa); }
  return { y0: y, y1: y + h + 3 };
}
// bunting (vimplar) längs ett hängande snöre
function bunting(P, x0, x1, y) {
  const w = x1 - x0, sag = 3;
  const at = (x) => y + Math.round(sag * Math.sin(Math.PI * clamp((x - x0) / w, 0, 1)));
  for (let x = x0; x < x1; x++) P.px(x, at(x), 0x8a7a80);
  let k = 0;
  for (let x = x0 + 2; x < x1 - 3; x += 5, k++) {
    const c = RAINBOW[k % RAINBOW.length], yy = at(x + 1) + 1;
    P.hl(x, yy, 3, c); P.px(x + 1, yy + 1, mul(c, 0.85)); P.px(x, yy, mix(c, WHITE, 0.3));
  }
}
// skyltfönstret: bakvägg, vimplar, regnbåge, filtgolv med banan; mellanlager och glas som egna bilder
function paintDisplay(P, g, night, snow) {
  const { x0, x1, y0, y1 } = g.win, ww = x1 - x0, G = g.G;
  // jämn raksträcka → kurvornas yttersta punkter hamnar på hela pixlar (ingen ±1-studs vid vändningen)
  const cy = G - 17, floorY = cy - 8, r = 6, Ls = Math.max(12, (ww - 22) & ~1), cx = x0 + (ww >> 1);
  const lamp = [x1 - 7, y0 + 8];
  // karmen: mint med rundade övre hörn
  P.rect(x0 - 3, y0 - 3, ww + 6, y1 - y0 + 4, OUT);
  P.rect(x0 - 2, y0 - 2, ww + 4, y1 - y0 + 3, C.mint);
  P.hl(x0 - 2, y0 - 2, ww + 4, C.mintL); P.vl(x0 - 2, y0 - 1, y1 - y0 + 1, C.mintL);
  P.vl(x1 + 1, y0 - 1, y1 - y0 + 1, C.mintD); P.hl(x0 - 1, y1, ww + 2, C.mintD);
  P.px(x0 - 3, y0 - 3, C.wall); P.px(x1 + 2, y0 - 3, C.wall); P.px(x0 - 2, y0 - 2, OUT); P.px(x1 + 1, y0 - 2, OUT);
  // bakväggen: ljusrosa tapet med vita prickar och små stjärnor
  for (let y = y0; y < floorY; y++) for (let x = x0; x < x1; x++) {
    let c = mix(0xffe6ee, 0xf6c8d8, q((y - y0) / (floorY - y0), x, y, 3) * 0.6);
    const px = (x - x0 + ((Math.floor((y - y0) / 5) & 1) * 3)) % 6, py = (y - y0) % 5;
    if (px === 0 && py === 2) c = WHITE;
    P.px(x, y, c);
  }
  P.hl(x0, floorY - 1, ww, 0xe8a8bc); // golvlist
  bunting(P, x0, x1, y0 + 1);
  // hylla på vänstra väggen: ångkorgen med squishy-dumplings i ögonhöjd, prislapp och ett moln
  const stm = steamerSprite(), shW = stm.w + 6, shX = x0 + 2, shY = floorY - 11;
  let tagAt = null;
  if (ww >= 44) {
    blob(P, shX + shW + 5, shY - 12, 3.2, 1.9, 0xffffff, true); blob(P, shX + shW + 3.4, shY - 13.4, 2, 1.7, 0xffffff, true); // litet moln
    stamp(P, stm, shX + 3, shY - stm.h);
    P.hl(shX, shY, shW, WHITE); P.hl(shX, shY + 1, shW, C.mint); P.hl(shX, shY + 2, shW, C.mintD);
    P.hl(shX + 1, shY + 3, shW - 2, 0x000000, 0.12);
    for (const bx of [shX + 3, shX + shW - 4]) { P.px(bx, shY + 3, C.mintD); P.px(bx, shY + 4, C.mintD); P.px(bx - 1, shY + 3, mul(C.mintD, 0.8)); }
    tagAt = [shX + shW - 2, shY - 1];
  }
  // stjärnlampan hänger i ett snöre (lyser varmt på natten)
  P.vl(lamp[0], y0, lamp[1] - y0 - 2, 0x8a7a80);
  STAR.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(lamp[0] - 2 + i, lamp[1] - 2 + j, night ? (j < 2 ? 0xfff8d0 : 0xffe070) : j < 2 ? 0xfff4b0 : 0xf8d860); });
  // golvet: grön filt med dither och små blommor, grus under banan
  for (let y = floorY; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = mix(0x5aa84e, 0x86cc6c, q((y - floorY) / (y1 - floorY), x, y, 3));
    if (hash(x, y, 57) > 0.9) c = mix(c, 0xc0e890, 0.4); else if (hash(x, y, 58) > 0.93) c = mul(c, 0.82);
    P.px(x, y, c);
  }
  P.hl(x0, floorY, ww, 0x4a8a40);
  for (let k = 0; k < 7; k++) { const fx = x0 + 2 + Math.floor(hash(k, 1, 59) * (ww - 4)), fy = floorY + 1 + Math.floor(hash(k, 2, 59) * (y1 - floorY - 2)); P.px(fx, fy, [0xffffff, 0xff8ab0, 0xf8e060][k % 3]); }
  const T = { Ls, r, len: 2 * Ls + 2 * Math.PI * r };
  const scr = (X, Y) => [cx + X, cy - 0.5 * Y];
  // grus
  for (let s = 0; s < T.len; s += 0.25) {
    const p = trackAt(T, s), nx = Math.sin(p.th), ny = -Math.cos(p.th);
    for (let o = -2.8; o <= 2.8; o += 0.5) { const [sx, sy] = scr(p.X + nx * o, p.Y + ny * o); const X = Math.round(sx), Y = Math.round(sy); P.px(X, Y, hash(X, Y, 61) > 0.55 ? 0x9a927e : 0x7e7666); }
  }
  // syllar
  for (let s = 0; s < T.len; s += 2.5) {
    const p = trackAt(T, s), nx = Math.sin(p.th), ny = -Math.cos(p.th);
    const [ax, ay] = scr(p.X - nx * 3, p.Y - ny * 3), [bx, by] = scr(p.X + nx * 3, p.Y + ny * 3);
    P.line(ax, ay, bx, by, 0x7a4a2a);
  }
  // rälsen
  for (let s = 0; s < T.len; s += 0.2) {
    const p = trackAt(T, s), nx = Math.sin(p.th), ny = -Math.cos(p.th);
    for (const o of [-1.7, 1.7]) { const [sx, sy] = scr(p.X + nx * o, p.Y + ny * o); P.px(Math.round(sx), Math.round(sy), o > 0 ? 0xdfe4ec : 0xb8bec8); }
  }
  // små modellträd i de bakre hörnen
  for (const tx of [x0 + 2, x1 - 4]) {
    for (let j = 0; j < 6; j++) for (let i = -((j + 1) >> 1); i <= (j + 1) >> 1; i++) P.px(tx + 1 + i, floorY - 5 + j, (i + j) % 3 ? 0x2e7a3a : 0x4aa04a);
    P.px(tx + 1, floorY + 1, 0x6a4a2a);
  }
  // prislapp som hänger i hyllkanten: "39" på en gul lapp
  if (tagAt) {
    const tx = shX + 2, ty = shY + 4;
    P.px(tx + 4, ty - 1, 0x6a5a50);
    P.rect(tx, ty, 9, 7, 0xf8d838); P.box(tx, ty, 9, 7, 0xb8961a); P.hl(tx + 1, ty + 1, 7, 0xfff4a0);
    text(P, SMALL, '39', tx + 1, ty + 1, 0xc81e3a);
  }
  // ---- mellanlagret: klossarna och nallen (innanför ovalen – tåget kör runt dem) ----
  const Mw = ww, Mh = y1 - y0, M = new Pix(Mw, Mh, x0, y0);
  const ted = teddySprite(!!snow), blk = blocksSprite();
  const inner0 = cx - (Ls >> 1) - 1, inner1 = cx + (Ls >> 1) + 1, span = inner1 - inner0;
  const feet = cy + 1;
  let paw = null;
  if (span >= ted.w + blk.w + 2) {
    const gap = Math.floor((span - ted.w - blk.w) / 3);
    const bx = inner0 + gap, tx = inner1 - gap - ted.w;
    stamp(M, blk, bx, feet - blk.h);
    stamp(M, ted, tx, feet - ted.h); paw = [tx + 2, feet - ted.h + 8];
  } else {
    const tx = cx - (ted.w >> 1);
    stamp(M, ted, tx, feet - ted.h); paw = [tx + 2, feet - ted.h + 8];
  }
  if (night) nightify(M, x0, y0, x1, y1, lamp);
  // ---- glaset: reflexer, markisens skugga, dekaler (frost i hörnen på vintern) ----
  const Gl = new Pix(Mw, Mh, x0, y0);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const d = (x - x0 + y - y0 + 5) % 31;
    if (d < 2) Gl.px(x, y, WHITE, night ? 0.06 : 0.24); else if (d === 3) Gl.px(x, y, WHITE, night ? 0.03 : 0.1);
  }
  for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x1; x++) Gl.px(x, y, 0x1a1020, 0.3 - (y - y0) * 0.08);
  Gl.px(x0, y0, C.mint); Gl.px(x1 - 1, y0, C.mint);
  // klistermärken: två vita stjärnor
  for (const [sx, sy] of [[x0 + 3, y1 - 8], [x1 - 9, y1 - 7]]) STAR.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') Gl.px(sx + i, sy + j, WHITE, night ? 0.25 : 0.75); });
  if (snow) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const dl = Math.hypot(x - x0, (y - y1) * 1.2), dr = Math.hypot(x - x1, (y - y1) * 1.2), d = Math.min(dl, dr);
    if (d < 9 && bayer(x, y) < (9 - d) / 9) Gl.px(x, y, 0xf0f8ff, 0.55);
  }
  if (night) nightify(P, x0, y0, x1, y1, lamp);
  const wx = (x) => x + g.ox, wy = (y) => y + g.oy;
  return {
    mid: canvasOf(M), glass: canvasOf(Gl), at: [wx(x0), wy(y0)], rect: [wx(x0), wy(y0), ww, y1 - y0],
    track: { cx: wx(cx), cy: wy(cy), ...T }, paw: paw ? [wx(paw[0]), wy(paw[1])] : null, lamp: [wx(lamp[0]), wy(lamp[1])],
  };
}
// smalt squishy-torn (om dörren sitter i mitten): hyllor med dumplings och Klämkompisar
function paintTower(P, g, night) {
  const { x0, x1, y0, y1 } = g.win2, w = x1 - x0;
  P.rect(x0 - 3, y0 - 3, w + 6, y1 - y0 + 4, OUT); P.rect(x0 - 2, y0 - 2, w + 4, y1 - y0 + 3, C.mint);
  P.hl(x0 - 2, y0 - 2, w + 4, C.mintL); P.vl(x1 + 1, y0 - 1, y1 - y0 + 1, C.mintD);
  vgrad(P, x0, y0, w, y1 - y0, 0xfff0f4, 0xf4c8d8, 3);
  const kinds = ['katt', 'pingvin', 'anka', 'rav', 'uggla', 'bjorn', 'groda', 'kanin'];
  let k = 0, n = 0;
  for (let sy = y0 + 11; sy < y1; sy += 11) {
    P.hl(x0, sy, w, 0xffffff); P.hl(x0, sy + 1, w, 0xc8a8b8);
    for (let x = x0 + 1; x + 8 < x1; x += 8) {
      if ((k & 1) === 0) { const sp = plushSprite(kinds[n++ % kinds.length]); stamp(P, sp, x, sy - sp.h + 1); }
      else stamp(P, dumplingSprite([0xfff4e8, 0xffd0dc, 0xc8f0da, 0xe0d0ff][k % 4]), x, sy - 8);
      k++;
    }
  }
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ((x + y) % 13 < 2) P.px(x, y, WHITE, night ? 0.05 : 0.2);
  if (night) nightify(P, x0, y0, x1, y1, null);
}
// dörrkarm i mint med regnbågsöverljus, klocka och trappsteg
function paintDoorway(P, g, night, snow) {
  const { dx0, dx1, G } = g, dT = G - DOOR_H, dw = dx1 - dx0;
  P.rect(dx0 - 3, dT - 15, dw + 6, DOOR_H + 15, OUT);
  P.rect(dx0 - 2, dT - 14, dw + 4, DOOR_H + 14, C.mint);
  P.vl(dx0 - 2, dT - 14, DOOR_H + 14, C.mintL); P.vl(dx1 + 1, dT - 14, DOOR_H + 14, C.mintD); P.hl(dx0 - 2, dT - 14, dw + 4, C.mintL);
  // överljuset: regnbåge i glas
  const ox = dx0, oy = dT - 12, ow = dw, oh = 10, rcx = ox + ow / 2, rcy = oy + oh;
  for (let y = oy; y < oy + oh; y++) for (let x = ox; x < ox + ow; x++) {
    const d = Math.hypot(x + 0.5 - rcx, (y + 0.5 - rcy) * 1.2);
    let c = night ? 0x243050 : mix(0xd8f0ff, 0x8ab8d8, (y - oy) / oh);
    if (d >= 3.5 && d < 11) c = RAINBOW[clamp(Math.floor((11 - d) / 1.25), 0, 5)];
    if (night && d >= 3.5 && d < 11) c = mul(c, 0.42);
    P.px(x, y, c);
  }
  P.hl(ox, oy + oh, ow, C.mint); P.hl(ox, oy + oh + 1, ow, C.mintD);
  // öppningen (dörrbladet ritas i live)
  P.rect(dx0, dT, dw, DOOR_H, 0x2a2026);
  // trappsteg
  P.rect(dx0 - 3, G, dw + 6, 2, 0xe8dccc); P.hl(dx0 - 3, G, dw + 6, 0xfff6ea); P.hl(dx0 - 3, G + 2, dw + 6, 0x7a6e66);
  if (snow) P.hl(dx0 - 3, G, dw + 6, 0xf4f8ff);
  // krok för ballongerna på pelaren till höger
  const hx = Math.min(g.R - 4, dx1 + 4), hy = G - 22;
  P.px(hx, hy, 0xc8a040); P.px(hx + 1, hy, 0xf0d070); P.px(hx, hy + 1, 0x8a6a2a);
  return { hook: [hx + g.ox, hy + g.oy], bell: [((dx0 + dx1) >> 1) + g.ox, dT - 1 + g.oy] };
}
// sockeln: lavendelbräda med handmålad text
function paintPlinth(P, g, b, worn) {
  const { L, R, G, win } = g;
  for (let y = G - 9; y < G; y++) for (let x = L; x < R; x++) {
    if (x >= g.dx0 - 3 && x < g.dx1 + 3) continue;
    let c = mix(C.lav, mul(C.lav, 0.86), hash(x, y, 81) * 0.5);
    if (y === G - 9) c = mix(C.lav, WHITE, 0.4); else if (y === G - 1) c = C.lavD;
    P.px(x, y, c);
  }
  // fönsterbänken
  P.hl(win.x0 - 4, G - 11, win.x1 - win.x0 + 8, WHITE); P.hl(win.x0 - 4, G - 10, win.x1 - win.x0 + 8, C.trimD);
  P.darken(win.x0 - 3, G - 9, win.x1 - win.x0 + 6, 1, 0.75);
  // texten står till höger om gatuprataren (som står framför sockelns vänstra del)
  const ty = G - 7, star = (sx) => { for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [0, 3], [2, 3]]) P.px(sx + dx, ty + dy + 1, 0xf8d860); };
  const paintText = (s, x) => { text(P, SMALL, s, x + 1, ty + 1, C.lavD); text(P, SMALL, s, x, ty, 0xfff4e6); };
  const left = Math.max(win.x0, boardAt(b)[0] - g.ox + 26), right = win.x1 - 2;
  const wS = textW(SMALL, $t('SQUISHY')), wP = textW(SMALL, $t('PLYSCH'));
  if (wS + wP + 9 <= right - left) {
    const tx = left + ((right - left - (wS + wP + 9)) >> 1);
    paintText($t('SQUISHY'), tx); star(tx + wS + 3); paintText($t('PLYSCH'), tx + wS + 9);
  } else if (wS + 12 <= right - left) {
    const tx = left + ((right - left - (wS + 12)) >> 1);
    star(tx); paintText($t('SQUISHY'), tx + 6); star(tx + wS + 9);
  }
  // slitage om huset hamnar i ett slitet område
  if (worn > 0.3) for (let k = 0; k < 40 * worn; k++) { const x = L + Math.floor(hash(k, 1, 83) * b.w), y = G - 1 - Math.floor(hash(k, 2, 83) * 12); P.px(x, y, 0x3a3030, 0.35); }
  // kontaktskugga längs foten
  for (const [x, w] of [[L, g.dx0 - 3 - L], [g.dx1 + 3, R - g.dx1 - 3]]) {
    if (w <= 0) continue;
    P.hl(x, G, w, 0x1a1422, 0.34); P.hl(x, G + 1, w, 0x1a1422, 0.18); P.hl(x + 1, G + 2, w - 2, 0x1a1422, 0.08);
  }
}

function paintLeksaker(b, night, opts = {}) {
  const g = geo(b), P = new Pix(g.W, g.H), snow = opts.snow ? 1 : 0;
  const wx = (x) => x + g.ox, wy = (y) => y + g.oy;
  paintRoof(P, g, b, snow);
  const kite = paintKite(P, g, snow);
  const chimney = paintChimney(P, g, snow);
  paintWall(P, g, b);
  // stuprör i mint vid vänstra hörnet
  const dpx = g.L + 3;
  P.vl(dpx, g.yT - 1, g.G - g.yT + 1, C.mintL); P.vl(dpx + 1, g.yT - 1, g.G - g.yT + 1, C.mintD);
  for (let y = g.yT + 8; y < g.G - 4; y += 16) P.hl(dpx - 1, y, 4, 0x3a3e48);
  P.rect(dpx - 1, g.G - 2, 4, 2, C.mint); P.hl(dpx - 1, g.G - 2, 4, C.mintL);
  // övervåningen: två fönster med Klämkompisar
  const uy0 = g.yT + 8, uy1 = g.sign.y0 - 7, uh = uy1 - uy0;
  if (uh >= 10) {
    const ww = 11;
    [g.L + 12, g.R - 12 - ww].forEach((x, i) => upperWindow(P, x, uy0, ww, Math.min(16, uh), i, night, snow));
  }
  // ljusslinga under takfoten: tråd i bågar mellan krokarna, lampor i regnbågens färger (tänds i glow)
  const fairy = [], fy0 = g.yT + 6;
  for (let x = g.L + 4; x < g.R - 4; x++) {
    const k = (x - g.L - 4) % 18, y = fy0 + Math.round(Math.sin((k / 18) * Math.PI) * 2);
    P.px(x, y, 0x4a3a44);
    if (k === 0) P.px(x, y - 1, 0x2a2a30);
    if ((x - g.L) % 4 === 2) { const c = RAINBOW[fairy.length % 6]; P.px(x, y + 1, night ? mul(c, 0.55) : mix(c, WHITE, 0.45)); fairy.push([wx(x), wy(y + 1), c]); }
  }
  const gab = paintGable(P, g, night, snow);
  const plate = paintNamePlate(P, g, snow);
  const sign = paintSign(P, g, night, snow);
  // Klämkompisar som sitter på skyltens överkant
  ['katt', 'pingvin', 'anka'].forEach((k, i) => {
    const sp = plushSprite(k), x = g.mx - 17 + i * 12;
    stamp(P, sp, x, g.sign.y0 - sp.h + 2);
    P.hl(x + 1, g.sign.y0 + 1, sp.w - 2, 0x000000, 0.2);
  });
  const disp = paintDisplay(P, g, night, snow);
  if (g.win2) paintTower(P, g, night);
  const aw = paintAwning(P, g, snow);
  const door = paintDoorway(P, g, night, snow);
  paintPlinth(P, g, b, opts.worn || 0);
  paintHangSign(P, g);
  // allt som live/glow/items behöver, i världskoordinater
  META[metaKey(b, night, snow)] = {
    g, disp, door, chimney: [wx(chimney[0]), wy(chimney[1])], pin: [wx(gab.pin[0]), wy(gab.pin[1])], kite: [wx(kite[0]), wy(kite[1])],
    bulbs: sign.bulbs.map(([x, y]) => [wx(x), wy(y)]), fairy,
    neon: sign.neon.px.map(([x, y, i, core]) => [wx(x), wy(y), i, core]),
    signRect: [wx(g.sign.x0), wy(g.sign.y0), g.sign.x1 - g.sign.x0, g.sign.y1 - g.sign.y0],
    doorRect: [b.door.x0, baseOf(b) - DOOR_H, b.door.x1 - b.door.x0, DOOR_H],
    transom: [wx(g.dx0), wy(g.G - DOOR_H - 12), g.dx1 - g.dx0, 10],
    awning: [wx(g.L - 3), wy(aw.y0), g.R - g.L + 6, aw.y1 - aw.y0],
    tower: g.win2 ? [wx(g.win2.x0), wy(g.win2.y0), g.win2.x1 - g.win2.x0, g.win2.y1 - g.win2.y0] : null,
    plate: plate ? [wx(plate.x0), wy(plate.y0), plate.w, plate.h] : null,
  };
  return P.flush();
}

// ================= dörren (svängdörr med förberäknade öppningslägen) =================
const KITS = {};
const SWING_STEPS = 5;
function makeSwingKit(w, h, paintInside, paintLeaf) {
  const I = new Pix(w, h); paintInside(I, w, h);
  const Lf = new Pix(w, h); paintLeaf(Lf, w, h);
  const leaves = [];
  for (let k = 0; k < SWING_STEPS; k++) {
    if (k === 0) { leaves.push(Lf.flush()); continue; }
    const S = new Pix(w, h), a = (k / (SWING_STEPS - 1)) * 1.35, pw = Math.max(3, Math.round(w * Math.cos(a))), f = 1 - k * 0.1;
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.floor((x * w) / pw)), cut = Math.round((x / pw) * k * 0.9);
      for (let y = cut; y < h - Math.round(cut * 0.3); y++) {
        const i = (y * w + sx) * 4, al = Lf.d[i + 3] / 255;
        if (al > 0) S.px(x, y, mul((Lf.d[i] << 16) | (Lf.d[i + 1] << 8) | Lf.d[i + 2], f), al);
      }
    }
    S.vl(pw, Math.round(k * 0.9), h - Math.round(k * 0.9) - Math.round(k * 0.27), 0xe8d8a8);
    for (let x = pw + 1; x < Math.min(w, pw + 1 + k * 2); x++) S.px(x, h - 2, 0x000000, 0.25);
    leaves.push(S.flush());
  }
  return { w, h, inside: I.flush(), leaves };
}
function doorKit(b, night) {
  const w = b.door.x1 - b.door.x0;
  return makeSwingKit(w, DOOR_H, (I) => {
    // butiken innanför: hyllor fulla av leksaker, ett mobilhänge, rutigt golv
    vgrad(I, 0, 0, w, DOOR_H - 9, 0xfff2e4, 0xf4d4c8, 4);
    for (let y = DOOR_H - 9; y < DOOR_H; y++) for (let x = 0; x < w; x++) I.px(x, y, ((x >> 2) + (y >> 1)) & 1 ? 0xf4c8d8 : 0xfff4f8);
    for (let s = 0; s < 3; s++) {
      const sy = 10 + s * 7;
      I.hl(1, sy, w - 2, 0xc89a6a); I.hl(1, sy + 1, w - 2, 0x8a6040);
      for (let x = 2; x < w - 3; x += 4) {
        const c = RAINBOW[(x + s * 2) % 6];
        if ((x + s) % 3 === 0) { I.rect(x, sy - 3, 3, 3, mix(c, WHITE, 0.3)); I.px(x + 1, sy - 2, 0x2a1a22); }
        else { I.rect(x, sy - 4, 3, 4, c); I.hl(x, sy - 4, 3, mix(c, WHITE, 0.4)); }
      }
    }
    I.vl(w >> 1, 0, 3, 0x8a7a80);
    for (const [x, y, c] of [[(w >> 1) - 4, 4, 0xf8d860], [(w >> 1) + 3, 5, 0x6ad0f0], [w >> 1, 6, 0xff8ab0]]) { I.px(x, y, c); I.px(x + 1, y, c); I.px(x, y + 1, mul(c, 0.8)); }
    I.hl((w >> 1) - 4, 3, 9, 0x8a7a80);
    if (night) for (let y = 0; y < DOOR_H; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const c = nightTone((I.d[i] << 16) | (I.d[i + 1] << 8) | I.d[i + 2], 0, 0, null); I.d[i] = c >> 16; I.d[i + 1] = (c >> 8) & 255; I.d[i + 2] = c & 255; }
  }, (P, w, h) => {
    const c = C.door;
    vgrad(P, 0, 0, w, h, mix(c, WHITE, 0.14), mul(c, 0.84), 3);
    P.box(0, 0, w, h, OUT); P.vl(1, 1, h - 2, mix(c, WHITE, 0.45)); P.vl(w - 2, 1, h - 2, mul(c, 0.7));
    // rund ventil
    const ox = w / 2, oy = 9.5;
    for (let y = 3; y < 17; y++) for (let x = 3; x < w - 3; x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      if (d > 6.2) continue;
      if (d > 4.6) P.px(x, y, tone(C.mint, (x + 0.5 - ox) / 6, (y + 0.5 - oy) / 6, x, y));
      else { const t = (y - 5) / 9; let g2 = night ? mix(0x3a3450, 0x1e1a2e, t) : mix(0xfff0e0, 0xe8c0b0, t); if ((x + y) % 6 === 0) g2 = mix(g2, WHITE, 0.4); P.px(x, y, g2); }
    }
    // speglar (fyllningar), handtag och sparkplåt
    P.bevel(4, 18, w - 8, 6, mix(c, WHITE, 0.35), mul(c, 0.66)); P.bevel(5, 19, w - 10, 4, mul(c, 0.8), mix(c, WHITE, 0.2));
    P.bevel(4, 25, w - 8, 5, mix(c, WHITE, 0.35), mul(c, 0.66));
    P.rect(w - 6, 17, 3, 2, 0xf0d070); P.px(w - 6, 17, 0xfff4b0); P.px(w - 4, 18, 0x8a6a2a);
    P.rect(1, h - 4, w - 2, 3, C.mint); P.hl(1, h - 4, w - 2, C.mintL); P.hl(1, h - 2, w - 2, C.mintD);
    // ett hjärta-klistermärke på nedre fyllningen
    ['.#.#.', '#####', '.###.', '..#..'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px((w >> 1) - 2 + i, 26 + j, j === 0 ? 0xff9ab8 : 0xff5a8a); });
  });
}
function drawDoor(ctx, b, st, kit) {
  const x0 = b.door.x0, top = baseOf(b) - kit.h, raw = st.doorOpen, open = clamp(Number.isFinite(raw) ? raw : 0, 0, 1);
  ctx.drawImage(kit.inside, x0, top);
  const k = clamp(Math.round(open * (SWING_STEPS - 1)), 0, SWING_STEPS - 1);
  ctx.drawImage(kit.leaves[k], x0, top);
  return k;
}
// vändskylten i dörrens ventil: sol (öppet) eller måne (stängt)
const SUN = ['.y.y.y.', '..yyy..', 'yyyyyyy', '.ykyky.', 'yyyoyyy', '..yyy..', '.y.y.y.'];
const MOON = ['..bbb..', '.bb....', 'bb.....', 'bb..z.z', 'bb...z.', '.bb..z.', '..bbbz.'];
let CARDS = null;
function cardSprites() {
  if (!CARDS) CARDS = {
    open: canvasOf(art(SUN, { y: 0xf8c838, k: 0x2a1a22, o: 0xd04040 })),
    closed: canvasOf(art(MOON, { b: 0x8aa0e8, z: 0xf4f4ff })),
  };
  return CARDS;
}

// ================= barnen vid skyltfönstret =================
const KID_LOOKS = [
  { kid: true, skin: '#f6d7bf', hair: '#d9a95c', style: 'ponytail', top: 'tee', shirt: '#f05a8a', accent: '#f4f1ea', bottom: 'skirt', pants: '#3a7bd5', shoes: '#f2f2f2', bag: 'backpack', bagColor: '#f0b429', blush: true },
  { kid: true, skin: '#a06a43', hair: '#1d1714', style: 'curly', top: 'hoodie', shirt: '#46a35a', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#c23b3b', hat: 'cap', cap: '#f0b429' },
  { kid: true, skin: '#eec3a0', hair: '#b7392b', style: 'bob', top: 'stripes', shirt: '#3a7bd5', accent: '#f4f1ea', bottom: 'shorts', pants: '#e0b24a', shoes: '#3a6bc2', blush: true },
  { kid: true, skin: '#c68a5c', hair: '#3b2619', style: 'short', top: 'jacket', shirt: '#e07a2e', accent: '#f4f1ea', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c' },
  { kid: true, skin: '#744a2d', hair: '#1d1714', style: 'afro', top: 'sweater', shirt: '#b83d7a', accent: '#f4f1ea', bottom: 'jeans', pants: '#2b2b30', shoes: '#f2f2f2', blush: true },
  { kid: true, skin: '#e0a97f', hair: '#ecd489', style: 'bun', top: 'tee', shirt: '#2aa39a', accent: '#f4f1ea', bottom: 'skirt', pants: '#8e5bd1', shoes: '#e0b24a' },
];
// vinterkläder (samma objekt varje gång – figurmotorn cachar per utseende)
const KID_WINTER = KID_LOOKS.map((l, i) => ({ ...l, top: 'jacket', hat: 'beanie', cap: ['#d83a4a', '#3a7bd5', '#f0b429', '#46a35a', '#8e5bd1', '#f05a8a'][i], bottom: l.bottom === 'shorts' || l.bottom === 'skirt' ? 'pants' : l.bottom }));
const LINES = {
  open: [$t('Titta, tåget!'), $t('En nalle!'), $t('Mamma, kolla!'), $t('Så gulligt!'), $t('Jag vill ha en squishy!'), $t('Tut tut!'), $t('Vilka ballonger!'), $t('Kan vi gå in?'), $t('Dumplingen har ett ansikte!'), $t('Leksakslådan är bäst!')],
  closed: [$t('Tåget sover.'), $t('Stängt... i morgon!'), $t('God natt, nalle!'), $t('Leksakslådan har stängt.')],
  snow: [$t('Nallen har tomtemössa!'), $t('Tomten handlar nog här!')],
};
// Klämkompisarnas namn hämtas ur butikens katalog (js/data/toys.js), så att barnen säger samma namn som
// står på hyllorna inne. Laddas i bakgrunden; saknas katalogen säger barnen bara de vanliga replikerna.
let KNAMN = null;
import('../data/toys.js').then((m) => { KNAMN = Object.fromEntries((m.KOMPISAR || []).map((K) => [K.art, K.namn])); }).catch(() => { KNAMN = null; });
function kompisLines() {
  if (!KNAMN) return [];
  return [KNAMN.kanin && $t`Titta, ${$t(KNAMN.kanin)}!`, KNAMN.groda && $t`${$t(KNAMN.groda)} har en blomma!`, KNAMN.pingvin && $t`Jag vill ha ${$t(KNAMN.pingvin)}!`].filter(Boolean);
}
const WALK_SEQ = [1, 3, 2, 3];
const KIDS = new Map();
let SPEECH = null, speechTried = false, KIDS_OFF = false;
function speechLib() {
  if (!speechTried) {
    speechTried = true;
    import('../scenes/walkable.js').then((m) => { SPEECH = m.createSpeech || null; }).catch(() => { SPEECH = null; });
  }
  return SPEECH;
}
speechLib(); // börja ladda pratbubblorna direkt (walkable.js är redan laddad av staden)
function kidsOf(b) {
  let S = KIDS.get(b.id);
  if (!S) KIDS.set(b.id, (S = { lt: null, next: 2.5, n: 0, group: null, talk: null }));
  return S;
}
function standRange(b, m) {
  const r = m.disp.rect, board = boardAt(b);
  const x0 = Math.max(r[0] + 8, board[0] + 28), x1 = r[0] + r[2] - 8;
  return x1 - x0 >= 6 ? [x0, x1] : [r[0] + 6, r[0] + r[2] - 6];
}
function spawnKids(b, st, m, S) {
  const n = S.n++, rr = (k) => hash(n, k, 4411);
  const [a0, a1] = standRange(b, m), sx = Math.round(a0 + rr(2) * (a1 - a0));
  const v = st.env?.view || { x: sx - 192, w: 384 };
  const leftX = v.x - 18, rightX = v.x + v.w + 18;
  const canL = leftX < sx - 24 && sx - leftX < 380, canR = rightX > sx + 24 && rightX - sx < 380;
  const side = canL && canR ? (rr(3) < 0.5 ? -1 : 1) : canL ? -1 : canR ? 1 : rr(3) < 0.5 ? -1 : 1;
  const from = side < 0 ? (canL ? leftX : sx - 220) : canR ? rightX : sx + 220;
  const winter = (st.env?.weather?.snowCover || 0) > 0.35;
  const looks = winter ? KID_WINTER : KID_LOOKS;
  const pair = rr(1) < 0.35 && a1 - a0 >= 10;
  const base = baseOf(b), kids = [];
  const k0 = Math.floor(rr(4) * looks.length);
  kids.push({ look: looks[k0], x: from, y: base + 8, tx: sx, dir: side < 0 ? 'right' : 'left', dist: 0, frame: 0 });
  // syskonet går en bit bakom och stannar bredvid
  if (pair) kids.push({ look: looks[(k0 + 1 + Math.floor(rr(5) * (looks.length - 1))) % looks.length], x: from + side * 13, y: base + 11, tx: sx + side * 11, dir: side < 0 ? 'right' : 'left', dist: 5, frame: 0 });
  const open = isOpen(b, st.hour ?? 12), pool = winter && rr(7) < 0.5 ? LINES.snow : open ? [...LINES.open, ...kompisLines()] : LINES.closed;
  S.group = { kids, side, phase: 'in', look: 0, stay: 5 + rr(6) * 5, said: false, speak: rr(8) < 0.8, line: pool[Math.floor(rr(9) * pool.length)], turnUntil: 0 };
}
function kidsUpdate(b, st, m) {
  const S = kidsOf(b), t = st.t || 0;
  if (S.lt !== null && t < S.lt - 1) { S.group = null; S.next = t + 2; } // tiden började om
  const dt = S.lt === null ? 0 : clamp(t - S.lt, 0, 0.25);
  S.lt = t;
  const hour = st.hour ?? 12, day = hour >= 8 && hour < 19.5 && (st.env?.dark || 0) < 0.3 && !st.night;
  if (!S.group) {
    if (S.next - t > 90) S.next = t + 3;
    if (day && t >= S.next && !KIDS_OFF) spawnKids(b, st, m, S);
    return S;
  }
  const G = S.group, sp = 26;
  if (G.phase === 'in' || G.phase === 'out') {
    let done = true;
    for (const k of G.kids) {
      const d = k.tx - k.x;
      if (Math.abs(d) > 0.5) {
        const stp = Math.sign(d) * Math.min(Math.abs(d), sp * dt);
        k.x += stp; k.dist += Math.abs(stp); k.dir = d > 0 ? 'right' : 'left';
        k.frame = WALK_SEQ[Math.floor(k.dist / 4) % 4];
        done = false;
      } else { k.x = k.tx; k.frame = 0; if (G.phase === 'in') k.dir = 'up'; }
    }
    if (done && G.phase === 'in') { G.phase = 'look'; G.look = 0; }
    if (done && G.phase === 'out') { S.group = null; S.next = t + 7 + hash(S.n, 11, 4411) * 14; }
  } else if (G.phase === 'look') {
    G.look += dt;
    const lead = G.kids[0];
    for (const [i, k] of G.kids.entries()) {
      k.dir = t < G.turnUntil && i === 0 ? 'down' : 'up';
      const hop = Math.sin(G.look * 7 + i * 2) > 0.8 && G.look % 3 < 1.2; // små glada skutt
      k.frame = hop ? 3 : 0;
    }
    if (!G.said && G.look > 0.9) {
      G.said = true;
      const mk = speechLib();
      if (G.speak && mk) {
        if (!S.talk) S.talk = mk();
        const kid = lead;
        try { S.talk.say(G.line, () => ({ x: kid.x, y: kid.y - 40 }), 2.8, { voice: kid.look }); } catch { /* pratet är inget krav */ }
        G.turnUntil = t + 1.4;
      }
    }
    if (G.look > G.stay || !day) {
      G.phase = 'out';
      const v = st.env?.view || { x: lead.x - 192, w: 384 };
      const dirR = G.side < 0; // kom från vänster → går vidare åt höger
      const ex = dirR ? Math.max(v.x + v.w + 18, lead.x + 40) : Math.min(v.x - 18, lead.x - 40);
      const far = dirR ? Math.min(ex, lead.x + 380) : Math.max(ex, lead.x - 380);
      G.kids.forEach((k, i) => { k.tx = far + (dirR ? -1 : 1) * i * 13; });
    }
  }
  return S;
}

// ================= gatuprataren (griffeltavla på trottoaren) =================
const boardAt = (b) => [b.x + 1, baseOf(b) + 19]; // vänster kant, fotlinje (så långt ut att sockeln syns ovanför)
let BOARD = null;
function boardSprite(snow) {
  BOARD ||= {};
  const k = snow ? 's' : 'd';
  if (BOARD[k]) return BOARD[k];
  const S = new Pix(24, 28), wood = 0xb07a44;
  // benen (A-ställning)
  S.line(1, 3, 0, 27, mul(wood, 0.7)); S.line(22, 3, 23, 27, mul(wood, 0.7));
  S.line(2, 3, 1, 27, wood); S.line(21, 3, 22, 27, mul(wood, 0.85));
  S.hl(2, 23, 20, mul(wood, 0.6));
  // tavlan
  S.rect(1, 1, 22, 22, wood); S.hl(1, 1, 22, mix(wood, WHITE, 0.35)); S.hl(1, 22, 22, mul(wood, 0.6)); S.vl(22, 2, 20, mul(wood, 0.7));
  for (let y = 3; y < 21; y++) for (let x = 3; x < 21; x++) S.px(x, y, mix(0x2e3c36, 0x3a4a42, hash(x, y, 101) * 0.6));
  text(S, SMALL, $t('NYTT!'), 4, 4, 0xff9ac0);
  // en dumpling i krita
  const dm = art(DUMP_ART, { e: 0xf4f0e8, a: 0xd8d4cc, d: 0xc8c0b8, k: 0x2e3c36, b: 0xff9ac0, o: 0xff9ac0 });
  stamp(S, dm, 8, 10);
  text(S, SMALL, $t('KLÄM'), 4, 17, 0xf8e070);
  S.px(19, 11, 0xff9ac0); S.px(18, 12, 0xff9ac0); S.px(20, 12, 0xff9ac0); S.px(19, 13, 0xff9ac0); // hjärta
  if (snow) { S.hl(1, 0, 22, WHITE); S.hl(2, 1, 20, 0xeef4fa); }
  BOARD[k] = canvasOf(S);
  return BOARD[k];
}

// ================= tåget: tillstånd och ritning =================
const TRAIN = new Map();
function trainOf(b) {
  let T = TRAIN.get(b.id);
  if (!T) TRAIN.set(b.id, (T = { dist: null, v: 0, lt: null, puffs: [], nextPuff: 0 }));
  return T;
}
// ångpuffar: släpps ur skorstenen där loket är och stiger rakt upp (ligger kvar i luften när tåget kör vidare)
function puffsUpdate(T, lok, t, dt) {
  T.puffs = T.puffs.filter((p) => t - p.t0 < 1.1 && t >= p.t0);
  if (T.v > 2 && lok) {
    T.nextPuff -= dt * (T.v / 11);
    if (T.nextPuff <= 0) {
      T.nextPuff = 0.3;
      const ca = Math.cos(lok.th), sa = Math.sin(lok.th);
      T.puffs.push({ x: Math.round(lok.x + 2.5 * ca), y: Math.round(lok.y - 1.25 * sa - 8), t0: t, back: lok.back });
    }
  }
}
function drawPuffs(ctx, T, t, back, night) {
  for (const p of T.puffs) {
    if (p.back !== back) continue;
    const age = clamp((t - p.t0) / 1.1, 0, 1), sz = age < 0.35 ? 1 : 2, y = p.y - Math.floor(age * 9);
    ctx.fillStyle = rgba(night ? 0x8a8ea8 : 0xffffff, 0.9 * (1 - age));
    ctx.fillRect(p.x - (sz >> 1), y - sz + 1, sz, sz);
  }
}
// "stationen": där loket står när butiken är stängd – hela tåget synligt på framsträckan
const stationOf = (tr) => Math.min(tr.Ls - 2, 19 + Math.max(0, tr.Ls - 21) * 0.6);
const TRAIN_V = 11, TRAIN_ACC = 5, TRAIN_DEC = 4;
function trainUpdate(b, st, m) {
  const T = trainOf(b), t = st.t || 0, tr = m.disp.track, station = stationOf(tr);
  if (T.dist === null) T.dist = station;
  if (T.lt !== null && t < T.lt - 1) T.lt = null;
  const dt = T.lt === null ? 0 : clamp(t - T.lt, 0, 0.1);
  T.lt = t; T.dt = dt;
  if (isOpen(b, st.hour ?? 12)) {
    T.stopAt = null;
    T.v = Math.min(TRAIN_V, T.v + TRAIN_ACC * dt);
    T.dist += T.v * dt;
  } else if (T.v > 0) {
    // stängt: rulla vidare till stationen och bromsa mjukt in där
    if (T.stopAt == null) T.stopAt = station + Math.ceil((T.dist + (T.v * T.v) / (2 * TRAIN_DEC) - station) / tr.len) * tr.len;
    const rem = Math.max(0, T.stopAt - T.dist);
    T.v = Math.max(Math.min(T.v, Math.sqrt(2 * TRAIN_DEC * rem)), Math.min(1.2, rem * 3));
    T.dist = Math.min(T.stopAt, T.dist + T.v * dt);
    if (T.stopAt - T.dist < 0.02) { T.dist = T.stopAt; T.v = 0; T.stopAt = null; }
  }
  if (T.dist > 1e6) T.dist = ((T.dist % tr.len) + tr.len) % tr.len;
  return T;
}
function carsOf(b, m, T) {
  const tr = m.disp.track;
  return CARS.map(([kind, off]) => {
    const p = trackAt(tr, T.dist - off);
    return { kind, X: p.X, Y: p.Y, th: p.th, x: Math.round(tr.cx + p.X), y: Math.round(tr.cy - 0.5 * p.Y), back: p.Y > 0.01, idx: headIdx(p.th) };
  });
}
function drawCars(ctx, cars, night) {
  for (const c of cars) {
    const s = trainSprite(c.kind, c.idx);
    ctx.drawImage(night ? s.night : s.day, c.x - s.ax, c.y - s.ay);
  }
}

// ================= ballonger =================
let BAL = null;
function balloons() {
  if (BAL) return BAL;
  BAL = {
    small: [0xe8464e, 0xf8d040, 0x4898e0].map((c) => canvasOf(outlined(balloonSprite(BALLOON_S, c), mul(c, 0.5)))),
    big: [
      canvasOf(outlined(balloonSprite(BALLOON_L, 0xff5a8a), 0x8a2a4a)),
      canvasOf(outlined(balloonSprite(BALLOON_L, 0x6ad0f0), 0x2a6a8a)),
      canvasOf(outlined(balloonSprite(HEART_L, 0xe8384a), 0x7a1a2a)),
      canvasOf(outlined(art(BUNNYB, { h: 0xe4d8f6, w: 0xd6c2f2, W: 0xb6a0dc, p: 0xffb4cc, k: INK, b: 0xff8cb0, n: 0xff8cb0, d: 0x9a86c4 }), 0x6a5a92)),
      canvasOf(outlined(balloonSprite(BALLOON_L, 0xf8d040), 0x8a6a1a)),
    ],
  };
  return BAL;
}
// snöre som pixellinje (heltal i båda ändar – ingen halvpixel)
function string(ctx, x0, y0, x1, y1, col) {
  ctx.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 200; n++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
// dörrens ballongknippe: [sprite, dx, dy (topp relativt kroken), fas]
const DOOR_BUNCH = [[1, -9, -34, 0.3], [4, 5, -38, 1.7], [2, -3, -41, 2.9], [0, 2, -31, 4.1], [3, -8, -26, 5.3]];

// ================= LIVE =================
function liveLeksaker(ctx, b, st) {
  const night = !!st.night, snow = snowOf(st), m = metaFor(b, night, snow), t = st.t || 0;
  const open = isOpen(b, st.hour ?? 12);
  // ---- dörren ----
  const K = KITS[b.id] || (KITS[b.id] = {});
  const kit = K[night ? 'n' : 'd'] || (K[night ? 'n' : 'd'] = doorKit(b, night));
  const step = drawDoor(ctx, b, st, kit);
  if (step === 0) {
    const cards = cardSprites(), c = open ? cards.open : cards.closed;
    ctx.drawImage(c, b.door.x0 + ((b.door.x1 - b.door.x0 - 7) >> 1), baseOf(b) - DOOR_H + 6);
  }
  // dörrklockan gungar medan dörren rör sig
  const [bx, by] = m.door.bell, moving = (st.doorOpen || 0) > 0.04 && (st.doorOpen || 0) < 0.96;
  const sw = moving ? (Math.floor(t * 10) & 1 ? 1 : -1) : 0;
  ctx.fillStyle = '#6a5a50'; ctx.fillRect(bx, by - 13, 1, 2);
  ctx.fillStyle = '#f0c848'; ctx.fillRect(bx - 1 + sw, by - 11, 3, 2); ctx.fillStyle = '#b08a28'; ctx.fillRect(bx - 1 + sw, by - 9, 3, 1);
  ctx.fillStyle = '#fff4b0'; ctx.fillRect(bx - 1 + sw, by - 11, 1, 1);
  // ---- skylten: tända neonrör och jagande glödlampor när det är öppet ----
  if (open) {
    const N = neonImgs(m), Bu = bulbImgs(m);
    ctx.drawImage(N.lit, N.x, N.y);
    ctx.drawImage(Bu.lit[Math.floor(t * 5) % 3], Bu.x, Bu.y);
  }
  // ---- skyltfönstret ----
  const d = m.disp, [rx, ry, rw, rh] = d.rect;
  const T = trainUpdate(b, st, m), cars = carsOf(b, m, T).sort((a, c) => c.Y - a.Y);
  puffsUpdate(T, cars.find((c) => c.kind === 'lok'), t, T.dt || 0);
  ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  drawCars(ctx, cars.filter((c) => c.back), night);
  drawPuffs(ctx, T, t, true, night);                 // röken bakom nallen när loket är på bortre sidan
  ctx.drawImage(d.mid, d.at[0], d.at[1]);
  drawCars(ctx, cars.filter((c) => !c.back), night);
  drawPuffs(ctx, T, t, false, night);
  // nallens ballonger (stilla luft inne: gungar bara lite)
  if (d.paw) {
    const B = balloons(), [px, py] = d.paw;
    const offs = [[-6, -8], [1, -10], [7, -7]];
    offs.forEach(([ox, oy], i) => {
      const s = B.small[i], dx = Math.round(Math.sin(t * 0.35 + i * 2.1) * 1.1), dy = 0; // stilla luft inne: ett långsamt vajande i sidled
      const kx = px + ox + dx, ky = py + oy + dy;
      string(ctx, px, py, kx, ky, night ? '#4a4450' : '#8a7a80');
      ctx.drawImage(night ? (B.smallN ||= B.small.map((c) => dim(c)))[i] : s, kx - 3, ky - s.height + 1);
    });
  }
  // stängt i skymningen (dagbilden men ljuset släckt inne): dunkla ner rummet innan glaset
  const dusk = !open && !night ? Math.min(1, (st.env?.dark || 0) * 2.4) : 0;
  if (dusk > 0.02) { ctx.fillStyle = rgba(0x141a3a, 0.5 * dusk); ctx.fillRect(rx, ry, rw, rh); }
  ctx.drawImage(d.glass, d.at[0], d.at[1]);
  ctx.restore();
  // ---- ballongerna vid dörren vajar i vinden ----
  const B = balloons(), [hx, hy] = m.door.hook, wind = windOf(st), amp = 1 + Math.min(2.5, Math.abs(wind) / 14);
  for (const [si, dx, dy, ph] of DOOR_BUNCH) {
    const s = B.big[si], lean = Math.round(clamp(wind * 0.06, -4, 4) * (-dy / 38));
    const ox = Math.round(Math.sin(t * (1.1 + ph * 0.05) + ph) * amp) + lean, oy = Math.round(Math.sin(t * 0.8 + ph) * 0.8);
    const kx = hx + dx + ox, ky = hy + dy + oy + s.height;
    string(ctx, hx, hy, kx, ky - 1, 'rgba(236,228,222,0.95)');
    ctx.drawImage(s, kx - (s.width >> 1), ky - s.height);
  }
  // ---- vindsnurran på gaveln ----
  const fr = pinwheelFrames(), rps = 0.35 + Math.min(2.5, Math.abs(wind) / 18);
  const fi = ((Math.floor(t * rps * 8) % 8) + 8) % 8, pw = fr[wind < 0 ? 7 - fi : fi];
  ctx.drawImage(pw, m.pin[0] - 6, m.pin[1] - 6);
  // ---- drakens svans fladdrar i vinden ----
  if (m.kite) {
    const [kx, ky] = m.kite, wd = wind >= 0 ? 1 : -1, str = Math.min(1, 0.35 + Math.abs(wind) / 30);
    const bows = [0xff5a8a, 0xf8d648, 0x4ec0e8];
    for (let i = 1; i <= 12; i++) {
      const x = kx + Math.round(wd * i * 0.7 * str + Math.sin(t * 5.5 - i * 0.7) * (i / 12) * 2), y = ky + Math.round(i * (0.9 - 0.45 * str));
      ctx.fillStyle = '#5a4a50'; ctx.fillRect(x, y, 1, 1);
      if (i % 4 === 0) { ctx.fillStyle = css(bows[i / 4 - 1]); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 1); }
    }
  }
  // ---- rök ur skorstenen när det är kallt ----
  const temp = st.env?.weather?.temp;
  if (temp !== undefined && temp < 8) {
    const [cx, cy] = m.chimney;
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.28 + i / 4) % 1, sz = 2 + Math.round(p * 2);
      const x = Math.round(cx + p * (6 + wind * 0.3)), y = Math.round(cy - p * 14); // driver jämnt med vinden – inget darr
      ctx.fillStyle = rgba(night ? 0x8a8ea0 : 0xeceef2, 0.4 * (1 - p));
      ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz - 1);
    }
  }
}
// glödlamporna i skyltramen: tre jaglägen, tända (live) och glöd (glow) – byggs en gång per målning
function bulbImgs(m) {
  if (m.bulbImg) return m.bulbImg;
  const [sx, sy, sw, sh] = m.signRect, x0 = sx - 1, y0 = sy - 1, w = sw + 2, h = sh + 2;
  const lit = [], glow = [];
  for (let ph = 0; ph < 3; ph++) {
    const Lt = new Pix(w, h), Gw = new Pix(w, h);
    m.bulbs.forEach(([x, y], i) => {
      const on = i % 3 === ph, bx = x - x0, by = y - y0;
      Lt.px(bx, by, on ? 0xfffbe0 : 0xffc860);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Gw.px(bx + dx, by + dy, 0xffe8a0, on ? 0.8 : 0.45);
      Gw.px(bx, by, 0xfff8e0, on ? 0.8 : 0.45);
    });
    lit.push(Lt.flush()); glow.push(Gw.flush());
  }
  return (m.bulbImg = { lit, glow, x: x0, y: y0 });
}
// skyltfönstrets ljus när butiken är öppen i mörkret: varm yta, två spotkäglor, överljuset, under markisen
function winGlowImg(m) {
  if (m.winGlow) return m.winGlow;
  const [rx, ry, rw, rh] = m.disp.rect, [tx, ty, tw, th] = m.transom, [ax, ay, aw] = m.awning;
  const x0 = Math.min(rx, tx, ax), y0 = Math.min(ry, ty, ay), x1 = Math.max(rx + rw, tx + tw, ax + aw, m.tower ? m.tower[0] + m.tower[2] : 0), y1 = Math.max(ry + rh, ty + th);
  const Gw = new Pix(x1 - x0, y1 - y0, x0, y0);
  Gw.rect(rx, ry, rw, rh, 0xffe2b0, 0.3);
  for (const f of [0.28, 0.72]) {
    const sx = Math.round(rx + rw * f);
    for (let j = 0; j < rh; j++) { const hw = 2 + Math.round(j * 0.32); Gw.rect(sx - hw, ry + j, hw * 2 + 1, 1, 0xfff0c8, 0.09); }
  }
  if (m.tower) { const [x, y, w, h] = m.tower; Gw.rect(x, y, w, h, 0xffe2c0, 0.28); }
  Gw.rect(tx, ty, tw, th, 0xfff0d0, 0.3);
  Gw.rect(ax, ay + 10, aw, 4, 0xffe0b0, 0.07);
  const img = Gw.flush();
  // ljusslingan får en egen liten bild (ligger högt upp på fasaden)
  let fx0 = 1e9, fy0 = 1e9, fx1 = -1e9, fy1 = -1e9;
  for (const [x, y] of m.fairy || []) { fx0 = Math.min(fx0, x); fy0 = Math.min(fy0, y); fx1 = Math.max(fx1, x); fy1 = Math.max(fy1, y); }
  let fairy = null;
  if (m.fairy?.length) {
    const F = new Pix(fx1 - fx0 + 3, fy1 - fy0 + 3, fx0 - 1, fy0 - 1);
    for (const [x, y, c] of m.fairy) { F.rect(x - 1, y - 1, 3, 3, c, 0.35); F.px(x, y, mix(c, WHITE, 0.6), 0.9); }
    fairy = { img: F.flush(), x: fx0 - 1, y: fy0 - 1 };
  }
  return (m.winGlow = { img, x: x0, y: y0, fairy });
}
// neonrören tända (live) och deras glöd (glow) – byggs en gång per målning
function neonImgs(m) {
  if (m.neonImg) return m.neonImg;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of m.neon) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, Lt = new Pix(w, h), Hl = new Pix(w + 4, h + 4), on = new Int16Array((w + 4) * (h + 4)).fill(-1);
  for (const [x, y, i, core] of m.neon) { Lt.px(x - x0, y - y0, core ? mix(NEON[i], WHITE, 0.75) : NEON[i]); on[(y - y0 + 2) * (w + 4) + x - x0 + 2] = i; }
  for (let j = 0; j < h + 4; j++) for (let i = 0; i < w + 4; i++) {
    const me = on[j * (w + 4) + i];
    if (me >= 0) { Hl.px(i, j, mix(NEON[me], WHITE, 0.5), 0.55); continue; }
    let best = -1, n = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= w + 4 || jj >= h + 4) continue;
      const v = on[jj * (w + 4) + ii];
      if (v >= 0) { const near = Math.abs(di) + Math.abs(dj) <= 1; n += near ? 2 : 1; best = v; }
    }
    if (best >= 0) Hl.px(i, j, NEON[best], Math.min(0.5, 0.06 + n * 0.035));
  }
  m.neonImg = { lit: Lt.flush(), halo: Hl.flush(), x: x0, y: y0 };
  return m.neonImg;
}
function dim(c) {
  const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), o = document.createElement('canvas');
  o.width = c.width; o.height = c.height;
  for (let i = 0; i < im.data.length; i += 4) {
    if (!im.data[i + 3]) continue;
    const k = mix(mul((im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2], 0.42), 0x141a3a, 0.2);
    im.data[i] = k >> 16; im.data[i + 1] = (k >> 8) & 255; im.data[i + 2] = k & 255;
  }
  o.getContext('2d').putImageData(im, 0, 0);
  return o;
}

// ================= GLOW =================
function glowLeksaker(ctx, b, st) {
  const k = Math.min(1, (st.env?.dark || 0) * 2);
  if (k <= 0.02) return;
  const night = !!st.night, snow = snowOf(st), m = metaFor(b, night, snow), t = st.t || 0;
  const open = isOpen(b, st.hour ?? 12), [rx, ry, rw, rh] = m.disp.rect;
  ctx.globalCompositeOperation = 'lighter';
  if (open) {
    // skyltfönstret, överljuset och markisens undersida (förberäknad ljusbild), neonskylten och glödlamporna
    const Wg = winGlowImg(m), N = neonImgs(m), Bu = bulbImgs(m);
    ctx.globalAlpha = k;
    ctx.drawImage(Wg.img, Wg.x, Wg.y);
    if (Wg.fairy) ctx.drawImage(Wg.fairy.img, Wg.fairy.x, Wg.fairy.y);
    ctx.drawImage(N.halo, N.x - 2, N.y - 2);
    ctx.drawImage(Bu.glow[Math.floor(t * 5) % 3], Bu.x, Bu.y);
    ctx.globalAlpha = 1;
    const [sx, sy, sw, sh] = m.signRect;
    ctx.fillStyle = rgba(0xff7ac0, 0.06 * k); ctx.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);
  } else {
    // stängt: bara den lilla stjärnlampan i fönstret lyser varmt
    const [lx, ly] = m.disp.lamp;
    ctx.fillStyle = rgba(0xffc870, 0.1 * k); ctx.fillRect(lx - 12, ly - 6, 24, 24);
    ctx.fillStyle = rgba(0xffc870, 0.1 * k); ctx.fillRect(lx - 8, ly - 3, 16, 16);
    ctx.fillStyle = rgba(0xffe090, 0.45 * k); ctx.fillRect(lx - 2, ly - 2, 5, 5);
    ctx.fillStyle = rgba(0xfff6d0, 0.7 * k); ctx.fillRect(lx - 1, ly - 1, 3, 3);
    ctx.fillStyle = rgba(0xffb860, 0.05 * k); ctx.fillRect(rx, ry, rw, rh);
  }
  // ljuspöl framför dörren (mest när den öppnas) och framför skyltfönstret när det är öppet
  const dOpen = Number.isFinite(st.doorOpen) ? st.doorOpen : 0, base = baseOf(b);
  const [dx, , dw] = m.doorRect, dc = 0xffe4b0;
  if (open || dOpen > 0.02) {
    ctx.fillStyle = rgba(dc, (0.1 + dOpen * 0.4) * k); ctx.fillRect(dx, base - DOOR_H, dw, DOOR_H);
    for (let r = 0; r < 12; r++) { const sp = Math.round(r * 0.6); ctx.fillStyle = rgba(dc, (0.06 + dOpen * 0.3) * k * (1 - r / 12)); ctx.fillRect(dx - sp, base + r, dw + sp * 2, 1); }
  }
  if (open) for (let r = 0; r < 8; r++) { ctx.fillStyle = rgba(0xffe0b0, 0.07 * k * (1 - r / 8)); ctx.fillRect(rx + 2 - r, base + r, rw - 4 + r * 2, 1); }
  else { const [lx] = m.disp.lamp; for (let r = 0; r < 4; r++) { ctx.fillStyle = rgba(0xffc870, 0.05 * k * (1 - r / 4)); ctx.fillRect(lx - 10 - r, base + r, 20 + r * 2, 1); } }
  ctx.globalCompositeOperation = 'source-over';
}

// ================= ITEMS och HINDER =================
function itemsLeksaker(b, st) {
  const snow = snowOf(st), m = metaFor(b, !!st.night, snow), out = [];
  const [bx, fy] = boardAt(b), img = boardSprite((st.env?.weather?.snowCover || 0) > 0.35);
  out.push({ x: bx + 12, y: fy, draw: (ctx) => ctx.drawImage(img, bx, fy - img.height + 1) });
  const S = kidsUpdate(b, st, m);
  for (const k of S.group?.kids || []) {
    const kx = Math.round(k.x), ky = Math.round(k.y), look = k.look, dir = k.dir, fr = k.frame;
    out.push({ x: kx, y: ky, draw: (ctx) => drawPerson(ctx, kx, ky, look, dir, fr) });
  }
  if (S.talk?.active?.()) {
    const v = st.env?.view;
    out.push({ y: 1e5 + 1, draw: (ctx) => S.talk.draw(ctx, v ? { x0: v.x, x1: v.x + v.w } : undefined) });
  }
  return out;
}
function obstaclesLeksaker(b) {
  const [bx, fy] = boardAt(b);
  return [[bx, fy - 3, bx + 24, fy + 1]];
}

export const BUILDING_ART = {
  leksaker: { paint: paintLeksaker, live: liveLeksaker, glow: glowLeksaker, items: itemsLeksaker, obstacles: obstaclesLeksaker },
};

// Felsökning/test: läget i tåget, barnen och husets mått (världskoordinater).
export const _debug = {
  geo: (b) => { const g = geo(b); return { ...g, win: { x0: g.win.x0 + g.ox, x1: g.win.x1 + g.ox, y0: g.win.y0 + g.oy, y1: g.win.y1 + g.oy } }; },
  meta: (b, night = false, snow = 0) => metaFor(b, night, snow),
  train: (b) => { const T = trainOf(b), m = metaFor(b, false, 0); return { dist: T.dist, v: T.v, len: m.disp.track.len, cars: T.dist === null ? [] : carsOf(b, m, T) }; },
  setTrain: (b, dist, v = 0) => { const T = trainOf(b); T.dist = dist; T.v = v; },
  speech: (b) => { const S = kidsOf(b), G = S.group; return { loaded: !!SPEECH, tried: speechTried, talk: !!S.talk, active: !!S.talk?.active?.(), text: S.talk?.text?.() ?? null, said: G?.said, speak: G?.speak }; },
  kids: (b) => (kidsOf(b).group ? { phase: kidsOf(b).group.phase, line: kidsOf(b).group.line, kids: kidsOf(b).group.kids.map((k) => ({ x: k.x, y: k.y, dir: k.dir, frame: k.frame })) } : null),
  spawnKids: (b, t = 0, n) => { const S = kidsOf(b); S.group = null; S.next = t; if (n !== undefined) S.n = n; }, // n = vilken barngrupp (styr replik och utseende)
  kidsOff: (on = true) => { KIDS_OFF = !!on; },
  reset: () => { TRAIN.clear(); KIDS.clear(); for (const k of Object.keys(META)) delete META[k]; for (const k of Object.keys(KITS)) delete KITS[k]; },
  sprites: () => { const s = trainSprites(); return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map((x) => [x.day.width, x.day.height])])); },
  trainSprites: () => trainSprites(),
  pinwheel: () => pinwheelFrames(),
  kompisar: () => Object.keys(KOMPIS),                        // fasadens Klämkompisar (samma arter som toys.js)
  lines: () => ({ ...LINES, kompis: kompisLines(), namn: KNAMN }), // barnens repliker (kompis = med namn ur toys.js)
  plush: (kind) => canvasOf(plushSprite(kind)),                // en Klämkompis som färdig pixelbild
  balloons: () => balloons(),                                  // { small, big } – big[3] = Pösa-ballongen
  trackAt,
};
