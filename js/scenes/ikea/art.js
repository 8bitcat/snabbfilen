// MÖBELJÄTTEN – grundpenslar: golv, väggar, skyltar, väggdekor, fasta
// inredningar i utställningsrummen, glasdörrar, gula gången, ljus, prislappar.
// Allt målas i spelets pixelkorn (heltal, skala 1) med Pix-pennan.
import { Pix, SMALL, BIG, textW, text, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import * as ROOM from '../room.js';
import { tagName, tagPrice, tagDims } from './kat.js';
import { WH, FD, PW, OW } from './geo.js';
import { $t } from '../../core/i18n.js';

export function spriteOf(w, h, paint) { const P = new Pix(w, h); paint(P); return P.flush(); }

// ================= prislappar, konturer, kartong =================
const TAGS = new Map();
export function tagImg(k, hot) {
  const key = k + (hot ? '*' : '');
  if (TAGS.has(key)) return TAGS.get(key);
  const name = tagName(k), price = tagPrice(k);
  const { w, h } = tagDims(k);
  const P = new Pix(w, h + 1);
  const edge = hot ? 0xffffff : 0x7a5a0c, fill = hot ? 0xffe45c : 0xf5cd2e, hi = hot ? 0xfff6c0 : 0xfbe27a;
  P.rect(1, 0, w - 2, h, edge); P.rect(0, 1, w, h - 2, edge);
  P.rect(1, 1, w - 2, h - 2, fill);
  P.hl(1, 1, w - 2, hi);
  P.hl(1, 7, w - 2, mix(fill, 0x7a5a0c, 0.18));
  P.hl(1, h, w - 2, 0x1a1020, 0.3);
  text(P, SMALL, name, Math.floor((w - textW(SMALL, name)) / 2), 2, 0x17336e);
  text(P, SMALL, price, Math.floor((w - textW(SMALL, price)) / 2), 8, 0x141414);
  const img = P.flush();
  TAGS.set(key, img);
  return img;
}
// liten prislapp för småsaker (målas direkt på bakgrunden)
export function miniTag(P, x, y, label, col = 0xf5cd2e) {
  const w = textW(SMALL, label) + 4;
  P.rect(x, y, w, 7, col); P.box(x, y, w, 7, mul(col, 0.55));
  text(P, SMALL, label, x + 2, y + 1, 0x141414);
  return w;
}
// möbelns kontur (1 px runt siluetten) – när man står nära eller pekar
const OUTLINES = new Map();
export function outlineImg(e, col) {
  const key = `${e.k}${e.v}|${e.c || ''}|${col}`;
  if (OUTLINES.has(key)) return OUTLINES.get(key);
  const art = ROOM.furnArt?.(e.k, e.v, e.c);
  if (!art) return null;
  const w = art.sw + 2, h = art.sh + 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, 1, 1, art.sw, art.sh);
  let d;
  try { d = x.getImageData(0, 0, w, h).data; } catch { OUTLINES.set(key, null); return null; }
  const out = x.createImageData(w, h), o = out.data;
  const r = (col >> 16) & 255, gg = (col >> 8) & 255, b = col & 255;
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 40;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (solid(i, j)) continue;
    if (!(solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) continue;
    const q = (j * w + i) * 4;
    o[q] = r; o[q + 1] = gg; o[q + 2] = b; o[q + 3] = 255;
  }
  x.clearRect(0, 0, w, h);
  x.putImageData(out, 0, 0);
  OUTLINES.set(key, c);
  return c;
}
// platt kartong för möbler som saknar sprite i atlasen
let BOX = null;
export function boxImg() {
  if (BOX) return BOX;
  BOX = spriteOf(24, 18, (P) => {
    P.rect(0, 2, 24, 16, 0xc49a62); P.rect(0, 0, 24, 3, 0xd8b27a);
    P.box(0, 0, 24, 18, 0x6e5230);
    P.vl(15, 0, 18, 0xe6d6aa); P.vl(16, 0, 18, 0xd2c296);
    text(P, SMALL, $t('NY'), 3, 8, 0x1f58a8);

  });
  return BOX;
}

// ================= golv =================
export function storeFloorPx(x, y) {
  const tx = Math.floor(x / 40), ty = Math.floor(y / 26), lx = x - tx * 40, ly = y - ty * 26;
  let c = mix(0xdcd8cd, 0xd0cabf, hash(tx, ty, 71) * 0.6);
  const n = hash(x, y, 72);
  if (n > 0.965) c = mul(c, 0.94); else if (n < 0.025) c = mix(c, 0xffffff, 0.3);
  if (lx === 0 || ly === 0) c = mul(c, 0.9);
  else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.2);
  return c;
}
export function floorPx(kind, lx, ly, x, y) {
  switch (kind) {
    case 'ek': case 'ljus': {
      const [a, b] = kind === 'ek' ? [0xca9d63, 0xad8050] : [0xe2cca4, 0xccb187];
      const row = (ly / 5) | 0, py = ly % 5;
      const off = (hash(row, 3, 31) * 34) | 0;
      const col = ((lx + off) / 34) | 0, px = (lx + off) % 34;
      let c = mix(a, b, hash(col, row, 32) * 0.8);
      if (hash(x >> 1, y, 33) > 0.9) c = mul(c, 0.93);
      if (py === 4) c = mul(c, 0.8); else if (py === 0) c = mix(c, 0xffffff, 0.12);
      if (px === 0) c = mul(c, 0.82);
      return c;
    }
    case 'schack': {
      const tx = (lx / 11) | 0, ty = (ly / 8) | 0, px = lx % 11, py = ly % 8;
      let c = (tx + ty) & 1 ? 0x464a58 : 0xebe7de;
      if (px === 0 || py === 0) c = mix(c, 0x9a968e, 0.55);
      else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.15);
      if (hash(x, y, 34) > 0.975) c = mix(c, 0xffffff, 0.25);
      return c;
    }
    case 'mosaik': {
      const tx = (lx / 5) | 0, ty = (ly / 4) | 0, px = lx % 5, py = ly % 4;
      let c = mix(0xe8eeee, 0xcad6d8, hash(tx, ty, 35));
      if (hash(tx, ty, 36) > 0.9) c = 0x86b8c0;
      if (px === 0 || py === 0) c = 0xa9b6b8;
      return c;
    }
    case 'filt': {
      let c = mix(0x80858f, 0x70757f, hash(x, y, 37));
      if (((x + y) & 3) === 0) c = mul(c, 0.95);
      return c;
    }
    case 'blamatta': {
      let c = mix(0xa6cbe8, 0x96bedd, hash(x, y, 38));
      const cx = lx % 16, cy = ly % 12;
      if ((cx === 8 && cy === 6) || (cx === 0 && cy === 0)) c = 0xf4f1ea;
      return c;
    }
    case 'sten': {
      const row = (ly / 12) | 0, off = (row & 1) * 9;
      const tx = ((lx + off) / 18) | 0, px = (lx + off) % 18, py = ly % 12;
      let c = mix(0x7a756f, 0x66615c, hash(tx, row, 39));
      if (hash(x, y, 40) > 0.93) c = mix(c, 0xffffff, 0.12);
      if (px === 0 || py === 0) c = 0x4a4642; else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.12);
      return c;
    }
    case 'terrakotta': {
      const tx = (lx / 10) | 0, ty = (ly / 8) | 0, px = lx % 10, py = ly % 8;
      let c = mix(0xc4764e, 0xac623e, hash(tx, ty, 41));
      if (px === 0 || py === 0) c = 0xe2d4bc; else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.12);
      return c;
    }
    case 'betong': { // lagrets slipade betong med fläckar och fogar
      let c = mix(0xb4b2ac, 0xa6a39c, hash(x >> 3, y >> 2, 42) * 0.7 + (bayer(x, y) - 0.5) * 0.12);
      const n = hash(x, y, 43);
      if (n > 0.975) c = mul(c, 0.9); else if (n < 0.02) c = mix(c, 0xffffff, 0.2);
      if (hash(x >> 4, y >> 3, 44) > 0.93) c = mul(c, 0.96); // oljefläck
      if (lx % 64 === 0 || ly % 46 === 0) c = mul(c, 0.86);
      return c;
    }
    case 'vinyl': { // marknadshallens ljusa vinylplattor
      const tx = (lx / 20) | 0, ty = (ly / 14) | 0, px = lx % 20, py = ly % 14;
      let c = mix(0xe6e2d8, 0xdad5c8, hash(tx, ty, 45) * 0.7);
      if (hash(x, y, 46) > 0.97) c = mul(c, 0.95);
      if (px === 0 || py === 0) c = mul(c, 0.92);
      return c;
    }
    case 'entre': case 'sten2': { // hallarnas stora ljusa stenplattor (entre: kallare, sten2: varmare)
      const tw = 34, th = 20, row = (ly / th) | 0, off = (row & 1) * 17;
      const tx = ((lx + off) / tw) | 0, px = (lx + off) % tw, py = ly % th;
      const [a, b] = kind === 'entre' ? [0xd6d4ce, 0xc6c3bb] : [0xe0d6c4, 0xd0c4ae];
      let c = mix(a, b, hash(tx, row, 49) * 0.7);
      const n = hash(x, y, 50);
      if (n > 0.97) c = mul(c, 0.94); else if (n < 0.03) c = mix(c, 0xffffff, 0.25);
      if (px === 0 || py === 0) c = mul(c, 0.86); else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.22);
      return c;
    }
    case 'parkett': { // restaurangens fiskbensparkett
      const u = (lx + ly) % 24, v = (lx - ly + 999) % 24, band = ((lx + ly) / 24 | 0) + ((lx - ly + 999) / 24 | 0);
      let c = mix(0xc8965c, 0xb07a44, hash(band, (lx / 12) | 0, 47) * 0.8);
      if (u === 0 || v === 0) c = mul(c, 0.8);
      if (hash(x >> 1, y, 48) > 0.92) c = mul(c, 0.94);
      return c;
    }
    default: return storeFloorPx(x, y);
  }
}
export function paintFloor(P, x0, y0, x1, y1, kind) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) P.px(x, y, floorPx(kind, x - x0, y - y0, x, y));
}

// ================= väggar =================
export function wallPx(st, lx, ry, fb, x, y) {
  let c = st.wall;
  switch (st.paper) {
    case 'rand': if (lx % 12 < 6) c = mix(c, 0xffffff, 0.07); if (lx % 12 === 0) c = mul(c, 0.95); break;
    case 'prick': if ((lx % 8 === 2 && ry % 8 === 3) || (lx % 8 === 6 && ry % 8 === 7)) c = mix(c, 0xffffff, 0.35); break;
    case 'kakel': {
      const row = (ry / 6) | 0, tx = (lx + (row & 1) * 4) % 8, ty = ry % 6;
      if (tx === 0 || ty === 0) c = mul(c, 0.85);
      else if (tx === 1 || ty === 1) c = mix(c, 0xffffff, 0.32);
      else if (hash(((lx + (row & 1) * 4) / 8) | 0, row, 5) > 0.82) c = mul(c, 0.97);
      break;
    }
    case 'slat': if (lx % 6 === 0) c = mul(c, 0.88); else if (lx % 6 === 1) c = mix(c, 0xffffff, 0.08); break;
    case 'stjarna': {
      const cx = lx % 14, cy = ry % 12, cell = hash((lx / 14) | 0, (ry / 12) | 0, 9);
      if (cell > 0.45 && ((cx === 7 && cy >= 5 && cy <= 7) || (cy === 6 && cx >= 6 && cx <= 8))) c = cell > 0.75 ? 0xffffff : 0xfff3b8;
      break;
    }
    case 'trapanel': { const px = lx % 9; if (px === 0) c = mul(c, 0.78); else if (px === 1) c = mix(c, 0xffffff, 0.12); else c = mix(c, mul(c, 0.9), hash(lx / 9 | 0, ry >> 3, 6)); break; }
    case 'butik': if (ry < 6) c = 0x1f58a8; else if (ry < 8) c = 0xf2c230; else if (ry === 8) c = mul(st.wall, 0.9); break;
    case 'plat': { // lagrets korrugerade plåtvägg
      const px = lx % 8;
      if (px === 0) c = mul(c, 0.8); else if (px === 1 || px === 2) c = mix(c, 0xffffff, 0.12); else if (px === 6) c = mul(c, 0.92);
      if (ry < 5) c = ry < 3 ? 0xf2c230 : 0x1f58a8;
      break;
    }
    case 'betongvagg': {
      c = mix(c, mul(c, 0.92), hash(lx >> 2, ry >> 2, 8) * 0.8);
      if (lx % 48 === 0 || ry % 20 === 0) c = mul(c, 0.9);
      break;
    }
    default: break;
  }
  c = mix(mul(c, 0.86), c, Math.min(1, ry / 14) + (bayer(x, y) - 0.5) * 0.1);
  if (st.wains && fb < st.wains && fb >= 3) {
    const by = st.wains - 1 - fb, bx = lx % 22;
    let w = st.trim;
    if (st.paper === 'panel') { if (lx % 5 === 0) w = mul(w, 0.84); else if (lx % 5 === 1) w = mix(w, 0xffffff, 0.12); }
    else if (bx === 2 || by === 2) w = mix(w, 0xffffff, 0.14); else if (bx === 20 || fb === 4) w = mul(w, 0.82);
    if (by === 0) w = mul(w, 0.68); else if (by === 1) w = mix(w, 0xffffff, 0.25);
    c = mix(w, mul(w, 0.92), (bayer(x, y) - 0.5) * 0.3 + 0.2);
  }
  if (fb < 3) c = fb === 2 ? 0xf4f1ea : fb === 1 ? 0xdcd6ca : 0x8e887c;
  return c;
}
export function paintWall(P, x0, x1, yTop, yBot, st) {
  for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) P.px(x, y, wallPx(st, x - x0, y - yTop, yBot - 1 - y, x, y));
}
export function wallCap(P, x0, x1, y) {
  P.hl(x0, y - 3, x1 - x0, 0x2a2630); P.hl(x0, y - 2, x1 - x0, 0xe8e4dc); P.hl(x0, y - 1, x1 - x0, 0xc8c2b8);
}
export function floorAO(P, x0, x1, fy) {
  for (let y = fy; y < fy + 5; y++) for (let x = x0; x < x1; x++) if (bayer(x, y) < 1 - (y - fy) / 5) P.px(x, y, 0x1a1426, 0.2);
}

// ================= skyltar =================
// rumsskylt som hänger i två vajrar framför väggen (med skugga på väggen)
export function roomSign(P, cx, y, num, name, { wire = 5, bg = 0x1d51a0, fg = 0xf6d02f } = {}) {
  const nw = num ? textW(SMALL, String(num)) + 6 : 0;
  const tw = textW(SMALL, name), w = nw + tw + 10, x = Math.round(cx - w / 2);
  const sy = y + wire;
  P.rect(x + 3, sy + 4, w, 11, 0x000000, 0.16); // skuggan på väggen bakom
  if (wire > 0) { P.vl(x + 3, y, wire, 0x2a2630); P.vl(x + w - 4, y, wire, 0x2a2630); P.px(x + 3, y, 0x8a8478); P.px(x + w - 4, y, 0x8a8478); }
  P.rect(x, sy, w, 11, bg); P.box(x, sy, w, 11, mul(bg, 0.45)); P.hl(x + 1, sy + 1, w - 2, mix(bg, 0xffffff, 0.22));
  if (num) { P.rect(x + 1, sy + 1, nw, 9, 0xf6cf2a); P.vl(x + nw + 1, sy + 1, 9, mul(bg, 0.45)); text(P, SMALL, String(num), x + 4, sy + 3, 0x0c2a5c); }
  text(P, SMALL, name, x + nw + 5, sy + 3, fg);
  return { x, y: sy, w, h: 11 };
}
export function exitSign(P, cx, y, label, arrow = 'R') {
  const tw = textW(SMALL, label), w = tw + 16, x = Math.round(cx - w / 2);
  P.ell(cx, y + 5, w * 0.8, 10, 0x9fffc0, 0.12, 4);
  P.rect(x, y, w, 11, 0x169a4a); P.box(x, y, w, 11, 0x0a5a28); P.hl(x + 1, y + 1, w - 2, 0x4fd080);
  text(P, SMALL, label, x + 4, y + 3, 0xffffff);
  arrowGlyph(P, x + w - 7, y + 5, arrow, 0xffffff);
}
// liten pil (5×5) med mitten i (cx, cy)
export function arrowGlyph(P, cx, cy, dir, c) {
  const pts = { R: [[-2, 0], [-1, 0], [0, 0], [1, 0], [0, -1], [0, 1], [-1, -2], [-1, 2]],
    L: [[2, 0], [1, 0], [0, 0], [-1, 0], [0, -1], [0, 1], [1, -2], [1, 2]],
    U: [[0, 2], [0, 1], [0, 0], [0, -1], [-1, 0], [1, 0], [-2, 1], [2, 1]],
    D: [[0, -2], [0, -1], [0, 0], [0, 1], [-1, 0], [1, 0], [-2, -1], [2, -1]] }[dir] || [];
  for (const [dx, dy] of pts) P.px(cx + dx, cy + dy, c);
}
export function bigSign(P, cx, y, label) {
  const tw = textW(BIG, label, 2), w = tw + 18, h = 26, x = Math.round(cx - w / 2);
  P.rect(x + 2, y + h, w, 2, 0x000000, 0.3);
  P.rect(x, y, w, h, 0xf6cf2a); P.box(x, y, w, h, 0x9a7a10); P.hl(x + 1, y + 1, w - 2, 0xfff08a); P.hl(x + 1, y + h - 2, w - 2, 0xd8ae18);
  text(P, BIG, label, x + 10, y + 9, 0x0c2a5c, 1, 2);
  text(P, BIG, label, x + 9, y + 8, 0x1d51a0, 1, 2);
}
// planskylt: gul ruta med stor siffra + blå etikett ("2  UTSTÄLLNING")
export function planBadge(P, x, y, n, label, arrow = null) {
  P.rect(x + 2, y + 2, 20, 22, 0x000000, 0.2);
  P.rect(x, y, 20, 22, 0xf6cf2a); P.box(x, y, 20, 22, 0x9a7a10); P.hl(x + 1, y + 1, 18, 0xfff08a);
  text(P, BIG, String(n), x + 6, y + 5, 0x1d51a0, 1, 2);
  if (!label) return;
  const tw = textW(SMALL, label), w = tw + 10 + (arrow ? 8 : 0);
  P.rect(x + 20, y + 5, w, 12, 0x1d51a0); P.box(x + 20, y + 5, w, 12, 0x0c2a5c); P.hl(x + 21, y + 6, w - 2, 0x3f76c8);
  text(P, SMALL, label, x + 25, y + 9, 0xf6d02f);
  if (arrow) arrowGlyph(P, x + 20 + w - 6, y + 11, arrow, 0xffffff);
}

// ================= väggdekor =================
export function paintWindow(P, x, y, w, h, curtain) {
  P.rect(x - 2, y - 2, w + 4, h + 4, 0xf4f1ea); P.box(x - 2, y - 2, w + 4, h + 4, 0x7a746a);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    let c = mix(0x86c8ea, 0xd2eef8, (yy - y) / h + (bayer(xx, yy) - 0.5) * 0.08);
    if (hash(xx >> 2, yy >> 1, 11) > 0.9 && yy < y + h * 0.6) c = mix(c, 0xffffff, 0.55);
    const hill = y + h * 0.72 + Math.sin(xx * 0.35) * 1.6 + Math.sin(xx * 0.11) * 1.5;
    if (yy > hill) c = mix(0x5f9a5a, 0x4a8048, hash(xx, yy, 3) * 0.8);
    P.px(xx, yy, c);
  }
  P.rect(x, y + Math.round(h * 0.42), w, 1, 0xf4f1ea);
  P.rect(x + (w >> 1), y, 1, h, 0xf4f1ea);
  for (let i = 0; i < 5; i++) P.px(x + 3 + i, y + 2 + i, 0xffffff, 0.5);
  P.rect(x - 3, y + h + 2, w + 6, 2, 0xffffff); P.hl(x - 3, y + h + 4, w + 6, 0x000000, 0.18);
  if (curtain) {
    P.hl(x - 7, y - 5, w + 14, 0x5a4a3a);
    for (const sx of [x - 7, x + w + 2]) for (let yy = y - 4; yy < y + h + 5; yy++) for (let xx = sx; xx < sx + 5; xx++) {
      const f = (xx - sx) % 2 ? 0.86 : 1.04;
      P.px(xx, yy, mul(curtain, f));
    }
  }
}
export function paintPicture(P, x, y, w, h, kind, seed = 0) {
  const frame = [0x3a2a1c, 0x1e1e24, 0xc8a24a][seed % 3];
  P.rect(x, y, w, h, frame); P.box(x, y, w, h, mul(frame, 0.6));
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  P.rect(ix - 1, iy - 1, iw + 2, ih + 2, 0xf4f1ea);
  if (kind === 'land') {
    for (let yy = 0; yy < ih; yy++) for (let xx = 0; xx < iw; xx++) {
      let c = mix(0x9fd4ee, 0xf4e2b0, yy / ih);
      if (yy > ih * 0.55 + Math.sin((xx + seed) * 0.5) * 2) c = mix(0x6aa860, 0x4a8a48, yy / ih);
      P.px(ix + xx, iy + yy, c);
    }
    P.rect(ix + iw - 6, iy + 2, 3, 3, 0xffe070);
  } else if (kind === 'abstrakt') {
    P.rect(ix, iy, iw, ih, 0xf2ede2);
    P.rect(ix + 1, iy + 1, iw >> 1, ih >> 1, 0xd8433b);
    P.rect(ix + (iw >> 1), iy + (ih >> 1) - 1, (iw >> 1) - 1, (ih >> 1), 0x2c5fc0);
    P.rect(ix + 2, iy + ih - 3, iw >> 2, 2, 0xf2c230);
  } else if (kind === 'blomma') {
    P.rect(ix, iy, iw, ih, 0xeae4f0);
    const cx = ix + (iw >> 1);
    P.rect(cx - 2, iy + ih - 5, 5, 5, 0x5a7ab0);
    P.vl(cx, iy + 4, ih - 9, 0x3a8a48);
    for (const [dx, dy, c] of [[-3, 3, 0xe85a8a], [3, 4, 0xf2c230], [0, 1, 0xd8433b], [-2, 6, 0x9a6ad0], [3, 8, 0xe85a8a]]) { P.px(cx + dx, iy + dy, c); P.px(cx + dx + 1, iy + dy, c); P.px(cx + dx, iy + dy + 1, mul(c, 0.8)); }
  } else if (kind === 'stad') {
    for (let yy = 0; yy < ih; yy++) for (let xx = 0; xx < iw; xx++) P.px(ix + xx, iy + yy, mix(0xf2b27a, 0x7a5aa8, yy / ih));
    for (let xx = 0; xx < iw; xx += 3) { const bh = 2 + ((hash(xx, seed, 64) * ih * 0.6) | 0); P.rect(ix + xx, iy + ih - bh, 2, bh, 0x2a2440); }
  }
  P.hl(x + 1, y + h, w, 0x000000, 0.2); P.vl(x + w, y + 1, h, 0x000000, 0.2);
}
export function paintPoster(P, x, y, w, h) {
  P.rect(x, y, w, h, 0x243a78); P.box(x, y, w, h, 0xf4f1ea);
  for (let i = 0; i < 9; i++) P.px(x + 2 + ((hash(i, 1, 60) * (w - 4)) | 0), y + 2 + ((hash(i, 2, 60) * (h - 4)) | 0), 0xfff3b8);
  const cx = x + (w >> 1);
  P.rect(cx - 2, y + 5, 5, 9, 0xe8e8ec); P.rect(cx - 1, y + 3, 3, 2, 0xd8433b); P.px(cx, y + 2, 0xd8433b);
  P.px(cx, y + 8, 0x4aa8e8);
  P.rect(cx - 4, y + 11, 2, 4, 0xd8433b); P.rect(cx + 3, y + 11, 2, 4, 0xd8433b);
  P.rect(cx - 1, y + 14, 3, 2, 0xf2a030); P.px(cx, y + 16, 0xf2c230);
  P.hl(x + 1, y + h, w, 0x000000, 0.2);
}
export function paintClock(P, x, y, s) {
  const r = s / 2, cx = x + r, cy = y + r;
  for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
    const d = Math.hypot(xx + 0.5 - r, yy + 0.5 - r);
    if (d < r) P.px(x + xx, y + yy, d > r - 1.3 ? 0x2a2a32 : 0xfafaf6);
  }
  P.vl(Math.floor(cx), Math.floor(cy) - 3, 3, 0x1a1a20); P.hl(Math.floor(cx), Math.floor(cy), 3, 0x1a1a20);
  P.px(Math.floor(cx), y + 1, 0x1a1a20); P.px(x + 1, Math.floor(cy), 0x1a1a20); P.px(x + s - 2, Math.floor(cy), 0x1a1a20); P.px(Math.floor(cx), y + s - 2, 0x1a1a20);
}
export function paintCork(P, x, y, w, h) {
  P.rect(x, y, w, h, 0x8a6440); P.rect(x + 1, y + 1, w - 2, h - 2, 0xc89a62);
  for (let yy = y + 1; yy < y + h - 1; yy++) for (let xx = x + 1; xx < x + w - 1; xx++) if (hash(xx, yy, 61) > 0.8) P.px(xx, yy, 0xb0824e);
  const notes = [[3, 3, 0xfff08a], [12, 5, 0xffffff], [22, 2, 0x9fe0ff], [30, 6, 0xffb8d0], [6, 12, 0xffffff], [18, 13, 0xfff08a]];
  for (const [nx, ny, c] of notes) {
    if (nx + 8 > w - 1 || ny + 7 > h - 1) continue;
    P.rect(x + nx, y + ny, 7, 6, c); P.hl(x + nx + 1, y + ny + 2, 5, 0x9a9aa2); P.hl(x + nx + 1, y + ny + 4, 3, 0x9a9aa2);
    P.px(x + nx + 3, y + ny, 0xd8433b);
  }
  P.hl(x + 1, y + h, w, 0x000000, 0.2);
}
export function paintTowels(P, x, y, w) {
  P.hl(x, y, w, 0xc8ccd2); P.px(x, y + 1, 0x8a9098); P.px(x + w - 1, y + 1, 0x8a9098);
  P.rect(x + 1, y + 1, 6, 12, 0xf4f1ea); P.hl(x + 1, y + 10, 6, 0x6fb8c2); P.vl(x + 6, y + 1, 12, 0xd2cec4);
  P.rect(x + 8, y + 1, 6, 10, 0xe8a0b8); P.hl(x + 8, y + 8, 6, 0xffffff); P.vl(x + 13, y + 1, 10, 0xc8809a);
}
export function paintDeco(P, d, bx, fy) {
  const [kind, dx, dy, w, h, extra] = d;
  const x = bx + dx, y = fy + dy;
  if (kind === 'fonster') return; // målas i ett eget pass (efter tapeten)
  if (kind === 'tavla') paintPicture(P, x, y, w, h, extra || 'land', (dx + dy) & 3);
  else if (kind === 'affisch') paintPoster(P, x, y, w, h);
  else if (kind === 'klocka') paintClock(P, x, y, w);
  else if (kind === 'anslag') paintCork(P, x, y, w, h);
  else if (kind === 'handdukar') paintTowels(P, x, y, w);
}
// taklampa (pendel) som hänger från takkanten – målas på bakgrunden
export function pendant(P, x, yTop, len, shade = 0xf2efe8, glow = true) {
  P.vl(x, yTop, len, 0x2a2630);
  const y = yTop + len;
  if (glow) P.ell(x + 0.5, y + 8, 10, 7, 0xfff2c8, 0.22, 4);
  P.rect(x - 1, y, 3, 1, mul(shade, 0.6));
  P.rect(x - 3, y + 1, 7, 2, shade); P.px(x - 3, y + 1, mix(shade, 0xffffff, 0.4));
  P.rect(x - 4, y + 3, 9, 1, mul(shade, 0.8));
  P.px(x, y + 4, 0xfff6d0); P.px(x - 1, y + 4, 0xffe8a0); P.px(x + 1, y + 4, 0xffe8a0);
}

// ================= fasta inredningar i utställningsrummen =================
export function paintKitchen(P, x, fy, w) {
  const uy = fy - 42, uh = 14;
  P.rect(x, uy, w, uh, 0xf2f0ea); P.box(x, uy, w, uh, 0x8e8a84);
  for (let dx = 16; dx < w; dx += 16) P.vl(x + dx, uy + 1, uh - 2, 0xb0aca4);
  for (let dx = 0; dx < w; dx += 16) P.rect(x + dx + 7, uy + uh - 4, 3, 1, 0x5a5a62);
  P.hl(x, uy + uh, w, 0x000000, 0.18);
  const sx = x + 44;
  P.rect(sx - 1, uy + uh, 22, 4, 0xb8bcc2); P.hl(sx - 1, uy + uh + 3, 22, 0x6e7278); P.hl(sx - 1, uy + uh, 22, 0xd8dce2);
  P.rect(x - 1, fy - 17, w + 2, 3, 0x4a4a54); P.hl(x - 1, fy - 17, w + 2, 0x70707c);
  P.rect(x, fy - 14, w, 18, 0x6f8ea4);
  for (let dx = 16; dx < w; dx += 16) P.vl(x + dx, fy - 14, 18, 0x4a6478);
  for (let dx = 0; dx < w; dx += 16) if (!(dx >= 44 && dx < 64)) P.hl(x + dx + 6, fy - 11, 4, 0xdce0e4);
  P.hl(x, fy - 14, w, 0x8fb0c4);
  P.rect(x, fy + 4, w, 2, 0x2a2a30);
  P.box(x - 1, fy - 14, w + 2, 20, 0x34475a);
  P.rect(x + 10, fy - 17, 16, 2, 0x9aa0a8); P.hl(x + 11, fy - 16, 14, 0x6e747c);
  P.vl(x + 18, fy - 23, 6, 0xc8ccd2); P.hl(x + 18, fy - 23, 4, 0xc8ccd2); P.px(x + 21, fy - 22, 0xa0a4aa);
  P.hl(sx + 2, fy - 17, 6, 0x16161a); P.hl(sx + 12, fy - 17, 6, 0x16161a); P.hl(sx + 3, fy - 16, 4, 0x2e2e34); P.hl(sx + 13, fy - 16, 4, 0x2e2e34);
  P.rect(sx + 1, fy - 13, 18, 14, 0x2c2e34); P.box(sx + 1, fy - 13, 18, 14, 0x16161a);
  P.rect(sx + 4, fy - 9, 12, 6, 0x5a3a24); P.hl(sx + 4, fy - 9, 12, 0x8a5a30);
  P.hl(sx + 3, fy - 12, 14, 0xc8ccd2);
  P.rect(x + 30, fy - 19, 9, 2, 0xc89a5a); P.hl(x + 30, fy - 19, 9, 0xe0b878);
  P.rect(x + 68, fy - 21, 3, 4, 0xe8d8b0); P.rect(x + 72, fy - 22, 3, 5, 0xd8433b); P.rect(x + 76, fy - 20, 2, 3, 0x3a8a48);
  P.rect(x + 3, fy - 23, 5, 6, 0x3a8a48); P.rect(x + 3, fy - 21, 5, 4, 0xc49a62);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
export function paintBathtub(P, x, fy, w) {
  P.vl(x + w - 6, fy - 46, 30, 0xc8ccd2); P.rect(x + w - 9, fy - 47, 7, 2, 0xb4b8be);
  P.hl(x, fy - 48, w, 0x9aa0a8);
  for (let yy = fy - 47; yy < fy - 15; yy++) for (let xx = x + 1; xx < x + 11; xx++) P.px(xx, yy, (xx - x) % 3 === 0 ? 0x5a9aa2 : (xx - x) % 3 === 1 ? 0xf4f6f6 : 0xd4e8ea);
  P.rect(x, fy - 15, w, 6, 0xf6f6f2); P.rect(x + 3, fy - 14, w - 6, 3, 0x9ad4e4); P.hl(x + 3, fy - 14, w - 6, 0xc8ecf4);
  for (let yy = fy - 9; yy < fy + 6; yy++) P.hl(x, yy, w, mix(0xf0f0ec, 0xc8ccd0, (yy - fy + 9) / 15));
  P.box(x, fy - 15, w, 21, 0x8a969a); P.hl(x + 1, fy - 9, w - 2, 0xd8dcde);
  P.rect(x + w - 14, fy - 20, 6, 2, 0xc8ccd2); P.vl(x + w - 12, fy - 18, 3, 0xc8ccd2);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
export function paintToilet(P, x, fy) {
  P.rect(x + 2, fy - 25, 14, 11, 0xf6f6f2); P.box(x + 2, fy - 25, 14, 11, 0x8a969a); P.rect(x + 7, fy - 24, 4, 2, 0xc8ccd2);
  for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 16; xx++) {
    const t = Math.hypot((xx - 7.5) / 8, (yy - 2.5) / 3);
    if (t < 1) P.px(x + 1 + xx, fy - 14 + yy, t > 0.78 ? 0x9aa4a8 : yy < 2 ? 0xffffff : 0xeef0f0);
  }
  P.rect(x + 4, fy - 8, 10, 12, 0xeeeeea); P.box(x + 4, fy - 8, 10, 12, 0x8a969a); P.vl(x + 12, fy - 7, 10, 0xc8ccd0);
  P.hl(x + 3, fy + 4, 12, 0x000000, 0.2);
}
export function paintSink(P, x, fy, w) {
  P.rect(x, fy - 12, w, 18, 0xa8784a); P.box(x, fy - 12, w, 18, 0x5a3a20);
  P.vl(x + (w >> 1), fy - 11, 16, 0x6a4628); P.hl(x + 4, fy - 6, 5, 0xe0c090); P.hl(x + w - 9, fy - 6, 5, 0xe0c090);
  P.rect(x - 1, fy - 15, w + 2, 3, 0xf6f6f2); P.rect(x + 5, fy - 15, w - 10, 2, 0xc8dce0);
  P.vl(x + (w >> 1), fy - 20, 5, 0xc8ccd2); P.hl(x + (w >> 1), fy - 20, 3, 0xc8ccd2);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
export function paintHomeDoor(P, x, fy, w) {
  P.rect(x - 2, fy - 48, w + 4, 48, 0xf4f1ea); P.box(x - 2, fy - 48, w + 4, 48, 0x8a8478);
  for (let yy = fy - 46; yy < fy; yy++) for (let xx = x; xx < x + w; xx++) {
    let c = mix(0x6a4630, 0x7a5436, hash(xx >> 1, yy >> 2, 7) * 0.5 + (bayer(xx, yy) - 0.5) * 0.1);
    const lx = xx - x, ly = yy - (fy - 46);
    if ((lx === 3 || lx === w - 4) && ly > 14 && ly < 42) c = mul(c, 0.72);
    if ((ly === 14 || ly === 42) && lx > 3 && lx < w - 4) c = mul(c, 0.72);
    P.px(xx, yy, c);
  }
  P.rect(x + 6, fy - 43, w - 12, 8, 0xbfe4f4); P.box(x + 6, fy - 43, w - 12, 8, 0x3a2a1c); P.hl(x + 7, fy - 42, 4, 0xffffff);
  P.rect(x + w - 6, fy - 24, 3, 2, 0xd8b24a);
  P.rect(x + (w >> 1) - 4, fy - 32, 9, 5, 0xf4f1ea); text(P, SMALL, '12', x + (w >> 1) - 3, fy - 32, 0x1a1a20);
  P.rect(x - 1, fy + 1, w + 2, 7, 0x5e4c38); P.box(x - 1, fy + 1, w + 2, 7, 0x3a2e22);
  for (let xx = x + 1; xx < x + w; xx += 2) P.px(xx, fy + 4, 0x7a664e);
}
export function paintCoatRack(P, x, fy, w) {
  P.rect(x, fy - 47, w, 2, 0x8a5a30); P.hl(x, fy - 45, w, 0x000000, 0.2);
  const coats = [[x + 1, 0xb83a3a], [x + 8, 0x2a3e6a], [x + 15, 0xc8a878]];
  for (const [cx, col] of coats) {
    P.px(cx + 3, fy - 44, 0x3a3a40);
    for (let yy = 0; yy < 22; yy++) { const hw = Math.min(3, 1 + (yy >> 2)); P.hl(cx + 3 - hw, fy - 43 + yy, hw * 2 + 1, yy === 0 ? mul(col, 0.8) : (yy & 3) === 3 ? mul(col, 0.85) : col); }
    P.vl(cx + 3, fy - 40, 18, mul(col, 0.7));
  }
  P.rect(x - 1, fy - 10, w + 2, 3, 0xb07a48); P.hl(x - 1, fy - 10, w + 2, 0xd09a60);
  P.vl(x, fy - 7, 12, 0x6a4628); P.vl(x + w - 1, fy - 7, 12, 0x6a4628);
  P.rect(x + 3, fy + 1, 5, 3, 0x2a2a30); P.rect(x + 10, fy + 1, 5, 3, 0xc8433b); P.rect(x + 16, fy + 1, 4, 3, 0xf4f1ea);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
export function paintToys(P, x, y) {
  const block = (bx, by, c) => { P.rect(bx, by, 6, 6, c); P.box(bx, by, 6, 6, mul(c, 0.6)); P.hl(bx + 1, by + 1, 4, mix(c, 0xffffff, 0.35)); };
  block(x, y + 8, 0xd8433b); block(x + 7, y + 8, 0x2c5fc0); block(x + 3, y + 2, 0xf2c230);
  const tx = x + 18, ty = y + 2;
  P.rect(tx, ty + 5, 9, 9, 0x9a6232); P.rect(tx + 1, ty, 7, 6, 0xa86e3a);
  P.px(tx, ty, 0x7a4a26); P.px(tx + 8, ty, 0x7a4a26);
  P.px(tx + 2, ty + 2, 0x1a1a20); P.px(tx + 6, ty + 2, 0x1a1a20); P.rect(tx + 3, ty + 3, 3, 2, 0xe0b890); P.px(tx + 4, ty + 3, 0x1a1a20);
  P.rect(tx + 2, ty + 8, 5, 4, 0xc08850);
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 7; xx++) {
    const d = Math.hypot(xx - 3, yy - 3);
    if (d < 3.5) P.px(x + 31 + xx, y + 7 + yy, yy === 3 ? 0xffffff : d > 2.6 ? 0xa82a2a : 0xe8433b);
  }
  P.ell(x + 20, y + 15, 20, 3, 0x140c1c, 0.18, 3);
}
export function paintFix(P, f, bx, fy) {
  const [kind, dx, w] = f, x = bx + dx;
  if (kind === 'kokbank') paintKitchen(P, x, fy, w);
  else if (kind === 'badkar') paintBathtub(P, x, fy, w);
  else if (kind === 'toalett') paintToilet(P, x, fy);
  else if (kind === 'handfat') paintSink(P, x, fy, w);
  else if (kind === 'ytterdorr') paintHomeDoor(P, x, fy, w);
  else if (kind === 'hangare') paintCoatRack(P, x, fy, w);
  else if (kind === 'leksaker') paintToys(P, x, fy + 60);
}
export function fixSolid(f, bx, fy) {
  const [kind, dx, w] = f, x = bx + dx;
  if (kind === 'ytterdorr') return null;
  if (kind === 'leksaker') return [x, fy + 66, x + 40, fy + 77];
  return [x - 1, fy - 4, x + w + 1, fy + 8];
}

// ================= glasdörrar, karta =================
export function paintGlassDoors(P, x, yTop, w, yBot) {
  P.rect(x - 3, yTop - 3, w + 6, yBot - yTop + 3, 0x3a3f4a); P.hl(x - 3, yTop - 3, w + 6, 0x5a606c);
  for (let y = yTop; y < yBot; y++) for (let xx = x; xx < x + w; xx++) {
    const t = (y - yTop) / (yBot - yTop);
    let c = t < 0.55 ? mix(0x8cc8e8, 0xc8eaf6, t / 0.55) : t < 0.7 ? mix(0x5a9a58, 0x4a8448, hash(xx, y, 3)) : mix(0xb4b0a8, 0x9a968e, hash(xx >> 2, y, 4) * 0.5);
    if (t < 0.55 && hash(xx >> 2, y >> 1, 12) > 0.92) c = mix(c, 0xffffff, 0.5);
    P.px(xx, y, mix(c, 0xe8f6ff, 0.18));
  }
  const mid = x + (w >> 1);
  P.vl(mid - 1, yTop, yBot - yTop, 0x3a3f4a); P.vl(mid, yTop, yBot - yTop, 0x6a707c);
  for (let i = 0; i < 12; i++) { P.px(x + 3 + i, yTop + 16 - i, 0xffffff, 0.45); P.px(mid + 4 + i, yTop + 22 - i, 0xffffff, 0.35); }
  P.rect(mid - 5, yTop + 18, 2, 8, 0xc8ccd2); P.rect(mid + 3, yTop + 18, 2, 8, 0xc8ccd2);
  P.rect(mid - 3, yTop - 2, 6, 2, 0x1a1a20); P.px(mid, yTop - 2, 0xd83a3a);
}
export function doorMat(P, x0, x1, y0, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x1; x++) {
    const b = Math.min(x - x0, x1 - 1 - x, y - y0, y0 + h - 1 - y);
    P.px(x, y, b === 0 ? 0x2a2a30 : b === 1 ? 0xf6cf2a : ((x + y) & 1 ? 0x3a3e48 : 0x444854));
  }
}

// ================= gula gångvägen =================
function arrowPx(dir, fn) { // 11×9, spetsen åt dir
  for (let c = 0; c <= 10; c++) for (let r = 0; r < 9; r++) {
    const on = c <= 5 ? r >= 3 && r <= 5 : Math.abs(r - 4) <= 10 - c;
    if (!on) continue;
    if (dir === 'E') fn(c - 5, r - 4); else if (dir === 'W') fn(5 - c, r - 4);
    else if (dir === 'S') fn(r - 4, c - 5); else fn(r - 4, 5 - c);
  }
}
export function paintPath(P, W, Hh, pts) {
  const HW = 8;
  const mask = new Uint8Array(W * Hh);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let y = Math.min(ay, by) - HW; y < Math.max(ay, by) + HW; y++) for (let x = Math.min(ax, bx) - HW; x < Math.max(ax, bx) + HW; x++) if (x >= 0 && y >= 0 && x < W && y < Hh) mask[y * W + x] = 1;
  }
  const m = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && mask[y * W + x];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    const e1 = !m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1);
    const e2 = !e1 && (!m(x - 2, y) || !m(x + 2, y) || !m(x, y - 2) || !m(x, y + 2));
    const base = P.get(x, y);
    P.px(x, y, e1 ? 0xd9a414 : e2 ? mix(base, 0xf6d24a, 0.75) : mix(base, 0xf8d64c, 0.3 + (bayer(x, y) - 0.5) * 0.06));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dir = bx > ax ? 'E' : bx < ax ? 'W' : by > ay ? 'S' : 'N';
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    for (let d = 18; d < len - 14; d += 46) {
      const cx = ax + Math.sign(bx - ax) * d, cy = ay + Math.sign(by - ay) * d;
      arrowPx(dir, (dx, dy) => P.px(cx + dx, cy + dy + 1, 0x9a7a10, 0.35));
      arrowPx(dir, (dx, dy) => P.px(cx + dx, cy + dy, 0xfffbea));
    }
  }
}
// genväg (streckad gul linje) – som IKEA:s "genväg"-skyltar
export function paintShortcut(P, x0, y0, x1, y1) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (((x >> 2) & 1) === 0) { P.px(x, y0, 0xe0b020); P.px(x, y0 + 1, 0xe0b020); }
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (((y >> 2) & 1) === 0) { P.px(x1, y, 0xe0b020); P.px(x1 + 1, y, 0xe0b020); }
}

// ================= ljus =================
export function trackLights(P, x0, x1, wy) {
  const n = Math.max(2, Math.round((x1 - x0) / 90));
  for (let i = 0; i < n; i++) {
    const cx = Math.round(x0 + (x1 - x0) * (i + 0.5) / n + (i < n / 2 ? -12 : 12));
    P.rect(cx - 2, wy - 1, 5, 3, 0x2a2a32); P.px(cx, wy + 1, 0xfff4d0);
    for (let dy = 2; dy < 26; dy++) {
      const hw = 1 + dy * 0.45, a = 0.16 * (1 - dy / 26);
      for (let dx = -Math.floor(hw); dx <= hw; dx++) if (bayer(cx + dx, wy + dy) < 0.8) P.px(cx + dx, wy + dy, 0xfff6e0, a);
    }
  }
}

// ================= väggar som ritas y-sorterat =================
export function partitionImg() {
  return spriteOf(PW, WH + FD, (P) => {
    const topLen = FD;
    for (let y = 0; y < WH + FD; y++) for (let x = 0; x < PW; x++) {
      let c;
      if (y < topLen) c = x === 0 ? 0x4a4650 : x === PW - 1 ? 0x6a6670 : x === 1 ? 0xf2eee6 : 0xe2ded6;
      else {
        const fb = WH + FD - 1 - y;
        c = mix(0xdcd6ca, 0xc4beb2, (y - topLen) / WH);
        if (x === 0) c = mix(c, 0xffffff, 0.2); else if (x === PW - 1) c = mul(c, 0.8);
        if (fb < 3) c = fb === 2 ? 0xf4f1ea : 0x8e887c;
      }
      P.px(x, y, c);
    }
    P.hl(0, 0, PW, 0x2a2630);
    P.hl(0, FD, PW, 0x8a8478);
  });
}
export function outerWallImg(len) {
  return spriteOf(OW, len, (P) => {
    for (let y = 0; y < len; y++) for (let x = 0; x < OW; x++) P.px(x, y, x === 0 || x === OW - 1 ? 0x3a3640 : x === 1 ? 0xeae6de : 0xd8d4cc);
  });
}
