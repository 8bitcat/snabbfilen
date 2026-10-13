// 🧰 INNE-KITET – rekvisita som Tassbackens lokaler delar (v0.134, Carl 2026-10-13: "höj till samma detaljrikedom
// som centrum" inomhus också): ljusslingor, taklampor, tavlor, hyllor med saker, affischer, anslagstavlor, klockor,
// gardiner, fönster, brandsläckare, krukväxter, papperskorgar, vattenautomater, mattor. Det stillastående målas med
// Pix-pennan i lokalens bakgrund (en gång); det som rör sig (slingans lampor, lampornas sken) ritas varje bildruta.
// Alla mått i lokalens koordinater; y växer nedåt.
import { Pix, SMALL, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { PENNOR, FARGER } from './hus.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, ZINK, STEN, TRA, TERR, BLAD, RODT, BLA, MINP, ROSP, SAND } = FARGER;
export const GUL = [0x845408, 0xc08c10, 0xeebc20, 0xffde5c, 0xfff6b4];
export const BOK = [0xd84a6a, 0x3a7bd5, 0x46a35a, 0xf0c030, 0x8a5ad0, 0xf08a2a, 0x228c96, 0xf4f1ea, 0x5a3a28];
export const SLINGA = ['#ffe08a', '#ff9ac4', '#9ad8ff', '#a8ff9a'];

// ---------- små saker på hyllor ----------
export const mugg = (P, x, y, c) => { P.rect(x, y, 3, 3, c); P.px(x, y, mix(c, 0xffffff, 0.4)); P.px(x + 3, y + 1, mul(c, 0.7)); };
export const burk = (P, x, y, c, h = 6, lock = ZINK[3]) => { fyll(P, x, y - h, x + 4, y, (X, Y) => (Y === y - h ? lock : X === x ? mix(c, 0xffffff, 0.35) : X === x + 4 ? mul(c, 0.7) : c)); P.px(x + 1, y - 3, mix(c, 0xffffff, 0.5)); };
export const flaska = (P, x, y, c, h = 9) => { P.rect(x, y - h + 3, 4, h - 3, c); P.px(x, y - h + 3, mix(c, 0xffffff, 0.4)); P.px(x + 3, y - 2, mul(c, 0.7)); P.rect(x + 1, y - h, 2, 3, mul(c, 0.8)); P.px(x + 1, y - h, ZINK[3]); P.px(x + 2, y - h, ZINK[3]); P.rect(x + 1, y - h + 5, 2, 3, 0xffffff, 0.5); };
export const bok = (P, x, y, w, h, c) => { fyll(P, x, y - h, x + w - 1, y - 1, (X) => (X === x ? mix(c, 0xffffff, 0.3) : X === x + w - 1 ? mul(c, 0.7) : c)); if (h > 9) P.px(x + (w >> 1), y - h + 2, mix(c, 0xffffff, 0.5)); };
export const kruka = (P, x, y, farg = 0xe04848) => PENNOR.kruka(P, x, y, farg);
export function hyllplan(P, x, y, w, pal = TRA) { P.hl(x, y, w, pal[4]); P.hl(x, y + 1, w, pal[2]); P.hl(x, y + 2, w, 0x000000, 0.15); for (const kx of [x + 1, x + w - 2]) { P.px(kx, y + 2, pal[1]); P.px(kx, y + 3, pal[1]); } }
export function bokrad(P, x, y, w, s = 1) { let bx = x, i = 0; while (bx < x + w - 2) { const bw = 2 + ((hash(i, s, 11) * 2) | 0), bh = 8 + ((hash(i, s, 12) * 4) | 0); bok(P, bx, y, bw, bh, BOK[(i + s) % BOK.length]); bx += bw + (hash(i, s, 13) > 0.8 ? 2 : 0); i++; } }
export function muggrad(P, x, y, n, s = 1) { for (let i = 0; i < n; i++) mugg(P, x + i * 6, y, BOK[(i + s) % 7]); }
export function burkrad(P, x, y, n, s = 1) { for (let i = 0; i < n; i++) burk(P, x + i * 7, y, [0xc89a5a, 0xf0d8a0, 0x8a5a30, 0xe0a030, 0xf4ecd8, 0x8ad8ff][(i + s) % 6], 5 + ((i + s) % 3)); }
export function flaskrad(P, x, y, n, s = 1) { for (let i = 0; i < n; i++) flaska(P, x + i * 6, y, [0xf07ab8, 0x62c8a0, 0x6ab4f0, 0xf0c040, 0xa87ae8, 0xf4f1ea, 0xe0484a][(i + s) % 7], 8 + ((i + s) % 3)); }

// ---------- väggen ----------
// en tavla i ram: motiv katt/hund/kanin/tass/fisk/hjarta/ben, färgad bakgrund
export function tavla(P, x, y, w, h, motiv, bg = 0xf0d4b8, ram = MASS) {
  fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => (X === x || X === x + w - 1 || Y === y || Y === y + h - 1) ? tone(ram, X === x || Y === y ? 0.9 : 0.4, X, Y) : tone([mul(bg, 0.7), mul(bg, 0.85), bg, mix(bg, 0xffffff, 0.2), mix(bg, 0xffffff, 0.4)], 0.6 - (Y - y) * 0.04, X, Y));
  const mx = x + (w >> 1), my = y + (h >> 1), k = 0x3a2a2a;
  if (motiv === 'katt') { P.px(mx - 2, my - 3, k); P.px(mx + 2, my - 3, k); P.rect(mx - 2, my - 2, 5, 3, k); P.px(mx - 1, my - 1, 0x9ad860); P.px(mx + 1, my - 1, 0x9ad860); P.rect(mx - 1, my + 1, 3, 1, k); }
  else if (motiv === 'hund') { P.rect(mx - 2, my - 2, 5, 3, 0x8a5a30); P.px(mx - 3, my - 3, 0x8a5a30); P.px(mx + 3, my - 3, 0x8a5a30); P.rect(mx - 2, my + 1, 5, 2, 0xc89a5a); P.px(mx - 1, my - 1, 0x1a1414); P.px(mx + 1, my - 1, 0x1a1414); }
  else if (motiv === 'kanin') { P.px(mx - 1, my - 4, 0xd8d0c8); P.px(mx + 1, my - 4, 0xd8d0c8); P.px(mx - 1, my - 3, 0xd8d0c8); P.px(mx + 1, my - 3, 0xd8d0c8); P.rect(mx - 2, my - 2, 5, 4, 0xd8d0c8); P.px(mx - 1, my - 1, 0x1a1414); P.px(mx + 1, my - 1, 0x1a1414); P.px(mx, my, 0xf06aa0); }
  else if (motiv === 'tass') { P.px(mx, my, k); P.px(mx - 1, my - 1, k); P.px(mx + 1, my - 1, k); P.px(mx - 1, my + 1, k); P.px(mx + 1, my + 1, k); P.px(mx, my + 1, k); }
  else if (motiv === 'fisk') { P.rect(mx - 3, my - 1, 5, 3, 0x3a7bd5); P.px(mx + 2, my - 2, 0x3a7bd5); P.px(mx + 2, my + 2, 0x3a7bd5); P.px(mx - 2, my, 0xffffff); }
  else if (motiv === 'hjarta') { P.px(mx - 1, my - 2, 0xe0384a); P.px(mx + 1, my - 2, 0xe0384a); P.rect(mx - 2, my - 1, 5, 2, 0xe0384a); P.rect(mx - 1, my + 1, 3, 1, 0xe0384a); P.px(mx, my + 2, 0xe0384a); }
  else if (motiv === 'ben') { P.rect(mx - 2, my, 5, 1, 0xf4ecd8); P.px(mx - 3, my - 1, 0xf4ecd8); P.px(mx - 3, my + 1, 0xf4ecd8); P.px(mx + 3, my - 1, 0xf4ecd8); P.px(mx + 3, my + 1, 0xf4ecd8); }
  else if (motiv === 'blomma') { P.px(mx, my - 2, 0xf06aa0); P.px(mx - 2, my, 0xf06aa0); P.px(mx + 2, my, 0xf06aa0); P.px(mx, my + 2, 0xf06aa0); P.px(mx, my, 0xf0c030); P.px(mx, my + 3, 0x3e7e2a); }
}
// en affisch: typ vaccin/mat/hitta/klipp/show/adoptera – rubrikband + ett motiv + textrader
export function affisch(P, x, y, w, h, typ) {
  const bg = { vaccin: 0xd8ecf8, mat: 0xf8e4a0, hitta: 0xffffff, klipp: 0xf8d0e0, show: 0x1e3a5a, adoptera: 0xf4f1ea }[typ] || 0xf4f1ea;
  const band = { vaccin: 0x2a9a5a, mat: 0xe0a030, hitta: 0xd8343c, klipp: 0xd84a8a, show: 0xf8d860, adoptera: 0xa8382a }[typ] || 0x3a7bd5;
  fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => (X === x || X === x + w - 1 || Y === y || Y === y + h - 1) ? mul(bg, 0.7) : bg);
  P.rect(x + 1, y + 1, w - 2, 5, band); P.hl(x + 1, y + 1, w - 2, mix(band, 0xffffff, 0.3));
  const mx = x + (w >> 1), my = y + 7 + ((h - 12) >> 1);
  if (typ === 'vaccin') { P.rect(mx - 1, my - 5, 2, 8, 0xc8ccd4); P.rect(mx - 2, my - 6, 4, 2, 0x8a929c); P.px(mx, my + 3, 0x8a929c); P.px(mx, my + 4, 0x8a929c); P.px(mx - 3, my - 2, 0xd8343c); P.px(mx + 2, my - 2, 0xd8343c); }
  else if (typ === 'mat') { P.rect(mx - 4, my - 1, 8, 3, 0xd8343c); P.hl(mx - 3, my - 2, 6, 0xf07a7a); for (let i = 0; i < 3; i++) P.px(mx - 2 + i * 2, my - 3, 0x8a5a30); }
  else if (typ === 'hitta') { P.rect(mx - 3, my - 3, 6, 5, 0x8a5a30); P.px(mx - 4, my - 4, 0x8a5a30); P.px(mx + 3, my - 4, 0x8a5a30); P.px(mx - 2, my - 2, 0x1a1414); P.px(mx + 1, my - 2, 0x1a1414); P.px(mx - 1, my, 0x1a1414); P.px(mx, my, 0x1a1414); }
  else if (typ === 'klipp') { P.px(mx - 2, my - 3, 0x8a929c); P.px(mx + 2, my - 3, 0x8a929c); P.px(mx - 1, my - 2, 0x8a929c); P.px(mx + 1, my - 2, 0x8a929c); P.px(mx, my - 1, MASS[3]); P.px(mx - 1, my, 0xd84a8a); P.px(mx + 1, my, 0xd84a8a); P.px(mx - 2, my + 1, 0xd84a8a); P.px(mx + 2, my + 1, 0xd84a8a); }
  else if (typ === 'show') { for (let i = 0; i < 3; i++) P.rect(mx - 4 + i * 3, my - 1 + (i === 1 ? -2 : 0), 2, 4 + (i === 1 ? 2 : 0), 0xf8d860); P.px(mx, my - 4, 0xffffff); }
  else { P.px(mx - 1, my - 2, 0xe0384a); P.px(mx + 1, my - 2, 0xe0384a); P.rect(mx - 2, my - 1, 5, 2, 0xe0384a); P.rect(mx - 1, my + 1, 3, 1, 0xe0384a); P.px(mx, my + 2, 0xe0384a); }
  for (let i = 0; i < 3; i++) { const ly = y + h - 8 + i * 2; if (ly >= y + h - 1) break; P.hl(x + 3, ly, w - 6 - (i % 2) * 3, typ === 'show' ? 0x8aa0c0 : mul(bg, 0.6)); }
}
// anslagstavlan: kork med lappar, nålar och ett foto
export function anslagstavla(P, x, y, w, h, s = 1) {
  fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => (X === x || X === x + w - 1 || Y === y || Y === y + h - 1) ? TRA[2] : tone(SAND, 0.6 + (hash(X, Y, s) - 0.5) * 0.2, X, Y));
  let px = x + 3, py = y + 3, i = 0;
  while (px < x + w - 8) { const pw = 7 + ((hash(i, s, 21) * 5) | 0), ph = 6 + ((hash(i, s, 22) * 5) | 0), c = [0xfaf8f2, 0xf8f0a0, 0xd8ecf8, 0xf8d0e0][(i + s) % 4]; if (py + ph > y + h - 2) { py = y + 3; px += pw + 2; continue; } fyll(P, px, py, px + pw - 1, py + ph - 1, () => c); for (let l = 0; l < ph - 3; l += 2) P.hl(px + 1, py + 2 + l, pw - 2 - (l % 3), mul(c, 0.7)); P.px(px + (pw >> 1), py, [0xd8343c, 0x3a7bd5, 0xf0c030][(i + s) % 3]); py += ph + 2; i++; }
}
// en rund väggklocka
export function vaggklocka(P, x, y, r = 6, ram = JARN) { fyll(P, x - r, y - r, x + r, y + r, (X, Y) => { const d = Math.hypot(X + 0.5 - x, Y + 0.5 - y); return d > r + 0.5 ? null : d > r - 1.2 ? tone(ram, X < x ? 0.8 : 0.4, X, Y) : 0xfaf6ea; }); P.vl(x, y - r + 3, r - 3, 0x22202a); P.hl(x, y, r - 3, 0x22202a); P.px(x, y, 0xd8343c); for (const [dx, dy] of [[0, -r + 2], [0, r - 2], [-r + 2, 0], [r - 2, 0]]) P.px(x + dx, y + dy, 0x5a5a62); }
// gardiner på båda sidor om ett fönster (x0..x1 = fönsterramen)
export function gardiner(P, x0, x1, y0, y1, pal = ROSP, monster = 0xd84a6a) { for (const [gx, s] of [[x0 - 1, 1], [x1 + 1, -1]]) for (let y = y0; y < y1; y++) { const w = 6 + Math.round(Math.sin(y / 4) * 1.5) + (y > y1 - 10 ? 2 : 0); for (let i = 0; i < w; i++) { const X = gx + s * i; P.px(X, y, (i + y) % 5 === 0 ? monster : (y % 7 === 3 && i % 3 === 1) ? 0xffffff : tone(pal, 0.68 - i * 0.03, X, y)); } } P.hl(x0 - 10, y0 - 1, x1 - x0 + 21, JARN[2]); P.px(x0 - 11, y0 - 1, MASS[3]); P.px(x1 + 10, y0 - 1, MASS[3]); }
// ett fönster med utsikt (himmel, hus på andra sidan gatan, träd), spröjs och glans
export function fonster(P, x, y, w, h, o = {}) {
  const R = o.ram || VIT;
  P.rect(x - 3, y - 3, w + 6, h + 6, R[3]); P.hl(x - 3, y - 3, w + 6, R[4]); P.vl(x + w + 2, y - 3, h + 6, R[1]); P.hl(x - 3, y + h + 2, w + 6, R[1]);
  for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) P.px(X, Y, mix(0xb8e0f8, 0x7ab8e0, Math.floor(Math.max(0, Math.min(1, (Y - y) / h)) * 4 + bayer(X, Y)) / 4));
  if (o.hus !== false) for (let hx = x + 6; hx < x + w - 10; hx += 24) { const hh = 10 + ((hash(hx, 1, 3) * 6) | 0), c = [0xe07a5a, 0xf0c030, 0x8ab4d8, 0xb8e0d0][((hx / 24) | 0) % 4]; fyll(P, hx, y + h - 14 - hh, hx + 14, y + h - 14, (X, Y) => tone([mul(c, 0.6), mul(c, 0.8), c, mix(c, 0xffffff, 0.25), mix(c, 0xffffff, 0.5)], 0.6 + (Y === y + h - 14 - hh ? 0.2 : 0), X, Y)); P.hl(hx - 2, y + h - 15 - hh, 18, mul(c, 0.5)); for (let i = 0; i < 2; i++) P.rect(hx + 2 + i * 6, y + h - 11 - hh, 2, 3, 0xd8f0ff); }
  for (let X = x; X < x + w; X++) { const th = 12 + Math.round(Math.sin(X / 7) * 3 + Math.sin(X / 2.5)); for (let Y = y + h - th; Y < y + h; Y++) P.px(X, Y, tone(BLAD, 0.5 + (hash(X >> 1, Y >> 1, 5) - 0.5) * 0.4 - (Y - y - h + th) * 0.02, X, Y)); }
  if (o.sprojs !== false) { P.vl(x + (w >> 1), y, h, R[3]); P.hl(x, y + (h >> 1), w, R[3]); }
  for (let k = 0; k < Math.max(1, w / 18 | 0); k++) P.line(x + 4 + k * 18, y + 3, x + 14 + k * 18, y + 14, 0xffffff, 0.3);
  P.hl(x - 4, y + h + 3, w + 8, R[4]); P.hl(x - 4, y + h + 4, w + 8, R[1]);   // fönsterbrädan
}
export function brandslackare(P, x, y) { P.rect(x, y - 10, 4, 10, 0xd8343c); P.px(x, y - 10, 0xf07a7a); P.rect(x + 1, y - 12, 2, 2, JARN[2]); P.px(x + 3, y - 11, JARN[3]); P.px(x + 4, y - 11, JARN[3]); P.px(x + 4, y - 10, JARN[2]); P.hl(x, y - 6, 4, 0xffffff, 0.6); }
export function eluttag(P, x, y) { P.rect(x, y, 4, 4, 0xf4f1ea); P.px(x + 1, y + 1, 0x2a2a30); P.px(x + 2, y + 2, 0x2a2a30); }
export function ljusslinga(P, W, y = 6) { for (let x = 0; x < W; x++) P.px(x, y + Math.round(Math.sin(x / 5) * 1.5), 0x4a3a2a); }
export function taklampa(P, x, y0 = 5, y1 = 26, pal = GUL) { P.vl(x, y0, y1 - y0, 0x3a2a2a); P.rect(x - 1, y0, 3, 2, JARN[2]); for (let j = 0; j < 7; j++) P.hl(x - 3 - j, y1 + j, 7 + j * 2, j === 6 ? mul(pal[2], 0.6) : j === 0 ? pal[4] : tone(pal, 0.7 - j * 0.04, x, y1 + j)); P.hl(x - 9, y1 + 7, 19, 0xfff2c0); }
export function lysror(P, x, y, w) { P.rect(x, y, w, 3, ZINK[2]); P.hl(x + 1, y + 1, w - 2, 0xfff8e0); P.hl(x + 1, y + 3, w - 2, 0xfff8e0, 0.5); }
// mattor på golvet
export function matta(P, x, y, w, h, a = 0xd8a050, b = 0xe0c8a0, kant = 0xa8382a) { for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) { const e = X === x || X === x + w - 1 || Y === y || Y === y + h - 1, r = ((Y - y) >> 2) & 1; P.px(X, Y, e ? kant : r ? mix(a, mul(a, 0.9), hash(X >> 2, Y, 6) * 0.4) : mix(b, mul(b, 0.92), hash(X >> 2, Y, 7) * 0.4)); } }
export function rundmatta(P, cx, cy, rx, ry, a = 0xd84a6a, b = 0xf4ecd8) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const d = Math.hypot(x / rx, y / ry); if (d > 1) continue; P.px(cx + x, cy + y, Math.floor(d * 5) % 2 ? a : b); } }
export function dorrmatta(P, x, y, w, h, a = 0x8a5a30, b = 0x6a4424) { for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) P.px(X, Y, (X + Y) % 2 ? a : b); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px(x + (w >> 1) + dx, y + (h >> 1) + dy, 0xf0c030); }
export function leksaker(P, list) { for (const [tx, ty, typ] of list) { if (typ === 'mus') { P.rect(tx, ty, 5, 3, 0x9a9aa4); P.px(tx + 5, ty + 1, 0xf0a0b0); P.px(tx, ty, 0xb8b8c4); for (let k = 0; k < 5; k++) P.px(tx - 1 - k, ty + 2 + (k & 1), 0x9a9aa4); } else if (typ === 'boll') { P.rect(tx, ty - 1, 4, 4, 0xd84a6a); P.px(tx, ty - 1, 0xf07ab8); P.px(tx + 3, ty + 2, 0x9a2a4a); P.px(tx + 1, ty, 0xffffff); } else if (typ === 'ben') { P.rect(tx - 2, ty, 5, 1, 0xf4ecd8); P.px(tx - 3, ty - 1, 0xf4ecd8); P.px(tx - 3, ty + 1, 0xf4ecd8); P.px(tx + 3, ty - 1, 0xf4ecd8); P.px(tx + 3, ty + 1, 0xf4ecd8); } else { P.vl(tx, ty, 6, 0xc8a060); P.px(tx - 1, ty - 1, 0xd8343c); P.px(tx + 1, ty - 1, 0x3a7bd5); P.px(tx, ty - 2, 0xf0c030); } } }

// ---------- golvsaker som ritas varje bildruta (cachade bilder, origo = foten) ----------
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(20,12,30,.24)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
// 🪴 en stor krukväxt: monstera (stora flikiga blad), palm (bågar), ficus (rund krona) eller fikus i korg
export function ritaKrukvaxt(ctx, x, y, typ = 'monstera') {
  skugga(ctx, x, y, 16);
  put(ctx, bild('vaxt|' + typ, 40, 56, 20, 52, (P) => {
    fyll(P, -7, -12, 7, 0, (X, Y) => tone(TERR, 0.62 - (X + 7) * 0.03 + (Y === -12 ? 0.25 : 0) - (Y > -3 ? 0.1 : 0), X, Y)); P.hl(-8, -13, 17, TERR[4]); P.rect(-5, -8, 3, 1, 0xf4f1ea, 0.4);
    if (typ === 'monstera') { for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42, L = 16 + (k % 3) * 6; for (let s = 2; s < L; s++) { const X = Math.round(Math.cos(a) * s), Y = Math.round(-12 + Math.sin(a) * s * 0.9); P.px(X, Y, k % 2 ? BLAD[1] : BLAD[2]); if (s > L - 9) { for (let j = -2; j <= 2; j++) if ((s + j) % 3 !== 0) P.px(X + j, Y, s > L - 4 ? BLAD[3] : BLAD[2]); } } } }
    else if (typ === 'palm') { P.vl(0, -34, 22, 0x8a5a30); P.vl(-1, -30, 18, 0x6a4420); for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) * (Math.PI / 7); for (let s = 0; s < 16; s++) { const X = Math.round(Math.cos(a) * s * 1.1), Y = Math.round(-34 + Math.sin(a) * s * 0.5 + s * s * 0.03); P.px(X, Y, s > 11 ? BLAD[3] : BLAD[2]); P.px(X, Y + 1, BLAD[1]); } } }
    else if (typ === 'ficus') { P.vl(0, -30, 18, 0x8a5a30); P.vl(1, -30, 18, 0x6a4420); for (let j = -14; j <= 6; j++) for (let i = -12; i <= 12; i++) { const d = Math.hypot(i / 12, (j + 4) / 11); if (d > 1 || (d > 0.85 && hash(i, j, 3) > 0.5)) continue; P.px(i, -30 + j, tone(BLAD, 0.55 - i * 0.02 - j * 0.03 + (hash(i >> 1, j >> 1, 4) - 0.5) * 0.3, i, j)); } }
    else { for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.3, L = 10 + (k % 3) * 4; for (let s = 2; s < L; s++) P.px(Math.round(Math.cos(a) * s), Math.round(-12 + Math.sin(a) * s * 0.9), s > L - 4 ? BLAD[3] : k % 2 ? BLAD[1] : BLAD[2]); } }
  }), x, y);
}
export function ritaPapperskorg(ctx, x, y, c = 0x3a4048) { skugga(ctx, x, y, 10); put(ctx, bild('korg|' + c, 14, 16, 7, 14, (P) => { fyll(P, -4, -12, 4, 0, (X, Y) => tone([mul(c, 0.6), mul(c, 0.8), c, mix(c, 0xffffff, 0.2), mix(c, 0xffffff, 0.4)], 0.65 - (X + 4) * 0.06 + (Y === -12 ? 0.2 : 0), X, Y)); P.hl(-4, -13, 9, mix(c, 0xffffff, 0.3)); P.px(-1, -11, 0xf4f1ea, 0.5); P.px(1, -12, 0xf0c030); }), x, y); }
export function ritaVattenautomat(ctx, x, y) { skugga(ctx, x, y, 12); put(ctx, bild('vatten', 16, 44, 8, 40, (P) => { fyll(P, -5, -26, 5, 0, (X, Y) => tone(VIT, 0.75 - (X + 5) * 0.03 + (Y === -26 ? 0.2 : 0), X, Y)); fyll(P, -4, -38, 4, -26, (X, Y) => (Y === -38 ? 0xd8f0ff : X === -4 ? 0xd8f0ff : X === 4 ? 0x5aa0d8 : 0x8ac8f0)); P.px(-3, -34, 0xffffff); P.px(-3, -33, 0xffffff); P.rect(-3, -20, 2, 3, 0x3a7bd5); P.rect(1, -20, 2, 3, 0xd8343c); P.rect(-3, -14, 6, 2, ZINK[2]); P.rect(-4, -8, 8, 6, ZINK[3]); for (let i = 0; i < 3; i++) P.rect(-3 + i * 3, -7, 2, 4, 0xd8f0ff); }), x, y); }
export function ritaKrukstativ(ctx, x, y) { skugga(ctx, x, y, 10); put(ctx, bild('stativ', 14, 30, 7, 28, (P) => { P.vl(0, -22, 22, JARN[2]); P.hl(-4, 0, 9, JARN[2]); P.hl(-4, -1, 9, JARN[3]); P.hl(-4, -22, 9, JARN[3]); PENNOR.kruka(P, -2, -23, 0xf06aa0); }), x, y); }
// kapphylla på väggen (Pix): list med krokar och en jacka, en halsduk, ett paraply
export function kapphylla(P, x, y) { P.rect(x, y, 14, 2, TRA[3]); for (const kx of [x + 2, x + 7, x + 12]) { P.px(kx, y + 2, JARN[3]); P.px(kx, y + 3, JARN[2]); } fyll(P, x, y + 4, x + 4, y + 20, (X, Y) => tone(BLA, 0.6 - (X - x) * 0.08 + (Y === y + 4 ? 0.2 : 0), X, Y)); P.px(x + 2, y + 6, 0xf0c030); for (let yy = y + 4; yy < y + 22; yy++) P.px(x + 7 + (yy % 4 === 3 ? 1 : 0), yy, (yy >> 1) & 1 ? 0xd8343c : 0xf4f1ea); P.vl(x + 12, y + 4, 14, JARN[2]); P.px(x + 13, y + 4, JARN[3]); P.rect(x + 11, y + 18, 3, 3, 0x2a2a30); P.px(x + 12, y + 21, MASS[3]); }

// ---------- det som rör sig ----------
export function ritaLjusslinga(ctx, t, W, y = 7) { for (let x = 4; x < W; x += 10) { const on = (Math.floor(t * 2) + (x / 10)) % 3 !== 0; ctx.fillStyle = on ? SLINGA[(x / 10) % 4] : '#5a4a3a'; ctx.fillRect(x, y + Math.round(Math.sin(x / 5) * 1.5), 2, 2); } }
export function ritaLampsken(ctx, lampor, y = 34, c = '255,228,150') { for (const lx of lampor) { const g = ctx.createRadialGradient(lx, y, 2, lx, y, 40); g.addColorStop(0, `rgba(${c},.28)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(lx - 40, y - 4, 80, 60); ctx.fillStyle = '#fff6d0'; ctx.fillRect(lx - 2, y - 1, 5, 1); } }
