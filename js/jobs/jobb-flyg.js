// Flygplatsen – bagagejobbet med kroppen: väskor med färgade destinations-
// taggar rullar in på bandet. Klicka på en väska så hämtar figuren den och
// bär den till rätt vagn (A/B/C/D). Fel vagn ger avdrag, väskor som rullar
// förbi räknas som missade.
//
// Bagagehallen ritas på stadens detaljnivå: stora fönster ut mot plattan där
// flygplan och bagagetåg taxar förbi, ett lamellband med rullar och gummi-
// ridåer, röntgenmaskin med skärm, vagnar med kapell och last, personal bakom
// bandet. Allt statiskt målas EN gång i lager (cachas per ljusläge) – bara det
// som rör sig ritas varje bildruta. Ett pixelkorn: heltal, skala 1.
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { drawPerson } from '../core/people.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const BELT_Y = 72;
const TAG = [
  { ch: 'A', c: '#d9433b', ci: 0xd9433b, dest: 'LONDON' }, { ch: 'B', c: '#2c6fb7', ci: 0x2c6fb7, dest: 'OSLO' },
  { ch: 'C', c: '#2f8f46', ci: 0x2f8f46, dest: 'PARIS' }, { ch: 'D', c: '#e8b230', ci: 0xe8b230, dest: 'ROM' },
];
const CARTS = TAG.map((t, i) => ({ ...t, x: 26 + i * 92, y: 186, w: 60 }));
const CASE_COLORS = [0x6a5030, 0x4a4a52, 0x2aa39a, 0x8e5bd1, 0x9a3a4a, 0x3a5a7c];

// ---------- hallens mått ----------
const GY0 = 22, GY1 = 46;              // fönsterglaset (rader)
const WIN_X0 = 28;                     // vänstra pelaren slutar här
const MULLS = [28, 76, 124, 172, 220, 268, 316, 364];
const RAIL_Y = 59, SURF_Y = 62, SURF_H = 18, FLOOR_Y = 90;
const HATCH = { x0: 4, x1: 26, y0: 47, y1: 80 };        // luckan där väskorna kommer in
const XR = { x0: 348, top: 38, tx0: 352, ty0: 56, ty1: 81 }; // röntgenmaskinen
const EXIT = { x0: 338, y0: 198, wx: 370, wy: 189 };     // UTGÅNG nere till höger
const WHITE = 0xffffff, INK = 0x17151a;

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
// glasreflex: diagonala strimmor och en ljusare överkant
function reflect(P, x, y, w, h, str = 1, seed = 0, tint = 0xeef7ff) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, s = ((((X + seed) * 2 - Y * 3) % 61) + 61) % 61;
    let a = s < 4 ? 0.2 : s < 6 ? 0.1 : s === 12 || s === 13 ? 0.08 : 0;
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
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
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

// ======================= väskorna =======================
// Tre sorters väskor (hårt skal, mjuk resväska med remmar, bag) – vilken avgörs
// av färgen, så samma väska ser likadan ut på bandet, i famnen och i vagnen.
const CASE_SPR = new Map();
function caseSprite(body, cat) {
  const key = body + ':' + cat;
  let c = CASE_SPR.get(key);
  if (c) return c;
  const P = new Pix(24, 19), style = Math.max(0, CASE_COLORS.indexOf(body)) % 3;
  const ox = 11, oy = 11; // (x, y) i väskans koordinater → (ox + x, oy + y)
  const hi = mix(body, WHITE, 0.3), lo = mul(body, 0.72), dk = mul(body, 0.55), line = mix(mul(body, 0.4), 0x1c1418, 0.45);
  const put = (x, y, col) => P.px(ox + x, oy + y, col);
  if (style === 0) {
    // hårt skal: rundade hörn, räfflor, teleskophandtag och hjul
    for (let y = -8; y <= 5; y++) for (let x = -10; x <= 9; x++) {
      const cx = x < -8 ? -8 - x : x > 7 ? x - 7 : 0, cy = y < -6 ? -6 - y : y > 3 ? y - 3 : 0;
      if (cx + cy > 2) continue;
      let col = x === -10 || x === 9 || y === -8 || y === 5 || cx + cy === 2 ? line : body;
      if (col === body) {
        if (y === -7 || x === -9) col = hi;
        else if (x === 8 || y === 4) col = lo;
        else if (x === -5 || x === -1 || x === 3) col = mix(body, WHITE, 0.16);
        else if (x === -4 || x === 0 || x === 4) col = mul(body, 0.84);
        col = jit(col, x, y, 3, 0.05);
      }
      put(x, y, col);
    }
    for (const x of [-4, 3]) { put(x, -9, 0x3a3e46); put(x, -10, 0x3a3e46); }
    for (let x = -4; x <= 3; x++) put(x, -11, x === -4 || x === 3 ? 0x3a3e46 : 0x5a6068);
    put(-9, 6, INK); put(-8, 6, 0x3a3e46); put(7, 6, 0x3a3e46); put(8, 6, INK);
  } else if (style === 1) {
    // mjuk resväska: dragkedja runt om, två remmar med spännen, bärhandtag
    for (let y = -8; y <= 5; y++) for (let x = -10; x <= 9; x++) {
      if ((x === -10 || x === 9) && (y === -8 || y === 5)) continue;
      let col = x === -10 || x === 9 || y === -8 || y === 5 ? line : body;
      if (col === body) {
        if (y === -7) col = hi;
        else if (y === 4 || x === 8) col = lo;
        else if (y === -5) col = dk;                    // dragkedjan
        else if (y > -3 && y < 3 && (x === -7 || x === 6)) col = dk; // framficka
        else if (y === 3 && x > -7 && x < 6) col = dk;
        col = jit(col, x, y, 4, 0.07);
      }
      put(x, y, col);
    }
    const strap = hash(body, 1, 7) > 0.5 ? 0x2a2c30 : 0xd8c8a0;
    for (const sx of [-5, 3]) for (let y = -8; y <= 5; y++) { put(sx, y, strap); put(sx + 1, y, mul(strap, 0.8)); }
    for (const sx of [-5, 3]) { put(sx, -2, 0xd8dce2); put(sx + 1, -2, 0x9aa0a8); }
    for (let x = -3; x <= 2; x++) put(x, -10, 0x2a2c30);
    put(-3, -9, 0x2a2c30); put(2, -9, 0x2a2c30);
    for (let x = -9; x <= 8; x += 2) put(x, -5, mix(dk, 0xd8dce2, 0.4));
  } else {
    // bag: rundade gavlar, dragkedja på toppen, två handtagsbågar
    for (let y = -6; y <= 5; y++) for (let x = -10; x <= 9; x++) {
      const ex = x < -5 ? (x + 5) : x > 4 ? (x - 4) : 0, ey = (y + 0.5) / 6.2;
      if (Math.hypot(ex / 5.6, ey) > 1 && ex !== 0) continue;
      const edge = Math.hypot(ex / 5.6, ey) > 0.84 && ex !== 0 || y === -6 || y === 5;
      let col = edge ? line : x < -5 || x > 4 ? mul(body, 0.8) : body;
      if (!edge) {
        if (y === -5) col = hi;
        else if (y === 4) col = lo;
        if (x === -5 || x === 4) col = dk;
        col = jit(col, x, y, 5, 0.06);
      }
      put(x, y, col);
    }
    for (let x = -4; x <= 3; x++) put(x, -4, x % 2 ? 0xd8dce2 : 0x8a9098);
    for (const hx of [-6, 1]) { put(hx, -7, 0x2a2c30); put(hx + 1, -8, 0x2a2c30); put(hx + 2, -8, 0x2a2c30); put(hx + 3, -7, 0x2a2c30); }
  }
  // destinationstaggen: snöre + stor färgbricka med bokstav (ska synas på långt håll)
  const tag = TAG[cat];
  put(1, -9, 0xd8dce2); put(2, -8, 0xd8dce2);
  P.rect(ox + 2, oy - 7, 10, 10, INK);
  P.rect(ox + 3, oy - 6, 8, 8, tag.ci);
  P.hl(ox + 3, oy - 6, 8, mix(tag.ci, WHITE, 0.35));
  P.hl(ox + 3, oy + 1, 8, mul(tag.ci, 0.75));
  text(P, SMALL, tag.ch, ox + 6, oy - 4, cat === 3 ? INK : WHITE);
  c = P.flush();
  CASE_SPR.set(key, c);
  return c;
}
export function drawCase(ctx, it, x, y) {
  ctx.drawImage(caseSprite(it.body, it.cat), Math.round(x) - 11, Math.round(y) - 11);
}
// liten väska i vagnen (10×8) med taggens färg som prick
const MINI = new Map();
function miniCase(body, cat) {
  const key = body + ':' + cat;
  let c = MINI.get(key);
  if (c) return c;
  const P = new Pix(10, 8), line = mix(mul(body, 0.4), 0x1c1418, 0.45);
  area(P, 0, 1, 10, 7, (X, Y, i, j) => {
    if ((i === 0 || i === 9) && (j === 0 || j === 6)) return null;
    if (i === 0 || i === 9 || j === 0 || j === 6) return line;
    return j === 1 ? mix(body, WHITE, 0.3) : j === 5 ? mul(body, 0.72) : jit(body, X, Y, 8, 0.06);
  });
  P.hl(3, 0, 4, 0x2a2c30);
  P.rect(6, 3, 3, 3, TAG[cat].ci); P.px(6, 3, mix(TAG[cat].ci, WHITE, 0.4));
  c = P.flush();
  MINI.set(key, c);
  return c;
}

// ======================= vagnarna =======================
// Bagagevagn med kapell (taggens färg + destination), gallervägg, sidolämmar,
// stort bokstavsmärke, chassi, dragstång och hjul. Bak- och framdel målas var
// för sig så att lasten hamnar emellan.
const CART_OX = 14, CART_OY = 33, CART_W = 80, CART_H = 46;
let CART_ART = null;
function cartArt() {
  if (CART_ART) return CART_ART;
  CART_ART = CARTS.map((cart) => {
    const B = new Pix(CART_W, CART_H), F = new Pix(CART_W, CART_H), w = cart.w, col = cart.ci;
    const X = (x) => x + CART_OX, Y = (y) => y + CART_OY; // vagnens (0,0) = (cart.x, cart.y)
    // ---- baksidan: skugga, galler, golv ----
    B.ell(X(w / 2), Y(9), 36, 3.6, 0x1a1418, 0.5, 4);
    area(B, X(3), Y(-24), w - 6, 14, (x, y, i, j) => {
      if (j === 6) return 0x7a8088;
      if (i % 4 === 0) return j < 6 ? 0x8a9098 : 0x7a8088;
      return qmix(0x3a3e46, 0x2a2c32, j / 14, x, y, 3);
    });
    rows(B, X(2), Y(-11), w - 4, [0xb8bec6, 0x8a9098]);
    // ---- framsidan ----
    // kapellet (rullat tak) med destinationen
    area(F, X(-2), Y(-32), w + 4, 8, (x, y, i, j) => {
      if (j === 0) return mix(col, WHITE, 0.45);
      if (j === 7) return mul(col, 0.5);
      if (j === 6) return mul(col, 0.7);
      let c = j === 1 ? mix(col, WHITE, 0.2) : col;
      if ((i + 3) % 12 === 0) c = mul(c, 0.86);
      return jit(c, x, y, 21, 0.05);
    });
    F.px(X(-2), Y(-32), 0); F.px(X(w + 1), Y(-32), 0);
    F.erase(X(-2), Y(-32), 1, 1); F.erase(X(w + 1), Y(-32), 1, 1);
    const dw = textW(SMALL, cart.dest), dx = X(((w - dw) >> 1));
    text(F, SMALL, cart.dest, dx + 1, Y(-30) + 1, mul(col, 0.45));
    text(F, SMALL, cart.dest, dx, Y(-30), cart.ch === 'D' ? INK : WHITE);
    rows(F, X(-1), Y(-24), w + 2, [0x2a2c30]);
    // hörnstolpar
    for (const px of [1, w - 3]) { vcols(F, X(px), Y(-23), 20, [0xe0e4ea, 0x9aa0a8]); F.px(X(px), Y(-23), WHITE); }
    // sidolämmen i vagnens färg med räfflor, nitar och reflexer
    area(F, X(0), Y(-12), w, 10, (x, y, i, j) => {
      if (j === 0) return mix(col, WHITE, 0.4);
      if (j === 9) return mul(col, 0.5);
      if (i === 0) return mix(col, WHITE, 0.25);
      if (i === w - 1) return mul(col, 0.62);
      let c = j < 3 ? mix(col, WHITE, 0.08) : j > 6 ? mul(col, 0.88) : col;
      if (i % 8 === 4) c = mul(c, 0.84);
      else if (i % 8 === 5) c = mix(c, WHITE, 0.12);
      return jit(c, x, y, 22, 0.05);
    });
    for (const nx of [2, w - 3]) for (const ny of [-10, -5]) { F.px(X(nx), Y(ny), mix(col, WHITE, 0.6)); F.px(X(nx), Y(ny + 1), mul(col, 0.5)); }
    F.rect(X(3), Y(-5), 3, 2, 0xff5a2a); F.px(X(3), Y(-5), 0xffb090);
    F.rect(X(w - 6), Y(-5), 3, 2, 0xff5a2a); F.px(X(w - 6), Y(-5), 0xffb090);
    // bokstavsmärket: vit rundel med bokstaven i vagnens (mörkare) färg
    const bcx = X(w >> 1), bcy = Y(-8);
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y);
      if (d > 7.3) continue;
      F.px(bcx + x, bcy + y, d > 6.4 ? INK : d > 5.4 ? mul(col, 0.8) : y < -3 ? 0xffffff : 0xf0f2f4);
    }
    const lb = BIG[cart.ch], lx = bcx - (lb.w >> 1), lc = cart.ch === 'D' ? 0x9a6a10 : mul(col, 0.85);
    text(F, BIG, cart.ch, lx, bcy - 3, lc);
    // chassi, dragstång, koppling
    rows(F, X(-1), Y(-2), w + 2, [0x6a7078, 0x3a3e46, 0x2a2c30]);
    for (let x = 4; x < w - 2; x += 10) F.px(X(x), Y(-1), 0x9aa0a8);
    rows(F, X(-10), Y(0), 10, [0x8a9098, 0x4a4e56]);
    for (const [ix, iy] of [[-13, -1], [-12, -1], [-11, -1], [-14, 0], [-10, 0], [-14, 1], [-10, 1], [-13, 2], [-12, 2], [-11, 2]]) F.px(X(ix), Y(iy), 0x5a6068);
    F.px(X(-13), Y(-1), 0xaab0b8);
    F.rect(X(w), Y(-1), 3, 2, 0x4a4e56); F.px(X(w + 2), Y(-1), 0x8a9098);
    // hjul: bakre skymtar, främre med nav
    for (const wx of [9, w - 13]) {
      area(F, X(wx), Y(0), 5, 5, (x, y, i, j) => (((i === 0 || i === 4) && (j === 0 || j === 4)) ? null : j === 0 ? 0x3a3a40 : 0x141418));
    }
    for (const wx of [4, w - 11]) {
      area(F, X(wx), Y(1), 7, 8, (x, y, i, j) => {
        if ((i === 0 || i === 6) && (j === 0 || j === 7)) return null;
        if (i >= 2 && i <= 4 && j >= 2 && j <= 5) return i === 2 && j === 2 ? 0xe8ecf0 : i === 4 || j === 5 ? 0x6a7078 : 0xaab0b8;
        return j === 0 || i === 0 ? 0x3a3a42 : 0x1a1a1e;
      });
    }
    return { back: B.flush(), front: F.flush() };
  });
  return CART_ART;
}

// ======================= flygplanen =======================
const LIVERY = [0x2a6ad0, 0xd8303a, 0x1e8a7a, 0xe07a1e];
const PLANE_W = 80, PLANE_H = 23;
const PLANES = new Map();
function planeSprite(liv, dir, night) {
  const key = liv + ':' + dir + ':' + night;
  let c = PLANES.get(key);
  if (c) return c;
  const P = new Pix(PLANE_W, PLANE_H), lv = LIVERY[liv];
  const put = (u, y, col, a = 1) => P.px(dir > 0 ? u : PLANE_W - 1 - u, y, col, a);
  const body = night ? 0xa8b0c0 : 0xf2f4f6, belly = night ? 0x7a8292 : 0xc8ccd2, line = night ? 0x3a4250 : 0x6a7078;
  const top = (u) => (u > 66 ? 9 + Math.round(((u - 66) / 11) ** 2 * 3.5) : 9);
  const bot = (u) => (u < 14 ? 15 - Math.round(((14 - u) / 14) * 4.5) : u > 64 ? 15 - Math.round(((u - 64) / 13) ** 1.5 * 3) : 15);
  // stjärtfenan (bakom kroppen)
  for (let y = 0; y <= 9; y++) {
    const u0 = Math.round(1 + y * 0.15), u1 = Math.round(5 + y * 1.05);
    for (let u = u0; u <= u1; u++) {
      let col = u === u1 ? mix(lv, WHITE, 0.35) : y === 0 ? mix(lv, WHITE, 0.2) : u === u0 ? mul(lv, 0.7) : lv;
      if (night) col = mul(col, 0.7);
      put(u, y, col);
    }
  }
  for (const [u, y] of [[5, 3], [6, 3], [5, 4], [6, 4], [7, 4], [6, 5]]) put(u, y, night ? 0xb8c0cc : WHITE); // loggan
  // höjdrodret
  for (let u = 0; u < 10; u++) put(u, 10, u < 8 ? 0x9aa0a8 : 0x6a7078);
  // kroppen
  for (let u = 0; u < 78; u++) {
    const t0 = top(u), b0 = bot(u);
    for (let y = t0; y <= b0; y++) {
      let col = y === t0 ? mix(body, WHITE, 0.6) : y >= b0 - 1 ? belly : body;
      if (y === b0) col = line;
      if (y === 13 && u > 10 && u < 70) col = night ? mul(lv, 0.75) : lv;       // fuskstrecket
      if (y === 14 && u > 12 && u < 66) col = mul(belly, 0.95);
      put(u, y, col);
    }
  }
  // fönster, dörrar, cockpit
  for (let u = 18; u < 62; u += 2) if (u !== 26 && u !== 56) put(u, 11, night ? 0xffe6a0 : 0x2a3440);
  for (const du of [15, 59]) { for (let y = 10; y <= 13; y++) { put(du, y, line); put(du + 2, y, line); } put(du + 1, 10, line); }
  for (let u = 69; u <= 72; u++) put(u, 10, 0x1e2630);
  put(70, 11, 0x1e2630); put(71, 11, 0x1e2630);
  put(69, 10, night ? 0x9ab0d0 : 0x6a8aa8);
  // vingen (sedd från sidan) + motor under
  for (let u = 30; u <= 50; u++) { put(u, 15, 0x8a9098); if (u > 33 && u < 49) put(u, 16, 0x5a6068); }
  put(30, 14, 0x9aa0a8); put(30, 13, 0x9aa0a8);
  for (let u = 44; u <= 55; u++) {
    const cs = [0xeef0f2, 0xc8ccd2, 0xaab0b8, 0x7a8088];
    for (let j = 0; j < 4; j++) put(u, 16 + j, u === 55 ? (j === 0 ? 0x9aa0a8 : 0x2a2c30) : u === 44 ? 0x5a6068 : night ? mul(cs[j], 0.75) : cs[j]);
  }
  put(47, 15, 0x6a7078); put(48, 15, 0x6a7078);
  // landningsställ
  for (let y = 15; y <= 19; y++) put(66, y, 0x5a6068);
  put(65, 20, 0x1a1a1e); put(66, 20, 0x1a1a1e); put(67, 20, 0x1a1a1e); put(66, 21, 0x1a1a1e);
  for (let y = 16; y <= 19; y++) put(37, y, 0x5a6068);
  for (const u of [34, 35, 36, 38, 39, 40]) { put(u, 20, 0x1a1a1e); put(u, 21, 0x1a1a1e); }
  put(35, 20, 0x5a5a60); put(39, 20, 0x5a5a60);
  // markskugga
  for (let u = 8; u < 74; u++) put(u, 22, 0x1a1418, u < 20 || u > 66 ? 0.12 : 0.25);
  c = P.flush();
  PLANES.set(key, c);
  return c;
}

// ======================= bakgrunden: själva hallen =======================
// Ljusläge efter tiden mitt i passet: dag, skymning eller natt ute på plattan.
const VIEW = {
  dag: { top: 0x5a98d8, hor: 0xd2eaf6, cloud: 0xffffff, hill: 0x8aa2b0, tree: 0x4a6a58, grass: 0x7aa05a, runway: 0x6a6c70, apron: [0xa2a4a2, 0xbcbeba], pole: 0x6a7078, hangar: 0xd0d4d8 },
  skymning: { top: 0x3a3c7a, hor: 0xf4a878, cloud: 0xffb898, hill: 0x6a5a7a, tree: 0x2e2a3a, grass: 0x4a5238, runway: 0x4a4a54, apron: [0x747078, 0x86828a], pole: 0x3a3a44, hangar: 0x9a8a98 },
  natt: { top: 0x0a1030, hor: 0x2a3462, cloud: 0x3a4470, hill: 0x1e2444, tree: 0x0e121e, grass: 0x162016, runway: 0x2a2c34, apron: [0x3a3e4a, 0x4a4e5a], pole: 0x2a2e36, hangar: 0x4a5064 },
};
function viewMode(h) { return h >= 20.5 || h < 6.5 ? 'natt' : h >= 18 ? 'skymning' : 'dag'; }

function paintView(P, mode) {
  const V = VIEW[mode], night = mode === 'natt';
  const x0 = WIN_X0, w = FW - x0;
  // himlen
  area(P, x0, GY0, w, 12, (X, Y) => qmix(V.top, V.hor, (Y - GY0) / 12, X, Y, 4));
  if (night) {
    for (let y = GY0; y < GY0 + 10; y++) for (let x = x0; x < FW; x++) if (hash(x, y, 31) > 0.987) P.px(x, y, 0xffffff, 0.4 + hash(x, y, 32) * 0.5);
    P.ell(300, 26, 3, 3, 0xf4f0d8, 0.9, 3); P.px(299, 25, 0xffffff); // månen
  } else {
    for (let k = 0; k < 8; k++) {
      const cx = x0 + 20 + k * 46 + Math.round(hash(k, 0, 33) * 18), cy = GY0 + 3 + Math.round(hash(k, 1, 33) * 4);
      const rx = 7 + hash(k, 2, 33) * 8;
      P.ell(cx, cy, rx, 2.4, V.cloud, 0.8, 3);
      P.ell(cx - rx * 0.3, cy - 1, rx * 0.5, 2, V.cloud, 0.7, 3);
      for (let x = Math.round(cx - rx * 0.8); x < cx + rx * 0.8; x++) P.px(x, Math.round(cy + 2), mix(V.cloud, V.hor, 0.4), 0.5);
    }
  }
  // avlägsna kullar och trädrand
  for (let x = x0; x < FW; x++) {
    const hy = 31 + Math.round(Math.sin(x * 0.05) * 1.2 + Math.sin(x * 0.13 + 2) * 0.8);
    for (let y = hy; y < 35; y++) P.px(x, y, V.hill);
    const ty = 33 - (hash(x >> 1, 0, 34) > 0.55 ? 1 : 0) - (hash(x >> 2, 1, 34) > 0.8 ? 1 : 0);
    for (let y = ty; y < 35; y++) P.px(x, y, y === ty ? mix(V.tree, V.hill, 0.3) : V.tree);
  }
  // hangaren med välvt tak
  for (let x = 44; x < 104; x++) {
    const u = (x - 74) / 30, ty = 27 + Math.round(u * u * 3);
    for (let y = ty; y < 35; y++) {
      let c = y === ty ? mix(V.hangar, WHITE, 0.3) : V.hangar;
      if (y > 29 && x > 52 && x < 96) c = (x - 52) % 6 === 0 ? mul(V.hangar, 0.7) : mul(V.hangar, 0.84);
      P.px(x, y, c);
    }
  }
  text(P, SMALL, 'HANGAR 2', 58, 28, night ? 0x8a90a8 : 0x3a5a8a, 0.8);
  // bränsletankar
  for (const [tx, tw] of [[150, 9], [161, 7]]) {
    area(P, tx, 30, tw, 5, (X, Y, i, j) => (j === 0 ? mix(V.hangar, WHITE, 0.4) : i === tw - 1 ? mul(V.hangar, 0.7) : V.hangar));
    P.hl(tx, 32, tw, mul(V.hangar, 0.85));
  }
  // flygledartornet långt bort
  vcols(P, 232, 24, 11, [mix(V.hangar, WHITE, 0.2), mul(V.hangar, 0.8)]);
  area(P, 228, 21, 10, 4, (X, Y, i, j) => (j === 0 ? mul(V.hangar, 0.6) : night ? 0x9ae8c8 : (i % 3 === 0 ? 0x2a3a44 : 0x5a8a98)));
  P.px(233, 20, night ? 0xff4a3a : 0x6a7078);
  // gräs, rullbana, gräs
  P.hl(x0, 35, w, V.grass);
  for (let x = x0; x < FW; x++) P.px(x, 36, x % 10 < 3 ? (night ? 0x8a8a70 : 0xe8ecf0) : V.runway);
  P.hl(x0, 37, w, mul(V.grass, 0.9));
  if (night) for (let x = x0 + 4; x < FW; x += 9) { P.px(x, 35, 0xffe8a0); P.px(x + 4, 37, 0xffe8a0, 0.8); }
  // plattan: betong med fogar, oljefläckar, taxilinje
  area(P, x0, 38, w, GY1 - 38, (X, Y) => {
    let c = qmix(V.apron[0], V.apron[1], (Y - 38) / 8, X, Y, 3);
    if (Y === 41 || (X - x0) % 26 === 0) c = mul(c, 0.9);
    return jit(c, X, Y, 35, 0.05);
  });
  for (let k = 0; k < 6; k++) P.ell(x0 + 30 + k * 57 + hash(k, 3, 36) * 20, 43, 5 + hash(k, 4, 36) * 5, 1.2, 0x2a2a30, 0.22, 3);
  const yl = night ? 0xa89030 : 0xe8c030;
  P.hl(x0, 44, w, yl);
  for (let i = 0; i <= 10; i++) { const u = i / 10; P.px(Math.round(200 + u * 26), Math.round(44 - Math.sin(u * 1.57) * 4), yl); }
  for (let x = 226; x < FW; x++) P.px(x, 40, yl);
  // blå kantljus
  for (let x = x0 + 10; x < FW; x += 22) P.px(x, 39, night ? 0x5a8aff : 0x3a5a9a);
  // strålkastarmaster
  for (const mx of [118, 300]) {
    P.vl(mx, 24, 17, V.pole); P.vl(mx + 1, 24, 17, mul(V.pole, 0.7));
    P.rect(mx - 2, 23, 6, 2, night ? 0xfff0c0 : 0x5a6068);
    if (night) P.ell(mx + 1, 42, 22, 3, 0xfff0c0, 0.25, 4);
  }
  // trappbil och koner på plattan
  const sx = 336;
  P.rect(sx, 40, 14, 3, night ? 0x6a6e78 : 0xe8ecf0); P.rect(sx + 10, 38, 4, 2, night ? 0x4a5060 : 0x3a5a8a);
  for (let k = 0; k < 7; k++) P.px(sx + 1 + k, 39 - (k >> 1), night ? 0x8a7a40 : 0xf0c020);
  P.px(sx + 2, 43, INK); P.px(sx + 11, 43, INK);
  for (const cx of [190, 204, 322]) { P.px(cx, 43, 0xf07a1e); P.px(cx, 42, 0xffb070); P.hl(cx - 1, 44, 3, 0xd8601a); }
}

function paintHall(mode) {
  const P = new Pix(FW, FH);
  // ---- taket (mest dolt bakom topplisten) ----
  area(P, 0, 0, FW, 18, (X, Y) => {
    let c = jit(0x2e323a, X, Y, 40, 0.05);
    if (Y % 9 === 0 || X % 48 === 0) c = 0x24272e;
    if ((Y === 7 || Y === 8) && X % 96 > 20 && X % 96 < 76) c = Y === 7 ? 0xf4f8ff : 0xc8d0dc;
    return c;
  });
  rows(P, 0, 18, FW, [0xd8dce2, 0xaab0b8]);
  for (let x = 24; x < FW; x += 48) { P.hl(x - 1, 19, 3, 0xfff6d8); P.px(x, 18, 0xffffff); }
  // ---- fönstren ut mot plattan (själva vyn; ramen ligger i ett eget lager) ----
  paintView(P, mode);
  // ---- väggen under fönstren: aluminiumpaneler ----
  area(P, 0, 49, FW, RAIL_Y - 49, (X, Y) => {
    let c = qmix(0xcfd3d8, 0xb0b5bb, (Y - 49) / 10, X, Y, 3);
    if (MULLS.includes(X)) c = 0x8a9098;
    else if (MULLS.includes(X - 1)) c = 0xe4e8ec;
    return jit(c, X, Y, 41, 0.03);
  });
  P.darken(0, 49, FW, 1, 0.72);
  // skylt: BAGAGE 3
  const bs = 'BAGAGE 3', bw = textW(SMALL, bs) + 13, bx = 36;
  P.rect(bx, 50, bw, 9, 0x23262d); P.box(bx, 50, bw, 9, 0x4a4e56); P.hl(bx + 1, 50, bw - 2, 0x5a5e66);
  area(P, bx + 2, 52, 6, 5, (X, Y, i, j) => (j === 0 ? (i === 2 || i === 3 ? 0xffd23a : null) : 0xffd23a));
  P.px(bx + 3, 54, 0x23262d); P.px(bx + 4, 54, 0x23262d);
  text(P, SMALL, bs, bx + 10, 52, 0xffd23a);
  // destinationstavlan: bokstav = stad
  const chipsW = TAG.reduce((a, t) => a + 13 + textW(SMALL, t.dest) + 7, 0) - 7 + 8;
  const lx0 = 196 - (chipsW >> 1);
  P.rect(lx0, 49, chipsW, 10, 0x1e2026); P.box(lx0, 49, chipsW, 10, 0x4a4e56); P.hl(lx0 + 1, 49, chipsW - 2, 0x6a6e76);
  let lx = lx0 + 4;
  for (let i = 0; i < TAG.length; i++) {
    const t = TAG[i];
    P.rect(lx, 50, 9, 8, t.ci); P.hl(lx, 50, 9, mix(t.ci, WHITE, 0.35)); P.hl(lx, 57, 9, mul(t.ci, 0.7));
    text(P, SMALL, t.ch, lx + 3, 51, i === 3 ? INK : WHITE);
    text(P, SMALL, t.dest, lx + 12, 52, 0xf4f4ec);
    lx += 13 + textW(SMALL, t.dest) + 7;
    if (i < 3) P.vl(lx - 4, 51, 6, 0x3a3e46);
  }
  // klocka (visarna ritas levande) + brandsläckare
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    const d = Math.hypot(x, y);
    if (d > 5.3) continue;
    P.px(CLOCK.x + x, CLOCK.y + y, d > 4.4 ? 0x2a2c30 : d > 3.6 && (Math.abs(x) < 1 || Math.abs(y) < 1) ? 0x2a2c30 : y < -2 ? 0xffffff : 0xeef0f2);
  }
  P.darken(CLOCK.x - 4, CLOCK.y + 6, 9, 1, 0.8);
  const fx = 322;
  P.rect(fx, 52, 5, 7, 0xd8303a); P.vl(fx, 52, 7, 0xff6a5a); P.vl(fx + 4, 52, 7, 0x8a1a1a);
  P.rect(fx + 1, 50, 3, 2, 0x2a2c30); P.px(fx + 4, 51, 0x2a2c30); P.vl(fx + 5, 51, 5, 0x2a2c30);
  P.rect(fx + 1, 54, 3, 2, 0xf4f4ec);
  P.rect(fx - 1, 49, 7, 1, 0xd8303a);
  // ---- golvet: slipad terrazzo med fogar, korn och fönsterspeglingar ----
  area(P, 0, FLOOR_Y, FW, FH - FLOOR_Y, (X, Y) => {
    const ty = Y - FLOOR_Y, r = Math.floor(ty / 16), ry = ty - r * 16;
    const xx = X + (r & 1) * 16 + 64, c0 = Math.floor(xx / 32), rx = xx - c0 * 32;
    let c = mix(0xbdb9ae, hash(c0, r, 11) > 0.5 ? 0xc6c2b8 : 0xb2aea4, 0.5 + (hash(c0, r, 12) - 0.5) * 0.6);
    c = mix(c, 0x9a968c, clamp((140 - Y) / 50, 0, 1) * 0.35);
    if (ry === 15 || rx === 31) c = mul(c, 0.86);
    else if (ry === 0 || rx === 0) c = mix(c, WHITE, 0.1);
    const h = hash(X, Y, 13);
    if (h > 0.94) c = mix(c, h > 0.978 ? 0x5a564e : WHITE, 0.32);
    else if (h < 0.035) c = mix(c, 0xc89868, 0.28);
    return jit(c, X, Y, 14, 0.035);
  });
  // speglingar av fönstren i golvet
  for (let k = 0; k < MULLS.length; k++) {
    const pc = MULLS[k] + 24;
    for (let y = FLOOR_Y + 4; y < FLOOR_Y + 60; y++) {
      const tt = (y - FLOOR_Y - 4) / 56;
      for (let x = pc - 16; x < pc + 16; x++) if (x >= 0 && x < XR.x0 && bayer(x, y) < (1 - tt) * 0.55) P.px(x, y, mode === 'natt' ? 0x8a9ab8 : 0xf4faff, 0.1);
    }
  }
  // spotljus från taket
  for (const cx of [72, 168, 264, 356]) P.ell(cx, 150, 30, 7, 0xfff8e8, 0.16, 4);
  // skugga under bandet
  [0.55, 0.68, 0.8, 0.9].forEach((f, i) => P.darken(0, FLOOR_Y + i, FW, 1, f));
  // gul säkerhetslinje + text
  for (let x = 0; x < FW; x++) for (const y of [96, 97]) {
    const worn = hash(x >> 1, y, 15) > 0.9;
    P.px(x, y, worn ? mix(0xe8c030, P.get(x, y), 0.6) : y === 96 ? 0xf0cc3a : 0xd8b028);
  }
  const st = 'STÅ BAKOM LINJEN', stw = textW(SMALL, st);
  for (const sx of [60, 250]) text(P, SMALL, st, sx, 100, 0xd8b028, 0.85);
  void stw;
  // en borttappad nalle och avrivna bagagelappar på golvet
  const TX = 236, TY = 128, fur = 0xa8703a, furD = 0x7a4a22, furL = 0xc89058;
  P.ell(TX + 4, TY + 7, 9, 2, 0x3a3228, 0.3, 3);
  for (const [dx, dy, c] of [[0, 1, furD], [0, 0, fur], [8, 0, fur], [8, 1, furD], [-1, 4, fur], [-2, 5, furD], [9, 4, fur], [10, 5, furD], [2, 7, fur], [2, 8, furD], [6, 7, fur], [6, 8, furD]]) P.px(TX + dx, TY + dy, c);
  area(P, TX + 1, TY + 1, 7, 5, (X, Y, i, j) => ((i === 0 || i === 6) && (j === 0 || j === 4) ? null : j === 0 ? furL : i === 6 || j === 4 ? furD : fur));
  area(P, TX + 1, TY + 5, 7, 3, (X, Y, i, j) => ((i === 0 || i === 6) && j === 2 ? null : j === 2 ? furD : i < 2 ? furL : fur));
  P.px(TX + 3, TY + 2, INK); P.px(TX + 5, TY + 2, INK); P.px(TX + 4, TY + 3, 0x3a2418);
  P.rect(TX + 3, TY + 4, 3, 1, 0xd8303a);
  P.px(TX + 4, TY + 6, furL);
  for (const [lx, ly, c] of [[112, 118, 0xd9433b], [288, 138, 0x2c6fb7], [70, 136, 0xe8b230], [170, 112, 0x2f8f46]]) {
    P.rect(lx, ly, 4, 2, 0xf4f2ea); P.px(lx + 3, ly, c); P.px(lx + 3, ly + 1, c); P.px(lx, ly + 2, 0x6a6860, 0.4);
  }
  // pöl vid VÅTT GOLV-skylten
  for (const [cx, cy, rx, ry] of [[24, 136, 16, 3], [36, 139, 9, 2]]) P.ell(cx, cy, rx, ry, 0xd8e8f4, 0.3, 3);
  for (let x = 12; x < 44; x += 6) P.px(x, 135 + (x % 3), 0xffffff, 0.6);
  // golvbrunn
  area(P, 186, 142, 13, 6, (X, Y, i, j) => (i === 0 || j === 0 || i === 12 || j === 5 ? 0x6a6860 : i % 2 ? 0x2a2a2e : 0x8a8880));
  // servicelucka i golvet: stålram, halkskyddsrutor, lyftspår och bultar
  const HX = 126, HY = 118, HW = 16, HH = 10;
  area(P, HX - 1, HY - 1, HW + 2, HH + 2, (X, Y, i, j) => {
    const lx = i - 1, ly = j - 1;
    if (lx < 0 || ly < 0 || lx === HW || ly === HH) return mul(P.get(X, Y), lx < 0 || ly < 0 ? 0.72 : 0.9);  // fogen runt
    if (ly === 0) return 0xd6d2c8;
    if (lx === 0) return 0xb4b0a6;
    if (ly === HH - 1 || lx === HW - 1) return 0x66645c;
    let c = (lx & 1) === 0 && (ly & 1) === 0 ? 0xaaa69c : 0x8a867e;
    if (lx + ly < 5) c = mix(c, WHITE, 0.12);
    if (hash(X, Y, 16) > 0.9) c = mix(c, 0x8a6a4a, 0.3);
    return c;
  });
  for (const bx of [3, HW - 4]) { P.hl(HX + bx - 1, HY + 4, 3, 0x2a2826); P.hl(HX + bx - 1, HY + 5, 3, 0xc8c4ba); }
  for (const [bx, by] of [[1, 1], [HW - 2, 1], [1, HH - 2], [HW - 2, HH - 2]]) P.px(HX + bx, HY + by, 0x4a4840);
  // målade pilar mot vagnarna och gummimärken där vagnarna svängt in
  for (const cart of CARTS) {
    const ax = cart.x + (cart.w >> 1);
    for (let y = 138; y <= 147; y++) {
      const hw = y < 143 ? 1 : 147 - y;
      for (let x = ax - hw; x <= ax + hw; x++) {
        const worn = hash(x, y, 18) > 0.86;
        P.px(x, y, worn ? mix(0xf0cc3a, P.get(x, y), 0.6) : y === 138 || x === ax - hw ? 0xf8d850 : 0xe8c030, 0.9);
      }
    }
    for (let k = 0; k < 2; k++) for (let s = 0; s <= 40; s++) {
      const u = s / 40, x = Math.round(cart.x - 4 + u * 44 + k * 3), y = Math.round(147 - Math.sin(u * Math.PI) * 5 - k * 3);
      if (hash(x, y, 19 + k) > 0.3) P.px(x, y, 0x2a2622, 0.13);
    }
  }
  // tuggummi och klackmärken
  for (let k = 0; k < 10; k++) {
    const gx = Math.round(40 + hash(k, 0, 17) * 290), gy = Math.round(104 + hash(k, 1, 17) * 44);
    P.px(gx, gy, 0x6a665e, 0.55); P.px(gx + 1, gy, 0x8a867e, 0.35);
    const mx = Math.round(30 + hash(k, 2, 17) * 310), my = Math.round(102 + hash(k, 3, 17) * 40);
    P.hl(mx, my, 2 + (k % 3), 0x1e1c1a, 0.2);
  }
  // ett par bortglömda solglasögon
  const GLX = 300, GLY = 112;
  P.ell(GLX + 5, GLY + 3, 6, 1.4, 0x3a3228, 0.22, 3);
  ['.KKK.KKK.', 'KLGKKKLLK', 'KLLK.KLLK', '.KK...KK.'].forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch !== '.') P.px(GLX + i, GLY + j, ch === 'K' ? 0x1a1a1e : ch === 'G' ? 0xe8f0ff : j === 1 ? 0x3a5a7a : 0x243a52);
    }
  });
  P.line(GLX, GLY + 1, GLX - 3, GLY - 2, 0x2a2a30); P.line(GLX + 8, GLY + 1, GLX + 10, GLY - 2, 0x2a2a30);
  // parkeringsrutor för vagnarna
  for (const cart of CARTS) {
    const x0 = cart.x - 8, x1 = cart.x + cart.w + 7, y0 = 150, y1 = 200;
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if ((x >> 2) % 2 === 0) P.px(x, y, 0xf0cc3a, 0.9);
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) if ((y >> 2) % 2 === 0) P.px(x, y, 0xf0cc3a, 0.9);
    text(P, BIG, cart.ch, cart.x + cart.w + 1, 203, mix(cart.ci, 0xbdb9ae, 0.35), 0.9);
  }
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
const CLOCK = { x: 308, y: 54 };

// fönsterramen: spröjs, överstycke, bröstning och reflexer (ligger över planen)
function paintWinFrame(mode) {
  const P = new Pix(FW, FH);
  rows(P, 0, 20, FW, [0x5a6068, 0x3a3e46]);
  reflect(P, WIN_X0, GY0, FW - WIN_X0, GY1 - GY0, mode === 'natt' ? 0.35 : 0.8, 3, mode === 'natt' ? 0x9fb4d8 : 0xeef7ff);
  for (const mx of MULLS) {
    vcols(P, mx, GY0, GY1 - GY0, [0xe4e8ec, 0x9aa0a8, 0x4a5058]);
    P.px(mx + 1, GY0 + 11, 0x6a7078);
  }
  P.hl(WIN_X0, GY0 + 11, FW - WIN_X0, 0x6a7078, 0.35);
  rows(P, 0, GY1, FW, [0xeef0f4, 0xb8bec6, 0x6a7078]);
  return P.flush();
}

// bandet: bakre räcke, stötfångare, sidoplåt, undersida med rullar och ben
function paintBeltFrame() {
  const P = new Pix(FW, FH);
  rows(P, 0, RAIL_Y, FW, [0xeef2f6, 0xb8bec6, 0x7a8088]);
  for (let x = 6; x < FW; x += 32) P.px(x, RAIL_Y + 1, 0x5a6068);
  rows(P, 0, SURF_Y + SURF_H, FW, [0x5a5e66, 0x2a2c30, 0x16171a]);
  area(P, 0, 83, FW, 3, (X, Y, i, j) => {
    let c = [0xd0d6dc, 0xb4bac2, 0x8a9098][j];
    if (X % 64 === 63) c = 0x5a6068;
    else if (X % 64 === 0) c = mix(c, WHITE, 0.3);
    return jit(c, X, Y, 42, 0.04);
  });
  for (let x = 8; x < FW; x += 16) if (x % 64 !== 0) P.px(x, 84, 0x5a6068);
  // nödstoppslådor längs bandet
  for (const nx of [98, 226]) {
    P.rect(nx, 82, 7, 5, 0xf0c020); P.hl(nx, 82, 7, 0xffe070); P.hl(nx, 86, 7, 0xa88010);
    knob(P, nx + 3, 84, 1, 0xe8303a);
  }
  // undersidan: mörkt, returbandet och bärande ben
  area(P, 0, 86, FW, 4, (X, Y, i, j) => [0x2a2c32, 0x1c1e22, 0x16171a, 0x1c1e22][j]);
  P.hl(0, 88, FW, 0x3a3e46);
  for (let x = 30; x < FW; x += 64) {
    vcols(P, x, 86, 6, [0x9aa0a8, 0x6a7078, 0x3a3e46]);
    rows(P, x - 1, 91, 5, [0x5a6068]);
  }
  return P.flush();
}
// bandytan: gummilameller som överlappar som fjäll (period 64 så mönstret loopar)
const SURF_PERIOD = 64;
function paintBeltSurf() {
  const P = new Pix(FW + SURF_PERIOD, SURF_H);
  area(P, 0, 0, FW + SURF_PERIOD, SURF_H, (X, Y) => {
    const s = X % 8, k = Math.floor((X % SURF_PERIOD) / 8);
    let c = s === 0 ? 0x121316 : s === 1 ? 0x4c5058 : s === 2 ? 0x3e424a : mix(0x33363d, 0x282a30, (s - 3) / 4);
    if (Y === 0) c = mul(c, 0.62);
    else if (Y === SURF_H - 1) c = mul(c, 0.7);
    else if (Y === 1 && s > 1) c = mix(c, WHITE, 0.06);
    if (s > 2 && (Y % 4 === 2)) c = mix(c, 0x1e2024, 0.4);
    if (hash(X % SURF_PERIOD, Y, 43) > 0.92) c = mix(c, 0x5a5e66, 0.4);
    if (hash(k, 0, 44) > 0.8 && s > 2 && Y > 5 && Y < 12) c = mix(c, 0x4a4e56, 0.25); // nött lamell
    return c;
  });
  return P.flush();
}

// vänstra pelaren med inkastluckan + röntgenmaskinen (ligger framför väskorna)
function paintFront() {
  const P = new Pix(FW, FH);
  // ---- pelaren ----
  area(P, 0, 20, 27, 70, (X, Y, i) => {
    let c = qmix(0xbcc1c7, 0x9ea4aa, (Y - 20) / 70, X, Y, 3);
    if (i === 0) c = mix(c, WHITE, 0.25);
    if (i >= 25) c = mul(c, i === 26 ? 0.55 : 0.75);
    if ((Y - 20) % 24 === 23) c = mul(c, 0.85);
    return jit(c, X, Y, 45, 0.03);
  });
  // manöverpanel med nödstopp
  area(P, 4, 23, 19, 13, (X, Y, i, j) => (i === 0 || j === 0 ? 0x6a7078 : i === 18 || j === 12 ? 0x2a2e36 : jit(0x8a9098, X, Y, 46, 0.04)));
  P.rect(6, 25, 9, 9, 0xf0c020); P.box(6, 25, 9, 9, 0xa88010);
  knob(P, 10, 29, 3, 0xe8303a);
  for (const [lxx, lyy] of [[18, 26], [18, 30]]) P.rect(lxx, lyy, 2, 2, 0x2a2c30);
  P.hl(16, 33, 5, 0x5a6068);
  // varningsfyr + gulsvart balk över luckan
  P.rect(12, 41, 5, 2, 0x3a3e46);
  area(P, 3, 43, 24, 4, (X, Y) => ((((X + Y) >> 1) & 1) ? 0xf0c020 : 0x1e1e20));
  P.hl(3, 43, 24, 0xffe070, 0.5);
  // luckans ram och mörka inre
  vcols(P, HATCH.x0 - 1, HATCH.y0, HATCH.y1 - HATCH.y0, [0x3a3e46]);
  vcols(P, HATCH.x1, HATCH.y0, HATCH.y1 - HATCH.y0, [0xd8dce2, 0x5a6068]);
  area(P, HATCH.x0, HATCH.y0, HATCH.x1 - HATCH.x0, SURF_Y - HATCH.y0, (X, Y, i, j) => {
    const glow = i > 4 && i < 16 && j > 3 && j < 12;
    return glow ? qmix(0x2a2c30, 0x1a1c20, j / 12, X, Y, 2) : mix(0x0c0d10, 0x1a1c20, j / 15);
  });
  area(P, HATCH.x0, SURF_Y, HATCH.x1 - HATCH.x0, SURF_H, () => null);
  for (let y = SURF_Y; y < SURF_Y + SURF_H; y++) for (let x = HATCH.x0; x < HATCH.x1; x++) P.px(x, y, 0x0a0b0e, 0.7 - (x - HATCH.x0) / 50);
  area(P, 0, 80, 27, 10, (X, Y, i, j) => (j === 0 ? 0x3a3e46 : jit(i >= 25 ? 0x6a7078 : 0x8a9098, X, Y, 47, 0.04)));
  P.hl(0, 81, 26, 0xb8bec6);
  // ---- röntgenmaskinen ----
  const x0 = XR.x0, top = XR.top;
  // skärmen på armen (innehållet ritas levande)
  area(P, 353, 22, 28, 14, (X, Y, i, j) => (i === 0 || j === 0 ? 0x4a4e56 : i === 27 || j === 13 ? 0x16171a : 0x2a2c30));
  P.rect(355, 24, 24, 10, 0x0e1a2e);
  vcols(P, 366, 36, 2, [0x5a6068, 0x3a3e46]);
  area(P, x0, top, FW - x0, 90 - top, (X, Y, i, j) => {
    if (i === 0 && j < 3) return null;
    if (i === 1 && j === 0) return null;
    let c = qmix(0xe4e0d4, 0xcac4b6, j / 50, X, Y, 3);
    if (j === 0 || (i === 0 && j === 3) || (i === 1 && j === 1)) c = 0xf4f2ec;
    else if (i === 0) c = 0xf0ece2;
    else if (i === 1) c = mix(c, WHITE, 0.2);
    if (j === 16 || j === 17) c = j === 16 ? 0x3a6ab0 : 0x2a4a80;               // blå rand
    if (j > 44) c = mul(c, 0.55);                                                // sockeln
    if (i > 20 && i < 34 && j > 10 && j < 15 && j % 2 === 1) c = mul(c, 0.6);   // ventilation
    return jit(c, X, Y, 48, 0.04);
  });
  text(P, SMALL, 'RÖNTGEN', x0 + 5, top + 5, 0x2a3a5a);
  // varningstriangel
  for (let j = 0; j < 7; j++) for (let i = -j; i <= j; i++) P.px(x0 + 12 + i, top + 12 + j - 3 + 0, j === 6 || Math.abs(i) === j ? INK : 0xf0c020);
  P.px(x0 + 12, top + 12, INK); P.px(x0 + 12, top + 14, INK);
  // tunnelöppningen: mörk ram, blylamellerna ritas levande
  area(P, XR.tx0 - 2, XR.ty0 - 2, FW - XR.tx0 + 2, 2, (X, Y, i, j) => (j === 0 ? 0x2a2c30 : 0x5a5e66));
  vcols(P, XR.tx0 - 2, XR.ty0, XR.ty1 - XR.ty0, [0x2a2c30, 0x5a5e66]);
  area(P, XR.tx0, XR.ty0, FW - XR.tx0, SURF_Y - XR.ty0, (X, Y, i, j) => mix(0x0a0b0e, 0x16181c, j / 6));
  for (let y = SURF_Y; y < SURF_Y + SURF_H; y++) for (let x = XR.tx0; x < FW; x++) P.px(x, y, 0x0a0b0e, 0.45 + (x - XR.tx0) / 60);
  area(P, XR.tx0 - 2, XR.ty1, FW - XR.tx0 + 2, 90 - XR.ty1, (X, Y, i, j) => (j === 0 ? 0x2a2c30 : jit(0x6a6e76, X, Y, 49, 0.05)));
  P.hl(XR.tx0 - 2, XR.ty1 + 1, FW - XR.tx0 + 2, 0x9aa0a8);
  P.darken(x0 - 3, top + 4, 3, 90 - top - 4, 0.9);
  return P.flush();
}
// förgrunden: säkerhetsbandet (stolpar med utdragbart band) nere till vänster
// och UTGÅNG-skylten
const POSTS = [4, 27, 50], POST_Y = 213;
function stanchion(P, x, by) {
  P.ell(x + 1, by + 1, 6, 1.6, 0x1a1418, 0.45, 3);
  // foten: rund, blank platta
  rows(P, x - 1, by - 1, 5, [0xe4e8ec]);
  area(P, x - 2, by, 7, 1, (X, Y, i) => (i === 0 ? 0xc8ced4 : i === 6 ? 0x5a6068 : 0x9aa0a8));
  rows(P, x - 1, by + 1, 5, [0x3a3e46]);
  // stången: krom med ljus kant och mörk skuggsida
  vcols(P, x, by - 15, 14, [0xf4f6f8, 0xb8bec6, 0x6a7078]);
  for (let y = by - 14; y < by - 1; y += 5) P.px(x + 1, y, 0xeef2f6);
  // kassetten med bandet: blank kapsyl, mörk kropp, röd reflex
  area(P, x - 1, by - 19, 5, 4, (X, Y, i, j) => (j === 0 ? (i === 0 || i === 4 ? 0x9aa0a8 : 0xf4f6f8) : i === 0 ? 0x5a6068 : i === 4 ? 0x16171a : j === 3 ? 0x23262d : 0x3a3e46));
  P.px(x, by - 18, 0x6a7078); P.px(x + 1, by - 17, 0xd8303a);
}
function paintFore() {
  const P = new Pix(FW, FH);
  // bandet först (stolparna står framför ändarna)
  for (let k = 0; k < POSTS.length - 1; k++) {
    const x0 = POSTS[k] + 3, x1 = POSTS[k + 1] - 1, y = POST_Y - 18;
    rows(P, x0, y, x1 - x0, [0x5a8af0, 0x2a5ad0, 0x1e3a98]);
    for (let x = x0 + 2; x < x1 - 1; x += 4) P.px(x, y + 1, 0xdce6ff, 0.55);   // tryck på bandet
    P.hl(x0, y + 3, x1 - x0, 0x1a1418, 0.3);
  }
  // förbudsskylt som hänger på bandet
  const sgx = 32, sgy = POST_Y - 14;
  P.px(sgx + 2, sgy - 1, 0x9aa0a8); P.px(sgx + 8, sgy - 1, 0x9aa0a8);
  area(P, sgx, sgy, 11, 9, (X, Y, i, j) => (i === 0 || j === 0 ? 0x9aa0a8 : i === 10 || j === 8 ? 0x4a4e56 : 0xf4f6f8));
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const d = Math.hypot(x, y);
    if (d > 3.3) continue;
    P.px(sgx + 5 + x, sgy + 4 + y, Math.abs(y) === 0 && Math.abs(x) <= 2 ? WHITE : d > 2.5 ? 0x9a1a1a : 0xd8303a);
  }
  P.darken(sgx + 1, sgy + 9, 11, 1, 0.7);
  for (const sx of POSTS) stanchion(P, sx, POST_Y);
  // UTGÅNG: grön skylt med springande gubbe och pil
  const s = 'UTGÅNG', tw = textW(SMALL, s), w = tw + 20, x = FW - w - 3, y = 200;
  P.rect(x, y, w, 11, 0x0e4a24);
  P.rect(x + 1, y + 1, w - 2, 9, 0x1e8a3a);
  P.hl(x + 1, y + 1, w - 2, 0x5ac06a);
  const man = ['.#..', '###.', '.#.#', '.##.', '#..#'];
  man.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === '#') P.px(x + 3 + i, y + 3 + j, WHITE); });
  text(P, SMALL, s, x + 9, y + 3, WHITE);
  for (let j = 0; j < 5; j++) { const hw = 2 - Math.abs(j - 2); P.hl(x + w - 5, y + 3 + j, hw + 1, WHITE); }
  return P.flush();
}

// ======================= rekvisita på golvet (djupsorteras med figurerna) =======================
const WET = { x: 8, y: 134 }, CAGE = { x: 342, y: 138 };
// gul VÅTT GOLV-skylt (A-bock) med halkande gubbe
let WET_ART = null;
function wetArt() {
  if (WET_ART) return WET_ART;
  const w = 17, h = 21, P = new Pix(w + 4, h + 4, WET.x - 2, WET.y - h - 1);
  P.ell(WET.x + w / 2, WET.y, w / 2 + 2, 1.8, 0x1a1418, 0.45, 3);
  area(P, WET.x, WET.y - h, w, h, (X, Y, i, j) => {
    if (j < 3 && (i < 3 - j || i > w - 4 + j)) return null;
    if (j === h - 1 && i > 3 && i < w - 4) return null;
    let c = j === 0 || i === 0 ? 0xffe070 : i === w - 1 || j === h - 1 ? 0xa88010 : 0xf0c020;
    if (j === 1 && i > 5 && i < w - 6) c = 0x2a2c30;               // handtaget
    return jit(c, X, Y, 71, 0.05);
  });
  text(P, SMALL, 'VÅTT', WET.x + 1, WET.y - h + 5, INK);
  const man = ['..#..', '.###.', '#.#..', '..##.', '.#..#', '#....'];
  man.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(WET.x + 5 + i, WET.y - h + 11 + j, INK); });
  P.hl(WET.x + 3, WET.y - h + 17, 11, INK);
  P.px(WET.x + 13, WET.y - h + 16, 0x3a6ad8); P.px(WET.x + 14, WET.y - h + 15, 0x3a6ad8);
  WET_ART = { img: P.flush(), x: WET.x - 2, y: WET.y - h - 1 };
  return WET_ART;
}
// gallervagn för skrymmande bagage: skidor, golfbag och barnvagn bakom nätet
let CAGE_ART = null;
function cageArt() {
  if (CAGE_ART) return CAGE_ART;
  const w = 36, h = 32, ox = CAGE.x - 2, oy = CAGE.y - h - 6, P = new Pix(w + 4, h + 9, ox, oy), x0 = CAGE.x, y1 = CAGE.y - 4;
  P.ell(x0 + w / 2, CAGE.y, w / 2 + 3, 2.4, 0x1a1418, 0.45, 4);
  // bakre nätet
  area(P, x0 + 1, y1 - h + 1, w - 2, h - 2, (X, Y, i, j) => (i % 5 === 0 || j % 5 === 0 ? 0x5a6068 : null));
  // skidor (två par) lutade mot bakväggen
  for (const [sx, c] of [[x0 + 4, 0xd8303a], [x0 + 7, 0x2c6fb7]]) {
    P.line(sx, y1 - 2, sx + 5, y1 - h - 4, c); P.line(sx + 1, y1 - 2, sx + 6, y1 - h - 4, mul(c, 0.7));
    P.px(sx + 5, y1 - h - 5, 0xf4f4f4); P.px(sx + 6, y1 - h - 5, 0xf4f4f4);
  }
  // golfbagen med klubbhuvuden
  area(P, x0 + 15, y1 - 24, 8, 23, (X, Y, i, j) => (i === 0 ? 0x3a4a6a : i === 7 ? 0x141a2a : j === 4 || j === 16 ? 0xe8ecf0 : jit(0x1e2a44, X, Y, 72, 0.08)));
  for (const [dx, c] of [[1, 0xc8ced4], [3, 0x9aa0a8], [5, 0xd8b048], [6, 0xc8ced4]]) { P.vl(x0 + 15 + dx, y1 - 29, 5, 0x8a9098); P.rect(x0 + 15 + dx - 1, y1 - 30, 2, 2, c); }
  P.rect(x0 + 16, y1 - 12, 6, 3, 0xd8303a); P.hl(x0 + 16, y1 - 12, 6, 0xff6a5a);
  // barnvagnen (hopfälld)
  area(P, x0 + 25, y1 - 15, 9, 9, (X, Y, i, j) => ((i + j < 3) ? null : j === 0 || i === 0 ? 0x4a4a52 : jit(0x2a2a30, X, Y, 73, 0.08)));
  P.hl(x0 + 26, y1 - 11, 7, 0xd8303a);
  P.line(x0 + 25, y1 - 15, x0 + 31, y1 - 24, 0x9aa0a8); P.rect(x0 + 30, y1 - 25, 3, 1, 0x2a2a30);
  for (const wx of [x0 + 26, x0 + 32]) { P.rect(wx - 1, y1 - 5, 3, 3, 0x141418); P.px(wx, y1 - 4, 0x8a9098); }
  // främre nätet, ramen och bottenplattan
  area(P, x0, y1 - h, w, h, (X, Y, i, j) => {
    if (i === 0 || i === w - 1 || j === 0) return j === 0 ? 0xe0e4ea : i === 0 ? 0xc8ced4 : 0x6a7078;
    if ((i + 2) % 5 === 0 || (j + 2) % 5 === 0) return (i + j) % 2 ? 0xaab0b8 : 0x8a9098;
    return null;
  });
  rows(P, x0 - 1, y1, w + 2, [0xd8303a, 0x9a2020, 0x3a3e46]);
  for (const wx of [x0 + 2, x0 + w - 6]) area(P, wx, y1 + 3, 4, 3, (X, Y, i, j) => (j === 0 ? 0x5a6068 : (i === 0 || i === 3) && j === 2 ? null : 0x141418));
  CAGE_ART = { img: P.flush(), x: ox, y: oy };
  return CAGE_ART;
}

// infoskärm på fot vid vänsterkanten: avgångarna för de fyra vagnarna
const KIOSK = { x: 3, y: 181 };
let KIOSK_ART = null;
function kioskArt() {
  if (KIOSK_ART) return KIOSK_ART;
  const x0 = KIOSK.x, by = KIOSK.y, ox = x0 - 3, oy = by - 39, P = new Pix(20, 43, ox, oy);
  P.ell(x0 + 6.5, by, 9, 1.8, 0x1a1418, 0.45, 3);
  // foten
  area(P, x0, by - 3, 13, 3, (X, Y, i, j) => ((i === 0 || i === 12) && j === 0 ? null : j === 0 ? 0xe4e8ec : j === 1 ? (i === 0 ? 0xc8ced4 : i === 12 ? 0x5a6068 : 0x9aa0a8) : 0x3a3e46));
  // pelaren (borstat stål) med info-märke
  area(P, x0 + 4, by - 18, 5, 15, (X, Y, i) => jit([0xf4f6f8, 0xc8ced4, 0xaab0b8, 0x8a9098, 0x5a6068][i], X, Y, 81, 0.03));
  area(P, x0 + 4, by - 16, 5, 6, (X, Y, i, j) => (j === 0 ? 0x5a8af0 : j === 5 || i === 4 ? 0x1e3a98 : 0x2a5ad0));
  P.px(x0 + 6, by - 15, WHITE); P.vl(x0 + 6, by - 13, 3, WHITE);
  // skärmhuset: ljus kapsyl, mörk ram med fasad kant
  area(P, x0, by - 37, 13, 19, (X, Y, i, j) => {
    if (j === 0) return i === 0 || i === 12 ? 0x9aa0a8 : 0xe4e8ec;
    if (i === 0 || j === 1) return 0x5a5e66;
    if (i === 12 || j === 18) return 0x121316;
    if (i === 1 || j === 2) return 0x3a3e46;
    return 0x23262d;
  });
  for (let i = 0; i < 4; i++) P.px(x0 + 3 + i * 2, by - 21, 0x5a5e66);   // högtalargaller
  // skärmen: en rad per destination med taggens färg och status
  const sx = x0 + 2, sy = by - 34;
  area(P, sx, sy, 9, 13, (X, Y, i, j) => (j < 2 ? (j === 0 ? 0x2a4a8a : 0x1e3a6a) : 0x0e1a2e));
  P.hl(sx + 1, sy, 3, 0xffd23a); P.hl(sx + 5, sy, 3, 0xd8e0f0);
  for (let k = 0; k < 4; k++) {
    const ry = sy + 3 + k * 3;
    P.rect(sx + 1, ry, 2, 2, TAG[k].ci); P.px(sx + 1, ry, mix(TAG[k].ci, WHITE, 0.4));
    P.hl(sx + 4, ry, 3 + (k & 1), 0xd8e0f0);
    P.hl(sx + 4, ry + 1, 2, 0x5a6a8a);
    P.px(sx + 8, ry, 0x5ad06a);
  }
  reflect(P, sx, sy, 9, 13, 0.7, 5);
  KIOSK_ART = { img: P.flush(), x: ox, y: oy, blink: [sx + 8, sy + 3 + 2 * 3] };
  return KIOSK_ART;
}

// personalen: ramparbetare i varselkläder och en säkerhetsvakt vid röntgen
const HANDLER = {
  skin: '#c68a5c', hair: '#1d1714', style: 'short', hat: 'cap', cap: '#f07a1e', top: 'jacket', shirt: '#f2b01e', accent: '#e8ecf0',
  bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: false, beard: 'stubble', build: 5, bag: null,
};
const GUARD = {
  skin: '#eec3a0', hair: '#6b4226', style: 'bun', hat: null, top: 'shirt', shirt: '#dce6f2', accent: '#1e2a44',
  bottom: 'pants', pants: '#1e2a44', shoes: '#1c1c1c', glasses: 'square', beard: false, build: 5, bag: null,
};

// ======================= cachen (per ljusläge) =======================
const ART = {};
function art(mode) {
  if (!ART[mode]) ART[mode] = { hall: paintHall(mode), win: paintWinFrame(mode) };
  if (!ART.shared) ART.shared = { belt: paintBeltFrame(), surf: paintBeltSurf(), front: paintFront(), fore: paintFore() };
  return { ...ART[mode], ...ART.shared };
}
// falsk-färgad röntgenbild av en väska (för skärmen)
const XRAY = new Map();
function xraySprite(body) {
  let c = XRAY.get(body);
  if (c) return c;
  const P = new Pix(20, 9), s = body & 0xffff;
  area(P, 0, 0, 20, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === 19 || j === 8 ? 0x5a9aff : null));
  for (let k = 0; k < 5; k++) {
    const bx = 2 + Math.floor(hash(s, k, 51) * 14), by = 2 + Math.floor(hash(s, k, 52) * 4), bw = 2 + Math.floor(hash(s, k, 53) * 4);
    const col = [0xf0902a, 0x5ad06a, 0x3a6aff, 0xf0c040, 0x1a2a5a][k % 5];
    P.rect(bx, by, bw, 2 + (k & 1), col, 0.85);
  }
  c = P.flush();
  XRAY.set(body, c);
  return c;
}

export function makeJobbFlyg(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0 };
  const walker = createWalker({ top: BELT_Y + 16, bottom: FH - 26, spawn: [190, 130] });
  walker.setObstacles([[WET.x, WET.y - 6, WET.x + 17, WET.y], [CAGE.x, CAGE.y - 8, CAGE.x + 36, CAGE.y], [KIOSK.x, KIOSK.y - 6, KIOSK.x + 13, KIOSK.y]]);
  const pops = makePops();
  let items = [], t = 0, seq = 0, spawnIn = 1.0, carry = null, done = false, doneT = 0, reported = false;
  const speed = () => 20 + 14 * Math.min(1, t / SHIFT_SECONDS);
  const startMin = A.game?.min ?? 12 * 60;
  const mode = viewMode(((startMin + 120) / 60) % 24);
  const night = mode === 'natt';
  const G = art(mode);
  // bara för syns skull: bandets läge, vagnarnas last, trafiken ute, personalen
  let beltOff = 0;
  const loads = [[], [], [], []];
  const traffic = { planes: [], next: 3, far: null, farNext: 8 };
  const crew = { x: 70, tx: 70, wait: 1.2, lift: 0, dir: 'down', walking: false };

  function updateVisuals(dt) {
    // flygplan som taxar förbi (ett i taget) + ett som lyfter långt bort
    traffic.next -= dt;
    if (traffic.next <= 0 && !traffic.planes.length) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      traffic.planes.push({ dir, x: dir > 0 ? WIN_X0 - PLANE_W : FW, v: 14 + Math.random() * 6, liv: (Math.random() * LIVERY.length) | 0 });
      traffic.next = 6 + Math.random() * 8;
    }
    for (const p of traffic.planes) p.x += p.dir * p.v * dt;
    traffic.planes = traffic.planes.filter((p) => p.x > WIN_X0 - PLANE_W - 2 && p.x < FW + 2);
    traffic.farNext -= dt;
    if (traffic.farNext <= 0 && !traffic.far) { traffic.far = { x: FW + 4, y: 36 }; traffic.farNext = 14 + Math.random() * 10; }
    if (traffic.far) {
      const f = traffic.far;
      f.x -= 34 * dt;
      if (f.x < 250) f.y -= 7 * dt;
      if (f.x < WIN_X0 - 12 || f.y < GY0 - 4) traffic.far = null;
    }
    // ramparbetaren går längs bandet, stannar och lyfter ibland
    if (crew.lift > 0) crew.lift -= dt;
    if (crew.wait > 0) {
      crew.walking = false;
      crew.wait -= dt;
      if (crew.wait <= 0) crew.tx = 40 + Math.round(Math.random() * 120);
    } else {
      const d = crew.tx - crew.x;
      if (Math.abs(d) < 1) { crew.x = crew.tx; crew.wait = 2 + Math.random() * 3.5; crew.dir = 'down'; if (Math.random() < 0.55) crew.lift = 1.3; }
      else { crew.walking = true; crew.x += Math.sign(d) * Math.min(Math.abs(d), 15 * dt); crew.dir = d < 0 ? 'left' : 'right'; }
    }
  }

  // levande: planen och bagagetåget ute på plattan (bakom spröjsen)
  function drawApron(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.rect(WIN_X0, GY0, FW - WIN_X0, GY1 - GY0); ctx.clip();
    if (traffic.far) {
      const f = traffic.far, fx = Math.round(f.x), fy = Math.round(f.y);
      ctx.fillStyle = night ? '#8a94b0' : '#f4f6f8'; ctx.fillRect(fx, fy, 7, 1);
      ctx.fillStyle = night ? '#6a7490' : '#c8ccd2'; ctx.fillRect(fx + 2, fy + 1, 3, 1);
      ctx.fillStyle = css(LIVERY[0]); ctx.fillRect(fx + 6, fy - 1, 2, 1);
      if (night && Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = '#ff4a3a'; ctx.fillRect(fx + 3, fy - 1, 1, 1); }
    }
    for (const p of traffic.planes) {
      const px = Math.round(p.x), py = GY1 - PLANE_H;
      ctx.drawImage(planeSprite(p.liv, p.dir, night), px, py);
      // antikollisionsljus och strobe
      const bu = p.dir > 0 ? 40 : PLANE_W - 41;
      if (Math.floor(t * 2.2) % 2 === 0) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(px + bu, py + 8, 1, 1); }
      if (t % 1.2 < 0.08) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px + (p.dir > 0 ? 0 : PLANE_W - 1), py + 10, 1, 1); }
      ctx.fillStyle = p.dir > 0 ? '#ff4a3a' : '#5aff8a'; ctx.fillRect(px + (p.dir > 0 ? 30 : PLANE_W - 31), py + 14, 1, 1);
    }
    // bagagetåget: dragbil + tre kärror, rullar runt hela tiden
    const tx = Math.round(((t * 11) % 520) - 90);
    const ty = GY1 - 4;
    const cols = [0xd8303a, 0x2c6fb7, 0x2f8f46];
    for (let k = 0; k < 3; k++) {
      const cx = tx - 10 - k * 10;
      ctx.fillStyle = css(night ? mul(cols[k], 0.6) : cols[k]); ctx.fillRect(cx, ty - 1, 8, 3);
      ctx.fillStyle = night ? '#5a5e6a' : '#9aa0a8'; ctx.fillRect(cx, ty + 2, 8, 1);
      ctx.fillStyle = '#16171a'; ctx.fillRect(cx + 1, ty + 3, 1, 1); ctx.fillRect(cx + 6, ty + 3, 1, 1);
      ctx.fillStyle = '#5a6068'; ctx.fillRect(cx + 8, ty + 2, 2, 1);
    }
    ctx.fillStyle = night ? '#a89030' : '#f0c020'; ctx.fillRect(tx, ty - 1, 7, 4);
    ctx.fillStyle = night ? '#ffe6a0' : '#2a3440'; ctx.fillRect(tx + 1, ty - 3, 3, 2);
    ctx.fillStyle = '#16171a'; ctx.fillRect(tx + 1, ty + 3, 2, 1); ctx.fillRect(tx + 5, ty + 3, 2, 1);
    if (Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = '#ff9a2a'; ctx.fillRect(tx + 2, ty - 4, 1, 1); }
    ctx.restore();
  }

  // levande: gummiridåerna i luckan och blylamellerna i röntgen trycks undan av väskorna
  function drawCurtains(ctx) {
    const strips = (x0, x1, y0, y1, c0, c1, c2) => {
      for (let sx = x0; sx < x1; sx += 3) {
        let push = 0;
        for (const it of items) {
          const d = Math.abs(it.x - (sx + 1));
          if (d < 12) push = Math.max(push, 12 - d);
        }
        const lift = Math.min(7, Math.round(push * 0.7)), shove = Math.min(3, Math.round(push / 4));
        const len = y1 - y0 - lift, bend = Math.floor(len * 0.45);
        for (const [i, c] of [[0, c0], [1, c1], [2, c2]]) {
          ctx.fillStyle = c;
          ctx.fillRect(sx + i, y0, 1, bend);
          ctx.fillRect(sx + i + shove, y0 + bend, 1, len - bend);
        }
      }
    };
    strips(HATCH.x0, HATCH.x1, HATCH.y0, HATCH.y1, '#50545c', '#33363c', '#1e2024');
    strips(XR.tx0, FW, XR.ty0, XR.ty1 - 1, '#6a7280', '#4a5260', '#2e343e');
  }

  // levande: röntgenskärmen, maskinens lampor, fyren och nödstoppslampor
  function drawGadgets(ctx) {
    const inside = items.filter((it) => it.x > XR.tx0 + 2);
    // skärmen: bilden glider in när väskan åker igenom
    ctx.save();
    ctx.beginPath(); ctx.rect(355, 24, 24, 10); ctx.clip();
    ctx.fillStyle = '#0e1a2e'; ctx.fillRect(355, 24, 24, 10);
    if (inside.length) {
      for (const it of inside) {
        const sx = Math.round(355 + 24 - (it.x - XR.tx0) * 0.9);
        ctx.drawImage(xraySprite(it.body), sx, 24);
      }
      ctx.fillStyle = 'rgba(160,210,255,0.35)';
      ctx.fillRect(355 + Math.floor((t * 30) % 24), 24, 1, 10);
    } else {
      ctxText(ctx, SMALL, 'KLAR', 357, 26, '#5ad06a');
      if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = '#5ad06a'; ctx.fillRect(373, 30, 3, 1); }
    }
    ctx.restore();
    // maskinens statuslampor: grön = redo, röd = skannar
    ctx.fillStyle = inside.length ? '#3a1414' : '#5aff8a'; ctx.fillRect(XR.x0 + 24, XR.top + 20, 3, 2);
    ctx.fillStyle = inside.length ? (Math.floor(t * 6) % 2 ? '#ff3a2a' : '#a02010') : '#3a1414'; ctx.fillRect(XR.x0 + 29, XR.top + 20, 3, 2);
    // varningsfyren på pelaren roterar när bandet går
    const ph = Math.floor(t * 8) % 4;
    ctx.fillStyle = '#b8601a'; ctx.fillRect(12, 38, 5, 3);
    ctx.fillStyle = '#ffb040'; ctx.fillRect(12 + [0, 1, 3, 4][ph], 38, 1, 3);
    ctx.fillStyle = '#fff0c0'; ctx.fillRect(12 + [0, 1, 3, 4][ph], 39, 1, 1);
    // panelens lampor
    ctx.fillStyle = '#5aff8a'; ctx.fillRect(18, 26, 2, 2);
    ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#ffb020' : '#5a4010'; ctx.fillRect(18, 30, 2, 2);
    // klockan: passet är fyra timmar
    const m = startMin + (Math.min(t, SHIFT_SECONDS) / SHIFT_SECONDS) * 240;
    const ma = ((m % 60) / 60) * Math.PI * 2, ha = (((m / 60) % 12) / 12) * Math.PI * 2;
    ctx.fillStyle = '#2a2c30';
    pline(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(ha) * 2.4, CLOCK.y - Math.cos(ha) * 2.4);
    ctx.fillStyle = '#4a4e56';
    pline(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(ma) * 3.6, CLOCK.y - Math.cos(ma) * 3.6);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(CLOCK.x, CLOCK.y, 1, 1);
  }

  function drawBelt(ctx) {
    const off = Math.floor(beltOff) % SURF_PERIOD;
    ctx.drawImage(G.surf, SURF_PERIOD - 1 - off, 0, FW, SURF_H, 0, SURF_Y, FW, SURF_H);
    ctx.drawImage(G.belt, 0, 0);
    // rullarna under bandet snurrar
    const ph = Math.floor(beltOff / 2) % 4;
    for (let x = 6; x < FW; x += 16) {
      ctx.fillStyle = '#6a7078'; ctx.fillRect(x, 86, 4, 3);
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x, 86, 4, 1);
      ctx.fillStyle = '#d8dce2'; ctx.fillRect(x + ph, 87, 1, 1);
    }
  }

  function cartDrawable(i) {
    const cart = CARTS[i], C = cartArt()[i];
    return {
      fy: cart.y + 6,
      draw(ctx) {
        const ox = cart.x - CART_OX, oy = cart.y - CART_OY;
        ctx.drawImage(C.back, ox, oy);
        const L = loads[i];
        for (let k = 0; k < L.length; k++) {
          const row = k < 5 ? 0 : 1, col = row ? k - 5 : k;
          ctx.drawImage(miniCase(L[k].body, L[k].cat), cart.x + 4 + col * 10 + row * 4, cart.y - 19 - row * 6);
        }
        ctx.drawImage(C.front, ox, oy);
      },
    };
  }
  const propDrawable = (fy, get) => ({ fy, draw(ctx) { const S = get(); ctx.drawImage(S.img, S.x, S.y); } });
  // infoskärmen: statuslampan för PARIS blinkar (boarding)
  const kioskDrawable = () => ({
    fy: KIOSK.y,
    draw(ctx) {
      const S = kioskArt();
      ctx.drawImage(S.img, S.x, S.y);
      ctx.fillStyle = Math.floor(t * 2.5) % 2 ? '#ffb020' : '#3a2a10'; ctx.fillRect(S.blink[0], S.blink[1], 1, 1);
    },
  });
  const crewDrawable = () => ({
    draw(ctx) {
      const f = crew.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : crew.lift > 0 ? [7, 8, 9, 8][Math.floor(t * 6) % 4] : (Math.sin(t * 1.7) > 0.93 ? 4 : 0);
      drawPerson(ctx, Math.round(crew.x), 71, HANDLER, crew.dir, f);
      const busy = items.some((it) => it.x > XR.tx0 - 20);
      drawPerson(ctx, 334, 71, GUARD, busy ? 'right' : 'down', busy ? 0 : (Math.sin(t * 1.3 + 2) > 0.9 ? 4 : 0));
    },
  });

  return {
    _debug: {
      forcePick() { const it = items[0]; if (!it) return null; carry = { cat: it.cat, body: it.body }; items.shift(); return carry; },
      forceDrop(right = true) { if (!carry) return null; dropAtCart(right ? carry.cat : (carry.cat + 1) % 4); return stats; },
      stats,
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      updateVisuals(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      walker.update(dt);
      beltOff += speed() * dt;
      if (beltOff > 1e6) beltOff -= 64 * 15625;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 2.4 - 1.0 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 9) * 0.5;
        items.push({ cat: (Math.random() * 4) | 0, body: CASE_COLORS[(hash(seq, 31) * CASE_COLORS.length) | 0], x: -12 });
        seq++;
      }
      for (const it of items) it.x += speed() * dt;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].x > FW + 12) {
        items.splice(i, 1);
        stats.miss++;
        play('miss');
        pops.add(FW - 20, BELT_Y + 10, 'MISS!', '#d8d2c0');
      }
    },
    down(x, y) {
      if (done) return;
      // UTGÅNG nere till höger → samma fråga som Escape (ingen lön om man går)
      if (x >= EXIT.x0 && y >= EXIT.y0) {
        walker.walkTo(EXIT.wx, EXIT.wy, () => { if (!done) abortShift(A); });
        return;
      }
      if (y < BELT_Y + 18 && !carry) {
        let best = null, bd = 1e9;
        for (const it of items) { const d = Math.abs(it.x - x); if (d < 18 && d < bd) { best = it; bd = d; } }
        if (best) {
          const target = best;
          walker.walkTo(Math.max(12, Math.min(FW - 12, target.x + speed() * 0.9)), BELT_Y + 20, () => {
            const i = items.indexOf(target);
            if (i >= 0 && Math.abs(target.x - walker.px) < 18) { items.splice(i, 1); carry = { cat: target.cat, body: target.body }; play('ok'); }
            else { play('miss'); pops.add(walker.px, walker.py - 30, 'MISSADE!', '#d8d2c0'); }
          });
          return;
        }
      }
      const cart = CARTS.find((cVagn) => x > cVagn.x - 6 && x < cVagn.x + cVagn.w + 6 && y > cVagn.y - 30);
      if (cart) {
        walker.walkTo(cart.x + cart.w / 2, cart.y - 20, () => { if (carry) dropAtCart(CARTS.indexOf(cart)); });
        return;
      }
      walker.walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(G.hall, 0, 0);
      drawApron(ctx);
      ctx.drawImage(G.win, 0, 0);
      crewDrawable().draw(ctx);
      drawBelt(ctx);
      for (const it of items) drawCase(ctx, it, it.x, BELT_Y);
      ctx.drawImage(G.front, 0, 0);
      drawCurtains(ctx);
      drawGadgets(ctx);
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry }), ...CARTS.map((_, i) => cartDrawable(i)), propDrawable(WET.y, wetArt), propDrawable(CAGE.y, cageArt), kioskDrawable()];
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.drawImage(G.fore, 0, 0);
      if (carry) drawCase(ctx, carry, walker.px, walker.py - 46);
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'FLYGPLATSEN' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  function dropAtCart(idx) {
    if (idx === carry.cat) { stats.ok++; play('ok'); pops.add(CARTS[idx].x + 30, CARTS[idx].y - 34, '+7', '#8ee03c'); }
    else { stats.fel++; play('fel'); pops.add(CARTS[idx].x + 30, CARTS[idx].y - 34, 'FEL VAGN!', '#ff6a6a'); }
    loads[idx].push({ body: carry.body, cat: carry.cat });
    if (loads[idx].length > 10) loads[idx].shift();
    carry = null;
  }
}
