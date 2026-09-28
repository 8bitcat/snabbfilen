// STORMARKNAD – matbutiken man går runt i med sin egen figur. Butiken är dubbelt
// så bred som skärmen och nästan dubbelt så hög; kameran följer figuren.
//
//   bakväggen:  FRUKT & GRÖNT (kyld grönsaksvägg med dimspridare och markis)
//               MEJERI (sex kylar med glasdörrar) · PERSONAL-dörr · BAGERI med
//               bake-off-ugn · SMÖRGÅSAR (öppen kyl)
//   golvet:     fruktöar med lådor, sex hyllgondoler (PASTA & RIS, KONSERVER,
//               FRUKOST, DRYCK, FIKA, GODIS & CHIPS), två frysboxar, kassorna
//               med rullband och kassörska, KORV & KAFFE med sittdisk (ÄT HÄR),
//               entrén med skjutdörrar, kundvagnar, korgar, pantmaskin,
//               kampanjpall och blomsterstånd.
//
// Maten i FOOD (game.js) står på bestämda hyllplatser med en stor gul prislapp.
// Klick på en vara → figuren går dit och lägger den i korgen (korgen syns i
// figurens händer och i en panel uppe till vänster). I kassan läggs varorna på
// rullbandet, kassörskan piper in dem och man betalar allt på en gång
// (A.game.buyFood per vara → kylskåpet hemma). Räcker inte pengarna får man
// ett tydligt besked och kan lägga tillbaka saker. Vid sittdisken kan man äta
// direkt (buyFood(id, { eatNow: true }), 5 kr extra).
//
// Allt ritas i spelets pixelkorn: förmålade Pix-bilder i skala 1, heltal, med
// 3–5-toners skuggning, högdagrar, mörka konturer och dithering.
import { Pix, SMALL, BIG, ctxText, textW, text, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import { FOOD, foodOf, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from './walkable.js';
import { worldFolksHere } from '../net/world.js';

// ================= geometri (spelpixlar, världskoordinater) =================
const VW = 384, VH = 216;
const W = 768, H = 400;
const WALL_Y = 72;                    // bakväggens fot = golvets början
const FRONT_Y = 388;                  // glasfasadens överkant (nederst)
const SIDE = 6;                       // sidoväggarnas tjocklek
const DOOR = { x0: 100, x1: 148 }, DOOR_X = 124; // skjutdörrarna i fasaden
const GREENS = { x0: 10, x1: 232, top: 30, base: 90 };            // grönsaksväggen
const DAIRY = { x0: 244, x1: 508, top: 22, base: 84, n: 6, dw: 44 }; // mejerikylarna
const STAFF = { x0: 516, x1: 542, top: 34 };                      // personaldörren
const BAKERY = { x0: 552, x1: 700, top: 30, base: 84 };           // bageriet
const SANDW = { x0: 708, x1: 756, top: 36, base: 84 };            // smörgåskylen
const ISLANDS = [ // [bakre raden, främre raden] av lådor
  { x0: 20, x1: 110, base: 146, crates: [['applR', 'apels', 'banan'], ['applG', 'citron', 'druva']] },
  { x0: 130, x1: 220, base: 146, crates: [['paron', 'kiwi', 'avokado'], ['tomat', 'paprika', 'lime']] },
  { x0: 20, x1: 110, base: 214, crates: [['melon', 'vmelon', 'ananas'], ['potatis', 'lok', 'morot']] },
  { x0: 130, x1: 220, base: 214, crates: [['plommon', 'persika', 'granat'], ['champ', 'aubergine', 'rodlok']] },
];
const ROWS = [148, 212, 276];
const GCOLS = [[252, 384], [408, 540]];
const GCATS = ['pasta', 'konserv', 'frukost', 'dryck', 'fika', 'godis'];
const GONDOLAS = GCATS.map((cat, i) => ({ cat, x0: GCOLS[i % 2][0], x1: GCOLS[i % 2][1], base: ROWS[i >> 1] }));
const FREEZERS = [
  { x0: 574, x1: 756, base: 150, secs: ['pizza', 'glass', 'gront', 'glass2'] },
  { x0: 574, x1: 756, base: 214, secs: ['fisk', 'bar', 'pommes', 'glass'] },
];
const KASSOR = [
  { x0: 280, x1: 372, base: 346, n: 1, open: true },
  { x0: 428, x1: 520, base: 346, n: 2, open: false },
];
const K1 = KASSOR[0];
const BELT = { x0: K1.x0 + 3, x1: K1.x0 + 50, y: K1.base - 22 }; // rullbandets ovansida (varorna står på y)
const SCAN_X = K1.x0 + 52;
const GRILL = { x0: 598, x1: 722, base: 298 };
const VENDOR_X = GRILL.x0 + 52; // korvgubben står bakom disken här
const BAR = { x0: 592, x1: 756, base: 378 };
const STOOLS = [610, 636, 662, 688, 714, 740];
const REG_I = 5; // stamgästens pall
const STOOL_Y = 365; // pallarnas fot – sitsen sticker upp bakom bänkskivan
const CARTS = { x0: 14, x1: 90, base: 386 };
const BASKETS = { x0: 158, x1: 182, base: 386 };
const PANT = { x0: 10, x1: 40, base: 324 };
const PALLET = { x0: 50, x1: 96, base: 306 };
const FLOWERS = { x0: 172, x1: 232, base: 306 };
const AFRAME = { x: 210, base: 382 };
const MAGS = { x0: 196, x1: 246, base: 350 };   // tidningsstället
const WET = { x: 548, base: 372 };              // VÅTT GOLV-skylt + städhink
const BINS = { x0: 566, x1: 594, base: 300 };   // sopstationen i kaféhörnet
const PLANT = { x: 744, base: 300 };            // stor krukväxt vid kaffemaskinen
const SCALE = { x: 229, base: 190 };            // fruktvågen med påsrulle
const CAGE = { x0: 502, x1: 524, base: 160 };
const RESTOCK = [490, 161];
const DROP = { x: 394, base: 346 };             // tomma korgar efter kassan
const MAX_BASKET = 12;
const EAT_EXTRA = 5; // game.buyFood tar 5 kr extra för eatNow

// allt man inte kan gå igenom
const OBST = [
  [GREENS.x0, WALL_Y, GREENS.x1, GREENS.base],
  [DAIRY.x0, WALL_Y, DAIRY.x1, DAIRY.base],
  [BAKERY.x0, WALL_Y, BAKERY.x1, BAKERY.base],
  [SANDW.x0, WALL_Y, SANDW.x1, SANDW.base],
  ...ISLANDS.map((i) => [i.x0, i.base - 18, i.x1, i.base]),
  ...GONDOLAS.map((g) => [g.x0, g.base - 12, g.x1, g.base]),
  ...FREEZERS.map((f) => [f.x0, f.base - 24, f.x1, f.base]),
  ...KASSOR.map((k) => [k.x0, k.base - 28, k.x1, k.base]),
  ...KASSOR.map((k) => [k.x1 + 2, k.base - 12, k.x1 + 16, k.base]),
  [GRILL.x0, GRILL.base - 22, GRILL.x1, GRILL.base],
  [BAR.x0, BAR.base - 7, BAR.x1, BAR.base],
  [CARTS.x0, CARTS.base - 16, CARTS.x1, FRONT_Y],
  [BASKETS.x0, BASKETS.base - 10, BASKETS.x1, FRONT_Y],
  [PANT.x0, PANT.base - 14, PANT.x1, PANT.base],
  [PALLET.x0, PALLET.base - 14, PALLET.x1, PALLET.base],
  [FLOWERS.x0, FLOWERS.base - 12, FLOWERS.x1, FLOWERS.base],
  [AFRAME.x - 16, AFRAME.base - 5, AFRAME.x + 16, AFRAME.base],
  [MAGS.x0, MAGS.base - 10, MAGS.x1, MAGS.base],
  [WET.x - 8, WET.base - 5, WET.x + 18, WET.base],
  [BINS.x0, BINS.base - 8, BINS.x1, BINS.base],
  [PLANT.x - 9, PLANT.base - 6, PLANT.x + 9, PLANT.base],
  [SCALE.x - 6, SCALE.base - 5, SCALE.x + 6, SCALE.base],
  [CAGE.x0, CAGE.base - 8, CAGE.x1, CAGE.base],
  [DROP.x - 1, DROP.base - 6, DROP.x + 15, DROP.base],
];

// kunderna tittar på hyllorna härifrån
const BROWSE = [
  [40, 97], [120, 97], [200, 97], [270, 97], [340, 97], [410, 97], [480, 97], [590, 97], [660, 97], [730, 97],
  [66, 160], [174, 160], [66, 228], [174, 228],
  [290, 160], [350, 160], [440, 160], [290, 224], [350, 224], [440, 224], [510, 224],
  [290, 288], [350, 288], [440, 288], [510, 288],
  [620, 164], [700, 164], [620, 228], [700, 228],
];

// ================= färger och typsnitt =================
const OUT = 0x221a26;
const GREEN = 0x229a4a, GREEN_DK = 0x0e4a24, GREEN_HI = 0x5ad07a;
const RED = 0xe0303a, RED_DK = 0x8a1a22;
const STEEL = [0x3e444c, 0x646c76, 0x8e98a2, 0xbcc4cc, 0xe6ecf0];
const OAK = [0x4a2e18, 0x74502a, 0xa0763e, 0xc89a5a, 0xe8c080];
const WALNUT = [0x2a1a10, 0x4a2e1c, 0x6e4628, 0x8e603a, 0xb07e50];
const WOOD = [0x3a2414, 0x6a4424, 0x9a6a3a, 0xc4925a, 0xe2b880];
const PACKS = [0xd8323a, 0xf0b429, 0x3a7bd5, 0x46a35a, 0xe07a2e, 0x8e5bd1, 0x2aa39a, 0xc84a8a, 0x2d3a8c, 0xf4f1ea, 0x7a2e3e];
// pixeltypsnitten + ett och-tecken
const SM = { ...SMALL, '&': { rows: ['.#..', '#.#.', '.#..', '#.##', '.##.'], up: [], w: 4 } };
const BG = { ...BIG, '&': { rows: ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'], up: [], w: 5 } };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexs = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// fem toner ur en grundfärg: djup skugga, skugga, bas, ljus, högdager
const rampOf = (c) => [mix(mul(c, 0.4), 0x160c26, 0.3), mix(mul(c, 0.7), 0x2a1f3a, 0.1), c, mix(c, 0xfff6e8, 0.32), mix(c, 0xffffff, 0.66)];
// välj ton ur en palett; dithering bara i övergången mellan två toner
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
const qd = (t, x, y, n = 4) => clamp(Math.round(t * n + bayer(x, y) - 0.5), 0, n) / n;
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, qd(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
}
// skuggad låda: ljus överkant/vänsterkant, mörk högerkant/underkant
function sbox(P, x, y, w, h, c) {
  const r = rampOf(c);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let k = r[2];
    if (j === 0) k = r[3]; else if (j === h - 1) k = r[1]; else if (i === 0) k = r[3]; else if (i === w - 1) k = r[1];
    P.px(x + i, y + j, k);
  }
  if (w > 2 && h > 2) P.px(x, y, r[4]);
}
// snedställda reflexstrimmor på glas
function glare(P, x, y, w, h, a = 0.28, step = 13, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j + seed * 5) % step;
    if (d < 2) P.px(x + i, y + j, 0xffffff, a); else if (d === 3) P.px(x + i, y + j, 0xffffff, a * 0.45);
  }
}
// slagskugga på golvet – bara på tomma pixlar (läggs sist)
function groundShadow(P, cx, cy, rx, ry, a = 0.3) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t >= 1) continue;
    const xx = x - P.ox, yy = y - P.oy;
    if (xx < 0 || yy < 0 || xx >= P.w || yy >= P.h || P.d[(yy * P.w + xx) * 4 + 3]) continue;
    const q = clamp(Math.round((1 - t) * 3 + bayer(x, y) - 0.5), 0, 3) / 3;
    if (q > 0) P.px(x, y, 0x0a0c18, a * (0.4 + 0.6 * q));
  }
}
// mörk kontur runt allt målat: hård nedtill/höger, mjukare upptill/vänster
function outline(P, dark = OUT, softA = 0.7) {
  const { w, h, d } = P;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = on(x, y - 1) || on(x - 1, y), soft = on(x, y + 1) || on(x + 1, y);
    if (hard || soft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, dark, add[i + 2] ? 1 : softA);
}
// text med skugga och ljus överkant (skyltar)
function signText(P, F, s, x, y, c, sc = 1, shadow = null, hi = null) {
  const hgt = F.h * sc;
  if (shadow !== null) eachTextPixel(F, s, x + 1, y + 1, sc, (px, py) => P.px(px, py, shadow));
  eachTextPixel(F, s, x, y, sc, (px, py) => {
    const t = (py - y) / hgt;
    P.px(px, py, t < 0.25 && hi !== null ? hi : t > 0.7 ? mul(c, 0.84) : c);
  });
}
const centerText = (P, F, s, cx, y, c, sc = 1) => text(P, F, s, Math.round(cx - textW(F, s, sc) / 2), y, c, 1, sc);
// förmålad bild i världskoordinater
function sprite(x0, y0, w, h, fn) {
  const P = new Pix(w, h, x0, y0);
  fn(P);
  return { img: P.flush(), x: x0, y: y0, w, h };
}
const put = (ctx, s) => ctx.drawImage(s.img, s.x, s.y);
// liten svart griffeltavla med vit krita (prislappar på frukt och grönt)
function chalk(P, cx, y, s) {
  const w = textW(SM, s) + 4, x = Math.round(cx - w / 2);
  P.rect(x - 1, y - 1, w + 2, 9, 0x8a5a2a); P.hl(x - 1, y - 1, w + 2, 0xc08a50);
  P.rect(x, y, w, 7, 0x1e2622); P.px(x, y, 0x3a4640);
  text(P, SM, s, x + 2, y + 1, 0xf4f1ea);
  P.px(x + w - 2, y + 5, 0xf4f1ea, 0.4); // kritdamm
  return w;
}
// kompakt griffeltavla, 7 rader hög (x centrerad på cx, översta raden y)
function chalkS(P, cx, y, s) {
  const w = textW(SM, s) + 4, x = Math.round(cx - w / 2);
  P.rect(x, y, w, 7, 0x1e2622);
  P.hl(x, y, w, 0xc08a50); P.hl(x, y + 6, w, 0x6a4424); P.vl(x, y + 1, 5, 0xa0703e); P.vl(x + w - 1, y + 1, 5, 0x6a4424);
  text(P, SM, s, x + 2, y + 1, 0xf4f1ea);
  P.px(x + w - 3, y + 5, 0xf4f1ea, 0.35); // kritdamm
  return w;
}
const PRICES = ['12:-', '15:-', '19:-', '25:-', '9:90', '29:-', '22:-', '18:-', '35:-', '14:-'];

// ================= frukt och grönt =================
const FR = {
  applR: [0x4a080e, 0x8e1620, 0xd02c30, 0xff7a68, 0xffc8b8],
  applG: [0x2a5010, 0x4a8a1e, 0x80c040, 0xc4ec80, 0xf0ffd0],
  apels: [0x7a3406, 0xc8620e, 0xf49a2c, 0xffc870, 0xfff0c8],
  citron: [0x7a6208, 0xd0b014, 0xf6e44c, 0xfff8a0, 0xffffe8],
  lime: [0x1e4a10, 0x3a7a1a, 0x6ab030, 0xa8dc68, 0xe0ffc0],
  tomat: [0x560a0a, 0xa81616, 0xec3a2c, 0xff8a78, 0xffd0c8],
  paron: [0x5a5a10, 0x9a9a22, 0xd0cc48, 0xece888, 0xfffff0],
  kiwi: [0x2e1e0e, 0x4e3418, 0x7a5a30, 0x9e7e4e, 0xc0a070],
  avokado: [0x121e0c, 0x243a16, 0x3a5a22, 0x5a7e32, 0x8aa854],
  plommon: [0x220a2a, 0x4a1450, 0x7a2e82, 0xa860b0, 0xdab0e0],
  persika: [0x8a3a1a, 0xd0602a, 0xf0a060, 0xffd0a0, 0xfff0e0],
  granat: [0x4a0812, 0x86101e, 0xc02838, 0xe8606a, 0xffb0b0],
  potatis: [0x4a3418, 0x7a5a30, 0xb08850, 0xd4b078, 0xf0dcb0],
  lok: [0x5a300c, 0x9a5a1a, 0xd09040, 0xecc070, 0xfff0c8],
  rodlok: [0x2e0a26, 0x5a1848, 0x8a3070, 0xb86098, 0xe0a8cc],
  melon: [0x5a5a10, 0x9aa020, 0xd8d850, 0xf0f090, 0xffffe0],
  vmelon: [0x0e2a10, 0x1e4a1a, 0x2e6e26, 0x5a9a3a, 0x9ac870],
  champ: [0x6a5a48, 0x9a8a74, 0xd0c4b0, 0xece4d4, 0xffffff],
  aubergine: [0x14081e, 0x2a1238, 0x4a2260, 0x6a3a88, 0xa070c0],
  sallad: [0x1e4a14, 0x3a7a22, 0x6aae36, 0xa8dc68, 0xe0f8b0],
  broccoli: [0x0e2a12, 0x1e4a1e, 0x2e6a2a, 0x4a8a3a, 0x7ab060],
  gurka: [0x0e2a10, 0x1a4a1a, 0x2e7026, 0x5a9a3a, 0xa8d070],
  morot: [0x7a2a06, 0xc0500e, 0xf07a1e, 0xffaa50, 0xffe0b0],
  banan: [0x5a4206, 0xb88a10, 0xf0cc30, 0xfff08a, 0xfffce0],
  druva: [0x240834, 0x521862, 0x86389a, 0xb870c8, 0xe6c4f0],
  ananas: [0x5a3a08, 0x9a6a14, 0xd8a030, 0xf0c860, 0xfff0b0],
};
const FRUIT_SIZE = { citron: 2.2, lime: 2, kiwi: 2, plommon: 2, champ: 2, druva: 1, melon: 4, vmelon: 4.6, granat: 2.6, avokado: 2.4 };
// en rund frukt med mjuk ljussättning uppifrån vänster
function fruit(P, cx, cy, rx, ry, pal, seed = 0) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const v = 0.6 - nx * 0.2 - ny * 0.28 - d * 0.2 + (hash(x, y, seed) - 0.5) * 0.1;
    P.px(x, y, tone(pal, v, x, y));
  }
  P.px(Math.round(cx - rx * 0.4 - 0.5), Math.round(cy - ry * 0.45 - 0.5), pal[4]);
}
// en hög av samma sort i en låda: bakre rader först, kupad mitt
function heap(P, x0, y0, w, h, kind, seed) {
  const pal = FR[kind] || FR.applR;
  P.clip(x0, y0 - 6, x0 + w, y0 + h);
  P.rect(x0, y0 + 1, w, h - 1, mix(pal[0], 0x120a10, 0.4));
  const bulge = (x) => Math.round(2.2 * Math.sin(Math.PI * clamp((x - x0) / w, 0, 1)));
  if (kind === 'banan') {
    for (let j = 0; j < 3; j++) for (let i = 0; i < Math.ceil(w / 7) + 1; i++) {
      const bx = x0 - 2 + i * 7 + (j & 1) * 3, by = y0 + j * 3 - bulge(bx + 3);
      for (let f = 0; f < 3; f++) { // tre bananer i en klase, böjda
        const fy = by + f;
        P.px(bx, fy, 0x3a2a08); P.hl(bx + 1, fy + 1, 4, pal[f === 0 ? 3 : 2]); P.px(bx + 5, fy, pal[1]); P.px(bx + 2, fy + 1, f === 0 ? pal[4] : pal[3]);
        P.hl(bx + 1, fy + 2, 4, pal[1]); P.px(bx + 6, fy - 1, 0x4a3a10);
      }
    }
  } else if (kind === 'druva') {
    for (let y = y0 - 2; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (y < y0 + 1 - bulge(x)) continue;
      const green = hash(x >> 2, y >> 2, seed) > 0.6, c = green ? FR.applG : pal;
      const k = (x + y * 2) % 3;
      P.px(x, y, k === 0 ? c[3] : k === 1 ? c[2] : c[1]);
      if (k === 0 && hash(x, y, seed) > 0.6) P.px(x, y, c[4]);
    }
  } else if (kind === 'morot') {
    for (let r = 0; r < 4; r++) for (let i = 0; i < Math.ceil(w / 4) + 1; i++) {
      const bx = x0 - 3 + i * 4 + (r & 1) * 2, by = y0 + r * 2 - bulge(bx);
      for (let k = 0; k < 6; k++) { P.px(bx + k, by + (k >> 2), k < 2 ? pal[3] : k < 4 ? pal[2] : pal[1]); P.px(bx + k, by + 1 + (k >> 2), pal[1]); }
      P.px(bx - 1, by - 1, 0x4a9a2a); P.px(bx - 2, by - 2, 0x6ab83a); P.px(bx - 1, by - 2, 0x2e6a1e);
    }
  } else if (kind === 'ananas') {
    for (let i = 0; i < 3; i++) {
      const cx = x0 + 4 + i * 8 + (w - 26) / 2, cy = y0 + 3 - (i === 1 ? 1 : 0);
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
        if (x * x / 10 + y * y / 12 > 1) continue;
        const v = 0.55 - x * 0.08 - y * 0.05 + (((x + y) & 1) ? 0.1 : -0.12);
        P.px(cx + x, cy + y, tone(pal, v, cx + x, cy + y));
      }
      for (let k = 0; k < 4; k++) { P.px(cx - 2 + k, cy - 4 - (k === 1 || k === 2 ? 2 : 0), 0x3a8a2a); P.px(cx - 1 + (k >> 1), cy - 5, 0x5ab83a); }
      P.px(cx, cy - 7, 0x2e6a1e);
    }
  } else if (kind === 'sallad' || kind === 'broccoli') {
    const r = kind === 'sallad' ? 4.4 : 3.4;
    for (let row = 0; row < 2; row++) for (let i = 0; i < Math.ceil(w / (r * 1.7)) + 1; i++) {
      const cx = x0 + 2 + i * r * 1.7 + (row ? r * 0.85 : 0), cy = y0 + 2 + row * 3 - bulge(cx);
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dd = Math.hypot(x - cx, (y - cy) * 1.15);
        if (dd > r) continue;
        const bump = kind === 'broccoli' ? ((x + y) % 3 === 0 ? 0.18 : (x * 7 + y) % 5 === 0 ? -0.2 : 0) : ((x - y + 20) % 4 === 0 ? -0.14 : 0);
        P.px(x, y, tone(pal, 0.62 - ((x - cx) / r) * 0.2 - ((y - cy) / r) * 0.3 + bump + (hash(x, y, seed) - 0.5) * 0.18, x, y));
      }
      if (kind === 'broccoli') P.rect(Math.round(cx) - 1, Math.round(cy + r) - 1, 2, 2, 0x9ac870);
    }
  } else if (kind === 'gurka') {
    for (let row = 0; row < 4; row++) for (let i = 0; i < Math.ceil(w / 10) + 1; i++) {
      const bx = x0 - 4 + i * 10 + (row & 1) * 5, by = y0 + row * 2 - bulge(bx + 4);
      P.hl(bx, by, 9, pal[3]); P.hl(bx, by + 1, 9, pal[2]); P.hl(bx, by + 2, 9, pal[1]);
      P.px(bx, by + 1, pal[1]); P.px(bx + 8, by + 1, pal[0]); P.px(bx + 3, by, pal[4]); P.px(bx + 6, by + 1, pal[3]);
    }
  } else {
    const r = FRUIT_SIZE[kind] || 2.6, step = r * 1.75;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < Math.ceil(w / step) + 2; i++) {
        const cx = x0 - 1 + i * step + ((row & 1) ? step / 2 : 0), cy = y0 + r * 0.6 + row * r * 1.25 - (row < 2 ? bulge(cx) : 0);
        let pl = pal;
        if (kind === 'paprika') pl = [FR.tomat, FR.citron, FR.gurka][Math.floor(hash(i, row, seed) * 3)];
        if (kind === 'vmelon') fruit(P, cx, cy, r * 1.15, r * 0.85, pl, seed + i);
        else if (kind === 'champ') { fruit(P, cx, cy, r, r * 0.75, pl, seed + i); P.hl(Math.round(cx - r + 1), Math.round(cy + r * 0.5), Math.round(r * 2 - 1), pl[1]); }
        else fruit(P, cx, cy, r, r * (kind === 'avokado' || kind === 'paron' ? 1.15 : 0.95), pl, seed + i);
        if (kind === 'vmelon') for (let k = -3; k <= 3; k += 2) P.vl(Math.round(cx + k), Math.round(cy - r * 0.5), Math.round(r), pl[1]);
        if ((kind === 'applR' || kind === 'applG' || kind === 'paron' || kind === 'tomat' || kind === 'paprika') && hash(i, row, seed + 3) > 0.45) P.px(Math.round(cx), Math.round(cy - r), kind === 'tomat' || kind === 'paprika' ? 0x2e7a1e : 0x4a3a1a);
        if (kind === 'citron' || kind === 'lime') P.px(Math.round(cx + r - 0.5), Math.round(cy), pl[1]);
        if (kind === 'lok' || kind === 'rodlok') P.px(Math.round(cx), Math.round(cy - r - 0.5), pl[3]);
        if (kind === 'potatis' && hash(i, row, seed) > 0.5) P.px(Math.round(cx + 0.5), Math.round(cy), pl[0]);
      }
    }
  }
  P.clip();
}

// ================= varor på hyllorna =================
// Varje sort ritar EN förpackning som står på hyllplanet b (varan slutar på b − 1).
const DRINK = [[0xd8323a, 0x3a1a10], [0xf08a20, 0xf8a030], [0x46a35a, 0xd8e870], [0x3a7bd5, 0xcfe8f8], [0xf0b429, 0xf8d860], [0x8e5bd1, 0xc058a0]];
const PR = {
  can: { w: 4, h: 6, draw(P, x, b, c) {
    const r = rampOf(c);
    P.hl(x, b - 6, 4, STEEL[3]); P.px(x, b - 6, STEEL[4]); P.px(x + 3, b - 6, STEEL[1]);
    for (let y = b - 5; y < b - 1; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[2]); P.px(x + 3, y, r[1]); }
    P.px(x, b - 4, 0xffffff); P.px(x + 1, b - 4, 0xf4f1ea); P.px(x + 2, b - 4, 0xe0dcd2); P.px(x + 3, b - 4, 0xb0aca2);
    P.hl(x, b - 1, 4, STEEL[1]); P.px(x, b - 1, STEEL[2]);
  } },
  tin: { w: 6, h: 6, draw(P, x, b, c) {
    const r = rampOf(c);
    for (const y0 of [b - 6, b - 3]) {
      P.hl(x, y0, 5, STEEL[3]); P.px(x, y0, STEEL[4]); P.px(x + 4, y0, STEEL[1]);
      P.hl(x, y0 + 1, 5, r[2]); P.px(x, y0 + 1, r[3]); P.px(x + 4, y0 + 1, r[1]); P.px(x + 2, y0 + 1, 0xf4f1ea);
      P.hl(x, y0 + 2, 5, r[1]); P.px(x + 4, y0 + 2, r[0]);
    }
  } },
  jar: { w: 5, h: 8, draw(P, x, b, c) {
    const r = rampOf(c);
    P.hl(x, b - 8, 4, 0xe8c050); P.px(x, b - 8, 0xfff0a0); P.px(x + 3, b - 8, 0xa88020); P.hl(x, b - 7, 4, 0x8a6a20);
    for (let y = b - 6; y < b; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[2]); P.px(x + 3, y, r[1]); }
    P.hl(x, b - 4, 4, 0xf4ecd8); P.px(x + 3, b - 4, 0xc8bca0); P.px(x + 1, b - 4, mul(c, 0.8));
    P.vl(x, b - 6, 2, 0xffffff, 0.75); P.hl(x, b - 1, 4, r[0]);
  } },
  cereal: { w: 7, h: 9, draw(P, x, b, c, i) {
    const r = rampOf(c);
    for (let y = b - 9; y < b; y++) for (let k = 0; k < 6; k++) P.px(x + k, y, k === 0 ? r[3] : k === 5 ? r[1] : r[2]);
    P.hl(x, b - 9, 6, r[4]);
    P.hl(x + 1, b - 7, 4, i % 2 ? 0xf8e040 : 0xffffff); P.hl(x + 1, b - 6, 3, mul(c, 0.55));
    P.hl(x + 1, b - 4, 4, 0xf4f1ea); P.hl(x + 2, b - 3, 2, 0xd8d4ca);
    P.px(x + 1, b - 5, 0xe0a030); P.px(x + 2, b - 5, 0xf8d070); P.px(x + 3, b - 5, 0xc87a20); P.px(x + 4, b - 5, 0xe0a030);
    P.hl(x, b - 1, 6, r[0]);
  } },
  pbox: { w: 5, h: 7, draw(P, x, b, c) {
    const r = rampOf(c);
    for (let y = b - 7; y < b; y++) for (let k = 0; k < 5; k++) P.px(x + k, y, k === 0 ? r[3] : k === 4 ? r[1] : r[2]);
    P.hl(x, b - 7, 5, r[4]);
    P.rect(x + 1, b - 5, 3, 2, 0xf0e0b0); P.px(x + 2, b - 4, 0xd8c088); P.px(x + 3, b - 5, 0xffffff);
    P.hl(x, b - 1, 5, r[0]);
  } },
  bag: { w: 7, h: 8, draw(P, x, b, c) {
    const r = rampOf(c);
    for (let y = b - 8; y < b; y++) for (let k = 0; k < 6; k++) {
      if ((y === b - 8 || y === b - 1) && (k === 0 || k === 5)) continue;
      if (y === b - 8) { P.px(x + k, y, k % 2 ? r[4] : r[3]); continue; }
      P.px(x + k, y, k === 0 ? r[3] : k === 1 ? mix(r[2], r[3], 0.5) : k === 5 ? r[1] : r[2]);
    }
    P.hl(x + 1, b - 7, 4, r[1]);
    P.rect(x + 2, b - 5, 2, 2, 0xfaf2da); P.px(x + 3, b - 4, mul(c, 0.6));
    P.hl(x + 1, b - 1, 4, r[0]);
  } },
  sack: { w: 11, h: 9, draw(P, x, b, c) {
    const r = rampOf(mix(c, 0xe8dcc0, 0.6));
    for (let y = b - 9; y < b; y++) for (let k = 0; k < 10; k++) {
      if (y === b - 9 && (k < 2 || k > 7)) continue;
      P.px(x + k, y, k < 2 ? r[3] : k > 8 ? r[1] : (k + y) % 5 === 0 ? mix(r[2], r[1], 0.5) : r[2]);
    }
    P.hl(x + 2, b - 9, 6, r[4]); P.rect(x + 2, b - 6, 6, 3, c); P.hl(x + 2, b - 6, 6, rampOf(c)[3]);
    P.hl(x, b - 1, 10, r[0]);
  } },
  bottle: { w: 4, h: 10, draw(P, x, b, c, i) {
    const [lab, liq] = DRINK[i % DRINK.length];
    const L = rampOf(liq), r = rampOf(lab);
    P.px(x + 1, b - 10, i % 2 ? 0xd8323a : 0xf4f1ea); P.px(x + 1, b - 9, L[3]);
    P.px(x, b - 8, L[3]); P.px(x + 1, b - 8, L[2]); P.px(x + 2, b - 8, L[1]);
    for (let y = b - 7; y < b; y++) { P.px(x, y, L[3]); P.px(x + 1, y, L[2]); P.px(x + 2, y, L[1]); }
    P.hl(x, b - 5, 3, r[2]); P.px(x, b - 5, r[3]); P.px(x + 2, b - 5, r[1]); P.hl(x, b - 4, 3, r[2]); P.px(x + 2, b - 4, r[1]);
    P.px(x, b - 7, 0xffffff, 0.8); P.hl(x, b - 1, 3, L[0]);
  } },
  carton: { w: 5, h: 9, draw(P, x, b, c) {
    const r = rampOf(c);
    P.hl(x + 1, b - 9, 2, 0xe0e0da);
    P.hl(x, b - 8, 4, 0xf4f4ee); P.px(x + 3, b - 8, 0xc8c8c0);
    for (let y = b - 7; y < b; y++) { P.px(x, y, 0xffffff); P.px(x + 1, y, 0xf4f4ee); P.px(x + 2, y, 0xf0f0ea); P.px(x + 3, y, 0xc8c8c0); }
    P.hl(x, b - 7, 4, c); P.px(x + 3, b - 7, r[1]);
    P.rect(x + 1, b - 5, 2, 2, c); P.px(x + 1, b - 5, r[3]);
    P.hl(x, b - 2, 4, r[2]); P.px(x + 3, b - 2, r[1]);
    P.hl(x, b - 1, 4, 0xa8a8a0);
  } },
  six: { w: 10, h: 7, draw(P, x, b, c) {
    const r = rampOf(c);
    for (let k = 0; k < 3; k++) {
      const cx = x + k * 3;
      P.hl(cx, b - 7, 3, STEEL[3]); P.px(cx + 2, b - 7, STEEL[1]);
      for (let y = b - 6; y < b - 1; y++) { P.px(cx, y, r[3]); P.px(cx + 1, y, r[2]); P.px(cx + 2, y, r[1]); }
    }
    P.hl(x, b - 4, 9, 0xffffff, 0.5); P.px(x + 4, b - 5, 0xffffff);
    P.hl(x, b - 1, 9, r[0]); P.hl(x, b - 6, 9, 0xffffff, 0.18);
  } },
  coffee: { w: 5, h: 8, draw(P, x, b, c) {
    const r = rampOf(c);
    for (let y = b - 8; y < b; y++) for (let k = 0; k < 4; k++) P.px(x + k, y, k === 0 ? r[3] : k === 3 ? r[1] : r[2]);
    P.hl(x, b - 8, 4, r[4]); P.hl(x, b - 5, 4, 0xe8c050); P.px(x + 3, b - 5, 0xa88020);
    P.px(x + 1, b - 3, 0x6a3a1a); P.px(x + 2, b - 3, 0x9a5a2a);
    P.hl(x, b - 1, 4, r[0]);
  } },
  cookies: { w: 7, h: 8, draw(P, x, b, c) {
    const r = rampOf(c);
    for (const y0 of [b - 8, b - 4]) {
      for (let y = y0; y < y0 + 4; y++) for (let k = 0; k < 6; k++) P.px(x + k, y, k === 0 ? r[3] : k === 5 ? r[1] : r[2]);
      P.hl(x, y0, 6, r[4]); P.hl(x + 1, y0 + 1, 4, 0xd89a50); P.px(x + 2, y0 + 1, 0x8a5a2a); P.px(x + 4, y0 + 2, 0xf0c080); P.hl(x, y0 + 3, 6, r[1]);
    }
  } },
  knacke: { w: 10, h: 8, draw(P, x, b, c) {
    for (const y0 of [b - 8, b - 4]) {
      P.hl(x, y0, 9, 0xf0d8a0); P.px(x, y0, 0xfff0c8);
      P.hl(x, y0 + 1, 9, 0xd8b070); P.hl(x + 2, y0 + 1, 5, c); P.px(x + 4, y0 + 1, 0xffffff);
      P.hl(x, y0 + 2, 9, 0xc89a58); P.hl(x, y0 + 3, 9, 0x8a6a3a);
      for (let k = 1; k < 9; k += 3) P.px(x + k, y0 + 2, 0xa07a40);
    }
  } },
  candy: { w: 5, h: 7, draw(P, x, b, c) {
    const r = rampOf(c);
    for (let y = b - 7; y < b; y++) for (let k = 0; k < 4; k++) P.px(x + k, y, k === 0 ? r[3] : k === 3 ? r[1] : r[2]);
    P.hl(x, b - 7, 4, r[4]);
    P.rect(x + 1, b - 5, 2, 3, 0xffffff); P.px(x + 1, b - 5, 0xd8323a); P.px(x + 2, b - 4, 0x46a35a); P.px(x + 1, b - 3, 0xf0b429);
    P.hl(x, b - 1, 4, r[0]);
  } },
  choc: { w: 7, h: 8, draw(P, x, b, c) {
    const r = rampOf(c);
    for (let k = 0; k < 4; k++) { const y0 = b - 2 - k * 2; P.hl(x, y0, 6, k % 2 ? r[2] : r[3]); P.px(x + 5, y0, r[1]); P.hl(x, y0 + 1, 6, r[1]); P.px(x + 2, y0, 0xf0e0b0); }
  } },
  tp: { w: 12, h: 9, draw(P, x, b) {
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) {
      const cx = x + k * 4, cy = b - 9 + j * 4;
      P.rect(cx, cy, 4, 4, 0xf4f4f0); P.hl(cx, cy, 4, 0xffffff); P.vl(cx + 3, cy, 4, 0xc8ccd4); P.px(cx + 1, cy + 1, 0xd8dce4); P.px(cx + 2, cy + 2, 0xa8b0bc);
    }
    P.hl(x, b - 5, 12, 0x3a7bd5); P.hl(x, b - 1, 12, 0x9aa4b0); P.hl(x + 3, b - 5, 5, 0xffffff);
  } },
  deterg: { w: 6, h: 9, draw(P, x, b, c) {
    const r = rampOf(c);
    P.hl(x + 3, b - 9, 2, 0xf4f1ea); P.px(x + 4, b - 8, r[1]); P.px(x + 1, b - 8, r[3]); P.px(x + 2, b - 8, r[2]);
    for (let y = b - 7; y < b; y++) for (let k = 0; k < 5; k++) P.px(x + k, y, k === 0 ? r[3] : k === 4 ? r[1] : r[2]);
    P.rect(x + 1, b - 5, 3, 3, 0xffffff); P.px(x + 2, b - 4, c);
    P.hl(x, b - 1, 5, r[0]);
  } },
  cup: { w: 6, h: 7, draw(P, x, b, c) {
    const r = rampOf(c);
    P.hl(x, b - 7, 5, 0xe6ecf0); P.px(x, b - 7, 0xffffff); P.px(x + 4, b - 7, 0xa8b0b8);
    P.hl(x, b - 6, 5, c); P.px(x, b - 6, r[3]); P.px(x + 4, b - 6, r[1]);
    for (let y = b - 5; y < b; y++) { const n = y >= b - 2 ? 1 : 0; for (let k = n; k < 5 - n; k++) P.px(x + k, y, k === n ? 0xffffff : k === 4 - n ? 0xc8c4bc : 0xf2eee6); }
    P.px(x + 2, b - 4, c); P.px(x + 1, b - 3, 0xf0b429); P.px(x + 3, b - 3, 0xf0b429); P.px(x + 2, b - 2, r[1]);
  } },
};
// fyll ett hyllplan med "facings": grupper om 3–6 likadana förpackningar
function stockShelf(P, x0, x1, b, kinds, seed, lip = true) {
  let x = x0 + 1, i = 0;
  while (x < x1 - 3) {
    const kind = kinds[Math.floor(hash(i, seed, 3) * kinds.length)];
    const pr = PR[kind], c = PACKS[Math.floor(hash(i, seed, 5) * PACKS.length)];
    const n = 2 + Math.floor(hash(i, seed, 7) * 4);
    const start = x;
    for (let k = 0; k < n && x + pr.w - 1 <= x1 - 1; k++) { pr.draw(P, x, b, c, i + k * 0); x += pr.w; }
    if (lip && x > start) { // liten hyllkantsetikett under varje facing
      const yel = hash(i, seed, 9) > 0.82;
      P.rect(start + 1, b + 1, 4, 2, yel ? 0xf8d838 : 0xf4f4f0); P.px(start + 2, b + 2, yel ? 0xc0202a : 0x3a3e48);
    }
    x += 1 + (hash(i, seed, 11) > 0.7 ? 1 : 0);
    i++;
  }
}

// ================= matens små ikoner (korgen, kvittot, rullbandet) =================
const ICONS = {
  nudlar: { pal: { k: OUT, s: 0xe6ecf0, S: 0xffffff, r: 0xd8323a, R: 0x8a1a22, w: 0xf2eee6, W: 0xc8c4bc, y: 0xf0b429 }, map: [
    '.kkkkkkk.', 'kSsssssWk', '.krrrrrk.', '.kwwwwWk.', '.kwyrywk.', '.kwwwwWk.', '..kwwWk..', '..kkkkk..'] },
  macka: { pal: { k: OUT, b: 0xe0a858, B: 0xf8d898, d: 0xa86a2a, g: 0x5ab83a, G: 0x9ae060, y: 0xf8d040, Y: 0xfff0a0, r: 0xd84a3a }, map: [
    '..kkkkk..', '.kbBBBbk.', 'kbBBbbbdk', 'kGgGgrgGk', 'kyYyyyyyk', 'kbbbbbbdk', '.kddddk..', '..kkkk...'] },
  korv: { pal: { k: OUT, b: 0xe0a858, B: 0xf8d898, d: 0xa86a2a, r: 0xb84a2a, R: 0xe07a4a, y: 0xf8d020 }, map: [
    '.........', '.kkkkkkk.', 'kbBBBBBbk', 'kRyrryrRk', 'krrrrrrrk', 'kbbbbbbdk', '.kddddddk', '..kkkkkk.'] },
  pizza: { pal: { k: OUT, c: 0xc8883a, C: 0xe8b060, y: 0xf8d040, Y: 0xfff0a0, r: 0xc82a2a, g: 0x4a9a2a }, map: [
    'kkkkkkkkk', 'kCCCCCCck', '.kYyryYk.', '.kyyyrgk.', '..kyryk..', '..kyyk...', '...kyk...', '....k....'] },
  lyx: { pal: { k: OUT, w: 0xf4f1ea, W: 0xd8d4c8, o: 0xf08a50, O: 0xffb88a, g: 0x4a9a2a, G: 0x7ac050, y: 0xf8d040, Y: 0xfff0a0, K: 0x3a3440 }, map: [
    'kkkkkkkkk', 'kwWwKOooK', 'kwwWKoOok', 'kKKKKKKKk', 'kgGgKyYyk', 'kGggKyyYk', 'kkkkkkkkk', '.........'] },
};
function iconFor(id) {
  if (ICONS[id]) return ICONS[id];
  // okänd rätt (ny i FOOD): en färgad förpackning med vit etikett
  const c = PACKS[Math.floor(hash(id.length, id.charCodeAt(0), 5) * PACKS.length)];
  const r = rampOf(c);
  return { pal: { k: OUT, a: r[3], b: r[2], c: r[1], w: 0xf4f1ea }, map: ['.kkkkkkk.', 'kaaaaaabk', 'kabbbbbck', 'kawwwwwck', 'kabbbbbck', 'kabbbbbck', 'kcccccccck', '.kkkkkkk.'] };
}
function drawIcon(ctx, id, x, y) {
  const ic = iconFor(id);
  ic.map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || !(ch in ic.pal)) continue; ctx.fillStyle = hexs(ic.pal[ch]); ctx.fillRect(x + i, y + j, 1, 1); } });
}
const SHORT = { nudlar: 'NUDLAR', macka: 'OSTMACKA', korv: 'KORV', pizza: 'PIZZA', lyx: 'LYXLÅDA' };
const shortName = (f) => SHORT[f.id] || f.name.toUpperCase().replace(/[^A-ZÅÄÖÉ0-9 ]/g, '').slice(0, 10).trim();
const priceLbl = (n) => `${n}:-`;

// ================= var maten står =================
// Fasta platser för rätterna i FOOD; nya rätter (utan egen plats) får en reservplats.
const FIXED = {
  nudlar: { kind: 'gondola', g: 0, dx: 78, w: 36, prod: 'cup', colors: [0xd8323a, 0xe07a2e] },
  pizza: { kind: 'freezer', f: 0, sec: 0 },
  lyx: { kind: 'dairy', door: 5 },
  macka: { kind: 'sandw' },
  korv: { kind: 'grill' },
};
const SPARE = [
  { kind: 'gondola', g: 5, dx: 78, w: 36, prod: 'gen' }, { kind: 'gondola', g: 4, dx: 78, w: 36, prod: 'gen' },
  { kind: 'gondola', g: 3, dx: 78, w: 36, prod: 'gen' }, { kind: 'gondola', g: 2, dx: 78, w: 36, prod: 'gen' },
  { kind: 'gondola', g: 1, dx: 78, w: 36, prod: 'gen' }, { kind: 'freezer', f: 1, sec: 2 }, { kind: 'freezer', f: 1, sec: 0 },
];
const FSEC = (F) => (F.x1 - F.x0) / F.secs.length;
function layoutFood() {
  const spare = [...SPARE], out = [];
  for (const f of FOOD) {
    const d = FIXED[f.id] || spare.shift();
    if (!d) continue;
    const s = { f, d };
    if (d.kind === 'gondola') {
      const G = GONDOLAS[d.g], x = G.x0 + d.dx;
      s.tag = [x + d.w / 2, G.base - 66];
      s.r = [x - 2, G.base - 68, x + d.w + 2, G.base];
      s.glow = [x - 1, G.base - 36, d.w + 2, 32];
      s.go = [x + d.w / 2 + 24, G.base + 11];
    } else if (d.kind === 'freezer') {
      const F = FREEZERS[d.f], sw = FSEC(F), x = F.x0 + d.sec * sw;
      s.tag = [x + sw / 2, F.base - 62];
      s.r = [x, F.base - 64, x + sw, F.base];
      s.glow = [x + 2, F.base - 38, sw - 4, 20];
      s.go = [x + sw / 2 + 24, F.base + 11];
    } else if (d.kind === 'dairy') {
      const x = DAIRY.x0 + d.door * DAIRY.dw;
      s.tag = [x + DAIRY.dw / 2, DAIRY.top + 5];
      s.r = [x, DAIRY.top, x + DAIRY.dw, DAIRY.base];
      s.glow = [x + 2, 34, DAIRY.dw - 4, 46];
      s.go = [x + DAIRY.dw / 2, DAIRY.base + 13];
    } else if (d.kind === 'sandw') {
      s.tag = [(SANDW.x0 + SANDW.x1) / 2, SANDW.top + 12];
      s.r = [SANDW.x0, SANDW.top - 10, SANDW.x1, SANDW.base];
      s.glow = [SANDW.x0 + 3, 44, SANDW.x1 - SANDW.x0 - 6, 34];
      s.go = [(SANDW.x0 + SANDW.x1) / 2 - 10, SANDW.base + 13];
    } else if (d.kind === 'grill') {
      s.tag = [GRILL.x0 + 22, GRILL.base - 58];
      s.r = [GRILL.x0 + 2, GRILL.base - 60, GRILL.x0 + 61, GRILL.base];
      s.glow = [GRILL.x0 + 6, GRILL.base - 34, 36, 14];
      s.go = [GRILL.x0 + 22, GRILL.base + 11];
    }
    out.push(s);
  }
  return out;
}

// ================= förmålade bilder =================
let ART = null;
function art() {
  if (ART) return ART;
  const displays = layoutFood();
  ART = {
    displays,
    bg: paintBackground(displays),
    islands: ISLANDS.map((isl, i) => paintIsland(isl, i)),
    gondolas: GONDOLAS.map((G, i) => paintGondola(G, i, displays)),
    freezers: FREEZERS.map((F, i) => paintFreezer(F, i, displays)),
    kassor: KASSOR.map((K) => paintKassa(K)),
    candy: KASSOR.map((K, i) => paintCandyRack(K.x1 + 2, K.base, i)),
    drop: paintBasketDrop(),
    grill: paintGrill(displays),
    bar: paintBar(),
    stool: paintStool(),
    carts: paintCarts(),
    baskets: paintBasketStack(),
    pant: paintPant(),
    pallet: paintPallet(),
    flowers: paintFlowers(),
    aframe: paintAFrame(),
    mags: paintMags(),
    wet: paintWet(),
    bins: paintBins(),
    plant: paintPlant(),
    scale: paintScale(),
    cage: paintCage(),
    front: paintFront(),
    glowCool: paintGlowSprite(30, 10, 0xd8f0ff),
    glowWarm: paintGlowSprite(26, 12, 0xffb050),
    doorPanel: paintDoorPanel(),
  };
  return ART;
}
function paintGlowSprite(rx, ry, c) {
  const P = new Pix(rx * 2 + 2, ry * 2 + 2);
  P.ell(rx + 1, ry + 1, rx, ry, c, 0.5, 4);
  return P.flush();
}

// ---------- golvet ----------
// värdebrus (mjukt) – samma recept som stadens mark
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
// glidande ton ur en palett (golven får brus i stället för rutig dithering)
function ramp(pal, v) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1), i = Math.floor(f);
  return mix(pal[i], pal[Math.min(pal.length - 1, i + 1)], f - i);
}
// gångstråken där folk (och kundvagnar) nött golvet: [x0, y0, x1, y1, halva bredden]
const WEAR = [
  // frukt och grönt
  [14, 97, 236, 97, 7], [120, 100, 120, 246, 9], [14, 158, 238, 158, 8], [14, 230, 240, 230, 9], [230, 100, 230, 246, 7],
  // vinylen: in från dörren, tvärgången, kassorna, gångarna mellan hyllorna
  [DOOR_X, FRONT_Y, DOOR_X, 262, 15], [14, 296, 556, 296, 11], [150, 360, 430, 360, 10], [DOOR_X, 372, 330, 362, 9],
  [396, 96, 396, 300, 9], [557, 96, 557, 240, 10], [246, 96, 246, 300, 6], [250, 94, 540, 94, 7],
  [252, 162, 540, 162, 7], [252, 226, 540, 226, 7], [574, 164, 756, 164, 7], [574, 228, 756, 228, 6],
  // bageriet och kaféet
  [552, 100, 756, 100, 8], [548, 318, 756, 314, 11], [590, 358, 756, 358, 7],
];
function wearAt(x, y) {
  let w = 0;
  for (const [ax, ay, bx, by, r] of WEAR) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1) : 0;
    const d = Math.hypot(x - ax - dx * t, y - ay - dy * t) / r;
    if (d < 1) w = Math.max(w, 1 - d * d);
  }
  return w * (0.45 + vnoise(x, y, 9, 61) * 0.55); // fläckigt, inte en jämn matta
}
// butiksvinyl: plattor med egen ton, inbakade flingor, smuts i fogarna och gångslitage
function vinyl(x, y) {
  const yy = y - WALL_Y, tx = x >> 4, ty = yy >> 4, lx = x & 15, ly = yy & 15;
  let c = (tx + ty) & 1 ? 0xe8e5dc : 0xdedacf;
  if ((ty % 6 === 5) && (tx % 2 === 0)) c = 0xc8d8cc; // en grön accentplatta ibland
  c = mul(c, 0.975 + hash(tx, ty, 8) * 0.05);                    // varje platta har sin egen ton
  c = mul(c, 1 + (vnoise(x, y, 22, 64) - 0.5) * 0.06 + (vnoise(x, y, 5, 67) - 0.5) * 0.03); // molnigt
  const n = hash(x, y, 7);
  if (n > 0.972) c = mix(c, 0x8e887c, 0.42);                     // mörka flingor
  else if (n > 0.95) c = mix(c, 0xb8b0a0, 0.4);
  else if (n > 0.935) c = mix(c, 0x9ab0a0, 0.25);                // gröngrå
  else if (n < 0.022) c = mix(c, 0xffffff, 0.55);                // vita
  if (lx === 0 || ly === 0) {                                    // fogen – smutsigare här och där
    c = mix(c, 0x9e988c, 0.5);
    if (vnoise(x, y, 7, 65) > 0.58) c = mix(c, 0x6e685e, 0.35);
  } else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.28);
  else if (lx === 15 || ly === 15) c = mul(c, 0.975);
  else if (lx === 2 && ly === 2) c = mix(c, 0xffffff, 0.35);     // glans i plattans hörn
  const w = wearAt(x, y);
  if (w > 0) c = mix(c, (tx + ty) & 1 ? 0xc4beb2 : 0xbcb6aa, w * 0.3);
  return mul(c, 0.985 + hash(x, y, 66) * 0.03);
}
// trägolv: långa plankor i förband, ådring längs plankan, kvistar, mjuka fogar och slitage
function plank(x, y, pal, seed) {
  const PH = 7, yy = y - WALL_Y, row = Math.floor(yy / PH), ly = yy - row * PH;
  const off = (hash(row, 3, seed) * 97) | 0, len = 58 + ((hash(row, 4, seed) * 52) | 0);
  const seg = Math.floor((x + off) / len), lx = x + off - seg * len;
  const ps = hash(seg, row, seed + 2); // plankans eget virke
  let v = 0.5 + (ps - 0.5) * 0.3;
  // ådringen: tunna stråk längs plankan som böljar lite, plus långsträckt brus
  const gy = ly + Math.sin((lx + ps * 40) * 0.085) * 1.3;
  let grain = Math.sin(gy * 2.2 + ps * 9) * 0.06 + (vnoise(x * 0.14 + seg * 31, y * 1.1, 1, seed + 3) - 0.5) * 0.16;
  // kvistar med årsringar runt
  if (ps > 0.58) {
    const kx = 10 + ((hash(seg, row, seed + 6) * (len - 20)) | 0), ky = 2 + ((hash(seg, row, seed + 7) * 3) | 0);
    const d = Math.hypot((lx - kx) / 2.1, ly - ky);
    if (d < 1) grain -= 0.3 - d * 0.1;
    else if (d < 3.2) grain += Math.cos(d * 3.4) * 0.07 - 0.03;
  }
  const w = wearAt(x, y);
  v += grain * (1 - w * 0.55) + (hash(x, y, seed) - 0.5) * 0.05;
  v += w * 0.08;                                  // lacken nött – ljusare och mattare
  // fogarna: mörk springa nedtill och i plankändarna, ljus fas upptill
  if (ly === PH - 1) v = v * 0.55 - 0.04;
  else if (ly === 0) v += 0.07;
  if (lx === len - 1) v = v * 0.55 - 0.03;
  else if (lx === 0) v += 0.05;
  let c = ramp(pal, v);
  if (w > 0) c = mix(c, 0xb8ac98, w * 0.16);
  return mul(c, 0.97 + hash(x, y, seed + 9) * 0.06);
}
function terracotta(x, y) {
  const lx = x % 10, ly = (y - WALL_Y) % 10, tx = Math.floor(x / 10), ty = Math.floor((y - WALL_Y) / 10);
  if (lx === 0 || ly === 0) return mul(0x9a7a62, 0.92 + hash(x, y, 23) * 0.12 - (vnoise(x, y, 6, 24) > 0.62 ? 0.12 : 0));
  let c = mix(0xc0684a, 0xa85236, hash(tx, ty, 21) * 0.7);
  c = mul(c, 1 + (vnoise(x, y, 4, 25) - 0.5) * 0.1);
  if (lx === 1 || ly === 1) c = mix(c, 0xffd0b0, 0.2);
  if (lx === 9 || ly === 9) c = mul(c, 0.86);
  // kantstötta hörn på en del plattor
  if (hash(tx, ty, 26) > 0.7 && ((lx === 1 && ly <= 2) || (ly === 1 && lx <= 2))) c = 0x9a7a62;
  const n = hash(x, y, 22);
  if (n > 0.93) c = mul(c, 0.88); else if (n < 0.03) c = mix(c, 0xffd8c0, 0.35);
  const w = wearAt(x, y);
  if (w > 0) c = mix(c, 0xc89a80, w * 0.22);
  return mul(c, 0.975 + hash(x, y, 27) * 0.05);
}
// skosulornas svarta streck och kundvagnshjulens spår på vinylen (tätast i gångstråken)
function paintScuffs(P) {
  for (let i = 0; i < 520; i++) {
    const x = SIDE + 2 + ((hash(i, 1, 81) * (W - SIDE * 2 - 4)) | 0), y = WALL_Y + 20 + ((hash(i, 2, 81) * (FRONT_Y - WALL_Y - 26)) | 0);
    if (zoneAt(x, y) !== 'vinyl') continue;
    if (hash(i, 3, 81) > 0.12 + wearAt(x, y) * 0.9) continue;
    const len = 3 + ((hash(i, 4, 81) * 6) | 0), a0 = hash(i, 5, 81) * Math.PI, bend = (hash(i, 6, 81) - 0.5) * 0.45;
    const a = 0.16 + hash(i, 7, 81) * 0.24;
    for (let k = 0; k < len; k++) {
      const ang = a0 + bend * k, px = Math.round(x + Math.cos(ang) * k), py = Math.round(y + Math.sin(ang) * k * 0.55);
      P.px(px, py, 0x2e2a2a, a * (k === 0 || k === len - 1 ? 0.55 : 1));
    }
  }
  // hjulspår från vagnparken in i butiken: två svaga parallella streck som svänger
  for (let k = 0; k < 150; k++) {
    const t = k / 150, x = CARTS.x1 + 8 + t * 150, y = CARTS.base - 26 - Math.sin(t * Math.PI) * 40;
    if (hash(k, 1, 83) < 0.3) continue;
    P.px(Math.round(x), Math.round(y), 0x3a3636, 0.12); P.px(Math.round(x), Math.round(y) + 7, 0x3a3636, 0.12);
  }
}
// småskräp och fläckar som gör golvet levande
function paintDebris(P) {
  const leaf = (x, y, c, flip) => { P.px(x, y, c); P.px(x + (flip ? -1 : 1), y, mix(c, 0xffffff, 0.25)); P.px(x + (flip ? -1 : 1) * 2, y - 1, c); P.px(x, y + 1, mul(c, 0.6), 0.5); };
  const stain = (cx, cy, rx, ry, c, a, seed) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (hash(x, y, seed) - 0.5) * 0.35;
      if (t < 1) P.px(x, y, c, a * (t > 0.75 ? 1.3 : 0.8));
    }
  };
  // frukt och grönt: tappade blad, en druva, en mosad tomat och en prislapp
  leaf(116, 152, 0x4a9a3a); leaf(72, 236, 0x5ab83a, true); leaf(226, 104, 0x3a8a2a); leaf(160, 164, 0x6aa83a);
  P.rect(228, 178, 2, 2, 0x6a2a6a); P.px(228, 178, 0xb87ab8); P.px(229, 180, 0x2a1030, 0.4);   // druva
  stain(142, 233, 3, 1.4, 0x8a1a10, 0.45, 91); P.px(141, 233, 0xd8403a); P.px(143, 232, 0x5a8a2a); // mosad tomat
  P.hl(64, 160, 3, 0xf8f4ea); P.px(66, 161, 0xc8c0b0); P.px(65, 160, 0xd83a2a);                   // prislapp
  // vinylen: kvitto vid kassan, en kapsyl, tuggummin och en blöt fläck från moppen
  P.rect(404, 366, 6, 3, 0xf8f6f0); P.hl(405, 367, 4, 0xb8b4ac); P.px(409, 368, 0xd8d4cc); P.hl(404, 369, 6, 0x4a4640, 0.2);
  P.rect(322, 252, 2, 2, 0xd8323a); P.px(322, 252, 0xff8a80); P.px(324, 253, 0x3a1010, 0.3);
  for (const [gx, gy] of [[188, 280], [470, 300], [264, 318], [520, 186], [150, 372], [440, 236]]) { P.hl(gx, gy, 2, 0x4a4648, 0.8); P.px(gx, gy + 1, 0x2a2628, 0.35); }
  stain(WET.x + 4, WET.base - 8, 14, 4, 0x8ab0c8, 0.2, 93); P.px(WET.x - 2, WET.base - 10, 0xffffff, 0.8); P.px(WET.x + 8, WET.base - 7, 0xffffff, 0.7);
  // kaféet: kaffestänk, smulor under pallarna och ett sockerpaket
  stain(646, 308, 2.5, 1.2, 0x2a1408, 0.45, 95); stain(652, 310, 1.2, 0.8, 0x2a1408, 0.4, 96);
  for (let i = 0; i < 26; i++) { const x = 604 + ((hash(i, 1, 97) * 144) | 0), y = 380 + ((hash(i, 2, 97) * 6) | 0); P.px(x, y, hash(i, 3, 97) > 0.5 ? 0xe0b070 : 0xc8904a); }
  P.rect(700, 344, 3, 2, 0xf4f1ea); P.px(702, 345, 0x3a7bd5);
  // bageriet: mjöldamm
  for (let i = 0; i < 60; i++) { const x = 560 + ((hash(i, 1, 99) * 130) | 0), y = 88 + ((hash(i, 2, 99) * 24) | 0); P.px(x, y, 0xfff6ea, 0.25 + hash(i, 3, 99) * 0.3); }
}
const zoneAt = (x, y) => (x < 240 && y < 246 ? 'frukt' : x >= 560 && y >= 240 ? 'kafe' : x >= 546 && y < 118 ? 'bageri' : 'vinyl');
function paintFloor(P) {
  for (let y = WALL_Y; y < FRONT_Y; y++) for (let x = 0; x < W; x++) {
    const z = zoneAt(x, y);
    P.px(x, y, z === 'frukt' ? plank(x, y, OAK, 11) : z === 'kafe' ? plank(x, y, WALNUT, 31) : z === 'bageri' ? terracotta(x, y) : vinyl(x, y));
  }
  // övergångslister i aluminium mellan golven
  const strip = (x0, y0, x1, y1) => {
    if (x0 === x1) for (let y = y0; y < y1; y++) { P.px(x0, y, STEEL[4]); P.px(x0 + 1, y, STEEL[2]); }
    else for (let x = x0; x < x1; x++) { P.px(x, y0, STEEL[4]); P.px(x, y0 + 1, STEEL[2]); }
  };
  strip(240, WALL_Y, 240, 246); strip(0, 246, 241, 246);
  strip(560, 240, 560, FRONT_Y); strip(560, 240, W, 240);
  strip(546, WALL_Y, 546, 118); strip(546, 118, W, 118);
  paintScuffs(P);
  paintDebris(P);
  // kassaköns gröna golvlinje och "VÄNTA HÄR"-streck
  for (const K of KASSOR) {
    // ståmatta i gummi där kunden står och betalar
    const m0 = K.x0 + 20, m1 = K.x0 + 80, my0 = K.base + 3, my1 = K.base + 19;
    for (let y = my0; y < my1; y++) for (let x = m0; x < m1; x++) {
      let c = ((x + y) & 1) ? 0x3a3e46 : 0x30343c;
      if ((x - m0) % 3 === 1 && (y - my0) % 3 === 1) c = 0x4a4e58; // noppor
      if (x === m0 || y === my0) c = 0x5a5e68; else if (x === m1 - 1 || y === my1 - 1) c = 0x1e2026;
      P.px(x, y, c);
    }
    P.hl(m0 + 1, my0, m1 - m0 - 2, 0x6a7078);
    for (let x = K.x0 - 4; x < K.x1 + 18; x++) { P.px(x, K.base + 22, GREEN); P.px(x, K.base + 23, GREEN_DK, 0.6); }
    for (let x = K.x0 + 8; x < K.x0 + 40; x += 4) { P.hl(x, K.base + 34, 2, 0xf0c020); }
  }
  // dörrmattan innanför skjutdörrarna
  const mx0 = DOOR.x0 - 6, mx1 = DOOR.x1 + 6, my0 = FRONT_Y - 30;
  for (let y = my0; y < FRONT_Y; y++) for (let x = mx0; x < mx1; x++) {
    let c = (x - mx0) % 3 === 0 ? 0x2a2e36 : 0x3a3e48;
    if (x < mx0 + 2 || x >= mx1 - 2 || y < my0 + 2) c = GREEN_DK;
    if (hash(x, y, 51) > 0.9) c = mix(c, 0x5a5e68, 0.5);
    P.px(x, y, c);
  }
  P.hl(mx0, my0, mx1 - mx0, GREEN);
  centerText(P, SM, 'VÄLKOMMEN', DOOR_X, my0 + 6, 0xf4f1ea);
  // pil ut
  for (let k = 0; k < 4; k++) P.hl(DOOR_X - k, my0 + 16 + k, 1 + k * 2, GREEN_HI);
  P.rect(DOOR_X - 1, my0 + 13, 3, 3, GREEN_HI);
  // spegling av taklamporna i det blanka golvet: ljusa, dithrade fläckar
  for (let y = 108; y < FRONT_Y; y += 64) for (let x = 40; x < W; x += 64) {
    const ex = x + ((y / 64) & 1) * 32;
    if (zoneAt(ex - 19, y) !== 'vinyl' || zoneAt(ex + 19, y) !== 'vinyl' || ex + 19 >= W - SIDE) continue;
    P.ell(ex, y, 18, 5, 0xffffff, 0.22, 4);
    P.ell(ex, y, 8, 2, 0xffffff, 0.3, 3);
  }
}
// kylarnas och hyllornas spegling i golvet
function floorReflect(P, x0, x1, base, n = 8, a = 0.16) {
  for (let x = x0; x < x1; x++) for (let k = 0; k < n; k++) {
    const c = P.get(x, base - 2 - k);
    if (bayer(x, base + k) < 0.5 + k * 0.05) P.px(x, base + k, c, a * (1 - k / n));
  }
}

// ---------- bakväggen ----------
function paintWall(P) {
  // tak med akustikplattor
  for (let y = 0; y < 9; y++) for (let x = 0; x < W; x++) {
    let c = mix(0x464a54, 0x3a3e48, y / 9);
    if (x % 32 === 0 || y === 4) c = 0x2e323a;
    if (hash(x, y, 61) > 0.9) c = mix(c, 0x5a5e68, 0.5);
    P.px(x, y, c);
  }
  // väggzoner
  for (let y = 9; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < 238) { // vitt kakel med gröna fogar
      const row = Math.floor((y - 9) / 4), off = (row & 1) * 4, lx = (x + off) % 8, ly = (y - 9) % 4;
      c = mix(0xeef4ec, 0xdde8dc, hash(Math.floor((x + off) / 8), row, 62) * 0.6);
      if (ly === 3 || lx === 7) c = 0xa8c4ac; else if (ly === 0) c = mix(c, 0xffffff, 0.5);
    } else if (x < 512) { // mejeriet: ljusblå puts
      c = mix(0xd4e4f0, 0xc2d6e6, qd((y - 9) / 60, x, y, 3) * 0.7 + hash(x >> 1, y >> 1, 63) * 0.2);
    } else if (x < 548) {
      c = mix(0xe4ddd0, 0xd4ccbe, hash(x >> 1, y >> 1, 64) * 0.4);
    } else { // bageriet: rött tegel
      const X = x, Y = y, row = Math.floor(Y / 4), off = (row & 1) * 4, col = Math.floor((X + off) / 8), bx = (X + off) % 8, by = Y % 4;
      if (by === 3 || bx === 7) c = hash(X, Y, 65) > 0.7 ? 0xb8ac9c : 0xcabfae;
      else {
        c = mul(0xa8563a, 0.84 + hash(col, row, 66) * 0.3);
        if (hash(col, row, 67) > 0.88) c = mix(c, 0x5a2a22, 0.35);
        if (by === 0) c = mix(c, 0xffe8d0, 0.16);
      }
    }
    P.px(x, y, c);
  }
  // ventilationstrumma och rött sprinklerrör längs taket
  for (let x = 0; x < W; x++) {
    P.px(x, 9, 0xc03030); P.px(x, 10, 0x7a1818);
    P.px(x, 11, STEEL[4]); P.px(x, 12, STEEL[3]); P.px(x, 13, STEEL[2]); P.px(x, 14, STEEL[1]);
    if (x % 40 === 0) { P.vl(x, 11, 4, STEEL[0]); P.vl(x + 1, 11, 4, STEEL[3]); }
  }
  for (let x = 20; x < W; x += 40) P.darken(x, 15, 18, 1, 0.85);
  for (let x = 60; x < W; x += 160) { P.rect(x, 10, 2, 2, 0xe0e0e0); P.px(x, 12, 0xc03030); } // sprinklerhuvuden
  // lysrörsarmaturer i taket + ljuskäglor på väggen
  for (let x = 20; x < W; x += 64) {
    P.ell(x + 14, 22, 30, 22, 0xfffbe8, 0.16, 4);
    P.rect(x, 2, 28, 5, 0x2a2e36); P.rect(x + 1, 3, 26, 3, 0xfffbe8); P.hl(x + 1, 3, 26, 0xffffff); P.hl(x + 1, 5, 26, 0xe8e4d0);
    for (let k = 7; k < 26; k += 6) P.px(x + k, 4, 0xd8d4c0);
  }
  // högtalare och kamera
  for (const x of [230, 546]) { P.rect(x, 16, 6, 5, 0xe8e8e8); P.box(x, 16, 6, 5, 0x5a5e68); P.px(x + 2, 18, 0x3a3e48); P.px(x + 3, 18, 0x3a3e48); }
  P.rect(700, 16, 5, 3, 0x2a2e36); P.px(704, 17, 0xd02020);

  // ---- FRUKT & GRÖNT: skylt ----
  const fg = 'FRUKT & GRÖNT', fw = textW(BG, fg, 2), fx = Math.round((GREENS.x0 + GREENS.x1) / 2 - fw / 2) + 8;
  signText(P, BG, fg, fx, 16, GREEN, 2, GREEN_DK, GREEN_HI);
  // äpple och morot vid skylten
  fruit(P, fx - 12, 22, 4.5, 4.5, FR.applR, 3); P.vl(fx - 12, 16, 2, 0x5a3a1a); P.rect(fx - 11, 16, 3, 2, 0x5ad05a);
  for (let k = 0; k < 9; k++) { P.px(fx + fw + 5 + k, 18 + (k >> 1), k < 3 ? FR.morot[3] : FR.morot[2]); P.px(fx + fw + 5 + k, 19 + (k >> 1), FR.morot[1]); }
  P.px(fx + fw + 4, 17, 0x4a9a2a); P.px(fx + fw + 3, 16, 0x6ab83a); P.px(fx + fw + 5, 16, 0x2e6a1e);

  // ---- MEJERI: bondgårdsmotiv ovanför kylarna ----
  for (let y = 15; y < DAIRY.top; y++) for (let x = DAIRY.x0; x < DAIRY.x1; x++) {
    const hill = 19 + Math.round(Math.sin(x * 0.045) * 2 + Math.sin(x * 0.11) * 1);
    P.px(x, y, y >= hill ? mix(0x6ab84a, 0x4a9a3a, (y - hill) / 4) : mix(0xb8dcf4, 0xd8ecf8, (y - 15) / 6));
  }
  // ko
  const cowX = 272;
  P.rect(cowX, 16, 10, 4, 0xf8f8f4); P.rect(cowX + 2, 16, 3, 2, 0x2a2a2e); P.rect(cowX + 7, 18, 2, 2, 0x2a2a2e);
  P.rect(cowX + 10, 15, 3, 3, 0xf8f8f4); P.px(cowX + 12, 17, 0xf0a0a0); P.px(cowX + 11, 14, 0x2a2a2e);
  for (const lx of [1, 3, 7, 9]) P.px(cowX + lx, 20, 0x3a3a3e);
  // mjölkflaska
  P.rect(482, 15, 4, 6, 0xffffff); P.rect(483, 14, 2, 1, 0x3a7bd5); P.hl(482, 18, 4, 0x3a7bd5);
  // solen
  fruit(P, 496, 16, 2.5, 2.5, FR.citron, 9);

  // ---- BAGERI: skylt med vetekärve + griffeltavla ----
  const bg = 'BAGERI', bw = textW(BG, bg, 2), bxs = Math.round((BAKERY.x0 + BAKERY.x1) / 2 - bw / 2) + 6;
  P.rect(bxs - 6, 14, bw + 12, 18, 0x3a2414); P.box(bxs - 6, 14, bw + 12, 18, 0x8a5a2a); P.hl(bxs - 5, 15, bw + 10, 0xa8784a);
  signText(P, BG, bg, bxs, 16, 0xf8d898, 2, 0x1a0e08, 0xfff0c8);
  for (let k = 0; k < 5; k++) { // vete
    const x = bxs - 14 + k;
    P.vl(x, 18 + (k === 2 ? -2 : 0), 12, 0xd8a840);
    P.px(x - 1, 18 + (k === 2 ? -2 : 0), 0xf0c860); P.px(x + 1, 20, 0xf0c860);
  }
  P.hl(bxs - 15, 25, 7, 0x8a5a2a);
  // klockan (visarna ritas levande)
  const cx = 724, cy = 22;
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
    const d = Math.hypot(x, y);
    if (d <= 7.2) P.px(cx + x, cy + y, d > 6.2 ? 0x2a2e36 : d > 5.4 ? STEEL[3] : 0xfaf8f0);
  }
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(cx + Math.cos(a) * 4.6), Math.round(cy + Math.sin(a) * 4.6), 0x5a5e68); }
  // nödutgångsskylt ovanför personaldörren
  P.rect(STAFF.x0 + 5, 17, 16, 8, 0x1a8a3a); P.box(STAFF.x0 + 5, 17, 16, 8, 0xe8f8e8);
  P.rect(STAFF.x0 + 8, 19, 2, 2, 0xffffff); P.hl(STAFF.x0 + 8, 21, 3, 0xffffff); P.px(STAFF.x0 + 7, 22, 0xffffff); P.px(STAFF.x0 + 11, 22, 0xffffff);
  P.rect(STAFF.x0 + 14, 19, 5, 5, 0xffffff); P.rect(STAFF.x0 + 15, 20, 3, 4, 0x1a8a3a);
  // listen längs golvet
  for (let x = 0; x < W; x++) { P.px(x, WALL_Y - 1, 0x5a5e68); P.px(x, WALL_Y - 2, 0x8a909a); }
}

// ---------- FRUKT & GRÖNT: kyld grönsaksvägg ----------
function paintGreens(P) {
  const { x0, x1, top, base } = GREENS;
  // markis: grön-vit rand som lutar mot betraktaren
  for (let y = top; y < top + 9; y++) for (let x = x0 - 2; x < x1 + 2; x++) {
    const green = Math.floor((x - x0 + 2) / 6) % 2 === 0;
    let c = green ? 0x2a8a4a : 0xf2eee2;
    c = mul(c, 0.8 + ((y - top) / 9) * 0.24);
    if (y === top) c = mix(c, 0xffffff, 0.35);
    P.px(x, y, c);
  }
  for (let x = x0 - 2; x < x1 + 2; x++) { // fransar
    const green = Math.floor((x - x0 + 2) / 6) % 2 === 0, c = green ? 0x1e6a38 : 0xd8d2c4, k = (x - x0 + 2) % 6;
    P.px(x, top + 9, c); if (k > 0 && k < 5) P.px(x, top + 10, mul(c, 0.85)); if (k === 2 || k === 3) P.px(x, top + 11, mul(c, 0.7));
  }
  const y0 = top + 10;
  // stomme: stolpar och bakre spegel
  P.rect(x0, y0, x1 - x0, base - y0, 0x1e5a34);
  for (let y = y0; y < y0 + 9; y++) for (let x = x0 + 3; x < x1 - 3; x++) {
    let c = mix(0x8aa0a8, 0x5a7078, (y - y0) / 9);
    if (hash(x >> 2, 1, 71) > 0.5 && y > y0 + 4) c = mix(c, [0x4a8a3a, 0xd05a3a, 0xe0a030][Math.floor(hash(x >> 2, 2, 71) * 3)], 0.35);
    P.px(x, y, c);
  }
  glare(P, x0 + 3, y0, x1 - x0 - 6, 9, 0.22, 17);
  // dimrör med munstycken
  for (let x = x0 + 3; x < x1 - 3; x++) { P.px(x, y0 + 9, STEEL[3]); P.px(x, y0 + 10, STEEL[1]); }
  for (let x = x0 + 8; x < x1 - 6; x += 12) { P.px(x, y0 + 11, STEEL[0]); P.px(x, y0 + 10, STEEL[4]); }
  // två lutande hyllplan med åtta fack; prislapparna hänger på skenorna (ritas sist)
  const tiers = [
    { y: y0 + 13, h: 10, kinds: ['sallad', 'broccoli', 'gurka', 'sallad', 'paprika', 'broccoli', 'gurka', 'sallad'] },
    { y: y0 + 32, h: 10, kinds: ['tomat', 'morot', 'champ', 'aubergine', 'paprika', 'lok', 'morot', 'tomat'] },
  ];
  const n = 8, sw = (x1 - x0 - 6) / n;
  // hyllplanens mörka botten (syns mellan högarna)
  for (const tr of tiers) vgrad(P, x0 + 3, tr.y - 3, x1 - x0 - 6, tr.h + 3, 0x24463a, 0x0e241c, 3);
  tiers.forEach((tr, ti) => {
    for (let i = 0; i < n; i++) {
      const sx = Math.round(x0 + 3 + i * sw), ex = Math.round(x0 + 3 + (i + 1) * sw);
      heap(P, sx, tr.y, ex - sx - 1, tr.h, tr.kinds[i], 80 + ti * 10 + i);
      P.vl(ex - 1, tr.y - 2, tr.h + 2, 0xd8ecf0, 0.8); // genomskinlig avdelare
      P.px(ex - 1, tr.y - 2, 0xffffff);
    }
    // prisskena i stål med ljus överkant
    for (let x = x0 + 3; x < x1 - 3; x++) { P.px(x, tr.y + tr.h, STEEL[4]); P.px(x, tr.y + tr.h + 1, 0x2a2e36); P.px(x, tr.y + tr.h + 2, 0x1a1e24); }
  });
  // fuktiga droppar på högarna under dimrören
  for (let k = 0; k < 40; k++) {
    const x = Math.round(x0 + 4 + hash(k, 1, 77) * (x1 - x0 - 8)), y = tiers[0].y + Math.floor(hash(k, 2, 77) * 6);
    P.px(x, y, 0xffffff, 0.7);
  }
  // mellan nedre skenan och sockeln: träkant
  const ly = tiers[1].y + tiers[1].h + 3;
  for (let y = ly; y < base - 3; y++) for (let x = x0 + 3; x < x1 - 3; x++) P.px(x, y, tone(WOOD, 0.6 - (y - ly) * 0.15 + ((x - x0) % 9 === 0 ? -0.3 : 0), x, y));
  P.rect(x0, base - 3, x1 - x0, 3, 0x14301e); P.hl(x0, base - 3, x1 - x0, GREEN_HI);
  tiers.forEach((tr, ti) => {
    for (let i = 0; i < n; i++) chalkS(P, x0 + 3 + i * sw + sw / 2, tr.y + tr.h, PRICES[(i + ti * 3) % PRICES.length]);
  });
  // sidostolpar
  for (const sx of [x0, x1 - 3]) { P.rect(sx, top + 9, 3, base - top - 9, 0x1e6a38); P.vl(sx, top + 9, base - top - 9, 0x3a9a5a); P.vl(sx + 2, top + 9, base - top - 9, 0x0e3a20); }
}

// ---------- MEJERI: sex kylar med glasdörrar ----------
const DAIRY_CATS = ['MJÖLK', 'YOGHURT', 'OST', 'SMÖR/ÄGG', 'JUICE', 'FÄRDIGMAT'];
function paintDairy(P, displays) {
  const { x0, x1, top, base, n, dw } = DAIRY;
  // hölje + ljusande topplist med MEJERI och kofläckar
  P.rect(x0, top, x1 - x0, 11, 0x1f4a8a);
  P.hl(x0, top, x1 - x0, 0x6a9ad8); P.hl(x0, top + 10, x1 - x0, 0x0e2448);
  // kofläckar: mjuka, oregelbundna fläckar på vit botten
  const blobs = [];
  for (let bx = x0 + 6; bx < x1 - 4; bx += 11) {
    if (bx > x0 + 64 && bx < x1 - 66) continue;
    blobs.push([bx + hash(bx, 1, 92) * 5, top + 3 + hash(bx, 2, 92) * 4, 2.2 + hash(bx, 3, 92) * 2.6, 1.6 + hash(bx, 4, 92) * 1.6]);
  }
  for (let y = top + 2; y < top + 9; y++) for (let x = x0 + 2; x < x1 - 2; x++) {
    if (x >= x0 + 70 && x <= x1 - 70) continue;
    let f = 0;
    for (const [bx, by, rx, ry] of blobs) { const d = ((x + 0.5 - bx) / rx) ** 2 + ((y + 0.5 - by) / ry) ** 2; if (d < 1.6) f = Math.max(f, 1.6 - d); }
    f += (hash(x, y, 93) - 0.5) * 0.35;
    const white = y === top + 2 ? 0xffffff : y === top + 8 ? 0xd8dcd8 : 0xf4f4ee;
    P.px(x, y, f > 0.62 ? (f > 1.1 && y < top + 5 ? 0x3a3438 : 0x1a1a1e) : white);
  }
  const lbl = 'MEJERI', lw = textW(BG, lbl);
  P.rect(Math.round((x0 + x1) / 2 - lw / 2) - 6, top + 1, lw + 12, 9, 0x2a62b0);
  signText(P, BG, lbl, Math.round((x0 + x1) / 2 - lw / 2), top + 2, 0xffffff, 1, 0x0e2448, 0xe8f4ff);
  // dörrarna
  const lyxDoor = displays.find((d) => d.d.kind === 'dairy')?.d.door;
  for (let d = 0; d < n; d++) {
    const dx = x0 + d * dw, gy0 = top + 13, gy1 = base - 5;
    // kylens insida: ljus bakvägg med blått LED-sken
    vgrad(P, dx + 2, gy0, dw - 4, gy1 - gy0, 0xe8f2f8, 0xb8cad8, 4);
    P.vl(dx + 3, gy0, gy1 - gy0, 0xffffff); P.vl(dx + dw - 4, gy0, gy1 - gy0, 0xf4fbff);
    // hyllplan med varor
    const shelves = [gy0 + 10, gy0 + 19, gy0 + 28, gy0 + 37, gy1 - 1];
    shelves.forEach((sy, si) => {
      const kinds = dairyKinds(d, si);
      if (kinds) dairyShelf(P, dx + 4, dx + dw - 4, sy, kinds, d * 10 + si);
      if (si < shelves.length - 1) { P.hl(dx + 3, sy, dw - 6, STEEL[4]); P.hl(dx + 3, sy + 1, dw - 6, 0x5a6270); for (let x = dx + 5; x < dx + dw - 5; x += 7) P.rect(x, sy + 1, 3, 1, 0xf4f4f0); }
    });
    // kategorikort överst i dörren
    if (d !== lyxDoor) {
      const cat = DAIRY_CATS[d], cw = textW(SM, cat) + 4, cx = Math.round(dx + dw / 2 - cw / 2);
      P.rect(cx, gy0 + 1, cw, 7, 0x2a62b0); P.hl(cx, gy0 + 1, cw, 0x6a9ad8);
      text(P, SM, cat, cx + 2, gy0 + 2, 0xffffff);
    }
    // glaset: kall ton, reflexer, imma nedtill
    for (let y = gy0; y < gy1; y++) for (let x = dx + 2; x < dx + dw - 2; x++) P.px(x, y, 0xd8f0ff, 0.12);
    glare(P, dx + 2, gy0, dw - 4, gy1 - gy0, 0.24, 19, d);
    P.dith(dx + 2, gy1 - 4, dw - 4, 4, 0xffffff, 0.45, 0.4);
    // dörrkarm och handtag
    P.rect(dx, gy0 - 2, 2, gy1 - gy0 + 4, STEEL[3]); P.vl(dx, gy0 - 2, gy1 - gy0 + 4, STEEL[4]);
    P.rect(dx + dw - 2, gy0 - 2, 2, gy1 - gy0 + 4, STEEL[1]); P.vl(dx + dw - 1, gy0 - 2, gy1 - gy0 + 4, STEEL[0]);
    P.hl(dx, gy0 - 2, dw, STEEL[4]); P.hl(dx, gy0 - 1, dw, STEEL[2]);
    P.hl(dx, gy1, dw, STEEL[2]); P.hl(dx, gy1 + 1, dw, STEEL[0]);
    const hx = d % 2 ? dx + 5 : dx + dw - 7;
    P.rect(hx, gy0 + 12, 2, 20, STEEL[3]); P.vl(hx, gy0 + 12, 20, STEEL[4]); P.vl(hx + 1, gy0 + 12, 20, STEEL[1]);
    P.px(hx, gy0 + 11, STEEL[0]); P.px(hx, gy0 + 32, STEEL[0]);
  }
  // sockel med ventilationsgaller
  P.rect(x0, base - 4, x1 - x0, 4, 0x1a1e24);
  for (let x = x0 + 2; x < x1 - 2; x += 3) P.vl(x, base - 3, 2, 0x3a3e48);
  P.hl(x0, base - 4, x1 - x0, 0x5a6270);
  P.vl(x0, top, base - top, STEEL[4]); P.vl(x1 - 1, top, base - top, STEEL[0]);
}
function dairyKinds(d, si) {
  const T = [
    [['milk'], ['milk', 'fil'], ['fil'], ['milk'], ['bigmilk']],
    [['yog'], ['yog', 'pot'], ['pot'], ['yog'], ['fil']],
    [['cheese'], ['wedge'], ['cheese', 'wedge'], ['wheel'], ['wheel']],
    [['butter'], ['butter'], ['eggs'], ['eggs'], ['butter']],
    [['juice'], ['juice'], ['smoothie'], ['juice'], ['bigjuice']],
    [['tray'], ['sushi'], ['tray'], ['salad'], ['sushi']],
  ];
  return T[d][si];
}
// mejerivaror: små egna förpackningar
function dairyShelf(P, x0, x1, b, kinds, seed) {
  let x = x0, i = 0;
  while (x < x1 - 2) {
    const k = kinds[i % kinds.length], c = [0x3a7bd5, 0x46a35a, 0xd8323a, 0xf0b429, 0x8e5bd1][Math.floor(hash(i, seed, 13) * 5)];
    const w = dairyItem(P, k, x, b, c, i + seed);
    if (x + w > x1) break;
    x += w; i++;
  }
}
function dairyItem(P, k, x, b, c, i) {
  const r = rampOf(c);
  switch (k) {
    case 'milk': case 'fil': case 'bigmilk': {
      const h = k === 'bigmilk' ? 9 : 8, cc = k === 'fil' ? 0x46a35a : c;
      P.hl(x + 1, b - h, 2, 0xe8e8e2); P.hl(x, b - h + 1, 4, 0xf4f4ee);
      for (let y = b - h + 2; y < b; y++) { P.px(x, y, 0xffffff); P.px(x + 1, y, 0xf6f6f0); P.px(x + 2, y, 0xf0f0ea); P.px(x + 3, y, 0xc8c8c0); }
      P.hl(x, b - h + 2, 4, cc); P.rect(x + 1, b - 4, 2, 2, cc); P.px(x + 1, b - 4, rampOf(cc)[3]);
      P.hl(x, b - 1, 4, 0xa8a8a0);
      return 5;
    }
    case 'yog': {
      for (const y0 of [b - 6, b - 3]) { P.hl(x, y0, 4, 0xf4f4ee); P.hl(x, y0 + 1, 4, c); P.px(x + 3, y0 + 1, r[1]); P.hl(x, y0 + 2, 4, 0xe0e0da); P.px(x + 3, y0 + 2, 0xa8a8a0); }
      return 5;
    }
    case 'pot': {
      P.hl(x, b - 7, 5, 0xe8e4dc); P.px(x, b - 7, 0xffffff);
      for (let y = b - 6; y < b; y++) { P.hl(x, y, 5, 0xf8f6f0); P.px(x + 4, y, 0xc8c4bc); }
      P.hl(x, b - 5, 5, c); P.px(x + 4, b - 5, r[1]); P.rect(x + 1, b - 3, 2, 1, r[3]);
      return 6;
    }
    case 'cheese': {
      P.rect(x, b - 4, 7, 4, 0xf0c848); P.hl(x, b - 4, 7, 0xffe890); P.hl(x, b - 1, 7, 0xc89a2a); P.px(x + 6, b - 3, 0xc89a2a);
      P.rect(x + 1, b - 3, 3, 2, c); P.px(x + 2, b - 3, 0xffffff);
      P.hl(x, b - 4, 7, 0xffffff, 0.35);
      return 8;
    }
    case 'wedge': {
      for (let j = 0; j < 5; j++) P.hl(x + (4 - j), b - 5 + j, 2 + j, j === 0 ? 0xffe890 : 0xf0c040);
      P.hl(x, b - 1, 6, 0xc89a2a); P.px(x + 4, b - 3, 0xd8a030);
      return 7;
    }
    case 'wheel': {
      P.hl(x + 1, b - 6, 7, 0xf8d860); P.rect(x, b - 5, 9, 4, 0xe8b840); P.hl(x, b - 2, 9, 0xb8862a); P.hl(x + 1, b - 1, 7, 0x8a6020);
      P.rect(x + 2, b - 4, 4, 2, 0xd82a2a); P.px(x + 3, b - 4, 0xffffff);
      return 10;
    }
    case 'butter': {
      for (const y0 of [b - 6, b - 3]) { P.hl(x, y0, 6, 0xfff4b0); P.hl(x, y0 + 1, 6, 0xf0d868); P.px(x + 5, y0 + 1, 0xc8b040); P.px(x + 2, y0 + 1, 0x2a8a4a); P.hl(x, y0 + 2, 6, 0xd0b050); }
      return 7;
    }
    case 'eggs': {
      P.rect(x, b - 4, 10, 4, 0xb8b0a0); P.hl(x, b - 1, 10, 0x8a8478);
      for (let k = 0; k < 5; k++) { P.px(x + 1 + k * 2, b - 5, 0xf0e0c8); P.px(x + 1 + k * 2, b - 4, 0xd8c0a0); }
      P.hl(x + 2, b - 2, 6, 0xf4f1ea);
      return 11;
    }
    case 'juice': case 'smoothie': case 'bigjuice': {
      const liq = k === 'smoothie' ? 0xd84a8a : [0xf49a2c, 0xf8d040, 0xe04a3a][i % 3], L = rampOf(liq), h = k === 'bigjuice' ? 9 : 8;
      P.px(x + 1, b - h, 0x2a8a4a); P.hl(x, b - h + 1, 3, L[3]);
      for (let y = b - h + 2; y < b; y++) { P.px(x, y, L[3]); P.px(x + 1, y, L[2]); P.px(x + 2, y, L[1]); }
      P.hl(x, b - 4, 3, 0xf4f1ea); P.px(x + 1, b - 4, c);
      P.px(x, b - h + 2, 0xffffff);
      return 4;
    }
    case 'tray': {
      for (const y0 of [b - 6, b - 3]) {
        P.hl(x, y0, 9, 0xd8e4ec); P.hl(x, y0 + 1, 9, 0x2a2a30); P.hl(x, y0 + 2, 9, 0x1a1a20);
        P.px(x + 1, y0 + 1, 0xf0a060); P.px(x + 2, y0 + 1, 0xf4f1ea); P.px(x + 4, y0 + 1, 0x5ab83a); P.px(x + 6, y0 + 1, 0xf8d040); P.px(x + 7, y0 + 1, 0xe05a3a);
      }
      return 10;
    }
    case 'sushi': {
      P.hl(x, b - 5, 10, 0xe8f0f4); P.rect(x, b - 4, 10, 4, 0x1a1a20); P.hl(x, b - 1, 10, 0x0e0e12);
      for (let k = 0; k < 4; k++) { P.px(x + 1 + k * 2, b - 3, 0xf4f1ea); P.px(x + 1 + k * 2, b - 4, k % 2 ? 0xf08a50 : 0x3a5a2a); }
      P.hl(x, b - 5, 10, 0xffffff, 0.5);
      return 11;
    }
    case 'salad': {
      P.hl(x + 1, b - 5, 6, 0xe8f0f4); P.rect(x, b - 4, 8, 4, 0xf4f4f0);
      P.px(x + 1, b - 4, 0x5ab83a); P.px(x + 2, b - 4, 0x7ad050); P.px(x + 4, b - 4, 0xe05a3a); P.px(x + 5, b - 4, 0x5ab83a); P.px(x + 6, b - 4, 0xf8d040);
      P.hl(x, b - 1, 8, 0xb8b8b0);
      return 9;
    }
  }
  return 4;
}

// ---------- personaldörren ----------
function paintStaffDoor(P) {
  const { x0, x1, top } = STAFF, w = x1 - x0;
  P.rect(x0 - 2, top - 2, w + 4, WALL_Y - top + 2, 0x7a808c); P.hl(x0 - 2, top - 2, w + 4, 0xb8bec8);
  for (let i = 0; i < 2; i++) {
    const dx = x0 + i * (w / 2), dw = w / 2;
    for (let y = top; y < WALL_Y; y++) for (let x = dx; x < dx + dw; x++) {
      let c = mix(0x8aa0b4, 0x6a8098, (y - top) / (WALL_Y - top));
      if (x === dx) c = mix(c, 0xffffff, 0.3); if (x === dx + dw - 1) c = mul(c, 0.7);
      P.px(x, y, c);
    }
    // runt fönster
    const cx = dx + dw / 2, cy = top + 9;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x + 0.5 - 0.5, y);
      if (d <= 4.2) P.px(Math.floor(cx + x), cy + y, d > 3.2 ? 0x3a3e48 : mix(0xd8e8f0, 0x9ab0c0, (y + 3) / 6));
    }
    P.px(Math.floor(cx) - 1, cy - 2, 0xffffff);
    P.rect(dx + 1, WALL_Y - 8, dw - 2, 7, STEEL[3]); P.hl(dx + 1, WALL_Y - 8, dw - 2, STEEL[4]); // sparkplåt
  }
  const lbl = 'PERSONAL', lw = textW(SM, lbl) + 6, lx = Math.round((x0 + x1) / 2 - lw / 2);
  P.rect(lx - 1, top - 12, lw + 2, 10, 0x2a2e36);
  P.rect(lx, top - 11, lw, 8, 0xf4f1ea); P.hl(lx, top - 11, lw, 0xffffff); P.hl(lx, top - 4, lw, 0xc8c4bc);
  text(P, SM, lbl, lx + 3, top - 9, 0x2a2e36);
}

// ---------- BAGERI: brödhylla + bake-off-ugn ----------
function paintBakery(P) {
  const { x0, top, base } = BAKERY, rx1 = 636;
  // trähylla med tre lutande plan
  P.rect(x0, top, rx1 - x0, base - top, WOOD[1]);
  for (const sx of [x0, rx1 - 3]) { P.rect(sx, top, 3, base - top, WOOD[2]); P.vl(sx, top, base - top, WOOD[3]); P.vl(sx + 2, top, base - top, WOOD[0]); }
  P.rect(x0, top, rx1 - x0, 3, WOOD[3]); P.hl(x0, top, rx1 - x0, WOOD[4]);
  // plan 1: limpor
  const t1 = top + 13;
  vgrad(P, x0 + 3, top + 3, rx1 - x0 - 6, 10, 0x5a3a20, 0x3a2414, 3);
  for (let x = x0 + 4, i = 0; x < rx1 - 12; x += 10, i++) loaf(P, x, t1, i);
  plankEdge(P, x0 + 3, rx1 - 3, t1);
  // plan 2: bullar i plexilådor
  const t2 = t1 + 15;
  vgrad(P, x0 + 3, t1 + 3, rx1 - x0 - 6, 12, 0x5a3a20, 0x3a2414, 3);
  for (let b = 0; b < 3; b++) {
    const bx = x0 + 5 + b * 26;
    for (let k = 0; k < 5; k++) for (let j = 0; j < 2; j++) bun(P, bx + 1 + k * 4 + j * 2, t2 - 3 - j * 3, b);
    for (let y = t1 + 4; y < t2; y++) for (let x = bx; x < bx + 23; x++) P.px(x, y, 0xe8f4ff, 0.14);
    P.box(bx, t1 + 4, 23, t2 - t1 - 4, 0xd8e8f0, 0.7); P.hl(bx, t1 + 4, 23, 0xffffff, 0.8);
    glare(P, bx + 1, t1 + 5, 21, t2 - t1 - 6, 0.25, 11, b);
    P.rect(bx + 9, t1 + 6, 5, 1, STEEL[2]); // handtag
  }
  plankEdge(P, x0 + 3, rx1 - 3, t2);
  // plan 3: baguetter i korgar + knäckebrödshjul
  const t3 = base - 4;
  vgrad(P, x0 + 3, t2 + 3, rx1 - x0 - 6, t3 - t2 - 3, 0x5a3a20, 0x3a2414, 3);
  for (let b = 0; b < 2; b++) {
    const bx = x0 + 6 + b * 40;
    for (let k = 0; k < 7; k++) { // baguetter lutade i korgen
      const x = bx + 2 + k * 3, c = [0xd8a050, 0xc8883a, 0xe0b060][k % 3];
      for (let j = 0; j < 12; j++) { P.px(x + (j >> 2), t3 - 5 - j, c); P.px(x + 1 + (j >> 2), t3 - 5 - j, mul(c, 0.78)); }
      P.px(x + 3, t3 - 16, mix(c, 0xffffff, 0.3)); P.px(x + 1, t3 - 10, 0xf0d098); P.px(x + 2, t3 - 13, 0xf0d098);
    }
    for (let y = t3 - 6; y < t3; y++) for (let x = bx; x < bx + 26; x++) P.px(x, y, ((x + y) & 1) ? 0xc8a060 : 0xa87a40); // flätad korg
    P.hl(bx, t3 - 6, 26, 0xe0c080); P.hl(bx, t3 - 1, 26, 0x6a4a24);
  }
  for (let k = 0; k < 3; k++) { const cx = x0 + 70 + k * 3; fruit(P, cx, t3 - 5, 4, 4, [0x6a4a24, 0x9a6a3a, 0xc89a5a, 0xe0c080, 0xf8e0b0], k); P.px(cx, t3 - 5, 0x5a3a1a); }
  P.rect(x0, base - 4, rx1 - x0, 4, WOOD[0]); P.hl(x0, base - 4, rx1 - x0, WOOD[2]);
  // påshållare på sidan
  P.rect(rx1 - 2, top + 14, 4, 12, 0xe8d8b0); P.hl(rx1 - 2, top + 14, 4, 0xfff0d0); P.vl(rx1 + 1, top + 14, 12, 0xb8a078);
  // BAKE-OFF-ugnen i rostfritt stål
  const ox0 = 642, ox1 = BAKERY.x1;
  for (let y = top; y < base; y++) for (let x = ox0; x < ox1; x++) {
    let v = 0.62 - (x - ox0) / (ox1 - ox0) * 0.2 + (hash(x, y >> 2, 111) - 0.5) * 0.06;
    if ((x - ox0) % 14 === 0) v += 0.15;
    P.px(x, y, tone(STEEL, v, x, y));
  }
  P.hl(ox0, top, ox1 - ox0, STEEL[4]); P.vl(ox0, top, base - top, STEEL[4]); P.vl(ox1 - 1, top, base - top, STEEL[0]);
  // display 180°
  P.rect(ox0 + 4, top + 3, 20, 7, 0x1a1a1e); P.box(ox0 + 4, top + 3, 20, 7, 0x3a3e48);
  text(P, SM, '180', ox0 + 6, top + 4, 0xff4a2a); P.rect(ox0 + 18, top + 4, 2, 2, 0xff4a2a);
  for (let k = 0; k < 3; k++) { P.rect(ox0 + 30 + k * 8, top + 4, 5, 5, [0x3a3e48, 0x3a3e48, 0x2a8a4a][k]); P.px(ox0 + 31 + k * 8, top + 5, 0x8a909a); }
  // övre ugnen: glödande fönster med bullar (glöden flimrar levande)
  const wy0 = top + 13, wy1 = top + 30;
  P.rect(ox0 + 5, wy0 - 1, ox1 - ox0 - 10, wy1 - wy0 + 2, 0x2a2e36);
  vgrad(P, ox0 + 6, wy0, ox1 - ox0 - 12, wy1 - wy0, 0xffc860, 0xe06020, 4);
  for (let k = 0; k < 6; k++) for (let j = 0; j < 2; j++) bun(P, ox0 + 9 + k * 7, wy0 + 6 + j * 7, 3);
  for (let x = ox0 + 6; x < ox1 - 6; x++) { P.px(x, wy0 + 8, STEEL[1]); P.px(x, wy0 + 15, STEEL[1]); }
  glare(P, ox0 + 6, wy0, ox1 - ox0 - 12, wy1 - wy0, 0.22, 13, 3);
  P.rect(ox0 + 6, wy1 + 2, ox1 - ox0 - 12, 2, STEEL[4]); P.hl(ox0 + 6, wy1 + 3, ox1 - ox0 - 12, STEEL[1]);
  // undre ugnen (släckt)
  const u0 = wy1 + 7, u1 = base - 10;
  P.rect(ox0 + 5, u0 - 1, ox1 - ox0 - 10, u1 - u0 + 2, 0x2a2e36);
  vgrad(P, ox0 + 6, u0, ox1 - ox0 - 12, u1 - u0, 0x4a4e58, 0x2a2e36, 3);
  glare(P, ox0 + 6, u0, ox1 - ox0 - 12, u1 - u0, 0.15, 13, 5);
  P.rect(ox0 + 6, u1 + 2, ox1 - ox0 - 12, 2, STEEL[4]);
  // plåtar på vagnen under
  for (let k = 0; k < 3; k++) { P.hl(ox0 + 4, base - 7 + k * 2, ox1 - ox0 - 8, STEEL[3]); }
  P.hl(ox0, base - 1, ox1 - ox0, STEEL[0]);
  // griffeltavla på väggen mellan hyllan och ugnen
  P.rect(636, top - 2, 6, 4, 0x3a2414);
}
function plankEdge(P, x0, x1, y) {
  for (let x = x0; x < x1; x++) { P.px(x, y, WOOD[4]); P.px(x, y + 1, WOOD[3]); P.px(x, y + 2, WOOD[1]); }
}
function loaf(P, x, b, i) {
  const c = [0xa86a2a, 0x8a4a22, 0xc8883a, 0x6a3a1a][i % 4], r = rampOf(c);
  for (let y = b - 6; y < b; y++) for (let k = 0; k < 9; k++) {
    if ((y === b - 6) && (k < 2 || k > 6)) continue;
    if ((y === b - 5) && (k === 0 || k === 8)) continue;
    P.px(x + k, y, y === b - 6 ? r[3] : y === b - 1 ? r[1] : k < 2 ? r[3] : k > 7 ? r[1] : r[2]);
  }
  for (let k = 0; k < 3; k++) { P.px(x + 2 + k * 2, b - 5 + (k & 1), mix(c, 0xffe8b0, 0.55)); P.px(x + 3 + k * 2, b - 4 + (k & 1), r[1]); }
  if (i % 3 === 0) for (let k = 1; k < 8; k += 2) P.px(x + k, b - 6 + (k === 1 || k === 7 ? 1 : 0), 0xf8f0e0); // mjöl/frön
}
function bun(P, x, b, kind) {
  const c = kind === 1 ? 0xd89a50 : kind === 2 ? 0xc07a3a : kind === 3 ? 0xe8a850 : 0xc8883a;
  P.hl(x + 1, b - 3, 2, mix(c, 0xffffff, 0.3)); P.hl(x, b - 2, 4, c); P.hl(x, b - 1, 4, mul(c, 0.72));
  if (kind === 0) P.px(x + 1, b - 2, 0x6a3a1a); // kanel
  if (kind === 1) { P.px(x + 1, b - 3, 0xffffff); P.px(x + 2, b - 3, 0xf4f1ea); } // pärlsocker
}

// ---------- SMÖRGÅSAR: öppen kyl ----------
function paintSandw(P) {
  const { x0, x1, top, base } = SANDW, w = x1 - x0;
  P.rect(x0, top, w, base - top, 0x1a1e24);
  // lysande kappa
  P.rect(x0, top, w, 8, 0x2a2e36); P.rect(x0 + 2, top + 2, w - 4, 4, 0xfffbe8); P.hl(x0 + 2, top + 2, w - 4, 0xffffff);
  const lbl = 'SMÖRGÅSAR';
  P.rect(x0 - 2, top - 9, w + 4, 8, GREEN); P.hl(x0 - 2, top - 9, w + 4, GREEN_HI); P.hl(x0 - 2, top - 2, w + 4, GREEN_DK);
  centerText(P, SM, lbl, (x0 + x1) / 2, top - 8, 0xffffff);
  vgrad(P, x0 + 3, top + 8, w - 6, base - top - 16, 0x3a4652, 0x222a32, 3);
  const shelves = [top + 18, top + 28, top + 38, base - 8];
  shelves.forEach((sy, si) => {
    let x = x0 + 4;
    for (let i = 0; x < x1 - 12; i++) {
      if (si === 3) { // sallader i skålar
        P.hl(x + 1, sy - 5, 7, 0xe8f0f4); P.rect(x, sy - 4, 9, 4, 0xf4f4f0); P.px(x + 1, sy - 4, 0x5ab83a); P.px(x + 3, sy - 4, 0xe05a3a); P.px(x + 5, sy - 4, 0x7ad050); P.px(x + 7, sy - 4, 0xf8d040); P.hl(x, sy - 1, 9, 0xb8b8b0);
        x += 10; continue;
      }
      // trekantsmackor i plast: bröd, ost, sallad
      for (let j = 0; j < 6; j++) {
        const yy = sy - 1 - j, ww = 6 - Math.abs(j - 2) - (j > 3 ? 1 : 0);
        P.hl(x + 3 - (ww >> 1), yy, ww, j === 5 ? 0xf8d898 : 0xe0a858);
      }
      P.hl(x + 1, sy - 3, 5, [0xf8d040, 0x7ad050, 0xe05a3a][(i + si) % 3]); P.hl(x + 1, sy - 2, 5, 0xf0e0c0);
      P.px(x + 1, sy - 5, 0xffffff, 0.7); P.px(x + 5, sy - 1, 0xc8a060);
      x += 8;
    }
    P.hl(x0 + 3, sy, w - 6, STEEL[4]); P.hl(x0 + 3, sy + 1, w - 6, 0x5a6270);
    for (let k = x0 + 5; k < x1 - 5; k += 8) P.rect(k, sy + 1, 3, 1, 0xf4f4f0);
  });
  // blått LED-ljus i kanterna och luftridå nedtill
  P.vl(x0 + 3, top + 8, base - top - 12, 0x9ad8ff); P.vl(x1 - 4, top + 8, base - top - 12, 0x9ad8ff);
  P.rect(x0, base - 6, w, 6, 0x2a2e36); for (let x = x0 + 2; x < x1 - 2; x += 2) P.vl(x, base - 5, 3, 0x14181e);
  P.hl(x0, base - 6, w, STEEL[3]);
  P.vl(x0, top, base - top, 0x3a3e48); P.vl(x1 - 1, top, base - top, 0x0e1014);
}

// ---------- entréns fasad (nederst) ----------
function paintFrontWall(P) {
  for (let y = FRONT_Y; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y === FRONT_Y) c = STEEL[4];
    else if (y === FRONT_Y + 1) c = STEEL[2];
    else if (y >= H - 3) c = y === H - 3 ? STEEL[1] : 0x2a2e36;
    else { // glasfasad sedd uppifrån: himmel och gata anas
      c = mix(0x8ab8d4, 0x5a86a4, (y - FRONT_Y - 2) / 7);
      if ((x + y * 2) % 23 < 2) c = mix(c, 0xffffff, 0.4);
    }
    if (x % 48 === 0 && y > FRONT_Y + 1 && y < H - 3) c = STEEL[1];
    P.px(x, y, c);
  }
  // dörröppningen (skjutdörrarna ritas levande)
  P.rect(DOOR.x0, FRONT_Y + 2, DOOR.x1 - DOOR.x0, H - FRONT_Y - 5, 0x6a6258);
  for (let x = DOOR.x0; x < DOOR.x1; x += 3) P.vl(x, FRONT_Y + 2, H - FRONT_Y - 5, 0x5a5248);
  P.rect(DOOR.x0 - 3, FRONT_Y - 1, 3, H - FRONT_Y + 1, STEEL[3]); P.rect(DOOR.x1, FRONT_Y - 1, 3, H - FRONT_Y + 1, STEEL[3]);
  P.vl(DOOR.x0 - 3, FRONT_Y - 1, H - FRONT_Y + 1, STEEL[4]); P.vl(DOOR.x1 + 2, FRONT_Y - 1, H - FRONT_Y + 1, STEEL[1]);
}
function paintSideWalls(P) {
  for (let y = 0; y < H; y++) for (let k = 0; k < SIDE; k++) {
    const c = k === SIDE - 1 ? 0x8a909a : k === SIDE - 2 ? 0x5a5e68 : mix(0x3a3e48, 0x2a2e36, hash(k, y >> 3, 121) * 0.5);
    P.px(k, y, c); P.px(W - 1 - k, y, k === SIDE - 1 ? 0x4a4e58 : c);
  }
}
function paintBackground(displays) {
  const P = new Pix(W, H);
  paintFloor(P);
  paintWall(P);
  paintGreens(P);
  paintDairy(P, displays);
  paintStaffDoor(P);
  paintBakery(P);
  paintSandw(P);
  floorReflect(P, GREENS.x0, GREENS.x1, GREENS.base);
  floorReflect(P, DAIRY.x0, DAIRY.x1, DAIRY.base, 10, 0.2);
  floorReflect(P, BAKERY.x0, BAKERY.x1, BAKERY.base, 6, 0.12);
  floorReflect(P, SANDW.x0, SANDW.x1, SANDW.base, 8, 0.2);
  // kylarnas kalla ljus på golvet
  P.ell((DAIRY.x0 + DAIRY.x1) / 2, DAIRY.base + 6, 150, 9, 0xd8f0ff, 0.2, 4);
  P.ell((SANDW.x0 + SANDW.x1) / 2, SANDW.base + 5, 30, 6, 0x9ad8ff, 0.2, 4);
  P.ell(671, BAKERY.base + 5, 26, 6, 0xffb050, 0.14, 4);
  paintFrontWall(P);
  paintSideWalls(P);
  return P.flush();
}

// ---------- fruktöarna ----------
function paintIsland(isl, idx) {
  const { x0, x1, base, crates } = isl, w = x1 - x0;
  return sprite(x0 - 8, base - 44, w + 16, 52, (P) => {
    // bordets underrede: träribbor med grön butiksrand
    for (let y = base - 12; y < base; y++) for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 6;
      let v = 0.55 + (lx === 0 ? -0.3 : lx === 1 ? 0.12 : 0) + (hash(x, y >> 1, 131) - 0.5) * 0.1 - (y - base + 12) / 30;
      P.px(x, y, tone(WOOD, v, x, y));
    }
    for (let x = x0; x < x1; x++) { P.px(x, base - 12, GREEN_HI); P.px(x, base - 11, GREEN); P.px(x, base - 10, GREEN_DK); }
    P.hl(x0, base - 1, w, WOOD[0]);
    // lådorna: bakre raden högre upp, främre lägre
    const cw = Math.floor((w - 4) / 3);
    [0, 1].forEach((tier) => {
      const ty = tier === 0 ? base - 30 : base - 20; // lådans överkant
      for (let i = 0; i < 3; i++) {
        const cx = x0 + 2 + i * (cw + 1), kind = crates[tier][i];
        heap(P, cx + 1, ty - 5, cw - 2, 7, kind, 150 + idx * 20 + tier * 5 + i);
        // lådans framsida: ribbor med handtagshål och stämpel
        for (let y = ty + 2; y < ty + 8; y++) for (let x = cx; x < cx + cw; x++) {
          const ly = y - ty - 2;
          let v = ly === 0 ? 0.85 : ly === 3 ? 0.35 : ly === 5 ? 0.3 : 0.6;
          if (x === cx || x === cx + cw - 1) v -= 0.25;
          P.px(x, y, tone(WOOD, v + (hash(x >> 2, y, 133 + i) - 0.5) * 0.1, x, y));
        }
        // handtagshål i kortänden och en liten griffeltavla på framsidan
        P.rect(cx + 1, ty + 3, 2, 2, WOOD[0]); P.rect(cx + cw - 3, ty + 3, 2, 2, WOOD[0]);
        chalkS(P, cx + cw / 2, ty + 1, PRICES[(idx * 6 + tier * 3 + i) % PRICES.length]);
      }
    });
    // ben och slagskugga
    for (const x of [x0 + 1, x1 - 3]) { P.rect(x, base - 1, 2, 1, WOOD[0]); }
    outline(P, OUT, 0.55);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 6, 4, 0.3);
  });
}

// ---------- hyllgondolerna ----------
const CATS = {
  pasta: { sign: 'PASTA & RIS', col: 0xe07a2e, shelves: [['pbox'], ['bag', 'pbox'], ['bag'], ['sack']] },
  konserv: { sign: 'KONSERVER', col: 0xd8323a, shelves: [['jar'], ['can', 'tin'], ['can'], ['can', 'jar']] },
  frukost: { sign: 'FRUKOST', col: 0xf0b429, shelves: [['cereal'], ['cereal'], ['coffee', 'pbox'], ['bag', 'sack']] },
  dryck: { sign: 'DRYCK', col: 0x3a7bd5, shelves: [['bottle'], ['bottle'], ['carton'], ['six']] },
  fika: { sign: 'FIKA', col: 0x8e5bd1, shelves: [['cookies'], ['knacke'], ['cookies', 'bag'], ['knacke']] },
  godis: { sign: 'GODIS & CHIPS', col: 0xc84a8a, shelves: [['candy', 'choc'], ['candy'], ['bag'], ['tp', 'deterg']] },
};
const LIPS = [35, 25, 15, 5]; // hyllplanens höjd över golvet (varorna står på dem)
// avdelningsskyltarna på gondolerna – kunderna ska inte ställa sig med huvudet bakom dem
const SIGN_Y = (base) => base - 59; // skyltens översta rad (den står på hyllans ovansida, base-48)
const SIGNS = GONDOLAS.map((G) => {
  const w = textW(SM, CATS[G.cat].sign) + 10, x = G.x0 + 6, y = SIGN_Y(G.base);
  return { x0: x - 1, x1: x + w + 1, y0: y - 1, y1: y + 11, base: G.base };
});
// figuren är 27 px hög: huvudet på en figur med fötterna i (x, y) ligger i [x±6, y-27 … y-17]
const signHides = (x, y) => SIGNS.find((s) => y < s.base && x + 6 > s.x0 && x - 6 < s.x1 && y - 27 < s.y1 && y - 19 > s.y0);
function paintGondola(G, gi, displays) {
  const { x0, x1, base, cat } = G, w = x1 - x0, C = CATS[cat];
  const mine = displays.filter((s) => s.d.kind === 'gondola' && s.d.g === gi);
  return sprite(x0 - 4, base - 70, w + 8, 80, (P) => {
    // ovansidan och kartonger på toppen
    P.rect(x0, base - 48, w, 4, 0xd8dce2); P.hl(x0, base - 48, w, 0xf4f6f8); P.hl(x0, base - 45, w, 0x9aa0aa);
    for (let x = x0 + 2, i = 0; x < x1 - 12; i++) {
      const bw = 12 + Math.floor(hash(i, gi, 141) * 10), bh = 5 + Math.floor(hash(i, gi, 142) * 4);
      if (x + bw > x1 - 2) break;
      if (mine.some((s) => x + bw > s.tag[0] - 22 && x < s.tag[0] + 22)) { x += 4; continue; }
      if (hash(i, gi, 143) > 0.25) {
        sbox(P, x, base - 48 - bh, bw, bh, 0xc09a68);
        P.hl(x + 1, base - 48 - bh + 1, bw - 2, 0xd8b888); P.vl(x + (bw >> 1), base - 48 - bh, 2, 0xe8d8b0); // tejp
        if (hash(i, gi, 144) > 0.5) { P.px(x + 3, base - 48 - bh + 3, 0x5a4a3a); P.px(x + 4, base - 48 - bh + 2, 0x5a4a3a); P.px(x + 5, base - 48 - bh + 3, 0x5a4a3a); } // ↑-pil
      }
      x += bw + 1;
    }
    // bakstycke: perforerad plåt
    for (let y = base - 44; y < base - 4; y++) for (let x = x0; x < x1; x++) {
      let c = mix(0xd4d8de, 0xb8bec6, (y - base + 44) / 40);
      if ((x - x0) % 4 === 2 && (y - base) % 4 === 0) c = 0x8a909a;
      P.px(x, y, c);
    }
    // varorna
    LIPS.forEach((l, si) => {
      const b = base - l;
      let segs = [[x0 + 2, x1 - 2]];
      for (const s of mine) {
        const dx0 = x0 + s.d.dx, dx1 = dx0 + s.d.w;
        segs = segs.flatMap(([a, z]) => (dx1 <= a || dx0 >= z ? [[a, z]] : [[a, dx0 - 1], [dx1 + 1, z]].filter(([p, q]) => q - p > 4)));
        if (si === 1 || si === 2) foodDisplay(P, s, dx0, dx1, b, si);
        else stockShelf(P, dx0 - 1, dx1 + 1, b, C.shelves[si], gi * 31 + si * 7 + 900);
      }
      for (const [a, z] of segs) stockShelf(P, a - 1, z, b, C.shelves[si], gi * 31 + si * 7);
      // hyllkant: metall + prisremsa
      for (let x = x0; x < x1; x++) { P.px(x, b, 0xeef2f6); P.px(x, b + 1, 0x4a5260); P.px(x, b + 2, 0x6a7280); }
      for (let x = x0 + 3; x < x1 - 4; x += 11) { const y = hash(x, si, gi) > 0.8; P.rect(x, b + 1, 5, 2, y ? 0xf8d838 : 0xf4f4f0); P.px(x + 2, b + 2, y ? 0xc0202a : 0x3a3e48); }
      for (const s of mine) if (si === 1 || si === 2) { const dx0 = x0 + s.d.dx; for (let x = dx0; x < dx0 + s.d.w; x++) { P.px(x, b + 1, RED); P.px(x, b + 2, RED_DK); } for (let x = dx0 + 2; x < dx0 + s.d.w - 2; x += 5) P.px(x, b + 1, 0xffffff); }
    });
    // sockel
    P.rect(x0, base - 4, w, 4, 0x3a3e48); P.hl(x0, base - 4, w, 0x6a7280); P.hl(x0, base - 1, w, 0x1a1e24);
    for (let x = x0 + 4; x < x1 - 4; x += 8) P.hl(x, base - 2, 4, 0x2a2e36);
    // stolpar i ändarna och i mitten
    for (const sx of [x0, x0 + (w >> 1) - 1, x1 - 2]) { P.vl(sx, base - 48, 48, 0xc8ced6); P.vl(sx + 1, base - 48, 48, 0x7a808c); }
    // kampanjlappar (vippor) som sticker ut från hyllkanterna
    const wob = [['EXTRAPRIS', 0xf8d838, 0xc0202a], ['-20%', 0xd8323a, 0xffffff], ['2 FÖR 25', 0xf8d838, 0xc0202a], ['NYHET', 0x2a8a4a, 0xffffff]];
    for (let k = 0; k < 2; k++) {
      const [s, bgc, fgc] = wob[(gi + k * 3) % wob.length], sw = textW(SM, s) + 4;
      const wx = x0 + 8 + Math.floor(hash(k, gi, 151) * (w - sw - 20)), wy = base - LIPS[k === 0 ? 0 : 2] + 3;
      if (mine.some((m) => wx + sw > x0 + m.d.dx - 2 && wx < x0 + m.d.dx + m.d.w + 2)) continue;
      P.vl(wx + (sw >> 1), wy - 1, 2, 0xe8e8e8);
      P.rect(wx, wy + 1, sw, 7, bgc); P.hl(wx, wy + 1, sw, mix(bgc, 0xffffff, 0.4)); P.hl(wx, wy + 7, sw, mul(bgc, 0.7));
      text(P, SM, s, wx + 2, wy + 2, fgc);
    }
    outline(P, OUT, 0.5);
    // avdelningsskylt som står direkt på hyllans ovansida (vänster ände) – ingen glipa under,
    // så att en kund bakom hyllan aldrig ser ut som en huvudlös kropp mellan skylt och hylla
    const sgw = textW(SM, C.sign) + 10, sgx = x0 + 6, sgy = SIGN_Y(base);
    for (const px of [sgx + 3, sgx + sgw - 4]) { P.rect(px - 1, sgy + 10, 3, base - 48 - sgy - 10, 0x5a5e68); P.px(px - 1, sgy + 10, 0x8a909a); }
    P.rect(sgx, sgy, sgw, 10, 0xf8f8f4); P.box(sgx, sgy, sgw, 10, OUT); P.hl(sgx + 1, sgy + 1, sgw - 2, 0xffffff);
    P.rect(sgx + 1, sgy + 7, sgw - 2, 2, C.col); P.rect(sgx + 2, sgy + 2, 3, 3, C.col);
    text(P, SM, C.sign, sgx + 7, sgy + 2, 0x2a2e36);
    P.hl(sgx + 1, sgy + 10, sgw - 2, 0x1a1422, 0.3);
    // spegling i golvet + slagskugga
    for (let x = x0; x < x1; x++) for (let k = 0; k < 5; k++) { const c = P.get(x, base - 5 - k); if (bayer(x, base + k) < 0.55) P.px(x, base + 1 + k, c, 0.14 * (1 - k / 5)); }
    P.hl(x0, base, w, 0x1a1422, 0.35); P.hl(x0 + 1, base + 1, w - 2, 0x1a1422, 0.15);
  });
}
// maten i en gondol: tätt packad, i två hyllplan, med egen röd hyllkant
function foodDisplay(P, s, x0, x1, b, si) {
  const d = s.d;
  if (d.prod === 'cup') {
    const pr = PR.cup;
    for (let x = x0, i = 0; x + pr.w - 1 <= x1; x += pr.w, i++) pr.draw(P, x, b, d.colors[(i + si) % 2]);
  } else {
    const c = PACKS[Math.floor(hash(s.f.id.length, s.f.id.charCodeAt(0), 5) * PACKS.length)];
    for (let x = x0; x + 5 <= x1; x += 6) PR.pbox.draw(P, x, b, c);
  }
}

// ---------- frysboxarna ----------
function paintFreezer(F, fi, displays) {
  const { x0, x1, base, secs } = F, w = x1 - x0, sw = FSEC(F);
  return sprite(x0 - 4, base - 44, w + 8, 52, (P) => {
    // insidan: varor sedda uppifrån genom glaset
    const iy0 = base - 38, iy1 = base - 18;
    P.rect(x0 + 2, iy0, w - 4, iy1 - iy0, 0xc8dce8);
    secs.forEach((kind, i) => {
      const sx = Math.round(x0 + i * sw), ex = Math.round(x0 + (i + 1) * sw);
      const own = displays.find((s) => s.d.kind === 'freezer' && s.d.f === fi && s.d.sec === i);
      frozen(P, own && own.f.id !== 'pizza' ? 'gen:' + own.f.id : kind, sx + 3, iy0 + 1, ex - sx - 5, iy1 - iy0 - 2, fi * 10 + i);
    });
    // kyla: blåton, frost i kanterna, reflexer
    for (let y = iy0; y < iy1; y++) for (let x = x0 + 2; x < x1 - 2; x++) P.px(x, y, 0xd8f0ff, 0.2);
    P.dith(x0 + 2, iy0, w - 4, 2, 0xffffff, 0.6, 0.6); P.dith(x0 + 2, iy1 - 2, w - 4, 2, 0xffffff, 0.4, 0.5);
    glare(P, x0 + 2, iy0, w - 4, iy1 - iy0, 0.3, 17, fi);
    // glaslock: ramar och handtag
    for (let i = 0; i <= secs.length; i++) { const lx = Math.round(x0 + i * sw) - (i === secs.length ? 2 : 0); P.rect(lx, iy0 - 2, 2, iy1 - iy0 + 2, STEEL[3]); P.vl(lx, iy0 - 2, iy1 - iy0 + 2, STEEL[4]); }
    for (let i = 0; i < secs.length; i++) { const mx = Math.round(x0 + i * sw + sw / 2); P.vl(mx, iy0, iy1 - iy0, STEEL[2], 0.8); P.rect(mx - 5, iy1 - 3, 4, 1, 0x2a2e36); P.rect(mx + 2, iy0 + 1, 4, 1, 0x2a2e36); }
    // bakre kant med prisskena
    P.rect(x0, base - 42, w, 4, STEEL[3]); P.hl(x0, base - 42, w, STEEL[4]); P.hl(x0, base - 39, w, STEEL[1]);
    for (let x = x0 + 6; x < x1 - 6; x += 13) { P.rect(x, base - 41, 5, 2, 0xf4f4f0); P.px(x + 2, base - 40, 0x3a3e48); }
    // främre kant + emaljerad front
    P.rect(x0, iy1, w, 2, STEEL[4]); P.hl(x0, iy1 + 1, w, STEEL[2]);
    for (let y = iy1 + 2; y < base; y++) for (let x = x0; x < x1; x++) {
      let c = mix(0xf4f6f6, 0xd0d6da, (y - iy1) / 18);
      if (x === x0) c = 0xffffff; if (x === x1 - 1) c = 0xa8b0b8;
      P.px(x, y, c);
    }
    for (let x = x0; x < x1; x++) { P.px(x, base - 11, 0x2a8ad8); P.px(x, base - 10, 0x1a5aa8); }
    // FRYST-skyltar med snöflinga
    for (let i = 0; i < secs.length; i += 2) {
      const cx = Math.round(x0 + i * sw + sw), lbl = 'FRYST';
      P.rect(cx - 16, base - 16, 32, 7, 0x1a5aa8); P.hl(cx - 16, base - 16, 32, 0x4a8ad8);
      text(P, SM, lbl, cx - 7, base - 15, 0xffffff);
      snowflake(P, cx - 12, base - 13, 0xd8f0ff);
    }
    // galler och sockel
    for (let x = x0 + 3; x < x1 - 3; x += 3) P.vl(x, base - 7, 3, 0x6a7280);
    P.hl(x0, base - 3, w, 0x8a909a); P.rect(x0, base - 2, w, 2, 0x2a2e36);
    // skylt på pinne: -25% på glassen
    const gi = secs.indexOf('glass');
    if (gi >= 0 && !displays.some((s) => s.d.kind === 'freezer' && s.d.f === fi && s.d.sec === gi)) {
      const cx = Math.round(x0 + gi * sw + sw / 2);
      P.vl(cx, base - 50, 9, 0xe8e8e8); star(P, cx, base - 52, '-25%');
    }
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 4, 4, 0.3);
  });
}
// liten snöflinga 5×5 (kors + diagonaler)
function snowflake(P, cx, cy, c) {
  for (let k = -2; k <= 2; k++) { P.px(cx + k, cy, c); P.px(cx, cy + k, c); }
  for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) P.px(cx + dx, cy + dy, c);
  P.px(cx, cy, 0xffffff);
}
// prisstjärna (kampanj)
function star(P, cx, cy, s, bg = 0xf8d838, fg = 0xd8202a) {
  const tw = textW(SM, s), r = (tw >> 1) + 5;
  for (let y = -7; y <= 7; y++) for (let x = -r; x <= r; x++) {
    const a = Math.atan2(y, x), rr = (x / r) ** 2 + (y / 7) ** 2, spike = 0.8 + 0.2 * Math.cos(a * 8);
    if (rr <= spike) P.px(cx + x, cy + y, rr > spike * 0.78 ? mul(bg, 0.78) : rr < 0.2 ? mix(bg, 0xffffff, 0.3) : bg);
  }
  text(P, SM, s, cx - (tw >> 1), cy - 2, fg);
}
// frysvaror uppifrån
function frozen(P, kind, x0, y0, w, h, seed) {
  if (kind === 'pizza') {
    for (let j = 0; j < 2; j++) for (let i = 0; i < Math.floor(w / 11); i++) {
      const bx = x0 + i * 11 + (j & 1), by = y0 + j * 9, c = [0xd8323a, 0xe07a2e, 0x2d3a8c][(i + j) % 3], r = rampOf(c);
      P.rect(bx, by, 10, 8, c); P.hl(bx, by, 10, r[3]); P.vl(bx + 9, by, 8, r[1]); P.hl(bx, by + 7, 10, r[0]);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) { const d = Math.hypot(x - 2.5, (y - 2) * 1.2); if (d < 3) P.px(bx + 2 + x, by + 1 + y, d > 2.2 ? 0xd8a050 : 0xf8d040); }
      P.px(bx + 3, by + 2, 0xc02020); P.px(bx + 6, by + 3, 0xc02020); P.px(bx + 4, by + 4, 0x4a9a2a); P.px(bx + 5, by + 2, 0xc02020);
      P.hl(bx + 1, by + 6, 3, 0xffffff);
    }
  } else if (kind === 'glass' || kind === 'glass2') {
    for (let j = 0; j < 3; j++) for (let i = 0; i < Math.floor(w / 9); i++) {
      const bx = x0 + i * 9 + (j & 1) * 2, by = y0 + j * 6, c = [0x6a3a1a, 0xf0a0c0, 0xf8f0d0, 0x5ab870, 0xd8323a][Math.floor(hash(i, j, seed) * 5)];
      P.rect(bx, by, 8, 5, 0xf4f4f0); P.rect(bx + 1, by + 1, 6, 3, c); P.hl(bx + 1, by + 1, 6, mix(c, 0xffffff, 0.35)); P.hl(bx, by + 4, 8, 0xb8c0c8);
      if (kind === 'glass2') { P.px(bx + 3, by + 2, 0xf8d040); P.px(bx + 4, by + 2, 0xc8883a); }
    }
  } else if (kind === 'gront' || kind === 'bar' || kind === 'pommes') {
    const base = kind === 'gront' ? 0x2a8a3a : kind === 'bar' ? 0x8e2a6a : 0xe8b830;
    for (let j = 0; j < 2; j++) for (let i = 0; i < Math.floor(w / 8); i++) {
      const bx = x0 + i * 8 + (j & 1) * 3, by = y0 + j * 8, r = rampOf(base);
      P.rect(bx, by, 7, 8, base); P.hl(bx, by, 7, r[3]); P.vl(bx + 6, by, 8, r[1]); P.hl(bx + 1, by, 5, r[4]);
      for (let k = 0; k < 5; k++) {
        const c = kind === 'gront' ? [0x6ad050, 0xf08a20, 0xf8d040][k % 3] : kind === 'bar' ? [0x3a2a8a, 0xd8203a, 0x2a1a5a][k % 3] : 0xf8e070;
        if (kind === 'pommes') P.vl(bx + 1 + k, by + 3, 3, k % 2 ? 0xf8e070 : 0xe0b840); else P.px(bx + 1 + (k * 2) % 5, by + 3 + (k % 3), c);
      }
    }
  } else if (kind === 'fisk') {
    for (let j = 0; j < 2; j++) for (let i = 0; i < Math.floor(w / 10); i++) {
      const bx = x0 + i * 10 + (j & 1) * 2, by = y0 + j * 9;
      P.rect(bx, by, 9, 7, 0x2a62b0); P.hl(bx, by, 9, 0x6a9ad8); P.hl(bx, by + 6, 9, 0x1a3a70);
      for (let k = 0; k < 3; k++) P.hl(bx + 2, by + 2 + k, 5, k === 1 ? 0xf8a030 : 0xe07a20);
      P.px(bx + 1, by + 1, 0xffffff);
    }
  } else { // gen:<id> – en okänd rätt i frysen
    const c = PACKS[Math.floor(hash(kind.length, kind.charCodeAt(4), 5) * PACKS.length)];
    for (let j = 0; j < 2; j++) for (let i = 0; i < Math.floor(w / 10); i++) sbox(P, x0 + i * 10 + (j & 1), y0 + j * 9, 9, 8, c);
  }
}

// ---------- kassorna ----------
function paintKassa(K) {
  const { x0, x1, base, n, open } = K, w = x1 - x0;
  return sprite(x0 - 4, base - 60, w + 8, 68, (P) => {
    const top = base - 26, face = base - 14;
    // bänkens ovansida: rullband, skanner, packyta
    P.rect(x0, top, w, face - top, 0xd8dce2);
    P.hl(x0, top, w, 0xf4f6f8); P.hl(x0, face - 1, w, 0x9aa0aa);
    // rullbandet (linjerna animeras levande)
    P.rect(BELT.x0 - x0 + x0, top + 2, BELT.x1 - BELT.x0, face - top - 4, 0x2a2a30);
    for (let x = BELT.x0 - K1.x0 + x0; x < BELT.x1 - K1.x0 + x0; x++) { P.px(x, top + 2, 0x4a4a52); P.px(x, face - 3, 0x18181c); }
    for (let x = x0 + 1; x < x0 + 49; x++) { P.px(x, top + 1, STEEL[4]); P.px(x, face - 2, STEEL[2]); }
    // varuavskiljare på bandet
    P.rect(x0 + 6, top + 4, 12, 2, 0x5a6270); P.hl(x0 + 6, top + 4, 12, STEEL[3]); P.px(x0 + 6, top + 5, STEEL[4]); P.px(x0 + 17, top + 5, 0x3a4250);
    // skannerglas
    P.rect(x0 + 50, top + 2, 8, face - top - 4, 0x1a1e24); P.rect(x0 + 51, top + 3, 6, face - top - 6, 0x3a4652);
    P.hl(x0 + 51, top + 3, 6, 0x8ab0c8); P.px(x0 + 54, top + 6, 0xff3a3a);
    // packytan med kassar
    P.rect(x0 + 76, top + 2, w - 78, face - top - 4, 0xc8ccd4);
    P.rect(x0 + 80, top - 6, 8, 8, 0xe8d8b0); P.hl(x0 + 80, top - 6, 8, 0xfff0d0); P.vl(x0 + 87, top - 6, 8, 0xb8a078); P.hl(x0 + 82, top - 7, 4, 0xb8a078);
    P.rect(x0 + 82, top - 3, 3, 3, GREEN);
    // fronten i butikens grönt med kassanumret
    for (let y = face; y < base; y++) for (let x = x0; x < x1; x++) {
      let c = mix(GREEN, GREEN_DK, (y - face) / 16);
      if (y === face) c = GREEN_HI; if (x === x0) c = mix(c, 0xffffff, 0.2); if (x === x1 - 1) c = mul(c, 0.7);
      if ((x - x0) % 12 === 0 && y > face + 1) c = mul(c, 0.88);
      P.px(x, y, c);
    }
    P.hl(x0, base - 3, w, 0x0a2a14); P.rect(x0, base - 2, w, 2, 0x1a1e24);
    P.rect(x0 + 4, face + 3, 30, 6, 0xf4f1ea); text(P, SM, 'KASSA ' + n, x0 + 6, face + 4, GREEN_DK);
    // kassaapparaten: skärm mot kunden, tangentbord, kortterminal
    P.rect(x0 + 58, top - 16, 16, 12, 0x2a2e36); P.box(x0 + 58, top - 16, 16, 12, 0x14181e);
    P.rect(x0 + 60, top - 14, 12, 6, open ? 0x1a3a2a : 0x14181e);
    P.rect(x0 + 64, top - 4, 4, 4, 0x3a3e48); P.rect(x0 + 60, top, 14, 3, 0x3a3e48); P.hl(x0 + 60, top, 14, 0x6a7280);
    for (let k = 0; k < 6; k++) P.px(x0 + 61 + k * 2, top + 1, 0xb8bec8);
    P.vl(x0 + 78, top - 6, 7, 0x5a5e68); P.rect(x0 + 75, top - 12, 7, 7, 0x2a2e36); P.rect(x0 + 76, top - 11, 5, 2, 0x6ad0a0); P.rect(x0 + 76, top - 8, 5, 2, 0x5a6270);
    // kassanummerlampan på stolpe
    P.vl(x0 + 2, base - 58, 32, STEEL[2]); P.vl(x0 + 3, base - 58, 32, STEEL[0]);
    P.rect(x0 - 2, base - 60, 11, 10, 0x1a1e24); P.rect(x0 - 1, base - 59, 9, 8, open ? 0x2aba5a : 0x6a1a1a);
    text(P, SM, String(n), x0 + 2, base - 58, open ? 0xffffff : 0xb86a6a);
    if (!open) { // stängd: skylt på bandet och kedja
      const sw = textW(SM, 'STÄNGD') + 6, sx = x0 + 30 - (sw >> 1);
      P.rect(sx, top - 9, sw, 10, 0xd8323a); P.hl(sx + 1, top - 8, sw - 2, 0xf06a6a); P.hl(sx + 1, top - 1, sw - 2, 0xa81a22);
      P.box(sx, top - 9, sw, 10, 0x6a0a10);
      text(P, SM, 'STÄNGD', sx + 3, top - 6, 0xffffff);
      P.vl(x0 + 30, top + 1, 2, 0x5a5e68);
    }
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 4, 3, 0.3);
  });
}
function paintCandyRack(x0, base, i) {
  return sprite(x0 - 6, base - 39, 26, 43, (P) => {
    P.rect(x0, base - 34, 14, 34, 0x3a3e48); P.vl(x0, base - 34, 34, 0x6a7280); P.vl(x0 + 13, base - 34, 34, 0x1a1e24);
    for (let k = 0; k < 4; k++) {
      const b = base - 26 + k * 7;
      for (let x = x0 + 1, j = 0; x < x0 + 12; x += 4, j++) {
        const c = PACKS[Math.floor(hash(j, k + i * 5, 161) * PACKS.length)];
        if (k % 2) PR.choc.draw(P, x, b, c); else PR.candy.draw(P, x, b, c);
      }
      P.hl(x0 + 1, b, 12, STEEL[3]);
    }
    // skylten ovanpå stället, bredare än själva stället så att ordet får plats
    const gw = textW(SM, 'GODIS') + 4, gx = x0 + 7 - (gw >> 1);
    P.rect(gx, base - 39, gw, 7, RED); P.hl(gx, base - 39, gw, 0xff7a70); P.hl(gx, base - 33, gw, RED_DK);
    P.px(gx, base - 39, 0xffb0a8); P.vl(gx + gw - 1, base - 38, 5, RED_DK);
    text(P, SM, 'GODIS', gx + 2, base - 38, 0xffffff);
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + 7, base + 1, 9, 2, 0.3);
  });
}

// ---------- KORV & KAFFE ----------
function paintGrill(displays) {
  const { x0, x1, base } = GRILL, w = x1 - x0, top = base - 22, face = base - 16;
  const korv = foodOf('korv');
  return sprite(x0 - 4, base - 92, w + 8, 100, (P) => {
    // bänk: stålskiva och träfront
    P.rect(x0, top, w, face - top, STEEL[3]); P.hl(x0, top, w, STEEL[4]); P.hl(x0, face - 1, w, STEEL[1]);
    for (let y = face; y < base; y++) for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 5;
      P.px(x, y, tone(OAK, 0.5 + (lx === 0 ? -0.25 : lx === 1 ? 0.12 : 0) - (y - face) / 40 + (hash(x, y >> 1, 171) - 0.5) * 0.1, x, y));
    }
    P.rect(x0, face, w, 3, GREEN); P.hl(x0, face, w, GREEN_HI); P.hl(x0, face + 2, w, GREEN_DK);
    P.rect(x0, base - 2, w, 2, 0x2a1a10);
    // korvgrillen: rullar med korvar under glas och värmelampa
    const gx = x0 + 6, gw = 36, gy = top - 10;
    P.rect(gx, gy, gw, 10, STEEL[2]); P.hl(gx, gy, gw, STEEL[4]); P.vl(gx + gw - 1, gy, 10, STEEL[0]);
    for (let r = 0; r < 4; r++) { const ry = gy + 2 + r * 2; P.hl(gx + 2, ry, gw - 4, STEEL[3]); P.hl(gx + 2, ry + 1, gw - 4, STEEL[1]); }
    P.rect(gx - 1, gy - 8, gw + 2, 2, STEEL[1]); P.hl(gx - 1, gy - 8, gw + 2, STEEL[3]); // värmelampans kåpa
    P.vl(gx, gy - 6, 6, STEEL[3]); P.vl(gx + gw - 1, gy - 6, 6, STEEL[1]);
    for (let y = gy - 6; y < gy; y++) for (let x = gx + 1; x < gx + gw - 1; x++) P.px(x, y, 0xffe8c0, 0.18);
    // plats för korvgubben (x0+44..x0+60) – inget högt på disken där
    // bröd i värmeskåpet
    const bx = x0 + 62;
    P.rect(bx, top - 14, 18, 14, STEEL[2]); P.box(bx, top - 14, 18, 14, STEEL[0]);
    P.hl(bx + 1, top - 13, 16, STEEL[4]);
    P.rect(bx + 2, top - 12, 14, 9, 0xf8e0b0);
    for (let k = 0; k < 3; k++) { P.hl(bx + 3, top - 10 + k * 3, 12, 0xe0a858); P.hl(bx + 3, top - 9 + k * 3, 12, 0xb07a3a); P.px(bx + 3, top - 10 + k * 3, 0xf8d898); }
    glare(P, bx + 2, top - 12, 14, 9, 0.3, 9, 1);
    P.px(bx + 15, top - 2, 0xff5a3a); // värmelampa på
    // senap och ketchup
    for (const [px, c] of [[bx + 21, 0xf8d020], [bx + 27, 0xd8203a]]) {
      const r = rampOf(c);
      P.rect(px, top - 10, 4, 10, c); P.vl(px, top - 10, 10, r[3]); P.vl(px + 3, top - 10, 10, r[1]);
      P.px(px + 1, top - 8, r[4]); P.hl(px, top - 5, 4, 0xf4f1ea); P.px(px + 3, top - 5, 0xc8c4bc);
      P.rect(px + 1, top - 13, 2, 3, 0xf4f1ea); P.px(px + 1, top - 14, 0xf4f1ea); P.px(px + 2, top - 13, 0xc8c4bc);
    }
    // stapel med kaffemuggar
    for (let k = 0; k < 4; k++) { P.hl(bx + 33, top - 3 - k * 2, 5, k === 3 ? 0xffffff : 0xf4f1ea); P.hl(bx + 33, top - 2 - k * 2, 5, 0xc8c4bc); }
    // kaffemaskinen
    const cx0 = x1 - 26;
    P.rect(cx0, top - 30, 22, 30, 0x1a1a20); P.hl(cx0, top - 30, 22, 0x4a4a52); P.vl(cx0, top - 30, 30, 0x3a3a42);
    P.rect(cx0 + 3, top - 27, 16, 7, 0x2a62b0); P.hl(cx0 + 4, top - 26, 8, 0x9ad8ff); P.hl(cx0 + 4, top - 24, 12, 0x6ab0e8);
    for (let k = 0; k < 3; k++) P.rect(cx0 + 4 + k * 5, top - 18, 3, 2, [0xf0b429, 0x8a5a2a, 0xf4f1ea][k]);
    P.rect(cx0 + 5, top - 14, 12, 2, STEEL[2]); P.px(cx0 + 8, top - 12, STEEL[1]); P.px(cx0 + 13, top - 12, STEEL[1]);
    P.rect(cx0 + 8, top - 6, 5, 5, 0xf4f1ea); P.hl(cx0 + 8, top - 6, 5, 0x5a3a1a); // mugg under pipen
    P.rect(cx0 + 4, top - 2, 14, 2, STEEL[1]);
    // menytavla som hänger i kedjor från taket, ovanför korvgubben
    const mx = x0 + 38, my = base - 80, mw = 54, mh = 22;
    P.rect(mx - 1, my - 1, mw + 2, mh + 2, 0x8a5a2a); P.hl(mx - 1, my - 1, mw + 2, 0xc08a50); P.hl(mx - 1, my + mh, mw + 2, 0x5a3a1a);
    P.rect(mx, my, mw, mh, 0x1e2622);
    P.rect(mx, my, mw, 7, GREEN); P.hl(mx, my, mw, GREEN_HI);
    centerText(P, SM, 'KORV & KAFFE', mx + mw / 2, my + 1, 0xffffff);
    text(P, SM, 'KORV', mx + 2, my + 9, 0xf4f1ea); const kp = (korv ? korv.price : 35) + ':-'; text(P, SM, kp, mx + mw - 2 - textW(SM, kp), my + 9, 0xf8d040);
    text(P, SM, 'KAFFE', mx + 2, my + 15, 0xf4f1ea); text(P, SM, 'GRATIS', mx + mw - 2 - textW(SM, 'GRATIS'), my + 15, 0x6fe08a);
    P.px(mx + 1, my + mh - 2, 0xf4f1ea, 0.35); P.px(mx + mw - 3, my + 8, 0xf4f1ea, 0.3); // kritdamm
    outline(P, OUT, 0.5);
    // kedjorna upp mot taket – tonar bort så att tavlan inte ser ut att hänga i frysen
    for (const px of [mx + 5, mx + mw - 6]) {
      for (let y = my - 9; y < my - 1; y++) { const k = (y - (my - 9)) / 8; if (k > 0.5 || bayer(px, y) < k * 1.8) P.px(px, y, (y & 1) ? STEEL[1] : STEEL[3], 0.35 + k * 0.65); }
      P.px(px, my - 1, STEEL[4]);
    }
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 4, 3, 0.3);
  });
}
const BAR_TOP = BAR.base - 26, BAR_FACE = BAR.base - 20; // bänkskivans bakkant / framkant
const LAMPS = [624, 674, 724]; // pendellampor över sittdisken
function paintBar() {
  const { x0, x1, base } = BAR, w = x1 - x0, top = BAR_TOP, face = BAR_FACE;
  return sprite(x0 - 4, base - 72, w + 8, 78, (P) => {
    // bänkskiva i ljus björk med ådring och en mörkare framkant
    const BIRCH = OAK.map((c) => mix(c, 0xf0e0c0, 0.35));
    for (let y = top; y < face; y++) for (let x = x0; x < x1; x++) {
      let v = 0.62 + Math.sin(x * 0.21 + y * 0.8) * 0.05 + (hash(x >> 3, y, 181) - 0.5) * 0.08;
      if (y === top) v = 0.95; else if (y === face - 1) v = 0.3; else if (y === face - 2) v = 0.72;
      P.px(x, y, tone(BIRCH, v, x, y));
    }
    // lampornas varma ljus på skivan
    for (const lx of LAMPS) P.ell(lx, top + 3, 16, 3, 0xfff0c0, 0.22, 3);
    // front: stående valnötsribbor, grön rand, fotstöd i stål
    for (let y = face; y < base; y++) for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 4;
      P.px(x, y, tone(WALNUT, 0.58 + (lx === 0 ? -0.3 : lx === 1 ? 0.15 : 0) - (y - face) / 44, x, y));
    }
    P.hl(x0, face, w, GREEN_HI); P.hl(x0, face + 1, w, GREEN); P.hl(x0, face + 2, w, GREEN_DK);
    for (let x = x0 + 2; x < x1 - 2; x++) { P.px(x, base - 6, STEEL[4]); P.px(x, base - 5, STEEL[2]); P.px(x, base - 4, STEEL[0], 0.6); }
    for (let x = x0 + 12; x < x1 - 8; x += 40) { P.vl(x, base - 6, 5, STEEL[1]); } // fästen
    P.rect(x0, base - 2, w, 2, 0x1a1008);
    P.vl(x0, top, base - top, mix(WALNUT[3], 0xffffff, 0.2)); P.vl(x1 - 1, top, base - top, WALNUT[0]);
    // ÄT HÄR-skylt på fronten
    const lbl = 'ÄT HÄR', tw = textW(SM, lbl), lw = tw + 21, lx = Math.round(x0 + w / 2 - lw / 2), sy = face + 4;
    P.rect(lx, sy, lw, 9, GREEN); P.hl(lx, sy, lw, GREEN_HI); P.hl(lx, sy + 8, lw, GREEN_DK);
    P.vl(lx, sy, 9, GREEN_HI); P.vl(lx + lw - 1, sy, 9, GREEN_DK);
    text(P, SM, lbl, lx + 12, sy + 2, 0xffffff);
    // gaffel med tre pinnar (5 px bred) och kniv med 2 px brett blad – i stål, inte vitt som texten
    const fx = lx + 4, fy = sy + 1;
    for (const dx of [0, 2, 4]) P.vl(fx + dx, fy, 2, STEEL[4]);
    P.hl(fx, fy + 2, 5, STEEL[3]); P.hl(fx + 1, fy + 3, 3, STEEL[3]); P.px(fx + 3, fy + 3, STEEL[2]);
    P.vl(fx + 2, fy + 4, 3, STEEL[4]); P.px(fx + 2, fy + 6, STEEL[2]);
    const kx = lx + lw - 6;
    P.px(kx + 1, fy, STEEL[4]); P.vl(kx, fy + 1, 3, STEEL[4]); P.vl(kx + 1, fy + 1, 3, STEEL[2]);
    P.vl(kx + 1, fy + 4, 3, 0x2a2e36); P.px(kx + 1, fy + 4, STEEL[1]);
    // saker på disken: servetthållare, salt och peppar, sugerrör, vas, menystativ
    const napkins = (x) => {
      P.rect(x, top - 3, 6, 4, STEEL[2]); P.hl(x, top - 3, 6, STEEL[4]); P.vl(x + 5, top - 3, 4, STEEL[0]);
      P.rect(x + 1, top - 6, 4, 3, 0xffffff); P.px(x + 4, top - 5, 0xd8d4cc);
      P.rect(x + 9, top - 3, 2, 4, 0xffffff); P.px(x + 9, top - 4, STEEL[3]); P.px(x + 10, top - 1, 0xc8c4bc);
      P.rect(x + 12, top - 3, 2, 4, 0x3a3440); P.px(x + 12, top - 4, STEEL[3]); P.px(x + 12, top - 2, 0x5a5460);
    };
    napkins(x0 + 36); napkins(x0 + 112);
    // sugrör i en glasburk
    P.rect(x0 + 90, top - 4, 4, 5, 0xd8f0f8); P.vl(x0 + 90, top - 4, 5, 0xffffff); P.vl(x0 + 93, top - 4, 5, 0x9ab8c8);
    for (let k = 0; k < 4; k++) P.vl(x0 + 90 + k, top - 8 + (k & 1), 4, [0xd8323a, 0xf4f1ea, 0x3a7bd5, 0xf0b429][k]);
    // vas med tulpaner
    P.rect(x0 + 72, top - 5, 3, 6, 0xb8e0f0); P.vl(x0 + 72, top - 5, 6, 0xe8f8ff); P.px(x0 + 74, top - 3, 0x7ab0c8);
    P.vl(x0 + 73, top - 9, 4, 0x3a8a2a); P.px(x0 + 72, top - 8, 0x5ab83a);
    P.rect(x0 + 72, top - 12, 3, 3, 0xf05a8a); P.px(x0 + 73, top - 12, 0xff9ac0); P.px(x0 + 71, top - 10, 0xe83a6a);
    // menystativ
    P.rect(x0 + 4, top - 8, 8, 9, 0xf4f1ea); P.box(x0 + 4, top - 8, 8, 9, GREEN); P.hl(x0 + 5, top - 7, 6, GREEN_HI);
    P.hl(x0 + 6, top - 5, 4, 0x3a3e48); P.hl(x0 + 6, top - 3, 3, 0x3a3e48); P.px(x0 + 9, top - 3, 0xd8323a);
    // pendellampor strax ovanför skivan; sladdarna försvinner uppåt mot det mörka taket
    const LY = base - 48; // skärmens översta rad
    for (const lx of LAMPS) {
      for (let j = 0; j < 5; j++) {
        const hw = 2 + j;
        for (let x = lx - hw; x <= lx + hw; x++) {
          const u = (x - lx + hw) / (hw * 2); // 0 vänster … 1 höger
          P.px(x, LY + j, j === 4 ? GREEN_DK : u < 0.2 ? GREEN_HI : u > 0.75 ? mul(GREEN, 0.72) : GREEN);
        }
      }
      P.px(lx - 1, LY + 1, 0xc8f0d0); // emaljglans
      P.hl(lx - 5, LY + 5, 11, 0xfff0c0); P.hl(lx - 2, LY + 6, 5, 0xffffff); P.px(lx - 4, LY + 5, 0xffffff);
    }
    outline(P, OUT, 0.5);
    // sladdarna (efter konturen – en tunn linje som tonar bort uppåt)
    for (const lx of LAMPS) {
      for (let y = LY - 14; y < LY - 1; y++) { const k = (y - (LY - 14)) / 13; if (k > 0.5 || bayer(lx, y) < k * 1.8) P.px(lx, y, 0x2a2e36, 0.3 + k * 0.7); }
      P.hl(lx - 1, LY - 1, 3, 0x4a4e58); P.px(lx, LY - 1, 0x2a2e36); // fästet på skärmen
    }
    // lampornas ljuskägla ner mot skivan (efter konturen så att den inte får kant)
    for (const lx of LAMPS) for (let j = 0; j < top - (LY + 7); j++) { const hw = 5 + Math.round(j * 0.9); for (let x = lx - hw; x <= lx + hw; x++) if (bayer(x, j) < 0.34 - j * 0.018) P.px(x, LY + 7 + j, 0xfff4d0, 0.22); }
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 4, 3, 0.3);
  });
}
function paintStool() {
  const P = new Pix(14, 22);
  P.vl(6, 6, 14, STEEL[3]); P.vl(7, 6, 14, STEEL[1]);
  P.hl(3, 16, 8, STEEL[3]); P.hl(3, 17, 8, STEEL[1]); // fotring
  P.hl(4, 20, 6, STEEL[1]); P.hl(3, 21, 8, STEEL[0]);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 14; x++) {
    const d = Math.hypot((x - 6.5) / 6.5, (y - 2.5) / 3);
    if (d > 1) continue;
    P.px(x, y, y >= 4 ? GREEN_DK : d < 0.45 && y < 3 ? GREEN_HI : GREEN);
  }
  return P.flush();
}

// ---------- entrén ----------
// en kundvagn i profil (nosen åt vänster, handtaget till höger), base = golvet
function paintCart(P, x, base, front) {
  const rim = base - 18, bot = base - 8;
  // korgen: trådnät som smalnar av mot nosen
  for (let y = rim; y <= bot; y++) {
    const t = (y - rim) / (bot - rim), l = Math.round(x + t * 4), r = x + 19;
    for (let xx = l; xx <= r; xx++) {
      let c = ((xx - x) % 3 === 0) ? STEEL[2] : (y - rim) % 3 === 0 ? STEEL[2] : mix(STEEL[3], 0xd8dee6, 0.35);
      if (!front && xx < r - 6) c = mix(c, STEEL[1], 0.25); // bakre vagnar i skugga
      if (xx === l) c = STEEL[4]; else if (xx === r) c = STEEL[1];
      P.px(xx, y, c);
    }
  }
  P.hl(x - 1, rim, 21, STEEL[4]); P.hl(x, rim + 1, 19, STEEL[3]); P.px(x - 1, rim, 0xffffff);
  P.hl(x + 4, bot, 16, STEEL[1]); P.hl(x + 4, bot + 1, 16, STEEL[0]);
  // barnsitsens röda flik och handtaget i grön plast
  P.rect(x + 14, rim + 2, 4, 5, RED); P.hl(x + 14, rim + 2, 4, 0xff7060); P.vl(x + 17, rim + 2, 5, RED_DK);
  P.line(x + 19, rim, x + 22, rim - 3, STEEL[3]);
  P.rect(x + 21, rim - 5, 3, 3, GREEN); P.px(x + 21, rim - 5, GREEN_HI); P.px(x + 23, rim - 3, GREEN_DK);
  // underrede: ben, bricka och hjul
  P.line(x + 5, bot + 1, x + 4, base - 3, STEEL[2]); P.line(x + 18, bot + 1, x + 18, base - 3, STEEL[1]);
  P.hl(x + 3, base - 4, 17, STEEL[3]); P.hl(x + 3, base - 3, 17, STEEL[1]);
  for (const wx of [x + 3, x + 17]) { P.rect(wx, base - 2, 3, 2, 0x1a1a1e); P.px(wx + 1, base - 2, 0x6a6e76); P.px(wx + 1, base - 1, 0x3a3a42); }
}
function paintCarts() {
  const { x0, x1, base } = CARTS;
  return sprite(x0 - 6, base - 34, x1 - x0 + 12, 38, (P) => {
    // räcke bakom vagnarna
    for (const x of [x0, x1 - 2]) for (let y = base - 22; y <= base; y++) { P.px(x, y, STEEL[3]); P.px(x + 1, y, STEEL[1]); }
    P.hl(x0, base - 22, x1 - x0, STEEL[4]); P.hl(x0, base - 21, x1 - x0, STEEL[1]);
    // sex vagnar inskjutna i varandra, den främsta (längst till höger) sist
    for (let i = 0; i < 6; i++) paintCart(P, x0 + 4 + i * 8, base, i === 5);
    // skylt med kundvagn
    const sx = x1 - 14;
    P.vl(sx + 5, base - 26, 5, STEEL[2]);
    P.rect(sx, base - 33, 11, 9, 0x1f5ab0); P.box(sx, base - 33, 11, 9, 0xe8eef6); P.hl(sx + 1, base - 32, 9, 0x4a82d8);
    P.px(sx + 2, base - 31, 0xffffff); P.hl(sx + 3, base - 30, 5, 0xffffff); P.hl(sx + 3, base - 29, 5, 0xffffff); P.hl(sx + 4, base - 28, 3, 0xffffff); P.px(sx + 4, base - 26, 0xffffff); P.px(sx + 7, base - 26, 0xffffff);
    outline(P, OUT, 0.5);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2 + 2, 3, 0.3);
  });
}
function basketSprite(P, x, y) { // röd plastkorg 14×9, (x,y) = övre vänstra hörnet
  const R = rampOf(0xd8303a);
  P.hl(x + 3, y, 8, STEEL[4]); P.px(x + 3, y + 1, STEEL[2]); P.px(x + 10, y + 1, STEEL[2]);
  P.hl(x, y + 2, 14, R[3]); P.px(x, y + 2, R[4]);
  for (let j = 3; j < 8; j++) for (let i = (j > 5 ? 1 : 0); i < 14 - (j > 5 ? 1 : 0); i++) P.px(x + i, y + j, ((i + j) % 3 === 0 && j < 7) ? R[0] : i === 0 ? R[3] : i === 13 ? R[1] : R[2]);
  P.hl(x + 2, y + 8, 10, R[1]);
}
function paintBasketStack() {
  const { x0, base } = BASKETS;
  return sprite(x0 - 4, base - 30, 32, 34, (P) => {
    P.rect(x0 + 1, base - 6, 20, 6, STEEL[2]); P.hl(x0 + 1, base - 6, 20, STEEL[4]); P.hl(x0 + 1, base - 1, 20, STEEL[0]);
    for (let k = 0; k < 5; k++) basketSprite(P, x0 + 4, base - 15 - k * 3);
    P.vl(x0 + 22, base - 26, 22, STEEL[2]); P.rect(x0 + 16, base - 29, 14, 7, GREEN); P.hl(x0 + 16, base - 29, 14, GREEN_HI);
    P.rect(x0 + 17, base - 28, 12, 5, GREEN); basketMini(P, x0 + 19, base - 28);
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + 12, base + 1, 13, 3, 0.3);
  });
}
// en hög tomma korgar på golvet efter kassan, med en liten skylt
function paintBasketDrop() {
  const { x, base } = DROP;
  return sprite(x - 4, base - 20, 24, 24, (P) => {
    for (let k = 0; k < 4; k++) basketSprite(P, x, base - 10 - k * 2);
    P.vl(x + 17, base - 17, 17, STEEL[2]); P.vl(x + 18, base - 17, 17, STEEL[0]);
    P.rect(x + 13, base - 20, 9, 6, GREEN); P.hl(x + 13, base - 20, 9, GREEN_HI); basketMini(P, x + 14, base - 19);
    outline(P, OUT, 0.5);
    groundShadow(P, x + 7, base + 1, 9, 2, 0.3);
  });
}
function basketMini(P, x, y) { P.hl(x + 2, y, 4, 0xffffff); P.hl(x, y + 1, 8, 0xffffff); P.hl(x + 1, y + 2, 6, 0xffffff); P.px(x + 2, y + 3, 0xffffff); P.px(x + 5, y + 3, 0xffffff); }
function paintPant() {
  const { x0, x1, base } = PANT, w = x1 - x0;
  return sprite(x0 - 2, base - 48, w + 4, 52, (P) => {
    for (let y = base - 44; y < base; y++) for (let x = x0; x < x1 - 8; x++) P.px(x, y, mix(0xf4f6f4, 0xc8d0cc, (x - x0) / (w - 8) * 0.6 + (y - base + 44) / 100));
    P.rect(x0, base - 48, w - 8, 6, GREEN); P.hl(x0, base - 48, w - 8, GREEN_HI); text(P, SM, 'PANT', x0 + 3, base - 47, 0xffffff);
    // hålet för burkar
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const d = Math.hypot(x, y); if (d <= 4.3) P.px(x0 + 11 + x, base - 30 + y, d > 3.3 ? STEEL[3] : d > 2.4 ? 0x3a3e48 : 0x0a0c10); }
    P.rect(x0 + 4, base - 22, 14, 6, 0x1a3a2a); P.hl(x0 + 5, base - 21, 8, 0x6ad0a0); // skärm
    P.rect(x0 + 16, base - 14, 4, 3, 0x2aba5a); // kvitto-knapp
    P.rect(x0 + 4, base - 10, 14, 2, 0x3a3e48);
    // säck med flaskor bredvid
    for (let y = base - 16; y < base; y++) for (let x = x1 - 8; x < x1; x++) P.px(x, y, ((x + y) & 1) ? 0x3a7bd5 : 0x2a62b0);
    for (const [bx, c] of [[x1 - 7, 0x46a35a], [x1 - 4, 0xb8e0f0], [x1 - 2, 0xd8323a]]) { P.vl(bx, base - 22, 6, c); P.px(bx, base - 23, 0xf4f1ea); }
    P.hl(x1 - 8, base - 16, 8, 0x4a8ad8);
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 2, 3, 0.3);
  });
}
function paintPallet() {
  const { x0, x1, base } = PALLET, w = x1 - x0;
  return sprite(x0 - 4, base - 58, w + 8, 62, (P) => {
    for (let x = x0; x < x1; x++) { P.px(x, base - 4, WOOD[3]); P.px(x, base - 3, WOOD[2]); P.px(x, base - 1, WOOD[1]); }
    for (const x of [x0, x0 + (w >> 1) - 2, x1 - 4]) P.rect(x, base - 2, 4, 2, WOOD[0]);
    // läskbackar/flak staplade i tre lager
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const c = [0xd8323a, 0xf08a20, 0x46a35a][(i + j) % 3], bx = x0 + 1 + i * 11 - (j === 2 ? 0 : 0), by = base - 12 - j * 9;
      if (j === 2 && (i === 0 || i === 3)) continue;
      const r = rampOf(c);
      P.rect(bx, by, 11, 8, c); P.hl(bx, by, 11, r[3]); P.vl(bx + 10, by, 8, r[1]); P.hl(bx, by + 7, 11, r[0]);
      for (let k = 0; k < 3; k++) { P.px(bx + 2 + k * 3, by + 2, 0xffffff); P.px(bx + 2 + k * 3, by + 3, r[4]); }
      P.hl(bx + 2, by + 5, 7, 0xf4f1ea);
    }
    // kampanjskylt: 2 FÖR 30:-
    P.vl(x0 + w / 2, base - 44, 12, 0xe8e8e8);
    star(P, Math.round(x0 + w / 2), base - 50, '2 FÖR 30');
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 3, 3, 0.3);
  });
}
function paintFlowers() {
  const { x0, x1, base } = FLOWERS, w = x1 - x0;
  return sprite(x0 - 4, base - 40, w + 8, 44, (P) => {
    // trappställning i svart metall
    for (let t = 0; t < 2; t++) { const y = base - 6 - t * 10; P.hl(x0 + t * 4, y, w - t * 8, 0x3a3e48); P.hl(x0 + t * 4, y + 1, w - t * 8, 0x1a1e24); }
    for (const x of [x0 + 1, x1 - 2]) P.vl(x, base - 18, 18, 0x2a2e36);
    const FL = [[0xe83a4a, 0xff8a8a], [0xf8d040, 0xfff0a0], [0xf05a8a, 0xffb0d0], [0xffffff, 0xf0f0f0], [0xb05ae0, 0xd8a0ff], [0xf07e24, 0xffbe6a]];
    for (let t = 0; t < 2; t++) for (let i = 0; i < (t ? 4 : 5); i++) {
      const bx = x0 + 3 + t * 5 + i * 12, by = base - 6 - t * 10, [c, hi] = FL[(i + t * 2) % FL.length];
      // hink
      P.rect(bx, by - 6, 9, 6, 0x9aa4b0); P.hl(bx, by - 6, 9, 0xd8dee6); P.vl(bx + 8, by - 6, 6, 0x6a7280);
      // stjälkar och blommor
      for (let k = 0; k < 5; k++) {
        const fx = bx + 1 + k * 2, fy = by - 10 - (k % 2) * 3 - (hash(i, k, t) > 0.5 ? 1 : 0);
        P.vl(fx, fy + 1, by - 6 - fy - 1, 0x3a8a2a);
        P.px(fx, fy, c); P.px(fx + 1, fy, hi); P.px(fx, fy - 1, hi); P.px(fx - 1, fy, c); P.px(fx, fy + 1, mul(c, 0.7));
      }
      P.px(bx + 2, by - 8, 0x5ab83a); P.px(bx + 6, by - 9, 0x5ab83a);
    }
    // prisskylt
    P.rect(x1 - 26, base - 38, 24, 8, 0xf4f1ea); P.box(x1 - 26, base - 38, 24, 8, GREEN_DK);
    text(P, SM, '49:-', x1 - 22, base - 37, RED);
    P.vl(x1 - 14, base - 30, 6, 0x5a5e68);
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 3, 3, 0.3);
  });
}
function paintAFrame() {
  const { x, base } = AFRAME;
  return sprite(x - 20, base - 34, 40, 38, (P) => {
    // benen och själva tavlan
    P.line(x - 16, base, x - 13, base - 29, WOOD[1]); P.line(x + 16, base, x + 13, base - 29, WOOD[1]);
    P.line(x - 15, base, x - 12, base - 29, WOOD[3]);
    P.rect(x - 16, base - 30, 33, 24, WOOD[2]); P.hl(x - 16, base - 30, 33, WOOD[4]); P.hl(x - 16, base - 7, 33, WOOD[0]);
    P.vl(x - 16, base - 29, 22, WOOD[3]); P.vl(x + 16, base - 29, 22, WOOD[1]);
    P.rect(x - 14, base - 28, 29, 20, 0x1e2622);
    for (let k = 0; k < 22; k++) P.px(x - 13 + Math.floor(hash(k, 1, 191) * 27), base - 27 + Math.floor(hash(k, 2, 191) * 18), 0x3a4640); // kritsudd
    centerText(P, SM, 'VECKANS', x, base - 26, 0xf8d040);
    centerText(P, SM, 'KLIPP!', x, base - 20, 0xffffff);
    P.hl(x - 8, base - 14, 17, 0xf4f1ea, 0.5);
    // ritat äpple och banan + priset
    fruit(P, x - 6, base - 10, 1.8, 1.8, FR.applR, 4); P.px(x - 6, base - 12, 0x6ab83a);
    for (let k = 0; k < 5; k++) P.px(x - 2 + k, base - 10 + (k === 0 || k === 4 ? -1 : 0), FR.banan[2]);
    text(P, SM, '5:-', x + 4, base - 13, 0xff7a68);
    outline(P, OUT, 0.5);
    groundShadow(P, x, base + 1, 15, 2, 0.3);
  });
}
// tidningsställ i trådmetall med tre rader tidningar
function paintMags() {
  const { x0, x1, base } = MAGS, w = x1 - x0;
  return sprite(x0 - 4, base - 46, w + 8, 50, (P) => {
    // gavlar och fot
    for (const sx of [x0, x1 - 2]) { P.vl(sx, base - 38, 38, STEEL[3]); P.vl(sx + 1, base - 38, 38, STEEL[1]); }
    P.rect(x0, base - 3, w, 3, 0x3a3e48); P.hl(x0, base - 3, w, 0x6a7280);
    // tre hyllor med tidningar som överlappar varandra
    for (let r = 2; r >= 0; r--) {
      const b = base - 5 - r * 11;
      for (let i = 0; i < 6; i++) {
        const mx = x0 + 3 + i * 7 + (r & 1) * 2, c = PACKS[Math.floor(hash(i, r, 201) * PACKS.length)], rr = rampOf(c);
        if (mx + 8 > x1 - 1) break;
        // omslaget i full färg med vit titelrad och en bild
        const kind = Math.floor(hash(i, r, 202) * 3), bgc = [mix(c, 0xffffff, 0.25), 0xf4e8d0, 0x9ad0f0][kind];
        P.rect(mx, b - 10, 8, 10, bgc); P.vl(mx, b - 10, 10, mix(bgc, 0xffffff, 0.4)); P.vl(mx + 7, b - 10, 10, mul(bgc, 0.75));
        P.hl(mx, b - 10, 8, c); P.hl(mx + 1, b - 9, 6, 0xffffff); P.px(mx + 2, b - 9, c); P.px(mx + 4, b - 9, c);
        if (kind === 0) { // porträtt
          P.rect(mx + 2, b - 7, 3, 3, 0xe0a97f); P.hl(mx + 2, b - 8, 4, [0x3b2619, 0xf0c050, 0xa04020][i % 3]); P.px(mx + 5, b - 7, [0x3b2619, 0xf0c050, 0xa04020][i % 3]);
          P.rect(mx + 1, b - 4, 5, 3, rr[1]); P.px(mx + 3, b - 6, 0x1a1a1e);
        } else if (kind === 1) { // tårta
          P.rect(mx + 2, b - 6, 4, 3, 0xfff0f8); P.hl(mx + 2, b - 6, 4, 0xf05a8a); P.px(mx + 3, b - 7, 0xd8323a); P.hl(mx + 1, b - 3, 6, 0x8a5a2a);
        } else { // bil
          P.hl(mx + 2, b - 6, 3, rr[3]); P.hl(mx + 1, b - 5, 6, rr[2]); P.px(mx + 2, b - 4, 0x1a1a1e); P.px(mx + 5, b - 4, 0x1a1a1e); P.hl(mx, b - 3, 8, 0x5a6270);
        }
        P.px(mx + 6, b - 3, 0xf8d838); // prisbubbla
      }
      P.hl(x0 + 1, b, w - 2, STEEL[4]); P.hl(x0 + 1, b + 1, w - 2, STEEL[1]);
    }
    // skylt ovanpå
    const lbl = 'TIDNINGAR', lw = textW(SM, lbl) + 6, lx = Math.round(x0 + w / 2 - lw / 2);
    P.rect(lx, base - 46, lw, 8, 0x2d3a8c); P.hl(lx, base - 46, lw, 0x5a6ad0); P.hl(lx, base - 39, lw, 0x1a2250);
    text(P, SM, lbl, lx + 3, base - 45, 0xffffff);
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 3, 3, 0.3);
  });
}
// VÅTT GOLV-skylt och en gul städhink med mopp
function paintWet() {
  const { x, base } = WET;
  return sprite(x - 12, base - 36, 34, 40, (P) => {
    // gul varningsskylt
    for (let y = base - 22; y < base; y++) {
      const hw = 3 + Math.floor((y - base + 22) / 4);
      for (let k = -hw; k <= hw; k++) P.px(x + k, y, k === -hw ? 0xfff08a : k === hw ? 0xb88a10 : 0xf0cc30);
    }
    P.hl(x - 2, base - 23, 5, 0xfff8c0);
    // halkande gubbe
    P.rect(x - 1, base - 18, 2, 2, 0x1a1a1e); P.line(x, base - 16, x + 1, base - 11, 0x1a1a1e); P.line(x + 1, base - 11, x - 3, base - 8, 0x1a1a1e);
    P.line(x + 1, base - 11, x + 4, base - 9, 0x1a1a1e); P.line(x - 3, base - 14, x + 3, base - 15, 0x1a1a1e);
    P.hl(x - 5, base - 6, 11, 0x1a1a1e); P.px(x - 4, base - 7, 0x3a7bd5); P.px(x + 3, base - 7, 0x3a7bd5);
    P.hl(x - 6, base - 3, 13, 0xd8323a); P.hl(x - 6, base - 2, 13, 0x8a1a22);
    // städhink på hjul med vridpress
    const bx = x + 8;
    P.rect(bx, base - 9, 10, 8, 0xf0cc30); P.vl(bx, base - 9, 8, 0xfff08a); P.vl(bx + 9, base - 9, 8, 0xb88a10); P.hl(bx, base - 9, 10, 0xfff8c0);
    P.hl(bx + 1, base - 8, 8, 0x6a9ab8); P.px(bx + 3, base - 8, 0xb8e0f0);
    P.rect(bx + 5, base - 13, 4, 4, 0x3a3e48); P.hl(bx + 5, base - 13, 4, 0x6a7280);
    for (const wx of [bx + 1, bx + 7]) { P.px(wx, base - 1, 0x1a1a1e); P.px(wx + 1, base - 1, 0x2a2a30); }
    // moppen lutad mot hinken
    P.line(bx + 3, base - 7, bx + 12, base - 34, WOOD[3]); P.line(bx + 4, base - 7, bx + 13, base - 34, WOOD[1]);
    P.rect(bx + 1, base - 8, 5, 2, 0xe8e4d8);
    outline(P, OUT, 0.5);
    groundShadow(P, x + 5, base + 1, 15, 2, 0.3);
  });
}
// sopstation: tre fack med färgade lock och brickor ovanpå
function paintBins() {
  const { x0, x1, base } = BINS, w = x1 - x0;
  return sprite(x0 - 4, base - 30, w + 8, 34, (P) => {
    for (let y = base - 18; y < base; y++) for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 4;
      P.px(x, y, tone(WALNUT, 0.6 + (lx === 0 ? -0.25 : lx === 1 ? 0.12 : 0) - (y - base + 18) / 50, x, y));
    }
    P.rect(x0 - 1, base - 20, w + 2, 3, STEEL[3]); P.hl(x0 - 1, base - 20, w + 2, STEEL[4]); P.hl(x0 - 1, base - 18, w + 2, STEEL[1]);
    const cols = [0x46a35a, 0x6a7280, 0x3a7bd5], fw = Math.floor(w / 3);
    cols.forEach((c, i) => {
      const fx = x0 + 1 + i * fw, r = rampOf(c);
      P.rect(fx + 1, base - 16, fw - 3, 4, 0x14100c); P.hl(fx + 1, base - 16, fw - 3, 0x000000);
      P.rect(fx + 1, base - 11, fw - 3, 4, c); P.hl(fx + 1, base - 11, fw - 3, r[3]); P.hl(fx + 1, base - 8, fw - 3, r[1]);
      P.px(fx + Math.floor(fw / 2) - 1, base - 10, 0xffffff); P.px(fx + Math.floor(fw / 2), base - 10, 0xffffff);
    });
    P.rect(x0, base - 2, w, 2, 0x1a1008);
    // brickor och en bortglömd mugg ovanpå
    for (let k = 0; k < 3; k++) { P.hl(x0 + 2, base - 22 - k * 2, w - 4, k === 2 ? 0xd8323a : 0xb8262e); P.hl(x0 + 2, base - 21 - k * 2, w - 4, 0x6a1018); }
    P.rect(x1 - 7, base - 30, 4, 4, 0xf4f1ea); P.hl(x1 - 7, base - 30, 4, 0x5a3a1a); P.px(x1 - 3, base - 29, 0xf4f1ea);
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 3, 2, 0.3);
  });
}
// fruktvågen: stolpe med våg, display, etikettskrivare och en rulle plastpåsar
function paintScale() {
  const { x, base } = SCALE;
  return sprite(x - 12, base - 44, 24, 48, (P) => {
    P.rect(x - 5, base - 3, 11, 3, STEEL[1]); P.hl(x - 5, base - 3, 11, STEEL[3]); // fot
    P.vl(x, base - 26, 23, STEEL[3]); P.vl(x + 1, base - 26, 23, STEEL[1]);
    // vågskålen
    P.rect(x - 7, base - 29, 15, 3, STEEL[3]); P.hl(x - 7, base - 29, 15, STEEL[4]); P.hl(x - 7, base - 27, 15, STEEL[1]);
    P.rect(x - 6, base - 26, 13, 2, 0x3a3e48);
    // displayhuvud med skrivare
    P.rect(x - 6, base - 40, 13, 10, 0xe8ecf0); P.hl(x - 6, base - 40, 13, 0xffffff); P.vl(x + 6, base - 40, 10, 0xa8b0b8);
    P.rect(x - 5, base - 31, 11, 1, 0x5a6270);
    for (let k = 0; k < 4; k++) P.px(x - 4 + k * 3, base - 31, 0x9aa4b0);
    P.px(x + 5, base - 39, 0x2aba5a);
    // påsrullen på sidan
    P.rect(x + 7, base - 22, 4, 6, 0xd8ecf4); P.vl(x + 7, base - 22, 6, 0xffffff); P.vl(x + 10, base - 22, 6, 0x9ab8c8);
    P.vl(x + 8, base - 16, 5, 0xe8f4f8, 0.8); P.px(x + 9, base - 12, 0xe8f4f8, 0.6);
    // en tomatpåse på vågen
    P.rect(x - 4, base - 33, 6, 4, 0xe8f4f8, 0.85); fruit(P, x - 2, base - 31, 1.6, 1.4, FR.tomat, 1); fruit(P, x + 1, base - 31, 1.6, 1.4, FR.tomat, 2);
    outline(P, OUT, 0.5);
    groundShadow(P, x, base + 1, 8, 2, 0.3);
  });
}
// stor fikus i glaserad kruka
function paintPlant() {
  const { x, base } = PLANT;
  return sprite(x - 16, base - 50, 32, 54, (P) => {
    // krukan
    for (let y = base - 14; y < base; y++) {
      const hw = 8 - Math.floor((y - base + 14) / 5);
      for (let k = -hw; k <= hw; k++) {
        const v = 0.62 - k / hw * 0.3 + (y === base - 14 ? 0.3 : 0) - (y - base + 14) / 40;
        P.px(x + k, y, tone([0x1e2a26, 0x2e4a42, 0x3e6a5e, 0x6a9a8a, 0xa8d0c0], v, x + k, y));
      }
    }
    P.hl(x - 7, base - 13, 14, 0x3a2a1a); // jorden
    // stam
    P.vl(x, base - 26, 13, 0x5a3a1a); P.vl(x + 1, base - 24, 11, 0x3a2414); P.line(x, base - 20, x - 4, base - 28, 0x5a3a1a);
    // bladverk: klungor av små blad i fem toner
    const LEAF = [0x0e3a1a, 0x1e5a2a, 0x2e7a36, 0x4a9a44, 0x7ac060];
    const clumps = [[0, -40, 9, 7], [-7, -33, 7, 6], [7, -32, 7, 6], [-3, -26, 6, 4], [5, -44, 5, 4], [-6, -44, 4, 4]];
    for (const [cx, cy, rx, ry] of clumps) for (let y = -ry; y <= ry; y++) for (let k = -rx; k <= rx; k++) {
      const d = (k / rx) ** 2 + (y / ry) ** 2;
      if (d > 1 - hash(x + cx + k, base + cy + y, 211) * 0.35) continue;
      const leaf = ((k + 40) * 3 + (y + 40) * 5) % 7;
      const v = 0.62 - k / rx * 0.12 - y / ry * 0.25 + (leaf === 0 ? 0.25 : leaf === 3 ? -0.2 : 0) + (hash(k, y, cx) - 0.5) * 0.1;
      P.px(x + cx + k, base + cy + y, tone(LEAF, v, x + cx + k, base + cy + y));
    }
    outline(P, OUT, 0.5);
    groundShadow(P, x, base + 1, 11, 3, 0.3);
  });
}
function paintCage() {
  const { x0, x1, base } = CAGE, w = x1 - x0;
  return sprite(x0 - 3, base - 38, w + 6, 42, (P) => {
    // kartonger i rullburen
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      const bw = 9, bx = x0 + 2 + i * 10, by = base - 12 - j * 8;
      sbox(P, bx, by, bw, 7, j === 1 ? 0xb89060 : 0xc8a070); P.vl(bx + 4, by, 2, 0xe8d8b0);
      if ((i + j) % 2) P.rect(bx + 2, by + 3, 3, 2, [0xd8323a, 0x3a7bd5, 0x46a35a][j]);
    }
    for (const x of [x0, x1 - 1]) P.vl(x, base - 36, 34, STEEL[3]);
    for (let y = base - 36; y < base - 3; y += 4) P.hl(x0, y, w, STEEL[2], 0.8);
    for (let x = x0 + 4; x < x1; x += 4) P.vl(x, base - 36, 33, STEEL[2], 0.5);
    P.rect(x0, base - 3, w, 2, STEEL[1]); P.hl(x0, base - 3, w, STEEL[3]);
    for (const wx of [x0 + 1, x1 - 3]) { P.hl(wx, base - 1, 2, 0x1a1a1e); P.px(wx, base, 0x2a2a30); }
    outline(P, OUT, 0.5);
    groundShadow(P, x0 + w / 2, base + 1, w / 2 + 3, 2, 0.3);
  });
}
function paintFront() { // ingenting extra – fasaden ligger i bakgrunden
  return null;
}
function paintDoorPanel() { // ett skjutdörrsblad sett uppifrån (24×10)
  const P = new Pix(24, 10);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 24; x++) {
    let c = mix(0xc8e4f4, 0x8ab8d4, y / 10);
    if ((x + y) % 11 < 2) c = mix(c, 0xffffff, 0.5);
    P.px(x, y, c, 0.85);
  }
  P.hl(0, 0, 24, STEEL[4]); P.hl(0, 9, 24, STEEL[1]); P.vl(0, 0, 10, STEEL[3]); P.vl(23, 0, 10, STEEL[1]);
  P.rect(10, 4, 4, 2, GREEN);
  return P.flush();
}

// ================= figurer =================
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const staffLook = (seed, extra = {}) => {
  const L = makeLook(rng(seed));
  return { ...L, kid: false, build: L.build === 4 ? 5 : L.build, hat: null, bag: null, phones: false, glasses: L.glasses === 'sun' ? false : L.glasses, top: 'shirt', shirt: '#229a4a', accent: '#f4f1ea', ...extra };
};
let LOOKS = null;
function looks() {
  if (LOOKS) return LOOKS;
  LOOKS = {
    cashier: staffLook(11, { beard: false, blush: true, build: 4 }),
    vendor: staffLook(23, { top: 'tee', apron: true, hat: 'cap', cap: '#229a4a' }),
    stocker: staffLook(37, { top: 'tee' }),
    regular: (() => { const R = makeLook(rng(505)); return { ...R, kid: false, build: R.build === 4 ? 5 : R.build }; })(),
    shoppers: [101, 202, 303, 404].map((s) => { const L = makeLook(rng(s)); return { ...L, kid: false, build: L.build === 4 ? 5 : L.build }; }),
  };
  return LOOKS;
}

// ================= HUD-hjälpare (skärmkoordinater) =================
function speech(ctx, x, y, s) {
  const w = textW(SM, s) + 6, x0 = Math.round(x - w / 2), y0 = Math.round(y - 11);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 10);
  ctx.fillStyle = '#fbf8ee'; ctx.fillRect(x0, y0, w, 8);
  ctx.fillStyle = '#17151a'; ctx.fillRect(Math.round(x) - 1, y0 + 9, 3, 1); ctx.fillRect(Math.round(x), y0 + 10, 1, 1);
  ctx.fillStyle = '#fbf8ee'; ctx.fillRect(Math.round(x) - 1, y0 + 8, 2, 1);
  ctxText(ctx, SM, s, x0 + 3, y0 + 2, '#2a2430');
}
// matens stora prislapp: namn överst, priset i stora röda siffror
function foodTag(ctx, cx, y, f, hi, blink) {
  const name = shortName(f), price = priceLbl(f.price);
  const w = Math.max(textW(SM, name), textW(BG, price)) + 8, h = 19, x0 = Math.round(cx - w / 2);
  if (hi) { ctx.fillStyle = blink ? '#ffffff' : '#ffe070'; ctx.fillRect(x0 - 3, y - 3, w + 6, h + 6); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#fbf8ee'; ctx.fillRect(x0, y, w, 7);
  ctx.fillStyle = '#f8d838'; ctx.fillRect(x0, y + 7, w, h - 7);
  ctx.fillStyle = '#fff4a0'; ctx.fillRect(x0, y + 7, w, 1);
  ctx.fillStyle = '#c89a1a'; ctx.fillRect(x0, y + h - 1, w, 1);
  ctx.fillStyle = '#d8323a'; ctx.fillRect(x0, y + 6, w, 1);
  ctxText(ctx, SM, name, x0 + Math.round((w - textW(SM, name)) / 2), y + 1, '#2a2430');
  ctxText(ctx, BG, price, x0 + Math.round((w - textW(BG, price)) / 2) + 1, y + 10, '#8a1a10');
  ctxText(ctx, BG, price, x0 + Math.round((w - textW(BG, price)) / 2), y + 9, '#d8202a');
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 + 2, y + 2, 1, 1); // hålet
}

// ================= scenen =================
export function makeShopMat(A) {
  const g = A.game;
  const R = art();
  const L = looks();
  const walker = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 6, bottom: FRONT_Y - 3, spawn: [DOOR_X, FRONT_Y - 10] });
  walker.speed = 92;
  walker.setObstacles(OBST);
  walker.snapFree();
  walker.dir = 'up';

  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, lastHint = -9;
  let basket = [];          // food-id i den ordning de plockades
  let hasBasket = false;    // korgen tas vid första varan (eller vid korgstället)
  let bag = false;          // en papperskasse efter betalning
  let belt = null;          // pågående kassaslag: { items: [{ id, x, st, w }], total, next, doneT }
  let receiptOpen = false;
  let sit = null;           // { i, eat: foodId | null, t }
  let door = 0, doorWas = false;
  const flies = [], pops = [], bubbles = [];
  let panelHits = [];
  let panelSide = 'left';   // korgpanelens hörn (byter sida när figuren går in under den)
  const cam = { x: 0, y: 0 };
  const camTarget = () => lockedCam || { x: clamp(walker.px - VW / 2, 0, W - VW), y: clamp(walker.py - VH * 0.62, 0, H - VH) };
  Object.assign(cam, camTarget());

  // kunderna i butiken
  const shoppers = L.shoppers.map((look, i) => {
    const sp = BROWSE[(i * 7 + 3) % BROWSE.length], sg = signHides(sp[0], sp[1]);
    const w = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 6, bottom: FRONT_Y - 3, spawn: sg ? [sg.x1 + 8, sp[1]] : sp });
    w.speed = 34 + i * 5;
    w.setObstacles(OBST); w.snapFree();
    return { w, look, carry: i % 2 === 0, wait: 1 + i * 1.3, dir: 'up' };
  });

  // ---------- korgen ----------
  const total = () => basket.reduce((s, id) => s + (foodOf(id)?.price || 0), 0);
  const groups = () => {
    const m = new Map();
    for (const id of basket) m.set(id, (m.get(id) || 0) + 1);
    return [...m].map(([id, n]) => ({ f: foodOf(id), n })).filter((x) => x.f);
  };
  function removeOne(id) { const i = basket.lastIndexOf(id); if (i >= 0) basket.splice(i, 1); }
  function addToBasket(s) {
    if (basket.length >= MAX_BASKET) { play('fel'); toast('🧺 Korgen är full – gå till kassan och betala!', 'bad'); return false; }
    if (belt) cancelScan();
    const first = !hasBasket;
    hasBasket = true; bag = false;
    basket.push(s.f.id);
    play('ok');
    flies.push({ id: s.f.id, x0: s.tag[0], y0: s.tag[1] + 8, t: 0 });
    pops.push({ x: s.tag[0], y: s.tag[1] - 2, s: '+1', t: 0 });
    if (first) toast(`🧺 ${s.f.icon} ${s.f.name} i korgen! Betala i kassan när du handlat klart.`, 'good');
    return true;
  }

  // ---------- kassan ----------
  function startScan() {
    if (!basket.length) { say('cashier', 'HEJ! TA EN VARA FÖRST'); toast('🧺 Korgen är tom – klicka på en vara med stor gul prislapp.'); return; }
    belt = { items: basket.map((id, i) => ({ id, x: BELT.x0 - i * 11, st: 'belt' })), total: 0, doneT: 0 };
    say('cashier', 'HEJ HEJ!');
    play('click');
  }
  function cancelScan() { belt = null; receiptOpen = false; }
  function say(who, s) { bubbles.push({ who, s, t: 0 }); if (bubbles.length > 3) bubbles.shift(); }
  function pay() {
    const sum = total();
    if (!basket.length) return { ok: false, paid: 0, n: 0, left: 0, msg: 'Korgen är tom.' };
    if (g.money < sum) {
      play('fel');
      toast(`💸 Pengarna räcker inte! Du har ${fmt(g.money)} men varorna kostar ${fmt(sum)}.`, 'bad');
      return { ok: false, paid: 0, n: 0, left: basket.length, msg: 'Du har inte råd!' };
    }
    let paid = 0, n = 0;
    const left = [];
    for (const id of basket) {
      const r = g.buyFood(id);
      if (r.ok) { paid += foodOf(id).price; n++; } else left.push(id);
    }
    basket = left;
    belt = null; receiptOpen = false;
    if (n) { play('buy'); bag = true; hasBasket = !!left.length; say('cashier', 'TACK! VÄLKOMMEN ÅTER!'); toast(`🧾 Betalt ${fmt(paid)} – ${n} ${n === 1 ? 'vara ligger' : 'varor ligger'} nu i kylskåpet där hemma!`, 'good'); }
    if (left.length) { play('fel'); toast(`💸 Pengarna räckte inte till allt – ${left.length} kvar i korgen.`, 'bad'); }
    return { ok: !left.length, paid, n, left: left.length };
  }
  function openReceipt() {
    const gs = groups(), sum = total(), afford = g.money >= sum;
    receiptOpen = true;
    const rows = gs.map(({ f, n }) => `<div class="prow shoprow">
        <span style="font-size:28px;text-align:center">${f.icon}</span>
        <span class="nm">${esc(f.name)} × ${n}<br><small class="sp">${fmt(f.price)}/st · +${f.fill} mätthet</small></span>
        <b style="font-size:20px">${fmt(f.price * n)}</b>
        <button class="btn btn-small" data-back="${esc(f.id)}" title="Lägg tillbaka en">↩ Lägg tillbaka</button>
      </div>`).join('');
    const body = `<p style="font-size:19px;margin-top:0">Kassörskan har slagit in allt. 💰 Du har <b>${fmt(g.money)}</b>.</p>
      <div class="plist">${rows}</div>
      <p style="font-size:24px;display:flex;justify-content:space-between;border-top:3px dashed var(--ink);padding-top:8px;margin-bottom:6px"><span>SUMMA</span><b>${fmt(sum)}</b></p>
      ${afford ? `<p style="font-size:18px;margin:0">Maten hamnar i kylskåpet där hemma. Efter köpet har du ${fmt(g.money - sum)} kvar.</p>`
        : `<p class="bad" style="font-size:20px;margin:0"><b>⚠️ Pengarna räcker inte!</b> Du har ${fmt(g.money)} – det fattas <b>${fmt(sum - g.money)}</b>. Lägg tillbaka något.</p>`}`;
    if (!afford) play('fel');
    const dlg = openModal(`🧾 Kassa ${K1.n}`, body, [
      { label: 'Avbryt', onClick: () => { closeModal(); cancelScan(); } },
      { label: `💳 Betala ${fmt(sum)}`, cls: 'btn-go', disabled: !afford, onClick: () => { closeModal(); pay(); } },
    ]);
    dlg.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => {
      removeOne(b.dataset.back);
      play('click');
      if (basket.length) { belt = { items: [], total: 0, doneT: 0, done: true }; openReceipt(); }
      else { closeModal(); cancelScan(); hasBasket = true; toast('🧺 Korgen är tom igen.'); }
    }));
  }
  function goKassa() {
    sit = null;
    walker.walkTo(K1.x0 + 50, K1.base + 12, () => { walker.dir = 'up'; startScan(); });
  }

  // ---------- ät här ----------
  function freeStool() {
    const taken = new Set([REG_I]);
    let best = 0, bd = 1e9;
    STOOLS.forEach((x, i) => { if (taken.has(i)) return; const d = Math.abs(x - walker.px); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function openEat() {
    const cheapest = Math.min(...FOOD.map((f) => f.price)) + EAT_EXTRA;
    const rows = FOOD.map((f) => {
      const price = f.price + EAT_EXTRA, ok = g.money >= price;
      return `<div class="prow shoprow">
        <span style="font-size:28px;text-align:center">${f.icon}</span>
        <span class="nm">${esc(f.name)}<br><small class="sp">+${f.fill} mätthet</small></span>
        <b style="font-size:20px">${fmt(price)}</b>
        <button class="btn btn-small ${ok ? 'btn-go' : ''}" data-eat="${esc(f.id)}" ${ok ? '' : 'disabled'}>😋 Ät</button>
      </div>`;
    }).join('');
    const dlg = openModal('😋 Ät här', `<p style="font-size:19px;margin-top:0">Slå dig ner vid disken! Allt kostar ${EAT_EXTRA} kr extra när du äter här, och att äta tar en kvart.<br>💰 <b>${fmt(g.money)}</b> · Mätthet <b>${Math.round(g.hunger)}/100</b></p>
      ${g.money < cheapest ? '<p class="bad" style="font-size:19px"><b>Du har inte råd med något just nu</b> – jobba ett pass först!</p>' : ''}
      <div class="plist">${rows}</div>`, [{ label: 'Inte nu', onClick: closeModal }]);
    dlg.querySelectorAll('[data-eat]').forEach((b) => (b.onclick = () => {
      const f = foodOf(b.dataset.eat), r = g.buyFood(f.id, { eatNow: true });
      if (!r.ok) { play('fel'); toast(`💸 ${r.msg || 'Du har inte råd!'}`, 'bad'); return; }
      g.passTime(15); // att äta tar en kvart, som på kaféet och hemma
      g.save();
      closeModal();
      play('coin');
      if (sit) { sit.eat = f.id; sit.t = 0; }
      toast(`😋 Mums! ${f.icon} ${f.name} – +${f.fill} mätthet.`, 'good');
    }));
  }
  function goEat() {
    const i = freeStool();
    walker.walkTo(STOOLS[i], STOOL_Y, () => { sit = { i, eat: null, t: 0 }; walker.dir = 'down'; play('click'); openEat(); });
  }

  // ---------- gå ut ----------
  function exit() {
    if (basket.length) {
      openModal('🧺 Obetalda varor', `<p style="font-size:20px;margin-top:0">Du har <b>${basket.length}</b> ${basket.length === 1 ? 'vara' : 'varor'} i korgen som inte är betalda (${fmt(total())}).</p>
        <p style="font-size:18px">Gå till kassan och betala – eller ställ tillbaka allt innan du går.</p>`, [
        { label: '↩ Ställ tillbaka allt och gå', onClick: () => { closeModal(); basket = []; belt = null; leave(); } },
        { label: '🧾 Till kassan', cls: 'btn-go', onClick: () => { closeModal(); goKassa(); } },
      ]);
      return;
    }
    leave();
  }
  function leave() { play('door'); A.go('city'); }

  // ---------- klickbara platser ----------
  const hint = (s) => { if (t - lastHint < 2.5) return; lastHint = t; play('click'); toast(s); };
  const LOOK = '👀 Det här är bara att titta på – varorna med stor gul prislapp kan du köpa!';
  const spots = [
    ...R.displays.map((s) => ({ id: s.f.id, food: s, r: s.r, go: s.go, act: () => addToBasket(s) })),
    { id: 'kassa', r: [K1.x0, K1.base - 60, K1.x1 + 16, K1.base + 6], go: [K1.x0 + 50, K1.base + 12], act: () => { walker.dir = 'up'; startScan(); } },
    { id: 'kassa2', r: [KASSOR[1].x0, KASSOR[1].base - 60, KASSOR[1].x1 + 16, KASSOR[1].base + 6], go: null, act: () => { hint('🔒 Kassa 2 är stängd – gå till kassa 1!'); goKassa(); } },
    { id: 'dorr', r: [DOOR.x0 - 6, FRONT_Y - 30, DOOR.x1 + 6, H], go: [DOOR_X, FRONT_Y - 6], act: exit },
    { id: 'athar', r: [BAR.x0, BAR.base - 40, BAR.x1, BAR.base], go: null, act: goEat },
    { id: 'korgar', r: [BASKETS.x0 - 2, BASKETS.base - 30, BASKETS.x1 + 8, BASKETS.base], go: [BASKETS.x0 + 10, BASKETS.base - 16], act: () => { if (!hasBasket) { hasBasket = true; play('ok'); toast('🧺 Du tog en korg – klicka på en vara med gul prislapp!', 'good'); } else hint('🧺 Du har redan en korg.'); } },
    { id: 'vagnar', r: [CARTS.x0, CARTS.base - 34, CARTS.x1, CARTS.base], go: [CARTS.x1 + 6, CARTS.base - 20], act: () => hint('🛒 Kundvagnarna är för storhandlare – korgen räcker gott!') },
    { id: 'pant', r: [PANT.x0, PANT.base - 48, PANT.x1, PANT.base], go: [PANT.x1 + 8, PANT.base - 4], act: () => hint('♻️ Pantmaskinen – du har inga burkar att panta i dag.') },
    { id: 'personal', r: [STAFF.x0, STAFF.top - 10, STAFF.x1, WALL_Y], go: [(STAFF.x0 + STAFF.x1) / 2, WALL_Y + 12], act: () => hint('🚪 PERSONAL – bara för anställda!') },
    { id: 'grill', r: [GRILL.x0 + 62, GRILL.base - 92, GRILL.x1, GRILL.base], go: [GRILL.x0 + 90, GRILL.base + 11], act: () => { say('vendor', 'KAFFET BJUDER VI PÅ!'); hint('☕ Kaffet är gratis – korven köper du vid grillen (den gula prislappen).'); } },
    { id: 'blommor', r: [FLOWERS.x0, FLOWERS.base - 40, FLOWERS.x1, FLOWERS.base], go: [(FLOWERS.x0 + FLOWERS.x1) / 2, FLOWERS.base + 10], act: () => hint('💐 Fina blommor – men mat är viktigare just nu!') },
    { id: 'pall', r: [PALLET.x0, PALLET.base - 58, PALLET.x1, PALLET.base], go: [(PALLET.x0 + PALLET.x1) / 2, PALLET.base + 10], act: () => hint('🥤 Kampanj: läsk 2 för 30 kr! (Bara att titta på i dag.)') },
    ...ISLANDS.map((isl, i) => ({ id: 'frukt' + i, r: [isl.x0, isl.base - 40, isl.x1, isl.base], go: [(isl.x0 + isl.x1) / 2, isl.base + 10], act: () => hint('🍎 Frukt och grönt – ' + LOOK.slice(3)) })),
    ...GONDOLAS.map((G, i) => ({ id: 'hylla' + i, r: [G.x0, G.base - 70, G.x1, G.base], go: null, row: G.base, act: () => hint(LOOK) })),
    ...FREEZERS.map((F, i) => ({ id: 'frys' + i, r: [F.x0, F.base - 44, F.x1, F.base], go: null, row: F.base, act: () => hint('❄️ ' + LOOK.slice(3)) })),
    { id: 'gront', r: [GREENS.x0, GREENS.top, GREENS.x1, GREENS.base], go: null, row: GREENS.base + 2, act: () => hint('🥬 ' + LOOK.slice(3)) },
    { id: 'mejeri', r: [DAIRY.x0, DAIRY.top, DAIRY.x1, DAIRY.base], go: null, row: DAIRY.base + 2, act: () => hint('🥛 ' + LOOK.slice(3)) },
    { id: 'bageri', r: [BAKERY.x0, BAKERY.top - 16, BAKERY.x1, BAKERY.base], go: null, row: BAKERY.base + 2, act: () => hint('🥖 ' + LOOK.slice(3)) },
  ];
  const spotAt = (x, y) => spots.find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const spotById = (id) => spots.find((s) => s.id === id);
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && spotById(hoverId);
    if (h && (h.food || h.id === 'kassa' || h.id === 'athar' || h.id === 'dorr')) return h;
    if (walker.path.length || sit) return null;
    return spots.find((s) => s.food && Math.abs(walker.px - s.go[0]) < 8 && Math.abs(walker.py - s.go[1]) < 8) || null;
  };
  function clickSpot(s, x) {
    sit = null;
    if (s.go) walker.walkTo(s.go[0], s.go[1], s.act);
    else if (s.row !== undefined) walker.walkTo(clamp(x, s.r[0] + 4, s.r[2] - 4), s.row + 11, s.act);
    else s.act();
  }

  // ---------- HUD: korgen (panel uppe till vänster) ----------
  function drawPanel(ctx) {
    panelHits = [];
    const gs = groups();
    if (!gs.length && !belt) return;
    const w = 116, y0 = 4;
    const rowsH = gs.length * 11;
    const h = 16 + rowsH + 34;
    // panelen flyttar till andra hörnet när figuren går in under den (med lite marginal åt båda hållen)
    const fx = walker.px - cam.x, fy = walker.py - cam.y;
    const under = (px0) => fx > px0 - 10 && fx < px0 + w + 10 && fy - 40 < y0 + h + 4;
    if (panelSide === 'left' && under(4)) panelSide = 'right';
    else if (panelSide === 'right' && under(VW - 4 - w) && !under(4)) panelSide = 'left';
    const x0 = panelSide === 'left' ? 4 : VW - 4 - w;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a8a4a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#fbf8ee'; ctx.fillRect(x0, y0, w, h);
    // rubrik
    ctx.fillStyle = '#229a4a'; ctx.fillRect(x0, y0, w, 12);
    ctx.fillStyle = '#5ad07a'; ctx.fillRect(x0, y0, w, 1);
    drawMiniBasket(ctx, x0 + 3, y0 + 2);
    ctxText(ctx, SM, 'KORGEN', x0 + 19, y0 + 4, '#ffffff');
    const cnt = `${basket.length} ST`;
    ctxText(ctx, SM, cnt, x0 + w - 4 - textW(SM, cnt), y0 + 4, '#d8f8d8');
    let y = y0 + 15;
    for (const { f, n } of gs) {
      drawIcon(ctx, f.id, x0 + 3, y);
      ctxText(ctx, SM, shortName(f), x0 + 15, y + 2, '#2a2430');
      const cn = '×' + n;
      ctxText(ctx, SM, cn, x0 + 60, y + 2, '#6a6070');
      const pr = priceLbl(f.price * n);
      ctxText(ctx, SM, pr, x0 + w - 16 - textW(SM, pr), y + 2, '#8a1a10');
      // lägg tillbaka-knapp
      const bx = x0 + w - 11;
      ctx.fillStyle = '#17151a'; ctx.fillRect(bx, y, 9, 9);
      ctx.fillStyle = '#e8dcd0'; ctx.fillRect(bx + 1, y + 1, 7, 7);
      ctx.fillStyle = '#b8323a';
      for (let k = 0; k < 5; k++) { ctx.fillRect(bx + 2 + k, y + 2 + k, 1, 1); ctx.fillRect(bx + 6 - k, y + 2 + k, 1, 1); }
      panelHits.push({ r: [bx - 1, y - 1, bx + 10, y + 10], act: () => { if (belt) cancelScan(); removeOne(f.id); play('click'); } });
      y += 11;
    }
    ctx.fillStyle = '#c8bca8'; ctx.fillRect(x0 + 3, y, w - 6, 1);
    y += 3;
    const sum = total(), afford = g.money >= sum;
    ctxText(ctx, SM, 'SUMMA', x0 + 4, y + 2, '#2a2430');
    const st = priceLbl(sum);
    ctxText(ctx, BG, st, x0 + w - 4 - textW(BG, st), y, afford ? '#2a2430' : '#c9323a');
    y += 10;
    const btnTxt = belt ? 'I KASSAN...' : 'TILL KASSAN';
    const blink = !belt && Math.floor(t * 2) % 2 === 0;
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0 + 3, y, w - 6, 11);
    ctx.fillStyle = belt ? '#8a909a' : blink ? '#34b85c' : '#229a4a'; ctx.fillRect(x0 + 4, y + 1, w - 8, 9);
    ctx.fillStyle = belt ? '#b8bec8' : '#5ad07a'; ctx.fillRect(x0 + 4, y + 1, w - 8, 1);
    ctxText(ctx, SM, btnTxt, x0 + Math.round((w - textW(SM, btnTxt)) / 2) - 3, y + 3, '#ffffff');
    if (!belt) { ctx.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) ctx.fillRect(x0 + w - 16 + k, y + 3 + k, 1, 5 - k * 2); }
    if (!belt) panelHits.push({ r: [x0 + 3, y, x0 + w - 3, y + 11], act: () => goKassa() });
    y += 13;
    const mt = `DU HAR ${Math.round(g.money)} KR`;
    ctxText(ctx, SM, mt, x0 + 4, y, afford ? '#6a6070' : '#c9323a');
    // bara knapparna fångar klick – resten av panelen släpper igenom klicket till butiken
  }
  function drawMiniBasket(ctx, x, y) {
    ctx.fillStyle = '#e6ecf0'; ctx.fillRect(x + 4, y, 6, 1); ctx.fillRect(x + 3, y + 1, 1, 2); ctx.fillRect(x + 10, y + 1, 1, 2);
    ctx.fillStyle = '#ff7a70'; ctx.fillRect(x, y + 3, 14, 1);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(x, y + 4, 14, 3); ctx.fillRect(x + 1, y + 7, 12, 1);
    ctx.fillStyle = '#8a1a22'; for (let k = 1; k < 13; k += 3) ctx.fillRect(x + k, y + 5, 1, 1);
  }
  // korgen i figurens händer (med varor som sticker upp)
  function drawCarried(ctx, x, y, items, isBag) {
    if (isBag) {
      ctx.fillStyle = '#17151a'; ctx.fillRect(x - 6, y - 12, 12, 13);
      ctx.fillStyle = '#c8a070'; ctx.fillRect(x - 5, y - 11, 10, 11);
      ctx.fillStyle = '#e0c090'; ctx.fillRect(x - 5, y - 11, 10, 1); ctx.fillRect(x - 5, y - 11, 1, 11);
      ctx.fillStyle = '#9a7448'; ctx.fillRect(x + 4, y - 11, 1, 11);
      ctx.fillStyle = '#229a4a'; ctx.fillRect(x - 2, y - 7, 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 6, 2, 1);
      ctx.fillStyle = '#5ab83a'; ctx.fillRect(x - 4, y - 15, 1, 4); ctx.fillRect(x - 3, y - 16, 1, 5); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 1, y - 14, 2, 3);
      return;
    }
    const COL = { nudlar: '#d8323a', macka: '#e0a858', korv: '#b84a2a', pizza: '#e07a2e', lyx: '#2a2a30' };
    items.slice(-4).forEach((id, i) => {
      ctx.fillStyle = '#17151a'; ctx.fillRect(x - 6 + i * 3, y - 11 - (i % 2), 4, 4);
      ctx.fillStyle = COL[id] || '#3a7bd5'; ctx.fillRect(x - 5 + i * 3, y - 10 - (i % 2), 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x - 5 + i * 3, y - 10 - (i % 2), 1, 1);
    });
    ctx.fillStyle = '#17151a'; ctx.fillRect(x - 8, y - 8, 16, 9);
    ctx.fillStyle = '#e6ecf0'; ctx.fillRect(x - 4, y - 11, 8, 1);
    ctx.fillStyle = '#8e98a2'; ctx.fillRect(x - 5, y - 10, 1, 2); ctx.fillRect(x + 4, y - 10, 1, 2);
    ctx.fillStyle = '#ff7a70'; ctx.fillRect(x - 7, y - 7, 14, 1);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(x - 7, y - 6, 14, 5); ctx.fillRect(x - 6, y - 1, 12, 1);
    ctx.fillStyle = '#8a1a22'; for (let k = -6; k < 7; k += 3) ctx.fillRect(x + k, y - 5, 1, 2);
    ctx.fillStyle = '#ff9a90'; ctx.fillRect(x - 7, y - 6, 1, 5);
  }

  // ---------- namnskylt för det man står vid / pekar på ----------
  function bigLabel(ctx, s, atTop) {
    let icon = null, name, price, hintTxt, col = '#f0d048';
    if (s.food) {
      const f = s.food.f;
      icon = f.id; name = shortName(f); price = `${f.price} KR`;
      hintTxt = basket.length >= MAX_BASKET ? 'KORGEN ÄR FULL' : `+${f.fill} MÄTT - KLICKA SÅ HAMNAR DEN I KORGEN`;
    } else if (s.id === 'kassa') { name = 'KASSA 1'; price = basket.length ? `${total()} KR` : ''; hintTxt = basket.length ? 'KLICKA SÅ BETALAR DU' : 'PLOCKA VAROR FÖRST'; col = '#6fe08a'; }
    else if (s.id === 'athar') { name = 'ÄT HÄR'; price = `+${EAT_EXTRA} KR`; hintTxt = 'SÄTT DIG OCH ÄT DIREKT'; col = '#6fe08a'; }
    else if (s.id === 'dorr') { name = 'UTGÅNG'; price = ''; hintTxt = basket.length ? 'BETALA FÖRST!' : 'TILLBAKA UT PÅ STAN'; col = '#6fe08a'; }
    else return;
    const nw = textW(BG, name), pw = price ? textW(BG, price) : 0, hw = textW(SM, hintTxt);
    const w = Math.max(nw + pw + (price ? 8 : 0) + (icon ? 14 : 0), hw + (icon ? 14 : 0)) + 12, h = 22;
    const x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 : VH - h - 3;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
    let tx = x0 + 6;
    if (icon) { drawIcon(ctx, icon, x0 + 4, y0 + 4); tx = x0 + 17; }
    ctxText(ctx, BG, name, tx, y0 + 3, '#ffffff');
    if (price) ctxText(ctx, BG, price, tx + nw + 8, y0 + 3, col);
    ctxText(ctx, SM, hintTxt, tx, y0 + 14, Math.floor(t * 2) % 2 === 0 ? col : '#c9c2d2');
  }

  // ---------- uppdatering ----------
  function updateBelt(dt) {
    if (!belt || belt.done) return;
    let prevX = SCAN_X + 12;
    let allDone = true;
    for (const it of belt.items) {
      if (it.st === 'belt') {
        allDone = false;
        const stop = Math.min(SCAN_X - 4, prevX - 11);
        it.x = Math.min(stop, it.x + dt * 52);
        if (it.x >= SCAN_X - 4.01 && prevX > SCAN_X + 6) { it.st = 'scan'; it.t = 0; }
        prevX = it.x;
      } else if (it.st === 'scan') {
        allDone = false;
        it.t += dt;
        prevX = it.x;
        if (it.t > 0.2) { it.st = 'bag'; it.t = 0; belt.total += foodOf(it.id)?.price || 0; play('click'); belt.flash = 0.12; }
      } else if (it.st === 'bag') {
        it.t += dt; it.x += dt * 40;
        if (it.t < 0.35) allDone = false; else it.st = 'done';
      }
    }
    if (belt.flash) belt.flash = Math.max(0, belt.flash - dt);
    if (allDone) { belt.doneT += dt; if (belt.doneT > 0.35) { belt.done = true; openReceipt(); } }
  }
  function updateShoppers(dt) {
    for (const s of shoppers) {
      const moving = s.w.update(dt);
      if (!moving && !s.w.path.length) {
        s.wait -= dt;
        if (s.wait <= 0) {
          const p = BROWSE[Math.floor(Math.random() * BROWSE.length)];
          let tx = p[0] + (Math.random() * 16 - 8);
          const sg = signHides(tx, p[1]);
          if (sg) tx = sg.x1 + 8; // ställ dig bredvid skylten, inte bakom den
          s.w.walkTo(tx, p[1], () => { s.wait = 2 + Math.random() * 4; s.w.dir = 'up'; });
          if (!s.w.path.length) s.wait = 1;
        }
      }
    }
  }

  // ---------- ritning ----------
  function drawWorld(ctx, cx, cy, vw, vh) {
    ctx.drawImage(R.bg, cx, cy, vw, vh, cx, cy, vw, vh);
    const inView = (x0, y0, x1, y1) => x1 >= cx - 8 && x0 <= cx + vw + 8 && y1 >= cy - 8 && y0 <= cy + vh + 8;
    liveWall(ctx);
    const focus = focusSpot();
    // prislapparna på väggkylarna (mejeriet och smörgåskylen) sitter på bakväggen
    for (const s of R.displays) if (s.d.kind === 'dairy' || s.d.kind === 'sandw') { wallClip(ctx, s); displayTag(ctx, s, focus); }
    const items = [];
    const add = (fy, x0, y0, x1, y1, draw) => { if (inView(x0, y0, x1, y1)) items.push({ fy, draw }); };
    ISLANDS.forEach((isl, i) => add(isl.base, isl.x0 - 8, isl.base - 44, isl.x1 + 8, isl.base + 8, () => put(ctx, R.islands[i])));
    GONDOLAS.forEach((G, i) => add(G.base, G.x0 - 4, G.base - 70, G.x1 + 4, G.base + 10, () => {
      put(ctx, R.gondolas[i]);
      for (const s of R.displays) if (s.d.kind === 'gondola' && s.d.g === i) displayTag(ctx, s, focus);
    }));
    FREEZERS.forEach((F, i) => add(F.base, F.x0 - 4, F.base - 64, F.x1 + 4, F.base + 8, () => {
      put(ctx, R.freezers[i]);
      for (const s of R.displays) if (s.d.kind === 'freezer' && s.d.f === i) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(Math.round(s.tag[0]), s.tag[1] + 19, 1, F.base - 40 - s.tag[1] - 19); displayTag(ctx, s, focus); }
      fog(ctx, F);
    }));
    KASSOR.forEach((K, i) => {
      if (K.open) add(K.base - 24, K.x0 + 30, K.base - 70, K.x0 + 60, K.base - 20, () => drawPerson(ctx, K.x0 + 42, K.base - 25, L.cashier, 'down', belt && !belt.done ? 9 : Math.sin(t * 1.6) > 0.94 ? 4 : 0));
      add(K.base, K.x0 - 4, K.base - 60, K.x1 + 4, K.base + 8, () => { put(ctx, R.kassor[i]); if (K.open) liveKassa(ctx, K); });
      add(K.base, K.x1 - 6, K.base - 40, K.x1 + 22, K.base + 4, () => put(ctx, R.candy[i]));
      if (i === 0) add(DROP.base, DROP.x - 4, DROP.base - 20, DROP.x + 20, DROP.base + 4, () => put(ctx, R.drop));
    });
    add(GRILL.base - 16, GRILL.x0 + 38, GRILL.base - 60, GRILL.x0 + 66, GRILL.base, () => drawPerson(ctx, VENDOR_X, GRILL.base - 17, L.vendor, Math.sin(t * 0.4) > 0.75 ? 'left' : 'down', Math.sin(t * 1.3 + 1) > 0.94 ? 4 : 0));
    add(GRILL.base, GRILL.x0 - 4, GRILL.base - 92, GRILL.x1 + 4, GRILL.base + 8, () => {
      put(ctx, R.grill); liveGrill(ctx);
      for (const s of R.displays) if (s.d.kind === 'grill') { ctx.fillStyle = '#5a5e68'; ctx.fillRect(Math.round(s.tag[0]), s.tag[1] + 19, 1, GRILL.base - 32 - s.tag[1] - 19); displayTag(ctx, s, focus); }
    });
    // stamgästen som dricker kaffe längst till höger
    add(STOOL_Y, STOOLS[REG_I] - 12, STOOL_Y - 40, STOOLS[REG_I] + 12, STOOL_Y, () => drawPerson(ctx, STOOLS[REG_I], STOOL_Y, L.regular, 'down', Math.sin(t * 0.8) > 0.82 ? 6 : 5));
    for (let i = 0; i < STOOLS.length; i++) add(STOOL_Y - 0.5, STOOLS[i] - 7, STOOL_Y - 22, STOOLS[i] + 7, STOOL_Y, () => ctx.drawImage(R.stool, STOOLS[i] - 7, STOOL_Y - 21));
    add(BAR.base, BAR.x0 - 4, BAR.base - 72, BAR.x1 + 4, BAR.base + 6, () => {
      put(ctx, R.bar);
      barPlates(ctx);
    });
    add(CARTS.base, CARTS.x0 - 6, CARTS.base - 34, CARTS.x1 + 6, CARTS.base + 4, () => put(ctx, R.carts));
    add(BASKETS.base, BASKETS.x0 - 4, BASKETS.base - 30, BASKETS.x1 + 10, BASKETS.base + 4, () => put(ctx, R.baskets));
    add(PANT.base, PANT.x0 - 2, PANT.base - 48, PANT.x1 + 2, PANT.base + 4, () => put(ctx, R.pant));
    add(PALLET.base, PALLET.x0 - 4, PALLET.base - 58, PALLET.x1 + 4, PALLET.base + 4, () => put(ctx, R.pallet));
    add(FLOWERS.base, FLOWERS.x0 - 4, FLOWERS.base - 40, FLOWERS.x1 + 4, FLOWERS.base + 4, () => put(ctx, R.flowers));
    add(AFRAME.base, AFRAME.x - 20, AFRAME.base - 34, AFRAME.x + 20, AFRAME.base + 4, () => put(ctx, R.aframe));
    add(MAGS.base, MAGS.x0 - 4, MAGS.base - 46, MAGS.x1 + 4, MAGS.base + 4, () => put(ctx, R.mags));
    add(WET.base, WET.x - 12, WET.base - 36, WET.x + 22, WET.base + 4, () => put(ctx, R.wet));
    add(BINS.base, BINS.x0 - 4, BINS.base - 30, BINS.x1 + 4, BINS.base + 4, () => put(ctx, R.bins));
    add(PLANT.base, PLANT.x - 16, PLANT.base - 50, PLANT.x + 16, PLANT.base + 4, () => put(ctx, R.plant));
    add(SCALE.base, SCALE.x - 12, SCALE.base - 44, SCALE.x + 12, SCALE.base + 4, () => { put(ctx, R.scale); liveScale(ctx); });
    add(CAGE.base, CAGE.x0 - 3, CAGE.base - 38, CAGE.x1 + 3, CAGE.base + 4, () => put(ctx, R.cage));
    add(RESTOCK[1], RESTOCK[0] - 12, RESTOCK[1] - 40, RESTOCK[0] + 12, RESTOCK[1] + 2, () => drawPerson(ctx, RESTOCK[0], RESTOCK[1], L.stocker, Math.sin(t * 0.5) > 0.6 ? 'right' : 'up', Math.sin(t * 0.5) > 0.6 ? 9 : 0));
    // kunderna
    for (const s of shoppers) {
      const w = s.w, walking = w.path.length > 0;
      const frame = s.carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : Math.sin(t * 2 + w.px) > 0.9 ? 4 : 0;
      add(w.py, w.px - 12, w.py - 40, w.px + 12, w.py + 2, () => {
        if (s.carry && w.dir === 'up') drawCarried(ctx, Math.round(w.px), Math.round(w.py) - 12, [], false);
        drawPerson(ctx, w.px, w.py, s.look, w.dir, frame);
        if (s.carry && w.dir !== 'up') drawCarried(ctx, Math.round(w.px) + (w.dir === 'left' ? -6 : w.dir === 'right' ? 6 : 0), Math.round(w.py) - 12, [], false);
      });
    }
    // andra spelare och jag
    for (const d of folkDrawables(A, t)) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
    const carrying = !sit && (hasBasket || bag);
    if (sit) {
      const sx = STOOLS[sit.i];
      items.push({ fy: STOOL_Y, draw: () => drawPerson(ctx, sx, STOOL_Y, A.avatar.look, 'down', sit.eat && sit.t < 4 ? (Math.floor(sit.t * 2.5) % 2 ? 6 : 5) : 5) });
    } else {
      const me = selfDrawable(A, walker, t, { carry: carrying, folksHere: worldFolksHere(A).length });
      const dir = walker.dir, ox = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
      const bx = Math.round(walker.px) + ox, by = Math.round(walker.py) - 12;
      const shown = belt ? [] : basket;
      if (carrying && dir === 'up') items.push({ fy: walker.py - 0.01, draw: () => drawCarried(ctx, bx, by, shown, bag && !basket.length) });
      items.push({ fy: walker.py, me: true, draw: () => me.draw(ctx) });
      if (carrying && dir !== 'up') items.push({ fy: walker.py + 0.01, draw: () => drawCarried(ctx, bx, by, shown, bag && !basket.length) });
    }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    // en svag "röntgen"-kopia av figuren ovanpå allt, så att man ser sig själv bakom hyllorna
    if (!sit) {
      const ghost = items.find((it) => it.me);
      if (ghost) { ctx.globalAlpha = 0.28; ghost.draw(); ctx.globalAlpha = 1; }
    }
    // skjutdörrarna i fasaden
    const open = Math.round(door * 22);
    ctx.drawImage(R.doorPanel, DOOR.x0 - open, FRONT_Y + 1);
    ctx.drawImage(R.doorPanel, DOOR_X - open * 0 + open, FRONT_Y + 1);
    nightGlass(ctx);
    // flygande varor, +1 och pratbubblor
    for (const f of flies) {
      const k = Math.min(1, f.t / 0.4), tx = walker.px, ty = walker.py - 24;
      const x = f.x0 + (tx - f.x0) * k, y = f.y0 + (ty - f.y0) * k - Math.sin(k * Math.PI) * 18;
      drawIcon(ctx, f.id, Math.round(x) - 4, Math.round(y) - 4);
    }
    for (const p of pops) ctxText(ctx, BG, p.s, Math.round(p.x) - 5, Math.round(p.y - p.t * 16), p.t < 0.6 || Math.floor(p.t * 10) % 2 ? '#2aba5a' : '#ffffff');
    for (const b of bubbles) {
      const pos = b.who === 'cashier' ? [K1.x0 + 42, K1.base - 66] : [VENDOR_X, GRILL.base - 50];
      speech(ctx, pos[0], pos[1], b.s);
    }
    if (sit?.eat && sit.t < 4) speech(ctx, STOOLS[sit.i], STOOL_Y - 30, sit.t < 2 ? 'MUMS!' : 'MMM...');
  }
  // tallrikar och koppar på sittdisken
  function plate(ctx, x) {
    ctx.fillStyle = '#17151a'; ctx.fillRect(x - 6, BAR_TOP + 1, 13, 4);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 5, BAR_TOP + 1, 11, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, BAR_TOP + 1, 9, 1);
    ctx.fillStyle = '#c8c4bc'; ctx.fillRect(x - 5, BAR_TOP + 3, 11, 1);
  }
  function barPlates(ctx) {
    if (sit) {
      const x = STOOLS[sit.i];
      if (sit.eat || sit.ate) plate(ctx, x);
      if (sit.eat) drawIcon(ctx, sit.eat, x - 4, BAR_TOP - 5 + (sit.t > 2.5 ? 2 : 0));
      else if (sit.ate) { ctx.fillStyle = '#c8883a'; ctx.fillRect(x - 2, BAR_TOP + 1, 1, 1); ctx.fillRect(x + 2, BAR_TOP + 2, 1, 1); ctx.fillStyle = '#9a9aa0'; ctx.fillRect(x + 3, BAR_TOP, 4, 1); }
    }
    // stamgästens kaffekopp (lyfts när hen dricker)
    const rx = STOOLS[REG_I] + 6, up = Math.sin(t * 0.8) > 0.82;
    if (!up) {
      ctx.fillStyle = '#17151a'; ctx.fillRect(rx - 1, BAR_TOP - 4, 6, 6);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(rx, BAR_TOP - 3, 4, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(rx, BAR_TOP - 3, 1, 4);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(rx, BAR_TOP - 3, 4, 1);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(rx + 4, BAR_TOP - 2, 1, 2);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; ctx.fillRect(Math.round(rx + 2 + Math.sin(ph * 6 + k) * 1.2), Math.round(BAR_TOP - 5 - ph * 7), 1, 1); }
    }
  }
  // prislappen på en matplats (med ljus ram när man står där eller pekar)
  function displayTag(ctx, s, focus) {
    const on = focus === spotById(s.f.id);
    if (on) {
      const [gx, gy, gw, gh] = s.glow, a = 0.28 + Math.sin(t * 6) * 0.12;
      ctx.fillStyle = `rgba(255,236,120,${a.toFixed(3)})`; ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(gx - 1, gy - 1, gw + 2, 1); ctx.fillRect(gx - 1, gy + gh, gw + 2, 1); ctx.fillRect(gx - 1, gy, 1, gh); ctx.fillRect(gx + gw, gy, 1, gh);
    }
    foodTag(ctx, s.tag[0], s.tag[1], s.f, on, on && Math.floor(t * 4) % 2 === 0);
  }
  // kvällsmörker i glasfasaden (butiken har öppet till 23)
  function nightGlass(ctx) {
    const h = (g.min / 60) % 24, dark = h >= 21 || h < 6 ? 1 : h >= 19 ? (h - 19) / 2 : h < 7 ? 7 - h : 0;
    if (dark <= 0) return;
    ctx.fillStyle = `rgba(14,18,44,${(0.72 * dark).toFixed(3)})`;
    ctx.fillRect(SIDE, FRONT_Y + 2, W - SIDE * 2, H - FRONT_Y - 5);
    // gatlyktornas gula sken speglas i glaset
    ctx.fillStyle = `rgba(255,214,120,${(0.55 * dark).toFixed(3)})`;
    for (let x = 60; x < W; x += 150) { ctx.fillRect(x, FRONT_Y + 4, 3, 2); ctx.fillRect(x + 1, FRONT_Y + 6, 1, 3); }
  }
  // fruktvågens display blinkar ibland
  function liveScale(ctx) {
    const on = Math.floor(t / 3) % 3 !== 0;
    ctx.fillStyle = '#0e2a1a'; ctx.fillRect(SCALE.x - 4, SCALE.base - 37, 9, 5);
    if (on) { ctx.fillStyle = '#6fe08a'; ctx.fillRect(SCALE.x - 3, SCALE.base - 36, 1, 3); ctx.fillRect(SCALE.x - 1, SCALE.base - 36, 1, 3); ctx.fillRect(SCALE.x + 1, SCALE.base - 36, 3, 1); ctx.fillRect(SCALE.x + 1, SCALE.base - 34, 3, 1); }
  }
  // två små stålklämmor som håller en prislapp på väggkylen
  function wallClip(ctx, s) {
    const x = Math.round(s.tag[0]), y = s.tag[1];
    for (const dx of [-7, 6]) {
      ctx.fillStyle = '#3e444c'; ctx.fillRect(x + dx, y - 3, 2, 4);
      ctx.fillStyle = '#e6ecf0'; ctx.fillRect(x + dx, y - 3, 1, 3);
    }
  }
  // levande detaljer på bakväggen: klockan, ugnens glöd, dimman, ett flimrande lysrör
  function liveWall(ctx) {
    // klockan visar spelets tid
    const cx = 724, cy = 22, min = g.min % (12 * 60);
    const ha = (min / 720) * Math.PI * 2 - Math.PI / 2, ma = ((g.min % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = '#2a2e36';
    for (let k = 0; k <= 3; k++) ctx.fillRect(Math.round(cx + Math.cos(ha) * k), Math.round(cy + Math.sin(ha) * k), 1, 1);
    ctx.fillStyle = '#5a5e68';
    for (let k = 0; k <= 5; k++) ctx.fillRect(Math.round(cx + Math.cos(ma) * k), Math.round(cy + Math.sin(ma) * k), 1, 1);
    ctx.fillStyle = '#d8323a'; ctx.fillRect(cx, cy, 1, 1);
    // bake-off-ugnens glöd flimrar
    const fl = 0.18 + Math.sin(t * 7) * 0.05 + Math.sin(t * 13.3) * 0.03;
    ctx.globalAlpha = fl; ctx.drawImage(R.glowWarm, 670 - 27, 50 - 13); ctx.globalAlpha = 1;
    // dimspridarna i grönsaksväggen sprutar ibland
    const ph = (t % 6) / 6;
    if (ph < 0.25) {
      ctx.fillStyle = 'rgba(240,250,255,.55)';
      for (let x = GREENS.x0 + 8; x < GREENS.x1 - 6; x += 12) for (let k = 0; k < 4; k++) {
        const yy = GREENS.top + 21 + Math.floor(ph * 40) + k * 2, xx = x + ((k * 3 + Math.floor(t * 20)) % 5) - 2;
        if (bayer(xx, yy) < 0.5) ctx.fillRect(xx, yy, 1, 1);
      }
    }
    // ett lysrör flimrar
    if (Math.sin(t * 23) > 0.7 && Math.sin(t * 1.3) > 0.5) { ctx.fillStyle = 'rgba(40,44,54,.7)'; ctx.fillRect(405, 3, 26, 3); }
    // kylarnas LED blinkar svagt i takt
    ctx.globalAlpha = 0.12 + Math.sin(t * 2) * 0.03; ctx.drawImage(R.glowCool, (DAIRY.x0 + DAIRY.x1) / 2 - 31, DAIRY.top + 1); ctx.globalAlpha = 1;
  }
  function fog(ctx, F) {
    ctx.fillStyle = 'rgba(235,248,255,.35)';
    for (let x = F.x0 + 4; x < F.x1 - 4; x += 3) {
      const y = F.base - 20 - ((Math.floor(t * 3 + x * 0.37)) % 4);
      if (bayer(x, y) < 0.45) ctx.fillRect(x, y, 1, 1);
    }
  }
  function liveKassa(ctx, K) {
    const top = K.base - 26;
    // rullbandets ribbor rör sig när bandet går
    const moving = belt && !belt.done && belt.items.some((i) => i.st === 'belt');
    const off = moving ? Math.floor(t * 34) % 4 : 0;
    ctx.fillStyle = '#3a3a44';
    for (let x = BELT.x0 + off; x < BELT.x1; x += 4) ctx.fillRect(x, top + 3, 1, 7);
    // skannerns laser
    ctx.fillStyle = belt?.flash ? '#ffffff' : Math.floor(t * 3) % 2 ? '#ff3a3a' : '#c02020';
    ctx.fillRect(K.x0 + 51, top + 7, 6, 1);
    // skärmen mot kunden: summan
    const sum = belt ? belt.total : 0;
    ctx.fillStyle = '#1a3a2a'; ctx.fillRect(K.x0 + 60, top - 14, 12, 6);
    ctxText(ctx, SM, String(sum).slice(-3), K.x0 + 71 - textW(SM, String(sum).slice(-3)), top - 13, belt?.flash ? '#ffffff' : '#6fe08a');
    // varorna på bandet
    if (belt) for (const it of belt.items) {
      if (it.st === 'done' || it.x < BELT.x0 - 2) continue;
      const x = Math.round(it.x) - 4, y = it.st === 'bag' ? top - 7 - Math.round(Math.sin(Math.min(1, it.t / 0.35) * Math.PI) * 5) : top - 5;
      drawIcon(ctx, it.id, x, y);
    }
  }
  function liveGrill(ctx) {
    const gx = GRILL.x0 + 6, gy = GRILL.base - 32;
    // korvarna rullar
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      const x = gx + 3 + k * 8, y = gy + 1 + r * 2, ph = (Math.floor(t * 4) + r + k) % 3;
      ctx.fillStyle = '#6a2a14'; ctx.fillRect(x, y, 7, 2);
      ctx.fillStyle = ['#c05a30', '#a84a28', '#d06a3a'][ph]; ctx.fillRect(x + 1, y, 5, 1);
      ctx.fillStyle = '#e8906a'; ctx.fillRect(x + 1 + ph, y, 1, 1);
    }
    // värmelampans glöd
    ctx.globalAlpha = 0.16 + Math.sin(t * 5) * 0.03; ctx.drawImage(R.glowWarm, gx + 18 - 27, gy - 10); ctx.globalAlpha = 1;
    // ånga från kaffemaskinen
    const cx0 = GRILL.x1 - 26;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let k = 0; k < 4; k++) { const ph = (t * 0.8 + k * 0.25) % 1; ctx.fillRect(Math.round(cx0 + 10 + Math.sin(ph * 7 + k) * 1.5), Math.round(GRILL.base - 30 - ph * 10), 1, 1); }
  }

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => {
        const s = spotById(id);
        if (!s) return null;
        const x = s.food ? s.food.tag[0] : (s.r[0] + s.r[2]) / 2;
        const y = s.food ? s.food.tag[1] + 9 : (s.r[1] + s.r[3]) / 2;
        return { x: x - cam.x, y: y - cam.y };
      },
      basket: () => groups().map(({ f, n }) => ({ id: f.id, name: f.name, n, price: f.price })),
      basketIds: () => [...basket],
      total: () => total(),
      pick: (id) => { const s = spots.find((x) => x.id === id && x.food); return s ? addToBasket(s.food) : false; },
      checkout: () => pay(),
      eat: (id) => { const r = g.buyFood(id, { eatNow: true }); if (r.ok) { g.passTime(15); g.save(); play('coin'); } return r; },
      displays: () => R.displays.map((s) => ({ id: s.f.id, kind: s.d.kind, tag: s.tag, go: s.go })),
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: clamp(x, 0, W - VW), y: clamp(y ?? cam.y, 0, H - VH) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { sit = null; walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => ({ ...cam }),
      pos: () => ({ x: walker.px, y: walker.py, path: walker.path.length }),
      belt: () => (belt ? { total: belt.total, done: !!belt.done, items: belt.items.map((i) => i.st) } : null),
      sit: () => (sit ? { ...sit } : null),
      shoppers: () => shoppers.map((s) => ({ x: Math.round(s.w.px), y: Math.round(s.w.py), dir: s.w.dir, carry: s.carry, path: s.w.path.length })),
      placeShopper: (i, x, y, wait = 999) => { const s = shoppers[i]; if (!s) return false; s.w.px = x; s.w.py = y; s.w.stop(); s.w.dir = 'up'; s.wait = wait; return true; },
      signHides: (x, y) => !!signHides(x, y),
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, 0, W, H);
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      // update() svarar true även på steget då figuren kommer fram (och sätter sig) –
      // bara en pågående promenad reser figuren från pallen
      if (walker.update(dt) && walker.path.length) sit = null;
      if (sit) { sit.t += dt; if (sit.eat && sit.t > 4.5) { sit.eat = null; sit.ate = true; } }
      // skjutdörrarna öppnas när någon är nära
      const near = [{ x: walker.px, y: walker.py }, ...shoppers.map((s) => ({ x: s.w.px, y: s.w.py }))].some((p) => Math.abs(p.x - DOOR_X) < 30 && p.y > FRONT_Y - 34);
      door += ((near ? 1 : 0) - door) * Math.min(1, dt * 5);
      if (near && !doorWas && Math.abs(walker.px - DOOR_X) < 40 && walker.py > FRONT_Y - 40) play('slide');
      doorWas = near;
      updateShoppers(dt);
      updateBelt(dt);
      if (receiptOpen && !modalOpen()) cancelScan();
      if (belt && !belt.done && !walker.path.length && Math.hypot(walker.px - (K1.x0 + 50), walker.py - (K1.base + 12)) > 14) cancelScan();
      for (let i = flies.length - 1; i >= 0; i--) { flies[i].t += dt; if (flies[i].t > 0.4) flies.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1) pops.splice(i, 1); }
      for (let i = bubbles.length - 1; i >= 0; i--) { bubbles[i].t += dt; if (bubbles[i].t > 2.4) bubbles.splice(i, 1); }
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },

    down(sx, sy) {
      hoverId = null;
      for (const h of panelHits) if (sx >= h.r[0] && sx <= h.r[2] && sy >= h.r[1] && sy <= h.r[3]) { h.act(); return; }
      const x = sx + cam.x, y = sy + cam.y;
      const s = spotAt(x, y);
      if (belt && !belt.done && s?.id !== 'kassa') cancelScan();
      if (s) { clickSpot(s, x); return; }
      sit = null;
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy + cam.y)?.id || null; hoverT = t; },

    draw(ctx) {
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawPanel(ctx);
      const focus = focusSpot();
      if (focus) bigLabel(ctx, focus, walker.py - cam.y > VH - 50);
    },
  };
}
