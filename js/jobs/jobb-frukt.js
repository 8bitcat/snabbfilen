// Fruktfabriken – nu jobbar man med kroppen: frukter åker förbi på rullbandet,
// klicka på en frukt så springer figuren dit och plockar den, bär den (riktiga
// bär-frames) till lådan och släpper. Ordersedeln på anslagstavlan visar vad
// lådan behöver – fel frukt i lådan ger avdrag. Full låda = bonus och ny order.
//
// Packhallen ritas på stadens detaljnivå: tegelvägg med industrifönster och
// målad bröstning, rör med ventil och manometer, emaljlampor, fruktvaskare och
// sorteringsmaskin i var sin ände av ett rullband med ram, rullar och drivmotor,
// pallar med lådor, en parkerad truck och en kollega bakom bandet. Allt statiskt
// målas EN gång (cachas per ljusläge) – bara det som rör sig ritas varje bildruta.
// Ett pixelkorn: heltal, skala 1.
import { Pix, SMALL, BIG, ctxText, textW, text, eachTextPixel, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { drawPerson } from '../core/people.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const BELT_Y = 74;             // bandets mitt
const BOX = { x: 290, y: 176, w: 56, h: 26 };
const WHITE = 0xffffff, INK = 0x17151a;

// ---------- hallens mått ----------
const WALL_Y = 20, BAND_Y = 47, PLINTH_Y = 58;   // tegel, målad bröstning, sockel
const RAIL_Y = 62, SURF_Y = 66, SURF_H = 14;      // bakre styrlist, bandytan (66–79)
const FRONT_Y = 80, FRAME_Y = 83, FLOOR_Y = 88;   // främre list, ram, golvet
const WASH = { x0: 3, x1: 30, top: 57 };          // fruktvaskarens utlopp (vänster)
const SORT = { x0: 344, tx0: 350, top: 57 };      // sorteringsmaskinen (höger)
const BOARD = { x: 38, y: 26, w: 150, h: 33 };    // anslagstavlan
const WINS = [206, 282], WIN_Y = 27, WIN_W = 34, WIN_H = 20;
// klockan och högra lampan sitter var för sig mellan fönstren (lampan hänger
// inte längre rakt ovanför klockan)
const CLOCK = { x: 268, y: 35 };
const LAMPS = [116, 250];
const LEGS = [60, 124, 188, 252, 304];
const TRUCK = { x: 12, y: 193 };                  // truckens vänstra kant + markplan
const STACK = { x: 353, y: 204 };                 // pallen med tomma lådor
const EXIT = { x1: 58, y0: 200, wx: 26, wy: 206 }; // UTGÅNG nere till vänster
const BIN = { x: 356, y: 134 }, MOP = { x: 60, y: 124 }, JACK = { x: 150, y: 207 };
const CRATES = { x: 240, y: 198 };                // tomma plastbackar i en stapel
const PSPOT = { x: 150, y: 114, w: 44, h: 28 };   // tejpad pallplats P3 mitt på golvet
const CREW_STOPS = [218, 234, 284, 298, 312];     // kollegans stopp bakom bandet (fria från klockan)
const SURF_PERIOD = 48;

export const FRUITS = [
  { id: 'apple', name: 'ÄPPLE', map: ['...GG...', '....G...', '..RRRR..', '.RWRRRR.', '.RRRRRR.', '.RRRRRR.', '.RRRRR..', '..RRR...'] },
  { id: 'banan', name: 'BANAN', map: ['.....B..', '....YY..', '...YYY..', '..YYY...', '.YYY....', '.YYY....', '.YY.....', '.B......'] },
  { id: 'apelsin', name: 'APELSIN', map: ['...G....', '..OOOO..', '.OOOOOO.', '.OWOOOO.', '.OOOOOO.', '.OOOOOO.', '..OOOO..', '........'] },
  { id: 'paron', name: 'PÄRON', map: ['....G...', '...GG...', '...PP...', '..PPPP..', '..PPPP..', '.PPPPPP.', '.PPPPPP.', '..PPPP..'] },
  { id: 'druvor', name: 'DRUVOR', map: ['....G...', '...GG...', '..V.V...', '.VVVVV..', '.VVVVV..', '..VVV...', '..VVV...', '...V....'] },
];
// frukten som färdig sprite i skala 1, centrerad på (x, y)
export function drawFruit(ctx, f, x, y) {
  ctx.drawImage(fruitSprite(f), Math.round(x) - FC, Math.round(y) - FC);
}
function newOrder(seq) {
  const kinds = [...FRUITS.keys()].sort(() => Math.random() - 0.5).slice(0, 2 + ((hash(seq, 41) * 2) | 0));
  return { need: kinds.map((k) => ({ f: k, n: 1 + ((Math.random() * 3) | 0), got: 0 })) };
}

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
// liten sprite ur teckenrader: tecknet slås upp i pal ('.' = genomskinligt) och
// får en halvgenomskinlig slagskugga ett snäpp ner till höger
function stamp(P, x, y, rs, pal, shadow = 0.3) {
  const on = (i, j) => j >= 0 && j < rs.length && i >= 0 && i < rs[j].length && pal[rs[j][i]] !== undefined;
  if (shadow) for (let j = 0; j <= rs.length; j++) for (let i = 0; i <= rs[0].length; i++) if (!on(i, j) && on(i - 1, j - 1)) P.px(x + i, y + j, 0x1e1a16, shadow);
  for (let j = 0; j < rs.length; j++) for (let i = 0; i < rs[j].length; i++) { const c = pal[rs[j][i]]; if (c !== undefined) P.px(x + i, y + j, c); }
}
// glasreflex: diagonala strimmor och en ljusare överkant
function reflect(P, x, y, w, h, str = 1, seed = 0, tint = 0xeef7ff) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, s = ((((X + seed) * 2 - Y * 3) % 47) + 47) % 47;
    let a = s < 3 ? 0.22 : s < 5 ? 0.1 : s === 10 ? 0.08 : 0;
    a += (1 - j / h) * 0.06;
    if (a > 0) P.px(X, Y, tint, a * str);
  }
}
// rund knopp/lampa: mörk kant, färg, ljusprick
function knob(P, cx, cy, r, c) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 0.3) continue;
    P.px(cx + x, cy + y, d > r - 0.7 ? mul(c, 0.45) : x + y < -r * 0.6 ? mix(c, WHITE, 0.5) : x + y > r * 0.6 ? mul(c, 0.75) : c);
  }
}
// tegel (samma murförband som fasaden ute)
function brickPx(X, Y, base, seed, opt = {}) {
  const bw = opt.bw || 8, bh = opt.bh || 3;
  const row = Math.floor(Y / bh), ry = Y - row * bh;
  const xx = X + (row & 1 ? bw >> 1 : 0) + 64, col = Math.floor(xx / bw), rx = xx - col * bw;
  const mortar = opt.mortar ?? mix(base, 0xcfc4b0, 0.45);
  if (ry === bh - 1 || rx === bw - 1) return jit(mortar, X, Y, seed + 1, 0.1);
  const h = hash(col, row, seed);
  let c = h > 0.66 ? mix(base, 0xc8764e, 0.22) : h < 0.25 ? mix(base, 0x4a2418, 0.28) : base;
  if (hash(col, row, seed + 7) > 0.93) c = mix(c, 0x2a2a2a, 0.3);
  if (ry === 0) c = mix(c, WHITE, 0.1);
  if (rx === bw - 2) c = mul(c, 0.86);
  return jit(c, X, Y, seed, 0.07);
}
// mjukt värdebrus (bilinjärt) för stora fläckar i betongen
function vnoise(x, y, sx, sy, seed) {
  const gx = x / sx, gy = y / sy, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// rostfritt stål: borstade vertikala stråk
function steelPx(X, Y, i, w, seed, lit = 0) {
  let c = qmix(0xe0e4e6, 0x9aa2a6, i / w - lit, X, Y, 4);
  const s = hash(X, 0, seed);
  if (s > 0.8) c = mix(c, WHITE, 0.12); else if (s < 0.15) c = mul(c, 0.93);
  return jit(c, X, Y, seed + 1, 0.03);
}
// liten rund frukt (3×3) i en låda eller trattens hög
function ball(P, x, y, c) {
  P.px(x + 1, y, mix(c, WHITE, 0.25));
  P.px(x, y + 1, mix(c, WHITE, 0.45)); P.px(x + 1, y + 1, c); P.px(x + 2, y + 1, mul(c, 0.72));
  P.px(x + 1, y + 2, mul(c, 0.58));
}
const FRUIT_COLS = [0xd8342c, 0xf0c832, 0xf08c1c, 0xa8cc42, 0x8a52c6];
// yttre kontur runt allt som målats i en Pix (mörk, 1 px)
function outline(P, col, a = 1) {
  const { w, h, d } = P, add = [];
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (on(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) P.px(x + P.ox, y + P.oy, col, a);
}

// kväll och natt: hallen mörknar, lamporna tar över (samma ljus för alla lager)
function lightF(x, y, mode) {
  if (mode === 'dag') return 1;
  const k = mode === 'natt' ? 0.8 : 0.9, wall = y < FLOOR_Y;
  let lit = 0;
  for (const lx of LAMPS) lit = Math.max(lit, 1 - Math.hypot((x - lx) / 70, (y - (wall ? 34 : 146)) / (wall ? 30 : 40)));
  return k + (1 - k) * clamp(lit * 1.6, 0, 1);
}
function nightShade(P, mode, skip) {
  if (mode === 'dag') return;
  for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) {
    const x = i + P.ox, y = j + P.oy;
    if (skip && skip(x, y)) continue;
    const f = lightF(x, y, mode);
    if (f < 0.995) P.darken(x, y, 1, 1, Math.floor(f * 8 + bayer(x, y) * 0.9) / 8);
  }
}
const inWin = (x, y) => y >= WIN_Y && y < WIN_Y + WIN_H && WINS.some((wx) => x >= wx && x < wx + WIN_W);

// ======================= frukterna =======================
// Formen ges av en mask, ljuset kommer uppifrån vänster (3 toner + högdager),
// kanten tonas mörk – ljusare kant på den belysta sidan.
const FR_PAL = [
  { o: 0x5a0c12, d: 0x9a1a1e, m: 0xd0302c, l: 0xf05a48, h: 0xffd8c8 }, // äpple
  { o: 0x6a4608, d: 0xc8961a, m: 0xf0c832, l: 0xfae478, h: 0xfff6c8 }, // banan
  { o: 0x7a3406, d: 0xc8600e, m: 0xf08c1c, l: 0xffb048, h: 0xffe6b0 }, // apelsin
  { o: 0x3a5a12, d: 0x6a9a22, m: 0xa8cc42, l: 0xd2e87a, h: 0xf4ffd8 }, // päron
  { o: 0x2a0e40, d: 0x5a2a88, m: 0x8a52c6, l: 0xb282ea, h: 0xf2e4ff }, // druvor
];
const FS = 14, FC = 7;
const FR_SPR = [];
function fruitSprite(f) {
  if (FR_SPR[f]) return FR_SPR[f];
  const P = new Pix(FS, FS), pal = FR_PAL[f];
  const M = new Uint8Array(FS * FS), L = new Float32Array(FS * FS);
  const on = (x, y) => x >= 0 && y >= 0 && x < FS && y < FS && M[y * FS + x] === 1;
  const set = (x, y, l) => { M[y * FS + x] = 1; L[y * FS + x] = l; };
  const shape = (cx, cy, rx, ry, test) => {
    for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (test(x, y, nx, ny)) set(x, y, 0.56 - nx * 0.42 - ny * 0.5 - (nx * nx + ny * ny) * 0.14);
    }
  };
  const paint = () => {
    for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
      if (!on(x, y)) continue;
      const l = L[y * FS + x] + (bayer(x, y) - 0.5) * 0.16;
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      P.px(x, y, edge ? (l > 0.7 ? pal.d : pal.o) : l > 0.66 ? pal.l : l > 0.2 ? pal.m : pal.d);
    }
  };
  if (f === 0) {
    // äpple: rund med grop för skaftet och en liten grop under
    shape(7.5, 7.9, 5.3, 4.9, (x, y, nx, ny) => Math.hypot(nx, ny) <= 1 && !(x === 7 && (y <= 4 || y >= 12)));
    paint();
    for (let y = 5; y < 12; y++) for (let x = 3; x < 12; x++) if (on(x, y) && hash(x, y, 301) > 0.9 && L[y * FS + x] < 0.66) P.px(x, y, mix(pal.m, 0xffe0a0, 0.35));
    P.px(5, 5, pal.h); P.px(4, 6, pal.h); P.px(5, 6, pal.l);
    P.px(7, 3, 0x4a2e18); P.px(7, 2, 0x6a4a2a); P.px(8, 1, 0x6a4a2a);
    P.px(8, 2, 0x2e6a22); P.px(9, 2, 0x3a8a2a); P.px(9, 1, 0x5ab040); P.px(10, 1, 0x5ab040); P.px(10, 2, 0x2e6a22); P.px(11, 1, 0x3a8a2a);
  } else if (f === 2) {
    // apelsin: rund med porigt skal och grönt fäste
    shape(7.5, 7.6, 5.3, 5.3, (x, y, nx, ny) => Math.hypot(nx, ny) <= 1);
    paint();
    for (let y = 3; y < 12; y++) for (let x = 3; x < 12; x++) {
      if (!on(x, y) || !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) continue;
      const h = hash(x, y, 302);
      if (h > 0.9) P.px(x, y, L[y * FS + x] > 0.5 ? pal.h : pal.l);
      else if (h < 0.08) P.px(x, y, pal.d);
    }
    P.px(5, 5, pal.h); P.px(4, 6, pal.l);
    P.px(7, 2, 0x2e6a22); P.px(8, 2, 0x3a8a2a); P.px(8, 1, 0x5ab040); P.px(9, 1, 0x5ab040); P.px(10, 1, 0x3a8a2a);
  } else if (f === 3) {
    // päron: smal hals, bred botten, lätt rodnad
    shape(7.5, 8.2, 4.6, 4.8, (x, y) => {
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, cy = 4.4 + t * 4.3, r = 2.0 + t * t * 2.65, cx = 7.5 + (1 - t) * 0.7;
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) return true;
      }
      return false;
    });
    paint();
    for (let y = 7; y < 13; y++) for (let x = 8; x < 13; x++) if (on(x, y) && on(x + 1, y) && on(x, y + 1) && bayer(x, y) < 0.5) P.px(x, y, mix(P.get(x, y), 0xd0603a, 0.35));
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if (on(x, y) && hash(x, y, 303) > 0.92 && L[y * FS + x] < 0.66) P.px(x, y, pal.d);
    P.px(6, 7, pal.h); P.px(5, 8, pal.l); P.px(7, 4, pal.l);
    P.px(8, 2, 0x4a2e18); P.px(8, 1, 0x6a4a2a); P.px(9, 0, 0x6a4a2a);
    P.px(9, 1, 0x3a8a2a); P.px(10, 1, 0x5ab040); P.px(10, 0, 0x5ab040);
  } else if (f === 1) {
    // banan: en böjd skära – ljus ovansida, mörk undersida, bruna toppar
    const cx = 7.5, cy = 0.2, R = 7.4;
    for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (ang < 32 || ang > 148) continue;
      const t = (ang - 32) / 116, half = 0.6 + 1.9 * Math.pow(Math.sin(Math.PI * t), 0.55);
      const s = (d - R) / half;
      if (Math.abs(s) > 1) continue;
      set(x, y, 0.5 - s * 0.55 + (t - 0.5) * 0.08);
      if (t < 0.07 || t > 0.93) L[y * FS + x] = -9;
    }
    for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
      if (!on(x, y)) continue;
      const l = L[y * FS + x];
      if (l === -9) { P.px(x, y, 0x4a3010); continue; }
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      const below = !on(x, y + 1);
      P.px(x, y, edge ? (below ? pal.o : pal.d) : l + (bayer(x, y) - 0.5) * 0.14 > 0.62 ? pal.l : l > 0.25 ? pal.m : pal.d);
    }
    // ryggåsen och några mogna prickar
    for (let x = 3; x < 12; x++) for (let y = 0; y < FS; y++) if (on(x, y) && !on(x, y - 1)) { if (on(x, y + 1) && on(x, y + 2)) P.px(x, y + 1, pal.h, 0.8); break; }
    P.px(5, 9, 0x8a5a14); P.px(9, 10, 0x8a5a14); P.px(7, 10, pal.d);
    // skaftet i högra änden
    P.px(12, 4, 0x6a8a2a); P.px(12, 3, 0x6a8a2a); P.px(13, 2, 0x4a3010);
  } else {
    // druvor: klase av små bär, vart och ett med egen högdager
    const balls = [];
    for (const [yy, xs] of [[4.6, [3.4, 6.2, 9.0, 11.8]], [7.1, [4.8, 7.6, 10.4]], [9.6, [6.2, 9.0]], [12.0, [7.6]]]) for (const xx of xs) balls.push([xx, yy]);
    for (const [bx, by] of balls) {
      for (let y = Math.floor(by - 2); y <= by + 2; y++) for (let x = Math.floor(bx - 2); x <= bx + 2; x++) {
        if (x < 0 || y < 0 || x >= FS || y >= FS) continue;
        const dx = x + 0.5 - bx, dy = y + 0.5 - by, d = Math.hypot(dx, dy);
        if (d > 1.8) continue;
        M[y * FS + x] = 1;
        const l = 0.5 - dx * 0.3 - dy * 0.34;
        P.px(x, y, d > 1.15 ? (l > 0.6 ? pal.d : pal.o) : l > 0.62 ? pal.l : l > 0.3 ? pal.m : pal.d);
      }
      P.px(Math.floor(bx - 0.6), Math.floor(by - 0.6), pal.h);
    }
    P.px(7, 2, 0x5a3a1a); P.px(7, 1, 0x6a4a2a); P.px(8, 0, 0x6a4a2a);
    P.px(8, 1, 0x3a8a2a); P.px(9, 1, 0x5ab040); P.px(10, 1, 0x5ab040); P.px(9, 2, 0x2e6a22); P.px(10, 0, 0x3a8a2a);
  }
  return (FR_SPR[f] = P.flush());
}

// ======================= trälådor och pallar =======================
// trälåda sedd framifrån: ribbor, hörnstolpar, spikar, handtagshål; fill = frukt på toppen
function woodCrate(P, x, y, w, h, fill, seed) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    const post = i < 2 || i >= w - 2;
    if (!post && j % 4 === 3 && j < h - 1) return fill !== null ? mix(fill, 0x2a1a0e, 0.6) : 0x3a2412;
    let c = post ? 0xb0803e : j % 4 === 0 ? 0xe4b474 : 0xcc9a54;
    if ((post && i === 0) || j === 0) c = mix(c, WHITE, 0.16);
    if (i === w - 1 || j === h - 1) c = mul(c, 0.6);
    else if (post && i === w - 2) c = mul(c, 0.82);
    if (!post && hash(X >> 2, Y, seed) > 0.78) c = mul(c, 0.92);
    return jit(c, X, Y, seed, 0.06);
  });
  for (let j = 1; j < h - 1; j += 4) { P.px(x + 1, y + j, 0x5a4a3a); P.px(x + w - 2, y + j, 0x4a3a2a); }
  P.rect(x + (w >> 1) - 2, y + 1, 5, 1, 0x2a1a0e);
  if (fill !== null) {
    for (let k = 0; k < (w - 4) / 3; k++) {
      const bx = x + 2 + k * 3 + (hash(k, seed, 311) > 0.5 ? 1 : 0), by = y - 2 - (hash(k, seed, 312) > 0.6 ? 1 : 0);
      if (bx + 3 > x + w - 1) break;
      ball(P, bx, by, fill);
    }
  }
}
// grön plastback med räfflor
function plasticCrate(P, x, y, w, h, fill, seed) {
  const g = 0x2e8a4a;
  area(P, x, y, w, h, (X, Y, i, j) => {
    let c = g;
    if (j === 0) c = mix(g, WHITE, 0.3);
    else if (j === h - 1) c = mul(g, 0.5);
    else if (i === 0) c = mix(g, WHITE, 0.15);
    else if (i === w - 1) c = mul(g, 0.6);
    else if (i % 3 === 0) c = mul(g, 0.78);
    else if (j === 1) c = mix(g, WHITE, 0.12);
    return jit(c, X, Y, seed, 0.05);
  });
  P.rect(x + (w >> 1) - 3, y + 2, 6, 2, 0x12301c);
  P.hl(x + (w >> 1) - 3, y + 4, 6, mix(g, WHITE, 0.3));
  if (fill !== null) for (let k = 0; k < (w - 3) / 3; k++) ball(P, x + 1 + k * 3, y - 2 - (k & 1 ? 1 : 0), fill);
}
// lastpall (EUR-pall sedd framifrån): brädor, klossar och gafflarnas öppningar
function pallet(P, x, y, w) {
  rows(P, x, y, w, [0xe0b478, 0xb8894a]);
  area(P, x, y + 2, w, 3, (X, Y, i, j) => {
    const blk = i < 5 || i >= w - 5 || (i >= (w >> 1) - 3 && i < (w >> 1) + 3);
    if (!blk) return j === 0 ? 0x1e140c : 0x2e2014;
    return jit(i % 5 === 0 ? 0xc8964e : 0xa8783a, X, Y, 321, 0.06);
  });
  rows(P, x, y + 5, w, [0x9a6a32]);
  P.px(x + 2, y, 0x5a4a3a); P.px(x + w - 3, y, 0x5a4a3a);
}

// ======================= trucken =======================
// Motviktstruck vänd åt höger: gul kaross med varningsränder, skyddstak,
// mast med kedja och lyftcylinder, gafflar med en pall fruktlådor.
const TRUCK_ART = {};
function truckArt(mode) {
  if (TRUCK_ART[mode]) return TRUCK_ART[mode];
  const ox = TRUCK.x - 2, oy = TRUCK.y - 60, P = new Pix(96, 64, ox, oy);
  const X = (u) => TRUCK.x + u, Y = (v) => TRUCK.y - v;             // u åt höger, v uppåt från marken
  const Yb = 0xe8b020, Yh = 0xffd860, Yl = 0xb07a14, Yd = 0x6a4a10;
  // skuggan på golvet
  P.ell(X(46), Y(0) + 1, 46, 3.4, 0x1a1418, 0.5, 4);
  // ---- masten (bakom lasten), kedja och lyftcylinder ----
  for (let v = 3; v <= 56; v++) {
    const cs = [0x3a3e44, 0xb8bec4, 0x8a9096, 0x4a5056, 0x9aa0a6, 0x2a2e34];
    for (let k = 0; k < 6; k++) P.px(X(55 + k), Y(v), k === 3 && v % 2 ? 0x1a1a1e : cs[k]);
  }
  rows(P, X(54), Y(56), 8, [0xc8ced4, 0x5a6066]);
  rows(P, X(54), Y(31), 8, [0x9aa0a6, 0x4a5056]);
  vcols(P, X(52), Y(44), 34, [0xe8ecf0, 0x8a9096]);
  // ---- lastbordet och gafflarna ----
  area(P, X(61), Y(38), 3, 32, (x, y, i, j) => (i === 0 ? 0x5a6066 : j % 5 === 0 ? 0x2a2e34 : 0x3a3e44));
  for (let v = 26; v <= 38; v += 4) P.hl(X(61), Y(v), 3, 0x6a7076);
  // ---- pallen med två lådor på gafflarna ----
  pallet(P, X(63), Y(12), 27);
  area(P, X(63), Y(9), 27, 2, (x, y, i) => (i >= 3 && i < 24 ? (i === 3 ? 0x6a7076 : 0x9aa0a6) : null));
  woodCrate(P, X(63), Y(22), 27, 10, 0xd8342c, 331);
  woodCrate(P, X(63), Y(32), 27, 10, 0xf08c1c, 332);
  // gafflarnas spetsar som sticker ut
  P.hl(X(90), Y(8), 2, 0x9aa0a6); P.px(X(92), Y(8), 0x6a7076);
  // ---- motvikten bak, rundad ----
  area(P, X(2), Y(27), 20, 20, (x, y, i, j) => {
    const r = 6, cx = i < r ? r - i : 0, cy = j < r ? r - j : 0;
    if (cx && cy && Math.hypot(cx, cy) > r) return null;
    let c = j < 3 ? Yh : j > 15 ? Yl : Yb;
    if (i < 4 && j > 4) c = (((i + j) >> 1) & 1) ? 0x1e1e20 : 0xf0c020;       // varningsränder bak
    if (cx && cy && Math.hypot(cx, cy) > r - 1.2) c = Yd;
    return jit(c, x, y, 341, 0.05);
  });
  // ---- karossen ----
  area(P, X(14), Y(25), 42, 18, (x, y, i, j) => {
    let c = j === 0 ? Yh : j < 3 ? mix(Yb, Yh, 0.4) : j > 12 ? Yl : Yb;
    if (j === 17) c = Yd;
    if (i === 41) c = Yl;
    return jit(c, x, y, 342, 0.05);
  });
  P.hl(X(14), Y(13), 42, Yd);
  for (let v = 14; v <= 18; v += 2) P.hl(X(44), Y(v), 7, Yl);
  for (let v = 15; v <= 19; v += 2) P.hl(X(44), Y(v), 7, Yh);
  P.vl(X(42), Y(24), 11, Yl); P.vl(X(43), Y(24), 11, mix(Yb, Yh, 0.5));
  rows(P, X(36), Y(13), 6, [0x3a3a40, 0x1a1a1e]);
  for (let u = 37; u < 42; u += 2) P.px(X(u), Y(13), 0x6a6a72);
  // flottnummer och varningsdekal
  text(P, SMALL, '07', X(25), Y(21), 0x2a1e10);
  for (let j = 0; j < 5; j++) for (let i = -j; i <= j; i++) P.px(X(38) + i, Y(21) + j, j === 4 || Math.abs(i) === j ? 0x2a1e10 : 0xf8e070);
  P.px(X(38), Y(19), 0x2a1e10);
  // ---- hjulhusen och hjulen ----
  const wheel = (cu, cv, r) => {
    for (let y = -r - 1; y <= 1; y++) for (let x = -r - 1; x <= r + 1; x++) if (Math.hypot(x, y) <= r + 1.3) P.px(X(cu) + x, Y(cv) + y, 0x1a1a1e);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d > r + 0.3) continue;
      let c = d > r - 0.8 ? 0x141416 : d > r - 2.2 ? (x + y < 0 ? 0x3a3a40 : 0x232326) : d > 2.2 ? (x + y < 0 ? 0xd8dce0 : 0x9aa0a6) : 0x5a6066;
      if (d <= 1) c = 0xe8ecf0;
      P.px(X(cu) + x, Y(cv) + y, c);
    }
  };
  wheel(15, 6, 6);
  wheel(47, 7, 7);
  // ---- sätet, instrumentbrädan och ratten ----
  area(P, X(20), Y(31), 16, 6, (x, y, i, j) => jit(j === 0 ? Yh : Yb, x, y, 343, 0.05));
  area(P, X(19), Y(44), 5, 14, (x, y, i, j) => (i === 0 ? 0x4a4a52 : j === 0 ? 0x5a5a62 : jit(0x2a2a30, x, y, 344, 0.08)));
  area(P, X(22), Y(34), 13, 3, (x, y, i, j) => (j === 0 ? 0x5a5a62 : 0x2a2a30));
  area(P, X(38), Y(33), 10, 8, (x, y, i, j) => (j < 8 - i ? null : j === 8 - i ? 0x8a9096 : jit(0x4a5056, x, y, 345, 0.06)));
  P.line(X(42), Y(31), X(39), Y(37), 0x2a2a30);
  rows(P, X(35), Y(38), 8, [0x3a3a40, 0x1a1a1e]);
  P.px(X(36), Y(38), 0x6a6a72);
  // ---- skyddstaket: stolpar och galler ----
  vcols(P, X(16), Y(54), 30, [0x5a5e66, 0x2a2e34]);
  vcols(P, X(47), Y(54), 30, [0x6a6e76, 0x2a2e34]);
  area(P, X(14), Y(57), 37, 4, (x, y, i, j) => (j === 0 ? 0x8a9098 : j === 3 ? 0x1e2024 : i % 4 === 0 ? 0x3a3e44 : 0x5a5e66));
  // blixtljuset (tänds levande) och strålkastaren
  P.rect(X(29), Y(59), 4, 2, 0x8a4a10);
  P.hl(X(29), Y(59), 4, 0xd8761a);
  P.rect(X(49), Y(50), 3, 3, 0x2a2e34); P.px(X(50), Y(49), 0xfff4c0); P.px(X(51), Y(49), 0xfff4c0);
  P.rect(X(3), Y(25), 2, 2, 0xd8303a); P.px(X(3), Y(25), 0xff8a7a);
  // lutningscylindern
  P.line(X(50), Y(20), X(55), Y(26), 0xc8ced4);
  P.line(X(50), Y(19), X(55), Y(25), 0x5a6066);
  outline(P, 0x1e1a14, 0.9);
  nightShade(P, mode);
  return (TRUCK_ART[mode] = { img: P.flush(), x: ox, y: oy, beacon: [X(30), Y(60)] });
}
// pallen med tomma lådor bredvid packplatsen
const STACK_ART = {};
function stackArt(mode) {
  if (STACK_ART[mode]) return STACK_ART[mode];
  const w = 30, ox = STACK.x - 2, oy = STACK.y - 48, P = new Pix(w + 4, 53, ox, oy);
  P.ell(STACK.x + w / 2, STACK.y + 1, w / 2 + 3, 2.4, 0x1a1418, 0.5, 4);
  pallet(P, STACK.x, STACK.y - 6, w);
  for (let k = 0; k < 4; k++) woodCrate(P, STACK.x + (k & 1), STACK.y - 16 - k * 10, w - 1, 10, null, 351 + k);
  // en tom låda på sniskan överst
  outline(P, 0x2a1a0e, 0.85);
  nightShade(P, mode);
  return (STACK_ART[mode] = { img: P.flush(), x: ox, y: oy });
}

// kompostkärlet för dålig frukt (grönt, locket på glänt)
const BIN_ART = {};
function binArt(mode) {
  if (BIN_ART[mode]) return BIN_ART[mode];
  const w = 20, ox = BIN.x - 3, oy = BIN.y - 30, P = new Pix(w + 6, 34, ox, oy), g = 0x2e7a3e;
  P.ell(BIN.x + w / 2, BIN.y + 1, w / 2 + 3, 2.2, 0x1a1418, 0.5, 4);
  // hjulen bak
  for (const wx of [BIN.x + 1, BIN.x + w - 6]) area(P, wx, BIN.y - 5, 5, 5, (X, Y, i, j) => ((i === 0 || i === 4) && (j === 0 || j === 4) ? null : i === 2 && j === 2 ? 0x8a9096 : j < 2 ? 0x3a3a40 : 0x16161a));
  // kroppen smalnar lite nedåt, räfflor och klistermärke
  for (let j = 0; j < 20; j++) {
    const y = BIN.y - 23 + j, ins = j > 12 ? 1 : 0;
    for (let i = ins; i < w - ins; i++) {
      let c = qmix(mix(g, WHITE, 0.2), mul(g, 0.62), (i - ins) / (w - 2 * ins), i, j, 4);
      if (i === ins) c = mix(g, WHITE, 0.35); else if (i === w - ins - 1) c = mul(g, 0.45);
      if (j === 6 || j === 13) c = mul(c, 0.72); else if (j === 7 || j === 14) c = mix(c, WHITE, 0.14);
      P.px(BIN.x + i, y, jit(c, BIN.x + i, y, 511, 0.04));
    }
  }
  P.hl(BIN.x + 1, BIN.y - 4, w - 2, mul(g, 0.35));
  area(P, BIN.x + 6, BIN.y - 21, 8, 7, (X, Y, i, j) => (j === 0 ? 0xffffff : 0xeef0ea));
  P.px(BIN.x + 9, BIN.y - 20, 0x8a5a2a); P.px(BIN.x + 10, BIN.y - 20, 0x8a5a2a);
  P.rect(BIN.x + 8, BIN.y - 19, 4, 3, 0xe8d8a8); P.px(BIN.x + 8, BIN.y - 19, 0xd8342c); P.px(BIN.x + 11, BIN.y - 18, 0xd8342c);
  P.hl(BIN.x + 9, BIN.y - 16, 2, 0xe8d8a8);
  // locket på glänt med rutten frukt i springan
  P.hl(BIN.x, BIN.y - 24, w, 0x1e2a20);
  for (let k = 0; k < 6; k++) ball(P, BIN.x + 2 + k * 3, BIN.y - 26 + (k & 1), [0x6a4a1e, 0x7a8a2a, 0x8a3a1a, 0x5a3a14][k % 4]);
  area(P, BIN.x - 1, BIN.y - 29, w + 2, 4, (X, Y, i, j) => (j === 0 ? mix(g, WHITE, 0.3) : j === 3 ? mul(g, 0.4) : jit(mul(g, 0.8), X, Y, 512, 0.05)));
  P.rect(BIN.x + (w >> 1) - 3, BIN.y - 26, 6, 1, mul(g, 0.5));
  outline(P, 0x10201a, 0.85);
  nightShade(P, mode);
  return (BIN_ART[mode] = { img: P.flush(), x: ox, y: oy });
}
// hink med moppvridare vid pölen under vaskaren
const MOP_ART = {};
function mopArt(mode) {
  if (MOP_ART[mode]) return MOP_ART[mode];
  const ox = MOP.x - 6, oy = MOP.y - 36, P = new Pix(28, 40, ox, oy), y0 = MOP.y;
  P.ell(MOP.x + 7, y0 + 1, 10, 2, 0x1a1418, 0.45, 3);
  // moppskaftet lutar mot hinken
  P.line(MOP.x - 4, y0 - 27, MOP.x + 6, y0 - 9, 0x3a6ad8);
  P.line(MOP.x - 3, y0 - 27, MOP.x + 7, y0 - 9, 0x2a4aa8);
  P.rect(MOP.x - 5, y0 - 29, 3, 2, 0x1e1e22);
  // hinken
  area(P, MOP.x, y0 - 10, 15, 8, (X, Y, i, j) => {
    let c = j === 0 ? 0xffe070 : j === 7 ? 0xa88010 : i === 0 ? 0xf8d850 : i === 14 ? 0xb89010 : 0xf0c020;
    if (j === 3) c = mul(c, 0.85);
    return jit(c, X, Y, 521, 0.05);
  });
  // vridaren och moppens trassel
  area(P, MOP.x + 7, y0 - 14, 7, 4, (X, Y, i, j) => (j === 0 ? 0x9aa0a6 : i === 0 || i === 6 ? 0x4a5056 : 0x6a7076));
  for (let i = 0; i < 6; i++) P.px(MOP.x + 1 + i, y0 - 11, i & 1 ? 0xd8d2c0 : 0xa8a290);
  P.px(MOP.x + 2, y0 - 12, 0xd8d2c0); P.px(MOP.x + 4, y0 - 12, 0xb8b2a0);
  text(P, SMALL, '!', MOP.x + 3, y0 - 8, 0x2a1e10);
  // hjulen
  for (const wx of [MOP.x + 1, MOP.x + 12]) { P.px(wx, y0 - 2, 0x2a2a2e); P.px(wx + 1, y0 - 2, 0x2a2a2e); P.px(wx, y0 - 1, 0x16161a); P.px(wx + 1, y0 - 1, 0x16161a); }
  outline(P, 0x2a1e10, 0.8);
  nightShade(P, mode);
  return (MOP_ART[mode] = { img: P.flush(), x: ox, y: oy });
}
// pallyften med en pall plastbackar (nere i mitten)
const JACK_ART = {};
function jackArt(mode) {
  if (JACK_ART[mode]) return JACK_ART[mode];
  const ox = JACK.x - 14, oy = JACK.y - 40, P = new Pix(66, 44, ox, oy), y0 = JACK.y;
  P.ell(JACK.x + 24, y0 + 1, 30, 2.4, 0x1a1418, 0.5, 4);
  // gafflarna och lastrullarna
  rows(P, JACK.x, y0 - 4, 46, [0xe84a3a, 0xa82a1c, 0x5a1a14]);
  P.rect(JACK.x + 42, y0 - 1, 3, 2, 0x16161a);
  // pall + två backar äpplen och en med päron
  pallet(P, JACK.x + 2, y0 - 10, 44);
  plasticCrate(P, JACK.x + 3, y0 - 19, 20, 9, 0xd8342c, 531);
  plasticCrate(P, JACK.x + 24, y0 - 19, 20, 9, 0xa8cc42, 532);
  plasticCrate(P, JACK.x + 13, y0 - 30, 20, 9, 0xf0c832, 533);
  // pumpen, styrhjulet och draghandtaget
  area(P, JACK.x - 6, y0 - 12, 7, 10, (X, Y, i, j) => (i === 0 ? 0xff6a5a : i === 6 ? 0x8a1a14 : j === 0 ? 0xff8a7a : jit(0xd8342c, X, Y, 534, 0.05)));
  vcols(P, JACK.x - 4, y0 - 20, 8, [0xe8ecf0, 0x8a9096]);
  area(P, JACK.x - 6, y0 - 3, 6, 3, (X, Y, i, j) => (j === 0 ? 0x3a3a40 : 0x16161a));
  P.line(JACK.x - 3, y0 - 20, JACK.x - 12, y0 - 36, 0xd8342c);
  P.line(JACK.x - 2, y0 - 20, JACK.x - 11, y0 - 36, 0x8a1a14);
  area(P, JACK.x - 14, y0 - 39, 6, 4, (X, Y, i, j) => ((i > 0 && i < 5 && j > 0 && j < 3) ? null : 0x1e1e22));
  outline(P, 0x1e1a14, 0.85);
  nightShade(P, mode);
  return (JACK_ART[mode] = { img: P.flush(), x: ox, y: oy });
}

// tomma plastbackar staplade på golvet (den översta på sniskan, med ett löv i)
const CRATE_ART = {};
function cratesArt(mode) {
  if (CRATE_ART[mode]) return CRATE_ART[mode];
  const w = 18, ox = CRATES.x - 3, oy = CRATES.y - 26, P = new Pix(w + 8, 30, ox, oy), x0 = CRATES.x, y0 = CRATES.y, g = 0x2e8a4a;
  P.ell(x0 + w / 2 + 1, y0, w / 2 + 3, 2, 0x1a1418, 0.5, 4);
  // undre backen: insidan syns inte (den övre står i den)
  plasticCrate(P, x0, y0 - 9, w, 9, null, 551);
  // övre backen, förskjuten: mörk insida och bakkant ovanför framsidan
  const ux = x0 + 2, uy = y0 - 18;
  area(P, ux, uy - 3, w, 3, (X, Y, i, j) => (j === 0 ? mix(g, WHITE, 0.25) : i === 0 || i === w - 1 ? mul(g, 0.7) : jit(mul(g, j === 1 ? 0.42 : 0.55), X, Y, 552, 0.06)));
  plasticCrate(P, ux, uy, w, 9, null, 553);
  P.hl(ux, uy + 9, w, mul(g, 0.35));
  // ett löv som blivit kvar i backen
  P.px(ux + 5, uy - 2, 0x8ac86a); P.px(ux + 6, uy - 2, 0x5aa03e); P.px(ux + 7, uy - 1, 0x3a7a2e);
  // en etikett på undre backen
  P.rect(x0 + 12, y0 - 6, 4, 3, 0xf2ecdc); P.hl(x0 + 12, y0 - 6, 4, WHITE); P.px(x0 + 13, y0 - 5, 0x9a968c); P.px(x0 + 14, y0 - 5, 0x9a968c);
  outline(P, 0x10201a, 0.85);
  nightShade(P, mode);
  return (CRATE_ART[mode] = { img: P.flush(), x: ox, y: oy });
}

// ======================= LÅDAN (packplatsen) =======================
// Bakre delen (insidan) och främre delen målas var för sig så att frukterna
// man lägger i hamnar emellan. Står på en pall med en pappersetikett.
const BOX_ART = {};
const BTOP = BOX.y - 4;   // framkantens överkant
function boxArt(mode) {
  if (BOX_ART[mode]) return BOX_ART[mode];
  const ox = BOX.x - 3, oy = BOX.y - 12;
  const B = new Pix(BOX.w + 6, 40, ox, oy), F = new Pix(BOX.w + 6, 40, ox, oy);
  const x0 = BOX.x, x1 = BOX.x + BOX.w;
  // ---- baksidan: skugga, insidan av bakre väggen och gavlarna ----
  B.ell(x0 + BOX.w / 2, BOX.y + 26, BOX.w / 2 + 5, 3.2, 0x1a1418, 0.55, 4);
  area(B, x0, BTOP - 7, BOX.w, 8, (X, Y, i, j) => {
    if (j === 0) return 0xe8bc80;
    if (i < 3 || i >= BOX.w - 3) return jit(0x8a5e30, X, Y, 361, 0.06);
    return jit(j % 4 === 3 ? 0x3a2412 : mix(0x7a5028, 0x4a2e16, j / 8), X, Y, 362, 0.07);
  });
  // ---- framsidan: tjock överkant, tre ribbor, hörnstolpar ----
  area(F, x0, BTOP, BOX.w, 22, (X, Y, i, j) => {
    const post = i < 4 || i >= BOX.w - 4;
    if (!post && (j === 7 || j === 14)) return 0x2a1a0e;
    let c = post ? 0xa87438 : j < 2 ? 0xecc080 : 0xcc9a54;
    if (!post && (j === 8 || j === 15 || j === 2)) c = mix(c, WHITE, 0.12);
    if (!post && (j === 6 || j === 13 || j === 21)) c = mul(c, 0.8);
    if (post && (i === 0 || i === BOX.w - 4)) c = mix(c, WHITE, 0.14);
    if (i === BOX.w - 1) c = mul(c, 0.6);
    if (post && i === 3) c = mul(c, 0.8);
    if (!post && hash(X >> 3, Y, 363) > 0.75) c = mul(c, 0.93);
    if (!post && hash(X, Y, 364) > 0.985) c = 0x6a4a28;
    return jit(c, X, Y, 365, 0.05);
  });
  F.hl(x0, BTOP, BOX.w, 0xf8d8a0);
  for (const nx of [x0 + 1, x1 - 3]) for (const ny of [BTOP + 3, BTOP + 10, BTOP + 17]) { F.px(nx, ny, 0x4a3a2a); F.px(nx + 1, ny, 0x7a6a5a); }
  // pappersetiketten med LÅDA och fabrikens loggpunkt
  const lx = x0 + 17, ly = BTOP + 5;
  F.rect(lx + 1, ly + 1, 22, 11, 0x5a3a1c, 0.5);
  area(F, lx, ly, 22, 11, (X, Y, i, j) => (j === 0 ? 0xfffcf0 : jit(0xf2ecdc, X, Y, 366, 0.04)));
  F.hl(lx, ly + 10, 22, 0xc8c0aa);
  text(F, SMALL, 'LÅDA', lx + 3, ly + 4, INK);
  F.ell(lx + 19, ly + 6, 1.8, 1.8, 0x2f8f46, 1, 2);
  F.px(lx + 1, ly + 1, 0x9aa0a8); F.px(lx + 20, ly + 1, 0x9aa0a8);
  // ---- pallen under ----
  pallet(F, x0 - 1, BOX.y + 18, BOX.w + 2);
  nightShade(B, mode); nightShade(F, mode);
  return (BOX_ART[mode] = { back: B.flush(), front: F.flush(), x: ox, y: oy });
}
// var frukterna hamnar i lådan (dx från vänsterkanten, dy från framkanten)
const PACK_POS = [[9, 0], [20, 1], [31, 0], [42, 1], [15, -2], [26, -3], [37, -2], [4, -2], [47, -3], [21, -5], [32, -5]];

// ======================= utsikten genom fönstren =======================
const VIEW = {
  dag: { top: 0x6aa8e0, hor: 0xd4ecf8, cloud: 0xffffff, bld: 0xa8604a, bld2: 0x8a4a3a, roof: 0x4a4a52, win: 0x3a4a5a, tree: [0x2e5a2a, 0x4a8a3a, 0x7ab85a] },
  skymning: { top: 0x3a3c7a, hor: 0xf4a878, cloud: 0xffb898, bld: 0x6a4450, bld2: 0x543444, roof: 0x2e2434, win: 0xffc870, tree: [0x1e1a2a, 0x2e2838, 0x44384a] },
  natt: { top: 0x0a1030, hor: 0x2a3462, cloud: 0x3a4470, bld: 0x3a2e3a, bld2: 0x30262f, roof: 0x14121c, win: 0xffd890, tree: [0x0a0e16, 0x10161e, 0x182028] },
};
function viewMode(h) { return h >= 20.5 || h < 6.5 ? 'natt' : h >= 18 ? 'skymning' : 'dag'; }

function paintView(P, x0, mode) {
  const V = VIEW[mode], night = mode === 'natt', y0 = WIN_Y, y1 = WIN_Y + WIN_H;
  P.clip(x0, y0, x0 + WIN_W, y1);
  area(P, x0, y0, WIN_W, WIN_H, (X, Y) => qmix(V.top, V.hor, (Y - y0) / (WIN_H * 0.85), X, Y, 4));
  if (night) {
    for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + WIN_W; x++) if (hash(x, y, 371) > 0.975) P.px(x, y, WHITE, 0.4 + hash(x, y, 372) * 0.5);
    if (x0 === WINS[1]) { P.ell(x0 + 28, y0 + 5, 3, 3, 0xf4f0d8, 0.9, 3); P.px(x0 + 27, y0 + 4, WHITE); }
  } else {
    for (let k = 0; k < 3; k++) {
      const cx = x0 + 6 + k * 15 + hash(x0, k, 373) * 6, cy = y0 + 3 + hash(x0, k, 374) * 4;
      P.ell(cx, cy, 7, 2.2, V.cloud, 0.75, 3);
      P.ell(cx - 2, cy - 1, 4, 1.8, V.cloud, 0.65, 3);
    }
  }
  // grannhusets tegelgavel med fönster och skorsten
  for (let x = x0; x < x0 + WIN_W; x++) {
    const blk = (x >> 4) & 3, top = y0 + 9 + [0, 3, 1, 4][blk];
    for (let y = top; y < y1; y++) {
      let c = y === top ? V.roof : y === top + 1 ? mul(V.roof, 1.3) : ((y + (x >> 2)) % 3 === 0 ? V.bld2 : V.bld);
      if (y > top + 2 && x % 7 >= 2 && x % 7 <= 4 && (y - top) % 6 >= 2 && (y - top) % 6 <= 4) c = night || mode === 'skymning' ? (hash(Math.floor(x / 7), Math.floor((y - top) / 6), 375 + blk) > 0.3 ? V.win : 0x12141e) : V.win;
      P.px(x, y, c);
    }
  }
  if (x0 === WINS[0]) {
    area(P, x0 + 24, y0 + 5, 4, 5, (X, Y, i) => (i === 0 ? mix(V.bld, WHITE, 0.2) : V.bld2));
    P.hl(x0 + 23, y0 + 4, 6, V.roof);
  }
  // en trädkrona i ena hörnet
  const tcx = x0 === WINS[0] ? x0 + 6 : x0 + WIN_W - 7;
  for (let y = y0 + 8; y < y1; y++) for (let x = tcx - 8; x <= tcx + 8; x++) {
    const d = Math.hypot((x - tcx) / 8, (y - (y0 + 16)) / 8);
    if (d > 1 || (d > 0.75 && hash(x, y, 376) > 0.5)) continue;
    const l = ((tcx - x) / 8 + (y0 + 14 - y) / 8) * 0.5 + (hash(x, y, 377) - 0.5) * 0.8;
    P.px(x, y, l > 0.3 ? V.tree[2] : l > -0.2 ? V.tree[1] : V.tree[0]);
  }
  P.clip();
}
// industrifönster: tegelvalv, stålspröjs, vädringsruta på glänt, smuts och reflex
function paintWindow(P, x0, mode) {
  const y0 = WIN_Y, night = mode === 'natt';
  const cxw = x0 + WIN_W / 2;
  for (let xx = x0 - 2; xx < x0 + WIN_W + 2; xx++) {
    const u = (xx + 0.5 - cxw) / (WIN_W / 2 + 2), top = y0 - 4 - Math.round(2 * (1 - u * u));
    for (let yy = top; yy < y0; yy++) P.px(xx, yy, (xx + 64) % 3 === 2 ? 0xb8a890 : jit(yy === top ? 0x9a4a34 : 0x7a3222, xx, yy, 381, 0.08));
  }
  paintView(P, x0, mode);
  const cols = 4, rws = 3;
  for (let j = 0; j < WIN_H; j++) for (let i = 0; i < WIN_W; i++) {
    const X = x0 + i, Y = y0 + j, ci = Math.floor((i * cols) / WIN_W), rj = Math.floor((j * rws) / WIN_H);
    const edgeX = i === 0 || i === WIN_W - 1 || Math.floor(((i + 1) * cols) / WIN_W) !== ci;
    const edgeY = j === 0 || j === WIN_H - 1 || Math.floor(((j + 1) * rws) / WIN_H) !== rj;
    if (edgeX || edgeY) { P.px(X, Y, (edgeY && j !== WIN_H - 1) || (edgeX && i === 0) ? 0x3a4a44 : 0x1e2824); continue; }
    // smuts nertill i varje ruta
    const pr = (j * rws) / WIN_H - rj;
    if (bayer(X, Y) < (pr - 0.55) * 0.9) P.px(X, Y, 0x6a6a58, 0.3);
  }
  // en ruta är ersatt med en masonitskiva, en annan står på glänt
  const pane = (ci, rj) => [x0 + Math.round((ci * WIN_W) / cols) + 1, y0 + Math.round((rj * WIN_H) / rws) + 1, Math.round(WIN_W / cols) - 1, Math.round(WIN_H / rws) - 1];
  const [bx, by, bw, bh] = pane(x0 === WINS[0] ? 3 : 0, 2);
  area(P, bx, by, bw, bh, (X, Y, i, j) => jit(j === 0 ? 0x9a7a52 : 0x7a5a3a, X, Y, 382, 0.1));
  P.px(bx + 1, by + 1, 0x3a2a1a); P.px(bx + bw - 2, by + 1, 0x3a2a1a);
  const [gx, gy, gw] = pane(x0 === WINS[0] ? 1 : 2, 0);
  P.hl(gx, gy, gw, 0x5a6a64); P.darken(gx, gy + 1, gw, 2, 0.6);
  reflect(P, x0 + 1, y0 + 1, WIN_W - 2, WIN_H - 2, night ? 0.35 : 0.8, x0, night ? 0x9fb4d8 : 0xeef7ff);
  // fönsterbänk
  rows(P, x0 - 2, y0 + WIN_H, WIN_W + 4, [0xd8d0bc, 0xa89e8a, 0x6a6254]);
  P.darken(x0 - 1, y0 + WIN_H + 3, WIN_W + 2, 1, 0.7);
}

// ======================= skräpet på golvet =======================
// Mittgolvet mellan trucken, pallyftaren och lådan: en tejpad pallplats, spillda
// druvor, löv som fallit av frukten, en golvskrapa, en avbruten pallbräda,
// plastfilm, en arbetshandske, en följesedel, ett mosat apelsinskal och
// oljedropp efter trucken. Allt ligger platt i golvlagret (inga hinder).
const LITTER = {
  leaf: { rows: ['.lL.', 'dmmL', '.dd.'], pal: { L: 0x8ac86a, l: 0x5aa03e, m: 0x3a7a2e, d: 0x245a22 } },
  leaf2: { rows: ['Ll..', 'mmLb', '.dd.'], pal: { L: 0xa8c84a, l: 0x7aa03a, m: 0x5a8a2a, d: 0x3a5a1e, b: 0x6a4a2a } },
  glove: {
    rows: ['....xx......', 'xxxxyYx.....', 'xgggxyYYxxx.', 'xgGgxyYYYYYx', 'xgggxyyddddx', 'xgGgxyYYYYYx', 'xgggxyyddddx', '.xxxxxxxxxx.'],
    pal: { x: 0x3a2a12, y: 0xe8c030, Y: 0xfae070, d: 0xa88010, g: 0x4a5a4a, G: 0x6a7a6a },
  },
  slip: {
    rows: ['pppppppppq', 'pRRRkkkpnq', 'ppppppppnq', 'pkkkkkpppq', 'pkkkppkkpq', 'qqqqqqqqqq'],
    pal: { p: 0xf6f2e6, q: 0xcfc8b6, k: 0x9a968c, R: 0xc83a3a, n: 0xe0dac8 },
  },
  // skrynklig papperspåse (fruktpåse) som blåst in under bandet
  bag: { rows: ['..ppP..', '.pPPPp.', 'pPPppPp', 'ppdppdp', '.ppppp.'], pal: { p: 0xc8a878, P: 0xe0c898, d: 0x8a6a48 } },
  // hörselkåpor som kollegan lagt ifrån sig
  ears: { rows: ['..bbbbb..', '.b.....b.', 'gg.....gg', 'GG.....GG', 'gg.....gg'], pal: { b: 0x2a2c30, g: 0x2a6a3e, G: 0x3a8a52 } },
};
function paintFloorLitter(P) {
  // ---- pallplats P3: gula tejphörn, smutskant runt pallens fotavtryck, stencil ----
  const { x: sx0, y: sy0, w: sw, h: sh } = PSPOT;
  area(P, sx0, sy0, sw, sh, (X, Y, i, j) => {
    const e = Math.min(i, j, sw - 1 - i, sh - 1 - j), c = P.get(X, Y);
    if (e === 3) return mul(c, 0.88);                 // smuts längs pallkanten
    if (e === 4) return mul(c, 0.94);
    if (e > 4) return mix(c, WHITE, 0.04);            // skyddat under pallen
    return null;
  });
  const taped = new Set();
  for (const [cx, cy, dx, dy] of [[sx0, sy0, 1, 1], [sx0 + sw - 1, sy0, -1, 1], [sx0, sy0 + sh - 1, 1, -1], [sx0 + sw - 1, sy0 + sh - 1, -1, -1]]) {
    for (let k = 0; k < 8; k++) for (let w = 0; w < 2; w++) { taped.add((cx + k * dx) + ',' + (cy + w * dy)); taped.add((cx + w * dx) + ',' + (cy + k * dy)); }
  }
  for (const key of taped) {
    const [X, Y] = key.split(',').map(Number), worn = hash(X, Y, 441) > 0.86;
    P.px(X, Y, worn ? mix(0xe8c030, P.get(X, Y), 0.6) : 0xe8c030, 0.92);
  }
  // tejpen har släppt i ett hörn och krullat sig
  P.px(sx0 + sw - 9, sy0 + sh - 2, 0xfae070); P.px(sx0 + sw - 9, sy0 + sh - 3, 0xc89a18); P.px(sx0 + sw - 10, sy0 + sh - 3, 0x1e1a16, 0.3);
  const lw = textW(BIG, 'P3'), lx = sx0 + ((sw - lw) >> 1), ly = sy0 + ((sh - 7) >> 1);
  eachTextPixel(BIG, 'P3', lx, ly, 1, (x, y) => { if (hash(x, y, 442) > 0.16) P.px(x, y, 0xe8c030, hash(x, y, 443) > 0.5 ? 0.55 : 0.4); });
  // flisor från pallarna
  for (const [fx, fy, len] of [[156, 139, 3], [186, 118, 2], [199, 131, 3], [145, 126, 2]]) { P.hl(fx, fy, len, 0xd8b478); P.px(fx + len, fy + 1, 0x1e1a16, 0.25); P.hl(fx, fy + 1, len, 0x8a6a3a, 0.5); }
  // ---- spillda druvor vid saftfläcken + en mosad ----
  P.ell(237, 117, 3, 1.2, 0x4a1a5a, 0.55, 2);
  P.px(236, 117, 0x8a52c6); P.px(238, 116, 0x6a3a9a);
  for (const [gx, gy] of [[226, 109], [231, 112], [243, 112], [222, 114]]) { ball(P, gx, gy, 0x8a52c6); P.px(gx + 1, gy + 3, 0x3a3432, 0.45); P.px(gx + 2, gy + 3, 0x3a3432, 0.25); }
  P.px(229, 108, 0x6a4a2a); P.px(230, 109, 0x6a4a2a); P.px(231, 109, 0x3a8a2a);
  // ---- löv som fallit av ----
  for (const [lx2, ly2, k] of [[100, 112, 0], [178, 106, 1], [262, 121, 0], [207, 160, 1], [127, 170, 0], [276, 106, 1]]) stamp(P, lx2, ly2, (k ? LITTER.leaf2 : LITTER.leaf).rows, (k ? LITTER.leaf2 : LITTER.leaf).pal, 0.25);
  // ---- golvskrapan som någon lagt ifrån sig ----
  P.line(247, 142, 265, 133, 0x1e1a16, 0.28);
  P.line(246, 140, 264, 131, 0xc8ced2); P.line(246, 141, 264, 132, 0x6a7276);
  P.rect(244, 140, 3, 2, 0x1e1e22); P.px(244, 140, 0x4a4a52);
  P.line(263, 127, 268, 137, 0x1e1a16, 0.28);
  P.line(262, 126, 267, 136, 0xd8342c); P.line(263, 126, 268, 136, 0x16161a);
  P.px(262, 126, 0xff7a6a); P.px(265, 131, 0x8a1a14);
  // ---- avbruten pallbräda med spikar ----
  area(P, 214, 186, 17, 3, (X, Y, i, j) => {
    if (i === 0 && j !== 1) return null;                   // flisig ände
    if (i === 16 && j === 2) return null;
    return jit(j === 0 ? 0xe0b478 : j === 1 ? 0xc8964e : 0x8a6a32, X, Y, 444, 0.06);
  });
  P.hl(215, 189, 16, 0x1e1a16, 0.3); P.px(231, 188, 0x1e1a16, 0.3);
  for (const nx of [218, 227]) { P.px(nx, 187, 0x5a5a60); P.px(nx, 186, 0xaab0b8); }
  P.px(213, 187, 0xd8b478); P.px(212, 188, 0xc8964e);
  // ---- plastfilm från en inplastad pall ----
  for (const [ox, oy] of [[118, 160], [266, 168]]) {
    for (const [dx, dy, a] of [[0, 1, 0.4], [1, 0, 0.5], [2, 0, 0.35], [3, 1, 0.5], [4, 1, 0.3], [1, 2, 0.35], [2, 2, 0.55], [3, 2, 0.3], [5, 2, 0.4], [2, 3, 0.3], [4, 3, 0.35], [6, 3, 0.25]]) P.px(ox + dx, oy + dy, 0xf4faff, a);
    P.px(ox + 2, oy + 1, WHITE, 0.85); P.px(ox + 4, oy + 2, WHITE, 0.7);
  }
  // ---- arbetshandske och en följesedel ----
  stamp(P, 176, 150, LITTER.glove.rows, LITTER.glove.pal);
  stamp(P, 102, 121, LITTER.slip.rows, LITTER.slip.pal);
  // ---- mosat apelsinskal med saft ----
  P.ell(224, 152, 4, 1.3, 0xc85a1a, 0.3, 3);
  for (const [dx, dy, c] of [[0, 0, 0xf08c1c], [1, 0, 0xffb048], [2, 1, 0xf08c1c], [-2, 1, 0xc8600e], [-1, 1, 0xf6e6c0], [3, -1, 0xc8600e], [0, 2, 0xf6e6c0]]) P.px(224 + dx, 151 + dy, c);
  // ---- oljedropp efter trucken och en äldre, utsmetad fläck ----
  for (const [ox, oy, r] of [[116, 150, 2.2], [128, 155, 1.6], [141, 159, 2], [153, 163, 1.4], [165, 166, 1.8]]) P.ell(ox, oy, r, r * 0.45, 0x1a1a18, 0.22, 2);
  P.ell(206, 140, 10, 2.4, 0x2a2a26, 0.1, 3);
  for (let x = 200; x < 214; x++) if (hash(x, 1, 445) > 0.6) P.px(x, 140 + (x & 1), 0x8a7aa8, 0.12);   // regnbågsskimmer
  // ---- avklippt spännband (blått PET-band) i en lös ögla + papperspåse + hörselkåpor ----
  // öglan ligger på högkant framtill så bandets bredd syns som en mörkare kant under
  for (let a = 0; a < 44; a++) {
    const t2 = (a / 44) * Math.PI * 2, sn = Math.sin(t2), x = Math.round(314 + Math.cos(t2) * 7), y = Math.round(129 + sn * 2.6);
    if (sn > 0.2) { P.px(x, y + 1, 0x1e3a98); P.px(x + 1, y + 2, 0x1e1a16, 0.25); }
    else P.px(x + 1, y + 1, 0x1e1a16, 0.2);
    P.px(x, y, sn < -0.3 ? 0x5a8af0 : 0x2a5ad0);
  }
  P.line(321, 128, 331, 133, 0x2a5ad0); P.line(321, 129, 331, 134, 0x1e3a98); P.px(331, 135, 0x1e1a16, 0.25);
  stamp(P, 328, 142, LITTER.bag.rows, LITTER.bag.pal);
  stamp(P, 296, 147, LITTER.ears.rows, LITTER.ears.pal);
  P.hl(297, 152, 3, 0x1e4a2e, 0.6); P.hl(302, 152, 3, 0x1e4a2e, 0.6);
  // ---- fruktklistermärken och en kapsyl ----
  for (const [kx, ky, c] of [[138, 132, 0x2f8f46], [214, 170, 0x2c6fb7], [258, 150, 0xd8342c]]) { P.px(kx, ky, c); P.px(kx + 1, ky, mix(c, WHITE, 0.4)); P.px(kx + 1, ky + 1, 0x1e1a16, 0.2); }
  P.px(196, 110, 0xc8ced4); P.px(197, 110, 0x8a9096); P.px(196, 111, 0x6a7076); P.px(197, 111, 0xd8303a);
}

// ======================= bakgrunden: hallen =======================
function paintHall(mode) {
  const P = new Pix(FW, FH), night = mode === 'natt';
  // ---- taket: sågtandstakets fackverk och glaspartier (mest under topplisten) ----
  area(P, 0, 0, FW, WALL_Y, (X, Y) => {
    const v = X % 64;
    let c = v >= 44 ? (night ? qmix(0x1a2238, 0x2a3450, Y / 16, X, Y, 3) : qmix(0xd8ecf8, 0x8aaac4, Y / 16, X, Y, 3)) : jit(0x3a3e44, X, Y, 401, 0.06);
    if (v === 44 || v === 63 || (v > 44 && Y % 5 === 0)) c = 0x22262c;
    if (v < 44 && (Y * 2 + v) % 14 === 0) c = 0x2a2e34;
    return c;
  });
  rows(P, 0, 14, FW, [0x6a7078, 0x9aa0a8, 0x7a8088, 0x5a6068, 0x3a3e46, 0x22262c]);
  for (let x = 6; x < FW; x += 12) P.px(x, 15, 0xc8ced4);
  // ---- tegelväggen: sotigare upptill ----
  area(P, 0, WALL_Y, FW, BAND_Y - WALL_Y, (X, Y) => {
    let c = brickPx(X, Y, 0x8a4232, 411);
    if (bayer(X, Y) < (WALL_Y + 12 - Y) / 14) c = mul(c, 0.8);
    return c;
  });
  // målad bröstning (industrigrön) med nötta fläckar där teglet lyser igenom
  area(P, 0, BAND_Y, FW, PLINTH_Y - BAND_Y, (X, Y, i, j) => {
    if (j === 0) return 0x223e2c;
    let c = j === 1 ? 0x6a9a78 : qmix(0x4e7e5e, 0x42705a, j / 10, X, Y, 3);
    if (hash(X >> 1, Y >> 1, 412) > 0.972) return brickPx(X, Y, 0x8a4232, 411);
    if (j > 7 && hash(X >> 2, Y, 413) > 0.7) c = mul(c, 0.86);        // skoskav
    if (hash(X, 0, 414) > 0.93 && j > 3) c = mul(c, 0.94);             // rinnmärken
    return jit(c, X, Y, 415, 0.04);
  });
  rows(P, 0, PLINTH_Y, FW, [0xb0aca2, 0x8a867c, 0x5a564e]);
  area(P, 0, PLINTH_Y + 3, FW, SURF_Y - PLINTH_Y - 3, (X, Y) => jit(0x4a4842, X, Y, 416, 0.06));
  // ---- golvet: betongplattor med fogar, korn, sprickor och fläckar ----
  area(P, 0, SURF_Y, FW, FH - SURF_Y, (X, Y) => {
    const ty = Y - FLOOR_Y + 64, r = Math.floor(ty / 32), ry = ty - r * 32;
    const xx = X + (r & 1) * 24 + 48, c0 = Math.floor(xx / 48), rx = xx - c0 * 48;
    let c = mix(0x8e8a80, hash(c0, r, 421) > 0.5 ? 0x989488 : 0x847f76, 0.5 + (hash(c0, r, 422) - 0.5) * 0.7);
    c = mix(c, 0x625e56, clamp((150 - Y) / 70, 0, 1) * 0.3);
    if (ry === 31 || rx === 47) c = mul(c, 0.8);
    else if (ry === 0 || rx === 0) c = mix(c, WHITE, 0.08);
    const h = hash(X, Y, 423);
    if (h > 0.95) c = mix(c, h > 0.985 ? 0x4a463e : 0xc8c4b8, 0.3);
    if (hash(X >> 3, Y >> 2, 424) > 0.86) c = mix(c, 0x6e6a62, 0.16);
    const n = vnoise(X, Y, 46, 20, 426) * 0.7 + vnoise(X, Y, 13, 7, 427) * 0.3;
    c = n < 0.34 ? mul(c, 0.93) : n > 0.68 ? mix(c, WHITE, 0.05) : c;
    if (bayer(X, Y) < 0.25 && n > 0.36 && n < 0.4) c = mul(c, 0.96);
    return jit(c, X, Y, 425, 0.035);
  });
  // sprickor
  for (let k = 0; k < 7; k++) {
    let x = 60 + hash(k, 0, 431) * 280, y = 110 + hash(k, 1, 431) * 96;
    for (let s = 0; s < 22; s++) {
      P.px(x, y, mul(P.get(x, y), 0.68)); P.px(x, y + 1, mix(P.get(x, y + 1), WHITE, 0.1));
      x += hash(k, s, 432) > 0.3 ? 1 : 0; y += hash(k, s, 433) > 0.6 ? 1 : hash(k, s, 433) < 0.25 ? -1 : 0;
    }
  }
  // ljuspölar under lamporna och fönsterljus
  for (const lx of LAMPS) {
    P.ell(lx, 146, 62, 16, 0xfff2d0, night ? 0.2 : 0.12, 4);
    for (let y = 104; y < 150; y++) {
      const f = 1 - (y - 104) / 46, hw = 2 + ((y - 104) >> 4);
      for (let x = lx - hw; x <= lx + hw; x++) if (bayer(x, y) < f * 0.5) P.px(x, y, 0xfff4dc, 0.12);
    }
  }
  if (!night) for (const wx of WINS) P.ell(wx + WIN_W / 2 + 30, 176, 26, 6, 0xf4faff, 0.08, 3);
  // saft- och oljefläckar, en tappad druva och ett bananskal
  for (const [fx, fy, rx, c, a] of [[152, 108, 9, 0xc85a1a, 0.14], [236, 116, 6, 0x9a1a2a, 0.14], [300, 110, 7, 0xa0c040, 0.12], [70, 176, 11, 0x1a1a18, 0.2], [112, 186, 8, 0x1a1a18, 0.16], [200, 206, 7, 0x1a1a18, 0.1]]) P.ell(fx, fy, rx, rx * 0.32, c, a, 3);
  ball(P, 128, 138, 0x8a52c6); P.px(129, 141, 0x3a3432, 0.5);
  for (const [dx, dy, c] of [[0, 1, 0xd8b030], [1, 0, 0xf0cc3a], [2, 0, 0xf0cc3a], [3, 1, 0xd8b030], [4, 2, 0xb89020], [1, 1, 0x8a6a14], [2, 1, 0xfae478], [-1, 2, 0xb89020], [5, 3, 0x6a4a10], [-1, 3, 0x6a4a10], [0, 2, 0xf0cc3a], [3, 2, 0xe8c030]]) P.px(214 + dx, 124 + dy, c);
  P.hl(213, 127, 7, 0x3a3432, 0.35);
  // däckspår från trucken
  for (let x = 100; x < 250; x++) {
    const y = Math.round(188 - Math.sin((x - 100) / 150 * Math.PI) * 18);
    if (hash(x, 0, 434) > 0.35) P.px(x, y, 0x3a3832, 0.18);
    if (hash(x, 1, 434) > 0.35) P.px(x, y + 5, 0x3a3832, 0.14);
  }
  // pöl och golvbrunn under vaskaren
  for (const [cx, cy, rx, ry] of [[22, 102, 20, 4], [40, 106, 12, 3], [12, 107, 8, 2]]) P.ell(cx, cy, rx, ry, 0x9ab8c8, 0.3, 3);
  for (let x = 8; x < 50; x += 7) P.px(x, 102 + (x % 3), 0xe8f4ff, 0.5);
  area(P, 46, 108, 13, 6, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a5850 : i === 12 || j === 5 ? 0x9a968c : i % 2 ? 0x1e1e20 : 0x7a786e));
  paintFloorLitter(P);
  // bandets skugga
  [0.45, 0.55, 0.64, 0.72, 0.8, 0.86, 0.9, 0.94, 0.97].forEach((f, i) => P.darken(0, FLOOR_Y + i, FW, 1, f));
  // gulsvart varningsrand framför bandet
  for (let x = 0; x < FW; x++) for (let y = 99; y < 103; y++) {
    const worn = hash(x >> 1, y, 435) > 0.9;
    const c = (((x - y) >> 2) & 1) ? (y === 99 ? 0xf8d84a : 0xe8c030) : 0x24221e;
    P.px(x, y, worn ? mix(c, P.get(x, y), 0.55) : c);
  }
  // trucktparkeringen och packplatsen: målade linjer
  const yl = 0xe8c030;
  for (let x = 6; x <= 108; x++) for (const y of [146, 199]) if (hash(x >> 1, y, 436) < 0.92) P.px(x, y, yl, 0.9);
  for (let y = 146; y <= 199; y++) for (const x of [6, 108]) if (hash(x, y >> 1, 437) < 0.92) P.px(x, y, yl, 0.9);
  text(P, SMALL, 'TRUCK', 76, 192, yl, 0.85);
  for (let x = 280; x <= 382; x++) for (const y of [156, 206]) if ((x >> 2) % 2 === 0) P.px(x, y, yl, 0.9);
  for (let y = 156; y <= 206; y++) if ((y >> 2) % 2 === 0) P.px(280, y, yl, 0.9);
  text(P, SMALL, 'PACKNING', 234, 208, yl, 0.85);
  // pil mot packplatsen
  for (let j = 0; j < 5; j++) { const hw = 2 - Math.abs(j - 2); P.hl(272, 208 + j, hw + 1, yl, 0.85); }
  P.hl(268, 210, 4, yl, 0.85);

  // ---- fönstren ----
  for (const wx of WINS) paintWindow(P, wx, mode);
  // ---- rören ----
  // huvudröret under taket med flänsar och upphängningar
  area(P, 34, 21, SORT.x0 - 34, 3, (X, Y, i, j) => jit([0xd0d6da, 0x9aa2a6, 0x5a6266][j], X, Y, 441, 0.04));
  for (let x = 64; x < SORT.x0; x += 64) { vcols(P, x, 20, 5, [0xe8ecee, 0x8a9296, 0x4a5256]); }
  for (let x = 48; x < SORT.x0; x += 32) { P.vl(x, 18, 3, 0x3a3e44); P.hl(x - 1, 20, 3, 0x2a2e34); }
  P.darken(34, 24, SORT.x0 - 34, 1, 0.75);
  // sprinklerröret (rött) med munstycken (inga munstycken framför fönsterglaset)
  rows(P, 36, 26, SORT.x0 - 36, [0xe05a48, 0xa8281c]);
  for (let x = 70; x < SORT.x0; x += 48) { if (inWin(x, WIN_Y)) continue; P.px(x, 28, 0xd8b048); P.px(x - 1, 29, 0xa88830); P.px(x + 1, 29, 0xa88830); }
  P.darken(36, 28, SORT.x0 - 36, 1, 0.8);
  // stigarröret ner bakom bandet med ratt och manometer
  const px0 = 192;
  area(P, px0, 24, 3, RAIL_Y - 24, (X, Y, i) => jit([0xd0d6da, 0x9aa2a6, 0x5a6266][i], X, Y, 442, 0.04));
  rows(P, px0 - 1, 24, 5, [0xe8ecee, 0x7a8286]);
  for (const fy of [36, 52]) rows(P, px0 - 1, fy, 5, [0xe8ecee, 0x7a8286]);
  P.darken(px0 + 3, 25, 1, RAIL_Y - 25, 0.72);
  // ventilratten (röd, fyra ekrar)
  for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; P.px(Math.round(px0 + 1 + Math.cos(t) * 4), Math.round(44 + Math.sin(t) * 4), a < 9 ? 0xf05a48 : 0xb82a1c); }
  P.line(px0 - 2, 41, px0 + 4, 47, 0xa8281c); P.line(px0 - 2, 47, px0 + 4, 41, 0xa8281c);
  P.rect(px0, 43, 3, 3, 0x5a6266); P.px(px0 + 1, 43, 0xd0d6da);
  // manometern på en stuts
  P.hl(px0 + 3, 31, 3, 0x9aa2a6);
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const d = Math.hypot(x, y);
    if (d > 3.3) continue;
    P.px(px0 + 9 + x, 31 + y, d > 2.4 ? 0x3a3e44 : y < 0 ? 0xffffff : 0xeef0f2);
  }
  P.px(px0 + 9, 31, 0x2a2c30); P.px(px0 + 10, 30, 0xd8303a); P.px(px0 + 11, 29, 0xd8303a);
  P.px(px0 + 7, 32, 0x2f8f46); P.px(px0 + 11, 32, 0xd8303a);
  // ---- anslagstavlan: ekram, kork och lappar ----
  const { x: bx, y: by, w: bw, h: bh } = BOARD;
  P.rect(bx + 2, by + bh, bw - 1, 1, 0x1a1418, 0.35);
  area(P, bx, by, bw, bh, (X, Y, i, j) => {
    if (i < 3 || j < 3 || i >= bw - 3 || j >= bh - 3) {
      const e = Math.min(i, j, bw - 1 - i, bh - 1 - j);
      let c = [0x6a4420, 0xc89050, 0xa06a32][e] ?? 0xa06a32;
      if ((i >= bw - 3 || j >= bh - 3) && e === 1) c = 0x8a5a2a;
      return jit(c, X, Y, 451, 0.05);
    }
    let c = jit(0xc4945a, X, Y, 452, 0.12);
    const h = hash(X, Y, 453);
    if (h > 0.9) c = 0x8a5a30; else if (h < 0.08) c = 0xe0b478;
    if (j === 3) c = mul(c, 0.8);
    return c;
  });
  // skiftschemat
  const sx = bx + 104, sy = by + 5;
  P.rect(sx + 1, sy + 1, 22, 23, 0x5a3a1c, 0.4);
  area(P, sx, sy, 22, 23, (X, Y, i, j) => (j < 7 ? 0xe8eef4 : jit(0xf8f8f4, X, Y, 454, 0.03)));
  text(P, SMALL, 'SKIFT', sx + 2, sy + 1, 0x2a4a8a);
  for (let j = 0; j < 4; j++) { P.hl(sx + 1, sy + 9 + j * 4, 20, 0xb8c0c8); }
  P.vl(sx + 8, sy + 8, 14, 0xb8c0c8); P.vl(sx + 15, sy + 8, 14, 0xb8c0c8);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) if (hash(i, j, 455) > 0.4) P.hl(sx + 2 + i * 7, sy + 11 + j * 4, 4, [0x2a4a8a, 0xd8303a, 0x2f8f46][(i + j) % 3], 0.8);
  knob(P, sx + 11, sy, 1, 0x3a6ad8);
  // polaroidfoto från fabrikens personalfest
  const fx = bx + 129, fy = by + 4;
  P.rect(fx + 1, fy + 1, 14, 16, 0x5a3a1c, 0.4);
  P.rect(fx, fy, 14, 16, 0xf4f4ee);
  area(P, fx + 2, fy + 2, 10, 9, (X, Y, i, j) => (j < 4 ? 0x7ab4e0 : j < 6 ? 0x5a9a4a : 0x4a8a3a));
  P.px(fx + 4, fy + 6, 0xf4c8a0); P.px(fx + 4, fy + 7, 0xd8303a); P.px(fx + 4, fy + 8, 0x2d3a5c);
  P.px(fx + 8, fy + 5, 0x6a4226); P.px(fx + 8, fy + 6, 0xf4c8a0); P.px(fx + 8, fy + 7, 0x3a7bd5); P.px(fx + 8, fy + 8, 0x2d3a5c);
  P.px(fx + 10, fy + 3, 0xffe070);
  knob(P, fx + 7, fy, 1, 0x2f8f46);
  // gul lapp
  const nx = bx + 131, ny = by + 20;
  P.rect(nx + 1, ny + 1, 12, 10, 0x5a3a1c, 0.4);
  area(P, nx, ny, 12, 10, (X, Y, i, j) => (j === 0 ? 0xfff4a0 : 0xf8e070));
  for (let j = 0; j < 3; j++) P.hl(nx + 2, ny + 3 + j * 2, 7 - (j === 2 ? 3 : 0), 0x8a7a3a);
  // ---- lamporna: emaljskärmar med glödande lampa ----
  for (const lx of LAMPS) {
    P.vl(lx, 19, 3, 0x1e2024);
    area(P, lx - 7, 22, 15, 5, (X, Y, i, j) => {
      const half = 2 + j * 1.3;
      if (Math.abs(i - 7) > half) return null;
      if (j === 4) return Math.abs(i - 7) > half - 1 ? 0x1e3a2c : 0xf4f0e4;
      return Math.abs(i - 7) > half - 1 ? 0x1e3a2c : (i - 7 < -half / 2 ? 0x6a9a78 : j === 0 ? 0x3a6a4a : 0x2e5a3e);
    });
    P.rect(lx - 1, 27, 3, 1, 0xfff4c0); P.px(lx, 28, 0xfffae0);
    P.ell(lx, 30, 26, 11, 0xfff0c8, night ? 0.26 : 0.16, 4);
  }
  // ---- klockan på pelaren (visarna ritas levande) ----
  P.ell(CLOCK.x + 1, CLOCK.y + 1, 7, 7, 0x1a1418, 0.35, 3);
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const d = Math.hypot(x, y);
    if (d > 6.3) continue;
    let c = d > 5.4 ? 0x2a2c30 : d > 4.7 ? 0x8a9098 : y < -2 ? 0xffffff : 0xeef0f2;
    if (d > 3.6 && d <= 4.7 && (x === 0 || y === 0)) c = 0x2a2c30;
    P.px(CLOCK.x + x, CLOCK.y + y, c);
  }
  P.px(CLOCK.x - 4, CLOCK.y - 5, 0xc8ced4);
  // ---- plastbackar på en pall bakom bandet ----
  for (let k = 0; k < 4; k++) {
    const cx = 243 + (k & 1) * 17, cy = RAIL_Y - 9 - (k >> 1) * 9;
    plasticCrate(P, cx, cy, 16, 9, k >> 1 ? [0xf08c1c, 0xd8342c][k & 1] : null, 461 + k);
  }
  P.darken(242, RAIL_Y - 19, 1, 19, 0.75);
  // ---- elskåpet och brandsläckaren ----
  const ex = 321, ey = 32;
  P.vl(ex + 10, 20, ey - 20, 0x6a7078); P.vl(ex + 11, 20, ey - 20, 0x3a3e44);
  P.rect(ex + 2, ey + 1, 21, 24, 0x1a1418, 0.35);
  area(P, ex, ey, 21, 24, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0xd8dce0;
    if (i === 20 || j === 23) return 0x4a5056;
    if (i === 10) return 0x6a7076;
    return jit(qmix(0xb8bec4, 0x9aa2a8, j / 24, X, Y, 3), X, Y, 471, 0.04);
  });
  for (let j = 0; j < 5; j++) for (let i = -j; i <= j; i++) P.px(ex + 5 + i, ey + 4 + j, j === 4 || Math.abs(i) === j ? INK : 0xf0c020);
  P.px(ex + 5, ey + 6, INK); P.px(ex + 5, ey + 7, INK);
  P.rect(ex + 12, ey + 9, 2, 6, 0x2a2e34); P.px(ex + 12, ey + 9, 0x6a7076);
  for (let y = ey + 17; y < ey + 22; y += 2) P.hl(ex + 13, y, 5, 0x6a7076);
  P.rect(ex + 3, ey + 14, 5, 4, 0xf4f2ea); P.hl(ex + 4, ey + 15, 3, 0x6a7076); P.hl(ex + 4, ey + 16, 2, 0x6a7076);
  const bxx = 199;
  P.rect(bxx - 1, 45, 7, 1, 0xd8303a);
  P.rect(bxx, 49, 5, 8, 0xd8303a); P.vl(bxx, 49, 8, 0xff6a5a); P.vl(bxx + 4, 49, 8, 0x8a1a1a);
  P.rect(bxx + 1, 47, 3, 2, 0x2a2c30); P.px(bxx + 4, 48, 0x2a2c30); P.vl(bxx + 5, 48, 6, 0x2a2c30);
  P.rect(bxx + 1, 51, 3, 2, 0xf4f4ec);
  P.darken(bxx + 1, 57, 5, 1, 0.7);
  nightShade(P, mode, (x, y) => y < WALL_Y || inWin(x, y));
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}

// ======================= bandet =======================
// ramen: bakre styrlist, främre list, grönmålad balk, undersida, ben och motor
function paintBeltFrame(mode) {
  const P = new Pix(FW, FH);
  rows(P, 0, RAIL_Y, FW, [0xeef2f4, 0xc0c6ca, 0x8a9296, 0x4a5256]);
  for (let x = 16; x < FW; x += 32) { P.px(x, RAIL_Y + 1, 0x5a6266); P.px(x, RAIL_Y + 2, 0x3a4246); }
  rows(P, 0, FRONT_Y, FW, [0xf4f6f8, 0xb0b8bc, 0x6a7276]);
  area(P, 0, FRAME_Y, FW, 5, (X, Y, i, j) => {
    let c = [0x6aae7a, 0x3a8a52, 0x34804c, 0x2a6a3e, 0x1a4428][j];
    if (X % 64 === 63) c = mul(c, 0.7); else if (X % 64 === 0) c = mix(c, WHITE, 0.2);
    return jit(c, X, Y, 481, 0.05);
  });
  // nödstoppsboxar
  for (const nx of [96, 236]) {
    P.rect(nx, FRAME_Y - 1, 8, 7, 0xf0c020); P.hl(nx, FRAME_Y - 1, 8, 0xffe070); P.hl(nx, FRAME_Y + 5, 8, 0xa88010);
    knob(P, nx + 4, FRAME_Y + 2, 2, 0xe8303a);
  }
  // undersidan med returbandet
  area(P, 0, FLOOR_Y, FW, 4, (X, Y, i, j) => [0x2a2e2c, 0x1c1e1e, 0x2a302e, 0x161818][j]);
  // ben med fotplattor och stag
  for (const lx of LEGS) {
    vcols(P, lx, FLOOR_Y, 7, [0x5aa06a, 0x3a8a52, 0x1e4a2e]);
    rows(P, lx - 2, FLOOR_Y + 7, 7, [0x8a9296, 0x4a5256]);
    P.px(lx - 1, FLOOR_Y + 7, 0xd0d6da); P.px(lx + 3, FLOOR_Y + 7, 0xd0d6da);
  }
  // märkplåt LINJE 2 (sist, så att undersidan och benen inte skär av texten)
  const pw = textW(SMALL, 'LINJE 2') + 6, pxx = 160;
  area(P, pxx, FRAME_Y - 1, pw, 8, (X, Y, i, j) => (i === 0 || j === 0 ? 0xf4f6f8 : i === pw - 1 || j === 7 ? 0x6a7276 : jit(0xc8ced2, X, Y, 483, 0.04)));
  for (const nx of [pxx + 1, pxx + pw - 2]) P.px(nx, FRAME_Y + 2, 0x6a7276);
  text(P, SMALL, 'LINJE 2', pxx + 3, FRAME_Y + 1, 0x2a3034);
  P.darken(pxx + 1, FRAME_Y + 7, pw, 1, 0.6);
  // drivmotorn: kedjeskydd, växellåda och kylflänsad motor
  area(P, 324, FRAME_Y + 2, 6, 7, (X, Y, i, j) => (i === 0 ? 0xf0cc3a : i === 5 ? 0x9a7a10 : 0xe0b020));
  area(P, 320, FLOOR_Y + 1, 10, 8, (X, Y, i, j) => (j === 0 ? 0x9aa2a6 : i === 9 ? 0x3a4246 : jit(0x6a7276, X, Y, 482, 0.05)));
  area(P, 330, FLOOR_Y + 2, 14, 7, (X, Y, i, j) => {
    let c = [0x6aae7a, 0x4a9a62, 0x3a8a52, 0x34804c, 0x2a6a3e, 0x1e5030, 0x14381e][j];
    if (i % 2 === 1 && j > 0 && j < 6) c = mul(c, 0.72);
    return c;
  });
  rows(P, 318, FLOOR_Y + 9, 28, [0x5a6266, 0x2a2e30]);
  nightShade(P, mode);
  return P.flush();
}
// bandytan: grönsvart gummi med låga medbringarlister var 16:e pixel (period 48 så
// mönstret loopar). Bortre kanten ligger i skugga under styrlisten.
function paintBeltSurf(mode) {
  const P = new Pix(FW + SURF_PERIOD, SURF_H);
  area(P, 0, 0, FW + SURF_PERIOD, SURF_H, (X, Y) => {
    const k = X % SURF_PERIOD, s = k % 16;
    let c = qmix(0x2c3832, 0x4e5e56, Y / (SURF_H - 1), k, Y, 3);
    const h = hash(k, Y, 491);
    if (h > 0.88) c = mix(c, WHITE, 0.06); else if (h < 0.1) c = mul(c, 0.88);
    if (s === 0) c = mix(c, WHITE, 0.13); else if (s === 1) c = mul(c, 0.8);
    if (Y === 0) c = mul(c, 0.5); else if (Y === 1) c = mul(c, 0.72);
    if (Y === SURF_H - 1) c = mix(c, WHITE, 0.14);
    return c;
  });
  // saftfläckar (oregelbundna) som följer med bandet
  for (const [sx, sy, col] of [[6, 7, 0xc85a1a], [29, 10, 0x9a1a2a], [41, 4, 0xa0a040], [20, 3, 0xc85a1a]]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [2, 1], [1, 1], [-1, 1]]) {
      for (let x = sx + dx; x < FW + SURF_PERIOD; x += SURF_PERIOD) P.px(x, sy + dy, col, 0.22);
    }
  }
  if (mode !== 'dag') P.darken(0, 0, FW + SURF_PERIOD, SURF_H, mode === 'natt' ? 0.8 : 0.9);
  for (let x = 0; x < FW + SURF_PERIOD; x++) { const k = x % SURF_PERIOD; if (k === 13 || k === 37) { const ly = k === 13 ? 9 : 5; P.px(x, ly, 0x4a8a3a); P.px(x + 1, ly, 0x6ab04a); P.px(x + 1, ly - 1, 0x3a6a2a); } }
  return P.flush();
}

// ======================= maskinerna i ändarna (ligger framför frukterna) =======================
function paintFront(mode) {
  const P = new Pix(FW, FH);
  // ---- fruktvaskaren (vänster) ----
  // tratten med frukt som väntar
  for (let y = 19; y < 30; y++) {
    const u = (y - 19) / 11, a = Math.round(u * 4), b = 36 - Math.round(u * 4);
    for (let x = a; x < b; x++) {
      let c = y === 19 ? 0xf4f6f8 : y === 20 ? 0x8a9296 : steelPx(x, y, x - a, b - a, 501, 0.1);
      if (x === a) c = 0x5a6266; else if (x === b - 1) c = 0x4a5256;
      P.px(x, y, c);
    }
  }
  for (let k = 0; k < 10; k++) ball(P, 3 + k * 3, 19 + (k & 1), FRUIT_COLS[(k * 3) % 5]);
  for (let k = 0; k < 8; k++) ball(P, 5 + k * 3 + (k & 1), 21, FRUIT_COLS[(k * 2 + 1) % 5]);
  // tanken
  area(P, 0, 30, 34, WASH.top - 30, (X, Y, i, j) => {
    let c = steelPx(X, Y, i, 34, 502);
    if (i === 0) c = 0xf0f4f6;
    if (i >= 32) c = mul(c, i === 33 ? 0.5 : 0.72);
    if (j === 10) c = mul(c, 0.78); else if (j === 11) c = mix(c, WHITE, 0.3);
    return c;
  });
  for (let x = 3; x < 32; x += 5) { P.px(x, 39, 0x5a6266); P.px(x, 38, 0xf4f6f8); }
  for (let y = 33; y < 56; y += 4) { P.px(2, y, 0x6a7276); P.px(31, y, 0x4a5256); }
  // spolröret med munstycken överst på tanken
  rows(P, 1, 30, 32, [0xe8ecee, 0x8a9296, 0x4a5256]);
  for (let x = 4; x < 32; x += 6) { P.px(x, 33, 0x3a4246); P.px(x + 1, 33, 0x9aa2a6); }
  // nivåglaset
  area(P, 26, 36, 3, 13, (X, Y, i, j) => (i === 0 || i === 2 ? 0x5a6266 : j < 5 ? 0xc8e4f0 : j === 5 ? 0x8ac8e8 : 0x2a74aa));
  P.px(27, 37, 0xffffff);
  // varningsdekal
  for (let j = 0; j < 4; j++) for (let i = -j; i <= j; i++) P.px(8 + i, 45 + j, j === 3 || Math.abs(i) === j ? INK : 0xf0c020);
  // tittglaset: bultring, gummilist och mörkt glas (vattnet ritas levande)
  for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
    const d = Math.hypot(x, y);
    if (d > 7.6) continue;
    let c;
    if (d > 6.6) c = 0x5a6266;
    else if (d > 5.6) c = x + y < 0 ? 0xd8dee2 : 0x8a9296;
    else if (d > 4.8) c = 0x1a1a1e;
    else c = 0x0e1a24;
    P.px(WASHER_PORT.x + x, WASHER_PORT.y + y, c);
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; P.px(Math.round(WASHER_PORT.x + Math.cos(a) * 6.1), Math.round(WASHER_PORT.y + Math.sin(a) * 6.1), 0x3a4246); }
  // namnplåten
  area(P, 5, 50, 24, 7, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a6266 : i === 23 || j === 6 ? 0x14161a : 0x23262d));
  text(P, SMALL, 'TVÄTT', 8, 51, 0x9fd356);
  // inloppsröret från huvudledningen
  vcols(P, 30, 21, 9, [0xd0d6da, 0x9aa2a6, 0x5a6266]);
  rows(P, 29, 24, 5, [0xe8ecee]);
  // utloppet: ram och mörkt inre
  vcols(P, WASH.x0 - 1, WASH.top, FRONT_Y - WASH.top, [0x3a4246]);
  vcols(P, WASH.x1, WASH.top, FRONT_Y - WASH.top, [0xc8ced2, 0x8a9296, 0x5a6266, 0x3a4246]);
  vcols(P, 0, WASH.top, FRONT_Y - WASH.top, [0xf0f4f6, 0xb8bec2]);
  rows(P, 0, WASH.top, 34, [0x5a6266, 0x2a2e30]);
  area(P, WASH.x0, WASH.top + 2, WASH.x1 - WASH.x0, SURF_Y - WASH.top - 2, (X, Y, i, j) => mix(0x0a0c0c, 0x1a1e1e, j / 7));
  for (let y = SURF_Y; y < SURF_Y + SURF_H; y++) for (let x = WASH.x0; x < WASH.x1; x++) P.px(x, y, 0x0a0c0c, 0.75 - (x - WASH.x0) / 40);
  // underredet: droppskål, knappar och ben
  area(P, 0, FRONT_Y, 34, 8, (X, Y, i, j) => {
    if (j === 0) return 0xf0f4f6;
    if (j === 7) return 0x3a4246;
    return steelPx(X, Y, i, 34, 503);
  });
  P.rect(4, FRONT_Y + 2, 10, 4, 0x2a2e30); P.hl(4, FRONT_Y + 2, 10, 0x5a6266);
  knob(P, 7, FRONT_Y + 4, 1, 0x2f9f4a); knob(P, 11, FRONT_Y + 4, 1, 0xd8303a);
  P.rect(18, FRONT_Y + 3, 12, 2, 0x5a6266); P.hl(18, FRONT_Y + 3, 12, 0x2a2e30);
  for (const lx of [2, 29]) { vcols(P, lx, FLOOR_Y, 7, [0xd0d6da, 0x8a9296, 0x4a5256]); rows(P, lx - 1, FLOOR_Y + 7, 5, [0x5a6266]); }
  // ---- sorteringsmaskinen (höger) ----
  const x0 = SORT.x0, sw = FW - x0;
  // signaltornet
  vcols(P, x0 + 4, 29, 3, [0x8a9296, 0x4a5256]);
  area(P, x0 + 2, TOWER_Y, 6, 9, (X, Y, i, j) => (j < 3 ? 0x6a1a14 : j < 6 ? 0x6a5010 : 0x14401e));
  P.hl(x0 + 2, TOWER_Y - 1, 6, 0x2a2e30); P.hl(x0 + 3, TOWER_Y - 2, 4, 0x2a2e30);
  P.hl(x0 + 2, TOWER_Y + 9, 6, 0x2a2e30);
  // kroppen: grönmålad stålplåt med paneler
  area(P, x0, 32, sw, SORT.top - 32, (X, Y, i, j) => {
    if (j === 0) return 0x8ac89a;
    if (i === 0) return 0x7aba8a;
    let c = qmix(0x4a9a62, 0x3a7a4e, j / 30, X, Y, 3);
    if (i === 1 || i === sw - 2) c = mul(c, 0.8);
    if (j === 16) c = mul(c, 0.7); else if (j === 17) c = mix(c, WHITE, 0.2);
    return jit(c, X, Y, 511, 0.05);
  });
  // skärmen (innehållet ritas levande)
  area(P, x0 + 5, 35, 30, 13, (X, Y, i, j) => (i === 0 || j === 0 ? 0x1e4a2e : i === 29 || j === 12 ? 0x8ac89a : 0x0a1a12));
  // namnplåten
  area(P, x0 + 1, 49, sw - 2, 7, (X, Y, i, j) => (j === 0 ? 0xf4f6f8 : j === 6 ? 0x6a7276 : 0xd0d6da));
  text(P, SMALL, 'SORTERING', x0 + 2, 50, 0x1e4a2e);
  for (const nx of [x0 + 3, FW - 3]) { P.px(nx, 36, 0x1e4a2e); P.px(nx, 46, 0x1e4a2e); }
  // tunnelöppningen där bandet går in
  vcols(P, x0, SORT.top, FRONT_Y - SORT.top, [0x7aba8a, 0x4a9a62, 0x3a8a52, 0x2a6a3e, 0x1e4a2e, 0x0e2014]);
  rows(P, x0, SORT.top, sw, [0x2a6a3e, 0x14301e]);
  area(P, SORT.tx0, SORT.top + 2, FW - SORT.tx0, SURF_Y - SORT.top - 2, (X, Y, i, j) => mix(0x0a0c0c, 0x1a1e1e, j / 7));
  for (let y = SURF_Y; y < SURF_Y + SURF_H; y++) for (let x = SORT.tx0; x < FW; x++) P.px(x, y, 0x0a0c0c, 0.35 + (x - SORT.tx0) / 50);
  // sockeln med knappar
  area(P, x0, FRONT_Y, sw, FLOOR_Y + 7 - FRONT_Y, (X, Y, i, j) => {
    if (j === 0) return 0x8ac89a;
    if (j === FLOOR_Y + 6 - FRONT_Y) return 0x14301e;
    return jit(j > 10 ? 0x2a6a3e : 0x3a8a52, X, Y, 512, 0.05);
  });
  P.rect(x0 + 5, FRONT_Y + 3, 20, 6, 0x23262d); P.hl(x0 + 5, FRONT_Y + 3, 20, 0x5a6266);
  knob(P, x0 + 9, FRONT_Y + 6, 2, 0x2f9f4a);
  knob(P, x0 + 20, FRONT_Y + 6, 2, 0xe8303a);
  P.rect(x0 + 13, FRONT_Y + 5, 3, 3, 0xf0c020);
  P.darken(x0 - 3, 32, 3, FLOOR_Y + 7 - 32, 0.85);
  nightShade(P, mode);
  return P.flush();
}
const WASHER_PORT = { x: 16, y: 41 }, TOWER_Y = 20;
// förgrunden: UTGÅNG-skylten nere till vänster
function paintFore() {
  const P = new Pix(FW, FH);
  const s = 'UTGÅNG', tw = textW(SMALL, s), w = tw + 20, x = 3, y = 202;
  P.rect(x, y, w, 11, 0x0e4a24);
  P.rect(x + 1, y + 1, w - 2, 9, 0x1e8a3a);
  P.hl(x + 1, y + 1, w - 2, 0x5ac06a);
  // pil åt vänster och springande gubbe
  for (let j = 0; j < 5; j++) { const hw = 2 - Math.abs(j - 2); P.hl(x + 3 + (2 - hw), y + 3 + j, hw + 1, WHITE); }
  const man = ['.#..', '###.', '.#.#', '.##.', '#..#'];
  man.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === '#') P.px(x + w - 7 + i, y + 3 + j, WHITE); });
  text(P, SMALL, s, x + 8, y + 3, WHITE);
  return P.flush();
}

// personalen: en kollega i vit rock och hygienmössa bakom bandet
const WORKER = {
  skin: '#e0a97f', hair: '#3b2619', style: 'short', hat: 'beanie', cap: '#eef0f2', top: 'jacket', shirt: '#eef0f2', accent: '#2f8f46',
  bottom: 'pants', pants: '#2e4a3a', shoes: '#1c1c1c', glasses: false, beard: false, build: 5, bag: null,
};

// ======================= cachen (per ljusläge) =======================
const ART = {};
function art(mode) {
  if (!ART[mode]) ART[mode] = { hall: paintHall(mode), belt: paintBeltFrame(mode), surf: paintBeltSurf(mode), front: paintFront(mode) };
  if (!ART.fore) ART.fore = paintFore();
  return { ...ART[mode], fore: ART.fore };
}
// tittglasets pixlar (för det levande vattnet)
const PORT_PX = [];
for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Math.hypot(x, y) <= 4.7) PORT_PX.push([x, y]);
// linje med heltalspixlar direkt på canvasen (klockvisare)
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

export function makeJobbFrukt(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const walker = createWalker({ top: BELT_Y + 14, bottom: FH - 6, spawn: [120, 140] });
  walker.setObstacles([
    [BOX.x - 2, BOX.y - 10, BOX.x + BOX.w + 2, BOX.y + BOX.h],
    [TRUCK.x + 2, TRUCK.y - 14, TRUCK.x + 92, TRUCK.y],
    [STACK.x - 1, STACK.y - 14, FW, STACK.y],
    [BIN.x - 1, BIN.y - 8, BIN.x + 21, BIN.y],
    [MOP.x - 1, MOP.y - 8, MOP.x + 16, MOP.y],
    [JACK.x - 7, JACK.y - 8, JACK.x + 46, JACK.y],
    [CRATES.x, CRATES.y - 6, CRATES.x + 20, CRATES.y],
  ]);
  const pops = makePops();
  let items = [], t = 0, seq = 0, spawnIn = 0.8, carry = null, done = false, doneT = 0, reported = false;
  let order = newOrder(seq++), boxFlash = 0;
  const speed = () => 22 + 12 * Math.min(1, t / SHIFT_SECONDS);

  // bara för syns skull: ljusläget, bandets läge, lådans innehåll, kollegan
  const startMin = A.game?.min ?? 12 * 60;
  const mode = viewMode(((startMin + 120) / 60) % 24);
  const G = art(mode);
  const NK = mode === 'natt' ? 0.8 : mode === 'skymning' ? 0.9 : 1, nc = (c) => css(mul(c, NK));
  const AXLE = [0x1e4a2e, 0x9aa2a6, 0xd8dee2, 0x3a4246].map(nc), FLAP = [0x4a5652, 0x343e3a, 0x1e2624].map(nc);
  let beltOff = 0, orderNo = 100 + ((Math.random() * 300) | 0), slipIn = 0.6, sortBlink = 0, sorted = 0;
  let packed = [], shown = [];
  const rejects = [];
  const crew = { x: 298, tx: 298, wait: 1.5, lift: 0, dir: 'down', walking: false };

  function updateVisuals(dt) {
    slipIn = Math.max(0, slipIn - dt);
    sortBlink = Math.max(0, sortBlink - dt);
    for (const r of rejects) { r.t += dt; r.x += r.vx * dt; r.vy += 260 * dt; r.y += r.vy * dt; }
    for (let i = rejects.length - 1; i >= 0; i--) if (rejects[i].t > 0.9) rejects.splice(i, 1);
    if (boxFlash <= 0) shown = packed;
    // kollegan går mellan fönstren, stannar och lyfter backar ibland
    if (crew.lift > 0) crew.lift -= dt;
    if (crew.wait > 0) {
      crew.walking = false;
      crew.wait -= dt;
      if (crew.wait <= 0) crew.tx = CREW_STOPS[(Math.random() * CREW_STOPS.length) | 0];
    } else {
      const d = crew.tx - crew.x;
      if (Math.abs(d) < 1) { crew.x = crew.tx; crew.wait = 2 + Math.random() * 4; crew.dir = 'down'; if (Math.random() < 0.45) crew.lift = 1.4; }
      else { crew.walking = true; crew.x += Math.sign(d) * Math.min(Math.abs(d), 14 * dt); crew.dir = d < 0 ? 'left' : 'right'; }
    }
  }

  // levande: klockvisare, lampflimmer, ånga, lysdioder
  function drawWallLive(ctx) {
    const m = startMin + (Math.min(t, SHIFT_SECONDS) / SHIFT_SECONDS) * 240;
    const ma = ((m % 60) / 60) * Math.PI * 2, ha = (((m / 60) % 12) / 12) * Math.PI * 2;
    ctx.fillStyle = '#2a2c30';
    pline(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(ha) * 2.6, CLOCK.y - Math.cos(ha) * 2.6);
    ctx.fillStyle = '#4a4e56';
    pline(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(ma) * 4, CLOCK.y - Math.cos(ma) * 4);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(CLOCK.x, CLOCK.y, 1, 1);
    // högra lampan glappar ibland
    const fl = (t * 1.3) % 9;
    if (fl > 8.2 && Math.floor(t * 20) % 3 === 0) { ctx.fillStyle = '#6a6250'; ctx.fillRect(LAMPS[1] - 1, 27, 3, 1); ctx.fillRect(LAMPS[1], 28, 1, 1); }
    // manometernålen darrar
    ctx.fillStyle = '#d8303a'; ctx.fillRect(203 + (Math.sin(t * 9) > 0.6 ? 0 : 1), 30 - (Math.sin(t * 9) > 0.6 ? 1 : 0), 1, 1);
    // ånga pyser ur ventilen då och då
    const st = (t * 0.7) % 4;
    if (st < 1.2) {
      for (let k = 0; k < 4; k++) {
        const a = st - k * 0.18;
        if (a < 0) continue;
        const px = Math.round(198 + a * 10 + k), py = Math.round(44 - a * 8 - (k & 1));
        ctx.fillStyle = `rgba(240,244,248,${Math.max(0, 0.55 - a * 0.45).toFixed(2)})`;
        ctx.fillRect(px, py, 2 + (a > 0.6 ? 1 : 0), 2);
      }
    }
    // elskåpets lysdiod
    ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#5aff8a' : '#1e5a2a'; ctx.fillRect(335, 48, 2, 1);
  }

  // levande: ordersedeln på anslagstavlan (glider ner när en ny order sätts upp)
  function drawSlip(ctx) {
    const n = order.need.length, w = 6 + n * 29, h = 25;
    const x = BOARD.x + 5, y = BOARD.y + 4 - Math.round(slipIn * 10);
    ctx.save();
    ctx.beginPath(); ctx.rect(BOARD.x + 3, BOARD.y + 3, BOARD.w - 6, BOARD.h - 6); ctx.clip();
    ctx.fillStyle = 'rgba(60,34,14,0.4)'; ctx.fillRect(x + 1, y + 1, w, h);
    ctx.fillStyle = '#f4f0e4'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fffcf4'; ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = '#d8d0bc'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y + 1, 1, h - 1);
    ctx.fillStyle = '#e8e0cc'; ctx.fillRect(x + w - 3, y + h - 3, 2, 2);
    ctxText(ctx, SMALL, 'PACKA:', x + 3, y + 3, '#9e1b22');
    const nr = 'NR ' + orderNo;
    ctxText(ctx, SMALL, nr, x + w - 3 - textW(SMALL, nr), y + 3, '#7a7262');
    ctx.fillStyle = '#b8b0a0';
    for (let i = x + 2; i < x + w - 2; i += 2) ctx.fillRect(i, y + 10, 1, 1);
    order.need.forEach((nd, i) => {
      const ix = x + 1 + i * 29, ok = nd.got >= nd.n;
      ctx.drawImage(fruitSprite(nd.f), ix, y + 10);
      ctxText(ctx, SMALL, `${nd.got}/${nd.n}`, ix + 15, y + 13, ok ? '#2f8f46' : '#17151a');
      if (ok) { ctx.fillStyle = '#2f8f46'; for (const [dx, dy] of [[0, 2], [1, 3], [2, 2], [3, 1], [4, 0]]) ctx.fillRect(ix + 17 + dx, y + 19 + dy, 1, 1); }
    });
    // nålen
    ctx.fillStyle = '#6a1a14'; ctx.fillRect(x + (w >> 1) - 1, y - 1, 3, 3);
    ctx.fillStyle = '#e8303a'; ctx.fillRect(x + (w >> 1) - 1, y - 1, 2, 2);
    ctx.fillStyle = '#ffb0a0'; ctx.fillRect(x + (w >> 1) - 1, y - 1, 1, 1);
    ctx.restore();
  }

  function drawBelt(ctx) {
    const off = Math.floor(beltOff) % SURF_PERIOD;
    ctx.drawImage(G.surf, SURF_PERIOD - 1 - off, 0, FW, SURF_H, 0, SURF_Y, FW, SURF_H);
    ctx.drawImage(G.belt, 0, 0);
    // rullarnas axeltappar i ramen snurrar
    const ph = Math.floor(beltOff / 2) % 4;
    for (let x = 8; x < FW; x += 16) {
      if (x > 158 && x < 196) continue;
      ctx.fillStyle = AXLE[0]; ctx.fillRect(x - 1, FRAME_Y + 1, 5, 3);
      ctx.fillStyle = AXLE[1]; ctx.fillRect(x, FRAME_Y + 1, 3, 3);
      ctx.fillStyle = AXLE[2]; ctx.fillRect(x, FRAME_Y + 1, 3, 1);
      ctx.fillStyle = AXLE[3]; ctx.fillRect(x + [0, 1, 2, 1][ph], FRAME_Y + 2 + (ph === 1 ? 1 : 0), 1, 1);
    }
  }

  // levande: gummiridåerna i utloppen trycks undan av frukterna
  function drawCurtains(ctx) {
    const strips = (x0, x1, y0, y1, c0, c1, c2) => {
      for (let sx = x0; sx < x1; sx += 3) {
        let push = 0;
        for (const it of items) {
          const d = Math.abs(it.x - (sx + 1));
          if (d < 9) push = Math.max(push, 9 - d);
        }
        const lift = Math.min(6, Math.round(push * 0.8)), shove = Math.min(3, Math.round(push / 3));
        const len = y1 - y0 - lift, bend = Math.floor(len * 0.5);
        for (const [i, c] of [[0, c0], [1, c1], [2, c2]]) {
          ctx.fillStyle = c;
          ctx.fillRect(sx + i, y0, 1, bend);
          ctx.fillRect(sx + i + shove, y0 + bend, 1, len - bend);
        }
      }
    };
    strips(WASH.x0, WASH.x1, WASH.top + 2, FRONT_Y - 1, 'rgba(120,160,150,0.75)', 'rgba(80,120,110,0.75)', 'rgba(40,60,56,0.8)');
    strips(SORT.tx0, FW, SORT.top + 2, FRONT_Y - 1, ...FLAP);
  }

  // levande: vattnet i tittglaset, droppar, sorteringsskärmen och signaltornet
  function drawGadgets(ctx) {
    const { x: cx, y: cy } = WASHER_PORT;
    for (const [dx, dy] of PORT_PX) {
      const lvl = -1 + Math.round(Math.sin(t * 3 + dx * 0.7));
      let c;
      if (dy < lvl) c = '#12202a';
      else if (dy === lvl) c = '#8ac8e8';
      else c = dy > 2 ? '#1e5a8a' : '#2a74aa';
      ctx.fillStyle = c; ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
    // en frukt snurrar runt i vattnet + bubblor
    const fa = t * 2.2, fx = Math.round(cx + Math.cos(fa) * 2.4), fy = Math.round(cy + 1 + Math.sin(fa) * 1.6);
    ctx.fillStyle = '#d8342c'; ctx.fillRect(fx - 1, fy - 1, 3, 3);
    ctx.fillStyle = '#ff8a7a'; ctx.fillRect(fx - 1, fy - 1, 1, 1);
    ctx.fillStyle = '#d8f0ff';
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.9 + k * 0.27) % 1, bx = cx - 3 + ((k * 5) % 7), by = Math.round(cy + 4 - ph * 7);
      if (Math.hypot(bx - cx, by - cy) < 4.4) ctx.fillRect(bx, by, 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(cx - 3, cy - 3, 2, 1); ctx.fillRect(cx - 3, cy - 2, 1, 1);
    // droppar från utloppet ner i pölen
    const dp = (t * 1.4) % 1;
    ctx.fillStyle = 'rgba(200,230,250,0.8)'; ctx.fillRect(26, Math.round(FLOOR_Y + dp * 12), 1, 2);
    if (dp > 0.9) { ctx.fillStyle = 'rgba(220,240,255,0.6)'; ctx.fillRect(24, 101, 5, 1); }
    // sorteringsskärmen: antal frukter som gått vidare + löpande stapel
    const sx = SORT.x0 + 6, sy = 36;
    ctxText(ctx, SMALL, 'SORT', sx + 1, sy + 1, '#5ad06a');
    ctxText(ctx, SMALL, String(sorted).padStart(3, '0'), sx + 1, sy + 6, sortBlink > 0 ? '#ffe070' : '#5ad06a');
    ctx.fillStyle = '#1e5a2a'; ctx.fillRect(sx + 17, sy + 1, 10, 10);
    const bars = [3, 6, 4, 8, 5];
    for (let k = 0; k < 5; k++) {
      const bh = Math.max(1, Math.round(bars[(k + Math.floor(t * 3)) % 5] * (0.6 + 0.4 * Math.sin(t * 2 + k))));
      ctx.fillStyle = '#5ad06a'; ctx.fillRect(sx + 18 + k * 2, sy + 11 - bh, 1, bh);
    }
    // signaltornet: grönt = kör, gult blinkar när en frukt åker in, rött när passet är slut
    const x0 = SORT.x0;
    ctx.fillStyle = done ? '#ff3a2a' : '#6a1a14'; ctx.fillRect(x0 + 2, TOWER_Y, 6, 3);
    ctx.fillStyle = sortBlink > 0 && Math.floor(t * 12) % 2 ? '#ffd040' : '#6a5010'; ctx.fillRect(x0 + 2, TOWER_Y + 3, 6, 3);
    ctx.fillStyle = done ? '#14401e' : '#5aff8a'; ctx.fillRect(x0 + 2, TOWER_Y + 6, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x0 + 3, TOWER_Y, 1, 9);
  }

  const crewDrawable = () => ({
    draw(ctx) {
      const f = crew.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : crew.lift > 0 ? [7, 8, 9, 8][Math.floor(t * 6) % 4] : (Math.sin(t * 1.5) > 0.93 ? 4 : 0);
      drawPerson(ctx, Math.round(crew.x), 70, WORKER, crew.dir, f);
    },
  });
  const boxDrawable = () => ({
    fy: BOX.y + 10,
    draw(ctx) {
      const B = boxArt(mode), list = boxFlash > 0 ? shown : packed;
      ctx.drawImage(B.back, B.x, B.y);
      for (let k = 0; k < list.length && k < PACK_POS.length; k++) {
        const [dx, dy] = PACK_POS[k];
        ctx.drawImage(fruitSprite(list[k]), BOX.x + dx - FC + 2, BTOP + dy - FC - 1);
      }
      ctx.drawImage(B.front, B.x, B.y);
      if (boxFlash > 0) {
        // full låda: guldkant som pulserar och en KLAR-stämpel på etiketten
        const on = Math.floor(boxFlash * 10) % 2 === 0;
        ctx.fillStyle = on ? '#ffd23f' : '#e8a020';
        ctx.fillRect(BOX.x - 2, BTOP - 9, BOX.w + 4, 1); ctx.fillRect(BOX.x - 2, BOX.y + 25, BOX.w + 4, 1);
        ctx.fillRect(BOX.x - 2, BTOP - 9, 1, BOX.y + 26 - BTOP + 9); ctx.fillRect(BOX.x + BOX.w + 1, BTOP - 9, 1, BOX.y + 26 - BTOP + 9);
        ctx.fillStyle = '#2f8f46'; ctx.fillRect(BOX.x + 18, BTOP + 7, 20, 8);
        ctxText(ctx, SMALL, 'KLAR', BOX.x + 20, BTOP + 9, '#f4f1ea');
      }
    },
  });
  const truckDrawable = () => ({
    fy: TRUCK.y,
    draw(ctx) {
      const T = truckArt(mode);
      ctx.drawImage(T.img, T.x, T.y);
      const [bx, by] = T.beacon, ph = Math.floor(t * 3) % 4;
      ctx.fillStyle = '#ffb040'; ctx.fillRect(bx - 1 + [0, 1, 2, 1][ph], by + 1, 1, 1);
      if (ph === 1) { ctx.fillStyle = 'rgba(255,180,60,0.35)'; ctx.fillRect(bx - 3, by - 1, 7, 4); }
    },
  });
  const sprDrawable = (fy, get) => ({ fy, draw(ctx) { const S = get(mode); ctx.drawImage(S.img, S.x, S.y); } });
  const props = () => [sprDrawable(STACK.y, stackArt), sprDrawable(BIN.y, binArt), sprDrawable(MOP.y, mopArt), sprDrawable(JACK.y, jackArt), sprDrawable(CRATES.y, cratesArt)];

  return {
    _debug: {
      forcePick() { const it = items[0]; if (!it) return null; carry = { f: it.f }; items.shift(); return carry; },
      forceDrop() { if (!carry) return null; dropInBox(); return stats; },
      needFruit() { const slot = order.need.find((n) => n.got < n.n); return slot ? slot.f : -1; },
      setCarry(f) { carry = { f }; },
      stats,
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      boxFlash = Math.max(0, boxFlash - dt);
      updateVisuals(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      walker.update(dt);
      beltOff += speed() * dt;
      if (beltOff > 1e6) beltOff -= SURF_PERIOD * 20000;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 1.6 - 0.5 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 43) * 0.4;
        const wanted = order.need.filter((n) => n.got < n.n).map((n) => n.f);
        const f = Math.random() < 0.6 && wanted.length ? wanted[(Math.random() * wanted.length) | 0] : (Math.random() * FRUITS.length) | 0;
        items.push({ f, x: -8 });
        seq++;
      }
      for (const it of items) it.x += speed() * dt;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].x > FW + 8) { items.splice(i, 1); stats.miss++; sorted++; sortBlink = 0.5; }
    },
    down(x, y) {
      if (done) return;
      // UTGÅNG nere till vänster → samma fråga som Escape (ingen lön om man går)
      if (x < EXIT.x1 && y >= EXIT.y0) {
        walker.walkTo(EXIT.wx, EXIT.wy, () => { if (!done) abortShift(A); });
        return;
      }
      // klick på en frukt på bandet → gå dit och plocka
      if (y < BELT_Y + 16 && !carry) {
        let best = null, bd = 1e9;
        for (const it of items) { const d = Math.abs(it.x - x); if (d < 16 && d < bd) { best = it; bd = d; } }
        if (best) {
          const target = best;
          walker.walkTo(Math.max(12, Math.min(FW - 12, target.x + speed() * 0.9)), BELT_Y + 18, () => {
            const i = items.indexOf(target);
            if (i >= 0 && Math.abs(target.x - walker.px) < 16) { items.splice(i, 1); carry = { f: target.f }; play('ok'); }
            else { play('miss'); pops.add(walker.px, walker.py - 30, 'MISSADE!', '#d8d2c0'); }
          });
          return;
        }
      }
      // klick på lådan → bär dit och släpp
      if (x > BOX.x - 8 && x < BOX.x + BOX.w + 8 && y > BOX.y - 20) {
        walker.walkTo(BOX.x - 8, BOX.y + 8, () => { if (carry) dropInBox(); });
        return;
      }
      walker.walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(G.hall, 0, 0);
      drawWallLive(ctx);
      drawSlip(ctx);
      crewDrawable().draw(ctx);
      drawBelt(ctx);
      // frukterna på bandet
      for (const it of items) drawFruit(ctx, it.f, it.x, BELT_Y);
      ctx.drawImage(G.front, 0, 0);
      drawCurtains(ctx);
      drawGadgets(ctx);

      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry }), boxDrawable(), truckDrawable(), ...props()];
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      if (carry) drawFruit(ctx, carry.f, walker.px, walker.py - 44); // frukten över huvudet
      // fel frukt studsar ut ur lådan
      for (const r of rejects) ctx.drawImage(fruitSprite(r.f), Math.round(r.x) - FC, Math.round(r.y) - FC);
      ctx.drawImage(G.fore, 0, 0);

      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'FRUKTFABRIKEN' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  function dropInBox() {
    const slot = order.need.find((n) => n.f === carry.f && n.got < n.n);
    if (slot) {
      slot.got++; stats.ok++;
      packed = [...packed, carry.f];
      play('ok'); pops.add(BOX.x + BOX.w / 2, BOX.y - 16, '+' + 4, '#8ee03c');
      if (order.need.every((n) => n.got >= n.n)) {
        stats.boxes++; boxFlash = 0.8;
        shown = packed; packed = [];
        play('box'); pops.add(BOX.x + BOX.w / 2, BOX.y - 24, 'LÅDA KLAR! +20', '#ffd23f');
        order = newOrder(seq++);
        orderNo++; slipIn = 0.6;
      }
    } else {
      stats.fel++; play('fel'); pops.add(BOX.x + BOX.w / 2, BOX.y - 16, 'FEL FRUKT!', '#ff6a6a');
      rejects.push({ f: carry.f, x: BOX.x + BOX.w / 2, y: BTOP - 4, vx: -40 - Math.random() * 30, vy: -110, t: 0 });
    }
    carry = null;
  }
}
