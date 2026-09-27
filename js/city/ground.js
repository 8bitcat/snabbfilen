// Pixelstadens mark – bakgatan, gränderna, tvärgatorna, trottoarerna, bilvägen
// och parken, målat pixel för pixel i samma korn som figurerna (1 enhet = 1 px).
//   paintGround(night) → canvas CITY.W × CITY.H. Målas EN gång per dag/natt
//                        och cachas av scenen (allt tungt sker här).
//   groundLive(ctx, env, view) → det lilla som rör sig på marken varje bildruta:
//                        drivande molnskuggor på dagen och regnringar i pölarna.
// Ljuset kommer snett från sydväst: fasaderna mot trottoaren är solbelysta och
// husen kastar skugga snett bakåt (norrut/österut) – in i gränderna och över
// bakgatan. Det är det som ger djup mellan husen.
import { Pix, mix, mul, hash, bayer, BIG, eachTextPixel } from '../core/floor-pix.js';
import { CITY, BUILDINGS, STREETS, CROSSWALKS, PARK_LAYOUT, PATH_RECTS, BUS_STOP } from './map.js';

const W = CITY.W, H = CITY.H;
const BASE = CITY.BASE, TOP = CITY.FOOT_TOP;
const [R0, R1] = CITY.ROAD;          // 218–276
const [SN0] = CITY.SIDEWALK_N;       // 186
const [SS0, SS1] = CITY.SIDEWALK_S;  // 276–306
const PK0 = CITY.PARK[0];            // 306
const SUN_DX = 0.2;                  // skuggan förskjuts så här mycket österut per pixel norrut

// ---------- pixelbuffert (skrivs direkt i ImageData under målningen) ----------
let D = null, SH = null;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
function put(x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y)) return;
  const i = (y * W + x) << 2;
  D[i] = (c >> 16) & 255; D[i + 1] = (c >> 8) & 255; D[i + 2] = c & 255; D[i + 3] = 255;
}
function get(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y)) return 0;
  const i = (y * W + x) << 2;
  return (D[i] << 16) | (D[i + 1] << 8) | D[i + 2];
}
function blend(x, y, c, a) {
  if (a <= 0 || !inb(Math.floor(x), Math.floor(y))) return;
  put(x, y, a >= 1 ? c : mix(get(x, y), c, a));
}
function shade(x, y, f) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y)) return;
  const i = (y * W + x) << 2;
  D[i] *= f; D[i + 1] *= f; D[i + 2] *= f;
}
// kastad skugga: mörkare och lite blåare, aldrig dubbelt på samma pixel
function shadow(x, y, f = 0.66) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y) || SH[y * W + x]) return;
  SH[y * W + x] = 1;
  put(x, y, mix(mul(get(x, y), f), 0x1a2238, 0.1));
}
function ellipse(cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t < 1) fn(x, y, t);
  }
}

// ---------- brus ----------
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const fbm = (x, y, s, seed) => vnoise(x, y, s, seed) * 0.58 + vnoise(x, y, s / 2.3, seed + 1) * 0.28 + vnoise(x, y, s / 5.1, seed + 2) * 0.14;

// granit: fläckig med mörka korn och glittrande kvarts
function granite(x, y, c) {
  const h = hash(x, y, 5);
  if (h > 0.9) return mul(c, 0.76);
  if (h < 0.06) return mix(c, 0xffffff, 0.3);
  return mul(c, 0.94 + hash(x, y, 6) * 0.1);
}
const grainy = (c, x, y, amt) => mul(c, 1 - amt + hash(x, y, 3) * amt * 2);

// ---------- stenrader ----------
// Rader med (ev. varierande) höjd, stenar med varierande bredd. bond = halvstensförband.
function rows(x0, x1, y0, y1, o) {
  const R = [], rowOf = new Int16Array(y1 - y0), n = x1 - x0;
  let y = y0, r = 0;
  while (y < y1) {
    const h = o.h[0] + ((hash(r, 1, o.seed) * (o.h[1] - o.h[0] + 1)) | 0);
    const k = new Int16Array(n), st = new Int32Array(n), wd = new Int16Array(n);
    let x = o.bond ? x0 - (r & 1) * (o.w[0] >> 1) - (o.shift || 0) : x0 - ((hash(r, 2, o.seed) * o.w[1]) | 0);
    for (let i = 0; x < x1; i++) {
      const w = o.w[0] + ((hash(r, i + 3, o.seed) * (o.w[1] - o.w[0] + 1)) | 0);
      for (let xx = Math.max(x, x0); xx < Math.min(x + w, x1); xx++) { k[xx - x0] = i; st[xx - x0] = x; wd[xx - x0] = w; }
      x += w;
    }
    R.push({ y, h, k, st, wd });
    for (let yy = y; yy < Math.min(y + h, y1); yy++) rowOf[yy - y0] = r;
    y += h; r++;
  }
  const S = { r: 0, k: 0, lx: 0, ly: 0, w: 0, h: 0 };
  return (x, yy) => {
    const ri = rowOf[yy - y0], Q = R[ri], j = x - x0;
    S.r = ri; S.k = Q.k[j]; S.lx = x - Q.st[j]; S.ly = yy - Q.y; S.w = Q.wd[j]; S.h = Q.h;
    return S;
  };
}
// Målar stenarna med fog nere/höger, högdager uppe/vänster och skugga nere/höger.
function stones(at, x0, x1, y0, y1, col, o = {}) {
  const hi = o.hi ?? 0.16, lo = o.lo ?? 0.82, jc = o.joint || (() => 0x4a443c), gr = o.grain ?? 0.06;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const s = at(x, y);
    if (s.lx === s.w - 1 || s.ly === s.h - 1) { put(x, y, jc(x, y)); continue; }
    let c = col(s, x, y);
    const L = s.lx, T = s.ly, Rr = s.w - 2, B = s.h - 2;
    if (o.round && (L === 0 || L === Rr) && (T === 0 || T === B)) c = mix(c, jc(x, y), 0.6);
    else if (T === 0) c = mix(c, 0xffffff, hi);
    else if (T === B) c = mul(c, lo);
    else if (L === 0) c = mix(c, 0xffffff, hi * 0.45);
    else if (L === Rr) c = mul(c, (1 + lo) / 2);
    put(x, y, grainy(c, x, y, gr));
  }
}

// ---------- asfalt ----------
const ASPH = 0x46484f;
// hjulspåren i körfälten (y-band där däcken nöter asfalten blank)
const TRACKS = [[233, 236], [240, 244], [259, 262], [266, 270]];
const trackAt = (y) => { for (const t of TRACKS) if (y >= t[0] && y < t[1]) return 1; return 0; };
function asphalt(x, y, tone = 0, road = true) {
  // grundton i tre skalor: stora fläckar, mellanstora och klumpig ballast (inte salt-och-peppar)
  const f = vnoise(x, y, 2.4, 26);
  let c = mul(ASPH, 1 + (vnoise(x, y, 44, 21) - 0.5) * 0.12 + (vnoise(x, y, 10, 22) - 0.5) * 0.08 + (f - 0.5) * 0.12 + tone);
  const tr = road ? trackAt(y) * (0.6 + vnoise(x, y, 18, 25) * 0.4) : 0;
  const h = hash(x, y, 23);
  if (h < 0.06) c = mul(c, 0.8);                                                       // mörk ballast
  else if (h > 0.992) c = mix(c, 0xaaa49a, 0.6 * (1 - tr * 0.5));                      // kvartskorn
  else if (h > 0.968) c = mix(c, 0x8e8a84, 0.36 * (1 - tr * 0.5));                     // ljust grus
  else if (h > 0.93 && f > 0.45) c = mix(c, 0x6e7078, 0.3);                            // gråblå sten
  if (tr) c = mul(c, 1 - 0.07 * tr);
  return c;
}
// vägmarkering med slitage (asfalten lyser igenom där färgen nötts bort)
function mark(x, y, col, wear) {
  const h = hash(x, y, 31);
  if (h < wear) return;
  let c = mul(col, 0.9 + hash(x, y, 32) * 0.12);
  if (h < wear + 0.15) c = mix(c, get(x, y), 0.5);
  put(x, y, c);
}
const wearAt = (x, y, base = 0.05) => base + trackAt(y) * 0.3 + vnoise(x, y, 7, 33) * 0.15;

// sprickor: slumpvandring. sealed = tätad med blank svart bitumen
function crack(x, y, len, seed, o = {}) {
  let px = Math.floor(x), py = Math.floor(y);
  for (let i = 0; i < len; i++) {
    if (o.sealed) {
      put(px, py, 0x1d1e23);
      if (hash(i, seed, 1) > 0.55) put(px, py + 1, 0x26272d);
      if (hash(i, seed, 2) > 0.8) put(px, py - 1, 0x3c3e46);
    } else {
      shade(px, py, 0.55);
      if (hash(i, seed, 3) > 0.6) blend(px, py + 1, 0xffffff, 0.08);
    }
    if (o.vert) { py += 1; if (hash(i, seed, 4) < 0.4) px += hash(i, seed, 5) < 0.5 ? -1 : 1; }
    else { px += o.dx || 1; if (hash(i, seed, 4) < 0.38) py += hash(i, seed, 5) < 0.5 ? -1 : 1; }
    if (o.x0 !== undefined) px = Math.max(o.x0, Math.min(o.x1 - 1, px));
    py = Math.max(o.y0 ?? 0, Math.min((o.y1 ?? H) - 1, py));
    if (o.branch && hash(i, seed, 6) > 0.93) crack(px, py, (len - i) >> 1, seed + 17 + i, { ...o, branch: false, vert: !o.vert, dx: 1 });
  }
}
// oljefläck / smutsfläck
function stain(cx, cy, rx, ry, a, col = 0x1c1e24) {
  ellipse(cx, cy, rx, ry, (x, y, t) => {
    const q = (1 - t) * 1.6 + (hash(x, y, 91) - 0.5) * 0.5;
    if (q > 0.2) blend(x, y, col, Math.min(1, q) * a);
  });
}
// dagvattengaller: järnram och spalter, lite rost
function grate(x0, y0, w, h, vertical = true) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const lx = x - x0, ly = y - y0, edge = lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1;
    let c;
    if (edge) c = ly === 0 ? 0x8a8984 : lx === 0 ? 0x6e6d68 : 0x3a3935;
    else c = (vertical ? lx % 2 === 0 : ly % 2 === 0) ? 0x121316 : (ly === 1 || lx === 1 ? 0x6e6d6a : 0x55544f);
    if (hash(x, y, 77) > 0.84) c = mix(c, 0x8a5230, 0.4);
    put(x, y, c);
  }
}
// brunnslock (runt, sett snett ovanifrån = ellips)
function manhole(cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, t = Math.hypot(dx, dy);
    if (t > 1.2) continue;
    let c;
    if (t > 1) c = 0x34332f;                                                            // spalten
    else if (t > 0.76) c = dy < -0.25 ? 0xa8a49c : dy > 0.3 ? 0x5a5852 : 0x7e7a72;      // ramen
    else if (t > 0.42 && t < 0.56) c = 0x4c4a45;                                          // inre ring
    else {
      c = (x & 1) === 0 && (y & 1) === 0 ? 0x8c887f : 0x66625b;                            // halkskydd
      if (dx + dy < -0.5) c = mix(c, 0xffffff, 0.14);
      if (vnoise(x, y, 3, 88) > 0.66) c = mix(c, 0x8a5a36, 0.4);                           // rost
    }
    put(x, y, c);
  }
}

// fyrkantigt gjutjärnslock i trottoaren (ljus ram, rutmönster, skugga nere/höger)
function lid(x0, y0, w, h) {
  for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
    const lx = x - x0, ly = y - y0;
    let c;
    if (lx < 0 || ly < 0) c = mul(get(x, y), 0.8);                                            // fog runt ramen
    else if (lx === w || ly === h) c = 0x4e4b46;                                               // skugga
    else if (ly === 0) c = 0xc2beb4;
    else if (lx === 0) c = 0xa6a298;
    else if (lx === w - 1 || ly === h - 1) c = 0x6e6a63;
    else c = (lx + ly) & 1 ? 0x7c786f : 0x908b82;
    if (lx > 0 && ly > 0 && lx < w - 1 && ly < h - 1 && vnoise(x, y, 3, 89) > 0.7) c = mix(c, 0x8a5a36, 0.35);
    put(x, y, c);
  }
}
// liten rund ventilkåpa (vatten) med ljus kant
function valve(cx, cy) {
  put(cx, cy - 1, 0x9c988e); put(cx + 1, cy - 1, 0xb2aea4);
  put(cx - 1, cy, 0x7a766e); put(cx, cy, 0x4a5a78); put(cx + 1, cy, 0x3e4c66); put(cx + 2, cy, 0x6a665e);
  put(cx, cy + 1, 0x55524c); put(cx + 1, cy + 1, 0x55524c);
}

// ---------- pölar (delas med groundLive för regnringarna) ----------
const PUDDLES = [
  // bakgatan
  [95, 30, 7, 2.2], [455, 15, 9, 2.4], [838, 31, 6, 2], [1190, 17, 8, 2.4], [1586, 29, 10, 2.6],
  // gränderna
  [151, 170, 6, 2], [522, 144, 7, 2.4], [675, 162, 6, 2], [1066, 150, 7, 2.2], [1438, 166, 6, 2],
  // tvärgatorna
  [292, 122, 7, 2.4], [944, 92, 6, 2], [1234, 150, 8, 2.4],
  // rännstenarna
  [382, 273, 12, 1.8], [1046, 273, 10, 1.8], [822, 219, 9, 1.6], [1392, 219, 11, 1.6],
  // trottoaren och promenaden
  [1592, 292, 6, 2], [470, 340, 8, 2.4], [1386, 341, 6, 2], [1640, 339, 5, 2],
].map(([x, y, rx, ry], i) => ({ x, y, rx, ry, i }));

function paintPuddles(night) {
  for (const p of PUDDLES) {
    const x0 = Math.floor(p.x - p.rx * 1.4), x1 = Math.ceil(p.x + p.rx * 1.4);
    const y0 = Math.floor(p.y - p.ry * 1.4), y1 = Math.ceil(p.y + p.ry * 1.4);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = Math.hypot((x + 0.5 - p.x) / p.rx, (y + 0.5 - p.y) / p.ry) + (vnoise(x, y, 3, 700 + p.i) - 0.5) * 0.4;
      if (t < 1) {
        // spegling: himmel överst, mörkare nedåt, lite av botten syns igenom
        const f = (y + 0.5 - (p.y - p.ry)) / (p.ry * 2);
        const sky = night ? mix(0x2c3654, 0x161c30, f) : mix(0xb4c8da, 0x5c6c80, f);
        let c = mix(get(x, y), sky, 0.72);
        if (t > 0.78) c = mul(c, 0.86);
        if (!night && y < p.y && hash(x, y, 701) > 0.82) c = mix(c, 0xeef4fa, 0.5);
        put(x, y, c);
      } else if (t < 1.4 && bayer(x, y) < (1.4 - t) / 0.4) shade(x, y, 0.8);    // våt kant
    }
  }
}

// =====================================================================
// BAKGATAN (y 0–40) + bakgårdarna bakom husen
// =====================================================================
const COB = [0xa0988a, 0x938d84, 0xa99e8c, 0x978e8f, 0xafa696, 0x8c867c, 0xa39988, 0x9e9480, 0xa8948a];
// kullersten: oregelbundna, rundade stenar (voronoiceller på ett skakat rutnät)
const CBX = 6.2, CBY = 4.4, CB = { d1: 0, d2: 0, id: 0, px: 0, py: 0 };
function cobbleAt(x, y) {
  const gx = Math.floor(x / CBX), gy = Math.floor(y / CBY);
  CB.d1 = CB.d2 = 1e9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const fx = (cx + 0.18 + hash(cx, cy, 720) * 0.64) * CBX, fy = (cy + 0.18 + hash(cx, cy, 721) * 0.64) * CBY;
    const d = Math.hypot((x + 0.5 - fx) / CBX, (y + 0.5 - fy) / CBY);
    if (d < CB.d1) { CB.d2 = CB.d1; CB.d1 = d; CB.id = cx * 7919 + cy; CB.px = fx; CB.py = fy; } else if (d < CB.d2) CB.d2 = d;
  }
  return CB;
}
function cobble(x, y) {
  const v = cobbleAt(x, y), edge = v.d2 - v.d1;
  if (edge < 0.1) {                                                                            // fog: sand, jord och mossa
    if (fbm(x, y, 16, 14) > 0.6 && hash(x, y, 15) > 0.3) return hash(x, y, 16) > 0.5 ? 0x6a7a42 : 0x56663a;
    return mul(0x5e574d, 0.9 + hash(x, y, 17) * 0.2);
  }
  let c = mul(COB[(hash(v.id, 1, 12) * COB.length) | 0], 0.9 + hash(v.id, 2, 13) * 0.18);
  const lx = (x + 0.5 - v.px) / CBX, ly = (y + 0.5 - v.py) / CBY, lit = -(lx * 0.8 + ly * 1.3);
  if (lit > 0.22 && edge > 0.2) c = mix(c, 0xffffff, 0.24);                                  // blank ovansida
  else if (lit < -0.28) c = mul(c, 0.76);                                                      // skuggsida
  else if (edge < 0.2) c = mul(c, 0.88);                                                       // rundad kant
  return grainy(c, x, y, 0.05);
}
function paintBack() {
  for (let y = 8; y < TOP; y++) for (let x = 0; x < W; x++) put(x, y, cobble(x, y));
  // mittränna av släta hällar
  for (let x = 0; x < W; x++) {
    shade(x, 21, 0.78);
    for (let y = 22; y < 25; y++) {
      const j = (x + 3) % 11 === 0;
      put(x, y, j ? 0x57514a : granite(x, y, y === 22 ? 0xa7a197 : y === 23 ? 0x948e85 : 0x847e76));
    }
    if (vnoise(x, 0, 30, 18) > 0.55) blend(x, 23, 0x4a5664, 0.45);                   // vattenstrimma
  }
  for (let x = 128; x < W; x += 262) grate(x, 22, 7, 3);
  // bakgårdarna bakom husen: packad jord och grus med tuvor, i husens skugga
  for (const b of BUILDINGS) for (let y = TOP; y < BASE; y++) for (let x = b.x; x < b.x + b.w; x++) {
    let c = grainy(mix(0x7c705f, 0x8e826c, vnoise(x, y, 7, 30)), x, y, 0.08);
    const h = hash(x, y, 31);
    if (h > 0.93) c = mix(0xb0a48e, 0x9a9488, hash(x, y, 32));
    else if (hash(x, y - 1, 31) > 0.93) c = mul(c, 0.78);
    else if (h < 0.04) c = mul(c, 0.8);
    if (vnoise(x, y, 11, 33) > 0.6 && hash(x, y, 34) > 0.45) c = hash(x, y, 35) > 0.5 ? 0x5e7a3c : 0x4a6632;
    if (y === TOP) c = 0x3e3932;                                                              // husväggens fot
    put(x, y, mul(c, y === TOP + 1 ? 0.6 : 0.72));
    SH[y * W + x] = 1;
  }
  // skräp och löv mellan stenarna
  for (let i = 0; i < 90; i++) {
    const x = (hash(i, 1, 19) * W) | 0, y = 10 + ((hash(i, 2, 19) * 28) | 0), k = hash(i, 3, 19);
    if (k < 0.5) { put(x, y, 0x9a6a2a); put(x + 1, y, 0x7a5220); }                        // brunt löv
    else if (k < 0.7) put(x, y, 0xd8d2c4);                                                  // papperslapp
    else if (k < 0.8) { put(x, y, 0x3a6a8a); put(x + 1, y, 0x2a4a6a); }                     // kapsyl/burk
    else put(x, y, 0x2a2622);                                                                // fläck
  }
  paintBoundary();
}

// y 0–8: häck, plank, mur och staket mot kvarteret bakom
function paintBoundary() {
  const KINDS = ['hack', 'plank', 'mur', 'staket'];
  const PAINT = { hack: hedge, plank, mur: brickWall, staket: railing };
  let x = 0, i = 0, prev = '';
  while (x < W) {
    const len = 110 + ((hash(i, 1, 51) * 150) | 0);
    let kind = KINDS[(hash(i, 2, 51) * KINDS.length) | 0];
    if (kind === prev) kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
    const x1 = Math.min(W, x + len);
    PAINT[kind](x, x1, i);
    if (x > 0) post(x - 1);
    prev = kind; x = x1; i++;
  }
}
function post(x0) {
  for (let y = 0; y < 9; y++) for (let x = x0; x < x0 + 3; x++) {
    let c = y === 0 ? 0xd0cbc0 : y === 1 ? 0xb8b2a6 : x === x0 ? 0xaaa498 : x === x0 + 2 ? 0x77726a : 0x958f85;
    if (y === 8) c = 0x5a554e;
    put(x, y, granite(x, y, c));
  }
  for (let x = x0 - 1; x < x0 + 5; x++) shade(x, 9, 0.75);
}
function hedge(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    const bot = 7 + Math.round(vnoise(x, 0, 5, 60 + s) * 2);                              // 7–9
    for (let y = 0; y < bot; y++) {
      const emb = vnoise(x, y, 2.5, 63) - vnoise(x + 1, y + 1, 2.5, 63);                    // löv-klumpar
      const n = fbm(x, y, 6, 61) * 0.6 + emb * 1.4 + (hash(x, y, 62) - 0.5) * 0.25 - y * 0.03 + 0.2;
      let c = n > 0.66 ? 0x80bc52 : n > 0.52 ? 0x5e9a40 : n > 0.38 ? 0x467f35 : n > 0.26 ? 0x356a2c : 0x274f24;
      if (y >= bot - 1) c = mul(c, 0.7);
      put(x, y, c);
    }
    if (hash(x, 3, 64) > 0.985) put(x, 2 + ((hash(x, 4, 64) * 4) | 0), 0xf4eef0);           // hagtornsblomma
    for (let y = bot; y < bot + 3; y++) if (bayer(x, y) < (bot + 3 - y) / 3.2) shade(x, y, 0.72);
  }
}
function plank(x0, x1, s) {
  const g0 = x0 + (((x1 - x0) >> 1) & ~3) - 8, g1 = g0 + 16;                               // grind mitt på
  for (let x = x0; x < x1; x++) {
    const bx = (x - x0) % 4, board = ((x - x0) / 4) | 0, f = hash(board, s, 71);
    const gate = x >= g0 && x < g1;
    let base = f > 0.88 ? 0x8a8278 : mix(0x93311f, 0xb05a48, f * 0.55);                     // falurött, en och annan grå bräda
    if (gate) base = mix(0x7a2a1c, 0x93311f, f);
    put(x, 0, bx === 1 ? mix(base, 0xffffff, 0.2) : 0x2c4a28);                              // spetsade bräder, grönska bakom
    for (let y = 1; y < 8; y++) {
      let c = base;
      if (bx === 3) c = 0x2a1810;
      else {
        if (bx === 0) c = mix(c, 0xffffff, 0.14);
        if (bx === 2) c = mul(c, 0.84);
        c = mul(c, 0.9 + hash(x, y >> 1, 73) * 0.16);                                       // ådring
        if (y === 7) c = mul(c, 0.72);
        if (y === 1) c = mix(c, 0xffffff, 0.16);
        if (hash(x, y, 74) > 0.97) c = mul(c, 0.6);                                          // kvist
      }
      put(x, y, c);
    }
    shade(x, 8, 0.7); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
  // grinden: ram, snedsträva och handtag
  for (let x = g0; x < g1; x++) { put(x, 1, 0x5a1c12); put(x, 7, 0x4a160e); }
  for (let y = 1; y < 8; y++) { put(g0, y, 0x3a120a); put(g1 - 1, y, 0x3a120a); }
  for (let i = 0; i < 12; i++) put(g0 + 2 + i, 6 - Math.floor(i / 2.4), 0x6a2416);
  put(g1 - 4, 4, 0xd8c070); put(g1 - 4, 5, 0x8a7030);
}
function brickWall(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    for (let y = 0; y < 8; y++) {
      let c;
      if (y === 0) c = granite(x, y, 0xcbc5b9);
      else if (y === 1) c = granite(x, y, 0xa29c90);
      else if (y === 2) c = 0x54403a;
      else {
        const row = ((y - 3) / 3) | 0, ly = (y - 3) % 3, off = (row & 1) * 3;
        if (ly === 2 || (x + off) % 6 === 0) c = mix(0xb8ac98, 0x8a8070, hash(x, y, 81) * 0.5);  // murbruk
        else {
          const br = hash(((x + off) / 6) | 0, row, 82 + s);
          c = br > 0.9 ? 0x6a3024 : mix(0x9e4a34, 0xb4604a, br);
          if (ly === 0) c = mix(c, 0xffffff, 0.1);
          c = grainy(c, x, y, 0.07);
        }
      }
      put(x, y, c);
    }
    // murgröna som klättrar
    if (vnoise(x, 0, 9, 83 + s) > 0.62) for (let y = 7; y > 2 + hash(x, 1, 84) * 4; y--) if (hash(x, y, 85) > 0.35) put(x, y, hash(x, y, 86) > 0.5 ? 0x3e7a34 : 0x2e5e2a);
    shade(x, 8, 0.72); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
}
function railing(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    // trädgården bakom staketet
    for (let y = 0; y < 6; y++) {
      const n = fbm(x, y, 5, 90 + s) + (hash(x, y, 91) - 0.5) * 0.3;
      let c = n > 0.62 ? 0x6aa648 : n > 0.45 ? 0x4c8a3a : 0x356a2e;
      if (hash(x, y, 92) > 0.965) c = [0xe85a6a, 0xf4d23c, 0xf0f0f4, 0xb07ad8][(hash(x, y, 93) * 4) | 0]; // rabatt
      put(x, y, c);
    }
    // stenfot
    put(x, 6, granite(x, 6, 0xcdc7bb)); put(x, 7, granite(x, 7, 0x9c968c));
    // smidesspjälor och överliggare
    const lx = (x - x0) % 3;
    if (lx === 1) { put(x, 0, 0x4a4c54); for (let y = 1; y < 6; y++) put(x, y, y === 1 ? 0x3a3c44 : 0x1e2026); }
    put(x, 1, lx === 1 ? 0x3a3c44 : 0x24262c); put(x, 4, 0x24262c);
    shade(x, 8, 0.72); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
}

// husens skuggor snett bakåt över bakgatan
function backShadows() {
  for (const b of BUILDINGS) {
    const L = 9 + ((b.h * 0.05) | 0);
    const gap = STREETS.find((s) => s.x0 === b.x + b.w);
    const cap = gap ? Math.min((gap.x1 - gap.x0) * 0.7, 31) : 12;
    for (let y = Math.max(8, TOP - L - 2); y < TOP; y++) {
      const up = TOP - y, xs = b.x + up * SUN_DX, xe = b.x + b.w + cap;
      for (let x = Math.floor(xs) - 2; x < xe + 2; x++) {
        let q = Math.min(x + 0.5 - xs, xe - x - 0.5) / 2.5 + 0.5;
        q = Math.min(q, (L - up) / 3 + 0.5);
        if (q >= 1 || (q > 0 && bayer(x, y) < q)) shadow(x, y, 0.76);
      }
    }
  }
}
// skuggan från huset till vänster ner i en gränd/tvärgata (snett avskuren mot trottoaren)
function gapShadow(g) {
  const w = g.x1 - g.x0;
  if (g.x0 === 0) return;                                                                    // inget hus till vänster
  for (let y = TOP; y < BASE; y++) {
    const dmax = Math.min(w * 0.7, 2 + (BASE - y) * SUN_DX);
    for (let x = g.x0; x < g.x1; x++) {
      const q = (dmax - (x - g.x0 + 0.5)) / 2.5 + 0.5;
      if (q >= 1 || (q > 0 && bayer(x, y) < q)) shadow(x, y);
    }
  }
}

// =====================================================================
// GRÄNDERNA (28 bred) – sliten stenläggning, brunn, pölar, mossa
// =====================================================================
const FLAG = [0x877f73, 0x7b756c, 0x90887a, 0x746f68, 0x8a7f72, 0x80796e];
function paintAlley(g) {
  const { x0, x1 } = g, w = x1 - x0, seed = 200 + x0, edge = g.kind === 'edge';
  const at = rows(x0, x1, TOP, BASE - 2, { h: [5, 7], w: [6, 11], seed });
  stones(at, x0, x1, TOP, BASE - 2, (s, x, y) => {
    const h = hash(s.r, s.k, seed + 1);
    if (h > 0.94) return mix(0x5a5046, 0x6e6252, hash(x, y, 9));                             // sten saknas – jord och grus
    return mul(FLAG[(hash(s.k, s.r, seed + 2) * FLAG.length) | 0], 0.86 + hash(s.r, s.k, seed + 3) * 0.2);
  }, {
    hi: 0.12, lo: 0.84, grain: 0.07,
    joint: (x, y) => {
      const e = Math.min(x - x0, x1 - 1 - x);
      if (e < 5 && hash(x, y, seed + 4) > 0.5) return hash(x, y, seed + 5) > 0.5 ? 0x527c36 : 0x3e6a2c; // ogräs i fogarna
      return mul(0x4e4840, 0.9 + hash(x, y, 8) * 0.2);
    },
  });
  // fuktig, mossig kant längs husväggarna
  for (let y = TOP; y < BASE - 2; y++) for (const x of [x0, x1 - 1]) {
    const m = vnoise(x, y, 6, seed + 6);
    put(x, y, m > 0.55 ? mix(0x3c4a2c, 0x5a6c3c, hash(x, y, 1)) : mul(0x4a443c, 0.85 + hash(x, y, 2) * 0.2));
    const xi = x === x0 ? x + 1 : x - 1;
    if (m > 0.6) blend(xi, y, 0x4a6034, 0.6); else shade(xi, y, 0.86);
  }
  // tröskel mot trottoaren
  for (let x = x0; x < x1; x++) { put(x, BASE - 2, granite(x, BASE - 2, 0xaaa59b)); put(x, BASE - 1, granite(x, BASE - 1, 0x86817a)); }
  // sprickor i hällarna
  for (let i = 0; i < 4; i++) crack(x0 + 3 + hash(i, 1, seed) * (w - 6), TOP + 8 + hash(i, 2, seed) * 120, 5 + hash(i, 3, seed) * 8, seed + i, { vert: true, x0: x0 + 1, x1: x1 - 1, y0: TOP, y1: BASE - 3 });
  if (!edge) {
    // dagvattenbrunn mitt i gränden, fuktig ring och rostrand
    const cx = x0 + (w >> 1), dy = TOP + 64 + ((hash(x0, 1, 210) * 44) | 0);
    ellipse(cx, dy + 2.5, 9, 5, (x, y, t) => { if (bayer(x, y) < (1 - t) * 1.3) shade(x, y, 0.84); });
    grate(cx - 4, dy, 8, 5);
    for (let x = cx - 3; x < cx + 3; x++) for (let y = dy + 5; y < dy + 8; y++) if (hash(x, y, 211) > 0.45) blend(x, y, 0x7a4a2a, 0.3 - (y - dy - 5) * 0.08);
    stain(x0 + 7 + hash(x0, 2, 212) * 12, TOP + 30 + hash(x0, 3, 212) * 40, 4, 2, 0.35);
    // lite skräp
    put(x0 + 4 + ((hash(x0, 4, 213) * 18) | 0), TOP + 90, 0xd8d2c4);
    put(x0 + 3 + ((hash(x0, 5, 213) * 20) | 0), TOP + 120, 0x9a6a2a);
  }
  gapShadow(g);
}

// =====================================================================
// TVÄRGATORNA (52 bred) – asfalt, kantsten, smala trottoarer, mittlinje
// =====================================================================
const SLAB = [0xb4ac9e, 0xaca598, 0xbab3a6, 0xa9a59d, 0xb8ae9e, 0xb0a99b];
function paintSideStreet(g) {
  const { x0, x1 } = g, w = x1 - x0, seed = 500 + x0, mid = x0 + (w >> 1);
  const yA = TOP, yB = BASE - 2;
  for (let y = yA; y < yB; y++) for (let x = x0; x < x1; x++) {
    const lx = x - x0, rx = x1 - 1 - x;
    let c;
    if (lx <= 5 || rx <= 5) {                                                                // smal trottoar längs husen
      const s = lx <= 5 ? lx : rx, row = ((y - yA) / 8) | 0, ly = (y - yA) % 8;
      if (s === 5 || ly === 7) c = mul(0x857d71, 0.92 + hash(x, y, 4) * 0.12);
      else {
        c = SLAB[(hash(row, lx <= 5 ? 1 : 2, seed) * SLAB.length) | 0];
        if (ly === 0) c = mix(c, 0xffffff, 0.1);
        if (ly === 6) c = mul(c, 0.9);
        c = grainy(c, x, y, 0.05);
        if (hash(x, y, seed + 9) > 0.93) c = mul(c, 0.86);
        if (s === 0) c = mul(c, 0.74); else if (s === 1) c = mul(c, 0.9);                      // mot husväggen
      }
    } else if (lx === 6 || rx === 6) c = granite(x, y, 0xd0cbc1);                              // kantstenens överkant
    else if (lx === 7 || rx === 7) c = granite(x, y, 0xa6a197);
    else if (lx === 8 || rx === 8) c = mul(asphalt(x, y, -0.05, false), 0.72);                 // ränna vid kantstenen
    else c = asphalt(x, y, 0, false);
    if ((lx === 6 || lx === 7 || rx === 6 || rx === 7) && (y - yA) % 16 === 15) c = 0x5c5750;   // fogar i kantstenen
    put(x, y, c);
  }
  // möte med bakgatan och nedsänkt kantsten mot trottoaren (genomgående gångbana)
  for (let x = x0 + 6; x < x1 - 6; x++) { put(x, yA, granite(x, yA, 0xb2ada3)); put(x, yA + 1, granite(x, yA + 1, 0x8a857c)); }
  for (let x = x0; x < x1; x++) { put(x, yB, granite(x, yB, 0xbdb8ae)); put(x, yB + 1, granite(x, yB + 1, 0x96918a)); }
  // lagning och sprickor
  const py = yA + 20 + ((hash(seed, 1, 1) * 60) | 0);
  for (let y = py; y < py + 12; y++) for (let x = x0 + 9; x < mid - 1; x++) put(x, y, (y === py || y === py + 11 || x === x0 + 9 || x === mid - 2) ? 0x26272c : asphalt(x, y, -0.12, false));
  for (let i = 0; i < 3; i++) crack(x0 + 12 + hash(i, 1, seed) * 28, yA + 6 + hash(i, 2, seed) * 110, 18 + hash(i, 3, seed) * 20, seed + i * 7, { vert: true, sealed: i < 2, x0: x0 + 9, x1: x1 - 9, y0: yA + 2, y1: yB - 1 });
  // mittlinje
  for (let y = yA + 4; y < yB - 14; y++) if ((y - yA) % 18 < 9) for (const x of [mid - 1, mid]) mark(x, y, 0xe8e2cc, 0.08 + vnoise(x, y, 6, seed) * 0.2);
  // hajtänder: väjningsplikt mot den genomgående gångbanan (södergående körfältet)
  for (let tx = x0 + 11; tx + 5 <= mid - 2; tx += 7) {
    for (let r = 0; r < 3; r++) for (let i = 2 - r; i <= 2 + r; i++) mark(tx + i, yB - 9 + r, 0xece6d2, 0.08);
  }
  // brunnslock, galler och oljefläckar
  manhole(mid + 8, yA + 58 + ((hash(seed, 2, 2) * 30) | 0), 5, 2.6);
  grate(x0 + 9, yA + 96, 3, 8, false);
  grate(x1 - 12, yA + 40, 3, 8, false);
  stain(mid - 9, yA + 130, 4, 2, 0.4); stain(mid + 10, yA + 30, 3, 1.6, 0.3);
  gapShadow(g);
}

// =====================================================================
// NORRA TROTTOAREN (186–218)
// =====================================================================
const SETT = [0x9e9890, 0xa9a298, 0x958f87, 0xaea496, 0x9a948d];
const slabCol = (seed) => (s, x, y) => {
  const h = hash(s.r, s.k, seed);
  let c = SLAB[(hash(s.k, s.r, seed + 1) * SLAB.length) | 0];
  if (h > 0.93) c = 0xc4c2ba;                                                                 // utbytt, nyare platta
  else if (h < 0.05) c = mul(c, 0.86);                                                         // fläckig
  c = mul(c, 0.95 + hash(s.r, s.k, seed + 2) * 0.08);
  const gg = hash(x, y, seed + 3);
  if (gg > 0.93) c = mul(c, 0.86); else if (gg < 0.04) c = mix(c, 0xffffff, 0.25);           // ballast i betongen
  return mul(c, 0.96 + vnoise(x, y, 5, seed + 4) * 0.08);
};
const settCol = (seed) => (s) => mul(SETT[(hash(s.r, s.k, seed) * SETT.length) | 0], 0.9 + hash(s.k, s.r, seed + 1) * 0.16);

// kännbar varningsyta (kupolplattor) vid övergångsställena
function tactile(xa, xb, ya, yb) {
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    const lx = (x - xa) % 7, ly = y - ya;
    let c = granite(x, y, 0xd8d4ca);
    if (lx === 6) c = 0x9a958b;
    else if ((lx === 1 || lx === 4) && (ly % 3 === 1)) c = 0xf4f0e8;                         // kupol
    else if ((lx === 1 || lx === 4) && (ly % 3 === 2)) c = 0xa9a59b;                         // kupolens skugga
    put(x, y, c);
  }
}

function paintSidewalkN() {
  const y0 = SN0;
  const at = rows(0, W, y0, y0 + 18, { h: [9, 9], w: [18, 18], seed: 300, bond: true });
  stones(at, 0, W, y0, y0 + 18, slabCol(301), { hi: 0.1, lo: 0.9, grain: 0.04, joint: (x, y) => mul(0x877f73, 0.92 + hash(x, y, 4) * 0.12) });
  const at2 = rows(0, W, y0 + 18, y0 + 25, { h: [3, 4], w: [3, 5], seed: 302 });
  stones(at2, 0, W, y0 + 18, y0 + 25, settCol(303), { round: true, hi: 0.2, lo: 0.8, grain: 0.06, joint: () => 0x6c665d });
  // kantsten mot vägen (framsidan syns – den vetter mot kameran)
  for (let x = 0; x < W; x++) {
    const cw = CROSSWALKS.some((c) => x >= c.x0 && x < c.x1);
    put(x, 211, 0x5b564f);
    if (cw) {                                                                                  // nedsänkt vid övergångsstället
      put(x, 212, granite(x, 212, 0xc6c1b7)); put(x, 213, granite(x, 213, 0xb3aea4)); put(x, 214, granite(x, 214, 0xaea99f));
      put(x, 215, granite(x, 215, 0xa9a49a)); put(x, 216, granite(x, 216, 0xa29d94)); put(x, 217, 0x77736c);
    } else {
      put(x, 212, granite(x, 212, 0xd8d3c9)); put(x, 213, granite(x, 213, 0xb6b1a7)); put(x, 214, granite(x, 214, 0xafaaa0));
      put(x, 215, granite(x, 215, 0xc6c1b7)); put(x, 216, granite(x, 216, 0x9a958c)); put(x, 217, granite(x, 217, 0x76716a));
    }
    if (x % 24 === 0) for (let y = 213; y < 218; y++) put(x, y, 0x5c5750);
  }
  for (const c of CROSSWALKS) tactile(c.x0 + 3, c.x1 - 3, 204, 211);
  paintSidewalkWear(y0 + 2, y0 + 17, 310);
  for (const mx of [118, 470, 1116, 1400, 1622]) lid(mx - 4, 197, 8, 5);
  for (const vx of [232, 640, 1040, 1508]) valve(vx, 208);
  // blankslitet framför dörrarna
  for (const b of BUILDINGS) ellipse((b.door.x0 + b.door.x1) / 2, 196, (b.door.x1 - b.door.x0) / 2 + 8, 7, (x, y, t) => { if (bayer(x, y) < (1 - t) * 0.9) blend(x, y, 0xffffff, 0.07); });
  // husens fot: mörk kontaktskugga precis under fasaden
  for (const b of BUILDINGS) for (let x = b.x; x < b.x + b.w; x++) { shade(x, BASE + 4, 0.78); if (bayer(x, BASE + 5) < 0.5) shade(x, BASE + 5, 0.9); }
}
// sprickor, tuggummi och fläckar på plattor
function paintSidewalkWear(ya, yb, seed) {
  for (let y = ya; y < yb; y++) for (let x = 0; x < W; x++) {
    const h = hash(x, y, seed);
    if (h > 0.9975) { put(x, y, 0x6e6a64); if (hash(x, y, seed + 1) > 0.5) put(x + 1, y, 0x7c7872); }   // tuggummi
    else if (h < 0.0012) blend(x, y, 0x4a3a2a, 0.3);
  }
  for (let i = 0; i < 26; i++) {
    const x = hash(i, 1, seed + 2) * W, y = ya + 2 + hash(i, 2, seed + 2) * (yb - ya - 4);
    crack(x, y, 4 + hash(i, 3, seed + 2) * 7, seed + i, { dx: hash(i, 4, seed) > 0.5 ? 1 : -1, y0: ya, y1: yb });
  }
  for (let i = 0; i < 8; i++) stain(hash(i, 5, seed) * W, ya + 3 + hash(i, 6, seed) * (yb - ya - 6), 2 + hash(i, 7, seed) * 3, 1.3, 0.12, 0x3a3026);
}

// =====================================================================
// BILVÄGEN (218–276) – högupplöst asfalt med allt som hör till
// =====================================================================
function paintRoad() {
  // rännstenar av gatsten
  const gN = rows(0, W, R0, R0 + 3, { h: [3, 3], w: [4, 6], seed: 401 });
  stones(gN, 0, W, R0, R0 + 3, (s) => mul(0x6f6b65, 0.86 + hash(s.r, s.k, 402) * 0.26), { hi: 0.14, lo: 0.8, joint: (x, y) => mul(0x3a3733, 0.9 + hash(x, y, 1) * 0.2) });
  const gS = rows(0, W, R1 - 4, R1 - 1, { h: [3, 3], w: [4, 6], seed: 403 });
  stones(gS, 0, W, R1 - 4, R1 - 1, (s) => mul(0x6f6b65, 0.86 + hash(s.r, s.k, 404) * 0.26), { hi: 0.14, lo: 0.8, joint: (x, y) => mul(0x3a3733, 0.9 + hash(x, y, 1) * 0.2) });
  for (let x = 0; x < W; x++) { put(x, R1 - 1, 0x2a2b30); put(x, R0 + 2, mul(get(x, R0 + 2), 0.8)); }
  // asfalt
  for (let y = R0 + 3; y < R1 - 4; y++) for (let x = 0; x < W; x++) put(x, y, asphalt(x, y));
  // lagningar: nyare (mörkare) eller äldre (blekare) asfalt med tätade skarvar
  const PATCH = [[118, 224, 46, 14, -0.13], [522, 250, 30, 18, 0.07], [758, 228, 62, 12, -0.1], [1012, 256, 40, 12, 0.06], [1330, 222, 26, 22, -0.14], [1560, 252, 52, 15, -0.08], [40, 250, 22, 10, 0.08], [1452, 226, 34, 11, 0.07]];
  const TRENCH = [[436, R0 + 3, 6, 26, -0.15], [1118, 247, 6, 24, -0.15], [1622, R0 + 3, 7, 50, -0.12]];
  for (const [px, py, pw, ph, tone] of [...PATCH, ...TRENCH]) {
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
      const e = x === px || y === py || x === px + pw - 1 || y === py + ph - 1;
      const c = asphalt(x, y, tone);
      put(x, y, e && hash(x, y, 405) > 0.3 ? mul(c, 0.72) : c);                                // tätad skarv, lite ojämn
      if (e && hash(x, y, 406) > 0.85) blend(x + (x === px ? -1 : x === px + pw - 1 ? 1 : 0), y + (y === py ? -1 : y === py + ph - 1 ? 1 : 0), 0x202126, 0.5);
    }
  }
  // spöklinjer: gammal, bortfräst mittlinje som fortfarande anas
  for (let x = 0; x < W; x++) if ((x + 20) % 40 < 18 && vnoise(x, 5, 60, 407) > 0.42) for (const y of [251, 252]) if (hash(x, y, 408) > 0.35) put(x, y, mix(get(x, y), 0x6a6c72, 0.35));
  // sand och grus (vintersand) som samlats längs kantstenen, löv i rännstenen
  for (let x = 0; x < W; x++) {
    for (let d = 0; d < 5; d++) for (const y of [R0 + 3 + d, R1 - 5 - d]) {
      if (hash(x, y, 409) < (0.24 - d * 0.05) * (0.4 + vnoise(x, y, 20, 411))) put(x, y, mix(mix(0xa09682, 0x7e766a, hash(x, y, 412)), get(x, y), 0.3));
    }
    if (hash(x, 0, 413) > 0.965) {
      const y = hash(x, 1, 413) > 0.5 ? R0 + 1 : R1 - 3, k = hash(x, 2, 413);
      const lc = k < 0.4 ? 0xc88a2a : k < 0.7 ? 0x9a5a22 : 0xd8b040;
      put(x, y, lc); if (k > 0.3) put(x + 1, y, mul(lc, 0.75));
    }
  }
  // sprickor: tätade (blanka svarta) och öppna hårfina
  for (let i = 0; i < 16; i++) crack(hash(i, 1, 410) * W, R0 + 6 + hash(i, 2, 410) * (R1 - R0 - 14), 8 + hash(i, 3, 410) * 22, 410 + i * 3, { sealed: i < 9, branch: i < 5, dx: hash(i, 4, 410) > 0.5 ? 1 : -1, y0: R0 + 3, y1: R1 - 4 });
  crack(330, 249, 70, 430, { sealed: true, y0: 248, y1: 251 });                            // längsspricka vid mitten
  crack(1320, 249, 54, 431, { sealed: true, y0: 248, y1: 251 });
  // krackelering nära södra kanten
  for (let i = 0; i < 12; i++) crack(1396 + hash(i, 1, 432) * 44, 262 + hash(i, 2, 432) * 8, 4 + hash(i, 3, 432) * 6, 433 + i, { dx: hash(i, 4, 432) > 0.5 ? 1 : -1, y0: 260, y1: 271 });
  // oljedropp mitt i körfälten – tätare där bilarna står och väntar vid rött
  for (let i = 0; i < 60; i++) stain(hash(i, 1, 440) * W, (i & 1 ? 263.5 : 237.5) + (hash(i, 2, 440) - 0.5) * 3, 2 + hash(i, 3, 440) * 3, 1 + hash(i, 4, 440), 0.22);
  for (const c of CROSSWALKS) for (let i = 0; i < 6; i++) {
    stain(c.x1 + 12 + hash(i, 5, c.x0) * 50, 237.5 + (hash(i, 6, c.x0) - 0.5) * 3, 2 + hash(i, 7, c.x0) * 4, 1.2 + hash(i, 8, c.x0), 0.35);
    stain(c.x0 - 12 - hash(i, 9, c.x0) * 50, 263.5 + (hash(i, 10, c.x0) - 0.5) * 3, 2 + hash(i, 11, c.x0) * 4, 1.2 + hash(i, 12, c.x0), 0.35);
  }
  // bromsspår före Torggatan
  const tc = CROSSWALKS[1] || CROSSWALKS[0];
  if (tc) for (let x = tc.x0 - 44; x < tc.x0 - 8; x++) for (const y of [261, 268]) { const f = (x - (tc.x0 - 44)) / 36; if (hash(x, y, 450) < 0.35 + f * 0.6) blend(x, y, 0x17181c, 0.55); }
  // mittlinje (slitna streck) och streckade kantlinjer – uppehåll vid övergångsställena
  const nearCW = (x, pad) => CROSSWALKS.some((c) => x >= c.x0 - pad && x < c.x1 + pad);
  const busX0 = BUS_STOP.x - 60, busX1 = BUS_STOP.x + 60;
  for (let x = 0; x < W; x++) {
    if (!nearCW(x, 14) && (x + 6) % 34 < 16) {
      mark(x, 246, 0xefe9d4, wearAt(x, 246, 0.03));
      mark(x, 247, 0xd6d0bc, wearAt(x, 247, 0.03));
      if (hash(x, 248, 36) > 0.4) shade(x, 248, 0.88);                                    // färgens kant
    }
    if (!nearCW(x, 8)) {
      mark(x, R0 + 4, 0xcfc9b6, 0.12 + vnoise(x, 0, 9, 37) * 0.3);                        // tunna, slitna kantlinjer
      if (x < busX0 || x >= busX1) mark(x, R1 - 6, 0xcfc9b6, 0.12 + vnoise(x, 1, 9, 37) * 0.3);
    }
  }
  // övergångsställen: sju breda zebraränder, smutsiga och nötta i hjulspåren, + stopplinjer
  for (const c of CROSSWALKS) {
    for (let k = 0; k < 7; k++) {
      const by = 223 + k * 7;
      for (let y = by; y < by + 4; y++) for (let x = c.x0 + 3; x < c.x1 - 3; x++) {
        const tr = trackAt(y), n = vnoise(x, y, 5, 34 + c.x0);
        if (hash(x, y, 35) < tr * 0.22 + (n > 0.78 ? 0.35 : 0.01)) continue;                // bortnött – asfalten syns
        let col = y === by ? 0xfaf7ee : y === by + 3 ? 0xd4cebe : 0xefebde;
        col = mix(col, 0x8e8c86, tr * 0.28 + n * 0.1);                                        // däckgrå smuts
        if (x === c.x0 + 3 || x === c.x1 - 4) col = mix(col, get(x, y), 0.35);
        put(x, y, mul(col, 0.95 + hash(x, y, 36) * 0.06));
      }
      for (let x = c.x0 + 3; x < c.x1 - 3; x++) if (hash(x, by + 4, 37) > 0.15) shade(x, by + 4, 0.84); // färgens tjocklek
    }
    // övre körfältet kör västerut: stopplinje öster om övergångsstället
    for (let y = R0 + 4; y < 246; y++) for (let x = c.x1 + 4; x < c.x1 + 7; x++) mark(x, y, 0xf0ecde, wearAt(x, y, 0.05));
    // undre körfältet kör österut: stopplinje väster om övergångsstället
    for (let y = 248; y < R1 - 5; y++) for (let x = c.x0 - 6; x < c.x0 - 3; x++) mark(x, y, 0xf0ecde, wearAt(x, y, 0.05));
  }
  // busshållplats: gul sicksack längs kanten och BUSS i körfältet
  for (let x = busX0; x < busX1; x++) {
    const ph = (x - busX0) % 8, yy = R1 - 8 + Math.round((ph < 4 ? ph : 8 - ph) * 0.75);
    mark(x, yy, 0xe8c040, 0.1);
  }
  eachTextPixel(BIG, 'BUSS', BUS_STOP.x - 11, 254, 1, (px, py) => mark(px, py, 0xe8e0c8, wearAt(px, py, 0.08)));
  // brunnslock med lagad asfaltruta runt
  for (const [mx, my] of [[180, 233], [705, 259], [1125, 234], [1480, 260]]) {
    for (let y = my - 5; y < my + 5; y++) for (let x = mx - 9; x < mx + 9; x++) {
      const e = x === mx - 9 || y === my - 5 || x === mx + 8 || y === my + 4;
      put(x, y, e ? 0x25262b : asphalt(x, y, -0.12));
    }
    manhole(mx, my, 6, 3.2);
  }
  // dagvattengaller i rännstenarna
  for (let i = 0, x = 52; x < W - 10; i++, x += 118) {
    if (nearCW(x, 12) || nearCW(x + 8, 12)) continue;
    if (i & 1) { grate(x, R0, 9, 3); ellipse(x + 4.5, R0 + 4, 7, 2, (px, py, t) => { if (bayer(px, py) < (1 - t)) shade(px, py, 0.85); }); }
    else if (x < busX0 - 10 || x > busX1) grate(x + 30, R1 - 4, 9, 3);
  }
}

// =====================================================================
// SÖDRA TROTTOAREN (276–306)
// =====================================================================
function paintSidewalkS() {
  const busX0 = BUS_STOP.x - 44, busX1 = BUS_STOP.x + 44;
  // kantsten (bara ovansidan syns härifrån)
  for (let x = 0; x < W; x++) {
    const cw = CROSSWALKS.some((c) => x >= c.x0 && x < c.x1), bus = x >= busX0 && x < busX1;
    put(x, SS0, granite(x, SS0, cw ? 0xc8c3b9 : bus ? 0xe2ddd3 : 0xdad5cb));
    put(x, SS0 + 1, granite(x, SS0 + 1, cw ? 0xaca79d : bus ? 0xc6c1b7 : 0xb6b1a7));
    put(x, SS0 + 2, granite(x, SS0 + 2, cw ? 0xa6a197 : 0xa9a49a));
    put(x, SS0 + 3, 0x5c5750);
    if (x % 24 === 12) for (let y = SS0; y < SS0 + 3; y++) put(x, y, 0x5c5750);
  }
  const at = rows(0, W, SS0 + 4, SS0 + 10, { h: [3, 3], w: [3, 5], seed: 320 });
  stones(at, 0, W, SS0 + 4, SS0 + 10, settCol(321), { round: true, hi: 0.2, lo: 0.8, grain: 0.06, joint: () => 0x6c665d });
  const at2 = rows(0, W, SS0 + 10, SS0 + 28, { h: [9, 9], w: [18, 18], seed: 322, bond: true, shift: 5 });
  stones(at2, 0, W, SS0 + 10, SS0 + 28, slabCol(323), { hi: 0.1, lo: 0.9, grain: 0.04, joint: (x, y) => mul(0x877f73, 0.92 + hash(x, y, 4) * 0.12) });
  // låg kantsten mot parken
  const onPath = (x) => PARK_LAYOUT.paths.some((p) => x >= p[0] && x < p[2]);
  for (let x = 0; x < W; x++) {
    const p = onPath(x);
    put(x, SS1 - 2, granite(x, SS1 - 2, p ? 0xbcb7ad : 0xcfcac0));
    put(x, SS1 - 1, granite(x, SS1 - 1, p ? 0xb2ada3 : 0x928d85));
  }
  for (const c of CROSSWALKS) tactile(c.x0 + 3, c.x1 - 3, SS0 + 4, SS0 + 10);
  // hållplatsytan: ljusa plattor och vit ledlinje
  for (let y = SS0 + 4; y < SS0 + 10; y++) for (let x = busX0; x < busX1; x++) {
    let c = granite(x, y, 0xc6c0b4);
    if ((x - busX0) % 12 === 11 || y === SS0 + 9) c = 0x8e887e;
    if (y === SS0 + 5 || y === SS0 + 6) c = (x % 3 === 2) ? 0xb4b0a6 : 0xf0ece4;
    put(x, y, c);
  }
  paintSidewalkWear(SS0 + 11, SS0 + 27, 330);
  for (const mx of [206, 842, 1330, 1566]) lid(mx - 4, SS0 + 17, 8, 5);
  for (const vx of [118, 1000, 1470]) valve(vx, SS0 + 7);
  paintHopscotch(1122, SS0 + 12);
}
// kritritad hage på trottoaren
const DIGITS = { 1: ['.#', '##', '.#', '.#', '.#'], 2: ['##', '.#', '##', '#.', '##'], 3: ['##', '.#', '##', '.#', '##'], 4: ['#.', '#.', '##', '.#', '.#'], 5: ['##', '#.', '##', '.#', '##'], 6: ['#.', '#.', '##', '##', '##'], 7: ['##', '.#', '.#', '.#', '.#'], 8: ['##', '##', '..', '##', '##'] };
function paintHopscotch(x0, y0) {
  const CH = [0xf4eaf0, 0xf0c8d8, 0xc8e0f4];
  const cells = [[0, 0, 9, 14, 1], [9, 0, 9, 14, 2], [18, 0, 9, 7, 3], [18, 7, 9, 7, 4], [27, 0, 9, 14, 5], [36, 0, 9, 7, 6], [36, 7, 9, 7, 7], [45, 0, 10, 14, 8]];
  const chalk = (x, y, c) => { if (hash(x, y, 461) > 0.18) blend(x, y, c, 0.55 + hash(x, y, 462) * 0.3); };
  cells.forEach(([cx, cy, cw, chh, n], i) => {
    const c = CH[i % 3];
    for (let x = x0 + cx; x <= x0 + cx + cw; x++) { chalk(x, y0 + cy, c); chalk(x, y0 + cy + chh, c); }
    for (let y = y0 + cy; y <= y0 + cy + chh; y++) { chalk(x0 + cx, y, c); chalk(x0 + cx + cw, y, c); }
    const tx = x0 + cx + (cw >> 1) - 1, ty = y0 + cy + ((chh - 5) >> 1) + 1;
    DIGITS[n].forEach((row, j) => { for (let k = 0; k < row.length; k++) if (row[k] === '#') chalk(tx + k, ty + j, 0xffffff); });
  });
  // en liten kritsol bredvid
  const sx = x0 + 64, sy = y0 + 7;
  ellipse(sx, sy, 3, 3, (x, y, t) => { if (t > 0.6) chalk(x, y, 0xf8e070); });
  for (const [dx, dy] of [[0, -5], [0, 5], [-5, 0], [5, 0], [-4, -4], [4, 4], [-4, 4], [4, -4]]) chalk(sx + dx, sy + dy, 0xf8e070);
}

// =====================================================================
// PARKEN (306–420) – gräs, grusgångar, stenlagt runt torg
// =====================================================================
const GR = [0x2d5a28, 0x3a7131, 0x49863a, 0x5a9a42, 0x6daf4b, 0x88c458];
const PRX = PARK_LAYOUT.plaza.r * 1.2, PRY = PARK_LAYOUT.plaza.r * 0.96;
function parkMask() {
  const M = new Uint8Array(W * (H - PK0));
  const { cx, cy } = PARK_LAYOUT.plaza, [px0, py0, px1, py1] = PARK_LAYOUT.promenade;
  for (let y = PK0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 0;
    for (const r of PATH_RECTS) if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) { m = 1; break; }
    // rundade ändar på promenaden
    if (m && y >= py0 && y < py1 && (x < px0 + 2 || x >= px1 - 2)) {
      const ex = x < px0 + 2 ? x - px0 : px1 - 1 - x, ey = Math.min(y - py0, py1 - 1 - y);
      if (ex + ey < 2) m = 0;
    }
    if (Math.hypot((x + 0.5 - cx) / PRX, (y + 0.5 - cy) / PRY) < 1) m = 2;
    M[(y - PK0) * W + x] = m;
  }
  return M;
}
function paintPark() {
  const M = parkMask();
  const mk = (x, y) => (x < 0 || x >= W || y < PK0 || y >= H ? 0 : M[(y - PK0) * W + x]);
  // gräs: fläckigt i flera skalor, små tuvor med ljus ovansida
  for (let y = PK0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mk(x, y)) continue;
    const emb = vnoise(x, y, 3.4, 105) - vnoise(x + 0.7, y + 1.6, 3.4, 105);                   // tuvor, ljusa ovanpå
    const n = fbm(x, y, 30, 101) * 0.6 + vnoise(x, y, 9, 102) * 0.24 + emb * 0.85 + (hash(x, y, 103) - 0.5) * 0.12 + 0.08;
    const i = n < 0.3 ? 0 : n < 0.41 ? 1 : n < 0.53 ? 2 : n < 0.65 ? 3 : n < 0.77 ? 4 : 5;
    put(x, y, mul(GR[i], 0.97 + hash(x, y, 104) * 0.05));
  }
  // grässtrån (lodräta små streck med ljus topp)
  for (let y = PK0 + 3; y < H; y++) for (let x = 1; x < W - 1; x++) {
    if (mk(x, y) || mk(x, y - 1) || mk(x, y - 2) || hash(x, y, 110) < 0.9) continue;
    const lean = hash(x, y, 111) < 0.3 ? -1 : hash(x, y, 111) > 0.7 ? 1 : 0;
    put(x, y, GR[1]); put(x, y - 1, GR[3]);
    if (hash(x, y, 112) > 0.4 && !mk(x + lean, y - 2)) put(x + lean, y - 2, GR[hash(x, y, 113) > 0.6 ? 5 : 4]);
  }
  // klöver i fläckar
  for (let y = PK0 + 2; y < H - 2; y++) for (let x = 1; x < W - 2; x++) {
    if (mk(x, y) || mk(x + 1, y) || mk(x, y + 1) || vnoise(x, y, 14, 120) < 0.68 || hash(x, y, 121) < 0.93) continue;
    put(x, y, 0x5aa662); put(x + 1, y, 0x4c9658); put(x, y + 1, 0x3e8048); put(x + 1, y + 1, 0x2e6a3a);
    if (hash(x, y, 122) > 0.9) put(x, y - 1, 0xecdcec);                                       // klöverblomma
  }
  // blommor: ängsfläckar med prästkragar, maskrosor, violer, rödklöver, smörblommor
  for (let y = PK0 + 3; y < H - 1; y++) for (let x = 1; x < W - 3; x++) {
    if (mk(x, y) || mk(x + 2, y) || mk(x, y + 1)) continue;
    const mv = vnoise(x, y, 34, 130), h = hash(x, y, 131);
    if (!(mv > 0.6 ? h > 0.99 - (mv - 0.6) * 0.04 : h > 0.9993)) continue;
    const k = hash(x, y, 132);
    if (k < 0.42) {                                                                           // prästkrage
      put(x, y + 1, 0x3e7a34);
      if (k < 0.2) { put(x - 1, y, 0xf6f4ec); put(x, y, 0xf2c830); put(x + 1, y, 0xf6f4ec); put(x, y - 1, 0xf6f4ec); }
      else put(x, y, 0xf6f4ec);
    } else if (k < 0.64) { put(x, y, 0xf6d23a); put(x, y + 1, 0xc49a22); }                     // maskros
    else if (k < 0.78) { put(x, y, 0x9a7ae0); put(x, y + 1, 0x6a50b0); }                       // viol
    else if (k < 0.9) { put(x, y, 0xe07aa2); put(x + 1, y, 0xc85a88); }                        // rödklöver
    else put(x, y, 0xfbe45a);                                                                 // smörblomma
  }
  // trampstigar där folk genar över gräset
  for (const [ax, ay, bx, by, wd] of [[598, PK0, 640, 334, 5], [1224, 318, 1196, 334, 4], [300, 318, 326, 334, 3.5]]) {
    const L = Math.hypot(bx - ax, by - ay);
    for (let y = Math.min(ay, by) - 6; y < Math.max(ay, by) + 6; y++) for (let x = Math.min(ax, bx) - 8; x < Math.max(ax, bx) + 8; x++) {
      if (mk(x, y) || y < PK0) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)));
      const d = Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) + (vnoise(x, y, 4, 140) - 0.5) * 2;
      const q = 1 - d / wd;
      if (q <= 0) continue;
      if (bayer(x, y) < q * 1.4) put(x, y, mix(0x9a8458, 0x7e6a44, hash(x, y, 141)));
      else put(x, y, mix(get(x, y), 0xa8a860, 0.35));
    }
  }
  // mullvadshögar
  for (const [mx, my] of [[152, 396], [712, 404], [1566, 402], [1106, 388]]) {
    ellipse(mx, my, 3.5, 2, (x, y, t) => put(x, y, y < my - 0.5 ? (t < 0.5 ? 0x8a6c4c : 0x72563a) : 0x5a4230));
    for (let x = mx - 4; x < mx + 4; x++) shade(x, my + 2, 0.8);
  }
  // grus
  const [, py0, , py1] = PARK_LAYOUT.promenade;
  for (let y = PK0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mk(x, y) !== 1) continue;
    const edge = !mk(x - 1, y) || !mk(x + 1, y) || !mk(x, y - 1) || !mk(x, y + 1) || !mk(x - 2, y) || !mk(x + 2, y);
    const center = y >= py0 + 4 && y < py1 - 4;
    let c = mix(0xc6b28c, 0xd6c6a2, vnoise(x, y, 9, 401) * (center ? 1.2 : 0.8));
    c = mul(c, 0.94 + hash(x, y, 402) * 0.1);
    const h = hash(x, y, 403), thr = center ? 0.95 : edge ? 0.86 : 0.92;
    if (h > thr) c = [0xe8dcc0, 0xd8c8a4, 0xb8906c, 0xa6a098][(hash(x, y, 404) * 4) | 0];     // småsten
    else if (hash(x, y - 1, 403) > thr) c = mul(c, 0.78);                                       // stenens skugga
    else if (h < 0.05) c = mul(c, 0.82);
    if (edge) c = mul(c, 0.9);
    put(x, y, c);
  }
  // cykelspår i promenaden
  for (let x = 60; x < W - 60; x++) {
    if (x > 860 && x < 1010) continue;
    const y = Math.round(339.5 + Math.sin(x * 0.045) * 1.4 + Math.sin(x * 0.013) * 1.1);
    if (mk(x, y) === 1 && hash(x, 0, 406) > 0.15) put(x, y, mul(get(x, y), 0.86));
  }
  // kantsten mellan gräs och grus
  for (let y = PK0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mk(x, y)) continue;
    const dn = mk(x, y + 1) === 1, up = mk(x, y - 1) === 1, lr = mk(x - 1, y) === 1 || mk(x + 1, y) === 1;
    if (dn) put(x, y, granite(x, y, 0xd6d1c7));
    else if (up) { put(x, y, granite(x, y, 0xa29d94)); if (y + 1 < H && !mk(x, y + 1)) shade(x, y + 1, 0.82); }
    else if (lr) put(x, y, granite(x, y, 0xbab5ab));
  }
  paintPlaza(mk);
  // kantstenens skugga där parken möter trottoaren
  for (let x = 0; x < W; x++) { if (!mk(x, PK0)) shade(x, PK0, 0.74); if (!mk(x, PK0 + 1) && bayer(x, PK0 + 1) < 0.5) shade(x, PK0 + 1, 0.88); }
}

// torget: ringar av smågatsten i solfjäder, åttauddig stjärna i rödgranit, mörk kant
function paintPlaza(mk) {
  const { cx, cy } = PARK_LAYOUT.plaza, NR = 14, TAU = Math.PI * 2;
  const idAt = (x, y) => {
    const dx = (x + 0.5 - cx) / PRX, dy = (y + 0.5 - cy) / PRY, t = Math.hypot(dx, dy);
    if (t >= 1) return -1;
    const ring = Math.floor(t * NR);
    if (ring >= NR - 1) return 90000 + Math.floor((Math.atan2(dy, dx) / TAU + 0.5) * 40);    // kantstenen
    const count = Math.max(6, Math.round(ring * 6.4));
    const k = Math.floor(((Math.atan2(dy, dx) / TAU + 0.5) + ring * 0.37) * count) % count;
    return ring * 1000 + k;
  };
  for (let y = Math.floor(cy - PRY) - 1; y <= cy + PRY + 1; y++) for (let x = Math.floor(cx - PRX) - 1; x <= cx + PRX + 1; x++) {
    if (mk(x, y) !== 2) continue;
    const id = idAt(x, y);
    if (id < 0) continue;
    const dx = (x + 0.5 - cx) / PRX, dy = (y + 0.5 - cy) / PRY, t = Math.hypot(dx, dy);
    const joint = idAt(x + 1, y) !== id || idAt(x, y + 1) !== id, top = idAt(x, y - 1) !== id, left = idAt(x - 1, y) !== id;
    let c;
    if (id >= 90000) {                                                                        // mörk kantsten runt torget
      c = joint ? 0x4a4642 : dy < 0 ? 0xa29d95 : 0x7a766f;
      if (top && !joint) c = mix(c, 0xffffff, 0.22);
      put(x, y, granite(x, y, c));
      continue;
    }
    const ring = Math.floor(t * NR);
    // åttauddig kompassros (avgörs per sten, så uddarna följer fogarna): långa uddar i
    // väderstrecken, korta på diagonalerna
    const count = Math.max(6, Math.round(ring * 6.4)), k = id - ring * 1000;
    const sa = (mod((k + 0.5) / count - ring * 0.37, 1) - 0.5) * TAU;
    const Q = Math.PI / 2, dMain = Math.abs(mod(sa + Q / 2, Q) - Q / 2), dDiag = Math.abs(mod(sa, Q) - Q / 2);
    const main = ring >= 4 && ring <= 11 && dMain < 0.28 * (1 - (ring - 4) / 8.5);
    const diag = !main && ring >= 4 && ring <= 8 && dDiag < 0.22 * (1 - (ring - 4) / 5.5);
    if (ring === 12 || ring === 3) c = 0x7a756e;                                              // mörka band
    else if (main) c = 0xbc836a;                                                              // rödgranit
    else if (diag) c = 0x7e7872;                                                              // mörkgrå granit
    else if (ring <= 2) c = 0xd2ccc2;                                                         // ljus mitt (fontänen står här)
    else c = ring & 1 ? 0xd0c6b6 : 0xc6c0b6;
    c = mul(c, 0.9 + hash(id, 7, 480) * 0.16);
    if (joint) c = mul(0x5a5650, 0.9 + hash(x, y, 481) * 0.2);
    else if (top) c = mix(c, 0xffffff, 0.2);
    else if (left) c = mix(c, 0xffffff, 0.08);
    else if (idAt(x, y + 2) !== id) c = mul(c, 0.88);
    put(x, y, grainy(c, x, y, 0.05));
  }
  // lätt skugga på gräset söder om torgets kantsten
  ellipse(cx, cy, PRX + 1.5, PRY + 1.5, (x, y) => { if (!mk(x, y) && y > cy) shade(x, y, 0.84); });
}

// =====================================================================
function nightTint() {
  for (let i = 0; i < D.length; i += 4) { D[i] *= 0.86; D[i + 1] *= 0.9; D[i + 2] = Math.min(255, D[i + 2] * 0.97 + 8); }
}

export function paintGround(night) {
  const P = new Pix(W, H);
  D = P.d; SH = new Uint8Array(W * H);
  try {
    paintBack();
    for (const g of STREETS) (g.kind === 'street' ? paintSideStreet : paintAlley)(g);
    backShadows();
    paintSidewalkN();
    paintRoad();
    paintSidewalkS();
    paintPark();
    paintPuddles(night);
    if (night) nightTint();
  } finally { D = null; SH = null; }
  return P.flush();
}

// =====================================================================
// LEVANDE MARK – molnskuggor och regnringar (billigt: en förmålad bild + få pixlar)
// =====================================================================
const CW = 720, CHh = 420;
let CLOUD = null;
function cloudTex() {
  if (CLOUD) return CLOUD;
  const dens = new Float32Array(CW * CHh);
  for (let i = 0; i < 4; i++) {
    const cx = (i + hash(i, 1, 901) * 0.6) * CW / 4, cy = hash(i, 2, 901) * CHh, sz = 80 + hash(i, 3, 901) * 70;
    for (let j = 0; j < 8; j++) {
      const bx = cx + (hash(i, j, 902) - 0.5) * sz * 1.6, by = cy + (hash(i, j, 903) - 0.5) * sz * 0.5;
      const rx = sz * (0.35 + hash(i, j, 904) * 0.35), ry = sz * (0.22 + hash(i, j, 905) * 0.14);
      for (let y = Math.floor(by - ry); y <= by + ry; y++) for (let x = Math.floor(bx - rx); x <= bx + rx; x++) {
        const d = 1 - Math.hypot((x + 0.5 - bx) / rx, (y + 0.5 - by) / ry);
        if (d <= 0) continue;
        const k = (((y % CHh) + CHh) % CHh) * CW + (((x % CW) + CW) % CW);
        if (d > dens[k]) dens[k] = d;
      }
    }
  }
  const P = new Pix(CW, CHh);
  for (let y = 0; y < CHh; y++) for (let x = 0; x < CW; x++) {
    const d0 = dens[y * CW + x];
    if (d0 <= 0) continue;
    const d = d0 + (vnoise(x, y, 9, 906) - 0.5) * 0.12;
    if (d > 0.3 || (d > 0 && bayer(x, y) < d / 0.3)) P.px(x, y, 0x0c1422);
  }
  return (CLOUD = P.flush());
}
// våt mark i regn: mörkare, mättad yta + blanka strimmor där himlen speglas (en förmålad bild)
let WET = null;
function wetTex() {
  if (WET) return WET;
  const P = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= PK0) { P.px(x, y, 0x0a1420, 0.12); continue; }                                    // parken: lite mörkare
    P.px(x, y, 0x0c1422, y >= R0 + 3 && y < R1 - 4 ? 0.22 : 0.15);
    if (hash(x, y, 971) > 0.992) P.px(x, y, 0xc8d8ea, 0.35);                                  // glimtar i vattenfilmen
  }
  // himlen speglas i de blanka hjulspåren
  for (let i = 0; i < 1100; i++) {
    const band = TRACKS[i % TRACKS.length], x = (hash(i, 1, 970) * W) | 0;
    const y = band[0] + ((hash(i, 2, 970) * (band[1] - band[0])) | 0), len = 3 + ((hash(i, 3, 970) * 10) | 0);
    for (let k = 0; k < len; k++) P.px(x + k, y, 0xa8bcd4, 0.3 * (1 - Math.abs(k - len / 2) / len));
  }
  // vattenfilm längs rännstenarna
  for (let x = 0; x < W; x++) for (const y of [R0 + 1, R1 - 3]) {
    const v = vnoise(x, y, 14, 972);
    if (v > 0.45) P.px(x, y, 0xb4c6dc, (v - 0.45) * 0.7);
  }
  return (WET = P.flush());
}
// ringar (ellipser) för regndroppar i pölar, radie 1–4
const RING = [null];
for (let r = 1; r <= 4; r++) {
  const pts = new Set(), ry = Math.max(1, r * 0.5);
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.add(Math.round(Math.cos(a) * r) + ',' + Math.round(Math.sin(a) * ry)); }
  RING.push([...pts].map((s) => s.split(',').map(Number)));
}
const mod = (a, n) => ((a % n) + n) % n;

export function groundLive(ctx, env, view) {
  const vx0 = Math.floor(view.x), vy0 = Math.floor(view.y), vx1 = vx0 + Math.ceil(view.w), vy1 = vy0 + Math.ceil(view.h);
  // molnskuggor som driver förbi på dagen
  if (!env.rain && env.dark < 0.4) {
    const tex = cloudTex();
    const ox = Math.floor(mod(env.t * 5, CW)), oy = Math.floor(mod(env.t * 1.2, CHh));
    ctx.save();
    ctx.globalAlpha = 0.13 * (1 - env.dark / 0.4);
    for (let ty = Math.floor((vy0 - oy) / CHh) * CHh + oy; ty < vy1; ty += CHh)
      for (let tx = Math.floor((vx0 - ox) / CW) * CW + ox; tx < vx1; tx += CW) {
        const sx0 = Math.max(vx0, tx), sy0 = Math.max(vy0, ty), sx1 = Math.min(vx1, tx + CW), sy1 = Math.min(vy1, ty + CHh);
        if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(tex, sx0 - tx, sy0 - ty, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
      }
    ctx.restore();
  }
  if (!env.rain) return;
  ctx.save();
  // blöt mark
  const wx0 = Math.max(0, vx0), wy0 = Math.max(0, vy0), wx1 = Math.min(W, vx1), wy1 = Math.min(H, vy1);
  if (wx1 > wx0 && wy1 > wy0) ctx.drawImage(wetTex(), wx0, wy0, wx1 - wx0, wy1 - wy0, wx0, wy0, wx1 - wx0, wy1 - wy0);
  // regnringar i pölarna
  for (const p of PUDDLES) {
    if (p.x + p.rx < vx0 || p.x - p.rx > vx1 || p.y + p.ry < vy0 || p.y - p.ry > vy1) continue;
    const n = p.rx > 7 ? 3 : 2, rmax = Math.max(1, Math.min(4, Math.floor(p.rx * 0.5)));
    for (let k = 0; k < n; k++) {
      const ph = env.t * 1.3 + hash(p.i, k, 950) * 3, cyc = Math.floor(ph), f = ph - cyc;
      const cx = Math.round(p.x + (hash(p.i, k * 31 + cyc, 951) - 0.5) * (p.rx - rmax)), cy = Math.round(p.y + (hash(p.i, k * 31 + cyc, 952) - 0.5) * p.ry * 0.5);
      const r = 1 + Math.floor(f * rmax);
      ctx.fillStyle = `rgba(214,228,246,${(0.6 * (1 - f)).toFixed(3)})`;
      for (const [dx, dy] of RING[Math.min(4, r)]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
  // stänk där dropparna slår i marken
  ctx.fillStyle = 'rgba(206,222,244,0.5)';
  const cnt = Math.min(260, Math.round(60 * (view.w * view.h) / (384 * 216))), s = Math.floor(env.t * 9);
  for (let j = 0; j < cnt; j++) {
    const x = vx0 + Math.floor(hash(j, s, 960) * (vx1 - vx0)), y = vy0 + Math.floor(hash(j, s, 961) * (vy1 - vy0));
    ctx.fillRect(x, y, 1, 1);
    if (hash(j, s, 962) > 0.6) { ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
  }
  ctx.restore();
}
