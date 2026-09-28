// MÖBELJÄTTEN – rekvisita som ritas y-sorterat (kundvagnar, kassor, skyltstolpar,
// pelare, gaffeltruck, flakvagnar, Småland …). Varje sprite målas en gång.
import { Pix, SMALL, BIG, textW, text, mix, mul, hash } from '../../core/floor-pix.js';
import { spriteOf, arrowGlyph } from './art.js';

const memo = new Map();
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };

// ---------- entrén ----------
export const cartsImg = () => once('carts', () => spriteOf(40, 24, (P) => {
  for (let n = 2; n >= 0; n--) {
    const ox = n * 6, oy = 2;
    for (let y = oy + 4; y < oy + 14; y++) for (let x = ox + 4; x < ox + 26; x++) {
      const edge = x === ox + 4 || x === ox + 25 || y === oy + 4 || y === oy + 13;
      if (edge) P.px(x, y, 0x8a9098);
      else if ((x + y) % 3 === 0) P.px(x, y, 0xb8bec6, 0.9);
      else P.px(x, y, 0x2a2e36, 0.12);
    }
    P.hl(ox + 4, oy + 4, 22, 0xd8dce2);
    P.vl(ox + 26, oy + 1, 5, 0x8a9098); P.hl(ox + 24, oy, 6, 0x1f58a8); P.hl(ox + 24, oy + 1, 6, 0xf2c230);
    P.hl(ox + 5, oy + 16, 20, 0x6a7078); P.vl(ox + 6, oy + 14, 3, 0x6a7078); P.vl(ox + 23, oy + 14, 3, 0x6a7078);
    P.rect(ox + 5, oy + 18, 3, 3, 0x1c1c22); P.rect(ox + 22, oy + 18, 3, 3, 0x1c1c22);
    P.px(ox + 6, oy + 19, 0x5a5a64); P.px(ox + 23, oy + 19, 0x5a5a64);
  }
}));
export const bagStandImg = () => once('bags', () => spriteOf(18, 30, (P) => {
  P.vl(8, 2, 26, 0x6a7078); P.vl(9, 2, 26, 0x9aa0a8); P.rect(4, 27, 10, 2, 0x3a3e46);
  P.hl(3, 3, 12, 0x6a7078);
  const bag = (x, y, col, hand) => {
    P.rect(x, y + 3, 7, 10, col); P.box(x, y + 3, 7, 10, mul(col, 0.7));
    P.hl(x + 1, y + 4, 5, mix(col, 0xffffff, 0.3));
    P.vl(x + 1, y, 3, hand); P.vl(x + 5, y, 3, hand); P.hl(x + 2, y, 3, hand);
  };
  bag(1, 4, 0xf6cf2a, 0x1f58a8); bag(10, 4, 0xf6cf2a, 0x1f58a8); bag(1, 15, 0x2c62b8, 0xf2c230); bag(10, 15, 0xf6cf2a, 0x1f58a8);
}));
// SMÅLAND: bakre delen (skylt, rutschkana, bollhavet) och främre staketet – barnen ritas emellan
export const smalandBackImg = () => once('smaB', () => spriteOf(76, 44, (P) => {
  // skylt på stolpe
  P.vl(4, 0, 22, 0x6a7078); P.vl(5, 0, 22, 0x9aa0a8);
  P.rect(0, 0, 44, 11, 0xd8433b); P.box(0, 0, 44, 11, 0x7a1a1a); P.hl(1, 1, 42, 0xf07a6a);
  text(P, SMALL, 'SMÅLAND', 5, 4, 0xffffff);
  // bakre staket
  const y0 = 18;
  P.rect(2, y0, 72, 3, 0xf6cf2a); P.box(2, y0, 72, 3, 0x9a7a10);
  for (let x = 4; x < 74; x += 5) P.vl(x, y0 + 3, 4, 0x1d51a0);
  // bollhavet
  P.rect(3, y0 + 7, 70, 16, 0x2a3a6a);
  const cols = [0xd8433b, 0xf2c230, 0x2c9a4c, 0x4aa8e8, 0xf07aa8, 0xffffff, 0xee7d2a];
  for (let i = 0; i < 190; i++) {
    const bx = 3 + ((hash(i, 1, 90) * 68) | 0), by = y0 + 7 + ((hash(i, 2, 90) * 14) | 0);
    const c = cols[(hash(i, 3, 90) * cols.length) | 0];
    P.px(bx, by, c); P.px(bx + 1, by, c); P.px(bx, by + 1, mul(c, 0.8)); P.px(bx + 1, by + 1, mul(c, 0.66));
    P.px(bx, by, mix(c, 0xffffff, 0.45));
  }
  // liten rutschkana i hörnet
  for (let i = 0; i < 14; i++) { P.rect(58 + i, y0 - 6 + i, 3, 2, 0x2c9a4c); P.px(58 + i, y0 - 6 + i, 0x6ad07a); }
  P.rect(56, y0 - 8, 5, 3, 0xf6cf2a); P.vl(56, y0 - 5, 12, 0x9aa0a8); P.vl(60, y0 - 5, 12, 0x9aa0a8);
}));
export const smalandFrontImg = () => once('smaF', () => spriteOf(76, 12, (P) => {
  P.rect(2, 0, 72, 3, 0xf6cf2a); P.box(2, 0, 72, 3, 0x9a7a10);
  for (let x = 2; x < 74; x += 6) { P.rect(x, 3, 2, 7, 0x1d51a0); P.px(x, 3, 0x3f76c8); }
  P.rect(2, 8, 72, 2, 0xf6cf2a); P.hl(2, 10, 72, 0x9a7a10);
  P.hl(3, 11, 70, 0x000000, 0.2);
}));
// informationsdisken
export const infoDeskImg = () => once('info', () => spriteOf(58, 30, (P) => {
  // skylten på ställning bakom
  P.vl(28, 0, 10, 0x6a7078);
  P.rect(14, 0, 30, 9, 0x1d51a0); P.box(14, 0, 30, 9, 0x0c2a5c);
  text(P, SMALL, 'INFO', 17, 2, 0xf6d02f); P.rect(36, 2, 5, 5, 0xffffff); P.vl(38, 4, 3, 0x1d51a0); P.px(38, 2, 0x1d51a0);
  // disken: vit front med blå/gul rand, skiva ovanpå
  P.rect(0, 14, 58, 3, 0xf4f1ea); P.hl(0, 14, 58, 0xffffff); P.hl(0, 16, 58, 0xb8b4ac);
  P.rect(1, 17, 56, 12, 0xe8e6e0); P.box(1, 17, 56, 12, 0x6a6a72);
  P.rect(2, 21, 54, 3, 0x1d51a0); P.hl(2, 24, 54, 0xf2c230);
  P.hl(2, 28, 54, 0x9a9aa2);
  // skärm + broschyrer
  P.rect(38, 7, 11, 7, 0x2a2a32); P.rect(39, 8, 9, 4, 0x7fc0e8); P.hl(39, 8, 9, 0xbfe4f4); P.vl(43, 12, 2, 0x2a2a32);
  P.rect(6, 11, 5, 3, 0xf6cf2a); P.rect(12, 11, 5, 3, 0xffffff); P.rect(18, 12, 4, 2, 0xd8433b);
}));
// "veckans fynd" – skylt på fot
export const offerSignImg = () => once('offer', () => spriteOf(40, 34, (P) => {
  P.vl(19, 16, 16, 0x6a7078); P.vl(20, 16, 16, 0x9aa0a8); P.rect(13, 31, 14, 3, 0x3a3e46);
  P.rect(0, 0, 40, 17, 0xd8231e); P.box(0, 0, 40, 17, 0x7a1010); P.hl(1, 1, 38, 0xf05a4a);
  text(P, SMALL, 'VECKANS', 6, 3, 0xffffff);
  text(P, SMALL, 'FYND!', 11, 10, 0xf6d02f);
}));
// stor krukväxt (ficus i vit kruka)
export const bigPlantImg = (seed = 0) => once('plant' + seed, () => spriteOf(22, 44, (P) => {
  P.rect(5, 32, 12, 11, 0xf4f1ea); P.box(5, 32, 12, 11, 0x9a968e); P.hl(6, 33, 10, 0xffffff); P.rect(4, 31, 14, 2, 0xe2ded6);
  P.vl(11, 14, 18, 0x6a4a2a); P.vl(10, 20, 10, 0x6a4a2a);
  for (let i = 0; i < 70; i++) {
    const a = hash(i, seed, 91) * Math.PI * 2, r = hash(i, seed, 92) * 9;
    const x = 11 + Math.cos(a) * r * 1.1, y = 14 + Math.sin(a) * r * 1.3 - 2;
    const c = hash(i, seed, 93) > 0.5 ? 0x3a8a48 : 0x2c6a38;
    P.px(x, y, c); P.px(x + 1, y, mix(c, 0x8adc6a, 0.4));
  }
  P.hl(5, 43, 12, 0x000000, 0.25);
}));

// ---------- skyltstolpar (vägvisare) ----------
// lines: [[text, pil 'L'|'R'|'U'|'D'], …]
export function signpostImg(lines) {
  const key = 'post:' + lines.map((l) => l.join(',')).join('|');
  return once(key, () => {
    const bw = Math.max(...lines.map(([t]) => textW(SMALL, t))) + 16;
    const w = bw + 2, h = lines.length * 11 + 24;
    return spriteOf(w, h, (P) => {
      const px = w >> 1;
      P.vl(px - 1, 2, h - 4, 0x5a6068); P.vl(px, 2, h - 4, 0x9aa0a8);
      P.rect(px - 4, h - 3, 9, 3, 0x3a3e46); P.hl(px - 4, h - 3, 9, 0x6a7078);
      lines.forEach(([t, dir], i) => {
        const y = 1 + i * 11, bx = 1;
        const bg = dir === 'X' ? 0x169a4a : 0x1d51a0;
        P.rect(bx, y, bw, 10, bg); P.box(bx, y, bw, 10, mul(bg, 0.45)); P.hl(bx + 1, y + 1, bw - 2, mix(bg, 0xffffff, 0.22));
        const left = dir === 'L';
        const tx = left ? bx + 11 : bx + 4;
        text(P, SMALL, t, tx, y + 3, dir === 'X' ? 0xffffff : 0xf6d02f);
        arrowGlyph(P, left ? bx + 5 : bx + bw - 6, y + 5, dir === 'X' ? 'R' : dir, 0xffffff);
      });
    });
  });
}
// runda vita pelare med gult/blått band och en liten skylt
export function pillarImg(h, label = '') {
  return once('pillar' + h + label, () => spriteOf(14, h, (P) => {
    for (let y = 0; y < h; y++) for (let x = 2; x < 12; x++) {
      const t = (x - 2) / 9;
      let c = mix(0xfafaf6, 0xb8b4ac, Math.pow(t, 1.3));
      if (x === 3) c = 0xffffff;
      P.px(x, y, c);
    }
    P.vl(2, 0, h, 0x8a8478); P.vl(11, 0, h, 0x6a6660);
    // fotlist + band
    P.rect(1, h - 5, 12, 5, 0x2a2a30); P.hl(1, h - 5, 12, 0x4a4a54);
    const by = Math.round(h * 0.42);
    P.rect(2, by, 10, 3, 0x1d51a0); P.rect(2, by + 3, 10, 2, 0xf2c230);
    if (label) {
      const lw = textW(SMALL, label) + 4;
      P.rect(7 - (lw >> 1), by - 10, lw, 8, 0x1d51a0); P.box(7 - (lw >> 1), by - 10, lw, 8, 0x0c2a5c);
      text(P, SMALL, label, 9 - (lw >> 1), by - 8, 0xf6d02f);
    }
  }));
}

// ---------- kassorna ----------
// kassadisk längs x: bandet i öster, kassaapparaten i väster (kassörskan sitter bakom)
export const checkoutImg = (n) => once('co' + n, () => spriteOf(70, 30, (P) => {
  // lampstolpe med kassanumret (östra änden)
  P.vl(64, 0, 22, 0x5a6068); P.rect(59, 0, 11, 9, 0x1d51a0); P.box(59, 0, 11, 9, 0x0c2a5c);
  text(P, SMALL, String(n), 63, 2, 0xf6d02f); P.px(64, 9, 0xfff6c0);
  // disken
  P.rect(0, 16, 62, 3, 0xd8d6d0); P.hl(0, 16, 62, 0xf4f2ec);
  P.rect(0, 19, 62, 10, 0xe8e6e0); P.box(0, 19, 62, 10, 0x6a6a72);
  P.rect(1, 22, 60, 2, 0x1d51a0); P.hl(1, 24, 60, 0xf2c230); P.hl(1, 28, 60, 0x9a9aa2);
  // bandet
  P.rect(24, 13, 37, 4, 0x26262e); for (let x = 26; x < 61; x += 4) P.vl(x, 13, 4, 0x3a3a44);
  P.hl(24, 13, 37, 0x4a4a54); P.rect(22, 12, 2, 5, 0x9aa0a8);
  // varor på bandet
  P.rect(30, 9, 8, 5, 0xc49a62); P.box(30, 9, 8, 5, 0x7a5a30); P.hl(31, 11, 6, 0xe6d6aa);
  P.rect(42, 10, 5, 4, 0xf6cf2a); P.rect(50, 8, 3, 6, 0x3a8ad0); P.rect(54, 11, 5, 3, 0xd8433b);
  // kassaapparat + skärm + kortläsare
  P.rect(2, 8, 13, 7, 0x2a2a32); P.rect(3, 9, 11, 4, 0x5fd08a); P.hl(3, 9, 11, 0x9ff0b8);
  text(P, SMALL, '-', 5, 9, 0x1a4a2a);
  P.rect(16, 11, 5, 5, 0x3a3a44); P.rect(17, 12, 3, 2, 0x7fd0ff);
  P.rect(4, 15, 12, 2, 0xc8ccd2); // skanner-glas
}));
export const queuePostImg = () => once('qpost', () => spriteOf(6, 16, (P) => {
  P.vl(2, 1, 13, 0x8a9098); P.vl(3, 1, 13, 0xc8ccd2); P.rect(0, 14, 6, 2, 0x3a3e46); P.rect(1, 0, 4, 2, 0x2a2a30);
}));

// ---------- lagret ----------
export function palletStackImg(seed) {
  return once('pal' + seed, () => spriteOf(30, 26, (P) => {
    // pall
    P.rect(1, 22, 28, 2, 0xc8a06a); P.hl(1, 22, 28, 0xe0bc84);
    for (const x of [1, 13, 26]) P.rect(x, 24, 3, 2, 0x8a6a40);
    // kartonger (plastade)
    const n = 2 + ((hash(seed, 1, 5) * 2) | 0);
    let y = 22;
    for (let i = 0; i < n; i++) {
      const h = 6 + ((hash(seed, i, 6) * 3) | 0), w = 26 - ((hash(seed, i, 7) * 6) | 0), x = 2 + ((26 - w) >> 1);
      y -= h;
      P.rect(x, y, w, h, 0xc49a62); P.box(x, y, w, h, 0x7a5a30); P.hl(x + 1, y + 1, w - 2, 0xdab47c);
      P.rect(x + (w >> 1) - 3, y + 2, 6, 3, 0xf4f1ea); P.hl(x + (w >> 1) - 2, y + 3, 4, 0x3a3a44);
    }
    for (let yy = y; yy < 22; yy++) if (yy % 3 === 0) P.hl(2, yy, 26, 0xffffff, 0.14); // plast
  }));
}
export const flatCartImg = (load = true) => once('flat' + load, () => spriteOf(40, 22, (P) => {
  // handtag
  P.vl(37, 2, 16, 0x1d51a0); P.vl(38, 2, 16, 0x3f76c8); P.hl(34, 2, 5, 0x1d51a0);
  // flak
  P.rect(1, 14, 37, 3, 0x6a7078); P.hl(1, 14, 37, 0x9aa0a8); P.hl(1, 17, 37, 0x3a3e46);
  for (const x of [3, 33]) { P.rect(x, 18, 4, 4, 0x1c1c22); P.px(x + 1, 19, 0x5a5a64); }
  if (load) {
    P.rect(3, 6, 30, 8, 0xc49a62); P.box(3, 6, 30, 8, 0x7a5a30); P.hl(4, 7, 28, 0xdab47c);
    P.rect(12, 8, 12, 4, 0xf4f1ea); text(P, SMALL, 'BÖJ', 13, 7, 0x1d51a0);
    P.rect(6, 1, 18, 5, 0xb48a52); P.box(6, 1, 18, 5, 0x7a5a30);
  }
}));
// rullbur (påfyllnadsvagn)
export const rollCageImg = () => once('cage', () => spriteOf(22, 30, (P) => {
  for (let y = 2; y < 25; y++) for (let x = 1; x < 21; x++) {
    const edge = x === 1 || x === 20 || y === 2 || y === 24;
    if (edge) P.px(x, y, 0x8a9098); else if (x % 4 === 1 || y % 4 === 2) P.px(x, y, 0xb8bec6, 0.7);
  }
  P.rect(3, 12, 8, 6, 0xc49a62); P.box(3, 12, 8, 6, 0x7a5a30); P.rect(11, 14, 8, 10, 0xb48a52); P.box(11, 14, 8, 10, 0x7a5a30);
  P.rect(4, 19, 6, 5, 0xf6cf2a); P.box(4, 19, 6, 5, 0x9a7a10);
  P.rect(2, 25, 18, 2, 0x5a6068);
  for (const x of [2, 16]) { P.rect(x, 27, 3, 3, 0x1c1c22); P.px(x + 1, 28, 0x5a5a64); }
}));
// gaffeltruck (åt höger; speglas i ritningen) – föraren ritas för sig
export const forkliftImg = () => once('fork', () => spriteOf(46, 40, (P) => {
  // mast + gafflar med last (fram = höger)
  P.rect(34, 4, 3, 32, 0x3a3e46); P.rect(37, 4, 2, 32, 0x5a6068);
  P.rect(38, 33, 8, 2, 0x2a2a30);
  P.rect(38, 20, 8, 1, 0x2a2a30);
  // last: pall med kartonger
  P.rect(38, 30, 8, 3, 0xc8a06a);
  P.rect(39, 20, 7, 10, 0xc49a62); P.box(39, 20, 7, 10, 0x7a5a30); P.hl(40, 21, 5, 0xdab47c);
  // skyddstak
  P.hl(12, 6, 24, 0x2a2a30); P.hl(12, 7, 24, 0x4a4a54);
  P.vl(13, 7, 17, 0x2a2a30); P.vl(33, 7, 17, 0x2a2a30);
  // kaross
  for (let y = 22; y < 35; y++) for (let x = 6; x < 36; x++) {
    let c = mix(0xf2b21a, 0xd8901a, (y - 22) / 13);
    if (x < 12 && y < 27) continue; // motvikt lägre
    if (y === 22 || (x === 12 && y < 27)) c = 0xffd24a;
    P.px(x, y, c);
  }
  P.rect(4, 26, 8, 9, 0x3a3e46); P.hl(4, 26, 8, 0x5a6068); // motvikt
  P.rect(16, 18, 12, 5, 0x2a2a30); // säte/rygg
  P.rect(28, 17, 2, 6, 0x2a2a30); P.rect(27, 15, 5, 2, 0x1a1a20); // ratt
  P.hl(6, 30, 30, 0x1a1a20, 0.25);
  text(P, SMALL, 'MJ', 18, 27, 0x1a1a20);
  // hjul
  for (const [x, r] of [[11, 4], [30, 4]]) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
    const d = Math.hypot(xx, yy);
    if (d <= r) P.px(x + xx, 35 + yy, d < 1.6 ? 0x9aa0a8 : 0x1c1c22);
  }
  // varningslampa
  P.rect(22, 3, 3, 3, 0xff8a1a); P.px(23, 3, 0xffe0a0);
}));
// kartong man bär (12×9)
export const cartonImg = () => once('carton', () => spriteOf(12, 9, (P) => {
  P.rect(0, 0, 12, 9, 0xc49a62); P.box(0, 0, 12, 9, 0x7a5a30); P.hl(1, 1, 10, 0xdab47c);
  P.vl(6, 0, 9, 0xe6d6aa); P.rect(2, 4, 3, 2, 0xf4f1ea);
}));
// kundvagn som en kund skjuter (åt höger; speglas)
export const pushCartImg = (load) => once('pc' + load, () => spriteOf(24, 18, (P) => {
  for (let y = 3; y < 12; y++) for (let x = 5; x < 23; x++) {
    const edge = x === 5 || x === 22 || y === 3 || y === 11;
    if (edge) P.px(x, y, 0x8a9098); else if ((x + y) % 3 === 0) P.px(x, y, 0xb8bec6, 0.9); else P.px(x, y, 0x2a2e36, 0.1);
  }
  if (load === 1) { P.rect(8, 1, 7, 6, 0xc49a62); P.box(8, 1, 7, 6, 0x7a5a30); P.rect(15, 3, 5, 5, 0x2c62b8); }
  if (load === 2) { P.rect(7, 0, 5, 7, 0x3a8a48); P.rect(13, 2, 6, 5, 0xf6cf2a); P.px(9, 0, 0x6ad07a); }
  P.vl(4, 1, 6, 0x8a9098); P.hl(0, 1, 5, 0x1f58a8); P.hl(0, 2, 5, 0xf2c230);
  P.hl(6, 13, 16, 0x6a7078);
  for (const x of [6, 19]) { P.rect(x, 14, 3, 3, 0x1c1c22); P.px(x + 1, 15, 0x5a5a64); }
}));
// kasse i handen: blå FRAKTA med gula handtag
export const bagImg = () => once('bag', () => spriteOf(8, 11, (P) => {
  P.vl(1, 0, 3, 0xf2c230); P.vl(6, 0, 3, 0xf2c230); P.hl(2, 0, 4, 0xf2c230);
  P.rect(0, 3, 8, 8, 0x1d51a0); P.box(0, 3, 8, 8, 0x0c2a5c); P.hl(1, 4, 6, 0x3f76c8); P.hl(1, 7, 6, 0xf2c230);
}));
// korvkiosken (bistron efter kassorna)
export const hotdogImg = () => once('hot', () => spriteOf(50, 36, (P) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 50; x++) {
    const hw = 8 + y * 2.9;
    if (Math.abs(x - 24.5) > hw) continue;
    P.px(x, y, ((x / 5) | 0) % 2 ? 0xf6cf2a : 0x1d51a0);
  }
  P.hl(1, 8, 48, 0x0c2a5c);
  P.vl(24, 8, 8, 0x6a7078);
  P.rect(3, 16, 44, 18, 0xe8e6e0); P.box(3, 16, 44, 18, 0x6a6a72);
  text(P, SMALL, 'KORV 10:-', 7, 19, 0xd8231e);
  text(P, SMALL, 'GLASS 5:-', 7, 25, 0x1d51a0);
  P.rect(4, 30, 42, 2, 0x1d51a0); P.hl(4, 32, 42, 0xf2c230);
  P.rect(2, 14, 46, 3, 0xc8ccd2); P.hl(2, 14, 46, 0xe8ecf0);
  for (const kx of [7, 17]) { P.rect(kx, 11, 9, 3, 0xe0b070); P.hl(kx + 1, 11, 7, 0xb8452a); P.px(kx + 4, 11, 0xf2c230); }
  P.rect(30, 9, 3, 5, 0xf2c230); P.rect(34, 9, 3, 5, 0xd8231e);
  P.rect(39, 6, 7, 8, 0xdcecf4); P.box(39, 6, 7, 8, 0x8a9098); P.px(41, 8, 0xf07aa8); P.px(43, 9, 0xfff4d0); // glassbox
  P.rect(6, 34, 3, 2, 0x2a2a30); P.rect(41, 34, 3, 2, 0x2a2a30);
}));
// ståbord i bistron
export const highTableImg = () => once('ht', () => spriteOf(16, 26, (P) => {
  for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) { const t = Math.hypot((x - 7.5) / 8, (y - 2) / 2.6); if (t < 1) P.px(x, y, t > 0.8 ? 0xb8b4ac : 0xf4f1ea); }
  P.vl(7, 5, 19, 0x5a5a62); P.vl(8, 5, 19, 0x8a8a92); P.rect(3, 23, 10, 3, 0x2a2a30);
}));
