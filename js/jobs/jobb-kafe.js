// Kaféet – baristajobbet bakom disken! Gäster kommer fram till disken och
// beställer med en pratbubbla: ESPRESSO, CAPPUCCINO, LATTE eller VARM CHOKLAD,
// ibland med ett bakverk till (kanelbulle, kladdkaka, prinsesstårta).
// Drycken görs i steg, precis som på riktigt:
//   MALA kaffe i kvarnen → BRYGGA i espressomaskinen → skumma mjölk med ÅNGA
//   → hälla LATTEKONST på bakbänken. Varm choklad = KAKAO i en mugg → ÅNGA.
// Receptet står på griffeltavlan (med samma små tecken som på stationerna).
// Bakverken hämtas ur glasmontern. Klicka på gästen för att servera – fel
// dryck eller fel bakverk ger avdrag, gäster som väntar för länge går.
//
// Vyn är från baristans sida: gästerna står på andra sidan disken (vi ser dem
// ovanför skivan), espressomaskinen vänder fronten mot oss och bakbänken står
// längst fram, så att man ser baristan i ansiktet när hen jobbar där.
// Allt statiskt målas EN gång i lager (bakvägg, disk, glas, bakbänk, möbler) –
// bara det som rör sig ritas varje bildruta. Ett pixelkorn: heltal, skala 1.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, folkDrawables, emoteBubble, WALK_SEQ } from '../scenes/walkable.js';
import { worldMyEmote } from '../net/world.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const WHITE = 0xffffff;

// ---------- rummets mått ----------
// disken sedd från vår sida: skivan y 84–91, framsidan (vår sida) 92–113
const CT = { top: 84, face: 92, base: 114 };
const CUST_Y = 92;               // gästernas fötter (bakom disken – vi ser dem från midjan och upp)
const TIP_Y = 55;                // pratbubblornas spets (strax ovanför huvudena)
const WORK_Y = 120;              // där baristan står vid disken
const BENCH = { top: 182, face: 198 };  // bakbänken längst fram
const BENCH_Y = 194;             // där baristan står vid bakbänken
const SPOTS = [122, 160, 198];   // gästernas platser vid disken
const LAMPS = [103, 141, 179];   // pendellampor mellan bubblorna
const TALK_X0 = 89, TALK_X1 = 212; // fönsterremsan mellan griffeltavlorna (dit beställningsropen kläms)
const STN_Y = 60;                // puffarna vid disken/maskinen: under tavlorna (de stiger ~13 px)
// glasmontern och dess tre fack (ett per bakverk)
const MON = { x0: 6, x1: 86, top: 52 };
const MON_COLS = [21, 46, 70];
// espressomaskinen: två bryggrupper, ångrör till höger; kvarnen bredvid
const MAC = { x0: 214, x1: 318 };
const GROUPS = [{ x: 244, sx: 257 }, { x: 288, sx: 275 }];
const WAND = { x: 301, sx: 291 };
const GRIND = { x: 334, sx: 347 };
const MANO = [{ x: 258, y: 59 }, { x: 274, y: 59 }];
// bakbänkens stationer
const DISK_X = 27, KAKAO_X = 172, KONST_X = 291;
const RADIO = { x: 91, y: 168 };
// möbler på golvet (hinder för gången)
const CRATES = { x: 4, y: 164 }, BUCKET = { x: 356, y: 178 }, RACK = { x: 104, y: 163 };

const DRINKS = [
  { id: 'esp', name: 'ESPRESSO', price: 25, steps: ['mala', 'brygg'] },
  { id: 'cap', name: 'CAPPUCCINO', price: 32, steps: ['mala', 'brygg', 'anga'] },
  { id: 'lat', name: 'LATTE', price: 35, steps: ['mala', 'brygg', 'anga', 'konst'] },
  { id: 'cho', name: 'VARM CHOKLAD', price: 30, steps: ['kakao', 'anga'] },
];
const PASTRIES = [
  { id: 'bulle', name: 'KANELBULLE', short: 'BULLE', price: 25 },
  { id: 'kladd', name: 'KLADDKAKA', short: 'KLADDKAKA', price: 32 },
  { id: 'prinsess', name: 'PRINSESSTÅRTA', short: 'PRINSESS', price: 42 },
];

// Vad är koppen i handen just nu? −1 = inte färdig.
function drinkOf(c) {
  if (!c) return -1;
  if (c.kaffe) return c.konst ? 2 : c.skum ? 1 : 0;
  if (c.choklad && c.skum) return 3;
  return -1;
}
const cupKey = (c) => (c.mug ? (c.skum ? 'cho' : 'kak') : c.konst ? 'lat' : c.skum ? 'cap' : 'esp');

// ======================= små målarverktyg =======================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// färg med lätt brus (hash + bayer) → levande ytor utan platta fält
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
// kvantiserad gradient med bayer-dither (3–4 toner i stället för mjuk övergång)
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
function rows(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) P.hl(x, y + i, w, c); }); }
// blankt stål: 12 kolumner från skugga via högdager till skugga
const CHROME = [0x4a525c, 0x6a747e, 0x98a2ae, 0xc4ccd4, 0xeef3f6, 0xffffff, 0xdce4ea, 0xb4bec8, 0x98a2ae, 0x8e98a4, 0x7a848e, 0x5a646e];
const chromeAt = (i, w) => CHROME[clamp(Math.floor((i / w) * CHROME.length), 0, CHROME.length - 1)];
// mässing: ljus uppe till vänster
const BRASS = [0xfff0a8, 0xf0d27a, 0xd4b050, 0xb08a34, 0x7a5c1e];
// lövklump: ljus uppe till vänster, taggig kant
function leaves(P, cx, cy, rx, ry, seed, dark, midc, light, dens = 0.55) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) continue;
    const h = hash(x, y, seed);
    if (d > 0.72 && h > dens) continue;
    const l = ((cx - x) / rx + (cy - y) / ry) * 0.45 + (h - 0.5) * 0.9;
    P.px(x, y, l > 0.35 ? light : l > -0.25 ? midc : dark);
  }
}
function brickPx(X, Y, base, seed, opt = {}) {
  const bw = opt.bw || 8, bh = opt.bh || 4;
  const row = Math.floor(Y / bh), ry = Y - row * bh;
  const xx = X + (row & 1 ? bw >> 1 : 0) + 64, col = Math.floor(xx / bw), rx = xx - col * bw;
  const mortar = opt.mortar ?? mix(base, 0xcfc4b0, 0.5);
  if (ry === bh - 1 || rx === bw - 1) return jit(mortar, X, Y, seed + 1, 0.1);
  const h = hash(col, row, seed);
  let c = h > 0.66 ? mix(base, 0xc8764e, 0.24) : h < 0.25 ? mix(base, 0x4a2418, 0.28) : base;
  if (hash(col, row, seed + 7) > 0.93) c = mix(c, 0x2a2a2a, 0.3);
  if (ry === 0) c = mix(c, WHITE, 0.12);
  if (rx === bw - 2) c = mul(c, 0.84);
  return jit(c, X, Y, seed, 0.08);
}
// rund skiva (klocka, manometer): fn(x, y, d, dx, dy) per pixel inom radien
function disc(P, cx, cy, r, fn) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d <= r) { const c = fn(x, y, d, dx, dy); if (c !== null && c !== undefined) P.px(x, y, c); }
  }
}
// liten pixelkarta ('#' = tänd) i en färg
function glyph(P, map, x, y, c, a = 1) {
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(x + i, y + j, c, a); });
}
function glyphCtx(ctx, map, x, y, color) {
  ctx.fillStyle = color;
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, y + j, 1, 1); });
}
// mässingsskylt med text (och ev. stegikon) – stationernas namnbrickor
function brassPlate(P, cx, y, label, icon) {
  const tw = textW(SMALL, label) + (icon ? 7 : 0), w = tw + 6, x = cx - (w >> 1);
  P.rect(x, y, w, 9, 0x3a2810);
  area(P, x + 1, y + 1, w - 2, 7, (X, Y, i, j) => jit(j === 0 ? 0xfff0a8 : j === 6 ? 0x9a7428 : qmix(0xf0d27a, 0xc49a3c, j / 6, X, Y, 3), X, Y, 91, 0.05));
  P.px(x + 1, y + 1, 0x7a5c1e); P.px(x + w - 2, y + 1, 0x7a5c1e);
  let tx = x + 3;
  if (icon) { glyph(P, ICONS[icon], tx, y + 2, 0x3a2810); tx += 7; }
  text(P, SMALL, label, tx, y + 2, 0x3a2810);
}

// ======================= små ikoner (krita, skyltar) =======================
const ICONS = {
  mala: ['.##..', '#.##.', '##.##', '.##.#', '..##.'],   // kaffeböna
  brygg: ['..#..', '.###.', '#####', '#####', '.###.'],  // droppe
  anga: ['#..#.', '.#..#', '#..#.', '.#..#', '#..#.'],   // ånga
  konst: ['.#.#.', '#####', '#####', '.###.', '..#..'],  // hjärta
  kakao: ['####.', '#####', '####.', '####.', '.##..'],  // mugg
  disk: ['..#..', '..#..', '.#.#.', '#...#', '.###.'],   // droppe i ho
};
const ICON_CHALK = { mala: 0xe8b888, brygg: 0xd8a070, anga: 0xd8ecf4, konst: 0xf6a0c0, kakao: 0xd09a70 };
const NOTE = ['.##', '.#.', '.#.', '##.', '##.'];     // noten från radion

// ======================= sprites: koppar, muggar, bakverk =======================
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
// pixelkarta → canvas med 1 px "sel-out"-kontur (mörkare ton av grannpixeln);
// tomma rader överst tas bort så att alla sprites står på sin nedersta rad
function mapSprite(map, pal) {
  const rs = map.slice();
  while (rs.length && ![...rs[0]].some((ch) => pal[ch] !== undefined)) rs.shift();
  const w = Math.max(...rs.map((r) => r.length)) + 2, h = rs.length + 2;
  const g = new Array(w * h).fill(-1);
  rs.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]] !== undefined) g[(y + 1) * w + x + 1] = pal[row[x]]; });
  const src = g.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y * w + x] !== -1) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || src[yy * w + xx] === -1 || typeof src[yy * w + xx] === 'string') continue;
      g[y * w + x] = mix(mul(src[yy * w + xx], 0.42), 0x1c1418, 0.4);
      break;
    }
  }
  return pixelsToCanvas(g, w, h);
}

// Vit porslinskopp på fat, sedd snett uppifrån. Rad 0 = plats för skumtopp,
// rad 2–5 = ytan i koppen (1 ljus mitt, 2 mellan, 3 mörk kant), rad 10–11 = fatet.
const CUP_ROWS = [
  '.............',
  '..WWWWWWWW...',
  '.W33333333W..',
  'W3222222223W.',
  'W2211111122W.',
  '.W22222222W..',
  '.wRRRRRRRRwgg',
  '.WRWWWWWWvw.g',
  '..WWWWWWvwgg.',
  '...wwwwwww...',
  'PPPPPPPPPPPPp',
  '.ppppppppppp.',
];
const CUP_PAL = { W: 0xf4f1ea, w: 0xc6bdac, v: 0xdcd4c6, R: 0xffffff, g: 0xb6ad9c, P: 0xeae4da, p: 0xaea493 };
// Röd emaljmugg med vit kant och vita prickar (till chokladen)
const MUG_ROWS = [
  '..............',
  '..EEEEEEEE....',
  '.E33333333E...',
  'E3222222223E..',
  'E2211111122E..',
  '.E22222222E...',
  '.MEEEEEEEEmkk.',
  '.LMMMMMMMMmm.k',
  '.LMdMMMMMdmm.k',
  '.LMMMMdMMMmmkk',
  '.MMMMMMMMMmm..',
  '..mmmmmmmmm...',
];
const MUG_PAL = { E: 0xf4f1ea, M: 0xcf3a3a, L: 0xf07a6e, m: 0x8e1c22, d: 0xfff4ea, k: 0xa8262c };
const CUPS = {
  // tom kopp (under bryggruppen innan kaffet kommer)
  tom: { mug: false, pal: { 1: 0xe8e2d6, 2: 0xd8d0c2, 3: 0xb4ab9a } },
  // espresso: mörk kant, gyllene crema med ljusare virvel
  esp: { mug: false, pal: { 1: 0xd99c5c, 2: 0xae682c, 3: 0x5a2a12, 4: 0xf2c486 }, rows: { 3: 'W3221442223W.', 4: 'W2214111122W.' } },
  // cappuccino: hög skumtopp med kakaopuder
  cap: {
    mug: false, pal: { F: 0xfffcf4, f: 0xe6d8c2, c: 0x9a5a34 },
    rows: { 0: '....fFFf.....', 1: '..WfFFFFfW...', 2: '.WfFFcFFFfW..', 3: 'WfFFFFFcFFfW.', 4: 'WfFcFFFFFFfW.', 5: '.WffFFFFffW..' },
  },
  // latte: ljusbrun yta med ett vitt hjärta (lattekonst)
  lat: {
    mug: false, pal: { 1: 0xd49a60, 2: 0xb87a40, 3: 0x7e4e28, h: 0xfffaf0 },
    rows: { 2: '.W333h3h33W..', 3: 'W322hhhhh23W.', 4: 'W2211hhh122W.', 5: '.W2222h222W..' },
  },
  // kakaopulver i muggen (inte klar än)
  kak: { mug: true, pal: { 1: 0xa87452, 2: 0x8a5634, 3: 0x583220, 4: 0xc89070 }, rows: { 3: 'E3224222423E..', 4: 'E2211141122E..' } },
  // varm choklad: vispgrädde med chokladsås och en rosa marshmallow
  cho: {
    mug: true, pal: { F: 0xfffcf4, f: 0xe6d8c2, D: 0x5a2e1a, q: 0xf8b4c8 },
    rows: { 0: '....fFFf......', 1: '..EfFFFFfE....', 2: '.EfFqFFDFfE...', 3: 'EfFFFDDFFFfE..', 4: 'EfDFFFFqDFfE..', 5: '.EffFFFFffE...' },
  },
};
const PASTRY_SPR = [
  // kanelbulle: gyllene snurr med kanelstrimma och pärlsocker
  {
    pal: { h: 0xf6c476, B: 0xda8e3e, b: 0xa8602a, c: 0x7a3814, w: 0xfffaf0, d: 0x5e2c10 },
    map: [
      '...hhhBb...',
      '.hhBBcBBBb.',
      'hBcccBBwcBb',
      'hBcBwBcBBcb',
      'BcBcBBcBwcb',
      'bBcBcccBcbd',
      '.bBwBBBcbd.',
      '..dbbbbbd..',
    ],
  },
  // kladdkaka: bit med florsocker, vispgrädde och ett hallon
  {
    pal: { W: 0xfffaf0, S: 0xe0d4c4, r: 0xd8304a, R: 0xff6a7a, t: 0x5a2e1c, T: 0xefe6e0, k: 0x7c4226, K: 0x2e140a, m: 0x42200f, M: 0x6a3418 },
    map: [
      '.......rR..',
      '......WWrr.',
      '..tTtTSWWSt',
      '.tTtTtTtTtk',
      'kkkkkkkkkkK',
      'KmMmmmMmmmK',
      'KmmmMmmmMmK',
      'KKKKKKKKKKK',
    ],
  },
  // prinsessbakelse: grön marsipankupa med rosa ros och florsocker
  {
    pal: { G: 0xa6d886, H: 0xd8f2c0, g: 0x6ea85a, e: 0x4a8440, r: 0xc8407a, R: 0xf890c0, l: 0x2e6e30, s: 0xffffff, d: 0xf4ecde, D: 0xcfc2ac },
    map: [
      '....rRr....',
      '...lrRRl...',
      '..GHGrGGG..',
      '.HGsGGGsGg.',
      'GHGGGsGGGGg',
      'GGsGGGGGsgg',
      'gGGGGGGGGge',
      '.eggggggge.',
      'DddddddddD.',
    ],
  },
];
// litet assiettfat till bakverken (sista raden = skugga)
const PLATE_S = ['.ooooooooooo.', 'orwwwwwwwwwro', '.ouuuuuuuuuo.', '..sssssssss..'];
const PLATE_PAL = { o: 0x6e7684, r: 0xd6dce4, w: 0xfdfcf8, u: 0xaeb6c2, s: 'rgba(30,18,34,0.32)' };

const SPR = { cup: {}, pastry: [], plated: [] };
function cupSprite(key) {
  if (SPR.cup[key]) return SPR.cup[key];
  const def = CUPS[key];
  const base = def.mug ? MUG_ROWS : CUP_ROWS;
  const rs = base.map((r, i) => (def.rows && def.rows[i]) || r);
  return (SPR.cup[key] = mapSprite(rs, { ...(def.mug ? MUG_PAL : CUP_PAL), ...def.pal }));
}
const drinkSprite = (d) => cupSprite(DRINKS[d].id);
function pastrySprite(k) { return (SPR.pastry[k] ||= mapSprite(PASTRY_SPR[k].map, PASTRY_SPR[k].pal)); }
// bakverket på sitt fat; bakverkets nedersta rad vilar på fatets rad 1
function platedPastry(k) {
  if (SPR.plated[k]) return SPR.plated[k];
  const f = pastrySprite(k), pw = PLATE_S[0].length, W = Math.max(pw, f.width), py = f.height - 3;
  const c = newCanvas(W, py + PLATE_S.length), x2 = c.getContext('2d');
  PLATE_S.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const v = PLATE_PAL[row[x]]; if (v === undefined) continue; x2.fillStyle = typeof v === 'string' ? v : css(v); x2.fillRect(((W - pw) >> 1) + x, py + y, 1, 1); } });
  x2.drawImage(f, (W - f.width) >> 1, 0);
  return (SPR.plated[k] = c);
}
// rita en sprite med nederkanten (utan skuggrad) i y och mitten i cx
const drawAt = (ctx, s, cx, by) => ctx.drawImage(s, Math.round(cx - (s.width >> 1)), Math.round(by - s.height + 1));

// Pratbubbla med rundade hörn och spets nedåt i (cx, tip). Innerytan är iw×ih;
// returnerar innerytans övre vänstra hörn.
function bubble(ctx, cx, tip, iw, ih, hot = false) {
  const w = iw + 2, h = ih + 2, x0 = cx - (w >> 1), y0 = tip - 2 - h;
  const edge = hot ? '#e8b230' : '#17151a';
  ctx.fillStyle = edge;
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
// grön bock över det som redan är serverat
function checkMark(ctx, x, y) {
  const m = ['......##', '.....##.', '##..##..', '.####...', '..##....'];
  ctx.fillStyle = '#1c3a1c';
  m.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') { ctx.fillRect(x + i - 1, y + j, 1, 1); ctx.fillRect(x + i + 1, y + j, 1, 1); ctx.fillRect(x + i, y + j + 1, 1, 1); } });
  ctx.fillStyle = '#45b964';
  m.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(x + i, y + j, 1, 1); });
}

// ======================= jobbet =======================
export function makeJobbKafe(A, { onDone } = {}) {
  const stats = { ok: 0, fel: 0, miss: 0, drycker: 0, bakverk: 0, gaster: 0 };
  // passets plan: längd (P.seconds) och gästtakt (P.pace). Disken har inga fler platser –
  // kassan och espressomaskinen står på var sida om de tre, och bubblorna fyller fönsterremsan.
  const P = planOf(A);
  const walker = createWalker({ top: 116, bottom: 197, left: 8, right: 376, spawn: [200, 152] });
  walker.speed = 92;   // baristan är snabb i benen – stationerna ligger spridda över hela lokalen
  walker.setObstacles([
    [CRATES.x - 2, CRATES.y - 12, CRATES.x + 24, CRATES.y + 1],
    [BUCKET.x - 2, BUCKET.y - 10, BUCKET.x + 24, BUCKET.y + 1],
    [RACK.x - 2, RACK.y - 8, RACK.x + 26, RACK.y + 1],
  ]);
  const pops = makePops();
  // baristan får förkläde över sina egna kläder (samma objekt varje bildruta → cachen håller)
  const myLook = { ...(A.avatar?.look || {}), apron: true };
  let customers = [], t = 0, seq = 0, custIn = 1.2;
  let cup = null, pastry = null, dose = false, busy = null, queued = null;
  let done = false, doneT = 0, reported = false;
  const stock = [4, 4, 4], restock = [0, 0, 0];
  const puffs = [], notes = [], talk = [];
  let noteIn = 0.6, wispIn = 2;
  const L = {};
  const layers = () => (L.back ? L : Object.assign(L, {
    back: paintBack(), counter: paintCounter(), glass: paintGlass(), bench: paintBench(), crates: paintCrates(), bucket: paintBucket(), rack: paintRack(),
  }));

  // ---------- hjälpare ----------
  const waiting = () => customers.filter((k) => k.state === 'wait');
  function freeSpot() {
    const free = SPOTS.map((_, i) => i).filter((i) => !customers.some((k) => k.spot === i && (k.state === 'walk' || k.state === 'wait' || k.state === 'happy')));
    return free.length ? free[(Math.random() * free.length) | 0] : -1;
  }
  function pickDrink() { const r = Math.random(); return r < 0.24 ? 0 : r < 0.5 ? 1 : r < 0.8 ? 2 : 3; }
  function newCustomer(s, prog, standing = false) {
    // en dryck tar 6–11 s med gång, och tre gäster kan stå i kö – tålamodet
    // räcker till att vänta på två före sig även i slutet av passet
    const pmax = 40 - 8 * prog;
    return {
      id: seq++, look: makeLook(), spot: s, x: standing ? SPOTS[s] : -14, y: standing ? CUST_Y : CUST_Y - 2,
      state: standing ? 'wait' : 'walk', dir: standing ? 'down' : 'right',
      drink: pickDrink(), pastry: Math.random() < 0.42 ? (Math.random() * 3) | 0 : -1,
      gotDrink: false, gotPastry: false, patience: pmax, pmax, t: 0,
    };
  }
  // poängpuff/kommentar; hålls inom skärmen så att den inte klipps vid kanten
  const say = (x, y, s, c = '#d8d2c0') => { const hw = (textW(SMALL, s) + 4) >> 1; pops.add(clamp(Math.round(x), hw + 2, FW - hw - 2), y, s, c); };
  // puff vid en gäst: kläms in i fönsterremsan (som ropen) så att den inte
  // stiger upp över griffeltavlorna
  function sayK(k, y, s, c) { const hw = (textW(SMALL, s) + 4) >> 1; say(clamp(Math.round(k.x), TALK_X0 + hw, TALK_X1 - hw), y, s, c); }
  // gästen säger sin beställning högt; repliker köar så att de aldrig krockar
  function sayOrder(k) {
    const wait = talk.reduce((m, s) => Math.max(m, 2.1 - s.age), 0);
    talk.push({ x: k.x, y: 22, age: -wait, txt: DRINKS[k.drink].name + (k.pastry >= 0 ? ' + ' + PASTRIES[k.pastry].short : '') + '!' });
  }
  function startBusy(kind, dur, fin, extra = {}) { busy = { kind, t: 0, dur, fin, ...extra }; }
  function go(sx, sy, face, fn) { walker.walkTo(sx, sy, () => { walker.dir = face; fn(); }); }

  // ---------- stationerna ----------
  function actMala() {
    if (dose) { say(GRIND.x, STN_Y, 'REDAN MALET'); play('click'); return; }
    play('slide');
    startBusy('mala', 0.8, () => { dose = true; play('ok'); });
  }
  function actBrygg(g) {
    if (!dose) { say(GROUPS[g].x, STN_Y, 'MALA FÖRST!', '#ffd23f'); play('miss'); return; }
    if (cup) { say(GROUPS[g].x, STN_Y, 'KOPPEN ÄR FULL'); play('miss'); return; }
    play('knock');
    startBusy('brygg', 1.2, () => { cup = { mug: false, kaffe: true }; dose = false; play('ok'); }, { g });
  }
  function actAnga() {
    if (!cup) { say(WAND.x, STN_Y, 'INGEN KOPP'); play('miss'); return; }
    if (cup.skum) { say(WAND.x, STN_Y, 'REDAN SKUMMAD'); play('miss'); return; }
    play('slide');
    startBusy('anga', 1.0, () => { cup.skum = true; play('ok'); });
  }
  function actKonst() {
    if (!cup) { say(KONST_X, 150, 'INGEN KOPP'); play('miss'); return; }
    if (cup.mug) { say(KONST_X, 150, 'BARA PÅ KAFFE'); play('miss'); return; }
    if (!cup.skum) { say(KONST_X, 150, 'SKUMMA FÖRST!', '#ffd23f'); play('miss'); return; }
    if (cup.konst) { say(KONST_X, 150, 'REDAN KONST'); play('miss'); return; }
    startBusy('konst', 0.9, () => { cup.konst = true; play('ok'); });
  }
  function actKakao() {
    if (cup) { say(KAKAO_X, 150, 'HÄNDERNA FULLA'); play('miss'); return; }
    play('click');
    startBusy('kakao', 0.6, () => { cup = { mug: true, choklad: true }; play('click'); });
  }
  function actDisk() {
    if (!cup) { say(DISK_X, 150, 'INGET ATT DISKA'); play('miss'); return; }
    startBusy('disk', 0.5, () => { cup = null; play('slide'); say(DISK_X, 150, 'SLASK!'); });
  }
  function actMonter(k) {
    if (pastry === k) { pastry = null; stock[k] = Math.min(4, stock[k] + 1); play('click'); return; }
    if (stock[k] <= 0) { say(MON_COLS[k], STN_Y, 'SLUT - VÄNTA'); play('miss'); return; }
    startBusy('monter', 0.3, () => {
      if (pastry !== null) stock[pastry] = Math.min(4, stock[pastry] + 1);
      pastry = k; stock[k]--; play('click');
    }, { col: k });
  }

  function serveTo(k) {
    if (k.state !== 'wait') return;
    let gave = false;
    const py = 36;
    if (cup && !k.gotDrink) {
      const d = drinkOf(cup);
      if (d < 0) { sayK(k, py, 'INTE KLAR!', '#ffd23f'); play('miss'); }   // koppen stannar i handen
      else {
        if (d === k.drink) { k.gotDrink = true; stats.ok++; stats.drycker++; gave = true; sayK(k, py, 'MUMS!', '#8ee03c'); }
        else { stats.fel++; sayK(k, py, 'FEL DRYCK!', '#ff6a6a'); play('fel'); }
        cup = null;
      }
    }
    if (pastry !== null && k.pastry >= 0 && !k.gotPastry) {
      if (pastry === k.pastry) { k.gotPastry = true; stats.ok++; stats.bakverk++; gave = true; sayK(k, py - 9, 'GOTT!', '#8ee03c'); }
      else { stats.fel++; sayK(k, py - 9, 'FEL BAKVERK!', '#ff6a6a'); play('fel'); }
      pastry = null;
    }
    if (gave) {
      k.patience = Math.min(k.pmax, k.patience + 5);
      if (k.gotDrink && (k.pastry < 0 || k.gotPastry)) {
        k.state = 'happy'; k.t = 1.1; stats.gaster++;
        sayK(k, py + 9, 'TACK!', '#8ee03c');
        play(k.pastry >= 0 ? 'box' : 'coin');
      } else play('coin');
    }
  }

  function handleDown(x, y) {
    if (done) return;
    if (busy) { queued = [x, y]; return; }
    // en väntande gäst (bubblan, huvudet eller disken framför hen)
    const k = customers.find((c) => c.state === 'wait' && Math.abs(c.x - x) < 17 && y >= 38 && y < CT.face);
    if (k) { go(k.x, WORK_Y, 'up', () => serveTo(k)); return; }
    // disken: monter, maskin, kvarn
    if (y >= 44 && y < CT.base + 6) {
      if (x >= MON.x0 && x < MON.x1) {
        const c = x < 34 ? 0 : x < 58 ? 1 : 2;
        go(MON_COLS[c], WORK_Y, 'up', () => actMonter(c));
        return;
      }
      if (x >= MAC.x0 && x < 297) { const g = x < 266 ? 0 : 1; go(GROUPS[g].sx, WORK_Y, 'up', () => actBrygg(g)); return; }
      if (x >= 297 && x < 320) { go(WAND.sx, WORK_Y, 'up', actAnga); return; }
      if (x >= 320 && x < 350) { go(GRIND.sx, WORK_Y, 'up', actMala); return; }
    }
    // bakbänken
    if (y >= 164) {
      if (Math.abs(x - DISK_X) < 22) { go(DISK_X, BENCH_Y, 'down', actDisk); return; }
      if (Math.abs(x - KAKAO_X) < 16) { go(KAKAO_X, BENCH_Y, 'down', actKakao); return; }
      if (Math.abs(x - KONST_X) < 16) { go(KONST_X, BENCH_Y, 'down', actKonst); return; }
    }
    walker.walkTo(x, y);
  }

  // ---------- ritning av det som rör sig ----------
  function drawMe(ctx) {
    const walking = walker.path.length > 0 && !busy;
    const hold = !!cup || pastry !== null;
    let frame;
    if (busy) frame = 9;
    else if (hold) frame = walking ? [7, 9, 8, 9][Math.floor(t * 8.5) % 4] : 9;
    else frame = walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
    drawPerson(ctx, walker.px, walker.py, myLook, walker.dir, frame);
    const mine = worldMyEmote();
    if (mine) emoteBubble(ctx, walker.px, walker.py - 60, mine);
  }
  // det jag bär: koppen i höger hand, bakverket på fat i vänster
  function drawHeld(ctx) {
    const dir = walker.dir, px = Math.round(walker.px), hy = Math.round(walker.py) - 12;
    const cupHere = cup && !(busy && (busy.kind === 'brygg' || busy.kind === 'anga' || busy.kind === 'konst' || busy.kind === 'disk'));
    const cs = cupHere ? cupSprite(cupKey(cup)) : null, ps = pastry !== null ? platedPastry(pastry) : null;
    const cxo = dir === 'left' ? -8 : dir === 'right' ? 8 : dir === 'up' ? -4 : 5;
    const pxo = dir === 'left' ? -2 : dir === 'right' ? 2 : dir === 'up' ? 5 : -6;
    if (ps) drawAt(ctx, ps, px + pxo, hy + 1);
    if (cs) drawAt(ctx, cs, px + cxo, hy);
  }
  // namnlappen över huvudet: vad koppen i handen är just nu
  function drawCupTag(ctx) {
    if (!cup || busy) return;
    // (pixelfonten har inga '…' – tre punkter i stället)
    const d = drinkOf(cup), s = d >= 0 ? DRINKS[d].name : cup.mug ? 'KAKAO...' : '...';
    // vid disken hamnar lappen under fötterna, så att den inte skymmer gästerna
    const w = textW(SMALL, s) + 6, x = Math.round(walker.px - w / 2);
    const y = walker.py < 140 ? Math.round(walker.py) + 3 : Math.round(walker.py) - 50;
    ctx.fillStyle = 'rgba(23,21,26,0.82)'; ctx.fillRect(x, y, w, 9);
    ctxText(ctx, SMALL, s, x + 3, y + 2, d >= 0 ? '#ffe9a8' : '#b8b0a0');
  }
  function drawCustomer(ctx, k) {
    const moving = k.state === 'walk' || k.state === 'leave' || k.state === 'exit';
    const carrying = k.state === 'exit';
    const ph = Math.floor(t * 8.5 + k.id * 0.37) % 4;
    const frame = carrying ? [7, 9, 8, 9][ph] : moving ? WALK_SEQ[ph] : (Math.sin(t * 1.7 + k.id) > 0.92 ? 4 : 0);
    drawPerson(ctx, k.x, k.y, k.look, moving ? k.dir : 'down', frame);
    // nöjda gäster bär med sig koppen och fatet till sitt bord i kaféet
    if (carrying) {
      const x = Math.round(k.x), hy = Math.round(k.y) - 11;
      if (k.gotPastry) drawAt(ctx, platedPastry(k.pastry), x + 3, hy + 1);
      drawAt(ctx, drinkSprite(k.drink), x + 8, hy);
      steamWisp(ctx, x + 7, hy - 12, k.id);
    }
  }
  // tre pixlar ånga som slingrar sig upp ur en varm kopp
  function steamWisp(ctx, x, y, seed) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.8 + i * 0.33 + seed * 0.17) % 1;
      ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - ph)).toFixed(2)})`;
      ctx.fillRect(x + Math.round(Math.sin(t * 3 + i * 2 + seed) * 1.2), y - Math.round(ph * 7), 1, 1);
    }
  }
  // det som står framför gästen på disken (serverat, i väntan på resten)
  function drawServed(ctx) {
    for (const k of customers) {
      if (k.state !== 'wait' && k.state !== 'happy') continue;
      if (k.gotDrink) { drawAt(ctx, drinkSprite(k.drink), k.x - 7, 89); steamWisp(ctx, k.x - 8, 75, k.id); }
      if (k.gotPastry) drawAt(ctx, platedPastry(k.pastry), k.x + 8, 90);
    }
  }
  // gästen säger sin beställning högt när hen kommer fram till disken.
  // Ropet ligger ovanför bubblorna, i remsan med fönstren (x 89–212) mellan
  // griffeltavlorna, så att det aldrig täcker menyn eller FIKA-listan.
  function drawTalk(ctx) {
    for (const s of talk) {
      if (s.age < 0) continue;
      const a = s.age < 1.6 ? 1 : Math.max(0, 1 - (s.age - 1.6) / 0.5);
      const w = textW(SMALL, s.txt) + 6, y = Math.round(s.y);
      const x = w >= TALK_X1 - TALK_X0 ? ((TALK_X0 + TALK_X1 - w) >> 1) : clamp(Math.round(s.x - w / 2), TALK_X0, TALK_X1 - w);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#17151a'; ctx.fillRect(x + 1, y, w - 2, 9); ctx.fillRect(x, y + 1, w, 7);
      ctx.fillStyle = '#fff6e0'; ctx.fillRect(x + 1, y + 1, w - 2, 7);
      ctx.fillStyle = '#17151a'; ctx.fillRect(Math.round(s.x) - 1, y + 9, 3, 1); ctx.fillRect(Math.round(s.x), y + 10, 1, 1);
      ctxText(ctx, SMALL, s.txt, x + 3, y + 2, '#3a2810');
      ctx.globalAlpha = 1;
    }
  }
  function drawBubbles(ctx) {
    for (const k of customers) {
      if (k.state !== 'wait') continue;
      const both = k.pastry >= 0;
      const dHot = !!cup && !k.gotDrink && drinkOf(cup) === k.drink;
      const pHot = pastry !== null && both && !k.gotPastry && pastry === k.pastry;
      const hot = dHot || pHot;
      const iw = both ? 31 : 17, ih = 17;
      const tip = TIP_Y - (hot && (t * 4 | 0) % 2 ? 1 : 0);
      const [ix, iy] = bubble(ctx, Math.round(k.x), tip, iw, ih, hot);
      const ds = drinkSprite(k.drink);
      ctx.globalAlpha = k.gotDrink ? 0.35 : 1;
      ctx.drawImage(ds, ix + 1 + ((15 - ds.width) >> 1), iy + 14 - ds.height);
      ctx.globalAlpha = 1;
      if (k.gotDrink) checkMark(ctx, ix + 4, iy + 5);
      if (both) {
        const ps = pastrySprite(k.pastry);
        ctx.globalAlpha = k.gotPastry ? 0.35 : 1;
        ctx.drawImage(ps, ix + 17 + ((14 - ps.width) >> 1), iy + 13 - ps.height);
        ctx.globalAlpha = 1;
        if (k.gotPastry) checkMark(ctx, ix + 19, iy + 5);
      }
      // tålamodsmätare
      const left = clamp(k.patience / k.pmax, 0, 1), bw = iw - 4;
      ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 15, bw, 2);
      ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
      ctx.fillRect(ix + 2, iy + 15, Math.max(1, Math.round(bw * left)), 2);
      if (k.patience < 8 && Math.sin(t * 6) > 0) {
        const ex = ix + iw + 1;
        ctx.fillStyle = '#17151a'; ctx.fillRect(ex, iy - 4, 5, 10);
        ctx.fillStyle = '#d9433b'; ctx.fillRect(ex + 1, iy - 3, 3, 5); ctx.fillRect(ex + 1, iy + 3, 3, 2);
      }
    }
  }
  // montern: bakverken som finns kvar (fyra av varje sort, fylls på av bagaren)
  function drawMonter(ctx) {
    const slots = [[-6, 80], [6, 80], [-6, 67], [6, 67]];
    for (let k = 0; k < 3; k++) {
      const s = pastrySprite(k);
      for (let i = 0; i < stock[k]; i++) {
        const [dx, by] = slots[i];
        drawAt(ctx, s, MON_COLS[k] + dx, by);
      }
    }
  }
  // espressomaskinen: nålar, lampor, kopp under gruppen, ånga, kvarnens dos
  function drawMachineLive(ctx) {
    const brew = busy && busy.kind === 'brygg', steam = busy && busy.kind === 'anga', grind = busy && busy.kind === 'mala';
    const p1 = brew ? 0.82 + Math.sin(t * 40) * 0.03 : 0.3 + Math.sin(t * 0.7) * 0.02;
    const p2 = steam ? 0.45 + Math.sin(t * 30) * 0.05 : 0.62 + Math.sin(t * 0.5) * 0.02;
    needle(ctx, MANO[0].x, MANO[0].y, p1);
    needle(ctx, MANO[1].x, MANO[1].y, p2);
    // gruppknapparna: lyser grönt när gruppen brygger
    for (let g = 0; g < 2; g++) {
      const on = brew && busy.g === g;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = on && i === 1 ? ((t * 6 | 0) % 2 ? '#8ef08a' : '#45b964') : i === 3 ? '#e8b230' : '#1e2a24';
        ctx.fillRect(GROUPS[g].x - 5 + i * 3, 62, 2, 1);
      }
    }
    if (brew) {
      const g = GROUPS[busy.g], f = busy.t / busy.dur;
      drawAt(ctx, cupSprite(f < 0.45 ? 'tom' : 'esp'), g.x, 86);
      if (f > 0.12 && f < 0.92) {
        for (const sx of [g.x - 2, g.x + 2]) for (let y = 73; y <= 76; y++) {
          ctx.fillStyle = (y + (t * 20 | 0)) % 3 === 0 ? '#c88a4a' : '#5a2c12';
          ctx.fillRect(sx, y, 1, 1);
        }
      }
    }
    // ångröret: stålkanna under pipen medan det skummar
    if (steam) {
      const f = busy.t / busy.dur, jig = (t * 20 | 0) % 2;
      drawPitcher(ctx, WAND.x - 3, 79 + jig, 0);
      // ångmolnet väller upp ur kannan, växer och tunnas ut på vägen
      for (let i = 0; i < 22; i++) {
        const ph = (t * 1.1 + i / 22) % 1, sz = 1 + Math.floor(ph * 3.6);
        const x = WAND.x + Math.round(Math.sin(t * 3.4 + i * 2.1) * (1 + ph * 7)) - (sz >> 1), y = 78 - Math.round(ph * 40);
        ctx.fillStyle = `rgba(255,255,255,${(0.95 * Math.pow(1 - ph, 0.8)).toFixed(2)})`;
        ctx.fillRect(x, y, sz, sz);
        if (sz > 2) { ctx.fillStyle = `rgba(236,244,250,${(0.35 * (1 - ph)).toFixed(2)})`; ctx.fillRect(x - 1, y + 1, sz + 2, sz - 2); }
      }
      // väsande strålar vid pipen
      if ((t * 18 | 0) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(WAND.x - 4, 80, 2, 1); ctx.fillRect(WAND.x + 5, 79, 2, 1); }
      // mjölkskummet sväller i kannan
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(WAND.x - 2, 79 + jig, Math.min(5, 2 + Math.floor(f * 4)), 1);
      if (f > 0.5) { ctx.fillStyle = '#ffffff'; ctx.fillRect(WAND.x - 2, 78 + jig, 5, 1); }
    }
    // kvarnen: dosen i portafiltret och lampan
    ctx.fillStyle = dose ? '#6ef06a' : '#3a2a22';
    ctx.fillRect(GRIND.x + 4, 69, 1, 1);
    if (dose || grind) {
      const f = grind ? busy.t / busy.dur : 1, h = Math.ceil(f * 2);
      ctx.fillStyle = '#4a2a18'; ctx.fillRect(GRIND.x - 3, 76 - h, 7, h);
      ctx.fillStyle = '#6a4028'; ctx.fillRect(GRIND.x - 2, 76 - h, 4, 1);
    }
    if (grind) {
      for (let y = 73; y < 76; y++) { ctx.fillStyle = (y + (t * 24 | 0)) % 2 ? '#6a4028' : '#3a2014'; ctx.fillRect(GRIND.x, y, 1, 1); }
      // bönorna hoppar i behållaren + vibrationsstreck
      for (let i = 0; i < 6; i++) {
        const bx = GRIND.x - 5 + ((i * 7 + (t * 30 | 0)) % 11), by = 54 + ((i * 3 + (t * 25 | 0)) % 6);
        ctx.fillStyle = i % 2 ? '#3a1e10' : '#7a4a26'; ctx.fillRect(bx, by, 2, 1);
      }
      if ((t * 16 | 0) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(GRIND.x - 12, 64, 1, 3); ctx.fillRect(GRIND.x + 12, 66, 1, 3); }
    }
    // ångrörets tomgångsånga (en tunn slinga ibland)
    for (const p of puffs) {
      ctx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - p.age / p.life)).toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
  function drawBenchLive(ctx) {
    if (busy && busy.kind === 'konst') {
      const f = busy.t / busy.dur, x = KONST_X;
      drawAt(ctx, cupSprite(f < 0.6 ? 'cap' : 'lat'), x, 191);
      drawPitcher(ctx, x - 12, 180, f < 0.85 ? 1 : 0);
      if (f < 0.85) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - 4, 180, 1, 2); ctx.fillRect(x - 3, 182, 1, 1); }
    }
    if (busy && busy.kind === 'kakao') {
      const f = busy.t / busy.dur, x = KAKAO_X;
      if (f > 0.3) drawAt(ctx, cupSprite('kak'), x, 191);
      for (let i = 0; i < 6; i++) {
        const ph = (f * 2 + i * 0.17) % 1;
        ctx.fillStyle = `rgba(138,86,52,${(0.8 * (1 - ph)).toFixed(2)})`;
        ctx.fillRect(x - 3 + ((i * 5) % 7), 178 - Math.round(ph * 8), 1, 1);
      }
    }
    if (busy && busy.kind === 'disk') {
      const f = busy.t / busy.dur;
      if (f < 0.6) drawAt(ctx, cupSprite(cupKey(cup || { mug: false, kaffe: true })), DISK_X + 4, 186);
      for (let i = 0; i < 5; i++) {
        const ph = (f * 3 + i * 0.2) % 1;
        ctx.fillStyle = `rgba(200,230,255,${(0.9 * (1 - ph)).toFixed(2)})`;
        ctx.fillRect(DISK_X - 6 + i * 3, 186 - Math.round(Math.sin(ph * Math.PI) * 5), 1, 1);
      }
    }
    // noterna från radion
    for (const n of notes) glyphCtx(ctx, NOTE, Math.round(n.x), Math.round(n.y), `rgba(${n.c},${(1 - n.age / 2.2).toFixed(2)})`);
  }
  function drawClock(ctx) {
    const cx = 367, cy = 30, s = t % 60;
    const hand = (a, len, col) => {
      ctx.fillStyle = col;
      for (let r = 1; r <= len; r++) ctx.fillRect(cx + Math.round(Math.sin(a) * r), cy - Math.round(Math.cos(a) * r), 1, 1);
    };
    const g = A.game, mins = g ? g.min % 720 : 600;
    hand((mins / 720) * Math.PI * 2, 3, '#2a2018');
    hand(((mins % 60) / 60) * Math.PI * 2, 5, '#2a2018');
    hand((s / 60) * Math.PI * 2, 5, '#d9433b');
    ctx.fillStyle = '#c9a44a'; ctx.fillRect(cx, cy, 1, 1);
  }

  return {
    _debug: {
      stats,
      // tvinga fram en gäst som redan står vid disken: dryck 0–3 (ESPRESSO,
      // CAPPUCCINO, LATTE, VARM CHOKLAD), bakverk −1 = inget, 0–2 (KANELBULLE,
      // KLADDKAKA, PRINSESSTÅRTA). Utelämnat = slump. Returnerar gästen eller null.
      forceCustomer(drink, pastryK) {
        const s = freeSpot(); if (s < 0) return null;
        const k = newCustomer(s, 0, true);
        if (drink !== undefined) k.drink = drink;
        if (pastryK !== undefined) k.pastry = pastryK;
        customers.push(k);
        sayOrder(k);
        return { spot: s, x: SPOTS[s], drink: k.drink, pastry: k.pastry };
      },
      // lägg en färdig dryck i händerna (hoppar över stegen)
      makeDrink(d) {
        cup = d === 3 ? { mug: true, choklad: true, skum: true } : { mug: false, kaffe: true, skum: d >= 1, konst: d === 2 };
        return drinkOf(cup);
      },
      // utför ett stationssteg direkt, utan gång och animation:
      // 'mala' | 'brygg' | 'anga' | 'konst' | 'kakao' | 'disk'. Returnerar drycken (−1 = inte klar).
      step(name) {
        const fns = { mala: actMala, brygg: () => actBrygg(0), anga: actAnga, konst: actKonst, kakao: actKakao, disk: actDisk };
        fns[name]?.();
        if (busy) { const b = busy; busy = null; b.fin(); }
        return drinkOf(cup);
      },
      pickPastry(k = 0) { pastry = k; return pastry; },
      // montern: läs av eller sätt antalet kvar av en sort (0 = slut)
      stock: () => stock.slice(),
      setStock(k, n) { stock[k] = clamp(n | 0, 0, 4); return stock[k]; },
      // servera direkt: right = till en gäst som vill ha det jag bär, annars till en som inte vill det
      serve(right = true) {
        if (!cup && pastry === null) return null;
        const d = drinkOf(cup);
        const wants = (k) => (cup && !k.gotDrink && d === k.drink) || (pastry !== null && !k.gotPastry && k.pastry === pastry);
        const wrong = (k) => (cup && !k.gotDrink && d !== k.drink) || (pastry !== null && !k.gotPastry && k.pastry >= 0 && k.pastry !== pastry);
        const k = waiting().find(right ? wants : wrong) || waiting()[0];
        if (!k) return null;
        serveTo(k);
        return stats;
      },
      customers: () => customers.map((k) => ({ spot: k.spot, x: k.x, state: k.state, drink: k.drink, pastry: k.pastry, gotDrink: k.gotDrink, gotPastry: k.gotPastry })),
      carrying: () => ({ drink: drinkOf(cup), cup: cup ? { ...cup } : null, pastry }),
      dose: () => dose,
      busy: () => (busy ? busy.kind : null),
      // sant när baristan står still och inte håller på med något (för klicktester)
      idle: () => !busy && !queued && walker.path.length === 0,
      time: () => t,
      // håll en station igång (för förhandsbilder av animationerna)
      freeze(kind, g = 0, frac = 0.6) {
        const map = { mala: GRIND.sx, brygg: GROUPS[g].sx, anga: WAND.sx, monter: MON_COLS[0], konst: KONST_X, kakao: KAKAO_X, disk: DISK_X };
        const durs = { mala: 0.8, brygg: 1.2, anga: 1.0, monter: 0.3, konst: 0.9, kakao: 0.6, disk: 0.5 };
        const bench = kind === 'konst' || kind === 'kakao' || kind === 'disk';
        walker.stop(); walker.px = map[kind]; walker.py = bench ? BENCH_Y : WORK_Y; walker.dir = bench ? 'down' : 'up';
        if (kind === 'anga' || kind === 'konst' || kind === 'disk') cup = { mug: false, kaffe: true, skum: kind !== 'anga' };
        if (kind === 'brygg') dose = true;
        busy = { kind, t: frac * durs[kind], dur: durs[kind], fin: () => {}, g, col: 0, frozen: true };
      },
      place(x, y, dir = 'down') { walker.stop(); walker.px = x; walker.py = y; walker.dir = dir; },
      // klickpunkter (spelpixlar) för klickbaserade tester
      spots: { mala: [GRIND.x, 60], brygg: [GROUPS[0].x, 60], anga: [WAND.x + 6, 70], konst: [KONST_X, 188], kakao: [KAKAO_X, 188], disk: [DISK_X, 188], monter: MON_COLS.map((x) => [x, 70]), gast: SPOTS.map((x) => [x, 70]) },
      sheet() { return spriteSheet(); },
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      // små levande detaljer (även efter SLUT!)
      wispIn -= dt;
      if (wispIn <= 0) { wispIn = 2.5 + Math.random() * 3; for (let i = 0; i < 4; i++) puffs.push({ x: WAND.x + (Math.random() * 2 | 0), y: 81 - i, vx: (Math.random() - 0.5) * 3, age: -i * 0.12, life: 1.3 }); }
      for (const p of puffs) { p.age += dt; if (p.age > 0) { p.y -= 9 * dt; p.x += p.vx * dt + Math.sin(p.age * 6) * 0.08; } }
      for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].age > puffs[i].life) puffs.splice(i, 1);
      noteIn -= dt;
      if (noteIn <= 0) { noteIn = 1.1 + Math.random(); notes.push({ x: RADIO.x + 4 + Math.random() * 4, y: RADIO.y - 4, age: 0, c: ['240,210,120', '250,170,200', '170,220,250'][(Math.random() * 3) | 0] }); }
      for (const n of notes) { n.age += dt; n.y -= 7 * dt; n.x += Math.sin(n.age * 4) * 0.12; }
      for (const s of talk) s.age += dt;
      for (let i = talk.length - 1; i >= 0; i--) if (talk[i].age > 2.1) talk.splice(i, 1);
      for (let i = notes.length - 1; i >= 0; i--) if (notes[i].age > 2.2) notes.splice(i, 1);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.(stats); } return; }
      t += dt;
      if (t >= P.seconds) { done = true; busy = null; queued = null; walker.stop(); return; }
      if (busy) {
        if (!busy.frozen) {
          busy.t += dt;
          if (busy.t >= busy.dur) {
            const b = busy; busy = null; b.fin();
            if (queued) { const q = queued; queued = null; handleDown(q[0], q[1]); }
          }
        }
      } else walker.update(dt);
      // bagaren fyller på montern
      for (let k = 0; k < 3; k++) {
        if (stock[k] >= 4) { restock[k] = 0; continue; }
        restock[k] += dt;
        if (restock[k] > 4.5) { restock[k] = 0; stock[k]++; }
      }
      // nya gäster (en van barista får fler – P.pace; tålamodet följer passets förlopp som vanligt)
      custIn -= dt;
      if (custIn <= 0) {
        const prog = Math.min(1, t / P.seconds);
        const s = freeSpot();
        if (s >= 0) { customers.push(newCustomer(s, prog)); custIn = (6 - 2 * prog + hash(seq, 7) * 2.2) * P.pace; }
        else custIn = 1;
      }
      for (const k of customers) {
        if (k.state === 'walk') {
          const tx = SPOTS[k.spot], sp = 38 * dt;
          if (Math.abs(tx - k.x) <= sp) {
            k.x = tx; k.y = CUST_Y; k.state = 'wait'; k.dir = 'down'; play('chirp');
            sayOrder(k);
          }
          else { k.x += Math.sign(tx - k.x) * sp; k.dir = tx < k.x ? 'left' : 'right'; }
        } else if (k.state === 'wait') {
          k.patience -= dt;
          if (k.patience <= 0) { k.state = 'leave'; k.dir = 'left'; k.y = CUST_Y - 3; stats.miss++; play('miss'); sayK(k, 36, 'GICK...'); }
        } else if (k.state === 'happy') {
          k.t -= dt;
          if (k.t <= 0) { k.state = 'exit'; k.dir = 'right'; k.y = CUST_Y - 3; }
        } else if (k.state === 'leave') {
          k.x -= 44 * dt;
          if (k.x < -16) k.gone = true;
        } else if (k.state === 'exit') {
          k.x += 44 * dt;
          if (k.x > FW + 16) k.gone = true;
        }
      }
      customers = customers.filter((k) => !k.gone);
    },
    down(x, y) { handleDown(x, y); },
    key(kk) { if (kk === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      const Ly = layers();
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(Ly.back, 0, 0);
      drawClock(ctx);
      // gästerna står bakom disken (de som går ut ritas bakom de som väntar)
      [...customers].sort((a, b) => a.y - b.y || a.x - b.x).forEach((k) => drawCustomer(ctx, k));
      ctx.drawImage(Ly.counter, 0, 0);
      drawMonter(ctx);
      ctx.drawImage(Ly.glass, 0, 0);
      drawMachineLive(ctx);
      drawServed(ctx);
      // golvet: jag, andra spelare, backarna och hinken – i djupordning
      const drawables = [...folkDrawables(A, t)];
      const up = walker.dir === 'up';
      drawables.push({ fy: walker.py + (up ? 0.01 : -0.01), draw: () => drawMe(ctx) });
      drawables.push({ fy: walker.py + (up ? -0.01 : 0.01), draw: () => drawHeld(ctx) });
      drawables.push({ fy: CRATES.y, draw: () => ctx.drawImage(Ly.crates, CRATES.x, CRATES.y - Ly.crates.height + 1) });
      drawables.push({ fy: BUCKET.y, draw: () => ctx.drawImage(Ly.bucket, BUCKET.x, BUCKET.y - Ly.bucket.height + 1) });
      drawables.push({ fy: RACK.y, draw: () => ctx.drawImage(Ly.rack, RACK.x - 1, RACK.y - Ly.rack.height + 3) });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.drawImage(Ly.bench, 0, 0);
      drawBenchLive(ctx);
      drawBubbles(ctx);
      drawTalk(ctx);
      drawCupTag(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: P.seconds, ok: stats.ok, fel: stats.fel, title: 'KAFÉET' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };
}

// manometerns nål: p 0 = längst ner till vänster, 1 = längst ner till höger
function needle(ctx, cx, cy, p) {
  const a = (-135 + 270 * clamp(p, 0, 1)) * Math.PI / 180;
  ctx.fillStyle = '#1e1a1c';
  for (let r = 1; r <= 3; r++) ctx.fillRect(cx + Math.round(Math.sin(a) * r), cy - Math.round(Math.cos(a) * r), 1, 1);
  ctx.fillStyle = '#d9433b'; ctx.fillRect(cx, cy, 1, 1);
}
// mjölkkanna i stål (7×7); tilt 1 = lutad för att hälla
function drawPitcher(ctx, x, y, tilt) {
  const m = tilt
    ? ['...hhh.', '..hSSSs', '.hSSSSs', 'hSSSSs.', 'SSSSs..', '.sss...', '.......']
    : ['hhhhhS.', 'hSSSSsS', 'hSSSSs.', 'hSSSSs.', 'hSSSSs.', 'SSSSSs.', '.sssss.'];
  const pal = { h: '#ffffff', S: '#c4ccd4', s: '#6a747e' };
  m.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } } });
}

// ======================= lagren (målas en gång) =======================
// Bakväggen: tak, tegel, fönster mot gatan, pendellampor, griffeltavlor, klocka
// och gästernas golv. Allt som ligger bakom gästerna.
function paintBack() {
  const P = new Pix(FW, FH);
  // ---- taket: mörka brädor och bjälkar (syns svagt under HUD:en) ----
  area(P, 0, 0, FW, 19, (X, Y) => {
    let c = qmix(0x221409, 0x3a2515, Y / 19, X, Y, 3);
    if (Y % 6 === 5) c = mul(c, 0.7);
    const b = (X + 24) % 64;
    if (b < 6) c = b === 0 ? 0x5e3d25 : b === 5 ? 0x160c06 : mix(0x4e311d, 0x2e1c10, b / 5);
    return jit(c, X, Y, 1, 0.1);
  });
  rows(P, 0, 19, FW, [0xf6ead0, 0xb8a47e]);
  // ---- tegelväggen ----
  area(P, 0, 21, FW, 29, (X, Y) => brickPx(X, Y, 0x9a4834, 5, { mortar: 0x5c3c2e }));
  P.darken(0, 21, FW, 1, 0.55); P.darken(0, 22, FW, 1, 0.8);
  // ---- mässingslist och grönmålad bröstpanel med speglar ----
  rows(P, 0, 50, FW, [0xf0d27a, 0xa8842e]);
  area(P, 0, 52, FW, 12, (X, Y, i, j) => {
    const k = X % 32;
    let c = jit(0x2f5b46, X, Y, 7, 0.06);
    if (k === 0) c = 0x1c3a2c; else if (k === 1) c = 0x4f8468;
    else if (k >= 4 && k <= 28 && j >= 2 && j <= 9) {
      if (j === 2 || k === 4) c = 0x1c3a2c; else if (j === 9 || k === 28) c = 0x5a9474;
      else c = jit(0x2a5240, X, Y, 8, 0.05);
    }
    if (j === 0) c = mul(c, 0.7);
    return c;
  });
  rows(P, 0, 64, FW, [0x14281e, 0x0e1c14]);
  // ---- gästgolvet: svartvita rutor, i skugga bakom disken ----
  area(P, 0, 66, FW, 18, (X, Y, i, j) => {
    const q = ((X / 6) | 0) + ((j / 3) | 0);
    let c = q & 1 ? 0x2c2622 : 0xd6cab2;
    c = mul(c, 0.66 + j * 0.014);
    return jit(c, X, Y, 9, 0.06);
  });
  P.darken(0, 66, FW, 1, 0.5); P.darken(0, 67, FW, 1, 0.75);
  // ---- fönstren mot gatan ----
  paintWindow(P, 92, 24, 56, 24, 3);
  paintWindow(P, 154, 24, 56, 24, 11);
  // ---- griffeltavlorna ----
  paintFikaBoard(P, 5, 21, 81, 27);
  paintCoffeeBoard(P, 216, 21, 137, 27);
  // hängande pothos i en ampel mellan fönstret och tavlan (rankorna följer
  // tavlans ram ner mot mässingslisten – de skymmer aldrig kritan)
  P.vl(214, 19, 3, 0x2a1e14);
  area(P, 210, 22, 9, 4, (X, Y, i, j) => (j === 0 ? 0xe8a070 : i === 0 ? 0xd88a5c : i === 8 ? 0x6a3418 : j === 3 ? 0x7a3a22 : jit(0xb86a44, X, Y, 301, 0.08)));
  leaves(P, 214, 22, 6, 3, 299, 0x2a5a26, 0x4a8a3a, 0x7cc05a, 0.6);
  for (let i = 0; i < 12; i++) {
    const vx = 213 + [0, 1, -1, 1, 0, 2, 1, -1, 0, 1, 2, 0][i], vy = 27 + i * 2 + (i % 2);
    leaves(P, vx, vy, 2.2, 1.6, 300 + i, 0x2a5a26, 0x4a8a3a, 0x7cc05a, 0.7);
  }
  for (let i = 0; i < 5; i++) leaves(P, 209 - (i >> 1), 28 + i * 3, 1.8, 1.4, 320 + i, 0x2a5a26, 0x4a8a3a, 0x7cc05a, 0.7);
  // ---- klockan och hyllan med koppar till höger ----
  paintClock(P, 367, 30);
  paintCupShelf(P, 355, 45);
  // ---- pendellampor med varmt ljus ----
  for (const lx of LAMPS) paintLamp(P, lx);
  for (const lx of LAMPS) P.ell(lx + 0.5, 42, 24, 17, 0xffd48a, 0.2);
  P.ell(46, 44, 40, 14, 0xffd48a, 0.1);
  P.ell(290, 44, 70, 14, 0xffd48a, 0.1);
  // ---- baristans golv: ekplank med gummimatta framför maskinen ----
  area(P, 0, CT.base, FW, FH - CT.base, (X, Y, i, j) => {
    const row = (j / 6) | 0, off = (row * 37) % 60, seam = (X + off) % 60 === 0;
    const plank = hash(((X + off) / 60) | 0, row, 71);
    let c = plank > 0.66 ? 0xb07a48 : plank > 0.33 ? 0xa06c3c : 0xba8450;
    if (j % 6 === 5) c = mul(c, 0.72);
    else if (j % 6 === 0) c = mix(c, WHITE, 0.1);
    if (seam) c = mul(c, 0.7);
    const grain = Math.sin((X + row * 13) * 0.35 + Math.sin(X * 0.07 + row) * 3);
    if (grain > 0.9) c = mul(c, 0.9);
    return jit(c, X, Y, 72, 0.06);
  });
  P.darken(0, CT.base, FW, 1, 0.45); P.darken(0, CT.base + 1, FW, 2, 0.7); P.darken(0, CT.base + 3, FW, 2, 0.86);
  // gummimattan (svart med hål i bikupemönster)
  area(P, 222, 124, 112, 16, (X, Y, i, j) => {
    const edge = i === 0 || j === 0 || i === 111 || j === 15;
    if (edge) return j === 0 || i === 0 ? 0x4a4a50 : 0x141416;
    const hole = ((i + (((j / 2) | 0) & 1 ? 2 : 0)) % 4 === 1) && j % 2 === 1;
    return hole ? 0x6a4a30 : jit(0x2a2a30, X, Y, 73, 0.1);
  });
  P.darken(222, 140, 112, 1, 0.7);
  // golvbrunn
  P.rect(186, 150, 8, 4, 0x6a747e); P.box(186, 150, 8, 4, 0x3a4048);
  for (let i = 1; i < 7; i += 2) P.vl(186 + i, 151, 2, 0x22262c);
  // varma ljuspölar från taket
  for (const lx of [60, 170, 280]) P.ell(lx, 158, 58, 24, 0xffe0a0, 0.1);
  return P.flush();
}

function paintWindow(P, x, y, w, h, seed) {
  // ram: mörkgrön med guldlist
  P.rect(x - 3, y - 3, w + 6, h + 5, 0x1c3a2c);
  P.rect(x - 2, y - 2, w + 4, h + 3, 0x2f5b46);
  P.hl(x - 2, y - 2, w + 4, 0x4f8468);
  P.box(x - 1, y - 1, w + 2, h + 2, 0xc9a44a);
  // utsikten: markisen, himlen, huset mittemot, trottoaren
  area(P, x, y, w, h, (X, Y, i, j) => {
    const stripe = ((X + 1) >> 2) & 1;
    if (j < 3) return mul(stripe ? 0xf4efe4 : 0xc8323a, j === 0 ? 0.8 : 1);
    if (j === 3) return (X & 3) === 1 || (X & 3) === 2 ? mul(stripe ? 0xd8d0c0 : 0x9a2028, 1) : qmix(0xcfe8f4, 0xa4d0ea, 0.1, X, Y, 3);
    if (j < 6) return qmix(0xcfe8f4, 0xa4d0ea, (j - 3) / 3, X, Y, 3);
    // huset mittemot: gul puts med fönster
    let c = jit(0xe4cc9e, X, Y, 21 + seed, 0.07);
    const wx = (X + seed * 3) % 14, wy = j - 8;
    if (wx >= 3 && wx < 9 && wy >= 0 && wy < 7) {
      c = wx === 3 || wx === 8 || wy === 0 || wy === 6 ? 0xfaf4e8 : qmix(0x5a7a98, 0x2c3a4c, wy / 6, X, Y, 2);
      if (wx === 6 && wy > 0 && wy < 6) c = 0xfaf4e8;
    }
    if (j === 6) c = 0xb8a482;
    if (j >= 16) c = j === 16 ? 0x8a8478 : jit(0xb4aea4, X, Y, 22, 0.1);
    return c;
  });
  // ett träd på gatan i ena fönstret
  if (seed > 5) { leaves(P, x + 10, y + 9, 9, 6, 40 + seed, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.6); P.rect(x + 9, y + 14, 2, 6, 0x5a3a24); }
  else { P.rect(x + 44, y + 6, 1, 12, 0x2a3036); P.rect(x + 42, y + 5, 5, 2, 0x2a3036); P.px(x + 44, y + 7, 0xfff2b0); }
  // spröjs
  P.vl(x + (w >> 1), y, h, 0x1c3a2c); P.vl(x + (w >> 1) + 1, y, h, 0x4f8468);
  // glasreflex
  for (let j = 0; j < 14; j++) for (let i = 0; i < w; i++) {
    const s = ((((x + i + seed) * 2 - (y + j) * 3) % 44) + 44) % 44;
    const a = s < 3 ? 0.28 : s === 8 ? 0.14 : 0;
    if (a) P.px(x + i, y + j, 0xf4fbff, a);
  }
  // spetsgardin på mässingsstång (nedre halvan)
  const cy = y + 13;
  P.hl(x - 2, cy, w + 4, 0xf0d27a); P.hl(x - 2, cy + 1, w + 4, 0x8a6a28);
  P.px(x - 3, cy, 0xfff0a8); P.px(x + w + 2, cy, 0xfff0a8);
  area(P, x, cy + 2, w, h - 15, (X, Y, i, j) => {
    const fold = i % 5;
    let c = fold === 4 ? 0xd8cfbe : fold === 0 ? 0xfffcf4 : 0xf2ecde;
    if ((i + j) % 4 === 0 && j > 1 && j < h - 17) c = mix(c, 0xb8ad98, 0.35);   // spetsmönster
    if (j === 0 && i % 3 === 1) c = 0xd8cfbe;
    return c;
  });
  // fönsterbänk med små suckulenter
  rows(P, x - 3, y + h, w + 6, [0xf2e6cc, 0xa89878]);
  for (const [px, pc] of [[x + 6, 0xb86a44], [x + w - 12, 0xe8e2d6]]) {
    P.rect(px, y + h - 4, 5, 4, pc); P.hl(px, y + h - 4, 5, mix(pc, WHITE, 0.3)); P.vl(px + 4, y + h - 3, 3, mul(pc, 0.7));
    leaves(P, px + 2.5, y + h - 6, 3.2, 2.4, px, 0x3a7a4a, 0x5aa86a, 0x9ad89a, 0.8);
  }
}

function paintLamp(P, lx) {
  P.vl(lx, 19, 7, 0x2a1e14);
  P.rect(lx - 1, 25, 3, 1, 0x8a6a28);
  const shade = [[26, 2], [27, 3], [28, 4], [29, 4]];
  for (const [yy, hw] of shade) for (let x = lx - hw; x <= lx + hw; x++) {
    const tt = (x - (lx - hw)) / (hw * 2);
    P.px(x, yy, yy === 26 ? 0xfff0a8 : BRASS[clamp(Math.floor(tt * 4.2 + (yy - 27) * 0.3), 0, 4)]);
  }
  P.hl(lx - 4, 30, 9, 0x5a4214);
  P.hl(lx - 2, 31, 5, 0xffe89a); P.px(lx, 31, 0xffffff); P.px(lx, 32, 0xfff4c0);
}

// kritbokstäver: lätt ojämna (en pixel i taget med lite alfa)
function chalk(P, s, x, y, c, seed = 0) {
  let n = 0;
  const pts = [];
  text({ px: (px, py) => pts.push([px, py]) }, SMALL, s, x, y, c);
  for (const [px, py] of pts) P.px(px, py, c, 0.78 + hash(px, py, seed + n++) * 0.22);
}
function boardFrame(P, x, y, w, h) {
  P.darken(x + 2, y + h, w, 2, 0.7); P.darken(x + w, y + 2, 2, h - 1, 0.72);
  area(P, x, y, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e === 0) return 0x2e1a0c;
    if (e === 1) return jit(i === 1 || j === 1 ? 0xa0703e : 0x5e3a1e, X, Y, 41, 0.08);
    let c = jit(0x283029, X, Y, 42, 0.12);
    if (hash(X >> 1, Y, 43) > 0.9) c = mix(c, 0x9aa89e, 0.16);
    if ((X + Y * 2) % 23 === 0 && hash(X, Y, 44) > 0.5) c = mix(c, 0x9aa89e, 0.1);   // gamla kritsvep
    return c;
  });
}
function paintFikaBoard(P, x, y, w, h) {
  boardFrame(P, x, y, w, h);
  const title = 'FIKA';
  chalk(P, title, x + (w >> 1) - (textW(SMALL, title) >> 1), y + 2, 0xf6d86a, 1);
  // små hjärtan bredvid rubriken
  glyph(P, ['#.#', '###', '.#.'], x + (w >> 1) - 16, y + 3, 0xf6a0c0, 0.9);
  glyph(P, ['#.#', '###', '.#.'], x + (w >> 1) + 13, y + 3, 0xf6a0c0, 0.9);
  PASTRIES.forEach((p, i) => {
    const ry = y + 8 + i * 6, price = p.price + ':-';
    chalk(P, p.name, x + 3, ry, 0xf2eee4, 10 + i);
    chalk(P, price, x + w - 3 - textW(SMALL, price), ry, 0xf6d86a, 20 + i);
  });
}
function paintCoffeeBoard(P, x, y, w, h) {
  boardFrame(P, x, y, w, h);
  DRINKS.forEach((d, i) => {
    const ry = y + 2 + i * 6, price = d.price + ':-';
    chalk(P, d.name, x + 3, ry, 0xf2eee4, 30 + i);
    // receptet med stationernas tecken
    let sx = x + 57;
    d.steps.forEach((st, k) => {
      if (k) { P.px(sx - 2, ry + 2, 0xb8b0a0, 0.8); }
      glyph(P, ICONS[st], sx, ry, ICON_CHALK[st], 0.9);
      sx += 8;
    });
    // prickar fram till priset
    for (let px = sx + 1; px < x + w - 6 - textW(SMALL, price); px += 2) P.px(px, ry + 4, 0x8a948c, 0.8);
    chalk(P, price, x + w - 3 - textW(SMALL, price), ry, 0xf6d86a, 40 + i);
  });
}
function paintClock(P, cx, cy) {
  P.ell(cx + 2, cy + 2, 10, 10, 0x1a0e08, 0.4);
  disc(P, cx, cy, 9.2, (X, Y, d, dx, dy) => {
    if (d > 8.2) return 0x2a1a0c;
    if (d > 6.9) return dx + dy < -2 ? 0xfff0a8 : dx + dy > 3 ? 0x8a6a28 : 0xd4b050;
    return jit(dx + dy > 5 ? 0xe8dfcc : 0xf6efe0, X, Y, 61, 0.03);
  });
  for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0]]) P.px(cx + dx, cy + dy, 0x2a2018);
  for (const [dx, dy] of [[3, -5], [5, -3], [5, 3], [3, 5], [-3, 5], [-5, 3], [-5, -3], [-3, -5]]) P.px(cx + dx, cy + dy, 0xa89878);
}
function paintCupShelf(P, x, y) {
  // hylla med konsoler och fyra koppar på rad
  rows(P, x, y, 27, [0xa0703e, 0x6a4424, 0x3a2010]);
  P.darken(x, y + 3, 27, 1, 0.7);
  for (const bx of [x + 3, x + 22]) { P.vl(bx, y + 3, 3, 0x2a1a10); P.px(bx + 1, y + 3, 0x2a1a10); }
  const cols = [0xf4f1ea, 0x4f8468, 0xcf3a3a, 0xf0d27a];
  cols.forEach((c, i) => {
    const cx = x + 2 + i * 6;
    P.rect(cx, y - 4, 4, 4, c); P.hl(cx, y - 4, 4, mix(c, WHITE, 0.4)); P.vl(cx + 3, y - 3, 3, mul(c, 0.72));
    P.px(cx + 4, y - 3, mul(c, 0.8)); P.px(cx + 4, y - 2, mul(c, 0.65));
    P.hl(cx, y - 5, 4, mul(c, 0.6));
  });
}

// Disken med allt som står på den: glasmontern, kassaapparaten, espressomaskinen,
// kvarnen och tårtkupan. Transparent ovanför skivan – gästerna syns igenom.
function paintCounter() {
  const P = new Pix(FW, FH);
  // ---- skivan (y 84–91): valnöt med ådring ----
  area(P, 0, CT.top, FW, 8, (X, Y, i, j) => {
    if (j === 0) return 0x2e1a0e;
    let c = qmix(0x54301a, 0x7a4a2a, j / 6, X, Y, 3);
    const g = Math.sin(X * 0.19 + Math.sin(X * 0.041 + j * 0.8) * 2.4 + j * 1.3);
    if (g > 0.86) c = mix(c, 0xa06e40, 0.35); else if (g < -0.9) c = mul(c, 0.84);
    if (j === 6) c = 0xc8966a;
    if (j === 7) c = 0x7a4a26;
    return jit(c, X, Y, 31, 0.06);
  });
  // ---- framsidan mot oss (y 92–113): grönmålade skåp och öppna hyllor ----
  rows(P, 0, CT.face, FW, [0x120a06]);
  area(P, 0, CT.face + 1, FW, 17, (X, Y) => jit(0x2f5b46, X, Y, 32, 0.05));
  rows(P, 0, 110, FW, [0x5a9474, 0x1c3a2c, 0x12261c, 0x0a140e]);
  // skåpdörrar under montern
  for (const dx of [2, 44]) cabinetDoor(P, dx, 94, 40, 15, dx === 2 ? 'r' : 'l');
  // öppna hyllor under beställningsdisken
  shelves(P, 88, 212);
  // under maskinen: sumplåda, vattenfilter och lådor
  area(P, 214, 93, 104, 16, (X, Y) => jit(0x14241c, X, Y, 33, 0.08));
  P.box(213, 93, 106, 16, 0x1c3a2c);
  // sumplådan: svart låda med knackstång och gamla kaffekakor
  P.rect(222, 97, 16, 11, 0x1e1e22); P.hl(222, 97, 16, 0x4a4a52); P.vl(237, 98, 10, 0x0e0e10);
  P.hl(223, 99, 14, 0xc4ccd4); P.hl(223, 100, 14, 0x6a747e);
  for (let i = 0; i < 4; i++) { P.rect(224 + i * 3, 102, 3, 2, i % 2 ? 0x4a2c18 : 0x5a3620); P.px(224 + i * 3, 102, 0x7a5030); }
  // vattenfilter (blå behållare med slang)
  P.rect(244, 95, 7, 13, 0x2c6fb7); P.vl(244, 95, 13, 0x5a9ae0); P.vl(250, 96, 12, 0x1a4a80); P.hl(244, 95, 7, 0xd8e8f8);
  P.rect(245, 100, 5, 3, 0xf4f1ea); P.hl(245, 101, 5, 0x9ab0c8);
  P.vl(247, 93, 2, 0x2a3036);
  // kaffesäckar
  for (const [bx, lab] of [[256, 0xcf3a3a], [270, 0x2f8f46]]) {
    area(P, bx, 96, 12, 12, (X, Y, i, j) => (j === 0 ? 0x8a6a40 : jit(i < 2 ? 0xd8b080 : i > 9 ? 0x9a7448 : 0xc49a68, X, Y, 34, 0.1)));
    P.hl(bx + 2, 96, 8, 0x6a4a28); P.px(bx + 5, 95, 0x6a4a28); P.px(bx + 6, 95, 0x6a4a28);
    P.rect(bx + 2, 100, 8, 4, lab); P.hl(bx + 3, 101, 6, 0xf4f1ea);
  }
  // lådor med mässingshandtag
  for (const dy of [94, 101]) {
    P.rect(285, dy, 31, 6, 0x2f5b46); P.bevel(285, dy, 31, 6, 0x4f8468, 0x1c3a2c);
    P.hl(297, dy + 2, 7, 0xf0d27a); P.hl(297, dy + 3, 7, 0x8a6a28);
  }
  // skåp under kvarnen och tårtkupan
  cabinetDoor(P, 320, 94, 30, 15, 'r');
  cabinetDoor(P, 352, 94, 30, 15, 'l');
  // stationernas mässingsbrickor
  brassPlate(P, 257, 93, 'BRYGG', 'brygg');
  brassPlate(P, 301, 102, 'ÅNGA', 'anga');
  brassPlate(P, 335, 102, 'MALA', 'mala');
  // ---- glasmontern (baksidan av den, glaset ritas i eget lager) ----
  paintMonter(P);
  // ---- kassaapparaten i mässing + kortterminal ----
  paintKassa(P, 89);
  P.rect(110, 82, 6, 8, 0x1e1e22); P.hl(110, 82, 6, 0x4a4a52); P.rect(111, 83, 4, 2, 0x6ef06a); P.px(111, 83, 0xc8ffc0);
  for (let i = 0; i < 3; i++) P.px(111 + i, 86, 0x8a8a92), P.px(111 + i, 88, 0x8a8a92);
  // ---- mellan gästerna: en tulpan i vas och en sockerskål ----
  P.rect(140, 83, 3, 6, 0xbfe4ec); P.vl(140, 83, 6, 0xe8f8fc); P.hl(140, 88, 3, 0x7aa4b0);
  P.vl(141, 76, 7, 0x3a8a3a); P.px(142, 79, 0x5aaa4a); P.px(143, 78, 0x5aaa4a);
  P.rect(140, 73, 3, 3, 0xe8303a); P.px(140, 72, 0xe8303a); P.px(142, 72, 0xe8303a); P.px(140, 73, 0xff7a6a);
  P.rect(176, 85, 7, 4, 0xf4f1ea); P.hl(176, 85, 7, 0xffffff); P.hl(177, 88, 5, 0xbcb4a4); P.rect(178, 83, 3, 2, 0xf4f1ea); P.px(179, 82, 0xc9a44a);
  // ---- espressomaskinen och kvarnen ----
  paintMachine(P);
  paintGrinder(P);
  // ---- tårtkupa med en hel prinsesstårta, och dricksburken ----
  paintCakeDome(P, 362);
  P.rect(374, 78, 8, 11, 0xd8eef4); P.vl(374, 78, 11, 0xffffff); P.vl(381, 79, 10, 0x8ab0bc); P.hl(374, 78, 8, 0xeef8fc);
  for (const [cx2, cy2, c] of [[376, 86, 0xf0d27a], [378, 87, 0xc4ccd4], [377, 84, 0xe8c050], [379, 85, 0xf0d27a], [376, 88, 0xc4ccd4]]) P.px(cx2, cy2, c);
  P.rect(375, 81, 6, 2, 0xf4f1ea); P.px(377, 81, 0xd9433b); P.px(378, 81, 0xd9433b);
  return P.flush();
}
function cabinetDoor(P, x, y, w, h, knob) {
  P.bevel(x, y, w, h, 0x4f8468, 0x14281e);
  P.bevel(x + 3, y + 3, w - 6, h - 6, 0x1c3a2c, 0x5a9474);
  area(P, x + 4, y + 4, w - 8, h - 8, (X, Y) => jit(0x2a5240, X, Y, 35, 0.05));
  const kx = knob === 'r' ? x + w - 3 : x + 2;
  P.px(kx, y + 6, 0xfff0a8); P.px(kx, y + 7, 0xc9a44a); P.px(kx, y + 8, 0x7a5c1e);
}
// Öppna hyllor på vår sida av disken: koppar, glas, mjölk, pappmuggar, servetter.
function shelves(P, x0, x1) {
  area(P, x0, 93, x1 - x0, 16, (X, Y, i, j) => jit(j < 2 ? 0x0e1a14 : 0x16281f, X, Y, 36, 0.08));
  const cells = [];
  for (let x = x0; x < x1; x += 31) cells.push(x);
  for (const cx of cells) { P.vl(cx, 93, 16, 0x4f8468); P.vl(cx + 1, 93, 16, 0x1c3a2c); }
  P.vl(x1 - 1, 93, 16, 0x1c3a2c);
  P.hl(x0, 100, x1 - x0, 0x5a9474); P.hl(x0, 101, x1 - x0, 0x1c3a2c);
  const top = 99, bot = 108;   // hyllplanens översidor (föremålen står på dem)
  cells.forEach((cx, ci) => {
    const a = cx + 3;
    if (ci === 0) {
      // koppstaplar och fatstapel
      for (let s = 0; s < 3; s++) for (let k = 0; k < 3; k++) { const yy = top - 1 - k * 2; P.hl(a + s * 7, yy, 5, 0xf4f1ea); P.hl(a + s * 7, yy - 1, 5, k === 2 ? 0xffffff : 0xcac2b2); P.px(a + s * 7 + 4, yy, 0xb6ad9c); }
      for (let k = 0; k < 4; k++) { P.hl(a + 1, bot - k, 11, k % 2 ? 0xdcd6ca : 0xf4f1ea); }
      P.hl(a + 14, bot - 3, 9, 0xf0d27a); P.hl(a + 14, bot - 2, 9, 0xc9a44a); P.hl(a + 14, bot - 1, 9, 0x8a6a28);   // bricka
    } else if (ci === 1) {
      // glas och mjölkpaket
      for (let s = 0; s < 4; s++) { P.rect(a + s * 6, top - 5, 4, 5, 0x9ac8d8); P.vl(a + s * 6, top - 5, 5, 0xe0f4fa); P.hl(a + s * 6, top - 5, 4, 0xd0eef6); P.vl(a + s * 6 + 3, top - 4, 4, 0x6a98a8); }
      for (let s = 0; s < 3; s++) {
        const mx = a + s * 8;
        P.rect(mx, bot - 7, 6, 7, 0xf4f1ea); P.rect(mx, bot - 4, 6, 3, s === 2 ? 0x2f8f46 : 0x2c6fb7); P.vl(mx + 5, bot - 7, 7, 0xbcb4a4);
        P.hl(mx + 1, bot - 8, 4, 0xdcd6ca); P.px(mx + 2, bot - 9, 0xdcd6ca);
      }
    } else if (ci === 2) {
      // pappmuggar med lock och servetter
      for (let s = 0; s < 2; s++) for (let k = 0; k < 5; k++) { const yy = top - 1 - k; P.hl(a + s * 9, yy, 6, k % 2 ? 0xc89a6a : 0xb8864e); P.px(a + s * 9 + 5, yy, 0x8a5a30); }
      P.rect(a + 19, top - 3, 7, 3, 0x2a2a30); P.hl(a + 19, top - 3, 7, 0x4a4a52);
      for (let k = 0; k < 3; k++) { P.rect(a + k * 8, bot - 5, 7, 5, 0xfaf6ee); P.hl(a + k * 8, bot - 5, 7, 0xffffff); P.vl(a + k * 8 + 6, bot - 4, 4, 0xd8d0c0); P.hl(a + k * 8, bot - 3, 7, 0xd9433b); }
    } else {
      // kaffebönor i burkar och havremjölk
      for (let s = 0; s < 3; s++) {
        const jx = a + s * 8;
        P.rect(jx, top - 7, 6, 7, 0xd8eef4); P.rect(jx + 1, top - 5, 4, 5, 0x5a3020);
        for (let k = 0; k < 4; k++) P.px(jx + 1 + (k * 3) % 4, top - 5 + k, 0x8a5a38);
        P.hl(jx, top - 8, 6, 0xc9a44a); P.vl(jx, top - 7, 7, 0xffffff);
      }
      for (let s = 0; s < 3; s++) { const mx = a + s * 8; P.rect(mx, bot - 7, 6, 7, 0xe8dcc0); P.rect(mx, bot - 5, 6, 3, 0x6a8a3a); P.vl(mx + 5, bot - 7, 7, 0xb8ac90); P.hl(mx + 1, bot - 8, 4, 0xd8ccb0); }
    }
  });
}
// glasmontern: mässingsstolpar, varm belysning, två glashyllor, prislappar
function paintMonter(P) {
  const { x0, x1, top } = MON, w = x1 - x0;
  // insidan (spegelbaksida med varmt ljus)
  area(P, x0 + 2, top + 4, w - 4, 26, (X, Y, i, j) => {
    let c = qmix(0xfff0d0, 0xd8b884, j / 25, X, Y, 4);
    if (i % 25 === 0) c = mul(c, 0.94);
    return jit(c, X, Y, 37, 0.03);
  });
  // LED-list i taket
  P.hl(x0 + 2, top + 3, w - 4, 0xfffae8);
  for (let x = x0 + 3; x < x1 - 3; x += 3) P.px(x, top + 3, 0xffffff);
  // glashyllan (övre) och botten med spetsunderlägg
  P.hl(x0 + 2, 68, w - 4, 0xeafcff); P.hl(x0 + 2, 69, w - 4, 0x9ac0c8); P.darken(x0 + 2, 70, w - 4, 1, 0.9);
  P.hl(x0 + 2, 81, w - 4, 0xf4f0e8);
  for (const cx of MON_COLS) for (const dx of [-6, 6]) for (const yy of [67, 80]) {
    for (let i = -5; i <= 5; i++) P.px(cx + dx + i, yy + 1, (i + yy) % 2 ? 0xffffff : 0xe8e0d0);
  }
  // facklister mellan sorterna
  for (const sx of [33, 58]) { P.vl(sx, top + 4, 26, 0xe8d8b8, 0.6); }
  // mässingsstolpar och topp i trä
  for (const [px, cs] of [[x0, [0xfff0a8, 0xb08a34]], [x1 - 2, [0xd4b050, 0x7a5c1e]]]) { P.vl(px, top, 31, cs[0]); P.vl(px + 1, top, 31, cs[1]); }
  area(P, x0 - 1, top - 1, w + 2, 4, (X, Y, i, j) => jit([0xb07a4a, 0x8a5a32, 0x6a4024, 0xc9a44a][j], X, Y, 38, 0.05));
  // sockeln med prislappar
  area(P, x0 - 1, 82, w + 2, 8, (X, Y, i, j) => (j === 0 ? 0xf0d27a : j === 1 ? 0x8a6a28 : jit(0x4a2a16, X, Y, 39, 0.08)));
  PASTRIES.forEach((p, i) => {
    const s = p.price + ':-', tw = textW(SMALL, s), tx = MON_COLS[i] - (tw >> 1);
    P.rect(tx - 2, 84, tw + 4, 7, 0xfaf6ee); P.hl(tx - 2, 90, tw + 4, 0xb8b0a0);
    text(P, SMALL, s, tx, 85, 0x3a2810);
  });
}
// montern: glasets reflexer, skjutdörrarna och deras handtag (ovanpå bakverken)
function paintGlass() {
  const P = new Pix(FW, FH);
  const { x0, x1, top } = MON;
  for (let y = top + 3; y < 82; y++) for (let x = x0 + 2; x < x1 - 2; x++) {
    const s = (((x * 2 - y * 3) % 40) + 40) % 40;
    const a = s < 3 ? 0.34 : s === 6 ? 0.18 : 0;
    if (a) P.px(x, y, 0xffffff, a);
  }
  P.hl(x0 + 2, top + 4, x1 - x0 - 4, 0xffffff, 0.35);
  // skjutdörrarnas skarv och handtag
  P.vl(46, top + 4, 27, 0xc9a44a, 0.8); P.vl(47, top + 4, 27, 0x7a5c1e, 0.5);
  for (const hx of [42, 50]) { P.rect(hx, 72, 2, 4, 0xf0d27a); P.vl(hx + 1, 73, 3, 0x8a6a28); }
  return P.flush();
}
function paintKassa(P, x) {
  // en gammal kassaapparat i mässing: sifferflaggor, tangenter, låda och vev
  const w = 18;
  area(P, x + 3, 70, w - 6, 6, (X, Y, i, j) => (i === 0 || j === 0 || i === w - 7 ? 0x7a5c1e : 0x2a1e14));
  P.rect(x + 5, 71, 4, 4, 0xfaf6ee); P.rect(x + 10, 71, 4, 4, 0xfaf6ee);
  text(P, SMALL, '3', x + 5, 71, 0xd9433b); text(P, SMALL, '5', x + 10, 71, 0xd9433b);
  P.rect(x + 5, 70, 4, 1, 0xfaf6ee); P.rect(x + 10, 70, 4, 1, 0xfaf6ee);
  area(P, x, 76, w, 9, (X, Y, i, j) => {
    const c = BRASS[clamp(Math.floor(i / w * 4 + j * 0.12), 0, 4)];
    return (i + j) % 5 === 0 && j > 5 ? mul(c, 0.82) : c;
  });
  P.hl(x, 76, w, 0xfff0a8); P.vl(x, 77, 8, 0xfff0a8);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
    const kx = x + 2 + k * 3 + (r & 1), ky = 77 + r * 2;
    P.px(kx, ky, r === 2 && k === 4 ? 0xd9433b : 0xf4f1ea); P.px(kx + 1, ky, 0x3a2810);
  }
  area(P, x - 1, 85, w + 2, 5, (X, Y, i, j) => (j === 0 ? 0xfff0a8 : j === 4 ? 0x5a4214 : BRASS[clamp(2 + (j >> 1), 0, 4)]));
  P.px(x + 9, 87, 0x2a1e14);
  // veven
  P.vl(x + w, 78, 5, 0x8a6a28); P.hl(x + w, 78, 3, 0xd4b050); P.px(x + w + 2, 77, 0x2a1e14); P.px(x + w + 2, 76, 0x2a1e14);
}
function paintMachine(P) {
  const X0 = MAC.x0, X1 = MAC.x1, SP = 12, IN0 = X0 + SP, IN1 = X1 - SP;
  // mörk kontur runt hela maskinen
  P.rect(X0 - 1, 51, X1 - X0 + 2, 39, 0x1a1618);
  // ---- sidopaneler i blankt stål (med rummets varma spegling) ----
  for (const sx of [X0, IN1]) area(P, sx, 54, SP, 34, (X, Y, i, j) => {
    let c = CHROME[i];
    if (j === 0) c = mix(c, WHITE, 0.5);
    if (j >= 12 && j <= 15) c = mix(c, j === 12 || j === 15 ? 0x9a5a3a : 0xd89a58, 0.3);
    if (j > 29) c = mul(c, 0.82);
    return c;
  });
  // ---- överdelen i grön emalj med guldlinje ----
  area(P, IN0, 54, IN1 - IN0, 11, (X, Y, i, j) => {
    let c = qmix(0x437e62, 0x24483a, j / 10, X, Y, 3);
    if (j === 0) c = 0x7ab494;
    else if (j === 1) c = mix(c, WHITE, 0.14);
    return jit(c, X, Y, 51, 0.04);
  });
  P.hl(IN0 + 2, 56, IN1 - IN0 - 4, 0xc9a44a); P.hl(IN0 + 2, 64, IN1 - IN0 - 4, 0x8a6a28);
  P.hl(IN0, 65, IN1 - IN0, 0x121c16);
  for (const m of MANO) gauge(P, m.x, m.y);
  // emblem mellan manometrarna: en gyllene böna
  glyph(P, ['.##.', '#.##', '##.#', '.##.'], 264, 57, 0xf0d27a);
  P.px(265, 58, 0x8a6a28); P.px(266, 59, 0x8a6a28);
  // ---- topplattan med koppvärmare: räcke och uppochnedvända koppar ----
  P.hl(X0 + 1, 52, X1 - X0 - 2, 0xf6fafc); P.hl(X0, 53, X1 - X0, 0x6a747e);
  P.hl(X0 + 2, 47, X1 - X0 - 4, 0xeef3f6); P.hl(X0 + 2, 48, X1 - X0 - 4, 0x8e98a4);
  for (const px of [X0 + 2, X0 + 36, X0 + 70, X1 - 3]) { P.vl(px, 47, 5, 0xb4bec8); P.px(px, 47, 0xffffff); }
  for (let i = 0; i < 8; i++) {
    const cx = X0 + 9 + i * 12 + (i > 2 ? 2 : 0) - (i > 5 ? 2 : 0);
    if (cx > X1 - 8) break;
    const c = i % 3 === 1 ? 0x4f8468 : 0xf4f1ea, sh = mul(c, 0.75);
    P.hl(cx - 1, 49, 3, mix(c, WHITE, 0.3)); P.hl(cx - 2, 50, 5, c); P.hl(cx - 3, 51, 7, c);
    P.px(cx + 1, 49, sh); P.px(cx + 2, 50, sh); P.px(cx + 3, 51, sh); P.px(cx - 3, 51, mix(c, WHITE, 0.4));
  }
  // ångkranarnas vred
  for (const kx of [229, WAND.x + 1]) { P.rect(kx - 1, 49, 3, 3, 0x1e1a1c); P.px(kx - 1, 49, 0x5a5058); P.hl(kx - 1, 52, 3, 0x8e98a4); }
  // ---- nischen där kopparna står (mörk borstad stålvägg) ----
  area(P, IN0, 66, IN1 - IN0, 19, (X, Y, i, j) => {
    let c = qmix(0x4a525c, 0x22262c, j / 18, X, Y, 3);
    if (hash(X, 0, 52) > 0.8) c = mix(c, 0x8e98a4, 0.2);
    return c;
  });
  // bryggrupperna med portafilter
  for (const g of GROUPS) {
    const gx = g.x;
    P.hl(gx - 4, 66, 9, 0x2a2e34);
    area(P, gx - 6, 67, 13, 2, (X, Y, i) => chromeAt(i, 13));
    P.hl(gx - 5, 69, 11, 0x1a1618);
    area(P, gx - 4, 70, 9, 2, (X, Y, i) => chromeAt(i, 9));
    P.rect(gx - 1, 71, 3, 3, 0x1a1414); P.px(gx - 1, 71, 0x5a4e52); P.px(gx, 72, 0x3a3034);
    P.px(gx - 3, 72, 0xb4bec8); P.px(gx + 3, 72, 0xb4bec8);
    // portafiltrets handtag i svart bakelit, snett ut mot oss (utåt från mitten)
    const s = gx < (MAC.x0 + MAC.x1) / 2 ? -1 : 1;
    P.px(gx + s * 5, 70, 0xdce4ea); P.px(gx + s * 5, 71, 0x6a747e);          // krage
    for (let i = 0; i < 6; i++) {
      const hx = gx + s * (6 + i), hy = 71 + (i >> 1);
      P.px(hx, hy, i < 1 ? 0x4a525c : 0x2a2226);
      P.px(hx, hy + 1, 0x0e0a0c);
      if (i > 0 && i < 5) P.px(hx, hy, i === 2 ? 0x6a5e64 : 0x3a3034);     // glans på ovansidan
    }
    P.px(gx + s * 12, 74, 0x3a3034); P.px(gx + s * 12, 75, 0x0e0a0c);
  }
  // ångröret (höger) och hetvattenpipen (vänster)
  P.rect(WAND.x - 1, 65, 3, 2, 0x4a525c);
  for (let y = 67; y <= 80; y++) { const ox = y > 74 ? 1 : 0; P.px(WAND.x + ox, y, 0xeef3f6); P.px(WAND.x + ox + 1, y, 0x7a848e); }
  P.px(WAND.x + 1, 81, 0x4a525c);
  P.rect(228, 66, 3, 2, 0x4a525c); P.vl(229, 68, 4, 0xdce4ea); P.px(230, 69, 0x7a848e); P.px(229, 72, 0x4a525c);
  // ---- droppbrickan med galler ----
  P.hl(IN0, 85, IN1 - IN0, 0xeef3f6);
  for (let x = IN0; x < IN1; x++) P.px(x, 86, x % 2 ? 0x2a2e34 : 0xb4bec8);
  P.hl(IN0, 87, IN1 - IN0, 0x6a747e);
  // ---- sockeln ----
  area(P, X0, 88, X1 - X0, 2, (X, Y, i, j) => (j === 0 ? 0x4a4e56 : 0x22262c));
  for (const fx of [X0 + 3, X1 - 6]) P.rect(fx, 89, 3, 1, 0x0e0c0e);
}
function gauge(P, cx, cy) {
  disc(P, cx, cy, 4.6, (X, Y, d, dx, dy) => {
    if (d > 3.6) return dx + dy < 0 ? 0xfff0a8 : dx + dy > 2 ? 0x8a6a28 : 0xd4b050;
    return dx + dy < -2 ? 0xffffff : 0xf2ece0;
  });
  P.px(cx + 2, cy - 2, 0xd9433b); P.px(cx + 3, cy - 1, 0xd9433b);
  for (const [dx, dy] of [[-2, 2], [-3, 0], [-2, -2], [0, -3]]) P.px(cx + dx, cy + dy, 0x6a6258);
}
function paintGrinder(P) {
  const cx = GRIND.x;
  // lock
  P.hl(cx - 4, 47, 9, 0x2a2a30); P.hl(cx - 5, 48, 11, 0x1e1e22); P.px(cx, 46, 0x1e1e22);
  P.hl(cx - 3, 47, 3, 0x6a6a74); P.px(cx - 4, 48, 0x4a4a52);
  // behållaren: rökfärgat glas fullt av bönor, smalnar av nedåt
  for (let y = 49; y <= 62; y++) {
    const hw = 8 - Math.floor(((y - 49) * 4) / 13);
    for (let x = cx - hw; x < cx + hw; x++) {
      const i = x - (cx - hw);
      let c;
      if (y === 49) c = 0x8a8078;
      else if (y < 52) c = 0x6a5a50;   // luft ovanför bönorna
      else {
        const bean = hash(x >> 1, y, 53), crease = (x + y) % 3 === 0;
        c = bean > 0.6 ? 0x7a4a26 : bean > 0.3 ? 0x5a3018 : 0x3a1e10;
        if (crease && bean > 0.3) c = mul(c, 0.6);
      }
      if (i === 0 || i === 1) c = mix(c, 0xffffff, i === 0 ? 0.45 : 0.25);
      if (i === hw * 2 - 1) c = mul(c, 0.6);
      P.px(x, y, c);
    }
  }
  // krage och kropp i svart lack med kromfront
  area(P, cx - 5, 63, 11, 2, (X, Y, i) => chromeAt(i, 11));
  area(P, cx - 6, 65, 13, 17, (X, Y, i, j) => {
    let c = i < 2 ? 0x4a4a52 : i > 10 ? 0x141416 : 0x26262c;
    if (i === 2 && j < 14) c = 0x6a6a74;
    return jit(c, X, Y, 54, 0.05);
  });
  area(P, cx - 3, 66, 7, 5, (X, Y, i) => chromeAt(i, 7));
  P.rect(cx - 2, 67, 3, 3, 0xf2ece0); P.px(cx - 1, 68, 0x2a2018); P.px(cx, 67, 0x2a2018);   // ratten
  // pipen, gaffeln och portafiltret (dosen ritas ovanpå när det är malet)
  P.rect(cx - 1, 71, 3, 2, 0x4a525c);
  P.rect(cx - 5, 74, 11, 1, 0x8e98a4);
  area(P, cx - 4, 76, 9, 2, (X, Y, i) => chromeAt(i, 9));
  P.rect(cx + 5, 76, 4, 2, 0x1a1414); P.px(cx + 5, 76, 0x5a4e52);
  // spilltråg och fot
  P.rect(cx - 5, 79, 11, 2, 0x1e1e22); P.hl(cx - 5, 79, 11, 0x4a4a52);
  area(P, cx - 7, 81, 15, 9, (X, Y, i, j) => (j === 0 ? 0xc4ccd4 : j === 1 ? 0x6a747e : jit(i < 2 ? 0x3a3a42 : 0x22222a, X, Y, 55, 0.05)));
  // kontur
  P.vl(cx - 8, 81, 9, 0x0e0c0e); P.vl(cx + 8, 81, 9, 0x0e0c0e);
}
function paintCakeDome(P, cx) {
  // fot, stam och tårtfat
  P.rect(cx - 6, 88, 13, 2, 0xe8e2d6); P.hl(cx - 6, 89, 13, 0xaea493);
  P.rect(cx - 1, 84, 3, 4, 0xdcd6ca); P.vl(cx + 1, 84, 4, 0xaea493);
  P.hl(cx - 9, 82, 19, 0xffffff); P.hl(cx - 9, 83, 19, 0xcac2b2);
  // prinsesstårtan: grön kupa med florsocker och en rosa ros
  for (let y = 72; y <= 81; y++) {
    const dy = (81 - y) / 9.5, hw = Math.round(8 * Math.sqrt(Math.max(0, 1 - dy * dy)));
    for (let x = cx - hw; x <= cx + hw; x++) {
      const l = (cx - x) / 8 + (78 - y) / 6;
      let c = l > 0.7 ? 0xd8f2c0 : l > -0.2 ? 0xa6d886 : 0x6ea85a;
      if (hash(x, y, 56) > 0.86) c = 0xffffff;
      if (y === 81) c = 0xf4ecde;
      P.px(x, y, c);
    }
  }
  P.rect(cx - 1, 69, 3, 3, 0xf890c0); P.px(cx, 70, 0xc8407a); P.px(cx - 1, 69, 0xffb8d8); P.px(cx - 2, 71, 0x2e6e30); P.px(cx + 2, 71, 0x2e6e30);
  // glaskupan
  for (let y = 60; y <= 81; y++) {
    const dy = (81 - y) / 21, hw = Math.round(10 * Math.sqrt(Math.max(0, 1 - dy * dy * dy * dy)));
    P.px(cx - hw, y, 0xe8f6fa, 0.75); P.px(cx + hw, y, 0x9ab8c4, 0.75);
    if (y < 66) for (let x = cx - hw + 1; x < cx + hw; x++) P.px(x, y, 0xeaf8fc, y === 60 ? 0.8 : 0.18);
    if (y > 62 && y < 74) P.px(cx - hw + 2, y, 0xffffff, 0.55);
  }
  P.rect(cx - 1, 57, 3, 3, 0xf0d27a); P.px(cx - 1, 57, 0xfff0a8); P.px(cx + 1, 59, 0x8a6a28);
}

// Bakbänken längst fram: diskho, radio, sirapsflaskor, kakaostationen,
// nybakade bullar, mjölkkannor för lattekonst. Ritas ovanpå baristan.
function paintBench() {
  const P = new Pix(FW, FH);
  const T = BENCH.top, F = BENCH.face;
  // ---- skivan i ljus ek (stavlimmad) ----
  area(P, 0, T, FW, F - T, (X, Y, i, j) => {
    if (j === 0) return 0x4a2c12;
    const s = (X / 4) | 0;
    let c = [0xc8904e, 0xb87e40, 0xd49c5a, 0xbe8646][(hash(s, 0, 81) * 4) | 0];
    if (X % 4 === 0) c = mul(c, 0.86);
    c = mix(c, 0x6a4020, (1 - j / (F - T)) * 0.18);
    if (j === F - T - 2) c = 0xf0c888;
    if (j === F - T - 1) c = 0x8a5628;
    return jit(c, X, Y, 82, 0.06);
  });
  // ---- fronten: grönmålade paneler med mässingsknoppar ----
  rows(P, 0, F, FW, [0x120a06]);
  area(P, 0, F + 1, FW, 13, (X, Y) => jit(0x2f5b46, X, Y, 83, 0.05));
  for (let x = 2; x < FW - 20; x += 48) cabinetDoor(P, x, F + 2, 44, 11, (x / 48) % 2 ? 'l' : 'r');
  rows(P, 0, 212, FW, [0x5a9474, 0x1c3a2c, 0x12261c, 0x0a140e]);
  // ---- diskhon med svanhalskran ----
  area(P, 14, T + 3, 40, 11, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0x6a747e;
    if (i === 39 || j === 10) return 0xeef3f6;
    let c = qmix(0x5a646e, 0xaab4be, j / 9, X, Y, 3);
    if ((i === 19 || i === 20) && j === 8) c = 0x22262c;
    return c;
  });
  P.hl(15, T + 4, 38, 0x3a4048);
  for (let y = 166; y < T + 4; y++) { P.px(46, y, 0xeef3f6); P.px(47, y, 0x7a848e); }
  for (let x = 38; x <= 47; x++) { const yy = 165 - (x > 41 && x < 45 ? 1 : 0); P.px(x, yy, 0xeef3f6); P.px(x, yy + 1, 0x8e98a4); }
  P.vl(38, 166, 3, 0xdce4ea); P.px(38, 169, 0x4a525c);
  P.rect(49, T + 1, 2, 3, 0xc4ccd4); P.hl(49, T - 1, 5, 0xeef3f6); P.hl(49, T, 5, 0x6a747e);
  // disktrasa
  P.rect(8, T + 6, 5, 4, 0x6ab0e0); P.hl(8, T + 6, 5, 0x9ad0f4); P.px(9, T + 8, 0xffffff);
  // diskställ med koppar och ett fat
  for (let x = 58; x < 78; x += 3) P.vl(x, T - 2, 8, 0xb4bec8);
  P.hl(57, T + 5, 22, 0x8e98a4);
  P.rect(60, T - 4, 6, 5, 0xf4f1ea); P.vl(65, T - 3, 4, 0xc6bdac); P.hl(60, T - 4, 6, 0xffffff);
  P.rect(68, T - 3, 6, 4, 0x4f8468); P.vl(73, T - 2, 3, 0x2f5b46);
  P.rect(75, T - 8, 2, 11, 0xf4f1ea); P.vl(76, T - 7, 10, 0xc6bdac);
  // ---- radion ----
  const rx = RADIO.x - 9, ry = RADIO.y + 1;
  P.line(rx + 15, ry, rx + 21, ry - 10, 0xc4ccd4); P.px(rx + 21, ry - 11, 0x1e1e22);
  area(P, rx, ry, 19, 12, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0xfff4dc;
    if (i === 18 || j === 11) return 0xa8987a;
    return jit(j < 2 ? 0xd9433b : 0xefe2c6, X, Y, 84, 0.04);
  });
  disc(P, rx + 6, ry + 7, 3.3, (X, Y, d) => ((X + Y) % 2 ? 0x3a2a20 : 0x7a6a58));
  P.rect(rx + 11, ry + 4, 6, 3, 0xfff0b0); P.box(rx + 11, ry + 4, 6, 3, 0x8a6a28); P.vl(rx + 13, ry + 4, 3, 0xd9433b);
  P.px(rx + 12, ry + 9, 0x2a2018); P.px(rx + 15, ry + 9, 0x2a2018);
  // ---- sirapsflaskor med pumpar ----
  [[106, 0xf0d890], [112, 0xd08a2a], [118, 0x8a4a1a], [124, 0xb87840]].forEach(([bx, c], i) => {
    P.rect(bx, T - 10, 5, 12, c); P.vl(bx, T - 10, 12, mix(c, WHITE, 0.45)); P.vl(bx + 4, T - 9, 11, mul(c, 0.65));
    P.rect(bx, T - 6, 5, 3, 0xfaf6ee); P.px(bx + 2, T - 5, [0xd9433b, 0x2f8f46, 0x3a7bd5, 0xc9a44a][i]);
    P.rect(bx + 1, T - 12, 3, 2, c); P.vl(bx + 2, T - 16, 4, 0x1e1e22); P.hl(bx + 2, T - 16, 3, 0x1e1e22); P.px(bx + 4, T - 15, 0x1e1e22);
  });
  // ---- burk med skorpor ----
  P.rect(133, T - 9, 14, 11, 0xdcf0f6); P.vl(133, T - 9, 11, 0xffffff); P.vl(146, T - 8, 10, 0x8ab0bc);
  for (let k = 0; k < 4; k++) { P.rect(135 + (k % 2) * 5, T - 7 + k * 2, 5, 2, 0xd8a868); P.hl(135 + (k % 2) * 5, T - 7 + k * 2, 5, 0xf0c888); }
  P.rect(132, T - 11, 16, 2, 0xc9a44a); P.hl(132, T - 11, 16, 0xfff0a8); P.px(139, T - 12, 0x8a6a28); P.px(140, T - 12, 0x8a6a28);
  // ---- kakaostationen: kakaoburk med skopa och visp till vänster om baristan,
  // stapeln med röda muggar till höger – hen står mitt emellan ----
  P.rect(150, T - 11, 9, 13, 0x6a3a1e); P.vl(150, T - 11, 13, 0x9a5a34); P.vl(158, T - 10, 12, 0x3a1e0e);
  P.rect(150, T - 7, 9, 5, 0xf0d27a); P.hl(150, T - 7, 9, 0xfff0a8); P.hl(150, T - 3, 9, 0x8a6a28);
  P.px(152, T - 5, 0x6a3a1e); P.px(154, T - 5, 0x6a3a1e); P.px(156, T - 5, 0x6a3a1e);
  P.hl(149, T - 12, 11, 0xc9a44a); P.hl(149, T - 11, 11, 0x8a6a28);
  P.vl(156, T - 17, 5, 0xc4ccd4); P.rect(155, T - 18, 3, 2, 0xeef3f6);
  P.vl(162, T - 10, 10, 0x8e98a4); for (let k = 0; k < 4; k++) P.px(161 + (k % 3), T - 13 + k, 0xdce4ea);
  for (let k = 0; k < 3; k++) {
    const my = T - 1 - k * 5;
    P.rect(183, my - 4, 8, 5, 0xcf3a3a); P.vl(183, my - 4, 5, 0xf07a6e); P.vl(190, my - 3, 4, 0x8e1c22);
    P.hl(183, my - 4, 8, 0xf4f1ea); P.px(191, my - 3, 0xa8262c); P.px(192, my - 2, 0xa8262c); P.px(191, my - 1, 0xa8262c);
    P.px(185 + k, my - 2, 0xfff4ea); P.px(188 - k, my - 1, 0xfff4ea);
  }
  // ---- krukväxt (pothos som hänger ner över kanten) ----
  P.rect(199, T - 6, 11, 8, 0xb86a44); P.hl(199, T - 6, 11, 0xd88a5c); P.vl(209, T - 5, 7, 0x7a3a22); P.hl(198, T - 7, 13, 0xe8a070);
  leaves(P, 204, T - 12, 7, 6, 91, 0x2a5a26, 0x4a8a3a, 0x7cc05a, 0.6);
  for (let i = 0; i < 9; i++) leaves(P, 198 + (i % 3) * 5 + ((i * 3) % 4), T + 3 + i * 2, 2.2, 1.6, 400 + i, 0x2a5a26, 0x4a8a3a, 0x7cc05a, 0.7);
  // ---- bakplåt med nybakade kanelbullar på bakplåtspapper ----
  P.rect(214, T + 1, 50, 12, 0x6a6a72); P.hl(214, T + 1, 50, 0xb4b4bc); P.hl(214, T + 12, 50, 0x2a2a30);
  P.rect(216, T + 2, 46, 10, 0xf4ecd8); P.hl(216, T + 2, 46, 0xfffaf0);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) {
    const bx = 218 + k * 9 + (r ? 4 : 0), by = T + 3 + r * 4;
    if (bx > 255) continue;
    P.rect(bx, by, 7, 4, 0xd88e3e); P.hl(bx + 1, by, 5, 0xf4bc6a); P.hl(bx, by + 3, 7, 0xa8602a);
    P.px(bx + 2, by + 1, 0x7a3814); P.px(bx + 4, by + 2, 0x7a3814); P.px(bx + 3, by + 1, 0xfffaf0); P.px(bx + 5, by + 1, 0xfffaf0);
  }
  // ---- lattekonst-stationen: mjölkkannor, termometer, en övningskopp ----
  for (const [kx, tall] of [[278, 9], [300, 7]]) {
    area(P, kx, T + 1 - tall, 7, tall, (X, Y, i) => chromeAt(i, 7));
    P.hl(kx, T + 1 - tall, 7, 0xffffff); P.px(kx + 7, T + 2 - tall, 0x8e98a4); P.px(kx + 7, T + 3 - tall, 0x6a747e);
    P.px(kx - 1, T + 3 - tall, 0xc4ccd4); P.px(kx - 1, T + 4 - tall, 0xc4ccd4);
  }
  P.vl(283, T - 14, 7, 0xdce4ea);
  disc(P, 283, T - 15, 1.6, () => 0xf2ece0);
  P.px(283, T - 15, 0xd9433b);
  P.rect(306, T + 2, 9, 5, 0xf4f1ea); P.hl(306, T + 2, 9, 0xffffff); P.hl(306, T + 6, 9, 0xd8d0c0);   // vikt handduk
  P.hl(306, T + 4, 9, 0x6ab0e0);
  // ---- papperspåsar och tallriksstapel ----
  for (let k = 0; k < 5; k++) { P.hl(330, T + 8 - k * 2, 17, k % 2 ? 0xdcd6ca : 0xf4f1ea); P.hl(331, T + 7 - k * 2, 15, 0xffffff); }
  for (let k = 0; k < 3; k++) {
    const bx = 354 + k * 9;
    P.rect(bx, T - 8 + k, 8, 11 - k, 0xc89a6a); P.vl(bx, T - 8 + k, 11 - k, 0xe0b888); P.vl(bx + 7, T - 7 + k, 10 - k, 0x8a5a30);
    P.hl(bx, T - 8 + k, 8, 0xa87a48); P.rect(bx + 2, T - 4 + k, 4, 3, 0x2f5b46); P.px(bx + 3, T - 3 + k, 0xf0d27a);
  }
  // ---- stationernas mässingsbrickor ----
  brassPlate(P, DISK_X, F + 3, 'DISK', 'disk');
  brassPlate(P, KAKAO_X, F + 3, 'KAKAO', 'kakao');
  brassPlate(P, KONST_X, F + 3, 'KONST', 'konst');
  return P.flush();
}
// mjölkbackar med paket (hinder uppe till vänster)
function paintCrates() {
  const P = new Pix(24, 26);
  for (const [oy, c] of [[14, 0x2c6fb7], [3, 0x2f8f46]]) {
    area(P, 0, oy, 24, 11, (X, Y, i, j) => {
      if (j === 0) return mix(c, WHITE, 0.35);
      if (i === 0 || i === 23 || j === 10) return mul(c, 0.55);
      if (j > 2 && j < 9 && i % 4 === 2 && j % 3 !== 0) return mul(c, 0.4);
      return jit(c, X, Y, 92, 0.06);
    });
  }
  for (let k = 0; k < 4; k++) { const mx = 2 + k * 5; P.rect(mx, 0, 4, 4, 0xf4f1ea); P.hl(mx, 0, 4, 0xffffff); P.rect(mx, 2, 4, 1, 0x2c6fb7); P.px(mx + 1, 0, 0xdcd6ca); }
  return P.flush();
}
// bagarens rullvagn med plåtar: bullar, kladdkakor, prinsessbakelser och en
// tom plåt (hinder mitt på golvet – härifrån fylls montern på)
function paintRack() {
  const W = 26, H = 44, P = new Pix(W, H);
  P.ell(13, H - 3, 13, 3, 0x1a0e06, 0.45);                    // skugga på golvet
  const post = (x) => area(P, x, 2, 2, 36, (X, Y, i, j) => (i === 0 ? (j % 7 === 0 ? 0xffffff : 0xdce4ea) : 0x6a747e));
  post(1); post(23);
  area(P, 0, 0, W, 3, (X, Y, i, j) => (j === 0 ? 0xffffff : j === 1 ? chromeAt(i, W) : 0x4a525c));
  const shelf = (y, goods) => {
    // plåten: mörk kant fram, bakplåtspapper, varorna ovanpå
    P.hl(3, y - 1, 20, 0xf4ecd8); P.hl(3, y - 2, 20, 0xfffaf0, 0.6);
    area(P, 2, y, 22, 2, (X, Y, i, j) => (j === 0 ? chromeAt(i, 22) : 0x2a2a30));
    goods(y - 1);
  };
  shelf(10, (b) => { for (let k = 0; k < 3; k++) { const x = 4 + k * 6; P.rect(x, b - 3, 5, 3, 0xd88e3e); P.hl(x + 1, b - 3, 3, 0xf4bc6a); P.px(x + 2, b - 2, 0x7a3814); P.px(x + 3, b - 2, 0xfffaf0); P.hl(x, b - 1, 5, 0xa8602a); } });
  shelf(19, (b) => { for (let k = 0; k < 3; k++) { const x = 4 + k * 6; P.rect(x, b - 3, 5, 3, 0x5a2e1a); P.hl(x, b - 3, 5, 0xefe6e0); P.px(x + 1, b - 3, 0xd0c4bc); P.px(x + 3, b - 4, 0xd8304a); P.hl(x, b - 1, 5, 0x3a1a0c); } });
  shelf(28, (b) => { for (let k = 0; k < 3; k++) { const x = 4 + k * 6; P.hl(x + 1, b - 4, 3, 0xd8f2c0); P.rect(x, b - 3, 5, 2, 0xa6d886); P.px(x, b - 3, 0xd8f2c0); P.px(x + 4, b - 2, 0x6ea85a); P.px(x + 2, b - 5, 0xf890c0); P.hl(x, b - 1, 5, 0xf4ecde); } });
  shelf(37, () => { P.px(8, 35, 0xd8a868); P.px(15, 35, 0xd8a868); P.px(16, 35, 0xa8602a); });   // bara smulor kvar
  // hjulen
  for (const wx of [1, 21]) { P.rect(wx, 39, 4, 1, 0x8e98a4); P.rect(wx, 40, 4, 3, 0x1e1e22); P.px(wx + 1, 41, 0x6a6a74); P.px(wx + 2, 40, 0x4a4a52); }
  return P.flush();
}
// moppen i sin gula hink (hinder nere till höger)
function paintBucket() {
  const P = new Pix(22, 40);
  P.line(15, 0, 9, 25, 0xb07a48); P.line(16, 0, 10, 25, 0x7a4a26);
  area(P, 1, 26, 20, 11, (X, Y, i, j) => {
    if (j === 0) return 0xfff08a;
    if (j === 1) return 0x6a5a10;
    const c = i < 3 ? 0xfff08a : i > 16 ? 0xc0a020 : 0xf0d030;
    return jit(c, X, Y, 93, 0.05);
  });
  for (let x = 3; x < 19; x++) P.px(x, 27, (x % 3) ? 0xd8e8f0 : 0x9ab8c8);
  P.rect(8, 24, 6, 3, 0xe8e0d0); P.px(9, 25, 0xc8c0b0);
  P.rect(2, 37, 3, 3, 0x1e1e22); P.rect(17, 37, 3, 3, 0x1e1e22); P.px(3, 38, 0x6a6a74); P.px(18, 38, 0x6a6a74);
  text(P, SMALL, 'OBS', 6, 30, 0x3a2e08);
  return P.flush();
}

// förhandsvisning av alla sprites (för utvecklingen: _debug.sheet())
function spriteSheet() {
  const c = newCanvas(200, 40), x2 = c.getContext('2d');
  x2.fillStyle = '#f4f1ea'; x2.fillRect(0, 0, 200, 40);
  let x = 2;
  for (const k of Object.keys(CUPS)) { const s = cupSprite(k); x2.drawImage(s, x, 18 - s.height); x += s.width + 3; }
  x = 2;
  for (let k = 0; k < 3; k++) { const s = pastrySprite(k); x2.drawImage(s, x, 36 - s.height); x += s.width + 3; }
  for (let k = 0; k < 3; k++) { const s = platedPastry(k); x2.drawImage(s, x, 38 - s.height); x += s.width + 3; }
  return c.toDataURL('image/png');
}
