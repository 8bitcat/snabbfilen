// FÖRORTEN: fasadkonst för förortens hus – höghusen på Betongvägen (1, 5 och
// lamellen 7), närbutiken med en sliten ljuslåda som flimrar, galler och handskrivna lappar, pantbanken med de
// tre guldkulorna, kebaben med neon där en bokstav är släckt, det igenspikade
// huset, bilverkstan med oljefläckar och däckstaplar, tvätteriet, garagelängan,
// lagerhallen och husvagnen. Allt är slitet men detaljrikt: betongelement,
// balkonger med tvätt och paraboler, trasiga persienner, klotter med läsbara
// pixelbokstäver, sprickor, rost, ogräs.
//
// Kontrakt (docs/STADEN.md): BUILDING_ART[kind] = { paint(b, night, opts) → canvas,
// live(ctx, b, st), glow(ctx, b, st) }. Bilden är b.w + 16 bred och står på b.base
// (artBox/artPos i map.js): canvas-x = världs-x − b.x + 8, canvas-y = världs-y − artBox(b).y.
// Allt statiskt målas EN gång med Pix-pennan (scenen cachar per hus/natt/snö);
// live() ritar bara dörren, neon, tv-flimmer, rök, trummor – billiga drawImage/fillRect.
import { Pix, SMALL, BIG, text, textW, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { ART_OVER, ART_BELOW, artBox, baseOf } from './map.js';
import { FRAMES } from '../data/frames.js';

const O = ART_OVER, WHITE = 0xffffff, OUT = 0x1c1a20;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${clamp(a, 0, 1).toFixed(3)})`;
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const seedOf = (id) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) & 0xffff, 7);
const pick = (arr, a, b, s) => arr[Math.floor(hash(a, b, s) * arr.length) % arr.length];

// ======================= små målarverktyg =======================
// färg med lätt brus (hash + bayer) → levande ytor utan platta fält
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
// kvantiserad gradient med bayer-dither (3–4 toner i stället för mjuk övergång)
function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(clamp(t, 0, 1) * steps + bayer(x, y)) / steps;
  return mix(a, b, clamp(q, 0, 1));
}
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = fn(x + i, y + j, i, j);
    if (c !== null && c !== undefined) P.px(x + i, y + j, c);
  }
}
function rows(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) P.hl(x, y + i, w, c); }); }
// kontaktskugga längs husfoten ute på trottoaren
function footShadow(P, x, w, by) { P.hl(x, by, w, 0x1a1422, 0.34); P.hl(x, by + 1, w, 0x1a1422, 0.18); P.hl(x + 1, by + 2, w - 2, 0x1a1422, 0.08); }
// rinnrand (rost/smuts) nedåt från en punkt, tonar ut
function streak(P, x, y, len, c, a = 0.5, s = 0) {
  for (let j = 0; j < len; j++) {
    const k = 1 - j / len;
    P.px(x, y + j, c, a * k);
    if (hash(x, y + j, s) > 0.6) P.px(x + 1, y + j, c, a * k * 0.5);
  }
}
// spricka som slingrar sig nedåt
function crack(P, x, y, len, s, c = 0x000000, a = 0.45) {
  let cx = x;
  for (let j = 0; j < len; j++) {
    const h = hash(j, s, 21);
    if (h > 0.8) cx += 1; else if (h < 0.2) cx -= 1;
    P.px(cx, y + j, c, a);
    if (h > 0.93) P.px(cx + 1, y + j, c, a * 0.6);
  }
}
// mossa/alger i fläckar
function moss(P, x, y, w, h, s, dens = 0.06) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = hash((x + i) >> 1, (y + j) >> 1, s);
    if (n < dens) P.px(x + i, y + j, n < dens * 0.4 ? 0x3a5a2a : 0x5a7a34, 0.55);
  }
}
// ogräs som sticker upp ur en spricka (y = marken)
function weeds(P, x, y, n, s) {
  for (let k = 0; k < n; k++) {
    const wx = x + Math.floor(hash(k, s, 41) * 6) - 3, h = 2 + Math.floor(hash(k, s, 42) * 4);
    for (let j = 0; j < h; j++) P.px(wx + (j > h - 2 && hash(k, j, s) > 0.5 ? 1 : 0), y - j, j === h - 1 ? 0x8ab44a : 0x4a7a2a);
    if (hash(k, s, 43) > 0.6) P.px(wx + 1, y - h + 1, 0x6a9a3a);
  }
}

// ======================= väggytor =======================
// betongelement: paneler med mörka fogar, ton per panel, ballastkorn, smuts
function panels(P, x, y, w, h, col, s, o = {}) {
  const pw = o.pw || 28, ph = o.ph || 18;
  area(P, x, y, w, h, (X, Y, i, j) => {
    const px = i % pw, py = j % ph, pc = Math.floor(i / pw), pr = Math.floor(j / ph), pan = hash(pc, pr, s);
    if (px === pw - 1 || py === ph - 1) return jit(mul(col, 0.6), X, Y, s + 1, 0.1);
    let c = mix(col, pan > 0.5 ? 0xe4e0d4 : 0x86827a, Math.abs(pan - 0.5) * 0.4);
    if (px === 0) c = mix(c, WHITE, 0.14); else if (py === 0) c = mix(c, WHITE, 0.1);
    if (px === pw - 2 || py === ph - 2) c = mul(c, 0.88);
    const n = hash(X, Y, s + 2);
    if (n > 0.965) c = mul(c, 0.76); else if (n < 0.03) c = mix(c, WHITE, 0.2);
    if (py > 0 && py < 7 && hash(pc, pr, s + 3) > 0.55 && ((i + pr) % 5 === 0)) c = mul(c, 1 - (7 - py) * 0.035); // rinn från fogen
    return jit(c, X, Y, s, 0.05);
  });
}
// tegel i förband (mörkt, sotigt)
function brickPx(X, Y, base, s, opt = {}) {
  const bw = opt.bw || 7, bh = opt.bh || 3, row = Math.floor(Y / bh), ry = Y - row * bh;
  const xx = X + (row & 1 ? bw >> 1 : 0) + 64, col = Math.floor(xx / bw), rx = xx - col * bw;
  const mortar = opt.mortar ?? mix(base, 0xb8ac9c, 0.45);
  if (ry === bh - 1 || rx === bw - 1) return jit(mortar, X, Y, s + 1, 0.08);
  const h = hash(col, row, s);
  let c = h > 0.66 ? mix(base, 0xc8764e, 0.22) : h < 0.25 ? mix(base, 0x3a1c14, 0.28) : base;
  if (hash(col, row, s + 7) > 0.9) c = mix(c, 0x2a2a2a, 0.35);
  if (ry === 0) c = mix(c, WHITE, 0.1);
  if (rx === bw - 2) c = mul(c, 0.86);
  return jit(c, X, Y, s, 0.07);
}
function bricks(P, x, y, w, h, col, s, opt) { area(P, x, y, w, h, (X, Y) => brickPx(X, Y, col, s, opt)); }
// korrugerad plåt: lodräta åsar, rost nertill och i fläckar, plåtskarvar
function corrugated(P, x, y, w, h, col, s, o = {}) {
  const per = o.per || 4, rustA = o.rust ?? 0.6;
  area(P, x, y, w, h, (X, Y, i, j) => {
    const r = i % per;
    let c = r === 0 ? mix(col, WHITE, 0.22) : r === 1 ? mix(col, WHITE, 0.06) : r === 2 ? mul(col, 0.84) : mul(col, 0.68);
    const near = j > h - 12 ? (j - (h - 12)) / 12 : 0;
    if (hash(X >> 1, Y >> 1, s) < near * rustA || hash(X >> 2, Y >> 2, s + 1) > 0.982) c = mix(c, pick([0x8a4a22, 0x6a3418, 0xa8602a], X >> 1, Y >> 1, s), 0.75);
    if (o.sheet && j % o.sheet === o.sheet - 1) c = mul(c, 0.55);
    if (o.sheet && j % o.sheet === 0) c = mix(c, WHITE, 0.15);
    return jit(c, X, Y, s + 3, 0.04);
  });
}
// puts med smuts nertill och avfallna fläckar där teglet syns
function plaster(P, x, y, w, h, col, s, o = {}) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    const n = hash(X >> 1, Y >> 1, s);
    let c = n > 0.93 ? mul(col, 0.92) : n < 0.05 ? mix(col, WHITE, 0.08) : col;
    if (j > h - 12) c = mul(c, 1 - ((j - (h - 12)) / 12) * 0.16);
    if (o.soot && j < 6) c = mul(c, 1 - (6 - j) * 0.03);
    return jit(c, X, Y, s + 1, 0.05);
  });
  for (let k = 0; k < (o.patches || 0); k++) {
    const cx = x + 8 + hash(k, s, 5) * (w - 16), cy = y + 8 + hash(k, s, 6) * (h - 16), rx = 3 + hash(k, s, 7) * 6, ry = 2 + hash(k, s, 8) * 4;
    for (let yy = Math.floor(cy - ry - 1); yy <= cy + ry + 1; yy++) for (let xx = Math.floor(cx - rx - 1); xx <= cx + rx + 1; xx++) {
      const d = Math.hypot((xx - cx) / rx, (yy - cy) / ry) + (hash(xx, yy, s + 9) - 0.5) * 0.5;
      if (d < 1) P.px(xx, yy, brickPx(xx, yy, 0x9a5a44, s + 10, { bw: 6, bh: 3 }));
      else if (d < 1.25) P.px(xx, yy, mul(col, 0.66));
    }
  }
}
// kakel (tvätteriets bottenvåning): 3×3-plattor med fog, några saknas
function tilesWall(P, x, y, w, h, col, s) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    const tx = i % 4, ty = j % 4, c4 = Math.floor(i / 4), r4 = Math.floor(j / 4);
    if (hash(c4, r4, s) > 0.955) return jit(0x8a8680, X, Y, s + 2, 0.1); // saknad platta: bruket
    if (tx === 3 || ty === 3) return 0x9aa4a8;
    let c = mix(col, hash(c4, r4, s + 1) > 0.5 ? WHITE : 0x6a8a9a, 0.12);
    if (tx === 0 || ty === 0) c = mix(c, WHITE, 0.2);
    if (tx === 2 && ty === 2) c = mul(c, 0.86);
    return c;
  });
}
// platt tak: takpapp med grus, våder, pölar, mossa; sarg och plåtkrön mot gatan
function gravelRoof(P, x, y, w, h, s, o = {}) {
  const c = o.col || 0x6a6660;
  area(P, x, y, w, h, (X, Y, i, j) => {
    let k = mix(mul(c, 0.82), c, qmix(0, 1, j / Math.max(1, h), X, Y, 3) === 0 ? 0 : (j / h));
    const n = hash(X, Y, s);
    if (n > 0.9) k = mix(k, 0xd8d0c4, 0.32); else if (n < 0.08) k = mul(k, 0.74);
    if (j % 14 === 13) k = mul(k, 0.84);
    if (i === 0) k = mix(k, WHITE, 0.25); else if (i === w - 1) k = mul(k, 0.62);
    if (j === 0) k = mix(k, WHITE, 0.2);
    return k;
  });
  moss(P, x, y, w, h, s + 5, o.moss ?? 0.05);
  for (let k = 0; k < (o.puddles ?? 1); k++) {
    const px = x + 8 + Math.floor(hash(k, s, 61) * (w - 24)), py = y + 6 + Math.floor(hash(k, s, 62) * Math.max(1, h - 14));
    P.ell(px + 6, py + 2, 7, 2.5, o.night ? 0x1c2238 : 0x6a7c8a, 0.8, 3); P.hl(px + 3, py + 1, 4, WHITE, o.night ? 0.1 : 0.35);
  }
  P.hl(x, y + h - 3, w, OUT); P.hl(x, y + h - 2, w, mix(0xb8bcc4, WHITE, 0.4)); P.hl(x, y + h - 1, w, mul(0xb8bcc4, 0.7));
}
// aggregat på taket (låda uppifrån + framifrån) och ventilationsrör
function hvac(P, x, y, w, d, hg, o = {}) {
  const c = o.col || 0xb8bcc2;
  P.darken(x + w, y + 3, 3, d + hg - 2, 0.66); P.darken(x + 2, y + d + hg, w, 2, 0.62);
  area(P, x, y, w, d, (X, Y, i, j) => mix(mix(c, WHITE, 0.3), c, qmix(0, 1, j / d, X, Y, 2)));
  area(P, x, y + d, w, hg, (X, Y, i, j) => (j % 2 ? mul(c, 0.62) : mul(c, 0.84)));
  P.box(x, y, w, d + hg, OUT); P.hl(x + 1, y + d, w - 2, mix(c, WHITE, 0.5));
  if (o.fan) { const cx = x + (w >> 1), cy = y + (d >> 1); for (let yy = -2; yy <= 2; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx / 9 + yy * yy / 4 <= 1) P.px(cx + xx, cy + yy, (xx + yy) % 2 ? 0x2a2e36 : 0x4a4e58); P.px(cx, cy, 0x9aa0aa); }
  for (let k = 0; k < (o.rust || 0); k++) streak(P, x + 2 + Math.floor(hash(k, x, 63) * (w - 4)), y + d + 1, hg - 1, 0x8a4a22, 0.6, k);
}
function ventPipe(P, x, y, hg, c = 0x9aa0a8) {
  P.darken(x + 3, y + 2, 2, hg, 0.7);
  P.rect(x, y, 3, hg, c); P.vl(x, y, hg, mix(c, WHITE, 0.4)); P.vl(x + 2, y, hg, mul(c, 0.6));
  P.rect(x - 1, y - 2, 5, 2, mul(c, 0.8)); P.hl(x - 1, y - 2, 5, mix(c, WHITE, 0.5));
}
// parabolantenn: skål med LNB-arm, fäste
function dish(P, cx, cy, o = {}) {
  const c = o.col || 0xd8d8d8, r = o.r || 3;
  P.rect(cx + 1, cy + r - 1, 2, 4, 0x4a4a50); P.hl(cx, cy + r + 3, 4, 0x3a3a40);
  for (let yy = -r; yy <= r; yy++) for (let xx = -2; xx <= 2; xx++) if (xx * xx / 4 + yy * yy / (r * r) <= 1.05) P.px(cx + xx, cy + yy, xx < 0 ? mix(c, WHITE, 0.3) : xx > 0 ? mul(c, 0.7) : c);
  P.px(cx - 3, cy, 0x3a3a40); P.px(cx - 4, cy + 1, 0x5a5a60); P.px(cx - 4, cy, 0x8a8a90);
  if (o.rust) P.px(cx + 1, cy + 1, 0x8a4a22, 0.7);
}
// tv-antenn (gammaldags) på en mast
function antenna(P, x, y, hg) {
  P.vl(x, y, hg, 0x5a5e68); P.vl(x + 1, y, hg, 0x8a8e98);
  for (let k = 0; k < 3; k++) { const yy = y + 1 + k * 3, hw = 3 + k * 2; P.hl(x - hw + 1, yy, hw * 2, 0x6a6e78); }
  P.px(x, y - 1, 0x9a9ea8);
}

// ======================= typsnitt: bitmappar, fetstil, Scale2x =======================
function glyphBits(F, ch, up) {
  const G = F[ch] || F[ch.toUpperCase()] || F['?'];
  const rws = [...G.up, ...G.rows], w = G.w, h = F.h + up, on = new Uint8Array(w * h), y0 = up - G.up.length;
  rws.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === '#') on[(y0 + j) * w + i] = 1; });
  return { w, h, on };
}
function embolden(B) {
  const w = B.w + 1, on = new Uint8Array(w * B.h);
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) if (B.on[y * B.w + x]) { on[y * w + x] = 1; on[y * w + x + 1] = 1; }
  return { w, h: B.h, on };
}
function scale2x(B) {
  const w = B.w * 2, h = B.h * 2, on = new Uint8Array(w * h);
  const g = (x, y) => (x < 0 || y < 0 || x >= B.w || y >= B.h ? 0 : B.on[y * B.w + x]);
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
    const P0 = g(x, y), A = g(x, y - 1), Bb = g(x + 1, y), C = g(x - 1, y), D = g(x, y + 1);
    on[2 * y * w + 2 * x] = C === A && C !== D && A !== Bb ? A : P0;
    on[2 * y * w + 2 * x + 1] = A === Bb && A !== C && Bb !== D ? Bb : P0;
    on[(2 * y + 1) * w + 2 * x] = D === C && D !== Bb && C !== A ? C : P0;
    on[(2 * y + 1) * w + 2 * x + 1] = Bb === D && Bb !== A && D !== C ? D : P0;
  }
  return { w, h, on };
}
function bits(F, s, { x2 = false, bold = false, gap = 1 } = {}) {
  const chars = [...String(s).toUpperCase()];
  const up = Math.max(0, ...chars.map((ch) => (F[ch] || F['?']).up.length));
  let gl = chars.map((ch) => glyphBits(F, ch, up));
  if (bold) gl = gl.map(embolden);
  if (x2) gl = gl.map(scale2x);
  const h = gl.length ? gl[0].h : 1;
  const w = Math.max(1, gl.reduce((a, g) => a + g.w, 0) + gap * (gl.length - 1));
  const on = new Uint8Array(w * h), cols = [];
  let cx = 0;
  for (const g of gl) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.on[y * g.w + x]) on[y * w + cx + x] = 1;
    cols.push([cx, cx + g.w]);
    cx += g.w + gap;
  }
  return { w, h, up: up * (x2 ? 2 : 1), on, cols };
}
// ritar en bitmapp: y = versalhöjdens överkant (accenter hamnar ovanför)
function sign(P, B, x, y, o) {
  const top = y - B.up, at = (i, j) => i >= 0 && j >= 0 && i < B.w && j < B.h && B.on[j * B.w + i] === 1;
  if (o.shadow !== undefined) for (let j = 0; j < B.h; j++) for (let i = 0; i < B.w; i++) if (at(i, j)) P.px(x + i + (o.sx ?? 1), top + j + (o.sy ?? 1), o.shadow, o.sa ?? 1);
  if (o.outline !== undefined) for (let j = -1; j <= B.h; j++) for (let i = -1; i <= B.w; i++) {
    if (at(i, j)) continue;
    const n4 = at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1);
    const n8 = o.o8 && (at(i - 1, j - 1) || at(i + 1, j - 1) || at(i - 1, j + 1) || at(i + 1, j + 1));
    if (n4 || n8) P.px(x + i, top + j, o.outline, o.oa ?? 1);
  }
  for (let j = 0; j < B.h; j++) for (let i = 0; i < B.w; i++) if (at(i, j)) {
    let c = typeof o.fill === 'function' ? o.fill(i, j, x + i, top + j) : o.fill;
    if (c === null) continue;
    if (o.hi !== undefined && !at(i, j - 1)) c = o.hi;
    else if (o.lo !== undefined && !at(i, j + 1)) c = o.lo;
    P.px(x + i, top + j, c, o.a ?? 1);
  }
}
// ljusgloria runt en bitmapp (för 'lighter'), kvantiserad och dithrad
function haloOf(B, c, r = 4, amax = 0.5) {
  const pad = r + 1, w = B.w + pad * 2, h = B.h + pad * 2, P = new Pix(w, h);
  const on = (i, j) => i >= 0 && j >= 0 && i < B.w && j < B.h && B.on[j * B.w + i] === 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let d = 99;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (on(x - pad + dx, y - pad + dy)) { const dd = Math.hypot(dx, dy); if (dd < d) d = dd; }
    if (d > r) continue;
    const q = Math.floor((1 - d / (r + 0.6)) * 4 + bayer(x, y)) / 4;
    if (q > 0) P.px(x, y, c, q * amax);
  }
  return { img: P.flush(), pad };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ======================= skyltar, lappar, klotter =======================
// skyltlåda: färgad platta med ljus överkant, mörk underkant, kant och skugga
function plate(P, x, y, w, h, bg, o = {}) {
  area(P, x, y, w, h, (X, Y, i, j) => jit(j === 0 ? mix(bg, WHITE, 0.3) : j === h - 1 ? mul(bg, 0.6) : i === 0 ? mix(bg, WHITE, 0.15) : bg, X, Y, 4, o.jit ?? 0.04));
  P.box(x - 1, y - 1, w + 2, h + 2, o.border ?? OUT); P.hl(x, y + h + 1, w, 0x000000, 0.3);
  if (o.rust) for (let k = 0; k < o.rust; k++) streak(P, x + 2 + Math.floor(hash(k, x, 71) * (w - 4)), y + h + 1, 3 + Math.floor(hash(k, y, 72) * 5), 0x7a4a22, 0.6, k);
  if (o.fade) for (let i = 0; i < w; i++) if (hash(i, y, 73) > 0.8) P.vl(x + i, y + 1, h - 2, WHITE, 0.12);
}
// text med skugga och ljus överkant (tonad fyllning)
function signText(P, F, s, x, y, c, o = {}) {
  const B = bits(F, s, { bold: o.bold, x2: o.x2, gap: o.gap ?? 1 });
  sign(P, B, x, y, { shadow: o.shadow, sx: 1, sy: 1, fill: c, hi: o.hi ?? mix(c, WHITE, 0.4), lo: o.lo ?? mul(c, 0.8), outline: o.outline });
  return B;
}
// handskriven text: tecken för tecken med darr i höjdled
function scrawl(P, F, s, x, y, c, s0 = 0, a = 1) {
  let cx = x;
  for (const ch of String(s)) { const dy = hash(cx, s0, 2) > 0.72 ? 1 : hash(cx, s0, 3) > 0.85 ? -1 : 0; text(P, F, ch, cx, y + dy, c, a); cx += textW(F, ch) + 1; }
  return cx - x - 1;
}
// lapp/kartongskylt med tejp i hörnen och handskriven text
function note(P, x, y, lines, o = {}) {
  const F = o.big ? BIG : SMALL, pad = o.pad ?? 2, w = Math.max(...lines.map((l) => textW(F, l))) + pad * 2 + 1, h = lines.length * (F.h + 1) + pad * 2;
  const paper = o.paper ?? 0xf4eedc;
  area(P, x, y, w, h, (X, Y, i, j) => jit(paper, X, Y, 9, 0.05));
  P.hl(x, y + h - 1, w, mul(paper, 0.75)); P.vl(x + w - 1, y, h, mul(paper, 0.8)); P.hl(x, y + h, w, 0x000000, 0.3); P.vl(x + w, y + 1, h, 0x000000, 0.2);
  if (o.tape !== false) { P.rect(x - 1, y - 1, 4, 2, 0xe8e0b8, 0.85); P.rect(x + w - 3, y - 1, 4, 2, 0xe8e0b8, 0.85); }
  if (o.pin) { P.px(x + (w >> 1), y - 1, 0xd8303a); P.px(x + (w >> 1), y, 0x8a1a20); }
  lines.forEach((l, k) => scrawl(P, F, l, x + pad + (o.center ? ((w - pad * 2 - textW(F, l)) >> 1) : 0), y + pad + k * (F.h + 1), o.ink ?? 0x2a2a44, (o.seed ?? 0) + k));
  if (o.underline !== undefined) P.line(x + pad, y + pad + F.h + 1, x + w - pad - 1, y + pad + F.h + 2, o.underline, 0.8);
  return [x, y, w, h];
}
const SPRAY = [0xe8443a, 0x3a9bff, 0x6fdc4c, 0xffd23f, 0xff5dc8, 0xf4f1ea, 0x9a5cff, 0xff8a2a, 0x2ad0c8];
const TAGS = ['ZOK', 'KRAM', 'BTG', 'PIX', 'SNUT', 'LOL', 'KAOS', 'YO', 'VILD', 'MIX', '4EVER', 'ÅKE', 'HEJ', 'NEJ', 'BUS', 'RÖK'];
// piece: stora bubbelbokstäver med kontur, tvåtonsfyllning, glans och droppar (ev. "moln" bakom)
function piece(P, x, y, word, o = {}) {
  const B = bits(BIG, word, { x2: o.x2 ?? true, bold: true, gap: 2 });
  const c1 = o.c1 ?? 0xffd23f, c2 = o.c2 ?? 0xff8a2a, out = o.outline ?? 0x1a1a22;
  if (o.cloud) { const cc = o.cloud; for (let j = -3; j < B.h + 3; j++) for (let i = -4; i < B.w + 4; i++) { const t = Math.hypot((i - B.w / 2) / (B.w / 2 + 4), (j - B.h / 2) / (B.h / 2 + 3)); if (t < 1 && bayer(x + i, y + j) < 1.15 - t) P.px(x + i, y - B.up + j, cc, 0.85); } }
  sign(P, B, x, y, { outline: out, o8: true, fill: (i, j) => (j < B.h * 0.45 ? c1 : c2), hi: mix(c1, WHITE, 0.55), lo: mul(c2, 0.8) });
  const bot = y - B.up + B.h;
  for (let k = 0; k < (o.drips ?? 4); k++) { const dx = x + 2 + Math.floor(hash(k, x, y) * (B.w - 4)), len = 2 + Math.floor(hash(k, y, x) * 5); P.vl(dx, bot, len, c2, 0.85); P.px(dx, bot + len, mul(c2, 0.8)); }
  if (o.sign) { const t = bits(SMALL, o.sign); sign(P, t, x + B.w - t.w, bot + 1, { fill: out, a: 0.9 }); }
  return B;
}
// tagg: snabb, enfärgad, lite sned med understreck och en droppe
function tag(P, x, y, word, c, s = 0) {
  const w = scrawl(P, SMALL, word, x, y, c, s, 0.92);
  P.vl(x + 2 + Math.floor(hash(s, 3, 4) * Math.max(1, w - 3)), y + 5, 2 + Math.floor(hash(s, 5, 6) * 3), c, 0.7);
  if (hash(s, 7, 8) > 0.4) P.line(x, y + 6, x + w - 1, y + 7, c, 0.55);
  return w;
}
// schablon
const STENCILS = {
  hjarta: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  stjarna: ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '#.....#'],
  krona: ['#..#..#', '##.#.##', '#######', '.#####.', '.#####.'],
  katt: ['#.....#', '##...##', '#######', '#.#.#.#', '#######', '.#####.', '..#.#..'],
  pil: ['...#...', '..###..', '.#####.', '...#...', '...#...', '...#...'],
};
function stencil(P, x, y, name, c, a = 0.9) { STENCILS[name].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') P.px(x + i, y + j, c, a); })); }
// klistermärken (små färgade lappar) på en dörr/ett skåp
function stickers(P, x, y, w, h, n, s) {
  for (let k = 0; k < n; k++) {
    const sx = x + Math.floor(hash(k, s, 81) * (w - 4)), sy = y + Math.floor(hash(k, s, 82) * (h - 3)), c = pick(SPRAY, k, s, 83);
    P.rect(sx, sy, 3 + (k & 1), 2 + (k % 3 === 0 ? 1 : 0), c, 0.9); P.px(sx, sy, mix(c, WHITE, 0.4));
  }
}

// ======================= fönster =======================
const CURT = [0xd8544a, 0xe8d8a8, 0x6a8ac8, 0xf0ece0, 0x8ac07a, 0xd89ac0, 0xe0b040, 0x8a6a4a];
// igenspikat: plankor på tvären, spikar, en planka snett över
function boards(P, x, y, w, h, s) {
  for (let j = 0; j < h; j++) {
    const p = Math.floor(j / 4), pj = j % 4, wood = pick([0x9a7448, 0x8a6a40, 0x7e5a36, 0xa88050], p, s, 3);
    for (let i = 0; i < w; i++) P.px(x + i, y + j, pj === 3 ? 0x2a2018 : jit(wood, x + i, y + j, s + p, 0.12));
  }
  P.line(x, y + 1, x + w - 1, y + h - 2, 0x5a3e22); P.line(x, y + 2, x + w - 1, y + h - 1, 0x8a6a40);
  for (let j = 1; j < h; j += 4) { P.px(x + 1, y + j, 0xc8c8c8); P.px(x + w - 2, y + j, 0xc8c8c8); }
}
// fönster: karm, glas (dag: himmel, natt: släckt/tänt/tv), persienn (hel/halv/trasig), gardin,
// krossat glas, igenspikat, galler, bänk. o.lit: false | 'warm' | 'warm2' | 'tv'
// o.room = { wall, paper, act, tv } → glaset visar rummet innanför (fönsterlivet, se lifeWin).
// o.layer = 'front' → bara det som ligger FRAMFÖR folket i rummet (gardiner, persienn, spröjs,
// reflexer, soffryggen …) – målas i en egen liten bild som live() lägger över figurerna.
function win(P, x, y, w, h, o, reg) {
  const fr = o.frame ?? 0xd8d4cc, night = !!o.night, lit = night ? o.lit : false, front = o.layer === 'front';
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  if (!front) { P.rect(x - 1, y - 1, w + 2, h + 2, mul(fr, 0.42)); P.rect(x, y, w, h, fr); }
  if (o.boarded) { if (front) return; boards(P, x, y, w, h, o.seed ?? x); if (o.tagOn) tag(P, x + 1, y + 2 + Math.floor(hash(x, y, 9) * (h - 8)), o.tagOn, pick(SPRAY, x, y, 10), x + y); return; }
  if (!front) {
    if (o.room) roomFill(P, gx, gy, gw, gh, o);
    else area(P, gx, gy, gw, gh, (X, Y, i, j) => {
      if (lit === 'tv') return qmix(0x8ab0ff, 0x3a58b8, j / gh, X, Y, 3);
      if (lit) return qmix(lit === 'warm2' ? 0xffd08a : 0xffeaa8, lit === 'warm2' ? 0xe08a3a : 0xf0a648, j / gh, X, Y, 3);
      if (night) return qmix(0x24304a, 0x101828, j / gh, X, Y, 3);
      return qmix(o.sky ?? 0xa8c4dc, o.deep ?? 0x3e5670, j / gh, X, Y, 4);
    });
  }
  if (o.room) roomFront(P, gx, gy, gw, gh, o);
  if (!lit) for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const d = (((i * 2 - j * 3 + (o.seed ?? 0) * 7) % 15) + 15) % 15, k = o.room ? 0.45 : 1;
    if (d < 2) P.px(gx + i, gy + j, WHITE, (night ? 0.06 : 0.28) * k); else if (d === 4) P.px(gx + i, gy + j, WHITE, (night ? 0.03 : 0.1) * k);
  }
  if (o.curtain !== undefined && o.curtain !== null && !o.blind) {
    const cc = lit ? mix(o.curtain, 0xffe0a0, 0.35) : night ? mul(o.curtain, 0.5) : o.curtain, cw = o.curtW ?? Math.max(2, Math.round(gw * 0.25));
    for (let j = 0; j < gh; j++) for (let i = 0; i < cw; i++) { P.px(gx + i, gy + j, i % 2 ? mul(cc, 0.8) : mix(cc, WHITE, 0.15)); P.px(gx + gw - 1 - i, gy + j, i % 2 ? mul(cc, 0.7) : mul(cc, 0.88)); }
    P.hl(gx, gy, gw, cc);
  }
  if (o.blind) {
    const bh = o.blind === 'half' ? Math.round(gh * 0.45) : o.blind === 'down' ? gh : Math.round(gh * 0.7);
    for (let j = 0; j < bh; j++) P.hl(gx, gy + j, gw, j % 2 ? 0xb4b0a8 : 0xe2ded6, lit ? 0.8 : 0.94);
    if (o.blind === 'broken') {
      const j0 = gy + bh - 4;
      P.hl(gx, gy + 2, gw, lit ? 0xf0a648 : night ? 0x1a2238 : 0x4e6e96, 0.8);        // en lamell saknas
      P.line(gx, j0, gx + gw - 1, j0 + 3, 0xe2ded6); P.line(gx, j0 + 2, gx + gw - 1, j0 + 5, 0xb4b0a8); // hänger snett
      P.line(gx + 1, j0 + 4, gx + gw - 2, j0 + 6, 0xe2ded6, 0.8);
    }
    P.vl(gx + gw - 2, gy, Math.min(gh, bh + 3), 0xe8e4dc, 0.8); // snöret
  }
  if (o.plant && !lit) { const px = gx + 1; P.rect(px, gy + gh - 3, 3, 3, 0xb0603a); P.rect(px - 1, gy + gh - 6, 5, 3, 0x3a7a34); P.px(px + 1, gy + gh - 7, 0x5a9a44); }
  if (o.dirt) { for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const d = Math.min(i, gw - 1 - i, gh - 1 - j); if (d < 3 && hash(gx + i, gy + j, 11) < (3 - d) * 0.3 * o.dirt) P.px(gx + i, gy + j, 0x3a3428, 0.4); } }
  if (w >= 10 && !o.single) P.vl(x + (w >> 1), gy, gh, fr);
  if (h >= 14 && o.transom !== false) P.hl(gx, y + Math.round(h * (o.transom ?? 0.33)), gw, fr);
  if (o.broken) {
    const cx = gx + 2 + Math.floor(hash(x, y, 5) * Math.max(1, gw - 4)), cy = gy + 2 + Math.floor(hash(x, y, 6) * Math.max(1, gh - 4));
    for (let k = 0; k < 6; k++) { const an = k * 1.05 + hash(k, x, 7), len = 2 + hash(k, y, 8) * 4; P.line(cx, cy, cx + Math.round(Math.cos(an) * len), cy + Math.round(Math.sin(an) * len), 0xe8f0f8, 0.75); }
    P.rect(cx - 1, cy - 1, 3, 2, 0x08080c); P.px(cx + 1, cy, 0x08080c); P.px(cx - 1, cy + 1, 0x08080c);
  }
  if (o.bars) { for (let i = gx + 2; i < gx + gw; i += 4) P.vl(i, gy - 1, gh + 2, 0x2a2a30); P.hl(gx, gy + (gh >> 1), gw, 0x2a2a30); }
  P.hl(x, y, w, mix(fr, WHITE, 0.4)); P.vl(x + w - 1, y + 1, h - 1, mul(fr, 0.7));
  if (front) return;
  if (o.sill !== false) { const sc = o.sillCol ?? 0xc8c4bc; P.hl(x - 1, y + h + 1, w + 2, mix(sc, WHITE, 0.3)); P.hl(x - 1, y + h + 2, w + 2, mul(sc, 0.6)); P.hl(x, y + h + 3, w, 0x000000, 0.22); reg?.ledges.push([x - 1, y + h + 1, w + 2]); }
  if (lit && reg) (lit === 'tv' ? reg.tv : reg.win).push([gx, gy, gw, gh]);
}

// ======================= fönsterliv: rummen och folket bakom glaset =======================
// Ett "levande" fönster målar rummet innanför (tapet, taklampa, tavla, kök/tv/dator) i
// husbilden och en liten framför-bild (gardiner, spröjs, reflexer, soffrygg). live()
// ritar figurerna i glasrutan mellan de två: folk som går förbi, lagar mat, tittar på tv,
// dansar, läser, vinkar, en katt i fönstret – dag som natt (tända rum, skuggor på persienner).
const WALLPAPER = [0xe8d8b0, 0xc8d8c0, 0xd8c0c8, 0xb8c8d8, 0xf0e8d8, 0xd8c8a0, 0xa8b8a0, 0xe0c0a0];
const ACTS_DAY = ['walk', 'walk', 'cook', 'read', 'wave', 'cat', 'walk', 'dance', 'cook', 'tv'];
const ACTS_NIGHT = ['walk', 'tv', 'tv', 'cook', 'dance', 'read', 'game', 'walk', 'cat', 'tv', 'walk'];
function roomFill(P, gx, gy, gw, gh, o) {
  const R = o.room, lit = o.night ? o.lit : false, wall = R.wall;
  area(P, gx, gy, gw, gh, (X, Y, i, j) => {
    let c = wall;
    if (R.paper === 1 && i % 3 === 0) c = mul(c, 0.9);
    else if (R.paper === 2 && (i + j * 2) % 5 === 0) c = mix(c, WHITE, 0.2);
    else if (R.paper === 3 && j % 4 === 0) c = mul(c, 0.92);
    if (R.act === 'cook' && j > gh * 0.45) c = (i % 3 === 2 || j % 3 === 0) ? 0xa8b0b0 : 0xe8ecec; // kakel
    const t = j / Math.max(1, gh - 1);
    if (lit === 'tv') return qmix(mix(c, 0x6a8ae8, 0.6), mix(mul(c, 0.6), 0x2a3a8a, 0.6), t, X, Y, 3);
    if (lit) return qmix(mix(c, lit === 'warm2' ? 0xffc070 : 0xfff0c0, 0.4), mix(mul(c, 0.8), 0xe0903a, 0.3), t, X, Y, 3);
    if (o.night) return qmix(mul(c, 0.28), mul(c, 0.16), t, X, Y, 3);
    return qmix(mul(mix(c, 0x5a6a80, 0.14), 0.5), mul(mix(c, 0x3a4a60, 0.22), 0.34), t, X, Y, 3);
  });
  const dim = lit ? 1 : o.night ? 0.3 : 0.5;
  // taklampa
  const lx = gx + (gw >> 1) + (R.lampX || 0);
  P.px(lx, gy, 0x2a2a30); P.hl(lx - 1, gy + 1, 3, lit ? 0xfff6d8 : mul(0xc8b890, dim)); P.px(lx, gy + 2, lit ? 0xffe8a0 : mul(0xa89870, dim));
  // tavla eller hylla på bakväggen
  if (R.pic && gw >= 9) { const px = gx + 1 + ((R.pic * 3) % Math.max(1, gw - 6)); P.rect(px, gy + 3, 4, 3, mul(0x6a4a2a, dim)); P.rect(px + 1, gy + 4, 2, 1, mul(pick([0x3a7bd5, 0xe8443a, 0x6fdc4c, 0xffd23f], R.pic, 1, 3), dim)); }
  if (R.act === 'cook') { const hx = R.side > 0 ? gx : gx + gw - 5; P.rect(hx, gy + 2, 5, 2, mul(0xb8bcc4, dim)); P.hl(hx + 1, gy + 4, 3, mul(0x8a8e98, dim)); }
  if (R.tv) { const [tx, ty, tw, th] = R.tv; P.rect(tx - 1, ty - 1, tw + 2, th + 2, 0x1a1a20); P.rect(tx, ty, tw, th, lit ? 0x8ab0ff : 0x2a3040); P.hl(tx, ty + th + 1, tw, mul(0x6a5a4a, dim)); }
  if (R.act === 'dance') { P.px(gx + (gw >> 1) + 2, gy + 2, lit ? 0xf0f0ff : mul(0xc8c8d0, dim)); P.px(gx + (gw >> 1) + 2, gy + 1, 0x3a3a40); }
  if (R.act === 'read') { const fx = R.side > 0 ? gx + gw - 2 : gx + 1; P.vl(fx, gy + 4, gh - 4, mul(0x3a3a40, dim)); P.rect(fx - 1, gy + 3, 3, 2, lit ? 0xfff0b0 : mul(0xd8c890, dim)); }
}
// det som står framför figurerna i ett levande fönster
function roomFront(P, gx, gy, gw, gh, o) {
  const R = o.room, lit = o.night ? o.lit : false, dim = lit ? 1 : o.night ? 0.3 : 0.5;
  if (R.act === 'tv') { const c = mul(R.sofa, dim); for (let j = 0; j < 3; j++) P.hl(gx, gy + gh - 3 + j, gw, j === 0 ? mix(c, WHITE, 0.2) : j === 2 ? mul(c, 0.7) : c); P.px(gx + 1, gy + gh - 4, mul(c, 0.9)); P.px(gx + gw - 2, gy + gh - 4, mul(c, 0.9)); }
  if (R.act === 'game') { const cx = gx + (gw >> 1) - 2; P.rect(cx, gy + gh - 3, 5, 3, mul(0x2a2a34, dim + 0.2)); P.hl(cx, gy + gh - 3, 5, mul(0x5a5a6a, dim + 0.2)); }
  if (R.act === 'cook') { P.hl(gx, gy + gh - 2, gw, mul(0xd8d4cc, dim)); P.hl(gx, gy + gh - 1, gw, mul(0x8a8680, dim)); const px = R.side > 0 ? gx + 1 : gx + gw - 4; P.rect(px, gy + gh - 4, 3, 2, mul(0x4a4a52, dim)); P.hl(px, gy + gh - 4, 3, mul(0x8a8a92, dim)); }
}
// levande fönster: målas som vanligt (med rummet) + framför-bild + registrering för live()
function lifeWin(C, x, y, w, h, o) {
  const s = (o.seed ?? 0) * 13 + x * 7 + y * 31 + C.s;
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2, night = C.night;
  let act = o.act || pick(night ? ACTS_NIGHT : ACTS_DAY, x, y, s + 3);
  let lit = night ? (o.lit || 'warm') : false;
  if (night && lit === 'tv' && act !== 'game') act = 'tv';
  if (night && act === 'tv') lit = 'tv';
  if (night && act === 'game') lit = 'tv';
  const shadow = night && !o.act && act === 'walk' && hash(x, y, s + 9) < 0.35;   // skuggspel på nerdragen persienn
  const side = hash(x, y, s + 4) > 0.5 ? 1 : -1;
  const tv = (act === 'tv' || act === 'game') && gw >= 7 ? [gx + ((gw - 5) >> 1) + (act === 'game' ? 0 : side), gy + Math.max(2, (gh >> 1) - 3), 5, act === 'game' ? 4 : 3] : null;
  const room = { wall: pick(WALLPAPER, x, y, s), paper: Math.floor(hash(x, y, s + 5) * 4), act, tv, side, pic: hash(x, y, s + 6) > 0.35 ? 1 + Math.floor(hash(x, y, s + 7) * 5) : 0, sofa: pick([0x8a3a3a, 0x3a5a8a, 0x5a7a3a, 0x7a5a3a, 0x6a4a7a], x, y, s + 8), lampX: act === 'dance' ? -2 : 0 };
  const oo = { ...o, lit, room, blind: shadow ? 'down' : null, broken: false, boarded: false, plant: false, curtain: shadow ? null : o.curtain, curtW: gw >= 16 ? 2 : 1, single: o.single ?? gw < 20, transom: o.transom ?? false };
  win(C.P, x, y, w, h, oo, C.reg);
  const F = new Pix(w + 2, h + 2, x - 1, y - 1);
  win(F, x, y, w, h, { ...oo, layer: 'front' }, null);
  C.reg.anim.push({ x: gx, y: gy, w: gw, h: gh, act, tv, side, n: Math.floor(hash(s, 1, 11) * 997), n2: Math.floor(hash(s, 2, 11) * 997),
    per: 7 + hash(s, 3, 11) * 8, ph: hash(s, 4, 11), front: F.flush(), fx: x - 1, fy: y - 1, mode: shadow ? 'shadow' : night ? 'warm' : 'day', hours: o.hours || null });
}

// ======================= balkonger och grejerna på dem =======================
const CLOTH = [0xf0ece4, 0x3a7bd5, 0xe8443a, 0xffd23f, 0x6fdc4c, 0xff5dc8, 0x2a2a3a, 0xf0c8a0, 0x8a5cff];
// tvättlina med kläder: linan från (x0,y) till (x1,y), hänger lite på mitten
function laundry(P, x0, x1, y, s) {
  for (let x = x0; x <= x1; x++) P.px(x, y + (Math.abs(x - (x0 + x1) / 2) < (x1 - x0) / 4 ? 1 : 0), 0x3a3a40, 0.8);
  let x = x0 + 1 + Math.floor(hash(s, 1, 91) * 3), k = 0;
  while (x < x1 - 3) {
    const kind = Math.floor(hash(k, s, 92) * 5), c = pick(CLOTH, k, s, 93), yy = y + 1 + (Math.abs(x - (x0 + x1) / 2) < (x1 - x0) / 4 ? 1 : 0);
    let w = 3;
    if (kind === 0) { w = 4; P.rect(x, yy, 4, 5, c); P.px(x - 1, yy + 1, c); P.px(x + 4, yy + 1, c); P.hl(x, yy + 4, 4, mul(c, 0.8)); } // tröja
    else if (kind === 1) { w = 4; P.rect(x, yy, 4, 3, c); P.rect(x, yy + 3, 1, 4, c); P.rect(x + 3, yy + 3, 1, 4, c); P.px(x + 3, yy + 6, mul(c, 0.8)); } // byxor
    else if (kind === 2) { w = 2; P.rect(x, yy, 2, 3, c); P.px(x + 1, yy + 3, c); } // strumpa
    else if (kind === 3) { w = 5; for (let j = 0; j < 6; j++) P.hl(x, yy + j, 5, j % 2 ? mix(c, WHITE, 0.3) : c); } // handduk
    else { w = 6; P.rect(x, yy, 6, 6, mix(c, WHITE, 0.5)); P.vl(x + 5, yy, 6, mul(mix(c, WHITE, 0.5), 0.85)); } // lakan
    P.px(x, yy - 1, 0xe8d8a8); P.px(x + w - 1, yy - 1, 0xe8d8a8); // klädnypor
    x += w + 1 + Math.floor(hash(k, s, 94) * 3); k++;
  }
}
function bike(P, x, y, s) { // liten cykel sedd från sidan, y = hjulens underkant
  const c = pick([0xd8303a, 0x3a7bd5, 0x2a2a30, 0x6fdc4c], s, 1, 95);
  for (const wx of [x + 2, x + 10]) { P.box(wx - 2, y - 5, 5, 5, 0x3a3a40); P.px(wx, y - 3, 0x8a8a90); }
  P.line(x + 2, y - 3, x + 6, y - 7, c); P.line(x + 6, y - 7, x + 10, y - 3, c); P.line(x + 2, y - 3, x + 10, y - 3, c);
  P.line(x + 5, y - 7, x + 4, y - 9, c); P.hl(x + 2, y - 9, 4, 0x2a2a30); P.vl(x + 9, y - 9, 2, 0x8a8a90); P.hl(x + 8, y - 10, 3, 0x2a2a30);
}
function boxes(P, x, y, s) { // kartonger i hög, y = underkanten
  const n = 2 + Math.floor(hash(s, 2, 96) * 2);
  for (let k = 0; k < n; k++) { const bw = 7 - k, bx = x + k, by = y - 4 * (k + 1); P.rect(bx, by, bw, 4, 0xa07a4a); P.hl(bx, by, bw, 0xc89a62); P.vl(bx + bw - 1, by, 4, 0x7a5a34); P.hl(bx + 1, by + 2, bw - 2, 0x8a6a3a); }
}
function chair(P, x, y) { // plaststol, y = underkanten
  P.rect(x, y - 7, 5, 3, 0xf0ece4); P.hl(x, y - 7, 5, WHITE); P.rect(x, y - 4, 6, 1, 0xe8e4dc); P.vl(x, y - 3, 3, 0xd8d4cc); P.vl(x + 5, y - 3, 3, 0xc8c4bc);
}
function pots(P, x, y, w, s) { // krukor med döda växter, y = krukans underkant
  for (let px = x; px < x + w - 3; px += 5) { if (hash(px, s, 97) > 0.5) continue; P.rect(px, y - 3, 4, 3, 0xb0603a); P.hl(px, y - 3, 4, 0xd08050); P.vl(px + 1, y - 6, 3, 0x8a7a4a); P.px(px + 2, y - 5, 0x6a5a3a); P.px(px + 3, y - 7, 0xa89a6a); }
}
function flag(P, x, y, s) { // flagga på pinne (blå-gul eller klubbfärger)
  P.vl(x, y, 12, 0x8a8a90); const c1 = hash(s, 1, 98) > 0.5 ? 0x2a5ac8 : 0x2a8a3a, c2 = hash(s, 1, 98) > 0.5 ? 0xffd23f : 0xf0f0f0;
  for (let j = 0; j < 5; j++) P.hl(x + 1, y + 1 + j, 7 - (j === 0 || j === 4 ? 1 : 0), j === 2 ? c2 : c1); P.vl(x + 3, y + 1, 5, c2);
}
function grill(P, x, y) { P.ell(x + 3, y - 5, 3.5, 2, 0x2a2a30, 1, 2); P.hl(x + 1, y - 6, 5, 0x5a5a60); P.vl(x + 1, y - 3, 3, 0x3a3a40); P.vl(x + 5, y - 3, 3, 0x3a3a40); }
function stuff(P, x, y, w, kind, s, night) { // y = balkongfrontens överkant; grejerna står bakom fronten och sticker upp
  if (kind === 'tvatt') laundry(P, x, x + w - 1, y - 7, s);
  else if (kind === 'parabol') dish(P, x + w - 4, y - 3, { rust: hash(s, 4, 99) > 0.5 });
  else if (kind === 'cykel') bike(P, x + 1, y + 3, s);
  else if (kind === 'lador') boxes(P, x + 1, y + 3, s);
  else if (kind === 'stol') chair(P, x + w - 8, y + 3);
  else if (kind === 'blommor') pots(P, x + 1, y + 1, w - 2, s);
  else if (kind === 'flagga') flag(P, x + w - 9, y - 11, s);
  else if (kind === 'grill') grill(P, x + 2, y + 3);
}
const STUFF = ['tvatt', 'parabol', 'cykel', 'lador', 'stol', 'blommor', 'tvatt', 'flagga', 'grill', 'inget', 'parabol', 'tvatt'];
// balkong: y = plattans överkant (dörrens underkant), x/w = plattans bredd. front: { kind: 'plat'|'betong'|'galler', col }
function balcony(P, x, y, w, o, reg) {
  const fh = o.fh ?? 7, fc = o.front?.col ?? 0x8a8e96, kind = o.front?.kind ?? 'plat';
  if (o.stuff && o.stuff !== 'inget') stuff(P, x + 2, y - fh, w - 4, o.stuff, o.seed, o.night);
  if (kind === 'galler') { for (let i = x; i < x + w; i += 2) P.vl(i, y - fh, fh, 0x3a3a44); P.hl(x, y - fh - 1, w, 0x8a8a96); P.hl(x, y - fh, w, 0x5a5a66); }
  else {
    area(P, x, y - fh, w, fh, (X, Y, i, j) => {
      let c = kind === 'betong' ? jit(fc, X, Y, o.seed, 0.06) : i % 3 === 0 ? mix(fc, WHITE, 0.18) : i % 3 === 2 ? mul(fc, 0.78) : fc;
      if (j === 0) c = mix(c, WHITE, 0.3); else if (j === fh - 1) c = mul(c, 0.7);
      if (i === 0) c = mix(c, WHITE, 0.15); else if (i === w - 1) c = mul(c, 0.72);
      return c;
    });
    P.hl(x, y - fh - 1, w, 0x4a4a52);
    for (let k = 0; k < 2; k++) if (hash(k, o.seed, 31) > 0.55) streak(P, x + 1 + Math.floor(hash(k, o.seed, 32) * (w - 2)), y - fh + 1, fh - 1, 0x7a4a2a, 0.5, k);
    if (o.tag) tag(P, x + 2, y - fh + 1, o.tag, pick(SPRAY, o.seed, 1, 33), o.seed);
  }
  P.hl(x - 1, y, w + 2, mix(fc, 0xd0ccc4, 0.5)); P.hl(x - 1, y + 1, w + 2, 0x6a6660); P.hl(x - 1, y + 2, w + 2, 0x000000, 0.35); P.hl(x, y + 3, w, 0x000000, 0.18);
  reg?.ledges.push([x - 1, y - fh - 1, w + 2]);
  for (const k of [0, 1]) if (hash(k, o.seed, 34) > 0.5) streak(P, x + 2 + Math.floor(hash(k, o.seed, 35) * (w - 4)), y + 2, 3 + Math.floor(hash(k, o.seed, 36) * 6), 0x5a4a3a, 0.45, k);
}
// våningar med fönster och balkonger. o: { top, floorH, floors, cols: [{ x, w, kind: 'win'|'bal' }],
//   front, frame, seed, skip(f, col, k), loggia, life, lifeDay, balk }
// Tända fönster registreras i reg.win/reg.tv, levande fönster i reg.anim, folk på balkongen i reg.balk.
function apartments(C, o) {
  const P = C.P, reg = C.reg, night = C.night;
  for (let f = 0; f < o.floors; f++) {
    const fy = o.top + f * o.floorH, low = f === o.floors - 1;
    o.cols.forEach((col, k) => {
      if (o.skip?.(f, col, k)) return;
      const s = o.seed + f * 17 + k * 3, r = hash(f, k, s);
      const lit = night ? (r < 0.62 ? (hash(f, k, s + 1) < 0.16 ? 'tv' : hash(f, k, s + 2) < 0.4 ? 'warm2' : 'warm') : false) : false;
      const blind = hash(f, k, s + 4) > 0.55 ? (hash(f, k, s + 5) > 0.6 ? 'broken' : hash(f, k, s + 5) > 0.3 ? 'half' : 'down') : null;
      const alive = night ? !!lit && hash(f, k, s + 20) < (o.life ?? 0.5) : hash(f, k, s + 20) < (o.lifeDay ?? 0.3);
      if (col.kind === 'bal') {
        const dh = o.floorH - 5, dy = fy + 1, ww = col.w - 11;
        if (o.loggia) { // indragen balkong: mörk nisch med sidoväggar
          area(P, col.x - 3, fy, col.w + 6, o.floorH - 1, (X, Y, i, j) => jit(mul(o.loggia, j < 2 ? 0.55 : 0.72), X, Y, s, 0.06));
          P.vl(col.x - 3, fy, o.floorH - 1, mul(o.loggia, 0.45)); P.vl(col.x + col.w + 2, fy, o.floorH - 1, mix(o.loggia, WHITE, 0.1));
        }
        win(P, col.x, dy, 8, dh, { night, lit, frame: o.frame, single: true, transom: 0.35, sill: false, curtain: pick(CURT, f, k, s + 3), blind: blind === 'down' ? 'half' : blind, seed: s }, reg);
        const wo = { night, lit: lit && hash(f, k, s + 8) > 0.3 ? lit : false, frame: o.frame, single: ww < 10, transom: false, sill: false, curtain: pick(CURT, f, k, s + 3), blind, seed: s + 1 };
        if (alive && ww >= 8 && (wo.lit || !night)) lifeWin(C, col.x + 11, dy, ww, dh - 5, wo); else win(P, col.x + 11, dy, ww, dh - 5, wo, reg);
        const sk = pick(STUFF, f, k, s + 6);
        balcony(P, col.x - 3, dy + dh, col.w + 6, { front: col.front || o.front, stuff: sk, seed: s, night, tag: low && hash(f, k, s + 12) > 0.4 ? pick(TAGS, f, k, s + 13) : null }, reg);
        // någon står ute på balkongen (kaffe på dagen, mobilskenet på kvällen)
        if (['inget', 'stol', 'blommor', 'lador', 'grill'].includes(sk) && hash(f, k, s + 30) < (o.balk ?? 0.34)) {
          const fh = 7;
          reg.balk.push({ x: col.x - 2, y: dy - 1, w: col.w + 4, h: dh - fh + 1, n: Math.floor(hash(f, k, s + 31) * 997), ph: hash(f, k, s + 32), per: 10 + hash(f, k, s + 33) * 8,
            px: col.x + 1 + Math.floor(hash(f, k, s + 34) * Math.max(1, col.w - 10)), kind: night ? 'mobil' : pick(['kaffe', 'titta', 'kaffe', 'vinka'], f, k, s + 35) });
        }
      } else {
        const wh = o.floorH - 7, wy = fy + 2;
        const boarded = hash(f, k, s + 8) > 0.965, broken = !boarded && hash(f, k, s + 7) > 0.93;
        const wo = { night, lit: boarded ? false : lit, frame: o.frame, curtain: hash(f, k, s + 9) > 0.4 ? pick(CURT, f, k, s + 3) : null, blind, broken, boarded, seed: s, dirt: 0.5, plant: hash(f, k, s + 14) > 0.85, tagOn: hash(f, k, s + 15) > 0.5 ? pick(TAGS, f, k, s + 16) : null };
        if (alive && !boarded && !broken && (wo.lit || !night)) lifeWin(C, col.x, wy, col.w, wh, wo); else win(P, col.x, wy, col.w, wh, wo, reg);
        if (hash(f, k, s + 10) > 0.8) dish(P, col.x + col.w + 3, wy + 3, { rust: hash(f, k, s + 17) > 0.5 });
        if (hash(f, k, s + 11) > 0.55) streak(P, col.x + 1 + Math.floor(hash(f, k, s + 18) * (col.w - 2)), wy + wh + 4, 3 + Math.floor(hash(f, k, s + 19) * 8), 0x6a4a2a, 0.5, s);
      }
    });
  }
}

// ======================= mark-overlay (oljefläckar, skräp – ritas i live() under fasaden) =======================
function oilStain(G, cx, cy, rx, ry, s) {
  G.ell(cx, cy, rx, ry, 0x14121a, 0.55, 3);
  for (let k = 0; k < 6; k++) { const x = cx + Math.round((hash(k, s, 51) - 0.5) * rx * 1.4), y = cy + Math.round((hash(k, s, 52) - 0.5) * ry * 1.4); G.px(x, y, pick([0x5a3a7a, 0x3a6a5a, 0x6a5a2a], k, s, 53), 0.5); }
  G.hl(cx - 2, cy - 1, 3, WHITE, 0.12);
}
function litter(G, x, y, w, n, s) {
  for (let k = 0; k < n; k++) {
    const lx = x + Math.floor(hash(k, s, 54) * w), ly = y + Math.floor(hash(k, s, 55) * 20), t = Math.floor(hash(k, s, 56) * 4);
    if (t === 0) { G.rect(lx, ly, 3, 2, 0xe8e4dc); G.px(lx + 1, ly, 0xd8303a); } // pappersbit
    else if (t === 1) { G.rect(lx, ly, 2, 3, 0xd8d0c0); G.px(lx, ly, 0xf0f0f0); } // burk
    else if (t === 2) { G.px(lx, ly, 0x4a3a2a); G.px(lx + 1, ly, 0x3a2a1a); } // fimp
    else { G.rect(lx, ly, 4, 3, 0xd8a840, 0.9); G.hl(lx, ly, 4, 0xf0c860); } // pizzakartong
  }
}

// ======================= dörrar =======================
// Svängdörr: förmålade bildrutor där bladet vrids inåt. Rullport: duken rullas upp
// (den nedre kanten stiger, rullen sitter i kåpan i fasaden). Igenspikad: rör sig inte.
function swingFrames(S, w, h, hinge, edgeC, N = 6) {
  const frames = [], pws = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.32, sn = Math.sin(th);
    const pw = Math.max(2, Math.round(w * Math.cos(th))), lift = Math.round(sn * 5), shade = 1 - 0.38 * sn;
    const F = new Pix(w, h);
    for (let c = 0; c < pw; c++) {
      const sc = Math.min(w - 1, Math.floor((c * w) / pw));
      const srcX = hinge === 'l' ? sc : w - 1 - sc, dstX = hinge === 'l' ? c : w - 1 - c;
      const off = Math.round((c / Math.max(1, pw - 1)) * lift);
      for (let y = 0; y < h - off; y++) {
        const i = ((y + off) * w + srcX) * 4, a = S.d[i + 3];
        if (!a) continue;
        F.px(dstX, y, mul((S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2], shade), a / 255);
      }
    }
    if (k > 0) { const ex = hinge === 'l' ? pw : w - 1 - pw; if (ex >= 0 && ex < w) for (let y = 0; y < h - lift; y++) F.px(ex, y, y === 0 ? mul(edgeC, 0.6) : edgeC); }
    frames.push(F.flush()); pws.push(pw);
  }
  return { frames, pws };
}
// mörk interiör med golv i perspektiv och ett ljus i taket
function interiorBase(I, w, h, o) {
  area(I, 0, 0, w, h - 8, (X, Y, i, j) => qmix(o.wall0, o.wall1, j / (h - 8), X, Y, 3));
  for (let y = h - 8; y < h; y++) for (let x = 0; x < w; x++) { const t = ((x + ((y - (h - 8)) >> 1)) >> 2) + (y >> 1); I.px(x, y, mix(t % 2 ? o.floor : mul(o.floor, 0.88), WHITE, (y - (h - 8)) / 24)); }
  I.hl(0, h - 8, w, mul(o.wall1, 0.7));
  if (o.lamp !== false) { I.hl((w >> 1) - 2, 1, 5, o.lampCol ?? 0xfff4d0); I.px(w >> 1, 0, 0x3a3a40); }
}
// glasad entrédörr (höghusen): aluminiumram, glas, "PORT"-dekal, sparkplåt
function glassLeaf(S, w, h, o = {}) {
  const fr = o.frame ?? 0x8a929c;
  S.rect(0, 0, w, h, fr); S.box(0, 0, w, h, OUT); S.vl(1, 1, h - 2, mix(fr, WHITE, 0.4)); S.vl(w - 2, 1, h - 2, mul(fr, 0.6));
  area(S, 2, 2, w - 4, h - 12, (X, Y, i, j) => { const d = ((i * 2 - j * 3) % 13 + 13) % 13; let c = o.night ? qmix(0xffe0a0, 0xc88a40, j / (h - 12), X, Y, 3) : qmix(0xa8c4dc, 0x3e5670, j / (h - 12), X, Y, 3); if (d < 2) c = mix(c, WHITE, o.night ? 0.1 : 0.3); return c; });
  S.vl(w >> 1, 2, h - 12, fr); S.hl(2, h - 10, w - 4, fr);
  area(S, 2, h - 9, w - 4, 7, (X, Y, i, j) => (j === 0 ? mix(fr, WHITE, 0.3) : jit(mul(fr, 0.9), X, Y, 3, 0.05))); // sparkplåt
  if (o.label) text(S, SMALL, o.label, ((w - textW(SMALL, o.label)) >> 1), 5, 0xf0f0f0, 0.85);
  S.rect(w - 5, (h >> 1) - 1, 2, 5, 0x3a3a40); S.px(w - 5, h >> 1, 0xc8c8d0);
  if (o.crackGlass) { S.line(3, 4, 7, 12, 0xe8f0f8, 0.8); S.line(7, 12, 5, 18, 0xe8f0f8, 0.6); S.line(7, 12, 11, 15, 0xe8f0f8, 0.6); }
  if (o.stickers) stickers(S, 3, 4, w - 6, h - 16, o.stickers, w * 7);
  if (o.note) note(S, 3, o.noteY ?? 6, o.note, { seed: w, tape: true, paper: o.notePaper });
}
// trädörr/ståldörr (pantbank, husvagn): panel med speglar, litet fönster, handtag
function solidLeaf(S, w, h, col, o = {}) {
  area(S, 0, 0, w, h, (X, Y, i, j) => jit(col, X, Y, 6, 0.06));
  S.box(0, 0, w, h, OUT); S.vl(1, 1, h - 2, mix(col, WHITE, 0.25)); S.vl(w - 2, 1, h - 2, mul(col, 0.6)); S.hl(1, h - 1, w - 2, mul(col, 0.5));
  if (o.window) { const [wx, wy, ww, wh] = o.window; S.rect(wx - 1, wy - 1, ww + 2, wh + 2, mul(col, 0.5)); area(S, wx, wy, ww, wh, (X, Y, i, j) => (o.night ? qmix(0xffe0a0, 0xc88a40, j / wh, X, Y, 3) : qmix(0xa8c4dc, 0x3e5670, j / wh, X, Y, 3))); if (o.grille) for (let i = wx + 1; i < wx + ww; i += 2) S.vl(i, wy, wh, 0x2a2a30); }
  else { S.box(2, 3, w - 4, (h >> 1) - 4, mul(col, 0.7)); S.box(2, (h >> 1) + 1, w - 4, h - (h >> 1) - 4, mul(col, 0.7)); }
  S.px(w - 4, (h >> 1) + 1, o.handle ?? 0xe8d070); S.px(w - 4, (h >> 1) + 2, mul(o.handle ?? 0xe8d070, 0.7));
  if (o.mailslot) { S.rect(3, (h >> 1) + 4, w - 6, 2, 0x3a3a40); S.hl(3, (h >> 1) + 4, w - 6, 0x8a8a90); }
  if (o.dents) for (let k = 0; k < o.dents; k++) { const dx = 2 + Math.floor(hash(k, w, 61) * (w - 6)), dy = 4 + Math.floor(hash(k, h, 62) * (h - 10)); S.px(dx, dy, mul(col, 0.6)); S.px(dx + 1, dy, mix(col, WHITE, 0.2)); S.px(dx, dy + 1, mul(col, 0.7)); }
  if (o.stickers) stickers(S, 3, 3, w - 6, h - 8, o.stickers, w * 3);
}
// rullport: vågräta lameller, bucklor, tagg, handtag nertill
function rollLeaf(S, w, h, col, o = {}) {
  for (let j = 0; j < h; j++) { const r = j % 4; area(S, 0, j, w, 1, (X, Y, i) => { let c = r === 0 ? mix(col, WHITE, 0.2) : r === 3 ? mul(col, 0.62) : r === 2 ? mul(col, 0.86) : col; if (i === 0) c = mix(c, WHITE, 0.2); if (i === w - 1) c = mul(c, 0.7); return jit(c, X, Y, 7, 0.05); }); }
  for (let k = 0; k < (o.dents ?? 2); k++) { const dx = 3 + Math.floor(hash(k, w, 63) * (w - 10)), dy = 4 + Math.floor(hash(k, h, 64) * (h - 12)); S.rect(dx, dy, 4, 2, mul(col, 0.55)); S.hl(dx, dy + 2, 4, mix(col, WHITE, 0.25)); S.px(dx + 4, dy + 1, mul(col, 0.7)); }
  for (let k = 0; k < (o.rust ?? 3); k++) { const rx = 1 + Math.floor(hash(k, w, 65) * (w - 3)); streak(S, rx, h - 8 + Math.floor(hash(k, h, 66) * 4), 4 + Math.floor(hash(k, w, 67) * 4), 0x8a4a22, 0.7, k); }
  S.rect((w >> 1) - 4, h - 3, 8, 2, 0x2a2a30); S.hl((w >> 1) - 4, h - 3, 8, 0x6a6a70);
  if (o.tag) tag(S, 3, 4 + Math.floor(hash(w, h, 68) * (h - 14)), o.tag, o.tagCol ?? pick(SPRAY, w, h, 69), w + h);
  if (o.piece) { const B = bits(BIG, o.piece.word, { bold: true }); const px = (w - B.w) >> 1; sign(S, B, px, o.piece.y, { outline: 0x1a1a22, o8: true, fill: (i, j) => (j < B.h * 0.45 ? o.piece.c1 : o.piece.c2), hi: mix(o.piece.c1, WHITE, 0.5) }); for (let k = 0; k < 3; k++) S.vl(px + 2 + Math.floor(hash(k, 1, 70) * (B.w - 4)), o.piece.y + B.h, 2 + k, o.piece.c2, 0.8); if (o.piece.sub) { const t = bits(SMALL, o.piece.sub); sign(S, t, (w - t.w) >> 1, o.piece.y + B.h + 6, { outline: 0x1a1a22, fill: o.piece.c1 }); } }
  if (o.note) note(S, 3, h - 16, o.note, { seed: 5 });
}
const DOOR_ART = {
  hoghus: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xd8d4c8, wall1: 0xa8a49a, floor: 0x8a8a84 }); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { I.rect(2 + c * 4, 6 + r * 4, 3, 3, 0x9a9ea8); I.hl(2 + c * 4, 6 + r * 4, 3, 0xc8ccd4); } I.rect(w - 8, 8, 6, 12, 0x3a5a3a); I.hl(w - 8, 8, 6, 0x5a7a5a); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, label: 'PORT 1', stickers: 3, crackGlass: true }), edge: 0x8a929c, hinge: 'l' },
  hoghus2: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xc8c4b8, wall1: 0x8a8678, floor: 0x7a7a74, lampCol: 0xd8e0ff }); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { I.rect(2 + c * 4, 5 + r * 4, 3, 3, 0x8a8e98); I.hl(2 + c * 4, 5 + r * 4, 3, 0xb8bcc4); } I.rect(w - 6, 10, 3, 4, 0xd8303a); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, label: 'PORT 5', stickers: 5 }), edge: 0x8a929c, hinge: 'r' },
  lamell: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xe8e0c8, wall1: 0xb8b09a, floor: 0x9a8a6a }); for (let s = 0; s < 5; s++) { I.rect(w - 4 - s * 3, h - 10 - s * 3, 8, 3, 0xb8a888); I.hl(w - 4 - s * 3, h - 10 - s * 3, 8, 0xd8c8a8); } I.rect(2, 8, 6, 8, 0x8a9aa8); I.px(4, 10, 0xf0f0f0); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, label: 'PORT B', stickers: 2 }), edge: 0x8a929c, hinge: 'l' },
  narbutik: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xf0ece0, wall1: 0xc8c4b8, floor: 0xb8b0a0, lampCol: 0xe8f0ff }); for (let r = 0; r < 3; r++) { I.hl(1, 7 + r * 5, w - 2, 0x8a8a90); for (let x = 2; x < w - 2; x += 2) I.rect(x, 4 + r * 5, 1, 3, pick(SPRAY, x, r, 1)); } I.rect(w - 6, 12, 5, 10, 0x2a3a5a); I.rect(w - 5, 13, 3, 8, 0x6ab0f0); }, leaf: (S, w, h, n) => { glassLeaf(S, w, h, { night: n, label: 'DRAG', frame: 0x5a5a60 }); stickers(S, 3, 11, w - 12, h - 23, 7, w * 7); }, edge: 0x6a6a70, hinge: 'l' }, // klistermärkena under DRAG, till vänster om handtaget
  pantbank: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0x6a5a48, wall1: 0x3a3028, floor: 0x5a4a3a, lampCol: 0xffe8b0 }); I.rect(2, 14, w - 4, 4, 0x8a6a40); I.hl(2, 14, w - 4, 0xc8a870); I.rect(3, 6, w - 6, 8, 0x9ab0c0, 0.5); I.px(w >> 1, 10, 0xffd23f); }, leaf: (S, w, h, n) => solidLeaf(S, w, h, 0x2a2a30, { night: n, window: [3, 4, w - 6, 9], grille: true, handle: 0xd8c060, mailslot: true, stickers: 1 }), edge: 0x4a4a50, hinge: 'r' },
  kebab: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xf0d8b0, wall1: 0xc8a878, floor: 0xa89070, lampCol: 0xffe0a0 }); I.rect(2, 12, w - 4, 6, 0xd8303a); I.hl(2, 12, w - 4, 0xf05a5a); I.rect(w - 7, 3, 5, 9, 0x3a2a1a); I.rect(w - 6, 4, 3, 7, 0x9a5a34); I.px(w - 5, 6, 0xc8804a); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, note: ['ÖPPET', 'IGEN!'], noteY: 4, notePaper: 0xf8f0c0, frame: 0x5a3a2a, stickers: 2 }), edge: 0x6a4a3a, hinge: 'l' },
  maskerad: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0x3a2448, wall1: 0x1e1228, floor: 0x2a1e30, lampCol: 0xffb060 }); I.rect(2, 12, w - 4, 3, 0xe8762a); I.rect(3, 4, 5, 8, 0xf4f1ea); I.px(4, 6, 0x1c1820); I.px(6, 6, 0x1c1820); I.rect(w - 9, 9, 6, 5, 0xe0701c); I.px(w - 7, 11, 0xffd23f); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, note: ['ÖPPET', 'BU!'], noteY: 4, notePaper: 0xffd8a0, frame: 0x2e1838, stickers: 1 }), edge: 0x4a2a5a, hinge: 'l' },
  bilverkstad: { h: 44, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0x4a4e58, wall1: 0x22242c, floor: 0x3a3c44, lampCol: 0xfff0c0 }); I.rect(4, 18, w - 8, 10, 0x1a1c24); I.rect(6, 14, w - 12, 5, 0x2a3a5a); I.hl(7, 14, w - 14, 0x3a5a8a); I.rect(3, 28, 5, 3, 0x1a1a1e); I.rect(w - 8, 28, 5, 3, 0x1a1a1e); I.vl(2, 8, 24, 0x8a8a90); I.vl(w - 3, 8, 24, 0x8a8a90); I.rect((w >> 1) - 2, 4, 5, 2, 0xfff8e0); for (let k = 0; k < 6; k++) I.px(2 + k * 2, 6 + (k % 3), pick([0xd8303a, 0x3a7bd5, 0xffd23f], k, 1, 2)); }, leaf: (S, w, h) => rollLeaf(S, w, h, 0x9aa4ae, { tag: 'YO', dents: 3 }), roll: true },
  tvatteri: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xe8f0f4, wall1: 0xb8c8d0, floor: 0xa8b0b8, lampCol: 0xe8f4ff }); for (let x = 2; x < w - 6; x += 7) { I.rect(x, 8, 6, 12, 0xf0f0ee); I.box(x + 1, 11, 4, 4, 0x3a5a7a); I.rect(x + 2, 12, 2, 2, 0x1a2a3a); I.hl(x + 1, 9, 4, 0x8a8a90); } }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, label: 'ÖPPET', stickers: 2, frame: 0x6a8aa0 }), edge: 0x7a8a98, hinge: 'l' },
  garage: { h: 34, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0x3a3a3e, wall1: 0x1a1a1e, floor: 0x2e2e32, lamp: false }); I.rect(4, 16, w - 8, 12, 0x6a2a2a); I.hl(5, 16, w - 10, 0x8a3a3a); I.rect(6, 12, w - 12, 5, 0x2a3a4a); I.rect(2, 4, 7, 10, 0x4a4a4e); for (let k = 0; k < 4; k++) I.hl(3, 5 + k * 2, 5, pick([0xd8303a, 0x3a7bd5, 0xffd23f, 0x6fdc4c], k, 2, 3)); }, leaf: (S, w, h) => rollLeaf(S, w, h, 0x7a8a98, { tag: 'BTG', dents: 2, tagCol: 0xffd23f }), roll: true },
  lagerhall: { h: 48, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0x2a2e30, wall1: 0x141618, floor: 0x26282a, lamp: false }); for (let x = 3; x < w - 8; x += 12) for (let r = 0; r < 3; r++) { I.rect(x, 6 + r * 11, 10, 2, 0x5a4a30); I.rect(x + 1, 8 + r * 11, 8, 6, pick([0x8a6a3a, 0x6a6a70, 0x4a5a6a], x, r, 4), 0.8); } I.rect(w - 9, 24, 7, 8, 0x9a8a2a); I.rect(w - 8, 26, 5, 4, 0x2a2a30); }, leaf: (S, w, h) => rollLeaf(S, w, h, 0x6a7a68, { dents: 3, rust: 5, piece: { word: 'PIXEL', y: 8, c1: 0x6fdc4c, c2: 0x2aa3a0, sub: '4 EVER' } }), roll: true },
  husvagn: { h: 22, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xf0e8d0, wall1: 0xc8b898, floor: 0x8a6a4a }); I.rect(1, 9, 5, 5, 0xd8d4c8); I.px(2, 10, 0x2a2a30); I.rect(w - 5, 8, 4, 6, 0xc86a3a); }, leaf: (S, w, h, n) => solidLeaf(S, w, h, 0xd8d0c0, { night: n, window: [2, 3, w - 4, 7], handle: 0x8a8a90, dents: 2, stickers: 1 }), edge: 0xb8b0a0, hinge: 'l' },
};
const DK = new Map();
function doorKit(b, night) {
  const key = b.id + ':' + !!night;
  let K = DK.get(key);
  if (K) return K;
  const w = b.door.x1 - b.door.x0, spec = DOOR_ART[b.kind], h = spec.h;
  const I = new Pix(w, h); spec.interior(I, w, h);
  K = { w, h, interior: I.flush(), type: spec.roll ? 'roll' : spec.boarded ? 'boarded' : 'swing', hinge: spec.hinge || 'l' };
  const S = new Pix(w, h); spec.leaf(S, w, h, !!night);
  if (K.type === 'swing') Object.assign(K, swingFrames(S, w, h, K.hinge, spec.edge || 0x6a6a6a));
  else K.leaf = S.flush();
  // ljuset som spiller ut på trottoaren när dörren är öppen (för 'lighter')
  const sw = w + 28, sh = 24, sp = new Pix(sw, sh);
  for (let y = 0; y < sh; y++) { const half = w / 2 + 1 + y * 0.5; for (let x = 0; x < sw; x++) { const dx = Math.abs(x + 0.5 - sw / 2); if (dx >= half) continue; const a = (1 - y / sh) * (1 - (dx / half) ** 2), q = Math.floor(a * 4 + bayer(x, y)) / 4; if (q > 0) sp.px(x, y, spec.light || 0xffd890, q * 0.42); } }
  K.spill = sp.flush();
  DK.set(key, K);
  return K;
}
function drawDoorAt(ctx, K, x, y, f) {
  f = clamp(f || 0, 0, 1);
  if (K.type === 'boarded') { ctx.drawImage(K.leaf, x, y); return; }
  ctx.drawImage(K.interior, x, y);
  if (K.type === 'roll') { const up = Math.round(f * (K.h - 4)), vis = K.h - up; if (vis > 0) ctx.drawImage(K.leaf, 0, up, K.w, vis, x, y, K.w, vis); return; }
  ctx.drawImage(K.frames[Math.round(f * (K.frames.length - 1))], x, y);
}
function doorGap(K, f) {
  if (K.type === 'roll') return [0, K.w, Math.round(f * (K.h - 4))];
  const pw = K.pws[Math.round(f * (K.frames.length - 1))];
  return K.hinge === 'l' ? [pw + 1, K.w, 0] : [0, K.w - pw - 1, 0];
}
function doorGlow(ctx, b, st, k) {
  const f = clamp(st.doorOpen || 0, 0, 1), K = doorKit(b, true);
  if (f < 0.03 || K.type === 'boarded') return;
  const [g0, g1, top] = doorGap(K, f), base = baseOf(b), dy = base - K.h;
  ctx.globalCompositeOperation = 'lighter';
  if (g1 > g0 && K.h - top > 0) { ctx.globalAlpha = k * 0.5; ctx.drawImage(K.interior, g0, top, g1 - g0, K.h - top, b.door.x0 + g0, dy + top, g1 - g0, K.h - top); }
  ctx.globalAlpha = k * f;
  ctx.drawImage(K.spill, b.door.x0 - 14, base);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ======================= små figurer (folket i fönstren) =======================
// 9 px breda, 15 höga (huvud + överkropp – resten skyms av fönsterbänken).
// H hår · S hud · s hudskugga · E öga · T tröja · t tröjskugga · A arm · P byxor · B/b bok/tyg · K katt · Y kattöga
const POSES = {
  front: ['...HHH...', '..HHHHH..', '..HSSSH..', '..SESES..', '..SSSSS..', '...sSs...', '....s....', '.tTTTTTt.', 'ATTTTTTTA', 'ATTTTTTTA', 'AtTTTTTtA', 'ATTTTTTTA', 'S.TTTTT.S', '..PPPPP..', '..PP.PP..'],
  walkA: ['...HHH...', '..HHHHH..', '..HHSSS..', '..HSSSE..', '..HSSSSS.', '...SSSs..', '....s....', '...TTTT..', '..TTTTTA.', '..ATTTTA.', '..ATTTT.S', '..STTTT..', '...TTTT..', '...PPPP..', '..PP..PP.'],
  walkB: ['...HHH...', '..HHHHH..', '..HHSSS..', '..HSSSE..', '..HSSSSS.', '...SSSs..', '....s....', '...TTTT..', '..TTTTT..', '..TATTT..', '..TATTT..', '..TSTTT..', '...TTTT..', '...PPPP..', '...PPP...'],
  back: ['...HHH...', '..HHHHH..', '..HHHHH..', '..HHHHH..', '..sHHHs..', '...HHH...', '....s....', '.tTTTTTt.', 'ATTTTTTTA', 'ATTTTTTTA', 'AtTTTTTtA', 'ATTTTTTTA', 'S.TTTTT.S', '..PPPPP..', '..PP.PP..'],
  up: ['...HHH...', 'S.HHHHH.S', 'A.HSSSH.A', 'A.SESES.A', 'A.SSSSS.A', '.A.sSs.A.', '.A..s..A.', '.tTTTTTt.', '..TTTTT..', '..TTTTT..', '..tTTTt..', '..TTTTT..', '..TTTTT..', '..PPPPP..', '..PP.PP..'],
  wave: ['...HHH..S', '..HHHHH.A', '..HSSSH.A', '..SESES.A', '..SSSSSA.', '...sSs.A.', '....s.A..', '.tTTTTTt.', 'ATTTTTTT.', 'ATTTTTTT.', 'AtTTTTTt.', 'ATTTTTTT.', 'S.TTTTT..', '..PPPPP..', '..PP.PP..'],
  stirA: ['...HHH...', '..HHHHH..', '..HHSSS..', '..HSSSE..', '..HSSSSS.', '...SSSs..', '....s....', '...TTTT..', '..TTTTTAA', '..ATTTT.S', '..ATTTT..', '..STTTT..', '...TTTT..', '...PPPP..', '...PP.P..'],
  stirB: ['...HHH...', '..HHHHH..', '..HHSSS..', '..HSSSE..', '..HSSSSS.', '...SSSs..', '....s...S', '...TTTTA.', '..TTTTTA.', '..ATTTT..', '..ATTTT..', '..STTTT..', '...TTTT..', '...PPPP..', '...PP.P..'],
  book: ['...HHH...', '..HHHHH..', '..HSSSH..', '..SESES..', '..SSSSS..', '...sSs...', '....s....', '.tTTTTTt.', 'ATTTTTTTA', 'ATTTTTTTA', '.SBBBBBS.', '..BbBbB..', '..TTTTT..', '..PPPPP..', '..PP.PP..'],
  fold: ['...HHH...', '..HHHHH..', '..HSSSH..', '..SESES..', '..SSSSS..', '...sSs...', '....s....', '.tTTTTTt.', 'ATTTTTTTA', 'SbbbbbbbS', '.bbbbbbb.', '.bbbbbbb.', '..TTTTT..', '..PPPPP..', '..PP.PP..'],
  fold2: ['...HHH...', '..HHHHH..', '..HSSSH..', '..SESES..', '..SSSSS..', '...sSs...', '....s....', '.tTTTTTt.', '.ATTTTTA.', '..SbbbS..', '..bbbbb..', '..TTTTT..', '..TTTTT..', '..PPPPP..', '..PP.PP..'],
  catA: ['.........', '.........', '.........', '.........', '.........', '.........', '.K...K...', '.KK.KK...', '.KKKKK...', '.KYKYK...', '..KKK...K', '.KKKKK..K', '.KKKKKKK.', '.........', '.........'],
  catB: ['.........', '.........', '.........', '.........', '.........', '.........', '.K...K...', '.KK.KK...', '.KKKKK...', '.KYKYK...', '..KKK....', '.KKKKK...', '.KKKKKKKK', '.........', '.........'],
};
const SKINS = [0xf2d0b0, 0xe8b894, 0xd89a6c, 0xb07448, 0x8a5634, 0x5e3a24, 0xf0c8a8];
const HAIRS = [0x2a1a14, 0x4a2e1c, 0x7a4a24, 0xc89a50, 0xe8dcc0, 0xa8401e, 0x1a1a22, 0x9a9aa4, 0x3a2a4a];
const TOPS = [0xe8443a, 0x3a7bd5, 0x6fdc4c, 0xffd23f, 0xff5dc8, 0xf0ece4, 0x2a2a3a, 0x9a5cff, 0xff8a2a, 0x2ad0c8, 0x8a6a4a, 0x5a8a5a, 0xc8c8d0];
const LEGS = [0x2a3450, 0x3a3a44, 0x5a4a3a, 0x2a2a30, 0x4a5a7a];
const CATS = [0x2a2a2e, 0xd8883a, 0x8a8a90, 0xf0ece4, 0x5a4a3a];
const SPR = new Map();
function sprite(n, pose, flip, mode) {
  const key = n + ':' + pose + ':' + (flip ? 1 : 0) + ':' + mode;
  let c = SPR.get(key);
  if (c) return c;
  const rows = POSES[pose], w = 9, h = rows.length, P = new Pix(w, h);
  const skin = SKINS[n % SKINS.length], hair = HAIRS[(n >> 2) % HAIRS.length], top = TOPS[(n >> 4) % TOPS.length], leg = LEGS[(n >> 3) % LEGS.length], cat = CATS[n % CATS.length];
  const map = { H: hair, S: skin, s: mul(skin, 0.8), E: 0x2a1a1a, T: top, t: mul(top, 0.76), A: mul(top, 0.9), P: leg, B: 0xd8303a, b: 0xf4f0e6, K: cat, Y: 0xc8e040 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][flip ? w - 1 - i : i];
    if (ch === '.') continue;
    let k = map[ch];
    if (mode === 'day') k = mix(mul(k, 0.92), 0x3a4a60, 0.06);        // inne är det lite mörkare, och glaset blånar
    else if (mode === 'warm') k = mix(mul(k, 0.82), 0xc87a3a, 0.16);   // lampljus bakifrån: figuren blir mörkare än väggen
    else if (mode === 'sil') k = ch === 'H' ? 0x1a120e : ch === 'Y' ? 0xc8e040 : 0x2a1c16; // motljus ute på balkongen
    else if (mode === 'shadow') k = 0x4a2e1c;                           // skugga på persiennen
    P.px(i, j, k);
  }
  c = P.flush();
  SPR.set(key, c);
  return c;
}
// ritar en bild beskuren till en ruta (rx, ry, rw, rh) – ingen clip() behövs
function blit(ctx, img, x, y, rx, ry, rw, rh) {
  x = Math.round(x); y = Math.round(y);
  const sx0 = Math.max(0, rx - x), sy0 = Math.max(0, ry - y), sx1 = Math.min(img.width, rx + rw - x), sy1 = Math.min(img.height, ry + rh - y);
  if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, x + sx0, y + sy0, sx1 - sx0, sy1 - sy0);
}
const TVCOL = ['#8ab0ff', '#b8d8ff', '#6a88e8', '#f0f4ff', '#9ad0a8', '#e8c8a0', '#7aa0f8'];
const GAMECOL = ['#ff5dc8', '#2ad0c8', '#6fdc4c', '#ffd23f', '#9a5cff', '#e8443a'];
const walkPose = (t, n) => ((Math.floor(t * 5 + n) & 1) ? 'walkA' : 'walkB');
// en figur (eller katt) i ett levande fönster. a = registreringen från lifeWin
function lifeDraw(ctx, a, t) {
  const { x, y, w, h } = a, mode = a.mode, top = y + Math.max(0, h - 11);
  const put = (n, pose, flip, px, py, m = mode) => blit(ctx, sprite(n, pose, flip, m), px, py, x, y, w, h);
  if (mode === 'shadow') { ctx.drawImage(a.front, a.fx, a.fy); ctx.globalAlpha = 0.5; }
  const v = t / a.per + a.ph, cyc = Math.floor(v), u = v - cyc;
  const mid = x + ((w - 9) >> 1);
  // gå genom rummet: in från ena sidan, stanna och titta ut, ut på andra sidan, borta en stund
  const stroll = (pauseAct) => {
    if (u >= 0.62) return;
    const dir = (cyc + a.n) & 1 ? -1 : 1, x0 = dir > 0 ? x - 9 : x + w, x1 = dir > 0 ? x + w : x - 9;
    let px, pose;
    if (u < 0.24) { px = x0 + (mid - x0) * (u / 0.24); pose = walkPose(t, a.n); }
    else if (u < 0.38) { px = mid; pose = pauseAct ? pauseAct(u) : 'front'; }
    else { px = mid + (x1 - mid) * ((u - 0.38) / 0.24); pose = walkPose(t, a.n); }
    put(a.n, pose, dir < 0 && pose.startsWith('walk'), px, top + (pose === 'walkB' ? 1 : 0));
  };
  switch (a.act) {
    case 'walk': stroll(); break;
    case 'wave': stroll((uu) => ((Math.floor(t * 3.2) & 1) && uu > 0.26 ? 'wave' : 'front')); break;
    case 'cook': {
      const px = a.side > 0 ? x + w - 8 : x - 1;
      const turn = u > 0.78 && u < 0.88;
      put(a.n, turn ? 'front' : (Math.floor(t * 2.6 + a.n) & 1 ? 'stirA' : 'stirB'), a.side > 0 && !turn, px, top);
      // ånga ur kastrullen
      const pot = a.side > 0 ? x + 2 : x + w - 3;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.55 + i / 3 + a.ph) % 1, sy = Math.round(y + h - 5 - ph * (h - 5)), sx = Math.round(pot + Math.sin(t * 2 + i * 2.1) * 1.2);
        if (sy >= y && sx >= x && sx < x + w - 1) { ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - ph)).toFixed(3)})`; ctx.fillRect(sx, sy, ph > 0.5 ? 2 : 1, 1); }
      }
      break;
    }
    case 'tv': case 'game': {
      if (a.tv) {
        const [tx, ty, tw, th] = a.tv, pal = a.act === 'game' ? GAMECOL : TVCOL, k = Math.floor(t * (a.act === 'game' ? 5 : 1.6) + a.n);
        ctx.fillStyle = pal[k % pal.length]; ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = pal[(k + 3) % pal.length]; ctx.fillRect(tx + ((k * 2) % tw), ty + ((k >> 1) % th), 2, 1);
      }
      const hy = y + h - 7;
      if (a.act === 'game') put(a.n, 'back', false, mid + ((Math.floor(t * 4) & 1) && u < 0.5 ? 1 : 0), hy + 1);
      else {
        put(a.n, 'back', false, x - 1 + (u > 0.4 && u < 0.46 ? 1 : 0), hy);
        if (w >= 12) put(a.n2, u > 0.7 && u < 0.8 ? 'front' : 'back', false, x + w - 9, hy + 1);
      }
      break;
    }
    case 'dance': {
      const bob = Math.floor(t * 4 + a.n) & 1, sway = Math.round(Math.sin(t * 2.2 + a.n) * Math.max(1, (w - 9) >> 1));
      put(a.n, bob ? 'up' : 'front', false, mid + sway, top + (bob ? 0 : 1));
      break;
    }
    case 'read': put(a.n, 'book', false, mid + (a.side > 0 ? -1 : 1), top + 1); break;
    case 'cat': {
      const flick = hash(Math.floor(t * 1.7), a.n, 5) > 0.72;
      put(a.n, flick ? 'catB' : 'catA', a.side < 0, a.side > 0 ? x : x + w - 9, y + h - 13);
      if (u < 0.3) stroll();
      break;
    }
    // butikerna
    case 'cashier': {
      if (u < 0.5) put(a.n2, walkPose(t, a.n2), true, x + w - (u / 0.5) * (w + 9), top - 1, mode);  // en kund går mellan hyllorna
      const scan = u > 0.2 && u < 0.34;
      put(a.n, scan ? (Math.floor(t * 4) & 1 ? 'stirA' : 'stirB') : 'front', true, x + (a.cx ?? 1), top + 1);
      break;
    }
    case 'wipe': {
      const px = x + 6 + Math.round(Math.sin(t * 1.1 + a.ph * 6) * 4);
      put(a.n, Math.floor(t * 3) & 1 ? 'stirA' : 'stirB', Math.cos(t * 1.1 + a.ph * 6) < 0, px, top + 1);
      break;
    }
    case 'clerk': put(a.n, u > 0.55 && u < 0.8 ? 'book' : 'front', false, x + (a.cx ?? 2) + (u > 0.3 && u < 0.4 ? 1 : 0), top + 1); break;
    case 'fold': put(a.n, (Math.floor(t * 0.9 + a.ph * 3) & 1) ? 'fold' : 'fold2', false, x + (a.cx ?? 2), top + 1); break;
    default: break;
  }
  if (mode === 'shadow') ctx.globalAlpha = 1;
  else if (a.front) ctx.drawImage(a.front, a.fx, a.fy);
}
// någon ute på balkongen: huvud och axlar syns ovanför balkongfronten
function balkDraw(ctx, a, t, night) {
  const v = t / a.per + a.ph, u = v - Math.floor(v);
  if (u > 0.72) return; // inne en stund
  const m = night ? 'sil' : 'day';
  const look = a.kind === 'titta' ? (u < 0.25 ? 'walkA' : u < 0.5 ? 'front' : 'walkA') : a.kind === 'vinka' && u > 0.3 && u < 0.5 ? ((Math.floor(t * 3) & 1) ? 'wave' : 'front') : 'front';
  const flip = a.kind === 'titta' && u > 0.5;
  const py = a.y + a.h - 8;
  blit(ctx, sprite(a.n, look, flip, m === 'day' ? 'out' : m), a.px, py, a.x, a.y, a.w, a.h);
  if (a.kind === 'kaffe') { // ångan ur koppen
    for (let i = 0; i < 2; i++) { const ph = (t * 0.6 + i / 2) % 1; ctx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - ph)).toFixed(3)})`; ctx.fillRect(Math.round(a.px + 8 + Math.sin(t * 2 + i) * 1), Math.round(py + 5 - ph * 6), 1, 1); }
  }
}

// ======================= neon, trummor, grillspett, fåglar, fläktar =======================
// Neonskylt: rören målas släckta i husbilden; live() tänder bokstäverna (dag som natt,
// under öppettiderna) och glow() lägger glorian. En bokstav kan vara död, en kan flimra.
function neon(C, word, x, y, col, o = {}) {
  const B = bits(o.small ? SMALL : BIG, word, { x2: !!o.x2, gap: o.gap ?? (o.x2 ? 2 : 1) }), P = C.P;
  const off = mix(col, 0x9a9aa4, 0.6);
  P.rect(x - 2, y - B.up + (B.h >> 1) - 1, B.w + 4, 2, 0x2a2a30); P.hl(x - 2, y - B.up + (B.h >> 1) - 1, B.w + 4, 0x5a5a64); // skenan bakom
  sign(P, B, x, y, { shadow: 0x000000, sx: 1, sy: 2, sa: 0.3, fill: off, hi: mix(off, WHITE, 0.4), lo: mul(off, 0.75) });
  const letters = B.cols.map(([c0, c1], k) => {
    const w = c1 - c0, sub = { w, h: B.h, up: B.up, on: new Uint8Array(w * B.h) };
    for (let j = 0; j < B.h; j++) for (let i = 0; i < w; i++) sub.on[j * w + i] = B.on[j * B.w + c0 + i];
    const L = new Pix(w, B.h);
    sign(L, sub, 0, B.up, { fill: mix(col, WHITE, 0.55), hi: mix(col, WHITE, 0.85), lo: col });
    const halo = haloOf(sub, col, o.r ?? 3, 0.5);
    return { on: L.flush(), halo: halo.img, x: x + c0, y: y - B.up, hx: x + c0 - halo.pad, hy: y - B.up - halo.pad, mode: o.dead === k ? 'dead' : o.flick === k ? 'flick' : 'on', k };
  });
  C.reg.neon.push({ letters, col, rect: [x - 3, y - B.up - 2, B.w + 6, B.h + 5], open: o.open || null, seed: C.s + x });
  // transformatorlåda och kabel
  P.rect(x + B.w + 3, y - B.up + 1, 4, 5, 0x5a5a60); P.hl(x + B.w + 3, y - B.up + 1, 4, 0x8a8a90); P.vl(x + B.w + 5, y - B.up + 6, 4, 0x2a2a30);
  return B;
}
// är neonbokstaven tänd just nu?
function neonOn(L, t, seed) {
  if (L.mode === 'on') return true;
  if (L.mode === 'dead') return (Math.floor(t * 14) + seed) % 131 === 0; // ett försök att tända, ibland
  const per = 5.5, u = (t + (seed % 7)) % per;
  if (u < 1.6) return hash(Math.floor(t * 11), L.k, seed) > 0.45;        // flimmerperiod
  return hash(Math.floor(t * 3), L.k, seed + 1) > 0.04;
}
const isOpen = (open, hour) => !open || (open[1] > 24 ? (hour >= open[0] || hour < open[1] - 24) : hour >= open[0] && hour < open[1]);
// tvättmaskinstrumma: 4 bildrutor där tvätten snurrar (inkl. ring och glas)
let DRUMS = null;
function drumFrames() {
  if (DRUMS) return DRUMS;
  DRUMS = [];
  for (let f = 0; f < 4; f++) {
    const P = new Pix(9, 9), cx = 4, cy = 4;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 4.4) continue;
      if (d > 3.3) { P.px(x, y, x + y < 8 ? 0xe8ecf0 : x + y > 9 ? 0x8a9098 : 0xc0c6ce); continue; } // kromringen
      const an = Math.atan2(y - cy, x - cx) - f * (Math.PI / 2) - (d > 1.5 ? 0 : 1);
      const seg = ((Math.floor((an + Math.PI * 4) / (Math.PI / 2))) % 4 + 4) % 4;
      let c = y > cy + 1 - (f & 1) ? [0x3a7bd5, 0xe8443a, 0xf0ece4, 0xffd23f][seg] : 0x2a3a4a;  // tvätten ligger i botten och välts upp
      if (y > cy && d < 3) c = [0x3a7bd5, 0xe8443a, 0xf0ece4, 0x6fdc4c][seg];
      P.px(x, y, mix(c, 0x6a8aa8, 0.3));
    }
    P.px(2, 2, WHITE, 0.8); P.px(3, 2, WHITE, 0.4); P.px(2, 3, WHITE, 0.4);
    DRUMS.push(P.flush());
  }
  return DRUMS;
}
// grillspettet (kebabköttet) som snurrar: 4 bildrutor
let SPITS = null;
function spitFrames() {
  if (SPITS) return SPITS;
  SPITS = [];
  for (let f = 0; f < 4; f++) {
    const P = new Pix(8, 16);
    P.vl(3, 0, 16, 0x8a8a92); P.vl(4, 0, 16, 0x5a5a62);
    for (let j = 2; j < 14; j++) {
      const hw = 3 - Math.floor((j - 2) / 5);
      for (let i = -hw; i <= hw; i++) {
        const band = (j + f + (i > 0 ? 1 : 0)) % 3;
        let c = band === 0 ? 0x8a4a24 : band === 1 ? 0xb06a34 : 0xc8844a;
        if (i === -hw) c = mix(c, 0xffd8a0, 0.3); else if (i === hw) c = mul(c, 0.6);
        P.px(3 + i + (i > 0 ? 1 : 0), j, c);
      }
    }
    P.rect(1, 14, 6, 2, 0xb8bcc4); P.hl(1, 14, 6, 0xe0e4ea);
    SPITS.push(P.flush());
  }
  return SPITS;
}
// fåglar (duvor/kråkor) på takkanter: sitter, pickar, vänder sig
const BIRDS = {};
function birdImg(kind, pose, flip) {
  const key = kind + pose + flip;
  if (BIRDS[key]) return BIRDS[key];
  const rows = pose === 1 ? ['......', '.BBB..', 'BBBBBh', '.LL...'] : ['.hB...', 'hBBB..', '.BBBBB', '..LL..'];
  const col = kind === 'krake' ? 0x1a1a22 : 0x8a8e9a, P = new Pix(6, 4);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { const xx = flip ? 5 - i : i; if (ch === 'B') P.px(xx, j, j === 2 && kind !== 'krake' ? mul(col, 0.8) : col); else if (ch === 'h') P.px(xx, j, kind === 'krake' ? 0x2a2a34 : 0x5a6a7a); else if (ch === 'L') P.px(xx, j, kind === 'krake' ? 0x3a3a40 : 0xd8705a); }));
  if (kind !== 'krake') P.px(flip ? 4 : 1, pose === 1 ? 1 : 0, 0x6aa08a); // halsens gröna skimmer
  BIRDS[key] = P.flush();
  return BIRDS[key];
}
// fläkt/turbin i 3 lägen
let FANS = null;
function fanFrames() {
  if (FANS) return FANS;
  FANS = [0, 1, 2].map((f) => {
    const P = new Pix(7, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
      const dx = x - 3, dy = (y - 2) * 1.5, d = Math.hypot(dx, dy);
      if (d > 3.2) continue;
      const an = Math.atan2(dy, dx) + f * 2.094;
      P.px(x, y, (Math.floor((an + 20) / 1.047) & 1) ? 0x2a2e36 : 0x6a707c);
    }
    P.px(3, 2, 0xa8aeb8);
    return P.flush();
  });
  return FANS;
}
let TURBS = null;
function turbineFrames() { // ventilationsturbin (snurrande kula med lameller)
  if (TURBS) return TURBS;
  TURBS = [0, 1, 2].map((f) => {
    const P = new Pix(8, 9);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot((x - 3.5) / 4, (y - 3.5) / 3.6);
      if (d > 1) continue;
      const lam = (x + f) % 3;
      let c = lam === 0 ? 0xe0e4ea : lam === 1 ? 0xa8aeb8 : 0x6a707a;
      if (y < 2) c = mix(c, WHITE, 0.2); else if (y > 5) c = mul(c, 0.8);
      P.px(x, y, c);
    }
    P.rect(2, 7, 4, 2, 0x8a8e98); P.hl(2, 7, 4, 0xb8bcc4);
    return P.flush();
  });
  return TURBS;
}

// ======================= gemensam live/glow för förortens hus =======================
const META = {};
export const _META = META; // för felsökning i förhandsvisningen
export const _DBG = { sprite: (...a) => sprite(...a), lifeDraw: (...a) => lifeDraw(...a), nbTube: (t) => nbTube(t, seedOf('narbutik')) };
const metaOf = (b, night) => META[b.id + ':' + !!night] || META[b.id + ':' + !night];
function liveX(ctx, b, st) {
  const spec = DOOR_ART[b.kind];
  if (spec) { const K = doorKit(b, st.night); drawDoorAt(ctx, K, b.door.x0, baseOf(b) - K.h, st.doorOpen); }
  const m = META[b.id + ':' + !!st.night];
  if (!m) return;
  const t = st.t || 0, hour = st.hour ?? 12, w = st.env?.weather, rain = w ? w.kind === 'regn' : !!st.env?.rain, wind = w?.wind || 0;
  ctx.save();
  ctx.translate(m.ox, m.oy);
  if (m.decal) ctx.drawImage(m.decal, m.decal.dx, m.decal.dy);
  // maskiner och grillspett står längst in – folket framför dem
  if (m.drums.length) { const D = drumFrames(); for (const d of m.drums) { const run = !d.broken && !(d.hours && !isOpen(d.hours, hour)); ctx.drawImage(D[run ? Math.floor(t * (d.fast ? 9 : 5) + d.ph * 4) % 4 : (d.still || 0)], d.x, d.y); } }
  if (m.spits.length) { const S = spitFrames(); for (const s of m.spits) ctx.drawImage(S[Math.floor(t * 2.5) % 4], s.x, s.y); }
  for (const a of m.anim) if (!a.hours || isOpen(a.hours, hour)) lifeDraw(ctx, a, t);
  for (const a of m.balk) balkDraw(ctx, a, t, st.night);
  for (const f of m.fans) { const F = f.turbine ? turbineFrames() : fanFrames(); ctx.drawImage(F[Math.floor(t * (f.speed || 8) + f.ph * 3) % 3], f.x, f.y); }
  for (const N of m.neon) if (isOpen(N.open, hour)) for (const L of N.letters) if (neonOn(L, t, N.seed)) ctx.drawImage(L.on, L.x, L.y);
  if (!st.night) for (const bd of m.birds) {
    const v = t / bd.per + bd.ph, cyc = Math.floor(v), u = v - cyc;
    const hop = u > 0.9 ? (hash(cyc, bd.x, 3) > 0.5 ? 1 : -1) * Math.round((u - 0.9) * 20) : 0, peck = u > 0.3 && u < 0.4;
    ctx.drawImage(birdImg(bd.kind, peck ? 1 : 0, (cyc + (bd.x & 1)) & 1), bd.x + Math.min(2, Math.abs(hop)) * Math.sign(hop), bd.y - (u > 0.9 && u < 0.95 ? 1 : 0));
  }
  for (const s of m.smoke) {
    const n = s.n || 5, rate = s.rate || 0.25, rise = s.rise || 16, drift = (s.drift || 6) + wind * 0.3, tone = st.night ? (s.nightTone || 0x8a8ea0) : (s.tone || 0xe8e8ec);
    if (s.hours && !isOpen(s.hours, hour)) continue;
    for (let i = 0; i < n; i++) {
      const ph = (t * rate + i / n + (s.ph || 0)) % 1, sz = 2 + Math.round(ph * (s.grow || 3));
      const x = Math.round(s.x + ph * drift + Math.sin(t * 1.3 + i * 2) * 1.5), y = Math.round(s.y - ph * rise);
      ctx.fillStyle = rgba(tone, (s.alpha || 0.42) * (1 - ph)); ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz, Math.max(1, sz - 1));
    }
  }
  if (rain) for (const d of m.drips) { // regnvatten som rinner ur stuprör och trasiga hängrännor
    if (d.stream) { for (let j = 0; j < d.len; j += 1) if (((j + Math.floor(t * 30)) % 4) !== 0) { ctx.fillStyle = 'rgba(190,210,235,0.55)'; ctx.fillRect(d.x + (j % 7 === 3 ? 1 : 0), d.y + j, 1, 1); } }
    else { const ph = (t * 1.6 + d.ph) % 1; ctx.fillStyle = 'rgba(200,220,240,0.7)'; ctx.fillRect(d.x, Math.round(d.y + ph * d.len), 1, 2); }
  }
  for (const fn of m.extra) fn(ctx, t, st, m);
  ctx.restore();
}
function glowX(ctx, b, st) {
  const k = clamp((st.env?.dark ?? (st.night ? 0.5 : 0)) * 2, 0, 1);
  if (k <= 0.02) return;
  const m = META[b.id + ':' + !!st.night];
  if (!m) return;
  const t = st.t || 0, hour = st.hour ?? 12;
  ctx.save();
  ctx.translate(m.ox, m.oy);
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, w, h] of m.win) {
    ctx.fillStyle = rgba(0xffc870, 0.3 * k); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rgba(0xff9a40, 0.08 * k); ctx.fillRect(x - 2, y - 1, w + 4, h + 4);
  }
  m.tv.forEach(([x, y, w, h], i) => {
    const f = 0.12 + 0.2 * hash(Math.floor(t * 7), i, x);
    ctx.fillStyle = rgba(0x8ab0ff, f * k); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rgba(0x6a8aff, f * 0.35 * k); ctx.fillRect(x - 2, y - 1, w + 4, h + 4);
  });
  for (const a of m.anim) {
    if (a.act === 'dance') { const c = [0xff5dc8, 0x2ad0c8, 0xffd23f, 0x9a5cff][Math.floor(t * 2.5 + a.n) % 4]; ctx.fillStyle = rgba(c, 0.22 * k); ctx.fillRect(a.x, a.y, a.w, a.h); }
    else if (a.act === 'game') { ctx.fillStyle = rgba([0xff5dc8, 0x2ad0c8, 0x6fdc4c][Math.floor(t * 5 + a.n) % 3], 0.14 * k); ctx.fillRect(a.x, a.y, a.w, a.h); }
  }
  for (const a of m.balk) if (a.kind === 'mobil') { const v = t / a.per + a.ph; if (v - Math.floor(v) <= 0.72) { ctx.fillStyle = rgba(0x9ac8ff, 0.7 * k); ctx.fillRect(a.px + 6, a.y + a.h - 5, 1, 2); ctx.fillStyle = rgba(0x6aa0ff, 0.2 * k); ctx.fillRect(a.px + 3, a.y + a.h - 8, 6, 5); } }
  for (const [x, y, w, h, c, a] of m.glows) { ctx.fillStyle = rgba(c, a * k * 0.4); ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = rgba(c, a * k); ctx.fillRect(x, y, w, h); }
  for (const [img, x, y, a] of m.imgs) { ctx.globalAlpha = Math.min(1, a * k); ctx.drawImage(img, x, y); }
  ctx.globalAlpha = 1;
  for (const N of m.neon) {
    if (!isOpen(N.open, hour)) continue;
    let on = 0;
    for (const L of N.letters) if (neonOn(L, t, N.seed)) { on++; ctx.globalAlpha = k; ctx.drawImage(L.halo, L.hx, L.hy); }
    ctx.globalAlpha = 1;
    const [x, y, w, h] = N.rect, f = on / Math.max(1, N.letters.length);
    ctx.fillStyle = rgba(N.col, 0.1 * k * f); ctx.fillRect(x - 6, y - 3, w + 12, h + 16);
  }
  for (const L of m.flick) { if (L.hours && !isOpen(L.hours, hour)) continue; const on = L.mode === 'flick' ? hash(Math.floor(t * 9), L.x, L.y) > (((t + L.x) % 6) < 1.5 ? 0.5 : 0.03) : true; if (on) { ctx.fillStyle = rgba(L.c, L.a * k); ctx.fillRect(L.x, L.y, L.w, L.h); } }
  for (const L of m.leds) if (Math.floor(t * (L.rate || 1.2) + L.ph) % 2 === 0) { ctx.fillStyle = rgba(L.c, 0.95 * k + 0.05); ctx.fillRect(L.x, L.y, 1, 1); ctx.fillStyle = rgba(L.c, 0.25 * k); ctx.fillRect(L.x - 1, L.y - 1, 3, 3); }
  for (const e of m.eyes) { const v = (t + e.ph) % e.per; if (v > 0.18) { const dx = Math.round(Math.sin(t * 0.4 + e.ph) * 1); ctx.fillStyle = rgba(0xc8f040, 0.9); ctx.fillRect(e.x + dx, e.y, 1, 1); ctx.fillRect(e.x + dx + 2, e.y, 1, 1); } }
  for (const fn of m.glowFx) fn(ctx, t, st, k, m);
  ctx.restore();
  doorGlow(ctx, b, st, k);
}

// ======================= bygghjälp =======================
function begin(b, night, opts = {}) {
  const box = artBox(b), P = new Pix(box.w, box.h), BY = box.h - ART_BELOW;
  return {
    b, box, P, BY, L: O, R: O + b.w, FT: BY - b.h, W: box.w, night: !!night, snow: opts.snow ? 1 : 0, worn: opts.worn ?? 1, season: opts.season,
    s: seedOf(b.id), dx0: b.door.x0 - b.x + O, dx1: b.door.x1 - b.x + O,
    reg: { win: [], tv: [], ledges: [], anim: [], balk: [], glows: [], imgs: [], neon: [], smoke: [], birds: [], drums: [], spits: [], fans: [], drips: [], eyes: [], leds: [], flick: [], extra: [], glowFx: [], decal: null },
  };
}
function finish(C) {
  if (C.snow) for (const [x, y, w] of C.reg.ledges) snowCap(C.P, x, y, w, C.s);
  META[C.b.id + ':' + C.night] = { ...C.reg, ox: C.box.x, oy: C.box.y, BY: C.BY };
  return C.P.flush();
}
// snö på en kant (fönsterbänk, balkongfront, skyltlåda)
function snowCap(P, x, y, w, s) {
  for (let i = 0; i < w; i++) {
    P.px(x + i, y - 1, 0xf4f8fc); P.px(x + i, y, hash(x + i, y, s) > 0.5 ? 0xe4ecf4 : 0xf0f4f8);
    if (hash(x + i, y, s + 1) > 0.55) P.px(x + i, y - 2, 0xe8eef6);
    if (i > 0 && i < w - 1 && hash(x + i, y, s + 2) > 0.9) P.px(x + i, y + 1, 0xd8e2ee);
  }
}
// snötäcke på ett tak (lite grus sticker fram i kanterna)
function snowRoof(P, x, y, w, h, s) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    const n = hash(X >> 1, Y >> 1, s + 90), edge = Math.min(i, w - 1 - i, j, h - 1 - j);
    if (n < (edge < 2 ? 0.35 : 0.04)) return null;
    let c = qmix(0xf6f9fc, 0xd4dfec, j / Math.max(1, h), X, Y, 3);
    if (hash(X, Y, s + 91) > 0.94) c = WHITE; else if (hash(X, Y, s + 92) < 0.04) c = 0xc4d0de;
    return c;
  });
}
// stuprör (med trasig bit och rost), registrerar dropp i regn
function drainpipe(C, x, y0, y1, o = {}) {
  const P = C.P, c = o.col ?? 0x9aa0a8;
  for (let y = y0; y < y1; y++) {
    if (o.gap && y >= o.gap[0] && y < o.gap[1]) continue;
    const r = hash(x, y >> 2, 44) > 0.8 ? mix(c, 0x8a4a22, 0.5) : c;
    P.px(x, y, mix(r, WHITE, 0.3)); P.px(x + 1, y, r); P.px(x + 2, y, mul(r, 0.6));
  }
  for (let y = y0 + 8; y < y1 - 4; y += 16) if (!(o.gap && y >= o.gap[0] && y < o.gap[1])) { P.hl(x - 1, y, 5, 0x3a3e48); P.px(x + 3, y, 0x2a2e36); }
  if (o.gap) { P.rect(x, o.gap[0] - 1, 3, 1, 0x5a5e68); P.rect(x, o.gap[1], 3, 1, 0x5a5e68); C.reg.drips.push({ x: x + 1, y: o.gap[0], len: o.gap[1] - o.gap[0], stream: true }); }
  P.rect(x - 1, y1 - 2, 5, 2, mul(c, 0.8)); P.hl(x - 1, y1 - 2, 5, mix(c, WHITE, 0.4));
  C.reg.drips.push({ x: x + 1, y: y1, len: 3, ph: hash(x, y1, 45) });
}
// skärmtak över en port med lampa
function canopy(C, x, y, w, o = {}) {
  const P = C.P, c = o.col ?? 0xb8b4aa;
  P.darken(x + 1, y + 4, w - 1, 4, 0.66); P.darken(x + 2, y + 8, w - 3, 2, 0.84);
  area(P, x, y, w, 4, (X, Y, i, j) => jit(j === 0 ? mix(c, WHITE, 0.3) : j === 3 ? mul(c, 0.6) : c, X, Y, 12, 0.06));
  P.hl(x, y + 4, w, 0x000000, 0.3); P.box(x - 1, y - 1, w + 2, 6, OUT, 0.5);
  if (C.snow) snowCap(P, x, y, w, 3);
  const lx = x + (w >> 1) - 2;
  P.rect(lx, y + 4, 5, 2, o.broken ? 0x5a5a60 : 0xf0ecd8); P.hl(lx, y + 5, 5, o.broken ? 0x3a3a40 : 0xc8c0a0);
  if (!o.broken) { C.reg.glows.push([lx, y + 4, 5, 2, 0xfff0c0, 0.9]); C.reg.glows.push([lx - 4, y + 6, 13, 3, 0xffe0a0, 0.18]); }
  else C.reg.flick.push({ x: lx, y: y + 4, w: 5, h: 2, c: 0xf0f4ff, a: 0.8, mode: 'flick' });
}
// porttelefon/kodlås (trasigt: bucklor, sladdar)
function intercom(P, x, y, broken) {
  P.rect(x, y, 6, 11, 0x9aa0aa); P.bevel(x, y, 6, 11, 0xd8dce4, 0x4a4e58);
  for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++) P.px(x + 2 + m * 2, y + 2 + k * 2, broken && k === 1 ? 0x6a6e78 : 0x2a2e38);
  P.hl(x + 2, y + 8, 2, 0x3a3e48);
  if (broken) { P.px(x + 1, y + 4, 0x2a2e38); P.px(x + 4, y + 7, 0x4a4e58); P.line(x + 2, y + 11, x + 1, y + 15, 0xd8303a); P.line(x + 4, y + 11, x + 5, y + 14, 0x3a7bd5); P.px(x + 3, y + 11, 0xffd23f); P.px(x + 3, y + 12, 0xffd23f); }
}
// blå gatuskylt i emalj
function streetSign(P, x, y, s) {
  const w = textW(SMALL, s) + 5;
  P.rect(x, y, w, 9, 0x1f4f9a); P.box(x + 1, y + 1, w - 2, 7, 0xeef2f8); P.box(x - 1, y - 1, w + 2, 11, 0x2a2a34);
  text(P, SMALL, s, x + 3, y + 2, 0xffffff);
  P.px(x + w - 3, y + 7, 0x8a4a22, 0.8); P.px(x + 2, y + 1, 0x8a4a22, 0.6); // rost i hörnen
  return w;
}
// däckstapel (y = underkant)
function tires(P, x, y, n, s) {
  for (let k = 0; k < n; k++) {
    const ty = y - 4 * (k + 1), dx = x + Math.round((hash(k, s, 1) - 0.5) * 2);
    P.rect(dx, ty, 12, 4, 0x1e1e22); P.hl(dx + 1, ty, 10, 0x3a3a40); P.hl(dx, ty + 3, 12, 0x121216);
    for (let i = 1; i < 11; i += 2) P.px(dx + i, ty + 1, 0x2e2e34);
    P.rect(dx + 4, ty + 1, 4, 2, 0x0a0a0c); P.hl(dx + 4, ty + 1, 4, 0x4a4a50);
    if (hash(k, s, 2) > 0.6) P.px(dx + 9, ty + 2, 0xd8d8d8); // krita på däcket
  }
}
// oljefat (y = underkant)
function barrel(P, x, y, c) {
  area(P, x, y - 11, 8, 11, (X, Y, i, j) => jit(i < 2 ? mix(c, WHITE, 0.25) : i > 5 ? mul(c, 0.65) : c, X, Y, 8, 0.08));
  P.hl(x, y - 11, 8, mix(c, WHITE, 0.4)); P.hl(x, y - 8, 8, mul(c, 0.6)); P.hl(x, y - 4, 8, mul(c, 0.6));
  P.ell(x + 4, y - 11, 3.5, 1.2, 0x1a1a1e, 0.6, 2);
  streak(P, x + 2, y - 10, 6, 0x6a3418, 0.6, x); P.hl(x, y, 8, 0x000000, 0.3);
}
// lastpallar i hög (y = underkant)
function pallets(P, x, y, n) {
  for (let k = 0; k < n; k++) { const py = y - 3 * (k + 1); P.rect(x, py, 18, 1, 0xc8a870); P.hl(x, py, 18, 0xe0c890); P.rect(x + 1, py + 1, 2, 2, 0x8a6a40); P.rect(x + 8, py + 1, 2, 2, 0x8a6a40); P.rect(x + 15, py + 1, 2, 2, 0x8a6a40); P.hl(x, py + 2, 18, 0x9a7a4a, 0.6); }
}
// övervakningskamera med blinkande lysdiod
function cctv(C, x, y, flip) {
  const P = C.P, d = flip ? -1 : 1;
  P.hl(x, y + 2, 3, 0x5a5a60); P.rect(x + 2 * d - (flip ? 5 : 0), y, 6, 3, 0xd8d8dc); P.hl(x + 2 * d - (flip ? 5 : 0), y, 6, WHITE); P.hl(x + 2 * d - (flip ? 5 : 0), y + 2, 6, 0x8a8a90);
  P.px(flip ? x - 4 : x + 7, y + 1, 0x1a1a22);
  C.reg.leds.push({ x: flip ? x - 2 : x + 5, y: y + 1, c: 0xff3a2a, rate: 1.1, ph: hash(x, y, 7) });
}
// vägglampa (armatur) med ljuspöl
function wallLamp(C, x, y, o = {}) {
  const P = C.P;
  P.rect(x, y, 5, 3, 0x3a3a40); P.rect(x + 1, y + 3, 3, 2, o.broken ? 0x4a4a50 : C.night ? 0xfff0c0 : 0xd8dce0); P.px(x + 2, y - 1, 0x2a2a30);
  if (o.broken) { P.px(x + 1, y + 4, 0x8a8a90); return; }
  C.reg.glows.push([x + 1, y + 3, 3, 2, 0xfff0c0, 0.95]);
  C.reg.glows.push([x - 3, y + 5, 11, 5, 0xffe0a0, 0.14]);
}
// affisch (lite söndersliten)
function poster(P, x, y, w, h, bg, lines, s) {
  area(P, x, y, w, h, (X, Y, i, j) => { const torn = (j > h - 4 && hash(i, s, 1) > 0.55 + (h - j) * 0.1) || (i > w - 3 && hash(j, s, 2) > 0.7); return torn ? null : jit(j < 2 ? mix(bg, WHITE, 0.2) : bg, X, Y, s, 0.06); });
  lines.forEach((l, k) => text(P, SMALL, l, x + ((w - textW(SMALL, l)) >> 1), y + 2 + k * 6, k === 0 ? 0x1a1a22 : 0x3a2a2a, 0.9));
  P.px(x + 1, y + 1, 0xc8c8c8); P.px(x + w - 2, y + 1, 0xc8c8c8);
}
// vittrad sockel med stänk
function plinth(P, x, y, w, h, c, s) {
  area(P, x, y, w, h, (X, Y, i, j) => { let k = jit(j === 0 ? mix(c, WHITE, 0.25) : c, X, Y, s, 0.1); if (hash(X, Y, s + 1) > 0.9) k = mul(k, 0.8); if (j > h - 3 && hash(X, Y, s + 2) > 0.5) k = mix(k, 0x3a3226, 0.35); return k; });
  moss(P, x, y + h - 3, w, 3, s + 3, 0.12);
}
// fåglar på en takkant
function birdsOn(C, x0, x1, y, n, kind = 'duva') {
  for (let k = 0; k < n; k++) C.reg.birds.push({ x: Math.round(x0 + hash(k, C.s, 71) * (x1 - x0 - 6)), y: y - 4, kind, per: 4 + hash(k, C.s, 72) * 5, ph: hash(k, C.s, 73) });
}
// markdekal framför huset (oljefläckar, skräp) – ritas i live() på trottoaren
function decal(C, w, h, fn) { const G = new Pix(w, h); fn(G); const c = G.flush(); c.dx = C.L; c.dy = C.BY; C.reg.decal = c; }
// stort husnummer målat på väggen
function bigNumber(P, x, y, s, c) {
  const B = bits(BIG, s, { x2: true, bold: true });
  P.ell(x + (B.w >> 1), y - B.up + (B.h >> 1), (B.w >> 1) + 5, (B.h >> 1) + 4, mul(c, 0.2), 0.35, 2);
  sign(P, B, x, y, { outline: 0x1a1a22, fill: c, hi: mix(c, WHITE, 0.4), lo: mul(c, 0.75) });
  return B;
}

// ======================= HÖGHUSEN – Betongvägen 1 och 5 =======================
// Trapphusfönster på halvplanen: trådglas, kallt lysrör på natten (ett flimrar, ett är sönder)
function stairWin(C, x, y, w, h, i, o = {}) {
  const P = C.P, night = C.night, flick = !!o.flick, lit = night && !o.dark && !flick;
  P.rect(x - 1, y - 1, w + 2, h + 2, 0x3a3e46);
  area(P, x, y, w, h, (X, Y, ii, j) => {
    let c = lit ? qmix(0xeaf4ff, 0xa8c0d8, j / h, X, Y, 3) : night ? qmix(0x1c2638, 0x0e1420, j / h, X, Y, 3) : qmix(0x9ab4c8, 0x3a5068, j / h, X, Y, 3);
    if (ii % 3 === 0 || j % 3 === 0) c = mul(c, lit ? 0.86 : 0.82); // trådnätet i glaset
    return c;
  });
  P.line(x, y + h - 2, x + w - 1, y + 2, lit ? 0x7a8a9a : night ? 0x0a0e16 : 0x2a3444, 0.85); // trappräcket innanför
  P.line(x, y + h - 1, x + w - 1, y + 3, lit ? 0x9aaab8 : 0x1a2230, 0.5);
  if (!night && !o.broken) { P.px(x + 1, y + 1, WHITE, 0.4); P.px(x + 2, y + 1, WHITE, 0.25); }
  if (o.broken) { const cx = x + (w >> 1), cy = y + (h >> 1); for (let k = 0; k < 5; k++) P.line(cx, cy, cx + Math.round(Math.cos(k * 1.3) * 5), cy + Math.round(Math.sin(k * 1.3) * 4), 0xe8f0f8, 0.6); P.rect(cx - 1, cy, 2, 2, 0x06080c); }
  P.hl(x - 1, y + h + 1, w + 2, 0xb8b4aa); P.hl(x - 1, y + h + 2, w + 2, 0x6a6660);
  C.reg.ledges.push([x - 1, y + h + 1, w + 2]);
  if (lit) C.reg.glows.push([x, y, w, h, 0xd8ecff, 0.3]);
  if (flick && night) C.reg.flick.push({ x, y, w, h, c: 0xd8ecff, a: 0.7, mode: 'flick' });
}
// hisshus på taket
function machineRoom(C, x, w) {
  const P = C.P;
  P.darken(x + w, 3, 3, 12, 0.7);
  area(P, x, 0, w, 4, (X, Y, i, j) => jit(j === 3 ? 0x8a867e : mix(0xc8c4b8, WHITE, 0.15), X, Y, 5, 0.06));
  panels(P, x, 4, w, 10, 0xaaa498, C.s + 9, { pw: 12, ph: 10 });
  P.vl(x, 0, 14, mix(0xc8c4b8, WHITE, 0.3)); P.vl(x + w - 1, 0, 14, 0x6a665e); P.hl(x, 14, w, 0x000000, 0.3);
  P.rect(x + 4, 6, 6, 8, 0x4a4e58); P.box(x + 4, 6, 6, 8, 0x2a2e36); P.px(x + 8, 10, 0xc8c8d0); // ståldörr
  for (let k = 0; k < 3; k++) P.hl(x + w - 12, 6 + k * 2, 8, 0x3a3e46); // galler
  P.rect(x + 13, 6, 14, 5, 0xf0ece0); text(P, SMALL, 'HISS', x + 14, 6, 0x2a2a34);
  if (C.snow) snowCap(P, x, 1, w, 5);
}
// en av höghusens fasader. cfg: se anropen nedan.
function paintTower(b, night, opts, cfg) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w;
  const gTop = cfg.gTop, fTop = cfg.fTop;
  // ---- taket: en tunn remsa med hisshus, antenner, paraboler, fläkt ----
  gravelRoof(P, L, 0, W, FT, s, { night, puddles: 1, moss: 0.04 });
  if (C.snow) snowRoof(P, L + 1, 0, W - 2, FT - 3, s);
  machineRoom(C, L + cfg.machine, 40);
  antenna(P, L + cfg.machine + 32, 0, 11);
  for (const [dx, dy] of cfg.dishes) dish(P, L + dx, dy, { rust: hash(dx, dy, s) > 0.5, r: 3 });
  ventPipe(P, L + 12, 6, 7); ventPipe(P, L + W - 58, 5, 8);
  hvac(P, L + W - 30, 3, 12, 4, 5, { fan: true, rust: 2 });
  C.reg.fans.push({ x: L + W - 30 + 3, y: 3 + 0, speed: 7, ph: 0.3 });
  cfg.roofExtra?.(C);
  birdsOn(C, L + 8, L + cfg.machine - 4, FT - 2, 3);
  // ---- fasaden: betongelement med fogar ----
  panels(P, L, FT, W, gTop - FT, cfg.wall, s, { pw: 28, ph: cfg.floorH });
  area(P, L, FT, W, 4, (X, Y, i, j) => jit(j === 0 ? mix(cfg.wall, WHITE, 0.3) : j === 3 ? mul(cfg.wall, 0.62) : mul(cfg.wall, 0.86), X, Y, s + 4, 0.06)); // krönet
  for (let y = FT + 4; y < gTop; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.25)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.7)); P.px(R - 2, y, mul(P.get(R - 2, y), 0.86)); }
  moss(P, L, FT + 4, W, 6, s + 7, 0.05);
  // sanerat klotter (grå fyrkant i fel nyans) och en lagning
  area(P, L + cfg.patch[0], cfg.patch[1], 26, 9, (X, Y) => jit(mix(cfg.wall, 0x8a8a86, 0.35), X, Y, s + 8, 0.04));
  area(P, L + W - 44, fTop + 3 * cfg.floorH + 12, 12, 7, (X, Y) => jit(mix(cfg.wall, WHITE, 0.18), X, Y, s + 9, 0.08));
  for (let k = 0; k < 6; k++) crack(P, L + 6 + Math.floor(hash(k, s, 1) * (W - 12)), fTop + Math.floor(hash(k, s, 2) * (gTop - fTop - 20)), 6 + Math.floor(hash(k, s, 3) * 12), s + k);
  // trapphuset: en indragen remsa ovanför porten
  const sx = cfg.stairX, sw = 16;
  area(P, sx - 2, FT + 4, sw + 4, gTop - FT - 4, (X, Y, i, j) => { // emaljerade plåtar i trapphuset
    const pj = j % cfg.floorH, c0 = hash(0, Math.floor(j / cfg.floorH), s + 5) > 0.85 ? mul(cfg.stairCol, 0.8) : cfg.stairCol;
    let c = pj === cfg.floorH - 1 ? mul(c0, 0.55) : pj === 0 ? mix(c0, WHITE, 0.25) : i % 5 === 4 ? mul(c0, 0.86) : c0;
    if (hash(X >> 1, Y >> 1, s + 6) > 0.95) c = mix(c, 0x8a4a22, 0.5); // rostfläckar
    return i === 0 ? mul(c, 0.7) : i === sw + 3 ? mix(c, WHITE, 0.12) : jit(c, X, Y, s + 7, 0.05);
  });
  for (let f = 0; f < cfg.floors - 1; f++) stairWin(C, sx + 2, fTop + f * cfg.floorH + (cfg.floorH >> 1) - 2, sw - 4, 8, f, { flick: f === cfg.flickFloor, broken: f === cfg.brokenFloor, dark: f === cfg.darkFloor });
  // stort husnummer över porten
  const nB = bits(BIG, cfg.number, { x2: true, bold: true });
  bigNumber(P, sx + ((sw - nB.w) >> 1), fTop + (cfg.floors - 1) * cfg.floorH + 2, cfg.number, cfg.numberCol);
  // regnvatten har runnit från balkongplattorna och taket
  for (const col of cfg.cols) if (col.kind === 'bal') for (let f = 0; f < cfg.floors; f++) for (const ex of [col.x - 3, col.x + col.w + 2]) if (hash(ex, f, s + 40) > 0.3) streak(P, ex, fTop + f * cfg.floorH + cfg.floorH - 1, 4 + Math.floor(hash(ex, f, s + 41) * 10), 0x4a4638, 0.45, ex + f);
  for (let x = L + 2; x < R - 2; x += 3) if (hash(x, s, 42) > 0.55) streak(P, x, FT + 4, 3 + Math.floor(hash(x, s, 43) * 9), 0x3a3830, 0.35, x);
  // våningarna
  apartments(C, { top: fTop, floorH: cfg.floorH, floors: cfg.floors, cols: cfg.cols, front: cfg.front, frame: cfg.frame, seed: s, loggia: cfg.loggia, life: 0.55, lifeDay: 0.34, balk: 0.4 });
  // ---- bottenvåningen ----
  P.hl(L, gTop - 2, W, mix(cfg.wall, WHITE, 0.35)); P.hl(L, gTop - 1, W, mul(cfg.wall, 0.7)); P.hl(L, gTop, W, 0x000000, 0.3);
  area(P, L, gTop + 1, W, BY - 6 - gTop - 1, (X, Y, i, j) => { // räfflad betong
    const r = (X + 1) % 3; let c = r === 0 ? mix(cfg.ground, WHITE, 0.14) : r === 2 ? mul(cfg.ground, 0.78) : cfg.ground;
    if (hash(X >> 1, Y >> 2, s + 11) > 0.93) c = mul(c, 0.86);
    if (j > BY - gTop - 16) c = mix(c, 0x4a4234, ((j - (BY - gTop - 16)) / 12) * 0.25); // smuts mot marken
    return jit(c, X, Y, s + 12, 0.05);
  });
  plinth(P, L, BY - 6, W, 6, 0x6a6660, s + 13);
  footShadow(P, L, W, BY);
  // porten: nisch, skärmtak, dörren (ritas av live), porttelefon, husnummer
  const { dx0, dx1 } = C, dT = BY - DOOR_ART[b.kind].h;
  area(P, dx0 - 4, gTop + 3, dx1 - dx0 + 8, BY - gTop - 3, (X, Y, i, j) => jit(i < 3 ? 0x3a3a42 : i > dx1 - dx0 + 4 ? 0x5a5a62 : 0x2a2a32, X, Y, 14, 0.06));
  P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  area(P, dx0, gTop + 5, dx1 - dx0, dT - gTop - 6, (X, Y, i, j) => (night ? qmix(0xfff0c0, 0xd8a860, j / 6, X, Y, 2) : qmix(0x8aa4bc, 0x3a4c62, j / 6, X, Y, 2))); // överljus
  if (night) C.reg.glows.push([dx0, gTop + 5, dx1 - dx0, dT - gTop - 6, 0xffe0a0, 0.35]);
  canopy(C, dx0 - 9, gTop + 1, dx1 - dx0 + 18, { broken: cfg.canopyBroken });
  intercom(P, dx1 + 6, dT + 6, true);
  P.rect(dx0 - 2, BY - 1, dx1 - dx0 + 4, 1, 0x8a867e); P.rect(dx0 - 4, BY, dx1 - dx0 + 8, 2, 0xa8a49a); P.hl(dx0 - 4, BY, dx1 - dx0 + 8, 0xc8c4bc); P.rect(dx0 - 4, BY + 2, dx1 - dx0 + 8, 2, 0x6a6660);
  streetSign(P, dx1 + 8, gTop + 3, b.sign);
  // stuprör med en bit som saknas
  drainpipe(C, R - 6, FT + 2, BY, { gap: cfg.pipeGap });
  cfg.ground2(C);
  // ---- slitage överallt ----
  for (let k = 0; k < 5; k++) { const tx = L + 4 + Math.floor(hash(k, s, 21) * (W - 30)); if (tx > dx0 - 22 && tx < dx1 + 6) continue; tag(P, tx, BY - 13 - Math.floor(hash(k, s, 22) * 5), pick(TAGS, k, s, 23), pick(SPRAY, k, s, 24), s + k); }
  weeds(P, L + 6, BY - 1, 3, s + 31); weeds(P, R - 12, BY - 1, 2, s + 32); weeds(P, dx0 - 8, BY - 1, 2, s + 33);
  return finish(C);
}
function paintHoghus(b, night, opts) {
  const L = O;
  return paintTower(b, night, opts, {
    wall: 0xb4ae9e, ground: 0x9a968c, frame: 0xd8d4cc, gTop: 148, fTop: 22, floorH: 18, floors: 7, stairX: 84, stairCol: 0x5a8a8a,
    front: { kind: 'plat', col: 0x9a6a3a },
    cols: [{ x: L + 4, w: 28, kind: 'bal' }, { x: L + 40, w: 12, kind: 'win' }, { x: L + 56, w: 12, kind: 'win' },
      { x: L + 100, w: 12, kind: 'win' }, { x: L + 116, w: 12, kind: 'win' }, { x: L + 136, w: 28, kind: 'bal', front: { kind: 'plat', col: 0x5a7a8a } }],
    machine: 64, dishes: [[128, 8], [136, 6], [146, 9], [22, 9]], patch: [104, 60], flickFloor: 2, brokenFloor: 5, darkFloor: -1,
    number: '1', numberCol: 0xf4f1ea, pipeGap: [98, 108], canopyBroken: false,
    ground2(C) {
      const { P, BY, s } = C, gTop = 148, night = C.night;
      // tvättstugan i källarplanet: galler, lysrör och någon som viker lakan
      const lx = L + 6, ly = gTop + 10;
      lifeWin(C, lx, ly, 26, 13, { night, lit: 'warm', frame: 0x8a8e96, curtain: null, bars: true, act: 'fold', seed: 3, hours: [7, 22] });
      C.reg.anim[C.reg.anim.length - 1].cx = 8;
      P.rect(lx + 2, ly - 7, 22, 6, 0xf0ece0); P.box(lx + 1, ly - 8, 24, 8, 0x3a3a44); text(P, SMALL, 'TVÄTT', lx + 3, ly - 6, 0x2a3a6a);
      if (night) C.reg.glows.push([lx + 1, ly + 1, 24, 11, 0xe8f4ff, 0.18]);
      // anslagstavlan med lappar
      const nx = L + 36;
      area(P, nx, gTop + 9, 30, 22, (X, Y, i, j) => (i === 0 || j === 0 || i === 29 || j === 21 ? 0x5a3a24 : jit(0xb8864a, X, Y, 17, 0.14)));
      P.hl(nx, gTop + 31, 30, 0x000000, 0.3);
      note(P, nx + 2, gTop + 11, ['KATT', 'BORTA'], { seed: 1, paper: 0xfff8d0, ink: 0xc8202a, tape: false, pin: true });
      stencil(P, nx + 5, gTop + 24, 'katt', 0x3a2a2a, 0.9);
      note(P, nx + 19, gTop + 20, ['FEST'], { seed: 3, paper: 0xd8f0ff, ink: 0x2a2a6a, tape: false, pin: true });
      // cyklar mot väggen och ett källarfönster
      bike(P, L + 6, BY - 1, s + 1); bike(P, L + 19, BY - 1, s + 2);
      win(P, L + 128, BY - 11, 12, 5, { night, frame: 0x6a6660, bars: true, sill: false, transom: false, dirt: 1, seed: 9 }, C.reg);
      // klotterpjäs och affisch
      piece(P, L + 128, gTop + 17, 'BTG', { c1: 0x6fdc4c, c2: 0x2a9a8a, cloud: 0x3a2a5a, drips: 5, sign: 'ZOK' });
      stencil(P, L + 112, BY - 13, 'hjarta', 0xff5dc8);
      tag(P, L + 70, gTop + 28, 'KRAM', 0x3a9bff, 5);
    },
  });
}
function paintHoghus2(b, night, opts) {
  const L = O;
  return paintTower(b, night, opts, {
    wall: 0xc8b484, ground: 0x8a8272, frame: 0xe8e0c8, gTop: 146, fTop: 20, floorH: 18, floors: 7, stairX: 92, stairCol: 0xb86a3a,
    front: { kind: 'galler', col: 0x5a3a24 }, loggia: 0x8a7a5a,
    cols: [{ x: L + 6, w: 28, kind: 'bal' }, { x: L + 44, w: 12, kind: 'win' }, { x: L + 62, w: 12, kind: 'win' },
      { x: L + 112, w: 12, kind: 'win' }, { x: L + 130, w: 12, kind: 'win' }, { x: L + 150, w: 28, kind: 'bal' }],
    machine: 20, dishes: [[70, 8], [80, 7], [92, 9], [102, 6], [112, 8]], patch: [48, 80], flickFloor: 4, brokenFloor: 1, darkFloor: 3,
    number: '5', numberCol: 0xffd23f, pipeGap: [60, 66], canopyBroken: true,
    roofExtra(C) { // mast med flyghinderljus
      const { P } = C, mx = L + 150;
      P.vl(mx, 0, 14, 0x5a5e68); P.vl(mx + 1, 0, 14, 0x9aa0aa); for (let y = 2; y < 14; y += 3) P.hl(mx - 1, y, 4, 0x6a6e78);
      dish(P, mx - 5, 5, { r: 2 }); dish(P, mx + 5, 8, { r: 2, rust: true });
      P.rect(mx, 0, 2, 1, 0xa8201a); C.reg.leds.push({ x: mx, y: 0, c: 0xff2a1a, rate: 0.8, ph: 0 });
    },
    ground2(C) {
      const { P, BY, s } = C, gTop = 146, night = C.night;
      // banderoll från en loggia: RÄDDA GRUSPLANEN!
      const bx = L + 2, by = 20 + 4 * 18 + 16;
      area(P, bx, by, 40, 14, (X, Y, i, j) => { const sag = Math.round(Math.sin((i / 39) * Math.PI) * 1.5); return j < sag ? null : jit(j === sag ? 0xffffff : 0xf0ece0, X, Y, 23, 0.05); });
      scrawl(P, SMALL, 'RÄDDA', bx + 9, by + 3, 0xc8202a, 4); scrawl(P, SMALL, 'GRUSPLAN!', bx + 3, by + 8, 0x2a3a8a, 5);
      P.line(bx, by, bx - 1, by - 3, 0x8a8a90); P.line(bx + 39, by, bx + 40, by - 3, 0x8a8a90); P.hl(bx + 1, by + 14, 38, 0x000000, 0.2);
      // väggmålning (klotterpjäs) och kundvagn
      piece(P, L + 8, gTop + 17, 'FÖRORT', { x2: false, c1: 0xff8a2a, c2: 0xe8443a, cloud: 0x2a5a9a, drips: 6 });
      piece(P, L + 144, gTop + 17, 'PIX', { c1: 0xff5dc8, c2: 0x9a5cff, drips: 4, sign: 'KAOS' });
      const cx = L + 62, cy = BY - 1;
      for (let i = 0; i < 12; i++) for (let j = 0; j < 7; j++) if (i % 2 === 0 || j % 2 === 0) P.px(cx + i + (j < 3 ? 0 : 1), cy - 9 + j, 0x9aa0aa);
      P.hl(cx - 1, cy - 10, 14, 0xc8ccd4); P.line(cx + 13, cy - 10, cx + 16, cy - 13, 0x6a6e78); P.px(cx + 1, cy - 1, 0x1a1a1e); P.px(cx + 11, cy - 1, 0x1a1a1e); P.hl(cx, cy - 2, 13, 0x6a6e78);
      for (const [x, c] of [[L + 38, 0x1a1a22], [L + 47, 0x2a2a34]]) { P.ell(x + 4, BY - 4, 5, 4, c, 1, 2); P.px(x + 4, BY - 8, 0x3a3a44); P.px(x + 2, BY - 5, 0x4a4a54); }
      note(P, C.dx1 + 3, gTop + 13, ['KODLÅS', 'SÖNDER'], { seed: 7, paper: 0xfff8d0 });
      cctv(C, C.dx0 - 6, gTop + 5, true);
    },
  });
}

// ======================= BUTIKSLÄNGAN: närbutik, pantbank, kebab =======================
// skyltfönster: bakgrund (rummet) i husbilden, framför-lager (disk, galler, lappar,
// reflexer) både i husbilden och som egen bild så att folket i butiken hamnar emellan
function shopWin(C, x, y, w, h, o) {
  const P = C.P, fr = o.frame ?? 0x3a3a42, gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  P.rect(x - 2, y - 2, w + 4, h + 4, mul(fr, 0.5)); P.rect(x - 1, y - 1, w + 2, h + 2, fr);
  P.hl(x - 1, y - 1, w + 2, mix(fr, WHITE, 0.3)); P.vl(x + w, y, h, mul(fr, 0.6));
  o.back(P, gx, gy, gw, gh);
  const front = (Q) => {
    o.front?.(Q, gx, gy, gw, gh);
    if (!C.night) for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const d = (((i * 2 - j * 3 + x) % 19) + 19) % 19; if (d < 2) Q.px(gx + i, gy + j, WHITE, 0.16); else if (d === 5) Q.px(gx + i, gy + j, WHITE, 0.07); }
    if (o.mullion) for (const mx of o.mullion) Q.vl(mx, gy, gh, fr);
  };
  front(P);
  if (o.act) {
    const F = new Pix(w + 2, h + 2, x - 1, y - 1); front(F);
    const s = C.s + x * 3;
    C.reg.anim.push({ x: gx, y: gy, w: gw, h: gh, act: o.act, front: F.flush(), fx: x - 1, fy: y - 1, mode: C.night ? 'warm' : 'day', hours: o.hours || null,
      n: o.n ?? Math.floor(hash(s, 1, 5) * 997), n2: Math.floor(hash(s, 2, 5) * 997), per: o.per ?? 9 + hash(s, 3, 5) * 5, ph: hash(s, 4, 5), cx: o.cx, side: 1 });
  }
  if (C.night && o.lit) C.reg.glows.push([gx, gy, gw, gh, o.litCol ?? 0xfff4d8, o.litA ?? 0.3]);
  // bänk under fönstret
  P.hl(x - 2, y + h + 1, w + 4, 0xb8b4aa); P.hl(x - 2, y + h + 2, w + 4, 0x5a5650); P.hl(x - 1, y + h + 3, w + 2, 0x000000, 0.25);
  C.reg.ledges.push([x - 2, y + h + 1, w + 4]);
}
const PACKS = [0xd8323a, 0xf0b429, 0x3a7bd5, 0x46a35a, 0xe07a2e, 0x8e5bd1, 0xf4f1ea, 0x2aa39a, 0xe85a9a, 0x6a4a2a];
// butikshylla med varor i en rad (y = hyllplanets överkant)
function goodsRow(P, x, y, w, s, dim = 1) {
  for (let i = 0; i < w;) {
    const pw = 1 + Math.floor(hash(i, s, 1) * 3), ph = 2 + Math.floor(hash(i, s, 2) * 3), c = mul(pick(PACKS, i, s, 3), dim);
    for (let k = 0; k < pw && i + k < w; k++) { P.vl(x + i + k, y - ph, ph, k === 0 ? mix(c, WHITE, 0.2) : c); P.px(x + i + k, y - ph, mix(c, WHITE, 0.4)); }
    i += pw + (hash(i, s, 4) > 0.8 ? 1 : 0);
  }
  P.hl(x, y, w, mul(0xb8bcc4, dim)); P.hl(x, y + 1, w, mul(0x6a6e78, dim));
}
function shopRow(C, cfg) {
  // gemensamt för de tre: platt tak bakåt, två våningar lägenheter, butiksplan
  const { P, L, R, BY, FT, s } = C, W = C.b.w, night = C.night, gTop = 140;
  gravelRoof(P, L, 40, W, FT - 40, s, { night, puddles: cfg.puddles ?? 1, moss: 0.07, col: cfg.roofCol });
  P.hl(L, 40, W, 0x8a867e); P.hl(L, 41, W, 0x5a5650); // bortre sargen
  if (C.snow) snowRoof(P, L + 1, 42, W - 2, FT - 45, s);
  cfg.roof(C);
  // brandmurar mellan husen (upphöjda kanter på taket)
  for (const ex of cfg.firewalls || []) { const x = ex < 0 ? L : R - 3; area(P, x, 36, 3, FT - 36, (X, Y, i, j) => brickPx(X, Y, 0x8a5a44, s + 3, { bw: 5, bh: 2 })); P.hl(x - 1, 35, 5, 0xb8bcc4); P.hl(x - 1, 36, 5, 0x6a6e78); }
  // fasaden
  cfg.wall(P, L, FT, W, gTop - FT);
  for (let y = FT; y < gTop; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.2)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.72)); }
  // taklist
  const tc = cfg.trim;
  rows(P, L, FT, W, [mix(tc, WHITE, 0.4), tc, mul(tc, 0.85), mul(tc, 0.6), null]);
  P.darken(L, FT + 4, W, 2, 0.8);
  if (C.snow) snowCap(P, L, FT, W, s);
  // lägenheterna: två våningar
  cfg.cols.forEach((cx, k) => [0, 1].forEach((f) => {
    const wy = FT + 8 + f * 26, ss = s + k * 5 + f * 11, r = hash(k, f, ss);
    const lit = night ? (r < 0.66 ? (hash(k, f, ss + 1) < 0.18 ? 'tv' : hash(k, f, ss + 2) < 0.4 ? 'warm2' : 'warm') : false) : false;
    const special = cfg.special?.[k + ',' + f];
    const o = { night, lit, frame: cfg.frame, curtain: hash(k, f, ss + 3) > 0.3 ? pick(CURT, k, f, ss + 4) : null, blind: hash(k, f, ss + 5) > 0.7 ? (hash(k, f, ss + 6) > 0.5 ? 'broken' : 'half') : null, seed: ss, dirt: 0.4, transom: 0.3, ...(special || {}) };
    if (cfg.lintel) cfg.lintel(P, cx, wy);
    const alive = !special && (night ? !!lit && hash(k, f, ss + 7) < 0.7 : hash(k, f, ss + 7) < 0.5);
    if (alive) lifeWin(C, cx, wy, 14, 16, o); else win(P, cx, wy, 14, 16, o, C.reg);
    if (special?.ac) { // luftkonditionering under fönstret (droppar)
      P.rect(cx + 2, wy + 20, 10, 5, 0xd8d8d4); P.hl(cx + 2, wy + 20, 10, WHITE); P.hl(cx + 2, wy + 24, 10, 0x8a8a86); for (let i = 3; i < 12; i += 2) P.vl(cx + i, wy + 21, 3, 0x9a9a96);
      streak(P, cx + 10, wy + 25, 12, 0x3a3226, 0.5, 3); C.reg.drips.push({ x: cx + 10, y: wy + 25, len: 10, ph: 0.3 });
    }
    if (hash(k, f, ss + 8) > 0.6) streak(P, cx + 3 + Math.floor(hash(k, f, ss + 9) * 8), wy + 20, 4 + Math.floor(hash(k, f, ss + 10) * 8), 0x4a3a2a, 0.45, ss);
  }));
  cfg.upper?.(C);
  // gördelgesims över butiksplanet
  rows(P, L, gTop - 2, W, [mix(tc, WHITE, 0.3), tc, mul(tc, 0.6)]);
  P.darken(L, gTop + 1, W, 1, 0.7);
  cfg.shop(C, gTop);
  plinth(P, L, BY - 5, W, 5, cfg.plinth ?? 0x5a5650, s + 21);
  footShadow(P, L, W, BY);
  // dörrsmygen (dörren ritas av live)
  const { dx0, dx1 } = C, dT = BY - DOOR_ART[C.b.kind].h;
  P.rect(dx0 - 2, dT - 2, dx1 - dx0 + 4, BY - dT + 2, 0x2a2a30); P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  P.rect(dx0 - 3, BY, dx1 - dx0 + 6, 2, 0x9a968c); P.hl(dx0 - 3, BY, dx1 - dx0 + 6, 0xc8c4bc); P.rect(dx0 - 3, BY + 2, dx1 - dx0 + 6, 2, 0x5a5650);
  for (let k = 0; k < (cfg.tags ?? 3); k++) { const tx = L + 2 + Math.floor(hash(k, s, 51) * (W - 20)); if (tx > dx0 - 16 && tx < dx1 + 2) continue; tag(P, tx, BY - 12 - Math.floor(hash(k, s, 52) * 4), pick(TAGS, k, s, 53), pick(SPRAY, k, s, 54), s + k); }
  weeds(P, L + 4, BY - 1, 2, s + 55); weeds(P, R - 6, BY - 1, 3, s + 56);
  return finish(C);
}
// roll-galler (halvt nerdraget) framför ett skyltfönster
function grille(P, x, y, w, h, o = {}) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (i % 3 === 0 || j % 3 === 0) P.px(x + i, y + j, (j % 3 === 0) ? 0x8a8e98 : 0x5a5e68, o.a ?? 0.95);
  if (o.box !== false) { P.rect(x - 1, y - 4, w + 2, 4, 0x6a6e78); P.hl(x - 1, y - 4, w + 2, 0xa8acb4); P.hl(x - 1, y - 1, w + 2, 0x3a3e46); }
  P.hl(x, y + h, w, 0x3a3e46); P.px(x + (w >> 1), y + h + 1, 0x2a2e36);
}
// ======================= NÄRBUTIKENS LJUSLÅDA =======================
// En lång, sliten ljuslåda i förortsstil: vit plastfront med röda NÄRBUTIK (spelets BIG i
// fetstil), röd 24/7-panel, ett avslaget hörn där det nakna lysröret syns, sprickor,
// silvertejp, döda flugor och en vattenfläck i botten, rostig underkarm, vinkeljärn,
// en duva på lådans tak och en lös kabel som dinglar under. Dagtid är lådan släckt.
// Kvällstid tänder glow() plastens och bokstävernas EGNA pixlar (ljuset sitter bakom
// texten – ingen ljusruta läggs över bokstäverna) och ett dithrat sken på väggen.
// Lysröret bakom U och T håller på att dö: det slocknar ibland ett ögonblick, blinkar två
// gånger eller försöker tända om (nbTube) – oregelbundet, aldrig stroboskop.

// fetstil utan att prickarna flyter ihop: Ä/Ö får två tydliga prickar (##..##)
function boldDots(B, word) {
  [...word.toUpperCase()].forEach((ch, k) => {
    const G = BIG[ch];
    if (!G || !G.up.length) return;
    const dots = [...G.up[0]].map((c, i) => (c === '#' ? i : -1)).filter((i) => i >= 0);
    if (dots.length !== 2) return;
    const [c0, c1] = B.cols[k], y = B.up - G.up.length;
    for (let i = c0; i < c1; i++) B.on[y * B.w + i] = 0;
    for (const i of [dots[0] - 1, dots[0], dots[1] + 1, dots[1] + 2]) if (i >= 0 && c0 + i < c1) B.on[y * B.w + c0 + i] = 1;
  });
  return B;
}
// lådans mått (husbildens koordinater) – samma för alla lägen
function nbGeo(C, gTop) {
  const { L, R } = C, x0 = L + 1, x1 = R - 2, fx0 = x0 + 1, fx1 = x1 - 1, fy0 = gTop + 1, fy1 = gTop + 12;
  const pv = fx1 - 28, dv = pv - 2;                                   // 24/7-panelen (pv..fx1), mittprofilen (dv, dv+1)
  const B = boldDots(bits(BIG, 'NÄRBUTIK', { bold: true }), 'NÄRBUTIK');
  const tx = fx0 + ((dv - fx0 - B.w) >> 1) + 1, ty = fy0 + 3;       // versalhöjdens överkant
  const N = bits(BIG, '24/7'), nx = pv + ((fx1 + 1 - pv - N.w) >> 1);
  const HW = [11, 9, 8, 6, 5, 3, 3, 1];                              // det avslagna hörnet, rad för rad
  const hit = (M, bx) => (x, y) => { const i = x - bx, j = y - (ty - M.up); return i >= 0 && j >= 0 && i < M.w && j < M.h && M.on[j * M.w + i] === 1; };
  return {
    x0, x1, fx0, fx1, fy0, fy1, pv, dv, B, tx, ty, N, nx,
    seg: [tx + B.cols[4][0] - 1, tx + B.cols[5][1]],                  // det döende röret: U, T och glipan runt dem
    tubes: [fy0 + 3.5, fy0 + 7.5],                                     // lysrörens mittlinjer bakom plasten
    letter: hit(B, tx),
    hole: (x, y) => y >= fy0 && y - fy0 < HW.length && x >= fx0 && x < fx0 + HW[y - fy0],
    cable: C.dx1 + 2,                                                   // där den lösa kabeln hänger ut (mellan dörren och högra fönstret)
  };
}
// Målar lådan. mode: 'day' (släckt i dagsljus), 'lit' (tänd), 'dead' (släckt i mörkret).
// Allt som ser likadant ut tänt och släckt (karm, tejp, flugor, sockel) räknas inte som ljus.
function nbSign(Q, G, C, mode) {
  const s = C.s, lit = mode === 'lit', dead = mode === 'dead';
  const { x0, x1, fx0, fx1, fy0, fy1, pv, dv, B, tx, ty, N, nx, tubes, hole, letter } = G;
  const tubeD = (y) => Math.min(Math.abs(y - tubes[0]), Math.abs(y - tubes[1]));
  const FH = fy1 - fy0 + 1;
  // --- lådans tak (ses snett uppifrån): damm, löv, fågelskit ---
  for (let x = x0; x <= x1; x++) {
    let a = jit(0x868a92, x, fy0 - 3, s + 60, 0.08), b = jit(0xb4b8c0, x, fy0 - 2, s + 61, 0.06);
    const n = hash(x, 3, s + 62);
    if (n > 0.84) a = hash(x, 4, s + 62) > 0.5 ? 0x5e5c54 : 0x6a6458; else if (n < 0.05) b = 0x8a8a82;
    if (x === x0 || x === x1) { a = mul(a, 0.8); b = mul(b, 0.84); }
    Q.px(x, fy0 - 3, a); Q.px(x, fy0 - 2, b);
  }
  Q.px(x0 + 38, fy0 - 3, 0xb8782a); Q.px(x0 + 39, fy0 - 3, 0x8a5a24); Q.px(x0 + 39, fy0 - 2, 0xc88a3a); // löv
  Q.px(x0 + 71, fy0 - 3, 0x9a6a2a); Q.px(x0 + 72, fy0 - 2, 0x7a4e20);
  for (const dx of [48, 51, 55, 58]) Q.px(x0 + dx, fy0 - 2 - (dx & 1), 0xf0eee6);                     // fågelskit där duvan sitter
  // --- karmen: aluminiumprofil, rostig underkarm, skruvar ---
  for (let x = x0; x <= x1; x++) {
    Q.px(x, fy0 - 1, x === x0 ? 0x9aa0a8 : x === x1 ? 0x3e424a : jit(hash(x, 5, s + 63) > 0.88 ? 0x8a8e96 : 0x5e626a, x, fy0 - 1, s + 64, 0.06));
    let c = jit(0x44484f, x, fy1 + 1, s + 65, 0.06);
    const r = hash(x >> 1, 7, s + 66);
    if (r > 0.7) c = r > 0.87 ? 0xa45a2a : 0x7a4222;
    Q.px(x, fy1 + 1, c);
  }
  for (let y = fy0; y <= fy1; y++) {
    Q.px(x0, y, y === fy0 ? 0x5a5e66 : 0x7c8088); Q.px(x1, y, 0x3a3e46);
    Q.px(dv, y, 0x8a8e96); Q.px(dv + 1, y, 0x4a4e56);
  }
  for (const [x, y] of [[x0, fy0 - 1], [x1, fy0 - 1], [x0, fy1 + 1], [x1, fy1 + 1], [dv, fy0 - 1], [dv + 1, fy1 + 1]]) Q.px(x, y, 0xc8ccd4);
  Q.px(G.cable, fy1 + 1, 0x16161a); Q.px(G.cable + 1, fy1 + 1, 0x2e2e34);                               // kabelgenomföringen
  // vinkeljärnen som håller lådan (mellan fönstren ovanför)
  for (const bx of [x0 + 24, x1 - 25]) { Q.vl(bx, fy0 - 5, 2, 0x3a3e46); Q.vl(bx + 1, fy0 - 5, 2, 0x6a6e76); Q.px(bx + 1, fy0 - 5, 0xa8acb4); Q.px(bx + 2, fy0 - 4, 0x7a4222, 0.7); }
  // --- vita fronten ---
  const face = (x, y) => {
    const j = y - fy0;
    let c;
    if (lit) {
      const d = tubeD(y);
      c = d < 1 ? 0xfffef8 : d < 2 ? 0xfdf6e8 : d < 3 ? 0xf2e8d4 : 0xe4d8c0;
      if (x < G.seg[0]) c = mix(c, 0xffd8a0, 0.2);                   // vänstra röret är gammalt och gulare
      if (j === 0) c = mul(c, 0.84);
      return jit(c, x, y, s + 67, 0.025);
    }
    if (dead) return jit(j === 0 ? 0x7a766e : j >= FH - 2 ? 0x86827a : 0x949088, x, y, s + 67, 0.03);
    c = j === 0 ? 0xcbc7bd : j >= FH - 2 ? 0xd4d0c6 : 0xe8e5dc;
    if (x < fx0 + 24) c = qmix(c, mix(c, 0xe0cc94, 0.42), 1 - (x - fx0) / 24, x, y, 3); // solgulnad vid det trasiga hörnet
    return jit(c, x, y, s + 67, 0.03);
  };
  area(Q, fx0, fy0, dv - fx0, FH, (X, Y) => {
    if (hole(X, Y)) return null;
    let c = face(X, Y);
    if (hole(X - 1, Y)) c = lit ? 0xffffff : dead ? 0xa8a49c : 0xfcfbf6;                          // plastens brottkant
    else if (hole(X, Y - 1)) c = mul(c, 0.9);                                                      // skugga under brottet
    const st = hash(X, 9, s + 68);                                   // smutsränder från karmen
    if (st > 0.87 && Y - fy0 <= 1 + Math.floor(hash(X, 10, s + 68) * 3) && !letter(X, Y)) c = mul(c, 0.94);
    return c;
  });
  // --- hålet: lådans insida (smutsvit plåt i skugga), det nakna röret med sockel och svärtad ända, kabel, spindelväv ---
  for (let y = fy0; y < fy0 + 8; y++) for (let x = fx0; x < fx0 + 11; x++) {
    if (!hole(x, y)) continue;
    const j = y - fy0, tr = j === 3 || j === 4, top = j === 3;
    let c;
    if (tr && x === fx0) c = lit ? (top ? 0xd8d4c8 : 0x8a867c) : (top ? 0xa8a498 : 0x6a665e); // sockeln (i skugga på dagen)
    else if (tr && x === fx0 + 1) c = top ? 0x5a5a56 : 0x3a3a38;                     // den svärtade rörändan
    else if (tr) c = lit ? (top ? 0xffffff : 0xeef4f8) : dead ? (top ? 0x9aa0a2 : 0x6e7478) : (top ? 0xb4b8b8 : 0x7e8488);
    else if (x === fx0 && j < 3) c = lit ? 0x3a3a3e : 0x1e1e22;                     // matarkabeln upp till sockeln
    else {
      const k = j === 0 ? 0 : j === 1 ? 1 : j === 2 || j === 5 ? 3 : 2;               // 0 = skugga under karmen … 3 = intill röret
      c = lit ? [0x9aa2a8, 0xbcc4c8, 0xd0d8dc, 0xe4ecf0][k] : dead ? 0x222228 : [0x18181e, 0x24242a, 0x2e2e34, 0x3e3e44][k]; // natt: kallt, bländande naket ljus
    }
    Q.px(x, y, c);
  }
  for (const [x, y] of [[fx0 + 2, fy0], [fx0 + 3, fy0 + 1], [fx0 + 4, fy0 + 1], [fx0 + 2, fy0 + 2]]) Q.px(x, y, lit ? 0xe8e6dc : dead ? 0x55555a : 0xb0b0b4, 0.75); // spindelväv
  // --- sprickor ut från hålet ---
  const cr = (pts) => pts.forEach(([x, y]) => {
    Q.px(x, y, lit ? 0xffffff : dead ? 0x66625a : 0x8a867c);
    if (!letter(x, y + 1) && !hole(x, y + 1)) Q.px(x, y + 1, lit ? 0xd8ccb4 : dead ? 0x8a867e : 0xf4f2ea);
  });
  cr([[fx0 + 11, fy0], [fx0 + 12, fy0 + 1], [fx0 + 13, fy0 + 1], [fx0 + 14, fy0 + 1], [fx0 + 15, fy0 + 2]]);
  cr([[fx0 + 1, fy0 + 8], [fx0 + 2, fy0 + 9], [fx0 + 3, fy0 + 10], [fx0 + 4, fy0 + 11]]);
  cr([[fx0 + 7, fy0 + 4], [fx0 + 8, fy0 + 5], [fx0 + 8, fy0 + 6]]);
  // --- vattenfläck i botten till höger (regn har kommit in): oregelbunden fläck med mörkare rand ---
  const wcx = dv - 5.5, wcy = fy1 + 0.5;
  const wet = (x, y) => { const d = Math.hypot((x - wcx) / 5.5, (y - wcy) / 2.6); return x < dv && y <= fy1 && d < 1 + (hash(x, y, s + 77) - 0.5) * 0.35; };
  for (let y = fy1 - 3; y <= fy1; y++) for (let x = dv - 12; x < dv; x++) {
    if (!wet(x, y) || letter(x, y)) continue;
    const edge = !wet(x, y - 1) || !wet(x - 1, y);
    Q.px(x, y, edge ? (lit ? 0xd4ac6a : dead ? 0x6a5a40 : 0xb49a66) : mix(face(x, y), lit ? 0xf0c880 : dead ? 0x8a7a5a : 0xd8c490, 0.28));
  }
  // --- bokstäverna (vinyl på plasten, lite solblekta) ---
  if (!lit && !dead) sign(Q, B, tx, ty, { fill: null, shadow: 0x8a867c, sx: 1, sy: 1, sa: 0.45 });
  sign(Q, B, tx, ty, lit
    ? { fill: (i, j, X, Y) => jit(0xe02a22, X, Y, s + 69, 0.03), hi: 0xff6a54, lo: 0xb41818 }
    : dead ? { fill: 0x6a1e1e, hi: 0x7c2c2a, lo: 0x4c1414 }
      : { fill: (i, j, X, Y) => jit(i > B.cols[6][0] ? 0xca3a34 : 0xc2302c, X, Y, s + 69, 0.05), hi: 0xd85a4c, lo: 0x8c1c1c });
  // --- 24/7-panelen: röd plast, vita siffror, ett klistermärke ---
  area(Q, pv, fy0, fx1 - pv + 1, FH, (X, Y, i, j) => {
    const base = lit ? 0xea3c2e : dead ? 0x5a1c1a : 0xb02a26;
    let c = j === 0 ? mul(base, 0.78) : j === 1 ? mix(base, WHITE, lit ? 0.18 : 0.1) : j >= FH - 2 ? mul(base, 0.8) : base;
    if (lit && tubeD(Y) < 1) c = mix(c, 0xffa080, 0.22);
    if (i === 0) c = mul(c, 0.86);
    return jit(c, X, Y, s + 70, 0.04);
  });
  sign(Q, N, nx, ty, lit ? { fill: 0xffffff, lo: 0xffe2d8 } : dead ? { fill: 0x8a7470, lo: 0x6a5652 } : { fill: 0xf2eee6, lo: 0xcac0b6, shadow: 0x6a1412, sx: 1, sy: 1, sa: 0.6 });
  Q.rect(pv + 1, fy1 - 1, 3, 2, 0x2a5aa8); Q.hl(pv + 1, fy1 - 1, 3, 0x3a7bd5); Q.px(pv + 2, fy1 - 1, 0xf0f0f0);   // klistermärke
  // --- silvertejp över den nedre sprickan ---
  for (let j = 0; j < 3; j++) for (let i = 0; i < 7; i++) {
    if ((i === 0 || i === 6) && hash(i, j, s + 71) > 0.55) continue;                           // fransiga ändar
    let c = j === 0 ? 0xb4b8bc : j === 2 ? 0x7c8086 : 0x9a9ea4;
    if (hash(i, j, s + 72) > 0.78) c = mix(c, WHITE, 0.22);                                      // veck
    Q.px(fx0 + 1 + i, fy0 + 8 + j, c);
  }
  Q.px(fx0 + 7, fy0 + 7, 0xc8ccd0);                                                               // en hörna som släppt
  // --- döda flugor i botten av lådan (syns som prickar genom plasten) ---
  for (let k = 0; k < 9; k++) {
    const x = fx0 + 10 + Math.floor(hash(k, s, 73) * (dv - fx0 - 24)), y = fy1 - (hash(k, s, 74) > 0.7 ? 1 : 0);
    if (letter(x, y)) continue;
    Q.px(x, y, 0x2e2a26);
    if (hash(k, s, 75) > 0.6 && !letter(x + 1, y)) Q.px(x + 1, y, 0x5a5650);
  }
  for (const dx of [9, 17, 22]) Q.px(pv + dx, fy1, 0x3a1614);
}
// Tända/släckta bilder för glow() och live(): resten av lådan, det döende röret tänt/släckt
// och skenet på väggen. Bara pixlar som skiljer tänt från släckt lyser. När röret är släckt
// lyser grannrören ändå in en bit i lådan: biten mörknar mot mitten i fyra steg (nbDim).
const nbDim = (dc) => (dc <= 0 ? 0.72 : dc <= 2 ? 0.5 : dc <= 4 ? 0.32 : 0.18);
function nbLights(C, G) {
  const { L, R } = C, { x0, x1, fy0, fy1, seg, dv } = G;
  const X0 = L, Y0 = fy0 - 8, W = R - L, H = fy1 - fy0 + 16;
  const mk = () => new Pix(W, H, X0, Y0);
  const lit = mk(), dead = mk();
  nbSign(lit, G, C, 'lit'); nbSign(dead, G, C, 'dead');
  const em = [];                                                       // ljuskällorna: [i, j, iSeg, dim]
  const rest = mk(), segOn = mk(), segOff = mk(), segDim = mk();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = X0 + i, y = Y0 + j;
    if (y < fy0 || y > fy1 || x <= x0 || x >= x1) continue;
    const a = lit.get(x, y), b = dead.get(x, y);
    if (a === b) continue;
    const inSeg = x >= seg[0] && x <= seg[1], f = inSeg ? nbDim(Math.min(x - seg[0], seg[1] - x)) : 1;
    em.push([i, j, inSeg, f]);
    if (inSeg) { segOn.px(x, y, a); segOff.px(x, y, b); segDim.px(x, y, a, f); } else rest.px(x, y, a);
  }
  // skenet på väggen: dithrat och kvantiserat; på karmen en jämn kant, aldrig inne på fronten
  const halo = (segOn) => {
    const P = mk(), r = 6, best = new Float32Array(W * H);
    for (const [ei, ej, inSeg, f] of em) {
      const w = inSeg && !segOn ? f * 0.8 : 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const i = ei + dx, j = ej + dy;
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        const v = w * (1 - Math.hypot(dx, dy) / (r + 0.6));
        if (v > best[j * W + i]) best[j * W + i] = v;
      }
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = X0 + i, y = Y0 + j, v = best[j * W + i];
      if (v <= 0) continue;
      const inBox = x >= x0 && x <= x1 && y >= fy0 - 3 && y <= fy1 + 1;
      const rim = inBox && (y === fy0 - 1 || y === fy1 + 1 || x === x0 || x === x1 || x === dv || x === dv + 1);
      if (inBox && !rim) continue;
      if (rim) { P.px(x, y, 0xfff0d8, v > 0.7 ? 0.3 : v > 0.4 ? 0.2 : 0.1); continue; }
      const q = Math.floor(v * 4 + bayer(x, y)) / 4;
      if (q > 0) P.px(x, y, 0xfff0d8, q * 0.42);
    }
    return P.flush();
  };
  const img = { rest: rest.flush(), on: segOn.flush(), off: segOff.flush(), dim: segDim.flush(), haloOn: halo(true), haloOff: halo(false) };
  C.reg.glowFx.push((ctx, t, st, k) => {
    const on = nbTube(t, C.s) === 1;
    ctx.globalAlpha = Math.min(1, 0.55 * k);
    ctx.drawImage(img.rest, X0, Y0);
    ctx.drawImage(on ? img.on : img.dim, X0, Y0);
    ctx.globalAlpha = k;
    ctx.drawImage(on ? img.haloOn : img.haloOff, X0, Y0);
    ctx.globalAlpha = 1;
  });
  // på natten är husbilden tänd – när röret slocknar läggs den släckta biten över
  if (C.night) C.reg.extra.push((ctx, t) => { if (nbTube(t, C.s) === 0) ctx.drawImage(img.off, X0, Y0); });
}
// Det döende röret: tänt för det mesta; ibland (oregelbundet) ett av mönstren nedan.
// Varje bit är minst 0,09 s – det hackar, men blixtrar aldrig som ett stroboskop.
// Tiden delas i fack à 2,2 s; högst ett avbrott per fack och det ligger helt inne i facket
// med minst 0,3 s tänt före och efter. Allt avgörs vid fackets START (även de lugna
// stunderna), så ett påbörjat avbrott körs alltid klart – inga avklippta blixtar.
// I snitt ca 6 avbrott i minuten, med lugna stunder på 13 s emellanåt.
const NB_EPIS = [
  [0.3, [[0.13, 0]]],                                                  // slocknar ett ögonblick
  [0.36, [[0.2, 0], [0.1, 1], [0.12, 0], [0.1, 1], [0.24, 0]]],        // slocknar, blinkar två gånger, lyser igen
  [0.14, [[0.5, 0], [0.09, 1], [0.42, 0], [0.12, 1], [0.18, 0]]],      // glimtändaren försöker tända om
  [0.2, [[0.16, 0], [0.12, 1], [0.1, 0]]],                             // hackar till
];
function nbTube(t, seed) {
  const SLOT = 2.2, n = Math.floor(t / SLOT);
  if (hash(Math.floor((n * SLOT) / 13), seed, 81) < 0.35) return 1;  // lugna stunder (avgörs vid fackets start)
  if (hash(n, seed, 82) > 0.36) return 1;                             // de flesta fack: inget händer
  let p = hash(n, seed, 83), ep = NB_EPIS[0][1];
  for (const [w, e] of NB_EPIS) { ep = e; if ((p -= w) < 0) break; }
  const dur = ep.reduce((a, e) => a + e[0], 0);
  let v = t - n * SLOT - 0.3 - hash(n, seed, 84) * (SLOT - dur - 0.6); // 0,3 s marginal i båda ändar av facket
  if (v < 0 || v >= dur) return 1;
  for (const [d, on] of ep) { if (v < d) return on; v -= d; }
  return 1;
}
// den lösa (vita) elkabeln under lådan: dinglar sakta (mer i blåst), avklippt med kopparn ute
function nbCable(C, G) {
  const x = G.cable, y = G.fy1 + 2, len = 9;
  C.reg.extra.push((ctx, t, st) => {
    const wind = st.env?.weather?.wind || 0;
    const e = clamp(Math.round(Math.sin(t * 1.1 + 0.7) * 0.7 + Math.sin(t * 0.43) * 0.5 + wind * 0.05), -1, 1);
    let cx = x;
    for (let r = 0; r < len; r++) {
      if (r === 5 || r === 7) cx = x + (r === 5 ? (e > 0 ? 1 : e < 0 ? -1 : 0) : e);
      ctx.fillStyle = r % 3 === 2 ? '#9c9a92' : '#d6d4cc'; ctx.fillRect(cx, y + r, 1, 1);       // vit elkabel (vriden)
    }
    ctx.fillStyle = '#c0702e'; ctx.fillRect(cx - 1, y + len, 1, 1);
    ctx.fillStyle = '#e8a650'; ctx.fillRect(cx + 1, y + len, 1, 1); ctx.fillRect(cx, y + len + 1, 1, 1);
  });
}
// Skyltfönstrets kvällsljus UTAN att lägga ljus över text: glasrutan (och dess kant) minus
// lappar/skyltar som har text. Samma fyllning som reg.glows, men bitvis.
function rectMinus(r, holes) {
  let parts = [r];
  for (const [hx, hy, hw, hh] of holes) {
    const next = [];
    for (const [x, y, w, h] of parts) {
      const ix0 = Math.max(x, hx), iy0 = Math.max(y, hy), ix1 = Math.min(x + w, hx + hw), iy1 = Math.min(y + h, hy + hh);
      if (ix0 >= ix1 || iy0 >= iy1) { next.push([x, y, w, h]); continue; }
      if (iy0 > y) next.push([x, y, w, iy0 - y]);
      if (iy1 < y + h) next.push([x, iy1, w, y + h - iy1]);
      if (ix0 > x) next.push([x, iy0, ix0 - x, iy1 - iy0]);
      if (ix1 < x + w) next.push([ix1, iy0, x + w - ix1, iy1 - iy0]);
    }
    parts = next;
  }
  return parts;
}
function glassGlow(C, x, y, w, h, c, a, holes) {
  const inner = rectMinus([x, y, w, h], holes);
  const ring = [[x - 1, y - 1, w + 2, 1], [x - 1, y + h, w + 2, 1], [x - 1, y, 1, h], [x + w, y, 1, h]].flatMap((r) => rectMinus(r, holes));
  C.reg.glowFx.push((ctx, t, st, k) => {
    ctx.fillStyle = rgba(c, a * k * 0.4); for (const [rx, ry, rw, rh] of ring) ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = rgba(c, a * k); for (const [rx, ry, rw, rh] of inner) ctx.fillRect(rx, ry, rw, rh);
  });
}
// Butikens egen löpsedel (världskoordinater): en gatupratare i järn framför högra fönstret, fötterna
// en pixel ut på trottoaren. Tavlan är 30×15: två rader SMALL med luft runtom (KATTEN / HITTAD!).
function nbBoardGeo(b) {
  const W = 30, H = 15, X0 = b.door.x1 + 3, fy = baseOf(b) + 1;
  return { X0, W, H, fy, top: fy - 2 - H };
}
function nbBoardImg(G, snow, s) {
  const { X0, W, H, fy, top } = G, X1 = X0 + W - 1, B = top + H - 1;
  const P = new Pix(W + 4, H + 7, X0 - 2, top - 3);
  // skuggan på trottoaren under tavlan
  for (let x = X0 + 1; x < X1; x++) { P.px(x, fy - 1, 0x1a1422, 0.3); P.px(x, fy, 0x1a1422, 0.22); if (x > X0 + 2 && x < X1 - 2) P.px(x, fy + 1, 0x1a1422, 0.1); }
  // benen: det främre paret utåtställt, det bakre anas innanför
  for (const [x, c] of [[X0 + 4, 0x16181c], [X1 - 4, 0x16181c]]) { P.px(x, fy - 2, c); P.px(x, fy - 1, mix(c, 0x30363e, 0.4)); }
  P.px(X0 + 1, fy - 2, 0x4a525c); P.px(X0 + 2, fy - 2, 0x1e2228); P.px(X0, fy - 1, 0x30363e); P.px(X0 + 1, fy - 1, 0x1e2228);
  P.px(X1 - 2, fy - 2, 0x30363e); P.px(X1 - 1, fy - 2, 0x1e2228); P.px(X1 - 1, fy - 1, 0x30363e); P.px(X1, fy - 1, 0x1e2228);
  for (const x of [X0, X0 + 1, X1 - 1, X1]) P.px(x, fy, 0x0e0e12);                        // gummifötter
  P.px(X0 + 1, fy - 1, 0x7a4222); P.px(X1 - 1, fy, 0x5a3018);                              // rost på benen
  // järnramen: ljus överkant, mörk underkant med rost, slitna fläckar
  for (let i = 0; i < W; i++) {
    let t = hash(i, 1, s + 95) > 0.84 ? 0x6e7884 : 0x4a525c, u = 0x1e2228;
    const r = hash(i >> 1, 2, s + 96);
    if (r > 0.72) u = r > 0.9 ? 0xa45a2a : 0x7a4222;
    P.px(X0 + i, top, t); P.px(X0 + i, B, u);
  }
  for (let j = 1; j < H - 1; j++) { P.px(X0, top + j, j === 1 ? 0x4a525c : 0x30363e); P.px(X1, top + j, 0x1e2228); }
  P.px(X0, top, 0x6e7884); P.px(X1, B, 0x101216); P.px(X0, B, 0x7a4222);
  // papperet: tidningsvitt, gulnat och fuktigt nertill, skuggat under ramens läpp
  area(P, X0 + 1, top + 1, W - 2, H - 2, (X, Y, i, j) => {
    let c = qmix(0xf6f4ec, 0xe4dac0, (j - 8) / 4, X, Y, 3);
    if (j === 0) c = mul(c, 0.9); else if (i === 0) c = mul(c, 0.94);
    if (j === H - 3 && hash(X, Y, s + 97) > 0.78) c = 0xbcb2a0;                             // stänk från trottoaren
    return jit(c, X, Y, s + 98, 0.03);
  });
  // rubrikerna: svart och röd, röd med mörkare nederkant
  text(P, SMALL, 'KATTEN', X0 + 3, top + 2, 0x16161c);
  eachTextPixel(SMALL, 'HITTAD!', X0 + 2, top + 8, 1, (x, y) => P.px(x, y, y === top + 12 ? 0xa81414 : 0xd01c1c));
  // plastfickans blänk (i marginalen), klämmorna i överkant och ett hundöra nere till höger
  P.px(X0 + 1, top + 1, 0xffffff); P.px(X0 + 2, top + 1, 0xfcfcf8);
  P.px(X1 - 1, top + 3, 0xffffff, 0.7); P.px(X1 - 1, top + 4, 0xffffff, 0.45);
  for (const cx of [X0 + 6, X1 - 7]) { P.px(cx, top, 0xbcc4cc); P.px(cx + 1, top, 0x8e98a2); P.px(cx, top + 1, 0x8e98a2); P.px(cx + 1, top + 1, 0x646c76); }
  P.px(X1 - 1, B - 1, 0x8a867c); P.px(X1 - 2, B - 1, 0xd8d2c0); P.px(X1 - 1, B - 2, 0xd8d2c0);
  if (snow) snowCap(P, X0, top, W, s);
  return P.flush();
}
// y-sorterat föremål: tavlan ritas över husets sockel, och folk på trottoaren hamnar rätt framför den
const NB_ITEMS = {};
function nbItems(b, st) {
  const snow = (st?.env?.weather?.snowCover || 0) > 0.5 ? 1 : 0, key = b.id + ':' + snow;
  let L = NB_ITEMS[key];
  if (!L) {
    const G = nbBoardGeo(b), img = nbBoardImg(G, snow, seedOf(b.id));
    L = NB_ITEMS[key] = [{ x: G.X0 + (G.W >> 1), y: G.fy, draw: (ctx) => ctx.drawImage(img, G.X0 - 2, G.top - 3) }];
  }
  return L;
}
// Kartongskylt som hänger i rullgallret på två ståltrådar: KAFFE med svart tusch, avriven
// överkant där wellpappens räfflor syns, kaffestänk och en fuktfläck (inget av det rör texten).
// Bokstäverna darrar bara nedåt (in i marginalen), aldrig upp i rivkanten. Returnerar rutan
// (med trådarna och skuggan) för hålet i kvällsljuset.
function kaffeSign(Q, x, y, s) {
  const w = 22, h = 8;
  area(Q, x, y, w, h, (X, Y, i, j) => {
    if (i === w - 1 && j === h - 1) return null;                                            // avrivet hörn
    let c = jit(0xc49a64, X, Y, s + 93, 0.07);
    if (j === 0) c = (i & 1) ? 0xd6b27a : 0x9a7040;                                          // räfflorna i rivkanten
    else if (j === h - 1 || (i === w - 2 && j === h - 2)) c = mul(c, 0.76);
    else if (i === w - 1) c = mul(c, 0.84);
    else if (i === 0) c = mix(c, WHITE, 0.1);
    return c;
  });
  for (const hx of [x + 3, x + w - 4]) { Q.px(hx, y - 1, 0x9aa0a8); Q.px(hx, y, 0x2a2a30); }   // trådarna upp till kåpan
  for (const [i, j, a] of [[20, 1, 0.5], [20, 2, 0.35], [19, 6, 0.4], [18, 6, 0.25]]) Q.px(x + i, y + j, 0x7a4a22, a); // kaffestänk
  Q.px(x + 1, y + 6, mul(0xc49a64, 0.86)); Q.px(x + 2, y + 6, mul(0xc49a64, 0.9));           // fuktfläck
  let cx = x + 1;
  for (const ch of 'KAFFE') { text(Q, SMALL, ch, cx, y + 1 + (hash(cx, s, 94) > 0.66 ? 1 : 0), 0x1a1612); cx += textW(SMALL, ch) + 1; }
  Q.hl(x + 1, y + h, w - 1, 0x000000, 0.3); Q.vl(x + w, y + 1, h - 1, 0x000000, 0.22);        // skuggan
  return [x, y - 1, w + 1, h + 2];
}
// prislapp i självlysande gult med röd siffra, tejpad på glaset (tejpen bara i övre hörnen)
function prisLapp(Q, x, y, str) {
  const w = textW(SMALL, str) + 3, h = 7;
  area(Q, x, y, w, h, (X, Y, i, j) => (j === h - 1 ? 0xd8b830 : i === w - 1 ? 0xe8c83a : jit(0xfbe24a, X, Y, 99, 0.04)));
  Q.px(x, y, 0xfff4a0); Q.px(x + w - 1, y, 0xfff4a0, 0.9);                                  // tejpen
  text(Q, SMALL, str, x + 1, y + 1, 0xc81818);
  Q.hl(x + 1, y + h, w, 0x000000, 0.28); Q.vl(x + w, y + 1, h, 0x000000, 0.2);
  return [x, y, w + 1, h + 1];
}
// två trisslotter tejpade på glaset (utan text): gul och blå med silvrigt skrapfält
function trisslotter(Q, x, y) {
  for (const [tx, ty, c, lo] of [[x, y, 0xf0b429, 0xb88210], [x + 2, y + 1, 0x3a7bd5, 0x24509a]]) {
    Q.rect(tx, ty, 3, 5, c); Q.hl(tx, ty, 3, mix(c, WHITE, 0.35)); Q.hl(tx, ty + 4, 3, lo);
    Q.px(tx + 1, ty + 2, 0xc8ccd4); Q.px(tx + 1, ty + 3, 0x8a9098);
    Q.px(tx + 1, ty - 1, 0xe8e0b8, 0.85);                                                    // tejpen
  }
}
function paintNarbutik(b, night, opts) {
  const C = begin(b, night, opts);
  return shopRow(C, {
    trim: 0xc8b8a0, frame: 0xe8e4dc, cols: [C.L + 8, C.L + 30, C.L + 64, C.L + 86], firewalls: [1],
    special: { '3,0': { foil: true, curtain: null, blind: null }, '1,1': { lit: false, blind: null } }, // 1,1: fönster-AC (upper)
    wall: (P, x, y, w, h) => { bricks(P, x, y, w, h, 0x7a4a34, C.s, { bw: 6, bh: 3 }); for (let i = 0; i < w; i++) for (let j = 0; j < 6; j++) if (hash(i, j, 3) < (6 - j) * 0.08) P.px(x + i, y + 5 + j, 0x1a1410, 0.25); },
    roof(C) {
      const { P, L } = C;
      hvac(P, L + 58, 48, 26, 10, 7, { fan: false, rust: 3, col: 0xc0c4c8 });
      C.reg.fans.push({ x: L + 58 + 5, y: 50, speed: 9, ph: 0.1 }); C.reg.fans.push({ x: L + 58 + 15, y: 50, speed: 8, ph: 0.6 });
      text(P, SMALL, 'KYL', L + 62, 59, 0x3a3e46, 0.7);
      ventPipe(P, L + 20, 56, 8); ventPipe(P, L + 30, 60, 6, 0x8a9098);
      dish(P, L + 96, 60, { rust: true, r: 3 });
      birdsOn(C, L + 4, L + 50, C.FT - 1, 2);
    },
    upper(C) { // folie i ett fönster (någon sover på dagen) och en fönster-AC som droppar ner på ljuslådan
      const { P, L, FT } = C, x = L + 86 + 1, y = FT + 8 + 1;
      area(P, x, y, 12, 14, (X, Y) => { const n = hash(X, Y, 61); return n > 0.7 ? 0xf0f4f8 : n < 0.25 ? 0x8a9098 : 0xc0c6ce; });
      const ax = L + 30, ay = FT + 8 + 26 + 7;                              // nedre rutan i fönster 1,1
      P.hl(ax, ay, 14, 0xf2f0e8); P.px(ax, ay, 0xc8c6be); P.px(ax + 13, ay, 0xb0aea6);  // ovansidan
      area(P, ax, ay + 1, 14, 7, (X, Y, i, j) => {
        if (i === 0) return 0xe4e2da; if (i === 13) return 0x8e8c84;
        if (j === 6) return hash(X, Y, 62) > 0.6 ? 0x8a5a2a : 0x8e8c84;      // rostig underkant
        if (i >= 5 && i <= 11 && j >= 1 && j <= 5) return j % 2 ? 0x6e6c66 : 0xb8b6ae; // bakre gallret (lameller)
        return jit(j === 0 ? 0xe4e2da : 0xcecbc2, X, Y, 63, 0.05);
      });
      P.rect(ax + 1, ay + 2, 3, 2, 0x5a5e66); P.px(ax + 2, ay + 2, 0x8a9098);   // typskylten
      P.hl(ax, ay + 8, 14, 0x000000, 0.28);                                     // skugga på ramen
      streak(P, ax + 11, ay + 12, 3, 0x3a4a2a, 0.6, 5);                         // alger där kondensvattnet rinner
      C.reg.drips.push({ x: ax + 11, y: ay + 12, len: 3, ph: 0.3 });              // droppar ner på lådans tak
    },
    shop(C, gTop) {
      const { P, L, R, dx0, dx1, s } = C, night = C.night;
      // Lapparna med text sitter där ingenting står framför dem: i vänstra fönstret till vänster
      // om lyktstolpen (props.js lamp(1990, …), stolpen på x ≈ 1992), i högra ovanför butikens
      // löpsedel KATTEN HITTAD! (nbItems, ett y-sorterat föremål) – ingen text skymmer någon annan.
      const wy = 158, wh = 22;
      const BG = nbBoardGeo(b), board = [BG.X0 - C.box.x, BG.top - C.box.y, BG.W, BG.H];
      let kaffe = null, pris = null, glass = null;
      // vänstra fönstret: halvt nerdraget rullgaller med kartongskylten KAFFE på ståltråd, prislappen
      // 10:- under den, kassörskan bakom disken till höger och trisslotter/klistermärken bortom stolpen
      shopWin(C, L + 3, wy, dx0 - L - 7, wh, { lit: false, act: 'cashier', cx: 15, per: 8,   // kassörskans ansikte x 1985–1989
        back: (Q, gx, gy, gw, gh) => {
          area(Q, gx, gy, gw, gh, (X, Y, i, j) => jit(night ? qmix(0xf8f8f0, 0xd8dcd8, j / gh, X, Y, 3) : qmix(0x8a8c88, 0x5a5c5a, j / gh, X, Y, 3), X, Y, 72, 0.04));
          const dim = night ? 1 : 0.62;
          for (let r = 0; r < 3; r++) goodsRow(Q, gx + 1, gy + 5 + r * 5, gw - 2, s + r, dim);
          Q.hl(gx + (gw >> 1), gy, 6, mul(0xf0f4ff, dim));
        },
        front: (Q, gx, gy, gw, gh) => {
          // disken framför kassörskan (med kortterminalen), godisstället längst till vänster
          const kx = gx + 12, ky = gy + gh - 3;                                               // diskens ovansida
          Q.rect(kx, ky, 13, 3, 0x8a6a4a); Q.hl(kx, ky, 13, 0xb89a6a); Q.hl(kx, ky + 2, 13, 0x5a4432);
          Q.rect(kx + 1, ky - 2, 3, 2, 0x2a2a34); Q.hl(kx + 1, ky - 2, 3, 0x4a4a56); Q.px(kx + 2, ky - 1, 0x6fdc4c); // kortterminalen
          for (let i = 0; i < 11; i += 4) { const c = pick(PACKS, i, 3, 5); Q.rect(gx + i, gy + gh - 4, 3, 4, c); Q.hl(gx + i, gy + gh - 4, 3, mix(c, WHITE, 0.3)); } // godis
          Q.hl(gx, gy + gh - 5, 11, 0x6a6e78);                                                // godisställets hylla
          grille(Q, gx, gy, gw, 7, { box: false });
          kaffe = kaffeSign(Q, gx, gy - 1, s);                                                // hänger i gallret, x 1968–1989
          pris = prisLapp(Q, gx + 1, gy + 8, '10:-');                                         // under skylten, x 1969–1984
          trisslotter(Q, gx + 26, gy + 8);                                                    // till höger om lyktstolpen
          stickers(Q, gx + 26, gy + 14, 5, 5, 2, 5);
        },
      });
      grille(P, L + 3, wy, dx0 - L - 7, 0, {}); // gallrets kåpa
      // kvällsljuset i glaset läggs inte över kartongskylten eller prislappen
      if (night) glassGlow(C, L + 4, wy + 1, dx0 - L - 9, wh - 2, 0xf4f8ff, 0.3, [kaffe, pris]);
      // högra fönstret: hyllor och läskkylen, fasta galler, GLASS-lappen ovanför löpsedeln, kortmärken
      shopWin(C, dx1 + 4, wy, R - dx1 - 7, wh, { lit: false,
        back: (Q, gx, gy, gw, gh) => {
          area(Q, gx, gy, gw, gh, (X, Y, i, j) => jit(night ? qmix(0xf8f8f0, 0xd8dcd8, j / gh, X, Y, 3) : qmix(0x8a8c88, 0x5a5c5a, j / gh, X, Y, 3), X, Y, 73, 0.04));
          const dim = night ? 1 : 0.62;
          for (let r = 0; r < 4; r++) goodsRow(Q, gx + 1, gy + 5 + r * 5, gw - 12, s + 7 + r, dim);
          const fx = gx + gw - 10; // läskkylen lyser
          Q.rect(fx, gy + 1, 9, gh - 1, 0x2a2a34); area(Q, fx + 1, gy + 2, 7, gh - 3, (X, Y, i, j) => (j % 5 === 4 ? 0x8a9098 : pick([0xd8202a, 0x3a7bd5, 0xf0b429, 0x46a35a], i >> 1, j >> 2, 7)));
          Q.rect(fx + 1, gy + 2, 7, gh - 3, 0xe8f4ff, night ? 0.25 : 0.12);
          if (night) C.reg.glows.push([fx + 1, gy + 2, 7, gh - 3, 0xd8ecff, 0.35]);
        },
        front: (Q, gx, gy, gw, gh) => {
          for (let i = gx + 2; i < gx + gw; i += 4) Q.vl(i, gy, gh, 0x2a2a30); Q.hl(gx, gy + 7, gw, 0x2a2a30); Q.hl(gx, gy + 15, gw, 0x2a2a30);
          // GLASS-lappen högst upp (y 159–166), helt ovanför löpsedeln som börjar på y 170; tejpbitarna
          // sitter bara i hörnen utanför textens kolumner (en nål mitt över blev en accent: GLÁSS)
          const gn = note(Q, gx + 2, gy, ['GLASS'], { seed: 12, paper: 0xd8f0ff, ink: 0xd8202a, pad: 1, tape: false });
          for (const tx of [gn[0] - 1, gn[0] + gn[2] - 1]) Q.rect(tx, gn[1] - 1, 2, 2, 0xe8e0b8, 0.85);
          glass = [gn[0] - 1, gn[1] - 1, gn[2] + 2, gn[3] + 2];                              // + tejpen och skuggan
          // kortmärkena på glaset (utan text) – till höger om löpsedeln
          const kx = gx + gw - 6, ky = gy + gh - 10;
          Q.rect(kx - 1, ky - 1, 7, 5, 0xf4f4ee); Q.hl(kx - 1, ky + 3, 7, 0xc8c8c0);
          Q.px(kx + 1, ky, 0xd8202a); Q.px(kx + 2, ky, 0xf07a1a); Q.px(kx + 3, ky, 0xf0b429);
          Q.hl(kx, ky + 1, 2, 0xd8202a); Q.px(kx + 2, ky + 1, 0xf07a1a); Q.hl(kx + 3, ky + 1, 2, 0xf0b429);
          Q.px(kx + 1, ky + 2, 0xb81a22); Q.px(kx + 2, ky + 2, 0xd86a18); Q.px(kx + 3, ky + 2, 0xd89a20);
          Q.rect(kx, ky + 5, 6, 3, 0x2a4ab8); Q.hl(kx, ky + 5, 6, 0x4a6ad8); Q.hl(kx + 1, ky + 6, 3, 0xe8ecf4); Q.px(kx + 5, ky + 7, 0xf0b429);
        },
      });
      if (night) glassGlow(C, dx1 + 5, wy + 1, R - dx1 - 9, wh - 2, 0xf4f8ff, 0.3, [glass, board]); // GLASS-lappen och löpsedeln likaså
      // ljuslådan NÄRBUTIK 24/7 (nbSign) – efter fönstren, så att underkarmen ligger framför gallerkåpan
      const G = nbGeo(C, gTop);
      nbSign(P, G, C, night ? 'lit' : 'day');
      P.darken(G.x0, G.fy1 + 2, G.x1 - G.x0 + 1, 1, 0.72);                                        // lådans skugga på väggen
      for (let k = 0; k < 4; k++) { const rx = G.cable + 6 + Math.floor(hash(k, s, 76) * (G.x1 - G.cable - 10)); streak(P, rx, G.fy1 + 2, 2, 0x7a4222, 0.6, rx); } // rostrinningar
      if (C.snow) snowCap(P, G.x0, G.fy0 - 2, G.x1 - G.x0 + 1, s);
      nbLights(C, G);
      nbCable(C, G);
      birdsOn(C, L + 46, L + 62, G.fy0 - 2, 1);
      cctv(C, R - 7, gTop + 16, true);
      // (löpsedeln KATTEN HITTAD! är ett eget y-sorterat föremål – nbItems – så att sockeln
      //  inte målas över dess nederkant och folk som går förbi hamnar rätt framför/bakom den)
    },
  });
}
function paintPantbank(b, night, opts) {
  const C = begin(b, night, opts);
  return shopRow(C, {
    trim: 0xe8e0c8, frame: 0xf0ece0, cols: [C.L + 10, C.L + 52], firewalls: [-1, 1], puddles: 0, plinth: 0x4a3a34, tags: 2,
    wall: (P, x, y, w, h) => plaster(P, x, y, w, h, 0x9ab8a0, C.s, { patches: 3, soot: true }),
    lintel: (P, cx, wy) => { for (let k = 0; k < 4; k++) P.hl(cx + 7 - k * 2 - 2, wy - 4 + k, k * 4 + 4 > 18 ? 18 : k * 4 + 4, k === 0 ? 0xf8f4e8 : mix(0xe8e0c8, 0x9a9484, k * 0.2)); P.hl(cx - 2, wy - 1, 18, 0x8a8474); },
    roof(C) {
      const { P, L, FT } = C, W = C.b.w;
      // falsk front: trappstegsgavel med medaljong och årtal
      area(P, L + 14, FT - 12, W - 28, 12, (X, Y, i, j) => { const step = j < 4 ? (i >= 12 && i < W - 40) : true; return step ? jit(j === 0 || (j === 4 && (i < 12 || i >= W - 40)) ? 0xf8f4e8 : 0xd8d0b8, X, Y, 81, 0.05) : null; });
      P.ell(L + (W >> 1), FT - 7, 5, 4, 0xb8b09a, 1, 1); text(P, SMALL, '1912', L + (W >> 1) - 7, FT - 9, 0x6a6454, 0.9);
      P.darken(L + 14, FT - 12, W - 28, 1, 0.8);
      ventPipe(P, L + 8, 52, 8); dish(P, L + 60, 56, { r: 3 });
      birdsOn(C, L + 20, L + W - 20, FT - 12, 2, 'krake');
    },
    upper(C) { // larmklocka mellan fönstren
      const { P, L, FT } = C, x = L + 32, y = FT + 38;
      P.rect(x, y, 10, 8, 0xd8202a); P.bevel(x, y, 10, 8, 0xf05a5a, 0x8a1018); P.rect(x + 2, y + 2, 6, 3, 0x2a5ac8); text(P, SMALL, 'L', x + 4, y + 2, 0xffffff, 0.8);
      C.reg.leds.push({ x: x + 8, y: y + 6, c: 0x40ff60, rate: 0.5, ph: 0.2 });
    },
    shop(C, gTop) {
      const { P, L, R, BY, dx0, dx1, s } = C, night = C.night;
      // mörkröd träfront med speglar
      area(P, L, gTop + 1, R - L, BY - 5 - gTop - 1, (X, Y, i, j) => { let c = 0x5a1a24; if (i % 12 === 0) c = mix(c, WHITE, 0.15); else if (i % 12 === 11) c = mul(c, 0.6); return jit(c, X, Y, 91, 0.06); });
      // skylten: guld på svart
      const sy = gTop + 2;
      P.rect(L + 2, sy, R - L - 4, 11, 0x14121a); P.box(L + 1, sy - 1, R - L - 2, 13, 0xc8a040); P.hl(L + 2, sy + 11, R - L - 4, 0x000000, 0.3);
      const B = bits(BIG, 'PANTBANKEN');
      sign(P, B, L + ((R - L - B.w) >> 1), sy + 2, { fill: (i, j) => (j < 3 ? 0xf8d870 : 0xd8a830), shadow: 0x000000, lo: 0xa87a20 });
      if (night) C.reg.glows.push([L + 3, sy + 1, R - L - 6, 9, 0xffd870, 0.12]);
      // de tre guldkulorna
      const kx = dx1 + 3; P.hl(kx, gTop + 16, 12, 0x2a2a30); P.px(kx + 11, gTop + 17, 0x2a2a30);
      for (const [bx, by] of [[kx + 4, gTop + 21], [kx + 10, gTop + 21], [kx + 7, gTop + 26]]) { P.vl(bx, gTop + 17, by - gTop - 19, 0x3a3a40); P.ell(bx + 0.5, by + 0.5, 2.6, 2.6, 0xd8a830, 1, 1); P.px(bx - 1, by - 1, 0xfff0a0); P.px(bx, by - 1, 0xf8d870); P.px(bx + 1, by + 1, 0x8a6a20); }
      // skyltfönstren bakom kraftiga galler: gitarr, klockor, ringar, tv
      const wy = 158, wh = 22, dim = night ? 0.35 : 0.7;
      const velvet = (Q, gx, gy, gw, gh) => area(Q, gx, gy, gw, gh, (X, Y, i, j) => jit(mul(qmix(0x6a1a2a, 0x3a0a14, j / gh, X, Y, 3), dim / 0.7), X, Y, 92, 0.05));
      shopWin(C, L + 3, wy, dx0 - L - 7, wh, { frame: 0x2a1a1a,
        back: (Q, gx, gy, gw, gh) => {
          velvet(Q, gx, gy, gw, gh);
          // gitarr
          Q.ell(gx + 5, gy + gh - 5, 3.5, 3, mul(0xc8803a, dim / 0.7), 1, 1); Q.ell(gx + 5, gy + gh - 9, 2.5, 2, mul(0xc8803a, dim / 0.7), 1, 1); Q.px(gx + 5, gy + gh - 5, 0x1a1010);
          Q.vl(gx + 5, gy + 2, gh - 12, mul(0x5a3a1a, dim / 0.7)); Q.rect(gx + 4, gy + 1, 3, 2, mul(0x3a2a1a, dim / 0.7));
          // klockor och trumpet
          for (let k = 0; k < 3; k++) { Q.px(gx + 11 + k * 2, gy + 5, mul(0xf8d870, dim / 0.7)); Q.px(gx + 11 + k * 2, gy + 6, mul(0x8a8a90, dim / 0.7)); }
          Q.hl(gx + 10, gy + gh - 6, 6, mul(0xe8c050, dim / 0.7)); Q.rect(gx + 15, gy + gh - 8, 2, 4, mul(0xe8c050, dim / 0.7));
        },
        front: (Q, gx, gy, gw, gh) => {
          for (let i = gx + 1; i < gx + gw; i += 3) Q.vl(i, gy - 1, gh + 2, 0x1a1a1e); Q.hl(gx, gy + 6, gw, 0x1a1a1e); Q.hl(gx, gy + 14, gw, 0x1a1a1e);
          note(Q, gx + 1, gy + 7, ['KÖPER', 'GULD!'], { seed: 21, paper: 0xf8e060, ink: 0xa81a1a, tape: true });
        },
      });
      shopWin(C, dx1 + 4, wy, R - dx1 - 7, wh, { frame: 0x2a1a1a, act: 'clerk', hours: [10, 18], cx: 6,
        back: (Q, gx, gy, gw, gh) => {
          velvet(Q, gx, gy, gw, gh);
          Q.rect(gx + 1, gy + 3, 8, 6, mul(0x3a3a40, dim / 0.7)); Q.rect(gx + 2, gy + 4, 6, 4, mul(0x6a8aa8, dim / 0.7)); // gammal tv
          Q.hl(gx + (gw >> 1), gy, 5, night ? 0x3a3020 : 0xffe8a0);
        },
        front: (Q, gx, gy, gw, gh) => {
          Q.rect(gx, gy + gh - 5, gw, 5, 0x2a1a1a); Q.hl(gx, gy + gh - 5, gw, 0x5a3a2a);
          for (let k = 0; k < 4; k++) { Q.px(gx + 2 + k * 4, gy + gh - 6, pick([0xf8d870, 0xe8e8f0, 0xd8303a, 0x6ad0f0], k, 1, 2)); Q.px(gx + 2 + k * 4, gy + gh - 7, 0xf8d870); } // ringar på dynan
          for (let i = gx + 1; i < gx + gw; i += 3) Q.vl(i, gy - 1, gh + 2, 0x1a1a1e); Q.hl(gx, gy + 6, gw, 0x1a1a1e);
        },
      });
      if (night) { grille(P, L + 3, wy, dx0 - L - 7, wh, { a: 0.85 }); grille(P, dx1 + 4, wy, R - dx1 - 7, wh, { a: 0.85 }); } // nattgallret nere
      cctv(C, dx0 - 4, gTop + 14, true);
    },
  });
}
function paintKebab(b, night, opts) {
  const C = begin(b, night, opts);
  return shopRow(C, {
    trim: 0xd8c0b0, frame: 0xe0d8d0, cols: [C.L + 8, C.L + 34, C.L + 60], firewalls: [], roofCol: 0x6a625a, tags: 4,
    special: { '2,0': { blind: 'broken', curtain: null } },
    wall: (P, x, y, w, h) => panels(P, x, y, w, h, 0xc8a898, C.s, { pw: 22, ph: 26 }),
    roof(C) {
      const { P, L, FT } = C;
      // köksfläkten med svamphuv; rök ur den (grillen är trasig men fritösen går)
      const fx = L + 62, fy = 50;
      P.darken(fx + 12, fy + 2, 3, 12, 0.7);
      area(P, fx, fy + 4, 12, 10, (X, Y, i, j) => jit(i === 0 ? 0xd8dce4 : i === 11 ? 0x6a707a : 0xa8aeb8, X, Y, 95, 0.05));
      P.ell(fx + 6, fy + 3, 8, 3, 0x8a9098, 1, 2); P.hl(fx - 1, fy + 3, 14, 0xc8ccd4); P.hl(fx, fy + 4, 12, 0x3a3e46);
      streak(P, fx + 3, fy + 5, 8, 0x3a2a14, 0.55, 1); streak(P, fx + 8, fy + 5, 6, 0x3a2a14, 0.45, 2); // fettränder
      C.reg.smoke.push({ x: fx + 6, y: fy, n: 6, rate: 0.3, rise: 22, drift: 8, tone: 0xd8d4cc, alpha: 0.38, hours: [11, 24] });
      // kanalen ner längs fasaden
      const kx = L + 78; P.rect(kx, fy + 10, 5, FT - fy - 10, 0xa8aeb8); P.vl(kx, fy + 10, FT - fy - 10, 0xd8dce4); P.vl(kx + 4, fy + 10, FT - fy - 10, 0x6a707a);
      ventPipe(P, L + 14, 58, 7); dish(P, L + 36, 58, { rust: true, r: 3 });
      birdsOn(C, L + 4, L + 56, FT - 1, 3);
    },
    upper(C) { // köksfläktens kanal fortsätter ner till butiken, med fettfläck
      const { P, L, FT } = C, kx = L + 78;
      P.rect(kx, FT, 5, 140 - FT + 4, 0xa8aeb8); P.vl(kx, FT, 140 - FT + 4, 0xd8dce4); P.vl(kx + 4, FT, 140 - FT + 4, 0x6a707a);
      for (let y = FT + 6; y < 144; y += 12) { P.hl(kx - 1, y, 7, 0x5a5e68); P.hl(kx - 1, y + 1, 7, 0x8a8e98); }
      P.ell(kx + 2, 140, 7, 5, 0x3a2a14, 0.4, 3);
    },
    shop(C, gTop) {
      const { P, L, R, BY, dx0, dx1, s } = C, night = C.night;
      // röd fasadskiva som neonet sitter på
      area(P, L, gTop + 1, R - L, 16, (X, Y, i, j) => jit(j === 0 ? 0xc84038 : j === 15 ? 0x5a1410 : 0x8a2420, X, Y, 96, 0.06));
      P.hl(L, gTop + 17, R - L, 0x000000, 0.35);
      if (C.snow) snowCap(P, L, gTop + 1, R - L, s);
      const NB = bits(BIG, 'KEBAB', { x2: true, gap: 2 });
      neon(C, 'KEBAB', L + ((R - L - NB.w) >> 1), gTop + 2, 0xff4a3a, { x2: true, dead: 4, flick: 2, open: [11, 24], r: 4 });
      // fasaden under: vit kakel
      tilesWall(P, L, gTop + 18, R - L, BY - 5 - gTop - 18, 0xe8ecec, s);
      const wy = 160, wh = 20;
      // vänstra fönstret: grillspettet, kocken som torkar disken, menytavlan
      shopWin(C, L + 3, wy, dx0 - L - 7, wh, { lit: night, litCol: 0xfff0d0, act: 'wipe', frame: 0x5a3a2a,
        back: (Q, gx, gy, gw, gh) => {
          area(Q, gx, gy, gw, gh, (X, Y, i, j) => (night ? (i % 3 === 2 || j % 3 === 0 ? 0xd8d4c8 : 0xfaf6ea) : (i % 3 === 2 || j % 3 === 0 ? 0x6a6a66 : 0x8a8a84)));
          const dim = night ? 1 : 0.65;
          Q.rect(gx + 8, gy + 1, gw - 9, 6, mul(0x2a2a30, dim)); for (let k = 0; k < 3; k++) { Q.rect(gx + 9 + k * 5, gy + 2, 4, 2, mul(pick([0xc8844a, 0x6fdc4c, 0xf0b429], k, 2, 3), dim)); Q.hl(gx + 9 + k * 5, gy + 5, 3, mul(0xf0f0f0, dim)); } // menytavlan
        },
        front: (Q, gx, gy, gw, gh) => {
          Q.rect(gx, gy + gh - 5, gw, 5, 0xb8bcc4); Q.hl(gx, gy + gh - 5, gw, 0xe8ecf0); Q.hl(gx, gy + gh - 1, gw, 0x6a6e78);
          for (let k = 0; k < 3; k++) { Q.rect(gx + gw - 4 - k * 3, gy + gh - 8, 2, 3, [0xd8202a, 0xf0e8d0, 0x6fdc4c][k]); Q.px(gx + gw - 4 - k * 3, gy + gh - 9, 0x2a2a30); } // såsflaskor
        },
      });
      C.reg.spits.push({ x: L + 4, y: wy + 2 });
      C.reg.extra.push((ctx, t) => { // grillens värmeslinga knastrar ibland till (den är trasig)
        if (hash(Math.floor(t * 8), 3, 7) > 0.8) { ctx.fillStyle = 'rgba(255,90,40,0.85)'; ctx.fillRect(L + 12, wy + 5, 1, 10); ctx.fillStyle = 'rgba(255,200,120,0.5)'; ctx.fillRect(L + 13, wy + 7, 1, 6); }
      });
      // högra fönstret: bord, stolar, läskkyl och fönsterneonet GRILL (R:et är dött)
      shopWin(C, dx1 + 4, wy, R - dx1 - 7, wh, { lit: night, litCol: 0xfff0d0, frame: 0x5a3a2a,
        back: (Q, gx, gy, gw, gh) => {
          area(Q, gx, gy, gw, gh, (X, Y, i, j) => jit(night ? qmix(0xf8e8c8, 0xd8c09a, j / gh, X, Y, 3) : qmix(0x7a6a5a, 0x4a3e34, j / gh, X, Y, 3), X, Y, 97, 0.05));
          const dim = night ? 1 : 0.65;
          for (const tx of [gx + 2, gx + 12]) { Q.hl(tx, gy + gh - 7, 7, mul(0xd8d4cc, dim)); Q.vl(tx + 3, gy + gh - 6, 6, mul(0x5a5a60, dim)); Q.rect(tx - 1, gy + gh - 9, 2, 2, mul(0xd8202a, dim)); Q.rect(tx + 7, gy + gh - 9, 2, 2, mul(0xd8202a, dim)); }
          Q.rect(gx + gw - 5, gy + 2, 5, gh - 2, mul(0xd8202a, dim)); Q.rect(gx + gw - 4, gy + 4, 3, gh - 7, mul(0xf0f0f0, dim * 0.8));
        },
        front: (Q, gx, gy, gw, gh) => { stickers(Q, gx + 1, gy + gh - 6, gw - 2, 4, 3, 17); },
      });
      neon(C, 'GRILL', dx1 + 6, wy + 3, 0x3ae8ff, { small: true, flick: 1, dead: 3, open: [11, 24], r: 3 });
      // gatupratare med kritmeny och en överfull soptunna med pizzakartonger
      const ax = R - 24, ay = BY - 20;
      P.line(ax, BY - 1, ax + 3, ay, 0x6a4a2a); P.line(ax + 20, BY - 1, ax + 17, ay, 0x6a4a2a);
      area(P, ax + 2, ay, 17, 17, (X, Y, i, j) => (i === 0 || j === 0 || i === 16 || j === 16 ? 0x8a6a3a : jit(0x1e2a24, X, Y, 98, 0.08)));
      scrawl(P, SMALL, 'DAGENS', ax + 3, ay + 2, 0xf0f0e8, 1); scrawl(P, SMALL, 'RULLE', ax + 4, ay + 7, 0xffd23f, 2); scrawl(P, SMALL, '59:-', ax + 5, ay + 12, 0xff9ac8, 3);
      const tx = L + 1;
      P.rect(tx, BY - 12, 9, 12, 0x3a5a3a); P.hl(tx, BY - 12, 9, 0x5a7a5a); P.vl(tx + 8, BY - 11, 11, 0x2a3a2a);
      for (let k = 0; k < 3; k++) { P.rect(tx - 1 + k, BY - 15 - k * 2, 10, 2, 0xd8a840); P.hl(tx - 1 + k, BY - 15 - k * 2, 10, 0xf0c860); P.px(tx + 3 + k, BY - 14 - k * 2, 0xd8202a); }
    },
  });
}

// ======================= småhjälpare för de sista husen =======================
// stämpla en färdig Pix ovanpå husbilden (grannportar, extradörrar)
function stamp(P, S, x, y) {
  for (let j = 0; j < S.h; j++) for (let i = 0; i < S.w; i++) {
    const k = (j * S.w + i) * 4, a = S.d[k + 3];
    if (a) P.px(x + i, y + j, (S.d[k] << 16) | (S.d[k + 1] << 8) | S.d[k + 2], a / 255);
  }
}
// målad, stängd rullport med kåpa (grannportarna i garagelängan, lastkajen)
function shutRoll(P, x, y, w, h, col, o = {}) {
  const S = new Pix(w, h);
  rollLeaf(S, w, h, col, o);
  stamp(P, S, x, y);
  P.hl(x - 1, y - 3, w + 2, 0x8a8e98); P.hl(x - 1, y - 2, w + 2, 0x5a5e68); P.hl(x - 1, y - 1, w + 2, 0x3a3e46);
}
// vagn i tråd (kundvagn/tvättvagn), y = hjulens underkant
function wireCart(P, x, y, o = {}) {
  const c = o.col ?? 0x9aa0aa;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 7; j++) if (i % 2 === 0 || j % 2 === 0) P.px(x + i + (j < 3 ? 0 : 1), y - 9 + j, c);
  P.hl(x - 1, y - 10, 14, mix(c, WHITE, 0.35));
  P.line(x + 13, y - 10, x + 16, y - 13, mul(c, 0.75));
  P.px(x + 1, y - 1, 0x1a1a1e); P.px(x + 11, y - 1, 0x1a1a1e); P.hl(x, y - 2, 13, mul(c, 0.72));
  if (o.load) { P.rect(x + 3, y - 12, 4, 3, o.load); P.rect(x + 7, y - 11, 3, 2, mix(o.load, WHITE, 0.4)); }
}
// trädgårdstomte (y = underkant) – husvagnens stolthet
function gnome(P, x, y) {
  P.px(x + 1, y - 1, 0x3a5ac8); P.px(x + 2, y - 1, 0x3a5ac8);
  P.rect(x + 1, y - 3, 2, 2, 0x4a6ad8);
  P.rect(x, y - 4, 4, 2, 0xf0f0ea);
  P.px(x + 1, y - 5, 0xf2d0b0); P.px(x + 2, y - 5, 0xf2d0b0);
  P.px(x + 1, y - 6, 0xd8303a); P.px(x + 2, y - 6, 0xd8303a); P.px(x + 1, y - 7, 0xd8303a);
}
// gammal randig madrass som lutar mot väggen (y = underkant)
function mattress(P, x, y, s) {
  for (let j = 0; j < 22; j++) {
    const xx = x + Math.round(j * 0.25);
    for (let i = 0; i < 12; i++) {
      let c = ((i + (j >> 2)) % 6 < 3) ? 0xd8d2c0 : 0xb8c4cc;
      if (hash(xx + i, y - j, s) > 0.9) c = mul(c, 0.72);
      if (i === 0) c = mix(c, WHITE, 0.2); else if (i === 11) c = mul(c, 0.7);
      P.px(xx + i, y - 21 + j, c);
    }
  }
  P.hl(x + 6, y, 11, 0x000000, 0.25);
}
// kvarglömd fotboll (y = underkant)
function football(P, x, y) {
  P.ell(x + 2.5, y - 2.5, 2.6, 2.6, 0xe8e4da, 1, 1);
  P.px(x + 2, y - 3, 0x2a2a30); P.px(x + 3, y - 2, 0x2a2a30); P.px(x + 1, y - 1, 0x2a2a30);
  P.px(x + 1, y - 4, WHITE, 0.8);
}

// ======================= DET ÖVERGIVNA HUSET =======================
// Rivningskåk: hål i taket med bara takstolar, halvrasad skorsten, sot efter en
// köksbrand, igenspikade och krossade fönster, sned rivningsskylt, madrass mot
// väggen – och om natten ett par ögon i det mörka fönstret.
// MASKERADBUTIKEN (Carl 2026-10-06: "roliga fönster så man ser saker … halloween tema … massa
// halloween saker framför butiken och skelett"). Det gamla övergivna huset är renoverat: plommonlila
// puts, orange takfot, neonskylten MASKERAD, två skyltfönster som lever (spökdockan som svävar och
// pumplyktorna till vänster – häxkitteln som bubblar, svarta katten och fladdermössen till höger),
// en häxa på kvast som flyger förbi månen i vindsfönstret, en spindel i det andra och grön rök ur
// skorstenen. Pyntet på trottoaren (pumplyktor, gravsten, skelett) ritas av maskItems.
const MASK = { wall: 0x4a2a5a, dk: 0x2e1838, trim: 0xe8762a, trimDk: 0x9a4410, frame: 0x1a1420 };
let ATL = null;   // möbelatlasen (pumporna, kitteln, skelettet) – laddas först när den behövs
const atlas = () => { if (!ATL && typeof Image !== 'undefined') { ATL = new Image(); ATL.src = new URL('../../assets/interior.png', import.meta.url).href; } return ATL?.complete && ATL.naturalWidth ? ATL : null; };
function atlasDraw(ctx, name, x, y) { const A = atlas(), f = FRAMES[name]; if (A && f) ctx.drawImage(A, f[0], f[1], f[2], f[3], x, y, f[2], f[3]); }
function paintMaskerad(b, night, opts) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w, N = C.night;
  // ---- taket: mörkt papptak; skorstenen ryker grönt (häxkitteln kokar på vinden) ----
  gravelRoof(P, L, 40, W, FT - 40, s, { night: N, puddles: 1, col: 0x4a4452 });
  P.hl(L, 40, W, 0x6a6472); P.hl(L, 41, W, 0x3a3442);
  if (C.snow) snowRoof(P, L + 1, 42, W - 2, FT - 46, s);
  const kx = R - 30;
  area(P, kx, 28, 10, 22, (X, Y) => brickPx(X, Y, 0x6a4a5a, s + 5, { bw: 4, bh: 2 }));
  P.hl(kx - 1, 27, 12, 0x2a2030); P.hl(kx - 1, 28, 12, 0x4a3a4a);
  P.vl(kx, 29, 21, 0x8a6a7a); P.vl(kx + 9, 29, 21, 0x3a2a3a);
  C.reg.smoke.push({ x: kx + 5, y: 25, n: 6, rate: 0.2, rise: 22, drift: 5, grow: 3, tone: 0x8af08a, nightTone: 0x5ac86a, alpha: 0.5 });
  birdsOn(C, L + 6, kx - 6, 40, 2, 'krake');
  // ---- fasaden: lila puts, orange takfot, mörkare sockel ----
  plaster(P, L, FT, W, BY - FT, MASK.wall, s + 7);
  rows(P, L, FT, W, [mix(MASK.trim, WHITE, 0.35), MASK.trim, MASK.trimDk, mul(MASK.wall, 0.6)]);
  for (let x = L + 3; x < R - 2; x += 6) { P.px(x, FT + 4, MASK.trimDk); P.px(x + 1, FT + 5, mul(MASK.trimDk, 0.8)); } // tandlist
  for (let y = FT; y < BY; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.14)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.7)); }
  plinth(P, L, BY - 4, W, 4, 0x2a2030, s + 12);
  // spindelnät i övre hörnen
  for (const [cx, dir] of [[L + 1, 1], [R - 2, -1]]) {
    for (let r = 2; r < 12; r++) { P.px(cx + dir * r, FT + 6, 0xe8ecf0, 0.55); P.px(cx, FT + 6 + r, 0xe8ecf0, 0.55); P.px(cx + dir * Math.round(r * 0.7), FT + 6 + Math.round(r * 0.7), 0xe8ecf0, 0.55); }
    for (const rr of [5, 9]) for (let k = 0; k <= rr; k++) { const t = k / rr; P.px(cx + dir * Math.round(rr * (1 - t)), FT + 6 + Math.round(rr * t) + (k > 0 && k < rr ? 1 : 0), 0xe8ecf0, 0.45); }
  }
  // ---- övervåningen: två spetsbågade fönster och ett runt vindsfönster med en pumpa ----
  const uy = FT + 11, uw = 22, uh = 22, ux = [L + 10, R - 10 - uw];
  for (const x of ux) gothicWindow(P, x, uy, uw, uh, N);
  C.reg.ledges.push([ux[0] - 1, uy + uh + 1, uw + 2], [ux[1] - 1, uy + uh + 1, uw + 2]);
  const ocx = L + (W >> 1), ocy = FT + 20;
  for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) { const d = Math.hypot(x, y); if (d <= 8) P.px(ocx + x, ocy + y, d > 6.6 ? MASK.frame : d > 5.6 ? MASK.trim : 0x1e1228); }
  miniPumpkin(P, ocx - 4, ocy - 3, false);
  C.reg.glows.push([ocx - 3, ocy - 1, 6, 3, 0xffb040, 0.6]);
  // ---- skylten: neon MASKERAD på en mörk bräda, och UTKLÄDNAD + HALLOWEEN under ----
  const sy0 = BY - 60, sy1 = BY - 42;
  P.rect(L + 4, sy0, W - 8, sy1 - sy0, 0x1e1228); P.box(L + 4, sy0, W - 8, sy1 - sy0, MASK.trim); P.box(L + 5, sy0 + 1, W - 10, sy1 - sy0 - 2, MASK.trimDk);
  const NB = bits(BIG, 'MASKERAD');
  neon(C, 'MASKERAD', L + ((W - NB.w) >> 1), sy0 + 5 + NB.up, 0xff8a2a, { flick: 5 });
  const sub = 'UTKLÄDNAD + HALLOWEEN', sw = textW(SMALL, sub);
  text(P, SMALL, sub, L + ((W - sw) >> 1), sy1 + 2, 0xc8f070);
  // fladdermöss som hänger under skylten (de flaxar till ibland – live)
  const bats = [[L + 14, sy1 + 9], [R - 18, sy1 + 9]];
  // ---- skyltfönstren ----
  const { dx0, dx1 } = C, wy = BY - 33, wh = 27;
  const W1 = { x: L + 4, w: dx0 - 4 - (L + 4) }, W2 = { x: dx1 + 4, w: R - 4 - (dx1 + 4) };
  for (const w of [W1, W2]) displayWindow(P, w.x, wy, w.w, wh, N);
  C.reg.ledges.push([W1.x - 2, wy + wh + 2, W1.w + 4], [W2.x - 2, wy + wh + 2, W2.w + 4]);
  // markisen över dörren: lila med orange fransar
  for (let x = dx0 - 3; x < dx1 + 3; x++) for (let y = 0; y < 5; y++) P.px(x, BY - 37 + y, y === 4 ? ((x & 1) ? MASK.trim : MASK.trimDk) : ((x >> 2) & 1 ? MASK.dk : 0x6a3a7a));
  P.hl(dx0 - 3, BY - 37, dx1 - dx0 + 6, 0x8a5a9a);
  // dörren (ritas av live) och tröskeln
  const dT = BY - DOOR_ART[b.kind].h;
  P.rect(dx0 - 2, dT - 2, dx1 - dx0 + 4, BY - dT + 2, MASK.frame); P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  P.rect(dx0 - 3, BY, dx1 - dx0 + 6, 2, 0x4a3a50); P.hl(dx0 - 3, BY, dx1 - dx0 + 6, 0x6a5a70);
  drainpipe(C, L + 2, FT + 3, BY, { col: 0x3a3048 });
  footShadow(P, L, W, BY);
  weeds(P, L + 5, BY - 1, 2, s + 19); weeds(P, R - 6, BY - 1, 2, s + 21);
  // ---- det som rör sig (canvasens koordinater) ----
  const t0 = hash(s, 1, 2) * 10;
  C.reg.extra.push((ctx, t) => {
    // vänster fönster: spökdockan som svävar, pumplyktor på hyllan
    ctx.save(); ctx.beginPath(); ctx.rect(W1.x, wy, W1.w, wh); ctx.clip();
    ghost(ctx, W1.x + 9, wy + 4 + Math.round(Math.sin(t * 1.6) * 2), t);
    atlasDraw(ctx, 'pumplyktaL0', W1.x + W1.w - 19, wy + wh - 16);
    ctx.restore();
    // höger fönster: kitteln bubblar, katten blinkar, fladdermöss flaxar
    ctx.save(); ctx.beginPath(); ctx.rect(W2.x, wy, W2.w, wh); ctx.clip();
    atlasDraw(ctx, 'haxkittel' + (Math.floor(t * 3) % 3), W2.x + 3, wy + wh - 17);
    cat(ctx, W2.x + W2.w - 9, wy + wh - 2, t);
    for (let k = 0; k < 2; k++) { const u = (t * 0.35 + k * 0.5 + t0) % 1; bat(ctx, W2.x + Math.round(u * (W2.w + 8)) - 4, wy + 4 + k * 4 + Math.round(Math.sin(t * 5 + k) * 1.5), t + k); }
    ctx.restore();
    // vindsfönstret till vänster: en häxa på kvast flyger förbi månen var tionde sekund
    const v = ((t + t0) % 10) / 10;
    if (v < 0.4) { ctx.save(); ctx.beginPath(); ctx.rect(ux[0] + 1, uy + 3, uw - 2, uh - 4); ctx.clip(); witch(ctx, ux[0] - 10 + Math.round(v / 0.4 * (uw + 20)), uy + 9 + Math.round(Math.sin(v * 12) * 1)); ctx.restore(); }
    // vindsfönstret till höger: spindeln klättrar upp och ner
    const sp = (Math.sin(t * 0.7 + t0) + 1) / 2, sx2 = ux[1] + uw - 7, syy = uy + 4 + Math.round(sp * (uh - 10));
    ctx.fillStyle = 'rgba(232,236,240,0.7)'; ctx.fillRect(sx2 + 1, uy + 2, 1, syy - uy - 2);
    ctx.fillStyle = '#1c1820'; ctx.fillRect(sx2, syy, 3, 2); ctx.fillRect(sx2 - 1, syy + 1, 5, 1); ctx.fillRect(sx2 - 1, syy - 1, 1, 1); ctx.fillRect(sx2 + 3, syy - 1, 1, 1);
    // fladdermössen under skylten slår med vingarna ibland
    for (const [bx, by] of bats) bat(ctx, bx, by, Math.floor(t * 0.5 + bx) % 3 === 0 ? t : 0.0, true);
  });
  C.reg.glows.push([W1.x, wy, W1.w, wh, 0xffa040, 0.32], [W2.x, wy, W2.w, wh, 0x8af08a, 0.22]);
  C.reg.glowFx.push((ctx, t, st, k) => {
    // pumplyktan i fönstret och kittelns gröna sken fladdrar
    const f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 4.3);
    ctx.fillStyle = rgba(0xffb040, 0.35 * k * f); ctx.fillRect(W1.x + W1.w - 18, wy + wh - 13, 14, 9);
    ctx.fillStyle = rgba(0x8af08a, 0.3 * k * f); ctx.fillRect(W2.x + 2, wy + wh - 20, 20, 8);
  });
  return finish(C);
}
// spetsbågat fönster med mörk himmel och en måne (häxan och spindeln ritas levande)
function gothicWindow(P, x, y, w, h, night) {
  const cx = x + (w >> 1);
  for (let j = -2; j < h + 2; j++) for (let i = -2; i < w + 2; i++) {
    const X = x + i, Y = y + j;
    const arch = j < 8 ? Math.abs(i + 0.5 - w / 2) <= (w / 2) * Math.sqrt(Math.max(0, 1 - ((8 - j) / 9) ** 2)) + (j < 0 ? -1 : 0) : true;
    const archO = j < 8 ? Math.abs(i + 0.5 - w / 2) <= (w / 2 + 2) * Math.sqrt(Math.max(0, 1 - ((8 - j) / 11) ** 2)) : true;
    if (!archO) continue;
    if (!arch || i < 0 || i >= w || j >= h) { P.px(X, Y, MASK.frame); continue; }
    let c = mix(0x1e2a5a, 0x4a3a7a, j / h);
    if (Math.hypot(i - (w - 7), j - 7) < 3.5) c = 0xf4ecc0;                       // månen
    else if (hash(i, j, 77) > 0.94) c = 0xd8d8f0;                                // stjärnor
    P.px(X, Y, night ? c : mix(c, 0x8a9ac8, 0.25));
  }
  P.vl(cx, y + 2, h - 2, MASK.frame); P.hl(x, y + 12, w, MASK.frame);
  P.hl(x - 2, y + h + 1, w + 4, MASK.trim); P.hl(x - 2, y + h + 2, w + 4, MASK.trimDk);
}
// skyltfönster: mörk butik inne, en orange duk på hyllan och prislappar
function displayWindow(P, x, y, w, h, night) {
  P.rect(x - 2, y - 2, w + 4, h + 4, MASK.frame); P.box(x - 1, y - 1, w + 2, h + 2, MASK.trim);
  area(P, x, y, w, h, (X, Y, i, j) => qmix(0x3a2448, 0x1a1020, j / h, X, Y, 3));
  P.rect(x, y + h - 4, w, 4, 0xc85a1a); P.hl(x, y + h - 4, w, 0xf08a3a);
  for (let i = 0; i < w; i += 3) P.px(x + i, y + h - 1, 0x8a3a10);
  P.hl(x - 2, y + h + 2, w + 4, 0x6a5a70); P.hl(x - 2, y + h + 3, w + 4, 0x3a2a40);
  // glasets blänk
  for (let k = 0; k < 6; k++) P.px(x + 2 + k, y + 2 + k, 0xffffff, 0.18);
}
// liten pumpa (8×6) till vindsfönstret
function miniPumpkin(P, x, y) {
  ['..gg....', '.oooooo.', 'oyoooyoo', 'oooyoooo', 'oyyyyyoo', '.oooooo.'].forEach((r, j) => { for (let i = 0; i < 8; i++) { const ch = r[i]; if (ch === '.') continue; P.px(x + i, y + j, ch === 'g' ? 0x4a5a1e : ch === 'y' ? 0xffd23f : 0xe0701c); } });
}
// spöket i skyltfönstret: ett lakan med svarta ögon och en fladdrande fåll (10×14)
function ghost(ctx, x, y, t) {
  const rows = ['...oooo...', '..owwwwo..', '.owwwwwwo.', '.owkwwkwo.', '.owkwwkwo.', '.owwwwwwo.', '.owwkkwwo.', 'owwwwwwwwo', 'owwwwwwwwo', 'owwwwwwwwo', 'owwwwwwwwo', 'owwwwwwwwo'];
  rows.forEach((r, j) => { for (let i = 0; i < 10; i++) { const ch = r[i]; if (ch === '.') continue; ctx.fillStyle = ch === 'o' ? '#6a6a80' : ch === 'k' ? '#1c1820' : '#f4f6fa'; ctx.fillRect(x + i, y + j, 1, 1); } });
  const ph = Math.floor(t * 4) % 2;
  for (let i = 0; i < 10; i++) { const d = ((i + ph) % 3 === 0) ? 1 : 0; ctx.fillStyle = '#f4f6fa'; ctx.fillRect(x + i, y + 12, 1, 1 + d); ctx.fillStyle = '#6a6a80'; ctx.fillRect(x + i, y + 13 + d, 1, 1); }
}
// svarta katten (sitter, svansen viftar, ögonen blinkar)
function cat(ctx, x, y, t) {
  ctx.fillStyle = '#141018';
  ctx.fillRect(x - 3, y - 7, 6, 7); ctx.fillRect(x - 2, y - 11, 5, 4); ctx.fillRect(x - 2, y - 12, 1, 1); ctx.fillRect(x + 2, y - 12, 1, 1);
  const tw = Math.round(Math.sin(t * 2.2) * 2); ctx.fillRect(x + 3, y - 2, 2, 1); ctx.fillRect(x + 5, y - 4 + tw, 1, 3);
  if ((t % 4) > 0.15) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 1, y - 10, 1, 1); ctx.fillRect(x + 1, y - 10, 1, 1); }
}
// fladdermus (5×3), vingarna upp/ner
function bat(ctx, x, y, t, hang = false) {
  ctx.fillStyle = '#1c1428';
  if (hang) { ctx.fillRect(x, y - 3, 1, 3); ctx.fillRect(x - 1, y, 3, 2); if (t) { ctx.fillRect(x - 3, y - 1, 2, 1); ctx.fillRect(x + 2, y - 1, 2, 1); } return; }
  const up = Math.floor(t * 8) % 2;
  ctx.fillRect(x + 1, y, 3, 2);
  if (up) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x + 4, y - 1, 1, 1); } else { ctx.fillRect(x - 1, y + 1, 2, 1); ctx.fillRect(x + 4, y + 1, 2, 1); }
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 2, y, 1, 1);
}
// häxan på kvasten (siluett)
function witch(ctx, x, y) {
  ctx.fillStyle = '#141018';
  ctx.fillRect(x, y + 3, 12, 1);                         // kvasten
  ctx.fillRect(x - 3, y + 2, 3, 3);                      // riset
  ctx.fillRect(x + 5, y - 1, 3, 4);                      // kroppen
  ctx.fillRect(x + 6, y - 3, 2, 2);                      // huvudet
  ctx.fillRect(x + 5, y - 4, 4, 1); ctx.fillRect(x + 6, y - 6, 2, 2); ctx.fillRect(x + 7, y - 7, 1, 1); // hatten
  ctx.fillRect(x + 3, y + 1, 2, 1);                      // kappan fladdrar
}

// Pyntet på trottoaren framför maskeradbutiken (världens koordinater, y-sorterat med folket):
// en pumplykta och en gravsten till vänster om dörren, skelettet och en pumplykta till höger.
// Pumplyktorna lyser på kvällen (de tända rutorna ur atlasen + ett sken i glow).
function maskSpots(b) {
  const by = baseOf(b), d0 = b.door.x0, d1 = b.door.x1;
  return [
    { name: 'gravsten1', x: d0 - 24, y: by + 4 },
    { name: 'pumplykta0', lit: true, x: d0 - 40, y: by + 7 },
    { name: 'pumplykta2', lit: true, x: d1 + 8, y: by + 8 },
    { name: 'skelett0', x: d1 + 27, y: by + 4 },
  ].filter((it) => it.x > b.x - 4 && it.x < b.x + b.w + 4);
}
function maskItems(b, st) {
  const lit = (st.env?.dark ?? (st.night ? 0.5 : 0)) > 0.15;
  return maskSpots(b).map((it) => {
    const f = FRAMES[it.name] || [0, 0, 16, 16], w = f[2], h = f[3];
    return { x: it.x + (w >> 1), y: it.y, draw: (ctx) => {
      ctx.fillStyle = 'rgba(20,12,28,0.25)'; ctx.fillRect(it.x + 1, it.y - 1, w - 2, 2);
      atlasDraw(ctx, it.lit && lit ? it.name.replace('pumplykta', 'pumplyktaL') : it.name, it.x, it.y - h);
    } };
  });
}
function maskObstacles(b) {
  return maskSpots(b).map((it) => { const f = FRAMES[it.name] || [0, 0, 16, 16]; return [it.x, it.y - 4, it.x + f[2], it.y + 1]; });
}

// ======================= BILVERKSTAN =======================
// Plåthall med trapetstak, ljusinsläpp, taljan över porten, däckstaplar,
// oljefat, oljefläckar på marken och platschefen i kontorsfönstret.
function paintBilverkstad(b, night, opts) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w, N = C.night;
  const { dx0, dx1 } = C, dT = BY - DOOR_ART[b.kind].h; // rullporten är 44 hög
  // ---- taket: trapetsplåt med kanalplast och två snurrande huvar ----
  corrugated(P, L, 40, W, FT - 40, 0x67717c, s, { per: 4, rust: 0.5, sheet: 15 });
  P.hl(L, 40, W, 0x9aa4ae); P.hl(L, 41, W, 0x4a545e);
  for (const sx of [L + 44, L + 96]) {
    area(P, sx, 48, 22, FT - 58, (X, Y, i, j) => { let c = N ? qmix(0x2a3448, 0x18202e, j / (FT - 58), X, Y, 3) : qmix(0xd8e4ea, 0x8aa0ae, j / (FT - 58), X, Y, 3); if (i % 4 === 0) c = mul(c, 0.85); return c; });
    P.box(sx - 1, 47, 24, FT - 56, 0x3a444e);
  }
  ventPipe(P, L + 20, 44, 8);
  C.reg.smoke.push({ x: L + 21, y: 44, n: 4, rate: 0.3, rise: 14, tone: 0xcac4ba, nightTone: 0x6a6e7a, alpha: 0.3, hours: [7, 18] });
  for (const [tx, ph] of [[L + 76, 0.1], [L + 128, 0.6]]) C.reg.fans.push({ x: tx, y: 44, turbine: true, speed: 6, ph });
  if (C.snow) { snowRoof(P, L + 2, 43, 38, FT - 50, s); snowRoof(P, L + 122, 44, W - 128, FT - 52, s + 1); }
  birdsOn(C, L + 8, L + 40, 40, 2);
  // ---- fasaden: plåt – hallen till vänster, kontorsdelen till höger ----
  corrugated(P, L, FT, W, BY - FT - 4, 0x7c8c9c, s + 2, { per: 4, rust: 0.75, sheet: 16 });
  rows(P, L, FT, W, [0xa8b4c0, 0x6a7684, mul(0x6a7684, 0.6)]);
  plinth(P, L, BY - 4, W, 4, 0x5a564e, s + 3);
  for (let y = FT; y < BY; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.15)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.72)); }
  // skylt över porten med två spotlights
  plate(P, dx0 - 10, FT + 8, 76, 15, 0x2a4a8a, { rust: 2, fade: true });
  signText(P, BIG, 'BILVERKSTAN', dx0 - 4, FT + 12, 0xf0f4f8, { shadow: 0x101a2e });
  for (const lx of [dx0 - 6, dx0 + 58]) { P.rect(lx - 1, FT + 3, 3, 2, 0x2a2e36); P.rect(lx - 1, FT + 5, 3, 2, N ? 0xffe8a8 : 0xd8d4c8); if (N) C.reg.glows.push([lx - 1, FT + 5, 3, 2, 0xffe8b0, 0.9]); }
  if (N) C.reg.glows.push([dx0 - 10, FT + 8, 76, 15, 0xffd890, 0.12]);
  // porten: spår, varningsränder; själva rullporten ritas av live
  P.rect(dx0 - 3, dT - 5, dx1 - dx0 + 6, BY - dT + 5, 0x4a545e);
  P.hl(dx0 - 3, dT - 5, dx1 - dx0 + 6, 0x8a94a0); P.hl(dx0 - 3, dT - 2, dx1 - dx0 + 6, 0x2a343e);
  P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  for (let j = 0; j < 8; j++) { P.px(dx0 - 3, BY - 1 - j, ((j >> 1) & 1) ? 0x1a1a20 : 0xd8b020); P.px(dx1 + 2, BY - 1 - j, ((j >> 1) & 1) ? 0x1a1a20 : 0xd8b020); }
  // taljan: balken ovanför porten med kätting och krok
  P.rect(dx0 + 8, dT - 13, 30, 3, 0x3a3e46); P.hl(dx0 + 8, dT - 13, 30, 0x6a707c);
  P.vl(dx0 + 20, dT - 10, 6, 0x2a2e36); for (let j = 0; j < 6; j += 2) P.px(dx0 + 21, dT - 10 + j, 0x8a8e98);
  P.px(dx0 + 20, dT - 4, 0xd8b020); P.px(dx0 + 21, dT - 3, 0xd8b020);
  // trådglasfönster in mot hallen (vänster om porten)
  win(P, L + 3, dT + 4, 16, 14, { night: N, frame: 0x4a545e, bars: true, transom: false, curtain: null, dirt: 1, seed: 6 }, C.reg);
  // kontoret: platschefen, pärmar, prislappar
  shopWin(C, L + 116, dT + 2, 40, 24, { frame: 0x3a444e, lit: N, litCol: 0xfff0c8, act: 'clerk', hours: [7, 18], cx: 4,
    back: (Q, gx, gy, gw, gh) => {
      area(Q, gx, gy, gw, gh, (X, Y, i, j) => jit(N ? qmix(0xf0e8d0, 0xc8b890, j / gh, X, Y, 3) : qmix(0x6a6254, 0x453e34, j / gh, X, Y, 3), X, Y, 31, 0.05));
      const dim = N ? 1 : 0.6;
      Q.rect(gx + 1, gy + 2, 10, 7, mul(0xe8e4da, dim)); for (let r = 0; r < 3; r++) Q.hl(gx + 2, gy + 3 + r * 2, 8 - r * 2, mul(0x8a4a2a, dim));
      Q.rect(gx + gw - 9, gy + 2, 8, 6, mul(0xf0f0ea, dim)); Q.px(gx + gw - 6, gy + 4, mul(0xd8303a, dim));
      Q.hl(gx + 4, gy + gh - 6, gw - 8, mul(0x8a6a4a, dim));
    },
    front: (Q, gx, gy) => {
      note(Q, gx + 1, gy + 2, ['DÄCK', '250:-'], { seed: 32, paper: 0xfff8d0, ink: 0x1a3a8a });
    } });
  note(P, dx1 + 6, dT + 2, ['ÖPPET', '7-18'], { seed: 33, paper: 0xf0f8ff, ink: 0x8a2020 });
  // däckstaplar, oljefat, lastpallar och en moped till salu
  tires(P, L + 4, BY - 1, 4, s + 7); tires(P, L + 17, BY - 1, 3, s + 8);
  barrel(P, dx1 + 5, BY - 1, 0x3a6a4a); barrel(P, dx1 + 14, BY - 1, 0x8a3a2a);
  pallets(P, R - 22, BY - 1, 2);
  bike(P, R - 42, BY - 1, s + 9); note(P, R - 44, BY - 17, ['SÄLJES'], { seed: 34, paper: 0xfff8d0 });
  tag(P, L + 26, dT - 16, 'BTG', 0xffd23f, s + 10); stencil(P, dx1 + 26, dT - 14, 'pil', 0xd8d0c0, 0.7);
  cctv(C, R - 8, FT + 10, true);
  drainpipe(C, L + 1, FT + 3, BY, {}); drainpipe(C, R - 4, FT + 3, BY, { gap: [FT + 30, FT + 44] });
  footShadow(P, L, W, BY);
  decal(C, W, 18, (G) => {
    oilStain(G, dx0 - L + 18, 6, 10, 3, s); oilStain(G, dx0 - L + 40, 11, 7, 2.5, s + 1); oilStain(G, 22, 10, 5, 2, s + 2);
    litter(G, 4, 1, W - 8, 6, s + 3);
  });
  return finish(C);
}

// ======================= TVÄTTERIET =======================
// Två våningar bostäder över ett kaklat tvätteri: ljuslåda som halvblinkar,
// snurrande trummor i fönstret (en är trasig), ångskorsten som väller,
// vikbord, tvättvagn och en lodrät flaggskylt.
function paintTvatteri(b, night, opts) {
  const C = begin(b, night, opts);
  return shopRow(C, {
    trim: 0xb8c8d0, frame: 0xe8f0f4, cols: [C.L + 8, C.L + 34, C.L + 64, C.L + 90], firewalls: [-1, 1], roofCol: 0x6a6e6a,
    special: { '2,0': { blind: 'broken', curtain: null }, '0,1': { ac: true } },
    wall: (P, x, y, w, h) => plaster(P, x, y, w, h, 0x9ab4c0, C.s, { patches: 2 }),
    roof(C) {
      const { P, L, FT } = C;
      // ångskorstenen: här väller det vitt hela öppettiden
      const ax = L + 70;
      P.rect(ax, 46, 7, FT - 46, 0xb8bec6); P.vl(ax, 46, FT - 46, 0xe0e6ec); P.vl(ax + 6, 46, FT - 46, 0x788088);
      P.rect(ax - 1, 44, 9, 2, 0x8a9098); P.hl(ax - 1, 44, 9, 0xc8ced6);
      streak(P, ax + 2, 52, 10, 0x8a8e96, 0.5, 1);
      C.reg.smoke.push({ x: ax + 3, y: 43, n: 7, rate: 0.4, rise: 26, drift: 10, grow: 4, tone: 0xf2f4f6, nightTone: 0x9aa2b4, alpha: 0.5, hours: [8, 20] });
      C.reg.fans.push({ x: L + 30, y: 47, turbine: true, speed: 7, ph: 0.4 });
      ventPipe(P, L + 14, 52, 7); dish(P, L + 50, 58, { r: 3 });
      birdsOn(C, L + 6, L + 60, C.FT - 1, 2);
    },
    shop(C, gTop) {
      const { P, L, R, BY, dx0, dx1, s } = C, night = C.night;
      tilesWall(P, L, gTop + 14, R - L, BY - 5 - gTop - 14, 0xd8e8ec, s + 1);
      // ljuslådan: TVÄTTERI – bortre halvan blinkar trött
      const sy = gTop + 2, sw = R - L - 4;
      area(P, L + 2, sy, sw, 11, (X, Y, i, j) => jit(j === 0 ? 0xffffff : j === 10 ? 0xb0b4b8 : night ? (i > sw * 0.55 ? 0xa8aca8 : 0xf8fbff) : 0xeef2f4, X, Y, 41, 0.03));
      P.box(L + 1, sy - 1, sw + 2, 13, 0x3a444e); P.hl(L + 2, sy + 11, sw, 0x000000, 0.3);
      const B = bits(BIG, 'TVÄTTERI', { bold: true });
      sign(P, B, L + ((sw - B.w) >> 1) + 2, sy + 3, { fill: 0x2a6ac8, hi: 0x5a9ae8, lo: 0x1a4a98, shadow: 0x8a8a8a, sx: 1, sy: 1, sa: 0.4 });
      for (const [bx, ci] of [[L + 7, 0], [L + 12, 1], [R - 12, 0], [R - 17, 1]]) { P.ell(bx, sy + 5 - ci, 2 + ci, 2 + ci, 0x7ac8e8, 0.9, 2); P.px(bx - 1, sy + 4 - ci, 0xffffff, 0.8); }
      if (night) { C.reg.glows.push([L + 2, sy, Math.round(sw * 0.55), 11, 0xeaf6ff, 0.4]); C.reg.flick.push({ x: L + 2 + Math.round(sw * 0.55), y: sy, w: Math.round(sw * 0.45), h: 11, c: 0xeaf6ff, a: 0.35, mode: 'flick' }); }
      if (C.snow) snowCap(P, L + 1, sy - 1, sw + 2, s);
      // hängande flaggskylt: TVÄTT lodrätt, lyser blåvitt på kvällen
      const fx = L - 8;
      P.hl(fx, 130, 9, 0x3a444e); P.px(fx + 8, 131, 0x2a343e);
      area(P, fx, 132, 9, 40, (X, Y, i, j) => jit(i === 0 || j === 0 || i === 8 || j === 39 ? 0x2a3a4a : night ? 0xf0f8ff : 0xe8eef2, X, Y, 44, 0.04));
      [...'TVÄTT'].forEach((ch, k) => text(P, SMALL, ch, fx + 3, 136 + k * 7, 0x2a6ac8));
      if (night) C.reg.glows.push([fx + 1, 133, 7, 38, 0xd8ecff, 0.3]);
      // vänstra fönstret: två maskiner – trummorna snurrar i live()
      const wy = 158, wh = 22;
      shopWin(C, L + 3, wy, dx0 - L - 7, wh, { lit: night, litCol: 0xf0f8ff, frame: 0x6a8aa0,
        back: (Q, gx, gy, gw, gh) => {
          area(Q, gx, gy, gw, gh, (X, Y, i, j) => (night ? (i % 4 === 3 || j % 4 === 0 ? 0xd8dee2 : 0xf6fafa) : (i % 4 === 3 || j % 4 === 0 ? 0x687074 : 0x8a9296)));
          const dim = night ? 1 : 0.62;
          for (const mx of [gx + 1, gx + 13]) {
            Q.rect(mx, gy + 5, 11, gh - 6, mul(0xf0f2ee, dim)); Q.hl(mx, gy + 5, 11, mul(0xffffff, dim));
            Q.vl(mx + 10, gy + 5, gh - 6, mul(0xb8bcb8, dim));
            Q.hl(mx + 1, gy + 6, 9, mul(0x8a9296, dim)); Q.px(mx + 8, gy + 7, mul(0x40c060, dim));
          }
        } });
      C.reg.drums.push({ x: L + 6, y: wy + 10, ph: 0.1, hours: [8, 20], still: 1 });
      C.reg.drums.push({ x: L + 18, y: wy + 10, ph: 0.6, fast: true, hours: [8, 20], still: 3 });
      // högra fönstret: den trasiga maskinen, vikbordet och tvättkorgen
      shopWin(C, dx1 + 4, wy, R - dx1 - 7, wh, { lit: night, litCol: 0xf0f8ff, frame: 0x6a8aa0, act: 'fold', cx: 22, hours: [8, 20],
        back: (Q, gx, gy, gw, gh) => {
          area(Q, gx, gy, gw, gh, (X, Y, i, j) => (night ? (i % 4 === 3 || j % 4 === 0 ? 0xd8dee2 : 0xf6fafa) : (i % 4 === 3 || j % 4 === 0 ? 0x687074 : 0x8a9296)));
          const dim = night ? 1 : 0.62;
          Q.rect(gx + 1, gy + 5, 11, gh - 6, mul(0xe8e8e2, dim)); Q.vl(gx + 11, gy + 5, gh - 6, mul(0xa8aca6, dim));
          Q.px(gx + 9, gy + 7, mul(0xd83030, dim));
          Q.rect(gx + 28, gy + 9, 16, 3, mul(0xc8a870, dim)); Q.hl(gx + 28, gy + 9, 16, mul(0xe8d0a0, dim));
        },
        front: (Q, gx, gy, gw, gh) => {
          note(Q, gx + 2, gy + 6, ['UR', 'FUNKTION'], { seed: 42, paper: 0xfff0d0, ink: 0xa82020 });
          Q.rect(gx + gw - 12, gy + gh - 4, 9, 4, 0xd85a4a); Q.hl(gx + gw - 12, gy + gh - 4, 9, 0xf07a6a);
          Q.hl(gx + gw - 11, gy + gh - 5, 3, 0xf0ece0); Q.px(gx + gw - 7, gy + gh - 5, 0x3a7bd5);
        } });
      C.reg.drums.push({ x: dx1 + 11, y: wy + 10, broken: true, still: 2 });
      // tvättmedelsback och löpsedelställ blir tvättvagn – på trottoarkanten
      P.rect(R - 16, BY - 6, 10, 6, 0x3a6ac8); P.hl(R - 16, BY - 6, 10, 0x5a8ae8); text(P, SMALL, 'VIT', R - 14, BY - 5, 0xffffff, 0.9);
      cctv(C, R - 6, gTop + 16, true);
    },
  });
}

// ======================= GARAGELÄNGAN =======================
// Fyra portar under ett jättelikt sprucket tak: spelarens port, två grannportar
// (en på glänt med ögon i springan), ett förråd med hänglås – och ventilations-
// aggregat uppe på taket (Carl: inget klotter på taken – klotter hör till väggar).
function paintGarage(b, night, opts) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w, N = C.night;
  const { dx0, dx1 } = C, dT = BY - DOOR_ART[b.kind].h; // portarna är 34 höga
  // ---- taket: sprucken asfalt, förortens hemliga baksida ----
  gravelRoof(P, L, 40, W, FT - 40, s, { night: N, puddles: 3, moss: 0.08, col: 0x625e56 });
  P.hl(L, 40, W, 0x827e76); P.hl(L, 41, W, 0x4a463e);
  for (let k = 0; k < 8; k++) crack(P, L + 8 + Math.floor(hash(k, s, 1) * (W - 16)), 46 + Math.floor(hash(k, s, 2) * (FT - 60)), 8 + Math.floor(hash(k, s, 3) * 14), s + k, 0x000000, 0.35);
  // ventilation i centrum-stil i stället för takklotter (Carls regel)
  hvac(P, L + 38, 66, 22, 8, 7, { fan: true, rust: 2 });
  ventPipe(P, L + 68, 70, 9);
  ventPipe(P, L + 30, 88, 7, 0x8a9088);
  football(P, L + 100, 98);
  wireCart(P, R - 42, 70);
  antenna(P, L + 16, 44, 10);
  weeds(P, L + 10, 46, 3, s + 4); weeds(P, R - 14, 47, 3, s + 5); weeds(P, L + 72, 45, 2, s + 6);
  birdsOn(C, L + 10, R - 10, 40, 3, 'krake');
  if (C.snow) snowRoof(P, L + 1, 43, W - 2, FT - 48, s);
  // ---- längan: betong med pelare och fyra portar ----
  area(P, L, FT, W, BY - FT, (X, Y, i, j) => jit(qmix(0x9a968c, 0x827e74, j / (BY - FT), X, Y, 3), X, Y, s + 7, 0.06));
  rows(P, L, FT, W, [0xb8b4aa, 0x8a867c, mul(0x8a867c, 0.6)]);
  plinth(P, L, BY - 4, W, 4, 0x625e56, s + 8);
  for (let y = FT; y < BY; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.15)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.72)); }
  for (let k = 0; k < 4; k++) crack(P, L + 10 + Math.floor(hash(k, s, 9) * (W - 20)), FT + 2, 6 + Math.floor(hash(k, s, 10) * 8), s + 20 + k, 0x000000, 0.35);
  scrawl(P, SMALL, 'GARAGEN', L + 4, FT + 2, 0x4a463e, 3, 0.9);
  // grannporten 1: rostbrun med en hel pjäs; port 3 står på glänt
  shutRoll(P, L + 8, dT, 36, BY - dT, 0x9a6a4a, { dents: 3, rust: 4, piece: { word: 'VILD', y: 7, c1: 0x6fdc4c, c2: 0x2ad0c8, sub: 'KRAM' } });
  P.rect(L + 105, BY - 6, 34, 6, 0x08080a);
  shutRoll(P, L + 104, dT, 36, BY - dT - 6, 0x5a7a6a, { dents: 2, rust: 3, tag: 'SNUT', tagCol: 0xff5dc8 });
  if (N) C.reg.eyes.push({ x: L + 118, y: BY - 4, per: 5, ph: 1.2 });
  // förrådet med hänglås
  const fdS = new Pix(16, 30); solidLeaf(fdS, 16, 30, 0x6a707a, { dents: 2, stickers: 2, handle: 0x8a8a90 });
  stamp(P, fdS, L + 146, BY - 30);
  P.rect(L + 152, BY - 15, 3, 4, 0xd8b020); P.px(L + 153, BY - 16, 0x8a8a90);
  text(P, SMALL, 'FÖRRÅD', L + 144, dT - 8, 0x4a463e, 0.85);
  // spelarens port (ritas av live): spår och nummer
  P.rect(dx0 - 2, dT - 4, dx1 - dx0 + 4, BY - dT + 4, 0x6a665c);
  P.hl(dx0 - 2, dT - 4, dx1 - dx0 + 4, 0x9a968c); P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  [[L + 24, '1'], [dx0 + 15, '2'], [L + 120, '3']].forEach(([nx, n]) => {
    text(P, BIG, n, nx, dT - 11, 0xf0ece0, 0.85); P.vl(nx + 1, dT - 4, 2, 0xf0ece0, 0.4);
  });
  // lamporna över pelarna – mittersta är trasig
  wallLamp(C, L + 46, FT + 1); wallLamp(C, dx1 + 3, FT + 1, { broken: true }); wallLamp(C, R - 26, FT + 1);
  tag(P, L + 48, BY - 12, 'YO', 0x3a9bff, s + 11); stencil(P, dx1 + 5, BY - 10, 'stjarna', 0xffd23f, 0.8);
  weeds(P, L + 6, BY - 1, 3, s + 12); weeds(P, L + 101, BY - 1, 2, s + 13); weeds(P, R - 5, BY - 1, 3, s + 14);
  footShadow(P, L, W, BY);
  decal(C, W, 16, (G) => {
    oilStain(G, dx0 - L + 16, 6, 8, 2.5, s); oilStain(G, 30, 9, 6, 2, s + 1);
    litter(G, 4, 1, W - 8, 6, s + 2);
  });
  return finish(C);
}

// ======================= LAGERHALLEN =======================
// Övergiven industrihall i grönplåt: spökskylt med bolagsnamnet, högt
// fönsterband (ett lyser mystiskt om natten), lastkaj med gummidockor och
// igenbommad kajport, tre snurrande huvar – och klotter över hela sockeln.
function paintLagerhall(b, night, opts) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w, N = C.night;
  const { dx0, dx1 } = C, dT = BY - DOOR_ART[b.kind].h; // stora porten är 48 hög
  // ---- taket: stora rostiga plåtvåder, trasigt takfönster ----
  corrugated(P, L, 40, W, FT - 40, 0x5a6468, s, { per: 4, rust: 0.8, sheet: 18 });
  P.hl(L, 40, W, 0x8a949a); P.hl(L, 41, W, 0x3a4448);
  const skx = L + 36;
  P.rect(skx - 1, 56, 20, 12, 0x2a3438);
  area(P, skx, 57, 18, 10, (X, Y, i, j) => (hash(X, Y, s + 1) > 0.4 ? (N ? qmix(0x1c2a38, 0x0e1620, j / 10, X, Y, 2) : qmix(0xb8d0e0, 0x5a7488, j / 10, X, Y, 3)) : 0x0a0e12));
  P.line(skx, 66, skx + 17, 58, 0xe8f0f8, 0.4);
  for (const [tx, ph] of [[L + 70, 0], [L + 110, 0.4], [L + 150, 0.7]]) C.reg.fans.push({ x: tx, y: 47, turbine: true, speed: 5, ph });
  ventPipe(P, L + 20, 48, 9, 0x7a8488);
  birdsOn(C, L + 8, R - 8, 40, 4, 'krake');
  if (C.snow) snowRoof(P, L + 60, 43, W - 70, FT - 50, s);
  // ---- fasaden: grönplåt med spökskylt och högt fönsterband ----
  corrugated(P, L, FT, W, BY - FT - 4, 0x6a7a68, s + 2, { per: 4, rust: 0.85, sheet: 20 });
  rows(P, L, FT, W, [0x9aa898, 0x5a6a58, mul(0x5a6a58, 0.6)]);
  plinth(P, L, BY - 4, W, 4, 0x4a463e, s + 3);
  for (let y = FT; y < BY; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.14)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.72)); }
  // spökskylten: bolagsnamnet som nästan blekts bort
  const g1 = bits(BIG, 'PIXELSTADENS'), g2 = bits(BIG, 'LAGERBOLAG');
  sign(P, g1, L + ((W - g1.w) >> 1), FT + 7, { fill: (i, j, X, Y) => (hash(X, Y, s + 4) > 0.3 ? 0xe8e4d8 : null), a: 0.4 });
  sign(P, g2, L + ((W - g2.w) >> 1), FT + 16, { fill: (i, j, X, Y) => (hash(X, Y, s + 5) > 0.35 ? 0xe8e4d8 : null), a: 0.38 });
  // fönsterbandet: trådglas, trasigt, igenspikat – och ett som lyser om natten…
  [[L + 6, 0], [L + 30, 1], [L + 54, 2], [L + 146, 3], [L + 170, 4]].forEach(([wx, k]) => {
    const st = k === 1 ? { broken: true } : k === 2 ? { boarded: true, tagOn: 'PIX' } : k === 3 ? { broken: true } : { dirt: 1 };
    win(P, wx, FT + 28, 18, 12, { night: N, frame: 0x4a544a, transom: false, curtain: null, seed: k, ...st }, C.reg);
  });
  if (N) {
    C.reg.flick.push({ x: L + 147, y: FT + 29, w: 16, h: 10, c: 0xffd890, a: 0.28, mode: 'flick' }); // någon är därinne…
    C.reg.eyes.push({ x: L + 60, y: FT + 34, per: 7, ph: 3.4 });
  }
  // LAGER 3-skylten och det stora målade siffran
  plate(P, dx0 - 2, FT + 25, 52, 12, 0x3a4a5a, { rust: 2 });
  signText(P, BIG, 'LAGER', dx0 + 2, FT + 28, 0xf0d890, { shadow: 0x1a2430 });
  signText(P, BIG, '3', dx0 + 40, FT + 28, 0xf0d890, { shadow: 0x1a2430 });
  bigNumber(P, dx1 + 8, dT + 12, '3', 0xd8d0c0);
  // traversbalken med krok ovanför porten
  P.rect(dx0 + 6, dT - 8, 40, 3, 0x3a3e46); P.hl(dx0 + 6, dT - 8, 40, 0x6a707c);
  P.vl(dx0 + 22, dT - 5, 4, 0x2a2e36); P.px(dx0 + 23, dT - 1, 0xd8b020);
  // strålkastarna: en lyser, en hänger i kabeln
  P.rect(dx0 - 12, dT - 10, 6, 4, 0x3a3e46); P.rect(dx0 - 11, dT - 8, 4, 2, N ? 0xfff0c0 : 0xc8ccd4);
  if (N) { C.reg.glows.push([dx0 - 11, dT - 8, 4, 2, 0xfff0c0, 0.9]); C.reg.glows.push([dx0 - 16, dT - 4, 16, 6, 0xffe0a0, 0.14]); }
  P.line(dx1 + 6, dT - 14, dx1 + 6, dT - 8, 0x2a2e36);
  P.rect(dx1 + 4, dT - 8, 5, 4, 0x3a3e46); P.rect(dx1 + 5, dT - 6, 3, 2, 0x4a4e58);
  // porten (live ritar rullporten med PIXEL-pjäsen)
  P.rect(dx0 - 3, dT - 4, dx1 - dx0 + 6, BY - dT + 4, 0x4a544a);
  P.hl(dx0 - 3, dT - 4, dx1 - dx0 + 6, 0x8a948a); P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  // lastkajen: ramp, gummidockor, trappa och en igenbommad kajport
  const kY = BY - 10;
  shutRoll(P, L + 16, kY - 30, 40, 30, 0x7a7a64, { dents: 3, rust: 4, tag: 'SNUT', tagCol: 0xff5dc8 });
  area(P, L + 2, kY, 76, 10, (X, Y, i, j) => jit(j === 0 ? 0xb0aca0 : qmix(0x8a867a, 0x6a665c, j / 10, X, Y, 3), X, Y, s + 6, 0.07));
  P.hl(L + 2, kY, 76, 0xc8c4b8); P.hl(L + 2, kY + 1, 76, 0x5a564e);
  for (const bx of [L + 8, L + 34, L + 60]) { P.rect(bx, kY + 2, 6, 7, 0x1a1a1e); P.hl(bx, kY + 2, 6, 0x3a3a40); }
  for (let k = 0; k < 4; k++) { P.rect(L + 78 + k, kY + 2 + k * 2, 6 - k, 2, 0x8a867a); P.hl(L + 78 + k, kY + 2 + k * 2, 6 - k, 0xb0aca0); }
  // klotter, fat, pallar, ogräs
  piece(P, dx1 + 8, BY - 20, 'KAOS', { x2: false, c1: 0xff5dc8, c2: 0x9a5cff, cloud: 0x1a3a3a, drips: 4, sign: 'BTG' });
  tag(P, L + 20, kY - 38, 'RÖK', 0x2ad0c8, s + 7); stencil(P, dx0 - 14, BY - 12, 'krona', 0xffd23f, 0.85);
  tag(P, R - 34, BY - 10, '4EVER', 0xff8a2a, s + 8);
  barrel(P, R - 18, BY - 1, 0x5a5a2a); pallets(P, R - 44, BY - 1, 3);
  drainpipe(C, L + 1, FT + 3, kY, {}); drainpipe(C, R - 4, FT + 3, BY, { gap: [FT + 40, FT + 56] });
  weeds(P, L + 80, BY - 1, 3, s + 9); weeds(P, dx0 - 8, BY - 1, 2, s + 10); weeds(P, R - 24, BY - 1, 3, s + 11);
  footShadow(P, L, W, BY);
  decal(C, W, 18, (G) => { oilStain(G, dx0 - L + 24, 8, 9, 3, s + 12); litter(G, 6, 1, W - 12, 8, s + 13); });
  return finish(C);
}

// ======================= LAMELLHUSET – Betongvägen 7 =======================
// Fristående trevåningslamell man går runt: grustak uppifrån, gulnade
// betongelement, balkonger med tvätt och paraboler, trapphus med port B
// och sönderslaget kodlås.
function paintLamell(b, night, opts) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w, N = C.night;
  const { dx0, dx1 } = C, dT = BY - DOOR_ART.lamell.h;
  // ---- taket (syns uppifrån när man går bakom huset) ----
  gravelRoof(P, L, FT - 40, W, 40, s, { night: N, puddles: 1, moss: 0.06, col: 0x6e6a62 });
  P.hl(L, FT - 40, W, 0x8e8a82); P.hl(L, FT - 39, W, 0x565248);
  ventPipe(P, L + 24, FT - 34, 6); ventPipe(P, L + 150, FT - 36, 7);
  hvac(P, L + 88, FT - 36, 12, 4, 4, { fan: true, rust: 1 });
  C.reg.fans.push({ x: L + 91, y: FT - 36, speed: 8, ph: 0.2 });
  dish(P, L + 62, FT - 30, { rust: true }); dish(P, L + 130, FT - 28, {});
  antenna(P, L + 176, FT - 40, 9);
  birdsOn(C, L + 10, R - 10, FT - 40, 2);
  if (C.snow) snowRoof(P, L + 2, FT - 38, W - 4, 34, s);
  // ---- fasaden: gulnade element, tre våningar ----
  panels(P, L, FT, W, BY - FT, 0xcac0a8, s + 1, { pw: 26, ph: 18 });
  rows(P, L, FT, W, [mix(0xcac0a8, WHITE, 0.35), 0xa89e88, mul(0xa89e88, 0.6)]);
  for (let y = FT; y < BY; y++) { P.px(L, y, mix(P.get(L, y), WHITE, 0.2)); P.px(R - 1, y, mul(P.get(R - 1, y), 0.7)); P.px(R - 2, y, mul(P.get(R - 2, y), 0.86)); }
  for (let k = 0; k < 5; k++) crack(P, L + 8 + Math.floor(hash(k, s, 2) * (W - 16)), FT + 4 + Math.floor(hash(k, s, 3) * 30), 6 + Math.floor(hash(k, s, 4) * 10), s + k);
  moss(P, L, FT + 3, W, 5, s + 5, 0.05);
  // trapphusremsan med emaljplåt, halvplansfönster och husnumret
  const sx = dx0 - 2, sw = 20;
  area(P, sx - 2, FT + 3, sw + 4, dT - FT - 3, (X, Y, i, j) => {
    const pj = j % 18, c0 = hash(0, Math.floor(j / 18), s + 6) > 0.85 ? mul(0x6a8a5a, 0.82) : 0x6a8a5a;
    let c = pj === 17 ? mul(c0, 0.55) : pj === 0 ? mix(c0, WHITE, 0.25) : i % 5 === 4 ? mul(c0, 0.86) : c0;
    if (hash(X >> 1, Y >> 1, s + 7) > 0.95) c = mix(c, 0x8a4a22, 0.5);
    return i === 0 ? mul(c, 0.7) : i === sw + 3 ? mix(c, WHITE, 0.12) : jit(c, X, Y, s + 8, 0.05);
  });
  stairWin(C, sx + 4, FT + 12, 12, 7, 0, {});
  stairWin(C, sx + 4, FT + 30, 12, 7, 1, { flick: true });
  bigNumber(P, sx + 6, FT + 42, '7', 0xf4f1ea);
  // våningarna med balkonger
  apartments(C, { top: FT + 4, floorH: 18, floors: 3, seed: s, frame: 0xe8e0d0,
    front: { kind: 'betong', col: 0x9a9284 },
    cols: [{ x: L + 4, w: 26, kind: 'bal' }, { x: L + 40, w: 12, kind: 'win' }, { x: L + 58, w: 12, kind: 'win' },
      { x: L + 120, w: 12, kind: 'win' }, { x: L + 138, w: 12, kind: 'win' }, { x: L + 158, w: 26, kind: 'bal' }],
    life: 0.5, lifeDay: 0.3, balk: 0.35 });
  // regnränder från balkongplattorna
  for (const ex of [L + 1, L + 33, L + 155, L + 187]) if (hash(ex, 1, s + 9) > 0.3) streak(P, ex, FT + 20, 5 + Math.floor(hash(ex, 2, s + 10) * 8), 0x4a4638, 0.4, ex);
  // ---- bottenvåningen: räfflad betong, porten, cyklar ----
  rows(P, L, FT + 58, W, [mix(0xa89e88, WHITE, 0.3), 0xa89e88, mul(0xa89e88, 0.6)]);
  area(P, L, FT + 61, W, BY - 4 - FT - 61, (X, Y, i, j) => {
    const r = (X + 1) % 3; let c = r === 0 ? mix(0x9a9488, WHITE, 0.14) : r === 2 ? mul(0x9a9488, 0.78) : 0x9a9488;
    if (hash(X >> 1, Y >> 2, s + 11) > 0.93) c = mul(c, 0.86);
    return jit(c, X, Y, s + 12, 0.05);
  });
  plinth(P, L, BY - 4, W, 4, 0x6a6660, s + 13);
  footShadow(P, L, W, BY);
  // porten (live ritar dörren): nisch, skärmtak, trasigt kodlås
  area(P, dx0 - 4, dT - 3, dx1 - dx0 + 8, BY - dT + 3, (X, Y, i, j) => jit(i < 3 ? 0x3a3a42 : i > dx1 - dx0 + 4 ? 0x5a5a62 : 0x2a2a32, X, Y, 14, 0.06));
  P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, BY - dT + 1, OUT);
  canopy(C, dx0 - 8, dT - 8, dx1 - dx0 + 16, {});
  intercom(P, dx1 + 4, dT + 8, true);
  note(P, dx1 + 12, dT + 6, ['KODEN', 'ÄR 0000'], { seed: 9, paper: 0xfff8d0 });
  P.rect(dx0 - 3, BY, dx1 - dx0 + 6, 2, 0xa8a49a); P.hl(dx0 - 3, BY, dx1 - dx0 + 6, 0xc8c4bc); P.rect(dx0 - 3, BY + 2, dx1 - dx0 + 6, 2, 0x6a6660);
  streetSign(P, dx0 - 66, dT + 5, b.sign);
  win(P, L + 8, BY - 11, 12, 5, { night: N, frame: 0x6a6660, bars: true, sill: false, transom: false, dirt: 1, seed: 7 }, C.reg);
  win(P, R - 26, BY - 11, 12, 5, { night: N, frame: 0x6a6660, bars: true, sill: false, transom: false, dirt: 1, seed: 8 }, C.reg);
  bike(P, R - 46, BY - 1, s + 15);
  piece(P, L + 36, FT + 70, 'HEJ', { x2: false, c1: 0x2ad0c8, c2: 0x3a9bff, drips: 3 });
  tag(P, L + 140, BY - 10, 'MIX', 0xff8a2a, s + 16); stencil(P, L + 84, BY - 9, 'hjarta', 0xff5dc8, 0.85);
  drainpipe(C, L + 2, FT + 2, BY, {}); drainpipe(C, R - 5, FT + 2, BY, { gap: [FT + 30, FT + 42] });
  weeds(P, L + 5, BY - 1, 3, s + 17); weeds(P, R - 8, BY - 1, 2, s + 18);
  return finish(C);
}

// ======================= HUSVAGNEN =======================
// Spelarens billigaste hem: 70-talskaross i kräm med orange rand, kamin-
// rör, ljusslinga, gasoltub, dragstång med stödhjul, mjölkbacksteg och
// trädgårdstomten. Om natten lyser fönstret varmt och katten sitter i det.
function paintHusvagn(b, night, opts) {
  const C = begin(b, night, opts), { P, L, R, BY, FT, s } = C, W = b.w, N = C.night;
  const { dx0, dx1 } = C;
  const bodyT = FT + 2, bodyB = BY - 6;
  // ---- taket: välvd aluminium med falsar, taklucka och kaminrör ----
  area(P, L + 1, 16, W - 2, FT - 16, (X, Y, i, j) => {
    if (j === 0 && (i < 2 || i > W - 5)) return null;
    if (j === 1 && (i < 1 || i > W - 4)) return null;
    let c = qmix(0xe8ecf0, 0xa8b0b8, j / (FT - 16), X, Y, 4);
    if (j % 5 === 4) c = mul(c, 0.88);
    if (i === 0) c = mix(c, WHITE, 0.25); else if (i === W - 3) c = mul(c, 0.75);
    if (hash(X >> 1, Y >> 1, s) > 0.96) c = mix(c, 0x8a9a6a, 0.4);
    return jit(c, X, Y, s + 1, 0.04);
  });
  P.hl(L + 3, 15, W - 6, 0xf4f8fc);
  P.rect(L + 18, 22, 8, 5, 0x8a949c); P.rect(L + 19, 23, 6, 3, N ? 0x2a3448 : 0xc8dce8); P.px(L + 20, 23, WHITE, 0.5);
  P.vl(L + 34, 12, 8, 0x5a5e66); P.vl(L + 35, 12, 8, 0x8a8e96); P.rect(L + 32, 11, 6, 2, 0x3a3e46);
  C.reg.smoke.push({ x: L + 35, y: 10, n: 4, rate: 0.22, rise: 14, drift: 5, tone: 0xd8d4cc, nightTone: 0x7a7e8c, alpha: 0.4, hours: [16, 25] });
  dish(P, R - 8, 20, { r: 2, rust: true }); antenna(P, L + 6, 8, 8);
  if (C.snow) snowRoof(P, L + 3, 17, W - 8, FT - 20, s);
  // ---- karossen: kräm med orange rand, plåtskarvar, bucklor ----
  area(P, L, bodyT - 2, W, bodyB - bodyT + 2, (X, Y, i, j) => {
    const yy = bodyT - 2 + j;
    let c = 0xefe8d4;
    if (yy >= bodyT + 6 && yy <= bodyT + 8) c = 0xe0783a;
    else if (yy === bodyT + 9) c = 0x8a4a2a;
    if (j === 0) { if (i < 2 || i > W - 3) return null; c = mix(c, WHITE, 0.4); }
    if (yy > bodyB - 4) c = mul(c, 0.82);
    if (i === 0) c = mix(c, WHITE, 0.2); else if (i === W - 1) c = mul(c, 0.7);
    if (i % 12 === 6) c = mul(c, 0.93);
    if (hash(X, Y, s + 2) > 0.985) c = mul(c, 0.85);
    return jit(c, X, Y, s + 3, 0.035);
  });
  // rost ur skarvarna och kring hjulhuset
  streak(P, L + 5, bodyT + 12, 5, 0x8a4a22, 0.5, 1); streak(P, R - 4, bodyT + 10, 6, 0x8a4a22, 0.45, 2);
  // fönstren: lilla med gardin, stora med katten (spelarens fönster)
  win(P, L + 2, bodyT + 2, 7, 8, { night: N, lit: N ? 'warm2' : false, frame: 0xd8d2c4, single: true, transom: false, curtain: 0x6a8ac8, curtW: 1, sill: false, seed: 1 }, C.reg);
  lifeWin(C, L + 26, bodyT + 2, 16, 10, { lit: 'warm', act: 'cat', frame: 0xd8d2c4, curtain: 0xd8544a, single: true, transom: false, sill: false, seed: 2 });
  // ljusslingan längs takkanten – blinkar i olika färger om kvällen
  for (let i = 0; i <= W - 4; i++) P.px(L + 2 + i, FT + (Math.abs(i - (W - 4) / 2) < (W - 4) / 4 ? 1 : 0), 0x3a3a40, 0.7);
  for (let k = 0; k < 6; k++) {
    const lx = L + 4 + k * 7, ly = FT + 1 + (Math.abs(lx - L - W / 2) < W / 4 ? 1 : 0);
    const c = SPRAY[(k * 2 + 1) % SPRAY.length];
    P.px(lx, ly + 1, mix(c, WHITE, N ? 0.1 : 0.35));
    C.reg.leds.push({ x: lx, y: ly + 1, c, rate: 0.7 + k * 0.13, ph: k * 0.37 });
  }
  // kjol, hjul och stödben
  area(P, L + 1, bodyB, W - 2, 3, (X, Y, i, j) => jit(j === 0 ? 0x8a8478 : 0x6a665c, X, Y, s + 4, 0.06));
  P.ell(L + 24, BY - 5, 5, 5, 0x1e1e22, 1, 1); P.ell(L + 24, BY - 5, 2.4, 2.4, 0x9aa0aa, 1, 1); P.px(L + 23, BY - 6, 0xd8dce4);
  P.line(L + 5, bodyB + 2, L + 3, BY - 1, 0x6a6e76); P.rect(L + 2, BY - 2, 5, 2, 0x8a6a40);
  P.line(R - 7, bodyB + 2, R - 5, BY - 1, 0x6a6e76); P.rect(R - 8, BY - 2, 5, 2, 0x8a6a40);
  // dragstången med kulhandske och stödhjul
  P.line(L - 1, bodyB - 2, L - 6, BY - 4, 0x8a8e96); P.line(L - 1, bodyB - 1, L - 6, BY - 3, 0x5a5e66);
  P.rect(L - 8, BY - 6, 3, 2, 0x3a3e46);
  P.vl(L - 6, BY - 3, 2, 0x8a8e96); P.rect(L - 7, BY - 1, 4, 1, 0x2a2e34);
  // gasoltuben, mjölkbacken vid dörren och tomten
  P.rect(R + 1, BY - 9, 6, 9, 0x3a6ac8); P.hl(R + 1, BY - 9, 6, 0x6a9ae8); P.vl(R + 6, BY - 8, 8, 0x2a4a98); P.rect(R + 3, BY - 11, 2, 2, 0x8a8e96);
  P.rect(dx0 + 2, BY - 3, 8, 3, 0xd8b020); P.hl(dx0 + 2, BY - 3, 8, 0xf0d060); for (let i = 1; i < 8; i += 2) P.px(dx0 + 2 + i, BY - 2, 0x8a7010);
  gnome(P, dx1 + 10, BY - 1);
  P.ell(L + 24, BY, 8, 1.6, 0x1a1422, 0.35, 2); P.ell(L - 5, BY - 1, 3, 1.2, 0x1a1422, 0.3, 2);
  weeds(P, L - 2, BY - 1, 2, s + 5); weeds(P, R + 2, BY - 1, 2, s + 6);
  return finish(C);
}

// ======================= exporten =======================
const art = (paint) => ({ paint, live: liveX, glow: glowX });
export const BUILDING_ART = {
  hoghus: art(paintHoghus), hoghus2: art(paintHoghus2),
  narbutik: { ...art(paintNarbutik), items: nbItems }, pantbank: art(paintPantbank), kebab: art(paintKebab),
  maskerad: { ...art(paintMaskerad), items: maskItems, obstacles: maskObstacles }, bilverkstad: art(paintBilverkstad), tvatteri: art(paintTvatteri),
  garage: art(paintGarage), lagerhall: art(paintLagerhall),
  lamell: art(paintLamell), husvagn: art(paintHusvagn),
};
