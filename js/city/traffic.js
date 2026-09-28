// Trafiken i Pixelstaden – bilar, bussar, glassbil, moped, snöplog och trafikljus
// på ALLA vägar i ROADS (Pixelgatan, Södergatan och den lodräta Infarten).
//
// Fordonen kör i körfälten, köar bakom varandra, bromsar mjukt vid stopplinjen
// när ljuset slår om, väjer vid obevakade och trasiga övergångsställen, stannar
// för folk på vägen och tutar på spelaren om hen står i vägen för länge. Bussarna
// stannar vid alla hållplatser på sin väg (även den trasiga) och öppnar dörrarna.
// Bilar svänger in i Infarten från Pixelgatan och Södergatan, väjer för
// tvärtrafiken i T-korsningarna och svänger ut igen i andra änden. Fordon som
// kör ut ur världen försvinner och nya fyller på från kanten.
//
// Vädret (env.weather): torkare och blöta speglingar i regn, snö på taken och
// långsammare körning när det snöat, halvljus på dagen i dimma och regn, en
// snöplog per gata på vintern, mopeden stannar hemma i snö och ösregn.
// Förorten: rostiga bilar i trafiken, på parkeringen, på tomten och vid husvagnen,
// och en parkerad moped utanför garagen.
//
// Allt målas pixel för pixel EN gång och cachas: varje kaross (per typ, färg,
// variant och rost) finns färdig åt båda hållen och sedd fram-/bakifrån för
// Infarten, hjulen är små egna bilder med åtta rotationslägen, trafikljusen
// cachas per lampläge, snötäcken och speglingar härleds ur karossbilden. Varje
// bildruta ritas bara färdiga bilder på heltalskoordinater i skala 1.
//
// Kontrakt (docs/STADEN.md): createTraffic(env) →
//   { items(), obstacles, update(dt), glow(ctx), pedGreen(i), positions(), vehicles(), carLight(i), pedLight(i) }
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW, ctxText } from '../core/floor-pix.js';
import { CITY, ROADS, CROSSWALKS_ALL, LIGHTS_ALL, LOTS, buildingById } from './map.js';

export const V2 = true;

// ======================================================================
// Fordonsritningar (sidan)
// ======================================================================
// Alla mått i "bilkoordinater": x från bakänden (0) till fronten (L-1) för en
// bil som kör åt höger, h = höjd över marken (0 = hjulens nedersta rad).
// top/bot = karossens övre/undre kontur som brutna linjer [x, h].
// cab = hyttens x-spann, belt = fönsterlinjen (rutor börjar ovanför),
// roof/ws/rw = spann där man ser taket / vindrutan / bakrutan snett uppifrån,
// D = hur många pixlar av taket som syns (3/4-vyn).

const SPECS = {
  sedan: {
    L: 58, D: 3, r: 5, wheels: [12, 46], rim: 'alloy',
    top: [[0, 9], [1, 12], [2, 13], [12, 14], [18, 21], [20, 22], [33, 22], [36, 21], [43, 14], [53, 13], [56, 11], [57, 8]],
    bot: [[0, 5], [2, 3], [55, 3], [57, 5]],
    cab: [13, 43], belt: 14, roof: [19, 34], ws: [35, 43], rw: [12, 18],
    pillars: [[28, 29]],
    bump: { h0: 3, h1: 7, rear: 3, front: 3 },
    head: { x: 55, h0: 9, h1: 10 }, tail: { w: 2, h0: 9, h1: 11 },
    seams: [17, 29, 43], handles: [[20, 11], [32, 11]], mirror: { x: 40, h: 15 },
    crease: 9, heads: [{ x: 33, kind: 'driver' }, { x: 21, kind: 'back' }],
    antenna: 20, fuel: { x: 5, h: 12 }, extraTop: 3,
  },
  halvkombi: {
    L: 50, D: 3, r: 5, wheels: [10, 39], rim: 'alloy',
    top: [[0, 8], [1, 16], [2, 19], [4, 21], [25, 21], [28, 20], [34, 14], [45, 12], [48, 10], [49, 7]],
    bot: [[0, 5], [2, 3], [47, 3], [49, 5]],
    cab: [1, 34], belt: 13, roof: [4, 27], ws: [28, 34], rw: [0, 3],
    pillars: [[1, 7], [19, 20]],
    bump: { h0: 3, h1: 7, rear: 2, front: 3 },
    head: { x: 47, h0: 9, h1: 10 }, tail: { w: 2, h0: 9, h1: 14 },
    seams: [21, 34], handles: [[23, 10]], mirror: { x: 31, h: 14 },
    crease: 9, heads: [{ x: 25, kind: 'driver' }, { x: 12, kind: 'back' }],
    rails: true, fuel: { x: 4, h: 11 }, extraTop: 2,
  },
  pickup: {
    L: 62, D: 3, r: 6, wheels: [13, 49], rim: 'steel',
    top: [[0, 13], [1, 16], [23, 16], [24, 17], [25, 24], [26, 25], [37, 25], [44, 16], [57, 15], [60, 12], [61, 9]],
    bot: [[0, 7], [2, 5], [59, 5], [61, 7]],
    cab: [24, 44], belt: 16, roof: [25, 37], ws: [38, 44], rw: [23, 24], bed: [1, 22],
    pillars: [[25, 27]],
    bump: { h0: 4, h1: 8, rear: 2, front: 3, chrome: true },
    head: { x: 59, h0: 11, h1: 13 }, tail: { w: 2, h0: 10, h1: 14 },
    seams: [24, 44], handles: [[29, 14]], mirror: { x: 41, h: 17 },
    crease: 11, heads: [{ x: 34, kind: 'driver' }], cargo: true, extraTop: 4,
  },
  skapbil: {
    L: 72, D: 3, r: 6, wheels: [14, 58], rim: 'steel',
    top: [[0, 6], [1, 32], [2, 33], [3, 34], [50, 34], [52, 33], [59, 22], [66, 18], [69, 16], [70, 14], [71, 10]],
    bot: [[0, 6], [2, 4], [69, 4], [71, 6]],
    cab: [51, 60], belt: 18, winTop: 29, roof: [2, 51], ws: [52, 60],
    pillars: [],
    bump: { h0: 4, h1: 8, rear: 2, front: 3, dark: true },
    head: { x: 69, h0: 12, h1: 14 }, tail: { w: 2, h0: 12, h1: 19 },
    seams: [51, 61], handles: [[36, 20], [53, 16]], mirror: { x: 57, h: 19, big: true },
    crease: 10, heads: [{ x: 54, kind: 'driver' }], brand: 'pixelbud', ribs: true, extraTop: 1,
  },
  glassbil: {
    L: 68, D: 3, r: 6, wheels: [14, 54], rim: 'white',
    top: [[0, 6], [1, 29], [2, 30], [3, 31], [47, 31], [49, 30], [55, 21], [61, 17], [64, 15], [66, 13], [67, 9]],
    bot: [[0, 6], [2, 4], [65, 4], [67, 6]],
    cab: [48, 56], belt: 17, winTop: 27, roof: [2, 48], ws: [49, 56],
    pillars: [],
    bump: { h0: 4, h1: 8, rear: 2, front: 3, chrome: true },
    head: { x: 65, h0: 11, h1: 12 }, tail: { w: 2, h0: 11, h1: 16 },
    seams: [47], handles: [[49, 15]], mirror: { x: 53, h: 18, big: true },
    crease: 10, heads: [{ x: 50, kind: 'driver' }], brand: 'glass', extraTop: 12,
  },
  buss: {
    L: 116, D: 4, r: 7, wheels: [26, 92], rim: 'bus',
    top: [[0, 8], [1, 40], [2, 42], [3, 43], [112, 43], [114, 42], [115, 39]],
    bot: [[0, 6], [2, 4], [113, 4], [115, 6]],
    cab: [1, 114], belt: 21, winTop: 36, roof: [0, 115],
    pillars: [[1, 4], [16, 17], [30, 31], [44, 45], [64, 64], [91, 92], [100, 100], [112, 114]],
    doors: [[52, 63], [101, 111]],
    bump: { h0: 4, h1: 9, rear: 2, front: 2, dark: true },
    head: { x: 114, h0: 9, h1: 11 }, tail: { w: 2, h0: 10, h1: 17 },
    seams: [], handles: [], mirror: null,
    crease: 14, bus: true, upper: 0xeeeee8, roofColor: 0xdcdcd8, extraTop: 4,
  },
  // snöplogen: orange lastbil med saltspridare bak, plogblad fram och varningsljus på hytten
  plog: {
    L: 80, D: 3, r: 7, wheels: [16, 54], rim: 'steel',
    top: [[0, 8], [1, 30], [2, 32], [42, 32], [44, 31], [46, 30], [47, 24], [50, 25], [58, 25], [62, 17], [64, 16], [65, 13], [66, 16], [67, 16], [78, 16], [79, 12]],
    bot: [[0, 7], [2, 5], [63, 5], [65, 7], [66, 1], [79, 1]],
    cab: [47, 62], belt: 15, winTop: 24, roof: [2, 44], ws: [58, 62], pillars: [[47, 48]],
    bump: { h0: 5, h1: 9, rear: 2, front: 0, dark: true },
    head: { x: 63, h0: 11, h1: 13 }, tail: { w: 2, h0: 12, h1: 18 },
    seams: [46], handles: [[52, 14]], mirror: { x: 59, h: 19, big: true },
    crease: 11, heads: [{ x: 56, kind: 'driver' }], blade: [66, 79], beacon: 54, hopper: [3, 44], extraTop: 8,
  },
  // mopeden ritas av paintMoped – här bara måtten som trafiken behöver
  moped: { L: 28, D: 0, r: 4, wheels: [5, 22], rim: 'moped', moped: true, head: { x: 24, h0: 12, h1: 13 }, tail: { w: 2, h0: 9, h1: 10 } },
};
SPECS.taxi = { ...SPECS.sedan, taxi: true, extraTop: 8 };

const PAINT = [0xc23a32, 0x2f6db5, 0xc3c8d0, 0xe9e9eb, 0x2b2e36, 0x3f8a55, 0xd99a2b, 0x2a9d9a, 0x7a2e3e, 0x5e7b99, 0xe57a2e, 0x6b4f8f];
const RUST_PAINT = [0x7a6f5e, 0x8a4a3a, 0x5e6a5e, 0x9a8a6a, 0x6a5a7a, 0x4a5a6a, 0xa89a6a, 0x6e5a4a];
const COLORS = {
  sedan: PAINT, halvkombi: PAINT, taxi: [0xf2c230, 0xf2c230, 0x2b2e36],
  pickup: [0x3d6b45, 0xa83232, 0x2c4a7a, 0xd9b44a, 0x8a8f96],
  skapbil: [0xeceef1], glassbil: [0xf7f2e6], buss: [0xc8352e], plog: [0xe0761e], moped: [0xd9433b, 0x3a7bd5, 0xf2c230, 0x2aa39a, 0xe8e3d6],
};
const SKINS = [0xf6d7bf, 0xeec3a0, 0xe0a97f, 0xc68a5c, 0xa06a43, 0x744a2d];
const HAIRS = [0x1d1714, 0x3b2619, 0x6b4226, 0xa5692f, 0xd9a95c, 0xb9b3ab, 0xb7392b];
const SHIRTS = [0xd9433b, 0x3a7bd5, 0x46a35a, 0xf0b429, 0x8e5bd1, 0x2f3440, 0xe8e3d6, 0x2aa39a];

// Regionerna i karossmasken
const BODY = 1, GLASS = 2, FRAME = 3, BUMP = 4, ARCH = 5, TOPB = 6, TOPR = 7, TOPG = 8, TRIM = 9, BED = 10, DOOR = 11;

function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) { const [x0, y0] = pts[i - 1]; return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return pts[pts.length - 1][1];
}

// Spegla en Pix horisontellt (pixel för pixel – ingen ctx.scale).
function mirrored(P) {
  const Q = new Pix(P.w, P.h), s = P.d, d = Q.d, w = P.w;
  for (let y = 0; y < P.h; y++) for (let x = 0; x < w; x++) {
    const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
    d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = s[a + 3];
  }
  return Q;
}

// Snötäcke och blöt spegling härledda ur en färdig karossbild (Pix, markraden gy):
//   snö  – 1–2 px vitt ovanpå den översta konturen där ytan är någorlunda plan
//   refl – de nedersta raderna speglade nedåt, mörkare, blåtonade och dithrade
function overlays(P, gy) {
  const W = P.w, H = P.h, d = P.d;
  const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
  const tops = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (alpha(x, y) > 200) { tops[x] = y; break; }
  const S = new Pix(W, H), R = new Pix(W, 12);
  for (let x = 0; x < W; x++) {
    const t = tops[x];
    if (t < 0 || t > gy - 4) continue;
    const flat = (x === 0 || tops[x - 1] < 0 || Math.abs(tops[x - 1] - t) <= 2) && (x === W - 1 || tops[x + 1] < 0 || Math.abs(tops[x + 1] - t) <= 2);
    if (flat) {
      S.px(x, t, hash(x, 3, 92) > 0.8 ? 0xffffff : 0xf2f6fc);
      if (hash(x, 1, 91) > 0.3) S.px(x, t - 1, hash(x, 2, 93) > 0.6 ? 0xffffff : 0xeaf0f8);
      if (hash(x >> 1, 4, 94) > 0.55) S.px(x, t - 2, 0xffffff, 0.8);
      S.px(x, t + 1, 0xdfe8f4, 0.45);
    }
    for (let k = 0; k < 12; k++) {
      const sy = gy - 2 - k;
      if (sy < 0) break;
      const a = alpha(x, sy);
      if (!a || ((x + k) & 1)) continue;
      R.px(x, k, mix(mul(P.get(x, sy), 0.7), 0x1c2a44, 0.35), (0.34 - k * 0.026) * (a / 255));
    }
  }
  return { S, R };
}

// Huvud + axlar bakom en ruta (4 bred, vänd åt höger). h = hår, s = hy, t = tröja
const HEAD = ['.hh.', 'hhhh', 'hhss', 'hsss', '.ss.', 'tttt', 'tttt'];
const HEAD_BACK = ['.hh.', 'hhhh', 'hhhh', 'hhhh', '.ss.', 'tttt', 'tttt'];
const REST = ['.rr.', 'rrrr', 'rrrr', 'rrrr'];

function paintVehicle(kind, color, variant, opts = {}) {
  const s = SPECS[kind], L = s.L, D = s.D, rust = !!opts.rust;
  const ht = [], hb = [];
  for (let x = 0; x < L; x++) { ht.push(Math.round(interp(s.top, x))); hb.push(Math.round(interp(s.bot, x))); }
  const maxH = Math.max(...ht) + D + (s.extraTop || 1);
  const W = L + 2, PADB = 2, H = maxH + 1 + PADB, gy = maxH;
  const M = new Uint8Array(W * H);
  const ok = (x, h) => x >= -1 && x <= L && h <= gy && h >= -PADB;
  const get = (x, h) => (ok(x, h) ? M[(gy - h) * W + x + 1] : 0);
  const set = (x, h, v) => { if (ok(x, h)) M[(gy - h) * W + x + 1] = v; };
  const within = (r, x) => !!r && x >= r[0] && x <= r[1];
  const inCab = (x) => within(s.cab, x);
  const winTop = s.winTop ?? 999;
  const pillar = (x) => (s.pillars || []).some((p) => within(p, x));
  const bump = s.bump;
  const rnd = (k) => hash(variant * 31 + k, color & 0xffff, kind.length * 7 + (color >> 16));

  // 1) siluetten från sidan
  for (let x = 0; x < L; x++) for (let h = hb[x]; h <= ht[x]; h++) {
    let r = inCab(x) && h > s.belt ? FRAME : BODY;
    if ((x < bump.rear || x >= L - bump.front) && h >= bump.h0 && h <= bump.h1) r = BUMP;
    set(x, h, r);
  }
  // 2) rutorna: hyttens pixlar som har ram runt om sig
  const cabAt = (x, h) => x >= 0 && x < L && inCab(x) && h > s.belt && h <= ht[x];
  for (let x = 0; x < L; x++) for (let h = s.belt + 1; h <= Math.min(ht[x] - 1, winTop); h++) {
    if (!cabAt(x, h)) continue;
    if (pillar(x)) set(x, h, TRIM);
    else if (cabAt(x - 1, h) && cabAt(x + 1, h) && cabAt(x, h + 1)) set(x, h, GLASS);
  }
  for (const d of s.doors || []) for (let x = d[0]; x <= d[1]; x++) for (let h = hb[x] + 1; h <= winTop; h++) set(x, h, DOOR);
  // 3) det man ser av taket/huven/rutorna snett uppifrån
  for (let x = 0; x < L; x++) {
    const h0 = ht[x];
    if ((x > 0 && ht[x - 1] - h0 > D + 1) || (x < L - 1 && ht[x + 1] - h0 > D + 1)) continue;
    const r = within(s.bed, x) ? BED : within(s.ws, x) || within(s.rw, x) ? TOPG : within(s.roof, x) ? TOPR : TOPB;
    for (let k = 1; k <= D; k++) if (!get(x, h0 + k)) set(x, h0 + k, r);
  }
  // 4) hjulhusen
  const ra = s.r + 1.6;
  for (const wx of s.wheels) for (let x = Math.floor(wx - ra); x <= Math.ceil(wx + ra); x++) for (let h = 0; h <= s.r + ra + 1; h++) {
    const r = get(x, h);
    if ((r === BODY || r === BUMP || r === DOOR) && Math.hypot(x - wx, h - s.r) <= ra) set(x, h, ARCH);
  }

  // ---------- målning ----------
  const P = new Pix(W, H);
  const put = (x, h, c, a = 1) => P.px(x + 1, gy - h, c, a);
  const cur = (x, h) => P.get(x + 1, gy - h);
  const nz = (x, h) => bayer(x + 1, gy - h) - 0.5;
  const c = rust ? mix(color, 0x8a8a84, 0.3) : color;
  const R = { hi: mix(c, 0xffffff, rust ? 0.35 : 0.55), lt: mix(c, 0xffffff, 0.24), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
  const near = (x) => s.wheels.reduce((a, w) => (Math.abs(w - x) < Math.abs(a - x) ? w : a));

  // skuggan på vägen och mörkret under bilen
  for (let x = 0; x < L; x++) {
    const e = Math.min(x, L - 1 - x);
    put(x, 0, 0x08080e, e < 2 ? 0.2 : 0.4);
    put(x, -1, 0x08080e, e < 4 ? 0.08 : 0.2);
    for (let h = 1; h < hb[x]; h++) if (!get(x, h)) put(x, h, 0x0e0e12, e < 2 ? 0.45 : 0.82);
  }

  for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const n = nz(x, h);
    let col = c;
    if (r === BODY || r === BUMP) {
      const topE = inCab(x) ? s.belt : ht[x], bot = hb[x];
      if (inCab(x) && h === s.belt) col = s.bus ? 0x1c1d22 : 0x26272c;               // fönsterlist
      else if (h === topE || (inCab(x) && h === s.belt - 1)) col = R.hi;             // skuldran fångar ljuset
      else if (h === topE - 1 && !inCab(x)) col = R.lt;
      else if (h === s.crease) col = mix(R.lt, R.hi, rust ? 0.1 : 0.35);             // karaktärslinjen
      else if (h === s.crease - 1) col = R.dk;
      else if (h > s.crease) {
        const t = (h - s.crease) / Math.max(1, topE - s.crease);
        col = mix(mix(R.c, R.lt, t * 0.7 + n * 0.35), 0xdfeaff, rust ? 0.02 : 0.05 + t * 0.06);   // himlen speglas uppe
      } else {
        const t = (s.crease - 1 - h) / Math.max(1, s.crease - 1 - bot);
        col = mix(mix(R.md, R.dd, t * 0.85 + n * 0.3), 0x3a3028, t * 0.12);          // gatan speglas nere
      }
      if (h === bot) col = R.dd;
      if (!rust && (x + (h >> 1)) % 41 < 2 && h > s.crease && h < topE - 1) col = mix(col, 0xffffff, 0.16);
      if (hash(x, h, 7) > 0.95) col = mul(col, 1.06);
      if (s.bus) {
        if (h === 20) col = 0xf4f4ee; else if (h === 19) col = mul(c, 0.62);
        else if (h <= 6) col = mul(col, 0.78);
      }
      if (r === BUMP) {
        if (bump.chrome && !rust) col = h >= bump.h1 - 1 ? 0xf2f4f8 : h > bump.h0 + 1 ? mix(0xc4c8d0, 0x8a8e96, n + 0.5) : 0x5a5e66;
        else if (bump.dark || rust) col = h === bump.h1 ? 0x4a4c54 : mix(0x2a2b31, 0x1c1d22, n + 0.5);
        else col = h <= bump.h0 + 1 ? 0x26272c : mul(col, 0.94);
      }
    } else if (r === FRAME) {
      const base = s.upper ?? c, lt = mix(base, 0xffffff, 0.25);
      col = h === ht[x] ? mix(base, 0xffffff, 0.5) : mix(base, lt, 0.45 + n * 0.3);
      if (s.upper && h === ht[x] - 1) col = mix(base, 0xffffff, 0.35);
    } else if (r === GLASS || r === DOOR) {
      const gtop = Math.min(ht[x] - 1, winTop), gb = r === DOOR ? hb[x] + 1 : s.belt + 1;
      const t = (h - gb) / Math.max(1, gtop - gb);
      col = mix(0x5a7792, 0x1c2633, t * 0.9 + n * 0.25);
      const st = (((x - h) % 23) + 23) % 23;
      if (st < 2) col = mix(col, 0xe6f2ff, 0.42); else if (st === 2 || st === 5) col = mix(col, 0xe6f2ff, 0.16);
      if (h === gtop) col = mul(col, 0.7);
    } else if (r === TRIM) {
      col = mix(0x18191e, 0x2a2b31, n + 0.5);
    } else if (r === TOPR) {
      const k = h - ht[x], base = s.roofColor ?? c;
      col = mix(base, 0xffffff, k === 1 ? 0.46 : 0.3 - 0.05 * k + n * 0.1);
      if (s.ribs && x % 5 === 0 && k > 1) col = mul(col, 0.9);
    } else if (r === TOPB) {
      const k = h - ht[x];
      col = mix(c, 0xffffff, k === 1 ? 0.42 : 0.27 - 0.05 * k + n * 0.1);
    } else if (r === TOPG) {
      const k = h - ht[x];
      col = mix(0x6f93b6, 0xdcecff, ((k - 1) / D) * 0.8 + n * 0.25);
      if ((x * 2 + k) % 11 < 2) col = mix(col, 0xffffff, 0.35);
    } else if (r === BED) {
      const k = h - ht[x];
      col = k === D ? R.lt : k === D - 1 ? R.dk : x % 3 === 0 ? 0x3a3b41 : 0x2a2b30;
    } else if (r === ARCH) {
      col = Math.hypot(x - near(x), h - s.r) > s.r + 0.7 ? 0x202027 : 0x111115;
    }
    put(x, h, col);
  }

  // ---------- rost: fläckar, smuts, en omlackad dörr, sprucken ruta, bucklor ----------
  if (rust) {
    for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
      const r = get(x, h);
      if (r !== BODY && r !== BUMP && r !== DOOR) continue;
      const low = h < s.crease ? 1 : 0.35;
      const n = hash(x >> 1, h >> 1, 71 + variant) * 0.7 + hash(x, h, 72) * 0.3;
      const nearArch = Math.hypot(x - near(x), h - s.r) < s.r + 4 ? 0.12 : 0;
      if (n > 1 - 0.13 * low - nearArch - (h <= 3 ? 0.2 : 0)) put(x, h, mix(0x6e3414, 0xa8582a, hash(x, h, 73)), 0.85);
      else if (h <= 4 && hash(x, h, 74) > 0.5) put(x, h, mix(cur(x, h), 0x5a4a34, 0.5));
    }
    if (s.seams && s.seams.length >= 2) {
      const prim = variant % 2 ? 0x8b8f8a : mix(RUST_PAINT[(variant + 3) % RUST_PAINT.length], 0x808080, 0.3);
      for (let x = s.seams[0] + 1; x < s.seams[1]; x++) for (let h = hb[x] + 1; h < s.belt; h++) if (get(x, h) === BODY) put(x, h, mix(cur(x, h), prim, 0.75));
    }
    if (s.ws) for (let x = s.ws[0]; x <= s.ws[1]; x++) {
      const h = s.belt + 2 + ((x * 5) % 3);
      if (get(x, h) === GLASS) put(x, h, 0xe8f2fa, 0.6);
      if (x === s.ws[0] + 2 && get(x, h + 1) === GLASS) put(x, h + 1, 0xe8f2fa, 0.5);
    }
    for (let h = bump.h0; h <= bump.h1; h++) { if (get(L - 2, h)) put(L - 2, h, 0x3a2a1c); if (get(1, h) && h > bump.h0) put(1, h, 0x4a3a2c); }
  }

  // ---------- figurer bakom rutorna ----------
  const occ = new Uint8Array(W * H);
  const onGlass = (x, h) => get(x, h) === GLASS || get(x, h) === DOOR;
  function figure(pat, x0, hTop, pal, tint = 0.3) {
    pat.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i], x = x0 + i, h = hTop - j;
        if (ch === '.' || !onGlass(x, h)) continue;
        put(x, h, mix(pal[ch], cur(x, h), tint));
        if (ok(x, h)) occ[(gy - h) * W + x + 1] = 1;
      }
    });
  }
  const person = (x0, hTop, k) => {
    const skin = SKINS[Math.floor(rnd(k) * SKINS.length)], hair = HAIRS[Math.floor(rnd(k + 1) * HAIRS.length)];
    const shirt = SHIRTS[Math.floor(rnd(k + 2) * SHIRTS.length)];
    figure(HEAD, x0, hTop, { h: hair, s: skin, t: shirt });
  };
  const seatTop = Math.min(s.belt + 7, winTop);
  for (const [i, hd] of (s.heads || []).entries()) {
    if (hd.kind === 'driver') person(hd.x, seatTop, 10 + i * 5);
    else if (rnd(40 + i) < 0.5) person(hd.x, seatTop - 1, 20 + i * 5);
    else figure(REST, hd.x, s.belt + 5, { r: 0x24262e }, 0.25);
  }

  // ---------- konturen ----------
  const solid = (x, h) => get(x, h) !== 0;
  for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const u = !solid(x, h + 1), dn = !solid(x, h - 1), l = !solid(x - 1, h), rt = !solid(x + 1, h);
    if (u || dn || l || rt) {
      const k = cur(x, h);
      put(x, h, u && !dn ? mix(mul(k, 0.5), 0x161620, 0.4) : mix(mul(k, 0.38), 0x0a0a10, 0.5));
    } else if (r !== ARCH && (get(x, h - 1) === ARCH || get(x - 1, h) === ARCH || get(x + 1, h) === ARCH)) {
      put(x, h, mul(cur(x, h), 0.5));                                   // skuggkant mot hjulhuset
    } else if (r === BODY && get(x, h - 2) === ARCH) {
      put(x, h, mix(cur(x, h), 0xffffff, 0.22));                        // skärmkantens glans
    }
  }

  // ---------- detaljer ----------
  // dörrfogar
  for (const sx of s.seams || []) {
    const top = inCab(sx) ? s.belt - 1 : ht[sx] - 2;
    for (let h = hb[sx] + 1; h <= top; h++) {
      if (get(sx, h) !== BODY) continue;
      put(sx, h, mul(cur(sx, h), 0.6));
      if (get(sx + 1, h) === BODY) put(sx + 1, h, mix(cur(sx + 1, h), 0xffffff, 0.12));
    }
  }
  // handtag
  for (const [hx, hh] of s.handles || []) {
    for (let i = 0; i < 3; i++) { put(hx + i, hh, rust ? 0x9a9ea6 : 0xe6e9ee); put(hx + i, hh - 1, 0x2e3036); }
    put(hx + 3, hh, mul(c, 0.55));
  }
  // backspegel
  if (s.mirror) {
    const { x: mx, h: mh, big } = s.mirror, mh1 = big ? 4 : 2;
    for (let j = 0; j <= mh1; j++) for (let i = 0; i < 3; i++) {
      const edge = i === 2 || j === 0;
      put(mx + i, mh + j, j === mh1 ? R.hi : edge ? R.dd : j === mh1 - 1 ? R.lt : R.c);
    }
    put(mx + 1, mh - 1, 0x1c1d22);
  }
  // strålkastare fram, blinkers under
  const hd = s.head;
  const hdEnd = s.blade ? s.blade[0] : L;
  for (let x = hd.x; x < hdEnd; x++) for (let h = hd.h0; h <= hd.h1; h++) {
    if (!get(x, h)) continue;
    put(x, h, h === hd.h1 ? 0xffffff : x === hdEnd - 1 ? 0xd8dde6 : 0xfff3c8);
  }
  for (let h = hd.h0; h <= hd.h1; h++) if (get(hd.x - 1, h)) put(hd.x - 1, h, 0x3a3c44);
  for (let x = hd.x; x < hdEnd; x++) if (get(x, hd.h0 - 1)) put(x, hd.h0 - 1, 0xf0a030);
  // sidomarkering fram (bärnsten)
  const fm = s.wheels[1] + s.r + 3;
  if (get(fm, s.crease + 1) === BODY) { put(fm, s.crease + 1, 0xf0a030); put(fm + 1, s.crease + 1, 0xc07818); }
  // baklyktor (med backljus)
  const tl = s.tail;
  for (let x = 0; x < tl.w; x++) for (let h = tl.h0; h <= tl.h1; h++) {
    if (!get(x, h)) continue;
    put(x, h, h === tl.h1 ? 0xff7766 : h === tl.h0 ? 0x8a1a1a : 0xd42a2a);
  }
  if (get(1, tl.h0 + 1)) put(1, tl.h0 + 1, 0xeeeef2);
  for (let h = tl.h0; h <= tl.h1; h++) if (get(tl.w, h) === BODY) put(tl.w, h, mul(cur(tl.w, h), 0.6));
  // avgasrör
  const eh = hb[3] - 1;
  put(2, eh, rust ? 0x6a5a4a : 0x9a9ea6); put(3, eh, 0x4a4c54); put(4, eh, 0x2a2b30);
  // tanklock
  if (s.fuel) {
    const { x: fx, h: fh } = s.fuel;
    for (let i = 0; i < 3; i++) { put(fx + i, fh, mul(cur(fx + i, fh), 0.7)); put(fx + i, fh - 2, mul(cur(fx + i, fh - 2), 0.7)); }
    put(fx, fh - 1, mul(cur(fx, fh - 1), 0.7)); put(fx + 2, fh - 1, mul(cur(fx + 2, fh - 1), 0.7));
  }
  // antenn (på rostbilen: böjd galge)
  if (s.antenna !== undefined) {
    const ax = s.antenna, a0 = ht[ax] + D;
    put(ax, a0 + 1, 0x1c1d22); put(ax - 1, a0 + 2, 0x2a2b30); put(ax - 1, a0 + 3, 0x3a3b41);
    if (rust) { put(ax - 2, a0 + 3, 0x8a8e96); put(ax - 3, a0 + 2, 0x8a8e96); put(ax, a0 + 2, 0x8a8e96); }
  }
  // takräcke
  if (s.rails) {
    for (let x = s.roof[0] + 2; x <= s.roof[1] - 2; x++) {
      const h = ht[x] + D + 1;
      put(x, h, x % 3 === 0 ? 0x55575f : 0x2a2b31);
      if (x === s.roof[0] + 2 || x === s.roof[1] - 2 || x % 7 === 0) put(x, h - 1, 0x1c1d22);
    }
  }

  // ---------- typernas särdrag ----------
  const box = (x0, h0, w, hh, fill) => { for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) put(x0 + i, h0 + j, fill(i, j)); };
  if (s.taxi) {
    // rutig list och takskylt
    for (let x = 14; x <= 44; x++) for (const h of [7, 8]) if (get(x, h) === BODY) put(x, h, (x + h) & 1 ? 0x1a1a1e : 0xf4f4f0);
    for (let x = 18; x <= 34; x++) put(x, 23, 0x0a0a10, 0.35);
    box(17, 24, 19, 9, (i, j) => {
      const h = 24 + j, edge = i === 0 || i === 18 || h === 24 || h === 32;
      return edge ? 0x3a3222 : h === 31 ? 0xf6e6a8 : h === 30 ? 0xfff8d8 : mix(0xfff0b0, 0xf2d27a, (29 - h) / 5);
    });
  }
  if (s.cargo) {
    const v = variant % 3;
    if (rust) { // gammalt däck och skrot på flaket
      for (let x = 6; x <= 15; x++) for (let h = 17; h <= 22; h++) { const d = Math.hypot(x - 10.5, h - 19.5); if (d < 3.6) put(x, h, d > 2.6 ? 0x1a1a1e : d < 1.2 ? 0x3a3a40 : 0x26262c); }
      box(16, 17, 6, 3, (i, j) => (j === 2 ? 0x9a6a3a : i === 0 || i === 5 ? 0x4a3018 : 0x7a5228));
    } else if (v === 0) { // trälåda
      box(5, 17, 10, 6, (i, j) => (i === 0 || i === 9 || j === 5 ? 0x4a3018 : j === 2 ? 0x8a5a2a : mix(0xb58450, 0xc89660, bayer(i, j))));
      box(5, 23, 10, 2, (i, j) => (j === 1 ? 0x4a3018 : i === 0 || i === 9 ? 0x6a4424 : 0xd8aa70));
    } else if (v === 1) { // krukväxt
      box(14, 17, 6, 3, (i, j) => (i === 0 || i === 5 ? 0x6a2a14 : j === 2 ? 0xd8744a : 0xb85a34));
      for (let x = 12; x <= 23; x++) for (let h = 19; h <= 30; h++) {
        const d = Math.hypot(x - 17.5, h - 24.5);
        if (d > 5) continue;
        const k = d > 4.2 ? 0x1f4a22 : x + h > 44 ? 0x2f6a2c : hash(x, h, 5) > 0.55 ? 0x76c05a : 0x4f9a3e;
        put(x, h, k);
      }
    } else { // verktygslåda
      box(8, 17, 8, 4, (i, j) => (i === 0 || i === 7 || j === 0 ? 0x5a1414 : j === 3 ? 0xf06a5a : 0xc8322a));
      box(10, 21, 4, 1, () => 0x2a2b30);
    }
  }
  if (s.brand === 'pixelbud') {
    for (let x = 2; x <= 50; x++) for (let h = 12; h <= 18; h++) {
      if (get(x, h) !== BODY) continue;
      put(x, h, h === 18 ? 0xffb85a : h === 12 ? 0xb85e10 : mix(0xf59030, 0xe07a18, (17 - h) / 5 + nz(x, h) * 0.3));
    }
    for (let x = 2; x <= 50; x++) if (get(x, 10) === BODY) put(x, 10, 0x1f4fa8);
    // paketsymbol
    box(43, 13, 6, 5, (i, j) => (i === 0 || i === 5 || j === 0 || j === 4 ? 0x6a4420 : i === 2 || i === 3 ? 0xe8d8a0 : 0xc89858));
  }
  if (s.brand === 'glass') {
    // rosa våffelkant nertill
    const SC = [0, 1, 2, 2, 1, 0];
    for (let x = 2; x <= 46; x++) {
      const top = 10 + SC[x % 6];
      for (let h = 5; h <= top; h++) if (get(x, h) === BODY) put(x, h, h === top ? 0xf8c0d4 : h <= 6 ? 0xc86a90 : hash(x, h, 3) > 0.93 ? 0xffffff : mix(0xf29bbd, 0xe07aa4, (top - h) / 6));
    }
    // serveringslucka med glassbyttor och glassförsäljare
    box(18, 16, 19, 11, (i, j) => {
      if (i === 0 || i === 18 || j === 0 || j === 10) return 0x2a2c30;
      if (j === 1) return 0xc8ccd4;
      if (j === 2) return [0xf6a8c8, 0x7a4a2a, 0xf8eab8, 0x9ee6c4, 0xf6a8c8, 0xe86a5a][Math.floor(i / 3)] ?? 0xc8ccd4;
      return mix(0x3a2f3a, 0x241c26, j / 10);
    });
    [['.ww.', 'wwww', 'ssss', 'ssss', '.ss.', 'tttt']].forEach((pat) => pat.forEach((row, j) => {
      for (let i = 0; i < 4; i++) if (row[i] !== '.') put(26 + i, 24 - j, { w: 0xffffff, s: SKINS[1], t: 0xf29bbd }[row[i]]);
    }));
    for (let x = 19; x <= 25; x++) for (let h = 19; h <= 25; h++) put(x, h, 0xdcecff, (x - h) % 7 === 0 ? 0.35 : 0.12);
    // markis
    for (let x = 16; x <= 38; x++) for (let h = 27; h <= 29; h++) {
      if (h === 27 && x % 3 === 2) continue;
      put(x, h, h === 29 ? 0x8a2a4a : (x >> 1) & 1 ? 0xf07aa8 : 0xfff6f0);
    }
    for (let x = 17; x <= 36; x++) put(x, 26, 0x000000, 0.3);
    // stor strut på bakre delen
    for (let h = 9; h <= 20; h++) {
      const hw = ((h - 9) / 11) * 4;
      for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw); x++) if (get(x, h) === BODY) put(x, h, (x + h) % 3 === 0 ? 0xa86a2a : (x - h) % 3 === 0 ? 0xb87a3a : 0xe0a860);
    }
    for (let x = 2; x <= 13; x++) for (let h = 19; h <= 28; h++) {
      const d = Math.hypot(x - 7.5, h - 23.5);
      if (d < 4.6 && get(x, h) === BODY) put(x, h, d < 1.8 && x < 8 && h > 23 ? 0xffe0ec : x + h > 33 ? 0xe06a9a : 0xf6a0c4);
    }
    put(8, 28, 0xd02838); put(8, 29, 0xd02838); put(9, 29, 0x3a8a2a);
    // takskylt
    for (const px of [13, 41]) { put(px, 32, 0x2a2b30); put(px, 33, 0x2a2b30); }
    box(10, 34, 35, 12, (i, j) => {
      const h = 34 + j, edge = i === 0 || i === 34 || h === 34 || h === 45;
      if (edge) return 0x5a1a34;
      if (h === 44) return 0xffffff;
      return h === 35 || h === 43 ? 0xe0568e : 0xfff4f8;
    });
  }
  if (s.bus) {
    // dörrarna: glasade dubbeldörrar med gummilist
    for (const [x0, x1] of s.doors) {
      const mid = Math.floor((x0 + x1) / 2);
      for (let x = x0; x <= x1; x++) for (let h = hb[x] + 1; h <= winTop; h++) {
        if (get(x, h) !== DOOR) continue;
        if (x === x0 || x === x1 || h === winTop || h === hb[x] + 1) put(x, h, 0x1a1b20);
        else if (x === mid || x === mid + 1) put(x, h, x === mid ? 0x0e0e12 : 0x2a2b31);
        else if (h === 19 || h === 20) put(x, h, 0x3a3c44);
      }
    }
    // skyltar i rutorna
    box(65, 29, 26, 7, (i, j) => (i === 0 || i === 25 || j === 0 || j === 6 ? 0x2a2a2e : 0x0c0c0e));
    box(93, 29, 7, 7, (i, j) => (i === 0 || i === 6 || j === 0 || j === 6 ? 0x2a2a2e : 0x0c0c0e));
    // reklamskylt för Burgarbaren mellan mittdörren och framhjulet
    box(66, 8, 17, 10, (i, j) => (i === 0 || i === 16 || j === 0 || j === 9 ? 0x3a1a14 : i === 1 || i === 15 || j === 1 || j === 8 ? 0xf4f0e6 : mix(0xf6c83a, 0xe8a820, j / 9)));
    const BURGER = ['..#####..', '.#######.', '#########', 'ggggggggg', 'rrrrrrrrr', 'mmmmmmmmm', '.#######.'];
    BURGER.forEach((row, j) => { for (let i = 0; i < 9; i++) if (row[i] !== '.') put(70 + i, 16 - j, { '#': j === 0 ? 0xf0b060 : 0xd88a3a, g: 0x5ac03a, r: 0xe0402a, m: 0x6a3a1e }[row[i]]); });
    put(72, 15, 0xfff0d0); put(75, 16, 0xfff0d0);
    // passagerare
    for (const [x0, x1] of [[5, 15], [18, 29], [32, 43], [46, 51], [65, 90], [93, 99]]) {
      for (let x = x0 + 1; x <= x1 - 3; x += 5) {
        if (rnd(x) < 0.45) person(x, 28, x * 3);
        else figure(REST, x, 24, { r: 0x2c4c7a }, 0.35);
      }
    }
    // luftkonditionering på taket
    for (const [x0, w] of [[30, 22], [70, 14]]) {
      box(x0, 45, w, 4, (i, j) => (i === 0 || i === w - 1 || j === 3 ? 0x6a6c72 : j === 0 ? 0xb8bac0 : j === 2 ? 0xf2f2f4 : i % 3 === 1 ? 0x9a9ca2 : 0xdadcdf));
      box(x0, 49, w, 1, () => 0x5a5c62);
    }
  }
  if (s.blade) {
    // saltspridaren: stålbehållare med nitar och ränder, varningsränder bak
    const [q0, q1] = s.hopper;
    for (let x = q0; x <= q1; x++) for (let h = 17; h <= 31; h++) {
      if (get(x, h) !== BODY) continue;
      let k = mix(0x6a6e76, 0x8e929a, (h - 17) / 14 + nz(x, h) * 0.3);
      if (h === 31) k = 0xb8bcc4; else if (h === 17) k = 0x3a3e46;
      if (h % 4 === 2) k = mul(k, 0.85);
      if ((x - q0) % 8 === 0 && h % 4 === 0) k = 0xb0b4bc;
      if (x === q0 || x === q1) k = 0x4a4e56;
      put(x, h, k);
    }
    for (let x = 0; x <= 5; x++) for (let h = 8; h <= 10; h++) if (get(x, h)) put(x, h, ((x + h) % 4) < 2 ? 0xe8b820 : 0x1e1e22);
    // plogbladet: stål med gul/svart slitkant, fäste mot chassit
    const [b0, b1] = s.blade;
    for (let x = b0; x <= b1; x++) for (let h = 0; h <= 16; h++) {
      if (!get(x, h)) continue;
      const t = (x - b0) / (b1 - b0);
      let k = mix(0x9aa0a8, 0x5a6068, t * 0.6 + (h > 12 ? 0.25 : 0) + nz(x, h) * 0.25);
      if (h <= 5) k = ((x + h) % 6) < 3 ? 0xe8b820 : 0x1e1e22;
      else if (h === 16 || h === 15) k = 0xd0d4dc;
      else if (h % 5 === 2 && x % 4 === 1) k = 0xc4c8d0;
      if (x === b1 || x === b1 - 1) k = mul(k, 0.7);
      put(x, h, k);
    }
    for (let x = b0 - 2; x < b0; x++) for (let h = 9; h <= 11; h++) put(x, h, 0x2a2b31);
    // varningsljuset på hyttaket
    const bx = s.beacon, b = ht[bx] + D;
    for (let i = -1; i <= 1; i++) { put(bx + i, b + 1, 0x2a2b31); put(bx + i, b + 2, i === 0 ? 0xffb050 : 0xe07a18); put(bx + i, b + 3, i === 0 ? 0xffd080 : 0xf09030); }
    put(bx, b + 4, 0xffe0a0);
  }

  // ---------- natt: bussens tända fönster ----------
  const N = s.bus ? new Pix(W, H) : null;
  if (N) for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    if (!onGlass(x, h)) continue;
    N.px(x + 1, gy - h, 0xffe2a0, occ[(gy - h) * W + x + 1] ? 0.12 : 0.5);
  }
  // ---------- bromsljusen (läggs över när bilen bromsar) ----------
  const O = new Pix(W, H);
  for (let x = 0; x < tl.w; x++) for (let h = tl.h0; h <= tl.h1; h++) if (get(x, h)) O.px(x + 1, gy - h, h === tl.h1 ? 0xffb0a0 : 0xff3a2a);
  // ---------- bussens öppna dörrar ----------
  const DP = s.bus ? new Pix(W, H) : null;
  if (DP) for (const [x0, x1] of s.doors) for (let x = x0; x <= x1; x++) for (let h = hb[x] + 1; h <= winTop; h++) {
    let k = mix(0x3a342c, 0x1e1a16, 1 - (h - 5) / 34 + (bayer(x, h) - 0.5) * 0.15);
    if (h >= winTop - 1) k = h === winTop ? 0xf8ecc0 : 0xc8b888;
    else if (h <= hb[x] + 3) k = h === hb[x] + 3 ? 0x9a968e : 0x5a5650;
    else if (x === x0 + 2) k = h % 6 === 0 ? 0xfff0a0 : 0xe8c440;
    if (x === x0 || x === x1) k = 0x1a1b20;
    DP.px(x + 1, gy - h, k);
  }

  // ---------- spegla och skriv text (text speglas aldrig) ----------
  const Q = mirrored(P), OQ = mirrored(O), NQ = N && mirrored(N), DQ = DP && mirrored(DP);
  const decal = (T0, flip) => {
    const T = (F, str, q, hTop, col, sh) => {
      const w = textW(F, str), x = flip ? W - (q + 1) - w : q + 1, y = gy - hTop;
      if (sh !== undefined) text(T0, F, str, x + 1, y + 1, sh);
      text(T0, F, str, x, y, col);
    };
    if (s.taxi) T(SMALL, 'TAXI', 19, 29, 0x2a2014);
    if (s.brand === 'pixelbud') { T(BIG, 'PIXELBUD', 3, 29, 0x1f4fa8, 0xb8c8e4); T(SMALL, 'LEVERANS', 9, 17, 0xffffff, 0xa85210); }
    if (s.brand === 'glass') T(BIG, 'GLASS', 13, 42, 0xd83a80);
    if (s.bus) { T(SMALL, 'PIXELTRAFIK', 36, 42, 0xa8261e, 0xd0d0c8); T(SMALL, 'TORGET', 67, 34, 0xffb22a); T(SMALL, '4', 95, 34, 0xffb22a); }
    if (s.blade) { T(SMALL, 'PIXELPLOG', 6, 27, 0xffffff, 0x2a2e36); T(SMALL, 'SALT', 26, 21, 0xe8e0c8); }
  };
  decal(P, false); decal(Q, true);
  // snötäcke och spegling (härleds ur den färdiga bilden, speglas med)
  const ov = overlays(P, gy), ovS = mirrored(ov.S), ovR = mirrored(ov.R);
  // vindrutan (för torkarna): x-spann och glasets höjd
  let ws = null;
  if (s.ws && !s.blade) {
    let top = 0;
    for (let x = s.ws[0]; x <= s.ws[1]; x++) for (let h = s.belt + 1; h <= gy; h++) if (get(x, h) === GLASS) top = Math.max(top, h);
    ws = { x0: s.ws[0], x1: s.ws[1], h0: s.belt + 1, h1: top };
  }
  const topH = Math.max(...ht) + D;
  return {
    W, H, gy, hb, topH, ws,
    img: [P.flush(), Q.flush()], brake: [O.flush(), OQ.flush()],
    night: N ? [N.flush(), NQ.flush()] : null, door: DP ? [DP.flush(), DQ.flush()] : null,
    snow: [ov.S.flush(), ovS.flush()], refl: [ov.R.flush(), ovR.flush()],
  };
}

// ---------- mopeden (sidan): liten skoter med förare i hjälm ----------
function paintMoped(color, variant) {
  const L = 28, gy = 27, W = L + 2, H = gy + 3;
  const P = new Pix(W, H);
  const put = (x, h, c, a = 1) => P.px(x + 1, gy - h, c, a);
  const R = { hi: mix(color, 0xffffff, 0.5), lt: mix(color, 0xffffff, 0.22), c: color, dk: mul(color, 0.65) };
  const rnd = (k) => hash(variant * 17 + k, color & 0xffff, 5);
  for (let x = 2; x < L - 2; x++) { put(x, 0, 0x08080e, 0.35); put(x, -1, 0x08080e, 0.15); }
  // bakskärm och framskärm
  for (let x = 1; x <= 9; x++) { const h = 8 - Math.round(Math.abs(x - 5) * 0.6); put(x, h, R.hi); put(x, h - 1, R.c); put(x, h - 2, R.dk, x > 2 && x < 8 ? 1 : 0); }
  for (let x = 19; x <= 26; x++) { const h = 8 - Math.round(Math.abs(x - 22.5) * 0.6); put(x, h, R.hi); put(x, h - 1, R.c); }
  // fotbräda, kåpa, sadel
  for (let x = 6; x <= 17; x++) { put(x, 6, 0x2a2c32); put(x, 5, 0x1a1c22); }
  for (let x = 9; x <= 16; x++) for (let h = 7; h <= 10; h++) put(x, h, h === 10 ? R.lt : mix(R.c, R.dk, (10 - h) / 4));
  for (let x = 8; x <= 17; x++) { put(x, 12, 0x1c1c22); put(x, 11, 0x2a2a32); }
  put(7, 11, 0x1c1c22); put(6, 10, 0x9a9ea6); put(6, 9, 0x9a9ea6);          // bagagehållare
  // benskydd, styre, spegel, lykta
  for (let h = 6; h <= 15; h++) { put(18, h, R.lt); put(19, h, R.c); put(20, h, R.dk); }
  for (let x = 17; x <= 23; x++) put(x, 16, 0x2a2c32);
  put(23, 17, 0x3a3c44); put(24, 17, 0x1a1c22); put(21, 18, 0x1a1c22); put(21, 19, 0xd8dce4); put(22, 19, 0xd8dce4);
  put(21, 13, 0xfff3c8); put(22, 13, 0xffffff); put(21, 12, 0xd8dce4); put(22, 12, 0xfff3c8); put(23, 12, 0xf0a030);
  put(1, 9, 0xd42a2a); put(1, 10, 0xff7766); put(2, 7, 0xeeeef2); put(3, 7, 0xeeeef2);
  for (let x = 2; x <= 9; x++) put(x, 4, x < 4 ? 0x4a4c54 : 0x8a8e96);
  // föraren
  const skin = SKINS[Math.floor(rnd(1) * SKINS.length)], jacket = SHIRTS[Math.floor(rnd(2) * SHIRTS.length)];
  const helmet = [0xe8e4dc, 0x2b2e36, 0xd9433b, 0x3a7bd5, 0xf2c230][variant % 5];
  for (let h = 7; h <= 13; h++) { put(12, h, 0x2c3040); put(13, h, 0x2c3040); }
  put(12, 6, 0x1a1a1e); put(13, 6, 0x1a1a1e); put(14, 6, 0x1a1a1e);
  for (let x = 11; x <= 15; x++) for (let h = 14; h <= 20; h++) put(x, h, x === 15 ? mul(jacket, 0.7) : x === 11 ? mix(jacket, 0xffffff, 0.2) : jacket);
  for (let x = 15; x <= 20; x++) put(x, 18 - Math.round((x - 15) * 0.4), jacket);
  put(20, 16, skin); put(21, 16, skin); put(13, 21, skin); put(14, 21, skin);
  for (let x = 10; x <= 16; x++) for (let h = 21; h <= 27; h++) {
    const d = Math.hypot(x - 13, h - 24.3);
    if (d > 3.4) continue;
    put(x, h, d > 2.7 ? mul(helmet, 0.7) : x + h < 35 ? mix(helmet, 0xffffff, 0.25) : helmet);
  }
  for (let x = 14; x <= 16; x++) put(x, 24, 0x1a1c22);
  put(15, 23, 0x1a1c22); put(16, 23, 0x2a3040); put(16, 24, 0x3a4a60);
  const Q = mirrored(P), O = new Pix(W, H);
  O.px(2, gy - 9, 0xff3a2a); O.px(2, gy - 10, 0xffb0a0);
  const OQ = mirrored(O), ov = overlays(P, gy), ovS = mirrored(ov.S), ovR = mirrored(ov.R);
  return { W, H, gy, hb: new Array(L).fill(3), topH: 28, ws: null, img: [P.flush(), Q.flush()], brake: [O.flush(), OQ.flush()], night: null, door: null, snow: [ov.S.flush(), ovS.flush()], refl: [ov.R.flush(), ovR.flush()] };
}

const VCACHE = {};
function vehicleArt(c) {
  const key = c.kind + ':' + c.color + ':' + c.variant + (c.rust ? ':r' : '');
  return VCACHE[key] || (VCACHE[key] = c.kind === 'moped' ? paintMoped(c.color, c.variant) : paintVehicle(c.kind, c.color, c.variant, { rust: c.rust }));
}

// ======================================================================
// Fordon sedda framifrån/bakifrån (Infarten och parkeringsrutorna)
// ======================================================================
// w = karossens bredd, hb = karossens höjd, belt = fönsterlinje, hood = rader
// av huv/bakluckedäck som syns uppifrån, roof = takrader, taper = hur mycket
// hytten är smalare per sida, mirror = spegelhöjd.
const END = {
  sedan: { w: 24, hb: 22, belt: 13, hood: 3, roof: 3, taper: 2, mirror: 15, hatch: false },
  halvkombi: { w: 24, hb: 21, belt: 12, hood: 3, roof: 3, taper: 2, mirror: 14, hatch: true },
  pickup: { w: 26, hb: 25, belt: 15, hood: 4, roof: 3, taper: 2, mirror: 17, bed: true, chrome: true },
  skapbil: { w: 26, hb: 34, belt: 18, winTop: 29, hood: 2, roof: 3, taper: 1, mirror: 19, box: true, dark: true },
};
END.taxi = { ...END.sedan, taxi: true };
const END_L = 30; // så många px längs vägen upptar en bil sedd fram-/bakifrån

function paintEnd(kind, color, variant, rear, rust) {
  const e = END[kind], w = e.w, hb = e.hb, tp = e.taper;
  const OX = 3, W = w + 2 * OX, H = hb + e.roof + (e.taxi ? 4 : 0) + 6, gy = H - 3;
  const M = new Uint8Array(W * H);
  const ok = (x, h) => x >= -OX && x < w + OX && h >= -2 && h <= gy;
  const get = (x, h) => (ok(x, h) ? M[(gy - h) * W + x + OX] : 0);
  const set = (x, h, v) => { if (ok(x, h)) M[(gy - h) * W + x + OX] = v; };
  const rnd = (k) => hash(variant * 13 + k, color & 0xffff, kind.length + (rear ? 50 : 0));
  // regioner
  for (const wx0 of [2, w - 5]) for (let x = wx0; x < wx0 + 3; x++) for (let h = 0; h <= 5; h++) set(x, h, ARCH);
  for (let x = 0; x < w; x++) for (let h = 3; h <= 6; h++) if (!(h === 3 && (x === 0 || x === w - 1))) set(x, h, BUMP);
  for (let x = 0; x < w; x++) for (let h = 7; h <= e.belt; h++) set(x, h, BODY);
  const hood = rear && e.hatch ? 1 : rear && e.box ? 0 : e.hood;
  const hoodTop = e.belt + hood;
  for (let x = 1; x < w - 1; x++) for (let h = e.belt + 1; h <= hoodTop; h++) set(x, h, rear ? BODY : TOPB);
  const glassTop = e.winTop ?? hb - 1;
  if (e.bed && rear) {
    // flaket: bakläm nertill, flakkanten, hytten längre bak med bakruta
    for (let x = 0; x < w; x++) for (let h = 7; h <= 15; h++) set(x, h, BODY);
    for (let x = 1; x < w - 1; x++) set(x, 16, TRIM);
    for (let x = tp + 1; x < w - 1 - tp; x++) for (let h = 17; h <= hb - 1; h++) set(x, h, h >= 19 && h <= hb - 2 && x > tp + 1 && x < w - 2 - tp ? GLASS : BODY);
  } else if (e.box && rear) {
    // skåpets bakdörrar: två halvor med fog, små rutor upptill
    for (let x = 0; x < w; x++) for (let h = 7; h <= hb - 1; h++) set(x, h, BODY);
    for (let h = 7; h <= hb - 1; h++) { set((w >> 1) - 1, h, TRIM); set(w >> 1, h, TRIM); }
    for (const x0 of [3, (w >> 1) + 2]) for (let x = x0; x < x0 + (w >> 1) - 5; x++) for (let h = 23; h <= 29; h++) set(x, h, GLASS);
  } else {
    for (let x = tp; x < w - tp; x++) for (let h = hoodTop + 1; h <= hb - 1; h++) {
      const edge = x === tp || x === w - 1 - tp;
      set(x, h, h > glassTop ? BODY : edge ? TRIM : GLASS);
    }
    if (e.box) for (let x = 1; x < w - 1; x++) for (let h = glassTop + 1; h <= hb - 1; h++) set(x, h, BODY);
  }
  for (let x = tp + 1; x < w - 1 - tp; x++) for (let h = hb; h < hb + e.roof; h++) set(x, h, TOPR);
  for (const mx of [-2, w + 1]) { set(mx, e.mirror, BODY); set(mx, e.mirror + 1, BODY); }
  set(-1, e.mirror + 1, TRIM); set(w, e.mirror + 1, TRIM);

  // målning
  const P = new Pix(W, H);
  const put = (x, h, c, a = 1) => P.px(x + OX, gy - h, c, a);
  const cur = (x, h) => P.get(x + OX, gy - h);
  const nz = (x, h) => bayer(x + OX, gy - h) - 0.5;
  const c = rust ? mix(color, 0x8a8a84, 0.3) : color;
  const R = { hi: mix(c, 0xffffff, rust ? 0.35 : 0.55), lt: mix(c, 0xffffff, 0.24), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
  for (let x = 0; x < w; x++) { put(x, 0, 0x08080e, x < 2 || x > w - 3 ? 0.2 : 0.42); put(x, -1, 0x08080e, 0.18); put(x, 1, 0x0e0e12, x > 4 && x < w - 5 ? 0.8 : 0.3); put(x, 2, 0x0e0e12, x > 4 && x < w - 5 ? 0.8 : 0.3); }
  for (let x = -OX; x < w + OX; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const n = nz(x, h);
    let col = c;
    if (r === BODY) {
      const t = Math.max(0, Math.min(1, (h - 7) / Math.max(1, e.belt - 7)));
      col = rear ? mix(R.dd, R.md, t * 0.9 + n * 0.3) : mix(R.md, R.lt, t * 0.9 + n * 0.3);
      if (h === e.belt) col = rear ? R.lt : R.hi;
      if (h === 7) col = R.dd;
      if (h > e.belt) col = rear ? mix(R.md, R.lt, 0.4 + n * 0.3) : col;
      if (x === 0) col = mix(col, 0xffffff, 0.22); else if (x === w - 1) col = mul(col, 0.7);
      if (hash(x, h, 7) > 0.95) col = mul(col, 1.06);
    } else if (r === BUMP) {
      if (e.chrome && !rust) col = h === 6 ? 0xf2f4f8 : h > 3 ? mix(0xc4c8d0, 0x8a8e96, n + 0.5) : 0x5a5e66;
      else if (e.dark || rust) col = h === 6 ? 0x4a4c54 : mix(0x2a2b31, 0x1c1d22, n + 0.5);
      else col = h <= 4 ? 0x26272c : mul(c, 0.94);
    } else if (r === TOPB) {
      const k = h - e.belt;
      col = mix(c, 0xffffff, k === hood ? 0.42 : 0.26 + 0.04 * k + n * 0.1);
    } else if (r === TOPR) {
      const k = h - hb;
      col = mix(c, 0xffffff, k === e.roof - 1 ? 0.46 : 0.32 + 0.04 * k + n * 0.1);
    } else if (r === GLASS) {
      const t = (h - hoodTop) / Math.max(1, glassTop - hoodTop);
      col = rear ? mix(0x2c3d52, 0x5a7792, t * 0.7 + n * 0.25) : mix(0x5a7792, 0x1c2633, t * 0.9 + n * 0.25);
      const st = (((x - h) % 13) + 13) % 13;
      if (st < 2) col = mix(col, 0xe6f2ff, 0.4); else if (st === 3) col = mix(col, 0xe6f2ff, 0.15);
    } else if (r === TRIM) {
      col = mix(0x18191e, 0x2a2b31, n + 0.5);
    } else if (r === ARCH) {
      col = h === 0 ? 0x0a0a0c : (x === 2 || x === w - 5) && h > 1 && h < 5 ? 0x3a3a42 : h === 5 ? 0x26262c : 0x151518;
      if (h === 2 || h === 3) { if (x === 3 || x === w - 4) col = 0x4a4e56; }
    }
    put(x, h, col);
  }
  // rost
  if (rust) for (let x = 0; x < w; x++) for (let h = 3; h <= e.belt + hood; h++) {
    const r = get(x, h);
    if (r !== BODY && r !== BUMP && r !== TOPB) continue;
    const n = hash(x >> 1, h >> 1, 71 + variant) * 0.7 + hash(x, h, 72) * 0.3;
    if (n > 1 - (h < 10 ? 0.22 : 0.1)) put(x, h, mix(0x6e3414, 0xa8582a, hash(x, h, 73)), 0.85);
  }
  // figurer bakom rutan (föraren till höger framifrån, till vänster bakifrån)
  const onGlass = (x, h) => get(x, h) === GLASS;
  const figure = (pat, x0, hTop, pal, tint = 0.3) => pat.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i], x = x0 + i, h = hTop - j; if (ch !== '.' && onGlass(x, h)) put(x, h, mix(pal[ch], cur(x, h), tint)); } });
  const person = (x0, hTop, k, back) => figure(back ? HEAD_BACK : HEAD, x0, hTop, { h: HAIRS[Math.floor(rnd(k + 1) * HAIRS.length)], s: SKINS[Math.floor(rnd(k) * SKINS.length)], t: SHIRTS[Math.floor(rnd(k + 2) * SHIRTS.length)] });
  const gt = Math.min(glassTop, hb - 2);
  if (!(e.box && rear)) {
    person(rear ? (w >> 1) - 5 : (w >> 1) + 1, gt - 1, 10, rear);
    if (rnd(20) < 0.5) person(rear ? (w >> 1) + 1 : (w >> 1) - 5, gt - 2, 30, rear);
  }
  // kontur
  const solid = (x, h) => get(x, h) !== 0;
  for (let x = -OX; x < w + OX; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const u = !solid(x, h + 1), dn = !solid(x, h - 1), l = !solid(x - 1, h), rt = !solid(x + 1, h);
    if (u || dn || l || rt) { const k = cur(x, h); put(x, h, u && !dn ? mix(mul(k, 0.5), 0x161620, 0.4) : mix(mul(k, 0.38), 0x0a0a10, 0.5)); }
  }
  // lyktor, skylt, grill / baklyktor, avgasrör
  const mid = w >> 1;
  if (!rear) {
    for (const x0 of [2, w - 6]) for (let x = x0; x < x0 + 4; x++) for (let h = 9; h <= 11; h++) put(x, h, h === 11 ? 0xffffff : x === x0 || x === x0 + 3 ? 0xd8dde6 : 0xfff3c8);
    for (const x of [1, w - 2]) put(x, 8, 0xf0a030);
    for (let x = mid - 5; x <= mid + 4; x++) for (let h = 9; h <= 12; h++) put(x, h, h % 2 ? 0x1a1b20 : 0x34363c);
    put(mid - 1, 11, 0xd8dce4); put(mid, 11, 0xd8dce4);
    for (let x = mid - 3; x <= mid + 2; x++) { put(x, 7, 0xeeeef2); put(x, 8, x === mid - 3 || x === mid + 2 ? 0x1a1b20 : 0xdcdee2); }
  } else {
    for (const x0 of [1, w - 5]) for (let x = x0; x < x0 + 4; x++) for (let h = 8; h <= 11; h++) put(x, h, h === 11 ? 0xff7766 : h === 8 ? 0x8a1a1a : 0xd42a2a);
    put(4, 10, 0xeeeef2); put(w - 5, 10, 0xeeeef2);
    for (let x = mid - 3; x <= mid + 2; x++) { put(x, 7, 0xeeeef2); put(x, 8, x === mid - 3 || x === mid + 2 ? 0x1a1b20 : 0xdcdee2); }
    put(3, 2, 0x8a8e96); put(4, 2, 0x4a4c54);
    if (e.hatch) for (let x = mid - 2; x <= mid + 1; x++) put(x, e.belt - 1, 0xe6e9ee);
    if (e.bed) for (let x = 2; x < w - 2; x++) { put(x, 11, mul(cur(x, 11), 0.7)); put(x, 12, mix(cur(x, 12), 0xffffff, 0.15)); }
    if (e.box) for (const x of [2, w - 3]) for (const h of [10, 20, 30]) { put(x, h, 0x1a1b20); put(x, h + 1, 0x4a4c54); }
  }
  if (e.box) for (let x = 0; x < w; x++) for (let h = 12; h <= 18; h++) if (get(x, h) === BODY) put(x, h, h === 18 ? 0xffb85a : h === 12 ? 0xb85e10 : mix(0xf59030, 0xe07a18, (17 - h) / 5 + nz(x, h) * 0.3));
  if (e.taxi) {
    for (let x = mid - 4; x <= mid + 3; x++) for (let h = hb + e.roof; h < hb + e.roof + 3; h++) put(x, h, x === mid - 4 || x === mid + 3 || h === hb + e.roof + 2 ? 0x3a3222 : h === hb + e.roof ? 0xf2d27a : 0xfff0b0);
    for (let x = mid - 3; x <= mid + 2; x++) put(x, hb + e.roof - 1, 0x0a0a10, 0.4);
    for (let x = 2; x < w - 2; x++) put(x, 8, (x + 8) & 1 ? 0x1a1a1e : 0xf4f4f0);
  }
  // bromsljus (bakifrån), snö, spegling
  const O = new Pix(W, H);
  if (rear) for (const x0 of [1, w - 5]) for (let x = x0; x < x0 + 4; x++) for (let h = 8; h <= 11; h++) O.px(x + OX, gy - h, h === 11 ? 0xffb0a0 : 0xff3a2a);
  const ov = overlays(P, gy);
  return { W, H, gy, ox: OX, img: P.flush(), brake: rear ? O.flush() : null, snow: ov.S.flush(), refl: ov.R.flush(), head: [4, w - 4], lampH: 10 };
}
const ECACHE = {};
const endArt = (c, rear) => { const key = c.kind + ':' + c.color + ':' + c.variant + ':' + (rear ? 'b' : 'f') + (c.rust ? 'r' : ''); return ECACHE[key] || (ECACHE[key] = paintEnd(c.kind, c.color, c.variant, rear, c.rust)); };

// ---------- hjulen: åtta rotationslägen per fälgtyp ----------
const NF = 8;
const RIMN = { alloy: 5, steel: 6, white: 6, bus: 8, rust: 6, moped: 6 };
function paintWheel(r, style, f) {
  const n = RIMN[style], rot = (f / NF) * ((Math.PI * 2) / n);
  const S = 2 * r + 1, P = new Pix(S, S), rimR = r - 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - r, dy = j - r, d = Math.hypot(dx, dy);
    if (d > r + 0.4) continue;
    const a = Math.atan2(dy, dx), lit = -(dx + dy) / (2 * r); // ljuset uppifrån vänster
    let k;
    if (d > rimR + 0.45) {
      // däcket: slitbana ytterst, sidan närmast fälgen, mönster som snurrar
      k = d > r - 0.5 ? 0x121215 : d < rimR + 1.4 ? 0x2b2b31 : 0x1c1c21;
      if (d > r - 1.3 && Math.cos(2 * n * (a - rot)) > 0.55) k = mix(k, 0x3a3a42, 0.5);
      if (lit > 0.42 && d > r - 1.6) k = 0x46464e;
    } else if (d > rimR - 0.6) {
      k = style === 'rust' ? (lit > 0.1 ? 0x8a8078 : 0x4a4640) : lit > 0.1 ? 0xe4e8ee : lit < -0.2 ? 0x7a7e86 : 0xb0b4bc;   // fälgkanten
    } else if (style === 'alloy') {
      const spoke = Math.cos(n * (a - rot)) > 0.2;
      k = d < 0.8 ? 0x4a4e56 : d < 1.3 ? 0x8a8e96 : spoke ? mix(0xd2d6de, 0x8a9098, 0.5 - lit) : 0x26282e;
    } else if (style === 'bus') {
      k = mix(0xb4bac2, 0x80868e, 0.5 - lit);
      if (Math.abs(d - (rimR - 1)) < 0.6 && Math.cos(n * (a - rot)) > 0.6) k = 0x3a3e44;
      if (Math.abs(d - 1.8) < 0.55 && Math.cos(n * (a - rot) + Math.PI) > 0.5) k = 0x5a5e66;
      if (d < 0.9) k = 0xe0e4ea;
    } else if (style === 'rust') {
      // bar stålfälg utan navkapsel, rostbrun
      k = mix(0x6a5a4a, 0x3a3230, 0.5 - lit);
      if (Math.abs(d - rimR * 0.6) < 0.75 && Math.cos(n * (a - rot)) > 0.5) k = 0x241e1a;
      if (d < 1.2) k = 0x8a7a6a;
    } else {
      const white = style === 'white';
      k = white ? mix(0xf0f0ec, 0xbcbcb6, 0.5 - lit) : mix(0x8c9098, 0x60646c, 0.5 - lit);
      if (Math.abs(d - rimR * 0.62) < 0.75 && Math.cos(n * (a - rot)) > 0.55) k = 0x24262a;
      if (d < 1.2) k = white ? 0xd8dce2 : 0xd4d8de;
      if (d < 0.5) k = 0x8a8e96;
    }
    P.px(i, j, k);
  }
  return P.flush();
}
const WCACHE = {};
const wheelArt = (r, style, f) => { const k = r + style + f; return WCACHE[k] || (WCACHE[k] = paintWheel(r, style, f)); };

// ======================================================================
// Trafikljusstolpar
// ======================================================================
const LAMP7 = ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'];
const MAN_STAND = ['..###..', '..###..', '.#####.', '#.###.#', '#.###.#', '..###..', '..#.#..', '..#.#..', '..#.#..'];
const MAN_WALK = ['...##..', '...##..', '..####.', '.#.###.', '#..##.#', '...##..', '..#..#.', '.#....#', '#......'];
const LAMPC = { r: 0xff3a28, y: 0xffc21e, g: 0x3dff9a, pr: 0xff4a36, pg: 0x7dffb8 };
// lampornas höjd över stolpens fot (för glöden)
const LAMP_H = { g: 54, y: 63, r: 72, pg: 27, pr: 38 };

const PCACHE = {};
// cs: 'r' | 'ry' | 'g' | 'y' | 'yb' (trasig, gult blinkar) | 'o' (släckt)   ps: 'r' | 'g' | 'x' | 'o'
function poleArt(side, name, cs, ps, broken = false) {
  const key = side + (name || '') + cs + ps + (broken ? 'B' : '');
  if (PCACHE[key]) return PCACHE[key];
  const tw = name ? textW(SMALL, name) : 0, plate = name ? tw + 8 : 0;
  const PX = 7, W = PX + 8 + plate, H = 99, FY = 96;
  const P = new Pix(W, H);
  const at = (dx, h, c, a = 1) => P.px(PX + dx, FY - h, c, a);
  const nz = (dx, h) => bayer(PX + dx, FY - h) - 0.5;
  // skugga på trottoaren
  P.ell(PX + 0.5, FY + 0.5, 8, 2.6, 0x0a0a14, 0.42, 4);
  // betongsockel
  for (let h = 0; h <= 3; h++) for (let dx = -3; dx <= 3; dx++) {
    let k = h === 3 ? 0xd2cec4 : mix(0xa6a298, 0xb8b4aa, nz(dx, h) + 0.5);
    if (dx === -3) k = 0xc8c4ba;
    if (dx === 3) k = 0x6e6a62;
    if (h === 0) k = 0x5a564e;
    if (broken && hash(dx, h, 12) > 0.7) k = mul(k, 0.8);
    at(dx, h, k);
  }
  for (let h = 0; h <= 3; h++) { at(-4, h, 0x3a3832); at(4, h, 0x3a3832); }
  // stolpen (galvaniserad, rund: ljus vänsterkant, mörk högerkant)
  for (let h = 4; h <= 84; h++) {
    let m = mix(0x7c828a, 0x8a9098, nz(0, h) + 0.5), l = 0xa4aab2, d = 0x4c5158;
    if (broken && hash(0, h >> 1, 13) > 0.72) { m = 0x7a5a3a; l = 0x9a7a5a; d = 0x4a3a2a; }   // rostfläckar
    at(-1, h, l); at(0, h, m); at(1, h, d);
    at(-2, h, 0x2a2e34); at(2, h, 0x24272c);
  }
  for (const h of [7, 46, 79]) for (let dx = -2; dx <= 2; dx++) at(dx, h, dx === -2 ? 0x8a9098 : dx === 2 ? 0x2a2e34 : 0x5a6068);
  at(-1, 85, 0x5a6068); at(0, 85, 0xb8bec6); at(1, 85, 0x3a3e44); at(0, 86, 0x2a2e34);
  if (broken) { // klistermärken och en tagg på stolpen
    for (let h = 30; h <= 33; h++) for (let dx = -2; dx <= 2; dx++) at(dx, h, h === 33 ? 0xe8e0d0 : (dx + h) % 3 ? 0x2a6aa8 : 0xf4c030);
    for (let h = 62; h <= 66; h++) at(-2 + (h % 2), h, 0xd83aa0);
  }

  // tryckknappslåda (gul, med pil och VÄNTA-lampa)
  for (let h = 10; h <= 19; h++) for (let dx = -3; dx <= 3; dx++) {
    let k = mix(0xf2c230, 0xd8a418, (19 - h) / 9 + nz(dx, h) * 0.2);
    if (dx === -3) k = 0xffe483;
    if (dx === 3) k = 0xa87c10;
    if (h === 19) k = 0xffeaa0;
    if (h === 10) k = 0x7a5a0c;
    if (broken && hash(dx, h, 14) > 0.8) k = 0x6a4a1a;
    at(dx, h, k);
  }
  for (let h = 10; h <= 19; h++) { at(-4, h, 0x2a2210); at(4, h, 0x2a2210); }
  for (let dx = -3; dx <= 3; dx++) { at(dx, 20, 0x2a2210); at(dx, 9, 0x2a2210); }
  for (let h = 12; h <= 16; h++) for (let dx = -2; dx <= 2; dx++) at(dx, h, 0x18181c);
  const ad = side === 'n' ? 1 : -1;
  if (!broken) {
    for (let dx = -2; dx <= 2; dx++) at(dx, 14, 0xf4f4f0);
    at(ad, 15, 0xf4f4f0); at(ad, 13, 0xf4f4f0); at(0, 16, 0xf4f4f0); at(0, 12, 0xf4f4f0); at(-2 * ad, 14, 0x18181c);
  } else { // knappen utsliten, sprucken skylt
    at(-1, 14, 0x6a6a68); at(0, 14, 0x8a8a88); at(1, 15, 0x6a6a68); at(-2, 12, 0x3a3a3c);
  }
  for (let dx = -1; dx <= 1; dx++) at(dx, 18, ps === 'r' ? (dx === 0 ? 0xffb0a0 : 0xff5a40) : 0x5a1a14);

  // fotgängarsignalen
  for (let h = 21; h <= 44; h++) for (let dx = -4; dx <= 4; dx++) at(dx, h, dx === -4 ? 0x3a3c44 : dx === 4 ? 0x0e0f12 : 0x1e1f25);
  for (let h = 21; h <= 44; h++) { at(-5, h, 0x08080a); at(5, h, 0x08080a); }
  for (let dx = -4; dx <= 4; dx++) at(dx, 20, 0x08080a);
  const win = (h0, pat, col, on) => {
    for (let j = 0; j < 9; j++) for (let i = 0; i < 7; i++) {
      const lit = pat[j][i] === '#';
      let k = 0x0a0a0c;
      if (lit) k = on ? (j < 2 ? mix(col, 0xffffff, 0.45) : mix(col, 0xffffff, 0.15)) : mix(mul(col, 0.2), 0x0a0a0c, 0.4);
      if (broken && lit && hash(i, j + h0, 15) > 0.6) k = 0x0a0a0c;   // trasiga lysdioder
      at(i - 3, h0 + 8 - j, k);
    }
  };
  win(34, MAN_STAND, LAMPC.pr, ps === 'r');
  win(23, MAN_WALK, LAMPC.pg, ps === 'g');
  for (let dx = -5; dx <= 5; dx++) { at(dx, 33, 0x2e3038); at(dx, 44, 0x2e3038); at(dx, 45, 0x44464e); }
  at(-5, 33, 0x08080a); at(5, 33, 0x08080a);
  if (broken) { // krossat glas: spricka snett över
    for (let k = 0; k < 8; k++) at(-3 + k, 42 - k * 2, 0xc8d8e8, 0.7);
    for (let k = 0; k < 4; k++) at(1 + k, 30 - k, 0xc8d8e8, 0.6);
  }

  // bilsignalen: svart skiva med gul kant, tre lampor under skärmtak
  for (let h = 47; h <= 78; h++) for (let dx = -6; dx <= 6; dx++) {
    const out = dx === -6 || dx === 6 || h === 47 || h === 78;
    const ring = dx === -5 || dx === 5 || h === 48 || h === 77;
    let k = 0x17181c;
    if (out) k = 0x0a0a0c;
    else if (ring) k = dx === -5 || h === 77 ? 0xffe070 : dx === 5 || h === 48 ? 0xb88c18 : 0xf2c230;
    else if (dx === -4 || dx === 4 || h === 49 || h === 76) k = dx === -4 ? 0x30323a : 0x101114;
    if (broken && ring && hash(dx, h, 16) > 0.75) k = 0x3a3220;     // flagnad gul kant
    at(dx, h, k);
  }
  const lamp = (cy, col, on) => {
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      if (LAMP7[j][i] !== '#') continue;
      const d = Math.hypot(i - 2.4, j - 2.4);
      let k;
      if (on) k = d < 1.2 ? mix(col, 0xffffff, 0.8) : d < 2.3 ? mix(col, 0xffffff, 0.35) : d < 3.4 ? col : mul(col, 0.75);
      else k = d < 1.1 ? mix(mul(col, 0.3), 0xffffff, 0.14) : mix(mul(col, 0.2), 0x101014, 0.4);
      if (j === 0) k = mul(k, 0.7);
      at(i - 3, cy + 3 - j, k);
    }
    for (let dx = -4; dx <= 4; dx++) at(dx, cy + 4, dx === -4 ? 0x3a3c44 : 0x0c0c0e);  // skärmtak
  };
  lamp(LAMP_H.r, LAMPC.r, cs === 'r' || cs === 'ry');
  lamp(LAMP_H.y, LAMPC.y, cs === 'y' || cs === 'ry' || cs === 'yb');
  lamp(LAMP_H.g, LAMPC.g, cs === 'g');
  if (broken) { // sprejad tagg tvärs över signalen
    text(P, SMALL, 'ZOK', PX - 5, FY - 60, 0x3a9bff, 0.85);
    at(-4, 74, 0xe8443a); at(-3, 75, 0xe8443a); at(3, 52, 0xe8443a); at(4, 51, 0xe8443a);
  }

  // gatuskylt (bara på norra stolpen)
  if (name) {
    const x0 = 2, x1 = 2 + plate - 1;
    for (let h = 80; h <= 90; h++) for (let dx = x0; dx <= x1; dx++) {
      const outer = dx === x0 || dx === x1 || h === 80 || h === 90;
      const inner = dx === x0 + 1 || dx === x1 - 1 || h === 81 || h === 89;
      at(dx, h, outer ? 0x0d2448 : inner ? 0xf2f4f8 : mix(0x2f66be, 0x1d4a92, (90 - h) / 8 + nz(dx, h) * 0.25));
    }
    for (const h of [83, 87]) { at(1, h, 0x2a2e34); at(2, h, 0x5a6068); }
    text(P, SMALL, name, PX + x0 + 4, FY - 87, 0xffffff);
  }
  return (PCACHE[key] = { img: P.flush(), px: PX, fy: FY });
}

// ======================================================================
// Ljussken (ritas efter mörkret med 'lighter')
// ======================================================================
const GCACHE = {};
function blob(key, col, rx, ry, amax, core) {
  if (GCACHE[key]) return GCACHE[key];
  const ox = Math.ceil(rx), oy = Math.ceil(ry);
  const P = new Pix(ox * 2 + 1, oy * 2 + 1);
  P.ell(ox + 0.5, oy + 0.5, rx, ry, col, amax, 5);
  if (core) for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (LAMP7[j][i] === '#') P.px(ox - 3 + i, oy - 3 + j, mix(col, 0xffffff, 0.45), 0.85);
  return (GCACHE[key] = { img: P.flush(), ox, oy });
}
// strålkastarnas kägla: från lampan framåt och ner mot vägen
function beam(dir) {
  const key = 'beam' + dir;
  if (GCACHE[key]) return GCACHE[key];
  const len = 66, H = 16, row = 4;
  const P = new Pix(len, H);
  for (let i = 0; i < len; i++) {
    const fall = 1 - i / len, cy = row + i * 0.15, hw = 1.3 + i * 0.12;
    for (let j = 0; j < H; j++) {
      const t = Math.abs(j + 0.5 - cy) / hw;
      if (t >= 1) continue;
      const a = 0.42 * fall * fall * (1 - t * t);
      const q = Math.round(a * 10 + bayer(i, j) - 0.5) / 10;
      if (q > 0) P.px(dir > 0 ? i : len - 1 - i, j, 0xfff0c8, q);
    }
  }
  return (GCACHE[key] = { img: P.flush(), row, len });
}
// lodrät kägla (Infarten): från lampan nedåt mot kameran
function vbeam() {
  if (GCACHE.vbeam) return GCACHE.vbeam;
  const W = 34, H = 30, P = new Pix(W, H);
  for (let j = 0; j < H; j++) {
    const fall = 1 - j / H, hw = 5 + j * 0.4;
    for (let i = 0; i < W; i++) {
      const t = Math.abs(i + 0.5 - W / 2) / hw;
      if (t >= 1) continue;
      const q = Math.round(0.34 * fall * (1 - t * t) * 10 + bayer(i, j) - 0.5) / 10;
      if (q > 0) P.px(i, j, 0xfff0c8, q);
    }
  }
  return (GCACHE.vbeam = { img: P.flush(), ox: W >> 1 });
}

// ======================================================================
// Trafiken
// ======================================================================
const CYCLE = 15.5;          // grönt 7 → gult 1,5 → rött 7 (sista sekunden rött+gult)
const PED_ON = 9.1, PED_OFF = 14.3, PED_BLINK = 12.3;
const B = 48;                // mjuk inbromsning (px/s²)
const ACC = 34;              // acceleration (px/s²)
const GAP = 6;               // avstånd i kö (px)
const M = 40;                // hur långt utanför världen fordonen kör innan de försvinner/dyker upp

// Vägmodellen: a = koordinaten längs vägen (x för vågräta, y för Infarten), cross = tvärs.
// Ett fordons s = hur långt det kommit i sin körriktning (fronten): frontA = a0 + s (dir +1) eller a1 − s (dir −1).
const RM = ROADS.map((r) => {
  const ax = r.axis === 'x';
  return {
    r, id: r.id, axis: r.axis, a0: ax ? r.x0 : r.y0, a1: ax ? r.x1 : r.y1, len: ax ? r.x1 - r.x0 : r.y1 - r.y0,
    c0: ax ? r.y0 : r.x0, c1: ax ? r.y1 : r.x1,
    lanes: r.lanes.map((l, i) => ({ i, dir: l.dir, cross: ax ? l.y : l.x })),
    crosswalks: r.crosswalks || [], stops: r.stops || [], light: r.traffic === 'light',
  };
});
const rmById = (id) => RM.find((m) => m.id === id) || null;
// hur många fordon per körfält (bussen och plogen kommer utöver)
const TARGET = { pixelgatan: [4, 4], sodergatan: [3, 3], infarten: [0, 0] };
const KINDS = [['sedan', 30], ['halvkombi', 24], ['taxi', 10], ['skapbil', 10], ['pickup', 9], ['glassbil', 6], ['moped', 7]];

// Förhandsvisning (verktyg): alla fordonstyper åt båda hållen, fram-/bakifrån, rost, plog, moped och stolparnas lägen på ett ark.
export function trafficSheet() {
  const rows = [['sedan', 0xc23a32, 0], ['sedan', 0x2b2e36, 1], ['halvkombi', 0x2f6db5, 0], ['halvkombi', 0xe9e9eb, 2], ['taxi', 0xf2c230, 0],
    ['pickup', 0x3d6b45, 0], ['pickup', 0xa83232, 1], ['skapbil', 0xeceef1, 0], ['glassbil', 0xf7f2e6, 0], ['buss', 0xc8352e, 0],
    ['plog', 0xe0761e, 0], ['sedan', 0x8a4a3a, 1, true], ['pickup', 0x5e6a5e, 2, true], ['moped', 0xd9433b, 0], ['moped', 0x3a7bd5, 3]];
  const cv = document.createElement('canvas'); cv.width = 620; cv.height = 12 + rows.length * 62 + 110;
  const x = cv.getContext('2d');
  x.fillStyle = '#4a4c52'; x.fillRect(0, 0, cv.width, cv.height);
  rows.forEach(([k, col, v, rust], i) => {
    const A = vehicleArt({ kind: k, color: col, variant: v, rust: !!rust }), s = SPECS[k], y = 12 + i * 62 + 56;
    for (let f = 0; f < 2; f++) {
      const x0 = 10 + f * 200;
      x.drawImage(A.img[f], x0 - 1, y - 1 - A.gy);
      const w = wheelArt(s.r, rust ? 'rust' : s.rim, (i * 3) % NF);
      for (const wx of s.wheels) x.drawImage(w, x0 + (f ? s.L - 1 - wx : wx) - s.r, y - 1 - 2 * s.r);
      if (f === 1 && A.door) for (const [d0, d1] of s.doors) { const q0 = s.L - 1 - d1, w2 = d1 - d0 + 1; x.drawImage(A.door[1], 1 + q0, A.gy - s.winTop, w2, s.winTop - A.hb[d0], x0 + q0, y - 1 - s.winTop, w2, s.winTop - A.hb[d0]); }
      if (f === 1) { x.drawImage(A.snow[f], x0 - 1, y - 1 - A.gy); x.drawImage(A.refl[f], x0 - 1, y + 1); }
    }
    if (END[k]) for (let f = 0; f < 2; f++) { const E = endArt({ kind: k, color: col, variant: v, rust: !!rust }, f === 1); x.drawImage(E.img, 420 + f * 50 - E.ox, y - E.gy); if (f) x.drawImage(E.snow, 420 + f * 50 - E.ox, y - E.gy); }
  });
  const states = [['r', 'r'], ['ry', 'r'], ['g', 'r'], ['y', 'r'], ['r', 'g'], ['r', 'x'], ['yb', 'o', true], ['o', 'o', true]];
  states.forEach(([cs, ps, br], i) => { const A = poleArt(i ? 's' : 'n', i ? null : 'PARKGATAN', cs, ps, !!br); x.drawImage(A.img, 20 + i * 36 - A.px, cv.height - 6 - A.fy); });
  for (let f = 0; f < NF; f++) ['alloy', 'steel', 'white', 'bus', 'rust'].forEach((st, j) => x.drawImage(wheelArt(st === 'bus' ? 7 : st === 'alloy' ? 5 : 6, st, f), 320 + f * 18, cv.height - 100 + j * 18));
  return cv;
}

export function createTraffic(env) {
  let T = 0, lastHonk = -99, frame = 0;
  const cars = [], puffs = [], ghosts = [];
  const rand = Math.random;
  const I = rmById('infarten'), PG = rmById('pixelgatan'), SG = rmById('sodergatan');

  // vädret just nu (tåligt: fungerar även utan weather.js – då bara env.rain)
  const wx = () => {
    const w = env.weather;
    return w ? { kind: w.kind, k: w.intensity ?? 0.7, snow: w.snowCover || 0, wet: w.wet || 0, wind: w.wind || 0, season: w.season || 'sommar', temp: w.temp ?? 15 }
      : { kind: env.rain ? 'regn' : 'sol', k: 0.7, snow: 0, wet: env.rain ? 0.8 : 0, wind: 0, season: 'sommar', temp: 15 };
  };

  // ---------- trafikljusen ----------
  const phase = (i) => (((T + i * 5.3 + 2) % CYCLE) + CYCLE) % CYCLE;
  const cwOf = (i) => CROSSWALKS_ALL[i] || null;
  const lit = (i) => { const cw = cwOf(i); return !!(cw && cw.lights && !cw.broken); };
  const carLight = (i) => {
    if (!lit(i)) return cwOf(i)?.broken ? (Math.floor(T * 1.7) % 2 ? 'yb' : 'o') : 'o';
    const p = phase(i); return p < 7 ? 'g' : p < 8.5 ? 'y' : p < 14.5 ? 'r' : 'ry';
  };
  const pedLight = (i) => {
    if (!lit(i)) return 'g';
    const p = phase(i);
    if (p < PED_ON || p >= PED_OFF) return 'r';
    if (p >= PED_BLINK) return Math.floor(p * 4) % 2 === 0 ? 'g' : 'x';
    return 'g';
  };
  const pedGreen = (i) => (lit(i) ? (phase(i) >= PED_ON && phase(i) < PED_OFF) : true);

  // ---------- geometri ----------
  const frontA = (c) => c.road.a0 + (c.dir > 0 ? c.s : c.road.len - c.s);
  const lo = (c) => frontA(c) - (c.dir > 0 ? c.L : 0);
  const hi = (c) => lo(c) + c.L;
  const inLane = (rm, li) => cars.filter((c) => c.road === rm && c.lane === li);
  const laneBusy = (rm, li, a0, a1) => inLane(rm, li).some((c) => lo(c) < a1 && hi(c) > a0);
  const peopleIn = (x0, y0, x1, y1) => (env.people || []).some((p) => p && p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1);
  const zebraBusy = (cw, pad = 10) => !!cw && peopleIn(cw.x0 - pad, cw.y0 - pad, cw.x1 + pad, cw.y1 + pad);

  // Svängarna i T-korsningarna. Högertrafik: från Pixelgatans östra fil (1) svänger man höger
  // ner i Infartens västra fil (0, söderut) vid x 1713; från Södergatans östra fil (1) svänger
  // man vänster upp i Infartens östra fil (1, norrut) vid x 1739 – då korsas den västra filen.
  const TURNS = {
    pixelgatan: { at: 1713, lane: 0, s: 6, free: () => !inLane(I, 0).some((c) => c.s < 72) && !zebraBusy(cwOf(8)) },
    sodergatan: { at: 1739, lane: 1, s: -23, free: () => !inLane(I, 1).some((c) => c.s < 32) && !laneBusy(SG, 0, 1739 - 40, 1739 + 100) && !zebraBusy(cwOf(9)) },
  };
  // Infartens ändar: söderut → höger in i Södergatans västra fil (0); norrut → höger in i Pixelgatans östra fil (1).
  const EXITS = {
    1: { to: SG, lane: 0, swapAt: 698, s: CITY.W - 1700, free: () => !laneBusy(SG, 0, 1713 - 40, 1713 + 110) },
    '-1': { to: PG, lane: 1, swapAt: 259, s: 1752, free: () => !laneBusy(PG, 1, 1739 - 110, 1739 + 40) },
  };

  // ---------- fordon ----------
  function pickKind(w) {
    const winter = w.season === 'vinter' || w.snow > 0.2 || w.temp < 4;
    const hasIce = cars.some((c) => c.kind === 'glassbil');
    const list = KINDS.filter(([k]) => !(k === 'glassbil' && (hasIce || winter)) && !(k === 'moped' && (w.snow > 0.3 || (w.kind === 'regn' && w.k > 0.6))));
    let t = rand() * list.reduce((a, [, wgt]) => a + wgt, 0);
    for (const [k, wgt] of list) { if ((t -= wgt) < 0) return k; }
    return 'sedan';
  }
  function dress(c, kind, rust) {
    c.kind = kind; c.spec = SPECS[kind]; c.rust = !!rust && !!END[kind];
    const pal = c.rust ? RUST_PAINT : COLORS[kind];
    c.color = pal[Math.floor(rand() * pal.length)];
    c.variant = Math.floor(rand() * 4);
    c.cruise = kind === 'buss' ? 42 : kind === 'glassbil' ? 32 : kind === 'plog' ? 26 : kind === 'moped' ? 34 : c.rust ? 34 + rand() * 12 : 40 + rand() * 20;
    c.L = c.road.axis === 'x' ? c.spec.L : END_L;
    c.done = new Set(); c.dwell = 0; c.door = 0; c.leave = 0; c.stopId = null;
  }
  function makeCar(rm, li, kind, s, rust) {
    const lane = rm.lanes[li];
    const c = { road: rm, lane: li, dir: lane.dir, cross: lane.cross, s, v: 0, dist: rand() * 50, block: 0, tut: 0, brake: false, commit: -1, lastCw: -1, why: null, turn: null, blink: 0, merged: false, wait: 0, fr: -1 };
    dress(c, kind, rust);
    c.v = c.cruise;
    return c;
  }
  function spawn(rm, li, kind, s) {
    const rust = kind !== 'buss' && kind !== 'plog' && kind !== 'glassbil' && rand() < 0.22;
    const c = makeCar(rm, li, kind, s, rust);
    if (rm.axis === 'x' && li === 1 && END[kind] && rand() < 0.45) c.turn = 'infarten';
    cars.push(c);
    return c;
  }
  // fyll på vid världens kant när ett körfält har färre fordon än det ska
  function refill(w, initial) {
    for (const rm of RM) {
      if (rm.axis !== 'x') continue;
      for (const lane of rm.lanes) {
        const list = inLane(rm, lane.i), want = TARGET[rm.id][lane.i];
        const needBus = lane.i === 1 && !list.some((c) => c.spec.bus);
        const snowy = w.snow > 0.25 || w.kind === 'snö';
        const needPlow = lane.i === 0 && snowy && !list.some((c) => c.kind === 'plog');
        const total = want + (needBus ? 1 : 0) + (needPlow ? 1 : 0);
        if (initial) {
          const loop = rm.len + 2 * M, n = total;
          for (let k = 0; k < n; k++) spawn(rm, lane.i, k === 0 && needBus ? 'buss' : k === 1 && needPlow ? 'plog' : pickKind(w), -M + (k + 0.3 + rand() * 0.4) * (loop / n));
          continue;
        }
        if (list.length >= total) continue;
        if (list.some((c) => c.s - c.L < 30)) continue;   // någon står i infarten till världen
        spawn(rm, lane.i, needBus ? 'buss' : needPlow ? 'plog' : pickKind(w), -M - 8);
      }
    }
  }
  refill(wx(), true);

  function puff(c, snow) {
    const rm = c.road;
    if (rm.axis === 'x') {
      const rear = c.dir > 0 ? lo(c) : hi(c);
      if (snow) puffs.push({ x: frontA(c) + c.dir * 2, y: c.cross - 3 - rand() * 8, vx: c.dir * (14 + rand() * 24), vy: -14 - rand() * 12, life: 0, max: 0.5 + rand() * 0.4, lane: c.cross, snow: true });
      else puffs.push({ x: rear - c.dir * 2, y: c.cross - 3, vx: -c.dir * (6 + rand() * 6), vy: -4 - rand() * 4, life: 0, max: 0.9 + rand() * 0.6, lane: c.cross });
    } else {
      const gy = hi(c);
      puffs.push({ x: c.cross - 8 + rand() * 4, y: (c.dir > 0 ? gy - c.L : gy) - 2, vx: -3 + rand() * 6, vy: -4 - rand() * 4, life: 0, max: 0.9 + rand() * 0.6, lane: gy + 0.5 });
    }
  }

  // flytta ett fordon in i Infarten (svängen från en vågrät gata) – spöket håller platsen i den gamla filen en stund
  function transferIn(c, tn) {
    ghosts.push({ ghost: true, road: c.road, lane: c.lane, s: c.s, L: c.L, v: 0, until: T + 1.1 });
    const lane = I.lanes[tn.lane];
    c.road = I; c.lane = lane.i; c.dir = lane.dir; c.cross = lane.cross; c.L = END_L; c.s = tn.s;
    c.commit = -1; c.lastCw = -1; c.turn = null; c.blink = 0; c.merged = false; c.wait = 0; c.fr = frame;
    c.v = Math.min(c.v, 22);
  }
  // och ut igen i andra änden
  function transferOut(c, ex) {
    const lane = ex.to.lanes[ex.lane];
    c.road = ex.to; c.lane = lane.i; c.dir = lane.dir; c.cross = lane.cross; c.L = c.spec.L; c.s = ex.s;
    c.commit = -1; c.lastCw = -1; c.merged = false; c.blink = 0; c.wait = 0; c.fr = frame;
    c.v = Math.min(c.v, 24);
  }

  function stepCar(c, lead, dt, slow, w) {
    const rm = c.road, front = frontA(c), vStop = (d) => Math.sqrt(2 * B * Math.max(0, d));
    const ahead = (a) => (a - front) * c.dir;
    let vT = c.kind === 'plog' ? c.cruise : c.cruise * slow, why = null;
    const lim = (v, tag) => { if (v < vT) { vT = v; why = tag; } };
    // fordonet framför (eller ett spöke efter en sväng)
    if (lead) {
      const gap = lead.s - lead.L - c.s - GAP;
      lim(gap > 0 ? Math.sqrt(2 * B * gap + lead.v * lead.v) : 0, 'kö');
    }
    // övergångsställen: ljus, obevakade zebror och det trasiga (blinkande gult)
    let best = null;
    for (const cw of rm.crosswalks) {
      const d = ahead(cw.stop[c.dir]) - 1;
      if (d > -2 && (!best || d < best.d)) best = { cw, d };
    }
    if ((best ? best.cw.i : -1) !== c.lastCw) { c.lastCw = best ? best.cw.i : -1; c.commit = -1; }
    if (best && c.commit !== best.cw.i) {
      const { cw, d } = best;
      if (cw.lights && !cw.broken) {
        const st = carLight(cw.i);
        if (st === 'g') { if (d < 1) c.commit = cw.i; }
        else if (st === 'y' && d <= (c.v * c.v) / 220 + 2) c.commit = cw.i;   // för nära för att stanna – kör
        else lim(vStop(d), 'ljus');
      } else if (zebraBusy(cw)) lim(vStop(d), 'zebra');
      else { if (d < 44) lim(Math.max(22, vStop(d + 26)), 'zebra'); if (d < 1) c.commit = cw.i; }
    }
    // folk på vägen framför
    if (rm.axis === 'x') {
      const band = c.lane === 0 ? [rm.c0 + 1, rm.c0 + 33] : [rm.c0 + 31, rm.c1 + 1];
      for (const p of env.people || []) {
        if (!p || p.y < band[0] || p.y > band[1]) continue;
        const a = (p.x - front) * c.dir;
        if (a < -6 || a > 110) continue;
        lim(vStop(a - 16), p === env.player ? 'spelare' : 'folk');
      }
    } else {
      for (const p of env.people || []) {
        if (!p || Math.abs(p.x - c.cross) > 13) continue;
        const a = (p.y - front) * c.dir;
        if (a < -6 || a > 90) continue;
        lim(vStop(a - 14), p === env.player ? 'spelare' : 'folk');
      }
    }
    // bussen stannar vid hållplatserna i sin fil (även den trasiga)
    if (c.spec.bus) {
      let next = null;
      for (const st of rm.stops) {
        if (st.lane !== c.lane || c.done.has(st.id)) continue;
        const d = ahead(st.x + 10 * c.dir);
        if (d > -4 && (!next || d < next.d)) next = { st, d };
      }
      if (c.dwell > 0) {
        lim(0, 'hållplats');
        c.dwell -= dt;
        if (c.dwell <= 0) { c.done.add(c.stopId); c.dwell = 0; c.leave = 1.4; }
      } else if (next) {
        lim(vStop(next.d), 'hållplats');
        if (Math.abs(next.d) < 2 && c.v < 3) { c.dwell = next.st.broken ? 3.5 : 5.5; c.stopId = next.st.id; }
      }
      c.leave = Math.max(0, (c.leave || 0) - dt);
      const want = c.dwell > 0.9 && c.dwell < 5.0 ? 1 : 0;
      c.door += Math.sign(want - c.door) * Math.min(Math.abs(want - c.door), dt * 2.5);
    }
    // sväng in i Infarten?
    if (c.turn) {
      const tn = TURNS[rm.id], center = front - c.dir * c.L / 2, d = (tn.at - center) * c.dir;
      if (d < 70) { c.blink = 1; lim(d > 0 ? Math.max(20, vStop(d) + 18) : 20, 'sväng'); }
      if (d <= 0) {
        if (tn.free()) { transferIn(c, tn); return; }
        c.turn = null; c.blink = 0;   // upptaget – kör rakt fram i stället
      }
    }
    // Infartens ändar: väja för tvärgatan, sedan ut i den
    if (rm === I) {
      const ex = EXITS[c.dir], edge = c.dir > 0 ? rm.a1 - 2 : rm.a0 + 2, d = ahead(edge);
      if (!c.merged) {
        if (d < 46) c.blink = 1;
        if (d > -2) {
          if (ex.free() || c.wait > 7) { if (d < 3) c.merged = true; else lim(Math.max(16, vStop(d + 20)), 'korsning'); }
          else { lim(vStop(d), 'korsning'); if (c.v < 1) c.wait += dt; }
        } else c.merged = true;
      }
    }
    // gasa / bromsa
    const was = c.v;
    if (c.v < vT) c.v = Math.min(vT, c.v + ACC * dt);
    else c.v = Math.max(vT, c.v - 230 * dt);
    c.brake = !!why && (vT < was - 0.5 || c.v < 1);
    c.why = why;
    c.s += c.v * dt;
    if (lead && c.s > lead.s - lead.L - 3) { c.s = lead.s - lead.L - 3; c.v = Math.min(c.v, lead.v); }
    c.dist += c.v * dt;
    // avgaspuffar när fordonet startar från stillastående; plogen sprutar snö
    if (c.kind === 'plog') { if (c.v > 6 && w.snow > 0.15 && rand() < dt * 14 && puffs.length < 60) puff(c, true); }
    else if (was < 10 && vT > was + 4 && rand() < dt * (c.spec.bus ? 10 : 5) && puffs.length < 60) puff(c);
    else if (c.v < 1 && rand() < dt * 0.7 && puffs.length < 60) puff(c);
    // tuta på spelaren som står i vägen
    if (why === 'spelare' && c.v < 3) c.block += dt; else c.block = Math.max(0, c.block - dt);
    if (c.block > 2.5 && T - lastHonk > 6) {
      lastHonk = T; c.tut = 1.2; c.block = 0;
      try { env.play?.('honk'); } catch { /* ljudet får aldrig stoppa trafiken */ }
    }
    c.tut = Math.max(0, c.tut - dt);
    // ut ur Infarten in i tvärgatan när fronten nått målfilen
    if (rm === I && c.merged) {
      const ex = EXITS[c.dir];
      if ((frontA(c) - ex.swapAt) * c.dir >= 0) transferOut(c, ex);
    }
  }

  function update(dt) {
    dt = Math.min(0.1, Math.max(0, dt || 0));
    T += dt; frame++;
    const w = wx();
    const slow = w.snow > 0.3 ? 0.6 : w.kind === 'regn' ? 0.86 : w.kind === 'dimma' ? 0.72 : 1;
    refill(w, false);
    for (const rm of RM) for (const lane of rm.lanes) {
      const all = [...inLane(rm, lane.i), ...ghosts.filter((g) => g.road === rm && g.lane === lane.i)].sort((a, b) => a.s - b.s);
      for (let k = all.length - 1; k >= 0; k--) {
        const c = all[k];
        if (c.ghost || c.fr === frame) continue;
        c.fr = frame;
        stepCar(c, all[k + 1] || null, dt, slow, w);
      }
    }
    // ut ur världen → bort (fyller på från kanten)
    for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (c.s - c.L > c.road.len + M) cars.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].until < T) ghosts.splice(i, 1);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt; p.x += (p.vx + w.wind * 0.25) * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5;
      if (p.snow) p.vy += 30 * dt;
      if (p.life >= p.max) puffs.splice(i, 1);
    }
  }

  // ---------- parkerade fordon i förorten ----------
  const parked = [], obstacles = LIGHTS_ALL.map((l) => [l.x - 3, l.y - 2, l.x + 4, l.y + 1]);
  {
    const lot = LOTS.find((l) => l.id === 'parkering');
    const bay = (k) => lot.rect[0] + 12 + k * 26 + 13;
    const yTop = lot.rect[1] + 42, yBot = lot.rect[3] - 8;
    // parkeringen: nos in i rutorna – översta raden ses bakifrån, nedersta framifrån
    const P1 = { kind: 'sedan', color: 0x8a4a3a, variant: 1, rust: true }, P2 = { kind: 'pickup', color: 0x5e6a5e, variant: 2, rust: true };
    const P3 = { kind: 'halvkombi', color: 0x9a8a6a, variant: 3, rust: true }, P4 = { kind: 'skapbil', color: 0xa89a6a, variant: 0, rust: true };
    for (const [spec, x, y, rear] of [[P1, bay(2), yTop, true], [P2, bay(5), yTop, true], [P3, bay(1), yBot, false], [P4, bay(6), yBot, false]]) {
      const E = endArt(spec, rear);
      parked.push({ x, y, end: E, obstacle: [x - (E.W >> 1) + 2, y - 26, x + (E.W >> 1) - 2, y + 1] });
    }
    // tomten: ett vrak på pallar utan framhjul, ogräs runt om
    const tomt = LOTS.find((l) => l.id === 'tomten');
    if (tomt) {
      const x0 = tomt.rect[0] + 14, y = tomt.rect[1] + 112;
      parked.push({ x: x0 + 29, y, side: { kind: 'sedan', color: 0x5e6a5e, variant: 2, rust: true }, x0, wreck: true, obstacle: [x0, y - 12, x0 + 58, y + 1] });
    }
    // vagnsplatsen: rostig pickup bredvid husvagnen
    const vp = LOTS.find((l) => l.id === 'vagnsplatsen');
    if (vp) {
      const x0 = vp.rect[0] + 10, y = vp.rect[1] + 66;
      parked.push({ x: x0 + 31, y, side: { kind: 'pickup', color: 0x8a4a3a, variant: 0, rust: true }, x0, flip: 1, obstacle: [x0, y - 12, x0 + 62, y + 1] });
    }
    // mopeden utanför garagen (någon skruvar på en till där inne)
    const gar = buildingById('garage');
    if (gar) {
      const x0 = gar.x + gar.w - 26, y = gar.base + 14;
      parked.push({ x: x0 + 14, y, side: { kind: 'moped', color: 0xf2c230, variant: 2 }, x0, obstacle: [x0 + 2, y - 6, x0 + 26, y + 1] });
    }
    for (const p of parked) obstacles.push(p.obstacle);
  }

  // ---------- ritning ----------
  function bubble(ctx, x, y) {
    const str = 'TUT!', w = textW(SMALL, str) + 6, h = 9, bx = x - (w >> 1), by = y - h - 2;
    ctx.fillStyle = '#1c1a22'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = '#1c1a22'; ctx.fillRect(x - 1, by + h + 1, 3, 1); ctx.fillRect(x, by + h + 2, 1, 1);
    ctxText(ctx, SMALL, str, bx + 3, by + 2, '#c0282a');
  }
  // halvljus på dagen (dimma/regn): små glödblobbar med 'lighter' inne i själva ritanropet
  const dayLights = (w) => env.dark < 0.05 && (w.kind === 'dimma' || (w.kind === 'regn' && w.k > 0.35));
  function lighter(ctx, fn) {
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    fn();
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  }
  // torkaren: en liten pinne som pendlar över vindrutan (två lägen)
  function wiper(ctx, A, f, x0, laneY) {
    const ws = A.ws;
    if (!ws) return;
    const up = Math.floor(T * 3) % 2 === 0;
    const len = Math.min(7, ws.h1 - ws.h0 + 1);
    const px = ws.x1 - 2, ph = ws.h0;
    ctx.fillStyle = 'rgba(20,22,30,0.85)';
    for (let k = 0; k < len; k++) {
      const cx = up ? px - Math.round(k * 0.35) : px - Math.round(k * 0.9), ch = up ? ph + k : ph + Math.round(k * 0.45);
      if (ch > ws.h1) break;
      const sx = f ? x0 + A.W - 3 - cx : x0 + cx;
      ctx.fillRect(sx, laneY - 1 - ch, 1, 1);
    }
  }
  function drawCar(ctx, c, w) {
    const A = vehicleArt(c), s = c.spec, L = s.L, f = c.dir < 0 ? 1 : 0;
    const x0 = Math.round(lo(c)), top = c.cross - 1 - A.gy;
    // blöt väg: spegling under fordonet
    if (w.wet > 0.15 && A.refl) { ctx.globalAlpha = Math.min(1, w.wet) * 0.9; ctx.drawImage(A.refl[f], x0 - 1, c.cross + 1); ctx.globalAlpha = 1; }
    ctx.drawImage(A.img[f], x0 - 1, top);
    if (c.brake && A.brake) ctx.drawImage(A.brake[f], x0 - 1, top);
    if (w.snow > 0.35 && A.snow && c.kind !== 'plog') ctx.drawImage(A.snow[f], x0 - 1, top);
    // bussens dörrar glider isär från mitten
    if (A.door && c.door > 0.02) {
      for (const [d0, d1] of s.doors) {
        const wd = d1 - d0 + 1, open = Math.round(wd * c.door);
        if (open < 2) continue;
        const q0 = f ? L - 1 - d1 : d0, sx = 1 + q0 + ((wd - open) >> 1);
        const y0 = A.gy - s.winTop, hh = s.winTop - A.hb[d0];
        ctx.drawImage(A.door[f], sx, y0, open, hh, x0 - 1 + sx, top + y0, open, hh);
      }
    }
    // hjulen
    const rim = c.rust ? 'rust' : s.rim, n = RIMN[rim], per = (Math.PI * 2) / n, rot = (c.dist / s.r) * c.dir;
    const fr = Math.floor(((((rot % per) + per) % per) / per) * NF) % NF;
    const wimg = wheelArt(s.r, rim, fr);
    for (const wxp of s.wheels) {
      const q = f ? L - 1 - wxp : wxp;
      ctx.drawImage(wimg, x0 + q - s.r, c.cross - 1 - 2 * s.r);
    }
    if (w.kind === 'regn' && A.ws) wiper(ctx, A, f, x0, c.cross);
    // blinkers: bussen ut från hållplatsen, bilar som ska svänga
    const blinkOn = Math.floor(T * 3) % 2 === 0;
    if (blinkOn && ((s.bus && ((c.dwell > 0 && c.dwell < 1.8) || c.leave > 0)) || c.blink)) {
      ctx.fillStyle = '#ffb020';
      const hy = c.cross - 1 - s.head.h0, ty = c.cross - 1 - s.tail.h0 - 1;
      ctx.fillRect(f ? x0 : x0 + L - 2, hy - 1, 2, 2);
      ctx.fillRect(f ? x0 + L - 2 : x0, ty, 2, 2);
    }
    // plogens varningsljus
    if (c.kind === 'plog' && Math.floor(T * 2.5) % 2 === 0) {
      const bx = f ? x0 + L - 1 - s.beacon : x0 + s.beacon, by = c.cross - 1 - (A.topH + 3);
      ctx.fillStyle = '#fff0b0'; ctx.fillRect(bx - 1, by, 3, 2);
      lighter(ctx, () => { const g = blob('beacon', 0xffa030, 9, 5, 0.6, false); ctx.globalAlpha = 0.9; ctx.drawImage(g.img, bx - g.ox, by - g.oy); });
    }
    // halvljus på dagen i dimma och regn
    if (dayLights(w)) lighter(ctx, () => {
      const hy = c.cross - 1 - Math.round((s.head.h0 + s.head.h1) / 2), fx = c.dir > 0 ? x0 + L : x0 - 1;
      const hl = blob('head', 0xfff8e0, 3, 2, 0.95, false);
      ctx.globalAlpha = w.kind === 'dimma' ? 0.75 : 0.5;
      ctx.drawImage(hl.img, fx - c.dir - hl.ox, hy - hl.oy);
      if (w.kind === 'dimma') { const bm = beam(c.dir); ctx.globalAlpha = 0.3; ctx.drawImage(bm.img, c.dir > 0 ? fx : fx - bm.len + 1, hy - bm.row); }
      const tg = blob('tail', 0xff2a1a, 4, 2, 0.6, false), ty = c.cross - 1 - Math.round((s.tail.h0 + s.tail.h1) / 2), tx = c.dir > 0 ? x0 : x0 + L - 1;
      ctx.globalAlpha = c.brake ? 0.8 : 0.4;
      ctx.drawImage(tg.img, tx - tg.ox, ty - tg.oy);
    });
    if (c.tut > 0) bubble(ctx, x0 + (L >> 1), c.cross - 1 - A.topH - 2);
  }
  function drawEndCar(ctx, c, w) {
    const rear = c.dir < 0, A = endArt(c, rear);
    const gy = Math.round(hi(c)), x = c.cross - A.ox - (A.W >> 1) + A.ox, y = gy - A.gy;
    if (w.wet > 0.15) { ctx.globalAlpha = Math.min(1, w.wet) * 0.9; ctx.drawImage(A.refl, x, gy + 1); ctx.globalAlpha = 1; }
    ctx.drawImage(A.img, x, y);
    if (c.brake && A.brake) ctx.drawImage(A.brake, x, y);
    if (w.snow > 0.35) ctx.drawImage(A.snow, x, y);
    if (c.blink && Math.floor(T * 3) % 2 === 0) {
      ctx.fillStyle = '#ffb020';
      const bx = c.dir > 0 ? x + A.W - A.ox - 3 : x + A.ox + 1;   // höger blinkers (svängen går åt höger i båda ändar)
      ctx.fillRect(bx, gy - 9, 2, 2);
    }
    if (dayLights(w)) lighter(ctx, () => {
      ctx.globalAlpha = w.kind === 'dimma' ? 0.7 : 0.45;
      if (!rear) { const hl = blob('head', 0xfff8e0, 3, 2, 0.95, false); for (const dx of [-8, 8]) ctx.drawImage(hl.img, c.cross + dx - hl.ox, gy - A.lampH - hl.oy); }
      else { const tg = blob('tail', 0xff2a1a, 4, 2, 0.6, false); ctx.globalAlpha = c.brake ? 0.8 : 0.4; for (const dx of [-9, 9]) ctx.drawImage(tg.img, c.cross + dx - tg.ox, gy - A.lampH - tg.oy); }
    });
    if (c.tut > 0) bubble(ctx, c.cross, y - 2);
  }
  function drawPole(ctx, l) {
    const A = poleArt(l.side, null, carLight(l.crosswalk), pedLight(l.crosswalk), !!l.broken);
    ctx.drawImage(A.img, l.x - A.px, l.y - A.fy);
  }
  function drawParked(ctx, p, w) {
    if (p.end) {
      const E = p.end, x = p.x - (E.W >> 1), y = p.y - E.gy;
      if (w.wet > 0.15) { ctx.globalAlpha = w.wet * 0.7; ctx.drawImage(E.refl, x, p.y + 1); ctx.globalAlpha = 1; }
      ctx.drawImage(E.img, x, y);
      if (w.snow > 0.25) ctx.drawImage(E.snow, x, y);
      return;
    }
    const A = vehicleArt(p.side), s = SPECS[p.side.kind], f = p.flip || 0, x0 = p.x0, top = p.y - 1 - A.gy;
    if (w.wet > 0.15 && !p.wreck) { ctx.globalAlpha = w.wet * 0.5; ctx.drawImage(A.refl[f], x0 - 1, p.y + 1); ctx.globalAlpha = 1; }
    ctx.drawImage(A.img[f], x0 - 1, top);
    if (w.snow > 0.25) ctx.drawImage(A.snow[f], x0 - 1, top);
    const wimg = wheelArt(s.r, p.side.rust ? 'rust' : s.rim, 2);
    s.wheels.forEach((wxp, i) => {
      const q = f ? s.L - 1 - wxp : wxp, wx0 = x0 + q - s.r, wy = p.y - 1 - 2 * s.r;
      if (p.wreck && i === 1) { // pallar i stället för framhjul
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(wx0 + 1, wy + s.r + 2, 2 * s.r - 1, 3);
        ctx.fillStyle = '#9a7a4a'; ctx.fillRect(wx0 + 2, wy + s.r + 2, 2 * s.r - 3, 1);
        ctx.fillStyle = '#4a3418'; ctx.fillRect(wx0 + 2, wy + s.r + 5, 2, 4); ctx.fillRect(wx0 + 2 * s.r - 4, wy + s.r + 5, 2, 4);
        return;
      }
      ctx.drawImage(wimg, wx0, wy);
    });
    if (p.wreck) { // ogräs och glassplitter
      ctx.fillStyle = '#5a8a3a';
      for (const [dx, dy] of [[-4, 0], [8, -1], [30, 0], [52, -1], [62, 0], [20, -2]]) { ctx.fillRect(x0 + dx, p.y - 3 + dy, 1, 3); ctx.fillRect(x0 + dx + 1, p.y - 2 + dy, 1, 2); }
      ctx.fillStyle = '#b8d0e0'; ctx.fillRect(x0 + 44, p.y - 1, 2, 1); ctx.fillRect(x0 + 48, p.y, 1, 1);
    }
    if (p.side.kind === 'moped') { ctx.fillStyle = '#3a3c44'; ctx.fillRect(x0 + 9, p.y - 3, 1, 3); ctx.fillRect(x0 + 8, p.y - 1, 3, 1); }   // stödet
  }

  return {
    obstacles,
    update,
    pedGreen,
    // extra för andra moduler: lägen och fordonens positioner
    carLight, pedLight,
    vehicles: () => cars.map((c) => (c.road.axis === 'x'
      ? { x0: lo(c), x1: hi(c), y: c.cross, dir: c.dir, v: c.v, kind: c.kind, why: c.why, tut: c.tut > 0, road: c.road.id, axis: 'x' }
      : { x0: c.cross - 13, x1: c.cross + 13, y: hi(c), y0: lo(c), y1: hi(c), dir: c.dir, v: c.v, kind: c.kind, why: c.why, tut: c.tut > 0, road: c.road.id, axis: 'y' })),
    positions: () => cars.map((c) => (c.road.axis === 'x' ? { x: lo(c) + c.L / 2, y: c.cross } : { x: c.cross, y: hi(c) })),
    items() {
      const out = [], w = wx();
      for (const l of LIGHTS_ALL) out.push({ x: l.x, y: l.y, draw: (ctx) => drawPole(ctx, l) });
      for (const c of cars) {
        if (c.road.axis === 'x') {
          const x = lo(c) + c.L / 2;
          if (x < -120 || x > CITY.W + 120) continue;
          out.push({ x, y: c.cross, draw: (ctx) => drawCar(ctx, c, w) });
        } else out.push({ x: c.cross, y: hi(c), draw: (ctx) => drawEndCar(ctx, c, w) });
      }
      for (const p of parked) out.push({ x: p.x, y: p.y, draw: (ctx) => drawParked(ctx, p, w) });
      for (const p of puffs) {
        out.push({ x: p.x, y: p.lane + 0.5, draw: (ctx) => {
          const t = p.life / p.max, a = (1 - t) * (p.snow ? 0.85 : 0.45), sz = t < 0.35 ? 2 : 3;
          ctx.fillStyle = p.snow ? `rgba(244,248,255,${a.toFixed(3)})` : `rgba(206,206,212,${a.toFixed(3)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.snow ? (t < 0.5 ? 2 : 1) : sz, p.snow ? (t < 0.5 ? 2 : 1) : sz);
        } });
      }
      return out;
    },
    glow(ctx) {
      const k = Math.min(1, (env.dark || 0) / 0.4);
      if (k <= 0.02) return;
      const w = wx(), wetBoost = 1 + Math.min(1, w.wet) * 0.8;
      ctx.globalCompositeOperation = 'lighter';
      // tända signallampor (det trasiga ljuset blinkar gult)
      for (const l of LIGHTS_ALL) {
        const cs = carLight(l.crosswalk), ps = pedLight(l.crosswalk);
        const on = [];
        if (cs === 'r' || cs === 'ry') on.push('r');
        if (cs === 'y' || cs === 'ry' || cs === 'yb') on.push('y');
        if (cs === 'g') on.push('g');
        if (ps === 'r') on.push('pr'); else if (ps === 'g') on.push('pg');
        for (const key of on) {
          const g = key.length > 1 ? blob('p' + key, LAMPC[key], 6, 6, 0.4, false) : blob('l' + key, LAMPC[key], 9, 9, 0.5, true);
          ctx.globalAlpha = k;
          ctx.drawImage(g.img, l.x - g.ox, l.y - LAMP_H[key] - g.oy);
        }
      }
      // fordonens lyktor
      for (const c of cars) {
        if (c.road.axis !== 'x') {
          // Infarten: söderut ser vi strålkastarna och käglan ner mot kameran, norrut baklyktorna
          const gy = Math.round(hi(c)), A = endArt(c, c.dir < 0);
          ctx.globalAlpha = k;
          if (c.dir > 0) {
            const hl = blob('head', 0xfff8e0, 3, 2, 0.95, false);
            for (const dx of [-8, 8]) ctx.drawImage(hl.img, c.cross + dx - hl.ox, gy - A.lampH - hl.oy);
            const vb = vbeam(); ctx.globalAlpha = k * 0.9 * wetBoost; ctx.drawImage(vb.img, c.cross - vb.ox, gy - 4);
          } else {
            const tg = blob('tail', 0xff2a1a, 5, 3, 0.6, false);
            ctx.globalAlpha = k * (c.brake ? 1 : 0.6);
            for (const dx of [-9, 9]) ctx.drawImage(tg.img, c.cross + dx - tg.ox, gy - A.lampH - tg.oy);
            const pool = blob('vpoolr', 0xff5040, 10, 4, 0.2, false); ctx.drawImage(pool.img, c.cross - pool.ox, gy + 3 - pool.oy);
          }
          continue;
        }
        const x0 = Math.round(lo(c));
        if (x0 > CITY.W + 80 || x0 + c.L < -80) continue;
        const A = vehicleArt(c), s = c.spec, f = c.dir < 0 ? 1 : 0;
        const top = c.cross - 1 - A.gy;
        const hy = c.cross - 1 - Math.round((s.head.h0 + s.head.h1) / 2);
        const fx = c.dir > 0 ? x0 + c.L : x0 - 1;
        const bm = beam(c.dir);
        ctx.globalAlpha = k * (w.kind === 'dimma' ? 0.6 : 1);
        ctx.drawImage(bm.img, c.dir > 0 ? fx : fx - bm.len + 1, hy - bm.row);
        const pool = blob('pool', 0xfff0c8, 24, 4, 0.22, false);
        ctx.globalAlpha = k * wetBoost;
        ctx.drawImage(pool.img, fx + c.dir * 30 - pool.ox, c.cross - 2 - pool.oy);
        if (w.wet > 0.2) { ctx.globalAlpha = k * w.wet * 0.5; ctx.drawImage(pool.img, fx + c.dir * 50 - pool.ox, c.cross + 2 - pool.oy); }
        const hl = blob('head', 0xfff8e0, 3, 2, 0.95, false);
        ctx.globalAlpha = k;
        ctx.drawImage(hl.img, fx - c.dir - hl.ox, hy - hl.oy);
        const ty = c.cross - 1 - Math.round((s.tail.h0 + s.tail.h1) / 2);
        const tx = c.dir > 0 ? x0 : x0 + c.L - 1;
        const tg = blob('tail', 0xff2a1a, 5, 3, 0.6, false);
        ctx.globalAlpha = k * (c.brake ? 1 : 0.6);
        ctx.drawImage(tg.img, tx - tg.ox, ty - tg.oy);
        if (w.wet > 0.2) { ctx.globalAlpha = k * w.wet * 0.35 * (c.brake ? 1.5 : 1); const rp = blob('rpool', 0xff3020, 6, 3, 0.4, false); ctx.drawImage(rp.img, tx - rp.ox, c.cross + 2 - rp.oy); }
        if (A.night) { ctx.globalAlpha = k * 0.8; ctx.drawImage(A.night[f], x0 - 1, top); }
        if (s.taxi) {
          const sg = blob('taxi', 0xfff0b0, 12, 5, 0.35, false);
          ctx.globalAlpha = k;
          ctx.drawImage(sg.img, x0 + (f ? c.L - 27 : 26) - sg.ox, c.cross - 1 - 28 - sg.oy);
        }
        if (s.brand === 'glass') {
          const sg = blob('ice', 0xff9ac8, 20, 7, 0.3, false);
          ctx.globalAlpha = k;
          ctx.drawImage(sg.img, x0 + (f ? c.L - 28 : 27) - sg.ox, c.cross - 1 - 40 - sg.oy);
        }
        if (c.kind === 'plog' && Math.floor(T * 2.5) % 2 === 0) {
          const g = blob('beacon2', 0xffa030, 16, 8, 0.5, false), bx = f ? x0 + c.L - 1 - s.beacon : x0 + s.beacon;
          ctx.globalAlpha = k; ctx.drawImage(g.img, bx - g.ox, c.cross - 1 - (A.topH + 3) - g.oy);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
