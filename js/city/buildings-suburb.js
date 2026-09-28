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
import { ART_OVER, ART_BELOW, artBox, baseOf } from './map.js';

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
    return qmix(mul(mix(c, 0x5a6a80, 0.12), 0.7), mul(mix(c, 0x3a4a60, 0.2), 0.48), t, X, Y, 3);
  });
  const dim = lit ? 1 : o.night ? 0.3 : 0.62;
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
  const R = o.room, lit = o.night ? o.lit : false, dim = lit ? 1 : o.night ? 0.3 : 0.62;
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
  const oo = { ...o, lit, room, blind: shadow ? 'down' : null, broken: false, boarded: false, plant: false, curtain: shadow ? null : o.curtain };
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
    if (mode === 'day') k = mix(mul(k, 0.78), 0x3a4a60, 0.12);        // inne är det mörkare, och glaset blånar
    else if (mode === 'warm') k = mix(k, 0xffb060, 0.2);                // lampljus
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
  const B = bits(BIG, word, { x2: !!o.x2, gap: o.gap ?? (o.x2 ? 2 : 1) }), P = C.P;
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
  for (const a of m.anim) if (!a.hours || isOpen(a.hours, hour)) lifeDraw(ctx, a, t);
  for (const a of m.balk) balkDraw(ctx, a, t, st.night);
  if (m.drums.length) { const D = drumFrames(); for (const d of m.drums) if (!d.broken) ctx.drawImage(D[Math.floor(t * (d.fast ? 9 : 5) + d.ph * 4) % 4], d.x, d.y); else ctx.drawImage(D[d.still], d.x, d.y); }
  if (m.spits.length) { const S = spitFrames(); for (const s of m.spits) ctx.drawImage(S[Math.floor(t * 2.5) % 4], s.x, s.y); }
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
  area(P, sx - 2, FT + 4, sw + 4, gTop - FT - 4, (X, Y, i, j) => { const c = mul(P.get(X, Y), 0.9); return i === 0 ? mul(c, 0.8) : i === sw + 3 ? mix(c, WHITE, 0.1) : c; });
  for (let f = 0; f < cfg.floors - 1; f++) stairWin(C, sx + 2, fTop + f * cfg.floorH + (cfg.floorH >> 1) - 2, sw - 4, 8, f, { flick: f === cfg.flickFloor, broken: f === cfg.brokenFloor, dark: f === cfg.darkFloor });
  // stort husnummer över porten
  const nB = bits(BIG, cfg.number, { x2: true, bold: true });
  bigNumber(P, sx + ((sw - nB.w) >> 1), fTop + (cfg.floors - 1) * cfg.floorH + 2, cfg.number, cfg.numberCol);
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
  streetSign(P, dx1 + 14, gTop + 3, b.sign);
  // stuprör med en bit som saknas
  drainpipe(C, R - 6, FT + 2, BY, { gap: cfg.pipeGap });
  cfg.ground2(C);
  // ---- slitage överallt ----
  for (let k = 0; k < 7; k++) tag(P, L + 4 + Math.floor(hash(k, s, 21) * (W - 30)), BY - 16 - Math.floor(hash(k, s, 22) * 12), pick(TAGS, k, s, 23), pick(SPRAY, k, s, 24), s + k);
  weeds(P, L + 6, BY - 1, 3, s + 31); weeds(P, R - 12, BY - 1, 2, s + 32); weeds(P, dx0 - 8, BY - 1, 2, s + 33);
  return finish(C);
}
function paintHoghus(b, night, opts) {
  const L = O;
  return paintTower(b, night, opts, {
    wall: 0xb4ae9e, ground: 0x9a968c, frame: 0xd8d4cc, gTop: 148, fTop: 22, floorH: 18, floors: 7, stairX: 84,
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
      area(P, nx, gTop + 10, 28, 20, (X, Y, i, j) => (i === 0 || j === 0 || i === 27 || j === 19 ? 0x5a3a24 : jit(0xb8864a, X, Y, 17, 0.14)));
      note(P, nx + 2, gTop + 12, ['HISSEN'], { seed: 1, paper: 0xfff8d0, ink: 0xc8202a });
      note(P, nx + 13, gTop + 18, ['KATT?'], { seed: 2, pin: true, tape: false });
      note(P, nx + 2, gTop + 21, ['FEST', 'LÖR'], { seed: 3, paper: 0xd8f0ff, ink: 0x2a2a6a });
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
    wall: 0xc8b484, ground: 0x8a8272, frame: 0xe8e0c8, gTop: 146, fTop: 20, floorH: 18, floors: 7, stairX: 92,
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

// __FORTS__

// ======================= exporten =======================
const art = (paint) => ({ paint, live: liveX, glow: glowX });
export const BUILDING_ART = {
  hoghus: art(paintHoghus), hoghus2: art(paintHoghus2),
};
