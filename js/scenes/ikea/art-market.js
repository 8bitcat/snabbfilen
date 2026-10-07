// MÖBELJÄTTEN – marknadshallen och lagret: vägghyllor med småsaker, korgar,
// bord med varor, lampor i taket, växtbord, tavelvägg, pallställ och kartonger.
import { Pix, SMALL, text, textW, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { spriteOf, miniTag, pendant, paintPicture, paintClock } from './art.js';
import { $t } from '../../core/i18n.js';

const memo = new Map();
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };
const PALS = {
  textil: [0xd8433b, 0xf2c230, 0x2c9a4c, 0x4aa8e8, 0xf07aa8, 0xf4f1ea, 0x2c5fc0, 0xee7d2a, 0x7e4bc0, 0x8e8c94],
  varm: [0xd8433b, 0xee7d2a, 0xf2c230, 0xf4f1ea, 0x2c9a4c],
  kall: [0x4aa8e8, 0x2c5fc0, 0x1fb5a8, 0xf4f1ea, 0x8e8c94],
};

// ---------- väggens hyllor ----------
// Metallhylla mot bakväggen: fötterna vid golvkanten fy+8, höjd h, nivåer levels.
export function paintWallShelf(P, x, fy, w, h, levels, goods, seed = 0) {
  const base = fy + 8, top = base - h;
  P.rect(x, top, w, h, 0x000000, 0.08); // skugga på väggen
  const step = Math.floor((h - 4) / levels);
  for (let i = 0; i < levels; i++) {
    const sy = base - 3 - i * step; // hyllplanets ovansida
    goods(P, x + 2, sy, w - 4, step - 2, i, seed);
    P.hl(x, sy, w, 0xe8ecf0); P.hl(x, sy + 1, w, 0x9aa0a8); P.hl(x, sy + 2, w, 0x6a7078);
  }
  for (let ux = x; ux <= x + w - 2; ux += Math.max(24, Math.floor((w - 2) / Math.max(1, Math.round(w / 44))))) {
    P.vl(ux, top, h, 0x5a6068); P.vl(ux + 1, top, h, 0x8a9098);
    for (let y = top + 3; y < base; y += 4) P.px(ux + 1, y, 0x3a3e46);
  }
  P.vl(x + w - 2, top, h, 0x5a6068); P.vl(x + w - 1, top, h, 0x8a9098);
  P.hl(x - 1, base, w + 2, 0x000000, 0.25);
}
// varor per hyllplan: goods(P, x, sy (ovansida), w, rumhöjd, nivå, frö)
export const GOODS = {
  textil(P, x, sy, w, hh, lv, seed) { // vikta textilier i staplar
    for (let gx = x; gx + 9 <= x + w; gx += 10) {
      const n = 2 + ((hash(gx, lv, seed + 1) * Math.min(4, hh / 3)) | 0);
      for (let j = 0; j < n; j++) {
        const c = PALS.textil[(hash(gx, lv * 7 + j, seed + 2) * PALS.textil.length) | 0];
        const y = sy - 3 - j * 3;
        P.rect(gx, y, 9, 3, c); P.hl(gx, y, 9, mix(c, 0xffffff, 0.3)); P.px(gx + 8, y + 1, mul(c, 0.7)); P.hl(gx, y + 2, 9, mul(c, 0.8));
      }
    }
  },
  kok(P, x, sy, w, hh, lv, seed) { // kastruller, tallrikar, glas, muggar
    let gx = x;
    while (gx < x + w - 8) {
      const k = (hash(gx, lv, seed + 3) * 4) | 0;
      if (k === 0 && gx + 11 <= x + w) { // kastrull med lock
        P.rect(gx, sy - 6, 10, 6, 0x5a5e66); P.hl(gx, sy - 6, 10, 0x9aa0a8); P.rect(gx + 1, sy - 8, 8, 2, 0x7a8088); P.px(gx + 4, sy - 9, 0x2a2a30); P.px(gx + 5, sy - 9, 0x2a2a30);
        P.hl(gx - 2, sy - 5, 2, 0x2a2a30); gx += 13;
      } else if (k === 1) { // tallriksstapel
        for (let j = 0; j < 5; j++) P.hl(gx, sy - 1 - j, 9, j % 2 ? 0xe8e6e0 : 0xfaf8f2);
        P.px(gx, sy - 5, 0xc8ccd2); gx += 11;
      } else if (k === 2) { // glas
        for (let j = 0; j < 3; j++) { P.rect(gx + j * 4, sy - 5, 3, 5, 0xcfe8f0); P.vl(gx + j * 4 + 2, sy - 5, 5, 0x9ac4d4); }
        gx += 13;
      } else { // muggar i färg
        for (let j = 0; j < 2; j++) { const c = PALS.textil[(hash(gx, j, seed + 4) * 8) | 0]; P.rect(gx + j * 5, sy - 4, 4, 4, c); P.px(gx + j * 5 + 4, sy - 3, c); P.hl(gx + j * 5, sy - 4, 4, mix(c, 0xffffff, 0.3)); }
        gx += 11;
      }
    }
  },
  ljus(P, x, sy, w, hh, lv, seed) { // bordslampor och glödlampskartonger
    let gx = x;
    while (gx < x + w - 8) {
      if (hash(gx, lv, seed + 5) > 0.35) {
        const c = PALS.textil[(hash(gx, lv, seed + 6) * PALS.textil.length) | 0];
        P.vl(gx + 4, sy - 5, 5, 0x3a3a44); P.hl(gx + 2, sy - 1, 5, 0x3a3a44);
        P.rect(gx + 1, sy - 9, 7, 4, c); P.hl(gx + 2, sy - 10, 5, mix(c, 0xffffff, 0.2)); P.px(gx + 4, sy - 5, 0xfff6c0);
        P.ell(gx + 4.5, sy - 4, 5, 3, 0xfff2c8, 0.2, 3);
        gx += 11;
      } else {
        for (let j = 0; j < 3; j++) { P.rect(gx + j * 4, sy - 5, 3, 5, 0xf4f1ea); P.rect(gx + j * 4, sy - 3, 3, 1, 0x1d51a0); }
        gx += 13;
      }
    }
  },
  vaxt(P, x, sy, w, hh, lv, seed) { // krukor och små växter
    for (let gx = x; gx + 7 <= x + w; gx += 9) {
      const pot = hash(gx, lv, seed + 7) > 0.5 ? 0xc4764e : 0xf4f1ea;
      P.rect(gx, sy - 5, 7, 5, pot); P.hl(gx, sy - 5, 7, mix(pot, 0xffffff, 0.25)); P.vl(gx + 6, sy - 4, 4, mul(pot, 0.8));
      if (hash(gx, lv, seed + 8) > 0.3) for (let i = 0; i < 9; i++) P.px(gx + 1 + ((hash(i, gx, 9) * 5) | 0), sy - 6 - ((hash(i, gx, 10) * 5) | 0), i % 2 ? 0x3a8a48 : 0x5aaa5a);
    }
  },
  dekor(P, x, sy, w, hh, lv, seed) { // ljus, vaser, små ramar
    let gx = x;
    while (gx < x + w - 6) {
      const k = (hash(gx, lv, seed + 11) * 3) | 0;
      if (k === 0) { for (let j = 0; j < 3; j++) { const c = [0xf4f1ea, 0xd8433b, 0xf2c230][j]; const hh2 = 4 + j; P.rect(gx + j * 3, sy - hh2, 2, hh2, c); P.px(gx + j * 3, sy - hh2 - 1, 0xffb030); } gx += 11; }
      else if (k === 1) { const c = PALS.kall[(hash(gx, lv, 12) * 5) | 0]; P.rect(gx + 1, sy - 7, 4, 7, c); P.rect(gx + 2, sy - 9, 2, 2, c); P.vl(gx + 1, sy - 7, 7, mix(c, 0xffffff, 0.3)); gx += 8; }
      else { P.rect(gx, sy - 8, 7, 8, 0x3a2a1c); P.rect(gx + 1, sy - 7, 5, 6, [0x9fd4ee, 0xf4e2b0, 0xd8433b][(hash(gx, 1, 13) * 3) | 0]); gx += 9; }
    }
  },
};

// ---------- korgar och bord med varor (y-sorterade) ----------
// korg (trådkorg) med kuddar / gosedjur / handdukar / ljus + prisskylt på pinne
export function binImg(kind, price) {
  return once(`bin:${kind}:${price}`, () => spriteOf(34, 32, (P) => {
    // prisskylt
    P.vl(28, 3, 12, 0x6a7078);
    const pw = textW(SMALL, price) + 4;
    P.rect(30 - pw, 0, pw, 8, 0xf5cd2e); P.box(30 - pw, 0, pw, 8, 0x7a5a0c); text(P, SMALL, price, 32 - pw, 2, 0x141414);
    // innehållet (sticker upp över kanten)
    const y0 = 14;
    const fill = (fn) => { for (let i = 0; i < 16; i++) fn(3 + ((hash(i, 1, kind.length) * 22) | 0), y0 - 3 + ((hash(i, 2, kind.length) * 6) | 0), i); };
    if (kind === 'kuddar') fill((x, y, i) => { const c = PALS.textil[i % PALS.textil.length]; P.rect(x, y, 7, 5, c); P.hl(x, y, 7, mix(c, 0xffffff, 0.3)); P.px(x, y, mul(c, 0.7)); P.px(x + 6, y + 4, mul(c, 0.7)); });
    else if (kind === 'hajar') fill((x, y, i) => { // blåa gosehajar
      P.rect(x, y + 1, 9, 3, 0x5a8ac8); P.hl(x, y + 3, 9, 0xf4f1ea); P.px(x + 3, y, 0x5a8ac8); P.px(x + 9, y, 0x5a8ac8); P.px(x + 9, y + 3, 0x5a8ac8); P.px(x + 1, y + 1, 0x1a1a20);
    });
    else if (kind === 'handdukar') fill((x, y, i) => { const c = PALS.kall[i % 5]; P.rect(x, y, 6, 4, c); P.vl(x + 5, y, 4, mul(c, 0.75)); P.hl(x, y + 1, 5, mix(c, 0xffffff, 0.25)); });
    else if (kind === 'ljus') fill((x, y, i) => { const c = i % 3 ? 0xf4f1ea : 0xd8433b; P.rect(x, y, 3, 5, c); P.px(x + 1, y - 1, 0x6a5a4a); });
    else if (kind === 'blommor') fill((x, y, i) => { P.vl(x + 1, y + 1, 5, 0x3a8a48); const c = [0xe85a8a, 0xf2c230, 0xd8433b, 0xf4f1ea, 0x9a6ad0][i % 5]; P.rect(x, y - 1, 3, 2, c); P.px(x + 1, y - 2, mix(c, 0xffffff, 0.4)); });
    else fill((x, y, i) => { const c = PALS.varm[i % 5]; P.rect(x, y, 5, 5, c); P.box(x, y, 5, 5, mul(c, 0.7)); });
    // korgen
    for (let y = y0; y < y0 + 14; y++) for (let x = 1; x < 31; x++) {
      const edge = x === 1 || x === 30 || y === y0 || y === y0 + 13;
      if (edge) P.px(x, y, 0x6a7078); else if ((x + y) % 3 === 0) P.px(x, y, 0x9aa0a8); else P.px(x, y, 0x3a3e46, 0.15);
    }
    P.hl(1, y0, 30, 0xc8ccd2);
    P.hl(2, y0 + 14, 28, 0x000000, 0.25);
    for (const x of [2, 28]) P.rect(x, y0 + 14, 2, 3, 0x3a3e46);
  }));
}
// långbord med varor (tallrikar/glas/krukor) och prisskylt
export function goodsTableImg(kind, price) {
  return once(`gt:${kind}:${price}`, () => spriteOf(46, 26, (P) => {
    const ty = 12;
    // varorna på bordet
    const g = GOODS[kind] || GOODS.dekor;
    g(P, 3, ty, 40, 10, 0, kind.length * 7);
    // bordsskivan + ben
    P.rect(0, ty, 46, 4, 0xe8d0a0); P.hl(0, ty, 46, 0xf4e2bc); P.hl(0, ty + 3, 46, 0xa8884e);
    for (const x of [2, 41]) { P.rect(x, ty + 4, 3, 9, 0xd8b884); P.vl(x + 2, ty + 4, 9, 0xa8884e); }
    P.hl(2, 25, 42, 0x000000, 0.2);
    miniTag(P, 30, 17, price);
  }));
}
// trappstegsställ med krukväxter
export const plantStandImg = (seed = 0) => once('pstand' + seed, () => spriteOf(40, 36, (P) => {
  for (let t = 0; t < 3; t++) {
    const y = 12 + t * 8, x0 = 2 + t * 2, w = 36 - t * 4;
    P.rect(x0, y, w, 2, 0xe8d0a0); P.hl(x0, y + 2, w, 0xa8884e);
    for (let px = x0 + 1; px + 6 < x0 + w; px += 8) {
      const pot = hash(px, t, seed + 20) > 0.5 ? 0xc4764e : 0xf4f1ea;
      P.rect(px, y - 5, 6, 5, pot); P.hl(px, y - 5, 6, mix(pot, 0xffffff, 0.3));
      const tall = 4 + ((hash(px, t, seed + 21) * 7) | 0);
      for (let i = 0; i < 14; i++) {
        const lx = px + ((hash(i, px + t, 22) * 7) | 0) - 1, ly = y - 6 - ((hash(i, px + t, 23) * tall) | 0);
        P.px(lx, ly, i % 3 ? 0x3a8a48 : 0x6aba5a);
      }
      if (hash(px, t, seed + 24) > 0.7) P.px(px + 3, y - 6 - tall, [0xe85a8a, 0xf2c230, 0xffffff][t]);
    }
  }
  P.vl(2, 12, 23, 0xa8884e); P.vl(37, 12, 23, 0xa8884e);
  P.hl(2, 35, 36, 0x000000, 0.2);
}));

// ---------- avdelningarnas väggar (målas på bakgrunden) ----------
// kind: textil | kok | ljus | vaxt | dekor – fyller [x, x+w) längs bakväggen
export function paintDeptWall(P, kind, x, w, fy, wy, seed = 0) {
  if (kind === 'textil') {
    paintWallShelf(P, x, fy, Math.min(w, 70), 42, 3, GOODS.textil, seed);
    if (w > 90) { // gardiner på stång
      const cx = x + 78, cw = Math.min(56, w - 84);
      P.hl(cx - 2, fy - 44, cw + 4, 0x3a3a44); P.px(cx - 3, fy - 44, 0x6a6a72); P.px(cx + cw + 2, fy - 44, 0x6a6a72);
      for (let i = 0; i < cw; i += 14) {
        const c = PALS.textil[(i / 14 + seed) % PALS.textil.length];
        for (let yy = fy - 43; yy < fy - 6; yy++) for (let xx = cx + i; xx < cx + i + 12; xx++) P.px(xx, yy, mul(c, (xx - cx - i) % 3 === 0 ? 0.82 : (xx - cx - i) % 3 === 1 ? 1.05 : 0.95));
      }
      const lbl = $t('GARDIN 99:-'), lw = textW(SMALL, lbl) + 4; // en lapp för hela stången
      miniTag(P, cx + Math.round((cw - lw) / 2), fy - 5, lbl);
    }
  } else if (kind === 'kok') {
    paintWallShelf(P, x, fy, Math.min(w, 110), 44, 3, GOODS.kok, seed);
    if (w > 120) { // redskapsvägg med krokar
      const rx = x + 116, rw = Math.min(40, w - 120);
      P.rect(rx, fy - 40, rw, 26, 0x9aa0a8); P.box(rx, fy - 40, rw, 26, 0x5a6068);
      for (let yy = fy - 37; yy < fy - 16; yy += 5) for (let xx = rx + 3; xx < rx + rw - 2; xx += 5) P.px(xx, yy, 0x3a3e46);
      for (let i = 0; i < rw - 6; i += 6) { const c = [0xc8a870, 0x3a3a44, 0xd8433b, 0x2c9a4c][i % 4]; P.vl(rx + 4 + i, fy - 36, 9, c); P.rect(rx + 3 + i, fy - 27, 3, 3, c); }
    }
  } else if (kind === 'ljus') {
    paintWallShelf(P, x, fy, Math.min(w, 90), 40, 3, GOODS.ljus, seed);
  } else if (kind === 'vaxt') {
    // spaljé med klätterväxter
    const tw = Math.min(w, 80);
    for (let yy = fy - 46; yy < fy - 2; yy++) for (let xx = x; xx < x + tw; xx++) {
      if ((xx - x) % 8 === 0 || (yy - fy) % 8 === 0) P.px(xx, yy, 0xe8e2d0);
      if (hash(xx >> 1, yy >> 1, 30 + seed) > 0.62) P.px(xx, yy, hash(xx, yy, 31) > 0.5 ? 0x3a8a48 : 0x5aaa5a);
    }
    for (let i = 0; i < 6; i++) { const fx = x + 6 + ((hash(i, 2, 32) * (tw - 12)) | 0), fyy = fy - 40 + ((hash(i, 3, 32) * 30) | 0); P.px(fx, fyy, 0xe85a8a); P.px(fx + 1, fyy, 0xf2a0c0); }
    if (w > 90) paintWallShelf(P, x + 86, fy, Math.min(56, w - 90), 34, 2, GOODS.vaxt, seed);
  } else if (kind === 'dekor') {
    // tavelvägg: många ramar i olika storlekar
    const gw = Math.min(w, 96);
    const frames = [[0, -46, 22, 16, 'land'], [26, -48, 14, 18, 'abstrakt'], [44, -44, 20, 14, 'stad'], [68, -46, 16, 20, 'blomma'],
      [4, -26, 14, 12, 'abstrakt'], [22, -28, 26, 14, 'land'], [52, -26, 12, 12, 'blomma'], [68, -22, 22, 12, 'stad']];
    frames.forEach(([dx, dy, fw, fh, k], i) => { if (dx + fw <= gw) paintPicture(P, x + dx, fy + dy, fw, fh, k, i + seed); });
    if (w > 110) { paintClock(P, x + gw + 8, fy - 44, 12); paintClock(P, x + gw + 24, fy - 40, 9); }
    if (w > 140) paintWallShelf(P, x + gw + 40, fy, Math.min(56, w - gw - 44), 30, 2, GOODS.dekor, seed);
  }
}
// BELYSNING: taklampor i olika former och höjder (målas på bakgrunden)
export function paintLampCeiling(P, x0, x1, yTop, seed = 0) {
  let i = 0;
  for (let x = x0 + 8; x < x1 - 6; x += 14, i++) {
    const len = 8 + ((hash(x, 1, seed + 40) * 22) | 0);
    const shades = [0xf4f1ea, 0xf2c230, 0xd8433b, 0x2c9a4c, 0x1d51a0, 0x2a2a30, 0xc8a870];
    const c = shades[(hash(x, 2, seed + 41) * shades.length) | 0];
    if (i % 3 === 2) { // klotlampa
      P.vl(x, yTop, len, 0x2a2630);
      P.ell(x + 0.5, yTop + len + 4, 8, 7, 0xfff2c8, 0.25, 4);
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (Math.hypot(xx, yy) < 3.4) P.px(x + xx, yTop + len + 3 + yy, Math.hypot(xx + 1, yy + 1) < 1.5 ? 0xffffff : 0xfff0c0);
    } else pendant(P, x, yTop, len, c);
  }
}

// ---------- lagret ----------
// Pallställ längs bakväggen: bays (fack) om bw px, tre bärbalksnivåer.
// Nedersta nivån lämnas tom (där står de klickbara kartongerna).
// avoid: [x0, x1] där ingen gångskylt får hamna (lagrets egen skylt hänger där)
export function paintRacks(P, x0, x1, fy, wy, aisleStart, bw = 40, avoid = null) {
  const base = fy + 10, levels = [base - 20, base - 38, base - 56];
  const signs = []; // gångskyltarna målas sist, så att stolparna inte täcker dem
  let bay = 0;
  for (let bx = x0; bx + bw <= x1; bx += bw, bay++) {
    const aisle = aisleStart + Math.floor(bay / 2);
    // pallar med kartonger på de övre nivåerna
    levels.slice(1).forEach((ly, li) => {
      const seed = bay * 7 + li;
      P.rect(bx + 3, ly - 2, bw - 6, 2, 0xc8a06a); P.hl(bx + 3, ly - 2, bw - 6, 0xe0bc84);
      let cx = bx + 4;
      while (cx < bx + bw - 8) {
        const cw = 9 + ((hash(cx, seed, 50) * 10) | 0), ch = 7 + ((hash(cx, seed, 51) * 8) | 0);
        if (cx + cw > bx + bw - 4) break;
        const col = hash(cx, seed, 52) > 0.85 ? 0xf4f1ea : mix(0xc49a62, 0xa87c48, hash(cx, seed, 53));
        P.rect(cx, ly - 2 - ch, cw, ch, col); P.box(cx, ly - 2 - ch, cw, ch, mul(col, 0.6)); P.hl(cx + 1, ly - 1 - ch, cw - 2, mix(col, 0xffffff, 0.2));
        if (cw > 10) { P.rect(cx + 2, ly - ch + 1, 5, 3, 0xf4f1ea); P.hl(cx + 3, ly - ch + 2, 3, 0x3a3a44); }
        cx += cw + 1;
      }
    });
    // bärbalkar (orange) med platsetiketter (ovanför nedersta balken, fria från kartongerna)
    levels.forEach((ly, li) => {
      P.rect(bx, ly, bw, 3, 0xe87a1a); P.hl(bx, ly, bw, 0xffa050); P.hl(bx, ly + 2, bw, 0xa84a0a);
      if (li === 0) { const lbl = String((bay % 2) * 10 + 1 + (bay >> 1) % 9).padStart(2, '0'); P.rect(bx + bw / 2 - 6, ly - 8, 12, 8, 0xf4f1ea); P.box(bx + bw / 2 - 6, ly - 8, 12, 8, 0x8a8478); text(P, SMALL, lbl, bx + bw / 2 - 4, ly - 7, 0x141414); }
    });
    // stolpar (blå med hål)
    for (const ux of [bx, bx + bw - 3]) {
      P.rect(ux, wy + 4, 3, base - wy - 4, 0x2c5fc0); P.vl(ux, wy + 4, base - wy - 4, 0x5a8ae0);
      for (let y = wy + 6; y < base; y += 4) P.px(ux + 1, y, 0x0c2a5c);
      P.rect(ux - 1, base - 1, 5, 2, 0x3a3e46);
    }
    // gångskylt högst upp, mitt över de två facken i gången
    if (bay % 2 === 0) signs.push([bx + bw, aisle]);
  }
  for (const [cx, aisle] of signs) {
    const t = $t`GÅNG ${aisle}`, tw =
 textW(SMALL, t) + 8, sx = Math.round(cx - tw / 2);
    if (avoid && sx + tw > avoid[0] && sx < avoid[1]) continue;
    P.rect(sx, wy + 2, tw, 9, 0xf6cf2a); P.box(sx, wy + 2, tw, 9, 0x141414);
    text(P, SMALL, t, sx + 4, wy + 4, 0x141414);
  }
  P.hl(x0, base + 1, x1 - x0, 0x000000, 0.25);
}
// gul/svart varningsrand på golvet
export function hazard(P, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P.px(x, y, ((x + y) >> 2) & 1 ? 0x1a1a20 : 0xf2c230);
}
// kartongen på nedersta nivån i ett fack (klickbar – köp)
export function cartonExhibitImg(label) {
  return once('cx:' + label, () => spriteOf(30, 18, (P) => {
    P.rect(0, 14, 30, 4, 0xc8a06a); P.hl(0, 14, 30, 0xe0bc84); for (const x of [0, 13, 27]) P.rect(x, 16, 3, 2, 0x8a6a40);
    P.rect(1, 1, 28, 13, 0xc49a62); P.box(1, 1, 28, 13, 0x7a5a30); P.hl(2, 2, 26, 0xdab47c);
    P.rect(1, 0, 28, 2, 0xb48a52);
    const t = label.slice(0, 6);
    P.rect(4, 4, 22, 7, 0xf4f1ea); text(P, SMALL, t, 15 - (textW(SMALL, t) >> 1), 5, 0x1d51a0);
  }));
}
