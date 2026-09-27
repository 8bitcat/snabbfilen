// Stadslivet i Pixelstaden – fotgängare (med hundar, kassar, paraplyer,
// sällskap och joggare), duvor, förbiflygande fåglar, fjärilar, eldflugor
// och en katt på en trappa. Allt i samma pixelkorn som resten av staden
// (1 enhet = 1 spelpixel). Alla småfigurer målas EN gång till cachade
// canvasar – per bildruta blir det bara drawImage/fillRect.
//
// Fotgängarna går på ett eget gångnät: noder på trottoarerna, i gränderna,
// på bakgatan, vid övergångsställena och i parken. Kanterna mellan noderna
// räknas ut EN gång mot hindren (husens fotavtryck + rekvisita + stolpar)
// på ett 2-px-rutnät, så per figur blir det bara en liten Dijkstra över
// ~80 noder när den väljer ett nytt mål. Vägen korsas bara vid
// övergångsställena och bara när traffic.pedGreen(i) är sann.
//
// Kontrakt (se map.js / scenes/city.js):
//   createLife(env, traffic) → { items(), update(dt), positions(), glow(ctx), obstacles }
import { CITY, BUILDINGS, STREETS, CROSSWALKS, PARK_LAYOUT, PATH_RECTS, BUS_STOP, doorCenter, inRect } from './map.js';
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, mix, mul, hash } from '../core/floor-pix.js';

const WALK_SEQ = [1, 3, 2, 3];
const CW = CITY.W, CH = CITY.H, BASE = CITY.BASE;
const VW = CITY.VIEW_W, VH = CITY.VIEW_H;
// gånglinjerna (fotpunkternas y) på trottoarer, bakgata och promenad
const Y_N = 203, Y_S = 291, Y_BACK = 22, Y_PROM = 340;
const CURB_N = CITY.ROAD[0] - 4, CURB_S = CITY.ROAD[1] + 5;
const DOOR_H = 34; // dörröppningens höjd i husmodulerna – figurerna klipps mot den när de går in/ut

// ---------- små hjälpare ----------
const rnd = Math.random;
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function wpick(list) {
  let s = 0;
  for (const [, w] of list) s += w;
  let r = rnd() * s;
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][0];
}
const headingDir = (hx, hy) => (Math.abs(hx) > Math.abs(hy) * 0.8 ? (hx < 0 ? 'left' : 'right') : hy < 0 ? 'up' : 'down');
const faceTo = (dx, dy) => headingDir(dx, dy);

// ---------- butikerna: hur ofta man går dit, hur länge man stannar, vad man bär ut ----------
const SHOPS = {
  mat: { w: 5, stay: [8, 20], carry: [['kasse', 0.75]] },
  klader: { w: 2.2, stay: [8, 18], carry: [['pase', 0.65]] },
  mobler: { w: 2.2, stay: [14, 30], carry: [['kartong', 0.35], ['frakt', 0.5]] },
  burgare: { w: 2.2, stay: [8, 22], carry: [['burgare', 0.5]] },
  bostad: { w: 0.6, stay: [6, 14], carry: [] },
  frukt: { w: 0.8, stay: [6, 16], carry: [['frukt', 0.45]] },
  flyg: { w: 1.2, stay: [6, 14], carry: [['resvaska', 0.6]] },
};
const isOpen = (b, h) => !b.open || (h >= b.open[0] && h < b.open[1]);
// butiker man kan fönstershoppa vid
const WINDOW_SHOPS = ['bostad', 'mat', 'klader', 'mobler', 'kafe', 'burgare', 'frukt'];

// =====================================================================
//  Sprites – pixelkartor och små målare, cachade canvasar
// =====================================================================
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Mörk kontur runt allt som är ritat (samma recept som personerna i people.js)
function outline(d, w, h) {
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] > 200) { best = j; if (dy === -1) break; }
    }
    if (best < 0) continue;
    d[i] = src[best] * 0.28 + 14; d[i + 1] = src[best + 1] * 0.24 + 10; d[i + 2] = src[best + 2] * 0.3 + 20; d[i + 3] = 255;
  }
}
// Pixelkarta → canvas. Varje tecken slås upp i paletten; '.' och okända = genomskinligt.
// Med kontur får bilden 1 px marginal runt om.
function fromMap(rows, pal, line = true) {
  const m = line ? 1 : 0;
  const w = Math.max(...rows.map((r) => r.length)) + m * 2, h = rows.length + m * 2;
  const c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col === undefined) continue;
      const k = ((j + m) * w + i + m) * 4;
      d[k] = (col >> 16) & 255; d[k + 1] = (col >> 8) & 255; d[k + 2] = col & 255; d[k + 3] = 255;
    }
  });
  if (line) outline(d, w, h);
  x.putImageData(img, 0, 0);
  return c;
}
function fromPix(P, line = true) { if (line) outline(P.d, P.w, P.h); return P.flush(); }
// spegelvänd kopia (pixel för pixel – aldrig ctx.scale)
function flipX(c) {
  const w = c.width, h = c.height, s = c.getContext('2d').getImageData(0, 0, w, h).data;
  const n = mkCanvas(w, h), x = n.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const a = (y * w + i) * 4, b = (y * w + (w - 1 - i)) * 4;
    d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = s[a + 3];
  }
  x.putImageData(img, 0, 0);
  return n;
}
const pairOf = (c) => ({ r: c, l: flipX(c), w: c.width, h: c.height });

// ---------- duvor (vända åt höger; vänster speglas) ----------
const PIG_VARIANTS = [
  { H: 0x8e97ab, h: 0xb6bece, B: 0x8a93a6, L: 0xaab3c4, D: 0x68708a, W: 0xa0a8ba, w: 0x7c8498, x: 0x2e3244, T: 0x5d6578, t: 0x2b2f3e, g: 0x5aae8a, p: 0xa06cb8 },
  { H: 0x5e6474, h: 0x7c8494, B: 0x5a6070, L: 0x767d8e, D: 0x454a58, W: 0x6c7282, w: 0x4a5060, x: 0x202230, T: 0x3c404c, t: 0x1e2028, g: 0x4e9a7a, p: 0x8a5aa0 },
  { H: 0xe6e4de, h: 0xffffff, B: 0xe0ddd6, L: 0xf4f2ec, D: 0xc2beb4, W: 0xeae8e2, w: 0xcecac0, x: 0xa29e94, T: 0xc6c2b8, t: 0x98948a, g: 0xcfe0d6, p: 0xe0d2e6 },
  { H: 0x9a8474, h: 0xbca696, B: 0x9a8676, L: 0xb8a494, D: 0x786456, W: 0xaa9686, w: 0x846e5e, x: 0x3a2e28, T: 0x6a5648, t: 0x352a24, g: 0x6aa888, p: 0x9a6a9a },
];
const PIG_COMMON = { e: 0xf08a2a, c: 0xefe9dc, b: 0x4a4448, f: 0xd9667a };
const PIG_MAPS = {
  stand: [
    '......hH...',
    '.....hHecb.',
    '......Hg...',
    '....WWgpL..',
    '..WWWwWLL..',
    'TTwxwxWLL..',
    'tTTwwwBBD..',
    '....DDDD...',
    '.....f.f...',
  ],
  walk: [
    '.......hH..',
    '......hHecb',
    '......gHg..',
    '....WWgpL..',
    '..WWWwWLL..',
    'TTwxwxWLL..',
    'tTTwwwBBD..',
    '....DDDD...',
    '....f...f..',
  ],
  peck: [
    '...........',
    '...........',
    '...........',
    '...WWW.....',
    '..WWWwWL...',
    'TTwxwxWLg..',
    'tTTwwwBLpH.',
    '....DDDD.He',
    '.....f.f..b',
  ],
  up: [
    '..WW.......',
    '..WWW......',
    '...wWW.....',
    '....xwW.hH.',
    'TT..xwLLHec',
    'tTTBBBLLg..',
    '..TDDDDD...',
  ],
  mid: [
    '...........',
    '........hH.',
    '.......hHec',
    'TTWWWWWLg..',
    'tTwxwxWLL..',
    '..TDDDDD...',
    '...........',
  ],
  down: [
    '...........',
    '........hH.',
    '.......hHec',
    'TT.BBBBLg..',
    'tTTDwxWLL..',
    '...WxwW....',
    '...Ww......',
  ],
};

// ---------- katten (rödrandig, vänd åt höger) ----------
const CAT_PAL = { O: 0xdc8a3c, o: 0xf4b468, r: 0xa65a22, s: 0x8a4418, w: 0xf6eee0, W: 0xd6ccbc, k: 0x3a2418, g: 0x9ad65a, n: 0xe48a8e, E: 0xe8a0a0 };
const CAT_MAPS = {
  // ligger och sover: ögonen stängda, svansen runt tassarna
  sleep: [
    '............r..r.',
    '...........rEOrEr',
    '...sOsOsO..OOOOOO',
    '..sOoOoOoOrOkOOkO',
    '.rOOoOoOoOOOOwnwO',
    'rOOOOOOOOOOOOwwwO',
    'rOOOOOOOOOOOwWwWr',
    '.rrrrrrrrrrrrrrr.',
  ],
  // vaken: huvudet uppe, ögonen öppna
  awake: [
    '............r..r.',
    '...........rEOrEr',
    '...........OOOOOO',
    '...sOsOsO..OgOOgO',
    '..sOoOoOoOrOOwnwO',
    '.rOOoOoOoOOOOwwwr',
    'rOOOOOOOOOOOwWwWr',
    '.rrrrrrrrrrrrrrr.',
  ],
  // sitter upp och tittar (någon kommer nära)
  sit: [
    '.r....r..',
    '.rEOOOEr.',
    '.OOOOOOO.',
    '.OgOOOgO.',
    '.OOwnwOO.',
    '..OwwwO..',
    '..OsOsO..',
    '.OOoOoOO.',
    '.OoOwOOO.',
    '.OoOwOOr.',
    '.OOwwwOOr',
    '.rrWrWrrr',
  ],
};
// svanstippen i tre lägen (vift) – läggs ovanpå liggande katt
const CAT_TAILS = [[], [[0, 4], [0, 3]], [[1, 3], [0, 2], [1, 1]]];

// ---------- fjärilar ----------
const BF_COLORS = [
  { A: 0xf6f4ec, a: 0x2a2a2a, b: 0x2a2420 },   // kålfjäril
  { A: 0xf4e04a, a: 0xd8b830, b: 0x3a3020 },   // citronfjäril
  { A: 0xd4502e, a: 0x3a58a8, b: 0x2a1c18 },   // påfågelöga
  { A: 0x7aa6ee, a: 0x3a60b8, b: 0x22243a },   // blåvinge
];
// vingarna i tre lägen (fladder); ritas med mörk kontur så de syns mot blommorna
const BF_MAPS = {
  open: ['Aa...aA', 'AAAbAAA', '.aAbAa.', '.AA.AA.'],
  half: ['.a...a.', '.AAbAA.', '..AbA..', '..A.A..'],
  shut: ['...a...', '...A...', '...A...', '...b...'],
};

// ---------- förbiflygande fåglar (sedda underifrån) ----------
const BIRD = {
  sw: { pal: { k: 0x241f2a, K: 0x3a3440 }, fr: [
    ['k.......k', '.kK...Kk.', '...kkk...', '....k....'],
    ['.........', 'kkKK.KKkk', '...kkk...', '....k....'],
    ['.........', '...kkk...', '.kK.k.Kk.', 'k.......k'],
  ] },
  gull: { pal: { G: 0xb8c0cc, W: 0xf4f4f0, k: 0x22222a, y: 0xe8c040 }, fr: [
    ['k.........k', '.GG.....GG.', '...GWWWG...', '.....W.....'],
    ['...........', 'kGGGWWWGGGk', '....WWW....', '.....y.....'],
    ['...........', '...GWWWG...', '.GG..W..GG.', 'k.........k'],
  ] },
  crow: { pal: { k: 0x1e1c24, K: 0x3a3844 }, fr: [
    ['k.........k', '.kK.....Kk.', '...kkkkk...', '.....k.....'],
    ['...........', 'kkKKkkkKKkk', '....kkk....', '.....k.....'],
    ['...........', '...kkkkk...', '.kK..k..Kk.', 'k.........k'],
  ] },
};

// ---------- sånt man bär ----------
const CARRY_MAPS = {
  // matkasse av papper med purjolök och baguette
  kasse: { rows: [
    '.G..b..',
    '.Gg.bB.',
    '.gG.bB.',
    'QQQQQQQ',
    'pPPPPPd',
    'pPPPPPd',
    'pPPPPPd',
    'pdddddd',
  ], pal: { G: 0x3f8a34, g: 0x8ccf5a, b: 0xe0aa60, B: 0xb07a34, Q: 0xe6cc96, P: 0xc9a46a, p: 0xdcbc84, d: 0x9c7a44 }, ax: 3, ay: 3 },
  // klädpåse med snören (färg per person)
  pase: { rows: [
    '.kkkk.',
    '.k..k.',
    'CCCCCC',
    'ChCCCc',
    'ChCLCc',
    'ChCCCc',
    'ChCCCc',
    'cccccc',
  ], pal: { k: 0x2a2630, C: 0xd24a8a, h: 0xe87ab0, c: 0xa0306a, L: 0xf4f1ea }, ax: 3, ay: 0 },
  // Möbeljättens stora blå bärkasse
  frakt: { rows: [
    '.YYY.YYY.',
    '.Y.Y.Y.Y.',
    'BYbBBBYBd',
    'BYbBBBYBd',
    'BybBBByBd',
    'BYbBBBYBd',
    'BYbBBBYBd',
    'BybBBByBd',
    'ddddddddd',
  ], pal: { B: 0x2f63c4, b: 0x5a8ae0, d: 0x1f4590, Y: 0xf2c83a, y: 0xc89a22 }, ax: 4, ay: 0 },
  // hamburgarpåse
  burgare: { rows: [
    '.QQQ.',
    'PPPPP',
    'pPRPd',
    'pRRRd',
    'pPPPd',
    'ddddd',
  ], pal: { Q: 0xe6cc96, P: 0xc9a46a, p: 0xdcbc84, d: 0x9c7a44, R: 0xd23a2e }, ax: 2, ay: 0 },
  // nät med apelsiner och äpplen från fruktfabriken
  frukt: { rows: [
    '.k.k.',
    '..k..',
    'oOrOo',
    'OroOr',
    'rOoOO',
    '.OrO.',
  ], pal: { k: 0x3a3430, O: 0xf0902a, o: 0xf8c060, r: 0xd0342a }, ax: 2, ay: 0 },
  // platt möbelkartong från Möbeljätten (bärs med båda händerna)
  kartong: { rows: [
    'KKKKKKKKKKKKKKK',
    'kkkkkkttkkkkkkd',
    'kLLLLkttkkkkkkd',
    'kbbbbkttkkykkkd',
    'kLyLLkttkkkkkkd',
    'kkkkkkttkkkkkkd',
    'ddddddddddddddd',
  ], pal: { K: 0xe0bc80, k: 0xc49a60, d: 0x98723e, L: 0xf2efe6, b: 0x2f63c4, y: 0xf2c83a, t: 0xd9cba4 }, ax: 7, ay: 0 },
  // resväska på hjul
  resvaska: { rows: [
    'CCCCCC',
    'ChCCCd',
    'ChCCCd',
    'CkkkkC',
    'ChCCCd',
    'ChCCCd',
    'Cddddd',
    '.w..w.',
  ], pal: { C: 0x2a8a8a, h: 0x4ab0b0, d: 0x1c5e5e, k: 0x1c4848, w: 0x1a1a1e }, ax: 3, ay: 7 },
};
const PASE_COLORS = [0xd24a8a, 0x2a2a30, 0xe8c13a, 0x3a8ad0, 0xf4f1ea, 0x46a35a];
const CASE_COLORS = [0x2a8a8a, 0xc9323a, 0x2a2a30, 0xb8bcc4, 0x3a5fb0, 0xe0a02a];
const UMB_COLORS = [0xc9323a, 0x2a2e48, 0x1e1e24, 0xe8c13a, 0x2f8f6f, 0x3a7bd5, 0x8e5bd1, 0xe07a2e];

// ---------- hundar: en liten målare per ras ----------
const DOGS = [
  { base: 0xa8683a, hi: 0xcc8e56, lo: 0x7a4624, ear: 0x5a3018, size: 'm', ears: 'flop' },                      // brun blandras
  { base: 0x2e2c34, hi: 0x4e4c58, lo: 0x1c1b20, ear: 0x19181c, size: 'm', ears: 'flop' },                      // svart labrador
  { base: 0xdcaa56, hi: 0xf0c880, lo: 0xa87a34, ear: 0xb88438, size: 'm', ears: 'flop' },                      // golden
  { base: 0xeceae4, hi: 0xffffff, lo: 0xbcb8ae, ear: 0x6a4428, size: 's', ears: 'up', spots: 0x7a4a2a },       // jackrussell
  { base: 0x7a4a26, hi: 0x9c6a3c, lo: 0x55321a, ear: 0x3e2412, size: 't', ears: 'flop' },                      // tax
  { base: 0x8a8e96, hi: 0xb0b4bc, lo: 0x5e626a, ear: 0x3a3c44, size: 's', ears: 'up', belly: 0xd8dade },        // schnauzer
];
// fr: 0 stå · 1/2 gå · 3 sitt · 4 nosa
function paintDog(br, fr) {
  const P = new Pix(22, 16);
  const small = br.size === 's', tax = br.size === 't';
  const bodyL = small ? 8 : tax ? 12 : 11, bodyH = small ? 4 : tax ? 4 : 5, legH = small ? 2 : tax ? 1 : 3;
  const gy = 14, by1 = gy - legH, by0 = by1 - bodyH + 1;
  const bx0 = 4, bx1 = bx0 + bodyL - 1;
  const C = br, far = mix(C.lo, 0x1a1420, 0.3), nose = 0x16141a;
  const sit = fr === 3, sniff = fr === 4;
  const put = (x, y, c) => P.px(x, y, c);
  // svans
  if (sit) { put(bx0 - 1, gy, C.lo); put(bx0 - 2, gy - 1, C.lo); }
  else {
    const wag = fr === 2 ? 1 : 0;
    put(bx0 - 1, by0 + 1, C.base);
    put(bx0 - 2, by0, C.base);
    put(bx0 - 2 - wag, by0 - 1, C.hi);
    if (!small) put(bx0 - 3 - wag, by0 - 2, C.hi);
  }
  // ben: bortre paret mörkare, sedan det närmaste
  if (!sit) {
    const sw = fr === 1 ? 1 : fr === 2 ? -1 : 0;
    const legs = [[bx0 + 2, sw, true], [bx1 - 1, -sw, true], [bx0 + 1, -sw, false], [bx1 - 2, sw, false]];
    for (const [lx, o, isFar] of legs) {
      for (let j = 1; j < legH; j++) put(lx + (j === legH - 1 && legH > 2 ? o : 0), by1 + j, isFar ? far : C.base);
      put(lx + o, gy, isFar ? mix(far, 0x000000, 0.2) : C.lo);
    }
  } else {
    // sittande: bakbenet vikt under kroppen, frambenen raka
    for (let y = by1 - 1; y <= gy; y++) { put(bx1 - 2, y, far); put(bx1 - 1, y, C.base); }
    put(bx1 - 1, gy, C.lo);
    for (let x = bx0 + 1; x < bx0 + 5; x++) put(x, gy, C.lo);
  }
  // kropp (sittande: bakdelen sjunker, ryggen lutar)
  for (let x = bx0; x <= bx1; x++) {
    const t = (x - bx0) / (bodyL - 1);
    const top = by0 + (sit ? Math.round((1 - t) * 3) - 1 : 0);
    const bot = sit ? (x < bx0 + 5 ? gy - 1 : by1) : by1;
    for (let y = top; y <= bot; y++) {
      if (y === top && (x === bx0 || x === bx1)) continue;
      let c = y === top ? C.hi : y === bot ? C.lo : C.base;
      if (C.spots && y > top && y < bot && hash(x, y, 3) < 0.3) c = C.spots;
      if (C.belly && y === bot && x > bx0 + 1 && x < bx1) c = C.belly;
      put(x, y, c);
    }
  }
  // huvud
  const hs = small ? 4 : 5;
  const hx0 = bx1 - (small ? 1 : 2) + (sniff ? 2 : 0);
  const hy0 = sniff ? by1 - 2 : by0 - hs + 2 - (sit ? 2 : 0);
  if (!sniff) for (let y = hy0 + hs - 1; y <= by0 + 1; y++) for (let x = hx0; x < hx0 + 3; x++) put(x, y, C.base); // hals
  for (let j = 0; j < hs; j++) for (let i = 0; i < hs; i++) {
    if ((j === 0 || j === hs - 1) && (i === 0 || i === hs - 1)) continue;
    put(hx0 + i, hy0 + j, j === 0 ? C.hi : i === hs - 1 && j > 1 ? C.lo : C.base);
  }
  // nos
  const sy = hy0 + hs - 3, sn = small ? 2 : 3;
  for (let i = 0; i < sn; i++) { put(hx0 + hs - 1 + i, sy + 1, C.base); put(hx0 + hs - 1 + i, sy + 2, C.lo); }
  put(hx0 + hs - 2 + sn, sy + 1, nose);
  put(hx0 + hs - 2, hy0 + 1, nose); // öga
  // öron
  if (br.ears === 'up') { put(hx0, hy0 - 1, C.ear); put(hx0 + 1, hy0 - 1, C.ear); put(hx0 + 1, hy0 - 2, C.ear); }
  else { for (let j = 1; j <= 3; j++) put(hx0, hy0 + j, C.ear); put(hx0 + 1, hy0 + 1, C.ear); put(hx0 + 1, hy0 + 2, C.ear); }
  // halsband
  if (!sniff) { put(hx0 + 1, hy0 + hs, 0xc8323a); put(hx0 + 2, hy0 + hs, 0xd84a4a); }
  // tunga när den går
  if (fr === 1 || fr === 2) put(hx0 + hs, sy + 3, 0xe06a7a);
  const neck = sniff ? [hx0 + 1, hy0 + 1] : [hx0 + 2, hy0 + hs];
  return { c: fromPix(P), neck };
}

// ---------- paraply (fyra dukpaneler, spröt och uddar), ett per färg ----------
// Canvasen är 19×9: spetsen i (9,1), duken rad 2–6, uddarna rad 7.
function paintUmbrella(c) {
  const P = new Pix(19, 9, -1, -1);
  const hi = mix(c, 0xffffff, 0.3), mid = mul(c, 0.86), lo = mul(c, 0.7), dk = mix(mul(c, 0.5), 0x1a1426, 0.2);
  const panel = [hi, c, mid, lo];
  P.px(8, 0, 0x2a2630);
  [2, 4, 6, 7, 8].forEach((w, j) => {
    const y = j + 1;
    for (let x = 8 - w; x <= 8 + w; x++) {
      const t = (x - 8) / w;
      let col = panel[t < -0.5 ? 0 : t < 0 ? 1 : t < 0.5 ? 2 : 3];
      if (j > 0 && [-1, -0.5, 0, 0.5, 1].some((r) => Math.round(8 + r * w) === x)) col = mix(col, dk, 0.4); // spröt
      if (j === 4) col = mix(col, dk, 0.18); // kanten lite mörkare
      P.px(x, y, col);
    }
  });
  for (const x of [0, 4, 8, 12, 16]) P.px(x, 6, x < 8 ? mid : dk); // uddarna
  P.px(5, 2, mix(hi, 0xffffff, 0.55)); P.px(4, 3, mix(hi, 0xffffff, 0.4)); P.px(3, 4, mix(hi, 0xffffff, 0.2)); // glans
  return fromPix(P);
}

let SPR = null;
function buildSprites() {
  if (SPR) return SPR;
  const S = { pig: [], cat: {}, bf: [], bird: {}, carry: {}, pase: {}, case: {}, umb: {}, dog: [] };
  for (const v of PIG_VARIANTS) {
    const pal = { ...v, ...PIG_COMMON }, set = {};
    for (const k in PIG_MAPS) set[k] = pairOf(fromMap(PIG_MAPS[k], pal));
    S.pig.push(set);
  }
  for (const k in CAT_MAPS) S.cat[k] = pairOf(fromMap(CAT_MAPS[k], CAT_PAL));
  S.catTail = CAT_TAILS.map((extra) => {
    const rows = CAT_MAPS.awake.map((r) => r.split(''));
    for (const [x, y] of extra) rows[y][x] = 'r';
    if (extra.length) { rows[6][0] = 'O'; rows[5][0] = 'r'; }
    return pairOf(fromMap(rows.map((r) => r.join('')), CAT_PAL));
  });
  for (const col of BF_COLORS) { const set = {}; for (const k in BF_MAPS) set[k] = fromMap(BF_MAPS[k], col, true); S.bf.push(set); }
  for (const k in BIRD) S.bird[k] = BIRD[k].fr.map((rows) => fromMap(rows, BIRD[k].pal, false));
  for (const k in CARRY_MAPS) { const m = CARRY_MAPS[k]; S.carry[k] = { ...pairOf(fromMap(m.rows, m.pal)), ax: m.ax + 1, ay: m.ay + 1 }; }
  for (const c of PASE_COLORS) {
    const m = CARRY_MAPS.pase;
    S.pase[c] = { ...pairOf(fromMap(m.rows, { ...m.pal, C: c, h: mix(c, 0xffffff, 0.3), c: mul(c, 0.7), L: c === 0xf4f1ea ? 0xd24a8a : 0xf4f1ea })), ax: m.ax + 1, ay: m.ay + 1 };
  }
  for (const c of CASE_COLORS) {
    const m = CARRY_MAPS.resvaska;
    S.case[c] = { ...pairOf(fromMap(m.rows, { ...m.pal, C: c, h: mix(c, 0xffffff, 0.28), d: mul(c, 0.68), k: mul(c, 0.55) })), ax: m.ax + 1, ay: m.ay + 1 };
  }
  for (const c of UMB_COLORS) S.umb[c] = paintUmbrella(c);
  for (const br of DOGS) {
    const frames = [];
    for (let f = 0; f < 5; f++) { const d = paintDog(br, f); frames.push({ r: d.c, l: flipX(d.c), neck: d.neck }); }
    S.dog.push(frames);
  }
  SPR = S;
  return S;
}

// Förhandsvisning av alla småfigurer (för utveckling): ark i skala 1.
export function _sheet() {
  const S = buildSprites();
  const c = mkCanvas(320, 150), x = c.getContext('2d');
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, 320, 150);
  let px = 2;
  for (const set of S.pig) { let py = 2; for (const k in set) { x.drawImage(set[k].r, px, py); py += 12; } px += 15; }
  let cx = px + 2;
  for (const k in S.cat) { x.drawImage(S.cat[k].r, cx, 2); cx += S.cat[k].w + 3; }
  S.catTail.forEach((t, i) => x.drawImage(t.r, px + 2 + i * 22, 20));
  S.dog.forEach((frames, i) => frames.forEach((f, j) => x.drawImage(f.r, px + 2 + j * 23, 34 + i * 17)));
  let bx = 2;
  for (const set of S.bf) { let by = 80; for (const k in set) { x.drawImage(set[k], bx, by); by += 5; } bx += 8; }
  let gx = 2;
  for (const k in S.bird) { S.bird[k].forEach((f, i) => x.drawImage(f, gx + i * 13, 100)); gx += 42; }
  let kx = 2;
  for (const k in S.carry) { x.drawImage(S.carry[k].r, kx, 110); kx += S.carry[k].w + 2; }
  let ux = 2;
  for (const k in S.umb) { x.drawImage(S.umb[k], ux, 130); ux += 21; }
  return c.toDataURL('image/png');
}

// =====================================================================
//  Gångnätet
// =====================================================================
const CELL = 2, GW = Math.ceil(CW / CELL), GH = Math.ceil(CH / CELL);
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// 0 = spärrat, 1 = gräs (går att gå på), 2 = belagt (trottoar, gränd, gång, övergångsställe)
function zoneAt(x, y) {
  if (x < 4 || x > CW - 4 || y < CITY.BACK[0] + 2 || y > CH - 4) return 0;
  if (y < CITY.FOOT_TOP) return 2;                                            // bakgatan
  if (y < BASE) return BUILDINGS.some((b) => x >= b.x && x < b.x + b.w) ? 0 : 2; // gränder/tvärgator
  if (y < CITY.ROAD[0]) return 2;                                             // norra trottoaren
  if (y < CITY.ROAD[1]) return CROSSWALKS.some((c) => x >= c.x0 + 6 && x < c.x1 - 6) ? 2 : 0; // bara övergångsställena
  if (y < CITY.PARK[0]) return 2;                                             // södra trottoaren
  if (PATH_RECTS.some((r) => inRect(x, y, r))) return 2;
  const P = PARK_LAYOUT.plaza;
  if (Math.hypot(x - P.cx, y - P.cy) < P.r - 2) return 2;
  return 1;
}

function buildNav(obstacles) {
  const G = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) G[gy * GW + gx] = zoneAt(gx * CELL + 1, gy * CELL + 1);
  for (const o of obstacles) {
    if (!o || o.length < 4) continue;
    const x0 = Math.max(0, Math.floor((o[0] - 4) / CELL)), x1 = Math.min(GW - 1, Math.floor((o[2] + 3) / CELL));
    const y0 = Math.max(0, Math.floor((o[1] - 2) / CELL)), y1 = Math.min(GH - 1, Math.floor((o[3] + 1) / CELL));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) G[gy * GW + gx] = 0;
  }
  const cell = (x, y) => {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : G[gy * GW + gx];
  };
  const walk = (x, y) => cell(x, y) > 0;
  const paved = (x, y) => cell(x, y) === 2;
  const los = (ax, ay, bx, by, test) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let i = 1; i < n; i++) if (!test(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  };
  function nearest(x, y, test, R = 12) {
    if (test(x, y)) return [x, y];
    for (let r = 1; r <= R; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !test(x + dx, y + dy)) continue;
        const d = dx * dx + dy * dy * 1.6;
        if (d < bd) { bd = d; best = [x + dx, y + dy]; }
      }
      if (best) return best;
    }
    return null;
  }
  // bredden-först i en ruta runt sträckan, sedan åtstramad med siktlinjer
  function gridPath(ax, ay, bx, by, test) {
    const pad = 36;
    const gx0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad) / CELL)), gx1 = Math.min(GW - 1, Math.floor((Math.max(ax, bx) + pad) / CELL));
    const gy0 = Math.max(0, Math.floor((Math.min(ay, by) - pad) / CELL)), gy1 = Math.min(GH - 1, Math.floor((Math.max(ay, by) + pad) / CELL));
    const w = gx1 - gx0 + 1, h = gy1 - gy0 + 1;
    const okc = (i, j) => test((gx0 + i) * CELL + 1, (gy0 + j) * CELL + 1);
    const si = Math.floor(ax / CELL) - gx0, sj = Math.floor(ay / CELL) - gy0, ti = Math.floor(bx / CELL) - gx0, tj = Math.floor(by / CELL) - gy0;
    const start = sj * w + si, goal = tj * w + ti;
    const prev = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    prev[start] = start; q[qt++] = start;
    while (qh < qt) {
      const cur = q[qh++];
      if (cur === goal) break;
      const ci = cur % w, cj = (cur / w) | 0;
      for (const [dx, dy] of DIRS8) {
        const ni = ci + dx, nj = cj + dy;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const k = nj * w + ni;
        if (prev[k] >= 0 || !okc(ni, nj)) continue;
        if (dx && dy && (!okc(ci + dx, cj) || !okc(ci, cj + dy))) continue;
        prev[k] = cur; q[qt++] = k;
      }
    }
    if (prev[goal] < 0) return null;
    const cells = [];
    for (let k = goal; k !== start; k = prev[k]) cells.push(k);
    cells.reverse();
    const P = cells.map((k) => [(gx0 + (k % w)) * CELL + 1, (gy0 + ((k / w) | 0)) * CELL + 1]);
    if (!P.length) return [[ax, ay], [bx, by]];
    P[P.length - 1] = [bx, by];
    const out = [[ax, ay]];
    let cx = ax, cy = ay, i = 0;
    while (i < P.length) {
      let j = P.length - 1;
      while (j > i && !los(cx, cy, P[j][0], P[j][1], test)) j--;
      out.push(P[j]); [cx, cy] = P[j]; i = j + 1;
    }
    return out;
  }

  const nodes = [], edges = [];
  const node = (x, y, tag) => {
    const p = nearest(Math.round(x), Math.round(y), paved, 12) || nearest(Math.round(x), Math.round(y), walk, 12);
    if (!p) return -1;
    nodes.push({ x: p[0], y: p[1], tag, adj: [] });
    return nodes.length - 1;
  };
  function link(a, b, opt = {}) {
    if (a < 0 || b < 0 || a === b) return;
    const A = nodes[a], B = nodes[b];
    let pts = los(A.x, A.y, B.x, B.y, paved) ? [[A.x, A.y], [B.x, B.y]] : null;
    if (!pts) pts = gridPath(A.x, A.y, B.x, B.y, paved) || gridPath(A.x, A.y, B.x, B.y, walk);
    if (!pts) return;
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const e = { a, b, pts, len, cross: opt.cross ?? -1, cost: len + (opt.extra || 0) };
    edges.push(e); A.adj.push(e); B.adj.push(e);
  }
  // en rak gånglinje med noder vid alla x (sammanslagna inom 6 px, utfyllda var 110:e px)
  function line(y, xs, tag) {
    const sorted = [...xs].map(Math.round).sort((a, b) => a - b), out = [];
    for (const x of sorted) {
      if (out.length && x - out[out.length - 1] < 6) continue;
      if (out.length) {
        const prev = out[out.length - 1], n = Math.floor((x - prev) / 110);
        for (let k = 1; k <= n; k++) out.push(Math.round(prev + (x - prev) * k / (n + 1)));
      }
      out.push(x);
    }
    const ids = out.map((x) => node(x, y, tag)).filter((i) => i >= 0);
    for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
    return ids;
  }
  const at = (ids, x) => ids.reduce((best, i) => (Math.abs(nodes[i].x - x) < Math.abs(nodes[best].x - x) ? i : best), ids[0]);

  const gaps = STREETS
    .map((s) => ({ s, x0: Math.max(s.x0, 5), x1: Math.min(s.x1, CW - 5) }))
    .filter((g) => g.x1 - g.x0 >= 10)
    .map((g) => ({ ...g, cx: Math.round((g.x0 + g.x1) / 2) }));
  const cwX = CROSSWALKS.map((c) => Math.round((c.x0 + c.x1) / 2));
  const doorX = {};
  for (const b of BUILDINGS) doorX[b.id] = Math.round(doorCenter(b).x);
  const pl = PARK_LAYOUT.plaza, prom = PARK_LAYOUT.promenade;

  const N = line(Y_N, [6, CW - 6, ...gaps.map((g) => g.cx), ...Object.values(doorX), ...cwX], 'n');
  const S = line(Y_S, [6, CW - 6, ...cwX, BUS_STOP.x], 's');
  const Bk = line(Y_BACK, [6, CW - 6, ...gaps.map((g) => g.cx)], 'b');
  const Pm = line(Y_PROM, [prom[0] + 4, prom[2] - 4, ...cwX, pl.cx - 40, pl.cx + 40], 'p');
  // gränder och tvärgator: bakgatan ↔ norra trottoaren
  for (const g of gaps) link(at(Bk, g.cx), at(N, g.cx));
  // övergångsställena (med trafikljus) och parkgångarna
  const curbs = [];
  CROSSWALKS.forEach((c, k) => {
    const cx = cwX[k];
    const kN = node(cx, CURB_N, 'kant'), kS = node(cx, CURB_S, 'kant');
    link(at(N, cx), kN);
    link(kN, kS, { cross: c.i, extra: 50 });
    link(kS, at(S, cx));
    link(at(S, cx), at(Pm, cx));
    curbs.push(kN, kS);
  });
  // torget: en ring runt fontänen
  const ring = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const i = node(pl.cx + Math.cos(a) * (pl.r - 8), pl.cy + Math.sin(a) * (pl.r - 8), 'torg');
    if (i >= 0) ring.push(i);
  }
  for (let k = 0; k < ring.length; k++) link(ring[k], ring[(k + 1) % ring.length]);
  const ringNear = (x, y) => ring.reduce((b, i) => (Math.hypot(nodes[i].x - x, nodes[i].y - y) < Math.hypot(nodes[b].x - x, nodes[b].y - y) ? i : b), ring[0]);
  if (ring.length) {
    link(ringNear(pl.cx, pl.cy - pl.r), at(Pm, pl.cx));
    link(ringNear(pl.cx - pl.r, pl.cy - pl.r * 0.7), at(Pm, pl.cx - 40));
    link(ringNear(pl.cx + pl.r, pl.cy - pl.r * 0.7), at(Pm, pl.cx + 40));
  }

  function route(from, to) {
    if (from === to) return [];
    const n = nodes.length, dist = new Float64Array(n).fill(Infinity), via = new Array(n).fill(null), done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = 1;
      for (const e of nodes[u].adj) {
        const v = e.a === u ? e.b : e.a, d = best + e.cost;
        if (d < dist[v]) { dist[v] = d; via[v] = e; }
      }
    }
    if (!via[to]) return null;
    const segs = [];
    for (let v = to; v !== from;) { const e = via[v], u = e.a === v ? e.b : e.a; segs.push([e, u]); v = u; }
    segs.reverse();
    const pts = [];
    for (const [e, u] of segs) {
      const P = e.a === u ? e.pts : [...e.pts].reverse();
      for (let k = 1; k < P.length; k++) pts.push({ x: P[k][0], y: P[k][1], gate: k === 1 ? e.cross : -1 });
    }
    return pts;
  }

  // dörrnoder, fönsterplatser, busshållplatsens väntplatser, utgångar
  const doorNode = {};
  for (const b of BUILDINGS) doorNode[b.id] = at(N, doorX[b.id]);
  const windows = [];
  for (const b of BUILDINGS) {
    if (!WINDOW_SHOPS.includes(b.id)) continue;
    const half = (b.door.x1 - b.door.x0) / 2 + 12, dc = doorX[b.id];
    for (let x = b.x + 12; x < b.x + b.w - 12; x += 9) {
      if (Math.abs(x - dc) < half) continue;
      const nn = at(N, x), ny = nodes[nn].y, wy = BASE + 7;
      if (paved(x, wy) && paved(x, ny) && los(nodes[nn].x, ny, x, ny, paved) && los(x, ny, x, wy, paved)) windows.push({ b, x, y: wy, node: nn, ny });
    }
  }
  // gångväg mellan två godtyckliga punkter (rak om det går, annars runt hindren)
  function pathTo(ax, ay, bx, by) {
    if (los(ax, ay, bx, by, walk)) return [{ x: bx, y: by, gate: -1, noOff: true }];
    const P = gridPath(ax, ay, bx, by, paved) || gridPath(ax, ay, bx, by, walk);
    return P ? P.slice(1).map(([x, y]) => ({ x, y, gate: -1, noOff: true })) : null;
  }
  // busshållplatsen: väntplatser runt skjulet (nära kanten och hållplatsen först)
  const busNode = at(S, BUS_STOP.x), bus = [];
  {
    const B0 = nodes[busNode], cand = [];
    for (let x = BUS_STOP.x - 48; x <= BUS_STOP.x + 48; x += 6) {
      for (const y of [286, 290, 295, 298]) if (paved(x, y)) cand.push({ x, y, s: Math.abs(x - BUS_STOP.x) * 0.6 + (y - 284) * 1.2 });
    }
    cand.sort((a, b) => a.s - b.s);
    for (const c of cand) {
      if (bus.length >= 8) break;
      if (bus.some((b) => Math.abs(b.x - c.x) < 8 && Math.abs(b.y - c.y) < 6)) continue;
      const there = pathTo(B0.x, B0.y, c.x, c.y);
      if (!there || there.length > 6) continue;
      const back = pathTo(c.x, c.y, B0.x, B0.y);
      if (!back) continue;
      bus.push({ x: c.x, y: c.y, busy: null, there, back });
    }
  }
  const ends = (ids) => (ids.length ? [{ n: ids[0], dir: -1 }, { n: ids[ids.length - 1], dir: 1 }] : []);
  const exits = [...ends(N), ...ends(S), ...ends(Pm), ...ends(Bk).map((e) => ({ ...e, back: true }))];
  const curbSet = new Set(curbs);
  const spawnNodes = [...N, ...S, ...Pm].filter((i) => !curbSet.has(i));

  return { G, walk, paved, los, nearest, pathTo, nodes, edges, route, N, S, Bk, Pm, ring, doorNode, windows, busNode, bus, exits, spawnNodes };
}

// =====================================================================
//  createLife
// =====================================================================
export function createLife(env, traffic) {
  const T = traffic || {};
  const green = (i) => { try { return typeof T.pedGreen === 'function' ? !!T.pedGreen(i) : true; } catch { return true; } };
  const S = buildSprites();
  const nav = buildNav(env.obstacles || []);
  const { nodes, walk, paved } = nav;
  const parkNodes = [...nav.Pm, ...nav.ring];

  let cam = { x: 0, y: 0 };
  const updCam = () => {
    const px = env.player?.x ?? CW / 2, py = env.player?.y ?? 200;
    cam = { x: clamp(px - VW / 2, 0, CW - VW), y: clamp(py - VH * 0.62, 0, CH - VH) };
  };
  const visible = (x, y, m = 16) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + 44;
  const camCX = () => cam.x + VW / 2;

  // ------------------------------------------------------------------
  //  Fotgängare
  // ------------------------------------------------------------------
  let peds = [];
  let nextId = 1;
  function lookFor(kid, jogger) {
    let L = makeLook();
    for (let i = 0; i < 40 && !!L.kid !== !!kid; i++) L = makeLook();
    if (jogger) L = { ...L, top: 'tee', bottom: 'shorts', bag: null, hat: rnd() < 0.4 ? 'cap' : null, phones: rnd() < 0.5, shoes: pick(['#f2f2f2', '#3a6bc2', '#c23b3b']) };
    return L;
  }
  function mkPed(look) {
    return {
      id: nextId++, look, x: 0, y: 0, ox: 0, oy: 0, hx: 1, hy: 0, lane: rr(2.5, 9), speed: look.kid ? rr(30, 38) : rr(24, 34),
      anim: rnd() * 4, face: 'down', path: [], plan: [], hold: 0, node: -1, moving: false, hidden: false, door: null,
      carry: null, carryCol: pick(PASE_COLORS), caseCol: pick(CASE_COLORS), umb: rnd() < 0.8 ? pick(UMB_COLORS) : null,
      dog: null, comp: null, leader: null, jogger: false, trail: [], trailT: 0, seed: rnd() * 100, gone: false, leaving: false,
      onCross: -1, look4bus: false, spot: null, wj: [rr(-1, 1), rr(0, 1)],
    };
  }
  function addExtras(p) {
    const h = env.hour, late = h < 6 || h >= 21;
    if (p.look.kid) return;
    if (rnd() < (late ? 0.4 : 0.18)) {
      const br = ri(0, DOGS.length - 1);
      p.dog = { br, x: p.x - 8, y: p.y, dir: 1, fr: 0, anim: 0, act: 'walk', t: 0, tx: p.x, ty: p.y, tie: null };
      p.speed = Math.min(p.speed, 28);
    } else if (!late && rnd() < 0.2 && peds.length < targetCount(h)) {
      const c = mkPed(lookFor(rnd() < 0.5, false));
      c.leader = p; c.x = p.x - 6; c.y = p.y; c.node = p.node; c.umb = rnd() < 0.5 ? c.umb : null;
      p.comp = c; p.speed = Math.min(p.speed, 30);
      peds.push(c);
    }
    if (!p.dog && rnd() < 0.12) p.carry = pick(['kasse', 'pase', 'kasse', 'frakt']);
  }
  function spawn(kind, arg) {
    const h = env.hour, late = h < 6 || h >= 21.5;
    const jog = kind !== 'door' && ((h >= 6 && h < 10) || (h >= 17 && h < 21)) && rnd() < 0.1;
    const p = mkPed(lookFor(!late && !jog && rnd() < 0.12, jog));
    if (jog) { p.jogger = true; p.speed = rr(58, 70); p.umb = null; }
    if (kind === 'node') {
      const n = nodes[arg];
      p.node = arg; p.x = n.x; p.y = n.y;
    } else if (kind === 'edge') {
      const n = nodes[arg.n];
      p.node = arg.n; p.x = arg.dir < 0 ? -12 : CW + 12; p.y = n.y;
      p.plan.push({ k: 'to', x: n.x, y: n.y });
    } else if (kind === 'door') {
      const b = arg, dc = doorCenter(b);
      p.node = nav.doorNode[b.id]; p.x = dc.x; p.y = BASE - 3;
      p.door = { b, ph: 'inside', t: rr(0.3, 3), stay: 0, spawned: true };
      p.hidden = true;
      if (b.id === 'flyg' && rnd() < 0.7) p.carry = 'resvaska';
    }
    peds.push(p);
    if (!p.jogger) addExtras(p);
    if (p.comp) { p.comp.x = p.x; p.comp.y = p.y; p.comp.hidden = p.hidden; }
    if (p.dog) { p.dog.x = p.x - 8; p.dog.y = p.y; }
    if (p.door && p.dog) p.dog.tie = tieSpot(p.door.b);
    p.plan.push(...planFor(p));
    return p;
  }

  // ---------- planerna ----------
  // mål nära kameran är mycket vanligare än mål långt bort
  const nearW = (x, spread = 190) => Math.exp(-Math.max(0, Math.abs(x - camCX()) - 150) / spread);
  function nearNodes(ids, spread = 190) {
    return wpick(ids.map((i) => [i, nearW(nodes[i].x, spread) + 0.01]));
  }
  function planFor(p) {
    const st = [], h = env.hour, dark = env.dark > 0.3, rain = env.rain;
    if (p.jogger) {
      const a = nav.Pm[0], b = nav.Pm[nav.Pm.length - 1];
      const first = Math.abs(nodes[a].x - p.x) > Math.abs(nodes[b].x - p.x) ? a : b;
      if (nav.ring.length && rnd() < 0.7) st.push({ k: 'go', n: pick(nav.ring) }, { k: 'go', n: pick(nav.ring) });
      st.push({ k: 'go', n: first }, { k: 'leave' });
      return st;
    }
    const n = ri(1, 3);
    for (let i = 0; i < n; i++) {
      const shops = BUILDINGS.filter((b) => SHOPS[b.id] && isOpen(b, h + 0.3));
      const opts = [];
      if (shops.length) opts.push(['shop', (rain ? 5 : 3) * (p.dog ? 0.4 : 1)]);
      if (!dark && nav.windows.length) opts.push(['window', 1.4]);
      if (!rain && h >= 6.5 && h < 22 && parkNodes.length) opts.push(['park', p.dog ? 5 : 2]);
      if (h >= 6 && h < 23.5 && nav.bus.length) opts.push(['bus', 0.8]);
      opts.push(['wander', 1.6]);
      if (!dark && nav.Bk.length) opts.push(['alley', 0.45]);
      const a = wpick(opts);
      if (a === 'shop') {
        const near = shops.map((b) => [b, SHOPS[b.id].w * (nearW(doorCenter(b).x, 260) + 0.02)]);
        const b = wpick(near);
        if (b.id === 'flyg' && rnd() < 0.5 && !p.carry) p.carry = 'resvaska';
        st.push({ k: 'go', n: nav.doorNode[b.id] }, { k: 'door', b, t: rr(...SHOPS[b.id].stay) });
      } else if (a === 'window') {
        const w = wpick(nav.windows.map((w) => [w, nearW(w.x) + 0.01]));
        st.push({ k: 'go', n: w.node }, { k: 'to', x: w.x, y: w.ny, at: w.node }, { k: 'to', x: w.x, y: w.y, noOff: true, at: w.node },
          { k: 'wait', t: rr(2.5, 7), face: 'up' }, { k: 'to', x: w.x, y: w.ny, at: w.node });
      } else if (a === 'park') {
        const k = ri(2, 4);
        for (let j = 0; j < k; j++) {
          const nn = nearNodes(parkNodes, 260);
          st.push({ k: 'go', n: nn });
          if (nav.ring.includes(nn) && rnd() < 0.5) {
            const pl = PARK_LAYOUT.plaza;
            st.push({ k: 'wait', t: rr(3, 9), face: faceTo(pl.cx - nodes[nn].x, pl.cy - nodes[nn].y) });
          }
        }
      } else if (a === 'bus') {
        st.push({ k: 'go', n: nav.busNode }, { k: 'bus', t: rr(8, 26) });
      } else if (a === 'alley') {
        st.push({ k: 'go', n: pick(nav.Bk) }, { k: 'go', n: pick(nav.Bk) });
      } else {
        st.push({ k: 'go', n: nearNodes(nav.spawnNodes) });
        if (rnd() < 0.3) st.push({ k: 'wait', t: rr(1, 4), face: pick(['down', 'left', 'right']) });
      }
    }
    st.push({ k: 'leave' });
    return st;
  }

  function nextStep(p) {
    const s = p.plan.shift();
    if (!s) { p.plan = planFor(p); return; }
    switch (s.k) {
      case 'go': {
        if (p.node === s.n) return;
        const r = p.node >= 0 ? nav.route(p.node, s.n) : null;
        if (!r) return; // går inte att nå – hoppa över steget
        const N0 = nodes[p.node];
        if (Math.hypot(N0.x - p.x, N0.y - p.y) > 2) r.unshift({ x: N0.x, y: N0.y, gate: -1 });
        p.path = r; p.node = s.n;
        return;
      }
      case 'to':
        // en avstickare från en nod (fönster) – bara om man faktiskt kom fram till noden
        if (s.at !== undefined && p.node !== s.at) return;
        p.path = [{ x: s.x, y: s.y, gate: -1, noOff: !!s.noOff }];
        return;
      case 'wait': p.hold = s.t; p.face = s.face || p.face; return;
      case 'bus': {
        const free = nav.bus.filter((b) => !b.busy);
        if (!free.length || p.node !== nav.busNode) { if (p.plan[0]?.bus) p.plan.shift(); return; }
        const spot = pick(free), N0 = nodes[p.node];
        spot.busy = p.id; p.spot = spot;
        p.path = spot.there.map((q) => ({ ...q }));
        if (Math.hypot(N0.x - p.x, N0.y - p.y) > 2) p.path.unshift({ x: N0.x, y: N0.y, gate: -1 });
        p.plan.unshift({ k: 'wait', t: s.t, face: 'up', bus: true }, { k: 'unbus' });
        return;
      }
      case 'unbus': {
        const spot = p.spot;
        if (spot) { spot.busy = null; p.spot = null; }
        p.look4bus = false;
        // "bussen kom" – är man utom synhåll kliver man bara på
        if (!visible(p.x, p.y, 40) && rnd() < 0.6) { p.gone = true; return; }
        const N0 = nodes[p.node];
        p.path = spot ? spot.back.map((q) => ({ ...q })) : [{ x: N0.x, y: N0.y, gate: -1 }];
        return;
      }
      case 'pts': p.path = s.pts.map((q) => ({ ...q })); return;
      case 'door': {
        const b = s.b, dc = doorCenter(b);
        if (p.node !== nav.doorNode[b.id]) return; // kom aldrig fram till dörren
        p.door = { b, ph: 'app', t: 0, stay: s.t };
        p.path = [{ x: dc.x + rr(-2, 2), y: BASE + 9, gate: -1, noOff: true }];
        if (p.dog) p.dog.tie = tieSpot(b);
        return;
      }
      case 'leave': {
        if (!visible(p.x, p.y, 60)) { p.gone = true; return; }
        const ex = wpick(nav.exits.map((e) => [e, (e.back ? 0.15 : 1) / (1 + Math.abs(nodes[e.n].x - p.x) / 250)]));
        p.plan.unshift({ k: 'go', n: ex.n }, { k: 'out', dir: ex.dir });
        return;
      }
      case 'out': p.leaving = true; p.path = [{ x: s.dir < 0 ? -14 : CW + 14, y: p.y, gate: -1, noOff: true }]; return;
      case 'board': {
        // klev på bussen – men hann den gå får man vänta på nästa
        if (busAtStop() || !visible(p.x, p.y, 30)) { p.gone = true; return; }
        const B0 = nodes[nav.busNode];
        p.face = 'right';
        p.plan.unshift({ k: 'wait', t: rr(0.6, 1.4), face: 'right' }, { k: 'pts', pts: nav.pathTo(p.x, p.y, B0.x, B0.y) || [{ x: B0.x, y: B0.y, gate: -1 }] }, { k: 'bus', t: rr(15, 40) });
        return;
      }
    }
  }

  // ---------- bussen: de som väntar kliver på, några kliver av ----------
  // traffic.vehicles() är ett frivilligt tillägg i trafikmodulen – finns det inte väntar man bara.
  let busServed = false;
  function busAtStop() {
    if (typeof T.vehicles !== 'function') return null;
    let vs = null;
    try { vs = T.vehicles(); } catch { return null; }
    for (const v of vs || []) {
      if (v.kind !== 'buss' || v.v > 1.5) continue;
      const front = v.dir > 0 ? v.x1 : v.x0;
      if (Math.abs(front - (BUS_STOP.x + 10 * v.dir)) < 16) return v;
    }
    return null;
  }
  function updBus() {
    const bus = busAtStop();
    if (!bus) { busServed = false; return; }
    const bx = Math.round((bus.x0 + bus.x1) / 2) + 4, by = CURB_S;
    // alla som står och väntar (även de som hinner fram medan bussen står still) kliver på
    for (const p of peds) {
      if (p.leader || !p.spot || p.door) continue;
      p.spot.busy = null; p.spot = null; p.look4bus = false;
      p.hold = rr(0, 0.5); p.path = [];
      const tx = bx + rr(-3, 3), pts = nav.pathTo(p.x, p.y, tx, by) || [{ x: tx, y: by, gate: -1, noOff: true }];
      p.plan = [{ k: 'pts', pts }, { k: 'board' }];
    }
    if (busServed) return;
    busServed = true;
    // någon kliver av (en gång per stopp)
    if (peds.length < targetCount(env.hour)) {
      for (let i = Math.min(ri(0, 2), targetCount(env.hour) - peds.length); i > 0; i--) {
        const p = spawn('node', nav.busNode);
        p.x = bx + rr(-3, 3); p.y = by; p.hidden = true; p.hold = 0.8 + i * rr(0.5, 1); p.fromBus = true;
        if (p.comp) { p.comp.x = p.x; p.comp.y = p.y; }
        if (p.dog) { p.dog.x = p.x; p.dog.y = p.y + 2; }
        const B0 = nodes[nav.busNode];
        p.plan.unshift({ k: 'pts', pts: nav.pathTo(p.x, p.y, B0.x, B0.y) || [{ x: B0.x, y: B0.y, gate: -1 }] });
      }
    }
  }
  function tieSpot(b) {
    const dc = doorCenter(b), half = (b.door.x1 - b.door.x0) / 2 + 12;
    for (const side of [1, -1]) {
      const q = nav.nearest(Math.round(dc.x + side * half), BASE + 7, paved, 6);
      if (q) return { x: q[0], y: q[1] };
    }
    return null;
  }
  function gotItem(p, b) {
    const shop = SHOPS[b.id];
    if (!shop || p.look.kid || p.jogger) return;
    if (b.id === 'flyg' && p.carry === 'resvaska') { p.carry = null; if (rnd() < 0.8) p.flew = true; return; }
    for (const [kind, prob] of shop.carry) if (rnd() < prob) { p.carry = kind; break; }
  }

  // ---------- dörrarna: gå in, var borta en stund, kom ut igen ----------
  function updDoor(p, dt) {
    const D = p.door, dc = doorCenter(D.b);
    if (D.ph === 'app') {
      if (p.path.length) return false;
      D.ph = 'pause'; D.t = 0.35; p.face = 'up';
    }
    if (D.ph === 'pause') { D.t -= dt; p.moving = false; if (D.t <= 0) D.ph = 'in'; return true; }
    if (D.ph === 'in') {
      p.y -= 17 * dt; p.x += (dc.x - p.x) * Math.min(1, dt * 5);
      p.moving = true; p.hx = 0; p.hy = -1; p.anim += dt * 17 / 5;
      if (p.y <= BASE - 3) {
        p.y = BASE - 3; p.hidden = true; D.ph = 'inside'; D.t = D.stay;
        if (p.flew) p.gone = true;
      }
      return true;
    }
    if (D.ph === 'inside') {
      D.t -= dt; p.moving = false;
      if (D.t <= 0) {
        // resenärer som dök upp inne på flygplatsen kommer ut med sin väska
        if (!(D.spawned && D.b.id === 'flyg')) gotItem(p, D.b);
        if (p.flew) { p.gone = true; return true; }
        if (p.comp && rnd() < 0.4) gotItem(p.comp, D.b);
        D.ph = 'out0'; D.t = 0.55; p.hidden = false; p.face = 'down';
      }
      return true;
    }
    if (D.ph === 'out0') { D.t -= dt; p.moving = false; p.face = 'down'; if (D.t <= 0) D.ph = 'out'; return true; }
    if (D.ph === 'out') {
      p.y += 17 * dt; p.moving = true; p.hx = 0; p.hy = 1; p.anim += dt * 17 / 5;
      if (p.y >= BASE + 9) {
        p.door = null;
        if (p.dog) p.dog.tie = null;
        const N0 = nodes[p.node];
        p.path = [{ x: N0.x, y: N0.y, gate: -1 }];
      }
      return true;
    }
    return false;
  }
  const doorAlpha = (p, y) => {
    const D = p.door;
    if (!D) return 1;
    if (D.ph === 'out0') return clamp(0.35 * (1 - D.t / 0.55), 0.05, 0.35);
    return clamp(0.35 + (y - (BASE - 3)) / 7 * 0.65, 0.35, 1);
  };

  // ---------- gång ----------
  let others = [];
  function movePed(p, dt) {
    if (p.door && updDoor(p, dt)) { p.ox *= 0.8; p.oy *= 0.8; return; }
    if (p.hold > 0) {
      p.hold -= dt; p.moving = false;
      // står man på en utvald plats (fönster, hållplats) glider sidoförskjutningen bort
      if (p.stillSpot || !walk(p.x + p.ox, p.y + p.oy)) { const k = 1 - Math.min(1, dt * 5); p.ox *= k; p.oy *= k; }
      if (p.hold <= 0) { p.look4bus = false; if (p.fromBus) { p.fromBus = false; p.hidden = false; p.face = 'down'; } }
      return;
    }
    const wp = p.path[0];
    if (!wp) {
      p.moving = false;
      if (p.leaving) { p.gone = true; return; }
      nextStep(p);
      if (p.plan[0]?.bus) p.look4bus = true;
      return;
    }
    let dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { p.hx = dx / d; p.hy = dy / d; }
    // rödljus: stå vid kanten tills gubben blir grön
    if (wp.gate >= 0) {
      if (!green(wp.gate)) { p.moving = false; p.waitGate = true; p.face = faceTo(dx, dy); laneOffset(p, dt, wp); return; }
      // reaktionstid när gubben slår om – sedan kollas ljuset igen innan man kliver ut
      if (p.waitGate) { p.waitGate = false; p.hold = rr(0.15, 0.7); return; }
      if (typeof T.pedLight === 'function') { let l = 'g'; try { l = T.pedLight(wp.gate); } catch { /* strunta i det */ } if (l === 'x') { p.waitGate = true; p.moving = false; return; } }
      p.onCross = wp.gate; wp.gate = -1;
    }
    let sp = p.speed;
    if (env.rain && !(p.umb) && !p.jogger) sp *= 1.2;
    if (p.onCross >= 0 && !green(p.onCross)) sp *= 1.45;
    // någon rakt framför? sakta in lite
    const X = p.x + p.ox, Y = p.y + p.oy;
    let block = 0;
    for (const q of others) {
      if (q === p || q.hidden) continue;
      const qx = q.x + (q.ox || 0), qy = q.y + (q.oy || 0);
      const rx = qx - X, ry = qy - Y, ahead = rx * p.hx + ry * p.hy;
      if (ahead <= 0 || ahead > 12) continue;
      const side = -rx * p.hy + ry * p.hx;
      if (Math.abs(side) < 5) block = Math.max(block, 1 - ahead / 14);
    }
    if (block) sp *= 1 - block * 0.55;
    const step = sp * dt;
    if (d <= step) {
      p.x = wp.x; p.y = wp.y; p.path.shift(); p.stillSpot = !!wp.noOff;
      if (p.onCross >= 0 && (!p.path.length || p.y >= CURB_S - 1 || p.y <= CURB_N + 1)) p.onCross = -1;
    } else { p.x += dx / d * step; p.y += dy / d * step; }
    p.moving = true;
    p.anim += dt * sp / (p.jogger ? 4.5 : 5);
    laneOffset(p, dt, wp);
  }
  // sidoförskjutningen måste vara fri både här och en bit framåt (annars hinner man in i hindret)
  const okOff = (p, tx, ty) => paved(p.x + tx, p.y + ty) && paved(p.x + p.hx * 5 + tx, p.y + p.hy * 5 + ty) && paved(p.x + p.hx * 10 + tx, p.y + p.hy * 10 + ty);
  // högertrafik på trottoaren: varje figur håller sig en bit till höger om mittlinjen
  function laneOffset(p, dt, wp) {
    let lane = wp && wp.noOff ? 0 : p.lane;
    let tx = -p.hy * lane, ty = p.hx * lane;
    if (lane) {
      if (!okOff(p, tx, ty)) { tx *= 0.5; ty *= 0.5; if (!okOff(p, tx, ty)) { tx = 0; ty = 0; } }
      // väj för någon som står i vägen
      for (const q of others) {
        if (q === p || q.hidden) continue;
        const rx = q.x + (q.ox || 0) - (p.x + p.ox), ry = q.y + (q.oy || 0) - (p.y + p.oy);
        const ahead = rx * p.hx + ry * p.hy;
        if (ahead <= 0 || ahead > 16) continue;
        const side = -rx * p.hy + ry * p.hx;
        if (Math.abs(side) < 6) {
          const s = side >= 0 ? -7 : 7, ax = tx - p.hy * s, ay = ty + p.hx * s;
          if (paved(p.x + ax, p.y + ay)) { tx = ax; ty = ay; }
          break;
        }
      }
    }
    if (p.waitGate) {
      // vid rödljuset sprider man ut sig längs kanten och några står en bit bakom
      const a = p.wj[0] * 8, bk = p.wj[1] * 8;
      const wx = tx - p.hy * a - p.hx * bk, wy = ty + p.hx * a - p.hy * bk;
      if (paved(p.x + wx, p.y + wy)) { tx = wx; ty = wy; }
    }
    const k = Math.min(1, dt * 4);
    p.ox += (tx - p.ox) * k; p.oy += (ty - p.oy) * k;
    if (!walk(p.x + p.ox, p.y + p.oy)) { p.ox *= 0.3; p.oy *= 0.3; }
  }
  function sampleTrail(p, dt) {
    p.trailT += dt;
    if (p.trailT < 0.05) return;
    p.trailT = 0;
    p.trail.push({ x: p.x + p.ox, y: p.y + p.oy });
    if (p.trail.length > 14) p.trail.shift();
  }

  // ---------- sällskap: går bredvid ledaren (följer dess spår) ----------
  function updComp(c, dt) {
    const L = c.leader;
    c.hidden = L.hidden;
    c.door = L.door;
    if (c.hidden) { c.x = L.x; c.y = L.y; c.ox = c.oy = 0; c.moving = false; return; }
    const tr = L.trail, lag = Math.min(tr.length - 1, 5);
    const src = lag >= 0 ? tr[tr.length - 1 - lag] : { x: L.x, y: L.y };
    let tx = src.x + L.hy * 8, ty = src.y - L.hx * 8;
    if (L.door || !paved(tx, ty) || L.waitGate) {
      tx = src.x; ty = src.y;
      if (L.waitGate) { tx = L.x + L.ox - L.hy * -9; ty = L.y + L.oy + L.hx * -9; if (!paved(tx, ty)) { tx = src.x; ty = src.y; } }
    }
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const sp = Math.max(L.speed * 1.5, 34) * dt;
    if (d > 0.5) {
      const s = Math.min(d, sp), nx = c.x + dx / d * s, ny = c.y + dy / d * s;
      if (walk(nx, ny) || L.door) { c.x = nx; c.y = ny; } else { c.x = src.x; c.y = src.y; }
      c.hx = dx / d; c.hy = dy / d;
    }
    c.moving = d > 1.5 || (L.moving && d > 0.5);
    if (c.moving) c.anim += dt * L.speed / 5;
    c.face = L.moving ? headingDir(c.hx, c.hy) : L.face;
    c.speed = L.speed;
  }

  // ---------- hundar ----------
  function updDog(p, dt) {
    const g = p.dog, X = p.x + p.ox, Y = p.y + p.oy;
    const inside = p.door && p.door.ph !== 'app' && p.door.ph !== 'out';
    let tx, ty, spd = Math.max(p.speed * 1.5, 40);
    if (inside && g.tie) { tx = g.tie.x; ty = g.tie.y; g.act = 'sit'; }
    else if (p.moving || p.waitGate) {
      // hunden drar lite före, på vänstra sidan
      tx = X + p.hx * 9 + p.hy * 4; ty = Y + p.hy * 9 - p.hx * 4;
      if (p.waitGate) {
        // vid rödljuset: sitt kvar bredvid, inte ute i gatan
        tx = X + p.hy * 7; ty = Y - p.hx * 7;
        if (!paved(tx, ty) || !paved(tx + p.hx * 6, ty + p.hy * 6)) { tx = X - p.hx * 6; ty = Y - p.hy * 6; }
        g.act = 'sit';
      } else if (!walk(tx, ty) || (p.onCross >= 0 && !paved(tx, ty))) {
        const tr = p.trail, s = tr[Math.max(0, tr.length - 8)];
        if (s) { tx = s.x; ty = s.y; } else { tx = X - p.hx * 8; ty = Y - p.hy * 8; }
      }
      if (!p.waitGate) g.act = 'walk';
    } else {
      // matte/husse står still: nosa runt, ibland sitta
      g.t -= dt;
      if (g.t <= 0) {
        g.act = rnd() < 0.4 ? 'sit' : 'sniff';
        g.t = rr(1.5, 4);
        const a = rnd() * Math.PI * 2, r = rr(5, 11);
        g.tx = X + Math.cos(a) * r; g.ty = Y + Math.sin(a) * r * 0.5;
        if (!walk(g.tx, g.ty)) { g.tx = X + 6; g.ty = Y + 1; }
      }
      tx = g.tx; ty = g.ty; spd = 22;
    }
    const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
    g.moving = d > 0.8;
    if (g.moving) {
      const s = Math.min(d, spd * dt), nx = g.x + dx / d * s, ny = g.y + dy / d * s;
      if (walk(nx, ny) || d < 3) { g.x = nx; g.y = ny; }
      else { const tr = p.trail, q = tr[Math.max(0, tr.length - 6)]; if (q) { g.x = q.x; g.y = q.y; } }
      if (Math.abs(dx) > 0.3) g.dir = dx < 0 ? -1 : 1;
      g.anim += dt * Math.max(spd, 20) / 3.2;
    }
    // kopplet är 18 px långt
    if (!inside) {
      const lx = g.x - X, ly = g.y - Y, ld = Math.hypot(lx, ly);
      if (ld > 18) { g.x = X + lx / ld * 18; g.y = Y + ly / ld * 18; }
    }
    g.fr = g.moving ? 1 + (Math.floor(g.anim) % 2) : g.act === 'sit' ? 3 : g.act === 'sniff' && Math.sin(env.t * 3 + p.seed) > -0.3 ? 4 : 0;
    if (!g.moving && g.act !== 'sit' && !inside) g.dir = X < g.x ? -1 : 1;
    if (inside && !g.moving) { g.fr = 3; g.dir = doorCenter(p.door.b).x < g.x ? -1 : 1; }
  }

  // ---------- befolkningen ----------
  function targetCount(h) {
    const n = h < 5 ? 3 : h < 6.5 ? 4 : h < 8 ? 9 : h < 16 ? 13 : h < 19 ? 14 : h < 21 ? 9 : h < 23 ? 6 : 4;
    return Math.round(n * (env.rain ? 0.75 : 1));
  }
  // Nya figurer dyker upp strax utanför bild (eller kommer ut ur en butik), så
  // att det alltid är liv där spelaren är – staden är 4–5 skärmar bred.
  function spawnSomewhere(initial) {
    const h = env.hour, open = BUILDINGS.filter((b) => SHOPS[b.id] && isOpen(b, h));
    const c = camCX();
    if (rnd() < (initial ? 0.2 : 0.3) && open.length) {
      const near = open.filter((b) => Math.abs(doorCenter(b).x - c) < 330);
      if (near.length) return spawn('door', pick(near));
    }
    const cands = nav.spawnNodes.filter((i) => {
      const n = nodes[i];
      return Math.abs(n.x - c) < (initial ? 300 : 340) && (initial || !visible(n.x, n.y, 26));
    });
    const edges = nav.exits.filter((e) => !e.back && Math.abs(nodes[e.n].x - c) < 340);
    if (edges.length && (!cands.length || rnd() < 0.3)) return spawn('edge', pick(edges));
    if (cands.length) return spawn('node', pick(cands));
    return spawn('edge', pick(nav.exits));
  }
  let spawnT = 0;
  function manage(dt) {
    // alla figurer räknas (även sällskap), målet är 8–14 på dagen och färre på natten
    const want = targetCount(env.hour);
    const leaders = peds.length;
    spawnT -= dt;
    if (leaders < want && spawnT <= 0) { spawnSomewhere(false); spawnT = want - leaders > 4 ? rr(0.1, 0.3) : rr(0.4, 1.6); }
    // de som vandrat långt från kameran byts ut mot nya i närheten
    const c = camCX();
    for (const p of peds) {
      if (p.leader || p.gone) continue;
      if (Math.abs(p.x - c) > 420 && !visible(p.x, p.y, 40) && rnd() < dt * 0.5) p.gone = true;
      if (leaders > want + 1 && !visible(p.x, p.y, 40) && rnd() < dt * 0.05) p.gone = true;
    }
    cleanup();
  }
  function cleanup() {
    if (!peds.some((p) => p.gone || (p.leader && p.leader.gone))) return;
    for (const p of peds) if ((p.gone || (p.leader && p.leader.gone)) && p.spot) { p.spot.busy = null; p.spot = null; }
    peds = peds.filter((p) => !p.gone && !(p.leader && p.leader.gone));
  }
  // Kameran hoppade (ut ur en butik långt bort, teleport): byt ut de som blev
  // kvar långt borta och fyll på runt den nya platsen direkt.
  let lastCam = null;
  function repopulate() {
    const c = camCX();
    for (const p of peds) if (!p.leader && Math.abs(p.x - c) > 380) p.gone = true;
    cleanup();
    for (let i = 0; i < 40 && peds.length < targetCount(env.hour); i++) preRun(spawnSomewhere(true), rr(0, 16));
  }

  // ------------------------------------------------------------------
  //  Duvor
  // ------------------------------------------------------------------
  const FLOCK = [[1040, 207], [470, 209], [1395, 206], [720, 293], [1110, 294], [170, 293], [905, 386], [962, 352],
    [620, 352], [1470, 358], [150, 356], [560, 24], [1300, 24], [800, 210], [1560, 294]]
    .map(([x, y]) => nav.nearest(x, y, walk, 10)).filter(Boolean);
  const pigeons = [];
  const threatsNear = (x, y, r) => {
    for (const q of env.people || []) if (Math.abs(q.x - x) < r && Math.abs(q.y - y) < r * 0.7) return q;
    for (const p of peds) if (p.dog && Math.abs(p.dog.x - x) < r + 4 && Math.abs(p.dog.y - y) < (r + 4) * 0.7) return p.dog;
    return null;
  };
  function landSpot(s) {
    for (let i = 0; i < 6; i++) {
      const x = s[0] + rr(-14, 14), y = s[1] + rr(-6, 6);
      if (walk(x, y)) return [x, y];
    }
    return [s[0], s[1]];
  }
  function mkPigeon(spot, x, y) {
    return { x, y, v: pick([0, 0, 0, 0, 1, 1, 2, 3]), dir: pick([-1, 1]), st: 'g', act: 'stand', t: rr(0.2, 2), alt: 0, spot, tx: x, ty: y, fl: null, panic: 0, anim: rnd() * 10, from: null };
  }
  {
    const used = [...FLOCK].sort(() => rnd() - 0.5).slice(0, 7);
    for (const s of used) {
      const n = ri(2, 5);
      for (let i = 0; i < n; i++) {
        const [x, y] = landSpot(s), pg = mkPigeon(s, x, y);
        if (env.dark > 0.3) { pg.st = 'a'; pg.t = rr(5, 40); } // på natten sover duvorna på taken
        pigeons.push(pg);
      }
    }
  }
  function flight(pg, tx, ty, a1) {
    const dist = Math.hypot(tx - pg.x, ty - pg.y);
    pg.fl = { x0: pg.x, y0: pg.y, a0: pg.alt, x1: tx, y1: ty, a1, T: Math.max(0.9, dist / rr(70, 92)), u: 0, h: 12 + dist * 0.08, away: a1 > 0 };
    pg.st = 'f';
    if (Math.abs(tx - pg.x) > 2) pg.dir = tx < pg.x ? -1 : 1;
  }
  function takeOff(pg, from) {
    const away = Math.sign(pg.x - (from ? from.x : pg.x - 1)) || pick([-1, 1]);
    const cands = FLOCK.filter((s) => Math.sign(s[0] - pg.x) === away && Math.abs(s[0] - pg.x) > 60 && Math.abs(s[0] - pg.x) < 460 && !threatsNear(s[0], s[1], 36));
    if (cands.length && rnd() < 0.75 && env.dark < 0.3) {
      const s = pick(cands), [x, y] = landSpot(s);
      pg.spot = s; flight(pg, x, y, 0);
    } else flight(pg, pg.x + away * rr(180, 300), pg.y - rr(30, 80), rr(70, 100));
  }
  function updPigeons(dt) {
    const dark = env.dark > 0.3;
    for (const pg of pigeons) {
      pg.anim += dt;
      if (pg.st === 'g') {
        if (pg.panic > 0) { pg.panic -= dt; if (pg.panic <= 0) takeOff(pg, pg.from); continue; }
        const th = threatsNear(pg.x, pg.y, 20);
        if (th) {
          takeOff(pg, th);
          // hela flocken flaxar iväg, en efter en
          for (const o of pigeons) if (o !== pg && o.st === 'g' && o.panic <= 0 && Math.hypot(o.x - pg.x, o.y - pg.y) < 34) { o.panic = rr(0.05, 0.35); o.from = th; }
          continue;
        }
        if (dark && rnd() < dt * 0.6) { takeOff(pg, null); continue; }
        pg.t -= dt;
        if (pg.act === 'walk') {
          const dx = pg.tx - pg.x, dy = pg.ty - pg.y, d = Math.hypot(dx, dy);
          if (d < 0.5) { pg.act = 'stand'; pg.t = rr(0.3, 1.2); }
          else {
            const s = Math.min(d, 9 * dt), nx = pg.x + dx / d * s, ny = pg.y + dy / d * s;
            if (walk(nx, ny)) { pg.x = nx; pg.y = ny; } else { pg.act = 'stand'; }
            if (Math.abs(dx) > 0.2) pg.dir = dx < 0 ? -1 : 1;
          }
        }
        if (pg.t <= 0) {
          const r = rnd();
          if (r < 0.45) { pg.act = 'peck'; pg.t = rr(0.8, 2.2); }
          else if (r < 0.8) {
            pg.act = 'walk'; pg.t = 3;
            const s = pg.spot || [pg.x, pg.y];
            pg.tx = clamp(pg.x + rr(-12, 12), s[0] - 18, s[0] + 18); pg.ty = clamp(pg.y + rr(-4, 4), s[1] - 7, s[1] + 7);
          } else { pg.act = 'stand'; pg.t = rr(0.4, 1.6); if (rnd() < 0.5) pg.dir = -pg.dir; }
        }
      } else if (pg.st === 'f') {
        const f = pg.fl;
        f.u += dt / f.T;
        const u = Math.min(1, f.u);
        pg.x = f.x0 + (f.x1 - f.x0) * u; pg.y = f.y0 + (f.y1 - f.y0) * u;
        pg.alt = Math.max(0, f.a0 + (f.a1 - f.a0) * u + f.h * Math.sin(Math.PI * u));
        if (u >= 1) {
          if (f.away) { pg.st = 'a'; pg.t = rr(8, 40); }
          else { pg.st = 'g'; pg.alt = 0; pg.act = 'stand'; pg.t = rr(0.4, 1.2); }
        }
      } else {
        // borta (på taken): kom tillbaka efter en stund om det är ljust
        pg.t -= dt;
        if (pg.t <= 0) {
          if (env.dark > 0.2) { pg.t = rr(10, 30); continue; }
          const s = pick(FLOCK), [x, y] = landSpot(s), side = pick([-1, 1]);
          pg.spot = s; pg.x = x + side * rr(160, 240); pg.y = y - rr(20, 60); pg.alt = rr(60, 90);
          flight(pg, x, y, 0);
        }
      }
    }
  }
  function pigeonItem(pg) {
    const set = S.pig[pg.v];
    if (pg.st === 'g') {
      let fr = 'stand';
      if (pg.act === 'peck') fr = Math.sin(pg.anim * 9) > 0.1 ? 'peck' : 'stand';
      else if (pg.act === 'walk') fr = Math.floor(pg.anim * 7) % 2 ? 'walk' : 'stand';
      const sp = set[fr], img = pg.dir < 0 ? sp.l : sp.r;
      const x = Math.round(pg.x), y = Math.round(pg.y);
      return { x, y: pg.y, draw: (ctx) => ctx.drawImage(img, x - 6, y - 10) };
    }
    const f = pg.fl, u = f ? f.u : 0;
    let fr;
    if (f && !f.away && u > 0.82) fr = 'up';
    else fr = ['up', 'mid', 'down', 'mid'][Math.floor(pg.anim * (u < 0.2 ? 18 : 12)) % 4];
    const sp = set[fr], img = pg.dir < 0 ? sp.l : sp.r;
    const x = Math.round(pg.x), y = Math.round(pg.y), a = Math.round(pg.alt);
    return { x, y: a > 10 ? 1e5 + pg.y : pg.y, draw: (ctx) => {
      if (a < 40) { ctx.fillStyle = 'rgba(20,12,30,.18)'; ctx.fillRect(x - 2, y - 1, 5, 1); }
      ctx.drawImage(img, x - 6, y - a - 6);
    } };
  }

  // ------------------------------------------------------------------
  //  Förbiflygande fåglar
  // ------------------------------------------------------------------
  let birds = [], birdT = rr(2, 6);
  function updBirds(dt) {
    birdT -= dt;
    if (birdT <= 0) {
      birdT = rr(7, 18);
      if (env.dark < 0.4) {
        const dir = pick([-1, 1]), x = dir > 0 ? cam.x - 16 : cam.x + VW + 16, y = cam.y + rr(12, 96);
        const kind = wpick([['sw', env.dark > 0.1 ? 3 : 2], ['gull', env.rain ? 0.4 : 1.2], ['crow', 1]]);
        const n = kind === 'sw' ? ri(2, 4) : 1;
        for (let i = 0; i < n; i++) {
          birds.push({
            k: kind, x: x - dir * i * rr(10, 18), y: y + rr(-8, 8), y0: 0, dir,
            vx: dir * (kind === 'sw' ? rr(105, 140) : kind === 'gull' ? rr(38, 50) : rr(52, 66)),
            ph: rnd() * 10, t: 0,
          });
        }
      }
    }
    for (const b of birds) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y0 = b.k === 'sw' ? Math.sin(b.t * 2.6 + b.ph) * 5 : Math.sin(b.t * 0.9 + b.ph) * 2;
    }
    birds = birds.filter((b) => (b.dir > 0 ? b.x < cam.x + VW + 40 : b.x > cam.x - 40) && Math.abs(b.x - camCX()) < 700);
  }
  function birdItem(b) {
    const fr = S.bird[b.k];
    let i;
    if (b.k === 'gull') i = Math.sin(b.t * 1.2 + b.ph) > 0.2 ? 1 : [0, 1, 2, 1][Math.floor(b.t * 5) % 4];
    else i = [0, 1, 2, 1][Math.floor(b.t * (b.k === 'sw' ? 14 : 7) + b.ph) % 4];
    const img = fr[i], x = Math.round(b.x), y = Math.round(b.y + b.y0);
    return { x, y: 2e5 + y, draw: (ctx) => ctx.drawImage(img, x - (img.width >> 1), y - (img.height >> 1)) };
  }

  // ------------------------------------------------------------------
  //  Fjärilar vid rabatterna i parken
  // ------------------------------------------------------------------
  // Rabatterna hittas bland rekvisitans hinder i parken (låga, breda rutor);
  // saknas de flyger fjärilarna vid kanterna av gångarna i stället.
  let BF_HOMES = (env.obstacles || [])
    .filter((o) => o && o[1] > CITY.PARK[0] && o[2] - o[0] >= 28 && o[3] - o[1] >= 7 && o[3] - o[1] <= 14)
    .map((o) => [(o[0] + o[2]) / 2, o[3] - 1, (o[2] - o[0]) / 2]);
  if (BF_HOMES.length < 3) {
    BF_HOMES = [];
    for (const r of PARK_LAYOUT.paths) BF_HOMES.push([r[0] - 9, 318, 10], [r[2] + 9, 324, 10]);
    for (let x = 90; x < CW - 60; x += 130) BF_HOMES.push([x, (x / 130) % 2 < 1 ? 328 : 354, 12]);
  }
  const butterflies = [];
  for (let i = 0; i < 18; i++) {
    const h = BF_HOMES[i % BF_HOMES.length];
    butterflies.push({ hx: h[0], hy: h[1], hw: h[2], x: h[0], y: h[1], alt: rr(4, 12), tx: h[0], ty: h[1], ta: 8, c: ri(0, BF_COLORS.length - 1), ph: rnd() * 10, t: 0 });
  }
  const bfActive = () => env.dark === 0 && !env.rain && env.hour >= 8 && env.hour < 19.5;
  function updButterflies(dt) {
    if (!bfActive()) return;
    for (const f of butterflies) {
      f.t += dt;
      const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
      let sp = 14;
      const th = threatsNear(f.x, f.y, 14);
      if (th) { sp = 30; f.tx = f.x + Math.sign(f.x - th.x || 1) * 20; f.ty = f.y + rr(-6, 6); f.ta = rr(12, 20); }
      if (d < 1.5) {
        if (rnd() < 0.05) { const h = pick(BF_HOMES.filter((q) => Math.abs(q[0] - f.hx) < 220)); if (h) { f.hx = h[0]; f.hy = h[1]; f.hw = h[2]; } }
        f.tx = f.hx + rr(-f.hw, f.hw); f.ty = f.hy + rr(-3, 3); f.ta = rr(4, 14);
      } else {
        const s = Math.min(d, sp * dt);
        f.x += dx / d * s + Math.sin(f.t * 7 + f.ph) * dt * 6; f.y += dy / d * s;
      }
      f.alt += (f.ta - f.alt) * Math.min(1, dt * 2) + Math.sin(f.t * 9 + f.ph) * dt * 8;
    }
  }
  function bfItem(f) {
    const set = S.bf[f.c], w = Math.sin(f.t * 24 + f.ph);
    const img = w > 0.3 ? set.open : w > -0.4 ? set.half : set.shut;
    const x = Math.round(f.x), y = Math.round(f.y), a = Math.round(Math.max(1, f.alt));
    return { x, y: f.y + 2, draw: (ctx) => ctx.drawImage(img, x - (img.width >> 1), y - a - 1) };
  }

  // ------------------------------------------------------------------
  //  Katten på trappan vid Pixelgatan 1
  // ------------------------------------------------------------------
  const home = BUILDINGS.find((b) => b.id === 'hem') || BUILDINGS[0];
  // trappstenen vid porten går ~5 px utanför dörren – katten ligger på dess högra ände
  const cat = { x: home.door.x1 + 3, y: BASE + 3, st: 'sleep', t: rr(4, 10), tail: 0, tailT: 0, dir: -1 };
  function updCat(dt) {
    cat.t -= dt; cat.tailT -= dt;
    const near = (env.people || []).some((q) => Math.abs(q.x - cat.x) < 18 && Math.abs(q.y - cat.y) < 12)
      || peds.some((p) => p.dog && Math.abs(p.dog.x - cat.x) < 26 && Math.abs(p.dog.y - cat.y) < 16);
    if (near) { cat.st = 'sit'; cat.t = rr(2, 4); }
    else if (cat.t <= 0) {
      if (cat.st === 'sit') cat.st = 'awake';
      else cat.st = cat.st === 'sleep' ? 'awake' : (env.dark > 0.3 ? 'awake' : 'sleep');
      cat.t = cat.st === 'sleep' ? rr(8, 20) : rr(4, 10);
    }
    if (cat.tailT <= 0) { cat.tail = cat.st === 'sleep' ? 0 : ri(0, 2); cat.tailT = rr(0.3, 1.4); }
  }
  function catItem() {
    const spr = cat.st === 'sit' ? S.cat.sit : cat.st === 'sleep' ? S.cat.sleep : S.catTail[cat.tail];
    const img = cat.dir < 0 ? spr.l : spr.r, x = Math.round(cat.x), y = Math.round(cat.y);
    return { x, y: cat.y, draw: (ctx) => {
      ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(x - (img.width >> 1) + 2, y - 1, img.width - 4, 2);
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1);
    } };
  }
  const catEyes = () => {
    if (cat.st === 'sleep') return [];
    const spr = cat.st === 'sit' ? S.cat.sit : S.catTail[0], x0 = Math.round(cat.x) - (spr.w >> 1), y0 = Math.round(cat.y) - spr.h + 1;
    // ögonen ('g') i kartan + 1 px kontur
    const rows = cat.st === 'sit' ? CAT_MAPS.sit : CAT_MAPS.awake, out = [];
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'g') out.push([cat.dir < 0 ? x0 + spr.w - 2 - i : x0 + 1 + i, y0 + 1 + j]); });
    return out;
  };

  // ------------------------------------------------------------------
  //  Eldflugor över gräset en mörk kväll (ritas i glow)
  // ------------------------------------------------------------------
  const flies = [];
  function updFlies(dt) {
    const on = env.dark > 0.3 && !env.rain;
    const top = Math.max(CITY.PARK[0] + 4, cam.y), bot = Math.min(CH - 6, cam.y + VH);
    if (!on || bot - top < 8) { flies.length = 0; return; }
    while (flies.length < 16) flies.push({ x: cam.x + rr(0, VW), y: rr(top, bot), vx: rr(-4, 4), vy: rr(-2, 2), ph: rnd() * 10 });
    for (const f of flies) {
      f.vx += rr(-6, 6) * dt; f.vy += rr(-4, 4) * dt;
      f.vx = clamp(f.vx, -6, 6); f.vy = clamp(f.vy, -3, 3);
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < cam.x - 10 || f.x > cam.x + VW + 10 || f.y < top || f.y > bot || paved(f.x, f.y)) {
        f.x = cam.x + rr(0, VW); f.y = rr(top, bot); if (paved(f.x, f.y)) f.y = rr(top, bot);
      }
    }
  }

  // ------------------------------------------------------------------
  //  Ritning av en fotgängare (med paraply, kasse, hund i koppel …)
  // ------------------------------------------------------------------
  function handPos(p, X, Y, dir, frame) {
    const K = !!p.look.kid, tw = K ? 4 : (p.look.build || 5);
    const bob = frame === 3 || frame === 4 ? -1 : 0, torso = K ? 25 : 18, arm = K ? 5 : 8;
    if (dir === 'down' || dir === 'up') {
      const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      return { x: X + tw, y: Y - 39 + torso + bob + arm - sw, side: 1 };
    }
    const a = frame === 1 ? -3 : frame === 2 ? 3 : 0;
    return { x: dir === 'right' ? X + a : X - 1 - a, y: Y - 39 + torso + bob + arm, side: dir === 'right' ? 1 : -1 };
  }
  function drawLeash(ctx, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const sag = Math.min(4, n / 5);
    ctx.fillStyle = '#6a2a2a';
    let lx = null, ly = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
      if (x === lx && y === ly) continue;
      ctx.fillRect(x, y, 1, 1); lx = x; ly = y;
    }
  }
  function drawPed(ctx, p) {
    const X = Math.round(p.x + p.ox), Y = Math.round(p.y + p.oy);
    const dir = p.moving ? headingDir(p.hx, p.hy) : (p.look4bus && Math.sin(env.t * 0.8 + p.seed) > 0.75 ? 'left' : p.face);
    const box = p.carry === 'kartong';
    let frame;
    if (p.moving) frame = box ? [7, 9, 8, 9][Math.floor(p.anim) % 4] : WALK_SEQ[Math.floor(p.anim) % 4];
    else frame = box ? 9 : Math.sin(env.t * 1.3 + p.seed) > 0.93 ? 4 : 0;
    const door = p.door || (p.leader && p.leader.door);
    // klipp bara den som faktiskt står i dörröppningen (inte sällskapet bredvid)
    const clip = door && Y < BASE + 5 && X > door.b.door.x0 - 8 && X < door.b.door.x1 + 8;
    const alpha = door ? doorAlpha(p.leader || p, Y) : 1;
    if (clip) {
      const b = door.b;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.door.x0, BASE - DOOR_H, b.door.x1 - b.door.x0, DOOR_H); // dörröppningen (husens DOOR_H)
      ctx.rect(X - 20, BASE, 40, 60);
      ctx.clip();
    }
    if (alpha < 1) ctx.globalAlpha = alpha;
    const rain = env.rain && p.umb;
    const kidH = p.look.kid ? 8 : 0;
    const h = handPos(p, X, Y, dir, frame);
    const side = dir === 'left' || dir === 'right';
    // bakom kroppen: paraplyets skaft, släpande resväska, kartong bakifrån
    if (rain) { ctx.fillStyle = '#2a2630'; ctx.fillRect(X + (side ? (dir === 'right' ? 2 : -2) : 1), Y - 35 + kidH, 1, 16); }
    if (p.carry === 'resvaska' && side) drawCase(ctx, p, X, Y, dir, h);
    if (box && dir === 'up') drawCarry(ctx, 'kartong', X - 7, Y - 27, 'r');
    drawPerson(ctx, X, Y, p.look, dir, frame);
    // framför: kasse i handen, kartong, resväska bredvid, paraplyets duk
    if (p.carry && !box && p.carry !== 'resvaska') {
      const spr = p.carry === 'pase' ? S.pase[p.carryCol] : S.carry[p.carry];
      if (spr) {
        const img = h.side < 0 ? spr.l : spr.r, ax = h.side < 0 ? spr.w - 1 - spr.ax : spr.ax;
        ctx.drawImage(img, h.x - ax, h.y - spr.ay);
      }
    }
    if (box && dir !== 'up') {
      const bx = dir === 'right' ? X + 1 : dir === 'left' ? X - 16 : X - 8;
      drawCarry(ctx, 'kartong', bx, Y - 26, 'r');
    }
    if (p.carry === 'resvaska' && !side) drawCase(ctx, p, X, Y, dir, h);
    if (rain) {
      const u = S.umb[p.umb];
      const ux = X + (side ? (dir === 'right' ? 2 : -2) : 1) - 9;
      ctx.drawImage(u, ux, Y - 42 + kidH);
    }
    if (alpha < 1) ctx.globalAlpha = 1;
    if (clip) ctx.restore();
  }
  function drawCarry(ctx, k, x, y, side) {
    const spr = S.carry[k];
    ctx.drawImage(side === 'l' ? spr.l : spr.r, x, y);
  }
  function drawCase(ctx, p, X, Y, dir, h) {
    const spr = S.case[p.caseCol];
    let cx;
    if (dir === 'right') cx = X - 13;
    else if (dir === 'left') cx = X + 13;
    else cx = X + 11;
    const img = spr.r, x0 = cx - (spr.w >> 1), y0 = Y - spr.h + 1;
    // teleskophandtaget upp till handen
    ctx.fillStyle = '#3a3a42';
    const tx = cx, ty = y0 + 1, hx = h.x, hy = h.y;
    const n = Math.max(Math.abs(hx - tx), Math.abs(hy - ty), 1);
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(tx + (hx - tx) * i / n), Math.round(ty + (hy - ty) * i / n), 1, 1);
    ctx.drawImage(img, x0, y0);
  }
  function drawDog(ctx, p) {
    const g = p.dog, fr = S.dog[g.br][g.fr], img = g.dir < 0 ? fr.l : fr.r;
    const x = Math.round(g.x), y = Math.round(g.y);
    const x0 = x - 11, y0 = y - 15;
    ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(x - 6, y - 1, 12, 2);
    ctx.drawImage(img, x0, y0);
    const inside = p.door && p.door.ph !== 'app' && p.door.ph !== 'out';
    if (!inside && !p.hidden) {
      const nx = g.dir < 0 ? x0 + 21 - fr.neck[0] : x0 + fr.neck[0], ny = y0 + fr.neck[1];
      const X = Math.round(p.x + p.ox), Y = Math.round(p.y + p.oy);
      const dir = p.moving ? headingDir(p.hx, p.hy) : p.face;
      const hx = dir === 'down' || dir === 'up' ? X - (p.look.build || 5) - 1 : dir === 'right' ? X + 1 : X - 2;
      drawLeash(ctx, hx, Y - 14, nx, ny);
    }
  }

  // ------------------------------------------------------------------
  //  Startbefolkning
  // ------------------------------------------------------------------
  // Varje ny figur får "redan ha gått" en slumpad stund, så att de sprids
  // ut längs sina vägar i stället för att starta i klungor.
  function preRun(p, secs) {
    others = peds;
    for (let k = 0, n = Math.round(secs * 10); k < n && !p.gone; k++) { movePed(p, 0.1); sampleTrail(p, 0.1); }
    const X = p.x + p.ox, Y = p.y + p.oy;
    if (p.comp) { p.comp.x = X; p.comp.y = Y; p.comp.hidden = p.hidden; p.comp.door = p.door; }
    if (p.dog) {
      const dx = X - p.hx * 8, dy = Y - p.hy * 8;
      p.dog.x = walk(dx, dy) ? dx : X; p.dog.y = walk(dx, dy) ? dy : Y;
      if (p.door && p.dog.tie) { p.dog.x = p.dog.tie.x; p.dog.y = p.dog.tie.y; }
    }
  }
  // Scenen skapar modulerna innan den fyllt i env (klockan, spelarens plats),
  // så startbefolkningen sätts ut vid första update() i stället.
  let started = false;
  function start() {
    started = true;
    updCam();
    lastCam = camCX();
    if (env.dark > 0.3) for (const pg of pigeons) { pg.st = 'a'; pg.t = rr(5, 40); } // på natten sover duvorna på taken
    for (let i = 0, n = targetCount(env.hour); i < 40 && peds.length < n; i++) preRun(spawnSomewhere(true), rr(0, 16));
    cleanup();
  }

  // ==================================================================
  return {
    obstacles: [],
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      if (!started) start();
      updCam();
      const nNpc = peds.filter((p) => !p.hidden).length;
      if (lastCam !== null && Math.abs(camCX() - lastCam) > 260) repopulate();
      lastCam = camCX();
      const ppl = env.people || [];
      others = [...peds, ...ppl.slice(0, Math.max(1, ppl.length - nNpc))];
      manage(dt);
      updBus();
      for (const p of peds) if (!p.leader) { movePed(p, dt); sampleTrail(p, dt); }
      for (const p of peds) if (p.leader) updComp(p, dt);
      for (const p of peds) if (p.dog) updDog(p, dt);
      updPigeons(dt);
      updBirds(dt);
      updButterflies(dt);
      updCat(dt);
      updFlies(dt);
    },
    positions() {
      const out = [];
      for (const p of peds) if (!p.hidden) out.push({ x: p.x + p.ox, y: p.y + p.oy });
      return out;
    },
    items() {
      const out = [];
      for (const p of peds) {
        if (!p.hidden) {
          const Y = p.y + p.oy, door = p.door || (p.leader && p.leader.door);
          out.push({ x: p.x + p.ox, y: door ? Math.max(Y, BASE + 0.5) : Y, draw: (ctx) => drawPed(ctx, p) });
        }
        if (p.dog) out.push({ x: p.dog.x, y: p.dog.y, draw: (ctx) => drawDog(ctx, p) });
      }
      for (const pg of pigeons) if (pg.st !== 'a') out.push(pigeonItem(pg));
      for (const b of birds) out.push(birdItem(b));
      if (bfActive()) for (const f of butterflies) out.push(bfItem(f));
      out.push(catItem());
      return out;
    },
    glow(ctx) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const b = Math.max(0, Math.sin(env.t * 1.7 + f.ph)), a = b * b;
        if (a < 0.04) continue;
        const x = Math.round(f.x), y = Math.round(f.y);
        // pixelhalo i tre steg: stor svag ruta, kors, ljus kärna
        ctx.fillStyle = `rgba(90,170,30,${(a * 0.12).toFixed(3)})`; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
        ctx.fillStyle = `rgba(150,230,60,${(a * 0.5).toFixed(3)})`; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        ctx.fillStyle = `rgba(245,255,170,${a.toFixed(3)})`; ctx.fillRect(x, y, 1, 1);
      }
      if (env.dark > 0.2) {
        ctx.fillStyle = 'rgba(170,255,110,0.85)';
        for (const [x, y] of catEyes()) ctx.fillRect(x, y, 1, 1);
      }
    },
    _debug: { nav, peds: () => peds, pigeons, cat, spawn, planFor, buildings: BUILDINGS, butterflies, bfHomes: () => BF_HOMES },
  };
}
