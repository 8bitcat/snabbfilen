// FÖRORTEN: fasadkonst för förortens hus – höghusen på Betongvägen (1, 5 och
// lamellen 7), närbutiken med galler och handskrivna lappar, pantbanken med de
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
import { ART_OVER, artBox, baseOf } from './map.js';

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
function win(P, x, y, w, h, o, reg) {
  const fr = o.frame ?? 0xd8d4cc, night = !!o.night, lit = night ? o.lit : false;
  P.rect(x - 1, y - 1, w + 2, h + 2, mul(fr, 0.42));
  P.rect(x, y, w, h, fr);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  if (o.boarded) { boards(P, x, y, w, h, o.seed ?? x); if (o.tagOn) tag(P, x + 1, y + 2 + Math.floor(hash(x, y, 9) * (h - 8)), o.tagOn, pick(SPRAY, x, y, 10), x + y); return; }
  area(P, gx, gy, gw, gh, (X, Y, i, j) => {
    if (lit === 'tv') return qmix(0x8ab0ff, 0x3a58b8, j / gh, X, Y, 3);
    if (lit) return qmix(lit === 'warm2' ? 0xffd08a : 0xffeaa8, lit === 'warm2' ? 0xe08a3a : 0xf0a648, j / gh, X, Y, 3);
    if (night) return qmix(0x24304a, 0x101828, j / gh, X, Y, 3);
    return qmix(o.sky ?? 0xa8c4dc, o.deep ?? 0x3e5670, j / gh, X, Y, 4);
  });
  if (!lit) for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const d = (((i * 2 - j * 3 + (o.seed ?? 0) * 7) % 15) + 15) % 15;
    if (d < 2) P.px(gx + i, gy + j, WHITE, night ? 0.06 : 0.28); else if (d === 4) P.px(gx + i, gy + j, WHITE, night ? 0.03 : 0.1);
  }
  if (o.curtain !== undefined && o.curtain !== null && !o.blind) {
    const cc = lit ? mix(o.curtain, 0xffe0a0, 0.35) : night ? mul(o.curtain, 0.5) : o.curtain, cw = Math.max(2, Math.round(gw * 0.25));
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
  if (o.sill !== false) { const sc = o.sillCol ?? 0xc8c4bc; P.hl(x - 1, y + h + 1, w + 2, mix(sc, WHITE, 0.3)); P.hl(x - 1, y + h + 2, w + 2, mul(sc, 0.6)); P.hl(x, y + h + 3, w, 0x000000, 0.22); reg?.ledges.push([x - 1, y + h + 1, w + 2]); }
  if (lit && reg) { reg.win.push([gx, gy, gw, gh]); if (lit === 'tv') reg.tv.push([gx, gy, gw, gh]); }
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
//   front, frame, seed, skip(f, col), curt }  – tända fönster registreras i reg.win/reg.tv
function apartments(P, C, reg, o) {
  for (let f = 0; f < o.floors; f++) {
    const fy = o.top + f * o.floorH;
    o.cols.forEach((col, k) => {
      if (o.skip?.(f, col, k)) return;
      const s = o.seed + f * 17 + k * 3, r = hash(f, k, s);
      const lit = C.night ? (r < 0.6 ? (hash(f, k, s + 1) < 0.18 ? 'tv' : hash(f, k, s + 2) < 0.4 ? 'warm2' : 'warm') : false) : false;
      const blind = hash(f, k, s + 4) > 0.55 ? (hash(f, k, s + 5) > 0.6 ? 'broken' : hash(f, k, s + 5) > 0.3 ? 'half' : 'down') : null;
      if (col.kind === 'bal') {
        const dh = o.floorH - 5, dy = fy + 1, ww = col.w - 11;
        win(P, col.x, dy, 8, dh, { night: C.night, lit, frame: o.frame, single: true, transom: 0.35, sill: false, curtain: pick(CURT, f, k, s + 3), blind: blind === 'down' ? 'half' : blind, seed: s }, reg);
        win(P, col.x + 11, dy, ww, dh - 5, { night: C.night, lit: lit && hash(f, k, s + 8) > 0.3 ? lit : false, frame: o.frame, single: ww < 10, transom: false, sill: false, curtain: pick(CURT, f, k, s + 3), blind, seed: s + 1 }, reg);
        balcony(P, col.x - 3, dy + dh, col.w + 6, { front: o.front, stuff: pick(STUFF, f, k, s + 6), seed: s, night: C.night, tag: f === 0 && hash(f, k, s + 12) > 0.75 ? pick(TAGS, f, k, s + 13) : null }, reg);
      } else {
        const wh = o.floorH - 7, wy = fy + 2;
        const boarded = hash(f, k, s + 8) > 0.965, broken = !boarded && hash(f, k, s + 7) > 0.93;
        win(P, col.x, wy, col.w, wh, { night: C.night, lit: boarded ? false : lit, frame: o.frame, curtain: hash(f, k, s + 9) > 0.4 ? pick(CURT, f, k, s + 3) : null, blind, broken, boarded, seed: s, dirt: 0.5, plant: hash(f, k, s + 14) > 0.85, tagOn: hash(f, k, s + 15) > 0.5 ? pick(TAGS, f, k, s + 16) : null }, reg);
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
  narbutik: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xf0ece0, wall1: 0xc8c4b8, floor: 0xb8b0a0, lampCol: 0xe8f0ff }); for (let r = 0; r < 3; r++) { I.hl(1, 7 + r * 5, w - 2, 0x8a8a90); for (let x = 2; x < w - 2; x += 2) I.rect(x, 4 + r * 5, 1, 3, pick(SPRAY, x, r, 1)); } I.rect(w - 6, 12, 5, 10, 0x2a3a5a); I.rect(w - 5, 13, 3, 8, 0x6ab0f0); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, label: 'DRAG', stickers: 7, frame: 0x5a5a60 }), edge: 0x6a6a70, hinge: 'l' },
  pantbank: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0x6a5a48, wall1: 0x3a3028, floor: 0x5a4a3a, lampCol: 0xffe8b0 }); I.rect(2, 14, w - 4, 4, 0x8a6a40); I.hl(2, 14, w - 4, 0xc8a870); I.rect(3, 6, w - 6, 8, 0x9ab0c0, 0.5); I.px(w >> 1, 10, 0xffd23f); }, leaf: (S, w, h, n) => solidLeaf(S, w, h, 0x2a2a30, { night: n, window: [3, 4, w - 6, 9], grille: true, handle: 0xd8c060, mailslot: true, stickers: 1 }), edge: 0x4a4a50, hinge: 'r' },
  kebab: { h: 30, interior: (I, w, h) => { interiorBase(I, w, h, { wall0: 0xf0d8b0, wall1: 0xc8a878, floor: 0xa89070, lampCol: 0xffe0a0 }); I.rect(2, 12, w - 4, 6, 0xd8303a); I.hl(2, 12, w - 4, 0xf05a5a); I.rect(w - 7, 3, 5, 9, 0x3a2a1a); I.rect(w - 6, 4, 3, 7, 0x9a5a34); I.px(w - 5, 6, 0xc8804a); }, leaf: (S, w, h, n) => glassLeaf(S, w, h, { night: n, note: ['ÖPPNAR', 'SNART!'], noteY: 4, notePaper: 0xf8f0c0, frame: 0x5a3a2a, stickers: 2 }), edge: 0x6a4a3a, hinge: 'l' },
  overgivet: { h: 30, interior: (I, w, h) => { I.rect(0, 0, w, h, 0x0a0a0e); }, leaf: (S, w, h) => { boards(S, 0, 0, w, h, 77); S.hl(0, 0, w, 0x3a2a18); stencil(S, (w >> 1) - 3, 10, 'hjarta', 0xff5dc8, 0.95); S.px((w >> 1) - 1, 16, 0xff5dc8, 0.7); S.px((w >> 1) - 1, 17, 0xff5dc8, 0.5); tag(S, 2, 22, 'NEJ', 0xf4f1ea, 9); }, boarded: true },
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

// __FORTS__
