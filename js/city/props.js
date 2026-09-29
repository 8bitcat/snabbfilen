// Rekvisitan i Pixelstaden – allt som står på trottoarerna, i tvärgatorna och
// i parken: gatuträd i trädgaller, parkträd, blomsterlådor, krukor, rabatter,
// häckar, buskar, gatlyktor, parklyktor, bänkar, papperskorgar, cykelställ,
// brandposter, brevlåda, löpsedelställ, gatuskyltar, kaféterrassen, frukt-
// disken och kundvagnarna vid Stormarknad, busskuren, fontänen på torget och
// glasståndet i parken (kioskens plats) med meny och uteservering.
//
// All konst målas EN gång med Pix-pennan (ett pixelkorn: 1 enhet = 1 pixel)
// och cachas som canvasar. Per bildruta ritas bara färdiga bilder på heltal:
// kronorna vajar genom att tre band förskjuts en pixel, fontänen bläddrar
// mellan förmålade vattenrutor och kvällsljuset läggs i glow().
//
// Kontrakt: createProps(env) → { items(), obstacles, update(dt), glow(ctx, view),
//   seats(), seatAt(x, y, isFree?), seatNear(x, y, r?, isFree?) }  – alla bänkar och busskurernas
//   bänkar går att sitta på (se "sittplatser" i createProps). export const V2 = true.
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW, eachTextPixel } from '../core/floor-pix.js';
import { CITY, BUILDINGS, ALL_BUILDINGS, CROSSWALKS, CROSSWALKS_S, PARK_LAYOUT, BUS_STOP, BUS_STOPS, LOTS, RESERVED, footprint, gateRect, artBox } from './map.js';

// Rekvisitan täcker hela v2-världen (Söder, parken, Infarten, förorten) – scenen
// kopplar bort platshållaren i fallback-v2.js när V2 är satt.
export const V2 = true;

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
// kronan böjs rad för rad: toppen följer svajet fullt ut, nedåt allt mindre. I lugnt väder står
// de nedersta raderna (mot stammen) still som förr; i hård vind följer även nederdelen med en
// bit (stammen böjer sig). Heltalssteg – en drawImage per band med samma förskjutning.
function drawCrown(ctx, s, x, y, sway) {
  const img = s.img, w = img.width, h = img.height, dx = Math.round(x) - s.ax, dy = Math.round(y) - s.ay;
  const foot = 0.25 * Math.max(0, Math.min(1, (Math.abs(sway) - 2) / 4)), fix = Math.max(2, Math.floor(h * 0.88));
  const off = (yy) => Math.round(sway * (foot + (1 - foot) * (yy >= fix ? 0 : Math.pow(1 - yy / fix, 0.8))));
  let y0 = 0, o0 = off(0);
  for (let yy = 1; yy <= h; yy++) {
    const o = off(yy);
    if (yy < h && o === o0) continue;
    ctx.drawImage(img, 0, y0, w, yy - y0, dx + o0, dy + y0, w, yy - y0);
    y0 = yy; o0 = o;
  }
}

// ---------- lyktor ----------
// worn: lutande, rostig stolpe med klistermärken (förorten); lean = px åt sidan i toppen
function paintStreetLamp(P, m, worn = 0, lean = 0) {
  const lx = (y) => (lean ? Math.round(((-8 - y) / 52) * lean) : 0);
  // sockel med serviceslucka
  for (let y = -7; y <= 0; y++) for (let x = -2; x <= 3; x++) {
    let v = 0.8 - ((x + 2) / 5) * 0.6 + (y === -7 ? 0.18 : 0) - (y === 0 ? 0.3 : 0);
    P.px(x, y, worn && hash(x, y, 7) > 0.8 ? RUST[2] : tone(POLE, v, x, y));
  }
  if (worn) { P.rect(-1, -5, 3, 3, 0x0a0a0c); P.px(0, -4, POLE[0]); } // luckan borta
  else { P.rect(-1, -5, 3, 3, POLE[1]); P.hl(-1, -5, 3, POLE[0]); P.px(1, -4, POLE[3]); }
  // stolpen
  for (let y = -60; y <= -8; y++) {
    const dx = lx(y);
    P.px(dx, y, worn && hash(0, y, 8) > 0.86 ? RUST[1 + (y & 1)] : hash(0, y, 3) > 0.92 ? POLE[4] : POLE[3]);
    P.px(dx + 1, y, POLE[1]);
  }
  P.hl(-1 + lx(-34), -34, 4, POLE[2]); P.px(-1 + lx(-34), -34, POLE[4]); P.px(2 + lx(-34), -34, POLE[0]);
  if (worn) { P.rect(-1 + lx(-40), -42, 4, 4, 0xf4f1ea, 0.9); P.px(lx(-40), -41, 0xd02020); P.rect(-1 + lx(-24), -26, 4, 3, 0x36d6ff, 0.9); P.rect(lx(-18), -19, 3, 3, 0xffe030, 0.9); }
  // böjd arm och lykthuvud
  const ox = lx(-61);
  const ax = (i) => ox + (m > 0 ? 1 + i : -i);
  P.px(ox, -61, POLE[3]); P.px(ox + 1, -61, POLE[2]);
  P.px(ax(1), -62, POLE[3]); P.px(ax(1), -61, POLE[1]);
  for (let i = 2; i <= 8; i++) { P.px(ax(i), -63, POLE[4]); P.px(ax(i), -62, POLE[2]); }
  const hx0 = ox + (m > 0 ? 6 : -12);
  for (let x = hx0; x < hx0 + 8; x++) {
    P.px(x, -62, x === hx0 || x === hx0 + 7 ? POLE[2] : POLE[3]);
    P.px(x, -61, POLE[2]); P.px(x, -60, POLE[1]);
  }
  P.hl(hx0 + 1, -63, 6, POLE[4]);
  if (worn === 2) { P.hl(hx0 + 1, -59, 6, 0x6a706c); P.px(hx0 + 3, -59, 0x2a2e2c); P.px(hx0 + 4, -58, 0xcfd6cc); } // krossat glas
  else { P.hl(hx0 + 1, -59, 6, 0xcfd6cc); P.px(hx0 + 1, -59, 0xa8b0a6); P.px(hx0 + 6, -59, 0x9aa298); }
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
// torra kvistar (vinterns rabatter och blomlådor): korta bruna stjälkar med en knopp här och var
function dryTwigs(P, x0, x1, y, seed, step = 2) {
  for (let x = x0; x <= x1; x += step) {
    if (hash(x, seed, 21) < 0.4) continue;
    const h = 2 + Math.floor(hash(x, seed, 22) * 5), c = hash(x, seed, 23) > 0.5 ? 0x5a4630 : 0x7a6244;
    P.vl(x, y - h + 1, h, c);
    if (hash(x, seed, 24) > 0.6) P.px(x + (hash(x, seed, 25) > 0.5 ? 1 : -1), y - h, 0x4a3a28);
  }
}
function paintFlowerBox(P, w, seed, cols, style, bare = false) {
  const x0 = -(w >> 1), x1 = x0 + w - 1;
  const pal = style === 'zink' ? STEEL : style === 'svart' ? IRON : WOOD;
  if (bare) dryTwigs(P, x0 + 1, x1 - 1, -8, seed);
  else {
    for (let i = 0; i < Math.ceil(w / 5); i++) {
      const cx = x0 + 2 + i * 5 + Math.round(hash(i, seed, 1) * 2);
      paintCrown(P, cx, -10, 3.4, 3 + hash(i, seed, 2) * 1.6, LEAVES, seed + i * 13, { clumps: 3, inner: 1, lift: 0.05 });
    }
    for (let i = 0; i < w - 1; i += 2) {
      if (hash(i, seed, 5) < 0.3) continue;
      const x = x0 + 1 + i, y = -11 - Math.round(hash(i, seed, 6) * 4);
      bloom(P, x, y, FL[cols[Math.floor(hash(i, seed, 7) * cols.length)]], hash(i, seed, 8) > 0.6 ? 1 : 0);
    }
  }
  for (let y = -7; y <= 0; y++) for (let x = x0; x <= x1; x++) {
    let v = 0.64 - ((x - x0) / w) * 0.3 + (y === -7 ? 0.28 : 0) - (y === 0 ? 0.3 : 0);
    if (style === 'tra') { if ((y + 7) % 3 === 2) v -= 0.2; v += (hash(x >> 2, y, seed) - 0.5) * 0.14; }
    else if ((y === -5 || y === -2) && x > x0 && x < x1) v -= 0.12;
    if (x === x0) v += 0.14; if (x === x1) v -= 0.22;
    P.px(x, y, tone(pal, v, x, y));
  }
  P.hl(x0 + 1, -8, w - 2, SOIL[2]);
  if (!bare) for (let i = 1; i < w - 1; i++) if (hash(i, seed, 9) > 0.8) {
    const x = x0 + i, len = 1 + Math.floor(hash(i, seed, 10) * 3);
    for (let k = 0; k < len; k++) P.px(x, -6 + k, k === len - 1 && hash(i, seed, 11) > 0.5 ? FL[cols[0]][1] : LEAVES[4 - (k & 1)]);
  }
  outline(P, 0x141018, 0x141018, 0.45);
  groundShadow(P, 2, 0, w / 2 + 2, 2.5);
}
function paintPot(P, plant, seed, bare = false) {
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
    if (!bare) for (let i = 0; i < 7; i++) bloom(P, -5 + Math.round(hash(i, seed, 3) * 10), -19 + Math.round(hash(i, seed, 4) * 6), FL[i % 3 ? 'red' : 'pink'], 1);
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
function paintBed(P, w, seed, rows, bare = false) {
  const x0 = -(w >> 1), x1 = x0 + w - 1, D = 9;
  for (let y = -D; y <= -2; y++) for (let x = x0 + 1; x < x1; x++) P.px(x, y, tone(SOIL, 0.45 + (hash(x, y, seed) - 0.5) * 0.6, x, y));
  for (let x = x0; x <= x1; x++) P.px(x, -D - 1, tone(GRANITE, 0.75 - ((x - x0) % 5 === 0 ? 0.3 : 0) + (hash(x, 2, seed) - 0.5) * 0.1, x, -D - 1));
  for (let y = -D; y <= 0; y++) { P.px(x0, y, GRANITE[3]); P.px(x1, y, GRANITE[1]); }
  if (bare) { dryTwigs(P, x0 + 2, x1 - 2, -D + 3, seed, 3); dryTwigs(P, x0 + 3, x1 - 2, -3, seed + 1, 3); }
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
// worn (förorten): oklippt och ojämn topp, bruna döda fläckar, ett genomtrampat hål och skräp vid foten
const DEAD = [0x2a1e10, 0x4a3818, 0x6a5426, 0x8a7036, 0xa88a48];
function paintHedge(P, w, h, seed, worn = false) {
  const x0 = -(w >> 1), x1 = x0 + w - 1;
  const hole = worn ? x0 + 6 + Math.floor(hash(seed, 1, 81) * Math.max(1, w - 16)) : -999; // genomtrampat hål (4 px brett)
  for (let x = x0; x <= x1; x++) {
    const tp = worn ? -h - 4 + Math.round((hash(x >> 2, 0, seed + 82) - 0.35) * 4) + (hash(x, 1, seed + 83) > 0.8 ? -2 : 0) : -h - 4;
    for (let y = tp; y <= -1; y++) {
      if (!worn && y === tp && (x === x0 || x === x1)) continue;
      if (y === tp + 1 && (x === x0 || x === x1) && hash(x, y, seed) > 0.5) continue;
      if (worn && x >= hole && x < hole + 4 && y > -h + 1) continue;
      const onTop = y < tp + 4;
      let v = onTop ? 0.86 - (y - tp) * 0.06 : 0.6 - ((y + h) / h) * 0.4;
      v += (hash(x >> 1, y >> 1, seed) - 0.5) * 0.3 + (hash(x, y, seed + 1) - 0.5) * 0.12;
      if (x === x0) v += 0.1; if (x >= x1 - 1) v -= 0.2;
      const dead = worn && hash(x >> 2, y >> 2, seed + 84) > 0.72;
      P.px(x, y, tone(dead ? DEAD : BOX, v, x, y));
    }
  }
  const top = -h - 4;
  if (!worn) for (let x = x0 + 1; x < x1; x++) if (hash(x, 0, seed + 3) > 0.62) P.px(x, top - 1, BOX[4]);
  for (let x = x0 + 2; x < x1 - 1; x += 3) if (hash(x, 1, seed + 4) > 0.7) P.px(x, top + 4 + Math.floor(hash(x, 2, seed) * (h - 2)), worn ? DEAD[4] : BOX[5]);
  if (worn) {
    // spretiga skott som ingen klippt, kvistar genom hålet
    for (let x = x0 + 2; x < x1 - 1; x += 5) if (hash(x, 3, seed + 85) > 0.45) P.line(x, top + 1, x + Math.round((hash(x, 4, seed) - 0.5) * 4), top - 3 - Math.floor(hash(x, 5, seed) * 3), BOX[3]);
    P.line(hole, -3, hole + 3, -6, DEAD[1]); P.px(hole + 1, -2, DEAD[2]);
  }
  outline(P, BOX[0], BOX[1], 0.7);
  if (worn) {
    P.rect(hole + 5, -3, 3, 3, 0xe8e0c8); P.px(hole + 6, -2, 0xd02020);                  // mjölkpaket
    P.px(x1 - 5, -1, 0x3a8a3a); P.px(x1 - 4, 0, 0x3a8a3a); P.px(x0 + 4, 0, 0xc8c0a8);   // flaska, papper
    P.rect(x0 + 8, -h - 1, 3, 2, 0xf4f4f8, 0.85); P.px(x0 + 9, -h + 1, 0xd8d8e0);         // plastpåse i häcken
  }
  groundShadow(P, 3, 0, w / 2 + 3, 2.6, 0.32);
}
// snår (förorten): ovårdad buske med döda grenar, en fastblåst påse – kala kvistar på vintern
const SCRUB = { grön: [0x16200e, 0x243214, 0x36481c, 0x4e6226, 0x6a7c34, 0x8c9a48], höst: [0x2e200a, 0x4e3812, 0x72541a, 0x967424, 0xb89434, 0xd2b04a] };
function paintScrub(P, seed, season) {
  if (season === 'vinter') {
    paintBare(P, { top: -9, ry: 17, bark: [0x241a12, 0x42342a, 0x625444, 0x827462] }, seed);
    for (let x = -5; x <= 5; x += 2) if (hash(x, seed, 86) > 0.5) P.px(x, 0, 0x5a4a38);
  } else {
    paintCrown(P, 0, -8, 11, 8, season === 'höst' ? SCRUB.höst : SCRUB.grön, seed, { clumps: 8, inner: 3, holes: 0.06, rough: 1.8 });
    // döda grenar som sticker ut och bruna fläckar
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI * (0.15 + hash(i, seed, 87) * 0.7), r0 = 5, r1 = 12 + hash(i, seed, 88) * 4;
      P.line(Math.round(Math.cos(a) * r0), Math.round(-8 + Math.sin(a) * r0 * 0.7), Math.round(Math.cos(a) * r1), Math.round(-8 + Math.sin(a) * r1 * 0.75), DEAD[1 + (i & 1)]);
    }
    for (let i = 0; i < 6; i++) { const x = -8 + Math.floor(hash(i, seed, 89) * 16), y = -13 + Math.floor(hash(i, seed, 90) * 10); P.px(x, y, DEAD[3]); P.px(x + 1, y, DEAD[2]); }
    outline(P, 0x10160a, 0x1a2410, 0.7);
  }
  // fastblåst plastpåse och en burk vid roten
  if (hash(seed, 2, 91) > 0.35) { P.rect(3, -12, 4, 3, 0xf0f0f4, 0.9); P.px(4, -9, 0xd0d0d8); P.px(7, -13, 0xffffff); P.px(5, -11, 0x3a7bd5); }
  P.rect(-7, -2, 3, 2, 0xc02828); P.px(-7, -2, 0xe8e8e8);
  groundShadow(P, 4, 1, 12, 3, 0.28);
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
// (Burgarbarens menyställ ritas numera av fasaden i buildings-work.js – BURGARE_STAND –
//  så props har ingen egen variant. Kafémenyn nedan är kaféets trottoartavla.)
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

// ---------- glasståndet i parken ----------
// Parkens kiosk är numera ett ÖPPET glasstånd utan framvägg – man ser rakt in på
// expediten som skopar kulglass ur glasdisken, strutarna i hållaren och mjukglass-
// maskinen. Ståndet ritas som rekvisita PÅ kioskens plats och sorteras en hårsmån
// efter husets base (+0,6): den gamla kioskbilden hamnar under, och den som går in
// genom "dörren" (livet klipper figuren i dörröppningen) försvinner bakom disken.
// Tre lager i samma föremål: bakre bilden (tak, flaggstång, markis, väggar,
// inredning) → flaggan och expediten (people.js, laddas tåligt) → främre bilden
// (glasdisken, luckan, strutarna i hållaren, plattorna). Utanför öppettid rullas
// en jalusi ner. Fotpunkten GS = dörrmitten på kioskens base (map.js: x 392–432, base 452).
const KIOSK_B = ALL_BUILDINGS.find((b) => b.id === 'kiosk');
const GS = {
  x: KIOSK_B ? (KIOSK_B.door.x0 + KIOSK_B.door.x1) >> 1 : 412,
  y: KIOSK_B ? KIOSK_B.base : 452,
  open: KIOSK_B?.open || [7, 22],
};
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const VAF = [0x6a4520, 0x96662f, 0xc08c44, 0xe0b46a];               // våffelstrut
const KULOR = [                                                       // smakerna (mörk → ljus)
  { id: 'jordgubb', c: [0xb03060, 0xe0517f, 0xf587ad, 0xffc2d8] },
  { id: 'vanilj', c: [0xb09a58, 0xdcc88a, 0xf2e6b4, 0xfdf6d8] },
  { id: 'pistage', c: [0x4a7a2e, 0x6fa04a, 0x96c470, 0xc4e4a2] },
  { id: 'choklad', c: [0x3a2414, 0x59391f, 0x7a522e, 0x9a7042] },
  { id: 'blabar', c: [0x2c3a8a, 0x4a5cb8, 0x7488dc, 0xa8b8f0] },
  { id: 'hallon', c: [0x8a1c44, 0xc23364, 0xe25c8a, 0xf49ebc] },
  { id: 'citron', c: [0xa08a20, 0xccb534, 0xe8d75c, 0xf8f0a0] },
  { id: 'lakrits', c: [0x121014, 0x28242c, 0x403a46, 0x5c5464] },
];
const GS_ROSA = [0xc23a68, 0xf0629a, 0xf8f2e6];                       // markisens ränder
const GS_CREME = [0xb8ac92, 0xd4c9ae, 0xe9dfc9, 0xf6efe2, 0xfffaf0];  // träpanel
const MINT = [0x1e5a4c, 0x2e7a68, 0x4a9e8a, 0x74c2ac, 0xa8e0cc];      // ståndets mintgröna järn/lack
const STRO = [0xf0629a, 0xf0c020, 0x2a5ad0, 0x6fdc4c, 0xffffff];      // strössel
// liten glassbild: strutspetsen står i (x, y); mjuk = mjukglass med virvel, two = två kulor
function miniGlass(P, x, y, c, mjuk = false, two = false) {
  P.px(x, y, VAF[1]); P.px(x - 1, y - 1, VAF[2]); P.px(x, y - 1, VAF[3]); P.px(x + 1, y - 1, VAF[1]);
  if (mjuk) {                                                         // gräddvit virvel med tydlig skuggsida (syns mot ljus botten)
    P.rect(x - 1, y - 4, 3, 3, 0xf4ead0); P.px(x - 1, y - 4, 0xffffff); P.px(x + 1, y - 4, 0xd0bc90);
    P.px(x + 1, y - 3, 0xb89e6c); P.px(x + 1, y - 2, 0xa88a58); P.px(x, y - 2, 0xd0bc90); P.hl(x - 1, y - 3, 2, 0xe4d4ac);
    P.px(x, y - 5, 0xf4ead0); P.px(x - 1, y - 5, 0xffffff, 0.7); P.px(x + 1, y - 5, 0xb89e6c); P.px(x, y - 6, 0xc8b088);
  } else {
    P.rect(x - 1, y - 4, 3, 3, c[1]); P.px(x - 1, y - 4, c[3]); P.px(x, y - 3, c[2]); P.px(x + 1, y - 2, c[0]);
    if (two) { P.rect(x - 1, y - 6, 3, 2, KULOR[1].c[1]); P.px(x - 1, y - 6, KULOR[1].c[3]); P.px(x + 1, y - 5, KULOR[1].c[0]); }
  }
}
// en balja kulglass i disken: rundad topp, skopade "vågor", glans uppe till vänster
function glassTub(P, x, y, w, h, k, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = 0.62 - j * 0.12 - i * 0.05 + (hash(x + i, y + j, seed) - 0.5) * 0.16;
    if (j === 0 && (i === 0 || i === w - 1)) continue;                 // rundade hörn uppe
    if ((i + j * 2 + seed) % 5 === 0) v += 0.22;                      // skopade vågor
    P.px(x + i, y + j, k.c[clamp(Math.round(v * 3), 0, 3)]);
  }
  P.px(x + 1, y, k.c[3]);
}

// --- bakre bilden: flaggstång, jättestrut, tak, skylt, markis, pelare och inredning ---
function paintGlassStandBack(P) {
  // flaggstången i västra takhörnet (duken vajar i live)
  P.vl(-30, -94, 26, 0xe4e8ec); P.vl(-29, -94, 26, 0x8a9098);
  P.rect(-30, -96, 2, 2, 0xe0b030); P.px(-30, -96, 0xfff0a0); P.px(-29, -95, 0x9a6c10);
  P.hl(-31, -69, 4, 0x4a4e54); P.px(-31, -69, 0x6a7078);
  // jättestruten på taket
  for (let y = -77; y <= -69; y++) {
    const hw = ((-68 - y) / 9) * 4.6;
    for (let x = Math.round(-hw); x <= Math.round(hw); x++) {
      const g = ((x - y) % 3 === 0 || (x + y) % 3 === 0);
      P.px(x, y, mul(g ? VAF[1] : VAF[2], 1 - (x + hw) / (2 * hw + 1) * 0.35 + 0.1));
    }
  }
  P.hl(-5, -78, 10, VAF[3]); P.px(-5, -78, 0xf0d090); P.px(4, -78, VAF[1]);
  disc(P, -1, -82, 4.4, 3.6, KULOR[0].c[1]);
  P.px(-3, -84, KULOR[0].c[3]); P.px(-2, -84, KULOR[0].c[2]); P.px(-3, -83, KULOR[0].c[2]); P.px(2, -80, KULOR[0].c[0]); P.px(1, -79, KULOR[0].c[0]);
  P.px(-4, -79, KULOR[0].c[1]); P.px(-4, -78, KULOR[0].c[0]);                                  // en droppe rinner
  disc(P, 2, -85, 3.2, 2.8, KULOR[1].c[2]); P.px(1, -87, KULOR[1].c[3]); P.px(0, -86, KULOR[1].c[3]); P.px(4, -84, KULOR[1].c[0]);
  for (const [sx, sy, c] of [[-2, -81, 0], [1, -83, 1], [3, -86, 2], [-1, -86, 3]]) P.px(sx, sy, STRO[c]); // strössel
  P.px(1, -89, 0xd8303a); P.px(2, -89, 0xa81c28); P.px(2, -90, 0x3a5a22);                    // körsbäret
  P.px(-6, -68, 0x4a4e54); P.px(6, -68, 0x33373c);                                             // hållarens fästen
  // takplåten
  for (let x = -30; x <= 29; x++) {
    P.px(x, -68, x < -26 || x > 25 ? 0xc8ccd0 : 0xe2e6ea);
    for (let y = -67; y <= -65; y++) P.px(x, y, (x % 6 === 0) ? 0x9aa0a8 : mix(0xaeb4bc, 0xb8bec6, hash(x, y, 61)));
    P.px(x, -64, 0x7a8088);
  }
  P.vl(-30, -68, 5, 0xe4e8ec); P.vl(29, -68, 5, 0x6a7078);
  // fasadskylten GLASS
  for (let y = -63; y <= -56; y++) for (let x = -30; x <= 29; x++) {
    let v = 0.9 - ((x + 30) / 60) * 0.35 + (hash(x >> 2, y, 62) - 0.5) * 0.08;
    if (y === -63) v += 0.16; if (y === -56) v -= 0.3;
    P.px(x, y, tone(GS_CREME, v, x, y));
  }
  for (const x of [-30, -29, 28, 29]) P.vl(x, -63, 8, x < 0 ? TEAK[3] : TEAK[1]);
  text(P, BIG, 'GLASS', -13, -61, 0xa8265a, 0.4); text(P, BIG, 'GLASS', -14, -62, 0xd8407a);
  eachTextPixel(BIG, 'GLASS', -14, -62, 1, (x, y) => { if (y === -62) P.px(x, y, 0xf27aa8); }); // ljuskant överst på bokstäverna
  miniGlass(P, -22, -57, KULOR[2].c); miniGlass(P, 20, -57, KULOR[0].c, false, true);
  // randig markis med bågkant och ljusslinga (släckt på dagen)
  const scallop = [2, 3, 3, 2, 1, 0, 0, 1];
  for (let x = -32; x <= 31; x++) {
    const rosa = Math.floor((x + 32) / 4) % 2 === 0, drop = scallop[(x + 32) % 8];
    const yb = -45 + drop;
    for (let y = -55; y <= yb; y++) {
      let c = rosa ? GS_ROSA[1] : GS_ROSA[2];
      c = mul(c, 1.04 - ((y + 55) / 12) * 0.26 - ((x + 32) / 64) * 0.1);
      if (y === -55) c = mix(c, 0xffffff, 0.3);
      if ((x + 32) % 4 === 0 && y > -55) c = mul(c, 0.93);             // sömmen mellan våderna
      if (y === yb) c = mul(rosa ? GS_ROSA[0] : 0xcfc4ac, 0.9);
      P.px(x, y, c);
    }
    P.px(x, yb + 1, 0x2a2026, 0.5);
    if ((x + 32) % 8 === 2) { P.px(x, yb + 1, 0xd8c8a0); P.px(x, yb + 2, 0x8a7a60, 0.6); } // slingans lampor
  }
  // pelarna (öppningen är mellan dem)
  for (const [x0, sh] of [[-28, 0], [20, -0.16]]) {
    for (let y = -48; y <= -1; y++) for (let x = x0; x < x0 + 8; x++) {
      let v = 0.78 + sh - ((x - x0) / 8) * 0.3 + (hash(x >> 1, y >> 2, 63) - 0.5) * 0.08;
      if (y === -36 || y === -24 || y === -12) v -= 0.22;
      if (x === x0) v += 0.14; if (x === x0 + 7) v -= 0.2;
      P.px(x, y, tone(GS_CREME, v, x, y));
    }
    P.vl(x0, -48, 48, TEAK[3]); P.vl(x0 + 7, -48, 48, TEAK[1]);
    for (let x = x0; x < x0 + 8; x++) { P.px(x, 0, 0x8a8070); P.px(x, -1, MINT[1]); P.px(x, -2, (x & 1) ? MINT[2] : MINT[3]); }
  }
  miniGlass(P, -25, -28, KULOR[5].c, false, true);                    // dekal på västra pelaren
  miniGlass(P, 23, -28, KULOR[2].c, true);                            // mjukglassdekal på östra
  P.rect(-26, -20, 4, 3, 0xf4f1ea); P.px(-25, -19, 0xd8407a); P.px(-24, -19, 0xd8407a); // "öppet"-lapp med hjärta
  // --- inredningen: takbjälke med lysrör, kakelvägg, hylla, skopor, affisch ---
  for (let x = -20; x <= 19; x++) { P.px(x, -44, TEAK[0]); P.px(x, -43, TEAK[1]); }
  P.hl(-16, -42, 22, 0xf4ecd8); P.px(-17, -42, 0x8a9098); P.px(6, -42, 0x8a9098);             // lysröret
  for (let y = -41; y <= -13; y++) for (let x = -20; x <= 19; x++) {
    const row = Math.floor((y + 41) / 3), off = (row & 1) ? 2 : 0;
    const grout = (x + 20 + off) % 4 === 3 || (y + 41) % 3 === 2;
    const band = y >= -23 && y <= -21;
    let c = band ? (grout ? 0x7aa89a : 0xa8e0cc) : grout ? 0xc4ccc4 : 0xf2efe6;
    let v = 1 - Math.max(0, -35 - y) * 0.06 - (Math.abs(x + 0.5) / 20) ** 2 * 0.22;          // skuggan under bjälken + hörnen
    if (!grout && !band && hash((x + 20 + off) >> 2, row, 64) > 0.8) v -= 0.05;             // enstaka kakel lite gråare
    P.px(x, y, mul(c, v));
  }
  for (let y = -41; y <= -13; y++) { P.px(-20, y, 0x6a6458); P.px(19, y, 0x8a8478); }         // hörnskuggor mot pelarna
  slat(P, -19, -34, 25, -0.05, TEAK);                                                          // hyllan
  P.hl(-19, -32, 25, 0x5a5448, 0.5);                                                           // hyllans skugga på kaklet
  for (const x of [-18, -14]) {                                                                // strutar i pappershylsor
    P.rect(x, -38, 3, 4, 0xf0629a); P.px(x, -38, 0xf8a0c4); P.px(x + 2, -37, 0xc23a68); P.px(x + 2, -36, 0xc23a68);
    P.px(x + 1, -36, 0xffffff); P.px(x + 1, -37, 0xffffff, 0.6);
    P.hl(x, -39, 3, VAF[3]); P.px(x + 1, -40, VAF[2]); P.px(x + 2, -39, VAF[1]);
  }
  for (let i = 0; i < 3; i++) {                                                                // strösselburkar
    const x = -9 + i * 4, fill = STRO[i];
    P.rect(x, -38, 3, 4, 0xc8d4d8); P.rect(x, -37, 3, 2, fill); P.px(x, -39, 0x6a7078); P.px(x + 1, -39, 0x8a949a); P.px(x + 2, -39, 0x6a7078);
    P.px(x, -38, 0xe8f4f8, 0.8); P.px(x + 2, -36, mul(fill, 0.7)); if (i !== 1) P.px(x + 1, -36, STRO[(i + 2) % 4]);
  }
  P.rect(3, -38, 3, 4, 0xd83a2a); P.hl(3, -38, 3, 0xf4f1ea); P.px(4, -36, 0xf0c020);          // rånburken
  P.hl(-18, -30, 11, 0x8a9098); P.px(-18, -30, 0xc8ccd0);                                      // krokskenan med skopor
  for (const x of [-17, -13, -9]) { P.vl(x, -29, 2, 0x9aa4ac); P.rect(x - 1, -27, 3, 2, 0xc8d0d8); P.px(x - 1, -27, 0xf0f4f8); P.px(x + 1, -26, 0x6a7078); }
  P.box(-6, -31, 9, 9, 0xd8407a); P.rect(-5, -30, 7, 7, 0xfdf6e8);                            // affischen: NY + en strut
  text(P, SMALL, 'NY', -5, -30, 0xc23a68);
  miniGlass(P, 0, -24, KULOR[6].c); P.px(-4, -24, KULOR[6].c[1]); P.px(-3, -24, KULOR[6].c[2]);
  // mjukglassmaskinen (öster): två behållare, display, kranar med spakar, droppbricka
  for (let y = -41; y <= -13; y++) for (let x = 9; x <= 18; x++) {
    let v = 0.86 - ((x - 9) / 9) * 0.55 + (y > -17 ? -0.22 : 0) + (y === -41 ? 0.12 : 0) + ((x === 11 || x === 16) && y < -36 ? 0.1 : 0);
    P.px(x, y, tone(STEEL, v, x, y));
  }
  P.hl(9, -37, 10, 0x6a7078);                                                                  // behållarnas lock
  P.px(10, -40, 0xffffff); P.px(15, -40, 0xf4f8fa);
  P.rect(10, -35, 8, 3, 0x2a2e34); P.px(11, -34, 0x6fdc4c); P.px(13, -34, 0xffd23f); P.px(15, -34, 0x5ab4ff); // display
  for (const [tx, tc] of [[10, 0xd8407a], [15, 0xf2ecd8]]) {
    P.rect(tx, -31, 3, 2, tc); P.px(tx, -31, mix(tc, 0xffffff, 0.5)); P.px(tx + 2, -30, mix(tc, 0x000000, 0.25)); // spakens knopp
    P.vl(tx + 1, -29, 2, 0x4a4e54);                                                            // spaken
    P.rect(tx, -27, 3, 2, 0x3a3e44); P.px(tx + 1, -25, 0x1a1c20);                               // kranen
  }
  P.px(12, -24, 0xf2ecd8, 0.8);                                                                // en virvel som droppar
  P.hl(9, -19, 10, 0x33373c); P.hl(10, -18, 8, 0x8a949c); P.hl(9, -17, 10, 0x4a4e54);          // droppbrickan
  for (let x = 10; x <= 17; x += 2) P.px(x, -15, 0x2a2e34);                                    // ventilationsgaller
}

// --- främre bilden: glasdisken, luckan med strutar i hållare och plattorna framför ---
function paintGlassStandFront(P) {
  // glasdisken på luckans västra halva: två rader baljor under välvt glas (låg, så expedit syns bakom)
  P.hl(-20, -24, 21, 0xdce4e8); P.px(-20, -24, 0xffffff); P.px(0, -24, 0x9aa4ac);            // glasets överkant
  for (let y = -23; y <= -17; y++) for (let x = -19; x <= -1; x++) P.px(x, y, y === -20 ? 0x9aa4ac : 0x5a646c);
  for (let i = 0; i < 4; i++) {
    glassTub(P, -19 + i * 5, -23, 4, 3, KULOR[i + 4], 3 + i);
    glassTub(P, -19 + i * 5, -19, 4, 3, KULOR[i], 7 + i);
  }
  P.px(-13, -20, 0xe8ecf0); P.px(-13, -21, 0xc8d0d8); P.vl(-12, -22, 2, 0x8a949c);             // skopan i vaniljen
  for (let y = -23; y <= -17; y++) for (let x = -19; x <= -1; x++) {                          // glasets reflexer
    if ((x - y * 2) % 11 === 0) P.px(x, y, 0xffffff, 0.45);
    else if ((x - y * 2 + 1) % 11 === 0) P.px(x, y, 0xe8f4f8, 0.2);
  }
  P.hl(-19, -23, 19, 0xffffff, 0.25);
  for (const x of [-20, 0]) { P.vl(x, -23, 11, x < 0 ? 0xc8d0d8 : 0x7a848c); }                // gavlarna
  for (let y = -16; y <= -13; y++) for (let x = -19; x <= -1; x++) {                          // diskens emaljfront
    let v = 0.95 - ((x + 19) / 19) * 0.12 - (y === -13 ? 0.15 : 0);
    let c = y === -15 ? 0xf0629a : y === -14 ? 0xc23a68 : 0xf6f3ec;
    P.px(x, y, mul(c, v));
  }
  P.hl(-19, -16, 19, 0xb8c0c8);
  for (let x = -17; x <= -3; x += 7) { P.px(x, -15, 0xffffff); P.px(x + 1, -15, 0xffd8e8); }    // små hjärtan i randen
  // luckans disk: skiva, panel med mintband och våg, sparklist
  P.hl(-20, -12, 40, TEAK[4]); P.hl(-20, -11, 40, TEAK[2]); P.px(19, -11, TEAK[0]); P.px(-20, -12, 0xf0c888);
  for (let y = -10; y <= -1; y++) for (let x = -20; x <= 19; x++) {
    let v = 0.8 - ((x + 20) / 40) * 0.28 + (hash(x >> 3, y, 66) - 0.5) * 0.08;
    if (x % 8 === 4) v -= 0.18; if (x % 8 === 5) v += 0.08;
    if (y === -10) v -= 0.2; if (y === -1) v -= 0.3;
    P.px(x, y, tone(GS_CREME, v, x, y));
  }
  for (let x = -20; x <= 19; x++) { P.px(x, -7, MINT[3]); P.px(x, -6, (x & 3) === 0 ? MINT[2] : MINT[3]); P.px(x, -5, (x & 3) === 2 ? MINT[3] : 0xe9dfc9); }
  miniGlass(P, -14, -2, KULOR[0].c); miniGlass(P, -1, -2, KULOR[2].c, true); miniGlass(P, 12, -2, KULOR[4].c, false, true);
  P.hl(-20, 0, 40, 0x6a6052);
  // på disken: strutar i hållare, kortterminal, servettställ
  for (let x = 4; x <= 12; x++) { P.px(x, -16, x === 4 ? 0xf0f4f8 : 0xc8d0d8); for (let y = -15; y <= -13; y++) P.px(x, y, tone(STEEL, 0.75 - (x - 4) * 0.05 - (y + 15) * 0.1, x, y)); }
  for (const x of [5, 8, 11]) {                                                                // våffelstrutarna i hållaren: staplade strutar,
    P.px(x - 1, -21, VAF[3]); P.px(x, -21, 0xf0d090); P.px(x + 1, -21, VAF[2]);                // översta kanten ljus, mörk högersida mellan staplarna
    P.px(x - 1, -20, VAF[2]); P.px(x, -20, VAF[1]); P.px(x + 1, -20, VAF[0]);
    P.px(x - 1, -19, VAF[3]); P.px(x, -19, VAF[3]); P.px(x + 1, -19, VAF[1]);                  // nästa struts kant sticker upp
    P.px(x - 1, -18, VAF[1]); P.px(x, -18, VAF[2]); P.px(x + 1, -18, VAF[0]);
    P.px(x, -17, VAF[1]); P.px(x + 1, -17, VAF[0], 0.6);
    P.px(x, -16, 0x2a2e34);
  }
  P.rect(1, -14, 2, 2, 0x2a2e34); P.px(1, -14, 0x5ab4ff); P.px(2, -13, 0x1a1c20);             // kortterminalen
  P.rect(14, -17, 4, 5, 0xc8d0d8); P.px(14, -17, 0xf0f4f8); P.vl(17, -16, 4, 0x7a848c);         // servettstället
  P.hl(14, -18, 4, 0xffffff); P.px(15, -19, 0xffffff); P.px(16, -19, 0xf0ece4);
  // stenplattorna framför luckan (den gamla kioskens sockel täcks)
  for (let y = 1; y <= 3; y++) for (let x = -23; x <= 22; x++) {
    let v = 0.72 + (hash(x >> 1, y, 67) - 0.5) * 0.2 - ((x + 24) % 6 === 0 ? 0.25 : 0) - (y === 3 ? 0.14 : 0);
    if (y === 1 && x >= -20 && x <= 19) v -= 0.3;
    P.px(x, y, tone(GRANITE, v, x, y));
  }
  for (let i = 0; i < 9; i++) {                                                                // tappat strössel
    const x = -20 + Math.floor(hash(i, 3, 68) * 40), y = 1 + Math.floor(hash(i, 5, 68) * 3);
    P.px(x, y, STRO[i & 3]);
  }
  P.px(-6, 2, KULOR[0].c[1]); P.px(-5, 2, KULOR[0].c[2]); P.px(-6, 3, KULOR[0].c[0]);          // en tappad kula som smälter
}
// varm insida, tänd slinga och skylt (ritas source-over ovanpå mörkret, bara när det är öppet)
function paintGlassStandLit(P) {
  for (let y = -42; y <= -13; y++) for (let x = -20; x <= 19; x++) P.px(x, y, 0xffc888, 0.09 + (y < -38 ? 0.08 : 0));
  P.hl(-16, -42, 22, 0xffffff); P.hl(-16, -41, 22, 0xfff4d8, 0.5);                            // lysröret
  P.rect(-19, -23, 19, 7, 0xfff0d0, 0.16);                                                     // disken lyser
  P.rect(-20, -12, 40, 2, 0xffd9a0, 0.22);
  const scallop = [2, 3, 3, 2, 1, 0, 0, 1];
  const cols = [0xffd9a0, 0xf587ad, 0x9ad6c2, 0xf4e35c];
  for (let x = -32; x <= 31; x++) if ((x + 32) % 8 === 2) {
    const c = cols[((x + 32) >> 3) & 3], y = -44 + scallop[2];
    P.px(x, y, c); P.px(x, y - 1, mix(c, 0xffffff, 0.5), 0.8);
  }
  eachTextPixel(BIG, 'GLASS', -14, -62, 1, (x, y) => P.px(x, y, y === -62 ? 0xffd8ea : 0xff8abc));
  P.px(-30, -96, 0xfff0a0, 0.8);
}
function paintGlassStandGlow(P) {
  P.ell(0, -28, 26, 18, 0xffd9a0, 0.38, 5);                           // ljus ur öppningen
  P.ell(0, 6, 32, 9, 0xffc070, 0.42, 5);                              // pöl på plattorna framför
  P.ell(0, -59, 22, 6, 0xff9ac4, 0.45, 4);                            // skyltens rosa sken
  for (let x = -30; x <= 30; x += 8) P.ell(x, -42, 3, 2.5, 0xffe0b0, 0.5, 3); // slingans lampor
}
// jalusin som rullas ner utanför öppettid, med STÄNGT-skylt och en målad strut
function paintGlassShutter(P) {
  for (let y = -44; y <= -13; y++) for (let x = -20; x <= 19; x++) {
    const rib = (y + 44) % 3;
    let c = rib === 0 ? 0xf6d4e0 : rib === 1 ? 0xe8b4c8 : 0xc88aa4;
    c = mul(c, 1 - (x + 20) / 40 * 0.14 - (y < -40 ? 0.12 : 0));
    P.px(x, y, c);
  }
  P.hl(-20, -13, 40, 0x8a6a7a); P.rect(-2, -14, 4, 1, 0x4a4e54);                               // underlist + handtag
  miniGlass(P, 12, -18, KULOR[2].c, false, true); miniGlass(P, 15, -18, KULOR[0].c);
  // skylten: 30 px bred så att hela STÄNGT (24 px) får plats med luft på båda sidor (mitt på −1,5)
  P.rect(-16, -35, 30, 9, 0xf4f1ea); P.box(-16, -35, 30, 9, 0xd8407a); P.hl(-15, -34, 28, 0xffffff);
  P.px(-12, -37, IRON[3]); P.px(9, -37, IRON[3]); P.px(-11, -36, IRON[2]); P.px(8, -36, IRON[2]); // snöret
  text(P, SMALL, 'STÄNGT', -1 - (textW(SMALL, 'STÄNGT') >> 1), -33, 0xb02850);
  text(P, SMALL, '7-22', -7, -24, 0x8a3a5a);
}
// flaggan med glasstrut: 12 × 7 px duk, vågen växer mot den fria änden. e = fladdrar österut
function paintGlassFlag(P, ph, e, amp) {
  const s = e ? 1 : -1;
  const motif = { '5,1': 3, '6,1': 3, '7,1': 2, '5,2': 2, '6,2': 3, '7,2': 1, '5,3': 4, '6,3': 5, '7,3': 4, '6,4': 5, '6,5': 4 };
  for (let i = 0; i < 12; i++) {
    const w = amp * (i / 11), dy = Math.round(Math.sin(i * 0.8 - ph) * w), sl = Math.cos(i * 0.8 - ph) * w;
    for (let j = 0; j < 7; j++) {
      let c = j === 0 ? mix(GS_ROSA[1], 0xffffff, 0.25) : j === 6 ? GS_ROSA[0] : GS_ROSA[1];
      const m = motif[`${i},${j}`];
      if (m === 1) c = KULOR[1].c[1]; else if (m === 2) c = KULOR[1].c[2]; else if (m === 3) c = 0xffffff;
      else if (m === 4) c = VAF[2]; else if (m === 5) c = VAF[1];
      c = mul(c, 1 - sl * 0.14);
      if (i === 11 && (j & 1)) continue;                              // fransig ände
      P.px(i * s, j + dy, c);
    }
  }
}
// Den gamla kioskbildens tända fönster (buildings-south.js → facade-kit glow, additivt 'lighter')
// lyser annars rakt igenom ståndet på kvällen. Props glow körs efter husens glow: vi målar kioskens
// eget glow på svart och drar av det med 'difference' – exakt det som lades på tas bort, oavsett vad
// som står framför (folk vid luckan påverkas inte). Slutar kioskbilden lysa blir avdraget noll.
let kioskArt = null, unglowCv = null;
import('./buildings-south.js').then((m) => { kioskArt = m.BUILDING_ART?.kiosk || null; }).catch(() => {});
function unglowKiosk(ctx, env, view) {
  if (!kioskArt?.glow || !KIOSK_B || !(env.dark > 0)) return;
  const box = artBox(KIOSK_B), X0 = box.x - 8, Y0 = box.y - 8, W = box.w + 16, H = box.h + 16;
  if (view && (X0 > view.x + view.w || X0 + W < view.x || Y0 > view.y + view.h || Y0 + H < view.y)) return;
  if (!unglowCv || unglowCv.width !== W || unglowCv.height !== H) { unglowCv = document.createElement('canvas'); unglowCv.width = W; unglowCv.height = H; }
  const o = unglowCv.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
  o.fillStyle = '#000'; o.fillRect(0, 0, W, H);
  o.setTransform(1, 0, 0, 1, -X0, -Y0);
  o.save();
  try { kioskArt.glow(o, KIOSK_B, { t: env.t, night: env.night, hour: env.hour, doorOpen: 0, env, worn: 0 }); }
  catch { o.restore(); return; }
  o.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'difference'; ctx.globalAlpha = 1;
  ctx.drawImage(unglowCv, X0, Y0);
  ctx.restore();
}

// ---------- ljus som skyms av det som står framför (occ) ----------
// props.glow ritas efter mörkret, alltså ovanpå ALLT – även folk som står framför en ljuskälla
// (vid glasståndets disk blev de bleka som spöken i kvällsljuset). Ljus med occ: 'nyckel' skyms
// därför av det som ritas framför källan: när källans föremål har ritats (y-sorterat) kopplas en
// krok på duken som för över allt som därefter hamnar på ljusets yta (drawImage/fillRect: folk,
// djur, deras skuggor, rekvisita) till en mask – till sista föremålet i bilden (ljuskrok-slut).
// I glow stansas masken ur ljuset (destination-out) innan det läggs på: folk framför ståndet blir
// mörka siluetter mot det upplysta ståndet, som i verkligheten, och ljuspölen hamnar på marken
// runt fötterna i stället för på benen. Ingen läsning av pixlar – bara ritning på små dukar.
const OCC = { ctx: null, t: -1, W: null, Wi: null, di: null, fr: null, prevDI: null, prevFR: null, keys: [] };
const OCC_MASK = new Map();                                            // nyckel → { box, cv, g, t }
let occLightCv = null;
function cssAlpha(s) {                                                 // fillStyle läses tillbaka som #rrggbb eller rgba(…)
  if (s[0] === '#') return s.length === 9 ? parseInt(s.slice(7), 16) / 255 : s.length === 5 ? parseInt(s[4] + s[4], 16) / 255 : 1;
  const m = /rgba?\(([^)]*)\)/.exec(s);
  if (!m) return 1;
  const p = m[1].split(/[\s,/]+/).filter(Boolean);
  return p.length >= 4 ? parseFloat(p[3]) * (p[3].endsWith('%') ? 0.01 : 1) : 1;
}
function occStop() {
  const c = OCC.ctx;
  if (!c) return;
  if (c.drawImage === OCC.di) { if (OCC.prevDI) c.drawImage = OCC.prevDI; else delete c.drawImage; }
  if (c.fillRect === OCC.fr) { if (OCC.prevFR) c.fillRect = OCC.prevFR; else delete c.fillRect; }
  OCC.ctx = null; OCC.keys.length = 0;
}
function occRec(c, kind, a) {
  if (OCC.t !== ENV.t) { occStop(); return; }                          // bildrutan tog slut utan glow – släpp kroken
  if (c.globalCompositeOperation !== 'source-over') return;             // ljus ('lighter') och tonplattor skymmer inget
  let al = c.globalAlpha, x, y, w, h;
  if (kind === 0) {
    const n = a.length;
    if (n >= 9) { x = a[5]; y = a[6]; w = a[7]; h = a[8]; }
    else if (n >= 5) { x = a[1]; y = a[2]; w = a[3]; h = a[4]; }
    else { x = a[1]; y = a[2]; w = a[0]?.width || 0; h = a[0]?.height || 0; }
  } else {
    [x, y, w, h] = a;
    if (typeof c.fillStyle !== 'string') return;
    al *= cssAlpha(c.fillStyle);
  }
  if (!(al > 0.03) || !w || !h) return;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  const T = c.getTransform(), W = OCC.W;
  const R = T.a === W.a && T.b === W.b && T.c === W.c && T.d === W.d && T.e === W.e && T.f === W.f ? null : OCC.Wi.multiply(T); // användarrymd → världen
  let X0 = x, Y0 = y, X1 = x + w, Y1 = y + h;
  if (R) {
    const xs = [], ys = [];
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { xs.push(R.a * px + R.c * py + R.e); ys.push(R.b * px + R.d * py + R.f); }
    X0 = Math.min(...xs); X1 = Math.max(...xs); Y0 = Math.min(...ys); Y1 = Math.max(...ys);
  }
  for (const m of OCC.keys) {
    const B = m.box;
    if (X1 <= B[0] || X0 >= B[2] || Y1 <= B[1] || Y0 >= B[3]) continue;
    if (kind === 1 && X0 <= B[0] && Y0 <= B[1] && X1 >= B[2] && Y1 >= B[3]) continue; // heltäckande tonplatta över hela ljuset skymmer inget
    const g = m.g;
    if (R) g.setTransform(R.a, R.b, R.c, R.d, R.e - B[0], R.f - B[1]); else g.setTransform(1, 0, 0, 1, -B[0], -B[1]);
    g.globalAlpha = Math.min(1, al);
    if (kind === 0) { try { g.drawImage(...a); } catch { /* bilden gick inte att rita – skymmer inget */ } }
    else { g.fillStyle = '#000'; g.fillRect(x, y, w, h); }
  }
}
// källans föremål har just ritats: börja samla det som ritas framför ljuset med nyckeln key
// (box = världsrutan som ljusen med den nyckeln täcker). Bara när ljuset syns i bild.
function occMark(ctx, key, box) {
  if (!box || !(ENV.dark > 0.1) || typeof ctx.getTransform !== 'function') return;
  const v = ENV.view;
  if (v && (box[2] < v.x || box[0] > v.x + v.w || box[3] < v.y || box[1] > v.y + v.h)) return;
  if (OCC.ctx && (OCC.ctx !== ctx || OCC.t !== ENV.t)) occStop();
  let m = OCC_MASK.get(key);
  const w = box[2] - box[0], h = box[3] - box[1];
  if (!m) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    m = { box, cv, g: cv.getContext('2d'), t: -1 };
    OCC_MASK.set(key, m);
  }
  const g = m.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, w, h);
  m.t = ENV.t;
  if (!OCC.ctx) {
    OCC.ctx = ctx; OCC.t = ENV.t; OCC.keys.length = 0;
    OCC.W = ctx.getTransform(); OCC.Wi = OCC.W.inverse();
    const own = (k) => (Object.prototype.hasOwnProperty.call(ctx, k) ? ctx[k] : null);
    OCC.prevDI = own('drawImage'); OCC.prevFR = own('fillRect');
    const di = ctx.drawImage, fr = ctx.fillRect;
    OCC.di = function (...a) { if (OCC.ctx === this) occRec(this, 0, a); return di.apply(this, a); };
    OCC.fr = function (...a) { if (OCC.ctx === this) occRec(this, 1, a); return fr.apply(this, a); };
    ctx.drawImage = OCC.di; ctx.fillRect = OCC.fr;
  }
  if (!OCC.keys.includes(m)) OCC.keys.push(m);
}
// lägg på ett ljus (sprite s i x, y) – skymt av det som ritats framför källan, om masken är från denna bildruta
function putLight(ctx, s, x, y, key) {
  const m = key && OCC_MASK.get(key);
  if (!m || m.t !== ENV.t) { put(ctx, s, x, y); return; }
  const B = m.box, w = B[2] - B[0], h = B[3] - B[1];
  if (!occLightCv || occLightCv.width < w || occLightCv.height < h) {
    const c = document.createElement('canvas');
    c.width = Math.max(w, occLightCv?.width || 0); c.height = Math.max(h, occLightCv?.height || 0);
    occLightCv = c;
  }
  const g = occLightCv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, w, h);
  g.drawImage(s.img, Math.round(x) - s.ax - B[0], Math.round(y) - s.ay - B[1]);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(m.cv, 0, 0);
  ctx.drawImage(occLightCv, 0, 0, w, h, B[0], B[1], w, h);
}
// expediten bakom disken: rosa tröja, vitt förkläde, rosa keps (people.js – ritas bara om modulen laddats)
let drawPersonFn = null;
import('../core/people.js').then((m) => { if (typeof m.drawPerson === 'function') drawPersonFn = m.drawPerson; }).catch(() => {});
const EXPEDIT = {
  skin: '#eec3a0', hair: '#a5692f', style: 'ponytail', hat: 'cap', cap: '#f0629a', top: 'tee', shirt: '#f0629a', accent: '#f4f1ea',
  bottom: 'pants', pants: '#2d3a5c', shoes: '#f2f2f2', glasses: false, beard: false, phones: false, kid: false, apron: true, build: 5, bag: null, blush: true,
};
const EXP_C = 5, EXP_D = -9, EXP_P = 9;                               // vid luckan / vid glasdisken, cykelns längd (s)
// var expediten är just nu: står vid luckan → går till disken → skopar → bär struten → räcker fram den
function expeditAt(t) {
  const u = ((t % EXP_P) + EXP_P) % EXP_P, st = Math.floor(t * 9) % 4;
  if (u < 2.2) return { x: EXP_C, dir: 'down', frame: Math.sin(t * 1.3) > 0.93 ? 4 : 0 };
  if (u < 3.0) return { x: Math.round(EXP_C + (EXP_D - EXP_C) * (u - 2.2) / 0.8), dir: 'left', frame: [1, 3, 2, 3][st] };
  if (u < 5.6) { const up = Math.floor((u - 3) * 2.5) % 2 === 1; return { x: EXP_D, dir: 'down', frame: up ? 3 : 0, scoop: up ? 2 : 1 }; }
  if (u < 6.4) return { x: Math.round(EXP_D + (EXP_C - EXP_D) * (u - 5.6) / 0.8), dir: 'right', frame: [7, 9, 8, 9][st], cone: 'side' };
  return { x: EXP_C, dir: 'down', frame: 9, cone: 'front' };
}
// en strut med kula i expeditens händer: tip = strutspetsen (där händerna håller)
function drawHeldCone(ctx, x, tip, k) {
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = css(c); ctx.fillRect(xx, yy, w, h); };
  R(x, tip, 1, 1, VAF[1]);
  R(x - 1, tip - 1, 1, 1, VAF[2]); R(x, tip - 1, 1, 1, VAF[1]); R(x + 1, tip - 1, 1, 1, VAF[0]);
  R(x - 1, tip - 2, 1, 1, VAF[3]); R(x, tip - 2, 1, 1, VAF[2]); R(x + 1, tip - 2, 1, 1, VAF[1]);
  R(x - 1, tip - 5, 3, 3, k[1]); R(x - 1, tip - 5, 1, 1, k[3]); R(x, tip - 4, 1, 1, k[2]); R(x + 1, tip - 3, 1, 1, k[0]);
}
function drawExpedit(ctx, t) {
  const X = GS.x, Y = GS.y, e = expeditAt(t), k = KULOR[Math.floor(hash(Math.floor(t / EXP_P), 3, 74) * KULOR.length)].c;
  const fx = X + e.x, fy = Y - 6;                                      // fötterna står på en pall bakom disken
  if (drawPersonFn) {
    try { drawPersonFn(ctx, fx, fy, EXPEDIT, e.dir, e.frame); }
    catch { drawPersonFn = null; }
  }
  if (!drawPersonFn) {                                                 // reserv: liten figur med rektanglar
    const R = (x, y, w, h, c) => { ctx.fillStyle = css(c); ctx.fillRect(fx + x, y, w, h); };
    R(-3, fy - 35, 6, 2, 0xf0629a); R(-3, fy - 33, 6, 5, 0xeec3a0); R(-2, fy - 31, 1, 1, 0x3a2a1e); R(1, fy - 31, 1, 1, 0x3a2a1e);
    R(-4, fy - 28, 8, 9, 0xf0629a); R(-3, fy - 26, 6, 7, 0xf2eee4);
  }
  if (e.scoop === 2) {                                                 // skopan lyfts upp ur baljan med en kula
    ctx.fillStyle = css(0xc8d0d8); ctx.fillRect(fx + 3, fy - 19, 2, 1); ctx.fillRect(fx + 5, fy - 18, 1, 2);
    ctx.fillStyle = css(k[1]); ctx.fillRect(fx + 3, fy - 21, 3, 2);
    ctx.fillStyle = css(k[3]); ctx.fillRect(fx + 3, fy - 21, 1, 1);
  }
  if (e.cone === 'front') drawHeldCone(ctx, fx, fy - 18, k);          // händerna (frame 9) på fy − 17
  else if (e.cone === 'side') drawHeldCone(ctx, fx + (e.dir === 'left' ? -5 : 5), fy - 18, k);
}
// glass i handen på den som sitter på uteserveringen (framifrån, frame 5: högra handen i knät på y − 12).
// En strut per halvminut och plats: två kulor → en → uppbiten → bara struten → spetsen → uppäten, paus.
function drawSeatGlass(ctx, s, t, fx = s.x, fy = s.y) {                  // fx, fy = figurens (avrundade) fotpunkt
  const u = t / 30 + hash(s.x, s.y, 71), n = Math.floor(u), ph = u - n;
  if (ph > 0.86) return;                                              // uppäten – paus tills nästa
  const two = hash(n, s.x, 75) > 0.45;
  const k = KULOR[Math.floor(hash(n, s.x, 72) * KULOR.length)].c, k2 = KULOR[Math.floor(hash(n, s.y, 73) * KULOR.length)].c;
  const q = two ? ph : 0.18 + ph * 0.82;                              // en kula börjar direkt i steg 2
  const stage = q < 0.2 ? 5 : q < 0.42 ? 4 : q < 0.56 ? 3 : q < 0.68 ? 2 : q < 0.77 ? 1 : 0;
  const hx = fx + 3, hy = fy - 13;                                     // strutspetsen ovanför handen
  const R = (x, y, w, h, c) => { ctx.fillStyle = css(c); ctx.fillRect(x, y, w, h); };
  if (stage >= 1) R(hx, hy, 1, 1, VAF[1]);
  if (stage >= 2) { R(hx - 1, hy - 1, 1, 1, VAF[2]); R(hx, hy - 1, 1, 1, VAF[1]); R(hx + 1, hy - 1, 1, 1, VAF[0]); }
  if (stage >= 2) { R(hx - 1, hy - 2, 1, 1, VAF[3]); R(hx, hy - 2, 1, 1, VAF[2]); R(hx + 1, hy - 2, 1, 1, VAF[1]); }
  if (stage === 3) { R(hx - 1, hy - 3, 2, 1, k[1]); R(hx - 1, hy - 3, 1, 1, k[3]); R(hx + 1, hy - 3, 1, 1, k[0]); }   // uppbiten
  if (stage >= 4) { R(hx - 1, hy - 5, 3, 3, k[1]); R(hx - 1, hy - 5, 1, 1, k[3]); R(hx, hy - 4, 1, 1, k[2]); R(hx + 1, hy - 3, 1, 1, k[0]); R(hx + 1, hy - 2, 1, 1, k[1]); }
  if (stage >= 5) { R(hx - 1, hy - 7, 3, 2, k2[1]); R(hx - 1, hy - 7, 1, 1, k2[3]); R(hx + 1, hy - 6, 1, 1, k2[0]); }
}
// stora menyskylten: 6 glassar med pris och små glassbilder, rosa rubrikband med bågkant
function paintGlassMenu(P) {
  const X0 = -31, X1 = 30, TOP = -70;
  for (const x of [X0 + 3, X1 - 4]) { P.vl(x, -12, 13, TEAK[2]); P.vl(x + 1, -12, 13, TEAK[0]); P.px(x, 0, TEAK[1]); P.px(x + 1, 0, TEAK[0]); } // benen
  P.hl(X0 + 5, -6, X1 - X0 - 10, TEAK[1]); P.hl(X0 + 5, -5, X1 - X0 - 10, TEAK[0]);            // tvärslån mellan benen
  for (let y = TOP; y <= -10; y++) for (let x = X0; x <= X1; x++) {                             // tavlan
    let v = 0.84 - ((x - X0) / 62) * 0.22 + (hash(x >> 2, y >> 1, 73) - 0.5) * 0.06;
    if (y === TOP) v += 0.15; if (y === -10) v -= 0.3;
    P.px(x, y, tone(GS_CREME, v, x, y));
  }
  P.box(X0, TOP, 62, 61, TEAK[2]); P.vl(X0, TOP, 61, TEAK[3]); P.vl(X1, TOP + 1, 60, TEAK[0]); P.hl(X0 + 1, -10, 60, TEAK[0]);
  const scallop = [0, 1, 2, 2, 1, 0];
  for (let x = X0 + 1; x < X1; x++) {                                                           // rosa rubrikband med bågkant
    const yb = TOP + 9 + scallop[(x - X0 - 1) % 6];
    for (let y = TOP + 1; y <= yb; y++) {
      let c = mix(GS_ROSA[1], GS_ROSA[0], ((x - X0) / 62) * 0.5);
      if (y === TOP + 1) c = mix(c, 0xffffff, 0.25); if (y === yb) c = GS_ROSA[0];
      P.px(x, y, c);
    }
  }
  text(P, SMALL, 'GLASSMENY', -18, TOP + 3, 0x9a2050, 0.5); text(P, SMALL, 'GLASSMENY', -19, TOP + 2, 0xffffff);
  const rows = [
    ['JORDGUBB', '12', KULOR[0].c, 0],
    ['CHOKLAD', '12', KULOR[3].c, 0],
    ['PISTAGE', '14', KULOR[2].c, 0],
    ['MJUKGLASS', '10', null, 1],
    ['TVÅ KULOR', '20', KULOR[5].c, 2],
    ['STRÖSSEL', '+2', null, 3],
  ];
  rows.forEach(([name, price, col, kind], i) => {
    const y = TOP + 14 + i * 8;
    if (kind === 3) for (let j = 0; j < 6; j++) P.px(X0 + 3 + (j % 3) * 2, y + 1 + (j / 3 | 0) * 2 + (j & 1), STRO[j % 4]);
    else miniGlass(P, X0 + 5, y + (kind === 2 ? 6 : 5), col || KULOR[1].c, kind === 1, kind === 2);
    text(P, SMALL, name, X0 + 9, y, 0x54423a);
    const pw = textW(SMALL, price);
    for (let x = X0 + 10 + textW(SMALL, name); x < X1 - 3 - pw; x += 2) P.px(x, y + 4, 0xb8ac92);   // prickar fram till priset
    text(P, SMALL, price, X1 - 2 - pw, y, 0xb02850);
  });
  // skyltlampan ovanpå: mintgrön kupa på en kort arm, glödlampan syns under kanten
  P.vl(0, TOP - 3, 3, MINT[1]); P.px(1, TOP - 3, MINT[0]);
  P.hl(-2, TOP - 6, 5, MINT[3]); P.hl(-3, TOP - 5, 7, MINT[2]); P.px(-3, TOP - 5, MINT[4]); P.px(3, TOP - 5, MINT[1]);
  P.hl(-2, TOP - 4, 5, 0xf4e8c0); P.px(-2, TOP - 4, 0xd8c890); P.px(2, TOP - 4, 0xd8c890);
  outline(P, 0x2a1e18, 0x2a1e18, 0.3);
  groundShadow(P, 2, 1, 30, 2.6, 0.26);
}
function paintGlassMenuLit(P) {
  const X0 = -31, X1 = 30, TOP = -70;
  for (let y = TOP + 1; y <= -11; y++) for (let x = X0 + 1; x < X1; x++) P.px(x, y, 0xfff0c8, 0.16 + 0.1 * (1 - (y - TOP) / 60));
  P.px(-1, TOP - 3, 0xffffff); P.hl(-2, TOP - 2, 3, 0xffe8a0, 0.6);
}
// uteserveringens bistrobord: vit marmorskiva på gjutjärnsfot, glasskupa, sked och en liten lykta.
// canopy = [färg, rand] ger ett randigt parasoll högt över bordet (kanten ovanför den som sitter bakom).
function paintGlassTable(P, canopy) {
  if (canopy) {
    const R = 15, AY = -54, RY = -46, ERY = 3.5;
    const rimAt = (x) => RY + ERY * Math.sqrt(Math.max(0, 1 - (x / R) ** 2));
    const panelCol = (u) => ((Math.floor(Math.asin(clamp(u, -1, 1)) / (Math.PI / 4) + 0.5) & 1) ? canopy[1] : canopy[0]);
    for (let y = -41; y <= -15; y++) { P.px(0, y, 0xe8e0d0); P.px(1, y, 0xa8a090); }            // stången
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
      P.px(x, yb + 1, mul(c0, 0.8)); if ((x + R) % 4 < 3) P.px(x, yb + 2, mul(c0, 0.62));
    }
    P.px(0, AY - 1, 0xf0e8d8); P.px(0, AY - 2, 0xc8b890); P.px(1, AY - 1, 0xa89870);
  }
  // skivan (ellips snett ovanifrån) med ådring i marmorn och mörk kant
  for (let y = -16; y <= -12; y++) for (let x = -10; x <= 10; x++) {
    const dx = (x + 0.5 - 0.5) / 10.2, dy = (y + 13.8) / 2.6;
    if (dx * dx + dy * dy > 1) continue;
    let v = 0.94 - (x + 10) / 20 * 0.1 - (y + 16) * 0.02;
    if (hash(x + y * 3, y, 81) > 0.9 || (x - y * 2) % 13 === 0) v -= 0.08;                  // marmorådror
    P.px(x, y, mul(0xf6f3ec, v));
  }
  for (let x = -9; x <= 9; x++) { P.px(x, -11, x < -6 ? 0xa8a498 : 0x8a867a); P.px(x, -10, 0x4a4640, 0.6); }
  P.px(-10, -12, 0xc8c4b8); P.px(10, -12, 0x9a968a);
  // foten: pelare, krage och tre svängda ben
  P.vl(0, -9, 7, IRON[3]); P.vl(1, -9, 7, IRON[1]); P.hl(-1, -3, 4, IRON[2]);
  P.px(-2, -2, IRON[3]); P.px(-3, -1, IRON[2]); P.px(-4, 0, IRON[1]); P.px(-5, 0, IRON[2]);
  P.px(3, -2, IRON[2]); P.px(4, -1, IRON[1]); P.px(5, 0, IRON[0]); P.px(6, 0, IRON[1]);
  P.px(0, -2, IRON[2]); P.px(1, -1, IRON[1]); P.px(1, 0, IRON[0]);
  // på bordet: glasskupa med två kulor och sked, lykta med värmeljus, servett
  P.rect(-6, -16, 3, 1, 0xdce8ec); P.px(-5, -15, 0xc8d4d8); P.px(-5, -14, 0xb8c4c8); P.hl(-6, -13, 3, 0xc8d4d8);
  P.px(-6, -17, KULOR[0].c[2]); P.px(-5, -17, KULOR[0].c[1]); P.px(-4, -17, KULOR[3].c[2]); P.px(-5, -18, KULOR[0].c[3]); P.px(-4, -18, KULOR[3].c[1]);
  P.px(-3, -18, 0xd8dce0); P.px(-2, -19, 0xe8ecf0);                                            // skeden
  P.vl(4, -17, 3, 0x8a6a2a); P.vl(6, -17, 3, 0x6a4e1e); P.px(5, -17, 0xe8f0f0); P.px(5, -16, 0xf4d070); P.px(5, -15, 0xd8e4e4); // lyktan: mässing och glas
  P.hl(4, -18, 3, 0xc8a050); P.px(5, -19, 0xb08a3a); P.hl(4, -14, 3, 0x6a4e1e);
  P.px(1, -14, 0xffffff); P.px(2, -14, 0xf0ece4); P.px(1, -13, 0xe0dcd4);                      // servett
  outline(P, 0x1a1418, 0x1a1418, 0.3);
  groundShadow(P, 1, 0, canopy ? 13 : 10, 3.2, 0.26);
}
// uteserveringens stol: bistrostol i mint med rosa dyna.
// 'down' = står bakom bordet (man ser ryggstödet bakom den som sitter, ritas före figuren),
// 'up'   = står framför bordet (ryggstödets baksida mot oss, ritas efter figuren)
// Vitlackerad böjträstol (samma vita som bänken): tunn ram, öppet ryggstöd där gräset syns igenom.
const CHAIR_W = [0x8a8274, 0xb4ad9e, 0xd8d2c4, 0xf4f1ea, 0xffffff];
function paintGlassChair(P, facing) {
  const W = CHAIR_W, D = KULOR[0].c;
  // ryggstödets båge: en ögla 9 px bred, ljus till vänster (solen från sydväst), mörkare till höger
  const hoop = (y0, front) => {
    P.hl(-3, y0, 7, front ? W[4] : W[2]); P.px(-4, y0 + 1, front ? W[3] : W[2]); P.px(4, y0 + 1, front ? W[2] : W[1]);
    for (let y = y0 + 2; y <= y0 + 9; y++) { P.px(-4, y, front ? W[3] : W[2]); P.px(4, y, front ? W[1] : W[0]); }
    P.hl(-3, y0 + 5, 7, front ? W[2] : W[1]);                                                 // tvärslån mitt i öglan
    P.px(0, y0 + 1, W[2]); P.px(0, y0 + 2, W[2]); P.px(0, y0 + 3, W[1]); P.px(0, y0 + 4, W[1]); // mittspjälan
  };
  if (facing === 'down') {
    P.vl(-3, -6, 6, W[1]); P.vl(3, -6, 6, W[0]);                                               // bakre ben (längre bort)
    hoop(-19, true);
    P.hl(-4, -9, 9, D[2]); P.px(-4, -9, D[3]); P.hl(-4, -8, 9, D[1]); P.px(4, -8, D[0]);        // rosa dynan
    P.hl(-4, -7, 9, W[2]); P.px(-4, -7, W[3]); P.px(4, -7, W[1]);                              // sitsens kant
    P.vl(-4, -6, 7, W[3]); P.vl(4, -6, 7, W[1]); P.px(-4, 0, W[2]); P.px(4, 0, W[0]);           // främre ben
    P.hl(-3, -3, 7, W[1], 0.8);                                                                // benring
  } else {
    P.hl(-4, -10, 9, D[1]); P.px(-4, -10, D[2]); P.px(4, -10, D[0]);                           // dynan sticker ut på sidorna
    P.vl(-3, -7, 7, W[0]); P.vl(3, -7, 7, W[0]);                                               // främre ben (längre bort)
    hoop(-20, false);
    P.hl(-4, -9, 9, W[1]); P.px(-4, -9, W[2]);                                                 // sitsens bakkant
    P.vl(-4, -8, 9, W[2]); P.vl(4, -8, 9, W[0]); P.px(-4, 0, W[1]); P.px(4, 0, W[0]);           // bakre ben (närmast oss)
    P.hl(-3, -3, 7, W[0], 0.8);
  }
  outline(P, 0x3a342c, 0x3a342c, 0.4);
  groundShadow(P, 0, 1, 6, 1.8, 0.24);
}
// ståndets egen bänk: vitlackerade ribbor, mintgröna gavlar och två rosa dynor (plats för två)
function paintGlassBench(P) {
  for (const x of [-12, 11]) { P.vl(x, -20, 11, MINT[2]); P.px(x, -20, MINT[4]); }
  for (const y of [-19, -16, -13]) slat(P, -13, y, 26, 0.05, GS_CREME);
  slat(P, -14, -10, 28, 0.12, GS_CREME); slat(P, -14, -8, 28, 0.02, GS_CREME);
  for (const cx of [-7, 6]) {                                                                  // dynorna
    P.hl(cx - 5, -11, 10, KULOR[0].c[2]); P.hl(cx - 5, -10, 10, KULOR[0].c[1]); P.px(cx - 5, -11, KULOR[0].c[3]); P.px(cx + 4, -10, KULOR[0].c[0]);
    P.px(cx, -10, KULOR[0].c[0]);                                                               // knappen
  }
  P.hl(-14, -6, 28, GS_CREME[0]);
  for (const s of [0, 1]) {
    const x = s ? 12 : -13, o = s ? 1 : -1, i = s ? -1 : 1;
    P.hl(Math.min(x, x + o * 2), -12, 3, MINT[3]); P.px(x + o * 2, -11, MINT[2]); P.px(x + o, -12, MINT[4]);
    P.vl(x, -11, 5, MINT[1]);
    P.vl(x, -5, 5, MINT[2]); P.vl(x + i, -5, 5, MINT[1]); P.px(x, -5, MINT[4]);
    P.px(x + i * 2, -3, MINT[1]); P.px(x + i * 2, -2, MINT[2]);
    P.hl(Math.min(x, x + i) - 1, 0, 4, MINT[0]);
  }
  miniGlass(P, 0, -14, KULOR[2].c);                                                            // liten strut målad på ryggen
  groundShadow(P, 2, 0, 16, 3, 0.3);
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
function paintShelterBack(P, poster = paintPoster) {
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
  poster(P);
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

// =====================================================================
// v2: årstider, snö, slitage och rekvisita för Söder, parken, Infarten och förorten
// =====================================================================
let ENV = null;                                                   // env från createProps (väder, tid)
const seasonNow = () => ENV?.weather?.season || 'sommar';
const snowNow = () => (ENV?.weather?.snowCover || 0) > 0.5;
const RUST = [0x2e140a, 0x5a2810, 0x8a4418, 0xb86a2a, 0xd89050];
const CHAIN = [0x24282c, 0x3e444a, 0x5e666e, 0x848c94, 0xaab2ba];
const BAG = [0x0a0a0e, 0x16161c, 0x26262e, 0x3a3a44, 0x54545e];
const TAGS = [0xff2e6a, 0x36d6ff, 0xffe030, 0x7cff3a, 0xff7a1e, 0xc860ff, 0xffffff];
const GRASS = [0x2e5a22, 0x3e7a2c, 0x56983a, 0x78b44e, 0xa0cc6a];

// Snö på allt som har en ovansida: en kopia av spriten där varje pixel med
// tom pixel ovanför får 1–3 px vitt. Görs lat och cachas på spriten (s.snow).
function snowify(s) {
  const w = s.w, h = s.h + 3, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(s.img, 0, 3);
  const im = g.getImageData(0, 0, w, h), d = im.data;
  const A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const set = (x, y, col) => { const i = (y * w + x) * 4; d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255; d[i + 3] = 255; };
  const caps = [];
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y) && !A(x, y - 1)) caps.push(x, y);
  for (let i = 0; i < caps.length; i += 2) {
    const x = caps[i], y = caps[i + 1], hs = hash(x, y, 909);
    if (hs < 0.1) continue;
    set(x, y, hs > 0.72 ? 0xffffff : 0xe4ecf8);
    if (hs > 0.3 && !A(x, y - 1)) set(x, y - 1, hs > 0.82 ? 0xffffff : 0xd8e2f0);
    if (hs > 0.88 && y >= 2 && !A(x, y - 2)) set(x, y - 2, 0xf4f8ff);
  }
  g.putImageData(im, 0, 0);
  return { img: c, ax: s.ax, ay: s.ay + 3, w, h };
}
const snowOf = (s) => s.snow || (s.snow = snowify(s));
function putW(ctx, s, x, y) { put(ctx, snowNow() ? snowOf(s) : s, x, y); }
// fylld ellips (pixelrund)
function disc(P, cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1) P.px(x, y, c, a);
  }
}
// klotter: tag med kontur och rinningar, och "throw-up" (bubbliga klumpar)
function tag(P, x, y, s, col, out = 0x101014, drip = true) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) text(P, SMALL, s, x + dx, y + dy, out);
  text(P, SMALL, s, x, y, col);
  if (drip) for (let i = 0; i < textW(SMALL, s); i += 5) if (hash(i, x, y) > 0.5) P.vl(x + i + 1, y + 5, 1 + Math.floor(hash(i, y, x) * 3), col, 0.8);
}
function throwUp(P, x, y, w, col, seed) {
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < w; i += 5) {
    const r = 2 + hash(i, seed, 1) * 1.5, cy = y + (hash(i, seed, 2) - 0.5) * 2;
    if (pass === 0) disc(P, x + i, cy, r + 1.2, r * 0.9 + 1.1, 0x101014);
    else { disc(P, x + i, cy, r, r * 0.9, col); P.px(x + i - 1, Math.round(cy) - 1, mix(col, 0xffffff, 0.5)); }
  }
}

// ---------- årstidens träd ----------
const AUTUMN = {
  lind: [0x4a3a08, 0x7a5c10, 0xa88418, 0xd0a828, 0xe8c840, 0xf8e070],
  bjork: [0x4e3c0a, 0x806410, 0xb08c18, 0xd8b028, 0xf0cc48, 0xfce890],
  ek: [0x3a1e0a, 0x60300e, 0x8a4a18, 0xb06a24, 0xcc8c36, 0xe0ac58],
  lonn: [0x4a1008, 0x7c1c0c, 0xb03a14, 0xd8601c, 0xf08c2c, 0xf8b850],
  korsbar: [0x4a1a08, 0x7c2e0c, 0xb0501a, 0xd87828, 0xf0a040, 0xf8c870],
};
const SPRING = {
  lind: [0x1c3a1a, 0x2e5c22, 0x48802e, 0x68a43c, 0x90c454, 0xbce07c],
  bjork: [0x2a4a1a, 0x447024, 0x649830, 0x8cbc44, 0xb4d860, 0xdcf090],
  ek: [0x1a3216, 0x2c5020, 0x44702c, 0x62923a, 0x86b052, 0xb0cc74],
  lonn: [0x22401a, 0x386022, 0x54842e, 0x76a63e, 0x9cc456, 0xc4dc7c],
};
const SUMMER_CHERRY = [0x14301a, 0x22481e, 0x346a28, 0x4a8a34, 0x6aa848, 0x94c866];
function seasonTree(kind, season) {
  const T = { ...TREE[kind] };
  if (T.spruce) return T;
  if (season === 'höst') { T.pal = AUTUMN[kind]; T.bloom = 0; }
  else if (season === 'vår') { if (kind !== 'korsbar') T.pal = SPRING[kind]; }
  else if (season === 'sommar' && kind === 'korsbar') { T.pal = SUMMER_CHERRY; T.bloom = 0.035; T.bloomCol = [0xc01828, 0xe83040, 0x8a0c1a]; }
  else if (season === 'vinter') T.bare = true;
  return T;
}
// kal krona: grenverk som förgrenar sig uppåt ur stammen
function paintBare(P, T, seed, bark = T.bark) {
  const branch = (x, y, ang, len, d, s) => {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
    P.line(x, y, x1, y1, d >= 3 ? bark[1] : bark[0]);
    if (d >= 3) P.line(x - 1, y, x1 - 1, y1, bark[2]);
    if (d >= 4) P.line(x + 1, y, x1 + 1, y1, bark[0]);
    if (d <= 0 || len < 2.5) { if (hash(s, 1, seed) > 0.4) P.px(Math.round(x1), Math.round(y1) - 1, bark[1]); return; }
    const n = 2 + (hash(s, d, seed) > 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = ang + (hash(s, i, seed + d) - 0.5) * 1.6 + (i - (n - 1) / 2) * 0.35;
      branch(x1, y1, Math.max(-Math.PI + 0.3, Math.min(-0.3, a)), len * (0.58 + hash(s, i, seed + 9) * 0.22), d - 1, s * 3 + i + 1);
    }
  };
  branch(0, T.top + 5, -Math.PI / 2 + (hash(seed, 2, 3) - 0.5) * 0.3, T.ry * 0.62, 4, 1);
  branch(0, T.top + 9, -Math.PI / 2 - 0.9, T.ry * 0.4, 2, 7);
  branch(1, T.top + 8, -Math.PI / 2 + 0.85, T.ry * 0.42, 2, 11);
}
function makeSeasonTree(kind, seed, grate, season) {
  const T = seasonTree(kind, season);
  const bw = 2 * (T.rx + 10), bah = -T.top + 12;
  const base = spr(bw, bah + 8, T.rx + 10, bah, (P) => {
    if (grate) paintGrate(P);
    paintTrunk(P, T.top, T.w, T.bark, T.birch, seed);
    if (!T.spruce && !T.bare) {
      const b = T.bark;
      P.line(0, T.top + 8, -Math.round(T.rx * 0.45), T.top - 3, b[1]);
      P.line(1, T.top + 6, Math.round(T.rx * 0.5), T.top - 5, b[1]);
      P.line(0, T.top + 3, -2, T.top - 9, b[2]);
    }
    if (!grate) {
      P.px(-3, 0, T.bark[1]); P.px(3, 0, T.bark[0]);
      if (season !== 'vinter') for (let x = -6; x <= 6; x++) if (hash(x, 0, seed) > 0.55) P.px(x, 1, hash(x, 1, seed) > 0.5 ? 0x4a8a34 : 0x2e6a26);
    }
    if (T.petals && season === 'vår') for (let i = 0; i < 22; i++) {
      const a = hash(i, seed, 41) * Math.PI * 2, r = 0.35 + hash(i, seed, 42) * 0.65;
      P.px(Math.round(Math.cos(a) * T.rx * 0.9 * r) + 3, Math.round(Math.sin(a) * 5 * r) + 1, hash(i, seed, 43) > 0.5 ? 0xffd4e2 : 0xf09ab8);
    }
    if (season === 'höst' && !T.spruce) for (let i = 0; i < 30; i++) { // nedfallna löv
      const a = hash(i, seed, 51) * Math.PI * 2, r = 0.3 + hash(i, seed, 52) * 0.7;
      P.px(Math.round(Math.cos(a) * T.rx * 1.1 * r) + 2, Math.round(Math.sin(a) * 6 * r) + 1, T.pal[2 + Math.floor(hash(i, seed, 53) * 3)]);
    }
    groundShadow(P, 5, 1, T.rx * 0.9, 3.8, season === 'vinter' ? 0.16 : 0.32);
  });
  const cw = 2 * T.rx + 9, ch = 2 * T.ry + 9;
  const crown = spr(cw, ch, T.rx + 4, T.ry + 4 - T.cy, (P) => {
    if (T.bare) { paintBare(P, T, seed); return; }
    if (T.spruce) paintSpruce(P, T, seed);
    else paintCrown(P, 0, T.cy, T.rx, T.ry, T.pal, seed, T);
    if (T.birch) {
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
// dött träd (förorten): kalt året runt, grå bark, en plastpåse fast i en gren
function paintDeadTree(P, seed) {
  const T = { top: -30, ry: 18, rx: 16, bark: [0x2a2622, 0x4a443c, 0x6a625a, 0x8a827a] };
  paintTrunk(P, T.top, 3, T.bark, false, seed);
  paintBare(P, T, seed, T.bark);
  P.rect(-9, -44, 4, 3, 0xe8e8f0, 0.9); P.px(-8, -41, 0xc8c8d0); P.px(-6, -45, 0xffffff);
  groundShadow(P, 3, 1, 8, 2.6, 0.2);
}

// ---------- staket, murar och plank ----------
const FENCE_H = { mur: 10, tra: 12, chain: 18 };
// vågrät sträcka: x 0..w, fotlinje y = 0. isOpen(x) = grindöppning
function paintFenceRun(P, w, style, seed, isOpen, worn = 0) {
  const H = FENCE_H[style];
  for (let x = 0; x < w; x++) {
    if (isOpen(x)) continue;
    const opened = (x > 0 && isOpen(x - 1)) || (x < w - 1 && isOpen(x + 1));
    if (style === 'mur') {
      for (let y = -H; y <= 0; y++) {
        let v = y === -H ? 0.95 : y === -H + 1 ? 0.78 : y === 0 ? 0.28 : 0.62 - ((y + H) / H) * 0.15;
        const row = Math.floor((y + H) / 3), joint = ((x + row * 4) % 8) === 0 || (y + H) % 3 === 2;
        if (joint && y > -H + 1 && y < 0) v -= 0.3;
        v += (hash(x, y, seed) - 0.5) * 0.12; if (hash(x, y, seed + 1) > 0.94) v -= 0.2;
        P.px(x, y, tone(STONE, v, x, y));
      }
      if (hash(x, 0, seed + 2) > 0.85) P.px(x, -H + 2 + Math.floor(hash(x, 1, seed) * 6), 0x5a7a34);
      if (opened) { for (let y = -H - 4; y <= 0; y++) for (let i = 0; i < 3; i++) P.px(x + (isOpen(x + 1) ? -i : i), y, tone(GRANITE, 0.85 - i * 0.28, x + i, y)); }
    } else if (style === 'tra') {
      if (x % 3 === 0) { for (let y = -H; y <= 0; y++) P.px(x, y, tone(WOOD, 0.72 - ((y + H) / H) * 0.2 + (hash(x, y >> 1, seed) - 0.5) * 0.2, x, y)); P.px(x, -H, WOOD[4]); }
      else { P.px(x, -H + 3, WOOD[x % 3 === 1 ? 1 : 2]); P.px(x, -4, WOOD[x % 3 === 1 ? 1 : 2]); }
      if (x % 24 === 0 || opened) for (let y = -H - 2; y <= 0; y++) { P.px(x, y, WOOD[3]); P.px(x + 1, y, WOOD[1]); }
    } else {
      const sag = worn ? Math.round(Math.sin(((x % 48) / 48) * Math.PI) * 2 * (hash(x >> 5, 0, seed) > 0.5 ? 1 : 0)) : 0;
      const top = -H + sag, hole = worn && hash(x >> 3, 0, seed + 3) > 0.9;
      P.px(x, top, CHAIN[4]); P.px(x, top + 1, CHAIN[2]);
      for (let y = top + 2; y <= 0; y++) {
        if (hole && y < -4 && y > top + 4) continue;
        const d1 = ((x + y) % 4 + 4) % 4 === 0, d2 = ((x - y) % 4 + 4) % 4 === 0;
        if (d1 || d2) P.px(x, y, d1 ? CHAIN[3] : CHAIN[2], 0.72);
      }
      P.px(x, 0, CHAIN[1], 0.8);
      if (x % 24 === 0 || opened) {
        for (let y = -H - 2; y <= 0; y++) { P.px(x, y, worn && hash(x, y, seed + 4) > 0.75 ? RUST[2] : CHAIN[3]); P.px(x + 1, y, worn && hash(x, y, seed + 5) > 0.8 ? RUST[1] : CHAIN[1]); }
        P.hl(x - 1, -H - 3, 4, CHAIN[4]);
      }
    }
  }
}
// lodrät sträcka sedd på kant: x = 0, y 0..h
function paintFenceSide(P, h, style, seed, isOpen, worn = 0) {
  const H = FENCE_H[style];
  const post = (y, a, b) => { for (let k = 0; k <= H + 2; k++) { P.px(0, y - k, a); P.px(1, y - k, b); } P.hl(-1, y - H - 3, 4, a); };
  for (let y = 0; y < h; y++) {
    if (isOpen(y)) continue;
    if (style === 'mur') { for (let i = 0; i < 4; i++) P.px(i, y, tone(STONE, 0.88 - i * 0.22 + (hash(i, y, seed) - 0.5) * 0.15, i, y)); if (y === 0) for (let k = 1; k <= H; k++) for (let i = 0; i < 4; i++) P.px(i, -k, tone(STONE, 0.8 - i * 0.2, i, -k)); }
    else if (style === 'tra') { P.px(0, y, WOOD[3]); P.px(1, y, WOOD[1]); if (y % 24 === 0) post(y, WOOD[3], WOOD[1]); }
    else { P.px(0, y, CHAIN[3], (y % 2) ? 0.55 : 0.9); P.px(1, y, CHAIN[1], 0.5); if (y % 24 === 0) post(y, worn && hash(0, y, seed) > 0.6 ? RUST[2] : CHAIN[3], CHAIN[1]); }
  }
}
// klotterplank: plank med stolpar, fullt med tags
function paintGraffitiWall(P, w, seed) {
  const H = 22, x0 = -(w >> 1);
  for (let x = x0; x < x0 + w; x++) for (let y = -H; y <= 0; y++) {
    let v = 0.62 - ((y + H) / H) * 0.12 + (hash(x >> 2, y, seed) - 0.5) * 0.16;
    if ((x - x0) % 6 === 5) v -= 0.3; if (y === -H) v += 0.25; if (y === 0) v -= 0.3;
    if (hash(x, y, seed + 1) > 0.96) v -= 0.25;
    P.px(x, y, tone([0x2a2420, 0x4a3e34, 0x6a5a4a, 0x8a7a66, 0xa89a84], v, x, y));
  }
  for (let x = x0; x < x0 + w; x += 36) { for (let y = -H - 3; y <= 0; y++) { P.px(x, y, 0x5a5048); P.px(x + 1, y, 0x2e2822); } }
  const words = ['ZOK', 'BTG', 'PIX', 'KRAM', '4EVER', 'VILD', 'OJ', 'BLING', 'SNABB', 'NEJ'];
  let x = x0 + 4, k = 0;
  while (x < x0 + w - 16) {
    const wd = words[Math.floor(hash(k, seed, 7) * words.length)], col = TAGS[Math.floor(hash(k, seed, 8) * TAGS.length)];
    if (hash(k, seed, 9) > 0.4) tag(P, x, -H + 5 + Math.floor(hash(k, seed, 10) * 8), wd, col);
    else throwUp(P, x + 3, -H + 8 + Math.floor(hash(k, seed, 10) * 6), 12 + Math.floor(hash(k, seed, 11) * 12), col, seed + k);
    x += textW(SMALL, wd) + 8 + Math.floor(hash(k, seed, 12) * 10); k++;
  }
  // krona, hjärta, pil
  const hx = x0 + w - 14; P.px(hx, -8, 0xff2e6a); P.px(hx + 2, -8, 0xff2e6a); P.hl(hx - 1, -7, 5, 0xff2e6a); P.hl(hx, -6, 3, 0xff2e6a); P.px(hx + 1, -5, 0xff2e6a);
  P.hl(x0 + 6, -4, 10, 0xffe030); P.px(x0 + 16, -5, 0xffe030); P.px(x0 + 16, -3, 0xffe030);
  groundShadow(P, 2, 0, w / 2, 2.4, 0.22);
}

// ---------- busskurer (Flygplatsen, Söderkyrkan) och den trasiga (Betongtorget) ----------
function paintPosterBio(P) {
  const x0 = 10, x1 = 28, y0 = -33, y1 = -3;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.px(x, y, mix(0x1a0a2e, 0x4a1a6e, (y - y0) / 30 + (bayer(x, y) - 0.5) * 0.15));
  for (let i = 0; i < 14; i++) P.px(x0 + Math.floor(hash(i, 1, 61) * 19), y0 + Math.floor(hash(i, 2, 61) * 12), 0xfff0a0);
  disc(P, 19, -21, 5, 5, 0xf8e070); disc(P, 19, -21, 3, 3, 0x1a0a2e); P.px(17, -23, 0xffffff);
  text(P, SMALL, 'BIO', 14, -16, 0xff5ab0); text(P, SMALL, 'PIXEL', 10, -10, 0xffffff);
  P.rect(x0, -7, 19, 5, 0xd02030); P.hl(x0, -7, 19, 0xe84a50); text(P, SMALL, 'NU!', 15, -7, 0xfff080);
  P.box(x0 - 1, y0 - 1, 21, y1 - y0 + 3, 0x9aa2aa);
}
function paintPosterGlass(P) {
  const x0 = 10, x1 = 28, y0 = -33, y1 = -3;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.px(x, y, mix(0xffd6e8, 0xffa0c8, (y - y0) / 30 + (bayer(x, y) - 0.5) * 0.15));
  // strut med tre kulor
  P.line(15, -8, 19, -19, 0xc88a3a); P.line(23, -8, 19, -19, 0xa86a2a); for (let y = -18; y <= -9; y++) P.hl(19 - Math.round((y + 8) * 0.36), y, 1 + Math.round((y + 8) * 0.72), 0xe8b060);
  disc(P, 19, -22, 4, 3.5, 0xf6f0d8); disc(P, 16, -26, 3.5, 3.2, 0xf4b0c0); disc(P, 22, -27, 3.5, 3.2, 0x7a4a2a); P.px(21, -29, 0xa87a5a); P.px(15, -28, 0xffffff);
  text(P, SMALL, 'GLASS', 10, -14 + 8, 0x8a2050);
  P.rect(x0, -7, 19, 5, 0x1e7a3a); text(P, SMALL, '25:-', 13, -7, 0xffffff);
  P.box(x0 - 1, y0 - 1, 21, y1 - y0 + 3, 0x9aa2aa);
}
function paintBrokenShelterBack(P) {
  const post = (x, bend) => { for (let y = -36; y <= 0; y++) { const dx = bend ? Math.round(((-y) / 36) * bend) : 0; P.px(x + dx, y, hash(x, y, 501) > 0.8 ? RUST[2] : STEEL[2]); P.px(x + dx + 1, y, hash(x, y, 502) > 0.85 ? RUST[1] : STEEL[0]); } };
  // vänster ruta: bara delar kvar, resten krossat
  for (let y = -35; y <= 0; y++) for (let x = -29; x <= 6; x++) {
    const gone = (y > -18 && hash(x >> 1, y >> 1, 503) < 0.55) || (x > -8 && y > -30 && hash(x >> 2, y >> 2, 504) < 0.35);
    if (gone) continue;
    const s = x + Math.round(y * 0.7) + 60, hi = s === 44 || s === 45;
    P.px(x, y, hi ? 0xf0faff : 0xbfe2f2, hi ? 0.4 : 0.22);
  }
  for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3; P.line(-12, -14, -12 + Math.cos(a) * 16, -14 + Math.sin(a) * 14, 0xe8f4ff, 0.75); }
  for (let r = 4; r <= 12; r += 4) for (let a = 0; a < 6.28; a += 0.45) P.px(-12 + Math.cos(a) * r, -14 + Math.sin(a) * r * 0.9, 0xe8f4ff, 0.5);
  post(-31, 0); post(7, 2); post(30, 0);
  P.hl(-31, -36, 63, STEEL[4]); P.hl(-31, -35, 63, STEEL[2]);
  for (let x = -31; x < 32; x += 2) if (hash(x, 1, 505) > 0.6) P.px(x, -36, RUST[2]);
  P.hl(-31, 0, 63, STEEL[1]);
  // reklamlådan: sönderslagen lucka, halva affischen borta, papp bakom
  P.rect(9, -35, 21, 35, 0x1e2228); P.hl(9, -35, 21, 0x4a525c); P.rect(10, -33, 19, 31, 0x8a8478);
  for (let y = -33; y <= -3; y++) for (let x = 10; x <= 28; x++) if (y < -18 + Math.round(Math.sin(x * 0.8) * 3) && hash(x, y, 506) > 0.05) P.px(x, y, mix(0x2a70d8, 0x9ad8fa, (y + 33) / 15));
  text(P, SMALL, 'FLY', 12, -30, 0xffffff);
  P.line(11, -12, 27, -5, 0x2a2a30); P.line(12, -5, 26, -13, 0x2a2a30);
  // klotter borttaget (Carl: bara på byggnader, muren och planket)
  // "UR FUNKTION"-lapp tejpad på mittstolpen, hänger snett
  for (let y = -32; y <= -18; y++) for (let x = -10; x <= 28; x++) { const dy = x > 8 ? 1 : 0; P.px(x, y + dy, (y === -32 || y === -18 || x === -10 || x === 28) ? 0x8a8060 : 0xf6f0d8); }
  text(P, SMALL, 'UR', -7, -30, 0x1a1a1e); text(P, SMALL, 'FUNKTION', -7, -23, 0xd02020);
  P.rect(-11, -33, 5, 3, 0xd8d8c0, 0.85); P.rect(24, -32, 5, 3, 0xd8d8c0, 0.85);
  // bänken: en planka kvar, en hänger ned
  slat(P, -27, -3, 14, 0.1); P.hl(-27, 1, 14, WOOD[0]);
  P.line(-12, -3, -2, 2, WOOD[1]); P.line(-12, -2, -2, 3, WOOD[0]);
  for (const x of [-25, -14]) { P.vl(x, 2, 4, IRON[2]); P.vl(x + 1, 2, 4, IRON[1]); }
  P.vl(0, 2, 4, IRON[1]);
  // krossat glas och skräp på marken, vält papperskorg
  for (let i = 0; i < 44; i++) { const x = -30 + Math.round(hash(i, 1, 507) * 40), y = 1 + Math.round(hash(i, 2, 507) * 5); P.px(x, y, hash(i, 3, 507) > 0.5 ? 0xe8f4ff : 0x9ac8e0, 0.9); }
  P.rect(16, 2, 5, 3, 0xd8c8a0); P.px(17, 1, 0xa89870); P.px(23, 3, 0x3a8a3a); P.px(24, 4, 0x3a8a3a); P.px(25, 5, 0x2a6a2a);
  P.rect(20, -2, 8, 5, 0x3a4048); P.hl(20, -2, 8, 0x6a727c); P.rect(28, -1, 2, 3, 0x0a0a0c); P.px(30, 2, 0xe8e0c0); P.px(31, 3, 0xc8c0a0); P.px(29, 4, 0xd02020);
  groundShadow(P, 2, 3, 34, 4, 0.22);
}
function paintBrokenShelterFront(P) {
  const d = 13;
  for (let y = -35; y <= -23; y++) for (let x = -33; x <= 33; x++) {
    const sag = x > 0 ? Math.round((x / 33) * 2) : 0, yy = y + sag, rib = x === -33 || x === 33 || x === -11 || x === 11;
    if (rib) { P.px(x, yy, hash(x, y, 511) > 0.7 ? RUST[2] : x > 0 ? STEEL[1] : STEEL[3]); continue; }
    if (x > 11 && hash(x >> 2, y >> 2, 512) < 0.7) continue;
    if (x > -11 && x < 11 && hash(x, y, 513) < 0.08) continue;
    P.px(x, yy, y === -24 ? 0xe0f4ff : 0x9acce0, y === -24 ? 0.45 : 0.26);
  }
  P.hl(-33, -36, 34, STEEL[4]); P.line(0, -36, 33, -34, STEEL[3]);
  for (let x = -34; x <= 34; x++) { const sag = x > 0 ? Math.round((x / 34) * 2) : 0; for (let y = -22; y <= -20; y++) P.px(x, y + sag, y === -22 ? (hash(x, 1, 514) > 0.75 ? RUST[3] : STEEL[4]) : y === -21 ? 0x2a3038 : 0x1a1e24); }
  P.rect(-9, -23, 19, 7, 0x2a5a30); P.box(-9, -23, 19, 7, 0x9aa89a); text(P, SMALL, 'BUSS', -7, -22, 0xb8c8b8);
  P.line(-8, -22, 8, -18, 0xff2e6a); P.line(-8, -21, 8, -17, 0xff2e6a, 0.6);
  P.line(14, -19, 16, -8, 0x1a1a1e); P.px(16, -7, 0x1a1a1e); P.px(16, -6, 0xd02020);
  for (let y = -19; y <= d; y++) { P.px(-32, y, hash(0, y, 515) > 0.8 ? RUST[2] : STEEL[3]); P.px(-31, y, STEEL[1]); }
  P.hl(-33, d, 4, STEEL[0]);
  for (let y = -17; y <= d; y++) { const dx = y < -8 ? 3 : 0; P.px(31 + dx, y, hash(1, y, 516) > 0.7 ? RUST[3] : STEEL[3]); P.px(32 + dx, y, STEEL[1]); }
  P.px(32, -8, STEEL[2]); P.px(33, -9, STEEL[2]); P.hl(30, d, 4, STEEL[0]);
  for (let y = -19; y <= d - 1; y++) if (hash(2, y, 517) > 0.4) P.px(-30, y, 0xbfe2f2, 0.18);
}
function paintBusSignBroken(P) {
  for (let y = -30; y <= 0; y++) { P.px(0, y, hash(0, y, 521) > 0.8 ? RUST[2] : STEEL[3]); P.px(1, y, STEEL[1]); }
  P.line(0, -30, 6, -44, STEEL[3]); P.line(1, -30, 7, -44, STEEL[1]); P.hl(-1, 0, 4, STEEL[0]);
  const dy = (x) => Math.round((x + 6) / 9);
  for (let y = -58; y <= -46; y++) for (let x = -6; x <= 20; x++) { const c = (y === -58 || y === -46 || x === -6 || x === 20) ? 0x1a1a1e : hash(x, y, 522) > 0.9 ? 0xc0a020 : 0xe0c020; P.px(x, y + dy(x), mul(c, 0.92)); }
  eachTextPixel(BIG, 'BUSS', -4, -55, 1, (px, py) => P.px(px, py + dy(px), 0x1a1a1e));
  P.line(-4, -53, 19, -47, 0xff2e6a); P.line(-3, -53, 20, -47, 0xff2e6a, 0.6);
  P.rect(-4, -40, 9, 11, 0xd8d8d0); P.box(-4, -40, 9, 11, 0x5a626c); for (let y = -38; y <= -32; y += 2) P.hl(-2, y, 5, 0x8a929a);
  P.line(-3, -39, 4, -31, 0x2a2a30); P.line(-3, -33, 3, -39, 0x2a2a30); P.rect(-2, -35, 4, 3, 0x36d6ff, 0.9);
  P.px(-6, -20, 0xffe030); P.px(-5, -21, 0xffe030); P.hl(-6, -19, 3, 0xffe030);
  groundShadow(P, 2, 1, 5, 1.8);
}

// ---------- kyrkogården ----------
function paintGravestone(P, kind, seed) {
  const G = [0x4a4a46, 0x6c6c66, 0x8e8e86, 0xb0b0a6, 0xcccdc4];
  const stone = (x, y, v) => P.px(x, y, tone(G, v + (hash(x, y, seed) - 0.5) * 0.12 - (hash(x >> 1, y >> 1, seed + 1) > 0.9 ? 0.25 : 0), x, y));
  if (kind === 0) { // rundad sten
    for (let y = -12; y <= 0; y++) { const hw = y < -9 ? 3 - (-9 - y) : 4; for (let x = -hw; x <= hw; x++) stone(x, y, 0.75 - ((x + hw) / (2 * hw)) * 0.4 + (y === -12 ? 0.15 : 0)); }
    P.hl(-3, -7, 3, G[0], 0.6); P.hl(-2, -5, 5, G[0], 0.6); P.hl(-3, -3, 4, G[0], 0.5);
  } else if (kind === 1) { // kors
    for (let y = -16; y <= -1; y++) for (let x = -1; x <= 1; x++) stone(x, y, 0.85 - (x + 1) * 0.28);
    for (let y = -13; y <= -11; y++) for (let x = -5; x <= 5; x++) stone(x, y, 0.85 - (y + 13) * 0.2);
    for (let y = -2; y <= 0; y++) for (let x = -4; x <= 4; x++) stone(x, y, 0.6 - ((x + 4) / 8) * 0.35);
  } else if (kind === 2) { // obelisk
    for (let y = -20; y <= -4; y++) { const hw = 1 + Math.round((y + 20) / 8); for (let x = -hw; x <= hw; x++) stone(x, y, 0.88 - ((x + hw) / (2 * hw + 1)) * 0.5); }
    for (let y = -3; y <= 0; y++) for (let x = -4; x <= 4; x++) stone(x, y, 0.62 - ((x + 4) / 8) * 0.4 + (y === -3 ? 0.2 : 0));
    P.px(0, -21, G[4]);
  } else { // bred sten med två namn
    for (let y = -9; y <= 0; y++) for (let x = -7; x <= 7; x++) stone(x, y, 0.78 - ((x + 7) / 14) * 0.4 + (y === -9 ? 0.15 : 0) - (y === 0 ? 0.25 : 0));
    P.hl(-5, -6, 4, G[0], 0.6); P.hl(1, -6, 5, G[0], 0.6); P.hl(-5, -4, 5, G[0], 0.5); P.hl(1, -4, 4, G[0], 0.5);
  }
  outline(P, 0x2a2a28, 0x3a3a38, 0.6);
  if (hash(3, seed, 5) > 0.45) { for (let i = 0; i < 3; i++) P.px(-3 + i * 2 + (kind === 2 ? 5 : 0), 1, i === 1 ? 0xf0c020 : 0xe04060); P.px(-2 + (kind === 2 ? 5 : 0), 2, 0x4a8a34); }
  if (hash(4, seed, 5) > 0.7) { P.rect(4, -3, 2, 3, 0xd02020); P.px(4, -4, 0xffe080); }
  for (let i = 0; i < 4; i++) P.px(-5 + Math.round(hash(i, seed, 9) * 10), 1, GRASS[2 + (i & 1)]);
  groundShadow(P, 2, 1, 6, 1.8, 0.28);
}

// ---------- lekplatser ----------
function paintSwing(P, worn) {
  const M = worn ? [0x3a2e22, 0x5a4a34, 0x7a6848, 0x9a8a62] : [0x6a1a10, 0xb03020, 0xe05030, 0xf88060];
  const leg = (x0, x1) => { P.line(x0, 0, x1, -28, M[1]); P.line(x0 + 1, 0, x1 + 1, -28, M[2]); P.line(x0 - 1, 0, x1 - 1, -28, M[0]); };
  leg(-18, -12); leg(-6, -12); leg(18, 12); leg(6, 12);
  for (let x = -16; x <= 16; x++) { P.px(x, -30, M[3]); P.px(x, -29, M[2]); P.px(x, -28, M[1]); if (worn && hash(x, 1, 531) > 0.75) P.px(x, -29, RUST[2]); }
  const chain = (x, len) => { for (let y = -27; y < -27 + len; y++) P.px(x, y, (y & 1) ? CHAIN[3] : CHAIN[1]); };
  chain(-8, 20); chain(-3, 20); P.rect(-9, -8, 7, 2, 0x1a1a1e); P.hl(-9, -8, 7, 0x3a3a44);
  if (worn) { chain(4, 9); P.px(4, -18, CHAIN[2]); chain(9, 22); P.px(9, -5, 0x1a1a1e); }
  else { chain(4, 20); chain(9, 20); P.rect(3, -8, 7, 2, 0x1a1a1e); P.hl(3, -8, 7, 0x3a3a44); }
  for (const x of [-18, -6, 6, 18]) P.hl(x - 1, 0, 3, M[0]);
  groundShadow(P, 3, 0, 20, 2.6, 0.26);
}
function paintSlide(P, worn) {
  const R = worn ? [0x5a2a1a, 0x8a4028, 0xb05a34, 0xc87a50] : [0x8a2010, 0xc83a20, 0xf05a30, 0xff8a60];
  // stege till vänster, plattform, rutschbana ner åt höger
  for (let y = -26; y <= 0; y++) { P.px(-12, y, STEEL[3]); P.px(-11, y, STEEL[1]); P.px(-6, y, STEEL[3]); P.px(-5, y, STEEL[1]); }
  for (let y = -24; y <= -2; y += 4) P.hl(-11, y, 6, STEEL[2]);
  P.rect(-13, -30, 12, 4, R[2]); P.hl(-13, -30, 12, R[3]); P.hl(-13, -27, 12, R[0]);
  for (let y = -34; y <= -30; y++) { P.px(-13, y, R[1]); P.px(-2, y, R[1]); } P.hl(-13, -34, 12, R[3]);
  for (let x = -1; x <= 16; x++) {
    const yt = Math.round(-30 + ((x + 1) / 17) * 30 - Math.sin(((x + 1) / 17) * Math.PI) * 4);
    for (let y = yt; y <= yt + 5; y++) {
      const c = y === yt ? STEEL[4] : y === yt + 1 ? STEEL[3] : y > yt + 3 ? R[1] : R[2];
      P.px(x, y, worn && hash(x, y, 532) > 0.82 ? RUST[2] : c);
    }
    P.px(x, yt - 1, R[0]); P.px(x, yt + 6, R[0]);
  }
  P.vl(16, -6, 6, STEEL[2]); P.vl(9, -14, 14, STEEL[1]);
  if (worn) { P.px(3, -22, RUST[3]); P.px(4, -22, RUST[3]); }
  groundShadow(P, 3, 0, 18, 2.6, 0.26);
}
function paintSandbox(P, w, worn, seed) {
  const x0 = -(w >> 1), x1 = x0 + w - 1, D = 12;
  for (let y = -D; y <= -1; y++) for (let x = x0 + 1; x < x1; x++) {
    let c = mix(0xd8c898, 0xecdcae, hash(x, y, seed)); if (worn && hash(x >> 1, y >> 1, seed + 1) > 0.8) c = mix(c, 0x8a7a5a, 0.5);
    P.px(x, y, c);
  }
  for (let x = x0; x <= x1; x++) { slat(P, x, -D - 2, 1, 0.1); slat(P, x, 0, 1, worn ? -0.2 : 0.05); }
  for (let y = -D - 1; y <= 0; y++) { P.px(x0, y, WOOD[3]); P.px(x0 + 1, y, WOOD[2]); P.px(x1 - 1, y, WOOD[1]); P.px(x1, y, WOOD[0]); }
  if (worn) {
    for (let i = 0; i < 6; i++) { const x = x0 + 3 + Math.floor(hash(i, seed, 3) * (w - 6)), y = -3 - Math.floor(hash(i, seed, 4) * 8); P.vl(x, y - 3, 4, GRASS[1]); P.px(x + 1, y - 2, GRASS[3]); }
    P.rect(x0 + 5, -6, 2, 5, 0x3a8a3a); P.px(x0 + 5, -7, 0x2a6a2a); P.px(x1 - 6, -4, 0xd02020); P.px(x1 - 5, -4, 0xd02020);
    } else {
    P.rect(x0 + 5, -8, 4, 4, 0x2a6ad8); P.hl(x0 + 5, -8, 4, 0x6aa0ff); P.px(x0 + 6, -9, 0x2a6ad8); P.px(x0 + 7, -9, 0x2a6ad8);
    P.vl(x1 - 7, -9, 4, 0xe0c030); P.rect(x1 - 8, -6, 3, 2, 0xd02020);
    disc(P, x0 + (w >> 1), -5, 3.5, 2, 0xf0ece0); P.px(x0 + (w >> 1) - 1, -6, 0xffffff);
  }
  groundShadow(P, 2, 1, w / 2 + 1, 2, 0.24);
}
function paintSpringRider(P, worn) {
  for (let y = -8; y <= -1; y++) { P.px(-1, y, (y & 1) ? CHAIN[3] : CHAIN[1]); P.px(0, y, (y & 1) ? CHAIN[2] : CHAIN[0]); P.px(1, y, (y & 1) ? CHAIN[3] : CHAIN[1]); }
  P.hl(-3, 0, 7, IRON[1]); P.hl(-2, -1, 5, IRON[3]);
  if (worn) { P.hl(-2, -9, 5, IRON[2]); P.px(0, -10, RUST[3]); P.px(-3, 1, RUST[2]); groundShadow(P, 1, 1, 4, 1.4, 0.24); return; }
  const H = [0x8a4a10, 0xd88a28, 0xf8b850, 0xffe090];
  P.rect(-8, -14, 14, 5, H[1]); P.hl(-8, -14, 14, H[2]); P.hl(-8, -10, 14, H[0]);
  P.rect(5, -20, 5, 7, H[1]); P.hl(5, -20, 5, H[2]); P.px(9, -19, 0x1a1a1e); P.px(10, -18, H[0]); P.px(4, -21, H[0]); P.px(6, -21, H[0]);
  P.line(-8, -14, -11, -18, H[0]); P.px(-10, -19, H[2]);
  P.hl(-3, -16, 3, IRON[3]); P.px(-3, -17, IRON[4]); P.px(-1, -17, IRON[4]);
  groundShadow(P, 2, 1, 8, 1.8, 0.24);
}
function paintSeesaw(P) {
  P.rect(-2, -6, 5, 6, IRON[2]); P.hl(-2, -6, 5, IRON[4]); P.vl(2, -5, 5, IRON[0]);
  for (let x = -16; x <= 16; x++) { const y = -8 - Math.round(x * 0.22); P.px(x, y, 0x3a8ad8); P.px(x, y + 1, 0x2a5aa8); P.px(x, y - 1, 0x6ab0ff); }
  P.rect(-17, -13, 4, 2, 0xf0c020); P.rect(13, -6, 4, 2, 0xf0c020); P.vl(-15, -16, 3, IRON[3]); P.vl(15, -9, 3, IRON[3]);
  groundShadow(P, 2, 1, 16, 2, 0.24);
}

// ---------- förortens skräp ----------
function paintElskap(P, seed) {
  const G = [0x3e4640, 0x5a645c, 0x788278, 0x98a298, 0xb4bcb4];
  for (let y = -20; y <= 0; y++) for (let x = -7; x <= 6; x++) {
    let v = 0.8 - ((x + 7) / 13) * 0.55 + (y === -20 ? 0.15 : 0) - (y === 0 ? 0.35 : 0);
    if (y > -18 && y < -2 && x === 0) v -= 0.2; if (y === -16 || y === -14) v -= 0.1;
    if (hash(x, y, seed) > 0.93) v -= 0.25;
    P.px(x, y, tone(G, v, x, y));
  }
  P.rect(-6, -19, 12, 2, G[0]); for (let x = -5; x <= 4; x += 2) P.px(x, -18, G[3]);
  P.rect(3, -11, 2, 3, 0x1a1a1e); P.px(3, -11, G[4]);
  P.rect(-5, -8, 4, 4, 0xf0c020); P.px(-4, -7, 0x1a1a1e); P.px(-3, -6, 0x1a1a1e); P.px(-4, -5, 0x1a1a1e);
  // klotter borttaget (Carl: inte på elskåpen)
  P.rect(1, -14, 4, 3, 0xffffff, 0.9); P.px(2, -13, 0xd02020);
  groundShadow(P, 2, 1, 8, 2, 0.28);
}
function paintTrashBags(P, seed, n = 3) {
  for (let i = 0; i < n; i++) {
    const cx = -8 + i * 8 + Math.round(hash(i, seed, 1) * 3), rx = 5 + hash(i, seed, 2) * 2, ry = 4 + hash(i, seed, 3) * 2;
    for (let y = Math.floor(-2 * ry); y <= 0; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 + ry) / ry;
      if (nx * nx + ny * ny >= 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      P.px(x, y, tone(BAG, 0.35 + 0.45 * (-0.5 * nx - 0.6 * ny + 0.5 * nz) + (hash(x, y, seed + i) - 0.5) * 0.25, x, y));
    }
    P.px(cx + Math.round(rx * 0.3), Math.round(-2 * ry) + 1, 0xe8e0c8); P.px(cx + Math.round(rx * 0.3) + 1, Math.round(-2 * ry), 0xc8c0a8);
  }
  P.px(-14, 0, 0xd02020); P.px(-13, -1, 0xd02020); P.hl(9, 0, 3, 0xe8e0c8); P.px(13, -1, 0x3a8a3a); P.px(13, 0, 0x2a6a2a);
  outline(P, 0x08080a, 0x08080a, 0.4);
  groundShadow(P, 2, 1, 14, 2.2, 0.26);
}
function paintOverfullContainer(P) {
  paintContainer(P);
  P.erase(-10, -14, 22, 6);
  const C = [0x0e2a3a, 0x163e54, 0x22586e, 0x327488, 0x5a9aac];
  for (let y = -14; y <= -9; y++) for (let x = -10; x < 12; x++) P.px(x, y, tone(C, 0.55 - ((x + 10) / 22) * 0.3, x, y));
  // lock på glänt, påsar och kartonger som väller över
  P.line(-16, -20, -2, -27, C[3]); P.line(-16, -19, -2, -26, C[1]);
  for (const [cx, cy, rx, ry, s] of [[-8, -22, 5, 3.5, 1], [2, -24, 6, 4, 2], [10, -21, 5, 3, 3]]) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; if (nx * nx + ny * ny >= 1) continue;
    P.px(x, y, tone(BAG, 0.4 + 0.4 * (-0.5 * nx - 0.6 * ny) + (hash(x, y, s) - 0.5) * 0.3, x, y));
  }
  P.rect(-4, -19, 7, 4, 0xa8845a); P.hl(-4, -19, 7, 0xc8a878); P.vl(-1, -18, 3, 0x6a5030);
  P.rect(6, -18, 5, 3, 0xe8e0c8); P.px(7, -17, 0xd02020); P.px(-11, -18, 0x3a8a3a); P.px(-12, -17, 0x3a8a3a);
  P.px(9, -12, RUST[3]); P.px(10, -13, RUST[2]); P.px(-14, -4, RUST[2]);
  P.rect(17, -3, 6, 3, 0xe8e0c8); P.px(18, -4, 0xd02020); P.px(-19, -2, 0x1a1a1e); P.hl(-20, -1, 3, 0x26262e);
}
function paintTippedCart(P) {
  const hi = STEEL[4], mid = STEEL[2], lo = STEEL[1];
  // korgen ligger på sidan: trådgaller som en liggande trapets, hjulen uppåt
  for (let y = -9; y <= -1; y++) for (let x = -9; x <= 9; x++) {
    if (y === -9 || y === -1 || x === -9 || x === 9) P.px(x, y, y === -9 ? hi : lo);
    else if ((x - y) % 3 === 0 || (x + y) % 3 === 0) P.px(x, y, (y & 1) ? mid : STEEL[3], 0.7);
  }
  P.rect(-8, -8, 3, 4, 0xc82a2a); P.px(-8, -8, 0xff7060);
  P.line(9, -6, 14, -6, mid); P.line(14, -6, 15, -3, lo);
  for (const [wx, wy] of [[-6, -13], [4, -13]]) { P.rect(wx, wy, 3, 2, 0x1a1a1e); P.px(wx + 1, wy - 1, 0x6a6e76); P.vl(wx + 1, wy + 2, 4, lo); }
  P.hl(-5, -14, 12, lo); P.px(-11, -3, 0x1a1a1e); P.px(-10, -2, 0xe8e0c8);
  groundShadow(P, 2, 0, 12, 2, 0.26);
}
function paintTires(P, seed) {
  const T = [0x0e0e10, 0x1e1e22, 0x30323a, 0x4a4c54];
  const tire = (cx, cy, side) => {
    if (side) { for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = Math.hypot(x, y); if (d > 5.2 || d < 2) continue; P.px(cx + x, cy + y, tone(T, 0.55 - y * 0.06 - x * 0.03 + (d > 4.3 ? -0.15 : 0) + (hash(x, y, seed) - 0.5) * 0.14, cx + x, cy + y)); } P.px(cx - 2, cy - 3, T[3]); }
    else { for (let y = -3; y <= 0; y++) for (let x = -6; x <= 5; x++) { const e = Math.abs(x + 0.5) > 5 ? -0.2 : 0; P.px(cx + x, cy + y, tone(T, 0.62 - (y + 3) * 0.14 + e + (hash(x, y, seed + cy) - 0.5) * 0.12, cx + x, cy + y)); } P.hl(cx - 3, cy - 3, 6, T[3]); P.hl(cx - 2, cy - 2, 4, T[0]); }
  };
  tire(-6, 0); tire(-6, -4); tire(-6, -8); tire(6, -5, true);
  P.px(-6, -12, RUST[3]); P.px(-5, -12, RUST[2]);
  groundShadow(P, 2, 1, 12, 2, 0.28);
}
// bil (parkerad eller vrak), sedd från sidan: fronten åt höger
function paintCar(P, col, wreck, seed) {
  const B = wreck ? [0x2a1a10, 0x4a2c18, 0x6e4426, 0x8a5c38, 0xa87a50] : [mul(col, 0.35), mul(col, 0.6), col, mix(col, 0xffffff, 0.3), mix(col, 0xffffff, 0.6)];
  const yb = wreck ? -3 : -4;
  for (let y = yb - 8; y <= yb; y++) for (let x = -19; x <= 19; x++) {
    let v = 0.72 - ((y - (yb - 8)) / 8) * 0.35; if (x === -19 || x === 19) v -= 0.2; if (y === yb - 8) v += 0.2; if (y === yb) v -= 0.3;
    if (wreck && hash(x >> 1, y >> 1, seed) > 0.72) v += (hash(x, y, seed + 1) - 0.5) * 0.6;
    P.px(x, y, tone(B, v, x, y));
  }
  for (let y = yb - 15; y < yb - 8; y++) { const l = -12 + (yb - 8 - y), r = 12 - (yb - 8 - y) * 1.2; for (let x = Math.round(l); x <= r; x++) { const win = y > yb - 14 && x > l + 2 && x < r - 2 && x !== 0 && x !== 1; P.px(x, y, win ? (wreck ? (hash(x, y, seed + 2) > 0.5 ? 0x0a0a0c : 0x2a3a44) : mix(0x2a4a6a, 0x9ad0f0, (x - l) / (r - l) * 0.5 + (y - (yb - 14)) / 6 * 0.4)) : tone(B, y === yb - 15 ? 0.95 : 0.7, x, y)); } }
  P.hl(-18, yb - 4, 37, B[0], 0.5);
  P.rect(16, yb - 5, 3, 2, wreck ? 0x4a4a48 : 0xfff0a0); P.rect(-19, yb - 5, 2, 2, wreck ? 0x4a2a2a : 0xd02020);
  if (wreck) {
    for (const x of [-12, 11]) { P.rect(x - 3, -3, 7, 3, CONC_BLOCK[1]); P.hl(x - 3, -3, 7, CONC_BLOCK[2]); P.hl(x - 3, 0, 7, CONC_BLOCK[0]); }
    P.rect(-8, yb - 7, 6, 6, 0x1a1410); P.line(0, yb - 15, 6, yb - 19, B[2]); P.line(1, yb - 15, 7, yb - 19, B[0]);
    P.px(5, yb - 10, 0xffffff, 0.5); P.line(3, yb - 12, 8, yb - 9, 0xe8f4ff, 0.6);
    for (let i = 0; i < 6; i++) P.px(-20 + Math.round(hash(i, seed, 8) * 40), 1, hash(i, seed, 9) > 0.5 ? 0xe8f4ff : 0x9ac8e0);
  } else {
    for (const x of [-11, 11]) { for (let y = -5; y <= 0; y++) for (let xx = -3; xx <= 3; xx++) { const d = Math.hypot(xx, (y + 2.5) * 1.1); if (d < 3.4) P.px(x + xx, y, d < 1.6 ? 0x8a8e96 : d < 2.6 ? 0x2a2a30 : 0x121216); } }
    P.px(-16, yb - 2, B[4]); P.hl(-2, yb - 3, 4, B[0]); P.px(12, yb - 11, 0xe8f4ff, 0.7);
  }
  outline(P, 0x121216, 0x121216, 0.55);
  groundShadow(P, 3, 0, 21, 3, 0.3);
}
const CONC_BLOCK = [0x5a5852, 0x8a8880, 0xb0aea6];
function paintWeeds(P, seed, n = 6) {
  for (let i = 0; i < n; i++) {
    const bx = -8 + Math.round(hash(i, seed, 1) * 16), h = 3 + Math.floor(hash(i, seed, 2) * 5), lean = hash(i, seed, 3) > 0.5 ? 1 : -1;
    for (let k = 0; k < h; k++) P.px(bx + (k > h / 2 ? lean : 0), -k, GRASS[1 + (k & 1)]);
    if (hash(i, seed, 4) > 0.65) { P.px(bx + lean, -h, 0xffe030); P.px(bx + lean + 1, -h - 1, 0xfff080); }
    else if (hash(i, seed, 5) > 0.8) P.px(bx + lean, -h, 0xf0f0f0);
  }
}
function paintSofa(P) {
  const S = [0x2e2a34, 0x4a4452, 0x6a6474, 0x8a8494, 0xa8a2b2];
  for (let y = -10; y <= 0; y++) for (let x = -15; x <= 15; x++) P.px(x, y, tone(S, 0.62 - ((x + 15) / 30) * 0.3 - (y > -4 ? 0.15 : 0) + (hash(x, y, 541) - 0.5) * 0.1, x, y));
  for (let y = -17; y <= -10; y++) for (let x = -14; x <= 14; x++) P.px(x, y, tone(S, 0.72 - ((x + 14) / 28) * 0.3 + (y === -17 ? 0.15 : 0) + (hash(x, y, 542) - 0.5) * 0.1, x, y));
  P.vl(0, -16, 6, S[0]); P.vl(-1, -9, 5, S[0]); P.vl(1, -9, 5, S[0]);
  for (const x of [-16, 15]) for (let y = -14; y <= 0; y++) { P.px(x, y, S[x < 0 ? 3 : 1]); }
  P.rect(-9, -8, 5, 3, 0xc8a878); P.px(-8, -7, 0x8a6a48); P.px(-7, -7, 0x8a6a48);
  P.px(6, -7, CHAIN[3]); P.px(7, -8, CHAIN[4]); P.px(6, -9, CHAIN[3]);
  P.rect(8, -14, 4, 2, 0xd02020, 0.6); P.px(-12, -4, 0x1a1a1e); P.px(-11, -4, 0x1a1a1e);
  for (const x of [-13, 12]) { P.vl(x, 1, 2, 0x1a1410); }
  outline(P, 0x141018, 0x141018, 0.5);
  groundShadow(P, 3, 1, 17, 2.4, 0.3);
}
function paintBarrels(P) {
  const b = (x, C, dent) => {
    for (let y = -14; y <= 0; y++) for (let xx = -5; xx <= 4; xx++) {
      let v = 0.8 - ((xx + 5) / 9) * 0.6; if (y === -14) v += 0.15; if (y === 0) v -= 0.3; if (y === -10 || y === -5) v -= 0.18;
      if (dent && hash(xx, y, 551) > 0.8) v -= 0.3; if (hash(xx, y, 552) > 0.9) v = -1;
      P.px(x + xx, y, v < 0 ? RUST[1 + Math.floor(hash(xx, y, 553) * 3)] : tone(C, v, x + xx, y));
    }
    P.hl(x - 4, -15, 8, C[4]); P.px(x - 1, -15, C[2]); P.px(x + 1, -14, 0x1a1a1e);
  };
  b(-7, [0x102848, 0x1a4078, 0x2a5aa8, 0x4a80d0, 0x7aa8f0], false); b(5, [0x4a1010, 0x7a1a1a, 0xb02828, 0xd85040, 0xf08070], true);
  P.rect(-9, -8, 3, 3, 0xf0c020); P.px(-8, -7, 0x1a1a1e);
  P.ell(9, 1, 5, 1.5, 0x1a1410, 0.6, 3);
  groundShadow(P, 2, 1, 12, 2, 0.28);
}
function paintPallets(P) {
  for (let k = 0; k < 3; k++) {
    const y0 = -k * 5, dx = (k & 1) ? 1 : 0;
    for (let x = -12 + dx; x <= 12 + dx; x++) { P.px(x, y0 - 4, tone(WOOD, 0.8 + (hash(x, k, 561) - 0.5) * 0.15, x, y0)); P.px(x, y0 - 3, WOOD[2]); if ((x - dx + 12) % 8 === 0) { P.vl(x, y0 - 2, 2, WOOD[1]); P.vl(x + 1, y0 - 2, 2, WOOD[0]); } }
    P.hl(-12 + dx, y0 - 0, 25, WOOD[0]);
  }
  P.rect(-8, -22, 9, 7, 0xa8845a); P.hl(-8, -22, 9, 0xc8a878); P.vl(0, -21, 6, 0x6a5030); P.px(-6, -19, 0x3a2a1a); P.px(-4, -19, 0x3a2a1a);
  groundShadow(P, 2, 1, 14, 2, 0.28);
}
function paintPiskstallning(P) {
  for (const x of [-14, 13]) for (let y = -26; y <= 0; y++) { P.px(x, y, STEEL[3]); P.px(x + 1, y, STEEL[1]); }
  P.hl(-13, -26, 26, STEEL[4]); P.hl(-13, -25, 26, STEEL[2]); P.hl(-13, -16, 26, STEEL[3]); P.hl(-13, -15, 26, STEEL[1]);
  // en matta hänger över den övre stången
  for (let y = -25; y <= -8; y++) for (let x = -9; x <= 3; x++) {
    const p = ((x + 9) % 4 < 2) !== ((y + 25) % 4 < 2);
    P.px(x, y, mix(p ? 0x8a2a3a : 0xd8a040, 0x000000, y === -8 ? 0.4 : (x === 3 ? 0.3 : 0)));
  }
  P.hl(-9, -25, 13, 0xf0d090); P.vl(-9, -24, 17, 0xb04050);
  for (const x of [-15, 12]) P.hl(x, 0, 4, STEEL[0]);
  groundShadow(P, 2, 1, 16, 2, 0.26);
}
function paintGoal(P, dir) {
  const X = (x) => dir * x;
  for (let y = -22; y <= 0; y++) { P.px(X(0), y, 0xf4f4f0); P.px(X(0) - dir, y, 0xb8b8b4); }
  for (let y = -22; y <= -4; y++) { P.px(X(-8), y, 0xe0e0dc); }
  P.line(X(0), -22, X(-8), -22, 0xf4f4f0); P.line(X(-8), -4, X(-14), 0, 0xe0e0dc);
  for (let y = -21; y <= -1; y++) for (let x = -13; x < 0; x++) { const yy = y + Math.max(0, -(x + 8)) * 0.5; if (x < -8 && y < -4 - (-(x + 8)) * 0.5) continue; if ((x + y) % 3 === 0 || (x - y) % 3 === 0) P.px(X(x), Math.round(yy), 0xe8e8e0, 0.45); }
  P.hl(X(-1), 0, 3, 0x8a8a86);
  groundShadow(P, 1, 1, 8, 2, 0.22);
}
function paintFloodlight(P, broken) {
  for (let y = -70; y <= 0; y++) { P.px(0, y, hash(0, y, 571) > 0.85 ? RUST[2] : STEEL[3]); P.px(1, y, STEEL[1]); P.px(-1, y, y % 9 === 0 ? STEEL[4] : STEEL[2], 0.6); }
  P.rect(-3, -3, 7, 3, STEEL[1]); P.hl(-3, -3, 7, STEEL[3]);
  P.hl(-7, -70, 16, STEEL[2]); P.hl(-7, -71, 16, STEEL[4]);
  for (const x of [-6, 0, 6]) { P.rect(x - 2, -76, 5, 5, IRON[1]); P.hl(x - 2, -76, 5, IRON[3]); P.rect(x - 1, -74, 3, 2, broken && x === 6 ? 0x2a2a30 : 0xe8f0f8); }
  if (broken) { P.line(6, -70, 9, -64, 0x1a1a1e); P.px(9, -63, 0x1a1a1e); }
  groundShadow(P, 2, 1, 5, 1.6, 0.26);
}
function paintClothesline(P) {
  for (const x of [-22, 22]) { for (let y = -24; y <= 0; y++) { P.px(x, y, STEEL[3]); P.px(x + 1, y, STEEL[1]); } P.hl(x - 3, -24, 8, STEEL[2]); }
  for (let x = -21; x <= 21; x++) { P.px(x, -23 + Math.round(Math.sin(((x + 21) / 42) * Math.PI) * 1.5), 0xe8e8e0, 0.9); P.px(x, -19 + Math.round(Math.sin(((x + 21) / 42) * Math.PI) * 1.5), 0xd8d8d0, 0.8); }
  const G = [[-17, 0x3a7bd5, 8, 10], [-6, 0xf4f1ea, 6, 8], [3, 0xd02040, 7, 9], [13, 0x2a2a30, 6, 11]];
  for (const [x, c, w, h] of G) { const yt = -22 + Math.round(Math.sin(((x + 21) / 42) * Math.PI) * 1.5); for (let y = yt; y < yt + h; y++) for (let xx = x; xx < x + w; xx++) P.px(xx, y, mix(c, 0x000000, (xx - x) / w * 0.3 + (hash(xx, y, 581) - 0.5) * 0.1)); P.px(x, yt, 0xf0c020); P.px(x + w - 1, yt, 0xf0c020); }
  groundShadow(P, 2, 1, 24, 1.8, 0.2);
}
function paintPlasticChair(P, col) {
  const C = [mul(col, 0.5), mul(col, 0.75), col, mix(col, 0xffffff, 0.4)];
  P.rect(-4, -14, 8, 6, C[2]); P.hl(-4, -14, 8, C[3]); P.vl(3, -13, 5, C[1]); P.hl(-3, -12, 5, C[1], 0.5);
  P.rect(-5, -8, 10, 2, C[2]); P.hl(-5, -8, 10, C[3]); P.hl(-5, -7, 10, C[0]);
  for (const x of [-5, 4]) { P.vl(x, -6, 6, C[1]); P.vl(x + (x < 0 ? 1 : -1), -6, 6, C[0], 0.6); }
  P.px(-6, -13, C[1]); P.vl(-6, -12, 5, C[1]);
  groundShadow(P, 2, 1, 6, 1.6, 0.24);
}
function paintGrill(P) {
  for (const [x, y] of [[-5, 0], [5, 0], [0, 2]]) P.vl(x, -10, 10 - y, IRON[2]);
  disc(P, 0, -12, 8, 4, IRON[2]); disc(P, 0, -13, 8, 3, IRON[3]); P.hl(-7, -14, 15, IRON[4]);
  for (let x = -6; x <= 6; x += 2) P.px(x, -14, 0x8a8e96);
  P.rect(-4, -17, 3, 4, 0x2a2a30); P.px(-3, -18, 0xf08020); P.px(-2, -19, 0xffd040, 0.8); P.px(-1, -21, 0x8a8a8a, 0.4);
  P.px(9, -12, IRON[3]); P.px(10, -12, IRON[1]);
  groundShadow(P, 2, 1, 9, 2, 0.26);
}
function paintGasBottle(P) {
  const B = [0x0c1e4a, 0x18347a, 0x2850aa, 0x4a78d0, 0x7aa0e8];
  for (let y = -12; y <= 0; y++) for (let x = -3; x <= 3; x++) P.px(x, y, tone(B, 0.8 - ((x + 3) / 6) * 0.6 + (y === 0 ? -0.3 : 0), x, y));
  P.hl(-2, -13, 5, B[3]); P.rect(-1, -15, 3, 2, IRON[2]); P.px(0, -16, IRON[3]); P.rect(-2, -8, 4, 3, 0xf0f0e8, 0.7);
  groundShadow(P, 1, 1, 4, 1.4, 0.24);
}
function paintBollard(P, worn) {
  for (let y = -11; y <= 0; y++) for (let x = -2; x <= 1; x++) P.px(x, y, tone(IRON, 0.8 - ((x + 2) / 3) * 0.5 + (y === 0 ? -0.3 : 0), x, y));
  P.hl(-2, -12, 4, IRON[4]); P.hl(-2, -7, 4, worn ? 0xb8b0a0 : 0xf4f1ea); P.px(1, -7, 0xa8a49a);
  if (worn) { P.px(-1, -3, RUST[2]); P.px(0, -9, RUST[3]); P.px(-1, -10, 0x36d6ff); P.px(0, -10, 0x36d6ff); }
  groundShadow(P, 1, 1, 3, 1.2, 0.26);
}
function paintLifebuoy(P) {
  for (let y = -26; y <= 0; y++) { P.px(0, y, tone(WOOD, 0.75, 0, y)); P.px(1, y, WOOD[1]); }
  P.hl(-1, -27, 4, WOOD[4]);
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d = Math.hypot(x, y); if (d > 6.2 || d < 2.8) continue; const q = Math.abs(x) > Math.abs(y) ? (x > 0 ? 1 : 3) : (y > 0 ? 2 : 0); P.px(x + 1, y - 18, mix((q & 1) ? 0xf4f1ea : 0xf05020, 0x000000, (x + y) / 24 + 0.2)); }
  P.rect(-4, -12, 10, 6, 0xf4f1ea); P.box(-4, -12, 10, 6, 0xd02020); P.hl(-2, -10, 6, 0xd02020); P.hl(-2, -8, 4, 0xd02020);
  groundShadow(P, 1, 1, 4, 1.4, 0.26);
}
function paintIgloo(P, col, name, seed) {
  const C = [mul(col, 0.4), mul(col, 0.65), col, mix(col, 0xffffff, 0.25), mix(col, 0xffffff, 0.55)];
  for (let y = -18; y <= 0; y++) for (let x = -11; x <= 11; x++) {
    const nx = x / 11.5, ny = (y + 4) / 15; if (nx * nx + ny * ny >= 1 && y < -4) continue;
    if (y > -4 && Math.abs(x) > 10) continue;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let v = 0.4 + 0.5 * (-0.55 * nx - 0.5 * ny + 0.5 * nz); if (y === 0) v -= 0.3; if (hash(x, y, seed) > 0.94) v -= 0.25;
    P.px(x, y, tone(C, v, x, y));
  }
  P.rect(-9, -10, 4, 4, 0x0a0a0c); P.hl(-9, -10, 4, C[0]);
  P.rect(-2, -3, 6, 3, 0x1a1a1e); P.rect(-8, -9, 17, 6, 0xf4f1ea); text(P, SMALL, name, -8 + Math.floor((17 - textW(SMALL, name)) / 2), -8, C[0]);
  // påsar och flaskor runtom
  P.px(-14, -1, 0x3a8a3a); P.px(-14, -2, 0x3a8a3a); P.px(-13, 0, 0x2a6a2a); P.hl(12, 0, 3, 0xe8e0c8); P.px(13, -1, 0xd02020);
  outline(P, 0x121216, 0x121216, 0.45);
  groundShadow(P, 2, 1, 12, 2.4, 0.28);
}
function paintBrokenBench(P) {
  for (const x of [-12, 11]) { P.vl(x, -20, 11, hash(x, 1, 591) > 0.5 ? RUST[2] : IRON[2]); P.px(x, -20, IRON[4]); }
  slat(P, -13, -19, 26, 0.05); P.line(-13, -16, 4, -12, WOOD[1]); P.line(-13, -15, 4, -11, WOOD[0]);
  slat(P, -14, -10, 28, 0.12); P.hl(-14, -6, 28, WOOD[0]);
  for (const s of [0, 1]) { const x = s ? 12 : -13, i = s ? -1 : 1; P.vl(x, -11, 5, IRON[1]); P.vl(x, -5, 5, IRON[2]); P.vl(x + i, -5, 5, IRON[1]); P.hl(Math.min(x, x + i) - 1, 0, 4, IRON[0]); }
  P.px(3, -10, RUST[3]); P.px(-6, -9, 0x1a1a1e);
  groundShadow(P, 2, 0, 16, 3, 0.3);
}
function paintTicketMachine(P) {
  for (let y = -24; y <= 0; y++) for (let x = -5; x <= 4; x++) P.px(x, y, tone(IRON, 0.8 - ((x + 5) / 9) * 0.5 + (y === -24 ? 0.15 : 0) - (y === 0 ? 0.3 : 0), x, y));
  P.rect(-3, -21, 6, 5, 0x1a3a2a); P.hl(-2, -20, 4, 0x3aff8a, 0.8); P.hl(-2, -18, 3, 0x3aff8a, 0.5);
  P.rect(-3, -13, 6, 2, 0x2a2a30); P.px(-3, -13, 0x6a6e76); P.rect(0, -10, 3, 3, 0xf0c020); P.rect(-3, -6, 4, 2, 0x0a0a0c);
  text(P, SMALL, 'P', -1, -4, 0x2a6ad8);
  groundShadow(P, 1, 1, 6, 1.6, 0.26);
}
function paintReeds(P, seed, dry = false) {
  const R = dry ? [0x5a4a24, 0x7a6834, 0x9a8a4c, 0xbcaa6a] : [0x4a6a24, 0x6a8a34, 0x8aa848, 0xb0c060];
  for (let i = 0; i < 9; i++) {
    const bx = -6 + Math.round(i * 1.5), lean = (hash(i, seed, 1) - 0.5) * 3, h = 12 + hash(i, seed, 2) * 12;
    P.line(bx, 0, Math.round(bx + lean), Math.round(-h), R[i % 3]);
    if (hash(i, seed, 3) > 0.45) { P.vl(Math.round(bx + lean), Math.round(-h) - 4, 4, 0x5a3a1e); P.px(Math.round(bx + lean), Math.round(-h) - 5, 0x8a6a3a); }
    else P.px(Math.round(bx + lean), Math.round(-h) - 1, R[3]);
  }
  groundShadow(P, 2, 1, 7, 1.4, 0.2);
}
// dry = hösten: gult, torrt gräs med fröställningar i stället för blommor
function paintWildflowers(P, seed, w = 30, dry = false) {
  const x0 = -(w >> 1), G = dry ? [0x6a6a2a, 0x8a883a, 0xa8a050, 0xc4b868, 0xdcd090] : GRASS;
  for (let i = 0; i < w / 2; i++) {
    const x = x0 + Math.round(hash(i, seed, 1) * w), y = -Math.round(hash(i, seed, 2) * 6), h = 2 + Math.floor(hash(i, seed, 3) * 4);
    P.vl(x, y - h, h, G[1 + (i & 1)]);
    const cols = ['white', 'yellow', 'purple', 'blue', 'pink', 'red'];
    if (hash(i, seed, 4) > 0.3) {
      if (dry) { P.px(x, y - h - 1, 0x8a7a3a); if (hash(i, seed, 6) > 0.5) P.px(x + 1, y - h - 1, 0xb4a060); }
      else bloom(P, x, y - h - 1, FL[cols[Math.floor(hash(i, seed, 5) * cols.length)]], hash(i, seed, 6) > 0.5 ? 1 : 0);
    }
  }
  for (let i = 0; i < w / 3; i++) { const x = x0 + Math.round(hash(i, seed, 7) * w), y = -Math.round(hash(i, seed, 8) * 6); P.px(x, y, G[3]); P.px(x, y - 1, G[4]); }
}
function paintDogHurdle(P) {
  for (const x of [-10, 9]) { P.vl(x, -12, 13, WOOD[2]); P.vl(x + 1, -12, 13, WOOD[0]); P.px(x, -13, WOOD[4]); }
  P.hl(-9, -9, 18, 0xe0c030); P.hl(-9, -8, 18, 0xa88420); P.hl(-9, -4, 18, 0x2a6ad8); P.hl(-9, -3, 18, 0x1a4098);
  groundShadow(P, 2, 1, 12, 1.6, 0.24);
}
function paintInfoBoard(P, title) {
  for (const x of [-12, 10]) for (let y = -30; y <= 0; y++) { P.px(x, y, WOOD[3]); P.px(x + 1, y, WOOD[1]); }
  P.rect(-14, -34, 28, 3, WOOD[2]); P.hl(-14, -34, 28, WOOD[4]); P.hl(-14, -32, 28, WOOD[0]);
  P.rect(-13, -31, 26, 16, 0x2a5a30); P.box(-13, -31, 26, 16, WOOD[1]);
  text(P, SMALL, title, -12 + Math.floor((24 - textW(SMALL, title)) / 2), -29, 0xf4f1ea);
  P.rect(-11, -22, 22, 5, 0xe8e4d0); for (let y = -21; y <= -18; y += 2) P.hl(-10, y, 12 + (y & 2), 0x8a8478);
  P.rect(3, -22, 7, 5, 0x3a8ad8); P.px(4, -21, 0x5a9a3a); P.px(5, -20, 0x5a9a3a); P.px(6, -20, 0x5a9a3a);
  groundShadow(P, 2, 1, 13, 1.8, 0.26);
}

// ---------- placeringen ----------
const NW = CITY.SIDEWALK_N[0] + 7;   // 193: mot fasaderna
const NC = CITY.SIDEWALK_N[1] - 5;   // 213: kantstenen (träd, lyktor)
const SC = CITY.SIDEWALK_S[0] + 6;   // 282: kantstenen på södra sidan
const SB = CITY.SIDEWALK_S[1] - 5;   // 301: södra trottoarens bakkant mot parken
const PU = PARK_LAYOUT.promenade[1]; // 334: promenaden
const PD = PARK_LAYOUT.promenade[3]; // 346

export function createProps(env) {
  ENV = env;
  const items = [], obstacles = [], bases = [], glows = [], lits = [], skipped = [];
  const BLOCK = [...RESERVED, ...ALL_BUILDINGS.map(footprint)];
  const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  // lägg till ett föremål om dess markyta är ledig (aldrig i RESERVED, gångar eller husen);
  // force = kartan har själv reserverat platsen åt föremålet (busskurerna)
  function add(kind, x, y, base, obs, draw, force = false) {
    if ((!force && BLOCK.some((b) => hit(base, b))) || bases.some((b) => hit(base, b))) { skipped.push(`${kind}@${x},${y}`); return false; }
    bases.push(base);
    for (const o of obs) obstacles.push(o);
    items.push({ x, y, draw, kind });
    return true;
  }
  const cache = {};
  const once = (k, make) => cache[k] || (cache[k] = make());
  const sprItem = (kind, s, x, y, base, obs, force) => add(kind, x, y, base, obs, (ctx) => putW(ctx, s, x, y), force);
  // föremål som inte tar plats i marken (ogräs, blomster, glassplitter) – ingen bas, inga hinder
  const loose = (kind, s, x, y) => { items.push({ x, y, kind, draw: (ctx) => putW(ctx, s, x, y) }); };
  // blomster och gräs som följer årstiden: en sprite per nyckel (lat, cachas per föremål).
  // Standardnyckeln skiljer bara vintern (kala kvistar) från resten; make(nyckel) → sprite eller null
  const winterKey = (s) => (s === 'vinter' ? 'vinter' : 'blom');
  function seasonal(kind, x, y, base, obs, make, keyOf = winterKey) {
    const byS = {};
    const get = () => { const k = keyOf(seasonNow()); return k in byS ? byS[k] : (byS[k] = make(k)); };
    return add(kind, x, y, base, obs, (ctx) => { const s = get(); if (s) putW(ctx, s, x, y); });
  }

  // --- vind: mjuka byar som får kronorna att vaja. Vädret (env.weather.windNow = vind × byar,
  //     px/s, + = österut) lutar kronorna med vinden, gör svajet större och snabbare och ger
  //     fladder i lövverket – i blåst/kuling vajar träden kraftigt, i lugnt väder som förr.
  //     swayT är en fasackumulator (update) så att farten kan ändras utan ryck. ---
  let gust = 0, gustT = 0, gustTo = 0, swayT = 0;
  const windNow = () => env.weather?.windNow ?? env.weather?.wind ?? 0;
  const windK = () => Math.min(1.5, Math.abs(windNow()) / 60);            // 0 lugnt · ~1 blåst · 1,5 kuling i byarna
  const storm = () => Math.max(0, windK() - 0.35) / 0.8;                   // 0 i lugnt väder … ~1,4
  const sway = (ph, big) => {
    const s = storm(), sc = big ? 1.1 : 1;
    const base = (0.9 + gust) * Math.sin(swayT * (big ? 1.1 : 1.45) + ph);
    if (s <= 0) return base * sc;
    const lean = (windNow() < 0 ? -1 : 1) * s * 4.4;                       // lutar med vinden
    const flutter = Math.sin(env.t * 7.3 + ph * 3.1) * 0.9 * s;             // snabbt fladder i lövverket
    return Math.max(-11, Math.min(11, (base * (1 + 1.1 * s) + lean + flutter) * sc));
  };

  // träd: kronan och foten byggs per årstid (lat, cachas per träd) – vår/sommar/höst-färger, kalt på vintern,
  // körsbärsblom om våren, fallande löv om hösten, snö på grenarna när det ligger snö
  function tree(kind, x, y, grate = true) {
    const seed = (x * 7 + y * 13) | 0, ph = hash(x, y, 5) * 6.28, T0 = TREE[kind];
    const byS = {};
    const get = () => { const k = seasonNow(); return byS[k] || (byS[k] = makeSeasonTree(kind, seed, grate, k)); };
    const base = grate ? [x - 10, y - 4, x + 11, y + 5] : [x - 4, y - 3, x + 5, y + 2];
    const drops = Array.from({ length: 4 }, (_, i) => ({ o: hash(i, seed, 1), dx: (hash(i, seed, 2) - 0.5) * T0.rx * 1.4 }));
    // löv som blåsten sliter loss ur kronan (se nedan) – LEAF_TUMBLE: fyra lägen, x = ljus sida, o = mörk kant
    const LEAF_TUMBLE = [['xx.', '.xo'], ['.x.', 'xox'], ['xxo', '...'], ['o..', 'xx.']];
    const blown = Array.from({ length: 9 }, (_, i) => ({ o: hash(i, seed, 11), dx: (hash(i, seed, 12) - 0.5) * T0.rx * 1.5, dy: (hash(i, seed, 13) - 0.5) * T0.ry }));
    return add(kind, x, y, base, [[x - 2, y - 2, x + 3, y + 1]], (ctx) => {
      const t = get(), T = t.T, season = seasonNow(), snow = snowNow();
      putW(ctx, t.base, x, y);
      const st = storm();
      drawCrown(ctx, snow ? snowOf(t.crown) : t.crown, x, y, sway(ph, !grate) * (T.bare ? 0.3 + 0.15 * st : T.spruce ? 0.6 : 1));
      // i blåsten släpper kronan löv (blomblad på körsbären om våren) som far iväg med vinden,
      // tumlar (3 × 2, fyra lägen) och sjunker sakta – inte granar, inte kala vinterträd
      if (st > 0.15 && !T.spruce && !T.bare) {
        const hexOf = (c) => '#' + c.toString(16).padStart(6, '0');
        const dir = windNow() < 0 ? -1 : 1, n = Math.min(blown.length, Math.round(3 + 5 * st)), pet = T.petals && seasonNow() === 'vår';
        for (let i = 0; i < n; i++) {
          const b = blown[i], s = (env.t * (0.45 + 0.2 * b.o) + b.o * 7) % 1;
          if (s > 0.92) continue;
          const lx = x + b.dx + dir * s * (34 + 30 * st) + Math.sin(env.t * 5.3 + b.o * 11) * 1.5;
          const ly = y + T.cy + b.dy + s * s * 16 + Math.sin(env.t * 7.1 + b.o * 5) * 1.2;
          // tvåtonat löv (ljus ovansida, mörk kant) i fyra tumlingslägen – syns även mot gräset
          const fr = LEAF_TUMBLE[((env.t * 8 + b.o * 20) | 0) & 3], rx = Math.round(lx) - 1, ry = Math.round(ly), mir = dir < 0;
          const cx = pet ? (b.o > 0.5 ? '#ffd4e2' : '#f7c0d4') : hexOf(T.pal[5]), co = pet ? '#c0587e' : hexOf(T.pal[1]);
          for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) {
            const ch = fr[j][mir ? 2 - k : k];
            if (ch === '.') continue;
            ctx.fillStyle = ch === 'x' ? cx : co;
            ctx.fillRect(rx + k, ry + j, 1, 1);
          }
        }
      }
      const petal = T.petals && season === 'vår', leaf = season === 'höst' && !T.spruce;
      if (petal || leaf) {
        const fall = -(T.cy + T.ry * 0.4), pal = leaf ? T.pal : null;
        for (const p of drops) {
          const s = (env.t * (leaf ? 0.1 : 0.13) + p.o) % 1;
          if (s > 0.94) continue;
          ctx.fillStyle = leaf ? '#' + pal[3 + (s * 7 % 2 < 1 ? 0 : 1)].toString(16).padStart(6, '0') : (s * 7 % 2 < 1 ? '#ffd4e2' : '#f2a2bf');
          ctx.fillRect(Math.round(x + p.dx + s * 12 + Math.sin(env.t * 2.1 + p.o * 9) * 3), Math.round(y + T.cy + T.ry * 0.4 + s * fall), 1, 1);
        }
      }
    });
  }
  function deadTree(x, y) {
    const s = spr(44, 60, 22, 56, (P) => paintDeadTree(P, (x * 3 + y) | 0));
    sprItem('dött träd', s, x, y, [x - 4, y - 3, x + 5, y + 2], [[x - 2, y - 2, x + 3, y + 1]]);
  }
  const LAMP_S = [once('lampR', () => spr(30, 72, 13, 68, (P) => paintStreetLamp(P, 1))), once('lampL', () => spr(30, 72, 16, 68, (P) => paintStreetLamp(P, -1)))];
  const LAMP_GLOW = once('lampGlow', () => spr(64, 84, 32, 74, (P) => paintLampGlow(P, -59, 19, 22, 8)));
  const LAMP_LIT = [1, -1].map((m) => spr(12, 6, 6, 3, (P) => { P.hl(-3, 0, 6, 0xfff6d8); P.hl(-2, 0, 4, 0xffffff); P.hl(-4, 1, 8, 0xffe8b0, 0.5); P.hl(-3, -1, 6, 0xffe0a0, 0.35); }));
  // mode: 0 = hel, 1 = sliten (lutar, rost, klistermärken), 2 = trasig: flimrar, 3 = död (mörk, krossat glas)
  function lamp(x, y, m = 1, mode = 0) {
    const lean = mode ? [0, 2, -3, 3][mode] * (hash(x, y, 4) > 0.5 ? 1 : -1) : 0;
    const s = mode ? spr(36, 72, 18, 68, (P) => paintStreetLamp(P, m, mode === 3 ? 2 : 1, lean)) : LAMP_S[m > 0 ? 0 : 1];
    const hx = x + lean + (m > 0 ? 10 : -8);
    if (!sprItem('lykta', s, x, y, [x - 2, y - 3, x + 4, y + 1], [[x - 2, y - 3, x + 4, y + 1]])) return;
    if (mode === 3) return;
    glows.push({ x: hx, y, s: LAMP_GLOW, a: mode === 1 ? 0.8 : 0.95, flicker: mode === 2 ? 2 : hash(x, y, 3) > 0.93 ? 1 : 0 });
    lits.push({ x: hx, y: y - 59, s: LAMP_LIT[0], a: 1, flicker: mode === 2 ? 2 : 0 });
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
  // --- sittplatser: alla bänkar och busskurernas bänkar går att sitta på ---
  // En plats = { id, kind: 'bank'|'busskur'|'glass', x, y, dir, walk: {x, y}, hit: [x0, y0, x1, y1], bench, broken?, stop? }
  //   ('glass' = glasståndets uteservering: bistrostolarna och glasbänken – bench = bordet/bänken, sällskap sätter sig ihop)
  //   x, y  fotpunkten där figuren ritas sittande (drawPerson(ctx, x, y, look, dir, 5)) – y är också sorteringslinjen:
  //         framifrån sedd bänk: 1 px framför bänkens fotlinje (figuren ritas över sitsen),
  //         bakifrån sedd bänk: 6 px bakom (bänkens rygg ritas över figurens nederdel), busskur: mellan bakvägg och tak
  //   walk  fri punkt utanför bänkens hinder att gå till innan man sätter sig (och ställa sig på när man reser sig)
  //   hit   klickytan i världen (bänken + lite runtom); bench = bänkens id (platserna på samma bänk delar det)
  const seats = [];
  function addSeats(kind, xs, y, dir, walkY, hit, extra = {}) {
    const benchId = `${kind}@${Math.round(hit[0])},${Math.round(y)}`;
    xs.forEach((sx, i) => seats.push({ id: `${benchId}:${i}`, kind, x: sx, y, dir, walk: { x: sx, y: walkY }, hit, bench: benchId, ...extra }));
  }
  // bänk framifrån: sitsen ligger 7–10 px över fotlinjen, figurens knä hamnar på den när fötterna står på y + 1
  const frontSeats = (x, y, extra) => addSeats('bank', [x - 7, x + 6], y + 1, 'down', y + 5, [x - 15, y - 22, x + 16, y + 3], extra);
  const BENCH = [once('bench', () => spr(36, 26, 17, 22, (P) => paintBench(P, false))), once('benchB', () => spr(36, 24, 17, 20, (P) => paintBench(P, true)))];
  const bench = (x, y, back = false) => {
    if (!sprItem('bänk', BENCH[back ? 1 : 0], x, y, [x - 14, y - 5, x + 15, y + 1], [[x - 13, y - 4, x + 14, y]])) return false;
    if (back) addSeats('bank', [x - 7, x + 6], y - 6, 'up', y - 9, [x - 15, y - 21, x + 16, y + 2]); // bakifrån: man sitter med ryggen mot oss
    else frontSeats(x, y);
    return true;
  };
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
    seasonal('blomlåda', x, y, [x - (w >> 1), y - 5, x + (w >> 1), y + 1], [[x - (w >> 1), y - 4, x + (w >> 1), y]],
      (k) => spr(w + 10, 26, (w >> 1) + 4, 20, (P) => paintFlowerBox(P, w, (x * 3 + y) | 0, cols, style, k === 'vinter')));
  }
  function pot(x, y, plant) {
    const make = (k) => spr(30, 44, 15, 38, (P) => paintPot(P, plant, (x * 5 + y) | 0, k === 'vinter'));
    if (plant === 'pelargon') seasonal('kruka', x, y, [x - 7, y - 4, x + 7, y + 1], [[x - 6, y - 4, x + 6, y]], make);
    else sprItem('kruka', make('blom'), x, y, [x - 7, y - 4, x + 7, y + 1], [[x - 6, y - 4, x + 6, y]]);
  }
  function bed(x, y, w, rows) {
    seasonal('rabatt', x, y, [x - (w >> 1), y - 10, x + (w >> 1), y + 1], [[x - (w >> 1), y - 8, x + (w >> 1), y]],
      (k) => spr(w + 8, 22, (w >> 1) + 3, 18, (P) => paintBed(P, w, (x + y * 3) | 0, k === 'vinter' ? [] : rows, k === 'vinter')));
  }
  function hedge(x, y, w, h = 8) {
    const s = spr(w + 10, h + 12, (w >> 1) + 3, h + 7, (P) => paintHedge(P, w, h, (x * 11 + y) | 0));
    sprItem('häck', s, x, y, [x - (w >> 1), y - 6, x + (w >> 1), y + 1], [[x - (w >> 1), y - 5, x + (w >> 1), y]]);
  }
  function bush(x, y, flowers) {
    const make = (k) => spr(30, 24, 13, 19, (P) => paintBush(P, (x * 13 + y) | 0, k === 'vinter' ? null : flowers));
    if (flowers) seasonal('buske', x, y, [x - 8, y - 4, x + 8, y + 1], [[x - 6, y - 3, x + 6, y]], make);
    else sprItem('buske', make('blom'), x, y, [x - 8, y - 4, x + 8, y + 1], [[x - 6, y - 3, x + 6, y]]);
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
  // busskurens bänk längs bakväggen (sitsen på bakväggens fotlinje −3…0, benen ner till +5):
  // figuren sitter 6 px framför väggen – bakväggen ritas bakom, taket och de främre stolparna framför.
  // Den trasiga kuren har bara en planka kvar – en plats, broken.
  function shelterSeats(bx, by, stop, broken) {
    addSeats('busskur', broken ? [bx - 21] : [bx - 20, bx - 7], by + 6, 'down', by + 10, [bx - 29, by - 16, bx + 5, by + 8], { stop: stop?.id, ...(broken ? { broken: true } : {}) });
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
  flowerBox(1098, NW, 24, ['orange', 'yellow', 'red']); // (Burgarbarens menypelare vid 1182 ritas av fasaden – BURGARE_STAND i buildings-work.js)
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
    (ctx) => putW(ctx, SHB, SH.x, SH.y))) {
    items.push({ x: SH.x, y: SH_FRONT, kind: 'busskur-tak', draw: (ctx) => putW(ctx, SHF, SH.x, SH.y) });
    shelterSeats(SH.x, SH.y, BUS_STOPS[0], false);
    glows.push({ x: SH.x, y: SH.y, s: POSTER_GLOW, a: 0.7 });
    glows.push({ x: SH.x, y: SH.y, s: POSTER, a: 0.6 });
    glows.push({ x: SH.x, y: SH.y - 14, s: once('shelterLight', () => spr(50, 40, 25, 26, (P) => { P.ell(0, 12, 24, 7, 0xffe4b0, 0.35, 4); P.ell(-13, -5, 5, 2.5, 0xfff4d8, 0.9, 3); P.ell(14, -5, 5, 2.5, 0xfff4d8, 0.9, 3); })), a: 0.8 });
  }
  sprItem('hållplatsskylt', once('bussign', () => spr(32, 64, 15, 60, paintBusSign)), SH.x + 46, SB, [SH.x + 44, SB - 2, SH.x + 49, SB + 1], [[SH.x + 45, SB - 2, SH.x + 48, SB + 1]]);
  bikeRack(700, SB + 1); lamp(760, SC, -1); tree('korsbar', 800, SB); tree('lind', 862, SB);
  sign(cw[1].name, cw[1].x0 - 10, SB, 1);
  lamp(1010, SC, -1); tree('bjork', 1050, SB); lamp(1130, SC, -1); hydrant(1160, SC + 1); tree('korsbar', 1178, SB);
  sign(cw[2].name, cw[2].x0 - 10, SB, 1);
  tree('lind', 1316, SB); lamp(1370, SC, -1); tree('bjork', 1430, SB); bin(1486, SB); tree('korsbar', 1540, SB); lamp(1600, SC, -1); bin(1690, SB); // (linden vid 1660 fick ge plats åt kuren och skylten vid Flygplatsen)

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
  // (fryser till is under snötäcket: stilla bild med snö på kanterna)
  add('fontän', FOUNT.x, FOUNT.y, [FOUNT.x - 27, FOUNT.y - 25, FOUNT.x + 28, FOUNT.y + 1], [[FOUNT.x - 26, FOUNT.y - 24, FOUNT.x + 27, FOUNT.y]], (ctx) => (snowNow() ? put(ctx, snowOf(FR[0]), FOUNT.x, FOUNT.y) : put(ctx, fframe(), FOUNT.x, FOUNT.y)));

  // =====================================================================
  // v2 – Söder, parkens nya delar, Infarten och förorten
  // =====================================================================
  const seedAt = (x, y) => (x * 7 + y * 13) | 0;
  const item2 = (kind, x, y, base, obs, w, h, ax, ay, paint, force) => sprItem(kind, spr(w, h, ax, ay, paint), x, y, base, obs, force);

  // --- busskurer för hållplatserna 1–3 (kartan har reserverat platsen: force) ---
  function shelter(s, poster) {
    const bx = s.x, by = s.y - 13, fy = s.y, br = !!s.broken;
    const back = spr(72, 50, 36, 42, br ? paintBrokenShelterBack : (P) => paintShelterBack(P, poster));
    const front = spr(78, 56, 39, 42, br ? paintBrokenShelterFront : paintShelterFront);
    const obs = [[bx - 32, by - 4, bx + 33, by], br ? [bx - 27, by + 1, bx - 12, by + 5] : [bx - 27, by + 1, bx + 4, by + 5], [bx - 33, fy - 3, bx - 29, fy + 1], [bx + 30, fy - 3, bx + 34, fy + 1]];
    if (!add('busskur', bx, by, [bx - 33, by - 5, bx + 34, fy + 1], obs, (ctx) => putW(ctx, back, bx, by), true)) return;
    items.push({ x: bx, y: fy, kind: 'busskur-tak', draw: (ctx) => putW(ctx, front, bx, by) });
    shelterSeats(bx, by, s, br);
    if (br) {
      glows.push({ x: bx, y: by - 14, s: once('brokenLight', () => spr(50, 40, 25, 26, (P) => { P.ell(0, 12, 22, 6, 0xb8d8ff, 0.3, 4); P.ell(-13, -5, 5, 2.5, 0xe0f0ff, 0.9, 3); })), a: 0.8, flicker: 2 });
    } else {
      glows.push({ x: bx, y: by, s: once('posterGlow', () => spr(72, 50, 36, 42, (P) => P.ell(19, -18, 16, 20, 0xa8d8ff, 0.5, 5))), a: 0.7 });
      glows.push({ x: bx, y: by, s: spr(72, 50, 36, 42, poster), a: 0.6 });
      glows.push({ x: bx, y: by - 14, s: once('shelterLight', () => spr(50, 40, 25, 26, (P) => { P.ell(0, 12, 24, 7, 0xffe4b0, 0.35, 4); P.ell(-13, -5, 5, 2.5, 0xfff4d8, 0.9, 3); P.ell(14, -5, 5, 2.5, 0xfff4d8, 0.9, 3); })), a: 0.8 });
    }
    const sign = br ? spr(36, 64, 15, 60, paintBusSignBroken) : once('bussign', () => spr(32, 64, 15, 60, paintBusSign));
    sprItem('hållplatsskylt', sign, bx + 46, fy - 2, [bx + 44, fy - 4, bx + 49, fy - 1], [[bx + 45, fy - 4, bx + 48, fy - 1]], true);
  }
  shelter(BUS_STOPS[1], paintPosterBio);
  shelter(BUS_STOPS[2], paintPosterGlass);
  shelter(BUS_STOPS[3]);

  // --- staket runt tomter och hundrastgården: fyra sidor som y-sorterade bitar, hinder utom i grindarna ---
  function lotFence(rect, gates, style, worn, kind = 'staket') {
    const [x0, y0, x1, y1] = rect, seed = seedAt(x0, y0), H = FENCE_H[style], w = x1 - x0;
    const openH = (side, x) => gates.some((g) => g.side === side && x >= g.x0 && x < g.x1);
    const openV = (side, y) => gates.some((g) => g.side === side && y >= g.y0 && y < g.y1);
    const front = spr(w + 2, H + 6, 0, H + 4, (P) => paintFenceRun(P, w, style, seed, (x) => openH('s', x0 + x), worn));
    items.push({ x: (x0 + x1) / 2, y: y1, kind, draw: (ctx) => putW(ctx, front, x0, y1 - 1) });
    const back = spr(w + 2, H + 6, 0, H + 4, (P) => paintFenceRun(P, w, style, seed + 1, (x) => openH('n', x0 + x), worn));
    items.push({ x: (x0 + x1) / 2, y: y0, kind, draw: (ctx) => putW(ctx, back, x0, y0) });
    for (const [xx, side] of [[x0, 'w'], [x1 - 1, 'e']]) for (let ys = y0; ys < y1; ys += 16) {
      const hh = Math.min(16, y1 - ys), sg = spr(6, hh + H + 4, 1, H + 3, (P) => paintFenceSide(P, hh, style, seed + ys, (y) => openV(side, ys + y), worn));
      items.push({ x: xx, y: ys + hh, kind, draw: (ctx) => putW(ctx, sg, xx, ys) });
    }
    const segs = [];
    const run = (a, b, vertical, fixed, sideId) => {
      let s = a;
      const holes = gates.filter((g) => g.side === sideId).map((g) => (vertical ? [g.y0, g.y1] : [g.x0, g.x1])).sort((p, q) => p[0] - q[0]);
      for (const [h0, h1] of holes) { if (h0 > s) segs.push(vertical ? [fixed, s, fixed + 1, h0] : [s, fixed, h0, fixed + 1]); s = Math.max(s, h1); }
      if (b > s) segs.push(vertical ? [fixed, s, fixed + 1, b] : [s, fixed, b, fixed + 1]);
    };
    run(x0, x1, false, y0, 'n'); run(x0, x1, false, y1 - 1, 's'); run(y0, y1, true, x0, 'w'); run(y0, y1, true, x1 - 1, 'e');
    for (const s of segs) { obstacles.push(s); bases.push(s); }
  }
  for (const l of LOTS) if (l.fence) lotFence(l.rect, l.gates || [], l.kind === 'kyrkogard' ? 'mur' : 'chain', l.district === 'FÖRORTEN' ? 1 : 0, l.kind === 'kyrkogard' ? 'mur' : 'stängsel');
  // hundrastgården: parkgången [134–150] går längs östra kanten – staketet slutar där gången börjar
  const DOG = [...PARK_LAYOUT.dogPark];
  for (const w of PARK_LAYOUT.walks) if (w[0] < DOG[2] && w[2] > DOG[0] && w[1] < DOG[3] && w[3] > DOG[1]) DOG[2] = Math.min(DOG[2], w[0]);
  lotFence(DOG, [{ side: 'n', x0: PARK_LAYOUT.dogGate[0], x1: PARK_LAYOUT.dogGate[1] }], 'tra', 0, 'hundstaket');

  // --- små fabriker för v2-rekvisitan ---
  const grave = (kind, x, y) => item2('gravsten', x, y, [x - 6, y - 3, x + 8, y + 1], [[x - 5, y - 2, x + 7, y]], 22, 28, 11, 24, (P) => paintGravestone(P, kind, seedAt(x, y)));
  const swing = (x, y, worn) => item2('gunga', x, y, [x - 19, y - 4, x + 20, y + 1], [[x - 19, y - 3, x + 20, y]], 44, 36, 22, 32, (P) => paintSwing(P, worn));
  const slide = (x, y, worn) => item2('rutschkana', x, y, [x - 14, y - 3, x + 18, y + 1], [[x - 13, y - 2, x + 17, y]], 36, 40, 16, 36, (P) => paintSlide(P, worn));
  const sandbox = (x, y, w, worn) => item2('sandlåda', x, y, [x - (w >> 1), y - 14, x + (w >> 1) + 1, y + 1], [[x - (w >> 1), y - 13, x + (w >> 1), y]], w + 4, 20, (w >> 1) + 2, 16, (P) => paintSandbox(P, w, worn, seedAt(x, y)));
  const springRider = (x, y, worn) => item2('gunghäst', x, y, [x - 9, y - 3, x + 9, y + 1], [[x - 8, y - 2, x + 8, y]], 26, 26, 13, 23, (P) => paintSpringRider(P, worn));
  const seesaw = (x, y) => item2('gungbräda', x, y, [x - 17, y - 4, x + 17, y + 1], [[x - 16, y - 3, x + 16, y]], 40, 22, 20, 18, paintSeesaw);
  const elskap = (x, y) => item2('elskåp', x, y, [x - 7, y - 3, x + 7, y + 1], [[x - 7, y - 3, x + 7, y]], 18, 26, 9, 22, (P) => paintElskap(P, seedAt(x, y)));
  const trashBags = (x, y) => item2('sopsäckar', x, y, [x - 16, y - 3, x + 16, y + 1], [[x - 13, y - 2, x + 13, y]], 34, 18, 17, 14, (P) => paintTrashBags(P, seedAt(x, y)));
  const overfull = (x, y) => sprItem('container', once('contFull', () => spr(48, 36, 23, 31, paintOverfullContainer)), x, y, [x - 16, y - 8, x + 16, y + 1], [[x - 15, y - 7, x + 15, y]]);
  const tippedCart = (x, y) => sprItem('kundvagn', once('tipped', () => spr(30, 20, 13, 16, paintTippedCart)), x, y, [x - 10, y - 3, x + 12, y + 1], [[x - 9, y - 2, x + 11, y]]);
  const tires = (x, y) => item2('däck', x, y, [x - 12, y - 3, x + 12, y + 1], [[x - 11, y - 2, x + 11, y]], 28, 20, 14, 16, (P) => paintTires(P, seedAt(x, y)));
  const car = (x, y, col) => item2('bil', x, y, [x - 21, y - 6, x + 21, y + 1], [[x - 20, y - 5, x + 20, y]], 46, 28, 23, 24, (P) => paintCar(P, col, false, seedAt(x, y)));
  const wreck = (x, y) => item2('bilvrak', x, y, [x - 21, y - 6, x + 21, y + 1], [[x - 20, y - 5, x + 20, y]], 46, 28, 23, 24, (P) => paintCar(P, 0, true, seedAt(x, y)));
  const weeds = (x, y) => loose('ogräs', spr(22, 12, 11, 10, (P) => paintWeeds(P, seedAt(x, y))), x, y);
  const sofa = (x, y) => sprItem('soffa', once('sofa', () => spr(38, 24, 19, 20, paintSofa)), x, y, [x - 17, y - 4, x + 18, y + 1], [[x - 16, y - 3, x + 17, y]]);
  const barrels = (x, y) => sprItem('oljefat', once('barrels', () => spr(30, 22, 15, 18, paintBarrels)), x, y, [x - 12, y - 4, x + 12, y + 1], [[x - 11, y - 3, x + 11, y]]);
  const pallets = (x, y) => sprItem('pallar', once('pallets', () => spr(32, 28, 16, 24, paintPallets)), x, y, [x - 13, y - 4, x + 13, y + 1], [[x - 12, y - 3, x + 12, y]]);
  const piskstallning = (x, y) => sprItem('piskställning', once('pisk', () => spr(36, 32, 18, 28, paintPiskstallning)), x, y, [x - 16, y - 3, x + 16, y + 1], [[x - 15, y - 2, x + 15, y]]);
  const goal = (x, y, dir) => item2('fotbollsmål', x, y, dir > 0 ? [x - 14, y - 3, x + 2, y + 1] : [x - 2, y - 3, x + 14, y + 1], [dir > 0 ? [x - 13, y - 2, x + 1, y] : [x - 1, y - 2, x + 13, y]], 34, 28, 17, 24, (P) => paintGoal(P, dir));
  const floodlight = (x, y, broken) => { if (item2('strålkastare', x, y, [x - 4, y - 2, x + 5, y + 1], [[x - 3, y - 2, x + 4, y]], 24, 82, 12, 78, (P) => paintFloodlight(P, broken))) { glows.push({ x: x - 3, y: y + 4, s: once('floodGlow', () => spr(90, 100, 45, 90, (P) => paintLampGlow(P, -74, 30, 34, 10))), a: 0.7, flicker: broken ? 1 : 0 }); } };
  const clothesline = (x, y) => sprItem('tvättlina', once('cloth', () => spr(52, 30, 26, 26, paintClothesline)), x, y, [x - 24, y - 3, x + 24, y + 1], [[x - 23, y - 2, x - 21, y], [x + 21, y - 2, x + 23, y]]);
  const chair = (x, y, col = 0xf4f1ea) => sprItem('plaststol', once('chair' + col, () => spr(16, 18, 8, 16, (P) => paintPlasticChair(P, col))), x, y, [x - 5, y - 3, x + 5, y + 1], [[x - 5, y - 2, x + 5, y]]);
  const grill = (x, y) => sprItem('grill', once('grill', () => spr(24, 26, 12, 22, paintGrill)), x, y, [x - 7, y - 3, x + 7, y + 1], [[x - 6, y - 2, x + 6, y]]);
  const gasBottle = (x, y) => sprItem('gasol', once('gas', () => spr(12, 20, 6, 17, paintGasBottle)), x, y, [x - 4, y - 3, x + 4, y + 1], [[x - 3, y - 2, x + 3, y]]);
  const bollard = (x, y, worn) => sprItem('pollare', once('bollard' + (worn ? 1 : 0), () => spr(8, 16, 4, 14, (P) => paintBollard(P, worn))), x, y, [x - 2, y - 2, x + 2, y + 1], [[x - 2, y - 2, x + 2, y]]);
  const lifebuoy = (x, y) => sprItem('livboj', once('buoy', () => spr(18, 32, 8, 29, paintLifebuoy)), x, y, [x - 2, y - 2, x + 3, y + 1], [[x - 1, y - 2, x + 2, y]]);
  const igloo = (x, y, col, name) => item2('återvinning', x, y, [x - 12, y - 4, x + 12, y + 1], [[x - 11, y - 3, x + 11, y]], 32, 24, 16, 20, (P) => paintIgloo(P, col, name, seedAt(x, y)));
  // den trasiga bänken: sitsen är hel (ryggen har en lös planka) – går att sitta på, broken
  const brokenBench = (x, y) => { if (sprItem('trasig bänk', once('bbench', () => spr(36, 26, 17, 22, paintBrokenBench)), x, y, [x - 14, y - 5, x + 15, y + 1], [[x - 13, y - 4, x + 14, y]])) frontSeats(x, y, { broken: true }); };
  // förortens ovårdade häckar och snår (snåren följer årstiden: grönt, brunt om hösten, kala kvistar på vintern)
  function wornHedge(x, y, w, h = 8) {
    const s = spr(w + 10, h + 16, (w >> 1) + 3, h + 11, (P) => paintHedge(P, w, h, (x * 11 + y) | 0, true));
    sprItem('häck', s, x, y, [x - (w >> 1), y - 6, x + (w >> 1), y + 1], [[x - (w >> 1), y - 5, x + (w >> 1), y]]);
  }
  const scrubKey = (s) => (s === 'vår' ? 'sommar' : s);
  const scrub = (x, y) => seasonal('snår', x, y, [x - 9, y - 4, x + 9, y + 1], [[x - 7, y - 3, x + 7, y]],
    (k) => spr(40, 36, 20, 31, (P) => paintScrub(P, seedAt(x, y), k)), scrubKey);
  const ticketMachine = (x, y) => sprItem('biljettautomat', once('ticket', () => spr(14, 28, 7, 25, paintTicketMachine)), x, y, [x - 6, y - 3, x + 5, y + 1], [[x - 5, y - 2, x + 4, y]]);
  // vassen är grön vår/sommar, gulbrun höst/vinter; vildblommorna blommar vår/sommar, är torrt gräs om hösten och borta under snön
  const dryKey = (s) => (s === 'höst' || s === 'vinter' ? 'torr' : 'grön');
  const reeds = (x, y) => seasonal('vass', x, y, [x - 4, y - 2, x + 5, y + 1], [[x - 3, y - 1, x + 4, y]], (k) => spr(20, 34, 10, 31, (P) => paintReeds(P, seedAt(x, y), k === 'torr')), dryKey);
  const wildflowers = (x, y, w = 30) => {
    const byS = {};
    items.push({ x, y, kind: 'vildblommor', draw: (ctx) => {
      const k = seasonNow();
      if (k === 'vinter') return;
      const s = byS[k] || (byS[k] = spr(w + 6, 14, (w >> 1) + 3, 12, (P) => paintWildflowers(P, seedAt(x, y), w, k === 'höst')));
      putW(ctx, s, x, y);
    } });
  };
  const hurdle = (x, y) => sprItem('hundhinder', once('hurdle', () => spr(26, 18, 13, 15, paintDogHurdle)), x, y, [x - 11, y - 3, x + 11, y + 1], [[x - 10, y - 2, x + 10, y]]);
  const infoBoard = (x, y, title) => item2('anslagstavla', x, y, [x - 13, y - 3, x + 14, y + 1], [[x - 12, y - 2, x + 13, y]], 34, 40, 17, 36, (P) => paintInfoBoard(P, title));
  const graffitiWall = (x, y, w) => item2('klotterplank', x, y, [x - (w >> 1), y - 6, x + (w >> 1), y + 1], [[x - (w >> 1), y - 5, x + (w >> 1), y]], w + 8, 32, (w >> 1) + 4, 28, (P) => paintGraffitiWall(P, w, seedAt(x, y)));

  // =================== glasståndet med uteserveringen (kioskens plats i parken) ===================
  // Ståndet (tre lager, se paintGlassStandBack), glassmenyn väster om det mot Parkgatans gång och
  // uteserveringen öster om det: två bistrobord med parasoll och stolar + ståndets egen bänk för två.
  // Alla platser är sittbara (kind 'glass'); den som sitter framifrån sedd får en glass i handen
  // som krymper medan hen äter (bara när ståndet har öppet).
  // ljus som skyms av det som står framför källan (se occMark): occBox[nyckel] = världsrutan som
  // nyckelns ljus täcker, räknas ut när ljusen läggs till
  const occBox = {};
  function litOcc(list, g) {
    list.push(g);
    const s = g.s, x0 = Math.round(g.x) - s.ax, y0 = Math.round(g.y) - s.ay, o = occBox[g.occ];
    occBox[g.occ] = o ? [Math.min(o[0], x0), Math.min(o[1], y0), Math.max(o[2], x0 + s.w), Math.max(o[3], y0 + s.h)] : [x0, y0, x0 + s.w, y0 + s.h];
  }
  function glassStand() {
    const X = GS.x, Y = GS.y;
    const open = () => { const h = env.hour ?? 12; return h >= GS.open[0] && h < GS.open[1]; };
    const BACK = spr(72, 104, 36, 100, paintGlassStandBack);
    const FRONT = spr(52, 36, 26, 32, paintGlassStandFront);
    const SHUT = spr(44, 50, 22, 46, paintGlassShutter);
    const FLAG = {};
    const flagOf = (e, amp, f) => { const k = `${e ? 'e' : 'w'}${amp}${f}`; return FLAG[k] || (FLAG[k] = spr(26, 20, 13, 6, (P) => paintGlassFlag(P, f * Math.PI / 2, e, amp))); };
    // ståndet står på kioskens fotavtryck; pelarna sticker ut på var sida om det
    obstacles.push([X - 32, Y - 24, X + 32, Y]);
    bases.push([X - 30, Y - 26, X + 34, Y + 4]);                                               // (menyn står tätt intill i väster)
    items.push({ x: X, y: Y + 0.6, kind: 'glasstånd', draw: (ctx) => {
      putW(ctx, BACK, X, Y);
      // flaggan fladdrar med vinden (österut när vinden är positiv), fortare och vildare i blåst
      const w = env.weather?.windNow ?? env.weather?.wind ?? 6, e = w >= 0, amp = Math.abs(w) > 24 ? 2 : 1;
      put(ctx, flagOf(e, amp, Math.floor(env.t * (3 + Math.min(6, Math.abs(w) / 8))) % 4), X + (e ? -28 : -31), Y - 94);
      const isOpen = open();
      if (isOpen) drawExpedit(ctx, env.t);
      putW(ctx, FRONT, X, Y);
      if (!isOpen) putW(ctx, SHUT, X, Y);
      else occMark(ctx, 'glasstånd', occBox['glasstånd']);             // kvällsljuset skyms av dem som står framför disken
    } });
    litOcc(lits, { x: X, y: Y, s: spr(72, 104, 36, 100, paintGlassStandLit), a: 1, when: open, occ: 'glasstånd' });
    litOcc(glows, { x: X, y: Y, s: spr(96, 80, 48, 60, paintGlassStandGlow), a: 0.9, when: open, occ: 'glasstånd' });

    // glassmenyn: stor tavla väster om ståndet, läsbar från gången
    const MX = X - 62, MY = Y + 1;
    const MENU = once('gmenu', () => spr(66, 80, 33, 76, paintGlassMenu));
    if (add('glassmeny', MX, MY, [MX - 30, MY - 3, MX + 31, MY + 1], [[MX - 30, MY - 3, MX + 31, MY]], (ctx) => {
      putW(ctx, MENU, MX, MY);
      if (open()) occMark(ctx, 'glassmeny', occBox['glassmeny']);        // den som går förbi tavlan skymmer skenet
    })) {
      litOcc(lits, { x: MX, y: MY, s: spr(66, 80, 33, 76, paintGlassMenuLit), a: 1, when: open, occ: 'glassmeny' });
      litOcc(glows, { x: MX, y: MY, s: spr(80, 90, 40, 80, (P) => { P.ell(0, -42, 34, 30, 0xfff0c8, 0.32, 5); P.ell(0, -73, 6, 3, 0xfff4d0, 0.7, 3); }), a: 0.8, when: open, occ: 'glassmeny' });
    }

    // glass i handen på den som sitter framifrån sedd (ritas strax efter figuren på platsen). Den som
    // sitter är närmaste person inom 2,6 px från platsen (livet sätter sig redan på ≤ 2 px och ritar
    // figuren där den står, inte i platsens mitt) och som har stått still minst 0,3 s – den som bara
    // går förbi platsen får ingen glass. Struten ritas vid figurens egen (avrundade) fotpunkt.
    const sitterAt = (s) => {
      let best = null, bd = 2.6;
      for (const p of env.people || []) { const d = Math.max(Math.abs(p.x - s.x), Math.abs(p.y - s.y)); if (d < bd) { bd = d; best = p; } }
      return best;
    };
    const handGlass = (s) => {
      const st = { x: NaN, y: NaN, since: 0 };
      items.push({ x: s.x, y: s.y + 0.2, kind: 'glass-i-handen', draw: (ctx) => {
        if (!open()) return;
        const p = sitterAt(s);
        if (!p) { st.x = NaN; return; }
        const px = Math.round(p.x), py = Math.round(p.y);
        if (px !== st.x || py !== st.y) { st.x = px; st.y = py; st.since = env.t; }
        if (env.t - st.since >= 0.3) drawSeatGlass(ctx, s, env.t, px, py);
      } });
    };
    const LANTERN = once('glantern', () => spr(24, 16, 12, 8, (P) => { P.ell(0, 0, 8, 5, 0xffc060, 0.55, 4); P.ell(0, 0, 2.5, 2, 0xfff0c0, 0.9, 2); }));
    // bistrobord: stol bakom (man sitter mot oss) och stol framför (man sitter med ryggen mot oss)
    function table(tx, ty, canopy) {
      const T = spr(36, 62, 18, 58, (P) => paintGlassTable(P, canopy));
      const CD = once('gchairD', () => spr(16, 28, 8, 24, (P) => paintGlassChair(P, 'down')));
      const CU = once('gchairU', () => spr(16, 28, 8, 24, (P) => paintGlassChair(P, 'up')));
      const nx = tx - 5, ny = ty - 5, sx = tx + 5, sy = ty + 11;                               // stolarnas fotpunkter
      const obs = [[tx - 9, ty - 3, tx + 10, ty + 1], [nx - 5, ny - 3, nx + 6, ny + 1], [sx - 5, sy - 3, sx + 6, sy + 1]];
      const lk = `glasslykta@${tx}`;                                                           // lyktan skyms av den som sitter framför bordet
      if (!add('glassbord', tx, ty, [tx - 11, ny - 4, tx + 12, sy + 2], obs, (ctx) => { putW(ctx, T, tx, ty); if (open()) occMark(ctx, lk, occBox[lk]); })) return;
      items.push({ x: nx, y: ny - 0.5, kind: 'glasstol', draw: (ctx) => putW(ctx, CD, nx, ny) });
      items.push({ x: sx, y: sy, kind: 'glasstol', draw: (ctx) => putW(ctx, CU, sx, sy) });
      const bench = `glass@${tx},${ty}`;
      const north = { id: `${bench}:0`, kind: 'glass', x: nx, y: ny, dir: 'down', walk: { x: nx, y: ny - 8 }, hit: [tx - 12, ty - 36, tx + 13, ty - 2], bench };
      seats.push(north, { id: `${bench}:1`, kind: 'glass', x: sx, y: sy - 5, dir: 'up', walk: { x: sx, y: sy + 5 }, hit: [tx - 12, ty - 2, tx + 13, ty + 14], bench });
      handGlass(north);
      litOcc(glows, { x: tx + 5, y: ty - 16, s: LANTERN, a: 0.85, when: open, occ: lk });
    }
    table(458, 426, [0xe8508a, 0xf8f2e6]);
    table(506, 432, [0x3e9a82, 0xf8f2e6]);
    // ståndets bänk för två (med sin kompis) framför uteserveringen
    const GB = once('gbench', () => spr(36, 26, 17, 22, paintGlassBench));
    const bx = 478, by = 452;
    if (add('glassbänk', bx, by, [bx - 14, by - 5, bx + 15, by + 1], [[bx - 13, by - 4, bx + 14, by]], (ctx) => putW(ctx, GB, bx, by))) {
      const n0 = seats.length;
      addSeats('glass', [bx - 7, bx + 6], by + 1, 'down', by + 5, [bx - 15, by - 22, bx + 16, by + 3]);
      for (let i = n0; i < seats.length; i++) handGlass(seats[i]);
    }
    bin(524, 452);
  }

  // =================== parken: dammen, hundrastgården, lekplatsen, ängen, parkgången ===================
  for (const [x, y] of [[216, 396], [228, 424], [250, 424], [290, 378], [232, 378]]) reeds(x, y); // (öster om dammen går parkgången – vassen står på västra stranden)
  bench(262, 438, true);
  hurdle(110, 432); bin(126, 446); infoBoard(112, 354, 'HUNDAR');
  glassStand(); // (löpsedeln SOL! I HELG stod här när kiosken sålde kvällstidningar – nu står glassmenyn där)
  swing(1056, 436, false); slide(1104, 434, false); sandbox(1058, 456, 30, false); springRider(1094, 455, false); seesaw(1124, 447);
  for (const [x, y] of [[1500, 420], [1545, 382], [1590, 442], [1632, 402], [1662, 440], [1482, 452], [1610, 372], [1530, 450]]) wildflowers(x, y);
  for (const x of [200, 530, 700, 1000, 1260, 1600]) parkLamp(x, 460); // (lyktan vid 480 flyttade öster om uteserveringen)
  bench(560, 460); bench(1290, 460);
  for (const [x, f] of [[90, 'white'], [700, 'pink'], [960, null], [1250, 'purple'], [1450, null]]) bush(x, 456, f); // (busken vid 460 gav plats åt glasbänken)
  bed(560, 452, 40, ['red', 'yellow']); bed(1000, 452, 40, ['blue', 'white']);

  // =================== kyrkogården ===================
  const KG = LOTS.find((l) => l.id === 'kyrkogard');
  if (KG) {
    const rows = [[520, [1016, 1040, 1064, 1088, 1130, 1154, 1200]], [548, [1020, 1046, 1070, 1136, 1160, 1184]], [600, [1016, 1078, 1132, 1156, 1180, 1200]], [628, [1022, 1084, 1140, 1164, 1188]]]; // (granen står där 1178 låg)
    rows.forEach(([y, xs], r) => xs.forEach((x, k) => grave((r + k) % 4, x + Math.round(hash(r, k, 61) * 4), y + Math.round(hash(r, k, 62) * 4))));
    tree('gran', 1180, 524, false); tree('bjork', 1024, 612, false);
    bench(1150, 590, true); parkLamp(1126, 592); hedge(1060, 506, 40);
  }

  // =================== Söder: trottoaren framför husen, gränderna, kajen ===================
  const FS = CITY.SIDEWALK_SN[0] + 6, CS = CITY.SIDEWALK_SN[1] - 5; // 646 mot fasaderna, 667 kantstenen
  // (björken som stod vid 1380 skymde vårdcentralens ambulansintag – nu vid kyrkogårdsstaketet 1108)
  for (const [k, x] of [['lind', 50], ['korsbar', 170], ['bjork', 400], ['lind', 560], ['korsbar', 700], ['lind', 900], ['bjork', 1030], ['bjork', 1108], ['korsbar', 1150], ['lind', 1250], ['korsbar', 1490], ['lind', 1610]]) tree(k, x, CS);
  for (const x of [110, 330, 470, 640, 770, 960, 1090, 1200, 1300, 1440, 1560, 1660]) lamp(x, CS + 1);
  hydrant(240, CS); bin(600, CS); hydrant(1010, CS); bin(1330, CS);
  // gatuskyltarna står öster om övergångsställena (trafikljusstolpen tar den västra sidan) men
  // plåten pekar VÄSTERUT över gatmynningen – åt öster täckte den postens brevlåda/dörr,
  // kyrkporten och vårdcentralens skyltfönster (granskningsfynd)
  sign(CROSSWALKS_S[0].name, CROSSWALKS_S[0].x1 + 8, CS - 2, -1);
  sign(CROSSWALKS_S[1].name, CROSSWALKS_S[1].x1 + 8, CS - 2, -1);
  sign('VÅRDGATAN', 1218, CS - 2, -1); // vid gågatans västra hörn – plåten fri från lindens krona
  menu(158, FS); pot(246, FS, 'klot'); // (pizzerians gamla uteservering här är borttagen – den nya står på trädäcket längs gaveln, buildings-south.js)
  mailbox(330, FS); bikeRack(418, FS + 3); // brevlådan öster om skyltstolpen så stolpen inte spetsar den
  // djuraffären: en LÅG blomlåda i stället för klotkrukan vid 490 – krukan skymde klösträdet och kattungarna i skyltfönstret (granskningsfynd)
  bench(460, FS + 2); flowerBox(486, FS, 20, ['yellow', 'white'], 'svart'); pot(556, FS, 'klot'); bench(580, FS + 2); bin(606, FS);
  pot(690, FS, 'kon'); // (löpsedeln SOL! I HELG stod här – borttagen, Carl 2026-09-29)
  pot(766, FS, 'kon'); bench(790, FS + 2);
  hedge(890, FS, 30); hedge(978, FS, 30);
  // (Leksakslådan står här) – bänken och cykelstället flyttade ur skyltfönstret
  // krukan och östra bänken stod framför ambulansintaget – krukan till kyrkogårdsstaketet,
  // bänken till kantstenen (helt under fasadlinjen, vetter mot gatan)
  bench(1290, FS + 2); bin(1310, FS); bench(1400, CS - 2);
  flowerBox(1470, FS, 24, ['red', 'white']); pot(1546, FS, 'palm');
  for (const [x, y, a, b] of [[156, 560, 'gron', 'brun'], [412, 530, 'gra', 'gron'], [620, 540, 'bla', 'gra'], [1428, 520, 'gron', 'gra'], [1582, 560, 'gra', 'gron']]) { wheelieBin(x, y, a); wheelieBin(x + 11, y, b); }
  // bortre trottoaren mot kanalen: bänkar med ryggen mot gatan (framifrån sedda – den som sitter tittar ut
  // över kanalen, mot oss), lyktor, pollare och livbojar på kajen
  const QS = CITY.SIDEWALK_SS[1] - 8, QL = CITY.SIDEWALK_SS[1] - 12, QB = CITY.QUAY[0] + 6; // 752, 748, 766
  for (const x of [90, 210, 420, 560, 700, 950, 1180, 1300, 1460, 1600]) bench(x, QS);
  for (const x of [150, 360, 480, 640, 780, 900, 1240, 1400, 1540, 1660]) lamp(x, QL, -1);
  for (const x of [250, 590, 1030, 1350]) bin(x, QS);
  bikeRack(745, QS); bikeRack(515, QS);
  for (let x = 40; x < CITY.X_CITY - 10; x += 96) bollard(x, QB, false);
  for (const x of [180, 560, 940, 1320]) lifebuoy(x, QB);

  // =================== Infarten ===================
  lamp(1682, 380); lamp(1682, 456); lamp(1769, 380); lamp(1769, 450, 1, 1);
  for (const x of [1706, 1718, 1730, 1742]) bollard(x, 184, false);
  bench(1726, 100); bikeRack(1726, 150); wheelieBin(1712, 60, 'gra'); wheelieBin(1723, 60, 'gron');

  // =================== förorten: norra raden (Pixelgatans norra trottoar) ===================
  const FN = NW, CN = NC; // 193 / 213
  lamp(1790, CN + 1, 1, 2); deadTree(1860, CN); elskap(1920, CN - 1); lamp(1990, CN + 1, 1, 1); lamp(2100, CN + 1, 1, 3); tippedCart(2170, CN - 1);
  lamp(2210, CN + 1, 1, 1); lamp(2330, CN + 1, 1, 2); deadTree(2400, CN); lamp(2480, CN + 1, 1, 1); elskap(2560, CN - 1); lamp(2640, CN + 1, 1, 3); lamp(2700, CN + 1, 1, 1);
  wheelieBin(1790, FN + 1, 'gra'); wheelieBin(1801, FN + 1, 'gron'); trashBags(1890, FN + 2); brokenBench(1922, FN + 3);
  trashBags(2058, FN + 2); // (löpsedeln SOL! I HELG vid närbutiken borttagen)
  bollard(2078, FN - 1, true); bollard(2142, FN - 1, true);
  chair(2156, FN + 1); chair(2224, FN + 1, 0xd8d0c0); tires(2306, FN + 1); trashBags(2378, FN + 2);
  wheelieBin(2432, FN + 1, 'gron'); wheelieBin(2443, FN + 1, 'gra'); wheelieBin(2454, FN + 1, 'brun'); trashBags(2560, FN + 2); brokenBench(2590, FN + 3);
  for (const [x, y] of [[1850, 200], [1940, 210], [2050, 198], [2120, 214], [2260, 200], [2360, 212], [2470, 214], [2620, 200], [2690, 212]]) weeds(x, y);
  // tomten: skrot bakom stängslet
  wreck(2672, 130); tires(2648, 165); sofa(2690, 172); tippedCart(2650, 96); trashBags(2690, 70);
  for (const [x, y] of [[2645, 110], [2700, 110], [2660, 150], [2690, 185], [2640, 60], [2705, 150]]) weeds(x, y);
  // bakgatan
  overfull(1950, 32); wheelieBin(2410, 30, 'gra'); wheelieBin(2421, 30, 'bla'); overfull(2300, 32); trashBags(2500, 33);

  // =================== förorten: södra trottoaren, Betongtorget (den trasiga hållplatsen) ===================
  const CX = SC, SX = SB; // 282 / 301
  lamp(1770, CX, -1, 1); lamp(1860, CX, -1, 2); lamp(1930, CX, -1, 1); lamp(2100, CX, -1, 3); elskap(2150, CX - 1); lamp(2200, CX, -1, 1);
  lamp(2330, CX, -1, 2); deadTree(2400, CX); lamp(2470, CX, -1, 1); lamp(2560, CX, -1, 3); lamp(2640, CX, -1, 1);
  trashBags(1960, SX - 1); brokenBench(1900, SX + 1); tippedCart(2080, SX - 1); wheelieBin(2120, SX - 1, 'gra'); bin(2312, SX); brokenBench(2420, SX + 1); trashBags(2600, SX - 1);
  for (const [x, y] of [[1830, 300], [1900, 290], [2060, 296], [2180, 302], [2250, 292], [2380, 300], [2520, 296], [2690, 302]]) weeds(x, y);

  // =================== förorten: parkeringen, lekplatsen, lamellhuset, grusplanen ===================
  graffitiWall(1912, 324, 160);
  car(1850, 366, 0x3a6ad0); car(1900, 366, 0xd8d0c0); car(1955, 366, 0x8a2a2a);
  wreck(1800, 446); tippedCart(1930, 440); tires(1870, 445); ticketMachine(1985, 336); lamp(1992, 440, -1, 2);
  for (const [x, y] of [[1780, 330], [1975, 400], [1840, 420], [1990, 450]]) weeds(x, y);
  swing(2062, 378, true); slide(2136, 372, true); sandbox(2064, 428, 34, true); springRider(2100, 420, true); brokenBench(2150, 440); trashBags(2050, 448);
  for (const [x, y] of [[2040, 350], [2150, 340], [2110, 400], [2160, 420], [2080, 450]]) weeds(x, y);
  piskstallning(2188, 400); bikeRack(2350, 458); wheelieBin(2408, 440, 'gra'); wheelieBin(2419, 440, 'gron'); trashBags(2250, 458);
  // gräsremsan bakom lamellhuset: björkar (höghusgårdens träd), oklippt häck och snår
  tree('bjork', 2180, 334, false); tree('bjork', 2418, 338, false);
  wornHedge(2236, 318, 48); scrub(2290, 320); wornHedge(2350, 318, 56); scrub(2404, 312);
  scrub(2186, 452); scrub(2420, 456);
  // parkeringens kanter och hållplatsstigen
  scrub(1778, 336); scrub(2040, 322); scrub(2040, 460);
  goal(2448, 404, 1); goal(2688, 404, -1); floodlight(2438, 330, false); floodlight(2696, 330, true); brokenBench(2600, 440);
  for (const [x, y] of [[2500, 330], [2650, 340], [2460, 440], [2690, 448]]) weeds(x, y);

  // =================== förorten: södra raden (Södergatan), återvinningen, vagnsplatsen ===================
  lamp(1790, CS + 1, 1, 2); deadTree(1870, CS); lamp(1950, CS + 1, 1, 1); elskap(2010, CS - 1); lamp(2070, CS + 1, 1, 3); lamp(2150, CS + 1, 1, 1);
  lamp(2320, CS + 1, 1, 2); deadTree(2400, CS); lamp(2470, CS + 1, 1, 1); lamp(2560, CS + 1, 1, 3); lamp(2650, CS + 1, 1, 1);
  barrels(1868, FS + 1); tires(1900, FS); wheelieBin(1936, 560, 'gra'); wheelieBin(1947, 560, 'gron');
  // oljefaten stod framför garageport 3 och skymde glipan med kattögonen – nu vid kantstenen
  // (väster om trafikens parkerade moped), helt under fasadlinjen
  trashBags(1966, FS + 1); bench(2042, FS + 2); tippedCart(2100, FS); barrels(2182, CS); pallets(2262, 600);
  pallets(2430, FS + 1); overfull(2580, FS + 4);
  scrub(1940, FS + 2); scrub(2070, FS + 2); wornHedge(2462, FS + 1, 24); scrub(2620, FS + 2);
  for (const [x, y] of [[1800, 650], [1990, 668], [2120, 652], [2300, 660], [2400, 650], [2520, 668], [2620, 652], [2700, 660]]) weeds(x, y);
  igloo(2306, 560, 0x2a8a3a, 'GLAS'); igloo(2334, 556, 0xe8e4d8, 'PAPP'); igloo(2362, 560, 0x2a5aa8, 'PLÅT');
  trashBags(2320, 590); overfull(2340, 625); graffitiWall(2334, 500, 80);
  for (const [x, y] of [[2296, 530], [2370, 600], [2300, 632]]) weeds(x, y);
  clothesline(2660, 560); chair(2700, 620); grill(2702, 605); gasBottle(2638, 620); tires(2640, 596); trashBags(2700, 640);
  for (const [x, y] of [[2636, 540], [2705, 580], [2650, 636]]) weeds(x, y);
  // bortre trottoaren i förorten
  brokenBench(1800, QS); lamp(1860, QL, -1, 2); bin(1900, QS); lifebuoy(2000, QB); brokenBench(2200, QS); lamp(2300, QL, -1, 1); trashBags(2400, QS);
  lamp(2500, QL, -1, 3); brokenBench(2600, QS); lamp(2680, QL, -1, 1);
  for (let x = 1800; x < CITY.W - 10; x += 96) bollard(x, QB, true);
  for (const [x, y] of [[1950, 750], [2150, 745], [2350, 752], [2550, 746], [2650, 754]]) weeds(x, y);

  if (skipped.length) console.warn('rekvisita som inte fick plats (RESERVED/hus/annan rekvisita):', skipped.join(', '));
  // sist av allt i bilden (y ≥ 1e5 ritas alltid, inget x = sållas aldrig bort): kroken som samlar
  // det som skymmer glasståndets ljus släpps (se occMark) – väder och mörker ritas efter detta
  items.push({ y: 1e15, kind: 'ljuskrok-slut', draw: () => occStop() });

  // sittplatsen för ett klick i världen: den närmaste platsen på bänken man klickade på.
  // isFree(seat) låter scenen hoppa över upptagna platser (andra spelare, fotgängare).
  function seatAt(x, y, isFree = () => true) {
    let best = null, bd = Infinity;
    for (const s of seats) {
      const h = s.hit;
      if (x < h[0] || x >= h[2] || y < h[1] || y >= h[3] || !isFree(s)) continue;
      const d = Math.abs(s.x - x) + Math.abs(s.y - y) * 0.25;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  // närmaste lediga plats inom r px från (x, y) – för fotgängare som vill vila (life.js)
  function seatNear(x, y, r = 60, isFree = () => true) {
    let best = null, bd = r;
    for (const s of seats) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd && isFree(s)) { bd = d; best = s; } }
    return best;
  }

  return {
    items: () => items,
    obstacles,
    _skipped: skipped,
    seats: () => seats,
    seatAt,
    seatNear,
    update(dt) {
      swayT += (dt || 0) * (1 + 0.6 * windK());
      gustT -= dt;
      const wind = Math.abs(env.weather?.wind || 0) / 60;
      if (gustT <= 0) { gustT = 2 + Math.random() * 4; gustTo = Math.random() * (env.rain ? 1.8 : 0.9) + wind; }
      gust += (gustTo - gust) * Math.min(1, dt * 0.8);
    },
    glow(ctx, view) {
      occStop();                                                       // (om bildens sista föremål inte hann släppa kroken)
      unglowKiosk(ctx, env, view);                                     // före allt eget ljus (se glasståndet)
      const k = clamp((env.dark - 0.1) / 0.28, 0, 1);
      if (k <= 0) return;
      let vx, vw, vy = -1e9, vh = 2e9;
      if (view) { vx = view.x; vw = view.w; vy = view.y; vh = view.h; }
      else { const m = ctx.getTransform ? ctx.getTransform() : null, sc = m && m.a ? m.a : 1; vx = m ? -m.e / sc : 0; vw = ctx.canvas.width / sc; }
      const vis = (x, y) => x > vx - 90 && x < vx + vw + 90 && y > vy - 90 && y < vy + vh + 90;
      // flimmer: 1 = enstaka blink, 2 = trasigt lysrör som sprakar
      const flick = (f, seed) => (f === 2 ? (hash(Math.floor(env.t * 13), 2, seed) > 0.42 ? (hash(Math.floor(env.t * 31), 3, seed) > 0.2 ? 1 : 0.6) : 0.08) : f === 1 ? (hash(Math.floor(env.t * 9), 1, seed) > 0.25 ? 1 : 0.25) : 1);
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) {
        if (!vis(g.x, g.y) || (g.when && !g.when())) continue;   // when() = lyser bara ibland (glasståndets öppettid)
        ctx.globalAlpha = k * g.a * flick(g.flicker, g.x);
        if (g.occ) putLight(ctx, g.s, g.x, g.y, g.occ); else put(ctx, g.s, g.x, g.y);
      }
      if (vis(FOUNT.x, FOUNT.y) && !snowNow()) {
        ctx.globalAlpha = k * (0.85 + 0.15 * Math.sin(env.t * 2));
        put(ctx, FGLOW, FOUNT.x, FOUNT.y);
        ctx.globalAlpha = k * 0.3;
        put(ctx, fframe(), FOUNT.x, FOUNT.y);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const l of lits) {
        if (!vis(l.x, l.y) || (l.when && !l.when())) continue;
        ctx.globalAlpha = Math.min(1, k * l.a * flick(l.flicker, l.x));
        if (l.occ) putLight(ctx, l.s, l.x, l.y, l.occ); else put(ctx, l.s, l.x, l.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
