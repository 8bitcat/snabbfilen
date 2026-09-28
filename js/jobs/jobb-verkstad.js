// Bilverkstaden – byt däck och laga bilarna på lyftarna! Bilar kör in genom
// rullportarna i sidoväggarna upp på fyra lyftar, ägaren kliver ur och väntar
// vid bakänden, och en pratbubbla visar felet.
//
// DÄCKBYTET är det vanligaste jobbet och görs steg för steg, allt synligt:
//   1. HISSA – gå till lyftens manöverpanel och klicka: lyften höjer bilen.
//      Bubblan visar det platta däcket, vilket hjul (minibilen uppifrån:
//      vänster/höger, fram/bak) och vilken sorts nytt däck bilen ska ha.
//   2. SKRUVDRAGARE – hämta den på en av verktygsvagnarna.
//   3. SKRUVAR – gå till det punkterade hjulet och klicka på skruvarna (i
//      navbubblan eller på hjulet) – en i taget, var och en snurrar ut med en
//      liten mätare. Klickar man medan den snurrar slirar dragaren (fel), och
//      skruvar man på fel hjul blir det fel.
//   4. DÄCK AV – lyft av hjulet (skruvdragaren läggs på golvet) och lägg det
//      i en av staplarna för gamla hjul.
//   5. NYTT DÄCK – hämta rätt sort i däckstället: SOMMAR, VINTER, STORT
//      (pickuper) eller LITET (halvkombi). Fel sort ger fel.
//   6. SKRUVA FAST – ta skruvdragaren igen och skruva i skruvarna. Tar man
//      dem i kryssmönster (varannan) blir det bonus.
//   7. LUFT – hämta luftslangen vid kompressorn och håll inne vid hjulet tills
//      mätaren står på grönt. För mycket smäller det (PANG), för lite är fel.
//   8. SÄNK – sänk lyften vid panelen: bilen backar ut och kunden betalar.
// Omväxling: oljebyte, trasig lampa, rostigt avgasrör eller tomt batteri –
// hämta delen i hyllan och HÅLL INNE vid bilens front (eller mellanslag).
// Stegraden överst visar vad som är nästa steg för bilen man jobbar med, och
// de första gångerna pekar en hjälptext ut vart man ska gå. Väntar kunden för
// länge kör hen därifrån – utom när hjulet sitter löst, då blir hen bara arg.
//
// Allt är handritade pixlar i skala 1: verkstaden målas EN gång (Pix), bilarna
// målas per modell/färg/förare och cachas åt båda hållen, hjulen har åtta
// rotationslägen per däcksort och reservdelarna är små pixelkartor med kontur.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const FLOOR_Y = 92;            // golvet börjar (bakväggens fot)
const RUN = 70;                // lyftbanans längd
const LIFT_H = 12;             // hur högt lyften går
const POST_H = 38;             // lyftpelarnas höjd
const RAMP = 4;                // hur högt bilen står på banan (nedsänkt)
const REPAIR_T = 1.6;          // sekunder man håller inne för att laga
const PATIENCE = 32;           // kundens tålamod (s) när bilen står uppe
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Poängpuffar med samma utseende som makePops i shift.js (mörk ruta, liten
// text, stiger 14 px/s i 0,9 s) plus två saker verkstaden behöver: en puff kan
// ha en tagg – en ny puff med samma tagg ersätter den gamla, så att 'SUR!' och
// 'TRÖTTNADE!' aldrig ligger på varandra – och ett golv (minY) som puffen inte
// stiger förbi, så att bakre radens puffar stannar vid väggens fot i stället
// för att glida upp på klockan och radion. Puffarna hålls dessutom inom bild i
// sidled, eftersom ägarna väntar ända ute vid kanterna.
function makeShopPops() {
  const list = [];
  return {
    drop(tag) { for (let i = list.length - 1; i >= 0; i--) if (list[i].tag === tag) list.splice(i, 1); },
    add(x, y, txt, col, { tag = null, minY = 0 } = {}) {
      if (tag) this.drop(tag);
      const h = ((textW(SMALL, txt) + 4) >> 1) + 1;
      list.push({ x: clamp(Math.round(x), h, FW - h), y, txt, col, tag, minY, age: 0 });
    },
    update(dt) {
      for (const p of list) { p.age += dt; p.y = Math.max(p.minY, p.y - 14 * dt); }
      for (let i = list.length - 1; i >= 0; i--) if (list[i].age > 0.9) list.splice(i, 1);
    },
    draw(ctx) {
      for (const p of list) {
        const w = textW(SMALL, p.txt) + 4, x = (p.x - w / 2) | 0, y = p.y | 0;
        ctx.fillStyle = 'rgba(23,21,26,0.7)'; ctx.fillRect(x, y, w, 9);
        ctxText(ctx, SMALL, p.txt, x + 2, y + 2, p.col);
      }
    },
    list: () => list.map((p) => ({ x: p.x, y: Math.round(p.y), txt: p.txt, tag: p.tag })),
  };
}

// ---------- reservdelarna ----------
const PART_NAMES = ['DÄCK', 'OLJA', 'LAMPOR', 'AVGAS', 'BATTERI'];
const PART_IDS = ['dack', 'olja', 'lampa', 'avgas', 'batteri'];
const PARTS = [
  { // däck (sidovy, fälg och nav)
    pal: { T: 0x26262e, t: 0x4a4a54, L: 0x6a6a74, R: 0xc4cad2, r: 0x8a909a, H: 0xeef2f6, h: 0x5a5e66 },
    map: [
      '....TTTTTT....',
      '..TTLtTTtTTT..',
      '.TLtTTTTTTtTT.',
      '.TtTTRRRRTTtT.',
      'TLTTRrRRrRTTtT',
      'TtTRrRHHRrRTTT',
      'TTTRRHhhHRRTtT',
      'TtTRRHhhHRRTTT',
      'TTTRrRHHRrRTtT',
      'TtTTRrRRrRTTTT',
      '.TTtTRRRRTtTT.',
      '.TTTTTTTTTTTT.',
      '..TTTtTTtTTT..',
      '....TTTTTT....',
    ] },
  { // oljedunk (gul, röd pip)
    pal: { Y: 0xf2c230, y: 0xffe27a, o: 0xb8861a, O: 0x8a5e10, W: 0xf8f4ea, b: 0x2f5fa8, k: 0x2a2b30, K: 0x55575f, S: 0xd8342a, s: 0xff7a5a },
    map: [
      '..kkkkk...',
      '.kK...k.Ss',
      '.kk...kSS.',
      'yYYYYYYYo.',
      'yyyyyyyYoO',
      'yWWWWWWYoO',
      'yWbbbbWYoO',
      'yWbWWbWYoO',
      'yWWWWWWYoO',
      'yYYYYYYYoO',
      'YYYYYYYYoO',
      '.OOOOOOOO.',
    ] },
  { // glödlampa
    pal: { g: 0xd8b24a, G: 0xfff4c0, w: 0xffffff, f: 0xe07a1a, M: 0xd0d4dc, m: 0x8a8e96, d: 0x3a3c44 },
    map: [
      '..gggg..',
      '.gGGGGg.',
      'gGwwGGGg',
      'gGwGGGGg',
      'gGGfGfGg',
      'gGGffGGg',
      '.gGfGfg.',
      '..gGGg..',
      '..MMmm..',
      '..mMMm..',
      '..MMmm..',
      '...dd...',
    ] },
  { // avgasrör med ljuddämpare
    pal: { o: 0x55595f, H: 0xeef2f6, M: 0xb4bac4, m: 0x7a808a, p: 0xdce0e8, P: 0x9aa0aa, q: 0x5a5e66, T: 0x2a2b30 },
    map: [
      '.....oooooooo...',
      '....oHHHHHHHMo..',
      'ppppoMMMMMMMMoppT',
      'PPPPoMMMMMMMmoPPT',
      'qqqqommmmmmmmoqqT',
      '....ommmmmmmmo...',
      '.....oooooooo...',
    ] },
  { // bilbatteri
    pal: { n: 0x8a8e96, N: 0x3a3c44, p: 0xff8a6a, P: 0xc8322a, t: 0x5a5e68, T: 0x3a3d46, B: 0x17181d, b: 0x2c2e36, Y: 0xf0c428, k: 0x17181d, r: 0xd8342a },
    map: [
      '.nn......pp.',
      '.NN......PP.',
      'tttttttttttt',
      'TTTTTTTTTTTT',
      'BbbbbbbbbbbB',
      'BbYYYYYYYYbB',
      'BbYkkYYrYYbB',
      'BbYYYYrrrYbB',
      'BbYYYYYrYYbB',
      'BbbbbbbbbbbB',
      'BBBBBBBBBBBB',
    ] },
];

const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function pixelsToCanvas(grid, w, h) {
  const c = newCanvas(w, h), x2 = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = grid[y * w + x];
    if (v === -1) continue;
    x2.fillStyle = typeof v === 'string' ? v : css(v);
    x2.fillRect(x, y, 1, 1);
  }
  return c;
}
// pixelkarta → canvas med 1 px mörk kontur (tonad efter grannpixeln)
function mapSprite(map, pal) {
  const w = Math.max(...map.map((r) => r.length)) + 2, h = map.length + 2;
  const g = new Array(w * h).fill(-1);
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]] !== undefined) g[(y + 1) * w + x + 1] = pal[row[x]]; });
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
  return pixelsToCanvas(g, w, h);
}
const PSPR = [];
const partSprite = (p) => (PSPR[p] ||= mapSprite(PARTS[p].map, PARTS[p].pal));

// Pratbubbla med rundade hörn och spets nedåt i (cx, tip). Innerytan är iw×ih;
// returnerar innerytans övre vänstra hörn.
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

// ======================================================================
// Bilarna (sidovy) – samma ritteknik som stadens trafik: en regionmask per
// kaross, skuggning i 3–4 toner, rutor med reflexer, mörk kontur och små
// detaljer. x från bakänden (0) till fronten (L-1) för en bil vänd åt höger,
// h = höjd över marken (0 = hjulens nedersta rad).
// ======================================================================
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
    L: 50, D: 3, r: 4, wheels: [10, 39], rim: 'alloy',
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
  kombi: {
    L: 58, D: 3, r: 5, wheels: [12, 46], rim: 'steel',
    top: [[0, 9], [1, 18], [2, 20], [4, 21], [33, 21], [36, 20], [43, 14], [53, 13], [56, 11], [57, 8]],
    bot: [[0, 5], [2, 3], [55, 3], [57, 5]],
    cab: [1, 43], belt: 14, roof: [4, 34], ws: [35, 43], rw: [0, 3],
    pillars: [[1, 6], [16, 17], [28, 29]],
    bump: { h0: 3, h1: 7, rear: 3, front: 3 },
    head: { x: 55, h0: 9, h1: 10 }, tail: { w: 2, h0: 9, h1: 15 },
    seams: [17, 29, 43], handles: [[20, 11], [32, 11]], mirror: { x: 40, h: 15 },
    crease: 9, heads: [{ x: 33, kind: 'driver' }, { x: 21, kind: 'back' }],
    rails: true, fuel: { x: 7, h: 12 }, extraTop: 2,
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
};
SPECS.taxi = { ...SPECS.sedan, taxi: true, extraTop: 8 };

const PAINT = [0xc23a32, 0x2f6db5, 0xc3c8d0, 0xe9e9eb, 0x2b2e36, 0x3f8a55, 0xd99a2b, 0x2a9d9a, 0x7a2e3e, 0x5e7b99, 0xe57a2e, 0x6b4f8f];
const COLORS = {
  sedan: PAINT, halvkombi: PAINT, kombi: PAINT, taxi: [0xf2c230],
  pickup: [0x3d6b45, 0xa83232, 0x2c4a7a, 0xd9b44a, 0x8a8f96],
};
const KINDS = [['sedan', 32], ['halvkombi', 28], ['kombi', 16], ['pickup', 14], ['taxi', 10]];
const SKINS = [0xf6d7bf, 0xeec3a0, 0xe0a97f, 0xc68a5c, 0xa06a43, 0x744a2d];
const HAIRS = [0x1d1714, 0x3b2619, 0x6b4226, 0xa5692f, 0xd9a95c, 0xb9b3ab, 0xb7392b];
const SHIRTS = [0xd9433b, 0x3a7bd5, 0x46a35a, 0xf0b429, 0x8e5bd1, 0x2f3440, 0xe8e3d6, 0x2aa39a];

const BODY = 1, GLASS = 2, FRAME = 3, BUMP = 4, ARCH = 5, TOPB = 6, TOPR = 7, TOPG = 8, TRIM = 9, BED = 10;

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

function paintCar(kind, color, variant, driver) {
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
  for (let x = 0; x < L; x++) for (let h = s.belt + 1; h <= ht[x] - 1; h++) {
    if (!cabAt(x, h)) continue;
    if (pillar(x)) set(x, h, TRIM);
    else if (cabAt(x - 1, h) && cabAt(x + 1, h) && cabAt(x, h + 1)) set(x, h, GLASS);
  }
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
    if ((r === BODY || r === BUMP) && Math.hypot(x - wx, h - s.r) <= ra) set(x, h, ARCH);
  }

  // ---------- målning ----------
  const P = new Pix(W, H);
  const put = (x, h, c, a = 1) => P.px(x + 1, gy - h, c, a);
  const cur = (x, h) => P.get(x + 1, gy - h);
  const nz = (x, h) => bayer(x + 1, gy - h) - 0.5;
  const c = color;
  const R = { hi: mix(c, 0xffffff, 0.55), lt: mix(c, 0xffffff, 0.24), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
  const near = (x) => s.wheels.reduce((a, w) => (Math.abs(w - x) < Math.abs(a - x) ? w : a));
  // mörkret under bilen (ingen markskugga – bilen står på en lyftbana)
  for (let x = 0; x < L; x++) {
    const e = Math.min(x, L - 1 - x);
    for (let h = 1; h < hb[x]; h++) if (!get(x, h)) put(x, h, 0x0e0e12, e < 2 ? 0.45 : 0.82);
  }
  for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const n = nz(x, h);
    let col = c;
    if (r === BODY || r === BUMP) {
      const topE = inCab(x) ? s.belt : ht[x], bot = hb[x];
      if (inCab(x) && h === s.belt) col = 0x26272c;                                   // fönsterlist
      else if (h === topE || (inCab(x) && h === s.belt - 1)) col = R.hi;             // skuldran fångar ljuset
      else if (h === topE - 1 && !inCab(x)) col = R.lt;
      else if (h === s.crease) col = mix(R.lt, R.hi, 0.35);                          // karaktärslinjen
      else if (h === s.crease - 1) col = R.dk;
      else if (h > s.crease) {
        const t = (h - s.crease) / Math.max(1, topE - s.crease);
        col = mix(mix(R.c, R.lt, t * 0.7 + n * 0.35), 0xfff4e0, 0.05 + t * 0.06);   // lysrören speglas uppe
      } else {
        const t = (s.crease - 1 - h) / Math.max(1, s.crease - 1 - bot);
        col = mix(mix(R.md, R.dd, t * 0.85 + n * 0.3), 0x3a3830, t * 0.12);          // golvet speglas nere
      }
      if (h === bot) col = R.dd;
      if ((x + (h >> 1)) % 41 < 2 && h > s.crease && h < topE - 1) col = mix(col, 0xffffff, 0.16);
      if (hash(x, h, 7) > 0.95) col = mul(col, 1.06);
      if (r === BUMP) {
        if (bump.chrome) col = h >= bump.h1 - 1 ? 0xf2f4f8 : h > bump.h0 + 1 ? mix(0xc4c8d0, 0x8a8e96, n + 0.5) : 0x5a5e66;
        else col = h <= bump.h0 + 1 ? 0x26272c : mul(col, 0.94);
      }
    } else if (r === FRAME) {
      const lt = mix(c, 0xffffff, 0.25);
      col = h === ht[x] ? mix(c, 0xffffff, 0.5) : mix(c, lt, 0.45 + n * 0.3);
    } else if (r === GLASS) {
      const gtop = ht[x] - 1, gb = s.belt + 1;
      const t = (h - gb) / Math.max(1, gtop - gb);
      col = mix(0x5a7792, 0x1c2633, t * 0.9 + n * 0.25);
      const st = (((x - h) % 23) + 23) % 23;
      if (st < 2) col = mix(col, 0xe6f2ff, 0.42); else if (st === 2 || st === 5) col = mix(col, 0xe6f2ff, 0.16);
      if (h === gtop) col = mul(col, 0.7);
    } else if (r === TRIM) {
      col = mix(0x18191e, 0x2a2b31, n + 0.5);
    } else if (r === TOPR) {
      const k = h - ht[x];
      col = mix(c, 0xffffff, k === 1 ? 0.46 : 0.3 - 0.05 * k + n * 0.1);
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

  // ---------- föraren bakom rutan (tom stol när hen klivit ur) ----------
  const onGlass = (x, h) => get(x, h) === GLASS;
  function figure(pat, x0, hTop, pal, tint = 0.3) {
    pat.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i], x = x0 + i, h = hTop - j;
        if (ch === '.' || !onGlass(x, h)) continue;
        put(x, h, mix(pal[ch], cur(x, h), tint));
      }
    });
  }
  const person = (x0, hTop, k) => {
    const skin = SKINS[Math.floor(rnd(k) * SKINS.length)], hair = HAIRS[Math.floor(rnd(k + 1) * HAIRS.length)];
    const shirt = SHIRTS[Math.floor(rnd(k + 2) * SHIRTS.length)];
    figure(HEAD, x0, hTop, { h: hair, s: skin, t: shirt });
  };
  const seatTop = s.belt + 7;
  for (const [i, hd] of (s.heads || []).entries()) {
    if (hd.kind === 'driver' && driver) person(hd.x, seatTop, 10 + i * 5);
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
  for (const sx of s.seams || []) {
    const top = inCab(sx) ? s.belt - 1 : ht[sx] - 2;
    for (let h = hb[sx] + 1; h <= top; h++) {
      if (get(sx, h) !== BODY) continue;
      put(sx, h, mul(cur(sx, h), 0.6));
      if (get(sx + 1, h) === BODY) put(sx + 1, h, mix(cur(sx + 1, h), 0xffffff, 0.12));
    }
  }
  for (const [hx, hh] of s.handles || []) {
    for (let i = 0; i < 3; i++) { put(hx + i, hh, 0xe6e9ee); put(hx + i, hh - 1, 0x2e3036); }
    put(hx + 3, hh, mul(c, 0.55));
  }
  if (s.mirror) {
    const { x: mx, h: mh } = s.mirror, mh1 = 2;
    for (let j = 0; j <= mh1; j++) for (let i = 0; i < 3; i++) {
      const edge = i === 2 || j === 0;
      put(mx + i, mh + j, j === mh1 ? R.hi : edge ? R.dd : j === mh1 - 1 ? R.lt : R.c);
    }
    put(mx + 1, mh - 1, 0x1c1d22);
  }
  // strålkastare fram (pixlarna sparas – en trasig lampa målas över dem)
  const hd = s.head, headPx = [];
  for (let x = hd.x; x < L; x++) for (let h = hd.h0; h <= hd.h1; h++) {
    if (!get(x, h)) continue;
    put(x, h, h === hd.h1 ? 0xffffff : x === L - 1 ? 0xd8dde6 : 0xfff3c8);
    headPx.push([x, h]);
  }
  for (let h = hd.h0; h <= hd.h1; h++) if (get(hd.x - 1, h)) put(hd.x - 1, h, 0x3a3c44);
  for (let x = hd.x; x < L; x++) if (get(x, hd.h0 - 1)) put(x, hd.h0 - 1, 0xf0a030);
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
  if (s.fuel) {
    const { x: fx, h: fh } = s.fuel;
    for (let i = 0; i < 3; i++) { put(fx + i, fh, mul(cur(fx + i, fh), 0.7)); put(fx + i, fh - 2, mul(cur(fx + i, fh - 2), 0.7)); }
    put(fx, fh - 1, mul(cur(fx, fh - 1), 0.7)); put(fx + 2, fh - 1, mul(cur(fx + 2, fh - 1), 0.7));
  }
  if (s.antenna !== undefined) {
    const ax = s.antenna, a0 = ht[ax] + D;
    put(ax, a0 + 1, 0x1c1d22); put(ax - 1, a0 + 2, 0x2a2b30); put(ax - 1, a0 + 3, 0x3a3b41);
  }
  if (s.rails) {
    for (let x = s.roof[0] + 2; x <= s.roof[1] - 2; x++) {
      const h = ht[x] + D + 1;
      put(x, h, x % 3 === 0 ? 0x55575f : 0x2a2b31);
      if (x === s.roof[0] + 2 || x === s.roof[1] - 2 || x % 7 === 0) put(x, h - 1, 0x1c1d22);
    }
  }
  const box = (x0, h0, w, hh, fill) => { for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) put(x0 + i, h0 + j, fill(i, j)); };
  if (s.taxi) {
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
    } else if (v === 1) { // gamla däck på flaket
      box(4, 17, 14, 4, (i, j) => (i === 0 || i === 13 ? 0x16161b : j === 3 ? 0x4c4c56 : j === 0 ? 0x1c1c22 : (i + j) % 3 === 0 ? 0x3e3e48 : 0x2a2a32));
      box(5, 21, 12, 1, (i) => (i > 3 && i < 8 ? 0x101014 : 0x3a3a44));
    } else { // verktygslåda
      box(8, 17, 8, 4, (i, j) => (i === 0 || i === 7 || j === 0 ? 0x5a1414 : j === 3 ? 0xf06a5a : 0xc8322a));
      box(10, 21, 4, 1, () => 0x2a2b30);
    }
  }
  // ---------- bromsljusen (läggs över när bilen bromsar) ----------
  const O = new Pix(W, H);
  for (let x = 0; x < tl.w; x++) for (let h = tl.h0; h <= tl.h1; h++) if (get(x, h)) O.px(x + 1, gy - h, h === tl.h1 ? 0xffb0a0 : 0xff3a2a);

  // ---------- spegla och skriv text (text speglas aldrig) ----------
  const Q = mirrored(P), OQ = mirrored(O);
  if (s.taxi) for (const [T0, flip] of [[P, false], [Q, true]]) {
    const w = textW(SMALL, 'TAXI'), x = flip ? W - 20 - w : 20, y = gy - 29;
    text(T0, SMALL, 'TAXI', x, y, 0x2a2014);
  }
  // översta färgade raden (för pratbubblans plats)
  let topRow = 0;
  outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P.d[(y * W + x) * 4 + 3] > 0) { topRow = y; break outer; }
  return {
    W, H, gy, ht, hb, topH: gy - topRow, headPx, eh,
    img: [P.flush(), Q.flush()], brake: [O.flush(), OQ.flush()],
  };
}
const VCACHE = {};
function carArt(c) {
  const key = c.kind + ':' + c.color + ':' + c.variant + ':' + (c.driver ? 1 : 0);
  return VCACHE[key] || (VCACHE[key] = paintCar(c.kind, c.color, c.variant, c.driver));
}

// ---------- hjulen: åtta rotationslägen per fälgtyp + ett punkterat ----------
const NF = 8;
const RIMN = { alloy: 5, steel: 6 };
function wheelPixel(style, n, rot, r, rimR, dx, dy, lit) {
  const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  if (d > rimR + 0.45) {
    let k = d > r - 0.5 ? 0x121215 : d < rimR + 1.4 ? 0x2b2b31 : 0x1c1c21;
    if (d > r - 1.3 && Math.cos(2 * n * (a - rot)) > 0.55) k = mix(k, 0x3a3a42, 0.5);
    if (lit > 0.42 && d > r - 1.6) k = 0x46464e;
    return k;
  }
  if (d > rimR - 0.6) return lit > 0.1 ? 0xe4e8ee : lit < -0.2 ? 0x7a7e86 : 0xb0b4bc;
  if (style === 'alloy') {
    const spoke = Math.cos(n * (a - rot)) > 0.2;
    return d < 0.8 ? 0x4a4e56 : d < 1.3 ? 0x8a8e96 : spoke ? mix(0xd2d6de, 0x8a9098, 0.5 - lit) : 0x26282e;
  }
  let k = mix(0x8c9098, 0x60646c, 0.5 - lit);
  if (Math.abs(d - rimR * 0.62) < 0.75 && Math.cos(n * (a - rot)) > 0.55) k = 0x24262a;
  if (d < 1.2) k = 0xd4d8de;
  if (d < 0.5) k = 0x8a8e96;
  return k;
}
// kind: däcksorten – vinterdäck har dubbar i slitbanan, stora däck grova klackar
function paintWheel(r, style, f, kind = 'sommar') {
  const n = RIMN[style], rot = (f / NF) * ((Math.PI * 2) / n);
  const S = 2 * r + 1, P = new Pix(S, S), rimR = r - 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - r, dy = j - r, d = Math.hypot(dx, dy);
    if (d > r + 0.4) continue;
    if (kind === 'stort' && d > r - 0.6 && Math.cos(12 * (Math.atan2(dy, dx) - rot)) < -0.25) continue;
    P.px(i, j, wheelPixel(style, n, rot, r, rimR, dx, dy, -(dx + dy) / (2 * r)));
  }
  if (kind === 'vinter') for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + rot + 0.3;
    P.px(r + Math.round(Math.cos(a) * (r - 0.8)), r + Math.round(Math.sin(a) * (r - 0.8)), k & 1 ? 0xb4bac4 : 0xe4e8ee);
  }
  return P.flush();
}
// punkterat däck: fälgen har sjunkit, gummit buktar ut mot golvet
// (bilden är 4 px bredare än ett helt hjul: ritas 2 px till vänster om hjulets ruta)
function paintFlat(r, style) {
  const n = RIMN[style], S = 2 * r + 1, W = S + 4, P = new Pix(W, S), rimR = r - 2;
  const cx = r + 2, cy = r + 1;
  for (let j = 0; j < S; j++) for (let i = 0; i < W; i++) {
    const dx = i - cx, dy = j - cy;
    // övre halvan: nästan rund men en pixel lägre; nedre: bred, platt bula
    const rx = dy > 0 ? r + 2.2 : r + 0.4, ry = dy > 0 ? r - 0.6 : r + 0.4;
    const e = Math.hypot(dx / rx, dy / ry);
    const flatRow = j === S - 1 && Math.abs(dx) <= r + 1;
    if (e > 1.02 && !flatRow) continue;
    const d = Math.hypot(dx, dy);
    let k = wheelPixel(style, n, 0.3, r, rimR, dx, dy, -(dx + dy) / (2 * r));
    if (d > rimR + 0.45) {
      k = e > 0.84 || flatRow ? 0x121215 : dy > 0 && Math.abs(dx) > 2 ? 0x2b2b31 : 0x1c1c21;
      if (dy > 0 && Math.abs(dx) > r - 1 && e < 0.93) k = 0x50505a;                 // bukten glänser
      if (dy === 0 && Math.abs(dx) > r - 1 && e < 0.93) k = 0x34343c;
    }
    P.px(i, j, k);
  }
  // en spik i slitbanan
  P.px(cx + r - 1, cy - 3, 0xdce0e8); P.px(cx + r - 2, cy - 3, 0x8a8e96);
  return P.flush();
}
const WCACHE = {};
const wheelArt = (r, style, f, kind = 'sommar') => { const k = r + style + f + kind; return WCACHE[k] || (WCACHE[k] = paintWheel(r, style, f, kind)); };
const flatArt = (r, style) => { const k = 'F' + r + style; return WCACHE[k] || (WCACHE[k] = paintFlat(r, style)); };

// ---------- däcksorterna ----------
// Sommar- och vinterdäck sitter på vanliga bilar, STORT på pickuper och LITET
// på halvkombin – samma storlek som hjulen på bilen (radie 5, 6 och 4).
const TIRE_KINDS = ['sommar', 'vinter', 'stort', 'litet'];
const TIRE_TXT = { sommar: 'SOMMAR', vinter: 'VINTER', stort: 'STORT', litet: 'LITET' };
const TIRE_COL = { sommar: '#d8641a', vinter: '#2f6db5', stort: '#8a3a2a', litet: '#2e8a48' };
const TIRE_R = { sommar: 5, vinter: 5, stort: 6, litet: 4 };
const TIRE_RIM = { sommar: 'alloy', vinter: 'steel', stort: 'steel', litet: 'steel' };
const tireKindFor = (kind) => (kind === 'pickup' ? 'stort' : kind === 'halvkombi' ? 'litet' : Math.random() < 0.5 ? 'sommar' : 'vinter');
const kindWheel = (kind, f = 0) => wheelArt(TIRE_R[kind], TIRE_RIM[kind], f, kind);
const kindFlat = (kind) => flatArt(TIRE_R[kind], TIRE_RIM[kind]);
// skruvarnas radie på navet (i spelpixlar) för en hjulradie
const boltR = (r) => (r <= 4 ? 1.7 : r === 5 ? 2.2 : 2.7);
const boltPos = (r, n, k) => { const a = -Math.PI / 2 + k * Math.PI * 2 / n, br = boltR(r); return [Math.round(Math.cos(a) * br), Math.round(Math.sin(a) * br)]; };
// navet när hjulet är av: bromsskiva med borrade hål, navet med skruvhålen och
// ett rött bromsok upptill
function hubCarImg(r, n) {
  const key = 'hub' + r + ':' + n;
  if (WCACHE[key]) return WCACHE[key];
  const S = 2 * r + 1, P = new Pix(S, S), R = r - 1.1;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - r, dy = j - r, d = Math.hypot(dx, dy);
    if (d > R + 0.35) continue;
    const lit = -(dx + dy) / (2 * r) + 0.5;
    let c = d > R - 0.7 ? 0x55595f : d > 1.8 ? mix(0x8a8e96, 0xd0d4dc, lit) : mix(0x3a3c44, 0x6a6e78, lit);
    if (d > 2.4 && d < R - 0.9 && hash(i, j, r) > 0.8) c = mul(c, 0.8);                  // borrade hål i skivan
    P.px(i, j, c);
  }
  for (let k = 0; k < n; k++) { const [bx, by] = boltPos(r, n, k); P.px(r + bx, r + by, 0x121216); }
  P.px(r, r, 0x9aa0aa);
  // bromsoket
  const ox = r - Math.round(R * 0.75), oy = r - Math.round(R * 0.85);
  P.rect(ox, oy, 2, 3, 0xc8322a); P.px(ox, oy, 0xff7a6a); P.px(ox + 1, oy + 2, 0x7a1a14);
  return (WCACHE[key] = P.flush());
}

// ======================================================================
// Verkstadens planlösning
// ======================================================================
// Fyra lyftar: två i bakre raden, två i främre. Vänstra bilarna kör in genom
// portarna i vänstra väggen (fronten inåt), högra genom de högra. Mekanikern
// jobbar vid hjulen eller fronten, ägaren väntar vid bakänden. Raderna står
// 82 px isär så att främre radens pratbubblor (bil uppe + taxiskylt + bubbla)
// aldrig hamnar över den bakre radens lyftar och gula linjer.
const BAYS = [
  { lx: 26, base: 124, face: 0 },
  { lx: 288, base: 124, face: 1 },
  { lx: 26, base: 206, face: 0 },
  { lx: 288, base: 206, face: 1 },
].map((b, i) => ({ ...b, i, lift: 0, moving: 0, port: 0, hum: 0, press: 0, pressUp: true,
  spotX: b.face ? b.lx - 12 : b.lx + RUN + 12, spotY: b.base + 1,   // arbetsplatsen vid fronten
  rearX: b.face ? b.lx + RUN + 12 : b.lx - 12,                        // … och vid bakänden (avgasröret)
  ownX: b.face ? 372 : 12, ownY: b.base + 3,                          // ägaren väntar vid bakänden …
  frontOwnX: b.face ? b.lx - 28 : b.lx + RUN + 28,                    // … eller framför när avgasröret lagas
  panelX: b.face ? b.lx - 11 : b.lx + RUN + 5, panelY: b.base - 25 })); // manöverpanelen på den inre pelaren
// bakväggen: däckstället (2×2 fack) och fyra reservdelshyllor (olja, lampor, avgas, batteri)
const RACK = { x0: 104, x1: 160, y0: 46, mid: 70, y1: 96 };
const SLOTS = [
  { kind: 'sommar', x: 118, row: 0 }, { kind: 'vinter', x: 146, row: 0 },
  { kind: 'stort', x: 118, row: 1 }, { kind: 'litet', x: 146, row: 1 },
];
const PART_X = [0, 184, 212, 240, 266];
// var stationerna målas på bakväggen: [0] är däckställets mitt, resten = PART_X
const STATIONS = [132, ...PART_X.slice(1)];
const PICK_Y = 102;
const CARTS = [{ x: 150, y: 170, kind: 0 }, { x: 236, y: 193, kind: 1 }];
// staplarna för gamla hjul, domkraften och arbetslampan står i mittpartierna med
// foten på PROP_FOOT så att främre radens ägarpuffar får plats nedanför dem
const PROP_FOOT = 148;
const PILE_XS = [22, 360];
const PILE_MAX = 7;
const COMP = { x: 192, y: 150 };          // kompressorn med luftslangen (mitt i hallen)
const HOSE_OUT = { x: COMP.x + 13, y: COMP.y - 9 };
const JACK = { x: 112, y: 152 };
const LAMP = { x: 262, y: 150 };
const STRIP = { x: 226, y: 158 };         // grenuttaget på golvet
const TUBES = [48, 120, 264, 336];        // lysrören (det sista flimrar)
const CLOCK = { x: 320, y: 39 };
const RADIO = { x: 334, y: 40 };
// luften: mätaren går 0 → 1 (3,2 bar); grönt mellan GREEN_LO och GREEN_HI, vid 1 smäller det
const GREEN_LO = 0.66, GREEN_HI = 0.84, AIR_RATE = 0.42, PULSE_T = 0.28;
const SPIN_T = 0.42;                      // en skruv snurrar ut/in på så här många sekunder
const PATIENCE_TIRE = 46;                 // däckbyten tar längre tid – kunden vet det
const STEPS = ['HISSA', 'SKRUVDRAGARE', 'SKRUVAR', 'DÄCK AV', 'NYTT DÄCK', 'SKRUVA FAST', 'LUFT', 'SÄNK'];
const STEPS_PART = ['HISSA', 'HÄMTA DEL', 'LAGA', 'SÄNK'];
const TIPS_KEY = 'snabbfilen_verkstad_tips';
function loadTips() { try { const o = JSON.parse(localStorage.getItem(TIPS_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
function saveTips(o) { try { localStorage.setItem(TIPS_KEY, JSON.stringify(o)); } catch { /* privat läge */ } }
const foldName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function makeJobbVerkstad(A, { onDone } = {}) {
  const stats = { ok: 0, fel: 0, miss: 0, dack: 0, kryss: 0 };
  const walker = createWalker({ top: 100, bottom: FH - 4, spawn: [164, 120] });
  const piles = PILE_XS.map((x, i) => ({ i, x, y: PROP_FOOT, n: 3 }));
  walker.setObstacles([
    ...BAYS.map((b) => [b.lx - 5, b.base - 7, b.lx + RUN + 4, b.base + 1]),
    ...CARTS.map((k) => [k.x - 12, k.y - 6, k.x + 12, k.y + 1]),
    [LAMP.x - 6, LAMP.y - 4, LAMP.x + 6, LAMP.y + 1],
    [JACK.x - 12, JACK.y - 5, JACK.x + 17, JACK.y + 1],
    [COMP.x - 16, COMP.y - 6, COMP.x + 16, COMP.y + 1],
    ...piles.map((p) => [p.x - 12, p.y - 5, p.x + 12, p.y + 1]),
  ]);
  for (const b of BAYS) Object.assign(b, { lift: 0, moving: 0, port: 0, hum: 0, press: 0 });
  const pops = makeShopPops();
  let cars = [], fx = [], notes = [], t = 0, seq = 0, carIn = 0.8, carry = null;
  let done = false, doneT = 0, reported = false;
  const hold = { on: false, bay: -1, wheel: -1 };
  let keyHold = 0, working = null, workTick = 0, noteIn = 1.2, hintCool = 0, lastTip = '';
  let focus = -1, pulse = 0, pulseCar = null, airing = null, spinTick = 0, hissTick = 0;
  let compRun = 0, compIn = 7, compPh = 0, shake = 0, stowIn = 0, hoseCar = null;
  const hoseBack = { t: 0, x: 0, y: 0 };
  // skruvdragarna: en på varje verktygsvagn; de kan också ligga på golvet eller bäras
  const wrenches = CARTS.map((k, i) => ({ id: i, at: 'cart', cart: i, x: 0, y: 0 }));
  const tips = loadTips();
  const startMin = Number.isFinite(A.game?.min) ? A.game.min : 8 * 60;
  let bgc = null;
  const bg = () => (bgc ||= paintShop());

  const carOf = (b) => cars.find((c) => c.bay === b) || null;
  const carGY = (c) => c.bay.base - 1 - c.rise - Math.round(c.bay.lift);   // raden där hjulen möter banan
  const sx = (c, q) => Math.round(c.x) + (c.face ? c.L - 1 - q : q);       // skärm-x för bilens kolumn q
  const addFx = (x, y, vx, vy, g, life, col, s = 1, fade = true) => fx.push({ x, y, vx, vy, g, life, max: life, col, s, fade });
  const hasWrench = () => !!carry && carry.wrench !== undefined;
  const hasHose = () => !!carry && !!carry.hose;
  const wheelX = (c, i) => sx(c, c.spec.wheels[i]);
  const wheelCY = (c) => carGY(c) - c.spec.r;
  const sideTxt = (c) => (c.face ? 'VÄNSTER' : 'HÖGER');                  // bilen vänd åt höger visar sin högra sida
  const posTxt = (c) => sideTxt(c) + ' ' + (c.tj && c.tj.wheel ? 'FRAM' : 'BAK');
  const learn = (k) => { tips[k] = (tips[k] || 0) + 1; saveTips(tips); };
  const needTip = (k) => (tips[k] || 0) < 2;

  function pickKind() {
    let r = Math.random() * KINDS.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of KINDS) if ((r -= w) < 0) return k;
    return 'sedan';
  }
  function tireJob(c) {
    const n = c.kind === 'halvkombi' ? 4 : 5;
    return { wheel: Math.random() < 0.55 ? 1 : 0, want: c.tk, n, bolts: new Array(n).fill(true), tire: 'flat', mounted: null,
      air: 0, aired: false, spin: null, queued: null, last: -1, order: [], slip: false, lowFel: false, wrongT: -9, late: false, bang: 0 };
  }
  function makeCar(b, fault, kindWish) {
    const kind = kindWish && SPECS[kindWish] ? kindWish : pickKind(), s = SPECS[kind], pal = COLORS[kind];
    const parkX = b.lx + ((RUN - s.L) >> 1);
    const pm = fault === 0 ? PATIENCE_TIRE : PATIENCE;
    const c = {
      id: seq++, bay: b, kind, spec: s, L: s.L, face: b.face, tk: tireKindFor(kind),
      color: pal[(Math.random() * pal.length) | 0], variant: (Math.random() * 3) | 0,
      fault, parkX, x: b.face ? FW + 6 : -s.L - 6, v: 0, dist: 0, rise: 0, brake: false, delay: 0.7,
      state: 'drive', prog: 0, patience: pm, pmax: pm, fixed: false, gaveUp: false, lastWork: -9, nag: 0,
      honk: 0, flash: 0, wait: 0, driver: true, puddle: 0, drip: null, dripIn: 0.6, smokeIn: 0, sparkIn: 1,
      owner: { look: makeLook(), x: 0, y: 0, dir: 'down', show: false, walk: false, angry: 0, happy: 0 },
    };
    c.tj = fault === 0 ? tireJob(c) : null;
    return c;
  }
  function doorX(c) { const d = c.spec.heads.find((h) => h.kind === 'driver'); return sx(c, d.x + 2); }
  // var mekanikern står för de gamla felen: vid fronten, utom avgasröret som lagas vid bakänden
  function spotOf(b) { const c = carOf(b); return { x: c && c.fault === 3 ? b.rearX : b.spotX, y: b.spotY }; }
  function ownerSpot(c) { return { x: c.fault === 3 ? c.bay.frontOwnX : c.bay.ownX, y: c.bay.ownY }; }
  const faceCar = (b, x) => (x < b.lx + RUN / 2 ? 'right' : 'left');
  function freeBays() { return BAYS.filter((b) => !carOf(b)); }
  // Arbetsplatserna. Vid ett hjul står man snett utanför det (mot bilens ände)
  // så att hjulet syns bredvid figuren; vid panelen lite utanför fronten.
  function wheelSpot(c, i) {
    const out = (i === 1 ? 1 : -1) * (c.face ? -1 : 1);
    return { x: Math.round(wheelX(c, i) + out * 10), y: Math.min(c.bay.base + 6, FH - 6), dir: out > 0 ? 'left' : 'right' };
  }
  const panelSpot = (b) => ({ x: b.face ? b.spotX - 3 : b.spotX + 3, y: b.spotY + 2, dir: b.face ? 'right' : 'left' });
  const slotSpot = (sl) => ({ x: sl.x, y: PICK_Y, dir: 'up' });
  const partSpot = (p) => ({ x: PART_X[p], y: PICK_Y, dir: 'up' });
  const cartSpot = (ci) => ({ x: CARTS[ci].x, y: CARTS[ci].y + 7, dir: 'up' });
  const pileSpot = (p) => ({ x: p.x, y: p.y + 7, dir: 'up' });
  const compSpot = () => ({ x: COMP.x, y: COMP.y + 7, dir: 'up' });
  const nearSpot = (s, d = 7) => !walker.path.length && Math.hypot(walker.px - s.x, walker.py - s.y) < d;
  const atWheel = (c, i) => nearSpot(wheelSpot(c, i));
  function go(s, cb) { walker.walkTo(s.x, s.y, () => { if (s.dir) walker.dir = s.dir; cb?.(); }); }
  // närmaste skruvdragare man kan ta (på en vagn eller på golvet)
  function nearestWrench() {
    let best = null, bd = 1e9;
    for (const w of wrenches) {
      if (w.at === 'hand') continue;
      const s = w.at === 'cart' ? cartSpot(w.cart) : { x: w.x, y: w.y };
      const d = Math.hypot(walker.px - s.x, walker.py - s.y);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
  const nearestPile = () => piles.reduce((a, p) => (Math.abs(p.x - walker.px) < Math.abs(a.x - walker.px) ? p : a));

  // Puffarnas platser. Främre raden: bilens ord ovanför bilen och ägarens ord
  // ovanför ägaren, som i Burgarbaren (ägarpuffen hålls i bandet mellan
  // staplarna och ägarens arg-/hjärtikon). Bakre raden står så nära bakväggen
  // att allt som stiger ovanför bilen eller ägaren hamnar på klockan, radion
  // eller i ägarens ansikte – där läggs de två orden i stället sida vid sida på
  // golvet nedanför lyften och stiger upp mot bilen. En ny händelse för samma
  // bil ersätter de gamla puffarna.
  const backRow = (y) => y < 160;
  const POP_GAP = 3;
  const backPopX = (b) => b.lx + RUN / 2 + (b.face ? -5 : 5);
  function eventPops(c, car, owner) {         // car/owner = [text, färg] eller null
    const tb = 'bil' + c.id, ta = 'agare' + c.id;
    pops.drop(tb); pops.drop(ta);
    if (backRow(c.bay.base)) {
      const cx = backPopX(c.bay), y = c.bay.base + 8;
      if (car && owner) {
        const wc = textW(SMALL, car[0]) + 4, wo = textW(SMALL, owner[0]) + 4, tot = wc + POP_GAP + wo;
        pops.add(cx - tot / 2 + wc / 2, y, car[0], car[1], { tag: tb });
        pops.add(cx + tot / 2 - wo / 2, y, owner[0], owner[1], { tag: ta });
      } else if (car) pops.add(cx, y, car[0], car[1], { tag: tb });
      else pops.add(cx, y, owner[0], owner[1], { tag: ta });
    } else {
      if (car) pops.add(Math.round(c.x + c.L / 2), carGY(c) - carArt(c).topH - 30, car[0], car[1], { tag: tb });
      if (owner) pops.add(c.owner.x, c.owner.y - 56, owner[0], owner[1], { tag: ta, minY: PROP_FOOT + 1 });
    }
  }
  // ett tips vid mekanikern (bakre halvan: nedanför fötterna, främre: ovanför huvudet)
  function tipAt(txt, col = '#ffd23f', sound = true) {
    if (hintCool > 0 && lastTip === txt) return;
    hintCool = 1.1; lastTip = txt;
    const back = walker.py < 160;
    pops.add(walker.px, back ? walker.py + 5 : walker.py - 58, txt, col, { tag: 'tips', minY: back ? walker.py - 6 : 0 });
    if (sound) play('miss');
  }
  function sparkle(x, y, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      addFx(x, y, Math.cos(a) * 34, Math.sin(a) * 22 - 8, 30, 0.7, i % 2 ? '#ffe27a' : '#ffffff');
    }
  }

  // ---------- händelser ----------
  function giveUp(c) {
    const j = c.tj;
    // med ett löst eller avtaget hjul kan kunden inte köra – hen blir bara argare
    if (j && (j.tire === 'off' || j.bolts.some((b) => !b) || j.spin)) {
      if (!j.late) { j.late = true; c.nag = t; c.owner.angry = 2; eventPops(c, null, ['SKYNDA PÅ!', '#ff9a6a']); play('miss'); }
      else if (t - c.nag > 5) { c.nag = t; c.owner.angry = 1.6; eventPops(c, null, ['SKYNDA PÅ!', '#ff9a6a']); }
      c.patience = 0;
      return;
    }
    stats.miss++;
    play('miss');
    c.gaveUp = true; c.state = 'lower'; c.bay.moving = c.bay.lift > 0 ? 1 : 0;
    c.owner.angry = 1.6;
    eventPops(c, null, ['TRÖTTNADE!', '#d8d2c0']);
    if (hold.bay === c.bay.i) hold.on = false;
    if (airing === c) airing = null;
    if (pulseCar === c) { pulseCar = null; pulse = 0; }
  }
  function wrongPart(c) {
    stats.fel++;
    play('fel');
    eventPops(c, ['FEL DEL!', '#ff6a6a'], ['SUR!', '#ff9a6a']);
    c.owner.angry = 2.2;
    c.patience = Math.max(3, c.patience - 6);
    hold.on = false; keyHold = 0;
  }
  function wrongWheel(c) {
    const j = c.tj;
    if (t - j.wrongT < 1.5) return;
    j.wrongT = t;
    stats.fel++; play('fel');
    c.owner.angry = 1.8; c.patience = Math.max(3, c.patience - 4);
    eventPops(c, ['FEL HJUL!', '#ff6a6a'], [posTxt(c) + '!', '#ff9a6a']);
  }
  function wrongTire(c) {
    stats.fel++; play('fel');
    c.owner.angry = 2; c.patience = Math.max(3, c.patience - 5);
    eventPops(c, ['FEL DÄCK!', '#ff6a6a'], [TIRE_TXT[c.tj.want] + '!', '#ff9a6a']);
  }
  // lagningen är klar – bilen väntar på att lyften sänks
  function finish(c) {
    c.fixed = true; c.state = 'ready'; c.prog = 1; c.flash = 1; c.puddle = 0; c.drip = null;
    if (!c.tj) carry = null;
    hold.on = false; keyHold = 0;
    play('ok');
    eventPops(c, ['KLART!', '#8ee03c'], ['BRA!', '#ffd23f']);
    c.owner.happy = 0.8; c.owner.angry = 0;
    sparkle(Math.round(c.x + c.L / 2), carGY(c) - carArt(c).topH + 8, 12);
  }
  // lyften sänks: kunden betalar (ett däckbyte räknas som tre rätt)
  function payOut(c) {
    const n = c.tj ? (c.tj.late ? 1 : 3) : 1;
    stats.ok += n;
    if (c.tj) stats.dack++;
    play('coin');
    eventPops(c, ['+' + n, '#8ee03c'], [c.tj && c.tj.late ? 'ÄNTLIGEN!' : 'TACK!', '#ffd23f']);
    c.owner.happy = 1.6; c.owner.angry = 0;
    sparkle(Math.round(c.x + c.L / 2), carGY(c) - carArt(c).topH + 8);
  }

  // en bil på en ledig lyft direkt (för tester/_debug). arg: felets nummer
  // (0 däck … 4 batteri), dess namn ('dack', 'olja' …) eller en bilmodell
  // ('sedan', 'pickup' …, ger däckbyte). opts: { fault, car, wheel: 0 bak | 1
  // fram, tire: däcksort, bay, raised: redan uppe, drive: kör in från porten }
  function forceCar(arg, opts = {}) {
    if (arg && typeof arg === 'object') { opts = arg; arg = opts.fault ?? opts.car; }
    const free = freeBays();
    if (!free.length) return null;
    const b = Number.isInteger(opts.bay) && BAYS[opts.bay] && !carOf(BAYS[opts.bay]) ? BAYS[opts.bay] : free[0];
    let f = 0, kind = opts.car;
    if (Number.isInteger(arg)) f = clamp(arg, 0, 4);
    else if (typeof arg === 'string') {
      const a = foldName(arg);
      if (SPECS[a]) kind = a;
      else { const k = PART_IDS.indexOf(a); f = k >= 0 ? k : 0; }
    }
    if (Number.isInteger(opts.fault)) f = clamp(opts.fault, 0, 4);
    const c = makeCar(b, f, kind);
    if (c.tj && (opts.wheel === 0 || opts.wheel === 1)) c.tj.wheel = opts.wheel;
    if (c.tj && TIRE_KINDS.includes(opts.tire)) { c.tk = opts.tire; c.tj.want = opts.tire; }
    if (!opts.drive) {
      c.x = c.parkX; c.rise = RAMP; c.driver = false; c.delay = 0;
      Object.assign(c.owner, { show: true, ...ownerSpot(c) });
      if (opts.raised) { c.state = 'wait'; b.lift = LIFT_H; } else { c.state = 'park'; b.lift = 0; }
    }
    b.moving = 0;
    cars.push(c);
    return b.i;
  }

  function stepCar(c, dt) {
    const b = c.bay, dirIn = c.face ? -1 : 1, o = c.owner;
    o.angry = Math.max(0, o.angry - dt); o.happy = Math.max(0, o.happy - dt);
    c.honk = Math.max(0, c.honk - dt); c.flash = Math.max(0, c.flash - dt);
    if (c.tj) c.tj.bang = Math.max(0, c.tj.bang - dt);
    const walkOwner = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
      o.walk = d > 0.5;
      if (!o.walk) return true;
      o.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      const st = sp * dt;
      if (d <= st) { o.x = tx; o.y = ty; o.walk = false; return true; }
      o.x += dx / d * st; o.y += dy / d * st;
      return false;
    };
    switch (c.state) {
      case 'drive': {
        if (c.delay > 0) { c.delay -= dt; break; }          // porten rullar upp först
        const d = (c.parkX - c.x) * dirIn;
        const v = clamp(d * 1.9, 9, 52), step = Math.min(d, v * dt);
        c.x += step * dirIn; c.dist += step; c.v = v;
        c.rise = Math.round(RAMP * clamp(1 - (d - step) / 22, 0, 1));
        c.brake = d < 18;
        // rostigt avgasrör: svart rök när bilen kör in
        if (c.fault === 3) {
          c.smokeIn -= dt;
          if (c.smokeIn <= 0) {
            c.smokeIn = 0.07;
            const ex = sx(c, 0), ey = carGY(c) - carArt(c).eh;
            addFx(ex - dirIn * 2, ey, -dirIn * (8 + Math.random() * 8), -6 - Math.random() * 6, -4, 0.9, Math.random() < 0.5 ? '#3a3a40' : '#5a5a62', 2);
          }
        }
        if (d - step <= 0.01) {
          c.x = c.parkX; c.rise = RAMP; c.brake = false; c.state = 'exit';
          c.driver = false;
          Object.assign(o, { show: true, x: doorX(c), y: b.base + 2, dir: c.face ? 'right' : 'left' });
          play('door');
        }
        break;
      }
      case 'exit':
        if (walkOwner(ownerSpot(c).x, b.ownY, 30)) c.state = 'park';   // väntar på att lyften hissas
        break;
      case 'raise':
        b.lift = Math.min(LIFT_H, b.lift + dt * LIFT_H / 1.1);
        if (b.lift >= LIFT_H) { b.lift = LIFT_H; b.moving = 0; c.state = 'wait'; }
        break;
      case 'lower':
        b.lift = Math.max(0, b.lift - dt * LIFT_H / 1.1);
        if (b.lift <= 0) { b.lift = 0; b.moving = 0; c.state = 'board'; }
        break;
      case 'board':
        if (walkOwner(doorX(c), b.base + 2, c.gaveUp ? 40 : 32)) {
          o.show = false; c.driver = true; c.state = 'leave'; c.v = 0;
          play('door');
          if (c.gaveUp) { c.honk = 1.3; play('honk'); }
        }
        break;
      case 'leave': {
        if (b.port < 0.7) break;                             // väntar på porten
        c.v = Math.min(46, c.v + 38 * dt);
        const step = c.v * dt;
        c.x -= step * dirIn; c.dist -= step;
        c.rise = Math.round(RAMP * clamp(1 - Math.abs(c.x - c.parkX) / 22, 0, 1));
        if (c.x < -c.L - 10 || c.x > FW + 10) c.gone = true;
        break;
      }
    }
    // tålamodet rinner medan bilen väntar – långsamt när man jobbar på den
    if (c.state === 'park' || c.state === 'wait') {
      c.patience -= dt * (t - c.lastWork < 3 ? 0.35 : 1);
      if (c.patience <= 0) giveUp(c);
    }
    // felens egna små tecken medan bilen står på lyften
    const shows = (c.state === 'park' || c.state === 'raise' || c.state === 'wait') && !c.fixed;
    if (shows && (c.state !== 'park' || c.fault === 0)) {
      if (c.fault === 1) {   // olja droppar ner på golvet
        if (c.drip) {
          c.drip.v += 140 * dt; c.drip.y += c.drip.v * dt;
          if (c.drip.y >= b.base - 6) { c.drip = null; c.puddle = Math.min(1, c.puddle + 0.12); }
        } else if ((c.dripIn -= dt) <= 0) {
          c.dripIn = 0.9 + Math.random() * 0.6;
          const q = c.L - 13, art = carArt(c);
          c.drip = { x: sx(c, q), y: carGY(c) - art.hb[q] + 1, v: 0 };
        }
      }
      if (c.fault === 4 && (c.sparkIn -= dt) <= 0) {   // det knastrar vid polerna
        c.sparkIn = 1.2 + Math.random() * 1.4;
        const [hx, hy] = hoodSpot(c);
        for (let i = 0; i < 4; i++) addFx(hx, hy, (Math.random() - 0.5) * 30, -10 - Math.random() * 20, 60, 0.25, Math.random() < 0.5 ? '#9ee0ff' : '#ffffff');
      }
      if (c.tj && c.tj.tire === 'flat' && (c.sparkIn -= dt) <= 0) {   // det pyser ur det punkterade däcket
        c.sparkIn = 1.1 + Math.random() * 0.9;
        const out = (c.tj.wheel === 1) !== !!c.face ? 1 : -1;
        const wx = wheelX(c, c.tj.wheel), wy = wheelCY(c);
        for (let i = 0; i < 3; i++) addFx(wx + out * (c.spec.r - 1), wy - 2 + i, out * (6 + Math.random() * 8), -4 - Math.random() * 6, -3, 0.55, 'rgba(255,255,255,0.8)');
      }
      if (c.fault === 3 && (c.smokeIn -= dt) <= 0) {   // rosten fjällar
        c.smokeIn = 0.8 + Math.random();
        const ex = sx(c, 6), ey = carGY(c) - carArt(c).eh + 3;
        addFx(ex, ey, (Math.random() - 0.5) * 4, 4, 90, 0.5, '#a0521e', 1, false);
      }
    }
  }
  // motorrummets mitt (för gnistor och olja) i skärmkoordinater
  function hoodSpot(c) {
    const art = carArt(c), q = Math.round((c.spec.ws[1] + c.L - 3) / 2);
    return [sx(c, q), carGY(c) - art.ht[q] - 2];
  }

  // ---------- däckbytet ----------
  function stageOf(c) {
    if (!c) return null;
    if (c.state === 'drive' || c.state === 'exit') return 'KOMMER';
    if (c.state === 'park' || c.state === 'raise') return 'HISSA';
    if (c.state === 'ready') return 'SÄNK';
    if (c.state !== 'wait') return 'KLART';
    const j = c.tj;
    if (!j) return (carry && carry.p === c.fault) || c.prog > 0 ? 'LAGA' : 'HÄMTA DEL';
    const inN = j.bolts.filter(Boolean).length;
    if (j.tire === 'flat') {
      if (inN === j.n && !j.spin && !hasWrench()) return 'SKRUVDRAGARE';
      return inN > 0 || j.spin ? 'SKRUVAR' : 'DÄCK AV';
    }
    if (j.tire === 'off') return carry && carry.wheel && carry.old && carry.from === c.id ? 'DÄCK AV' : 'NYTT DÄCK';
    if (inN < j.n || j.spin) return 'SKRUVA FAST';
    return 'LUFT';
  }
  // kryssmönster: 4 skruvar – motsatt, sedan de två andra motsatt; 5 skruvar – varannan (stjärna)
  function isStar(o, n) {
    if (o.length !== n) return false;
    if (n === 4) return (o[0] + 2) % 4 === o[1] && (o[2] + 2) % 4 === o[3];
    for (let i = 1; i < n; i++) { const d = (o[i] - o[i - 1] + n) % n; if (d !== 2 && d !== n - 2) return false; }
    return true;
  }
  // i vilken ordning kryssmönstret går om man börjar på skruv s0 (för hjälpsiffrorna)
  function starOrder(n, s0 = 0) { return n === 4 ? [s0, s0 + 2, s0 + 1, s0 + 3].map((k) => k % 4) : [0, 1, 2, 3, 4].map((m) => (s0 + 2 * m) % 5); }
  function startBolt(c, bi) {
    const j = c.tj, out = j.tire === 'flat';
    const cand = (k) => j.bolts[k] === out;       // ut: skruvar som sitter i · in: tomma hål
    if (bi >= 0 && !cand(bi)) { tipAt(out ? 'DEN ÄR REDAN UTE' : 'DEN SITTER REDAN', '#d8d2c0', false); play('click'); return; }
    if (bi < 0) {
      for (let s = 1; s <= j.n; s++) { const k = (j.last + s + j.n) % j.n; if (cand(k)) { bi = k; break; } }
      if (bi < 0) return;
    }
    j.spin = { i: bi, t: 0, out }; j.slip = false;
    c.lastWork = t;
    play('click');
  }
  function boltClick(c, bi, how) {
    const j = c.tj;
    if (j.spin) {
      const p = j.spin.t / SPIN_T;
      if (how === 'key') { if (p >= 0.55) j.queued = bi; return; }   // nedhållen tangent: nästa skruv när den här är klar
      if (p < 0.6) { slip(c); return; }
      j.queued = bi;
      return;
    }
    startBolt(c, bi);
  }
  // man klickade medan skruven snurrade: dragaren slirar, skruven börjar om
  function slip(c) {
    const j = c.tj;
    if (!j.slip) {
      j.slip = true; stats.fel++; play('fel');
      c.owner.angry = 1.2;
      eventPops(c, ['FÖR SNABBT!', '#ff6a6a'], ['FÖRSIKTIGT!', '#ff9a6a']);
    }
    j.spin.t = 0;
  }
  function boltDone(c) {
    const j = c.tj, k = j.spin.i, out = j.spin.out;
    j.bolts[k] = !out; j.last = k; j.spin = null;
    const wx = wheelX(c, j.wheel), wy = wheelCY(c), side = (j.wheel === 1) !== !!c.face ? 1 : -1;
    if (out) addFx(wx, wy, side * (14 + Math.random() * 10), -34 - Math.random() * 10, 230, 0.55, '#e8ecf2', 1, false);   // skruven hoppar ur
    else j.order.push(k);
    play('click');
    const inN = j.bolts.filter(Boolean).length;
    if (out && inN === 0) { learn('SKRUVAR'); play('ok'); eventPops(c, ['SKRUVARNA UTE!', '#8ee03c'], null); }
    if (!out && inN === j.n) {
      learn('SKRUVA FAST');
      if (isStar(j.order, j.n)) {
        stats.ok++; stats.kryss++;
        play('box');
        eventPops(c, ['KRYSSMÖNSTER! +1', '#ffd23f'], ['PROFFSIGT!', '#8ee03c']);
        sparkle(wx, wy - 4, 12);
      } else { play('ok'); eventPops(c, ['FASTSKRUVAT!', '#8ee03c'], null); }
    }
    const q = j.queued;
    j.queued = null;
    if (q !== null && j.bolts.some((b) => b === out)) startBolt(c, q);
  }
  function pang(c) {
    const j = c.tj;
    stats.fel++; play('fel'); play('knock');
    j.air = 0; j.bang = 0.3; shake = 0.3; hold.on = false; pulse = 0; pulseCar = null; airing = null;
    c.owner.angry = 2.4;
    eventPops(c, ['PANG!', '#ffffff'], ['OJ OJ!', '#ff9a6a']);
    const wx = wheelX(c, j.wheel), wy = wheelCY(c);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + Math.random() * 0.2;
      addFx(wx, wy, Math.cos(a) * (40 + Math.random() * 30), Math.sin(a) * 34 - 12, 140, 0.6, i % 3 ? '#2a2a30' : '#f4f1ea', i % 4 ? 1 : 2);
    }
  }
  // man släppte luften: grönt = klart, för mycket = fel och luft släpps ut, för lite = fyll på mer
  function judgeAir(c) {
    const j = c.tj;
    if (!j || j.aired || j.tire !== 'new' || c.state !== 'wait') return;
    if (j.air >= GREEN_LO && j.air <= GREEN_HI) {
      j.aired = true; learn('LUFT');
      finish(c);
      eventPops(c, ['LAGOM!', '#8ee03c'], ['SÄNK LYFTEN!', '#ffd23f']);
      stowIn = 0.7;                                       // slangen rullas in av sig själv
    } else if (j.air > GREEN_HI) {
      stats.fel++; play('fel');
      c.owner.angry = 1.6;
      j.air = 0.46;
      eventPops(c, ['FÖR MYCKET LUFT!', '#ff6a6a'], null);
      const wx = wheelX(c, j.wheel), wy = wheelCY(c) - c.spec.r + 1;
      for (let i = 0; i < 8; i++) addFx(wx + (Math.random() - 0.5) * 3, wy, (Math.random() - 0.5) * 30, -20 - Math.random() * 20, -6, 0.6, 'rgba(255,255,255,0.8)');
    } else if (j.air > 0.04) tipAt('MER LUFT - HÅLL INNE', '#d8d2c0', false);
  }
  // man lämnar ett halvfyllt däck: fel (en gång per däck)
  function lowAir(c) {
    const j = c && c.tj;
    if (!j || j.aired || j.lowFel || j.tire !== 'new' || j.air <= 0.04 || j.air >= GREEN_LO) return false;
    j.lowFel = true; stats.fel++; play('fel');
    c.owner.angry = 1.4;
    eventPops(c, ['FÖR LITE LUFT!', '#ff6a6a'], null);
    return true;
  }

  // ---------- att bära ----------
  function handPos() {
    const dir = walker.dir, ox = dir === 'left' ? -7 : dir === 'right' ? 7 : 0;
    return { x: Math.round(walker.px) + ox, y: Math.round(walker.py) - 14 };
  }
  function dropWrench() {
    const w = wrenches[carry.wrench], dir = walker.dir;
    const ox = dir === 'left' ? -8 : dir === 'right' ? 8 : 7;
    Object.assign(w, { at: 'floor', x: clamp(Math.round(walker.px + ox), 8, FW - 8), y: Math.round(walker.py) + 2 });
    carry = null;
    play('click');
  }
  function stowHose() {
    if (!hasHose()) return;
    lowAir(hoseCar);
    const h = handPos();
    Object.assign(hoseBack, { t: 0.4, x: h.x, y: h.y });
    carry = null; airing = null; hold.on = false; pulse = 0; pulseCar = null; stowIn = 0;
    play('slide');
  }
  // gör händerna fria innan man tar något nytt: slangen rullas in, en del går
  // tillbaka i hyllan, skruvdragaren läggs på golvet. Ett hjul måste läggas rätt.
  function freeHands() {
    if (!carry) return true;
    if (carry.hose) { stowHose(); return true; }
    if (carry.p !== undefined) { carry = null; return true; }
    if (carry.wrench !== undefined) { dropWrench(); return true; }
    return false;
  }
  function carryName() {
    if (!carry) return null;
    if (carry.p !== undefined) return carry.p;
    if (carry.wrench !== undefined) return 'skruvdragare';
    if (carry.hose) return 'slang';
    return (carry.old ? 'gammalt:' : 'hjul:') + carry.wheel;
  }

  // ---------- handlingar på plats ----------
  function actPanel(b) {
    const c = carOf(b);
    focus = b.i;
    walker.dir = panelSpot(b).dir;
    if (!c || c.state === 'drive' || c.state === 'exit') { tipAt(c ? 'VÄNTA PÅ BILEN' : 'INGEN BIL HÄR', '#d8d2c0'); return; }
    if (c.state === 'park') {
      c.state = 'raise'; b.moving = 1; b.press = 0.35; b.pressUp = true; b.hum = 0;
      learn('HISSA');
      play('slide');
      return;
    }
    if (c.state === 'ready') {
      c.state = 'lower'; b.moving = 1; b.press = 0.35; b.pressUp = false; b.hum = 0;
      learn('SÄNK');
      payOut(c);
      play('slide');
      return;
    }
    if (c.state === 'wait') {
      const j = c.tj;
      if (j && j.tire === 'off') tipAt('HJULET SITTER INTE PÅ!', '#ff9a6a');
      else if (j && (j.bolts.some((k) => !k) || j.spin)) tipAt('SKRUVA FAST HJULET FÖRST!', '#ff9a6a');
      else if (j && !lowAir(c)) tipAt(j.tire === 'flat' ? 'BYT DÄCKET FÖRST' : 'FYLL LUFT I DÄCKET FÖRST', '#ff9a6a');
      else if (!j) tipAt('LAGA BILEN FÖRST', '#ff9a6a');
    }
  }
  function actWheel(c, i, how) {
    const j = c.tj, b = c.bay;
    if (!j || cars.indexOf(c) < 0) return;
    focus = b.i;
    walker.dir = wheelSpot(c, i).dir;
    if (c.state === 'park' || c.state === 'raise') { tipAt(c.state === 'park' ? 'HISSA UPP BILEN FÖRST!' : 'VÄNTA - LYFTEN GÅR UPP'); return; }
    if (c.state === 'ready') { tipAt('KLART - SÄNK LYFTEN!'); return; }
    if (c.state !== 'wait') return;
    const right = i === j.wheel;
    c.lastWork = t;
    if (carry && carry.wheel) {
      if (carry.old) { tipAt('LÄGG DET GAMLA I STAPELN'); return; }
      if (j.tire !== 'off') { tipAt(right ? 'TA AV DET PUNKTERADE FÖRST' : 'FEL HJUL - ' + posTxt(c)); return; }
      if (!right) { tipAt('FEL HJUL - ' + posTxt(c)); return; }
      if (carry.wheel !== j.want) { wrongTire(c); return; }
      j.tire = 'new'; j.mounted = carry.wheel; j.bolts.fill(false); j.order = []; j.last = -1; j.air = 0; j.lowFel = false;
      carry = null;
      learn('NYTT DÄCK');
      play('knock');
      eventPops(c, ['PÅ PLATS!', '#8ee03c'], null);
      return;
    }
    if (hasHose()) {
      if (!right) { tipAt('FEL HJUL - ' + posTxt(c)); return; }
      if (j.tire !== 'new' || j.bolts.some((k) => !k)) { tipAt(j.tire === 'new' ? 'SKRUVA FAST HJULET FÖRST' : 'BYT DÄCKET FÖRST'); return; }
      if (how === 'key') { pulse = PULSE_T; pulseCar = c; hoseCar = c; }
      return;                                           // med musen fylls det så länge man håller inne (update)
    }
    if (carry && carry.p !== undefined) { wrongPart(c); return; }
    const wrench = hasWrench();
    if (j.tire === 'flat') {
      if (j.bolts.some(Boolean)) {
        if (!wrench) { tipAt('HÄMTA SKRUVDRAGAREN'); return; }
        if (!right) { wrongWheel(c); return; }
        boltClick(c, -1, how);
        return;
      }
      if (!right) { tipAt('FEL HJUL - ' + posTxt(c)); return; }
      if (j.spin) return;
      // alla skruvar ute: lyft av hjulet (skruvdragaren läggs på golvet)
      if (wrench) dropWrench();
      carry = { wheel: j.want, old: true, from: c.id };
      j.tire = 'off';
      play('door');
      eventPops(c, ['AV!', '#8ee03c'], null);
      return;
    }
    if (j.tire === 'off') { tipAt(right ? 'HÄMTA ' + TIRE_TXT[j.want] + 'DÄCK' : 'FEL HJUL - ' + posTxt(c)); return; }
    if (j.bolts.some((k) => !k)) {
      if (!wrench) { tipAt('TA SKRUVDRAGAREN'); return; }
      if (!right) { wrongWheel(c); return; }
      boltClick(c, -1, how);
      return;
    }
    if (!j.aired) tipAt(right ? 'HÄMTA LUFTSLANGEN' : 'FEL HJUL - ' + posTxt(c));
  }
  function actRack(sl) {
    walker.dir = 'up';
    if (carry && carry.wheel && carry.old) { tipAt('LÄGG DET GAMLA I STAPELN'); return; }
    if (carry && carry.wheel) {
      if (carry.wheel === sl.kind) { carry = null; play('click'); pops.add(sl.x, PICK_Y + 12, 'TILLBAKA', '#d8d2c0', { tag: 'tips', minY: PICK_Y + 4 }); return; }
      carry = { wheel: sl.kind, old: false };            // byt: det andra hjulet ställs tillbaka
      play('ok');
      return;
    }
    freeHands();
    carry = { wheel: sl.kind, old: false };
    play('ok');
  }
  function actStation(p) {
    walker.dir = 'up';
    if (carry && carry.p === p) { carry = null; play('click'); pops.add(PART_X[p], PICK_Y + 12, 'TILLBAKA', '#d8d2c0', { tag: 'tips', minY: PICK_Y + 4 }); return; }
    if (!freeHands()) { tipAt(carry.old ? 'LÄGG DET GAMLA I STAPELN' : 'HÄNDERNA ÄR FULLA'); return; }
    carry = { p };
    play('ok');
  }
  function actPile(p) {
    walker.dir = 'up';
    if (carry && carry.wheel && carry.old) {
      p.n = Math.min(PILE_MAX, p.n + 1); carry = null;
      learn('DÄCK AV');
      play('box');
      pops.add(p.x, p.y + 10, 'I STAPELN!', '#8ee03c', { tag: 'tips', minY: p.y + 2 });
      return;
    }
    tipAt(carry && carry.wheel ? 'NYA HJUL SKA PÅ BILEN' : 'HÄR LÄGGS GAMLA HJUL', '#d8d2c0');
  }
  function takeWrench(w) {
    if (hasWrench()) { tipAt('DU HAR REDAN EN', '#d8d2c0'); return; }
    if (!freeHands()) { tipAt(carry.old ? 'LÄGG DET GAMLA I STAPELN' : 'HÄNDERNA ÄR FULLA'); return; }
    w.at = 'hand'; carry = { wrench: w.id };
    learn('SKRUVDRAGARE');
    play('ok');
  }
  function actCart(ci) {
    walker.dir = 'up';
    const w = wrenches.find((x) => x.at === 'cart' && x.cart === ci);
    if (hasWrench()) {
      if (!w) { Object.assign(wrenches[carry.wrench], { at: 'cart', cart: ci }); carry = null; play('click'); pops.add(CARTS[ci].x, CARTS[ci].y + 10, 'TILLBAKA', '#d8d2c0', { tag: 'tips' }); return; }
      tipAt('DU HAR REDAN EN', '#d8d2c0');
      return;
    }
    if (!w) { tipAt('SKRUVDRAGAREN ÄR BORTA', '#d8d2c0'); return; }
    takeWrench(w);
  }
  function actComp() {
    walker.dir = 'up';
    if (hasHose()) { stowHose(); return; }
    if (!freeHands()) { tipAt(carry.old ? 'LÄGG DET GAMLA I STAPELN' : 'HÄNDERNA ÄR FULLA'); return; }
    carry = { hose: true };
    play('ok');
  }

  // ---------- de gamla felen: håll inne vid bilens front ----------
  function workFx(c, dt) {
    workTick -= dt;
    const art = carArt(c), gY = carGY(c), dirIn = c.face ? -1 : 1;
    if (workTick <= 0) { workTick = 0.26; play('click'); }
    const rnd = Math.random;
    if (c.fault === 1) {        // olja: gyllene stråle ner i motorn, ånga
      const [hx, hy] = hoodSpot(c);
      addFx(hx + (rnd() < 0.5 ? 0 : 1), hy - 9, 0, 40, 160, 0.18, rnd() < 0.5 ? '#f2b822' : '#ffd860', 1, false);
      if (rnd() < 0.3) addFx(hx + (rnd() - 0.5) * 8, hy - 2, (rnd() - 0.5) * 6, -14, -4, 0.8, 'rgba(255,255,255,0.7)', 1);
    } else if (c.fault === 2) { // lampa: stjärnglitter vid strålkastaren
      const [hq, hh] = art.headPx[0] || [c.L - 2, 10];
      const lx = sx(c, hq), ly = gY - hh;
      if (rnd() < 0.5) addFx(lx + (rnd() - 0.5) * 8, ly + (rnd() - 0.5) * 6, 0, -8, 0, 0.4, rnd() < 0.5 ? '#fff6c0' : '#ffffff');
    } else if (c.fault === 3) { // avgasrör: svetsgnistor
      const ex = sx(c, 6), ey = gY - art.eh + 1;
      for (let i = 0; i < 3; i++) addFx(ex, ey, (rnd() - 0.5) * 70 - dirIn * 10, -20 - rnd() * 40, 200, 0.45, rnd() < 0.4 ? '#fff4b0' : rnd() < 0.7 ? '#ffb030' : '#ff6a20');
    } else {                    // batteri: blå elgnistor
      const [hx, hy] = hoodSpot(c);
      if (rnd() < 0.7) addFx(hx + (rnd() - 0.5) * 4, hy, (rnd() - 0.5) * 50, -20 - rnd() * 30, 110, 0.3, rnd() < 0.5 ? '#9ee0ff' : '#ffffff');
    }
  }

  // ---------- var pekar man? ----------
  function carAtPoint(x, y) {
    let best = null, bd = 1e9;
    for (const c of cars) {
      if (c.state === 'leave') continue;
      const art = carArt(c), top = carGY(c) - art.topH - 30;
      const x0 = c.bay.lx - 6, x1 = c.bay.lx + RUN + 6;
      if (x < x0 || x > x1 || y < top || y > c.bay.base + 8) continue;
      const d = Math.abs(y - (c.bay.base - 14));
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // vilket av bilens två hjul pekar man på (−1 = inget)
  function wheelAtPoint(c, x, y) {
    const wy = wheelCY(c), r = c.spec.r;
    if (y < wy - r - 5 || y > c.bay.base + 8) return -1;
    for (let i = 0; i < 2; i++) if (Math.abs(x - wheelX(c, i)) <= r + 4) return i;
    return -1;
  }
  // navbubblan (skruvarna i stort) syns när man står vid rätt hjul med skruvdragaren
  function hubVisible(c) {
    const j = c && c.tj;
    if (!j || c.state !== 'wait' || !atWheel(c, j.wheel)) return false;
    if (j.spin) return true;
    return hasWrench() && ((j.tire === 'flat' && j.bolts.some(Boolean)) || (j.tire === 'new' && j.bolts.some((k) => !k)));
  }
  const gaugeVisible = (c) => { const j = c && c.tj; return !!j && c.state === 'wait' && hasHose() && j.tire === 'new' && !j.aired && j.bolts.every(Boolean) && atWheel(c, j.wheel); };
  // en bubbla ovanför hjulet: [spetsens x, spetsens y, innerytans x, y]
  function wheelBubbleAt(c, iw, ih) {
    const j = c.tj, art = carArt(c), q = c.spec.wheels[j.wheel];
    const cx = clamp(wheelX(c, j.wheel), (iw >> 1) + 3, FW - (iw >> 1) - 3);
    const tip = carGY(c) - art.ht[q] - c.spec.D - 2;
    const w = iw + 2, h = ih + 2;
    return { cx, tip, ix: cx - (w >> 1) + 1, iy: tip - 2 - h + 1 };
  }
  function hubGeom(c) {
    const g = wheelBubbleAt(c, 31, 31), j = c.tj, hx = g.ix + 15, hy = g.iy + 15;
    const bolts = [];
    for (let k = 0; k < j.n; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / j.n; bolts.push({ x: hx + Math.round(Math.cos(a) * 8), y: hy + Math.round(Math.sin(a) * 8) }); }
    return { ...g, hx, hy, bolts };
  }
  function hubHit(x, y) {
    for (const c of cars) {
      if (!hubVisible(c)) continue;
      const g = hubGeom(c);
      if (x < g.ix - 1 || x > g.ix + 31 || y < g.iy - 1 || y > g.iy + 31) continue;
      const k = g.bolts.findIndex((p) => Math.abs(x - p.x) <= 3 && Math.abs(y - p.y) <= 3);
      return { c, k };
    }
    return null;
  }
  function clickCar(c, x, y) {
    const b = c.bay;
    focus = b.i;
    const st = stageOf(c);
    if (st === 'KOMMER' || st === 'KLART') { walker.walkTo(x, Math.max(y, b.base + 6)); return; }
    if (st === 'HISSA' || st === 'SÄNK') {
      const s = panelSpot(b);
      pops.add(b.panelX + 2, backRow(b.base) ? b.base + 8 : b.panelY - 20, st === 'HISSA' ? 'HISSA MED PANELEN' : 'SÄNK MED PANELEN', '#ffd23f', { tag: 'tips' });
      play('miss');
      if (!c.tj) { walker.walkTo(s.x, s.y); return; }
      return;
    }
    if (!c.tj) {   // de gamla felen: gå till fronten (bakänden för avgasröret) och håll inne
      const s = spotOf(b);
      hold.on = true; hold.bay = b.i;
      walker.walkTo(s.x, s.y);
      return;
    }
    let i = wheelAtPoint(c, x, y);
    if (i < 0) i = c.tj.wheel;
    const s = wheelSpot(c, i);
    if (hasHose()) { hold.on = true; hold.bay = b.i; hold.wheel = i; }
    go(s, () => actWheel(c, i, 'click'));
  }
  // närmaste arbetsplats för mellanslag/Enter
  function nearestWork() {
    let best = null, bd = 8;
    const consider = (s, o) => { const d = Math.hypot(walker.px - s.x, walker.py - s.y); if (d < bd) { bd = d; best = o; } };
    for (const b of BAYS) {
      const c = carOf(b);
      if (c && !c.tj) consider(spotOf(b), { type: c.state === 'wait' ? 'front' : 'panel', b });
      consider(panelSpot(b), { type: c && !c.tj && c.state === 'wait' ? 'front' : 'panel', b });
      if (c && c.tj) for (let i = 0; i < 2; i++) consider(wheelSpot(c, i), { type: 'wheel', c, i });
    }
    return best;
  }
  // bilen vars steg visas i stegraden: den man senast jobbade med, annars närmaste
  function focusCar() {
    const live = (c) => !!c && ['park', 'raise', 'wait', 'ready'].includes(c.state);
    let c = focus >= 0 ? carOf(BAYS[focus]) : null;
    if (live(c)) return c;
    let bd = 1e9;
    c = null;
    for (const k of cars) {
      if (!live(k)) continue;
      const d = Math.hypot(walker.px - (k.bay.lx + RUN / 2), walker.py - k.bay.base);
      if (d < bd) { bd = d; c = k; }
    }
    return c;
  }
  // hjälptexten för nästa steg (de två första gångerna per steg)
  function hintFor(c) {
    if (!c) return null;
    const st = stageOf(c), j = c.tj, b = c.bay;
    const wheelT = () => ({ x: wheelX(c, j.wheel), y: wheelCY(c) - c.spec.r - 2 });
    const wrenchT = () => { const w = nearestWrench(); if (!w) return null; return w.at === 'cart' ? { x: CARTS[w.cart].x - 6, y: CARTS[w.cart].y - 33 } : { x: w.x, y: w.y - 8 }; };
    const pileT = () => { const p = nearestPile(); return { x: p.x, y: p.y - 10 - p.n * 5 }; };
    const slotT = (kind) => { const sl = SLOTS.find((s) => s.kind === kind); return { x: sl.x, y: sl.row ? RACK.mid + 2 : RACK.y0 + 1 }; };
    const panelT = () => ({ x: b.panelX + 2, y: b.panelY - 4 });
    const at = (k, p, txt) => (p ? { key: k, ...p, txt } : null);
    switch (st) {
      case 'HISSA': return c.state === 'park' ? at('HISSA', panelT(), 'HISSA UPP BILEN') : null;
      case 'SÄNK': return at('SÄNK', panelT(), 'SÄNK LYFTEN');
      case 'HÄMTA DEL': return at('DEL', { x: PART_X[c.fault], y: 40 }, 'HÄMTA ' + PART_NAMES[c.fault]);
      case 'LAGA': return at('LAGA', { x: spotOf(b).x, y: spotOf(b).y - 44 }, 'HÅLL INNE VID BILEN');
      case 'SKRUVDRAGARE': return at('SKRUVDRAGARE', wrenchT(), 'HÄMTA SKRUVDRAGAREN');
      case 'SKRUVAR': return hasWrench() ? (hubVisible(c) ? null : at('SKRUVAR', wheelT(), 'SKRUVA UR - ' + posTxt(c))) : at('SKRUVDRAGARE', wrenchT(), 'HÄMTA SKRUVDRAGAREN');
      case 'DÄCK AV': return carry && carry.old ? at('STAPEL', pileT(), 'LÄGG DET I STAPELN') : at('DÄCK AV', wheelT(), 'TA AV HJULET');
      case 'NYTT DÄCK':
        if (carry && carry.wheel && !carry.old) return carry.wheel === j.want ? at('NYTT DÄCK', wheelT(), 'SÄTT PÅ HJULET') : at('NYTT DÄCK', slotT(carry.wheel), 'FEL SORT - LÄMNA TILLBAKA');
        return at('NYTT DÄCK', slotT(j.want), 'HÄMTA ' + TIRE_TXT[j.want] + 'DÄCK');
      case 'SKRUVA FAST': return hasWrench() ? (hubVisible(c) ? null : at('SKRUVA FAST', wheelT(), 'SKRUVA FAST HJULET')) : at('SKRUVA FAST', wrenchT(), 'TA SKRUVDRAGAREN');
      case 'LUFT': return hasHose() ? (gaugeVisible(c) ? null : at('LUFT', wheelT(), 'FYLL LUFT HÄR')) : at('LUFT', { x: COMP.x + 10, y: COMP.y - 27 }, 'HÄMTA LUFTSLANGEN');
    }
    return null;
  }

  // ---------- _debug: steg för steg utan att gå ----------
  function tireCar(bay) {
    if (Number.isInteger(bay)) { const c = carOf(BAYS[bay]); return c && c.tj ? c : null; }
    const f = focusCar();
    if (f && f.tj) return f;
    return cars.find((c) => c.tj && ['park', 'raise', 'wait', 'ready'].includes(c.state)) || null;
  }
  function place(s) { walker.stop(); walker.px = s.x; walker.py = s.y; if (s.dir) walker.dir = s.dir; }
  function grabWrench() {
    if (hasWrench()) return true;
    const w = nearestWrench();
    if (!w) return false;
    place(w.at === 'cart' ? cartSpot(w.cart) : { x: w.x, y: w.y });
    if (w.at === 'cart') actCart(w.cart); else takeWrench(w);
    return hasWrench();
  }
  function tireInfo(c) {
    if (!c || !c.tj) return null;
    const j = c.tj;
    return { bay: c.bay.i, car: c.kind, state: c.state, stage: stageOf(c), wheel: j.wheel ? 'fram' : 'bak', side: sideTxt(c).toLowerCase(), pos: posTxt(c),
      want: j.want, n: j.n, bolts: j.bolts.slice(), tire: j.tire, mounted: j.mounted, air: +j.air.toFixed(3), aired: j.aired,
      spin: j.spin ? { i: j.spin.i, t: +j.spin.t.toFixed(2), out: j.spin.out } : null, order: j.order.slice(), late: j.late, patience: +c.patience.toFixed(2) };
  }
  function debugStep(name, opts = {}) {
    const n = foldName(name);
    const c = tireCar(opts.bay);
    const res = (ok, msg = '') => ({ ok, msg, bay: c ? c.bay.i : null, stage: stageOf(c), carrying: carryName(), stats: { ...stats } });
    if (!c) return res(false, 'ingen bil med punktering');
    const b = c.bay, j = c.tj;
    focus = b.i;
    switch (n) {
      case 'hissa':
        if (c.state !== 'park') return res(false, 'bilen står inte nere på lyften');
        place(panelSpot(b)); actPanel(b);
        if (!opts.anim) { b.lift = LIFT_H; b.moving = 0; c.state = 'wait'; }
        return res(true);
      case 'skruvdragare': return res(grabWrench());
      case 'skruv': case 'skruvar': {
        if (c.state !== 'wait' || j.tire !== 'flat') return res(false, 'inget punkterat hjul att skruva ur');
        if (!grabWrench()) return res(false, 'ingen skruvdragare');
        place(wheelSpot(c, j.wheel));
        if (n === 'skruv') {
          startBolt(c, Number.isInteger(opts.i) ? opts.i : -1);
          if (j.spin && !opts.anim) { j.spin.t = SPIN_T; boltDone(c); }
          return res(true);
        }
        for (let k = 0; k < j.n; k++) if (j.bolts[k]) { j.spin = { i: k, t: SPIN_T, out: true }; boltDone(c); }
        return res(true);
      }
      case 'dackav': {
        if (c.state !== 'wait' || j.tire !== 'flat' || j.bolts.some(Boolean)) return res(false, 'skruvarna sitter kvar');
        place(wheelSpot(c, j.wheel)); actWheel(c, j.wheel, 'key');
        if (!opts.keep) { const p = nearestPile(); place(pileSpot(p)); actPile(p); }
        return res(true);
      }
      case 'stapel': {
        if (!carry || !carry.old) return res(false, 'bär inget gammalt hjul');
        const p = Number.isInteger(opts.pile) ? piles[opts.pile] : nearestPile(); place(pileSpot(p)); actPile(p);
        return res(true);
      }
      case 'nyttdack': case 'sattpa': {
        if (c.state !== 'wait' || j.tire !== 'off') return res(false, 'hjulet är inte av');
        if (carry && carry.old) { const p = nearestPile(); place(pileSpot(p)); actPile(p); }
        if (n === 'nyttdack' || !carry || !carry.wheel) {
          const sl = SLOTS.find((s) => s.kind === (TIRE_KINDS.includes(opts.kind) ? opts.kind : j.want));
          place(slotSpot(sl)); actRack(sl);
        }
        if (!opts.keep) { place(wheelSpot(c, j.wheel)); actWheel(c, j.wheel, 'key'); }
        return res(j.tire === 'new');
      }
      case 'skruvafast': {
        if (c.state !== 'wait' || j.tire !== 'new') return res(false, 'inget nytt hjul på plats');
        if (!grabWrench()) return res(false, 'ingen skruvdragare');
        place(wheelSpot(c, j.wheel));
        const order = opts.kryss === false ? [...Array(j.n).keys()] : starOrder(j.n, 0);
        for (const k of order) if (!j.bolts[k]) { j.spin = { i: k, t: SPIN_T, out: false }; boltDone(c); }
        return res(true);
      }
      case 'luft': {
        if (c.state !== 'wait' || j.tire !== 'new' || j.bolts.some((k) => !k)) return res(false, 'hjulet sitter inte fast');
        if (!hasHose()) { place(compSpot()); actComp(); }
        place(wheelSpot(c, j.wheel));
        hoseCar = c;
        j.air = Number.isFinite(opts.to) ? opts.to : (GREEN_LO + GREEN_HI) / 2;
        if (opts.hold) { hold.on = true; hold.bay = b.i; hold.wheel = j.wheel; return res(true); }
        if (j.air >= 1) pang(c); else judgeAir(c);
        return res(true);
      }
      case 'sank':
        if (c.state !== 'ready') return res(false, 'bilen är inte klar');
        place(panelSpot(b)); actPanel(b);
        if (!opts.anim) { b.lift = 0; b.moving = 0; c.state = 'board'; }
        return res(true);
    }
    return res(false, 'okänt steg: ' + name);
  }
  // klickpunkter i spelkoordinater (för scene.down(x, y) i tester)
  function debugSpot(id) {
    const [k0, a, b2] = String(id || '').split(':'), k = foldName(k0);
    const bay = BAYS[clamp(+a || 0, 0, 3)];
    switch (k) {
      case 'panel': return { x: bay.panelX + 2, y: bay.panelY + 3 };
      case 'hjul': {
        const c = carOf(bay); if (!c) return null;
        const i = b2 === undefined ? (c.tj ? c.tj.wheel : 1) : (foldName(b2) === 'fram' || b2 === '1' ? 1 : 0);
        return { x: wheelX(c, i), y: wheelCY(c) };
      }
      case 'bult': { const c = carOf(bay); if (!c || !c.tj) return null; return hubGeom(c).bolts[clamp(+b2 || 0, 0, c.tj.n - 1)]; }
      case 'bil': return { x: bay.lx + RUN / 2, y: bay.base - 16 };
      case 'skruvdragare': { const w = nearestWrench(); if (!w) return null; return w.at === 'cart' ? { x: CARTS[w.cart].x - 6, y: CARTS[w.cart].y - 29 } : { x: w.x, y: w.y - 3 }; }
      case 'vagn': { const ci = clamp(+a || 0, 0, 1); return { x: CARTS[ci].x, y: CARTS[ci].y - 12 }; }
      case 'kompressor': return { x: COMP.x, y: COMP.y - 10 };
      case 'stapel': { const p = a === undefined ? nearestPile() : piles[clamp(+a || 0, 0, 1)]; return { x: p.x, y: p.y - 8 }; }
      case 'dack': { const sl = SLOTS.find((s) => s.kind === foldName(a)) || SLOTS[0]; return { x: sl.x, y: sl.row ? 86 : 62 }; }
      case 'station': return { x: PART_X[clamp(+a || 1, 1, 4)], y: 80 };
    }
    const p = PART_IDS.indexOf(k);
    if (p > 0) return { x: PART_X[p], y: 80 };
    return null;
  }
  function hudInfo() {
    const c = focusCar();
    if (!c) return { bay: null, steps: [] };
    const list = c.tj ? STEPS : STEPS_PART, st = stageOf(c), idx = st === 'KLART' ? list.length : list.indexOf(st);
    return { bay: c.bay.i, pos: c.tj ? posTxt(c) : null, want: c.tj ? c.tj.want : null, stage: st,
      steps: list.map((s, i) => ({ name: s, state: i < idx ? 'klar' : i === idx ? 'nu' : 'kvar' })) };
  }

  return {
    _debug: {
      stats,
      parts: PART_IDS,
      tireKinds: TIRE_KINDS,
      steps: STEPS,
      // ställer en bil på en ledig lyft (nere, väntar på HISSA); se forceCar ovan
      forceCar(kind, opts) { return forceCar(kind, opts); },
      // ett helt steg utan att gå: 'hissa' | 'skruvdragare' | 'skruvar' | 'skruv' ({i}) |
      // 'däck av' ({keep}) | 'stapel' | 'nytt däck' ({kind, keep}) | 'skruva fast' ({kryss:false}) |
      // 'luft' ({to: 0–1, hold}) | 'sänk'. opts.bay väljer lyft, opts.anim låter lyften röra sig.
      step(name, opts) { return debugStep(name, opts); },
      stage: (bay) => stageOf(Number.isInteger(bay) ? carOf(BAYS[bay]) : focusCar()),
      tire: (bay) => tireInfo(Number.isInteger(bay) ? carOf(BAYS[bay]) : tireCar()),
      spot: (id) => debugSpot(id),
      hud: () => hudInfo(),
      hint: () => { const h = hintFor(focusCar()); return h && needTip(h.key) ? h.txt : null; },
      resetTips() { for (const k of Object.keys(tips)) delete tips[k]; saveTips(tips); },
      learnAll() { for (const k of ['HISSA', 'SÄNK', 'DEL', 'LAGA', 'SKRUVDRAGARE', 'SKRUVAR', 'DÄCK AV', 'STAPEL', 'NYTT DÄCK', 'SKRUVA FAST', 'LUFT']) tips[k] = 9; saveTips(tips); },
      wrenches: () => wrenches.map((w) => ({ ...w })),
      piles: () => piles.map((p) => p.n),
      // ger spelaren reservdel p i händerna (0 = ett sommarhjul ur däckstället)
      pickPart(p = 1) { p = clamp(p | 0, 0, 4); carry = p === 0 ? { wheel: 'sommar', old: false } : { p }; return p; },
      carrying: () => carryName(),
      cars: () => cars.map((c) => ({ bay: c.bay.i, fault: c.fault, kind: c.kind, state: c.state, stage: stageOf(c), prog: c.prog, patience: +c.patience.toFixed(2), tire: c.tj ? c.tj.want : null })),
      // de puffar som syns just nu: [{x, y, txt, tag}] (y är rutans överkant)
      pops: () => pops.list(),
      // laga direkt: right=true → en väntande bil blir klar och betald (ok +1, däckbyte +3);
      // right=false → fel del i en bil med ett annat fel (fel +1). Utan bil: null.
      repair(right = true) {
        const ws = cars.filter((c) => c.state === 'wait' || c.state === 'park');
        if (!ws.length) return null;
        if (right) {
          const c = ws[0];
          if (c.tj) Object.assign(c.tj, { tire: 'new', mounted: c.tj.want, spin: null, air: (GREEN_LO + GREEN_HI) / 2, aired: true }), c.tj.bolts.fill(true);
          finish(c); c.state = 'lower'; c.bay.moving = c.bay.lift > 0 ? 1 : 0; payOut(c);
          return stats;
        }
        const c = ws.find((k) => !k.tj) || ws[0];
        if (c.tj) wrongTire(c); else { carry = { p: (c.fault % 4) + 1 === c.fault ? 1 : (c.fault % 4) + 1 }; wrongPart(c); }
        return stats;
      },
      // ställ mekanikern vid lyftens arbetsplats och håll inne (gamla felen: fronten;
      // däckbyte: det punkterade hjulet) – det som händer sedan går den riktiga vägen via update
      holdAt(bay = 0) {
        const b = BAYS[bay], c = carOf(b);
        const s = c && c.tj ? wheelSpot(c, c.tj.wheel) : spotOf(b);
        walker.stop(); walker.px = s.x; walker.py = s.y;
        hold.on = true; hold.bay = b.i; hold.wheel = c && c.tj ? c.tj.wheel : -1;
        if (c && c.tj) actWheel(c, c.tj.wheel, 'click');
        return s;
      },
      release() { hold.on = false; keyHold = 0; if (airing) { const c = airing; airing = null; judgeAir(c); } },
      // låt kunden vid lyft `bay` tröttna nästan direkt (test av sur kund som kör iväg)
      expire(bay = 0) { const c = carOf(BAYS[bay]); if (!c || (c.state !== 'wait' && c.state !== 'park')) return false; c.patience = 0.05; c.lastWork = -9; return true; },
      teleport(x, y) { walker.stop(); walker.px = x; walker.py = y; },
      // klickpunkter (spelkoordinater) för reservdelshyllorna (1–4; 0 = däckstället) och bilar
      stationSpot: (i = 1) => (i <= 0 ? { x: SLOTS[0].x, y: 62 } : { x: PART_X[clamp(i, 1, 4)], y: 80 }),
      carSpot: (bay = 0) => { const b = BAYS[bay] || BAYS[0]; return { x: b.lx + RUN / 2, y: b.base - 16 }; },
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      for (const p of fx) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      fx = fx.filter((p) => p.life > 0);
      for (const n of notes) { n.age += dt; n.y -= 9 * dt; n.x += Math.sin(n.age * 5 + n.k) * 0.25; }
      notes = notes.filter((n) => n.age < 1.8);
      if ((noteIn -= dt) <= 0) { noteIn = 1.4 + Math.random() * 1.2; notes.push({ x: RADIO.x + 18, y: RADIO.y + 2, age: 0, k: Math.random() * 6, two: Math.random() < 0.4 }); }
      shake = Math.max(0, shake - dt);
      hoseBack.t = Math.max(0, hoseBack.t - dt);
      // rullportarna: öppna när en bil är på väg in eller ut
      for (const b of BAYS) {
        const c = carOf(b);
        let want = 0;
        if (c) {
          if (c.state === 'drive') want = c.face ? (c.x + c.L > FW - 10 ? 1 : 0) : (c.x < 10 ? 1 : 0);
          else if (c.state === 'board' || c.state === 'leave') want = 1;
        }
        b.port = clamp(b.port + clamp(want - b.port, -dt * 1.6, dt * 1.6), 0, 1);
        b.press = Math.max(0, b.press - dt);
        if (b.moving && (b.hum -= dt) <= 0) { b.hum = 0.3; play('slide'); }   // hydrauliken pumpar
      }
      // kompressorn: startar av sig själv ibland och går när man fyller luft
      compRun = Math.max(0, compRun - dt);
      if ((compIn -= dt) <= 0) { compIn = 14 + Math.random() * 10; compRun = Math.max(compRun, 2.4); }
      if (compRun > 0) compPh += dt * 14;
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; working = null; return; }
      walker.update(dt);
      keyHold = Math.max(0, keyHold - dt);
      hintCool = Math.max(0, hintCool - dt);
      if (stowIn > 0 && (stowIn -= dt) <= 0) stowHose();
      // nya bilar – punkteringar är vanligast
      carIn -= dt;
      if (carIn <= 0) {
        carIn = 8.5 - 2.5 * Math.min(1, t / SHIFT_SECONDS) + Math.random() * 3;
        const free = freeBays();
        if (free.length) {
          const b = free[(Math.random() * free.length) | 0];
          const recent = cars.filter((c) => c.state !== 'leave').map((c) => c.fault);
          let f = Math.random() < 0.6 ? 0 : 1 + ((Math.random() * 4) | 0);
          if (f && recent.includes(f)) f = 1 + (f % 4);
          cars.push(makeCar(b, f));
        }
      }
      for (const c of cars) stepCar(c, dt);
      cars = cars.filter((c) => !c.gone);
      // däckbytet: skruvar som snurrar och luft som fylls
      if (pulse > 0 && (pulse -= dt) <= 0 && pulseCar) { const c = pulseCar; pulseCar = null; airing = null; judgeAir(c); }
      for (const c of cars) {
        const j = c.tj;
        if (!j) continue;
        if (c.state !== 'wait') { j.spin = null; continue; }
        if (j.spin) {
          if (!hasWrench() || !atWheel(c, j.wheel)) { j.spin = null; j.queued = null; }
          else {
            j.spin.t += dt; c.lastWork = t;
            if ((spinTick -= dt) <= 0) { spinTick = 0.07; play('click'); }
            if (Math.random() < 0.4) addFx(wheelX(c, j.wheel) + Math.round((Math.random() - 0.5) * 4), wheelCY(c) + Math.round((Math.random() - 0.5) * 4), (Math.random() - 0.5) * 36, -10 - Math.random() * 24, 110, 0.25, Math.random() < 0.5 ? '#ffe27a' : '#ffffff');
            if (j.spin.t >= SPIN_T) boltDone(c);
          }
        }
        const fill = hasHose() && j.tire === 'new' && !j.aired && j.bolts.every(Boolean) && atWheel(c, j.wheel)
          && ((hold.on && hold.bay === c.bay.i && hold.wheel === j.wheel) || (pulse > 0 && pulseCar === c));
        if (fill) {
          airing = c; hoseCar = c;
          j.air = Math.min(1.02, j.air + AIR_RATE * dt); c.lastWork = t;
          compRun = Math.max(compRun, 0.6);
          if ((hissTick -= dt) <= 0) { hissTick = 0.32; play('slide'); }
          const vx = wheelX(c, j.wheel), vy = wheelCY(c) - c.spec.r + 2;
          if (Math.random() < 0.5) addFx(vx + (Math.random() - 0.5) * 2, vy, (Math.random() - 0.5) * 14, -8 - Math.random() * 8, -4, 0.35, 'rgba(255,255,255,0.75)');
          if (j.air >= 1) pang(c);
        }
      }
      // de gamla felen: håll inne vid fronten
      working = null;
      const holding = hold.on || keyHold > 0;
      if (holding && hold.bay >= 0 && !walker.path.length) {
        const b = BAYS[hold.bay], c = carOf(b), s = spotOf(b);
        const near = Math.hypot(walker.px - s.x, walker.py - s.y) < 6;
        if (near && c && !c.tj) {
          if (c.state === 'park' || c.state === 'raise') {
            if (c.state === 'park') tipAt('HISSA UPP BILEN FÖRST!');
            hold.on = false; keyHold = 0;
          } else if (c.state === 'wait') {
            walker.dir = faceCar(b, s.x);
            if (!carry || carry.p === undefined) {
              tipAt(carry ? 'FEL SAK I HÄNDERNA' : 'HÄMTA RÄTT DEL!');
              hold.on = false; keyHold = 0;
            } else if (carry.p !== c.fault) wrongPart(c);
            else {
              c.prog = Math.min(1, c.prog + dt / REPAIR_T);
              c.lastWork = t;
              working = c;
              workFx(c, dt);
              if (c.prog >= 1) { learn('LAGA'); finish(c); }
            }
          }
        }
      }
    },
    down(x, y) {
      if (done) return;
      hold.on = false; hold.bay = -1; hold.wheel = -1;
      // 1) navbubblan: klicka på en skruv (eller var som helst i den = nästa skruv)
      const hb = hubHit(x, y);
      if (hb) { focus = hb.c.bay.i; boltClick(hb.c, hb.k, 'click'); return; }
      // 2) en skruvdragare som ligger på golvet
      const fw = wrenches.find((w) => w.at === 'floor' && Math.abs(x - w.x) <= 7 && y >= w.y - 9 && y <= w.y + 3);
      if (fw) { go({ x: fw.x, y: fw.y }, () => takeWrench(fw)); return; }
      // 3) lyftarnas manöverpaneler
      const pb = BAYS.find((b) => x >= b.panelX - 4 && x <= b.panelX + 10 && y >= b.panelY - 6 && y <= b.panelY + 13);
      if (pb) { focus = pb.i; go(panelSpot(pb), () => actPanel(pb)); return; }
      // 4) bakväggen: däckstället och reservdelshyllorna
      if (y >= 34 && y < PICK_Y + 8) {
        if (x >= RACK.x0 - 2 && x <= RACK.x1 + 2) {
          const col = x < (RACK.x0 + RACK.x1) / 2 ? 0 : 1, row = y < RACK.mid ? 0 : 1;
          const sl = SLOTS[row * 2 + col];
          go(slotSpot(sl), () => actRack(sl));
          return;
        }
        const p = PART_X.findIndex((px, i) => i > 0 && Math.abs(px - x) <= 13);
        if (p > 0) { go(partSpot(p), () => actStation(p)); return; }
      }
      // 5) kompressorn (luftslangen)
      if (Math.abs(x - COMP.x) <= 18 && y >= COMP.y - 28 && y <= COMP.y + 4) { go(compSpot(), actComp); return; }
      // 6) staplarna för gamla hjul
      const pl = piles.find((p) => Math.abs(x - p.x) <= 14 && y >= p.y - 14 - p.n * 5 && y <= p.y + 4);
      if (pl) { go(pileSpot(pl), () => actPile(pl)); return; }
      // 7) verktygsvagnarna (skruvdragarna)
      const ci = CARTS.findIndex((k) => Math.abs(x - k.x) <= 14 && y >= k.y - 34 && y <= k.y + 3);
      if (ci >= 0) { go(cartSpot(ci), () => actCart(ci)); return; }
      // 8) en bil (bubblan, bilen, hjulen eller lyften)
      const c = carAtPoint(x, y);
      if (c) { clickCar(c, x, y); return; }
      walker.walkTo(x, y);
    },
    up() {
      hold.on = false;
      if (airing && !(pulse > 0 && pulseCar === airing)) { const c = airing; airing = null; judgeAir(c); }
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      if ((k === ' ' || k === 'Enter') && !done) {
        // närmaste arbetsplats: ett hjul, en panel eller fronten
        const w = nearestWork();
        if (!w) return;
        if (w.type === 'wheel') actWheel(w.c, w.i, 'key');
        else if (w.type === 'panel') { const c = carOf(w.b); if (c && (c.state === 'park' || c.state === 'ready')) actPanel(w.b); else if (!c || c.state !== 'raise') actPanel(w.b); }
        else { keyHold = REPAIR_T + 0.15; hold.bay = w.b.i; }
      }
    },
    draw(ctx) {
      const sh = shake > 0 ? ((t * 40) | 0) % 2 * 2 - 1 : 0;       // PANG: bilden skakar en pixel
      ctx.setTransform(A.pxs, 0, 0, A.pxs, sh * A.pxs, 0);
      ctx.drawImage(bg(), 0, 0);
      drawLights(ctx, t);
      drawClock(ctx, startMin + (t / SHIFT_SECONDS) * 240);
      drawRackTires(ctx);
      for (const b of BAYS) drawPort(ctx, b);
      drawHoseFloor(ctx);
      const drawables = [...folkDrawables(A, t)];
      drawables.push(meDrawable(ctx));
      for (const b of BAYS) drawables.push({ fy: b.base, draw: () => drawBay(ctx, b, carOf(b)) });
      for (const c of cars) {
        if (!c.owner.show) continue;
        drawables.push({ fy: c.owner.y, draw: () => drawOwner(ctx, c) });
      }
      CARTS.forEach((k, ci) => drawables.push({ fy: k.y, draw: () => drawCart(ctx, k, ci) }));
      drawables.push({ fy: LAMP.y, draw: () => drawLamp(ctx) });
      drawables.push({ fy: JACK.y, draw: () => { const im = jackImg(); ctx.drawImage(im, JACK.x - 14, JACK.y - im.height + 1); } });
      for (const p of piles) drawables.push({ fy: p.y, draw: () => drawPile(ctx, p) });
      drawables.push({ fy: COMP.y, draw: () => drawComp(ctx) });
      for (const w of wrenches) if (w.at === 'floor') drawables.push({ fy: w.y, draw: () => { const im = wrenchImg(0); ctx.fillStyle = 'rgba(16,12,20,0.25)'; ctx.fillRect(w.x - 5, w.y, 10, 1); ctx.drawImage(im, w.x - (im.width >> 1), w.y - im.height + 1); } });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // gnistor, rök och ånga
      for (const p of fx) {
        ctx.globalAlpha = p.fade ? clamp(p.life / p.max * 1.4, 0, 1) : 1;
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
      ctx.globalAlpha = 1;
      drawNotes(ctx);
      // pratbubblor, navbubblor, luftmätare, framsteg och tut
      for (const c of cars) {
        const art = carArt(c), cx = Math.round(c.x + c.L / 2), topY = carGY(c) - art.topH;
        if (c.honk > 0) honkBubble(ctx, cx, topY - 2);
        if (c.tj && c.tj.bang > 0) bangStar(ctx, wheelX(c, c.tj.wheel), wheelCY(c), c.tj.bang);
        if (c.state === 'ready') { readyBubble(ctx, cx, topY - 2 - ((t * 3 | 0) % 2)); continue; }
        if (!['park', 'raise', 'wait'].includes(c.state)) continue;
        if (hubVisible(c)) { drawHubBubble(ctx, c); continue; }
        if (gaugeVisible(c)) { drawGaugeBubble(ctx, c); continue; }
        if (c.tj) { drawTireBubble(ctx, c, cx, topY - 2); continue; }
        const hot = !!carry && carry.p === c.fault;
        const tip = topY - 2 - (hot && (t * 4 | 0) % 2 ? 1 : 0);
        const [ix, iy] = bubble(ctx, cx, tip, 18, 19, hot);
        const s = partSprite(c.fault);
        ctx.drawImage(s, ix + ((18 - s.width) >> 1), iy + ((16 - s.height) >> 1));
        patienceBar(ctx, c, ix + 2, iy + 16, 14);
        // framstegsstapeln över mekanikerns arbetsplats (håller sig inom bild)
        if (c.prog > 0) { const s2 = spotOf(c.bay); progressBar(ctx, clamp(s2.x, 18, FW - 18), s2.y - 47, c.prog, working === c, t); }
      }
      // hjälptext: stå vid fronten med rätt del men håll inte inne (två rader,
      // så att även tangentbordsvägen nämns)
      if (!working && carry && carry.p !== undefined && !walker.path.length && needTip('LAGA')) {
        const i = nearestWork(), c = i && i.b ? carOf(i.b) : null;
        if (c && !c.tj && c.state === 'wait' && c.fault === carry.p && (t * 3 | 0) % 2 === 0) {
          const rows = ['HÅLL INNE!', 'ELLER MELLANSLAG'], iw = Math.max(...rows.map((s) => textW(SMALL, s))), w = iw + 6;
          const x = clamp(Math.round(walker.px - w / 2), 1, FW - w - 1), y = Math.round(walker.py) - (c.prog > 0 ? 66 : 58);
          ctx.fillStyle = '#17151a'; ctx.fillRect(x, y, w, 15);
          rows.forEach((s, j) => ctxText(ctx, SMALL, s, x + 3 + ((iw - textW(SMALL, s)) >> 1), y + 2 + j * 6, j ? '#d8d2c0' : '#ffd23f'));
        }
      }
      // de första gångerna: en pil som visar vart nästa steg är
      const fc = focusCar(), h = hintFor(fc);
      if (h && needTip(h.key)) hintArrow(ctx, h.x, h.y, h.txt, t);
      pops.draw(ctx);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'BILVERKSTADEN' });
      drawStepRow(ctx, fc);
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  // ---------- ritning per bildruta ----------
  function meDrawable(ctx) {
    const spinC = cars.find((c) => c.tj && c.tj.spin);
    const airC = airing && cars.includes(airing) ? airing : null;
    const busy = working || spinC || airC;
    if (busy) {
      const dir = working ? faceCar(working.bay, walker.px) : wheelSpot(busy, busy.tj.wheel).dir;
      return { fy: walker.py, draw: () => {
        drawPerson(ctx, walker.px, walker.py, A.avatar.look, dir, [7, 9, 8, 9][Math.floor(t * 7) % 4]);
        if (spinC) drawToolAtWheel(ctx, spinC, dir, true);
        if (airC) drawToolAtWheel(ctx, airC, dir, false);
      } };
    }
    const me = selfDrawable(A, walker, t, { carry: !!carry });
    return { fy: walker.py, draw: () => {
      const behind = walker.dir === 'up';
      if (carry && behind) drawCarried(ctx);
      me.draw(ctx);
      if (carry && !behind) drawCarried(ctx);
    } };
  }
  // det jag bär, i händerna framför kroppen (bakom när jag går uppåt)
  function drawCarried(ctx) {
    const h = handPos(), px = h.x;
    let img = null, lift = 11;
    if (carry.p !== undefined) img = partSprite(carry.p);
    else if (carry.wrench !== undefined) { img = wrenchImg(walker.dir === 'left' ? 1 : 0); lift = 14; }
    else if (carry.wheel) { img = carry.old ? kindFlat(carry.wheel) : kindWheel(carry.wheel); lift = 9; }
    else if (carry.hose) { img = nozzleImg(); lift = 15; }
    if (!img) return;
    const x = px - (img.width >> 1), y = Math.round(walker.py) - lift - img.height;
    if (carry.hose) {   // slangen hänger från munstycket ner till golvet
      ctx.fillStyle = '#a82820';
      for (let yy = y + img.height; yy <= Math.round(walker.py); yy++) ctx.fillRect(px + (((yy >> 2) & 1) ? 1 : 0) - 1, yy, 1, 1);
    }
    ctx.drawImage(img, x, y);
  }
  // skruvdragaren mot navet (snurrar) eller luftmunstycket på ventilen
  function drawToolAtWheel(ctx, c, dir, spinning) {
    const wx = wheelX(c, c.tj.wheel), wy = wheelCY(c), toLeft = dir === 'left';
    if (spinning) {
      const im = wrenchImg(toLeft ? 1 : 0), jig = (t * 30 | 0) % 2;
      const x = toLeft ? wx + 2 : wx - im.width - 1, y = wy - (im.height >> 1) + jig;
      ctx.drawImage(im, x, y);
    } else {
      const im = nozzleImg(), vx = wx, vy = wy - c.spec.r + 1;
      const hand = { x: Math.round(walker.px) + (toLeft ? -6 : 6), y: Math.round(walker.py) - 18 };
      ctx.fillStyle = '#a82820';
      const n = Math.max(Math.abs(hand.x - vx), Math.abs(hand.y - vy)) || 1;
      for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(hand.x + (vx - hand.x) * i / n), Math.round(hand.y + (vy - hand.y) * i / n + Math.sin(i / n * Math.PI) * 2), 1, 1);
      for (let yy = hand.y; yy <= Math.round(walker.py); yy++) ctx.fillRect(hand.x, yy, 1, 1);
      ctx.drawImage(im, vx - (im.width >> 1), vy - im.height + 1);
    }
  }
  // slangen från kompressorn längs golvet till fötterna (ritas under allt annat)
  function drawHoseFloor(ctx) {
    let ex, ey;
    if (hasHose()) {
      const busyAt = airing && cars.includes(airing);
      const h = handPos();
      ex = busyAt ? Math.round(walker.px) + (walker.dir === 'left' ? -6 : 6) : h.x;
      ey = Math.round(walker.py) + 1;
    } else if (hoseBack.t > 0) {
      const k = hoseBack.t / 0.4;
      ex = Math.round(HOSE_OUT.x + (hoseBack.x - HOSE_OUT.x) * k); ey = Math.round(COMP.y + 2 + (walker.py + 1 - COMP.y - 2) * k);
    } else return;
    const ax = HOSE_OUT.x + 2, ay = COMP.y + 2;
    ctx.fillStyle = '#8a1a14';
    for (let y = HOSE_OUT.y; y <= ay; y++) ctx.fillRect(ax, y, 1, 1);
    const n = Math.max(1, Math.round(Math.hypot(ex - ax, ey - ay)));
    for (let i = 0; i <= n; i++) {
      const k = i / n, wob = Math.round(Math.sin(k * 9 + 1.3) * 2 * Math.sin(k * Math.PI));
      const x = Math.round(ax + (ex - ax) * k), y = Math.round(ay + (ey - ay) * k) + wob;
      ctx.fillStyle = i % 3 ? '#c8322a' : '#8a1a14';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  function drawRackTires(ctx) {
    for (const sl of SLOTS) {
      const r = TIRE_R[sl.kind], img = kindWheel(sl.kind), bottom = sl.row ? RACK.y1 - 2 : RACK.mid - 1;
      const n = carry && carry.wheel === sl.kind && !carry.old ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const cx = sl.x + (i ? r + 1 : -r - 1);
        ctx.drawImage(img, cx - r, bottom - 2 * r);
      }
    }
  }
  // rullporten i sidoväggen: karmen, lamellerna som rullas upp och dagsljuset som faller in
  function drawPort(ctx, b) {
    const L = !b.face, w = 6, x0 = L ? 0 : FW - w, yb = b.base - 46, yf = b.base + 5, o = b.port;
    if (o > 0.02) {
      ctx.globalAlpha = Math.min(1, o * 1.2);
      const sp = spillImg(L);
      ctx.drawImage(sp, L ? 0 : FW - sp.width, b.base - 17);
      ctx.globalAlpha = 1;
    }
    // öppningen: himmel och asfalt utanför
    for (let y = yb + 4; y < yf; y++) {
      const k = (y - yb) / (yf - yb);
      ctx.fillStyle = y > yf - 7 ? (y % 2 ? '#8a8e88' : '#9a9e96') : k < 0.4 ? '#cfe6fa' : k < 0.7 ? '#e2f0fb' : '#bfd8a0';
      ctx.fillRect(x0, y, w, 1);
    }
    // lamellerna (rullas upp i kåpan)
    const cover = Math.round((1 - o) * (yf - yb - 4));
    for (let y = yb + 4, i = 0; i < cover; y++, i++) {
      const m = (i + cover) % 3;
      ctx.fillStyle = m === 0 ? '#5a626c' : m === 1 ? '#a8b2bc' : '#86909a';
      ctx.fillRect(x0, y, w, 1);
    }
    if (cover > 0) { ctx.fillStyle = '#2a2b31'; ctx.fillRect(x0, yb + 4 + cover - 1, w, 1); }
    // kåpan och karmen med varningsränder
    ctx.fillStyle = '#26272d'; ctx.fillRect(x0, yb, w, 4);
    ctx.fillStyle = '#5a5e68'; ctx.fillRect(x0, yb, w, 1);
    const ex = L ? x0 + w - 1 : x0;
    for (let y = yb; y < yf; y++) { ctx.fillStyle = y < yb + 4 ? '#17151a' : ((y >> 1) & 1) ? '#f2c230' : '#17151a'; ctx.fillRect(ex, y, 1, 1); }
    ctx.fillStyle = '#17151a'; ctx.fillRect(L ? x0 : x0 + w - 1, yb, 1, yf - yb);
    // tröskeln
    ctx.fillStyle = '#6a6e78'; ctx.fillRect(x0, yf, w + 2, 1);
    ctx.fillStyle = '#2a2b31'; ctx.fillRect(x0, yf + 1, w + 2, 1);
    // en liten lampa på kåpan blinkar när porten rör sig
    if (o > 0.02 && o < 0.98 && (t * 6 | 0) % 2) { ctx.fillStyle = '#ffb020'; ctx.fillRect(L ? x0 + 2 : x0 + 3, yb - 1, 2, 1); }
  }
  function drawComp(ctx) {
    const im = compImg(), running = compRun > 0, jig = running ? ((t * 24) | 0) % 2 : 0;
    const x0 = COMP.x - 18, y0 = COMP.y - im.height + 1 - jig;
    ctx.drawImage(im, x0, y0);
    // svänghjulet bakom remskyddets spalter
    const fx0 = x0 + 27, fy0 = y0 + 8;
    for (let k = 0; k < 3; k++) {
      const a = compPh + k * Math.PI * 2 / 3;
      ctx.fillStyle = k ? '#8a8e96' : '#dce0e8';
      ctx.fillRect(fx0 + Math.round(Math.cos(a) * 2), fy0 + Math.round(Math.sin(a) * 2), 1, 1);
    }
    // manometern på tanken: visaren står högre när motorn har gått
    const need = running ? 0.75 : 0.62, ang = Math.PI * (1.15 + need * 0.7);
    ctx.fillStyle = '#d8342a'; ctx.fillRect(x0 + 10 + Math.round(Math.cos(ang) * 1.4), y0 + 16 + Math.round(Math.sin(ang) * 1.4), 1, 1);
    // den ihoprullade slangen på handtaget (borta när man bär den)
    if (!hasHose() && hoseBack.t <= 0) {
      const hx = x0 + 31, hy = y0 + 9;
      for (const [rx, ry, dy] of [[3, 5, 0], [2.5, 4.5, 1], [3, 5, 2]]) {
        for (let a = 0; a < 20; a++) {
          const an = a / 20 * Math.PI * 2;
          ctx.fillStyle = a % 5 ? '#c8322a' : '#8a1a14';
          ctx.fillRect(hx + Math.round(Math.cos(an) * rx), hy + dy + Math.round(Math.sin(an) * ry), 1, 1);
        }
      }
      ctx.fillStyle = '#b8861a'; ctx.fillRect(hx - 1, hy + 9, 2, 2);      // munstycket hänger längst ner
    }
    // avgaspuffar ur motorn när den går
    if (running && Math.random() < 0.08) addFx(x0 + 4, y0 + 7, -6 - Math.random() * 6, -8, -4, 0.6, 'rgba(210,210,215,0.6)');
  }
  function drawPile(ctx, p) {
    const im = pileImg(p.n);
    ctx.drawImage(im, p.x - (im.width >> 1), p.y - im.height + 1);
  }

  function drawBay(ctx, b, c) {
    const lift = Math.round(b.lift), rt = b.base - RAMP - lift, x0 = b.lx, x1 = b.lx + RUN - 1;
    // skugga under banan när den är uppe
    if (lift > 0) {
      ctx.fillStyle = 'rgba(16,12,20,0.22)'; ctx.fillRect(x0 + 3, b.base - 3, RUN - 6, 2);
      ctx.fillStyle = 'rgba(16,12,20,0.12)'; ctx.fillRect(x0 + 8, b.base - 1, RUN - 16, 1);
    }
    // oljepöl
    if (c && c.puddle > 0) {
      const q = c.L - 13, px = sx(c, q), rx = 1 + Math.round(c.puddle * 5);
      ctx.fillStyle = '#17140e'; ctx.fillRect(px - rx, b.base - 6, rx * 2 + 1, 2); ctx.fillRect(px - rx + 1, b.base - 7, rx * 2 - 1, 1);
      ctx.fillStyle = '#6a5a8a'; ctx.fillRect(px - 1, b.base - 6, 1, 1);
      ctx.fillStyle = '#c89a3a'; ctx.fillRect(px + 1, b.base - 7, 1, 1);
    }
    // hydraulcylindrarna under banan
    for (const cx of [x0 + 16, x1 - 16]) {
      ctx.fillStyle = '#2a2b31'; ctx.fillRect(cx - 2, b.base - 6, 5, 5);
      ctx.fillStyle = '#5a5e68'; ctx.fillRect(cx - 1, b.base - 6, 1, 5);
      ctx.fillStyle = '#17181c'; ctx.fillRect(cx - 2, b.base - 2, 5, 1);
      if (lift > 1) {
        ctx.fillStyle = '#d8dce4'; ctx.fillRect(cx, rt + 4, 1, b.base - 6 - (rt + 4));
        ctx.fillStyle = '#8a8e96'; ctx.fillRect(cx + 1, rt + 4, 1, b.base - 6 - (rt + 4));
        if (b.moving) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx, rt + 4 + ((t * 20 | 0) % Math.max(1, b.base - 10 - rt)), 1, 1); }
      }
    }
    // oljedroppe på väg ner
    if (c && c.drip) { ctx.fillStyle = '#2a2010'; ctx.fillRect(Math.round(c.drip.x), Math.round(c.drip.y), 1, 2); ctx.fillStyle = '#c89a3a'; ctx.fillRect(Math.round(c.drip.x), Math.round(c.drip.y), 1, 1); }
    // banan
    ctx.drawImage(runwayImg(), x0 - 1, rt);
    // uppfartsramp (nere) eller uppfälld ramp (uppe) i infartsänden
    const ex = b.face ? x1 + 2 : x0 - 2, sg = b.face ? 1 : -1;
    if (lift < 1) {
      for (let i = 0; i < 6; i++) {
        const hh = Math.ceil((6 - i) * RAMP / 6), xx = ex + sg * i;
        ctx.fillStyle = '#6a6e78'; ctx.fillRect(xx, b.base - hh, 1, hh);
        ctx.fillStyle = '#a8acb6'; ctx.fillRect(xx, b.base - hh, 1, 1);
      }
    } else {
      ctx.fillStyle = '#6a6e78'; ctx.fillRect(ex, rt - 5, 1, 6);
      ctx.fillStyle = '#a8acb6'; ctx.fillRect(ex, rt - 5, 1, 1);
      ctx.fillStyle = '#f2c230'; ctx.fillRect(ex, rt - 3, 1, 1);
    }
    // stoppklack vid fronten
    const sx0 = b.face ? x0 + 1 : x1 - 1;
    ctx.fillStyle = '#3a3c44'; ctx.fillRect(sx0, rt - 2, 1, 2);
    if (c) drawCar(ctx, c);
    // pelarna (framför bilen) med tvärbalkarna
    const img = postImg();
    for (const px of [x0 - 5, x1 + 1]) {
      ctx.drawImage(img, px - 1, b.base - POST_H);
      ctx.fillStyle = '#26272d'; ctx.fillRect(px - 1, rt - 1, 6, 6);
      ctx.fillStyle = '#5a5e68'; ctx.fillRect(px - 1, rt - 1, 6, 1);
      ctx.fillStyle = '#3e4048'; ctx.fillRect(px, rt, 4, 4);
      ctx.fillStyle = '#8a8e98'; ctx.fillRect(px + 1, rt + 1, 1, 1); ctx.fillRect(px + 3, rt + 3, 1, 1);
    }
    drawPanel(ctx, b, c);
  }
  // manöverpanelen: grön pil upp, röd pil ner och en statuslampa. Knappen
  // för nästa steg blinkar; den man tryckt på lyser en stund.
  function drawPanel(ctx, b, c) {
    const x = b.panelX - 1, y = b.panelY - 3, st = c ? c.state : null;
    const blinkUp = st === 'park' && (t * 3 | 0) % 2, blinkDn = st === 'ready' && (t * 3 | 0) % 2;
    ctx.fillStyle = '#17151a'; ctx.fillRect(x + 1, y, 6, 13); ctx.fillRect(x, y + 1, 8, 11);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x + 1, y + 1, 6, 11);
    ctx.fillStyle = '#eef2f6'; ctx.fillRect(x + 1, y + 1, 6, 1);
    ctx.fillStyle = '#8a8e96'; ctx.fillRect(x + 1, y + 11, 6, 1);
    const up = (b.press > 0 && b.pressUp) || blinkUp, dn = (b.press > 0 && !b.pressUp) || blinkDn;
    ctx.fillStyle = up ? '#8ef08c' : '#2e8a48'; ctx.fillRect(x + 3, y + 2, 2, 1); ctx.fillRect(x + 2, y + 3, 4, 1);
    ctx.fillStyle = dn ? '#ff8a7a' : '#a82820'; ctx.fillRect(x + 2, y + 6, 4, 1); ctx.fillRect(x + 3, y + 7, 2, 1);
    ctx.fillStyle = b.moving && (t * 6 | 0) % 2 ? '#ffb020' : st === 'ready' ? '#45d864' : '#6a4a1a';
    ctx.fillRect(x + 3, y + 9, 2, 1);
    // kabeln upp till pelartoppen
    ctx.fillStyle = '#26272d'; ctx.fillRect(b.face ? x + 7 : x, y - 6, 1, 6);
  }

  function drawCar(ctx, c) {
    const s = c.spec, art = carArt(c), f = c.face, L = c.L, gY = carGY(c), x = Math.round(c.x);
    ctx.drawImage(art.img[f], x - 1, gY - art.gy);
    if (c.brake) ctx.drawImage(art.brake[f], x - 1, gY - art.gy);
    const P = (q, h, col) => { ctx.fillStyle = col; ctx.fillRect(sx(c, q), gY - h, 1, 1); };
    const broken = !c.fixed && c.prog < 0.7;
    // trasig strålkastare: mörk och sprucken, glapper ibland, glassplitter på banan
    if (c.fault === 2 && broken) {
      const blink = Math.sin(t * 11 + c.id * 2.3) > 0.9 && Math.sin(t * 1.7 + c.id) > 0;
      for (const [q, h] of art.headPx) P(q, h, blink ? '#8a7a42' : (q + h) % 3 ? '#3a3c44' : '#2a2b31');
      const [q0, h0] = art.headPx[0] || [L - 2, 10];
      P(q0 + 1, h0, '#c8ccd4'); P(q0 + 2, h0 + 1, '#8a8e96');
      if (c.state === 'raise' || c.state === 'wait') {
        for (const [q, col] of [[L - 4, '#dcecff'], [L - 1, '#9ab8d8'], [L + 1, '#eef6ff'], [L + 2, '#7a98b8']]) P(q, 0, col);
      }
    }
    if (c.flash > 0 && (c.fault === 2 || c.fault === 4) && (c.flash * 8 | 0) % 2 === 0) {
      for (const [q, h] of art.headPx) P(q, h, '#ffffff');
      const [q0, h0] = art.headPx[art.headPx.length - 1] || [L - 1, 10];
      ctx.fillStyle = 'rgba(255,248,200,0.35)'; ctx.fillRect(sx(c, q0) + (f ? -5 : 1), gY - h0 - 2, 5, 5);
    }
    // rostigt, nedhängande avgasrör
    if (c.fault === 3) {
      const eh = art.eh;
      if (broken) {
        // röret har släppt sitt fäste och hänger i en båge, två pixlar tjockt
        const sag = [0, 0, 0, 1, 1, 2, 2, 2, 1, 1, 0];
        for (let q = 1; q <= 11; q++) {
          const h = eh - sag[q - 1];
          const hole = q === 6 || q === 7;
          P(q, h, hole ? '#2a1a10' : q === 1 ? '#3a2214' : (q * 7) % 5 < 2 ? '#d2803a' : '#b8642a');
          P(q, h - 1, hole && q === 6 ? '#1c120a' : (q * 3) % 4 === 0 ? '#8a4a1e' : '#6a3414');
        }
        P(0, eh, '#1c120a'); P(0, eh - 1, '#3a2214');                        // rostig mynning
        P(10, eh + 1, '#2a2b31'); P(9, eh + 2, '#2a2b31');                    // avbrutet upphängningsgummi
      } else {
        for (let q = 0; q <= 4; q++) { P(q, eh, q === 0 ? '#5a5e66' : '#eef2f6'); P(q, eh - 1, q === 0 ? '#2a2b30' : '#8a909a'); }
        P(2, eh, '#ffffff');
      }
    }
    // öppen motorhuv (olja och batteri)
    if ((c.fault === 1 || c.fault === 4) && (c.state === 'raise' || c.state === 'wait' || c.state === 'ready')) {
      const q0 = s.ws[1], q1 = L - 3, D = s.D;
      for (let q = q0 + 1; q <= q1; q++) {
        const h0 = art.ht[q];
        for (let k = 1; k <= D; k++) P(q, h0 + k, k === D ? '#3a3c44' : (q + k) % 3 ? '#1c1d22' : '#2a2b31');
      }
      const mq = Math.round((q0 + q1) / 2);
      if (c.fault === 1) { P(mq, art.ht[mq] + 2, c.fixed ? '#ffe27a' : '#f2c230'); P(mq - 3, art.ht[mq - 3] + 1, '#8a8e96'); }
      else {
        P(mq + 1, art.ht[mq + 1] + 1, '#17181d'); P(mq + 2, art.ht[mq + 2] + 1, '#17181d'); P(mq + 3, art.ht[mq + 3] + 1, '#17181d');
        P(mq + 1, art.ht[mq + 1] + 2, '#3a3c44'); P(mq + 3, art.ht[mq + 3] + 2, '#d8342a');
      }
      // huven står uppfälld från vindrutans fot: en tre pixlar tjock plåt –
      // lackad utsida (framåt), mörk isoleringsmatta på insidan, svart kontur
      const len = Math.max(8, Math.min(13, q1 - q0 - 1)), dir = f ? -1 : 1;
      const hx = sx(c, q0 + 1), hy = gY - art.ht[q0 + 1] - D;
      const lit = css(mix(c.color, 0xffffff, 0.34)), mid = css(c.color), edge = css(mix(mul(c.color, 0.4), 0x0a0a10, 0.4));
      // stödstaget från motorrummet upp till huvens mitt
      const hq = Math.round(len * 0.55);
      const ax = hx + dir * (Math.round(hq * 0.38) - 2), ay = hy - Math.round(hq * 0.93), bx = hx + dir * 7, by = hy + 1;
      const n = Math.max(Math.abs(ax - bx), Math.abs(ay - by));
      for (let j = 0; j <= n; j++) { ctx.fillStyle = j % 2 ? '#8a8e96' : '#c8ccd4'; ctx.fillRect(Math.round(bx + (ax - bx) * j / n), Math.round(by + (ay - by) * j / n), 1, 1); }
      for (let i = 0; i <= len; i++) {
        const xx = hx + dir * Math.round(i * 0.38), yy = hy - Math.round(i * 0.93);
        const tip = i === len;
        ctx.fillStyle = edge; ctx.fillRect(xx + dir * 2, yy, 1, 1);            // kontur utåt
        ctx.fillStyle = tip ? edge : lit; ctx.fillRect(xx + dir, yy, 1, 1);    // lackad utsida
        ctx.fillStyle = tip ? edge : i < 2 ? '#26272c' : mid; ctx.fillRect(xx, yy, 1, 1);
        ctx.fillStyle = tip ? edge : (i & 1) ? '#3a3c44' : '#4a4c54'; ctx.fillRect(xx - dir, yy, 1, 1); // isoleringsmattan
        if (i === hq) { ctx.fillStyle = '#eef2f6'; ctx.fillRect(xx - dir, yy, 1, 1); }                  // stagets fäste
      }
      ctx.fillStyle = edge; ctx.fillRect(hx - 1, hy + 1, 3, 1);              // gångjärnet
    }
    // hjulen – däckbytets hjul visar sitt läge: platt, av (navet) eller nytt,
    // med skruvarna som små pixlar (släckta när de är ute)
    const rim = TIRE_RIM[c.tk], n = RIMN[rim], per = (Math.PI * 2) / n, rot = (c.dist / s.r) * (f ? -1 : 1);
    const fr = Math.floor(((((rot % per) + per) % per) / per) * NF) % NF;
    const j = c.tj, still = c.state !== 'drive' && c.state !== 'leave';
    s.wheels.forEach((wx, i) => {
      const q = f ? L - 1 - wx : wx, cx = x + q, cy = gY - s.r;
      if (!j || i !== j.wheel || c.state === 'leave' || (c.fixed && j.aired)) { ctx.drawImage(wheelArt(s.r, rim, fr, c.tk), cx - s.r, gY - 2 * s.r); return; }
      if (j.tire === 'off') { ctx.drawImage(hubCarImg(s.r, j.n), cx - s.r, cy - s.r); return; }
      const soft = j.tire === 'flat' || j.air < 0.5;
      if (soft) ctx.drawImage(j.tire === 'flat' ? flatArt(s.r, rim) : kindFlat(j.mounted), cx - s.r - 2, gY - 2 * s.r);
      else ctx.drawImage(kindWheel(j.mounted), cx - s.r, gY - 2 * s.r);
      if (!still) return;
      const oy = soft ? 1 : 0;
      for (let k = 0; k < j.n; k++) {
        const [bx, by] = boltPos(s.r, j.n, k);
        const spin = j.spin && j.spin.i === k;
        ctx.fillStyle = spin ? ((t * 16 | 0) % 2 ? '#ffe27a' : '#ffffff') : j.bolts[k] ? '#f4f6fa' : '#121216';
        ctx.fillRect(cx + bx, cy + by + oy, 1, 1);
      }
    });
    // backljus när bilen backar ut
    if (c.state === 'leave') {
      const tl = s.tail, bx = sx(c, 1), by = gY - tl.h0 - 1;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, 1, 1);
      ctx.fillStyle = 'rgba(255,255,240,0.3)'; ctx.fillRect(bx + (f ? 1 : -3), by - 1, 3, 3);
    }
  }

  function drawOwner(ctx, c) {
    const o = c.owner, b = c.bay;
    const toward = b.face ? 'left' : 'right';
    const jump = o.angry > 0 ? Math.round(Math.abs(Math.sin(t * 15)) * 2) : o.happy > 0 ? Math.round(Math.abs(Math.sin(t * 9)) * 2) : 0;
    const dir = o.walk ? o.dir : o.angry > 0 ? toward : Math.sin(t * 0.8 + c.id * 1.7) > 0.35 ? toward : 'down';
    const frame = o.walk ? WALK_SEQ[Math.floor(t * 8.5 + c.id * 0.37) % 4] : o.happy > 0 ? 7 : (Math.sin(t * 2 + c.id) > 0.93 ? 4 : 0);
    drawPerson(ctx, o.x, o.y - jump, o.look, dir, frame);
    const side = o.x > FW - 24 ? -1 : 1;   // ikonerna hamnar innanför bildkanten
    if ((o.angry > 0 || (c.tj && c.tj.late && c.state === 'wait')) && (t * 5 | 0) % 2 === 0) {
      const ax = Math.round(o.x) + (side > 0 ? 7 : -12), ay = Math.round(o.y) - 48 - jump;
      ctx.fillStyle = '#17151a'; ctx.fillRect(ax, ay, 5, 10);
      ctx.fillStyle = '#d9433b'; ctx.fillRect(ax + 1, ay + 1, 3, 5); ctx.fillRect(ax + 1, ay + 7, 3, 2);
    }
    if (o.happy > 0) {   // ett litet hjärta
      const hx = Math.round(o.x) + (side > 0 ? 6 : -13), hy = Math.round(o.y) - 50 - jump;
      ctx.fillStyle = '#17151a'; ctx.fillRect(hx, hy + 1, 7, 3); ctx.fillRect(hx + 1, hy, 2, 5); ctx.fillRect(hx + 4, hy, 2, 5); ctx.fillRect(hx + 2, hy + 4, 3, 2); ctx.fillRect(hx + 3, hy + 6, 1, 1);
      ctx.fillStyle = '#ff5a7a'; ctx.fillRect(hx + 1, hy + 1, 2, 3); ctx.fillRect(hx + 4, hy + 1, 2, 3); ctx.fillRect(hx + 3, hy + 2, 1, 3); ctx.fillRect(hx + 2, hy + 4, 3, 1);
      ctx.fillStyle = '#ffc0cc'; ctx.fillRect(hx + 1, hy + 1, 1, 1);
    }
  }

  function drawCart(ctx, k, ci) {
    const img = cartImg(k.kind);
    ctx.drawImage(img, k.x - (img.width >> 1), k.y - img.height + 1);
    const tray = k.y - img.height + 3;
    // skruvdragaren ligger på brickan när den är hemma
    if (wrenches.some((w) => w.at === 'cart' && w.cart === ci)) {
      const wi = wrenchImg(0);
      ctx.drawImage(wi, k.x - 12, tray - wi.height + 1);
      if (needTip('SKRUVDRAGARE') && (t * 2 | 0) % 2 === 0) { ctx.fillStyle = 'rgba(255,240,160,0.35)'; ctx.fillRect(k.x - 12, tray - wi.height + 1, wi.width, wi.height); }
    }
    if (k.kind === 0) {   // kaffekoppen på den röda vagnen, med ånga
      const mx = k.x + 4, my = tray;
      ctx.fillStyle = '#17151a'; ctx.fillRect(mx - 1, my - 6, 6, 6); ctx.fillRect(mx + 5, my - 5, 2, 3);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(mx, my - 5, 4, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx, my - 5, 1, 4);
      ctx.fillStyle = '#c8c2b2'; ctx.fillRect(mx + 3, my - 4, 1, 4); ctx.fillRect(mx + 5, my - 4, 1, 1);
      ctx.fillStyle = '#d8342a'; ctx.fillRect(mx + 1, my - 3, 2, 2);
      ctx.fillStyle = '#5a3418'; ctx.fillRect(mx, my - 6, 4, 1);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i * 0.33) % 1;
        const x = mx + 1 + (i % 2) + Math.round(Math.sin(t * 2.6 + i * 2) * 1.2), y = my - 7 - Math.round(ph * 9);
        ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - ph)).toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1 + (ph < 0.4 ? 1 : 0));
      }
    } else {              // en burk med skruvar på den blå vagnen
      const mx = k.x + 5, my = tray;
      ctx.fillStyle = '#17151a'; ctx.fillRect(mx - 1, my - 5, 6, 5);
      ctx.fillStyle = '#8a8e96'; ctx.fillRect(mx, my - 4, 4, 4);
      ctx.fillStyle = '#c8ccd4'; ctx.fillRect(mx, my - 4, 1, 3);
      ctx.fillStyle = '#eef2f6'; ctx.fillRect(mx + 1, my - 5, 1, 1); ctx.fillRect(mx + 3, my - 5, 1, 1);
    }
  }

  function drawLamp(ctx) {
    const img = lampImg();
    ctx.drawImage(img, LAMP.x - 8, LAMP.y - img.height + 1);
    // halogenens sken
    const g = glowImg();
    ctx.drawImage(g, LAMP.x - 5 - (g.width >> 1), LAMP.y - 29 - (g.height >> 1));
  }

  function drawLights(ctx, time) {
    // det sista lysröret flimrar ibland
    const x = TUBES[3], cyc = time % 7.3;
    const on = !(cyc > 5.6 && hash(Math.floor(time * 13), 5, 9) > 0.3) && !(cyc > 2.1 && cyc < 2.18);
    if (on) {
      const g = tubeGlowImg();
      ctx.drawImage(g, x - (g.width >> 1), 28);
      ctx.fillStyle = '#f4fbff'; ctx.fillRect(x - 12, 29, 25, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 10, 29, 20, 1);
    } else {
      ctx.fillStyle = '#9aa4ae'; ctx.fillRect(x - 12, 29, 25, 1);
      ctx.fillStyle = '#c8d0d8'; ctx.fillRect(x - 12, 29, 2, 1); ctx.fillRect(x + 11, 29, 2, 1);
    }
  }

  function drawClock(ctx, min) {
    const { x, y } = CLOCK, h = ((min / 60) % 12) / 12 * Math.PI * 2, m = (min % 60) / 60 * Math.PI * 2;
    const hand = (a, len, col) => { ctx.fillStyle = col; for (let i = 1; i <= len; i++) ctx.fillRect(x + Math.round(Math.sin(a) * i), y - Math.round(Math.cos(a) * i), 1, 1); };
    hand(m, 4, '#2a2b31'); hand(h, 3, '#17151a');
    ctx.fillStyle = '#d8342a'; ctx.fillRect(x, y, 1, 1);
  }

  function drawNotes(ctx) {
    for (const n of notes) {
      const x = Math.round(n.x), y = Math.round(n.y);
      ctx.globalAlpha = clamp(1.6 - n.age, 0, 1);
      ctx.fillStyle = '#2a2b31';
      ctx.fillRect(x, y + 3, 2, 2); ctx.fillRect(x + 1, y, 1, 4); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 3, y + 1, 1, 1);
      if (n.two) { ctx.fillRect(x + 4, y + 2, 2, 2); ctx.fillRect(x + 5, y - 1, 1, 4); ctx.fillRect(x + 2, y - 1, 3, 1); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- bubblorna ----------
  function patienceBar(ctx, c, x, y, w) {
    const left = clamp(c.patience / c.pmax, 0, 1);
    ctx.fillStyle = '#cfc6b2'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
    ctx.fillRect(x, y, Math.max(1, Math.round(w * left)), 2);
    if (c.state === 'wait' || c.state === 'park') {
      if ((c.patience < 8 || (c.tj && c.tj.late)) && Math.sin(t * 6) > 0) {
        ctx.fillStyle = '#17151a'; ctx.fillRect(x + w + 1, y - 20, 5, 10);
        ctx.fillStyle = '#d9433b'; ctx.fillRect(x + w + 2, y - 19, 3, 5); ctx.fillRect(x + w + 2, y - 13, 3, 2);
      }
    }
  }
  // däckbytets bubbla: det platta däcket, minibilen uppifrån med det
  // punkterade hjulet blinkande och vilken sorts nytt däck som behövs
  function drawTireBubble(ctx, c, cx, tip) {
    const j = c.tj, IW = 31, IH = 26;
    const hot = !!carry && !carry.old && carry.wheel === j.want && j.tire === 'off';
    const [ix, iy] = bubble(ctx, cx, tip - (hot && (t * 4 | 0) % 2 ? 1 : 0), IW, IH, hot);
    if (j.tire === 'flat') {
      const fl = flatArt(6, 'alloy');
      ctx.drawImage(fl, ix, iy + 2);
      if ((t * 2.5 | 0) % 2 === 0) { ctx.fillStyle = '#9aa0aa'; ctx.fillRect(ix + 16, iy + 2, 1, 1); ctx.fillRect(ix + 17, iy + 1, 1, 1); ctx.fillRect(ix + 16, iy + 5, 2, 1); }
    } else {
      const im = kindWheel(j.want), r = TIRE_R[j.want];
      ctx.drawImage(im, ix + 8 - r, iy + 8 - r);
      if (j.tire === 'off') { ctx.fillStyle = '#2e8a48'; ctx.fillRect(ix + 15, iy + 1, 1, 3); ctx.fillRect(ix + 14, iy + 2, 3, 1); }   // "+"
    }
    drawMiniCar(ctx, c, ix + 21, iy);
    const s = TIRE_TXT[j.want], w = textW(SMALL, s);
    ctxText(ctx, SMALL, s, ix + ((IW - w) >> 1), iy + 17, TIRE_COL[j.want]);
    patienceBar(ctx, c, ix + 2, iy + 23, IW - 4);
  }
  // bilen uppifrån (fronten uppåt): vänster på bilen är vänster i bilden
  const MINI = ['..bbbbb..', '.bByBBBb.', 'WbBBBBBbW', 'WbgggggbW', 'WbBBBBBbW', '.bBBBBBb.', '.bBBBBBb.', '.bBBBBBb.', '.bBBBBBb.', '.bBBBBBb.', 'WbgggggbW', 'WbBBBBBbW', 'WbBBBBBbW', '.bBrBrBb.', '..bbbbb..'];
  function drawMiniCar(ctx, c, x0, y0) {
    const j = c.tj, col = c.color, flatCol = (t * 4 | 0) % 2 ? '#ff3a2a' : '#8a1a14';
    const flatX = c.face ? 0 : 8, flatRows = j.wheel ? [2, 3, 4] : [10, 11, 12];
    MINI.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        let k;
        if (ch === 'W') k = x === flatX && flatRows.includes(y) && j.tire !== 'new' ? flatCol : '#26262e';
        else if (ch === 'b') k = css(mix(mul(col, 0.45), 0x0a0a10, 0.35));
        else if (ch === 'B') k = css(y < 7 ? mix(col, 0xffffff, 0.12) : col);
        else if (ch === 'g') k = '#6f93b6';
        else if (ch === 'y') k = '#fff4c0';
        else if (ch === 'r') k = '#d42a2a';
        ctx.fillStyle = k; ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    });
    ctx.fillStyle = '#fff4c0'; ctx.fillRect(x0 + 5, y0 + 1, 1, 1);
  }
  function readyBubble(ctx, cx, tip) {
    const s = 'SÄNK', IW = textW(SMALL, s) + 14, IH = 9;
    const [ix, iy] = bubble(ctx, cx, tip, IW, IH, true);
    ctx.fillStyle = '#2e8a48';
    for (const [x, y] of [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [5, 3], [6, 2]]) ctx.fillRect(ix + 1 + x, iy + y, 1, 1);
    ctxText(ctx, SMALL, s, ix + 9, iy + 3, '#17151a');
    ctx.fillStyle = '#a82820'; ctx.fillRect(ix + IW - 4, iy + 2, 1, 4); ctx.fillRect(ix + IW - 5, iy + 5, 3, 1); ctx.fillRect(ix + IW - 4, iy + 6, 1, 1);
  }
  // navbubblan: hjulet i stort med skruvarna – klicka på dem en i taget. Den
  // som snurrar har en mätare runt sig; i kryssmönster-läget visar små
  // siffror en bra ordning de första gångerna.
  function drawHubBubble(ctx, c) {
    const g = hubGeom(c), j = c.tj;
    bubble(ctx, g.cx, g.tip, 31, 31, false);
    ctx.drawImage(hubFaceImg(j.tire === 'flat' ? 'flat' : j.mounted), g.ix, g.iy);
    const learnStar = j.tire === 'new' && needTip('SKRUVA FAST');
    const order = learnStar ? starOrder(j.n, j.order.length ? j.order[0] : 0) : null;
    g.bolts.forEach((p, k) => {
      const spin = j.spin && j.spin.i === k;
      if (j.bolts[k] && !(spin && j.spin.out && j.spin.t > SPIN_T * 0.8)) drawNut(ctx, p.x, p.y, spin ? (t * 18 | 0) % 4 : 0);
      else if (spin && !j.spin.out && j.spin.t > SPIN_T * 0.3) drawNut(ctx, p.x, p.y, (t * 18 | 0) % 4);
      else drawHole(ctx, p.x, p.y);
      if (spin) {   // snurr-mätaren runt skruven
        const prog = clamp(j.spin.t / SPIN_T, 0, 1);
        for (let a = 0; a < 16; a++) {
          const an = -Math.PI / 2 + a / 16 * Math.PI * 2;
          ctx.fillStyle = a / 16 < prog ? '#ffd23f' : 'rgba(23,21,26,0.35)';
          ctx.fillRect(p.x + Math.round(Math.cos(an) * 4), p.y + Math.round(Math.sin(an) * 4), 1, 1);
        }
      }
      if (order && !j.bolts[k]) {
        const m = order.indexOf(k);
        if (m >= 0) {
          const a = Math.atan2(p.y - g.hy, p.x - g.hx), dx = Math.round(Math.cos(a) * 5.5), dy = Math.round(Math.sin(a) * 5.5);
          ctxText(ctx, SMALL, String(m + 1), p.x + dx - 1, p.y + dy - 2, '#ffd23f');
        }
      }
    });
  }
  function drawNut(ctx, x, y, ph) {
    ctx.fillStyle = '#2a2b31'; ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 2, y - 1, 1, 3); ctx.fillRect(x + 2, y - 1, 1, 3);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y, 1, 1);
    const hi = [[-1, -1], [1, -1], [1, 1], [-1, 1]][ph];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + hi[0], y + hi[1], 1, 1);
  }
  function drawHole(ctx, x, y) {
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 2, y - 1, 1, 3); ctx.fillRect(x + 2, y - 1, 1, 3);
    ctx.fillStyle = '#121216'; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#3a3c44'; ctx.fillRect(x - 1, y - 1, 3, 1);
  }
  // luftmätaren: halvcirkel med grått, grönt och rött fält, visare och värdet i bar
  function drawGaugeBubble(ctx, c) {
    const j = c.tj, IW = 29, IH = 21, g = wheelBubbleAt(c, IW, IH);
    const green = j.air >= GREEN_LO && j.air <= GREEN_HI;
    const [ix, iy] = bubble(ctx, g.cx, g.tip, IW, IH, green);
    const cx = ix + 14, cy = iy + 12;
    for (let a = 0; a <= 40; a++) {
      const f = a / 40, an = Math.PI + f * Math.PI;
      const col = f < GREEN_LO ? '#b4bac4' : f <= GREEN_HI ? '#45b964' : '#d9433b';
      for (const r of [10, 11]) { ctx.fillStyle = r === 11 ? col : f < GREEN_LO ? '#8a8e96' : f <= GREEN_HI ? '#2e8a48' : '#a82820'; ctx.fillRect(cx + Math.round(Math.cos(an) * r), cy + Math.round(Math.sin(an) * r), 1, 1); }
    }
    for (let k = 0; k <= 10; k++) { const an = Math.PI + k / 10 * Math.PI; ctx.fillStyle = '#3a3440'; ctx.fillRect(cx + Math.round(Math.cos(an) * 8), cy + Math.round(Math.sin(an) * 8), 1, 1); }
    const v = clamp(j.air + (hold.on || pulse > 0 ? Math.sin(t * 40) * 0.006 : 0), 0, 1), an = Math.PI + v * Math.PI;
    ctx.fillStyle = '#d8342a';
    for (let r = 1; r <= 8; r++) ctx.fillRect(cx + Math.round(Math.cos(an) * r), cy + Math.round(Math.sin(an) * r), 1, 1);
    ctx.fillStyle = '#17151a'; ctx.fillRect(cx - 1, cy - 1, 3, 2);
    const s = (j.air * 3.2).toFixed(1).replace('.', ',') + ' BAR', w = textW(SMALL, s);
    ctxText(ctx, SMALL, s, ix + ((IW - w) >> 1), iy + 15, green ? '#2e8a48' : j.air > GREEN_HI ? '#d9433b' : '#3a3440');
  }
  function bangStar(ctx, x, y, k) {
    const r = Math.round(4 + (0.3 - k) * 30);
    ctx.fillStyle = '#ffffff';
    for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2, rr = a % 2 ? r * 0.55 : r; ctx.fillRect(x + Math.round(Math.cos(an) * rr), y + Math.round(Math.sin(an) * rr), 2, 2); }
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 2, y - 2, 5, 5);
  }
  // pilen med hjälptext som visar nästa steg
  function hintArrow(ctx, x, y, txt, time) {
    const w = textW(SMALL, txt) + 6, bob = Math.round(Math.abs(Math.sin(time * 5)) * 2);
    const down = y - 18 - bob > 28;                     // pilen pekar ner – eller upp om det är trångt
    const bx = clamp(Math.round(x - w / 2), 1, FW - w - 1), by = down ? y - 18 - bob : y + 8 + bob;
    ctx.fillStyle = '#17151a'; ctx.fillRect(bx, by, w, 9);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, down ? by + 8 : by, w, 1);
    ctxText(ctx, SMALL, txt, bx + 3, by + 2, '#ffd23f');
    const ax = Math.round(x);
    ctx.fillStyle = '#ffd23f';
    if (down) { const ay = by + 10; ctx.fillRect(ax - 2, ay, 5, 1); ctx.fillRect(ax - 1, ay + 1, 3, 1); ctx.fillRect(ax, ay + 2, 1, 1); }
    else { const ay = by - 3; ctx.fillRect(ax, ay, 1, 1); ctx.fillRect(ax - 1, ay + 1, 3, 1); ctx.fillRect(ax - 2, ay + 2, 5, 1); }
  }
  // stegraden under topplisten: bilens färg, vilket hjul och vilken sort, och
  // stegen med det nästa tänt (klara steg gröna, kommande grå)
  function drawStepRow(ctx, c) {
    ctx.fillStyle = 'rgba(23,21,26,0.82)'; ctx.fillRect(0, 18, FW, 9);
    if (!c) { const s = 'VÄNTAR PÅ NÄSTA BIL...'; ctxText(ctx, SMALL, s, (FW - textW(SMALL, s)) >> 1, 20, '#8a8494'); return; }
    const list = c.tj ? STEPS : STEPS_PART, st = stageOf(c), idx = st === 'KLART' ? list.length : list.indexOf(st);
    const pre = c.tj ? posTxt(c) + ' ' + TIRE_TXT[c.tj.want] : PART_NAMES[c.fault];
    const ws = list.map((s) => textW(SMALL, s) + 2), gap = 7;
    const total = 7 + textW(SMALL, pre) + 6 + ws.reduce((a, v) => a + v, 0) + gap * (list.length - 1);
    let x = Math.max(2, (FW - total) >> 1);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x, 20, 6, 5);
    ctx.fillStyle = css(c.color); ctx.fillRect(x + 1, 21, 4, 3);
    x += 8;
    ctxText(ctx, SMALL, pre, x, 20, c.tj ? TIRE_COL[c.tj.want] === '#2f6db5' ? '#7ab0ff' : '#ffb070' : '#d8d2c0');
    x += textW(SMALL, pre) + 6;
    list.forEach((s, i) => {
      const now = i === idx;
      if (now) { ctx.fillStyle = (t * 2 | 0) % 2 ? '#ffd23f' : '#f0b429'; ctx.fillRect(x, 19, ws[i], 7); }
      ctxText(ctx, SMALL, s, x + 1, 20, now ? '#17151a' : i < idx ? '#6fbf73' : '#8a8494');
      x += ws[i];
      if (i < list.length - 1) {
        ctx.fillStyle = i < idx ? '#4a7a4c' : '#5a5462';
        const ax = x + 2;
        ctx.fillRect(ax, 20, 1, 1); ctx.fillRect(ax + 1, 21, 1, 1); ctx.fillRect(ax + 2, 22, 1, 1); ctx.fillRect(ax + 1, 23, 1, 1); ctx.fillRect(ax, 24, 1, 1);
        x += gap;
      }
    });
  }
}

// ---------- små fasta bitar (cachade) ----------
function honkBubble(ctx, x, y) {
  const str = 'TUUT!', w = textW(SMALL, str) + 6, h = 9, bx = x - (w >> 1), by = y - h - 2;
  ctx.fillStyle = '#1c1a22'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = '#fff6d8'; ctx.fillRect(bx, by, w, h);
  ctx.fillStyle = '#1c1a22'; ctx.fillRect(x - 1, by + h + 1, 3, 1); ctx.fillRect(x, by + h + 2, 1, 1);
  ctxText(ctx, SMALL, str, bx + 3, by + 2, '#c0282a');
}
// framstegsstapel med en liten skiftnyckel till vänster; ränder rullar när man jobbar
const WRENCH = ['..#.#', '..###', '.##..', '##...', '#....'];
function progressBar(ctx, cx, y, p, active, time = 0) {
  const w = 24, x0 = cx - 17, x = x0 + 9;
  // ram med avrundade hörn
  ctx.fillStyle = '#17151a';
  ctx.fillRect(x0 + 1, y - 2, 32, 8); ctx.fillRect(x0, y - 1, 34, 6);
  ctx.fillStyle = '#2a2630'; ctx.fillRect(x0 + 1, y - 1, 7, 6);
  WRENCH.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') { ctx.fillStyle = j + i < 4 ? '#eef2f6' : '#a8aeb8'; ctx.fillRect(x0 + 2 + i, y - 1 + j, 1, 1); } });
  ctx.fillStyle = '#3a3440'; ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = '#2a2630'; ctx.fillRect(x, y + 3, w, 1);
  const fw = Math.round(w * clamp(p, 0, 1));
  ctx.fillStyle = p >= 1 ? '#45b964' : '#f0b429'; ctx.fillRect(x, y, fw, 4);
  ctx.fillStyle = p >= 1 ? '#8ee08c' : '#ffe27a'; ctx.fillRect(x, y, fw, 1);
  ctx.fillStyle = p >= 1 ? '#2e8a48' : '#c8861a'; ctx.fillRect(x, y + 3, fw, 1);
  if (active && fw > 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const off = Math.floor(time * 16) % 6;
    for (let i = -6 + off; i < fw; i += 6) for (let j = 1; j < 3; j++) { const xx = i + j; if (xx >= 0 && xx < fw - 1) ctx.fillRect(x + xx, y + j, 1, 1); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + fw - 1, y, 1, 4);
  }
}

const IMG = {};
function runwayImg() {
  if (IMG.run) return IMG.run;
  const w = RUN + 2, P = new Pix(w, RAMP);
  for (let x = 0; x < w; x++) {
    P.px(x, 0, x === 0 || x === w - 1 ? 0x6a6e78 : 0xc8ccd4);
    P.px(x, 1, (x % 4 === 1) ? 0xb4b8c2 : 0x8a8e98);                       // riffelplåt
    for (let y = 2; y < RAMP; y++) {
      const k = ((x + y) % 8) < 4;                                         // varningsrand
      P.px(x, y, k ? (y === 2 ? 0xffd84a : 0xe0a820) : (y === 2 ? 0x3a3b42 : 0x1e1f24));
    }
  }
  P.px(0, 1, 0x4a4e58); P.px(w - 1, 1, 0x4a4e58);
  return (IMG.run = P.flush());
}
function postImg() {
  if (IMG.post) return IMG.post;
  const P = new Pix(6, POST_H);
  for (let y = 0; y < POST_H; y++) for (let x = 0; x < 6; x++) {
    let c = null;
    if (y < 2) c = y === 0 ? 0x8a8e98 : 0x3a3c44;                           // topplock
    else if (y >= POST_H - 2) c = y === POST_H - 2 ? 0x6a6e78 : 0x2a2b31;   // fotplatta
    else if (x >= 1 && x <= 4) c = [0x5a8ad0, 0x3a6ab8, 0x2f5fa8, 0x1c3a6a][x - 1];
    if (c === null) continue;
    if (y >= 2 && y < POST_H - 2 && x === 3 && y % 4 === 0) c = 0x14284a;   // låshål
    if (y >= 13 && y <= 16 && x >= 1 && x <= 3) c = (y === 13 || y === 16) ? 0x17151a : x === 2 && y === 14 ? 0x17151a : 0xf2c230; // varningsdekal
    P.px(x, y, c);
  }
  P.px(0, POST_H - 1, 0x17151a); P.px(5, POST_H - 1, 0x17151a);
  P.px(1, POST_H - 2, 0xc8ccd4); P.px(4, POST_H - 2, 0xc8ccd4);           // bultar
  return (IMG.post = P.flush());
}
function glowImg() {
  if (IMG.glow) return IMG.glow;
  const P = new Pix(21, 15);
  P.ell(10.5, 7.5, 10, 7, 0xfff4c8, 0.45);
  return (IMG.glow = P.flush());
}
function tubeGlowImg() {
  if (IMG.tube) return IMG.tube;
  const P = new Pix(56, 30);
  P.ell(28, 6, 27, 16, 0xfff8e0, 0.24);
  return (IMG.tube = P.flush());
}
// rullbara verktygsvagnar: 0 = röd med kaffekopp, 1 = blå med trasa
function cartImg(kind) {
  const key = 'cart' + kind;
  if (IMG[key]) return IMG[key];
  const W = 26, H = 26, P = new Pix(W, H);
  const body = kind ? 0x2f6db5 : 0xc8322a, dk = mul(body, 0.55), lt = mix(body, 0xffffff, 0.3);
  const X0 = 3, X1 = 24, TOP = 2, BOT = H - 6, drawers = kind ? 4 : 3;
  // skjuthandtag
  for (let y = TOP; y <= TOP + 6; y++) P.px(0, y, y === TOP ? 0xeef2f6 : 0xb4bac4);
  P.hl(0, TOP, 3, 0xd0d4dc); P.hl(0, TOP + 6, 3, 0x8a8e96);
  // brickan överst
  P.hl(X0, TOP, X1 - X0 + 1, 0x17151a);
  P.hl(X0 + 1, TOP + 1, X1 - X0 - 1, lt);
  for (let y = TOP + 2; y <= TOP + 3; y++) { P.px(X0, y, 0x17151a); P.px(X1, y, 0x17151a); P.px(X0 + 1, y, body); P.px(X1 - 1, y, dk); P.hl(X0 + 2, y, X1 - X0 - 3, 0x26272c); }
  // verktyg i brickan
  P.hl(X0 + 10, TOP + 2, 7, 0xc8ccd4); P.px(X0 + 9, TOP + 2, 0xeef2f6); P.px(X0 + 17, TOP + 2, 0x8a8e96);
  P.hl(X0 + 12, TOP + 3, 4, kind ? 0xf2c230 : 0x3a7bd5); P.px(X0 + 16, TOP + 3, 0x8a8e96);
  // lådorna
  const y0 = TOP + 4, dh = Math.floor((BOT - y0) / drawers);
  for (let y = y0; y <= BOT; y++) for (let x = X0; x <= X1; x++) {
    const r = (y - y0) % dh, n = (y - y0) / dh | 0;
    let c = mix(body, dk, (x - X0) / (X1 - X0) * 0.35 + (bayer(x, y) - 0.5) * 0.1);
    if (x === X0 || x === X1) c = 0x17151a;
    else if (x === X0 + 1) c = lt; else if (x === X1 - 1) c = dk;
    else if (r === 0) c = mix(body, 0xffffff, 0.18);
    else if (r === dh - 1) c = dk;
    else if (r === (dh >> 1) && x >= X0 + 6 && x <= X1 - 6 && n < drawers) c = 0xd8dce4;          // handtag
    else if (r === (dh >> 1) + 1 && x >= X0 + 6 && x <= X1 - 6 && n < drawers) c = mul(dk, 0.7);
    if (y === BOT) c = 0x17151a;
    P.px(x, y, c);
  }
  if (kind) {   // en röd trasa hänger över kanten
    for (let y = y0 + 1; y < y0 + 8; y++) { P.px(X1 - 3, y, 0xd8342a); P.px(X1 - 2, y, y % 3 ? 0xb82a22 : 0xf06a5a); }
    P.px(X1 - 3, y0 + 8, 0xb82a22);
  }
  // sockel och hjul
  P.hl(X0 + 1, BOT + 1, X1 - X0 - 1, 0x2a2b31);
  for (const wx of [X0 + 2, X1 - 3]) {
    P.px(wx, BOT + 2, 0x5a5e66); P.px(wx + 1, BOT + 2, 0x5a5e66);
    P.rect(wx - 1, BOT + 3, 4, 2, 0x1c1c22); P.px(wx, BOT + 3, 0x8a8e96); P.px(wx + 1, BOT + 4, 0x3a3a42);
  }
  P.hl(X0 + 1, H - 1, X1 - X0 - 1, 0x140c1e, 0.3);
  return (IMG[key] = P.flush());
}
// arbetslampa på trebent stativ med halogenstrålkastare
function lampImg() {
  if (IMG.lamp) return IMG.lamp;
  const W = 17, H = 40, P = new Pix(W, H);
  const cx = 8, joint = H - 12;
  // benen
  P.line(cx, joint, 1, H - 1, 0x22232a); P.line(cx, joint, 15, H - 1, 0x22232a); P.line(cx, joint, cx, H - 1, 0x3a3b42);
  P.line(cx + 1, joint + 1, 15, H - 2, 0x4a4c54, 0.6);
  P.px(1, H - 1, 0x17151a); P.px(15, H - 1, 0x17151a);
  // stången
  for (let y = 8; y < joint; y++) { P.px(cx, y, 0xc8ccd4); P.px(cx + 1, y, 0x7a7e88); }
  P.rect(cx - 1, joint - 1, 3, 2, 0x2a2b31); P.rect(cx - 1, 16, 3, 1, 0x2a2b31);   // klämmor
  // strålkastaren (lutar ner åt vänster)
  P.rect(1, 3, 9, 7, 0x17151a);
  P.rect(2, 4, 7, 5, 0xf2c230); P.hl(2, 4, 7, 0xffe27a); P.hl(2, 8, 7, 0xb8861a);
  P.rect(2, 9, 6, 1, 0x17151a);
  P.rect(1, 9, 6, 2, 0xfffbe8); P.hl(1, 10, 6, 0xfff0b0);                         // glaset nedåt
  for (let x = 3; x < 9; x += 2) P.vl(x, 5, 3, 0xb8861a);                        // kylflänsar
  P.rect(cx, 1, 1, 3, 0x2a2b31); P.px(cx + 1, 0, 0x2a2b31); P.px(cx - 1, 0, 0x2a2b31); // bygel
  P.px(9, 6, 0x2a2b31); P.px(10, 7, 0x2a2b31);
  return (IMG.lamp = P.flush());
}
// rullbar garagedomkraft (sidovy): låg röd kropp, lyftarm med sadel, långt handtag
function jackImg() {
  if (IMG.jack) return IMG.jack;
  const W = 33, H = 17, P = new Pix(W, H);
  P.hl(7, H - 1, 25, 0x140c1e, 0.3);                                        // skugga
  // handtaget: krom med svart grepp högst upp
  P.line(11, 11, 3, 2, 0xd8dce4); P.line(12, 11, 4, 2, 0x8a8e96);
  P.rect(1, 0, 4, 3, 0x17151a); P.hl(2, 0, 2, 0x4a4c54); P.px(1, 1, 0x3a3c44);
  // lyftarmen och sadeln
  P.line(15, 10, 26, 4, 0xe8443a); P.line(15, 11, 26, 5, 0xa82820); P.line(16, 11, 26, 6, 0x5a1414);
  P.line(19, 12, 22, 7, 0xeef2f6); P.line(20, 12, 23, 7, 0x9aa0aa);          // hydraulkolven
  P.rect(24, 1, 6, 3, 0x2a2b31); P.hl(24, 1, 6, 0x6a6e78); P.px(24, 0, 0x2a2b31); P.px(29, 0, 0x2a2b31);
  P.px(26, 2, 0x17151a); P.px(27, 2, 0x17151a);
  // kroppen (lång och låg, smalnar fram)
  for (let x = 10; x <= 30; x++) {
    const top = x > 27 ? 11 : 9, bot = 13;
    for (let y = top; y <= bot; y++) {
      let c = y === top ? 0xff7a6a : y === top + 1 ? 0xe8443a : y === bot ? 0x6a1410 : 0xc8322a;
      if (x === 10 || x === 30 || (x > 27 && y === top && x === 28)) c = 0x3a1010;
      P.px(x, y, c);
    }
    P.px(x, (x > 27 ? 11 : 9) - 1, 0x3a1010);
  }
  P.px(17, 11, 0xf2c230); P.px(18, 11, 0xf2c230); P.px(19, 11, 0x17151a);  // varningsdekal
  // hjul: två fram, en svängbar bak
  for (const wx of [12, 27]) { P.rect(wx - 1, 13, 3, 3, 0x1c1c22); P.px(wx, 14, 0x8a8e96); P.px(wx - 1, 13, 0x3a3a42); }
  return (IMG.jack = P.flush());
}
// tre liggande däck på varandra
function stackImg() {
  if (IMG.stack) return IMG.stack;
  const W = 26, H = 24, P = new Pix(W, H), cx = 13;
  P.hl(2, H - 1, 23, 0x140c1e, 0.3);
  for (let k = 0; k < 3; k++) tireSide(P, cx, H - 2 - k * 5, 22);
  tireTop(P, cx, H - 18, 22);
  // en vit krita-markering på det översta däcket
  P.px(cx + 6, H - 13, 0xf4f1ea); P.px(cx + 7, H - 13, 0xdcd6ca);
  return (IMG.stack = P.flush());
}

// ======================================================================
// Verkstaden (målas en gång)
// ======================================================================
// verktyg på en "skuggtavla": mörk kontur runt varje verktyg
function shadowTool(P, pts) {
  const key = new Map(pts.map(([x, y, c]) => [x + ',' + y, c]));
  for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) {
    if (!key.has((x + dx) + ',' + (y + dy))) P.px(x + dx, y + dy, 0x3a2a1c);
  }
  for (const [x, y, c] of pts) P.px(x, y, c);
}
function wrenchPts(x, y, len) {
  const pts = [], CH = [0xeef2f6, 0xc8ccd4, 0x9aa0aa];
  pts.push([x - 1, y, CH[0]], [x + 1, y, CH[2]], [x - 1, y + 1, CH[0]], [x + 1, y + 1, CH[2]], [x - 1, y + 2, CH[1]], [x, y + 2, CH[1]], [x + 1, y + 2, CH[2]]);
  for (let j = y + 3; j < y + len - 3; j++) pts.push([x, j, j % 2 ? CH[1] : CH[0]]);
  const e = y + len - 3;
  pts.push([x - 1, e, CH[0]], [x, e, CH[1]], [x + 1, e, CH[2]], [x - 1, e + 1, CH[0]], [x + 1, e + 1, CH[2]], [x - 1, e + 2, CH[1]], [x, e + 2, CH[2]], [x + 1, e + 2, CH[2]]);
  return pts;
}
function tireSide(P, cx, yb, w) {
  const hw = w >> 1;
  for (let j = 0; j < 5; j++) {
    const y = yb - j, inset = j === 0 || j === 4 ? 1 : 0;
    for (let x = cx - hw + inset; x <= cx + hw - inset; x++) {
      let c = j === 4 ? 0x4e4e58 : j === 3 ? 0x383842 : j === 0 ? 0x16161b : 0x26262e;
      const e = Math.min(x - (cx - hw), cx + hw - x);
      if (e <= 1) c = mul(c, 0.72);
      else if (x < cx - hw + 5) c = mix(c, 0x6a6a74, 0.12);
      if ((j === 1 || j === 2) && (x + yb) % 3 === 0 && e > 1) c = 0x3e3e48;
      P.px(x, y, c);
    }
  }
}
function tireTop(P, cx, cy, w) {
  const hw = w / 2;
  for (let y = Math.floor(cy - 3); y <= cy + 3; y++) for (let x = Math.floor(cx - hw - 1); x <= cx + hw + 1; x++) {
    const d = Math.hypot((x - cx) / hw, (y - cy) / 2.8);
    if (d > 1) continue;
    const hole = Math.hypot((x - cx) / (hw * 0.46), (y - cy) / 1.25);
    const c = hole < 1 ? (y < cy ? 0x34343c : 0x0e0e12) : d > 0.84 ? (y < cy ? 0x5a5a64 : 0x2a2a32) : y < cy ? 0x484852 : 0x3a3a44;
    P.px(x, y, c);
  }
}
function drum(P, x, bottom, w, h, col) {
  const top = bottom - h + 1;
  for (let y = top; y <= bottom; y++) for (let i = 0; i < w; i++) {
    const u = i / (w - 1);
    let c = mul(col, 0.6 + 0.55 * Math.sin(Math.PI * (u * 0.9 + 0.05)) - (u > 0.7 ? (u - 0.7) * 0.8 : 0));
    if (i === Math.round(w * 0.28)) c = mix(c, 0xffffff, 0.32);
    const ry = y - top, r1 = Math.round(h * 0.34), r2 = Math.round(h * 0.67);
    if (ry === r1 || ry === r2) c = mix(c, 0xffffff, 0.22);
    if (ry === r1 + 1 || ry === r2 + 1) c = mul(c, 0.62);
    if (i === 0 || i === w - 1) c = mul(c, 0.5);
    if (y === bottom) c = mul(c, 0.45);
    P.px(x + i, y, c);
  }
  P.hl(x + 1, top - 2, w - 2, mul(col, 0.55));
  for (let i = 0; i < w; i++) P.px(x + i, top - 1, i === 0 || i === w - 1 ? mul(col, 0.5) : mix(col, 0xffffff, 0.3));
  P.px(x + 2, top - 1, 0x2a2b30); P.px(x + 3, top - 1, 0x55575f); P.px(x + w - 4, top - 1, 0x2a2b30);
}
function stampMap(P, p, x, bottom) {
  const { map, pal } = PARTS[p], top = bottom - map.length + 1;
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const v = pal[row[i]]; if (v !== undefined) P.px(x + i, top + j, v); } });
}
function shelfFrame(P, x0, x1, top, bottom, boards) {
  for (let y = top; y <= bottom; y++) {
    P.px(x0, y, 0x3a3c44); P.px(x0 + 1, y, 0xb4bac4); P.px(x1 - 1, y, 0x8a8e96); P.px(x1, y, 0x3a3c44);
    if ((y - top) % 3 === 1) { P.px(x0 + 1, y, 0x5a5e66); P.px(x1 - 1, y, 0x5a5e66); }
  }
  for (const by of boards) { P.hl(x0, by, x1 - x0 + 1, 0xd0d4dc); P.hl(x0, by + 1, x1 - x0 + 1, 0x6a6e78); P.hl(x0 + 2, by + 2, x1 - x0 - 3, 0x2a2b31, 0.25); }
}

function paintShop() {
  const P = new Pix(FW, FH);
  // ---------- tak med stålbalk ----------
  for (let y = 0; y < 26; y++) for (let x = 0; x < FW; x++) {
    let c;
    if (y < 19) c = mix(0x1a1920, 0x26252d, y / 19);
    else if (y === 19) c = 0x7a7e88;
    else if (y < 24) c = mix(0x555964, 0x3a3d46, (y - 20) / 4 + (bayer(x, y) - 0.5) * 0.18);
    else if (y === 24) c = 0x26272e;
    else c = 0x17161c;
    if (y >= 20 && y <= 23 && x % 32 === 16) c = y === 20 ? 0x9a9ea8 : 0x2e3038;
    if (y === 21 && x % 32 === 13) c = 0xa8acb6;
    P.px(x, y, c);
  }
  // ---------- blocksten, tvåfärgad ----------
  for (let y = 26; y < 88; y++) for (let x = 0; x < FW; x++) {
    const upper = y < 62, row = (y - 26) >> 3, my = (y - 26) % 8 === 7, mx = (x + (row & 1) * 8) % 16 === 15;
    const base = upper ? 0xd6d1c3 : 0x5b7084;
    let c = mix(base, mul(base, 0.9), hash(x >> 4, row, 3) * 0.6 + (bayer(x, y) - 0.5) * 0.25);
    if (my || mx) c = mul(base, upper ? 0.83 : 0.76);
    else if ((y - 26) % 8 === 0) c = mix(c, 0xffffff, 0.08);
    if (y === 62) c = 0xf2c230; else if (y === 63) c = 0xc8961a;
    if (y > 74) c = mix(c, 0x26282c, (y - 74) / 14 * 0.4 * (0.5 + hash(x >> 2, 1, 5) * 0.9));
    if (y === 26) c = mul(c, 0.7);
    P.px(x, y, c);
  }
  // sockel
  for (let x = 0; x < FW; x++) { P.px(x, 88, 0x8a8c92); P.px(x, 89, 0x5a5c62); P.px(x, 90, 0x44464c); P.px(x, 91, 0x2a2b30); }
  // ---------- betonggolv ----------
  for (let y = FLOOR_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0xaaa7a0, 0x8f8c86, hash(x >> 1, y >> 1, 11) * 0.55 + (bayer(x, y) - 0.5) * 0.22);
    c = mix(c, 0x7a7872, ((y - FLOOR_Y) / (FH - FLOOR_Y)) * 0.18);
    if (hash(x, y, 21) > 0.985) c = mul(c, 0.8); else if (hash(x, y, 22) > 0.99) c = mix(c, 0xffffff, 0.2);
    if (x % 96 === 47 || y === 167) c = mul(c, 0.8);
    if (x % 96 === 48 || y === 168) c = mix(c, 0xffffff, 0.08);
    if (y < FLOOR_Y + 5) c = mul(c, 0.72 + (y - FLOOR_Y) * 0.056);
    P.px(x, y, c);
  }
  // lysrörens sken på golvet
  for (const tx of TUBES.slice(0, 3)) P.ell(tx, 104, 34, 10, 0xfff8e0, 0.1);
  // arbetslampans ljuspöl
  P.ell(LAMP.x - 16, LAMP.y + 4, 30, 9, 0xfff0c0, 0.28);
  // gula linjer runt lyftplatserna + gummimattor vid fronten
  for (const b of BAYS) {
    const xa = b.face ? b.lx - 8 : 0, xb = b.face ? FW - 1 : b.lx + RUN + 7, xv = b.face ? b.lx - 8 : b.lx + RUN + 7;
    for (let x = xa; x <= xb; x++) { P.px(x, b.base + 5, 0xe8b830); P.px(x, b.base + 6, 0xa8801c, 0.6); P.px(x, b.base - 13, 0xe8b830, 0.85); }
    for (let y = b.base - 13; y <= b.base + 5; y++) P.px(xv, y, 0xe8b830);
    // däckspår in mot lyften
    for (let x = xa; x <= xb; x++) if (hash(x, b.base, 31) > 0.35) { P.px(x, b.base - 2, 0x3a3834, 0.18); P.px(x, b.base - 9, 0x3a3834, 0.14); }
    const mx = b.spotX - 8;
    for (let y = b.base - 2; y <= b.base + 3; y++) for (let x = mx; x <= mx + 16; x++) {
      const edge = y === b.base - 2 || y === b.base + 3 || x === mx || x === mx + 16;
      P.px(x, y, edge ? 0x1c1c20 : (x + y) % 3 === 0 ? 0x3a3a42 : 0x2a2a30);
    }
  }
  // oljefläckar
  for (const [ox, oy, rx, ry] of [[62, 114, 7, 2], [52, 196, 9, 2.5], [330, 114, 6, 2], [318, 197, 8, 2], [176, 112, 4, 1.5], [214, 138, 5, 1.5], [128, 150, 3, 1], [252, 176, 6, 1.8], [96, 158, 3, 1], [294, 150, 4, 1.2]]) {
    P.ell(ox, oy, rx, ry, 0x1c1a16, 0.55, 4);
    P.ell(ox + rx * 0.3, oy - ry * 0.2, rx * 0.5, ry * 0.5, 0x100e0a, 0.4, 3);
    P.px(ox - 1, oy - 1, 0x7a6a9a, 0.5); P.px(ox + 1, oy, 0xb89a4a, 0.4);
  }
  // golvbrunn
  P.rect(186, 184, 13, 6, 0x2a2b30); P.box(186, 184, 13, 6, 0x6a6c72);
  for (let x = 188; x < 197; x += 2) P.vl(x, 185, 4, 0x121214);
  P.hl(186, 190, 13, 0x5a5854, 0.5);
  // kabeln från arbetslampan till vägguttaget
  const cab = [[LAMP.x + 2, LAMP.y], [LAMP.x + 10, LAMP.y - 6], [LAMP.x + 6, LAMP.y - 20], [LAMP.x + 16, LAMP.y - 34], [LAMP.x + 12, 96], [LAMP.x + 12, 84]];
  for (let i = 0; i < cab.length - 1; i++) P.line(cab[i][0], cab[i][1], cab[i + 1][0], cab[i + 1][1], 0x1c1d22);
  P.rect(LAMP.x + 10, 80, 5, 5, 0xeef2f6); P.box(LAMP.x + 10, 80, 5, 5, 0x8a8e96); P.px(LAMP.x + 11, 82, 0x2a2b30); P.px(LAMP.x + 13, 82, 0x2a2b30);

  // ---------- lysrören ----------
  TUBES.forEach((tx, i) => {
    if (i < 3) P.ell(tx, 34, 27, 15, 0xfff8e0, 0.22);
    P.vl(tx - 10, 24, 3, 0x2a2b30); P.vl(tx + 10, 24, 3, 0x2a2b30);
    P.hl(tx - 13, 27, 27, 0xe0e4e8); P.hl(tx - 13, 28, 27, 0x9aa0a8); P.px(tx - 13, 28, 0x6a6e78); P.px(tx + 13, 28, 0x6a6e78);
    P.hl(tx - 12, 29, 25, i < 3 ? 0xf4fbff : 0x9aa4ae);
    if (i < 3) P.hl(tx - 10, 29, 20, 0xffffff);
  });

  // ---------- verktygstavlan (vänster) ----------
  const TB = { x0: 8, x1: 100, y0: 32, y1: 60 };
  for (let y = TB.y0; y <= TB.y1; y++) for (let x = TB.x0; x <= TB.x1; x++) {
    let c = mix(0xc49a66, 0xb08655, hash(x >> 3, y >> 3, 4) * 0.5 + (bayer(x, y) - 0.5) * 0.2);
    if ((x - TB.x0) % 4 === 2 && (y - TB.y0) % 4 === 2) c = 0x6a4a2c;
    if (x === TB.x0 || x === TB.x1 || y === TB.y0 || y === TB.y1) c = 0x4a3018;
    else if (x === TB.x0 + 1 || y === TB.y0 + 1) c = 0xdcb880;
    P.px(x, y, c);
  }
  P.hl(TB.x0 + 1, TB.y1 + 1, TB.x1 - TB.x0, 0x2a2420, 0.35);
  [10, 12, 14, 16, 18].forEach((len, i) => shadowTool(P, wrenchPts(15 + i * 5, 35, len)));
  // ett saknat verktyg: bara konturen kvar
  for (const [x, y] of wrenchPts(41, 35, 20)) P.px(x, y, 0x3a2a1c);
  for (const [x, y] of wrenchPts(41, 35, 20)) if (hash(x, y, 2) > 0.2) P.px(x, y, 0xa07a4a);
  // hammare
  const ham = [];
  for (let x = 47; x <= 53; x++) for (let y = 35; y <= 37; y++) ham.push([x, y, y === 35 ? 0xa8acb6 : x === 47 ? 0x3a3c44 : 0x5a5e66]);
  for (let y = 38; y <= 50; y++) { ham.push([50, y, y % 3 ? 0xb07a40 : 0xc88c4c]); ham.push([51, y, 0x8a5a2c]); }
  shadowTool(P, ham);
  // skruvmejslar
  [[57, 0xd8342a], [61, 0xf2c230], [65, 0x3a7bd5]].forEach(([x, col]) => {
    const pts = [];
    for (let y = 35; y <= 42; y++) pts.push([x, y, y === 35 ? 0x3a3c44 : 0xc8ccd4]);
    for (let y = 43; y <= 48; y++) { pts.push([x - 1, y, mix(col, 0xffffff, 0.35)]); pts.push([x, y, col]); pts.push([x + 1, y, mul(col, 0.6)]); }
    shadowTool(P, pts);
  });
  // tång
  const pl = [];
  for (let y = 35; y <= 38; y++) { pl.push([69 + (y > 36 ? 0 : -1) + (y === 38 ? 1 : 0), y, 0xc8ccd4]); pl.push([71 - (y > 36 ? 0 : -1) - (y === 38 ? 1 : 0), y, 0x9aa0aa]); }
  pl.push([70, 39, 0x3a3c44]);
  for (let y = 40; y <= 49; y++) { const s = Math.floor((y - 40) / 3); pl.push([69 - s, y, 0xd8342a]); pl.push([71 + s, y, 0xa82820]); }
  shadowTool(P, pl);
  // bågfil
  const saw = [];
  for (let x = 77; x <= 93; x++) { saw.push([x, 35, 0x3a6ac0]); saw.push([x, 41, x % 2 ? 0xc8ccd4 : 0x8a8e96]); }
  for (let y = 36; y <= 40; y++) { saw.push([77, y, 0x2f5fa8]); saw.push([93, y, 0x2f5fa8]); }
  for (let y = 37; y <= 42; y++) { saw.push([94, y, 0x2a2b30]); saw.push([95, y, 0x3a3c44]); }
  shadowTool(P, saw);
  // måttband och ficklampa
  const tape = [];
  for (let y = 46; y <= 51; y++) for (let x = 78; x <= 83; x++) tape.push([x, y, (x === 78 || y === 46) ? 0xffe27a : (x === 83 || y === 51) ? 0xb8861a : 0xf2c230]);
  tape.push([80, 48, 0x17151a], [81, 48, 0x17151a], [80, 49, 0x17151a], [81, 49, 0x17151a], [84, 50, 0xc8ccd4], [85, 50, 0xc8ccd4]);
  shadowTool(P, tape);
  const torch = [];
  for (let x = 88; x <= 96; x++) for (let y = 47; y <= 49; y++) torch.push([x, y, x >= 94 ? (y === 47 ? 0xeef2f6 : 0xb4bac4) : y === 47 ? 0xff6a5a : y === 49 ? 0x8a1a14 : 0xd8342a]);
  torch.push([96, 48, 0xfff6c0]);
  shadowTool(P, torch);
  text(P, SMALL, 'VERKTYG', 24, 54, 0x4a3018);

  // ---------- vänstra hörnet: oljefat med tratt ----------
  drum(P, 2, 91, 14, 21, 0xc8322a);
  for (let x = 4; x < 14; x++) P.px(x, 77, x % 2 ? 0x2a2b30 : 0xf4f1ea);
  P.hl(6, 66, 7, 0x2a2b30); P.hl(7, 67, 5, 0xd8342a); P.hl(8, 68, 3, 0xa82820); P.vl(9, 69, 2, 0x2a2b30);
  // en kvast lutad mot väggen
  P.line(108, 60, 104, 86, 0xb07a40); P.line(109, 60, 105, 86, 0x8a5a2c);
  for (let i = 0; i < 7; i++) P.line(101 + i, 91, 103 + i * 0.5, 86, i % 2 ? 0xd8b060 : 0xb8903c);
  P.hl(102, 86, 7, 0x3a6ac0);
  // första hjälpen
  P.rect(102, 40, 11, 10, 0x17151a); P.rect(103, 41, 9, 8, 0xf4f1ea); P.hl(103, 41, 9, 0xffffff); P.hl(103, 48, 9, 0xc8c2b2);
  P.rect(106, 42, 3, 6, 0x35a855); P.rect(104, 44, 7, 2, 0x35a855);

  // ---------- skylten BILSERVICE ----------
  const sw = textW(BIG, 'BILSERVICE') + 10, sx0 = 192 - (sw >> 1);
  P.rect(sx0, 27, sw, 11, 0x17151a);
  P.rect(sx0 + 1, 28, sw - 2, 9, 0x24509a); P.hl(sx0 + 1, 28, sw - 2, 0x4a7ad0); P.hl(sx0 + 1, 36, sw - 2, 0x1a3a70);
  text(P, BIG, 'BILSERVICE', sx0 + 6, 30, 0x0e2448);
  text(P, BIG, 'BILSERVICE', sx0 + 5, 29, 0xf4f1ea);
  P.px(sx0 + 2, 29, 0xc8ccd4); P.px(sx0 + sw - 3, 29, 0xc8ccd4); P.px(sx0 + 2, 35, 0xc8ccd4); P.px(sx0 + sw - 3, 35, 0xc8ccd4);

  // ---------- stationerna: skylt + hylla/stapel ----------
  const plaque = (cx) => {
    const x0 = cx - 11, y0 = 40, w = 22, h = 17;
    P.hl(x0 + 1, y0, w - 2, 0x17151a); P.hl(x0 + 1, y0 + h - 1, w - 2, 0x17151a); P.vl(x0, y0 + 1, h - 2, 0x17151a); P.vl(x0 + w - 1, y0 + 1, h - 2, 0x17151a);
    P.rect(x0 + 1, y0 + 1, w - 2, h - 2, 0xf4f1ea); P.hl(x0 + 2, y0 + 1, w - 4, 0xffffff); P.hl(x0 + 1, y0 + h - 2, w - 2, 0xd9d0bc);
    P.hl(x0 + 2, y0 + h, w - 3, 0x2a2420, 0.25);
  };
  STATIONS.forEach((cx) => plaque(cx));
  // DÄCK: fyra liggande däck
  { const cx = STATIONS[0]; for (let k = 0; k < 4; k++) tireSide(P, cx, 95 - k * 5, 22); tireTop(P, cx, 74, 22); P.hl(cx - 10, 96, 21, 0x140c1e, 0.35); }
  // OLJA: blått fat med handpump + två dunkar
  {
    const cx = STATIONS[1];
    drum(P, cx - 7, 93, 14, 20, 0x2f5fa8);
    P.vl(cx + 2, 66, 8, 0x8a8e96); P.vl(cx + 3, 66, 8, 0x5a5e66); P.hl(cx - 2, 66, 5, 0x2a2b30); P.px(cx - 3, 67, 0x2a2b30);
    P.hl(cx + 3, 69, 4, 0x8a8e96); P.px(cx + 6, 70, 0x5a5e66);
    for (let x = cx - 5; x <= cx + 4; x++) P.px(x, 83, x % 2 ? 0xf4f1ea : 0xe8e4d8);
    stampMap(P, 1, cx - 15, 96); stampMap(P, 1, cx + 6, 96);
    P.hl(cx - 14, 97, 30, 0x140c1e, 0.3);
  }
  // LAMPOR: plåthylla med lampkartonger
  {
    const cx = STATIONS[2], x0 = cx - 12, x1 = cx + 12;
    shelfFrame(P, x0, x1, 66, 95, [66, 76, 86]);
    const boxes = (y, n, off) => { for (let i = 0; i < n; i++) { const bx = x0 + 3 + off + i * 6; P.rect(bx, y - 6, 5, 6, i % 2 ? 0xf4f1ea : 0xe8842a); P.hl(bx, y - 6, 5, i % 2 ? 0xffffff : 0xffb060); P.vl(bx + 4, y - 5, 5, i % 2 ? 0xc8c2b2 : 0xb85a1a); P.px(bx + 2, y - 4, 0xfff4c0); P.px(bx + 2, y - 3, 0xd8b24a); } };
    boxes(76, 3, 0); boxes(86, 3, 1); boxes(95, 2, 2);
    for (const lx of [x0 + 5, x0 + 11, x0 + 17]) { P.rect(lx, 61, 3, 3, 0xfff4c0); P.px(lx, 61, 0xffffff); P.px(lx + 1, 64, 0xc8ccd4); P.px(lx + 1, 65, 0x8a8e96); }
  }
  // AVGAS: avgasrör som står i ett ställ mot väggen
  {
    const cx = STATIONS[3];
    P.hl(cx - 12, 70, 25, 0x3a3c44); P.hl(cx - 12, 71, 25, 0x6a6e78); P.px(cx - 12, 72, 0x2a2b30); P.px(cx + 12, 72, 0x2a2b30);
    const pipe = (x, top, mTop, mH) => {
      for (let y = top; y <= 95; y++) { P.px(x, y, 0xdce0e8); P.px(x + 1, y, 0x9aa0aa); P.px(x + 2, y, 0x5a5e66); }
      P.px(x, top, 0x2a2b30); P.px(x + 1, top, 0x17151a); P.px(x + 2, top, 0x2a2b30);
      for (let y = mTop; y < mTop + mH; y++) for (let i = -1; i <= 3; i++) {
        const e = y === mTop || y === mTop + mH - 1 || i === -1 || i === 3;
        P.px(x + i, y, e ? 0x55595f : i === 0 ? 0xeef2f6 : i === 2 ? 0x7a808a : 0xb4bac4);
      }
    };
    pipe(cx - 10, 64, 74, 9); pipe(cx - 4, 67, 80, 10); pipe(cx + 2, 65, 72, 8); pipe(cx + 8, 69, 84, 8);
    P.hl(cx - 12, 96, 25, 0x140c1e, 0.3);
  }
  // BATTERI: låg stålhylla med batterier
  {
    const cx = STATIONS[4], x0 = cx - 13, x1 = cx + 13;
    shelfFrame(P, x0, x1, 72, 95, [72, 84]);
    stampMap(P, 4, x0 + 2, 83); stampMap(P, 4, x0 + 14, 83); stampMap(P, 4, x0 + 3, 95); stampMap(P, 4, x0 + 15, 95);
  }

  // ---------- höger vägg: kalender, klocka, radio, brandsläckare ----------
  // kalender med pin-up-bil
  {
    const x0 = 278, y0 = 29, w = 26, h = 34;
    P.rect(x0 + 1, y0 + 1, w, h, 0x2a2420, 0.3);
    P.rect(x0, y0, w, h, 0xf8f4ea); P.box(x0, y0, w, h, 0x8a8478);
    for (let y = y0 + 2; y < y0 + 16; y++) for (let x = x0 + 2; x < x0 + w - 2; x++) {
      const k = (y - y0 - 2) / 14;
      let c = k < 0.62 ? mix(0x6a3a8a, 0xff8a5a, k / 0.62) : mix(0x3a2a5a, 0x2a1e40, (k - 0.62) / 0.38);
      if (k < 0.62 && Math.hypot(x - (x0 + 18), y - (y0 + 10.5)) < 3.2) c = 0xffe07a;
      if (k >= 0.62 && (x + y) % 5 === 0) c = 0x4a3a6a;
      P.px(x, y, c);
    }
    const CAR = ['.....rrrr.......', '...rrRwwwRr.....', '.rrrrrrrrrrrrrr.', 'RRRRRRRRRRRRRRRy', 'dRRkkRRRRRRkkRRd', '...kk......kk...'];
    const cp = { r: 0xe8342a, R: 0xb8201a, w: 0x9ad0ff, y: 0xfff4c0, k: 0x17151a, d: 0x5a1010 };
    CAR.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (cp[row[i]] !== undefined) P.px(x0 + 5 + i, y0 + 9 + j, cp[row[i]]); });
    P.px(x0 + 9, y0 + 11, 0xffffff); P.px(x0 + 10, y0 + 11, 0xffffff);
    text(P, SMALL, 'SEPT', x0 + 3, y0 + 18, 0xc8322a);
    for (let r = 0; r < 4; r++) for (let d = 0; d < 7; d++) P.rect(x0 + 3 + d * 3, y0 + 25 + r * 2, 2, 1, 0x8a8478);
    P.box(x0 + 11, y0 + 26, 4, 3, 0xd8342a);
    P.rect(x0 + 12, y0 - 1, 2, 2, 0xd8342a); P.px(x0 + 12, y0 - 1, 0xff8a7a);
  }
  // klockan (visarna ritas varje bildruta)
  {
    const { x, y } = CLOCK;
    for (let yy = y - 7; yy <= y + 7; yy++) for (let xx = x - 7; xx <= x + 7; xx++) {
      const d = Math.hypot(xx - x, yy - y);
      if (d > 7.2) continue;
      P.px(xx, yy, d > 6.2 ? 0x2a2b31 : d > 5.4 ? 0xb4bac4 : 0xf8f6ee);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.px(x + Math.round(Math.sin(a) * 5), y - Math.round(Math.cos(a) * 5), i % 3 ? 0x8a8e96 : 0x2a2b31); }
  }
  // radio på en liten hylla
  {
    const { x, y } = RADIO;
    P.hl(x - 2, y + 10, 24, 0x8a5a2c); P.hl(x - 2, y + 11, 24, 0x5a3818);
    P.line(x, y + 12, x + 3, y + 15, 0x3a3c44); P.line(x + 19, y + 12, x + 16, y + 15, 0x3a3c44);
    P.rect(x, y, 20, 10, 0x17151a);
    P.rect(x + 1, y + 1, 18, 8, 0xc8322a); P.hl(x + 1, y + 1, 18, 0xf06a5a); P.hl(x + 1, y + 8, 18, 0x8a1a14);
    for (let yy = y + 3; yy < y + 8; yy++) for (let xx = x + 11; xx < x + 18; xx++) P.px(xx, yy, (xx + yy) % 2 ? 0x3a3c44 : 0x6a6e78);
    P.rect(x + 2, y + 3, 7, 3, 0xfff0b0); P.vl(x + 5, y + 3, 3, 0xd8342a);
    P.px(x + 3, y + 7, 0xd0d4dc); P.px(x + 7, y + 7, 0xd0d4dc);
    P.line(x + 16, y - 1, x + 23, y - 9, 0x8a8e96);
    P.hl(x + 5, y - 1, 6, 0x2a2b31); P.px(x + 4, y, 0x2a2b31); P.px(x + 11, y, 0x2a2b31);
  }
  // rökförbud
  {
    const x = 368, y = 36;
    for (let yy = y - 5; yy <= y + 5; yy++) for (let xx = x - 5; xx <= x + 5; xx++) {
      const d = Math.hypot(xx - x, yy - y);
      if (d > 5.3) continue;
      P.px(xx, yy, d > 4 ? 0xd8342a : 0xf8f6ee);
    }
    P.hl(x - 3, y, 5, 0xf4f1ea); P.hl(x - 3, y + 1, 5, 0x8a8e96); P.px(x + 2, y, 0xe8842a); P.px(x + 2, y + 1, 0xe8842a);
    P.px(x + 3, y - 1, 0xb4bac4); P.px(x + 3, y - 2, 0xb4bac4);
    for (let i = -3; i <= 3; i++) P.px(x + i, y + i, 0xd8342a);
  }
  // brandsläckare
  {
    const x = 362, y = 50;
    P.rect(x - 1, y + 3, 9, 2, 0x3a3c44);
    for (let yy = y + 4; yy <= y + 20; yy++) for (let xx = x; xx <= x + 5; xx++) P.px(xx, yy, xx === x ? 0xff6a5a : xx === x + 1 ? 0xe8342a : xx === x + 5 ? 0x8a1a14 : 0xc8322a);
    P.rect(x + 1, y + 1, 4, 3, 0x2a2b31); P.rect(x + 2, y, 3, 1, 0x8a8e96);
    P.line(x + 5, y + 2, x + 8, y + 6, 0x17151a); P.line(x + 8, y + 6, x + 8, y + 14, 0x17151a);
    P.rect(x + 1, y + 10, 4, 5, 0xf4f1ea); P.hl(x + 1, y + 11, 4, 0x2a2b31); P.hl(x + 1, y + 13, 3, 0x2a2b31);
    P.hl(x, y + 21, 6, 0x140c1e, 0.3);
  }
  // tryckluftsvinda med slang
  {
    const x = 284, y = 70;
    P.rect(x - 1, y - 1, 12, 12, 0x17151a);
    for (let yy = y; yy < y + 10; yy++) for (let xx = x; xx < x + 10; xx++) {
      const d = Math.hypot(xx - x - 4.5, yy - y - 4.5);
      P.px(xx, yy, d < 1.5 ? 0x2a2b31 : d < 3.6 ? ((xx + yy) % 2 ? 0xd8342a : 0xa82820) : 0xf2c230);
    }
    P.hl(x, y, 10, 0xffe27a);
    const hose = [[x + 5, y + 10], [x + 7, y + 14], [x + 3, y + 17], [x - 2, y + 15], [x - 1, y + 20]];
    for (let i = 0; i < hose.length - 1; i++) P.line(hose[i][0], hose[i][1], hose[i + 1][0], hose[i + 1][1], 0xd8342a);
    P.rect(x - 2, y + 20, 2, 3, 0x8a8e96);
  }
  // högra hörnet: däckstapel
  { const cx = 372; for (let k = 0; k < 3; k++) tireSide(P, cx, 95 - k * 5, 20); tireTop(P, cx, 79, 20); }
  P.box(0, 0, FW, FH, 0x0e0d12);

  // ---------- ikoner och texter (efter pixelmålningen) ----------
  const cv = P.flush(), c2 = cv.getContext('2d');
  STATIONS.forEach((cx, i) => {
    const s = partSprite(i);
    c2.drawImage(s, cx - (s.width >> 1), 41 + ((15 - s.height) >> 1));
    const w = textW(SMALL, PART_NAMES[i]);
    ctxText(c2, SMALL, PART_NAMES[i], cx - (w >> 1), 58, '#3a3440');
  });
  return cv;
}
