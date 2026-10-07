// LINNÉSTADEN (v4) – husen väster om centrum. Den mysiga stadsdelen: landshövdingehus
// (en stenvåning nertill och två våningar trä eller puts ovanpå, vita knutar, snickarglädje
// över fönstren, blomlådor) och små butiker med träskyltfönster, randiga markiser,
// hängskyltar (kringlan, kaffekoppen, boken, hjulet …), ljusslingor och vimplar.
//
// Kontrakt (map.js / docs/STADEN.md): BUILDING_ART[kind] = { paint(b, night, opts) → canvas,
// live(ctx, b, st), glow(ctx, b, st), items(b, st), obstacles(b) }.
// Bilden är artBox(b) stor: b.w + 16 bred, canvas-y för markytan GB = base − box.y (186 i
// båda raderna). Allt målas EN gång per hus och dag/natt med Pix och cachas av scenen;
// live() ritar bara dörrarna (färdiga delbilder) och röken ur skorstenarna; items() ställer
// ut trottoarmöblerna (caféborden, grönsakslådorna, blomhinkarna, cyklarna …), som också
// är små hinder (obstacles).
import { Pix, SMALL, BIG, text, textW, eachTextPixel, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson } from '../core/people.js';
import { artBox, baseOf } from './map.js';

const O = 8, OUT = 0x221a26, DOOR_H = 30, WHITE = 0xffffff;
const META = {};
const metaOf = (b, night) => META[b.id + ':' + !!night] || META[b.id + ':' + !night];
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const idSeed = (id) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) & 0xffff, 7);

// ================= målarverktyg =================
const q = (t, x, y, n = 4) => Math.max(0, Math.min(n, Math.round(t * n + bayer(x, y) - 0.5))) / n;
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, q(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
}
function grain(P, x, y, w, h, c, amt = 0.08, seed = 1) {
  const lo = mix(mul(c, 0.88), 0x2a2040, 0.05), hi = mix(c, 0xfff4e0, 0.12);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = hash(x + i, y + j, seed);
    P.px(x + i, y + j, n < amt ? lo : n > 1 - amt ? hi : c);
  }
}
// puts: kornig, med svaga fläckar där regnet runnit
function plaster(P, x, y, w, h, c, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, n = hash(X, Y, seed);
    let k = n < 0.07 ? mul(c, 0.92) : n > 0.94 ? mix(c, WHITE, 0.1) : c;
    if (hash(X >> 2, Y >> 3, seed + 1) > 0.9) k = mul(k, 0.97);
    P.px(X, Y, k);
  }
}
// locklistpanel (stående): bräder 5 px med ljus list mot solen och skugga under nästa
function boards(P, x, y, w, h, c, seed) {
  for (let i = 0; i < w; i++) {
    const X = x + i, p = Math.floor((X + 400) / 5), bx = (X + 400) % 5, tone = 0.94 + hash(p, 1, seed) * 0.1;
    for (let j = 0; j < h; j++) {
      const Y = y + j;
      let k = mul(c, tone);
      if (bx === 0) k = mix(k, WHITE, 0.22);
      else if (bx === 1) k = mix(k, WHITE, 0.07);
      else if (bx === 4) k = mul(k, 0.72);
      else if (hash(X, Y >> 2, seed + 2) > 0.93) k = mul(k, 0.95);
      if (hash(X, Y, seed + 3) > 0.988) k = mul(k, 0.88);
      P.px(X, Y, k);
    }
  }
}
// liggande panel (fasspont): 4 px höga bräder
function hboards(P, x, y, w, h, c, seed) {
  for (let j = 0; j < h; j++) {
    const Y = y + j, r = Math.floor((Y + 400) / 4), by = (Y + 400) % 4, tone = 0.95 + hash(r, 2, seed) * 0.08;
    for (let i = 0; i < w; i++) {
      const X = x + i;
      let k = mul(c, tone);
      if (by === 0) k = mix(k, WHITE, 0.2); else if (by === 3) k = mul(k, 0.7);
      if (hash(X >> 3, r, seed + 1) > 0.94 && by === 1) k = mul(k, 0.9);
      P.px(X, Y, k);
    }
  }
}
// rusticerad sten/puts i bottenvåningen: kvaderband med försänkta fogar
function rustic(P, x, y, w, h, c, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, band = j % 7, row = (j / 7) | 0, jt = (i + (row & 1) * 9) % 18;
    let k = mix(c, mul(c, 0.88), hash(X, Y, seed) * 0.5 + (bayer(X, Y) - 0.5) * 0.25);
    if (hash(Math.floor((i + (row & 1) * 9) / 18), row, seed + 1) > 0.8) k = mul(k, 0.95);
    if (band === 6) k = mul(c, 0.6); else if (band === 0) k = mix(k, WHITE, 0.28); else if (jt === 0) k = mul(c, 0.7); else if (jt === 1) k = mix(k, WHITE, 0.14);
    P.px(X, Y, k);
  }
}
function bricks(P, x, y, w, h, c, seed = 3) {
  const mort = mix(mul(c, 0.5), 0x9a9088, 0.5);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, row = Math.floor(Y / 3), off = (row & 1) * 3, col = Math.floor((X + off) / 6);
    const bx = (X + off) % 6, by = Y % 3;
    if (by === 2 || bx === 5) { P.px(X, Y, hash(X, Y, seed) > 0.8 ? mul(mort, 0.9) : mort); continue; }
    let k = mul(c, 0.84 + hash(col, row, seed) * 0.3);
    if (hash(col, row, seed + 1) > 0.88) k = mix(k, 0x5a2a22, 0.35);
    if (by === 0) k = mix(k, 0xffe8d0, 0.14);
    if (bx === 4) k = mul(k, 0.9);
    P.px(X, Y, k);
  }
}
// takpannor (rader om 4 px, pannor 6 px, förskjutna)
function tiles(P, x, y, w, h, c, seed = 5, dark = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, row = Math.floor(j / 4), by = j % 4, off = (row & 1) * 3;
    const col = Math.floor((i + off) / 6), bx = (i + off) % 6;
    let k = mul(c, (0.86 + hash(col, row, seed) * 0.24) * dark);
    if (hash(col, row, seed + 1) > 0.93) k = mix(k, 0x6a7a44, 0.3);
    if (by === 3) k = mix(mul(c, 0.4 * dark), 0x24121a, 0.35);
    else if (by === 0) k = mix(k, 0xffe0c0, 0.22);
    else if (bx === 0) k = mix(k, 0xffe8d0, 0.12);
    else if (bx >= 4) k = mul(k, bx === 5 ? 0.74 : 0.88);
    P.px(X, Y, k);
  }
}
// bandtäckt plåttak: falsar var 7:e px
function metal(P, x, y, w, h, c, seed = 6, dark = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, f = (i + 400) % 7;
    let k = mul(mix(c, mul(c, 0.86), q(j / Math.max(1, h), X, Y, 3)), dark);
    if (f === 0) k = mix(k, WHITE, 0.26); else if (f === 1) k = mul(k, 0.78); else if (f === 6) k = mix(k, WHITE, 0.06);
    if (hash(X, Y, seed) > 0.985) k = mix(k, 0x8a5a36, 0.3);
    P.px(X, Y, k);
  }
}
// tältduk i ränder (glasskioskens tak): våder 6 px, sömmar och lätt bukt mellan dem
function tent(P, x, y, w, h, c, seed = 7, dark = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, v = (i + 400) % 12, s = v < 6 ? c : 0xfaf4f2;
    let k = mul(mix(s, mul(s, 0.88), q(j / Math.max(1, h), X, Y, 3)), dark);
    if (v === 0 || v === 6) k = mul(k, 0.84); else if (v === 3 || v === 9) k = mix(k, WHITE, 0.12);
    P.px(X, Y, k);
  }
}
// glasruta: himmelsreflex på dagen, tänd/släckt på natten
function glassPane(P, x, y, w, h, o = {}) {
  const s = o.seed || 0;
  let c0, c1;
  if (o.lit === 'tv') { c0 = 0xb8d8ff; c1 = 0x5a78c8; }
  else if (o.lit) { c0 = o.lit === 'warm2' ? 0xffd08a : 0xffeaa8; c1 = o.lit === 'warm2' ? 0xe08a3a : 0xf0a648; }
  else if (o.night) { c0 = 0x28324a; c1 = 0x141a2a; }
  else { c0 = o.sky || 0xa8cce2; c1 = o.deep || 0x3a5270; }
  vgrad(P, x, y, w, h, c0, c1, 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j + s * 7) % (o.streak || 13);
    if (d === 0 || d === 1) P.px(x + i, y + j, WHITE, o.lit ? 0.12 : o.night ? 0.06 : 0.3);
    else if (d === 3) P.px(x + i, y + j, WHITE, o.lit ? 0.06 : 0.12);
  }
  if (!o.lit) P.hl(x, y, w, WHITE, o.night ? 0.08 : 0.35);
}
// blomlåda med pelargoner/petunior som hänger över kanten
function flowerBox(P, x, y, w, pal, seed, box = 0x8a5a36) {
  for (let i = 0; i < w; i++) {
    const hgt = 2 + Math.floor(hash(x + i, seed, 41) * 3);
    for (let j = 1; j <= hgt; j++) P.px(x + i, y - j, (i + j) % 3 ? 0x3f7a34 : 0x5a9a3e);
    if (hash(x + i, seed, 42) > 0.45) { const c = pal[Math.floor(hash(x + i, seed, 43) * pal.length)]; P.px(x + i, y - hgt, c); if (hash(x + i, seed, 44) > 0.5) P.px(x + i, y - hgt + 1, mul(c, 0.8)); }
    if (hash(x + i, seed, 45) > 0.8) { P.px(x + i, y + 3, 0x3f7a34); if (hash(x + i, seed, 46) > 0.5) P.px(x + i, y + 4, pal[0]); } // hänger över kanten
  }
  P.rect(x, y, w, 3, box); P.hl(x, y, w, mix(box, WHITE, 0.25)); P.hl(x, y + 2, w, mul(box, 0.65));
  P.darken(x + 1, y + 3, w - 1, 2, 0.78);
}
const CURTAINS = [0xd8544a, 0xe8d8a8, 0x6a8ac8, 0xf0ece0, 0x8ac07a, 0xd89ac0, 0xe0b040];
const litOf = (night, a, c) => (night && hash(a, c, 77) < 0.74 ? (hash(a, c, 78) < 0.12 ? 'tv' : hash(a, c, 79) < 0.45 ? 'warm2' : true) : false);
const litCol = (lit) => (lit === 'tv' ? 0x8ab4ff : lit === 'warm2' ? 0xffb060 : 0xffd080);
// fönster med karm, mittpost, överljus, gardiner, krön (snickarglädje) och blomlåda
function win(P, x, y, w, h, o = {}) {
  const fr = o.frame ?? 0xf4efe4, frLo = mix(mul(fr, 0.7), 0x3a3050, 0.1);
  // krön över fönstret
  if (o.crown === 'gable') {
    const cw = w + 4, ph = Math.max(2, Math.round(cw / 5)), cx = x + (w >> 1);
    for (let r = 0; r < ph; r++) {
      const hw = Math.round((cw / 2) * (1 - r / ph));
      P.hl(cx - hw, y - 3 - r, hw * 2 + (w & 1), r === ph - 1 ? mix(fr, WHITE, 0.3) : fr);
      P.px(cx - hw, y - 3 - r, mix(fr, WHITE, 0.4)); P.px(cx + hw + (w & 1) - 1, y - 3 - r, frLo);
    }
    P.hl(x - 2, y - 2, w + 4, frLo); P.px(cx, y - 2 - ph + 1, o.accent ?? 0xc84a3a);
  } else if (o.crown === 'cornice') {
    P.hl(x - 3, y - 4, w + 6, mix(fr, WHITE, 0.35)); P.hl(x - 3, y - 3, w + 6, fr); P.hl(x - 2, y - 2, w + 4, frLo);
    for (let i = x - 2; i < x + w + 2; i += 3) P.px(i, y - 2, mul(fr, 0.85));
  } else if (o.crown === 'arch') {
    const cx = x + w / 2, rx = w / 2 + 2, ry = 4;
    for (let j = -ry; j <= 0; j++) for (let i = Math.floor(cx - rx); i <= cx + rx; i++) {
      const t = Math.hypot((i + 0.5 - cx) / rx, (j + 0.5) / ry);
      if (t < 1 && t > 0.55) P.px(i, y - 1 + j, t > 0.85 ? frLo : fr);
    }
  }
  P.box(x - 1, y - 1, w + 2, h + 2, OUT);
  glassPane(P, x + 1, y + 1, w - 2, h - 2, o);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  if (o.curtain !== undefined && o.curtain !== null) {
    const cc = o.lit ? mix(o.curtain, 0xffe0a0, 0.35) : o.night ? mul(o.curtain, 0.45) : o.curtain;
    const cw = Math.max(2, Math.round(gw * 0.22));
    for (let j = 0; j < gh; j++) for (let i = 0; i < cw; i++) {
      const tie = j > gh * 0.55 ? Math.round((j - gh * 0.55) * 0.25) : 0;
      if (i < cw - tie) { P.px(gx + i, gy + j, i % 2 === 0 ? mix(cc, WHITE, 0.18) : mul(cc, 0.8)); P.px(gx + gw - 1 - i, gy + j, i % 2 === 0 ? mul(cc, 0.86) : mul(cc, 0.72)); }
    }
    P.hl(gx, gy, gw, mul(cc, 0.8)); P.hl(gx, gy + 1, gw, cc);
  }
  // innanför: en krukväxt, en lampa eller en katt
  if (!o.lit && !o.night && o.seed !== undefined) {
    const v = (o.seed * 7) % 6;
    if (v === 0 || v === 3) { const px0 = v === 0 ? gx + 2 : gx + gw - 5; P.rect(px0, gy + gh - 3, 3, 3, 0xb0603a); P.hl(px0, gy + gh - 3, 3, 0xd08050); P.rect(px0 - 1, gy + gh - 7, 5, 4, 0x3a7a34); P.px(px0 + 1, gy + gh - 8, 0x5a9a44); P.px(px0 - 1, gy + gh - 5, 0x5a9a44); }
    else if (v === 1) { P.vl(gx + (gw >> 1) + 2, gy, 3, 0x3a3440, 0.7); P.rect(gx + (gw >> 1) + 1, gy + 3, 3, 2, 0xf0d8a0, 0.8); }
  }
  if (o.cat) {                                                                     // katten i fönstret
    const cx = gx + (gw >> 1) - 2, cy = gy + gh - 1, cc = o.cat;
    P.rect(cx, cy - 4, 5, 4, cc); P.rect(cx + 1, cy - 7, 3, 3, cc); P.px(cx + 1, cy - 8, cc); P.px(cx + 3, cy - 8, cc);
    P.px(cx + 1, cy - 6, 0xd8e040); P.px(cx + 3, cy - 6, 0xd8e040); P.vl(cx + 5, cy - 6, 3, cc); P.px(cx + 6, cy - 7, cc);
  }
  P.box(x, y, w, h, fr);
  P.hl(x, y, w, mix(fr, WHITE, 0.5)); P.vl(x + w - 1, y + 1, h - 1, frLo); P.hl(x + 1, y + h - 1, w - 1, frLo);
  const mx = x + (w >> 1);
  if (!o.single) { P.vl(mx, y + 1, h - 2, fr); P.vl(mx + 1, y + 1, h - 2, frLo, 0.5); }
  const ty = y + Math.round(h * (o.transom ?? 0.3));
  if (o.transom !== false) { P.hl(x + 1, ty, w - 2, fr); P.hl(x + 1, ty + 1, w - 2, frLo, 0.5); }
  if (o.bars) for (let yy = ty + 4; yy < y + h - 2; yy += 5) P.hl(x + 1, yy, w - 2, fr);     // spröjs i småruta
  if (o.flowers) flowerBox(P, x - 2, y + h + 1, w + 4, o.flowers, o.seed || 0, o.boxCol);
  else if (o.sill !== false) {
    const st = o.sillCol || 0xd8d0c0;
    P.hl(x - 2, y + h + 1, w + 4, mix(st, WHITE, 0.3)); P.hl(x - 2, y + h + 2, w + 4, mul(st, 0.7));
    P.darken(x - 1, y + h + 3, w + 2, 1, 0.72);
  }
}
function downpipe(P, x, y0, y1, c = 0x9aa0aa) {
  P.vl(x, y0, y1 - y0, c); P.vl(x + 1, y0, y1 - y0, mul(c, 0.6));
  for (let y = y0 + 6; y < y1 - 2; y += 14) P.hl(x - 1, y, 4, 0x3a3e48);
  P.rect(x - 1, y1 - 2, 4, 2, mul(c, 0.8)); P.hl(x - 1, y1 - 2, 4, mix(c, WHITE, 0.2));
}
function footShadow(P, x, w, GB) {
  P.hl(x, GB, w, 0x1a1422, 0.34); P.hl(x, GB + 1, w, 0x1a1422, 0.18); P.hl(x + 1, GB + 2, w - 2, 0x1a1422, 0.08);
}
// text med skugga och ljus överkant (förgyllda bokstäver)
function signText(P, F, s, x, y, c, shadow = null, hi = null, sc = 1) {
  const hgt = F.h * sc;
  if (shadow !== null) eachTextPixel(F, s, x + 1, y + 1, sc, (px, py) => P.px(px, py, shadow));
  eachTextPixel(F, s, x, y, sc, (px, py) => { const t = (py - y) / hgt; P.px(px, py, t < 0.3 && hi !== null ? hi : t > 0.7 ? mul(c, 0.84) : c); });
}
// markis: randig duk, våglist och armar
function awning(P, x, y, w, h, c1, c2, o = {}) {
  const sw = o.stripe || 4, drop = o.drop ?? 3, ext = o.ext ?? 2;
  P.darken(x + 1, y + h + drop, w - 2, 3, 0.66); P.darken(x + 2, y + h + drop + 3, w - 4, 2, 0.84);
  const stripeOf = (i) => ((Math.floor((i + 400) / sw) & 1) ? c2 : c1);
  for (let j = 0; j < h; j++) {
    const e = Math.round((j / h) * ext);
    for (let i = -e; i < w + e; i++) {
      const s = stripeOf(i), X = x + i, Y = y + j;
      let k = mix(mix(s, 0xfff8e8, 0.2), mul(s, 0.76), q(j / h, X, Y, 3));
      if (j === 0) k = mul(s, 0.55);
      P.px(X, Y, k);
    }
  }
  for (let j = 0; j < drop; j++) for (let i = -ext; i < w + ext; i++) {
    const seg = (i + ext + 400) % sw;
    if (j === drop - 1 && (seg === 0 || seg === sw - 1)) continue;          // våglisten
    P.px(x + i, y + h + j, j === 0 ? mix(stripeOf(i), WHITE, 0.1) : mul(stripeOf(i), 0.8 - j * 0.06));
  }
  P.hl(x - ext, y + h, w + ext * 2, 0x000000, 0.18);
  if (o.arms !== false) for (const ax of [x + 2, x + w - 3]) P.line(ax, y + h + drop + 5, ax + (ax < x + w / 2 ? -1 : 1), y + h - 1, 0x3a3a44);
}
// ljusslinga: tråd som hänger i bågar, lampor var 4:e px (lyser på kvällen)
const BULBS = [0xffe6a0, 0xffb85a, 0xff8a6a, 0xfff2d0, 0xffd27a];
function stringLights(P, x0, x1, y, sag, seed, glows, wx, wy, span = 26) {
  for (let x = x0; x < x1; x++) {
    const u = ((x - x0) % span) / span, yy = Math.round(y + Math.sin(u * Math.PI) * sag);
    P.px(x, yy, 0x2a2a30);
    if ((x - x0) % 4 === 2) {
      const c = BULBS[(hash(x, seed, 3) * BULBS.length) | 0];
      P.px(x, yy + 1, c); P.px(x, yy + 2, mul(c, 0.8));
      glows.push([wx(x), wy(yy + 1), 1, 2, c, 0.95]);
    }
  }
}
// vimplar: trekantiga flaggor i glada färger
const FLAGS = [0xe8443a, 0xf4d23c, 0x3a9bff, 0x5ad35a, 0xe070c0, 0xff8a2a, 0xf4f1ea];
function bunting(P, x0, x1, y, sag, seed, span = 30) {
  for (let x = x0; x < x1; x++) {
    const u = ((x - x0) % span) / span, yy = Math.round(y + Math.sin(u * Math.PI) * sag);
    P.px(x, yy, 0xe8e2d4);
    if ((x - x0) % 6 === 0 && x + 4 < x1) {
      const c = FLAGS[(((x - x0) / 6) + seed) % FLAGS.length];
      for (let r = 0; r < 5; r++) { const hw = Math.max(0, 2 - Math.floor(r / 2)); P.hl(x + 2 - hw, yy + 1 + r, hw * 2 + 1, r === 0 ? mix(c, WHITE, 0.2) : r >= 3 ? mul(c, 0.82) : c); }
    }
  }
}
// murgröna/vildvin som klättrar på fasaden (bladklumpar)
function ivy(P, x, y0, y1, w, seed, autumn = false) {
  const C = autumn ? [0x8a2a1a, 0xb4442a, 0xd8743a, 0x5a6a2a] : [0x24502a, 0x356a2c, 0x4c8a3a, 0x6aa848];
  for (let y = y0; y < y1; y++) {
    const reach = w * (0.35 + 0.65 * ((y - y0) / (y1 - y0))) * (0.7 + hash(y >> 2, 1, seed) * 0.5);
    for (let i = 0; i < reach; i++) {
      const X = x + i, n = hash(X >> 1, y >> 1, seed + 2);
      if (n > 0.62 - (i < reach * 0.5 ? 0.25 : 0)) {
        const k = hash(X, y, seed + 3);
        P.px(X, y, C[k > 0.75 ? 3 : k > 0.45 ? 2 : k > 0.15 ? 1 : 0]);
      }
    }
  }
}
// klätterrosor kring en dörr eller ett fönster
function roses(P, x, y0, y1, seed) {
  for (let y = y0; y < y1; y++) for (let i = -2; i <= 2; i++) {
    if (hash(x + i, y, seed) < 0.55) continue;
    const k = hash(x + i, y, seed + 1);
    P.px(x + i, y, k > 0.86 ? 0xe84a6a : k > 0.78 ? 0xf8a8b8 : k > 0.4 ? 0x3e7a34 : 0x2a5a2a);
  }
}
// vägglykta (glöder på kvällen)
function lantern(P, x, y, night, glows, wx, wy) {
  P.hl(x + 2, y - 2, 4, 0x2a2a30); P.px(x + 5, y - 3, 0x2a2a30); P.px(x + 5, y - 1, 0x2a2a30);
  P.rect(x, y, 5, 7, 0x2a2a30); P.rect(x + 1, y + 1, 3, 5, night ? 0xffe8a0 : 0xd8e0e0); P.px(x + 1, y + 1, WHITE);
  P.hl(x - 1, y, 7, 0x3a3a44); P.hl(x, y - 1, 5, 0x4a4a54); P.px(x + 2, y + 7, 0x2a2a30);
  glows.push([wx(x), wy(y), 5, 7, 0xffd890, 0.75]);
}
// husnummer i blå emalj
function plaque(P, x, y, num) {
  const w = textW(SMALL, num) + 5;
  P.box(x - 1, y - 1, w + 2, 11, 0x2a2a34); P.rect(x, y, w, 9, 0x1f4f9a); P.box(x, y, w, 9, 0xeef2f8);
  text(P, SMALL, num, x + 3, y + 2, WHITE);
}
// hängskylt på en smidesarm: kringlan, koppen, boken, hjulet …
function hangSign(P, x, y, kind, right = true) {
  const d = right ? 1 : -1, x1 = x + d * 9;
  P.line(x, y, x1, y, 0x2a2a30); P.line(x, y + 3, x + d * 3, y, 0x2a2a30);            // armen och strävan
  P.px(x1 + d, y - 1, 0x2a2a30); P.px(x1, y - 1, 0x2a2a30);                            // kruserull
  const cx = x + d * 6;
  P.px(cx - 3, y + 1, 0x4a4a52); P.px(cx + 3, y + 1, 0x4a4a52);                        // kedjorna
  const top = y + 2;
  const G = (gx, gy, c) => P.px(cx + gx, top + gy, c);
  if (kind === 'kringla') {                                                             // bagarkringlan (guld)
    const pts = [[-4, 1], [-5, 2], [-5, 3], [-5, 4], [-4, 5], [-3, 6], [-2, 6], [-1, 5], [0, 4], [1, 5], [2, 6], [3, 6], [4, 5], [5, 4], [5, 3], [5, 2], [4, 1], [3, 0], [2, 0], [1, 1], [0, 2], [-1, 1], [-2, 0], [-3, 0], [-1, 3], [1, 3], [0, 3], [-1, 7], [-2, 8], [1, 7], [2, 8], [0, 6]];
    for (const [a, c] of pts) { G(a, c, 0xd8a83a); G(a, c + 1, 0x8a5a1a); }
    for (const [a, c] of pts) G(a, c, c < 3 || a < 0 ? 0xf2cc5a : 0xd8a83a);
    G(-3, 0, 0xfff0a0); G(-4, 1, 0xfff0a0);
    return;
  }
  // övriga: en oval/rund bräda med motiv
  for (let j = 0; j < 12; j++) for (let i = -6; i <= 6; i++) {
    const t = Math.hypot(i / 6.5, (j - 5.5) / 6);
    if (t > 1) continue;
    P.px(cx + i, top + j, t > 0.85 ? 0x2a2a30 : t > 0.74 ? 0xc8a44a : j < 4 ? 0xf6f0e2 : 0xece4d0);
  }
  if (kind === 'kopp') {
    for (let i = -3; i <= 2; i++) for (let j = 5; j <= 8; j++) G(i, j, j === 5 ? 0xffffff : i === 2 ? 0xa8a49c : 0xe8e4dc);
    G(3, 6, 0xb8b4ac); G(4, 6, 0xb8b4ac); G(4, 7, 0xb8b4ac); G(3, 8, 0xb8b4ac);
    for (let i = -4; i <= 4; i++) G(i, 9, 0x8a6a4a);
    G(-2, 2, 0xb8b0a8); G(-1, 3, 0xb8b0a8); G(0, 2, 0xb8b0a8); G(1, 3, 0xb8b0a8);         // ångan
    G(-2, 5, 0x6a3a1a); G(-1, 5, 0x6a3a1a); G(0, 5, 0x6a3a1a);
  } else if (kind === 'bok') {
    for (let i = -4; i <= 4; i++) for (let j = 4; j <= 8; j++) G(i, j - (Math.abs(i) < 1 ? 1 : 0), i === 0 ? 0x6a3a2a : j === 4 ? 0xfaf6ea : 0xe8e0cc);
    for (let i = -4; i <= 4; i++) G(i, 9, 0x8a2a24);
    for (const j of [6, 7]) { G(-3, j, 0x9a9488); G(-2, j, 0x9a9488); G(2, j, 0x9a9488); G(3, j, 0x9a9488); }
  } else if (kind === 'hjul') {
    for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; G(Math.round(Math.cos(an) * 4), Math.round(5.5 + Math.sin(an) * 4), 0x2a2a30); }
    for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; G(Math.round(Math.cos(an) * 2), Math.round(5.5 + Math.sin(an) * 2), 0x9aa0aa); }
    G(0, 5, 0xc84a3a); G(0, 6, 0xc84a3a);
  } else if (kind === 'blomma') {
    for (let j = 6; j <= 9; j++) G(0, j, 0x3e7a34); G(-1, 8, 0x5a9a42); G(1, 7, 0x5a9a42);
    for (const [a, c] of [[-1, 3], [0, 3], [1, 3], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [-1, 5], [0, 5], [1, 5], [-2, 2], [0, 2], [2, 2]]) G(a, c, c === 2 ? 0xf09ab8 : 0xe0507a);
  } else if (kind === 'stjarna') {
    for (const [a, c] of [[0, 1], [0, 2], [-1, 3], [0, 3], [1, 3], [-4, 4], [-3, 4], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5], [-2, 6], [-1, 6], [1, 6], [2, 6], [-3, 7], [-2, 7], [2, 7], [3, 7], [-3, 8], [3, 8]]) G(a, c, c < 4 ? 0xfff0a0 : 0xe8b83a);
  } else if (kind === 'apple') {
    for (let j = 4; j <= 9; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i / 3.5, (j - 6.5) / 3) < 1) G(i, j, i < 0 && j < 6 ? 0xf06a5a : 0xc8302a);
    G(0, 3, 0x5a3a1a); G(1, 2, 0x4c8a3a); G(2, 2, 0x6aa848); G(-2, 5, 0xffffff);
  } else if (kind === 'strut') {
    for (let j = 1; j <= 5; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i / 3.4, (j - 3.5) / 2.6) < 1) G(i, j, j < 3 ? 0xf8c8d8 : i < 0 ? 0xf8f0e0 : 0xe8a8c0);
    for (let j = 6; j <= 10; j++) { const hw = Math.round((10 - j) * 0.6); for (let i = -hw; i <= hw; i++) G(i, j, (i + j) % 2 ? 0xd8a04a : 0xb07a2a); }
  } else if (kind === 'kanna') {
    for (let j = 4; j <= 8; j++) for (let i = -3; i <= 2; i++) G(i, j, i === -3 ? 0x6a9ad0 : j === 4 ? 0xb8d4f0 : 0x3a6ab0);
    G(-1, 3, 0x2a4a80); G(0, 3, 0x2a4a80); G(3, 5, 0x3a6ab0); G(4, 4, 0x3a6ab0); G(-4, 5, 0x3a6ab0); G(-5, 6, 0x3a6ab0);
    for (let i = -4; i <= 3; i++) G(i, 9, 0x8a6a4a);
  }
}
// skorsten (puts eller tegel) med plåthuv
function chimney(P, x, top, bot, c, brick) {
  P.darken(x + 8, top + 6, 4, bot - top - 2, 0.7);
  if (brick) bricks(P, x, top + 3, 8, bot - top - 3, c, 12); else grain(P, x, top + 3, 8, bot - top - 3, c, 0.1, 13);
  P.vl(x, top + 3, bot - top - 3, mix(c, WHITE, 0.2)); P.vl(x + 7, top + 3, bot - top - 3, mul(c, 0.66));
  P.rect(x - 1, top, 10, 3, 0x9a9ca4); P.hl(x - 1, top, 10, 0xd8dae0); P.hl(x - 1, top + 2, 10, 0x5a5c64);
  P.rect(x + 2, top, 2, 1, 0x1a1418); P.rect(x + 5, top, 2, 1, 0x1a1418);
}
// takkupa med sadeltak, fönster och blomlåda
function dormer(P, x, top, bot, o) {
  const w = o.w || 18, cx = x + (w >> 1), wall = o.wall ?? 0xece4d4, roofC = o.roofCol;
  P.darken(x + w, top + 2, 4, bot - top + 1, 0.72);
  grain(P, x, top + 4, w, bot - top - 4, wall, 0.12, 20 + x);
  P.vl(x, top + 4, bot - top - 4, mix(wall, WHITE, 0.3)); P.vl(x + w - 1, top + 4, bot - top - 4, mul(wall, 0.72));
  P.hl(x, bot - 1, w, mul(wall, 0.6)); P.hl(x - 1, bot, w + 2, 0x4a3e38);
  win(P, x + 4, top + 7, w - 8, bot - top - 11, { lit: o.lit, night: o.night, curtain: o.curtain, sill: false, transom: 0.35, seed: o.seed, frame: o.frame });
  for (let r = 0; r < 10; r++) {
    const y = top - 5 + r, hw = r + 1;
    for (let dx = -hw; dx <= hw; dx++) {
      const ad = Math.abs(dx);
      P.px(cx + dx, y, ad >= hw - 1 ? (ad === hw ? mul(roofC, 0.6) : roofC) : ad === hw - 2 ? (o.frame ?? 0xf4ecdc) : ((dx + 20) % 3 === 0 ? mul(wall, 0.86) : wall));
    }
  }
  P.hl(cx - 10, top + 5, 21, mul(roofC, 0.55)); P.px(cx, top - 6, mul(roofC, 0.5));
  if (o.snow) for (let r = 0; r < 9; r++) { const hw = r + 1; P.px(cx - hw, top - 5 + r, 0xf4f8fc); P.px(cx + hw, top - 5 + r, 0xe0e8f2); }
}
// väggmålningen på LINNÉGATAN 17: himmel, sol, en stor lind, fåglar och blommor
function mural(P, x, y, w, h, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, t = j / h;
    let c = mix(0x9ad0ec, 0xf4d8a8, q(t * 1.1, X, Y, 4));
    const hill = h * 0.72 + Math.sin(i * 0.12 + seed) * 3;
    if (j > hill) c = mix(0x6ab04a, 0x3e8a34, q((j - hill) / (h - hill), X, Y, 3));
    P.px(X, Y, c);
  }
  const sx = x + w - 12, sy = y + 10;                                                   // solen
  for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; P.line(sx + Math.cos(an) * 6, sy + Math.sin(an) * 6, sx + Math.cos(an) * 8, sy + Math.sin(an) * 8, 0xf8c840); }
  P.ell(sx, sy, 5, 5, 0xffd84a, 1, 2);
  const tx = x + Math.round(w * 0.38), ty = y + Math.round(h * 0.72);                 // linden
  P.rect(tx - 1, ty - 14, 3, 16, 0x6a4a2a); P.vl(tx - 1, ty - 14, 16, 0x8a6a3a);
  P.line(tx, ty - 10, tx - 5, ty - 15, 0x6a4a2a); P.line(tx + 1, ty - 8, tx + 6, ty - 13, 0x6a4a2a);
  for (let j = -16; j <= 2; j++) for (let i = -14; i <= 14; i++) {
    const t = Math.hypot(i / 14, j / 11);
    if (t > 1) continue;
    const n = hash(tx + i >> 1, ty - 20 + j >> 1, seed + 5);
    if (t > 0.85 && n < 0.4) continue;
    P.px(tx + i, ty - 20 + j, n > 0.7 ? 0x8ac858 : n > 0.35 ? 0x5aa040 : 0x3e7a34);
  }
  for (const [bx, by] of [[x + 8, y + 9], [x + 16, y + 13], [x + w - 26, y + 18]]) { P.px(bx, by, 0x2a2a34); P.px(bx + 1, by - 1, 0x2a2a34); P.px(bx + 2, by, 0x2a2a34); P.px(bx + 3, by - 1, 0x2a2a34); P.px(bx + 4, by, 0x2a2a34); }
  for (let i = 2; i < w - 2; i += 3) { const fy = y + h - 3 - ((hash(i, 1, seed) * 3) | 0); P.px(x + i, fy, FLAGS[(hash(i, 2, seed) * 6) | 0]); P.px(x + i, fy + 1, 0x3e7a34); }
  // målarramen och konstnärens signatur
  P.box(x - 1, y - 1, w + 2, h + 2, 0xf4efe4); P.box(x - 2, y - 2, w + 4, h + 4, mul(0xf4efe4, 0.7));
  text(P, SMALL, 'LINNÉ', x + 3, y + h - 8, 0xf4f1ea, 0.85);
}

// ================= skyltfönstrens innehåll =================
// Två lager: displayBack målas i fasaden (bakväggen, hyllorna, det som står längst in) och
// displayFront både i fasaden och i en egen överbild per fönster (disken/fönsterbänken, glasets
// reflexer, spröjsen). live() ritar expediten och de små rörelserna MELLAN lagren – då står
// expediten bakom disken och glaset. anim = [x, y, sort] (canvas-koordinater) för live().
const BACKS = { kafe: 0xf0e0c4, gard: 0x6a4a30, pynt: 0xf4e4e4, bageri: 0xf2e2c0, blommor: 0xd4e8cc, antik: 0x6a4630, loppis: 0xece0c8, cykel: 0xc8ccd2, glass: 0xfce8f0 };
const BOOKS = [0x8a2a24, 0x2a4a6a, 0x3a5a3a, 0x8a6a2a, 0x5a3a5a, 0xc8b490, 0x6a2a3a, 0x2a5a5a];
function displayBack(P, x, y, w, h, kind, night, seed, anim, warm) {
  const back = BACKS[kind] ?? 0xe8e0d0;
  const lit = night || warm;
  const wall0 = lit ? mix(back, 0xffd890, warm && !night ? 0.22 : 0.35) : mul(back, 0.82), wall1 = lit ? mul(mix(back, 0xffb060, 0.4), 0.8) : mul(back, 0.58);
  vgrad(P, x, y, w, h, wall0, wall1, 3);
  const G = (px, py, c) => { if (px >= x && px < x + w && py >= y && py < y + h) P.px(px, py, c); };
  const R = (px, py, pw, ph, c) => { for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) G(px + i, py + j, c); };
  const shelf = (yy, c = 0x8a6a4a) => { R(x, yy, w, 1, c); R(x, yy + 1, w, 1, mul(c, 0.66)); };
  if (kind === 'kafe') {
    R(x + 2, y + 3, 11, 8, 0x2a3430); R(x + 2, y + 3, 11, 1, 0x6a4a2a);                                  // menytavlan
    for (let k = 0; k < 3; k++) R(x + 4, y + 5 + k * 2, 5 + ((k * 3 + seed) % 4), 1, 0xe8e4dc);
    for (let i = x + 16; i < x + w - 2; i += 9) { R(i, y, 1, 4, 0x3a3a40); R(i - 1, y + 4, 3, 2, lit ? 0xffe0a0 : 0xf0c060); anim.push([i, y + 6, 'lampa']); }  // taklampor
    shelf(y + 10); for (let i = x + 15; i < x + w - 3; i += 4) { R(i, y + 8, 3, 2, (i + seed) % 3 ? WHITE : 0xd8a8a0); }      // koppar på hyllan
    R(x + w - 9, y + 12, 7, 6, 0xb8bcc4); R(x + w - 9, y + 12, 7, 1, 0xe8eaee); G(x + w - 7, y + 15, 0x2a2a30);         // espressomaskinen
  } else if (kind === 'bageri') {
    for (let s = 0; s < 2; s++) {                                                            // brödhyllorna
      const yy = y + 5 + s * 7;
      shelf(yy + 3, 0x7a4a2a);
      for (let i = x + 1; i < x + w - 4; i += 6) { const k = (i + s + seed) % 3; if (k === 0) { R(i, yy, 5, 3, 0xb87a3a); R(i, yy, 5, 1, 0xd8a060); G(i + 1, yy + 1, 0x8a5a2a); G(i + 3, yy + 1, 0x8a5a2a); } else if (k === 1) { R(i, yy + 1, 4, 2, 0x8a5226); R(i, yy + 1, 4, 1, 0xa86a32); } else { R(i, yy, 3, 3, 0xd8a050); G(i + 1, yy + 1, 0xf8e8c0); } }
    }
    R(x + w - 10, y + 2, 8, 5, 0x5a4a44); R(x + w - 9, y + 3, 6, 3, lit ? 0xff8a3a : 0xc85a2a); anim.push([x + w - 6, y + 4, 'ugn']);  // ugnsluckan
  } else if (kind === 'gard') {
    for (let i = x + 3; i < x + w - 3; i += 8) { R(i, y, 1, 3, 0x8a7a5a); for (let k = 0; k < 4; k++) R(i - 1 + (k & 1), y + 3 + k * 2, 3, 2, k % 2 ? 0xe8dcc0 : 0xd8c8a0); }   // vitlöksflätor i taket
    shelf(y + 13, 0x7a5a3a);
    for (let i = x + 1; i < x + w - 3; i += 5) { R(i, y + 9, 3, 4, 0xf0b830); R(i, y + 8, 3, 1, 0xd8d0c0); G(i + 1, y + 10, 0xfff0a0); }          // honungsburkar
    for (let i = x + 2; i < x + w - 6; i += 9) { R(i, y + 15, 7, 3, 0xf0d060); R(i, y + 15, 7, 1, 0xd8a030); }                             // ostar
  } else if (kind === 'pynt') {
    for (let i = x + 1; i < x + w - 1; i++) { const yy = y + 2 + Math.round(Math.sin((i - x) / w * Math.PI) * 3); G(i, yy, 0x3a3a40); if ((i - x) % 3 === 1) G(i, yy + 1, BULBS[(i + seed) % 5]); }
    shelf(y + 13, 0xd8d0c0);
    for (let i = x + 2; i < x + w - 6; i += 8) { const c = [0xe8a0a8, 0xa8c8e8, 0xf0e0a0, 0xb8e0c0][(i + seed) % 4]; R(i, y + 8, 6, 5, c); G(i + 2, y + 10, WHITE); }   // kuddar
    for (let i = x + 4; i < x + w - 4; i += 10) { R(i, y + 15, 3, 4, [0x6ab0d0, 0xd8a0c8, 0xf4f0e8][(i + seed) % 3]); G(i + 1, y + 14, 0x4c8a3a); G(i, y + 13, 0xe86a8a); }  // vaser
  } else if (kind === 'blommor') {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {                                 // en vägg av gröna växter
      const n = hash((x + i) >> 1, (y + j) >> 1, seed + 3), v = vnoise(x + i, y + j, 5, seed);
      if (v > 0.38) G(x + i, y + j, n > 0.75 ? 0x6aa848 : n > 0.4 ? 0x4c8a3a : 0x356a2c);
      if (v > 0.6 && hash(x + i, y + j, seed + 4) > 0.9) G(x + i, y + j, FLAGS[(i + j) % 6]);
    }
    for (let i = x + 4; i < x + w - 4; i += 11) { R(i, y, 1, 4, 0x5a4a3a); R(i - 3, y + 4, 7, 4, 0x3e7a34); G(i - 3, y + 8, 0x3e7a34); G(i + 3, y + 9, 0x5a9a42); G(i, y + 5, 0xf09ab8); G(i + 2, y + 6, 0xf4d23c); }  // amplar
    anim.push([x + (w >> 1), y + (h >> 1), 'fjaril']);
  } else if (kind === 'antik') {
    for (let s = 0; s < 3; s++) {                                                            // bokhyllor från golv till tak
      const yy = y + 2 + s * 7;
      shelf(yy + 5, 0x5a3a24);
      for (let i = x + 1; i < x + w - 1; i += 2) { const hh = 3 + ((hash(i, s, seed) * 2) | 0), c = BOOKS[(hash(i, s + 3, seed) * BOOKS.length) | 0]; R(i, yy + 5 - hh, 2, hh, c); G(i, yy + 5 - hh, mix(c, WHITE, 0.25)); if (hash(i, s, seed + 5) > 0.7) G(i + 1, yy + 4 - hh, 0xd8b850); }
    }
    R(x + 2, y + h - 12, 8, 6, 0x8a2a24); R(x + 2, y + h - 14, 2, 8, 0x8a2a24); R(x + 2, y + h - 12, 8, 1, 0xb04a3a);   // läsfåtöljen
  } else if (kind === 'loppis') {
    R(x + 1, y + 3, w - 2, 1, 0x8a8e96);                                                     // klädstången
    for (let i = x + 3; i < x + w - 4; i += 6) { const c = [0xd84a6a, 0x3a6ab0, 0xf0c040, 0x5aa060, 0xe8e0d0][(i + seed) % 5]; G(i + 2, y + 4, 0x8a8e96); R(i, y + 5, 5, 8, c); R(i + 1, y + 13, 3, 2, mul(c, 0.8)); }
    R(x + w - 9, y + 15, 6, 7, 0xc8a050); R(x + w - 8, y + 16, 4, 5, 0xb8d4e4);              // en spegel i guldram
    shelf(y + 17, 0x8a6a4a); for (let i = x + 2; i < x + w - 12; i += 6) R(i, y + 14, 4, 3, [0xf4f0e8, 0xd8c8a0, 0x9ab8d0][(i + seed) % 3]);   // porslin
  } else if (kind === 'cykel') {
    for (let i = x + 1; i < x + w - 1; i += 2) for (let j = y + 1; j < y + h - 6; j += 2) G(i, j, 0xa8acb0);                // hålplankan
    for (let i = x + 3; i < x + w - 3; i += 4) { R(i, y + 3 + ((i + seed) % 3), 1, 5, 0x4a4e58); G(i, y + 2 + ((i + seed) % 3), 0xc84a3a); }   // verktygen
    const cx = x + (w >> 1), cy = y + 12;
    for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; G(Math.round(cx - 8 + Math.cos(an) * 4), Math.round(cy + Math.sin(an) * 4), 0x2a2a30); }   // ett hjul på väggen
  } else if (kind === 'glass') {
    for (let i = x + 2; i < x + w - 4; i += 5) { R(i, y + h - 6, 4, 3, 0xd8dce0); R(i, y + h - 7, 4, 1, [0xf8c8d8, 0xf8f0d0, 0x8a5a3a, 0xa8e0b0, 0xf0d060][(i + seed) % 5]); }
  }
}
function displayFront(T, x, y, w, h, kind, night, seed, anim) {
  const G = (px, py, c, a = 1) => { if (px >= x && px < x + w && py >= y && py < y + h) T.px(px, py, c, a); };
  const R = (px, py, pw, ph, c) => { for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) G(px + i, py + j, c); };
  const by = y + h - 1;
  const counter = (c, ch = 6) => { R(x, by - ch + 1, w, ch, c); R(x, by - ch + 1, w, 1, mix(c, WHITE, 0.3)); R(x, by - ch + 2, w, 1, mul(c, 0.8)); };
  if (kind === 'kafe') {
    counter(0x7a4a2a, 5);
    for (let i = x + 3; i < x + w - 8; i += 12) { R(i, by - 9, 7, 4, 0xf8c8d8); R(i, by - 9, 7, 1, WHITE); G(i + 3, by - 10, 0xd8303a); R(i - 1, by - 5, 9, 1, 0xd8d8e0); }  // tårtorna under glaskupor
    for (let i = x + 10; i < x + w - 3; i += 12) { R(i, by - 6, 3, 2, WHITE); G(i + 3, by - 6, 0xd8d8e0); if (anim) anim.push([i + 1, by - 7, 'anga']); }              // kaffekoppar som ångar
  } else if (kind === 'bageri') {
    counter(0xe8e4dc, 7);                                                                    // marmordisken med glas
    for (let i = x + 2; i < x + w - 4; i += 5) { const k = (i + seed) % 3; if (k === 0) { R(i, by - 9, 4, 3, 0xc88a4a); G(i + 1, by - 8, 0xf8e8c0); } else if (k === 1) { R(i, by - 9, 4, 3, 0xf0d8a0); R(i + 1, by - 8, 2, 1, 0xd84a6a); } else { R(i, by - 9, 4, 3, 0x6a3a1a); G(i + 1, by - 9, 0xf8f0e0); } }
    R(x, by - 10, w, 1, 0xd8e8f0); if (anim) anim.push([x + 4, by - 11, 'anga']);
  } else if (kind === 'gard') {
    counter(0x8a6238, 6);
    for (let i = x + 1; i < x + w - 6; i += 9) {                                             // lådor med grönsaker på disken
      R(i, by - 9, 8, 4, 0xb08a58); R(i, by - 9, 8, 1, 0xd8b480);
      const c = [0xe0802a, 0xd8302a, 0x6ab04a, 0xc8a050, 0xe0701c][(i + seed) % 5];
      for (let k = 0; k < 4; k++) R(i + k * 2, by - 11 + (k & 1), 2, 2, k & 1 ? mul(c, 0.85) : c);
    }
  } else if (kind === 'pynt') {
    for (let i = x + 3; i < x + w - 5; i += 9) {                                            // lyktor med levande ljus
      R(i, by - 8, 5, 8, 0x2a2a30); R(i + 1, by - 7, 3, 6, 0xe8eef0); G(i + 2, by - 9, 0x2a2a30); R(i + 2, by - 4, 1, 3, 0xf4f0e0);
      if (anim) anim.push([i + 2, by - 5, 'laga']);
    }
  } else if (kind === 'blommor') {
    for (let i = x + 1; i < x + w - 4; i += 6) {                                            // zinkhinkar med snittblommor
      const c = FLAGS[(i + seed) % 6];
      R(i, by - 4, 5, 4, 0x9aa0aa); R(i, by - 4, 5, 1, 0xd8dce0);
      for (let k = 0; k < 5; k++) { R(i + k, by - 6 - (k % 3), 1, 2, 0x3e7a34); G(i + k, by - 8 - (k % 3), c); G(i + k, by - 9 - ((k + 1) % 2), mix(c, WHITE, 0.3)); }
    }
  } else if (kind === 'antik') {
    for (let k = 0; k < 4; k++) R(x + 2, by - 1 - k * 2, 10 - k, 2, BOOKS[(k + seed) % BOOKS.length]);                         // bokhögar på fönsterbänken
    for (let k = 0; k < 3; k++) R(x + w - 11, by - 1 - k * 2, 9 - k, 2, BOOKS[(k + 3 + seed) % BOOKS.length]);
    const cx = x + (w >> 1) - 4;                                                             // katten som sover i fönstret
    R(cx, by - 3, 8, 3, 0xd8902a); R(cx + 1, by - 4, 6, 1, 0xe8a03a); R(cx + 6, by - 5, 3, 3, 0xd8902a); G(cx + 6, by - 6, 0xd8902a); G(cx + 8, by - 6, 0xd8902a);
    G(cx + 7, by - 4, 0x6a4a2a); G(cx + 2, by - 2, 0xf0c070); G(cx + 4, by - 2, 0xf0c070);
    if (anim) anim.push([cx - 1, by - 2, 'svans']);
    R(x + w - 5, by - 9, 1, 6, 0x8a6a2a); R(x + w - 8, by - 10, 6, 2, 0x2a6a4a); R(x + w - 7, by - 9, 4, 1, 0xfff0b0);       // den gröna läslampan
  } else if (kind === 'loppis') {
    R(x + 3, by - 12, 7, 4, 0xe8c070); R(x + 6, by - 8, 1, 7, 0x8a6a4a); R(x + 4, by - 1, 5, 1, 0x5a4030);                   // golvlampa
    R(x + 13, by - 5, 6, 5, 0xb07a4a); G(x + 13, by - 6, 0xb07a4a); G(x + 18, by - 6, 0xb07a4a); G(x + 15, by - 4, 0x2a2a30); G(x + 17, by - 4, 0x2a2a30);  // nalle
    for (let i = x + w - 13; i < x + w - 3; i += 3) R(i, by - 6, 2, 6, [0x2a2a30, 0xd84a3a, 0x3a6ab0, 0xf0c040][(i + seed) % 4]);   // skivor
    for (let i = x + 5; i < x + w - 5; i += 9) { G(i, y + 1, 0xd8d0c0); G(i, y + 2, 0xd8d0c0); R(i - 1, y + 3, 3, 2, 0xfaf6ea); G(i, y + 3, 0xc84a3a); }  // prislappar i snören
    if (anim) anim.push([x + (w >> 1), y + 1, 'mobil']);
  } else if (kind === 'cykel') {
    const cx = x + (w >> 1) + 2, cy = by - 6;                                                // en cykel i reparationsstället
    R(cx - 1, by - 3, 3, 4, 0x4a4e58); R(cx - 4, by, 9, 1, 0x3a3e46);
    T.line(cx - 9, cy, cx, cy - 2, 0xd84a3a); T.line(cx, cy - 2, cx + 7, cy, 0xd84a3a); T.line(cx - 2, cy - 6, cx, cy - 2, 0xd84a3a);
    for (const hx of [cx - 9, cx + 7]) for (let a = 0; a < 20; a++) { const an = a / 20 * Math.PI * 2; G(Math.round(hx + Math.cos(an) * 4), Math.round(cy + Math.sin(an) * 4), 0x24242a); }
    if (anim) anim.push([cx + 7, cy, 'hjul']);
    R(x + 2, by - 4, 7, 4, 0xc84a3a); R(x + 2, by - 4, 7, 1, 0xe86a5a);                     // verktygslådan
  }
  // glaset: reflexstrimmor och ljus överkant
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j + seed * 5) % 17;
    if (d === 0 || d === 1) T.px(x + i, y + j, WHITE, night ? 0.06 : 0.24);
    else if (d === 3) T.px(x + i, y + j, WHITE, night ? 0.03 : 0.1);
  }
  T.hl(x, y, w, WHITE, night ? 0.08 : 0.28);
}
// smått brus till marken under växterna i blomsterhandeln
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

// Ett skyltfönster: interiören i fasaden + överbilden (disk, glas, spröjs, ram) som live() lägger
// ovanpå expediten. o: { kind, frame, panes [cellbredd, cellhöjd], arch, curtain, glassText, open, warm, keeper }
function shopWin(P, K, a, y0, z, y1, o = {}) {
  const w = z - a, h = y1 - y0, col = o.frame ?? 0xf4efe4, lo = mul(col, 0.62), hi = mix(col, WHITE, 0.35);
  const F = new Pix(w + 2, h + 2, a - 1, y0 - 1), anim = [];
  P.box(a - 1, y0 - 1, w + 2, h + 2, OUT);
  displayBack(P, a, y0, w, h, o.kind, K.night, K.seed + a, anim, o.warm);
  for (const T of [P, F]) {
    displayFront(T, a, y0, w, h, o.kind, K.night, K.seed + a, T === P ? anim : null);
    if (o.curtain) {                                                                         // halvgardin (kaféet) med spets
      const cy0 = y0 + Math.round(h * 0.42), cy1 = y0 + Math.round(h * 0.7);
      T.hl(a, cy0 - 1, w, 0x8a8e96);
      for (let y = cy0; y < cy1; y++) for (let x = a; x < z; x++) T.px(x, y, (x + (y >> 1)) % 3 ? o.curtain : mul(o.curtain, 0.9), 0.95);
      for (let x = a; x < z; x += 2) T.px(x, cy1, o.curtain);
    }
    if (o.glassText) {                                                                       // guldbokstäver på glaset (bageriet)
      const tw = textW(SMALL, o.glassText), tx = a + ((w - tw) >> 1);
      eachTextPixel(SMALL, o.glassText, tx, y0 + 3, 1, (px, py) => { T.px(px, py, 0xf2cc5a); T.px(px + 1, py + 1, 0x6a4a1a, 0.6); });
    }
    if (o.panes) {                                                                           // småspröjsat
      const [cw, ch] = o.panes;
      for (let x = a + cw; x < z - 1; x += cw) T.vl(x, y0, h, col);
      for (let y = y0 + ch; y < y1 - 1; y += ch) T.hl(a, y, w, col);
    } else if (!o.open) { T.vl(a + (w >> 1), y0, h, col, 0.95); T.hl(a, y0 + 5, w, col, 0.95); }
    if (o.arch) {                                                                            // rundbåge: hörnen ovanför bågen är vägg
      const r = w / 2, cx = a + r, cy = y0 + r;
      for (let y = y0; y < cy; y++) for (let x = a - 1; x <= z; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r + 1) T.px(x, y, o.wall ?? col); else if (d > r - 1) T.px(x, y, d > r ? lo : hi);
      }
      for (let y = Math.round(cy); y < y1; y++) { T.px(a - 1, y, hi); T.px(z, y, lo); }
    } else if (!o.open) { T.box(a, y0, w, h, col); T.hl(a, y0, w, hi); T.vl(z - 1, y0, h, lo); }
  }
  K.wins.push({ x: K.wx(a), y: K.wy(y0), w, h, F, anim: anim.map(([x, y, t]) => [K.wx(x), K.wy(y), t]), keeper: o.keeper !== false });
  K.shop.push([K.wx(a), K.wy(y0), w, h]);
}
// skylten: förgyllda/målade bokstäver på ett band, en bräda eller direkt på väggen
function signBoard(P, x0, x1, y, s, o = {}) {
  const F = textW(BIG, s) + 8 <= x1 - x0 ? BIG : SMALL, tw = textW(F, s), h = o.h ?? 11, bg = o.bg;
  if (bg !== undefined) {
    P.rect(x0, y, x1 - x0, h, bg); P.hl(x0, y, x1 - x0, mix(bg, WHITE, 0.22)); P.hl(x0, y + h - 1, x1 - x0, mul(bg, 0.7));
    if (o.border !== undefined) P.box(x0 - 1, y - 1, x1 - x0 + 2, h + 2, o.border);
    if (o.scroll) for (const ex of [x0 - 3, x1 + 1]) { P.rect(ex, y + 2, 2, h - 4, bg); P.px(ex + (ex < x0 ? 0 : 1), y + 1, mul(bg, 0.8)); P.px(ex + (ex < x0 ? 0 : 1), y + h - 2, mul(bg, 0.8)); }
    P.hl(x0 + 1, y + h, x1 - x0 - 1, 0x000000, 0.3);
  }
  signText(P, F, s, x0 + ((x1 - x0 - tw) >> 1) + (o.tilt ? 0 : 0), y + ((h - F.h) >> 1), o.fg ?? 0xf2cc5a, o.shadow ?? 0x1a1418, o.hi ?? 0xfff0b0);
}
// dörrsmygen (dörrbladet ritas av live()) + trappsteget; dörren når aldrig upp till skylten
function doorWay(P, K, col) {
  const { GB, dx0, dx1 } = K, hi = mix(col, WHITE, 0.3);
  P.rect(dx0 - 1, GB - DOOR_H - 3, dx1 - dx0 + 2, DOOR_H + 3, OUT);
  P.rect(dx0, GB - DOOR_H - 2, dx1 - dx0, 2, hi);
  P.rect(dx0 - 3, GB - 1, dx1 - dx0 + 6, 1, 0x9a948a);
  P.rect(dx0 - 4, GB, dx1 - dx0 + 8, 2, 0xcac4b8); P.hl(dx0 - 4, GB, dx1 - dx0 + 8, 0xeae4d8);
}
const woodFront = (P, L, R, top, GB, col) => { for (let y = top; y < GB; y++) for (let x = L; x < R; x++) P.px(x, y, mul(col, 0.92 + hash(x >> 1, y >> 2, 31) * 0.1)); };
const panelRow = (P, a, z, y, col) => {                                                      // bröstning med fyllningar
  const lo = mul(col, 0.62);
  P.rect(a - 1, y, z - a + 2, 7, col); P.hl(a - 1, y, z - a + 2, mix(col, WHITE, 0.3));
  const n = Math.max(1, Math.round((z - a) / 12)), pw = Math.floor((z - a - 2) / n);
  for (let k = 0; k < n; k++) P.box(a + 1 + k * pw, y + 2, pw - 2, 4, lo);
};
const pilaster = (P, x, y0, y1, col) => { const hi = mix(col, WHITE, 0.3), lo = mul(col, 0.62); P.rect(x, y0, 4, y1 - y0, col); P.vl(x, y0, y1 - y0, hi); P.vl(x + 3, y0, y1 - y0, lo); P.rect(x - 1, y0, 6, 2, hi); P.hl(x - 1, y0 + 1, 6, lo); };
// bågad markis med text på kappan (kaféet): duk, kappa med bokstäver, våglist
function valanceAwning(P, x0, x1, y, c1, c2, s) {
  for (let j = 0; j < 7; j++) for (let x = x0 - 2; x < x1 + 2; x++) { const st = ((x - x0 + 400) >> 2) & 1 ? c2 : c1; P.px(x, y + j, mix(mix(st, 0xfff8e8, 0.15), mul(st, 0.78), j / 7)); }
  P.hl(x0 - 2, y, x1 - x0 + 4, mul(c1, 0.55));
  for (let j = 7; j < 17; j++) for (let x = x0 - 2; x < x1 + 2; x++) P.px(x, y + j, j === 7 ? mix(c1, WHITE, 0.2) : j === 16 ? mul(c1, 0.75) : c1);
  for (let x = x0 - 2; x < x1 + 2; x++) { const u = (x - x0 + 400) % 6; if (u > 0 && u < 5) P.px(x, y + 17, mul(c1, 0.85)); if (u > 1 && u < 4) P.px(x, y + 18, mul(c1, 0.75)); }
  P.darken(x0, y + 19, x1 - x0, 2, 0.7);
  const tw = textW(BIG, s);
  signText(P, BIG, s, x0 + ((x1 - x0 - tw) >> 1), y + 8, 0xfaf6ee, mul(c1, 0.5), WHITE);
}
// kupolmarkis (korgmarkis) över ett rundbågefönster: radiella ränder och en bågad kant
function domeAwning(P, cx, y, r, c1, c2) {
  for (let j = 0; j <= r; j++) for (let i = -r - 1; i <= r + 1; i++) {
    const d = Math.hypot(i, (j - r) * 1.6);
    if (d > r + 1) continue;
    const an = Math.atan2(r - j, i), st = Math.floor((an / Math.PI) * 9) & 1 ? c2 : c1;
    P.px(cx + i, y + j, d > r ? mul(st, 0.6) : mix(st, mul(st, 0.75), j / (r + 1)));
  }
  for (let i = -r; i <= r; i++) { const u = (i + 400) % 4; if (u === 1 || u === 2) P.px(cx + i, y + r + 1, mul(c1, 0.8)); }
  P.darken(cx - r, y + r + 2, 2 * r + 1, 2, 0.75);
}

// ---------- de åtta butiksfasaderna ----------
const SHOP_H = 50;   // butiksdelens höjd: skylten sitter alltid ovanför dörren (dörren är DOOR_H + 3 hög)
function shopfront(P, K, o) {
  const { L, R, GB, dx0, dx1 } = K, top = GB - SHOP_H, col = o.col, hi = mix(col, WHITE, 0.3), lo = mul(col, 0.62);
  const sign = o.sign || K.b.sign || '';
  switch (o.style) {
    case 'kafe': {   // KAFÉ LINDEN: markis med texten på kappan, stora fönster med halvgardiner
      woodFront(P, L, R, top, GB, col);
      valanceAwning(P, L + 2, R - 2, top - 2, o.awning[0], o.awning[1], sign);
      shopWin(P, K, L + 4, top + 19, dx0 - 5, GB - 9, { kind: 'kafe', frame: hi, curtain: 0xfaf6ee, keeper: true });
      shopWin(P, K, dx1 + 5, top + 19, R - 4, GB - 9, { kind: 'kafe', frame: hi, curtain: 0xfaf6ee, keeper: false });
      panelRow(P, L + 4, dx0 - 5, GB - 8, col); panelRow(P, dx1 + 5, R - 4, GB - 8, col);
      pilaster(P, L, top + 17, GB, col); pilaster(P, R - 4, top + 17, GB, col);
      doorWay(P, K, col);
      return { top, fy: top + 5, fh: 12 };
    }
    case 'lada': {   // GÅRDSBUTIKEN: ladans väggar ner till marken, en uppslagen ladport, skylten på en bräda
      boards(P, L, top, R - L, GB - top, K.wall, K.seed);
      for (const x of [L, R - 3]) { P.rect(x, top, 3, GB - top, K.trim); P.vl(x + 2, top, GB - top, mul(K.trim, 0.72)); }
      for (let y = GB - 5; y < GB; y++) for (let x = L; x < R; x++) P.px(x, y, mix(0x6e6c6a, 0x8e8a86, hash(x, y, 32) * 0.8));
      const ox0 = dx0 - 12, ox1 = dx1 + 12, oy0 = GB - 38;
      // de uppslagna portbladen mot väggen (Z-regel i vitt)
      for (const [a, z] of [[ox0 - 15, ox0 - 1], [ox1 + 1, ox1 + 15]]) {
        boards(P, a, oy0, z - a, GB - 1 - oy0, mul(K.wall, 0.86), K.seed + a);
        P.box(a, oy0, z - a, GB - 1 - oy0, K.trim); P.line(a + 1, GB - 3, z - 2, oy0 + 2, K.trim); P.hl(a, oy0 + 12, z - a, K.trim); P.hl(a, GB - 12, z - a, K.trim);
        P.darken(a < ox0 ? a - 2 : z, oy0 + 1, 2, GB - 2 - oy0, 0.7);
      }
      // portöppningen: butiken innanför (expediten står bakom disken), vit karm och överstycke
      shopWin(P, K, ox0, oy0, ox1, GB - 1, { kind: 'gard', open: true, keeper: true });
      P.rect(ox0 - 3, oy0 - 4, ox1 - ox0 + 6, 4, K.trim); P.hl(ox0 - 3, oy0 - 4, ox1 - ox0 + 6, WHITE); P.hl(ox0 - 3, oy0 - 1, ox1 - ox0 + 6, mul(K.trim, 0.7));
      P.vl(ox0 - 1, oy0, GB - oy0, K.trim); P.vl(ox1, oy0, GB - oy0, mul(K.trim, 0.8));
      // skylten: en ljus bräda i två kedjor under takfoten
      const sw = textW(BIG, sign) + 12, sx0 = L + ((R - L - sw) >> 1);
      P.vl(sx0 + 4, top - 4, 6, 0x5a5a60); P.vl(sx0 + sw - 5, top - 4, 6, 0x5a5a60);
      signBoard(P, sx0, sx0 + sw, top + 1, sign, { bg: o.fascia, fg: o.signFg, hi: o.signHi, shadow: 0xc8b490, border: 0x5a3a24 });
      // griffeltavla vid porten
      const gx = R - 14;
      P.rect(gx, oy0 + 4, 10, 13, 0x6a4a2a); P.rect(gx + 1, oy0 + 5, 8, 11, 0x2a3430);
      text(P, SMALL, 'ÄGG', gx + 1, oy0 + 6, 0xf4f1ea, 0.9); P.hl(gx + 2, oy0 + 13, 5, 0xf4d23c, 0.9);
      // fönster med fyra rutor högt upp till vänster
      win(P, L + 6, top + 18, 10, 10, { frame: K.trim, night: K.night, lit: litOf(K.night, 3, K.seed), seed: K.seed + 2, sill: false, transom: false });
      lantern(P, ox0 - 26, top + 22, K.night, K.glows, K.wx, K.wy);
      return { top, fy: top + 1, fh: 11 };
    }
    case 'bage': {   // PYNT & TING: vita snickerier, rundbågade fönster med kupolmarkiser, solfjäder över dörren
      woodFront(P, L, R, top, GB, col);
      signBoard(P, L + 10, R - 10, top - 1, sign, { bg: o.fascia, fg: o.signFg, hi: WHITE, scroll: true, border: 0x2a2030 });
      for (const [a, z] of [[L + 6, dx0 - 7], [dx1 + 7, R - 6]]) {
        const r = (z - a) >> 1, cx = a + r;
        shopWin(P, K, a, top + 22, z, GB - 9, { kind: 'pynt', frame: hi, arch: true, wall: col, keeper: a === L + 6 });
        domeAwning(P, cx, top + 15, r + 2, o.awning[0], o.awning[1]);
        panelRow(P, a, z, GB - 8, col);
      }
      // solfjäderformat överljus över dörren
      const fx = (dx0 + dx1) >> 1, fr = Math.min(6, (dx1 - dx0) >> 1);
      for (let y = GB - DOOR_H - 3 - fr; y < GB - DOOR_H - 3; y++) for (let x = dx0 - 1; x <= dx1; x++) {
        const d = Math.hypot(x + 0.5 - fx, y + 0.5 - (GB - DOOR_H - 3)), an = Math.atan2(GB - DOOR_H - 3 - y, x - fx);
        if (d > fr + 1) continue;
        P.px(x, y, d > fr - 1 ? OUT : Math.abs(((an / Math.PI) * 6) % 1 - 0.5) < 0.12 ? hi : K.night ? 0xffd88a : 0xb8d4e4);
      }
      if (K.night) K.glows.push([K.wx(dx0 + 2), K.wy(GB - DOOR_H - 3 - fr + 2), dx1 - dx0 - 4, fr - 2, 0xffd080, 0.35]);
      doorWay(P, K, col);
      return { top, fy: top + 2, fh: 11 };
    }
    case 'konditori': {   // BAGERIET: brunt trä, två rader på skylten, guldtext på glaset, randig markis
      woodFront(P, L, R, top, GB, col);
      const fy = top + 1, fh = 16;
      P.rect(L, fy, R - L, fh, o.fascia); P.hl(L, fy, R - L, mix(o.fascia, WHITE, 0.2)); P.hl(L, fy + fh - 1, R - L, mul(o.fascia, 0.7));
      P.hl(L - 1, fy + fh, R - L + 2, hi); P.hl(L - 1, fy + fh + 1, R - L + 2, lo);
      signText(P, BIG, sign, L + ((R - L - textW(BIG, sign)) >> 1), fy + 2, 0xf2cc5a, 0x1a1418, 0xfff0b0);
      text(P, SMALL, 'KONDITORI', L + ((R - L - textW(SMALL, 'KONDITORI')) >> 1), fy + 10, 0xe8d8b0, 0.85);
      awning(P, L + 2, fy + fh + 3, R - L - 4, 5, o.awning[0], o.awning[1], { stripe: 5, drop: 3, ext: 2 });
      shopWin(P, K, L + 5, top + 28, dx0 - 4, GB - 9, { kind: 'bageri', frame: hi, glassText: 'BRÖD', keeper: true });
      shopWin(P, K, dx1 + 4, top + 28, R - 5, GB - 9, { kind: 'bageri', frame: hi, glassText: 'KAKOR', keeper: false });
      panelRow(P, L + 5, dx0 - 4, GB - 8, col); panelRow(P, dx1 + 4, R - 5, GB - 8, col);
      pilaster(P, L, top + 19, GB, col); pilaster(P, R - 4, top + 19, GB, col);
      doorWay(P, K, col);
      return { top, fy, fh };
    }
    case 'orangeri': {   // BLOMSTER: glasfasad i grönt smide med småspröjs, glastak, vit skylttavla
      for (let y = top; y < GB; y++) for (let x = L; x < R; x++) P.px(x, y, mul(col, 0.9 + hash(x >> 1, y >> 2, 33) * 0.1));
      signBoard(P, L + 8, R - 8, top + 1, sign, { bg: 0xf8f4ea, fg: col, hi: mix(col, WHITE, 0.3), shadow: 0xc8c0b0, border: col, scroll: true });
      for (let j = 0; j < 6; j++) for (let x = L - 2; x < R + 2; x++) {                       // glastaket
        const sx = (x - L + 400) % 8;
        P.px(x, top + 13 + j, sx === 0 ? col : j === 0 ? hi : mix(0xd8ecf4, 0x9ac4d8, j / 6), sx === 0 ? 1 : 0.9);
      }
      P.hl(L - 2, top + 19, R - L + 4, col); P.darken(L, top + 20, R - L, 2, 0.75);
      shopWin(P, K, L + 3, top + 22, dx0 - 3, GB - 6, { kind: 'blommor', frame: col, panes: [6, 7], keeper: true });
      shopWin(P, K, dx1 + 3, top + 22, R - 3, GB - 6, { kind: 'blommor', frame: col, panes: [6, 7], keeper: false });
      for (let y = GB - 5; y < GB; y++) for (let x = L; x < R; x++) P.px(x, y, mix(0x6e6c6a, 0x8e8a86, hash(x, y, 32) * 0.8));
      doorWay(P, K, col);
      return { top, fy: top + 1, fh: 11 };
    }
    case 'bursprak': {   // ANTIKVARIAT: mörkgrönt, guldskylt, ett burspråk med småspröjs och varmt ljus, läslampa och katt
      woodFront(P, L, R, top, GB, col);
      const fy = top + 1, fh = 12;
      P.rect(L, fy, R - L, fh, o.fascia); P.hl(L, fy, R - L, mix(o.fascia, WHITE, 0.18)); P.hl(L, fy + fh - 1, R - L, mul(o.fascia, 0.7));
      P.hl(L - 1, fy + fh, R - L + 2, hi); P.hl(L - 1, fy + fh + 1, R - L + 2, lo); P.darken(L, fy + fh + 2, R - L, 1, 0.8);
      for (let x = L + 2; x < R - 2; x += 3) P.px(x, fy + 1, 0xc8a44a);                     // guldkant
      signText(P, BIG, sign, L + ((R - L - textW(BIG, sign)) >> 1), fy + 3, 0xf2cc5a, 0x0a1a12, 0xfff0b0);
      // burspråket: kopparhuv, sidorutor i perspektiv, sockel
      const a = L + 6, z = dx0 - 8, wy0 = top + 21, wy1 = GB - 12;
      for (let r = 0; r < 5; r++) P.hl(a - 4 + r, wy0 - 6 + r, z - a + 8 - r * 2, r === 0 ? 0x9ac0a8 : r < 3 ? 0x5a9a80 : 0x3e7a62);
      for (const [sx, d] of [[a - 4, 1], [z, -1]]) for (let y = wy0; y < wy1; y++) for (let i = 0; i < 4; i++) P.px(sx + i, y, i === (d > 0 ? 0 : 3) ? OUT : y % 5 === 0 ? col : mix(0xffd890, 0xc87a3a, 0.4 + i * 0.1));
      shopWin(P, K, a, wy0, z, wy1, { kind: 'antik', frame: hi, panes: [5, 5], warm: true, keeper: true });
      for (let y = wy1; y < GB - 2; y++) for (let x = a - 4; x < z + 4; x++) P.px(x, y, y === wy1 ? hi : (x - a + 400) % 9 === 0 ? lo : col);
      P.darken(a - 4, GB - 2, z - a + 8, 2, 0.7);
      shopWin(P, K, dx1 + 5, top + 20, R - 5, GB - 9, { kind: 'antik', frame: hi, panes: [5, 6], warm: true, keeper: false });
      panelRow(P, dx1 + 5, R - 5, GB - 8, col);
      // dörrklockan i mässing
      P.px(dx1 - 3, GB - DOOR_H - 5, 0x8a6a2a); P.rect(dx1 - 4, GB - DOOR_H - 4, 3, 2, 0xe8c050); P.px(dx1 - 3, GB - DOOR_H - 2, 0x8a6a2a);
      doorWay(P, K, col);
      // varmt sken ur fönstren även på dagen
      K.glows.push([K.wx(a), K.wy(wy0), z - a, wy1 - wy0, 0xffc060, 0.2]);
      return { top, fy, fh };
    }
    case 'loppis': {   // LOPPISEN: ockra bräder ner till marken, handmålad sned skylt med hjärtan, olika fönster
      boards(P, L, top, R - L, GB - top, K.wall, K.seed);
      for (const x of [L, R - 3]) { P.rect(x, top, 3, GB - top, K.trim); P.vl(x + 2, top, GB - top, mul(K.trim, 0.72)); }
      const sw = textW(BIG, sign) + 22, sx0 = L + ((R - L - sw) >> 1);
      for (let j = 0; j < 13; j++) for (let i = 0; i < sw; i++) {                             // brädan lutar en aning
        const yy = top + 1 + j + Math.round(i / sw * 2);
        P.px(sx0 + i, yy, j === 0 || j === 12 ? 0x8a5a3a : (i + 400) % 9 === 0 ? 0xd8c8a8 : 0xf4ecd8);
      }
      for (const hx of [sx0 + 4, sx0 + sw - 8]) { P.px(hx, top + 5, 0xe8443a); P.px(hx + 2, top + 5, 0xe8443a); P.hl(hx, top + 6, 3, 0xe8443a); P.px(hx + 1, top + 7, 0xe8443a); }   // hjärtan
      signText(P, BIG, sign, sx0 + 11, top + 4, 0xc8443a, 0xf4ecd8, 0xe86a5a);
      P.px(sx0 + 2, top + 2, 0x5a5a60); P.px(sx0 + sw - 3, top + 4, 0x5a5a60);                // spikarna
      shopWin(P, K, L + 5, top + 19, dx0 - 4, GB - 6, { kind: 'loppis', frame: 0x3a6ab0, keeper: true });
      shopWin(P, K, dx1 + 5, top + 19, R - 5, GB - 8, { kind: 'loppis', frame: 0xd84a6a, arch: true, wall: K.wall, keeper: false });
      for (let y = GB - 5; y < GB; y++) for (let x = L; x < R; x++) if (y > GB - 4 || (x - L) % 7) P.px(x, y, mix(0x6e6c6a, 0x8e8a86, hash(x, y, 32) * 0.8));
      doorWay(P, K, 0x3a6ab0);
      return { top, fy: top + 1, fh: 13 };
    }
    case 'verkstad': {   // CYKELVERKSTAN: röd skylt, ett smalt fönster och en halvöppen garageport med verkstaden innanför
      for (let y = top; y < GB; y++) for (let x = L; x < R; x++) P.px(x, y, mul(K.wall, 0.92 + hash(x >> 1, y >> 2, 35) * 0.08));
      signBoard(P, L + 2, R - 2, top + 1, sign, { bg: o.fascia, fg: o.signFg, hi: WHITE, shadow: 0x5a1a14, border: 0x2a2a30 });
      shopWin(P, K, L + 5, top + 18, dx0 - 4, GB - 8, { kind: 'cykel', frame: 0x4a4e58, keeper: false });
      const ga = dx1 + 4, gz = R - 4, gy0 = top + 16;
      P.box(ga - 2, gy0 - 2, gz - ga + 4, GB - gy0 + 2, 0x2a2a30);
      for (let y = gy0; y < gy0 + 13; y++) P.hl(ga, y, gz - ga, (y - gy0) % 3 === 2 ? 0x6a6e78 : mix(0xb8bcc4, 0x9aa0aa, (y - gy0) / 13));   // jalusiporten halvvägs uppe
      P.hl(ga, gy0 + 13, gz - ga, 0x3a3e46); P.rect(ga + ((gz - ga) >> 1) - 2, gy0 + 11, 4, 1, 0x2a2a30);
      shopWin(P, K, ga, gy0 + 14, gz, GB - 1, { kind: 'cykel', open: true, keeper: true });
      doorWay(P, K, 0x4a4e58);
      return { top, fy: top + 1, fh: 11 };
    }
    default: {
      woodFront(P, L, R, top, GB, col);
      signBoard(P, L, R, top + 1, sign, { bg: o.fascia ?? lo, fg: o.signFg, hi: o.signHi });
      shopWin(P, K, L + 5, top + 17, dx0 - 4, GB - 9, { kind: o.kind, frame: hi });
      shopWin(P, K, dx1 + 4, top + 17, R - 5, GB - 9, { kind: o.kind, frame: hi, keeper: false });
      doorWay(P, K, col);
      return { top, fy: top + 1, fh: 11 };
    }
  }
}

// ---------- livet bakom fönstren ----------
// expediten går fram och tillbaka bakom disken, vinkar och hälsar när man kommer fram till dörren;
// de små rörelserna: ånga ur kopparna, levande ljus, kattens svans, hjulet som snurrar …
const WALK = [1, 3, 2, 3];
function drawAnim(ctx, [x, y, kind], t, night) {
  if (kind === 'anga') for (let i = 0; i < 3; i++) {
    const ph = (t * 0.7 + i / 3 + (x & 7) * 0.13) % 1;
    ctx.fillStyle = rgba(0xffffff, 0.55 * (1 - ph));
    ctx.fillRect(Math.round(x + Math.sin(t * 2 + i * 2 + x) * 1.2), Math.round(y - ph * 7), 1, 1);
  } else if (kind === 'laga') {
    const f = Math.floor(t * 9 + x) % 3;
    ctx.fillStyle = f === 0 ? '#fff4b0' : f === 1 ? '#ffc040' : '#ff9a30'; ctx.fillRect(x, y - (f === 2 ? 1 : 0), 1, 2);
    ctx.fillStyle = rgba(0xffd070, 0.25); ctx.fillRect(x - 1, y - 1, 3, 3);
  } else if (kind === 'svans') {
    const s = Math.round(Math.sin(t * 2.2 + x) * 1.5);
    ctx.fillStyle = '#d8902a'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y - 1 + (s > 0 ? 1 : 0), 1, 1); ctx.fillRect(x - 2, y - 2 + s, 1, 1);
  } else if (kind === 'hjul') {
    const a = t * 7;
    ctx.fillStyle = '#c8ccd4';
    for (const d of [0, Math.PI / 2]) for (let r = -3; r <= 3; r++) ctx.fillRect(Math.round(x + Math.cos(a + d) * r), Math.round(y + Math.sin(a + d) * r), 1, 1);
  } else if (kind === 'fjaril') {
    const fx = x + Math.sin(t * 0.9 + x) * 9, fy = y + Math.sin(t * 1.7) * 4, up = Math.floor(t * 8) % 2;
    ctx.fillStyle = '#f8e070'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - up, 1, 1); ctx.fillRect(Math.round(fx) + 1, Math.round(fy) - up, 1, 1);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
  } else if (kind === 'mobil') {
    const s = Math.round(Math.sin(t * 1.4 + x) * 2);
    ctx.fillStyle = '#d8c070'; ctx.fillRect(x + s, y + 2, 1, 2); ctx.fillRect(x - 1 + s, y + 4, 3, 1);
  } else if (kind === 'ugn') {
    ctx.fillStyle = rgba(0xff9a30, 0.25 + 0.2 * Math.abs(Math.sin(t * 3 + x))); ctx.fillRect(x - 3, y - 1, 6, 3);
  } else if (kind === 'lampa' && night) {
    ctx.fillStyle = rgba(0xffe0a0, 0.25); ctx.fillRect(x - 2, y, 5, 3);
  }
}
function bubble(ctx, cx, y, s) {
  const tw = textW(SMALL, s), w = tw + 6, h = 10, x = Math.round(cx - w / 2);
  ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#fbf8f0'; ctx.fillRect(x, y, w, h);
  ctx.fillRect(Math.round(cx) - 1, y + h, 3, 1); ctx.fillRect(Math.round(cx), y + h + 1, 1, 1);
  ctx.fillStyle = '#1e1a24'; ctx.fillRect(Math.round(cx) - 2, y + h, 1, 1); ctx.fillRect(Math.round(cx) + 2, y + h, 1, 1); ctx.fillRect(Math.round(cx) - 1, y + h + 1, 1, 1); ctx.fillRect(Math.round(cx) + 1, y + h + 1, 1, 1); ctx.fillRect(Math.round(cx), y + h + 2, 1, 1);
  ctxText(ctx, SMALL, s, x + 3, y + 3, '#2a2430');
}
function liveWindows(ctx, b, st, S, m) {
  const t = st.t || 0, hour = st.hour ?? 12, [h0, h1] = S.hours || [8, 19];
  // (expediten hälsar på SPELAREN – inte på fotgängarna som också öppnar dörren)
  const pl = st.env?.player, dcx = (b.door.x0 + b.door.x1) / 2;
  const near = !!pl && Math.abs(pl.x - dcx) < (b.door.x1 - b.door.x0) / 2 + 22 && pl.y > baseOf(b) - 6 && pl.y < baseOf(b) + 34;
  const open = hour >= h0 && hour < h1, seed = idSeed(b.id);
  const wins = m.wins || [], kw = wins.filter((w) => w.keeper);
  const kIdx = kw.length ? Math.floor(t / 16 + seed) % kw.length : -1;
  for (const wv of wins) {
    ctx.save(); ctx.beginPath(); ctx.rect(wv.x, wv.y, wv.w, wv.h); ctx.clip();
    for (const a of wv.anim) drawAnim(ctx, a, t, st.night);
    if (open && S.look && kw[kIdx] === wv) {
      const u = 0.5 + 0.5 * Math.sin(t * 0.32 + seed), v = Math.cos(t * 0.32 + seed);
      const x = wv.x + 6 + u * Math.max(0, wv.w - 12);
      let dir = Math.abs(v) < 0.25 ? 'down' : v > 0 ? 'right' : 'left', frame = Math.abs(v) < 0.25 ? 0 : WALK[Math.floor(t * 6) % 4];
      if (near) { dir = 'down'; frame = Math.floor(t * 3) % 2 ? 11 : 0; }
      drawPerson(ctx, x, wv.y + wv.h + 7, S.look, dir, frame);
    }
    ctx.restore();
    if (wv.img) ctx.drawImage(wv.img, wv.x - 1, wv.y - 1);
  }
  if (open && near && S.greet) bubble(ctx, (b.door.x0 + b.door.x1) / 2, baseOf(b) - SHOP_H - 16, S.greet);
}

// ================= huset =================
// S (spec): type 'lhus' | 'shop' | 'kiosk'; upper 'boards' | 'hboards' | 'plaster' | 'brick'; wall, trim,
// stone (bottenvåningen i lhus), roof 'tile' | 'metal', roofCol, dormers [andel], chimneys [andel],
// floors, crown, flowers, door (dörrfärg), shop { kind, col, fascia, signFg, awning [c1, c2] },
// hang [sorten, vänster?], lights, bunt, ivy, rosesAt, mural, cat, balconies, num
function paintLinne(b, night, S, opts = {}) {
  if (S.type === 'krog') return paintKrog(b, night, S, opts);
  const box = artBox(b), P = new Pix(box.w, box.h);
  const L = O, R = O + b.w, GB = baseOf(b) - box.y, yT = GB - b.h;
  const wx = (x) => x + box.x, wy = (y) => y + box.y;
  const seed = idSeed(b.id), glows = [], shop = [], smoke = [];
  const trim = S.trim ?? 0xf4efe4, wall = S.wall, snow = !!opts.snow;
  const dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O;
  const K = { b, P, L, R, GB, yT, dx0, dx1, night, glows, shop, wx, wy, seed, wall, trim, wins: [] };
  // ---- taket ----
  const ridge = Math.max(4, Math.min(yT - 14, (b.top - box.y) - 18 + ((seed % 3) - 1) * 3));
  const roofCol = S.roofCol ?? 0xb4553c, roofFn = S.roof === 'metal' ? metal : S.roof === 'tent' ? tent : tiles;
  roofFn(P, L + 1, ridge - 8, b.w - 2, 7, roofCol, seed, 0.62);                          // bortre takfallet i skugga
  P.hl(L + 1, ridge - 9, b.w - 2, 0x3a1a1c);
  roofFn(P, L, ridge, b.w, yT - ridge - 2, roofCol, seed + 1);
  for (let y = ridge; y < ridge + 6; y++) P.darken(L, y, b.w, 1, 0.8 + (y - ridge) * 0.035);
  P.hl(L, ridge - 3, b.w, OUT);
  for (let x = L; x < R; x++) {                                                         // nockpannorna
    const sg = (x - L) % 8;
    P.px(x, ridge - 2, sg === 0 ? mul(roofCol, 0.5) : sg < 3 ? mix(roofCol, WHITE, 0.35) : mix(roofCol, WHITE, 0.15));
    P.px(x, ridge - 1, sg === 0 ? mul(roofCol, 0.42) : mul(roofCol, 0.9)); P.px(x, ridge, mul(roofCol, 0.5));
  }
  P.vl(L, ridge - 9, yT - ridge + 9, OUT); P.vl(L + 1, ridge - 8, yT - ridge + 8, trim); P.vl(R - 1, ridge - 9, yT - ridge + 9, OUT); P.vl(R - 2, ridge - 8, yT - ridge + 8, mul(trim, 0.7));
  if (snow) for (let y = ridge - 9; y < yT - 3; y++) for (let x = L; x < R; x++) if (hash(x, y, 91) > 0.1) P.px(x, y, hash(x, y, 92) > 0.8 ? WHITE : y < ridge ? 0xd8e2ee : 0xeef3f8, 0.92);
  for (const f of S.chimneys || []) {
    const cx = L + Math.round(f * (b.w - 10)), ct = Math.max(1, ridge - 16);
    chimney(P, cx, ct, ridge + 4, S.chimCol ?? 0xa84a38, S.chimCol === undefined);
    smoke.push([wx(cx + 3), wy(ct)]);
  }
  (S.dormers || []).forEach((f, i) => {
    const w = 18, x = L + Math.round(f * (b.w - w)), lit = litOf(night, 90 + i, seed);
    dormer(P, x, Math.max(ridge + 9, yT - 32), yT - 4, { w, lit, night, curtain: CURTAINS[(seed + i) % CURTAINS.length], seed: seed + i, roofCol, wall: S.dormerWall ?? trim, frame: trim, snow });
    const dt = Math.max(ridge + 9, yT - 32);
    if (lit) glows.push([wx(x + 5), wy(dt + 8), w - 10, yT - dt - 17, litCol(lit), 0.32]);
  });
  if (S.hoist) {                                                                        // gårdsbutikens höluckegavel: lucka och hissbalk
    const cx = L + (b.w >> 1);
    for (let r = 0; r < yT - ridge - 4; r++) {                                          // gaveln mot gatan (vindskivorna vita)
      const hw = Math.min((b.w >> 1) - 1, Math.round(r * 1.25) + 2), y = ridge + 2 + r;
      boards(P, cx - hw, y, hw * 2, 1, wall, seed + 4);
      P.px(cx - hw, y, trim); P.px(cx - hw + 1, y, trim); P.px(cx + hw - 1, y, mul(trim, 0.7)); P.px(cx + hw - 2, y, mul(trim, 0.8));
      if (hw < (b.w >> 1) - 1) P.darken(cx + hw, y, 2, 1, 0.7);
    }
    P.rect(cx - 6, ridge + 9, 12, 10, 0x6a3a22); P.box(cx - 6, ridge + 9, 12, 10, trim); P.line(cx - 5, ridge + 10, cx + 4, ridge + 17, trim); P.line(cx + 4, ridge + 10, cx - 5, ridge + 17, trim);
    P.rect(cx - 1, ridge + 4, 3, 4, 0x5a3a24); P.rect(cx - 1, ridge + 2, 12, 2, 0x6a4a2a); P.hl(cx - 1, ridge + 2, 12, 0x9a7448);
    P.vl(cx + 9, ridge + 4, 8, 0x8a8478); P.rect(cx + 8, ridge + 12, 3, 2, 0x5a5a60);                                       // repet och kroken
  }
  // hängränna och takfotens skugga
  P.hl(L - 1, yT - 3, b.w + 2, 0xd0d6de); P.hl(L - 1, yT - 2, b.w + 2, 0x9aa0aa); P.hl(L - 1, yT - 1, b.w + 2, 0x5a606c);
  if (snow) for (let x = L - 1; x < R + 1; x++) if (hash(x, 3, seed) > 0.5) { const n = 1 + ((hash(x, 4, seed) * 4) | 0); for (let j = 0; j < n; j++) P.px(x, yT + j, 0xdfe9f4, 0.8); }  // istappar

  // ---- fasaden ----
  const groundH = S.type === 'lhus' ? 34 : S.type === 'kiosk' ? GB - yT - 6 : SHOP_H;
  const upTop = yT, upBot = GB - groundH;
  const up = S.upper || 'plaster';
  if (up === 'boards') boards(P, L, upTop, b.w, upBot - upTop, wall, seed);
  else if (up === 'hboards') hboards(P, L, upTop, b.w, upBot - upTop, wall, seed);
  else if (up === 'brick') bricks(P, L, upTop, b.w, upBot - upTop, wall, seed);
  else plaster(P, L, upTop, b.w, upBot - upTop, wall, seed);
  // takfotslist med tandsnitt/snickarglädje
  P.hl(L, yT, b.w, mix(trim, WHITE, 0.3)); P.hl(L, yT + 1, b.w, trim); P.hl(L, yT + 2, b.w, mul(trim, 0.86));
  for (let x = L; x < R; x++) {
    if (S.fretwork) { const u = (x - L) % 6; if (u < 4) P.px(x, yT + 3, trim); if (u === 1 || u === 2) P.px(x, yT + 4, trim); if (u === 1) P.px(x, yT + 5, mul(trim, 0.8)); }
    else if ((x - L) % 4 < 2) P.px(x, yT + 3, mul(trim, 0.9));
  }
  P.darken(L, yT + (S.fretwork ? 6 : 4), b.w, 1, 0.78);
  // knutbrädor (hörnen) på trähus
  if (up === 'boards' || up === 'hboards') for (const x of [L, R - 3]) { P.rect(x, yT + 3, 3, upBot - yT - 3, trim); P.vl(x, yT + 3, upBot - yT - 3, mix(trim, WHITE, 0.4)); P.vl(x + 2, yT + 3, upBot - yT - 3, mul(trim, 0.72)); }
  // väggmålningen (vänstra delen av de övre våningarna)
  const muralW = S.mural ? Math.round(b.w * 0.42) : 0;
  if (S.mural) mural(P, L + 6, yT + 10, muralW, upBot - yT - 18, seed);
  // våningarna
  const floors = S.type === 'kiosk' ? 0 : S.floors ?? Math.max(1, Math.round((upBot - yT - 8) / 26));
  const fh = (upBot - yT - 8) / floors, ww = S.winW ?? 12, wh = Math.min(S.winH ?? 18, Math.round(fh - 9));
  const left = L + (muralW ? muralW + 10 : 0), span = R - left;
  const cols = S.cols ?? Math.max(1, Math.floor((span - 10) / 22));
  const sp = (span - 6) / cols;
  for (let f = 0; f < floors; f++) {
    const fy = Math.round(yT + 8 + f * fh), y = fy + Math.round((fh - wh) / 2) + 1;
    if (f > 0) { P.hl(L + (up === 'boards' ? 3 : 0), fy, b.w - (up === 'boards' ? 6 : 0), trim); P.hl(L + 3, fy + 1, b.w - 6, mul(trim, 0.7)); }   // midjebrädan
    for (let k = 0; k < cols; k++) {
      const x = Math.round(left + 3 + sp * k + (sp - ww) / 2), lit = litOf(night, k + f * 7, seed);
      const bal = !!S.balconies && k % 2 === 0;
      win(P, x, y, ww, wh, { lit, night, frame: trim, curtain: CURTAINS[(k * 3 + f + seed) % CURTAINS.length], crown: S.crown, accent: S.accent, seed: seed + k * 5 + f,
        flowers: S.flowers && !bal && hash(k, f, seed + 8) > (S.flowerP ?? 0.25) ? S.flowers : null, boxCol: S.boxCol, cat: S.cat && f === floors - 1 && k === cols - 1 ? S.cat : null });
      if (lit) glows.push([wx(x + 1), wy(y + 1), ww - 2, wh - 2, litCol(lit), 0.3]);
      if (bal) {                                                                         // balkong med räcke och krukväxter
        const bx = x - 4, byy = y + wh + 2, bw = ww + 8;
        P.rect(bx, byy, bw, 2, mix(wall, 0xd0c8b8, 0.6)); P.hl(bx, byy, bw, 0xf0eadc); P.darken(bx + 1, byy + 2, bw - 2, 3, 0.62);
        P.hl(bx, byy - 7, bw, 0x2a2a34); for (let i = 0; i < bw; i += 2) P.vl(bx + i, byy - 6, 6, 0x3a3a46);
        for (let i = 1; i < bw - 2; i += 4) { const c = FLAGS[(i + k + seed) % 6]; P.rect(bx + i, byy - 3, 3, 3, 0xc0643a); P.px(bx + i, byy - 4, 0x4a8a3a); P.px(bx + i + 1, byy - 5, 0x3e7a34); P.px(bx + i + 2, byy - 4, 0x4a8a3a); P.px(bx + i + 1, byy - 6, c); }
        for (let i = 0; i < bw; i += 3) if (hash(i, k, seed + 9) > 0.4) { P.px(bx + i, byy + 2, 0x3e7a34); P.px(bx + i, byy + 3, 0x4a8a3a); }   // hängväxter
      }
    }
  }
  // ---- bottenvåningen ----
  if (S.type === 'lhus') {
    const top = upBot;
    rustic(P, L, top, b.w, GB - top, S.stone ?? 0xb8b0a2, seed);
    P.hl(L, top, b.w, mix(S.stone ?? 0xb8b0a2, WHITE, 0.45)); P.hl(L, top + 1, b.w, mul(S.stone ?? 0xb8b0a2, 0.7)); P.darken(L, top + 2, b.w, 1, 0.8);
    for (let y = GB - 5; y < GB; y++) for (let x = L; x < R; x++) P.px(x, y, mix(0x6e6c6a, 0x8e8a86, hash(x, y, 32) * 0.8 + (bayer(x, y) - 0.5) * 0.3));   // sockeln
    P.hl(L, GB - 5, b.w, 0xb8b4ac);
    for (const lx of [L + 8, R - 8 - ww]) {
      if (lx + ww > dx0 - 6 && lx < dx1 + 6) continue;
      const lit = litOf(night, lx, seed + 3);
      win(P, lx, top + 7, ww, 16, { lit, night, frame: trim, curtain: CURTAINS[(lx + seed) % CURTAINS.length], seed: seed + lx, flowers: S.flowers && hash(lx, 2, seed) > 0.4 ? S.flowers : null, boxCol: S.boxCol, cat: S.catLow && lx > dx1 ? S.catLow : null });
      if (lit) glows.push([wx(lx + 1), wy(top + 8), ww - 2, 14, litCol(lit), 0.3]);
    }
    // porten: portal i sten med överljus
    P.rect(dx0 - 3, top + 3, dx1 - dx0 + 6, GB - top - 3, mix(S.stone ?? 0xb8b0a2, WHITE, 0.25));
    P.vl(dx0 - 3, top + 3, GB - top - 3, mix(S.stone ?? 0xb8b0a2, WHITE, 0.5)); P.vl(dx1 + 2, top + 3, GB - top - 3, mul(S.stone ?? 0xb8b0a2, 0.6));
    const dT = GB - DOOR_H, fx = (dx0 + dx1) >> 1;
    P.rect(dx0, dT - 6, dx1 - dx0, 6, 0x2a2230);
    for (let y = dT - 5; y < dT - 1; y++) for (let x = dx0 + 1; x < dx1 - 1; x++) {
      const ddx = (x + 0.5 - fx) / ((dx1 - dx0) / 2 - 1), ddy = (y + 0.5 - (dT - 1)) / 5;
      if (ddx * ddx + ddy * ddy > 1) continue;
      const ray = Math.abs(Math.atan2(-ddy, ddx) / Math.PI * 5 - Math.round(Math.atan2(-ddy, ddx) / Math.PI * 5)) < 0.18;
      P.px(x, y, ray ? 0xe8e0d0 : night ? 0xffd88a : mix(0xb8d4e4, 0x5a7890, (y - dT + 5) / 5));
    }
    if (night) glows.push([wx(dx0 + 2), wy(dT - 5), dx1 - dx0 - 4, 4, 0xffd080, 0.35]);
    P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, DOOR_H + 1, OUT);
    P.rect(dx0 - 4, GB, dx1 - dx0 + 8, 2, 0xcac4b8); P.hl(dx0 - 4, GB, dx1 - dx0 + 8, 0xeae4d8);
    if (S.num) plaque(P, dx1 + 5, top + 6, S.num);
    lantern(P, dx0 - 10, top + 12, night, glows, wx, wy);
  } else if (S.type === 'shop') {
    const r = shopfront(P, K, { ...S.shop, kind: S.shop.kind });
    if (S.lights) stringLights(P, L + 1, R - 1, S.shop.lightsY !== undefined ? r.top + S.shop.lightsY : r.top - 4, 2, seed, glows, wx, wy, 22);
  } else if (S.type === 'kiosk') {
    // glasskiosken: luckan med nedfälld rulljalusi, stor glasstrut på taket
    const top = yT + 6;
    plaster(P, L, top, b.w, GB - top, wall, seed);
    const [lx0, lx1] = dx0 - L > R - dx1 ? [L + 6, dx0 - 6] : [dx1 + 6, R - 6], ly0 = top + 18, ly1 = GB - 12;
    if (lx1 - lx0 > 10) {                                                              // luckan: nerdragen jalusi (stängt för säsongen)
      P.box(lx0 - 2, ly0 - 2, lx1 - lx0 + 4, ly1 - ly0 + 4, trim);
      for (let y = ly0; y < ly1; y++) P.hl(lx0, y, lx1 - lx0, (y - ly0) % 3 === 2 ? 0x8a8e96 : mix(0xc8ccd2, 0xa8acb2, (y - ly0) / (ly1 - ly0)));
      P.rect(lx0 - 3, ly1 + 2, lx1 - lx0 + 6, 3, trim); P.hl(lx0 - 3, ly1 + 2, lx1 - lx0 + 6, WHITE);                                     // disken
      const tw = Math.max(textW(SMALL, 'VI SES'), textW(SMALL, 'I VÅR!')), mx = lx0 + ((lx1 - lx0 - tw - 4) >> 1);   // lappen på jalusin
      if (tw + 4 <= lx1 - lx0) {
        P.rect(mx, ly0 + 4, tw + 4, 16, 0xfaf6ee); P.box(mx, ly0 + 4, tw + 4, 16, 0xd84a6a); P.hl(mx + 1, ly0 + 20, tw + 3, 0x000000, 0.2);
        text(P, SMALL, 'VI SES', mx + 2 + ((tw - textW(SMALL, 'VI SES')) >> 1), ly0 + 6, 0xd84a6a); text(P, SMALL, 'I VÅR!', mx + 2 + ((tw - textW(SMALL, 'I VÅR!')) >> 1), ly0 + 13, 0xd84a6a);
        P.px(mx + (tw >> 1) + 2, ly0 + 3, 0x8a8e96);
      }
      P.rect(lx0 + 2, ly1 - 4, 3, 2, 0x5a5e66);                                                                                      // låset
    }
    for (let y = top; y < top + 14; y++) for (let x = L; x < R; x++) P.px(x, y, ((x - L) >> 2) & 1 ? 0xf8f0f4 : 0xe86a9a);   // randig fris
    P.hl(L, top + 14, b.w, 0x9a3a5a); P.darken(L, top + 15, b.w, 1, 0.75);
    signText(P, BIG, 'GLASS', L + ((b.w - textW(BIG, 'GLASS')) >> 1), top + 4, WHITE, 0x9a3a5a, 0xfff0f6);
    P.rect(dx0 - 1, GB - DOOR_H - 1, dx1 - dx0 + 2, DOOR_H + 1, OUT);
    // strut på taket
    const cx = L + (b.w >> 1), cy = top - 2;
    for (let j = 0; j < 14; j++) { const hw = Math.max(0, Math.round((14 - j) * 0.45)); for (let i = -hw; i <= hw; i++) P.px(cx + i, cy - j, (i + j) % 3 === 0 ? 0xb07a2a : 0xd8a04a); }
    for (let j = 0; j < 10; j++) for (let i = -6; i <= 6; i++) if (Math.hypot(i / 6.5, (j - 5) / 5) < 1) P.px(cx + i, cy - 13 - j, j < 3 ? 0xfadce6 : i < -2 ? 0xfff4f8 : 0xf4b4c8);
    P.px(cx, cy - 24, 0xd8303a); P.px(cx + 1, cy - 24, 0xc8202a); P.px(cx, cy - 25, 0x3e7a34);
    P.rect(L + 3, GB - 1, b.w - 6, 1, 0x9a948a);
  }
  // ---- dekorationerna ----
  if (S.ivy) ivy(P, S.ivy[0] === 'R' ? R - 18 : L, yT + 10, GB - 2, 18, seed, S.ivy[1] === 'host');
  if (S.rosesAt) for (const rx of S.rosesAt) roses(P, L + rx, yT + 30, GB - 1, seed + rx);
  if (S.bunt) bunting(P, L + 1, R - 1, S.bunt === 'top' ? yT + 8 : upBot - 14, 3, seed, 26);
  if (S.lightsTop) stringLights(P, L + 1, R - 1, yT + 7, 3, seed + 3, glows, wx, wy, 28);
  if (S.hang) hangSign(P, S.hang[1] ? L + 4 : R - 5, upBot - 16, S.hang[0], !S.hang[1]);
  downpipe(P, S.pipeLeft ? L + 1 : R - 4, yT - 1, GB, S.pipeCol);
  footShadow(P, L, dx0 - 4 - L, GB); footShadow(P, dx1 + 4, R - dx1 - 4, GB);
  for (const wv of K.wins) { wv.img = wv.F.flush(); delete wv.F; }
  META[b.id + ':' + !!night] = { glows, shop, smoke, wins: K.wins, doorLight: 0xffd890 };
  return P.flush();
}

// ================= SJÖBODEN – fiskrestaurangen på pålar vid pirens slut =================
// En falröd sjöbod med gaveln mot oss (söder): taket med två fall bakåt (norrut), vita vindskivor,
// en fisk som vindflöjel, skylten SJÖBODEN på gaveln, ett runt fönster med kors, stora småspröjsade
// fönster där gästerna sitter med levande ljus, nät och en flöte i hörnet, en livboj, lyktor vid
// dörren, fisklådor och en kamin med rör genom taket.
function paintKrog(b, night, S, opts = {}) {
  const box = artBox(b), P = new Pix(box.w, box.h);
  const L = O, R = O + b.w, GB = baseOf(b) - box.y, cx = (L + R) >> 1;
  const wx = (x) => x + box.x, wy = (y) => y + box.y, seed = idSeed(b.id), glows = [], smoke = [];
  const wall = 0xa8442e, trim = 0xf4efe4, eave = GB - 42, apex = GB - 72, depth = 24, snow = !!opts.snow;
  const roofC = 0x3a3e46;
  const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const lp = [[L - 3, eave + 1], [cx, apex], [cx, apex - depth], [L - 3, eave + 1 - depth]];
  const rp = [[cx, apex], [R + 2, eave + 1], [R + 2, eave + 1 - depth], [cx, apex - depth]];
  // taket: två fall bakåt med falsar längs fallet, ljust åt väster och i skugga åt öster
  for (let y = apex - depth - 1; y <= eave + 1; y++) for (let x = L - 4; x <= R + 3; x++) {
    const left = inPoly(x + 0.5, y + 0.5, lp), right = !left && inPoly(x + 0.5, y + 0.5, rp);
    if (!left && !right) continue;
    const u = left ? (x - (L - 3)) / (cx - L + 3) : (R + 2 - x) / (R + 2 - cx), seam = Math.round(u * 9) !== Math.round((u + 0.02) * 9);
    let c = left ? mix(roofC, WHITE, 0.16) : mul(roofC, 0.8);
    if (seam) c = left ? mix(roofC, WHITE, 0.3) : mul(roofC, 0.62);
    if (snow && hash(x, y, 91) > 0.1) c = left ? 0xf4f8fc : 0xd8e2ee;
    P.px(x, y, c);
  }
  P.line(cx, apex, cx, apex - depth, mul(roofC, 0.5));                                       // nocken
  // kaminröret med huv (röken i live)
  P.rect(R - 26, apex + 4 - depth, 3, 14, 0x2a2a30); P.rect(R - 27, apex + 2 - depth, 5, 2, 0x4a4a54);
  smoke.push([wx(R - 25), wy(apex + 1 - depth)]);
  // väggen och gaveln: stående falröd panel, vita knutar
  const gableHW = (y) => Math.round(((y - apex) / (eave - apex)) * (cx - L));
  for (let y = apex; y < GB; y++) {
    const hw = y < eave ? gableHW(y) : cx - L;
    boards(P, cx - hw, y, hw * 2 + 1, 1, wall, seed);
  }
  for (const x of [L, R - 3]) { P.rect(x, eave, 3, GB - eave, trim); P.vl(x + 2, eave, GB - eave, mul(trim, 0.72)); }
  // vindskivorna längs gaveln och en fisk som vindflöjel på toppen
  for (let y = apex; y <= eave; y++) { const hw = gableHW(y); P.px(cx - hw - 1, y, trim); P.px(cx - hw - 2, y, trim); P.px(cx + hw + 1, y, mul(trim, 0.8)); P.px(cx + hw + 2, y, mul(trim, 0.7)); }
  P.hl(L - 2, eave, R - L + 4, trim); P.hl(L - 2, eave + 1, R - L + 4, mul(trim, 0.72)); P.darken(L, eave + 2, R - L, 1, 0.75);
  P.vl(cx, apex - 12, 12, 0x2a2a30);
  for (const [x, y] of [[-4, -14], [-3, -15], [-2, -15], [-1, -15], [0, -15], [1, -15], [2, -14], [-3, -13], [-2, -13], [-1, -13], [0, -13], [1, -13], [3, -15], [4, -16], [3, -13], [4, -12], [-2, -14], [-1, -14], [0, -14], [1, -14]]) P.px(cx + x, apex + y, 0xd8b040);
  P.px(cx - 3, apex - 15, 0x2a2a30);
  // runt fönster i gaveln med kors
  const oy = apex + 10;
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = Math.hypot(x, y); if (d > 5.5) continue; P.px(cx + x, oy + y, d > 4.4 ? trim : x === 0 || y === 0 ? trim : night ? 0xffd890 : mix(0xb8d4e4, 0x4e6e96, (y + 5) / 10)); }
  if (night) glows.push([wx(cx - 3), wy(oy - 3), 7, 7, 0xffd080, 0.35]);
  // skylten SJÖBODEN och FISK & SKALDJUR
  const s = 'SJÖBODEN', sw = textW(BIG, s) + 10, sx = cx - (sw >> 1), sy = eave - 13;
  P.rect(sx, sy, sw, 11, 0xf4ecd8); P.box(sx - 1, sy - 1, sw + 2, 13, 0x2a3a5a); P.hl(sx, sy + 10, sw, 0xc8b898);
  signText(P, BIG, s, sx + 5, sy + 2, 0x2a3a5a, 0xc8b898, 0x4a6a9a);
  const s2 = 'FISK & SKALDJUR', t2 = textW(SMALL, s2);
  text(P, SMALL, s2, cx - (t2 >> 1) + 1, eave + 3, 0x5a1a10, 0.6); text(P, SMALL, s2, cx - (t2 >> 1), eave + 2, trim);
  // fönstren: småspröjsade, gästerna vid borden med levande ljus
  const dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O;
  for (const [a, z] of [[L + 6, dx0 - 8], [dx1 + 8, R - 7]]) {
    const y0 = eave + 10, y1 = GB - 7, w = z - a, h = y1 - y0;
    P.box(a - 1, y0 - 1, w + 2, h + 2, 0x221a26);
    vgrad(P, a, y0, w, h, night ? 0xffd890 : 0xf0dcb8, night ? 0xd08a40 : 0x8a6a4a, 3);
    for (let k = 0; k < 2; k++) {                                                           // gäster vid bord
      const gx = a + 5 + k * Math.max(8, w - 12), gy = y1 - 6;
      P.rect(gx - 2, gy - 6, 5, 5, [0x3a6ab0, 0xd8443a, 0x5aa060][(k + seed) % 3]); P.rect(gx - 1, gy - 9, 3, 3, 0xeabf98); P.hl(gx - 1, gy - 10, 3, [0x2a1a12, 0xc8642a, 0xd8c8a0][(k + seed + 1) % 3]);
      P.hl(gx - 4, gy, 9, 0xf4f0e6); P.px(gx + 3, gy - 2, 0xfff0a0); P.px(gx + 3, gy - 1, 0xf4f0e6);
    }
    for (let x = a + 4; x < z; x += 5) P.vl(x, y0, h, trim);
    P.hl(a, y0 + (h >> 1), w, trim);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((i + j + seed) % 15 < 2) P.px(a + i, y0 + j, WHITE, night ? 0.05 : 0.22);
    P.box(a, y0, w, h, trim); P.hl(a - 2, y1 + 1, w + 4, mix(trim, WHITE, 0.3)); P.hl(a - 2, y1 + 2, w + 4, mul(trim, 0.7));
    if (night) glows.push([wx(a + 1), wy(y0 + 1), w - 2, h - 2, 0xffc870, 0.32]);
  }
  // dörren (bladet ritas av live), lyktor på båda sidor
  P.rect(dx0 - 1, GB - DOOR_H - 3, dx1 - dx0 + 2, DOOR_H + 3, 0x221a26); P.rect(dx0 - 3, GB - DOOR_H - 5, dx1 - dx0 + 6, 2, trim);
  lantern(P, dx0 - 8, GB - 26, night, glows, wx, wy); lantern(P, dx1 + 3, GB - 26, night, glows, wx, wy);
  // nätet i hörnet med en flöte, livbojen, fisklådorna
  for (let y = eave + 4; y < GB - 4; y++) for (let x = L + 1; x < L + 7 + ((y - eave) >> 2); x++) if ((x + y) % 3 === 0 || (x - y + 99) % 3 === 0) P.px(x, y, 0xc8b890, 0.85);
  P.ell(L + 6, GB - 14, 2.4, 2.8, 0xe8443a, 1, 1); P.px(L + 5, GB - 14, 0xf8a8a0);
  for (let a = 0; a < 28; a++) { const an = a / 28 * Math.PI * 2; for (const r of [4, 5]) P.px(Math.round(R - 12 + Math.cos(an) * r), Math.round(eave + 8 + Math.sin(an) * r), Math.floor((an / Math.PI) * 2) % 2 ? 0xf4f1ea : 0xe8443a); }
  for (const [x, y] of [[R - 18, GB - 1], [R - 13, GB - 6]]) { P.rect(x, y - 5, 10, 5, 0x9a7448); P.hl(x, y - 5, 10, 0xc09a68); P.hl(x + 1, y - 3, 8, 0x6a4a2a); for (let k = 1; k < 9; k += 3) P.px(x + k, y - 6, 0xa8b8c8); }
  // trappsteget och skuggan på bryggan
  P.rect(dx0 - 3, GB, dx1 - dx0 + 6, 2, 0xb88a58); P.hl(dx0 - 3, GB, dx1 - dx0 + 6, 0xd4a874);
  footShadow(P, L, dx0 - 4 - L, GB); footShadow(P, dx1 + 4, R - dx1 - 4, GB);
  META[b.id + ':' + !!night] = { glows, shop: [], smoke, wins: [], doorLight: 0xffd890 };
  return P.flush();
}

// ================= dörrarna =================
const KITS = {};
const SWING_STEPS = 5;
function makeSwingKit(w, h, paintInside, paintLeaf) {
  const I = new Pix(w, h); paintInside(I, w, h);
  const Lf = new Pix(w, h); paintLeaf(Lf, w, h); Lf.flush();
  const leaves = [];
  for (let k = 0; k < SWING_STEPS; k++) {
    if (k === 0) { leaves.push(Lf.canvas); continue; }
    const S = new Pix(w, h), a = (k / (SWING_STEPS - 1)) * 1.35, pw = Math.max(3, Math.round(w * Math.cos(a))), f = 1 - k * 0.1;
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.floor(x * w / pw)), cut = Math.round((x / pw) * k * 0.9);
      for (let y = cut; y < h - Math.round(cut * 0.3); y++) {
        const i = (y * w + sx) * 4, al = Lf.d[i + 3] / 255;
        if (al > 0) S.px(x, y, mul((Lf.d[i] << 16) | (Lf.d[i + 1] << 8) | Lf.d[i + 2], f), al);
      }
    }
    S.vl(pw, Math.round(k * 0.9), h - Math.round(k * 0.9) - Math.round(k * 0.27), 0xd8cbb4);
    leaves.push(S.flush());
  }
  return { w, h, inside: I.flush(), leaves };
}
function doorKit(b, S) {
  const w = b.door.x1 - b.door.x0, glass = S.type !== 'lhus', c = S.door ?? (S.shop?.col) ?? 0x2f5a44;
  return makeSwingKit(w, DOOR_H, (I) => {
    const w0 = glass ? 0xf4e4c0 : 0xf0e2c2;
    vgrad(I, 0, 0, w, DOOR_H - 8, w0, mul(w0, 0.8), 4);
    for (let y = DOOR_H - 8; y < DOOR_H; y++) for (let x = 0; x < w; x++) I.px(x, y, ((x >> 2) + (y >> 1)) % 2 ? 0xa88a68 : 0x98785a);
    I.hl(2, 1, w - 4, WHITE); I.hl(3, 2, w - 6, 0xfff8e0, 0.5);
    if (!glass) for (let s = 0; s < 6; s++) { const x = w - 3 - s * 3, y = DOOR_H - 10 - s * 3; I.rect(x - 7, y, 10, 3, 0xb89a74); I.hl(x - 7, y, 10, 0xe0c8a0); }
    else { I.rect(2, DOOR_H - 16, w - 4, 6, 0x8a6a4a); I.hl(2, DOOR_H - 16, w - 4, 0xb08a60); }             // disken
  }, (P, w, h) => {
    vgrad(P, 0, 0, w, h, mix(c, WHITE, 0.1), mul(c, 0.78), 3);
    P.box(0, 0, w, h, OUT); P.vl(1, 1, h - 2, mix(c, WHITE, 0.3)); P.vl(w - 2, 1, h - 2, mul(c, 0.6));
    if (glass) {
      glassPane(P, 3, 3, w - 6, h - 12, { sky: 0xf0e0c0, deep: 0x9a8058, streak: 9 });
      P.box(2, 2, w - 4, h - 10, mul(c, 0.55)); P.hl(3, 9, w - 6, mul(c, 0.7));
      P.rect(3, h - 8, w - 6, 5, mul(c, 0.85)); P.box(4, h - 7, w - 8, 3, mul(c, 0.6));
      // "VÄLKOMMEN"-skylt i glaset
      P.rect((w >> 1) - 5, 11, 10, 4, 0xfaf6ea); P.hl((w >> 1) - 4, 12, 8, 0xc84a3a, 0.8);
    } else {
      P.box(3, 3, w - 6, 10, mul(c, 0.5));
      glassPane(P, 4, 4, w - 8, 8, { sky: 0xe8dcb8, deep: 0x8a7a58, streak: 9 });
      P.vl(w >> 1, 4, 8, mul(c, 0.7));
      P.bevel(4, 15, w - 8, h - 21, mix(c, WHITE, 0.25), mul(c, 0.5)); P.bevel(6, 17, w - 12, h - 25, mul(c, 0.55), mix(c, WHITE, 0.18));
      P.rect(1, h - 4, w - 2, 3, 0xc8a44a); P.hl(1, h - 4, w - 2, 0xf4dc94); P.hl(1, h - 2, w - 2, 0x7a5a24);
    }
    P.rect(w - 5, 15, 2, 1, 0xf0d070); P.px(w - 5, 16, 0x9a7a30);
  });
}
function drawDoor(ctx, b, st, kit) {
  const x0 = b.door.x0, top = baseOf(b) - kit.h, open = Math.max(0, Math.min(1, st.doorOpen || 0));
  ctx.drawImage(kit.inside, x0, top);
  const k = Math.max(0, Math.min(SWING_STEPS - 1, Math.round(open * (SWING_STEPS - 1))));
  ctx.drawImage(kit.leaves[k], x0, top);
}

// ================= trottoarmöblerna =================
// Varje sort: en liten bild (Pix) med fotpunkten i (fx, fy) och ett hinder [x0, y0, x1, y1] runt foten.
const ITEM = {};
function itemArt(kind) {
  if (ITEM[kind]) return ITEM[kind];
  let P, fx, fy, ob;
  const shadow = (P, cx, cy, rx) => P.ell(cx, cy, rx, 2, 0x1a1422, 0.35, 3);
  const bike = (P, x, y, c, basket) => {                                                 // cykel från sidan, fötterna (hjulen) på y
    const ring = (cx, cy) => { for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; P.px(Math.round(cx + Math.cos(an) * 4.5), Math.round(cy + Math.sin(an) * 4.5), 0x24242a); } for (let a = 0; a < 6; a++) { const an = a / 6 * Math.PI; P.line(cx - Math.cos(an) * 3, cy - Math.sin(an) * 3, cx + Math.cos(an) * 3, cy + Math.sin(an) * 3, 0xb8bcc4, 0.7); } P.px(cx, cy, 0x6a6a72); };
    ring(x + 5, y - 5); ring(x + 18, y - 5);
    P.line(x + 5, y - 5, x + 10, y - 5, c); P.line(x + 10, y - 5, x + 8, y - 11, c); P.line(x + 8, y - 11, x + 15, y - 11, c);
    P.line(x + 10, y - 5, x + 15, y - 11, c); P.line(x + 15, y - 11, x + 18, y - 5, c); P.line(x + 5, y - 5, x + 8, y - 11, c);
    P.hl(x + 6, y - 13, 4, 0x3a2a24); P.vl(x + 8, y - 12, 1, 0x5a5a60);                                   // sadeln
    P.line(x + 15, y - 11, x + 16, y - 14, 0x5a5a60); P.hl(x + 14, y - 14, 4, 0x2a2a30);                  // styret
    if (basket) { P.rect(x + 17, y - 14, 6, 4, 0xb08a50); P.hl(x + 17, y - 14, 6, 0xd0aa70); P.px(x + 19, y - 15, 0xe84a6a); P.px(x + 21, y - 15, 0xf4d23c); }
  };
  switch (kind) {
    case 'cafe': {                                                                       // bistrobord och två stolar
      P = new Pix(28, 22); fx = 14; fy = 20; ob = [-11, -3, 11, 1];
      shadow(P, 14, 20, 12);
      const chair = (x, flip) => {
        const c = 0x2a2a30;
        P.rect(x, 9, 6, 2, 0xc8a070); P.hl(x, 9, 6, 0xe0c090);                                             // sitsen (rotting)
        for (let j = 2; j < 9; j++) P.px(flip ? x + 5 : x, j, c);
        for (let j = 3; j < 8; j += 2) P.hl(flip ? x + 3 : x, j, 3, 0xb08a5a);                             // ryggen
        P.vl(x, 11, 9, c); P.vl(x + 5, 11, 9, c); P.line(x, 19, x + 1, 15, c); P.line(x + 5, 19, x + 4, 15, c);
      };
      chair(1, false); chair(21, true);
      P.ell(14, 8, 7, 2, 0xf4efe4, 1, 1); P.hl(8, 8, 13, 0xffffff); P.hl(8, 10, 13, 0x9a948a);                  // bordsskivan
      P.vl(14, 11, 8, 0x2a2a30); P.hl(11, 19, 7, 0x2a2a30);
      P.rect(11, 6, 2, 2, 0xf8f4ec); P.px(13, 6, 0xd8d0c4); P.rect(16, 5, 2, 3, 0x9ad0e8); P.px(16, 4, 0xe84a6a); P.px(17, 3, 0xf4d23c);   // koppen och vasen
      break;
    }
    case 'tavla': case 'tavla2': {                                                       // trottoarpratare med krita
      P = new Pix(14, 18); fx = 7; fy = 17; ob = [-5, -2, 5, 1];
      shadow(P, 7, 17, 6);
      P.line(2, 17, 4, 1, 0x6a4a2a); P.line(11, 17, 9, 1, 0x6a4a2a);
      P.rect(3, 2, 8, 12, 0x8a6a4a); P.rect(4, 3, 6, 10, 0x2a3430);
      const words = kind === 'tavla' ? ['FIKA', '25:-'] : ['ÖPPET', ''];
      text(P, SMALL, words[0].slice(0, 2), 4, 4, 0xf4f1ea, 0.9); text(P, SMALL, words[0].slice(2, 4), 4, 10, 0xf4f1ea, 0.9);
      P.px(5, 9, 0xf09ab8); P.px(8, 9, 0x9ad0e8);
      break;
    }
    case 'lador': {                                                                      // bänk med grönsakslådor
      P = new Pix(34, 18); fx = 17; fy = 17; ob = [-16, -3, 16, 1];
      shadow(P, 17, 17, 17);
      P.rect(1, 10, 32, 2, 0x9a7448); P.hl(1, 10, 32, 0xc09a68); P.vl(3, 12, 5, 0x6a4a2a); P.vl(30, 12, 5, 0x6a4a2a);
      const crate = (x, c1, c2, kindv) => {
        P.rect(x, 4, 10, 6, 0xb08a58); P.hl(x, 4, 10, 0xd8b480); P.hl(x, 7, 10, 0x8a6a40); P.vl(x, 4, 6, 0x8a6a40);
        for (let i = 0; i < 9; i += 2) for (let j = 0; j < 2; j++) {
          if (kindv === 'mor') { P.px(x + 1 + i, 3 - j, c1); P.px(x + 1 + i, 1 - j, 0x4c8a3a); }
          else { P.px(x + 1 + i, 3 - j, j ? c2 : c1); P.px(x + 2 + i, 3 - j, c1); }
        }
      };
      crate(1, 0xe0802a, 0, 'mor'); crate(12, 0xd8302a, 0xf06a5a); crate(23, 0x6ab04a, 0x8ac858);
      P.rect(14, 12, 6, 4, 0xfaf6ea); text(P, SMALL, '5', 15, 12, 0x2a2a30, 0.8);
      break;
    }
    case 'pumpor': {                                                                     // pumpor, mjölkkanna och en höbal
      P = new Pix(34, 18); fx = 17; fy = 17; ob = [-16, -3, 16, 1];
      shadow(P, 17, 17, 17);
      for (let j = 4; j < 17; j++) for (let i = 18; i < 33; i++) { const n = hash(i, j, 7); P.px(i, j, j === 4 ? 0xf0dc90 : n > 0.8 ? 0xf0d880 : n < 0.2 ? 0xb89a48 : 0xd8bc68); }   // höbalen
      P.hl(18, 9, 15, 0x8a6a3a); P.hl(18, 13, 15, 0x8a6a3a);
      const pump = (cx, cy, r, c) => { for (let j = -r; j <= r; j++) for (let i = -r - 1; i <= r + 1; i++) if (Math.hypot(i / (r + 1.2), j / r) < 1) P.px(cx + i, cy + j, (i + 40) % 3 === 0 ? mul(c, 0.82) : i < 0 && j < 0 ? mix(c, WHITE, 0.2) : c); P.px(cx, cy - r - 1, 0x4a6a2a); P.px(cx + 1, cy - r - 2, 0x4a6a2a); };
      pump(6, 13, 3, 0xe0701c); pump(13, 14, 2, 0xf09a2a); pump(25, 1 + 1, 2, 0xe0701c);
      P.rect(9, 3, 5, 8, 0xc8ccd2); P.hl(9, 3, 5, 0xeef0f4); P.vl(13, 3, 8, 0x8a8e96); P.rect(10, 1, 3, 2, 0xa8acb2);   // mjölkkannan
      break;
    }
    case 'bank': {                                                                       // bänk med kuddar och en lykta
      P = new Pix(32, 18); fx = 16; fy = 17; ob = [-15, -3, 15, 1];
      shadow(P, 16, 17, 16);
      for (let j = 0; j < 3; j++) P.hl(2, 3 + j * 3, 28, j % 2 ? 0x8a6a42 : 0xa8845a);                        // ryggen
      P.rect(1, 11, 30, 2, 0xa8845a); P.hl(1, 11, 30, 0xc8a478); P.vl(3, 13, 4, 0x2a2a30); P.vl(28, 13, 4, 0x2a2a30); P.vl(2, 3, 9, 0x2a2a30); P.vl(29, 3, 9, 0x2a2a30);
      P.rect(5, 7, 7, 4, 0xe8a0a8); P.hl(5, 7, 7, 0xf8c8d0); P.rect(19, 7, 7, 4, 0xa8c8e8); P.hl(19, 7, 7, 0xc8e0f8);
      P.rect(14, 8, 4, 3, 0xf0e0a0);
      break;
    }
    case 'oliv': case 'citron': {                                                        // kruka med olivträd/citronträd
      P = new Pix(16, 28); fx = 8; fy = 27; ob = [-4, -3, 4, 1];
      shadow(P, 8, 27, 6);
      P.rect(4, 20, 9, 7, 0xc0643a); P.hl(3, 20, 11, 0xe08a5a); P.hl(4, 26, 9, 0x8a3e22); P.vl(12, 21, 6, 0x9a4a2a);
      P.vl(8, 10, 10, 0x6a5a3a); P.px(7, 13, 0x6a5a3a);
      for (let j = 0; j < 12; j++) for (let i = -6; i <= 6; i++) {
        if (Math.hypot(i / 6.5, (j - 5) / 5.5) > 1) continue;
        const n = hash(i, j, kind === 'oliv' ? 31 : 33);
        if (n < 0.25) continue;
        P.px(8 + i, 1 + j, kind === 'oliv' ? (n > 0.75 ? 0xa8b890 : n > 0.5 ? 0x7a9468 : 0x5a7450) : (n > 0.85 ? 0xf6d23a : n > 0.5 ? 0x4c8a3a : 0x356a2c));
      }
      break;
    }
    case 'lyktor': {                                                                     // tre lyktor på marken
      P = new Pix(16, 16); fx = 8; fy = 15; ob = [-6, -2, 6, 1];
      shadow(P, 8, 15, 7);
      for (const [x, hgt] of [[1, 10], [7, 13], [12, 8]]) {
        P.rect(x, 15 - hgt, 4, hgt, 0x2a2a30); P.rect(x + 1, 16 - hgt, 2, hgt - 3, 0xe8eef0); P.px(x + 1, 16 - hgt, WHITE);
        P.hl(x - 1, 15 - hgt, 6, 0x3a3a44); P.px(x + 1, 14 - hgt, 0x2a2a30); P.px(x + 2, 13 - hgt, 0x2a2a30);
        P.px(x + 1, 13 - (hgt >> 1) + 2, 0xffd060);
      }
      break;
    }
    case 'blomtrappa': {                                                                 // blomstertrappa med hinkar
      P = new Pix(28, 24); fx = 14; fy = 23; ob = [-13, -3, 13, 1];
      shadow(P, 14, 23, 14);
      for (let s = 0; s < 3; s++) { P.rect(1 + s * 3, 18 - s * 6, 26 - s * 6, 2, 0x8a6a42); P.hl(1 + s * 3, 18 - s * 6, 26 - s * 6, 0xb08a5a); }
      P.vl(2, 18, 5, 0x6a4a2a); P.vl(25, 18, 5, 0x6a4a2a);
      for (let s = 0; s < 3; s++) for (let i = 2 + s * 3; i < 25 - s * 3; i += 5) {
        const c = FLAGS[(i + s * 2) % 6], y = 17 - s * 6;
        P.rect(i, y - 3, 4, 3, 0xa8acb4); P.hl(i, y - 3, 4, 0xd8dce2);
        for (let k = 0; k < 4; k++) { P.px(i + k, y - 4, 0x3e7a34); P.px(i + k, y - 5 - (k & 1), c); if (k & 1) P.px(i + k, y - 6, mix(c, WHITE, 0.3)); }
      }
      break;
    }
    case 'hinkar': {                                                                     // zinkhinkar med snittblommor
      P = new Pix(26, 16); fx = 13; fy = 15; ob = [-12, -2, 12, 1];
      shadow(P, 13, 15, 13);
      for (let i = 1; i < 24; i += 6) {
        const c = FLAGS[(i / 6 | 0) % 6];
        P.rect(i, 9, 5, 6, 0xa8acb4); P.hl(i, 9, 5, 0xd8dce2); P.vl(i + 4, 10, 5, 0x7a7e86);
        for (let k = 0; k < 5; k++) { P.vl(i + k, 5 + (k % 2), 4, 0x3e7a34); P.px(i + k, 3 + (k % 3), c); P.px(i + k, 2 + (k % 3), mix(c, WHITE, 0.35)); }
      }
      break;
    }
    case 'bokvagn': {                                                                    // bokvagn med fyndlåda
      P = new Pix(28, 18); fx = 14; fy = 17; ob = [-13, -3, 13, 1];
      shadow(P, 14, 17, 14);
      P.rect(2, 6, 24, 7, 0x6a4a2a); P.hl(2, 6, 24, 0x9a7448); P.box(2, 6, 24, 7, 0x3a2a1a);
      for (let i = 3; i < 25; i += 2) { const c = [0x8a2a24, 0x2a4a6a, 0x3a5a3a, 0x8a6a2a, 0x5a3a5a, 0xc8b490][(i * 7) % 6]; P.rect(i, 2 + (i % 3), 2, 5 - (i % 3), c); P.px(i, 2 + (i % 3), mix(c, WHITE, 0.3)); }
      for (const x of [5, 22]) { P.ell(x, 15, 2, 2, 0x2a2a30, 1, 1); P.px(x, 15, 0x9aa0aa); }
      P.rect(9, 8, 10, 4, 0xfaf6ea); text(P, SMALL, '10:-', 9, 8, 0xc84a3a, 0.9);
      break;
    }
    case 'stol': {                                                                       // en gammal pinnstol med en bokhög
      P = new Pix(12, 20); fx = 6; fy = 19; ob = [-4, -2, 4, 1];
      shadow(P, 6, 19, 5);
      for (let i = 2; i < 10; i += 2) P.vl(i, 2, 8, 0x8a5a2a); P.hl(1, 1, 10, 0xa8744a);
      P.rect(1, 10, 10, 2, 0xb07a4a); P.hl(1, 10, 10, 0xd09a68); P.vl(1, 12, 7, 0x6a4a2a); P.vl(10, 12, 7, 0x6a4a2a);
      for (let k = 0; k < 3; k++) P.rect(2, 7 - k * 2, 8 - k, 2, [0x8a2a24, 0x2a4a6a, 0xc8b490][k]);
      break;
    }
    case 'buxbom': case 'kruka': case 'lavendel': {                                      // krukor vid portarna
      P = new Pix(12, 16); fx = 6; fy = 15; ob = [-4, -2, 4, 1];
      shadow(P, 6, 15, 5);
      P.rect(2, 9, 8, 6, kind === 'kruka' ? 0xc0643a : 0x6a6e78); P.hl(1, 9, 10, kind === 'kruka' ? 0xe08a5a : 0x9aa0aa); P.vl(9, 10, 5, kind === 'kruka' ? 0x8a3e22 : 0x4a4e58);
      if (kind === 'buxbom') for (let j = 0; j < 9; j++) for (let i = -5; i <= 5; i++) { if (Math.hypot(i / 5, (j - 4.5) / 4.6) > 1) continue; const n = hash(i, j, 41); P.px(6 + i, j, i < 0 && j < 4 ? (n > 0.5 ? 0x6aa848 : 0x4c8a3a) : n > 0.7 ? 0x4c8a3a : n > 0.3 ? 0x356a2c : 0x24502a); }
      else if (kind === 'kruka') for (let i = 1; i < 11; i++) { const hgt = 3 + ((hash(i, 1, 43) * 4) | 0); for (let j = 0; j < hgt; j++) P.px(i, 8 - j, (i + j) % 2 ? 0x3e7a34 : 0x5a9a42); if (hash(i, 2, 43) > 0.4) { P.px(i, 8 - hgt, 0xe83a4a); P.px(i, 7 - hgt, 0xf05a6a); } }
      else for (let i = 2; i < 10; i++) { const hgt = 5 + ((hash(i, 1, 44) * 3) | 0); P.vl(i, 9 - hgt, hgt, 0x6a8a5a); P.vl(i, 9 - hgt, 3, 0x9a7ad8); P.px(i, 9 - hgt, 0xb8a0f0); }
      break;
    }
    case 'cykel': case 'cykel2': {
      P = new Pix(26, 18); fx = 13; fy = 17; ob = [-11, -2, 11, 1];
      shadow(P, 13, 17, 12);
      bike(P, 1, 17, kind === 'cykel' ? 0x3a7ac8 : 0x5aa060, kind === 'cykel');
      P.line(10, 12, 7, 16, 0x5a5a60);                                                                   // stödet
      break;
    }
    case 'cykelstall': {
      P = new Pix(44, 18); fx = 22; fy = 17; ob = [-21, -2, 21, 1];
      shadow(P, 22, 17, 22);
      for (let k = 0; k < 4; k++) { P.line(4 + k * 10, 16, 4 + k * 10, 10, 0x9aa0aa); P.line(4 + k * 10, 10, 9 + k * 10, 10, 0x9aa0aa); P.line(9 + k * 10, 10, 9 + k * 10, 16, 0x6a6e78); }
      bike(P, 0, 17, 0xd84a3a, false); bike(P, 10, 17, 0xf4d23c, true); bike(P, 21, 17, 0x2a2a30, false);
      break;
    }
    case 'loppisbord': {                                                                 // bord med prylar
      P = new Pix(32, 22); fx = 16; fy = 21; ob = [-15, -3, 15, 1];
      shadow(P, 16, 21, 16);
      P.rect(1, 11, 30, 2, 0xb08a58); P.hl(1, 11, 30, 0xd8b480); P.rect(1, 13, 30, 3, 0xe8e0d0); P.hl(1, 15, 30, 0xc8c0b0);   // duken
      P.vl(3, 16, 5, 0x6a4a2a); P.vl(28, 16, 5, 0x6a4a2a);
      P.rect(3, 3, 6, 4, 0xe8c070); P.vl(6, 7, 4, 0x8a6a4a); P.hl(4, 10, 5, 0x5a4030);                    // bordslampan
      P.rect(11, 7, 4, 4, 0x6ab0d0); P.rect(12, 5, 2, 2, 0x6ab0d0);                                       // vasen
      P.rect(17, 6, 5, 5, 0xb07a4a); P.px(17, 5, 0xb07a4a); P.px(21, 5, 0xb07a4a); P.px(18, 7, 0x2a2a30); P.px(20, 7, 0x2a2a30);   // nallen
      P.rect(24, 8, 6, 3, 0xf4f0e8); P.hl(24, 8, 6, WHITE); P.px(26, 7, 0xf4f0e8);                       // tekoppen
      P.rect(8, 14, 6, 3, 0xfaf6ea); text(P, SMALL, '5', 9, 14, 0xc84a3a, 0.9);
      break;
    }
    case 'skivor': {                                                                     // låda med vinylskivor och en golvlampa
      P = new Pix(22, 26); fx = 11; fy = 25; ob = [-10, -3, 10, 1];
      shadow(P, 11, 25, 11);
      P.rect(1, 17, 12, 8, 0x9a7448); P.hl(1, 17, 12, 0xc09a68); P.hl(1, 21, 12, 0x6a4a2a);
      for (let i = 2; i < 12; i += 2) P.rect(i, 13 + (i % 3), 2, 5, [0x2a2a30, 0xd84a3a, 0x3a6ab0, 0xf0c040, 0x5aa060][(i / 2) % 5]);
      P.rect(15, 2, 7, 5, 0xf0d8a0); P.hl(15, 2, 7, 0xfff0c8); P.hl(15, 6, 7, 0xc8a870); P.vl(18, 7, 17, 0x5a4030); P.hl(16, 24, 5, 0x3a2a1a);
      break;
    }
    case 'glasskylt': {                                                                  // glasstrut på en stolpe
      P = new Pix(14, 30); fx = 7; fy = 29; ob = [-3, -2, 3, 1];
      shadow(P, 7, 29, 4);
      P.vl(7, 16, 13, 0x8a8e96); P.hl(4, 28, 7, 0x5a5e66);
      for (let j = 0; j < 10; j++) { const hw = Math.max(0, Math.round((10 - j) * 0.45)); for (let i = -hw; i <= hw; i++) P.px(7 + i, 16 - j, (i + j) % 3 === 0 ? 0xb07a2a : 0xd8a04a); }
      for (let j = 0; j < 8; j++) for (let i = -5; i <= 5; i++) if (Math.hypot(i / 5.4, (j - 4) / 4) < 1) P.px(7 + i, 2 + j, j < 3 ? 0xfadce6 : i < -1 ? 0xfff4f8 : 0xf4b4c8);
      P.px(7, 1, 0xd8303a); P.px(7, 0, 0x3e7a34);
      break;
    }
    default: return null;
  }
  return (ITEM[kind] = { img: P.flush(), fx, fy, ob });
}
// ljus som hör till möblerna (lyktorna på marken)
const ITEM_GLOW = { lyktor: [[1, 6, 2, 4], [7, 4, 2, 6], [12, 9, 2, 3]] };

// ================= husen =================
// items: [sort, x relativt b.x (fotpunktens mitt), dy från base (standard 8)]
const PINK = [0xe83a4a, 0xf05a8a, 0xffffff], SUN = [0xf8d040, 0xffffff, 0xf08a2a], BLUE = [0x6a8ae8, 0xffffff, 0xb07ad8], MIX5 = [0xe83a4a, 0xf05a8a, 0xf8d040, 0xffffff, 0xb05ae0];
const SPEC = {
  // ---- norra raden (Pixelgatan) ----
  l_hus1: { type: 'lhus', upper: 'boards', wall: 0xe2b25a, stone: 0xbab2a4, roof: 'tile', dormers: [0.55], chimneys: [0.18], floors: 2, crown: 'gable', flowers: PINK, door: 0x2f5a44, num: '3', fretwork: true,
    items: [['buxbom', 14], ['kruka', 66], ['cykel', 90]] },
  l_kafe: { type: 'shop', upper: 'plaster', wall: 0xb8dcc4, roof: 'metal', roofCol: 0x4a5a56, chimneys: [0.8], floors: 1, crown: 'cornice', flowers: PINK, flowerP: 0, lights: true, hours: [7, 21],
    shop: { style: 'kafe', kind: 'kafe', col: 0x3a6a54, awning: [0x3a7a5a, 0xf4f0e6], sign: 'KAFÉ LINDEN', lightsY: 18 }, hang: ['kopp', true],
    look: { skin: '#eec3a0', hair: '#2a1a12', style: 'bun', shirt: '#f4f1ea', pants: '#2d3a5c', apron: true }, greet: 'KAFFET ÄR SNART KLART!',
    items: [['cafe', 13], ['cafe', 79], ['tavla', 26, 18]] },
  l_gardsbutik: { type: 'shop', upper: 'boards', wall: 0xa8442e, roof: 'tile', roofCol: 0x8a3a2a, floors: 1, crown: null, hoist: true, door: 0x6a3a22, hours: [8, 18],
    shop: { style: 'lada', kind: 'gard', fascia: 0xf0e2c0, signFg: 0x8a2a1a, signHi: 0xb04a2a, sign: 'GÅRDSBUTIKEN' }, hang: ['apple', true],
    look: { skin: '#e0a97f', hair: '#8a5a2a', style: 'short', hat: 'straw', shirt: '#4a7aa8', pants: '#3a4a2a', apron: true }, greet: 'FÄRSKA ÄGG SNART!',
    items: [['lador', 20], ['pumpor', 92]] },
  l_dekor: { type: 'shop', upper: 'plaster', wall: 0xe8b4b0, roof: 'metal', roofCol: 0x3e4250, dormers: [0.2, 0.8], floors: 1, crown: 'arch', flowers: MIX5, flowerP: 0, lightsTop: true, bunt: 'mid', hours: [10, 18],
    shop: { style: 'bage', kind: 'pynt', col: 0xf4efe4, fascia: 0x5a4a6a, signFg: 0xf6e6b0, awning: [0x9a6ab0, 0xf4efe4], sign: 'PYNT & TING' }, hang: ['stjarna', false],
    look: { skin: '#c68a5c', hair: '#1a1a1a', style: 'curly', shirt: '#9a6ab0', pants: '#2a2a34' }, greet: 'TITTA IN SNART!',
    items: [['bank', 20], ['lyktor', 37], ['oliv', 90], ['lyktor', 108]] },
  l_bageri: { type: 'shop', upper: 'plaster', wall: 0xf0e2c4, roof: 'tile', chimneys: [0.25], floors: 1, crown: 'gable', accent: 0xd8a83a, flowers: SUN, flowerP: 0.2, hours: [6, 18],
    shop: { style: 'konditori', kind: 'bageri', col: 0x7a4a2a, fascia: 0x5a3018, awning: [0xc8443a, 0xf4f0e6], sign: 'BAGERIET' }, hang: ['kringla', false],
    look: { skin: '#f6d7bf', hair: '#d8c8a0', style: 'short', shirt: '#f4f1ea', pants: '#f4f1ea', apron: true }, greet: 'NYGRÄDDAT I MORGON!',
    items: [['tavla2', 14], ['bank', 72]] },
  l_hus2: { type: 'lhus', upper: 'boards', wall: 0x9cb88a, stone: 0xb0aaa0, roof: 'tile', roofCol: 0xa44a34, dormers: [0.25, 0.75], chimneys: [0.5], floors: 2, crown: 'gable', flowers: MIX5, flowerP: 0, door: 0x8a3a2a, num: '11', fretwork: true,
    items: [['buxbom', 30], ['buxbom', 82], ['cykel2', 100]] },
  l_blommor: { type: 'shop', upper: 'plaster', wall: 0xf2dc94, roof: 'tile', chimneys: [0.7], floors: 1, crown: 'cornice', flowers: MIX5, flowerP: 0, ivy: ['L', 'gron'],
    shop: { style: 'orangeri', kind: 'blommor', col: 0x2e5a2c, sign: 'BLOMSTER' }, hang: ['blomma', true],
    look: { skin: '#eabf98', hair: '#c8642a', style: 'ponytail', shirt: '#5aa060', pants: '#2d3a5c', apron: true }, greet: 'TULPANERNA ÄR HÄR!',
    items: [['blomtrappa', 14], ['hinkar', 70]] },
  l_hus3: { type: 'lhus', upper: 'plaster', wall: 0x9cc0d8, stone: 0xb8b2a8, roof: 'metal', roofCol: 0x3a3e46, dormers: [0.72], chimneys: [0.12, 0.86], floors: 3, crown: 'cornice', mural: true, flowers: BLUE, door: 0x3a4a7a, num: '17', cols: 3,
    items: [['kruka', 36], ['kruka', 84], ['bank', 104]] },
  l_antik: { type: 'shop', upper: 'brick', wall: 0xa85a42, roof: 'tile', roofCol: 0x6a4a40, chimneys: [0.3], floors: 1, crown: 'cornice', ivy: ['R', 'host'], flowers: [0xe8a03a, 0xd8443a, 0xf4f0e4], flowerP: 0.3, hours: [10, 18],
    shop: { style: 'bursprak', kind: 'antik', col: 0x2f5a44, fascia: 0x1e3a2c, sign: 'ANTIKVARIAT' }, hang: ['bok', true],
    look: { skin: '#e0a97f', hair: '#d8d8d8', style: 'short', shirt: '#6a4a3a', pants: '#3a3a44', glasses: true, beard: true }, greet: 'SCH... HÄR LÄSER VI.',
    items: [['bokvagn', 16], ['stol', 72], ['lavendel', 88]] },
  l_hus4: { type: 'lhus', upper: 'boards', wall: 0xb04a34, stone: 0xb4ae9e, roof: 'tile', roofCol: 0x7a3a2a, dormers: [0.5], floors: 2, crown: 'gable', flowers: SUN, door: 0x2f6a3a, num: '23', fretwork: true, cols: 2, pipeLeft: true,
    items: [['buxbom', 20], ['lavendel', 64], ['cykel', 76]] },
  // ---- södra raden (Kajgatan / Södergatan) ----
  ls_hus1: { type: 'lhus', upper: 'boards', wall: 0x9cc4dc, stone: 0xb4b0a6, roof: 'tile', dormers: [0.4], chimneys: [0.8], floors: 2, crown: 'gable', flowers: PINK, door: 0x2a4a6a, num: '2', fretwork: true,
    items: [['kruka', 34], ['kruka', 78], ['bank', 96]] },
  ls_glass: { type: 'kiosk', wall: 0xfaf0f4, roof: 'tent', roofCol: 0xe86a9a, trim: 0xfaf4f2,
    items: [['glasskylt', 8], ['tavla2', 32]] },
  ls_loppis: { type: 'shop', upper: 'boards', wall: 0xd8a84a, roof: 'tile', roofCol: 0x9a4a34, floors: 1, crown: 'gable', bunt: 'mid', lights: true, hours: [10, 17],
    shop: { style: 'loppis', kind: 'loppis', sign: 'LOPPISEN' }, hang: ['kanna', false],
    look: { skin: '#a06a43', hair: '#2a1a12', style: 'afro', shirt: '#e0b040', pants: '#3a6ab0' }, greet: 'ALLT SKA BORT!',
    items: [['loppisbord', 18], ['skivor', 78]] },
  ls_hus2: { type: 'lhus', upper: 'plaster', wall: 0xf0d47a, stone: 0xb8b2a6, roof: 'tile', dormers: [0.3, 0.7], chimneys: [0.5], floors: 2, crown: 'cornice', flowers: MIX5, door: 0x3a5a8a, num: '8', cols: 4,
    items: [['cykelstall', 22], ['buxbom', 82], ['cykel', 104]] },
  ls_cykel: { type: 'shop', upper: 'plaster', wall: 0x8a9ab0, roof: 'metal', roofCol: 0x3a3e46, floors: 1, crown: null,
    shop: { style: 'verkstad', kind: 'cykel', fascia: 0xd8443a, signFg: 0xf8f4ea, sign: 'CYKELVERKSTAN' }, hang: ['hjul', true],
    look: { skin: '#eec3a0', hair: '#3b2619', style: 'short', hat: 'cap', cap: '#2a2a30', shirt: '#3a4a6a', pants: '#2a3a5a', apron: true }, greet: 'PUNKA? SNART ÖPPET!',
    items: [['cykel', 12], ['cykel2', 68]] },
  ls_hus3: { type: 'lhus', upper: 'plaster', wall: 0xd4886a, stone: 0xbab2a4, roof: 'tile', roofCol: 0x9a4a34, chimneys: [0.2, 0.8], floors: 2, crown: 'cornice', balconies: true, flowers: MIX5, door: 0x2f5a44, num: '14', cols: 4,
    items: [['oliv', 36], ['citron', 84], ['kruka', 104]] },
  ls_hus4: { type: 'lhus', upper: 'boards', wall: 0xf0d050, stone: 0xb4aea2, roof: 'tile', dormers: [0.5], floors: 2, crown: 'gable', flowers: BLUE, door: 0x2a5a8a, num: '18', fretwork: true,
    items: [['buxbom', 28], ['buxbom', 72], ['cykel2', 88]] },
  ls_hus5: { type: 'lhus', upper: 'boards', wall: 0xa8442e, stone: 0xb2ac9e, roof: 'tile', roofCol: 0x6a4a40, dormers: [0.6], chimneys: [0.2], floors: 2, crown: 'gable', flowers: SUN, door: 0x2f5a44, num: '24', fretwork: true, cat: 0x2a2a30, catLow: 0xe0902a,
    items: [['kruka', 36], ['lavendel', 80], ['bank', 100]] },
  ls_hus6: { type: 'lhus', upper: 'plaster', wall: 0xc4dcb4, stone: 0xb8b2a8, roof: 'metal', roofCol: 0x4a5a56, dormers: [0.25, 0.75], floors: 2, crown: 'arch', flowers: PINK, door: 0x8a3a5a, num: '30', rosesAt: [6, 112],
    items: [['kruka', 38], ['buxbom', 82], ['oliv', 104]] },
};

SPEC.sjoboden = { type: 'krog', door: 0x2a4a6a, items: [] };   // (v4) fiskrestaurangen på piren
const itemsOf = (b) => (SPEC[b.kind]?.items || []).map(([k, rx, dy]) => ({ k, x: b.x + rx, y: baseOf(b) + (dy ?? 8) }));

function makeLinneArt(kind) {
  const S = SPEC[kind];
  return {
    paint: (b, night, opts) => paintLinne(b, night, S, opts),
    live(ctx, b, st) {
      if (S.shop?.style !== 'lada') drawDoor(ctx, b, st, KITS[b.id] || (KITS[b.id] = doorKit(b, S)));   // (ladporten står öppen)
      const m = metaOf(b, st.night), t = st.t || 0;
      if (m && S.type === 'shop') liveWindows(ctx, b, st, S, m);
      for (const [cx, cy] of m?.smoke || []) for (let i = 0; i < 4; i++) {           // rök ur skorstenarna
        const ph = (t * 0.26 + i / 4 + (cx & 7) * 0.1) % 1, sz = 2 + Math.round(ph * 3);
        ctx.fillStyle = rgba(st.night ? 0x8a8ea0 : 0xe8e8ec, 0.38 * (1 - ph));
        ctx.fillRect(Math.round(cx + ph * 9 + Math.sin(t * 1.3 + i * 2) * 1.5), Math.round(cy - ph * 16), sz, sz - 1);
      }
    },
    glow(ctx, b, st) {
      const k = Math.min(1, (st.env?.dark || 0) * 2);
      if (k <= 0.02) return;
      const m = metaOf(b, true);
      if (!m) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, w, h, c, a] of m.glows) {
        ctx.fillStyle = rgba(c, a * k * 0.45); ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = rgba(c, a * k); ctx.fillRect(x, y, w, h);
      }
      for (const [x, y, w, h] of m.shop) {                                              // skyltfönstren lyser ut på trottoaren
        ctx.fillStyle = rgba(0xffe0a0, 0.26 * k); ctx.fillRect(x, y, w, h);
        ctx.fillStyle = rgba(0xffc070, 0.1 * k); ctx.fillRect(x - 3, baseOf(b), w + 6, 10);
      }
      for (const it of itemsOf(b)) for (const [gx, gy, gw, gh] of ITEM_GLOW[it.k] || []) {
        const A = itemArt(it.k);
        ctx.fillStyle = rgba(0xffd070, 0.7 * k); ctx.fillRect(it.x - A.fx + gx, it.y - A.fy + gy, gw, gh);
        ctx.fillStyle = rgba(0xffb050, 0.18 * k); ctx.fillRect(it.x - A.fx + gx - 3, it.y - A.fy + gy - 2, gw + 6, gh + 5);
      }
      const open = st.doorOpen || 0, x0 = b.door.x0, dw = b.door.x1 - b.door.x0, base = baseOf(b);
      ctx.fillStyle = rgba(0xffe0a0, (0.1 + open * 0.4) * k); ctx.fillRect(x0, base - DOOR_H, dw, DOOR_H);
      for (let r = 0; r < 10; r++) { const sp = Math.round(r * 0.6); ctx.fillStyle = rgba(0xffe0a0, (0.08 + open * 0.3) * k * (1 - r / 10)); ctx.fillRect(x0 - sp, base + r, dw + sp * 2, 1); }
      ctx.globalCompositeOperation = 'source-over';
    },
    items(b) {
      return itemsOf(b).map((it) => {
        const A = itemArt(it.k);
        return A ? { x: it.x, y: it.y, draw: (ctx) => ctx.drawImage(A.img, it.x - A.fx, it.y - A.fy) } : null;
      }).filter(Boolean);
    },
    obstacles(b) {
      return itemsOf(b).map((it) => { const A = itemArt(it.k); return A ? [it.x + A.ob[0], it.y + A.ob[1], it.x + A.ob[2], it.y + A.ob[3]] : null; }).filter(Boolean);
    },
  };
}
export const BUILDING_ART = Object.fromEntries(Object.keys(SPEC).map((k) => [k, makeLinneArt(k)]));
export const _SPEC = SPEC;
export const _meta = (id, night) => META[id + ':' + !!night] || null;   // (för testerna)
