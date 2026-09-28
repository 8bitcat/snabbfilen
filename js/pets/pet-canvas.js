// Pixelduken för husdjuren: en liten buffert (BW×BH) där djuren målas del för del
// i målarordning (längst bort först). Primitiver: skuggad ellips, tjock linje
// (ben/svans), triangel (öron), enstaka pixlar. Varje del har en grupp; en del
// med `ink` får en mörk innerkontur där den ligger över en annan grupp, och sist
// får hela figuren en mörk yttre kontur (samma stil som folket i js/core/people.js).
// Koordinater: bufferpixlar, (AX, GY) = mitten av fötterna (raden GY är marken).
import { mix, mul } from '../core/floor-pix.js';

export const BW = 64, BH = 60, AX = 32, GY = 49;
export const SP = 0.52, CP = 0.86; // djup → skärm-y, höjd → skärm-y (snett ovanifrån)
export const G = { none: 0, tail: 1, far: 2, body: 3, thigh: 4, leg: 5, neck: 6, head: 7, ear: 8, snout: 9, face: 10, earFar: 11, paw: 12, mane: 13, tailNear: 14 };

// modell (u framåt, v djurets vänster, w upp) → [bx, by, djup] för en vy
export function projector(view) {
  if (view === 'front') return (u, v, w) => [AX + 0.5 + v, GY + 0.5 + u * SP - w * CP, -u];
  if (view === 'back') return (u, v, w) => [AX + 0.5 - v, GY + 0.5 - u * SP - w * CP, u];
  return (u, v, w) => [AX + 0.5 + u, GY + 0.5 - v * SP - w * CP, v]; // sidan (höger); vänster speglas
}

// ---------------------------------------------------------------- färger
const lum = (c) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) / 255;
export { lum };
const RAMPS = new Map();
// [ljus, bas, skugga, djup] – ljusa toner drar mot varmt vitt, skuggor mot blålila
export function rampOf(c) {
  let r = RAMPS.get(c);
  if (r) return r;
  const L = lum(c);
  r = [
    L > 0.86 ? mix(c, 0xffffff, 0.75) : mix(mul(c, 1.16), 0xfff4e2, L < 0.2 ? 0.22 : 0.15),
    c,
    L > 0.86 ? mix(c, 0xa8a2c0, 0.3) : L < 0.2 ? mix(mul(c, 0.72), 0x14101e, 0.2) : mix(mul(c, 0.78), 0x2a1f3a, 0.14),
    L > 0.86 ? mix(c, 0x7a7494, 0.52) : L < 0.2 ? mix(mul(c, 0.5), 0x0c0a14, 0.3) : mix(mul(c, 0.56), 0x1a1426, 0.24),
  ];
  RAMPS.set(c, r);
  return r;
}
export const inkOf = (c) => mix(mul(c, 0.7), 0x2a1f3a, 0.2);

// ---------------------------------------------------------------- bufferten
export function newBuf() {
  return { col: new Int32Array(BW * BH).fill(-1), grp: new Uint8Array(BW * BH) };
}
const inb = (i, j) => i >= 0 && j >= 0 && i < BW && j < BH;
export function put(B, i, j, c, g) {
  if (!inb(i, j) || c == null || c < 0) return;
  const k = j * BW + i;
  B.col[k] = c;
  if (g != null) B.grp[k] = g;
}
export function get(B, i, j) { return inb(i, j) ? B.col[j * BW + i] : -1; }
export function grpAt(B, i, j) { return inb(i, j) ? B.grp[j * BW + i] : 0; }

// ljus från vänster-uppe-fram
const LX = -0.46, LY = -0.6, LZ = 0.65;
const toneI = (i) => (i > 0.74 ? 0 : i > -0.1 ? 1 : i > -0.52 ? 2 : 3);

function shadeTo(B, i, j, c, ti, o, g, mask) {
  if (o.under && B.col[j * BW + i] >= 0) return;
  if (o.only && !o.only(B.grp[j * BW + i], B.col[j * BW + i])) return;
  ti = Math.max(0, Math.min(3, ti + (o.far || 0)));
  if (o.minTone != null) ti = Math.max(ti, o.minTone);
  if (o.maxTone != null) ti = Math.min(ti, o.maxTone);
  const col = typeof c === 'number' ? rampOf(c)[ti] : c.flat;
  put(B, i, j, col, g);
  mask.add(j * BW + i);
}

// Skuggad ellips med centrum (cx, cy), radier rx/ry, vriden rot radianer.
// mat(i, j, lu, lv) → färg (heltal, tonas), { flat: färg } (otonad) eller null (hoppa över).
export function ell(B, cx, cy, rx, ry, rot, mat, o = {}) {
  const mask = new Set();
  if (!(rx > 0.2 && ry > 0.2)) return mask;
  const cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
  const Rm = Math.max(rx, ry) + 1;
  const g = o.g ?? G.body, fat = o.fat ?? 1.04;
  if (o.maxTone == null && Math.min(rx, ry) < 2.2) o = { ...o, maxTone: 2 };
  for (let j = Math.floor(cy - Rm); j <= Math.ceil(cy + Rm); j++) for (let i = Math.floor(cx - Rm); i <= Math.ceil(cx + Rm); i++) {
    if (!inb(i, j)) continue;
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
    const lu = (dx * cs + dy * sn) / rx, lv = (-dx * sn + dy * cs) / ry;
    const d2 = lu * lu + lv * lv;
    if (d2 > fat) continue;
    if (o.clip && !o.clip(i, j, lu, lv)) continue;
    const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
    const nx = lu * cs - lv * sn, ny = lu * sn + lv * cs;
    const c = mat(i, j, lu, lv);
    if (c == null) continue;
    shadeTo(B, i, j, c, toneI(nx * LX + ny * LY + nz * LZ + (o.bright || 0)), o, g, mask);
  }
  if (o.ink) inkEdge(B, mask, g, o.ink);
  return mask;
}

// Tjock linje genom punkterna pts ([[x, y], …] i bufferkoordinater). rad = radie (tal eller t → radie).
// mat(i, j, t, s) där t = 0…1 längs linjen och s = −1…1 tvärs (negativt = belyst sida).
// o.leg: benskuggning (belyst kolumn bas, andra skugga); annars rund skuggning.
export function thick(B, pts, rad, mat, o = {}) {
  const mask = new Set();
  if (!pts || pts.length < 2) return mask;
  const g = o.g ?? G.leg;
  const segs = [];
  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, L, t0: total });
    total += L;
  }
  total = total || 1;
  const rMax = typeof rad === 'function' ? Math.max(rad(0), rad(0.5), rad(1)) : rad;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  for (let j = Math.floor(y0 - rMax - 1); j <= Math.ceil(y1 + rMax + 1); j++) for (let i = Math.floor(x0 - rMax - 1); i <= Math.ceil(x1 + rMax + 1); i++) {
    if (!inb(i, j)) continue;
    const px = i + 0.5, py = j + 0.5;
    let best = 1e9, bt = 0, bx = 0, by = 0;
    for (const s of segs) {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      const q = s.L > 1e-6 ? Math.max(0, Math.min(1, ((px - s.a[0]) * dx + (py - s.a[1]) * dy) / (s.L * s.L))) : 0;
      const nx = s.a[0] + dx * q, ny = s.a[1] + dy * q;
      const d = Math.hypot(px - nx, py - ny);
      if (d < best - 1e-9) { best = d; bt = (s.t0 + q * s.L) / total; bx = nx; by = ny; }
    }
    const r = typeof rad === 'function' ? rad(bt) : rad;
    if (best > r + 0.02) continue;
    const ox = (px - bx) / Math.max(0.5, r), oy = (py - by) / Math.max(0.5, r);
    const lit = ox * -0.6 + oy * -0.8;
    const c = mat(i, j, bt, -lit);
    if (c == null) continue;
    let ti;
    if (o.leg) ti = r < 0.75 ? 1 : lit > 0.05 ? 1 : lit < -0.05 ? 2 : 1;
    else {
      const d2 = Math.min(1, ox * ox + oy * oy);
      ti = toneI(ox * LX + oy * LY + Math.sqrt(1 - d2) * LZ + (o.bright || 0));
    }
    shadeTo(B, i, j, c, ti, o, g, mask);
  }
  if (o.ink) inkEdge(B, mask, g, o.ink);
  return mask;
}

// fylld triangel/polygon (konvex), plant tonad (o.tone, standard bas)
export function poly(B, P, mat, o = {}) {
  const mask = new Set();
  const g = o.g ?? G.ear;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  // orientering
  let area = 0;
  for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area >= 0 ? 1 : -1;
  const eps = o.eps ?? 0.05;
  for (let j = Math.floor(y0); j <= Math.ceil(y1); j++) for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) {
    if (!inb(i, j)) continue;
    const px = i + 0.5, py = j + 0.5;
    let inside = true, minE = 1e9;
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1;
      const e = sgn * (ex * (py - a[1]) - ey * (px - a[0])) / L;
      if (e < -eps) { inside = false; break; }
      minE = Math.min(minE, e);
    }
    if (!inside) continue;
    const c = mat(i, j, minE);
    if (c == null) continue;
    shadeTo(B, i, j, c, o.tone ?? 1, o, g, mask);
  }
  if (o.ink) inkEdge(B, mask, g, o.ink);
  return mask;
}

// Mörk innerkant där delen (mask) gränsar mot en annan, tidigare ritad grupp.
// mode: true = alla sidor, 'down' = bara nedåt/sidorna (inte uppåt), 'up' = bara uppåt
export function inkEdge(B, mask, g, mode = true) {
  const hit = [];
  for (const k of mask) {
    const i = k % BW, j = (k - i) / BW;
    const N = mode === 'down' ? [[1, 0], [-1, 0], [0, 1]] : mode === 'up' ? [[0, -1]] : mode === 'side' ? [[1, 0], [-1, 0]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of N) {
      const x = i + dx, y = j + dy;
      if (!inb(x, y)) continue;
      const q = y * BW + x;
      if (mask.has(q) || B.col[q] < 0 || B.grp[q] === g) continue;
      hit.push(k); break;
    }
  }
  for (const k of hit) B.col[k] = inkOf(B.col[k]);
}

// Yttre kontur: tom pixel intill figuren får en mörk ton av grannen (helst den ovanför)
export function outline(B) {
  const src = B.col, out = Int32Array.from(src);
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    const k = j * BW + i;
    if (src[k] >= 0) continue;
    let best = -1;
    for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const x = i + dx, y = j + dy;
      if (!inb(x, y)) continue;
      const q = y * BW + x;
      if (src[q] >= 0 && B.grp[q] !== G.none) { best = src[q]; break; }
    }
    if (best < 0) continue;
    const r = (best >> 16) & 255, gg = (best >> 8) & 255, b = best & 255;
    out[k] = (((r * 0.26 + 16) | 0) << 16) | (((gg * 0.22 + 11) | 0) << 8) | ((b * 0.3 + 24) | 0);
    B.grp[k] = G.none;
  }
  B.col = out;
}

// Beskär och gör en canvas. flip = spegla (vänstervy). Returnerar { cv, ox, oy, w, h } där
// (ox, oy) = övre vänstra hörnet relativt fötterna.
export function toCanvas(B, flip) {
  let x0 = BW, y0 = BH, x1 = -1, y1 = -1;
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) if (B.col[j * BW + i] >= 0) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(w, h), dd = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = B.col[(j + y0) * BW + i + x0];
    if (c < 0) continue;
    const p = (j * w + (flip ? w - 1 - i : i)) * 4;
    dd[p] = (c >> 16) & 255; dd[p + 1] = (c >> 8) & 255; dd[p + 2] = c & 255; dd[p + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  // fötterna: kolumnen AX (mitten) och raden GY
  const ox = flip ? AX - x1 : x0 - AX;
  return { cv, ox, oy: y0 - GY, w, h };
}
