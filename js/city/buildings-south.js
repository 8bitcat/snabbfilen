// SÖDER: fasadkonst för den södra husraden (radhus, pizzeria, posten,
// djuraffären, bion, kyrkan, vårdcentralen, Tornhuset, bensinmacken) och de
// fristående husen i parken (kiosk, toalett, glasskiosk, lekförråd,
// musikpaviljong). Husen byggs på fasadlådan (facade-kit.js: tak, väggytor,
// våningar, dörr som öppnas, skylt, snö på taket) och får sedan egna detaljer
// i extra(): brevlådor, akvarium, klocktorn med visare, ambulansintag,
// pumpar, prisskylt, affischer, vedugnsglöd, rök ur skorstenarna … Kanterna
// mot gränderna och gågatorna får gavelbehandling (stuprör, kvaderhörn,
// spaljé med vinranka) och varje dörr som glider upp visar en skymtad
// interiör (INRE) i stället för fasadlådans tomma mörker.
//
// Kontrakt (docs/STADEN.md): BUILDING_ART[kind] = { paint(b, night, opts) → canvas,
// live(ctx, b, st), glow(ctx, b, st), front?(ctx, b, st), items?(b, st) → [{ y, draw(ctx) }] }.
// Bilden placeras med artPos (står på b.base); artBox(b) ger rekommenderad storlek.
// Södervända hus: bildens rad r = världens y r + artBox(b).y (454 för en vanlig södra rad).
// extra(P, K) ritar i canvas-koordinater; allt live()/glow() behöver läggs i K.out
// i VÄRLDSKOORDINATER (K.box.x / K.box.y är förskjutningen).
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW } from '../core/floor-pix.js';
import { makeArt, jit, qmix, windowAt, doorAt, WHITE, rgba } from './facade-kit.js';
import { baseOf } from './map.js';

const rgb = (c) => `rgb(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255})`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// yta med funktion per pixel (null = hoppa över)
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(x + i, y + j, i, j); if (c !== null && c !== undefined) P.px(x + i, y + j, c); }
}
// text med kontur och skugga (skyltar)
function label(P, F, s, x, y, fg, outline, shadow) {
  if (shadow !== undefined) text(P, F, s, x + 1, y + 1, shadow, 0.7);
  if (outline !== undefined) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, F, s, x + dx, y + dy, outline);
  text(P, F, s, x, y, fg);
}
// tegelskorsten med plåthuv (x = vänster kant, top/bot i canvas-y)
function chimney(P, x, top, bot, c = 0x9a4a38) {
  P.darken(x + 7, top + 4, 3, bot - top - 4, 0.7);
  area(P, x, top + 2, 7, bot - top - 2, (X, Y, i, j) => { let k = jit(c, X, Y, 44, 0.1); if ((j % 3) === 2) k = mul(k, 0.7); if (i === 0) k = mix(k, WHITE, 0.2); if (i === 6) k = mul(k, 0.7); return k; });
  P.rect(x - 1, top, 9, 2, 0xa8a8b0); P.hl(x - 1, top, 9, 0xd8d8e0); P.hl(x - 1, top + 1, 9, 0x6a6a72);
  P.rect(x + 1, top - 3, 2, 3, 0x2a2a30); P.rect(x + 4, top - 3, 2, 3, 0x2a2a30);
}
// takfönster (ligger i takfallet)
function skylight(P, x, y, w, h, night) {
  P.rect(x - 1, y - 1, w + 2, h + 2, 0x3a3a40);
  area(P, x, y, w, h, (X, Y, i, j) => (night ? qmix(0x1c2a44, 0x0e1628, j / h, X, Y, 2) : qmix(0xc8e0f4, 0x5a7a9a, j / h, X, Y, 3)));
  P.line(x, y + h - 1, x + w - 1, y, WHITE, 0.35);
  P.hl(x, y, w, WHITE, 0.4);
}
// ventilationshuv på platt tak
function vent(P, x, y) { P.rect(x, y, 5, 4, 0xb4b0a8); P.hl(x, y, 5, 0xd8d4cc); P.hl(x, y + 3, 5, 0x6a6660); P.px(x + 2, y - 1, 0x8a8a90); }
// liten rökpuff (live)
function puffs(ctx, cx, cy, t, o = {}) {
  const n = o.n || 5, rate = o.rate || 0.25, rise = o.rise || 18, drift = o.drift || 8, tone = o.tone || 0xe8e8ec, a0 = o.alpha || 0.45;
  for (let i = 0; i < n; i++) {
    const ph = (t * rate + i / n) % 1, sz = 2 + Math.round(ph * 3);
    const x = Math.round(cx + ph * drift + Math.sin(t * 1.3 + i * 2) * 1.5), y = Math.round(cy - ph * rise);
    ctx.fillStyle = rgba(tone, (a0 * (1 - ph)).toFixed(3));
    ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz - 1);
  }
}
const FLOWERS = [0xe83a4a, 0xf05a8a, 0xf8d040, 0xffffff, 0xb05ae0];
// fasadlådans fönsterrutnät (samma formel som paintBuilding) → [x, y, w, h] i canvas-koordinater
function winGrid(K, spec) {
  const b = K.b, gh = spec.groundH ?? 30, fh = spec.floorH ?? 22, ww = spec.winW ?? 10, sp = spec.winSp ?? 18, wh = spec.winH ?? 13;
  const upTop = K.ftop + 6, upBot = K.baseY - gh - 13, floors = Math.max(0, Math.floor((upBot - upTop) / fh));
  const cols = Math.max(1, Math.floor((b.w - 10) / sp)), wx0 = K.fx0 + Math.round((b.w - (cols * sp - (sp - ww))) / 2), off = upBot - floors * fh;
  const out = [];
  for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) out.push([wx0 + k * sp, off + f * fh + ((fh - wh) >> 1), ww, wh, k, f]);
  return out;
}
// lövklump (buske/krona)
function bush(P, cx, cy, rx, ry, seed, dark = 0x2e6a2a, midc = 0x4f9a3a, light = 0x7fc85a) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1 || (d > 0.72 && hash(x, y, seed) > 0.55)) continue;
    const l = ((cx - x) / rx + (cy - y) / ry) * 0.45 + (hash(x, y, seed) - 0.5) * 0.9;
    P.px(x, y, l > 0.35 ? light : l > -0.25 ? midc : dark);
  }
}

// stuprör med fästen och utkastare vid marken (c: plåt, eller koppar för kyrkan)
function downpipe(P, x, y0, y1, c = 0x9aa0aa) {
  P.vl(x, y0, y1 - y0, c); P.vl(x + 1, y0, y1 - y0, mul(c, 0.58));
  for (let y = y0 + 6; y < y1 - 3; y += 14) P.hl(x - 1, y, 4, mul(c, 0.4));
  P.rect(x - 1, y1 - 2, 4, 2, mul(c, 0.8)); P.hl(x - 1, y1 - 2, 4, mix(c, WHITE, 0.25));
}
// kvaderkedja (hörnkedja) längs en fasadkant: omväxlande stora och små block
// i 3 toner. dir = 1 från vänsterkanten inåt, -1 från högerkanten.
function quoins(P, xe, y0, y1, c, dir) {
  for (let y = y0, i = 0; y < y1; y += 5, i++) {
    const w = (i & 1) ? 3 : 5, h = Math.min(4, y1 - y);
    const x = dir > 0 ? xe : xe - w + 1;
    area(P, x, y, w, h, (X, Y, ii, jj) => {
      let k = jit(c, X, Y, 77, 0.06);
      if (jj === 0) k = mix(k, WHITE, 0.22); else if (jj === h - 1) k = mul(k, 0.78);
      if (dir > 0 ? ii === w - 1 : ii === 0) k = mul(k, 0.86);
      return k;
    });
  }
}
// spaljé med klätterväxt längs en fasadkant – bryter upp kanten mot gränden
function vineWall(P, x, y0, y1, seed, bloom = true) {
  P.vl(x, y0, y1 - y0, 0xb08a58, 0.75); P.vl(x + 3, y0, y1 - y0, 0xb08a58, 0.75);
  for (let y = y0 + 2; y < y1; y += 6) P.hl(x - 1, y, 6, 0xc8a878, 0.6);
  let vx = x + 1;
  for (let y = y1 - 1; y >= y0; y--) {
    if ((y % 5) === 0) vx = x + 1 + Math.round((hash(3, (y / 5) | 0, seed) - 0.5) * 3);
    P.px(vx, y, 0x3a5a26, 0.9);
    if ((y % 5) === 1) bush(P, vx + (hash(1, y, seed) > 0.5 ? 2 : -1), y, 2.4, 1.9, seed + y);
    if (bloom && hash(2, y, seed) > 0.88) P.px(vx + ((hash(4, y, seed) * 4) | 0) - 1, y, FLOWERS[(y >> 2) % FLOWERS.length]);
  }
}

// ---------------------------------------------------------------------
// DÖRRINTERIÖRER: när en dörr glider upp fyller fasadlådan öppningen med
// ett tomt mörker – här målas i stället ett skymtat inre (pizzerians kakel
// och ugnsglöd, postens gula disk, kyrksalen …), cachat per hus och
// dygnsläge och beskuret till exakt samma öppning som mörkret.
// ---------------------------------------------------------------------
const INRE = new Map();
function inreImg(b, night) {
  const key = b.id + ':' + (night ? 1 : 0);
  let img = INRE.get(key);
  if (img) return img;
  const w = b.door.x1 - b.door.x0, h = 26, P = new Pix(w, h);
  const dim = night ? 0.55 : 0.78;                                     // inne är dunklare än gatan
  // grundrum: bakvägg med golv i "perspektiv" (ljusare längst fram)
  const base = (wallc, floorc, fy = h - 9) => area(P, 0, 0, w, h, (X, Y, i, j) => {
    if (j >= fy) { let c = qmix(mul(floorc, dim), mul(floorc, dim * 0.6), 1 - (j - fy) / (h - fy), X, Y, 3); if (((i + j) & 7) === 7) c = mul(c, 0.85); return c; }
    return qmix(mul(wallc, dim), mul(wallc, dim * 0.62), j / fy, X, Y, 3);
  });
  const k = b.kind;
  if (k === 'pizzeria') {
    // rutigt golv, kakelvägg, vedugnen till höger och disken med kartonger
    area(P, 0, 0, w, h, (X, Y, i, j) => {
      if (j >= 15) return mul((((i / 3) | 0) + (((j - 15) / 2) | 0)) & 1 ? 0x2a6a3a : 0xd8d0b8, dim * (1.06 - (25 - j) * 0.02));
      if (j < 3) return mul(jit(0xa84a30, X, Y, 70, 0.08), dim);
      return mul(((j % 4) === 3 || ((X + (((j / 4) | 0) & 1) * 3) % 6) === 5) ? 0x9a968c : jit(0xd8d4c8, X, Y, 71, 0.05), dim);
    });
    P.rect(14, 5, 9, 11, mul(0x8a8078, dim)); P.hl(14, 5, 9, mul(0xa8a098, dim));    // vedugnen
    P.box(15, 7, 7, 8, mul(0x5a5048, dim));
    area(P, 16, 8, 5, 6, (X, Y, i, j) => qmix(0xffd060, 0xc83a10, j / 6, X, Y, 3));  // glödande mun
    P.px(17, 12, 0xfff0a0); P.px(19, 13, 0xffe080);
    P.rect(1, 11, 11, 2, mul(0xb08a50, dim)); P.hl(1, 11, 11, mul(0xd8b070, dim));   // disken
    area(P, 1, 13, 11, 6, (X, Y, i) => mul((i % 6) < 3 ? 0x2a6a3a : 0xd8d0b8, dim * 0.9));
    P.rect(3, 8, 5, 3, mul(0xe8e0d0, dim)); P.hl(3, 8, 5, mul(0xfff8ea, dim)); P.px(5, 9, mul(0xc8342a, dim)); // pizzakartonger
    P.vl(12, 3, 2, 0x2a2a2a); P.rect(11, 5, 3, 2, mul(0xc8342a, 0.9)); P.px(12, 7, night ? 0xffe8a0 : 0xfff0c0); // taklampan
  } else if (k === 'posten') {
    base(0xd8d4c8, 0x9a948a, 16);
    P.rect(2, 10, w - 4, 2, mul(0xf4f1ea, dim));                                      // diskskivan
    area(P, 2, 12, w - 4, 6, (X, Y) => mul(jit(0xe8c030, X, Y, 72, 0.06), dim));      // gula disken
    P.hl(2, 12, w - 4, mul(0xfff0a0, dim)); P.hl(2, 17, w - 4, mul(0x8a6a10, dim));
    P.rect(3, 4, 5, 4, mul(0x2a2a30, 0.9)); P.px(4, 5, 0xd83a2a); P.px(6, 5, 0xd83a2a); // kölappsskärmen
    P.rect(w - 9, 4, 6, 5, mul(0x8a6a3a, dim));                                       // anslagstavlan
    for (let i = 0; i < 3; i++) P.px(w - 8 + i * 2, 5 + (i & 1), mul([0xd83a2a, 0x2a5ad0, 0xffd23f][i], dim));
  } else if (k === 'djuraffar') {
    base(0xc8d0b8, 0x9aa08a, 16);
    for (let s = 0; s < 3; s++) {                                                     // foderhyllorna
      const sy = 4 + s * 5;
      P.hl(1, sy + 3, 9, mul(0x8a6a3a, dim));
      for (let i = 0; i < 4; i++) P.rect(1 + i * 2, sy, 2, 3, mul([0xd83a2a, 0x2a5ad0, 0xffd23f, 0x2a8a3a][(i + s) % 4], dim));
    }
    P.box(12, 4, w - 13, 9, mul(0x3a5a3a, dim));                                      // akvarieraden längst in
    area(P, 13, 5, w - 15, 7, (X, Y, i, j) => qmix(mul(0x3ab0d8, dim + 0.08), mul(0x1a4a8a, dim), j / 7, X, Y, 3));
    P.px(15, 7, 0xff8030); P.px(19, 9, 0xffd23f); P.px(23, 6, 0xf05a8a);
    P.rect(13, 17, 6, 4, mul(0xb08a50, dim)); P.hl(13, 17, 6, mul(0xd8b070, dim));    // foderpallen
  } else if (k === 'bio') {
    base(0x3a2028, 0x241820, 15);
    area(P, (w >> 1) - 5, 3, 10, h - 3, (X, Y) => mul(jit(0x8a2030, X, Y, 73, 0.1), dim + 0.08)); // röda mattan
    for (const lx of [3, w - 5]) { P.px(lx, 6, night ? 0xffe8a0 : 0xffd88a); P.rect(lx - 1, 7, 3, 2, mul(0xa8842a, dim)); } // väggappliker
    P.rect(4, 10, 6, 9, mul(0xc8b8a0, dim)); P.hl(4, 10, 6, mul(0xe8d8c0, dim));      // popcornmaskinen
    P.rect(5, 8, 4, 3, night ? 0xffe090 : 0xffd88a);
    P.rect(w - 10, 8, 6, 8, mul(0x3a6aa8, dim)); P.box(w - 10, 8, 6, 8, mul(0xa8842a, dim)); // affisch i guldram
  } else if (k === 'vardcentral') {
    base(0xdce4e4, 0xb0b8b8, 16);
    P.hl(0, 15, w, mul(0x4a8a6a, dim));                                               // gröna listen
    P.rect(2, 8, 8, 8, mul(0xf4f7fa, dim)); P.rect(4, 5, 3, 3, mul(0x2aa84a, 0.95));  // receptionen med korset
    for (let i = 0; i < 3; i++) { const sx = w - 13 + i * 4; P.rect(sx, 12, 3, 3, mul(0x2a5ad0, dim)); P.vl(sx + 1, 15, 3, mul(0x4a4a52, dim)); } // väntstolarna
    P.rect(w - 4, 9, 2, 6, mul(0x2a8a3a, dim));                                       // krukväxten
  } else if (k === 'kyrka') {
    base(0x4a3c30, 0x6a5a48, 17);
    area(P, (w >> 1) - 3, 4, 6, h - 4, (X, Y) => mul(jit(0x8a2a30, X, Y, 74, 0.08), dim)); // mittgångens matta
    for (let r = 0; r < 3; r++) for (const sx of [2, w - 7]) { P.rect(sx, 8 + r * 4, 5, 2, mul(0x3a2c20, 0.95)); P.hl(sx, 8 + r * 4, 5, mul(0x5a4630, 0.95)); } // bänkraderna
    area(P, (w >> 1) - 2, 4, 4, 5, (X, Y, i, j) => qmix(0xffe8a0, mul(0xa8842a, dim), j / 5, X, Y, 3)); // altarljuset
    P.px((w >> 1) - 1, 3, 0xfff0c0); P.px(w >> 1, 3, 0xfff0c0);
  } else if (k === 'tornhuset') {
    base(0xc8c0b0, 0x8a8478, 17);
    for (let s = 0; s < 5; s++) { const sx = w - 6 - s * 3, sy = 18 - s * 3; P.rect(sx, sy, 8, 2, mul(0xb09a74, dim)); P.hl(sx, sy, 8, mul(0xd8c8a0, dim)); } // trappan
    P.line(w - 8, 15, w - 1, 5, mul(0x5a5048, 0.95));                                 // ledstången
    area(P, 2, 6, 7, 9, (X, Y, i, j) => mul((i % 3) === 2 || (j % 3) === 2 ? 0x6a6a72 : 0xb4b8c2, dim)); // brevlådeskåpet
  } else if (k === 'bensinmack') {
    base(0xd8d8dc, 0xb0b0b4, 16);
    for (let s = 0; s < 2; s++) {                                                     // snackshyllorna
      const sy = 5 + s * 5;
      P.hl(2, sy + 3, 10, mul(0x8a8a90, dim));
      for (let i = 0; i < 5; i++) P.rect(2 + i * 2, sy, 2, 3, mul([0xd83a2a, 0xffd23f, 0x2a8a3a, 0x2a5ad0, 0xf05a8a][(i + s) % 5], dim));
    }
    P.box(14, 4, 9, 13, mul(0x8a8a90, dim));                                          // kyldisken lyser kallt
    area(P, 15, 5, 7, 11, (X, Y, i, j) => qmix(mul(0xa0d8e8, dim + 0.12), mul(0x4a7a9a, dim), j / 11, X, Y, 3));
  } else if (k === 'radhus') {
    base(0xe8d8b8, 0xa08868, 16);
    for (let j = 3; j < 15; j += 4) P.hl(0, j, w, mul(0xc8a878, dim), 0.5);           // randiga tapeten
    for (let s = 0; s < 4; s++) { const sx = w - 4 - s * 3, sy = 16 - s * 3; P.rect(sx, sy, 6, 2, mul(0xb89a74, dim)); P.hl(sx, sy, 6, mul(0xd8c8a0, dim)); } // trappan
    P.rect(2, 6, 2, 6, mul(0xc8342a, dim)); P.rect(5, 6, 2, 6, mul(0x2a5ad0, dim)); P.hl(1, 5, 7, mul(0x6a4a2a, dim)); // jackorna i hallen
  } else if (k === 'toalett') {
    area(P, 0, 0, w, h, (X, Y, i, j) => (j >= 18 ? mul(0x9ab0a8, dim) : mul((j % 4) === 3 || (X % 4) === 3 ? 0x8aa098 : 0xd8e8e0, dim)));
    P.rect(3, 6, 4, 5, mul(0xa8c8d0, dim)); P.box(3, 6, 4, 5, mul(0x6a8a90, dim));    // spegeln
    P.rect(w - 5, 12, 4, 4, mul(0xf4f7fa, dim));                                      // handfatet
  } else if (k === 'paviljong') {
    // öppen – man ser rakt igenom mot parkens grönska
    area(P, 0, 0, w, h, (X, Y, i, j) => (j > h - 6 ? mul(0x8a9a6a, 0.9) : qmix(0xa8d8e8, 0x6faa4a, j / h, X, Y, 4)));
    bush(P, 5, h - 9, 4, 3, 9); bush(P, w - 5, h - 10, 4, 3, 11);
  } else if (k === 'glasskiosk') {
    base(0xe8c8d0, 0xb0a8a0, 17);
    P.box(2, 9, w - 4, 8, mul(0xe8446a, dim));                                        // frysdisken
    area(P, 3, 10, w - 6, 6, (X, Y, i, j) => qmix(mul(0xb0e0f0, dim + 0.1), mul(0x6a9ab0, dim), j / 6, X, Y, 3));
    P.px(4, 6, mul(0xf05a8a, dim)); P.px(7, 5, mul(0x7a4424, dim)); P.px(10, 6, mul(0xffd23f, dim)); // strutbilder
  } else if (k === 'lekforrad') {
    base(0x8a7048, 0x6a5638, 18);
    P.ell(4, h - 7, 3, 3, mul(0xd83a2a, 0.9), 1, 1); P.px(3, h - 8, mul(0xf4f1ea, 0.9)); // bollen
    P.rect(w - 6, h - 11, 4, 5, mul(0x2a8ad8, 0.9)); P.hl(w - 7, h - 12, 6, mul(0x60b0f0, 0.9)); // hinken
    for (let s = 0; s < 2; s++) P.hl(1, 5 + s * 5, w - 2, mul(0x5a4630, 0.95));       // hyllkanter
  } else {
    base(0xd8c8a8, 0x8a6a4a);
    P.rect((w >> 1) - 3, h - 7, 7, 3, mul(0x8a3a2a, dim));                            // dörrmattan
  }
  P.vl(0, 0, h, 0x000000, 0.4); P.vl(w - 1, 0, h, 0x000000, 0.4);                     // dörrsmygens skugga
  P.hl(0, 0, w, 0x000000, 0.45); P.hl(0, 1, w, 0x000000, 0.25);
  img = P.flush(); INRE.set(key, img);
  return img;
}
// ritas efter fasadlådans mörka öppning, beskuret till samma öppningsbredd
function drawInre(ctx, b, st) {
  const type = b.door.type;
  if (type === 'boarded' || type === 'roll') return;
  const f = clamp(st.doorOpen || 0, 0, 1);
  if (f <= 0.02) return;
  const w = b.door.x1 - b.door.x0, h = 26, x = b.door.x0, y = baseOf(b) - h;
  const ow = Math.round(w * f);
  if (ow < 1) return;
  const img = inreImg(b, !!st.night);
  if (type === 'slide' || type === 'open') { const sx = (w - ow) >> 1; ctx.drawImage(img, sx, 0, ow, h, x + sx, y, ow, h); }
  else ctx.drawImage(img, 0, 0, ow, h, x, y, ow, h);
}

// ---------------------------------------------------------------------
// Specarna. Fälten är fasadlådans (wall, wallKind, roof, ground, …) plus
// extra(P, K), live(ctx, b, st, m), glow(ctx, b, st, k, m) och items(b, st).
// ---------------------------------------------------------------------
const SPECS = {
  // ================= RADHUSEN =================
  radhus: {
    wall: 0xe4d49c, wallKind: 'plaster', roof: 'gable', roofCol: 0x8a3a2a, ground: 'house', frame: 0xf4f1ea, signBg: 0x4a6a3a, signFg: 0xf4f1ea, doorCol: 0x3a5a8a, groundH: 30, floorH: 24,
    extra(P, K) {
      const tints = [0xe4d49c, 0xc8d8c0, 0xe8c0a8], doors = [0x8a3a2a, 0x3a5a8a, 0x2a6a4a];
      // tre radhus i olika färger, brandväggar emellan, takkupor och skorstenar
      for (let u = 0; u < 3; u++) {
        const x0 = K.fx0 + u * 44, x1 = x0 + 44;
        if (u !== 0) for (let y = K.ftop + 4; y < K.baseY - 5; y++) for (let x = x0 + 1; x < x1 - 1; x++) { const c = P.get(x, y); if (c) P.px(x, y, mix(c, tints[u], 0.35)); }
        if (u < 2) { P.vl(x1 - 1, K.rtop + 2, K.baseY - K.rtop - 2, 0x6a5a48); P.vl(x1 - 2, K.rtop + 2, K.ftop - K.rtop - 2, 0x8a7a68); }
        // takkupa
        const kx = x0 + 15, ky = K.rtop + 8;
        P.rect(kx, ky, 14, 12, mix(tints[u], WHITE, 0.2)); P.vl(kx, ky, 12, 0xfff8ea); P.vl(kx + 13, ky, 12, mul(tints[u], 0.7));
        for (let r = 0; r < 5; r++) P.hl(kx - 1 + (4 - r), ky - 5 + r, 16 - 2 * (4 - r), r === 0 ? 0xf4ecdc : 0x7a3226);
        windowAt(P, kx + 3, ky + 3, 8, 7, { night: K.night, lit: K.night && hash(u, 3, K.seed) > 0.4, frame: 0xf4f1ea, sill: 0xd8d0c0 });
        if (K.night && hash(u, 3, K.seed) > 0.4) K.lit.push([kx + 3 + K.box.x, ky + 3 + K.box.y, 8, 7]);
        chimney(P, x0 + 32, K.rtop - 4, K.rtop + 10);
        if (u !== 1) {
          const dx = x0 + 14;                                       // grannarnas dörrar (stängda)
          P.rect(dx - 2, K.baseY - 30, 20, 2, 0x6a5a48);
          P.rect(dx, K.baseY - 28, 16, 28, doors[u]); P.box(dx, K.baseY - 28, 16, 28, mul(doors[u], 0.6));
          P.rect(dx + 3, K.baseY - 24, 10, 6, K.night ? 0xffd88a : 0x9fc3e0); P.box(dx + 3, K.baseY - 24, 10, 6, mul(doors[u], 0.7));
          P.box(dx + 3, K.baseY - 14, 10, 9, mul(doors[u], 0.75));
          P.px(dx + 12, K.baseY - 12, 0xe8d070);
          if (K.night) K.lit.push([dx + 3 + K.box.x, K.baseY - 24 + K.box.y, 10, 6]);
        }
        // husnummer och utelampa
        P.rect(x0 + 5, K.baseY - 24, 7, 8, 0x1f4f9a); P.box(x0 + 5, K.baseY - 24, 7, 8, 0xeef2f8); text(P, SMALL, String(1 + u * 2), x0 + 7, K.baseY - 22, WHITE);
        const lx = x0 + 32;
        P.rect(lx, K.baseY - 27, 4, 5, 0x2a2a30); P.rect(lx + 1, K.baseY - 26, 2, 3, K.night ? 0xffe8a0 : 0xd8e0e0); P.hl(lx - 1, K.baseY - 28, 6, 0x3a3a44);
        if (K.night) K.lit.push([lx + 1 + K.box.x, K.baseY - 26 + K.box.y, 2, 3]);
        // brevlåda på väggen
        P.rect(x0 + 36, K.baseY - 16, 6, 4, 0x2a2a2a); P.hl(x0 + 36, K.baseY - 16, 6, 0x6a6a6a); P.px(x0 + 38, K.baseY - 15, 0xe8d070);
      }
      K.out.smoke = [0, 1, 2].map((u) => [K.fx0 + u * 44 + 35 + K.box.x, K.rtop - 5 + K.box.y]);
    },
    live(ctx, b, st, m) {
      if (!m.smoke) return;
      m.smoke.forEach(([x, y], i) => { if (i === 1 || st.hour < 6 || st.hour > 22) return; puffs(ctx, x, y, st.t + i * 3, { n: 4, rate: 0.22, rise: 16, drift: 6 + (st.env?.weather?.wind || 0) * 0.5, tone: st.night ? 0x8a8ea0 : 0xe8e8ec, alpha: 0.4 }); });
    },
    // trädgårdarna framför: gräsmatta, plattgångar till dörrarna, rabatter och häckarna (y-sorterade skivor)
    items(b, st) {
      const out = [];
      if (!b.yard) return out;
      const [x0, y0, x1, y1] = b.yard.rect;
      if (!SPECS.radhus._yard) {
        const P = new Pix(x1 - x0, y1 - y0);
        area(P, 0, 0, x1 - x0, y1 - y0, (X, Y) => { const n = hash(X, Y, 301); return n > 0.9 ? 0x6fae4a : n < 0.08 ? 0x3f7a34 : jit(0x5a9a3e, X, Y, 302, 0.08); });
        for (let u = 0; u < 3; u++) {
          const px = u * 44 + 14 + (u === 1 ? 2 : 0), pw = u === 1 ? 16 : 16;
          area(P, px, 0, pw, y1 - y0, (X, Y, i, j) => (((i >> 2) + (j >> 2)) & 1 ? 0xc8c0b0 : 0xb8b0a0));
          for (let k = 0; k < 6; k++) { const fx = u * 44 + 3 + ((hash(k, u, 303) * 9) | 0), fy = 3 + ((hash(k, u, 304) * 16) | 0); P.px(fx, fy, FLOWERS[k % FLOWERS.length]); P.px(fx, fy + 1, 0x3f7a34); }
          for (let k = 0; k < 5; k++) { const fx = u * 44 + 33 + ((hash(k, u, 305) * 9) | 0), fy = 3 + ((hash(k, u, 306) * 16) | 0); P.px(fx, fy, FLOWERS[(k + 2) % FLOWERS.length]); P.px(fx, fy + 1, 0x3f7a34); }
        }
        P.hl(0, y1 - y0 - 1, x1 - x0, 0x8a8478, 0.5);
        SPECS.radhus._yard = P.flush();
      }
      out.push({ y: y0 + 0.02, draw: (ctx) => ctx.drawImage(SPECS.radhus._yard, x0, y0) });
      for (const [hx0, hy0, hx1, hy1] of b.blocks || []) for (let y = hy0; y < hy1; y += 4) {
        const yy = y, hh = Math.min(4, hy1 - y);
        out.push({ y: yy + hh, draw: (ctx) => {
          for (let j = 0; j < hh; j++) for (let i = -1; i <= hx1 - hx0; i++) { const n = hash(hx0 + i, yy + j, 307); ctx.fillStyle = rgb(n > 0.8 ? 0x7fc85a : n < 0.2 ? 0x2e6a2a : 0x4f9a3a); ctx.fillRect(hx0 + i, yy + j - 6, 1, 1); }
        } });
      }
      return out;
    },
  },
  // ================= PIZZERIA NAPOLI =================
  pizzeria: {
    wall: 0xe8c89a, wallKind: 'plaster', roof: 'gable', roofCol: 0x9a4a32, ground: 'shop', awning: 0x2a8a3a, signBg: 0xf4f1ea, signFg: 0xc8342a, signBorder: 0x2a8a3a, neon: 0xff6040, frame: 0x5a3a2a, floorH: 24,
    extra(P, K) {
      // markisen i grönt-vitt-rött
      for (let y = K.gtop - 1; y < K.gtop + 6; y++) for (let x = K.fx0 - 2; x < K.fx1 + 2; x++) { const s = Math.floor((x - K.fx0) / 5) % 3; if (s === 2) P.px(x, y, mul(0xd83a2a, y === K.gtop + 5 ? 0.75 : 1)); }
      // gröna fönsterluckor i trä på båda sidor om övervåningarnas fönster + blomlådor
      for (const [wx, wy, ww, wh, k, f] of winGrid(K, SPECS.pizzeria)) {
        for (const sx of [wx - 5, wx + ww + 2]) { for (let j = 0; j < wh + 2; j++) P.hl(sx, wy - 1 + j, 3, (j % 3) === 2 ? 0x2e5a2e : 0x3a7a3a); P.vl(sx, wy - 1, wh + 2, 0x4a8a4a); }
        if ((k + f) & 1) { P.rect(wx - 1, wy + wh + 3, ww + 2, 2, 0x8a5a36); P.hl(wx - 1, wy + wh + 3, ww + 2, 0xb07a4a); for (let i = 0; i < ww + 2; i += 2) { P.px(wx - 1 + i, wy + wh + 2, 0x4f9a3a); if (i & 2) P.px(wx + i, wy + wh + 1, FLOWERS[(i + k) % FLOWERS.length]); } }
      }
      // vedugnens skorsten (bred, med sotig topp) + pizzabagare-skylt
      chimney(P, K.fx1 - 18, K.rtop - 6, K.rtop + 12, 0x7a6a60);
      P.hl(K.fx1 - 19, K.rtop - 4, 9, 0x2a2420, 0.6);
      K.out.smoke = [K.fx1 - 15 + K.box.x, K.rtop - 8 + K.box.y];
      // menytavla vid dörren
      const mx = K.dx + K.dw + 5, my = K.baseY - 26;
      P.rect(mx, my, 12, 18, 0x3a2a1a); P.box(mx, my, 12, 18, 0x8a6a3a);
      for (let j = 0; j < 4; j++) { P.hl(mx + 2, my + 3 + j * 4, 5 + (j & 1) * 2, 0xf4ecdc, 0.85); P.px(mx + 9, my + 3 + j * 4, 0xffd23f); }
      P.hl(mx - 1, my + 18, 14, 0x000000, 0.25);
      // hängande skylt: pizza
      const hx = K.fx0 - 6, hy = K.gtop - 30;
      P.hl(hx, hy, 8, 0x2a2420); P.vl(hx + 3, hy + 1, 2, 0x5a5048);
      P.ell(hx + 3.5, hy + 8, 5, 5, 0xe8b860, 1, 1); P.ell(hx + 3.5, hy + 8, 4, 4, 0xd83a2a, 1, 1); P.ell(hx + 3.5, hy + 8, 3, 3, 0xf4e0a0, 1, 1);
      P.px(hx + 2, hy + 7, 0xd83a2a); P.px(hx + 5, hy + 9, 0xd83a2a); P.px(hx + 4, hy + 6, 0x4a8a3a);
      // gaveln mot gränden får ett stuprör, kanten mot Postgatan en spaljé med
      // vinranka – så gågatans tegel läses som gata mellan två husgavlar
      downpipe(P, K.fx0 + 1, K.ftop + 4, K.baseY - 1);
      vineWall(P, K.fx1 - 5, K.ftop + 2, K.gtop - 2, K.seed);
      K.out.oven = K.shop[0] ? [K.shop[0][0], K.shop[0][1], K.shop[0][2], K.shop[0][3]] : null;
    },
    // ugnsglöden flackar i den öppna porten (ritas ovanpå dörrinteriören)
    over(ctx, b, st) {
      const f = clamp(st.doorOpen || 0, 0, 1);
      if (f < 0.6) return;
      const x = b.door.x0, y = baseOf(b) - 26, fl = 0.5 + 0.5 * Math.sin(st.t * 5.3) * Math.sin(st.t * 2.9);
      ctx.fillStyle = `rgba(255,${140 + ((fl * 60) | 0)},50,${(0.1 + 0.1 * fl).toFixed(3)})`;
      ctx.fillRect(x + 15, y + 7, 7, 8);
    },
    live(ctx, b, st, m) {
      // ugnens sken i skyltfönstret och rök ur skorstenen när det är öppet
      if (m.oven) {
        const [x, y, w, h] = m.oven, f = 0.5 + 0.5 * Math.sin(st.t * 3.1) * Math.sin(st.t * 1.7);
        ctx.fillStyle = `rgba(255,${120 + (f * 60) | 0},40,${(0.25 + 0.2 * f).toFixed(3)})`;
        ctx.fillRect(x + 2, y + h - 7, Math.min(10, w - 4), 5);
      }
      if (m.smoke && st.hour >= 10 && st.hour < 23) puffs(ctx, m.smoke[0], m.smoke[1], st.t, { n: 6, rate: 0.3, rise: 22, drift: 8 + (st.env?.weather?.wind || 0) * 0.6, tone: st.night ? 0x7a7a88 : 0xd8d4d0, alpha: 0.5 });
    },
    glow(ctx, b, st, k, m) {
      if (m.oven) {
        const [x, y, w, h] = m.oven, f = 0.5 + 0.5 * Math.sin(st.t * 3.1);
        ctx.fillStyle = rgba(0xff8030, (0.25 * k * (0.6 + 0.4 * f)).toFixed(3)); ctx.fillRect(x, y + h - 9, Math.min(14, w), 9);
      }
      // varmt sken ur den öppna porten som spiller ut på trottoaren
      const dof = clamp(st.doorOpen || 0, 0, 1);
      if (dof > 0.2) {
        const x = b.door.x0, y = baseOf(b) - 26, w = b.door.x1 - b.door.x0;
        ctx.fillStyle = rgba(0xff9a40, (0.22 * k * dof).toFixed(3)); ctx.fillRect(x, y, Math.round(w * dof), 26);
        ctx.fillStyle = rgba(0xff8030, (0.1 * k * dof).toFixed(3)); ctx.fillRect(x - 2, y + 26, w + 4, 8);
      }
    },
  },
  // ================= POSTEN =================
  posten: {
    wall: 0xe8dcc0, wallKind: 'plaster', roof: 'flat', ground: 'shop', signBg: 0xffd23f, signFg: 0x1a3a8a, signBorder: 0x1a3a8a, frame: 0x1a3a8a, floorH: 24,
    extra(P, K) {
      // posthornet över skylten
      const cx = K.fx1 - 12, cy = K.gtop - 8;
      P.ell(cx, cy, 5, 5, 0xffd23f, 1, 2); P.ell(cx, cy, 3, 3, 0x1a3a8a, 1, 2); P.px(cx, cy, 0xffd23f); P.px(cx + 4, cy - 4, 0xffd23f);
      // gul brevlåda (riks) och blå (lokal) till vänster om dörren
      const bx = K.dx - 20, by = K.baseY - 22;
      for (const [x, c, hi] of [[bx, 0xffd23f, 0xfff0a0], [bx + 10, 0x2a5ad0, 0x7a9af0]]) {
        P.rect(x, by, 8, 14, c); P.hl(x, by, 8, hi); P.vl(x + 7, by, 14, mul(c, 0.6)); P.hl(x, by + 13, 8, mul(c, 0.6));
        P.rect(x + 1, by + 3, 6, 1, 0x1a1a1a); P.rect(x + 1, by + 6, 6, 3, mul(c, 0.8)); P.box(x + 1, by + 6, 6, 3, mul(c, 0.55));
        P.rect(x + 1, by + 14, 6, 8, 0x4a4a52); P.vl(x + 1, by + 14, 8, 0x6a6a72);
        P.hl(x - 1, by + 22, 10, 0x000000, 0.3);
      }
      text(P, SMALL, 'POST', bx + 1, by + 9, 0x1a3a8a);
      // klocka och öppettider
      const kx = K.dx + K.dw + 8, ky = K.baseY - 34;
      P.ell(kx + 4, ky + 4, 5, 5, 0x1a3a8a, 1, 2); P.ell(kx + 4, ky + 4, 4, 4, 0xf4f1ea, 1, 2);
      K.out.clock = { x: kx + 4 + K.box.x, y: ky + 4 + K.box.y, r: 3 };
      P.rect(kx - 2, ky + 12, 20, 8, 0xf4f1ea); P.box(kx - 2, ky + 12, 20, 8, 0x1a3a8a); text(P, SMALL, '8-18', kx, ky + 14, 0x1a3a8a);
      // paketluckor i sidoväggen och en flaggstång på taket
      for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { const x = K.fx1 - 22 + i * 8, y = K.gtop + 8 + j * 6; P.rect(x, y, 7, 5, 0xb8b8c0); P.hl(x, y, 7, 0xe0e0e8); P.px(x + 5, y + 2, 0x1a3a8a); }
      const fx = K.fx0 + 10; P.vl(fx, K.rtop - 20, K.ftop - K.rtop + 20, 0xd8d8e0); P.px(fx, K.rtop - 21, 0xffd23f);
      P.rect(fx + 1, K.rtop - 19, 8, 5, 0x1a5ab0); P.hl(fx + 1, K.rtop - 17, 8, 0xffd23f); P.vl(fx + 3, K.rtop - 19, 5, 0xffd23f);
      K.out.flag = { x: fx + 1 + K.box.x, y: K.rtop - 19 + K.box.y };
      vent(P, K.fx1 - 30, K.rtop + 6); vent(P, K.fx0 + 30, K.rtop + 12);
      // kvaderhörn på övervåningen och stuprör mot Postgatan – kanterna ska
      // läsas som husgavlar, inte som en fortsättning på gågatans tegel
      quoins(P, K.fx0, K.ftop + 4, K.gtop - 2, 0xd8ccb4, 1);
      quoins(P, K.fx1 - 1, K.ftop + 4, K.gtop - 2, 0xd8ccb4, -1);
      downpipe(P, K.fx0 + 1, K.ftop + 4, K.baseY - 1);
    },
    live(ctx, b, st, m) {
      if (m.clock) {
        const h = st.hour % 12, a1 = h / 12 * Math.PI * 2, a2 = (st.hour % 1) * Math.PI * 2;
        ctx.fillStyle = '#1a3a8a';
        for (let r = 0; r <= 2; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a1) * r), Math.round(m.clock.y - Math.cos(a1) * r), 1, 1);
        for (let r = 0; r <= 3; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a2) * r), Math.round(m.clock.y - Math.cos(a2) * r), 1, 1);
      }
      if (m.flag) { // flaggan vajar i vinden
        const w = clamp((st.env?.weather?.wind || 3) / 20, 0.1, 1), ph = Math.sin(st.t * 6) * w;
        ctx.fillStyle = '#1a5ab0'; for (let i = 0; i < 8; i++) ctx.fillRect(m.flag.x + i, m.flag.y + Math.round(Math.sin(i * 0.9 + st.t * 7) * ph), 1, 5);
        ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 8; i++) ctx.fillRect(m.flag.x + i, m.flag.y + 2 + Math.round(Math.sin(i * 0.9 + st.t * 7) * ph), 1, 1);
        ctx.fillRect(m.flag.x + 2, m.flag.y, 1, 5);
      }
    },
  },
  // ================= DJURAFFÄREN =================
  // Välskött kvartersbutik: krämvit puts, grönmålad butiksfront i träpanel,
  // stor guldtextad huvudskylt högst upp (ovanför gatuträdet), akvarium och
  // valphage i skyltfönstren, markis över dörren och tassavtryck på trottoaren.
  djuraffar: {
    wall: 0xece2c6, wallKind: 'plaster', roof: 'flat', roofCol: 0x7a7670, ground: 'shop', groundH: 30, floorH: 24, winW: 12, winSp: 20, frame: 0x3a6a46, doorCol: 0x2a6a44, noSign: true,
    extra(P, K) {
      const GRON = 0x2f7a4a, GRONM = 0x1f5c38, KREM = 0xf2ead6, GULD = 0xe8c860;
      // ---- övervåningarna: fräsch puts med tandsnitt, kvadrar och våningsband ----
      for (let x = K.fx0 + 2; x < K.fx1 - 2; x += 3) P.rect(x, K.ftop + 4, 2, 2, ((x / 3) | 0) & 1 ? 0xd8ccb0 : 0xf8f1e0); // tandsnittsfris
      quoins(P, K.fx0, K.ftop + 7, K.gtop - 12, 0xdcd0b2, 1);
      quoins(P, K.fx1 - 1, K.ftop + 7, K.gtop - 12, 0xdcd0b2, -1);
      const g = winGrid(K, SPECS.djuraffar), rowY = [...new Set(g.map((r) => r[1]))].sort((a, b) => a - b);
      const bandY = rowY[1] - 8;
      P.hl(K.fx0 + 1, bandY, K.b.w - 2, 0xf8f2e2); P.hl(K.fx0 + 1, bandY + 1, K.b.w - 2, 0xd0c4a6); P.hl(K.fx0 + 1, bandY + 2, K.b.w - 2, 0x000000, 0.2);
      // ---- HUVUDSKYLTEN: grönmålad träskylt med stor guldtext högst upp,
      // långt ovanför gatuträdet och stuprören så att den aldrig skyms ----
      const sx0 = K.fx0 + 8, sx1 = K.fx1 - 8, sy0 = K.ftop + 7, sh = 21;
      area(P, sx0, sy0, sx1 - sx0, sh, (X, Y, i, j) => {
        let c = jit(GRONM, X, Y, K.seed + 5, 0.06);
        if (((X - sx0) % 4) === 3) c = mul(c, 0.86);                                   // plankskarvar
        if (j === 1) c = mix(c, WHITE, 0.14); else if (j === sh - 2) c = mul(c, 0.78);
        return c;
      });
      P.box(sx0, sy0, sx1 - sx0, sh, GULD);
      P.hl(sx0 + 1, sy0 + sh, sx1 - sx0 - 2, 0x000000, 0.3);
      const hs = 'DJURAFFÄREN', hw = textW(BIG, hs, 2), hx = K.fx0 + ((K.b.w - hw) >> 1);
      text(P, BIG, hs, hx + 1, sy0 + 6, mul(GRONM, 0.45), 0.9, 2);
      text(P, BIG, hs, hx, sy0 + 5, K.night ? 0xffe88a : 0xf4ce4a, 1, 2);
      const paw = (cx, cy, c) => { P.ell(cx, cy + 2, 2.6, 2, c, 1, 1); for (const [ox, oy] of [[-3.5, -1], [-1.2, -2.6], [1.2, -2.6], [3.5, -1]]) P.ell(cx + ox, cy + oy, 1.2, 1.2, c, 1, 1); };
      paw(sx0 + 9, sy0 + 9, GULD); paw(sx1 - 9, sy0 + 9, GULD);
      K.out.bigsign = [sx0 + K.box.x, sy0 + K.box.y, sx1 - sx0, sh];
      K.out.paws = [[sx0 + 9 + K.box.x, sy0 + 9 + K.box.y], [sx1 - 9 + K.box.x, sy0 + 9 + K.box.y]];
      // ---- fönstervåningarna: smidesräcken och blomlådor nere, persienner,
      // gardin och butikskatten uppe ----
      for (const [wx, wy, ww, wh, kk, ff] of g) {
        if (ff === 1) {
          if (kk === 1 || kk === 4 || kk === 6) {                                      // fransk balkong
            for (let i = 0; i <= ww; i += 2) P.vl(wx - 1 + i, wy + wh + 2, 3, 0x3a3a40);
            P.hl(wx - 2, wy + wh + 1, ww + 4, 0x5a5a64); P.hl(wx - 2, wy + wh + 4, ww + 4, 0x2a2a30);
          } else if (kk === 2 || kk === 7) {                                           // blomlåda
            P.rect(wx - 1, wy + wh + 2, ww + 2, 3, 0x8a5a36); P.hl(wx - 1, wy + wh + 2, ww + 2, 0xb07a4a);
            for (let i = 0; i < ww + 2; i += 2) { P.px(wx - 1 + i, wy + wh + 1, 0x4f9a3a); if (i & 2) P.px(wx + i, wy + wh, FLOWERS[(i + kk) % FLOWERS.length]); }
          }
        } else {
          if (kk !== 5 && hash(kk, 7, K.seed) > 0.55) {                                // persienner halvt nere
            const n = 3 + ((hash(kk, 8, K.seed) * (wh - 6)) | 0);
            for (let j = 1; j < n; j += 2) P.hl(wx + 1, wy + j, ww - 2, 0xe8e4d8, 0.8);
            P.hl(wx + 1, wy + n, ww - 2, 0x8a8a80, 0.7);
          } else if (kk === 2) {                                                       // gardin i djuraffärsgrönt
            P.rect(wx + 1, wy + 1, 2, wh - 2, 0x4a8a5a); P.rect(wx + ww - 3, wy + 1, 2, wh - 2, 0x4a8a5a);
          }
          if (kk === 5) {                                                              // butikskatten i fönstret
            P.rect(wx + 3, wy + wh - 5, 6, 4, 0x2a2620); P.px(wx + 3, wy + wh - 6, 0x2a2620); P.px(wx + 7, wy + wh - 6, 0x2a2620);
            P.px(wx + 9, wy + wh - 3, 0x2a2620);
            P.px(wx + 4, wy + wh - 5, 0x6fdc4c); P.px(wx + 6, wy + wh - 5, 0x6fdc4c);
          }
        }
      }
      // ---- taket ----
      skylight(P, K.fx0 + 30, K.rtop + 6, 18, 10, K.night); vent(P, K.fx1 - 40, K.rtop + 8); vent(P, K.fx1 - 30, K.rtop + 8);
      // ---- BUTIKSFRONTEN: grönmålad träpanel med krämvit kornisch ----
      const x0 = K.fx0, x1 = K.fx1, gt = K.gtop, by = K.baseY;
      area(P, x0, gt - 12, x1 - x0, by - gt + 12, (X, Y, i, j) => {
        let c = jit(GRON, X, Y, K.seed + 6, 0.07);
        if (((X - x0) % 3) === 2) c = mul(c, 0.82); else if (((X - x0) % 3) === 0) c = mix(c, WHITE, 0.08);
        return c;
      });
      P.hl(x0, gt - 12, x1 - x0, 0xfff6e2); P.hl(x0, gt - 11, x1 - x0, KREM); P.hl(x0, gt - 10, x1 - x0, 0xd6c9ab); P.hl(x0, gt - 9, x1 - x0, 0x000000, 0.3); // kornisch
      area(P, x0, gt - 8, x1 - x0, 8, (X, Y) => jit(GRONM, X, Y, K.seed + 7, 0.05));   // fascian
      const fs = 'VALPAR - FODER - AKVARIER', fw = textW(SMALL, fs), fx = x0 + ((x1 - x0 - fw) >> 1);
      text(P, SMALL, fs, fx + 1, gt - 6, mul(GRONM, 0.5), 0.8);
      text(P, SMALL, fs, fx, gt - 7, KREM);
      for (const cx2 of [x0, x1 - 3]) area(P, cx2, gt - 8, 3, by - gt + 8, (X, Y, i) => { let c = jit(KREM, X, Y, K.seed + 8, 0.05); if (i === 2) c = mul(c, 0.8); else if (i === 0) c = mix(c, WHITE, 0.15); return c; }); // hörnbrädor
      // ---- skyltfönstren i krämvita ramar ----
      for (const [a, z] of [[12, 81], [115, 184]]) {
        P.rect(a, gt + 2, z - a, 24, KREM);
        P.hl(a, gt + 2, z - a, 0xfff6e2); P.vl(a, gt + 2, 24, 0xfff6e2); P.vl(z - 1, gt + 3, 23, 0xcfc2a4);
        P.hl(a, gt + 25, z - a, 0xcfc2a4); P.hl(a, gt + 26, z - a, 0x000000, 0.25);
        P.rect(a + 2, gt + 4, z - a - 4, 20, 0x1a2620);
        P.hl(a + 2, gt + 4, z - a - 4, 0x000000, 0.35);                                // smyg
      }
      // vänster (fritt från gatuträdet): valphagen med foderhylla, fågelbur och prisskylt
      area(P, 14, gt + 4, 65, 20, (X, Y, i, j) => (j >= 12 ? jit(0xb09a78, X, Y, K.seed + 9, 0.06) : qmix(0xe8dcc2, 0xcbbfa4, j / 12, X, Y, 3)));
      for (let s = 0; s < 2; s++) {                                                    // foderhyllan
        const sy = gt + 10 + s * 8;
        P.hl(15, sy, 15, 0x8a6a3a); P.hl(15, sy + 1, 15, 0x5a4426, 0.6);
        for (let i = 0; i < 3; i++) { const c = [0xd83a2a, 0x2a8a3a, 0xffd23f, 0x2a5ad0][(i + s) % 4]; P.rect(15 + i * 5, sy - 6, 4, 6, c); P.vl(15 + i * 5, sy - 6, 6, mix(c, WHITE, 0.3)); P.rect(16 + i * 5, sy - 4, 2, 1, 0xf4f1ea); }
      }
      area(P, 31, gt + 14, 34, 6, (X, Y) => jit(0xe6d4a0, X, Y, K.seed + 10, 0.1));    // bädden i hagen
      P.hl(31, gt + 14, 34, 0xf6ecc4, 0.6);
      for (let i = 0; i <= 34; i += 3) P.vl(31 + i, gt + 18, 6, 0xf0ece0);             // vit spjälgrind
      P.hl(31, gt + 18, 35, 0xfff8ec); P.hl(31, gt + 22, 35, 0xd8d2c2);
      P.hl(31, gt + 23, 35, 0x9a9488, 0.6);
      P.px(72, gt + 4, 0x8a8a92); P.hl(68, gt + 5, 9, 0xd8d8e0);                       // fågelburen
      for (let i = 0; i <= 10; i += 2) P.vl(67 + i, gt + 6, 12, 0xcfcfda, 0.85);
      P.rect(66, gt + 18, 12, 2, 0xb8b8c4); P.hl(66, gt + 18, 12, 0xe0e0ea);
      P.hl(69, gt + 13, 7, 0x8a6a3a);                                                  // sittpinnen
      K.out.cage = { x: 69 + K.box.x, y: gt + 11 + K.box.y };
      P.vl(34, gt + 4, 1, 0x8a8a92); P.vl(60, gt + 4, 1, 0x8a8a92);                    // prisskyltens snören
      P.rect(28, gt + 5, 39, 9, 0xfaf6ea); P.box(28, gt + 5, 39, 9, GRONM);
      text(P, SMALL, 'VALP 995:-', 30, gt + 7, GRONM);
      K.out.pen = { x: 31 + K.box.x, y: gt + 4 + K.box.y, w: 34, h: 14 };
      if (K.night) P.darken(14, gt + 4, 65, 20, 0.3);                                  // hagen släckt på natten (akvariet lyser)
      // höger: akvariet på svart stativ (butikens stolthet)
      P.rect(118, gt + 21, 63, 3, 0x2e2a26); P.hl(118, gt + 21, 63, 0x4a443c);         // stativ
      P.box(118, gt + 5, 63, 16, 0x1e3a34);                                            // tankram
      area(P, 119, gt + 6, 61, 14, (X, Y, i, j) => qmix(0x3ab0d8, 0x1a4a8a, j / 14, X, Y, 4));
      P.hl(119, gt + 6, 61, 0xa8e8ff, 0.7);                                            // vattenytan
      for (let i = 0; i < 61; i++) P.px(119 + i, gt + 19, hash(i, 2, K.seed) > 0.5 ? 0xd8c8a0 : 0x8a7a5a); // grus
      for (const [gx, gh2] of [[123, 6], [145, 9], [155, 5], [173, 11]]) for (let j = 0; j < gh2; j++) P.px(gx + (j & 1), gt + 18 - j, j > gh2 - 3 ? 0x6fdc4c : 0x2e8a3a); // växter
      P.rect(161, gt + 12, 8, 7, 0x9a98a2); P.vl(168, gt + 12, 7, 0x6a6870);           // slottet
      for (let i = 0; i < 8; i += 2) P.px(161 + i, gt + 11, 0x9a98a2);
      P.rect(164, gt + 15, 2, 4, 0x2a2a34);
      P.vl(177, gt + 6, 13, 0xd8d8e0, 0.4);                                            // luftslangen
      K.out.aqua = [119 + K.box.x, gt + 6 + K.box.y, 61, 13];
      P.rect(145, gt + 16, 34, 8, 0xfaf6ea); P.box(145, gt + 16, 34, 8, GRONM);        // prislapp på glaset
      text(P, SMALL, 'FISK 19:-', 147, gt + 18, GRONM);
      // ---- dörren med öppettidsskylt och en liten grönrandig markis ----
      doorAt(P, K.dx, K.dy, K.dw, K.dh, 'swing', 0x2a6a44, K.night);
      P.rect(K.dx - 3, by, K.dw + 6, 2, 0xd8ccb4);                                     // trappsteget
      P.rect(K.dx + 3, K.dy + 8, 22, 14, 0xf6f1e4); P.box(K.dx + 3, K.dy + 8, 22, 14, GRONM);
      text(P, SMALL, 'ÖPPET', K.dx + 5, K.dy + 10, GRONM);
      text(P, SMALL, '9-19', K.dx + 7, K.dy + 16, GRONM);
      for (let j = 0; j < 9; j++) for (let x = K.dx - 6; x < K.dx + K.dw + 6; x++) {   // markisen
        if (j === 8 && ((x - K.dx + 6) & 3) < 2) continue;                             // tandad kant
        let c = (((x - K.dx + 6) / 4) | 0) & 1 ? KREM : GRON;
        if (j === 0) c = mix(c, WHITE, 0.25); else if (j >= 7) c = mul(c, 0.78);
        P.px(x, gt + j, c);
      }
      P.hl(K.dx - 6, gt + 9, K.dw + 12, 0x000000, 0.25);
      // ---- tassavtryck målade på trottoaren, ett spår från var sida in mot dörren ----
      const stamp = (x, y) => { P.px(x, y, 0x1f6a3c, 0.8); P.px(x + 2, y, 0x1f6a3c, 0.8); P.rect(x, y + 1, 3, 2, 0x1f6a3c, 0.8); };
      for (let i = 0; i < 6; i++) {
        stamp(K.fx0 + 6 + i * 11 + (i & 1) * 2, by + (i & 1 ? 0 : 1));
        stamp(K.fx1 - 9 - i * 11 - (i & 1) * 2, by + (i & 1 ? 1 : 0));
      }
      P.hl(K.dx + K.dw + 4, by, 6, 0xe86a5a); P.rect(K.dx + K.dw + 4, by + 1, 6, 2, 0xc8342a); P.rect(K.dx + K.dw + 5, by + 1, 4, 1, 0x60b8e8); // vattenskål för hundar
      // ---- stuprören ute vid gavlarna, långt från skylten ----
      downpipe(P, K.fx0 + 1, K.ftop + 6, K.baseY - 1);
      downpipe(P, K.fx1 - 3, K.ftop + 6, K.baseY - 1);
      // glasglans snett över båda skyltfönstren
      for (const a of [14, 117]) for (let d = 0; d < 20; d++) { P.px(a + 8 + d, gt + 23 - d, WHITE, 0.12); P.px(a + 9 + d, gt + 23 - d, WHITE, 0.08); }
      // skyltfönstrens glasytor för kvällsglöden (samma platser som fasadlådans)
      K.shop.length = 0;
      K.shop.push([14 + K.box.x, gt + 4 + K.box.y, 65, 20], [117 + K.box.x, gt + 4 + K.box.y, 65, 20]);
    },
    live(ctx, b, st, m) {
      const t = st.t;
      if (m.aqua) {
        const [x, y, w, h] = m.aqua;
        // fiskar som simmar fram och tillbaka + bubblor ur luftslangen
        for (let i = 0; i < 5; i++) {
          const sp = 6 + i * 2, ph = ((t * sp) / (w - 6) + i * 0.37) % 2, dir = ph < 1 ? 1 : -1, u = ph < 1 ? ph : 2 - ph;
          const fx = Math.round(x + 2 + u * (w - 8)), fy = Math.round(y + 2 + i * 1.6 + Math.sin(t * 2 + i) * 1.2);
          ctx.fillStyle = rgb([0xff8030, 0xffd23f, 0xf05a8a, 0x60d0ff, 0xff4a3a][i]);
          ctx.fillRect(fx, fy, 3, 2); ctx.fillRect(fx + (dir > 0 ? -1 : 3), fy, 1, 1); ctx.fillRect(fx + (dir > 0 ? -1 : 3), fy + 1, 1, 1);
        }
        ctx.fillStyle = 'rgba(220,245,255,0.7)';
        for (let i = 0; i < 3; i++) { const ph = (t * 0.6 + i / 3) % 1; ctx.fillRect(x + w - 3 + i, Math.round(y + h - 1 - ph * (h - 2)), 1, 1); }
      }
      if (m.pen) {
        // valparna och kattungen leker i skyltfönstret
        const { x, y, w, h } = m.pen, foot = y + h - 1, tri = (p) => (p < 1 ? p : 2 - p);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        const pup = (px, fy2, dir, c1, c2, hop, wag) => {
          const yy = fy2 - 5 - hop;
          ctx.fillStyle = rgb(c1); ctx.fillRect(px, yy + 2, 5, 3); ctx.fillRect(px + (dir > 0 ? 3 : -1), yy, 3, 3);
          ctx.fillStyle = rgb(c2); ctx.fillRect(px + (dir > 0 ? 3 : 1), yy - 1, 1, 1); ctx.fillRect(px + (dir > 0 ? -1 : 5), yy + 1 + wag, 1, 2);
          ctx.fillRect(px + 1, yy + 5, 1, 1); ctx.fillRect(px + 3, yy + 5, 1, 1);
          ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px + (dir > 0 ? 5 : -1), yy + 1, 1, 1);
        };
        const u1 = (t * 0.32) % 2, b1 = (t * 0.32 + 0.14) % 2;                         // valpen jagar bollen
        ctx.fillStyle = '#d83a2a'; ctx.fillRect(Math.round(x + 2 + tri(b1) * (w - 8)), foot - 2 - Math.round(Math.abs(Math.sin(t * 7)) * 3), 2, 2);
        pup(Math.round(x + 2 + tri(u1) * (w - 12)), foot, u1 < 1 ? 1 : -1, 0xd8a868, 0x9a6a34, Math.round(Math.abs(Math.sin(t * 6)) * 1.5), Math.round(Math.sin(t * 9)));
        pup(x + w - 9, foot - 1, -1, 0xece0cc, 0x9a6a34, Math.sin(t * 0.8) > 0.9 ? 2 : 0, Math.round(Math.sin(t * 10))); // kompisen sitter och viftar
        const kx = x + 3, po = Math.round(Math.max(0, Math.sin(t * 1.1 + 2)) ** 6 * 2); // kattungen nosar på garnet
        ctx.fillStyle = '#f0a0c8'; ctx.fillRect(kx + 6, foot - 2, 2, 2);
        ctx.fillStyle = '#8a8a94';
        ctx.fillRect(kx, foot - 4 - po, 4, 2); ctx.fillRect(kx + 3, foot - 6 - po, 2, 2); ctx.fillRect(kx + 3, foot - 7 - po, 1, 1);
        ctx.fillRect(kx - 1, foot - 4 + Math.round(Math.sin(t * 8)), 1, 1);
        ctx.restore();
      }
      if (m.cage) {
        // undulaten byter sittpinne och nickar
        const hop = Math.floor(t * 1.3) % 2, bx = m.cage.x + (hop ? 4 : 0), by2 = m.cage.y - (Math.floor(t * 5) % 4 === 0 ? 1 : 0);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, by2, 2, 2);
        ctx.fillStyle = '#ff8030'; ctx.fillRect(bx + (hop ? -1 : 2), by2, 1, 1);
      }
    },
    glow(ctx, b, st, k, m) {
      if (m.aqua) { const [x, y, w, h] = m.aqua; ctx.fillStyle = rgba(0x40c0ff, (0.28 * k).toFixed(3)); ctx.fillRect(x, y, w, h); ctx.fillStyle = rgba(0x40a0ff, (0.1 * k).toFixed(3)); ctx.fillRect(x - 3, y + h, w + 6, 8); }
      if (m.bigsign) {                                                                 // huvudskylten lyser varmt
        const [x, y, w, h] = m.bigsign, f = 0.85 + 0.15 * Math.sin(st.t * 1.6);
        ctx.fillStyle = rgba(0xffe8a0, (0.22 * k * f).toFixed(3)); ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        ctx.fillStyle = rgba(0xffdc80, (0.07 * k).toFixed(3)); ctx.fillRect(x + 4, y + h, w - 8, 12);
      }
      if (m.paws) m.paws.forEach(([px, py], i) => {                                    // tassarna blinkar turvis i grönt
        const on = Math.floor(st.t * 1.4 + i) % 2 === 0;
        ctx.fillStyle = rgba(0x60ff90, ((on ? 0.5 : 0.18) * k).toFixed(3)); ctx.fillRect(px - 5, py - 4, 11, 10);
      });
      if (m.shop) for (const [x, y, w, h] of m.shop) {                                 // varm butiksbelysning i skyltfönstren
        ctx.fillStyle = rgba(0xffd890, (0.14 * k).toFixed(3)); ctx.fillRect(x, y, w, h);
        ctx.fillStyle = rgba(0xffc070, (0.05 * k).toFixed(3)); ctx.fillRect(x - 2, y + h, w + 4, 6);
      }
    },
  },
  bibliotek: { // (reserv – biblioteket blev djuraffären, men kartan kan peka hit igen)
    wall: 0xd8d0c0, wallKind: 'plaster', roof: 'flat', roofCol: 0x5a9a88, ground: 'house', winW: 12, winSp: 20, winH: 16, floorH: 26, frame: 0xf0ece0, signBg: 0x3a2a1a, signFg: 0xf0d890, doorCol: 0x5a3a20,
    extra(P, K) { for (let x = K.fx0 + 3; x < K.fx1 - 3; x += 20) for (let y = K.ftop + 4; y < K.baseY - 5; y++) { P.px(x, y, mix(K.wall, WHITE, 0.25)); P.px(x + 2, y, mul(K.wall, 0.86)); } },
  },
  // ================= BIO PIXEL =================
  bio: {
    wall: 0x8a2a3a, wallKind: 'plaster', roof: 'flat', ground: 'shop', groundH: 36, floorH: 24, signBg: 0x111111, signFg: 0xffe070, neon: 0xffd040, frame: 0x2a1a1a,
    extra(P, K) {
      // art déco-lisener och en lodrät neonskylt "BIO"
      for (let x = K.fx0 + 6; x < K.fx1 - 6; x += 24) for (let y = K.ftop + 4; y < K.gtop - 2; y++) { P.px(x, y, mix(K.wall, WHITE, 0.3)); P.px(x + 1, y, mix(K.wall, WHITE, 0.12)); P.px(x + 2, y, mul(K.wall, 0.8)); }
      // östra kanten mot Kyrkogatan: stuprör och två ventilgaller bryter gaveln
      downpipe(P, K.fx1 - 3, K.ftop + 4, K.baseY - 1, 0x8a7078);
      for (const gy of [K.ftop + 12, K.ftop + 32]) {
        P.rect(K.fx1 - 13, gy, 6, 5, 0x5a1c28); P.box(K.fx1 - 13, gy, 6, 5, 0x6a2a38);
        for (let j = 1; j < 5; j += 2) P.hl(K.fx1 - 12, gy + j, 4, 0xa8556a, 0.8);
      }
      const vx = K.fx0 + 12, vy = K.ftop + 8;
      P.rect(vx - 3, vy - 2, 13, 34, 0x111111); P.box(vx - 3, vy - 2, 13, 34, 0xffe070);
      'BIO'.split('').forEach((ch, i) => text(P, BIG, ch, vx, vy + 1 + i * 10, 0xffd040));
      K.out.vneon = [vx - 3 + K.box.x, vy - 2 + K.box.y, 13, 34];
      // baldakin (marquee) med glödlampor och kvällens film
      const my = K.gtop - 4, mx0 = K.fx0 - 4, mw = K.fx1 - K.fx0 + 8;
      P.rect(mx0, my - 9, mw, 9, 0x2a1a1a); P.hl(mx0, my - 9, mw, 0x6a4a4a); P.hl(mx0, my - 1, mw, 0x0a0a0a);
      P.rect(mx0 + 3, my - 7, mw - 6, 5, 0xf4f1ea);
      const film = 'IKVÄLL: PIXLARNAS HÄMND 19:00', tw = textW(SMALL, film);
      P.clip(mx0 + 3, my - 7, mx0 + mw - 3, my - 2); text(P, SMALL, film, K.fx0 + ((K.fx1 - K.fx0 - tw) >> 1), my - 7, 0x8a2a3a); P.clip();
      K.out.marquee = [mx0 + K.box.x, my - 9 + K.box.y, mw, 9];
      P.hl(mx0 - 1, my, mw + 2, 0x000000, 0.3);
      // affischer i glasmontrar med filmnamn
      const titles = [['PIXLARNAS', 'HÄMND'], ['KÄRLEK I', 'FÖRORTEN']], pal = [[0x3a6aa8, 0xffd23f], [0xa83a5a, 0xf4f1ea]];
      [K.fx0 + 8, K.fx1 - 26].forEach((px, k) => {
        const py = K.gtop + 4;
        P.rect(px - 1, py - 1, 20, 26, 0x1a1a1a);
        area(P, px, py, 18, 24, (X, Y, i, j) => jit(j < 14 ? pal[k][0] : 0x1a1a24, X, Y, 9 + k, 0.3));
        P.ell(px + 9, py + 7, 5, 5, pal[k][1], 1, 2);
        text(P, SMALL, titles[k][0], px + 1, py + 15, 0xffe070); text(P, SMALL, titles[k][1], px + 1, py + 21, 0xffe070);
        P.hl(px, py, 18, WHITE, 0.3);
        K.shop.splice(K.shop.findIndex((s) => Math.abs(s[0] - K.box.x - px) < 14), 1);
      });
      // biljettluckan till vänster om dörren
      const tx = K.dx - 18, ty = K.baseY - 30;
      P.rect(tx, ty, 14, 20, 0x2a1a1a); P.rect(tx + 2, ty + 2, 10, 10, K.night ? 0xffe0a0 : 0xa8c8e4); P.box(tx + 2, ty + 2, 10, 10, 0x8a6a2a);
      P.rect(tx + 4, ty + 12, 6, 2, 0x1a1a1a); text(P, SMALL, 'KASSA', tx - 1, ty + 15, 0xffe070);
      if (K.night) K.lit.push([tx + 2 + K.box.x, ty + 2 + K.box.y, 10, 10]);
      // projektorrum och ventilation på taket
      P.rect(K.fx0 + 60, K.rtop + 4, 40, 14, 0x6a5a5a); P.hl(K.fx0 + 60, K.rtop + 4, 40, 0x9a8a8a); P.vl(K.fx0 + 99, K.rtop + 4, 14, 0x3a2a2a);
      vent(P, K.fx0 + 66, K.rtop + 7); vent(P, K.fx0 + 86, K.rtop + 7); vent(P, K.fx1 - 20, K.rtop + 8);
    },
    live(ctx, b, st, m) {
      // glödlampor som jagar runt skylten och baldakinen
      const n = Math.floor(st.t * 8);
      for (const r of [m.sign, m.marquee]) {
        if (!r) continue;
        const [x, y, w, h] = r;
        for (let i = 0; i < w; i += 3) {
          ctx.fillStyle = (i / 3 + n) % 4 === 0 ? '#fff6c0' : '#8a6a20'; ctx.fillRect(x + i, y - 2, 1, 1);
          ctx.fillStyle = (i / 3 + n) % 4 === 2 ? '#fff6c0' : '#8a6a20'; ctx.fillRect(x + i, y + h + 1, 1, 1);
        }
      }
    },
    glow(ctx, b, st, k, m) {
      if (m.vneon) { const [x, y, w, h] = m.vneon, f = 0.8 + 0.2 * Math.sin(st.t * 9); ctx.fillStyle = rgba(0xffd040, (0.4 * k * f).toFixed(3)); ctx.fillRect(x - 2, y - 2, w + 4, h + 4); }
      if (m.marquee) { const [x, y, w, h] = m.marquee; ctx.fillStyle = rgba(0xfff0c0, (0.3 * k).toFixed(3)); ctx.fillRect(x, y, w, h); ctx.fillStyle = rgba(0xffe0a0, (0.12 * k).toFixed(3)); ctx.fillRect(x - 4, y + h, w + 8, 30); }
    },
  },
  // ================= SÖDERKYRKAN =================
  kyrka: {
    wall: 0xece6d8, wallKind: 'plaster', roof: 'gable', roofCol: 0x44444e, ground: 'plain', floorH: 60, winW: 8, winSp: 26, winH: 30, frame: 0x8a8070, noSign: true, doorCol: 0x5a3018,
    extra(P, K) {
      const b = K.b;
      // tornet: vit kropp med hörnkedjor, klockvåning, kopparspira med kors
      const tx0 = K.X(b.tower.x0), tx1 = K.X(b.tower.x1), ttop = K.baseY - b.tower.h, tw = tx1 - tx0;
      const spire = ttop + 44;
      for (let y = spire; y < K.baseY; y++) for (let x = tx0; x < tx1; x++) {
        let c = jit(0xf2ece0, x, y, 31, 0.05);
        if (x === tx0) c = mix(c, WHITE, 0.3); else if (x >= tx1 - 3) c = mul(c, 0.8);
        if ((x < tx0 + 3 || x >= tx1 - 5) && ((y >> 3) & 1)) c = mul(c, 0.92);
        P.px(x, y, c);
      }
      for (let y = ttop; y < spire; y++) {
        const t = (y - ttop) / (spire - ttop), hw = Math.max(1, Math.round(t * (tw / 2 + 2)));
        for (let x = -hw; x < hw; x++) P.px(tx0 + tw / 2 + x, y, jit(x < -hw / 2 ? 0x7ac0a8 : x < 0 ? 0x6ab09a : 0x3a7a68, x, y, 32, 0.08));
      }
      P.vl(tx0 + tw / 2, ttop - 10, 10, 0xe8c040); P.hl(tx0 + tw / 2 - 3, ttop - 7, 7, 0xe8c040); P.px(tx0 + tw / 2, ttop - 11, 0xfff0a0);
      P.hl(tx0 - 2, spire, tw + 4, 0x3a7a68); P.hl(tx0 - 2, spire + 1, tw + 4, 0x2a5a4a); P.hl(tx0 - 2, spire + 2, tw + 4, 0x000000, 0.25);
      // klockvåningen: ljudluckor med klockan skymtande, urtavla med visare (live)
      for (const lx of [tx0 + 6, tx1 - 12]) { P.rect(lx, spire + 8, 6, 14, 0x2a2a30); for (let j = 0; j < 14; j += 3) P.hl(lx, spire + 8 + j, 6, 0x5a5a60); P.rect(lx - 1, spire + 6, 8, 2, 0x8a8070); }
      P.rect(tx0 + tw / 2 - 3, spire + 9, 6, 12, 0x1a1a20); P.ell(tx0 + tw / 2, spire + 16, 2.5, 3, 0xb08a3a, 1, 1); P.px(tx0 + tw / 2, spire + 19, 0x6a4a1a);
      const ck = { x: tx0 + tw / 2, y: spire + 34 };
      K.out.clock = { x: ck.x + K.box.x, y: ck.y + K.box.y };
      P.ell(ck.x, ck.y, 9, 9, 0x2a2a30, 1, 2); P.ell(ck.x, ck.y, 8, 8, 0xe8c040, 1, 2); P.ell(ck.x, ck.y, 7, 7, 0xf4f1ea, 1, 2);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(ck.x + Math.sin(a) * 5.5), Math.round(ck.y - Math.cos(a) * 5.5), k % 3 ? 0x5a5a60 : 0x2a2a30); }
      // spetsbågiga glasmålningar på fasaden
      for (let x = K.fx0 + 10; x < K.fx1 - 12; x += 26) {
        if (x + 8 > tx0 - 2 && x < tx1 + 2) continue;
        P.rect(x - 1, K.ftop + 15, 10, 42, 0x8a8070); P.rect(x, K.ftop + 16, 8, 40, 0x6a6050);
        for (let j = 0; j < 38; j++) for (let i = 0; i < 6; i++) { if (j < 3 && (i === 0 || i === 5)) continue; if (j < 1 && (i === 1 || i === 4)) continue; P.px(x + 1 + i, K.ftop + 17 + j, K.night ? ((i + j) % 5 ? 0xe8a850 : 0xc84a3a) : ((i * 3 + j) % 7 === 0 ? 0xc84a5a : (i + j) % 4 ? 0x3a5a9a : 0xe8c050)); }
        P.vl(x + 4, K.ftop + 20, 34, 0x2a2a30, 0.6); P.hl(x + 1, K.ftop + 36, 6, 0x2a2a30, 0.6);
        if (K.night) K.lit.push([x + 1 + K.box.x, K.ftop + 17 + K.box.y, 6, 38]);
      }
      // portalen: rundbåge i sten med dubbeldörr och lyktor
      P.rect(K.dx - 6, K.baseY - 40, K.dw + 12, 12, 0xd8d0c0); P.hl(K.dx - 6, K.baseY - 40, K.dw + 12, 0xf0ece0);
      for (let i = 0; i < K.dw + 12; i++) { const t = Math.abs(i - (K.dw + 12) / 2) / ((K.dw + 12) / 2); P.rect(K.dx - 6 + i, K.baseY - 40 - Math.round((1 - t * t) * 6), 1, Math.round((1 - t * t) * 6), 0xd8d0c0); }
      P.vl(K.dx - 6, K.baseY - 28, 28, 0xc8c0b0); P.vl(K.dx + K.dw + 5, K.baseY - 28, 28, 0xa89e8c);
      for (const lx of [K.dx - 12, K.dx + K.dw + 9]) { P.rect(lx, K.baseY - 30, 4, 6, 0x2a2a30); P.rect(lx + 1, K.baseY - 29, 2, 4, K.night ? 0xffe8a0 : 0xd8e0e0); P.px(lx + 1, K.baseY - 31, 0x3a3a44); if (K.night) K.lit.push([lx + 1 + K.box.x, K.baseY - 29 + K.box.y, 2, 4]); }
      // skiffertak med takryttare, anslagstavla med gudstjänsttider
      P.rect(K.fx0 + 10, K.baseY - 22, 16, 12, 0x3a2a1a); P.rect(K.fx0 + 11, K.baseY - 21, 14, 10, 0xf4ecdc); for (let j = 0; j < 4; j++) P.hl(K.fx0 + 12, K.baseY - 19 + j * 2, 8 + (j & 1) * 3, 0x5a5a60, 0.7);
      P.rect(tx0 - 3, spire + 4, tw + 6, 1, 0x000000, 0.2);
      // kvaderkedjor i sten på fasadhörnen och ett kopparstuprör mot Kyrkogatan
      quoins(P, K.fx0, K.ftop + 6, K.baseY - 6, 0xd8d0c0, 1);
      quoins(P, K.fx1 - 1, K.ftop + 6, K.baseY - 6, 0xd8d0c0, -1);
      downpipe(P, K.fx0 + 5, K.ftop + 8, K.baseY - 1, 0x6ab09a);
    },
    live(ctx, b, st, m) {
      if (!m.clock) return;
      const h = st.hour % 12, a1 = h / 12 * Math.PI * 2, a2 = (st.hour % 1) * Math.PI * 2;
      ctx.fillStyle = '#2a2a30';
      for (let r = 0; r <= 3; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a1) * r), Math.round(m.clock.y - Math.cos(a1) * r), 1, 1);
      for (let r = 0; r <= 5; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a2) * r), Math.round(m.clock.y - Math.cos(a2) * r), 1, 1);
      ctx.fillRect(m.clock.x, m.clock.y, 1, 1);
    },
    glow(ctx, b, st, k, m) {
      if (m.clock) { ctx.fillStyle = rgba(0xfff0c0, (0.3 * k).toFixed(3)); ctx.fillRect(m.clock.x - 8, m.clock.y - 8, 17, 17); }
    },
  },
  // ================= VÅRDCENTRALEN =================
  vardcentral: {
    wall: 0xe4e8ec, wallKind: 'concrete', roof: 'flat', ground: 'shop', groundH: 34, signBg: 0xf4f7fa, signFg: 0x2a7a3a, signBorder: 0x2a7a3a, frame: 0x8a9aa8, winW: 14, winSp: 20, floorH: 24,
    extra(P, K) {
      // grönt kors (lyser på natten)
      const cx = K.fx0 + 12, cy = K.ftop + 12;
      P.rect(cx - 2, cy - 6, 5, 13, 0x2aa84a); P.rect(cx - 6, cy - 2, 13, 5, 0x2aa84a); P.rect(cx - 1, cy - 5, 3, 11, 0x5ad07a); P.rect(cx - 5, cy - 1, 11, 3, 0x5ad07a);
      K.out.cross = { x: cx + K.box.x, y: cy + K.box.y };
      // ambulansintaget: högra skyltfönstret blir en bred port med röd rand och blåljus
      const R = K.shop[1];
      if (R) {
        const x = R[0] - K.box.x, y = R[1] - K.box.y, w = R[2], h = R[3];
        K.shop.splice(1, 1);
        P.rect(x - 2, y - 2, w + 4, h + K.baseY - (y + h) + 2, 0x6a7078);
        area(P, x, y, w, K.baseY - y - 2, (X, Y, i, j) => ((j % 4) === 3 ? 0x8a9098 : jit(0xc8ccd2, X, Y, 12, 0.05)));
        P.rect(x, y + 10, w, 3, 0xd8342c); P.hl(x, y + 10, w, 0xff6a5a);
        label(P, SMALL, 'AMBULANS', x + ((w - textW(SMALL, 'AMBULANS')) >> 1), y + 16, 0xd8342c, undefined, 0x8a9098);
        P.rect(x + (w >> 1) - 4, y - 8, 8, 5, 0x2a2a30); P.rect(x + (w >> 1) - 3, y - 7, 6, 3, 0x2a6ad8);
        K.out.blue = { x: x + (w >> 1) - 3 + K.box.x, y: y - 7 + K.box.y };
        P.rect(x + w - 6, y + h - 2, 5, 2, 0x1a1a1a); P.rect(x + w - 5, y + h - 1, 3, 1, 0xd8342c); // stopplyktor på porten
      }
      // entrétak i glas över skjutdörren
      P.rect(K.dx - 8, K.baseY - 42, K.dw + 16, 3, 0x8a9aa8); P.hl(K.dx - 8, K.baseY - 42, K.dw + 16, 0xd8e0e8); P.hl(K.dx - 9, K.baseY - 39, K.dw + 18, 0x000000, 0.25);
      P.vl(K.dx - 7, K.baseY - 39, 6, 0x6a7078); P.vl(K.dx + K.dw + 6, K.baseY - 39, 6, 0x6a7078);
      // persienner i vartannat fönster, en rullstolsramp med räcke
      for (const [wx, wy, ww, wh, k, f] of winGrid(K, SPECS.vardcentral)) if (hash(k, f, K.seed + 9) > 0.45) { const n = 3 + ((hash(k, f, K.seed + 8) * (wh - 4)) | 0); for (let j = 1; j < n; j += 2) P.hl(wx + 1, wy + j, ww - 2, 0xd8dce0, 0.75); P.hl(wx + 1, wy + n, ww - 2, 0x8a9aa8, 0.6); }
      P.rect(K.fx0 + 2, K.baseY - 6, K.dx - K.fx0 - 8, 6, 0xb8bcc4); P.hl(K.fx0 + 2, K.baseY - 6, K.dx - K.fx0 - 8, 0xe0e4e8);
      for (let x = K.fx0 + 3; x < K.dx - 6; x += 5) P.vl(x, K.baseY - 12, 6, 0x6a7078); P.hl(K.fx0 + 3, K.baseY - 12, K.dx - K.fx0 - 9, 0x8a9098);
      // taket: ventilationsaggregat, helikopter-H och parabol
      P.rect(K.fx0 + 20, K.rtop + 6, 26, 10, 0xb8bcc4); P.hl(K.fx0 + 20, K.rtop + 6, 26, 0xe0e4e8); P.vl(K.fx0 + 45, K.rtop + 6, 10, 0x6a7078); for (let i = 0; i < 3; i++) P.ell(K.fx0 + 25 + i * 8, K.rtop + 11, 2.5, 2, 0x3a3e48, 1, 1);
      P.ell(K.fx1 - 30, K.rtop + 12, 12, 8, 0xd8342c, 1, 1); P.ell(K.fx1 - 30, K.rtop + 12, 10, 6, 0x7a7670, 1, 1); text(P, BIG, 'H', K.fx1 - 32, K.rtop + 9, 0xf4f1ea);
      vent(P, K.fx0 + 60, K.rtop + 12); vent(P, K.fx0 + 70, K.rtop + 12);
    },
    glow(ctx, b, st, k, m) {
      if (m.cross) { const f = 0.85 + 0.15 * Math.sin(st.t * 4); ctx.fillStyle = rgba(0x40ff70, (0.45 * k * f).toFixed(3)); ctx.fillRect(m.cross.x - 8, m.cross.y - 8, 17, 17); }
      if (m.blue && Math.floor(st.t * 3) % 2 === 0 && st.hour >= 22) { ctx.fillStyle = rgba(0x3a8aff, (0.5 * k).toFixed(3)); ctx.fillRect(m.blue.x - 6, m.blue.y - 4, 18, 10); }
    },
  },
  // ================= TORNHUSET =================
  tornhuset: {
    wall: 0x9a5a44, wallKind: 'brick', roof: 'flat', ground: 'house', balcony: true, floorH: 20, frame: 0xf0ece0, signBg: 0x2a2a2a, signFg: 0xe8e0d0, dish: true,
    extra(P, K) {
      // takvåningen: glasat burspråk med terrass, plank och krukväxter
      const y = K.ftop - 6, x0 = K.fx0 + 20, x1 = K.fx1 - 20;
      for (let j = 0; j < 12; j++) for (let i = x0; i < x1; i++) P.px(i, y - 6 + j, K.night ? qmix(0xffd88a, 0xe0a050, j / 12, i, j, 3) : mix(0x9fc3e0, 0x4e6e96, j / 12));
      P.box(x0, y - 6, x1 - x0, 12, 0x3a3a40);
      for (let i = x0; i < x1; i += 8) P.vl(i, y - 6, 12, 0x3a3a40);
      if (K.night) K.lit.push([x0 + 1 + K.box.x, y - 5 + K.box.y, x1 - x0 - 2, 10]);
      P.rect(x0 - 2, y - 8, x1 - x0 + 4, 2, 0x5a5a60); P.hl(x0 - 2, y - 8, x1 - x0 + 4, 0x8a8a90);
      area(P, K.fx0 + 4, y + 2, x1 - x0 + 32, 4, (X, Y, i) => ((i % 4) === 3 ? 0x8a6a4a : jit(0xc8a070, X, Y, 15, 0.08)));   // trätrall
      for (let i = K.fx0 + 6; i < K.fx1 - 6; i += 6) P.vl(i, y - 2, 4, 0x9a9aa0); P.hl(K.fx0 + 4, y - 2, K.fx1 - K.fx0 - 8, 0xd8d4cc);   // räcke
      for (const px of [K.fx0 + 8, K.fx1 - 14]) { P.rect(px, y - 2, 5, 4, 0xb8643a); bush(P, px + 2, y - 5, 3.5, 3, px, 0x2e6a2a, 0x4f9a3a, 0x7fc85a); }
      P.rect(K.fx0 + 26, y - 2, 8, 4, 0xd8342c); P.hl(K.fx0 + 26, y - 2, 8, 0xff8a7a); // solstol
      // hissmaskinrum, antennmast med flygvarningsljus
      P.rect(K.fx0 + 8, K.rtop + 2, 24, 10, 0x8a8a90); P.hl(K.fx0 + 8, K.rtop + 2, 24, 0xb8b8c0); P.vl(K.fx0 + 31, K.rtop + 2, 10, 0x5a5a60);
      const ax = K.fx1 - 24; P.vl(ax, K.rtop - 30, K.rtop + 4 - (K.rtop - 30), 0x9a9aa0); P.vl(ax + 1, K.rtop - 30, 34, 0x5a5a60);
      for (let j = 0; j < 30; j += 6) { P.hl(ax - 2, K.rtop - 28 + j, 5, 0x7a7a80); }
      P.rect(ax - 1, K.rtop - 33, 3, 3, 0xff3a2a);
      K.out.beacon = { x: ax + K.box.x, y: K.rtop - 32 + K.box.y };
      // entré med baldakin, porttelefon och husnummer
      P.rect(K.dx - 6, K.baseY - 36, K.dw + 12, 3, 0x3a3a40); P.hl(K.dx - 6, K.baseY - 36, K.dw + 12, 0x8a8a90); P.hl(K.dx - 7, K.baseY - 33, K.dw + 14, 0x000000, 0.3);
      P.rect(K.dx + K.dw + 4, K.baseY - 24, 6, 10, 0xb4b8c2); P.px(K.dx + K.dw + 6, K.baseY - 22, 0x3ac05a); for (let j = 0; j < 3; j++) P.hl(K.dx + K.dw + 5, K.baseY - 19 + j * 2, 3, 0x2a2e38);
      P.rect(K.dx - 14, K.baseY - 30, 8, 9, 0x1f4f9a); P.box(K.dx - 14, K.baseY - 30, 8, 9, 0xeef2f8); text(P, SMALL, '9', K.dx - 11, K.baseY - 28, WHITE);
    },
    glow(ctx, b, st, k, m) {
      if (!m.beacon) return;
      const on = Math.floor(st.t * 1.2) % 2 === 0;
      ctx.fillStyle = rgba(0xff3a2a, ((on ? 0.7 : 0.15) * k).toFixed(3)); ctx.fillRect(m.beacon.x - 3, m.beacon.y - 3, 7, 7);
      ctx.fillStyle = rgba(0xff3a2a, (on ? 1 : 0.3).toFixed(2)); ctx.fillRect(m.beacon.x, m.beacon.y, 1, 1);
    },
  },
  // ================= PIXELMACKEN =================
  bensinmack: {
    wall: 0xe8e8ec, wallKind: 'metal', roof: 'flat', ground: 'shop', signBg: 0xd8342c, signFg: 0xffffff, groundH: 30, frame: 0x5a5a60,
    extra(P, K) {
      // prisskylten (pylon) på taket
      const px = K.fx1 - 30, py = K.rtop - 34;
      P.vl(px + 9, py + 26, K.ftop - py - 26, 0x5a5a60); P.vl(px + 10, py + 26, K.ftop - py - 26, 0x9a9aa0);
      P.rect(px, py, 20, 26, 0xf4f1ea); P.box(px, py, 20, 26, 0xd8342c); P.rect(px, py, 20, 7, 0xd8342c); text(P, SMALL, 'PIX', px + 4, py + 1, WHITE);
      text(P, SMALL, '95', px + 2, py + 9, 0x1a1a1a); text(P, SMALL, '1849', px + 2, py + 15, 0x1a1a1a);
      text(P, SMALL, 'D', px + 2, py + 21, 0x1a1a1a); text(P, SMALL, '1929', px + 6, py + 21, 0x1a1a1a);
      K.out.pylon = [px + K.box.x, py + K.box.y, 20, 26];
      // kaffe- och korvskylt i fönstret, öppettider, luftpump och däckstapel vid husväggen
      P.rect(K.fx0 + 6, K.gtop + 6, 18, 8, 0x3a2a1a); text(P, SMALL, 'KAFFE', K.fx0 + 7, K.gtop + 8, 0xffe070);
      P.rect(K.dx + K.dw + 4, K.baseY - 34, 24, 8, 0xf4f1ea); P.box(K.dx + K.dw + 4, K.baseY - 34, 24, 8, 0xd8342c); text(P, SMALL, '6-23', K.dx + K.dw + 9, K.baseY - 32, 0xd8342c);
      const ax = K.fx1 - 10; P.rect(ax, K.baseY - 16, 5, 14, 0x2a5ad0); P.hl(ax, K.baseY - 16, 5, 0x7a9af0); P.rect(ax + 1, K.baseY - 14, 3, 3, 0xf4f1ea); P.vl(ax + 5, K.baseY - 10, 8, 0x1a1a1a);
      for (let j = 0; j < 3; j++) { P.rect(K.fx0 - 4, K.baseY - 4 - j * 4, 10, 4, 0x2a2a2e); P.hl(K.fx0 - 4, K.baseY - 4 - j * 4, 10, 0x4a4a50); P.rect(K.fx0 - 1, K.baseY - 3 - j * 4, 4, 2, 0x5a5a60); }
      vent(P, K.fx0 + 12, K.rtop + 6);
    },
    glow(ctx, b, st, k, m) {
      if (m.pylon) { const [x, y, w, h] = m.pylon; ctx.fillStyle = rgba(0xfff0e0, (0.35 * k).toFixed(3)); ctx.fillRect(x, y, w, h); }
    },
  },
  // ================= PARKEN =================
  kiosk: {
    wall: 0x3a6a4a, wallKind: 'wood', roof: 'flat', roofCol: 0x5a5a5a, ground: 'plain', groundH: 24, signBg: 0xf4f1ea, signFg: 0x2a4a3a, doorCol: 0x2a4a3a,
    extra(P, K) {
      // lucka med godis och tidningar, löpsedlar på väggen
      const lx = K.fx0 + 3, ly = K.baseY - 24;
      P.rect(lx, ly, 12, 12, 0x1a1a20); area(P, lx + 1, ly + 1, 10, 10, (X, Y, i, j) => (K.night ? 0xffd88a : qmix(0xa8c8e4, 0x3e5a80, j / 10, X, Y, 3)));
      for (let i = 0; i < 4; i++) P.rect(lx + 2 + i * 2, ly + 7, 1, 3, [0xd83a2a, 0xffd23f, 0x2a5ad0, 0xf05a8a][i]);
      P.rect(lx - 1, ly - 3, 14, 3, 0xd83a2a); P.hl(lx - 1, ly - 3, 14, 0xff8a7a);
      if (K.night) K.lit.push([lx + 1 + K.box.x, ly + 1 + K.box.y, 10, 10]);
      P.rect(K.fx1 - 12, ly - 2, 9, 12, 0xf4f1ea); P.box(K.fx1 - 12, ly - 2, 9, 12, 0x1a1a1a); text(P, SMALL, 'EX', K.fx1 - 11, ly, 0xd83a2a); P.hl(K.fx1 - 10, ly + 6, 5, 0x1a1a1a); P.hl(K.fx1 - 10, ly + 8, 5, 0x1a1a1a);
      P.rect(K.fx1 - 12, K.baseY - 8, 9, 8, 0x8a6a3a); for (let j = 0; j < 3; j++) P.hl(K.fx1 - 11, K.baseY - 7 + j * 2, 7, 0xf4ecdc);  // tidningsställ
      P.vl(K.fx0 + 2, K.rtop - 8, 8, 0x9a9aa0); P.rect(K.fx0 + 3, K.rtop - 8, 5, 3, 0xffd23f);
    },
  },
  toalett: {
    wall: 0x4a7a5a, wallKind: 'metal', roof: 'flat', roofCol: 0x5a6a60, ground: 'plain', groundH: 20, signBg: 0x1a3a8a, signFg: 0xffffff, doorCol: 0x3a5a4a,
    extra(P, K) {
      // piktogram, upptaget-lampa, ventilationsgaller
      const px = K.fx0 + 4, py = K.baseY - 22;
      P.rect(px, py, 6, 8, 0xf4f1ea); P.px(px + 2, py + 1, 0x1a3a8a); P.px(px + 3, py + 1, 0x1a3a8a); P.rect(px + 1, py + 3, 4, 3, 0x1a3a8a); P.px(px + 2, py + 6, 0x1a3a8a); P.px(px + 3, py + 6, 0x1a3a8a);
      P.rect(K.fx1 - 10, py, 6, 8, 0xf4f1ea); P.px(K.fx1 - 8, py + 1, 0xd83a5a); P.px(K.fx1 - 7, py + 1, 0xd83a5a); P.rect(K.fx1 - 9, py + 3, 4, 2, 0xd83a5a); P.hl(K.fx1 - 10, py + 5, 6, 0xd83a5a); P.px(K.fx1 - 8, py + 6, 0xd83a5a); P.px(K.fx1 - 7, py + 6, 0xd83a5a);
      P.px(K.dx + K.dw + 2, K.baseY - 16, 0xd83a2a); K.out.busy = { x: K.dx + K.dw + 2 + K.box.x, y: K.baseY - 16 + K.box.y };
      for (let j = 0; j < 3; j++) P.hl(K.fx0 + 4, K.ftop + 6 + j * 2, K.b.w - 8, 0x2a4a3a, 0.7);
    },
    glow(ctx, b, st, k, m) { if (m.busy) { ctx.fillStyle = rgba(0xff4a3a, (0.6 * k).toFixed(3)); ctx.fillRect(m.busy.x - 1, m.busy.y - 1, 3, 3); } },
  },
  glasskiosk: {
    wall: 0xf2b8c8, wallKind: 'plaster', roof: 'flat', roofCol: 0xe86a9a, ground: 'plain', groundH: 20, awning: 0xe86a9a, signBg: 0xffffff, signFg: 0xe8446a,
    extra(P, K) {
      // jättestrut på taket, glasslucka, prislista
      const cx = K.fx0 + (K.b.w >> 1), cy = K.rtop - 4;
      for (let j = 0; j < 8; j++) P.hl(cx - 3 + (j >> 1), cy + j, 7 - ((j >> 1) << 1), (j & 1) ? 0xd8a860 : 0xe8c078);
      P.ell(cx - 2, cy - 3, 3, 3, 0xf05a8a, 1, 1); P.ell(cx + 2, cy - 3, 3, 3, 0xf4ecdc, 1, 1); P.ell(cx, cy - 6, 3, 3, 0x7a4424, 1, 1); P.px(cx, cy - 8, 0xd8303a);
      const lx = K.dx + K.dw + 2, ly = K.baseY - 22;
      if (lx + 10 < K.fx1) { P.rect(lx, ly, 8, 10, 0x1a1a20); area(P, lx + 1, ly + 1, 6, 8, (X, Y, i, j) => (K.night ? 0xffd88a : qmix(0xa8c8e4, 0x3e5a80, j / 8, X, Y, 3))); if (K.night) K.lit.push([lx + 1 + K.box.x, ly + 1 + K.box.y, 6, 8]); }
      P.rect(K.fx0 + 2, K.baseY - 14, 10, 12, 0xf4f1ea); P.box(K.fx0 + 2, K.baseY - 14, 10, 12, 0xe8446a); for (let j = 0; j < 3; j++) { P.px(K.fx0 + 4, K.baseY - 12 + j * 3, [0xf05a8a, 0x7a4424, 0xffd23f][j]); P.hl(K.fx0 + 6, K.baseY - 12 + j * 3, 4, 0xe8446a, 0.7); }
    },
  },
  lekforrad: {
    wall: 0xa8743a, wallKind: 'wood', roof: 'gable', roofCol: 0x6a3a2a, ground: 'plain', groundH: 18, signBg: 0xffd23f, signFg: 0x3a2a1a, doorCol: 0x7a4a2a,
    extra(P, K) {
      // hänglås, boll och hink vid väggen, skateboard som lutar
      P.rect(K.dx + K.dw - 6, K.baseY - 12, 4, 4, 0xe8c040); P.px(K.dx + K.dw - 5, K.baseY - 13, 0x8a8a90); P.px(K.dx + K.dw - 4, K.baseY - 13, 0x8a8a90); P.px(K.dx + K.dw - 4, K.baseY - 11, 0x1a1a1a);
      P.ell(K.fx0 + 4, K.baseY - 3, 3, 3, 0xd83a2a, 1, 1); P.px(K.fx0 + 3, K.baseY - 4, 0xf4f1ea); P.px(K.fx0 + 5, K.baseY - 2, 0xf4f1ea);
      P.rect(K.fx1 - 8, K.baseY - 6, 5, 6, 0x2a8ad8); P.hl(K.fx1 - 9, K.baseY - 7, 7, 0x60b0f0);
      P.line(K.fx1 - 4, K.baseY - 1, K.fx1 + 2, K.baseY - 16, 0xd8a040); P.px(K.fx1 - 3, K.baseY - 3, 0x2a2a2a); P.px(K.fx1, K.baseY - 12, 0x2a2a2a);
    },
  },
  paviljong: {
    wall: 0xf4f1ea, wallKind: 'wood', roof: 'gable', roofCol: 0x3a7a68, ground: 'plain', groundH: 30, signBg: 0x3a7a68, signFg: 0xf4f1ea,
    extra(P, K) {
      // öppen paviljong: vita kolonner, räcke, scen med notställ och vimplar
      const w = K.b.w;
      for (let x = K.fx0 + 4; x < K.fx1 - 4; x += 16) { P.rect(x, K.ftop + 4, 4, K.baseY - K.ftop - 6, 0xf4f1ea); P.vl(x, K.ftop + 4, K.baseY - K.ftop - 6, WHITE); P.vl(x + 3, K.ftop + 4, K.baseY - K.ftop - 6, 0xb8b0a0); P.rect(x - 1, K.ftop + 4, 6, 2, 0xe8e0d0); P.rect(x - 1, K.baseY - 4, 6, 2, 0xd8d0c0); }
      for (let x = K.fx0 + 8; x < K.fx1 - 8; x++) { if (x >= K.dx - 2 && x < K.dx + K.dw + 2) continue; P.px(x, K.baseY - 12, 0xf4f1ea); if ((x & 3) === 0) P.vl(x, K.baseY - 11, 8, 0xe8e0d0); P.px(x, K.baseY - 3, 0xd8d0c0); }
      for (let i = 0; i < 3; i++) { const nx = K.fx0 + 14 + i * 22; if (Math.abs(nx - (K.dx + K.dw / 2)) < 16) continue; P.vl(nx, K.baseY - 22, 10, 0x2a2a30); P.rect(nx - 3, K.baseY - 25, 7, 4, 0x2a2a30); P.hl(nx - 2, K.baseY - 24, 5, 0xf4f1ea, 0.6); }
      P.px(K.fx0 + (w >> 1), K.rtop - 6, 0xe8c040); P.vl(K.fx0 + (w >> 1), K.rtop - 5, 5, 0xe8c040);
      K.out.bunting = { x0: K.fx0 - 2 + K.box.x, x1: K.fx1 + 2 + K.box.x, y: K.ftop + 2 + K.box.y };
      P.rect(K.fx0 + 6, K.rtop + 4, 5, 5, 0x1a1a20); P.rect(K.fx0 + 7, K.rtop + 5, 3, 3, K.night ? 0xffe8a0 : 0xd8e0e0);
    },
    live(ctx, b, st, m) {
      if (!m.bunting) return;
      const { x0, x1, y } = m.bunting, wnd = clamp((st.env?.weather?.wind || 3) / 25, 0.15, 1);
      for (let x = x0, i = 0; x < x1; x += 5, i++) {
        const dy = Math.round(Math.sin(st.t * 5 + i * 0.8) * 1.5 * wnd) + Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 2);
        ctx.fillStyle = rgb([0xe8443a, 0x3a9bff, 0xffd23f, 0x6fdc4c, 0xf4f1ea][i % 5]);
        ctx.fillRect(x, y + dy, 3, 2); ctx.fillRect(x + 1, y + dy + 2, 1, 1);
      }
      ctx.fillStyle = '#5a5048'; ctx.fillRect(x0, y - 1, x1 - x0, 1);
    },
  },
};

// ---------------------------------------------------------------------
// Bensinmacken: pumparna och taket ritas som egna y-sorterade föremål så att
// man kan gå in under taket och mellan pumparna. Taket cachas per snö.
// ---------------------------------------------------------------------
const MACK = { pump: null, roof: {} };
function pumpImg() {
  if (MACK.pump) return MACK.pump;
  const P = new Pix(18, 30);
  P.rect(2, 26, 14, 4, 0x6a6a70); P.hl(2, 26, 14, 0x9a9aa0); P.hl(2, 29, 14, 0x3a3a40);              // pumpön
  P.rect(3, 4, 12, 22, 0xd8342c); P.vl(3, 4, 22, 0xff7a6a); P.vl(14, 4, 22, 0x8a1a14); P.hl(3, 4, 12, 0xff8a7a);
  P.rect(5, 7, 8, 6, 0xf4f1ea); P.box(5, 7, 8, 6, 0x1a1a1a); P.rect(6, 8, 6, 1, 0x1a1a1a); P.rect(6, 10, 4, 1, 0x1a1a1a);
  P.rect(5, 15, 8, 3, 0x2a2a2a); P.px(6, 16, 0x6fdc4c); P.px(8, 16, 0xffd23f);
  P.rect(15, 10, 2, 8, 0x2a2a2a); P.vl(16, 18, 6, 0x1a1a1a); P.rect(15, 23, 3, 2, 0x4a4a50);           // slang och munstycke
  P.rect(1, 12, 2, 8, 0x2a2a2a); P.vl(1, 20, 5, 0x1a1a1a);
  P.hl(3, 25, 12, 0x000000, 0.3);
  return (MACK.pump = P.flush());
}
function roofImg(b, snow) {
  const k = snow ? 's' : 'n';
  if (MACK.roof[k]) return MACK.roof[k];
  const w = b.w + 8, P = new Pix(w, 14);
  area(P, 0, 0, w, 8, (X, Y, i, j) => jit(j === 0 ? 0xf4f4f8 : 0xe8e8ee, X, Y, 61, 0.05));
  P.rect(0, 8, w, 5, 0xd8342c); P.hl(0, 8, w, WHITE); P.hl(0, 12, w, 0x8a1a14);
  const s = 'PIXELMACKEN', tw = textW(SMALL, s); text(P, SMALL, s, (w - tw) >> 1, 8, WHITE);
  for (let i = 6; i < w - 6; i += 12) P.rect(i, 13, 3, 1, 0xfff0c0);                                 // lampor under taket
  if (snow) area(P, 0, 0, w, 7, (X, Y, i, j) => (hash(X, Y, 91) > 0.12 ? (hash(X, Y, 92) > 0.8 ? WHITE : 0xe8eef6) : null));
  return (MACK.roof[k] = P.flush());
}
function mackItems(b, st) {
  const out = [], pump = pumpImg();
  for (const [x0, , x1, y1] of b.blocks) out.push({ y: y1, draw: (ctx) => ctx.drawImage(pump, x0 + ((x1 - x0 - 18) >> 1), y1 - 30) });
  out.push({ y: b.frontY, draw: (ctx) => {
    const snow = (st.env?.weather?.snowCover || 0) > 0.5, img = roofImg(b, snow), y = b.base - 50;
    ctx.fillStyle = '#b8b8c0'; ctx.fillRect(b.x + 10, y + 12, 2, 58); ctx.fillRect(b.x + b.w - 12, y + 12, 2, 58);   // pelare
    ctx.fillStyle = '#7a7a84'; ctx.fillRect(b.x + 11, y + 12, 1, 58); ctx.fillRect(b.x + b.w - 11, y + 12, 1, 58);
    ctx.drawImage(img, b.x - 4, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x - 4, y + 14, img.width, 1);
  } });
  return out;
}
function mackGlow(ctx, b, st) {
  const k = clamp((st.env?.dark ?? 0) / 0.5, 0, 1);
  if (k <= 0) return;
  ctx.globalCompositeOperation = 'lighter';
  const y = b.base - 50 + 13;
  for (let i = 6; i < b.w + 2; i += 12) { ctx.fillStyle = rgba(0xfff0c0, (0.5 * k).toFixed(3)); ctx.fillRect(b.x - 4 + i - 1, y - 1, 5, 3); ctx.fillStyle = rgba(0xffe8b0, (0.08 * k).toFixed(3)); ctx.fillRect(b.x - 4 + i - 8, y + 2, 19, 40); }
  ctx.fillStyle = rgba(0xffe8c0, (0.12 * k).toFixed(3)); ctx.fillRect(b.x, b.base + 4, b.w, 36);   // ljus över hela förgården
  ctx.globalCompositeOperation = 'source-over';
}

export const BUILDING_ART = Object.fromEntries(Object.entries(SPECS).map(([k, spec]) => {
  const art = makeArt(spec);
  // fasadlådans mörka dörröppning får en skymtad interiör (+ ev. spec.over ovanpå)
  const live0 = art.live;
  art.live = (ctx, b, st) => { live0(ctx, b, st); drawInre(ctx, b, st); spec.over?.(ctx, b, st); };
  if (k === 'bensinmack') { art.items = (b, st) => mackItems(b, st); const g = art.glow; art.glow = (ctx, b, st) => { g(ctx, b, st); mackGlow(ctx, b, st); }; }
  if (spec.items) art.items = (b, st) => spec.items(b, st);
  return [k, art];
}));
