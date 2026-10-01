// Råvarornas små pixelbilder (12 × 12 spelpixlar): mataffären (korgen, rullbandet, skylten) och
// köket hemma (ingredienshyllan, handen, skärbrädan). Målade i spelets recept: 4–5 toner med
// ljuset uppifrån vänster, Bayer-dither och en mörk kontur. Cachade per id.
//   ravaraIcon(id)          canvas 12×12
//   ravaraPal(id)           färgskalan (5 toner, mörk → ljus) – för bitar i grytan/på brädan
import { Pix, hash, bayer, mix } from './floor-pix.js';

export const IW = 12;
const OUT = 0x2a1e24;
export const PAL = {
  applR: [0x4a080e, 0x8e1620, 0xd02c30, 0xff7a68, 0xffc8b8], applG: [0x2a5010, 0x4a8a1e, 0x80c040, 0xc4ec80, 0xf0ffd0],
  apels: [0x7a3406, 0xc8620e, 0xf49a2c, 0xffc870, 0xfff0c8], citron: [0x7a6208, 0xd0b014, 0xf6e44c, 0xfff8a0, 0xffffe8],
  lime: [0x1e4a10, 0x3a7a1a, 0x6ab030, 0xa8dc68, 0xe0ffc0], tomat: [0x560a0a, 0xa81616, 0xec3a2c, 0xff8a78, 0xffd0c8],
  paron: [0x5a5a10, 0x9a9a22, 0xd0cc48, 0xece888, 0xfffff0], kiwi: [0x2e1e0e, 0x4e3418, 0x7a5a30, 0x9e7e4e, 0xc0a070],
  avokado: [0x121e0c, 0x243a16, 0x3a5a22, 0x5a7e32, 0x8aa854], plommon: [0x220a2a, 0x4a1450, 0x7a2e82, 0xa860b0, 0xdab0e0],
  persika: [0x8a3a1a, 0xd0602a, 0xf0a060, 0xffd0a0, 0xfff0e0], granat: [0x4a0812, 0x86101e, 0xc02838, 0xe8606a, 0xffb0b0],
  potatis: [0x4a3418, 0x7a5a30, 0xb08850, 0xd4b078, 0xf0dcb0], lok: [0x5a300c, 0x9a5a1a, 0xd09040, 0xecc070, 0xfff0c8],
  rodlok: [0x2e0a26, 0x5a1848, 0x8a3070, 0xb86098, 0xe0a8cc], melon: [0x5a5a10, 0x9aa020, 0xd8d850, 0xf0f090, 0xffffe0],
  vmelon: [0x0e2a10, 0x1e4a1a, 0x2e6e26, 0x5a9a3a, 0x9ac870], champ: [0x6a5a48, 0x9a8a74, 0xd0c4b0, 0xece4d4, 0xffffff],
  aubergine: [0x14081e, 0x2a1238, 0x4a2260, 0x6a3a88, 0xa070c0], morot: [0x7a2a06, 0xc0500e, 0xf07a1e, 0xffaa50, 0xffe0b0],
  banan: [0x5a4206, 0xb88a10, 0xf0cc30, 0xfff08a, 0xfffce0], druva: [0x240834, 0x521862, 0x86389a, 0xb870c8, 0xe6c4f0],
  ananas: [0x5a3a08, 0x9a6a14, 0xd8a030, 0xf0c860, 0xfff0b0], paprika: [0x5a0a0a, 0xa01818, 0xe03a2a, 0xff7a5a, 0xffb8a0],
  agg: [0x9a7a5a, 0xc8a888, 0xe8d0b4, 0xf6e6d4, 0xfffaf2], mjolk: [0xa8b0bc, 0xd0d6e0, 0xeef2f8, 0xf8fbff, 0xffffff],
  ost: [0xa88a20, 0xe0c040, 0xf8e070, 0xfff0a0, 0xfffbe0], smor: [0xb8a040, 0xe0cc68, 0xf4e490, 0xfaf0b8, 0xfffbe0],
  yoghurt: [0xb0b4c0, 0xd8dce4, 0xf0f2f6, 0xfafbfd, 0xffffff], brod: [0x5a3410, 0x8a5420, 0xb87a38, 0xd8a060, 0xf0c890],
  tortilla: [0x9a7434, 0xd0a860, 0xecd094, 0xf8e6bc, 0xfff8e8], pasta: [0x8a6a20, 0xc8a040, 0xe8c868, 0xf8e098, 0xfff4c8],
  ris: [0xb0aea4, 0xd8d6cc, 0xeeece4, 0xf8f6f0, 0xffffff], mjol: [0xb8b0a0, 0xdcd4c4, 0xf0eadc, 0xfaf6ee, 0xffffff],
  havre: [0x9a7a4a, 0xc8a46a, 0xe0c494, 0xf0dcb4, 0xfff4dc], krossade: [0x5a0e0a, 0x9a1e14, 0xd03a26, 0xf06a4a, 0xff9a80],
  bonor: [0x3a120a, 0x6a2414, 0x94401e, 0xb8623a, 0xd88a5e], fisk: [0xa87a6a, 0xd8a898, 0xf0c8b8, 0xfae2d8, 0xfff6f2],
  bar: [0x1e1438, 0x3a2a6a, 0x5a4a9a, 0x8a7ac8, 0xc0b8f0], kyckling: [0xb87a6a, 0xe0a898, 0xf4c8b8, 0xfae0d4, 0xfff4ee],
  kottfars: [0x5a0e12, 0x8e1e22, 0xc23a3a, 0xe06a62, 0xf8a8a0], bacon: [0x6a1a1a, 0xa83030, 0xd85a50, 0xf09088, 0xffe0d8],
};
export const ravaraPal = (id) => PAL[id] || PAL.potatis;
const tone = (pal, v, x, y) => { const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t); return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))]; };
// en skuggad ellips (rund frukt) – ljuset uppifrån vänster, en glans
function ball(P, cx, cy, rx, ry, pal, seed = 0, shine = true) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    P.px(x, y, tone(pal, 0.62 - nx * 0.22 - ny * 0.3 - d * 0.2 + (hash(x, y, seed) - 0.5) * 0.08, x, y));
  }
  if (shine) P.px(Math.round(cx - rx * 0.45 - 0.5), Math.round(cy - ry * 0.45 - 0.5), pal[4]);
}
const box = (P, x, y, w, h, pal) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, tone(pal, 0.7 - i / w * 0.35 - j / h * 0.2, x + i, y + j)); };
const stalk = (P, x, y) => { P.px(x, y, 0x5a3a1a); P.px(x, y - 1, 0x5a3a1a); P.px(x + 1, y - 2, 0x4a9a2a); P.px(x + 2, y - 2, 0x6ab83a); };
const ART = {
  _: (P, id) => ball(P, 6, 6.5, 4.5, 4.5, ravaraPal(id)),
  applR: (P) => { ball(P, 6, 7, 4.6, 4.2, PAL.applR); stalk(P, 6, 3); },
  applG: (P) => { ball(P, 6, 7, 4.6, 4.2, PAL.applG); stalk(P, 6, 3); },
  apels: (P) => { ball(P, 6, 6.5, 4.6, 4.6, PAL.apels); for (let k = 0; k < 6; k++) P.px(3 + (k * 7) % 7, 4 + ((k * 3) % 6), PAL.apels[1], 0.4); P.px(6, 2, 0x4a8a2a); },
  citron: (P) => { ball(P, 6, 6.5, 5.2, 3.6, PAL.citron); P.px(1, 6, PAL.citron[1]); P.px(11, 7, PAL.citron[1]); },
  lime: (P) => { ball(P, 6, 6.5, 4.8, 3.8, PAL.lime); },
  tomat: (P) => { ball(P, 6, 7, 4.8, 4, PAL.tomat); for (const [x, y] of [[5, 3], [6, 3], [7, 3], [4, 4], [8, 4], [6, 2]]) P.px(x, y, 0x3a8a2a); },
  paron: (P) => { ball(P, 6, 8, 4.2, 3.4, PAL.paron); ball(P, 6, 4.6, 2.6, 2.4, PAL.paron, 3, false); stalk(P, 6, 2); },
  kiwi: (P) => { ball(P, 6, 6.5, 5, 4, PAL.kiwi, 1, false); for (let k = 0; k < 10; k++) P.px(2 + Math.floor(hash(k, 1, 9) * 8), 3 + Math.floor(hash(k, 2, 9) * 7), PAL.kiwi[3]); },
  avokado: (P) => { ball(P, 6, 8, 4.4, 3.4, PAL.avokado); ball(P, 6, 4.4, 2.8, 2.4, PAL.avokado, 2, false); },
  plommon: (P) => { ball(P, 6, 7, 4.4, 4.2, PAL.plommon); P.px(6, 3, 0x5a3a1a); for (let y = 4; y < 10; y++) P.px(7, y, PAL.plommon[1], 0.4); },
  persika: (P) => { ball(P, 6, 7, 4.8, 4.4, PAL.persika); for (let y = 3; y < 11; y++) P.px(6, y, PAL.persika[1], 0.5); P.px(7, 2, 0x4a8a2a); P.px(8, 2, 0x6ab83a); },
  granat: (P) => { ball(P, 6, 7, 4.8, 4.4, PAL.granat); P.rect(5, 2, 3, 1, PAL.granat[1]); P.px(4, 1, PAL.granat[1]); P.px(6, 1, PAL.granat[1]); P.px(8, 1, PAL.granat[1]); },
  potatis: (P) => { ball(P, 6, 6.5, 5.2, 3.8, PAL.potatis, 4); P.px(4, 6, PAL.potatis[0]); P.px(8, 5, PAL.potatis[0]); P.px(7, 8, PAL.potatis[1]); },
  lok: (P) => { ball(P, 6, 7, 4.6, 4.2, PAL.lok); P.px(6, 2, PAL.lok[1]); P.px(6, 1, PAL.lok[2]); for (let y = 4; y < 11; y++) P.px(4 + (y > 7 ? 0 : 1), y, PAL.lok[1], 0.5); },
  rodlok: (P) => { ball(P, 6, 7, 4.6, 4.2, PAL.rodlok); P.px(6, 2, PAL.rodlok[1]); P.px(6, 1, PAL.rodlok[2]); for (let y = 4; y < 11; y++) P.px(4 + (y > 7 ? 0 : 1), y, PAL.rodlok[1], 0.5); },
  melon: (P) => { ball(P, 6, 6.5, 5.4, 4.6, PAL.melon); for (let k = 0; k < 8; k++) P.px(2 + k, 4 + ((k * 5) % 5), PAL.melon[1], 0.5); },
  vmelon: (P) => { ball(P, 6, 6.5, 5.6, 4.4, PAL.vmelon); for (let x = 2; x < 11; x += 3) for (let y = 3; y < 11; y++) P.px(x + (y & 1), y, PAL.vmelon[0], 0.6); },
  champ: (P) => { ball(P, 6, 5, 5, 3, PAL.champ); P.rect(5, 7, 3, 3, PAL.champ[3]); P.px(7, 8, PAL.champ[2]); P.hl(3, 7, 7, PAL.champ[1]); },
  aubergine: (P) => { for (let k = 0; k < 9; k++) ball(P, 3.4 + k * 0.7, 8 - k * 0.5, 2.6 - k * 0.08, 2.6 - k * 0.08, PAL.aubergine, k, false); P.rect(8, 2, 3, 2, 0x4a8a2a); P.px(10, 1, 0x3a7a1a); P.px(4, 7, PAL.aubergine[4]); },
  morot: (P) => { for (let k = 0; k < 8; k++) { const w = Math.max(1, 3 - Math.floor(k / 3)); P.hl(4 + k * 0.5 - w / 2 + 1, 4 + k, w + 1, k < 3 ? PAL.morot[3] : PAL.morot[2]); P.px(4 + k * 0.5 + w / 2 + 1, 4 + k, PAL.morot[1]); } for (const [x, y] of [[4, 3], [5, 2], [6, 3], [5, 1], [7, 2]]) P.px(x, y, 0x4a9a2a); },
  banan: (P) => { for (let k = 0; k < 10; k++) { const y = 3 + Math.round(Math.sin(k / 9 * Math.PI) * -1.5 + k * 0.5); P.px(1 + k, y + 3, PAL.banan[1]); P.px(1 + k, y + 2, PAL.banan[2]); P.px(1 + k, y + 1, k > 1 && k < 8 ? PAL.banan[3] : PAL.banan[2]); } P.px(1, 4, 0x3a2a08); P.px(10, 9, 0x5a4206); },
  druva: (P) => { for (const [x, y] of [[4, 4], [7, 4], [3, 6.5], [6, 6.5], [9, 6.5], [4.5, 9], [7.5, 9], [6, 11]]) ball(P, x + 0.5, y, 1.7, 1.7, PAL.druva, x * 7 + y); P.px(6, 1, 0x5a3a1a); P.px(6, 2, 0x5a3a1a); P.px(7, 1, 0x4a9a2a); },
  ananas: (P) => { ball(P, 6, 8, 3.8, 3.6, PAL.ananas); for (let y = 5; y < 12; y++) for (let x = 3; x < 10; x++) if ((x + y) % 3 === 0) P.px(x, y, PAL.ananas[1], 0.6); for (const [x, y] of [[6, 1], [5, 2], [7, 2], [4, 3], [6, 3], [8, 3]]) P.px(x, y, 0x3a8a2a); },
  paprika: (P) => { ball(P, 4.5, 7, 3, 4, PAL.paprika, 1); ball(P, 7.5, 7, 3, 4, PAL.paprika, 2); P.rect(5, 2, 2, 2, 0x3a7a1a); P.px(6, 1, 0x4a9a2a); },
  agg: (P) => { ball(P, 4, 7, 2.8, 3.6, PAL.agg, 1); ball(P, 8, 6.5, 2.8, 3.6, PAL.agg, 2); },
  mjolk: (P) => { box(P, 3, 3, 6, 8, PAL.mjolk); P.rect(3, 6, 6, 2, 0x3a6ab8); P.hl(4, 2, 4, PAL.mjolk[2]); P.px(5, 1, PAL.mjolk[1]); P.px(6, 1, PAL.mjolk[1]); },
  ost: (P) => { for (let y = 4; y < 10; y++) for (let x = 1; x < 11; x++) { if (x < 1 + (9 - y) * 0.6 && y < 8) continue; P.px(x, y, tone(PAL.ost, y < 6 ? 0.8 : 0.55 - x / 30, x, y)); } P.px(4, 7, PAL.ost[1]); P.px(7, 8, PAL.ost[1]); P.px(8, 6, PAL.ost[1]); },
  smor: (P) => { box(P, 2, 4, 8, 5, PAL.smor); P.rect(2, 6, 8, 3, 0xe8e4d8); P.hl(3, 7, 4, 0x3a6ab8); },
  yoghurt: (P) => { box(P, 3, 4, 6, 7, PAL.yoghurt); P.rect(3, 6, 6, 3, 0xe85a8a); P.hl(2, 3, 8, 0xd8dce4); },
  brod: (P) => { ball(P, 6, 7, 5.4, 3.6, PAL.brod, 3); for (const x of [3, 6, 9]) { P.px(x, 5, PAL.brod[4]); P.px(x + 1, 6, PAL.brod[1]); } },
  tortilla: (P) => { ball(P, 6, 7, 5.4, 3.4, PAL.tortilla, 4, false); for (let k = 0; k < 6; k++) P.px(2 + Math.floor(hash(k, 3, 5) * 8), 5 + Math.floor(hash(k, 4, 5) * 4), PAL.tortilla[0]); },
  pasta: (P) => { box(P, 2, 3, 8, 8, [0x1a3a8a, 0x2a5ab8, 0x3a7ae0, 0x6aa0f0, 0xa8c8ff]); for (let x = 3; x < 9; x++) P.vl(x, 4, 3, x & 1 ? PAL.pasta[2] : PAL.pasta[3]); P.hl(3, 8, 6, 0xffffff); },
  ris: (P) => { box(P, 2, 3, 8, 8, [0x8a2a1a, 0xb8442a, 0xe0603a, 0xf08a5a, 0xffc0a0]); P.rect(3, 5, 6, 3, 0xfaf6ee); for (let x = 3; x < 9; x += 2) P.px(x, 6, 0xd8d0c0); },
  mjol: (P) => { box(P, 2, 2, 8, 9, PAL.mjol); P.px(5, 5, 0xc8a040); P.px(6, 4, 0xc8a040); P.px(6, 6, 0xc8a040); P.px(7, 5, 0xc8a040); P.vl(6, 7, 2, 0x6a8a3a); },
  havre: (P) => { box(P, 2, 2, 8, 9, [0x5a3a1a, 0x8a5a2a, 0xb87a3a, 0xd8a060, 0xf0c890]); P.rect(3, 5, 6, 4, PAL.havre[3]); for (let k = 0; k < 6; k++) P.px(3 + (k * 3) % 6, 5 + (k % 4), PAL.havre[1]); },
  krossade: (P) => { box(P, 3, 2, 6, 9, [0x6a6e78, 0x9aa0aa, 0xc8ccd4, 0xe2e6ec, 0xffffff]); P.rect(3, 4, 6, 5, PAL.krossade[2]); P.px(5, 6, PAL.krossade[4]); P.px(6, 6, 0x3a8a2a); },
  bonor: (P) => { box(P, 3, 2, 6, 9, [0x6a6e78, 0x9aa0aa, 0xc8ccd4, 0xe2e6ec, 0xffffff]); P.rect(3, 4, 6, 5, 0x6a4a2a); for (const [x, y] of [[4, 5], [6, 6], [5, 7], [7, 5]]) P.px(x, y, PAL.bonor[3]); },
  fisk: (P) => { ball(P, 6, 6.5, 5, 2.8, PAL.fisk, 1); for (let x = 3; x < 10; x += 2) P.px(x, 6, PAL.fisk[1], 0.6); P.px(11, 5, PAL.fisk[2]); P.px(11, 8, PAL.fisk[2]); },
  bar: (P) => { box(P, 2, 3, 8, 8, [0x3a7aa8, 0x5a9ad0, 0x8ac0e8, 0xbadcf4, 0xe8f6ff]); for (const [x, y] of [[4, 6], [6, 5], [7, 7], [5, 8]]) ball(P, x + 0.5, y + 0.5, 1.3, 1.3, PAL.bar, x + y, false); },
  kyckling: (P) => { box(P, 1, 6, 10, 5, [0x8a8a94, 0xb8bcc6, 0xdce0e8, 0xeef0f4, 0xffffff]); ball(P, 4, 6, 3, 2.2, PAL.kyckling, 3); ball(P, 8.2, 6.4, 3, 2.2, PAL.kyckling, 4); P.hl(1, 10, 10, 0x8a8a94); },
  kottfars: (P) => { box(P, 1, 5, 10, 5, [0x8a8a94, 0xb8bcc6, 0xdce0e8, 0xeef0f4, 0xffffff]); for (let y = 4; y < 8; y++) for (let x = 2; x < 10; x++) P.px(x, y, tone(PAL.kottfars, 0.4 + hash(x, y, 7) * 0.5, x, y)); },
  bacon: (P) => { for (let s = 0; s < 3; s++) for (let x = 1; x < 11; x++) { const y = 1 + s * 4 + (Math.floor((x + s * 2) / 3) & 1); P.px(x, y, PAL.bacon[3]); P.px(x, y + 1, PAL.bacon[4]); P.px(x, y + 2, PAL.bacon[1]); } },
};
function outline(P) {
  const { w, h, d } = P, a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128)) out.push([x, y]);
  for (const [x, y] of out) P.px(x, y, OUT, 0.85);
}
const CACHE = new Map();
export function ravaraIcon(id) {
  let cv = CACHE.get(id);
  if (cv) return cv;
  const P = new Pix(IW, IW);
  (ART[id] || ART._)(P, id);
  outline(P);
  cv = P.flush();
  CACHE.set(id, cv);
  return cv;
}
// en hackad hög av råvaran (bitar i dess färger) – skärbrädan och grytorna
export function choppedBits(id) {
  const k = 'hack:' + id;
  let cv = CACHE.get(k);
  if (cv) return cv;
  const P = new Pix(IW, 8), pal = ravaraPal(id);
  for (let i = 0; i < 9; i++) { const x = 1 + Math.floor(hash(i, 1, 33) * 9), y = 2 + Math.floor(hash(i, 2, 33) * 4); P.rect(x, y, 2, 2, pal[2]); P.px(x, y, pal[3]); P.px(x + 1, y + 1, pal[1]); }
  outline(P);
  cv = P.flush();
  CACHE.set(k, cv);
  return cv;
}
