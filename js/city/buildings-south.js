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
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW, ctxText } from '../core/floor-pix.js';
import { makeArt, jit, qmix, windowAt, WALLS, WHITE, rgba } from './facade-kit.js';
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
    // ljus butik som fasaden: krämvita väggar, grön pärlspont, trägolv,
    // foderhyllan till vänster och den upplysta akvarieraden längst in
    base(0xf2ead6, 0xc09a68, 17);
    for (let j = 17; j < h; j++) for (let x = ((j - 17) & 1) * 3; x < w; x += 6) P.px(x, j, mul(0x7a5a34, dim), 0.55); // golvplankornas skarvar
    P.hl(0, 12, w, mul(0xfaf4e4, dim));
    area(P, 0, 13, w, 4, (X, Y, i, j) => mul(j === 0 ? 0x4a9a64 : (i % 3) === 2 ? 0x24663e : 0x2f7a4a, dim));
    P.vl(0, 0, 17, mul(0x1f5c38, dim)); P.vl(10, 0, 17, mul(0x1f5c38, dim));          // foderhyllans gavlar
    for (let s = 0; s < 3; s++) {
      const sy = 1 + s * 5;                                                           // hyllplanet ligger på sy + 4
      for (let i = 0; i < 4; i++) {
        const c = [0xd83a2a, 0x2a5ad0, 0xffc830, 0x2a8a3a, 0xf05a8a][(i + s * 2) % 5], bx = 1 + i * 2 + (i >> 1), bh = 3 + ((i + s) & 1);
        P.rect(bx, sy + 4 - bh, 2, bh, mul(c, dim)); P.px(bx, sy + 4 - bh, mul(mix(c, WHITE, 0.35), dim)); P.px(bx + 1, sy + 3, mul(c, dim * 0.75));
      }
      P.hl(1, sy + 4, 9, mul(0xe8dcc0, dim)); P.hl(1, sy + 5, 9, mul(0x6a4a2a, dim), 0.6);
    }
    P.rect(13, 1, w - 14, 2, mul(0x3a3c40, dim)); P.hl(13, 1, w - 14, mul(0x6a6c72, dim)); // akvarieraden: lock,
    P.box(13, 3, w - 14, 8, mul(0x1a1c1e, dim));
    area(P, 14, 4, w - 16, 6, (X, Y, i, j) => (j === 0 ? mul(0xd8f4ff, dim + 0.2) : j === 5 ? mul(0xc8b890, dim + 0.1) : qmix(mul(0x5ac8ec, dim + 0.2), mul(0x1e6aa8, dim + 0.1), j / 5, X, Y, 3)));
    P.px(16, 6, 0xff8030); P.px(20, 7, 0xffd23f); P.px(23, 5, 0xf05a8a); P.px(25, 7, mul(0x4ab04a, dim + 0.1)); P.px(25, 8, mul(0x2e8a3a, dim + 0.1));
    area(P, 13, 11, w - 14, 5, (X, Y, i, j) => (j === 0 ? mul(0x4a443c, dim) : mul(jit(0x2a2622, X, Y, 73, 0.05), dim))); // skåpet under
    P.vl(11, 0, 1, mul(0x2a2a2a, dim)); P.rect(11, 1, 2, 1, night ? 0xffe8a0 : 0xfff0c0);   // taklampan
    P.rect(14, 18, 8, 4, mul(0xd8b878, dim)); P.hl(14, 18, 8, mul(0xf0d8a0, dim));      // foderpallen: säckar med grön etikett
    P.hl(14, 21, 8, mul(0x9a7a48, dim)); P.rect(16, 19, 3, 2, mul(0x2f7a4a, dim)); P.px(17, 19, mul(0xf2ead6, dim));
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
      // servitören öppnar dörren när han går ut med en pizza och kommer tillbaka
      if (uteOpen(st).gaster) { const wd = kyparLage(st.t, st).door || 0; if (wd > (st.doorOpen || 0) + 0.02) drawInre(ctx, b, { night: st.night, doorOpen: wd }); }
    },
    // uteserveringen på trädäcket längs gaveln mot Postgatan: bord med rutiga dukar, parasoll, gäster
    // som äter och en servitör som kommer ut med pizza (se UTESERVERINGEN)
    items(b, st) { return uteserveringen(b, st); },
    obstacles() { return uteObstacles(); },
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
      // värmeljusen och parasollens glödlampor på uteserveringen
      uteGlow(ctx, st, k);
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
  // En välskött kvartersbutik (Carl: "ser lite konstig ut" – blek puts,
  // spöktext, skylten skymd av stuprör och träd, bostadslik). Krämvit puts
  // med kvaderhörn och en STOR förgylld huvudskylt högst upp – fritt ovanför
  // gatuträdet – med svanhalslampor som lyser upp den på kvällen. Nere en
  // grönmålad butiksfront: kornisch med konsoler, fascia med tassfris,
  // krämvita skyltfönster (valphörnan med lekande valpar, korg och klösträd
  // med kattungar till vänster; undulaten, fiskfodret och akvariet till
  // höger), prydliga prislappar, glasdörr med vändskylt ÖPPET/STÄNGT och
  // öppettider, grönrandig markis (ritas i over() så att den ligger kvar över
  // dörröppningen), dörrmatta och ett målat tassspår på trottoaren (items()).
  // Våning 1 hör till butiken: reklamfrisen AKVARIUM · FODER · TILLBEHÖR · SMÅDJUR
  // och utställningsvåningen (akvarieracket, växtakvariet, terrariet med
  // sköldpaddan + marsvinsburen, havsakvariet); bostäderna finns bara överst.
  // Djuren lever i live(), ljuset i glow() – gatuplanets ljus maskas runt
  // gatuträdets krona. Allt i K.out.dj är världskoordinater.
  djuraffar: {
    wall: 0xefe4c8, wallKind: 'plaster', roof: 'flat', roofCol: 0x7a7670, ground: 'shop', groundH: 30, floorH: 24, winW: 12, winSp: 20, frame: 0x3a6a46, doorCol: 0x2a6a44, noSign: true,
    // pixelbitmappar ('#' = tänd, figurerna tittar åt höger och speglas vid behov)
    _PAW: ['..#.#..', '.##.##.', '#.....#', '#.###.#', '.#####.', '.#####.', '..###..'],
    _PAWS: ['.#.#.', '#...#', '.###.', '.###.'],
    _FISH: ['.###.#', '#####.', '.###.#'],
    // a = päls, c = ljus, b = skugga, d = mörk (öra/ränder), k = svart, w = vit nos, e = öga, n = nos
    _SPR: {
      valpA: ['......cc..', '.....dcka.', '.c...daaak', '..a..daaww', '..cccaaaw.', '..aaaaaaa.', '..bbbbbbb.', '..b.b.b.b.', '..b.b.b.b.'],
      valpB: ['......cc..', '.....dcka.', 'c....daaak', '.a...daaww', '..cccaaaw.', '..aaaaaaa.', '..bbbbbbb.', '..bb..bb..', '...b...b..'],
      valpS: ['......cc..', '.....dcka.', 'c....daaak', '.a...daaww', '..cccaaaw.', '..aaaaaaa.', '..bbbbbbb.', '..b.b.b.b.', '..b.b.b.b.'],
      valpSov: ['..cccc...', '.caaaacc.', 'aaaaadabk', '.bbbbbbb.'],
      kattA: ['c....c.c', 'a....aaa', 'a....aea', '.a...aan', '.cdcdca.', '.aaaaaa.', '.b.bb.b.'],
      kattB: ['.....c.c', 'c....aaa', 'a....aea', '.a...aan', '.cdcdca.', '.aaaaaa.', '..bb.bb.'],
      kattSitt: ['c...c..', 'aaaaa..', 'aeaea..', 'aanaa.c', '.aca..a', '.aaaaa.', '.b.b...'],
      kattSlag: ['c...c..', 'aaaaaa.', 'aeaeaa.', 'aanaa.c', '.aca..a', '.aaaaa.', '.b.b...'],
      kattSov: ['.cccc..', 'caadaac', '.bbbbb.'],
      // utställningsvåningen: marsvin (står, betar, sover) och sköldpaddan
      grisA: ['..ccd.', 'acaaka', '.bbbb.'],
      grisB: ['..cc..', 'acaad.', '.bbbka'],
      grisSov: ['.ccd..', 'acaak.', 'bbbbbb'],
      padda: ['.cac..', 'cabacd', '.b..b.'], paddaIn: ['.cac..', 'cabac.', '.b..b.'],
    },
    _PAL: {
      guld: { id: 'g', a: 0xd8a060, c: 0xf0c888, b: 0xa87038, d: 0x7a4a24, k: 0x1a1410, w: 0xfff0dc },
      flack: { id: 'f', a: 0x7a4a2c, c: 0x9e6c44, b: 0x55321c, d: 0x3a2010, k: 0x0a0604, w: 0xf6eee0 },
      gra: { id: 'k', a: 0x9a9aa8, c: 0xc8c8d4, b: 0x6a6a7a, d: 0x585866, e: 0x7ae05a, n: 0xf0a0b4, k: 0x1a1a20 },
      rod: { id: 'r', a: 0xf0a050, c: 0xffcc88, b: 0xc07028, d: 0xb0601e, e: 0x6ad0f0, n: 0xf0a0b4, k: 0x1a1a20 },
      vit: { id: 'v', a: 0xf2ece0, c: 0xffffff, b: 0xc8bca8, d: 0x9a6a3a, k: 0x2a1a14 },       // vitt marsvin med bruna öron
      padda: { id: 'p', a: 0x6a5a2a, c: 0xa89a52, b: 0x3e3016, d: 0x9ab468, k: 0x1a1a14 }, // brunt skal med ljus teckning
    },
    _cache: new Map(),
    _img(key, make) { const C = SPECS.djuraffar._cache; let c = C.get(key); if (!c) { c = make(); C.set(key, c); } return c; },
    _sprite(ctx, name, pal, x, foot, dir) {
      const D = SPECS.djuraffar, rows = D._SPR[name];
      const img = D._img('s:' + name + pal.id + (dir < 0 ? 'l' : 'r'), () => {
        const w = rows[0].length, P = new Pix(w, rows.length);
        rows.forEach((r, j) => { for (let i = 0; i < w; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(dir < 0 ? w - 1 - i : i, j, c); } });
        return P.flush();
      });
      ctx.drawImage(img, Math.round(x), Math.round(foot) - rows.length + 1);
    },
    // prislapp: vit kartong, grön ram, rundade hörn, ev. ikon före texten
    _cardW(str, icon) { return textW(SMALL, str) + (icon ? icon[0].length + 1 : 0) + 4; },
    _card(P, x, y, str, fg, icon, iconCol) {
      const iw = icon ? icon[0].length + 1 : 0, w = textW(SMALL, str) + iw + 4, h = 7;
      P.rect(x + 1, y + 1, w, h, 0x000000, 0.28);
      P.rect(x, y, w, h, 0xfbf7ec); P.hl(x + 1, y + 1, w - 2, 0xffffff);
      P.box(x, y, w, h, 0x1f5c38); P.erase(x, y, 1, 1); P.erase(x + w - 1, y, 1, 1);
      if (icon) icon.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') P.px(x + 2 + i, y + 1 + ((5 - icon.length + 1) >> 1) + j, iconCol); });
      text(P, SMALL, str, x + 2 + iw, y + 1, fg);
      return w;
    },
    // vändskylten på dörren: ÖPPET (vit med grön text) / STÄNGT (röd)
    _doorCard(open) {
      return SPECS.djuraffar._img('dorr:' + (open ? 1 : 0), () => {
        const s = open ? 'ÖPPET' : 'STÄNGT', bg = open ? 0xfbf7ec : 0xc8342a, fg = open ? 0x1f7a44 : 0xffffff, w = textW(SMALL, s) + 4, h = 9, P = new Pix(w + 1, h + 1);
        P.rect(1, 1, w, h, 0x000000, 0.3);
        P.rect(0, 0, w, h, bg); P.hl(1, 1, w - 2, mix(bg, WHITE, 0.3)); P.hl(1, h - 2, w - 2, mul(bg, open ? 0.9 : 0.8));
        P.box(0, 0, w, h, open ? 0x1f5c38 : mul(bg, 0.5)); P.erase(0, 0, 1, 1); P.erase(w - 1, 0, 1, 1);
        text(P, SMALL, s, 2, 3, fg);
        P.px((w >> 1) - 1, 0, 0xd8d8d8); P.px(w >> 1, 0, 0xd8d8d8);                     // sugkoppen
        return P.flush();
      });
    },
    // Kvällsljuset ritas ovanpå allt (city.js) – även på gatuträdet som står framför
    // skyltfönstren, där det blev hårda ljusrutor (granskningsfynd). Gatuplanets ljus
    // ritas därför i en egen buffert där trädkronorna först suddas ut.
    //   _trees: gatuträden framför huset, hittade via stammens hinder i env.obstacles
    //   (props.js: tree() → [x - 2, y - 2, x + 3, y + 1], 5 × 3) på kantstenen
    //   _crown: kronans mask – lindens form (props TREE.lind: rx 20, ry 18, cy −52)
    //   med mjuk kant; ytterlövet får lite ljus, som om det lyses upp av fönstret
    _glowBuf(b, d) {
      if (d._gb) return d._gb;
      const x = b.x - 10, y = d.glassL[1] - 16, w = b.w + 20, h = baseOf(b) + 34 - y;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      return (d._gb = { cv, ctx: cv.getContext('2d'), x, y, w, h });
    },
    _trees(b, env) {
      const obs = env?.obstacles;
      if (!obs) return [];
      const D = SPECS.djuraffar, memo = D._treeMemo || (D._treeMemo = new Map()), hit = memo.get(b.id);
      if (hit && hit.obs === obs && hit.n === obs.length) return hit.list;
      const base = baseOf(b), list = [];
      for (const o of obs) {
        if (!Array.isArray(o) || o[2] - o[0] !== 5 || o[3] - o[1] !== 3) continue;
        const tx = o[0] + 2, ty = o[1] + 2;
        if (tx > b.x - 22 && tx < b.x + b.w + 22 && ty > base + 12 && ty < base + 40) list.push([tx, ty]);
      }
      memo.set(b.id, { obs, n: obs.length, list });
      return list;
    },
    _crown() {
      return SPECS.djuraffar._img('krona', () => {
        const M = new Pix(46, 40);                                                       // (i, j) ↔ världen (tx − 23 + i, ty − 73 + j)
        for (let j = 0; j < 40; j++) for (let i = 0; i < 46; i++) {
          const ex = Math.abs((i + 0.5 - 22.5) / 20.5), ey = Math.abs((j + 0.5 - 19.5) / 17.8);
          const e = Math.pow(Math.pow(ex, 2.2) + Math.pow(ey, 2.2), 1 / 2.2);
          const a = clamp((1.02 - e) / 0.2, 0, 1);
          if (a > 0) M.px(i, j, 0xffffff, a);
        }
        return M.flush();
      });
    },
    extra(P, K) {
      const D = SPECS.djuraffar;
      const GRON = 0x2f7a4a, GRONM = 0x1f5c38, GRONL = 0x4a9a64, KREM = 0xf2ead6, KREML = 0xfff8e8, KREMS = 0xcfc2a4;
      const GULD = 0xe8c050, GULDL = 0xfff0a8, GULDS = 0xa8802a, MORK = 0x16301f;
      const L = K.fx0, R = K.fx1, gt = K.gtop, by = K.baseY, dx = K.dx, dw = K.dw, night = K.night, ox = K.box.x, oy = K.box.y;
      const snow = !!(K.opts && K.opts.snow);
      const bits = (rows, x, y, c, a = 1) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') P.px(x + i, y + j, c, a); });
      const dj = (K.out.dj = { ox, oy });

      // ---- övervåningarna ----
      // Överst bostäder (persienner, gardin, butikskatten i fönstret). Våning 1 hör
      // till BUTIKEN (granskningen: "läses som ett bostadshus"): en målad reklamfris
      // AKVARIUM · FODER · TILLBEHÖR · SMÅDJUR och UTSTÄLLNINGSVÅNINGEN – fyra breda
      // skyltfönster (vart och ett i stället för två bostadsfönster) med
      // sötvattensracket, det stora växtakvariet, terrariet med sköldpaddan och
      // marsvinsburen, och havsakvariet med korallerna. Fiskarna, paddan och
      // marsvinen lever i live(), akvarieljuset och värmelampan i glow().
      quoins(P, L, K.ftop + 5, gt - 14, 0xdcd0b2, 1);
      quoins(P, R - 1, K.ftop + 5, gt - 14, 0xdcd0b2, -1);
      const g = winGrid(K, SPECS.djuraffar), rowY = [...new Set(g.map((r) => r[1]))].sort((a, b) => a - b);
      for (const [wx, wy, ww, wh, kk, ff] of g) {
        if (ff !== 0) continue;                                                        // (våning 1 byggs om nedan)
        if (kk !== 5 && hash(kk, 7, K.seed) > 0.55) {                                  // persienner halvt nere
          const n = 3 + ((hash(kk, 8, K.seed) * (wh - 6)) | 0);
          for (let j = 1; j < n; j += 2) P.hl(wx + 1, wy + j, ww - 2, 0xe8e4d8, 0.8);
          P.hl(wx + 1, wy + n, ww - 2, 0x8a8a80, 0.7);
        } else if (kk === 2) {                                                         // gardin i djuraffärsgrönt
          P.rect(wx + 1, wy + 1, 2, wh - 2, 0x4a8a5a); P.rect(wx + ww - 3, wy + 1, 2, wh - 2, 0x4a8a5a);
        }
        if (kk === 5) {                                                                // butikskatten i fönstret
          P.rect(wx + 3, wy + wh - 5, 6, 4, 0x2a2620); P.px(wx + 3, wy + wh - 6, 0x2a2620); P.px(wx + 7, wy + wh - 6, 0x2a2620);
          P.px(wx + 9, wy + wh - 3, 0x2a2620);
          P.px(wx + 4, wy + wh - 5, 0x6fdc4c); P.px(wx + 6, wy + wh - 5, 0x6fdc4c);
        }
      }
      // våning 1: bostadsfönstren (och deras tända rum i fasadlådans glöd) putsas bort
      for (let i = K.lit.length - 1; i >= 0; i--) if (K.lit[i][1] === rowY[1] + oy) K.lit.splice(i, 1);
      area(P, L + 5, gt - 40, R - L - 10, 27, (X, Y) => WALLS.plaster(X, Y, K.wall, K.seed));
      // reklamfrisen: mörkgrön målad bräda i skyltens bredd, förgyllda ändlister,
      // krämvit text med slagskugga och guldtassar mellan orden
      const fz0 = L + 6, fzw = R - 7 - fz0 + 1, fy = gt - 40;
      area(P, fz0, fy, fzw, 9, (X, Y, i, j) => {
        if (j === 0 || j === 8 || i === 0 || i === fzw - 1) return MORK;
        if (i === 1 || i === fzw - 2) return j < 4 ? GULDL : GULDS;
        let c = jit(mix(0x2a6e4c, 0x1c5036, (j - 1) / 6), X, Y, K.seed + 21, 0.05);
        if (j === 1) c = mix(c, WHITE, 0.1); else if (j === 7) c = mul(c, 0.86);
        return c;
      });
      if (snow) for (let x = fz0; x < fz0 + fzw; x++) if (hash(x, 9, 91) > 0.35) P.px(x, fy - 1, hash(x, 10, 91) > 0.5 ? 0xf4f8ff : 0xe8eef8); // snö på brädans överkant
      const WORDS = ['AKVARIUM', 'FODER', 'TILLBEHÖR', 'SMÅDJUR'], gap = 3;
      const tw = WORDS.reduce((s, w) => s + textW(SMALL, w), 0) + (WORDS.length - 1) * (5 + 2 * gap);
      let tx = fz0 + ((fzw - tw) >> 1);
      WORDS.forEach((w, i) => {
        text(P, SMALL, w, tx + 1, fy + 3, MORK, 0.85);
        text(P, SMALL, w, tx, fy + 2, KREML);
        tx += textW(SMALL, w);
        if (i < WORDS.length - 1) { bits(D._PAWS, tx + gap, fy + 3, GULD); P.px(tx + gap + 1, fy + 5, GULDL); tx += 5 + 2 * gap; }
      });
      // utställningsvåningen: fyra breda fönster i krämvit ram med grön smyg och fönsterbänk
      const wx00 = Math.min(...g.map((r) => r[0])), SHOW = [0, 1, 2, 3].map((i) => wx00 + 40 * i), s0 = gt - 29; // glaset: s0 … s0 + 12
      for (const a of SHOW) {
        P.rect(a - 1, gt - 31, 34, 16, mul(GRONM, 0.62));
        area(P, a, gt - 30, 32, 15, (X, Y, i, j) => (j === 0 || i === 0 ? KREML : j === 14 || i === 31 ? KREMS : jit(KREM, X, Y, K.seed + 22, 0.03)));
        P.hl(a - 2, gt - 15, 36, KREML); P.hl(a - 2, gt - 14, 36, 0x000000, 0.28);
        if (snow) for (let x = a - 2; x < a + 34; x++) if (hash(x, 8, 91) > 0.3) P.px(x, gt - 16, 0xf4f8ff);
      }
      // Fönstrens innehåll målas av showroom(P, I, aq, rec) – I = färgfilter för rummet,
      // aq = för akvarievattnet – så att nattbilden får en TÄND variant (timer till 22).
      const WATER = { sot: [0x8ae4f8, 0x2a86c0], vaxt: [0x86dcc8, 0x1a6a7a], hav: [0x8ab8ff, 0x1a3a9a] };
      const showroom = (P, I, aq, rec) => {
        const room = (a) => area(P, a + 1, s0, 30, 13, (X, Y, i, j) => {
          if (j === 12) return I(jit(((X >> 2) & 1) ? 0xa8804e : 0x96703f, X, Y, 91, 0.06));   // golvet
          let c = qmix(0xeef0e2, 0xcfd8c2, j / 11, X, Y, 3);
          if (j === 0) c = mul(c, 0.8);                                                 // taket
          return I(c);
        });
        // akvarium: lock, lysrör/aktiniskt ljus, vatten, grus – kanterna i glas
        const tank = (x0, y0, w, h, kind, fish) => {
          const [ct, cb] = WATER[kind];
          P.hl(x0, y0, w, I(0x303236)); P.px(x0, y0, I(0x5a5e64)); P.px(x0 + w - 1, y0, I(0x1a1c1e));
          area(P, x0, y0 + 1, w, h - 1, (X, Y, i, j) => {
            if (j === h - 2) return aq(kind === 'hav' ? (hash(X, Y, 96) > 0.5 ? 0xf2e8d0 : 0xd8cca8) : hash(X, Y, 71) > 0.5 ? 0xd8c8a0 : hash(X, Y, 72) > 0.2 ? 0xb8a070 : 0x8a7a5a);
            if (j === 0) return aq(kind === 'hav' ? 0xc8d4ff : 0xe0f8ff);
            const c = qmix(ct, cb, (j - 1) / Math.max(1, h - 4), X, Y, 3);
            return aq(i === 0 || i === w - 1 ? mix(c, WHITE, 0.35) : c);
          });
          if (rec) (dj.tanks || (dj.tanks = [])).push({ r: [x0 + 1 + ox, y0 + 2 + oy, w - 2, h - 3], kind, fish, seed: hash(x0, y0, 97) });
        };
        const weed = (x, yb, n, lo = 0x2e8a3a, hi = 0x7adc5a) => { for (let j = 0; j < n; j++) P.px(x + ((j >> 1) & 1), yb - j, aq(j >= n - 2 ? hi : lo)); };
        // -- 1: sötvattensracket, två hyllor med två akvarier var --
        let a = SHOW[0];
        room(a);
        for (const x of [a + 1, a + 15, a + 30]) for (let j = 1; j < 12; j++) P.px(x, s0 + j, I(j === 6 ? 0x6a727a : (x === a + 30 ? 0x8a929a : 0xb0b8c0)));
        tank(a + 2, s0 + 1, 13, 5, 'sot', [[0x3a8ad8, 0xe8403a, 5, 0], [0xff8030, 0xffd23f, 7, 1]]);
        tank(a + 16, s0 + 1, 14, 5, 'sot', [[0xffd23f, 0xff8030, 6, 1], [0xe8e8f0, 0x2a2a30, 4, 0]]);
        tank(a + 2, s0 + 7, 13, 5, 'vaxt', [[0xf05a8a, 0xffa0c0, 6, 0], [0x3a8ad8, 0xe8403a, 8, 1]]);
        tank(a + 16, s0 + 7, 14, 5, 'sot', [[0xff8030, 0xffb060, 5, 1], [0x6ad0f0, 0x2a5ad0, 7, 0]]);
        for (const r of [6, 12]) { P.hl(a + 1, s0 + r, 30, I(0xc4ccd4)); P.px(a + 6, s0 + r, I(0xffffff)); P.px(a + 22, s0 + r, I(0xffffff)); } // hyllplan med prislappar
        for (const [x, yb, n] of [[a + 4, s0 + 4, 2], [a + 12, s0 + 4, 2], [a + 18, s0 + 4, 2], [a + 27, s0 + 4, 2], [a + 5, s0 + 10, 2], [a + 10, s0 + 10, 2], [a + 24, s0 + 10, 2]]) weed(x, yb, n);
        // -- 2: det stora växtakvariet på mörkt skåp --
        a = SHOW[1];
        room(a);
        tank(a + 2, s0 + 1, 28, 9, 'vaxt', [[0xe8e8f0, 0x2a2a30, 3, 1, 1], [0xf08a3a, 0x3a8ad8, 4, 3, 1], [0x3a8ad8, 0xe8403a, 9, 5], [0x3a8ad8, 0xe8403a, 8, 4], [0xffd23f, 0xff8030, 6, 2]]);
        P.hl(a + 2, s0 + 10, 28, I(0x1a1c1e));
        area(P, a + 2, s0 + 11, 28, 2, (X, Y, i, j) => I(i === 13 || i === 14 ? 0x241a12 : j === 0 ? 0x5a4230 : jit(0x3e2c1e, X, Y, 98, 0.06)));
        P.px(a + 12, s0 + 11, I(0xc8a868)); P.px(a + 17, s0 + 11, I(0xc8a868));      // knoppar
        for (const [x, n] of [[a + 4, 6], [a + 5, 5], [a + 7, 4], [a + 24, 3], [a + 26, 6], [a + 27, 5]]) weed(x, s0 + 8, n);
        for (let j = 0; j < 3; j++) { P.px(a + 20, s0 + 8 - j, aq(0xc84a3a)); P.px(a + 21, s0 + 7 - j, aq(j === 2 ? 0xf08a6a : 0xe06a4a)); } // röda växten
        P.line(a + 10, s0 + 8, a + 16, s0 + 5, aq(0x6a4a2e)); P.line(a + 11, s0 + 8, a + 16, s0 + 6, aq(0x4a3220)); P.px(a + 16, s0 + 5, aq(0x9a7a50)); // rotved
        P.px(a + 18, s0 + 8, aq(0x9a98a2)); P.px(a + 19, s0 + 8, aq(0x6a6870)); P.px(a + 13, s0 + 8, aq(0xb8b4ac));   // stenar
        // -- 3: terrariet med sköldpaddan under värmelampan, marsvinsburen --
        a = SHOW[2];
        room(a);
        const t0 = a + 2;
        for (let i = 0; i < 15; i++) P.px(t0 + i, s0 + 3, I((i & 1) ? 0x5a5e64 : 0x9a9ea4));                      // nätlocket
        area(P, t0, s0 + 4, 15, 6, (X, Y, i, j) => {
          if (i === 0 || i === 14) return I(0xc0d0d0);                                                      // glaskanterna
          if (j >= 4) return I(hash(X, Y, 93) > 0.5 ? 0xe8d098 : 0xd0b478);                                // sanden
          return I(jit(mix(0xb8905a, 0x8a6a40, j / 4), X, Y, 94, 0.12));                                   // korkbakgrunden
        });
        area(P, t0 + 10, s0 + 5, 4, 4, (X, Y, i, j) => ((i === 0 && j === 0) ? null : I(j === 0 || (i === 0 && j === 1) ? (i < 2 ? 0xd0ccc0 : 0xa8a498) : i === 3 ? 0x6a665e : jit(0x9a948a, X, Y, 99, 0.1)))); // stenen
        P.px(t0 + 13, s0 + 5, I(0x8a867c)); P.px(t0 + 11, s0 + 8, I(0x7a766c));
        for (let j = 0; j < 4; j++) P.px(t0 + 2, s0 + 8 - j, I(j === 3 ? 0x8ac05a : j === 0 ? 0x3a7a2e : 0x4a8a3a));    // kaktusen
        P.px(t0 + 1, s0 + 6, I(0x4a8a3a)); P.px(t0 + 1, s0 + 5, I(0x6aaa4a)); P.px(t0 + 3, s0 + 7, I(0x4a8a3a)); P.px(t0 + 3, s0 + 6, I(0x6aaa4a));
        P.px(t0 + 2, s0 + 4, I(0xf06a9a));                                                                    // blomman
        P.hl(t0 + 7, s0 + 9, 2, I(0x5ab0e0)); P.px(t0 + 6, s0 + 9, I(0x8a8e94)); P.px(t0 + 9, s0 + 9, I(0x8a8e94)); // vattenskålen
        P.px(t0 + 8, s0, I(0x2a2a30)); P.hl(t0 + 7, s0 + 1, 3, I(0x4a4a52)); P.hl(t0 + 6, s0 + 2, 5, I(0x2a2a30)); P.px(t0 + 6, s0 + 2, I(0x6a6a72)); // värmelampan
        P.hl(t0 + 7, s0 + 3, 3, 0xffa040); P.px(t0 + 8, s0 + 3, 0xffe0a0);                                   // glöder alltid
        area(P, t0, s0 + 10, 15, 3, (X, Y, i, j) => I(j === 0 ? KREML : i === 7 ? GRONM : jit(GRON, X, Y, 100, 0.05))); // skåpet
        P.px(t0 + 6, s0 + 11, I(GULD)); P.px(t0 + 8, s0 + 11, I(GULD));
        const c0 = a + 18;                                                                                    // marsvinsburen
        for (let x = c0; x < c0 + 12; x++) P.px(x, s0 + 8, I(hash(x, 3, 95) > 0.4 ? 0xe0c870 : 0xb89a48));     // hö
        P.hl(c0 + 8, s0 + 5, 3, I(0xe04a3a)); P.hl(c0 + 7, s0 + 6, 5, I(0xb02a22)); P.px(c0 + 11, s0 + 6, I(0x7a1a14)); // huset: rött tak,
        area(P, c0 + 7, s0 + 7, 5, 2, (X, Y, i) => I(i === 1 || i === 2 ? 0x3a2418 : i === 4 ? 0x9a6436 : 0xc88a54)); // trävägg med öppning
        P.hl(c0, s0 + 4, 12, I(0xe0e4ec));                                                                   // burens överkant
        area(P, c0, s0 + 9, 12, 3, (X, Y, i, j) => I(j === 0 ? 0x7ab0f0 : i === 11 ? 0x2a5aa8 : mul(0x3a72c8, 1 - j * 0.1))); // plastbaljan
        // -- 4: havsakvariet med levande sten och koraller --
        a = SHOW[3];
        room(a);
        tank(a + 2, s0 + 1, 28, 9, 'hav', [[0xf07a2a, 0xffffff, 4, 3], [0x2a5ad8, 0xffd23f, 6, 1, 1], [0xffd23f, 0xfff08a, 5, 2, 1], [0xf07a2a, 0xffffff, 5, 4]]);
        P.hl(a + 2, s0 + 10, 28, I(0x141618)); P.hl(a + 3, s0 + 10, 26, aq(0x4a6aff), 0.5);                // blå led-list
        area(P, a + 2, s0 + 11, 28, 2, (X, Y, i, j) => I(i === 13 || i === 14 ? 0x0e1012 : j === 0 ? 0x3a3e44 : jit(0x22262a, X, Y, 101, 0.05)));
        for (let x = a + 9; x <= a + 21; x++) {                                                              // levande sten
          const hh = 1 + Math.round(2 * Math.sin((Math.PI * (x - a - 9)) / 12));
          for (let j = 0; j < hh; j++) P.px(x, s0 + 8 - j, aq(j === hh - 1 ? 0xa89080 : jit(0x7a6456, x, j, 102, 0.12)));
        }
        for (const [x, y] of [[a + 5, 8], [a + 5, 7], [a + 4, 6], [a + 6, 6], [a + 4, 5], [a + 7, 5], [a + 6, 7]]) P.px(x, s0 + y, aq(y < 6 ? 0xffa0c8 : 0xf06aa0)); // rosa grenkorall
        P.hl(a + 13, s0 + 5, 3, aq(0xf08a3a)); P.px(a + 14, s0 + 4, aq(0xffb870));                           // orange korall på stenen
        for (let j = 0; j < 5; j++) P.hl(a + 23 + (j < 2 ? 0 : 1), s0 + 8 - j, j < 2 ? 3 : 2, aq(j === 4 ? 0xc89aff : 0x9a5ad8)); // violett solfjäder
        P.px(a + 19, s0 + 5, aq(0x6ae08a)); P.px(a + 18, s0 + 6, aq(0x4ab06a)); P.px(a + 20, s0 + 6, aq(0x4ab06a)); // svampkorall
        P.px(a + 10, s0 + 6, aq(0xf0c060)); P.px(a + 11, s0 + 5, aq(0xffe090)); P.px(a + 12, s0 + 6, aq(0xf0c060)); // anemonen
        if (rec) {
          dj.show = SHOW.map((x) => [x + 1 + ox, s0 + oy, 30, 13]);
          dj.heat = [t0 + 7 + ox, s0 + 3 + oy, 3];
          dj.terra = [t0 + 1 + ox, s0 + 4 + oy, 13, 6];
          dj.turtle = { x0: t0 + 3 + ox, x1: t0 + 5 + ox, foot: s0 + 8 + oy };
          dj.pigs = { x0: c0 + ox, x1: c0 + 2 + ox, foot: s0 + 8 + oy, bars: [c0 + ox, s0 + 5 + oy] };
        }
      };
      showroom(P, (c) => (night ? mix(mul(c, 0.36), 0x0e1428, 0.32) : c), (c) => (night ? mix(mul(c, 0.6), 0x0a1a50, 0.25) : c), true);
      if (night) {                                                                        // tänd variant: butiksbelysningen på timer
        const T = new Pix(SHOW[3] + 32 - SHOW[0], 13, SHOW[0], s0);
        showroom(T, (c) => mix(c, 0xffd490, 0.18), (c) => c, false);
        dj.litUp = [T.flush(), SHOW[0] + ox, s0 + oy];
      }
      // glansen i rutorna ligger i ett eget lager som ritas efter djuren (live)
      const GL = new Pix(SHOW[3] + 32 - SHOW[0], 13, SHOW[0], s0);
      for (const a of SHOW) for (const o of [3, 18]) for (let q = 0; q < 10; q++) { GL.px(a + 1 + o + q, s0 + 12 - q, WHITE, night ? 0.05 : 0.14); GL.px(a + 2 + o + q, s0 + 12 - q, WHITE, night ? 0.03 : 0.08); }
      dj.overUp = [GL.flush(), SHOW[0] + ox, s0 + oy];
      skylight(P, L + 30, K.rtop + 6, 18, 10, night); vent(P, R - 40, K.rtop + 8); vent(P, R - 30, K.rtop + 8);
      // stuprören ute vid gavlarna – långt från skylten
      downpipe(P, L + 1, K.ftop + 4, by - 1);
      downpipe(P, R - 3, K.ftop + 4, by - 1);

      // ---- HUVUDSKYLTEN: målad träskylt med förgylld list och förgyllda
      // bokstäver, tassmedaljonger och svanhalslampor – högst upp på fasaden,
      // fritt ovanför gatuträdet och mellan stuprören ----
      const sx0 = L + 6, sx1 = R - 7, sy0 = K.ftop + 5, sy1 = sy0 + 22, sw = sx1 - sx0 + 1, sh = sy1 - sy0 + 1;
      P.hl(sx0 + 2, sy1 + 1, sw - 2, 0x000000, 0.3);                                   // slagskugga på putsen
      area(P, sx0, sy0, sw, sh, (X, Y, i, j) => {
        if (j === 0 || j === sh - 1 || i === 0 || i === sw - 1) return MORK;             // ytterkant
        if (j === 1) return i < sw - 2 ? GULDL : GULDS;                                  // förgylld list: ljus uppe/vänster,
        if (i === 1) return j < sh - 2 ? GULD : GULDS;                                   // mörk nere/höger
        if (j === sh - 2 || i === sw - 2) return GULDS;
        if (j === 2 || i === 2) return mul(0x1a4e34, 0.7);                               // fasen innanför listen
        let c = mix(0x2a6e4c, 0x1a4a32, (j - 3) / (sh - 6));                             // fältet: mörkgrönt trä,
        c = jit(c, X, Y, K.seed + 5, 0.05);                                              // liggande ådring
        const grain = hash(X >> 3, Y, K.seed + 6);
        if (grain > 0.84) c = mul(c, 0.9); else if (grain < 0.1) c = mix(c, WHITE, 0.05);
        return c;
      });
      for (const [rx, ry] of [[sx0 + 3, sy0 + 3], [sx1 - 3, sy0 + 3], [sx0 + 3, sy1 - 4], [sx1 - 3, sy1 - 4]]) { P.px(rx, ry, GULDL); P.px(rx, ry + 1, GULDS); } // mässingsskruvar
      // bokstäverna: BIG ×2, förgyllda med ljus överkant, mörk underkant och
      // slagskugga; Ä-prickarna sätts tätt över A:et så texten får plats
      const hs = 'DJURAFFAREN', hw = textW(BIG, hs, 2), hx = sx0 + ((sw - hw) >> 1), hy = sy0 + 6;
      const on = new Set(), key = (x, y) => y * 4096 + x;
      text({ px: (x, y) => on.add(key(x, y)) }, BIG, hs, hx, hy, 0, 1, 2);
      const ax = hx + textW(BIG, 'DJURAFF', 2) + 2;
      for (const ddx of [2, 6]) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) on.add(key(ax + ddx + i, hy - 3 + j));
      const each = (fn) => { for (const kk of on) fn(kk % 4096, (kk / 4096) | 0); };
      each((x, y) => { if (!on.has(key(x + 1, y + 1))) P.px(x + 1, y + 1, MORK, 0.9); });
      each((x, y) => {
        const up = on.has(key(x, y - 1)), dn = on.has(key(x, y + 1)), lf = on.has(key(x - 1, y));
        let c = y - hy < 7 ? 0xf8d45c : 0xe2b440;
        if (!up) c = GULDL; else if (!dn) c = 0xb88a2a; else if (!lf) c = mix(c, WHITE, 0.22);
        if (up && dn && ((x + y * 2) % 13) === 0) c = mix(c, WHITE, 0.5);                // glimt i bladguldet
        P.px(x, y, c);
      });
      // glödbild för kvällen: bokstäverna lyser varmt med en mjuk kant
      const G = new Pix(sw, sh);
      each((x, y) => G.px(x - sx0, y - sy0, 0xffe498, 0.55));
      each((x, y) => { for (const [a, b2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!on.has(key(x + a, y + b2))) G.px(x + a - sx0, y + b2 - sy0, 0xffb848, 0.18); });
      dj.signGlow = [G.flush(), sx0 + ox, sy0 + oy];
      dj.sign = [sx0 + ox, sy0 + oy, sw, sh];
      // tassmedaljongerna i skyltens ändar
      for (const cx of [sx0 + 10, sx1 - 10]) {
        const cy = sy0 + 11;
        for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
          const e = Math.hypot(xx, yy);
          if (e > 7.45) continue;
          P.px(cx + xx, cy + yy, e > 6.5 ? (xx + yy < 0 ? GULDL : GULDS) : e > 5.6 ? GULD : mix(KREML, KREMS, clamp((yy + 4) / 11, 0, 1)));
        }
        P.px(cx - 6, cy - 2, MORK); P.px(cx + 6, cy + 2, MORK);                          // (skuggan i ringens innerkant)
        bits(D._PAW, cx - 3, cy - 3, GRONM);
        P.px(cx - 1, cy + 1, GRON); P.px(cx, cy + 1, GRON);                              // blank på trampdynan
      }
      // svanhalslamporna: armen ur krönet, skärm och glas över tavlan
      dj.lamps = [];
      for (const lx of [1, 3, 5, 7].map((q) => sx0 + Math.round((sw * q) / 8))) {
        P.vl(lx, K.ftop + 1, 3, 0x2a2e30); P.px(lx + 1, K.ftop + 1, 0x6a6e70);
        P.hl(lx - 1, sy0 - 3, 3, 0x3a3e40); P.hl(lx - 2, sy0 - 2, 5, 0x24282a); P.px(lx - 2, sy0 - 2, 0x5a5e60);
        P.hl(lx - 1, sy0 - 1, 3, night ? 0xfff4c8 : 0x9aa0a4);
        dj.lamps.push([lx + ox, sy0 - 1 + oy]);
      }
      if (snow) for (let x = sx0; x <= sx1; x++) { P.px(x, sy0 - 1, 0xf4f8ff); if (hash(x, 3, 91) > 0.45) P.px(x, sy0 - 2, 0xe8eef8); }

      // ---- BUTIKSFRONTEN ----
      // kornisch med tandsnitt, konsoler i ändarna
      P.hl(L - 1, gt - 13, R - L + 2, KREML); P.hl(L - 1, gt - 12, R - L + 2, KREM);
      for (let x = L; x < R; x++) P.px(x, gt - 11, (x & 1) ? KREMS : KREM);
      P.hl(L, gt - 10, R - L, mul(KREMS, 0.82));
      if (snow) for (let x = L - 1; x <= R; x++) if (hash(x, 5, 91) > 0.25) P.px(x, gt - 13, 0xf4f8ff);
      // fascian: mörkgrön med förgylld pärlstav och en tassfris som vandrar över
      area(P, L, gt - 9, R - L, 9, (X, Y, i, j) => {
        if (j === 0) return mul(GRONM, 0.55);
        if (j === 1) return (X & 1) ? GULD : GULDL;
        if (j === 8) return GULDS;
        let c = jit(GRONM, X, Y, K.seed + 7, 0.05);
        if (j === 2) c = mix(c, WHITE, 0.08); else if (j === 7) c = mul(c, 0.85);
        return c;
      });
      for (let i = 0, x = L + 8; x < R - 10; i++, x += 12) bits(D._PAWS, x, gt - 6 + (i & 1), KREM, 0.95);
      for (const [cx0, s] of [[L, 1], [R - 4, -1]]) {                                   // konsolerna
        area(P, cx0, gt - 13, 4, 13, (X, Y, i, j) => {
          let c = jit(KREM, X, Y, K.seed + 8, 0.04);
          if (s > 0 ? i === 0 : i === 3) c = KREML; else if (s > 0 ? i === 3 : i === 0) c = KREMS;
          if (j === 12) c = mul(KREMS, 0.85);
          return c;
        });
        P.hl(cx0, gt - 13, 4, KREML); P.px(cx0 + 1, gt - 4, KREMS); P.px(cx0 + 2, gt - 4, KREMS); P.px(cx0 + (s > 0 ? 1 : 2), gt - 3, GULDS);
      }
      // panelen: grönmålad stående träpanel
      area(P, L, gt, R - L, by - gt, (X, Y, i, j) => {
        let c = jit(GRON, X, Y, K.seed + 6, 0.06);
        const k = (X - L) % 3;
        if (k === 2) c = mul(c, 0.84); else if (k === 0) c = mix(c, WHITE, 0.07);
        if (j === 0) c = mul(c, 0.68);
        return c;
      });
      for (const [px0, s] of [[L, 1], [R - 4, -1]]) {                                   // pilastrarna
        area(P, px0, gt, 4, by - gt, (X, Y, i, j) => {
          let c = jit(KREM, X, Y, K.seed + 9, 0.04);
          if (s > 0 ? i === 0 : i === 3) c = KREML; else if (s > 0 ? i === 3 : i === 0) c = KREMS;
          if (j >= by - gt - 4) c = j === by - gt - 4 ? KREML : mul(c, 0.92);           // bas
          return c;
        });
      }
      downpipe(P, L + 1, gt - 13, by - 1);                                               // stuprören går ner förbi pilastrarna
      downpipe(P, R - 3, gt - 13, by - 1);
      // sockeln i granit
      area(P, L + 4, by - 1, R - L - 8, 1, (X, Y) => jit(0x5a5852, X, Y, K.seed + 10, 0.12));

      // ---- SKYLTFÖNSTREN: krämvita ramar, bröstning med speglar ----
      const gy0 = gt + 3, gy1 = gt + 21, gh = gy1 - gy0 + 1;                            // glasets rader
      const WIN = [[L + 4, dx - 2], [dx + dw + 2, R - 4]];
      for (const [a, z] of WIN) {
        area(P, a, gt + 1, z - a, 23, (X, Y, i, j) => {
          let c = jit(KREM, X, Y, K.seed + 12, 0.03);
          if (j === 0 || i === 0) c = KREML; else if (i === z - a - 1) c = KREMS;
          return c;
        });
        P.hl(a + 2, gy0 - 1, z - a - 4, mul(KREMS, 0.85));                              // smygen
        P.hl(a - 1, gt + 22, z - a + 2, KREML); P.hl(a - 1, gt + 23, z - a + 2, KREMS);    // fönsterbänken
        P.hl(a - 1, gt + 24, z - a + 2, 0x000000, 0.3);
        if (snow) for (let x = a - 1; x <= z; x++) if (hash(x, 6, 91) > 0.3) P.px(x, gt + 21, 0xf4f8ff);
        const pw = (z - a - 4) >> 1;                                                     // två speglar i bröstningen
        for (const p0 of [a + 1, a + 3 + pw]) {
          P.rect(p0, gt + 25, pw, 3, mix(GRON, WHITE, 0.06));
          P.hl(p0, gt + 25, pw, mul(GRONM, 0.85)); P.vl(p0, gt + 25, 3, mul(GRONM, 0.85));
          P.hl(p0 + 1, gt + 27, pw - 1, mix(GRON, WHITE, 0.2)); P.vl(p0 + pw - 1, gt + 26, 2, mix(GRON, WHITE, 0.2));
        }
      }
      // Vitrinerna målas av vitrin(P, I, aq) – P = mål, I = färgfilter, aq = akvariets
      // filter – så att nattbilden också kan få en TÄND variant: skyltbelysningen
      // står på timer till kl 22, och live() lägger den tända vitrinen över glaset.
      const la = WIN[0][0] + 2, lz = WIN[0][1] - 3, ra = WIN[1][0] + 2, rz = WIN[1][1] - 3;
      const vitrin = (P, I, aq) => {
        const bits = (rows, x, y, c, a = 1) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') P.px(x + i, y + j, c, a); });
        // -- vänster: valphörnan och klösträdet --
        area(P, la, gy0, lz - la + 1, gh, (X, Y, i, j) => {
          let c = qmix(0xf4ecd4, 0xd8ccae, j / gh, X, Y, 3);
          if ((i % 6) === 0) c = mul(c, 0.95);
          if (j === 0) c = mul(c, 0.8);
          return I(c);
        });
        area(P, la, gt + 12, 34, 5, (X, Y, i, j) => { let c = qmix(0x8ab0d8, 0x6a8ec0, j / 5, X, Y, 3); if (hash(X, Y, 81) > 0.86) c = mix(c, WHITE, 0.18); return I(c); });  // mjuk fleecefilt
        P.hl(la, gt + 17, 34, I(KREML));
        area(P, la, gt + 18, 34, 4, (X, Y, i) => I((i % 4) === 3 ? 0xd8d2c2 : 0xf6f2ea));   // vit sockel
        bits(D._PAWS, la + 14, gt + 18, I(GRONL));
        P.rect(la + 1, gt + 14, 5, 1, I(0xb8c0cc)); P.rect(la + 2, gt + 15, 3, 1, I(0x7a828e)); P.px(la + 1, gt + 14, I(0xe8eef4)); // matskålen i stål
        P.px(la + 2, gt + 13, I(0x8a5a2a)); P.px(la + 4, gt + 13, I(0x7a4a22)); P.px(la + 3, gt + 13, I(0xa06a36));
        P.px(la + 11, gt + 15, I(0xfaf6ea)); P.px(la + 11, gt + 17, I(0xfaf6ea)); P.hl(la + 12, gt + 16, 2, I(0xfaf6ea)); // tuggbenet
        P.px(la + 14, gt + 15, I(0xfaf6ea)); P.px(la + 14, gt + 17, I(0xfaf6ea));
        const bedX = la + 22;                                                             // hundkorgen: flätad kant, rutig kudde
        const wick = (X, Y) => (((X + Y) & 1) ? 0xb08050 : 0x8a5a30);
        area(P, bedX, gt + 10, 11, 2, (X, Y, i, j) => ((i === 0 || i === 10) && j === 0 ? null : I(j === 0 ? mix(wick(X, Y), WHITE, 0.15) : wick(X, Y))));
        area(P, bedX, gt + 12, 11, 2, (X, Y, i) => I(i === 0 || i === 10 ? wick(X, Y) : ((X + Y) % 4 < 2 ? 0xc84a3a : 0xe8d8c0)));
        area(P, bedX, gt + 14, 11, 2, (X, Y, i, j) => ((i === 0 || i === 10) && j === 1 ? null : I(j === 0 ? mix(wick(X, Y), WHITE, 0.2) : wick(X, Y))));
        // klösträdet: sisalstolpar och gröna mattbeklädda hyllor
        const sisal = (X, Y) => (((X + Y) % 3) === 0 ? 0x9a7a4a : 0xd8c090);
        area(P, la + 48, gt + 13, 3, 9, (X, Y, i) => I(i === 2 ? mul(sisal(X, Y), 0.8) : sisal(X, Y)));
        area(P, la + 59, gt + 17, 3, 5, (X, Y, i) => I(i === 2 ? mul(sisal(X, Y), 0.8) : sisal(X, Y)));
        const carpet = (x, y, w) => { P.hl(x, y, w, I(GRONL)); P.hl(x, y + 1, w, I(GRON)); P.hl(x, y + 2, w, I(GRONM)); P.hl(x + 1, y + 3, w - 2, 0x000000, 0.25); };
        carpet(la + 39, gt + 10, 23); carpet(la + 55, gt + 15, 11);
        P.hl(la + 38, gt + 20, 28, I(GRON)); P.hl(la + 38, gt + 21, 28, I(GRONM));         // foten
        dj.glassL = [la + ox, gy0 + oy, lz - la + 1, gh];
        dj.pen = { x0: la + 1 + ox, x1: la + 31 + ox, foot: gt + 17 + oy };
        dj.bed = { x: bedX + ox, foot: gt + 13 + oy, rim: gt + 14 + oy };
        dj.cat = { topX: la + 50 + ox, topFoot: gt + 9 + oy, lowX: la + 56 + ox, lowFoot: gt + 14 + oy };
        dj.toy = [la + 46 + ox, gy0 + oy];
        dj.bedFront = D._img('korg', () => {
          const Q = new Pix(11, 2);
          for (let j = 0; j < 2; j++) for (let i = 0; i < 11; i++) if (!((i === 0 || i === 10) && j === 1)) Q.px(i, j, j === 0 ? mix(wick(i, j), WHITE, 0.2) : wick(i, j));
          return Q.flush();
        });
        // -- höger: fågelburen, fiskfodret och akvariet --
        area(P, ra, gy0, rz - ra + 1, gh, (X, Y, i, j) => {
          let c = qmix(0xe4ecde, 0xc4d0c2, j / gh, X, Y, 3);
          if ((i % 6) === 0) c = mul(c, 0.95);
          if (j === 0) c = mul(c, 0.8);
          return I(c);
        });
        const cgx = ra + 2;                                                               // fågelburen hänger i taket
        P.px(cgx + 5, gy0, I(0x4a4a52));
        P.hl(cgx + 3, gy0 + 1, 5, I(0xd8d8e0)); P.hl(cgx + 1, gy0 + 2, 9, I(0xc8c8d4));
        for (let i = 0; i <= 10; i += 2) P.vl(cgx + i, gy0 + 3, 4, I(0xb8b8c8));
        P.hl(cgx + 1, gy0 + 5, 9, I(0x8a6a3a));
        P.rect(cgx - 1, gy0 + 7, 13, 2, I(0x3a6a4a)); P.hl(cgx - 1, gy0 + 7, 13, I(GRONL));
        P.rect(cgx + 8, gy0 + 5, 2, 2, I(0xe8c050));
        dj.cage = [cgx + 3 + ox, gy0 + 2 + oy];
        P.hl(ra + 1, gt + 18, 20, I(0x8a6a3a)); P.hl(ra + 1, gt + 19, 20, I(0x5a4426));      // hyllan med fiskfoder
        P.hl(ra + 2, gt + 20, 18, 0x000000, 0.2);
        for (let i = 0; i < 5; i++) {
          const c = [0xd83a2a, 0x2a5ad0, 0xffc830, 0x2a8a3a, 0xf05a8a][i], x = ra + 2 + i * 4;
          P.rect(x, gt + 14, 3, 4, I(c)); P.vl(x, gt + 14, 4, I(mix(c, WHITE, 0.3))); P.hl(x, gt + 15, 3, I(0xf8f4ea)); P.hl(x, gt + 13, 3, I(0xd8d8e0));
        }
        const tx0 = ra + 22, tx1 = rz - 1;                                                 // akvariet på svart skåp
        P.rect(tx0 - 1, gy0 + 1, tx1 - tx0 + 3, 2, 0x24262a); P.hl(tx0 - 1, gy0 + 1, tx1 - tx0 + 3, 0x4a4c52);  // locket
        P.box(tx0, gy0 + 3, tx1 - tx0 + 1, 11, 0x1a1c1e);
        const wx0 = tx0 + 1, wx1 = tx1 - 1, wy0 = gy0 + 4, wy1 = gy0 + 12;
        area(P, wx0, wy0, wx1 - wx0 + 1, wy1 - wy0 + 1, (X, Y, i, j) => {
          if (j === 0) return aq(0xd8f4ff);                                                // lysröret
          if (j >= 7) return aq(hash(X, Y, 71) > 0.5 ? 0xd8c8a0 : hash(X, Y, 72) > 0.2 ? 0xb8a070 : 0x8a7a5a); // gruset
          return aq(qmix(0x5ac8ec, 0x1e6aa8, (j - 1) / 6, X, Y, 4));
        });
        P.hl(wx0, wy0 + 1, wx1 - wx0 + 1, aq(0xb8f0ff), 0.8);                             // vattenytan
        for (const [gx, gh2] of [[wx0 + 2, 7], [wx0 + 4, 5], [wx0 + 8, 4], [wx1 - 9, 6], [wx1 - 6, 7], [wx1 - 2, 5]]) for (let j = 0; j < gh2; j++) {
          const px = gx + ((j >> 1) & 1);
          P.px(px, wy1 - 1 - j, aq(j > gh2 - 3 ? 0x6fdc4c : 0x2e8a3a));
          if (j === 2) P.px(px + 1, wy1 - 1 - j, aq(0x4ab04a));
        }
        const cx2 = wx0 + 17;                                                             // slottet
        P.rect(cx2, wy1 - 5, 7, 4, aq(0x9a98a2)); P.vl(cx2 + 6, wy1 - 5, 4, aq(0x6a6870));
        for (let i = 0; i < 7; i += 2) P.px(cx2 + i, wy1 - 6, aq(0x9a98a2));
        P.rect(cx2 + 2, wy1 - 3, 2, 2, aq(0x2a2a34)); P.px(cx2 + 5, wy1 - 1, aq(0xf05a6a));
        area(P, tx0, gy0 + 14, tx1 - tx0 + 1, gh - 14, (X, Y, i, j) => (j === 0 ? 0x4a443c : i === ((tx1 - tx0) >> 1) ? 0x141210 : jit(0x2a2622, X, Y, 73, 0.05))); // skåpet
        P.px(tx0 + ((tx1 - tx0) >> 1) - 2, gy0 + 16, 0xa8a8b0); P.px(tx0 + ((tx1 - tx0) >> 1) + 2, gy0 + 16, 0xa8a8b0);
        dj.aqua = [wx0 + ox, wy0 + 1 + oy, wx1 - wx0 + 1, 5];
        dj.tank = [tx0 + ox, gy0 + 3 + oy, tx1 - tx0 + 1, 11];
        dj.glassR = [ra + ox, gy0 + oy, rz - ra + 1, gh];
      };
      vitrin(P, (c) => (night ? mix(mul(c, 0.4), 0x0e1428, 0.3) : c), (c) => (night ? mul(c, 0.82) : c)); // släckt: dunkelt inne, akvariet lyser ändå
      if (night) {
        const T = new Pix(WIN[1][1] - WIN[0][0], gh, WIN[0][0], gy0);
        vitrin(T, (c) => mix(c, 0xffd490, 0.2), (c) => c);         // varmt glödlampsljus
        dj.lit = [T.flush(), WIN[0][0] + ox, gy0 + oy];
      }
      // prislappar och glasglans ligger i ett eget lager som ritas efter djuren
      const glass = (w, fn) => { const O = new Pix(w, gh + 2); fn(O); for (const a of [6, 30]) for (let d = 0; d < 13; d++) { O.px(a + d, gh + 1 - d, WHITE, night ? 0.05 : 0.12); O.px(a + d + 1, gh + 1 - d, WHITE, night ? 0.03 : 0.07); } return O.flush(); };
      dj.overL = [glass(lz - la + 1, (O) => D._card(O, 2, 0, '995:-', 0xc8342a)), la + ox, gy0 - 2 + oy];
      dj.overR = [glass(rz - ra + 1, (O) => D._card(O, rz - ra + 1 - D._cardW('19:-', D._FISH) - 2, 0, '19:-', 0xc8342a, D._FISH, 0xf08030)), ra + ox, gy0 - 2 + oy];

      // ---- DÖRREN: grön glasdörr med mässingsdetaljer och öppettider ----
      area(P, dx - 2, gt + 1, 2, by - gt - 1, (X, Y, i) => (i === 0 ? KREML : KREM));
      area(P, dx + dw, gt + 1, 2, by - gt - 1, (X, Y, i) => (i === 0 ? KREM : KREMS));
      P.hl(dx - 2, gt + 1, dw + 4, KREML); P.hl(dx - 2, gt + 2, dw + 4, KREM); P.hl(dx, gt + 3, dw, KREMS);
      const dy0 = K.dy;
      area(P, dx, dy0, dw, by - dy0, (X, Y, i) => { let c = jit(GRON, X, Y, K.seed + 11, 0.05); if (i === 0) c = mix(c, WHITE, 0.15); else if (i === dw - 1) c = mul(c, 0.7); return c; });
      const gx0 = dx + 3, gx1 = dx + dw - 4, gya = dy0 + 2, gyb = dy0 + 16;
      P.box(gx0 - 1, gya - 1, gx1 - gx0 + 3, gyb - gya + 3, mul(GRON, 0.6));
      area(P, gx0, gya, gx1 - gx0 + 1, gyb - gya + 1, (X, Y, i, j) => {
        let c = night ? qmix(0x1c2638, 0x0e1420, j / 15, X, Y, 3) : qmix(0x9ab8c8, 0x5a7488, j / 15, X, Y, 3);
        if (j === 5 || j === 10) c = mul(c, 0.78);                                       // hyllorna därinne
        else if ((j === 4 || j === 9) && hash(X, Y, 74) > 0.45) c = mix(c, [0xd83a2a, 0x2a5ad0, 0xffc830, 0x2a8a3a][(X >> 1) & 3], night ? 0.15 : 0.45);
        if (!night && ((X * 2 - Y * 3) % 23 + 23) % 23 < 2) c = mix(c, WHITE, 0.3);     // glansen i glaset
        return c;
      });
      const hrs = '9-19', hwd = textW(SMALL, hrs);                                     // öppettiderna: dekalremsa med guldtext
      P.darken(gx0, gyb - 5, gx1 - gx0 + 1, 6, night ? 0.7 : 0.42);
      P.hl(gx0, gyb - 5, gx1 - gx0 + 1, GULDS, 0.55);
      text(P, SMALL, hrs, dx + ((dw - hwd) >> 1) + 1, gyb - 3, 0x000000, 0.5);
      text(P, SMALL, hrs, dx + ((dw - hwd) >> 1), gyb - 4, 0xf8dc8a);
      dj.doorCard = [dx + (dw >> 1) + ox, gya - 1 + oy];
      P.rect(gx0 + 1, gyb + 2, gx1 - gx0 - 1, 1, GULD); P.px(gx0 + 1, gyb + 1, GULDS); P.px(gx1 - 1, gyb + 1, GULDS); P.hl(gx0 + 2, gyb + 2, 6, GULDL); // tryckstången
      area(P, dx + 1, by - 5, dw - 2, 3, (X, Y, i, j) => (j === 0 ? GULDL : j === 1 ? GULD : GULDS)); // sparkplåten
      P.hl(dx, by - 1, dw, mul(GRONM, 0.8));
      area(P, dx - 3, by, dw + 6, 2, (X, Y, i, j) => (j === 0 ? jit(0xb8b4aa, X, Y, 75, 0.06) : jit(0x8a867c, X, Y, 76, 0.06))); // trappsteget i granit
      P.hl(dx + dw + 5, by - 2, 6, 0xe86a5a); P.rect(dx + dw + 5, by - 1, 6, 2, 0xc8342a); P.rect(dx + dw + 6, by - 1, 4, 1, 0x60b8e8); // vattenskål för hundar

      // skyltfönstrens glas för kvällsglöden: glow() ritar fasadlådans skyltfönsterljus
      // själv (i bufferten där gatuträdets krona maskas bort), så K.shop töms
      K.shop.length = 0;
      dj.shopGlass = [dj.glassL, dj.glassR];
    },
    // markisen ligger i ett eget lager så att den syns även när dörren står öppen
    over(ctx, b, st) {
      const D = SPECS.djuraffar, dw = b.door.x1 - b.door.x0, aw = dw + 12, ax = b.door.x0 - 6, ay = baseOf(b) - 34;
      const snow = (st.env?.weather?.snowCover || 0) > 0.5;
      const img = D._img('markis' + aw + (snow ? 's' : ''), () => {
        const GRON = 0x2f7a4a, KREM = 0xf2ead6, P = new Pix(aw, 11), shade = [0.8, 0.9, 0.97, 1.02, 1.06];
        for (let j = 0; j < 9; j++) for (let i = 0; i < aw; i++) {
          const s = ((i >> 2) & 1), ii = i & 3;
          let c;
          if (j === 0) c = (i % 8) === 3 ? 0x9aa8a0 : 0x1a4a30;                        // stången med fästen
          else if (j <= 5) { c = s ? KREM : GRON; if (ii === 0) c = mix(c, WHITE, 0.12); else if (ii === 3) c = mul(c, 0.86); c = mul(c, shade[j - 1]); }
          else if (j <= 7) { c = s ? KREM : GRON; if (j === 6) c = mul(c, 0.76); else if (ii === 0) c = mix(c, WHITE, 0.1); }
          else { if (ii === 0 || ii === 3) continue; c = mul(s ? KREM : GRON, 0.9); }   // bågkanten
          P.px(i, j, c);
        }
        for (let i = 0; i < aw; i++) { const ii = i & 3; P.px(i, 9, 0x000000, ii === 0 || ii === 3 ? 0.16 : 0.28); P.px(i, 10, 0x000000, 0.12); }
        if (snow) for (let i = 0; i < aw; i++) { P.px(i, 1, 0xf4f8ff); if (hash(i, 2, 77) > 0.4) P.px(i, 2, 0xe8eef8); }
        return P.flush();
      });
      ctx.drawImage(img, ax, ay);
    },
    live(ctx, b, st, m) {
      const d = m.dj;
      if (!d) return;
      const D = SPECS.djuraffar, t = st.t, h = st.hour, tri = (p) => (p < 1 ? p : 2 - p);
      const awake = h >= 7.5 && h < 20.5, open = !b.open || (h >= b.open[0] && h < b.open[1]);
      if (d.lit && st.night && h >= 12 && h < 22) ctx.drawImage(d.lit[0], d.lit[1], d.lit[2]); // skyltbelysningen på timer
      if (d.litUp && st.night && h >= 12 && h < 22) ctx.drawImage(d.litUp[0], d.litUp[1], d.litUp[2]);
      // ---- utställningsvåningen: fiskarna i akvarierna (långsammare på natten) ----
      if (d.tanks) for (const tk of d.tanks) {
        const [x, y, w, hh] = tk.r;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
        tk.fish.forEach(([c1, c2, sp, row, big], i) => {
          const fw = big ? 3 : 2, ph = ((t * sp * (awake ? 1 : 0.35)) / Math.max(3, w - fw) + i * 0.43 + tk.seed) % 2, dir = ph < 1 ? 1 : -1;
          const fx = Math.round(x + tri(ph) * (w - fw)), fy = y + Math.min(hh - (big ? 2 : 1), row + (Math.sin(t * 1.3 + i * 2.1 + tk.seed * 6) > 0.7 ? 1 : 0));
          ctx.fillStyle = rgb(c1); ctx.fillRect(fx, fy, fw, big ? 2 : 1);
          ctx.fillStyle = rgb(c2);
          if (big) { ctx.fillRect(fx + 1, fy, 1, 2); ctx.fillRect(dir > 0 ? fx : fx + 2, fy + ((Math.floor(t * 5 + i) & 1)), 1, 1); } // rand + viftande stjärt
          else ctx.fillRect(dir > 0 ? fx : fx + 1, fy, 1, 1);
        });
        if (hh >= 4) {                                                                    // bubblor ur luftstenen
          ctx.fillStyle = 'rgba(225,248,255,0.7)';
          for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3 + tk.seed) % 1; ctx.fillRect(x + w - 2 - (i & 1), Math.round(y + hh - 1 - ph * hh), 1, 1); }
        }
        ctx.restore();
      }
      // sköldpaddan traskar fram och tillbaka i sanden; sover under lampan på natten
      if (d.turtle) {
        const { x0, x1, foot } = d.turtle, ph = awake ? (t * 0.03) % 2 : 0.2, tuck = !awake || (t % 9) > 7.2;
        D._sprite(ctx, tuck ? 'paddaIn' : 'padda', D._PAL.padda, Math.round(x0 + tri(ph) * (x1 - x0)), foot, ph < 1 ? 1 : -1);
      }
      // marsvinen: det ena småspringer och betar hö, det andra tittar ut ur huset; gallret framför
      if (d.pigs) {
        const { x0, x1, foot, bars } = d.pigs;
        if (awake) {
          const ph = (t * 0.07) % 2, px = Math.round(x0 + tri(ph) * (x1 - x0)), nib = !(Math.floor(t * 1.4) % 3);
          D._sprite(ctx, nib ? 'grisB' : 'grisA', D._PAL.rod, px, foot, ph < 1 ? 1 : -1);
          if ((t % 7) < 4.5) { ctx.fillStyle = '#f2ece0'; ctx.fillRect(bars[0] + 8, foot - 1, 2, 2); ctx.fillStyle = '#2a1a14'; ctx.fillRect(bars[0] + 8, foot - 1, 1, 1); } // nosen i dörren
        } else {
          D._sprite(ctx, 'grisSov', D._PAL.rod, x0, foot, 1);
          D._sprite(ctx, 'grisSov', D._PAL.vit, x0 + 2, foot, -1);
        }
        ctx.fillStyle = st.night ? (h >= 12 && h < 22 ? '#a09888' : '#3a3e4a') : '#e4e8ee';
        ctx.globalAlpha = 0.6;
        for (let x = bars[0] + 1; x < bars[0] + 12; x += 3) ctx.fillRect(x, bars[1], 1, 4);
        ctx.globalAlpha = 1;
      }
      if (d.overUp) ctx.drawImage(d.overUp[0], d.overUp[1], d.overUp[2]);
      // ---- akvariet: fiskar och bubblor ----
      if (d.aqua) {
        const [x, y, w, hh] = d.aqua;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y - 1, w, hh + 2); ctx.clip();
        const FISK = [[0xff8030, 0xffb060, 6, 1], [0xffd23f, 0xfff08a, 8, 3], [0x3a8ad8, 0xe8403a, 11, 4], [0xf05a8a, 0xffa0c0, 5, 2], [0xe8e8f0, 0x2a2a30, 4, 0]];
        FISK.forEach(([c1, c2, sp, row], i) => {
          const ph = ((t * sp) / (w - 6) + i * 0.37) % 2, dir = ph < 1 ? 1 : -1;
          const fx = Math.round(x + 1 + tri(ph) * (w - 7)), fy = Math.round(y + row + Math.sin(t * 1.7 + i * 2) * 0.8);
          ctx.fillStyle = rgb(c1); ctx.fillRect(fx, fy, 3, 2);
          ctx.fillStyle = rgb(c2);
          if (i === 2) ctx.fillRect(fx, fy + 1, 3, 1);                                   // neontetran: röd buk
          else if (i === 4) { ctx.fillRect(fx + 1, fy - 1, 1, 4); }                      // skalaren: hög, randig
          else ctx.fillRect(fx + (dir > 0 ? 2 : 0), fy, 1, 1);
          ctx.fillStyle = rgb(c1); ctx.fillRect(fx + (dir > 0 ? -1 : 3), fy + ((Math.floor(t * 6 + i) & 1)), 1, 1); // stjärtfenan viftar
          ctx.fillStyle = '#101418'; ctx.fillRect(fx + (dir > 0 ? 2 : 0), fy, 1, 1);
        });
        ctx.fillStyle = 'rgba(225,248,255,0.75)';
        for (let i = 0; i < 3; i++) { const ph = (t * 0.55 + i / 3) % 1; ctx.fillRect(x + w - 2 - (i & 1), Math.round(y + hh + 1 - ph * (hh + 1)), 1, 1); }
        ctx.restore();
      }
      // ---- undulaten byter pinne och nickar ----
      if (d.cage) {
        const hop = Math.floor(t * 0.9) % 3 === 0, bx = d.cage[0] + (hop ? 4 : 0), by2 = d.cage[1] - (Math.floor(t * 4) % 5 === 0 ? 1 : 0);
        ctx.fillStyle = '#5ac84a'; ctx.fillRect(bx, by2 + 1, 2, 2);
        ctx.fillStyle = '#ffe04a'; ctx.fillRect(bx + (hop ? 0 : 1), by2, 1, 1);
        ctx.fillStyle = '#2a5ad0'; ctx.fillRect(bx + (hop ? 1 : 0), by2 + 3, 1, 1);
      }
      // ---- valphörnan och klösträdet ----
      if (d.pen && d.glassL) {
        const [gx, gy, gw, gh] = d.glassL, P1 = D._PAL.guld, P2 = D._PAL.flack, K1 = D._PAL.gra, K2 = D._PAL.rod;
        ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
        const foot = d.pen.foot;
        if (awake) {
          // bollen studsar mellan kanterna; valp 1 jagar den en bit efter
          const wl = d.pen.x0, wr = d.pen.x1 - 2, ball = (tt) => wl + tri((tt * 0.3) % 2) * (wr - wl);
          const lag = t - 1.1, pc = clamp(ball(lag), wl + 5, wr - 5), dir = ball(lag) >= ball(lag - 0.1) ? 1 : -1;
          const px = Math.round(pc - 5), run = Math.floor(t * 9) & 1;
          // valp 2 står i korgen, viftar på svansen och skuttar ibland till
          const hop2 = (t % 5.3) < 0.35 ? 1 : 0, dir2 = pc < d.bed.x + 5 ? -1 : 1;
          D._sprite(ctx, (Math.floor(t * 7) & 1) ? 'valpS' : 'valpA', P2, d.bed.x + 1, d.bed.foot - hop2, dir2);
          ctx.drawImage(d.bedFront, d.bed.x, d.bed.rim);
          D._sprite(ctx, run ? 'valpB' : 'valpA', P1, px, foot - (run ? 1 : 0), dir);
          const bxp = Math.round(ball(t)), byp = foot - 1 - Math.round(Math.abs(Math.sin(t * 7.5)) * 3);
          ctx.fillStyle = '#d8342a'; ctx.fillRect(bxp, byp - 1, 2, 2); ctx.fillStyle = '#fff4e0'; ctx.fillRect(bxp, byp - 1, 1, 1);
          // kattunge 1 sitter högst upp och slår efter leksaken som dinglar
          const sw = Math.sin(t * 2.1), tx = d.toy[0] + Math.round(sw * 3), ty = d.toy[1] + 5;
          ctx.fillStyle = 'rgba(80,70,60,0.8)';
          for (let j = 0; j < 5; j++) ctx.fillRect(Math.round(d.toy[0] + sw * 3 * (j / 5)), d.toy[1] + j, 1, 1);
          ctx.fillStyle = '#e8446a'; ctx.fillRect(tx, ty, 2, 2); ctx.fillStyle = '#ffd23f'; ctx.fillRect(tx + 1, ty + 1, 1, 1);
          D._sprite(ctx, sw > 0.55 ? 'kattSlag' : 'kattSitt', K1, d.cat.topX, d.cat.topFoot, -1);
          // kattunge 2 tassar fram och tillbaka på den lägre hyllan
          const uk = (t * 0.12) % 2, kd = uk < 1 ? 1 : -1, walk = Math.floor(t * 5) & 1;
          D._sprite(ctx, walk ? 'kattB' : 'kattA', K2, d.cat.lowX + Math.round(tri(uk) * 2), d.cat.lowFoot, kd);
        } else {
          // natt: valparna sover ihopkrupna i korgen, kattungarna på hyllorna
          D._sprite(ctx, 'valpSov', P1, d.bed.x + 1, d.bed.foot, 1);
          D._sprite(ctx, 'valpSov', P2, d.bed.x + 2, d.bed.foot + 1, -1);
          ctx.drawImage(d.bedFront, d.bed.x, d.bed.rim);
          D._sprite(ctx, 'kattSov', K1, d.cat.topX, d.cat.topFoot, 1);
          D._sprite(ctx, 'kattSov', K2, d.cat.lowX + 1, d.cat.lowFoot, -1);
          const zp = (t * 0.35) % 1;                                                       // zzz
          ctx.fillStyle = `rgba(255,255,255,${(0.8 * (1 - zp)).toFixed(3)})`;
          const zx = d.bed.x + 7 + Math.round(zp * 3), zy = d.bed.foot - 8 - Math.round(zp * 5);
          ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
        }
        ctx.restore();
      }
      // prislappar och glasglans framför djuren, vändskylten på dörren
      if (d.overL) ctx.drawImage(d.overL[0], d.overL[1], d.overL[2]);
      if (d.overR) ctx.drawImage(d.overR[0], d.overR[1], d.overR[2]);
      if (d.doorCard) { const c = D._doorCard(open); ctx.drawImage(c, d.doorCard[0] - ((c.width - 1) >> 1), d.doorCard[1]); }
    },
    // tassspåret på trottoaren och dörrmattan (platta dekaler direkt framför fasaden)
    items(b, st) {
      if ((st.env?.weather?.snowCover || 0) > 0.35) return [];
      const D = SPECS.djuraffar, cx = (b.door.x0 + b.door.x1) >> 1, y0 = baseOf(b) + 2;
      const img = D._img('spar', () => {
        const P = new Pix(33, 28), mx = 6;
        for (let j = 0; j < 6; j++) for (let i = 0; i < 21; i++) {                       // dörrmattan i kokos med grön kant
          const edge = j === 0 || j === 5 || i === 0 || i === 20;
          P.px(mx + i, j, edge ? (j === 5 ? 0x14402a : 0x1f5c38) : jit(((i + j) & 1) ? 0xa8844e : 0x94703e, i, j, 78, 0.06));
        }
        D._PAWS.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(mx + 8 + i, 1 + j, 0x2f7a4a); });
        for (let i = 0; i < 21; i++) P.px(mx + i, 6, 0x000000, 0.2);
        [[10, 9], [16, 14], [9, 19], [15, 24]].forEach(([x, y], k) => {                   // målade tassar som leder in
          D._PAWS.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(x + i, y + j, 0x3a9a5a, hash(i + k * 7, j, 79) > 0.82 ? 0.35 : 0.85); });
        });
        return P.flush();
      });
      return [{ y: y0 - 0.6, draw: (ctx) => ctx.drawImage(img, cx - 16, y0) }];
    },
    glow(ctx, b, st, k, m) {
      const d = m.dj;
      if (!d) return;
      const t = st.t, h = st.hour, open = !b.open || (h >= b.open[0] && h < b.open[1]);
      // skylten: svanhalslamporna lyser ner över tavlan och bladguldet glänser
      if (d.sign) {
        const [sx, sy, sw, sh] = d.sign;
        for (const [lx, ly] of d.lamps) {
          ctx.fillStyle = rgba(0xfff4c8, (0.9 * k).toFixed(3)); ctx.fillRect(lx - 1, ly, 3, 1);
          for (let j = 1; j <= sh; j++) {
            const hw2 = 2 + Math.round(j * 0.9), a = 0.17 * (1 - j / (sh + 8));
            ctx.fillStyle = rgba(0xffe2a0, (a * k).toFixed(3)); ctx.fillRect(Math.max(sx + 1, lx - hw2), ly + j, Math.min(hw2 * 2 + 1, sx + sw - 1 - Math.max(sx + 1, lx - hw2)), 1);
          }
        }
        if (d.signGlow) { ctx.globalAlpha = clamp(k * (0.85 + 0.15 * Math.sin(t * 1.3)), 0, 1); ctx.drawImage(d.signGlow[0], d.signGlow[1], d.signGlow[2]); ctx.globalAlpha = 1; }
        ctx.fillStyle = rgba(0xffd890, (0.07 * k).toFixed(3)); ctx.fillRect(sx - 2, sy + sh, sw + 4, 4);
      }
      const D = SPECS.djuraffar, disp = open || (h >= 12 && h < 22);
      // utställningsvåningen: varmt butiksljus på timer till 22, akvarierna lyser blått
      // (dämpat nattljus efter 22), värmelampan över terrariet glöder alltid
      if (d.show) {
        if (disp) for (const [x, y, w, hh] of d.show) {
          ctx.fillStyle = rgba(0xffdca0, (0.13 * k).toFixed(3)); ctx.fillRect(x, y, w, hh);
          ctx.fillStyle = rgba(0xfff2c8, (0.2 * k).toFixed(3)); ctx.fillRect(x, y + 1, w, 1);   // lysrören i taket
        }
        for (const tk of d.tanks || []) {
          const [x, y, w, hh] = tk.r;
          ctx.fillStyle = rgba(tk.kind === 'hav' ? 0x6a8cff : 0x40c8ff, ((disp ? 0.2 : 0.08) * k).toFixed(3)); ctx.fillRect(x, y - 1, w, hh + 1);
        }
        if (d.heat) {
          const [x, y, w] = d.heat;
          ctx.fillStyle = rgba(0xff8a40, (0.5 * k).toFixed(3)); ctx.fillRect(x, y, w, 1);
          ctx.fillStyle = rgba(0xff9a50, (0.12 * k).toFixed(3)); ctx.fillRect(d.terra[0], d.terra[1], d.terra[2], d.terra[3]);
        }
      }
      // gatuplanet: allt ljus ritas i bufferten, gatuträdens kronor suddas ut, sedan ut på gatan
      const B = D._glowBuf(b, d), c = B.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, B.w, B.h);
      c.setTransform(1, 0, 0, 1, -B.x, -B.y); c.globalCompositeOperation = 'lighter';
      if (open) for (const [x, y, w, hh] of d.shopGlass || []) {                            // (fasadlådans skyltfönsterljus)
        c.fillStyle = rgba(0xffe0a0, (0.3 * k).toFixed(3)); c.fillRect(x, y, w, hh);
        c.fillStyle = rgba(0xffc070, (0.12 * k).toFixed(3)); c.fillRect(x - 3, y + hh, w + 6, 10);
      }
      // skyltfönstren: varma spotlights på djuren när det är öppet och skyltbelysning
      // på timer till kl 22, nattlampa sedan
      for (const g of [d.glassL, d.glassR]) {
        if (!g) continue;
        const [x, y, w, hh] = g;
        if (disp) {
          if (!open) { c.fillStyle = rgba(0xffd088, (0.13 * k).toFixed(3)); c.fillRect(x, y, w, hh); }
          c.fillStyle = rgba(0xfff2c8, (0.22 * k).toFixed(3)); c.fillRect(x, y, w, 1);                  // lysrören i fönsteröverstycket
          c.fillStyle = rgba(0xffe8b0, (0.1 * k).toFixed(3)); c.fillRect(x, y + 1, w, 3);
          c.fillStyle = rgba(0xffc070, (0.08 * k).toFixed(3)); c.fillRect(x - 3, y + hh + 9, w + 6, 12);  // ljuset på trottoaren
          c.fillStyle = rgba(0xffc070, (0.05 * k).toFixed(3)); c.fillRect(x - 6, y + hh + 21, w + 12, 8);
        } else { c.fillStyle = rgba(0x8aa8ff, (0.05 * k).toFixed(3)); c.fillRect(x, y, w, hh); }
      }
      if (disp && d.pen) { c.fillStyle = rgba(0xffe8b0, (0.12 * k).toFixed(3)); c.fillRect(d.pen.x0 - 1, d.pen.foot - 8, d.pen.x1 - d.pen.x0 + 2, 9); }
      if (open && d.doorCard) { c.fillStyle = rgba(0xffd890, (0.2 * k).toFixed(3)); c.fillRect(d.doorCard[0] - 11, d.doorCard[1], 22, 15); }
      if (d.tank) {                                                                       // akvariet lyser alltid
        const [x, y, w, hh] = d.tank;
        c.fillStyle = rgba(0x40c0ff, (0.1 * k).toFixed(3)); c.fillRect(x + 1, y + 1, w - 2, hh - 4);
      }
      if ((st.env?.weather?.season || 'sommar') !== 'vinter') {                           // (vinterns kala krona skymmer inget)
        const trees = D._trees(b, st.env);
        if (trees.length) { c.globalCompositeOperation = 'destination-out'; const M = D._crown(); for (const [tx, ty] of trees) c.drawImage(M, tx - 23, ty - 73); }
      }
      c.globalCompositeOperation = 'source-over';
      ctx.drawImage(B.cv, B.x, B.y);
    },
  },
  bibliotek: { // (reserv – biblioteket blev djuraffären, men kartan kan peka hit igen)
    wall: 0xd8d0c0, wallKind: 'plaster', roof: 'flat', roofCol: 0x5a9a88, ground: 'house', winW: 12, winSp: 20, winH: 16, floorH: 26, frame: 0xf0ece0, signBg: 0x3a2a1a, signFg: 0xf0d890, doorCol: 0x5a3a20,
    extra(P, K) { for (let x = K.fx0 + 3; x < K.fx1 - 3; x += 20) for (let y = K.ftop + 4; y < K.baseY - 5; y++) { P.px(x, y, mix(K.wall, WHITE, 0.25)); P.px(x + 2, y, mul(K.wall, 0.86)); } },
  },
  // ================= BIO PIXEL =================
  // En riktig biograf (Carls granskning: "liknar ett höghus"): sluten art
  // déco-salongsvägg utan lägenhetsfönster (chevronfris, kannelerade lisener,
  // räfflade band, solfjädersrelief, trappstegskrön), den lodräta BIO-neonen,
  // en STOR VIT LJUSSKYLT (marquee) med växlande filmtitlar i läsbar pixeltext
  // och jagande glödlampor, inramade affischer i glasmontrar (action +
  // romantisk komedi), biljettlucka med kassörska, popcornskylt och -maskin,
  // papperskorg med popcornpåse vid dörren. Ritas av bioFasad/bioLive/bioGlow.
  bio: {
    wall: 0x8a2a3a, wallKind: 'plaster', roof: 'flat', roofCol: 0x6e6a66, ground: 'plain', groundH: 36, floorH: 200, noSign: true, frame: 0x2a1a1a, doorCol: 0x3a2028,
    extra(P, K) { bioFasad(P, K); },
    live(ctx, b, st, m) { bioLive(ctx, b, st, m); },
    glow(ctx, b, st, k, m) { bioGlow(ctx, b, st, k, m); },
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

// =====================================================================
// BIO PIXEL – programmet, affischerna och fasadens delar
// Bilden är 192 × 190 (canvas-x = världs-x − 632, canvas-y = världs-y − 454).
// =====================================================================
// Programmet på ljusskylten: varje par är en actionfilm och en romantisk
// komedi. Paren växlar var 9:e sekund och bokstäverna "hängs upp" en i taget.
const FILMER = {
  hamnaren: { titel: 'PIXELHÄMNAREN 3', tid: '21:30', typ: 'action' },
  turbo: { titel: 'TURBOPOLIS', tid: '19:00', typ: 'action' },
  nattbuss: { titel: 'SISTA NATTBUSSEN', tid: '22:45', typ: 'action' },
  karlek: { titel: 'KÄRLEK PÅ PIXELGATAN', tid: '18:30', typ: 'romkom' },
  sommar: { titel: 'SOMMAR I STAN', tid: '20:00', typ: 'romkom' },
  amore: { titel: 'AMORE PÅ SÖDER', tid: '20:15', typ: 'romkom' },
};
const BIOPAR = [['hamnaren', 'karlek'], ['turbo', 'sommar'], ['nattbuss', 'amore']];
const BIO_SLOT = 9, BIO_BOKSTAV = 0.035;
// efter kvällens sista föreställning (och fram till morgonen) tackar tavlan för ikväll
const BIO_SENT = [{ titel: 'TACK FÖR IKVÄLL!', tid: '' }, { titel: 'IMORGON FRÅN', tid: '18:30' }];
const bioTid = (f) => { const [hh, mm] = f.tid.split(':').map(Number); return hh + mm / 60; };
// paren som fortfarande är aktuella: dagtid hela programmet, på kvällen bara par där
// någon film inte har börjat (eller började för mindre än en kvart sedan)
function bioProgram(h) {
  if (h >= 23 || h < 5) return [BIO_SENT];
  if (h < 12) return BIOPAR.map((p) => p.map((id) => FILMER[id]));
  const kvar = BIOPAR.map((p) => p.map((id) => FILMER[id])).filter((p) => Math.max(...p.map(bioTid)) > h - 0.25);
  return kvar.length ? kvar : [BIO_SENT];
}
// öppettiderna (map.js: open [12, 24]); tavlan, neonen och affischerna lyser tills
// sista filmen gått ut (01), filmen flimrar i salongsgluggarna 18.30–00.45
const bioOppen = (b, h) => !b.open || (h >= b.open[0] && h < b.open[1]);
const bioLyser = (h) => h >= 12 || h < 1;
const bioFilm = (h) => h >= 18.5 || h < 0.75;
const BIOC = { RED: 0x8a2a3a, DARKR: 0x5a1c28, CREAM: 0xe8d8b8, GOLD: 0xc8a44a, GOLDL: 0xeed690, GOLDD: 0x8a6a2a, PANEL: 0x3c1420 };

// Affischen i en glasmonter (26 × 34, ram i guld, lampa ovanför). kind:
// 'action' = TURBOPOLIS (explosion, mörka färger), 'romkom' = AMORE (solnedgång, par, hjärta)
function bioMontre(P, K, x, y, kind) {
  const { GOLD, GOLDL, GOLDD } = BIOC, w = 26, h = 34, px = x + 2, py = y + 2, pw = 22, ph = 30;
  // affischlampan på en arm ovanför montern
  P.hl(x + 12, y - 4, 2, 0x2a2024); P.rect(x + 9, y - 3, 8, 2, 0x2a2024); P.hl(x + 9, y - 3, 8, 0x4a3a3a);
  P.hl(x + 10, y - 1, 6, K.night ? 0xfff0b0 : 0xb8a878);
  // skugga på väggen, ramen i tre guldtoner
  P.rect(x + 2, y + h, w - 1, 2, 0x000000, 0.28); P.rect(x + w, y + 2, 1, h, 0x000000, 0.22);
  area(P, x, y, w, h, (X, Y, i, j) => (i === 0 || j === 0 ? GOLDL : i === w - 1 || j === h - 1 ? GOLDD : (i === 1 || j === 1 || i === w - 2 || j === h - 2) ? GOLD : null));
  const A = (X, Y, c) => P.px(px + X, py + Y, c);
  let titel;
  if (kind === 'action') {
    // nattstad i blått och svart, en explosion bakom hjälten, gnistor och hustak
    area(P, px, py, pw, ph, (X, Y, i, j) => qmix(0x1a1e38, 0x0a0a14, j / ph, X, Y, 4));
    const ex = 11, ey = 19;
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const d = Math.hypot((i + 0.5 - ex) * 1.05, (j + 0.5 - ey)) + (hash(i, j, 707) - 0.5) * 2.2;
      if (d < 2.4) A(i, j, 0xfff6d0); else if (d < 4.4) A(i, j, 0xffd040); else if (d < 6.6) A(i, j, 0xf07a20); else if (d < 8.4) A(i, j, 0xb8301a); else if (d < 9.4 && hash(i, j, 708) > 0.5) A(i, j, 0x5a1a14);
    }
    for (let k = 0; k < 9; k++) { const a = hash(k, 1, 709) * 6.28, r = 9 + hash(k, 2, 709) * 3; A(Math.round(ex + Math.cos(a) * r), Math.round(ey + Math.sin(a) * r * 0.8), k & 1 ? 0xffd040 : 0xf07a20); }
    // hustak i siluett med tända fönster
    for (let i = 0; i < pw; i++) { const th = 25 + ((hash(i >> 2, 3, 710) * 3) | 0); for (let j = th; j < ph; j++) A(i, j, 0x08080e); if ((i & 3) === 1 && hash(i, 4, 710) > 0.4) A(i, th + 2, 0xffd060); }
    // hjälten i läderjacka – mörk siluett med orange kantljus från smällen
    const H = 0x0c0a10, R = 0xe86a20;
    A(10, 16, H); A(11, 16, H); A(12, 16, H); A(10, 17, H); A(11, 17, H); A(12, 17, H); A(11, 15, H);
    for (let j = 18; j <= 23; j++) for (let i = 9; i <= 13; i++) A(i, j, H);
    A(8, 19, H); A(8, 20, H); A(14, 19, H); A(15, 20, H); A(15, 21, H);             // armarna
    for (let j = 24; j <= 28; j++) { A(9 + (j > 26 ? -1 : 0), j, H); A(10, j, H); A(12, j, H); A(13 + (j > 26 ? 1 : 0), j, H); }
    A(10, 15, R); A(9, 18, R); A(8, 21, R); A(9, 24, R); A(13, 16, R); A(14, 18, R); A(14, 24, R);
    // titeln TURBO / POLIS i gult som går mot rött, med svart kontur
    titel = () => { for (const [s, ty] of [['TURBO', 2], ['POLIS', 8]]) {
      const tx = px + ((pw - textW(SMALL, s)) >> 1);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) text(P, SMALL, s, tx + ox, py + ty + oy, 0x000000);
      text(P, SMALL, s, tx, py + ty, 0xffe060);
      area(P, tx, py + ty + 3, textW(SMALL, s), 2, (X, Y) => (P.get(X, Y) === 0xffe060 ? 0xf08a28 : null));
    } };
  } else {
    // solnedgång i rosa och persika, ett stort hjärta och paret som nästan kysser varandra
    area(P, px, py, pw, ph, (X, Y, i, j) => (j < 12 ? qmix(0xf8a0b8, 0xf8c4a0, j / 12, X, Y, 3) : qmix(0xf8c4a0, 0xe89060, (j - 12) / 18, X, Y, 3)));
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {                      // solen bakom paret
      const d = Math.hypot(i + 0.5 - 11, (j + 0.5 - 24) * 1.1);
      if (d < 8) A(i, j, d < 6.5 ? 0xfff0b0 : 0xffe0a0);
    }
    // hjärtkurvan (x² + y² − 1)³ − x²y³ ≤ 0 med y uppåt
    const heart = (hx, hy, s, c, hi, lo) => {
      for (let j = 0; j <= Math.ceil(2.3 * s); j++) for (let i = -Math.ceil(1.25 * s); i <= Math.ceil(1.25 * s); i++) {
        const u = i / s, v = 1.2 - (j + 0.5) / s, f = (u * u + v * v - 1) ** 3 - u * u * v * v * v;
        if (f > 0) continue;
        A(hx + i, hy + j, f > -0.03 ? lo : (j < s * 0.7 && i < 0) ? hi : c);
      }
    };
    heart(11, 8, 4, 0xe0304a, 0xff7a94, 0xa01830);
    A(8, 10, 0xffd0dc); A(9, 9, 0xffd0dc);
    for (const [hx, hy] of [[1, 12], [18, 13], [18, 8]]) { A(hx, hy, 0xff6a8a); A(hx + 2, hy, 0xff6a8a); A(hx, hy + 1, 0xe0304a); A(hx + 1, hy + 1, 0xff6a8a); A(hx + 2, hy + 1, 0xe0304a); A(hx + 1, hy + 2, 0xe0304a); }
    // hon (rött hår, rosa klänning) och han (brunt hår, blå skjorta) med näsorna nästan ihop
    const SK = 0xf2cca6, SK2 = 0xd8a47c;
    for (let j = 17; j <= 21; j++) for (let i = 12; i <= 15; i++) A(i, j, SK);         // hennes ansikte
    for (let j = 16; j <= 24; j++) { A(15, j, 0xa8401a); A(16, j, 0x8a3014); } A(13, 16, 0xa8401a); A(14, 16, 0xa8401a); A(12, 17, 0xa8401a);
    A(13, 18, 0x2a1a14); A(12, 20, 0xc84a5a); A(11, 19, SK); A(14, 19, 0xf09a9a);
    for (let j = 22; j < ph; j++) for (let i = 12 + (j > 26 ? -1 : 0); i <= 16; i++) A(i, j, j === 22 ? 0xf8a0b8 : 0xe85a7a);
    for (let j = 18; j <= 22; j++) for (let i = 6; i <= 9; i++) A(i, j, SK2);          // hans ansikte
    for (let i = 5; i <= 9; i++) A(i, 17, 0x4a2a1a); A(5, 18, 0x4a2a1a); A(5, 19, 0x4a2a1a); A(6, 17, 0x6a3a1a);
    A(8, 19, 0x2a1a14); A(10, 20, SK2); A(9, 21, 0x8a4a3a);
    for (let j = 23; j < ph; j++) for (let i = 4; i <= 9 + (j > 26 ? 1 : 0); i++) A(i, j, i === 4 ? 0x2a4a8a : 0x3a6ab0);
    A(11, 21, WHITE); A(10, 22, 0xfff0b0);                                               // gnistan mellan dem
    // titeln AMORE i vitt med djuprosa skugga
    titel = () => { const s = 'AMORE', tx = px + ((pw - textW(SMALL, s)) >> 1); text(P, SMALL, s, tx + 1, py + 3, 0xa01830); text(P, SMALL, s, tx, py + 2, 0xfffaf4); };
  }
  // glaset: diagonala reflexer och en mörk smyg innanför ramen
  P.hl(px, py, pw, 0x000000, 0.3); P.vl(px, py + 1, ph - 1, 0x000000, 0.18);
  for (let d = 0; d < 12; d++) { P.px(px + 4 + d, py + 20 - d, WHITE, 0.16); P.px(px + 5 + d, py + 20 - d, WHITE, 0.1); P.px(px + 13 + d, py + 27 - d, WHITE, 0.08); }
  titel();                                                                               // titeln sist, skarp ovanpå glaset
  (K.out.montrar ||= []).push([px + K.box.x, py + K.box.y, pw, ph]);
  (K.out.affischljus ||= []).push([x + 10 + K.box.x, y - 1 + K.box.y]);
}

function bioFasad(P, K) {
  const { fx0, fx1, ftop, baseY, dx, dw, dy, night, gtop, rtop, box } = K;
  const { RED, DARKR, CREAM, GOLD, GOLDL, GOLDD, PANEL } = BIOC;
  const Wx = (x) => x + box.x, Wy = (y) => y + box.y;
  // ---- taket: maskinrummet med projektorgluggarna och ventilation ----
  P.rect(124, rtop + 3, 36, 12, 0x6a5a5a); P.hl(124, rtop + 3, 36, 0x9a8a8a); P.vl(124, rtop + 4, 11, 0x8a7a7a);
  P.vl(159, rtop + 3, 12, 0x3a2a2a); P.hl(124, rtop + 15, 37, 0x000000, 0.3);
  P.rect(128, rtop + 7, 5, 8, 0x3a2a2a); P.px(131, rtop + 11, GOLD);
  for (let i = 0; i < 3; i++) { P.rect(138 + i * 7, rtop + 7, 4, 3, 0x1a1418); P.hl(138 + i * 7, rtop + 10, 4, 0x8a7a7a); }
  vent(P, 58, rtop + 6); vent(P, 108, rtop + 5); vent(P, 168, rtop + 8);
  // ---- trappstegskrönet (art déco) med spira mitt på takfoten ----
  for (const [x0s, y0s, ws] of [[70, 61, 52], [77, 58, 38], [84, 55, 24], [90, 52, 12]]) {
    area(P, x0s, y0s, ws, ftop - y0s, (X, Y) => jit(RED, X, Y, K.seed + 6, 0.05));
    P.hl(x0s, y0s, ws, CREAM); P.hl(x0s, y0s + 1, ws, GOLD, 0.55);
    P.vl(x0s, y0s + 1, ftop - y0s - 1, mix(RED, WHITE, 0.2)); P.vl(x0s + ws - 1, y0s + 1, ftop - y0s - 1, mul(RED, 0.7));
  }
  P.rect(94, 48, 4, 4, GOLD); P.hl(94, 48, 4, GOLDL); P.vl(97, 48, 4, GOLDD); P.px(95, 47, GOLDL); P.px(96, 47, GOLD); P.px(95, 46, GOLDL);
  // en filmrulle i guld mitt på krönet (fem hål runt navet) och ränder på trappstegen
  P.ell(96, 60, 4.6, 4.6, GOLD, 1, 2); P.ell(96, 60, 3.6, 3.6, GOLDL, 1, 2);
  for (const [ox, oy] of [[0, -2], [2, 0], [1, 2], [-1, 2], [-2, 0]]) P.px(96 + ox, 60 + oy, 0x5a1c28);
  P.px(96, 60, GOLDD);
  for (const [x0s, ws] of [[72, 52], [79, 38]]) for (const gy of [63, 64]) { P.hl(x0s + 2, gy, 4, gy & 1 ? mul(RED, 0.72) : mix(RED, WHITE, 0.2)); P.hl(x0s + ws - 6, gy, 4, gy & 1 ? mul(RED, 0.72) : mix(RED, WHITE, 0.2)); }
  // ---- salongsväggen: chevronfris under taklisten ----
  P.hl(fx0 + 1, ftop + 4, K.b.w - 2, mul(RED, 0.78));
  for (let x = fx0 + 1; x < fx1 - 1; x++) {
    const ph = (x - fx0) % 10, j = ph < 5 ? ph : 9 - ph;
    P.px(x, ftop + 6 + j, CREAM); P.px(x, ftop + 7 + j, GOLD); P.px(x, ftop + 8 + j, GOLDD);
  }
  P.hl(fx0 + 1, ftop + 15, K.b.w - 2, mix(RED, WHITE, 0.16)); P.hl(fx0 + 1, ftop + 16, K.b.w - 2, mul(RED, 0.74));
  // kannelerade lisener i 3–4 toner med guldkapitäl och fot
  for (const rx of [12, 50, 136, 164]) {
    for (let y = 85; y < 100; y++) for (let i = 0; i < 6; i++) {
      const t = [0.3, 0.1, -0.06, 0.24, 0.02, -0.22][i];
      P.px(rx + i, y, jit(t >= 0 ? mix(RED, WHITE, t) : mul(RED, 1 + t), rx + i, y, K.seed + 5, 0.04));
    }
    P.rect(rx - 1, 82, 8, 3, GOLD); P.hl(rx - 1, 82, 8, GOLDL); P.hl(rx - 1, 84, 8, GOLDD);
    P.rect(rx - 1, 100, 8, 3, GOLD); P.hl(rx - 1, 100, 8, GOLDL); P.hl(rx - 1, 103, 8, 0x000000, 0.25);
  }
  // räfflade art déco-band i fälten mellan lisenerna (ljus kant över mörk fals)
  for (const [a, z] of [[18, 24], [46, 50], [56, 63], [70, 75], [118, 123], [130, 136], [142, 164]])
    for (const gy of [88, 92, 96]) { P.hl(a, gy, z - a, mix(RED, WHITE, 0.2)); P.hl(a, gy + 1, z - a, mul(RED, 0.68)); }
  // två smala salongsgluggar (i stället för 14 lägenhetsfönster) – filmen flimrar i dem på kvällen
  const slits = [];
  for (const sx of [64, 124]) {
    P.rect(sx - 1, 84, 7, 22, CREAM); P.hl(sx - 1, 84, 7, 0xfff4e0); P.vl(sx + 5, 85, 21, mul(CREAM, 0.72));
    area(P, sx, 85, 5, 19, (X, Y, i, j) => ((j % 5) === 4 || i === 2 ? 0x141020 : qmix(0x3a3450, 0x1a1628, j / 19, X, Y, 3)));
    P.rect(sx - 1, 104, 7, 2, GOLD); P.hl(sx - 1, 106, 7, 0x000000, 0.25);
    P.px(sx, 85, WHITE, 0.3); P.px(sx + 1, 86, WHITE, 0.2);
    slits.push([Wx(sx), Wy(85), 5, 19]);
  }
  K.out.slits = slits;
  // solfjädersreliefen ovanför ljusskylten
  const scx = 96, scy = 107, R = 21;
  for (let y = scy - R; y <= scy; y++) for (let x = scx - R; x <= scx + R; x++) {
    const d = Math.hypot(x + 0.5 - scx, y + 0.5 - scy) / R;
    if (d > 1) continue;
    let c = qmix(mix(RED, WHITE, 0.2), mix(RED, WHITE, 0.05), d, x, y, 3);
    if (d > 0.93) c = y === scy - R ? GOLDL : GOLD; else if (d > 0.86) c = mul(RED, 0.7);
    P.px(x, y, c);
  }
  for (let a = 0; a <= 10; a++) {
    const v = Math.PI * a / 10, ex = scx + Math.round(Math.cos(Math.PI - v) * (R - 4)), ey = scy - Math.round(Math.sin(v) * (R - 4));
    P.line(scx, scy - 3, ex, ey, a & 1 ? GOLD : CREAM, a & 1 ? 0.75 : 0.95);
    P.px(ex, ey, GOLDL);
  }
  P.ell(scx, scy, 7.5, 7.5, GOLD, 1, 2); P.ell(scx, scy, 4.5, 4.5, GOLDL, 1, 2);
  // ---- den lodräta BIO-neonskylten (behålls – nu med dubbelstora rör) ----
  // (60 hög: slutar på y 97 så att affischmontrarna kan sitta på y 102 – högt nog
  // för att den östra ska gå fri från trafikljuset vid Kyrkogatan)
  const bx0 = 24, by0 = 38, bw = 20, bh = 60;
  P.rect(bx0 + bw, by0 + 3, 2, bh - 3, 0x000000, 0.3);                                  // skugga på väggen
  for (let j = 0; j < 4; j++) P.hl(bx0 + 5 + j * 2, by0 - 1 - j, bw - 10 - j * 4, j ? GOLD : GOLDD);   // krönet
  P.px(bx0 + 9, by0 - 5, GOLDL); P.px(bx0 + 10, by0 - 5, GOLDL); P.px(bx0 + 9, by0 - 6, GOLDL);
  area(P, bx0, by0, bw, bh, (X, Y, i, j) => (i === 0 || j === 0 ? GOLDL : i === bw - 1 || j === bh - 1 ? GOLDD : (i === 1 || j === 1 || i === bw - 2 || j === bh - 2) ? 0x3a2430 : jit(0x16101c, X, Y, K.seed + 3, 0.05)));
  for (const yy of [by0 + 12, by0 + bh - 14]) { P.rect(bx0 - 4, yy, 4, 2, 0x2a2024); P.hl(bx0 - 4, yy, 4, 0x4a3a3a); P.px(bx0 - 4, yy + 2, 0x000000, 0.3); }
  const lit = night ? 0xffe070 : 0xe0bc5a, core = night ? 0xfffae0 : 0xf4dc98;
  const bok = [['B', 29, 43], ['I', 31, 61], ['O', 29, 79]];
  for (const [ch, x, y] of bok) { text(P, BIG, ch, x + 1, y + 1, 0x5a0e18, 1, 2); text(P, BIG, ch, x, y, lit, 1, 2); }
  for (let y = by0 + 3; y < by0 + bh - 3; y++) for (let x = bx0 + 3; x < bx0 + bw - 3; x++) {
    const up = P.get(x, y - 1);
    if (P.get(x, y) === lit && up !== lit && up !== core) P.px(x, y, core);                // rörens ljusa överkant
  }
  const bladeBulbs = [];
  for (let y = by0 + 3; y < by0 + bh - 2; y += 4) { bladeBulbs.push([Wx(bx0), Wy(y)]); bladeBulbs.push([Wx(bx0 + bw - 1), Wy(y)]); P.px(bx0, y, 0x9a8048); P.px(bx0 + bw - 1, y, 0x9a8048); }
  K.out.vneon = [Wx(bx0), Wy(by0), bw, bh];
  K.out.bok = bok.map(([ch, x, y]) => [Wx(x), Wy(y), ch === 'I' ? 6 : 10, 14]);
  K.out.bladeBulbs = bladeBulbs;
  // ---- den STORA VITA LJUSSKYLTEN (marquee) ----
  const mx0 = 40, mx1 = 152, my0 = 108, my1 = 144, mw = mx1 - mx0, mh = my1 - my0;
  // stag upp mot väggen
  for (const [ax, dir] of [[mx0 + 4, 1], [mx1 - 5, -1]]) {
    P.line(ax, my0, ax + dir * 8, my0 - 10, 0x2a2024); P.line(ax + dir, my0, ax + dir * 9, my0 - 10, 0x4a3a3a);
    P.rect(ax + dir * 9 - 1, my0 - 12, 3, 3, GOLD); P.px(ax + dir * 9 - 1, my0 - 12, GOLDL);
  }
  P.darken(mx0 - 2, my1, mw + 4, 3, 0.6); P.darken(mx0, my1 + 3, mw, 2, 0.8);          // skuggan på väggen
  P.rect(mx0 - 2, my0 + 2, 2, mh - 2, mul(DARKR, 0.9)); P.vl(mx0 - 2, my0 + 2, mh - 2, mix(DARKR, WHITE, 0.15));
  P.rect(mx1, my0 + 2, 2, mh - 2, mul(DARKR, 0.5));
  area(P, mx0, my0, mw, mh, (X, Y, i, j) => {
    let c = jit(DARKR, X, Y, K.seed + 7, 0.05);
    if (j === 0) c = mix(c, WHITE, 0.3); else if (j === mh - 1) c = mul(c, 0.55); else if (i === 0) c = mix(c, WHITE, 0.12); else if (i === mw - 1) c = mul(c, 0.7);
    return c;
  });
  P.box(mx0 + 2, my0 + 2, mw - 4, mh - 4, GOLD); P.hl(mx0 + 2, my0 + 2, mw - 4, GOLDL); P.hl(mx0 + 3, my1 - 3, mw - 6, GOLDD);
  P.rect(mx0 + 4, my0 + 4, mw - 8, 10, 0x2a0e18); P.hl(mx0 + 4, my0 + 13, mw - 8, 0x14060a);
  const hs = 'BIO PIXEL', hx = 96 - (textW(BIG, hs) >> 1);
  text(P, BIG, hs, hx + 1, my0 + 6, 0x0a0406); text(P, BIG, hs, hx, my0 + 5, night ? 0xfff0a0 : GOLDL);
  for (let x = hx; x < hx + textW(BIG, hs); x++) if (P.get(x, my0 + 5) === (night ? 0xfff0a0 : GOLDL)) P.px(x, my0 + 5, WHITE, 0.5);
  for (const sx of [mx0 + 13, mx1 - 14]) { P.px(sx, my0 + 6, GOLD); P.hl(sx - 1, my0 + 7, 3, GOLDL); P.px(sx, my0 + 8, GOLD); P.px(sx - 2, my0 + 7, GOLDD); P.px(sx + 2, my0 + 7, GOLDD); P.px(sx, my0 + 5, GOLDD); P.px(sx, my0 + 9, GOLDD); }
  // den vita bokstavstavlan med skenor som bokstäverna hänger på
  area(P, mx0 + 4, my0 + 15, mw - 8, 17, (X, Y, i, j) => {
    let c = jit(0xf8f6f0, X, Y, K.seed + 8, 0.025);
    if (j === 0) c = 0xb8b2a8; else if (j === 1) c = 0xe6e2da; else if (j === 8) c = 0xdcd8d0; else if (j === 16) c = 0xcac4ba;
    if (i === 0) c = mul(c, 0.9); else if (i === mw - 9) c = mul(c, 0.93);
    return c;
  });
  P.rect(mx0 + 4, my0 + 32, mw - 8, 1, 0x2a0e18);
  // glödlamporna runt ramen (släckta i bilden, live() tänder dem i tur och ordning)
  const bulbs = [];
  for (let x = mx0 + 3; x <= mx1 - 4; x += 4) bulbs.push([x, my0 + 1]);
  for (let y = my0 + 5; y <= my1 - 5; y += 4) bulbs.push([mx1 - 2, y]);
  for (let x = mx0 + 3 + Math.floor((mx1 - 4 - mx0 - 3) / 4) * 4; x >= mx0 + 3; x -= 4) bulbs.push([x, my1 - 2]);
  for (let y = my0 + 5 + Math.floor((my1 - 5 - my0 - 5) / 4) * 4; y >= my0 + 5; y -= 4) bulbs.push([mx0 + 1, y]);
  for (const [x, y] of bulbs) P.px(x, y, 0x9a8048);
  K.out.bulbs = bulbs.map(([x, y]) => [Wx(x), Wy(y)]);
  K.out.marquee = [Wx(mx0), Wy(my0), mw, mh];
  K.out.mfalt = { x0: Wx(mx0 + 6), x1: Wx(mx1 - 6), y1: Wy(my0 + 17), y2: Wy(my0 + 26) };
  // ---- affischmontrarna: actionfilm väster, romantisk komedi öster ----
  bioMontre(P, K, 10, 102, 'action');
  bioMontre(P, K, 154, 102, 'romkom');
  // ---- bottenvåningen: mörkröd boaseringspanel med guldpilastrar ----
  area(P, fx0, gtop, K.b.w, baseY - 5 - gtop, (X, Y, i, j) => {
    if (Y >= dy - 4 && X >= dx - 3 && X < dx + dw + 3) return null;                    // dörren är redan målad
    let c = jit(PANEL, X, Y, K.seed + 9, 0.05);
    if ((X % 9) === 4) c = mix(c, WHITE, 0.05); else if ((X % 9) === 5) c = mul(c, 0.9);
    if (j === 0) c = mix(c, CREAM, 0.5); else if (j === 1) c = mul(c, 0.7);
    if (Y === gtop + 16) c = mix(c, GOLD, 0.4); else if (Y === gtop + 17) c = mul(c, 0.8);
    if (X === fx0) c = mix(c, WHITE, 0.1); else if (X >= fx1 - 2) c = mul(c, 0.8);
    return c;
  });
  for (const px2 of [72, 117]) {                                                        // guldpilastrar vid entrén
    for (let y = gtop + 7; y < baseY - 3; y++) for (let i = 0; i < 4; i++)
      P.px(px2 + i, y, jit([GOLDL, GOLD, mul(GOLD, 0.72), mul(GOLD, 0.5)][i], px2 + i, y, K.seed + 10, 0.05));
    P.rect(px2 - 1, gtop + 5, 6, 2, GOLDL); P.rect(px2 - 1, baseY - 3, 6, 3, mul(GOLD, 0.8));
  }
  area(P, 72, gtop, 49, 9, (X, Y, i, j) => (j === 0 ? mix(DARKR, WHITE, 0.25) : j === 1 ? GOLD : j === 8 ? mul(DARKR, 0.6) : i === 0 || i === 48 ? GOLD : jit(DARKR, X, Y, K.seed + 11, 0.05))); // överstycket med ENTRÉ
  const es = 'ENTRÉ'; text(P, SMALL, es, 96 - (textW(SMALL, es) >> 1), gtop + 3, night ? 0xffe890 : GOLDL);
  // dörrarna: guldram, mittpost och skjuthandtag i mässing
  P.box(dx - 1, dy - 1, dw + 2, K.dh + 1, GOLD); P.hl(dx - 1, dy - 1, dw + 2, GOLDL);
  P.vl(dx + (dw >> 1), dy, K.dh, GOLD); P.vl(dx + (dw >> 1) - 1, dy, K.dh, GOLDD);
  for (const hx2 of [dx + 4, dx + (dw >> 1) + 4]) { P.hl(hx2, dy + 13, 10, GOLDL); P.hl(hx2, dy + 14, 10, GOLDD); }
  for (const [sx, c] of [[dx + 3, 0xe86a8a], [dx + dw - 8, 0x2a3a6a]]) { P.rect(sx, dy + 4, 5, 6, c); P.box(sx, dy + 4, 5, 6, 0xf4f1ea, 0.7); } // små affischdekaler på glaset
  // röda mattan ut på trottoaren
  P.rect(dx - 2, baseY, dw + 4, 3, 0xa82434); P.hl(dx - 2, baseY, dw + 4, 0xd84454);
  P.vl(dx - 2, baseY, 3, GOLD); P.vl(dx + dw + 1, baseY, 3, GOLD); P.hl(dx - 2, baseY + 3, dw + 4, mul(0xa82434, 0.6));
  // ---- BILJETTLUCKAN väster om entrén: mässingsskylt KASSA, välvd lucka, kassörskan ----
  const kx = 18, ky = 159, kw = 28, kh = 16, kc = kx + (kw >> 1);
  P.rect(kx + 3, gtop, 22, 7, GOLD); P.hl(kx + 3, gtop, 22, GOLDL); P.hl(kx + 3, gtop + 6, 22, GOLDD); P.vl(kx + 24, gtop, 7, GOLDD);
  text(P, SMALL, 'KASSA', kx + 3 + ((22 - textW(SMALL, 'KASSA')) >> 1), gtop + 1, 0x3a1a10);
  area(P, kx, ky - 2, kw, kh + 2, (X, Y, i, j) => {
    if (j === 0 && (i < 3 || i > kw - 4)) return null;                                  // välvd överdel
    if (j === 1 && (i < 1 || i > kw - 2)) return null;
    return i === 0 || j <= 1 ? GOLDL : i === kw - 1 ? GOLDD : GOLD;
  });
  const gx0 = kx + 2, gy0 = ky, gw = kw - 4, gh = kh - 3;
  area(P, gx0, gy0, gw, gh, (X, Y, i, j) => (night ? qmix(0xffe4a8, 0xe0a060, j / gh, X, Y, 3) : qmix(0xe8cc98, 0xb08050, j / gh, X, Y, 3)));
  P.rect(gx0 + 1, gy0 + 2, 3, 4, 0x3a6ab0); P.rect(gx0 + gw - 4, gy0 + 2, 3, 4, 0xe85a7a);    // små affischer på bakväggen
  // (kassörskan ritas i live() när bion har öppet – annars är rullgardinen nere, se bioKassorska/bioGardin)
  P.ell(gx0 + 4, gy0 + 9, 2, 2, GOLD, 1, 1); P.px(gx0 + 4, gy0 + 9, GOLDD);          // talgallret i glaset
  P.rect(kx - 1, ky + kh - 3, kw + 2, 2, 0xe8e0d0); P.hl(kx - 1, ky + kh - 3, kw + 2, 0xfaf6ee); P.hl(kx - 1, ky + kh - 1, kw + 2, 0x8a7a6a); // marmordisk
  P.rect(kc - 4, ky + kh - 4, 9, 1, 0x1a1014);                                          // pengaluckan
  for (let d = 0; d < 9; d++) P.px(gx0 + 8 + d, gy0 + 10 - d, WHITE, 0.14);
  K.out.kassa = [Wx(gx0), Wy(gy0), gw, gh];
  K.out.kassorska = [Wx(kc), Wy(gy0)];
  // ---- POPCORN: blinkande skylt med en jättestrut på taket (under gatlyktans arm,
  // väster om trafikljuset – skylten slutar på x 802, trafikljuslådan börjar på 803)
  // och en popcornmaskin som skymtar i ett litet fönster ----
  const pX = 140, pY = 157, pW = 31, pH = 10;
  P.rect(pX + 1, pY + pH, pW - 1, 2, 0x000000, 0.3);
  P.rect(pX, pY, pW, pH, 0xc82a20); P.box(pX, pY, pW, pH, 0xfff0c0); P.hl(pX + 1, pY + 1, pW - 2, 0xe84a3a); P.hl(pX + 1, pY + pH - 2, pW - 2, 0x9a1a14);
  for (let x = pX + 2; x < pX + pW - 1; x += 3) { P.px(x, pY, 0xffe070); P.px(x, pY + pH - 1, 0xffe070); }
  text(P, SMALL, 'POPCORN', pX + 2, pY + 3, 0x5a0e0a); text(P, SMALL, 'POPCORN', pX + 2, pY + 2, 0xffe070);
  K.out.pop = [Wx(pX), Wy(pY), pW, pH];
  const sX = pX + 21, sY = pY - 11;                                                      // strutens nederkant vilar på skylten
  for (let j = 0; j < 8; j++) { const w2 = 7 - (j >> 2); for (let i = 0; i < w2; i++) P.px(sX + i + (j >> 2), sY + 3 + j, ((i + (j >> 2)) & 1) ? 0xf4efe6 : 0xd83a2a); }
  P.vl(sX, sY + 3, 4, 0xa82a20); P.vl(sX + 6, sY + 3, 4, 0x9a1a14);
  for (let i = -1; i <= 7; i++) { const top = sY + 1 - ((hash(i, 5, 712) * 3) | 0) + (i < 0 || i > 6 ? 2 : 0); for (let y = top; y <= sY + 3; y++) P.px(sX + i, y, hash(i, y, 713) > 0.4 ? 0xfff6dc : 0xf0d078); }
  P.px(sX + 2, sY - 1, 0xfffaf0); P.px(sX + 5, sY, 0xfff0c0);
  const wX = 148, wY = 169, wW = 20, wH = 9;
  P.rect(wX - 1, wY - 1, wW + 2, wH + 2, GOLD); P.hl(wX - 1, wY - 1, wW + 2, GOLDL); P.hl(wX - 1, wY + wH, wW + 2, GOLDD);
  area(P, wX, wY, wW, wH, (X, Y, i, j) => (night ? qmix(0xffe8b0, 0xe8b070, j / wH, X, Y, 3) : qmix(0xf0dcb0, 0xc8a070, j / wH, X, Y, 3)));
  const mX = wX + 4, mY = wY;                                                            // maskinen: glasskåp på röd vagn
  P.rect(mX, mY, 12, 2, 0xc82a20); P.hl(mX, mY, 12, 0xe84a3a);
  P.box(mX, mY + 2, 12, 6, 0x9aa0aa); area(P, mX + 1, mY + 3, 10, 4, (X, Y, i, j) => (j >= 2 ? (hash(X, Y, 711) > 0.45 ? 0xfff4d0 : 0xf0d070) : 0xfff8e8));
  P.rect(mX + 4, mY + 3, 4, 1, 0xb8bcc4);
  P.hl(mX, mY + 8, 12, 0xc82a20);
  for (let d = 0; d < 7; d++) P.px(wX + 2 + d, wY + 7 - d, WHITE, 0.15);
  K.out.popwin = [Wx(mX + 1), Wy(mY + 3), 10, 4];
  K.out.popglas = [Wx(wX), Wy(wY), wW, wH];
  // ---- papperskorgen vid dörren med en tom popcornpåse, spill på trottoaren ----
  const bnx = 121, bny = 176;
  P.rect(bnx + 1, bny - 3, 4, 3, 0xf4efe6); P.vl(bnx + 1, bny - 3, 3, 0xd83a2a); P.vl(bnx + 3, bny - 3, 3, 0xd83a2a);
  P.px(bnx + 2, bny - 4, 0xfff2d0); P.px(bnx + 3, bny - 4, 0xffe090); P.px(bnx + 4, bny - 5, 0xfff2d0);
  area(P, bnx, bny, 7, 10, (X, Y, i, j) => {
    let c = [0x8a3440, 0x7a2432, 0x6a1e2a, 0x5a1a24, 0x4a141e, 0x3a1018, 0x2a0a12][i];
    if (j === 0) c = GOLDL; else if (j === 1) c = mix(GOLD, 0x2a0a12, i / 8); else if (j === 5) c = mix(c, GOLD, 0.55); else if (j === 9) c = mul(c, 0.7);
    return c;
  });
  P.hl(bnx + 1, bny + 10, 7, 0x000000, 0.3); P.px(bnx + 7, bny + 9, 0x000000, 0.2);
  for (const [kx2, ky2] of [[116, 187], [129, 188], [131, 187], [134, 189], [138, 188], [69, 188], [66, 187]]) P.px(kx2, ky2, ky2 & 1 ? 0xfff2d0 : 0xffe090);
  // östra kanten mot Kyrkogatan: stuprör och två ventilgaller bryter gaveln
  downpipe(P, fx1 - 3, ftop + 4, baseY - 1, 0x8a7078);
  for (const gy of [ftop + 20, ftop + 29]) {
    P.rect(fx1 - 13, gy, 6, 5, 0x5a1c28); P.box(fx1 - 13, gy, 6, 5, 0x6a2a38);
    for (let j = 1; j < 5; j += 2) P.hl(fx1 - 12, gy + j, 4, 0xa8556a, 0.8);
  }
  // ---- vinter: snö på allt som har en ovansida (krön, skyltar, montrar, lister) ----
  if (K.opts && K.opts.snow) {
    const sno = (x0, x1, y) => {
      for (let x = x0; x <= x1; x++) {
        P.px(x, y, hash(x, y, 951) > 0.78 ? WHITE : 0xe8eef6);
        if (x > x0 && x < x1 && hash(x, y, 952) > 0.5) P.px(x, y - 1, hash(x, y, 953) > 0.5 ? 0xf4f8ff : 0xdce4ee);
      }
      P.px(x0, y + 1, 0xdce4ee, 0.6); if (hash(x1, y, 954) > 0.4) P.px(x1, y + 1, 0xdce4ee, 0.7);   // droppar över kanten
    };
    sno(124, 159, rtop + 2);                                                             // maskinrummet
    const steg = [[70, 61, 52], [77, 58, 38], [84, 55, 24], [90, 52, 12]];
    steg.forEach(([x0s, y0s, ws], i) => {                                                // trappstegen: bara de fria avsatserna
      const n = steg[i + 1];
      if (!n) { sno(x0s, 93, y0s - 1); sno(98, x0s + ws - 1, y0s - 1); return; }
      sno(x0s, n[0] - 1, y0s - 1); sno(n[0] + n[2], x0s + ws - 1, y0s - 1);
    });
    sno(94, 97, 47);                                                                     // spiran
    for (let j = 0; j < 4; j++) {                                                        // BIO-skyltens krön
      const a = bx0 + 5 + j * 2, w2 = bw - 10 - j * 4;
      if (w2 <= 0) { sno(bx0 + 9, bx0 + 10, by0 - 1 - j); break; }
      sno(j ? a - 2 : bx0, a - 1, by0 - 1 - j); sno(a + w2, j ? a + w2 + 1 : bx0 + bw - 1, by0 - 1 - j);
    }
    for (const rx of [12, 50, 136, 164]) sno(rx - 1, rx + 6, 81);                        // lisenernas kapitäl
    for (const sx of [64, 124]) sno(sx - 1, sx + 5, 83);                                 // salongsgluggarna
    for (let x = scx - 15; x <= scx + 15; x++) sno(x, x, scy - Math.round(Math.sqrt(R * R - (x + 0.5 - scx) ** 2)) - 1);  // solfjäderns båge
    sno(mx0 - 2, mx1 + 1, my0 - 1);                                                      // ljusskyltens ovankant
    for (const [ax, dir] of [[mx0 + 4, 1], [mx1 - 5, -1]]) sno(ax + dir * 9 - 1, ax + dir * 9 + 1, my0 - 13);
    for (const [x, y] of [[10, 102], [154, 102]]) { sno(x, x + 8, y - 1); sno(x + 17, x + 25, y - 1); sno(x + 9, x + 16, y - 4); }  // montrarna + lamporna
    sno(72, 120, gtop - 1);                                                              // ENTRÉ-överstycket
    sno(kx + 3, kx + 24, gtop - 1); sno(kx + 3, kx + kw - 4, ky - 3);                   // KASSA-skylten, luckans valv
    sno(pX, sX - 2, pY - 1); sno(sX + 8, pX + pW - 1, pY - 1); sno(sX + 1, sX + 5, sY - 2);  // POPCORN-skylten, struten
    sno(wX - 1, wX + wW, wY - 2);                                                        // popcornfönstret
    sno(bnx, bnx, bny - 1); sno(bnx + 5, bnx + 6, bny - 1);                              // papperskorgen
  }
}

// Ljusskylten lever: titlarna hängs upp bokstav för bokstav, glödlamporna jagar
// runt ramen och nedför BIO-skylten, kassörskan blinkar, popcornen poppar.
// titlarna på tavlan (samma i live och – ovanpå den tända tavlan – i glow)
function bioTitlar(ctx, m, t, cols, h) {
  const prog = bioProgram(h), slot = Math.floor(t / BIO_SLOT), u = t - slot * BIO_SLOT;
  const par = prog[((slot % prog.length) + prog.length) % prog.length];
  const n = Math.floor(u / BIO_BOKSTAV);
  [[par[0], m.mfalt.y1, cols[0]], [par[1], m.mfalt.y2, cols[1]]].forEach(([f, ry, col]) => {
    const s = f.titel, k = Math.min(s.length, n);
    if (k > 0) ctxText(ctx, SMALL, s.slice(0, k), m.mfalt.x0, ry, col);
    const kt = Math.min(f.tid.length, n - s.length);
    if (kt > 0) ctxText(ctx, SMALL, f.tid.slice(0, kt), m.mfalt.x1 - textW(SMALL, f.tid), ry, col);
  });
}
// kassörskan i röd uniform och pillerburkshatt (ritas i live bara när bion har öppet).
// Origo: luckans mitt (kc) och glasets överkant. v: 0 = tittar fram, 1 = blinkar, 2 = tittar åt sidan
function bioKassorska(s, v) {
  const { GOLD, GOLDL } = BIOC, SK = 0xf2cca6, SK2 = 0xd8a47c, HR = 0x3a2418;
  for (let x = -2; x <= 2; x++) { s(x, 0, 0xb8202a); s(x, 1, GOLD); }                     // hatten
  for (let y = 2; y <= 6; y++) for (let x = -2; x <= 2; x++) s(x, y, x === -2 ? SK2 : SK);
  for (let y = 2; y <= 5; y++) { s(-3, y, HR); s(3, y, HR); }
  s(-2, 2, HR); s(2, 2, HR); s(0, 6, 0xc84a5a);
  if (v === 0) { s(-1, 4, 0x2a1a14); s(1, 4, 0x2a1a14); }
  else if (v === 2) { s(-2, 4, 0x2a1a14); s(0, 4, 0x2a1a14); }
  for (let y = 7; y <= 11; y++) for (let x = -5; x <= 5; x++) { if (y === 7 && Math.abs(x) > 3) continue; s(x, y, x < -3 ? 0xd8303a : x > 3 ? 0x901820 : 0xb8202a); }
  s(-1, 7, WHITE); s(0, 7, 0xe8e4dc); s(1, 7, WHITE); s(0, 9, GOLDL); s(0, 11, GOLDL);
  for (let d = 0; d < 8; d++) s(-4 + d, 10 - d, WHITE, 0.14);                             // glasets reflex över henne
}
// rullgardinen som är nere när kassan är stängd: mörkröd duk, mässingsstång och STÄNGT
function bioGardin(P, w, h) {
  const { GOLD, GOLDL, GOLDD } = BIOC;
  for (let y = 0; y < h - 2; y++) for (let x = 0; x < w; x++) {
    let c = jit(0x5a1824, x, y, 941, 0.05);
    if ((x % 4) === 3) c = mul(c, 0.86); else if ((x % 4) === 0) c = mix(c, WHITE, 0.05);
    if (y === 0) c = mul(c, 0.7);
    P.px(x, y, c);
  }
  P.hl(0, h - 2, w, GOLD); P.hl(0, h - 2, 3, GOLDL); P.hl(0, h - 1, w, GOLDD);
  P.px((w >> 1), h - 1, GOLDL);                                                           // dragringen
  text(P, SMALL, 'STÄNGT', (w - textW(SMALL, 'STÄNGT')) >> 1, 3, 0xf0d890);
}
function bioLive(ctx, b, st, m) {
  if (!m.mfalt) return;
  const t = st.t, h = st.hour, open = bioOppen(b, h);
  bioTitlar(ctx, m, t, ['#7a1422', '#1e1a24'], h);
  // glödlamporna: var tredje lampa lyser och mönstret vandrar medsols (släckta 01–12)
  const head = Math.floor(t * 8);
  if (bioLyser(h)) {
    if (m.bulbs) m.bulbs.forEach(([x, y], i) => {
      const f = ((i - head) % 3 + 3) % 3;
      ctx.fillStyle = f === 0 ? '#fffbe0' : f === 1 ? '#e0c878' : '#8a7040';
      ctx.fillRect(x, y, 1, 1);
    });
    if (m.bladeBulbs) m.bladeBulbs.forEach(([x, y], i) => {
      const f = (((i >> 1) - Math.floor(t * 6)) % 4 + 4) % 4;
      ctx.fillStyle = f === 0 ? '#fff4c0' : f === 1 ? '#d8b860' : '#7a6030';
      ctx.fillRect(x, y, 1, 1);
    });
  }
  // kassan: öppet – kassörskan sitter i luckan, blinkar ibland och tittar åt sidan;
  // stängt – rullgardinen är nere
  if (m.kassorska) {
    const [cx, cy] = m.kassorska;
    if (open) {
      const v = (t % 3.7) < 0.14 ? 1 : (t % 13) > 9 ? 2 : 0;
      uteDraw(ctx, uteSpr(`kassorska|${v}`, 11, 12, 5, 0, (s) => bioKassorska(s, v)), cx, cy);
    } else if (m.kassa) {
      const [x, y, w, hh] = m.kassa, key = `gardin|${w}|${hh}`;
      let g = UTE_SPR.get(key);
      if (!g) { const P = new Pix(w, hh); bioGardin(P, w, hh); g = { img: P.flush(), ax: 0, ay: 0 }; UTE_SPR.set(key, g); }
      ctx.drawImage(g.img, x, y);
    }
  }
  // popcornmaskinen står släckt i ett mörkt skåp när bion är stängd
  if (m.popglas && !open) { const [x, y, w, hh] = m.popglas; ctx.fillStyle = st.night ? 'rgba(20,8,12,0.6)' : 'rgba(40,20,20,0.35)'; ctx.fillRect(x, y, w, hh); }
  // popcornen poppar i glasskåpet
  if (m.popwin && open) {
    const [x, y, w, h] = m.popwin;
    for (let i = 0; i < 5; i++) {
      const per = 0.9 + i * 0.23, ph = ((t + i * 0.37) % per) / per, hy = Math.round(Math.sin(ph * Math.PI) * (h - 1));
      ctx.fillStyle = i & 1 ? '#fffaf0' : '#ffe890';
      ctx.fillRect(x + 1 + ((i * 2 + Math.floor((t + i) / per)) % (w - 2)), y + h - 1 - hy, 1, 1);
    }
  }
}

function bioGlow(ctx, b, st, k, m) {
  const t = st.t, h = st.hour, open = bioOppen(b, h), lyser = bioLyser(h);
  if (m.slits && bioFilm(h)) for (const [x, y, w, hh] of m.slits) {                   // filmen flimrar i salongsgluggarna (kallt projektorljus)
    const f = 0.55 + 0.45 * Math.abs(Math.sin(t * 7.3 + x) * Math.sin(t * 2.1));
    ctx.fillStyle = rgba(0x9ab8ff, (0.3 * k * f).toFixed(3)); ctx.fillRect(x, y, w, hh);
  }
  if (open) {                                                                           // kassan och popcornen bara när bion har öppet
    if (m.kassa) { const [x, y, w, hh] = m.kassa; ctx.fillStyle = rgba(0xffd890, (0.32 * k).toFixed(3)); ctx.fillRect(x, y, w, hh); ctx.fillStyle = rgba(0xffc870, (0.1 * k).toFixed(3)); ctx.fillRect(x - 4, y + hh, w + 8, 12); }
    if (m.pop) { const on = Math.floor(t * 2.1) % 7 !== 5; const [x, y, w, hh] = m.pop; ctx.fillStyle = rgba(0xffd040, ((on ? 0.42 : 0.1) * k).toFixed(3)); ctx.fillRect(x - 2, y - 2, w + 4, hh + 4); }
    if (m.popglas) { const [x, y, w, hh] = m.popglas; ctx.fillStyle = rgba(0xffe0a0, (0.28 * k).toFixed(3)); ctx.fillRect(x, y, w, hh); }
  }
  if (!lyser) return;                                                                   // efter 01 är tavlan, neonen och affischerna släckta
  if (m.marquee) {                                                                      // den vita tavlan lyser, ljuspöl mot trottoaren
    const [x, y, w, h] = m.marquee;
    // tavlan är upplyst inifrån: vit yta med skarpa mörka bokstäver även mitt i natten
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(0xfffaf0, (0.88 * k).toFixed(3)); ctx.fillRect(x + 4, y + 16, w - 8, 15);
    ctx.fillStyle = rgba(0xe8e0d0, (0.88 * k).toFixed(3)); ctx.fillRect(x + 4, y + 23, w - 8, 1);
    bioTitlar(ctx, m, t, [rgba(0x7a1422, k.toFixed(3)), rgba(0x1e1a24, k.toFixed(3))], st.hour);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(0xffe8a0, (0.16 * k).toFixed(3)); ctx.fillRect(x + 4, y + 4, w - 8, 10);  // rubriken glöder i guld
    ctx.fillStyle = rgba(0xffd890, (0.12 * k).toFixed(3)); ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = rgba(0xffe8b0, (0.12 * k).toFixed(3)); ctx.fillRect(x - 6, y + h, w + 12, 42);
    ctx.fillStyle = rgba(0xffc890, (0.07 * k).toFixed(3)); ctx.fillRect(x - 8, y - 24, w + 16, 24);   // skenet lyser upp reliefen ovanför
    ctx.fillStyle = rgba(0xffc890, (0.04 * k).toFixed(3)); ctx.fillRect(x + 20, y - 44, w - 40, 20);
    ctx.fillStyle = rgba(0xffe8b0, (0.07 * k).toFixed(3)); ctx.fillRect(x - 16, y + h + 42, w + 32, 14);
  }
  const head = Math.floor(t * 8);
  if (m.bulbs) m.bulbs.forEach(([x, y], i) => {
    if (((i - head) % 3 + 3) % 3) return;
    ctx.fillStyle = rgba(0xfff0b0, (0.6 * k).toFixed(3)); ctx.fillRect(x - 1, y - 1, 3, 3);
  });
  if (m.vneon) {                                                                        // bokstäverna tänds i tur: B, BI, BIO, BIO, släckt
    const seq = Math.floor(t * 1.4) % 5, antal = [1, 2, 3, 3, 0][seq];
    ctx.fillStyle = rgba(0xffd040, (0.14 * k).toFixed(3)); ctx.fillRect(m.vneon[0] - 3, m.vneon[1] - 3, m.vneon[2] + 6, m.vneon[3] + 6);
    for (let i = 0; i < antal; i++) {
      const [bx2, by2, bw2, bh2] = m.bok[i];
      ctx.fillStyle = rgba(0xffe060, (0.5 * k).toFixed(3)); ctx.fillRect(bx2 - 1, by2 - 1, bw2 + 2, bh2 + 2);
      ctx.fillStyle = rgba(0xffd040, (0.16 * k).toFixed(3)); ctx.fillRect(bx2 - 4, by2 - 3, bw2 + 8, bh2 + 6);
    }
    if (m.bladeBulbs) m.bladeBulbs.forEach(([x, y], i) => { if ((((i >> 1) - Math.floor(t * 6)) % 4 + 4) % 4) return; ctx.fillStyle = rgba(0xfff0b0, (0.5 * k).toFixed(3)); ctx.fillRect(x - 1, y - 1, 3, 3); });
  }
  for (const r of m.montrar || []) {                                                   // affischerna lyser i sina glasmontrar
    ctx.fillStyle = rgba(0xfff0d0, (0.32 * k).toFixed(3)); ctx.fillRect(r[0], r[1], r[2], r[3]);
    ctx.fillStyle = rgba(0xffe0a0, (0.1 * k).toFixed(3)); ctx.fillRect(r[0] - 3, r[1] - 4, r[2] + 6, r[3] + 10);
  }
  for (const [lx, ly] of m.affischljus || []) { ctx.fillStyle = rgba(0xfff0b0, (0.45 * k).toFixed(3)); ctx.fillRect(lx, ly, 6, 1); ctx.fillStyle = rgba(0xffe0a0, (0.1 * k).toFixed(3)); ctx.fillRect(lx - 8, ly + 1, 22, 10); }
}

// =====================================================================
// PIZZERIANS UTESERVERING (Carl: "mer stolar utanför, folk som sitter och äter")
// Trottoaren framför pizzerian är full av gatuträd, trafikljus och brandpost,
// så serveringen ligger där den syns: på ett trädäck längs pizzerians gavel på
// Postgatan (gågatan, däcket x 261–297, y 510–640) med tre bistrobord under
// frihängande parasoll, ett bord för en längst ner i däckets västra hörn och en
// griffeltavla i det östra (under POSTGATAN-skyltens plåt). Gästerna sitter
// i profil mot varandra (samma småfolk som i Burgarbarens fönster) och äter i
// live-takt: pizzabit, spagetti som snurras på gaffeln, paret som skålar. En
// stol står ledig och en servitör med pizza på bricka kommer ut genom dörren.
// Allt är y-sorterade föremål (items); borden/stolarna/parasollfötterna och
// blomlådan är hinder (obstacles) – se UTE och uteObstacles().
// =====================================================================
const UTE = {
  // duo = en gäst väster och en öster om bordet; solo = en gäst väster om bordet.
  // norr = en tom stol bakom bordet (den lediga stolen). Parasollstolpen står vid
  // pizzerians vägg (x = cx − 14) och armen håller duken över bordet.
  // Borden står så långt norrut att POSTGATAN-skylten (plåten x 278–320, y 616–626)
  // inte skymmer någon gäst; bordet för en står längst ner i däckets västra hörn
  // (väster om plåten, utanför pizzerians dörrzon) och griffeltavlan i det östra.
  // fas = när bordets sällskap byts (timmar in i varje hel timme) – borden byter
  // gäster var för sig, aldrig alla på en gång.
  bord: [
    { id: 'c', cx: 275, F: 540, kind: 'duo', vast: 'dricka', ost: 'prat', skarm: 0x2a7a3e, ibland: true, fas: 0.25 },
    { id: 'a', cx: 275, F: 574, kind: 'duo', vast: 'pasta', ost: 'slice', skarm: 0xc8342a, norr: true, fas: 0.55 },
    { id: 'b', cx: 275, F: 608, kind: 'duo', vast: 'skala', ost: 'skala', skarm: 0xc8342a, fas: 0.8 },
    { id: 't', cx: 274, F: 639, kind: 'solo', vast: 'slice', fas: 0.05 },
  ],
  deck: [261, 510, 297, 640],
  box: [262, 508, 296, 513],
  tavla: [287, 639],        // griffeltavlan (gatupratare): mitt, fot
  door: [216, 641],
  kyX: 295,                 // servitörens väg upp längs däckets östra kant
};
const uteBord = (id) => UTE.bord.find((q) => q.id === id);
// hindren: bord + stolar (+ parasollfoten vid väggen), blomlådan på däckets norra kant, griffeltavlan
function uteObstacles() {
  const out = [UTE.box, [UTE.tavla[0] - 6, UTE.tavla[1] - 4, UTE.tavla[0] + 5, UTE.tavla[1] + 1]];
  for (const d of UTE.bord) {
    if (d.kind === 'duo') out.push([d.cx - 15, d.F - (d.norr ? 8 : 4), d.cx + 13, d.F + 1]);
    else out.push([d.cx - 14, d.F - 4, d.cx + 7, d.F + 1]);
  }
  return out;
}

// ---------- sprites (målas en gång per utseende/pose och sparas) ----------
const UTE_SPR = new Map();
function uteSpr(key, w, h, ax, ay, paint) {
  let s = UTE_SPR.get(key);
  if (!s) {
    if (UTE_SPR.size > 700) UTE_SPR.clear();
    const P = new Pix(w, h);
    paint((x, y, c, a) => P.px(ax + x, ay + y, c, a), P);
    s = { img: P.flush(), ax, ay };
    UTE_SPR.set(key, s);
  }
  return s;
}
const uteDraw = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
// spegelvänd pensel (vänd åt vänster) – pixel för pixel, aldrig ctx.scale
const flipS = (s, dir) => (dir < 0 ? (x, y, c, a) => s(-x, y, c, a) : s);

const U_SKINS = [[0xf2cca6, 0xd8a47c], [0xe0a97f, 0xc08462], [0xb87850, 0x925a3a], [0x7a4a2e, 0x5a341e]];
const U_HAIRS = [0x2a1a12, 0x6a3a1a, 0xe8c070, 0xb8502a, 0x141418, 0xd8d4cc, 0x8a5a2a];
const U_STYLES = ['kort', 'lang', 'tofs', 'keps', 'knut', 'kort', 'lang', 'flint'];
const U_SHIRTS = [0x3a7bd5, 0xf0c040, 0x5aae5a, 0xe07a30, 0xd83a5a, 0x7a5ac8, 0x40a8a8, 0xf4f1ea, 0x2a2a34, 0xe8a0b8];
const U_PANTS = [0x2d3a5c, 0x3a3a44, 0x5a4a3a, 0x3a5a8a, 0x1e1e24];
function uteLook(seed) {
  const h = (k) => hash(seed & 1023, (seed >> 10) + k * 37, 517), pick = (a, k) => a[Math.floor(h(k) * a.length) % a.length];
  const L = { id: seed, skin: pick(U_SKINS, 1), hair: pick(U_HAIRS, 2), style: pick(U_STYLES, 3), shirt: pick(U_SHIRTS, 4), pants: pick(U_PANTS, 5), cap: pick([0xd02a3e, 0x3a7bd5, 0x2a2a34, 0xf0c040], 6) };
  // mörkt hår mot mörk hy blir en klump – då blir håret svart och lite blankt
  const lum = (c) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
  if (Math.abs(lum(L.hair) - lum(L.skin[0])) < 45) L.hair = lum(L.skin[0]) > 120 ? 0x2a1a12 : 0x141418;
  return L;
}
const CH = [0x1a3e28, 0x2a6a44, 0x4a9a64];                          // bistrostolarna i grönlackad metall
const WINE = 0x8a1a2a, WINEL = 0xc84a5a, GLAS = 0xe0ecf0, GLAS2 = 0xa8b8c0;
// maten och glasen i handen (x åt bordet)
function heldSlice(s, x, y) { s(x + 1, y - 2, 0xf0c050); s(x, y - 1, 0xe8b040); s(x + 1, y - 1, 0xc83a20); s(x + 2, y - 1, 0xf0c050); s(x, y, 0xd8964a); s(x + 1, y, 0xc8843a); s(x - 1, y, 0xb87838); }
function heldPasta(s, x, y) { s(x, y, 0xf0d070); s(x + 1, y, 0xe0b850); s(x, y - 1, 0xf8e090); s(x + 1, y - 1, 0xc8341a); s(x + 1, y + 1, 0xf0d070); s(x + 1, y + 2, 0xe8c860); s(x - 1, y + 1, 0xb8bcc4); s(x - 2, y + 2, 0xb8bcc4); }
function wineGlass(s, x, y) { s(x, y - 3, GLAS); s(x + 1, y - 3, GLAS2); s(x, y - 2, WINEL); s(x + 1, y - 2, WINE); s(x, y - 1, WINE); s(x + 1, y - 1, mul(WINE, 0.8)); s(x, y, GLAS2); }
function beerGlass(s, x, y) { s(x, y - 4, 0xfaf8f0); s(x + 1, y - 4, 0xf0ece0); for (let j = -3; j <= 0; j++) { s(x, j + y, 0xf0b030); s(x + 1, j + y, 0xd08a20); } s(x, y - 3, 0xffd860); }

// ---- en sittande gäst i profil vänd mot bordet (åt höger; spegla med flipS).
// Origo: ryggens kolumn, sitsens överkant. layer 'body' (före bordet) / 'arm' (efter). ----
function uteSide(s, L, p, layer, blink) {
  const [sk, sk2] = L.skin, hr = L.hair, hrH = mix(hr, WHITE, 0.28), hr2 = mul(hr, 0.72);
  const sh = L.shirt, shD = mul(sh, 0.68), shL = mix(sh, WHITE, 0.3), pt = L.pants, ptD = mul(pt, 0.72);
  const lean = p === 'drink' || p === 'mouth' || p === 'forkmouth' ? 1 : 0;
  if (layer === 'body') {
    for (let x = 1; x <= 8; x++) { s(x, -1, pt); s(x, 0, ptD); }                         // låren
    for (let y = 1; y <= 6; y++) { s(7, y, pt); s(8, y, ptD); }                          // underbenen
    s(7, 7, 0x2a2a30); s(8, 7, 0x1a1a1e); s(9, 7, 0x2a2a30); s(10, 7, 0x3a3a40); s(9, 6, 0x3a3a40);
    for (let y = -10; y <= -2; y++) for (let x = 0; x <= 4; x++) {
      if (y === -10 && (x === 0 || x === 4)) continue;
      s(x + (lean && y < -6 ? 1 : 0), y, x === 0 ? shD : x === 4 ? shL : y === -10 ? shL : sh);
    }
    if (sh === 0xf4f1ea) for (let y = -8; y <= -3; y += 2) s(1, y, 0xc8d0dc);          // randig tröja
    const hx = lean;
    s(2 + hx, -11, sk2); s(3 + hx, -11, sk2);
    for (let y = -17; y <= -12; y++) for (let x = 1; x <= 5; x++) {
      if ((y === -17 || y === -12) && x === 5) continue;
      s(x + hx, y, x === 1 ? sk2 : sk);
    }
    s(6 + hx, -14, sk); s(6 + hx, -13, sk2);                                             // näsan
    s(4 + hx, -15, blink ? sk2 : 0x2a1a14); s(2 + hx, -14, mul(sk2, 0.92));              // ögat, örat
    s(5 + hx, -12, p === 'chew' || p === 'mouth' || p === 'forkmouth' || p === 'prat' ? 0x7a2a28 : mix(sk2, 0xb85a4a, 0.5));
    s(4 + hx, -13, mix(sk, 0xf08080, 0.3));
    const H = (x, y, c = hr) => s(x + hx, y, c), st = L.style;
    if (st === 'keps') {
      for (let x = 1; x <= 4; x++) { H(x, -18, L.cap); H(x, -17, mul(L.cap, 0.85)); }
      H(2, -18, mix(L.cap, WHITE, 0.3)); H(5, -17, L.cap); H(6, -17, mul(L.cap, 0.7)); H(7, -17, mul(L.cap, 0.6));
      H(1, -16, hr); H(1, -15, hr2);
    } else if (st === 'flint') { H(1, -15, hr); H(1, -14, hr2); H(2, -15, hr2); H(3, -17, mix(sk, WHITE, 0.3)); }
    else {
      for (let x = 1; x <= 4; x++) H(x, -18, x === 2 || x === 3 ? hrH : hr);
      H(1, -17, hr); H(2, -17, hr); H(3, -17, hr2); H(4, -17, hr2); H(1, -16, hr2); H(1, -15, hr2);
      if (st === 'lang') { for (let y = -17; y <= -9; y++) H(0, y, y > -12 ? hr2 : hr); H(1, -14, hr); H(1, -13, hr2); }
      if (st === 'tofs') { H(0, -17, hr); H(-1, -16, hr); H(-1, -15, hr2); H(-2, -14, hr2); H(0, -16, 0xd02a3e); }
      if (st === 'knut') { H(1, -19, hr); H(2, -19, hrH); H(0, -18, hr2); }
    }
    return;
  }
  const arm = (pts) => pts.forEach(([x, y], i) => s(x, y, i < 2 ? (i ? sh : shL) : sk));
  if (p === 'lift') { arm([[3, -9], [4, -8], [5, -8], [6, -9], [7, -10]]); heldSlice(s, 7, -11); }
  else if (p === 'mouth') { arm([[4, -9], [5, -8], [6, -9], [7, -10], [7, -11]]); heldSlice(s, 7, -12); }
  else if (p === 'toast') { arm([[3, -9], [4, -8], [5, -9], [6, -10], [7, -11], [8, -12]]); wineGlass(s, 8, -13); }
  else if (p === 'clink') { arm([[3, -9], [4, -8], [5, -9], [6, -10], [7, -11], [8, -11], [9, -12], [10, -12]]); wineGlass(s, 10, -13); } else if (p === 'drink') { arm([[4, -9], [5, -8], [6, -9], [7, -10], [7, -11]]); wineGlass(s, 7, -12); }
  else if (p === 'beer') { arm([[4, -9], [5, -8], [6, -9], [7, -10], [7, -11]]); beerGlass(s, 7, -12); }
  else if (p === 'prat') { arm([[3, -9], [4, -8], [5, -9], [6, -10], [7, -11], [8, -12]]); s(8, -13, sk2); }
  else if (p.startsWith('twirl')) {
    arm([[3, -9], [4, -8], [4, -7], [5, -6], [6, -6], [7, -7], [8, -7]]);
    s(9, -8, 0xc8ccd4); s(9, -7, 0xb8bcc4); s(9, -6, 0x9aa0a8);                           // gaffeln ner i tallriken
    const f = +p.slice(5) || 0, ring = [[8, -5], [10, -5], [10, -4], [8, -4]];
    for (const [x, y] of ring) s(x, y, 0xe8c860); s(9, -5, 0xf0d070); s(9, -4, 0xc8341a);
    s(ring[f & 3][0], ring[f & 3][1], 0xfff0b0);
  }
  else if (p === 'forklift') { arm([[3, -9], [4, -8], [5, -8], [6, -9], [7, -10]]); heldPasta(s, 8, -12); }
  else if (p === 'forkmouth') { arm([[4, -9], [5, -8], [6, -9], [7, -10], [7, -11]]); heldPasta(s, 7, -13); }
  else { arm([[3, -9], [4, -8], [4, -7], [5, -6], [6, -5], [7, -5], [8, -5], [9, -5]]); s(4, -7, sh); }
}
// ---- stolarna (grönlackade bistrostolar) ----
function chairSide(s) {    // i profil, ryggstödet bakom gästens rygg. Origo som gästens.
  for (let y = -12; y <= 8; y++) s(-1, y, y < -10 ? CH[2] : y > 1 ? CH[0] : CH[1]);
  s(-2, -12, CH[1]); s(-2, -11, CH[0]); s(0, -9, CH[1]); s(0, -5, CH[1]);
  for (let x = 0; x <= 6; x++) { s(x, 1, x === 0 ? CH[2] : CH[1]); s(x, 2, CH[0]); }
  for (let y = 3; y <= 8; y++) s(6, y, CH[0]);
  s(0, 8, CH[0]); s(7, 8, CH[0]); s(3, 5, CH[0]); s(4, 5, CH[0]);
}
function chairBehind(s) {  // den lediga stolen bakom bordet, framifrån: ryggen och sitsen syns
  for (let x = -4; x <= 4; x++) { s(x, -12, x === -4 ? CH[2] : CH[1]); s(x, -8, CH[1]); }
  for (let y = -11; y <= 7; y++) { s(-5, y, y < -9 ? CH[2] : CH[1]); s(5, y, CH[0]); }
  s(-5, -12, CH[1]); s(5, -12, CH[0]);
  for (let x = -4; x <= 4; x++) if (x & 1) for (let y = -11; y <= -9; y++) s(x, y, CH[0]);
  for (let x = -5; x <= 5; x++) { s(x, 0, x < -2 ? CH[2] : CH[1]); s(x, 1, CH[0]); }
}
// ---- bordet framifrån: gjutjärnsfot, röd-vitrutig duk. Origo: bordets mitt vid foten. ----
function uteTable(s, snow) {
  for (let x = -3; x <= 3; x++) s(x, 0, x === -3 ? 0x3a3a44 : 0x1e1e24);
  for (let x = -2; x <= 2; x++) s(x, -1, x < 0 ? 0x5a5a64 : 0x3a3a44);
  for (let y = -8; y <= -2; y++) { s(-1, y, 0x5a5a64); s(0, y, 0x2a2a30); }
  const chk = (x, y, top) => { const red = (((x + 20) >> 1) + ((y + 20) >> 1)) & 1; return top ? (red ? 0xd84a3a : 0xfffaf2) : (red ? 0xc8342a : 0xf4efe6); };
  for (let y = -11; y <= -8; y++) for (let x = -6; x <= 5; x++) {
    let c = chk(x, y, false);
    if (x === -6) c = mix(c, WHITE, 0.1); else if (x === 5) c = mul(c, 0.78); else if (x === 4) c = mul(c, 0.9);
    if (y === -11) c = mix(c, WHITE, 0.14); else if (y === -8) c = mul(c, 0.84);
    s(x, y, c);
  }
  for (let x = -6; x <= 5; x++) if (((x + 20) & 3) < 2) s(x, -7, mul(chk(x, -8, false), 0.72));   // fållen
  for (let y = -14; y <= -12; y++) for (let x = -5; x <= 4; x++) {
    if (y === -14 && (x === -5 || x === 4)) continue;
    let c = snow ? (hash(x, y, 71) > 0.8 ? WHITE : 0xe8eef6) : chk(x, y, true);
    if (y === -14 && !snow) c = mul(c, 0.92);
    s(x, y, c);
  }
}
// maten på bordet (skivan: y −14 … −12): en tallrik är 5 bred
function utePlate(s, x, what, state) {
  for (let i = -2; i <= 2; i++) s(x + i, -13, i === -2 ? 0xe8e8e4 : 0xf8f8f4);
  for (let i = -1; i <= 1; i++) s(x + i, -12, 0xd4d4d0);
  if (what === 'pizza' && state > 0) {
    const cells = [[-1, -13, 0xd8964a], [0, -13, 0xf0c050], [1, -13, 0xd8964a], [-1, -14, 0xe0a048], [0, -14, 0xc83a20], [1, -14, 0x3a8a2a]];
    const keep = [0, 2, 3, 4, 6][state];
    cells.slice(0, keep).forEach(([i, y, c]) => s(x + i, y, c));
  } else if (what === 'pasta') {
    s(x - 1, -13, 0xf0d070); s(x, -13, 0xc8341a); s(x + 1, -13, 0xe8c860); s(x, -14, 0xf8e090); s(x - 1, -14, 0xe8c860); s(x + 1, -14, 0x3a8a2a);
  }
}
function uteCandle(s, x) { s(x, -14, 0xc83a3a); s(x + 1, -14, 0x8a1a20); s(x, -13, 0x9a2028); s(x + 1, -13, 0x6a1018); }   // värmeljus i rött glas
// ---- griffeltavlan (gatupratare) i däckets sydöstra hörn: träram på utåtställda ben,
// svart tavla med kritklotter – rubrik, en ritad pizza och prisrader. Origo: mitt, fot. ----
function uteTavla(s, snow) {
  const W0 = 0x5a3a22, W1 = 0x8a5a36, W2 = 0xb07a4a;
  for (let y = -13; y <= -2; y++) { s(-6, y, y < -11 ? W2 : W1); s(4, y, W0); }           // sidostyckena
  s(-7, -1, W1); s(-7, 0, W0); s(5, -1, W0); s(5, 0, 0x3a2416); s(-6, -1, W0); s(4, -1, W0);  // benen, utåtställda
  for (let x = -5; x <= 3; x++) { s(x, -14, x < -2 ? W2 : W1); s(x, -2, W0); }             // överstycke, underlist
  s(-6, -14, W1); s(4, -14, W0); s(-1, -15, 0x3a3a40); s(0, -15, 0x3a3a40);                // hanken
  for (let y = -13; y <= -3; y++) for (let x = -5; x <= 3; x++) {
    const n = hash(x + 40, y + 40, 931);
    s(x, y, n > 0.86 ? 0x3e443e : n < 0.12 ? 0x1c201c : 0x2a302a);                        // tavlan med kritdamm
  }
  const K = 0xecece4, K2 = 0xb8bab0, Y = 0xf0c860, R = 0xe0604a;
  [1, 1, 0, 1, 1, 1, 0, 1, 1].forEach((on, i) => { if (on) s(-5 + i, -12, i & 1 ? K2 : K); });   // rubriken
  s(-4, -11, K2); s(-1, -11, K2); s(2, -11, K2);
  for (const [x, y] of [[-3, -9], [-2, -9], [-4, -8], [-1, -8], [-4, -7], [-1, -7], [-3, -6], [-2, -6]]) s(x, y, Y);  // pizzan
  s(-3, -8, R); s(-2, -7, R); s(-2, -8, 0x6ab04a);
  for (const y of [-9, -7]) { s(1, y, K); s(2, y, K2); s(3, y, K); }                        // priser
  s(0, -5, K2); s(1, -5, K); s(2, -5, K2); s(-4, -4, K2); s(-3, -4, K);                     // krumelurer
  for (let x = -5; x <= 5; x++) s(x, 1, 0x000000, 0.22);                                     // skugga på däcket
  if (snow) { for (let x = -6; x <= 4; x++) s(x, -15, x & 1 ? WHITE : 0xe8eef6); s(-1, -16, WHITE); s(0, -16, 0xeef4fa); }
}
function uteBottle(s, x, c) { for (let y = -19; y <= -12; y++) { s(x, y, y < -16 ? mul(c, 0.9) : c); s(x + 1, y, y < -16 ? mul(c, 0.6) : mul(c, 0.7)); } s(x, -20, 0xc8a070); s(x, -15, mix(c, WHITE, 0.4)); s(x, -14, 0xf4f1ea); s(x + 1, -14, 0xd8d0c0); }
// ---- frihängande parasoll: stolpen vid väggen (öster om den), armen håller en
// rund duk i fyra våder över bordet. Origo: stolpens fot; duken i x = off ± 11. ----
function uteParasol(s, off, col, open, snow) {
  const M = [0x3a3a44, 0x6a6a74, 0x9a9aa4];
  for (let x = -2; x <= 2; x++) { s(x, 0, M[0]); s(x, -1, x < 0 ? M[1] : M[0]); }       // foten
  for (let y = -42; y <= -2; y++) { s(0, y, M[2]); s(1, y, M[0]); }                      // stolpen
  const cream = 0xf4ead0, cream3 = 0xc8b894, cx = off;
  if (!open) {
    // hopfällt och invikt mot väggen: armen fälld in till en kort stump och duken
    // hoprullad med en rem – den hänger tätt intill stolpen, inte över bordet
    s(0, -43, M[2]); s(1, -43, M[1]); s(2, -43, M[2]); s(3, -43, M[1]); s(4, -43, M[0]); s(1, -42, M[0]);
    s(4, -44, 0xd8c890); s(5, -44, 0xb8a870); s(4, -42, 0x8a8470); s(5, -42, 0x6a6458);     // knoppen och navet
    // den hoprullade duken: en spole som är tjockast upptill och smalnar mot spetsen,
    // våderna vridna runt (diagonala ränder), ljus från väster
    const rulle = [[4, 5], [4, 5], [3, 6], [3, 6], [3, 6], [3, 6], [3, 6], [3, 6], [3, 6], [3, 5], [4, 5], [4, 5], [4, 5], [4, 4], [4, 4]];
    rulle.forEach(([a, z], j) => {
      const y = -41 + j;
      for (let x = a; x <= z; x++) {
        let c = ((x + j) >> 1) & 1 ? col : cream;
        c = x === a ? mix(c, WHITE, 0.14) : x === z ? mul(c, 0.72) : c;
        if (j >= 13) c = mul(c, 0.86);
        s(x, y, c);
      }
    });
    s(4, -26, mul(cream3, 0.7)); s(4, -25, 0x6a6458);                                      // spetsen
    s(3, -35, 0x2a2a30); s(4, -35, 0x3a3a44); s(5, -35, 0xb8b0a0); s(6, -35, 0x1a1a20);    // remmen med spänne
    for (let y = -38; y <= -29; y++) s(7, y, 0x000000, 0.14);                              // skuggan mot väggen
    if (snow) { s(4, -45, WHITE); s(5, -45, 0xeef4fa); s(3, -41, WHITE); s(3, -40, 0xeef4fa); s(2, -44, WHITE); s(3, -44, 0xeef4fa); s(0, -44, WHITE); s(1, -44, 0xeef4fa); }
    return;
  }
  for (let i = 1; i <= off; i++) s(i, -43, i & 1 ? M[1] : M[2]);                          // armen
  s(1, -42, M[0]); s(2, -42, M[0]); s(3, -41, M[0]); s(0, -43, M[2]);
  const R = 11, AY = -42, RY = -35;
  const vad = (x) => ((Math.floor((x + R) / 5.5)) & 1 ? col : cream);                   // våderna växlar färg
  for (let x = -R; x <= R; x++) {
    const yt = Math.round(AY + Math.abs(x) * ((RY - AY) / R) * 0.9);
    for (let y = yt; y <= RY; y++) {
      let c = vad(x);
      c = x < -3 ? mix(c, WHITE, 0.12) : x > 4 ? mul(c, 0.86) : c;                        // ljuset från väster
      if (y === yt) c = mix(c, WHITE, 0.3);
      if (((x + R) % 5.5) < 1 && Math.abs(x) < R) c = mul(c, 0.8);                        // sömmarna
      if (snow && y <= yt + 1) c = hash(x, y, 81) > 0.2 ? 0xf4f8fc : c;
      s(cx + x, y, c);
    }
    const v = vad(x);                                                                    // kappan med tandad fåll
    s(cx + x, RY + 1, mul(v, 0.9)); s(cx + x, RY + 2, mul(v, 0.8));
    if (((x + R) & 3) < 2) s(cx + x, RY + 3, mul(v, 0.66));
  }
  s(cx, AY - 1, 0xd8c890); s(cx, AY - 2, 0xb8a870);                                      // knoppen
}
// ---- servitören i vitt förkläde, svart väst och fluga. Origo: fötterna, vänd åt höger. ----
function uteWaiter(s, fr, pose) {
  const SK = 0xe0a97f, SK2 = 0xc08462, HR = 0x1e1612, WH = 0xf6f4ee, WH2 = 0xd4d0c8, BK = 0x1e1e26, BK2 = 0x383844, AP = 0xfcfaf4, AP2 = 0xdcd8d0;
  if (fr === 0 || fr === 2) {                                                            // kliv
    const a = fr === 0 ? 1 : -1;
    for (let y = -8; y <= -1; y++) { s(-1 - (y > -5 ? a : 0), y, BK); s(1 + (y > -5 ? a : 0), y, BK2); }
    s(-2 - a, 0, 0x101014); s(-1 - a, 0, 0x101014); s(1 + a, 0, 0x101014); s(2 + a, 0, 0x2a2a30); s(3 + a, 0, 0x101014);
  } else {
    for (let y = -8; y <= -1; y++) { s(0, y, BK); s(1, y, BK2); }
    s(0, 0, 0x101014); s(1, 0, 0x2a2a30); s(2, 0, 0x101014);
  }
  for (let y = -12; y <= -3; y++) { s(1, y, AP); s(2, y, y > -6 && (fr === 0 || fr === 2) ? AP : AP2); }  // förklädet
  s(3, -4, AP2); s(0, -11, AP2);
  for (let y = -19; y <= -10; y++) for (let x = -2; x <= 2; x++) s(x, y, x === -2 ? WH2 : WH);
  for (let y = -18; y <= -12; y++) for (let x = -2; x <= 0; x++) s(x, y, x === -2 ? BK : BK2);   // västen
  s(1, -16, BK2); s(1, -14, BK2); s(0, -11, WH2);
  s(2, -19, 0xc02030); s(3, -19, 0xa01828); s(2, -18, 0xd83040);                       // flugan
  s(0, -20, SK2); s(1, -20, SK2);
  for (let y = -26; y <= -21; y++) for (let x = -1; x <= 2; x++) s(x, y, x === -1 ? SK2 : SK);
  s(3, -24, SK); s(3, -23, SK2); s(1, -24, 0x1a1210); s(2, -22, HR); s(3, -22, HR); s(1, -22, 0x3a2a20);  // näsa, öga, mustasch
  s(2, -21, 0xa85a4a);
  for (let x = -2; x <= 2; x++) s(x, -27, x === 0 ? 0x4a3a30 : HR);
  for (let x = -2; x <= 1; x++) s(x, -26, HR);
  s(-2, -25, HR); s(-2, -24, HR); s(-2, -23, 0x2a2018); s(0, -25, HR);
  const tray = (x0, y, n) => { for (let i = 0; i < n; i++) s(x0 + i, y, i < 3 ? 0xe8ecf0 : 0xb8bcc4); };
  const pizza = (x0, y) => { for (let i = 0; i < 7; i++) s(x0 + i, y, i === 0 || i === 6 ? 0xb87838 : 0xd8964a); for (let i = 1; i < 6; i++) s(x0 + i, y - 1, i & 1 ? 0xd84a2a : 0xf0c050); s(x0 + 3, y - 1, 0x3a8a2a); };
  if (pose === 'bar') {                                       // pizzan på brickan högt upp
    [[1, -17], [2, -15], [3, -14], [4, -15], [4, -16], [4, -17]].forEach(([x, y], i) => s(x, y, i < 2 ? WH : i === 2 ? WH2 : SK));
    tray(0, -18, 9); pizza(1, -19);
  } else if (pose === 'serve') {                              // armen fram och ner mot bordet
    [[1, -17], [2, -16], [3, -15], [4, -14], [5, -13], [6, -13]].forEach(([x, y], i) => s(x, y, i < 2 ? WH : SK));
    tray(5, -14, 9); pizza(6, -15);
  } else if (pose === 'tom') {                                // brickan under armen på väg tillbaka
    [[1, -17], [1, -16], [2, -15], [2, -14], [2, -13]].forEach(([x, y], i) => s(x, y, i < 2 ? WH : SK));
    for (let y = -18; y <= -11; y++) s(3, y, y < -16 ? 0xe8ecf0 : 0xb8bcc4);
  }
  if (pose !== 'serve') { const sw = fr === 0 ? 1 : fr === 2 ? -1 : 0; s(-3, -17, WH2); s(-3 - sw, -15, WH2); s(-3 - sw, -14, SK2); }
}

// ---------- vem sitter var, vad de gör just nu ----------
function uteOpen(st) {
  const w = st.env?.weather || {}, h = st.hour;
  const oppet = h >= 11 && h < 23, torrt = !(st.env?.rain || w.kind === 'regn' || w.kind === 'snö');
  return { oppet, gaster: oppet && torrt && (w.temp ?? 15) >= 7 && (w.snowCover || 0) < 0.3, parasoll: h >= 10 && h < 23 && (w.snowCover || 0) < 0.3 };
}
// gästerna byts en gång i timmen, men varje bord på sin egen minut (d.fas) – så
// sällskapen kommer och går var för sig i stället för att alla byts samtidigt.
// Bord 'ibland' och bordet för en står tomma en del sittningar.
const uteSitt = (st, d) => Math.floor((st.hour || 0) + (d.fas || 0));
function uteSeed(st, d, seat) { return ((((st.env?.day ?? 1) * 25 + uteSitt(st, d)) * 5 + seat) * 131 + d.id.charCodeAt(0) * 977) & 0xfffff; }
const uteHar = (st, d) => !(d.ibland || d.kind === 'solo') || hash(uteSitt(st, d), (st.env?.day ?? 1) + d.id.charCodeAt(0), 911) > (d.kind === 'solo' ? 0.2 : 0.35);
function uteAct(act, t) {
  if (act === 'slice') { const u = t % 5.6; if (u < 1.9) return u > 0.5 && Math.floor(u * 3) % 2 ? 'chew' : 'rest'; if (u < 2.3) return 'lift'; if (u < 3.3) return 'mouth'; if (u < 3.7) return 'lift'; return 'rest'; }
  if (act === 'pasta') { const u = t % 6.6; if (u < 2.6) return 'twirl' + (Math.floor(u * 8) & 3); if (u < 3.0) return 'forklift'; if (u < 3.9) return 'forkmouth'; if (u < 5.3) return Math.floor(u * 3) % 2 ? 'chew' : 'rest'; return 'rest'; }
  if (act === 'skala') { const u = t % 9; if (u < 1.6) return 'prat'; if (u < 4.6) return 'rest'; if (u < 5.1) return 'toast'; if (u < 5.7) return 'clink'; if (u < 6.9) return 'drink'; return 'rest'; }
  if (act === 'dricka') { const u = t % 7.4; if (u < 2.8) return 'rest'; if (u < 4.4) return 'beer'; return 'rest'; }
  if (act === 'prat') { const u = t % 3.4; return u < 0.8 || (u > 1.5 && u < 2.1) ? 'prat' : 'rest'; }
  return 'rest';
}
// ---------- servitören: ut genom dörren, längs trottoaren och upp längs däckets
// östra kant till bordet. Turordningen b, a, b, c – men bara till bord där någon
// sitter (står bord c tomt går turen till a). Bordet för en beställer inte mer. ----------
const KY = { cykel: 30, v: 26, ut: 0.6, serve: 2.2, seq: ['b', 'a', 'b', 'c'], lang: { b: 60, a: 120, c: 120 } };
const KY_VAG = {};
function kyparVag(id) {
  if (KY_VAG[id]) return KY_VAG[id];
  const [dx, dy] = UTE.door, d = uteBord(id);
  return (KY_VAG[id] = [[dx, dy], [dx, 657], [UTE.kyX, 657], [UTE.kyX, d.F + 2]]);
}
function vagLangd(v) { let L = 0; for (let i = 1; i < v.length; i++) L += Math.abs(v[i][0] - v[i - 1][0]) + Math.abs(v[i][1] - v[i - 1][1]); return L; }
function vagPunkt(v, s) {                                   // punkt s px in på vägen (lodräta/vågräta sträckor) + riktning
  for (let i = 1; i < v.length; i++) {
    const L = Math.abs(v[i][0] - v[i - 1][0]) + Math.abs(v[i][1] - v[i - 1][1]);
    if (s <= L || i === v.length - 1) {
      const f = L ? clamp(s / L, 0, 1) : 1;
      return { x: Math.round(v[i - 1][0] + (v[i][0] - v[i - 1][0]) * f), y: Math.round(v[i - 1][1] + (v[i][1] - v[i - 1][1]) * f), dx: Math.sign(v[i][0] - v[i - 1][0]) };
    }
    s -= L;
  }
  return { x: v[0][0], y: v[0][1], dx: 0 };
}
function kyparTur(n, st) {
  let id = KY.seq[((n % KY.seq.length) + KY.seq.length) % KY.seq.length];
  if (!uteHar(st, uteBord(id))) id = 'a';                      // tomt bord: ingen pizza dit
  const v = kyparVag(id), tw = vagLangd(v) / KY.v;
  return { id, v, tw, td: n * KY.cykel + KY.ut + tw + KY.serve * 0.5 };
}
function kyparLage(t, st) {
  const n = Math.floor(t / KY.cykel), u = t - n * KY.cykel, { id, v, tw } = kyparTur(n, st);
  const t1 = KY.ut, t2 = t1 + tw, t3 = t2 + KY.serve, t4 = t3 + tw, t5 = t4 + 0.5;
  const door = u < t1 ? u / t1 : u < t1 + 0.5 ? 1 - (u - t1) / 0.5 : u > t4 - 0.5 && u < t5 + 0.4 ? clamp(1 - (u - t5) / 0.4, 0, 1) * clamp((u - (t4 - 0.5)) / 0.5, 0, 1) : 0;
  if (u < t1 * 0.6 || u > t5) return { door };
  const step = (s) => (Math.floor(s / 3.5) & 3);
  if (u < t1) return { door, x: v[0][0], y: v[0][1] + 1, dir: 1, fr: 1, pose: 'bar', id };
  if (u < t2) { const s = (u - t1) * KY.v, p = vagPunkt(v, s); return { door, x: p.x, y: p.y, dir: p.dx < 0 ? -1 : 1, fr: step(s), pose: 'bar', id }; }
  if (u < t3) { const e = v[v.length - 1]; return { door, x: e[0], y: e[1], dir: -1, fr: 1, pose: u - t2 < KY.serve * 0.5 ? 'serve' : 'tom', id }; }
  if (u < t4) { const s = (t4 - u) * KY.v, p = vagPunkt(v, s); return { door, x: p.x, y: p.y, dir: p.dx > 0 ? -1 : 1, fr: step(s), pose: 'tom', id }; }
  return { door, x: v[0][0], y: v[0][1] + 1, dir: -1, fr: 1, pose: 'tom', id };
}
// pizzan på bordet: 4 = hel … 1 = kanter kvar, räknat från senaste leveransen
// (takten efter hur ofta bordet brukar få en ny pizza)
function utePizza(id, t, st) {
  let n = Math.floor(t / KY.cykel);
  const lang = KY.lang[id] || 60;
  for (let k = 0; k < 6; k++, n--) {
    const tur = kyparTur(n, st);
    if (tur.id === id && t >= tur.td) { const f = (t - tur.td) / lang; return f < 0.3 ? 4 : f < 0.55 ? 3 : f < 0.8 ? 2 : 1; }
  }
  return 2;
}

// ---------- trädäcket och blomlådan (målas en gång) ----------
const UTE_DECK = {};
function uteDeckImg(snow) {
  const key = snow ? 's' : 'n';
  if (UTE_DECK[key]) return UTE_DECK[key];
  const [x0, y0, x1, y1] = UTE.deck, w = x1 - x0, h = y1 - y0, P = new Pix(w + 1, h);
  const TONES = [0x9a7a54, 0x8e7048, 0xa8865c, 0x927250];
  for (let j = 0; j < h; j++) {
    const row = (j / 3) | 0, gap = (j % 3) === 2, off = ((hash(row, 1, 901) * 14) | 0);
    for (let i = 0; i < w; i++) {
      const X = x0 + i, seam = ((i + off) % 15) === 0;
      let c = jit(TONES[(hash(row, ((i + off) / 15) | 0, 902) * 4) | 0], X, y0 + j, 903, 0.08);
      if (gap || seam) c = mul(c, 0.62); else if ((j % 3) === 0) c = mix(c, WHITE, 0.1);
      if (!gap && ((i + off) % 15) === 1 && (j % 3) === 1) c = 0x5a4a3a;                  // spikar vid skarven
      if (i === 0) c = mul(c, 0.55); else if (i === 1) c = mul(c, 0.8);                    // husväggens skugga
      if (i === w - 1) c = mul(c, 0.7);
      if (j >= h - 2) c = mul(c, j === h - 1 ? 0.55 : 0.75);                              // kanten mot trottoaren
      if (snow && !(gap && hash(X, j, 914) > 0.6) && hash(X, y0 + j, 915) > 0.06 && i > 1) c = hash(X, y0 + j, 916) > 0.85 ? WHITE : (gap ? 0xd8e0ea : 0xeef2f8); // snötäcke, fogarna skymtar
      P.px(i, j, c);
    }
    P.px(w, j, 0x000000, 0.25);
  }
  return (UTE_DECK[key] = P.flush());
}
const UTE_BOX = {};
function uteBoxImg(winter) {
  const k = winter ? 'v' : 's';
  if (UTE_BOX[k]) return UTE_BOX[k];
  const [x0, , x1] = UTE.box, w = x1 - x0, P = new Pix(w, 14), by = 8;
  for (let j = 0; j < 6; j++) for (let i = 0; i < w; i++) {
    let c = jit(0x6a4428, x0 + i, j, 904, 0.08);
    if (j === 0) c = 0x8a5a36; else if (j === 5) c = 0x3a2416; else if ((i % 8) === 7) c = mul(c, 0.7);
    if (i === 0) c = mix(c, WHITE, 0.12); else if (i === w - 1) c = mul(c, 0.7);
    P.px(i, by + j, c);
  }
  for (let i = 1; i < w - 1; i++) {                                                      // pelargoner (på vintern granris med snö)
    const top = by - 2 - ((hash(i, 1, 905) * 4) | 0);
    for (let y = top; y < by; y++) P.px(i, y, winter ? (y === top ? 0xeef4fa : 0x1e4a2a) : (hash(i, y, 906) > 0.6 ? 0x6fae4a : 0x3f7a34));
    if (!winter && hash(i, 2, 907) > 0.55) { const c = [0xe83a4a, 0xd02a3a, 0xffffff, 0xf05a8a][(hash(i, 3, 908) * 4) | 0]; P.px(i, top - 1, c); if (hash(i, 4, 909) > 0.5) P.px(i, top, c); }
  }
  return (UTE_BOX[k] = P.flush());
}

// ---------- föremålen: däck, blomlåda, borden med gäster, servitören ----------
function uteserveringen(b, st) {
  const t = st.t, O = uteOpen(st), snow = (st.env?.weather?.snowCover || 0) > 0.4, out = [];
  const [dx0, dy0] = UTE.deck;
  out.push({ y: dy0 - 0.5, kind: 'uteservering', draw: (ctx) => ctx.drawImage(uteDeckImg(snow), dx0, dy0) });
  out.push({ y: UTE.box[3], kind: 'blomlåda', draw: (ctx) => ctx.drawImage(uteBoxImg(snow || st.env?.weather?.season === 'vinter'), UTE.box[0], UTE.box[1] - 7) });
  out.push({ y: UTE.tavla[1] + 0.4, kind: 'griffeltavla', draw: (ctx) => uteDraw(ctx, uteSpr(`tavla|${snow ? 1 : 0}`, 16, 18, 8, 16, (s) => uteTavla(s, snow)), UTE.tavla[0], UTE.tavla[1]) });
  const blinkAt = (seed) => ((t + (seed & 7) * 0.37) % 4.3) < 0.13;
  // en gäst: stol, kropp (före bordet) och arm (efter bordet); dir 1 = väster om bordet, vänd österut
  const guest = (d, dir, act, seat, off) => {
    const L = uteLook(uteSeed(st, d, seat)), p = act ? uteAct(act, t + off) : null, bl = blinkAt(L.id) ? 1 : 0;
    const ox = d.cx - dir * 12 + (dir < 0 ? -1 : 0), oy = d.F - 8;
    return {
      p, L,
      body(ctx) {
        uteDraw(ctx, uteSpr(`chS|${dir}`, 14, 24, 7, 13, (s) => chairSide(flipS(s, dir))), ox, oy);
        if (p) uteDraw(ctx, uteSpr(`S|${L.id}|${p}|b|${bl}|${dir}`, 28, 28, 14, 20, (s) => uteSide(flipS(s, dir), L, p, 'body', bl)), ox, oy);
      },
      arm(ctx) { if (p) uteDraw(ctx, uteSpr(`S|${L.id}|${p}|a|${dir}`, 28, 28, 14, 20, (s) => uteSide(flipS(s, dir), L, p, 'arm')), ox, oy); },
    };
  };
  for (const d of UTE.bord) {
    const har = O.gaster && uteHar(st, d);
    out.push({ y: d.F + 0.5, kind: 'bistrobord', draw: (ctx) => {
      if (d.norr) uteDraw(ctx, uteSpr('chB', 14, 22, 7, 13, (s) => chairBehind(s)), d.cx, d.F - 13);   // den lediga stolen
      const off = (d.F % 11) * 0.53;
      const W = guest(d, 1, har ? d.vast : null, 1, off), E = d.kind === 'duo' ? guest(d, -1, har ? d.ost : null, 2, d.ost === d.vast ? off : off + 2.1) : null;
      W.body(ctx); if (E) E.body(ctx);
      uteDraw(ctx, uteSpr('bord' + (snow ? 's' : ''), 14, 17, 7, 15, (s) => uteTable(s, snow)), d.cx, d.F);
      // dukningen: värmeljuset bakom tallrikarna, sedan flaskor, mat och glas
      const ljus = uteLjus(d, har);
      if (ljus !== null) {
        uteDraw(ctx, uteSpr('ljus', 3, 16, 0, 15, (s) => uteCandle(s, 0)), d.cx + ljus, d.F);
        if (uteKvall(st) && O.gaster) { ctx.fillStyle = Math.sin(t * 9 + d.cx + d.F) > -0.6 ? '#ffe070' : '#ffb040'; ctx.fillRect(d.cx + ljus, d.F - 15, 1, 1); }
      }
      if (har) {
        if (d.id === 'b') {
          uteDraw(ctx, uteSpr('flaska', 3, 22, 0, 21, (s) => uteBottle(s, 0, 0x2a5a2a)), d.cx + 3, d.F);
          const pz = utePizza('b', t, st);
          uteDraw(ctx, uteSpr(`mat|pizza|${pz}`, 10, 18, 4, 16, (s) => utePlate(s, 0, 'pizza', pz)), d.cx, d.F);
          if (W.p !== 'toast' && W.p !== 'clink' && W.p !== 'drink') uteDraw(ctx, uteSpr('vin', 3, 18, 0, 16, (s) => wineGlass(s, 0, -12)), d.cx - 5, d.F);
          if (E.p !== 'toast' && E.p !== 'clink' && E.p !== 'drink') uteDraw(ctx, uteSpr('vin', 3, 18, 0, 16, (s) => wineGlass(s, 0, -12)), d.cx + 1, d.F);
        } else if (d.id === 'a') {
          uteDraw(ctx, uteSpr('mat|pasta|3', 10, 18, 4, 16, (s) => utePlate(s, 0, 'pasta', 3)), d.cx - 3, d.F);
          const pz = utePizza('a', t, st);
          uteDraw(ctx, uteSpr(`mat|pizza|${pz}`, 10, 18, 4, 16, (s) => utePlate(s, 0, 'pizza', pz)), d.cx + 2, d.F);
        } else if (d.id === 'c') {
          const pz = utePizza('c', t, st);
          uteDraw(ctx, uteSpr(`mat|pizza|${pz}`, 10, 18, 4, 16, (s) => utePlate(s, 0, 'pizza', pz)), d.cx - 1, d.F);
          if (W.p !== 'beer') uteDraw(ctx, uteSpr('ol', 3, 18, 0, 16, (s) => beerGlass(s, 0, -12)), d.cx - 5, d.F);
          uteDraw(ctx, uteSpr('ol', 3, 18, 0, 16, (s) => beerGlass(s, 0, -12)), d.cx + 2, d.F);
        } else {
          const pz = hash(uteSitt(st, d), st.env?.day ?? 1, 919) > 0.5 ? 3 : 2;            // bordet för en: halväten pizza
          uteDraw(ctx, uteSpr(`mat|pizza|${pz}`, 10, 18, 4, 16, (s) => utePlate(s, 0, 'pizza', pz)), d.cx - 2, d.F);
          uteDraw(ctx, uteSpr('lask', 3, 22, 0, 21, (s) => uteBottle(s, 0, 0x8a4a1a)), d.cx + 2, d.F);
        }
      }
      W.arm(ctx); if (E) E.arm(ctx);
      if (d.id === 'b' && W.p === 'clink') {                                             // det klingar när glasen möts
        const on = Math.floor(t * 12) & 1; ctx.fillStyle = on ? '#ffffff' : '#fff4c0';
        ctx.fillRect(d.cx, d.F - 25, 1, 1); if (on) { ctx.fillRect(d.cx - 1, d.F - 26, 1, 1); ctx.fillRect(d.cx + 1, d.F - 26, 1, 1); ctx.fillRect(d.cx, d.F - 27, 1, 1); }
      }
      if (d.kind === 'duo') uteDraw(ctx, uteSpr(`par|${d.skarm}|${O.parasoll ? 1 : 0}|${snow ? 1 : 0}`, 30, 50, 3, 46, (s) => uteParasol(s, 14, d.skarm, O.parasoll, snow)), d.cx - 14, d.F + 1);
    } });
  }
  // servitören
  const ky = O.gaster ? kyparLage(t, st) : null;
  if (ky && ky.x !== undefined) {
    out.push({ y: ky.y + 0.3, kind: 'servitör', draw: (ctx) => uteDraw(ctx, uteSpr(`kypare|${ky.fr}|${ky.pose}|${ky.dir}`, 30, 32, 15, 29, (s) => uteWaiter(flipS(s, ky.dir), ky.fr, ky.pose)), ky.x, ky.y) });
  }
  return out;
}
// var värmeljuset står (x relativt bordets mitt) eller null: mitt bak på duobordens
// skiva, på bordet för en bara när ingen sitter där (då står läskflaskan där)
function uteLjus(d, har) { return d.kind === 'duo' ? -1 : har ? null : 2; }
const uteKvall = (st) => st.hour >= 18.5 && st.hour < 23;
// kvällsljusen: värmeljusen på borden och glödlamporna längs parasollens fåll
function uteGlow(ctx, st, k) {
  const O = uteOpen(st), t = st.t;
  if (!uteKvall(st)) return;
  for (const d of UTE.bord) {
    const lx = uteLjus(d, O.gaster && uteHar(st, d));
    if (lx !== null && O.gaster) {
      const f = 0.75 + 0.25 * Math.sin(t * 7 + d.cx + d.F);
      ctx.fillStyle = rgba(0xffb050, (0.36 * k * f).toFixed(3)); ctx.fillRect(d.cx + lx - 2, d.F - 18, 5, 5);
      ctx.fillStyle = rgba(0xff9030, (0.12 * k * f).toFixed(3)); ctx.fillRect(d.cx + lx - 7, d.F - 19, 15, 10);
    }
    if (d.kind === 'duo' && O.parasoll) {                        // glödlampsslinga längs fållen
      const y = d.F - 31;
      for (let x = -10; x <= 10; x += 3) { const on = ((((x + 12) / 3) | 0) + Math.floor(t * 2.5)) % 3 !== 0; ctx.fillStyle = rgba(0xfff0b0, ((on ? 0.6 : 0.22) * k).toFixed(3)); ctx.fillRect(d.cx + x, y, 1, 1); }
      ctx.fillStyle = rgba(0xffe0a0, (0.07 * k).toFixed(3)); ctx.fillRect(d.cx - 11, y + 1, 22, 26);
    }
  }
}

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
  if (spec.obstacles) art.obstacles = (b) => spec.obstacles(b);
  return [k, art];
}));
