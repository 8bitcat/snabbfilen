// Trafiken i Pixelstaden – bilar, buss, glassbil och trafikljus.
//
// Fordonen kör i körfälten (LANES), köar bakom varandra, bromsar mjukt vid
// stopplinjen när ljuset slår om, stannar för folk på vägen och tutar på
// spelaren om hen står i vägen för länge. Bussen stannar vid hållplatsen och
// öppnar dörrarna. Fordon som kör ut ur världen dyker upp i andra änden (ofta
// som en ny bil).
//
// Allt målas pixel för pixel EN gång och cachas: varje kaross (per typ, färg
// och variant) finns färdig åt båda hållen, hjulen är små egna bilder med åtta
// rotationslägen och trafikljusstolparna cachas per lampläge. Varje bildruta
// ritas bara färdiga bilder på heltalskoordinater i skala 1.
//
// Kontrakt: createTraffic(env) → { items(), obstacles, update(dt), glow(ctx), pedGreen(i) }
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW, ctxText } from '../core/floor-pix.js';
import { CITY, LANES, CROSSWALKS, LIGHTS, BUS_STOP } from './map.js';

// ======================================================================
// Fordonsritningar
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
};
SPECS.taxi = { ...SPECS.sedan, taxi: true, extraTop: 8 };

const PAINT = [0xc23a32, 0x2f6db5, 0xc3c8d0, 0xe9e9eb, 0x2b2e36, 0x3f8a55, 0xd99a2b, 0x2a9d9a, 0x7a2e3e, 0x5e7b99, 0xe57a2e, 0x6b4f8f];
const COLORS = {
  sedan: PAINT, halvkombi: PAINT, taxi: [0xf2c230, 0xf2c230, 0x2b2e36],
  pickup: [0x3d6b45, 0xa83232, 0x2c4a7a, 0xd9b44a, 0x8a8f96],
  skapbil: [0xeceef1], glassbil: [0xf7f2e6], buss: [0xc8352e],
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

// Huvud + axlar bakom en ruta (4 bred, vänd åt höger). h = hår, s = hy, t = tröja
const HEAD = ['.hh.', 'hhhh', 'hhss', 'hsss', '.ss.', 'tttt', 'tttt'];
const REST = ['.rr.', 'rrrr', 'rrrr', 'rrrr'];

function paintVehicle(kind, color, variant) {
  const s = SPECS[kind], L = s.L, D = s.D;
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
  const c = color;
  const R = { hi: mix(c, 0xffffff, 0.55), lt: mix(c, 0xffffff, 0.24), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
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
      else if (h === s.crease) col = mix(R.lt, R.hi, 0.35);                          // karaktärslinjen
      else if (h === s.crease - 1) col = R.dk;
      else if (h > s.crease) {
        const t = (h - s.crease) / Math.max(1, topE - s.crease);
        col = mix(mix(R.c, R.lt, t * 0.7 + n * 0.35), 0xdfeaff, 0.05 + t * 0.06);   // himlen speglas uppe
      } else {
        const t = (s.crease - 1 - h) / Math.max(1, s.crease - 1 - bot);
        col = mix(mix(R.md, R.dd, t * 0.85 + n * 0.3), 0x3a3028, t * 0.12);          // gatan speglas nere
      }
      if (h === bot) col = R.dd;
      if ((x + (h >> 1)) % 41 < 2 && h > s.crease && h < topE - 1) col = mix(col, 0xffffff, 0.16);
      if (hash(x, h, 7) > 0.95) col = mul(col, 1.06);
      if (s.bus) {
        if (h === 20) col = 0xf4f4ee; else if (h === 19) col = mul(c, 0.62);
        else if (h <= 6) col = mul(col, 0.78);
      }
      if (r === BUMP) {
        if (bump.chrome) col = h >= bump.h1 - 1 ? 0xf2f4f8 : h > bump.h0 + 1 ? mix(0xc4c8d0, 0x8a8e96, n + 0.5) : 0x5a5e66;
        else if (bump.dark) col = h === bump.h1 ? 0x4a4c54 : mix(0x2a2b31, 0x1c1d22, n + 0.5);
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
    for (let i = 0; i < 3; i++) { put(hx + i, hh, 0xe6e9ee); put(hx + i, hh - 1, 0x2e3036); }
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
  for (let x = hd.x; x < L; x++) for (let h = hd.h0; h <= hd.h1; h++) {
    if (!get(x, h)) continue;
    put(x, h, h === hd.h1 ? 0xffffff : x === L - 1 ? 0xd8dde6 : 0xfff3c8);
  }
  for (let h = hd.h0; h <= hd.h1; h++) if (get(hd.x - 1, h)) put(hd.x - 1, h, 0x3a3c44);
  for (let x = hd.x; x < L; x++) if (get(x, hd.h0 - 1)) put(x, hd.h0 - 1, 0xf0a030);
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
  put(2, eh, 0x9a9ea6); put(3, eh, 0x4a4c54); put(4, eh, 0x2a2b30);
  // tanklock
  if (s.fuel) {
    const { x: fx, h: fh } = s.fuel;
    for (let i = 0; i < 3; i++) { put(fx + i, fh, mul(cur(fx + i, fh), 0.7)); put(fx + i, fh - 2, mul(cur(fx + i, fh - 2), 0.7)); }
    put(fx, fh - 1, mul(cur(fx, fh - 1), 0.7)); put(fx + 2, fh - 1, mul(cur(fx + 2, fh - 1), 0.7));
  }
  // antenn
  if (s.antenna !== undefined) {
    const ax = s.antenna, a0 = ht[ax] + D;
    put(ax, a0 + 1, 0x1c1d22); put(ax - 1, a0 + 2, 0x2a2b30); put(ax - 1, a0 + 3, 0x3a3b41);
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
    if (v === 0) { // trälåda
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
  };
  decal(P, false); decal(Q, true);
  const topH = Math.max(...ht) + D;
  return {
    W, H, gy, hb, topH,
    img: [P.flush(), Q.flush()], brake: [O.flush(), OQ.flush()],
    night: N ? [N.flush(), NQ.flush()] : null, door: DP ? [DP.flush(), DQ.flush()] : null,
  };
}

const VCACHE = {};
function vehicleArt(c) {
  const key = c.kind + ':' + c.color + ':' + c.variant;
  return VCACHE[key] || (VCACHE[key] = paintVehicle(c.kind, c.color, c.variant));
}

// ---------- hjulen: åtta rotationslägen per fälgtyp ----------
const NF = 8;
const RIMN = { alloy: 5, steel: 6, white: 6, bus: 8 };
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
      k = lit > 0.1 ? 0xe4e8ee : lit < -0.2 ? 0x7a7e86 : 0xb0b4bc;                 // fälgkanten
    } else if (style === 'alloy') {
      const spoke = Math.cos(n * (a - rot)) > 0.2;
      k = d < 0.8 ? 0x4a4e56 : d < 1.3 ? 0x8a8e96 : spoke ? mix(0xd2d6de, 0x8a9098, 0.5 - lit) : 0x26282e;
    } else if (style === 'bus') {
      k = mix(0xb4bac2, 0x80868e, 0.5 - lit);
      if (Math.abs(d - (rimR - 1)) < 0.6 && Math.cos(n * (a - rot)) > 0.6) k = 0x3a3e44;
      if (Math.abs(d - 1.8) < 0.55 && Math.cos(n * (a - rot) + Math.PI) > 0.5) k = 0x5a5e66;
      if (d < 0.9) k = 0xe0e4ea;
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
function poleArt(side, name, cs, ps) {
  const key = side + (name || '') + cs + ps;
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
    at(dx, h, k);
  }
  for (let h = 0; h <= 3; h++) { at(-4, h, 0x3a3832); at(4, h, 0x3a3832); }
  // stolpen (galvaniserad, rund: ljus vänsterkant, mörk högerkant)
  for (let h = 4; h <= 84; h++) {
    at(-1, h, 0xa4aab2); at(0, h, mix(0x7c828a, 0x8a9098, nz(0, h) + 0.5)); at(1, h, 0x4c5158);
    at(-2, h, 0x2a2e34); at(2, h, 0x24272c);
  }
  for (const h of [7, 46, 79]) for (let dx = -2; dx <= 2; dx++) at(dx, h, dx === -2 ? 0x8a9098 : dx === 2 ? 0x2a2e34 : 0x5a6068);
  at(-1, 85, 0x5a6068); at(0, 85, 0xb8bec6); at(1, 85, 0x3a3e44); at(0, 86, 0x2a2e34);

  // tryckknappslåda (gul, med pil och VÄNTA-lampa)
  for (let h = 10; h <= 19; h++) for (let dx = -3; dx <= 3; dx++) {
    let k = mix(0xf2c230, 0xd8a418, (19 - h) / 9 + nz(dx, h) * 0.2);
    if (dx === -3) k = 0xffe483;
    if (dx === 3) k = 0xa87c10;
    if (h === 19) k = 0xffeaa0;
    if (h === 10) k = 0x7a5a0c;
    at(dx, h, k);
  }
  for (let h = 10; h <= 19; h++) { at(-4, h, 0x2a2210); at(4, h, 0x2a2210); }
  for (let dx = -3; dx <= 3; dx++) { at(dx, 20, 0x2a2210); at(dx, 9, 0x2a2210); }
  for (let h = 12; h <= 16; h++) for (let dx = -2; dx <= 2; dx++) at(dx, h, 0x18181c);
  const ad = side === 'n' ? 1 : -1;
  for (let dx = -2; dx <= 2; dx++) at(dx, 14, 0xf4f4f0);
  at(ad, 15, 0xf4f4f0); at(ad, 13, 0xf4f4f0); at(0, 16, 0xf4f4f0); at(0, 12, 0xf4f4f0); at(-2 * ad, 14, 0x18181c);
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
      at(i - 3, h0 + 8 - j, k);
    }
  };
  win(34, MAN_STAND, LAMPC.pr, ps === 'r');
  win(23, MAN_WALK, LAMPC.pg, ps === 'g');
  for (let dx = -5; dx <= 5; dx++) { at(dx, 33, 0x2e3038); at(dx, 44, 0x2e3038); at(dx, 45, 0x44464e); }
  at(-5, 33, 0x08080a); at(5, 33, 0x08080a);

  // bilsignalen: svart skiva med gul kant, tre lampor under skärmtak
  for (let h = 47; h <= 78; h++) for (let dx = -6; dx <= 6; dx++) {
    const out = dx === -6 || dx === 6 || h === 47 || h === 78;
    const ring = dx === -5 || dx === 5 || h === 48 || h === 77;
    let k = 0x17181c;
    if (out) k = 0x0a0a0c;
    else if (ring) k = dx === -5 || h === 77 ? 0xffe070 : dx === 5 || h === 48 ? 0xb88c18 : 0xf2c230;
    else if (dx === -4 || dx === 4 || h === 49 || h === 76) k = dx === -4 ? 0x30323a : 0x101114;
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
  lamp(LAMP_H.y, LAMPC.y, cs === 'y' || cs === 'ry');
  lamp(LAMP_H.g, LAMPC.g, cs === 'g');

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

// ======================================================================
// Trafiken
// ======================================================================
const CYCLE = 15.5;          // grönt 7 → gult 1,5 → rött 7 (sista sekunden rött+gult)
const PED_ON = 9.1, PED_OFF = 14.3, PED_BLINK = 12.3;
const B = 48;                // mjuk inbromsning (px/s²)
const ACC = 34;              // acceleration (px/s²)
const GAP = 6;               // avstånd i kö (px)
const M = 40;                // hur långt utanför världen bilarna vänder
const BAND = [[CITY.ROAD[0] + 1, 251], [249, CITY.ROAD[1] + 1]]; // vilka y som räknas som "i körfältet"

const KINDS = [['sedan', 34], ['halvkombi', 27], ['taxi', 11], ['skapbil', 11], ['pickup', 10], ['glassbil', 7]];

// Förhandsvisning (verktyg): alla fordonstyper åt båda hållen + stolparnas lägen på ett ark.
export function trafficSheet() {
  const rows = [['sedan', 0xc23a32, 0], ['sedan', 0x2b2e36, 1], ['halvkombi', 0x2f6db5, 0], ['halvkombi', 0xe9e9eb, 2], ['taxi', 0xf2c230, 0],
    ['pickup', 0x3d6b45, 0], ['pickup', 0xa83232, 1], ['skapbil', 0xeceef1, 0], ['glassbil', 0xf7f2e6, 0], ['buss', 0xc8352e, 0]];
  const cv = document.createElement('canvas'); cv.width = 460; cv.height = 12 + rows.length * 62 + 110;
  const x = cv.getContext('2d');
  x.fillStyle = '#4a4c52'; x.fillRect(0, 0, cv.width, cv.height);
  rows.forEach(([k, col, v], i) => {
    const A = paintVehicle(k, col, v), s = SPECS[k], y = 12 + i * 62 + 56;
    for (let f = 0; f < 2; f++) {
      const x0 = 10 + f * 200;
      x.drawImage(A.img[f], x0 - 1, y - 1 - A.gy);
      const w = wheelArt(s.r, s.rim, (i * 3) % NF);
      for (const wx of s.wheels) x.drawImage(w, x0 + (f ? s.L - 1 - wx : wx) - s.r, y - 1 - 2 * s.r);
      if (f === 1 && A.door) for (const [d0, d1] of s.doors) { const q0 = s.L - 1 - d1, w2 = d1 - d0 + 1; x.drawImage(A.door[1], 1 + q0, A.gy - s.winTop, w2, s.winTop - A.hb[d0], x0 + q0, y - 1 - s.winTop, w2, s.winTop - A.hb[d0]); }
    }
  });
  const states = [['r', 'r'], ['ry', 'r'], ['g', 'r'], ['y', 'r'], ['r', 'g'], ['r', 'x']];
  states.forEach(([cs, ps], i) => { const A = poleArt(i ? 's' : 'n', i ? null : 'PARKGATAN', cs, ps); x.drawImage(A.img, 20 + i * 36 - A.px, cv.height - 6 - A.fy); });
  for (let f = 0; f < NF; f++) ['alloy', 'steel', 'white', 'bus'].forEach((st, j) => x.drawImage(wheelArt(st === 'bus' ? 7 : st === 'alloy' ? 5 : 6, st, f), 250 + f * 18, cv.height - 100 + j * 18));
  return cv;
}

export function createTraffic(env) {
  let T = 0, lastHonk = -99;
  const cars = [], puffs = [];
  const rand = Math.random;

  const phase = (i) => (((T + i * 5.3 + 2) % CYCLE) + CYCLE) % CYCLE;
  const carLight = (i) => { const p = phase(i); return p < 7 ? 'g' : p < 8.5 ? 'y' : p < 14.5 ? 'r' : 'ry'; };
  const pedLight = (i) => {
    const p = phase(i);
    if (p < PED_ON || p >= PED_OFF) return 'r';
    if (p >= PED_BLINK) return Math.floor(p * 4) % 2 === 0 ? 'g' : 'x';
    return 'g';
  };
  const pedGreen = (i) => { const p = phase(i); return p >= PED_ON && p < PED_OFF; };

  function pickKind() {
    const hasIce = cars.some((c) => c.kind === 'glassbil');
    const list = KINDS.filter(([k]) => !(hasIce && k === 'glassbil'));
    let t = rand() * list.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of list) { if ((t -= w) < 0) return k; }
    return 'sedan';
  }
  function dress(c, kind) {
    c.kind = kind; c.spec = SPECS[kind]; c.L = c.spec.L;
    const pal = COLORS[kind];
    c.color = pal[Math.floor(rand() * pal.length)];
    c.variant = Math.floor(rand() * 3);
    c.cruise = kind === 'buss' ? 42 : kind === 'glassbil' ? 32 : 40 + rand() * 20;
    c.served = false; c.dwell = 0; c.door = 0;
  }
  function makeCar(lane, kind, s) {
    const c = { lane, dir: LANES[lane].dir, laneY: LANES[lane].y, s, v: 0, dist: rand() * 50, block: 0, tut: 0, brake: false, commit: -1, lastCw: -1, why: null };
    dress(c, kind);
    c.v = c.cruise;
    return c;
  }
  // startuppställning: 4 bilar västerut, buss + 3 bilar österut
  {
    const loop = CITY.W + 2 * M;
    const plan = [[0, ['sedan', 'halvkombi', 'taxi', 'skapbil']], [1, ['buss', 'sedan', 'pickup', 'halvkombi']]];
    for (const [lane, kinds] of plan) {
      kinds.forEach((k, i) => {
        cars.push(makeCar(lane, k === 'sedan' && rand() < 0.3 ? pickKind() : k, -M + (i + 0.35 + rand() * 0.3) * (loop / kinds.length)));
      });
    }
  }

  const frontX = (c) => (c.dir > 0 ? c.s : CITY.W - c.s);
  const leftX = (c) => (c.dir > 0 ? c.s - c.L : CITY.W - c.s);

  function nextCrosswalk(c, front) {
    let best = null;
    for (const cw of CROSSWALKS) {
      const xs = c.dir > 0 ? cw.x0 - 6 : cw.x1 + 6;
      const d = (xs - front) * c.dir;
      if (d > -2 && (!best || d < best.d)) best = { i: cw.i, d };
    }
    return best;
  }

  function puff(c) {
    const rear = c.dir > 0 ? c.s - c.L : CITY.W - c.s + c.L;
    puffs.push({ x: rear - c.dir * 2, y: c.laneY - 3, vx: -c.dir * (6 + rand() * 6), vy: -4 - rand() * 4, life: 0, max: 0.9 + rand() * 0.6, lane: c.laneY });
  }

  function stepCar(c, lead, dt) {
    const front = frontX(c), vStop = (d) => Math.sqrt(2 * B * Math.max(0, d));
    let vT = c.cruise, why = null;
    const lim = (v, tag) => { if (v < vT) { vT = v; why = tag; } };
    // bilen framför
    if (lead) {
      const gap = lead.s - lead.L - c.s - GAP;
      lim(gap > 0 ? Math.sqrt(2 * B * gap + lead.v * lead.v) : 0, 'kö');
    }
    // trafikljuset
    const cw = nextCrosswalk(c, front);
    if ((cw ? cw.i : -1) !== c.lastCw) { c.lastCw = cw ? cw.i : -1; c.commit = -1; }
    if (cw && c.commit !== cw.i) {
      const st = carLight(cw.i);
      if (st === 'g') { if (cw.d < 1) c.commit = cw.i; }
      else if (st === 'y' && cw.d <= (c.v * c.v) / 220 + 2) c.commit = cw.i;   // för nära för att stanna – kör
      else lim(vStop(cw.d), 'ljus');
    }
    // folk på vägen framför
    const band = BAND[c.lane];
    for (const p of env.people || []) {
      if (!p || p.y < band[0] || p.y > band[1]) continue;
      const ahead = (p.x - front) * c.dir;
      if (ahead < -6 || ahead > 110) continue;
      lim(vStop(ahead - 16), p === env.player ? 'spelare' : 'folk');
    }
    // bussen stannar vid hållplatsen
    if (c.spec.bus && !c.served) {
      const d = (BUS_STOP.x + 10 - front) * c.dir;
      if (c.dwell > 0) {
        lim(0, 'hållplats');
        c.dwell -= dt;
        if (c.dwell <= 0) { c.served = true; c.dwell = 0; c.leave = 1.4; }
      } else if (d > -4) {
        lim(vStop(d), 'hållplats');
        if (Math.abs(d) < 2 && c.v < 3) c.dwell = 5.5;
      }
    }
    if (c.spec.bus) {
      c.leave = Math.max(0, (c.leave || 0) - dt);
      const want = c.dwell > 0.9 && c.dwell < 5.0 ? 1 : 0;
      c.door += Math.sign(want - c.door) * Math.min(Math.abs(want - c.door), dt * 2.5);
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
    // avgaspuffar när bilen startar från stillastående
    if (was < 10 && vT > was + 4 && rand() < dt * (c.spec.bus ? 10 : 5) && puffs.length < 40) puff(c);
    else if (c.v < 1 && rand() < dt * 0.7 && puffs.length < 40) puff(c);
    // tuta på spelaren som står i vägen
    if (why === 'spelare' && c.v < 3) c.block += dt; else c.block = Math.max(0, c.block - dt);
    if (c.block > 2.5 && T - lastHonk > 6) {
      lastHonk = T; c.tut = 1.2; c.block = 0;
      try { env.play?.('honk'); } catch { /* ljudet får aldrig stoppa trafiken */ }
    }
    c.tut = Math.max(0, c.tut - dt);
  }

  function update(dt) {
    dt = Math.min(0.1, Math.max(0, dt || 0));
    T += dt;
    for (let lane = 0; lane < LANES.length; lane++) {
      const list = cars.filter((c) => c.lane === lane).sort((a, b) => a.s - b.s);
      for (let k = list.length - 1; k >= 0; k--) stepCar(list[k], list[k + 1] || null, dt);
      // ut ur världen → in i andra änden (bakom den som ligger sist)
      for (const c of list) {
        if (c.s - c.L <= CITY.W + M) continue;
        let minRear = Infinity;
        for (const o of list) if (o !== c) minRear = Math.min(minRear, o.s - o.L);
        if (c.spec.bus) { c.served = false; c.dwell = 0; c.door = 0; } else dress(c, pickKind());
        c.s = Math.min(-M, minRear - GAP - 12);
        c.v = c.cruise * 0.8;
        c.commit = -1; c.lastCw = -1; c.block = 0; c.tut = 0;
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5;
      if (p.life >= p.max) puffs.splice(i, 1);
    }
  }

  // ---------- ritning ----------
  function bubble(ctx, x, y) {
    const str = 'TUT!', w = textW(SMALL, str) + 6, h = 9, bx = x - (w >> 1), by = y - h - 2;
    ctx.fillStyle = '#1c1a22'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = '#1c1a22'; ctx.fillRect(x - 1, by + h + 1, 3, 1); ctx.fillRect(x, by + h + 2, 1, 1);
    ctxText(ctx, SMALL, str, bx + 3, by + 2, '#c0282a');
  }
  function drawCar(ctx, c) {
    const A = vehicleArt(c), s = c.spec, L = s.L, f = c.dir < 0 ? 1 : 0;
    const x0 = Math.round(leftX(c)), top = c.laneY - 1 - A.gy;
    ctx.drawImage(A.img[f], x0 - 1, top);
    if (c.brake) ctx.drawImage(A.brake[f], x0 - 1, top);
    // bussens dörrar glider isär från mitten
    if (A.door && c.door > 0.02) {
      for (const [d0, d1] of s.doors) {
        const w = d1 - d0 + 1, open = Math.round(w * c.door);
        if (open < 2) continue;
        const q0 = f ? L - 1 - d1 : d0, sx = 1 + q0 + ((w - open) >> 1);
        const y0 = A.gy - s.winTop, hh = s.winTop - A.hb[d0];
        ctx.drawImage(A.door[f], sx, y0, open, hh, x0 - 1 + sx, top + y0, open, hh);
      }
    }
    // hjulen
    const n = RIMN[s.rim], per = (Math.PI * 2) / n, rot = (c.dist / s.r) * c.dir;
    const fr = Math.floor(((((rot % per) + per) % per) / per) * NF) % NF;
    const wimg = wheelArt(s.r, s.rim, fr);
    for (const wx of s.wheels) {
      const q = f ? L - 1 - wx : wx;
      ctx.drawImage(wimg, x0 + q - s.r, c.laneY - 1 - 2 * s.r);
    }
    // bussen blinkar ut från hållplatsen
    if (s.bus && ((c.dwell > 0 && c.dwell < 1.8) || c.leave > 0) && Math.floor(T * 3) % 2 === 0) {
      ctx.fillStyle = '#ffb020';
      ctx.fillRect(f ? x0 : x0 + L - 2, c.laneY - 15, 2, 2);
      ctx.fillRect(f ? x0 + L - 2 : x0, c.laneY - 20, 2, 2);
    }
    if (c.tut > 0) bubble(ctx, x0 + (L >> 1), c.laneY - 1 - A.topH - 2);
  }
  function drawPole(ctx, l) {
    const A = poleArt(l.side, null, carLight(l.crosswalk), pedLight(l.crosswalk));
    ctx.drawImage(A.img, l.x - A.px, l.y - A.fy);
  }

  const obstacles = LIGHTS.map((l) => [l.x - 3, l.y - 2, l.x + 4, l.y + 1]);

  return {
    obstacles,
    update,
    pedGreen,
    // extra för andra moduler: lägen och fordonens positioner
    carLight, pedLight,
    vehicles: () => cars.map((c) => ({ x0: leftX(c), x1: leftX(c) + c.L, y: c.laneY, dir: c.dir, v: c.v, kind: c.kind, why: c.why, tut: c.tut > 0 })),
    items() {
      const out = [];
      for (const l of LIGHTS) out.push({ x: l.x, y: l.y, draw: (ctx) => drawPole(ctx, l) });
      for (const c of cars) {
        const x = leftX(c) + c.L / 2;
        if (x < -120 || x > CITY.W + 120) continue;
        out.push({ x, y: c.laneY, draw: (ctx) => drawCar(ctx, c) });
      }
      for (const p of puffs) {
        out.push({ x: p.x, y: p.lane + 0.5, draw: (ctx) => {
          const t = p.life / p.max, a = (1 - t) * 0.45, sz = t < 0.35 ? 2 : 3;
          ctx.fillStyle = `rgba(206,206,212,${a.toFixed(3)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
        } });
      }
      return out;
    },
    glow(ctx) {
      const k = Math.min(1, (env.dark || 0) / 0.4);
      if (k <= 0.02) return;
      ctx.globalCompositeOperation = 'lighter';
      // tända signallampor
      for (const l of LIGHTS) {
        const cs = carLight(l.crosswalk), ps = pedLight(l.crosswalk);
        const on = [];
        if (cs === 'r' || cs === 'ry') on.push('r');
        if (cs === 'y' || cs === 'ry') on.push('y');
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
        const x0 = Math.round(leftX(c));
        if (x0 > CITY.W + 80 || x0 + c.L < -80) continue;
        const A = vehicleArt(c), s = c.spec, f = c.dir < 0 ? 1 : 0;
        const top = c.laneY - 1 - A.gy;
        const hy = c.laneY - 1 - Math.round((s.head.h0 + s.head.h1) / 2);
        const fx = c.dir > 0 ? x0 + c.L : x0 - 1;
        const bm = beam(c.dir);
        ctx.globalAlpha = k;
        ctx.drawImage(bm.img, c.dir > 0 ? fx : fx - bm.len + 1, hy - bm.row);
        const pool = blob('pool', 0xfff0c8, 24, 4, 0.22, false);
        ctx.drawImage(pool.img, fx + c.dir * 30 - pool.ox, c.laneY - 2 - pool.oy);
        const hl = blob('head', 0xfff8e0, 3, 2, 0.95, false);
        ctx.drawImage(hl.img, fx - c.dir - hl.ox, hy - hl.oy);
        const ty = c.laneY - 1 - Math.round((s.tail.h0 + s.tail.h1) / 2);
        const tx = c.dir > 0 ? x0 : x0 + c.L - 1;
        const tg = blob('tail', 0xff2a1a, 5, 3, 0.6, false);
        ctx.globalAlpha = k * (c.brake ? 1 : 0.6);
        ctx.drawImage(tg.img, tx - tg.ox, ty - tg.oy);
        if (A.night) { ctx.globalAlpha = k * 0.8; ctx.drawImage(A.night[f], x0 - 1, top); }
        if (s.taxi) {
          const sg = blob('taxi', 0xfff0b0, 12, 5, 0.35, false);
          ctx.globalAlpha = k;
          ctx.drawImage(sg.img, x0 + (f ? c.L - 27 : 26) - sg.ox, c.laneY - 1 - 28 - sg.oy);
        }
        if (s.brand === 'glass') {
          const sg = blob('ice', 0xff9ac8, 20, 7, 0.3, false);
          ctx.globalAlpha = k;
          ctx.drawImage(sg.img, x0 + (f ? c.L - 28 : 27) - sg.ox, c.laneY - 1 - 40 - sg.oy);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
