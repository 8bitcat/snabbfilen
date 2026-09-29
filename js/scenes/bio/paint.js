// BIO PIXEL inne – måtten och allt som målas en gång (js/scenes/shop-bio.js ritar
// det som lever). Samma stil som fasaden (buildings-south.js): vinröd sammet, guld,
// grädde och art deco – solfjädrar, trappstegskrön och glödlampor runt skyltarna.
//
// FOAJÉN (576 × 216): skjutdörrarna ut mot gatan · affischer i guldramar med lampor ·
// BILJETTLUCKAN (kassörskan bakom glaset, talgaller, biljettspringa) med kösnören i mässing ·
// POPCORN-baren (popcornmaskinen som poppar, läskfontän, godisväggen med lösgodis) och
// godisdisken · rundsoffan med palmen · kartongfiguren PIXELHÄMNAREN · dörrarna in till
// SALONG 1 med platsvakten. Mönstrad biomatta, ljuskronor, väggklocka.
//
// SALONGEN (576 × 216): duken i en guldram med sammetsridåer, scen med rampljus, UTGÅNG
// och NÖDUTGÅNG, fem röda stolsrader i trappsteg (steglampor i gångarna, trappprofilen
// syns mot sidoväggarna).
import { Pix, SMALL, BIG, text, textW, eachTextPixel, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { drawPerson } from '../../core/people.js';
import { posterCanvas, POSTER_W, POSTER_H, FILMER } from './film.js';

export const W = 576, H = 216;
const WHITE = 0xffffff, INK = 0x17151a;
export const GOLD = { hi: 0xf0d890, base: 0xc8a44a, mid: 0xa8843a, lo: 0x8a6a2a, dk: 0x4a3414 };
export const VEL = { hi: 0xd83a4a, base: 0xa01c2c, mid: 0x7e1624, lo: 0x5a0e1a, dk: 0x34060e };

export const F = {
  WALL_Y: 88,
  DOOR: { x0: 16, x1: 48, top: 38 },
  POSTERS: [58, 94, 212, 390, 504, 538], POSTER_Y: 22,
  BOOTH: { x0: 132, x1: 204, win: { x0: 142, x1: 194, y0: 34, y1: 64 } },
  KASS: { x: 168, y: 82 },                           // kassörskans fötter (bakom glaset)
  BAR: { x0: 250, x1: 382 },
  CNT: { x0: 258, x1: 374, top: 98, face: 105, y: 118 },
  GODIS_Y: 108,                                      // godisförsäljarens fötter bakom disken
  MACHINE: { x0: 256, x1: 286, y0: 24, y1: 62 },
  SD: { x0: 432, x1: 496, top: 40 },                 // dörrarna in till salongen
  USHER: { x: 512, y: 100 },
  ROPE: { xl: 146, xr: 190, y0: 104, y1: 126 },
  SOFA: { x: 96, y: 184 },
  KLO: { x: 522, y: 164 },                           // gripklon (godisautomat med gosedjur)
  MEDALJ: { x: 312, y: 176 },                        // guldmedaljongen i mattan
  STANDEE: { x: 444, y: 156 },
  BIN: { x: 232, y: 134 },
  PALMS: [[22, 132], [556, 132]],
  LAMPS: [52, 246, 386], SCONCES: [247, 386, 500], KLOCKA: { x: 227, y: 13 },
};
export const S = {
  WALL_Y: 108,
  FILM: { x: 168, y: 16 },
  FRAME: { x0: 156, x1: 420, y0: 4, y1: 100 },
  DOOR: { x0: 40, x1: 72, top: 60 },
  NOD: { x0: 504, x1: 536, top: 60 },
  ROW_Y: [140, 158, 176, 194, 212],
  BLOCKS: [[96, 4], [200, 12], [432, 4]],            // [första stolens x, antal] – vänster, mitten, höger
  PITCH: 16,
  AISLES: [172, 404],
  SCONCES: [24, 110, 466, 552],
};
export const SEAT_XS = S.BLOCKS.flatMap(([x0, n]) => Array.from({ length: n }, (_, i) => x0 + i * S.PITCH));

// ---------- målarverktyg ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
export function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(clamp(t, 0, 1) * steps + bayer(x, y)) / steps;
  return mix(a, b, clamp(q, 0, 1));
}
export function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = fn(x + i, y + j, i, j);
    if (c !== null && c !== undefined) P.px(x + i, y + j, c);
  }
}
export function spr(P, x, y, rows, pal, a = 1) {
  for (let j = 0; j < rows.length; j++) { const r = rows[j]; for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, c, a); } }
}
export function outline(P, dark = 0x1e1014) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] > 200) { best = j; break; }
    }
    if (best < 0) continue;
    const o = mix(dark, (src[best] << 16) | (src[best + 1] << 8) | src[best + 2], 0.28);
    d[i] = (o >> 16) & 255; d[i + 1] = (o >> 8) & 255; d[i + 2] = o & 255; d[i + 3] = 255;
  }
}
// text med kontur/skugga (samma verktyg som Burgarbaren)
export function textMask(Fnt, s) {
  const w = textW(Fnt, s), pts = [];
  eachTextPixel(Fnt, s, 0, 0, 1, (x, y) => pts.push([x, y]));
  return { w, pts, set: new Set(pts.map(([a, b]) => a + ',' + b)) };
}
export function drawText(P, M, x, y, o) {
  const has = (a, b) => M.set.has(a + ',' + b);
  if (o.shadow !== undefined) for (const [a, b] of M.pts) if (!has(a + 1, b + 1)) P.px(x + a + 1, y + b + 1, o.shadow, o.sa ?? 0.6);
  if (o.out !== undefined) for (const [a, b] of M.pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(a + dx, b + dy)) P.px(x + a + dx, y + b + dy, o.out, o.oa ?? 1);
  for (const [a, b] of M.pts) {
    let c = typeof o.fill === 'function' ? o.fill(a, b) : o.fill;
    if (o.hi !== undefined && !has(a, b - 1)) c = o.hi;
    P.px(x + a, y + b, c, o.a ?? 1);
  }
}
const goldText = (P, Fnt, s, x, y, out = 0x3a1a08) => drawText(P, textMask(Fnt, s), x, y, { fill: (a, b) => (b < 2 ? GOLD.hi : b < 4 ? GOLD.base : GOLD.mid), out, oa: 0.9 });

// Biomattan: djupröd med guldromber, turkosa prickar och små guldhörn (art deco)
export function carpet(X, Y, dark = 0) {
  const cx = ((X % 24) + 24) % 24, cy = ((Y % 16) + 16) % 16;
  const dx = Math.abs(cx - 12), dy = Math.abs(cy - 8), d = dx * 2 + dy * 3;
  let c = 0x6a1422;
  if (d < 20) c = 0x5a1020;                                                   // rombens insida
  if (d === 20 || d === 21) c = 0x94702e;                                     // guldkanten
  if (dx + dy === 0) c = 0x3a8a86;                                            // turkos prick mitt i romben
  else if (dx + dy === 1) c = 0x4a1a2a;
  if ((cx === 0 || cx === 23) && (cy === 0 || cy === 15)) c = 0xa8843a;       // guldhörn
  if (dark) c = mul(c, 1 - dark);
  return jit(c, X, Y, 71, 0.07);
}

// ---------- utsikten genom skjutdörrarna ----------
function paintOutside(P, night) {
  const { x0, x1, top } = F.DOOR, y1 = F.WALL_Y;
  area(P, x0, top, x1 - x0, y1 - top, (X, Y) => {
    const r = Y - top;
    if (r < 12) return qmix(night ? 0x0e1430 : 0x8ec8ee, night ? 0x1e2a50 : 0xd8f0ff, r / 12, X, Y, 3);
    if (r < 26) {                                                               // husen på andra sidan gatan
      const lit = (X % 5 > 1) && (r % 5 > 1) && r > 14;
      return lit ? (night ? (hash(X >> 2, r >> 2, 9) > 0.4 ? 0xf0c068 : 0x1a2034) : 0x9ac0dc) : jit(night ? 0x2a2438 : 0xb89a7a, X, Y, 8, 0.08);
    }
    if (r < 28) return night ? 0x3a3a44 : 0xb2ac9e;
    if (r < 38) { let c = jit(night ? 0x24242a : 0x4e4e56, X, Y, 8, 0.1); if (r === 33 && X % 10 < 5) c = night ? 0x8a8470 : 0xe8e2c8; return c; }
    if (r < 39) return night ? 0x6a6660 : 0xe6dece;
    const c = jit(0xbcb4a6, X, Y, 10, 0.08);
    return night ? mix(mul(c, 0.4), 0xffb070, 0.2) : c;
  });
  if (night) P.ell((x0 + x1) / 2, top + 8, 8, 6, 0xffd890, 0.25, 3);
}

// ---------- foajéns vägg och golv ----------
function paintFoajeWall(P, night) {
  const WY = F.WALL_Y;
  // taket: mörk kassett med guldlist och små stjärnlampor
  area(P, 0, 0, W, 8, (X, Y) => {
    if (Y === 6) return GOLD.base;
    if (Y === 7) return GOLD.lo;
    let c = mix(0x1a0a10, 0x2a1018, Y / 6);
    if (hash(X, Y, 1) > 0.975) c = 0xfff0b0;
    return c;
  });
  // frisen: guldsicksack på mörk botten (samma band som fasaden)
  area(P, 0, 8, W, 6, (X, Y, i, j) => {
    const z = (X + (j < 3 ? j : 5 - j)) % 6;
    if (j === 5) return GOLD.lo;
    return z === 0 || z === 3 ? (j < 3 ? GOLD.hi : GOLD.base) : 0x2a1018;
  });
  // sammetstapet med rutnät av romber
  area(P, 0, 14, W, 42, (X, Y) => {
    let c = 0x6e1c2c;
    if ((X + Y) % 10 === 0 || (X - Y + 1000) % 10 === 0) c = 0x7e2434;
    if ((X + Y) % 10 === 5 && (X - Y + 1000) % 10 === 5) c = GOLD.lo;
    c = mix(c, 0x3a0a14, (Y - 14) / 90);
    return jit(c, X, Y, 12, 0.05);
  });
  // bröstlist i guld och mörk boasering med fyllningar, mässingslist nertill
  area(P, 0, 56, W, 2, (X, Y, i, j) => (j === 0 ? GOLD.hi : GOLD.lo));
  area(P, 0, 58, W, WY - 58, (X, Y) => {
    let c = jit(0x3a1c12, X, Y, 13, 0.06);
    const px = X % 24, py = Y - 58;
    if (py >= 3 && py <= 22 && px >= 3 && px <= 20) {
      if (py === 3 || px === 3) c = 0x5a3020; else if (py === 22 || px === 20) c = 0x24100a; else c = jit(0x442214, X, Y, 14, 0.05);
    }
    if (Y >= WY - 4) c = [GOLD.hi, GOLD.mid, 0x2a140c, 0x1a0a06][Y - (WY - 4)];
    return c;
  });
  // guldpilastrar mellan skyltarna
  for (const px of [53, 128, 207, 246, 386, 426, 500]) {
    area(P, px - 1, 14, 3, 42, (X, Y, i) => [GOLD.hi, GOLD.base, GOLD.lo][i]);
    area(P, px - 2, 14, 5, 2, (X, Y, i, j) => (j === 0 ? GOLD.hi : GOLD.lo));
    area(P, px - 2, 54, 5, 2, (X, Y, i, j) => (j === 0 ? GOLD.hi : GOLD.lo));
  }
  // sidoväggarna i perspektiv
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, H, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WY + (5 - k) * 2) return null;
    return jit(Y < 14 ? 0x1a0a10 : Y < 56 ? mul(0x6e1c2c, 0.6 + k * 0.05) : mul(0x3a1c12, 0.6 + k * 0.05), X, Y, 91, 0.04);
  });
}

function paintFoajeFloor(P, night) {
  const WY = F.WALL_Y;
  for (let y = WY; y < H; y++) for (let x = 0; x < W; x++) {
    let c = carpet(x, y);
    if (y < WY + 4) c = mul(c, 0.7 + (y - WY) * 0.07);
    P.px(x, y, c);
  }
  // guldmedaljongen: strålkrans kring en turkos mitt (art deco, som fasadens solfjäder)
  const { x: mx, y: my } = F.MEDALJ;
  area(P, mx - 54, my - 18, 109, 37, (X, Y) => {
    const u = (X + 0.5 - mx) / 52, v = (Y + 0.5 - my) / 17, d = Math.hypot(u, v);
    if (d > 1) return null;
    if (d > 0.93) return jit(0xc8a44a, X, Y, 74, 0.08);
    if (d > 0.88) return 0x3a0a14;
    const a = Math.atan2(v, u), ray = Math.floor((a + Math.PI) / (Math.PI * 2) * 24) & 1;
    if (d < 0.2) return d < 0.1 ? 0x5ab8b0 : 0xc8a44a;
    if (d < 0.26) return 0x3a0a14;
    return jit(ray ? (d < 0.6 ? 0xa8843a : 0x7a5a24) : mix(0x5a1020, 0x3a0a14, d), X, Y, 75, 0.06);
  });
  // ljuskronornas sken på mattan
  for (const lx of F.LAMPS) P.ell(lx, WY + 34, 44, 14, 0xffd890, 0.12, 4);
  // dagsljus genom glasdörrarna
  if (!night) for (let j = 0; j < 22; j++) for (let x = F.DOOR.x0 + 3; x < F.DOOR.x1 - 3; x++) { const y = WY + 1 + j; if (bayer(x + j, y) < 0.7) P.px(x + Math.round(j * 0.4), y, 0xfff4d8, 0.2 * (1 - j / 22)); }
  // dörrmattan vid entrén och en röd löpare in mot salongen
  area(P, F.DOOR.x0 - 4, WY + 2, F.DOOR.x1 - F.DOOR.x0 + 8, 10, (X, Y, i, j) => (i === 0 || j === 0 || i === F.DOOR.x1 - F.DOOR.x0 + 7 || j === 9 ? 0x2a2a2a : ((X + Y) & 1 ? 0x3a3a34 : 0x4a4a40)));
  area(P, F.SD.x0 + 4, WY + 1, F.SD.x1 - F.SD.x0 - 8, 16, (X, Y, i, j, ww = F.SD.x1 - F.SD.x0 - 8) => (i === 0 || i === ww - 1 ? GOLD.mid : jit(VEL.base, X, Y, 72, 0.06)));
  // skuggorna under det som står på golvet
  P.darken(F.CNT.x0, F.CNT.y, F.CNT.x1 - F.CNT.x0, 2, 0.6); P.darken(F.CNT.x0, F.CNT.y + 2, F.CNT.x1 - F.CNT.x0, 1, 0.8);
  P.ell(F.SOFA.x, F.SOFA.y - 1, 44, 8, 0x10060a, 0.45, 3);
  P.ell(F.KLO.x, F.KLO.y, 13, 2.5, 0x10060a, 0.4, 2);
  P.ell(F.STANDEE.x, F.STANDEE.y, 12, 2.5, 0x10060a, 0.4, 2);
  P.ell(F.BIN.x, F.BIN.y, 7, 2, 0x10060a, 0.4, 2);
  for (const [px, py] of F.PALMS) P.ell(px, py, 9, 2.5, 0x10060a, 0.4, 2);
  for (const x of [F.ROPE.xl, F.ROPE.xr]) for (const y of [F.ROPE.y0, F.ROPE.y1]) P.ell(x, y, 4, 1.5, 0x10060a, 0.45, 2);
  P.ell(F.USHER.x, F.USHER.y, 6, 1.6, 0x10060a, 0.3, 2);
  // popcorn som någon tappat vid baren
  for (let k = 0; k < 16; k++) { const x = F.CNT.x0 + 6 + Math.floor(hash(k, 1, 73) * 110), y = F.CNT.y + 4 + Math.floor(hash(k, 2, 73) * 18); P.px(x, y, hash(k, 3, 73) > 0.5 ? 0xfff6d8 : 0xf0d070); }
}

// affischerna i guldram med en liten lampa ovanför
function paintPosters(P) {
  F.POSTERS.forEach((x, i) => {
    const y = F.POSTER_Y, w = POSTER_W + 4, h = POSTER_H + 4;
    P.rect(x + 2, y + h, w - 1, 2, 0x000000, 0.3); P.rect(x + w, y + 2, 1, h, 0x000000, 0.25);
    area(P, x, y, w, h, (X, Y, a, b) => (a === 0 || b === 0 ? GOLD.hi : a === w - 1 || b === h - 1 ? GOLD.lo : (a === 1 || b === 1 || a === w - 2 || b === h - 2) ? GOLD.base : null));
    const img = posterCanvas(FILMER[i].id), c2 = img.getContext('2d').getImageData(0, 0, POSTER_W, POSTER_H).data;
    for (let j = 0; j < POSTER_H; j++) for (let k = 0; k < POSTER_W; k++) { const o = (j * POSTER_W + k) * 4; if (c2[o + 3]) P.px(x + 2 + k, y + 2 + j, (c2[o] << 16) | (c2[o + 1] << 8) | c2[o + 2]); }
    // lampan på en mässingsarm
    P.hl(x + 13, y - 5, 4, 0x2a1a10); P.rect(x + 11, y - 4, 8, 2, GOLD.lo); P.hl(x + 11, y - 4, 8, GOLD.base);
    P.hl(x + 12, y - 2, 6, 0xfff0b0);
    P.ell(x + 15, y + 8, 14, 10, 0xfff0c0, 0.1, 3);
  });
}

// väggklockan (visarna ritas live), ljuskronornas upphängning, lampetterna
function paintWallBits(P) {
  const { x, y } = F.KLOCKA;
  area(P, x - 8, y - 8, 17, 17, (X, Y) => { const d = Math.hypot(X - x, Y - y); return d <= 7.6 ? (d > 6.3 ? GOLD.base : d > 5.6 ? GOLD.lo : 0xf4ecd8) : null; });
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(x + Math.sin(a) * 4.6), Math.round(y - Math.cos(a) * 4.6), k % 3 ? 0x8a7a6a : INK); }
  for (const sx of F.SCONCES) {
    // solfjäderlampett i art deco
    spr(P, sx - 3, 30, ['.gGGg.', 'gYYYYg', 'gYyYyg', '.gYYg.', '..gg..', '..gg..'], { g: GOLD.lo, G: GOLD.hi, Y: 0xfff0b0, y: 0xf0d070 });
    P.ell(sx, 30, 12, 10, 0xfff0c0, 0.14, 3);
  }
  for (const lx of F.LAMPS) P.vl(lx, 6, 4, GOLD.lo);
}

// Biljettluckan, del 1: inuti kuren (bakom kassörskan) – varm lampa, biljettrullar, hyllan
function paintBoothInside(P) {
  const { x0, x1, y0, y1 } = F.BOOTH.win;
  area(P, x0, y0, x1 - x0, y1 - y0, (X, Y) => qmix(0xe8c890, 0xb8864a, (Y - y0) / (y1 - y0), X, Y, 3));
  P.hl(x0, y0 + 10, x1 - x0, 0x6a4424); P.hl(x0, y0 + 11, x1 - x0, 0x8a5a2a);
  for (let k = 0; k < 5; k++) { const col = [0xd83a3a, 0x3a7bd5, 0xf0c040, 0x46a35a, 0xd83a3a][k]; P.rect(x0 + 4 + k * 5, y0 + 6, 4, 4, col); P.px(x0 + 5 + k * 5, y0 + 7, WHITE); P.px(x0 + 6 + k * 5, y0 + 8, mul(col, 0.6)); }
  // en liten lampa med grön skärm och en kalender
  P.rect(x1 - 12, y0 + 3, 7, 3, 0x2a7a3a); P.hl(x1 - 12, y0 + 3, 7, 0x5aba6a); P.vl(x1 - 9, y0 + 6, 4, GOLD.lo); P.ell(x1 - 9, y0 + 8, 8, 4, 0xfff0b0, 0.3, 2);
  P.rect(x0 + 34, y0 + 2, 8, 7, 0xf4f1ea); P.hl(x0 + 34, y0 + 2, 8, 0xd83a3a); P.hl(x0 + 35, y0 + 5, 6, 0x9a9488); P.hl(x0 + 35, y0 + 7, 4, 0x9a9488);
}
// Biljettluckan, del 2 (ovanpå kassörskan): skylten med glödlampor, ramen, glaset med
// talgaller, disklisten med biljettspringan och frontpanelen med priset
export function paintBoothFront() {
  const { x0, x1 } = F.BOOTH, { win } = F.BOOTH, WY = F.WALL_Y;
  const ox = x0 - 2, oy = 8;
  const P = new Pix(x1 - x0 + 4, WY - oy + 1, ox, oy);
  // skylten BILJETTER
  area(P, x0 + 2, 11, x1 - x0 - 4, 14, (X, Y, i, j, w = x1 - x0 - 4) => (i === 0 || j === 0 || i === w - 1 || j === 13 ? GOLD.base : jit(VEL.mid, X, Y, 30, 0.06)));
  goldText(P, BIG, 'BILJETTER', ((x0 + x1) >> 1) - (textW(BIG, 'BILJETTER') >> 1), 14);
  for (let x = x0 + 4; x < x1 - 3; x += 4) { P.px(x, 12, 0xfff0b0); P.px(x, 23, 0xfff0b0); }
  // ramen runt glaset: vinröd med guldlister och ett trappstegskrön
  area(P, x0, 26, x1 - x0, win.y0 - 26, (X, Y, i, j) => (j === 0 ? GOLD.hi : jit(VEL.lo, X, Y, 31, 0.06)));
  for (let s = 0; s < 3; s++) P.hl(((x0 + x1) >> 1) - 10 + s * 3, 29 + s, 20 - s * 6, GOLD.base);
  area(P, x0, win.y0, win.x0 - x0, win.y1 - win.y0, (X, Y, i) => (i === win.x0 - x0 - 1 ? GOLD.lo : i === 0 ? GOLD.hi : jit(VEL.lo, X, Y, 32, 0.06)));
  area(P, win.x1, win.y0, x1 - win.x1, win.y1 - win.y0, (X, Y, i) => (i === 0 ? GOLD.hi : i === x1 - win.x1 - 1 ? GOLD.lo : jit(VEL.lo, X, Y, 33, 0.06)));
  // glaset: reflexer och talgallret i mässing
  for (let j = 0; j < win.y1 - win.y0; j++) for (let i = 0; i < win.x1 - win.x0; i++) {
    const X = win.x0 + i, Y = win.y0 + j, s = ((X * 2 - Y * 3) % 44 + 44) % 44;
    if (s < 3) P.px(X, Y, 0xfffaf0, 0.28); else if (s === 7) P.px(X, Y, 0xfffaf0, 0.12);
  }
  const gx = (win.x0 + win.x1) >> 1, grx = gx + 15, gy = win.y1 - 7;
  area(P, grx - 4, gy - 4, 9, 9, (X, Y) => { const d = Math.hypot(X - grx, Y - gy); return d <= 3.8 ? (d > 2.7 ? GOLD.base : ((X + Y) & 1 ? 0x2a1a10 : GOLD.lo)) : null; });
  // disklisten (marmor och mässing) med biljettspringan
  area(P, x0 - 1, win.y1, x1 - x0 + 2, 4, (X, Y, i, j) => (j === 0 ? GOLD.hi : j === 3 ? GOLD.lo : jit(0xe8e0d0, X, Y, 34, 0.1)));
  P.rect(gx - 6, win.y1 + 1, 12, 2, 0x1a0e08); P.hl(gx - 6, win.y1 + 1, 12, 0x3a2414);
  // frontpanelen med solfjäder och prisskylten
  area(P, x0, win.y1 + 4, x1 - x0, WY - win.y1 - 4, (X, Y, i, j) => {
    if (i === 0 || i === x1 - x0 - 1) return GOLD.lo;
    let c = jit(VEL.mid, X, Y, 35, 0.06);
    const d = Math.hypot(X - gx, Y - (WY + 2)), a = Math.atan2(Y - (WY + 2), X - gx);
    if (d < 16 && Math.round(a * 6) % 2 === 0) c = mix(c, GOLD.lo, 0.5);
    if (d < 16 && d > 14.5) c = GOLD.base;
    return c;
  });
  const pt = 'BILJETT 90 KR', pw = textW(SMALL, pt) + 6;
  area(P, gx - (pw >> 1), win.y1 + 6, pw, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === pw - 1 || j === 8 ? GOLD.base : 0x1a0a0e));
  text(P, SMALL, pt, gx - (pw >> 1) + 3, win.y1 + 8, GOLD.hi);
  return { img: P.flush(), ox, oy };
}

// Baren mot väggen: POPCORN-skylten, popcornmaskinen (poppandet ritas live), bägartravar,
// läskfontänen, godisväggen med lösgodis och bakdisken
function paintBarWall(P) {
  const { x0, x1 } = F.BAR, M = F.MACHINE;
  // skylten POPCORN med glödlampor runt om
  const sx0 = 290, sx1 = 372;
  area(P, sx0, 12, sx1 - sx0, 14, (X, Y, i, j) => (i === 0 || j === 0 || i === sx1 - sx0 - 1 || j === 13 ? GOLD.base : jit(0x1a0a0e, X, Y, 36, 0.05)));
  drawText(P, textMask(BIG, 'POPCORN'), ((sx0 + sx1) >> 1) - (textW(BIG, 'POPCORN') >> 1), 15, { fill: (a, b) => (b < 3 ? 0xfff0a0 : 0xffc040), out: 0x6a1a08, oa: 0.9 });
  for (let x = sx0 + 3; x < sx1 - 2; x += 4) { P.px(x, 13, 0xfff0b0); P.px(x, 24, 0xfff0b0); }
  // popcornmaskinen: röd huv med text, glasskåp, kittel, röd underdel
  area(P, M.x0 - 1, M.y0, M.x1 - M.x0 + 2, 7, (X, Y, i, j) => (j === 0 ? 0xf0707a : j === 6 ? 0x6a1018 : jit(0xd82a3a, X, Y, 37, 0.06)));
  text(P, SMALL, 'POPCORN', M.x0 + 2, M.y0 + 1, 0xfff6e0);
  area(P, M.x0, M.y0 + 7, M.x1 - M.x0, M.y1 - M.y0 - 13, (X, Y, i, j, w = M.x1 - M.x0, h = M.y1 - M.y0 - 13) => {
    if (i === 0 || i === w - 1) return 0xd82a3a;
    if (j > h - 9) return hash(X, Y, 38) > 0.4 ? (hash(X, Y, 39) > 0.5 ? 0xfff6d8 : 0xf8e4a0) : 0xf0c860;   // högen med popcorn
    return mix(0xfff4d0, 0xffe8a8, j / h);
  });
  // kitteln i taket på skåpet
  area(P, M.x0 + 8, M.y0 + 8, 14, 7, (X, Y, i, j) => ((i === 0 || i === 13) && j < 2 ? null : j === 0 ? 0xe8eef2 : j < 5 ? 0xa8b0bc : 0x6a7280));
  P.vl(M.x0 + 15, M.y0 + 7, 1, 0x4a4a54);
  area(P, M.x0 - 1, M.y1 - 6, M.x1 - M.x0 + 2, 6, (X, Y, i, j) => (j === 0 ? 0xf0707a : jit(0xb8202e, X, Y, 40, 0.06)));
  for (let k = 0; k < 3; k++) P.px(M.x0 + 6 + k * 9, M.y1 - 3, GOLD.hi);
  // travar med popcornbägare (röd- och vitrandiga) på bakdisken
  for (const [bx, n] of [[290, 4], [298, 3]]) for (let k = 0; k < n; k++) {
    const y = 58 - k * 2;
    area(P, bx, y, 7, 3, (X, Y, i, j) => (j === 0 ? 0xfff6e0 : (i & 1 ? 0xd82a3a : 0xf4f1ea)));
  }
  // läskfontänen i stål med tre kranar och upplysta etiketter
  area(P, 306, 38, 12, 24, (X, Y, i, j) => (i === 0 ? 0xe8eef2 : i === 11 ? 0x5a646e : j < 8 ? [0xd83a3a, 0x3a7bd5, 0xf0c040][Math.floor(i / 4) % 3] : jit(0xb8c2cc, X, Y, 41, 0.05)));
  for (let k = 0; k < 3; k++) { P.rect(307 + k * 4, 47, 2, 3, 0x2a2a30); P.px(307 + k * 4, 50, 0x1a1a1e); }
  // godisväggen: tre hyllor med genomskinliga lådor lösgodis och skylten GODIS
  goldText(P, SMALL, 'GODIS', 336, 28);
  const CANDY = [[0xff5a7a, 0xffffff], [0x7ad06a, 0xffd040], [0x5ab8ff, 0xffffff], [0x2a1a14, 0xf4f1ea], [0xffa030, 0xff5a5a], [0xc07aff, 0x7ad06a]];
  for (let r = 0; r < 3; r++) {
    const y = 34 + r * 9;
    P.hl(322, y + 8, 56, GOLD.lo);
    for (let b = 0; b < 5; b++) {
      const bx = 323 + b * 11, [c1, c2] = CANDY[(r * 5 + b) % CANDY.length];
      area(P, bx, y, 10, 8, (X, Y, i, j) => {
        if (i === 0 || i === 9 || j === 7) return 0xc8d8e0;
        if (j < 2) return null;
        return hash(X, Y, 42 + r) > 0.5 ? c1 : hash(X, Y, 43) > 0.4 ? c2 : mix(c1, 0x000000, 0.3);
      });
      P.hl(bx + 1, y + 1, 8, 0xe8f4f8, 0.6);
    }
  }
  // bakdisken: mörkt trä med mässingslist och skåpluckor
  area(P, x0, 62, x1 - x0, F.WALL_Y - 62 - 2, (X, Y, i, j) => {
    if (j === 0) return GOLD.hi; if (j === 1) return GOLD.lo;
    let c = jit(0x3a1c12, X, Y, 44, 0.06);
    const k = (X - x0) % 22;
    if (k === 0) c = 0x1a0a06; else if (k === 1) c = 0x5a3020;
    if (k === 18 && j > 8 && j < 12) c = GOLD.base;
    return c;
  });
}
// Godisdisken på golvet: glasfront med lösgodis, disken med popcornbägare till salu,
// kassaapparaten och prisskylten POPCORN 35:-
export function paintCounter() {
  const { x0, x1, top, face, y } = F.CNT, ox = x0 - 2, oy = 84;
  const P = new Pix(x1 - x0 + 4, y - oy + 3, ox, oy), w = x1 - x0;
  area(P, x0, top, w, face - top, (X, Y, i, j) => (j === 0 ? GOLD.hi : j === face - top - 1 ? GOLD.lo : jit(0xe8e0d0, X, Y, 50, 0.08)));
  area(P, x0, face, w, y - face, (X, Y, i, j) => {
    if (i === 0 || i === w - 1) return GOLD.lo;
    if (Y >= y - 3) return [GOLD.base, 0x5a3020, 0x1a0a06][Y - (y - 3)];
    // glasfronten: lådor med godis bakom glaset
    const k = (X - x0) % 20;
    if (k === 0) return GOLD.mid;
    if (j < 2) return mix(0xd8e8f0, 0x6a1018, 0.5);
    const CANDY = [0xff5a7a, 0x7ad06a, 0x5ab8ff, 0xffa030, 0xc07aff, 0xf4f1ea];
    const col = CANDY[Math.floor((X - x0) / 20) % CANDY.length];
    return hash(X, Y, 51) > 0.45 ? col : mix(col, 0xffffff, 0.4);
  });
  for (let j = 0; j < y - face - 3; j++) for (let i = 0; i < w; i++) { const X = x0 + i, Y = face + j, s = ((X * 2 - Y * 3) % 36 + 36) % 36; if (s < 2) P.px(X, Y, WHITE, 0.3); }
  // kassaapparaten till höger
  area(P, x1 - 20, top - 9, 16, 9, (X, Y, i, j) => (j === 0 || i === 0 ? 0x6a6a74 : i === 15 || j === 8 ? 0x1a1a20 : jit(0x3a3a44, X, Y, 52, 0.06)));
  P.rect(x1 - 17, top - 13, 10, 4, 0x1a1a20); P.rect(x1 - 16, top - 12, 8, 2, 0x2a6a3a);
  for (let k = 0; k < 4; k++) P.px(x1 - 18 + k * 3, top - 6, 0xf4f1ea);
  // tre popcornbägare till salu (liten, mellan, stor) och en tältskylt
  for (const [bx, h] of [[x0 + 8, 8], [x0 + 18, 10], [x0 + 30, 12]]) {
    area(P, bx, top - h, 8, h, (X, Y, i, j) => (j < 3 ? (hash(X, Y, 53) > 0.5 ? 0xfff6d8 : 0xf0d070) : i === 0 || i === 7 ? 0xb8202e : ((i >> 1) & 1 ? 0xd82a3a : 0xf4f1ea)));
    P.px(bx + 2, top - h - 1, 0xfff6d8); P.px(bx + 5, top - h - 1, 0xf8e4a0);
  }
  const t = '35:-', tw = textW(BIG, t) + 6;
  area(P, x0 + 44, top - 12, tw, 11, (X, Y, i, j) => (i === 0 || j === 0 || i === tw - 1 || j === 10 ? GOLD.base : 0x1a0a0e));
  drawText(P, textMask(BIG, t), x0 + 47, top - 10, { fill: 0xfff0a0 });
  outline(P, 0x1a0a06);
  return { img: P.flush(), ox, oy };
}

// Salongsdörrarna (två flyglar i vinröd läderklädsel med mässingsnitar och runda
// fönster) i bildrutor där de svänger in: 0 = stängd … N-1 = helt öppen
export function paintSalonDoors(N = 6) {
  const { x0, x1, top } = F.SD, h = F.WALL_Y - top, half = (x1 - x0) >> 1;
  const leaf = (flip) => {
    const S = new Pix(half, h);
    area(S, 0, 0, half, h, (X, Y, i, j) => {
      let c = jit(VEL.base, X, Y, 60 + (flip ? 1 : 0), 0.05);
      if ((i + j) % 8 === 0 || (i - j + 800) % 8 === 0) c = VEL.mid;              // stoppningens rombmönster
      if ((i + j) % 8 === 0 && (i - j + 800) % 8 === 0) c = GOLD.base;           // mässingsnitarna
      return c;
    });
    S.bevel(0, 0, half, h, VEL.hi, VEL.dk);
    area(S, 1, 1, half - 2, 2, (X, Y, i, j) => (j === 0 ? GOLD.hi : GOLD.lo));
    // runt fönster (mörkt – salongen bakom)
    const cx = half >> 1, cy = 14;
    area(S, cx - 6, cy - 6, 13, 13, (X, Y) => { const d = Math.hypot(X - cx, Y - cy); return d <= 5.8 ? (d > 4.6 ? GOLD.base : 0x0e0a14) : null; });
    S.px(cx - 2, cy - 2, 0x3a3450);
    // skjutplåten i mässing
    const px = flip ? 2 : half - 6;
    area(S, px, 24, 4, 12, (X, Y, i, j) => (i === 0 ? GOLD.hi : i === 3 ? GOLD.lo : GOLD.base));
    return S;
  };
  const L = leaf(false), Rr = leaf(true);
  const frames = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.3, pw = Math.max(2, Math.round(half * Math.cos(th))), shade = 1 - 0.4 * Math.sin(th);
    const Fr = new Pix(x1 - x0, h);
    for (const [src, left] of [[L, true], [Rr, false]]) {
      for (let c = 0; c < pw; c++) {
        const sc = Math.min(half - 1, Math.floor((c * half) / pw));
        const sx = left ? c : (x1 - x0) - pw + c, scol = left ? sc : sc;
        for (let yy = 0; yy < h; yy++) {
          const i = (yy * half + scol) * 4, a = src.d[i + 3];
          if (!a) continue;
          Fr.px(sx, yy, mul((src.d[i] << 16) | (src.d[i + 1] << 8) | src.d[i + 2], shade));
        }
      }
    }
    frames.push(Fr.flush());
  }
  return frames;
}
// salongsdörrarnas foder, skylten SALONG 1 och lampan TYST – FILM (lyser live)
function paintSalonPortal(P) {
  const { x0, x1, top } = F.SD, WY = F.WALL_Y;
  // öppningen bakom dörrarna: mörk salong
  area(P, x0, top, x1 - x0, WY - top, (X, Y) => qmix(0x0a0610, 0x1a0c14, (Y - top) / (WY - top), X, Y, 3));
  for (let i = 0; i < 4; i++) { const c = [GOLD.dk, GOLD.hi, GOLD.base, GOLD.lo][i]; P.vl(x0 - 4 + i, top - 3, WY - top + 3, c); P.vl(x1 + 3 - i, top - 3, WY - top + 3, c); }
  area(P, x0 - 4, top - 5, x1 - x0 + 8, 3, (X, Y, i, j) => [GOLD.hi, GOLD.base, GOLD.lo][j]);
  // skylten SALONG 1 i en upplyst låda
  const sx0 = x0 - 2, sx1 = x1 + 2;
  area(P, sx0, 14, sx1 - sx0, 13, (X, Y, i, j) => (i === 0 || j === 0 || i === sx1 - sx0 - 1 || j === 12 ? GOLD.base : jit(0x1a0a0e, X, Y, 61, 0.05)));
  goldText(P, BIG, 'SALONG 1', ((x0 + x1) >> 1) - (textW(BIG, 'SALONG 1') >> 1), 17);
  for (let x = sx0 + 3; x < sx1 - 2; x += 4) { P.px(x, 15, 0xfff0b0); P.px(x, 25, 0xfff0b0); }
  // lampan under skylten (text och sken ritas live)
  area(P, ((x0 + x1) >> 1) - 22, 28, 44, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === 43 || j === 8 ? 0x3a2a24 : 0x1a0808));
}

// ---------- sprites på golvet ----------
// Rundsoffan: stoppad röd sammet runt en pelare med en mässingsurna och en palm i toppen.
// Sitsen är en ellips runt pelaren; man sitter på framsidan och tittar ut i foajén.
export function paintSofa() {
  const w = 88, h = 80, cx = 44, P = new Pix(w, h);
  const base = 78, sy = 58, rx = 42, ry = 10, colTop = 30, colR = 15;
  // palmen (bakom urnan)
  for (let f = 0; f < 11; f++) {
    const a = -Math.PI / 2 + (f - 5) * 0.34, len = 18 + (f % 3) * 3;
    for (let r = 2; r < len; r++) {
      const x = cx + Math.cos(a) * r * 1.25, y = 22 + Math.sin(a) * r * 0.95 + r * r * 0.045;
      P.px(Math.round(x), Math.round(y), r < len * 0.6 ? 0x3a8a3a : 0x2a6a2a);
      if (r > 3 && r % 2 === 0) { P.px(Math.round(x), Math.round(y + 1), 0x5aaa4a); P.px(Math.round(x + (f < 5 ? -1 : 1)), Math.round(y + 2), 0x245a24); }
    }
  }
  // urnan i mässing
  area(P, cx - 6, 20, 13, 11, (X, Y, i, j) => { const half = j < 2 ? 6 : j < 8 ? 5 - (j > 5 ? 1 : 0) : 3; if (Math.abs(i - 6) > half) return null; return j === 0 ? GOLD.hi : i - 6 < -2 ? GOLD.hi : i - 6 > 2 ? GOLD.lo : GOLD.base; });
  // sitsen (hela ellipsen – pelaren ritas ovanpå den bakre halvan)
  area(P, cx - rx, sy - ry, rx * 2 + 1, ry * 2 + 1, (X, Y) => {
    const u = (X + 0.5 - cx) / rx, v = (Y + 0.5 - sy) / ry, d = Math.hypot(u, v);
    if (d > 1) return null;
    let c = mix(VEL.hi, VEL.base, (v + 1) / 2);
    if (d > 0.9) c = GOLD.lo;
    if (((X - cx + 60) % 9 === 0) && Math.abs(v) < 0.6 && d < 0.85) c = mix(c, GOLD.lo, 0.7);   // knapparna
    return jit(c, X, Y, 63, 0.05);
  });
  // pelaren: stoppad trumma med guldring upptill och knappar
  area(P, cx - colR, colTop, colR * 2 + 1, sy - colTop + 3, (X, Y, i, j) => {
    const e = (X + 0.5 - cx) / colR;
    if (Math.abs(e) > 1) return null;
    const bot = sy - 1 + Math.round(3 * Math.sqrt(1 - e * e));
    if (Y > bot) return null;
    let c = mix(VEL.base, VEL.dk, Math.abs(e) ** 1.6);
    if (e < -0.4) c = mix(c, VEL.hi, 0.3 * (1 + e));
    if (j === 0 || j === 1) c = j === 0 ? GOLD.hi : GOLD.lo;
    if (j > 3 && (j % 6 === 4) && Math.round((e + 1) * 5) % 2 === 0) c = mix(c, GOLD.base, 0.7);
    return jit(c, X, Y, 62, 0.05);
  });
  // sargen fram: från ellipsens framkant och ner, med guldpaspoal och frans
  for (let X = cx - rx; X <= cx + rx; X++) {
    const u = (X + 0.5 - cx) / rx;
    if (Math.abs(u) > 1) continue;
    const top = Math.round(sy + ry * Math.sqrt(1 - u * u));
    for (let Y = top; Y < top + 10; Y++) {
      const j = Y - top;
      let c = j === 0 ? GOLD.base : j < 8 ? jit(mix(VEL.base, VEL.lo, Math.abs(u) + j / 16), X, Y, 64, 0.05) : ((X & 1) ? GOLD.hi : GOLD.lo);
      if (j === 7) c = GOLD.lo;
      P.px(X, Y, c);
    }
  }
  outline(P, 0x1a0608);
  return { img: P.flush(), ox: cx, oy: base };
}
// Gripklon: ett glasskåp fullt med gosedjur, klon i taket, spak och myntinkast
export function paintKlo() {
  const w = 26, h = 46, P = new Pix(w, h);
  area(P, 1, 0, 24, 7, (X, Y, i, j) => (j === 0 ? 0xff8aa0 : j === 6 ? 0x6a1830 : jit(0xd8305a, X, Y, 66, 0.06)));
  text(P, SMALL, 'VINN!', 4, 1, 0xfff0a0);
  area(P, 1, 7, 24, 22, (X, Y, i, j) => (i === 0 || i === 23 ? 0xc8a44a : j > 13 ? null : mix(0x2a3a5a, 0x3a4a6a, j / 14)));
  // gosedjuren i högen
  const TOY = [0xf0c040, 0x7ad06a, 0xff8aa0, 0x5ab8ff, 0xc07aff, 0xd8a45a];
  for (let k = 0; k < 11; k++) {
    const tx = 3 + ((k * 7) % 19), ty = 21 + ((k * 5) % 6), col = TOY[k % TOY.length];
    area(P, tx, ty, 4, 4, (X, Y, i, j) => ((i === 0 || i === 3) && (j === 0) ? null : j === 0 ? mix(col, WHITE, 0.3) : col));
    P.px(tx + 1, ty + 1, 0x17151a); P.px(tx + 2, ty + 1, 0x17151a);
  }
  // klon i sin vajer
  P.vl(13, 8, 7, 0x9aa0a8); spr(P, 11, 15, ['.ggg.', 'g...g', 'g...g'], { g: 0xc8ccd4 });
  // glaset
  for (let j = 0; j < 22; j++) for (let i = 1; i < 23; i++) { const s = ((i * 2 - j * 3) % 30 + 30) % 30; if (s < 2) P.px(1 + i, 7 + j, WHITE, 0.3); }
  // underdelen med spak och myntinkast
  area(P, 0, 29, 26, 17, (X, Y, i, j) => (j === 0 ? GOLD.hi : j === 16 ? 0x2a0a14 : i === 0 ? 0xff8aa0 : i === 25 ? 0x6a1830 : jit(0xd8305a, X, Y, 67, 0.06)));
  P.rect(6, 31, 14, 4, 0x2a0a14); P.vl(9, 29, 3, 0x2a2a30); P.rect(8, 27, 3, 2, 0xf04a4a);
  P.rect(16, 32, 2, 2, 0xf0d890); P.rect(8, 38, 10, 4, 0x1a0a10); P.hl(8, 38, 10, 0x3a2a30);
  outline(P, 0x1a0608);
  return { img: P.flush(), ox: 13, oy: 45 };
}
// Kartongfiguren av PIXELHÄMNAREN i naturlig storlek med PREMIÄR-stjärnan
export function paintStandee() {
  const w = 44, h = 54, P = new Pix(w, h);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
  drawPerson(cx, 16, 48, { skin: '#e0a97f', hair: '#1d1714', style: 'spiky', top: 'jacket', shirt: '#2b2b30', accent: '#7a2e3e', bottom: 'jeans', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: 'sun', build: 6 }, 'down', 9);
  const d = cx.getImageData(0, 0, w, h).data;
  // bara figuren (inte skuggan) – kartongkant runt om
  for (let y = 0; y < 47; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (d[o + 3] > 200) P.px(x, y, (d[o] << 16) | (d[o + 1] << 8) | d[o + 2]); }
  const src = new Uint8ClampedArray(P.d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[(yy * w + xx) * 4 + 3] && Math.abs(dx) + Math.abs(dy) <= 3) { near = true; break; } }
    if (near) P.px(x, y, y > 40 ? 0xd8c8a8 : 0xf4ecd8);
  }
  // kristallen han håller i
  spr(P, 14, 29, ['..#..', '.#o#.', '#ooo#', '.#o#.', '..#..'], { '#': 0x1a8ab0, o: 0xbff8ff });
  // foten
  area(P, 6, 47, 22, 5, (X, Y, i, j) => (j === 0 ? 0xf4ecd8 : j === 4 ? 0x3a2a1a : jit(0xc8a878, X, Y, 65, 0.08)));
  // PREMIÄR-stjärnan
  const sx = 34, sy = 12;
  for (let a = 0; a < 16; a++) { const r = a & 1 ? 5 : 9, th = a / 16 * Math.PI * 2; for (let k = 0; k <= r; k++) P.px(Math.round(sx + Math.cos(th) * k), Math.round(sy + Math.sin(th) * k), 0xffd040); }
  area(P, sx - 6, sy - 6, 13, 13, (X, Y) => (Math.hypot(X - sx, Y - sy) < 6 ? 0xffd040 : null));
  text(P, SMALL, 'NY', sx - 3, sy - 3, 0xc8262e);
  outline(P, 0x1a0e08);
  return { img: P.flush(), ox: 17, oy: 52 };
}
export function paintPalm() {
  const P = new Pix(24, 40);
  for (let f = 0; f < 9; f++) {
    const a = -Math.PI / 2 + (f - 4) * 0.38;
    for (let r = 0; r < 14; r++) {
      const x = 12 + Math.cos(a) * r * 1.1, y = 20 + Math.sin(a) * r + r * r * 0.05;
      P.px(Math.round(x), Math.round(y), r < 9 ? 0x3a8a3a : 0x2a6a2a);
      if (r > 3 && r % 2) P.px(Math.round(x + (f < 4 ? -1 : 1)), Math.round(y + 1), 0x5aaa4a);
    }
  }
  P.vl(12, 20, 8, 0x6a4a2a);
  area(P, 6, 27, 13, 12, (X, Y, i, j) => ((i < 1 || i > 11) && j > 8 ? null : j === 0 ? GOLD.hi : j === 1 ? GOLD.lo : i < 3 ? GOLD.hi : i > 9 ? GOLD.lo : GOLD.base));
  outline(P, 0x1a0e08);
  return { img: P.flush(), ox: 12, oy: 39 };
}
export function paintBin() {
  const P = new Pix(14, 20);
  area(P, 1, 6, 12, 13, (X, Y, i, j) => (j === 0 ? GOLD.hi : i < 3 ? GOLD.hi : i > 9 ? GOLD.lo : GOLD.base));
  text(P, SMALL, 'TACK', 1, 10, 0x3a1a08);
  // en tom popcornbägare sticker upp
  area(P, 4, 0, 6, 6, (X, Y, i) => (i & 1 ? 0xd82a3a : 0xf4f1ea));
  outline(P, 0x1a0e08);
  return { img: P.flush(), ox: 7, oy: 19 };
}
// kösnörenas stolpe (mässing med kula)
export function paintPost() {
  const P = new Pix(5, 14);
  spr(P, 0, 0, ['.gG.', 'gGGg', '.gg.', '.gG.', '.gG.', '.gG.', '.gG.', '.gG.', '.gG.', '.gG.', '.gG.', 'gGGg', 'ggGg'], { g: GOLD.lo, G: GOLD.hi });
  return { img: P.flush(), ox: 2, oy: 13 };
}

// Popcornbägaren: 8 × 10 (buren i handen) eller 5 × 7 (i stolens mugghållare).
// left = tuggor kvar av tuggor (högen sjunker), 0 = tom bägare
const BUCKETS = new Map();
export function bucketImg(left, total, small = false) {
  const key = `${small ? 's' : 'b'}${left}/${total}`;
  let b = BUCKETS.get(key);
  if (b) return b;
  const w = small ? 5 : 8, h = small ? 7 : 11, P = new Pix(w, h);
  const fill = total ? left / total : 1;
  const top = small ? 2 : 3;
  area(P, 0, top, w, h - top, (X, Y, i, j) => {
    const narrow = j > (h - top) * 0.6 && (i === 0 || i === w - 1);
    if (narrow) return null;
    return i === 0 ? 0xb8202e : (i >> (small ? 0 : 1)) & 1 ? 0xd82a3a : 0xf4f1ea;
  });
  P.hl(0, top, w, 0xfff6e0);
  // högen: toppar över kanten när den är full, sjunker ner i bägaren
  const heapH = Math.round((small ? 3 : 5) * fill);
  for (let i = 0; i < w; i++) for (let k = 0; k < heapH; k++) {
    const y = top + (small ? 1 : 2) - k + ((small ? 3 : 5) - heapH) + (i === 0 || i === w - 1 ? 1 : 0);
    if (y < 0) continue;
    P.px(i, y, hash(i, k, 81 + left) > 0.45 ? 0xfff6d8 : 0xf0d070);
  }
  outline(P, 0x2a0a0e);
  b = P.flush();
  BUCKETS.set(key, b);
  return b;
}

// Foajéns bakgrund (dörrens utsikt skiljer dag och kväll)
export function paintFoaje(night) {
  const P = new Pix(W, H);
  paintFoajeWall(P, night);
  paintOutside(P, night);
  // skjutdörrarnas mässingsfoder och UT-skylten
  const { x0, x1, top } = F.DOOR;
  for (let i = 0; i < 4; i++) { const c = [GOLD.dk, GOLD.hi, GOLD.base, GOLD.lo][i]; P.vl(x0 - 4 + i, top - 4, F.WALL_Y - top + 4, c); P.vl(x1 + 3 - i, top - 4, F.WALL_Y - top + 4, c); }
  area(P, x0 - 4, top - 6, x1 - x0 + 8, 3, (X, Y, i, j) => [GOLD.hi, GOLD.base, GOLD.lo][j]);
  const ux = ((x0 + x1) >> 1) - 8;
  P.rect(ux, 22, 17, 9, 0x1a2a1e); P.box(ux, 22, 17, 9, 0x0e1812);
  text(P, SMALL, 'UT', ux + 5, 24, 0x6fe08a); P.ell(ux + 8.5, 26, 12, 6, 0x6fe08a, 0.12, 2);
  paintPosters(P);
  paintWallBits(P);
  paintBoothInside(P);
  paintBarWall(P);
  paintSalonPortal(P);
  paintFoajeFloor(P, night);
  return P.flush();
}
// Skjutdörrarnas glas (två flyglar som glider isär: open 0..1)
export function drawSlideDoors(ctx, open, night) {
  const { x0, x1, top } = F.DOOR, half = (x1 - x0) >> 1, h = F.WALL_Y - top, o = Math.round(open * (half - 2));
  for (const [lx, dir] of [[x0 - o, -1], [x0 + half + o, 1]]) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, top, x1 - x0, h); ctx.clip();
    ctx.fillStyle = night ? 'rgba(40,50,80,.22)' : 'rgba(200,230,240,.18)'; ctx.fillRect(lx, top, half, h);
    ctx.fillStyle = '#a8843a'; ctx.fillRect(lx, top, half, 1); ctx.fillRect(lx, top + h - 3, half, 3); ctx.fillRect(dir < 0 ? lx + half - 1 : lx, top, 1, h);
    ctx.fillStyle = '#f0d890'; ctx.fillRect(lx, top + h - 3, half, 1);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 10; k++) ctx.fillRect(lx + 3 + k, top + 22 - k, 1, 1);
    ctx.fillStyle = '#c8a44a'; ctx.fillRect(dir < 0 ? lx + half - 4 : lx + 2, top + 22, 2, 8);
    ctx.restore();
  }
}

// ================= SALONGEN =================
const RED_PLEAT = [0x3a0e1a, 0x2e0a14, 0x440f1e, 0x360c18];
export function paintSalong() {
  const P = new Pix(W, H), WY = S.WALL_Y, { x0: fx0, x1: fx1, y0: fy0, y1: fy1 } = S.FRAME;
  // taket med stjärnhimmel och veckade tygväggar
  area(P, 0, 0, W, WY, (X, Y) => {
    if (Y < 4) return hash(X, Y, 90) > 0.94 ? 0xfff0c0 : 0x0e0408;
    let c = RED_PLEAT[(X >> 1) & 3];
    c = mix(c, 0x14040a, Math.max(0, (Y - 60) / 90));
    if (Y === 4) c = GOLD.lo;
    return jit(c, X, Y, 91, 0.04);
  });
  // ett guldband i huvudhöjd och lampetterna
  area(P, 0, 40, W, 2, (X, Y, i, j) => (j === 0 ? GOLD.base : GOLD.dk));
  for (const sx of S.SCONCES) spr(P, sx - 4, 26, ['.gGGGg.', 'gYYYYYg', 'gYyYyYg', '.gYYYg.', '..gYg..', '...g...'], { g: GOLD.lo, G: GOLD.hi, Y: 0xf8e0a0, y: 0xe8c070 });
  // högtalargaller vid sidorna av ramen
  for (const gx of [128, 426]) area(P, gx, 44, 22, 44, (X, Y, i, j) => (i === 0 || j === 0 || i === 21 || j === 43 ? GOLD.lo : (X + Y) & 1 ? 0x1a0a10 : 0x24101a));
  // ramen runt duken: guld i fyra toner med trappstegskrön i hörnen
  area(P, fx0, fy0, fx1 - fx0, fy1 - fy0, (X, Y, i, j) => {
    const e = Math.min(i, j, fx1 - fx0 - 1 - i, fy1 - fy0 - 1 - j);
    if (e > 3) return null;
    return [GOLD.dk, GOLD.hi, GOLD.base, GOLD.lo][e];
  });
  for (const cx of [fx0 + 2, fx1 - 18]) for (let s = 0; s < 3; s++) P.rect(cx + s * 2, fy0 - 3 + s, 16 - s * 4, 1, GOLD.base);
  // svart maskering mellan ramen och duken, duken (vit, lätt mönstrad)
  area(P, fx0 + 4, fy0 + 4, fx1 - fx0 - 8, fy1 - fy0 - 8, () => 0x0a0608);
  area(P, S.FILM.x, S.FILM.y, 240, 80, (X, Y) => jit(0xe8e4dc, X, Y, 92, 0.03));
  // sidoridåerna (uppknutna, alltid synliga) och kappan med guldfrans
  for (const [x0, flip] of [[fx0 + 4, false], [S.FILM.x + 240, true]]) area(P, x0, fy0 + 4, 8, fy1 - fy0 - 8, (X, Y, i) => {
    const k = flip ? 7 - i : i;
    return jit([VEL.lo, VEL.base, VEL.hi, VEL.base, VEL.mid, VEL.base, VEL.hi, VEL.mid][k], X, Y, 93, 0.05);
  });
  area(P, fx0 + 4, fy0 + 4, fx1 - fx0 - 8, 9, (X, Y, i, j) => {
    const sw = Math.round(Math.sin((i / (fx1 - fx0 - 8)) * Math.PI * 6) * 1.5);
    if (j > 6 + sw) return j === 7 + sw || j === 8 + sw ? (X & 1 ? GOLD.hi : GOLD.base) : null;
    return jit(j < 2 ? VEL.hi : VEL.base, X, Y, 94, 0.05);
  });
  // scenen med rampljus
  area(P, fx0 - 6, fy1, fx1 - fx0 + 12, WY - fy1, (X, Y, i, j) => (j === 0 ? GOLD.base : j === 1 ? 0x6a4424 : jit(0x3a2014, X, Y, 95, 0.06)));
  for (let x = fx0; x < fx1; x += 8) { P.px(x, fy1 + 3, 0xffd890); P.px(x + 1, fy1 + 3, 0xf0b060); }
  // dörrarna: UTGÅNG (till foajén) och NÖDUTGÅNG, med gröna skyltar
  for (const [D, label] of [[S.DOOR, 'UTGÅNG'], [S.NOD, 'NÖDUTGÅNG']]) {
    const h = WY - D.top;
    for (let i = 0; i < 3; i++) { P.vl(D.x0 - 3 + i, D.top - 3, h + 3, [GOLD.dk, GOLD.base, GOLD.lo][i]); P.vl(D.x1 + 2 - i, D.top - 3, h + 3, [GOLD.dk, GOLD.base, GOLD.lo][i]); }
    P.hl(D.x0 - 3, D.top - 3, D.x1 - D.x0 + 6, GOLD.hi); P.hl(D.x0 - 3, D.top - 2, D.x1 - D.x0 + 6, GOLD.lo);
    area(P, D.x0, D.top - 1, D.x1 - D.x0, h + 1, (X, Y, i, j) => {
      let c = jit(0x3a1a1e, X, Y, 96, 0.05);
      if ((i + j) % 7 === 0 || (i - j + 700) % 7 === 0) c = 0x2a1014;
      return c;
    });
    P.rect(D.x0 + 3, D.top + 22, D.x1 - D.x0 - 6, 3, 0x8a8a94); P.hl(D.x0 + 3, D.top + 22, D.x1 - D.x0 - 6, 0xd8dce0);   // nödbommen
    const lw = textW(SMALL, label) + 6, lx = ((D.x0 + D.x1) >> 1) - (lw >> 1), ly = D.top - 14;
    area(P, lx, ly, lw, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === lw - 1 || j === 8 ? 0x0e2a14 : 0x1a8a3a));
    text(P, SMALL, label, lx + 3, ly + 2, 0xf4fff4);
  }
  // golvet: tvärgången framför scenen och stolsraderna i trappsteg
  paintSalongFloor(P);
  return P.flush();
}
// platåernas y-gränser: rad k står på platån [top, bot)
export const PLAT = S.ROW_Y.map((y, k) => ({ top: k === 0 ? 126 : S.ROW_Y[k - 1] + 5, bot: y + 5 }));
function paintSalongFloor(P) {
  const WY = S.WALL_Y;
  // tvärgången: samma matta som foajén, i mörkare ton
  for (let y = WY; y < PLAT[0].top; y++) for (let x = 0; x < W; x++) P.px(x, y, carpet(x, y, 0.45 - (y - WY) * 0.005));
  const inAisle = (x) => S.AISLES.some((a) => Math.abs(x - a) < 20);
  PLAT.forEach((p, k) => {
    for (let y = p.top; y < Math.min(H, p.bot); y++) for (let x = 0; x < W; x++) {
      let c;
      if (inAisle(x)) {
        // trappan i gångarna: två steg per platå, löpare med guldkanter
        const a = S.AISLES.find((q) => Math.abs(x - q) < 20), dx = Math.abs(x - a);
        c = dx >= 18 ? GOLD.lo : jit(mix(0x5a1420, 0x7a1c2a, k / 5), x, y, 97, 0.06);
        const mid = (p.top + p.bot) >> 1;
        if (y === mid) c = dx >= 18 ? GOLD.lo : 0x2a0a10;
        if (y === mid + 1 && dx < 18) c = GOLD.mid;
      } else {
        c = carpet(x, y, 0.62 - k * 0.05);
      }
      if (y === p.top) c = 0x14040a;                                                 // stegkanten
      if (y === p.top + 1) c = inAisle(x) ? GOLD.hi : mix(c, GOLD.lo, 0.6);         // mässingsnosen
      P.px(x, y, c);
    }
    // sidoväggarnas trappprofil
    for (const [x0, flip] of [[0, false], [W - 8, true]]) area(P, x0, p.top, 8, Math.min(H, p.bot) - p.top, (X, Y, i, j) => {
      const kk = flip ? 7 - i : i;
      if (kk > 5 - Math.floor(j / 3)) return null;
      return jit(mix(0x2a0a12, 0x44101e, kk / 6), X, Y, 98, 0.05);
    });
  });
  // sidoväggarna ovanför golvet i perspektiv
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, WY + 12, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WY + (5 - k) * 2) return null;
    return jit(mul(RED_PLEAT[(Y >> 1) & 3], 0.6 + k * 0.05), X, Y, 99, 0.04);
  });
}
// En stolsrad bakifrån: ryggarna i röd sammet med en mässingsbricka, armstöden mellan
// stolarna med mugghållare. Rutan börjar på y = ROW_Y - 20.
export function paintSeatRow(k) {
  const y0 = S.ROW_Y[k] - 20, P = new Pix(W, 24, 0, y0), ry = S.ROW_Y[k];
  const back = (x) => {
    const top = ry - 15;
    area(P, x - 7, top, 14, 15, (X, Y, i, j) => {
      const inset = j === 0 ? 3 : j === 1 ? 1 : 0;
      if (i < inset || i > 13 - inset) return null;
      if (i === inset || i === 13 - inset) return j < 2 ? VEL.base : VEL.dk;
      if (j === 0) return VEL.hi;
      let c = mix(VEL.base, VEL.mid, j / 15);
      if (j === 1) c = mix(VEL.hi, VEL.base, 0.4);
      if (i === 1 || i === 2) c = mix(c, VEL.hi, i === 1 ? 0.3 : 0.15);
      if (i === 12) c = VEL.lo;
      if ((i === 5 || i === 9) && j > 3 && j < 12) c = mix(c, VEL.lo, 0.45);              // stoppningens veck
      if (j > 12) c = mix(VEL.lo, VEL.dk, (j - 12) / 3);
      return jit(c, X, Y, 100 + k, 0.05);
    });
    P.rect(x - 1, top + 3, 3, 2, GOLD.base); P.px(x - 1, top + 3, GOLD.hi);          // nummerbrickan
  };
  const arm = (x) => {
    P.rect(x - 1, ry - 9, 2, 10, 0x1a0c0c); P.vl(x - 1, ry - 9, 10, 0x3a2420);
    P.rect(x - 2, ry - 12, 4, 3, 0x241414); P.rect(x - 1, ry - 11, 2, 1, 0x080404); P.hl(x - 2, ry - 12, 4, 0x4a3430);   // mugghållaren
  };
  for (const [x0, n] of S.BLOCKS) {
    for (let i = 0; i <= n; i++) arm(x0 - 8 + i * S.PITCH);
    for (let i = 0; i < n; i++) back(x0 + i * S.PITCH);
  }
  return P.flush();
}
// Ridån: två halvor i röd sammet med veck och guldfrans; open 0..1 (0 = stängd)
export function drawCurtain(ctx, open) {
  const { x, y } = S.FILM, w = 240, h = 80, half = w / 2;
  const cw = Math.round(half * (1 - Math.min(1, open)));
  if (cw <= 0) return;
  for (const left of [true, false]) {
    for (let i = 0; i < cw; i++) {
      const xx = left ? x + i : x + w - 1 - i, fold = (i + (left ? 0 : 3)) % 8;
      ctx.fillStyle = ['#8a1a28', '#a01c2c', '#c83a48', '#a01c2c', '#7e1624', '#5a0e1a', '#7e1624', '#a01c2c'][fold];
      ctx.fillRect(xx, y, 1, h - 3);
      ctx.fillStyle = (xx & 1) ? '#f0d890' : '#c8a44a';
      ctx.fillRect(xx, y + h - 3, 1, 2);
    }
  }
  // BIO PIXEL i guld mitt på den stängda ridån
  if (open < 0.08) {
    const s = 'BIO PIXEL', tw = textW(BIG, s), tx = x + ((w - tw) >> 1), ty = y + 34;
    ctx.fillStyle = '#3a0a10'; eachTextPixel(BIG, s, tx + 1, ty + 1, 1, (px, py) => ctx.fillRect(px, py, 1, 1));
    ctx.fillStyle = '#e8c860'; eachTextPixel(BIG, s, tx, ty, 1, (px, py) => ctx.fillRect(px, py, 1, 1));
  }
}
