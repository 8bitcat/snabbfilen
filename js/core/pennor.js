// ✏️ PENNORNA – de små ritverktygen som all ny pixelgrafik delar (husen i Tassbacken, Pixelbergs stånd och entré,
// lokalerna inomhus): tonramper med Bayer-dither, fyll med en färgfunktion, små sprites ur textrader, text med
// kant – och paletterna (mörk → ljus, fem toner). Ett pixelkorn, ljuset från vänster uppe.
import { Pix, text, bayer, mix, mul } from './floor-pix.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// tonen ur en palett för värdet v (0–1) – med en liten dither i övergångarna
export function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
// fyll en rektangel med en färgfunktion (null = hoppa över pixeln)
export function fyll(P, x0, y0, x1, y1, fn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = fn(x, y); if (c != null) P.px(x, y, c); } }
// en liten sprite ur textrader: pal[tecken] = färg ('.' = inget)
export function spr(P, x, y, rows, pal) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c != null) P.px(x + i, y + j, c); } }); }
// text med mörk kant runt om (och en ljus överkant på bokstäverna)
export function skylttext(P, F, s, x, y, c, kant, ljus) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) text(P, F, s, x + dx, y + dy, kant);
  text(P, F, s, x, y, c);
  if (ljus != null) { const rad = new Map(); text({ px: (px, py) => { if (!rad.has(px) || py < rad.get(px)) rad.set(px, py); } }, F, s, x, y, 0); for (const [px, py] of rad) P.px(px, py, ljus); }
}
// en palett ur en grundfärg (mörk → ljus)
export const palett = (c) => [mul(c, 0.45), mul(c, 0.7), c, mix(c, 0xffffff, 0.3), mix(c, 0xffffff, 0.6)];
// mörk kontur runt det som redan är målat (hård uppe/vänster, mjuk nere/höger)
export function kontur(P, dark = 0x1e1626, soft = 0x2a2030, softA = 0.6) {
  const { w, h, d } = P, A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200, add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = A(x, y - 1) || A(x - 1, y), sft = A(x, y + 1) || A(x + 1, y);
    if (hard || sft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, add[i + 2] ? dark : soft, add[i + 2] ? 1 : softA);
}
// en cachad bild med origo (ax, ay) – ritas med put(ctx, s, x, y)
const CACHE = new Map();
export function bild(key, w, h, ax, ay, fn, kont = true) {
  if (CACHE.has(key)) return CACHE.get(key);
  const P = new Pix(w, h, -ax, -ay); fn(P); if (kont) kontur(P);
  const s = { img: P.flush(), ax, ay, w, h }; CACHE.set(key, s); return s;
}
export const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
export const skugga = (ctx, x, y, w, a = 0.24) => { ctx.fillStyle = `rgba(20,12,30,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };

export const F = {
  VIT: [0x8a867c, 0xb6b2a8, 0xd8d4ca, 0xefece3, 0xfffdf7],
  MASS: [0x5a3c0c, 0x8a6418, 0xc0922c, 0xe6be4c, 0xfff0a0],
  JARN: [0x101216, 0x1c2026, 0x2c323a, 0x434b56, 0x646e7a],
  ZINK: [0x4a5058, 0x6a727c, 0x8e98a2, 0xb4bcc4, 0xd8dee4],
  STEN: [0x56524c, 0x76716a, 0x969088, 0xb4aea4, 0xd0cac0],
  SAND: [0x7a5a3a, 0xa07a50, 0xc49c6a, 0xdcbc88, 0xf0dcb0],
  TRA: [0x3a2214, 0x5e3a20, 0x86562e, 0xae7640, 0xd29a5c],
  TERR: [0x6a2a14, 0x9a4020, 0xc0602e, 0xdc8048, 0xf0a870],
  BLAD: [0x163414, 0x24521c, 0x387628, 0x52983a, 0x80c05a],
  ROD: [0x5e0e16, 0x9a1a24, 0xd4323a, 0xf06868, 0xffb4ac],
  BLA: [0x122656, 0x1c4086, 0x285ec0, 0x5890e8, 0xa8ccff],
  GUL: [0x845408, 0xc08c10, 0xeebc20, 0xffde5c, 0xfff6b4],
  GRON: [0x163e1c, 0x22602a, 0x34883c, 0x58b45a, 0x9ce08c],
  ROSA: [0x7a1840, 0xbc3666, 0xee5e98, 0xf898c0, 0xffd2e6],
  MINT: [0x1a5446, 0x2a7664, 0x469a86, 0x70c0a8, 0xa8e2cc],
  TURK: [0x0c464e, 0x166670, 0x228c96, 0x48bcc0, 0x98e6e2],
  LILA: [0x381a58, 0x58288a, 0x8246c0, 0xae78e0, 0xd8b8f8],
  KOPP: [0x1a4238, 0x2a6152, 0x3a8270, 0x58a68e, 0x8ccab2],
  GLD: [0x26364e, 0x3a5274, 0x5a7ca4, 0x8eb2d6, 0xcce2f4],
  GLN: [0x7a3e14, 0xb06a28, 0xe09a44, 0xffcc78, 0xfff0c4],
  ASFALT: [0x2e2e36, 0x44444e, 0x56565e, 0x6a6a72, 0x8a8a92],
};
