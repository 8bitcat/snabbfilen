// Posten – sorteringsterminalen. Paket och brev kommer in från lastporten där
// en gul postbil står backad mot portkudden; en kollega lastar ur och lägger
// allt på rullbandet. Varje försändelse har en adresslapp med färgband och
// postnummer – bär den till rätt rullbur (VÄSTER, NORR, SÖDER, ÖSTER,
// UTRIKES). Ömtåliga paket (glas-symbolen) ska bäras lugnt: springer man med
// dem (dubbelklick = spring) skakar de sönder. Då och då kommer en kund till
// utlämningsdisken med en avi – leta upp paketet med rätt nummer på hyllan
// och lämna över det. Det som rullar förbi hamnar i RETUR (missat).
//
// Hallen målas på stadens detaljnivå: betongblocksvägg med gul-blå profilrand,
// lastport med portkudde och postbil, skanner med laserlinje och skärm,
// sorteringsfack med en kollega, postnummerkarta, våg i golvet och på disken,
// frimärksautomat, nummerlappar och gallerburar med hjul. Allt statiskt målas
// EN gång (cachas); bara det som rör sig ritas varje bildruta. Ett pixelkorn:
// heltal, skala 1.
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { drawPerson, makeLook } from '../core/people.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const INK = 0x17151a, WHITE = 0xffffff;
const PY = 0xf2c12e;   // postgult
const PB = 0x1f4f9e;   // postblått

// ---------- regionerna = burarna (vänster → höger som på kartan) ----------
const REG = [
  { name: 'VÄSTER', dig: '4-5', ci: 0xe8862a, places: [['411 01', 'GÖTEBORG'], ['503 30', 'BORÅS'], ['451 40', 'UDDEVALLA'], ['541 30', 'SKÖVDE']] },
  { name: 'NORR', dig: '8-9', ci: 0x2f6fd8, places: [['981 31', 'KIRUNA'], ['972 41', 'LULEÅ'], ['903 25', 'UMEÅ'], ['852 30', 'SUNDSVALL'], ['803 20', 'GÄVLE']] },
  { name: 'SÖDER', dig: '2-3', ci: 0xd8403a, places: [['211 20', 'MALMÖ'], ['222 21', 'LUND'], ['252 21', 'HELSINGBORG'], ['392 31', 'KALMAR'], ['352 30', 'VÄXJÖ']] },
  { name: 'ÖSTER', dig: '1 6 7', ci: 0x35a04a, places: [['111 20', 'STOCKHOLM'], ['753 20', 'UPPSALA'], ['702 10', 'ÖREBRO'], ['632 20', 'ESKILSTUNA']] },
  { name: 'UTRIKES', dig: '', ci: 0x8e4fc8, places: [['NORGE', 'OSLO'], ['DANMARK', 'KÖPENHAMN'], ['TYSKLAND', 'BERLIN'], ['FRANKRIKE', 'PARIS'], ['FINLAND', 'HELSINGFORS']] },
];

// ---------- hallens mått ----------
const WALL_BASE = 61;                                  // hallväggens fot (bakom bandet)
const BELT = { x0: 10, x1: 222, rail: 61, top: 64, h: 14, foot: 75 };
const SPAWN_X = 30;                                    // där kollegan lägger ner saker
const SCAN_X = 170;                                    // skannerns laserlinje
const BIN = { x0: 224, x1: 248, rim: 77, front: 81, bot: 95 };
const SHELF = { x0: 250, x1: 288, top: 22, row0: 33, rowH: 13, rows: 4, cols: 3 };
const COUNTER = { x0: 289, top: 73, front: 78, bot: 95 };
const CUST_Y = 86;                                     // kundernas fötter (bakom disken)
const SLOTS = [314, 354];
// puffar vid disken stiger ca 13 px på 0,9 s – de får inte nå UTLÄMNING-skylten (rad 18–27):
// POP_FREE (på väggen mellan NR och NU) när kundens bubbla är borta och puffen är smal ('TACK!'),
// POP_BUBBLE (över kundens huvud) när bubblan (rad 28–51), nummerlappsautomaten och kö-skärmen ska förbli läsbara
const POP_FREE = 44, POP_BUBBLE = 60;
const CAGE = { w: 46, d: 6, base: 206, top: 170 };
const CAGES = REG.map((r, i) => { const x0 = 12 + i * 70; return { reg: i, x0, x1: x0 + CAGE.w, cx: x0 + (CAGE.w >> 1) }; });
// lastens platser i buren: fyra lager à fem, nedersta på däcket, varannan rad förskjuten
const LOAD_MAX = 20;
function loadSpot(ci, n) {
  const row = Math.min(3, (n / 5) | 0), col = n % 5;
  return { x: CAGES[ci].x0 + 1 + col * 8 + (row & 1) * 3, y: CAGE.base - 11 - row * 6 };
}
const SCALE = { x0: 146, y0: 124, w: 26, h: 6, colX: 174, dispX: 168, dispY: 100 };
const CLOCK = { x: 105, y: 48 };
const WALK_TOP = 97, WALK_BOT = 157;
const RUN_SPEED = 104, WALK_SPEED = 62;

// ======================= små målarverktyg =======================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(clamp(t, 0, 1) * steps + bayer(x, y)) / steps;
  return mix(a, b, clamp(q, 0, 1));
}
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = fn(x + i, y + j, i, j);
    if (c !== null && c !== undefined) P.px(x + i, y + j, c);
  }
}
function rows(P, x, y, w, cs) { cs.forEach((c, i) => { if (c !== null) P.hl(x, y + i, w, c); }); }
function vcols(P, x, y, h, cs) { cs.forEach((c, i) => { if (c !== null) P.vl(x + i, y, h, c); }); }
function knob(P, cx, cy, r, c) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 0.3) continue;
    P.px(cx + x, cy + y, d > r - 0.7 ? mul(c, 0.45) : x + y < -r * 0.6 ? mix(c, WHITE, 0.5) : x + y > r * 0.6 ? mul(c, 0.75) : c);
  }
}
// pixelkarta ('#' eller palettbokstav) på en Pix
function stamp(P, x, y, map, pal) {
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const v = pal[row[i]]; if (v !== undefined) P.px(x + i, y + j, v); } });
}
// mörk "sel-out"-kontur runt allt ogenomskinligt (tonad efter grannpixeln)
function outline(P) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[(y * w + x) * 4 + 3]) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const k = (yy * w + xx) * 4;
      if (src[k + 3] < 200) continue;
      const c = (src[k] << 16) | (src[k + 1] << 8) | src[k + 2];
      P.px(x, y, mix(mul(c, 0.42), 0x1c1418, 0.4));
      break;
    }
  }
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function pline(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
const fmtKg = (kg = 0) => (kg < 10 ? kg.toFixed(2) : kg.toFixed(1)).replace('.', ',');

// ======================= symboler =======================
// glaset (ÖMTÅLIGT) 5×7
const GLASS = ['#####', '#...#', '.#.#.', '..#..', '..#..', '..#..', '.###.'];
// posthornet 13×7 (slinga + klocka åt höger + munstycke)
const HORN = [
  '...####......',
  '..#....#....#',
  '.#..##..#..##',
  '##.#..#.#####',
  '.#..##..#..##',
  '..#....#....#',
  '...####......',
];
function drawGlass(P, x, y, c) { stamp(P, x, y, GLASS, { '#': c }); }
function drawHorn(P, x, y, c) { stamp(P, x, y, HORN, { '#': c }); }
// runt gult märke med blått posthorn (15×15)
function hornBadge(P, cx, cy) {
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
    const d = Math.hypot(x, y);
    if (d > 7.4) continue;
    P.px(cx + x, cy + y, d > 6.5 ? mul(PB, 0.7) : x + y < -5 ? 0xffe98a : x + y > 6 ? 0xd8a820 : PY);
  }
  drawHorn(P, cx - 6, cy - 3, PB);
}

// ======================= försändelserna =======================
const KINDS = {
  brev: { p: 0.17, kg: [0.02, 0.09] },
  kuvert: { p: 0.12, kg: [0.1, 0.6] },
  back: { p: 0.09, kg: [1.4, 3.6] },
  paketS: { p: 0.17, kg: [0.4, 1.9] },
  paketM: { p: 0.15, kg: [1.8, 4.8] },
  paketL: { p: 0.08, kg: [4.2, 9.6] },
  ror: { p: 0.08, kg: [0.3, 0.9] },
  glas: { p: 0.14, kg: [0.9, 3.4], fragile: true },
};
const KIND_IDS = Object.keys(KINDS);
const BOX_COLS = [0xc4955a, 0xb98a50, 0xd0a468, 0xc79c64, PY, 0xe6e2da];

// adresslappen 9×7: färgband, adressrad, streckkod
function label(P, x, y, reg, seed = 0) {
  const ci = REG[reg].ci;
  area(P, x, y, 9, 7, (X, Y, i, j) => {
    if (i === 0 || i === 8 || j === 0 || j === 6) return (i === 0 || i === 8) && (j === 0 || j === 6) ? null : 0xd8d2c4;
    if (j === 1) return mix(ci, WHITE, 0.25);
    if (j === 2) return ci;
    if (j === 3) return i > 1 && i < 7 && (i + seed) % 3 !== 0 ? 0x6a6660 : 0xfbfaf6;
    return (hash(i, seed, 5) > 0.45 || i === 1 || i === 7) ? 0x2a2830 : 0xfbfaf6;   // streckkod
  });
}
// låda i 3/4-vy: toppyta (d rader) + framsida (h rader); returnerar framsidans y
function boxFaces(P, x, y, w, d, h, base, seed) {
  const top = mix(base, WHITE, 0.22);
  area(P, x, y, w, d, (X, Y, i, j) => {
    let c = j === 0 ? mix(base, WHITE, 0.34) : qmix(top, mix(base, WHITE, 0.12), j / d, X, Y, 2);
    if (i === 0) c = mix(c, WHITE, 0.08);
    if (i === w - 1) c = mul(c, 0.9);
    return jit(c, X, Y, seed, 0.04);
  });
  area(P, x, y + d, w, h, (X, Y, i, j) => {
    let c = j === 0 ? mix(base, WHITE, 0.1) : qmix(base, mul(base, 0.84), j / h, X, Y, 3);
    if (i === 0) c = mix(c, WHITE, 0.06);
    if (i >= w - 2) c = mul(c, i === w - 1 ? 0.72 : 0.86);
    if (j === h - 1) c = mul(c, 0.8);
    return jit(c, X, Y, seed + 1, 0.05);
  });
  return y + d;
}
function paintItem(kind, reg, v) {
  let P, W, H;
  const s = v * 7 + reg;
  const mk = (w, h) => { W = w; H = h; P = new Pix(w + 2, h + 2); };
  if (kind === 'brev') {
    mk(15, 10);
    const paper = [0xf6f4ee, 0xf2ead8, 0xe4eef8][v % 3], air = reg === 4;
    area(P, 1, 1, 15, 9, (X, Y, i, j) => {
      let c = j === 0 ? mix(paper, WHITE, 0.5) : paper;
      if (air && (i === 0 || i === 14 || j === 0 || j === 8)) c = ((i + j) >> 1) % 2 ? 0xd8303a : 0x2a5cb4;   // luftpostkant
      else if (Math.abs(i - 7) === j && j < 5) c = mul(paper, 0.9);                                             // fliken
      return jit(c, X, Y, 11 + v, 0.03);
    });
    P.hl(1, 10, 15, mul(paper, 0.72));
    // frimärke med tandning
    area(P, 11, 2, 3, 4, (X, Y, i, j) => (j === 0 && i === 1 ? 0xffffff : [0xd8303a, 0x2a8a5a, 0x2a5cb4][v % 3]));
    P.px(12, 4, 0xffe27a);
    P.rect(2, 6, 4, 3, REG[reg].ci); P.hl(2, 6, 4, mix(REG[reg].ci, WHITE, 0.35));          // regionsdekal
    P.hl(7, 5, 6, 0x6a6660); P.hl(7, 7, 5, 0x8a8680); P.hl(7, 3, 3, 0x9a968e);              // adressrader
  } else if (kind === 'kuvert') {
    mk(16, 11);
    const base = [0xe0bf72, 0xd8c8a8, 0xe8d8a0][v % 3];
    area(P, 1, 1, 16, 10, (X, Y, i, j) => {
      let c = j === 0 ? mix(base, WHITE, 0.35) : base;
      if (j > 0 && ((i + (j & 1) * 2) % 4 === 0) && j % 2 === 0) c = mix(c, WHITE, 0.2);                    // bubblor
      if (i === 15) c = mul(c, 0.86);
      if (j === 9) c = mul(c, 0.78);
      return jit(c, X, Y, 12 + v, 0.04);
    });
    P.hl(1, 11, 16, mul(base, 0.62));
    label(P, 5, 3, reg, s);
  } else if (kind === 'back') {
    mk(20, 13);
    const y1 = 1 + 6;
    // brevlådans insida med brev som står på högkant
    area(P, 1, 1, 20, 6, (X, Y, i, j) => {
      if (j === 0) return i === 0 || i === 19 ? 0xd8a820 : 0xffe98a;
      if (i === 0 || i === 19) return 0xe8b828;
      if (i > 1 && i < 18 && j > 1) {
        const k = (i - 2) % 3;
        if (k < 2) { const pc = [0xf6f4ee, 0xe4eef8, 0xf2ead8, 0xffffff][(i * 7 + v) % 4]; return j === 2 ? mix(pc, WHITE, 0.4) : k === 1 ? mul(pc, 0.9) : pc; }
        return 0x8a6a18;
      }
      return 0xa88418;
    });
    area(P, 1, y1, 20, 7, (X, Y, i, j) => {
      let c = j === 0 ? 0xffe27a : qmix(PY, 0xd8a41e, j / 7, X, Y, 3);
      if (i === 0) c = mix(c, WHITE, 0.12);
      if (i >= 18) c = mul(c, i === 19 ? 0.72 : 0.86);
      if (i % 5 === 2 && j > 1) c = mul(c, 0.92);
      return jit(c, X, Y, 13, 0.03);
    });
    P.rect(4, y1 + 1, 5, 2, 0x5a4410); P.hl(4, y1 + 3, 5, 0xffe98a);                          // handtagshål
    label(P, 10, y1, reg, s);
  } else if (kind === 'ror') {
    mk(22, 8);
    const base = [0xd0b080, 0xf0eee8, 0x6a8ab8][v % 3];
    const ramp = [mix(base, WHITE, 0.55), mix(base, WHITE, 0.25), base, base, mul(base, 0.86), mul(base, 0.72), mul(base, 0.6), mul(base, 0.5)];
    area(P, 1, 1, 22, 8, (X, Y, i, j) => {
      if ((i === 0 || i === 21) && (j === 0 || j === 7)) return null;
      if (i < 2 || i > 19) return [0xffffff, 0xf2f2f2, 0xe0e0e0, 0xd6d6d6, 0xc4c4c4, 0xb0b0b0, 0x9a9a9a, 0x888888][j];
      if (i === 2 || i === 19) return mul(ramp[j], 0.8);
      return jit(ramp[j], X, Y, 14, 0.03);
    });
    area(P, 9, 1, 7, 8, (X, Y, i, j) => {
      const w = [0xffffff, 0xffffff, 0xf6f4ee, 0xf2f0ea, 0xe0ddd4, 0xccc8c0, 0xb8b4ac, 0xa8a49c][j];
      if (i < 2) return j === 0 ? mix(REG[reg].ci, WHITE, 0.4) : j > 5 ? mul(REG[reg].ci, 0.7) : REG[reg].ci;
      if (i > 2 && i < 6 && (j === 3 || j === 5)) return 0x5a5650;
      return w;
    });
  } else if (kind === 'glas') {
    mk(18, 15);
    const base = 0xe8dcc4;
    const fy = boxFaces(P, 1, 1, 18, 4, 11, base, 15 + v);
    // röd-vit ÖMTÅLIGT-tejp över toppen
    area(P, 1, 2, 18, 2, (X, Y, i, j) => ((i >> 1) % 3 === 0 ? 0xffffff : j === 0 ? 0xe84a3a : 0xc0282a));
    drawGlass(P, 3, fy + 2, 0xc8202a);
    P.px(4, fy + 3, 0xff8a7a);
    label(P, 9, fy + 2, reg, s);
    P.hl(2, fy + 10, 16, 0xc0282a);
  } else {
    const dims = { paketS: [14, 4, 8], paketM: [18, 5, 10], paketL: [22, 6, 11] }[kind];
    const [w, d, h] = dims;
    mk(w, d + h);
    const base = BOX_COLS[(v * 3 + reg) % BOX_COLS.length];
    const fy = boxFaces(P, 1, 1, w, d, h, base, 16 + v);
    // tejp: över toppens mitt och en bit ner på framsidan
    const tx = 1 + (w >> 1) - 1, tape = base === PY ? 0x2a5cb4 : base === 0xe6e2da ? PY : 0xe0c890;
    for (let y = 1; y < fy + 3; y++) { P.px(tx, y, y === fy ? mul(tape, 0.8) : tape); P.px(tx + 1, y, mul(tape, y < fy ? 0.9 : 0.8)); }
    if (base === PY) { drawHorn(P, 2, fy + 2, PB); }
    label(P, 1 + w - 11, fy + (h > 9 ? 2 : 1), reg, s);
    if (kind === 'paketL') { P.hl(3, fy + h - 3, 5, mul(base, 0.7)); P.hl(3, fy + h - 2, 3, mul(base, 0.7)); }   // "DENNA SIDA UPP"-streck
  }
  outline(P);
  return { c: P.flush(), w: W + 2, h: H + 2 };
}
const ITEM_SPR = new Map();
function itemSprite(it) {
  const key = it.kind + ':' + it.reg + ':' + it.v;
  let s = ITEM_SPR.get(key);
  if (!s) { s = paintItem(it.kind, it.reg, it.v); ITEM_SPR.set(key, s); }
  return s;
}
// liten kopia i buren (8×6 eller 8×3 för brev) med regionens prick
const MINI = new Map();
function miniSprite(it) {
  const key = it.kind + ':' + it.reg + ':' + it.v;
  let c = MINI.get(key);
  if (c) return c;
  const flat = it.kind === 'brev' || it.kind === 'kuvert';
  const P = new Pix(10, flat ? 6 : 8);
  const base = it.kind === 'brev' ? 0xf4f2ea : it.kind === 'kuvert' ? 0xe0bf72 : it.kind === 'back' ? PY : it.kind === 'glas' ? 0xe8dcc4 : it.kind === 'ror' ? 0xd0b080 : BOX_COLS[(it.v * 3 + it.reg) % BOX_COLS.length];
  if (flat) {
    // en bunt brev med gummiband i regionens färg
    area(P, 1, 1, 8, 4, (X, Y, i, j) => {
      if (i === 5) return j === 0 ? mix(REG[it.reg].ci, WHITE, 0.3) : REG[it.reg].ci;
      const c = j === 0 ? mix(base, WHITE, 0.4) : j === 2 ? mul(base, 0.84) : j === 3 ? mul(base, 0.92) : base;
      return i === 7 ? mul(c, 0.86) : c;
    });
  } else {
    area(P, 1, 1, 8, 2, (X, Y, i, j) => (j === 0 ? mix(base, WHITE, 0.32) : mix(base, WHITE, 0.16)));
    area(P, 1, 3, 8, 4, (X, Y, i, j) => (i === 7 ? mul(base, 0.76) : j === 3 ? mul(base, 0.84) : base));
    P.rect(5, 4, 2, 2, REG[it.reg].ci);
    if (it.kind === 'glas') P.px(2, 4, 0xc8202a);
  }
  outline(P);
  c = P.flush();
  MINI.set(key, c);
  return c;
}
// hyllpaketet (13×12) med nummerlapp
const SHELF_SPR = new Map();
function shelfSprite(num, col) {
  const key = num + ':' + col;
  let c = SHELF_SPR.get(key);
  if (c) return c;
  const P = new Pix(13, 12), base = BOX_COLS[col % BOX_COLS.length];
  const fy = boxFaces(P, 1, 1, 11, 2, 8, base, 30 + col);
  area(P, 2, fy + 1, 9, 7, (X, Y, i, j) => ((i === 0 || i === 8) && (j === 0 || j === 6) ? null : j === 0 ? 0xffffff : j === 6 ? 0xd8d2c4 : 0xfbfaf6));
  text(P, SMALL, String(num), 3, fy + 2, 0x1c1a22);
  outline(P);
  c = P.flush();
  SHELF_SPR.set(key, c);
  return c;
}

// ======================= burarna =======================
// Gallerbur med hjul: bakre gallret sitter CAGE.d px högre upp (djup), däcket
// syns ovanifrån emellan. Skylten (regionens färg + postnummersiffror) sitter
// på främre överliggaren. Bak och fram målas var för sig – lasten hamnar emellan.
const CAGE_OX = 5, CAGE_OY = 152, CAGE_CW = CAGE.w + 10, CAGE_CH = CAGE.base - CAGE_OY + 1;
let CAGE_ART = null;
function cageArt() {
  if (CAGE_ART) return CAGE_ART;
  CAGE_ART = CAGES.map((cg) => {
    const Bk = new Pix(CAGE_CW, CAGE_CH), F = new Pix(CAGE_CW, CAGE_CH), w = CAGE.w, R = REG[cg.reg], col = R.ci;
    const X = (x) => x + CAGE_OX, Y = (y) => y - CAGE_OY;   // x relativt buren, y i skärmkoordinater
    const D = CAGE.d, ft = CAGE.top, fb = CAGE.base - 9;     // främre gallret ft..fb
    // ---- bak: skugga, bakre galler, däck ----
    Bk.ell(X(w / 2), Y(CAGE.base - 1), w / 2 + 5, 3.4, 0x1a1418, 0.45, 4);
    area(Bk, X(0), Y(ft - D), w, fb - ft, (x, y, i, j) => {
      if (j === 0 || j === 1) return j === 0 ? 0xb8c0c8 : 0x7a828a;
      if (i < 2 || i >= w - 2) return i === 0 || i === w - 2 ? 0x9aa2aa : 0x6a727a;
      if (i % 4 === 1) return j % 2 ? 0x6a727a : 0x7e868e;
      if (j % 5 === 2) return 0x727a82;
      return null;
    });
    area(Bk, X(1), Y(fb - D), w - 2, D, (x, y, i, j) => {
      let c = qmix(0x5a6068, 0x6e747c, j / D, x, y, 2);
      if ((i + j) % 4 === 0) c = mul(c, 0.85);
      return c;
    });
    // ---- fram: galler, stolpar, bottenram, hjul, skylt ----
    area(F, X(0), Y(ft), w, fb - ft, (x, y, i, j) => {
      if (j === 0) return 0xe4eaf0;
      if (j === 1) return 0x9aa2aa;
      if (i < 2) return i === 0 ? 0xf0f4f8 : 0xa8b0b8;
      if (i >= w - 2) return i === w - 2 ? 0xc8d0d8 : 0x6a727a;
      if (i % 4 === 1) return j % 2 ? 0xc8d0d8 : 0xa8b0b8;
      if (j % 5 === 2) return (i % 4 === 2) ? 0x8a9298 : 0xbcc4cc;
      return null;
    });
    // bottenram (stålprofil) + regionfärgad kant
    rows(F, X(-1), Y(fb), w + 2, [0xd0d6dc, 0x8a9098, 0x5a6068]);
    F.hl(X(3), Y(fb + 1), w - 6, col); F.hl(X(3), Y(fb + 2), w - 6, mul(col, 0.7));
    // hjul med gaffel (svängbara)
    for (const wx of [2, w - 8]) {
      rows(F, X(wx), Y(fb + 3), 6, [0x9aa0a8, 0x5a6068]);
      area(F, X(wx), Y(fb + 5), 6, 5, (x, y, i, j) => {
        if ((i === 0 || i === 5) && (j === 0 || j === 4)) return null;
        if (i >= 2 && i <= 3 && j >= 1 && j <= 3) return j === 1 ? 0xd8dce2 : 0x8a9098;
        return j === 0 ? 0x3a3a42 : 0x18181c;
      });
    }
    // skylten: regionens färg med namnet, vit remsa med postnummersiffror
    const sw = 40, sh = 16, sx = X((w - sw) >> 1), sy = Y(156);
    F.darken(sx + 1, sy + sh, sw - 1, 1, 0.7);
    area(F, sx, sy, sw, sh, (x, y, i, j) => {
      if ((i === 0 || i === sw - 1) && (j === 0 || j === sh - 1)) return null;
      if (i === 0 || i === sw - 1 || j === 0 || j === sh - 1) return mix(mul(col, 0.4), 0x1c1418, 0.4);
      if (j < 8) return j === 1 ? mix(col, WHITE, 0.35) : j === 7 ? mul(col, 0.72) : i === 1 ? mix(col, WHITE, 0.15) : i === sw - 2 ? mul(col, 0.85) : jit(col, x, y, 50, 0.04);
      if (j === 8) return 0xc8c4bc;
      return j === sh - 2 ? 0xe4e0d8 : i === sw - 2 ? 0xe8e4dc : 0xfbfaf6;
    });
    // nitar i hörnen
    for (const rx of [2, sw - 3]) { F.px(sx + rx, sy + 2, mix(col, WHITE, 0.6)); F.px(sx + rx, sy + 3, mul(col, 0.6)); }
    const nw = textW(SMALL, R.name), nx = sx + ((sw - nw) >> 1);
    text(F, SMALL, R.name, nx + 1, sy + 3, mul(col, 0.45));
    text(F, SMALL, R.name, nx, sy + 2, WHITE);
    if (R.dig) {
      const dw = textW(SMALL, R.dig);
      text(F, SMALL, R.dig, sx + ((sw - dw) >> 1), sy + 9, mul(col, 0.5));
    } else {
      // UTRIKES: luftpostränder
      for (let i = 2; i < sw - 2; i++) for (let j = 10; j < 13; j++) if (((i + j) >> 1) % 3 !== 2) F.px(sx + i, sy + j, ((i + j) >> 1) % 3 ? 0x2a5cb4 : 0xd8303a);
    }
    return { back: Bk.flush(), front: F.flush() };
  });
  return CAGE_ART;
}

// ======================= hallen (statisk, en gång) =======================
// Sverige i 12×30 med regionerna (postnumrens första siffra)
const SWEDEN = [
  '........##..', '.......####.', '......#####.', '.....######.', '.....#######', '....#######.', '....######..', '...######...',
  '...#######..', '..#######...', '..######....', '..######....', '.######.....', '.#######....', '.######.....', '.######.....',
  '.#######....', '.#######....', '########....', '#########...', '#########...', '.########...', '.#######....', '..#######...',
  '..######....', '..#######...', '...######...', '...#####....', '...####.....', '....###.....',
];
function regionAt(x, y) { if (y < 15) return 1; if (y >= 25) return 2; return x < 4 + (y > 20 ? 1 : 0) ? 0 : 3; }

function paintHall() {
  const P = new Pix(FW, FH);
  // ---------- taket (mest dolt bakom topplisten) ----------
  area(P, 0, 0, FW, 18, (X, Y) => {
    let c = jit(0x2a2e36, X, Y, 60, 0.05);
    if (Y % 6 === 0) c = 0x22252c;
    if (X % 64 < 3) c = X % 64 === 0 ? 0x4a505a : 0x3a3f48;
    return c;
  });
  // stålbalk
  rows(P, 0, 17, FW, [0x6a727e, 0x4a525e, 0x2e343c]);
  for (let x = 8; x < FW; x += 24) P.px(x, 18, 0x9aa2ac);
  // ---------- hallväggen: målade betongblock ----------
  area(P, 0, 20, 289, WALL_BASE - 20, (X, Y) => {
    const j = Y - 20, row = Math.floor(j / 7), ry = j % 7, off = (row & 1) * 8, rx = (X + off) % 16;
    let c = qmix(0xd4d9df, 0xbcc2c9, j / 40, X, Y, 3);
    c = mix(c, hash(Math.floor((X + off) / 16), row, 61) > 0.5 ? 0xc6ccd3 : 0xdadfe4, 0.3);
    if (ry === 6 || rx === 15) c = mul(c, 0.87);
    else if (ry === 0 || rx === 0) c = mix(c, WHITE, 0.14);
    return jit(c, X, Y, 62, 0.035);
  });
  // gul + blå profilrand
  rows(P, 0, 47, 289, [0xffe98a, PY, PY, 0xd6a41e]);
  rows(P, 0, 51, 289, [0x3a6ac8, PB, 0x163a78]);
  // sockel
  rows(P, 0, 57, 289, [0x8a929c, 0x5a626c, 0x4a525c, 0x3a414a]);
  // lysrör i taket + ljuspölar på väggen
  for (const lx of [40, 132, 214, 336]) {
    P.ell(lx, 26, 34, 12, 0xfff8e0, 0.16, 4);
    rows(P, lx - 14, 19, 28, [0x5a626c, 0xf8fbff, 0xd8e2ec]);
    P.hl(lx - 13, 19, 26, 0x8a929c);
  }
  paintDock(P);
  paintWallStuff(P);
  paintShelf(P);
  paintShop(P);
  paintFloor(P);
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}

// ---------- lastporten med portkudde och postbilen ----------
function paintDock(P) {
  // betongpelare
  for (const [x0, lit] of [[0, true], [53, false]]) {
    area(P, x0, 17, 4, WALL_BASE - 17, (X, Y, i) => jit(i === 0 ? 0xc8ccd2 : i === 3 ? 0x7a8088 : 0xa8aeb6, X, Y, 63, 0.04));
    if (!lit) P.vl(x0, 17, WALL_BASE - 17, 0xd8dce2);
  }
  // rulldörren (nästan helt uppe): lameller + gul/svart underkant
  area(P, 4, 17, 49, 5, (X, Y, i, j) => [0xb8c0c8, 0x8a929c, 0xa8b0b8, 0x7a828c, 0x9aa2ac][j]);
  area(P, 4, 22, 49, 2, (X, Y, i, j) => (j === 0 ? ((((X + 1) >> 2) & 1) ? 0xf0c020 : 0x1e1e20) : 0x2a2a2e));
  // portkudden: svart gummi runt bilen med gula ledstreck
  area(P, 4, 24, 49, 5, (X, Y, i, j) => {
    let c = qmix(0x33343a, 0x1c1d21, j / 5, X, Y, 2);
    if (i % 8 === 4) c = 0x121316;
    if (j === 2 && i > 18 && i < 31) c = 0xe8c030;
    return c;
  });
  for (const sx of [4, 48]) area(P, sx, 29, 5, WALL_BASE - 29, (X, Y, i, j) => {
    let c = qmix(0x2e2f35, 0x1c1d21, (sx === 4 ? i : 4 - i) / 5, X, Y, 2);
    if (i === 2 && (j >> 2) % 2 === 0) c = 0xe8c030;
    if (j % 9 === 8) c = 0x121316;
    return c;
  });
  // ---- postbilen, baksidan med dörrarna uppslagna ----
  const vx0 = 9, vx1 = 48;
  // takkant + skylt
  area(P, vx0, 29, vx1 - vx0, 7, (X, Y, i, j) => {
    let c = j === 0 ? 0xffe98a : j === 6 ? 0xb88a10 : qmix(0xf8cc30, 0xe8b420, j / 6, X, Y, 2);
    if (i === 0) c = mix(c, WHITE, 0.2);
    if (i === vx1 - vx0 - 1) c = mul(c, 0.8);
    return jit(c, X, Y, 64, 0.03);
  });
  text(P, SMALL, 'POSTEN', vx0 + ((vx1 - vx0 - textW(SMALL, 'POSTEN')) >> 1), 30, PB);
  // lastutrymmet: mörkt, hyllor med paket och säckar
  area(P, vx0 + 3, 36, vx1 - vx0 - 6, WALL_BASE - 36, (X, Y, i, j) => {
    let c = qmix(0x4a4e58, 0x24262c, j / 22, X, Y, 3);
    if (i % 11 === 5) c = mul(c, 0.85);
    return jit(c, X, Y, 65, 0.04);
  });
  P.ell(28, 38, 12, 5, 0xfff0c0, 0.22, 3);                 // taklampan i skåpet
  P.hl(25, 36, 7, 0xfff4d0);
  // hyllplan till vänster med paket
  P.hl(vx0 + 3, 45, 12, 0x8a929c); P.hl(vx0 + 3, 46, 12, 0x3a3e46);
  for (const [px, pw, ph, pc] of [[13, 5, 5, 0xc4955a], [18, 4, 4, 0xd0a468], [15, 3, 2, 0xe6e2da]]) {
    area(P, px, 45 - ph - (pc === 0xe6e2da ? 5 : 0), pw, ph, (X, Y, i, j) => (j === 0 ? mix(pc, WHITE, 0.25) : i === pw - 1 ? mul(pc, 0.75) : mul(pc, 0.9)));
  }
  // staplade paket till höger + en postsäck på golvet
  for (const [px, py, pw, ph, pc] of [[38, 49, 7, 6, 0xc4955a], [39, 43, 6, 6, 0xb98a50], [40, 38, 5, 5, PY], [32, 52, 6, 5, 0xd0a468]]) {
    area(P, px, py, pw, ph, (X, Y, i, j) => (j === 0 ? mix(pc, WHITE, 0.3) : i === pw - 1 ? mul(pc, 0.72) : j === ph - 1 ? mul(pc, 0.8) : jit(pc, X, Y, 66, 0.05)));
    P.vl(px + (pw >> 1), py, 2, 0xe0c890);
  }
  area(P, 14, 50, 9, 8, (X, Y, i, j) => {
    const edge = (j === 0 && (i < 2 || i > 6)) || (j === 7 && (i === 0 || i === 8));
    if (edge) return null;
    let c = j < 2 ? 0x9aa0a8 : qmix(0x8a9098, 0x5a6068, j / 8, X, Y, 2);
    if (j === 3) c = PY;
    return c;
  });
  // lastgolvet med halkskydd
  area(P, vx0 + 3, 57, vx1 - vx0 - 6, 4, (X, Y, i, j) => (j === 0 ? 0x8a929c : ((i + j) % 3 === 0 ? 0x5a626c : 0x6a727c)));
  // dörrkarmar (gula) med bakljus
  for (const [kx, right] of [[vx0, false], [vx1 - 3, true]]) {
    area(P, kx, 36, 3, WALL_BASE - 36, (X, Y, i, j) => {
      let c = right ? [0xe8b420, 0xd8a41e, 0xa87c10][i] : [0xffe27a, 0xf8cc30, 0xd8a41e][i];
      if ((right && i === 0) || (!right && i === 2)) c = 0x2a2a2e;   // gummilist mot öppningen
      return jit(c, X, Y, 67, 0.03);
    });
    const lx = right ? kx + 1 : kx;
    rows(P, lx, 46, 2, [0xf09030, 0xf09030]);
    rows(P, lx, 48, 2, [0xff5a4a, 0xd8303a, 0xd8303a, 0xb02028, 0xd8303a]);
    rows(P, lx, 53, 2, [0xf4f4f0, 0xd8d8d4]);
  }
}

// ---------- väggen: karta, skylt, klocka, varning, skannerskärm, sorteringsfack ----------
function paintWallStuff(P) {
  // postnummerkartan (affisch)
  const mx = 59, my = 21, mw = 28, mh = 35;
  P.darken(mx + 1, my + 1, mw, mh, 0.82);
  area(P, mx, my, mw, mh, (X, Y, i, j) => {
    if (i === 0 || j === 0 || i === mw - 1 || j === mh - 1) return 0x3a3e46;
    return jit(j < 7 ? PB : 0xf8f6ee, X, Y, 68, 0.02);
  });
  text(P, SMALL, 'POSTNR', mx + ((mw - textW(SMALL, 'POSTNR')) >> 1), my + 1, PY);
  SWEDEN.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') {
      const r = regionAt(x, y), c = REG[r].ci;
      const edge = !row[x - 1] || row[x - 1] !== '#' || x === row.length - 1 || row[x + 1] !== '#';
      P.px(mx + 4 + x, my + 7 + y - 3 + 1, edge ? mul(c, 0.78) : (x + y) % 5 === 0 ? mix(c, WHITE, 0.2) : c);
    }
  });
  P.rect(mx + 14, my + 29, 2, 3, REG[3].ci);                               // Gotland
  // utrikes: liten lila jordglob i hörnet
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const d = Math.hypot(x, y); if (d > 3.3) continue;
    P.px(mx + 21 + x, my + 29 + y, d > 2.5 ? mul(REG[4].ci, 0.6) : (x === 0 || y === 0) ? mix(REG[4].ci, WHITE, 0.45) : REG[4].ci);
  }
  // POSTEN-skylten: blå panel, posthorn i gul rundel, gula bokstäver
  const sx = 94, sy = 22, sw = 58, sh = 17;
  P.darken(sx + 1, sy + sh, sw, 1, 0.8);
  area(P, sx, sy, sw, sh, (X, Y, i, j) => {
    if (i === 0 || j === 0 || i === sw - 1 || j === sh - 1) return i === 0 || j === 0 ? 0x4a7ad8 : 0x0e2a5e;
    return jit(qmix(0x2a5cb8, 0x1f4a98, j / sh, X, Y, 3), X, Y, 69, 0.03);
  });
  hornBadge(P, sx + 10, sy + 8);
  text(P, BIG, 'POSTEN', sx + 20, sy + 6, 0x0e2a5e);
  text(P, BIG, 'POSTEN', sx + 19, sy + 5, PY);
  // klocka (visarna ritas levande)
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const d = Math.hypot(x, y); if (d > 6.3) continue;
    P.px(CLOCK.x + x, CLOCK.y + y, d > 5.4 ? 0x2a2c30 : d > 4.6 && (Math.abs(x) < 1 || Math.abs(y) < 1) ? 0x2a2c30 : y < -2 ? 0xffffff : 0xeef0f2);
  }
  P.darken(CLOCK.x - 5, CLOCK.y + 7, 11, 1, 0.8);
  // varningsskylt: ÖMTÅLIGT – GÅ LUGNT
  const wx = 115, wy = 42, ww = 37, wh = 14;
  area(P, wx, wy, ww, wh, (X, Y, i, j) => (i === 0 || j === 0 || i === ww - 1 || j === wh - 1 ? INK : j === 1 ? 0xffe98a : PY));
  area(P, wx + 2, wy + 2, 8, 10, (X, Y, i, j) => (i === 0 || j === 0 ? 0xfff8d8 : i === 7 || j === 9 ? 0xc89818 : 0xfffbe8));   // vit ruta bakom glaset
  drawGlass(P, wx + 3, wy + 3, 0xc8202a);
  P.px(wx + 4, wy + 4, 0xff8a7a);
  text(P, SMALL, 'GÅ', wx + 12, wy + 2, INK);
  text(P, SMALL, 'LUGNT!', wx + 12, wy + 8, INK);
  // skannerns skärm (innehållet ritas levande) + fäste och kamerahus
  area(P, 154, 22, 32, 16, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a626c : i === 31 || j === 15 ? 0x16171a : 0x2a2c32));
  P.rect(156, 24, 28, 12, 0x0c1418);
  P.rect(168, 38, 4, 2, 0x4a525c);
  rows(P, 160, 41, 20, [0x9aa2ac, 0x6a727c, 0x3a414a]);                      // fästskena
  vcols(P, 169, 44, 5, [0x8a929c, 0x4a525c]);
  area(P, 163, 48, 15, 7, (X, Y, i, j) => (i === 0 || j === 0 ? 0x4a4e56 : i === 14 || j === 6 ? 0x0e0f12 : j === 1 ? 0x3a3e46 : 0x24262c));
  P.rect(168, 54, 5, 1, 0x5a1a1a); P.px(170, 54, 0xff4a3a);                  // laserfönster
  P.px(165, 50, 0x5aff8a);
  text(P, SMALL, 'SKANNER', 155, 16 + 0, 0x3a414a, 0);                       // (dold bakom listen)
  // sorteringsfacket: björkram med 4×4 fack, brev som sticker upp och färgade fackmärken
  const fx0 = 190, fy0 = 21, fw = 32, fh = 30;
  P.darken(fx0 + 2, fy0 + fh, fw, 2, 0.82);
  area(P, fx0, fy0, fw, fh, (X, Y, i, j) => {
    const ci = (i - 2) % 7, cj = (j - 2) % 7;
    const frame = i < 2 || i >= fw - 2 || j < 2 || j >= fh - 2 || ci >= 5 || cj >= 5 || i - 2 >= 28 || j - 2 >= 28 && false;
    if (frame) {
      let c = qmix(0xe0c088, 0xc8a468, (i + j * 0.3) / 40, X, Y, 2);
      if (i === 0 || j === 0) c = 0xf0d8a8;
      if (i === fw - 1 || j === fh - 1) c = 0x8a6a38;
      if (cj === 6 && i >= 2 && i < fw - 2) c = 0x9a7a48;           // hyllkant (skugga under)
      return c;
    }
    return mix(0x2a2218, 0x3a3024, cj / 5);
  });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const cx = fx0 + 2 + c * 7, cy = fy0 + 2 + r * 7, h = hash(r, c, 70);
    // fackmärke i regionfärg
    P.hl(cx + 1, cy + 5, 3, REG[(r * 4 + c) % 5].ci);
    if (h < 0.2) continue;
    const n = 1 + ((h * 3) | 0);
    for (let k = 0; k < n; k++) {
      const pc = [0xf6f4ee, 0xe4eef8, 0xf2ead8, 0xdce8f4][(r + c + k) % 4];
      const lx = cx + k, top = cy + 1 + ((hash(r, c + k, 71) * 2) | 0);
      P.vl(lx, top, cy + 5 - top, pc); P.px(lx, top, WHITE);
    }
  }
  // en gul brevlåda (klassisk) på väggen vid lastporten? nej – ett inramat foto på postbilen
  const bx = 225, by = 22, bw = 22, bh = 16;
  area(P, bx, by, bw, bh, (X, Y, i, j) => (i === 0 || j === 0 || i === bw - 1 || j === bh - 1 ? 0x5a3a20 : i === 1 || j === 1 ? 0x8a5a30 : j < 9 ? mix(0x9ad0f0, 0xd8eef8, j / 9) : 0x6a8a5a));
  // bilen på fotot
  area(P, bx + 4, by + 6, 13, 6, (X, Y, i, j) => (j === 0 && (i < 2 || i > 9) ? null : j < 3 && i > 8 ? 0x5a7aa8 : j === 5 ? 0x2a2a2e : PY));
  P.px(bx + 6, by + 12, INK); P.px(bx + 14, by + 12, INK); P.hl(bx + 5, by + 9, 4, PB);
  P.darken(bx + 1, by + bh, bw, 1, 0.8);
}

// ---------- utlämningshyllan ----------
function paintShelf(P) {
  const { x0, x1, top, row0, rowH, rows: nr } = SHELF, w = x1 - x0;
  // skylt HÄMTAS på toppen
  const tw = textW(SMALL, 'HÄMTAS');
  area(P, x0 + 2, top, w - 4, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === w - 5 || j === 8 ? 0x0e2a5e : j === 1 ? 0x4a7ad8 : 0x2a5cb4));
  text(P, SMALL, 'HÄMTAS', x0 + ((w - tw) >> 1), top + 2, PY);
  // stommen: grå stålhylla med gavlar
  const yb = row0 + nr * rowH;
  area(P, x0, row0 - 2, w, yb - row0 + 2 + 12, (X, Y, i, j) => {
    const y = Y;
    if (i < 2 || i >= w - 2) return i === 0 ? 0xc8d0d8 : i === 1 ? 0x9aa2ac : i === w - 2 ? 0x7a828c : 0x4a525c;
    if (y >= yb) {                                          // sockel ända ner till golvet
      if (y === yb) return 0xd8dce2;
      return jit(qmix(0x8a929c, 0x5a626c, (y - yb) / 12, X, Y, 2), X, Y, 72, 0.03);
    }
    const ry = (y - row0 + 2) % rowH;
    if (ry === 0) return 0xe0e4ea;                          // hyllplanets framkant
    if (ry === 1) return 0x8a929c;
    // fackens insida: mörk bakvägg med gavlar mellan kolumnerna
    const ci = (i - 2) % 12;
    if (ci === 11) return 0x6a727c;
    return qmix(0x3a3e46, 0x2a2d33, ry / rowH, X, Y, 2);
  });
  P.darken(x0 - 2, row0, 2, yb - row0 + 12, 0.85);
}

// ---------- kundsidan: vägg, UTLÄMNING, nummerlapp, kö-skärm, frimärksautomat ----------
function paintShop(P) {
  // mellanväggens kant
  area(P, 288, 17, 3, COUNTER.bot - 17, (X, Y, i) => [0xe8ecf0, 0xb8c0c8, 0x7a828c][i]);
  // varm gul vägg med tapetrand
  area(P, 291, 20, FW - 291, COUNTER.top - 20, (X, Y, i, j) => {
    let c = qmix(0xf6e8c0, 0xe6d2a0, j / 50, X, Y, 3);
    if (i % 12 === 6) c = mul(c, 0.95); else if (i % 12 === 7) c = mix(c, WHITE, 0.2);
    if (j >= 42 && j < 45) c = [0x3a6ac8, PB, 0x163a78][j - 42];
    if (j >= 45) c = qmix(0xc8b890, 0xb0a078, (j - 45) / 8, X, Y, 2);
    return jit(c, X, Y, 73, 0.03);
  });
  // UTLÄMNING: blå skylt monterad i taket, tätt under HUD:en (rad 0–17) så att
  // kundernas pratbubblor (topp y 28) och puffarna går fria under den
  const s = 'UTLÄMNING', tw = textW(SMALL, s), w = tw + 10, x = 336 - (w >> 1), y = 18;
  area(P, x, y, w, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === w - 1 || j === 8 ? 0x0e2a5e : j === 1 ? 0x4a7ad8 : 0x2a5cb4));
  text(P, SMALL, s, x + 5, y + 2, PY);
  P.darken(x + 1, y + 9, w, 1, 0.85);
  // nummerlappsautomaten (röd) på väggen
  area(P, 293, 38, 9, 13, (X, Y, i, j) => (i === 0 || j === 0 ? 0xff7a6a : i === 8 || j === 12 ? 0x7a1418 : j === 3 ? 0x2a2c32 : 0xd8303a));
  P.rect(295, 41, 5, 1, 0x5aff8a);
  area(P, 295, 51, 5, 4, (X, Y, i, j) => (j === 3 && i % 2 ? null : 0xfbfaf6));
  P.hl(296, 52, 3, 0x9a968e);
  text(P, SMALL, 'NR', 293, 31, 0xa82028);
  // kö-skärmen "NU" (siffrorna ritas levande)
  area(P, 326, 37, 17, 11, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a626c : i === 16 || j === 10 ? 0x0e0f12 : 0x16171a));
  text(P, SMALL, 'NU', 331, 30, PB);
  P.darken(327, 48, 17, 1, 0.85);
  // frimärksautomaten (gul/blå) längst till höger
  area(P, 366, 28, 17, COUNTER.top - 28, (X, Y, i, j) => {
    let c = j < 8 ? (j === 0 ? 0x4a7ad8 : qmix(0x2a5cb4, 0x1f4a98, j / 8, X, Y, 2)) : qmix(0xf8d040, 0xe0a820, (j - 8) / 40, X, Y, 3);
    if (i === 0) c = mix(c, WHITE, 0.2);
    if (i === 16) c = mul(c, 0.7);
    return jit(c, X, Y, 74, 0.03);
  });
  // frimärket i skylten
  area(P, 371, 29, 7, 6, (X, Y, i, j) => (((i === 0 || i === 6 || j === 0 || j === 5) && (i + j) % 2) ? null : (i === 0 || i === 6 || j === 0 || j === 5) ? 0xffffff : 0xd8303a));
  P.px(374, 31, 0xffe27a); P.hl(373, 33, 3, 0xffffff);
  P.rect(369, 38, 11, 7, 0x16171a); P.rect(370, 39, 9, 5, 0x1a4a3a);           // skärm
  P.rect(371, 49, 5, 1, 0x3a2a08);                                              // myntinkast
  knob(P, 377, 50, 1, 0x3ac05a);
  P.rect(369, 55, 11, 4, 0x3a2a08); P.hl(369, 55, 11, 0x8a6a18);               // utmatning
  P.rect(371, 57, 4, 2, 0xfbfaf6);
}

// ---------- golvet: epoxi med fogar, gånglinjer, burarnas platser, vågen ----------
function paintFloor(P) {
  const Y0 = 90;
  area(P, 0, Y0, FW, FH - Y0, (X, Y) => {
    let c = qmix(0x9ea4aa, 0xb0b6bc, (Y - Y0) / 126, X, Y, 3);
    c = mix(c, hash(X >> 3, Y >> 2, 75) > 0.5 ? 0xaab0b6 : 0x989ea4, 0.28);
    if (X % 96 === 48 || Y === 162) c = mul(c, 0.84);
    else if (X % 96 === 49 || Y === 163) c = mix(c, WHITE, 0.1);
    const h = hash(X, Y, 76);
    if (h > 0.975) c = mix(c, WHITE, 0.3); else if (h < 0.025) c = mul(c, 0.86);
    return jit(c, X, Y, 77, 0.03);
  });
  // blanka speglingar av lysrören
  for (const lx of [40, 132, 214]) for (let y = 104; y < 150; y++) {
    const tt = (y - 104) / 46;
    for (let x = lx - 14; x < lx + 14; x++) if (bayer(x, y) < (1 - tt) * 0.5) P.px(x, y, 0xf4faff, 0.12);
  }
  // skugga under bandet/väggen
  [0.55, 0.68, 0.8, 0.9].forEach((f, i) => P.darken(0, Y0 + i, 289, 1, f));
  // lastzon: gul/svart snedrandning framför porten
  area(P, 2, 96, 50, 6, (X, Y) => ((((X - Y) >> 2) & 1) ? mix(0xe8c030, P.get(X, Y), 0.25) : mix(0x2a2a2e, P.get(X, Y), 0.35)));
  // hjulspår (mörka streck) och slitage mot burarna
  for (const cg of CAGES) for (const ox of [4, CAGE.w - 5]) for (let y = 150; y < 166; y++) {
    const x = cg.x0 + ox + Math.round(Math.sin((y + cg.x0) * 0.2) * 1.5);
    if (hash(x, y, 78) > 0.35) P.px(x, y, 0x5a6068, 0.35);
  }
  // gul gånglinje framför burarna
  for (let x = 4; x < FW - 4; x++) for (const y of [162, 163]) {
    const worn = hash(x >> 1, y, 79) > 0.88;
    P.px(x, y, worn ? mix(0xe8c030, P.get(x, y), 0.6) : y === 162 ? 0xf0cc3a : 0xd8b028);
  }
  // burarnas parkeringsrutor i regionens färg
  for (const cg of CAGES) {
    const col = REG[cg.reg].ci, x0 = cg.x0 - 5, x1 = cg.x1 + 4, y0 = 166, y1 = 211;
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if ((x >> 2) % 2 === 0) P.px(x, y, col, 0.85);
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) if ((y >> 2) % 2 === 0) P.px(x, y, col, 0.85);
  }
  // plattformsvågen: rutig stålplatta i golvet
  const { x0: sx, y0: sy, w: sw, h: sh } = SCALE;
  area(P, sx - 1, sy - 1, sw + 2, sh + 2, (X, Y, i, j) => (i === 0 || j === 0 ? 0x4a5058 : i === sw + 1 || j === sh + 1 ? 0xd8dce2 : null));
  area(P, sx, sy, sw, sh, (X, Y, i, j) => {
    let c = qmix(0xb8c0c8, 0x9aa2aa, j / sh, X, Y, 2);
    if ((i + j * 2) % 4 === 0) c = mix(c, WHITE, 0.3);
    else if ((i + j * 2) % 4 === 2) c = mul(c, 0.85);
    return c;
  });
  text(P, SMALL, 'VÅG', sx + 1, sy + sh + 3, 0x6a7078, 0.8);
}

// ---------- rullbandet ----------
const SURF_PERIOD = 12;
function paintBeltSurf() {
  const w = BELT.x1 - BELT.x0 + SURF_PERIOD;
  const P = new Pix(w, BELT.h);
  area(P, 0, 0, w, BELT.h, (X, Y) => {
    const s = X % 6;
    let c = mix(0x3a4038, 0x2c302a, Y / BELT.h);
    if (s === 0) c = mul(c, 0.7);                         // tvärgående räffla
    else if (s === 1) c = mix(c, 0x6a7466, 0.35);
    if (Y === 0) c = mul(c, 0.6);
    else if (Y === BELT.h - 1) c = mul(c, 0.65);
    else if (Y === 1) c = mix(c, WHITE, 0.05);
    if (Y === 7 && s > 1) c = mix(c, 0x1e221c, 0.3);      // skarven på mitten
    if (hash(X % SURF_PERIOD, Y, 80) > 0.93) c = mix(c, 0x6a7466, 0.3);
    return c;
  });
  return P.flush();
}
function paintBeltFrame() {
  const P = new Pix(FW, FH);
  const { x0, x1 } = BELT;
  // bakre räcket
  rows(P, x0, BELT.rail, x1 - x0, [0xeef2f6, 0xb8c0c8, 0x7a828c]);
  for (let x = x0 + 6; x < x1; x += 32) P.px(x, BELT.rail + 1, 0x5a626c);
  // sidoplåten: postblå med gul varningsrand och bultar
  area(P, x0, 78, x1 - x0, 7, (X, Y, i, j) => {
    let c = [0x6a9ae8, 0x3a6ac8, 0x2a5cb4, PY, 0xd6a41e, 0x2a5cb4, 0x163a78][j];
    if (j >= 3 && j <= 4 && ((X >> 2) & 1)) c = j === 3 ? 0x2a2a2e : 0x1a1a1e;
    if ((X - x0) % 53 === 52) c = mul(c, 0.7);
    return jit(c, X, Y, 81, 0.03);
  });
  for (let x = x0 + 4; x < x1; x += 13) P.px(x, 80, 0xa8c0f0);
  // undersidan: mörkt, returbandet och ben
  area(P, x0, 85, x1 - x0, 5, (X, Y, i, j) => [0x2a2c32, 0x1c1e22, 0x3a3e46, 0x16171a, 0x1c1e22][j]);
  for (let x = x0 + 22; x < x1 - 4; x += 48) {
    vcols(P, x, 85, 7, [0xb8c0c8, 0x7a828c, 0x3a414a]);
    rows(P, x - 1, 91, 5, [0x5a626c]);
  }
  // ändrullarna (rundade kåpor)
  for (const [ex, dir] of [[x0 - 3, 1], [x1, -1]]) {
    area(P, ex, BELT.top - 1, 4, 22, (X, Y, i, j) => {
      const ii = dir > 0 ? i : 3 - i;
      if (ii === 0 && (j < 2 || j > 19)) return null;
      return ii === 0 ? 0x5a626c : j < 16 ? [0xc8d0d8, 0xe0e6ec, 0x9aa2ac, 0x6a727c][ii] : [0x3a6ac8, 0x2a5cb4, 0x1f4a98, 0x163a78][ii];
    });
  }
  // nödstopp vid starten och vid skannern
  for (const nx of [46, 196]) {
    P.rect(nx, 79, 7, 5, 0xf0c020); P.hl(nx, 79, 7, 0xffe070); P.hl(nx, 83, 7, 0xa88010);
    knob(P, nx + 3, 81, 1, 0xe8303a);
  }
  // rutschkanan ner till RETUR-lådan
  for (let j = 0; j < 12; j++) {
    const y = BELT.top + 1 + j, xa = x1 + 3 + (j >> 1);
    P.hl(xa, y, 12 - (j >> 2), j < 2 ? 0xd8dce2 : mix(0xa8b0b8, 0x7a828c, j / 12));
  }
  return P.flush();
}
// framför föremålen: RETUR-lådans framsida
function paintFront() {
  const P = new Pix(FW, FH);
  const { x0, x1, rim, front, bot } = BIN, w = x1 - x0;
  P.ell((x0 + x1) / 2, bot, 14, 2.5, 0x1a1418, 0.45, 3);
  rows(P, x0, rim, w, [0x6a9ae8, 0x3a6ac8]);
  area(P, x0, front, w, bot - front, (X, Y, i, j) => {
    let c = qmix(0x2a6ad0, 0x1f4aa0, j / (bot - front), X, Y, 3);
    if (i === 0) c = mix(c, WHITE, 0.2);
    if (i === w - 1) c = mul(c, 0.7);
    if (j === bot - front - 1) c = mul(c, 0.6);
    if ((i === 3 || i === w - 4) && j > 1) c = mul(c, 0.85);
    return jit(c, X, Y, 82, 0.03);
  });
  area(P, x0, rim + 2, w, 2, (X, Y, i, j) => (j === 0 ? 0x16306a : 0x2a5cb4));
  const tw = textW(SMALL, 'RETUR');
  text(P, SMALL, 'RETUR', x0 + ((w - tw) >> 1), front + 5, WHITE);
  return P.flush();
}
// disken (ritas över kunderna): laminatskiva, blå front med posthorn, våg, ringklocka
function paintCounter() {
  const P = new Pix(FW, FH);
  const x0 = COUNTER.x0, w = FW - x0, top = COUNTER.top, fr = COUNTER.front, bot = COUNTER.bot;
  rows(P, x0, top, w, [0xfff4dc, 0xeadbb8, 0xe0cfa8, 0xd4c094, 0xa88c5c]);
  area(P, x0, fr, w, bot - fr, (X, Y, i, j) => {
    if (j === 0) return 0x0e2a5e;
    let c = qmix(0x2a5cb8, 0x1f4a96, j / (bot - fr), X, Y, 3);
    if (j === 5) c = 0xffe98a; else if (j === 6) c = PY; else if (j === 7) c = 0xd6a41e;
    if (j >= bot - fr - 2) c = j === bot - fr - 2 ? 0x16306a : 0x0e1e44;
    if (i % 32 === 0) c = mul(c, 0.78); else if (i % 32 === 1 && j !== 6) c = mix(c, WHITE, 0.1);
    return jit(c, X, Y, 83, 0.03);
  });
  P.vl(x0, top, bot - top, 0xe8ecf0);
  // posthornet på fronten
  hornBadge(P, 304, 88);
  // vågen på disken: plattform + display (siffrorna ritas levande)
  area(P, 326, top - 4, 18, 4, (X, Y, i, j) => (j === 0 ? 0xeef2f6 : j === 3 ? 0x6a727c : (i + j) % 3 === 0 ? 0xc8d0d8 : 0xb0b8c0));
  area(P, 327, fr + 9, 17, 7, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a626c : i === 16 || j === 6 ? 0x0e0f12 : 0x16171a));
  text(P, SMALL, 'KG', 346, fr + 10, 0xa8c0f0);
  // ringklocka + kortterminal
  for (let y = 0; y < 4; y++) for (let x = -3; x <= 3; x++) if (Math.abs(x) <= y + 0.5 + (y > 1 ? 1 : 0)) P.px(300 + x, top - 4 + y, y === 3 ? 0x8a929c : x < 0 ? 0xf0f4f8 : 0xc0c8d0);
  P.px(300, top - 5, 0x5a626c);
  area(P, 372, top - 6, 7, 6, (X, Y, i, j) => (j === 0 ? 0x5a626c : j < 3 && i > 0 && i < 6 ? 0x1a4a3a : 0x2a2c32));
  return P.flush();
}
// vågens pelare med display (drawable – man kan gå bakom/framför)
let SCALE_POST = null;
function scalePost() {
  if (SCALE_POST) return SCALE_POST;
  const P = new Pix(20, 34);          // (0,0) = (SCALE.dispX - 2, SCALE.dispY - 2)
  P.ell(8, 31, 5, 1.6, 0x1a1418, 0.4, 3);
  vcols(P, 7, 10, 21, [0xd8dce2, 0x9aa2ac, 0x5a626c]);
  area(P, 1, 2, 18, 10, (X, Y, i, j) => (i === 0 || j === 0 ? 0x9aa2ac : i === 17 || j === 9 ? 0x2a2c32 : j < 2 || i < 2 || i > 15 || j > 7 ? 0x5a626c : 0x16171a));
  outline(P);
  SCALE_POST = P.flush();
  return SCALE_POST;
}
// backar och en postsäck i hörnet nere till höger
let CORNER = null;
function cornerArt() {
  if (CORNER) return CORNER;
  const P = new Pix(44, 52);          // (0,0) = (340, 160)
  P.ell(22, 47, 20, 3, 0x1a1418, 0.45, 3);
  for (let k = 0; k < 4; k++) {
    const y = 38 - k * 8, x = 3 + (k === 3 ? 1 : 0);
    area(P, x, y, 22, 8, (X, Y, i, j) => {
      let c = j === 0 ? 0xffe98a : qmix(PY, 0xd6a41e, j / 8, X, Y, 2);
      if (i === 0) c = mix(c, WHITE, 0.12);
      if (i === 21) c = mul(c, 0.72);
      if (j === 7) c = mul(c, 0.7);
      if (j >= 2 && j <= 3 && i >= 8 && i <= 13) c = 0x5a4410;
      return c;
    });
  }
  // postsäcken
  area(P, 26, 22, 16, 25, (X, Y, i, j) => {
    const r = j < 5 ? Math.abs(i - 7.5) > 2 + j : Math.abs(i - 7.5) > 7.5 - (j > 21 ? j - 21 : 0);
    if (r) return null;
    let c = qmix(0xa8aeb4, 0x6a7078, i / 16 + j / 60, X, Y, 3);
    if (j >= 12 && j <= 14) c = j === 13 ? PY : 0xd6a41e;
    if (j < 5 && i % 2) c = mul(c, 0.85);
    return c;
  });
  P.rect(33, 29, 5, 6, 0xfbfaf6); P.px(35, 28, 0x5a626c); P.hl(34, 31, 3, 0x6a6660);
  outline(P);
  CORNER = P.flush();
  return CORNER;
}

// personalen i postens kläder
const LOADER = {
  skin: '#c68a5c', hair: '#1d1714', style: 'short', hat: 'cap', cap: '#1f4f9e', top: 'jacket', shirt: '#f2c12e', accent: '#1f4f9e',
  bottom: 'pants', pants: '#1f2a44', shoes: '#1c1c1c', glasses: false, beard: 'stubble', build: 5, bag: null,
};
const SORTER = {
  skin: '#eec3a0', hair: '#b7392b', style: 'ponytail', hat: null, top: 'polo', shirt: '#1f4f9e', accent: '#f2c12e',
  bottom: 'pants', pants: '#1f2a44', shoes: '#1c1c1c', glasses: 'round', beard: false, build: 5, bag: null,
};

// ======================= cachen =======================
let ART = null;
function art() {
  if (!ART) ART = { hall: paintHall(), surf: paintBeltSurf(), belt: paintBeltFrame(), front: paintFront(), counter: paintCounter() };
  return ART;
}

// Pratbubbla med rundade hörn och spets nedåt i (cx, tip) – samma som Burgarbaren
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
// avin (gul lapp med paketnumret) i kundens bubbla
function drawAvi(ctx, ix, iy, num) {
  ctx.fillStyle = '#8a6a18'; ctx.fillRect(ix + 1, iy + 1, 16, 13);
  ctx.fillStyle = '#ffe27a'; ctx.fillRect(ix + 2, iy + 2, 14, 11);
  ctx.fillStyle = '#fff4c0'; ctx.fillRect(ix + 2, iy + 2, 14, 1);
  ctx.fillStyle = '#1f4f9e'; ctx.fillRect(ix + 2, iy + 3, 3, 3);
  ctxText(ctx, BIG, String(num), ix + 5, iy + 4, '#1c1a22');
}

export function makeJobbPosten(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0, sorterat: 0, kunder: 0, omtaliga: 0, krasch: 0 };
  const G = art();
  const walker = createWalker({ top: WALK_TOP, bottom: WALK_BOT, spawn: [150, 118] });
  walker.setObstacles([[SCALE.colX + 5, SCALE.y0 + 1, SCALE.colX + 9, SCALE.y0 + 7]]);
  const pops = makePops();
  const startMin = A.game?.min ?? 12 * 60;
  let items = [], falling = [], flying = [], shards = [], dust = [];
  const loads = CAGES.map(() => []);
  let t = 0, clk = 0, animT = 0, seq = 0, spawnIn = 1.4, custIn = 3.2, carry = null;
  let done = false, doneT = 0, reported = false;
  let run = false, shake = 0, warned = false, lastDown = { t: -9, x: 0, y: 0 }, dustIn = 0;
  let scan = null, scanFlash = 0, binPile = [];
  let queueNo = 37 + ((Math.random() * 40) | 0);
  let nextItem = makeItem();
  const loader = { x: 22, dir: 'down', walking: false };
  const sorter = { turn: 0, reach: 0 };
  let counterShow = null;   // { kg, t } när ett paket ligger på diskvågen
  // utlämningshyllan: 12 fack, 9 med paket från början
  const shelf = Array.from({ length: SHELF.rows * SHELF.cols }, () => null);
  const usedNums = new Set();
  const newNum = () => { let n; do { n = 10 + ((Math.random() * 90) | 0); } while (usedNums.has(n)); usedNums.add(n); return n; };
  const newParcel = (pop = 0) => ({ num: newNum(), col: (Math.random() * BOX_COLS.length) | 0, kg: 0.3 + Math.random() * 5.5, pop });
  for (let i = 0; i < shelf.length; i++) if (hash(i, 7, 90) < 0.78) shelf[i] = newParcel();
  let customers = [];

  const beltSpeed = () => 15 + 10 * Math.min(1, t / SHIFT_SECONDS);
  function makeItem(opts = {}) {
    let kind = opts.kind;
    if (!kind) { let r = Math.random(), acc = 0; kind = KIND_IDS.find((k) => (acc += KINDS[k].p) >= r) || 'paketS'; }
    const reg = opts.reg ?? (Math.random() < 0.14 ? 4 : (Math.random() * 4) | 0);
    const K = KINDS[kind], place = REG[reg].places[(Math.random() * REG[reg].places.length) | 0];
    const it = { id: seq++, kind, reg, v: (Math.random() * 3) | 0, fragile: !!K.fragile, place, kg: K.kg[0] + Math.random() * (K.kg[1] - K.kg[0]), x: SPAWN_X, scanned: false };
    it.spr = itemSprite(it);
    return it;
  }
  const cellXY = (i) => { const c = i % SHELF.cols, r = (i / SHELF.cols) | 0; return { cx: SHELF.x0 + 2 + c * 12 + 5, bot: SHELF.row0 + (r + 1) * SHELF.rowH - 1 }; };
  const wanted = () => new Set(customers.filter((k) => k.state !== 'leave').map((k) => k.num));
  function freeSlot() { return SLOTS.findIndex((sx) => !customers.some((k) => k.slot === sx && k.state !== 'leave')); }
  function addCustomer(instant) {
    const si = freeSlot();
    if (si < 0) return null;
    const want = wanted(), pool = shelf.filter((s) => s && !want.has(s.num));
    if (!pool.length) return null;
    const num = pool[(Math.random() * pool.length) | 0].num;
    const k = { look: makeLook(), slot: SLOTS[si], num, x: instant ? SLOTS[si] : FW + 12, y: CUST_Y, state: instant ? 'wait' : 'walk', patience: 30, pmax: 30, id: seq++, dir: 'left', take: 0, parcel: null };
    customers.push(k);
    if (instant) queueNo++;
    return k;
  }
  function custLeave(k, happy) {
    k.state = 'leave'; k.dir = 'right';
    if (!happy) { stats.miss++; play('miss'); pops.add(k.x, POP_BUBBLE, 'GICK HEM...', '#d8d2c0'); }   // '…' finns inte i typsnittet
  }
  function pickFromBelt(it) {
    const i = items.indexOf(it);
    if (i < 0) return false;
    items.splice(i, 1);
    if (carry && carry.src === 'belt') {      // byt: det jag bär läggs på bandet där det nya låg
      const old = carry.item; old.x = it.x; items.push(old); items.sort((a, b) => a.x - b.x);
      play('click');
    } else play('ok');
    carry = { src: 'belt', item: it };
    shake = 0; warned = false;
    return true;
  }
  // lägg försändelsen i en bur (rätt eller fel region)
  function dropInCage(ci) {
    const it = carry.item, cg = CAGES[ci], right = it.reg === cg.reg;
    if (right) {
      stats.ok++; stats.sorterat++;
      if (it.fragile) stats.omtaliga++;
      play('coin');
      pops.add(cg.cx, 144, it.fragile ? 'HELT! BRA!' : 'RÄTT BUR!', '#8ee03c');
    } else {
      stats.fel++;
      play('fel');
      pops.add(cg.cx, 144, 'FEL BUR!', '#ff6a6a');
    }
    // kasta i (ömtåligt läggs försiktigt)
    const L = loads[ci], k = Math.min(LOAD_MAX - 1, L.length + flying.filter((f) => f.ci === ci).length);
    const sp = loadSpot(ci, k);
    flying.push({ it, ci, x0: walker.px, y0: walker.py - 16, x1: sp.x, y1: sp.y, t: 0, dur: it.fragile ? 0.5 : 0.32, arc: it.fragile ? 4 : 14 });
    carry = null; shake = 0;
  }
  function crash() {
    if (!carry || carry.src !== 'belt') return;
    stats.fel++; stats.krasch++;
    play('fel');
    pops.add(walker.px, walker.py - 58, 'KRASCH!', '#ff6a6a');
    for (let k = 0; k < 14; k++) shards.push({ x: walker.px + (Math.random() - 0.5) * 6, y: walker.py - 14, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, fy: walker.py + (Math.random() - 0.3) * 6, life: 3 + Math.random(), c: ['#e8f4ff', '#bfe0f0', '#ffffff', '#c4955a'][k % 4] });
    carry = null; shake = 0; run = false; walker.speed = WALK_SPEED;
  }
  function serveTo(k, forceWrong = false) {
    if (!carry || carry.src !== 'shelf' || k.state !== 'wait') return;
    if (!forceWrong && carry.num === k.num) {
      stats.ok++; stats.kunder++;
      play('coin');
      pops.add(k.x, POP_FREE, 'TACK!', '#8ee03c');
      k.state = 'take'; k.take = 0.9; k.parcel = { num: carry.num, col: carry.col, kg: carry.kg };
      counterShow = { kg: carry.kg, t: 1.6 };
      usedNums.delete(carry.num);
      carry = null;
    } else {
      stats.fel++;
      play('fel');
      pops.add(k.x, POP_BUBBLE, 'FEL PAKET!', '#ff6a6a');
      k.patience = Math.max(2, k.patience - 5);
    }
  }
  function setRun(on) { run = !!on; walker.speed = run ? RUN_SPEED : WALK_SPEED; }

  return {
    _debug: {
      stats,
      // lägg en försändelse mitt på bandet: region 0–4 (VÄSTER, NORR, SÖDER, ÖSTER, UTRIKES), kind se KINDS
      forceItem(reg, kind, x = 120) { const it = makeItem({ reg, kind }); it.x = x; items.push(it); items.sort((a, b) => a.x - b.x); return { reg: it.reg, kind: it.kind, fragile: it.fragile }; },
      // hoppa fram i passet (sekunder) – för att testa slutet
      skip(s) { t = Math.min(SHIFT_SECONDS - 0.05, t + s); return t; },
      items: () => items.map((it) => ({ reg: it.reg, kind: it.kind, x: Math.round(it.x), fragile: it.fragile })),
      pickItem(i = 0) { const it = items[i]; if (!it) return null; carry = null; pickFromBelt(it); return { reg: it.reg, kind: it.kind, fragile: it.fragile }; },
      // lägg en ny försändelse direkt i händerna (som forcePlate + pickPlate i burgarbaren)
      forcePick(reg = 0, kind = 'paketS') { const it = makeItem({ reg, kind }); carry = { src: 'belt', item: it }; shake = 0; warned = false; return { reg: it.reg, kind: it.kind, fragile: it.fragile }; },
      // sortera det jag bär: rätt = i regionens bur, fel = i buren bredvid
      sort(right = true) { if (!carry || carry.src !== 'belt') return null; const r = carry.item.reg; dropInCage(right ? r : (r + 1) % CAGES.length); return stats; },
      // en väntande kund vid disken (ställer sig direkt; är platserna tagna används en som redan står där)
      forceCustomer() {
        let k = addCustomer(true);
        if (!k) { k = customers.find((c) => c.state === 'walk'); if (k) { k.x = k.slot; k.state = 'wait'; k.dir = 'down'; queueNo++; } }
        if (!k) k = customers.find((c) => c.state === 'wait');
        return k ? k.num : null;
      },
      shelf: () => shelf.map((s) => (s ? s.num : null)),
      customers: () => customers.map((k) => ({ num: k.num, state: k.state, x: Math.round(k.x) })),
      // plocka paketet med numret num från hyllan (utan num: första väntande kundens nummer)
      pickShelf(num) {
        if (num === undefined) num = customers.find((k) => k.state === 'wait')?.num;
        const i = shelf.findIndex((s) => s && s.num === num);
        if (i < 0) return null;
        if (carry && carry.src === 'shelf' && !shelf[carry.cell]) shelf[carry.cell] = { num: carry.num, col: carry.col, kg: carry.kg, pop: 0 };
        carry = { src: 'shelf', ...shelf[i], cell: i }; shelf[i] = null;
        return num;
      },
      serve(right = true) {
        if (!carry || carry.src !== 'shelf') return null;
        const w = customers.filter((k) => k.state === 'wait');
        const k = right ? w.find((c) => c.num === carry.num) : (w.find((c) => c.num !== carry.num) || w[0]);
        if (!k) return null;
        serveTo(k, !right);
        return stats;
      },
      crash() { if (!carry || carry.src !== 'belt') return null; crash(); return stats; },
      // en väntande kund tröttnar och går hem (utan num: första väntande): stats.miss +1
      giveUp(num) {
        const k = customers.find((c) => c.state === 'wait' && (num === undefined || c.num === num));
        if (!k) return null;
        custLeave(k, false);
        return stats;
      },
      setRun,
      carrying: () => (carry ? (carry.src === 'belt' ? { src: 'belt', reg: carry.item.reg, kind: carry.item.kind, fragile: carry.item.fragile } : { src: 'shelf', num: carry.num }) : null),
      teleport(x, y) { walker.px = x; walker.py = y; walker.stop(); },
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      clk += dt;
      pops.update(dt);
      animT += dt * (run && walker.path.length ? 1.7 : 1);
      updateFx(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      const moving = walker.update(dt);
      if (!walker.path.length && run) setRun(false);
      // spring med ömtåligt → det skakar sönder
      if (carry && carry.src === 'belt' && carry.item.fragile && run && moving) {
        shake += dt * 1.4;
        if (shake > 0.3 && !warned) { warned = true; play('miss'); pops.add(walker.px, walker.py - 58, 'FÖRSIKTIGT!', '#ffd23f'); }
        if (shake >= 1) crash();
      } else shake = Math.max(0, shake - dt * 0.7);
      if (run && moving) {
        dustIn -= dt;
        if (dustIn <= 0) { dustIn = 0.07; dust.push({ x: walker.px + (Math.random() - 0.5) * 4, y: walker.py, age: 0 }); }
      }
      // bandet: kollegan lastar ur bilen och lägger på bandet
      spawnIn -= dt;
      if (spawnIn <= 0) {
        if (items.some((it) => it.x < SPAWN_X + 22)) spawnIn = 0.25;
        else {
          items.unshift(nextItem);
          nextItem = makeItem();
          spawnIn = 3.3 - 1.1 * Math.min(1, t / SHIFT_SECONDS) + Math.random() * 0.7;
        }
      }
      const sp = beltSpeed() * dt;
      for (const it of items) {
        const was = it.x;
        it.x += sp;
        if (was < SCAN_X && it.x >= SCAN_X) { scan = { it, t: 2.2 }; scanFlash = 0.25; }
      }
      for (let i = items.length - 1; i >= 0; i--) if (items[i].x > BELT.x1 + 2) {
        const it = items.splice(i, 1)[0];
        falling.push({ it, x: it.x, y: BELT.foot, vy: 10, vx: 14, rot: 0 });
        stats.miss++;
        play('miss');
        pops.add(BIN.x0 + 12, 58, it.fragile ? 'KRASCH!' : 'RETUR!', it.fragile ? '#ff6a6a' : '#d8d2c0');
      }
      // kunder vid utlämningen
      custIn -= dt;
      if (custIn <= 0) {
        custIn = 12 - 3 * Math.min(1, t / SHIFT_SECONDS) + Math.random() * 4;
        if (addCustomer(false)) play('door');
      }
      for (const k of customers) {
        if (k.state === 'walk') {
          const d = k.slot - k.x, st = 36 * dt;
          if (Math.abs(d) <= st) { k.x = k.slot; k.state = 'wait'; k.dir = 'down'; queueNo++; play('click'); }
          else k.x += Math.sign(d) * st;
        } else if (k.state === 'wait') {
          k.patience -= dt;
          if (k.patience <= 0) custLeave(k, false);
        } else if (k.state === 'take') {
          k.take -= dt;
          if (k.take <= 0) custLeave(k, true);
        } else if (k.state === 'leave') k.x += 40 * dt;
      }
      customers = customers.filter((k) => k.x < FW + 16);
      // tomma fack fylls på efter en stund
      for (let i = 0; i < shelf.length; i++) {
        if (shelf[i]) { if (shelf[i].pop > 0) shelf[i].pop -= dt; continue; }
        if (carry && carry.src === 'shelf' && carry.cell === i) continue;
        shelf.refill ||= {};
        shelf.refill[i] = (shelf.refill[i] ?? 6 + Math.random() * 6) - dt;
        if (shelf.refill[i] <= 0) { delete shelf.refill[i]; shelf[i] = newParcel(0.5); }
      }
    },
    down(x, y) {
      if (done) return;
      const dbl = clk - lastDown.t < 0.38 && Math.hypot(x - lastDown.x, y - lastDown.y) < 16;
      lastDown = { t: clk, x, y };
      setRun(dbl);
      if (dbl && carry && carry.src === 'belt' && carry.item.fragile) pops.add(walker.px, walker.py - 58, 'SPRING INTE!', '#ffd23f');
      // bandet: plocka (eller byt mot det jag bär)
      if (y >= 50 && y < WALK_TOP && x >= BELT.x0 && x <= BELT.x1 + 4) {
        let best = null, bd = 1e9;
        for (const it of items) { const d = Math.abs(it.x - x); if (d < it.spr.w / 2 + 5 && d < bd) { best = it; bd = d; } }
        if (best) {
          if (carry && carry.src === 'shelf') { pops.add(walker.px, walker.py - 58, 'HÄNDERNA FULLA!', '#d8d2c0'); return; }
          const target = best;
          const eta = Math.hypot(target.x - walker.px, WALK_TOP + 1 - walker.py) / walker.speed;
          const px = clamp(target.x + beltSpeed() * eta * 0.95, BELT.x0 + 6, BELT.x1 - 2);
          walker.walkTo(px, WALK_TOP + 1, () => {
            if (items.includes(target) && Math.abs(target.x - walker.px) < 18) pickFromBelt(target);
            else { play('miss'); pops.add(walker.px, walker.py - 58, 'MISSADE!', '#d8d2c0'); }
          });
          return;
        }
      }
      // hyllan: ta ett paket (eller ställ tillbaka)
      if (x >= SHELF.x0 - 2 && x < SHELF.x1 + 1 && y >= SHELF.top && y < WALK_TOP) {
        let bi = -1, bd = 1e9;
        for (let i = 0; i < shelf.length; i++) {
          const { cx, bot } = cellXY(i), d = Math.hypot(cx - x, (bot - 5 - y) * 0.8);
          if (d < bd) { bd = d; bi = i; }
        }
        const cell = cellXY(bi);
        walker.walkTo(clamp(cell.cx, SHELF.x0 + 4, SHELF.x1 - 4), WALK_TOP + 1, () => {
          const s = shelf[bi];
          if (!carry && s) { carry = { src: 'shelf', ...s, cell: bi }; shelf[bi] = null; play('ok'); }
          else if (carry && carry.src === 'shelf' && !s) { shelf[bi] = { num: carry.num, col: carry.col, kg: carry.kg, pop: 0 }; carry = null; play('click'); }
          else if (carry && carry.src === 'shelf' && s) {   // byt: ställ in det jag bär, ta det andra
            shelf[bi] = { num: carry.num, col: carry.col, kg: carry.kg, pop: 0 };
            carry = { src: 'shelf', ...s, cell: bi };
            play('click');
          }
          else if (carry && carry.src === 'belt') pops.add(walker.px, walker.py - 58, 'HÄNDERNA FULLA!', '#d8d2c0');
        });
        return;
      }
      // kunden vid disken
      if (x >= COUNTER.x0 && y >= 24 && y < WALK_TOP + 2) {
        let k = null, bd = 1e9;
        for (const c of customers) { if (c.state !== 'wait') continue; const d = Math.abs(c.x - x); if (d < 22 && d < bd) { k = c; bd = d; } }
        if (k) {
          const kk = k;
          walker.walkTo(kk.x, WALK_TOP + 1, () => {
            if (!carry) pops.add(kk.x, POP_BUBBLE, 'NR ' + kk.num + ' TACK!', '#f4f1ea');
            else if (carry.src === 'belt') pops.add(walker.px, walker.py - 58, 'SKA SORTERAS!', '#d8d2c0');
            else serveTo(kk);
          });
          return;
        }
      }
      // burarna
      const cg = CAGES.find((c) => x >= c.x0 - 4 && x <= c.x1 + 4 && y >= 150);
      if (cg) {
        walker.walkTo(cg.cx, WALK_BOT, () => {
          if (!carry) return;
          if (carry.src === 'shelf') { pops.add(cg.cx, 144, 'SKA TILL KUND!', '#d8d2c0'); return; }
          dropInCage(CAGES.indexOf(cg));
        });
        return;
      }
      walker.walkTo(x, y);
    },
    key(k) {
      if (k === 'Escape' && !done) abortShift(A);
      else if (k === ' ' && !done && walker.path.length) setRun(!run);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(G.hall, 0, 0);
      drawLive(ctx);
      drawLoader(ctx);
      drawSorter(ctx);
      drawBelt(ctx);
      for (const it of items) ctx.drawImage(it.spr.c, Math.round(it.x) - (it.spr.w >> 1), BELT.foot - it.spr.h + 1);
      drawLaser(ctx);
      for (const f of falling) {
        ctx.save(); ctx.beginPath(); ctx.rect(BELT.x1 - 12, 0, 60, BIN.front); ctx.clip();
        ctx.drawImage(f.it.spr.c, Math.round(f.x) - (f.it.spr.w >> 1), Math.round(f.y) - f.it.spr.h + 1);
        ctx.restore();
      }
      drawBinPile(ctx);
      ctx.drawImage(G.front, 0, 0);
      drawShelfParcels(ctx);
      drawCustomers(ctx);
      ctx.drawImage(G.counter, 0, 0);
      drawCounterLive(ctx);
      // golvet: glasskärvor och damm
      for (const s of shards) if (s.landed) { ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x), Math.round(s.fy), 1, 1); }
      for (const d of dust) { const a = 1 - d.age / 0.45; ctx.fillStyle = `rgba(200,196,186,${(0.55 * a).toFixed(2)})`; const r = d.age > 0.2 ? 2 : 1; ctx.fillRect(Math.round(d.x) - (r >> 1), Math.round(d.y - d.age * 8) - 1, r, r); }
      const drawables = [...folkDrawables(A, animT), selfDrawable(A, walker, animT, { carry: !!carry })];
      if (carry) drawables.push(carryDrawable());
      for (let i = 0; i < CAGES.length; i++) drawables.push(cageDrawable(i));
      drawables.push({ fy: SCALE.y0 + 6, draw: () => drawScalePost(ctx) });
      drawables.push({ fy: 206, draw: () => ctx.drawImage(cornerArt(), 340, 160) });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // flygande försändelser (på väg ner i buren)
      for (const f of flying) {
        const p = Math.min(1, f.t / f.dur), x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * f.arc;
        const m = miniSprite(f.it);
        if (p < 0.5) ctx.drawImage(f.it.spr.c, Math.round(x) - (f.it.spr.w >> 1), Math.round(y) - f.it.spr.h + 1);
        else ctx.drawImage(m, Math.round(x), Math.round(y) - m.height + 1);
      }
      for (const s of shards) if (!s.landed) { ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
      drawBubbles(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'POSTEN' });
      if (t < 7 && !done) drawHint(ctx);
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  // ---------- levande effekter ----------
  function updateFx(dt) {
    if (scan) { scan.t -= dt; if (scan.t <= 0) scan = null; }
    if (scanFlash > 0) scanFlash -= dt;
    if (counterShow) { counterShow.t -= dt; if (counterShow.t <= 0) counterShow = null; }
    for (const d of dust) d.age += dt;
    dust = dust.filter((d) => d.age < 0.45);
    for (const s of shards) {
      s.life -= dt;
      if (!s.landed) { s.vy += 260 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.y >= s.fy) { s.y = s.fy; s.landed = true; } }
    }
    shards = shards.filter((s) => s.life > 0);
    for (const f of falling) { f.vy += 200 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    for (let i = falling.length - 1; i >= 0; i--) if (falling[i].y > BIN.front + 16) {
      const it = falling[i].it;
      if (it.fragile) {
        // glaset går sönder i lådan: skärvor yr upp över kanten
        stats.krasch++;
        play('fel');
        for (let k = 0; k < 10; k++) shards.push({ x: BIN.x0 + 6 + Math.random() * 12, y: BIN.rim, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 30, fy: BIN.rim, life: 1.2 + Math.random() * 0.6, c: ['#e8f4ff', '#bfe0f0', '#ffffff', '#c4955a'][k % 4] });
      }
      binPile.push(it);
      if (binPile.length > 4) binPile.shift();
      falling.splice(i, 1);
    }
    for (const f of flying) f.t += dt;
    for (let i = flying.length - 1; i >= 0; i--) if (flying[i].t >= flying[i].dur) {
      const f = flying.splice(i, 1)[0], L = loads[f.ci];
      L.push({ it: f.it, x: f.x1, y: f.y1 });
      if (L.length > LOAD_MAX) { L.shift(); L.forEach((q, n) => { const sp = loadSpot(f.ci, n); q.x = sp.x; q.y = sp.y; }); }
    }
    // kollegan i bilen: går mot bandet med nästa försändelse strax innan den läggs ner
    const target = spawnIn < 1.1 && !done ? SPAWN_X - 6 : 20;
    const d = target - loader.x;
    if (Math.abs(d) < 0.5) { loader.walking = false; loader.dir = 'down'; }
    else { loader.walking = true; loader.x += Math.sign(d) * Math.min(Math.abs(d), 22 * dt); loader.dir = d < 0 ? 'left' : 'right'; }
    // kollegan vid sorteringsfacket
    sorter.reach -= dt;
    if (sorter.reach <= -0.9) sorter.reach = 0.6;
    sorter.turn -= dt;
    if (sorter.turn < -9) sorter.turn = 2;
  }

  function drawLoader(ctx) {
    const holding = spawnIn < 1.1 && !done;
    const f = loader.walking ? (holding ? [7, 9, 8, 9] : WALK_SEQ)[Math.floor(clk * 8.5) % 4] : holding ? 9 : (Math.sin(clk * 1.7) > 0.92 ? 4 : 0);
    const x = Math.round(loader.x), y = 72;
    const behind = loader.dir === 'up';
    const drawIt = () => { if (holding) { const s = nextItem.spr, ox = loader.dir === 'left' ? -6 : loader.dir === 'right' ? 6 : 0; ctx.drawImage(s.c, x + ox - (s.w >> 1), y - 11 - s.h + 1); } };
    if (behind) drawIt();
    drawPerson(ctx, x, y, LOADER, loader.dir, f);
    if (!behind) drawIt();
  }
  function drawSorter(ctx) {
    const facing = sorter.turn > 0 ? 'down' : 'up';
    const f = facing === 'up' && sorter.reach > 0 ? 9 : 0;
    drawPerson(ctx, 206, 74, SORTER, facing, f);
    if (facing === 'up' && sorter.reach > 0) { ctx.fillStyle = '#f6f4ee'; ctx.fillRect(203 + ((clk * 3) | 0) % 3 * 2, 44, 2, 3); }
  }
  function drawBelt(ctx) {
    const off = Math.floor(beltOffset()) % SURF_PERIOD;
    ctx.drawImage(G.surf, SURF_PERIOD - 1 - off, 0, BELT.x1 - BELT.x0, BELT.h, BELT.x0, BELT.top, BELT.x1 - BELT.x0, BELT.h);
    ctx.drawImage(G.belt, 0, 0);
    // rullarna under bandet snurrar
    const ph = Math.floor(beltOffset() / 2) % 4;
    for (let x = BELT.x0 + 6; x < BELT.x1 - 4; x += 16) {
      ctx.fillStyle = '#6a7078'; ctx.fillRect(x, 86, 4, 3);
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x, 86, 4, 1);
      ctx.fillStyle = '#d8dce2'; ctx.fillRect(x + ph, 87, 1, 1);
    }
  }
  function beltOffset() { return t * (15 + 5 * Math.min(1, t / SHIFT_SECONDS)); }
  function drawLaser(ctx) {
    const flick = 0.55 + 0.3 * Math.sin(clk * 40);
    ctx.fillStyle = `rgba(255,60,50,${(0.25 * flick).toFixed(2)})`;
    ctx.fillRect(SCAN_X, 55, 1, BELT.top - 55);
    // linjen över bandet och över det som passerar under
    let topY = BELT.top;
    for (const it of items) if (Math.abs(it.x - SCAN_X) < (it.spr.w >> 1) - 1) topY = Math.min(topY, BELT.foot - it.spr.h + 2);
    ctx.fillStyle = `rgba(255,70,60,${(0.8 * flick).toFixed(2)})`;
    ctx.fillRect(SCAN_X, topY, 1, BELT.top + BELT.h - 1 - topY);
    ctx.fillStyle = 'rgba(255,200,190,0.9)';
    ctx.fillRect(SCAN_X, topY + ((clk * 30) | 0) % Math.max(1, BELT.top + BELT.h - 1 - topY), 1, 1);
  }
  function drawBinPile(ctx) {
    // det som hamnat i RETUR sticker upp över lådans kant (kanten ritas ovanpå)
    binPile.forEach((it, i) => {
      const m = miniSprite(it);
      ctx.drawImage(m, BIN.x0 + 1 + i * 4 + (i > 1 ? 1 : 0), BIN.rim + 3 - m.height - (i % 2));
    });
  }
  function drawShelfParcels(ctx) {
    for (let i = 0; i < shelf.length; i++) {
      const s = shelf[i];
      if (!s) continue;
      const { cx, bot } = cellXY(i), spr = shelfSprite(s.num, s.col);
      const lift = s.pop > 0 ? Math.round(s.pop * 6) : 0;
      ctx.drawImage(spr, cx - 6, bot - spr.height + 1 - lift);
      if (s.pop > 0.2) { ctx.fillStyle = '#fff4c0'; ctx.fillRect(cx - 7, bot - 12, 1, 1); ctx.fillRect(cx + 7, bot - 9, 1, 1); }
    }
  }
  function drawCustomers(ctx) {
    ctx.save(); ctx.beginPath(); ctx.rect(COUNTER.x0 + 2, 0, FW, FH); ctx.clip();
    for (const k of [...customers].sort((a, b) => a.y - b.y)) {
      const moving = k.state === 'walk' || k.state === 'leave';
      const withP = !!k.parcel && k.state === 'leave';
      const frame = moving ? (withP ? [7, 9, 8, 9] : WALK_SEQ)[Math.floor(clk * 8.5 + k.id * 0.37) % 4] : k.state === 'take' ? 9 : (Math.sin(clk * 2 + k.id) > 0.9 ? 4 : 0);
      const y = k.state === 'leave' ? CUST_Y - 1 : CUST_Y;
      drawPerson(ctx, k.x, y, k.look, moving ? k.dir : 'down', frame);
      if (k.parcel && (k.state === 'leave' || k.take < 0.45)) {
        const spr = shelfSprite(k.parcel.num, k.parcel.col);
        ctx.drawImage(spr, Math.round(k.x) + (k.state === 'leave' ? 4 : 0) - 6, y - 12 - spr.height + 1);
      }
    }
    ctx.restore();
    // paketet ligger på diskvågen en kort stund
    for (const k of customers) if (k.state === 'take' && k.take >= 0.45 && k.parcel) {
      const spr = shelfSprite(k.parcel.num, k.parcel.col);
      ctx.drawImage(spr, 329, COUNTER.top - 3 - spr.height);
    }
  }
  function drawCounterLive(ctx) {
    // diskvågens display
    const s = counterShow ? fmtKg(counterShow.kg) : '0,00';
    ctxText(ctx, SMALL, s, 343 - textW(SMALL, s), COUNTER.front + 10, counterShow ? '#ff5a3a' : '#7a2a1a');
    // kö-skärmen
    const q = String(queueNo % 1000).padStart(3, '0');
    ctxText(ctx, SMALL, q, 329, 40, '#ff4a2a');
    // frimärksautomatens skärm blinkar
    if (Math.floor(clk * 1.5) % 2) { ctx.fillStyle = '#5ad0a0'; ctx.fillRect(371, 40, 5, 1); ctx.fillRect(371, 42, 3, 1); }
  }
  function drawLive(ctx) {
    // klockan: passet är fyra timmar
    const m = startMin + (Math.min(t, SHIFT_SECONDS) / SHIFT_SECONDS) * 240;
    const ma = ((m % 60) / 60) * Math.PI * 2, ha = (((m / 60) % 12) / 12) * Math.PI * 2;
    ctx.fillStyle = '#2a2c30';
    pline(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(ha) * 2.6, CLOCK.y - Math.cos(ha) * 2.6);
    ctx.fillStyle = '#4a4e56';
    pline(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(ma) * 4, CLOCK.y - Math.cos(ma) * 4);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(CLOCK.x, CLOCK.y, 1, 1);
    // skannerns skärm: senast lästa lapp, annars KLAR + markör
    ctx.save(); ctx.beginPath(); ctx.rect(156, 24, 28, 12); ctx.clip();
    if (scan) {
      const it = scan.it, R = REG[it.reg];
      ctx.fillStyle = css(R.ci); ctx.fillRect(156, 24, 28, 6);
      const a = it.place[0], b = R.name;
      ctxText(ctx, SMALL, a, 170 - (textW(SMALL, a) >> 1), 25, '#ffffff');
      ctxText(ctx, SMALL, b, 170 - (textW(SMALL, b) >> 1), 31, '#bfe8c8');
    } else {
      ctxText(ctx, SMALL, 'KLAR', 158, 27, '#5ad06a');
      if (Math.floor(clk * 2) % 2 === 0) { ctx.fillStyle = '#5ad06a'; ctx.fillRect(175, 31, 3, 1); }
    }
    ctx.restore();
    // kamerans lampa: grön, blinkar vitt vid läsning
    ctx.fillStyle = scanFlash > 0 ? '#ffffff' : '#5aff8a'; ctx.fillRect(165, 50, 1, 1);
    // postbilens varningsblinkers
    if (Math.floor(clk * 1.6) % 2 === 0) { ctx.fillStyle = '#ffc050'; ctx.fillRect(9, 46, 2, 2); ctx.fillRect(46, 46, 2, 2); }
    // ett lysrör som fladdrar ibland
    const fl = Math.sin(clk * 0.7) > 0.96 && Math.floor(clk * 20) % 3 === 0;
    if (fl) { ctx.fillStyle = 'rgba(20,22,28,0.6)'; ctx.fillRect(200, 20, 28, 1); }
  }
  function drawScalePost(ctx) {
    ctx.drawImage(scalePost(), SCALE.dispX - 2, SCALE.dispY - 2);
    const on = walker.px > SCALE.x0 - 2 && walker.px < SCALE.x0 + SCALE.w + 2 && walker.py > SCALE.y0 - 1 && walker.py < SCALE.y0 + SCALE.h + 3;
    const kg = on ? (carry ? (carry.src === 'belt' ? carry.item.kg : carry.kg ?? 1.2) : 0) : 0;
    const s = on ? fmtKg(kg) : '0,00';
    ctxText(ctx, SMALL, s, SCALE.dispX + 14 - textW(SMALL, s), SCALE.dispY + 2, on ? '#ff5a3a' : '#7a2a1a');
  }
  function cageDrawable(i) {
    const cg = CAGES[i], C = cageArt()[i];
    return {
      fy: CAGE.base,
      draw(ctx) {
        const ox = cg.x0 - CAGE_OX, oy = CAGE_OY;
        ctx.drawImage(C.back, ox, oy);
        for (const q of loads[i]) { const m = miniSprite(q.it); ctx.drawImage(m, q.x, q.y - m.height + 1); }
        ctx.drawImage(C.front, ox, oy);
      },
    };
  }
  function carryDrawable() {
    const dir = walker.dir;
    const ox = dir === 'left' ? -7 : dir === 'right' ? 7 : 0;
    const wob = carry.src === 'belt' && carry.item.fragile && walker.path.length ? Math.round(Math.sin(clk * (run ? 40 : 12)) * (run ? 1.5 : 0.6)) : 0;
    return {
      fy: walker.py + (dir === 'up' ? -0.01 : 0.01),
      draw(ctx) {
        if (carry.src === 'belt') {
          const s = carry.item.spr;
          ctx.drawImage(s.c, Math.round(walker.px) + ox + wob - (s.w >> 1), Math.round(walker.py) - 11 - s.h + 1);
        } else {
          const s = shelfSprite(carry.num, carry.col);
          ctx.drawImage(s, Math.round(walker.px) + ox - 6, Math.round(walker.py) - 11 - s.height + 1);
        }
      },
    };
  }
  function drawBubbles(ctx) {
    // kunderna: avin med paketnumret + tålamod
    for (const k of customers) {
      if (k.state !== 'wait') continue;
      const hot = !!carry && carry.src === 'shelf' && carry.num === k.num;
      const tip = CUST_Y - 35 - (hot && (clk * 4 | 0) % 2 ? 1 : 0);
      const [ix, iy] = bubble(ctx, Math.round(k.x), tip, 18, 19, hot);
      drawAvi(ctx, ix, iy, k.num);
      const left = clamp(k.patience / k.pmax, 0, 1);
      ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 16, 14, 2);
      ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
      ctx.fillRect(ix + 2, iy + 16, Math.max(1, Math.round(14 * left)), 2);
      if (k.patience < 8 && Math.sin(clk * 6) > 0) {
        ctx.fillStyle = '#17151a'; ctx.fillRect(ix + 17, iy - 4, 5, 10);
        ctx.fillStyle = '#d9433b'; ctx.fillRect(ix + 18, iy - 3, 3, 5); ctx.fillRect(ix + 18, iy + 3, 3, 2);
      }
    }
    // det jag bär: adresslappen i stort (inte vid disken där kundernas bubblor sitter)
    if (!carry || (walker.px > SHELF.x0 - 14 && walker.py < 112)) return;
    const cx = Math.round(walker.px), tip = Math.round(walker.py) - 36;
    if (carry.src === 'shelf') {
      const [ix, iy] = bubble(ctx, cx, tip, 18, 14);
      drawAvi(ctx, ix, iy - 1, carry.num);
      return;
    }
    const it = carry.item, R = REG[it.reg], [l1, l2] = it.place;
    const gw = it.fragile ? 8 : 0;
    const iw = Math.max(textW(SMALL, l1), textW(SMALL, l2)) + 6 + gw, ih = it.fragile ? 18 : 15;
    const [ix, iy] = bubble(ctx, cx, tip, iw, ih);
    ctx.fillStyle = css(R.ci); ctx.fillRect(ix + gw, iy, iw - gw, 7);
    ctx.fillStyle = css(mix(R.ci, WHITE, 0.3)); ctx.fillRect(ix + gw, iy, iw - gw, 1);
    ctxText(ctx, SMALL, l1, ix + gw + ((iw - gw - textW(SMALL, l1)) >> 1), iy + 1, '#ffffff');
    ctxText(ctx, SMALL, l2, ix + gw + ((iw - gw - textW(SMALL, l2)) >> 1), iy + 9, '#1c1a22');
    if (it.fragile) {
      ctx.fillStyle = '#c8202a';
      GLASS.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') ctx.fillRect(ix + 1 + i, iy + 3 + j, 1, 1); });
      // skakmätare
      ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 16, iw - 4, 2);
      ctx.fillStyle = shake > 0.6 ? '#d9433b' : shake > 0.25 ? '#f0b429' : '#45b964';
      ctx.fillRect(ix + 2, iy + 16, Math.max(1, Math.round((iw - 4) * (1 - shake))), 2);
    }
  }
  // hjälpraden de första sekunderna: direkt under HUD:en (som pizzerian), centrerad över
  // sorteringshallen så att varken HÄMTAS-hyllan eller burarna skyms; tonar bort sista sekunden
  function drawHint(ctx) {
    const s = 'DUBBELKLICKA = SPRING  -  ÖMTÅLIGT: GÅ LUGNT!';
    const w = textW(SMALL, s) + 8, x = (SHELF.x0 - w) >> 1, y = 18;
    ctx.globalAlpha = t > 6 ? Math.max(0, 7 - t) : 1;
    ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(x, y, w, 10);
    ctxText(ctx, SMALL, s, x + 4, y + 3, '#ffd23f');
    ctx.globalAlpha = 1;
  }
}
