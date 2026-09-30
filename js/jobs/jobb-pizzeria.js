// Pizzerian – PIZZERIA NAPOLI. Baka rätt pizza åt rätt kund!
// Kunder kommer in från gatan till höger. De flesta sätter sig vid ett
// rutigt bord (äter här = TALLRIK), en del ställer sig vid TA MED-skylten
// (avhämtning = KARTONG). Pratbubblan visar pizzan de vill ha – med påläggen
// – och en liten tallrik eller kartong. Övre bordsraden har bubblan ovanför
// huvudet; nedre raden (borden under bänken och TA MED-kön) får bubblan vid
// sidan, i brösthöjd, så att ingen bubbla någonsin ligger över gången där
// kunderna går in och ut (bagaren når alla från höger sida).
// Så bakar man, steg för steg (varje steg syns på degen):
//   1. DEG ur jäslådan → ut på den mjöliga bänken
//   2. TOMATSÅS ur kastrullen, OST ur osthon och rätt PÅLÄGG ur backarna
//   3. in i VEDUGNEN med spaden (två platser). Timern under öppningen visar
//      gräddningen: tas pizzan ut för tidigt är den blek, för sent är den bränd
//   4. vid passet: på en TALLRIK eller i en KARTONG
//   5. servera rätt kund – fel pizza, blek/bränd pizza eller fel förpackning
//      ger avdrag. Kunder som väntar för länge går. Soptunnan tar felbak.
// Pizzabagaren står bakom bänken och vänder ansiktet mot oss, så att degen
// syns framför hen. Allt statiskt målas EN gång (rummet och bänken); pizzorna
// är procedurella pixelkartor i skala 1 som cachas per tillstånd.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, ctxText, textW, text, eachTextPixel, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { FRAMES } from '../data/frames.js';
import { ATLAS } from '../scenes/room.js';
import { JOBS } from '../game.js';

const FW = 384, FH = 216;
const WALL_B = 84;                 // där bakväggen möter golvet
const KX1 = 236;                   // köksväggen slutar här (pelaren 236–245)
// vedugnen: mosaikkupol, valv (munnen), stenhylla (apron) och tegelfot med vedförråd
const OV = { cx: 121, rx: 49, ry: 40, by: 62, mx0: 99, mx1: 143, mTop: 42, mSpring: 50, base: 68, bot: 94 };
const SLOT_X = [110, 132];         // ugnens två platser (mitten av pizzan)
const SLOT_TOP = 53;               // pizzasprajtens överkant inne i ugnen
const OVEN_STAND = [OV.mx0 - 8, OV.mx1 + 8];   // bagaren står snett vid sidan av munnen – då skymmer hen inte timrarna
const OVEN_POP_Y = 56;             // ugnens puffar ("KLAR!") stiger ur munnen, inte över NAPOLI-mosaiken
// passet: rostfri disk vid väggen med tallrikar och kartonger
const PASS = { x0: 178, x1: 234, top: 68, front: 74, base: 92, plates: 192, boxes: 219 };
// bänken (mitt i köket): skivan 108–123, fronten 124–139
const ISL = { x0: 18, x1: 218, top: 108, front: 124, base: 140 };   // passage runt båda ändarna
const WS = { x: 110, y: 115 };     // degens plats på bänken (pizzans mitt)
const STAND_Y = 121;               // där bagaren står bakom bänken
// sakerna på bänken, från vänster
const BINS = [
  { id: 'deg', x: 37, name: 'DEG' },
  { id: 'sas', x: 64, name: 'TOMATSÅS' },
  { id: 'ost', x: 82, name: 'OST' },
  { id: 'skinka', x: 138, name: 'SKINKA' },
  { id: 'ananas', x: 156, name: 'ANANAS' },
  { id: 'champinjoner', x: 174, name: 'CHAMPINJONER' },
  { id: 'kebab', x: 192, name: 'KEBAB' },
];
// rutiga bord (kunden sitter på stolen bakom bordet, vänd mot oss)
const TABLES = [{ x: 256, y: 146 }, { x: 326, y: 146 }, { x: 44, y: 208 }, { x: 128, y: 208 }]
  .map((tb) => ({ ...tb, sx: tb.x + 11, sy: tb.y - 8 }));
// en van bagare får ett bord till: mitt i övre raden (luckan 280–326 räcker precis – gången på
// var sida är 9 px, bubblorna nuddar inte varandra). Fler får inte plats i matsalen.
const EXTRA_TABLES = [{ x: 291, y: 146 }].map((tb) => ({ ...tb, sx: tb.x + 11, sy: tb.y - 8 }));
// TA MED-kön: skylten först, sedan bubbla + kund, bubbla + kund (bagaren serverar från höger)
const TAKE = [{ x: 292, y: 212 }, { x: 358, y: 212 }];   // TA MED-platserna
const SIGN = { x: 240, y: 208 };                          // TA MED-skylten
const TREE = { x: 190, y: 207 }, BARREL = { x: 214, y: 207 };
const PLANT = { x: 358, y: 116 };                         // krukväxt i hörnet (atlasens vaxtS0)
const AISLE_Y = 168;               // gången kunderna går in och ut i (figuren är 39 px hög: 129–168)
const SIDE_BUBBLE_Y = 30;          // nedre radens bubbla: överkanten så här långt ovanför fötterna (under gången)
const BUBBLE_W = 32, BUBBLE_H = 23;   // bubblans yttermått (innermått 30×21)
const T_OK = 4.5, T_BURN = 9;      // sekunder i ugnen: gyllene mellan 4,5 och 9
const T_MAX = T_BURN + 2;          // timerns fulla längd
const CHAIR_F = 'matstol3', TABLE_F = 'bordR1', CHAIR_LIFT = 5;

// ---------- pizzorna och påläggen ----------
const PIZZAS = [
  { id: 'margherita', name: 'MARGHERITA', tops: [], price: 95, mark: 'M' },
  { id: 'vesuvio', name: 'VESUVIO', tops: ['skinka'], price: 105, mark: 'V' },
  { id: 'hawaii', name: 'HAWAII', tops: ['skinka', 'ananas'], price: 110, mark: 'H' },
  { id: 'capricciosa', name: 'CAPRICCIOSA', tops: ['skinka', 'champinjoner'], price: 115, mark: 'C' },
  { id: 'kebab', name: 'KEBABPIZZA', tops: ['kebab'], price: 125, mark: 'K' },
];
// bitarnas pixelmönster i tre storlekar (a = ljus, b = bas, c = mörk)
const TOPS = [
  { id: 'skinka', pal: { a: 0xfaaabb, b: 0xe8708a, c: 0xa43e58 }, big: ['aab', 'bbc'], mid: ['ab', 'bc'], tiny: ['b'] },
  { id: 'ananas', pal: { a: 0xfff4a0, b: 0xffd21e, c: 0xc07a0c }, big: ['ab.', 'bbc'], mid: ['ab', 'bc'], tiny: ['b'] },
  { id: 'champinjoner', pal: { a: 0x8a6a4e, b: 0xd8c8b0, c: 0x523824 }, big: ['aba', '.c.'], mid: ['ba', 'c.'], tiny: ['a'] },
  { id: 'kebab', pal: { a: 0xb8703c, b: 0x7c3e1e, c: 0x4a220e }, big: ['ab.', '.bc'], mid: ['ab', '.c'], tiny: ['c'] },
];
const TOP_IX = Object.fromEntries(TOPS.map((tp, i) => [tp.id, i]));
// gräddningsgrad: 0 rå, 1 ljummen, 2 blek, 3 gyllene (klar), 4 bränd
const stageOf = (b) => (b <= 0 ? 0 : b < T_OK * 0.5 ? 1 : b < T_OK ? 2 : b < T_BURN ? 3 : 4);
const CRUST = [   // [ljus, mellan, mörk, fläck]
  [0xf8e8c8, 0xeacfa0, 0xc8a476, 0xc8a476],
  [0xf6e0b4, 0xe6c490, 0xc49c66, 0xbc9460],
  [0xf4d49c, 0xe0b474, 0xb88a50, 0xa87c48],
  [0xf6be66, 0xd68e3c, 0x9e5c26, 0x4a2a16],
  [0x7a4a2a, 0x54301c, 0x341c10, 0x1a0e08],
];
const SAUCE = [
  [0xf46c4a, 0xe04830, 0xb42c20],
  [0xee6444, 0xd8422c, 0xac2a1e],
  [0xe45c3c, 0xd03e28, 0xa4281c],
  [0xdc5034, 0xc03424, 0x8e2218],
  [0x7a2a18, 0x5a1c10, 0x3a120a],
];
const CHEESE = [  // [ljus, bas, gyllene, brun fläck]
  [0xfffcf4, 0xf0e2c2, 0xf0e2c2, 0xf0e2c2],
  [0xfff8e6, 0xf6e8c6, 0xf0dcb0, 0xf0dcb0],
  [0xfff6dc, 0xfbeac2, 0xf4da9c, 0xeac88a],
  [0xfff8e4, 0xfbecc4, 0xf0c878, 0xb4723a],
  [0x9a6a3a, 0x7a4e28, 0x5a381c, 0x2a180c],
];
const SIZES = {
  L: { rx: 15, ry: 6, cw: 2, th: 2, k: 4, piece: 'big' },   // på bänken
  C: { rx: 11, ry: 5, cw: 2, th: 1, k: 3, piece: 'big' },   // på spaden, tallriken
  B: { rx: 9, ry: 6, cw: 1, th: 1, k: 3, piece: 'big' },    // i pratbubblan
  O: { rx: 9, ry: 3, cw: 1, th: 1, k: 2, piece: 'tiny' },   // inne i ugnen
  T: { rx: 7, ry: 3, cw: 1, th: 1, k: 2, piece: 'tiny' },   // på bordet
  M: { rx: 5, ry: 3, cw: 1, th: 0, k: 1, piece: 'tiny' },   // på menytavlan
};
// vilken pizza är det här? (−1 = ingen på menyn)
function kindOf(pz) {
  if (!pz || !pz.sauce || !pz.cheese) return -1;
  const key = [...pz.tops].sort().join(',');
  return PIZZAS.findIndex((p) => [...p.tops].sort().join(',') === key);
}
const perfect = (kind) => ({ sauce: true, cheese: true, tops: [...PIZZAS[kind].tops], bake: T_OK + 1.5 });

// ---------- pixelrutnät (sprites byggs som rutnät, konturen läggs på sist) ----------
const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const grid = (w, h) => ({ w, h, d: new Array(w * h).fill(-1) });
const gget = (G, x, y) => (x < 0 || y < 0 || x >= G.w || y >= G.h ? -1 : G.d[y * G.w + x]);
function gset(G, x, y, c) { if (x >= 0 && y >= 0 && x < G.w && y < G.h) G.d[y * G.w + x] = c; }
function gblit(G, S, ox, oy) { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const v = S.d[y * S.w + x]; if (v !== -1) gset(G, x + ox, y + oy, v); } }
// 1 px "sel-out"-kontur: mörkare ton av grannpixeln
function outlined(G) {
  const O = grid(G.w + 2, G.h + 2);
  gblit(O, G, 1, 1);
  const src = O.d.slice();
  for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
    if (src[y * O.w + x] !== -1) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= O.w || yy >= O.h || src[yy * O.w + xx] === -1) continue;
      O.d[y * O.w + x] = mix(mul(src[yy * O.w + xx], 0.42), 0x1c1418, 0.4);
      break;
    }
  }
  return O;
}
function gCanvas(G) {
  const c = newCanvas(G.w, G.h), x2 = c.getContext('2d');
  for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
    const v = G.d[y * G.w + x];
    if (v === -1) continue;
    x2.fillStyle = css(v); x2.fillRect(x, y, 1, 1);
  }
  return c;
}
const inEll = (x, y, cx, cy, rx, ry) => { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; };

// Pizzan som rutnät (utan kontur). Tjockleken (kanten) syns som mörkare rader nedtill.
function pizzaGrid(pz, S) {
  const { rx, ry, cw, th } = S, W = rx * 2, H = ry * 2 + th, G = grid(W, H);
  const st = stageOf(pz.bake), CR = CRUST[st];
  const inE = (x, y) => y < ry * 2 && inEll(x, y, rx, ry, rx, ry);
  const inI = (x, y) => inEll(x, y, rx, ry, rx - cw, Math.max(1, ry - 1));
  // kanten (tjockleken)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inE(x, y)) continue;
    for (let j = 1; j <= th; j++) if (y - j >= 0 && inE(x, y - j)) { gset(G, x, y, j === th ? mul(CR[2], 0.78) : CR[2]); break; }
  }
  const iry = Math.max(1, ry - 1);
  for (let y = 0; y < ry * 2; y++) for (let x = 0; x < W; x++) {
    if (!inE(x, y)) continue;
    const dx = (x + 0.5 - rx) / rx, dy = (y + 0.5 - ry) / ry;
    const lt = -dx * 0.5 - dy * 0.8;                      // ljuset faller uppifrån vänster
    let c;
    if (!inI(x, y)) {                                     // kanten
      c = lt > 0.3 ? CR[0] : lt < -0.45 ? CR[2] : CR[1];
      if (st >= 3 && hash(x, y, 71) < (st === 4 ? 0.4 : 0.14)) c = CR[3];
    } else {
      const di = Math.hypot((x + 0.5 - rx) / (rx - cw), (y + 0.5 - ry) / iry);   // 0 i mitten, 1 vid kanten
      if (!pz.sauce) {                                    // bara deg (mjölig)
        c = mix(CR[0], 0xfff6e0, st ? 0.1 : 0.35);
        if (lt < -0.4) c = mix(c, CR[1], 0.5);
        if (hash(x, y, 23) < 0.12) c = st ? CR[1] : 0xfffcf4;
      } else {
        const sp = SAUCE[st];
        c = lt > 0.35 ? sp[0] : lt < -0.4 ? sp[2] : sp[1];
        if (hash(x, y, 17) < 0.1) c = sp[2];
      }
      if (pz.cheese) {
        const ch = CHEESE[st];
        if (st <= 1) {                                    // riven ost: korta strimlor
          if (hash((x + (y & 1)) >> 1, y, 13) < (st ? 0.72 : 0.62)) c = (((x + (y & 1)) >> 1) + y) & 1 ? ch[0] : ch[1];
        } else if (di < 0.84 || rx <= 6) {                // smält – en tunn röd såsring syns innanför kanten
          c = lt > 0.35 ? ch[0] : lt < -0.45 ? ch[2] : ch[1];
          const h = hash(x, y, 31);
          if (h < (st === 4 ? 0.45 : st === 3 ? 0.07 : 0.02)) c = ch[3];
          else if (h > 0.94) c = ch[2];
        }
      }
    }
    gset(G, x, y, c);
  }
  // basilika på en färdig margherita
  if (pz.sauce && pz.cheese && !pz.tops.length && st >= 2 && st < 4 && ry >= 3) {
    const leaves = ry >= 5 ? [[-3, -1], [2, 0], [-1, 2]] : [[-1, 0], [2, 0]];
    for (const [lx, ly] of leaves) { gset(G, rx + lx, ry + ly, 0x3a9a3a); gset(G, rx + lx + 1, ry + ly, 0x1e6a28); if (ry >= 5) gset(G, rx + lx, ry + ly - 1, 0x6ac85a); }
  }
  // påläggen: fasta platser i en solrosspiral, var fjärde plats per pålägg.
  // Varje bit får en liten skugga under sig så att den lyfter från osten.
  const N = S.k * 4, tone = (c) => (st === 4 ? mix(c, 0x2a1810, 0.6) : st === 3 ? mul(c, 0.93) : c);
  const pieces = [];
  for (let i = 0; i < N; i++) {
    const tp = TOPS[i % 4];
    if (!pz.tops.includes(tp.id)) continue;
    const r = Math.sqrt((i + 0.6) / N) * 0.9, a = i * 2.39996 + 0.5;
    const cx = rx + Math.cos(a) * r * (rx - cw - 1), cy = ry + Math.sin(a) * r * Math.max(0.5, ry - 1.6);
    const pat = tp[S.piece], pw = pat[0].length, ph = pat.length;
    const x0 = Math.round(cx - pw / 2), y0 = Math.round(cy - ph / 2);
    for (let yy = 0; yy < ph; yy++) for (let xx = 0; xx < pw; xx++) {
      const ch = pat[yy][xx];
      if (ch !== '.' && inI(x0 + xx, y0 + yy)) pieces.push([x0 + xx, y0 + yy, tone(tp.pal[ch])]);
    }
  }
  const taken = new Set(pieces.map(([x, y]) => y * W + x));
  if (S.piece !== 'tiny') for (const [x, y] of pieces) if (!taken.has((y + 1) * W + x) && inI(x, y + 1)) { const u = gget(G, x, y + 1); if (u !== -1) gset(G, x, y + 1, mul(u, 0.7)); }
  for (const [x, y, c] of pieces) gset(G, x, y, c);
  // kebabsås: en vit sicksack över köttet
  if (pz.tops.includes('kebab')) {
    const L = rx - cw - 2, amp = Math.max(0, ry - 3);
    for (let x = rx - L; x < rx + L; x++) {
      const y = Math.round(ry - 0.5 + ((((x >> 1) & 1) ? 1 : -1) * amp) * 0.5);
      if (inI(x, y) && (S.piece !== 'tiny' || (x & 1))) gset(G, x, y, st === 4 ? 0x8a7a60 : 0xfff6e6);
    }
  }
  return G;
}
const SPR = new Map();
function cached(key, make) { let c = SPR.get(key); if (!c) { c = make(); SPR.set(key, c); } return c; }
const pzKey = (pz) => `${pz.sauce ? 1 : 0}${pz.cheese ? 1 : 0}|${[...pz.tops].sort().join(',')}|${stageOf(pz.bake)}`;
function pizzaSprite(pz, size) { return cached(`pz${size}|${pzKey(pz)}`, () => gCanvas(outlined(pizzaGrid(pz, SIZES[size])))); }

// tallrik (ovanifrån, snett): kant + fördjupning + tjocklek
function plateGrid(rx, ry) {
  const G = grid(rx * 2, ry * 2 + 1);
  for (let y = 0; y < ry * 2 + 1; y++) for (let x = 0; x < rx * 2; x++) {
    const top = y < ry * 2 && inEll(x, y, rx, ry, rx, ry);
    if (!top) { if (y > 0 && inEll(x, y - 1, rx, ry, rx, ry)) gset(G, x, y, 0xaeb6c2); continue; }
    const well = inEll(x, y, rx, ry, rx - 2, ry - 1);
    const dx = (x + 0.5 - rx) / rx, dy = (y + 0.5 - ry) / ry;
    let c = well ? 0xeef1f4 : (dy < -0.2 || dx < -0.5 ? 0xffffff : 0xdfe4ea);
    if (!well && inEll(x, y, rx, ry, rx - 1, ry - 0.5) && dy > 0) c = 0xd6dce4;
    gset(G, x, y, c);
  }
  return G;
}
// spaden (träblad) med pizzan
function spadeSprite(pz) {
  return cached('spade|' + pzKey(pz), () => {
    const G = grid(26, 13);
    for (let y = 0; y < 13; y++) for (let x = 0; x < 26; x++) {
      if (y < 12 && inEll(x, y, 13, 6, 13, 6)) { const l = (x - 13) / 13 + (y - 6) / 6; gset(G, x, y, l < -0.6 ? 0xf0cc90 : l > 0.6 ? 0xb88848 : hash(x, y, 5) < 0.2 ? 0xd0a060 : 0xdcae6c); }
      else if (y > 0 && inEll(x, y - 1, 13, 6, 13, 6)) gset(G, x, y, 0x8a6030);
    }
    gblit(G, pizzaGrid(pz, SIZES.C), 2, 0);
    return gCanvas(outlined(G));
  });
}
function plateSprite(pz) {
  return cached('tallrik|' + pzKey(pz), () => {
    const G = plateGrid(14, 6);
    gblit(G, pizzaGrid(pz, SIZES.C), 3, 1);
    return gCanvas(outlined(G));
  });
}
// kartongen: lock (kraftpapp med tryck) + framkant, handskriven bokstav på en lapp
function boxGrid(mark) {
  const G = grid(24, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 24; x++) {
    let c;
    if (y === 0) c = 0xf0d49c;
    else if (y < 8) c = hash(x, y, 7) < 0.1 ? 0xd4a868 : x === 0 ? 0xe8c890 : 0xdcb478;
    else if (y === 8) c = 0xecca90;
    else c = y === 10 ? 0x8a6430 : 0xb88a4c;
    gset(G, x, y, c);
  }
  // röd tryckt logga (en ring med en liten pizza) + tryckt rand
  for (let y = 1; y < 8; y++) for (let x = 2; x < 11; x++) {
    const d = Math.hypot((x + 0.5 - 6.5) / 4.2, (y + 0.5 - 4.5) / 3.2);
    if (d > 0.72 && d <= 1) gset(G, x, y, 0xc8302a);
    else if (d <= 0.45) gset(G, x, y, 0xe05a3a);
  }
  for (let x = 1; x < 23; x += 2) gset(G, x, 9, 0xc8302a);
  // lappen med bokstaven
  for (let y = 1; y < 7; y++) for (let x = 14; x < 21; x++) gset(G, x, y, y === 6 ? 0xd8d2c4 : 0xfdfaf2);
  eachTextPixel(SMALL, mark, 16, 1, 1, (px, py) => gset(G, px, py, 0x2a2a3a));
  return G;
}
function boxSprite(pz) { const k = kindOf(pz); return cached('box|' + k, () => gCanvas(outlined(boxGrid(k >= 0 ? PIZZAS[k].mark : '?')))); }
function carrySprite(c) { return c.on === 'spade' ? spadeSprite(c.pz) : c.on === 'tallrik' ? plateSprite(c.pz) : boxSprite(c.pz); }
// pizzan på bordet (och kanterna som blir kvar)
function tablePlate(pz, eaten) {
  return cached(`bord|${eaten ? 'x' : pzKey(pz)}`, () => {
    const G = plateGrid(9, 4);
    if (!eaten) gblit(G, pizzaGrid(pz, SIZES.T), 2, 1);
    else {
      const CR = CRUST[3];
      for (const [x, y, c] of [[4, 3, CR[1]], [5, 3, CR[0]], [6, 4, CR[2]], [11, 2, CR[1]], [12, 2, CR[0]], [13, 3, CR[2]], [9, 5, CR[1]], [10, 5, CR[2]], [7, 2, 0xc03424]]) gset(G, x, y, c);
      for (const [x, y, c] of [[13, 5, 0xf4f1ea], [14, 5, 0xdcd6ca], [14, 4, 0xffffff], [15, 5, 0xb8b0a0]]) gset(G, x, y, c);   // servett
    }
    return gCanvas(outlined(G));
  });
}
// små ikoner i pratbubblan: tallrik (äter här) och kartong (ta med)
const ICON = {
  get plate() { return cached('ikon-tallrik', () => gCanvas(outlined(plateGrid(4, 2)))); },
  get box() {
    return cached('ikon-kartong', () => {
      const G = grid(8, 6);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) gset(G, x, y, y === 0 ? 0xf0d49c : y < 4 ? 0xdcb478 : y === 4 ? 0xb88a4c : 0x8a6430);
      gset(G, 2, 2, 0xc8302a); gset(G, 3, 2, 0xc8302a); gset(G, 2, 1, 0xe05a3a); gset(G, 5, 2, 0xfdfaf2); gset(G, 6, 2, 0xfdfaf2);
      return gCanvas(outlined(G));
    });
  },
};

// Pratbubbla med rundade hörn och spets nedåt i (cx, tip) – samma som i burgarbaren.
function bubble(ctx, cx, tip, iw, ih, hot = false) {
  const w = iw + 2, h = ih + 2, x0 = cx - (w >> 1), y0 = tip - 2 - h;
  ctx.fillStyle = hot ? '#e8b230' : '#17151a';
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.fillRect(cx - 1, tip - 2, 3, 2); ctx.fillRect(cx, tip, 1, 1);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  ctx.fillRect(cx, tip - 2, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
  if (hot) { ctx.fillStyle = '#ffe07a'; ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3); }
  return [x0 + 1, y0 + 1];
}
// Samma bubbla med spetsen åt höger (för nedre raden: bubblan står vid sidan
// av kunden i brösthöjd). (x0, y0) är bubblans övre vänstra hörn.
function bubbleSide(ctx, x0, y0, iw, ih, hot = false) {
  const w = iw + 2, h = ih + 2, ty = y0 + 10;
  ctx.fillStyle = hot ? '#e8b230' : '#17151a';
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.fillRect(x0 + w, ty - 1, 2, 3); ctx.fillRect(x0 + w + 2, ty, 1, 1);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  ctx.fillRect(x0 + w - 1, ty, 3, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
  if (hot) { ctx.fillStyle = '#ffe07a'; ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3); }
  return [x0 + 1, y0 + 1];
}

// ugnsvalvets överkant i en viss kolumn (för att klippa lågorna)
function archTop(x) {
  const dx = (x + 0.5 - OV.cx) / 22;
  return Math.abs(dx) >= 1 ? OV.mSpring : Math.ceil(OV.mSpring - 8 * Math.sqrt(1 - dx * dx));
}
const inMouth = (x, y) => x >= OV.mx0 && x < OV.mx1 && y >= OV.mTop && y < OV.by && y >= archTop(x);

export function makeJobbPizzeria(A, { onDone } = {}) {
  const stats = { ok: 0, fel: 0, miss: 0, brand: 0 };
  const P = planOf(A);   // passets plan: längd (P.seconds), kundtakt (P.pace), extra bord (P.extra)
  const tables = [...TABLES, ...EXTRA_TABLES.slice(0, P.extra)];
  const wage = JOBS?.pizzeria?.wage;
  const walker = createWalker({ top: 96, bottom: FH - 5, spawn: [WS.x, STAND_Y] });
  walker.setObstacles([
    [2, 84, 21, 97],                                       // soptunnan
    [74, 84, 168, 95],                                     // vedugnen
    [PASS.x0, 84, PASS.x1, 93],                            // passet
    [ISL.x0, ISL.front + 1, ISL.x1, ISL.base],             // bänken
    // övre bordsraden spärras ända upp till väggen: bagaren ska aldrig gå bakom deras bubblor
    ...tables.map((tb) => [tb.x - 2, tb.y > AISLE_Y ? tb.y - 16 : WALL_B, tb.x + 24, tb.y + 1]),
    [TREE.x - 8, TREE.y - 7, TREE.x + 8, TREE.y + 1],
    [BARREL.x - 8, BARREL.y - 7, BARREL.x + 8, BARREL.y + 1],
    [SIGN.x - 12, SIGN.y - 5, SIGN.x + 12, SIGN.y + 1],
    [PLANT.x, PLANT.y - 7, PLANT.x + 22, PLANT.y + 1],
    // nedre radens bubbelzoner (hela vägen ner till kanten): bagaren ska aldrig stå bakom en bubbla
    ...tables.filter((tb) => tb.y > AISLE_Y).map((tb) => [tb.x - BUBBLE_W - 4, AISLE_Y, tb.x - 1, FH]),
    ...TAKE.map((sp) => [sp.x - BUBBLE_W - 10, AISLE_Y + 12, sp.x - 7, FH]),
  ]);
  const pops = makePops();
  let customers = [], t = 0, seq = 0, custIn = 3.5, carry = null, bench = null, parts = [];
  const oven = [null, null];
  let workT = 0, trashT = 0, hover = null;
  let done = false, doneT = 0, reported = false;
  const cache = {};
  const bg = () => (cache.bg ||= paintRoom());
  const island = () => (cache.isl ||= paintIsland());
  const decor = () => (cache.decor ||= paintDecor());
  const atlasOk = () => ATLAS && ATLAS.complete && ATLAS.naturalWidth > 0;
  const tableSpr = () => (cache.table ||= checkTable());
  const glow = () => (cache.glow ||= ovenGlow());

  // ---------- kunder ----------
  function freeTables() { return tables.filter((tb) => !customers.some((k) => k.table === tb)); }
  function freeSpots() { return [0, 1].filter((s) => !customers.some((k) => k.take && k.spot === s)); }
  function spawn(now, kind, take) {
    const tbs = freeTables(), sps = freeSpots();
    if (!tbs.length && !sps.length) return null;
    if (take === undefined) take = sps.length > 0 && (!tbs.length || Math.random() < 0.34);
    if (take && !sps.length) take = false;
    if (!take && !tbs.length) take = true;
    const pat = (take ? 44 : 50) - 8 * Math.min(1, t / P.seconds);
    const k = { look: makeLook(), take, wish: kind ?? ((Math.random() * PIZZAS.length) | 0), patience: pat, pmax: pat, eat: 0, id: seq++, dir: 'left', state: 'walk', x: FW + 12, y: AISLE_Y };
    if (take) {
      k.spot = now ? sps[0] : sps[(Math.random() * sps.length) | 0];
      const sp = TAKE[k.spot];
      k.path = [[sp.x, AISLE_Y], [sp.x, sp.y]];
    } else {
      k.table = now ? tbs[0] : tbs[(Math.random() * tbs.length) | 0];
      k.path = [[k.table.x - 10, AISLE_Y], [k.table.x - 10, k.table.sy], [k.table.sx, k.table.sy]];
    }
    if (now) { const [x, y] = k.path[k.path.length - 1]; k.x = x; k.y = y; k.path = []; k.state = 'sit'; k.dir = 'down'; }
    customers.push(k);
    return k;
  }
  function leave(k) {
    k.state = 'leave';
    k.path = k.take ? [[k.x, AISLE_Y], [FW + 16, AISLE_Y]]
      : [[k.table.x - 10, k.table.sy], [k.table.x - 10, AISLE_Y], [FW + 16, AISLE_Y]];
  }
  // nedre raden = TA MED-kön och borden under gången: bubblan står vid sidan
  const lowRow = (k) => k.take || k.table.y > AISLE_Y;
  const tipOf = (k) => Math.round(k.y) - (k.take ? 40 : 36);
  // bubblans ruta [x0, y0, x1, y1] – ovanför huvudet, eller till vänster i brösthöjd
  function bubbleRect(k) {
    if (!lowRow(k)) { const cx = Math.round(k.x), tip = tipOf(k); return [cx - (BUBBLE_W >> 1), tip - 2 - BUBBLE_H, cx + (BUBBLE_W >> 1), tip]; }
    const x1 = k.take ? Math.round(k.x) - 8 : k.table.x - 2, y0 = Math.round(k.y) - SIDE_BUBBLE_Y;
    return [x1 - BUBBLE_W, y0, x1 + 2, y0 + BUBBLE_H];
  }
  // där puffar ("GRAZIE!", "GICK HEM!") dyker upp: ovanför bubblan, eller strax över huvudet
  const popY = (k) => (lowRow(k) ? Math.round(k.y) - 50 : tipOf(k) - 32);
  function customerAt(x, y) {
    return customers.find((k) => {
      if (k.state !== 'sit') return false;
      const [bx0, by0, bx1, by1] = bubbleRect(k);
      if (x >= bx0 - 1 && x <= bx1 + 1 && y >= by0 - 1 && y <= by1 + 1) return true;   // bubblan
      if (Math.abs(x - k.x) <= 8 && y >= k.y - 39 && y <= k.y + 3) return true;         // kunden
      return !k.take && x >= k.table.x - 2 && x <= k.table.x + 24 && y >= k.table.y - 20 && y <= k.table.y + 2;
    });
  }
  const servePoint = (k) => (k.take ? [k.x + 16, k.y] : [k.table.x + 29, k.table.y + 1]);

  // ---------- hjälpare: tips, partiklar ----------
  // en upplysning (inte ett fel): mjukt klick, inte "miss"-ljudet som betyder att en kund gick
  function hint(txt, x, y) { pops.add(x, y, txt, '#ffd23f'); play('click'); }
  function sprinkle(fromX, fromY, cols, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      parts.push({ k: 'arc', x0: fromX + (Math.random() * 4 - 2), y0: fromY, x1: WS.x + Math.cos(a) * r * 11, y1: WS.y + Math.sin(a) * r * 3.5, t: -i * 0.018, dur: 0.3, h: 7 + Math.random() * 6, c: cols[i % cols.length] });
    }
  }
  function puff(x, y, cols, n = 10, spread = 12) {
    for (let i = 0; i < n; i++) parts.push({ k: 'puff', x: x + (Math.random() * 2 - 1) * spread, y: y + (Math.random() * 2 - 1) * 3, vx: (Math.random() * 2 - 1) * 10, vy: -4 - Math.random() * 8, life: 0.5 + Math.random() * 0.3, age: 0, c: cols[i % cols.length] });
  }
  function smoke(x, y) { parts.push({ k: 'smoke', x: x + Math.random() * 8 - 4, y, vx: Math.random() * 6 - 3, vy: -10 - Math.random() * 6, life: 1.6, age: 0 }); }
  function updParts(dt) {
    for (const p of parts) {
      if (p.k === 'arc') p.t += dt;
      else { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'puff') p.vy += 18 * dt; }
    }
    parts = parts.filter((p) => (p.k === 'arc' ? p.t < p.dur : p.age < p.life));
  }
  function drawParts(ctx) {
    for (const p of parts) {
      if (p.k === 'arc') {
        if (p.t < 0) continue;
        const q = p.t / p.dur, x = p.x0 + (p.x1 - p.x0) * q, y = p.y0 + (p.y1 - p.y0) * q - p.h * 4 * q * (1 - q);
        ctx.fillStyle = css(p.c); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      } else if (p.k === 'puff') {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = css(p.c); ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        ctx.globalAlpha = 1;
      } else if (p.k === 'smoke') {
        const q = p.age / p.life, s = q < 0.35 ? 2 : 3;
        ctx.fillStyle = `rgba(${q < 0.3 ? '96,90,88' : '168,162,160'},${(0.85 * (1 - q)).toFixed(2)})`;
        ctx.fillRect(Math.round(p.x) - (s >> 1), Math.round(p.y), s, s - 1);
      } else if (p.k === 'spark') {
        ctx.fillStyle = p.age < p.life * 0.5 ? '#ffe28a' : '#ff8a2a';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }
  }

  // ---------- stationerna ----------
  const work = () => { workT = 0.3; };
  const binById = (id) => BINS.find((b) => b.id === id);
  function actDough() {
    if (bench) { hint('BÄNKEN ÄR UPPTAGEN', WS.x, 96); return; }
    bench = { sauce: false, cheese: false, tops: [], bake: 0, id: seq++ };
    work(); play('click');
    puff(WS.x, WS.y - 1, [0xfffcf4, 0xf4ecdc, 0xffffff], 14, 13);
  }
  function actBin(id) {
    if (id === 'deg') { actDough(); return; }
    const b = binById(id);
    if (!bench) { hint('LÄGG EN DEG FÖRST', b.x, 98); return; }
    if (id === 'sas') {
      if (bench.sauce) { hint('SÅSEN FINNS REDAN', WS.x, 98); return; }
      bench.sauce = true; sprinkle(b.x, 110, [0xe04830, 0xf46c4a, 0xb42c20], 14);
    } else if (id === 'ost') {
      if (bench.cheese) { hint('OSTEN FINNS REDAN', WS.x, 98); return; }
      bench.cheese = true; sprinkle(b.x, 110, [0xfffcf4, 0xf0e2c2, 0xf6e8c6], 16);
    } else {
      if (bench.tops.includes(id)) { hint(b.name + ' FINNS REDAN', WS.x, 98); return; }
      bench.tops.push(id);
      const pal = TOPS[TOP_IX[id]].pal;
      sprinkle(b.x, 110, [pal.b, pal.a, pal.c], 10);
    }
    pops.add(WS.x, 96, '+' + b.name, '#f4f1ea');
    work(); play('click');
  }
  function actBench() {
    if (!carry && bench) { carry = { pz: bench, on: 'spade' }; bench = null; work(); play('click'); return; }
    if (!carry && !bench) { actDough(); return; }
    if (carry && !bench && carry.on === 'spade' && carry.pz.bake === 0) { bench = carry.pz; carry = null; work(); play('click'); return; }
    hint(carry && !bench && carry.pz.bake > 0 ? 'DEN ÄR REDAN GRÄDDAD' : 'HÄNDERNA ÄR FULLA', WS.x, 96);
  }
  function ovenIn(slot) {
    if (!carry || carry.on !== 'spade') return false;
    const s = !oven[slot] ? slot : !oven[1 - slot] ? 1 - slot : -1;
    if (s < 0) { hint('UGNEN ÄR FULL', OV.cx, OVEN_POP_Y); return true; }
    oven[s] = carry.pz; carry = null; play('slide'); work();
    puff(SLOT_X[s], 58, [0xffc040, 0xff7a1c, 0xfff0a0], 6, 6);
    return true;
  }
  function ovenOut(slot) {
    const s = oven[slot] ? slot : oven[1 - slot] ? 1 - slot : -1;
    if (s < 0) return false;
    carry = { pz: oven[s], on: 'spade' }; oven[s] = null; play('slide'); work();
    const st = stageOf(carry.pz.bake);
    pops.add(SLOT_X[s], OVEN_POP_Y, st === 3 ? 'GYLLENE!' : st === 4 ? 'BRÄND!' : 'BLEK!', st === 3 ? '#8ee03c' : '#ffd23f');
    return true;
  }
  function actOven(slot) {
    walker.dir = slot === 0 ? 'right' : 'left';   // står vid sidan, vänd mot munnen
    if (carry) {
      if (carry.on !== 'spade') { hint('DEN ÄR REDAN PACKAD', OV.cx, OVEN_POP_Y); return; }
      ovenIn(slot);
      return;
    }
    if (!ovenOut(slot)) hint('UGNEN ÄR TOM', OV.cx, OVEN_POP_Y);
  }
  function actVessel(kind) {
    walker.dir = 'up';
    const x = kind === 'tallrik' ? PASS.plates : PASS.boxes;
    if (!carry) { hint('HÄMTA EN PIZZA FÖRST', x, 50); return; }
    if (carry.on !== 'spade') { hint('DEN ÄR REDAN PACKAD', x, 50); return; }
    if (carry.pz.bake <= 0) { hint('GRÄDDA DEN FÖRST!', x, 50); return; }
    carry.on = kind; work(); play(kind === 'kartong' ? 'box' : 'click');
  }
  function actTrash() {
    if (!carry) { hint('INGET ATT SLÄNGA', 12, 72); return; }
    carry = null; trashT = 0.6; play('miss');
    pops.add(14, 72, 'SLÄNGD', '#d8d2c0');
  }
  function stationAt(x, y) {
    if (y >= 22 && y < 96 && x >= 78 && x < 166) return { k: 'ugn', slot: x < OV.cx ? 0 : 1, name: 'VEDUGNEN' };
    if (y >= 40 && y < 94 && x >= PASS.x0 && x < PASS.x1) return x < 206 ? { k: 'tallrik', name: 'TALLRIKAR' } : { k: 'kartong', name: 'KARTONGER' };
    if (y >= 78 && y < 99 && x >= 1 && x < 23) return { k: 'sopor', name: 'SOPTUNNAN' };
    if (y >= 100 && y < ISL.base + 1 && x >= ISL.x0 && x < ISL.x1) {
      if (Math.abs(x - WS.x) <= 16) return { k: 'bank', name: bench ? 'PIZZAN' : 'BÄNKEN' };
      let best = null, bd = 12;
      for (const b of BINS) { const d = Math.abs(b.x - x); if (d < bd) { best = b; bd = d; } }
      if (best) return { k: 'bin', bin: best, name: best.name };
    }
    return null;
  }
  // bagaren står mitt emellan backen och degen – då når hen båda
  const standX = (b) => (b.id === 'deg' ? b.x + 14 : Math.round((b.x + WS.x) / 2));
  function doStation(s) {
    if (s.k === 'ugn') {
      // tomma händer, tom plats och en pizza på bänken: hämta den och skjut in
      if (!carry && !oven[s.slot] && bench) {
        walker.walkTo(WS.x, STAND_Y, () => {
          if (carry || !bench) return;
          actBench();
          walker.walkTo(OVEN_STAND[s.slot], 97, () => actOven(s.slot));
        });
        return;
      }
      walker.walkTo(OVEN_STAND[s.slot], 97, () => actOven(s.slot));
    } else if (s.k === 'tallrik' || s.k === 'kartong') walker.walkTo(s.k === 'tallrik' ? PASS.plates : PASS.boxes, 97, () => actVessel(s.k));
    else if (s.k === 'sopor') walker.walkTo(26, 100, actTrash);
    else if (s.k === 'bank') walker.walkTo(WS.x, STAND_Y, actBench);
    else if (s.k === 'bin') walker.walkTo(standX(s.bin), STAND_Y, () => actBin(s.bin.id));
  }

  // ---------- servera ----------
  function tryServe(k) {
    if (!carry) { hint('HÄMTA PIZZAN FÖRST', k.x, popY(k)); return; }
    if (carry.on === 'spade') { hint(k.take ? 'I EN KARTONG FÖRST' : 'PÅ EN TALLRIK FÖRST', k.x, popY(k)); return; }
    serveTo(k);
  }
  function serveTo(k) {
    const pz = carry.pz, kind = kindOf(pz), st = stageOf(pz.bake);
    let why = null;
    if (kind !== k.wish) why = 'FEL PIZZA!';
    else if (st >= 4) why = 'BRÄND!';
    else if (st < 3) why = 'FÖR BLEK!';
    else if ((carry.on === 'kartong') !== k.take) why = k.take ? 'I KARTONG, TACK!' : 'PÅ TALLRIK, TACK!';
    const py = popY(k);
    if (!why) {
      stats.ok++;
      play('coin');
      pops.add(k.x, py, wage ? `+${wage} GRAZIE!` : 'GRAZIE!', '#8ee03c');
      if (k.take) { k.box = pz; leave(k); } else { k.state = 'eat'; k.eat = 5; k.served = pz; }
    } else {
      stats.fel++;
      play('fel');
      pops.add(k.x, py, why, '#ff6a6a');
    }
    carry = null;
  }

  // ---------- rita ----------
  function drawFire(ctx) {
    // lågor från vedträna längst in till vänster, klippta mot valvet
    for (let i = 0; i < 8; i++) {
      const bx = 100 + i * 2;
      const h = 3 + Math.round(3 * Math.abs(Math.sin(t * 6.1 + i * 1.7)) + 2.5 * Math.abs(Math.sin(t * 10.3 + i * 0.9))) + (i > 1 && i < 6 ? 2 : 0);
      const top = Math.max(archTop(bx) + 1, archTop(bx + 1) + 1, 55 - h);
      for (let y = top; y < 56; y++) {
        const f = (y - top) / Math.max(1, 56 - top);
        ctx.fillStyle = f < 0.25 ? '#b8301a' : f < 0.55 ? '#ff741c' : f < 0.82 ? '#ffc23e' : '#fff2a8';
        ctx.fillRect(bx, y, 2, 1);
      }
    }
    // glödbädden till höger pulserar
    for (let i = 0; i < 16; i++) {
      const x = 125 + ((hash(i, 1, 61) * 16) | 0), y = 54 + ((hash(i, 2, 61) * 3) | 0), s = Math.sin(t * 3.4 + i * 1.3);
      ctx.fillStyle = s > 0.45 ? '#ffb048' : s > -0.3 ? '#ff6a20' : '#a8301a';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  function drawGauge(ctx, s) {
    const pz = oven[s], x = SLOT_X[s] - 9, y = 64;
    ctx.fillStyle = '#2a1812'; ctx.fillRect(x - 1, y - 1, 20, 4);
    const ok = Math.round(18 * T_OK / T_MAX), burn = Math.round(18 * T_BURN / T_MAX);
    ctx.fillStyle = '#5a4a24'; ctx.fillRect(x, y, ok, 2);
    ctx.fillStyle = '#28502c'; ctx.fillRect(x + ok, y, burn - ok, 2);
    ctx.fillStyle = '#5a2620'; ctx.fillRect(x + burn, y, 18 - burn, 2);
    if (!pz) return;
    const st = stageOf(pz.bake), p = Math.min(18, Math.round(18 * pz.bake / T_MAX));
    const blink = st === 3 && (t * 4 | 0) % 2;
    ctx.fillStyle = st < 3 ? '#f0c040' : st === 3 ? (blink ? '#b8ffb0' : '#5ee06a') : '#ff5a3a';
    ctx.fillRect(x, y, p, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + Math.min(17, p), y - 1, 1, 4);
  }
  function drawSteam(ctx, x, y, seed) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.8 + i * 0.33 + seed * 0.17) % 1;
      const sx = x - 4 + i * 4 + Math.round(Math.sin(t * 2.3 + i * 1.7 + seed) * 1.5), sy = y - Math.round(ph * 9);
      ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - ph)).toFixed(2)})`;
      ctx.fillRect(sx, sy, 1, 1 + (ph > 0.4 ? 1 : 0));
    }
  }
  function drawCandle(ctx, x, y, seed) {
    // ett litet stearinljus i en chiantiflaska
    ctx.fillStyle = '#5a3a14'; ctx.fillRect(x - 2, y - 3, 5, 4);
    ctx.fillStyle = '#d8b060'; ctx.fillRect(x - 1, y - 3, 3, 3);
    ctx.fillStyle = '#f0d488'; ctx.fillRect(x - 1, y - 3, 1, 2);
    ctx.fillStyle = '#2a6a3a'; ctx.fillRect(x, y - 5, 1, 2);
    ctx.fillStyle = '#f6f0e0'; ctx.fillRect(x, y - 8, 1, 3);
    const f = Math.sin(t * 9 + seed * 2.1) > -0.2;
    ctx.fillStyle = '#ffd860'; ctx.fillRect(x, y - 10, 1, 2);
    ctx.fillStyle = f ? '#fff4c0' : '#ff9a30'; ctx.fillRect(x, y - 9, 1, 1);
  }
  // beställningslapparna på listen ovanför passet: pizzans bokstav, tallrik eller
  // kartong, och en färgad kant som visar hur länge kunden orkar vänta
  function drawTickets(ctx) {
    customers.filter((k) => k.state === 'sit').slice(0, 5).forEach((k, i) => {
      const x = PASS.x0 + 3 + i * 10, y = 34, left = k.patience / k.pmax;
      ctx.fillStyle = 'rgba(40,30,20,0.25)'; ctx.fillRect(x + 1, y + 1, 9, 11);
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, 9, 11);
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x, y + 10, 9, 1);
      ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b'; ctx.fillRect(x, y, 9, 1);
      ctx.fillStyle = '#3e434b'; ctx.fillRect(x + 4, y - 2, 1, 2);
      const m = PIZZAS[k.wish].mark;
      ctxText(ctx, SMALL, m, x + ((9 - textW(SMALL, m)) >> 1), y + 2, '#b8281e');
      if (k.take) { ctx.fillStyle = '#c89a5a'; ctx.fillRect(x + 2, y + 8, 5, 2); ctx.fillStyle = '#8a6430'; ctx.fillRect(x + 2, y + 9, 5, 1); }
      else { ctx.fillStyle = '#aeb6c2'; ctx.fillRect(x + 2, y + 9, 5, 1); ctx.fillStyle = '#6e7684'; ctx.fillRect(x + 3, y + 8, 3, 1); }
    });
  }
  function drawOrderBubble(ctx, k) {
    const hot = !!carry && carry.on !== 'spade' && kindOf(carry.pz) === k.wish && (carry.on === 'kartong') === k.take && stageOf(carry.pz.bake) === 3;
    const nudge = hot && (t * 4 | 0) % 2 ? 1 : 0;   // bubblan guppar när jag bär rätt pizza
    let ix, iy;
    if (lowRow(k)) { const [bx0, by0] = bubbleRect(k); [ix, iy] = bubbleSide(ctx, bx0 - nudge, by0, 30, 21, hot); }
    else [ix, iy] = bubble(ctx, Math.round(k.x), tipOf(k) - nudge, 30, 21, hot);
    ctx.drawImage(pizzaSprite(perfect(k.wish), 'B'), ix, iy + 1);
    const ic = k.take ? ICON.box : ICON.plate;
    ctx.drawImage(ic, ix + 20, iy + 5);
    const left = Math.max(0, Math.min(1, k.patience / k.pmax));
    ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 18, 26, 2);
    ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
    ctx.fillRect(ix + 2, iy + 18, Math.max(1, Math.round(26 * left)), 2);
    if (k.patience < 9 && Math.sin(t * 6) > 0) {
      // utropstecknet i hörnet bort från kunden: uppe till höger, eller uppe till vänster på sidobubblan
      const mx = lowRow(k) ? ix - 4 : ix + 29;
      ctx.fillStyle = '#17151a'; ctx.fillRect(mx, iy - 4, 5, 10);
      ctx.fillStyle = '#d9433b'; ctx.fillRect(mx + 1, iy - 3, 3, 5); ctx.fillRect(mx + 1, iy + 3, 3, 2);
    }
  }

  const api = {
    _debug: {
      stats,
      // Tvinga fram en kund som redan väntar på plats. kind 0–4 = MARGHERITA,
      // VESUVIO, HAWAII, CAPRICCIOSA, KEBABPIZZA; take true = TA MED (kartong),
      // false = äter här (tallrik). Utelämnat = slump. Returnerar kunden eller null.
      forceCustomer(kind, take) { const k = spawn(true, kind, take); return k ? { kind: k.wish, take: k.take, x: k.x, y: k.y } : null; },
      // Samma kund, men hen kommer gående in från gatan (för att testa gången).
      forceWalkIn(kind, take) { const k = spawn(false, kind, take); return k ? { kind: k.wish, take: k.take, x: k.x, y: k.y } : null; },
      // Lägg en färdig, gyllene pizza i händerna – förpackad för första väntande
      // kunden (eller för kind/on om de anges: on = 'tallrik' | 'kartong' | 'spade').
      makePizza(kind, on) {
        const k = customers.find((c) => c.state === 'sit');
        const kk = kind ?? (k ? k.wish : 0);
        carry = { pz: perfect(kk), on: on ?? (k && k.take ? 'kartong' : 'tallrik') };
        return api._debug.carrying();
      },
      // Ett stationssteg direkt, utan gång: 'deg' | 'sas' | 'ost' | 'skinka' | 'ananas' |
      // 'champinjoner' | 'kebab' | 'lyft' (bänk → spade) | 'ugn' (in i ugnen) |
      // 'grädda' (allt i ugnen blir gyllene) | 'bränn' | 'ut' | 'tallrik' | 'kartong' | 'släng'
      step(name) {
        if (BINS.some((b) => b.id === name)) actBin(name);
        else if (name === 'lyft') actBench();
        else if (name === 'ugn') { if (!carry && bench) actBench(); ovenIn(oven[0] ? 1 : 0); }
        else if (name === 'grädda') oven.forEach((pz) => { if (pz) pz.bake = T_OK + 1.5; });
        else if (name === 'bränn') oven.forEach((pz) => { if (pz) pz.bake = T_BURN + 1; });
        else if (name === 'ut') { const s = oven[0] && (!oven[1] || oven[0].bake >= oven[1].bake) ? 0 : 1; ovenOut(s); }
        else if (name === 'tallrik' || name === 'kartong') actVessel(name);
        else if (name === 'släng' || name === 'slang') actTrash();
        return { bench: api._debug.bench(), carry: api._debug.carrying(), oven: api._debug.oven() };
      },
      // Servera direkt. right = true: till en kund som vill ha exakt det jag bär
      // (finns ingen görs en rätt pizza åt första väntande kunden) → stats.ok +1.
      // right = false: fel pizza/förpackning till en kund (eller en bränd) → stats.fel +1.
      serve(right = true) {
        const sit = customers.filter((c) => c.state === 'sit');
        if (!sit.length) return null;
        if (right) {
          const match = carry && sit.find((c) => c.wish === kindOf(carry.pz) && c.take === (carry.on === 'kartong'));
          const k = match || sit[0];
          if (!match || stageOf(carry.pz.bake) !== 3) carry = { pz: perfect(k.wish), on: k.take ? 'kartong' : 'tallrik' };
          serveTo(k);
        } else {
          if (!carry) carry = { pz: perfect(sit[0].wish), on: sit[0].take ? 'kartong' : 'tallrik' };
          if (carry.on === 'spade') carry.on = 'tallrik';
          const kind = kindOf(carry.pz), box = carry.on === 'kartong';
          const k = sit.find((c) => c.wish !== kind || c.take !== box) || sit[0];
          if (k.wish === kind && k.take === box) carry.pz.bake = T_BURN + 3;
          serveTo(k);
        }
        return stats;
      },
      busy: () => walker.path.length > 0,
      carrying: () => (carry ? { kind: kindOf(carry.pz), on: carry.on, stage: stageOf(carry.pz.bake) } : null),
      bench: () => (bench ? { sauce: bench.sauce, cheese: bench.cheese, tops: [...bench.tops], kind: kindOf(bench) } : null),
      oven: () => oven.map((pz) => (pz ? { kind: kindOf(pz), bake: +pz.bake.toFixed(2), stage: stageOf(pz.bake) } : null)),
      customers: () => customers.filter((c) => c.state === 'sit').map((c) => ({ kind: c.wish, take: c.take, x: Math.round(c.x), y: Math.round(c.y) })),
      walking: () => customers.filter((c) => c.state === 'walk' || c.state === 'leave').map((c) => ({ kind: c.wish, take: c.take, state: c.state, x: Math.round(c.x), y: Math.round(c.y) })),
      // klickpunkter i spelkoordinater för stationerna (för test via down(x, y))
      spot: (id) => ({ ...Object.fromEntries(BINS.map((b) => [b.id, [b.x, 116]])), bank: [WS.x, WS.y], ugn0: [SLOT_X[0], 56], ugn1: [SLOT_X[1], 56], tallrik: [PASS.plates, 66], kartong: [PASS.boxes, 66], sopor: [11, 90] })[id] || null,
      sheet: () => spriteSheet(),
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      updParts(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.(stats); } return; }
      t += dt;
      if (t >= P.seconds) { done = true; return; }
      walker.update(dt);
      if (workT > 0) workT -= dt;
      if (trashT > 0) trashT -= dt;
      // ugnen gräddar
      for (let s = 0; s < 2; s++) {
        const pz = oven[s];
        if (!pz) continue;
        const a = stageOf(pz.bake);
        pz.bake += dt;
        const b = stageOf(pz.bake);
        if (a < 3 && b === 3) { play('ok'); pops.add(SLOT_X[s], OVEN_POP_Y, 'KLAR!', '#8ee03c'); }
        if (a < 4 && b === 4) { play('miss'); stats.brand++; pops.add(SLOT_X[s], OVEN_POP_Y, 'BRÄNNS!', '#ff6a6a'); }
        if (b === 4 && Math.random() < dt * 10) smoke(SLOT_X[s], archTop(SLOT_X[s]) + 1);
      }
      // gnistor från elden
      if (Math.random() < dt * 2.5) parts.push({ k: 'spark', x: 103 + Math.random() * 10, y: 52, vx: Math.random() * 8 - 2, vy: -10 - Math.random() * 6, life: 0.6, age: 0 });
      for (const p of parts) if (p.k === 'spark' && p.y < archTop(Math.round(p.x)) + 1) p.age = p.life;
      // nya kunder (en van bagare får fler – P.pace; tålamodet är detsamma)
      custIn -= dt;
      if (custIn <= 0) { custIn = (8.5 - 3 * Math.min(1, t / P.seconds) + hash(seq, 3) * 2.5) * P.pace; spawn(false); }
      for (const k of customers) {
        if (k.state === 'walk' || k.state === 'leave') {
          const sp = (k.state === 'walk' ? 36 : 42) * dt, wp = k.path[0];
          if (wp) {
            const dx = wp[0] - k.x, dy = wp[1] - k.y, d = Math.hypot(dx, dy);
            k.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
            if (d <= sp) { k.x = wp[0]; k.y = wp[1]; k.path.shift(); if (!k.path.length) { if (k.state === 'walk') { k.state = 'sit'; k.dir = 'down'; } else k.state = 'gone'; } }
            else { k.x += dx / d * sp; k.y += dy / d * sp; }
          } else k.state = k.state === 'walk' ? 'sit' : 'gone';
        } else if (k.state === 'sit') {
          k.patience -= dt;
          if (k.patience <= 0) { leave(k); stats.miss++; play('miss'); pops.add(k.x, popY(k) + 12, 'GICK HEM!', '#d8d2c0'); }
        } else if (k.state === 'eat') {
          k.eat -= dt;
          if (k.eat <= 0) leave(k);
        }
      }
      customers = customers.filter((k) => k.state !== 'gone');
    },
    move(x, y) { hover = done ? null : stationAt(x, y); },
    down(x, y) {
      if (done) return;
      const k = customerAt(x, y);
      if (k) { const [sx, sy] = servePoint(k); walker.walkTo(sx, sy, () => { if (k.state === 'sit') tryServe(k); }); return; }
      const s = stationAt(x, y);
      if (s) { doStation(s); return; }
      walker.walkTo(x, y);
    },
    key(kk) { if (kk === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      // ugnens fladdrande sken på stenhyllan och golvet
      const fl = 0.55 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.1 * Math.sin(t * 17);
      ctx.globalAlpha = Math.max(0, Math.min(1, fl));
      ctx.drawImage(glow(), 0, 0);
      ctx.globalAlpha = 1;
      drawFire(ctx);
      drawTickets(ctx);
      for (let s = 0; s < 2; s++) {
        if (oven[s]) ctx.drawImage(pizzaSprite(oven[s], 'O'), SLOT_X[s] - 10, SLOT_TOP);
        drawGauge(ctx, s);
      }
      // soptunnans lock slår upp när något slängs
      if (trashT > 0) {
        ctx.fillStyle = '#2a2d33'; ctx.fillRect(5, 83, 14, 2);
        ctx.fillStyle = '#8e98a4'; ctx.fillRect(4, 72, 16, 10);
        ctx.fillStyle = '#c4ccd4'; ctx.fillRect(5, 73, 14, 8);
        ctx.fillStyle = '#eef3f6'; ctx.fillRect(6, 73, 2, 8);
        ctx.fillStyle = '#5a646e'; ctx.fillRect(4, 81, 16, 1);
      }
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry || workT > 0 })];
      // det jag bär: spaden, tallriken eller kartongen i händerna
      if (carry) {
        const s = carrySprite(carry), dir = walker.dir;
        const ox = dir === 'left' ? -9 : dir === 'right' ? 9 : 0;
        const x = Math.round(walker.px) + ox - (s.width >> 1), y = Math.round(walker.py) - 12 - (s.height - 1);
        drawables.push({
          fy: walker.py + (dir === 'up' ? -0.01 : 0.01),
          draw: () => {
            ctx.drawImage(s, x, y);
            if (carry.on !== 'kartong' && carry.pz.bake > 0) drawSteam(ctx, x + (s.width >> 1), y + 2, 1);
          },
        });
      }
      // bänken (med degen) ritas framför bagaren som står bakom den
      drawables.push({
        fy: ISL.base,
        draw: () => {
          ctx.drawImage(island(), 0, 0);
          if (bench) { const s = pizzaSprite(bench, 'L'); ctx.drawImage(s, WS.x - (s.width >> 1), WS.y - 7); }
        },
      });
      const D = decor();
      drawables.push({ fy: TREE.y, draw: () => ctx.drawImage(D.tree, D.treeAt[0], D.treeAt[1]) });
      drawables.push({ fy: BARREL.y, draw: () => { ctx.drawImage(D.barrel, D.barrelAt[0], D.barrelAt[1]); drawCandle(ctx, BARREL.x, BARREL.y - 18, 7); } });
      drawables.push({ fy: SIGN.y, draw: () => ctx.drawImage(D.sign, D.signAt[0], D.signAt[1]) });
      const aok = atlasOk();
      if (aok) drawables.push({ fy: PLANT.y, draw: () => { const f = FRAMES.vaxtS0; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], PLANT.x, PLANT.y - f[3], f[2], f[3]); } });
      for (const tb of tables) {
        const k = customers.find((c) => c.table === tb);
        if (aok) drawables.push({ fy: tb.sy - 0.5, draw: () => { const f = FRAMES[CHAIR_F]; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], tb.sx - (f[2] >> 1), tb.sy + 1 - CHAIR_LIFT - f[3], f[2], f[3]); } });
        drawables.push({
          fy: tb.y,
          draw: () => {
            if (aok) { const c = tableSpr(); ctx.drawImage(c, tb.x, tb.y - c.height); }
            drawCandle(ctx, tb.x + 18, tb.y - 13, tb.x);
            if (k && k.state === 'eat') {
              const s = tablePlate(k.served, k.eat < 2);
              ctx.drawImage(s, tb.x + 9 - (s.width >> 1), tb.y - 19);
              if (k.eat > 3) drawSteam(ctx, tb.x + 9, tb.y - 19, tb.x);
            }
          },
        });
      }
      for (const k of customers) drawables.push({
        fy: k.y,
        draw: () => {
          const moving = k.state === 'walk' || k.state === 'leave';
          const withBox = !!k.box && k.state === 'leave';
          const frame = withBox ? [7, 9, 8, 9][Math.floor(t * 8.5 + k.id * 0.37) % 4]
            : moving ? WALK_SEQ[Math.floor(t * 8.5 + k.id * 0.37) % 4]
              : k.take ? (Math.sin(t * 1.7 + k.id) > 0.93 ? 4 : 0) : k.state === 'eat' ? 6 : 5;
          // kartongen i famnen: bakom kroppen när kunden går uppåt, annars framför
          const box = withBox && (() => { const s = boxSprite(k.box); ctx.drawImage(s, Math.round(k.x) - (s.width >> 1) + (k.dir === 'right' ? 6 : k.dir === 'left' ? -6 : 0), Math.round(k.y) - 12 - (s.height - 1)); });
          if (box && k.dir === 'up') box();
          drawPerson(ctx, k.x, k.y, k.look, moving ? k.dir : 'down', frame);
          if (box && k.dir !== 'up') box();
        },
      });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawParts(ctx);
      // pratbubblorna ovanpå allt – på fasta platser, aldrig över varandra
      for (const k of customers) if (k.state === 'sit') drawOrderBubble(ctx, k);
      // namnlapp för stationen under muspekaren
      if (hover && !done) {
        const w = textW(SMALL, hover.name) + 4, hx = hover.k === 'bin' ? hover.bin.x : hover.k === 'bank' ? WS.x : hover.k === 'ugn' ? OV.cx : hover.k === 'tallrik' ? PASS.plates : hover.k === 'kartong' ? PASS.boxes : 14;
        // ugnens lapp ligger under hjälpraden (18–28) och ovanför valvet
        const hy = hover.k === 'bin' || hover.k === 'bank' ? 99 : hover.k === 'ugn' ? 30 : hover.k === 'sopor' ? 74 : 52;
        const x0 = Math.max(1, Math.min(FW - w - 1, Math.round(hx - w / 2)));
        ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(x0, hy, w, 9);
        ctxText(ctx, SMALL, hover.name, x0 + 2, hy + 2, '#ffd23f');
      }
      pops.draw(ctx);
      // en rad hjälp i början
      if (t < 10 && !done) {
        const s = 'DEG, SÅS, OST, PÅLÄGG - IN I UGNEN - TALLRIK ELLER KARTONG!', w = textW(SMALL, s) + 8;
        ctx.globalAlpha = t > 9 ? 10 - t : 1;
        ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect((FW - w) >> 1, 18, w, 10);
        ctxText(ctx, SMALL, s, ((FW - w) >> 1) + 4, 21, '#ffd23f');
        ctx.globalAlpha = 1;
      }
      drawShiftHud(ctx, { W: FW }, { t, dur: P.seconds, ok: stats.ok, fel: stats.fel, title: 'PIZZERIA NAPOLI' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };
  spawn(true);   // en gäst sitter redan och väntar när passet börjar
  return api;
}

// ---------- det rutiga bordet: spelets rosa dukbord med rödvit rutig duk ----------
function checkTable() {
  const f = FRAMES[TABLE_F], c = newCanvas(f[2], f[3]), x2 = c.getContext('2d');
  x2.drawImage(ATLAS, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  try {
    const id = x2.getImageData(0, 0, f[2], f[3]), d = id.data;
    const cloth = (i) => d[i + 3] > 0 && d[i] > 120 && d[i] - d[i + 1] > 18 && d[i + 2] > d[i + 1];
    let maxL = 1;
    for (let i = 0; i < d.length; i += 4) if (cloth(i)) maxL = Math.max(maxL, d[i] + d[i + 1] + d[i + 2]);
    for (let y = 0; y < f[3]; y++) for (let x = 0; x < f[2]; x++) {
      const i = (y * f[2] + x) * 4;
      if (!cloth(i)) continue;
      const k = (d[i] + d[i + 1] + d[i + 2]) / maxL;
      const red = (((x + 1) >> 1) + (y >> 1)) & 1;
      const col = mul(red ? 0xd8342a : 0xfbf6ee, 0.5 + 0.52 * k);
      d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255;
    }
    x2.putImageData(id, 0, 0);
  } catch { /* duken blir rosa om bilden inte går att läsa */ }
  return c;
}

// ugnens sken (ritas med fladdrande alfa)
function ovenGlow() {
  const P = new Pix(FW, FH);
  P.ell(OV.cx, 66, 34, 5, 0xffa040, 0.55, 4);
  P.ell(OV.cx, 102, 58, 11, 0xffa850, 0.22, 4);
  P.ell(OV.cx - 10, 50, 20, 9, 0xff8a30, 0.18, 3);
  return P.flush();
}

// ---------- rummet: väggar, ugn, hyllor, passet, menytavlan, golvet ----------
const MAJ = ['BwyywB', 'wyooyw', 'yobboy', 'yobboy', 'wyooyw', 'BwyywB'];
const MAJ_PAL = { B: 0x24488e, b: 0x3a6cc0, w: 0xf6f0e0, y: 0xf0c040, o: 0xd87a28 };
function kitchenWall(x, y) {
  if (y < 36) {                                              // puts
    let c = mix(0xf2e6cc, 0xe2d2b2, (y - 22) / 14 + (bayer(x, y) - 0.5) * 0.25);
    if (hash(x >> 1, y >> 1, 11) < 0.05) c = mul(c, 0.94);
    return c;
  }
  if (y === 36 || y === 45) return 0xfaf6ec;
  if (y === 37 || y === 44) return 0x1e3a78;
  if (y < 44) {                                              // majolikabård
    const ch = MAJ[y - 38][x % 6];
    let c = MAJ_PAL[ch];
    if (ch === 'w' && hash((x / 6) | 0, 0, 5) < 0.35) c = 0xeee4cc;
    return c;
  }
  if (y >= 82) return y === 82 ? 0x7a6a58 : 0x4a3e32;       // sockel
  const ly = (y - 46) % 4, lx = x % 6, tx = (x / 6) | 0, ty = ((y - 46) / 4) | 0;   // vitt kakel
  if (lx === 5 || ly === 3) return 0xcdc6b6;
  let c = mix(0xfaf8f2, 0xe6e2d8, hash(tx, ty, 9) * 0.8);
  if (lx === 0 && ly === 0) c = 0xffffff;
  else if (ly === 2) c = mul(c, 0.97);
  return c;
}
function diningWall(x, y) {
  if (y < 74) {                                              // varm ockraputs
    let c = mix(0xeab87c, 0xd89e60, (y - 22) / 52 + (bayer(x, y) - 0.5) * 0.22);
    const n = hash(x >> 1, y >> 1, 21);
    if (n < 0.06) c = mul(c, 0.93); else if (n > 0.96) c = mix(c, 0xfff0d8, 0.25);
    return c;
  }
  if (y === 74) return 0xf4dcae;                             // stollist
  if (y === 75) return 0xb07c44;
  if (y === 76) return 0x5a3818;
  if (y >= 82) return y === 82 ? 0x3a2418 : 0x2a180e;
  const lx = (x - 246) % 23;                                 // grön panel
  if (lx === 0 || y === 81) return 0x1a3a28;
  if (lx === 1 || y === 77) return 0x4a8a60;
  return mix(0x2e6446, 0x285a3e, bayer(x, y));
}

function paintRoom() {
  const P = new Pix(FW, FH);
  // ---------- takbjälken ----------
  for (let x = 0; x < FW; x++) {
    P.px(x, 18, 0x8a5a34); P.px(x, 19, (x & 7) < 5 && hash(x >> 3, 0, 3) < 0.4 ? 0x5a3820 : 0x6a4428); P.px(x, 20, 0x5a3820); P.px(x, 21, 0x2e1c10);
  }
  // ---------- väggarna ----------
  for (let y = 22; y < WALL_B; y++) for (let x = 0; x < FW; x++) P.px(x, y, x < KX1 ? kitchenWall(x, y) : diningWall(x, y));
  // pelaren mellan köket och matsalen
  for (let y = 22; y < WALL_B; y++) for (let x = 235; x < 247; x++) {
    const cap = y < 26 || y >= 78;
    if (!cap && (x === 235 || x === 246)) continue;
    let c = x === 235 || x === 246 ? 0x6a5a48 : x === 236 ? 0x7a6a58 : x === 237 ? 0xfff6e2 : x >= 244 ? 0xb8a888 : mix(0xf2e8d0, 0xdccca8, (x - 238) / 6);
    if (cap) { c = y === 22 || y === 78 ? 0xfff6e2 : y === 25 || y === 83 ? 0x6a5a48 : mix(0xeadcc0, 0xcfc0a0, (x - 235) / 11); if (x === 235 || x === 246) c = 0x6a5a48; }
    P.px(x, y, c);
  }
  // ---------- golvet: terrakottaplattor ----------
  for (let y = WALL_B; y < FH; y++) for (let x = 0; x < FW; x++) {
    const TW = 16, TH = 10, ty = ((y - WALL_B) / TH) | 0, ly = (y - WALL_B) % TH, tx = (x / TW) | 0, lx = x % TW;
    let c;
    if (lx === 0 || ly === 0) c = 0x8e4c30;
    else {
      const v = hash(tx, ty, 5);
      c = v < 0.3 ? 0xc86c42 : v < 0.6 ? 0xbe6440 : v < 0.92 ? 0xd07a4a : 0xa85a3a;
      c = mul(c, 0.95 + hash(x, y, 6) * 0.08);
      if (ly === 1 || lx === 1) c = mix(c, 0xffe2c4, 0.14);
      if (ly === TH - 1 || lx === TW - 1) c = mul(c, 0.9);
      if (hash(x, y, 8) < 0.012) c = mul(c, 0.8);
    }
    if (y < WALL_B + 4) c = mul(c, 0.72 + (y - WALL_B) * 0.07);
    P.px(x, y, c);
  }
  // skuggor på golvet (bänken, passet, ugnsfoten)
  P.darken(ISL.x0 + 2, ISL.base, ISL.x1 - ISL.x0, 1, 0.62); P.darken(ISL.x0 + 4, ISL.base + 1, ISL.x1 - ISL.x0 - 4, 1, 0.8);
  P.darken(PASS.x0, PASS.base, PASS.x1 - PASS.x0, 1, 0.7);
  P.darken(76, OV.bot, 90, 1, 0.7);
  paintShelves(P);
  paintPeels(P);
  paintOven(P);
  paintPass(P);
  paintTrash(P);
  paintDining(P);
  P.box(0, 0, FW, FH, 0x0e0d12);
  const cv = P.flush(), c2 = cv.getContext('2d');
  // pizzorna på menytavlan (samma sprites som i spelet)
  PIZZAS.forEach((p, i) => { const s = pizzaSprite(perfect(i), 'M'), ry = MENU.y + 13 + i * 8; c2.drawImage(s, MENU.x + 4, ry - 2); });
  return cv;
}

// ---------- hyllorna till vänster: flaskor, kryddor, burkar ----------
function paintShelves(P) {
  const board = (y) => {
    P.darken(2, y + 3, 49, 2, 0.84);
    P.hl(2, y, 49, 0xb88450); P.hl(2, y + 1, 49, 0x8a5a34); P.hl(2, y + 2, 49, 0x5a3a22);
    P.px(2, y + 1, 0x6a4428); P.px(50, y + 1, 0x5a3a22);
    for (const bx of [6, 44]) { P.rect(bx, y + 3, 2, 1, 0x3a3a3e); P.px(bx, y + 4, 0x3a3a3e); }
  };
  board(34); board(52);
  // ---- övre hyllan (flaskor står på y 33) ----
  const fiasco = (x, cap) => {             // halmklädd chiantiflaska
    for (let y = 27; y < 34; y++) for (let i = 0; i < 7; i++) {
      if (!inEll(i, y - 27, 3.5, 3.5, 3.6, 3.6)) continue;
      let c = ((y + (i >> 1)) & 1) ? 0xd8b060 : 0xb88c40;
      if (i === 1 && y < 31) c = 0xf0d488; if (i >= 5) c = mul(c, 0.8);
      P.px(x + i, y, c);
    }
    P.rect(x + 2, 24, 3, 3, 0x2a6a3a); P.px(x + 2, 24, 0x6ab080); P.rect(x + 3, 21, 1, 3, 0x2a6a3a); P.px(x + 3, 22, 0x6ab080);
    P.rect(x + 2, 22, 3, 2, cap); P.px(x + 2, 22, mix(cap, 0xffffff, 0.35));
  };
  fiasco(3, 0xc8302a);
  // olivolja (hög, gröngul)
  P.rect(12, 25, 4, 9, 0x9aa832); P.vl(12, 25, 9, 0xd8e070); P.vl(15, 25, 9, 0x5a6a14); P.rect(13, 22, 2, 3, 0x9aa832); P.px(13, 22, 0xd8e070); P.rect(13, 21, 2, 1, 0x8a6a40);
  P.rect(12, 28, 4, 3, 0xf0e6cc); P.px(13, 29, 0x3a7a3a); P.px(14, 29, 0x3a7a3a);
  // vinflaska (mörkgrön med etikett)
  P.rect(18, 25, 4, 9, 0x1e4a2e); P.vl(18, 26, 7, 0x4a8a5a); P.rect(19, 22, 2, 3, 0x1e4a2e); P.rect(19, 21, 2, 1, 0x8a1a22);
  P.rect(18, 28, 4, 3, 0xf0e6cc); P.px(19, 29, 0xc8302a); P.px(20, 29, 0xc8302a);
  fiasco(23, 0x2a3a8a);
  // burk med oliver
  P.rect(32, 27, 7, 7, 0xcfe0d8); P.rect(33, 28, 5, 5, 0x6a7a2a);
  for (const [ox, oy] of [[33, 28], [35, 29], [37, 28], [34, 31], [36, 31]]) { P.px(ox, oy, 0x9aaa3a); }
  P.vl(32, 27, 7, 0xf4fbf8); P.rect(32, 26, 7, 1, 0xd8a830); P.rect(33, 25, 5, 1, 0xf0c848);
  // balsamico och grissini
  P.rect(41, 27, 3, 7, 0x2a1418); P.vl(41, 27, 6, 0x5a3a3e); P.rect(42, 24, 1, 3, 0x2a1418); P.px(42, 23, 0xd8a830);
  P.rect(46, 29, 4, 5, 0xcfe0d8); P.vl(46, 29, 5, 0xf4fbf8);
  for (const [gx, gh] of [[46, 7], [47, 9], [48, 8], [49, 6]]) P.vl(gx, 29 - gh + 4, gh - 3, 0xe8c888);
  // ---- nedre hyllan (står på y 51) ----
  const jar = (x, fill, lid) => {
    P.rect(x, 46, 5, 6, 0xd8e4e0); P.rect(x + 1, 47, 3, 4, fill); P.vl(x, 46, 6, 0xf4fbf8); P.vl(x + 4, 46, 6, 0x9aaaa8);
    P.rect(x, 45, 5, 1, lid); P.px(x, 45, mix(lid, 0xffffff, 0.4)); P.rect(x + 1, 49, 3, 1, 0xf4ecd8);
  };
  jar(3, 0x6a8a3a, 0xc8302a); jar(9, 0xc8402a, 0x2a2a2e); jar(15, 0xf4f4f0, 0x9aa4ae); jar(21, 0x3a3430, 0x2a6a3a);
  const can = (x) => {
    P.rect(x, 44, 6, 8, 0xc8302a); P.hl(x, 44, 6, 0xd8dce0); P.hl(x, 51, 6, 0x8e98a4); P.vl(x, 45, 6, 0xe86050); P.vl(x + 5, 45, 6, 0x8a1a18);
    P.rect(x + 1, 47, 4, 2, 0xf4f0e0); P.px(x + 2, 47, 0xd8302a); P.px(x + 3, 47, 0x3a8a3a);
  };
  can(28); can(35);
  // basilika i kruka
  P.rect(43, 47, 7, 5, 0xc0643a); P.hl(42, 47, 9, 0xe08a5a); P.vl(49, 48, 4, 0x8a4428);
  for (const [bx, by, c] of [[43, 44, 0x3a8a3a], [45, 42, 0x5ab04a], [47, 43, 0x3a8a3a], [44, 45, 0x2a6a2a], [46, 44, 0x6ac85a], [48, 45, 0x2a6a2a], [46, 41, 0x5ab04a], [42, 45, 0x5ab04a], [49, 44, 0x3a8a3a]]) {
    P.px(bx, by, c); P.px(bx + 1, by, mul(c, 0.8)); P.px(bx, by + 1, mul(c, 0.7));
  }
  // under hyllan: vitlöksfläta, chilislinga och en slev
  P.vl(9, 55, 2, 0x8a6a40);
  for (let i = 0; i < 5; i++) { const y = 57 + i * 3, x = 8 + (i & 1); P.rect(x, y, 3, 3, 0xf4ece0); P.px(x, y, 0xffffff); P.px(x + 2, y + 2, 0xc8b8c8); P.px(x + 1, y + 2, 0xd8c8d0); }
  P.vl(24, 55, 18, 0xc8b070);
  for (let i = 0; i < 6; i++) { const y = 57 + i * 3, x = 22 + (i & 1) * 3; P.rect(x, y, 2, 2, 0xd8302a); P.px(x, y, 0xff6a50); P.px(x + (i & 1 ? -1 : 2), y, 0x3a8a3a); }
  P.vl(38, 55, 12, 0xaeb6c2); P.vl(39, 55, 12, 0x6e7684); P.rect(36, 67, 5, 3, 0xc4ccd4); P.hl(36, 67, 5, 0xeef3f6); P.hl(37, 70, 3, 0x6e7684);
  for (const hx of [9, 24, 38]) P.px(hx, 54, 0x3a3a3e);
}

// ---------- pizzaspadarna på väggen ----------
function paintPeels(P) {
  P.rect(52, 24, 21, 3, 0x6a4428); P.hl(52, 24, 21, 0x8a5a34); P.darken(52, 27, 21, 1, 0.8);
  // träspade: skaft 56–57, blad 52–61 × 47–63
  P.vl(56, 27, 21, 0xd0a060); P.vl(57, 27, 21, 0x9a7040); P.px(56, 26, 0x3a3a3e);
  for (let y = 47; y < 64; y++) for (let x = 52; x < 62; x++) {
    const cut = y > 60 && (x - 52 < y - 60 || 61 - x < y - 60);
    if (cut) continue;
    let c = mix(0xe4b878, 0xc89858, (y - 47) / 16);
    if (x === 52 || y === 47) c = 0xf4d49c; else if (x === 61) c = 0xa07444;
    if (hash(x, y >> 1, 3) < 0.1) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  P.hl(53, 63, 8, 0x6a4424); P.vl(62, 48, 13, 0x6a4424);
  P.darken(62, 48, 2, 15, 0.86);
  // rund, perforerad stålspade: skaft x 67, blad kring (67, 58)
  P.vl(67, 27, 26, 0x9aa4ae); P.vl(68, 27, 26, 0x5a646e); P.px(67, 26, 0x3a3a3e);
  for (let y = 52; y < 65; y++) for (let x = 61; x < 74; x++) {
    const d = Math.hypot(x + 0.5 - 67.5, (y + 0.5 - 58.5) * 1.05);
    if (d > 6) continue;
    let c = d > 5.2 ? 0x5a646e : (x + y < 124 ? 0xe2e8ee : 0xb4bec8);
    if (d < 5 && ((x + y) & 1) === 0 && ((x - y) & 3) === 0) c = 0x6a747e;
    P.px(x, y, c);
  }
}

// ---------- vedugnen ----------
function paintOven(P) {
  const { cx, rx, ry, by } = OV;
  const inDome = (x, y) => y < by && inEll(x, y, cx, by, rx, ry);
  for (let y = by - ry; y < by; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    if (!inDome(x, y)) continue;
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - by) / ry, d = Math.hypot(dx, dy);
    const v = hash(x >> 1, y >> 1, 41);
    let c = [0xa8442c, 0x9a3c28, 0xb44c32, 0x8e3624][(v * 4) | 0];
    const l = -dx * 0.6 - dy * 0.55;                        // ljus uppifrån vänster
    c = mul(c, l > 0.5 ? 1.18 : l > 0.15 ? 1.02 : l > -0.25 ? 0.88 : 0.74);
    if ((x & 1) && (y & 1)) c = mul(c, 0.86);               // fogar mellan mosaikbitarna
    if (d > 0.93) c = mul(c, 0.72);
    if (d > 0.55 && d < 0.6) c = hash(x >> 1, 0, 43) < 0.5 ? 0xe0b048 : 0xc8943a;   // guldband
    P.px(x, y, c);
  }
  for (let y = by - ry - 1; y < by; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
    if (!inDome(x, y) && (inDome(x + 1, y) || inDome(x - 1, y) || inDome(x, y + 1))) P.px(x, y, 0x3a1810);
  }
  // skorstenen i koppar
  for (let y = 22; y < 29; y++) for (let x = 116; x < 127; x++) {
    const k = x - 116;
    let c = k === 0 || k === 10 ? 0x5a2a12 : k === 2 ? 0xf0b070 : k < 4 ? 0xd88a4a : k < 8 ? 0xb8683a : 0x8a4a24;
    if (y === 24 || y === 27) c = mul(c, 0.72);
    P.px(x, y, c);
  }
  for (let x = 114; x < 129; x++) { P.px(x, 29, x === 114 || x === 128 ? 0x5a2a12 : x < 118 ? 0xf0b070 : 0xb8683a); P.px(x, 30, 0x5a2a12); }
  for (const rx2 of [118, 121, 124]) { P.px(rx2, 24, 0xffd0a0); P.px(rx2, 27, 0xffd0a0); }
  // namnet i vit mosaik
  const nw = textW(SMALL, 'NAPOLI');
  text(P, SMALL, 'NAPOLI', cx - (nw >> 1), 33, 0x4a1a10);
  text(P, SMALL, 'NAPOLI', cx - (nw >> 1), 32, 0xfaf2e0);
  // valvet: stenar runt öppningen + en guldring
  const inArch = (x, y, g) => x >= OV.mx0 - g && x < OV.mx1 + g && y < by && (y >= OV.mSpring || inEll(x, y, cx, OV.mSpring, 22 + g, 8 + g));
  for (let y = OV.mTop - 5; y < by; y++) for (let x = OV.mx0 - 5; x < OV.mx1 + 5; x++) {
    if (inMouth(x, y)) continue;
    if (inArch(x, y, 3)) {
      let seg = y < OV.mSpring ? Math.floor((Math.atan2(y + 0.5 - OV.mSpring, x + 0.5 - cx) + Math.PI) / (Math.PI / 9)) : 20 + ((y - OV.mSpring) >> 2) + (x < cx ? 0 : 7);
      let c = seg & 1 ? 0xe6d8ba : 0xcdbc9a;
      if (!inArch(x, y, 2)) c = mul(c, 0.8);
      if (inArch(x, y, 1) && !inMouth(x, y)) { const nearFire = x < cx; c = mix(c, 0xffb070, nearFire ? 0.4 : 0.25); }
      P.px(x, y, c);
    } else if (inArch(x, y, 4)) P.px(x, y, hash(x, y, 47) < 0.5 ? 0xe8b850 : 0xc8943a);
    else if (inArch(x, y, 5)) P.px(x, y, 0x5a2014);
  }
  // inne i ugnen: mörkt valv, glödande golv
  for (let y = OV.mTop; y < by; y++) for (let x = OV.mx0; x < OV.mx1; x++) {
    if (!inMouth(x, y)) continue;
    let c = y < 55 ? mix(0x1c0806, 0x3a1208, (y - OV.mTop) / 13) : mix(0x6a2a12, 0x8e3c1a, (y - 55) / 7);
    const fire = Math.hypot((x - 107) / 11, (y - 52) / 7);
    if (fire < 1) c = mix(c, 0xd8601c, (1 - fire) * 0.55);
    if (y >= 55 && hash(x, y, 51) < 0.12) c = mul(c, 1.3);
    P.px(x, y, c);
  }
  // vedträna som brinner längst in
  P.line(100, 56, 114, 52, 0x2a1408); P.line(100, 55, 114, 51, 0x3e1e0c); P.line(102, 52, 113, 56, 0x2a1408); P.line(102, 51, 113, 55, 0x3e1e0c);
  for (const [lx, ly] of [[104, 54], [108, 53], [111, 52], [105, 52], [109, 55], [112, 54]]) P.px(lx, ly, 0xff8a2a);
  // stenhyllan framför öppningen
  for (let y = 62; y < OV.base; y++) for (let x = 74; x < 168; x++) {
    let c;
    if (y === 62) c = 0xece6da;
    else if (y < 65) { c = mix(0xd2cbbd, 0xc2baac, (y - 62) / 3); const h = hash(x, y, 71); if (h < 0.12) c = 0x9a9288; else if (h > 0.9) c = 0xf0eade; }
    else if (y < 67) c = y === 65 ? 0xa8a090 : 0x8a8276;
    else c = 0x3a3430;
    if (x === 74 || x === 167) c = 0x3a3430;
    P.px(x, y, c);
  }
  for (let i = 0; i < 26; i++) P.px(96 + ((hash(i, 3, 73) * 50) | 0), 63 + ((hash(i, 4, 73) * 2) | 0), 0xfbf8f0);   // mjöl
  // tegelfoten
  for (let y = OV.base; y < OV.bot; y++) for (let x = 76; x < 166; x++) {
    const row = ((y - OV.base) / 4) | 0, ly = (y - OV.base) % 4, off = row & 1 ? 4 : 0, lx = (x - 76 + off) % 8, bx = ((x - 76 + off) / 8) | 0;
    let c;
    if (ly === 3 || lx === 7) c = 0xc2aa88;
    else { c = [0xa84a30, 0x9a4028, 0xb45636, 0x8e3a26][(hash(bx, row, 81) * 4) | 0]; if (ly === 0) c = mix(c, 0xffd0b0, 0.16); if (lx === 6) c = mul(c, 0.85); }
    c = mul(c, 1.06 - (x - 76) / 90 * 0.22);
    if (x === 76 || x === 165 || y === OV.bot - 1) c = 0x2e1810;
    P.px(x, y, c);
  }
  P.darken(77, OV.base, 88, 1, 0.7);
  // vedförrådet i foten: en valvnisch full med vedträn
  const inNiche = (x, y) => x >= 98 && x < 144 && y < 92 && (y >= 78 || inEll(x, y, cx, 78, 23, 6));
  for (let y = 71; y < 93; y++) for (let x = 96; x < 146; x++) {
    if (inNiche(x, y)) P.px(x, y, 0x1e120c);
    else if (inNiche(x + 1, y) || inNiche(x - 1, y) || inNiche(x, y + 1) || inNiche(x + 2, y) || inNiche(x - 2, y) || inNiche(x, y + 2)) P.px(x, y, (x + y) & 2 ? 0x7a3420 : 0x6a2c1a);
  }
  const LOG = ['.bbbbb.', 'bhwwwwb', 'bwwrwwb', 'bwrcrwb', 'bwwrwwd', '.bdddd.'];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) {
    const lx = 95 + i * 7 + (r & 1 ? 3 : 0), ly = 86 - r * 5;
    const v = hash(i, r, 91), tint = v < 0.25 ? 0.86 : v > 0.8 ? 1.08 : 1;
    LOG.forEach((row, yy) => { for (let xx = 0; xx < 7; xx++) {
      const ch = row[xx]; if (ch === '.' || !inNiche(lx + xx, ly + yy)) continue;
      const c = { b: 0x5a3a20, d: 0x3a2412, h: 0xf2d6a0, w: 0xdcb47a, r: 0xb88c56, c: 0x8a6034 }[ch];
      P.px(lx + xx, ly + yy, ch === 'b' || ch === 'd' ? c : mul(c, tint));
    } });
  }
  // ugnsredskapen som lutar mot ugnen: sopborste och askraka
  P.line(172, 56, 169, 87, 0x8a6a40); P.line(173, 56, 170, 87, 0x5a4428);
  P.rect(166, 87, 6, 6, 0x3a2a1a); P.hl(166, 87, 6, 0x5a4830); for (let x = 166; x < 172; x += 2) P.vl(x, 89, 4, 0x2a1a10);
  P.vl(176, 50, 41, 0xaeb6c2); P.vl(177, 50, 41, 0x5a646e); P.rect(173, 90, 7, 3, 0x6a747e); P.hl(173, 90, 7, 0xc4ccd4);
}

// ---------- passet: rostfri disk, tallrikar, kartonger, värmelampor, lappar ----------
function paintPass(P) {
  const { x0, x1, top, front, base, plates, boxes } = PASS;
  // orderlisten (lapparna ritas levande – en per väntande kund)
  P.hl(x0 + 1, 32, x1 - x0 - 2, 0xeef3f6); P.hl(x0 + 1, 33, x1 - x0 - 2, 0x8e98a4); P.darken(x0 + 1, 34, x1 - x0 - 2, 1, 0.85);
  P.px(x0, 32, 0x5a646e); P.px(x0, 33, 0x5a646e); P.px(x1 - 1, 32, 0x5a646e); P.px(x1 - 1, 33, 0x5a646e);
  // värmelamporna
  for (const lx of [plates, boxes]) {
    P.vl(lx, 22, 26, 0x2a2430);
    P.rect(lx - 1, 48, 3, 1, 0x7a1a22);
    P.rect(lx - 2, 49, 5, 1, 0xc8323a); P.px(lx - 1, 49, 0xff6a6a);
    P.rect(lx - 4, 50, 9, 2, 0xc8323a); P.px(lx - 4, 50, 0xff6a6a); P.px(lx - 3, 50, 0xff8a8a); P.hl(lx - 4, 51, 9, 0x9a2028);
    P.rect(lx - 2, 52, 5, 1, 0xffb050); P.px(lx, 53, 0xffe07a);
    P.ell(lx + 0.5, 64, 13, 8, 0xffb060, 0.28);
  }
  // disken
  for (let y = top; y < base; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y === top) c = 0xf6fafc;
    else if (y < front) c = mix(0xdde3e9, 0xc4ccd4, (y - top) / (front - top)) ;
    else if (y === front) c = 0xeef3f6;
    else if (y === front + 1) c = 0x8e98a4;
    else if (y >= base - 3) c = y === base - 1 ? 0x2a2d33 : 0x3e434b;
    else {
      c = mix(0xc4ccd4, 0x9aa4ae, (y - front - 2) / (base - front - 5) + (hash(x >> 3, y, 3) - 0.5) * 0.12);
      if (x === x0 + 27 || x === x0 + 28) c = x === x0 + 27 ? 0x6a747e : 0xdde3e9;
    }
    if (x === x0 || x === x1 - 1) c = 0x4a525c;
    P.px(x, y, c);
  }
  for (const hx of [x0 + 20, x0 + 33]) { P.rect(hx, front + 5, 4, 1, 0xeef3f6); P.rect(hx, front + 6, 4, 1, 0x5a646e); }
  P.ell(plates + 0.5, top + 3, 12, 3, 0xffd890, 0.3); P.ell(boxes + 0.5, top + 3, 12, 3, 0xffd890, 0.3);
  // tallriksstapeln
  for (let i = 0; i < 6; i++) {
    const cy = top + 4 - i * 2;
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = plates - 8; x < plates + 8; x++) {
      const d = Math.hypot((x + 0.5 - plates) / 8, (y + 0.5 - cy) / 2.4);
      if (d > 1) continue;
      let c = y > cy ? 0xaeb6c2 : 0xfdfcf8;
      if (i === 5 && d < 0.6) c = 0xeef1f4;
      if (y === cy && d > 0.8) c = 0xd6dce4;
      P.px(x, y, c);
    }
  }
  for (let x = plates - 8; x < plates + 8; x++) { P.px(x, top + 7, 0x6e7684); }
  P.px(plates - 8, top + 4, 0x6e7684); P.px(plates + 7, top + 4, 0x6e7684);
  // kartongerna
  // kartongerna: platta askar staplade lite ojämnt, översta locket med tryck
  P.ell(boxes + 0.5, top + 6, 13, 2, 0x2a2d33, 0.3);
  const offs = [0, 1, -1, 0, 1];
  for (let i = 0; i < 5; i++) {
    const y = top + 3 - i * 3, bx0 = boxes - 11 + offs[i];
    P.hl(bx0, y, 22, 0xe8c48a); P.hl(bx0, y + 1, 22, 0xc89a5a); P.hl(bx0, y + 2, 22, 0x8a6430);
    P.px(bx0 - 1, y, 0x5a3a1a); P.px(bx0 - 1, y + 1, 0x5a3a1a); P.px(bx0 - 1, y + 2, 0x5a3a1a); P.px(bx0 + 22, y, 0x5a3a1a); P.px(bx0 + 22, y + 1, 0x5a3a1a); P.px(bx0 + 22, y + 2, 0x5a3a1a);
    for (let x = bx0 + 2; x < bx0 + 20; x += 3) P.px(x, y + 1, 0xc8302a);
  }
  const ly = top + 3 - 5 * 3 - 5, lx0 = boxes - 11 + offs[4];
  for (let y = ly; y < ly + 5; y++) for (let x = lx0; x < lx0 + 22; x++) P.px(x, y, y === ly ? 0xf4dcaa : x === lx0 ? 0xecc890 : hash(x, y, 7) < 0.1 ? 0xd4a868 : 0xdcb478);
  for (let y = ly; y < ly + 5; y++) for (let x = lx0 + 2; x < lx0 + 10; x++) { const d = Math.hypot((x + 0.5 - (lx0 + 6)) / 3.6, (y + 0.5 - (ly + 2.5)) / 2.2); if (d <= 1 && d > 0.5) P.px(x, y, 0xc8302a); else if (d <= 0.5) P.px(x, y, 0xe8a060); }
  P.hl(lx0 + 12, ly + 1, 7, 0xc8302a); P.hl(lx0 + 12, ly + 3, 5, 0xc8302a);
  P.hl(lx0, ly - 1, 22, 0x5a3a1a); P.px(lx0 - 1, ly, 0x5a3a1a); P.vl(lx0 - 1, ly, 5, 0x5a3a1a); P.vl(lx0 + 22, ly, 5, 0x5a3a1a);
  // pingklockan
  P.rect(204, top + 1, 5, 2, 0xe0b040); P.hl(205, top, 3, 0xffe080); P.px(206, top - 1, 0x8a6a20); P.hl(203, top + 3, 7, 0x6a5020);
}

// ---------- soptunnan (pedalhink) ----------
function paintTrash(P) {
  const cols = [0x4a525c, 0x8e98a4, 0xc4ccd4, 0xeef3f6, 0xdde3e9, 0xc4ccd4, 0xb4bec8, 0xaeb6c2, 0xa4aeb8, 0x9aa4ae, 0x8e98a4, 0x7a848e, 0x6a747e, 0x5a646e, 0x4a525c];
  P.ell(12, 97, 9, 2, 0x1e1418, 0.35);
  for (let y = 86; y < 97; y++) for (let i = 0; i < 15; i++) P.px(4 + i, y, y === 96 ? 0x3a3e46 : cols[i]);
  P.hl(4, 83, 15, 0x4a525c); P.hl(4, 84, 15, 0xeef3f6); P.hl(4, 85, 15, 0xaeb6c2); P.px(4, 84, 0x8e98a4); P.px(18, 84, 0x6a747e);
  P.hl(4, 86, 15, 0x5a646e);
  P.rect(8, 95, 7, 2, 0x2a2d33); P.hl(8, 95, 7, 0x4a525c);
}

// ---------- matsalen: menytavla, tavla med Vesuvius, vägglampa, vimplar ----------
const MENU = { x: 250, y: 24, w: 86, h: 53 };
function paintDining(P) {
  // vimplar i rött, vitt och grönt under bjälken
  const cols = [[0x2a9a4a, 0x1e7a38], [0xf6f2ea, 0xd8d2c4], [0xd8342a, 0xa8241e]];
  for (let i = 0; i < 17; i++) {
    const x = 248 + i * 8, [c, d] = cols[i % 3];
    if (x + 5 > FW) break;
    for (let y = 0; y < 4; y++) for (let k = y; k < 5 - y; k++) P.px(x + k, 22 + y, k === y ? mix(c, 0xffffff, 0.2) : k === 4 - y ? d : c);
  }
  // menytavlan
  const { x, y, w, h } = MENU;
  P.darken(x + 2, y + h, w - 2, 2, 0.8); P.darken(x + w, y + 2, 2, h, 0.82);
  P.rect(x, y, w, h, 0x5a3a20); P.box(x, y, w, h, 0x2e1c10); P.hl(x + 1, y + 1, w - 2, 0x8a5a30); P.vl(x + 1, y + 1, h - 2, 0x7a4e2a);
  for (let yy = y + 3; yy < y + h - 3; yy++) for (let xx = x + 3; xx < x + w - 3; xx++) {
    let c = mix(0x1e2a24, 0x26342c, hash(xx, yy, 5) * 0.8);
    if (hash(xx >> 2, yy >> 1, 9) < 0.05) c = 0x33423a;
    P.px(xx, yy, c);
  }
  P.box(x + 2, y + 2, w - 4, h - 4, 0x3a2414);
  const tw = textW(SMALL, 'MENY');
  text(P, SMALL, 'MENY', x + (w >> 1) - (tw >> 1), y + 4, 0xffd23f);
  for (const fx0 of [x + (w >> 1) - (tw >> 1) - 14, x + (w >> 1) + (tw >> 1) + 6]) {   // små italienska flaggor
    P.rect(fx0, y + 4, 3, 5, 0x2a9a4a); P.rect(fx0 + 3, y + 4, 3, 5, 0xf6f2ea); P.rect(fx0 + 6, y + 4, 3, 5, 0xd8342a);
    P.hl(fx0, y + 4, 9, 0xffffff, 0.25);
  }
  for (let xx = x + 6; xx < x + w - 6; xx += 2) P.px(xx, y + 10, 0x5a6a60);
  PIZZAS.forEach((p, i) => {
    const ry = y + 13 + i * 8;
    text(P, SMALL, p.name, x + 18, ry, 0xf4f1ea);
    const pr = `${p.price}:-`;
    text(P, SMALL, pr, x + w - 5 - textW(SMALL, pr), ry, 0xffd23f);
  });
  // tavlan med Vesuvius i guldram
  const vx = 341, vy = 30, vw = 38, vh = 28;
  P.darken(vx + 2, vy + vh, vw - 2, 2, 0.8);
  P.box(vx, vy, vw, vh, 0x5a3a14);
  P.box(vx + 1, vy + 1, vw - 2, vh - 2, 0xf0d070); P.hl(vx + 2, vy + vh - 2, vw - 3, 0xa87a28); P.vl(vx + vw - 2, vy + 2, vh - 3, 0xa87a28);
  P.box(vx + 2, vy + 2, vw - 4, vh - 4, 0xc8a040);
  P.box(vx + 3, vy + 3, vw - 6, vh - 6, 0x5a3a14);
  const ix = vx + 4, iy = vy + 4, iw = vw - 8, ih = vh - 8;
  for (let yy = 0; yy < ih; yy++) for (let xx = 0; xx < iw; xx++) {
    const X = ix + xx, Y = iy + yy;
    let c;
    if (yy < 11) c = mix(0x78b4e4, 0xf6d8a8, yy / 11 + (bayer(X, Y) - 0.5) * 0.2);                      // himmel
    else c = hash(X, Y, 3) < 0.12 ? 0x8ac0e8 : mix(0x3a7ab8, 0x2a5a98, (yy - 11) / 9);                 // havet
    P.px(X, Y, c);
  }
  // vulkanen med två toppar (Somma till vänster)
  for (let xx = 0; xx < iw; xx++) {
    const X = ix + xx;
    const hMain = 9 - Math.abs(xx - 19) * 0.62, hSomma = 6 - Math.abs(xx - 10) * 0.7;
    const hh = Math.max(hMain > 7.6 ? 7.6 : hMain, hSomma);
    for (let k = 0; k < Math.round(hh); k++) {
      const Y = iy + 11 - k;
      P.px(X, Y, xx < 19 && hh === hMain ? (k === Math.round(hh) - 1 ? 0x9a8ab0 : 0x7a6a8e) : xx >= 19 ? 0x5a4a6e : 0x6a5a7e);
    }
  }
  for (const [sx, sy] of [[19, 2], [18, 1], [17, 1], [16, 0], [20, 2], [15, 0]]) P.px(ix + sx, iy + sy, 0xeee8f0);
  // stadens vita hus vid stranden, en segelbåt och en pinje i förgrunden
  for (let xx = 12; xx < 28; xx++) if (hash(xx, 0, 7) < 0.7) P.px(ix + xx, iy + 12, hash(xx, 1, 7) < 0.5 ? 0xfaf4e8 : 0xf0c890);
  P.px(ix + 22, iy + 15, 0xffffff); P.px(ix + 22, iy + 16, 0xffffff); P.px(ix + 23, iy + 16, 0xe8e8e8); P.hl(ix + 21, iy + 17, 4, 0x8a5a30);
  P.vl(ix + 4, iy + 10, 10, 0x5a3a20);
  for (const [px2, py2] of [[1, 8], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [3, 6], [4, 6], [5, 6]]) P.px(ix + px2, iy + py2, py2 === 6 || (py2 === 7 && px2 < 4) ? 0x4a8a3a : 0x2a5a2a);
  // vägglampa
  const lx = 360;
  P.ell(lx + 0.5, 64, 12, 8, 0xfff0b8, 0.3);
  P.rect(lx - 1, 66, 3, 3, 0xc89a3a); P.px(lx, 69, 0x8a6a20);
  P.rect(lx - 3, 61, 7, 5, 0xfff2d0); P.hl(lx - 3, 61, 7, 0xffffff); P.hl(lx - 3, 65, 7, 0xe8d0a0); P.vl(lx + 3, 62, 3, 0xe8d8b0);
  P.box(lx - 4, 60, 9, 7, 0x8a6a3a); P.erase(lx - 4, 60, 1, 1);
}

// ---------- bänken: mjölig träskiva, jäslåda, såskastrull, backar ----------
function gnPan(P, cx, fill) {
  const x0 = cx - 7, y0 = 110;
  P.ell(cx + 1, 121, 9, 2, 0x3a2414, 0.35);
  P.rect(x0, y0, 14, 7, 0xeef3f6);
  P.hl(x0, y0, 14, 0xf6fafc); P.vl(x0, y0, 7, 0xf6fafc); P.hl(x0, y0 + 6, 14, 0x8e98a4); P.vl(x0 + 13, y0, 7, 0x8e98a4);
  for (let y = y0 + 1; y < y0 + 6; y++) for (let x = x0 + 1; x < x0 + 13; x++) P.px(x, y, fill(x - x0 - 1, y - y0 - 1));
  for (let y = y0 + 7; y < y0 + 11; y++) for (let x = x0; x < x0 + 14; x++) P.px(x, y, x === x0 ? 0xdde3e9 : x === x0 + 13 ? 0x6a747e : y === y0 + 10 ? 0x6a747e : mix(0xc4ccd4, 0x9aa4ae, (x - x0) / 14));
  P.box(x0 - 1, y0 - 1, 16, 13, 0x3e434b);
  P.erase(x0 - 1, y0 - 1, 1, 1); P.erase(x0 + 14, y0 - 1, 1, 1);
}
function paintIsland() {
  const P = new Pix(FW, FH);
  const { x0, x1, top, front, base } = ISL;
  // skivan: tjocka plankor i ljust trä
  for (let y = top; y < front; y++) for (let x = x0; x < x1; x++) {
    const plank = ((y - top) / 4) | 0;
    let c = [0xe4c690, 0xdcbc86, 0xe8cc98, 0xd8b680][plank % 4];
    if (hash(x >> 2, y, 7 + plank) < 0.12) c = mul(c, 0.93);
    if ((y - top) % 4 === 3) c = mul(c, 0.88);
    if ((x + plank * 13) % 37 === 0) c = mul(c, 0.86);
    if (y === front - 1) c = 0xf6e2b8;
    P.px(x, y, c);
  }
  P.hl(x0, top - 1, x1 - x0, 0x5a3a22);
  // mjöl: tätt runt degplatsen, strött över resten
  for (let y = top; y < front - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const d = Math.hypot((x - WS.x) / 24, (y - WS.y) / 7);
    const p = d < 1 ? 0.32 * (1 - d) + 0.05 : 0.025;
    if (hash(x, y, 101) < p) P.px(x, y, hash(x, y, 103) < 0.5 ? 0xfbf8f0 : 0xf0e8d8);
  }
  P.ell(WS.x + 17, WS.y + 6, 3, 1.5, 0xffffff, 0.9, 2);   // en liten mjölhög
  // fronten: mörk valnöt med skåpluckor och lådor
  for (let y = front; y < base; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y === front) c = 0x3a2414;
    else if (y >= base - 2) c = y === base - 1 ? 0x1e120a : 0x2e1c10;
    else {
      const lx = (x - x0) % 25, ly = y - front;
      c = 0x6a4228;
      if (ly <= 4) {                                            // lådraden
        c = ly === 1 ? 0x8a5a34 : ly === 4 ? 0x3e2616 : 0x74482a;
        if (lx === 0) c = 0x3e2616; else if (lx === 1) c = 0x8a5a34;
      } else {                                                  // luckor med infälld spegel
        const inPanel = lx >= 4 && lx <= 20 && ly >= 7 && ly <= 12;
        c = inPanel ? mix(0x7a4c2c, 0x6a4026, (ly - 7) / 6) : 0x5e3a22;
        if (lx === 0) c = 0x3e2616; else if (lx === 1) c = 0x7a4c2c;
        if (inPanel && (lx === 4 || ly === 7)) c = 0x4a2c18; else if (inPanel && (lx === 20 || ly === 12)) c = 0x8e5e38;
      }
      if (hash(x, y >> 1, 3) < 0.06) c = mul(c, 0.9);
    }
    if (x === x0 || x === x1 - 1) c = 0x2a1810;
    P.px(x, y, c);
  }
  for (let i = 0; i < 8; i++) { const kx = x0 + 12 + i * 25; if (kx < x1 - 4) { P.px(kx, front + 2, 0xf0c848); P.px(kx + 1, front + 2, 0xa8801c); P.px(kx, front + 3, 0x8a6a1c); } }
  // en rödvit rutig handduk över kanten
  for (let y = front; y < front + 11; y++) for (let x = 150; x < 159; x++) {
    if (y > front + 8 && (x === 150 || x === 158)) continue;
    let c = ((((x - 150) >> 1) + ((y - front) >> 1)) & 1) ? 0xd8342a : 0xf8f4ec;
    if (x === 158) c = mul(c, 0.8); if (y === front) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  P.hl(151, front + 11, 7, 0x2a1810);
  // jäslådan med sex degbollar
  P.ell(38, 121, 16, 2, 0x3a2414, 0.35);
  P.rect(22, 109, 31, 12, 0x8a5a34); P.hl(22, 109, 31, 0xb88450); P.hl(22, 120, 31, 0x5a3a22); P.vl(22, 109, 12, 0xa87444); P.vl(52, 109, 12, 0x5a3a22);
  P.rect(24, 111, 27, 8, 0xe8dcc4);
  const BALL = outlined({ w: 6, h: 4, d: [
    -1, 0xfff4e2, 0xfff4e2, 0xf6e6c8, -1, -1,
    0xfff4e2, 0xffffff, 0xf6e6c8, 0xf6e6c8, 0xeed8b4, -1,
    0xf6e6c8, 0xf6e6c8, 0xf2e0c0, 0xeed8b4, 0xdcc49c, 0xdcc49c,
    -1, 0xdcc49c, 0xdcc49c, 0xd4b88e, 0xd4b88e, -1,
  ] });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
    const bx = 24 + i * 9 + r * 1, by = 109 + r * 4;
    P.hl(bx + 1, by + 6, 7, 0xc8b48e);
    for (let y = 0; y < BALL.h; y++) for (let x = 0; x < BALL.w; x++) { const v = BALL.d[y * BALL.w + x]; if (v !== -1) P.px(bx + x, by + y, v); }
  }
  P.box(21, 108, 33, 14, 0x3a2414); P.erase(21, 108, 1, 1); P.erase(53, 108, 1, 1);
  // såskastrullen med slev
  const sx = 64;
  P.ell(sx + 1, 121, 9, 2, 0x3a2414, 0.35);
  for (let y = 109; y < 121; y++) for (let x = sx - 7; x <= sx + 7; x++) {
    const inTop = inEll(x, y, sx + 0.5, 112.5, 7.4, 3.2);
    const inBody = x >= sx - 7 && x <= sx + 7 && y >= 112 && y < 120;
    if (!inTop && !inBody) continue;
    let c;
    if (inTop) {
      const inner = inEll(x, y, sx + 0.5, 112.8, 6, 2.2);
      c = inner ? (hash(x, y, 5) < 0.2 ? 0xf46c4a : y < 112 ? 0xe04830 : 0xc03424) : (y < 112 ? 0xf6fafc : 0xaeb6c2);
    } else {
      const k = (x - (sx - 7)) / 14;
      c = k < 0.12 ? 0x8e98a4 : k < 0.3 ? 0xeef3f6 : k < 0.6 ? 0xc4ccd4 : k < 0.85 ? 0x9aa4ae : 0x6a747e;
      if (y === 119) c = mul(c, 0.7);
    }
    P.px(x, y, c);
  }
  P.hl(sx - 9, 115, 3, 0x3e434b); P.hl(sx + 8, 115, 3, 0x3e434b);   // handtagen
  P.line(sx + 2, 112, sx + 7, 105, 0x8e98a4); P.line(sx + 3, 112, sx + 8, 105, 0xeef3f6); P.px(sx + 8, 104, 0x5a646e);
  // osthon och påläggsbackarna
  const shred = (x, y) => (hash(x, y, 111) < 0.45 ? 0xfffcf4 : hash(x, y, 113) < 0.5 ? 0xf2e2b8 : 0xe8d49a);
  gnPan(P, 82, (x, y) => shred(x + 82, y));
  const piece = (id) => {
    const tp = TOPS[TOP_IX[id]], pat = tp.big, pw = pat[0].length, ph = pat.length;
    const bgc = { skinka: 0xc86a80, ananas: 0xd8a828, champinjoner: 0x8a6e52, kebab: 0x5a2c14 }[id];
    return (x, y) => {
      const cx = Math.floor(x / (pw + 1)), cy = Math.floor(y / ph), ox = x - cx * (pw + 1) - (cy & 1), oy = y - cy * ph;
      const ch = ox >= 0 && ox < pw ? pat[oy]?.[ox] : '.';
      return ch && ch !== '.' ? tp.pal[ch] : bgc;
    };
  };
  for (const b of BINS) if (TOP_IX[b.id] !== undefined) gnPan(P, b.x, piece(b.id));
  // pizzasnurra och pepparkvarn längst till höger
  P.ell(206, 119, 3, 3, 0xaeb6c2, 1, 2); P.px(206, 119, 0x5a646e); P.px(205, 117, 0xeef3f6);
  P.line(207, 118, 211, 114, 0x2a2a2e); P.line(208, 118, 212, 114, 0xc8302a);
  P.ell(214, 121, 3, 1, 0x3a2414, 0.35);
  P.rect(213, 110, 3, 11, 0x7a4a26); P.vl(213, 110, 11, 0xa87444); P.rect(212, 113, 5, 2, 0x5a3a20); P.px(214, 109, 0x3a2414);
  return P.flush();
}

// ---------- dekor i matsalen: citronträd, vinfat, TA MED-skylt ----------
function paintDecor() {
  // citronträd i terrakottakruka
  const T = new Pix(28, 40, TREE.x - 14, TREE.y - 39);
  T.ell(TREE.x + 1, TREE.y, 9, 2, 0x1e1418, 0.35);
  for (let y = TREE.y - 10; y < TREE.y; y++) {
    const ins = Math.round((y - (TREE.y - 10)) * 0.25);
    for (let x = TREE.x - 6 + ins; x <= TREE.x + 6 - ins; x++) {
      const k = (x - (TREE.x - 6 + ins)) / (12 - ins * 2);
      T.px(x, y, y < TREE.y - 8 ? (y === TREE.y - 10 ? 0xf0a070 : 0xd87a4a) : k < 0.2 ? 0xe08a5a : k > 0.75 ? 0x8a4428 : 0xc0643a);
    }
  }
  T.hl(TREE.x - 5, TREE.y - 9, 11, 0x4a2c1a);
  T.vl(TREE.x, TREE.y - 24, 15, 0x6a4424); T.vl(TREE.x + 1, TREE.y - 22, 13, 0x4a2c18);
  const blobs = [[0, -30, 8, 6], [-6, -26, 6, 5], [6, -26, 6, 5], [-3, -34, 5, 4], [4, -33, 5, 4], [0, -24, 6, 3]];
  for (const [bx, by, rx, ry] of blobs) for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if (!inEll(x, y, 0, 0, rx, ry)) continue;
    const X = TREE.x + bx + x, Y = TREE.y + by + y, l = (x + y * 1.4) / (rx + ry);
    const h = hash(X, Y, 131);
    T.px(X, Y, l < -0.4 ? (h < 0.5 ? 0x7ac85a : 0x5aa84a) : l > 0.35 ? 0x1e5a2a : h < 0.2 ? 0x5aa84a : 0x3a8a3a);
  }
  for (const [lx, ly] of [[-5, -27], [3, -31], [6, -24], [-2, -34], [-7, -23], [2, -26]]) {
    const X = TREE.x + lx, Y = TREE.y + ly;
    T.rect(X, Y, 2, 2, 0xf8d830); T.px(X, Y, 0xfff6a0); T.px(X + 1, Y + 1, 0xc8a018);
  }
  // vinfat (stående, som bord)
  const B = new Pix(20, 26, BARREL.x - 10, BARREL.y - 24);
  B.ell(BARREL.x + 1, BARREL.y, 10, 2, 0x1e1418, 0.35);
  for (let y = BARREL.y - 18; y < BARREL.y; y++) {
    const bulge = Math.round(Math.sin(((y - (BARREL.y - 18)) / 18) * Math.PI) * 1.5);
    for (let x = BARREL.x - 7 - bulge; x <= BARREL.x + 7 + bulge; x++) {
      const k = (x - (BARREL.x - 7 - bulge)) / (14 + bulge * 2), stave = Math.floor(k * 6);
      let c = [0x9a5a30, 0x8a4e28, 0xa8663a, 0x8e5230, 0x9a5a30, 0x7a4424][stave];
      c = mul(c, k < 0.2 ? 1.18 : k > 0.8 ? 0.72 : 1);
      if (Math.floor(k * 6 * 4) % 4 === 0) c = mul(c, 0.8);
      const hy = y - (BARREL.y - 18);
      if (hy === 3 || hy === 4 || hy === 13 || hy === 14) c = hy === 3 || hy === 13 ? 0x6a6a72 : 0x3a3a42;
      B.px(x, y, c);
    }
  }
  for (let y = BARREL.y - 21; y < BARREL.y - 17; y++) for (let x = BARREL.x - 8; x <= BARREL.x + 8; x++) {
    if (!inEll(x, y, BARREL.x + 0.5, BARREL.y - 19, 8.4, 2.4)) continue;
    B.px(x, y, inEll(x, y, BARREL.x + 0.5, BARREL.y - 19, 6.5, 1.5) ? 0xb8804a : 0x7a4a26);
  }
  // TA MED-skylten (trottoarpratare)
  const S = new Pix(28, 22, SIGN.x - 14, SIGN.y - 20);
  S.ell(SIGN.x, SIGN.y, 12, 2, 0x1e1418, 0.35);
  S.line(SIGN.x - 11, SIGN.y - 1, SIGN.x - 9, SIGN.y - 18, 0x5a3a20); S.line(SIGN.x + 11, SIGN.y - 1, SIGN.x + 9, SIGN.y - 18, 0x5a3a20);
  S.rect(SIGN.x - 10, SIGN.y - 18, 21, 15, 0x8a5a30); S.box(SIGN.x - 10, SIGN.y - 18, 21, 15, 0x3a2414); S.hl(SIGN.x - 9, SIGN.y - 17, 19, 0xb07a44);
  for (let y = SIGN.y - 16; y < SIGN.y - 5; y++) for (let x = SIGN.x - 8; x < SIGN.x + 9; x++) S.px(x, y, mix(0x1e2a24, 0x26342c, hash(x, y, 5)));
  text(S, SMALL, 'TA', SIGN.x - 3, SIGN.y - 15, 0xf4f1ea);
  text(S, SMALL, 'MED', SIGN.x - 6, SIGN.y - 9, 0xffd23f);
  return { tree: T.flush(), treeAt: [TREE.x - 14, TREE.y - 39], barrel: B.flush(), barrelAt: [BARREL.x - 10, BARREL.y - 24], sign: S.flush(), signAt: [SIGN.x - 14, SIGN.y - 20] };
}

// förhandsvisning av alla sprites (för utvecklingen: _debug.sheet())
function spriteSheet() {
  const c = newCanvas(300, 120), x2 = c.getContext('2d');
  x2.fillStyle = '#f4f1ea'; x2.fillRect(0, 0, 300, 120);
  let x = 2;
  for (let i = 0; i < PIZZAS.length; i++) { const s = pizzaSprite(perfect(i), 'B'); x2.drawImage(s, x, 2); x += s.width + 3; }
  x = 2;
  for (let st = 0; st < 5; st++) {
    const pz = { sauce: true, cheese: true, tops: ['skinka', 'ananas'], bake: [0, 1, 4, 8, 13][st] };
    const s = pizzaSprite(pz, 'L'); x2.drawImage(s, x, 22); x += s.width + 3;
  }
  x = 2;
  const steps = [{ sauce: false, cheese: false, tops: [] }, { sauce: true, cheese: false, tops: [] }, { sauce: true, cheese: true, tops: [] }, { sauce: true, cheese: true, tops: ['skinka'] }, { sauce: true, cheese: true, tops: ['skinka', 'champinjoner'] }, { sauce: true, cheese: true, tops: ['kebab'] }];
  for (const p of steps) { const s = pizzaSprite({ ...p, bake: 0 }, 'L'); x2.drawImage(s, x, 42); x += s.width + 3; }
  x = 2;
  for (let i = 0; i < PIZZAS.length; i++) { const pz = perfect(i); for (const s of [spadeSprite(pz), plateSprite(pz), boxSprite(pz)]) { x2.drawImage(s, x, 62); x += s.width + 2; } }
  x = 2;
  for (let i = 0; i < PIZZAS.length; i++) { for (const sz of ['O', 'T', 'M']) { const s = pizzaSprite(perfect(i), sz); x2.drawImage(s, x, 82); x += s.width + 2; } }
  x2.drawImage(tablePlate(perfect(2), false), x, 82); x2.drawImage(tablePlate(perfect(2), true), x + 22, 82);
  x2.drawImage(ICON.plate, 2, 100); x2.drawImage(ICON.box, 16, 100);
  return c.toDataURL('image/png');
}
