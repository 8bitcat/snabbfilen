// Rekvisitan i Pixelstaden – allt som står på trottoarerna, i tvärgatorna och
// i parken: gatuträd i trädgaller, parkträd, blomsterlådor, krukor, rabatter,
// häckar, buskar, gatlyktor, parklyktor, bänkar, papperskorgar, cykelställ,
// brandposter, brevlåda, löpsedelställ, gatuskyltar, kaféterrassen, frukt-
// disken och kundvagnarna vid Stormarknad, busskuren och fontänen på torget.
//
// All konst målas EN gång med Pix-pennan (ett pixelkorn: 1 enhet = 1 pixel)
// och cachas som canvasar. Per bildruta ritas bara färdiga bilder på heltal:
// kronorna vajar genom att tre band förskjuts en pixel, fontänen bläddrar
// mellan förmålade vattenrutor och kvällsljuset läggs i glow().
//
// Kontrakt: createProps(env) → { items(), obstacles, update(dt), glow(ctx) }
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW } from '../core/floor-pix.js';
import { CITY, BUILDINGS, CROSSWALKS, PARK_LAYOUT, BUS_STOP, RESERVED, footprint } from './map.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- paletter (mörk → ljus) ----------
const WOOD = [0x3a2214, 0x5e3a20, 0x86562e, 0xae7640, 0xd29a5c];
const TEAK = [0x2e1c12, 0x4e321e, 0x74502e, 0x9a6e40, 0xbe9058];
const IRON = [0x101216, 0x1e2228, 0x30363e, 0x4a525c, 0x6e7884];
const STEEL = [0x3e444c, 0x646c76, 0x8e98a2, 0xbcc4cc, 0xe6ecf0];
const POLE = [0x161e1c, 0x26322e, 0x3a4844, 0x56665f, 0x7c8e86];
const STONE = [0x524e46, 0x767064, 0x9a9484, 0xbeb8a6, 0xdcd6c4];
const GRANITE = [0x5a5854, 0x7c7a74, 0xa09e96, 0xbebcb4, 0xdcdad2];
const SOIL = [0x24160e, 0x3a2616, 0x523822, 0x6a4a2e];
const LEAVES = [0x10260f, 0x1c3e18, 0x2c5a22, 0x40782c, 0x5e9a3a, 0x86bc52];
const BOX = [0x0c200e, 0x163418, 0x224c22, 0x32662c, 0x4a843a, 0x6ea24c];
const WATER = [0x103a58, 0x1a5478, 0x28709a, 0x4492bc, 0x7cc0e0, 0xc8eefa];
const FL = {
  red: [0x7a1018, 0xcc2a34, 0xff6a62], pink: [0x8a2058, 0xe0609e, 0xffb0d2], yellow: [0x9a6c0c, 0xf0c020, 0xfff088],
  white: [0x8e8e9c, 0xe6e4de, 0xffffff], purple: [0x40206c, 0x8446cc, 0xc49aff], orange: [0x9a420c, 0xf07e24, 0xffbe6a],
  blue: [0x1e347e, 0x4462d8, 0x9cb2ff],
};

// ---------- grundverktyg ----------
// välj ton ur en palett; ordnad dithering bara i övergången mellan två toner
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
// en sprite: lokal origo (0,0) = fotpunkten, som ligger på canvasens (ax, ay)
function spr(w, h, ax, ay, fn) {
  const P = new Pix(w, h, -ax, -ay);
  fn(P);
  return { img: P.flush(), ax, ay, w, h };
}
function put(ctx, s, x, y) { ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay); }
// slagskugga på marken – bara på tomma pixlar (lägg den sist)
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
// mörk kontur runt allt som är målat: hård nedtill/höger, mjukare upptill/vänster
function outline(P, dark, soft = dark, softA = 0.75) {
  const { w, h, d } = P;
  const A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = A(x, y - 1) || A(x - 1, y), sft = A(x, y + 1) || A(x + 1, y);
    if (hard || sft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, add[i + 2] ? dark : soft, add[i + 2] ? 1 : softA);
}
// pixelcirkel (ring) med heltalscentrum
function ring(P, cx, cy, r, fn) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const dd = Math.hypot(x - cx, y - cy);
    if (Math.abs(dd - r) < 0.55) fn(x, y, (x - cx) / r, (y - cy) / r);
  }
}
// ett blomhuvud: 0 = rund 2×2, 1 = stjärna med gult öga, 2 = tulpan
function bloom(P, x, y, c, kind = 0) {
  if (kind === 1) {
    P.px(x, y - 1, c[2]); P.px(x - 1, y, c[1]); P.px(x + 1, y, c[0]); P.px(x, y + 1, c[0]); P.px(x, y, 0xf8e070);
  } else if (kind === 2) {
    P.px(x, y, c[1]); P.px(x + 1, y, c[0]); P.px(x, y - 1, c[2]); P.px(x + 1, y - 1, c[1]);
  } else {
    P.px(x, y, c[2]); P.px(x + 1, y, c[1]); P.px(x, y + 1, c[1]); P.px(x + 1, y + 1, c[0]);
  }
}
// en träkarm/ribba: två rader (ljus ovansida, mörkare kant) med ådring
function slat(P, x, y, w, sh = 0, pal = WOOD) {
  for (let i = 0; i < w; i++) {
    const g = (hash((x + i) >> 2, y, 5) - 0.5) * 0.14 + sh;
    P.px(x + i, y, tone(pal, 0.8 + g, x + i, y));
    P.px(x + i, y + 1, tone(pal, 0.46 + g, x + i, y + 1));
  }
  P.px(x + w - 1, y, pal[2]); P.px(x + w - 1, y + 1, pal[0]);
}

// ---------- lövverk ----------
// En krona av överlappande klumpar, skuggade med ljus snett uppifrån vänster.
function paintCrown(P, cx, cy, rx, ry, pal, seed, o = {}) {
  const R = Math.min(rx, ry), cl = [{ x: cx, y: cy + ry * 0.1, r: R * 0.68 }];
  const n = o.clumps || 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (hash(i, seed, 1) - 0.5) * 0.8;
    const r = R * (0.34 + hash(i, seed, 3) * 0.17);
    const k = 0.8 + hash(i, seed, 2) * 0.2;
    cl.push({ x: cx + Math.cos(a) * (rx - r) * k, y: cy + Math.sin(a) * (ry - r) * k, r });
  }
  for (let i = 0; i < (o.inner ?? 4); i++) {
    const a = hash(i, seed, 11) * Math.PI * 2, d = 0.25 + 0.3 * hash(i, seed, 13);
    cl.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d - ry * 0.12, r: R * (0.3 + hash(i, seed, 12) * 0.14) });
  }
  cl.sort((a, b) => a.y - b.y);
  const rough = o.rough || 1;
  // pass 1: vilken klump äger varje pixel, och dess grundljus
  const X0 = Math.floor(cx - rx - 2), Y0 = Math.floor(cy - ry - 2), W = Math.ceil(cx + rx + 2) - X0 + 1, H = Math.ceil(cy + ry + 2) - Y0 + 1;
  const own = new Int16Array(W * H).fill(-1), val = new Float32Array(W * H);
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) {
    let hi = -1;
    for (let i = cl.length - 1; i >= 0; i--) {
      const c = cl[i], dd = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
      if (dd < c.r + (hash(x >> 1, y >> 1, seed + i * 7) - 0.5) * 1.8 * rough) { hi = i; break; }
    }
    if (hi < 0) continue;
    if (o.holes && hash(x, y, seed + 5) < o.holes && y < cy + ry * 0.5) continue;
    const c = cl[hi], nx = (x + 0.5 - c.x) / c.r, ny = (y + 0.5 - c.y) / c.r;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let v = 0.47 + 0.42 * (-0.5 * nx - 0.7 * ny + 0.45 * nz) - ((y - cy) / ry) * 0.14 - ((x - cx) / rx) * 0.07;
    v += (hash(x >> 1, y, seed + 77) - 0.5) * 0.14 + (o.lift || 0);
    own[(y - Y0) * W + x - X0] = hi; val[(y - Y0) * W + x - X0] = v;
  }
  // pass 2: klumparna kastar skugga nedåt-höger på klumparna bakom, och får ljus kant uppe till vänster
  const at = (x, y) => (x < X0 || y < Y0 || x >= X0 + W || y >= Y0 + H ? -1 : own[(y - Y0) * W + x - X0]);
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) {
    const k = (y - Y0) * W + x - X0, me = own[k];
    if (me < 0) continue;
    let v = val[k];
    const up = at(x, y - 1), ul = at(x - 1, y - 1), up2 = at(x, y - 2);
    if (up > me || ul > me) v -= 0.26; else if (up2 > me) v -= 0.12;
    else if ((up >= 0 && up < me) || (ul >= 0 && ul < me)) v += 0.1;
    let c = tone(pal, v, x, y);
    const hh = hash(x, y, seed + 9);
    if (hh > 0.95 && v > 0.42) c = pal[Math.min(pal.length - 1, Math.floor(v * (pal.length - 1)) + 2)];
    else if (hh < 0.05 && v < 0.62) c = pal[0];
    if (o.bloom && hash(x, y, seed + 21) < o.bloom) c = o.bloomCol[Math.floor(hash(x, y, seed + 22) * o.bloomCol.length)];
    P.px(x, y, c);
  }
}

// ---------- träd ----------
const TREE = {
  lind: { pal: [0x14301a, 0x204a20, 0x30662a, 0x468634, 0x68a844, 0x98c864], bark: [0x2a1c14, 0x46301f, 0x664830, 0x88684a], rx: 20, ry: 18, cy: -52, top: -36, w: 4, clumps: 11, inner: 5 },
  bjork: { pal: [0x223e1a, 0x365e22, 0x50802c, 0x70a038, 0x9cc452, 0xcce27e], bark: [0x4e4c46, 0x9c988c, 0xd4d0c4, 0xf2f0e8], birch: true, rx: 15, ry: 22, cy: -57, top: -38, w: 3, clumps: 14, inner: 6, holes: 0.05, rough: 1.5 },
  korsbar: { pal: [0x6a2448, 0xa0446e, 0xcc7098, 0xe89ab8, 0xf8c6d8, 0xffeef4], bark: [0x24161a, 0x402624, 0x5e3a32, 0x7e5446], rx: 22, ry: 16, cy: -46, top: -32, w: 4, clumps: 12, inner: 5, bloom: 0.05, bloomCol: [0x4a7a34, 0x6a9a44, 0xffffff], petals: true },
  ek: { pal: [0x0e2412, 0x1a3c1a, 0x285a24, 0x3c7630, 0x5a963e, 0x84b85a], bark: [0x22170f, 0x3e2a1c, 0x5c402a, 0x7c5a3e], rx: 26, ry: 21, cy: -66, top: -46, w: 6, clumps: 14, inner: 7 },
  lonn: { pal: [0x1a3216, 0x2c4e1e, 0x446e28, 0x628e34, 0x88b046, 0xb8d468], bark: [0x2a2018, 0x483626, 0x684e38, 0x8a6e52], rx: 22, ry: 18, cy: -58, top: -42, w: 5, clumps: 12, inner: 6 },
  gran: { pal: [0x0a2016, 0x123222, 0x1c4830, 0x2a6040, 0x3e7a52, 0x5a9868], bark: [0x22160e, 0x3a2818, 0x563c26, 0x6e5034], rx: 15, ry: 32, cy: -38, top: -8, w: 3, spruce: true },
};

// gjutjärnsgaller i trottoaren runt stammen, sett snett uppifrån (21×9 med granitkant)
function paintGrate(P) {
  for (let x = -10; x <= 10; x++) { P.px(x, -4, tone(GRANITE, 0.72 + hash(x, 1, 4) * 0.2, x, -4)); P.px(x, 4, GRANITE[1]); }
  for (let y = -3; y <= 3; y++) { P.px(-10, y, GRANITE[3]); P.px(10, y, GRANITE[1]); }
  for (let y = -3; y <= 3; y++) for (let x = -9; x <= 9; x++) {
    const ry = y * 2.7, dd = Math.max(Math.abs(x), Math.abs(ry));
    let c;
    if (dd > 8.3) c = y === -3 ? 0x5c5e66 : y === 3 ? 0x24262c : 0x3a3c44;
    else if (Math.hypot(x, ry) < 4.4) c = hash(x, y, 6) > 0.8 ? 0x6a5a48 : mix(0x2e1e12, 0x4a3220, hash(x, y, 7));
    else {
      const ringN = Math.floor(dd / 2), bar = ringN % 2 === 0 || (x % 3 === 0 && Math.abs(x) > 2);
      c = bar ? (y <= -1 ? 0x50525a : 0x3e4048) : 0x121316;
    }
    P.px(x, y, c);
  }
}
function paintTrunk(P, top, w, bark, birch, seed) {
  for (let y = top; y <= 0; y++) {
    const fl = y >= -1 ? 2 : y >= -3 ? 1 : 0;
    const ww = w + fl * 2, xl = -Math.floor(ww / 2) + (ww % 2 === 0 ? 1 : 0);
    for (let i = 0; i < ww; i++) {
      const x = xl + i, t = ww > 1 ? i / (ww - 1) : 0.5;
      let v = 0.82 - t * 0.66 + (hash(x, y >> 1, seed + 3) - 0.5) * 0.18;
      if (!birch && hash(x, y >> 2, seed + 4) > 0.86) v -= 0.25;
      let c = tone(bark, v, x, y);
      if (birch && hash(0, y, seed + 5) > 0.72 && hash(x, y, seed + 6) > 0.3) c = hash(x, y, 7) > 0.5 ? 0x24201c : 0x3e3a34;
      P.px(x, y, c);
    }
  }
}
function paintSpruce(P, T, seed) {
  const top = T.cy - T.ry, bottom = T.cy + T.ry;
  for (let y = top; y <= bottom; y++) {
    const dd = y - top, tier = dd % 8;
    const hw = 1 + dd * 0.15 + tier * 0.7;
    for (let x = -Math.ceil(hw) - 1; x <= Math.ceil(hw) + 1; x++) {
      const e = Math.abs(x + 0.5) / hw;
      if (e > 1 + (hash(x, y, seed) - 0.5) * 0.3) continue;
      let v = 0.26 + (tier / 8) * 0.5 - ((x + 0.5) / hw) * 0.22 + (hash(x >> 1, y, seed + 3) - 0.5) * 0.18;
      if (tier >= 6 && e > 0.55) v += 0.12;
      P.px(x, y, tone(T.pal, v, x, y));
    }
  }
  P.px(0, top - 1, T.pal[4]);
}
function makeTree(kind, seed, grate) {
  const T = TREE[kind];
  const bw = 2 * (T.rx + 10), bah = -T.top + 12;
  const base = spr(bw, bah + 8, T.rx + 10, bah, (P) => {
    if (grate) paintGrate(P);
    paintTrunk(P, T.top, T.w, T.bark, T.birch, seed);
    if (!T.spruce) {
      const b = T.bark;
      P.line(0, T.top + 8, -Math.round(T.rx * 0.45), T.top - 3, b[1]);
      P.line(1, T.top + 6, Math.round(T.rx * 0.5), T.top - 5, b[1]);
      P.line(0, T.top + 3, -2, T.top - 9, b[2]);
    }
    if (!grate) { // rotben och lite gräs vid foten
      P.px(-3, 0, T.bark[1]); P.px(3, 0, T.bark[0]);
      for (let x = -6; x <= 6; x++) if (hash(x, 0, seed) > 0.55) P.px(x, 1, hash(x, 1, seed) > 0.5 ? 0x4a8a34 : 0x2e6a26);
    }
    if (T.petals) for (let i = 0; i < 22; i++) { // nedfallna kronblad runt galler/rot
      const a = hash(i, seed, 41) * Math.PI * 2, r = 0.35 + hash(i, seed, 42) * 0.65;
      P.px(Math.round(Math.cos(a) * T.rx * 0.9 * r) + 3, Math.round(Math.sin(a) * 5 * r) + 1, hash(i, seed, 43) > 0.5 ? 0xffd4e2 : 0xf09ab8);
    }
    groundShadow(P, 5, 1, T.rx * 0.9, 3.8, 0.32);
  });
  const cw = 2 * T.rx + 9, ch = 2 * T.ry + 9;
  const crown = spr(cw, ch, T.rx + 4, T.ry + 4 - T.cy, (P) => {
    if (T.spruce) paintSpruce(P, T, seed);
    else paintCrown(P, 0, T.cy, T.rx, T.ry, T.pal, seed, T);
    if (T.birch) { // björkens hängande kvistar
      for (let x = -T.rx + 1; x < T.rx; x++) {
        if (hash(x, seed, 31) < 0.45) continue;
        let yl = null;
        for (let yy = P.h - 1; yy >= 0; yy--) if (P.d[(yy * P.w + x - P.ox) * 4 + 3] > 200) { yl = yy + P.oy; break; }
        if (yl === null) continue;
        const len = Math.min(2 + Math.floor(hash(x, seed, 32) * 5), P.oy + P.h - 3 - yl);
        for (let k = 1; k <= len; k++) if (hash(x, k, seed + 33) > 0.2) P.px(x, yl + k, T.pal[(k & 1) ? 3 : 2]);
      }
    }
    outline(P, T.pal[0], mix(T.pal[0], T.pal[1], 0.5), 0.8);
  });
  return { base, crown, T };
}
// kronan i tre band som förskjuts olika mycket – ger ett mjukt vajande
function drawCrown(ctx, s, x, y, sway) {
  const img = s.img, w = img.width, h = img.height, dx = Math.round(x) - s.ax, dy = Math.round(y) - s.ay;
  const b1 = Math.floor(h * 0.36), b2 = Math.floor(h * 0.68);
  const o1 = Math.round(sway), o2 = Math.round(sway * 0.5);
  ctx.drawImage(img, 0, 0, w, b1, dx + o1, dy, w, b1);
  ctx.drawImage(img, 0, b1, w, b2 - b1, dx + o2, dy + b1, w, b2 - b1);
  ctx.drawImage(img, 0, b2, w, h - b2, dx, dy + b2, w, h - b2);
}

// ---------- lyktor ----------
function paintStreetLamp(P, m) {
  // sockel med serviceslucka
  for (let y = -7; y <= 0; y++) for (let x = -2; x <= 3; x++) {
    let v = 0.8 - ((x + 2) / 5) * 0.6 + (y === -7 ? 0.18 : 0) - (y === 0 ? 0.3 : 0);
    P.px(x, y, tone(POLE, v, x, y));
  }
  P.rect(-1, -5, 3, 3, POLE[1]); P.hl(-1, -5, 3, POLE[0]); P.px(1, -4, POLE[3]);
  // stolpen
  for (let y = -60; y <= -8; y++) {
    P.px(0, y, hash(0, y, 3) > 0.92 ? POLE[4] : POLE[3]);
    P.px(1, y, POLE[1]);
  }
  P.hl(-1, -34, 4, POLE[2]); P.px(-1, -34, POLE[4]); P.px(2, -34, POLE[0]);
  // böjd arm och lykthuvud
  const ax = (i) => (m > 0 ? 1 + i : -i);
  P.px(0, -61, POLE[3]); P.px(1, -61, POLE[2]);
  P.px(ax(1), -62, POLE[3]); P.px(ax(1), -61, POLE[1]);
  for (let i = 2; i <= 8; i++) { P.px(ax(i), -63, POLE[4]); P.px(ax(i), -62, POLE[2]); }
  const hx0 = m > 0 ? 6 : -12;
  for (let x = hx0; x < hx0 + 8; x++) {
    P.px(x, -62, x === hx0 || x === hx0 + 7 ? POLE[2] : POLE[3]);
    P.px(x, -61, POLE[2]); P.px(x, -60, POLE[1]);
  }
  P.hl(hx0 + 1, -63, 6, POLE[4]);
  P.hl(hx0 + 1, -59, 6, 0xcfd6cc); P.px(hx0 + 1, -59, 0xa8b0a6); P.px(hx0 + 6, -59, 0x9aa298);
  groundShadow(P, 2, 1, 6, 2, 0.3);
}
function paintParkLamp(P) {
  const K = [0x0c0c10, 0x1a1a22, 0x2c2c38, 0x484858, 0x767688];
  P.rect(-3, -1, 7, 2, K[1]); P.hl(-3, -1, 7, K[3]); P.px(3, 0, K[0]);
  P.rect(-2, -4, 5, 3, K[1]); P.hl(-2, -4, 5, K[3]); P.vl(2, -3, 2, K[0]);
  P.rect(-1, -7, 3, 3, K[2]); P.px(-1, -7, K[4]); P.vl(1, -6, 2, K[0]);
  for (let y = -30; y <= -8; y++) { P.px(0, y, K[3]); P.px(1, y, K[1]); }
  P.hl(-1, -15, 4, K[2]); P.px(-1, -15, K[4]); P.px(2, -15, K[0]);
  P.hl(-1, -29, 4, K[2]); P.px(-1, -29, K[4]);
  // lyktan: krage, glasrutor, tak med spira
  P.hl(-2, -31, 6, K[2]); P.hl(-1, -32, 4, K[3]);
  for (let y = -41; y <= -33; y++) {
    P.px(-3, y, K[2]); P.px(4, y, K[0]); P.px(0, y, K[3]); P.px(1, y, K[1]);
    for (const x of [-2, -1, 2, 3]) {
      const g = y === -40 || x === -2 ? 0xd4ddd8 : mix(0x7c8c90, 0xaab8b8, (y + 41) / 8);
      P.px(x, y, g);
    }
  }
  P.hl(-3, -37, 8, K[2]);
  P.hl(-4, -42, 10, K[3]); P.px(5, -42, K[1]);
  P.hl(-3, -43, 8, K[3]); P.px(-3, -43, K[4]);
  P.hl(-2, -44, 6, K[2]); P.hl(-1, -45, 4, K[3]); P.hl(0, -46, 2, K[2]); P.px(0, -47, K[4]); P.px(0, -48, K[3]);
  groundShadow(P, 2, 1, 6, 2, 0.3);
}
// ljuskäglor (ritas med 'lighter'): origo = lamphuvudets x på marken
function paintLampGlow(P, hy, spread, pool, halo) {
  for (let y = hy + 2; y <= 2; y++) {
    const t = (y - hy) / -hy, hw = 1.5 + t * spread;
    for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) {
      const e = 1 - Math.abs(x) / hw;
      if (e <= 0) continue;
      const a = (0.2 * (1 - t) + 0.05) * Math.pow(e, 0.7);
      const q = Math.floor(a * 30 + bayer(x, y)) / 30;
      if (q > 0) P.px(x, y, 0xffd49a, q);
    }
  }
  P.ell(0, 1, pool, pool * 0.32, 0xffcc88, 0.42, 5);
  P.ell(0, hy, halo, halo * 0.8, 0xfff0c8, 0.85, 5);
}

// ---------- bänkar, korgar, skyltar ----------
function paintBench(P, back) {
  if (!back) {
    for (const x of [-12, 11]) { P.vl(x, -20, 11, IRON[2]); P.px(x, -20, IRON[4]); }
    for (const y of [-19, -16, -13]) slat(P, -13, y, 26, 0.05);
    slat(P, -14, -10, 28, 0.12); slat(P, -14, -8, 28, 0.02);
    P.hl(-14, -6, 28, WOOD[0]);
    for (const s of [0, 1]) {
      const x = s ? 12 : -13, o = s ? 1 : -1, i = s ? -1 : 1;
      P.hl(Math.min(x, x + o * 2), -12, 3, IRON[3]); P.px(x + o * 2, -11, IRON[2]); P.px(x + o, -12, IRON[4]);
      P.vl(x, -11, 5, IRON[1]);
      P.vl(x, -5, 5, IRON[2]); P.vl(x + i, -5, 5, IRON[1]); P.px(x, -5, IRON[4]);
      P.px(x + i * 2, -3, IRON[1]); P.px(x + i * 2, -2, IRON[2]);
      P.hl(Math.min(x, x + i) - 1, 0, 4, IRON[0]);
    }
  } else {
    P.hl(-13, -8, 26, WOOD[0]);
    for (const y of [-17, -14, -11]) slat(P, -14, y, 28, -0.18);
    for (const s of [0, 1]) {
      const x = s ? 11 : -12, i = s ? 1 : -1;
      P.vl(x, -18, 18, IRON[2]); P.vl(x + i, -18, 18, IRON[1]); P.px(x, -18, IRON[4]);
      P.hl(Math.min(x, x + i) - 1, 0, 4, IRON[0]);
    }
  }
  groundShadow(P, 2, 0, 16, 3, 0.3);
}
function paintBin(P) {
  const G = [0x0e2014, 0x183424, 0x264e36, 0x3a6c4c, 0x5a8e68];
  for (let y = -12; y <= 0; y++) for (let x = -4; x <= 3; x++) {
    let v = 0.84 - ((x + 4) / 7) * 0.62 + ((x & 1) ? -0.07 : 0.07);
    if (y === 0) v -= 0.35; if (y === -12) v += 0.12;
    P.px(x, y, tone(G, v, x, y));
  }
  P.hl(-4, -9, 8, G[0]); P.hl(-4, -2, 8, G[1]);
  P.rect(-2, -7, 3, 2, 0xd8d4c4); P.px(-1, -7, 0x3a6c4c); P.px(0, -6, 0xa8a494);
  P.hl(-3, -15, 6, G[4]); P.px(-4, -14, G[3]); P.hl(-3, -14, 6, 0x08090a); P.px(3, -14, G[2]);
  P.hl(-4, -13, 8, G[3]); P.px(-4, -13, G[4]); P.px(3, -13, G[1]);
  P.px(-2, -14, 0xe8e8e0); P.px(-1, -15, 0xd8d8d0); P.px(2, -14, 0xb8b8b0);
  groundShadow(P, 2, 0, 6, 2);
}
function paintHydrant(P) {
  const R = [0x5a0e14, 0x8e1820, 0xc42a2e, 0xe8564a, 0xff9a86];
  for (let x = -4; x <= 4; x++) { P.px(x, 0, R[0]); P.px(x, -1, tone(R, 0.75 - ((x + 4) / 8) * 0.55, x, -1)); }
  for (let y = -10; y <= -2; y++) for (let x = -3; x <= 3; x++) P.px(x, y, tone(R, 0.86 - ((x + 3) / 6) * 0.66 + (y === -10 ? 0.1 : 0), x, y));
  P.hl(-3, -9, 7, 0xf0c838); P.px(-3, -9, 0xfff08a); P.px(3, -9, 0xa88420);
  P.hl(-2, -11, 5, R[3]); P.px(2, -11, R[1]); P.hl(-1, -12, 3, R[4]); P.px(1, -12, R[2]); P.px(0, -13, R[1]); P.px(0, -14, 0xf0c838);
  P.rect(-6, -7, 3, 2, R[2]); P.px(-6, -7, R[4]); P.vl(-7, -8, 4, 0xe8c030); P.px(-7, -5, 0xa88420);
  P.rect(4, -7, 2, 2, R[1]); P.vl(6, -8, 4, 0xc8a028);
  P.rect(-1, -5, 3, 2, R[1]); P.hl(-1, -5, 3, R[3]); P.px(0, -4, 0xf0c838);
  groundShadow(P, 2, 1, 6, 2);
}
function paintMailbox(P) {
  const Y = [0x7a5a08, 0xb88a10, 0xe8b820, 0xffd84a, 0xfff0a0];
  for (let y = -14; y <= 0; y++) { P.px(0, y, STEEL[2]); P.px(1, y, STEEL[0]); }
  P.hl(-1, 0, 4, STEEL[0]);
  for (let y = -27; y <= -14; y++) for (let x = -5; x <= 6; x++) {
    if (y === -27 && (x === -5 || x === 6)) continue;
    const v = 0.86 - ((x + 5) / 11) * 0.55 - (y === -14 ? 0.3 : 0) + (y <= -26 ? 0.14 : 0);
    P.px(x, y, tone(Y, v, x, y));
  }
  P.hl(-3, -24, 8, Y[4]); P.hl(-3, -23, 8, 0x1a1408); P.hl(-3, -22, 8, Y[1]);
  const B = 0x1f4aa0, B2 = 0x2c64c8;
  P.hl(-1, -19, 3, B2); P.px(-2, -18, B); P.px(2, -18, B); P.hl(-1, -17, 3, B); P.px(3, -19, B); P.px(4, -20, B2); P.px(0, -18, 0xffe890);
  P.hl(-5, -15, 12, Y[0]);
  groundShadow(P, 2, 1, 5, 2);
}
function paintNewsStand(P) {
  const x0 = -13, w = 26, top = -22;
  P.line(x0 + 2, top + 18, x0, 0, IRON[2]); P.line(x0 + w - 3, top + 18, x0 + w - 1, 0, IRON[1]);
  P.rect(x0, top, w, 19, IRON[1]); P.hl(x0, top, w, IRON[3]); P.vl(x0, top + 1, 18, IRON[2]);
  for (let y = top + 1; y < top + 18; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) P.px(x, y, mix(0xfff26a, 0xf0c820, (y - top) / 18 + (bayer(x, y) - 0.5) * 0.18));
  text(P, BIG, 'SOL!', x0 + 4, top + 2, 0x141414);
  P.hl(x0 + 2, top + 10, w - 4, 0xd02020);
  text(P, SMALL, 'I HELG', x0 + 2, top + 12, 0xc01818);
  P.hl(x0 + 1, top + 17, w - 2, 0xb89010);
  groundShadow(P, 2, 1, 14, 2.5);
}
function makeStreetSign(name, dir) {
  const tw = textW(SMALL, name), pw = tw + 6, W = pw + 8;
  const ax = dir > 0 ? 3 : W - 5;
  return spr(W, 56, ax, 52, (P) => {
    for (let y = -46; y <= 0; y++) { P.px(0, y, STEEL[3]); P.px(1, y, STEEL[1]); }
    P.hl(-1, 0, 4, STEEL[0]); P.hl(-1, -1, 4, STEEL[2]);
    P.px(0, -47, STEEL[4]); P.px(1, -47, STEEL[2]);
    const px0 = dir > 0 ? 2 : -pw;
    // plåten: blå rad både över och under texten, så att den vita ramen aldrig nuddar bokstäverna
    for (let y = -49; y <= -39; y++) for (let x = px0; x < px0 + pw; x++) {
      let c = mix(0x1a4a9a, 0x2a62b8, (bayer(x, y) - 0.5) * 0.3 + 0.5);
      if (y === -49) c = 0x4a82d8; if (y === -39) c = 0x0e2a5e;
      if (x === px0) c = mix(c, 0xffffff, 0.2); if (x === px0 + pw - 1) c = mul(c, 0.7);
      P.px(x, y, c);
    }
    P.box(px0 + 1, -48, pw - 2, 9, 0xe8eef6);
    text(P, SMALL, name, px0 + 3, -46, 0xffffff);
    P.px(dir > 0 ? 1 : 0, -47, STEEL[2]); P.px(dir > 0 ? 1 : 0, -41, STEEL[2]);
    groundShadow(P, 2, 1, 4, 1.6);
  });
}

// ---------- blommor och växter ----------
function paintFlowerBox(P, w, seed, cols, style) {
  const x0 = -(w >> 1), x1 = x0 + w - 1;
  const pal = style === 'zink' ? STEEL : style === 'svart' ? IRON : WOOD;
  for (let i = 0; i < Math.ceil(w / 5); i++) {
    const cx = x0 + 2 + i * 5 + Math.round(hash(i, seed, 1) * 2);
    paintCrown(P, cx, -10, 3.4, 3 + hash(i, seed, 2) * 1.6, LEAVES, seed + i * 13, { clumps: 3, inner: 1, lift: 0.05 });
  }
  for (let i = 0; i < w - 1; i += 2) {
    if (hash(i, seed, 5) < 0.3) continue;
    const x = x0 + 1 + i, y = -11 - Math.round(hash(i, seed, 6) * 4);
    bloom(P, x, y, FL[cols[Math.floor(hash(i, seed, 7) * cols.length)]], hash(i, seed, 8) > 0.6 ? 1 : 0);
  }
  for (let y = -7; y <= 0; y++) for (let x = x0; x <= x1; x++) {
    let v = 0.64 - ((x - x0) / w) * 0.3 + (y === -7 ? 0.28 : 0) - (y === 0 ? 0.3 : 0);
    if (style === 'tra') { if ((y + 7) % 3 === 2) v -= 0.2; v += (hash(x >> 2, y, seed) - 0.5) * 0.14; }
    else if ((y === -5 || y === -2) && x > x0 && x < x1) v -= 0.12;
    if (x === x0) v += 0.14; if (x === x1) v -= 0.22;
    P.px(x, y, tone(pal, v, x, y));
  }
  P.hl(x0 + 1, -8, w - 2, SOIL[2]);
  for (let i = 1; i < w - 1; i++) if (hash(i, seed, 9) > 0.8) {
    const x = x0 + i, len = 1 + Math.floor(hash(i, seed, 10) * 3);
    for (let k = 0; k < len; k++) P.px(x, -6 + k, k === len - 1 && hash(i, seed, 11) > 0.5 ? FL[cols[0]][1] : LEAVES[4 - (k & 1)]);
  }
  outline(P, 0x141018, 0x141018, 0.45);
  groundShadow(P, 2, 0, w / 2 + 2, 2.5);
}
function paintPot(P, plant, seed) {
  if (plant === 'klot') {
    paintCrown(P, 0, -17, 6.5, 6.5, BOX, seed, { clumps: 7, inner: 2 });
  } else if (plant === 'kon') {
    for (let y = -30; y <= -10; y++) {
      const hw = 1 + (y + 30) * 0.3;
      for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) {
        if (Math.abs(x + 0.5) > hw + (hash(x, y, seed) - 0.5) * 0.8) continue;
        P.px(x, y, tone(BOX, 0.62 - ((x + 0.5) / hw) * 0.3 + (hash(x >> 1, y, seed + 1) - 0.5) * 0.25 - ((y + 30) / 20) * 0.15, x, y));
      }
    }
  } else if (plant === 'gras') {
    const G = [0x5a7a2a, 0x7a9a3a, 0xa8c05a, 0xd8d888];
    for (let i = 0; i < 15; i++) {
      const bx = -5 + Math.round(i * 0.72), lean = (i - 7) * 0.9 + (hash(i, seed, 1) - 0.5) * 4, h = 14 + hash(i, seed, 2) * 10;
      P.line(bx, -10, Math.round(bx + lean), Math.round(-10 - h), G[i % 3]);
      P.px(Math.round(bx + lean), Math.round(-10 - h), G[3]); P.px(Math.round(bx + lean), Math.round(-9 - h), 0xece0b0);
    }
  } else if (plant === 'pelargon') {
    paintCrown(P, 0, -14, 7, 5, LEAVES, seed, { clumps: 6, inner: 2, lift: 0.05 });
    for (let i = 0; i < 7; i++) bloom(P, -5 + Math.round(hash(i, seed, 3) * 10), -19 + Math.round(hash(i, seed, 4) * 6), FL[i % 3 ? 'red' : 'pink'], 1);
  } else if (plant === 'palm') {
    for (let y = -24; y <= -10; y++) { P.px(0, y, (y & 1) ? 0x7a5a3a : 0x5a3e26); P.px(1, y, 0x3e2a1a); }
    const F = [0x1e5a24, 0x2e7a30, 0x4a9a3e, 0x74b852];
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * (0.08 + k * 0.14), len = 9 + hash(k, seed, 1) * 3;
      let px = 0, py = -25;
      for (let s = 0; s < len; s++) {
        px += Math.cos(a); py += Math.sin(a) + s * 0.09;
        P.px(Math.round(px), Math.round(py), F[1 + (s & 1)]); P.px(Math.round(px), Math.round(py) + 1, F[0]);
        if (s % 2 === 0) P.px(Math.round(px), Math.round(py) - 1, F[3]);
      }
    }
  }
  if (plant !== 'gras' && plant !== 'palm') outline(P, BOX[0], BOX[1], 0.6);
  // betongkrukan
  for (let y = -10; y <= 0; y++) {
    const hw = 7 - Math.round(((y + 10) / 10) * 2);
    for (let x = -hw; x < hw; x++) {
      let v = 0.82 - ((x + hw) / (2 * hw)) * 0.6 + (hash(x, y, seed) - 0.5) * 0.1;
      if (y <= -9) v += 0.14; if (y === -8) v -= 0.22; if (y === 0) v -= 0.32;
      P.px(x, y, tone(GRANITE, v, x, y));
    }
  }
  P.hl(-5, -10, 10, SOIL[1]); P.px(-6, -10, GRANITE[4]);
  groundShadow(P, 3, 0, 9, 2.4);
}
function paintBed(P, w, seed, rows) {
  const x0 = -(w >> 1), x1 = x0 + w - 1, D = 9;
  for (let y = -D; y <= -2; y++) for (let x = x0 + 1; x < x1; x++) P.px(x, y, tone(SOIL, 0.45 + (hash(x, y, seed) - 0.5) * 0.6, x, y));
  for (let x = x0; x <= x1; x++) P.px(x, -D - 1, tone(GRANITE, 0.75 - ((x - x0) % 5 === 0 ? 0.3 : 0) + (hash(x, 2, seed) - 0.5) * 0.1, x, -D - 1));
  for (let y = -D; y <= 0; y++) { P.px(x0, y, GRANITE[3]); P.px(x1, y, GRANITE[1]); }
  rows.forEach((col, r) => {
    const yb = -D + 2 + r * 2, kind = col === 'white' ? 1 : col === 'blue' ? 0 : 2;
    for (let x = x0 + 2 + (r & 1); x < x1 - 1; x += 2) {
      if (hash(x, r, seed + 2) < 0.12) continue;
      const h = 2 + Math.floor(hash(x, r, seed + 1) * 3);
      P.vl(x, yb - h + 1, h, LEAVES[2 + ((x + r) & 1)]);
      if (hash(x, r, seed + 3) > 0.5) P.px(x - 1, yb - 1, LEAVES[4]);
      bloom(P, x, yb - h, FL[col], kind);
    }
  });
  for (let x = x0; x <= x1; x++) for (let y = -1; y <= 0; y++) {
    const joint = (x - x0) % 6 === 0;
    P.px(x, y, tone(GRANITE, (y === -1 ? 0.88 : 0.42) - (joint ? 0.35 : 0) + (hash(x, y, seed + 4) - 0.5) * 0.1, x, y));
  }
  groundShadow(P, 2, 1, w / 2 + 1, 2);
}
function paintHedge(P, w, h, seed) {
  const x0 = -(w >> 1), x1 = x0 + w - 1, top = -h - 4;
  for (let y = top; y <= -1; y++) for (let x = x0; x <= x1; x++) {
    if (y === top && (x === x0 || x === x1)) continue;
    if (y === top + 1 && (x === x0 || x === x1) && hash(x, y, seed) > 0.5) continue;
    const onTop = y < -h;
    let v = onTop ? 0.86 - (y - top) * 0.06 : 0.6 - ((y + h) / h) * 0.4;
    v += (hash(x >> 1, y >> 1, seed) - 0.5) * 0.3 + (hash(x, y, seed + 1) - 0.5) * 0.12;
    if (x === x0) v += 0.1; if (x >= x1 - 1) v -= 0.2;
    P.px(x, y, tone(BOX, v, x, y));
  }
  for (let x = x0 + 1; x < x1; x++) if (hash(x, 0, seed + 3) > 0.62) P.px(x, top - 1, BOX[4]);
  for (let x = x0 + 2; x < x1 - 1; x += 3) if (hash(x, 1, seed + 4) > 0.7) P.px(x, top + 4 + Math.floor(hash(x, 2, seed) * (h - 2)), BOX[5]);
  outline(P, BOX[0], BOX[1], 0.7);
  groundShadow(P, 3, 0, w / 2 + 3, 2.6, 0.32);
}
function paintBush(P, seed, flowers) {
  paintCrown(P, 0, -7, 9, 7, LEAVES, seed, { clumps: 7, inner: 3 });
  if (flowers) for (let i = 0; i < 12; i++) {
    const a = hash(i, seed, 1) * Math.PI * 2, r = Math.sqrt(hash(i, seed, 2));
    bloom(P, Math.round(Math.cos(a) * 7 * r), Math.round(-7 + Math.sin(a) * 5 * r - 1), FL[flowers], 0);
  }
  outline(P, LEAVES[0], LEAVES[1], 0.7);
  groundShadow(P, 4, 1, 11, 3);
}

// ---------- kaféterrassen ----------
function paintCafeSet(P, canopy) {
  for (const s of [-1, 1]) {
    const cx = s * 6, bx = s * 9;
    P.vl(cx - 2, -5, 6, TEAK[1]); P.vl(cx + 2, -5, 6, TEAK[0]); P.vl(bx, -5, 6, TEAK[1]);
    P.hl(cx - 3, -7, 7, TEAK[4]); P.hl(cx - 3, -6, 7, TEAK[2]);
    for (let y = -15; y <= -7; y++) {
      P.px(bx, y, TEAK[((y + (s > 0 ? 1 : 0)) & 1) ? 3 : 2]);
      P.px(bx - s, y, y === -15 ? TEAK[4] : TEAK[((y & 1) ? 1 : 2)]);
    }
    P.px(bx - s, -16, TEAK[3]);
  }
  P.vl(0, -10, 9, IRON[2]); P.px(0, -10, IRON[4]);
  P.hl(-3, 0, 7, IRON[1]); P.hl(-2, -1, 5, IRON[3]);
  P.hl(-4, -13, 9, 0xf6f2e8); P.hl(-5, -12, 11, 0xdcd6c8); P.hl(-4, -11, 9, 0x8a847a);
  P.px(-3, -14, 0xffffff); P.px(-2, -14, 0xe0dcd4); P.px(-3, -13, 0x5a3a22);
  P.px(2, -14, 0xffffff); P.px(3, -14, 0xd8d4cc); P.px(2, -13, 0x4a2e1a);
  P.px(0, -13, 0xe8c070);
  for (let y = -34; y <= -14; y++) P.px(0, y, 0xd8cfbd);
  // parasollet: spets upptill, kanten är framhalvan av en ellips, våderna strålar ut från spetsen
  const R = 16, AY = -48, RY = -39, ERY = 4;
  const rimAt = (x) => RY + ERY * Math.sqrt(Math.max(0, 1 - (x / R) ** 2));
  const panelCol = (u) => ((Math.floor(Math.asin(clamp(u, -1, 1)) / (Math.PI / 4) + 0.5) & 1) ? canopy[1] : canopy[0]);
  for (let x = -R; x <= R; x++) {
    const yb = Math.round(rimAt(x)), yt = Math.round(AY + Math.abs(x) * ((RY - AY) / R) * 0.95);
    for (let y = yt; y <= yb; y++) {
      const t = clamp((y - AY) / (rimAt(x) - AY), 0.08, 1), u = clamp(x / (R * t), -1, 1);
      const th = Math.asin(u) / (Math.PI / 4) + 0.5, fr = th - Math.floor(th);
      let cc = mul(panelCol(u), 1.08 - (u + 1) * 0.17);
      cc = mix(cc, 0xffffff, 0.14 * (1 - t));
      if (fr < 0.07 || fr > 0.93) cc = mul(cc, 0.78);
      if (y === yt) cc = mix(cc, 0xffffff, 0.2);
      P.px(x, y, cc);
    }
    const c0 = panelCol(x / R);
    P.px(x, yb + 1, mul(c0, 0.8)); if ((x + 16) % 4 < 3) P.px(x, yb + 2, mul(c0, 0.62));
  }
  P.px(0, -49, 0xf0e8d8); P.px(0, -50, 0xc8b890);
  outline(P, 0x1a1418, 0x1a1418, 0.35);
  groundShadow(P, 3, 0, 16, 4.5, 0.26);
}
function paintMenuBoard(P) {
  const x0 = -10, w = 21, top = -21;
  P.line(x0 + 1, -4, x0 - 1, 0, WOOD[1]); P.line(x0 + w - 2, -4, x0 + w, 0, WOOD[0]);
  P.rect(x0, top, w, 18, WOOD[2]); P.hl(x0, top, w, WOOD[4]); P.vl(x0, top, 18, WOOD[3]); P.vl(x0 + w - 1, top, 18, WOOD[0]); P.hl(x0, top + 17, w, WOOD[0]);
  for (let y = top + 1; y < top + 17; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) P.px(x, y, hash(x, y, 3) > 0.93 ? 0x3a4a42 : mix(0x1a2420, 0x26322c, bayer(x, y)));
  text(P, SMALL, 'LATTE', x0 + 1, top + 2, 0xecece4);
  P.hl(x0 + 2, top + 8, w - 4, 0xa8b0a8, 0.5);
  text(P, SMALL, '35:-', x0 + 2, top + 10, 0xf4d070);
  // kritritad kopp med ånga
  P.hl(x0 + 15, top + 12, 4, 0xecece4); P.vl(x0 + 15, top + 12, 3, 0xecece4); P.vl(x0 + 18, top + 12, 3, 0xecece4); P.hl(x0 + 16, top + 14, 2, 0xecece4); P.px(x0 + 19, top + 13, 0xecece4);
  P.px(x0 + 16, top + 10, 0xf0a0b0); P.px(x0 + 17, top + 9, 0xf0a0b0);
  groundShadow(P, 2, 1, 11, 2);
}

// ---------- fruktdisken och kundvagnarna ----------
const FRUIT = {
  applR: [0x4a080e, 0x8e1620, 0xd02c30, 0xff9480], applG: [0x2a5010, 0x4a8a1e, 0x80c040, 0xdaf49a],
  apels: [0x7a3406, 0xc8620e, 0xf49a2c, 0xffe0a0], citron: [0x7a6208, 0xd0b014, 0xf6e44c, 0xffffc4],
  tomat: [0x560a0a, 0xa81616, 0xec3a2c, 0xffb0a0], druva: [0x240834, 0x521862, 0x86389a, 0xd6a4e6],
  sallad: [0x1e4a14, 0x3a7a22, 0x6aae36, 0xb4e074], paprika: [0x5a0a0a, 0xc01818, 0xf0c020, 0x4a9a2a],
  banan: [0x5a4206, 0xb88a10, 0xf0cc30, 0xfff4a0],
};
const BALL4 = ['.22.', '2321', '2211', '.10.'], BALL3 = ['121', '231', '110'];
function ball(P, x, y, pat, c) {
  pat.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') P.px(x + i, y + j, c[+row[i]]); });
}
function fruitPile(P, x0, y0, w, h, kind, seed) {
  P.clip(x0, y0 - 3, x0 + w, y0 + h);
  const c = FRUIT[kind];
  P.rect(x0, y0, w, h, mul(c[0], 0.6));
  const bulge = (x) => Math.round(1.6 * Math.sin(Math.PI * clamp((x - x0 + 1) / w, 0, 1)));
  if (kind === 'druva') {
    for (let y = y0 - 1; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (y < y0 - bulge(x) + 0) continue;
      const g = hash(x >> 1, y >> 1, seed) > 0.72 ? FRUIT.applG : c;
      P.px(x, y, ((x + y) & 1) ? g[1] : g[2]); if (hash(x, y, seed) > 0.8) P.px(x, y, g[3]);
    }
  } else if (kind === 'banan') {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const bx = x0 + i * 5 - (j & 1) * 2, by = y0 + j * 2 - 1 - bulge(bx + 2);
      const Y = [0x7a5a08, 0xd8a818, 0xf8d838, 0xfff4a0];
      for (let f = 0; f < 3; f++) {
        const fy = by + f;
        P.px(bx, fy, 0x4a3a10); P.hl(bx + 1, fy + 1, 3, Y[2 - (f === 2 ? 1 : 0)]); P.px(bx + 4, fy, Y[1]); P.px(bx + 2, fy + 1, f === 0 ? Y[3] : Y[2]);
        P.hl(bx + 1, fy + 2, 3, Y[0]);
      }
    }
  } else if (kind === 'sallad') {
    for (let i = 0; i < Math.ceil(w / 5) + 1; i++) {
      const cx = x0 + 2 + i * 5, cy = y0 + 2 - bulge(cx);
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
        const dd = Math.hypot(x - cx, (y - cy) * 1.1);
        if (dd > 3.2) continue;
        P.px(x, y, tone(c, 0.6 - ((x - cx) / 3) * 0.25 - ((y - cy) / 3) * 0.3 + (hash(x, y, seed) - 0.5) * 0.3, x, y));
      }
    }
  } else {
    const big = kind !== 'citron' && kind !== 'tomat' && kind !== 'paprika', pat = big ? BALL4 : BALL3, s = pat.length, step = s - 1;
    for (let row = 0; row * (s - 2) <= h; row++) {
      for (let x = x0 - 1 + ((row & 1) ? step >> 1 : 0); x < x0 + w; x += step) {
        let cc = c;
        if (kind === 'paprika') { const k = Math.floor(hash(x, row, seed) * 3); cc = [[0x5a0a0a, 0xb01414, 0xe83424, 0xffa090], [0x7a5a06, 0xd8a810, 0xf8d830, 0xffffb0], [0x1a4a10, 0x2e7a1e, 0x58aa34, 0xb4e888]][k]; }
        ball(P, x, y0 - 1 + row * (s - 2) - (row === 0 ? bulge(x + 1) : 0), pat, cc);
      }
    }
  }
  P.clip();
}
function paintFruitStand(P) {
  const X0 = -30, X1 = 29;
  // markisen: grön-vit rand, lutar mot betraktaren
  for (let y = -49; y <= -42; y++) for (let x = X0 - 1; x <= X1 + 1; x++) {
    const green = Math.floor((x - X0 + 1) / 4) % 2 === 0;
    let c = green ? 0x2a8a4a : 0xf2eee2;
    c = mul(c, 0.82 + ((y + 49) / 7) * 0.22 - ((x - X0) / 60) * 0.12);
    if (y === -49) c = mix(c, 0xffffff, 0.3);
    P.px(x, y, c);
  }
  for (let x = X0 - 1; x <= X1 + 1; x++) {
    const green = Math.floor((x - X0 + 1) / 4) % 2 === 0, c = green ? 0x1e6a38 : 0xd8d2c4;
    P.px(x, -41, c); if ((x - X0 + 1) % 4 !== 3) P.px(x, -40, mul(c, 0.85)); if ((x - X0 + 1) % 4 === 1) P.px(x, -39, mul(c, 0.7));
  }
  // stolpar
  for (const x of [X0 + 1, X1 - 2]) for (let y = -40; y <= 0; y++) { P.px(x, y, 0xe8e4da); P.px(x + 1, y, 0xa8a498); }
  // skylten FÄRSKT hänger i snören
  P.vl(-10, -39, 3, 0x6a6258); P.vl(9, -39, 3, 0x6a6258);
  P.rect(-14, -36, 28, 9, 0xf4ecd4); P.box(-14, -36, 28, 9, 0x1e5a30); P.hl(-13, -35, 26, 0xffffff);
  text(P, SMALL, 'FÄRSKT', -12, -33, 0x1e6a38);
  // bakre skiva
  for (let y = -27; y <= -24; y++) for (let x = X0 + 3; x <= X1 - 3; x++) P.px(x, y, tone(WOOD, 0.5 + ((x % 6 === 0) ? -0.25 : 0) + (y === -27 ? 0.25 : 0), x, y));
  const crate = (x, top, kind, seed) => {
    fruitPile(P, x, top, 14, 6, kind, seed);
    for (let y = top + 6; y <= top + 9; y++) for (let i = 0; i < 14; i++) {
      let v = ((y - top) % 2 === 0 ? 0.78 : 0.48) + (hash(x + i >> 2, y, seed) - 0.5) * 0.1;
      if (i === 0 || i === 13) v -= 0.25;
      P.px(x + i, y, tone(WOOD, v, x + i, y));
    }
    P.px(x + 1, top + 7, 0x2a2018); P.px(x + 12, top + 7, 0x2a2018);
    // prislapp
    if (seed % 2 === 0) { P.rect(x + 9, top + 3, 3, 2, 0xffffff); P.px(x + 10, top + 4, 0xd02020); P.px(x + 10, top + 5, 0x8a847a); }
  };
  ['applR', 'apels', 'banan', 'druva'].forEach((k, i) => crate(-28 + i * 14, -24, k, 30 + i));
  ['applG', 'citron', 'tomat', 'sallad'].forEach((k, i) => crate(-28 + i * 14, -15, k, 40 + i));
  // bordets ben
  for (const x of [-27, -1, 25]) { P.vl(x, -5, 6, WOOD[2]); P.vl(x + 1, -5, 6, WOOD[0]); }
  P.hl(-28, -6, 56, WOOD[0]);
  groundShadow(P, 3, 0, 33, 4, 0.3);
}
function paintCart(P, x) {
  const hi = STEEL[4], mid = STEEL[2], lo = STEEL[1];
  // korgen: trapets av trådgaller, sedd från sidan (fronten åt höger)
  for (let y = -17; y <= -9; y++) {
    const t = (y + 17) / 8, l = Math.round(x + t * 3), r = Math.round(x + 17 - t * 2);
    for (let xx = l + 1; xx < r; xx++) {
      if (y === -14 || y === -11) P.px(xx, y, lo, 0.85);
      else if ((xx - x) % 2 === 0) P.px(xx, y, (y & 1) ? mid : STEEL[3], 0.75);
    }
    P.px(l, y, STEEL[3]); P.px(r, y, lo);
  }
  P.hl(x, -17, 18, hi); P.hl(x + 1, -16, 16, mid, 0.9); P.hl(x + 3, -9, 13, mid);
  // plastpanel i butikens gröna färg + barnsitsens röda lucka
  P.rect(x + 10, -13, 5, 3, 0x2a8a4a); P.hl(x + 10, -13, 5, 0x5ac07a); P.px(x + 14, -11, 0x1a5a30);
  P.rect(x + 1, -16, 3, 3, 0xc82a2a); P.px(x + 1, -16, 0xff7060); P.px(x + 3, -14, 0x7a1414);
  // handtag med röd greppbygel
  P.line(x, -17, x - 2, -19, STEEL[3]);
  P.hl(x - 4, -20, 4, 0xe03a34); P.px(x - 4, -20, 0xff8a70); P.hl(x - 4, -19, 4, 0x8a1818);
  // chassi, nedre hylla och små hjul
  P.line(x + 3, -9, x + 2, -3, mid); P.line(x + 15, -9, x + 15, -3, lo);
  P.hl(x + 2, -4, 14, lo); for (let xx = x + 3; xx < x + 15; xx += 2) P.px(xx, -5, mid, 0.7);
  for (const wx of [x + 1, x + 14]) { P.px(wx + 1, -2, lo); P.hl(wx, -1, 2, 0x1a1a1e); P.hl(wx, 0, 2, 0x2a2a30); P.px(wx, -1, 0x6a6e76); }
}
function paintCarts(P) {
  // lågt räcke (kundvagnsgård) + blå skylt med kundvagn
  for (const x of [-27, 26]) for (let y = -13; y <= 0; y++) { P.px(x, y, STEEL[3]); P.px(x + 1, y, STEEL[1]); }
  for (let y = -24; y <= -14; y++) { P.px(26, y, STEEL[3]); P.px(27, y, STEEL[1]); }
  P.hl(-27, -13, 55, STEEL[4]); P.hl(-27, -12, 55, STEEL[1]);
  const sx = 22;
  P.rect(sx, -33, 10, 9, 0x1f5ab0); P.box(sx, -33, 10, 9, 0xe8eef6); P.hl(sx + 1, -32, 8, 0x4a82d8);
  P.px(sx + 2, -31, 0xffffff); P.hl(sx + 3, -30, 5, 0xffffff); P.hl(sx + 3, -29, 5, 0xffffff); P.hl(sx + 4, -28, 3, 0xffffff); P.px(sx + 4, -26, 0xffffff); P.px(sx + 7, -26, 0xffffff);
  for (let i = 0; i < 5; i++) paintCart(P, 4 - i * 6 + 2);
  groundShadow(P, 3, 0, 30, 3.5, 0.3);
}

// ---------- cykelställ ----------
function paintBike(P, rx, col, flip, basket) {
  const X = (dx) => rx + (flip ? 14 - dx : dx);
  const tire = (cx) => ring(P, cx, -5, 5, (x, y, nx, ny) => P.px(x, y, nx < -0.3 && ny < 0 ? 0x4a4a54 : 0x16161a));
  tire(X(0)); tire(X(14));
  for (const cx of [X(0), X(14)]) {
    ring(P, cx, -5, 3.6, (x, y) => { if (hash(x, y, 3) > 0.45) P.px(x, y, 0x8e949c, 0.7); });
    P.px(cx, -5, 0xd0d6dc);
  }
  const hi = mix(col, 0xffffff, 0.35);
  P.line(X(0), -5, X(5), -5, col); P.line(X(0), -5, X(4), -12, col); P.line(X(5), -5, X(4), -12, hi);
  P.line(X(4), -12, X(12), -12, hi); P.line(X(5), -5, X(12), -12, col); P.line(X(12), -12, X(14), -5, mul(col, 0.7));
  P.hl(Math.min(X(3), X(5)), -13, 3, 0x2a1e18); P.px(X(4), -14, 0x4a3628);
  P.line(X(12), -12, X(12), -14, STEEL[2]); P.hl(Math.min(X(11), X(14)), -15, 4, STEEL[3]); P.px(X(flip ? 11 : 14), -15, 0x1a1a1e);
  P.px(X(5), -5, 0xb8bec4); P.px(X(5), -4, 0x6a7078);
  if (basket) { P.rect(Math.min(X(13), X(17)), -17, 5, 4, 0x8a6a3a); P.hl(Math.min(X(13), X(17)), -17, 5, 0xc89a5a); P.px(Math.min(X(13), X(17)) + 2, -15, 0x5a4020); }
}
function paintBikeRack(P, seed) {
  for (const c of [-13, 13]) {
    for (let y = -10; y <= 0; y++) { P.px(c - 6, y, STEEL[3]); P.px(c - 5, y, STEEL[1]); P.px(c + 5, y, STEEL[2]); P.px(c + 6, y, STEEL[0]); }
    P.hl(c - 5, -12, 11, STEEL[4]); P.hl(c - 4, -11, 9, STEEL[1]); P.px(c - 6, -11, STEEL[3]); P.px(c + 6, -11, STEEL[1]);
    P.hl(c - 7, 0, 3, STEEL[0]); P.hl(c + 5, 0, 3, STEEL[0]);
  }
  const cols = [0xc83838, 0x2a8a9a, 0x2a2a30, 0xe0c030, 0x3a6ad0, 0x68a848];
  paintBike(P, -21, cols[Math.floor(hash(1, seed) * cols.length)], false, hash(2, seed) > 0.5);
  paintBike(P, 5, cols[Math.floor(hash(3, seed) * cols.length)], true, hash(4, seed) > 0.6);
  groundShadow(P, 3, 0, 28, 3, 0.28);
}

// ---------- sopkärl och container (tvärgator, bakgata) ----------
const BINS = {
  gron: [0x123a1e, 0x1e5a2e, 0x2e7a40, 0x4a9a5a, 0x74bc80], gra: [0x22262c, 0x3a4048, 0x545c66, 0x747e8a, 0x9aa4ae],
  brun: [0x2e1c12, 0x4a3020, 0x684630, 0x8a6246, 0xaa8260], bla: [0x102650, 0x1a3e7e, 0x2a5aaa, 0x4a7ed0, 0x7aa4e8],
};
function paintWheelieBin(P, kind) {
  const C = BINS[kind];
  for (let y = -15; y <= 0; y++) {
    const hw = y < -13 ? 6 : 5 - (y > -3 ? 0 : 0);
    for (let x = -hw; x < hw; x++) {
      let v = y <= -13 ? 0.86 - ((x + hw) / (2 * hw)) * 0.4 : 0.7 - ((x + hw) / (2 * hw)) * 0.55;
      if (y === -13) v -= 0.35; if (y === 0) v -= 0.3;
      if (y > -12 && y < -1 && (x === -3 || x === 2)) v -= 0.12;
      P.px(x, y, tone(C, v, x, y));
    }
  }
  P.hl(-4, -16, 8, C[4]); P.hl(-2, -17, 4, C[2]);
  P.rect(-1, -9, 2, 2, 0xe8e8e0); P.px(0, -8, C[1]);
  groundShadow(P, 3, 1, 7, 2);
}
function paintContainer(P) {
  const C = [0x0e2a3a, 0x163e54, 0x22586e, 0x327488, 0x5a9aac];
  for (let y = -17; y <= -2; y++) for (let x = -15; x <= 14; x++) {
    let v = 0.62 - ((x + 15) / 30) * 0.3 + (y <= -15 ? 0.25 : 0) + ((x + 15) % 5 === 0 ? -0.2 : (x + 15) % 5 === 1 ? 0.12 : 0);
    if (hash(x >> 1, y >> 1, 9) > 0.9) v -= 0.15;
    P.px(x, y, tone(C, v, x, y));
  }
  P.hl(-16, -18, 32, C[4]); P.hl(-15, -19, 30, C[3]); P.hl(-15, -20, 14, C[2]); P.px(-2, -21, C[4]);
  P.hl(-15, -2, 30, C[0]);
  for (const x of [-13, 11]) { P.rect(x, -1, 3, 2, 0x1a1a1e); P.px(x + 1, 0, 0x6a6e74); }
  text(P, SMALL, 'RETUR', -10, -11, 0xe8eef0);
  groundShadow(P, 4, 1, 18, 3);
}

// ---------- busskuren ----------
const SH = { x: BUS_STOP.x, y: CITY.SIDEWALK_S[0] + 10 }; // bakväggens fotlinje (286)
const SH_FRONT = BUS_STOP.y - 4;                             // främre stolparnas fotlinje (299)
function paintPoster(P) {
  // reklam för Flygplatsen. Raderna −22…−20 skyms av takets framkant, så
  // bilden (sol, flygplan) ligger ovanför och rubriken nedanför den.
  const x0 = 10, x1 = 28, y0 = -33, y1 = -3;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let c;
    if (y < -13) c = mix(0x2a70d8, 0x9ad8fa, (y - y0) / 20 + (bayer(x, y) - 0.5) * 0.12);
    else if (y < -9) c = mix(0x1a7ac0, 0x2aa0d8, (bayer(x, y) - 0.5) * 0.4 + 0.5);
    else c = mix(0xf4dc98, 0xe0c070, (y + 9) / 3 + (bayer(x, y) - 0.5) * 0.2);
    P.px(x, y, c);
  }
  P.ell(14, -29, 3.2, 3.2, 0xfff4a0, 1, 2); P.px(14, -29, 0xffffff);
  P.hl(20, -27, 7, 0xffffff); P.px(23, -28, 0xffffff); P.px(23, -26, 0xe8eef6); P.px(26, -28, 0xe8eef6); P.px(19, -27, 0xc8d4e0);
  text(P, SMALL, 'FLYG', 13, -18, 0x14306a); text(P, SMALL, 'FLYG', 12, -19, 0xffffff);
  P.hl(x0, -13, 19, 0x9ae0f8); P.hl(x0 + 3, -11, 4, 0x8ad0f0);
  P.px(24, -10, 0xd02030); P.hl(23, -11, 3, 0xffffff); P.px(24, -12, 0xd02030); P.vl(24, -9, 2, 0x5a3e26);
  P.rect(x0, -7, 19, 5, 0xd02030); P.hl(x0, -7, 19, 0xe84a50);
  text(P, SMALL, '990:-', 11, -7, 0xfff080);
  P.box(x0 - 1, y0 - 1, 21, y1 - y0 + 3, 0x9aa2aa);
}
function paintShelterBack(P) {
  // bakvägg: aluminiumram, glas med prickband, reklamlåda till höger
  for (let y = -35; y <= 0; y++) for (let x = -29; x <= 6; x++) {
    const s = x + Math.round(y * 0.7) + 60;
    let a = 0.2, c = 0xbfe2f2;
    if (s === 44 || s === 45 || s === 70) { a = 0.42; c = 0xf0faff; }
    P.px(x, y, c, a);
  }
  for (let x = -28; x <= 5; x += 2) P.px(x, -16, 0xffffff, 0.8);
  for (const x of [-31, 7, 30]) for (let y = -36; y <= 0; y++) { P.px(x, y, STEEL[3]); P.px(x + 1, y, STEEL[1]); }
  P.hl(-31, -36, 63, STEEL[4]); P.hl(-31, 0, 63, STEEL[1]); P.hl(-29, -1, 36, STEEL[0], 0.6);
  P.rect(9, -35, 21, 35, 0x1e2228); P.hl(9, -35, 21, 0x4a525c);
  paintPoster(P);
  // bänken längs väggen
  slat(P, -27, -3, 30, 0.1); slat(P, -27, -1, 30, 0);
  P.hl(-27, 1, 30, WOOD[0]);
  for (const x of [-25, 0]) { P.vl(x, 2, 4, IRON[2]); P.vl(x + 1, 2, 4, IRON[1]); P.hl(x - 1, 5, 4, IRON[0]); }
  // papperskorg på väggen
  P.rect(22, -3, 6, 8, 0x3a4048); P.hl(22, -3, 6, 0x6a727c); P.hl(23, -2, 4, 0x0a0a0c); P.vl(27, -2, 7, 0x22262c);
  groundShadow(P, 2, 3, 34, 4, 0.22);
}
function paintShelterFront(P) {
  const d = SH_FRONT - SH.y; // 13
  // genomskinligt glastak (sett uppifrån) med bärbalkar
  for (let y = -35; y <= -23; y++) for (let x = -33; x <= 33; x++) {
    const rib = x === -33 || x === 33 || x === -11 || x === 11;
    if (rib) P.px(x, y, x > 0 ? STEEL[1] : STEEL[3]);
    else P.px(x, y, y === -24 ? 0xe0f4ff : 0x9acce0, y === -24 ? 0.45 : 0.26);
  }
  P.hl(-33, -36, 67, STEEL[4]);
  // takets framkant med liten skylt
  for (let y = -22; y <= -20; y++) for (let x = -34; x <= 34; x++) P.px(x, y, y === -22 ? STEEL[4] : y === -21 ? 0x2a3038 : 0x1a1e24);
  P.rect(-9, -23, 19, 7, 0x1f7a3a); P.box(-9, -23, 19, 7, 0xe8f0e8); text(P, SMALL, 'BUSS', -7, -22, 0xffffff);
  P.hl(-16, -19, 6, 0xdde6e0); P.hl(11, -19, 6, 0xdde6e0);
  // främre stolpar
  for (const x of [-32, 31]) {
    for (let y = -19; y <= d; y++) { P.px(x, y, STEEL[3]); P.px(x + 1, y, STEEL[1]); }
    P.hl(x - 1, d, 4, STEEL[0]);
  }
  // glasgavlar (tunna, bara kanten syns)
  for (const x of [-31, 30]) for (let y = -19; y <= d - 1; y++) P.px(x + (x < 0 ? 1 : -1), y, 0xbfe2f2, 0.18);
}
function paintBusSign(P) {
  for (let y = -44; y <= 0; y++) { P.px(0, y, STEEL[3]); P.px(1, y, STEEL[1]); }
  P.hl(-1, 0, 4, STEEL[0]);
  const x0 = -13, w = 27;
  P.rect(x0, -58, w, 13, 0xf4d020); P.box(x0, -58, w, 13, 0x1a1a1e); P.hl(x0 + 1, -57, w - 2, 0xfff08a); P.hl(x0 + 1, -47, w - 2, 0xc8a010);
  text(P, BIG, 'BUSS', x0 + 2, -55, 0x1a1a1e);
  P.rect(-4, -40, 9, 11, 0xf4f4ee); P.box(-4, -40, 9, 11, 0x5a626c);
  for (let y = -38; y <= -32; y += 2) P.hl(-2, y, 5, 0x8a929a);
  P.hl(-2, -38, 5, 0x1f5ab0);
  groundShadow(P, 2, 1, 5, 1.8);
}

// ---------- fontänen ----------
const FOUNT = { x: PARK_LAYOUT.plaza.cx, y: PARK_LAYOUT.plaza.cy + 13, frames: 12 };
function paintFountain(P, f, NF) {
  const ph = f / NF, cy = -15, RX = 26, RY = 9, IRX = 22, IRY = 7;
  // bassängens framvägg: huggen sten med fogar
  for (let x = -RX; x <= RX; x++) {
    const top = Math.round(cy + RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)));
    for (let y = top; y <= top + 6; y++) {
      const row = y - top, t = (x + RX) / (2 * RX);
      let v = 0.78 - t * 0.52 - row * 0.03;
      if (row === 3) v -= 0.24;
      if (row > 0 && row !== 3 && (((x + (row > 3 ? 4 : 0)) % 8) + 8) % 8 === 0) v -= 0.24;
      if (row === 6) v -= 0.32;
      v += (hash(x, y, 71) - 0.5) * 0.12;
      P.px(x, y, tone(STONE, v, x, y));
    }
  }
  // kanten (ovansida) och vattnet
  for (let y = cy - RY - 1; y <= cy + RY + 1; y++) for (let x = -RX - 1; x <= RX + 1; x++) {
    const o = ((x + 0.5) / RX) ** 2 + ((y + 0.5 - cy) / RY) ** 2;
    if (o > 1) continue;
    const i = ((x + 0.5) / IRX) ** 2 + ((y + 0.5 - cy) / IRY) ** 2;
    if (i > 1) {
      let v = 0.9 - ((x + RX) / (2 * RX)) * 0.4 + (hash(x, y, 72) - 0.5) * 0.1;
      if (i < 1.18 && y < cy) v -= 0.3;
      if (o > 0.82 && y > cy) v -= 0.1;
      P.px(x, y, tone(STONE, v, x, y));
    } else if (y < cy && i > 0.7) {
      P.px(x, y, tone(STONE, 0.3 + (hash(x, y, 73) - 0.5) * 0.1, x, y));
      if (i < 0.78) P.px(x, y, WATER[4]);
    } else {
      const rho = Math.sqrt(i);
      let v = 0.3 + ((y - (cy - IRY)) / (2 * IRY)) * 0.34 + (hash(x >> 1, y, 74) - 0.5) * 0.08;
      const band = (rho * 3 - ph * 3 + 30) % 1;
      if (band < 0.13 && rho > 0.3) v += 0.24;
      else if (band < 0.22 && rho > 0.3) v -= 0.06;
      let c = tone(WATER, v, x, y);
      if (hash(x, y, f + 90) > 0.975) c = WATER[5];
      P.px(x, y, c);
    }
  }
  // pelaren med profilring och fot
  for (let y = -32; y <= cy - 1; y++) for (let x = -3; x <= 2; x++) P.px(x, y, tone(STONE, 0.86 - ((x + 3) / 5) * 0.6 + (hash(x, y, 75) - 0.5) * 0.08, x, y));
  for (let x = -4; x <= 3; x++) { P.px(x, -17, tone(STONE, 0.9 - ((x + 4) / 7) * 0.6, x, -17)); P.px(x, -16, tone(STONE, 0.5 - ((x + 4) / 7) * 0.3, x, -16)); }
  for (let x = -4; x <= 3; x++) { P.px(x, -24, tone(STONE, 0.95 - ((x + 4) / 7) * 0.6, x, -24)); P.px(x, -23, tone(STONE, 0.4 - ((x + 4) / 7) * 0.2, x, -23)); }
  // övre skålen: undersida (kupa), läpp och vatten
  for (let y = -34; y <= -31; y++) {
    const hw = 10 - (y + 34) * 2.2;
    for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) if (Math.abs(x + 0.5) <= hw) P.px(x, y, tone(STONE, 0.66 - ((x + hw) / (2 * hw)) * 0.5 - (y + 34) * 0.05, x, y));
  }
  for (let y = -42; y <= -34; y++) for (let x = -12; x <= 12; x++) {
    const o = ((x + 0.5) / 11.5) ** 2 + ((y + 0.5 + 38) / 3.4) ** 2;
    if (o > 1) continue;
    const i = ((x + 0.5) / 9.5) ** 2 + ((y + 0.5 + 38) / 2.2) ** 2;
    if (i <= 1) P.px(x, y, (hash(x, y, f + 60) > 0.8 || (x + f) % 5 === 0) ? WATER[4] : WATER[3]);
    else P.px(x, y, tone(STONE, 0.92 - ((x + 12) / 24) * 0.45 - (y > -38 ? 0.12 : 0), x, y));
  }
  for (let x = -11; x <= 11; x++) {
    const yb = Math.round(-38 + 3.4 * Math.sqrt(Math.max(0, 1 - (x / 11.5) ** 2)));
    P.px(x, yb + 1, tone(STONE, 0.5 - ((x + 11) / 22) * 0.3, x, yb + 1));
  }
  // vattenridån från skålens kant ned i bassängen
  for (let x = -11; x <= 11; x++) {
    if (Math.abs(x) < 3 && x !== -3) continue;
    const hs = hash(x, 0, 81);
    if (hs < 0.25 && Math.abs(x) < 10) continue;
    const yl = Math.round(-38 + 3.4 * Math.sqrt(Math.max(0, 1 - (x / 11.5) ** 2))) + 2;
    const yw = Math.round(cy + 4 * Math.sqrt(Math.max(0, 1 - (x / 14) ** 2)));
    for (let y = yl; y <= yw; y++) {
      const k = (((y - yl) - f * 2 + Math.floor(hs * 6)) % 6 + 6) % 6;
      const edge = Math.abs(x) >= 10;
      if (edge && k > 2) continue;
      P.px(x, y, k < 2 ? WATER[5] : WATER[4], k < 2 ? 0.92 : 0.55);
    }
    if (hash(x, f, 82) > 0.35) P.px(x, yw, 0xffffff, 0.9);
    if (hash(x, f, 83) > 0.6) P.px(x + (x < 0 ? -1 : 1), yw - 1, 0xe8f8ff, 0.8);
  }
  // krön: liten pelare och topp-skål
  for (let y = -46; y <= -41; y++) { P.px(-1, y, STONE[3]); P.px(0, y, STONE[1]); }
  P.hl(-3, -47, 6, STONE[4]); P.hl(-3, -46, 6, STONE[2]); P.px(-3, -46, STONE[3]);
  // strålen och dropparna
  for (let y = -57; y <= -48; y++) {
    const k = ((y + f * 2) % 4 + 4) % 4;
    P.px(-1, y, k < 2 ? WATER[5] : 0xffffff, 0.9); P.px(0, y, k < 2 ? WATER[4] : WATER[5], 0.8);
  }
  P.px(-1, -58, 0xffffff, 0.7); P.px(0, -59, WATER[5], 0.5);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, s = (ph + i / 10) % 1;
    const x = Math.round(side * (1 + 10 * s) - (side < 0 ? 1 : 0)), y = Math.round(-57 + 19 * s * s - 3 * s);
    P.px(x, y, s < 0.5 ? 0xffffff : WATER[5], 0.9);
    if (s < 0.3) P.px(x - side, y, WATER[4], 0.6);
  }
  groundShadow(P, 4, -1, 31, 6, 0.26);
}
function paintFountainGlow(P) {
  P.ell(0, -15, 21, 6.5, 0x3ab4ff, 0.55, 5);
  P.ell(0, -40, 10, 18, 0x9adcff, 0.35, 5);
  P.ell(0, -4, 30, 8, 0x5ac0ff, 0.18, 4);
}

// ---------- placeringen ----------
const NW = CITY.SIDEWALK_N[0] + 7;   // 193: mot fasaderna
const NC = CITY.SIDEWALK_N[1] - 5;   // 213: kantstenen (träd, lyktor)
const SC = CITY.SIDEWALK_S[0] + 6;   // 282: kantstenen på södra sidan
const SB = CITY.SIDEWALK_S[1] - 5;   // 301: södra trottoarens bakkant mot parken
const PU = PARK_LAYOUT.promenade[1]; // 334: promenaden
const PD = PARK_LAYOUT.promenade[3]; // 346

export function createProps(env) {
  const items = [], obstacles = [], bases = [], glows = [], lits = [], skipped = [];
  const BLOCK = [...RESERVED, ...BUILDINGS.map(footprint)];
  const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  // lägg till ett föremål om dess markyta är ledig (aldrig i RESERVED, gångar eller husen)
  function add(kind, x, y, base, obs, draw) {
    if (BLOCK.some((b) => hit(base, b)) || bases.some((b) => hit(base, b))) { skipped.push(`${kind}@${x},${y}`); return false; }
    bases.push(base);
    for (const o of obs) obstacles.push(o);
    items.push({ x, y, draw, kind });
    return true;
  }
  const cache = {};
  const once = (k, make) => cache[k] || (cache[k] = make());
  const sprItem = (kind, s, x, y, base, obs) => add(kind, x, y, base, obs, (ctx) => put(ctx, s, x, y));

  // --- vind: mjuka byar som får kronorna att vaja ---
  let gust = 0, gustT = 0, gustTo = 0;
  const sway = (ph, big) => (0.9 + gust) * Math.sin(env.t * (big ? 1.1 : 1.45) + ph) * (big ? 1.1 : 1);

  function tree(kind, x, y, grate = true) {
    const seed = (x * 7 + y * 13) | 0, t = makeTree(kind, seed, grate), T = t.T, ph = hash(x, y, 5) * 6.28;
    const base = grate ? [x - 10, y - 4, x + 11, y + 5] : [x - 4, y - 3, x + 5, y + 2];
    const petals = T.petals ? Array.from({ length: 4 }, (_, i) => ({ o: hash(i, seed, 1), dx: (hash(i, seed, 2) - 0.5) * T.rx * 1.4 })) : null;
    return add(kind, x, y, base, [[x - 2, y - 2, x + 3, y + 1]], (ctx) => {
      put(ctx, t.base, x, y);
      drawCrown(ctx, t.crown, x, y, sway(ph, !grate));
      if (petals) {
        const fall = -(T.cy + T.ry * 0.4);
        for (const p of petals) {
          const s = (env.t * 0.13 + p.o) % 1;
          if (s > 0.94) continue;
          ctx.fillStyle = s * 7 % 2 < 1 ? '#ffd4e2' : '#f2a2bf';
          ctx.fillRect(Math.round(x + p.dx + s * 12 + Math.sin(env.t * 2.1 + p.o * 9) * 3), Math.round(y + T.cy + T.ry * 0.4 + s * fall), 1, 1);
        }
      }
    });
  }
  const LAMP_S = [once('lampR', () => spr(30, 72, 13, 68, (P) => paintStreetLamp(P, 1))), once('lampL', () => spr(30, 72, 16, 68, (P) => paintStreetLamp(P, -1)))];
  const LAMP_GLOW = once('lampGlow', () => spr(64, 84, 32, 74, (P) => paintLampGlow(P, -59, 19, 22, 8)));
  const LAMP_LIT = [1, -1].map((m) => spr(12, 6, 6, 3, (P) => { P.hl(-3, 0, 6, 0xfff6d8); P.hl(-2, 0, 4, 0xffffff); P.hl(-4, 1, 8, 0xffe8b0, 0.5); P.hl(-3, -1, 6, 0xffe0a0, 0.35); }));
  function lamp(x, y, m = 1) {
    const hx = x + (m > 0 ? 10 : -8);
    if (!sprItem('lykta', LAMP_S[m > 0 ? 0 : 1], x, y, [x - 2, y - 3, x + 4, y + 1], [[x - 2, y - 3, x + 4, y + 1]])) return;
    glows.push({ x: hx, y, s: LAMP_GLOW, a: 0.95, flicker: hash(x, y, 3) > 0.93 });
    lits.push({ x: hx, y: y - 59, s: LAMP_LIT[0], a: 1 });
  }
  const PARK_LAMP = once('parkLamp', () => spr(14, 52, 6, 50, paintParkLamp));
  const PARK_GLOW = once('parkGlow', () => spr(48, 56, 24, 48, (P) => paintLampGlow(P, -37, 13, 17, 9)));
  const PARK_LIT = once('parkLit', () => spr(8, 10, 3, 9, (P) => {
    for (let y = -8; y <= 0; y++) for (const x of [-2, -1, 2, 3]) P.px(x, y, y > -6 && y < -1 && (x === -1 || x === 2) ? 0xffffff : 0xffe4a0);
    P.hl(-2, -4, 6, 0x2c2c38);
  }));
  function parkLamp(x, y) {
    if (!sprItem('parklykta', PARK_LAMP, x, y, [x - 3, y - 3, x + 4, y + 1], [[x - 2, y - 3, x + 3, y + 1]])) return;
    glows.push({ x: x + 1, y, s: PARK_GLOW, a: 0.9 });
    lits.push({ x, y: y - 33, s: PARK_LIT, a: 1 });
  }
  const BENCH = [once('bench', () => spr(36, 26, 17, 22, (P) => paintBench(P, false))), once('benchB', () => spr(36, 24, 17, 20, (P) => paintBench(P, true)))];
  const bench = (x, y, back = false) => sprItem('bänk', BENCH[back ? 1 : 0], x, y, [x - 14, y - 5, x + 15, y + 1], [[x - 13, y - 4, x + 14, y]]);
  const BIN = once('bin', () => spr(16, 20, 7, 17, paintBin));
  const bin = (x, y) => sprItem('papperskorg', BIN, x, y, [x - 4, y - 3, x + 4, y + 1], [[x - 4, y - 3, x + 4, y + 1]]);
  const HYD = once('hyd', () => spr(18, 20, 9, 16, paintHydrant));
  const hydrant = (x, y) => sprItem('brandpost', HYD, x, y, [x - 4, y - 2, x + 4, y + 1], [[x - 3, y - 2, x + 3, y + 1]]);
  const MAIL = once('mail', () => spr(16, 32, 7, 29, paintMailbox));
  const mailbox = (x, y) => sprItem('brevlåda', MAIL, x, y, [x - 2, y - 2, x + 3, y + 1], [[x - 1, y - 2, x + 2, y + 1]]);
  const NEWS = once('news', () => spr(34, 28, 16, 24, paintNewsStand));
  const news = (x, y) => sprItem('löpsedel', NEWS, x, y, [x - 12, y - 3, x + 13, y + 1], [[x - 12, y - 3, x + 13, y + 1]]);
  const menu = (x, y) => sprItem('meny', once('menu', () => spr(28, 26, 13, 23, paintMenuBoard)), x, y, [x - 10, y - 2, x + 11, y + 1], [[x - 10, y - 2, x + 11, y + 1]]);
  function sign(name, x, y, dir) {
    sprItem('gatuskylt', makeStreetSign(name, dir), x, y, [x - 1, y - 2, x + 3, y + 1], [[x - 1, y - 2, x + 3, y + 1]]);
  }
  function flowerBox(x, y, w, cols, style = 'tra') {
    const s = spr(w + 10, 26, (w >> 1) + 4, 20, (P) => paintFlowerBox(P, w, (x * 3 + y) | 0, cols, style));
    sprItem('blomlåda', s, x, y, [x - (w >> 1), y - 5, x + (w >> 1), y + 1], [[x - (w >> 1), y - 4, x + (w >> 1), y]]);
  }
  function pot(x, y, plant) {
    const s = spr(30, 44, 15, 38, (P) => paintPot(P, plant, (x * 5 + y) | 0));
    sprItem('kruka', s, x, y, [x - 7, y - 4, x + 7, y + 1], [[x - 6, y - 4, x + 6, y]]);
  }
  function bed(x, y, w, rows) {
    const s = spr(w + 8, 22, (w >> 1) + 3, 18, (P) => paintBed(P, w, (x + y * 3) | 0, rows));
    sprItem('rabatt', s, x, y, [x - (w >> 1), y - 10, x + (w >> 1), y + 1], [[x - (w >> 1), y - 8, x + (w >> 1), y]]);
  }
  function hedge(x, y, w, h = 8) {
    const s = spr(w + 10, h + 12, (w >> 1) + 3, h + 7, (P) => paintHedge(P, w, h, (x * 11 + y) | 0));
    sprItem('häck', s, x, y, [x - (w >> 1), y - 6, x + (w >> 1), y + 1], [[x - (w >> 1), y - 5, x + (w >> 1), y]]);
  }
  function bush(x, y, flowers) {
    const s = spr(30, 24, 13, 19, (P) => paintBush(P, (x * 13 + y) | 0, flowers));
    sprItem('buske', s, x, y, [x - 8, y - 4, x + 8, y + 1], [[x - 6, y - 3, x + 6, y]]);
  }
  function wheelieBin(x, y, kind) {
    sprItem('sopkärl', once('wb' + kind, () => spr(18, 22, 8, 18, (P) => paintWheelieBin(P, kind))), x, y, [x - 5, y - 4, x + 5, y + 1], [[x - 5, y - 4, x + 5, y]]);
  }
  function container(x, y) {
    sprItem('container', once('cont', () => spr(40, 28, 19, 23, paintContainer)), x, y, [x - 16, y - 8, x + 16, y + 1], [[x - 15, y - 7, x + 15, y]]);
  }
  function bikeRack(x, y) {
    const s = spr(62, 24, 30, 20, (P) => paintBikeRack(P, (x * 3 + y) | 0));
    sprItem('cykelställ', s, x, y, [x - 27, y - 4, x + 27, y + 1], [[x - 26, y - 3, x + 26, y]]);
  }
  // kaféterrassen: bord med parasoll, två stolar, ångande koppar och ljusslinga
  const bulbY = (x) => Math.round(4 * Math.sqrt(Math.max(0, 1 - (x / 16) ** 2)));
  const BULBS = spr(36, 8, 17, 2, (P) => { for (let x = -15; x <= 15; x += 3) { P.px(x, bulbY(x), 0xfff0b0); P.px(x, bulbY(x) - 1, 0xffd070, 0.5); } });
  const BULB_GLOW = spr(40, 14, 19, 6, (P) => { for (let x = -15; x <= 15; x += 3) P.ell(x, bulbY(x), 2.6, 2.2, 0xffc060, 0.6, 3); });
  function cafe(x, y, canopy) {
    const s = spr(40, 56, 19, 51, (P) => paintCafeSet(P, canopy));
    const ok = add('kafébord', x, y, [x - 8, y - 4, x + 9, y + 1], [[x - 8, y - 4, x + 9, y + 1]], (ctx) => {
      put(ctx, s, x, y);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 2; i++) {
        const k = (env.t * 5 + i * 2.5) % 5;
        ctx.fillRect(Math.round(x - 3 + i * 5 + Math.sin(env.t * 3 + i * 2) * 0.8), Math.round(y - 15 - k), 1, 1);
      }
    });
    if (ok) { glows.push({ x, y: y - 36, s: BULB_GLOW, a: 0.8 }); lits.push({ x, y: y - 36, s: BULBS, a: 1 }); }
  }
  const FRUITSTAND = once('fruit', () => spr(72, 60, 34, 54, paintFruitStand));
  const CARTS = once('carts', () => spr(70, 40, 34, 36, paintCarts));

  // =================== norra trottoaren ===================
  // kantstenen: träd i galler, lyktor, brandpost, gatuskyltar
  tree('korsbar', 24, NC); lamp(108, NC + 1); tree('lind', 150, NC); hydrant(176, NC);
  lamp(226, NC + 1);
  const cw = CROSSWALKS;
  lamp(352, NC + 1);
  tree('bjork', 522, NC); lamp(556, NC + 1); tree('korsbar', 674, NC);
  lamp(745, NC + 1); lamp(850, NC + 1);
  menu(1016, NC - 1);
  tree('lind', 1066, NC); lamp(1112, NC + 1); bin(1168, NC);
  tree('bjork', 1290, NC); lamp(1394, NC + 1); tree('lind', 1438, NC);
  lamp(1506, NC + 1); lamp(1624, NC + 1); tree('korsbar', 1660, NC);
  // fasaderna: blomsterlådor, krukor, vagnar, fruktdisk, terrass
  flowerBox(36, NW, 28, ['red', 'white', 'yellow']); flowerBox(114, NW, 22, ['pink', 'white', 'purple']); mailbox(131, NW);
  pot(178, NW, 'klot'); pot(242, NW, 'klot');
  sprItem('kundvagnar', CARTS, 346, NW + 3, [320, NW - 4, 373, NW + 4], [[320, NW - 3, 373, NW + 3]]);
  sprItem('fruktdisk', FRUITSTAND, 475, NW + 6, [445, NW - 3, 506, NW + 7], [[446, NW - 2, 505, NW + 6]]);
  pot(566, NW, 'kon'); pot(630, NW, 'kon'); flowerBox(648, NW, 20, ['purple', 'white'], 'svart');
  bench(718, NW + 2); pot(756, NW, 'gras'); pot(840, NW, 'gras'); bikeRack(874, NW + 3);
  cafe(975, NW + 8, [0xb8283a, 0xf4ece0]); cafe(1040, NW + 8, [0x2a6a4a, 0xf4ece0]);
  flowerBox(1098, NW, 24, ['orange', 'yellow', 'red']); news(1186, NW + 1);
  pot(1310, NW, 'pelargon'); pot(1376, NW, 'pelargon'); flowerBox(1404, NW, 24, ['red', 'yellow'], 'zink');
  bench(1480, NW + 2); pot(1522, NW, 'palm'); pot(1614, NW, 'palm'); flowerBox(1650, NW, 24, ['blue', 'white'], 'zink');

  // =================== tvärgator och bakgata ===================
  wheelieBin(272, 110, 'gron'); wheelieBin(283, 110, 'gra');
  wheelieBin(937, 100, 'brun'); wheelieBin(948, 100, 'gron');
  wheelieBin(1222, 120, 'bla'); wheelieBin(1233, 120, 'gra');
  container(1238, 34);

  // =================== södra trottoaren ===================
  tree('lind', 44, SB); lamp(100, SC, -1); tree('korsbar', 160, SB); hydrant(210, SC + 1); lamp(234, SC, -1);
  sign(cw[0].name, cw[0].x0 - 10, SB, 1);
  tree('bjork', 372, SB); lamp(430, SC, -1); tree('lind', 490, SB); bin(560, SB);
  // busskuren: bakvägg + bänk (sorteras vid väggen), tak + främre stolpar (sorteras framtill)
  const SHB = spr(72, 50, 36, 42, paintShelterBack), SHF = spr(74, 56, 37, 42, paintShelterFront);
  const POSTER = spr(72, 50, 36, 42, paintPoster);
  const POSTER_GLOW = spr(72, 50, 36, 42, (P) => P.ell(19, -18, 16, 20, 0xa8d8ff, 0.5, 5));
  if (add('busskur', SH.x, SH.y, [SH.x - 33, SH.y - 5, SH.x + 34, SH_FRONT + 1], [[SH.x - 32, SH.y - 4, SH.x + 33, SH.y], [SH.x - 27, SH.y + 1, SH.x + 4, SH.y + 5], [SH.x - 33, SH_FRONT - 3, SH.x - 29, SH_FRONT + 1], [SH.x + 30, SH_FRONT - 3, SH.x + 34, SH_FRONT + 1]],
    (ctx) => put(ctx, SHB, SH.x, SH.y))) {
    items.push({ x: SH.x, y: SH_FRONT, kind: 'busskur-tak', draw: (ctx) => put(ctx, SHF, SH.x, SH.y) });
    glows.push({ x: SH.x, y: SH.y, s: POSTER_GLOW, a: 0.7 });
    glows.push({ x: SH.x, y: SH.y, s: POSTER, a: 0.6 });
    glows.push({ x: SH.x, y: SH.y - 14, s: once('shelterLight', () => spr(50, 40, 25, 26, (P) => { P.ell(0, 12, 24, 7, 0xffe4b0, 0.35, 4); P.ell(-13, -5, 5, 2.5, 0xfff4d8, 0.9, 3); P.ell(14, -5, 5, 2.5, 0xfff4d8, 0.9, 3); })), a: 0.8 });
  }
  sprItem('hållplatsskylt', once('bussign', () => spr(32, 64, 15, 60, paintBusSign)), SH.x + 46, SB, [SH.x + 44, SB - 2, SH.x + 49, SB + 1], [[SH.x + 45, SB - 2, SH.x + 48, SB + 1]]);
  bikeRack(700, SB + 1); lamp(760, SC, -1); tree('korsbar', 800, SB); tree('lind', 862, SB);
  sign(cw[1].name, cw[1].x0 - 10, SB, 1);
  lamp(1010, SC, -1); tree('bjork', 1050, SB); lamp(1130, SC, -1); hydrant(1160, SC + 1); tree('korsbar', 1178, SB);
  sign(cw[2].name, cw[2].x0 - 10, SB, 1);
  tree('lind', 1316, SB); lamp(1370, SC, -1); tree('bjork', 1430, SB); bin(1486, SB); tree('korsbar', 1540, SB); lamp(1600, SC, -1); tree('lind', 1660, SB);

  // =================== parken ===================
  // övre remsan: häckar med bänkar framför, rabatter och parklyktor
  const PB = PU - 3; // 331 – bänkarnas fotlinje ovanför promenaden
  const HY = CITY.PARK[0] + 10; // 316 – häckarnas fotlinje
  const benchGroup = (x, w = 46) => { hedge(x, HY, w); bench(x, PB); };
  benchGroup(52); bin(76, PB); parkLamp(100, PB); bed(142, PB, 44, ['red', 'yellow', 'white']);
  benchGroup(206); parkLamp(250, PB);
  benchGroup(338); parkLamp(382, PB); bed(432, PB, 48, ['purple', 'pink', 'white']);
  benchGroup(500); bin(524, PB); parkLamp(552, PB); bed(606, PB, 40, ['orange', 'yellow']);
  benchGroup(668); parkLamp(712, PB); bed(772, PB, 48, ['red', 'pink', 'white']); benchGroup(842, 42);
  parkLamp(994, PB); benchGroup(1036); bed(1102, PB, 44, ['yellow', 'blue', 'white']); benchGroup(1166); bin(1190, PB); parkLamp(1212, PB);
  parkLamp(1266, PB); bed(1312, PB, 44, ['pink', 'purple', 'white']); benchGroup(1378); parkLamp(1422, PB);
  bed(1478, PB, 44, ['red', 'orange', 'yellow']); benchGroup(1542); parkLamp(1592, PB); bed(1642, PB, 40, ['blue', 'white']);
  // nedre delen: lyktor, bänkar mot promenaden, träd, buskar och rabatter
  for (const x of [170, 470, 760, 1100, 1330, 1620]) parkLamp(x, PD + 8);
  for (const x of [250, 620, 1250, 1480]) bench(x, PD + 12, true);
  bench(906, 404, true); bench(962, 404, true);
  const PT = [[40, 404, 'ek'], [128, 384, 'lonn'], [214, 414, 'gran'], [330, 398, 'ek'], [418, 378, 'korsbar'], [544, 410, 'lonn'], [640, 390, 'gran'],
    [722, 414, 'ek'], [820, 386, 'lonn'], [1030, 412, 'ek'], [1120, 382, 'gran'], [1200, 406, 'lonn'], [1300, 388, 'ek'], [1390, 414, 'korsbar'],
    [1470, 384, 'lonn'], [1560, 408, 'ek'], [1650, 386, 'gran']];
  for (const [x, y, k] of PT) tree(k, x, y, false);
  for (const [x, y, f] of [[82, 368, 'pink'], [270, 372, null], [486, 366, 'white'], [590, 380, 'purple'], [690, 366, null], [1000, 382, 'red'],
    [1160, 366, null], [1260, 372, 'pink'], [1352, 366, 'blue'], [1520, 370, null], [1606, 368, 'white']]) bush(x, y, f);
  for (const [x, y, w, r] of [[176, 402, 40, ['red', 'yellow']], [600, 404, 44, ['pink', 'white', 'purple']], [1082, 396, 40, ['orange', 'yellow']], [1436, 400, 44, ['blue', 'white', 'pink']]]) bed(x, y, w, r);

  // fontänen mitt på torget
  const FR = [];
  for (let f = 0; f < FOUNT.frames; f++) FR.push(spr(70, 72, 35, 64, (P) => paintFountain(P, f, FOUNT.frames)));
  const FGLOW = spr(70, 72, 35, 64, paintFountainGlow);
  const fframe = () => FR[Math.floor(env.t * 12) % FOUNT.frames];
  add('fontän', FOUNT.x, FOUNT.y, [FOUNT.x - 27, FOUNT.y - 25, FOUNT.x + 28, FOUNT.y + 1], [[FOUNT.x - 26, FOUNT.y - 24, FOUNT.x + 27, FOUNT.y]], (ctx) => put(ctx, fframe(), FOUNT.x, FOUNT.y));

  if (skipped.length) console.warn('rekvisita som inte fick plats (RESERVED/hus/annan rekvisita):', skipped.join(', '));

  return {
    items: () => items,
    obstacles,
    _skipped: skipped,
    update(dt) {
      gustT -= dt;
      if (gustT <= 0) { gustT = 2 + Math.random() * 4; gustTo = Math.random() * (env.rain ? 1.8 : 0.9); }
      gust += (gustTo - gust) * Math.min(1, dt * 0.8);
    },
    glow(ctx) {
      const k = clamp((env.dark - 0.1) / 0.28, 0, 1);
      if (k <= 0) return;
      const m = ctx.getTransform ? ctx.getTransform() : null;
      const sc = m && m.a ? m.a : 1, vx = m ? -m.e / sc : 0, vw = ctx.canvas.width / sc;
      const vis = (x) => x > vx - 90 && x < vx + vw + 90;
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) {
        if (!vis(g.x)) continue;
        let a = g.a;
        if (g.flicker) a *= hash(Math.floor(env.t * 9), 1, g.x) > 0.25 ? 1 : 0.25;
        ctx.globalAlpha = k * a;
        put(ctx, g.s, g.x, g.y);
      }
      if (vis(FOUNT.x)) {
        ctx.globalAlpha = k * (0.85 + 0.15 * Math.sin(env.t * 2));
        put(ctx, FGLOW, FOUNT.x, FOUNT.y);
        ctx.globalAlpha = k * 0.3;
        put(ctx, fframe(), FOUNT.x, FOUNT.y);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const l of lits) {
        if (!vis(l.x)) continue;
        ctx.globalAlpha = Math.min(1, k * l.a);
        put(ctx, l.s, l.x, l.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
