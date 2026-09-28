// KAFÉ – det mysiga kaféet på Pixelgatan (samma hus som fasaden med den randiga
// markisen). Kaféet är 640 px brett (kameran följer figuren) och har tre delar:
//
//   FÖNSTERSIDAN (vänster): skyltfönster ut mot gatan – markisens kappa, parken
//     på andra sidan, bilar och folk som går förbi (grått och blankt när det
//     regnar) – med en bardisk och barstolar, glasdörren ut (med ringklocka),
//     klädhängare, paraplyställ, en barnvagn och trottoarprataren med DAGENS.
//   DISKEN (mitten): marmordisk med glasmonter full av bakverk (kanelbullar,
//     prinsesstårta, kladdkaka, mazariner, semlor, chokladbollar), kassaapparat,
//     griffeltavla med menyn, espressomaskin med ånga, bryggare, kvarn, hyllor
//     och en radio som spelar. Baristan jobbar bakom disken. Framför: trasmatta.
//   SOFFHÖRNAN (höger): röd sammetssoffa längs väggen, tavlor, vägglampor,
//     kakelugn, påtår-bordet, tidningar på pelaren, golvlampa, en persisk matta,
//     kafékatten Kanel på soffan och farmors tax Sixten på mattan.
//
// Mekanik: klick på disken → menyn (7 fikor, bl.a. latten för 35 kr som skylten ute lovar) → köp: pengarna dras, mättnad och
// energi höjs (koffeinet biter sämre för varje kopp samma dag), klockan går en
// kvart och spelet sparas. Baristan gör i ordning fikat, figuren bär brickan
// till ett ledigt bord (klick på ett annat bord under tiden styr om dit), sätter
// sig och äter en stund. Gäster kommer och går.
// Påtår (+3 energi) ingår en gång per besök när man har köpt något.
//
// Allt statiskt målas pixel för pixel med Pix-pennan EN gång (per dag/natt) –
// det som rör sig (folk, ånga, klocka, dörr, trafik, ljus) ritas varje bildruta.
import { Pix, SMALL, BIG, text, textW, eachTextPixel, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, nameTag, emoteBubble, iconBubble, sayBubble, createSpeech } from './walkable.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';

const talk = createSpeech(); // repliker och beskrivningar som pratbubblor i scenen

// ======================= menyn =======================
// fill = mättnad, energy = energi (för första koppen i dag), cake/cup = vad som ritas.
export const KAFE_MENY = [
  { id: 'bulle', icon: '🥐', name: 'Kanelbulle & bryggkaffe', board: 'KANELBULLE', price: 30, fill: 14, energy: 12, cake: 'bulle', cup: 'kaffe' },
  { id: 'mazarin', icon: '🥧', name: 'Mazarin & caffè latte', board: 'MAZARIN', price: 40, fill: 16, energy: 16, cake: 'mazarin', cup: 'latte' },
  { id: 'kladd', icon: '🍫', name: 'Kladdkaka & cappuccino', board: 'KLADDKAKA', price: 45, fill: 22, energy: 16, cake: 'kladd', cup: 'capp' },
  { id: 'semla', icon: '🍥', name: 'Semla & varm choklad', board: 'SEMLA', price: 50, fill: 30, energy: 8, cake: 'semla', cup: 'choklad' },
  { id: 'prinsess', icon: '🎂', name: 'Prinsesstårta & te', board: 'PRINSESSTÅRTA', price: 60, fill: 34, energy: 10, cake: 'prinsess', cup: 'te' },
  { id: 'espresso', icon: '☕', name: 'Dubbel espresso', board: 'ESPRESSO', price: 25, fill: 2, energy: 24, cake: null, cup: 'espresso' },
  // samma latte som trottoarprataren ute på gatan lovar (LATTE 35:-)
  { id: 'latte', icon: '🥛', name: 'Caffè latte & pepparkaka', board: 'LATTE', price: 35, fill: 6, energy: 18, cake: null, cup: 'latte' },
];
const KICK = [1, 0.75, 0.5, 0.3, 0.15];           // koffeinets verkan: kopp 1, 2, 3 … samma dag
const CAF_KEY = 'snabbfilen_kafe';
function cupsToday(g) {
  try { const s = JSON.parse(localStorage.getItem(CAF_KEY) || 'null'); return s && s.day === g.day ? Math.max(0, s.n | 0) : 0; } catch { return 0; }
}
function addCup(g) { try { localStorage.setItem(CAF_KEY, JSON.stringify({ day: g.day, n: cupsToday(g) + 1 })); } catch { /* ok */ } }
const energyOf = (m, n) => Math.round(m.energy * KICK[Math.min(n, KICK.length - 1)]);
const dagensOf = (g) => ((g.day | 0) * 3 + 1) % 5;   // dagens fika (aldrig espresson) – 5 kr billigare
const priceOf = (g, i) => KAFE_MENY[i].price - (i === dagensOf(g) ? 5 : 0);
const HOT = { kaffe: 1, latte: 1, capp: 1, choklad: 1, te: 1, espresso: 1 };

// ======================= mått (världskoordinater) =======================
const VW = 384, W = 640, H = 216;
const WALL_Y = 82;                              // där golvet möter bakväggen
const CEIL = 7;                                 // taklistens underkant
const WAIN = 50;                                // bröstpanelens överkant
const DOOR = { x0: 96, x1: 124, top: 26 };      // glasdörren ut
const WINS = [{ x0: 16, x1: 88 }, { x0: 132, x1: 204 }];
const WIN_T = 18, WIN_B = 62;                   // fönsterglasets över-/underkant
const LEDGE = 62;                               // bardisken under fönstren
const BOARD = { x0: 226, x1: 299, y0: 8, y1: 64 };   // sju rader: griffeln går ner bakom brödkorgen
const BACK = { x0: 226, x1: 432, top: 66, y: 86 };   // bakdisken mot väggen
const CNT = { x0: 222, x1: 434, top: 97, face: 104, y: 118 }; // disken (golvkant y)
const CASE = { x0: 232, x1: 316 };              // glasmontern på disken
const REG = { x0: 398, x1: 420 };               // kassaapparaten
const PIL = { x0: 436, x1: 446 };               // pelaren med klockan
const BQ = { x0: 450, x1: 596, y: 100 };        // sammetssoffan
const STOVE = { x0: 602, x1: 630 };             // kakelugnen
const BARI_Y = 104;                             // baristans fötter (bakom disken)
const ORDER_Y = 127;                            // där kunderna står vid disken
const LAMPS = [309, 352, 410];                  // pendellampor över disken
const SCONCES = [486, 572];                     // vägglampor i soffhörnan
const DOOR_SPOT = [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 7];

// Borden: x = mitt, y = golvkanten framför bordet. Stolar: [dx, dy, riktning]
// 'down' = sitter bakom bordet med ansiktet mot oss, 'up' = ryggen mot oss.
const TABLES = [
  { id: 'a1', x: 54, y: 152, seats: [[-5, -5, 'down'], [7, 10, 'up']] },
  { id: 'a2', x: 166, y: 168, seats: [[-5, -5, 'down'], [7, 10, 'up']] },
  { id: 'a3', x: 60, y: 206, seats: [[-4, -5, 'down']] },
  { id: 'b1', x: 272, y: 198, seats: [[-4, -5, 'down']] },
  { id: 'b2', x: 360, y: 198, seats: [[-4, -5, 'down']] },
  { id: 'b3', x: 330, y: 160, seats: [[-5, -5, 'down'], [7, 10, 'up']] },
  { id: 'd1', x: 424, y: 194, long: true, seats: [[-10, -5, 'down'], [9, -5, 'down'], [-9, 10, 'up'], [10, 10, 'up']] },
  { id: 'c1', x: 510, y: 162, seats: [[-5, -5, 'down'], [7, 10, 'up']] },
  { id: 'c2', x: 594, y: 186, seats: [[-5, -5, 'down'], [7, 10, 'up']] },
  { id: 'q1', x: 486, y: 114, bench: true, seats: [[0, -14, 'down']] },
  { id: 'q2', x: 554, y: 114, bench: true, seats: [[0, -14, 'down']] },
];
const STOOLS = [30, 52, 74, 148, 170, 192];     // barstolar vid fönstren
const STOOL_Y = 94;
const PLANTS = [{ kind: 'fikus', x: 213, y: 104 }, { kind: 'palm', x: 150, y: 212 }, { kind: 'monstera', x: 626, y: 212 }, { kind: 'monstera', x: 12, y: 176 }];
const COAT = { x: 86, y: 97 };
const CAT = { x: 564, y: 91 };
const EASEL = { x: 194, y: 132 };               // trottoarpratare inne: DAGENS FIKA
const UMB = { x: 135, y: 99 };                  // paraplyställ vid dörren
const FLAMP = { x: 624, y: 168 };               // golvlampa i läshörnan
const STATION = { x: 446, y: 112 };             // påtår-bordet vid pelaren
const DOG = { x: 560, y: 197 };                 // taxen Sixten (farmors hund)
const PRAM = { x: 206, y: 178 };                // barnvagn parkerad vid fönsterborden
const RUNNER = { x0: 246, x1: 420, y0: 124, y1: 137 };   // trasmattan framför disken

// ======================= små målarverktyg =======================
const WHITE = 0xffffff;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const c100 = (v) => clamp(v, 0, 100);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
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
function rowsOf(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) area(P, x, y + i, w, 1, (X, Y) => jit(c, X, Y, 9 + i, 0.05)); }); }
// pixelkarta: en sträng per rad, tecknet slås upp i paletten ('.' = genomskinligt)
function spr(P, x, y, rows, pal, a = 1) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, c, a); }
  }
}
// mörk kontur runt allt som är målat i en Pix (tonad efter grannfärgen)
function outline(P, dark = 0x1e1418) {
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
// glasreflex: diagonala strimmor och ljusare överkant
function reflect(P, x, y, w, h, night, str = 1, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    const s = ((((X + seed) * 2 - Y * 3) % 56) + 56) % 56;
    let a = s < 4 ? 0.24 : s < 6 ? 0.1 : s === 11 || s === 12 ? 0.09 : 0;
    a += (1 - j / h) * 0.06;
    if (a > 0) P.px(X, Y, night ? 0xffd8a0 : 0xf2f8ff, a * str * (night ? 0.35 : 1));
  }
}
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
// text som bitmapp (valfritt spegelvänd) med kontur, skugga och högdager
function textMask(F, s, mirror = false) {
  const w = textW(F, s), pts = [];
  eachTextPixel(F, s, 0, 0, 1, (x, y) => pts.push([mirror ? w - 1 - x : x, y]));
  return { w, pts, set: new Set(pts.map(([a, b]) => a + ',' + b)) };
}
function drawText(P, M, x, y, o) {
  const has = (a, b) => M.set.has(a + ',' + b);
  if (o.shadow !== undefined) for (const [a, b] of M.pts) if (!has(a + 1, b + 1)) P.px(x + a + 1, y + b + 1, o.shadow, o.sa ?? 0.6);
  if (o.out !== undefined) for (const [a, b] of M.pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(a + dx, b + dy)) P.px(x + a + dx, y + b + dy, o.out, o.oa ?? 1);
  for (const [a, b] of M.pts) {
    let c = typeof o.fill === 'function' ? o.fill(a, b) : o.fill;
    if (o.hi !== undefined && !has(a, b - 1)) c = o.hi;
    else if (o.lo !== undefined && !has(a, b + 1)) c = o.lo;
    if (o.rough && hash(x + a, y + b, 77) > 0.86) { P.px(x + a, y + b, c, 0.45); continue; }
    P.px(x + a, y + b, c, o.a ?? 1);
  }
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function glowImg(rx, ry, c, amax, steps = 4) {
  const P = new Pix(Math.ceil(rx) * 2 + 2, Math.ceil(ry) * 2 + 2);
  P.ell(P.w / 2, P.h / 2, rx, ry, c, amax, steps);
  return P.flush();
}
// linje med hela pixlar direkt på canvasen (klockvisare m.m.)
function ctxLine(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 200; n++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const isNight = (h) => h >= 19.5 || h < 6.5;
function darkness(hour) {
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}

// ======================= bakverken (pixelkartor) =======================
const PAL = {
  bulle: { a: 0xf4c47c, b: 0xd88c46, c: 0xa85a26, d: 0x7a3a18, e: 0x5a2a12, W: 0xfffaf0 },
  semla: { S: 0xfdfbf6, s: 0xeadcc4, L: 0xd89a52, l: 0xb07034, C: 0xfffcf6, c: 0xe2d8ca, A: 0xe2c48a, B: 0xd08a44, b: 0x9a5a2a },
  mazarin: { I: 0xfbf7ef, i: 0xe0d6c8, P: 0xe8b066, p: 0xb47634, q: 0x8a5424 },
  kladd: { s: 0xf4eee6, S: 0xffffff, D: 0x5e3222, c: 0x7a4630, K: 0x3a1a10, k: 0x4e2618, b: 0x26100a, w: 0xfff6ea, W: 0xe6dac8 },
  prinsess: { R: 0xf48cb0, r: 0xc84a78, v: 0x4a8a3a, l: 0x74a84e, G: 0x9ccc6a, h: 0xc8e8a0, s: 0xeef6e4, c: 0xfff8ec, y: 0xf2d48a, j: 0xd8303a, g: 0x5a8a3c },
  boll: { k: 0x4a2416, K: 0x6e3c22, W: 0xfffaf0, w: 0xe8e0d4 },
};
const CAKE = {
  bulle: ['.aWab.', 'abccbW', 'bcaWcb', 'dcbccd', '.eeee.'],
  semla: ['..sSs..', '.sLLLs.', '.lLLLl.', 'CCCCCCC', 'cCAcCAc', '.BBBBB.', '..bbb..'],
  mazarin: ['.IIII.', 'IIIIIi', 'PpPpPp', '.qqqq.'],
  kladd: ['sDsSDs..', 'ccccccDw', 'KKkKKDWw', 'KkKKkD..', '.bbbbb..'],
  prinsess: ['..rR...', '.lGGGh.', 'lGsGGGh', 'lcccccG', 'lyyyyyG', 'ljjjjjG', '.ggggg.'],
  boll: ['.Wk.', 'kKWk', 'wkKk', '.kk.'],
};
// hela tårtor i montern
const WHOLE = {
  prinsess: ['.....rRr.....', '....lGrGh....', '..lGGsGGGGh..', '.lGGGGGGsGGh.', 'lGsGGGGGGGGGh', 'lGGGGGsGGcccc', 'lGGGGGGGGyyyy', 'lGGGGGGGGjjjj', '.gggggggggggg'],
  kladd: ['...sSsDsSs....', '.sDsSDsSDsDs..', 'sSDsDsSDsSsKKw', 'DDDDDDDDDDDKkW', 'cDDDDDDDDDDKKD', '.bbbbbbbbbbbb.'],
};
const CUPS = {
  kaffe: { m: ['.aaa..', 'akkka.', 'bbbbbh', 'bbbbh.', '.ddd..'], p: { a: 0xfbf9f4, k: 0x4a2412, b: 0xece8e0, h: 0xd4cec4, d: 0xb8b2a8 } },
  latte: { m: ['gffg', 'gffg', 'glLg', 'gmmg', '.gg.'], p: { f: 0xfbf2e2, l: 0xc08a54, L: 0xa87040, m: 0xe0c49a, g: 0xd0e4ec } },
  capp: { m: ['.aaa..', 'afHfa.', 'bbbbbh', '.bbbh.', 'sssss.'], p: { a: 0xfbf9f4, f: 0xd8ae78, H: 0xfff8ee, b: 0xece8e0, h: 0xd4cec4, s: 0xd8d2c8 } },
  choklad: { m: ['.WwW..', 'aWWWa.', 'rrrrrh', 'rrrrh.', '.RRR..'], p: { W: 0xfffcf4, w: 0x9a5a34, a: 0xf0e8e0, r: 0xc8383a, h: 0xa82a2c, R: 0x8a1e22 } },
  te: { m: ['.aaa..', 'aTTTat', 'bbbbbh', '.bbbhY', 'sssss.'], p: { a: 0xfbf9f4, T: 0xb86a28, t: 0xd8d0c0, b: 0xece8e0, h: 0xd4cec4, Y: 0xf0c040, s: 0xd8d2c8 } },
  espresso: { m: ['.ak.', '.bbh', 'ssss'], p: { a: 0xfbf9f4, k: 0x3a1a0c, b: 0xece8e0, h: 0xd4cec4, s: 0xd8d2c8 } },
};

// Ett fika på ett fat: tallrik + bakverk (stage 0 hel, 1 halväten, 2 smulor) + kopp.
// Nederkanten på rad y+8, 18 px bred.
function paintSet(P, x, y, m, stage = 0) {
  const cup = CUPS[m.cup];
  if (m.cake) {
    spr(P, x, y + 7, ['.ppppppp.', '..qqqqq..'], { p: 0xfaf8f4, q: 0xcfc8bc });
    P.px(x + 2, y + 7, 0xffffff);
    const rows = CAKE[m.cake], w = rows[0].length, h = rows.length;
    const cx = x + 4 - (w >> 1), cy = y + 8 - h;
    if (stage < 2) {
      const cut = stage === 1 ? Math.ceil(w / 2) : w;
      spr(P, cx, cy, rows.map((r) => r.slice(0, cut)), PAL[m.cake]);
    }
    if (stage >= 1) for (const [dx, dy] of [[5, 6], [7, 6], [2, 6], [6, 5]]) if (stage === 2 || dx > 4) P.px(x + dx, y + dy, stage === 2 ? 0xb88450 : 0xd09a5a);
    if (stage === 2) { P.hl(x + 1, y + 5, 5, 0xc8ccd2); P.px(x + 1, y + 4, 0xa8b0b8); } // gaffeln
  }
  if (!m.cake && m.cup === 'latte') {
    // lattet i högt glas på ett avlångt fat, med en glasyrad pepparkaka och en långsked
    spr(P, x + 1, y + 7, ['.pppppppppppp.', '..qqqqqqqqqq..'], { p: 0xfaf8f4, q: 0xcfc8bc });
    P.px(x + 3, y + 7, 0xffffff);
    const heart = ['kk.kk', 'kKkKk', 'kkWkk', '.kKk.', '..k..'];
    if (stage < 2) spr(P, x + 2, y + 2, stage === 1 ? heart.map((r) => r.slice(0, 2) + '...') : heart, { k: 0xa8581e, K: 0xd88a4a, W: 0xfaf4ea });
    if (stage >= 1) for (const [dx, dy] of [[5, 6], [3, 6], [7, 6]]) if (stage === 2 || dx > 4) P.px(x + dx, y + dy, 0xa8581e);
    P.vl(x + 12, y + 1, 3, 0xc8ccd2); P.px(x + 12, y + 1, 0xeef0f4);        // långskeden sticker upp ur glaset
  } else if (!m.cake) {
    // espresson serveras med ett glas vatten och en chokladbit på ett litet fat
    spr(P, x + 1, y + 1, ['g..g', 'gwwg', 'gWwg', 'gwwg', 'gwwg', 'gwwg', 'gwwg', '.gg.'], { g: 0xb8d0dc, w: 0xe0eef4, W: 0xffffff });
    if (stage < 2) P.hl(x + 2, y + 2, 2, 0xc8e0ea);
    spr(P, x + 12, y + 6, ['.pppp.', 'pppppp'], { p: 0xf4f0ea });
    if (stage === 0) spr(P, x + 13, y + 5, ['kK', 'kk'], { k: 0x4a2416, K: 0x7a4428 });
  }
  if (cup) {
    const cw = cup.m[0].length, ch = cup.m.length;
    const ux = m.cake ? x + 11 : m.cup === 'latte' ? x + 10 : x + 7, uy = y + 9 - ch;
    spr(P, ux, uy, cup.m, cup.p);
    if (stage === 2 && cup.p.k) P.hl(ux + 1, uy + 1, Math.max(1, cw - 3), 0xd8cfc0); // urdrucken
    if (stage === 2 && m.cup === 'latte') {                                         // tomt glas, skumrand kvar
      for (let j = 1; j < ch - 1; j++) for (let i = 1; i < cw - 1; i++) P.px(ux + i, uy + j, j === 1 ? 0xf4ecdc : 0xe6eef2);
    }
  }
}

// ======================= bakgrunden =======================
function wallpaperPx(X, Y) {
  const row = Math.floor((Y - CEIL) / 11), sy = (Y - CEIL) % 11;
  const sx = ((X + (row & 1) * 6) % 12 + 12) % 12;
  let c = 0xefdcb8;
  if (X % 12 >= 5 && X % 12 <= 7) c = 0xe7d2a8;              // smala ränder
  const dx = Math.abs(sx - 6), dy = Math.abs(sy - 5);
  if (dx + dy === 2) c = 0xd8bc8c;                           // liten lilja (romb)
  else if (dx + dy < 2) c = dx + dy === 0 ? 0xc49a5c : 0xf6e8cc;
  else if (dx === 0 && (sy === 1 || sy === 9)) c = 0xdcc294;  // stjälk
  if (Y < CEIL + 3) c = mul(c, 0.86 + (Y - CEIL) * 0.04);     // skugga under taklisten
  return jit(c, X, Y, 1, 0.05);
}
const GREEN = { hi: 0x5a9274, base: 0x2f5b46, lo: 0x1f4232, dk: 0x13291e };
const GOLD = { hi: 0xf6e0a0, base: 0xd0aa50, lo: 0x9a7630, dk: 0x6a4e1c };
const WOOD = { hi: 0x9a6440, base: 0x6e4228, lo: 0x4a2a18, dk: 0x2e1a0e };

function paintWall(P) {
  // taklist: mörk bjälke + stuckatur med tandsnitt
  const ceil = [0x2a1a12, 0x3e2618, 0x5e3c24, 0xf6ead2, 0xe2d2b2, 0xc2ae8a, 0x8a7658];
  for (let y = 0; y < CEIL; y++) area(P, 0, y, W, 1, (X, Y) => (y === 4 && X % 4 === 0 ? 0x9a8668 : y === 5 && X % 4 === 0 ? 0x6a5a44 : jit(ceil[y], X, Y, 2, 0.05)));
  // tapeten
  area(P, 0, CEIL, W, WAIN - CEIL, wallpaperPx);
  // stolslist: trä med guldkant
  rowsOf(P, 0, WAIN, W, [0xf0d890, 0xa87848, 0x7a4e2c, 0x4a2c18, GREEN.dk]);
  // bröstpanelen: gröna fyllningar med guldlinje
  const p0 = WAIN + 5, p1 = WALL_Y - 5;
  area(P, 0, p0, W, p1 - p0, (X, Y) => jit(GREEN.base, X, Y, 3, 0.05));
  for (let x = 4; x < W - 20; x += 24) {
    const w = 20, y = p0 + 3, h = p1 - p0 - 6;
    P.hl(x, y, w, GREEN.dk); P.vl(x, y, h, GREEN.dk);
    P.hl(x + 1, y + h - 1, w - 1, GREEN.hi); P.vl(x + w - 1, y + 1, h - 1, GREEN.hi);
    area(P, x + 1, y + 1, w - 2, h - 2, (X, Y, i, j) => jit(j < 2 ? mix(GREEN.base, GREEN.hi, 0.3) : GREEN.base, X, Y, 4, 0.06));
    P.box(x + 3, y + 3, w - 6, h - 6, GOLD.lo);
    P.hl(x + 3, y + 3, w - 6, GOLD.base);
  }
  // golvlist
  rowsOf(P, 0, WALL_Y - 5, W, [WOOD.hi, WOOD.base, WOOD.base, WOOD.lo, WOOD.dk]);
}

// Utsikten genom fönstren och dörren: markisens kappa, parken tvärs över, gatan,
// uteserveringen och trottoaren. Målas i en egen bild och kopieras in där det är glas.
function paintOutside(P, night, rain) {
  const O = new Pix(214, WALL_Y);
  const X0 = 0, X1 = 214;
  const sky = night ? [0x121a38, 0x1e2a50] : [0x9ccfee, 0xd6ecf6];
  area(O, X0, 0, X1 - X0, WALL_Y, (X, Y) => {
    if (Y < 36) return qmix(sky[0], sky[1], (Y - 14) / 22, X, Y, 3);
    if (Y < 39) return jit(night ? 0x16261a : (hash(X >> 1, Y, 5) > 0.5 ? 0x2e5a2a : 0x3f7a34), X, Y, 6, 0.1);   // häcken
    if (Y < 41) return jit(night ? 0x3a3a40 : 0xb2ac9e, X, Y, 7, 0.08);                                           // bortre trottoaren
    if (Y < 42) return night ? 0x4a4a50 : 0xd8d2c4;
    if (Y < 52) {                                                                                                  // gatan
      let c = jit(night ? 0x24242a : 0x4e4e56, X, Y, 8, 0.1);
      if (Y === 46 && X % 16 < 8) c = night ? 0x8a8470 : 0xe8e2c8;
      return c;
    }
    if (Y < 53) return night ? 0x6a6660 : 0xe6dece;                                                               // kantsten
    if (Y < 54) return night ? 0x3a3834 : 0x9a9486;
    // närmaste trottoaren: stenplattor
    const r = Y - 54, rowH = 5 + Math.floor(r / 10), jy = r % rowH === 0, jx = ((X + (Math.floor(r / rowH) & 1) * 6) % 13) === 0;
    let c = jx || jy ? 0x9a9488 : jit(hash(X >> 3, Y >> 2, 9) > 0.5 ? 0xc6beb0 : 0xbcb4a6, X, Y, 10, 0.08);
    if (night) c = mix(mul(c, 0.4), 0xffb070, 0.12 + clamp((Y - 60) / 40, 0, 1) * 0.25);
    return c;
  });
  // parkens träd och lyktstolpar
  const td = night ? [0x0a140e, 0x12201a, 0x1c2e22] : [0x2e6a2a, 0x4f9a3a, 0x7fc85a];
  for (let i = 0; i < 9; i++) {
    const cx = 6 + i * 25 + Math.floor(hash(i, 1, 3) * 10), cy = 26 + Math.floor(hash(i, 2, 3) * 4);
    O.rect(cx - 1, cy + 5, 2, 36 - cy - 3, night ? 0x1a1410 : 0x5a4028);
    leaves(O, cx, cy, 9 + hash(i, 3, 3) * 3, 7 + hash(i, 4, 3) * 2, 30 + i, td[0], td[1], td[2], 0.6);
  }
  for (const lx of [44, 150]) {
    O.vl(lx, 24, 16, night ? 0x1a2420 : 0x2a3a34);
    O.vl(lx + 1, 24, 16, night ? 0x10181a : 0x1a2622);
    O.rect(lx - 1, 21, 4, 3, night ? 0xffe6a0 : 0x2a3a34);
    O.hl(lx - 2, 20, 6, 0x1a2622);
    if (night) { O.ell(lx + 0.5, 23, 7, 5, 0xffd890, 0.45); O.ell(lx + 0.5, 41, 8, 2, 0xffd890, 0.3); }
  }
  // uteserveringen precis utanför: bistrobord och stolsryggar
  for (const tx of [50, 168]) {
    const c = night ? 0x141c18 : 0x24402e;
    O.hl(tx - 7, 57, 15, night ? 0x3a3a36 : 0xd8d4cc); O.hl(tx - 7, 58, 15, c);
    O.vl(tx, 59, 12, c);
    O.rect(tx - 5, 70, 11, 1, c);
    for (const sx of [tx - 12, tx + 10]) { O.vl(sx, 55, 12, c); O.vl(sx + 3, 55, 12, c); O.hl(sx, 55, 4, c); O.hl(sx, 60, 4, c); }
  }
  // gatupratarens baksida utanför dörren (syns när dörren står öppen)
  area(O, 104, 58, 10, 18, (X, Y, i, j) => (i === 0 || i === 9 ? 0x3a2416 : j === 0 ? 0x8a6a4a : jit(night ? 0x2a1c12 : 0x6a4a2e, X, Y, 11, 0.1)));
  O.hl(103, 76, 12, 0x2a1a10);
  // markisens undersida och bågkappa överst
  for (let y = 14; y < 24; y++) for (let x = X0; x < X1; x++) {
    const k = ((x + 3) % 8 + 8) % 8, s = Math.floor((x + 3) / 8) & 1, dx = Math.abs(k - 3.5);
    if (y >= 21 && dx > (y === 21 ? 3.5 : y === 22 ? 2.6 : 1.5)) continue;
    if (y === 23) continue;
    let c = s ? 0xe8dcc0 : 0xb53234;
    c = mul(c, night ? 0.28 : 0.55 + (y - 14) * 0.035);
    if (y >= 20 && !night) c = mix(c, WHITE, 0.08);
    O.px(x, y, jit(c, x, y, 12, 0.05));
  }
  // glödande ljus från kaféet på trottoaren i kväll
  if (night) for (const w of WINS) O.ell((w.x0 + w.x1) / 2, 76, (w.x1 - w.x0) / 2 + 4, 8, 0xffc27a, 0.28);
  // regnväder: gråare, mörkare, blank våt asfalt och pölar på trottoaren
  if (rain) for (let y = 14; y < WALL_Y; y++) for (let x = 0; x < 214; x++) {
    let c = O.get(x, y);
    const l = (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) | 0;
    c = mul(mix(c, mix((l << 16) | (l << 8) | l, 0x8a98a8, 0.3), 0.55), night ? 1 : 0.84);
    if (y >= 42 && y < 52 && hash(x >> 1, y, 140) > 0.9) c = mix(c, 0xc8d0d8, 0.25);
    if (y >= 54 && hash(x >> 2, y >> 1, 141) > 0.9) c = mix(c, night ? 0xffc27a : 0xd8e0e8, 0.25);
    O.px(x, y, c);
  }
  const glass =(X, Y) => WINS.some((w) => X >= w.x0 && X < w.x1 && Y >= WIN_T && Y < WIN_B) || (X >= DOOR.x0 && X < DOOR.x1 && Y >= DOOR.top && Y < WALL_Y);
  for (let y = 14; y < WALL_Y; y++) for (let x = 0; x < 214; x++) if (glass(x, y)) P.px(x, y, O.get(x, y));
}

function paintZoneA(P) {
  for (const w of WINS) {
    const x0 = w.x0 - 4, x1 = w.x1 + 4;
    // krönlist över fönstret
    rowsOf(P, x0 - 2, WIN_T - 7, x1 - x0 + 4, [0xfaf2e0, 0xe8dcc4, 0xc8b89a, 0x9a8a6c]);
    // bardisken: ekskiva med framkant och konsoler
    area(P, x0 - 2, LEDGE, x1 - x0 + 4, 3, (X, Y, i, j) => jit([0xb8845a, 0xa0703e, 0x8a5c32][j], X, Y, 13, 0.07));
    P.hl(x0 - 2, LEDGE, x1 - x0 + 4, 0xd8a878);
    rowsOf(P, x0 - 2, LEDGE + 3, x1 - x0 + 4, [0x6a4024, 0x4a2a16]);
    P.darken(x0 - 2, LEDGE + 5, x1 - x0 + 4, 2, 0.7);
    for (let bx = x0 + 6; bx < x1 - 2; bx += 22) {
      P.vl(bx, LEDGE + 5, 7, 0x2a2420); P.hl(bx - 3, LEDGE + 5, 4, 0x2a2420);
      P.line(bx - 3, LEDGE + 5, bx, LEDGE + 10, 0x2a2420); P.px(bx + 1, LEDGE + 6, 0x5a5048);
    }
  }
  // dörrens foder och överstycke
  const d0 = DOOR.x0, d1 = DOOR.x1;
  const CAS = [0xb8a888, 0xf6eedc, 0xe8dcc4, 0xa89878];
  for (let i = 0; i < 4; i++) { area(P, d0 - 4 + i, 12, 1, WALL_Y - 12, (X, Y) => jit(CAS[i], X, Y, 14, 0.04)); area(P, d1 + 3 - i, 12, 1, WALL_Y - 12, (X, Y) => jit(CAS[i], X, Y, 14, 0.04)); }
  rowsOf(P, d0 - 6, 10, d1 - d0 + 12, [0xfaf2e0, 0xe8dcc4, 0xb8a888]);
  P.hl(d0, DOOR.top - 3, d1 - d0, 0xf4ecda);
  P.hl(d0, DOOR.top - 2, d1 - d0, 0xc8b89a);
  P.hl(d0, DOOR.top - 1, d1 - d0, 0x8a7a5c);
  // överljuset (glas mot markisen) med spegelvänd guldtext FIKA
  area(P, d0, 13, d1 - d0, DOOR.top - 16, (X, Y) => qmix(0x8a3a34, 0x5a2a28, (Y - 13) / 8, X, Y, 2));
  const fika = textMask(SMALL, 'FIKA', true);
  drawText(P, fika, ((d0 + d1) >> 1) - (fika.w >> 1), 15, { fill: 0xe8c050, out: 0x3a2410, oa: 0.5 });
  // UT-skylten hänger i två kedjor från taket
  const ux = ((d0 + d1) >> 1) - 8;
  P.px(ux + 2, 7, 0x6a6a6a); P.px(ux + 14, 7, 0x6a6a6a);
  P.rect(ux, 3, 17, 8, 0x1a2a1e); P.box(ux, 3, 17, 8, 0x0e1812);
  text(P, SMALL, 'UT', ux + 5, 5, 0x6fe08a);
  P.ell(ux + 8.5, 7, 12, 6, 0x6fe08a, 0.12, 2);
  // mörk springa under dörren
  P.hl(d0, WALL_Y - 1, d1 - d0, 0x2a1e18);
}

function paintBoard(P, dag) {
  const { x0, x1, y0, y1 } = BOARD, w = x1 - x0, h = y1 - y0;
  area(P, x0, y0, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e === 0) return 0x4a2e18;
    if (e === 1) return i === 1 || j === 1 ? 0xd8a868 : 0x8a5a34;
    if (e === 2) return i === 2 || j === 2 ? 0x9a6a40 : 0x6a4424;
    // griffeln med kritsuddar
    let c = jit(0x26342c, X, Y, 35, 0.07);
    if (hash(X >> 2, Y >> 1, 36) > 0.86) c = mix(c, 0xd8e0d8, 0.1);
    if (hash(X, Y, 37) > 0.985) c = 0x4a5a50;
    return c;
  });
  P.darken(x1, y0 + 2, 2, h, 0.8); P.darken(x0 + 2, y1, w, 2, 0.8);
  // rubrik med en liten kaffekopp och hjärta
  const title = textMask(BIG, 'MENY');
  const tx = x0 + ((w - title.w) >> 1);
  drawText(P, title, tx, y0 + 3, { fill: 0xfaf6e8, rough: true });
  spr(P, tx - 10, y0 + 4, ['.w.w..', '......', 'wwwww.', 'w...ww', 'w...w.', '.www..'], { w: 0xf2d890 });
  spr(P, tx + title.w + 4, y0 + 5, ['p.p', 'ppp', '.p.'], { p: 0xf08aa8 });
  for (let x = x0 + 6; x < x1 - 6; x += 2) P.px(x, y0 + 10, (x >> 1) & 1 ? 0xe07aa0 : 0xf0a8c0, 0.8);
  // raderna: namn till vänster, pris till höger (dagens fika med gul krita och en pil)
  KAFE_MENY.forEach((m, i) => {
    const y = y0 + 12 + i * 6, isD = i === dag;
    if (isD) for (let j = -1; j < 6; j++) for (let x = x0 + 3; x < x1 - 3; x++) if (bayer(x, y + j) < 0.35) P.px(x, y + j, 0xd8e0d8, 0.1);
    const name = textMask(SMALL, m.board);
    drawText(P, name, x0 + 5, y, { fill: isD ? 0xffe070 : 0xf4f0e2, rough: true });
    const pr = String(m.price - (isD ? 5 : 0)), pm = textMask(SMALL, pr);
    drawText(P, pm, x1 - 5 - pm.w, y, { fill: isD ? 0xff9ac0 : 0xf2d890, rough: true });
    for (let x = x0 + 7 + name.w; x < x1 - 7 - pm.w; x += 2) P.px(x, y + 4, isD ? 0xffe070 : 0x8a9a90, 0.6);
    if (isD) { P.px(x0 + 3, y + 1, 0xff9ac0); P.px(x0 + 3, y + 2, 0xff9ac0); P.px(x0 + 3, y + 3, 0xff9ac0); P.px(x0 + 4, y + 2, 0xff9ac0); }
  });
  // kritlist med krita och tvättsvamp
  area(P, x0 + 3, y1, w - 6, 2, (X, Y, i, j) => (j ? 0x4a2e18 : 0x8a5a34));
  P.hl(x0 + 10, y1 - 1, 4, 0xfafafa); P.hl(x0 + 18, y1 - 1, 3, 0xf0a0c0); P.rect(x1 - 16, y1 - 2, 6, 2, 0x3a4ac0);
}

function paintZoneB(P, night, dag) {
  // kakel bakom maskinerna
  const tx0 = 300, tx1 = BACK.x1, ty0 = 32, ty1 = BACK.top;
  area(P, tx0, ty0, tx1 - tx0, ty1 - ty0, (X, Y) => {
    const r = Math.floor((Y - ty0) / 4), ry = (Y - ty0) % 4, xx = X + (r & 1) * 4, rx = xx % 8;
    if (ry === 3 || rx === 7) return jit(0xc2bcb0, X, Y, 40, 0.05);
    let c = hash(Math.floor(xx / 8), r, 41) > 0.5 ? 0xf6f2ea : 0xece8de;
    if (ry === 0) c = 0xffffff;
    if (rx === 6) c = mul(c, 0.94);
    return jit(c, X, Y, 42, 0.03);
  });
  P.hl(tx0, ty0 - 1, tx1 - tx0, 0xa89878);
  P.vl(tx0 - 1, ty0, ty1 - ty0, 0xa89878);
  paintBoard(P, dag);
  // neonskylten ESPRESSO
  const neon = textMask(BIG, 'ESPRESSO'), nx = 324, ny = 14;
  for (const [a, b] of neon.pts) P.ell(nx + a + 0.5, ny + b + 0.5, 3.2, 3.2, 0xff8a3a, night ? 0.12 : 0.08, 2);
  drawText(P, neon, nx, ny, { fill: 0xfff0d8, out: 0xff8a4a, oa: 0.55 });
  P.hl(nx - 2, ny + 9, neon.w + 4, 0x6a6a6a, 0.6);
  P.px(nx - 2, ny + 8, 0x4a4a4a); P.px(nx + neon.w + 1, ny + 8, 0x4a4a4a);

  // bakdisken: bänkskiva + skåpluckor i valnöt, kylskåp med glasdörr
  area(P, BACK.x0, BACK.top, BACK.x1 - BACK.x0, 3, (X, Y, i, j) => jit([0xf4eee4, 0xe0d8ca, 0xb8ae9e][j], X, Y, 43, 0.04));
  area(P, BACK.x0, BACK.top + 3, BACK.x1 - BACK.x0, BACK.y - BACK.top - 3, (X, Y) => jit(WOOD.base, X, Y, 44, 0.07));
  P.hl(BACK.x0, BACK.top + 3, BACK.x1 - BACK.x0, WOOD.dk);
  for (let x = BACK.x0 + 2; x < BACK.x1 - 4; x += 20) {
    if (x >= 390 && x < 418) continue;
    P.bevel(x, BACK.top + 5, 18, 12, WOOD.hi, WOOD.dk);
    P.box(x + 2, BACK.top + 7, 14, 8, WOOD.lo);
    P.px(x + 15, BACK.top + 11, GOLD.hi); P.px(x + 15, BACK.top + 12, GOLD.lo);
  }
  // kylen med mjölk och läsk
  const fx = 396;
  area(P, fx, BACK.top + 4, 20, 14, (X, Y, i, j) => (i === 0 || j === 0 || i === 19 || j === 13 ? 0xb8c0c8 : qmix(0xd8f0ff, 0x8ab0c8, j / 13, X, Y, 3)));
  for (let i = 0; i < 5; i++) { const c = [0xffffff, 0xf0f0f0, 0xe84a3a, 0x4ab04a, 0xffffff][i]; P.rect(fx + 2 + i * 3, BACK.top + 7, 2, 5, c); P.px(fx + 2 + i * 3, BACK.top + 6, i === 2 || i === 3 ? 0xd0d0d0 : 0x3a7bd5); }
  P.hl(fx + 1, BACK.top + 12, 18, 0xa0b8c8);
  P.px(fx + 17, BACK.top + 8, 0x6a7078);
  rowsOf(P, BACK.x0, BACK.y - 2, BACK.x1 - BACK.x0, [0x2a1a10, 0x1a100a]);

  // bryggaren med glaskanna
  const bx = 302;
  P.rect(bx + 10, 44, 4, 22, 0x2a2a30); P.vl(bx + 10, 44, 22, 0x4a4a54);
  area(P, bx, 42, 14, 6, (X, Y, i, j) => (j === 0 ? 0x5a5a64 : i === 0 ? 0x4a4a54 : 0x2a2a30));
  area(P, bx + 1, 43, 5, 4, (X, Y, i, j) => (j === 0 ? 0xc8e0f0 : 0x9ac0dc));
  P.rect(bx + 2, 48, 8, 3, 0x1a1a20); P.hl(bx + 2, 48, 8, 0x3a3a44);
  area(P, bx + 1, 54, 8, 11, (X, Y, i, j) => {
    if (i === 0 || i === 7) return j < 2 ? null : 0xc8dce8;
    if (j === 0) return 0x2a2a30;
    return j < 4 ? mix(0xe8f4fa, 0x9ab0bc, 0.3) : j < 10 ? (i === 1 ? 0x7a4a2a : 0x4a2412) : 0x3a1a0c;
  });
  P.vl(bx + 9, 57, 5, 0x1a1a1a); P.px(bx + 8, 57, 0x1a1a1a); P.px(bx + 8, 61, 0x1a1a1a);
  P.hl(bx, 65, 12, 0x3a3a44); P.px(bx + 12, 62, 0xff3a2a);

  // espressomaskinen: krom, röd emalj, manometrar, två bryggrupper, ångrör
  const mx = 322, mw = 48;
  for (let i = 0; i < 6; i++) spr(P, mx + 3 + i * 7, 36, ['.aaaa.', 'abbbba', 'abbbba', '.cccc.'], { a: 0xffffff, b: 0xece8e0, c: 0xb8b2a8 });
  P.hl(mx, 40, mw, 0xd8e0e6); for (let x = mx; x < mx + mw; x += 6) P.vl(x, 38, 3, 0x9aa4ae);
  area(P, mx, 41, mw, 4, (X, Y, i, j) => [0xf4f8fa, 0xc8d2da, 0xa8b2bc, 0x7a848e][j]);
  area(P, mx, 45, mw, 14, (X, Y, i, j) => {
    if (i < 2 || i >= mw - 2) return [0xa8b2bc, 0xd8e0e6, 0xb0bac4, 0x6a747e][i < 2 ? i : i - mw + 4];
    if (j === 0) return 0xe04a4a;
    const c = j < 3 ? 0xd03a3c : j > 11 ? 0x8a1a1e : 0xb8282c;
    return jit(i > 5 && i < 9 ? mix(c, WHITE, 0.25) : c, X, Y, 45, 0.04);
  });
  for (const gx of [mx + 12, mx + 36]) {
    P.ell(gx + 0.5, 50.5, 3.6, 3.6, 0x2a2a2e, 1, 1);
    area(P, gx - 2, 48, 5, 5, (X, Y, i, j) => ((i === 0 || i === 4) && (j === 0 || j === 4) ? null : 0xf8f4e8));
    P.px(gx, 50, 0x2a2a2e); P.px(gx - 1, 48, 0xffffff);
  }
  area(P, mx + 19, 46, 10, 6, (X, Y, i, j) => (i === 0 || j === 0 || i === 9 || j === 5 ? GOLD.lo : 0x1a1a1e));
  text(P, SMALL, 'SF', mx + 21, 46, GOLD.hi);
  area(P, mx, 59, mw, 2, (X, Y, i, j) => (j ? 0x8a949e : 0xe8eef2));
  for (const gx of [mx + 12, mx + 36]) {
    area(P, gx - 3, 61, 7, 2, (X, Y, i, j) => [0xe8eef2, 0x9aa4ae][j]);
    P.rect(gx - 2, 63, 5, 1, 0x3a3a40);
    P.line(gx + 3, 63, gx + 8, 65, 0x1a1a1a); P.px(gx + 8, 64, 0x3a3a40);
  }
  area(P, mx + 1, 64, mw - 2, 2, (X, Y, i, j) => (j === 0 ? ((X & 1) ? 0x5a646e : 0xd8e0e6) : 0x8a949e));
  spr(P, mx + 11, 62, ['aka', 'bbh'], { a: 0xfbf9f4, k: 0x3a1a0c, b: 0xece8e0, h: 0xd4cec4 });
  // ångröret och mjölkkannan
  P.px(mx - 1, 47, 0x1a1a1a); P.px(mx - 2, 47, 0x3a3a40);
  P.line(mx - 1, 48, mx - 4, 60, 0xd8e0e6); P.line(mx, 48, mx - 3, 60, 0x8a949e);
  area(P, mx - 10, 59, 6, 7, (X, Y, i, j) => (j === 0 ? 0xf4f8fa : [0xf4f8fa, 0xd8e0e6, 0xb0bac4, 0xa0aab4, 0x7a848e, 0x6a747e][i]));
  P.px(mx - 11, 60, 0xb0bac4); P.px(mx - 11, 61, 0x8a949e);
  // hetvattenpip
  P.line(mx + mw, 50, mx + mw + 2, 56, 0x9aa4ae); P.px(mx + mw + 1, 49, 0x1a1a1a);

  // kvarnen med bönor i glasbehållaren
  const qx = 374;
  for (let j = 0; j < 12; j++) {
    const half = 6 - Math.floor(j / 3), y = 33 + j;
    for (let x = qx + 6 - half; x < qx + 6 + half; x++) {
      const edge = x === qx + 6 - half || x === qx + 5 + half;
      const bean = hash(x, y, 50) > 0.5 ? 0x5a2e16 : hash(x, y, 51) > 0.5 ? 0x7a4222 : 0x3a1a0c;
      P.px(x, y, edge ? 0xc8dce8 : j < 2 ? 0xd8e8f0 : bean);
    }
  }
  P.hl(qx + 1, 32, 10, 0x1a1a1e); P.hl(qx + 3, 31, 6, 0x2a2a30);
  area(P, qx + 2, 45, 8, 14, (X, Y, i, j) => (i === 0 ? 0x4a4a54 : i === 7 ? 0x0e0e12 : j === 4 || j === 5 ? 0xb8c0c8 : 0x1e1e24));
  P.rect(qx + 4, 59, 4, 3, 0x9aa4ae); P.px(qx + 5, 62, 0x3a3a40);
  P.rect(qx + 1, 64, 10, 2, 0xd8e0e6);
  // knackbox
  P.rect(qx + 14, 60, 6, 6, 0x2a2a30); P.hl(qx + 14, 60, 6, 0x5a5a64); P.hl(qx + 15, 62, 4, 0x8a6a4a);

  // öppna hyllor: burkar med bönor, teburkar, hängväxt, koppar, sirap, kaffepåsar
  const sx0 = 392, sx1 = 430;
  for (const sy of [30, 48]) {
    area(P, sx0, sy, sx1 - sx0, 3, (X, Y, i, j) => jit([0xc8945a, 0x9a6a40, 0x6a4424][j], X, Y, 52, 0.06));
    for (const bxx of [sx0 + 3, sx1 - 4]) { P.vl(bxx, sy + 3, 3, 0x2a2420); P.line(bxx, sy + 5, bxx + 2, sy + 3, 0x2a2420); }
    P.darken(sx0, sy + 3, sx1 - sx0, 1, 0.75);
  }
  for (let i = 0; i < 3; i++) {
    const jx = sx0 + 2 + i * 7;
    area(P, jx, 22, 6, 8, (X, Y, ii, jj) => (jj === 0 ? 0x9aa0a8 : ii === 0 || ii === 5 ? 0xd8e8f0 : jj < 3 ? 0xe8f4fa : hash(X, Y, 53 + i) > 0.5 ? 0x5a2e16 : 0x7a4222));
    P.rect(jx + 1, 25, 4, 3, [0xf4ecd8, 0xe8d8a8, 0xf4ecd8][i]); P.hl(jx + 1, 26, 4, 0x8a6a4a);
  }
  for (let i = 0; i < 2; i++) { const c = [0x2f7a4a, 0xb8323a][i]; P.rect(sx0 + 23 + i * 5, 24, 4, 6, c); P.hl(sx0 + 23 + i * 5, 24, 4, mix(c, WHITE, 0.3)); P.hl(sx0 + 23 + i * 5, 27, 4, GOLD.base); }
  // hängväxt (pothos) över hyllkanten
  P.rect(sx1 - 5, 25, 5, 5, 0xc8643a); P.hl(sx1 - 5, 25, 5, 0xe0845a);
  leaves(P, sx1 - 3, 24, 4, 2.5, 54, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.7);
  for (const [vx, len] of [[sx1 - 4, 14], [sx1 - 1, 10], [sx1 - 6, 7]]) for (let j = 0; j < len; j++) {
    const x = vx + Math.round(Math.sin(j * 0.7 + vx) * 1), y = 31 + j;
    P.px(x, y, 0x3f7a34);
    if (j % 3 === 1) { P.px(x + 1, y, 0x6fae4a); P.px(x - 1, y + 1, 0x4f9a3a); }
  }
  // koppar och fat
  for (let s = 0; s < 3; s++) for (let k = 0; k < 3 - (s & 1); k++) {
    const cx = sx0 + 2 + s * 6, cy = 45 - k * 3;
    P.rect(cx, cy, 5, 3, 0xf4f0ea); P.hl(cx, cy, 5, 0xffffff); P.hl(cx, cy + 2, 5, 0xc8c0b4);
  }
  for (let i = 0; i < 3; i++) { const c = [0xc87a2a, 0xa8202a, 0x6a9a3a][i]; const x = sx0 + 21 + i * 3; P.rect(x, 41, 2, 7, c); P.px(x, 41, mix(c, WHITE, 0.4)); P.vl(x, 38, 3, 0x2a2a2a); P.px(x + 1, 38, 0x2a2a2a); }
  area(P, sx1 - 7, 40, 6, 8, (X, Y, i, j) => (j === 0 ? 0xa8845a : jit(0xc8a070, X, Y, 55, 0.08)));
  P.rect(sx1 - 6, 43, 4, 2, 0xf4ecd8);
  // radion på bakdisken + muggar att ta med
  const rx = 406;
  area(P, rx, 55, 16, 11, (X, Y, i, j) => (j === 0 ? 0xf0e4c8 : i === 0 ? 0xe0d0b0 : i === 15 ? 0xa89878 : jit(0xd8c8a4, X, Y, 56, 0.05)));
  area(P, rx + 2, 57, 7, 7, (X, Y, i, j) => ((i + j) & 1 ? 0x5a4a3a : 0x8a7a64));
  P.rect(rx + 10, 57, 4, 2, 0x2a8a7a); P.px(rx + 11, 57, 0xff4a3a);
  P.px(rx + 11, 61, 0x3a2a1a); P.px(rx + 13, 61, 0x3a2a1a); P.px(rx + 11, 62, 0xc9a44a); P.px(rx + 13, 62, 0xc9a44a);
  P.line(rx + 13, 55, rx + 17, 49, 0x9aa0a8);
  for (let k = 0; k < 4; k++) { P.rect(396, 62 - k * 2, 5, 2, 0xfaf8f4); P.hl(396, 63 - k * 2, 5, 0xd8d2c8); }
  P.rect(396, 64, 5, 2, 0xa8784a);
  // tallrikstrave, brödkorg och sockerburk under tavlan
  for (let k = 0; k < 4; k++) P.hl(236, 65 - k, 12, k & 1 ? 0xd8d2c8 : 0xfaf8f4);
  area(P, 254, 61, 16, 5, (X, Y, i, j) => (j === 0 ? 0xc8945a : (X + Y) & 1 ? 0xa06a3a : 0x8a5a30));
  for (let i = 0; i < 4; i++) { P.rect(256 + i * 3, 59, 3, 2, 0xd8964a); P.px(256 + i * 3, 59, 0xf4c47c); }
  area(P, 276, 59, 8, 7, (X, Y, i, j) => (j === 0 ? 0x8a9aa8 : i === 0 || i === 7 ? 0xd8e8f0 : j < 3 ? 0xf4f8fa : 0xfffaf0));

  // pendellamporna (grön emalj, guldkant) med sladd från taket
  for (const lx of LAMPS) {
    P.vl(lx, CEIL, 18, 0x2a2420);
    P.rect(lx - 1, CEIL + 17, 3, 2, GOLD.lo);
    area(P, lx - 5, CEIL + 19, 11, 5, (X, Y, i, j) => {
      const e = Math.abs(i - 5);
      if (j < 2 && e > 3 + j) return null;
      if (j === 4) return i === 0 || i === 10 ? GOLD.lo : GOLD.base;
      return jit(i < 4 ? GREEN.hi : i < 8 ? GREEN.base : GREEN.lo, X, Y, 60, 0.04);
    });
    P.hl(lx - 3, CEIL + 24, 7, 0xfff6d0); P.hl(lx - 1, CEIL + 25, 3, 0xffffff);
    P.ell(lx + 0.5, CEIL + 27, 10, 6, 0xfff0c0, night ? 0.4 : 0.25, 3);
  }
}

function pframe(P, x, y, w, h, R, inner) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e > 2) return null;
    if (e === 0) return R.dk;
    if (e === 1) return i === 1 || j === 1 ? R.hi : R.lo;
    return (i + j) % 3 === 0 ? R.hi : R.base;
  });
  if (inner) P.box(x + 3, y + 3, w - 6, h - 6, GOLD.base);
  for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) P.rect(cx, cy, 3, 3, R.hi);
  // upphängning + skugga
  P.line(x + 4, y - 1, x + (w >> 1), y - 6, 0x6a5a4a, 0.7); P.line(x + w - 5, y - 1, x + (w >> 1), y - 6, 0x6a5a4a, 0.7);
  P.px(x + (w >> 1), y - 6, 0x3a3028);
  P.darken(x + w, y + 2, 2, h, 0.78); P.darken(x + 2, y + h, w, 2, 0.78);
}
function paintZoneC(P, night) {
  // pelaren (klockan ritas live)
  area(P, PIL.x0, CEIL, PIL.x1 - PIL.x0, WALL_Y - CEIL, (X, Y, i, j) => {
    if (j < 4) return [0xfaf2e0, 0xd8c8a8, 0xf0e4c8, 0xb8a482][j];
    if (Y > WALL_Y - 7) return [0x8a7a5c, 0xe0d4bc, 0xc8b89a, 0xb0a080, 0x9a8a6c, 0x7a6a50, 0x5a4a38][Y - (WALL_Y - 7)];
    const c = [0xd8ccb4, 0xf8f0de, 0xf0e6d0, 0xe0d2b8, 0xf0e6d0, 0xe0d2b8, 0xf0e6d0, 0xe0d2b8, 0xd0c2a6, 0xb8a888][i];
    return jit(c, X, Y, 61, 0.03);
  });
  P.darken(PIL.x1, CEIL, 2, WALL_Y - CEIL - 5, 0.82);
  // tidningar på trästickor i en hållare på pelaren
  rowsOf(P, PIL.x0 - 2, 44, PIL.x1 - PIL.x0 + 4, [WOOD.hi, WOOD.base, WOOD.dk]);
  for (const [nx, head, photo] of [[PIL.x0 - 1, 0xc8202a, 0x6a9ac8], [PIL.x0 + 5, 0x1a1a1e, 0xd8a040]]) {
    P.hl(nx - 1, 46, 7, WOOD.lo); P.px(nx - 1, 46, WOOD.hi);                        // stickan
    area(P, nx, 47, 5, 17, (X, Y, i, j) => {
      if (j < 3) return j === 1 && i > 0 && i < 4 ? WHITE : head;                     // tidningshuvudet
      if (j >= 5 && j < 9 && i >= 2) return photo;                                    // bilden
      if (j === 16) return 0xb8b2a4;
      return (j & 1) || i === 4 ? 0xf2eee4 : 0x9a968c;                                // textrader
    });
    P.vl(nx + 4, 48, 15, 0xc8c2b4);
    P.darken(nx + 5, 48, 1, 16, 0.8);
  }
  // tavla 1: stilleben med blommor i vas
  const f1 = { x: 456, y: 16, w: 22, h: 28 };
  pframe(P, f1.x, f1.y, f1.w, f1.h, WOOD, true);
  area(P, f1.x + 4, f1.y + 4, f1.w - 8, f1.h - 8, (X, Y, i, j) => qmix(0x2a3a2a, 0x1a241a, j / (f1.h - 8), X, Y, 3));
  P.rect(f1.x + 8, f1.y + 16, 6, 7, 0x4a7ab8); P.vl(f1.x + 8, f1.y + 16, 7, 0x7aa8e0); P.hl(f1.x + 7, f1.y + 16, 8, 0x3a5a8a);
  for (const [dx, dy, c] of [[6, 8, 0xe8303a], [11, 6, 0xf0c040], [13, 10, 0xf07ab0], [9, 11, 0xf4f0e8], [5, 12, 0xe86a2a], [12, 13, 0x8e5bd1]]) {
    P.line(f1.x + dx + 1, f1.y + dy + 3, f1.x + 11, f1.y + 16, 0x3f7a34);
    P.rect(f1.x + dx, f1.y + dy, 3, 3, c); P.px(f1.x + dx, f1.y + dy, mix(c, WHITE, 0.45)); P.px(f1.x + dx + 2, f1.y + dy + 2, mul(c, 0.7));
  }
  P.hl(f1.x + 4, f1.y + 23, 14, 0x6a4a2a); P.px(f1.x + 16, f1.y + 22, 0xe8303a);
  // tavla 2: skärgårdslandskap i förgylld ram
  const f2 = { x: 494, y: 12, w: 72, h: 38 };
  pframe(P, f2.x, f2.y, f2.w, f2.h, GOLD, false);
  const ix = f2.x + 3, iy = f2.y + 3, iw = f2.w - 6, ih = f2.h - 6;
  area(P, ix, iy, iw, ih, (X, Y, i, j) => {
    if (j < 13) return qmix(0x7ab8e0, 0xf0e0c0, j / 13, X, Y, 4);
    let c = qmix(0x3a78b0, 0x2a5a8a, (j - 13) / 12, X, Y, 3); if (hash(X, Y, 62) > 0.93) c = 0xd8ecf8; return c;
  });
  P.ell(ix + 52, iy + 6, 4, 4, 0xfff4d0, 0.9, 2);
  for (const [cx, cy] of [[ix + 14, iy + 4], [ix + 25, iy + 3], [ix + 40, iy + 8]]) P.ell(cx, cy, 5, 1.6, WHITE, 0.7, 2);
  // kobbar av granit, ön med röd stuga och tallar
  for (let i = 0; i < iw; i++) {
    const top = iy + 21 + Math.round(Math.sin(i * 0.12) * 2 + (i > 38 ? -4 : 0) - (i > 20 && i < 30 ? 2 : 0));
    for (let y = top; y < iy + ih; y++) P.px(ix + i, y, jit(y < top + 1 ? 0xe0b0a0 : y > iy + ih - 3 ? 0x5a7a3a : hash(ix + i, y, 63) > 0.6 ? 0xb07a6a : 0x9a6a5a, ix + i, y, 64, 0.08));
  }
  for (let i = 0; i < 26; i++) for (let y = iy + 16; y < iy + 22; y++) if (hash(i, y, 65) > 0.35 && y > iy + 17 + Math.abs(i - 13) * 0.35) P.px(ix + 40 + i, y, (i + y) & 1 ? 0x4a6a2a : 0x5a7a3a);
  // stugan
  const hx = ix + 47, hy = iy + 12;
  P.rect(hx, hy, 9, 6, 0xb8322a); P.vl(hx, hy, 6, 0xd84a3a);
  for (let j = 0; j < 4; j++) P.hl(hx - 1 + j, hy - 1 - j, 11 - j * 2, j === 0 ? 0x2a2a2a : 0x4a4a4a);
  P.rect(hx + 2, hy + 3, 2, 3, 0xf4f0e8); P.rect(hx + 6, hy + 2, 2, 2, 0xf4f0e8); P.hl(hx, hy, 9, 0xf4f0e8);
  P.hl(hx - 1, hy + 6, 11, 0xd8b0a0);
  for (const px of [ix + 41, ix + 60, ix + 63]) { for (let j = 0; j < 9; j++) P.hl(px - (j >> 1), iy + 8 + j, 1 + (j >> 1) * 2, j & 1 ? 0x1e4a2a : 0x2e6a3a); P.vl(px, iy + 17, 2, 0x5a3a20); }
  // segelbåt och en mås
  P.hl(ix + 16, iy + 20, 9, 0xf4f0e8); P.hl(ix + 17, iy + 21, 7, 0x8a4a2a);
  for (let j = 0; j < 7; j++) P.hl(ix + 21 - Math.floor(j / 2), iy + 13 + j, 1 + Math.floor(j / 2), 0xfaf8f0);
  P.vl(ix + 21, iy + 12, 8, 0x5a3a20);
  P.px(ix + 30, iy + 6, 0x3a3a3a); P.px(ix + 31, iy + 7, 0x3a3a3a); P.px(ix + 32, iy + 6, 0x3a3a3a);
  // mässingsskylt under tavlan
  P.rect(f2.x + 30, f2.y + f2.h + 1, 12, 3, GOLD.base); P.hl(f2.x + 30, f2.y + f2.h + 1, 12, GOLD.hi);
  // tavla 3: sepiafoto av kaféet förr
  const f3 = { x: 578, y: 18, w: 18, h: 22 };
  pframe(P, f3.x, f3.y, f3.w, f3.h, { hi: 0x4a4a4a, base: 0x2a2a2a, lo: 0x1a1a1a, dk: 0x0a0a0a }, false);
  area(P, f3.x + 3, f3.y + 3, f3.w - 6, f3.h - 6, (X, Y, i, j) => {
    if (j < 3) return 0xe8d8b8;
    if (j < 12) return i > 0 && i < 11 ? (j === 3 ? 0x7a5a3a : j < 7 ? ((i & 1) && j === 5 ? 0x5a3a24 : 0xc8a880) : (i > 3 && i < 8 ? 0x4a3020 : 0xb8966e)) : 0xd8c4a0;
    return jit(0xa88a64, X, Y, 66, 0.1);
  });
  P.hl(f3.x + 4, f3.y + 7, 10, 0x8a2a2a, 0.35);
  // vägglampor: mässingsarm med tulpanskärm
  for (const sx of SCONCES) {
    P.ell(sx + 0.5, 24, 12, 9, 0xffd890, night ? 0.4 : 0.22, 4);
    P.rect(sx - 1, 32, 3, 4, GOLD.lo); P.px(sx, 32, GOLD.hi);
    P.line(sx, 31, sx, 27, GOLD.base);
    area(P, sx - 3, 22, 7, 5, (X, Y, i, j) => (j === 4 ? (i === 0 || i === 6 ? null : 0xf8e8c0) : Math.abs(i - 3) > 1 + j * 0.8 ? null : [0xfff8e0, 0xfff0c8, 0xf8e0a8, 0xe8c888][j]));
    P.ell(sx + 0.5, 20, 5, 4, 0xfff4d8, 0.35, 2);
  }
  paintStove(P);
  paintBench(P);
}
function paintStove(P) {
  const x0 = STOVE.x0, x1 = STOVE.x1, top = 8, bot = WALL_Y + 6;
  // kakel: vitglaserat med blå blomdekor
  area(P, x0 + 2, top + 10, x1 - x0 - 4, bot - top - 18, (X, Y, i, j) => {
    const tx = i % 8, ty = j % 7, col = Math.floor(i / 8), row = Math.floor(j / 7);
    if (tx === 7 || ty === 6) return 0xb8b4a8;
    let c = tx === 0 ? 0xffffff : tx === 6 ? 0xd8d4ca : 0xf2f0ea;
    const dx = Math.abs(tx - 3), dy = Math.abs(ty - 2.5);
    if ((dx === 0 && dy < 2) || (dy < 0.6 && dx < 2)) c = 0x3a5aa0;
    else if (dx === 1 && dy > 1 && dy < 2) c = 0x6a8ac8;
    if ((row + col) & 1 && dx + dy > 3.5 && hash(col, row, 70) > 0.5) c = mix(c, 0x3a5aa0, 0.2);
    return c;
  });
  // krona och gesimser
  rowsOf(P, x0, top + 6, x1 - x0, [0xfaf8f2, 0xe8e4dc, 0xc8c4b8, 0x9a968a]);
  area(P, x0 + 4, top, x1 - x0 - 8, 6, (X, Y, i, j) => (Math.abs(i - (x1 - x0 - 8) / 2) > 3 + j * 2 ? null : [0xffffff, 0xf8f6f0, 0xf0ece4, 0xe8e4dc, 0xd8d4ca, 0xc8c4b8][j]));
  P.px((x0 + x1) >> 1, top - 1, GOLD.base);
  rowsOf(P, x0, 44, x1 - x0, [0xfaf8f2, 0xd8d4ca, 0x9a968a]);
  // mässingsluckor
  for (const [dy, h] of [[52, 8], [64, 10]]) {
    const lx = ((x0 + x1) >> 1) - 6;
    area(P, lx, dy, 12, h, (X, Y, i, j) => (i === 0 || j === 0 ? GOLD.hi : i === 11 || j === h - 1 ? GOLD.dk : (j & 1) && i > 2 && i < 9 ? GOLD.lo : GOLD.base));
    P.px(lx + 9, dy + (h >> 1), 0x3a2a10);
  }
  // sockel + skugga
  area(P, x0 - 1, bot - 8, x1 - x0 + 2, 8, (X, Y, i, j) => jit(j === 0 ? 0xd8d4ca : j > 5 ? 0x6a665e : 0x9a968a, X, Y, 71, 0.08));
  P.vl(x0 + 2, top + 10, bot - top - 18, 0xffffff);
  P.darken(x1 - 3, top + 10, 1, bot - top - 18, 0.86);
  P.darken(x1, top + 12, 2, bot - top - 12, 0.8);
  P.darken(x0 - 1, bot, x1 - x0 + 2, 2, 0.7);
}
function paintBench(P) {
  const x0 = BQ.x0, x1 = BQ.x1, y = BQ.y;
  const V = { hi: 0xd05a5a, base: 0x9a2a32, lo: 0x6a1a22, dk: 0x3e0e14 };
  // ryggen: capitonnérad sammet
  area(P, x0, 56, x1 - x0, 30, (X, Y, i, j) => {
    if (j === 0) return WOOD.hi;
    if (j === 1) return WOOD.base;
    if (j < 4) return [V.hi, mix(V.hi, V.base, 0.5)][j - 2];
    const u = (i + (Math.floor((j - 4) / 6) & 1) * 5) % 10, v = (j - 4) % 6;
    const d = Math.abs(u - 5) / 5 + Math.abs(v - 3) / 3;
    let c = d < 0.5 ? V.hi : d < 1 ? V.base : V.lo;
    if (u === 5 && v === 3) c = V.dk;                   // knapp
    if (j > 24) c = mul(c, 0.88);
    return jit(c, X, Y, 72, 0.05);
  });
  // sitsen (dynor) + framkant med passpoal
  area(P, x0, 86, x1 - x0, 6, (X, Y, i, j) => jit(i % 49 === 0 ? V.lo : [V.hi, V.hi, mix(V.hi, V.base, 0.5), V.base, V.base, V.lo][j], X, Y, 73, 0.05));
  area(P, x0, 92, x1 - x0, y - 92, (X, Y, i, j) => (j === 0 ? 0xc84a4a : j >= y - 94 ? WOOD.dk : j === y - 95 ? WOOD.base : jit(i % 49 === 0 ? V.dk : V.lo, X, Y, 74, 0.05)));
  // gavlarna i trä
  for (const gx of [x0 - 3, x1]) area(P, gx, 54, 3, y - 54, (X, Y, i) => [WOOD.hi, WOOD.base, WOOD.lo][i]);
  // kuddar: senapsgul + mönstrad
  const pil = (px, c1, c2) => area(P, px, 75, 12, 11, (X, Y, i, j) => {
    if ((i === 0 || i === 11) && (j === 0 || j === 10)) return null;
    const c = (i + j) % 4 === 0 ? c2 : c1;
    return jit(j < 2 ? mix(c, WHITE, 0.2) : j > 8 ? mul(c, 0.8) : c, X, Y, 75, 0.06);
  });
  pil(x1 - 16, 0xd8a030, 0xe8b848);
  pil(x0 + 22, 0x2a5a8a, 0xe8dcc0);
  P.darken(x0, y, x1 - x0, 2, 0.7); P.darken(x0, y + 2, x1 - x0, 1, 0.85);
}

// Slitet stråk från dörren till disken: där har tusentals fötter mattat glasyren.
function wearAt(x, y) {
  const ax = 110, ay = 98, bx = 392, by = 128;
  const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1);
  const d = Math.hypot(x - (ax + (bx - ax) * t), (y - (ay + (by - ay) * t)) * 1.5);
  return clamp(1 - d / 26, 0, 1);
}
// Trasmatta (väv i ränder av gamla kläder) med fransar på kortsidorna
function paintRunner(P, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  // blåvita fält av prickiga jeanstrasor, avdelade av smala röda och gula ränder
  const DENIM = [0x3e5e92, 0x5a7aae, 0x4a6aa0, 0xece0c4, 0x7a96c4];
  const STRIPES = [0xece0c4, 0xc8404a, 0xc8404a, 0xc8404a, 0xece0c4, 0xd8a840, 0xd8a840, 0xece0c4];
  const PER = 22 + STRIPES.length;
  area(P, x0, y0, w, h, (X, Y, i, j) => {
    const k = (i + 6) % PER;
    let c;
    if (k >= 22) c = STRIPES[k - 22];
    else { const r = hash(X, Y, 122); c = r < 0.44 ? DENIM[0] : r < 0.7 ? DENIM[1] : r < 0.86 ? DENIM[2] : r < 0.95 ? DENIM[3] : DENIM[4]; }
    if (j === 0 || j === h - 1) c = mul(k >= 22 ? c : 0x2a3a6a, 0.9);      // kantslingan
    else if ((i + (j >> 1)) & 1) c = mul(c, 0.9);                          // väften
    if (j === 1) c = mix(c, WHITE, 0.14);
    if (j === h - 2) c = mul(c, 0.84);
    return jit(c, X, Y, 124, 0.05);
  });
  // varpens fransar
  for (let j = 1; j < h - 1; j += 2) { P.hl(x0 - 2, y0 + j, 2, 0xf0e4c8); P.px(x0 - 3, y0 + j, 0xd8ccb0, 0.7); P.hl(x1, y0 + j, 2, 0xf0e4c8); P.px(x1 + 2, y0 + j, 0xd8ccb0, 0.7); }
  P.darken(x0, y1, w, 1, 0.78);
}
// Golvet: schackrutigt kakel med glasyr, stötta hörn och sprickor, ett slitet stråk,
// solfläckar från fönstren, spegling av disken, trasmatta, persisk matta och dörrmatta.
function paintFloor(P, night, rain) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const r = y - WALL_Y, row = Math.floor(r / 8), ty = r % 8, col = Math.floor(x / 12), tx = x % 12;
    const dark = (row + col) & 1;
    const h = hash(col, row, 80), h2 = hash(col, row, 79);
    let c = dark ? mix(0x644e3c, 0x4c3a2c, h * 0.8) : mix(0xeadfc8, 0xd8cab0, h * 0.8);
    if (tx === 0 || ty === 0) c = dark ? 0x352820 : 0xa89a80;                 // fogen
    else if (ty === 1) c = mix(c, WHITE, dark ? 0.1 : 0.28);                  // glaserad överkant
    else if (tx === 1) c = mix(c, WHITE, dark ? 0.05 : 0.12);
    else if (ty === 7) c = mul(c, dark ? 0.86 : 0.91);                        // skuggad underkant
    else if (tx === 11) c = mul(c, 0.95);
    if (h2 > 0.42 && ty >= 2 && ty <= 4 && tx === 8 - ty) c = mix(c, WHITE, dark ? 0.16 : 0.5);   // glasyrens blänk
    if (h > 0.88 && tx + ty <= 3 && tx > 0 && ty > 0) c = dark ? 0x3e3026 : 0xbcae92;           // kantstött hörn
    if (!dark && h2 > 0.93 && ty > 0 && ty < 7 && tx === Math.round(3 + h * 5 + (ty - 1) * (h2 > 0.965 ? 0.9 : -0.9))) c = 0xb4a68c;  // hårfin spricka
    if (hash(x, y, 81) > 0.975) c = mix(c, dark ? 0x7a6450 : 0xc0b094, 0.6);
    const wv = wearAt(x, y);
    if (wv > 0) {
      c = mix(c, dark ? 0x7e6a56 : 0xd2c4a8, wv * 0.32);
      if (hash(x, y, 78) > 0.94) c = mix(c, 0x8a7a64, wv * 0.5);            // repor och grus
    }
    c = mul(c, 0.84 + Math.min(1, r / 60) * 0.16);          // bakre delen i skugga
    P.px(x, y, jit(c, x, y, 82, 0.05));
  }
  // dammet samlas längs golvlisten
  for (let x = 0; x < W; x++) for (let j = 0; j < 3; j++) if (hash(x, j, 83) > 0.55 + j * 0.15) P.px(x, WALL_Y + j, 0x3a2c22, 0.35);
  for (let j = 0; j < 4; j++) P.darken(0, WALL_Y + j, W, 1, 0.66 + j * 0.09);
  // det blanka kaklet speglar diskens gröna front och mässingsstången
  for (let j = 1; j < 9; j++) for (let x = CNT.x0; x < CNT.x1; x++) {
    const a = 0.26 * (1 - j / 9);
    if (bayer(x, CNT.y + j) < 0.75) P.px(x, CNT.y + j, j === 5 ? GOLD.base : GREEN.base, j === 5 ? a * 1.4 : a);
  }
  if (rain) {
    // blöta fotspår från dörren mot disken (de torkar bort ju längre in de kommer)
    for (let k = 0; k < 22; k++) {
      const s = k / 22, x = Math.round(112 + s * 236 + Math.sin(s * 5) * 6), y = Math.round(98 + s * 26) + (k & 1 ? 2 : -1);
      const a = 0.34 * (1 - s * 0.8);
      P.rect(x, y, 2, 1, 0x2a2018, a); P.px(x + (k & 1 ? 2 : -1), y + 1, 0x2a2018, a * 0.7);
    }
    for (let i = 0; i < 18; i++) P.px(DOOR.x0 + 3 + ((hash(i, 1, 142) * 22) | 0), WALL_Y + 12 + ((hash(i, 2, 142) * 5) | 0), 0xc8d8e8, 0.35);
  } else if (!night) {
    // solen faller in genom fönstren och dörren, snett åt höger
    const patch = (x0, x1, y0, len, bars) => {
      for (let j = 0; j < len; j++) {
        const y = y0 + j, sh = j * 0.55, a = 0.26 * (1 - j / len) + 0.07;
        for (let x = Math.round(x0 + sh); x < Math.round(x1 + sh); x++) {
          const lx = x - sh - x0;
          if (bars.some((b) => Math.abs(lx - b) < 1.5)) continue;
          if (bayer(x, y) < 0.8) P.px(x, y, 0xfff4d8, a);
        }
      }
    };
    for (const w of WINS) patch(w.x0, w.x1, WALL_Y + 2, 26, [(w.x1 - w.x0) / 2]);
    patch(DOOR.x0 + 4, DOOR.x1 - 4, WALL_Y + 1, 30, []);
  }
  paintRunner(P, RUNNER.x0, RUNNER.y0, RUNNER.x1, RUNNER.y1);
  // varma ljuspölar under lamporna
  for (const lx of LAMPS) P.ell(lx + 6, CNT.y + 7, 18, 5, 0xffd890, night ? 0.22 : 0.12, 3);
  // dörrmattan
  area(P, DOOR.x0 + 1, WALL_Y + 2, DOOR.x1 - DOOR.x0 - 2, 10, (X, Y, i, j) => (i === 0 || j === 0 || i === DOOR.x1 - DOOR.x0 - 3 || j === 9 ? 0x3a2a1a : jit(hash(X, Y, 83) > 0.5 ? 0x9a7a4a : 0x8a6a3e, X, Y, 84, 0.1)));
  text(P, SMALL, 'HEJ!', DOOR.x0 + 7, WALL_Y + 5, 0x3a2410);
  // persisk matta i soffhörnan
  const rx0 = 466, rx1 = 626, ry0 = 136, ry1 = 206;
  area(P, rx0, ry0, rx1 - rx0, ry1 - ry0, (X, Y, i, j) => {
    const w = rx1 - rx0, h = ry1 - ry0, e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e === 0) return 0x2a1a24;
    if (e < 4) return e === 2 ? jit(0xd0a850, X, Y, 85, 0.08) : jit(0x283a6a, X, Y, 86, 0.08);
    if (e < 8) return (i + j) % 4 < 2 ? jit(0xb8a060, X, Y, 87, 0.08) : jit(0x6a1a22, X, Y, 88, 0.08);
    const cx = w / 2, cy = h / 2, d = Math.abs(i - cx) / (w / 2) + Math.abs(j - cy) / (h / 2);
    let c = 0x8e2a30;
    if (d < 0.32) c = d < 0.12 ? 0xd0a850 : d < 0.22 ? 0x283a6a : 0xe0c890;
    else if (Math.abs(d - 0.5) < 0.03) c = 0xd0a850;
    else if ((Math.floor(i / 6) + Math.floor(j / 5)) % 3 === 0 && hash(Math.floor(i / 6), Math.floor(j / 5), 89) > 0.5) c = 0x6a1a22;
    return jit(c, X, Y, 90, 0.1);
  });
  for (let y = ry0 + 1; y < ry1 - 1; y += 2) { P.hl(rx0 - 2, y, 2, 0xf0e4c8); P.hl(rx1, y, 2, 0xf0e4c8); }
  P.darken(rx0, ry1, rx1 - rx0, 1, 0.8);
  // skuggor under borden, stolarna, pallarna och växterna
  for (const T of TABLES) {
    if (T.bench) { P.ell(T.x, T.y, 10, 2.2, 0x1a1014, 0.35, 2); continue; }
    P.ell(T.x, T.y, T.long ? 26 : 13, 3, 0x1a1014, 0.35, 3);
    for (const [dx, dy] of T.seats) P.ell(T.x + dx, T.y + dy, 7, 2, 0x1a1014, 0.3, 2);
  }
  for (const sx of STOOLS) P.ell(sx, STOOL_Y, 5, 1.6, 0x1a1014, 0.35, 2);
  for (const p of PLANTS) P.ell(p.x, p.y, 8, 2.2, 0x1a1014, 0.4, 2);
  P.ell(COAT.x, COAT.y, 6, 1.6, 0x1a1014, 0.4, 2);
  P.ell(EASEL.x, EASEL.y, 13, 2.4, 0x1a1014, 0.4, 2);
  P.ell(UMB.x, UMB.y, 6, 1.6, 0x1a1014, 0.4, 2);
  P.ell(FLAMP.x, FLAMP.y, 8, 2, 0x1a1014, 0.4, 2);
  P.ell(STATION.x, STATION.y, 15, 2.4, 0x1a1014, 0.45, 2);
  P.ell(DOG.x, DOG.y, 10, 2, 0x1a1014, 0.35, 2);
  P.ell(PRAM.x, PRAM.y, 13, 2.2, 0x1a1014, 0.4, 2);
  P.darken(CNT.x0, CNT.y, CNT.x1 - CNT.x0, 2, 0.62); P.darken(CNT.x0, CNT.y + 2, CNT.x1 - CNT.x0, 1, 0.8);
}
function paintSides(P) {
  // sidoväggarna i skugga (lite perspektiv)
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, H, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WALL_Y + (5 - k) * 2) return null;
    return jit(Y < CEIL ? 0x2a1a12 : Y < WAIN ? mul(0xd8c49e, 0.62 + k * 0.03) : Y < WALL_Y - 5 ? mul(GREEN.base, 0.6 + k * 0.03) : WOOD.dk, X, Y, 91, 0.04);
  });
  P.box(0, 0, W, H, 0x0e0d12);
}

function paintBg(night, dag, rain) {
  const P = new Pix(W, H);
  paintWall(P);
  paintFloor(P, night, rain);      // före zonerna: soffan och kakelugnen står på golvet
  paintOutside(P, night, rain);
  paintZoneA(P);
  paintZoneB(P, night, dag);
  paintZoneC(P, night);
  paintSides(P);
  return P.flush();
}

// Kvällens ljuskarta: varma pölar i dithrade steg (läggs på med 'lighter')
function paintNightLight() {
  const P = new Pix(W, H);
  const AMB = 0xff9c48;
  P.ell(274, 92, 48, 12, 0xffd890, 0.26, 4);                                   // glasmonterns belysning
  P.ell(330, 104, 124, 22, AMB, 0.16, 4);                                      // disken
  for (const lx of LAMPS) { P.ell(lx + 0.5, 62, 30, 42, AMB, 0.24, 5); P.ell(lx + 0.5, 32, 9, 6, 0xffe0a0, 0.45, 3); }
  for (const sx of SCONCES) { P.ell(sx + 0.5, 30, 30, 36, AMB, 0.28, 5); P.ell(sx + 0.5, 24, 6, 5, 0xffe0a0, 0.5, 3); }
  P.ell(520, 92, 80, 18, AMB, 0.12, 4);                                        // soffan i vägglampornas sken
  P.ell(FLAMP.x, FLAMP.y - 48, 32, 30, AMB, 0.3, 5);
  P.ell(FLAMP.x, FLAMP.y - 42, 8, 4, 0xffe8b0, 0.55, 3);
  P.ell(FLAMP.x - 12, FLAMP.y, 48, 12, AMB, 0.2, 4);
  P.ell(362, 18, 48, 15, 0xff6a3a, 0.2, 4);                                    // neonskylten
  for (const w of WINS) P.ell((w.x0 + w.x1) / 2, WIN_T + 4, (w.x1 - w.x0) / 2 + 6, 10, 0xffd890, 0.2, 3);
  return P.flush();
}

// Fönstrens glas, spröjsar, foder, guldtext och ljusslinga (ovanpå folket utanför)
function paintWinOverlay(night) {
  const P = new Pix(214, 90);
  for (const w of WINS) {
    const x0 = w.x0, x1 = w.x1, ww = x1 - x0, wh = WIN_B - WIN_T;
    for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) P.px(x0 + i, WIN_T + j, night ? 0x1a1030 : 0xb8d8e0, 0.08);
    reflect(P, x0, WIN_T, ww, wh, night, 1, x0);
    // tvärpost med småspröjsade överljus + mittpost
    const tb = WIN_T + 9;
    P.hl(x0, tb, ww, 0xf4ecda); P.hl(x0, tb + 1, ww, 0xc8b89a);
    for (let x = x0 + 12; x < x1 - 4; x += 12) P.vl(x, WIN_T, 9, 0xf4ecda);
    const mid = (x0 + x1) >> 1;
    P.vl(mid - 1, tb, wh - 9, 0xf4ecda); P.vl(mid, tb, wh - 9, 0xc8b89a);
    // foder runt glaset
    area(P, x0 - 4, WIN_T - 4, ww + 8, wh + 4, (X, Y, i, j) => {
      const e = Math.min(i, j, ww + 7 - i);
      if (e > 3) return null;
      return [0xb8a888, 0xf6eedc, 0xe8dcc4, 0xa89878][e];
    });
    // spegelvänd guldtext på glaset
    const words = x0 < DOOR.x0 ? [['KAFÉ', BIG, 0]] : [['BAKVERK', SMALL, 0], ['SEDAN 1962', SMALL, 8]];
    for (const [s, F, dy] of words) {
      const M = textMask(F, s, true);
      drawText(P, M, mid - (M.w >> 1), tb + 9 + dy, { fill: (a, b) => (b < 2 ? GOLD.hi : GOLD.base), out: 0x5a3a14, oa: 0.7 });
    }
    // ljusslinga längs överkanten
    for (let x = x0; x < x1; x++) P.px(x, WIN_T + 1 + Math.round(Math.sin((x - x0) / ww * Math.PI) * 2), 0x2a3a2a, 0.7);
    for (let x = x0 + 2, k = 0; x < x1 - 1; x += 5, k++) {
      const y = WIN_T + 2 + Math.round(Math.sin((x - x0) / ww * Math.PI) * 2);
      P.px(x, y, [0xfff0b0, 0xffd8a0, 0xffe8c8][k % 3]);
    }
    // små krukor på bardisken
    const pot = (px) => { P.rect(px, LEDGE - 4, 4, 4, 0xc8643a); P.hl(px, LEDGE - 4, 4, 0xe0845a); leaves(P, px + 2, LEDGE - 7, 3, 3, px, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.7); };
    pot(x0 < DOOR.x0 ? x0 : x1 - 4);
  }
  return P.flush();
}

// Glasdörren (gångjärn till vänster) i bildrutor där den svänger in mot oss
function paintDoorFrames(N = 6) {
  const w = DOOR.x1 - DOOR.x0, h = WALL_Y - DOOR.top;
  const S = new Pix(w, h);
  area(S, 0, 0, w, h, (X, Y) => jit(GREEN.base, X, Y, 92, 0.05));
  S.bevel(0, 0, w, h, GREEN.hi, GREEN.dk);
  S.erase(4, 4, w - 8, 30);
  for (let j = 0; j < 30; j++) for (let i = 0; i < w - 8; i++) {
    const X = 4 + i, Y = 4 + j, s = ((X * 2 - Y * 3) % 40 + 40) % 40;
    S.px(X, Y, 0xc8e0e8, 0.1 + (s < 3 ? 0.22 : 0));
  }
  S.box(3, 3, w - 6, 32, GREEN.dk);
  S.hl(4, 4, w - 8, 0xffffff, 0.3);
  // nedre fyllning med guldlist och sparkplåt
  S.bevel(4, 38, w - 8, 12, GREEN.hi, GREEN.dk);
  S.box(6, 40, w - 12, 8, GOLD.lo);
  area(S, 2, h - 6, w - 4, 4, (X, Y, i, j) => [GOLD.hi, GOLD.base, GOLD.base, GOLD.lo][j]);
  // handtag i mässing
  S.vl(w - 6, 24, 12, GOLD.base); S.vl(w - 5, 24, 12, GOLD.lo); S.px(w - 6, 24, GOLD.hi);
  // skylten på glaset – baksidan säger TACK!
  area(S, 4, 14, 19, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === 18 || j === 7 ? 0x8a1a20 : 0xf4ecd8));
  text(S, SMALL, 'TACK!', 5, 16, 0xb82a30);
  S.line(7, 14, 13, 9, 0x6a5a4a); S.line(19, 14, 13, 9, 0x6a5a4a);
  const frames = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.25, pw = Math.max(3, Math.round(w * Math.cos(th))), shade = 1 - 0.35 * Math.sin(th);
    const F = new Pix(w, h + 6);
    for (let c = 0; c < pw; c++) {
      const sc = Math.min(w - 1, Math.floor((c * w) / pw));
      const drop = Math.round((c / Math.max(1, pw - 1)) * Math.sin(th) * 5);
      for (let y = 0; y < h; y++) {
        const i = (y * w + sc) * 4, a = S.d[i + 3];
        if (!a) continue;
        F.px(c, y + drop, mul((S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2], shade), a / 255);
      }
    }
    frames.push(F.flush());
  }
  return frames;
}

// ---------- möbler och växter (egna bilder, ritas i djupordning) ----------
function paintTable() {
  const P = new Pix(28, 18);
  // marmorskiva (oval), mässingskant, gjutjärnsfot
  for (let y = 0; y < 7; y++) for (let x = 0; x < 28; x++) {
    const d = Math.hypot((x + 0.5 - 14) / 13.5, (y + 0.5 - 3.5) / 3.5);
    if (d > 1) continue;
    let c = y < 1 ? 0xffffff : d > 0.8 && y > 3 ? 0xd8d0c4 : 0xf4f0e8;
    if (hash(x, y, 93) > 0.85 && y > 0) c = 0xd8d2c8;
    if ((x - y * 2) % 11 === 0 && y > 1 && y < 6) c = 0xc0b8ac;
    P.px(x, y, c);
  }
  for (let x = 2; x < 26; x++) { const e = Math.abs(x + 0.5 - 14) > 10; P.px(x, e ? 5 : 6, GOLD.base); if (!e) P.px(x, 7, GOLD.lo); }
  P.rect(13, 8, 2, 7, 0x2a2420); P.vl(13, 8, 7, 0x4a4440);
  P.rect(11, 8, 6, 1, 0x3a3430);
  P.line(13, 14, 8, 16, 0x2a2420); P.line(14, 14, 19, 16, 0x2a2420); P.rect(13, 15, 2, 2, 0x2a2420);
  outline(P);
  return P.flush();
}
// Långbordet i ek med linnelöpare och en vas med tulpaner (för sällskap på fyra)
function paintLongTable() {
  const P = new Pix(48, 24);
  const OAK = { hi: 0xdca870, base: 0xb87a46, lo: 0x8a5430, dk: 0x5a3418 };
  // benen: de bakre mörkare, ett stag emellan
  for (const x of [7, 39]) P.rect(x, 14, 2, 7, OAK.dk);
  P.hl(9, 17, 30, OAK.dk);
  for (const x of [2, 44]) { P.rect(x, 14, 2, 10, OAK.lo); P.vl(x, 14, 10, OAK.base); }
  // skivan: plankor på längden med ådring
  area(P, 1, 6, 46, 6, (X, Y, i, j) => {
    if ((i === 0 || i === 45) && j === 0) return null;
    let c = j === 0 ? OAK.hi : j === 3 ? mix(OAK.base, OAK.lo, 0.45) : OAK.base;
    if (j > 0 && j !== 3 && hash(X >> 2, Y, 150) > 0.72) c = mix(c, OAK.lo, 0.35);   // ådringen
    if (j === 1 && i < 12) c = mix(c, WHITE, 0.12);
    return jit(c, X, Y, 151, 0.05);
  });
  area(P, 1, 12, 46, 2, (X, Y, i, j) => (j === 0 ? OAK.lo : OAK.dk));
  // linnelöparen hänger över framkanten
  area(P, 16, 6, 16, 9, (X, Y, i, j) => {
    let c = j === 8 ? (i & 1 ? 0xd8ccb4 : null) : j >= 6 ? 0xe4d8c2 : 0xf2eadc;
    if (c !== null && (i === 1 || i === 14)) c = 0x5a7ab0;
    return c === null ? null : jit(c, X, Y, 152, 0.04);
  });
  // vas med tulpaner längst till vänster
  P.rect(3, 5, 3, 4, 0xc8e4ec); P.px(3, 5, 0xffffff); P.hl(3, 8, 3, 0x9ab8c4);
  P.vl(4, 2, 3, 0x3f8a34); P.px(3, 3, 0x3f8a34); P.px(5, 3, 0x3f8a34);
  for (const [x, y, c] of [[2, 1, 0xe8303a], [4, 0, 0xf0c040], [6, 1, 0xf07ab0]]) { P.px(x, y, c); P.px(x, y + 1, mul(c, 0.75)); }
  outline(P);
  return P.flush();
}
// wienerstol (böjträ): 'down' = vi ser den framifrån med ryggen bakom sitsen
function paintChair(dir) {
  const D = 0x4a2414, M = 0x7a4222, L = 0xa8683a;
  const rest = (P) => {
    P.vl(2, 4, 11, M); P.vl(13, 4, 11, D);
    for (let x = 3; x < 13; x++) P.px(x, 3 - (x > 4 && x < 11 ? 1 : 0), x < 6 ? L : M);
    P.px(2, 3, M); P.px(13, 3, D); P.px(3, 2, L);
    P.vl(5, 7, 7, M); P.vl(10, 7, 7, D); P.hl(6, 6, 4, M);
  };
  const P = new Pix(16, 26);
  if (dir === 'down') rest(P);
  P.line(3, 17, 2, 25, D); P.line(12, 17, 13, 25, D);
  P.line(5, 17, 5, 23, M); P.line(10, 17, 10, 23, M);
  P.hl(4, 21, 8, M); P.px(3, 21, D); P.px(12, 21, D);
  for (let x = 2; x < 14; x++) { P.px(x, 14, x < 5 ? L : M); P.px(x, 16, D); }
  for (let x = 3; x < 13; x++) P.px(x, 15, (x & 1) ? 0xd8b070 : 0xc89a58);
  P.px(2, 15, M); P.px(13, 15, D);
  outline(P);
  if (dir === 'down') return { img: P.flush() };
  const R = new Pix(16, 26);
  rest(R);
  R.vl(2, 14, 1, M); R.vl(13, 14, 1, D);
  outline(R);
  return { img: P.flush(), front: R.flush() };
}
function paintStool() {
  const P = new Pix(12, 14);
  for (let x = 1; x < 11; x++) { P.px(x, 0, x < 4 ? 0xd05a5a : 0xa8323a); P.px(x, 1, 0x8a2a30); P.px(x, 2, 0x5a1a1e); }
  P.hl(2, 0, 3, 0xe88080);
  P.vl(5, 3, 9, 0xd8e0e6); P.vl(6, 3, 9, 0x8a949e);
  P.hl(3, 8, 6, 0xb8c2cc); P.px(2, 8, 0x8a949e); P.px(9, 8, 0x8a949e);
  P.hl(2, 12, 8, 0x8a949e); P.hl(3, 13, 6, 0x5a646e);
  outline(P);
  return P.flush();
}
function paintPlant(kind) {
  if (kind === 'fikus') {
    const P = new Pix(26, 50);
    P.vl(12, 18, 22, 0x6a4a2a); P.vl(13, 18, 22, 0x4a3018);
    for (const [x, y] of [[12, 4], [6, 8], [18, 6], [11, 11], [10, 16], [16, 14], [4, 20], [20, 22], [8, 27], [17, 29]]) {
      for (let j = -3; j <= 3; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) / 2.6 + Math.abs(j) / 3.6 <= 1) {
        const l = -i * 0.4 - j * 0.3 + hash(x + i, y + j, 94) * 0.3;
        P.px(x + i, y + j, i === 0 && j > -3 ? 0x8ac870 : l > 0.5 ? 0x6ab04a : l > -0.3 ? 0x3f8a34 : 0x285a24);
      }
    }
    area(P, 6, 38, 14, 11, (X, Y, i, j) => (j === 0 ? 0xe0845a : j === 1 ? 0xb85a32 : jit(i < 4 ? 0xd8744a : i > 10 ? 0x9a4a28 : 0xc8643a, X, Y, 95, 0.06)));
    P.hl(7, 48, 12, 0x7a3a1e);
    outline(P);
    return { img: P.flush(), ox: 13, oy: 49 };
  }
  if (kind === 'palm') {
    const P = new Pix(26, 44);
    for (const [ex, ey] of [[-11, -8], [-8, -16], [-2, -20], [4, -19], [10, -14], [12, -6], [-12, -1], [7, -9], [-5, -10]]) {
      const n = 14;
      for (let k = 1; k <= n; k++) {
        const t = k / n, x = 13 + ex * t, y = 24 + ey * t + (t * t) * 4;
        P.px(x, y, 0x3f7a34);
        if (k > 3 && k % 2 === 0) { P.px(x + (ex > 0 ? 1 : -1), y + 1, 0x6ab04a); P.px(x, y + 2, 0x2e6a2a); }
      }
    }
    area(P, 7, 30, 12, 13, (X, Y, i, j) => (j === 0 ? GOLD.hi : j === 12 ? GOLD.dk : jit(i < 3 ? GOLD.hi : i > 8 ? GOLD.lo : GOLD.base, X, Y, 96, 0.08)));
    P.hl(7, 33, 12, GOLD.lo); P.hl(7, 38, 12, GOLD.lo);
    outline(P);
    return { img: P.flush(), ox: 13, oy: 42 };
  }
  const P = new Pix(30, 40);
  for (const [cx, cy, r] of [[8, 12, 7], [20, 10, 8], [14, 6, 6], [5, 21, 6], [24, 20, 6], [15, 17, 7]]) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2);
      if (d > r) continue;
      const ang = Math.atan2(y - cy, x - cx) * 3;
      if (Math.abs(ang - Math.round(ang)) < 0.12 && d > r * 0.45) continue;   // monsterans flikar
      const l = (cx - x) / r * 0.4 + (cy - y) / r * 0.4 + hash(x, y, 97) * 0.3;
      P.px(x, y, l > 0.45 ? 0x5aa844 : l > -0.1 ? 0x2f7a34 : 0x1e5424);
    }
  }
  area(P, 7, 27, 16, 12, (X, Y, i, j) => (j === 0 ? 0xf4f0e8 : jit(i < 4 ? 0xf0ece4 : i > 12 ? 0xb8b2a8 : 0xe0dcd4, X, Y, 98, 0.05)));
  P.hl(7, 30, 16, 0x3a5a8a); P.hl(7, 31, 16, 0x6a8ac8);
  outline(P);
  return { img: P.flush(), ox: 15, oy: 38 };
}
function paintCoat() {
  const P = new Pix(18, 48);
  P.vl(8, 4, 40, 0x6a4028); P.vl(9, 4, 40, 0x4a2a18);
  P.rect(7, 2, 4, 3, 0x8a5a38);
  for (const [x, y] of [[4, 6], [13, 6]]) P.line(8, 8, x, y, 0x6a4028);
  // kappa i kamel och röd halsduk
  area(P, 2, 7, 9, 22, (X, Y, i, j) => (Math.abs(i - 4) > 2 + j * 0.2 ? null : jit(i < 3 ? 0xd8a868 : i > 6 ? 0x9a6a3a : 0xc0884e, X, Y, 99, 0.06)));
  P.vl(6, 10, 18, 0x8a5a2e);
  area(P, 11, 7, 4, 16, (X, Y, i, j) => ((i + j) % 3 === 0 ? 0xf0e0c0 : 0xc8323a));
  // hatt överst
  P.rect(5, 0, 8, 2, 0x2a2a30); P.hl(4, 2, 10, 0x1a1a1e); P.hl(5, 1, 8, 0x8a2a30);
  // paraply lutat
  P.line(13, 46, 16, 28, 0x1a1a1e); P.line(12, 45, 15, 30, 0x2a2a34); P.px(12, 46, 0x6a4028);
  // fot
  P.hl(3, 45, 12, 0x3a2418); P.hl(5, 44, 8, 0x5a3a24);
  outline(P);
  return { img: P.flush(), ox: 9, oy: 46 };
}

// Trottoarprataren inne: IDAG + en kritteckning av dagens fika + priset
function paintEasel(dag, price) {
  const P = new Pix(26, 31);
  const m = KAFE_MENY[dag];
  // bakre bocken skymtar under tavlan
  P.line(6, 24, 4, 29, WOOD.dk); P.line(19, 24, 21, 29, WOOD.dk);
  P.hl(7, 27, 12, WOOD.lo);
  // sidostyckena = benen
  for (let y = 1; y < 30; y++) {
    const s = y > 25 ? 1 : 0;
    P.px(1 - s, y, WOOD.hi); P.px(2 - s, y, WOOD.base);
    P.px(23 + s, y, WOOD.base); P.px(24 + s, y, WOOD.lo);
  }
  P.hl(0, 30, 3, WOOD.dk); P.hl(23, 30, 3, WOOD.dk);
  // överstycket med handtagshål, nederlist med kritkant
  area(P, 1, 0, 24, 3, (X, Y, i, j) => (j === 1 && i >= 9 && i <= 14 ? WOOD.dk : jit([WOOD.hi, WOOD.base, WOOD.lo][j], X, Y, 130, 0.06)));
  area(P, 1, 24, 24, 2, (X, Y, i, j) => jit([WOOD.base, WOOD.lo][j], X, Y, 131, 0.06));
  // griffeln
  area(P, 3, 3, 20, 21, (X, Y) => {
    let c = jit(0x26342c, X, Y, 132, 0.07);
    if (hash(X >> 2, Y >> 1, 133) > 0.8) c = mix(c, 0xd8e0d8, 0.1);
    return c;
  });
  const idag = textMask(SMALL, 'IDAG');
  drawText(P, idag, 3 + ((20 - idag.w) >> 1), 4, { fill: 0xffe070, rough: true });
  for (let x = 5; x < 21; x += 2) P.px(x, 10, 0xf08aa8, 0.8);
  // kritteckningen: bakverket (eller en kopp) med kritvita ångslingor
  const rows = m.cake ? CAKE[m.cake] : CUPS[m.cup].m, pal = m.cake ? PAL[m.cake] : CUPS[m.cup].p;
  const cw = rows[0].length, ch = rows.length, cx = 3 + ((20 - cw) >> 1), cy = 12 + ((7 - ch) >> 1);
  spr(P, cx, cy, rows, pal, 0.92);
  for (const [a, b] of [[-3, 1], [-2, 2], [-3, 3], [cw + 2, 1], [cw + 1, 2], [cw + 2, 3]]) P.px(cx + a, cy + b, 0xe8ece4, 0.6);
  const pm = textMask(SMALL, price + ':-');
  drawText(P, pm, 3 + ((20 - pm.w) >> 1), 19, { fill: 0xff9ac0, rough: true });
  // en krita och en svamp på listen
  P.hl(5, 23, 3, 0xfafafa); P.hl(17, 23, 3, 0x3a4ac0);
  outline(P);
  return P.flush();
}
// Paraplyställ i mässing med tre paraplyer
function paintUmbrellas() {
  const P = new Pix(14, 27);
  const umb = (x, top, c, dots) => {
    // handtaget (krok) och skaftet
    P.px(x - 2, top, 0x3a2418); P.px(x - 1, top - 1, 0x5a3a24); P.px(x, top - 1, 0x5a3a24); P.px(x + 1, top, 0x3a2418); P.px(x - 2, top + 1, 0x3a2418);
    P.vl(x + 1, top + 1, 3, 0x2a2a2a);
    // det hopfällda tyget smalnar av ner i stället
    for (let j = 0; j < 13; j++) {
      const hw = j < 2 ? 1 : j < 9 ? 2 : 1, y = top + 4 + j;
      for (let i = -hw + 1; i <= hw; i++) {
        let cc = i <= -hw + 1 ? mix(c, WHITE, 0.25) : i === hw ? mul(c, 0.65) : c;
        if (dots && (i + y) % 3 === 0 && j > 1) cc = 0xfaf4e0;
        P.px(x + i, y, cc);
      }
    }
    P.px(x + 1, top + 8, mul(c, 0.5)); P.px(x, top + 11, mul(c, 0.5));
  };
  umb(4, 2, 0xc8323a, false);
  umb(10, 4, 0xd8a830, true);
  umb(7, 1, 0x2a3a6a, false);
  // stället: cylinder med band
  area(P, 1, 16, 12, 11, (X, Y, i, j) => {
    if (j === 0) return GOLD.hi;
    if (j === 10) return GOLD.dk;
    const c = i < 2 ? GOLD.hi : i < 5 ? GOLD.base : i < 9 ? GOLD.lo : GOLD.dk;
    return j === 3 || j === 7 ? mul(c, 0.8) : jit(c, X, Y, 134, 0.05);
  });
  P.hl(2, 17, 10, 0x2a1a10);
  outline(P);
  return { img: P.flush(), ox: 7, oy: 26 };
}
// Golvlampa med veckad tygskärm i läshörnan
function paintFloorLamp() {
  const P = new Pix(20, 58);
  for (let j = 0; j < 14; j++) {
    const hw = 4 + Math.round(j * 0.45), y = 1 + j;
    for (let i = -hw; i < hw; i++) {
      let c = (i + 20) % 3 === 0 ? 0xd8bc88 : 0xf4e2b8;                   // vecken
      if (i < -hw + 2) c = mix(c, WHITE, 0.2);
      if (i > hw - 3) c = mul(c, 0.82);
      if (j === 0 || j === 13) c = j === 0 ? GOLD.hi : GOLD.base;
      P.px(10 + i, y, jit(c, i, y, 135, 0.04));
    }
  }
  P.hl(5, 15, 10, 0xfff4d0); P.hl(7, 16, 6, 0xffffff, 0.8);          // glöden under skärmen
  P.rect(9, 0, 2, 1, GOLD.dk);
  // stången med en knopp och foten
  P.vl(9, 16, 38, GOLD.hi); P.vl(10, 16, 38, GOLD.lo);
  P.rect(8, 33, 4, 2, GOLD.base); P.hl(8, 33, 4, GOLD.hi);
  P.line(11, 22, 13, 24, 0x2a2a2a); P.px(13, 25, 0x2a2a2a);            // snöret
  area(P, 4, 54, 12, 3, (X, Y, i, j) => (j === 0 ? GOLD.hi : j === 1 ? GOLD.base : GOLD.dk));
  outline(P);
  return { img: P.flush(), ox: 10, oy: 57 };
}
// Barnvagn (sufflett och handtag åt höger) med en rutig filt
function paintPram() {
  const P = new Pix(28, 26);
  const N = { hi: 0x5a7aa8, base: 0x34507e, lo: 0x22385e, dk: 0x142440 };
  // handtaget med skumgrepp och chromrör ner till korgen
  P.hl(21, 1, 6, 0x1a1a1e); P.hl(21, 2, 6, 0x3a3a40);
  P.line(22, 3, 19, 13, 0xd8e0e6); P.line(23, 3, 20, 13, 0x8a949e);
  // korgen: rundad balja
  area(P, 2, 9, 19, 9, (X, Y, i, j) => {
    if ((i === 0 || i === 18) && j > 6) return null;
    if (j === 8 && (i < 2 || i > 16)) return null;
    if (j === 0) return 0xf0ece4;                                              // vit kantpassning
    return jit(j < 3 ? N.hi : j < 6 ? N.base : N.lo, X, Y, 140, 0.05);
  });
  P.hl(3, 12, 17, N.dk, 0.5);
  // suffletten: kupol med veck
  const XL = [17, 15, 14, 13, 12, 12, 11, 11];
  for (let j = 0; j < 8; j++) for (let x = XL[j]; x <= 20; x++) {
    const c = (x + j) % 3 === 0 && x > XL[j] ? N.dk : x < XL[j] + 2 ? N.hi : x > 18 ? N.lo : N.base;
    P.px(x, 1 + j, c);
  }
  // filten (rosarutig) och en liten mössa under suffletten
  for (let x = 4; x < 12; x++) P.px(x, 8, (x & 1) ? 0xf4b8c8 : 0xfaf4ee);
  for (let x = 5; x < 11; x++) P.px(x, 7, (x & 1) ? 0xfaf4ee : 0xf4b8c8);
  P.px(10, 6, 0xf0c8a0); P.px(9, 6, 0xf0c8a0); P.hl(9, 5, 2, 0xf4b8c8);
  // chassit och hjulen med ekrar
  P.line(6, 18, 9, 20, 0xb8c2cc); P.line(17, 18, 14, 20, 0xb8c2cc); P.hl(9, 20, 6, 0x8a949e);
  for (const wx of [5, 18]) {
    for (let a = 0; a < 16; a++) { const th = a / 16 * Math.PI * 2; P.px(Math.round(wx + Math.cos(th) * 3.6), Math.round(21 + Math.sin(th) * 3.6), 0x1a1a1e); }
    P.px(wx, 21, 0xd8e0e6); P.px(wx - 2, 21, 0x9aa4ae); P.px(wx + 2, 21, 0x9aa4ae); P.px(wx, 19, 0x9aa4ae); P.px(wx, 23, 0x9aa4ae);
    P.px(wx - 1, 20, 0x6a747e); P.px(wx + 1, 22, 0x6a747e);
  }
  outline(P);
  return { img: P.flush(), ox: 12, oy: 25 };
}
// Påtår-bordet: grönt skåp med marmorskiva, pumptermosar, vattenkaraff och koppar
function paintStation() {
  const P = new Pix(30, 31);
  const top = 15;
  // pumptermosarna (svart = kaffe, stål = te)
  for (const [x, c, hi, lo] of [[2, 0x1e1e24, 0x4a4a54, 0x0e0e12], [8, 0xa8b2bc, 0xe8eef2, 0x6a747e]]) {
    area(P, x, 4, 5, top - 4, (X, Y, i, j) => (i === 0 ? hi : i === 4 ? lo : j === 0 ? hi : c));
    P.rect(x + 1, 1, 3, 3, 0x2a2a30); P.hl(x + 1, 1, 3, 0x5a5a64);          // pumplocket
    P.hl(x - 1, 2, 2, 0x2a2a30);                                          // pip
    P.rect(x + 1, 7, 3, 3, c === 0x1e1e24 ? 0xe8b230 : 0x3a8a4a);         // etikett
  }
  // vattenkaraffen med citronskivor
  area(P, 15, 6, 5, top - 6, (X, Y, i, j) => (i === 0 || i === 4 ? 0xb8d0dc : j === 0 ? 0xd8e8f0 : j < 2 ? 0xf0f8fc : 0xe0eef4));
  P.px(16, 9, 0xf0d040); P.px(17, 9, 0xf8e070); P.px(17, 11, 0xf0d040); P.px(18, 12, 0xf8e070);
  P.hl(16, 5, 3, 0xb8d0dc); P.px(16, 7, WHITE);
  // koppar i trave och sockerskål
  for (let k = 0; k < 3; k++) { P.rect(21, top - 3 - k * 2, 6, 2, 0xfaf8f4); P.hl(21, top - 2 - k * 2, 6, 0xd8d2c8); }
  P.rect(22, top - 9, 4, 2, 0x3a8a4a);
  // skivan och skåpet
  area(P, 0, top, 30, 2, (X, Y, i, j) => (j === 0 ? 0xf4efe6 : 0xd8d0c4));
  area(P, 1, top + 2, 28, 12, (X, Y, i, j) => (j === 0 ? GOLD.base : j === 11 ? GREEN.dk : i === 0 ? GREEN.hi : i === 27 ? GREEN.dk : jit(GREEN.base, X, Y, 136, 0.05)));
  P.bevel(3, top + 3, 24, 9, GREEN.hi, GREEN.dk);
  const pt = textMask(SMALL, 'PÅTÅR');
  drawText(P, pt, 3 + ((24 - pt.w) >> 1), top + 5, { fill: (a, b) => (b < 1 ? GOLD.hi : GOLD.base), shadow: 0x0c1a12, sa: 0.9 });
  P.rect(3, top + 14, 2, 2, WOOD.dk); P.rect(25, top + 14, 2, 2, WOOD.dk);
  outline(P);
  return { img: P.flush(), ox: 15, oy: 30 };
}

// Disken: marmorskiva, grön front med guldlister, glasmonter, tårtkupa, kassa.
function paintCounter() {
  const ox = CNT.x0 - 2, oy = 76;
  const P = new Pix(CNT.x1 - CNT.x0 + 4, CNT.y - oy + 1, ox, oy);
  const x0 = CNT.x0, x1 = CNT.x1, w = x1 - x0;
  // skivan
  area(P, x0, CNT.top, w, CNT.face - CNT.top - 1, (X, Y, i, j) => {
    let c = j === 0 ? 0xe8e0d2 : 0xf4efe6;
    if (((X * 3 + Y * 7) % 37 === 0) || ((X - Y * 4) % 29 === 0 && hash(X, Y, 100) > 0.4)) c = 0xc8c0b4;
    return jit(c, X, Y, 101, 0.04);
  });
  P.hl(x0, CNT.face - 1, w, 0xfffaf2);
  P.hl(x0, CNT.face, w, 0xc8beb0);
  for (const lx of LAMPS) P.ell(lx + 0.5, CNT.top + 3, 12, 3, 0xfff4d0, 0.35, 3);
  // fronten: grönmålade fyllningar med guldlist
  area(P, x0, CNT.face + 1, w, CNT.y - CNT.face - 1, (X, Y, i, j) => {
    if (j === 0) return GOLD.base;
    if (j === 1) return GREEN.dk;
    if (Y >= CNT.y - 3) return [GREEN.lo, GREEN.dk, 0x0c1a12][Y - (CNT.y - 3)];
    return jit(GREEN.base, X, Y, 102, 0.05);
  });
  const sign = { x0: 366, x1: 424 };
  for (let px = x0 + 4; px < x1 - 8; px += 28) {
    if (px + 24 > sign.x0 && px < sign.x1) continue;
    P.bevel(px, CNT.face + 4, 24, 9, GREEN.hi, GREEN.dk);
    P.box(px + 2, CNT.face + 6, 20, 5, GOLD.lo);
    P.hl(px + 2, CNT.face + 6, 20, GOLD.base);
  }
  // skylten BESTÄLL HÄR på fronten
  P.rect(sign.x0, CNT.face + 3, sign.x1 - sign.x0, 11, 0x17301f);
  P.box(sign.x0, CNT.face + 3, sign.x1 - sign.x0, 11, GOLD.base);
  P.hl(sign.x0 + 1, CNT.face + 4, sign.x1 - sign.x0 - 2, GOLD.lo);
  const bm = textMask(SMALL, 'BESTÄLL HÄR');
  drawText(P, bm, ((sign.x0 + sign.x1) >> 1) - (bm.w >> 1), CNT.face + 6, { fill: (a, b) => (b < 2 ? GOLD.hi : GOLD.base), shadow: 0x06100a, sa: 0.9 });
  // fotstöd i mässing (avbrutet vid skylten, med fästen på var sida)
  for (let x = x0 + 2; x < x1 - 2; x++) {
    if (x >= sign.x0 - 1 && x <= sign.x1) continue;
    P.px(x, CNT.y - 5, GOLD.hi); P.px(x, CNT.y - 4, GOLD.lo);
  }
  for (const x of [x0 + 10, x0 + 40, x0 + 70, x0 + 100, x0 + 130, sign.x0 - 3, sign.x1 + 2]) { P.vl(x, CNT.y - 7, 3, GOLD.dk); P.px(x, CNT.y - 7, GOLD.base); }
  P.vl(x0, CNT.top, CNT.y - CNT.top, 0x0c1a12); P.vl(x1 - 1, CNT.top, CNT.y - CNT.top, 0x0c1a12);
  P.vl(x0 + 1, CNT.face + 2, CNT.y - CNT.face - 5, GREEN.hi);

  // ---- glasmontern ----
  const c0 = CASE.x0, c1 = CASE.x1, gt = 84, gb = 101;
  area(P, c0, 80, c1 - c0, 4, (X, Y, i, j) => (j === 0 ? GOLD.hi : j === 3 ? WOOD.dk : jit(j === 1 ? WOOD.hi : WOOD.base, X, Y, 103, 0.05)));
  area(P, c0 + 2, gt, c1 - c0 - 4, gb - gt, (X, Y, i, j) => {
    let c = qmix(0xc89468, 0x5a3a26, j / (gb - gt), X, Y, 4);
    if (j === 0) c = 0xfff4d0;
    if (j === 1) c = mix(c, 0xfff0c0, 0.5);
    return c;
  });
  P.hl(c0 + 2, 92, c1 - c0 - 4, 0xe8f4f8); P.hl(c0 + 2, 93, c1 - c0 - 4, 0x8aa0a8, 0.6);
  // bakverken – övre hyllan
  spr(P, c0 + 4, 83, WHOLE.prinsess, PAL.prinsess);
  spr(P, c0 + 21, 86, WHOLE.kladd, PAL.kladd);
  for (const [bx, by] of [[c0 + 38, 88], [c0 + 42, 88], [c0 + 46, 88], [c0 + 40, 85], [c0 + 44, 85], [c0 + 42, 82]]) spr(P, bx, by, CAKE.boll, PAL.boll);
  for (let k = 0; k < 4; k++) spr(P, c0 + 54 + k * 7, 88, CAKE.mazarin, PAL.mazarin);
  // nedre hyllan: plåtar med kanelbullar och semlor
  for (const [tx, tw] of [[c0 + 3, 37], [c0 + 42, 38]]) { P.hl(tx, gb - 1, tw, 0xb8bec4); P.hl(tx, gb - 2, tw, 0xd8dee4, 0.7); }
  for (let k = 0; k < 6; k++) spr(P, c0 + 4 + k * 6, 94 + (k & 1), CAKE.bulle, PAL.bulle);
  for (let k = 0; k < 5; k++) spr(P, c0 + 43 + k * 7, 92 + (k & 1), CAKE.semla, PAL.semla);
  // prislappar
  for (const [px, py] of [[c0 + 8, 92], [c0 + 26, 92], [c0 + 42, 92], [c0 + 62, 92], [c0 + 16, gb - 3], [c0 + 56, gb - 3]]) {
    P.rect(px, py, 5, 3, 0xfaf8f0); P.hl(px + 1, py + 1, 3, 0x3a3a3a); P.px(px, py, 0xd8d0c0);
  }
  // glaset: kant, reflexer, ramar
  reflect(P, c0 + 2, gt, c1 - c0 - 4, gb - gt, false, 0.9, 5);
  P.hl(c0 + 2, gt, c1 - c0 - 4, 0xffffff, 0.5);
  for (const fx of [c0, c0 + 1, c1 - 2, c1 - 1]) P.vl(fx, 80, gb - 78, fx === c0 || fx === c1 - 2 ? GOLD.base : WOOD.dk);
  area(P, c0, gb, c1 - c0, 3, (X, Y, i, j) => (j === 0 ? GOLD.hi : jit(WOOD.base, X, Y, 104, 0.05)));

  // tårtkupa på fot
  const kx = 326;
  P.hl(kx - 7, 100, 15, 0xd8e8f0); P.hl(kx - 6, 101, 13, 0x9ab0bc, 0.7);
  P.vl(kx, 98, 3, 0xc8dce8);
  P.hl(kx - 7, 97, 15, 0xe8f4f8);
  area(P, kx - 5, 90, 11, 7, (X, Y, i, j) => (j < 2 ? (hash(X, Y, 105) > 0.4 ? 0xfaf6ee : 0xe8dcc8) : j === 2 && i % 3 === 0 ? 0xfaf6ee : jit(0xd8a060, X, Y, 106, 0.08)));
  P.px(kx - 2, 89, 0xd8303a); P.px(kx + 2, 89, 0xd8303a); P.px(kx, 88, 0x4a8a3a);
  for (let a = 0; a <= 20; a++) {
    const th = Math.PI * a / 20, x = kx + Math.round(Math.cos(th) * 8), y = 96 - Math.round(Math.sin(th) * 11);
    P.px(x, y, 0xe8f4f8, 0.75);
  }
  P.rect(kx - 1, 83, 3, 2, 0xe8f4f8); P.px(kx, 82, 0xffffff);
  P.line(kx - 5, 88, kx - 6, 93, 0xffffff, 0.8);
  // servettställ, sockerskål och vas med tulpan
  P.rect(340, 95, 7, 6, 0xc8d0d8); P.hl(340, 95, 7, 0xf4f8fa); P.rect(341, 92, 5, 3, 0xffffff);
  P.rect(349, 96, 5, 5, 0xe8f4f8); P.rect(350, 97, 3, 3, 0xffffff); P.hl(349, 96, 5, 0xc8dce8);
  P.rect(357, 95, 3, 6, 0xc8e4ec); P.vl(358, 88, 7, 0x3f8a34); P.px(357, 91, 0x4f9a3a);
  P.rect(357, 86, 3, 3, 0xe8303a); P.px(357, 86, 0xff7a7a); P.px(359, 88, 0xa8202a);
  // dricksburk
  area(P, 386, 93, 7, 8, (X, Y, i, j) => (i === 0 || i === 6 ? 0xc8dce8 : j === 0 ? 0x9ab0bc : j > 4 ? (hash(X, Y, 107) > 0.5 ? 0xe8c050 : 0xb8bcc4) : 0xe8f4fa));
  P.rect(387, 96, 5, 2, 0xf4ecd8);
  // kassaapparaten i mässing
  const rx = REG.x0;
  area(P, rx, 92, 22, 9, (X, Y, i, j) => (j === 0 ? GOLD.hi : i === 0 ? GOLD.hi : i === 21 ? GOLD.dk : j === 8 ? GOLD.dk : jit(GOLD.base, X, Y, 108, 0.06)));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) P.px(rx + 3 + i * 3, 94 + j * 2, j === 0 ? 0xfaf8f0 : 0x2a2a2a);
  area(P, rx + 3, 86, 16, 6, (X, Y, i, j) => (j === 0 ? GOLD.hi : i === 0 || i === 15 ? GOLD.lo : 0x1a1a1a));
  P.rect(rx + 5, 87, 11, 3, 0x2a3a2a);
  area(P, rx - 1, 99, 24, 2, (X, Y, i, j) => (j === 0 ? GOLD.lo : GOLD.dk));
  P.vl(rx + 22, 93, 5, GOLD.dk); P.px(rx + 23, 93, 0x3a2a1a); P.px(rx + 23, 94, 0xfaf0d0);
  // kortterminal
  P.rect(424, 94, 6, 7, 0x2a2a30); P.rect(425, 95, 4, 2, 0x6ad0a0); P.hl(425, 98, 4, 0x5a5a64); P.hl(425, 99, 4, 0x5a5a64);
  outline(P, 0x1a1210);
  return { img: P.flush(), ox, oy };
}

// ---------- katten Kanel (ligger ihoprullad på soffan) ----------
const CAT_PAL = { o: 0xd8843a, O: 0xe8a060, d: 0xa85a24, s: 0x8a4418, w: 0xfaf0e0, p: 0xe8909a, k: 0x3a1a0c };
const CAT_F = [
  ['..o...o.......', '.oOo.oOo......', '.oOOOOOod.....', 'oOwkOkwOodddd.', 'oOOwpwOOoOsOod', '.oOOOOOoOsOsOd', '..dwwddOOOsOd.', '...ssssssssss.'],
  ['.o....o.......', '.oOo.oOo......', '.oOOOOOod.....', 'oOwkOkwOodddd.', 'oOOwpwOOoOsOod', '.oOOOOOoOsOsOd', '..dwwddOOOOOdd', '...ssssssssss.'],
];

// ---------- taxen Sixten (ligger på mattan vid farmors bord) ----------
const DOG_PAL = { L: 0xc8783a, l: 0xe09a5a, D: 0x9a5026, d: 0x6a3418, e: 0x5a2a14, k: 0x1a0e08, r: 0xc8303a, g: 0xf0c040, t: 0xa85a2a };
const DOG_F = [
  ['....ee.............', '...eLLe............', '.lLLkLee...........', 'kLLLLLeeDDDDDDDDD..', '.lLLLrrLLLLLLLLLLDt', '..LLLDgLLLLLLLLLDDt', '.lLLLdDDDDDDDDDDDd.', '..........dd...dd..'],
  ['....ee.............', '...eLLe............', '.lLLkLee...........', 'kLLLLLeeDDDDDDDDD.t', '.lLLLrrLLLLLLLLLLDt', '..LLLDgLLLLLLLLLDD.', '.lLLLdDDDDDDDDDDDd.', '..........dd...dd..'],
  ['...................', '....ee.............', '...eLLe............', '.lLLkLeeDDDDDDDDD..', 'kLLLLLerLLLLLLLLLDt', '.lLLLDgLLLLLLLLLDDt', '.lLLLdDDDDDDDDDDDd.', '..........dd...dd..'],
];

// små ikoner i pratbubblorna (8×8)
const icon = (rows, pal) => (ctx, x, y) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = pal[rows[j][i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i - 4, y + j - 4, 1, 1); } } };
const ICONS = [
  icon(['..w.w...', '...w.w..', '.aaaaa..', '.akkka.h', '.bbbbbh.', '.bbbbh..', '..ddd...', 'sssssss.'], { w: '#b8b8c0', a: '#ffffff', k: '#5a3018', b: '#e8e4dc', h: '#c8c0b4', d: '#b8b2a8', s: '#d8d2c8' }),
  icon(['.rr.rr..', 'rRRrRRr.', 'rRRRRRr.', 'rRRRRRr.', '.rRRRr..', '..rRr...', '...r....', '........'], { r: '#b82a3a', R: '#f0506a' }),
  icon(['........', '.aWab...', 'abccbW..', 'bcaWcb..', 'dcbccd..', '.eeee...', '........', '........'], { a: '#f4c47c', b: '#d88c46', c: '#a85a26', d: '#7a3a18', e: '#5a2a12', W: '#fffaf0' }),
  icon(['...##...', '...#.#..', '...#..#.', '...#....', '.###....', '####....', '.##.....', '........'], { '#': '#3a2a4a' }),
];
const NOTE = [[1, 0], [2, 0], [3, 1], [1, 1], [1, 2], [1, 3], [0, 3], [0, 4], [1, 4]];
const LINES = ['Mmm, bästa kanelbullen i stan!', 'Har du provat prinsesstårtan?', 'Jag kommer hit varje dag.', 'Kanel sover alltid där.', 'Påtår, tack!', 'Så mysigt det är här.', 'Semlan är gudomlig.', 'Espresson får mig att vakna!'];

// ======================= scenen =======================
export function makeShopKafe(A) {
  const g = A.game;
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, catPurr = 0;

  // ---------- sittplatser ----------
  const seats = [];
  for (const T of TABLES) T.seats.forEach(([dx, dy, dir], k) => seats.push({ id: T.id + k, x: T.x + dx, y: T.y + dy, dir, kind: T.bench ? 'bank' : 'bord', table: T, occ: null, front: dir === 'up' }));
  STOOLS.forEach((x, k) => seats.push({ id: 'pall' + k, x, y: STOOL_Y, dir: 'up', kind: 'pall', table: null, occ: null, front: false }));
  const seatById = (id) => seats.find((s) => s.id === id);
  const tableSeats = Object.fromEntries(TABLES.map((T) => [T.id, seats.filter((s) => s.table === T)]));

  // ---------- hinder ----------
  const obstacles = [
    [CNT.x0 - 1, WALL_Y, CNT.x1 + 1, CNT.y + 1],
    [8, WALL_Y, DOOR.x0 - 4, STOOL_Y + 2], [DOOR.x1 + 4, WALL_Y, 210, STOOL_Y + 2],
    [BQ.x0 - 4, WALL_Y, BQ.x1 + 4, BQ.y + 1],
    [STOVE.x0 - 2, WALL_Y, W, WALL_Y + 8],
    [COAT.x - 5, COAT.y - 4, COAT.x + 5, COAT.y + 1],
    ...PLANTS.map((p) => [p.x - 7, p.y - 6, p.x + 7, p.y + 1]),
    [EASEL.x - 12, EASEL.y - 5, EASEL.x + 12, EASEL.y + 1],
    [UMB.x - 6, UMB.y - 4, UMB.x + 6, UMB.y + 1],
    [FLAMP.x - 5, FLAMP.y - 4, FLAMP.x + 5, FLAMP.y + 1],
    [STATION.x - 15, STATION.y - 8, STATION.x + 15, STATION.y + 1],
    [DOG.x - 9, DOG.y - 5, DOG.x + 9, DOG.y + 1],
    [PRAM.x - 12, PRAM.y - 6, PRAM.x + 12, PRAM.y + 1],
  ];
  for (const T of TABLES) {
    if (T.bench) { obstacles.push([T.x - 12, T.y - 10, T.x + 12, T.y + 1]); continue; }
    const hw = T.long ? 24 : 13;
    obstacles.push([T.x - hw, T.y - 10, T.x + hw, T.y + 1]);
    for (const [dx, dy, dir] of T.seats) if (dir === 'up') obstacles.push([T.x + dx - 6, T.y + dy - 4, T.x + dx + 6, T.y + dy + 1]);
  }
  const walker = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: [DOOR_SPOT[0], DOOR_SPOT[1] + 6] });
  walker.setObstacles(obstacles);
  walker.snapFree();
  const cams = () => lockedCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  const cam = { x: cams() };
  // var man ställer sig för att sätta sig på en plats
  for (const s of seats) {
    const cands = s.kind === 'pall' ? [[s.x, s.y + 7]] : s.kind === 'bank' ? [[s.x + 20, s.y + 6], [s.x - 20, s.y + 6], [s.x, s.table.y + 6]]
      : [[s.x + 20, s.y], [s.x - 20, s.y], [s.x + 18, s.y + 4], [s.x - 18, s.y + 4], [s.x, s.y + 12]];
    [s.ax, s.ay] = cands.find(([x, y]) => walker.walkable(x, y)) || walker.nearestFree(...cands[0]);
  }
  const freeSeats = () => seats.filter((s) => !s.occ);

  // ---------- bilder ----------
  const cache = {};
  const nightNow = () => isNight(g.min / 60);
  const rainNow = () => !!g.eventIs?.('regn');
  const bg = () => { const k = `bg${nightNow()}:${dagensOf(g)}:${rainNow()}`; return (cache[k] ||= paintBg(nightNow(), dagensOf(g), rainNow())); };
  const winOv = () => { const k = 'win' + nightNow(); return (cache[k] ||= paintWinOverlay(nightNow())); };
  const nightLight = () => (cache.light ||= paintNightLight());
  const doorFr = paintDoorFrames();
  const counter = paintCounter();
  const tableImg = paintTable();
  const longImg = paintLongTable();
  const chairDown = paintChair('down'), chairUp = paintChair('up');
  const stoolImg = paintStool();
  const plantImg = Object.fromEntries(['fikus', 'palm', 'monstera'].map((k) => [k, paintPlant(k)]));
  const coatImg = paintCoat();
  const umbImg = paintUmbrellas();
  const lampImg = paintFloorLamp();
  const stationImg = paintStation();
  const pramImg = paintPram();
  const easelImg = () => { const d = dagensOf(g); return (cache['easel' + d] ||= paintEasel(d, priceOf(g, d))); };
  const catImg = CAT_F.map((f) => { const P = new Pix(14, 8); spr(P, 0, 0, f, CAT_PAL); return P.flush(); });
  const dogImg = DOG_F.map((f) => { const P = new Pix(21, 10, -1, -1); spr(P, 0, 0, f, DOG_PAL); outline(P, 0x2a1408); return P.flush(); });
  const setImg = {};
  const setOf = (i, st) => (setImg[i + ':' + st] ||= (() => { const P = new Pix(18, 10); paintSet(P, 0, 0, KAFE_MENY[i], st); return P.flush(); })());
  const trayImg = (i) => (setImg['tray' + i] ||= (() => {
    const P = new Pix(20, 11);
    area(P, 0, 9, 20, 2, (X, Y, ii, j) => (j === 0 ? 0x8a5a34 : 0x5a3a20));
    P.px(0, 8, 0x8a5a34); P.px(19, 8, 0x8a5a34);
    paintSet(P, 1, 0, KAFE_MENY[i], 0);
    return P.flush();
  })());
  const glows = {
    lamp: glowImg(22, 16, 0xffc070, 0.28), sconce: glowImg(18, 14, 0xffc070, 0.26), candle: glowImg(8, 6, 0xffb050, 0.35),
    neon: glowImg(34, 10, 0xff8a3a, 0.2), fairy: glowImg(4, 4, 0xffd890, 0.4),
    pool: glowImg(26, 8, 0xffc070, 0.24), table: glowImg(20, 13, 0xff9c48, 0.22),
  };
  const lightLayer = () => (cache.lightLayer ||= (() => { const c = mkCanvas(W, H), x = c.getContext('2d'); x.imageSmoothingEnabled = false; return { c, x }; })());

  // ---------- baristan ----------
  const BARISTA = { skin: '#c68a5c', hair: '#1d1714', style: 'bun', top: 'tee', shirt: '#2f3440', accent: '#c9a44a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: false, beard: false, phones: false, bag: null, hat: 'beanie', cap: '#8e2a30', apron: true, build: 5, blush: true, kid: false };
  const bar = { x: 384, tx: 384, dir: 'down', walking: false, jobs: [], job: null, phase: 'idle', t: 0, idleT: 3, face: 'down', bubble: null };
  const STATIONS = { kaffe: 309, espresso: 346, latte: 346, capp: 346, choklad: 330, te: 362 };
  const trays = [];   // färdiga brickor på disken: { x, i, who, at }

  // ---------- ånga, noter, bubblor ----------
  const parts = [];
  const puff = (x, y, big = false) => parts.push({ x: x + (Math.random() - 0.5) * (big ? 4 : 1), y, vx: (Math.random() - 0.5) * 3, vy: -(big ? 10 : 5) - Math.random() * 4, age: 0, max: big ? 1.6 : 1.1 + Math.random() * 0.6, kind: 'steam' });
  let steamT = 0, noteT = 2, bubbleT = 4;

  // ---------- gästerna ----------
  const rng = rngOf((g.day | 0) * 7919 + 17);
  const guests = [];
  // väskan hänger på stolen (syns annars som en konstig klump när man sitter med ryggen mot oss)
  const lookOf = () => { const L = makeLook(rng); L.bag = null; return L; };
  const OLD_LADY = { skin: '#f6d7bf', hair: '#e6e2da', style: 'bun', top: 'sweater', shirt: '#8e5bd1', accent: '#f4f1ea', bottom: 'skirt', pants: '#5a4632', shoes: '#6b3e1e', glasses: 'round', beard: false, phones: false, bag: null, hat: null, build: 5, blush: true, kid: false };
  const sitNPC = (seat, look, extra = {}) => {
    const G = { look, seat, state: 'sit', item: Math.floor(rng() * KAFE_MENY.length), stage: Math.floor(rng() * 2), eatT: rng() * 4, eating: 0, sitT: 0, stay: 1e9, bubble: null, fixed: true, ...extra };
    seat.occ = G; guests.push(G); return G;
  };
  // stamgäster (några saknas vissa dagar – farmor på mattan är alltid här)
  for (const [id, o] of [['pall1', {}], ['pall4', {}], ['a10', {}], ['a11', {}], ['q10', {}], ['c20', { look: OLD_LADY }], ['b20', { laptop: true }], ['d10', {}], ['d13', {}]]) {
    if (rng() < 0.85 || id === 'c20') sitNPC(seatById(id), o.look || lookOf(), o);
  }
  // gäster som kommer in, beställer, fikar och går
  const mkWalker = () => { const w = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: DOOR_SPOT }); w.setObstacles(obstacles); w.speed = 38; return w; };
  for (let k = 0; k < 2; k++) guests.push({ look: lookOf(), seat: null, state: 'away', t: 2 + k * 10 + rng() * 4, w: mkWalker(), item: 0, stage: 0, eatT: 0, eating: 0, stay: 0, sitT: 0, bubble: null, fixed: false, served: false, slide: null });

  // ---------- figuren (jag) ----------
  const me = { state: 'free', seat: null, res: null, item: -1, stage: 0, eatT: 0, eating: 0, sitT: 0, slide: null, waitMsgT: -9 };
  const leftovers = [];   // fika som lämnats kvar (smulor) en stund

  function release() { if (me.res && me.res.occ === 'me' && me.res !== me.seat) me.res.occ = null; me.res = null; }
  function standUp() {
    if (!me.seat) return;
    const s = me.seat;
    if (me.item >= 0) leftovers.push({ seat: s, i: me.item, until: t + 20 });
    s.occ = null; me.seat = null; me.item = -1; me.slide = null;
    walker.px = s.ax; walker.py = s.ay; walker.stop();
    me.state = 'free';
  }
  function sitDown(s, item = -1) {
    s.occ = 'me'; me.seat = s; me.res = null; me.item = item; me.stage = 0; me.eatT = 0.4; me.sitT = 0; me.eating = 0;
    me.slide = { fx: walker.px, fy: walker.py, k: 0 };
    me.state = 'sit';
    walker.stop();
    play('click');
  }
  // gå till en plats och sätt dig (item = vad man bär på, −1 = bara vila)
  function goSit(s, item = -1) {
    release();
    me.res = s;
    walker.walkTo(s.ax, s.ay, () => {
      if (s.occ && s.occ !== 'me') {
        const alt = pickSeat();
        if (!alt) { me.state = 'free'; me.item = -1; talk.say('😕 Alla platser är upptagna – jag fikar stående.', () => ({ x: walker.px, y: walker.py - 44 })); return; }
        goSit(alt, item); return;
      }
      sitDown(s, item);
    });
    if (!me.seat) s.occ = 'me';
  }
  // bästa lediga plats: helst ett bord där man sitter vänd mot oss, nära där man står
  function pickSeat() {
    const f = freeSeats();
    if (!f.length) return null;
    const score = (s) => Math.hypot(s.ax - walker.px, s.ay - walker.py) + (s.dir === 'up' ? 140 : 0) + (s.kind === 'pall' ? 60 : 0) + (leftovers.some((l) => l.seat === s) ? 200 : 0);
    return f.sort((a, b) => score(a) - score(b))[0];
  }

  // ---------- köpet ----------
  function buy(i) {
    const m = KAFE_MENY[i];
    if (!m) return { ok: false, msg: 'Det finns inte på menyn.' };
    if (me.state === 'wait' || me.state === 'toCounter' || me.state === 'carry') return { ok: false, msg: 'Baristan fixar redan din beställning!' };
    const price = priceOf(g, i);
    if (g.money < price) return { ok: false, msg: 'Du har inte råd!' };
    if (me.state === 'sit') standUp();
    release();
    const n = cupsToday(g), en = energyOf(m, n);
    g.money -= price;
    g.hunger = c100(g.hunger + m.fill);
    g.energy = c100(g.energy + en);
    g.passTime(15);
    g.save();
    addCup(g);
    play('coin');
    boughtHere = true;
    me.item = i;
    const order = () => { me.state = 'wait'; bar.jobs.push({ who: 'me', i, x: walker.px }); };
    const atCounter = Math.abs(walker.py - ORDER_Y) < 6 && walker.px > 236 && walker.px < 426 && !walker.path.length;
    if (atCounter) order();
    else { me.state = 'toCounter'; walker.walkTo(clamp(walker.px, 336, 412), ORDER_Y, order); }
    return { ok: true, price, fill: m.fill, energy: en };
  }

  function openMenu() {
    const n = cupsToday(g), d = dagensOf(g);
    bar.bubble = { icon: ICONS[0], until: t + 2.5 };
    const rows = KAFE_MENY.map((m, i) => {
      const price = priceOf(g, i), en = energyOf(m, n);
      return `<div class="prow" style="grid-template-columns:84px 1fr auto;${i === d ? 'background:#fff8d6' : ''}">
        <canvas data-ic="${i}" width="20" height="11" style="width:80px;height:44px;image-rendering:pixelated;background:#e8dcc4;border:2px solid #17151a"></canvas>
        <span class="nm">${m.icon} ${m.name}${i === d ? ' <b style="color:#c9323a">★ DAGENS −5 kr</b>' : ''}<br><small class="sp">+${m.fill} mättnad · +${en} energi</small></span>
        <button class="btn btn-small btn-go" data-buy="${i}" data-key="${i + 1}" ${g.money < price ? 'disabled' : ''}>☕ ${fmt(price)} <kbd>${i + 1}</kbd></button>
      </div>`;
    }).join('');
    const body = `<p style="font-size:19px;margin:0 0 8px">💰 <b>${fmt(g.money)}</b> · 🍽️ Mättnad <b>${Math.round(g.hunger)}</b>/100 · ⚡ Energi <b>${Math.round(g.energy)}</b>/100</p>
      <div class="plist">${rows}</div>
      <p style="font-size:16px;margin:10px 0 0;color:#6d6660">Fikat tar en kvart – du sätter dig vid ett ledigt bord. Koffeinet biter sämre för varje kopp samma dag${n ? ` (du har druckit ${n} i dag)` : ''}.</p>`;
    const dlg = openModal('☕ Kaféet – vad får det lov att vara?', body, [{ label: 'Nej tack', onClick: closeModal }]);
    dlg.querySelectorAll('canvas[data-ic]').forEach((cv) => {
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      x.drawImage(setOf(+cv.dataset.ic, 0), 1, 1);
    });
    dlg.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.buy, r = buy(i);
      if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      closeModal();
      toast(`${KAFE_MENY[i].icon} ${KAFE_MENY[i].name}! +${r.fill} mättnad, +${r.energy} energi`, 'good');
    }));
  }

  // ---------- klickbara saker ----------
  // påtår ingår när man har köpt något här (en gång per besök)
  let boughtHere = false, patarTaken = false, dogHappy = -9;
  function patar() {
    if (patarTaken) { talk.say('☕ Jag har redan tagit min påtår.', () => ({ x: walker.px, y: walker.py - 44 })); play('click'); return; }
    if (!boughtHere) { talk.say('☕ Påtår ingår när man har köpt en fika.', () => ({ x: walker.px, y: walker.py - 44 })); play('click'); return; }
    patarTaken = true;
    g.energy = c100(g.energy + 3);
    g.passTime(5);
    g.save();
    play('ok');
    talk.say('☕ Påtår! +3 ⚡', () => ({ x: walker.px, y: walker.py - 44 }));
    for (let i = 0; i < 6; i++) puff(STATION.x - 11, STATION.y - 29);
  }
  const hot = [
    { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 12, DOOR.x1 + 3, WALL_Y + 10], go: () => DOOR_SPOT, act: () => { play('door'); A.go('city'); } },
    { id: 'katt', r: [CAT.x - 1, CAT.y - 9, CAT.x + 15, CAT.y + 1], go: () => [CAT.x + 8, BQ.y + 6], act: () => { play('chirp'); catPurr = t + 3; talk.say('🐈 Mjau! Kanel spinner nöjt och sträcker på sig.', { x: CAT.x + 7, y: CAT.y - 11 }); } },
    { id: 'hund', r: [DOG.x - 11, DOG.y - 11, DOG.x + 11, DOG.y + 2], go: () => [DOG.x - 18, DOG.y + 5], act: () => { play('chirp'); dogHappy = t + 4; talk.say('🐕 Vift vift! Han gillar dig, säger farmor.', { x: DOG.x, y: DOG.y - 14 }); } },
    { id: 'patar', r: [STATION.x - 15, STATION.y - 30, STATION.x + 15, STATION.y + 1], go: () => [STATION.x, STATION.y + 7], act: patar },
    { id: 'skylt', r: [EASEL.x - 13, EASEL.y - 31, EASEL.x + 13, EASEL.y + 1], go: () => [EASEL.x + 18, EASEL.y + 3], act: () => { play('click'); openMenu(); } },
    { id: 'tavla', r: [BOARD.x0, BOARD.y0, BOARD.x1, BOARD.y1], go: () => [340, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'disk', r: [CNT.x0, 30, CNT.x1, CNT.y + 2], go: (x) => [clamp(x, 336, 412), ORDER_Y], act: () => { play('click'); openMenu(); } },
  ];
  const spotAt = (x, y) => hot.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const seatAt = (x, y) => seats.find((s) => {
    if (s.kind === 'pall') return Math.abs(x - s.x) < 8 && y > s.y - 36 && y < s.y + 3;
    if (s.kind === 'bank') return Math.abs(x - s.x) < 11 && y > s.y - 36 && y < s.table.y + 2;
    return Math.abs(x - s.x) < 9 && y > s.y - 34 && y < s.y + 3;
  });

  // ---------- uppdatering ----------
  function updateBarista(dt) {
    const B = bar;
    if (!B.job && B.jobs.length) { B.job = B.jobs.shift(); B.phase = 'toStation'; B.tx = STATIONS[KAFE_MENY[B.job.i].cup] || 346; }
    const dx = B.tx - B.x;
    B.walking = Math.abs(dx) > 0.5;
    if (B.walking) { const st = Math.min(Math.abs(dx), 64 * dt); B.x += Math.sign(dx) * st; B.dir = dx < 0 ? 'left' : 'right'; return; }
    B.x = B.tx;
    B.t += dt;
    if (B.job) {
      const cup = KAFE_MENY[B.job.i].cup;
      if (B.phase === 'toStation') { B.phase = 'brew'; B.t = 0; B.dir = 'up'; if (cup !== 'kaffe') play('slide'); }
      else if (B.phase === 'brew') {
        B.dir = 'up';
        if (cup !== 'kaffe' && Math.random() < dt * 24) puff(318, 60, true);
        if (B.t > 1.3) { B.phase = 'serve'; B.tx = clamp(B.job.x, 336, 384); B.t = 0; }
      } else if (B.phase === 'serve') {
        B.dir = 'down';
        trays.push({ x: Math.round(B.x) - 10, i: B.job.i, who: B.job.who, at: t });
        if (B.job.who === 'me') play('ok');
        B.job = null; B.phase = 'idle'; B.idleT = 2 + Math.random() * 3; B.face = 'down';
      }
      return;
    }
    // ingen beställning: torka disken, ordna i montern, stå vid kassan
    B.idleT -= dt;
    if (B.idleT <= 0) {
      B.tx = [384, 276, 346, 300, 384, 362][Math.floor(Math.random() * 6)];
      B.idleT = 3 + Math.random() * 5;
      B.face = B.tx === 346 || B.tx === 300 ? 'up' : 'down';
    } else B.dir = B.face;
  }

  function updateGuest(G, dt) {
    if (G.slide) { G.slide.k += dt * 4; if (G.slide.k >= 1) G.slide = null; }
    if (G.state === 'sit') {
      G.sitT += dt; G.eatT -= dt;
      if (G.eating > 0) G.eating -= dt;
      if (G.eatT <= 0) { G.eating = 0.55; G.eatT = 2.5 + Math.random() * 4; }
      if (G.fixed) return;
      if (G.sitT > G.stay * 0.45 && G.stage === 0) G.stage = 1;
      if (G.sitT > G.stay * 0.85 && G.stage === 1) G.stage = 2;
      if (G.sitT > G.stay) {
        leftovers.push({ seat: G.seat, i: G.item, until: t + 12 });
        G.seat.occ = null; G.w.px = G.seat.ax; G.w.py = G.seat.ay; G.seat = null;
        G.state = 'leave'; G.w.walkTo(...DOOR_SPOT, () => { G.state = 'away'; G.t = 8 + Math.random() * 18; });
      }
      return;
    }
    if (G.fixed) return;
    if (G.state === 'away') {
      G.t -= dt;
      if (G.t > 0) return;
      const f = freeSeats().filter((s) => s.kind !== 'pall' || Math.random() < 0.4);
      if (!f.length) { G.t = 6; return; }
      G.seat = f[Math.floor(Math.random() * f.length)];
      G.seat.occ = G; G.look = lookOf(); G.item = Math.floor(Math.random() * KAFE_MENY.length); G.stage = 0; G.served = false;
      G.w.px = DOOR_SPOT[0]; G.w.py = DOOR_SPOT[1]; G.w.stop();
      G.state = 'enter';
      const ox = 340 + Math.floor(Math.random() * 3) * 14;
      G.w.walkTo(ox, ORDER_Y + 2, () => { G.state = 'order'; bar.jobs.push({ who: G, i: G.item, x: G.w.px }); });
      return;
    }
    if (G.state === 'order') {
      G.w.dir = 'up';
      const k = trays.findIndex((tr) => tr.who === G && t - tr.at > 0.7);
      if (k >= 0) {
        trays.splice(k, 1);
        G.state = 'carry';
        const s = G.seat;
        G.w.walkTo(s.ax, s.ay, () => { G.state = 'sit'; G.sitT = 0; G.stay = 25 + Math.random() * 25; G.eatT = 1; G.slide = { fx: G.w.px, fy: G.w.py, k: 0 }; });
      }
    }
    G.w.update(dt);
  }

  function updateMe(dt) {
    if (me.state === 'wait') {
      walker.dir = 'up';
      const k = trays.findIndex((tr) => tr.who === 'me' && t - tr.at > 0.7);
      if (k >= 0) {
        trays.splice(k, 1);
        const s = pickSeat();
        if (!s) { me.state = 'free'; me.item = -1; talk.say('😕 Alla bord är upptagna – jag fikar stående vid disken.', () => ({ x: walker.px, y: walker.py - 44 })); return; }
        me.state = 'carry';
        goSit(s, me.item);
      }
    }
    if (me.state === 'carry' && !walker.path.length && !me.seat && me.res && me.res.occ === 'me') {
      // framme men walkTo:s callback hann inte (t.ex. ingen väg) – sätt dig ändå
      sitDown(me.res, me.item);
    }
    if (me.state === 'sit') {
      me.sitT += dt; me.eatT -= dt;
      if (me.slide) { me.slide.k += dt * 4; if (me.slide.k >= 1) me.slide = null; }
      if (me.eating > 0) me.eating -= dt;
      if (me.item >= 0) {
        if (me.eatT <= 0 && me.stage < 2) { me.eating = 0.6; me.eatT = 1.6; }
        if (me.sitT > 3.5 && me.stage === 0) me.stage = 1;
        if (me.sitT > 7 && me.stage === 1) { me.stage = 2; play('ok'); }
        if (me.sitT > 9.5) { standUp(); toast('😋 Mums! Tack för fikat.', 'good'); }
      }
    }
  }

  // ---------- ritning ----------
  function seatPos(s) {
    const slide = s.occ === 'me' ? me.slide : s.occ?.slide;
    if (!slide) return [s.x, s.y];
    const k = clamp(slide.k, 0, 1);
    return [slide.fx + (s.x - slide.fx) * k, slide.fy + (s.y - slide.fy) * k];
  }
  function drawSeated(ctx, s) {
    const o = s.occ;
    if (!o) return;
    const [x, y] = seatPos(s);
    const sliding = o === 'me' ? me.slide : o.slide;
    if (o === 'me') {
      if (!me.seat) return;
      const frame = sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : me.eating > 0 ? 6 : 5;
      drawPerson(ctx, x, y, A.avatar.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, frame);
      if (worldFolksHere(A).length) nameTag(ctx, x, y - 50, A.avatar);
      const mine = worldMyEmote();
      if (mine) emoteBubble(ctx, x, y - 58, mine);
      return;
    }
    if (o.state !== 'sit') return;
    const frame = sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : o.eating > 0 ? 6 : 5;
    drawPerson(ctx, x, y, o.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, frame);
  }
  // vad som står på bordet (eller bardisken) framför en plats
  function drawPlate(ctx, s) {
    const o = s.occ;
    let item = -1, stage = 0;
    if (o === 'me') { if (me.seat === s) { item = me.item; stage = me.stage; } }
    else if (o && o.state === 'sit') { item = o.item; stage = o.stage; }
    else { const l = leftovers.find((l) => l.seat === s); if (l) { item = l.i; stage = 2; } }
    if (item < 0) return;
    let px, py;
    if (s.kind === 'pall') { px = s.x + 2; py = LEDGE - 9; }
    else if (s.front) {
      // samma bordsyta som platsen mittemot – fatet syns bara om den är tom
      const b = tableSeats[s.table.id].filter((q) => !q.front).sort((p, q) => Math.abs(p.x - s.x) - Math.abs(q.x - s.x))[0];
      if (b && (b.occ || leftovers.some((l) => l.seat === b))) return;
      px = s.table.long ? b.x - 8 : s.table.x - 9; py = s.table.y - 21;
    } else { px = s.x - 8; py = s.table.y - 22; }
    ctx.drawImage(setOf(item, stage), px, py);
    if (HOT[KAFE_MENY[item].cup] && stage < 2 && Math.random() < 0.02) puff(px + (KAFE_MENY[item].cake ? 13 : 7), py + 3);
    if (o && o !== 'me' && o.laptop) {
      // bärbar dator: vi ser locket bakifrån
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(s.x - 6, s.table.y - 26, 12, 8);
      ctx.fillStyle = '#c8ced6'; ctx.fillRect(s.x - 6, s.table.y - 26, 12, 1);
      ctx.fillStyle = '#6a7078'; ctx.fillRect(s.x - 6, s.table.y - 19, 12, 1);
      ctx.fillStyle = '#e8b230'; ctx.fillRect(s.x - 1, s.table.y - 23, 2, 2);
    }
  }
  function drawCandle(ctx, x, y) {
    ctx.fillStyle = 'rgba(232,244,248,0.6)'; ctx.fillRect(x - 1, y - 3, 3, 3);
    ctx.fillStyle = '#faf6ee'; ctx.fillRect(x, y - 3, 1, 2);
    const f = Math.sin(t * 13 + x) > 0.2;
    ctx.fillStyle = '#ffb040'; ctx.fillRect(x, y - 5, 1, 2);
    ctx.fillStyle = f ? '#fff4c0' : '#ffd070'; ctx.fillRect(x, y - 5 - (f ? 1 : 0), 1, 1);
  }
  function drawTrayHeld(ctx, x, y, dir, i) {
    if (i < 0) return;
    const tx = dir === 'left' ? x - 20 : dir === 'right' ? x + 1 : x - 10;
    ctx.drawImage(trayImg(i), Math.round(tx), Math.round(y) - (dir === 'up' ? 22 : 24));
  }
  function drawClock(ctx) {
    const cx = (PIL.x0 + PIL.x1) >> 1, cy = 30;
    ctx.fillStyle = '#6a4e1c'; ctx.fillRect(cx - 7, cy - 6, 15, 13); ctx.fillRect(cx - 6, cy - 7, 13, 15);
    ctx.fillStyle = '#d0aa50'; ctx.fillRect(cx - 6, cy - 5, 13, 11); ctx.fillRect(cx - 5, cy - 6, 11, 13);
    ctx.fillStyle = '#f6e0a0'; ctx.fillRect(cx - 5, cy - 6, 5, 1); ctx.fillRect(cx - 6, cy - 5, 1, 4);
    ctx.fillStyle = '#faf4e4'; ctx.fillRect(cx - 5, cy - 4, 11, 9); ctx.fillRect(cx - 4, cy - 5, 9, 11);
    ctx.fillStyle = '#8a7a64';
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.sin(a) * 4.4), Math.round(cy - Math.cos(a) * 4.4), 1, 1); }
    const m = g.min % 60, h = (g.min / 60) % 12;
    const ma = m / 60 * Math.PI * 2, ha = h / 12 * Math.PI * 2;
    ctx.fillStyle = '#1a1210'; ctxLine(ctx, cx, cy, cx + Math.sin(ha) * 2.6, cy - Math.cos(ha) * 2.6);
    ctx.fillStyle = '#3a2a1a'; ctxLine(ctx, cx, cy, cx + Math.sin(ma) * 4, cy - Math.cos(ma) * 4);
    ctx.fillStyle = '#c9323a'; ctx.fillRect(cx, cy, 1, 1);
  }
  function drawCat(ctx) {
    const flick = (t % 7) < 0.5 || catPurr > t;
    ctx.drawImage(catImg[flick ? 1 : 0], CAT.x, CAT.y - 8);
    if (Math.sin(t * 2.2) > 0) { ctx.fillStyle = '#e8a060'; ctx.fillRect(CAT.x + 9, CAT.y - 6, 3, 1); }
    if (catPurr > t) {
      const k = (catPurr - t) / 3, hy = Math.round(CAT.y - 12 - (1 - k) * 8);
      ctx.fillStyle = `rgba(232,72,96,${k.toFixed(2)})`;
      for (const [a, b] of [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) ctx.fillRect(CAT.x + 6 + a, hy + b, 1, 1);
    }
  }

  function drawDog(ctx) {
    const awake = dogHappy > t || Math.hypot(walker.px - DOG.x, walker.py - DOG.y) < 34;
    const f = awake ? (Math.floor(t * (dogHappy > t ? 9 : 4)) & 1) : 2;
    ctx.drawImage(dogImg[f], DOG.x - 10, DOG.y - 9);
    if (!awake) {
      // små Z som stiger när Sixten sover
      const k = (t * 0.6) % 1;
      ctx.fillStyle = `rgba(250,246,238,${(0.9 * (1 - k)).toFixed(2)})`;
      const zx = DOG.x - 9 + Math.round(k * 3), zy = DOG.y - 11 - Math.round(k * 7);
      ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
    }
  }

  // ---------- trafiken utanför ----------
  const peds = [], cars = [];
  let pedT = 1, carT = 2;
  const carImg = {};
  function carSprite(color, dir, night) {
    const k = color + dir + night;
    if (carImg[k]) return carImg[k];
    const P = new Pix(28, 12);
    const c = parseInt(color.slice(1), 16);
    area(P, 2, 4, 24, 5, (X, Y, i, j) => (j === 0 ? mix(c, WHITE, 0.3) : j === 4 ? mul(c, 0.6) : c));
    area(P, 7, 0, 13, 4, (X, Y, i, j) => (i === 0 || i === 12 ? c : j === 0 ? mix(c, WHITE, 0.2) : night ? 0x2a2a40 : (i + j) % 5 === 0 ? 0xe8f4fa : 0x8ab4d0));
    P.vl(13, 1, 3, c);
    for (const wx of [7, 20]) { P.rect(wx - 2, 8, 5, 4, 0x1a1a1e); P.px(wx, 9, 0x8a8a90); }
    P.px(dir > 0 ? 25 : 2, 5, night ? 0xfff6b0 : 0xf8f0d0); P.px(dir > 0 ? 2 : 25, 5, 0xd8303a);
    outline(P);
    return (carImg[k] = P.flush());
  }
  function drawCar(ctx, c, night) {
    ctx.drawImage(carSprite(c.color, c.dir, night), Math.round(c.x) - 14, c.y - 11);
    if (night) { ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.fillRect(Math.round(c.x) + (c.dir > 0 ? 12 : -24), c.y - 6, 12, 2); }
  }
  function updateStreet(dt) {
    pedT -= dt; carT -= dt;
    if (pedT <= 0) { const dir = Math.random() < 0.5 ? 'left' : 'right'; peds.push({ x: dir === 'right' ? -14 : 226, dir, look: makeLook(), sp: 16 + Math.random() * 10, ph: Math.random() }); pedT = 2.5 + Math.random() * 6; }
    if (carT <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; cars.push({ x: dir > 0 ? -20 : 232, dir, y: dir > 0 ? 51 : 47, color: ['#c9323a', '#3a7bd5', '#f0b429', '#e8e3d6', '#2f3440', '#46a35a'][Math.floor(Math.random() * 6)], sp: 60 + Math.random() * 30 }); carT = 3 + Math.random() * 7; }
    for (const p of peds) { p.x += (p.dir === 'right' ? 1 : -1) * p.sp * dt; p.ph += dt * p.sp / 22; }
    for (const c of cars) c.x += c.dir * c.sp * dt;
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].x < -20 || peds[i].x > 232) peds.splice(i, 1);
    for (let i = cars.length - 1; i >= 0; i--) if (cars[i].x < -30 || cars[i].x > 244) cars.splice(i, 1);
    cars.sort((a, b) => a.y - b.y);
  }

  let doorOpen = 0, doorWas = false;
  function updateDoor(dt) {
    const near = (x, y) => x > DOOR.x0 - 10 && x < DOOR.x1 + 10 && y < WALL_Y + 14;
    const any = near(walker.px, walker.py) || guests.some((G) => !G.fixed && (G.state === 'enter' || G.state === 'leave') && near(G.w.px, G.w.py));
    doorOpen += ((any ? 1 : 0) - doorOpen) * Math.min(1, dt * 7);
    if (any && !doorWas) play('chirp');
    doorWas = any;
  }

  function updateParts(dt) {
    steamT -= dt;
    if (steamT <= 0) { puff(318, 60); steamT = 0.35 + Math.random() * 0.4; }
    noteT -= dt;
    if (noteT <= 0) { parts.push({ x: 414 + Math.random() * 4, y: 50, vx: (Math.random() - 0.5) * 4, vy: -6, age: 0, max: 2.4, kind: 'note' }); noteT = 1.4 + Math.random() * 2.5; }
    for (const p of parts) { p.age += dt; p.x += p.vx * dt + Math.sin(p.age * 5 + p.y) * dt * 2; p.y += p.vy * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
    if (parts.length > 160) parts.splice(0, parts.length - 160);
    // någon säger något ibland
    bubbleT -= dt;
    if (bubbleT <= 0) {
      const sitting = guests.filter((G) => G.state === 'sit' && G.seat);
      if (sitting.length) { const G = sitting[Math.floor(Math.random() * sitting.length)]; G.bubble = { icon: ICONS[Math.floor(Math.random() * ICONS.length)], until: t + 2.2 }; }
      bubbleT = 5 + Math.random() * 7;
    }
    for (let i = leftovers.length - 1; i >= 0; i--) if (leftovers[i].until < t || leftovers[i].seat.occ) leftovers.splice(i, 1);
  }

  function drawWorld(ctx, cx, vw) {
    const hour = g.min / 60, night = isNight(hour), dark = darkness(hour);
    // I kväll byggs bordsljusens sken i ett eget lager i djupordning: ett bord lägger till
    // sitt sken, och allt som ritas framför det (folk, stolsryggar) suddar ut det igen.
    // Då hamnar pölen på bordsskivan och på den som sitter vänd mot ljuset – inte på
    // nacken hos den som sitter med ryggen åt oss.
    const lit = night || dark > 0.2;
    const LL = lit ? lightLayer() : null;
    if (LL) { LL.x.globalCompositeOperation = 'source-over'; LL.x.globalAlpha = 1; LL.x.clearRect(0, 0, W, H); }
    ctx.drawImage(bg(), 0, 0);
    // ---- utanför: bilar och folk som går förbi (klippt till glaset) ----
    ctx.save();
    ctx.beginPath();
    for (const w of WINS) ctx.rect(w.x0, WIN_T, w.x1 - w.x0, WIN_B - WIN_T);
    if (doorOpen > 0.05) ctx.rect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top);
    else ctx.rect(DOOR.x0 + 4, DOOR.top + 4, DOOR.x1 - DOOR.x0 - 8, 30);
    ctx.clip();
    for (const c of cars) drawCar(ctx, c, night);
    for (const p of peds) drawPerson(ctx, p.x, 72, p.look, p.dir, WALK_SEQ[Math.floor(p.ph * 8.5) % 4]);
    if (g.eventIs('regn')) {
      ctx.fillStyle = 'rgba(170,195,235,0.55)';
      for (let i = 0; i < 40; i++) { const rx = 14 + ((i * 47.3 + t * 18) % 196), ry = 14 + ((i * 29.1 + t * (90 + (i % 5) * 14)) % 68); ctx.fillRect(rx | 0, ry | 0, 1, 3); }
    }
    if (!night && dark > 0) { ctx.fillStyle = `rgba(14,16,44,${dark})`; ctx.fillRect(10, 14, 200, WALL_Y - 14); }
    ctx.restore();
    // dörren och ringklockan
    ctx.drawImage(doorFr[Math.round(clamp(doorOpen, 0, 1) * (doorFr.length - 1))], DOOR.x0, DOOR.top);
    const swing = doorOpen > 0.1 ? Math.round(Math.sin(t * 18)) : 0;
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(DOOR.x0 + 3, DOOR.top - 1, 1, 2);
    ctx.fillStyle = '#d0aa50'; ctx.fillRect(DOOR.x0 + 2 + swing, DOOR.top + 1, 3, 3);
    ctx.fillStyle = '#f6e0a0'; ctx.fillRect(DOOR.x0 + 2 + swing, DOOR.top + 1, 1, 1);
    ctx.fillStyle = '#6a4e1c'; ctx.fillRect(DOOR.x0 + 3 + swing, DOOR.top + 4, 1, 1);
    ctx.drawImage(winOv(), 0, 0);
    if (g.eventIs('regn')) {
      ctx.fillStyle = 'rgba(220,235,255,0.5)';
      for (const w of WINS) for (let i = 0; i < 14; i++) { const dx = (hash(i, w.x0, 3) * (w.x1 - w.x0 - 2)) | 0, dy = ((hash(i, w.x0, 4) * 40 + t * (4 + i % 3)) % 40) | 0; ctx.fillRect(w.x0 + 1 + dx, WIN_T + 2 + dy, 1, 2); }
    }
    // ---- väggen: klockan, maskinens lampor ----
    drawClock(ctx);
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#6fe08a' : '#2a6a3a'; ctx.fillRect(345, 56, 1, 1);
    const needle = Math.round(Math.sin(t * 0.7) * 0.6);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(334 + needle, 49, 1, 1); ctx.fillRect(358, 49 + (needle > 0 ? 1 : 0), 1, 1);

    // ---- allt på golvet i djupordning ----
    const items = [];
    // fig = står framför ljuset och skymmer det, light = lägger till sken i ljuslagret
    const add = (fy, draw, o = {}) => items.push({ fy, draw, fig: !!o.fig, light: o.light || null });
    add(CNT.y, () => {
      const bf = bar.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 1.7) > 0.93 ? 4 : 0);
      drawPerson(ctx, Math.round(bar.x), BARI_Y, BARISTA, bar.dir, bf);
      ctx.drawImage(counter.img, counter.ox, counter.oy);
      for (const tr of trays) ctx.drawImage(trayImg(tr.i), tr.x, CNT.top - 7);
    });
    for (const T of TABLES) {
      const ts = tableSeats[T.id];
      add(T.y, () => {
        for (const s of ts) if (!s.front) {
          if (s.kind === 'bord') ctx.drawImage(chairDown.img, s.x - 8, s.y - 25);
          drawSeated(ctx, s);
        }
        if (T.long) ctx.drawImage(longImg, T.x - 24, T.y - 23);
        else ctx.drawImage(tableImg, T.x - 14, T.y - 17);
        for (const s of ts) drawPlate(ctx, s);
        if ((night || dark > 0.15) && !T.bench) drawCandle(ctx, T.x + (T.long ? 21 : 7), T.y - 14);
      }, T.bench ? {} : { light: (x) => {
        const lx = T.x + (T.long ? 21 : 7);
        x.globalAlpha = 1; x.drawImage(glows.table, lx - 21, T.y - 29);                  // pölen på bordsskivan
        x.globalAlpha = 0.75 + 0.25 * Math.sin(t * 9 + T.x);                             // levande ljuslåga
        x.drawImage(glows.candle, lx - 9, T.y - 25);
      } });
      for (const s of ts) if (s.front) add(s.y, (c) => {
        c.drawImage(chairUp.img, s.x - 8, s.y - 25);
        drawSeated(c, s);
        c.drawImage(chairUp.front, s.x - 8, s.y - 25);
      }, { fig: true });
    }
    for (const s of seats) if (s.kind === 'pall') add(s.y, () => { drawPlate(ctx, s); ctx.drawImage(stoolImg, s.x - 6, s.y - 12); drawSeated(ctx, s); });
    for (const p of PLANTS) { const im = plantImg[p.kind]; add(p.y, () => ctx.drawImage(im.img, p.x - im.ox, p.y - im.oy)); }
    add(COAT.y, () => ctx.drawImage(coatImg.img, COAT.x - coatImg.ox, COAT.y - coatImg.oy));
    add(UMB.y, () => ctx.drawImage(umbImg.img, UMB.x - umbImg.ox, UMB.y - umbImg.oy));
    add(EASEL.y, () => ctx.drawImage(easelImg(), EASEL.x - 13, EASEL.y - 30));
    add(FLAMP.y, () => ctx.drawImage(lampImg.img, FLAMP.x - lampImg.ox, FLAMP.y - lampImg.oy));
    add(STATION.y, () => ctx.drawImage(stationImg.img, STATION.x - stationImg.ox, STATION.y - stationImg.oy));
    add(DOG.y, () => drawDog(ctx));
    add(PRAM.y, () => ctx.drawImage(pramImg.img, PRAM.x - pramImg.ox, PRAM.y - pramImg.oy));
    add(BQ.y - 0.5, () => drawCat(ctx));
    for (const G of guests) if (!G.fixed && (G.state === 'enter' || G.state === 'order' || G.state === 'carry' || G.state === 'leave')) {
      add(G.w.py, (c) => {
        const carry = G.state === 'carry', walking = G.w.path.length > 0;
        const fr = carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0;
        const dir = G.state === 'order' ? 'up' : G.w.dir;
        if (carry && dir === 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.item);
        drawPerson(c, G.w.px, G.w.py, G.look, dir, fr);
        if (carry && dir !== 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.item);
      }, { fig: true });
    }
    for (const d of folkDrawables(A, t)) add(d.fy, (c) => d.draw(c), { fig: true });
    if (me.state !== 'sit') {
      const carry = me.state === 'carry';
      const sd = selfDrawable(A, walker, t, { carry, folksHere: worldFolksHere(A).length });
      add(walker.py + 0.01, (c) => {
        if (carry && walker.dir === 'up') drawTrayHeld(c, walker.px, walker.py, walker.dir, me.item);
        sd.draw(c);
        if (carry && walker.dir !== 'up') drawTrayHeld(c, walker.px, walker.py, walker.dir, me.item);
      }, { fig: true });
    }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) {
      it.draw(ctx);
      if (!LL) continue;
      if (it.fig) { LL.x.globalCompositeOperation = 'destination-out'; LL.x.globalAlpha = 0.9; it.draw(LL.x); }
      if (it.light) { LL.x.globalCompositeOperation = 'lighter'; it.light(LL.x); }
    }

    // ---- ånga och noter ----
    for (const p of parts) {
      const k = 1 - p.age / p.max;
      if (p.kind === 'note') { ctx.fillStyle = rgba(0x3a2a1a, Math.min(1, k * 1.5).toFixed(2)); for (const [a, b] of NOTE) ctx.fillRect(Math.round(p.x) + a, Math.round(p.y) + b, 1, 1); continue; }
      ctx.fillStyle = `rgba(255,255,255,${(k * 0.55).toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.age < 0.4 ? 1 : 2, 1);
    }

    // ---- ljuset i kväll: rummet mörknar, lamporna lägger varma pölar (förmålad ljuskarta) ----
    if (night || dark > 0.2) {
      const k = night ? 1 : Math.min(1, (dark - 0.2) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';                                // blålila skuggor
      ctx.globalAlpha = k;
      ctx.fillStyle = '#8a7a9a';
      ctx.fillRect(cx, 0, vw, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.drawImage(nightLight(), 0, 0);
      ctx.drawImage(LL.c, 0, 0);                                                 // bordsljusen (skymda av folk framför)
      for (const w of WINS) for (let x = w.x0 + 2, n = 0; x < w.x1 - 1; x += 5, n++) {
        ctx.globalAlpha = k * (0.55 + 0.45 * Math.sin(t * 2 + n * 1.7));
        ctx.drawImage(glows.fairy, x - 4, WIN_T + 2 + Math.round(Math.sin((x - w.x0) / (w.x1 - w.x0) * Math.PI) * 2) - 4);
      }
      ctx.restore();
    }
    // pratbubblor (ovanpå ljuset så att de syns även i kväll)
    for (const G of guests) if (G.bubble && G.bubble.until > t && G.seat && G.state === 'sit') {
      const [x, y] = seatPos(G.seat);
      if (G.bubble.text) sayBubble(ctx, Math.round(x), Math.round(y) - (G.seat.front ? 38 : 42), G.bubble.text);
      else iconBubble(ctx, Math.round(x) - 2, Math.round(y) - (G.seat.front ? 38 : 42), G.bubble.icon);
    }
    if (bar.bubble && bar.bubble.until > t) iconBubble(ctx, Math.round(bar.x) - 2, BARI_Y - 42, bar.bubble.icon);
  }

  function update(dt) {
    t += dt;
    walker.update(dt);
    updateMe(dt);
    updateBarista(dt);
    for (const G of guests) updateGuest(G, dt);
    updateStreet(dt);
    updateDoor(dt);
    updateParts(dt);
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (cams() - cam.x) * k;
  }
  // låt trafiken och ångan komma igång direkt när man kliver in
  for (let i = 0; i < 90; i++) { updateStreet(1 / 15); updateParts(1 / 15); }

  return {
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return me.seat ? me.seat.y : walker.py; },
    _debug: {
      spot: (id) => {
        const h = hot.find((h) => h.id === id);
        if (h) return { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 };
        const s = seatById(id);
        return s ? { x: s.x - cam.x, y: s.y - 14 } : null;
      },
      buy: (i) => buy(i | 0),
      menu: () => openMenu(),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = cams(); },
      teleport: (x, y) => { if (me.state === 'sit') standUp(); walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = cams(); },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      state: () => ({ me: me.state, seat: me.seat?.id || null, stage: me.stage, x: Math.round(walker.px), y: Math.round(walker.py), barista: bar.phase, guests: guests.map((G) => G.state), money: g.money, hunger: g.hunger, energy: g.energy }),
      seats: () => seats.map((s) => ({ id: s.id, x: s.x, y: s.y, occ: s.occ === 'me' ? 'me' : s.occ ? 'npc' : null })),
      sit: (id) => { const s = seatById(id); if (s && !s.occ) goSit(s); },
      cam: () => cam.x,
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W);
        return c.toDataURL('image/png');
      },
    },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      if (me.state === 'wait' || me.state === 'toCounter') {
        if (t - me.waitMsgT > 2) { toast('☕ Baristan gör i ordning din beställning …'); me.waitMsgT = t; }
        return;
      }
      if (me.state === 'carry') {
        // med brickan i händerna: klick på ett ledigt bord styr om dit, annars en påminnelse
        const s = seatAt(x, y);
        if (s && !s.occ) { goSit(s, me.item); play('click'); return; }
        if (t - me.waitMsgT > 2) { talk.say('☕ Klicka på ett ledigt bord så sätter jag mig där.', () => ({ x: walker.px, y: walker.py - 44 })); me.waitMsgT = t; }
        return;
      }
      if (me.state === 'sit') standUp();
      release();
      const h = spotAt(x, y);
      if (h) { const [gx, gy] = h.go(x); walker.walkTo(gx, gy, h.act); return; }
      const s = seatAt(x, y);
      if (s && !s.occ) { goSit(s); return; }
      if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') {
        s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 }; // repliken i en pratbubbla ovanför gästen
        play('click');
        return;
      }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy)?.id || null; hoverT = t; },
    draw(ctx) {
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      drawWorld(ctx, cx, VW);
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      // skylt i nederkanten när man pekar på disken, dörren eller katten
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const h = hoverId && t - hoverT < 3 ? hoverId : null;
      const label = h === 'disk' || h === 'tavla' ? 'MENYN - KLICKA PÅ DISKEN' : h === 'skylt' ? 'DAGENS FIKA - 5 KR BILLIGARE' : h === 'dorr' ? 'GÅ UT' : h === 'katt' ? 'KAFÉKATTEN KANEL'
        : h === 'hund' ? 'TAXEN SIXTEN' : h === 'patar' ? 'PÅTÅR - INGÅR NÄR DU FIKAT' : null;
      if (label) {
        const w = textW(SMALL, label) + 10;
        ctx.fillStyle = '#17151a'; ctx.fillRect((VW - w) >> 1, H - 14, w, 11);
        ctx.fillStyle = '#e8b230'; ctx.fillRect(((VW - w) >> 1) + 1, H - 13, w - 2, 1);
        ctxText(ctx, SMALL, label, ((VW - w) >> 1) + 5, H - 10, '#f4f1ea');
      }
    },
  };
}
