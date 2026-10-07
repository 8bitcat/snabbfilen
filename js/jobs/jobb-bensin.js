// Bensinmacken – två jobb samtidigt: gården och kiosken.
// GÅRDEN: bilar rullar in från vägen till en av tre pumpöar och visar en
// pratbubbla (under bilen) med vad de vill ha: 95, 98, DIESEL eller EL, och
// ibland en raka = "tvätta rutan". Hämta rätt munstycke (pumpens tre hållare)
// eller laddkabeln (laddstolpen), gå till bilen och tanka: mätaren fylls – släpp
// (klicka) i den gröna zonen. Tankar man för länge blir det spill. Elbilar laddar
// själva; kom tillbaka och dra ur kabeln när det står KLAR. Rakan står i hinken
// på varje ö. När allt är gjort betalar föraren och kör i väg.
// KIOSKEN: kunder ställer sig vid disken och vill ha korv, kaffe eller en
// tidning. Hämta varan (korvgrillen, kaffemaskinen, tidningsstället) och räck
// över den bakom disken.
// JOBBA IHOP: flera kan dela passet – pumpöarna, bilarna och kunderna är gemensamma (se
// "jobba tillsammans" nedan), det man håller i och kioskvarorna man hämtar är ens egna.
// Allt ritas pixel för pixel i skala 1: bakgrunden en gång (Pix), bilarna som
// cachade sprites per bil, pumpar/stolpar/hinkar och all rörelse varje bildruta.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer, hex } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { makeShiftCoop } from '../net/coop.js';
import { play } from '../core/sound.js';
import { JOBS } from '../game.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;

// ---------- planlösningen ----------
const KX1 = 120;                                   // kiosken x 0–119, gården x 120–383
const DISK = { x0: 4, x1: 96, top: 106, base: 124 };
const KSPOTS = [28, 52, 76];                       // kundernas platser framför disken
const KY = 146, ENTRY_Y = 178;                     // där kunderna står / går in
const SERVE_Y = 100, PICK_Y = 90;                  // min plats bakom disken / vid stationerna
const STATIONS = [
  { id: 'korv', x0: 19, x1: 53, sx: 33 },
  { id: 'kaffe', x0: 54, x1: 85, sx: 64 },
  { id: 'tidning', x0: 86, x1: 118, sx: 102 },
];
const PREP = { korv: 0.6, kaffe: 1.0, tidning: 0.35 };
const ITEMS = ['korv', 'kaffe', 'tidning'];

const ISL = [196, 272, 348];                       // pumpöarnas mitt
const STAND = 96;                                  // nedersta raden för allt som står på öarna
const LANE_Y = 108;                                // där jag står framför pumparna
const CAR_Y = 136;                                 // där jag står bakom en bil (vid tanklocket)
const PARK_Y = 150, ROAD_Y = 212;                  // bilarnas markrad: vid pumpen / på vägen
const HOSE = 64;                                   // så långt räcker slangen
const ZONE = 0.85;                                 // gröna zonen på tankmätaren (85–100 %)
const FILL_RATE = 0.28;                            // tankens andel per sekund
const CHARGE_T = 5.5;                              // sekunder för en full laddning
const GRADES = ['95', '98', 'D'];
const FUEL = {
  95: { name: '95', col: 0x3aa34a, ink: 0xffffff, price: '18.49' },
  98: { name: '98', col: 0x2f6fd0, ink: 0xffffff, price: '19.29' },
  D: { name: $t('DIESEL'), lab: 'D', col: 0x2a2a30, ink: 0xffd23f, price: '20.19' },
  EL: { name: $t('EL'), col: 0x1f9fb0, ink: 0xffffff, price: '4.95' },
};
const C_OK = '#8ee03c', C_FEL = '#ff6a6a', C_INFO = '#ffd23f', C_EL = '#7ae8f0', C_GREY = '#d8d2c0';

// pumpöns delar i förhållande till öns mitt (cx)
const DISP_X = -3, DISP_Y = STAND - 39, DISP_W = 29;         // pumpen 29×40
const bayX = (j) => DISP_X + 1 + 9 * j;                      // hållarfack j: 9 px brett
const CHG_X = -20, CHG_Y = STAND - 33;                       // laddstolpen 10×34
const BUCKET_X = -29, BUCKET_Y = STAND - 6;                  // hinken 9×7 (med kontur)

// ---------- sprites: pixelkartor i skala 1 ----------
const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// pixelkarta → canvas, med 1 px "sel-out"-kontur (mörkare ton av grannpixeln)
function mapSprite(map, pal, outline = true) {
  const pad = outline ? 1 : 0;
  const w = Math.max(...map.map((r) => r.length)) + pad * 2, h = map.length + pad * 2;
  const g = new Array(w * h).fill(-1);
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]] !== undefined) g[(y + pad) * w + x + pad] = pal[row[x]]; });
  if (outline) {
    const src = g.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== -1) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || src[yy * w + xx] === -1) continue;
        g[y * w + x] = mix(mul(src[yy * w + xx], 0.42), 0x1c1418, 0.4);
        break;
      }
    }
  }
  const c = newCanvas(w, h), x2 = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = g[y * w + x]; if (v === -1) continue; x2.fillStyle = css(v); x2.fillRect(x, y, 1, 1); }
  return c;
}
const SPR = {};
const ITEM = {
  korv: {
    pal: { y: 0xffd23f, R: 0xe0704a, r: 0xc04a30, s: 0x8a2a1c, b: 0xf8d898, B: 0xe0a458, d: 0xb07030 },
    map: [
      '...y...y...y.',
      'RRyRyRyRyRyRs',
      'rbbbbbbbbbbbs',
      '.BBBBBBBBBBB.',
      '..ddddddddd..',
    ],
  },
  kaffe: {
    pal: { l: 0xf4f1ea, L: 0xb8b2a2, w: 0xfdfcf8, u: 0xd8d2c6, C: 0xc8894a, c: 0x9a6230, m: 0xd8352e },
    map: [
      '..llll..',
      '.lllllL.',
      'LLLLLLLL',
      '.wwwwwu.',
      '.CCCCCc.',
      '.CmmCCc.',
      '.CCCCCc.',
      '..wwwu..',
      '..wwwu..',
    ],
  },
  tidning: {
    pal: { r: 0xd8352e, w: 0xfff6e0, p: 0xf4f1ea, P: 0xc8c2b2, k: 0x2a2430, g: 0x6a8ab0, G: 0x9ab8d8, t: 0x8a8478 },
    map: [
      'rrrrrrrrrr',
      'rwwrwwrwwr',
      'pppppppppP',
      'pkkkkkkkpP',
      'pppppppppP',
      'pGgggptttP',
      'pgggGppppP',
      'pggggptttP',
      'PPPPPPPPPP',
    ],
  },
  raka: {
    pal: { k: 0x2a2430, s: 0xb8c0c8, S: 0x7a848e, h: 0x2f6fd0, H: 0x6aa8f0 },
    map: [
      'kkkkkkkkk',
      'SsssssssS',
      '....hH...',
      '....hH...',
      '....hH...',
      '....hH...',
      '....kk...',
    ],
  },
  kort: {
    pal: { b: 0x1f4fa8, B: 0x3a7bd5, y: 0xf0c040, Y: 0xb88a20, w: 0xd8e6ff },
    map: [
      'BBBBBBBBBB',
      'bbbbbbbbbb',
      'ByYBBBBBBB',
      'BYYBBBBBBB',
      'BwwBwwBwwB',
      'BBBBBBBBBB',
    ],
  },
};
const itemSprite = (id) => (SPR['i' + id] ||= mapSprite(ITEM[id].map, ITEM[id].pal));
// rakan i pratbubblan: utan kontur, med vattendroppar
const RAKA_ICON = { pal: { k: 0x2a2430, s: 0xb8c0c8, h: 0x2f6fd0, H: 0x6aa8f0, d: 0x5ab4f0 }, map: [
  'kkkkkkkk',
  'ssssssss',
  '...hH...',
  'd..hH..d',
  '...hH...',
  '.d.hH...',
  '...hH.d.',
  '...kk...',
] };
const rakaIcon = () => (SPR.rakaI ||= mapSprite(RAKA_ICON.map, RAKA_ICON.pal, false));

// munstycket: hängande i pumpen (färgat handtag, stålpip nedåt) eller i handen
function nozzleSprite(g, held = false) {
  const k = (held ? 'nh' : 'n') + g;
  if (SPR[k]) return SPR[k];
  const f = FUEL[g], light = g === 'D' ? 0x4a4a54 : mix(f.col, 0xffffff, 0.25), dark = g === 'D' ? 0x1c1c22 : mul(f.col, 0.62);
  const pal = { G: light, g: dark, y: f.ink === 0xffffff ? mix(f.col, 0xffffff, 0.6) : f.ink, s: 0xc4ccd4, S: 0x7a848e, h: 0x1c1c22 };
  const map = held
    ? ['.hGGG', 'GGGgg', 'gyyyg', '.ss..', 's....']
    : ['.GGG.', 'GGGgg', 'gyyyg', 'gGGgg', '.sSs.', '..s..'];
  return (SPR[k] = mapSprite(map, pal));
}
// laddkontakten
const plugSprite = () => (SPR.plug ||= mapSprite(['kKKk', 'kttk', 'kKKk', '.kk.'], { k: 0x1c1c22, K: 0x3a3d44, t: 0x6ae0e8 }));
const BUCKET_MAP = ['rrrrrrr', 'rwwWwwr', 'BbbbbbB', 'Bbbbbbd', '.bbbbd.'];
const bucketSprite = () => (SPR.bucket ||= mapSprite(BUCKET_MAP, { r: 0xd8dce2, w: 0x8ec8f0, W: 0xd8f0ff, b: 0x3a6bd5, B: 0x6a9ae8, d: 0x2a4a9a }));

// mörk kontur innanför kanten på en rundad låda
function outlineIn(P, W, H, inside) {
  const edge = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    if (x === 0 || x === W - 1 || y === 0 || y === H - 1 || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)) edge.push([x, y]);
  }
  for (const [x, y] of edge) P.px(x, y, mix(mul(P.get(x, y), 0.4), 0x1c1418, 0.45));
}

// ---------- pumpen (utan munstycken och siffror – de ritas levande) ----------
function paintDispenser() {
  const W = DISP_W, H = 40, P = new Pix(W, H);
  const RED = 0xd8352e;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !((y === 0 && (x < 2 || x > W - 3)) || (y === 1 && (x < 1 || x > W - 2)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    let c;
    if (y <= 4) c = y <= 1 ? 0xff7a6a : y === 3 ? 0xf4f1ea : y === 4 ? 0x9a2020 : RED;       // röd topp med vit rand
    else if (y <= 14) c = mix(0xeef1f4, 0xb4bcc6, (y - 5) / 10 + (bayer(x, y) - 0.5) * 0.14);
    else if (y === 15) c = 0x5a646e;
    else if (y <= 31) c = mix(0xf6f6f4, 0xd0d3d8, (y - 16) / 16 + (bayer(x, y) - 0.5) * 0.1);
    else if (y <= 35) c = (y & 1) ? 0x626a74 : 0x98a0aa;                                        // galler
    else c = y === 36 ? 0x6a6e76 : 0x2e3036;                                                     // sockeln
    if (x === 1 && y > 1 && y < 36) c = mix(c, 0xffffff, 0.4);
    if (x === W - 2 && y > 1) c = mul(c, 0.7);
    if (x === W - 3 && y > 4 && y < 36) c = mul(c, 0.88);
    P.px(x, y, c);
  }
  // displayen (siffrorna ritas levande)
  P.rect(2, 5, W - 4, 9, 0x3a3d44); P.hl(2, 13, W - 4, 0x9aa2ac);
  for (let y = 6; y <= 12; y++) P.hl(3, y, W - 6, y & 1 ? 0x14241a : 0x18291e);
  P.hl(3, 6, W - 6, 0x223a28);
  // tre fack: kvalitetsskylt + hållare
  GRADES.forEach((g, j) => {
    const bx = 1 + 9 * j, f = FUEL[g];
    P.rect(bx, 16, 9, 7, f.col); P.hl(bx, 16, 9, mix(f.col, 0xffffff, 0.35)); P.hl(bx, 22, 9, mul(f.col, 0.6));
    const lab = f.lab || f.name, tw = textW(SMALL, lab);
    text(P, SMALL, lab, bx + ((9 - tw) >> 1), 17, f.ink);
    P.rect(bx + 2, 24, 5, 7, 0x2a2d33); P.hl(bx + 2, 24, 5, 0x17181c); P.vl(bx + 6, 25, 6, 0x3a3d44);
    P.hl(bx + 1, 31, 7, 0x8a929c);
    // slangens hål i nederkanten
    P.rect(bx + 5, 33, 3, 2, 0x1c1c22); P.px(bx + 6, 33, 0x3a3d44);
  });
  outlineIn(P, W, H, inside);
  return P.flush();
}

// ---------- laddstolpen ----------
function paintCharger() {
  const W = 10, H = 34, P = new Pix(W, H);
  const TEAL = 0x2aa39a;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !(y === 0 && (x < 2 || x > W - 3)) && !(y === 1 && (x < 1 || x > W - 2));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    let c;
    if (y <= 3) c = y <= 1 ? 0x6ad8c8 : TEAL;
    else if (y <= 11) c = 0x2e3036;
    else if (y <= 17) c = y === 12 ? 0x6ad8c8 : TEAL;
    else if (y <= 30) c = mix(0xf4f4f2, 0xcfd3d8, (y - 18) / 13 + (bayer(x, y) - 0.5) * 0.1);
    else c = y === 31 ? 0x6a6e76 : 0x2e3036;
    if (x === 1 && y > 1 && y < 31) c = mix(c, 0xffffff, 0.35);
    if (x === W - 2 && y > 1) c = mul(c, 0.72);
    P.px(x, y, c);
  }
  P.rect(2, 5, 6, 6, 0x0e2a2a); P.hl(2, 5, 6, 0x163a3a);
  text(P, SMALL, $t('EL'), 2, 13, 0xffffff);
  P.rect(3, 19, 4, 5, 0x1e2024); P.hl(3, 19, 4, 0x121316);
  P.vl(8, 20, 9, 0x2a4a3e);                                     // LED-listen (tänds när det laddar)
  outlineIn(P, W, H, inside);
  return P.flush();
}

// ---------- disken (egen sprite – den skymmer mig när jag står bakom) ----------
const CT_X = 4, CT_Y = 94, CT_W = 93, CT_H = 31;
function paintCounter() {
  const P = new Pix(CT_W, CT_H, CT_X, CT_Y);          // ritas i skärmkoordinater
  const { x0, x1, top, base } = DISK;
  for (let y = top; y <= base; y++) for (let x = x0; x <= x1; x++) {
    let c;
    if (y < top + 4) {                                                             // träskivan
      c = mix(0xe4b87c, 0xcc965c, (y - top) / 4 + (hash(x >> 3, y, 3) - 0.5) * 0.35);
      if (hash(x, y, 9) > 0.9) c = mul(c, 0.9);
    } else if (y === top + 4) c = 0xf6d8a4;
    else if (y === top + 5) c = 0x7a4a28;
    else if (y < base - 2) {                                                       // godisdisken
      const r = y - (top + 6), col = (x - x0) % 23;
      if (r === 0 || r === 9 || col === 0 || col === 1) c = r === 0 ? 0xdfe6ee : col === 1 ? 0x7a848e : 0x9aa4ae;
      else {
        const bin = ((x - x0) / 7) | 0, row = r < 5 ? 0 : 1, lr = row ? r - 5 : r - 1;
        const cols = [0xff88bb, 0xffd23f, 0x7fdc6e, 0xe8443a, 0xf4f1ea, 0x8a5a30, 0x2a2430, 0xff9a3a, 0x9a6ae0];
        const cc = cols[Math.floor(hash(bin, row, 21) * cols.length)];
        if ((x - x0) % 7 === 0) c = 0x3a3440;                                       // lådornas kanter
        else if (lr === 0) c = mix(cc, 0x1c1820, 0.55);                              // djupet i lådan
        else c = hash(x, y, 5) > 0.5 ? cc : mix(cc, hash(x, y, 6) > 0.5 ? 0xffffff : 0x000000, 0.28);
        if (((x - y) % 17 + 17) % 17 < 2) c = mix(c, 0xffffff, 0.35);                // glaset blänker
      }
    } else c = y === base - 2 ? 0x5a4636 : y === base - 1 ? 0x3a2e2a : 0x241a18;   // sockel
    if (x === x0 || x === x1) c = mix(mul(c, 0.4), 0x1c1418, 0.45);
    P.px(x, y, c);
  }
  // tuggummi- och tändarställ
  P.rect(6, 99, 11, 8, 0x8a2a2a); P.hl(6, 99, 11, 0xd84a3a); P.hl(6, 103, 11, 0x5a1a1a);
  for (let i = 0; i < 5; i++) {
    const a = [0x3a7bd5, 0xffd23f, 0x46a35a, 0xf4f1ea, 0xe07a2e][i], b = [0xe8443a, 0x9a6ae0, 0x2aa39a, 0xffd23f, 0x3a7bd5][i];
    P.rect(7 + i * 2, 100, 2, 3, a); P.px(7 + i * 2, 100, mix(a, 0xffffff, 0.4)); P.rect(7 + i * 2, 104, 2, 3, b);
  }
  P.box(5, 98, 13, 10, 0x2a1a1a);
  // ketchup och senap
  for (const [bx, cc, tip] of [[29, 0xd9302a, 0xf4f1ea], [32, 0xf0c428, 0xd83a2a]]) {
    P.rect(bx, 101, 2, 6, cc); P.px(bx, 102, mix(cc, 0xffffff, 0.45)); P.px(bx, 103, mix(cc, 0xffffff, 0.3));
    P.px(bx, 100, tip); P.px(bx + 1, 100, mul(tip, 0.8)); P.px(bx, 99, mul(tip, 0.7));
    P.vl(bx + 2, 100, 7, 0x2a1a1a);
  }
  // kortterminalen
  P.rect(71, 99, 6, 8, 0x23232a); P.rect(72, 100, 4, 3, 0x6ab0d0); P.px(72, 100, 0xa8e0f0);
  for (let i = 0; i < 3; i++) { P.px(72 + i, 104, 0x8a8e96); P.px(72 + i, 105, 0x6a6e76); }
  P.box(70, 98, 8, 10, 0x121216);
  // kassaapparaten (lådan ritas levande när den öppnas)
  P.rect(80, 99, 15, 5, 0xe0d8c8); P.hl(80, 99, 15, 0xf4efe4); P.vl(94, 99, 5, 0xb8ae98);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) P.px(82 + i * 2, 100 + r * 2, r === 1 && i === 4 ? 0x46a35a : r === 0 && i === 4 ? 0xd8352e : 0x8a8478);
  P.rect(83, 95, 7, 4, 0x2a2d33); P.rect(84, 96, 5, 2, 0x2a5a3a); P.px(85, 96, 0x8effb0); P.px(87, 96, 0x8effb0); P.px(86, 97, 0x6adf90);
  P.box(79, 98, 17, 10, 0x2a2420); P.box(82, 94, 9, 5, 0x17151a);
  P.rect(80, 104, 15, 3, 0xcfc4ae); P.hl(84, 105, 7, 0x6a6050);
  return P.flush();
}

// ---------- bilarna ----------
// Sidovy med 3 px av ovansidan synlig (samma snedvinkel som resten av staden).
// Nosen åt vänster. h = höjd över marken, x = 0 vid nosen.
const KINDS = {
  kompakt: { L: 50, r: 4, wf: 9, wr: 40, hood: 12, roof: 21, a0: 14, a1: 20, c1: 38, c0: 46, deck: 15, b: 28, doors: 2 },
  sedan: { L: 60, r: 4, wf: 11, wr: 48, hood: 12, roof: 21, a0: 17, a1: 24, c1: 38, c0: 47, deck: 14, b: 30, doors: 4 },
  kombi: { L: 60, r: 4, wf: 11, wr: 48, hood: 12, roof: 21, a0: 17, a1: 24, c1: 55, c0: 58, deck: 16, b: 30, cp: 43, doors: 4, rails: true },
  suv: { L: 58, r: 5, wf: 11, wr: 46, hood: 15, roof: 25, a0: 16, a1: 22, c1: 52, c0: 56, deck: 19, b: 30, cp: 42, doors: 4, rails: true },
  skap: { L: 64, r: 5, wf: 11, wr: 52, hood: 15, roof: 28, a0: 11, a1: 17, c1: 62, c0: 63, deck: 27, b: 23, cab: 24, doors: 1, van: true },
};
for (const s of Object.values(KINDS)) { s.port = 6; s.ws = s.a0 + 4; s.drv = s.b - 4; s.fuel = s.L - 12; }
const TOPD = 3;
const R_BODY = 1, R_GLASS = 2, R_TRIM = 3, R_PIL = 4, R_TOPB = 5, R_TOPR = 6, R_TOPG = 7, R_BUMP = 8, R_ARCH = 9, R_MIR = 10, R_EXH = 11;
const CAR_COLORS = [0xd8352e, 0x2f6fd0, 0xf0b82a, 0x3f9e4a, 0xeceef0, 0x2a2c34, 0xa8b0bc, 0xe0762a, 0x2aa39a, 0x7a4ab8, 0x8a2432, 0x6ab8e0];
const HEADPAT = ['.hh.', 'hhhh', 'shhh', 'sshh', '.ss.', 'tttt', 'tttt'];

function carHeights(s) {
  const ht = [];
  for (let x = 0; x < s.L; x++) {
    let h;
    if (x < 3) h = s.hood - 2 + x;
    else if (x < s.a0) h = s.hood;
    else if (x < s.a1) h = Math.round(s.hood + (s.roof - s.hood) * (x - s.a0 + 1) / (s.a1 - s.a0 + 1));
    else if (x <= s.c1) h = s.roof;
    else if (x < s.c0) h = Math.round(s.roof - (s.roof - s.deck) * (x - s.c1) / (s.c0 - s.c1));
    else h = s.deck;
    if (x === s.L - 1) h -= 1;
    ht.push(h);
  }
  return ht;
}

function paintCar(kind, color, look, el, seed) {
  const s = KINDS[kind], L = s.L, ht = carHeights(s);
  const maxH = Math.max(...ht) + TOPD;
  const W = L + 4, H = maxH + 5, gy = H - 2;
  const M = new Uint8Array(W * H);
  const inb = (x, h) => x >= -2 && x < L + 2 && gy - h >= 0 && gy - h < H;
  const get = (x, h) => (inb(x, h) ? M[(gy - h) * W + x + 2] : 0);
  const set = (x, h, v) => { if (inb(x, h)) M[(gy - h) * W + x + 2] = v; };
  const cabEnd = s.van ? s.cab : s.c0 - 1;
  const inCab = (x) => x >= s.a0 && x <= cabEnd;
  const hbOf = (x) => (x < 2 || x > L - 3 ? 4 : 3);
  // 1) sidan
  for (let x = 0; x < L; x++) for (let h = hbOf(x); h <= ht[x]; h++) set(x, h, (x < 3 || x > L - 4) && h <= hbOf(x) + 3 ? R_BUMP : R_BODY);
  // 2) rutorna och stolparna
  for (let x = s.a0; x <= cabEnd; x++) for (let h = s.hood + 1; h < ht[x]; h++) {
    let r = R_GLASS;
    if (x === s.a0 || (x < s.a1 && h >= ht[x] - 1)) r = R_PIL;
    else if (!s.van && x > s.c1 && h >= ht[x] - 1) r = R_PIL;
    else if (x === cabEnd || (s.cp && x === cabEnd - 1)) r = R_PIL;
    if (x === s.b || x === s.b + 1) r = R_TRIM;
    if (s.cp && (x === s.cp || x === s.cp + 1)) r = R_TRIM;
    set(x, h, r);
  }
  // 3) ovansidan snett uppifrån: huv, vindruta, tak, bakruta
  for (let x = 0; x < L; x++) {
    const r = x >= s.a0 && x < s.a1 ? R_TOPG : !s.van && x > s.c1 && x < s.c0 ? R_TOPG : x >= s.a1 && x <= s.c1 ? R_TOPR : R_TOPB;
    for (let k = 1; k <= TOPD; k++) if (!get(x, ht[x] + k)) set(x, ht[x] + k, r);
  }
  // hajfena på taket
  if (!s.rails && !s.van) { set(s.c1 - 3, s.roof + TOPD + 1, R_TRIM); set(s.c1 - 2, s.roof + TOPD + 1, R_TRIM); set(s.c1 - 2, s.roof + TOPD + 2, R_TRIM); }
  // 4) backspegeln
  for (const [x, h] of [[s.a0 - 2, s.hood + 1], [s.a0 - 1, s.hood + 1], [s.a0 - 2, s.hood + 2], [s.a0 - 1, s.hood + 2]]) set(x, h, R_MIR);
  // 5) hjulhusen
  for (const wx of [s.wf, s.wr]) for (let x = wx - s.r - 2; x <= wx + s.r + 2; x++) for (let h = 0; h <= 2 * s.r + 2; h++) {
    const r = get(x, h);
    if ((r === R_BODY || r === R_BUMP) && Math.hypot(x - wx, h - s.r) <= s.r + 1.5) set(x, h, R_ARCH);
  }
  // avgasröret
  if (!el) for (let x = L - 4; x < L; x++) set(x, 2, R_EXH);

  // ---------- målning ----------
  const P = new Pix(W, H);
  const put = (x, h, c) => P.px(x + 2, gy - h, c);
  const cur = (x, h) => P.get(x + 2, gy - h);
  const nz = (x, h) => bayer(x + 2, gy - h) - 0.5;
  const c = color;
  const T = { hi: mix(c, 0xffffff, 0.55), lt: mix(c, 0xffffff, 0.25), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
  const crease = s.hood - 3;
  for (let x = -2; x < L + 2; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const n = nz(x, h), hb = hbOf(x);
    let col = c;
    if (r === R_BODY) {
      if (inCab(x) && h > s.hood) col = h === ht[x] ? T.hi : T.lt;                 // takkanten ovanför rutorna
      else if (inCab(x) && h === s.hood) col = 0x2a2b31;                              // fönsterlisten
      else {
        const topE = inCab(x) ? s.hood - 1 : ht[x];
        if (h === topE) col = T.hi;
        else if (h === topE - 1) col = T.lt;
        else if (h === crease) col = mix(T.lt, T.hi, 0.3);
        else if (h === crease - 1) col = T.dk;
        else if (h > crease) col = mix(T.c, T.lt, 0.3 + n * 0.5);
        else { const t = (crease - 1 - h) / Math.max(1, crease - 1 - hb); col = mix(T.md, T.dd, t * 0.8 + n * 0.3); }
        if (h === hb) col = T.dd;
      }
      if (hash(x, h, seed) > 0.965) col = mix(col, 0xffffff, 0.08);
    } else if (r === R_GLASS) {
      const gt = ht[x] - 1, gb = s.hood + 1, t = (h - gb) / Math.max(1, gt - gb);
      col = mix(0x263648, 0x82a2c0, t * 0.8 + n * 0.25);
      const st = (((x - h) % 13) + 13) % 13;
      if (st < 2) col = mix(col, 0xe6f2ff, 0.45); else if (st === 3) col = mix(col, 0xe6f2ff, 0.15);
    } else if (r === R_PIL) col = mix(T.c, T.lt, 0.4 + n * 0.3);
    else if (r === R_TRIM) col = mix(0x18191e, 0x2e2f36, n + 0.5);
    else if (r === R_TOPR) { const k = h - ht[x]; col = mix(c, 0xffffff, (k === 1 ? 0.52 : k === 2 ? 0.4 : 0.32) + n * 0.08); }
    else if (r === R_TOPB) { const k = h - ht[x]; col = mix(c, 0xffffff, (k === 1 ? 0.46 : 0.32 - 0.03 * k) + n * 0.08); }
    else if (r === R_TOPG) {
      const k = h - ht[x];
      col = mix(0x6f93b6, 0xdcecff, ((k - 1) / TOPD) * 0.7 + n * 0.25);
      if (((x * 2 + k) % 11) < 2) col = mix(col, 0xffffff, 0.4);
    } else if (r === R_BUMP) col = h === hb + 3 ? 0x5a5e66 : mix(0x24262c, 0x3a3d44, n + 0.5);
    else if (r === R_ARCH) { const wx = Math.abs(x - s.wf) < Math.abs(x - s.wr) ? s.wf : s.wr; col = Math.hypot(x - wx, h - s.r) > s.r + 0.6 ? 0x24242a : 0x121216; }
    else if (r === R_MIR) col = h === s.hood + 2 ? T.hi : T.md;
    else if (r === R_EXH) col = x === L - 1 ? 0x1c1c20 : x === L - 2 ? 0x8a8e96 : 0x5a5e66;
    put(x, h, col);
  }
  // takräcke
  if (s.rails) {
    for (let x = s.a1 + 2; x <= s.c1 - 2; x++) put(x, s.roof + TOPD, 0x2a2b30);
    for (const x of [s.a1 + 2, s.c1 - 2]) put(x, s.roof + TOPD - 1, 0x2a2b30);
  }
  // dörrfogar och handtag
  const seam = (x, h0, h1) => { for (let h = h0; h <= h1; h++) if (get(x, h) === R_BODY) put(x, h, mix(cur(x, h), T.dd, 0.6)); };
  seam(s.a0 - 1, 5, s.hood - 1);
  seam(s.b + 2, 4, s.hood - 1);
  const handles = [s.b - 4];
  if (s.doors === 4) { const rde = Math.min(s.c1 + 1, s.wr - s.r - 2); seam(rde, 5, s.hood - 1); handles.push(rde - 4); }
  if (s.van) {
    seam(s.cab + 8, 4, s.roof - 2); seam(s.cab + 24, 4, s.roof - 2);
    for (let x = s.cab + 8; x <= s.cab + 24; x++) put(x, s.roof - 3, mix(cur(x, s.roof - 3), T.dd, 0.4));
    handles.push(s.cab + 11);
  }
  for (const hx of handles) { put(hx, s.hood - 2, 0xeef1f4); put(hx + 1, s.hood - 2, 0xb8bec8); put(hx, s.hood - 3, T.dd); put(hx + 1, s.hood - 3, T.dd); }
  // strålkastare, blinkers och baklyktor
  put(0, s.hood - 2, 0xfff6d0); put(1, s.hood - 2, 0xffffff); put(2, s.hood - 2, 0xffe9a0);
  put(0, s.hood - 3, 0xffe9a0); put(1, s.hood - 3, 0xfff2c0); put(0, s.hood - 4, 0xf0a030);
  for (let h = s.deck - 4; h <= s.deck - 2; h++) { put(L - 1, h, 0xb81c24); put(L - 2, h, h === s.deck - 2 ? 0xff7a6a : 0xe0302a); }
  put(L - 2, 5, 0xe06a2a);   // reflex
  // elbilens blixt-dekal
  if (el) BOLT.forEach((row, j) => { for (let i = 0; i < 3; i++) { const x = s.b + 6 + i, h = s.hood - 2 - j; if (row[i] === '#' && get(x, h) === R_BODY) put(x, h, 0x6ae0ff); } });
  // skåpbilens reklam
  if (s.van) {
    const stripe = color === 0xeceef0 ? 0xd8352e : 0xf4f1ea;
    for (let x = s.cab + 1; x < L - 1; x++) for (const h of [9, 10]) if (get(x, h) === R_BODY) put(x, h, h === 10 ? stripe : mul(stripe, 0.8));
    text(P, SMALL, $t('BYGG'), 2 + s.cab + 12, gy - 20, color === 0x2a2c34 ? 0xf4f1ea : mul(color, 0.3));
  }
  // föraren bakom sidorutan
  const pal = { h: hex(look.hair, 0x3b2619), s: hex(look.skin, 0xe0a97f), t: hex(look.shirt, 0x3a7bd5) };
  HEADPAT.forEach((row, j) => {
    for (let i = 0; i < 4; i++) {
      const ch = row[i], x = s.b - 6 + i, h = s.hood + 7 - j;
      if (ch === '.' || get(x, h) !== R_GLASS) continue;
      put(x, h, mix(pal[ch], cur(x, h), 0.3));
    }
  });
  // kontur
  const outl = [];
  for (let x = -2; x < L + 2; x++) for (let h = -1; h <= gy; h++) {
    if (get(x, h)) continue;
    for (const [dx, dh] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      if (!get(x + dx, h + dh)) continue;
      outl.push([x, h, mix(mul(cur(x + dx, h + dh), 0.42), 0x1c1418, 0.4)]);
      break;
    }
  }
  for (const [x, h, col] of outl) put(x, h, col);
  const clean = newCanvas(W, H);
  clean.getContext('2d').drawImage(P.flush(), 0, 0);
  // smutsig variant: damm, stänk och insekter på rutorna
  for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (r !== R_GLASS && r !== R_TOPG) continue;
    const q = hash(x, h, seed + 5);
    if (q < 0.035) put(x, h, 0x2a2418);
    else if (q < 0.34) put(x, h, mix(cur(x, h), 0x8a7a58, 0.55));
    else if (q < 0.45) put(x, h, mix(cur(x, h), 0xb8a878, 0.3));
  }
  const dirty = P.flush();
  return { clean, dirty, gy, W, H, ht };
}

const WHEELS = {};
function wheelSprite(r, ph) {
  const key = r + '_' + ph;
  if (WHEELS[key]) return WHEELS[key];
  const S = 2 * r + 3, cc = r + 1, c = newCanvas(S, S), x2 = c.getContext('2d');
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - cc, dy = j - cc, d = Math.hypot(dx, dy);
    let col = null;
    if (d <= r + 0.4) {
      if (d > r - 1.25) col = dx + dy < -r * 0.7 ? 0x46484f : dy > r - 1.6 ? 0x121216 : 0x24252b;   // däcket
      else if (d <= 1.0) col = dx + dy < 0 ? 0x8a8e96 : 0x3a3d44;                                   // navet
      else {
        // fälgen: ljus uppe till vänster, mörk nere till höger, fyra hål som snurrar
        const a = Math.atan2(dy, dx) + ph * Math.PI / 4;
        col = dx + dy < -1 ? 0xe8ecf0 : dx + dy > 1 ? 0x8a929c : 0xb8bec8;
        if (Math.cos(a * 4) < -0.35) col = 0x4a4e56;
      }
    } else if (d <= r + 1.4) col = 0x0e0d12;
    if (col !== null) { x2.fillStyle = css(col); x2.fillRect(i, j, 1, 1); }
  }
  return (WHEELS[key] = c);
}

// ---------- pratbubblor ----------
// Spets nedåt (up=false) eller uppåt (up=true) i (cx, tip). Innerytan iw×ih;
// returnerar innerytans övre vänstra hörn.
function bubble(ctx, cx, tip, iw, ih, hot = false, up = false) {
  const w = iw + 2, h = ih + 2, x0 = cx - (w >> 1), y0 = up ? tip + 3 : tip - 2 - h;
  ctx.fillStyle = hot ? '#e8b230' : '#17151a';
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  if (up) { ctx.fillRect(cx - 1, tip + 1, 3, 2); ctx.fillRect(cx, tip, 1, 1); }
  else { ctx.fillRect(cx - 1, tip - 2, 3, 2); ctx.fillRect(cx, tip, 1, 1); }
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  if (up) ctx.fillRect(cx, tip + 1, 1, 2); else ctx.fillRect(cx, tip - 2, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
  if (hot) { ctx.fillStyle = '#ffe07a'; ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3); }
  return [x0 + 1, y0 + 1];
}
function patienceBar(ctx, x, y, w, left) {
  ctx.fillStyle = '#cfc6b2'; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
  ctx.fillRect(x, y, Math.max(1, Math.round(w * left)), 2);
}
function impatient(ctx, x, y, t) {
  if (Math.sin(t * 6) <= 0) return;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x, y, 5, 10);
  ctx.fillStyle = '#d9433b'; ctx.fillRect(x + 1, y + 1, 3, 5); ctx.fillRect(x + 1, y + 7, 3, 2);
}
const BOLT = ['..#', '.#.', '###', '.#.', '#..'];
function bolt(ctx, x, y, col) {
  ctx.fillStyle = col;
  BOLT.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') ctx.fillRect(x + i, y + j, 1, 1); });
}
const pillW = (key) => textW(SMALL, FUEL[key].name) + 4 + (key === 'EL' ? 4 : 0);
// kvalitetsbricka: "95", "98", "DIESEL", "EL"
function pill(ctx, x, y, key) {
  const f = FUEL[key], w = pillW(key);
  ctx.fillStyle = css(mul(f.col, 0.55)); ctx.fillRect(x + 1, y, w - 2, 9); ctx.fillRect(x, y + 1, w, 7);
  ctx.fillStyle = css(f.col); ctx.fillRect(x + 1, y + 1, w - 2, 7);
  ctx.fillStyle = css(mix(f.col, 0xffffff, 0.3)); ctx.fillRect(x + 1, y + 1, w - 2, 1);
  let tx = x + 2;
  if (key === 'EL') { bolt(ctx, tx, y + 2, '#ffd23f'); tx += 4; }
  ctxText(ctx, SMALL, f.name, tx, y + 2, css(f.ink));
  return w;
}
// tankmätaren: gröna zonen före FULL-strecket, röd spillzon efter
function gauge(ctx, x, y, w, f) {
  const full = Math.round(w / 1.15), zone = Math.round(w * ZONE / 1.15);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y - 1, w + 2, 9);
  ctx.fillStyle = '#3a3640'; ctx.fillRect(x, y, zone, 7);
  ctx.fillStyle = '#2e6b3a'; ctx.fillRect(x + zone, y, full - zone, 7);
  ctx.fillStyle = '#6b2a2a'; ctx.fillRect(x + full, y, w - full, 7);
  const fw = Math.min(w, Math.round(w * f / 1.15));
  ctx.fillStyle = '#f0b429'; ctx.fillRect(x, y + 1, Math.min(fw, full), 5);
  ctx.fillStyle = '#ffe07a'; ctx.fillRect(x, y + 1, Math.min(fw, full), 1);
  if (fw > full) { ctx.fillStyle = '#ff5a4a'; ctx.fillRect(x + full, y + 1, fw - full, 5); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + full, y - 1, 1, 9);
  ctx.fillStyle = '#8ee03c'; ctx.fillRect(x + zone, y - 1, 1, 1); ctx.fillRect(x + zone, y + 7, 1, 1);
}
function battery(ctx, x, y, f) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x, y, 14, 7); ctx.fillRect(x + 14, y + 2, 2, 3);
  ctx.fillStyle = '#3a3640'; ctx.fillRect(x + 1, y + 1, 12, 5);
  const fw = Math.round(12 * f);
  ctx.fillStyle = f >= 1 ? '#8ee03c' : '#45b964'; ctx.fillRect(x + 1, y + 1, fw, 5);
  ctx.fillStyle = '#b8f090'; ctx.fillRect(x + 1, y + 1, fw, 1);
  bolt(ctx, x + 6, y + 1, '#ffd23f');
}

// Slang/kabel som hänger mellan två punkter (kvadratisk kurva som sviktar nedåt).
function rope(ctx, ax, ay, bx, by, sag, thick = false) {
  const mx = (ax + bx) / 2, my = Math.max(ay, by) + sag;
  const n = Math.max(6, Math.ceil((Math.hypot(bx - ax, by - ay) + sag) * 1.4));
  let lx = null, ly = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = Math.round(u * u * ax + 2 * u * t * mx + t * t * bx), y = Math.round(u * u * ay + 2 * u * t * my + t * t * by);
    if (x === lx && y === ly) continue;
    ctx.fillStyle = '#101014'; ctx.fillRect(x, y, 1, thick ? 2 : 1);
    if (thick && i % 3 === 0) { ctx.fillStyle = '#3a3d44'; ctx.fillRect(x, y, 1, 1); }
    else if (!thick && i % 4 === 1) { ctx.fillStyle = '#34363e'; ctx.fillRect(x, y, 1, 1); }
    lx = x; ly = y;
  }
}

// ======================= jobba ihop: det som skickas mellan mackbiträdena =======================
// Förarnas och kioskkundernas utseende ur ett frö: i ett delat pass skickar skiftledaren bara fröet
// (ett tal) i stället för hela utseendet, och alla ritar ändå samma människor (som på Posten).
function seedRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lookOf = (seed) => makeLook(seedRng(seed));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KIND_IDS = Object.keys(KINDS);
const FUEL_IDS = ['95', '98', 'D', 'EL'];
const CAR_ST = ['in', 'wait', 'pay', 'out'];       // bilarnas lägen i skiftledarens snap (index = kod)
const CUST_ST = ['in', 'wait', 'out'];             // kioskkundernas
const PARTS = ['noz', 'kabel', 'raka'];            // pumpöns delar – gemensamma, EN håller i var och en
const PART = new Set(PARTS);
const CARRY_K = [...PARTS, ...ITEMS];              // allt man kan hålla i (kioskvarorna är ens egna)
const IN_CAR = 0;                                  // laddkabeln sitter i en elbil
// ljuden som skiftledarens utfall får spela hos den det gäller
const LJUD = new Set(['ok', 'click', 'coin', 'fel', 'miss', 'buy', 'slide', 'box']);
// Vägarna – samma hos alla, så en medarbetare kan låta bilar och kunder rulla/gå vidare mellan
// skiftledarens lägen: in från vägen till pumpön och ut igen, in till disken och ut igen.
const routeIn = (cx) => [[cx + 34, ROAD_Y], [cx + 9, PARK_Y + 12], [cx, PARK_Y]];
const routeOut = (x, L) => [[x - 12, PARK_Y + 22], [x - 30, ROAD_Y], [-L, ROAD_Y]];
const custRoute = (spot, st) => (st === 'in' ? [[KSPOTS[spot], ENTRY_Y], [KSPOTS[spot], KY]] : st === 'out' ? [[KSPOTS[spot], ENTRY_Y], [-16, ENTRY_Y]] : []);

export function makeJobbBensin(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0, bilar: 0, kiosk: 0, spill: 0 };
  // passets plan: längd (P.seconds) och takt på bilar och kunder (P.pace). Inga extra platser:
  // en fjärde pumpö skulle kräva ny grafik, och kioskdisken rymmer bara tre kunder.
  const P = planOf(A);
  const walker = createWalker({ top: 88, bottom: 188, left: 4, right: 380, spawn: [58, SERVE_Y] });
  walker.speed = 76;                                 // macken är större än burgarbaren – lite raskare steg
  const pops = makePops();
  const popLog = [];                                 // de senaste puffarnas text (provet läser dem: syntes "HANN FÖRE!"?)
  const addPop = pops.add;
  pops.add = (x, y, txt, c) => { popLog.push(txt); if (popLog.length > 30) popLog.shift(); addPop(x, y, txt, c); };
  const wage = JOBS?.bensinmack?.wage;                // kr per rätt sätts i game.js
  const plus = (s) => (wage ? `+${wage} ${s}` : s);
  // pumpöarna: munstyckena (noz), laddkabeln och rakan är true när de hänger på sin plats, annars
  // id:t på den som håller i dem ('' utan nät) – och kabeln är IN_CAR när den sitter i en elbil
  const islands = ISL.map((cx, i) => ({ i, cx, car: null, noz: [true, true, true], cable: true, raka: true, last: 0 }));
  let cars = [], custs = [], puffs = [], puddles = [], drops = [];
  let t = 0, seq = 0, carIn = 0.3, custIn = 2.2, carry = null, busy = null;
  let done = false, doneT = 0, reported = false, drawer = 0, grillN = 4, grillT = 0, rackGone = -1, rackT = 0;
  const cache = {};
  const bg = () => (cache.bg ||= paintBackground());
  const dispSpr = () => (cache.disp ||= paintDispenser());
  const chgSpr = () => (cache.chg ||= paintCharger());
  const counterSpr = () => (cache.counter ||= paintCounter());

  // ---------- hinder för gåendet ----------
  // (en bil som står vid pumpen står alltid mitt för sin ö)
  let obstKey = '';
  function refreshObstacles() {
    const parked = cars.filter((c) => c.state === 'wait' || c.state === 'pay');
    obstKey = parked.map((c) => c.id + ':' + c.isl).join(',');
    walker.setObstacles([
      [DISK.x0, DISK.top, DISK.x1 + 1, DISK.base + 1],   // disken
      [0, DISK.base + 2, KX1 - 1, 190],                  // kundernas golv
      ...ISL.map((cx) => [cx - 35, 80, cx + 33, 102]),    // pumpöarna
      [123, 150, 151, 190],                              // luft/vatten
      [360, 156, 384, 190],                              // gasolburen
      ...parked.map((c) => { const x = ISL[c.isl]; return [x - c.s.L / 2 + 2, PARK_Y - 10, x + c.s.L / 2 - 2, PARK_Y + 2]; }),
    ]);
  }
  refreshObstacles();

  // ---------- poängpuffar ----------
  // Alla puffar går via pop(): en ny puff som skulle hamna över en levande puff
  // läggs ovanför den i stället (kioskkunderna står bara 24 px isär, och en
  // och samma kund kan få två puffar tätt efter varandra).
  const livePops = [];
  function pop(x, y, txt, col) {
    const w = textW(SMALL, txt) + 4;
    x = Math.max((w >> 1) + 1, Math.min(FW - (w >> 1) - 1, Math.round(x)));
    for (let i = livePops.length - 1; i >= 0; i--) if (t - livePops[i].t0 > 0.9) livePops.splice(i, 1);
    for (let moved = true; moved;) {
      moved = false;
      for (const p of livePops) {
        const py = p.y - 14 * (t - p.t0);                // så högt har den hunnit stiga
        if (Math.abs(p.x - x) < (p.w + w) / 2 && y < py + 9 && y + 9 > py) { y = py - 10; moved = true; }
      }
    }
    pops.add(x, y, txt, col);
    livePops.push({ x, y, w, t0: t });
  }
  // puffar vid en bil: i höjd med mitt huvud över taket – men bredvid mig, aldrig
  // över mitt eget ansikte, när jag står bakom bilen (cx = bilens mitt)
  function carPop(c, txt, col) { carPopX(c.x, txt, col); }
  function carPopX(cx, txt, col) {
    const w = textW(SMALL, txt) + 4;
    let x = Math.round(cx);
    if (walker.py > PARK_Y - 34 && walker.py < PARK_Y + 6 && Math.abs(walker.px - x) < (w >> 1) + 13) {
      x = walker.px >= cx ? Math.round(walker.px) - 13 - (w >> 1) : Math.round(walker.px) + 13 + (w >> 1);
    }
    pop(x, PARK_Y - 44, txt, col);
  }
  const hannFore = (x, y) => { play('miss'); pop(x, y, $t('HANN FÖRE!'), C_FEL); };   // någon annan hann först

  // ---------- jobba tillsammans (delat pass via js/net/coop.js) ----------
  // Skiftledaren (den som varit längst på macken) kör det gemensamma: bilarna som rullar in till
  // de tre pumpöarna (vad de vill ha, tålamodet, laddningen, betalningen), pumpöarnas munstycken,
  // laddkablar och rakor, och kunderna vid kioskdisken. Läget delas ~3 ggr/s; medarbetarna ser
  // samma mack – bilarna rullar och kunderna går vidare hos dem mellan lägena – och skickar varje
  // handling på något gemensamt som ett önskemål med det de håller i: ta ett munstycke/kabeln/
  // rakan, börja och sluta tanka, koppla in och dra ur laddkabeln, börja och sluta tvätta rutan,
  // räcka över en vara till en kund. Skiftledaren kör samma kod åt dem och är ENDA domaren: ett
  // munstycke hålls av EN, en bil tankas och tvättas av EN åt gången (märket tk/tv) och räknas EN
  // gång, en kund får sin vara EN gång. Tankningen själv (mätaren och klicket i gröna zonen) går
  // hos den som tankar – skiftledaren får mätarläget med stoppet. Varorna i kiosken (korv, kaffe,
  // tidning) och det man bär är ens egna. Poängen går till den som gjorde det; lagets rätt, fel
  // och missade delas lika vid passets slut. Ihop kommer bilarna och kunderna tätare (en fjärde
  // pumpö finns inte – det är samma tre öar och tre platser vid disken).
  const coop = makeShiftCoop(A, 'away:jobbbensin');
  let snapIn = 0, wasLead = true, wasCoop = false, maxN = 1, snaps = 0;
  let pend = null, queued = null;          // medarbetarens önskemål som väntar på svar (och ett köat klick)
  const team = { ok: 0, fel: 0, miss: 0 }; // LAGETS räkning – delas lika vid passets slut
  const mate = () => coop.active && !coop.leader;
  const meId = () => coop.myId || '';
  const snapAsap = () => { snapIn = 0; };
  const int = (v, dflt) => (Number.isInteger(v) ? v : dflt);
  const str = (v) => (typeof v === 'string' ? v.slice(0, 80) : '');
  const carById = (id) => cars.find((c) => c.id === id);
  // vem håller i en del: 1 = hänger på sin plats, 0 = kabeln sitter i en bil, annars spelar-id
  const hEnc = (h) => (h === true ? 1 : h === IN_CAR ? 0 : String(h));
  const hDec = (v) => (v === 1 ? true : v === 0 ? IN_CAR : typeof v === 'string' ? v.slice(0, 40) : true);
  // det man håller i: 0 = inget, annars [sort (CARRY_K), ö, munstyckets fack]
  const carryEnc = (c) => (!c ? 0 : [CARRY_K.indexOf(c.k), c.isl ?? -1, c.j ?? -1]);
  function carryDec(a) {
    if (!Array.isArray(a)) return null;
    const kk = CARRY_K[a[0] | 0];
    if (!kk) return null;
    if (!PART.has(kk)) return { k: kk };
    const isl = clamp(a[1] | 0, 0, ISL.length - 1);
    if (kk !== 'noz') return { k: kk, isl };
    const j = clamp(a[2] | 0, 0, GRADES.length - 1);
    return { k: 'noz', isl, j, fuel: GRADES[j] };
  }
  // bil: [id, ö, sort, färg, förarens frö, bränsle, vill tvätta, flaggor (tankad 1, tvättad 2, smutsig 4,
  // har tutat 8), mätaren·1000, mätaren från början·1000, laddning·1000, kabeln i (−1), tålamod·10,
  // max·10, läge (CAR_ST), x, y, vägpunkter kvar, fart, tankas av ('' ingen = 0), tvättas av, tvätt·10, betalar·10]
  const carEnc = (c) => [c.id, c.isl, KIND_IDS.indexOf(c.kind), c.ci, c.ls | 0, FUEL_IDS.indexOf(c.need.fuel), c.need.wash ? 1 : 0,
    (c.fuelDone ? 1 : 0) | (c.washDone ? 2 : 0) | (c.dirty ? 4 : 0) | (c.honked ? 8 : 0),
    Math.round(c.fill * 1000), Math.round(c.fill0 * 1000), Math.round(c.charge * 1000), c.plug ?? -1,
    Math.round(c.patience * 10), Math.round(c.pmax * 10), CAR_ST.indexOf(c.state), Math.round(c.x), Math.round(c.y),
    c.path.length, Math.round(c.spd), c.tk ?? 0, c.tv ?? 0, Math.round(c.tvT * 10), Math.round(c.payT * 10)];
  // kund: [id, plats, önskan, läge (CUST_ST), x, y, tålamod·10, max·10, utseendefrö, fick (−1), vägpunkter kvar]
  const custEnc = (k) => [k.id, k.spot, ITEMS.indexOf(k.wish), CUST_ST.indexOf(k.state), Math.round(k.x), Math.round(k.y),
    Math.round(k.patience * 10), Math.round(k.pmax * 10), k.ls | 0, k.got ? ITEMS.indexOf(k.got) : -1, k.path.length];
  const sendSnap = () => coop.send({
    t: 'snap',
    ca: cars.map(carEnc), ku: custs.map(custEnc),
    // pumpöarna: [munstycke 95, 98, diesel, kabeln, rakan (hEnc), literräknaren·100]
    is: islands.map((I) => [...I.noz.map(hEnc), hEnc(I.cable), hEnc(I.raka), Math.round(I.last * 100)]),
    tm: [team.ok, team.fel, team.miss],
    sq: seq,   // (nästa id – tar någon annan över fortsätter numreringen efter det)
  });
  const applySnap = (m) => {
    if (Number.isFinite(m.sq)) seq = Math.max(seq, m.sq | 0);
    if (Array.isArray(m.is)) for (let i = 0; i < islands.length; i++) {
      const a = m.is[i], I = islands[i];
      if (!Array.isArray(a)) continue;
      I.noz = [hDec(a[0]), hDec(a[1]), hDec(a[2])];
      I.cable = hDec(a[3]); I.raka = hDec(a[4]);
      I.last = Math.max(0, (+a[5] || 0) / 100);
    }
    // det jag höll i från en pumpö är inte mitt längre (bilen körde, en ny ledare tog tillbaka det): släpp
    if (carry && PART.has(carry.k) && holderOf(carry) !== meId()) { carry = null; if (busy && busy.kind !== 'prep') busy = null; }
    if (Array.isArray(m.ca)) {
      const next = [];
      for (const a of m.ca.slice(0, 12)) {
        if (!Array.isArray(a)) continue;
        const id = int(a[0], -1), isl = clamp(a[1] | 0, 0, ISL.length - 1), st = CAR_ST[a[14] | 0] || 'wait';
        const kind = KIND_IDS[clamp(a[2] | 0, 0, KIND_IDS.length - 1)], ci = clamp(a[3] | 0, 0, CAR_COLORS.length - 1), ls = a[4] | 0;
        const fuel = FUEL_IDS[clamp(a[5] | 0, 0, FUEL_IDS.length - 1)], fl = a[7] | 0;
        let c = carById(id);
        if (c && (c.kind !== kind || c.ci !== ci || c.ls !== ls || c.need.fuel !== fuel)) { if (busy && busy.car === c) busy = null; c = null; }   // (samma id, en annan bil)
        const was = c ? c.state : null;
        if (!c) {
          c = { id, kind, s: KINDS[kind], ci, ls, need: { fuel, wash: false }, roll: 0, spd: 0, puffT: 0, path: [], x: +a[15] || 0, y: +a[16] || 0, honked: !!(fl & 8), klar: false };
          c.spr = paintCar(kind, CAR_COLORS[ci], lookOf(ls), fuel === 'EL', id * 7 + 3);
        }
        c.isl = isl; c.need.wash = !!a[6];
        c.fuelDone = !!(fl & 1); c.washDone = !!(fl & 2); c.dirty = !!(fl & 4);
        if ((fl & 8) && !c.honked) play('honk');   // föraren tutar – det hörs hos alla
        c.honked = !!(fl & 8);
        const mine = !!busy && busy.car === c;
        if (!(mine && busy.kind === 'fuel')) c.fill = Math.max(0, (a[8] | 0) / 1000);   // (min egen tankning går här)
        c.fill0 = Math.max(0, (a[9] | 0) / 1000);
        c.charge = clamp((a[10] | 0) / 1000, 0, 1);
        const pl = a[11] | 0;
        c.plug = pl >= 0 && pl < ISL.length ? pl : null;
        c.pmax = Math.max(1, (a[13] | 0) / 10); c.patience = clamp((a[12] | 0) / 10, 0, c.pmax);
        c.state = st;
        c.gx = +a[15] || 0; c.gy = +a[16] || 0;
        const route = st === 'in' ? routeIn(ISL[isl]) : st === 'out' ? routeOut(ISL[isl], c.s.L) : [];
        c.gpath = route.slice(Math.max(0, route.length - clamp(a[17] | 0, 0, route.length)));
        c.gspd = Math.max(0, +a[18] || 0);
        c.tk = typeof a[19] === 'string' ? a[19].slice(0, 40) : null;
        c.tv = typeof a[20] === 'string' ? a[20].slice(0, 40) : null;
        c.tvT = Math.max(0, (a[21] | 0) / 10);
        c.payT = Math.max(0, (a[22] | 0) / 10);
        // enligt skiftledaren tankar/tvättar jag inte längre den här bilen: sluta
        if (mine && ((busy.kind === 'fuel' && c.tk !== meId()) || (busy.kind === 'wash' && c.tv !== meId()))) busy = null;
        if (!was) c.klar = c.charge >= 1;
        else sayKlar(c);
        if (was === 'in' && st === 'wait') play('door');
        if (was && was !== 'out' && st === 'out') mateLeave(c);
        next.push(c);
      }
      if (busy && busy.car && !next.includes(busy.car)) busy = null;
      cars = next;
      for (const I of islands) I.car = cars.find((c) => c.isl === I.i && c.state !== 'out') || null;
      const key = cars.filter((c) => c.state === 'wait' || c.state === 'pay').map((c) => c.id + ':' + c.isl).join(',');
      if (key !== obstKey) refreshObstacles();
    }
    if (Array.isArray(m.ku)) {
      const next = [];
      for (const a of m.ku.slice(0, 8)) {
        if (!Array.isArray(a)) continue;
        const id = int(a[0], -1), spot = clamp(a[1] | 0, 0, KSPOTS.length - 1), st = CUST_ST[a[3] | 0] || 'wait';
        let k = custs.find((q) => q.id === id);
        const was = k ? k.state : null;
        if (!k) { k = { id, x: +a[4] || 0, y: +a[5] || 0, dir: st === 'wait' ? 'up' : 'right', path: [] }; if (snaps && st === 'in') play('door'); }
        if (k.ls !== (a[8] | 0) || !k.look) { k.ls = a[8] | 0; k.look = lookOf(k.ls); }
        k.spot = spot; k.wish = ITEMS[clamp(a[2] | 0, 0, ITEMS.length - 1)]; k.state = st;
        k.pmax = Math.max(1, (a[7] | 0) / 10); k.patience = clamp((a[6] | 0) / 10, 0, k.pmax);
        k.got = (a[9] | 0) >= 0 ? ITEMS[clamp(a[9] | 0, 0, ITEMS.length - 1)] : null;
        k.gx = +a[4] || 0; k.gy = +a[5] || 0;
        const route = custRoute(spot, st);
        k.gpath = route.slice(Math.max(0, route.length - clamp(a[10] | 0, 0, route.length)));
        // en kund som tröttnade går – det syns och hörs hos alla
        if (was === 'wait' && st === 'out' && !k.got) { play('miss'); pop(k.x, KY - 62, $t('GICK HEM...'), C_GREY); }
        next.push(k);
      }
      custs = next;
    }
    if (Array.isArray(m.tm)) { team.ok = m.tm[0] | 0; team.fel = m.tm[1] | 0; team.miss = m.tm[2] | 0; }
    snaps++;
  };
  // elbilen är fulladdad: "KLAR!" EN gång – vare sig laddningen tickade klart här eller kom med snappen
  function sayKlar(c) {
    if (c.klar || c.plug == null || c.charge < 1) return;
    c.klar = true; play('box'); carPop(c, $t('KLAR!'), C_EL);
  }
  // (medarbetaren) en bil kör från pumpen: slangen jag håller i vid den bilen följer inte med
  function mateLeave(c) {
    if (busy && busy.car === c) busy = null;
    if (carry && carry.isl === c.isl && (carry.k === 'noz' || carry.k === 'kabel') && Math.hypot(walker.px - c.x, walker.py - CAR_Y) < 50) returnCarry();
    if (c.fuelDone && (!c.need.wash || c.washDone)) play('coin');
    else { play('miss'); carPop(c, $t('KÖR IVÄG!'), C_GREY); }
  }
  // Medarbetarens mack mellan ledarens lägen: bilarna rullar vidare längs samma väg (ett "spöke"
  // går från ledarens senaste läge och bilen glider mjukt efter), laddningen, en kollegas tankning
  // och tålamodet tickar, kunderna går – nästa snap rättar allt.
  function mateTick(dt) {
    for (const c of cars) {
      if (c.gx === undefined) { c.gx = c.x; c.gy = c.y; }
      if (c.state === 'in' || c.state === 'out') {
        const wp = c.gpath && c.gpath[0];
        if (wp) {
          const dx = wp[0] - c.gx, dy = wp[1] - c.gy, d = Math.hypot(dx, dy);
          let sp;
          if (c.state === 'in') { sp = 66; if (c.gpath.length === 1) sp = Math.max(14, Math.min(sp, d * 2.4)); }
          else { c.gspd = Math.min(62, (c.gspd || 0) + 55 * dt); sp = c.gspd; }
          const step = sp * dt;
          if (d <= step) { c.gx = wp[0]; c.gy = wp[1]; c.gpath.shift(); } else { c.gx += dx / d * step; c.gy += dy / d * step; }
        }
        if (c.state === 'out' && c.need.fuel !== 'EL') {
          c.puffT -= dt;
          if (c.puffT <= 0) { c.puffT = 0.09; puffs.push({ x: c.x + c.s.L / 2 + 1, y: c.y - 3, a: 0, vx: 8 + Math.random() * 6 }); }
        }
      } else if (c.state === 'wait') {
        if (c.plug != null && c.charge < 1) c.charge = Math.min(1, c.charge + dt / CHARGE_T);
        sayKlar(c);
        const mine = !!busy && busy.car === c;
        if (c.tk != null && !mine) { c.fill = Math.min(1.12, c.fill + FILL_RATE * dt); oilDrip(c); }   // en kollega tankar
        if (c.tv != null && !mine) c.tvT += dt;
        if (!mine && c.tk == null && c.tv == null && !(c.plug != null && c.charge < 1)) c.patience = Math.max(0, c.patience - dt);
      } else if (c.state === 'pay') c.payT = Math.max(0, c.payT - dt);
      const ox = c.x, oy = c.y, ex = c.gx - c.x, ey = c.gy - c.y;
      if (Math.hypot(ex, ey) > 24) { c.x = c.gx; c.y = c.gy; }
      else { const f = Math.min(1, dt * 8); c.x += ex * f; c.y += ey * f; }
      c.roll += Math.hypot(c.x - ox, c.y - oy);
    }
    for (const k of custs) {
      if (k.gx === undefined) { k.gx = k.x; k.gy = k.y; }
      if (k.state === 'in' || k.state === 'out') {
        const wp = k.gpath && k.gpath[0], sp = (k.state === 'in' ? 36 : 42) * dt;
        if (wp) {
          const dx = wp[0] - k.gx, dy = wp[1] - k.gy, d = Math.hypot(dx, dy);
          k.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
          if (d <= sp) { k.gx = wp[0]; k.gy = wp[1]; k.gpath.shift(); } else { k.gx += dx / d * sp; k.gy += dy / d * sp; }
        }
      } else { k.dir = 'up'; k.patience = Math.max(0, k.patience - dt); }
      const ex = k.gx - k.x, ey = k.gy - k.y;
      if (Math.hypot(ex, ey) > 24) { k.x = k.gx; k.y = k.gy; }
      else { const f = Math.min(1, dt * 10); k.x += ex * f; k.y += ey * f; }
    }
  }
  // JAG tar över passet: hoppa över gamla id:n (bilar och kunder – inga krockar), bilarna kör vidare
  // från där de syns längs samma väg, och nästa bil och kund kommer snart
  function takeOver() {
    const ids = [...cars.map((c) => c.id), ...custs.map((k) => k.id)];
    seq = Math.max(seq, 1 + Math.max(-1, ...ids));
    for (const c of cars) {
      if (c.gx !== undefined) { c.x = c.gx; c.y = c.gy; }
      if (c.state === 'wait' || c.state === 'pay') { c.x = ISL[c.isl]; c.y = PARK_Y; c.path = []; }
      else if (c.state === 'in') c.path = c.gpath && c.gpath.length ? c.gpath : routeIn(ISL[c.isl]).slice(-1);
      else c.path = c.gpath || [];
      c.spd = c.gspd || 0;
      c.gx = c.gy = undefined; c.gpath = null;
    }
    for (const k of custs) {
      if (k.gx !== undefined) { k.x = k.gx; k.y = k.gy; }
      if (k.state === 'wait') { k.x = KSPOTS[k.spot]; k.y = KY; k.path = []; }
      else k.path = k.gpath && k.gpath.length ? k.gpath : k.state === 'in' ? custRoute(k.spot, 'in').slice(-1) : [];
      k.gx = k.gy = undefined; k.gpath = null;
    }
    for (const I of islands) I.car = cars.find((c) => c.isl === I.i && c.state !== 'out') || null;
    carIn = Math.min(carIn, 1.5); custIn = Math.min(custIn, 2);
    refreshObstacles();
    snapAsap();
  }
  // jag blir medarbetare: nästa snap bestämmer var allt är
  function becomeMate() {
    for (const c of cars) { c.gx = undefined; c.gpath = null; }
    for (const k of custs) { k.gx = undefined; k.gpath = null; }
  }
  // (skiftledaren) den som gått från macken håller inte i något längre: munstycken, kablar och rakor
  // hänger på sin plats igen, och bilen hen tankade eller tvättade är fri
  function sweepGone() {
    const ids = new Set([meId(), ...coop.peers().map((f) => f.id)]);
    const gone = (h) => typeof h === 'string' && !ids.has(h);
    for (const I of islands) {
      for (let j = 0; j < I.noz.length; j++) if (gone(I.noz[j])) I.noz[j] = true;
      if (gone(I.cable)) I.cable = true;
      if (gone(I.raka)) I.raka = true;
    }
    for (const c of cars) { if (gone(c.tk)) c.tk = null; if (gone(c.tv)) { c.tv = null; c.tvT = 0; } }
  }
  // mitt pass är slut: det jag håller i tillbaka, och bilen jag tankade eller tvättade är fri
  function letGo() {
    if (!coop.active) return;
    if (mate()) coop.send({ t: 'tillbaka', c: carryEnc(carry), alla: 1 });
    else {
      if (carry && PART.has(carry.k)) putBack(carry, meId(), true);
      for (const c of cars) { if (c.tk === meId()) c.tk = null; if (c.tv === meId()) { c.tv = null; c.tvT = 0; } }
      sendSnap();
    }
    carry = null;
  }

  // Mackbiträdet som gör något med det gemensamma: jag själv, eller – hos skiftledaren – en
  // medarbetare vars önskemål körs åt hen. Det hen håller i följer med önskemålet och tillbaka i svaret.
  const meK = () => ({ by: meId(), fx: [], get carry() { return carry; }, set carry(v) { carry = v; } });
  const forK = (by, c) => ({ by, fx: [], carry: c, remote: true });
  // Utfallet av en handling: [slag, vem (spelar-id; '' = alla på macken), ...]. Det som gäller mig
  // (eller alla) syns och hörs här direkt – ensam gäller allt mig; i ett delat pass (eller när jag
  // kör en medarbetares önskemål) följer resten med svaret ut.
  function fx(k, who, kind, ...a) {
    const me = meId(), ut = coop.active || !!k.remote;
    if (!who || who === me || !ut) doFx(kind, a);
    if (ut && who !== me) k.fx.push([kind, who, ...a]);
  }
  function doFx(kind, a) {
    if (kind === 's') { if (LJUD.has(a[0])) play(a[0]); }
    else if (kind === 'p') pop(+a[0] || 0, +a[1] || 0, String(a[2]).slice(0, 48), String(a[3] || C_GREY));
    else if (kind === 'c') carPopX(+a[0] || 0, String(a[1]).slice(0, 48), String(a[2] || C_GREY));   // puff vid en bil
    else if (kind === 'H') hannFore(+a[0] || 0, +a[1] || 0);
    else if (kind === 'o') { stats.ok++; if (a[0] === 'k') stats.kiosk++; }   // rätt (k = i kiosken)
    else if (kind === 'f') { stats.fel++; if (a[0] === 's') stats.spill++; }  // fel (s = spill)
    else if (kind === 'T' || kind === 'W') {   // tankningen/tvätten börjar – den går hos mig
      const c = carById(a[0]);
      if (!c || c.state !== 'wait') return;
      busy = kind === 'T' ? { kind: 'fuel', car: c, t: 0 } : { kind: 'wash', car: c, t: 0, dur: 1.3 };
      walker.dir = 'down';
      play(kind === 'T' ? 'click' : 'slide');
    }
    else if (kind === 'u') puddles.push({ x: +a[0] || 0, y: +a[1] || 0, r: clamp(+a[2] || 7, 2, 30), age: 0 });   // spillpölen
    else if (kind === 'd') drawer = 0.9;   // kassalådan åker ut
  }
  const kLjud = (k, s) => fx(k, k.by, 's', s);
  const kCar = (k, c, txt, col) => fx(k, k.by, 'c', Math.round(c.x), txt, col);      // bara hos den det gäller
  const kCarAll = (k, c, txt, col) => fx(k, '', 'c', Math.round(c.x), txt, col);     // syns hos alla på macken
  const kPop = (k, x, y, txt, col) => fx(k, '', 'p', Math.round(x), Math.round(y), txt, col);
  const kSay = (k, x, y, txt, col = C_GREY) => fx(k, k.by, 'p', Math.round(x), Math.round(y), txt, col);
  // En handling på något gemensamt: ensam (eller som skiftledare) görs den direkt, som medarbetare
  // blir den ett önskemål till skiftledaren – med det man håller i. must: skickas även om ett annat
  // önskemål väntar (att sluta tanka eller tvätta får aldrig försvinna).
  function shared(m, runIt, must = false) {
    if (mate()) { if (!pend || must) ask({ t: 'do', ...m, c: carryEnc(carry) }); return; }
    const k = meK();
    runIt(k);
    publish(k, false);
  }
  // skiftledaren: läget ut direkt efter en handling (FÖRE svaret – då har den som frågade redan
  // det nya läget när svaret kommer) och utfallet till alla
  function publish(k, svar) {
    if (!svar && !(coop.active && coop.leader && coop.settled)) return;
    if (k.remote && k.carry && PART.has(k.carry.k) && holderOf(k.carry) !== k.by) k.carry = null;   // (inte hens längre)
    sendSnap(); coop.sentSnap(); snapIn = 0.35;
    if (svar) coop.send({ t: 'res', by: k.by, fx: k.fx, c: carryEnc(k.carry) });
    else if (k.fx.length) coop.send({ t: 'res', by: k.by, fx: k.fx });
  }
  // medarbetarens önskemål: mackbiträdet väntar på ledarens svar (högst 2,5 s – sedan kan man försöka igen)
  function ask(m) { coop.send(m); pend = { t: 2.5 }; }
  function answered() {
    pend = null;
    if (queued && !done) { const q = queued; queued = null; self.down(q[0], q[1]); }
  }
  coop.on('snap', (m) => { if (!coop.leader) applySnap(m); });
  coop.on('res', (m) => {   // ledarens utfall: puffarna hos alla – händerna och poängen hos den det gäller
    const me = coop.myId, mine = m.by === me;
    if (coop.leader && !mine) return;   // (skiftledaren har redan visat det hos sig)
    for (const f of (Array.isArray(m.fx) ? m.fx : []).slice(0, 24)) {
      if (!Array.isArray(f)) continue;
      const who = str(f[1]);
      if (!who || who === me) doFx(f[0], f.slice(2));
    }
    if (mine) { if ('c' in m) carry = carryDec(m.c); answered(); }
  });
  coop.on('do', (m, from) => {   // en medarbetares handling på något gemensamt – körs här, åt hen
    if (!coop.leader) return;
    const k = forK(from, carryDec(m.c)), id = int(m.id, -1);
    if (k.carry && PART.has(k.carry.k) && holderOf(k.carry) !== from) k.carry = null;   // (det hen trodde hen höll i är inte hens)
    if (m.a === 'ta') doTake(k, clamp(int(m.isl, 0), 0, ISL.length - 1), PARTS[clamp(int(m.p, 0), 0, 2)], clamp(int(m.j, 0), 0, 2));
    else if (m.a === 'tanka') doTanka(k, id);
    else if (m.a === 'stopp') doStopp(k, id, (+m.f || 0) / 1000, !!m.au);
    else if (m.a === 'plugg') doPlugg(k, id);
    else if (m.a === 'ur') doUr(k, id);
    else if (m.a === 'tvatta') doTvatta(k, id);
    else if (m.a === 'tvattat') doTvattat(k, id);
    else if (m.a === 'kund') doKund(k, id);
    else return;
    publish(k, true);
  });
  // en medarbetare lade tillbaka det hen höll i (och – när hens pass är slut – släpper bilen hen höll på med)
  coop.on('tillbaka', (m, from) => {
    if (!coop.leader) return;
    const c = carryDec(m.c);
    if (c && PART.has(c.k)) putBack(c, from);
    if (m.alla) for (const car of cars) { if (car.tk === from) car.tk = null; if (car.tv === from) { car.tv = null; car.tvT = 0; } }
    snapAsap();
  });

  // ---------- bära ----------
  const hands = () => { const d = walker.dir; return [Math.round(walker.px) + (d === 'left' ? -7 : d === 'right' ? 7 : 0), Math.round(walker.py) - 15]; };
  function hoseOrigin(c) {
    const cx = ISL[c.isl];
    if (c.k === 'noz') return [cx + bayX(c.j) + 6, DISP_Y + 34];
    return [cx + CHG_X + 5, CHG_Y + 22];
  }
  const holderOf = (c) => { const I = islands[c.isl]; return !I ? null : c.k === 'noz' ? I.noz[c.j] : c.k === 'kabel' ? I.cable : I.raka; };
  // delen hänger på sin plats igen – om den var hens som lägger tillbaka den (force: det vet jag redan)
  function putBack(c, by, force = false) {
    const I = islands[c.isl];
    if (!I || !PART.has(c.k) || (!force && holderOf(c) !== by)) return;
    if (c.k === 'noz') I.noz[c.j] = true;
    else if (c.k === 'kabel') I.cable = true;
    else I.raka = true;
  }
  // lägg ifrån mig det jag håller i: munstycket i pumpen, kabeln på kroken, rakan i hinken (en
  // kioskvara försvinner). Ihop är pumpöarna gemensamma – som medarbetare säger jag till
  // skiftledaren (utan att vänta på svar) och ser det hänga där direkt
  function returnCarry() {
    if (!carry) return;
    if (PART.has(carry.k)) {
      if (mate()) coop.send({ t: 'tillbaka', c: carryEnc(carry) });
      else if (coop.active) snapAsap();
      putBack(carry, meId(), true);
    }
    carry = null;
  }
  // (skiftledaren) det mackbiträdet k håller i hänger på sin plats igen
  function retK(k) {
    if (k.carry && PART.has(k.carry.k)) putBack(k.carry, k.by, !k.remote);
    k.carry = null;
  }
  function hoseOk(tx, ty) {
    if (!carry || (carry.k !== 'noz' && carry.k !== 'kabel')) return true;
    const [ox, oy] = hoseOrigin(carry);
    return Math.hypot(tx - ox, ty - 15 - oy) <= HOSE;
  }
  function walkTo(tx, ty, cb) {
    if (!hoseOk(tx, ty)) { returnCarry(); play('slide'); }
    walker.walkTo(tx, ty, cb);
  }

  // ---------- bilarna ----------
  const KIND_BAG = ['kompakt', 'kompakt', 'kompakt', 'sedan', 'sedan', 'sedan', 'kombi', 'kombi', 'kombi', 'suv', 'suv', 'skap'];
  function wishFor(kind) {
    const r = Math.random();
    if (kind === 'skap') return 'D';
    if (kind === 'suv') return r < 0.5 ? 'D' : r < 0.75 ? '95' : 'EL';
    if (kind === 'kombi') return r < 0.35 ? '95' : r < 0.7 ? 'D' : r < 0.85 ? 'EL' : '98';
    if (kind === 'sedan') return r < 0.4 ? '95' : r < 0.65 ? '98' : r < 0.9 ? 'EL' : 'D';
    return r < 0.45 ? '95' : r < 0.8 ? 'EL' : '98';
  }
  function makeCar(I, { fuel, wash, kind } = {}) {
    kind = kind || KIND_BAG[(Math.random() * KIND_BAG.length) | 0];
    if (fuel === 'D' && kind === 'kompakt') kind = 'kombi';
    fuel = fuel || wishFor(kind);
    if (kind === 'skap' && fuel !== 'D') kind = 'sedan';
    wash = wash ?? Math.random() < 0.35;
    const s = KINDS[kind], el = fuel === 'EL';
    const ci = kind === 'skap' && Math.random() < 0.5 ? 4 : (Math.random() * CAR_COLORS.length) | 0;   // (4 = den vita skåpbilen)
    const ls = (Math.random() * 0x7fffffff) | 0;   // förarens utseende ur ett frö (skiftledaren skickar bara fröet)
    const pmax = 31 - 6 * Math.min(1, t / P.seconds);
    const c = {
      id: seq++, kind, s, ci, ls, isl: I.i, need: { fuel, wash }, fuelDone: false, washDone: false,
      fill: 0.08 + Math.random() * 0.34, charge: 0.12 + Math.random() * 0.3, plug: null,
      patience: pmax, pmax, honked: false, dirty: wash, roll: 0, spd: 0, puffT: 0,
      x: FW + s.L / 2 + 6, y: ROAD_Y, state: 'in', path: [], payT: 0,
      tk: null, tv: null, tvT: 0, tkT: 0, klar: false,   // tk/tv: vem som tankar/tvättar just nu (null = ingen)
    };
    c.fill0 = c.fill;
    c.spr = paintCar(kind, CAR_COLORS[ci], lookOf(ls), el, c.id * 7 + 3);
    I.car = c;
    return c;
  }
  function spawnCar() {
    const free = islands.filter((I) => !I.car);
    if (!free.length) return null;
    // vänta om infarten är upptagen
    if (cars.some((o) => (o.state === 'in' || o.state === 'out') && o.y > 186 && o.x > FW - 50)) return null;
    const I = free[(Math.random() * free.length) | 0];
    const c = makeCar(I);
    c.path = routeIn(I.cx);
    cars.push(c);
    return c;
  }
  function blocked(c, nx, ny) {
    for (const o of cars) {
      if (o === c || o.state === 'wait' || o.state === 'pay' || o.x >= c.x) continue;
      if (Math.abs(o.y - ny) < 22 && nx - o.x < (c.s.L + o.s.L) / 2 + 6) return true;
    }
    return false;
  }
  function moveCar(c, dt) {
    const wp = c.path[0];
    if (!wp) {
      if (c.state === 'in') { c.state = 'wait'; refreshObstacles(); play('door'); }
      else c.gone = true;
      return;
    }
    const dx = wp[0] - c.x, dy = wp[1] - c.y, d = Math.hypot(dx, dy);
    let sp;
    if (c.state === 'in') { sp = 66; if (c.path.length === 1) sp = Math.max(14, Math.min(sp, d * 2.4)); }
    else { c.spd = Math.min(62, c.spd + 55 * dt); sp = c.spd; }
    const step = sp * dt;
    const nx = d <= step ? wp[0] : c.x + dx / d * step, ny = d <= step ? wp[1] : c.y + dy / d * step;
    if (blocked(c, nx, ny)) return;
    c.roll += Math.hypot(nx - c.x, ny - c.y);
    c.x = nx; c.y = ny;
    if (d <= step) c.path.shift();
    // avgaser när bilen startar och kör i väg
    if (c.state === 'out' && c.need.fuel !== 'EL') {
      c.puffT -= dt;
      if (c.puffT <= 0) { c.puffT = 0.09; puffs.push({ x: c.x + c.s.L / 2 + 1, y: c.y - 3, a: 0, vx: 8 + Math.random() * 6 }); }
    }
  }
  function carLeave(c, angry = false) {
    if (busy && busy.car === c) busy = null;
    if (carry && carry.isl === c.isl && (carry.k === 'noz' || carry.k === 'kabel') && Math.hypot(walker.px - c.x, walker.py - CAR_Y) < 50) returnCarry();
    if (c.plug != null) { islands[c.plug].cable = true; c.plug = null; }
    c.tk = null; c.tv = null;
    c.state = 'out'; c.spd = 0;
    c.path = routeOut(c.x, c.s.L);
    islands[c.isl].car = null;
    if (!angry) stats.bilar++;
    refreshObstacles();
  }
  const carTopY = (c, x) => { const i = Math.max(0, Math.min(c.s.L - 1, Math.round(x - (c.x - c.s.L / 2)))); return Math.round(c.y) - 1 - c.spr.ht[i] - TOPD; };
  // spillet droppar från tanklocket när mätaren gått över
  function oilDrip(c) {
    if (c.fill > 1 && Math.random() < 0.6) drops.push({ x: Math.round(c.x - c.s.L / 2 + c.s.fuel) + (Math.random() * 3 | 0), y: PARK_Y - 2, vy: 4, a: 0, oil: true });
  }
  function checkDone(c) {
    if (c.fuelDone && (!c.need.wash || c.washDone)) { c.state = 'pay'; c.payT = 1.1; }
  }
  // Framme vid bilen (på plats – klicket har gått fram). Det gemensamma görs av skiftledaren åt
  // mackbiträdet k (se "jobba tillsammans"): k.carry är det hen håller i, och allt som ska synas och
  // höras går via k – ensam är det bara jag, precis som förut.
  function nozzleAt(c) {
    if (c.state !== 'wait' || !carry || carry.k !== 'noz') return;
    shared({ a: 'tanka', id: c.id }, (k) => doTanka(k, c.id));
  }
  function doTanka(k, id) {
    const c = carById(id);
    if (!c || c.state !== 'wait' || !k.carry || k.carry.k !== 'noz') return;
    if (c.fuelDone) { kCar(k, c, $t('REDAN FULL'), C_GREY); retK(k); return; }
    if (k.carry.fuel !== c.need.fuel) {
      team.fel++; fx(k, k.by, 'f'); kLjud(k, 'fel');
      kCarAll(k, c, c.need.fuel === 'EL' ? $t('ELBIL!') : $t('FEL BRÄNSLE!'), C_FEL);
      retK(k);
      return;
    }
    if (c.tk != null && c.tk !== k.by) { fx(k, k.by, 'H', Math.round(c.x), PARK_Y - 44); return; }   // någon annan tankar redan
    c.tk = k.by; c.tkT = 0;
    fx(k, k.by, 'T', c.id);
  }
  // släpp handtaget: i gröna zonen = fullt, för tidigt = MER! (munstycket sitter kvar), för sent = spill
  function stopFuel(auto = false) {
    if (!busy || busy.kind !== 'fuel') return;
    const c = busy.car;
    busy = null;
    if (mate()) { ask({ t: 'do', a: 'stopp', id: c.id, f: Math.round(c.fill * 1000), au: auto ? 1 : 0, c: carryEnc(carry) }); return; }
    const k = meK();
    judgeFuel(k, c, auto);
    publish(k, false);
  }
  // (skiftledaren) en medarbetare släppte handtaget vid mätarläget f
  function doStopp(k, id, f, auto) {
    const c = carById(id);
    if (!c || c.state !== 'wait' || c.fuelDone || (c.tk != null && c.tk !== k.by)) return;   // (redan avgjort)
    c.fill = clamp(f, c.fill0, 1.12);
    judgeFuel(k, c, auto);
  }
  function judgeFuel(k, c, auto) {
    c.tk = null; c.tkT = 0;
    const f = c.fill;
    if (!auto && f < ZONE) { kCar(k, c, $t('MER!'), C_INFO); kLjud(k, 'click'); return; }   // håller kvar munstycket
    if (f <= 1) { team.ok++; fx(k, k.by, 'o'); kLjud(k, 'coin'); kCarAll(k, c, plus($t('FULLT!')), C_OK); }
    else {
      team.fel++; fx(k, k.by, 'f', 's'); kLjud(k, 'fel');
      kCarAll(k, c, $t('SPILL!'), C_FEL);
      // pölen rinner ut bakom bakhjulet (ritas efter bilen, så den syns hel)
      fx(k, '', 'u', Math.round(c.x - c.s.L / 2 + c.s.fuel + 7), PARK_Y + 2, 7 + Math.round((f - 1) * 50));
    }
    c.fuelDone = true;
    islands[c.isl].last = (c.fill - c.fill0) * 55;
    retK(k);
    checkDone(c);
  }
  function plugAt(c) {
    if (c.state !== 'wait' || !carry || carry.k !== 'kabel') return;
    shared({ a: 'plugg', id: c.id }, (k) => doPlugg(k, c.id));
  }
  function doPlugg(k, id) {
    const c = carById(id);
    if (!c || c.state !== 'wait' || !k.carry || k.carry.k !== 'kabel') return;
    if (c.need.fuel !== 'EL') { team.fel++; fx(k, k.by, 'f'); kLjud(k, 'fel'); kCarAll(k, c, $t('INGEN ELBIL!'), C_FEL); retK(k); return; }
    if (c.fuelDone || c.plug != null) { kCar(k, c, $t('REDAN KLAR'), C_GREY); retK(k); return; }
    c.plug = k.carry.isl;
    islands[k.carry.isl].cable = IN_CAR;
    k.carry = null;
    kLjud(k, 'click');
    kCarAll(k, c, $t('LADDAR...'), C_EL);
  }
  function unplug(c) {
    if (c.plug == null) return;
    shared({ a: 'ur', id: c.id }, (k) => doUr(k, c.id));
  }
  function doUr(k, id) {
    const c = carById(id);
    if (!c || c.state !== 'wait') return;
    if (c.plug == null) { fx(k, k.by, 'H', Math.round(c.x), PARK_Y - 44); return; }   // någon annan drog ur den
    if (c.charge < 1) { kCar(k, c, $t('LADDAR...'), C_EL); return; }
    islands[c.plug].cable = true;
    c.plug = null; c.fuelDone = true;
    team.ok++; fx(k, k.by, 'o'); kLjud(k, 'coin');
    kCarAll(k, c, plus($t('LADDAD!')), C_OK);
    checkDone(c);
  }
  function washAt(c) {
    if (c.state !== 'wait') return;
    shared({ a: 'tvatta', id: c.id }, (k) => doTvatta(k, c.id));
  }
  function doTvatta(k, id) {
    const c = carById(id);
    if (!c || c.state !== 'wait') return;
    if (!c.need.wash || c.washDone) {
      if (c.plug != null && c.charge >= 1) doUr(k, id);
      else kCar(k, c, $t('REDAN REN'), C_GREY);
      return;
    }
    if (!k.carry || k.carry.k !== 'raka') return;
    if (c.tv != null && c.tv !== k.by) { fx(k, k.by, 'H', Math.round(c.x), PARK_Y - 44); return; }   // någon annan tvättar redan
    c.tv = k.by; c.tvT = 0;
    fx(k, k.by, 'W', c.id);
  }
  function finishWash(c) {
    busy = null;
    shared({ a: 'tvattat', id: c.id }, (k) => doTvattat(k, c.id), true);
  }
  function doTvattat(k, id) {
    const c = carById(id);
    if (!c || c.state !== 'wait' || c.washDone || (c.tv != null && c.tv !== k.by)) return;
    c.tv = null; c.tvT = 0;
    c.washDone = true; c.dirty = false;
    team.ok++; fx(k, k.by, 'o'); kLjud(k, 'ok');
    kCarAll(k, c, plus($t('BLANKT!')), C_OK);
    retK(k);
    checkDone(c);
  }
  // en kollega tankar bilen: mätaren går här också (hens klick avgör – kommer inget stopp rann det över)
  function remoteFuel(c, dt) {
    if (!coop.active || c.tk === meId()) { c.tk = null; return; }
    c.fill = Math.min(1.12, c.fill + FILL_RATE * dt);
    oilDrip(c);
    if (c.fill < 1.12) { c.tkT = 0; return; }
    c.tkT = (c.tkT || 0) + dt;
    if (c.tkT > 2.5) {
      const j = GRADES.indexOf(c.need.fuel), k = forK(c.tk, { k: 'noz', isl: c.isl, j, fuel: c.need.fuel });
      judgeFuel(k, c, true);
      publish(k, true);
    }
  }
  // en kollega tvättar rutan (kommer inget "klart" får den vänta på nästa som tar rakan)
  function remoteWash(c, dt) {
    if (!coop.active || c.tv === meId()) { c.tv = null; c.tvT = 0; return; }
    c.tvT += dt;
    if (c.tvT > 1.3 + 3) { c.tv = null; c.tvT = 0; }
  }
  // dit man går vid bilen och vad man gör där – beror på vad man håller i
  function carSpot(c) {
    const x0 = c.x - c.s.L / 2;
    if (carry && carry.k === 'noz') return [x0 + c.s.fuel, CAR_Y, () => nozzleAt(c)];
    if (carry && carry.k === 'kabel') return [x0 + c.s.port + 2, CAR_Y, () => plugAt(c)];
    if (carry && carry.k === 'raka') return [x0 + c.s.ws, CAR_Y, () => washAt(c)];
    if (c.plug != null) return [x0 + c.s.port + 2, CAR_Y, () => unplug(c)];
    return [x0 + c.s.L / 2, CAR_Y, undefined];
  }
  function goCar(c) { const [x, y, cb] = carSpot(c); walkTo(x, y, cb); }

  // ---------- pumpöarna ----------
  function islandHit(x, y) {
    for (const I of islands) {
      const dx = x - I.cx;
      if (dx < -35 || dx > 33 || y < DISP_Y - 2 || y > STAND + 8) continue;
      if (dx >= BUCKET_X - 1 && dx <= BUCKET_X + 8 && y >= STAND - 18) return { I, part: 'raka' };
      if (dx >= CHG_X - 1 && dx <= CHG_X + 10 && y >= CHG_Y - 1) return { I, part: 'kabel' };
      if (dx >= DISP_X && dx < DISP_X + DISP_W) return { I, part: 'noz', j: Math.max(0, Math.min(2, Math.floor((dx - DISP_X - 1) / 9))) };
    }
    return null;
  }
  const partX = (I, part, j) => (part === 'noz' ? I.cx + bayX(j) + 4 : part === 'kabel' ? I.cx + CHG_X + 5 : I.cx + BUCKET_X + 4);
  const isFree = (I, part, j) => (part === 'noz' ? I.noz[j] === true : part === 'kabel' ? I.cable === true : I.raka === true);
  function takeFrom(hit) {
    const { I, part } = hit, j = hit.j | 0;
    // samma sak som jag håller i: häng tillbaka den (rakan går alltid hem till sin egen hink)
    if (carry && carry.k === part && (part === 'raka' || (carry.isl === I.i && (part !== 'noz' || carry.j === j)))) { returnCarry(); play('click'); return; }
    if (!isFree(I, part, j)) {
      if (part === 'kabel' && I.cable === IN_CAR) pop(I.cx + CHG_X + 5, STAND - 44, $t('SITTER I BILEN'), C_GREY);
      else if (coop.active) hannFore(partX(I, part, j), STAND - 44);   // (ihop: en kollega håller i den)
      return;
    }
    shared({ a: 'ta', isl: I.i, p: PARTS.indexOf(part), j }, (k) => doTake(k, I.i, part, j));
  }
  // ta munstycke j / kabeln / rakan på ö isl – det hen håller i läggs ifrån först
  function doTake(k, isl, part, j) {
    const I = islands[isl];
    if (!isFree(I, part, j)) {
      if (part === 'kabel' && I.cable === IN_CAR) kSay(k, I.cx + CHG_X + 5, STAND - 44, $t('SITTER I BILEN'));
      else fx(k, k.by, 'H', partX(I, part, j), STAND - 44);
      return;
    }
    retK(k);
    if (part === 'noz') { I.noz[j] = k.by; k.carry = { k: 'noz', isl, j, fuel: GRADES[j] }; }
    else if (part === 'kabel') { I.cable = k.by; k.carry = { k: 'kabel', isl }; }
    else { I.raka = k.by; k.carry = { k: 'raka', isl }; }
    kLjud(k, 'click');
  }
  function goIsland(hit) {
    walkTo(partX(hit.I, hit.part, hit.j), LANE_Y, () => takeFrom(hit));
  }

  // ---------- kiosken ----------
  function freeSpot() { return KSPOTS.findIndex((_, i) => !custs.some((k) => k.spot === i && k.state !== 'out')); }
  function addCust(wish, placed = false) {
    const i = freeSpot();
    if (i < 0) return null;
    const pmax = 25 - 5 * Math.min(1, t / P.seconds);
    const x = KSPOTS[i];
    const ls = (Math.random() * 0x7fffffff) | 0;   // utseendet ur ett frö (skiftledaren skickar bara fröet)
    const k = { id: seq++, ls, look: lookOf(ls), spot: i, wish: wish ?? ITEMS[(Math.random() * 3) | 0], patience: pmax, pmax, got: null,
      dir: placed ? 'up' : 'right', x: placed ? x : -12, y: placed ? KY : ENTRY_Y, state: placed ? 'wait' : 'in', path: placed ? [] : custRoute(i, 'in') };
    custs.push(k);
    return k;
  }
  function custLeave(k) { k.state = 'out'; k.path = [[k.x, ENTRY_Y], [-16, ENTRY_Y]]; }
  // framme bakom disken: räck över det jag bär
  function give(cu) {
    if (!carry || !ITEMS.includes(carry.k)) return;
    if (cu.state !== 'wait') { if (coop.active && cu.got) hannFore(cu.x, KY - 62); return; }   // (ihop: en kollega hann före)
    shared({ a: 'kund', id: cu.id }, (k) => doKund(k, cu.id));
  }
  function doKund(k, id) {
    const cu = custs.find((q) => q.id === id);
    if (!k.carry || !ITEMS.includes(k.carry.k)) return;
    if (!cu || cu.state !== 'wait') { fx(k, k.by, 'H', cu ? Math.round(cu.x) : 52, KY - 62); return; }   // någon annan hann före
    const py = KY - 62;
    if (k.carry.k === cu.wish) {
      team.ok++; fx(k, k.by, 'o', 'k');
      kLjud(k, 'buy');
      kPop(k, cu.x, py, plus($t('TACK!')), C_OK);
      cu.got = k.carry.k; fx(k, '', 'd');
      custLeave(cu);
    } else {
      team.fel++; fx(k, k.by, 'f');
      kLjud(k, 'fel');
      kPop(k, cu.x, py, $t('FEL VARA!'), C_FEL);
    }
    k.carry = null;
  }
  function custAt(x, y) {
    return custs.find((k) => k.state === 'wait' && Math.abs(k.x - x) < 12 && y > k.y - 60 && y < k.y + 3)
      || (y >= DISK.top - 12 && y <= DISK.base && x <= DISK.x1 ? custs.find((k) => k.state === 'wait' && Math.abs(k.x - x) < 12) : null);
  }
  function goStation(st) {
    walkTo(st.sx, PICK_Y, () => {
      if (carry && carry.k === st.id) { carry = null; play('click'); return; }
      returnCarry();
      busy = { kind: 'prep', item: st.id, t: 0, dur: PREP[st.id] };
      walker.dir = 'up';
    });
  }
  function finishPrep(item) {
    busy = null;
    carry = { k: item };
    play('click');
    if (item === 'korv') { grillN = Math.max(1, grillN - 1); grillT = 3.5; }
    if (item === 'tidning') { rackGone = (Math.random() * 12) | 0; rackT = 3; }
  }

  // skiftledarens (och den ensammas) mack: nya bilar och kunder, bilarna vid pumparna och kunderna vid disken
  function leadTick(dt) {
    // nya bilar och kunder (tätare med vanan – P.pace; tålamodet är detsamma; ihop kommer de tätare)
    const prog = Math.min(1, t / P.seconds), ihop = coop.active ? 0.45 : 1;
    carIn -= dt;
    if (carIn <= 0) { const c = spawnCar(); carIn = c ? (6.8 - 2.6 * prog + Math.random() * 1.8) * P.pace * ihop : 0.6; if (c && coop.active) snapAsap(); }
    custIn -= dt;
    if (custIn <= 0) { const k = addCust(); custIn = k ? (7.5 - 2.8 * prog + Math.random() * 2) * P.pace * ihop : 1; if (k) { play('door'); if (coop.active) snapAsap(); } }
    // bilarna
    for (const c of cars) {
      if (c.state === 'in' || c.state === 'out') moveCar(c, dt);
      else if (c.state === 'wait') {
        if (c.plug != null && c.charge < 1) {
          c.charge = Math.min(1, c.charge + dt / CHARGE_T);
          if (c.charge >= 1) { c.klar = true; play('box'); carPop(c, $t('KLAR!'), C_EL); }
        }
        const mine = !!busy && busy.car === c;
        if (c.tk != null && !mine) remoteFuel(c, dt);
        if (c.tv != null && !mine) remoteWash(c, dt);
        const serviced = mine || c.tk != null || c.tv != null || (c.plug != null && c.charge < 1);
        if (!serviced) {
          c.patience -= dt;
          if (c.patience < 7 && !c.honked) { c.honked = true; play('honk'); }
          if (c.patience <= 0) { stats.miss++; team.miss++; play('miss'); carPop(c, $t('KÖR IVÄG!'), C_GREY); carLeave(c, true); if (coop.active) snapAsap(); }
        }
      } else if (c.state === 'pay') { c.payT -= dt; if (c.payT <= 0) { play('coin'); carLeave(c); if (coop.active) snapAsap(); } }
    }
    if (cars.some((c) => c.gone)) cars = cars.filter((c) => !c.gone);
    // kunderna i kiosken
    for (const k of custs) {
      if (k.state === 'in' || k.state === 'out') {
        const sp = (k.state === 'in' ? 36 : 42) * dt, wp = k.path[0];
        if (wp) {
          const dx = wp[0] - k.x, dy = wp[1] - k.y, d = Math.hypot(dx, dy);
          k.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
          if (d <= sp) { k.x = wp[0]; k.y = wp[1]; k.path.shift(); if (!k.path.length && k.state === 'in') { k.state = 'wait'; k.dir = 'up'; } }
          else { k.x += dx / d * sp; k.y += dy / d * sp; }
        } else if (k.state === 'out') k.gone = true;
      } else if (k.state === 'wait') {
        k.patience -= dt;
        if (k.patience <= 0) { stats.miss++; team.miss++; play('miss'); pop(k.x, KY - 62, $t('GICK HEM...'), C_GREY); custLeave(k); if (coop.active) snapAsap(); }
      }
    }
    if (custs.some((k) => k.gone)) custs = custs.filter((k) => !k.gone);
    if (coop.active || maxN > 1) sweepGone();
    if (coop.active) { snapIn -= dt; if (snapIn <= 0) { snapIn = 0.35; sendSnap(); coop.sentSnap(); } }
  }

  // ---------- rita ----------
  function drawIsland(ctx, I) {
    const cx = I.cx, dx0 = cx + DISP_X, dy0 = DISP_Y;
    // pumpen med literräknaren (räknar även när en kollega tankar)
    ctx.drawImage(dispSpr(), dx0, dy0);
    const fueling = (busy && busy.kind === 'fuel' && busy.car.isl === I.i ? busy.car : null)
      || cars.find((c) => c.isl === I.i && c.state === 'wait' && c.tk != null) || null;
    const lit = fueling ? (fueling.fill - fueling.fill0) * 55 : I.last;
    const s = lit.toFixed(2), tw = textW(SMALL, s);
    ctxText(ctx, SMALL, s, dx0 + DISP_W - 4 - tw, dy0 + 7, fueling ? '#9dffb4' : '#5fd87e');
    GRADES.forEach((g, j) => {
      const bx = cx + bayX(j);
      if (I.noz[j] !== true) return;
      ctx.drawImage(nozzleSprite(g), bx + 1, dy0 + 22);
      // slangen hänger ner i hålet
      ctx.fillStyle = '#101014'; ctx.fillRect(bx + 7, dy0 + 26, 1, 8); ctx.fillRect(bx + 6, dy0 + 25, 1, 1);
      ctx.fillStyle = '#34363e'; ctx.fillRect(bx + 7, dy0 + 28, 1, 1); ctx.fillRect(bx + 7, dy0 + 31, 1, 1);
    });
    // laddstolpen
    const hx = cx + CHG_X, hy = CHG_Y;
    ctx.drawImage(chgSpr(), hx, hy);
    const car = I.car && I.car.plug === I.i ? I.car : null;
    if (car) {
      const f = car.charge;
      ctx.fillStyle = '#17151a'; ctx.fillRect(hx + 3, hy + 6, 4, 4);
      ctx.fillStyle = f >= 1 ? '#8ee03c' : '#45b964'; ctx.fillRect(hx + 3, hy + 10 - Math.round(4 * f), 4, Math.round(4 * f));
      const on = f < 1 ? Math.floor(t * 6) % 9 : 9;
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i <= on ? '#6aff9a' : '#2a4a3e'; ctx.fillRect(hx + 8, hy + 28 - i, 1, 1); }
    } else bolt(ctx, hx + 4, hy + 5, Math.sin(t * 2) > 0 ? '#6aff9a' : '#3ab86a');
    if (I.cable === true) {
      ctx.drawImage(plugSprite(), hx + 2, hy + 18);
      // kabeln i en ögla på kroken
      rope(ctx, hx + 4, hy + 23, hx + 9, hy + 21, 7, true);
      ctx.fillStyle = '#8a929c'; ctx.fillRect(hx + 9, hy + 20, 2, 1);
    }
    // hinken med rakan
    ctx.drawImage(bucketSprite(), cx + BUCKET_X, BUCKET_Y);
    if (I.raka === true) {
      ctx.fillStyle = '#1c2a5a'; ctx.fillRect(cx + BUCKET_X + 5, BUCKET_Y - 8, 1, 9);
      ctx.fillStyle = '#6aa8f0'; ctx.fillRect(cx + BUCKET_X + 4, BUCKET_Y - 8, 1, 9);
      ctx.fillStyle = '#2a2430'; ctx.fillRect(cx + BUCKET_X + 4, BUCKET_Y - 10, 2, 2);
    }
  }
  function drawCar(ctx, c) {
    const s = c.s, x0 = Math.round(c.x - s.L / 2), g = Math.round(c.y) - 1, sp = c.spr;
    ctx.fillStyle = 'rgba(16,14,20,0.45)'; ctx.fillRect(x0 + 2, g - 2, s.L - 4, 3);
    ctx.fillStyle = 'rgba(16,14,20,0.24)'; ctx.fillRect(x0 - 1, g + 1, s.L + 2, 1); ctx.fillRect(x0 + 3, g + 2, s.L - 6, 1);
    // rutan blir ren bakom rakan – min egen tvätt, eller en kollegas
    const wp = busy && busy.kind === 'wash' && busy.car === c ? busy.t / busy.dur : c.tv != null ? c.tvT / 1.3 : -1;
    if (c.dirty && wp >= 0) {
      ctx.drawImage(sp.dirty, x0 - 2, g - sp.gy);
      const w = Math.max(1, Math.round(sp.W * Math.min(1, wp)));
      ctx.drawImage(sp.clean, 0, 0, w, sp.H, x0 - 2, g - sp.gy, w, sp.H);
    } else ctx.drawImage(c.dirty ? sp.dirty : sp.clean, x0 - 2, g - sp.gy);
    const ph = Math.floor(c.roll / 3) % 2;
    for (const wx of [s.wf, s.wr]) ctx.drawImage(wheelSprite(s.r, ph), x0 + wx - s.r - 1, g - 2 * s.r - 1);
  }
  function drawCarBubble(ctx, c) {
    const s = c.s, x0 = Math.round(c.x - s.L / 2), bx = x0 + s.drv, tip = PARK_Y + 2;
    if (c.state === 'pay') {
      const [ix, iy] = bubble(ctx, bx, tip, 16, 10, false, true);
      ctx.drawImage(itemSprite('kort'), ix + 2, iy + 1);
      return;
    }
    if (c.state !== 'wait') return;
    const left = Math.max(0, Math.min(1, c.patience / c.pmax));
    const fueling = (busy && busy.kind === 'fuel' && busy.car === c) || c.tk != null;
    if (fueling || (!c.fuelDone && c.fill > c.fill0 + 0.005)) {
      const inZone = c.fill >= ZONE && c.fill <= 1;
      const [ix, iy] = bubble(ctx, bx, tip, 38, 18, inZone, true);
      const lab = c.fill > 1 ? $t('SPILL!') : inZone ? $t('SLÄPP!') : fueling ? $t('TANKAR') : $t('MER!');
      const col = c.fill > 1 ? '#d8202a' : inZone ? '#2e8a3e' : '#5a5460';
      if (!inZone || (t * 6 | 0) % 2 === 0) ctxText(ctx, SMALL, lab, ix + 19 - (textW(SMALL, lab) >> 1), iy + 2, col);
      gauge(ctx, ix + 3, iy + 9, 32, c.fill);
      return;
    }
    if (c.plug != null) {
      if (c.charge < 1) {
        const [ix, iy] = bubble(ctx, bx, tip, 34, 11, false, true);
        battery(ctx, ix + 2, iy + 2, c.charge);
        ctxText(ctx, SMALL, Math.floor(c.charge * 100) + '%', ix + 19, iy + 3, '#2a2430');
        return;
      }
      const hot = (t * 3 | 0) % 2 === 0;
      const [ix, iy] = bubble(ctx, bx, tip, 26, 14, hot, true);
      ctx.fillStyle = '#2e8a3e'; ctx.fillRect(ix + 2, iy + 1, 22, 9);
      ctx.fillStyle = '#46b85a'; ctx.fillRect(ix + 2, iy + 1, 22, 1);
      ctxText(ctx, SMALL, $t('KLAR!'), ix + 3, iy + 3, '#ffffff');
      patienceBar(ctx, ix + 2, iy + 11, 22, left);
      return;
    }
    const needFuel = !c.fuelDone, needWash = c.need.wash && !c.washDone;
    if (!needFuel && !needWash) return;
    const cw = (needFuel ? pillW(c.need.fuel) : 0) + (needWash ? 8 + (needFuel ? 2 : 0) : 0);
    const iw = Math.max(18, cw + 4);
    const hot = !!carry && ((carry.k === 'noz' && needFuel && carry.fuel === c.need.fuel) || (carry.k === 'kabel' && needFuel && c.need.fuel === 'EL') || (carry.k === 'raka' && needWash));
    const [ix, iy] = bubble(ctx, bx, tip + (hot && (t * 4 | 0) % 2 ? 1 : 0), iw, 14, hot, true);
    let x = ix + ((iw - cw) >> 1);
    if (needFuel) x += pill(ctx, x, iy + 1, c.need.fuel) + 2;
    if (needWash) ctx.drawImage(rakaIcon(), x, iy + 1);
    patienceBar(ctx, ix + 2, iy + 11, iw - 4, left);
    if (c.patience < 8) impatient(ctx, ix + iw + 1, iy - 3, t);
  }
  function drawCarried(ctx, x, y, dir, k) {
    const ox = dir === 'left' ? -7 : dir === 'right' ? 7 : 0;
    const s = itemSprite(k);
    ctx.drawImage(s, Math.round(x) + ox - (s.width >> 1), Math.round(y) - 12 - (s.height - 1));
  }
  function drawMine(ctx) {
    if (!carry) return;
    if (carry.k === 'noz' || carry.k === 'kabel') return;                 // ritas med slangen
    if (carry.k === 'raka' && busy && busy.kind === 'wash') return;       // rakan ritas på rutan
    drawCarried(ctx, walker.px, walker.py, walker.dir, carry.k);
  }
  // en slang/kabel från pumpen/stolpen till händerna i (hx, hy), med munstycket/kontakten i handen
  function hoseTo(ctx, c, hx, hy) {
    const [ox, oy] = hoseOrigin(c);
    const sag = Math.max(4, 22 - Math.abs(hx - ox) * 0.2);
    rope(ctx, ox, oy, hx, hy + 1, sag, c.k === 'kabel');
    if (c.k === 'noz') ctx.drawImage(nozzleSprite(c.fuel, true), hx - 3, hy - 2);
    else ctx.drawImage(plugSprite(), hx - 3, hy - 2);
  }
  // slangar och kablar: från pumpen till handen (min och kollegornas), och kablar som sitter i elbilar
  function drawHoses(ctx) {
    if (carry && (carry.k === 'noz' || carry.k === 'kabel')) { const [hx, hy] = hands(); hoseTo(ctx, carry, hx, hy); }
    if (coop.active) for (const f of coop.peers()) {
      const hx = Math.round(f.x), hy = Math.round(f.y) - 15;
      for (const I of islands) {
        for (let j = 0; j < GRADES.length; j++) if (I.noz[j] === f.id) hoseTo(ctx, { k: 'noz', isl: I.i, j, fuel: GRADES[j] }, hx, hy);
        if (I.cable === f.id) hoseTo(ctx, { k: 'kabel', isl: I.i }, hx, hy);
        if (I.raka === f.id && !cars.some((c) => c.tv === f.id)) drawCarried(ctx, f.x, f.y, 'down', 'raka');
      }
    }
    for (const c of cars) {
      if (c.plug == null) continue;
      const I = islands[c.plug], px = Math.round(c.x - c.s.L / 2 + c.s.port + 1), py = carTopY(c, px) + 1;
      rope(ctx, I.cx + CHG_X + 5, CHG_Y + 22, px + 1, py, 14, true);
      ctx.drawImage(plugSprite(), px - 1, py - 3);
    }
  }
  function drawWash(ctx) {
    if (busy && busy.kind === 'wash') washAnim(ctx, busy.car, busy.t / busy.dur, busy.t, Math.round(walker.px), Math.round(walker.py) - 15);
    // en kollega tvättar: rakan går över rutan här också
    if (coop.active) for (const c of cars) {
      if (c.tv == null || c.tv === meId() || c.state !== 'wait' || (busy && busy.car === c)) continue;
      const f = coop.peers().find((q) => q.id === c.tv);
      washAnim(ctx, c, Math.min(1, c.tvT / 1.3), c.tvT, f ? Math.round(f.x) : null, f ? Math.round(f.y) - 15 : null);
    }
  }
  // rakan på rutan vid p (0–1); tt = tvättens tid (svischet och löddret), hx/hy = händerna (null: bara bladet)
  function washAnim(ctx, c, p, tt, hx, hy) {
    const x0 = Math.round(c.x - c.s.L / 2);
    const bx = x0 + 3 + Math.round(p * (c.s.L - 14)) + Math.round(Math.sin(tt * 18) * 3);
    const by = Math.round(c.y) - 1 - c.s.hood - 5;
    // skaftet upp till händerna
    if (hx != null) {
      const n = Math.max(1, Math.abs(by - hy), Math.abs(bx + 5 - hx));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(hx + (bx + 5 - hx) * i / n), y = Math.round(hy + (by - 2 - hy) * i / n);
        ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillStyle = i % 3 ? '#2f6fd0' : '#6aa8f0'; ctx.fillRect(x, y, 1, 1);
      }
    }
    // bladet: svamp, metall och gummilist – med lödder runt
    ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 3, 13, 5);
    ctx.fillStyle = '#7ec8a0'; ctx.fillRect(bx, by - 2, 11, 1);
    ctx.fillStyle = '#c4ccd4'; ctx.fillRect(bx, by - 1, 11, 1);
    ctx.fillStyle = '#2a2430'; ctx.fillRect(bx, by, 11, 1);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) ctx.fillRect(bx - 3 + ((i * 5 + Math.floor(tt * 20)) % 17), by + 1 + (i & 1), 1, 1);
    if (Math.random() < 0.6) drops.push({ x: bx + (Math.random() * 11 | 0), y: by + 1, vy: 10, a: 0 });
  }

  // ---------- debug-API för proven ----------
  const dbg = {
    stats,
    // en bil som redan står vid en ledig pump; fuel: '95'|'98'|'D'|'EL'. Returnerar öns index.
    // Är alla öar upptagna (eller den begärda) flyttas bilen som står där bort först.
    forceCar(fuel, wash = false, isl) {
      const I = (isl != null ? islands[isl] : islands.find((k) => !k.car)) || islands[0];
      if (!I) return null;
      if (I.car) {
        const old = I.car;
        if (busy && busy.car === old) busy = null;
        if (carry && carry.isl === I.i) returnCarry();
        if (old.plug != null) { islands[old.plug].cable = true; old.plug = null; }
        cars = cars.filter((o) => o !== old);
        I.car = null;
      }
      const c = makeCar(I, { fuel: fuel ?? '95', wash });
      c.x = I.cx; c.y = PARK_Y; c.state = 'wait'; c.path = [];
      cars.push(c);
      refreshObstacles();
      snapAsap();
      return I.i;
    },
    // en bil som kör in från vägen till ö isl (provet: rullar den hos medarbetaren också?)
    driveIn(fuel = '95', isl = 0) {
      const I = islands[isl];
      if (!I || I.car) return null;
      const c = makeCar(I, { fuel, wash: false });
      c.path = routeIn(I.cx);
      cars.push(c);
      snapAsap();
      return c.id;
    },
    // tanka/ladda bilen vid ö i (eller första väntande): right=true → rätt munstycke
    // och stopp i gröna zonen (+1 rätt); false → fel munstycke (+1 fel).
    fuel(i, right = true) {
      const c = (i != null && islands[i] ? islands[i].car : null) || cars.find((k) => k.state === 'wait' && !k.fuelDone);
      if (!c || c.state !== 'wait') return null;
      busy = null; returnCarry();
      const I = islands[c.isl], x0 = c.x - c.s.L / 2;
      walker.stop();
      if (c.need.fuel === 'EL' && right) {
        I.cable = meId(); carry = { k: 'kabel', isl: c.isl };
        walker.px = x0 + c.s.port + 2; walker.py = CAR_Y;
        plugAt(c); c.charge = 1; unplug(c);
      } else {
        const g = right ? c.need.fuel : c.need.fuel === '95' ? '98' : '95', j = GRADES.indexOf(g);
        I.noz[j] = meId(); carry = { k: 'noz', isl: c.isl, j, fuel: g };
        walker.px = x0 + c.s.fuel; walker.py = CAR_Y;
        nozzleAt(c);
        if (busy && busy.kind === 'fuel') { c.fill = 0.95; stopFuel(); }
      }
      return { ...stats };
    },
    // tvätta rutan på bilen vid ö i (måste vilja ha tvätt)
    wash(i) {
      const c = (i != null && islands[i] ? islands[i].car : null) || cars.find((k) => k.state === 'wait' && k.need.wash && !k.washDone);
      if (!c) return null;
      busy = null; returnCarry();
      islands[c.isl].raka = meId(); carry = { k: 'raka', isl: c.isl };
      walker.stop(); walker.px = c.x - c.s.L / 2 + c.s.ws; walker.py = CAR_Y;
      washAt(c);
      if (busy && busy.kind === 'wash') finishWash(c);
      return { ...stats };
    },
    // en kioskkund som redan står vid disken; returnerar önskan ('korv'|'kaffe'|'tidning')
    // (är alla platser tagna går kunden på plats 0 hem först)
    forceCustomer(wish) {
      if (freeSpot() < 0) custs = custs.filter((k) => !(k.spot === 0 && k.state !== 'out'));
      const k = addCust(wish, true);
      snapAsap();
      return k ? k.wish : null;
    },
    pickItem(id = 'korv') { busy = null; returnCarry(); carry = { k: id }; return id; },
    // räck över det jag bär (eller rätt/fel vara om jag inte bär något) till en väntande kund
    serve(right = true) {
      const waiting = custs.filter((k) => k.state === 'wait');
      if (!waiting.length) return null;
      let k;
      if (carry && ITEMS.includes(carry.k)) k = waiting.find((c) => (right ? c.wish === carry.k : c.wish !== carry.k)) || waiting[0];
      else { k = waiting[0]; busy = null; returnCarry(); carry = { k: right ? k.wish : ITEMS[(ITEMS.indexOf(k.wish) + 1) % 3] }; }
      walker.stop(); walker.px = k.x; walker.py = SERVE_Y;
      give(k);
      return { ...stats };
    },
    carrying: () => (carry ? (carry.k === 'noz' ? carry.fuel : carry.k) : null),
    cars: () => cars.map((c) => ({ id: c.id, isl: c.isl, kind: c.kind, state: c.state, fuel: c.need.fuel, wash: c.need.wash, fill: c.fill, charge: c.charge,
      fuelDone: c.fuelDone, washDone: c.washDone, plug: c.plug, tk: c.tk, tv: c.tv, x: Math.round(c.x), y: Math.round(c.y) })),
    customers: () => custs.map((k) => ({ id: k.id, spot: k.spot, state: k.state, wish: k.wish, got: k.got, x: Math.round(k.x) })),
    stage(fn) { fn({ cars, custs, islands, walker, puddles, setCarry: (c) => (carry = c), setBusy: (b) => (busy = b), setT: (v) => (t = v), makeCar, refreshObstacles, finishWash, stopFuel, setDrawer: (v) => (drawer = v) }); },
    // ---------- jobba tillsammans (tools/coop-bensin-test.mjs) ----------
    coop: () => ({ leader: coop.leader, active: coop.active, mates: coop.peers().length, settled: coop.settled, myId: coop.myId }),
    lag: () => ({ ...team, maxN }),
    title: () => (maxN > 1 ? 'BENSINMACKEN IHOP' : 'BENSINMACKEN'),
    // lugnt på macken (skiftledaren/solo): inga nya bilar eller kunder, gården och disken töms
    calm() { carIn = 1e9; custIn = 1e9; busy = null; cars = []; custs = []; for (const I of islands) I.car = null; refreshObstacles(); snapAsap(); },
    // pumpöarna: vem håller i munstyckena (95, 98, diesel), kabeln och rakan (1 = på plats, 0 = i bilen, annars id)
    islands: () => islands.map((I) => ({ noz: I.noz.map(hEnc), cable: hEnc(I.cable), raka: hEnc(I.raka), car: I.car ? I.car.id : null })),
    // som när man kommit fram: ta en del från ö isl ('noz' fack j / 'kabel' / 'raka') / gör det man
    // gör vid bilen id med det man håller i / räck över det man bär till kunden id (hos en
    // medarbetare blir det önskemål till skiftledaren)
    take(isl, part = 'noz', j = 0) {
      const I = islands[isl];
      if (!I || !PART.has(part)) return false;
      walker.stop(); walker.px = partX(I, part, j | 0); walker.py = LANE_Y;
      takeFrom({ I, part, j: j | 0 });
      return true;
    },
    carAct(id) {
      const c = carById(id);
      if (!c) return false;
      const [x, y, cb] = carSpot(c);
      walker.stop(); walker.px = x; walker.py = y;
      cb?.();
      return true;
    },
    custAct(id) {
      const k = custs.find((q) => q.id === id);
      if (!k) return false;
      walker.stop(); walker.px = k.x; walker.py = SERVE_Y;
      give(k);
      return true;
    },
    // släpp tankhandtaget vid mätarläget f (0,95 = i gröna zonen)
    release(f = 0.95) { if (!busy || busy.kind !== 'fuel') return false; busy.car.fill = f; stopFuel(); return true; },
    busy: () => (busy ? busy.kind : null),
    // provet: medarbetaren skickar SAMMA önskemål två gånger (som om svaret dröjde) – räknas EN gång
    twice(a, id) {
      if (!mate() || pend) return false;
      const m = { t: 'do', a, id, c: carryEnc(carry) };
      coop.send(m); ask(m);
      return true;
    },
    teleport(x, y) { walker.px = x; walker.py = y; walker.stop(); },
    drop() { busy = null; returnCarry(); },
    // sant när mackbiträdet står still, inte håller på med något och inte väntar på skiftledarens svar
    idle: () => !pend && !queued && !busy && walker.path.length === 0,
    pending: () => !!pend,
    time: () => t,
    pops: () => popLog.slice(),
  };

  const self = {
    _debug: dbg,
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    exit() { coop.dispose(); },
    update(dt) {
      pops.update(dt);
      if (done) {
        coop.tick(); coop.resign();   // MITT pass är slut – lämna över ledningen direkt (även på lönebeskedet)
        doneT += dt;
        if (doneT > 1.2 && !reported) {
          reported = true;
          if (maxN > 1) {   // jobbat ihop: laget delar lika på rätt, fel och missade
            const sh = (v) => Math.round(v / maxN);
            onDone({ ok: sh(team.ok), fel: sh(team.fel), miss: sh(team.miss), delat: maxN, lagOk: team.ok, lagFel: team.fel, bilar: stats.bilar, kiosk: stats.kiosk, spill: stats.spill });
          } else onDone(stats);
        }
        return;
      }
      t += dt;
      if (t >= P.seconds) { done = true; busy = null; pend = null; queued = null; letGo(); return; }
      // det jag håller på med just nu låser mig på platsen
      if (busy) {
        busy.t += dt;
        if (busy.kind === 'fuel') {
          const c = busy.car;
          c.fill += FILL_RATE * dt;
          oilDrip(c);
          if (c.fill >= 1.12) stopFuel(true);
        } else if (busy.kind === 'wash') { if (busy.t >= busy.dur) finishWash(busy.car); }
        else if (busy.kind === 'prep' && busy.t >= busy.dur) finishPrep(busy.item);
      } else walker.update(dt);
      // slangen räcker inte längre än så här
      if (carry && (carry.k === 'noz' || carry.k === 'kabel') && !hoseOk(walker.px, walker.py)) { returnCarry(); play('slide'); }
      if (pend) { pend.t -= dt; if (pend.t <= 0) answered(); }   // inget svar (ledaren gick?) – då får man försöka igen
      coop.tick();
      if (coop.active) maxN = Math.max(maxN, coop.peers().length + 1);
      if (coop.active !== wasCoop) {   // en kollega kom in: bilarna och kunderna kommer tätare
        wasCoop = coop.active;
        if (wasCoop) { play('knock'); pop(FW >> 1, 120, $t('NI JOBBAR IHOP!'), C_OK); }
      }
      // Skiftledaren (eller solo) kör gården och kiosken; medarbetare följer ledarens läge
      const iLead = !coop.active || (coop.leader && coop.settled);
      if (iLead && !wasLead) takeOver();
      else if (!iLead && wasLead) becomeMate();
      wasLead = iLead;
      if (iLead) leadTick(dt); else mateTick(dt);
      // småsaker: avgaser, droppar, pölar, kassalådan, korvgrillen, tidningsstället
      for (const p of puffs) { p.a += dt; p.x += p.vx * dt; p.y -= 6 * dt; }
      puffs = puffs.filter((p) => p.a < 0.9);
      for (const d of drops) { d.a += dt; d.vy += 90 * dt; d.y += d.vy * dt; }
      drops = drops.filter((d) => d.a < (d.oil ? 0.25 : 0.35));
      for (const p of puddles) p.age += dt;
      drawer = Math.max(0, drawer - dt);
      if (grillT > 0) { grillT -= dt; if (grillT <= 0) grillN = 4; }
      if (rackT > 0) { rackT -= dt; if (rackT <= 0) rackGone = -1; }
    },
    down(x, y) {
      if (done) return;
      if (busy) { if (busy.kind === 'fuel') stopFuel(); return; }
      if (pend) { queued = [x, y]; return; }   // väntar på skiftledarens svar – klicket tas strax
      // kioskens stationer
      if (x < KX1 - 1 && y >= 36 && y <= 87) {
        const st = STATIONS.find((s) => x >= s.x0 && x <= s.x1);
        if (st) { goStation(st); return; }
      }
      const k = custAt(x, y);
      if (k) { walkTo(k.x, SERVE_Y, () => give(k)); return; }
      const hit = islandHit(x, y);
      if (hit) { goIsland(hit); return; }
      const c = cars.find((o) => o.state === 'wait' && ((x >= o.x - o.s.L / 2 - 2 && x <= o.x + o.s.L / 2 + 2 && y >= PARK_Y - 34 && y <= PARK_Y + 2)
        || (y > PARK_Y + 2 && y < PARK_Y + 26 && Math.abs(x - (o.x - o.s.L / 2 + o.s.drv)) < 18)));
      if (c) { goCar(c); return; }
      walkTo(x, y);
    },
    key(kk) {
      if (kk === 'Escape' && !done) abortShift(A);
      else if ((kk === ' ' || kk === 'Enter') && busy && busy.kind === 'fuel') stopFuel();
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      drawKioskLive(ctx, t, { grillN, rackGone, brewing: busy && busy.kind === 'prep' && busy.item === 'kaffe' ? busy.t / busy.dur : -1 });
      for (const I of islands) drawIsland(ctx, I);
      const drawables = [...folkDrawables(A, t)];
      const holding = !!carry || (busy && busy.kind !== 'prep');
      drawables.push(selfDrawable(A, walker, t, { carry: holding }));
      drawables.push({ fy: walker.py + (walker.dir === 'up' ? -0.01 : 0.01), draw: () => drawMine(ctx) });
      drawables.push({ fy: DISK.base, draw: () => { ctx.drawImage(counterSpr(), CT_X, CT_Y); if (drawer > 0) drawDrawer(ctx, drawer); } });
      drawables.push({ fy: 184, draw: () => drawLopsedel(ctx) });
      drawables.push({ fy: 188, draw: () => drawAirWater(ctx, t) });
      drawables.push({ fy: 189, draw: () => drawGasol(ctx) });
      for (const c of cars) drawables.push({ fy: c.y, draw: () => drawCar(ctx, c) });
      // pölar av spillt bränsle: på marken nedanför bilen, men under den som går över dem
      for (const p of puddles) drawables.push({ fy: p.y + 3, draw: () => drawPuddle(ctx, p) });
      for (const k of custs) drawables.push({
        fy: k.y,
        draw: () => {
          const moving = k.state !== 'wait';
          const frame = moving ? (k.got ? [7, 9, 8, 9] : WALK_SEQ)[Math.floor(t * 8.5 + k.id * 0.37) % 4] : (Math.sin(t * 2 + k.id) > 0.9 ? 4 : 0);
          drawPerson(ctx, k.x, k.y, k.look, k.dir, frame);
          if (k.got) drawCarried(ctx, k.x, k.y, k.dir, k.got);
        },
      });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawHoses(ctx);
      drawWash(ctx);
      // avgaser och droppar
      for (const p of puffs) { const a = 0.45 * (1 - p.a / 0.9); ctx.fillStyle = `rgba(200,200,206,${a.toFixed(2)})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.a > 0.4 ? 2 : 1, p.a > 0.4 ? 2 : 1); }
      for (const d of drops) { ctx.fillStyle = d.oil ? '#c8a040' : '#9ad8ff'; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
      // pratbubblor
      for (const k of custs) {
        if (k.state !== 'wait') continue;
        const hot = !!carry && carry.k === k.wish;
        const tip = Math.round(k.y) - 36 - (hot && (t * 4 | 0) % 2 ? 1 : 0);
        const [ix, iy] = bubble(ctx, Math.round(k.x), tip, 18, 19, hot);
        const s = itemSprite(k.wish);
        ctx.drawImage(s, ix + ((18 - s.width) >> 1), iy + ((16 - s.height) >> 1));
        patienceBar(ctx, ix + 2, iy + 16, 14, Math.max(0, k.patience / k.pmax));
        if (k.patience < 8) impatient(ctx, ix + 17, iy - 4, t);
      }
      for (const c of cars) drawCarBubble(ctx, c);
      // förberedelse (korv i bröd, kaffe i koppen …)
      if (busy && busy.kind === 'prep') {
        const p = Math.min(1, busy.t / busy.dur);
        const [ix, iy] = bubble(ctx, Math.round(walker.px), Math.round(walker.py) - 37, 18, 17);
        const s = itemSprite(busy.item);
        ctx.drawImage(s, ix + ((18 - s.width) >> 1), iy + ((13 - s.height) >> 1));
        ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 14, 14, 2);
        ctx.fillStyle = '#3a8ad8'; ctx.fillRect(ix + 2, iy + 14, Math.max(1, Math.round(14 * p)), 2);
      }
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: P.seconds, ok: maxN > 1 ? team.ok : stats.ok, fel: maxN > 1 ? team.fel : stats.fel, title: maxN > 1 ? $t('BENSINMACKEN IHOP') : $t('BENSINMACKEN') });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };
  return self;
}

// ---------- levande detaljer ----------
function drawKioskLive(ctx, t, { grillN, rackGone, brewing }) {
  // korvgrillen: korvarna rullar (glansen vandrar) och värmen dallrar
  for (let i = 0; i < grillN; i++) {
    const sx = 23 + (i % 2) * 11, sy = 51 + ((i / 2) | 0) * 3;
    for (let k = 0; k < 9; k++) {
      const edge = k === 0 || k === 8;
      ctx.fillStyle = ((k + Math.floor(t * 5) + i) % 4 === 0) ? '#f4a07a' : edge ? '#a8402a' : '#d8603c';
      ctx.fillRect(sx + k, sy, 1, 1);
      ctx.fillStyle = edge ? '#6a2014' : (k + i) % 3 === 0 ? '#7a2a18' : '#a8402a';
      ctx.fillRect(sx + k, sy + 1, 1, 1);
    }
  }
  // skyddsglaset över grillen
  ctx.fillStyle = 'rgba(210,236,255,0.22)'; ctx.fillRect(21, 45, 25, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(22, 45, 23, 1); ctx.fillRect(24 + (Math.floor(t * 0.5) % 2), 47, 3, 1);
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.8 + i * 0.23) % 1, x = 24 + i * 4 + Math.round(Math.sin(t * 3 + i) * 1), y = 44 - Math.round(ph * 7);
    ctx.fillStyle = `rgba(255,236,210,${(0.35 * (1 - ph)).toFixed(2)})`; ctx.fillRect(x, y, 1, 1);
  }
  // kaffemaskinen: kopp + stråle när det bryggs, lite ånga annars också
  if (brewing >= 0) {
    ctx.fillStyle = '#fdfcf8'; ctx.fillRect(62, 58, 5, 4); ctx.fillStyle = '#d8d2c6'; ctx.fillRect(66, 58, 1, 4); ctx.fillRect(63, 62, 3, 1);
    ctx.fillStyle = '#c8894a'; ctx.fillRect(62, 59, 5, 2);
    ctx.fillStyle = (Math.floor(t * 12) % 2) ? '#6a3a1a' : '#8a4a22'; ctx.fillRect(64, 55, 1, 3);
    ctx.fillStyle = '#3a2010'; ctx.fillRect(63, 58, 3, 1);
  }
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i * 0.33) % 1, x = 63 + i + Math.round(Math.sin(t * 2.6 + i * 2) * 1), y = (brewing >= 0 ? 56 : 45) - Math.round(ph * 8);
    ctx.fillStyle = `rgba(255,255,255,${(0.45 * (1 - ph)).toFixed(2)})`; ctx.fillRect(x, y, 1, 1);
  }
  // tidningen man just tog saknas en stund
  if (rackGone >= 0) {
    const tier = (rackGone / 3) | 0, pos = rackGone % 3;
    const x = 89 + pos * 9, y = 47 + tier * 9;
    ctx.fillStyle = '#3a3440'; ctx.fillRect(x, y, 8, 7);
    ctx.fillStyle = '#4a4450'; ctx.fillRect(x, y + 6, 8, 1);
  }
  // neonskylten blinkar till ibland
  if ((t % 6.3) < 0.14 || ((t + 0.3) % 6.3) < 0.07) ctxText(ctx, SMALL, $t('ÖPPET'), 93, 29, '#5a1a22');
}
function drawDrawer(ctx, d) {
  const o = d > 0.15 ? 2 : 1;
  ctx.fillStyle = '#17151a'; ctx.fillRect(80, 104, 15, 1);
  ctx.fillStyle = '#3a8a4a'; ctx.fillRect(81, 104, 4, 1); ctx.fillStyle = '#f0c040'; ctx.fillRect(86, 104, 2, 1); ctx.fillRect(89, 104, 1, 1); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(91, 104, 2, 1);
  ctx.fillStyle = '#cfc4ae'; ctx.fillRect(80, 104 + o, 15, 3);
  ctx.fillStyle = '#6a6050'; ctx.fillRect(84, 105 + o, 7, 1);
  ctx.fillStyle = '#2a2420'; ctx.fillRect(79, 107 + o, 17, 1);
}
// spillt bränsle: mörk pöl med regnbågsskimmer som bleknar till en fläck
function drawPuddle(ctx, p) {
  const k = Math.min(1, p.age / 0.6), r = Math.max(2, Math.round(p.r * k)), fade = Math.max(0.5, 1 - p.age / 30);
  for (let y = -3; y <= 3; y++) {
    const w = Math.round(r * Math.sqrt(1 - (y / 3.6) ** 2)) + ((y * 7 + p.x) % 3 === 0 ? 1 : 0);
    ctx.fillStyle = `rgba(34,26,20,${(0.62 * fade).toFixed(2)})`; ctx.fillRect(p.x - w, p.y + y, w * 2 + 1, 1);
    if (Math.abs(y) === 3) continue;
    ctx.fillStyle = `rgba(20,14,10,${(0.35 * fade).toFixed(2)})`; ctx.fillRect(p.x - (w >> 1), p.y + y, w + 1, 1);
  }
  const sheen = ['#c88ae8', '#6ad8c8', '#f0e070', '#8ab8ff'];
  ctx.globalAlpha = 0.7 * fade;
  for (let i = 0; i < 4; i++) { ctx.fillStyle = sheen[i]; ctx.fillRect(p.x - (r >> 1) + i * 2, p.y - 1 + (i % 2), 2, 1); }
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.5 * fade; ctx.fillRect(p.x - (r >> 1) - 1, p.y - 2, 2, 1);
  ctx.globalAlpha = 1;
}
// löpsedeln utanför disken
function drawLopsedel(ctx) {
  const x = 93, y = 156;
  ctx.fillStyle = '#17151a';
  ctx.fillRect(x - 1, y - 1, 25, 25);
  for (let i = 0; i < 5; i++) { ctx.fillRect(x - 1 - (i >> 1), y + 23 + i, 1, 1); ctx.fillRect(x + 23 + (i >> 1), y + 23 + i, 1, 1); }
  ctx.fillStyle = '#ffe24a'; ctx.fillRect(x, y, 23, 23);
  ctx.fillStyle = '#fff6a8'; ctx.fillRect(x, y, 23, 1);
  ctx.fillStyle = '#e0b820'; ctx.fillRect(x, y + 22, 23, 1);
  ctxText(ctx, SMALL, $t('EXTRA!'), x + 1, y + 2, '#d8202a');
  ctxText(ctx, SMALL, $t('KORV+'), x + 2, y + 9, '#17151a');
  ctxText(ctx, SMALL, $t('KAFFE'), x + 2, y + 16, '#17151a');
}
// luft- och vattenstationen
function drawAirWater(ctx, t) {
  const x = 124, y = 150;
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, w, h); };
  R(x + 2, y + 13, 2, 22, '#5a5e66'); R(x + 23, y + 13, 2, 22, '#5a5e66'); R(x + 2, y + 13, 1, 22, '#9aa2ac');
  R(x - 1, y - 1, 29, 15, '#17151a'); R(x, y, 27, 13, '#f4f4f0'); R(x, y, 27, 1, '#ffffff'); R(x, y + 12, 27, 1, '#c8ccd0');
  ctxText(ctx, SMALL, $t('LUFT'), x + 6, y + 1, '#d8352e');
  ctxText(ctx, SMALL, $t('VATTEN'), x + 2, y + 7, '#2f6fd0');
  // luften: röd låda med mätare och slang
  R(x + 2, y + 16, 11, 15, '#17151a'); R(x + 3, y + 17, 9, 13, '#d8352e'); R(x + 3, y + 17, 9, 1, '#ff7a6a'); R(x + 11, y + 18, 1, 12, '#9a2020');
  R(x + 5, y + 19, 5, 5, '#17151a'); R(x + 6, y + 20, 3, 3, '#f4f1ea');
  const a = Math.sin(t * 0.7) * 0.6 - 0.4; ctx.fillStyle = '#d8352e'; ctx.fillRect(x + 7 + Math.round(Math.cos(a)), y + 21 + Math.round(Math.sin(a)), 1, 1);
  R(x + 4, y + 26, 7, 1, '#9a2020');
  rope(ctx, x + 12, y + 20, x + 14, y + 22, 9);
  R(x + 13, y + 22, 2, 2, '#c4ccd4');
  // vattnet: blå låda med kran och vattenkanna
  R(x + 15, y + 18, 11, 13, '#17151a'); R(x + 16, y + 19, 9, 11, '#2f6fd0'); R(x + 16, y + 19, 9, 1, '#6aa8f0'); R(x + 24, y + 20, 1, 10, '#1f4a9a');
  R(x + 19, y + 22, 4, 2, '#c4ccd4'); R(x + 20, y + 24, 1, 2, '#9aa2ac'); if ((t * 2 | 0) % 3 === 0) R(x + 20, y + 27, 1, 1, '#9ad8ff');
  R(x + 16, y + 31, 7, 5, '#17151a'); R(x + 17, y + 32, 5, 3, '#46a35a'); R(x + 17, y + 32, 5, 1, '#7ad88a'); R(x + 22, y + 31, 3, 1, '#17151a'); R(x + 24, y + 30, 1, 1, '#46a35a');
  // betongfot
  R(x - 1, y + 35, 29, 3, '#9a968e'); R(x - 1, y + 35, 29, 1, '#c8c4bc'); R(x - 1, y + 38, 29, 1, 'rgba(16,14,20,0.35)');
}
// gasolburen i hörnet
function drawGasol(ctx) {
  const x = 361, y = 158;
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, w, h); };
  R(x - 1, y + 5, 24, 25, '#17151a'); R(x, y + 6, 22, 23, '#3a3d44');
  for (let i = 0; i < 4; i++) {
    const bx = x + 1 + i * 5, c = i % 2 ? '#8a9aa8' : '#3a6bd5', hi = i % 2 ? '#c8d4e0' : '#7aa8f0', dk = i % 2 ? '#5a6a78' : '#1f4a9a';
    R(bx + 1, y + 10, 3, 1, '#17151a'); R(bx + 2, y + 9, 1, 1, '#c4ccd4');
    R(bx, y + 11, 5, 17, dk); R(bx + 1, y + 11, 3, 17, c); R(bx + 1, y + 12, 1, 15, hi);
    R(bx, y + 18, 5, 1, dk);
  }
  // nätet framför
  ctx.fillStyle = 'rgba(20,20,26,0.55)';
  for (let yy = y + 6; yy < y + 29; yy += 3) ctx.fillRect(x, yy, 22, 1);
  for (let xx = x; xx < x + 22; xx += 3) ctx.fillRect(xx, y + 6, 1, 23);
  R(x - 2, y + 4, 26, 2, '#5a5e66'); R(x - 2, y + 4, 26, 1, '#8a8e96');
  R(x + 1, y - 2, 20, 7, '#17151a'); R(x + 2, y - 1, 18, 5, '#f4f4f0');
  ctxText(ctx, SMALL, $t('GASOL'), x + 2, y - 1, '#d8352e');
  R(x - 1, y + 29, 24, 2, 'rgba(16,14,20,0.35)');
}

// ---------- bakgrunden (målas en gång) ----------
function cloud(P, cx, cy, w) {
  const blobs = [[0, 0, w * 0.36], [-w * 0.32, 2, w * 0.26], [w * 0.34, 2, w * 0.28], [w * 0.1, -w * 0.18, w * 0.26]];
  for (let y = Math.floor(cy - w * 0.6); y <= cy + w * 0.4; y++) for (let x = Math.floor(cx - w); x <= cx + w; x++) {
    let inside = false;
    for (const [bx, by, r] of blobs) if (Math.hypot(x - cx - bx, (y - cy - by) * 1.3) < r) { inside = true; break; }
    if (!inside || y > cy + 4) continue;
    P.px(x, y, y >= cy + 2 ? 0xd4e6f2 : y >= cy ? 0xeef6fa : 0xffffff);
  }
}
function house(P, x, base, w, h, col) {
  const haze = (c) => mix(c, 0xb8dcec, 0.28);
  const roofH = Math.max(4, Math.round(w * 0.32)), mid = x + w / 2;
  for (let j = 0; j < roofH; j++) {
    const span = Math.round((w / 2 + 1) * (j + 1) / roofH);
    P.hl(Math.round(mid - span), base - h - roofH + j, span * 2, haze(j === roofH - 1 ? 0x2a2226 : 0x4a3a3e));
  }
  for (let y = base - h; y < base; y++) for (let xx = x; xx < x + w; xx++) {
    let c = mix(col, mul(col, 0.8), (xx - x) / w);
    if (xx === x || xx === x + w - 1) c = 0xf4f1ea;
    P.px(xx, y, haze(c));
  }
  for (const wx of [x + 3, x + w - 7]) { P.rect(wx, base - h + 3, 4, 4, haze(0xf4f1ea)); P.rect(wx + 1, base - h + 4, 2, 2, haze(0x5a7a9a)); }
}
function paintBackground() {
  const P = new Pix(FW, FH);
  // ---------- himmel, skog och hus bakom gården ----------
  for (let y = 18; y < 86; y++) for (let x = KX1; x < FW; x++) P.px(x, y, mix(0x6cb4e4, 0xd4ecf6, (y - 18) / 48 + (bayer(x, y) - 0.5) * 0.1));
  for (const [cx, cy, w] of [[204, 46, 20], [292, 43, 15], [366, 49, 17], [244, 54, 10]]) cloud(P, cx, cy, w);
  for (let x = KX1; x < FW; x++) {
    const top = 57 + Math.round(Math.sin(x * 0.23) * 1.5 + Math.sin(x * 0.071 + 1) * 2.5 + hash(x >> 2, 3, 7) * 3);
    for (let y = top; y < 80; y++) {
      const d = y - top;
      const c = d === 0 ? 0x78a878 : d < 3 ? mix(0x5a8a5c, 0x4a7a50, hash(x, y, 2)) : mix(0x3e6a48, 0x2e5238, d / 20 + (hash(x >> 1, y >> 1, 4) - 0.5) * 0.4);
      P.px(x, y, mix(c, 0xa8d0e0, 0.2));
    }
  }
  house(P, 230, 76, 24, 12, 0xa8322c); house(P, 318, 76, 16, 10, 0xe0b848); house(P, 170, 76, 14, 9, 0xe8e4dc);
  // häcken
  for (let x = KX1; x < FW; x++) {
    const top = 70 + Math.round(hash(x >> 1, 9, 3) * 1.6);
    for (let y = top; y < 82; y++) {
      const q = hash(x, y, 11);
      let c = y === top ? 0x7ab85a : mix(0x4e8a3e, 0x2e5e2a, (y - top) / 12);
      if (q > 0.85) c = mix(c, 0x9ad070, 0.5); else if (q < 0.12) c = mul(c, 0.7);
      P.px(x, y, c);
    }
  }
  for (let x = KX1; x < FW; x++) { P.px(x, 82, 0x6aa84a); P.px(x, 83, hash(x, 83) > 0.5 ? 0x5a9a3e : 0x4e8a36); P.px(x, 84, 0xdcdad2); P.px(x, 85, 0x8a8a84); }

  // ---------- kioskens bakvägg ----------
  for (let y = 18; y < 86; y++) for (let x = 0; x < KX1; x++) {
    let c;
    if (y < 21) c = mix(0x2a2026, 0x3a2c30, (y - 18) / 3);
    else if (y === 21) c = 0x5a4636;
    else if (y === 22) c = 0xfffbe8;
    else if (y === 23) c = 0xd8d0b8;
    else if (y < 50) c = mix(0xf2e4c2, 0xe6d4ac, (y - 24) / 26 + (bayer(x, y) - 0.5) * 0.12);
    else if (y < 52) c = y === 50 ? 0xa8784a : 0x7a5030;
    else { const gl = (x & 3) === 3 || ((y - 52) & 3) === 3; c = gl ? 0xc8ccc8 : mix(0xf6f8f6, 0xe4e8e4, hash(x >> 2, y >> 2, 9) * 0.7); }
    P.px(x, y, c);
  }
  for (const lx of [30, 92]) P.ell(lx, 26, 26, 7, 0xfff6d8, 0.28);
  // klockan
  for (let y = 25; y <= 35; y++) for (let x = 4; x <= 14; x++) { const d = Math.hypot(x - 9, y - 30); if (d <= 5.2) P.px(x, y, d > 4.4 ? 0x17151a : d > 3.7 ? 0x8a2a2a : 0xfaf8f0); }
  P.vl(9, 27, 3, 0x17151a); P.hl(9, 30, 3, 0x17151a); P.px(9, 30, 0xd8352e);
  for (const [x, y] of [[9, 26], [13, 30], [9, 34], [5, 30]]) P.px(x, y, 0x5a5460);
  // menyskylten (ljuslåda) under taket
  P.rect(20, 22, 67, 22, 0x2a2430);
  for (let y = 23; y < 43; y++) for (let x = 21; x < 86; x++) P.px(x, y, y < 25 ? (y === 23 ? 0xe85a4a : 0xc8302a) : mix(0xfffbf0, 0xf0e2c0, (y - 25) / 18 + (bayer(x, y) - 0.5) * 0.08));
  P.hl(21, 25, 65, 0xe8d8b0);
  for (const dx of [42, 64]) P.vl(dx, 27, 14, 0xe4d6b4);
  P.ell(53, 33, 36, 12, 0xfff8e0, 0.2);
  // neon ÖPPET
  P.ell(103, 31, 17, 6, 0xff4050, 0.28);
  P.rect(90, 26, 27, 10, 0x2a1a22); P.box(90, 26, 27, 10, 0x17151a);
  text(P, SMALL, $t('ÖPPET'), 93, 29, 0xff5a6a);
  // kylskåpet med dryck
  P.rect(2, 32, 15, 53, 0x17151a);
  P.rect(3, 33, 13, 5, 0xd8352e); P.hl(3, 33, 13, 0xff7a6a); P.hl(5, 35, 9, 0xf4f1ea);
  for (let y = 39; y < 80; y++) for (let x = 4; x < 15; x++) P.px(x, y, mix(0xeaf6fa, 0xc4dce6, (y - 39) / 41));
  const drinks = [0xd8352e, 0x46a35a, 0xf0b82a, 0x3a7bd5, 0xe07a2e, 0xf4f1ea, 0x8e5bd1];
  for (let sh = 0; sh < 4; sh++) {
    const sy = 48 + sh * 10;
    P.hl(4, sy, 11, 0x9aa4ae); P.hl(4, sy + 1, 11, 0x6a747e);
    for (let i = 0; i < 4; i++) {
      const cc = drinks[Math.floor(hash(i, sh, 31) * drinks.length)], bx = 5 + i * 2 + (i > 1 ? 1 : 0), tall = hash(i, sh, 33) > 0.5 ? 7 : 5;
      P.rect(bx, sy - tall, 2, tall, cc); P.px(bx, sy - tall + 1, mix(cc, 0xffffff, 0.5)); if (tall === 7) P.px(bx, sy - 8, 0x2a2430);
    }
  }
  P.vl(14, 50, 16, 0x9aa4ae); P.vl(15, 50, 16, 0x5a646e);
  for (let x = 4; x < 15; x++) for (let y = 40; y < 79; y++) if (((x - y) % 23 + 23) % 23 < 2) P.px(x, y, 0xffffff, 0.45);
  P.rect(3, 80, 13, 4, 0x3a3d44); for (let x = 4; x < 15; x += 2) P.vl(x, 81, 2, 0x1c1c22);
  // bänken längs väggen
  for (let y = 64; y < 86; y++) for (let x = 18; x < 87; x++) {
    let c;
    if (y === 64) c = 0xf4f8fa; else if (y === 65) c = 0xb8c0c8; else if (y === 66) c = 0x6a727c;
    else if (y >= 83) c = y === 83 ? 0x3a2e2a : 0x241a18;
    else {
      c = mix(0xe0c498, 0xc8a878, (y - 67) / 16 + (hash(x, y >> 1, 4) - 0.5) * 0.2);
      const dcol = (x - 18) % 23;
      if (dcol === 0) c = 0x7a5a3a; else if (dcol === 1) c = mix(c, 0xffffff, 0.2);
      if (y === 67) c = mul(c, 0.8);
    }
    P.px(x, y, c);
  }
  for (const hx of [27, 50, 73]) { P.hl(hx, 71, 5, 0xe8eef2); P.hl(hx, 72, 5, 0x7a848e); }
  // korvgrillen
  for (let y = 57; y < 64; y++) for (let x = 20; x < 47; x++) P.px(x, y, mix(0xd8dfe6, 0x9aa4ae, (y - 57) / 7 + (bayer(x, y) - 0.5) * 0.1));
  P.box(20, 57, 27, 7, 0x3a3d44);
  P.rect(22, 59, 3, 3, 0x2a2d33); P.px(23, 60, 0x8a929c); P.px(27, 60, 0xff5a3a); P.px(27, 59, 0xffb09a);
  for (let x = 31; x < 45; x += 2) P.vl(x, 59, 3, 0x6a727c);
  P.rect(21, 50, 25, 7, 0x2e3036);
  for (const ry of [51, 53, 55]) P.hl(22, ry + 1, 23, 0x9aa4ae);
  P.ell(33, 55, 12, 2, 0xff6a2a, 0.25);
  P.vl(21, 44, 7, 0x8a929c); P.vl(45, 44, 7, 0x8a929c); P.hl(21, 44, 25, 0xc4ccd4);
  // brödpåsen
  for (let y = 53; y < 64; y++) for (let x = 47; x < 53; x++) P.px(x, y, mix(0xd8b078, 0xb89058, (x - 47) / 6 + (hash(x, y, 8) - 0.5) * 0.2));
  P.box(46, 52, 8, 12, 0x5a3a20);
  for (const [bx, by] of [[47, 51], [50, 50]]) { P.rect(bx, by, 3, 2, 0xf2c078); P.px(bx, by, 0xffe0a8); P.px(bx + 2, by + 1, 0xc8904a); }
  // kaffemaskinen
  P.rect(55, 45, 19, 20, 0x17151a);
  for (let y = 46; y < 64; y++) for (let x = 56; x < 73; x++) P.px(x, y, mix(0x2e2e36, 0x1e1e24, (x - 56) / 17));
  P.hl(56, 46, 17, 0xc4ccd4); P.vl(56, 47, 17, 0x4a4a54);
  P.rect(58, 48, 13, 4, 0x1a3a2a); P.hl(59, 49, 5, 0x6aff9a); P.hl(59, 50, 3, 0x3ab86a); P.px(68, 49, 0x6aff9a);
  for (const [bx, cc] of [[59, 0xf4f1ea], [63, 0xa8642c], [67, 0xe0c498]]) { P.px(bx, 53, cc); P.px(bx + 1, 53, mul(cc, 0.7)); }
  P.rect(58, 55, 13, 8, 0x8a929c); P.rect(59, 55, 11, 7, 0x5a646e); P.hl(59, 55, 11, 0x3a3d44);
  P.rect(63, 55, 3, 2, 0x17151a);
  for (let x = 59; x < 70; x++) P.px(x, 62, x & 1 ? 0x2a2d33 : 0xb8c0c8);
  // muggtornet
  for (let y = 49; y < 64; y++) for (let x = 75; x < 81; x++) {
    let c = (y - 49) % 2 === 0 ? 0xffffff : 0xece8e0;
    if (x === 80) c = 0xc8c2b2; if (x === 75) c = 0xf8f6f0;
    P.px(x, y, c);
  }
  P.box(74, 48, 8, 16, 0x6a6458); P.rect(75, 46, 6, 2, 0x8a8478); P.hl(75, 46, 6, 0xb8b2a2);
  // tidningsstället
  P.rect(86, 38, 32, 7, 0x17151a); P.rect(87, 39, 30, 5, 0xa81e22); P.hl(87, 39, 30, 0xd8352e);
  text(P, SMALL, $t('PRESS'), 92, 39, 0xffd23f);
  const mast = [0xd8352e, 0x2f6fd0, 0xf0b82a, 0x17151a, 0x46a35a, 0xe07a2e];
  for (let tier = 0; tier < 4; tier++) for (let pos = 0; pos < 3; pos++) {
    const x = 89 + pos * 9, y = 47 + tier * 9, q = tier * 3 + pos;
    const m = mast[Math.floor(hash(q, 1, 41) * mast.length)], ph = [0x6a8ab0, 0xd88a6a, 0x7ab86a, 0xc8a0d8][Math.floor(hash(q, 2, 41) * 4)];
    P.rect(x, y, 8, 7, 0xf4f1ea); P.hl(x, y, 8, m); P.hl(x, y + 1, 8, mul(m, 0.8));
    P.rect(x + 1, y + 3, 3, 3, ph); P.px(x + 1, y + 3, mix(ph, 0xffffff, 0.4));
    P.hl(x + 5, y + 3, 2, 0x8a8478); P.hl(x + 5, y + 5, 2, 0x8a8478);
    P.vl(x + 7, y + 1, 6, 0xc8c2b2);
  }
  for (let tier = 0; tier < 4; tier++) { const y = 54 + tier * 9; P.hl(87, y, 30, 0x2a2d33); P.hl(87, y + 1, 30, 0x8a929c); }
  P.vl(86, 38, 47, 0x2a2d33); P.vl(117, 38, 47, 0x2a2d33); P.vl(87, 45, 38, 0x6a727c);
  P.rect(85, 83, 4, 2, 0x17151a); P.rect(115, 83, 4, 2, 0x17151a);
  // kioskens hörn mot gården
  for (let y = 18; y < 86; y++) { P.px(118, y, 0xf4f1ea); P.px(119, y, 0xc8c0b0); P.px(120, y, 0x8a8478); P.px(121, y, 0x3a3440); }
  P.rect(116, 18, 6, 4, 0x2a2026);

  // ---------- golven ----------
  for (let y = 86; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c;
    if (y >= 190) {                                                                   // vägen
      c = mix(0x46464e, 0x3c3c44, hash(x >> 1, y >> 1, 12) * 0.8);
      const q = hash(x, y, 13); if (q > 0.94) c = 0x5e5e66; else if (q < 0.05) c = 0x303036;
      if (y === 190) c = x < KX1 ? 0x6a6a70 : mix(c, 0xe8e8e0, 0.5);
      if ((y === 201 || y === 202) && (x % 22) < 12) c = mix(c, 0xf0f0e8, 0.85);
    } else if (x < KX1) {                                                             // kioskens klinkers
      if (y >= 186) c = y === 189 ? 0x6a6a70 : (x % 12 === 0 ? 0x9a9a9e : mix(0xc8c8c4, 0xb4b4b0, hash(x, y, 7)));
      else {
        const tx = x >> 3, ty = (y - 86) >> 3, gl = (x & 7) === 7 || ((y - 86) & 7) === 7;
        c = gl ? 0xb4ac9a : ((tx + ty) & 1 ? 0xe8e2d4 : 0xd4ccbc);
        c = mix(c, 0xffffff, (hash(x, y, 2) - 0.5) * 0.08);
        if (y < 90) c = mul(c, 0.84 + (y - 86) * 0.04);
      }
    } else if (y < 156) {                                                             // betongplattor under taket
      c = mix(0xc2beb6, 0xb2aea6, hash(x >> 2, y >> 2, 14) * 0.7 + (bayer(x, y) - 0.5) * 0.2);
      if ((x - KX1) % 26 === 0 || (y - 86) % 18 === 17) c = 0x9a968e;
      else if ((x - KX1) % 26 === 1 || (y - 86) % 18 === 0) c = mix(c, 0xffffff, 0.12);
      if (y < 89) c = mul(c, 0.86 + (y - 86) * 0.04);
    } else {                                                                          // asfalten
      c = mix(0x5a5a62, 0x50505a, hash(x >> 1, y >> 1, 15) * 0.8);
      const q = hash(x, y, 16); if (q > 0.93) c = 0x72727a; else if (q < 0.06) c = 0x44444c;
      if (y === 156) c = 0x8a8680; else if (y === 157) c = 0x3e3e46;
    }
    P.px(x, y, c);
  }
  // dörrmattan och tröskeln
  P.rect(0, 174, 16, 11, 0x3a4458); P.box(0, 174, 16, 11, 0x5a6a88);
  for (let y = 176; y < 184; y += 2) P.hl(2, y, 12, 0x2e3648);
  // glassboxen vid väggen: glaslock med glasspaket, vit front
  P.ell(11, 168, 13, 3, 0x1c1418, 0.3);
  P.rect(0, 147, 23, 22, 0x17151a);
  for (let y = 148; y < 154; y++) for (let x = 1; x < 22; x++) {
    const box = ((x - 1) / 4) | 0, row = y < 151 ? 0 : 1;
    const cc = [0xff88bb, 0xffd23f, 0x7fdcae, 0xf4f1ea, 0x8a5a30, 0x3a7bd5][Math.floor(hash(box, row, 51) * 6)];
    let c = (x - 1) % 4 === 3 ? mix(cc, 0x1c1820, 0.5) : y === 150 || y === 153 ? mix(cc, 0x1c1820, 0.3) : cc;
    c = mix(c, 0xd8f0ff, 0.25);
    if (((x - y) % 9 + 9) % 9 < 2) c = mix(c, 0xffffff, 0.45);
    P.px(x, y, c);
  }
  P.hl(1, 148, 21, 0xe8f4fa); P.hl(1, 154, 21, 0xb8c0c8); P.hl(1, 155, 21, 0x6a727c);
  for (let y = 156; y < 168; y++) for (let x = 1; x < 22; x++) P.px(x, y, x === 21 ? 0xb8c4d0 : mix(0xfafcfe, 0xd8e2ec, (y - 156) / 12));
  P.rect(1, 157, 21, 7, 0x2f6fd0); P.hl(1, 157, 21, 0x6aa8f0);
  text(P, SMALL, $t('GLASS'), 2, 158, 0xffffff);
  P.hl(1, 167, 21, 0x3a3d44); P.px(2, 168, 0x17151a); P.px(20, 168, 0x17151a);
  // papperskorgen vid disken
  P.rect(100, 132, 9, 13, 0x17151a); P.rect(101, 133, 7, 11, 0x46a35a); P.vl(101, 134, 10, 0x7ad88a); P.vl(107, 134, 10, 0x2e7a3a);
  P.hl(100, 132, 9, 0x2a2d33); P.rect(102, 133, 5, 2, 0x1c1c22); P.hl(101, 138, 7, 0x2e7a3a);
  P.ell(104, 145, 6, 1.5, 0x1c1418, 0.3);
  for (let y = 86; y < 186; y++) { P.px(KX1 - 1, y, 0x9aa2ac); P.px(KX1, y, 0x5a5e66); }
  // ljuset från taket på gården
  for (const cx of ISL) P.ell(cx, 122, 48, 18, 0xfff6e0, 0.16);
  // oljefläckar där bilarna står + lite här och där
  const stain = (x, y, rx, ry, a) => {
    P.ell(x, y, rx, ry, 0x2a241e, a);
    P.ell(x + 1, y, rx * 0.5, ry * 0.6, 0x1c1814, a * 0.8);
    P.px(x - 1, y - 1, 0x8a6ab0, 0.3); P.px(x + 2, y, 0x5aa0a0, 0.3);
  };
  for (const cx of ISL) { stain(cx - 6, 146, 9, 3, 0.35); stain(cx + 15, 148, 6, 2, 0.3); stain(cx - 22, 143, 4, 1.6, 0.25); }
  stain(170, 172, 7, 2, 0.28); stain(300, 180, 9, 3, 0.3); stain(226, 186, 5, 2, 0.25); stain(335, 166, 4, 1.5, 0.22);
  // däckspår på asfalten
  for (let x = 150; x < 380; x++) { if (hash(x >> 3, 1, 17) > 0.45) P.px(x, 176 + (hash(x >> 4, 2, 17) > 0.5 ? 1 : 0), 0x44444c, 0.5); if (hash(x >> 3, 3, 17) > 0.5) P.px(x, 183, 0x44444c, 0.4); }
  // markeringar: linjer mellan platserna och pilar på asfalten
  for (const lx of [...ISL.map((c) => c + 38), ISL[0] - 38]) for (let y = 106; y < 154; y++) if ((y >> 2) % 2 === 0) P.px(lx, y, 0xf0f0e8, 0.8);
  for (const ax of [214, 302]) {
    for (let i = 0; i < 12; i++) P.px(ax + i, 169, 0xf0f0e8, 0.85);
    for (let k = 1; k <= 3; k++) { P.px(ax + k, 169 - k, 0xf0f0e8, 0.85); P.px(ax + k, 169 + k, 0xf0f0e8, 0.85); }
  }
  // brunnslock
  P.rect(250, 172, 13, 5, 0x2a2a30); P.box(249, 171, 15, 7, 0x6a6a70);
  for (let x = 251; x < 262; x += 2) P.vl(x, 173, 3, 0x14141a);

  // ---------- taket över pumparna ----------
  const CX0 = 158;
  for (let y = 21; y < 40; y++) for (let x = CX0; x < FW; x++) {
    let c;
    if (y === 21) c = 0x2a2a30;
    else if (y === 22) c = 0xffffff;
    else if (y < 31) c = mix(0xf4f4f0, 0xe0e0dc, (y - 23) / 8 + (bayer(x, y) - 0.5) * 0.08);
    else if (y < 34) c = y === 31 ? 0xff6a5a : y === 32 ? 0xd8352e : 0xa82420;
    else if (y === 34) c = 0xf0b82a;
    else if (y === 35) c = 0x3a3a40;
    else c = mix(0x5a5c64, 0x42444c, (y - 36) / 4);
    if (x < CX0 + 2 && y < 36) c = mul(c, 0.78);
    P.px(x, y, c);
  }
  const title = $t('SNABBMACKEN'), ttw = textW(BIG, title), ttx = Math.round(271 - ttw / 2);
  text(P, BIG, title, ttx + 1, 24, 0xf0b0a8);
  text(P, BIG, title, ttx, 23, 0xd8352e);
  // droppen (märket) och 24H
  ['..r..', '.rrr.', 'rrwrr', 'rrrrr', '.rrr.'].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] !== '.') P.px(ttx - 10 + i, 24 + j, row[i] === 'w' ? 0xffffff : 0xd8352e); });
  text(P, SMALL, '24H', ttx + ttw + 6, 25, 0x2a2a30);
  // takbelysningen
  for (const cx of ISL) for (const lx of [cx - 22, cx + 14]) {
    P.rect(lx, 37, 7, 2, 0xfffbe0); P.hl(lx, 36, 7, 0xc8c4b0);
    P.ell(lx + 3.5, 40, 11, 5, 0xfff6c8, 0.45);
    for (let y = 41; y < 92; y++) { const w = 3 + (y - 41) * 0.28; P.hl(Math.round(lx + 3.5 - w), y, Math.round(w * 2), 0xfff8e0, 0.05 * (1 - (y - 41) / 51)); }
  }

  // ---------- pylonen med priserna ----------
  const PX = 124, PY = 22;
  P.rect(PX + 13, 62, 5, 22, 0x6a6e76); P.vl(PX + 13, 62, 22, 0x9aa2ac); P.vl(PX + 17, 62, 22, 0x3a3d44);
  P.rect(PX + 10, 82, 11, 3, 0x5a5e66); P.hl(PX + 10, 82, 11, 0x8a8e96);
  P.rect(PX - 1, PY - 1, 35, 42, 0x17151a);
  P.rect(PX, PY, 33, 8, 0xd8352e); P.hl(PX, PY, 33, 0xff7a6a); P.hl(PX, PY + 7, 33, 0x9a2020);
  text(P, SMALL, $t('PRISER'), PX + 5, PY + 2, 0xffffff);
  P.rect(PX, PY + 8, 33, 31, 0x121418);
  ['95', '98', 'D', 'EL'].forEach((g, i) => {
    const f = FUEL[g], y = PY + 10 + i * 7, lab = f.lab || f.name;
    P.rect(PX + 2, y, 11, 6, f.col); P.hl(PX + 2, y, 11, mix(f.col, 0xffffff, 0.3));
    text(P, SMALL, lab, PX + 2 + ((11 - textW(SMALL, lab)) >> 1), y + 1, f.ink);
    // släckta LED-segment bakom siffrorna (lika många tecken som priset)
    const ghost = f.price.replace(/\d/g, '8'), pw = textW(SMALL, f.price);
    text(P, SMALL, ghost, PX + 32 - pw, y + 1, 0x2a1c10);
    text(P, SMALL, f.price, PX + 32 - pw, y + 1, 0xffb020);
    P.px(PX + 32 - pw, y, 0x5a3a10);
  });
  P.hl(PX, PY + 39, 33, 0x3a3d44);

  // ---------- pumpöarna (det som inte rör sig) ----------
  for (const cx of ISL) {
    // pelaren upp till taket
    for (let y = 40; y < 93; y++) { P.px(cx - 9, y, 0x3a3a44); P.px(cx - 8, y, 0xffffff); P.px(cx - 7, y, 0xe4e4e0); P.px(cx - 6, y, 0xc4c4c0); P.px(cx - 5, y, 0x8e8e8a); P.px(cx - 4, y, 0x3a3a44); }
    P.rect(cx - 10, 88, 8, 5, 0x6a6a70); P.hl(cx - 10, 88, 8, 0x9a9aa0);
    // ön: ovansida + gul-svart framkant
    for (let y = 92; y < 102; y++) for (let x = cx - 34; x < cx + 33; x++) {
      let c;
      if (y === 92) c = 0x5a5a60;
      else if (y === 93) c = 0xf2f0ea;
      else if (y < 98) c = mix(0xdcdad4, 0xc8c6c0, (y - 94) / 4 + (bayer(x, y) - 0.5) * 0.15);
      else c = y === 101 ? 0x1c1c22 : (((x + y) >> 2) & 1 ? 0xf0b82a : 0x26262c);
      if (y >= 98 && y < 101 && ((x + y) & 3) === 0 && (((x + y) >> 2) & 1)) c = 0xffd86a;
      if (x === cx - 34 || x === cx + 32) c = mul(c, 0.6);
      P.px(x, y, c);
    }
    P.darken(cx - 34, 102, 67, 1, 0.7); P.darken(cx - 33, 103, 65, 1, 0.85);
    // påkörningsskydden
    for (const bx of [cx - 34, cx + 29]) {
      for (let y = 81; y < 95; y++) for (let i = 0; i < 4; i++) {
        let c = i === 0 || i === 3 ? 0x3a3a30 : i === 1 ? 0xffd86a : 0xd89a1a;
        if ((y === 85 || y === 86 || y === 90 || y === 91) && i > 0 && i < 3) c = i === 1 ? 0x4a4a52 : 0x26262c;
        if (y === 81 && (i === 0 || i === 3)) continue;
        if (y === 81) c = 0x3a3a30;
        P.px(bx + i, y, c);
      }
    }
    // pappershållare eller brandsläckare på pelaren
    if (cx === ISL[1]) {
      P.rect(cx - 9, 66, 4, 11, 0x5a1010); P.rect(cx - 8, 67, 2, 9, 0xd8202a); P.vl(cx - 8, 68, 7, 0xff6a5a);
      P.rect(cx - 8, 64, 2, 2, 0x2a2a30); P.px(cx - 10, 66, 0x2a2a30); P.vl(cx - 11, 67, 5, 0x2a2a30);
    } else {
      P.rect(cx - 10, 64, 7, 7, 0x3a3a44); P.rect(cx - 9, 65, 5, 5, 0xf4f4f0); P.hl(cx - 9, 65, 5, 0xffffff);
      P.rect(cx - 8, 71, 3, 2, 0xf4f1ea); P.px(cx - 6, 72, 0xc8c2b2);
    }
  }

  P.box(0, 0, FW, FH, 0x0e0d12);
  const cv = P.flush(), c2 = cv.getContext('2d');
  // menyn: samma sprites som i pratbubblorna
  [['korv', $t('25:-')], ['kaffe', $t('15:-')], ['tidning', $t('20:-')]].forEach(([id, pr], i) => {
    const s = itemSprite(id), cx = 31 + i * 22;
    c2.drawImage(s, cx - (s.width >> 1), 37 - s.height);
    ctxText(c2, SMALL, pr, cx - (textW(SMALL, pr) >> 1), 38, '#c8302a');
  });
  return cv;
}
