// SÖDER: fasadkonst för den södra husraden (radhus, pizzeria, posten,
// djuraffären, bion, kyrkan, vårdcentralen, Tornhuset, bensinmacken) och de
// fristående husen i parken (toalett, lekförråd, musikpaviljong – kiosken är
// glasståndet i props.js; se PARKENS SMÅHUS sist i filen). Husen byggs på fasadlådan (facade-kit.js: tak, väggytor,
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
    // butiken: snackshyllor på bakväggen, kyldisken med flaskor, kassadisken med
    // biträdet i röd keps, korvgrillen med snurrande korvar och kassaapparaten
    base(0xe4e6ea, 0xb8bcc2, 17);
    for (let j = 17; j < h; j++) for (let x = ((j - 17) & 1) * 2; x < w; x += 4) P.px(x, j, mul(0x8a8e96, dim), 0.5);   // klinkerfogarna
    for (let s = 0; s < 2; s++) {                                                     // snackshyllorna
      const sy = 3 + s * 5;
      P.hl(1, sy + 3, 11, mul(0x8a8a90, dim));
      for (let i = 0; i < 5; i++) { const c = [0xd83a2a, 0xffd23f, 0x2a8a3a, 0x2a5ad0, 0xf05a8a][(i + s) % 5]; P.rect(1 + i * 2, sy, 2, 3, mul(c, dim)); P.px(1 + i * 2, sy, mul(mix(c, WHITE, 0.4), dim)); }
    }
    P.box(14, 2, 9, 15, mul(0x8a8a90, dim));                                          // kyldisken lyser kallt
    area(P, 15, 3, 7, 13, (X, Y, i, j) => qmix(mul(0xa0d8e8, dim + 0.12), mul(0x4a7a9a, dim), j / 13, X, Y, 3));
    for (let r = 0; r < 3; r++) { P.hl(15, 6 + r * 4, 7, mul(0xd8e4ea, dim + 0.1)); for (let i = 0; i < 7; i += 2) P.rect(15 + i, 4 + r * 4, 1, 2, mul([0xd83a2a, 0x2a8a3a, 0xf0c030, 0x2a5ad0][(i + r) & 3], dim + 0.1)); }   // flaskorna
    P.vl(18, 3, 13, mul(0x8a8a90, dim));                                              // dörrarnas list
    // biträdet bakom disken: röd keps, ansikte, röd tröja
    P.hl(4, 7, 5, 0xc9323a); P.hl(3, 8, 7, 0xa82830); P.px(8, 8, 0xc9323a);
    P.rect(4, 9, 5, 4, mul(0xeabf98, dim + 0.15)); P.px(5, 10, 0x2a1a14); P.px(7, 10, 0x2a1a14); P.px(6, 12, mul(0xb86a5a, dim + 0.1));
    P.rect(3, 13, 7, 3, mul(0xc9323a, dim + 0.05));
    // kassadisken: ljus skiva, röd front med vitt band, kassaapparaten och korvgrillen
    P.hl(0, 14, 13, mul(0xf0f0f2, dim + 0.1)); P.hl(0, 15, 13, mul(0xb8bcc2, dim));
    area(P, 0, 16, 13, 5, (X, Y, i, j) => mul(j === 1 ? 0xf4f1ea : 0xd8342c, dim * (j === 4 ? 0.8 : 1)));
    P.rect(1, 11, 3, 3, mul(0x2a2c30, dim + 0.1)); P.px(2, 12, 0x60c0ff);             // kassaapparaten
    P.rect(9, 12, 4, 2, mul(0xb0b4ba, dim + 0.1)); P.hl(9, 12, 4, 0xc8342a); P.px(10, 13, 0xd8703a); P.px(12, 13, 0xd8703a);   // korvgrillen
  } else if (k === 'radhus') {
    base(0xe8d8b8, 0xa08868, 16);
    for (let j = 3; j < 15; j += 4) P.hl(0, j, w, mul(0xc8a878, dim), 0.5);           // randiga tapeten
    for (let s = 0; s < 4; s++) { const sx = w - 4 - s * 3, sy = 16 - s * 3; P.rect(sx, sy, 6, 2, mul(0xb89a74, dim)); P.hl(sx, sy, 6, mul(0xd8c8a0, dim)); } // trappan
    P.rect(2, 6, 2, 6, mul(0xc8342a, dim)); P.rect(5, 6, 2, 6, mul(0x2a5ad0, dim)); P.hl(1, 5, 7, mul(0x6a4a2a, dim)); // jackorna i hallen
  } else if (k === 'toalett') {
    area(P, 0, 0, w, h, (X, Y, i, j) => (j >= 18 ? mul(0x9ab0a8, dim) : mul((j % 4) === 3 || (X % 4) === 3 ? 0x8aa098 : 0xd8e8e0, dim)));
    P.rect(3, 6, 4, 5, mul(0xa8c8d0, dim)); P.box(3, 6, 4, 5, mul(0x6a8a90, dim));    // spegeln
    P.rect(w - 5, 12, 4, 4, mul(0xf4f7fa, dim));                                      // handfatet
  } else if (k === 'lekforrad') {
    // ljus furupanel inuti: hinkar och bollar på hyllorna, en rockring på väggen, badboll och hink på golvet
    base(0xd8b888, 0x8a7050, 18);
    for (let x = 3; x < w; x += 4) P.vl(x, 0, 18, mul(0xa88a5a, dim), 0.6);
    for (const sy of [6, 12]) { P.hl(1, sy, w - 2, mul(0x8a6a3a, dim)); P.hl(1, sy + 1, w - 2, 0x000000, 0.25); }
    [0xe03a2a, 0x2a8ad8, 0xffd23f, 0x3aa84a].forEach((c, i) => { P.rect(1 + i * 3, 3, 2, 3, mul(c, dim)); P.px(1 + i * 3, 3, mul(mix(c, WHITE, 0.4), dim)); });
    [0xe8342a, 0xf8f4ea, 0x2a7ad8].forEach((c, i) => { P.rect(2 + i * 4, 9, 3, 3, mul(c, dim)); P.px(2 + i * 4, 9, mul(mix(c, WHITE, 0.5), dim)); });
    for (let a = 0; a < 16; a++) P.px(Math.round(w - 4 + Math.cos((a / 16) * Math.PI * 2) * 2.5), Math.round(4 + Math.sin((a / 16) * Math.PI * 2) * 2.5), mul(0xf05a8a, dim)); // rockringen
    P.ell(4, h - 7, 3, 3, mul(0xd83a2a, 0.9), 1, 1); P.px(3, h - 8, mul(0xf4f1ea, 0.9)); // badbollen
    P.rect(w - 6, h - 11, 4, 5, mul(0x2a8ad8, 0.9)); P.hl(w - 7, h - 12, 6, mul(0x60b0f0, 0.9)); // hinken
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
  // (Söder ska vara helt: brandväggarnas mörka streck gick tvärs genom fasaden och
  // skylten som sprickor, mittenhusets färg tvättade ur skylten och dörren, och
  // halva bottenvåningsfönster stack fram bakom dörrar och husnummer. Nu syns
  // brandväggarna bara som murade krön på taket, bara putsen får husets färg och
  // bottenvåningen har dörrar, lampor och brevlådor men inga halvskymda fönster.)
  radhus: {
    wall: 0xe4d49c, wallKind: 'plaster', roof: 'gable', roofCol: 0x8a3a2a, ground: 'plain', frame: 0xf4f1ea, signBg: 0x4a6a3a, signFg: 0xf4f1ea, doorCol: 0x3a5a8a, groundH: 30, floorH: 24,
    extra(P, K) {
      const tints = [0xe4d49c, 0xc8d8c0, 0xe8c0a8], doors = [0x8a3a2a, 0x3a5a8a, 0x2a6a4a];
      const snow = !!(K.opts && K.opts.snow);
      if (snow) snoTak(P, K);                                         // slätt snötak i stället för prickigt tegel
      // fasadlådans puts på (x, y) – bara de pixlarna får radhusets egen färg
      const puts = (x, y) => { let c = WALLS.plaster(x, y, K.wall, K.seed); if (x === K.fx0) c = mix(c, WHITE, 0.14); else if (x >= K.fx1 - 2) c = mul(c, x === K.fx1 - 1 ? 0.72 : 0.86); return c; };
      // tre radhus i olika färger, brandväggar emellan, takkupor och skorstenar
      for (let u = 0; u < 3; u++) {
        const x0 = K.fx0 + u * 44, x1 = x0 + 44;
        if (u !== 0) for (let y = K.ftop + 4; y < K.baseY - 5; y++) for (let x = x0; x < x1 && x < K.fx1; x++) { const c = P.get(x, y); if (c === puts(x, y)) P.px(x, y, mix(c, tints[u], 0.35)); }
        if (u < 2) {                                                  // brandväggens murade krön över takfallet (vintertid: snö på krönet, blå skugga bredvid)
          for (let y = K.rtop + 1; y < K.ftop; y++) {
            P.px(x1 - 2, y, snow ? (y & 1 ? 0xf6f9fe : 0xeaf0f8) : jit(0xb8a488, x1 - 2, y, K.seed + 3, 0.06));
            P.px(x1 - 1, y, jit(0x8a7862, x1 - 1, y, K.seed + 3, 0.06)); P.px(x1, y, snow ? 0xaab6ca : 0x5a4a3a);
          }
          P.hl(x1 - 3, K.rtop, 5, 0xd8ccb8); P.hl(x1 - 3, K.rtop + 1, 5, 0x9a8a74); P.px(x1 + 1, K.rtop + 1, 0x5a4a3a);
          P.px(x1 + 1, K.rtop + 2, 0x000000, 0.25);
          if (snow) { P.hl(x1 - 3, K.rtop - 1, 5, 0xeef2f8); P.hl(x1 - 3, K.rtop, 5, WHITE); P.hl(x1 - 2, K.rtop - 2, 3, 0xf6f9fe); }
        }
        // takkupa (vintertid med snö på det lilla sadeltaket)
        const kx = x0 + 15, ky = K.rtop + 8;
        P.rect(kx, ky, 14, 12, mix(tints[u], WHITE, 0.2)); P.vl(kx, ky, 12, 0xfff8ea); P.vl(kx + 13, ky, 12, mul(tints[u], 0.7));
        for (let r = 0; r < 5; r++) P.hl(kx - 1 + (4 - r), ky - 5 + r, 16 - 2 * (4 - r), snow ? [WHITE, 0xf6f9fe, 0xeef2f8, 0xe2e9f3, 0xcdd6e4][r] : r === 0 ? 0xf4ecdc : 0x7a3226);
        if (snow) { P.px(kx - 1, ky - 1, 0xb8c2d4); P.px(kx + 14, ky - 1, 0xb8c2d4); P.hl(kx - 1, ky + 12, 16, 0xf6f9fe); }
        windowAt(P, kx + 3, ky + 3, 8, 7, { night: K.night, lit: K.night && hash(u, 3, K.seed) > 0.4, frame: 0xf4f1ea, sill: 0xd8d0c0 });
        if (K.night && hash(u, 3, K.seed) > 0.4) K.lit.push([kx + 3 + K.box.x, ky + 3 + K.box.y, 8, 7]);
        chimney(P, x0 + 32, K.rtop - 4, K.rtop + 10);
        if (snow) skorstenSno(P, x0 + 32, K.rtop - 4, K.rtop + 10);
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
    // (vintertid – samma gräns som husens snötak, snowCover > 0.5 – ligger snö på gräsmattan,
    // plattgångarna är skottade med snövallar längs kanterna, rabatterna är snötäckta tuvor
    // och häckarna har snö på toppen)
    items(b, st) {
      const out = [];
      if (!b.yard) return out;
      const [x0, y0, x1, y1] = b.yard.rect, W = x1 - x0, H = y1 - y0;
      const snow = (st.env?.weather?.snowCover || 0) > 0.5, key = snow ? '_yardSno' : '_yard';
      if (!SPECS.radhus[key]) {
        const P = new Pix(W, H);
        if (!snow) area(P, 0, 0, W, H, (X, Y) => { const n = hash(X, Y, 301); return n > 0.9 ? 0x6fae4a : n < 0.08 ? 0x3f7a34 : jit(0x5a9a3e, X, Y, 302, 0.08); });
        else area(P, 0, 0, W, H, (X, Y, i, j) => qmix(0xdde5f0, 0xf4f8fe, Math.min(1, j / 6), X, Y, 3));   // snön, blå skugga närmast fasaden
        for (let u = 0; u < 3; u++) {
          const px = u * 44 + 14 + (u === 1 ? 2 : 0), pw = u === 1 ? 16 : 16;
          if (!snow) area(P, px, 0, pw, H, (X, Y, i, j) => (((i >> 2) + (j >> 2)) & 1 ? 0xc8c0b0 : 0xb8b0a0));
          else area(P, px, 0, pw, H, (X, Y, i, j) => (i === 0 || i === pw - 1 ? (i ? 0xd0d9e6 : WHITE) : i === 1 ? 0xc4ccd8 : (((i >> 2) + (j >> 2)) & 1 ? 0xb8bcc6 : 0xaab0bc)));
          for (let k = 0; k < 6; k++) {
            const fx = u * 44 + 3 + ((hash(k, u, 303) * 9) | 0), fy = 3 + ((hash(k, u, 304) * 16) | 0);
            if (!snow) { P.px(fx, fy, FLOWERS[k % FLOWERS.length]); P.px(fx, fy + 1, 0x3f7a34); }
            else if (k < 3) { P.hl(fx - 1, fy, 3, WHITE); P.px(fx, fy - 1, 0xf8fbff); P.hl(fx - 1, fy + 1, 3, 0xc8d2e2); P.px(fx + 1, fy - 1, 0x6a5a48); }  // snötäckt tuva med en kvist
          }
          for (let k = 0; k < 5; k++) {
            const fx = u * 44 + 33 + ((hash(k, u, 305) * 9) | 0), fy = 3 + ((hash(k, u, 306) * 16) | 0);
            if (!snow) { P.px(fx, fy, FLOWERS[(k + 2) % FLOWERS.length]); P.px(fx, fy + 1, 0x3f7a34); }
            else if (k < 2) { P.hl(fx - 1, fy, 3, WHITE); P.px(fx, fy - 1, 0xf8fbff); P.hl(fx - 1, fy + 1, 3, 0xc8d2e2); }
          }
        }
        P.hl(0, H - 1, W, 0x8a8478, 0.5);
        SPECS.radhus[key] = P.flush();
      }
      const img = SPECS.radhus[key];
      out.push({ y: y0 + 0.02, draw: (ctx) => ctx.drawImage(img, x0, y0) });
      for (const [hx0, hy0, hx1, hy1] of b.blocks || []) for (let y = hy0; y < hy1; y += 4) {
        const yy = y, hh = Math.min(4, hy1 - y);
        out.push({ y: yy + hh, draw: (ctx) => {
          for (let j = 0; j < hh; j++) for (let i = -1; i <= hx1 - hx0; i++) {
            const n = hash(hx0 + i, yy + j, 307);
            const c = !snow ? (n > 0.8 ? 0x7fc85a : n < 0.2 ? 0x2e6a2a : 0x4f9a3a)
              : (yy === hy0 && j < 2) || n > 0.5 ? (i === hx1 - hx0 ? 0xc8d2e2 : n > 0.85 ? WHITE : 0xe8eef6) : n < 0.2 ? 0x244a22 : 0x3a6434;
            ctx.fillStyle = rgb(c); ctx.fillRect(hx0 + i, yy + j - 6, 1, 1);
          }
        } });
      }
      return out;
    },
  },
  // ================= PIZZERIA NAPOLI =================
  // Skylten PIZZERIA NAPOLI (Carl: "fin men har bruna streck mitt i skylten") är en
  // egen emaljskylt i krämvitt med röda bokstäver, grön och röd kant och en
  // trikolor underkant. Den sitter fritt mellan fönsterraden och markisen:
  // blomlådorna som låg tvärs över texten sitter nu under varje fönster på
  // översta våningen, och skylten slutar på x 243 så att trafikljuset vid
  // Postgatan (x 246–260) inte skymmer den. På kvällen lyser bokstäverna skarpt och
  // neonskenet ligger runt skylten (inte som en ruta över texten). Gatuplanets
  // kvällsljus ritas med körsbärsträdets krona urklippt.
  pizzeria: {
    wall: 0xe8c89a, wallKind: 'plaster', roof: 'gable', roofCol: 0x9a4a32, ground: 'shop', awning: 0x2a8a3a, frame: 0x5a3a2a, floorH: 24, noSign: true,
    _ROD: [[0xf0604a, 0xd8342c, 0xd8342c, 0xb8281e, 0x9a1a14], [0xffb0a0, 0xff6a50, 0xff5a40, 0xf04a30, 0xd83a26]],
    extra(P, K) {
      const snow = !!(K.opts && K.opts.snow);
      if (snow) snoTak(P, K);                                         // slätt snötak i stället för prickigt tegel
      // markisen i grönt-vitt-rött (vintertid med snö på ovankanten)
      for (let y = K.gtop - 1; y < K.gtop + 6; y++) for (let x = K.fx0 - 2; x < K.fx1 + 2; x++) { const s = Math.floor((x - K.fx0) / 5) % 3; if (s === 2) P.px(x, y, mul(0xd83a2a, y === K.gtop + 5 ? 0.75 : 1)); }
      if (snow) for (let x = K.fx0 - 2; x < K.fx1 + 2; x++) { P.px(x, K.gtop - 1, x & 1 ? WHITE : 0xf2f6fc); P.px(x, K.gtop, hash(x, 1, 981) > 0.3 ? 0xe8eef6 : 0xdce4ee); if (hash(x, 2, 982) > 0.7) P.px(x, K.gtop + 1, 0xe0e8f2); }
      // gröna fönsterluckor i trä på båda sidor om övervåningarnas fönster; blomlådor
      // under varje fönster på översta våningen (våningen närmast skylten har inga)
      const G = winGrid(K, SPECS.pizzeria), low = Math.max(...G.map((g) => g[5]));
      for (const [wx, wy, ww, wh, k, f] of G) {
        for (const sx of [wx - 5, wx + ww + 2]) { for (let j = 0; j < wh + 2; j++) P.hl(sx, wy - 1 + j, 3, (j % 3) === 2 ? 0x2e5a2e : 0x3a7a3a); P.vl(sx, wy - 1, wh + 2, 0x4a8a4a); }
        if (f !== low) {
          P.rect(wx - 1, wy + wh + 3, ww + 2, 2, 0x8a5a36); P.hl(wx - 1, wy + wh + 3, ww + 2, 0xb07a4a); P.hl(wx - 1, wy + wh + 5, ww + 2, 0x000000, 0.2);
          for (let i = 0; i < ww + 2; i += 2) { P.px(wx - 1 + i, wy + wh + 2, 0x4f9a3a); if (i & 2) P.px(wx + i, wy + wh + 1, FLOWERS[(i + k * 2) % FLOWERS.length]); else P.px(wx + i, wy + wh + 2, 0x3f7a34); }
        }
      }
      // emaljskylten: krämvit platta, grön vänsterkant, röd högerkant, trikolor underkant
      const s = 'PIZZERIA NAPOLI', sw = textW(SMALL, s) + 8, sh = 11;
      const sx = K.fx0 + 5, sy = K.gtop - 14;
      P.darken(sx + 1, sy + sh, sw, 1, 0.7); P.darken(sx + sw, sy + 1, 1, sh, 0.78);
      area(P, sx, sy, sw, sh, (X, Y, i, j) => {
        if (j === 0) return i < 2 ? 0x2a8a3a : i > sw - 3 ? 0xb82a20 : 0x3a9a4a;
        if (j === sh - 1) return i < sw / 3 ? 0x2a8a3a : i < (sw * 2) / 3 ? 0xf4f1ea : 0xc8342a;
        if (i === 0) return 0x2a8a3a;
        if (i === sw - 1) return 0xa82418;
        if (j === 1) return 0xfffaf0;
        if (j === sh - 2) return 0xd8ccb4;
        return jit(0xf4ecdc, X, Y, K.seed + 83, 0.04);
      });
      skyltText(P, SMALL, s, sx + 4, sy + 3, SPECS.pizzeria._ROD[0], 0xd8ccb4);
      K.out.skylt = [sx + K.box.x, sy + K.box.y, sw, sh];
      K.out.skyltText = [sx + 4 + K.box.x, sy + 3 + K.box.y];
      if (K.opts && K.opts.snow) {
        snoLock(P, sx, sx + sw - 1, sy);
        for (const [wx, wy, ww, wh, k, f] of G) if (f !== low) P.hl(wx - 1, wy + wh + 2, ww + 2, 0xe8eef6);   // snö i blomlådorna
      }
      // vedugnens skorsten (bred, med sotig topp) + pizzabagare-skylt
      chimney(P, K.fx1 - 18, K.rtop - 6, K.rtop + 12, 0x7a6a60);
      P.hl(K.fx1 - 19, K.rtop - 4, 9, 0x2a2420, 0.6);
      if (snow) skorstenSno(P, K.fx1 - 18, K.rtop - 6, K.rtop + 12, true);                 // (varm vedugnsskorsten: bara drivan)
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
      // skyltfönstrens kvällsljus tas över från fasadlådan och ritas i glow() med
      // körsbärsträdets krona urklippt (annars en ljus ruta ovanpå trädet)
      K.out.glas = K.shop.map((r) => r.slice());
      K.shop.length = 0;
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
      if (m.oven && (!b.open || (st.hour >= b.open[0] && st.hour < b.open[1]))) {
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
      const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]), base = baseOf(b);
      // emaljskylten lyser inifrån när det är öppet: bokstäverna skarpa, neonskenet runt skylten
      if (m.skylt && open) {
        const [x, y, w, h] = m.skylt;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(0xfff4e4, (0.8 * k).toFixed(3)); ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        drawSkylt(ctx, SMALL, 'PIZZERIA NAPOLI', SPECS.pizzeria._ROD[1], m.skyltText[0], m.skyltText[1], k);
        ctx.globalCompositeOperation = 'lighter';
        skyltSken(ctx, m.skylt, 0xff7050, 0.2 * k, 3);
      }
      // gatuplanet: skyltfönstren, ugnens glöd och den öppna porten – i en buffert där
      // körsbärsträdets krona klipps ut
      const dof = clamp(st.doorOpen || 0, 0, 1);
      tradfrittSken(ctx, b, st, [b.x - 12, base - 34, b.w + 24, 50], (c) => {
        if (open) for (const [x, y, w, hh] of m.glas || []) {
          c.fillStyle = rgba(0xffe0a0, (0.3 * k).toFixed(3)); c.fillRect(x, y, w, hh);
          c.fillStyle = rgba(0xffc070, (0.12 * k).toFixed(3)); c.fillRect(x - 3, y + hh, w + 6, 10);
        }
        if (m.oven && open) {
          const [x, y, w, h] = m.oven, f = 0.5 + 0.5 * Math.sin(st.t * 3.1);
          c.fillStyle = rgba(0xff8030, (0.25 * k * (0.6 + 0.4 * f)).toFixed(3)); c.fillRect(x, y + h - 9, Math.min(14, w), 9);
        }
        if (dof > 0.2) {                                                                   // varmt sken ur den öppna porten
          const x = b.door.x0, y = base - 26, w = b.door.x1 - b.door.x0;
          c.fillStyle = rgba(0xff9a40, (0.22 * k * dof).toFixed(3)); c.fillRect(x, y, Math.round(w * dof), 26);
          c.fillStyle = rgba(0xff8030, (0.1 * k * dof).toFixed(3)); c.fillRect(x - 2, y + 26, w + 4, 8);
        }
      });
      // värmeljusen och parasollens glödlampor på uteserveringen
      uteGlow(ctx, st, k);
    },
  },
  // ================= POSTEN =================
  // Skylten POSTEN målas här i stället för i fasadlådan: fasadlådans skylt satt så lågt att
  // gatlyktan vid x 330 (huvudet x 336–343, y 607–611, skenet x 332–347, y 605–616) låg i
  // dess nedre vänstra hörn och nattskenet nådde P:et. Nu sitter emaljskylten på x 343–385,
  // y 594–607 med bokstäverna på y 598–604 – fri från både lykthuvud och ljussken.
  posten: {
    wall: 0xe8dcc0, wallKind: 'plaster', roof: 'flat', ground: 'shop', noSign: true, frame: 0x1a3a8a, floorH: 24,
    extra(P, K) {
      // emaljskylten: gul platta i tre toner, blå ram med ljus innerkant, präglade blå versaler
      const ss = 'POSTEN', sw = textW(BIG, ss) + 6, sh = 12, sx = K.X(344), sy = K.gtop - 15;
      P.darken(sx, sy + sh + 1, sw + 1, 1, 0.72); P.darken(sx + sw + 1, sy, 1, sh + 1, 0.8);        // skuggan på putsen
      P.box(sx - 1, sy - 1, sw + 2, sh + 2, 0x1a3a8a); P.hl(sx - 1, sy - 1, sw + 2, 0x3a5aaa);
      area(P, sx, sy, sw, sh, (X, Y, i, j) => (j === 0 ? 0xfff0a0 : j === sh - 1 ? 0xc8a020 : i === 0 ? 0xffe070 : i === sw - 1 ? 0xd8b028 : j === sh - 2 ? 0xf0c434 : jit(0xffd23f, X, Y, K.seed + 71, 0.03)));
      skyltText(P, BIG, ss, sx + 3, sy + 3, [0x2a4aa0, 0x1a3a8a, 0x1a3a8a, 0x1a3a8a, 0x163280, 0x122a70, 0x10245a], 0xc8a020);
      if (K.opts && K.opts.snow) for (let x = sx - 1; x <= sx + sw; x++) {                      // snö på ramens överkant (i lä under fönsterbrädorna)
        P.px(x, sy - 2, hash(x, 3, 961) > 0.75 ? WHITE : 0xe8eef6);
        if (hash(x, 4, 962) > 0.8) P.px(x, sy - 1, 0xdce4ee);
      }
      // posthornet bredvid skylten: gul emaljskiva med blått posthorn (den mjuka
      // dithrade cirkeln såg ut som en grå fläck på putsen)
      const cx = K.fx1 - 12, cy = K.gtop - 8;
      ['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'].forEach((r, j) => {
        for (let i = 0; i < 9; i++) if (r[i] === '#') {
          const edge = j === 0 || i === 0 || (j < 2 && (i < 2 || r[i - 1] === '.')), dark = j === 8 || i === 8 || (j > 6 && (i > 6 || r[i + 1] === '.'));
          P.px(cx - 4 + i, cy - 4 + j, edge ? 0xfff0a0 : dark ? 0xc8a020 : 0xffd23f);
        }
      });
      for (const [i, j] of [[-2, -1], [-1, -1], [-3, 0], [0, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [2, -1], [2, 1]]) P.px(cx + i, cy + j, 0x1a3a8a);
      P.px(cx + 5, cy - 3, 0x000000, 0.25); P.vl(cx + 5, cy - 2, 5, 0x000000, 0.25); P.hl(cx - 2, cy + 5, 7, 0x000000, 0.25);
      // gul brevlåda (riks) och blå (lokal) till vänster om dörren
      const bx = K.dx - 20, by = K.baseY - 22;
      for (const [x, c, hi] of [[bx, 0xffd23f, 0xfff0a0], [bx + 10, 0x2a5ad0, 0x7a9af0]]) {
        P.rect(x, by, 8, 14, c); P.hl(x, by, 8, hi); P.vl(x + 7, by, 14, mul(c, 0.6)); P.hl(x, by + 13, 8, mul(c, 0.6));
        P.rect(x + 1, by + 3, 6, 1, 0x1a1a1a); P.rect(x + 1, by + 6, 6, 3, mul(c, 0.8)); P.box(x + 1, by + 6, 6, 3, mul(c, 0.55));
        P.rect(x + 1, by + 14, 6, 8, 0x4a4a52); P.vl(x + 1, by + 14, 8, 0x6a6a72);
        P.hl(x - 1, by + 22, 10, 0x000000, 0.3);
      }
      // posthornet på lådorna (ordet POST fick inte plats på den smala lådan och bröts sönder)
      for (const [x, c] of [[bx + 1, 0x1a3a8a], [bx + 11, 0xffd23f]]) {
        P.hl(x + 1, by + 10, 2, c); P.px(x, by + 11, c); P.px(x + 3, by + 11, c); P.hl(x + 4, by + 11, 2, c); P.hl(x + 1, by + 12, 2, c); P.px(x + 5, by + 10, c); P.px(x + 5, by + 12, c);
      }
      // klocka och öppettider
      const kx = K.dx + K.dw + 8, ky = K.baseY - 31;                                     // (skarp urtavla – den dithrade cirkeln såg ut som en fläck; under skylten)
      const rund = (d, x0, y0, fn) => { const n = d.length; d.forEach((r, j) => { for (let i = 0; i < n; i++) if (r[i] === '#') P.px(x0 + i, y0 + j, fn(i, j, n)); }); };
      rund(['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'], kx, ky, (i, j) => (j < 2 && i < 5 ? 0x3a5aaa : j > 6 || i > 7 ? 0x10245a : 0x1a3a8a));
      rund(['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'], kx + 1, ky + 1, (i, j) => (j > 4 && i > 3 ? 0xd8d4cc : 0xf4f1ea));
      for (const [i, j] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) P.px(kx + 4 + i, ky + 4 + j, 0x8a94b0);
      P.px(kx + 9, ky + 3, 0x000000, 0.25); P.vl(kx + 9, ky + 4, 4, 0x000000, 0.25); P.hl(kx + 3, ky + 9, 6, 0x000000, 0.25);
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
      const prat = djurPratare(b, st);                                                // gatuprataren vid kantstenen (PARKENS SMÅHUS i slutet av filen)
      if ((st.env?.weather?.snowCover || 0) > 0.35) return prat;
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
      return [{ y: y0 - 0.6, draw: (ctx) => ctx.drawImage(img, cx - 16, y0) }, ...prat];
    },
    obstacles(b) { return djurPratareHinder(b); },                                    // gatupratarens fötter
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
      for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {                 // urtavlan med skarpa ringar (de dithrade kanterna såg frynsiga ut)
        const d = Math.hypot(dx, dy);
        if (d > 8.8) continue;
        P.px(ck.x + dx, ck.y + dy, d <= 6.6 ? (dx + dy > 5 ? 0xe0dcd2 : 0xf4f1ea) : d <= 7.7 ? (dx + dy < -4 ? 0xf8d860 : dx + dy > 4 ? 0xb89020 : 0xe8c040) : 0x2a2a30);
      }
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
      // (tornkroppen målades över fasadlådans dörr – porten stod som en tom ljus panel)
      // djup smyg i sten i två språng, glasmålning i bågfältet och dubbeldörr i mörk ek
      const pdx = K.dx, pdw = K.dw, pdy = K.baseY - 26, pmx = pdx + (pdw >> 1);
      area(P, pdx - 5, K.baseY - 28, pdw + 10, 28, (X, Y, i) => (i < 2 ? 0xd0c8b8 : i < 5 ? 0xb4ac9c : i >= pdw + 8 ? 0x8a8272 : i >= pdw + 5 ? 0x9a9282 : null));
      P.hl(pdx - 5, K.baseY - 28, pdw + 10, 0xe0d8c8); P.rect(pdx - 1, pdy - 2, pdw + 2, 2, 0xc8c0b0); P.hl(pdx - 1, pdy - 2, pdw + 2, 0xe8e0d0);
      for (let j = 0; j < 8; j++) for (let i = -8; i <= 8; i++) {                           // bågfältets glasmålning (halvcirkel)
        const d = Math.hypot(i + 0.5 * Math.sign(i), (8 - j) * 1.05);
        if (d > 8.2) continue;
        const X = pmx + i, Y = K.baseY - 37 + j, spoke = Math.abs(i) === Math.round((8 - j) * 0.6) || i === 0;
        P.px(X, Y, d > 7.2 ? 0x8a8070 : spoke ? 0x3a3a40 : K.night ? ((i + j) & 1 ? 0xe8a850 : 0xc84a3a) : ((i * 3 + j) % 5 === 0 ? 0xc84a5a : (i + j) & 1 ? 0x3a5a9a : 0xe8c050));
      }
      area(P, pdx, pdy, pdw, 26, (X, Y, i, j) => {
        const half = i < (pdw >> 1) ? i : i - (pdw >> 1);
        let c = jit(0x5a3018, X, Y, K.seed + 21, 0.07);
        if ((half % 4) === 3) c = mul(c, 0.7);                                               // plankfogarna
        else if ((half % 4) === 0) c = mix(c, WHITE, 0.08);
        if (i === (pdw >> 1) - 1) c = 0x2a160a;                                              // mittfogen
        if (j === 0) c = mul(c, 0.6);
        if (j === 5 || j === 19) c = 0x2a2a30; else if (j === 6 || j === 20) c = 0x4a4a52; // smidesband
        return c;
      });
      for (const [bx, by] of [[pdx + 1, pdy + 5], [pdx + pdw - 2, pdy + 5], [pdx + 1, pdy + 19], [pdx + pdw - 2, pdy + 19]]) P.px(bx, by, 0x8a8a92);   // spikhuvuden
      for (const hx of [pmx - 3, pmx + 2]) { P.px(hx, pdy + 12, 0x2a2a30); P.px(hx - 1, pdy + 13, 0x2a2a30); P.px(hx + 1, pdy + 13, 0x2a2a30); P.px(hx, pdy + 14, 0x2a2a30); P.px(hx, pdy + 13, 0x9a9aa2); } // ringhandtagen
      P.hl(pdx - 2, K.baseY, pdw + 4, 0xc8c0b0); P.hl(pdx - 2, K.baseY + 1, pdw + 4, 0x8a8272);  // stentröskeln
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
      if (m.clock) drawHalo(ctx, 0xfff0c0, m.clock.x, m.clock.y, 10, 10, 0.3 * k);             // runt sken kring den upplysta urtavlan (inte en fyrkant)
    },
  },
  // ================= VÅRDCENTRALEN =================
  // Huvudskylten VÅRDCENTRALEN (Carl: "halvt övertäckt av ett grått fält" – entréns
  // glastak låg tvärs över texten) är en egen ljuslåda i vit emalj med gröna
  // bokstäver, fri mellan fönsterraden och glastaket, som nu sitter lågt över
  // skjutdörren. Ambulansintaget har en riktig liten BLÅLJUSLYKTA och en RÖD
  // jourlampa ovanför porten (den svävande blå rutan är borta): jourlampan lyser
  // när mottagningen är stängd, blåljuset pulserar långsamt i mörkret och skenet
  // ritas runt lamporna – porten och skylten skyms aldrig.
  vardcentral: {
    wall: 0xe4e8ec, wallKind: 'concrete', roof: 'flat', ground: 'shop', groundH: 34, frame: 0x8a9aa8, winW: 14, winSp: 20, floorH: 24, noSign: true,
    _GRON: [[0x3aa050, 0x3aa050, 0x2a8a40, 0x2a8a40, 0x2a7a3a, 0x1e6a30, 0x1e6a30], [0x5ad070, 0x5ad070, 0x44b858, 0x44b858, 0x34a048, 0x2a8a3c, 0x2a8a3c]],
    // blåljusets kupol: [dx, dy, ton] – ton 0 ljus, 1 mitt, 2 skugga, 3 glans
    _KUPOL: [[2, 0, 0], [3, 0, 0], [4, 0, 0], [1, 1, 0], [2, 1, 1], [3, 1, 1], [4, 1, 1], [5, 1, 2], [1, 2, 1], [2, 2, 1], [3, 2, 3], [4, 2, 1], [5, 2, 2]],
    _BLA: [[0x8ab0f0, 0x3a6ad0, 0x1e3a8a, 0xd8e6ff], [0xe0ecff, 0x7ab0ff, 0x4a80ff, 0xffffff]],
    _ROD: [[0xc85a4a, 0xa8342a, 0x7a1a14], [0xffd0c0, 0xff6a50, 0xe8402a]],
    extra(P, K) {
      const V = SPECS.vardcentral;
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
        P.rect(x + w - 6, y + h - 2, 5, 2, 0x1a1a1a); P.rect(x + w - 5, y + h - 1, 3, 1, 0xd8342c); // stopplyktor på porten
        // blåljuslyktan på portens karm: blå kupol med glans på svart fot och ett litet fäste
        const bl = x + w - 11, bt = y - 8;
        for (const [ix, iy, t] of V._KUPOL) P.px(bl + ix, bt + iy, V._BLA[0][t]);
        P.hl(bl, bt + 3, 7, 0x1a1a1e); P.px(bl, bt + 3, 0x3a3a40); P.px(bl + 6, bt + 3, 0x0a0a0c);
        P.hl(bl + 1, bt + 4, 5, 0x6a7078); P.px(bl + 1, bt + 4, 0x9aa0a8); P.px(bl + 3, bt + 5, 0x4a4e56);
        P.px(bl + 7, bt + 2, 0x000000, 0.2); P.hl(bl + 1, bt + 5, 2, 0x000000, 0.15);
        K.out.blue = { x: bl + K.box.x, y: bt + K.box.y };
        // röd jourlampa: vägglykta med plåthuv, röd lins och fäste
        const rl = x + w - 24, rt = y - 7;
        P.hl(rl - 1, rt, 7, 0x8a9098); P.px(rl - 1, rt, 0xb8bec6); P.px(rl + 5, rt, 0x5a6068);
        P.rect(rl, rt + 1, 5, 3, 0x2a2a30);
        for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) P.px(rl + 1 + i, rt + 1 + j, V._ROD[0][Math.min(2, i + j)]);
        P.px(rl + 2, rt + 4, 0x4a4e56); P.hl(rl + 1, rt + 4, 1, 0x000000, 0.2);
        K.out.jour = { x: rl + 1 + K.box.x, y: rt + 1 + K.box.y };
      }
      // entrétak i glas lågt över skjutdörren (under skylten), med två stag mot väggen
      const cy0 = K.baseY - 33, cx0 = K.dx - 8, cw = K.dw + 10;
      for (const sx of [cx0 + 2, cx0 + cw - 3]) { P.vl(sx, cy0 - 4, 4, 0x6a7078); P.px(sx, cy0 - 5, 0x9aa0a8); }
      P.hl(cx0, cy0, cw, 0xeef2f6); area(P, cx0, cy0 + 1, cw, 1, (X, Y) => jit(0xa8c4d8, X, Y, 14, 0.06)); P.hl(cx0, cy0 + 2, cw, 0x6a7078);
      P.px(cx0, cy0 + 1, 0x8a9aa8); P.px(cx0 + cw - 1, cy0 + 1, 0x8a9aa8);
      P.hl(cx0 + 1, cy0 + 3, cw - 1, 0x000000, 0.25);
      // persienner i vartannat fönster, en rullstolsramp med räcke
      for (const [wx, wy, ww, wh, k, f] of winGrid(K, SPECS.vardcentral)) if (hash(k, f, K.seed + 9) > 0.45) { const n = 3 + ((hash(k, f, K.seed + 8) * (wh - 4)) | 0); for (let j = 1; j < n; j += 2) P.hl(wx + 1, wy + j, ww - 2, 0xd8dce0, 0.75); P.hl(wx + 1, wy + n, ww - 2, 0x8a9aa8, 0.6); }
      P.rect(K.fx0 + 2, K.baseY - 6, K.dx - K.fx0 - 8, 6, 0xb8bcc4); P.hl(K.fx0 + 2, K.baseY - 6, K.dx - K.fx0 - 8, 0xe0e4e8);
      for (let x = K.fx0 + 3; x < K.dx - 6; x += 5) P.vl(x, K.baseY - 12, 6, 0x6a7078); P.hl(K.fx0 + 3, K.baseY - 12, K.dx - K.fx0 - 9, 0x8a9098);
      // taket: ventilationsaggregat, helikopter-H och parabol
      P.rect(K.fx0 + 20, K.rtop + 6, 26, 10, 0xb8bcc4); P.hl(K.fx0 + 20, K.rtop + 6, 26, 0xe0e4e8); P.vl(K.fx0 + 45, K.rtop + 6, 10, 0x6a7078); for (let i = 0; i < 3; i++) P.ell(K.fx0 + 25 + i * 8, K.rtop + 11, 2.5, 2, 0x3a3e48, 1, 1);
      P.ell(K.fx1 - 30, K.rtop + 12, 12, 8, 0xd8342c, 1, 1); P.ell(K.fx1 - 30, K.rtop + 12, 10, 6, 0x7a7670, 1, 1); text(P, BIG, 'H', K.fx1 - 32, K.rtop + 9, 0xf4f1ea);
      vent(P, K.fx0 + 60, K.rtop + 12); vent(P, K.fx0 + 70, K.rtop + 12);
      // huvudskylten: ljuslåda i vit emalj med grön ram och gröna bokstäver (y 590–602 i
      // världen – under fönsterraden, ovanför glastaket och gatlyktans arm)
      const s = 'VÅRDCENTRALEN', sw = textW(BIG, s) + 12, sh = 13;
      const sx = K.fx0 + (K.b.w >> 1) - (sw >> 1), sy = K.baseY - 50;
      P.darken(sx + 1, sy + sh, sw, 1, 0.78); P.darken(sx + sw, sy + 1, 1, sh, 0.84);        // skuggan på betongen
      area(P, sx, sy, sw, sh, (X, Y, i, j) => {
        if (j === 0) return i === sw - 1 ? 0x2a7a3a : 0x4aa05a;
        if (j === sh - 1) return i === 0 ? 0x2a7a3a : 0x164a22;
        if (i === 0) return 0x3a904a;
        if (i === sw - 1) return 0x1e5a2a;
        if (j === 1) return 0xd0d8dc;                                                    // ramens skugga på emaljen
        return qmix(0xf8fafc, 0xe2e8ec, (j - 2) / (sh - 3), X, Y, 3);
      });
      skyltText(P, BIG, s, sx + 6, sy + 4, V._GRON[0], 0xc4d0d6);
      K.out.skylt = [sx + K.box.x, sy + K.box.y, sw, sh];
      K.out.skyltText = [sx + 6 + K.box.x, sy + 4 + K.box.y];
      // vinter: snö på skylten, glastaket, korset och portens lampor
      if (K.opts && K.opts.snow) {
        snoLock(P, sx, sx + sw - 1, sy);
        for (let x = cx0; x < cx0 + cw; x++) P.px(x, cy0 - 1, hash(x, cy0, 966) > 0.8 ? WHITE : 0xe8eef6);
        snoLock(P, cx - 6, cx + 6, cy - 2); snoLock(P, cx - 2, cx + 2, cy - 6);
        if (K.out.blue) { const bx = K.out.blue.x - K.box.x, by = K.out.blue.y - K.box.y; P.hl(bx + 2, by - 1, 3, 0xe8eef6); P.px(bx + 3, by - 1, WHITE); }
        if (K.out.jour) { const jx = K.out.jour.x - K.box.x, jy = K.out.jour.y - K.box.y; P.hl(jx - 2, jy - 2, 7, 0xe8eef6); }
      }
    },
    live(ctx, b, st, m) {
      const V = SPECS.vardcentral, dk = clamp((st.env?.dark ?? (st.night ? 0.5 : 0)) / 0.5, 0, 1);
      const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
      // jourlampan lyser röd när mottagningen är stängd (då har akuten jour)
      if (m.jour && !open) for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { ctx.fillStyle = rgb(V._ROD[1][Math.min(2, i + j)]); ctx.fillRect(m.jour.x + i, m.jour.y + j, 1, 1); }
      // blåljuset pulserar långsamt i mörkret (diskret, inget stroboskop)
      if (m.blue && dk > 0.05 && V._puls(st.t) > 0.45) for (const [ix, iy, t] of V._KUPOL) { ctx.fillStyle = rgb(V._BLA[1][t]); ctx.fillRect(m.blue.x + ix, m.blue.y + iy, 1, 1); }
    },
    _puls: (t) => 0.5 + 0.5 * Math.sin(t * 3.6),
    glow(ctx, b, st, k, m) {
      const V = SPECS.vardcentral;
      // korset lyser: skarpt tänt kors och ett runt grönt sken
      if (m.cross) {
        const f = 0.85 + 0.15 * Math.sin(st.t * 4), { x, y } = m.cross;
        drawHalo(ctx, 0x40ff70, x, y, 10, 10, 0.3 * k * f);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = clamp(0.9 * k, 0, 1);
        ctx.fillStyle = '#6aea8a'; ctx.fillRect(x - 1, y - 5, 3, 11); ctx.fillRect(x - 5, y - 1, 11, 3);
        ctx.fillStyle = '#b8ffc8'; ctx.fillRect(x, y - 4, 1, 9); ctx.fillRect(x - 4, y, 9, 1);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
      }
      // ljuslådan: emaljen lyser inifrån, bokstäverna skarpa ovanpå, skenet runt lådan
      if (m.skylt) {
        const [x, y, w, h] = m.skylt;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(0xf6fbff, (0.85 * k).toFixed(3)); ctx.fillRect(x + 1, y + 2, w - 2, h - 3);
        drawSkylt(ctx, BIG, 'VÅRDCENTRALEN', V._GRON[1], m.skyltText[0], m.skyltText[1], k);
        ctx.globalCompositeOperation = 'lighter';
        skyltSken(ctx, m.skylt, 0xd8ffe4, 0.14 * k, 3);
      }
      // jourlampan och blåljuset: skenet runt lamporna (porten och texten lämnas fria)
      const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
      if (m.jour && !open) drawHalo(ctx, 0xff4a30, m.jour.x + 1, m.jour.y + 1, 5, 4, (0.34 + 0.06 * Math.sin(st.t * 1.3)) * k);
      if (m.blue) { const p = clamp((V._puls(st.t) - 0.35) / 0.65, 0, 1); drawHalo(ctx, 0x3a7aff, m.blue.x + 3, m.blue.y + 1, 6, 4, 0.5 * k * p); drawHalo(ctx, 0x2a5aff, m.blue.x + 3, m.blue.y + 1, 11, 6, 0.14 * k * p); }
    },
  },
  // ================= TORNHUSET =================
  // Tegelhuset med takvåningen. Namnskylten (Carl: "TORNHUSET ser trasig/utsträckt
  // ut" – baldakinen låg tvärs över texten och balkongerna stack fram bakom den) är
  // en mörk platta med mässingsbokstäver i spelets typsnitt, fritt ovanför entrén:
  // balkongerna på våningen närmast är borta, entrétaket sitter lågt över dörren och
  // skylten slutar ovanför körsbärets krona (y 605) och gatlyktornas armar. På natten
  // lyser bokstäverna skarpt och skenet ligger runt plattan. Parabolerna är små
  // riktiga paraboler på balkongräckena (fasadlådans grå prickar såg ut som fläckar).
  tornhuset: {
    wall: 0x9a5a44, wallKind: 'brick', roof: 'flat', ground: 'house', balcony: true, floorH: 20, frame: 0xf0ece0, noSign: true,
    _MASS: [[0xf6e2a0, 0xf6e2a0, 0xd8b058, 0xd8b058, 0xd8b058, 0xa47a30, 0xa47a30], [0xfff4c8, 0xfff0b8, 0xf8d878, 0xf0c860, 0xf0c860, 0xd8a848, 0xc89a40]],
    extra(P, K) {
      const T = SPECS.tornhuset, brick = (X, Y) => WALLS.brick(X, Y, K.wall, K.seed);
      // våningen närmast entrén: balkongerna (och tvättlådorna på dem) bort – där sitter
      // skylten. Fönstren målas om hela; övriga våningar får en parabol här och där.
      const G = winGrid(K, T), low = Math.max(...G.map((g) => g[5]));
      for (const [wx, wy, ww, wh, k, f] of G) {
        if ((k & 1) !== 0) continue;
        const bx = wx - 3, by = wy + wh + 3, bw = ww + 6;
        if (f === low) {
          area(P, bx, by, bw, 7, brick);
          area(P, wx - 1, wy + wh, 4, 3, brick);
          windowAt(P, wx, wy, ww, wh, { night: K.night, lit: K.night && hash(k, f, K.seed + 50) > 0.42, frame: T.frame, curtain: hash(k, f, K.seed + 51) > 0.5 ? 0xc85a4a : 0xe8d8a8 });
        } else if (hash(k, f, K.seed + 57) > 0.66) {
          const px = wx + ww + 1, py = by - 6;                                          // parabolen på en stång vid räckets hörn
          P.hl(px, py, 3, 0xdcdcd8); P.px(px + 3, py, 0x9a9aa2);
          P.px(px - 1, py + 1, 0xdcdcd8); P.hl(px, py + 1, 2, 0xfafaf6); P.px(px + 2, py + 1, 0xe8e8e4); P.px(px + 3, py + 1, 0x8a8a92);
          P.hl(px, py + 2, 3, 0xb8b8c0); P.px(px + 3, py + 2, 0x7a7a82); P.px(px - 1, py + 2, 0x4a4a50);   // matarhornet till vänster
          for (let j = 3; j <= 6; j++) P.px(px + 2, py + j, j === 3 ? 0x7a7a82 : 0x5a5a60);
          P.px(px + 3, py + 4, 0x000000, 0.25);
        }
      }
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
      // namnskylten: mörk platta med fasad kant, två mässingsskruvar och mässingsbokstäver
      // (y 594–605 i världen: mellan fönsterraden och entrétaket, fri från trädkronan)
      const s = 'TORNHUSET', sw = textW(BIG, s) + 10, sh = 12;
      const sx = K.dx + (K.dw >> 1) - (sw >> 1), sy = K.baseY - 46;
      P.darken(sx + 1, sy + sh, sw, 1, 0.6); P.darken(sx + sw, sy + 1, 1, sh, 0.7);        // skuggan på teglet
      area(P, sx, sy, sw, sh, (X, Y, i, j) => {
        if (j === 0) return i === 0 ? 0x6a6460 : 0x5a5450;                                 // ljus överkant
        if (j === sh - 1) return i === 0 ? 0x2a2624 : 0x0c0a0a;                            // mörk underkant
        if (i === 0) return 0x46423e;
        if (i === sw - 1) return 0x141212;
        return jit(j === 1 ? 0x302c2a : 0x221f1e, X, Y, K.seed + 81, 0.07);
      });
      skyltText(P, BIG, s, sx + 5, sy + 2, T._MASS[K.night ? 1 : 0], 0x0c0a0a);
      for (const bx of [sx + 2, sx + sw - 3]) { P.px(bx, sy + 5, 0xe8c870); P.px(bx, sy + 6, 0x8a6a2a); P.px(bx + 1, sy + 6, 0x0c0a0a); }
      K.out.skylt = [sx + K.box.x, sy + K.box.y, sw, sh];
      K.out.skyltText = [sx + 5 + K.box.x, sy + 2 + K.box.y];
      // entrétaket i stål lågt över dörren, med en downlight i undersidan
      const cy0 = K.baseY - 33, cx0 = K.dx - 5, cw = K.dw + 8;
      P.hl(cx0, cy0, cw, 0xb8b8c0); P.px(cx0, cy0, 0xe0e0e8); P.hl(cx0, cy0 + 1, cw, 0x6a6a72); P.hl(cx0, cy0 + 2, cw, 0x2a2a30);
      P.hl(cx0 + 1, cy0 + 3, cw - 1, 0x000000, 0.3);
      const lx = K.dx + (K.dw >> 1);
      P.hl(lx - 1, cy0 + 2, 2, K.night ? 0xfff0c0 : 0x9a9aa0);
      K.out.dlamp = [lx + K.box.x, cy0 + 3 + K.box.y];
      // husnummer i blå emalj till höger om dörren och porttelefonen under det
      const nx = K.dx + K.dw + 5, ny = K.baseY - 31;
      P.rect(nx, ny, 7, 8, 0x1f4f9a); P.box(nx, ny, 7, 8, 0xeef2f8); P.hl(nx + 1, ny + 1, 5, 0x3a6ab8); text(P, SMALL, '9', nx + 2, ny + 2, WHITE);
      P.px(nx + 7, ny + 1, 0x000000, 0.3); P.hl(nx + 1, ny + 8, 7, 0x000000, 0.3);
      P.rect(K.dx + K.dw + 4, K.baseY - 21, 6, 10, 0xb4b8c2); P.hl(K.dx + K.dw + 4, K.baseY - 21, 6, 0xdcdfe6); P.vl(K.dx + K.dw + 9, K.baseY - 20, 9, 0x7a7e88);
      P.px(K.dx + K.dw + 6, K.baseY - 19, 0x3ac05a); for (let j = 0; j < 3; j++) P.hl(K.dx + K.dw + 5, K.baseY - 16 + j * 2, 3, 0x2a2e38);
      // vinter: snö på skylten, entrétaket, husnumret och balkongräckena
      if (K.opts && K.opts.snow) {
        snoLock(P, sx, sx + sw - 1, sy);
        for (let x = cx0; x < cx0 + cw; x++) P.px(x, cy0 - 1, hash(x, cy0, 965) > 0.8 ? WHITE : 0xe8eef6);
        snoLock(P, nx, nx + 6, ny);
        for (const [wx, wy, ww, wh, k, f] of G) if ((k & 1) === 0 && f !== low) snoLock(P, wx - 3, wx + ww + 2, wy + wh + 3);
      }
    },
    glow(ctx, b, st, k, m) {
      // namnskylten: bokstäverna lyser skarpt (inga rutor över texten), skenet runt plattan
      if (m.skylt) {
        ctx.globalCompositeOperation = 'source-over';
        drawSkylt(ctx, BIG, 'TORNHUSET', SPECS.tornhuset._MASS[1], m.skyltText[0], m.skyltText[1], 0.9 * k);
        ctx.globalCompositeOperation = 'lighter';
        skyltSken(ctx, m.skylt, 0xffc870, 0.16 * k, 3);
      }
      if (m.dlamp) {                                                                       // downlighten i entrétaket lyser på dörren
        ctx.fillStyle = rgba(0xfff0c0, (0.8 * k).toFixed(3)); ctx.fillRect(m.dlamp[0] - 1, m.dlamp[1] - 1, 2, 1);
        drawHalo(ctx, 0xffd890, m.dlamp[0], m.dlamp[1] + 9, 12, 9, 0.22 * k);
      }
      if (!m.beacon) return;
      const on = Math.floor(st.t * 1.2) % 2 === 0;                                         // flygvarningsljuset på masten
      drawHalo(ctx, 0xff3a2a, m.beacon.x, m.beacon.y, 4, 4, (on ? 0.75 : 0.15) * k);
      ctx.fillStyle = rgba(0xff3a2a, (on ? 1 : 0.3).toFixed(2)); ctx.fillRect(m.beacon.x, m.beacon.y, 1, 1);
    },
  },
  // ================= PIXELMACKEN =================
  // Ett riktigt tankställe: butik med biltvätt bakom ett tak på pelare, två
  // pumpöar, prisskylt vid trottoaren och bilar som kommer och tankar – se
  // BENSINMACKEN (mackFasad/mackLive/mackGlow/mackItems) före BUILDING_ART.
  bensinmack: {
    wall: 0xeceef0, wallKind: 'metal', roof: 'flat', roofCol: 0x74726c, ground: 'plain', groundH: 30, noSign: true, frame: 0x3a3e46, doorCol: 0x4a4e56,
    extra(P, K) { mackFasad(P, K); },
    live(ctx, b, st, m) { mackLive(ctx, b, st, m); },
    glow(ctx, b, st, k, m) { mackGlow(ctx, b, st, k, m); },
    items(b, st) { return mackItems(b, st); },
    obstacles() { return mackHinder(); },
  },
  // ================= PARKEN =================
  // (kiosken ritar ingenting – glasståndet i props.js står på dess plats; se PARKENS SMÅHUS i slutet av filen)
  // toaletten och lekförrådet målas från grunden i wcFasad/lekFasad (PARKENS SMÅHUS i slutet av filen)
  toalett: {
    wall: 0x2f7050, wallKind: 'wood', roof: 'none', ground: 'plain', noSign: true, floorH: 200, doorCol: 0x245a40,
    extra(P, K) { wcFasad(P, K); },
    glow(ctx, b, st, k, m) { wcGlow(ctx, b, st, k, m); },
  },
  lekforrad: {
    wall: 0x6496c0, wallKind: 'wood', roof: 'none', ground: 'plain', noSign: true, floorH: 200, doorCol: 0xe4b030,
    extra(P, K) { lekFasad(P, K); },
  },
  // musikpaviljongen: öppen åttkantig paviljong med musikkår – målas i pavFasad/pavLive/pavGlow
  // (PARKENS SMÅHUS i slutet av filen); dörren slår aldrig upp (se överstyrningen där)
  paviljong: {
    wall: 0xf0e8d8, wallKind: 'wood', roof: 'none', ground: 'plain', noSign: true, floorH: 200,
    extra(P, K) { pavFasad(P, K); },
    live(ctx, b, st, m) { pavLive(ctx, b, st, m); },
    glow(ctx, b, st, k, m) { pavGlow(ctx, b, st, k, m); },
  },
};

// =====================================================================
// SÖDERS SKYLTAR, LAMPOR OCH KVÄLLSLJUS (Tornhuset, vårdcentralen, pizzerian …)
// Skyltbokstäverna är spelets typsnitt (SMALL/BIG) men med metallkänsla: en
// färg per versalrad (ljus överkant → mörk nederkant) och en präglad skuggpixel
// snett nedåt höger. Sken ritas alltid RUNT en skylt (ljusramar utanför
// plattan) eller som skarpa tända bokstäver – aldrig som en halvgenomskinlig
// ruta över texten.
// =====================================================================
const SKYLT_MASK = new Map(), SKYLT_SPR = new Map(), HALO = new Map();
// vilka pixlar texten tänder (ritas en gång i en osynlig buffert). j < 0 = prickar/ringar ovanför versalhöjden
function skyltMask(F, s) {
  const key = (F === BIG ? 'B' : 'S') + s;
  let m = SKYLT_MASK.get(key);
  if (m) return m;
  const up = 2, w = textW(F, s), T = new Pix(w + 1, F.h + up + 1);
  text(T, F, s, 0, up, 0xffffff);
  const on = (i, j) => i >= 0 && i < w && j >= -up && j < F.h && T.d[((j + up) * (w + 1) + i) * 4 + 3] > 0;
  m = { w, up, on };
  SKYLT_MASK.set(key, m);
  return m;
}
// (x, y) = versalhöjdens övre vänstra hörn som för text(); rows = färgen per versalrad
// uppifrån (ringar/prickar ovanför tar första färgen); shadow = den präglade skuggan
function skyltText(P, F, s, x, y, rows, shadow) {
  const M = skyltMask(F, s), row = (j) => rows[clamp(j, 0, rows.length - 1)];
  if (shadow !== undefined) for (let j = -M.up; j <= F.h; j++) for (let i = 0; i <= M.w; i++) if (M.on(i - 1, j - 1) && !M.on(i, j)) P.px(x + i, y + j, shadow);
  for (let j = -M.up; j < F.h; j++) for (let i = 0; i < M.w; i++) if (M.on(i, j)) P.px(x + i, y + j, row(j));
}
// samma bokstäver som sprite (tända skyltar i glow – skarpa pixlar, ingen ruta)
function drawSkylt(ctx, F, s, rows, x, y, a = 1) {
  if (a <= 0.004) return;
  const M = skyltMask(F, s), key = (F === BIG ? 'B' : 'S') + s + ':' + rows.join(',');
  let c = SKYLT_SPR.get(key);
  if (!c) { const P = new Pix(M.w + 1, F.h + M.up + 1); skyltText(P, F, s, 0, M.up, rows); c = P.flush(); SKYLT_SPR.set(key, c); }
  ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(c, Math.round(x), Math.round(y) - M.up); ctx.globalAlpha = 1;
}
// sken RUNT en skylt: ljusramar utanför plattan som klingar av utåt (aldrig över texten)
function skyltSken(ctx, r, c, a, pad = 3) {
  const [x, y, w, h] = r;
  for (let d = 1; d <= pad; d++) {
    ctx.fillStyle = rgba(c, (a * (1 - (d - 1) / pad)).toFixed(3));
    ctx.fillRect(x - d, y - d, w + 2 * d, 1); ctx.fillRect(x - d, y + h - 1 + d, w + 2 * d, 1);
    ctx.fillRect(x - d, y - d + 1, 1, h + 2 * d - 2); ctx.fillRect(x + w - 1 + d, y - d + 1, 1, h + 2 * d - 2);
  }
}
// mjukt runt ljussken kring en lampa (kvantiserad, dithrad ellips som sprite)
function drawHalo(ctx, c, cx, cy, rx, ry, a) {
  if (a <= 0.004) return;
  const key = c + ':' + rx + ':' + ry;
  let s = HALO.get(key);
  if (!s) { const P = new Pix(rx * 2 + 1, ry * 2 + 1); P.ell(rx + 0.5, ry + 0.5, rx + 0.5, ry + 0.5, c, 1, 4); s = P.flush(); HALO.set(key, s); }
  ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(s, Math.round(cx) - rx, Math.round(cy) - ry); ctx.globalAlpha = 1;
}
// Gatuträden framför ett hus (props.js: stammens hinder [x − 2, y − 2, x + 3, y + 1] på
// kantstenen) och en mask som täcker både lindens och körsbärets krona (mjuk kant).
// Gatuplanets kvällsljus ritas i en egen buffert där kronorna suddas ut först – annars
// hamnar ljuset som en hård ruta ovanpå trädet som står framför fönstret.
const TRAD_MEMO = new Map(), GLOWBUF = new Map();
function gatutrad(b, env) {
  const obs = env?.obstacles;
  if (!obs) return [];
  const hit = TRAD_MEMO.get(b.id);
  if (hit && hit.obs === obs && hit.n === obs.length) return hit.list;
  const base = Math.max(baseOf(b), b.yard ? b.yard.rect[3] : 0), list = [];            // (förgård/trädgård: trottoaren börjar där den slutar)
  for (const o of obs) {
    if (!Array.isArray(o) || o[2] - o[0] !== 5 || o[3] - o[1] !== 3) continue;
    const tx = o[0] + 2, ty = o[1] + 2;
    if (tx > b.x - 26 && tx < b.x + b.w + 26 && ty > base + 12 && ty < base + 40) list.push([tx, ty]);
  }
  TRAD_MEMO.set(b.id, { obs, n: obs.length, list });
  return list;
}
function kronMask() {
  let M = HALO.get('krona');
  if (M) return M;
  const P = new Pix(48, 42);                                                            // (i, j) ↔ världen (tx − 24 + i, ty − 70 + j)
  for (let j = 0; j < 42; j++) for (let i = 0; i < 48; i++) {
    const ex = Math.abs((i + 0.5 - 24) / 23), ey = Math.abs((j + 0.5 - 21) / 19.5);
    const e = Math.pow(Math.pow(ex, 2.2) + Math.pow(ey, 2.2), 1 / 2.2), a = clamp((1.02 - e) / 0.2, 0, 1);
    if (a > 0) P.px(i, j, 0xffffff, a);
  }
  M = P.flush(); HALO.set('krona', M);
  return M;
}
// draw(c) ritar ljuset i världskoordinater (additivt); rect = buffertens yta i världen
function tradfrittSken(ctx, b, st, rect, draw) {
  const [x, y, w, h] = rect;
  let B = GLOWBUF.get(b.id);
  if (!B || B.w !== w || B.h !== h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; B = { cv, c: cv.getContext('2d'), w, h }; GLOWBUF.set(b.id, B); }
  const c = B.c;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
  c.setTransform(1, 0, 0, 1, -x, -y); c.globalCompositeOperation = 'lighter';
  draw(c);
  if ((st.env?.weather?.season || 'sommar') !== 'vinter') {                              // (vinterns kala krona skymmer inget)
    const trees = gatutrad(b, st.env);
    if (trees.length) { c.globalCompositeOperation = 'destination-out'; const M = kronMask(); for (const [tx, ty] of trees) c.drawImage(M, tx - 24, ty - 70); }
  }
  c.globalCompositeOperation = 'source-over'; c.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(B.cv, x, y);
}
// snölock på en skylts eller listens överkant: två rader med rundade ändar, några
// toppar och en och annan droppe som hänger över kanten (canvas-y = kantens rad)
function snoLock(P, x0, x1, y) {
  for (let x = x0; x <= x1; x++) {
    const ande = x === x0 || x === x1;
    P.px(x, y - 1, hash(x, y, 961) > 0.8 ? WHITE : 0xe8eef6);
    if (!ande) P.px(x, y - 2, hash(x, y, 962) > 0.55 ? 0xf4f8ff : 0xdce4ee);
    if (!ande && x > x0 + 1 && x < x1 - 1 && hash(x, y, 963) > 0.72) P.px(x, y - 3, 0xf4f8ff);
    if (hash(x, y, 964) > 0.86) P.px(x, y, 0xdce4ee, 0.85);
  }
}
// Snötak på ett sadeltak (radhusen, pizzerian). Fasadlådans snö är slumpade prickar där
// teglet lyser igenom – det såg smutsigt och trasigt ut. Här ligger ett slätt snötäcke i
// 3–4 toner: bortre takfallet i blå skugga, nocken ljusast, främre takfallet vitt ner mot
// takfoten, takpannornas rader som jämna mjuka åsar, en tjock snökant över takfoten och
// glesa istappar. Fasadlådans takhuvar målas om på samma ställen med snöhätta.
function snoTak(P, K) {
  const { fx0, fx1, rtop, ftop, b } = K, mid = rtop + (((ftop - rtop) * 0.42) | 0);
  for (let y = rtop; y < ftop; y++) for (let x = fx0; x < fx1; x++) {
    const ry = (y - rtop) % 4, rad = ((y - rtop) / 4) | 0;
    let c;
    if (y < mid) c = qmix(0xc2ccdc, 0xd8e0ec, (y - rtop) / Math.max(1, mid - rtop), x, y, 3);
    else if (y === mid) c = 0xfafcff;
    else c = qmix(0xf6f9fe, 0xe0e7f2, (y - mid) / Math.max(1, ftop - 2 - mid), x, y, 3);
    if (y !== mid && y < ftop - 3 && (rad & 1)) { if (ry === 3) c = mul(c, 0.955); else if (ry === 0) c = mix(c, WHITE, 0.45); }   // var annan pannrad anas
    if (y === ftop - 3) c = mix(c, WHITE, 0.3);
    else if (y === ftop - 2) c = WHITE;                                                 // snökanten över takfoten
    else if (y === ftop - 1) c = 0xcdd6e4;
    if (x === fx0) c = mix(c, WHITE, 0.35); else if (x === fx1 - 1) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  const nv = Math.max(1, (b.w / 40) | 0);                                               // (samma platser som fasadlådans takhuvar)
  for (let k = 0; k < nv && ftop - rtop > 12; k++) {
    const vx = fx0 + 6 + ((hash(k, K.seed, 41) * (b.w - 18)) | 0), vy = rtop + 3 + ((hash(k, K.seed, 42) * Math.max(1, ftop - rtop - 14)) | 0);
    area(P, vx, vy - 6, 6, 8, (X, Y, i) => [0xa85a40, 0x9a4e38, 0x8a4a34, 0x8a4a34, 0x6e3a28, 0x5a2a1c][i]);
    P.hl(vx - 1, vy - 7, 8, 0x5a5250); P.hl(vx - 1, vy - 8, 8, WHITE); P.hl(vx, vy - 9, 6, 0xeef2f8);
    P.hl(vx - 1, vy + 1, 8, 0xf6f9fe); P.hl(vx - 2, vy + 2, 10, 0xe8eef6); P.vl(vx + 6, vy - 5, 5, 0xb8c2d4);
  }
  for (let x = fx0 + 3; x < fx1 - 3; x += 6 + ((hash(x, 7, 971) * 4) | 0)) {           // istappar
    P.px(x, ftop, 0xeaf4ff); P.px(x + 1, ftop, 0xc8dcee);
    if (hash(x, 8, 972) > 0.45) P.px(x, ftop + 1, 0xd4e6f6);
  }
}
// snö på en skorsten: hätta på plåthuven mellan rökrören och en driva där den möter taket.
// warm = vedugnens sotiga skorsten, där snön smälter bort överst
function skorstenSno(P, x, top, bot, warm = false) {
  if (!warm) {
    P.hl(x - 1, top, 9, WHITE);
    for (const i of [-1, 0, 3, 6, 7]) P.px(x + i, top - 1, 0xeef2f8);
    for (const fx of [x + 1, x + 4]) P.hl(fx, top - 3, 2, WHITE);
  }
  P.hl(x - 1, bot - 1, 9, 0xf6f9fe); P.hl(x - 2, bot, 11, 0xe8eef6); P.px(x + 7, bot - 2, 0xd4dcea);
}

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
// öppettiderna (map.js: open [12, 24]); ljusskylten, BIO-neonen, affischlamporna,
// POPCORN och kassan lyser bara när bion har öppet (släckt 00–12), filmen flimrar
// i salongsgluggarna 18.30–00.45 (sista föreställningen går ut)
const bioOppen = (b, h) => !b.open || (h >= b.open[0] && h < b.open[1]);
const bioLyser = (b, h) => bioOppen(b, h);
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
  // (fyra rutor à 3 rader, y 83–101: ljusskylten sitter från y 104 så att POPCORN får plats under den)
  const slits = [];
  for (const sx of [64, 124]) {
    P.rect(sx - 1, 83, 7, 18, CREAM); P.hl(sx - 1, 83, 7, 0xfff4e0); P.vl(sx + 5, 84, 15, mul(CREAM, 0.72));
    area(P, sx, 84, 5, 15, (X, Y, i, j) => ((j % 4) === 3 || i === 2 ? 0x141020 : qmix(0x3a3450, 0x1a1628, j / 15, X, Y, 3)));
    P.rect(sx - 1, 99, 7, 2, GOLD); P.hl(sx - 1, 99, 7, GOLDL); P.hl(sx - 1, 101, 7, 0x000000, 0.25);
    P.px(sx, 84, WHITE, 0.3); P.px(sx + 1, 85, WHITE, 0.2);
    slits.push([Wx(sx), Wy(84), 5, 15]);
  }
  K.out.slits = slits;
  // solfjädersreliefen ovanför ljusskylten (vilar på skyltens överkant, y 104)
  const scx = 96, scy = 103, R = 20;
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
  // (y 104–139: fyra pixlar högre än förr, så att POPCORN-skylten ryms mellan skyltens
  // högra hörn och gatlyktans huvud – lyktan vid x 770 har huvudet på y 607–611)
  const mx0 = 40, mx1 = 152, my0 = 104, my1 = 140, mw = mx1 - mx0, mh = my1 - my0;
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
  K.out.rubrik = [Wx(hx), Wy(my0 + 5)];                                                  // (släcks i live när bion är stängd)
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
  K.out.rubrikYta = [Wx(mx0 + 4), Wy(my0 + 4), mw - 8, 10];
  K.out.entreYta = [Wx(72), Wy(gtop), 49, 9];
  K.out.bx = box.x; K.out.by = box.y;                                                    // (glow ritar tända delar ur bilden)
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
  K.out.entre = [Wx(96 - (textW(SMALL, es) >> 1)), Wy(gtop + 3)];
  // dörrarna: guldram, mittpost och skjuthandtag i mässing
  P.box(dx - 1, dy - 1, dw + 2, K.dh + 1, GOLD); P.hl(dx - 1, dy - 1, dw + 2, GOLDL);
  P.vl(dx + (dw >> 1), dy, K.dh, GOLD); P.vl(dx + (dw >> 1) - 1, dy, K.dh, GOLDD);
  for (const hx2 of [dx + 4, dx + (dw >> 1) + 4]) { P.hl(hx2, dy + 13, 10, GOLDL); P.hl(hx2, dy + 14, 10, GOLDD); }
  for (const [sx, c] of [[dx + 3, 0xe86a8a], [dx + dw - 8, 0x2a3a6a]]) { P.rect(sx, dy + 4, 5, 6, c); P.box(sx, dy + 4, 5, 6, 0xf4f1ea, 0.7); } // små affischdekaler på glaset
  // röda mattan ut på trottoaren
  P.rect(dx - 2, baseY, dw + 4, 3, 0xa82434); P.hl(dx - 2, baseY, dw + 4, 0xd84454);
  P.vl(dx - 2, baseY, 3, GOLD); P.vl(dx + dw + 1, baseY, 3, GOLD); P.hl(dx - 2, baseY + 3, dw + 4, mul(0xa82434, 0.6));
  // ---- BILJETTLUCKAN väster om entrén: mässingsskylt KASSA, välvd lucka, kassörskan ----
  // (x 657–682: öster om gatlyktans huvud vid x 646–653 och dess sken x 642–657 – inget
  // lykthuvud eller ljussken ligger över texten – och väster om körsbärskronan från x ≈ 679.
  // Skylten visar STÄNGT när bion är stängd, se bioKassaSkylt/bioLive)
  const kx = 25, ky = 161, kw = 24, kh = 16, kc = kx + (kw >> 1);
  bioKassaSkylt(P, kx, gtop, 'KASSA');
  K.out.kassaSkylt = [Wx(kx), Wy(gtop)];
  area(P, kx, ky - 2, kw, kh + 2, (X, Y, i, j) => {
    if (j === 0 && (i < 3 || i > kw - 4)) return null;                                  // välvd överdel
    if (j === 1 && (i < 1 || i > kw - 2)) return null;
    return i === 0 || j <= 1 ? GOLDL : i === kw - 1 ? GOLDD : GOLD;
  });
  const gx0 = kx + 2, gy0 = ky, gw = kw - 4, gh = kh - 3;
  area(P, gx0, gy0, gw, gh, (X, Y, i, j) => (night ? qmix(0xffe4a8, 0xe0a060, j / gh, X, Y, 3) : qmix(0xe8cc98, 0xb08050, j / gh, X, Y, 3)));
  P.rect(gx0 + 1, gy0 + 2, 3, 4, 0x3a6ab0); P.rect(gx0 + gw - 4, gy0 + 2, 3, 4, 0xe85a7a);    // små affischer på bakväggen
  P.hl(gx0 + 1, gy0 + 2, 3, 0x6a9ae0); P.hl(gx0 + gw - 4, gy0 + 2, 3, 0xf890a8);
  // (kassörskan ritas i live() när bion har öppet – annars är rullgardinen nere, se bioKassorska/bioGardin)
  P.ell(gx0 + gw - 3, gy0 + 9, 2, 2, GOLD, 1, 1); P.px(gx0 + gw - 3, gy0 + 9, GOLDD);  // talgallret i glaset
  P.rect(kx - 1, ky + kh - 3, kw + 2, 2, 0xe8e0d0); P.hl(kx - 1, ky + kh - 3, kw + 2, 0xfaf6ee); P.hl(kx - 1, ky + kh - 1, kw + 2, 0x8a7a6a); // marmordisk
  P.rect(kc - 4, ky + kh - 4, 9, 1, 0x1a1014);                                          // pengaluckan
  for (let d = 0; d < 9; d++) P.px(gx0 + 7 + d, gy0 + 10 - d, WHITE, 0.14);
  K.out.kassa = [Wx(gx0), Wy(gy0), gw, gh];
  K.out.kassorska = [Wx(kc), Wy(gy0)];
  // ---- POPCORN: blinkande emaljskylt direkt under ljusskyltens högra hörn (x 768–798,
  // y 595–603) – ovanför gatlyktans huvud (x 776–783, y 607–611) och dess sken (y 605–616)
  // och väster om trafikljuset vid Kyrkogatan (x 803–), så att varken lykthuvud eller
  // ljussken ligger över texten. Popcornmaskinen skymtar i ett glasskåp under skylten
  // och jättestruten står på skåpet, öster om lyktans ljuskägla ----
  const pX = 136, pY = my1 + 1, pW = 31, pH = 9;
  P.rect(pX + 1, pY + pH, pW - 1, 2, 0x000000, 0.3);
  P.rect(pX, pY, pW, pH, 0xc82a20); P.box(pX, pY, pW, pH, 0xfff0c0); P.hl(pX + 1, pY + 1, pW - 2, 0xe84a3a); P.hl(pX + 1, pY + pH - 2, pW - 2, 0x9a1a14);
  P.vl(pX + 1, pY + 2, pH - 4, 0xd83a2e); P.vl(pX + pW - 2, pY + 2, pH - 4, 0xa82018);
  for (let x = pX + 2; x < pX + pW - 1; x += 3) { P.px(x, pY, 0xffe070); P.px(x, pY + pH - 1, 0xffe070); }
  text(P, SMALL, 'POPCORN', pX + 2, pY + 3, 0x5a0e0a); text(P, SMALL, 'POPCORN', pX + 2, pY + 2, 0xffe070);
  K.out.pop = [Wx(pX), Wy(pY), pW, pH];
  const wX = 148, wY = 164, wW = 20, wH = 9;
  const sX = wX + wW - 9, sY = wY - 12;                                                  // strutens nederkant vilar på glasskåpet
  for (let j = 0; j < 8; j++) { const w2 = 7 - (j >> 2); for (let i = 0; i < w2; i++) P.px(sX + i + (j >> 2), sY + 3 + j, ((i + (j >> 2)) & 1) ? 0xf4efe6 : 0xd83a2a); }
  P.vl(sX, sY + 3, 4, 0xa82a20); P.vl(sX + 6, sY + 3, 4, 0x9a1a14);
  for (let i = -1; i <= 7; i++) { const top = sY + 1 - ((hash(i, 5, 712) * 3) | 0) + (i < 0 || i > 6 ? 2 : 0); for (let y = top; y <= sY + 3; y++) P.px(sX + i, y, hash(i, y, 713) > 0.4 ? 0xfff6dc : 0xf0d078); }
  P.px(sX + 2, sY - 1, 0xfffaf0); P.px(sX + 5, sY, 0xfff0c0);
  P.rect(wX - 1, wY - 1, wW + 2, wH + 2, GOLD); P.hl(wX - 1, wY - 1, wW + 2, GOLDL); P.hl(wX - 1, wY + wH, wW + 2, GOLDD);
  P.vl(wX - 1, wY, wH, GOLDL); P.vl(wX + wW, wY, wH, GOLDD);
  P.hl(sX + 7, wY - 1, 2, GOLDD);                                                        // strutens skugga på skåpets list
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
    // skyltarnas överkanter får ett riktigt snölock (två–tre rader, rundade ändar, droppar)
    snoLock(P, mx0 - 2, mx1 + 1, my0);                                                   // ljusskyltens ovankant
    for (const [ax, dir] of [[mx0 + 4, 1], [mx1 - 5, -1]]) sno(ax + dir * 9 - 1, ax + dir * 9 + 1, my0 - 13);
    for (const [x, y] of [[10, 102], [154, 102]]) { snoLock(P, x, x + 8, y); snoLock(P, x + 17, x + 25, y); sno(x + 9, x + 16, y - 4); }  // montrarna + lamporna
    snoLock(P, 72, 120, gtop);                                                           // ENTRÉ-överstycket
    snoLock(P, kx, kx + 25, gtop);                                                       // KASSA-skylten (luckans valv ligger i lä under den)
    snoLock(P, mx1 + 2, pX + pW - 1, pY);                                                // POPCORN: bara biten som sticker ut under ljusskylten
    snoLock(P, bx0, bx0 + 4, by0); snoLock(P, bx0 + bw - 5, bx0 + bw - 1, by0);          // BIO-skyltens axlar bredvid krönet
    sno(wX - 1, sX - 2, wY - 2); sno(sX + 8, wX + wW, wY - 2);                          // popcornskåpet (struten står i mitten)
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
// mässingsskylten över biljettluckan (26 × 9, präglade bokstäver): KASSA när bion har
// öppet, STÄNGT när den är stängd (live() lägger den stängda skylten över den öppna)
function bioKassaSkylt(P, x, y, s) {
  const { GOLD, GOLDL, GOLDD } = BIOC, w = 26, h = 9;
  area(P, x, y, w, h, (X, Y, i, j) => (j === 0 || i === 0 ? GOLDL : j === h - 1 || i === w - 1 ? GOLDD : j === 1 ? mix(GOLD, GOLDL, 0.5) : j === h - 2 ? mul(GOLD, 0.88) : GOLD));
  skyltText(P, SMALL, s, x + ((w - textW(SMALL, s)) >> 1), y + 2, [0x4a2414, 0x3a1a10, 0x3a1a10, 0x2e140c, 0x2e140c], GOLDL);
}
// rullgardinen som är nere när kassan är stängd: mörkröd duk med veck, en biljett i
// mässing mitt på, mässingsstången och dragringen (STÄNGT står på skylten ovanför)
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
  const tx = (w >> 1) - 4, ty = 3;                                                        // biljetten: 9 × 5 med halvrunda hack i kortsidorna
  ['.#######.', '#ooooo:o#', '.ooooo:o.', '#ooooo:o#', '.#######.'].forEach((r, j) => {
    for (let i = 0; i < 9; i++) if (r[i] !== '.') P.px(tx + i, ty + j, r[i] === '#' ? (j === 0 || i === 0 ? GOLDL : GOLDD) : r[i] === ':' ? GOLDD : j === 1 ? 0xf8e4a0 : GOLD);
  });
  P.hl(tx + 1, ty + 5, 8, 0x000000, 0.3);
}
function bioLive(ctx, b, st, m) {
  if (!m.mfalt) return;
  const t = st.t, h = st.hour, open = bioOppen(b, h);
  bioTitlar(ctx, m, t, ['#7a1422', '#1e1a24'], h);
  // stängt (00–12) på natten: nattbildens tända delar målas över i släckt mässing –
  // rubriken BIO PIXEL, BIO-neonens rör, affischlamporna och ENTRÉ-skylten
  if (!open && st.night) {
    const { GOLD, GOLDD } = BIOC;
    if (m.rubrik) ctxText(ctx, BIG, 'BIO PIXEL', m.rubrik[0], m.rubrik[1], rgb(GOLD));
    if (m.bok) ['B', 'I', 'O'].forEach((ch, i) => { const r = m.bok[i]; if (r) ctxText(ctx, BIG, ch, r[0], r[1], '#8a7040', 2); });
    ctx.fillStyle = rgb(0x6a5a44); for (const [lx, ly] of m.affischljus || []) ctx.fillRect(lx, ly, 6, 1);
    if (m.entre) ctxText(ctx, SMALL, 'ENTRÉ', m.entre[0], m.entre[1], rgb(GOLDD));
    if (m.door) { ctx.fillStyle = 'rgba(18,8,14,0.6)'; ctx.fillRect(m.door.x, m.door.y, m.door.w, m.door.h); }   // foajén är mörk
  }
  // glödlamporna: var tredje lampa lyser och mönstret vandrar medsols (släckta när bion är stängd)
  const head = Math.floor(t * 8);
  if (bioLyser(b, h)) {
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
      if (m.kassaSkylt) uteDraw(ctx, uteSpr('kassaskylt|STÄNGT', 26, 9, 0, 0, (s, P) => bioKassaSkylt(P, 0, 0, 'STÄNGT')), m.kassaSkylt[0], m.kassaSkylt[1]);
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

// Kvällsljuset. Allt med text – rubriken BIO PIXEL, BIO-rören, affischerna, POPCORN
// och ENTRÉ – ritas SKARPT ur husbilden ovanpå mörkret (full ljusstyrka, inga
// halvgenomskinliga rutor över texten); skenet ligger runt skyltarna som ljusramar
// och runda sken, och ljuspölarna på fasaden och trottoaren ritas med gatuträdets
// krona urklippt. När bion är stängd (00–12) lyser bara filmen i gluggarna.
function bioGlow(ctx, b, st, k, m) {
  const t = st.t, h = st.hour;
  if (m.slits && bioFilm(h)) for (const [x, y, w, hh] of m.slits) {                   // filmen flimrar i salongsgluggarna (kallt projektorljus)
    const f = 0.55 + 0.45 * Math.abs(Math.sin(t * 7.3 + x) * Math.sin(t * 2.1));
    ctx.fillStyle = rgba(0x9ab8ff, (0.3 * k * f).toFixed(3)); ctx.fillRect(x, y, w, hh);
  }
  if (!bioLyser(b, h)) return;
  // en tänd del ur husbilden (r i världskoordinater), skarp och full ljusstyrka
  const tand = (r, a = 1) => {
    if (!m.cv || !r || m.bx === undefined) return;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = clamp(a * k, 0, 1);
    ctx.drawImage(m.cv, r[0] - m.bx, r[1] - m.by, r[2], r[3], r[0], r[1], r[2], r[3]);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
  };
  const head = Math.floor(t * 8), antal = [1, 2, 3, 3, 0][Math.floor(t * 1.4) % 5], popOn = Math.floor(t * 2.1) % 7 !== 5;
  const ram = (r, p) => [r[0] - p, r[1] - p, r[2] + 2 * p, r[3] + 2 * p];
  // 1) skenet runt skyltarna och lamporna (additivt, utanför texten)
  if (m.marquee) {
    const [x, y, w, hh] = m.marquee;
    ctx.save();                                                                          // (skenet klipps bort över POPCORN-skylten under hörnet)
    if (m.pop) { const [px, py, pw, ph] = m.pop; ctx.beginPath(); ctx.rect(x - 8, y - 8, w + 16, hh + 16); ctx.rect(px - 1, py - 1, pw + 2, ph + 2); ctx.clip('evenodd'); }
    skyltSken(ctx, m.marquee, 0xffd890, 0.16 * k, 4);
    ctx.restore();
    drawHalo(ctx, 0xffc890, x + (w >> 1), y - 14, 46, 18, 0.1 * k);                    // reliefen ovanför lyses upp
  }
  if (m.vneon) skyltSken(ctx, m.vneon, 0xffd040, (antal ? 0.22 : 0.07) * k, 4);
  for (const r of m.montrar || []) skyltSken(ctx, ram(r, 2), 0xffe0a0, 0.1 * k, 3);
  for (const [lx, ly] of m.affischljus || []) drawHalo(ctx, 0xfff0b0, lx + 3, ly - 1, 7, 3, 0.3 * k);
  if (m.pop) skyltSken(ctx, m.pop, 0xffd040, (popOn ? 0.3 : 0.08) * k, 3);
  // 2) ljuspölarna: entrén under ljusskylten, kassaluckan och trottoaren – trädkronan urklippt
  const base = baseOf(b);
  tradfrittSken(ctx, b, st, [b.x - 20, base - 52, b.w + 40, 72], (c) => {
    if (m.marquee && m.entreYta) {
      const [x, y, w, hh] = m.marquee, [ex, , ew] = m.entreYta;
      c.fillStyle = rgba(0xffe8b0, (0.1 * k).toFixed(3)); c.fillRect(ex - 3, y + hh, ew + 6, base - (y + hh));
      c.fillStyle = rgba(0xffe8b0, (0.1 * k).toFixed(3)); c.fillRect(x - 6, base, w + 12, 12);
      c.fillStyle = rgba(0xffe8b0, (0.06 * k).toFixed(3)); c.fillRect(x - 16, base + 12, w + 32, 8);
    }
    if (m.kassa) { const [x, y, w, hh] = m.kassa; c.fillStyle = rgba(0xffc870, (0.1 * k).toFixed(3)); c.fillRect(x - 4, y + hh, w + 8, 12); }
  });
  // 3) det som lyser inifrån, skarpt ovanpå
  if (m.marquee) {
    const [x, y, w] = m.marquee;
    ctx.globalCompositeOperation = 'source-over';                                      // den vita tavlan och titlarna
    ctx.fillStyle = rgba(0xfffaf0, (0.88 * k).toFixed(3)); ctx.fillRect(x + 4, y + 16, w - 8, 15);
    ctx.fillStyle = rgba(0xe8e0d0, (0.88 * k).toFixed(3)); ctx.fillRect(x + 4, y + 23, w - 8, 1);
    bioTitlar(ctx, m, t, [rgba(0x7a1422, k.toFixed(3)), rgba(0x1e1a24, k.toFixed(3))], st.hour);
    ctx.globalCompositeOperation = 'lighter';
    tand(m.rubrikYta);
  }
  if (m.vneon && m.bok) for (let i = 0; i < antal; i++) tand(m.bok[i]);                // bokstäverna tänds i tur: B, BI, BIO, BIO, släckt
  for (const r of m.montrar || []) tand(ram(r, 2), 0.95);                                // affischerna i sina glasmontrar
  ctx.fillStyle = rgba(0xfff4c8, (0.9 * k).toFixed(3)); for (const [lx, ly] of m.affischljus || []) ctx.fillRect(lx, ly, 6, 1);
  if (m.pop) tand(m.pop, popOn ? 1 : 0.4);
  tand(m.entreYta);
  // kassaluckan och popcornskåpet: varmt ljus i glaset (ingen text där)
  if (m.kassa) { const [x, y, w, hh] = m.kassa; ctx.fillStyle = rgba(0xffd890, (0.32 * k).toFixed(3)); ctx.fillRect(x, y, w, hh); }
  if (m.popglas) { const [x, y, w, hh] = m.popglas; ctx.fillStyle = rgba(0xffe0a0, (0.28 * k).toFixed(3)); ctx.fillRect(x, y, w, hh); }
  // 4) glödlamporna som jagar runt ljusskylten och nedför BIO-skylten
  if (m.bulbs) m.bulbs.forEach(([x, y], i) => {
    if (((i - head) % 3 + 3) % 3) return;
    ctx.fillStyle = rgba(0xfff0b0, (0.6 * k).toFixed(3)); ctx.fillRect(x - 1, y - 1, 3, 3);
  });
  if (m.bladeBulbs) m.bladeBulbs.forEach(([x, y], i) => { if ((((i >> 1) - Math.floor(t * 6)) % 4 + 4) % 4) return; ctx.fillStyle = rgba(0xfff0b0, (0.5 * k).toFixed(3)); ctx.fillRect(x - 1, y - 1, 3, 3); });
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

// =====================================================================
// BENSINMACKEN – PIXELMACKEN (Carl: "gör det mer likt en bensinmack … bilar ska
// komma och tanka och det ska ha en stor skylt som visar bensinpriset för bensin
// och diesel"). Ett riktigt tankställe på förgården framför butiken (x 1600–1700,
// y 596–640):
//  · TAKET på två pelare över pumparna (x 1611–1700): röd frontlist där skylten
//    (b.sign) står EN gång i BIG mellan två droppar, LED-list i underkanten och
//    downlights som lyser upp förgården på kvällen. Under taket är marken torr.
//  · TVÅ PUMPÖAR med var sin pump: display där kronorna rullar under tankningen,
//    munstycken i grönt (95) och svart (diesel), kortterminal och slangar.
//  · PRISSKYLTEN (pylonen) vid trottoaren i sydvästra hörnet: varumärket ur
//    b.sign (t.ex. KVÄLLS/MACKEN på två rader), BENSIN 95 och DIESEL med priser
//    i LED-siffror (spelets typsnitt) som ändras lite var tredje timme och en blå
//    BILTVÄTT-panel nederst; lyser hela natten.
//  · Butiken: plåtfasad med rött band, skyltfönster med KAFFE-affisch och varor,
//    glasdörren, biltvätten med rulljalusi (bil och vattendroppar på det blå
//    bandet) och statuslampa, luft/vatten och dammsugare vid västra gaveln, en
//    stående ljuslåda med kaffe och korv på hörnet, fläktar och parabol på taket.
//  · BILARNA ritas som trafikens (traffic.js: karossmask, 3/4-tak, kontur,
//    snurrande fälgar). De kommer ner för Infarten (framifrån), drar sig ut mot
//    kanten och svänger in i det norra körfältet (västerut framför butiken) –
//    svängen vrider bilen kring sin mitt precis som trafikens svängar, och
//    bakänden sticker aldrig ut i det norrgående körfältet. De U-svänger bakom
//    prisskylten, kör österut i det södra körfältet, svänger ut på Infarten och
//    drar sig över till det norrgående körfältet (bakifrån).
//    Varje bil tankar vid en pump: pump 2 från norra körfältet (föraren syns hel
//    mellan bilen och pumpen) eller pump 1 från södra (föraren skymtar bakom
//    bilen). Föraren kliver ur, tar munstycket, siffrorna rullar, hänger upp,
//    betalar i butiken (dörren glider upp, kommer ut med kaffe/korv/tidning) eller
//    med kort vid pumpen, kliver in och bilen kör. Högst en bil i norra körfältet
//    och U-svängen och en i södra, och hörnet mot Infarten har en bil i taget (in
//    ELLER ut) – ingen kör igenom en annan. Bilarna stannar för folk framför sig,
//    väntar in trafiken på Infarten (traffic.vehicles()), håller avstånd till den
//    och kör undan när den kommer bakifrån. Var bilarna står publiceras i env.mack
//    (se mkPublicera) så att trafiken och fotgängarna kan väja för dem.
// Allt rörligt är y-sorterade föremål (items); pumpöarna och prisskyltens stolpe
// är hinder (obstacles).
// =====================================================================
const MK = {
  X0: 1600, X1: 1700, BASE: 596, FRONT: 640,
  YN: 611, YS: 638,                             // körfälten (hjulens markkontakt): norra västerut, södra österut
  XU: 1616,                                     // U-svängens mittlinje (bilen sedd framifrån) bakom prisskylten – bilen vrids kring sin mitt
                                                // här, och det som sticker ut västerut (x < 1615) står bakom prisskyltens låda
  // (öarna står väster om trafikljusstolpen i hörnet – x 1693, y 669 – som annars skymmer pump 2)
  I1: [1632, 615, 1654, 625], I2: [1664, 615, 1686, 625],   // pumpöarna
  P1: 1639, P2: 1666,                           // pumparnas västra kant (pumpen är 14 bred)
  PY: 621,                                      // pumparnas och pelarnas fotlinje (på öarna)
  C1: 1634, C2: 1682,                           // takpelarnas västra kant (3 breda)
  XR1: 1633, XR2: 1668,                         // bilens bakände vid pump 1 (södra, österut) och pump 2 (norra, västerut)
  LS: 1713, LN: 1739,                           // Infartens körfält söderut / norrut
  KANT: 1700,                                   // Infartens västra kant (mackens sida)
  // insvängen: sista IN_D px ner för Infarten drar sig bilen (framifrån) från LS till XIN
  // och vrids sedan kring sin mitt till sidovy – bakänden hamnar på XIN + L/2 (≤ 1720,
  // i det södergående körfältet som bilen just kom ifrån) och är ute ur det efter ~1,5 s
  XIN: 1690, IN_D: 22,
  // utsvängen: sidovyn vrids kring sin mitt vid XUT till bakvy och drar sig sedan
  // över till LN under de första UT_D px norrut
  XUT: 1711, UT_D: 26,
  TAK: [1611, 1700], TY: 540,                   // takets x-spann; ovansidan 540–551, frontlisten 552–564, LED 565
  PYL: [1595, 668],                             // prisskyltens stolpe (fot vid trottoarkanten, öster om lyktan vid 1560; lådan x 1575–1614)
  DOOR: [1648, 596],                            // butiksdörrens mitt och tröskel
};
const mkEase = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// bilens mitt (x) framifrån/bakifrån under in- och utsvängen
const mkInnX = (p) => MK.LS - (MK.LS - MK.XIN) * mkEase((p - (MK.YN - MK.IN_D)) / MK.IN_D);
const mkUtX = (p) => MK.XUT + (MK.LN - MK.XUT) * mkEase((MK.YS - p) / MK.UT_D);
const MK_PAINT = [0xc23a32, 0x2f6db5, 0xc3c8d0, 0xe9e9eb, 0x2b2e36, 0x3f8a55, 0xd99a2b, 0x2a9d9a, 0x7a2e3e, 0x5e7b99, 0xe57a2e, 0x6b4f8f];
const MK_SKINS = [0xf6d7bf, 0xeec3a0, 0xe0a97f, 0xc68a5c, 0xa06a43, 0x744a2d];
const MK_HAIRS = [0x1d1714, 0x3b2619, 0x6b4226, 0xa5692f, 0xd9a95c, 0xb9b3ab, 0xb7392b];
const MK_SHIRTS = [0xd9433b, 0x3a7bd5, 0x46a35a, 0xf0b429, 0x8e5bd1, 0x2f3440, 0xe8e3d6, 0x2aa39a];
const MK_R = 0xd8342c, MK_RD = 0x8a1a14, MK_RL = 0xff7a6a;           // varumärkets röda: mitt, mörk, ljus

// figurerna (förarna) ritas med stadens figurmotor – laddas mjukt så att husen lever även utan den
let MK_PEOPLE = null;
import('../core/people.js').then((m) => { MK_PEOPLE = m; }).catch(() => { MK_PEOPLE = {}; });
const MK_WALK = [1, 3, 2, 3];

// ---------- priserna: öre, nytt pris var tredje timme (lite upp eller ner) ----------
function mackPris(st) {
  const d = st.env?.day ?? 1, blk = Math.floor((st.hour || 0) / 3);
  return { b95: 1849 + Math.round(hash(d, blk, 811) * 90), dsl: 2099 + Math.round(hash(d, blk, 812) * 90) };
}
const mkKr = (ore) => `${Math.floor(ore / 100)},${String(ore % 100).padStart(2, '0')}`;
const mkOppet = (b, h) => !b.open || (h >= b.open[0] && h < b.open[1]);

// =====================================================================
// Bilarna: samma ritsätt som trafiken (traffic.js) – måtten i bilkoordinater:
// x från bakänden (0) till fronten (L−1), h = höjd över marken. door = förardörren.
// =====================================================================
const MKB = {
  sedan: {
    L: 58, D: 3, r: 5, wheels: [12, 46], rim: 'alloy',
    top: [[0, 9], [1, 12], [2, 13], [12, 14], [18, 21], [20, 22], [33, 22], [36, 21], [43, 14], [53, 13], [56, 11], [57, 8]],
    bot: [[0, 5], [2, 3], [55, 3], [57, 5]],
    cab: [13, 43], belt: 14, roof: [19, 34], ws: [35, 43], rw: [12, 18], pillars: [[28, 29]],
    bump: { h0: 3, h1: 7, rear: 3, front: 3 }, head: { x: 55, h0: 9, h1: 10 }, tail: { w: 2, h0: 9, h1: 11 },
    seams: [17, 29, 43], handles: [[20, 11], [32, 11]], mirror: { x: 40, h: 15 }, crease: 9,
    heads: [{ x: 33, kind: 'driver' }, { x: 21, kind: 'back' }], antenna: 20, fuel: { x: 5, h: 12 }, extraTop: 3, door: [30, 42],
  },
  halvkombi: {
    L: 50, D: 3, r: 5, wheels: [10, 39], rim: 'alloy',
    top: [[0, 8], [1, 16], [2, 19], [4, 21], [25, 21], [28, 20], [34, 14], [45, 12], [48, 10], [49, 7]],
    bot: [[0, 5], [2, 3], [47, 3], [49, 5]],
    cab: [1, 34], belt: 13, roof: [4, 27], ws: [28, 34], rw: [0, 3], pillars: [[1, 7], [19, 20]],
    bump: { h0: 3, h1: 7, rear: 2, front: 3 }, head: { x: 47, h0: 9, h1: 10 }, tail: { w: 2, h0: 9, h1: 14 },
    seams: [21, 34], handles: [[23, 10]], mirror: { x: 31, h: 14 }, crease: 9,
    heads: [{ x: 25, kind: 'driver' }, { x: 12, kind: 'back' }], rails: true, fuel: { x: 4, h: 11 }, extraTop: 2, door: [22, 33],
  },
  kombi: {
    L: 60, D: 3, r: 5, wheels: [12, 47], rim: 'steel',
    top: [[0, 9], [1, 19], [2, 21], [3, 22], [36, 22], [39, 21], [45, 14], [55, 13], [58, 11], [59, 8]],
    bot: [[0, 5], [2, 3], [57, 3], [59, 5]],
    cab: [1, 45], belt: 14, roof: [4, 38], ws: [39, 45], rw: [0, 3], pillars: [[1, 6], [18, 19], [31, 32]],
    bump: { h0: 3, h1: 7, rear: 3, front: 3 }, head: { x: 57, h0: 9, h1: 10 }, tail: { w: 2, h0: 9, h1: 16 },
    seams: [19, 32, 45], handles: [[22, 11], [35, 11]], mirror: { x: 42, h: 15 }, crease: 9,
    heads: [{ x: 35, kind: 'driver' }, { x: 23, kind: 'back' }], rails: true, fuel: { x: 5, h: 12 }, extraTop: 3, door: [33, 44],
  },
};
// sedda framifrån/bakifrån (Infarten och U-svängen)
const MB_END = {
  sedan: { w: 24, hb: 22, belt: 13, hood: 3, roof: 3, taper: 2, mirror: 15, hatch: false },
  halvkombi: { w: 24, hb: 21, belt: 12, hood: 3, roof: 3, taper: 2, mirror: 14, hatch: true },
  kombi: { w: 24, hb: 22, belt: 13, hood: 3, roof: 3, taper: 2, mirror: 15, hatch: true },
};
const MB_KINDS = ['sedan', 'sedan', 'halvkombi', 'halvkombi', 'kombi'];
const MB_R = { BODY: 1, GLASS: 2, FRAME: 3, BUMP: 4, ARCH: 5, TOPB: 6, TOPR: 7, TOPG: 8, TRIM: 9 };
const MB_HEAD = ['.hh.', 'hhhh', 'hhss', 'hsss', '.ss.', 'tttt', 'tttt'];
const MB_HEAD_BACK = ['.hh.', 'hhhh', 'hhhh', 'hhhh', '.ss.', 'tttt', 'tttt'];
const MB_REST = ['.rr.', 'rrrr', 'rrrr', 'rrrr'];
function mbInterp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) { const [x1, y1] = pts[i]; if (x <= x1) { const [x0, y0] = pts[i - 1]; return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); } }
  return pts[pts.length - 1][1];
}
// spegla en Pix pixel för pixel (aldrig ctx.scale)
function mbMirror(P) {
  const Q = new Pix(P.w, P.h), s = P.d, d = Q.d, w = P.w;
  for (let y = 0; y < P.h; y++) for (let x = 0; x < w; x++) {
    const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
    d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = s[a + 3];
  }
  return Q;
}
// snö på taket (1–2 px vitt där konturen är plan) – härleds ur den färdiga bilden
function mbSnow(P, gy) {
  const W = P.w, d = P.d, S = new Pix(W, P.h);
  const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= P.h ? 0 : d[(y * W + x) * 4 + 3]);
  const tops = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = 0; y < P.h; y++) if (alpha(x, y) > 200) { tops[x] = y; break; }
  for (let x = 0; x < W; x++) {
    const t = tops[x];
    if (t < 0 || t > gy - 4) continue;
    const flat = (x === 0 || tops[x - 1] < 0 || Math.abs(tops[x - 1] - t) <= 2) && (x === W - 1 || tops[x + 1] < 0 || Math.abs(tops[x + 1] - t) <= 2);
    if (!flat) continue;
    S.px(x, t, hash(x, 3, 92) > 0.8 ? 0xffffff : 0xf2f6fc);
    if (hash(x, 1, 91) > 0.3) S.px(x, t - 1, hash(x, 2, 93) > 0.6 ? 0xffffff : 0xeaf0f8);
    S.px(x, t + 1, 0xdfe8f4, 0.45);
  }
  return S;
}
// ---------- bilen från sidan (empty = föraren har klivit ur) ----------
function mbSide(kind, color, variant, empty) {
  const s = MKB[kind], L = s.L, D = s.D, R_ = MB_R;
  const ht = [], hb = [];
  for (let x = 0; x < L; x++) { ht.push(Math.round(mbInterp(s.top, x))); hb.push(Math.round(mbInterp(s.bot, x))); }
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
  // siluetten, rutorna (hyttens pixlar med ram runt om), taket snett uppifrån, hjulhusen
  for (let x = 0; x < L; x++) for (let h = hb[x]; h <= ht[x]; h++) {
    let r = inCab(x) && h > s.belt ? R_.FRAME : R_.BODY;
    if ((x < bump.rear || x >= L - bump.front) && h >= bump.h0 && h <= bump.h1) r = R_.BUMP;
    set(x, h, r);
  }
  const cabAt = (x, h) => x >= 0 && x < L && inCab(x) && h > s.belt && h <= ht[x];
  for (let x = 0; x < L; x++) for (let h = s.belt + 1; h <= ht[x] - 1; h++) {
    if (!cabAt(x, h)) continue;
    if (pillar(x)) set(x, h, R_.TRIM);
    else if (cabAt(x - 1, h) && cabAt(x + 1, h) && cabAt(x, h + 1)) set(x, h, R_.GLASS);
  }
  for (let x = 0; x < L; x++) {
    const h0 = ht[x];
    if ((x > 0 && ht[x - 1] - h0 > D + 1) || (x < L - 1 && ht[x + 1] - h0 > D + 1)) continue;
    const r = within(s.ws, x) || within(s.rw, x) ? R_.TOPG : within(s.roof, x) ? R_.TOPR : R_.TOPB;
    for (let k = 1; k <= D; k++) if (!get(x, h0 + k)) set(x, h0 + k, r);
  }
  const ra = s.r + 1.6;
  for (const wx of s.wheels) for (let x = Math.floor(wx - ra); x <= Math.ceil(wx + ra); x++) for (let h = 0; h <= s.r + ra + 1; h++) {
    const r = get(x, h);
    if ((r === R_.BODY || r === R_.BUMP) && Math.hypot(x - wx, h - s.r) <= ra) set(x, h, R_.ARCH);
  }
  // ---------- målning ----------
  const P = new Pix(W, H);
  const put = (x, h, c, a = 1) => P.px(x + 1, gy - h, c, a);
  const cur = (x, h) => P.get(x + 1, gy - h);
  const nz = (x, h) => bayer(x + 1, gy - h) - 0.5;
  const c = color, RC = { hi: mix(c, WHITE, 0.55), lt: mix(c, WHITE, 0.24), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
  const near = (x) => s.wheels.reduce((a, w) => (Math.abs(w - x) < Math.abs(a - x) ? w : a));
  for (let x = 0; x < L; x++) {                                                  // skuggan under bilen
    const e = Math.min(x, L - 1 - x);
    put(x, 0, 0x08080e, e < 2 ? 0.2 : 0.4); put(x, -1, 0x08080e, e < 4 ? 0.08 : 0.2);
    for (let h = 1; h < hb[x]; h++) if (!get(x, h)) put(x, h, 0x0e0e12, e < 2 ? 0.45 : 0.82);
  }
  for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const n = nz(x, h);
    let col = c;
    if (r === R_.BODY || r === R_.BUMP) {
      const topE = inCab(x) ? s.belt : ht[x], bot = hb[x];
      if (inCab(x) && h === s.belt) col = 0x26272c;                                    // fönsterlist
      else if (h === topE || (inCab(x) && h === s.belt - 1)) col = RC.hi;            // skuldran fångar ljuset
      else if (h === topE - 1 && !inCab(x)) col = RC.lt;
      else if (h === s.crease) col = mix(RC.lt, RC.hi, 0.35);                        // karaktärslinjen
      else if (h === s.crease - 1) col = RC.dk;
      else if (h > s.crease) { const t = (h - s.crease) / Math.max(1, topE - s.crease); col = mix(mix(RC.c, RC.lt, t * 0.7 + n * 0.35), 0xdfeaff, 0.05 + t * 0.06); }
      else { const t = (s.crease - 1 - h) / Math.max(1, s.crease - 1 - bot); col = mix(mix(RC.md, RC.dd, t * 0.85 + n * 0.3), 0x3a3028, t * 0.12); }
      if (h === bot) col = RC.dd;
      if ((x + (h >> 1)) % 41 < 2 && h > s.crease && h < topE - 1) col = mix(col, WHITE, 0.16);
      if (hash(x, h, 7) > 0.95) col = mul(col, 1.06);
      if (r === R_.BUMP) col = h <= bump.h0 + 1 ? 0x26272c : mul(col, 0.94);
    } else if (r === R_.FRAME) {
      const lt = mix(c, WHITE, 0.25);
      col = h === ht[x] ? mix(c, WHITE, 0.5) : mix(c, lt, 0.45 + n * 0.3);
    } else if (r === R_.GLASS) {
      const gtop = ht[x] - 1, gb = s.belt + 1, t = (h - gb) / Math.max(1, gtop - gb);
      col = mix(0x5a7792, 0x1c2633, t * 0.9 + n * 0.25);
      const q = (((x - h) % 23) + 23) % 23;
      if (q < 2) col = mix(col, 0xe6f2ff, 0.42); else if (q === 2 || q === 5) col = mix(col, 0xe6f2ff, 0.16);
      if (h === gtop) col = mul(col, 0.7);
    } else if (r === R_.TRIM) col = mix(0x18191e, 0x2a2b31, n + 0.5);
    else if (r === R_.TOPR) { const k = h - ht[x]; col = mix(c, WHITE, k === 1 ? 0.46 : 0.3 - 0.05 * k + n * 0.1); }
    else if (r === R_.TOPB) { const k = h - ht[x]; col = mix(c, WHITE, k === 1 ? 0.42 : 0.27 - 0.05 * k + n * 0.1); }
    else if (r === R_.TOPG) { const k = h - ht[x]; col = mix(0x6f93b6, 0xdcecff, ((k - 1) / D) * 0.8 + n * 0.25); if ((x * 2 + k) % 11 < 2) col = mix(col, WHITE, 0.35); }
    else if (r === R_.ARCH) col = Math.hypot(x - near(x), h - s.r) > s.r + 0.7 ? 0x202027 : 0x111115;
    put(x, h, col);
  }
  // huvuden bakom rutorna (föraren bara när hen sitter i)
  const onGlass = (x, h) => get(x, h) === R_.GLASS;
  const figure = (pat, x0, hTop, pal, tint = 0.3) => pat.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) { const ch = row[i], x = x0 + i, h = hTop - j; if (ch !== '.' && onGlass(x, h)) put(x, h, mix(pal[ch], cur(x, h), tint)); }
  });
  const person = (x0, hTop, k) => figure(MB_HEAD, x0, hTop, { h: MK_HAIRS[Math.floor(rnd(k + 1) * MK_HAIRS.length)], s: MK_SKINS[Math.floor(rnd(k) * MK_SKINS.length)], t: MK_SHIRTS[Math.floor(rnd(k + 2) * MK_SHIRTS.length)] });
  const seatTop = s.belt + 7;
  for (const [i, hd] of (s.heads || []).entries()) {
    if (hd.kind === 'driver') { if (!empty) person(hd.x, seatTop, 10 + i * 5); else figure(MB_REST, hd.x, s.belt + 5, { r: 0x24262e }, 0.25); }
    else if (rnd(40 + i) < 0.45) person(hd.x, seatTop - 1, 20 + i * 5);
    else figure(MB_REST, hd.x, s.belt + 5, { r: 0x24262e }, 0.25);
  }
  // konturen
  const solid = (x, h) => get(x, h) !== 0;
  for (let x = 0; x < L; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const u = !solid(x, h + 1), dn = !solid(x, h - 1), l = !solid(x - 1, h), rt = !solid(x + 1, h);
    if (u || dn || l || rt) { const k = cur(x, h); put(x, h, u && !dn ? mix(mul(k, 0.5), 0x161620, 0.4) : mix(mul(k, 0.38), 0x0a0a10, 0.5)); }
    else if (r !== R_.ARCH && (get(x, h - 1) === R_.ARCH || get(x - 1, h) === R_.ARCH || get(x + 1, h) === R_.ARCH)) put(x, h, mul(cur(x, h), 0.5));
    else if (r === R_.BODY && get(x, h - 2) === R_.ARCH) put(x, h, mix(cur(x, h), WHITE, 0.22));
  }
  // dörrfogar, handtag, backspegel, lyktor, avgasrör, tanklock, antenn, takräcke
  for (const sx of s.seams || []) {
    const top = inCab(sx) ? s.belt - 1 : ht[sx] - 2;
    for (let h = hb[sx] + 1; h <= top; h++) {
      if (get(sx, h) !== R_.BODY) continue;
      put(sx, h, mul(cur(sx, h), 0.6));
      if (get(sx + 1, h) === R_.BODY) put(sx + 1, h, mix(cur(sx + 1, h), WHITE, 0.12));
    }
  }
  for (const [hx, hh] of s.handles || []) { for (let i = 0; i < 3; i++) { put(hx + i, hh, 0xe6e9ee); put(hx + i, hh - 1, 0x2e3036); } put(hx + 3, hh, mul(c, 0.55)); }
  if (s.mirror) {
    const { x: mx, h: mh } = s.mirror;
    for (let j = 0; j <= 2; j++) for (let i = 0; i < 3; i++) put(mx + i, mh + j, j === 2 ? RC.hi : i === 2 || j === 0 ? RC.dd : j === 1 ? RC.lt : RC.c);
    put(mx + 1, mh - 1, 0x1c1d22);
  }
  const hd = s.head;
  for (let x = hd.x; x < L; x++) for (let h = hd.h0; h <= hd.h1; h++) if (get(x, h)) put(x, h, h === hd.h1 ? 0xffffff : x === L - 1 ? 0xd8dde6 : 0xfff3c8);
  for (let h = hd.h0; h <= hd.h1; h++) if (get(hd.x - 1, h)) put(hd.x - 1, h, 0x3a3c44);
  for (let x = hd.x; x < L; x++) if (get(x, hd.h0 - 1)) put(x, hd.h0 - 1, 0xf0a030);
  const fm = s.wheels[1] + s.r + 3;
  if (get(fm, s.crease + 1) === R_.BODY) { put(fm, s.crease + 1, 0xf0a030); put(fm + 1, s.crease + 1, 0xc07818); }
  const tl = s.tail;
  for (let x = 0; x < tl.w; x++) for (let h = tl.h0; h <= tl.h1; h++) if (get(x, h)) put(x, h, h === tl.h1 ? 0xff7766 : h === tl.h0 ? 0x8a1a1a : 0xd42a2a);
  if (get(1, tl.h0 + 1)) put(1, tl.h0 + 1, 0xeeeef2);
  const eh = hb[3] - 1;
  put(2, eh, 0x9a9ea6); put(3, eh, 0x4a4c54); put(4, eh, 0x2a2b30);
  if (s.fuel) {
    const { x: fx, h: fh } = s.fuel;
    for (let i = 0; i < 3; i++) { put(fx + i, fh, mul(cur(fx + i, fh), 0.7)); put(fx + i, fh - 2, mul(cur(fx + i, fh - 2), 0.7)); }
    put(fx, fh - 1, mul(cur(fx, fh - 1), 0.7)); put(fx + 2, fh - 1, mul(cur(fx + 2, fh - 1), 0.7));
  }
  if (s.antenna !== undefined) { const ax = s.antenna, a0 = ht[ax] + D; put(ax, a0 + 1, 0x1c1d22); put(ax - 1, a0 + 2, 0x2a2b30); put(ax - 1, a0 + 3, 0x3a3b41); }
  if (s.rails) for (let x = s.roof[0] + 2; x <= s.roof[1] - 2; x++) {
    const h = ht[x] + D + 1;
    put(x, h, x % 3 === 0 ? 0x55575f : 0x2a2b31);
    if (x === s.roof[0] + 2 || x === s.roof[1] - 2 || x % 7 === 0) put(x, h - 1, 0x1c1d22);
  }
  // bromsljusen (läggs över när bilen bromsar)
  const O = new Pix(W, H);
  for (let x = 0; x < tl.w; x++) for (let h = tl.h0; h <= tl.h1; h++) if (get(x, h)) O.px(x + 1, gy - h, h === tl.h1 ? 0xffb0a0 : 0xff3a2a);
  const Q = mbMirror(P), OQ = mbMirror(O), S = mbSnow(P, gy), SQ = mbMirror(S);
  return { W, H, gy, L, topH: Math.max(...ht) + D, img: [P.flush(), Q.flush()], brake: [O.flush(), OQ.flush()], snow: [S.flush(), SQ.flush()] };
}
// ---------- bilen framifrån (rear = false, kör söderut) eller bakifrån (rear = true, kör norrut) ----------
function mbEnd(kind, color, variant, rear) {
  const e = MB_END[kind], w = e.w, hb = e.hb, tp = e.taper, R_ = MB_R;
  const OX = 3, W = w + 2 * OX, H = hb + e.roof + 6, gy = H - 3;
  const M = new Uint8Array(W * H);
  const ok = (x, h) => x >= -OX && x < w + OX && h >= -2 && h <= gy;
  const get = (x, h) => (ok(x, h) ? M[(gy - h) * W + x + OX] : 0);
  const set = (x, h, v) => { if (ok(x, h)) M[(gy - h) * W + x + OX] = v; };
  const rnd = (k) => hash(variant * 13 + k, color & 0xffff, kind.length + (rear ? 50 : 0));
  for (const wx0 of [2, w - 5]) for (let x = wx0; x < wx0 + 3; x++) for (let h = 0; h <= 5; h++) set(x, h, R_.ARCH);
  for (let x = 0; x < w; x++) for (let h = 3; h <= 6; h++) if (!(h === 3 && (x === 0 || x === w - 1))) set(x, h, R_.BUMP);
  for (let x = 0; x < w; x++) for (let h = 7; h <= e.belt; h++) set(x, h, R_.BODY);
  const hood = rear && e.hatch ? 1 : e.hood, hoodTop = e.belt + hood, glassTop = hb - 1;
  for (let x = 1; x < w - 1; x++) for (let h = e.belt + 1; h <= hoodTop; h++) set(x, h, rear ? R_.BODY : R_.TOPB);
  for (let x = tp; x < w - tp; x++) for (let h = hoodTop + 1; h <= hb - 1; h++) set(x, h, h > glassTop ? R_.BODY : x === tp || x === w - 1 - tp ? R_.TRIM : R_.GLASS);
  for (let x = tp + 1; x < w - 1 - tp; x++) for (let h = hb; h < hb + e.roof; h++) set(x, h, R_.TOPR);
  for (const mx of [-2, w + 1]) { set(mx, e.mirror, R_.BODY); set(mx, e.mirror + 1, R_.BODY); }
  set(-1, e.mirror + 1, R_.TRIM); set(w, e.mirror + 1, R_.TRIM);
  const P = new Pix(W, H);
  const put = (x, h, c, a = 1) => P.px(x + OX, gy - h, c, a);
  const cur = (x, h) => P.get(x + OX, gy - h);
  const nz = (x, h) => bayer(x + OX, gy - h) - 0.5;
  const c = color, RC = { hi: mix(c, WHITE, 0.55), lt: mix(c, WHITE, 0.24), c, md: mul(c, 0.84), dk: mul(c, 0.66), dd: mul(c, 0.5) };
  for (let x = 0; x < w; x++) { put(x, 0, 0x08080e, x < 2 || x > w - 3 ? 0.2 : 0.42); put(x, -1, 0x08080e, 0.18); put(x, 1, 0x0e0e12, x > 4 && x < w - 5 ? 0.8 : 0.3); put(x, 2, 0x0e0e12, x > 4 && x < w - 5 ? 0.8 : 0.3); }
  for (let x = -OX; x < w + OX; x++) for (let h = 0; h <= gy; h++) {
    const r = get(x, h);
    if (!r) continue;
    const n = nz(x, h);
    let col = c;
    if (r === R_.BODY) {
      const t = Math.max(0, Math.min(1, (h - 7) / Math.max(1, e.belt - 7)));
      col = rear ? mix(RC.dd, RC.md, t * 0.9 + n * 0.3) : mix(RC.md, RC.lt, t * 0.9 + n * 0.3);
      if (h === e.belt) col = rear ? RC.lt : RC.hi;
      if (h === 7) col = RC.dd;
      if (h > e.belt) col = rear ? mix(RC.md, RC.lt, 0.4 + n * 0.3) : col;
      if (x === 0) col = mix(col, WHITE, 0.22); else if (x === w - 1) col = mul(col, 0.7);
    } else if (r === R_.BUMP) col = h <= 4 ? 0x26272c : mul(c, 0.94);
    else if (r === R_.TOPB) { const k = h - e.belt; col = mix(c, WHITE, k === hood ? 0.42 : 0.26 + 0.04 * k + n * 0.1); }
    else if (r === R_.TOPR) { const k = h - hb; col = mix(c, WHITE, k === e.roof - 1 ? 0.46 : 0.32 + 0.04 * k + n * 0.1); }
    else if (r === R_.GLASS) {
      const t = (h - hoodTop) / Math.max(1, glassTop - hoodTop);
      col = rear ? mix(0x2c3d52, 0x5a7792, t * 0.7 + n * 0.25) : mix(0x5a7792, 0x1c2633, t * 0.9 + n * 0.25);
      const q = (((x - h) % 13) + 13) % 13;
      if (q < 2) col = mix(col, 0xe6f2ff, 0.4); else if (q === 3) col = mix(col, 0xe6f2ff, 0.15);
    } else if (r === R_.TRIM) col = mix(0x18191e, 0x2a2b31, n + 0.5);
    else if (r === R_.ARCH) { col = h === 0 ? 0x0a0a0c : (x === 2 || x === w - 5) && h > 1 && h < 5 ? 0x3a3a42 : h === 5 ? 0x26262c : 0x151518; if ((h === 2 || h === 3) && (x === 3 || x === w - 4)) col = 0x4a4e56; }
    put(x, h, col);
  }
  const onGlass = (x, h) => get(x, h) === R_.GLASS;
  const figure = (pat, x0, hTop, pal, tint = 0.3) => pat.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i], x = x0 + i, h = hTop - j; if (ch !== '.' && onGlass(x, h)) put(x, h, mix(pal[ch], cur(x, h), tint)); } });
  const person = (x0, hTop, k, back) => figure(back ? MB_HEAD_BACK : MB_HEAD, x0, hTop, { h: MK_HAIRS[Math.floor(rnd(k + 1) * MK_HAIRS.length)], s: MK_SKINS[Math.floor(rnd(k) * MK_SKINS.length)], t: MK_SHIRTS[Math.floor(rnd(k + 2) * MK_SHIRTS.length)] });
  const gt = Math.min(glassTop, hb - 2);
  person(rear ? (w >> 1) - 5 : (w >> 1) + 1, gt - 1, 10, rear);
  if (rnd(20) < 0.45) person(rear ? (w >> 1) + 1 : (w >> 1) - 5, gt - 2, 30, rear);
  const solid = (x, h) => get(x, h) !== 0;
  for (let x = -OX; x < w + OX; x++) for (let h = 0; h <= gy; h++) {
    if (!get(x, h)) continue;
    const u = !solid(x, h + 1), dn = !solid(x, h - 1), l = !solid(x - 1, h), rt = !solid(x + 1, h);
    if (u || dn || l || rt) { const k = cur(x, h); put(x, h, u && !dn ? mix(mul(k, 0.5), 0x161620, 0.4) : mix(mul(k, 0.38), 0x0a0a10, 0.5)); }
  }
  const mid = w >> 1;
  if (!rear) {
    for (const x0 of [2, w - 6]) for (let x = x0; x < x0 + 4; x++) for (let h = 9; h <= 11; h++) put(x, h, h === 11 ? 0xffffff : x === x0 || x === x0 + 3 ? 0xd8dde6 : 0xfff3c8);
    for (const x of [1, w - 2]) put(x, 8, 0xf0a030);
    for (let x = mid - 5; x <= mid + 4; x++) for (let h = 9; h <= 12; h++) put(x, h, h % 2 ? 0x1a1b20 : 0x34363c);
    put(mid - 1, 11, 0xd8dce4); put(mid, 11, 0xd8dce4);
  } else {
    for (const x0 of [1, w - 5]) for (let x = x0; x < x0 + 4; x++) for (let h = 8; h <= 11; h++) put(x, h, h === 11 ? 0xff7766 : h === 8 ? 0x8a1a1a : 0xd42a2a);
    put(4, 10, 0xeeeef2); put(w - 5, 10, 0xeeeef2);
    put(3, 2, 0x8a8e96); put(4, 2, 0x4a4c54);
    if (e.hatch) for (let x = mid - 2; x <= mid + 1; x++) put(x, e.belt - 1, 0xe6e9ee);
  }
  for (let x = mid - 3; x <= mid + 2; x++) { put(x, 7, 0xeeeef2); put(x, 8, x === mid - 3 || x === mid + 2 ? 0x1a1b20 : 0xdcdee2); }   // registreringsskylten
  const O = new Pix(W, H);
  if (rear) for (const x0 of [1, w - 5]) for (let x = x0; x < x0 + 4; x++) for (let h = 8; h <= 11; h++) O.px(x + OX, gy - h, h === 11 ? 0xffb0a0 : 0xff3a2a);
  return { W, H, gy, img: P.flush(), brake: rear ? O.flush() : null, snow: mbSnow(P, gy).flush() };
}
// ---------- hjulen: åtta rotationslägen ----------
const MB_NF = 8, MB_RIMN = { alloy: 5, steel: 6 };
function mbWheelPaint(r, style, f) {
  const n = MB_RIMN[style], rot = (f / MB_NF) * ((Math.PI * 2) / n);
  const S = 2 * r + 1, P = new Pix(S, S), rimR = r - 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - r, dy = j - r, d = Math.hypot(dx, dy);
    if (d > r + 0.4) continue;
    const a = Math.atan2(dy, dx), lit = -(dx + dy) / (2 * r);
    let k;
    if (d > rimR + 0.45) {
      k = d > r - 0.5 ? 0x121215 : d < rimR + 1.4 ? 0x2b2b31 : 0x1c1c21;
      if (d > r - 1.3 && Math.cos(2 * n * (a - rot)) > 0.55) k = mix(k, 0x3a3a42, 0.5);
      if (lit > 0.42 && d > r - 1.6) k = 0x46464e;
    } else if (d > rimR - 0.6) k = lit > 0.1 ? 0xe4e8ee : lit < -0.2 ? 0x7a7e86 : 0xb0b4bc;
    else if (style === 'alloy') { const spoke = Math.cos(n * (a - rot)) > 0.2; k = d < 0.8 ? 0x4a4e56 : d < 1.3 ? 0x8a8e96 : spoke ? mix(0xd2d6de, 0x8a9098, 0.5 - lit) : 0x26282e; }
    else { k = mix(0x8c9098, 0x60646c, 0.5 - lit); if (Math.abs(d - rimR * 0.62) < 0.75 && Math.cos(n * (a - rot)) > 0.55) k = 0x24262a; if (d < 1.2) k = 0xd4d8de; if (d < 0.5) k = 0x8a8e96; }
    P.px(i, j, k);
  }
  return P.flush();
}
const MB_CACHE = new Map();
function mbCached(key, make) { let v = MB_CACHE.get(key); if (!v) { if (MB_CACHE.size > 160) MB_CACHE.clear(); v = make(); MB_CACHE.set(key, v); } return v; }
const mbSideArt = (car, empty) => mbCached(`s|${car.kind}|${car.color}|${car.variant}|${empty ? 1 : 0}`, () => mbSide(car.kind, car.color, car.variant, empty));
const mbEndArt = (car, rear) => mbCached(`e|${car.kind}|${car.color}|${car.variant}|${rear ? 1 : 0}`, () => mbEnd(car.kind, car.color, car.variant, rear));
const mbWheel = (r, style, f) => mbCached(`w|${r}|${style}|${f}`, () => mbWheelPaint(r, style, f));

// =====================================================================
// Förgården, öarna, pumparna, pelarna, taket och prisskylten (målas en gång)
// =====================================================================
const MK_IMG = {};
// marken på förgården (x 1600–1700, y 598–640): betongplattor, torrt under taket,
// körpilar, öarna med gul/svart kantsten, oljefläckar, brunn och rännan mot trottoaren.
// snow = snöigt utanför taket (hjulspår i snön där bilarna svänger)
function mkGroundImg(snow) {
  const key = 'mark' + (snow ? 's' : '');
  if (MK_IMG[key]) return MK_IMG[key];
  const X0 = MK.X0, Y0 = 598, W = MK.X1 - X0, H = MK.FRONT - Y0, P = new Pix(W, H);
  const under = (x, y) => x >= MK.TAK[0] + 2 && y < MK.FRONT - 1;                     // under taket (torrt)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = X0 + i, y = Y0 + j, px = ((x - 1600) % 16 + 16) % 16, py = ((y - 598) % 11 + 11) % 11;
    const slab = hash(Math.floor((x - 1600) / 16), Math.floor((y - 598) / 11), 821);
    let c = jit(mix(0xb4b0a6, slab > 0.5 ? 0xc4c0b6 : 0xa6a298, Math.abs(slab - 0.5)), x, y, 822, 0.07);
    if (hash(x, y, 823) > 0.965) c = mul(c, 0.88); else if (hash(x, y, 824) > 0.975) c = mix(c, WHITE, 0.12);
    if (px === 15 || py === 10) c = mul(c, 0.72); else if (px === 0 || py === 0) c = mix(c, WHITE, 0.08);
    if (under(x, y)) c = mix(mul(c, 0.86), 0x6a7488, 0.08);                            // i takets skugga: svalare
    if (snow && !under(x, y)) {
      const track = (Math.abs(y - (MK.YS - 2)) <= 1 || Math.abs(y - (MK.YS - 12)) <= 1 || (Math.abs(x - 1606) <= 1 || Math.abs(x - 1626) <= 1) && y > MK.YN);
      c = track ? mix(0x9aa2ae, c, 0.35) : hash(x, y, 825) > 0.85 ? WHITE : mix(0xe8eef6, 0xd8e0ec, hash(x >> 1, y >> 1, 826));
    }
    if (j < 2) c = mul(c, j === 0 ? 0.6 : 0.78);                                          // husets sockelskugga
    P.px(i, j, c);
  }
  // snöslask vid takets kant och längs rännan
  if (snow) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = X0 + i, y = Y0 + j, e = x - (MK.TAK[0] + 2);
    if ((e >= 0 && e < 4 && hash(x, y, 827) > e / 4) || (y >= MK.FRONT - 5 && x >= MK.TAK[0] && hash(x, y, 828) > 0.55)) P.px(i, j, mix(0xd0d8e2, 0x9aa4b0, hash(x, y, 829)));
  }
  // körpilarna: västerut i norra körfältet, österut i södra
  const arrow = (cx, cy, dir) => {
    for (let k = -7; k <= 3; k++) P.px(cx - X0 + k * dir, cy - Y0, 0xf2eee2, 0.85);
    for (let r = 1; r <= 3; r++) { P.px(cx - X0 - (7 - r) * dir, cy - Y0 - r, 0xf2eee2, 0.85); P.px(cx - X0 - (7 - r) * dir, cy - Y0 + r, 0xf2eee2, 0.85); }
  };
  arrow(1694, 606, -1); arrow(1662, 634, 1);
  // oljefläckar där motorerna står
  const stain = (cx, cy, rx, ry, a) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d < 1 && hash(x, y, 830) > d * 0.7) P.px(x - X0, y - Y0, 0x1c1e24, a * (1 - d * 0.5)); } };
  stain(1617, 606, 5, 2, 0.35); stain(1686, 634, 5, 1.6, 0.3); stain(1660, 609, 2, 1, 0.3); stain(1640, 632, 3, 1.2, 0.25);
  // brunn med galler mellan öarna
  for (let y = 628; y < 631; y++) for (let x = 1656; x < 1663; x++) P.px(x - X0, y - Y0, (x + y) & 1 ? 0x2a2c30 : 0x5a5c62);
  P.hl(1656 - X0, 627 - Y0, 7, 0x3a3c42);
  // rännan tvärs över framkanten
  for (let x = X0; x < MK.X1; x++) { P.px(x - X0, H - 3, (x & 1) ? 0x2a2a2c : 0x6a6a6a); P.px(x - X0, H - 2, 0x4a4a4c); P.px(x - X0, H - 1, 0x8a8680); }
  // öarna: upphöjda med gul/svart kantsten och slitna hörn
  for (const [x0, y0, x1, y1] of [MK.I1, MK.I2]) {
    for (let y = y0 - 1; y <= y1; y++) for (let x = x0 - 1; x <= x1; x++) {
      const edge = x === x0 - 1 || x === x1 || y === y0 - 1 || y >= y1 - 1;
      let c;
      if (y >= y1 - 1) c = ((x - x0) % 6) < 3 ? (y === y1 ? 0x9a7a18 : 0xe8c040) : (y === y1 ? 0x141416 : 0x2a2a2e);   // framsidan: gul/svart
      else if (edge) c = ((x + y) % 6) < 3 ? 0xf0c848 : 0x2a2a2e;
      else { c = jit(0xd4d0c6, x, y, 831, 0.06); if (y === y0) c = mix(c, WHITE, 0.2); if ((x - x0) % 8 === 7) c = mul(c, 0.86); }
      P.px(x - X0, y - Y0, c);
    }
    for (let x = x0 - 1; x <= x1; x++) P.px(x - X0, y1 + 1 - Y0, 0x000000, 0.28);             // skuggan framför kantstenen
  }
  return (MK_IMG[key] = P.flush());
}
// pumpen (14 × 32, foten på sista raden): vit front med röda sidopaneler, ljuslåda
// överst med droppen, display i ram, produktknappar (grönt 95, svart diesel),
// kortterminal och skåp med ventilationsgaller. Munstyckena, slangarna och siffrorna
// ritas levande (det munstycke som används sitter i förarens hand).
const MK_PH = 32;
function mkPumpImg(lit) {
  const key = 'pump' + (lit ? 'n' : '');
  if (MK_IMG[key]) return MK_IMG[key];
  const W = 14, H = MK_PH, P = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = null;
    if (y === 0) c = x === 0 || x === W - 1 ? null : 0x3a1a18;
    else if (y <= 5) {                                                                        // ljuslådan: röd med vitt band och droppen
      c = y === 3 ? (lit ? WHITE : 0xf4f1ea) : lit ? mix(0xff6050, 0xe8302a, y / 6) : mix(0xf05a4a, 0xb8261e, y / 6);
      if (x === 0) c = mix(c, WHITE, 0.2); else if (x === W - 1) c = mul(c, 0.68);
    } else if (y === 6) c = 0x2a2c30;
    else if (y <= 28) {                                                                       // skåpet: röda sidopaneler, vit front i borstad plåt
      if (x <= 1) c = x === 0 ? 0xf06a5a : MK_R;
      else if (x >= W - 2) c = x === W - 1 ? MK_RD : 0xb02a22;
      else { c = jit(mix(0xf2f3f5, 0xd4d7dc, (y - 6) / 22), x, y, 841, 0.03); if (x === 2) c = mix(c, WHITE, 0.4); if (x === W - 3) c = mul(c, 0.9); }
      if (y >= 25 && x > 1 && x < W - 2) c = (y & 1) ? 0x5a5e66 : 0x8a8e96;               // ventilationsgallret nertill
    } else if (y <= 30) c = x === 0 ? 0x5a5e66 : y === 30 ? 0x1e2024 : 0x3a3e46;           // sockeln
    if (c !== null) P.px(x, y, c);
  }
  // droppen på ljuslådan
  P.px(6, 1, WHITE); P.px(7, 1, WHITE); P.rect(5, 2, 4, 1, lit ? 0xfff0e8 : 0xf8e8e0); P.px(6, 4, 0xf8e8e0); P.px(7, 4, 0xf8e8e0);
  // displayen i mörk ram (siffrorna skrivs levande på raderna 8–12)
  P.rect(1, 7, 12, 7, 0x3a3e46); P.hl(1, 7, 12, 0x6a6e76); P.hl(1, 13, 12, 0x24262c);
  P.rect(2, 8, 10, 5, lit ? 0x141a12 : 0x0c120e);
  P.px(2, 8, 0x2a3a2a); P.px(11, 12, 0x060806);
  // produktknapparna: grönt 95, svart diesel, grått (ur bruk)
  P.rect(2, 15, 3, 3, 0x2e8a3e); P.px(3, 16, 0xd8f4d8);
  P.rect(6, 15, 3, 3, 0x1a1a1e); P.px(7, 16, 0xf0c848);
  P.rect(10, 15, 2, 3, 0x9a9ea6);
  // kortterminalen: skärm, knappsats och kortplats
  P.rect(3, 19, 8, 5, 0x2a2c30); P.hl(3, 19, 8, 0x4a4e56);
  P.rect(4, 20, 3, 1, lit ? 0x70d0ff : 0x3a7a9a);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) P.px(4 + i, 21 + j, j ? 0x8a8e96 : 0xc8ccd2);
  P.hl(8, 21, 2, 0x0a0a0c); P.px(9, 22, 0x3ac05a);
  P.hl(0, H - 1, W, 0x000000, 0.28);
  return (MK_IMG[key] = P.flush());
}
// munstycket i hållaren på pumpens sida: grönt (95) eller svart (diesel)
function mkNozzle(ctx, x, y, c) {
  ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 2, 4);
  ctx.fillStyle = rgb(mix(c, WHITE, 0.4)); ctx.fillRect(x, y, 1, 2);
  ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x + (x & 1), y + 4, 1, 1);
}
// takpelaren (3 bred): stål med röd beklädnad nertill och gul/svart påkörningsskydd
const MK_TAK_H = 26, MK_F0 = 12;                   // takbildens höjd; frontlisten rad 12–24, LED-listen rad 25
const MK_PEL_TOP = MK.TY + MK_TAK_H - 1;           // pelarna börjar vid LED-listen
function mkPillarImg() {
  if (MK_IMG.pelare) return MK_IMG.pelare;
  const top = MK_PEL_TOP, H = MK.PY - top + 1, P = new Pix(5, H);
  for (let y = 0; y < H; y++) {
    const wy = top + y;
    const clad = wy >= MK.PY - 16, band = wy >= MK.PY - 5 && wy <= MK.PY - 3;
    for (let i = 0; i < 3; i++) {
      let c = clad ? [0xf06a5a, MK_R, MK_RD][i] : [0xf4f6f8, 0xc8ccd2, 0x8a9098][i];
      if (band) c = ((wy + i) % 4) < 2 ? 0xf0c848 : 0x1e1e22;
      if (!clad && (wy % 14) === 0) c = mul(c, 0.8);                                      // skarvarna i plåten
      P.px(1 + i, y, c);
    }
    if (clad && wy === MK.PY - 16) { P.px(0, y, 0xa82a22); P.px(4, y, 0xa82a22); P.hl(1, y, 3, 0xff8a7a); }
  }
  P.hl(0, H - 1, 5, 0x3a3a40); P.px(0, H - 2, 0x5a5a60); P.px(4, H - 2, 0x2a2a30);           // fotplattan
  return (MK_IMG.pelare = P.flush());
}
/// taket: ovansidan (12 rader, plåtpaneler), frontlisten (13 rader, röd med skylten) och LED-listen.
// lit = kvällsversionen (frontlisten är en ljuslåda) som glow() lägger ovanpå.
// Skylten står EN gång: BIG mellan två droppar när det får plats (KVÄLLSMACKEN = 71 px ryms i
// 89 px med 2 px luft), annars BIG utan droppar, annars SMALL. Versalerna står på rad F0+4 så
// att prickarna över Ä/Ö (två rader ovanför) hamnar på den röda ytan, aldrig på listens ljusa kant.
const MK_DROPPE = ['..#..', '.###.', '#####', '#####', '.###.'];
function mkSkyltLayout(sign, W) {
  const s = String(sign || '').toUpperCase(), wb = textW(BIG, s), ws = textW(SMALL, s);
  if (wb + 14 <= W - 2) { const x0 = (W - wb - 14) >> 1; return { F: BIG, s, tx: x0 + 7, tw: wb, drops: [x0, x0 + wb + 9] }; }
  if (wb + 4 <= W) return { F: BIG, s, tx: (W - wb) >> 1, tw: wb, drops: [] };
  if (ws + 14 <= W - 2) { const x0 = (W - ws - 14) >> 1; return { F: SMALL, s, tx: x0 + 7, tw: ws, drops: [x0, x0 + ws + 9] }; }
  return { F: SMALL, s, tx: Math.max(1, (W - ws) >> 1), tw: ws, drops: [] };
}
function mkRoofImg(sign, snow, lit) {
  const key = `tak|${sign}|${snow ? 1 : 0}|${lit ? 1 : 0}`;
  if (MK_IMG[key]) return MK_IMG[key];
  const W = MK.TAK[1] - MK.TAK[0], H = MK_TAK_H, F0 = MK_F0, FH = 13, P = new Pix(W, H);
  // ovansidan (rad 0–11): grå takduk med svetsade skarvar, plåtkant fram och bak, två brunnar
  for (let y = 0; y < F0; y++) for (let x = 0; x < W; x++) {
    if (lit) continue;
    let c = jit(mix(0x9a9ea6, 0xb4b8be, y / F0), x, y, 851, 0.05);
    if (x % 14 === 13) c = mul(c, 0.86); else if (x % 14 === 0) c = mix(c, WHITE, 0.12);
    if (y === 0) c = 0x6a6e76; else if (y === 1) c = 0xc8ccd2;                              // bakre plåtkanten
    if (y >= F0 - 2) c = y === F0 - 1 ? 0xf4f6f8 : 0xd8dce2;                                // främre plåtkanten fångar ljuset
    if (x === 0) c = mix(c, WHITE, 0.2); else if (x === W - 1) c = mul(c, 0.7);
    if (snow && y > 1 && y < F0 - 1 && hash(x, y, 852) > 0.08) c = hash(x, y, 853) > 0.82 ? WHITE : mix(0xeef2f8, 0xd4dce8, (y - 2) / 9);
    P.px(x, y, c);
  }
  if (!lit) {
    for (const bx of [10, W - 14]) { P.rect(bx, 5, 3, 2, 0x3a3e46); P.px(bx + 1, 5, 0x1a1c20); }   // takbrunnarna
    if (!snow) { P.rect(W >> 1, 3, 8, 4, 0x8a8e96); P.hl(W >> 1, 3, 8, 0xc8ccd2); P.hl(W >> 1, 6, 8, 0x5a5e66); for (let i = 1; i < 8; i += 2) P.px((W >> 1) + i, 4, 0x5a5e66); }   // ventilationshuven
  }
  for (let y = F0; y < F0 + FH; y++) for (let x = 0; x < W; x++) {                          // frontlisten
    const r = y - F0;
    let c;
    if (r === 0) c = lit ? 0xffffff : 0xf4f1ea;
    else if (r === 1) c = lit ? 0xffb0a0 : MK_RL;
    else if (r === FH - 1) c = lit ? 0xb02a20 : MK_RD;
    else c = lit ? mix(0xff4a3a, 0xe8302a, (r - 2) / (FH - 3)) : jit(mix(0xe03a30, 0xc02a24, (r - 2) / (FH - 3)), x, y, 854, 0.03);
    if (!lit && x === 0) c = mix(c, WHITE, 0.25); else if (!lit && x === W - 1) c = mul(c, 0.7);
    P.px(x, y, c);
  }
  // skylten EN gång, vitt med mörkröd skugga – droppen i varje ände när den ryms
  const S = mkSkyltLayout(sign, W), ty = F0 + (S.F === BIG ? 4 : 5);
  text(P, S.F, S.s, S.tx + 1, ty + 1, lit ? 0xa01c14 : MK_RD);
  text(P, S.F, S.s, S.tx, ty, WHITE);
  for (const dx of S.drops) MK_DROPPE.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(dx + i, F0 + 5 + j, i === 1 && j === 2 ? (lit ? 0xfff0e0 : 0xf8d8d0) : WHITE); });
  for (let x = 0; x < W; x++) P.px(x, F0 + FH, lit ? (x % 4 === 1 ? 0xffffff : 0xfff4d8) : (x % 4 === 1 ? 0xf4f4ec : 0xb8b8b0));   // LED-listen
  return (MK_IMG[key] = P.flush());
}
// Varumärket på prisskyltens huvud ur b.sign: "KVÄLLSMACKEN" → KVÄLLS (BIG) över MACKEN (SMALL),
// annars hela namnet i BIG om det ryms (36 px), annars sista ordet på rad två, annars SMALL.
function mkMarke(sign) {
  const s = String(sign || 'PIXELMACKEN').toUpperCase().trim(), MAX = 36;
  const m = /^(.+?)[\s-]*(MACKEN)$/.exec(s);
  if (m && textW(BIG, m[1]) <= MAX) return [m[1], 'MACKEN'];
  if (textW(BIG, s) <= MAX) return [s, null];
  const i = s.lastIndexOf(' ');
  if (i > 0 && textW(BIG, s.slice(0, i)) <= MAX && textW(SMALL, s.slice(i + 1)) <= MAX) return [s.slice(0, i), s.slice(i + 1)];
  return [null, s];
}
// prisskylten (pylonen): 42 × MK_PYL_H, foten på sista raden. Lådan (MK_PYL_BH rader):
//   1–17 röda huvudet med varumärket, 18 vit list, 20 BENSIN 95, 27–37 LED-fältet, 40 DIESEL,
//   47–57 LED-fältet, 58 röd list, 59–67 blå BILTVÄTT-panel. lit = kvällsversionen.
// Toppen (y 583) står under öppettidsskylten i skyltfönstret, och lådans högra kant (x 1614)
// slutar före skylten – prisskylten skymmer aldrig någon text på fasaden.
const MK_PYL_H = 86, MK_PYL_BH = 69;
function mkPylonImg(lit, snow, sign) {
  const key = 'pylon' + (lit ? 'n' : '') + (snow ? 's' : '') + '|' + sign;
  if (MK_IMG[key]) return MK_IMG[key];
  const W = 42, H = MK_PYL_H, P = new Pix(W, H), bx = 1, bw = 40, bh = MK_PYL_BH, HD = 17, BL = 59;
  // stolpen och sockeln
  if (!lit) {
    for (let y = bh; y < H - 3; y++) { P.px(18, y, 0xd8dce2); P.px(19, y, 0xb8bcc4); P.px(20, y, 0xa0a4ac); P.px(21, y, 0xa0a4ac); P.px(22, y, 0x7a808a); P.px(23, y, 0x5a5e66); if ((y - bh) % 6 === 5) P.hl(18, y, 6, 0x000000, 0.12); }
    for (let y = bh; y < bh + 3; y++) P.hl(18, y, 6, 0x000000, 0.35 - (y - bh) * 0.1);
    for (let y = H - 4; y < H; y++) for (let x = 13; x < 29; x++) { let c = jit(0xb0aca2, x, y, 861, 0.06); if (y === H - 4) c = mix(c, WHITE, 0.25); if (x === 13) c = mix(c, WHITE, 0.1); if (x === 28 || y === H - 1) c = mul(c, 0.7); P.px(x, y, c); }
    P.px(15, H - 3, 0x5a5e66); P.px(26, H - 3, 0x5a5e66);                                   // bultarna i sockeln
  }
  // lådan: mörk ram, rött huvud, vit list, ljusa etikettrader, röd list och blå tvättpanel
  for (let y = 0; y < bh; y++) for (let x = bx; x < bx + bw; x++) {
    let c;
    if (x === bx || x === bx + bw - 1 || y === 0 || y === bh - 1) c = 0x2a2c32;
    else if (y <= HD) c = lit ? mix(0xff5040, MK_R, (y - 1) / HD) : mix(0xe8483c, MK_RD, (y - 1) / (HD + 4));
    else if (y === HD + 1) c = lit ? WHITE : 0xf4f1ea;
    else if (y === BL - 1) c = lit ? 0xff4a3a : MK_R;
    else if (y >= BL) c = y === BL ? (lit ? 0x8ab8ff : 0x5a8ae0) : y === bh - 2 ? (lit ? 0x1a4ab0 : 0x122e70) : lit ? mix(0x3a78f0, 0x2a5ad8, (y - BL) / 8) : mix(0x2a5cc0, 0x1a3c8a, (y - BL) / 8);
    else c = lit ? 0xfcfaf4 : jit(0xeceae4, x, y, 862, 0.03);
    if (!lit && (x === bx + 1 || y === 1) && c !== 0x2a2c32) c = mix(c, WHITE, 0.2);
    if (!lit && x === bx + bw - 2 && c !== 0x2a2c32) c = mul(c, 0.85);
    P.px(x, y, c);
  }
  // varumärket (b.sign) i huvudet: en eller två rader, vitt med mörkröd skugga
  const [big, small] = mkMarke(sign), inner = bw - 2, ix = bx + 1, shadow = lit ? 0xa01c14 : MK_RD;
  const put = (F, s, y) => { const tw = textW(F, s), tx = ix + Math.max(0, (inner - tw) >> 1); text(P, F, s, tx + 1, y + 1, shadow); text(P, F, s, tx, y, WHITE); };
  if (big && small) { put(BIG, big, 4); put(SMALL, small, 12); }
  else if (big) put(BIG, big, 6);
  else put(SMALL, small, 7);
  // raderna: etikett (SMALL) och LED-fält (siffrorna i live)
  // BENSIN i mörkt och 95 i grönt; DIESEL i svart med gul/svart bricka på var sida
  const lb = textW(SMALL, 'BENSIN 95'), lx1 = ix + ((inner - lb) >> 1);
  text(P, SMALL, 'BENSIN', lx1, 20, 0x1e2a22); text(P, SMALL, '95', lx1 + textW(SMALL, 'BENSIN ') + 1, 20, 0x1e8a34);
  const ld = textW(SMALL, 'DIESEL'), lx2 = ix + ((inner - ld) >> 1);
  text(P, SMALL, 'DIESEL', lx2, 40, 0x1a1a1e);
  for (const tx2 of [bx + 3, bx + bw - 6]) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) P.px(tx2 + i, 40 + j, ((i + j) & 1) ? 0x1a1a1e : 0xf0c848);
  for (const ly of [27, 47]) {
    P.rect(bx + 3, ly, bw - 6, 11, 0x3a3c42); P.hl(bx + 3, ly, bw - 6, 0x16181c);              // LED-fältet i ram
    P.rect(bx + 4, ly + 1, bw - 8, 9, lit ? 0x0c0a08 : 0x121010);
    P.hl(bx + 3, ly + 10, bw - 6, 0x6a6c72);
  }
  // BILTVÄTT på den blå panelen (vitt med mörkblå skugga)
  const tv = 'BILTVÄTT', tvw = textW(SMALL, tv), tvx = ix + ((inner - tvw) >> 1);
  text(P, SMALL, tv, tvx + 1, BL + 3, lit ? 0x10307a : 0x0e2458); text(P, SMALL, tv, tvx, BL + 2, WHITE);
  if (snow && !lit) {                                                                        // snö på lådans ovankant och på sockeln
    for (let x = bx; x < bx + bw; x++) { P.px(x, 0, hash(x, 1, 863) > 0.2 ? WHITE : 0xe8eef6); if (hash(x, 2, 863) > 0.45) P.px(x, 1, 0xf4f8fc); }
    for (let x = 13; x < 29; x++) P.px(x, H - 4, hash(x, 3, 863) > 0.3 ? WHITE : 0xdce4ee);
  }
  return (MK_IMG[key] = P.flush());
}
// LED-fältens position (i pylonens bild): siffrorna står på fältets andra rad
const MK_LED = [[4, 29], [4, 49]];

// =====================================================================
// Butikens fasad (extra): rött band, plåtpaneler, skyltfönster med affisch och
// varor, biltvätten, luft/vatten och dammsugare, ljuslåda, tak med fläktar.
// K = fasadlådans mått (canvas-koordinater); världens x = X + 1592, y = Y + 454.
// =====================================================================
function mackFasad(P, K) {
  const X = K.X, Y = K.Y, night = K.night;
  // rött varumärkesband överst och panelfogar i plåten
  for (let y = K.ftop; y < K.ftop + 6; y++) for (let x = K.fx0; x < K.fx1; x++) {
    let c = y === K.ftop ? MK_RL : y === K.ftop + 5 ? 0xf4f1ea : jit(mix(MK_R, MK_RD, (y - K.ftop) / 6), x, y, 871, 0.03);
    if (x === K.fx0) c = mix(c, WHITE, 0.2); else if (x === K.fx1 - 1) c = mul(c, 0.72);
    P.px(x, y, c);
  }
  P.hl(K.fx0, K.ftop + 6, K.fx1 - K.fx0, 0x000000, 0.2);
  for (let x = K.fx0 + 16; x < K.fx1 - 4; x += 16) for (let y = K.ftop + 7; y < K.baseY - 5; y++) { P.px(x, y, mul(P.get(x, y), 0.8)); P.px(x + 1, y, mix(P.get(x + 1, y), WHITE, 0.1)); }
  // takets skugga på fasaden under frontlisten
  for (let y = Y(566); y < Y(572); y++) for (let x = X(MK.TAK[0]); x < K.fx1; x++) { const c = P.get(x, y); if (c) P.px(x, y, mul(c, 0.72 + (y - Y(566)) * 0.045)); }
  // ---- västra gaveln: luft/vatten (blå låda med slangvinda) och dammsugaren (gul pelare) ----
  const lx = X(1601), ly = Y(578);
  P.rect(lx, ly, 5, 8, 0x2a5ad0); P.hl(lx, ly, 5, 0x7a9af0); P.vl(lx + 4, ly, 8, 0x1a3a90);
  P.rect(lx + 1, ly + 2, 3, 2, 0xf4f1ea); P.px(lx + 2, ly + 2, 0x2a5ad0);                   // manometern
  for (let j = 0; j < 4; j++) P.px(lx + 1 + (j & 1) * 2, ly + 5 + (j >> 1), 0x1a1a1e);         // slangvindan
  P.vl(lx + 1, ly + 8, 10, 0x9aa0aa); P.vl(lx + 2, ly + 8, 10, 0x6a6e76);                     // stolpen
  P.vl(lx + 5, ly + 5, 11, 0x1a1a1e); P.px(lx + 5, ly + 16, 0x3a3a40); P.px(lx + 6, ly + 16, 0x3a3a40);   // luftslangen hänger
  const dx0 = X(1606), dy0 = Y(574);
  for (let y = 0; y < 22; y++) for (let x = 0; x < 5; x++) {
    let c = y < 3 ? (y === 0 ? 0xfff0a0 : 0x2a2c30) : x === 0 ? 0xffe070 : x === 4 ? 0xb88a10 : jit(0xf0c030, dx0 + x, dy0 + y, 872, 0.05);
    if (y > 18) c = 0x3a3c42;
    P.px(dx0 + x, dy0 + y, c);
  }
  P.rect(dx0 + 1, dy0 + 5, 3, 3, 0x2a2c30); P.px(dx0 + 2, dy0 + 6, 0xd83a2a);                // myntinkastet
  for (let y = 9; y < 17; y++) P.px(dx0 + 5 + ((y >> 1) & 1), dy0 + y, 0x2a2a2e);             // den stora slangen i en båge
  P.px(dx0 + 5, dy0 + 17, 0x5a5e66); P.px(dx0 + 6, dy0 + 17, 0x5a5e66);
  // stuprör på gavelhörnet (mot gränden) – före ljuslådan, som sitter bredvid
  downpipe(P, K.fx0, K.ftop + 7, Y(574));
  // den stående ljuslådan på hörnet (x 1602–1610, bredvid taket): kaffekopp över korv (bilder, ingen text)
  const bx = X(1602), by = Y(542), bw = 9, bhh = 20;
  P.rect(bx, by, bw, bhh, 0x2a2c32); P.vl(bx + bw - 1, by + 1, bhh - 1, 0x1a1c20);
  for (let y = 1; y < bhh - 1; y++) for (let x = 1; x < bw - 1; x++) P.px(bx + x, by + y, night ? mix(0xfff4d8, 0xffe0a0, y / bhh) : mix(0xf8f4ea, 0xdcd8ce, y / bhh));
  P.hl(bx + 1, by + 1, bw - 2, night ? 0xffffff : 0xfdfbf6);
  P.hl(bx + 1, by + 10, bw - 2, night ? 0xe8c890 : 0xc8c2b6);                                 // delningen
  P.px(bx + (bw >> 1), by - 1, 0x5a5e66); P.px(bx + (bw >> 1), by + bhh, 0x5a5e66);             // fästena
  const ikon = (x0, y0, rows, pal) => rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') P.px(x0 + i, y0 + j, pal[row[i]]); });
  ikon(bx + 1, by + 2, ['.G..G..', '..G..G.', 'BBBBB..', 'WWWWWHH', 'WRRRW.H', 'WWWWWHH', '.SSS...'],
    { G: 0xa8a4a0, B: 0x5a3218, W: 0xf8f6f0, R: MK_R, H: 0x9a948c, S: 0xc8c0b4 });                                   // kaffemuggen med ånga
  ikon(bx + 1, by + 12, ['..MM.M.', 'YYYYYYY', 'KKKKKKK', 'yyyyyyy', '.ddddd.'], { M: 0xf0d020, Y: 0xe8b060, K: 0xb84a2a, y: 0xd09040, d: 0xa87030 });   // korv med bröd och senap
  P.hl(bx, by + bhh, bw, 0x000000, 0.22);                                                     // skuggan under lådan
  if (night) K.lit.push([bx + 1 + K.box.x, by + 1 + K.box.y, bw - 2, bhh - 2]);
  // ---- skyltfönstret väster om dörren (x 1612–1634; högra karmen bakom takpelaren) ----
  // affischen är 21 px: KAFFE (19 px) får 1 px luft på var sida
  const wx = X(1612), wy = Y(571), ww = 23, wh = 20;
  windowAt(P, wx, wy, ww, wh, { night, lit: night, frame: 0x3a3e46, sill: 0x9aa0aa });
  // KAFFE-affischen upptill och varorna nertill (läskflaskor, chips, tidningar)
  P.rect(wx + 1, wy + 1, ww - 2, 7, 0x5a3a22); P.hl(wx + 1, wy + 1, ww - 2, 0x7a5232);
  text(P, SMALL, 'KAFFE', wx + 1 + ((ww - 2 - textW(SMALL, 'KAFFE')) >> 1), wy + 2, 0xfff0c0);
  P.px(wx + 1, wy + 7, 0x3a2412); P.px(wx + ww - 2, wy + 7, 0x3a2412);                        // affischens hörn
  for (let i = 0; i < ww - 3; i += 2) { const cc = [0xd83a2a, 0x2a8a3a, 0xffd23f, 0x2a5ad0, 0xf05a8a, 0xe07a2e][(i >> 1) % 6]; P.rect(wx + 2 + i, wy + wh - 4, 1, 2, cc); P.px(wx + 2 + i, wy + wh - 5, mix(cc, WHITE, 0.4)); }
  P.hl(wx + 1, wy + wh - 2, ww - 2, 0x6a6e76);
  // öppettiderna: vit skylt med röd kant mitt i fönstret
  const hw = textW(SMALL, '6-23') + 4, hx = wx + ((ww - hw) >> 1);
  P.rect(hx, wy + 9, hw, 7, 0xf4f1ea); P.box(hx, wy + 9, hw, 7, MK_R);
  text(P, SMALL, '6-23', hx + 2, wy + 10, MK_RD);
  K.out.fonster = [wx + K.box.x, wy + K.box.y, ww, wh];                                   // glow lyser bara upp varuraden (aldrig över texten)
  // ---- biltvätten öster om dörren: rulljalusi med fönsterrad och blått band med en
  // tvättbil (bild, ingen text – takpelaren står framför bandet; BILTVÄTT står på prisskylten) ----
  const tx0 = X(1668), ty0 = Y(571), tw = 28, th = 25;
  P.rect(tx0 - 2, ty0 - 2, tw + 4, th + 2, 0x4a4e56); P.hl(tx0 - 2, ty0 - 2, tw + 4, 0x7a7e86);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    let c = (y % 3) === 2 ? 0x8a9098 : jit(0xc4c8ce, tx0 + x, ty0 + y, 873, 0.04);
    if ((y % 3) === 0) c = mix(c, WHITE, 0.2);
    if (x === 0) c = mix(c, WHITE, 0.15); else if (x === tw - 1) c = mul(c, 0.8);
    P.px(tx0 + x, ty0 + y, c);
  }
  for (let i = 0; i < 5; i++) { P.rect(tx0 + 2 + i * 5, ty0 + 4, 4, 2, night ? 0x6a8ab8 : 0x3a5a7a); P.px(tx0 + 2 + i * 5, ty0 + 4, night ? 0xa8c8f0 : 0x8ab0d0); }
  P.rect(tx0, ty0 + 11, tw, 7, 0x1f4fa8); P.hl(tx0, ty0 + 11, tw, 0x4a7ad8); P.hl(tx0, ty0 + 17, tw, 0x163a80);
  // tvättbilen väster om pelaren (x 1669–1679) och bubblor öster om den
  const bil = ['...#####...', '..#.#.#.#..', '###########', '###########', '.##.....##.'];
  bil.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(tx0 + 1 + i, ty0 + 12 + j, j === 4 ? 0xc8d8f0 : WHITE); });
  P.px(tx0 + 4, ty0 + 14, 0x7aa8f0); P.px(tx0 + 8, ty0 + 14, 0x7aa8f0);                           // lyktorna
  for (const [bx2, by2, c] of [[tx0 + 19, ty0 + 13, WHITE], [tx0 + 21, ty0 + 15, 0xa8c8f8], [tx0 + 18, ty0 + 16, 0xa8c8f8], [tx0 + 22, ty0 + 12, 0xd8e8ff], [tx0 + 13, ty0 + 12, 0xa8c8f8]]) P.px(bx2, by2, c);
  P.rect(tx0 + 19, ty0 + 13, 2, 2, WHITE); P.px(tx0 + 20, ty0 + 14, 0x7aa8f0);
  P.rect(tx0 + (tw >> 1) - 3, ty0 + th - 3, 6, 1, 0x2a2c30);                                  // handtaget
  K.out.tvatt = [tx0 + 2 + K.box.x, ty0 + 4 + K.box.y];
  // statuslampan bredvid porten (grön = ledig, röd = tvätt pågår – tänds i live)
  P.rect(X(1697), Y(574), 2, 6, 0x2a2c30);
  K.out.tvattLampa = [X(1697) + K.box.x, Y(574) + K.box.y];
  // löpsedelsstället mellan dörren och tvätten
  P.rect(X(1661), Y(584), 5, 11, 0x8a6a3a); P.rect(X(1662), Y(585), 3, 7, 0xf4f1ea); P.hl(X(1662), Y(586), 3, 0xd83a2a); P.hl(X(1662), Y(588), 3, 0x3a3a40); P.hl(X(1662), Y(590), 3, 0x3a3a40);
  // ---- taket (syns från parken): biltvättens hallak i korrugerad plåt med ångröret,
  // solpaneler, fläktaggregatet med kanal, takluckan med räcke och parabolen ----
  const snow = !!K.opts?.snow, rt = K.rtop, fb = K.ftop - 4;
  // tvätthallens tak (x 1664–1700): upphöjt, ljus plåt med ribbor var tredje pixel
  const hx0 = X(1664), hx1 = K.fx1;
  for (let y = rt + 1; y < fb; y++) for (let x = hx0; x < hx1; x++) {
    const r = (x - hx0) % 3;
    let c = r === 0 ? 0xd4d8de : r === 1 ? 0xb8bcc4 : 0x8e949c;
    c = mix(c, 0x6a7078, (y - rt) / (fb - rt) * 0.25);
    if (y === rt + 1) c = 0xe8ecf0; else if (y === fb - 1) c = 0x5a5e66;
    if (x === hx0) c = 0x4a4e56; else if (x === hx0 + 1) c = 0xe4e8ec; else if (x === hx1 - 1) c = mul(c, 0.7);
    if (snow && y < fb - 1 && x > hx0 && hash(x, y, 874) > 0.1) c = r === 2 ? 0xd8e0ea : hash(x, y, 875) > 0.8 ? WHITE : 0xeef2f8;
    P.px(x, y, c);
  }
  P.hl(hx0, fb, hx1 - hx0, 0x000000, 0.3); P.vl(hx0 - 1, rt + 2, fb - rt - 2, 0x000000, 0.25);   // hallen kastar skugga på gruset
  // ångröret i rostfritt med regnhatt, fläktlådan och takluckan på hallen
  const px0 = X(1686), py0 = rt + 4;
  for (let y = py0; y < py0 + 12; y++) { P.px(px0, y, 0xe8ecf0); P.px(px0 + 1, y, 0xc4c8ce); P.px(px0 + 2, y, 0x9aa0a8); P.px(px0 + 3, y, 0x6a7078); }
  P.hl(px0 - 1, py0 - 1, 6, 0x5a5e66); P.hl(px0 - 1, py0 - 2, 6, snow ? WHITE : 0xb8bcc4); P.hl(px0, py0 - 3, 4, snow ? 0xeef2f8 : 0x8a9098);
  P.hl(px0, py0 + 12, 4, 0x000000, 0.3);
  K.out.anga = [px0 + 2 + K.box.x, py0 - 4 + K.box.y];
  const fx = X(1670), fy = rt + 12;
  P.rect(fx, fy, 9, 7, 0xa4a8b0); P.hl(fx, fy, 9, snow ? WHITE : 0xd0d4da); P.hl(fx, fy + 6, 9, 0x5a5e66); P.vl(fx + 8, fy, 7, 0x6a6e76);
  P.ell(fx + 4, fy + 3.5, 2.4, 2.4, 0x2a2e36, 1, 2); P.px(fx + 4, fy + 3, 0x9aa0a8); P.px(fx + 3, fy + 4, 0x5a5e66);
  // solpanelerna på butikens tak (tre moduler i rad, lutade mot söder)
  for (let k = 0; k < 3; k++) {
    const sx = X(1628) + k * 11, sy = rt + 5;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) {
      let c = mix(0x1e2a4a, 0x2e4478, y / 8);
      if (x % 3 === 2 || y % 3 === 2) c = 0x5a6a8a;                                           // cellnätet
      if (((x - y) % 9 + 9) % 9 === 0) c = mix(c, 0x9ab8e8, 0.45);                            // himlen speglas
      if (x === 0 || x === 9 || y === 0 || y === 7) c = y === 7 ? 0x8a8e96 : 0xc8ccd2;          // aluminiumramen
      if (snow && y < 6 && hash(sx + x, y, 876) > 0.25) c = hash(sx + x, y, 877) > 0.7 ? WHITE : 0xe4ecf6;
      P.px(sx + x, sy + y, c);
    }
    P.hl(sx, sy + 8, 10, 0x2a2c30); P.px(sx + 1, sy + 9, 0x3a3e46); P.px(sx + 8, sy + 9, 0x3a3e46);   // stativet
    P.hl(sx, sy + 10, 10, 0x000000, 0.25);
  }
  // fläktaggregatet med kanalen ner i taket
  const ax = X(1606), ay = rt + 7;
  P.rect(ax, ay, 16, 10, 0xb4b8be); P.hl(ax, ay, 16, snow ? WHITE : 0xdadde2); P.hl(ax, ay + 9, 16, 0x6a6e76); P.vl(ax + 15, ay, 10, 0x8a8e96);
  for (const dx of [4, 11]) { P.ell(ax + dx, ay + 5, 3, 3, 0x3a3e46, 1, 2); P.px(ax + dx, ay + 5, 0x8a8e96); P.px(ax + dx - 1, ay + 4, 0x5a5e66); P.px(ax + dx + 1, ay + 6, 0x5a5e66); }
  P.darken(ax + 16, ay + 2, 3, 9, 0.72);
  for (let y = ay + 10; y < ay + 16; y++) { P.px(ax + 6, y, 0xc8ccd2); P.px(ax + 7, y, 0xa0a4ac); P.px(ax + 8, y, 0x7a808a); }   // kanalen
  P.rect(ax + 5, ay + 16, 5, 2, 0x8a8e96); P.hl(ax + 5, ay + 16, 5, 0xb8bcc4);
  // takluckan med räcke och parabolen
  const lx0 = X(1644), ly0 = rt + 22;
  P.rect(lx0, ly0, 8, 6, 0x8a8e96); P.box(lx0, ly0, 8, 6, 0x5a5e66); P.hl(lx0, ly0, 8, snow ? WHITE : 0xb0b4ba); P.px(lx0 + 6, ly0 + 3, 0xd8a020);
  P.vl(lx0 - 2, ly0 - 4, 7, 0xd8a020); P.vl(lx0 + 9, ly0 - 4, 7, 0xd8a020); P.hl(lx0 - 2, ly0 - 4, 12, 0xf0c040);   // gula räcket
  P.ell(X(1628), rt + 24, 3.5, 3, snow ? 0xf4f6fa : 0xd8dce0, 1, 2); P.px(X(1628), rt + 24, 0x6a6e76); P.px(X(1629), rt + 27, 0x6a6e76); P.px(X(1629), rt + 28, 0x4a4e56);
  vent(P, X(1658), rt + 26); vent(P, X(1614), rt + 27);
}
// ---- butiken: ånga ur tvättens skorsten, statuslampan, dörren när föraren går in/ut ----
function mackLive(ctx, b, st, m) {
  const tvatt = mkTvattar(st);
  if (m.anga && tvatt) puffs(ctx, m.anga[0], m.anga[1], st.t, { n: 5, rate: 0.35, rise: 16, drift: 5 + (st.env?.weather?.wind || 0) * 0.5, tone: st.night ? 0x9aa0b0 : 0xf0f2f6, alpha: 0.45 });
  if (m.tvattLampa) {
    const [x, y] = m.tvattLampa;
    ctx.fillStyle = tvatt ? '#ff3a2a' : '#4a1410'; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = tvatt ? '#14401c' : '#40e060'; ctx.fillRect(x, y + 3, 2, 2);
  }
  // borstarna snurrar bakom tvättens fönster när en tvätt pågår
  if (m.tvatt && tvatt) {
    const [x, y] = m.tvatt, f = Math.floor(st.t * 8);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = (i + f) % 3 === 0 ? '#2a6ad8' : (i + f) % 3 === 1 ? '#d83a2a' : '#3a8ae8'; ctx.fillRect(x + i * 5 + ((f + i) & 1) * 2, y, 2, 2); }
    ctx.fillStyle = 'rgba(220,236,255,0.5)'; ctx.fillRect(x + ((f * 3) % 22), y, 1, 1);
  }
  // föraren som går in/ut: dörren glider upp (den skymtade interiören)
  const d = MKS.door || 0;
  if (d > (st.doorOpen || 0) + 0.02) drawInre(ctx, b, { night: st.night, doorOpen: d });
}
// biltvätten "går" en stund varje kvart på dagen/kvällen
const mkTvattar = (st) => st.hour >= 7 && st.hour < 22 && ((st.hour * 60) % 15) < 6;

// =====================================================================
// Simuleringen: bilarna och förarna. MKS lever mellan bildrutorna; items()
// stegar den (dt ur st.t). Efter ett avbrott (> 2,5 s) börjar den om med 0–2
// bilar som redan står och tankar.
// =====================================================================
const MKS = { t: null, cars: [], next: 0, id: 0, door: 0 };
const MK_KAST = ['kaffe', 'kaffe', 'korv', 'tidning', null];
function mkRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mkBil(target) {
  const r = Math.random, kind = MB_KINDS[(r() * MB_KINDS.length) | 0];
  return {
    id: ++MKS.id, kind, L: MKB[kind].L, color: MK_PAINT[(r() * MK_PAINT.length) | 0], variant: (r() * 997) | 0,
    diesel: r() < 0.3, liter: 16 + Math.round(r() * 26), target, seg: 'inn', p: 0, v: 34, dist: 0, brake: false, blink: 0,
    fas: 'kor', ft: 0, klar: false, inne: r() < 0.62, kast: MK_KAST[(r() * MK_KAST.length) | 0], forare: null, seed: (r() * 1e9) | 0, tank: 0, tankKr: 0,
  };
}
// förarens utseende: stadens figurmotor med ett eget frö (vuxen)
function mkLook(car) {
  if (car.look !== undefined) return car.look;
  if (!MK_PEOPLE || !MK_PEOPLE.makeLook) return null;
  const rng = mkRng(car.seed);
  let L = MK_PEOPLE.makeLook(rng);
  for (let i = 0; i < 30 && L.kid; i++) L = MK_PEOPLE.makeLook(rng);
  return (car.look = L);
}
// trafiken på Infarten (läses om scenen ger den; annars kör macken utan hänsyn)
function mkTrafik(env) {
  try {
    const T = env?.traffic || globalThis.SF?.scene?._debug?.sim?.()?.traffic;
    const v = T?.vehicles?.();
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
// Får en bil ge sig ut på Infarten? 'in' = en ny bil ska börja rulla ner i det södergående
// körfältet vid ys (ovanför bild): inget i det körfältet från 320 px bakom till mackens hörn.
// 'ut' = en bil ska svänga ut över båda körfälten: inget södergående från ~180 px norr om
// hörnet ner till övergångsstället (kön där räknas), inget norrgående i hörnet eller på väg
// in från Södergatan, och ingen österut på Södergatan som kan svänga in bakom.
function mkInfartFri(env, vad, ys) {
  for (const v of mkTrafik(env)) {
    if (v.road === 'infarten') {
      const y0 = v.y0 ?? v.y, y1 = v.y1 ?? v.y;
      if (vad === 'in' && v.dir > 0 && y1 > ys - 320 && y0 < 700) return false;
      if (vad === 'ut' && v.dir > 0 && y1 > 430 && y0 < 668) return false;
      if (vad === 'ut' && v.dir < 0 && y1 > 560 && y0 < 740) return false;
    } else if (vad === 'ut' && v.road === 'sodergatan' && v.dir > 0 && v.x1 > 1470 && v.x0 < 1745) return false;   // kan svänga in bakom
  }
  return true;
}
// Trafiken i samma körfält på Infarten som en av mackens bilar (dir 1 = söderut, fronten på
// p; −1 = norrut, bakänden på p). fram/bak = luckan i px till närmaste bil framför/bakom.
function mkGrannar(env, dir, p) {
  const g = { fram: Infinity, framV: 0, bak: Infinity, bakV: 0 };
  for (const v of mkTrafik(env)) {
    if (v.road !== 'infarten' || v.axis !== 'y' || v.dir !== dir) continue;
    const y0 = v.y0 ?? v.y, y1 = v.y1 ?? v.y;
    if (dir > 0) {
      if (y0 >= p - 6) { if (y0 - p < g.fram) { g.fram = y0 - p; g.framV = v.v || 0; } }
      else if (y1 <= p - 24) { const d = p - 30 - y1; if (d < g.bak) { g.bak = d; g.bakV = v.v || 0; } }
    } else {
      if (y1 <= p - 24) { const d = p - 30 - y1; if (d < g.fram) { g.fram = d; g.framV = v.v || 0; } }
      else if (y0 >= p - 6) { if (y0 - p < g.bak) { g.bak = y0 - p; g.bakV = v.v || 0; } }
    }
  }
  return g;
}
// var bilen står (för ritning och för folk-i-vägen): side = från sidan, end = fram/bak
function mkPose(car) {
  const s = car.seg, p = car.p;
  if (s === 'inn') return { end: true, rear: false, cx: Math.round(mkInnX(p)), fy: p };
  if (s === 'u') return { end: true, rear: false, cx: MK.XU, fy: p };
  if (s === 'ut') return { end: true, rear: true, cx: Math.round(mkUtX(p)), fy: p };
  if (s === 'nord') return { end: false, dir: -1, x0: p, fy: MK.YN };
  return { end: false, dir: 1, x0: p, fy: MK.YS };
}
// Var mackens bilar står just nu, för grannarna: env.mack = { t, rutor, punkter }.
//   rutor   = bilarnas fotavtryck på marken [x0, y0, x1, y1] (för fotgängare/spelaren)
//   punkter = bilens fram- och bakkant där den står i något av Infartens körfält, i samma
//             form som env.people ({ x, y }) – traffic.js kan lägga dem till sina "folk på
//             vägen" och väjer då för mackens bilar som för folk
//   t       = st.t när de skrevs (gammal = macken ritas inte längre – strunta i dem)
function mkPublicera(st) {
  const env = st.env;
  if (!env || typeof env !== 'object') return;
  const rutor = [], punkter = [];
  for (const c of MKS.cars) {
    const P = mkPose(c);
    const r = P.end ? [P.cx - 12, Math.round(P.fy) - 22, P.cx + 12, Math.round(P.fy)] : [Math.round(P.x0), P.fy - 10, Math.round(P.x0) + c.L, P.fy + 1];
    rutor.push(r);
    if (r[2] > MK.KANT) for (const x of [MK.LS, MK.LN]) if (x >= r[0] - 4 && x <= r[2] + 4) { punkter.push({ x, y: r[1], mack: true }); punkter.push({ x, y: r[3], mack: true }); }
  }
  env.mack = { t: st.t, rutor, punkter };
}
// står någon (folk, spelare, en förare) i vägen framför bilen?
function mkFolkFram(car, st) {
  const P = mkPose(car), folk = [...(st.env?.people || [])];
  for (const c of MKS.cars) if (c.forare && c.forare.vis) folk.push(c.forare);
  for (const q of folk) {
    if (!q) continue;
    if (!P.end) {
      const front = P.dir < 0 ? P.x0 : P.x0 + car.L, a = (q.x - front) * P.dir;
      if (a > -2 && a < 12 && q.y > P.fy - 8 && q.y < Math.min(P.fy + 6, MK.FRONT + 1)) return true;   // folk på trottoaren (väntar vid övergångsstället) räknas inte
    } else {
      const front = P.rear ? P.fy - 30 : P.fy, a = P.rear ? front - q.y : q.y - front;
      if (Math.abs(q.x - P.cx) < 13 && a > -2 && a < 12) return true;
    }
  }
  return false;
}
// förarens väg: punkter (x, y) att gå mellan
function mkRutter(car) {
  const L = car.L;
  if (car.target === 2) {
    const xf = MK.XR2 - L, dorr = [xf + 21, MK.YN + 3], tank = [MK.XR2 - 12, MK.YN + 3];
    return { dorr, tank, dir: 'right', tillButik: [tank, [MK.XR2 + 4, MK.YN + 3], [MK.XR2 + 4, 600], [MK.DOOR[0], 600], [MK.DOOR[0], 594]] };
  }
  const xr = MK.XR1, dorr = [xr + L - 21, MK.YS - 10], tank = [xr + 8, MK.YS - 10];
  return { dorr, tank, dir: 'down', tillButik: [tank, [1603, MK.YS - 10], [1603, 600], [MK.DOOR[0], 600], [MK.DOOR[0], 594]] };
}
function mkGa(f, dt) {                                  // förarens gång längs f.route
  if (!f.route || f.ri >= f.route.length) return true;
  let left = dt * 24;
  while (left > 0 && f.ri < f.route.length) {
    const [tx, ty] = f.route[f.ri], dx = tx - f.x, dy = ty - f.y, d = Math.abs(dx) + Math.abs(dy);
    if (d < 0.01) { f.ri++; continue; }
    const step = Math.min(left, Math.abs(dx) > 0.01 ? Math.abs(dx) : Math.abs(dy));
    if (Math.abs(dx) > 0.01) { f.x += Math.sign(dx) * step; f.dir = dx > 0 ? 'right' : 'left'; }
    else { f.y += Math.sign(dy) * step; f.dir = dy > 0 ? 'down' : 'up'; }
    left -= step; f.anim += step / 3.5;
  }
  f.moving = true;
  return f.ri >= f.route.length;
}
// bilarna som redan står och tankar när man kommer dit
function mkBorja(st) {
  MKS.cars = []; MKS.door = 0;
  const h = st.hour || 0, dag = h >= 6 && h < 23;
  for (const target of [2, 1]) {
    if (Math.random() > (dag ? 0.6 : 0.25)) continue;
    const c = mkBil(target), R = mkRutter(c);
    c.seg = target === 2 ? 'nord' : 'syd'; c.p = target === 2 ? MK.XR2 - c.L : MK.XR1; c.v = 0;
    c.fas = 'tanka'; c.tank = Math.random() * c.liter * 0.8; c.ft = 0;
    c.forare = { x: R.tank[0], y: R.tank[1], dir: R.dir, anim: 0, vis: true, route: null, ri: 0, carry: null };
    MKS.cars.push(c);
  }
  MKS.next = st.t + 2 + Math.random() * 6;
}
function mkSteg(st, b) {
  const t = st.t;
  if (MKS.t === null || t < MKS.t || t - MKS.t > 2.5) { MKS.t = t; mkBorja(st); return; }
  const dt = Math.min(0.1, t - MKS.t);
  MKS.t = t;
  if (dt <= 0) return;
  const env = st.env, h = st.hour || 0, dag = h >= 6 && h < 23, vy = env?.view?.y ?? 0;
  const busy = (...segs) => MKS.cars.some((c) => segs.includes(c.seg));
  // ny bil ner för Infarten (utanför bild) när norra körfältet och U-svängen är tomma och
  // ingen bil är på väg ut i hörnet (hörnet mot Infarten har en bil i taget)
  if (t >= MKS.next && !busy('inn', 'nord', 'u') && MKS.cars.length < 3) {
    const ys = Math.max(300, Math.min(566, vy - 4));
    const horn = MKS.cars.some((c) => (c.seg === 'ut' && c.p > 540) || (c.seg === 'syd' && c.ute));
    if (!horn && mkInfartFri(env, 'in', ys)) {
      const c = mkBil(busy('syd') ? 2 : 1);
      c.p = ys; MKS.cars.push(c);
      MKS.next = t + (dag ? 6 + Math.random() * 12 : 20 + Math.random() * 40);
    } else MKS.next = t + 1.2;
  }
  // bilarna kör
  for (const c of MKS.cars) {
    if (c.fas !== 'kor') continue;
    const s = c.seg;
    let cruise = s === 'inn' ? 36 : s === 'ut' ? 44 : s === 'u' ? 11 : 17, stop = null, sg = 1, minV = 0;
    const halt = (x) => { stop = stop === null ? x : sg > 0 ? Math.min(stop, x) : Math.max(stop, x); };
    if (s === 'inn') {
      cruise = Math.min(cruise, 12 + Math.sqrt(2 * 40 * Math.max(0, MK.YN - c.p)));
      // en bil på väg ut i hörnet (spärren vid starten tar nästan allt): vänta innan bilen drar sig ut mot kanten
      if (c.p < MK.YN - MK.IN_D && MKS.cars.some((o) => (o.seg === 'ut' && o.p > 575) || (o.seg === 'syd' && o.ute))) halt(MK.YN - MK.IN_D - 2);
      const g = mkGrannar(env, 1, c.p);
      if (g.fram < 70 && c.p + g.fram < MK.YN + 1) halt(c.p + g.fram - 5);            // kö framför som står i vägen för svängen
      if (g.bak < 80) {                                                                   // trafik bakifrån
        if (c.p < vy - 1) c.bort = true;                                                  // ännu utanför bild: den bilen kom aldrig
        else if (c.p < MK.YN - 60) minV = Math.min(cruise, g.bakV + 4);                  // i bild: håll undan så länge det går
      }
    } else if (s === 'nord') { sg = -1; if (c.target === 2 && !c.klar) stop = MK.XR2 - c.L; else if (busy('u', 'syd') && !c.passerar) stop = MK.XR2 - c.L; else c.passerar = true; }
    else if (s === 'u') sg = 1;
    else if (s === 'syd') {
      if (c.target === 1 && !c.klar) stop = MK.XR1;
      else if (!c.ute) {
        // fronten väntar vid Infartens kant tills båda körfälten och hörnet är fria, sedan rullar den ut utan att stanna
        const vanta = MK.KANT - 1 - c.L;
        const fritt = mkInfartFri(env, 'ut') && !MKS.cars.some((o) => o !== c && (o.seg === 'inn' || (o.seg === 'ut' && o.p > 560) || (o.seg === 'nord' && o.p + o.L > MK.KANT)));
        if (fritt && c.p >= vanta - 10) c.ute = true; else stop = vanta;
      }
    } else if (s === 'ut') {
      sg = -1;
      if (c.p > MK.YS - MK.UT_D) cruise = 15;                                             // mitt i svängen
      const g = mkGrannar(env, -1, c.p);
      if (g.fram < 60) halt(c.p - (g.fram - 6));                                          // trafik framför (norrut): håll avstånd
      if (g.bak < 70) minV = Math.min(52, g.bakV + 4);                                     // trafik bakifrån: kör undan
      const ahead = MKS.cars.find((o) => o !== c && o.seg === 'ut' && o.p < c.p);
      if (ahead && c.p - 30 - ahead.p < 20) halt(ahead.p + 38);
    }
    let vT = cruise;
    if (stop !== null) { const d = (stop - c.p) * sg; vT = Math.min(vT, Math.sqrt(2 * 40 * Math.max(0, d))); if (d <= 0.4) { c.p = stop; c.v = 0; vT = 0; } }
    if (minV && stop === null) vT = Math.max(vT, minV);
    if (mkFolkFram(c, st)) vT = 0;
    const was = c.v;
    c.v = c.v < vT ? Math.min(vT, c.v + (s === 'ut' ? 42 : 30) * dt) : Math.max(vT, c.v - 70 * dt);
    c.brake = c.v < was - 0.05 || (c.v < 0.5 && stop !== null);
    c.p += c.v * dt * sg; c.dist += c.v * dt;
    // svängarna: bilen vrids kring sin mitt (som trafikens svängar i T-korsningarna)
    c.blink = (s === 'inn' && c.p > MK.YN - 60) || s === 'u' || (s === 'ut' && c.p > MK.YS - MK.UT_D) || (s === 'syd' && (c.klar || c.target !== 1) && c.p + c.L > 1680) || (s === 'nord' && (c.passerar || c.klar) && c.p < 1650) ? 1 : 0;
    if (s === 'inn' && c.p >= MK.YN) { c.seg = 'nord'; c.p = Math.round(MK.XIN - c.L / 2); c.v = Math.min(c.v, 12); }
    else if (s === 'nord' && c.p + c.L / 2 <= MK.XU) { c.seg = 'u'; c.p = MK.YN; c.v = Math.min(c.v, 10); }
    else if (s === 'u' && c.p >= MK.YS) { c.seg = 'syd'; c.p = Math.round(MK.XU - c.L / 2); c.v = Math.min(c.v, 10); c.passerar = c.target !== 1; }
    else if (s === 'syd' && c.p + c.L / 2 >= MK.XUT) { c.seg = 'ut'; c.p = MK.YS; c.v = Math.min(c.v, 14); }
    // framme vid pumpen
    if (c.v === 0 && !c.klar && ((c.seg === 'nord' && c.target === 2 && c.p === MK.XR2 - c.L) || (c.seg === 'syd' && c.target === 1 && c.p === MK.XR1))) { c.fas = 'stanna'; c.ft = 0; }
  }
  // förarna
  const open = mkOppet(b, h);
  let dorrVill = 0;
  for (const c of MKS.cars) {
    if (c.fas === 'kor') continue;
    const R = mkRutter(c), f = c.forare;
    c.ft += dt;
    if (f) f.moving = false;
    switch (c.fas) {
      case 'stanna': if (c.ft > 0.7) { c.fas = 'ut'; c.ft = 0; c.forare = { x: R.dorr[0], y: R.dorr[1], dir: R.dir === 'right' ? 'right' : 'left', anim: 0, vis: true, route: [R.tank], ri: 0, carry: null }; } break;
      case 'ut': if (c.ft > 0.45) { c.fas = 'tillPump'; c.ft = 0; } break;
      case 'tillPump': if (mkGa(f, dt)) { f.dir = R.dir; c.fas = 'tanka'; c.ft = 0; c.tank = 0; } break;
      case 'tanka': c.tank = Math.min(c.liter, c.tank + dt * 3.4); if (c.tank >= c.liter) { c.fas = 'hang'; c.ft = 0; } break;
      case 'hang':
        if (c.ft > 0.7) {
          c.ft = 0;
          if (c.inne && open) { c.fas = 'tillButik'; f.route = R.tillButik.slice(1); f.ri = 0; }
          else { c.fas = 'kort'; }
        }
        break;
      case 'kort': if (c.ft > 2.4) { c.fas = 'tillBil'; c.ft = 0; f.route = [R.dorr]; f.ri = 0; } break;
      case 'tillButik': if (mkGa(f, dt)) { c.fas = 'inne'; c.ft = 0; c.inneT = 3 + Math.random() * 3.5; f.vis = false; } break;
      case 'inne': if (c.ft > c.inneT) { c.fas = 'fromButik'; c.ft = 0; f.vis = true; f.carry = c.kast; f.route = [...R.tillButik].reverse().slice(1).concat([R.dorr]); f.route.splice(f.route.length - 2, 1); f.ri = 0; } break;
      case 'fromButik': if (mkGa(f, dt)) { c.fas = 'in'; c.ft = 0; } break;
      case 'tillBil': if (mkGa(f, dt)) { c.fas = 'in'; c.ft = 0; } break;
      case 'in': if (c.ft > 0.45) { c.fas = 'klar'; c.ft = 0; c.forare = null; c.klar = true; } break;
      case 'klar':
        if (c.ft > 0.8) {
          if (c.seg === 'nord' && MKS.cars.some((o) => o !== c && (o.seg === 'u' || o.seg === 'syd'))) break;   // södra körfältet är upptaget
          c.fas = 'kor'; c.v = 0;
        }
        break;
    }
    // dörren: föraren nära tröskeln eller precis innanför
    if (c.forare && c.forare.vis && Math.abs(c.forare.x - MK.DOOR[0]) < 6 && c.forare.y < 603) dorrVill = 1;
    if (c.fas === 'inne' && (c.ft < 0.5 || c.ft > c.inneT - 0.7)) dorrVill = 1;
  }
  MKS.door += Math.sign(dorrVill - MKS.door) * Math.min(Math.abs(dorrVill - MKS.door), dt * 3);
  // bilar som kört ut ur bild försvinner (och de som aldrig hann synas när trafik kom bakifrån)
  MKS.cars = MKS.cars.filter((c) => !c.bort && !(c.seg === 'ut' && (c.p < vy - 2 || c.p < 300)));
  mkPublicera(st);
}
// =====================================================================
// Ritningen
// =====================================================================
function mkDrawCar(ctx, c, st) {
  const P = mkPose(c), w = st.env?.weather || {}, snow = (w.snowCover || 0) > 0.35;
  if (P.end) {
    const A = mbEndArt(c, P.rear), x = P.cx - (A.W >> 1), y = Math.round(P.fy) - A.gy;
    ctx.drawImage(A.img, x, y);
    if (P.rear && A.brake && (c.brake || c.v < 0.5)) ctx.drawImage(A.brake, x, y);
    if (snow) ctx.drawImage(A.snow, x, y);
    if (c.blink && Math.floor(st.t * 3) % 2 === 0) { ctx.fillStyle = '#ffb020'; const bx = c.seg === 'inn' || c.seg === 'ut' ? x + 3 : x + A.W - 5; ctx.fillRect(bx, Math.round(P.fy) - 9, 2, 2); }   // in (framifrån, höger) och ut (bakifrån, vänster): bildens vänster; U-svängen (framifrån, vänster): bildens höger
    return;
  }
  const s = MKB[c.kind], empty = !!(c.forare || c.fas === 'in'), A = mbSideArt(c, empty), f = P.dir < 0 ? 1 : 0;
  const x0 = Math.round(P.x0), top = P.fy - 1 - A.gy;
  ctx.drawImage(A.img[f], x0 - 1, top);
  if (A.brake && (c.brake || (c.fas === 'kor' && c.v < 0.5))) ctx.drawImage(A.brake[f], x0 - 1, top);
  if (snow) ctx.drawImage(A.snow[f], x0 - 1, top);
  const per = (Math.PI * 2) / MB_RIMN[s.rim], rot = (c.dist / s.r) * P.dir, fr = Math.floor(((((rot % per) + per) % per) / per) * MB_NF) % MB_NF;
  const wimg = mbWheel(s.r, s.rim, fr);
  for (const wxp of s.wheels) { const q = f ? s.L - 1 - wxp : wxp; ctx.drawImage(wimg, x0 + q - s.r, P.fy - 1 - 2 * s.r); }
  // förardörren står öppen när föraren kliver ur/in (bara på den synliga sidan: norra körfältet)
  if (c.seg === 'nord' && (c.fas === 'ut' || c.fas === 'in')) {
    const [d0, d1] = s.door, q0 = f ? s.L - 1 - d1 : d0, q1 = f ? s.L - 1 - d0 : d1, h0 = 4, h1 = s.belt + 6;
    ctx.fillStyle = '#1e2026'; ctx.fillRect(x0 + q0 + 1, P.fy - 1 - h1, q1 - q0 - 1, h1 - h0);
    ctx.fillStyle = '#3a3c46'; ctx.fillRect(x0 + q0 + 2, P.fy - 1 - s.belt + 1, q1 - q0 - 4, 4);          // sätet
    const hx = f ? x0 + q0 - 1 : x0 + q1;                                                                  // dörrbladet i gångjärnet (fram)
    ctx.fillStyle = rgb(mul(c.color, 0.8)); ctx.fillRect(hx - (f ? 2 : 0), P.fy - 1 - h1 + 2, 3, h1 - h0 + 1);
    ctx.fillStyle = rgb(mix(c.color, WHITE, 0.3)); ctx.fillRect(hx - (f ? 2 : 0), P.fy - 1 - h1 + 2, 3, 1);
  }
  if (c.blink && Math.floor(st.t * 3) % 2 === 0) {
    ctx.fillStyle = '#ffb020';
    const hy = P.fy - 1 - s.head.h0, ty = P.fy - 1 - s.tail.h0 - 1;
    ctx.fillRect(f ? x0 : x0 + s.L - 2, hy - 1, 2, 2); ctx.fillRect(f ? x0 + s.L - 2 : x0, ty, 2, 2);
  }
}
// föraren: stadens figur, med kaffe/korv/tidning i handen och munstycket vid tanklocket
function mkHand(f, look) {
  const K = !!look?.kid, tw = K ? 4 : (look?.build || 5), fr = f.frame;
  const bob = fr === 3 || fr === 4 ? -1 : 0;
  if (f.dir === 'down' || f.dir === 'up') { const sw = fr === 1 ? 1 : fr === 2 ? -1 : 0; return { x: Math.round(f.x) + tw, y: Math.round(f.y) - 13 + bob - sw }; }
  const a = fr === 1 ? -3 : fr === 2 ? 3 : 0;
  return { x: f.dir === 'right' ? Math.round(f.x) + a : Math.round(f.x) - 1 - a, y: Math.round(f.y) - 13 + bob };
}
const MK_BAR = {
  kaffe: { rows: ['wwww', 'WccW', 'WssW', 'WssW', '.WW.'], pal: { w: 0xf4f1ea, W: 0xd8d2c4, c: 0x2a2226, s: 0xb07a44 }, ax: 1, ay: 2 },
  korv: { rows: ['.bbbbb', 'bkkkkkb', '.bbbbb'], pal: { b: 0xe8b060, k: 0xb84a2a }, ax: 1, ay: 1 },
  tidning: { rows: ['WWWWW', 'WRRRW', 'WkkkW', 'WkWkW', 'wwwww'], pal: { W: 0xf4f1ea, w: 0xc8c4bc, R: 0xe0302a, k: 0x3a3a40 }, ax: 2, ay: 1 },
};
function mkDrawCarry(ctx, what, x, y) {
  const S = MK_BAR[what];
  if (!S) return;
  S.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; ctx.fillStyle = rgb(S.pal[ch]); ctx.fillRect(x - S.ax + i, y - S.ay + j, 1, 1); } });
}
function mkDrawDriver(ctx, c, b) {
  const f = c.forare, look = mkLook(c);
  if (!f || !f.vis || !look || !MK_PEOPLE?.drawPerson) return;
  f.frame = f.moving ? MK_WALK[Math.floor(f.anim) % 4] : 0;
  const X = Math.round(f.x), Y = Math.round(f.y), dbase = baseOf(b), clip = Y < dbase + 4 && Math.abs(X - MK.DOOR[0]) < 12;
  if (clip) {
    const dw = b.door.x1 - b.door.x0, op = Math.round(dw * clamp(MKS.door, 0, 1));
    ctx.save(); ctx.beginPath();
    ctx.rect(b.door.x0 + ((dw - op) >> 1), dbase - 26, op, 26); ctx.rect(X - 20, dbase, 40, 60); ctx.clip();
  }
  MK_PEOPLE.drawPerson(ctx, X, Y, look, f.dir, f.frame);
  if (f.carry) { const hnd = mkHand(f, look); mkDrawCarry(ctx, f.carry, hnd.x, hnd.y); }
  if (clip) ctx.restore();
}
// slangen och munstycket under tankningen: ritas framför föraren. Pump 2 (norra körfältet):
// munstycket i handen och piggen in i tanklocket; pump 1: slangen går ner bakom bilen.
function mkDrawHose(ctx, c) {
  const f = c.forare;
  if (!f || c.fas !== 'tanka') return;
  const look = mkLook(c);
  const hnd = look ? mkHand({ ...f, frame: 0 }, look) : { x: Math.round(f.x), y: Math.round(f.y) - 13 };
  const px = c.target === 2 ? MK.P2 : MK.P1, sx = px - 1, sy = MK.PY - (MK_PH - 1) + 8;    // slangens fäste på pumpens vänstra sida
  const ex = c.target === 2 ? hnd.x - 1 : hnd.x, ey = c.target === 2 ? hnd.y + 1 : hnd.y;
  ctx.fillStyle = '#16161a';
  let lx = null, ly = null;
  const n = Math.max(Math.abs(ex - sx), Math.abs(ey - sy), 1), sag = c.target === 2 ? 5 : 3;
  for (let i = 0; i <= n; i++) {
    const tt = i / n, x = Math.round(sx + (ex - sx) * tt), y = Math.round(sy + (ey - sy) * tt + sag * 4 * tt * (1 - tt));
    if (x === lx && y === ly) continue;
    ctx.fillRect(x, y, 1, 1); lx = x; ly = y;
  }
  const nc = c.diesel ? 0x1a1a1e : 0x2e8a3e;
  ctx.fillStyle = rgb(nc); ctx.fillRect(hnd.x - 1, hnd.y - 1, 3, 2);                          // handtaget i handen
  ctx.fillStyle = rgb(mix(nc, WHITE, 0.4)); ctx.fillRect(hnd.x - 1, hnd.y - 1, 2, 1);
  if (c.target === 2) { ctx.fillStyle = '#c8ccd4'; ctx.fillRect(hnd.x + 2, hnd.y - 2, 1, 1); ctx.fillRect(hnd.x + 3, hnd.y - 2, 1, 1); ctx.fillStyle = '#6a6e76'; ctx.fillRect(hnd.x + 4, hnd.y - 3, 1, 1); }   // piggen in i tanklocket
}
function mkDrawPump(ctx, x, st, car) {
  const top = MK.PY - (MK_PH - 1);
  ctx.drawImage(mkPumpImg(false), x, top);
  // slangarna går från pumpens övre hörn i en båge ner till hållarna på sidorna
  const inUse = car && car.fas === 'tanka';
  for (const side of [-1, 1]) {
    const hx = side < 0 ? x - 1 : x + 14;
    for (const [n, c, y0] of [[0, 0x2e8a3e, top + 11], [1, 0x1a1a1e, top + 16]]) {
      const used = side < 0 && inUse && (n === 1) === !!car.diesel;
      ctx.fillStyle = '#16161a';
      ctx.fillRect(hx, top + 7, 1, 1);                                                          // slangens fäste vid displayen
      if (!used) {
        const bx = hx + side * (n === 0 ? 1 : 2);
        ctx.fillRect(bx, top + 8, 1, y0 - top - 8);                                             // slangen hänger ner till hållaren
        mkNozzle(ctx, side < 0 ? hx - 2 : hx + 1, y0, c);
      }
      ctx.fillStyle = '#2a2c30'; ctx.fillRect(side < 0 ? hx - 2 : hx + 1, y0 + 4, 2, 1);        // hållaren
    }
  }
  mkDrawDisplay(ctx, x, st, car, false);
}
// displayen: kronorna rullar under tankningen, står kvar efteråt
function mkDrawDisplay(ctx, x, st, car, glowing) {
  const y = MK.PY - (MK_PH - 1) + 8;
  if (!car || !(car.tank > 0)) { ctx.fillStyle = glowing ? '#40e060' : '#2a8a3a'; ctx.fillRect(x + 11, y + 4, 1, 1); return; }   // redo-lampan
  const pr = mackPris(st), kr = Math.floor(car.tank * (car.diesel ? pr.dsl : pr.b95) / 100);
  const s = String(Math.min(999, kr)), tw = textW(SMALL, s);
  ctxText(ctx, SMALL, s, x + 12 - tw, y, glowing ? '#ffe070' : '#ffb028');
}
function mkPylonDigits(ctx, st, lit) {
  const pr = mackPris(st), [px, py] = MK.PYL, x0 = px - 21, y0 = py - (MK_PYL_H - 1);
  [[pr.b95, MK_LED[0]], [pr.dsl, MK_LED[1]]].forEach(([ore, [lx, ly]]) => {
    const s = mkKr(ore), tw = textW(BIG, s);
    ctxText(ctx, BIG, s, x0 + lx + ((34 - tw) >> 1), y0 + ly, lit ? '#ffd060' : '#ffa82a');
  });
}
function mackItems(b, st) {
  mkSteg(st, b);
  const out = [], snow = (st.env?.weather?.snowCover || 0) > 0.35;
  const car1 = MKS.cars.find((c) => c.target === 1 && c.seg === 'syd' && c.fas !== 'kor' && c.p === MK.XR1) || MKS.last1;
  const car2 = MKS.cars.find((c) => c.target === 2 && c.seg === 'nord' && c.fas !== 'kor' && c.p === MK.XR2 - c.L) || MKS.last2;
  if (car1 && car1.fas !== 'kor') MKS.last1 = car1;
  if (car2 && car2.fas !== 'kor') MKS.last2 = car2;
  // marken (efter huset, före allt annat på förgården)
  out.push({ y: MK.BASE + 0.05, kind: 'mackmark', draw: (ctx) => ctx.drawImage(mkGroundImg(snow), MK.X0, 598) });
  // pumparna och pelarna på öarna
  out.push({ y: MK.PY, x: MK.P1 + 7, kind: 'pump', draw: (ctx) => { ctx.drawImage(mkPillarImg(), MK.C1 - 1, MK_PEL_TOP); mkDrawPump(ctx, MK.P1, st, car1); } });
  out.push({ y: MK.PY, x: MK.P2 + 7, kind: 'pump', draw: (ctx) => { mkDrawPump(ctx, MK.P2, st, car2); ctx.drawImage(mkPillarImg(), MK.C2 - 1, MK_PEL_TOP); } });
  // bilarna och förarna (slangen ritas med föraren)
  for (const c of MKS.cars) {
    const P = mkPose(c);
    out.push({ y: P.fy + (P.end ? 0.2 : 0.1), x: P.end ? P.cx : P.x0 + c.L / 2, kind: 'mackbil', draw: (ctx) => mkDrawCar(ctx, c, st) });
    if (c.forare && c.forare.vis) {
      const fy = c.forare.y;
      out.push({ y: fy < MK.BASE + 4 ? Math.max(fy, MK.BASE + 0.3) : fy + 0.05, x: c.forare.x, kind: 'förare', draw: (ctx) => { mkDrawDriver(ctx, c, b); mkDrawHose(ctx, c); } });
    }
  }
  // taket (framför allt på förgården) och prisskylten vid trottoaren
  out.push({ y: MK.FRONT, kind: 'macktak', draw: (ctx) => ctx.drawImage(mkRoofImg(b.sign || 'PIXELMACKEN', snow, false), MK.TAK[0], MK.TY) });
  out.push({ y: MK.PYL[1], x: MK.PYL[0], kind: 'prisskylt', draw: (ctx) => { ctx.drawImage(mkPylonImg(false, snow, b.sign || 'PIXELMACKEN'), MK.PYL[0] - 21, MK.PYL[1] - (MK_PYL_H - 1)); mkPylonDigits(ctx, st, false); } });
  return out;
}
function mackHinder() {
  const [px, py] = MK.PYL;
  return [MK.I1, MK.I2, [px - 7, py - 3, px + 8, py + 1]];
}
// ---- kvällen: taket lyser (frontlisten är en ljuslåda), downlights över förgården,
// pumparnas och prisskyltens displayer, bilarnas lyktor. Skenet ritas runt/bakom text. ----
function mackGlow(ctx, b, st, k, m) {
  ctx.globalCompositeOperation = 'source-over';
  // frontlisten och prisskylten är upplysta inifrån: kvällsbilden ovanpå med styrkan k
  ctx.globalAlpha = k;
  ctx.drawImage(mkRoofImg(b.sign || 'PIXELMACKEN', false, true), MK.TAK[0], MK.TY);
  ctx.drawImage(mkPylonImg(true, false, b.sign || 'PIXELMACKEN'), MK.PYL[0] - 21, MK.PYL[1] - (MK_PYL_H - 1));
  ctx.globalAlpha = 1;
  const pumpar = [[MK.P1, MKS.last1], [MK.P2, MKS.last2]];
  // står någon framför pumpen (söder om den, t.ex. föraren vid pump 1) skymmer hen displayen – då tänds den inte ovanpå
  const folk = [...(st.env?.people || []), ...MKS.cars.filter((c) => c.forare && c.forare.vis).map((c) => c.forare)];
  const framfor = (x) => folk.some((q) => q && q.y > MK.PY && q.y < MK.PY + 36 && Math.abs(q.x - (x + 7)) < 12);
  for (const [x, car] of pumpar) {
    if (framfor(x)) continue;
    ctx.fillStyle = rgba(0x0c140c, k.toFixed(3)); ctx.fillRect(x + 2, MK.PY - (MK_PH - 1) + 8, 10, 5);   // displayen lyser
    ctx.globalAlpha = k; mkDrawDisplay(ctx, x, st, car, true); ctx.globalAlpha = 1;
    ctx.globalAlpha = k; ctx.drawImage(mkPumpImg(true), 0, 0, 14, 7, x, MK.PY - (MK_PH - 1), 14, 7); ctx.globalAlpha = 1;   // ljuslådan överst
  }
  ctx.globalAlpha = k; mkPylonDigits(ctx, st, true); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  // LED-listen under frontlisten och ljuset den kastar ner
  const [tx0, tx1] = MK.TAK, ly = MK_PEL_TOP, gx0 = Math.max(tx0, MK.PYL[0] + 21);   // markskenet börjar öster om prisskylten
  ctx.fillStyle = rgba(0xfff4d8, (0.55 * k).toFixed(3)); ctx.fillRect(tx0, ly, tx1 - tx0, 1);
  ctx.fillStyle = rgba(0xfff0d0, (0.1 * k).toFixed(3)); ctx.fillRect(tx0, ly + 1, tx1 - tx0, 5);
  // downlights: mjuka ljuspölar på marken under taket (nedanför displayerna, utanför prisskylten)
  for (let x = gx0 + 10; x < tx1 - 4; x += 20) for (const [w, h, a] of [[19, 26, 0.06], [13, 22, 0.07], [7, 16, 0.08]]) {
    ctx.fillStyle = rgba(0xfff2d8, (a * k).toFixed(3)); ctx.fillRect(x - (w >> 1), 640 - h, w, h);
  }
  ctx.fillStyle = rgba(0xfff0d0, (0.07 * k).toFixed(3)); ctx.fillRect(gx0, 612, tx1 - gx0, 28);   // hela förgården under taket
  ctx.fillStyle = rgba(0xffe8c0, (0.05 * k).toFixed(3)); ctx.fillRect(gx0 + 2, 640, tx1 - gx0 - 6, 10);   // spill ut på trottoaren
  // fasaden under taket – men inte över pumparnas displayer (y 598–602)
  ctx.fillStyle = rgba(0xffe8c0, (0.08 * k).toFixed(3));
  for (const [a, e] of [[tx0, MK.P1 - 1], [MK.P1 + 15, MK.P2 - 1], [MK.P2 + 15, tx1 - 6]]) ctx.fillRect(a, 598, e - a, 10);
  // butiksfönstrets varurad och ljuset ut genom fönstret (öppet)
  if (m.fonster && mkOppet(b, st.hour)) {
    const [x, y, w, h] = m.fonster;
    ctx.fillStyle = rgba(0xffe0a0, (0.3 * k).toFixed(3)); ctx.fillRect(x + 1, y + h - 5, w - 2, 4);
    ctx.fillStyle = rgba(0xffc070, (0.1 * k).toFixed(3)); ctx.fillRect(x - 3, y + h, w + 6, 9);
  }
  // skenet runt taket och prisskylten (en ram runt lådorna, aldrig över texten)
  ctx.fillStyle = rgba(0xff6050, (0.16 * k).toFixed(3));
  ctx.fillRect(tx0 - 2, MK.TY + MK_F0, 2, 14); ctx.fillRect(tx1, MK.TY + MK_F0, 2, 14); ctx.fillRect(tx0, MK.TY + MK_F0 - 2, tx1 - tx0, 2);
  const px0 = MK.PYL[0] - 20, py0 = MK.PYL[1] - (MK_PYL_H - 1);
  ctx.fillStyle = rgba(0xfff0d8, (0.14 * k).toFixed(3));
  const bh = MK_PYL_BH;
  ctx.fillRect(px0 - 3, py0 - 1, 3, bh + 2); ctx.fillRect(px0 + 40, py0 - 1, 3, bh + 2); ctx.fillRect(px0, py0 - 3, 40, 3); ctx.fillRect(px0, py0 + bh, 40, 3);
  ctx.fillStyle = rgba(0xfff0d8, (0.06 * k).toFixed(3)); ctx.fillRect(px0 - 6, py0 + bh + 3, 46, MK_PYL_H - bh - 3);
  // biltvättens statuslampa och fönster
  if (m.tvattLampa) { const [x, y] = m.tvattLampa, on = mkTvattar(st); ctx.fillStyle = rgba(on ? 0xff3a2a : 0x40e060, (0.4 * k).toFixed(3)); ctx.fillRect(x - 1, y + (on ? 0 : 2), 4, 4); }
  // bilarnas lyktor
  for (const c of MKS.cars) {
    const P = mkPose(c), moving = c.fas === 'kor';
    if (!moving) continue;
    if (P.end) {
      const y = Math.round(P.fy) - 10;
      if (!P.rear) { for (const dx of [-8, 7]) { ctx.fillStyle = rgba(0xfff8e0, (0.5 * k).toFixed(3)); ctx.fillRect(P.cx + dx - 2, y - 1, 5, 3); ctx.fillStyle = rgba(0xfff0c0, (0.08 * k).toFixed(3)); ctx.fillRect(P.cx + dx - 3, y + 2, 7, 14); } }
      else for (const dx of [-9, 8]) { ctx.fillStyle = rgba(0xff2a1a, ((c.brake ? 0.6 : 0.35) * k).toFixed(3)); ctx.fillRect(P.cx + dx - 2, y - 1, 5, 3); }
    } else {
      const s = MKB[c.kind], hy = P.fy - 1 - s.head.h1, fx = P.dir > 0 ? P.x0 + s.L : P.x0 - 1;
      ctx.fillStyle = rgba(0xfff8e0, (0.5 * k).toFixed(3)); ctx.fillRect(fx - 2, hy - 1, 4, 3);
      ctx.fillStyle = rgba(0xfff0c0, (0.07 * k).toFixed(3)); ctx.fillRect(P.dir > 0 ? fx : fx - 22, hy, 22, 5);
      const tx = P.dir > 0 ? P.x0 : P.x0 + s.L - 1, ty = P.fy - 1 - s.tail.h1;
      ctx.fillStyle = rgba(0xff2a1a, ((c.brake ? 0.6 : 0.3) * k).toFixed(3)); ctx.fillRect(tx - 2, ty, 4, 3);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

export const BUILDING_ART = Object.fromEntries(Object.entries(SPECS).map(([k, spec]) => {
  const art = makeArt(spec);
  // fasadlådans mörka dörröppning får en skymtad interiör (+ ev. spec.over ovanpå)
  const live0 = art.live;
  art.live = (ctx, b, st) => { live0(ctx, b, st); drawInre(ctx, b, st); spec.over?.(ctx, b, st); };
  if (spec.items) art.items = (b, st) => spec.items(b, st);
  if (spec.obstacles) art.obstacles = (b) => spec.obstacles(b);
  return [k, art];
}));

// =====================================================================
// PARKENS SMÅHUS – musikpaviljongen, lekförrådet och toaletten målas här
// från grunden: fasadlådans yta suddas i extra() och huset ritas pixel för
// pixel i bildens koordinater (canvas-x = världs-x − (b.x − 8), canvas-y =
// världs-y − artBox(b).y). Kiosken ritar ingenting – glasståndet i props.js
// står på dess plats. Sist: djuraffärens gatupratare.
// =====================================================================
// fyll en polygon (hörn i pixelkant-koordinater) rad för rad: fn(x, y) → färg | null
function fillPoly(P, pts, fn) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { const c = fn(x, y); if (c !== null && c !== undefined) P.px(x, y, c); }
  }
}
// barycentriska koordinater för punkten (x, y) i triangeln A, B, C → [a, b, c]
function bary(A, B, C, x, y) {
  const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  const a = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d;
  const b = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d;
  return [a, b, 1 - a - b];
}
// strängkarta → pixlar ('.' och okända tecken = genomskinligt), sk < 1 skuggar
function parkRita(P, rows, pal, x, y, sk = 1) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, sk < 1 ? mul(c, sk) : c); } });
}
// liten målad bild (fn(P)), cachad per nyckel
const PARK_SPR = new Map();
function parkImg(key, w, h, fn) {
  let c = PARK_SPR.get(key);
  if (!c) { const P = new Pix(w, h); fn(P); PARK_SPR.set(key, (c = P.flush())); }
  return c;
}
const PV = {
  vit: [0xfffaf0, 0xf0e8d8, 0xd4c8b0, 0xa4987e, 0x6e6452],                        // krämvitt trä: ljus → mörk
  tak: [0x4a1a16, 0x6e2820, 0x9a3a2c, 0xbc4c3a, 0xd8664e, 0xf09078],                // röd plåt: mörk → ljus
  sno: [0x9aaac4, 0xb4c2da, 0xcad6ea, 0xdfe7f4, 0xeef3fa, 0xfbfdff],
  guld: [0x6a4a14, 0xb08a24, 0xe4bc48, 0xfff0a0],
  gron: [0x0e2a1e, 0x17402e, 0x1f5a3e, 0x2c7250],
  golv: [0x5a3e22, 0x7a5430, 0x9a6c3e, 0xb8864e, 0xd8a466],
  sten: [0x5a5852, 0x7a766e, 0x9a968c, 0xbab6aa],
};
// people.js ritar musikerna (laddas tåligt – utan den vilar instrumenten på scenen)
let parkFolk = null;
import('../core/people.js').then((m) => { if (typeof m.drawPerson === 'function') parkFolk = m.drawPerson; }).catch(() => {});

// ---------------------------------------------------------------------
// MUSIKPAVILJONGEN (Carl: "gör om det så man ser vad det är"): en öppen,
// åttkantig paviljong – röd plåthuv i fält med falsar, liten lanternin med
// förgylld spira och blågul vimpel, vit takfot med ljusslinga, frisen med
// skylten MUSIKPAVILJONGEN (inget korsar texten) och spetsbård, tolv smala
// vita pelare, vitt räcke runt en upphöjd trägolvsscen med stolar och
// notställ, spaljékjol och trappa mitt fram. Ibland spelar parkens musikkår
// (live, dagtid när det är torrt): tuba, klarinett, dragspel och stora trumman.
// Bilden är 104 × 100 (canvas-x = världs-x − 1288, canvas-y = världs-y − 348).
// Hörnen i PAV är pixelkanter; spegling: pixel x ↔ 103 − x, kant x ↔ 104 − x.
// ---------------------------------------------------------------------
const PAV = {
  E: { fL: [11, 32], fR: [93, 32], sLF: [3, 26], sRF: [101, 26], sLB: [3, 14], sRB: [101, 14], bL: [11, 8], bR: [93, 8] }, // takfoten
  RL: [43, 7], RR: [61, 7], VP: [52, -0.03],   // nocken; framsidans fall möts (förlängda) i VP
  FRAM: [17, 40, 63, 86],                      // pelarna längs fram- och bakkanten (mittkolumn)
  SIDA: [9, 94],                               // pelarna på kortsidorna
  SKYLT: [12, 34, 80, 9],                      // frisens skylt: x, y, b, h
  TEXT: 'MUSIKPAVILJONGEN',
  STOLAR: [[23, 79], [35, 77], [68, 77], [80, 79]],
  NOTER: [[29, 82], [47, 80], [56, 80], [74, 82]],
};
const PAV_STOL = ['lmmmd', 'm...d', 'lmmmd', 'm...d', 'm...d', 'lllll', 'mmmmd', 'm...d', 'm...d', 'm...d'];
const PAV_STOL_PAL = { l: 0x5aae74, m: 0x2f7a4a, d: 0x17442a };                    // grönlackade parkstolar
const PAV_NOT = ['.wwwww.', '.wnwnw.', '.wwwnw.', '.wnwww.', 'kkkkkkk', '...k...', '...k...', '...k...', '...k...', '...k...', '...K...', '...k...', '...k...', '...k...', '...k...', '..k.k..', '.k...k.', 'k.....k'];
const PAV_NOT_PAL = { w: 0xf8f4e8, n: 0x4a4a54, k: 0x1a1a20, K: 0x5a5a64 };

// scengolvet: plankor i trä, skuggat under taket; solen når in över framkanten
function pavGolv(P, o) {
  const G = PV.golv;
  fillPoly(P, [[16, 69], [88, 69], [96, 75], [96, 86], [88, 92], [16, 92], [8, 86], [8, 75]], (x, y) => {
    const j = y - 69, pl = j >> 1, sol = !o.night && y >= 87 + (x > 60 ? 1 : 0) + (x > 80 ? 1 : 0) - (x < 30 ? 1 : 0);
    let c = G[sol ? 3 : 2];
    if (j & 1) c = G[sol ? 2 : 1];                                                   // plankfogarna
    else if (((x + pl * 7) % 17) === 0) c = G[1];                                    // stötfogar, förskjutna
    if (y === 91) c = G[4];                                                          // framkantens nos
    if (!(j & 1) && hash(x, y, 61) > 0.93) c = mix(c, WHITE, 0.12);                  // slitna fläckar
    return jit(c, x, y, 62, 0.04);
  });
  if (!o.night) for (const c of PAV.FRAM) for (let i = 0; i < 5; i++) for (const d of [0, 1]) if (90 - i >= 86) P.darken(c + 2 + i + d, 90 - i, 1, 1, 0.8); // pelarskuggorna
}
// en räckessträcka: kant(x) = golvraden räcket står på
function pavRackeLinje(P, x0, x1, kant, o, sk = 1) {
  const V = PV.vit, S = (c) => (sk < 1 ? mul(c, sk) : c);
  for (let x = x0; x <= x1; x++) {
    const e = Math.round(kant(x)), top = e - 6;
    if (o.snow) P.px(x, top - 1, hash(x, 5, 91) > 0.3 ? 0xf6f9fe : 0xdde6f2);
    P.px(x, top, S(V[0])); P.px(x, top + 1, S(V[2]));
    if (!(x & 1)) for (let y = top + 2; y < e - 1; y++) P.px(x, y, S(y === top + 2 ? V[2] : V[1]));
    P.px(x, e - 1, S(V[2]));
  }
}
function pavRacke(P, sida, o) {
  const M = (f) => (x) => f(103 - x);
  if (sida === 'bak') {
    const k = () => 69, d = (x) => 75 - (x - 8) * 0.75;
    for (const [a, z] of [[20, 37], [43, 60], [66, 83]]) pavRackeLinje(P, a, z, k, o, 0.8);
    pavRackeLinje(P, 12, 14, d, o, 0.8); pavRackeLinje(P, 89, 91, M(d), o, 0.72);
  } else {
    const k = () => 91, d = (x) => 85 + (x - 8) * 0.75;
    pavRackeLinje(P, 20, 37, k, o); pavRackeLinje(P, 66, 83, k, o, 0.94);
    pavRackeLinje(P, 12, 14, d, o); pavRackeLinje(P, 89, 91, M(d), o, 0.84);
  }
}
// en smal vit pelare med kapitäl och bas (fot = raden under basen)
function pavPelare(P, c, fot, o, sk = 1) {
  const V = PV.vit, S = (k) => (sk < 1 ? mul(k, sk) : k), top = fot - 48;
  for (let y = top + 3; y < fot - 3; y++) { P.px(c - 1, y, S(V[0])); P.px(c, y, S(V[1])); P.px(c + 1, y, S(V[2])); }
  P.hl(c - 2, top, 5, S(V[0])); P.hl(c - 2, top + 1, 5, S(V[1])); P.px(c + 2, top + 1, S(V[2])); P.hl(c - 1, top + 2, 3, S(V[2]));
  P.hl(c - 1, fot - 3, 3, S(V[1])); P.hl(c - 2, fot - 2, 5, S(V[1])); P.px(c - 2, fot - 2, S(V[0])); P.hl(c - 2, fot - 1, 5, S(V[2]));
  if (o.snow && fot === 92) P.hl(c - 2, top - 1, 5, 0xf4f8fe);
}
// lyktor på ingångspelarna
function pavLyktor(P, o) {
  const glas = o.night ? [0xfffadc, 0xfff0b0, 0xffd878] : [0xf4f0e0, 0xe0dac4, 0xb8b09a];
  for (const c of [40, 63]) {                                                        // svart lykta: huv, tre rutor glas, fot
    P.px(c, 55, 0x2a2a30); P.hl(c - 1, 56, 3, 0x2a2a30); P.px(c - 1, 56, 0x5a5a64);
    for (let j = 0; j < 3; j++) { P.px(c - 1, 57 + j, 0x4a4a54); P.px(c, 57 + j, glas[j]); P.px(c + 1, 57 + j, 0x1a1a20); }
    P.hl(c - 1, 60, 3, 0x2a2a30); P.px(c, 61, 0x2a2a30);
  }
}
// stolar och notställ på scenen (under taket – lite skuggade)
function pavScen(P, o) {
  for (const [x, f] of PAV.STOLAR) parkRita(P, PAV_STOL, PAV_STOL_PAL, x - 2, f - 9, 0.86);
  for (const [x, f] of PAV.NOTER) parkRita(P, PAV_NOT, PAV_NOT_PAL, x - 3, f - 17, 0.92);
}
// scenens kjol (spaljé) och trappan
function pavSockel(P, o) {
  const V = PV.vit, S = PV.sten, G = PV.golv;
  const kjol = (x, y0, sk) => {
    const Sh = (c) => (sk < 1 ? mul(c, sk) : c);
    P.px(x, y0, Sh(V[0]));
    for (let y = y0 + 1; y <= y0 + 2; y++) P.px(x, y, Sh((((x + y) % 3) === 0 || (((x - y) % 3) + 3) % 3 === 0) ? V[2] : 0x2a2420));
    P.px(x, y0 + 3, Sh(jit(S[2], x, y0, 63, 0.08)));
  };
  for (let x = 16; x <= 87; x++) if (x < 41 || x > 62) kjol(x, 92, x > 62 ? 0.94 : 1);
  for (let x = 8; x <= 15; x++) { const e = Math.floor(86 + (x + 0.5 - 8) * 0.75); kjol(x, e, 1); kjol(103 - x, e, 0.8); }
  for (let x = 42; x <= 61; x++) { P.px(x, 92, Math.abs(x - 51.5) < 5 ? G[3] : G[4]); P.px(x, 93, V[2]); }   // trappstegen, slitna i mitten
  for (let x = 41; x <= 62; x++) { P.px(x, 94, Math.abs(x - 51.5) < 6 ? G[3] : G[4]); P.px(x, 95, V[3]); }
  for (let x = 40; x <= 63; x++) { P.px(x, 96, jit(S[3], x, 96, 64, 0.06)); P.px(x, 97, S[1]); }
  P.px(41, 92, V[1]); P.px(41, 93, V[3]); P.px(62, 92, V[2]); P.px(62, 93, V[3]);         // vangerna
  P.px(40, 94, V[1]); P.px(40, 95, V[3]); P.px(63, 94, V[2]); P.px(63, 95, V[3]);
  P.hl(40, 98, 24, 0x000000, 0.2);
  if (o.snow) for (const [y, a, z] of [[92, 42, 61], [94, 41, 62], [96, 40, 63]]) for (let x = a; x <= z; x++) if (hash(x, y, 91) > 0.22) P.px(x, y, 0xf2f6fc);
}
// taket: sju synliga fall (bakifrån och fram), falsar, valmar och nock, lanterninen,
// takfotens sarg med ljusslinga, frisen med skylten, spetsbården och konsolerna
function pavTak(P, o) {
  const { E, RL, RR, VP } = PAV, V = PV.vit, R = o.snow ? PV.sno : PV.tak, GU = PV.guld;
  const fall = [
    [E.sLB, E.bL, RL, [E.sLB, E.bL, RL], 3, 2],          // nordväst
    [E.bR, E.sRB, RR, [E.bR, E.sRB, RR], 1, 2],          // nordost
    [E.sLF, E.sLB, RL, [E.sLF, E.sLB, RL], 4, 3],        // väster
    [E.sRB, E.sRF, RR, [E.sRB, E.sRF, RR], 1, 3],        // öster
    [E.fL, E.sLF, RL, [E.fL, E.sLF, RL], 4, 2],          // sydväst
    [E.sRF, E.fR, RR, [E.sRF, E.fR, RR], 2, 2],          // sydost
    [E.fL, E.fR, VP, [E.fL, E.fR, RR, RL], 3, 12],       // söder – framsidan
  ];
  fall.forEach(([A, B, C, pts, ton, n], id) => {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    fillPoly(P, pts, (x, y) => {
      const [la, lb, lc] = bary(A, B, C, x + 0.5, y + 0.5), s = la + lb;
      const u = s > 1e-4 ? clamp(lb / s, 0, 0.9999) : 0.5, k = Math.floor(u * n), fu = u * n - k, w = (s * len) / n;
      let c = mul(R[ton], 0.96 + 0.08 * hash(k, id, 57));
      if (w > 2.4 && k > 0 && fu * w < 1) c = R[Math.min(5, ton + 1)];              // falsen fångar ljuset …
      else if (w > 2.4 && k > 0 && fu * w < 2) c = mul(R[ton], 0.86);               // … och skuggar fältet bredvid
      if (lc < 0.05) c = mix(c, R[5], o.snow ? 0.3 : 0.2);                           // plåtkanten vid takfoten
      return jit(c, x, y, 58 + id, o.snow ? 0.02 : 0.035);
    });
  });
  // valmarna (ljusa rullar på solsidan) och nocken
  const px = (p) => [Math.round(p[0] - 0.5), Math.round(p[1] - 0.5)];
  for (const [a, z, c] of [[E.fL, RL, R[5]], [E.sLF, RL, R[5]], [E.sLB, RL, R[4]], [E.fR, RR, R[3]], [E.sRF, RR, R[2]], [E.sRB, RR, R[2]]]) { const [x0, y0] = px(a), [x1, y1] = px(z); P.line(x0, y0, x1, y1, c); }
  P.hl(43, 6, 18, R[5]); P.hl(44, 7, 16, R[2]);
  // lanterninen på nocken: krämvit med jalusier, eget litet tak (spiran och vimpeln ritas i live)
  for (let y = 2; y <= 5; y++) for (let x = 47; x <= 56; x++) {
    let c = x === 47 ? V[0] : x >= 55 ? V[3] : V[1];
    if ((x === 49 || x === 50 || x === 53 || x === 54) && (y === 3 || y === 4)) c = y === 3 ? 0x2a2420 : 0x4a4038;
    P.px(x, y, c);
  }
  P.hl(47, 5, 10, V[2]);
  P.hl(49, 0, 6, R[4]); P.px(54, 0, R[2]); P.hl(47, 1, 10, R[3]); P.px(47, 1, R[5]); P.hl(54, 1, 3, R[2]);
  // takfotens sarg: framsidan och de sneda hörnen, kortsidorna i profil
  for (let x = 11; x <= 92; x++) { P.px(x, 32, V[0]); P.px(x, 33, V[2]); }
  fillPoly(P, [[3, 26], [11, 32], [11, 34], [3, 28]], (x, y) => (y + 0.5 >= 27 + (x + 0.5 - 3) * 0.75 ? V[2] : V[1]));
  fillPoly(P, [[93, 32], [101, 26], [101, 28], [93, 34]], (x, y) => (y + 0.5 >= 27 + (104 - x - 0.5 - 3) * 0.75 ? V[3] : V[2]));
  P.vl(3, 14, 13, V[1]); P.vl(100, 14, 13, V[3]);
  // ljusslingan på sargen
  const lampor = [];
  for (let x = 14; x <= 89; x += 5) { P.px(x, 32, 0x5a5044); P.px(x, 33, o.night ? 0xfff0b0 : 0xe8e2d0); lampor.push([x, 33]); }
  // de sneda frisernas gröna speglar och spetsbård
  for (let x = 4; x <= 11; x++) {
    const t = Math.floor(26 + (x + 0.5 - 3) * 0.75) + 2;
    for (let r = 0; r <= 9; r++) {
      let c = r === 0 ? V[3] : r === 9 ? V[2] : V[1];
      if (r >= 2 && r <= 7 && x >= 5 && x <= 10) c = r === 2 || r === 7 ? GU[1] : PV.gron[2];
      P.px(x, t + r, c); P.px(103 - x, t + r, mul(c, 0.78));
    }
    const q = x % 3;
    if (q !== 2) { P.px(x, t + 10, V[1]); P.px(103 - x, t + 10, V[3]); }
    if (q === 1) { P.px(x, t + 11, V[2]); P.px(103 - x, t + 11, V[3]); }
  }
  // SKYLTEN: mörkgrön bräda i guldlist på frisen – ljus text med slagskugga, rosetter i ändarna
  const [sx, sy, sw, sh] = PAV.SKYLT;
  area(P, sx, sy, sw, sh, (X, Y, i, j) => {
    if (j === 0) return i === 0 || i === sw - 1 ? GU[1] : GU[3];
    if (j === sh - 1) return GU[1];
    if (i === 0) return GU[2];
    if (i === sw - 1) return GU[1];
    let c = jit(mix(PV.gron[3], PV.gron[1], (j - 1) / (sh - 3)), X, Y, 65, 0.04);
    if (hash(X >> 3, Y, 66) > 0.85) c = mul(c, 0.92);
    return c;
  });
  const tw = textW(SMALL, PAV.TEXT), tx = sx + ((sw - tw) >> 1), ty = sy + 2;
  text(P, SMALL, PAV.TEXT, tx + 1, ty + 1, PV.gron[0]);
  text(P, SMALL, PAV.TEXT, tx, ty, 0xfff2cc);
  for (const rx of [sx + 3, sx + sw - 4]) { P.px(rx, sy + 4, GU[3]); P.px(rx - 1, sy + 4, GU[2]); P.px(rx + 1, sy + 4, GU[1]); P.px(rx, sy + 3, GU[2]); P.px(rx, sy + 5, GU[1]); }
  // frisbalkens underkant, spetsbården mellan pelarna och de snidade konsolerna
  for (let x = 12; x <= 91; x++) P.px(x, 43, V[2]);
  const kap = (x) => PAV.FRAM.some((c) => Math.abs(x - c) <= 2);
  for (let x = 12; x <= 91; x++) if (!kap(x)) {
    const q = (x - 12) % 4;
    if (q !== 3) P.px(x, 44, q === 0 ? V[0] : V[1]);
    if (q === 1) { P.px(x, 45, V[2]); P.px(x, 46, 0x000000, 0.2); }
  }
  for (const c of PAV.FRAM) for (const s of [-1, 1]) {
    P.px(c + 3 * s, 44, V[1]); P.px(c + 4 * s, 44, V[1]); P.px(c + 5 * s, 44, V[2]);
    P.px(c + 3 * s, 45, V[1]); P.px(c + 4 * s, 45, V[2]); P.px(c + 3 * s, 46, V[2]);
  }
  // glödbilden för kvällen: bokstäverna lyser varmt med mjuk kant (aldrig en ruta över texten)
  const on = new Set(), key = (x, y) => y * 4096 + x;
  text({ px: (x, y) => on.add(key(x, y)) }, SMALL, PAV.TEXT, tx - sx, ty - sy);
  const G = new Pix(sw, sh);
  for (const kk of on) { const x = kk % 4096, y = (kk / 4096) | 0; G.px(x, y, 0xfff0c0, 0.5); for (const [a, b2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!on.has(key(x + a, y + b2))) G.px(x + a, y + b2, 0xffc860, 0.12); }
  return { lampor, glod: G.flush() };
}
function pavFasad(P, K) {
  const o = { night: !!K.night, snow: !!(K.opts && K.opts.snow) };
  P.erase(0, 0, P.w, P.h);
  pavGolv(P, o);
  pavRacke(P, 'bak', o);
  P.vl(8, 70, 16, PV.vit[1]); P.vl(95, 70, 16, PV.vit[3]);                            // kortsidornas räcken i profil
  for (const c of PAV.FRAM) pavPelare(P, c, 70, o, 0.8);
  for (const c of PAV.SIDA) pavPelare(P, c, 76, o, c < 50 ? 0.9 : 0.72);
  pavScen(P, o);
  // främre lagret (pelare, räcke, lyktor) ritas också för sig: live() lägger det över musikerna
  const fram = (Q) => {
    for (const c of PAV.SIDA) pavPelare(Q, c, 87, o, c < 50 ? 1 : 0.8);
    pavRacke(Q, 'fram', o);
    for (const c of PAV.FRAM) pavPelare(Q, c, 92, o);
    pavLyktor(Q, o);
  };
  fram(P);
  pavSockel(P, o);
  const tak = pavTak(P, o);
  const F = new Pix(P.w, P.h);
  fram(F);
  K.lit.length = 0; K.shop.length = 0;
  K.out.pav = { ox: K.box.x, oy: K.box.y, front: F.flush(), lampor: tak.lampor, glod: tak.glod };
}

// ---- musikkåren ----
// Konserterna växlar med speldagen; en halvtimme före och efter står
// instrumenten framme (musikerna tar paus). Regn, snöfall och vinter = ingen konsert.
const PAV_KONSERT = [[[11, 13], [15, 18]], [[12, 14.5], [16.5, 19]], [[10, 12], [14, 16], [17.5, 19]], [[11.5, 14], [15.5, 17.5]]];
const PAV_BPM = 104;
// varför det inte blir någon konsert: 'vinter' (snötäcke/vinteruppehåll), 'regn' (regn eller snöfall) – annars null
function pavStopp(env) {
  const w = env.weather || {};
  if ((w.snowCover || 0) > 0.5 || w.season === 'vinter') return 'vinter';
  if (env.rain || ((w.kind === 'regn' || w.kind === 'snö') && (w.intensity ?? 1) > 0.15)) return 'regn';
  return null;
}
const pavPass = (env) => PAV_KONSERT[(((env.day ?? 1) % 4) + 4) % 4];
function pavLage(st) {
  const env = st.env || {}, h = st.hour ?? 12;
  if (pavStopp(env)) return 'tom';
  for (const [a, z] of pavPass(env)) {
    if (h >= a && h < z) return ((st.t || 0) % 34) < 29 ? 'spelar' : 'mellan';    // korta andningspauser mellan låtarna
    if ((h >= a - 0.5 && h < a) || (h >= z && h < z + 0.4)) return 'paus';
  }
  return 'tom';
}
// beskedet när man klickar på paviljongen (BUILDING_ART.paviljong.besked, se slutet av filen):
// följer samma konserttider och väder som musikkåren i pavLive, så det aldrig säger emot scenen
function pavBesked(env = {}, hour = 12) {
  const kl = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  if (pavLage({ env, hour, t: 0 }) === 'spelar') return 'Parkens musikkår spelar just nu – stanna en stund och lyssna!';
  const stopp = pavStopp(env);
  if (stopp === 'vinter') return 'Musikkåren har vinteruppehåll – de spelar igen när snön har smält.';
  if (stopp === 'regn') return 'Ingen konsert i regnet – musikkåren spelar när det är torrt, ofta vid lunch och på eftermiddagen.';
  const nasta = pavPass(env).find(([a]) => a > hour);
  if (nasta && nasta[0] - hour <= 0.5) return `Instrumenten står redan framme – konserten börjar kl ${kl(nasta[0])}.`;
  if (nasta) return `Ingen konsert just nu – nästa börjar i dag kl ${kl(nasta[0])}.`;
  return 'Dagens konserter är slut – musikkåren spelar igen i morgon, ofta vid lunch och på eftermiddagen.';
}
// musikkårens uniform: mörkblå jacka med guldblixtlås, mössa och byxor
const PAV_KAR = { hat: 'cap', cap: '#23305a', top: 'jacket', shirt: '#23305a', accent: '#f0b429', bottom: 'pants', pants: '#23305a', shoes: '#1c1c1c', glasses: false, beard: false, phones: false, kid: false, build: 5, bag: null };
const PAV_MUSIKER = [
  { id: 'tuba', x: 28, fy: 88, look: { ...PAV_KAR, skin: '#eec3a0', hair: '#b9b3ab', style: 'short' } },
  { id: 'klarinett', x: 44, fy: 86, look: { ...PAV_KAR, skin: '#c68a5c', hair: '#1d1714', style: 'bun' } },
  { id: 'dragspel', x: 59, fy: 88, look: { ...PAV_KAR, skin: '#f6d7bf', hair: '#d9a95c', style: 'ponytail' } },
  { id: 'trumma', x: 77, fy: 87, look: { ...PAV_KAR, skin: '#744a2d', hair: '#1d1714', style: 'buzz' } },
].sort((a, b) => a.fy - b.fy);
// noterna som svävar ut ur paviljongen: [start-x, start-y, riktning, fart] (bildkoordinater)
const PAV_NOTFLOD = [[16, 54, -1, 0.3], [21, 60, -1, 0.24], [13, 66, -1, 0.2], [86, 64, 1, 0.28], [90, 58, 1, 0.22]];
const PAV_NOT_BILD = ['..#.', '..##', '..#.', '###.', '##..'];
const PAV_MASS = { o: 0x5a3e0e, d: 0xa8801e, g: 0xe0b440, h: 0xfff0a0, k: 0x2a1c08, K: 0x6a4a14, s: 0xdadee6, S: 0x8a909a };
// tubans klocka reser sig vid vänster axel (x ↔ fx − 14 + i, y ↔ fy − 37 + j)
const PAV_TUBA = [
  '.ohhhhhhho.....',
  'ohkkkkkkkho....',
  'ogKkkkkkKgo....',
  '.oggggggddo....',
  '..ogghggdo.....',
  '...oghgdo......',
  '...oghgdo......',
  '...oghgdo......',
  '...oghgdo......',
  '...oghggdo.....',
  '...ohhgggdo....',
  '..ohggggggdoos.',
  '..ohgggggddSso.',
  '..ohgggggddSs..',
  '..ohgggggddSs..',
  '..oggggggddSo..',
  '...oggggdddo...',
  '....oggddoo....',
  '.....ooooo.....',
];
const PAV_KLAR = ['.kK.', '.kk.', '.ks.', '.kk.', '.kk.', '.ks.', '.kk.', '.kk.', '.ks.', '.kk.', '.kk.', 'kkkK', 'kKKk'];
const PAV_KLAR_PAL = { k: 0x1a1a1e, K: 0x3a3a46, s: 0xc8ccd4 };
const pavTuba = () => parkImg('tuba', 15, 19, (P) => parkRita(P, PAV_TUBA, PAV_MASS, 0, 0));
const pavKlar = (tilt) => parkImg('klar' + tilt, 6, 13, (P) => PAV_KLAR.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = PAV_KLAR_PAL[r[i]]; if (c !== undefined) P.px(1 + i + Math.round((tilt * j) / 12), j, c); } }));
function pavDragspel(bw) {
  return parkImg('dragspel' + bw, 10 + bw, 12, (P) => {
    const R = [0x7a1612, 0xb82a22, 0xe0463a, 0xff8a78];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 5; x++) {                        // diskanten: tangenterna ytterst
      let c = x === 0 ? ((y & 1) ? 0x2a2a30 : 0xf8f4ea) : x === 1 ? 0xf8f4ea : R[1];
      if (x >= 2 && y === 0) c = R[3]; else if (x >= 2 && y === 11) c = R[0]; else if (x === 4) c = R[0]; else if (x === 2) c = R[2];
      P.px(x, y, c);
    }
    for (let y = 0; y < 12; y++) for (let i = 0; i < bw; i++) P.px(5 + i, y, y === 0 || y === 11 ? 0xc8ccd4 : (i & 1) ? 0x1c1c22 : 0xe0d8c8); // bälgen
    for (let y = 0; y < 12; y++) for (let x = 0; x < 5; x++) {                        // basdelen med knappgaller
      let c = R[1];
      if (x === 0) c = R[2]; else if (x === 4) c = R[0];
      if (y === 0) c = R[3]; else if (y === 11) c = R[0];
      if (x >= 1 && x <= 3 && y >= 3 && y <= 8 && ((x + y) & 1)) c = 0x3a0c0a;
      P.px(5 + bw + x, y, c);
    }
  });
}
function pavTrumma() {
  return parkImg('trumma', 15, 18, (P) => {
    for (let y = 0; y < 14; y++) for (let x = 0; x < 15; x++) {
      const dx = x + 0.5 - 7.5, dy = y + 0.5 - 7, d = Math.hypot(dx, dy);
      if (d > 7.2) continue;
      let c;
      if (d > 6.2) c = dx + dy < -3 ? 0xe8645a : dx + dy > 3 ? 0x8a1e18 : 0xc8342a;   // röd ring
      else if (d > 5.4) c = 0xd8d0c0;
      else c = dx + dy > 4 ? 0xe4ded0 : 0xf8f4ea;                                        // skinnet
      P.px(x, y, c);
    }
    for (let k = 0; k < 8; k++) { const a = ((k + 0.5) / 8) * Math.PI * 2; P.px(Math.round(7 + Math.cos(a) * 6.4), Math.round(6.5 + Math.sin(a) * 6.4), 0xe8c050); }
    parkRita(P, ['g.g.g', 'g.g.g', '.ggg.', '..g..', '.ggg.'], { g: 0xc8a040 }, 5, 4);  // lyran
    for (const [x, y] of [[3, 14], [2, 15], [2, 16], [1, 17], [11, 14], [12, 15], [12, 16], [13, 17]]) P.px(x, y, 0x3a3a40); // stativet
    P.hl(5, 14, 5, 0x2a2a30);
  });
}
// en musiker med sitt instrument (slag = taktslag sedan start; spelar = rör sig)
function pavMusiker(ctx, mu, ox, oy, slag, spelar) {
  const fx = ox + mu.x, fy = oy + mu.fy, fas = slag % 1, hand = mu.look.skin;
  const gung = spelar && (mu.id === 'tuba' ? (slag % 2) < 0.3 : fas < 0.2) ? 1 : 0;
  try { parkFolk(ctx, fx, fy - gung, mu.look, 'down', 9); } catch { parkFolk = null; return; }
  const H = (x, y, w = 2, h = 2) => { ctx.fillStyle = hand; ctx.fillRect(x, y, w, h); };
  if (mu.id === 'tuba') {
    ctx.drawImage(pavTuba(), fx - 14, fy - 37 - gung);
    H(fx - 4, fy - 22 - gung, 2, 2);
  } else if (mu.id === 'klarinett') {
    const tilt = spelar ? [0, 1, 0, -1][Math.floor(slag) & 3] : 0;
    ctx.drawImage(pavKlar(tilt), fx - 2, fy - 25);
    H(fx - 1, fy - 21); H(fx + tilt, fy - 16);
  } else if (mu.id === 'dragspel') {
    const bw = spelar ? 3 + Math.round(4 * (0.5 - 0.5 * Math.cos((slag * Math.PI) / 2))) : 4;
    ctx.drawImage(pavDragspel(bw), fx - 9, fy - 23 - gung);
    H(fx - 10, fy - 19 - gung, 1, 3); H(fx - 9 + 10 + bw, fy - 19 - gung, 1, 3);
  } else if (mu.id === 'trumma') {
    // stora trumman på stativ med ett bäcken på kanten: klubban lyfts till axelhöjd och
    // slår på ettan och trean, bäckenet skimrar på tvåan och fyran
    ctx.drawImage(pavTrumma(), fx - 7, fy - 17);
    const slar = spelar && (slag % 2) < 0.24, backen = spelar && ((slag + 1) % 2) < 0.2;
    ctx.fillStyle = '#6a6a74'; ctx.fillRect(fx + 5, fy - 19, 1, 3);
    ctx.fillStyle = backen ? '#fff4b0' : '#e4bc48'; ctx.fillRect(fx + 2, fy - 20, 7, 1);
    ctx.fillStyle = backen ? '#e4bc48' : '#a8801e'; ctx.fillRect(fx + 3, fy - 19, 5, 1);
    const K = (x, y, lyft) => {                                                       // klubban: skaft + luden klubba
      ctx.fillStyle = '#7a5430';
      if (lyft) { ctx.fillRect(fx - 5, fy - 20, 1, 1); ctx.fillRect(fx - 6, fy - 21, 1, 1); ctx.fillRect(fx - 6, fy - 22, 1, 1); }
      else { ctx.fillRect(fx - 4, fy - 16, 1, 1); ctx.fillRect(fx - 3, fy - 15, 1, 1); }
      ctx.fillStyle = '#f4ece0'; ctx.fillRect(x, y, 3, 3); ctx.fillStyle = '#c8bca8'; ctx.fillRect(x + 1, y + 2, 2, 1); ctx.fillRect(x + 2, y + 1, 1, 1);
    };
    if (slar) { K(fx - 3, fy - 15, false); H(fx - 6, fy - 18); }
    else { K(fx - 8, fy - 26, true); H(fx - 5, fy - 20); }
  }
}
// noterna: små åttondelsnoter som svävar ut genom paviljongens sidor och bleknar
// (aldrig över skylten: innanför frisens bredd hålls de under dess underkant)
function pavNoter(ctx, ox, oy, t) {
  PAV_NOTFLOD.forEach(([x0, y0, dir, fart], i) => {
    const ph = (t * fart + i * 0.37) % 1, x = Math.round(x0 + dir * ph * 26), yy = Math.round(y0 - ph * 12 + Math.sin(ph * 9 + i) * 1.2);
    const y = x >= 10 && x <= 93 ? Math.max(yy, 48) : yy;
    ctx.globalAlpha = ph < 0.15 ? ph / 0.15 : ph > 0.7 ? (1 - ph) / 0.3 : 1;
    for (const [d, col] of [[1, '#1c2440'], [0, i & 1 ? '#fffaf0' : '#fff0b0']]) {       // mörk skugga, ljus not
      ctx.fillStyle = col;
      PAV_NOT_BILD.forEach((r, j) => { for (let k = 0; k < 4; k++) if (r[k] === '#') ctx.fillRect(ox + x + k + d, oy + y + j + d, 1, 1); });
    }
  });
  ctx.globalAlpha = 1;
}
// pausen: instrumenten vilar på scenen (och när people.js inte laddats)
function pavVilar(ctx, mu, ox, oy) {
  const fx = ox + mu.x, fy = oy + mu.fy;
  if (mu.id === 'tuba') ctx.drawImage(pavTuba(), fx - 10, fy - 19);
  else if (mu.id === 'klarinett') {
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(fx - 1, fy - 2, 3, 1); ctx.fillRect(fx - 2, fy - 1, 1, 1); ctx.fillRect(fx + 2, fy - 1, 1, 1);
    ctx.drawImage(pavKlar(0), fx - 2, fy - 15);
  } else if (mu.id === 'dragspel') {
    ctx.drawImage(parkImg('stol', 5, 10, (P) => parkRita(P, PAV_STOL, PAV_STOL_PAL, 0, 0)), fx - 2, fy - 10);
    ctx.drawImage(pavDragspel(2), fx - 6, fy - 16);
  } else if (mu.id === 'trumma') {
    ctx.drawImage(pavTrumma(), fx - 7, fy - 17);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(fx + 5, fy - 6, 1, 5); ctx.fillStyle = '#f0e8d8'; ctx.fillRect(fx + 5, fy - 8, 2, 2);
  }
}
// spiran med förgylld kula och den blågula vimpeln – vajar i vinden
function pavVimpel(ctx, ox, oy, st) {
  const x = ox + 51, y = oy, t = st.t || 0, wind = st.env?.weather?.wind ?? 4, dir = wind < 0 ? -1 : 1, amp = clamp(Math.abs(wind) / 18, 0.3, 1);
  ctx.fillStyle = '#8a6a1a'; ctx.fillRect(x, y - 11, 1, 9);
  ctx.fillStyle = '#ffe898'; ctx.fillRect(x, y - 12, 1, 1);
  ctx.fillStyle = '#e4bc48'; ctx.fillRect(x, y - 3, 2, 2);
  ctx.fillStyle = '#fff0a0'; ctx.fillRect(x, y - 3, 1, 1);
  ctx.fillStyle = '#8a6a1a'; ctx.fillRect(x + 1, y - 2, 1, 1);
  for (let i = 0; i < 11; i++) {
    const px = x + dir * (1 + i), dy = Math.round(Math.sin(t * 5.5 - i * 0.7) * amp * (i / 11) * 2);
    const h = i < 4 ? 3 : i < 8 ? 2 : 1, top = y - 11 + dy + (i >= 8 ? 1 : 0);
    ctx.fillStyle = '#1a5ab0'; ctx.fillRect(px, top, 1, h);
    if (h >= 2) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(px, top + (h >> 1), 1, 1); }
  }
}
function pavLive(ctx, b, st, m) {
  const p = m && m.pav;
  if (!p) return;
  pavVimpel(ctx, p.ox, p.oy, st);
  const lage = pavLage(st);
  if (lage === 'tom') return;
  const slag = ((st.t || 0) * PAV_BPM) / 60;
  if (lage === 'paus' || !parkFolk) for (const mu of PAV_MUSIKER) pavVilar(ctx, mu, p.ox, p.oy);
  else for (const mu of PAV_MUSIKER) { pavMusiker(ctx, mu, p.ox, p.oy, slag, lage === 'spelar'); if (!parkFolk) break; }
  ctx.drawImage(p.front, p.ox, p.oy);
  if (lage === 'spelar' && parkFolk) pavNoter(ctx, p.ox, p.oy, st.t || 0);
}
function pavGlow(ctx, b, st, k, m) {
  const p = m && m.pav;
  if (!p) return;
  const { ox, oy } = p;
  for (const [x, y] of p.lampor) {                                                   // ljusslingan (halon stannar ovanför skyltens text)
    ctx.fillStyle = rgba(0xffe6a8, (0.6 * k).toFixed(3)); ctx.fillRect(ox + x, oy + y, 1, 1);
    ctx.fillStyle = rgba(0xffc870, (0.2 * k).toFixed(3)); ctx.fillRect(ox + x - 1, oy + y - 1, 3, 1); ctx.fillRect(ox + x - 1, oy + y, 1, 1); ctx.fillRect(ox + x + 1, oy + y, 1, 1);
  }
  for (const c of [40, 63]) {                                                        // lyktorna vid trappan
    ctx.fillStyle = rgba(0xffe0a0, (0.7 * k).toFixed(3)); ctx.fillRect(ox + c, oy + 58, 1, 2);
    ctx.fillStyle = rgba(0xffc070, (0.18 * k).toFixed(3)); ctx.fillRect(ox + c - 2, oy + 56, 5, 6);
    ctx.fillStyle = rgba(0xffb860, (0.06 * k).toFixed(3)); ctx.fillRect(ox + c - 5, oy + 53, 11, 11);
  }
  ctx.fillStyle = rgba(0xffc878, (0.07 * k).toFixed(3)); ctx.fillRect(ox + 36, oy + 84, 32, 15);   // ljuspölen på trappan
  if (pavLage(st) !== 'tom') { ctx.fillStyle = rgba(0xffd8a0, (0.1 * k).toFixed(3)); ctx.fillRect(ox + 12, oy + 47, 80, 44); } // scenljus under konserten
  if (p.glod) { ctx.globalAlpha = clamp(k * 0.9, 0, 1); ctx.drawImage(p.glod, ox + PAV.SKYLT[0], oy + PAV.SKYLT[1]); ctx.globalAlpha = 1; }
}

// ---------------------------------------------------------------------
// LEKFÖRRÅDET (Carl: "snygga till – skylten sticker ut"): ett himmelsblått
// förråd i locklistpanel med gaveln mot parken och rött tegeltak. Skylten
// LEKFÖRRÅD i lekfulla färger sitter som en bräda tvärs över gavelns fot –
// aldrig bredare än taket. I gavelns runda fönster tittar en nalle ut.
// Dubbeldörr med hänglås; spade på väggen, hink med spade och badboll
// framför och en kälke lutad mot väggen. Bilden är 48 × 70 (x = världs-x − 1142).
// ---------------------------------------------------------------------
const LEK = {
  vagg: [0x2c4e72, 0x44729c, 0x6496c0, 0x94bce0],
  tak: [0x561a12, 0x7c2a1c, 0xa4402c, 0xc45a40, 0xe0805e],
  dorr: [0x7a4e0e, 0xb88418, 0xe4b030, 0xfbd870],
  bokst: [0xd8342a, 0x2a64c8, 0x239a44, 0xe07210],
};
// kälken står på högkant: stålmedar med uppböjda spetsar, röd styrbåge, fernissade ribbor och dragsnöre
const LEK_KALKE = [
  '.mm...MM.', 'm..m.M..M', 'm.rrrrr.M', 'm.RRRRR.M', 'm..y.y..M', 'mbbybybbM', 'mBByByBBM', 'm..y.y..M', 'mbbbybbbM', 'mBBBBBBBM',
  'm.......M', 'mbbbbbbbM', 'mBBBBBBBM', 'm.......M', 'mbbbbbbbM', 'mBBBBBBBM', 'm.......M', 'mbbbbbbbM', 'mBBBBBBBM', 'mm.....MM',
];
const LEK_KALKE_PAL = { m: 0xc0c6d0, M: 0x5a606a, r: 0xe04a3a, R: 0x9a2a20, b: 0xdcaa6c, B: 0x8a5a30, y: 0xf0c030 };
// takpannorna: kurserna löper längs takfoten (lodräta på bilden), fogarna förskjuts kurs för kurs
function lekTegel(x, y, s, T) {
  const a = s > 0 ? x - 4 : 43 - x, b = y - (37 - a), kurs = Math.floor(a / 3), ia = a % 3;
  let c = T[s > 0 ? 3 : 2];
  if (ia === 0) c = T[s > 0 ? 4 : 3]; else if (ia === 2) c = T[s > 0 ? 2 : 1];
  if ((((b + (kurs & 1) * 2) % 4) + 4) % 4 === 0) c = T[s > 0 ? 1 : 0];
  return jit(c, x, y, s > 0 ? 71 : 72, 0.04);
}
function lekFasad(P, K) {
  const o = { night: !!K.night, snow: !!(K.opts && K.opts.snow) }, V = PV.vit, W = LEK.vagg, D = LEK.dorr, S = PV.sten, T = o.snow ? PV.sno : LEK.tak;
  P.erase(0, 0, P.w, P.h);
  // taket: två tegelfall bakom gaveln, nocken rakt bakåt, takfötterna i profil
  fillPoly(P, [[4, 38], [24, 18], [24, 5], [4, 25]], (x, y) => lekTegel(x, y, 1, T));
  fillPoly(P, [[24, 18], [44, 38], [44, 25], [24, 5]], (x, y) => lekTegel(x, y, -1, T));
  for (let y = 5; y <= 18; y++) { P.px(23, y, y % 3 ? T[4] : T[2]); P.px(24, y, y % 3 ? T[2] : T[1]); }
  P.vl(4, 25, 13, T[4]); P.vl(43, 25, 13, T[0]);
  // gaveln i samma locklistpanel, lite i skugga under vindskivorna
  const panel = (x) => { const q = (((x - 8) % 4) + 4) % 4; return q === 0 ? W[3] : q === 1 ? W[1] : W[2]; };
  fillPoly(P, [[5, 38], [24, 19], [43, 38]], (x, y) => jit(mul(panel(x), 0.9), x, y, 75, 0.04));
  for (let y = 18; y <= 37; y++) { P.px(41 - y, y, V[0]); P.px(42 - y, y, V[2]); P.px(y + 6, y, V[2]); P.px(y + 5, y, V[3]); } // vindskivorna
  P.px(23, 16, V[1]); P.px(24, 16, V[2]); P.px(23, 17, V[0]); P.px(24, 17, V[3]);                                  // gavelknoppen
  // det runda fönstret med nallen som tittar ut
  for (let y = 20; y <= 28; y++) for (let x = 19; x <= 28; x++) {
    const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24.5);
    if (d > 3.9) continue;
    P.px(x, y, d > 2.9 ? (x + y < 47 ? V[0] : V[2]) : o.night ? 0x3a3a58 : qmix(0xc8e0f0, 0x5a86a8, (y - 21) / 6, x, y, 3));
  }
  const N = [0x5a3a1e, 0x8a5a30, 0xb07a44, 0xe0b888];
  P.px(22, 23, N[1]); P.px(25, 23, N[1]);                                                                           // öronen
  area(P, 21, 24, 4, 4, (X, Y, i, j) => (j === 3 && (i === 0 || i === 3) ? null : i === 0 ? N[2] : i === 3 ? N[1] : N[2]));
  P.px(22, 25, 0x1a1210); P.px(24, 25, 0x1a1210); P.px(23, 26, N[3]); P.px(22, 26, N[3]); P.px(23, 27, 0x2a1a10);     // ögon och nos
  // SKYLTEN: vit bräda tvärs över gavelns fot, bokstäverna i lekfärger
  area(P, 4, 28, 40, 10, (X, Y, i, j) => (j === 9 || i === 39 ? W[0] : j === 0 || i === 0 ? W[1] : j === 1 ? 0xffffff : jit(0xfbf6ea, X, Y, 73, 0.02)));
  let lx = 6;
  [...'LEKFÖRRÅD'].forEach((ch, n) => { text(P, SMALL, ch, lx, 31, LEK.bokst[n % 4]); lx += textW(SMALL, ch) + 1; });
  if (o.snow) for (let x = 4; x <= 43; x++) if (hash(x, 27, 91) > 0.2) P.px(x, 27, 0xf4f8fe);
  // väggarna: locklistpanel, hörnbräder och sockel
  area(P, 8, 38, 32, 28, (X, Y, i, j) => {
    if (j >= 24) return j === 24 ? S[3] : jit(S[2], X, Y, 74, 0.08);
    let c = jit(panel(X), X, Y, 75, 0.04);
    if (j < 3) c = mul(c, 0.74 + j * 0.07);
    return c;
  });
  P.hl(5, 38, 38, 0x000000, 0.3);
  P.vl(8, 39, 23, V[0]); P.vl(9, 39, 23, V[1]); P.vl(38, 39, 23, V[2]); P.vl(39, 39, 23, V[3]);
  // dubbeldörren: gula plankor, vita Z-reglar, springa, hasp och hänglås (låst!)
  P.vl(15, 39, 27, V[1]); P.vl(32, 39, 27, V[3]); P.hl(15, 39, 18, V[0]);
  area(P, 16, 40, 16, 26, (X, Y, i, j) => {
    const li = i % 8;
    let c = li === 0 ? D[3] : li === 7 ? D[0] : li === 3 || li === 5 ? D[1] : D[2];
    if (j === 25) c = D[0];
    return jit(c, X, Y, 76, 0.05);
  });
  for (const [a, s] of [[17, 1], [30, -1]]) {
    for (let i = 0; i < 6; i++) { P.px(a + s * i, 43, V[1]); P.px(a + s * i, 44, V[3]); P.px(a + s * i, 61, V[1]); P.px(a + s * i, 62, V[3]); }
    P.line(a, 60, a + s * 5, 45, V[1]); P.line(a + s, 60, a + s * 6, 45, V[3]);
  }
  P.vl(23, 40, 26, D[0]); P.vl(24, 40, 26, mul(D[0], 0.75));
  P.hl(21, 51, 6, 0x6a6a74); P.hl(21, 52, 6, 0x9a9aa4);
  P.px(22, 53, 0x8a8a94); P.px(25, 53, 0x8a8a94); P.hl(22, 54, 4, 0xfff0a0); P.hl(22, 55, 4, 0xe4bc48); P.hl(22, 56, 4, 0xb08a24); P.px(23, 55, 0x3a2a10);
  // spaden på väggen (röd plast, gult skaft på en krok)
  P.px(12, 41, 0x3a3a42);
  P.hl(11, 42, 3, 0xf0c030); for (let y = 43; y <= 46; y++) { P.px(12, y, 0xf0c030); P.px(13, y, 0xb08a1e); }
  area(P, 11, 47, 4, 5, (X, Y, i) => (i === 0 ? 0xff6a5a : i === 3 ? 0xa82a1e : 0xe03a2a)); P.hl(12, 52, 2, 0xc8301e);
  P.vl(15, 47, 5, 0x000000, 0.2);
  // hinken med en grön spade och handtag, framför väggen
  for (let y = 53; y <= 57; y++) { P.px(13, y, 0x3aa84a); P.px(14, y, 0x237a30); } P.hl(12, 53, 3, 0x3aa84a);
  P.px(9, 57, 0xf0c030); P.px(15, 57, 0xf0c030); P.hl(10, 56, 5, 0xf0c030);
  P.hl(9, 58, 7, 0x8ad0ff);
  for (let y = 59; y <= 66; y++) { const i0 = y > 62 ? 10 : 9, i1 = y > 62 ? 14 : 15; for (let x = i0; x <= i1; x++) P.px(x, y, x === i0 ? 0x5ab0f0 : x === i1 ? 0x1a5aa8 : 0x2a8ad8); }
  P.hl(10, 60, 5, 0xffd23f); P.hl(9, 67, 7, 0x000000, 0.22);
  if (o.snow) { P.hl(9, 57, 7, 0xf4f8fe); P.hl(33, 46, 8, 0xf4f8fe); }
  // badbollen i gräset
  for (let y = 61; y <= 67; y++) for (let x = 0; x <= 7; x++) {
    const dx = x + 0.5 - 3.5, dy = y + 0.5 - 64, d = Math.hypot(dx, dy);
    if (d > 2.9) continue;
    const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 3)) % 6;
    let c = d < 0.8 ? 0xf8f4ea : [0xe8342a, 0xf8f4ea, 0xffd23f, 0xf8f4ea, 0x2a7ad8, 0xf8f4ea][seg];
    if (dx + dy < -2) c = mix(c, WHITE, 0.35); else if (dx + dy > 2.2) c = mul(c, 0.78);
    P.px(x, y, c);
  }
  P.hl(1, 67, 6, 0x000000, 0.22);
  // kälken lutad mot väggen till höger
  parkRita(P, LEK_KALKE, LEK_KALKE_PAL, 33, 46);
  P.vl(42, 48, 17, 0x000000, 0.18); P.hl(33, 66, 9, 0x000000, 0.2);
}

// ---------------------------------------------------------------------
// TOALETTEN (Carl: "fint men snygga till framsidan och gör skyltarna
// tydligare"): parkgrön panel med vita hörnbräder och platt plåttak med djup
// sarg. En stor blå emaljskylt WC på sargen, riktiga piktogram (dam i rött,
// herr i blått) på vita emaljplåtar på var sida om dörren, dörr med
// ventilationsgaller och upptaget-lampa, två vägglampor. Bilden är 52 × 74.
// ---------------------------------------------------------------------
const WC = { gron: [0x173a2a, 0x245a40, 0x2f7050, 0x468a66, 0x6aa884], bla: [0x14307a, 0x1f4fb0, 0x3a6ad0] };
const WC_DAM = ['.###.', '.###.', '..#..', '.###.', '#####', '#.#.#', '.###.', '#####', '#####', '.#.#.', '.#.#.'];
const WC_HERR = ['.###.', '.###.', '..#..', '#####', '#####', '#.#.#', '#.#.#', '.###.', '.#.#.', '.#.#.', '.#.#.'];
function wcFasad(P, K) {
  const o = { night: !!K.night, snow: !!(K.opts && K.opts.snow) }, V = PV.vit, G = WC.gron, S = PV.sten;
  P.erase(0, 0, P.w, P.h);
  // taket ovanifrån: grå plåt med falsar och uppvikt kant, ventilationshuv
  area(P, 5, 25, 42, 11, (X, Y, i, j) => {
    if (o.snow) return j === 0 ? 0xe4ecf6 : hash(X, Y, 91) > 0.85 ? 0xdfe7f4 : 0xf4f8fe;
    let c = i % 6 === 0 ? 0x9aa4a0 : i % 6 === 1 ? 0x566260 : 0x76827e;
    if (j === 0 || i === 0) c = 0xa8b2ae; else if (i === 41) c = 0x4a5452;
    return jit(c, X, Y, 80, 0.03);
  });
  P.hl(34, 25, 6, o.snow ? 0xf4f8fe : 0x9aa4a0); P.hl(34, 26, 6, 0x6a7472); P.rect(35, 27, 4, 4, 0x8a9490); P.vl(35, 27, 4, 0xb8c0bc); P.vl(38, 27, 4, 0x5a6462);
  // sargen: vit droppkant och mörkgrön plåt
  P.hl(5, 36, 42, V[0]); P.hl(5, 37, 42, G[1]); P.hl(5, 38, 42, G[1]); P.hl(5, 39, 42, G[0]);
  // väggarna: stående panel, hörnbräder, sockel
  area(P, 8, 40, 36, 30, (X, Y, i, j) => {
    if (j >= 26) return j === 26 ? S[3] : jit(S[2], X, Y, 81, 0.08);
    const q = i % 3;
    let c = jit(q === 0 ? G[3] : q === 2 ? G[1] : G[2], X, Y, 82, 0.04);
    if (j < 2) c = mul(c, 0.72 + j * 0.1);
    return c;
  });
  P.vl(8, 40, 26, V[0]); P.vl(9, 40, 26, V[1]); P.vl(42, 40, 26, V[2]); P.vl(43, 40, 26, V[3]);
  // dörren: vit karm, spegel, ventilationsgaller, sparkplåt, handtag och upptaget-skylt
  P.vl(17, 43, 27, V[1]); P.vl(32, 43, 27, V[3]); P.hl(17, 43, 16, V[0]);
  area(P, 18, 44, 14, 26, (X, Y, i, j) => {
    let c = i === 0 ? G[2] : i === 13 ? G[0] : G[1];
    if (i >= 2 && i <= 11 && j >= 2 && j <= 11) c = j === 2 || i === 2 ? G[0] : j === 11 || i === 11 ? G[3] : G[1];
    if (i >= 2 && i <= 11 && j >= 15 && j <= 21) c = j & 1 ? G[0] : G[3];
    if (j >= 23) c = j === 23 ? 0xd8dce4 : 0x9aa0a8;
    return jit(c, X, Y, 83, 0.03);
  });
  P.px(29, 56, 0xfff0a0); P.px(30, 56, 0xe4bc48); P.px(30, 57, 0xa8801e);
  P.rect(28, 52, 3, 2, 0xf4f0e4); P.px(29, 52, 0xd83a2a); P.px(29, 53, 0x9a1e18);
  // piktogrammen på vita emaljplåtar: dam (röd) till vänster, herr (blå) till höger
  const plat = (x, fig, col) => {
    area(P, x, 46, 7, 13, (X, Y, i, j) => (i === 0 || j === 0 ? 0xe4e8ee : i === 6 || j === 12 ? 0x9aa0aa : 0xfcfcf8));
    parkRita(P, fig, { '#': col }, x + 1, 47);
    P.hl(x + 1, 59, 7, 0x000000, 0.25); P.vl(x + 7, 47, 12, 0x000000, 0.18);
  };
  plat(10, WC_DAM, 0xd02a3a); plat(34, WC_HERR, 0x1f4fb0);
  // WC-skylten: blå emalj med vit kant, stor vit text – står på sargen ovanför dörren
  area(P, 16, 30, 17, 11, (X, Y, i, j) => {
    if ((i === 0 || i === 16) && (j === 0 || j === 10)) return null;
    if (i === 0 || j === 0) return 0xffffff;
    if (i === 16 || j === 10) return 0xc8ccd6;
    return j <= 2 ? WC.bla[2] : j >= 8 ? WC.bla[0] : WC.bla[1];
  });
  text(P, BIG, 'WC', 20, 32, WC.bla[0]); text(P, BIG, 'WC', 19, 32, 0xffffff);
  P.px(17, 31, 0xc8d8ff); P.px(18, 31, 0x8aa8f0);
  P.hl(17, 41, 16, 0x000000, 0.3);
  if (o.snow) P.hl(17, 29, 15, 0xf4f8fe);
  // vägglamporna ovanför plåtarna
  const lampor = [];
  for (const x of [13, 37]) {
    P.px(x, 41, 0x2a2a30); P.hl(x - 1, 42, 3, 0x2a2a30); P.hl(x - 1, 43, 3, o.night ? 0xfff0b8 : 0xe8ecf0); P.px(x, 44, 0x2a2a30);
    lampor.push([x + K.box.x, 43 + K.box.y]);
  }
  K.lit.length = 0; K.shop.length = 0;
  K.out.busy = { x: 29 + K.box.x, y: 52 + K.box.y };
  K.out.wcLampor = lampor;
}
function wcGlow(ctx, b, st, k, m) {
  if (m.busy) { ctx.fillStyle = rgba(0xff4a3a, (0.6 * k).toFixed(3)); ctx.fillRect(m.busy.x - 1, m.busy.y - 1, 3, 3); }
  for (const [x, y] of m.wcLampor || []) {
    ctx.fillStyle = rgba(0xfff0c0, (0.7 * k).toFixed(3)); ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillStyle = rgba(0xffc870, (0.16 * k).toFixed(3)); ctx.fillRect(x - 3, y - 1, 7, 3);
  }
  if (m.wcLampor) { ctx.fillStyle = rgba(0xffd890, (0.07 * k).toFixed(3)); ctx.fillRect(b.x + 2, baseOf(b), b.w - 4, 12); }   // ljuset på plattorna framför
}

// ---------------------------------------------------------------------
// DJURAFFÄRENS GATUPRATARE (Carl: "ska stå REKLAM UTANFÖR"): en A-skylt i
// butikens gröna trä med svart kritbräda vid kantstenen väster om dörren –
// utanför dörrzonen (map.js doorFront), intill gatlyktan. Erbjudandena byts
// var åttonde sekund; när butiken är stängd står det när den öppnar.
// ---------------------------------------------------------------------
const DJUR_ERBJ = [
  [['VALPAR!', 0xf8a8c8], ['KOM IN', 0xf2eee0], ['OCH KELA', 0xf2eee0]],
  [['KATTMAT', 0xf8e078], ['2 FÖR 1', 0xf8a8c8], 'tassar'],
  [['NYHET:', 0x9adcf8], ['AKVARIER', 0xf2eee0], ['FR 199:-', 0xf8e078]],
  [['FÅGELFRÖ', 0xa8e8a0], ['HALVA', 0xf2eee0], ['PRISET!', 0xf8e078]],
];
const djurPratPlats = (b) => ({ x0: b.door.x0 - 32, fy: baseOf(b) + 28 });              // skylten: x0 … x0 + 34 (fri från gatlyktan), foten på fy
function djurPratImg(key, rader, snow) {
  return parkImg('prat:' + key + (snow ? ':s' : ''), 35, 34, (P) => {
    const GR = [0x14402a, 0x1f5c38, 0x2f7a4a, 0x4a9a64], TAVLA = 0x262c26;
    P.hl(3, 0, 29, GR[0]); P.hl(2, 1, 31, GR[1]);                                       // bakre bladet skymtar (A-formen)
    area(P, 0, 2, 35, 26, (X, Y, i, j) => {
      if (i >= 2 && i <= 32 && j >= 2 && j <= 23) { const n = hash(X, Y, 931); return n > 0.9 ? 0x343a34 : n < 0.08 ? 0x1c201c : TAVLA; }
      let c = GR[2];
      if (j === 0 || i === 0) c = GR[3]; else if (j === 25 || i === 34) c = GR[0]; else if (i === 1 || j === 1) c = mix(GR[2], GR[3], 0.4);
      return jit(c, X, Y, 932, 0.05);
    });
    for (const [x, y] of [[6, 21], [7, 22], [25, 7], [27, 6]]) P.px(x, y, 0x3e443e);     // gamla kritsuddar
    rader.forEach((r, n) => {
      const y = 6 + n * 7;
      if (r === 'tassar') {
        const T = SPECS.djuraffar?._PAWS || ['.#.#.', '#...#', '.###.', '.###.'];
        [0xf8a8c8, 0xf2eee0, 0xf8e078].forEach((c, k) => T.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(7 + k * 8 + i, y + (k & 1) + j, c); }));
        return;
      }
      const [s, c] = r, x = 2 + ((31 - textW(SMALL, s)) >> 1);
      text({ px: (px, py) => P.px(px, py, hash(px, py, 933) > 0.86 ? mix(c, TAVLA, 0.35) : c) }, SMALL, s, x, y);
    });
    P.hl(3, 28, 29, GR[3]); P.hl(3, 29, 29, GR[1]);                                    // krittråget med kritbitar
    P.hl(8, 27, 2, 0xf4f0e6); P.px(14, 27, 0xf8a8c8); P.hl(23, 27, 2, 0xf8e078);
    for (let j = 0; j < 3; j++) { P.px(4, 30 + j, GR[0]); P.px(30, 30 + j, GR[0]); }     // bakre benen
    for (let j = 0; j < 5; j++) { const d = j >> 1; P.px(1 - d + 1, 28 + j, GR[3]); P.px(2 - d + 1, 28 + j, GR[1]); P.px(32 + d, 28 + j, GR[2]); P.px(33 + d - 1, 28 + j, GR[0]); }
    P.hl(0, 33, 35, 0x000000, 0.22);
    if (snow) { P.hl(2, 0, 31, 0xf4f8fe); P.hl(1, 1, 33, 0xe8eef8); }
  });
}
function djurPratare(b, st) {
  const { x0, fy } = djurPratPlats(b), h = st.hour ?? 12, open = !b.open || (h >= b.open[0] && h < b.open[1]);
  const snow = (st.env?.weather?.snowCover || 0) > 0.5, kl = b.open?.[0] ?? 9;
  const i = Math.floor((st.t || 0) / 8) % DJUR_ERBJ.length;
  const img = open ? djurPratImg('e' + i, DJUR_ERBJ[i], snow) : djurPratImg('stangt' + kl, [['STÄNGT', 0xf8a8c8], ['ÖPPNAR', 0xf2eee0], ['KL ' + kl, 0xf8e078]], snow);
  return [{ y: fy, draw: (ctx) => ctx.drawImage(img, x0, fy - 33) }];
}
function djurPratareHinder(b) { const { x0, fy } = djurPratPlats(b); return [[x0 + 1, fy - 4, x0 + 34, fy + 1]]; }

// ---- överstyrningar av fasadlådans dörr ----
// Musikpaviljongen är öppen: ingen dörr som slår upp och inget mörker i öppningen.
if (BUILDING_ART.paviljong) { const live = BUILDING_ART.paviljong.live; BUILDING_ART.paviljong.live = (ctx, b, st) => live(ctx, b, { ...st, doorOpen: 0 }); }
// Klick-beskedet (valfri krok, används av city.js om den vill): besked(env, hour) → text som
// stämmer med vad scenen visar – spelar kåren, när nästa konsert börjar, regn eller vinteruppehåll.
if (BUILDING_ART.paviljong) BUILDING_ART.paviljong.besked = (env, hour) => pavBesked(env || {}, hour ?? env?.hour ?? 12);
// Kiosken: glasståndet i props.js målas på kioskens plats – huset självt ritar ingenting
// (tom bild, ingen live/glow: ingen mörk dörröppning och inget kvällsljus genom ståndet).
BUILDING_ART.kiosk = { paint(b) { const c = document.createElement('canvas'); c.width = b.w + 16; c.height = (b.d || 0) + b.h + 20; return c; } };
// === (slut på parkens småhus) ===
