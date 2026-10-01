// KÖKET HEMMA (Carl 2026-10-01: "laga mat hemma … man får lära sig recept i en bok. man har en
// recept bok som ligger vid spisen när man börjar spelet" + "gör bilder på maten i recept boken").
//   openKok(A, 'laga')  spisen: rätterna man kan, portionerna (vanlig/storkok ×5/megakok ×10), vad
//                       som finns hemma och kocknivån – Laga → köket (koket.js), steg för steg
//   openKok(A, 'bok')   receptboken: alla recept med en pixelbild av rätten, läs och lär dig
//   dishCanvas(id)      bilden av rätten (DW × DH spelpixlar, cachad) – visas i 3× i boken
// Råvarorna, recepten och matlagningen räknas i game.js (RAVAROR, RECEPT, cook, learnRecipe);
// råvarorna köps i mataffären (shop-mat.js). Spisen och boken är startmöbler (room.js KOK).
//
// Bilderna: målade pixel för pixel i spelets recept (floor-pix Pix) – rätten på en tallrik/i en
// skål sedd snett uppifrån, ljuset uppifrån vänster, 4–5 toner med Bayer-dither, en mörk kontur
// runt allt och en mjuk slagskugga på den rutiga duken.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { RECEPT, ravaraOf, receptOf, kockStjarnor, KOCK_STEG, RECEPT_LAS_MIN, PORTIONER, portionOf, KOCK_TITLAR, KOCK_NIVA_P } from '../game.js';
import { play } from '../core/sound.js';

export const DW = 48, DH = 32;
const OUT = 0x2a1e24;

// ================= målarverktyg =================
const tone = (pal, v, x, y) => {
  const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t);
  return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))];
};
// en skuggad klump (ellips) – ljuset uppifrån vänster
function blob(P, cx, cy, rx, ry, pal, seed = 0, rough = 0.12, top = 0.62) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    P.px(x, y, tone(pal, top - nx * 0.22 - ny * 0.3 - d * 0.18 + (hash(x, y, seed) - 0.5) * rough, x, y));
  }
}
// små bitar utströdda inom en ellips: [pal, antal, storlek]
function pieces(P, cx, cy, rx, ry, kinds, seed) {
  let k = 0;
  for (const [pal, n, s] of kinds) for (let i = 0; i < n; i++, k++) {
    const a = hash(k, 1, seed) * Math.PI * 2, r = Math.sqrt(hash(k, 2, seed)) * 0.85;
    const x = Math.round(cx + Math.cos(a) * rx * r), y = Math.round(cy + Math.sin(a) * ry * r);
    if (s <= 1) { P.px(x, y, pal[2]); continue; }
    blob(P, x, y, s * 0.6, s * 0.5, pal, seed + k, 0.05);
  }
}
// tallriken: vit med kant och lite blå rand, (cx, cy) mitten, rx × ry
function plate(P, cx, cy, rx, ry, rim = 0x6a8ac8) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    let c = d > 0.72 ? (ny > 0.2 ? 0xd8dae4 : 0xf8f8fc) : d > 0.6 ? rim : tone([0xc8ccd8, 0xdcdee8, 0xeef0f6, 0xfafbff], 0.7 - nx * 0.15 - ny * 0.2, x, y);
    if (d > 0.93) c = ny > 0 ? 0xa8acbc : 0xe4e6ee;
    P.px(x, y, c);
  }
}
// skålen: öppningen (rx × ry) vid cy, kroppen ner till cy + depth; inuti fylls med fill-paletten
function bowl(P, cx, cy, rx, ry, depth, body = [0x3a5a9a, 0x5a7ac0, 0x7a9ad8, 0xa8c0ec, 0xd8e4ff], fill = null, seed = 0) {
  for (let y = Math.floor(cy); y <= Math.ceil(cy + depth + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, k = (y - cy) / (depth + ry);
    const half = Math.sqrt(Math.max(0, 1 - nx * nx));
    if (y > cy + half * (depth + ry * 0.3)) continue;
    P.px(x, y, tone(body, 0.65 - nx * 0.3 - k * 0.25, x, y));
  }
  // öppningen: kant + insida/fyllning
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    if (d > 0.74) { P.px(x, y, ny < 0 ? body[4] : body[3]); continue; }
    P.px(x, y, fill ? tone(fill, 0.62 - nx * 0.2 - ny * 0.25 + (hash(x, y, seed) - 0.5) * 0.12, x, y) : body[1]);
  }
}
// mörk kontur runt allt som är målat (genomskinliga grannar till målade pixlar)
function outline(P, col = OUT) {
  const { w, h, d } = P, a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128)) out.push([x, y]);
  for (const [x, y] of out) P.px(x, y, col, 0.8);
}

// ================= paletterna =================
const C = {
  pasta: [0x8a6a20, 0xc8a040, 0xe8c868, 0xf8e098, 0xfff4c8],
  tomat: [0x5a0e0a, 0x9a1e14, 0xd03a26, 0xf06a4a, 0xff9a80],
  farssas: [0x3e140a, 0x6e2814, 0x9a4024, 0xbe5e36, 0xe08a5a],
  ost: [0xa88a20, 0xe0c040, 0xf8e070, 0xfff0a0, 0xfffbe0],
  agg: [0x8a6a10, 0xd8a820, 0xf4cc40, 0xffe27a, 0xfff6c0],
  potatis: [0x7a5a2a, 0xb08850, 0xd8b878, 0xf0d8a0, 0xfff4d8],
  kottbulle: [0x34160a, 0x5a2a14, 0x86421f, 0xac6232, 0xd08e58],
  kyckling: [0x6a3a14, 0xa86a30, 0xd8a058, 0xf0c888, 0xfff0c8],
  ris: [0xb0aea4, 0xd8d6cc, 0xeeece4, 0xf8f6f0, 0xffffff],
  fisk: [0x9a8a78, 0xcab8a4, 0xece0d0, 0xfaf2e6, 0xffffff],
  skorpa: [0x7a4a14, 0xb8782a, 0xe0a848, 0xf4cc78, 0xfff0b8],
  tortilla: [0x9a7434, 0xd0a860, 0xecd094, 0xf8e6bc, 0xfff8e8],
  avokado: [0x2e4a14, 0x4e7a22, 0x7cac3e, 0xaad474, 0xd8f0aa],
  gron: [0x1e4a14, 0x3a7a22, 0x6aae36, 0xa8dc68, 0xe0f8b0],
  paprikaR: [0x5a0a0a, 0xa01818, 0xe03a2a, 0xff7a5a, 0xffb8a0],
  paprikaG: [0x1e4a10, 0x2e7a1a, 0x4ea82a, 0x8ad058, 0xc8f098],
  morot: [0x7a2a06, 0xc0500e, 0xf07a1e, 0xffaa50, 0xffe0b0],
  citron: [0x8a7008, 0xd0b014, 0xf6e44c, 0xfff8a0, 0xffffe8],
  champ: [0x5a4a38, 0x8a7a64, 0xbeb09a, 0xe0d6c4, 0xfaf4ea],
  bonor: [0x3a120a, 0x6a2414, 0x94401e, 0xb8623a, 0xd88a5e],
  bacon: [0x6a1a1a, 0xa83030, 0xd85a50, 0xf09088, 0xffd0c8],
  bar: [0x1e1438, 0x3a2a6a, 0x5a4a9a, 0x8a7ac8, 0xc0b8f0],
  hallon: [0x5a0a1e, 0x9a1430, 0xd0284a, 0xf0607a, 0xffa8b8],
  aubergine: [0x14081e, 0x2a1238, 0x4a2260, 0x6a3a88, 0xa070c0],
  appel: [0x4a080e, 0x8e1620, 0xd02c30, 0xff7a68, 0xffc8b8],
  applG: [0x2a5010, 0x4a8a1e, 0x80c040, 0xc4ec80, 0xf0ffd0],
  banan: [0x7a5a10, 0xc8a030, 0xf0d860, 0xfff0a0, 0xfffce0],
  apels: [0x7a3406, 0xc8620e, 0xf49a2c, 0xffc870, 0xfff0c8],
  ananas: [0x7a5a08, 0xb88a14, 0xe8c030, 0xf8dc70, 0xfff4c0],
  melon: [0x6a7a10, 0xa0b028, 0xd0dc58, 0xe8f090, 0xfaffd8],
  kiwi: [0x2e4a0a, 0x4e7a14, 0x7ab02a, 0xa8d45a, 0xd8f0a0],
  granat: [0x4a0812, 0x86101e, 0xc02838, 0xe8606a, 0xffb0b0],
  soppa: [0x8a5a1a, 0xc08a38, 0xe0b058, 0xf4cc80, 0xfff0c0],
  grot: [0x9a8a6a, 0xc4b494, 0xe2d6bc, 0xf2ead6, 0xfffaf0],
  smoothie: [0x5a1a4a, 0x8a2e6e, 0xc04a98, 0xe07ab8, 0xf4b0d8],
  brod: [0x5a3410, 0x8a5420, 0xb87a38, 0xd8a060, 0xf0c890],
  smula: [0x7a4a14, 0xb07830, 0xd8a458, 0xf0c888, 0xfff0d0],
  chili: [0x3a0a06, 0x6a160c, 0x9a2814, 0xc0442a, 0xe07050],
  kram: [0xb09a68, 0xd8c498, 0xece0c0, 0xf8f0dc, 0xfffcf2],
  pannkaka: [0xb88a3a, 0xe0b868, 0xf4d898, 0xfcecc4, 0xfffbec],
};

// ================= rätterna =================
// var och en ritar på ett genomskinligt lager (DW × DH) – konturen och duken läggs på efteråt
const spagetti = (P, cx, cy, rx, ry, seed) => { // ett bo av spagetti: slingor i två toner
  blob(P, cx, cy, rx, ry, C.pasta, seed, 0.1);
  for (let k = 0; k < 26; k++) {
    const a = hash(k, 1, seed) * Math.PI * 2, r = 0.25 + hash(k, 2, seed) * 0.7;
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    for (let s = 0; s < 4; s++) P.px(Math.round(x + s * Math.cos(a + 1.6)), Math.round(y + s * 0.5 * Math.sin(a + 1.6)), s & 1 ? C.pasta[1] : C.pasta[3]);
  }
};
const strossel = (P, cx, cy, rx, ry, col, n, seed) => { for (let k = 0; k < n; k++) { const a = hash(k, 5, seed) * Math.PI * 2, r = Math.sqrt(hash(k, 6, seed)); P.px(Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r), col); } };
const DISHES = {
  fruktsallad: (P) => { bowl(P, 24, 15, 15, 6, 8, undefined, C.apels, 11); pieces(P, 24, 14, 12, 4.4, [[C.appel, 5, 3], [C.banan, 5, 3], [C.apels, 4, 3], [C.kiwi, 3, 3]], 12); },
  omelett: (P) => { plate(P, 24, 19, 19, 9); blob(P, 24, 18, 13, 6, C.agg, 21, 0.1); for (let x = 13; x < 36; x++) P.px(x, 18 + Math.round(Math.sin(x * 0.7)), C.agg[4]); pieces(P, 24, 17, 10, 4, [[C.tomat, 4, 2], [C.ost, 6, 1]], 22); P.px(30, 16, C.gron[3]); P.px(31, 16, C.gron[2]); },
  ostmacka: (P) => { plate(P, 24, 20, 19, 9); for (const [dx, dy] of [[-7, 0], [6, 1]]) { blob(P, 24 + dx, 17 + dy, 8, 6, C.brod, 31 + dx, 0.08, 0.5); blob(P, 24 + dx, 16 + dy, 6.6, 4.6, C.ost, 33 + dx, 0.05); pieces(P, 24 + dx, 16 + dy, 5, 3, [[C.paprikaR, 2, 2], [C.paprikaG, 2, 2]], 34 + dx); } },
  pannkakor: (P) => { // en trave tunna pannkakor – en mörk stekkant mellan varje
    plate(P, 24, 21, 19, 9);
    for (let i = 0; i < 5; i++) { const cy = 20 - i * 2, rx = 14 - i * 0.5; blob(P, 24, cy, rx, 5, C.pannkaka, 41 + i, 0.1, 0.62); for (let x = Math.ceil(24 - rx + 1); x < 24 + rx - 1; x++) { const nx = (x + 0.5 - 24) / rx, y = Math.round(cy + 5 * Math.sqrt(Math.max(0, 1 - nx * nx))) - 1; P.px(x, y, C.pannkaka[0]); } }
    for (let k = 0; k < 7; k++) { const a = hash(k, 1, 44) * 6.28; P.px(Math.round(24 + Math.cos(a) * 6), Math.round(11 + Math.sin(a) * 2), C.skorpa[1], 0.5); }
    pieces(P, 24, 11, 8, 2.6, [[C.hallon, 5, 2], [C.bar, 6, 2]], 43); P.px(27, 9, 0xffffff); P.px(28, 9, 0xfff0f8);
  },
  grot: (P) => { bowl(P, 24, 15, 15, 6, 8, [0x8a5a3a, 0xb07a52, 0xd09a6a, 0xe8c094, 0xfae0c0], C.grot, 51); pieces(P, 24, 14, 10, 3.8, [[C.appel, 4, 2], [C.applG, 3, 2]], 52); strossel(P, 24, 14, 9, 3, 0xa86a3a, 6, 53); },
  smoothie: (P) => { // ett högt glas med sugrör och en bärgarnityr
    for (let y = 6; y < 28; y++) for (let x = 17; x < 31; x++) { const nx = (x - 23.5) / 7; const glass = x === 17 || x === 30; if (y < 8) { P.px(x, y, 0xd8eaf4, 0.7); continue; } P.px(x, y, glass ? 0xbcd8e8 : tone(C.smoothie, 0.66 - nx * 0.3 - (y - 8) / 50, x, y)); }
    for (let x = 17; x < 31; x++) P.px(x, 8, C.smoothie[4]);
    for (let k = 0; k < 9; k++) P.px(27 - Math.round(k * 0.3), 1 + k, k & 1 ? 0xe85a8a : 0xffffff); // sugröret
    blob(P, 19, 7, 2.2, 2, C.hallon, 61, 0.05); P.vl(20, 9, 18, 0xffffff, 0.35);
  },
  pastapomodoro: (P) => { plate(P, 24, 20, 19, 9); spagetti(P, 24, 18, 13, 6, 71); blob(P, 24, 15.5, 7, 3.4, C.tomat, 72, 0.1); strossel(P, 24, 15, 6, 2.6, C.ost[4], 8, 73); P.px(26, 13, C.gron[3]); P.px(27, 13, C.gron[2]); P.px(26, 12, C.gron[3]); },
  kottfarssas: (P) => { plate(P, 24, 20, 19, 9); spagetti(P, 24, 18, 13, 6, 81); blob(P, 24, 15.5, 8, 3.8, C.farssas, 82, 0.2); pieces(P, 24, 15, 6, 2.6, [[C.kottbulle, 7, 1]], 83); strossel(P, 24, 15, 6, 2.4, C.ost[4], 7, 84); },
  carbonara: (P) => { plate(P, 24, 20, 19, 9); spagetti(P, 24, 18, 13, 6, 91); blob(P, 24, 16.5, 10, 4.4, C.kram, 92, 0.08, 0.66); pieces(P, 24, 16, 9, 3.6, [[C.bacon, 8, 2]], 93); blob(P, 24, 15, 2.2, 1.6, C.agg, 94, 0.02, 0.7); strossel(P, 24, 16, 8, 3, 0x2a2a2a, 6, 95); },
  potatissoppa: (P) => { bowl(P, 24, 15, 15, 6, 8, [0xa86a2a, 0xd08c3a, 0xeeb058, 0xf8d088, 0xfff0c8], C.soppa, 101); pieces(P, 24, 14, 10, 3.6, [[C.morot, 3, 2], [C.potatis, 3, 2]], 102); strossel(P, 24, 14, 8, 3, C.gron[2], 5, 103); P.hl(19, 12, 4, 0xfff8e0); },
  tacos: (P) => { plate(P, 24, 21, 19, 8); for (const dx of [-8, 8]) { // två tacoskal: halvmånar med fyllning
    const cx = 24 + dx;
    for (let y = 9; y < 23; y++) for (let x = cx - 8; x <= cx + 8; x++) { const nx = (x - cx) / 8, ny = (y - 23) / 14; if (nx * nx + ny * ny > 1) continue; P.px(x, y, tone(C.tortilla, 0.66 - nx * 0.2 + (hash(x, y, 111) - 0.5) * 0.2, x, y)); }
    pieces(P, cx, 12, 6, 2.6, [[C.farssas, 5, 2], [C.gron, 3, 2], [C.tomat, 3, 2], [C.ost, 4, 1]], 112 + dx);
  } },
  kottbullar: (P) => { plate(P, 24, 20, 19, 9); for (let i = 0; i < 6; i++) blob(P, 14 + (i % 3) * 5, 16 + (i >> 1 & 1) * 3 + (i > 2 ? 2 : 0), 2.6, 2.3, C.kottbulle, 121 + i, 0.08); for (let i = 0; i < 3; i++) blob(P, 30 + i * 3, 18 + (i & 1) * 2, 3.2, 2.6, C.potatis, 124 + i, 0.06, 0.66); blob(P, 23, 23, 3, 1.4, C.hallon, 127, 0.05); P.px(31, 15, C.gron[3]); P.px(32, 15, C.gron[2]); },
  chili: (P) => { bowl(P, 24, 15, 15, 6, 8, [0x5a3a2a, 0x8a5a40, 0xb07a5a, 0xd09a78, 0xecc4a8], C.chili, 131); pieces(P, 24, 14, 11, 4, [[C.bonor, 9, 2], [C.farssas, 6, 1]], 132); blob(P, 27, 12.5, 3.2, 1.6, C.kram, 133, 0.02, 0.85); P.px(26, 11, C.gron[3]); P.px(27, 11, C.gron[2]); },
  bonchili: (P) => { bowl(P, 24, 15, 15, 6, 8, [0x2a4a3a, 0x3a6a52, 0x5a8a6a, 0x7aac8a, 0xa8d4b4], C.chili, 141); pieces(P, 24, 14, 11, 4, [[C.bonor, 12, 2], [C.paprikaG, 3, 2], [C.paprikaR, 2, 2]], 142); },
  kycklingris: (P) => { plate(P, 24, 20, 19, 9); blob(P, 17, 19, 8, 4.6, C.ris, 151, 0.18, 0.7); strossel(P, 17, 19, 6, 3, C.ris[1], 10, 152); for (let i = 0; i < 4; i++) blob(P, 27 + (i % 2) * 5, 16 + (i >> 1) * 4, 3.4, 2.2, C.kyckling, 153 + i, 0.1); pieces(P, 30, 18, 6, 3, [[C.paprikaR, 3, 2], [C.paprikaG, 2, 2]], 157); },
  ugnskyckling: (P) => { plate(P, 24, 20, 19, 9); blob(P, 19, 16, 8, 5, C.kyckling, 161, 0.15, 0.55); P.hl(15, 14, 5, C.kyckling[4]); blob(P, 24, 15, 2, 1.4, C.skorpa, 162, 0.1); for (let i = 0; i < 4; i++) { const x = 29 + (i % 2) * 5, y = 17 + (i >> 1) * 4; blob(P, x, y, 3.4, 2, C.skorpa, 163 + i, 0.1, 0.6); } blob(P, 12, 21, 2.6, 2, C.citron, 167, 0.05, 0.7); P.px(12, 21, C.citron[4]); P.px(16, 12, C.gron[2]); P.px(17, 12, C.gron[3]); },
  kycklingwrap: (P) => { // två wraphalvor: rullen bakåt snett, snittytan med fyllningen mot oss
    plate(P, 24, 21, 19, 8);
    for (const [cx, cy, s] of [[16, 18, 1], [32, 19, -1]]) {
      for (let k = 7; k >= 0; k--) blob(P, cx + s * k * 0.9, cy - k * 0.7, 5, 4.6, C.tortilla, cx + k, 0.1, 0.42 + k * 0.02);
      blob(P, cx, cy, 5, 4.6, C.tortilla, cx + 9, 0.06, 0.7);
      blob(P, cx, cy, 3.8, 3.4, C.kyckling, cx + 1, 0.15, 0.55);
      pieces(P, cx, cy, 3, 2.6, [[C.tomat, 3, 1], [C.gron, 4, 1], [C.ost, 2, 1], [C.paprikaR, 1, 1]], cx + 2);
      for (let a = 0; a < 26; a++) P.px(Math.round(cx + Math.cos(a / 4.1) * (1.4 + a * 0.1)), Math.round(cy + Math.sin(a / 4.1) * (1.2 + a * 0.09)), C.tortilla[3], 0.6);
    }
  },
  hempizza: (P) => { // en hel pizza på träbricka, en bit utdragen
    blob(P, 24, 18, 20, 9.6, [0x6a3a14, 0x8a5420, 0xa86e30, 0xc88a48, 0xe0aa68], 171, 0.1, 0.5);
    blob(P, 24, 17, 17, 8, C.skorpa, 172, 0.1, 0.6); blob(P, 24, 17, 14.6, 6.6, C.tomat, 173, 0.14, 0.5);
    for (let k = 0; k < 40; k++) { const a = hash(k, 1, 174) * 6.28, r = Math.sqrt(hash(k, 2, 174)); blob(P, 24 + Math.cos(a) * 12 * r, 17 + Math.sin(a) * 5.4 * r, 1.6, 1.1, C.ost, 175 + k, 0.05); }
    pieces(P, 24, 17, 12, 5, [[C.champ, 7, 3], [C.gron, 4, 1]], 176);
    for (const a of [0.5, 2.6, 4.4]) for (let r = 0; r < 14; r++) P.px(Math.round(24 + Math.cos(a) * r), Math.round(17 + Math.sin(a) * r * 0.46), C.tomat[0], 0.5);
  },
  fiskpotatis: (P) => { plate(P, 24, 20, 19, 9); blob(P, 19, 17.5, 9, 4.4, C.fisk, 181, 0.08, 0.6); blob(P, 18.5, 16.2, 7.6, 2.8, C.skorpa, 188, 0.25, 0.62); for (let x = 12; x < 27; x += 3) P.px(x, 15 + (x & 1), C.skorpa[4]); for (let i = 0; i < 3; i++) blob(P, 30 + i * 3, 18 + (i & 1) * 2, 3, 2.4, C.potatis, 182 + i, 0.06, 0.68); blob(P, 23, 22, 3, 1.8, C.citron, 186, 0.05, 0.7); P.px(23, 22, C.citron[4]); strossel(P, 31, 17, 4, 2, C.gron[2], 5, 187); },
  svamprisotto: (P) => { bowl(P, 24, 15, 15, 6, 7, [0x5a5a5a, 0x8a8a8a, 0xb4b4b4, 0xd8d8d8, 0xf4f4f4], C.kram, 191); strossel(P, 24, 14, 11, 4, C.kram[1], 18, 192); pieces(P, 24, 14, 10, 3.6, [[C.champ, 7, 3]], 193); strossel(P, 24, 14, 9, 3, C.gron[2], 5, 194); },
  wok: (P) => { bowl(P, 24, 15, 16, 6, 6, [0x1a1a1e, 0x2e2e34, 0x46464e, 0x62626c, 0x8a8a96], C.ris, 201); pieces(P, 24, 14, 12, 4, [[C.paprikaR, 4, 2], [C.paprikaG, 3, 2], [C.morot, 4, 2], [C.aubergine, 3, 2]], 202); P.hl(39, 11, 6, 0x2e2e34); P.hl(40, 10, 5, 0x46464e); },
  guacamole: (P) => { bowl(P, 20, 14, 11, 5, 7, [0x8a4a1a, 0xb06a30, 0xd08a48, 0xe8b070, 0xf8d8a8], C.avokado, 211); pieces(P, 20, 13, 7, 2.6, [[C.tomat, 3, 1], [C.gron, 2, 1]], 212); for (let i = 0; i < 6; i++) { const x = 31 + (i % 3) * 5, y = 16 + Math.floor(i / 3) * 5; for (let j = 0; j < 5; j++) P.hl(x - j / 2, y + j, j + 1, tone(C.tortilla, 0.7 - j * 0.08, x, y + j)); } },
  appelkaka: (P) => { // i en rund form, en klick vaniljsås
    blob(P, 24, 18, 18, 8.4, [0xd8d0c8, 0xe8e2da, 0xf4f0ea, 0xfaf8f4, 0xffffff], 221, 0.04, 0.6);
    blob(P, 24, 17, 15, 6.6, C.smula, 222, 0.3, 0.6);
    pieces(P, 24, 17, 12, 5, [[C.applG, 5, 2], [C.smula, 8, 2]], 223);
    blob(P, 30, 15, 4, 2, [0xd8b040, 0xf0cc58, 0xf8e080, 0xfff0b0, 0xfffbe0], 224, 0.03, 0.7);
  },
  tropisk: (P) => { bowl(P, 24, 15, 15, 6, 8, [0x2a7a6a, 0x3a9a88, 0x5abaa8, 0x8ad8c8, 0xc0f0e8], C.melon, 231); pieces(P, 24, 14, 12, 4.4, [[C.ananas, 5, 3], [C.melon, 4, 3], [C.kiwi, 4, 3], [C.granat, 6, 1]], 232); for (let k = 0; k < 4; k++) P.px(33 + k, 9 - k, C.gron[k & 1 ? 2 : 3]); },
  _: (P) => { plate(P, 24, 20, 19, 9); blob(P, 24, 17, 11, 5, C.potatis, 999); },
};
// den rutiga duken (röd/vit) bakom rätten
function cloth(P) {
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
    const a = ((x >> 2) + (y >> 2)) & 1, bx = (x >> 2) & 1, by = (y >> 2) & 1;
    const c = bx && by ? 0xc8484a : bx || by ? 0xe8a0a0 : 0xfaf2ea;
    P.px(x, y, mul(c, 0.94 + hash(x, y, 7) * 0.06 + (a ? 0 : 0.02)));
  }
}
const DISH = new Map(), FOOD = new Map();
// bara rätten (med sin tallrik/skål, utan duk) – köket lägger den på bänken när den är klar
export function dishFood(id) {
  let cv = FOOD.get(id);
  if (cv) return cv;
  const food = new Pix(DW, DH);
  (DISHES[id] || DISHES._)(food);
  outline(food);
  cv = food.flush();
  FOOD.set(id, cv);
  return cv;
}
export function dishCanvas(id) {
  let cv = DISH.get(id);
  if (cv) return cv;
  const bg = new Pix(DW, DH);
  cloth(bg);
  // slagskugga under rätten
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const nx = (x - 25) / 20, ny = (y - 26) / 5; if (nx * nx + ny * ny < 1) bg.px(x, y, 0x3a1a1a, 0.25); }
  cv = bg.flush();
  cv.getContext('2d').drawImage(dishFood(id), 0, 0);
  DISH.set(id, cv);
  return cv;
}

// ================= spisen och boken =================
const ingChip = (g, id, n = 1) => { const r = ravaraOf(id), har = g.skafferi?.[id] | 0, have = har >= n; return `<span class="kok-ing ${have ? 'ok' : 'no'}" title="${esc(r?.name || id)}">${r?.icon || '?'} ${esc(r?.name || id)}${n > 1 ? ` ${Math.min(har, n)}/${n}` : have ? '' : ' ✗'}</span>`; };
const stars = (n) => '★'.repeat(kockStjarnor(n)) + '☆'.repeat(3 - kockStjarnor(n));
function bindDishes(dlg) {
  dlg.querySelectorAll('canvas[data-dish]').forEach((cv) => {
    const src = dishCanvas(cv.dataset.dish), x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, DW, DH, 0, 0, cv.width, cv.height);
  });
}
const dishTag = (id, s = 3) => `<canvas class="kok-dish" data-dish="${id}" width="${DW * s}" height="${DH * s}"></canvas>`;

export function openKok(A, tab = 'laga') {
  const g = A.game;
  const tabs = `<div class="kok-tabs"><button class="av-tab ${tab === 'laga' ? 'on' : ''}" data-tab="laga">🍳 Spisen</button><button class="av-tab ${tab === 'bok' ? 'on' : ''}" data-tab="bok">📖 Receptboken</button></div>`;
  let body;
  if (tab === 'laga') {
    const N = portionOf(A.kokN || 1).n;
    const known = RECEPT.filter((r) => g.knowsRecipe(r.id));
    known.sort((a, b) => g.missingFor(a.id, N).length - g.missingFor(b.id, N).length);
    const rows = known.map((r) => {
      const miss = g.missingFor(r.id, N), n = g.kockat?.[r.id] | 0;
      return `<div class="kok-row ${miss.length ? '' : 'ready'}">${dishTag(r.id, 2)}
        <div class="kok-txt"><b>${r.icon} ${esc(r.name)}</b> <span class="kok-stars" title="Kockvana: ${n} portioner">${stars(n)}</span>
          <div class="kok-ings">${r.ing.map((x) => ingChip(g, x, N)).join('')}</div>
          <small>${Math.round(r.min * portionOf(N).tid)} min · +${g.portionFill(r.id)} mätt${r.glad ? ` · +${r.glad} 😊` : ''}${r.energi ? ` · +${r.energi} ⚡` : ''}${N > 1 ? ` · ${N - 1} matlådor` : ''}</small></div>
        <button class="btn btn-small ${miss.length ? '' : 'btn-go'}" data-laga="${r.id}" ${miss.length ? 'disabled' : ''}>🍳 Laga</button></div>`;
    }).join('');
    const unknown = RECEPT.length - known.length;
    const niva = g.kockNiva, nasta = KOCK_NIVA_P[niva];
    const chips = PORTIONER.map((p) => `<button class="lm-chip ${p.n === N ? 'on' : ''}" data-port="${p.n}">${p.icon} ${p.name}${p.n > 1 ? ` ×${p.n}` : ''}</button>`).join('');
    body = `${tabs}<div class="kok-port">${chips}</div><p class="kok-note">👩‍🍳 <b>${KOCK_TITLAR[niva - 1]}</b> – ${g.kockPortioner | 0} lagade portioner${nasta ? ` (${KOCK_TITLAR[niva]} vid ${nasta})` : ''}. ${N > 1 ? `${portionOf(N).name}: råvarorna ×${N}, en portion äter du direkt och resten blir matlådor i kylen.` : 'Storkok och megakok blir matlådor i kylen.'}${unknown ? ` <b>${unknown}</b> recept till står i receptboken.` : ''}</p><div class="kok-list">${rows || '<p>Läs ett recept i receptboken först!</p>'}</div>`;
  } else {
    const rows = RECEPT.map((r, i) => {
      const kan = g.knowsRecipe(r.id), n = g.kockat?.[r.id] | 0;
      return `<div class="kok-page ${kan ? 'kan' : ''}"><div class="kok-pic">${dishTag(r.id, 3)}<span class="kok-no">s. ${i + 1}</span></div>
        <div class="kok-txt"><b>${r.icon} ${esc(r.name)}</b>${kan ? ` <span class="kok-stars">${stars(n)}</span>` : ''}
          <p>${esc(r.blurb)}</p>
          <div class="kok-ings">${r.ing.map((x) => ingChip(g, x)).join('')}</div>
          <small>${r.min} min vid spisen · +${r.fill} mätt${r.glad ? ` · +${r.glad} 😊` : ''}${r.energi ? ` · +${r.energi} ⚡` : ''}</small>
          ${kan ? `<div class="kok-kan">✓ Du kan den${n ? ` – lagad ${n} ${n === 1 ? 'gång' : 'gånger'}` : ''}</div>` : `<button class="btn btn-small btn-gold" data-las="${r.id}">📖 Läs och lär dig (${RECEPT_LAS_MIN} min)</button>`}</div></div>`;
    }).join('');
    body = `${tabs}<p class="kok-note">📖 <b>Pixelstadens kokbok</b> – läs ett recept så kan du laga det vid spisen. Lagar du samma rätt ${KOCK_STEG[0]} och ${KOCK_STEG[1]} gånger blir den godare (★★, ★★★).</p><div class="kok-book">${rows}</div>`;
  }
  const dlg = openModal(tab === 'laga' ? '🍳 Laga mat' : '📖 Receptboken', body, [{ label: 'Stäng', cls: 'btn-go', onClick: closeModal }]);
  dlg.classList.add('dlg-kok');
  bindDishes(dlg);
  dlg.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { play('click'); openKok(A, b.dataset.tab); }));
  dlg.querySelectorAll('[data-las]').forEach((b) => (b.onclick = () => {
    const res = g.learnRecipe(b.dataset.las);
    if (!res.ok) { toast(res.msg, 'bad'); return; }
    play('ok');
    toast(`📖 Nu kan du ${res.recipe.name.toLowerCase()}! Laga den vid spisen.`, 'good');
    openKok(A, 'bok');
  }));
  dlg.querySelectorAll('[data-port]').forEach((b) => (b.onclick = () => { A.kokN = +b.dataset.port; play('click'); openKok(A, 'laga'); }));
  // Laga: till köket (js/scenes/koket.js) – där guidar spelet steg för steg, Game.cook räknar när man är klar
  dlg.querySelectorAll('[data-laga]').forEach((b) => (b.onclick = () => {
    const N = portionOf(A.kokN || 1).n, chk = g.canCook(b.dataset.laga, N);
    if (!chk.ok) { play('fel'); toast(chk.msg, 'bad'); return; }
    play('ok');
    closeModal();
    A.kokPlan = { id: b.dataset.laga, n: N };
    A.go('koket');
  }));
  return dlg;
}
