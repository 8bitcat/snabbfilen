// Fasadlådan: en generisk husmålare för Pixelstadens nya hus (v2). Den ger
// ett hus med tak (platt med grus/ventiler eller sadeltak med pannor),
// fasad (tegel/puts/betong/trä/plåt) med sockel och taklist, våningar med
// fönster (spegling på dagen, tända rum på natten), bottenvåning (butik med
// skyltfönster, bostadsentré eller garageportar), skylt och dörr – och i
// förorten slitage: klotter, sprickor, rostränder, trasiga och igenspikade
// fönster, galler. Allt i ett pixelkorn med Pix-pennan, målat EN gång.
//
// Detta är en STARTPUNKT för specialisterna (buildings-south.js och
// buildings-suburb.js använder den tills husen får egen konst) – använd den,
// skriv om den eller ersätt den helt. Kontraktet för en husmodul står i
// docs/STADEN.md: BUILDING_ART[kind] = { paint(b, night, opts), live(ctx, b, st), glow(ctx, b, st), front?(ctx, b, st) }.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { artBox, baseOf } from './map.js';
import { $t } from '../core/i18n.js';

export const WHITE = 0xffffff;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
// färg med lätt brus → levande ytor utan platta fält
export function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
// kvantiserad gradient med bayer-dither (3–4 toner i stället för mjuk övergång)
export function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(clamp(t, 0, 1) * steps + bayer(x, y)) / steps;
  return mix(a, b, clamp(q, 0, 1));
}

// ---------- väggytor (canvas-koordinater; s = frö) ----------
export const WALLS = {
  brick(X, Y, c, s) {
    const bw = 7, bh = 3, row = Math.floor(Y / bh), ry = Y - row * bh;
    const xx = X + (row & 1 ? 3 : 0) + 64, col = Math.floor(xx / bw), rx = xx - col * bw;
    if (ry === bh - 1 || rx === bw - 1) return jit(mix(c, 0xcfc4b0, 0.45), X, Y, s + 1, 0.08);
    const h = hash(col, row, s);
    let k = h > 0.66 ? mix(c, 0xc8764e, 0.2) : h < 0.25 ? mix(c, 0x4a2418, 0.22) : c;
    if (ry === 0) k = mix(k, WHITE, 0.1);
    if (rx === bw - 2) k = mul(k, 0.88);
    return jit(k, X, Y, s, 0.07);
  },
  plaster(X, Y, c, s) {
    const n = hash(X >> 1, Y >> 1, s);
    return jit(n > 0.93 ? mul(c, 0.94) : n < 0.05 ? mix(c, WHITE, 0.08) : c, X, Y, s, 0.05);
  },
  concrete(X, Y, c, s) {
    const px = ((X % 32) + 32) % 32, py = ((Y % 22) + 22) % 22, pan = hash(Math.floor(X / 32), Math.floor(Y / 22), s);
    if (px === 31 || py === 21) return mul(c, 0.74);
    if (px === 0 || py === 0) return mix(c, WHITE, 0.08);
    let k = mix(c, pan > 0.5 ? 0xd8d4c8 : 0x8a877e, Math.abs(pan - 0.5) * 0.25);
    if (hash(X, Y, s + 3) > 0.96) k = mul(k, 0.85);
    return jit(k, X, Y, s, 0.06);
  },
  wood(X, Y, c, s) {
    const p = Math.floor(X / 4), rx = X - p * 4;
    if (rx === 3) return mul(c, 0.7);
    let k = mix(c, hash(p, 1, s) > 0.5 ? 0xe0c090 : 0x6a4020, 0.12);
    if (rx === 0) k = mix(k, WHITE, 0.1);
    if (hash(p, Y >> 3, s) > 0.93 && (Y & 7) === 3) k = mul(k, 0.6); // kvist
    return jit(k, X, Y, s, 0.05);
  },
  metal(X, Y, c, s) {
    const r = ((X % 3) + 3) % 3;
    return jit(r === 0 ? mix(c, WHITE, 0.16) : r === 2 ? mul(c, 0.76) : c, X, Y, s, 0.04);
  },
};

// ---------- takpannor och grus ----------
function tile(X, Y, y0, c) {
  const r = Math.floor((Y - y0) / 4), ry = Y - y0 - r * 4;
  const xx = X + (r & 1) * 2 + 20, c5 = Math.floor(xx / 5), rx = xx - c5 * 5;
  let k = mix(c, hash(c5, r, 3) > 0.5 ? mix(c, WHITE, 0.2) : mul(c, 0.7), hash(c5, r, 4) * 0.5);
  k = mul(k, [1.14, 1.05, 0.97, 0.85, 0.66][rx]);
  if (ry === 3) k = mul(k, 0.62); else if (ry === 0) k = mix(k, 0xffe6c8, 0.1);
  return jit(k, X, Y, 5, 0.05);
}
function gravel(X, Y, c) {
  const h = hash(X, Y, 71);
  return h > 0.9 ? mix(c, WHITE, 0.18) : h < 0.1 ? mul(c, 0.8) : jit(c, X, Y, 72, 0.06);
}

// ---------- fönster ----------
// o: { night, lit, broken, boarded, bars, frame, curtain, sill }
export function windowAt(P, x, y, w, h, o) {
  const fr = o.frame ?? 0xe8e2d4;
  P.rect(x - 1, y - 1, w + 2, h + 2, mul(fr, 0.55));                 // smyg (skugga runt)
  P.rect(x, y, w, h, fr);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  if (o.boarded) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = Math.floor(j / 3);
      P.px(x + i, y + j, (j % 3 === 2) ? 0x4a3420 : jit(hash(p, 0, x) > 0.5 ? 0x9a7448 : 0x7e5a36, x + i, y + j, 3, 0.12));
    }
    P.line(x, y + 2, x + w - 1, y + h - 3, 0x5a4028); // snett tvärslå
    P.px(x + 1, y + 2, 0xc8c8c8); P.px(x + w - 2, y + h - 3, 0xc8c8c8); // spikar
    return;
  }
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const X = gx + i, Y = gy + j;
    let c;
    if (o.night) c = o.lit ? qmix(0xffe6a8, 0xf0a850, j / gh, X, Y, 3) : qmix(0x1c2a44, 0x0e1628, j / gh, X, Y, 3);
    else c = qmix(0xb8d4ec, 0x4e6e96, j / gh, X, Y, 4);
    if (!o.night) { const s = (((X * 2 - Y * 3) % 30) + 30) % 30; if (s < 3) c = mix(c, WHITE, 0.35); }
    P.px(X, Y, c);
  }
  if (o.night && o.lit && o.curtain !== undefined) { P.rect(gx, gy, 2, gh, o.curtain); P.rect(gx + gw - 2, gy, 2, gh, o.curtain); }
  if (!o.night && o.curtain !== undefined) { P.rect(gx, gy, 2, gh, mix(o.curtain, 0x4e6e96, 0.3)); }
  if (w >= 9) P.vl(x + (w >> 1), gy, gh, fr);                        // mittpost
  if (h >= 12) P.hl(gx, y + (h >> 2) + 1, gw, fr);                   // tvärpost
  if (o.broken) {
    const cx = gx + ((hash(x, y, 5) * gw) | 0), cy = gy + ((hash(x, y, 6) * gh) | 0);
    for (let k = 0; k < 7; k++) P.line(cx, cy, cx + Math.round((hash(k, x, 7) - 0.5) * w), cy + Math.round((hash(k, y, 8) - 0.5) * h), 0x0a0c12);
    P.rect(cx - 1, cy - 1, 3, 3, 0x05060a);
  }
  if (o.bars) for (let i = gx + 1; i < gx + gw; i += 3) P.vl(i, gy, gh, 0x2a2a30);
  P.hl(x - 1, y + h + 1, w + 2, o.sill ?? 0xd8d2c4);                // fönsterbräda
  P.hl(x - 1, y + h + 2, w + 2, 0x000000, 0.18);
}

// ---------- skylt ----------
export function signPlate(P, cx, y, s, bg, fg, { small = false, border = null } = {}) {
  if (!s) return null;
  const F = small ? SMALL : BIG, tw = textW(F, s), w = tw + 8, h = F.h + 6, x = Math.round(cx - w / 2);
  P.rect(x, y, w, h, bg);
  P.hl(x, y, w, mix(bg, WHITE, 0.25)); P.hl(x, y + h - 1, w, mul(bg, 0.6));
  if (border !== null) P.box(x - 1, y - 1, w + 2, h + 2, border);
  P.hl(x, y + h, w, 0x000000, 0.25);
  text(P, F, s, x + 5, y + 4, mul(bg, 0.5), 0.8);
  text(P, F, s, x + 4, y + 3, fg);
  return [x, y, w, h];
}

// ---------- klotter ----------
const TAGS = ['PIX', 'ZOK', $t('KRAM'), 'YO', 'BTG', '4EVER', $t('SNUT'), 'LOL', $t('KAOS'), 'MIX', $t('Å!'), $t('VILD')];
const SPRAY = [0xe8443a, 0x3a9bff, 0x6fdc4c, 0xffd23f, 0xff5dc8, 0xf4f1ea, 0x9a5cff, 0x2a2a2a];
export function graffiti(P, x0, x1, y0, y1, seed, n = 3) {
  for (let k = 0; k < n; k++) {
    const t = TAGS[(hash(k, seed, 11) * TAGS.length) | 0], F = hash(k, seed, 12) > 0.6 ? BIG : SMALL;
    const tw = textW(F, t), room = x1 - x0 - tw - 4;
    if (room < 0) continue;
    const x = x0 + 2 + ((hash(k, seed, 13) * room) | 0), y = y0 + ((hash(k, seed, 14) * Math.max(1, y1 - y0 - F.h - 2)) | 0);
    const c = SPRAY[(hash(k, seed, 15) * SPRAY.length) | 0], o = SPRAY[(hash(k, seed, 16) * SPRAY.length) | 0];
    // kontur + fyllning + droppar
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, F, t, x + dx, y + dy, o === c ? 0x1a1a1a : o, 0.9);
    text(P, F, t, x, y, c);
    for (let d = 0; d < 3; d++) { const dx = x + ((hash(d, k, seed) * tw) | 0); P.vl(dx, y + F.h, 2 + ((hash(d, k, 17) * 4) | 0), c, 0.8); }
  }
}
export function cracks(P, x0, x1, y0, y1, seed, n = 3) {
  for (let k = 0; k < n; k++) {
    let x = x0 + hash(k, seed, 21) * (x1 - x0), y = y0 + hash(k, seed, 22) * (y1 - y0);
    for (let s = 0; s < 10; s++) {
      const nx = x + (hash(k, s, seed + 23) - 0.5) * 5, ny = y + 1 + hash(k, s, seed + 24) * 3;
      P.line(x, y, nx, ny, 0x000000, 0.45); x = nx; y = ny;
    }
  }
}

// ---------- dörrar ----------
export function doorAt(P, x, y, w, h, type, col, night) {
  P.rect(x - 2, y - 2, w + 4, h + 2, mul(col, 0.5));                 // karm
  P.hl(x - 2, y - 3, w + 4, mix(col, WHITE, 0.2));
  if (type === 'roll') {
    for (let j = 0; j < h; j++) P.hl(x, y + j, w, (j % 3 === 2) ? mul(col, 0.7) : jit(col, x, y + j, 4, 0.05));
    P.rect(x + (w >> 1) - 3, y + h - 3, 6, 1, 0x333333);
    return;
  }
  if (type === 'boarded') {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, (i % 5 === 4) ? 0x3e2c1a : jit(hash(Math.floor(i / 5), 1, x) > 0.5 ? 0x8a6a42 : 0x6e4e2e, x + i, y + j, 5, 0.12));
    P.line(x, y + 3, x + w - 1, y + h - 4, 0x4a3420); P.line(x + w - 1, y + 3, x, y + h - 4, 0x4a3420);
    return;
  }
  if (type === 'slide' || type === 'open') {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, night ? qmix(0xffe0a0, 0xc88a40, j / h, x + i, y + j, 3) : qmix(0xa8c8e4, 0x3e5a80, j / h, x + i, y + j, 3));
    P.vl(x + (w >> 1), y, h, 0x8a929c); P.box(x, y, w, h, 0x8a929c);
    return;
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, jit(col, x + i, y + j, 6, 0.06));
  const pw = Math.max(3, (w >> 1) - 3);
  P.box(x + 2, y + 3, pw, h - 8, mul(col, 0.75));                     // speglar
  P.box(x + w - pw - 2, y + 3, pw, h - 8, mul(col, 0.75));
  P.rect(x + 3, y + 4, pw - 2, 5, night ? 0xffd88a : 0x9fc3e0);        // glasruta
  P.px(x + w - 4, y + (h >> 1) + 1, 0xe8d070);                         // handtag
}

// ---------------------------------------------------------------------
// Ett helt hus efter en spec. Returnerar { cv, lit, shop, door } där lit är
// tända fönster i VÄRLDSKOORDINATER ([x, y, w, h]) för glow().
//   spec: { wall, wallKind, roof: 'flat'|'gable'|'none', roofCol, trim, frame,
//           ground: 'shop'|'house'|'garage'|'plain', groundH, floorH, winW, winSp,
//           signBg, signFg, awning, worn, bars, balcony, dish, extra(P, K) }
//   opts (från scenen): { snow: 0|1, season, worn }
// ---------------------------------------------------------------------
export function paintBuilding(b, night, spec, opts = {}) {
  const box = artBox(b), P = new Pix(box.w, box.h);
  const X = (wx) => wx - box.x, Y = (wy) => wy - box.y;
  const seed = [...b.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) & 0xffff;
  const worn = spec.worn ?? opts.worn ?? 0;
  const fx0 = 8, fx1 = 8 + b.w, baseY = box.h - 4, ftop = baseY - b.h;
  const wallFn = WALLS[spec.wallKind || 'plaster'], wall = spec.wall ?? 0xd8c8a8, trim = spec.trim ?? mix(wall, WHITE, 0.35);
  const lit = [];
  // ---- tak ----
  let rtop = b.row === 'f' ? ftop - Math.round(b.d * 0.6) : Y(b.top);
  if (rtop > ftop - 8) rtop = ftop - 8;
  rtop = Math.max(0, rtop);
  const roofCol = spec.roofCol ?? (spec.roof === 'gable' ? 0xa44a32 : 0x7a7670);
  if (spec.roof !== 'none') {
    for (let y = rtop; y < ftop; y++) for (let x = fx0; x < fx1; x++) {
      let c;
      if (spec.roof === 'gable') {
        const mid = rtop + ((ftop - rtop) * 0.42 | 0);
        c = tile(x, y, rtop, roofCol);
        if (y < mid) c = mul(c, 0.8); else if (y === mid) c = mix(roofCol, WHITE, 0.3);
      } else {
        c = gravel(x, y, roofCol);
        if (y <= rtop + 1) c = mix(roofCol, WHITE, 0.12);                  // bortre krönet
        else if (x <= fx0 + 1) c = mix(roofCol, WHITE, 0.2);               // vänster krön (solsidan)
        else if (x >= fx1 - 2) c = mul(roofCol, 0.75);                     // höger krön (skuggsidan)
        if (y >= ftop - 3) c = y === ftop - 1 ? mul(roofCol, 0.62) : mix(roofCol, WHITE, 0.28);  // takfotens krön
      }
      if (worn && spec.roof !== 'gable' && hash(x >> 2, y >> 2, seed + 40) > 1 - worn * 0.12) c = mix(c, 0x3a4a2a, 0.35); // mossa/fläckar
      P.px(x, y, c);
    }
    // ventiler, skorstenar och aggregat
    const nv = Math.max(1, (b.w / 40) | 0);
    for (let k = 0; k < nv && ftop - rtop > 12; k++) {
      const vx = fx0 + 6 + ((hash(k, seed, 41) * (b.w - 18)) | 0), vy = rtop + 3 + ((hash(k, seed, 42) * Math.max(1, ftop - rtop - 14)) | 0);
      if (spec.roof === 'gable') { P.rect(vx, vy - 6, 6, 9, 0x8a4a34); P.hl(vx - 1, vy - 7, 8, 0x5a5250); P.vl(vx + 5, vy - 6, 9, 0x5a2a1c); }
      else { P.rect(vx, vy, 8, 5, 0xb4b0a8); P.hl(vx, vy, 8, 0xd8d4cc); P.hl(vx, vy + 4, 8, 0x6a6660); P.rect(vx + 2, vy + 1, 4, 2, 0x4a4844); }
    }
    if (opts.snow) for (let y = rtop; y < ftop - 1; y++) for (let x = fx0; x < fx1; x++) if (hash(x, y, 91) > 0.12) P.px(x, y, hash(x, y, 92) > 0.8 ? 0xffffff : 0xe8eef6, 0.9);
  }
  // ---- fasad ----
  for (let y = ftop; y < baseY; y++) for (let x = fx0; x < fx1; x++) {
    let c = wallFn(x, y, wall, seed);
    if (x === fx0) c = mix(c, WHITE, 0.14);
    else if (x >= fx1 - 2) c = mul(c, x === fx1 - 1 ? 0.72 : 0.86);
    P.px(x, y, c);
  }
  P.hl(fx0, ftop, b.w, mix(trim, WHITE, 0.2)); P.hl(fx0, ftop + 1, b.w, trim); P.hl(fx0, ftop + 2, b.w, mul(trim, 0.8));
  P.hl(fx0, ftop + 3, b.w, 0x000000, 0.25);
  const plinth = mix(wall, 0x5a5650, 0.55);
  for (let y = baseY - 5; y < baseY; y++) for (let x = fx0; x < fx1; x++) P.px(x, y, y === baseY - 5 ? mix(plinth, WHITE, 0.2) : jit(plinth, x, y, seed + 2, 0.08));
  // ---- våningar ----
  const gh = spec.groundH ?? 30, fh = spec.floorH ?? 22, ww = spec.winW ?? 10, sp = spec.winSp ?? 18, wh = spec.winH ?? 13;
  const upTop = ftop + 6, upBot = baseY - gh - 13;
  const floors = Math.max(0, Math.floor((upBot - upTop) / fh));
  const cols = Math.max(1, Math.floor((b.w - 10) / sp));
  const wx0 = fx0 + Math.round((b.w - (cols * sp - (sp - ww))) / 2);
  const off = upBot - floors * fh;
  for (let f = 0; f < floors; f++) {
    const wy = off + f * fh + ((fh - wh) >> 1);
    for (let k = 0; k < cols; k++) {
      const wx = wx0 + k * sp, hv = hash(k, f, seed + 50);
      const o = { night, lit: night && hv > 0.42, frame: spec.frame, curtain: hash(k, f, seed + 51) > 0.5 ? 0xc85a4a : 0xe8d8a8,
        broken: worn > 0.5 && hv < 0.08 * worn,
        boarded: spec.boarded ? hash(k, f, seed + 49) < spec.boarded : worn > 0.5 && hv > 0.97 - 0.05 * worn };
      windowAt(P, wx, wy, ww, wh, o);
      if (o.lit && !o.boarded) lit.push([wx + box.x, wy + box.y, ww, wh]);
      if (spec.balcony && (k & 1) === 0) {                                   // balkong under fönstret
        const bx = wx - 3, by = wy + wh + 3, bw = ww + 6;
        P.rect(bx, by, bw, 6, mix(wall, 0x9a968c, 0.5)); P.hl(bx, by, bw, mix(wall, WHITE, 0.3)); P.hl(bx, by + 6, bw, 0x000000, 0.3);
        for (let i = bx + 1; i < bx + bw; i += 2) P.vl(i, by + 1, 4, 0x5a5a60, 0.6);
        if (hash(k, f, seed + 52) > 0.6) P.rect(bx + 2, by - 3, 4, 3, SPRAY[(hash(k, f, seed + 53) * 6) | 0]); // tvätt/blomlåda
      }
      if (spec.dish && hash(k, f, seed + 54) > 0.75) { P.ell(wx + ww + 3, wy + 4, 3, 3, 0xd8d8d8, 1, 2); P.px(wx + ww + 3, wy + 4, 0x888888); }
      if (worn > 0.3 && hash(k, f, seed + 55) > 0.5) for (let r = 0; r < 4 + ((hash(k, f, 56) * 8) | 0); r++) P.px(wx + 2 + ((hash(k, r, 57) * (ww - 4)) | 0), wy + wh + 3 + r, 0x6a4a2a, 0.35); // rostrand
    }
  }
  // ---- bottenvåning ----
  const dx = X(b.door.x0), dw = b.door.x1 - b.door.x0, dh = b.door.type === 'roll' ? Math.min(34, gh + 2) : 26, dy = baseY - dh;
  const gtop = baseY - gh;
  const ground = spec.ground || 'house';
  const shop = [];
  if (ground === 'shop') {
    const panes = [[fx0 + 5, dx - 4], [dx + dw + 4, fx1 - 5]];
    for (const [a, z] of panes) {
      if (z - a < 8) continue;
      const py = gtop + 4, ph = gh - 10;
      windowAt(P, a, py, z - a, ph, { night, lit: night, frame: spec.frame ?? 0x3a3a40, bars: spec.bars });
      for (let i = a + 2; i < z - 2; i += 3) if (hash(i, seed, 58) > 0.35) P.rect(i, py + ph - 5, 2, 4, SPRAY[(hash(i, seed, 59) * 7) | 0]); // varor i fönstret
      shop.push([a + box.x, py + box.y, z - a, ph]);
    }
  } else if (ground === 'house') {
    for (const wx of [fx0 + 8, fx1 - 8 - ww]) if (Math.abs(wx - dx) > ww + 4 && Math.abs(wx - (dx + dw)) > 4) {
      windowAt(P, wx, gtop + 6, ww, wh, { night, lit: night && hash(wx, seed, 60) > 0.4, frame: spec.frame, bars: spec.bars,
        broken: worn > 0.6 && hash(wx, seed, 61) > 0.7, boarded: !!spec.boarded && hash(wx, seed, 65) < spec.boarded });
    }
  }
  doorAt(P, dx, dy, dw, dh, b.door.type, spec.doorCol ?? 0x6a4a30, night);
  P.rect(dx - 3, baseY, dw + 6, 2, mix(plinth, WHITE, 0.25));          // trappsteg
  // markis och skylt
  if (spec.awning !== undefined && spec.awning !== null) {
    const ay = gtop - 1, ah = 7;
    for (let y = ay; y < ay + ah; y++) for (let x = fx0 - 2; x < fx1 + 2; x++) {
      const stripe = Math.floor((x - fx0) / 5) & 1;
      let c = stripe ? spec.awning : 0xf4f1ea;
      if (y === ay + ah - 1) c = mul(c, 0.75); else if (y === ay) c = mix(c, WHITE, 0.2);
      P.px(x, y, worn > 0.5 && hash(x, y, seed + 62) > 0.9 ? mul(c, 0.6) : c);
    }
    P.hl(fx0 - 2, ay + ah, b.w + 4, 0x000000, 0.3);
  }
  const signY = spec.awning !== undefined && spec.awning !== null ? gtop - 20 : gtop - 14;
  const sign = spec.noSign ? null : signPlate(P, fx0 + b.w / 2, signY, b.sign, spec.signBg ?? 0x2a3a5c, spec.signFg ?? 0xf4f1ea,
    { small: textW(BIG, b.sign || '') + 12 > b.w, border: spec.signBorder ?? null });
  // ---- slitage ----
  if (worn > 0) {
    if (worn >= 0.3) graffiti(P, fx0 + 2, fx1 - 2, gtop + 2, baseY - 6, seed, Math.round(1 + worn * 3));
    cracks(P, fx0, fx1, ftop + 4, baseY - 6, seed, Math.max(1, Math.round(worn * 5)));
    for (let x = fx0; x < fx1; x++) if (hash(x, seed, 63) > 0.55) P.px(x, baseY - 6 - ((hash(x, 1, 64) * 3) | 0), 0x2a2418, 0.3 * worn); // smuts vid sockeln
  }
  // K = allt extra() behöver; extra lägger det live()/glow() ska veta i K.out (VÄRLDSKOORDINATER)
  const K = { b, P, box, X, Y, fx0, fx1, baseY, ftop, rtop, gtop, dx, dy, dw, dh, sign, night, seed, worn, wall, trim, lit, shop, opts, out: {} };
  spec.extra?.(P, K);
  return { cv: P.flush(), lit, shop, sign: sign && [sign[0] + box.x, sign[1] + box.y, sign[2], sign[3]], door: { x: b.door.x0, y: baseOf(b) - dh, w: dw, h: dh }, ...K.out };
}

// ---------------------------------------------------------------------
// BUILDING_ART-post för en spec: paint cachas av scenen per (hus, natt, snö);
// live ritar dörren som öppnas, glow tänder fönster, skyltfönster och skylt.
// ---------------------------------------------------------------------
export function makeArt(spec) {
  const memo = new Map(); // senaste målningens metadata per hus och natt
  const meta = (b, night) => memo.get(b.id + ':' + !!night) || memo.get(b.id + ':' + !night);
  return {
    paint(b, night, opts = {}) {
      const r = paintBuilding(b, night, spec, opts);
      memo.set(b.id + ':' + !!night, r);
      return r.cv;
    },
    live(ctx, b, st) {
      const m = meta(b, st.night);
      if (!m) return;
      const f = clamp(st.doorOpen || 0, 0, 1), { x, y, w, h } = m.door;
      if (f > 0.02 && b.door.type !== 'boarded' && b.door.type !== 'roll') {
        const ow = Math.round(w * f);
        ctx.fillStyle = st.night ? '#3a2a18' : '#1a1c24';
        if (b.door.type === 'slide') { ctx.fillRect(x + ((w - ow) >> 1), y, ow, h); }
        else ctx.fillRect(x, y, ow, h);
      }
      spec.live?.(ctx, b, st, m);
    },
    glow(ctx, b, st) {
      const m = meta(b, true);
      const k = clamp((st.env?.dark ?? (st.night ? 0.5 : 0)) / 0.5, 0, 1);
      if (!m || k <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, w, h] of m.lit) {
        ctx.fillStyle = rgba(0xffc870, (0.34 * k).toFixed(3)); ctx.fillRect(x, y, w, h);
        ctx.fillStyle = rgba(0xff9a40, (0.1 * k).toFixed(3)); ctx.fillRect(x - 2, y - 1, w + 4, h + 4);
      }
      const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
      if (open) for (const [x, y, w, h] of m.shop) {
        ctx.fillStyle = rgba(0xffe0a0, (0.3 * k).toFixed(3)); ctx.fillRect(x, y, w, h);
        ctx.fillStyle = rgba(0xffc070, (0.12 * k).toFixed(3)); ctx.fillRect(x - 3, y + h, w + 6, 10);
      }
      if (m.sign && spec.neon) { const [x, y, w, h] = m.sign; ctx.fillStyle = rgba(spec.neon, (0.35 * k).toFixed(3)); ctx.fillRect(x - 2, y - 2, w + 4, h + 4); }
      spec.glow?.(ctx, b, st, k, m);
      ctx.globalCompositeOperation = 'source-over';
    },
    ...(spec.front ? { front: (ctx, b, st) => spec.front(ctx, b, st, meta(b, st.night)) } : {}),
  };
}
