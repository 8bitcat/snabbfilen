// Arbetsplatsernas fasader i Pixelstaden: KAFÉ, BURGARBAREN, FRUKTFABRIKEN och FLYGPLATSEN.
// Allt statiskt målas pixel för pixel med Pix-pennan EN gång (scenen cachar paint()).
// live() ritar det som rör sig (dörrar, neon, rök, avgångstavla, fyr, vindstrut) och
// glow() det som lyser efter mörkret. Canvasen är alltid BASE + 4 hög, så canvas-y =
// världs-y och canvas-x = världs-x − b.x + 8. Fasaden står på raderna [BASE − b.h, BASE).
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { CITY, ART_OVER, ART_BELOW } from './map.js';

const BASE = CITY.BASE, TOP = CITY.FOOT_TOP, HGT = BASE + ART_BELOW;
const DOOR_H = 34, DT = BASE - DOOR_H;
const WHITE = 0xffffff;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgb = (c) => `rgb(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255})`;

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
function areaA(P, x, y, w, h, c, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = fn(x + i, y + j, i, j);
    if (a > 0) P.px(x + i, y + j, c, Math.min(1, a));
  }
}
function rows(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) P.hl(x, y + i, w, c); }); }
function cylCols(P, x, y, h, fs) { fs.forEach((f, i) => P.darken(x + i, y, 1, h, f)); }
// glasreflex: diagonala strimmor och ljusare överkant
function reflect(P, x, y, w, h, night, str = 1, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    const s = ((((X + seed) * 2 - Y * 3) % 50) + 50) % 50;
    let a = s < 4 ? 0.26 : s < 6 ? 0.12 : s === 10 || s === 11 ? 0.1 : 0;
    a += (1 - j / h) * 0.08;
    if (a > 0) P.px(X, Y, night ? 0x9fb4d8 : 0xeef7ff, a * str * (night ? 0.3 : 1));
  }
}
// lövklump: ljus uppe till vänster, taggig kant
function leaves(P, cx, cy, rx, ry, seed, dark, midc, light, dens = 0.55) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) continue;
    const h = hash(x, y, seed);
    if (d > 0.72 && h > dens) continue;
    const l = ((cx - x) / rx + (cy - y) / ry) * 0.45 + (h - 0.5) * 0.9;
    P.px(x, y, l > 0.35 ? light : l > -0.25 ? midc : dark);
  }
}
function blooms(P, x, y, w, h, seed, cols, dens = 0.18) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (hash(x + i, y + j, seed) > dens) continue;
    const c = cols[Math.floor(hash(x + i, y + j, seed + 1) * cols.length)];
    P.px(x + i, y + j, c);
    if (j > 0) P.px(x + i, y + j - 1, mix(c, WHITE, 0.35), 0.8);
  }
}
function brickPx(X, Y, base, seed, opt = {}) {
  const bw = opt.bw || 7, bh = opt.bh || 3;
  const row = Math.floor(Y / bh), ry = Y - row * bh;
  const xx = X + (row & 1 ? bw >> 1 : 0) + 64, col = Math.floor(xx / bw), rx = xx - col * bw;
  const mortar = opt.mortar ?? mix(base, 0xcfc4b0, 0.5);
  if (ry === bh - 1 || rx === bw - 1) return jit(mortar, X, Y, seed + 1, 0.08);
  const h = hash(col, row, seed);
  let c = h > 0.66 ? mix(base, 0xc8764e, 0.22) : h < 0.25 ? mix(base, 0x4a2418, 0.25) : base;
  if (hash(col, row, seed + 7) > 0.93) c = mix(c, 0x2a2a2a, 0.3);
  if (ry === 0) c = mix(c, WHITE, 0.1);
  if (rx === bw - 2) c = mul(c, 0.86);
  return jit(c, X, Y, seed, 0.07);
}
function tilePx(X, Y, y0, k) {
  const r = Math.floor((Y - y0) / 4), ry = Y - y0 - r * 4;
  const xx = X + (r & 1) * 2 + 20, c5 = Math.floor(xx / 5), rx = xx - c5 * 5;
  let c = mix(0xb4553a, hash(c5, r, 3) > 0.5 ? 0xcf7048 : 0x8a3a28, hash(c5, r, 4) * 0.55);
  c = mul(c, [1.16, 1.06, 0.97, 0.84, 0.64][rx] * k);
  if (ry === 3) c = mul(c, 0.62);
  else if (ry === 0) c = mix(c, 0xffe6c8, 0.1);
  if (hash(X >> 1, Y >> 1, 9) > 0.94 && ry < 3) c = mix(c, 0x6d7a3c, 0.4);
  return jit(c, X, Y, 5, 0.05);
}

// ---------- typsnitt: bitmappar, fetstil och Scale2x för stora skyltar ----------
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
// Scale2x (EPX): dubbla storleken men runda av diagonalerna – samma pixelkorn
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
// snötäcke på en vågrät yta: vit kant med lite blå skugga i underkant, dithrad så den ser pudrig ut
function snowCap(P, x, y, w, h = 2) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    if (j === h - 1 && h > 1) { if (bayer(X, Y) < 0.5) P.px(X, Y, 0xc8d8ea, 0.8); continue; }
    P.px(X, Y, j === 0 ? (hash(X, Y, 501) > 0.85 ? 0xdde8f4 : 0xf8fbff) : 0xeaf2fa);
  }
}
// snö på en större yta (tak): täcker nästan allt, lämnar lite av underlaget vid kanterna.
// keep(X, Y) → true lämnar pixeln orörd (skorstenar, kupor, aggregat som står på taket).
function snowArea(P, x, y, w, h, seed = 502, cover = 0.92, keep = null) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    if (keep && keep(X, Y)) return null;
    const edge = Math.min(i, w - 1 - i, j, h - 1 - j);
    const k = edge < 2 ? 0.6 : 1;
    if (hash(X, Y, seed) > cover * k) return null;
    return j === 0 ? 0xf8fbff : qmix(0xf2f6fc, 0xd4e0ee, j / Math.max(1, h - 1), X, Y, 3);
  });
}
// snö på alla fria överkanter i bilden (taknockar, skorstenar, skyltar, huvar)
function snowEdges(P) {
  const d = P.d, w = P.w, h = P.h;
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  for (let x = 0; x < w; x++) for (let y = 1; y < h - 6; y++) {
    if (!A(x, y) || A(x, y - 1)) continue;
    // bara riktiga kanter: minst tre pixlar i bredd som alla har fritt ovanför
    if (!((A(x - 1, y) && !A(x - 1, y - 1)) || (A(x + 1, y) && !A(x + 1, y - 1)))) continue;
    P.px(x, y - 1, hash(x, y, 503) > 0.8 ? 0xdde8f4 : 0xf8fbff);
    P.px(x, y, 0xeaf2fa, 0.85);
    y += 2;
  }
}

// ---------- Burgarbarens meny: rätter och priser från jobbet (laddas tåligt) ----------
let MENU = null;
try { MENU = (await import('../jobs/jobb-burgare.js')).burgarMeny?.() || null; } catch (e) { console.error('burgarmenyn kunde inte laddas:', e); }
// rätten utan kontur (pixelkartan direkt i Pix-pennan), nedre kanten vid y
function dishPx(P, d, x, yBottom) {
  const y0 = yBottom - d.map.length;
  d.map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = d.pal[row[i]]; if (c !== undefined) P.px(x + i, y0 + j, c); } });
}
const dishW = (d) => Math.max(...d.map.map((r) => r.length));

// ======================= dörrar =======================
// Svängdörr: förmålade bildrutor där bladet vrids inåt (smalnar, mörknar, fria kanten
// glider in i huset = lite uppåt). Skjutdörr: två glaspartier som glider in i väggfickor.
function swingFrames(S, w, h, hinge, edgeC, N = 7) {
  const frames = [], pws = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.32, sn = Math.sin(th);
    const pw = Math.max(2, Math.round(w * Math.cos(th))), lift = Math.round(sn * 6), shade = 1 - 0.38 * sn;
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
    if (k > 0) {
      const ex = hinge === 'l' ? pw : w - 1 - pw;
      if (ex >= 0 && ex < w) for (let y = 0; y < h - lift; y++) F.px(ex, y, y === 0 ? mul(edgeC, 0.6) : edgeC);
    }
    frames.push(F.flush());
    pws.push(pw);
  }
  return { frames, pws };
}
const DOOR_ART = {};
const DK = new Map();
function doorKit(b) {
  let K = DK.get(b.id);
  if (K) return K;
  const w = b.door.x1 - b.door.x0, spec = DOOR_ART[b.kind];
  const I = new Pix(w, DOOR_H);
  spec.interior(I, w, DOOR_H);
  K = { w, interior: I.flush(), slide: b.door.type === 'slide', hinge: spec.hinge || 'l' };
  if (K.slide) {
    const pw = w >> 1, rw = w - pw, Lp = new Pix(pw, DOOR_H), Rp = new Pix(rw, DOOR_H);
    spec.panel(Lp, pw, DOOR_H, 'l');
    spec.panel(Rp, rw, DOOR_H, 'r');
    Object.assign(K, { pw, rw, L: Lp.flush(), R: Rp.flush() });
  } else {
    const S = new Pix(w, DOOR_H);
    spec.leaf(S, w, DOOR_H);
    Object.assign(K, swingFrames(S, w, DOOR_H, K.hinge, spec.edge || 0x6a6a6a));
  }
  // ljuset som spiller ut på trottoaren (för 'lighter')
  const sw = w + 28, sh = 26, sp = new Pix(sw, sh);
  for (let y = 0; y < sh; y++) {
    const half = w / 2 + 1 + y * 0.5;
    for (let x = 0; x < sw; x++) {
      const dx = Math.abs(x + 0.5 - sw / 2);
      if (dx >= half) continue;
      const a = (1 - y / sh) * (1 - (dx / half) ** 2);
      const q = Math.floor(a * 4 + bayer(x, y)) / 4;
      if (q > 0) sp.px(x, y, spec.light || 0xffd890, q * 0.42);
    }
  }
  K.spill = sp.flush();
  DK.set(b.id, K);
  return K;
}
function drawDoorAt(ctx, K, x, y, f) {
  f = clamp(f || 0, 0, 1);
  ctx.drawImage(K.interior, x, y);
  if (K.slide) {
    const g = Math.round(f * K.pw), lw = K.pw - g, rw = K.rw - g;
    if (lw > 0) ctx.drawImage(K.L, g, 0, lw, DOOR_H, x, y, lw, DOOR_H);
    if (rw > 0) ctx.drawImage(K.R, 0, 0, rw, DOOR_H, x + K.w - rw, y, rw, DOOR_H);
  } else ctx.drawImage(K.frames[Math.round(f * (K.frames.length - 1))], x, y);
}
function doorGap(K, f) {
  if (K.slide) { const g = Math.round(f * K.pw); return [K.pw - g, K.w - (K.rw - g)]; }
  const pw = K.pws[Math.round(f * (K.frames.length - 1))];
  return K.hinge === 'l' ? [pw + 1, K.w] : [0, K.w - pw - 1];
}
function doorGlow(ctx, b, st, k) {
  const f = clamp(st.doorOpen || 0, 0, 1);
  if (f < 0.03) return;
  const K = doorKit(b), [g0, g1] = doorGap(K, f);
  ctx.globalCompositeOperation = 'lighter';
  if (g1 > g0) {
    ctx.globalAlpha = k * 0.5;
    ctx.drawImage(K.interior, g0, 0, g1 - g0, DOOR_H, b.door.x0 + g0, DT, g1 - g0, DOOR_H);
  }
  ctx.globalAlpha = k * f;
  ctx.drawImage(K.spill, b.door.x0 - 14, BASE);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ======================= rök =======================
let PUFFS = null;
function puffs() {
  if (PUFFS) return PUFFS;
  PUFFS = {};
  for (const [key, c0, c1] of [['light', 0xf6f4f0, 0xbab6b2], ['dark', 0xd2cec8, 0x6e6a66]]) {
    PUFFS[key] = [];
    for (let r = 2; r <= 9; r++) {
      const s = r * 2 + 2, P = new Pix(s, s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const dx = (x + 0.5 - s / 2) / r, dy = (y + 0.5 - s / 2) / r, d = Math.hypot(dx, dy);
        if (d > 1 || (d > 0.72 && bayer(x, y) < (d - 0.72) * 3.6)) continue;
        P.px(x, y, qmix(c1, c0, clamp(0.55 - dx * 0.35 - dy * 0.5, 0, 1), x, y, 3));
      }
      PUFFS[key].push(P.flush());
    }
  }
  return PUFFS;
}
function smoke(ctx, x, y, t, o) {
  const S = puffs()[o.tone || 'light'], n = o.n || 8, grow = o.grow || S.length;
  for (let i = n - 1; i >= 0; i--) {
    const life = (t * o.rate + i / n) % 1;
    const img = S[Math.min(S.length - 1, Math.floor(life * grow))];
    const px = x + life * o.drift + Math.sin(t * 0.9 + i * 2.1) * 2 * life, py = y - life * o.rise;
    ctx.globalAlpha = (1 - life) * Math.min(1, life / 0.08) * o.alpha;
    ctx.drawImage(img, Math.round(px - img.width / 2), Math.round(py - img.height / 2));
  }
  ctx.globalAlpha = 1;
}

// ======================= KAFÉ =======================
function sashWin(P, x, y, w, h, night, reg, o = {}) {
  const lit = night && o.lit !== false;
  area(P, x, y, w, h, (X, Y, i, j) => (lit ? qmix(0xffe6a8, 0xf0a850, j / h, X, Y, 3) : qmix(0x7a94a8, 0x2c3846, j / h, X, Y, 4)));
  if (o.curtain) {
    const cy = y + Math.round(h * 0.5);
    for (let yy = cy; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (yy === cy && (xx - x) % 3 === 1) continue;
      const lace = (xx + yy) % 4 === 0 && yy > cy + 1;
      P.px(xx, yy, lit ? 0xfff4dc : lace ? 0xc8c0b0 : 0xeee8da, yy === cy ? 0.8 : 0.94);
    }
  }
  if (!lit) reflect(P, x, y, w, h, false, 0.9, o.seed || 0);
  const cols = o.cols || 2, rws = o.rows || 3;
  for (let k = 1; k < cols; k++) P.vl(x + Math.round((k * w) / cols), y, h, 0xf2eee4);
  for (let k = 1; k < rws; k++) P.hl(x, y + Math.round((k * h) / rws), w, 0xf2eee4);
  P.box(x - 1, y - 1, w + 2, h + 2, 0xf7f3ea);
  P.darken(x, y, w, 1, 0.7);
  P.vl(x + w, y, h, 0xc8bca8);
  if (lit) {
    reg.win.push([x, y, w, h]);
    reg.halo.push([x + w / 2, y + h / 2, w * 0.8 + 3, h * 0.65 + 3, 0xffc27a, 0.32]);
  }
}
function kafeWin(P, x, y, w, h, night, reg, side) {
  area(P, x, y, w, h, (X, Y, i, j) => (night ? qmix(0xffe0a0, 0xd08a48, j / h, X, Y, 4) : qmix(0xa87650, 0x4e3222, j / h, X, Y, 4)));
  // bakre hyllan med burkar
  const sy = y + 8;
  for (let i = 1; i < w - 1; i += 3) {
    const c = [0xd8a050, 0xf0e0c0, 0xa0c070, 0xe07050][Math.floor(hash(x + i, y, 71) * 4)];
    P.rect(x + i, sy - 3, 2, 3, c);
    P.px(x + i, sy - 3, mix(c, WHITE, 0.45));
  }
  P.hl(x, sy, w, 0x3a2416);
  P.hl(x, sy + 1, w, 0x2a180e, 0.5);
  // pendellampa
  const lx = x + (w >> 1) + (side === 'l' ? 3 : -4);
  P.vl(lx, y, 2, 0x2a1a10);
  P.rect(lx - 2, y + 2, 5, 2, 0xc9a44a);
  P.hl(lx - 2, y + 2, 5, 0xf0d890);
  P.hl(lx - 1, y + 4, 3, 0xfff6d0);
  P.ell(lx + 0.5, y + 6, 6, 4, 0xfff0c0, night ? 0.5 : 0.3);
  // disken (marmorskiva + mörk front)
  const ly = y + h - 8;
  P.hl(x, ly, w, 0xf4eee4);
  P.hl(x, ly + 1, w, 0xc8beb0);
  area(P, x, ly + 2, w, h - 10, (X, Y, i, j) => (i % 8 === 0 ? 0x2e1a10 : jit(j === 0 ? 0x6a4028 : 0x4a2c1a, X, Y, 72, 0.08)));
  if (side === 'l') {
    // ormbunke i kruka
    P.rect(x + 1, ly - 4, 5, 4, 0xb8643a);
    P.hl(x + 1, ly - 4, 5, 0xd8845a);
    P.vl(x + 5, ly - 3, 3, 0x8a4a2a);
    for (const [ex, ey] of [[-1, -11], [2, -12], [5, -10], [7, -7], [-2, -7]]) P.line(x + 3, ly - 5, x + 3 + ex, ly - 5 + ey + 4, 0x3f7a34);
    for (const [ex, ey] of [[0, -9], [3, -10], [5, -6]]) P.line(x + 3, ly - 5, x + 3 + ex, ly - 5 + ey + 3, 0x6fae4a);
    // tårtställning i tre våningar
    const sx = x + 12;
    P.vl(sx, ly - 11, 11, 0xc8ccd2);
    for (const [py, pw] of [[ly - 3, 11], [ly - 7, 8], [ly - 11, 5]]) {
      P.hl(sx - (pw >> 1), py, pw, 0xf8f8f4);
      P.hl(sx - (pw >> 1), py + 1, pw, 0xb8bcc2, 0.8);
      for (let i = 0; i < pw - 1; i += 2) {
        const c = [0xf29ab0, 0x7a4424, 0xf6e6c0, 0xe0607a][Math.floor(hash(sx + i, py, 73) * 4)];
        P.rect(sx - (pw >> 1) + i, py - 2, 2, 2, c);
        P.px(sx - (pw >> 1) + i, py - 2, mix(c, WHITE, 0.4));
      }
    }
    P.px(sx, ly - 14, 0xd8303a);
    P.px(sx, ly - 15, 0x4a8a3a);
    // stor gräddtårta med jordgubbar och en tagen bit
    const kx = x + w - 9, ky = ly - 8;
    for (let j = 0; j < 8; j++) {
      const c = [0xfff6f2, 0xfff0f4, 0xf0d8a0, 0xe0607a, 0xf0d8a0, 0xfff6ea, 0xf0d8a0, 0xe8d0a0][j];
      for (let i = 0; i < 8; i++) P.px(kx + i, ky + j, i >= 5 && j > 1 ? mul(c, 0.9) : i === 0 ? mix(c, WHITE, 0.3) : c);
    }
    P.px(kx + 5, ky + 2, 0xe8d0a0);
    for (const i of [1, 3, 5]) { P.px(kx + i, ky - 1, 0xd8303a); P.px(kx + i, ky - 2, 0x4a8a3a); }
    P.hl(kx - 1, ky + 8, 10, 0xd8dce0);
    // kanelbullar på en plåt längst ner
    for (let i = 0; i < 4; i++) {
      const bx = x + 2 + i * 4, by = ly - 2;
      P.rect(bx, by, 3, 2, 0xb8743a);
      P.px(bx + 1, by, 0x7a4424);
      P.px(bx, by, 0xfff4e0);
    }
  } else {
    // griffeltavlan med menyn hänger i fönstret
    const bx = x + 2, by = y + 3, bw = w - 4, bh = 11;
    P.line(bx + 2, y, bx + 3, by, 0x6a5a4a);
    P.line(bx + bw - 3, y, bx + bw - 4, by, 0x6a5a4a);
    area(P, bx, by, bw, bh, (X, Y, i, j) => {
      if (i === 0 || j === 0) return 0xc8945a;
      if (i === bw - 1 || j === bh - 1) return 0x5a3a20;
      return hash(X, Y, 34) > 0.9 ? 0x3a4a40 : jit(0x26342c, X, Y, 35, 0.06);
    });
    text(P, SMALL, 'MENY', bx + ((bw - 15) >> 1), by + 2, 0xfaf6e8);
    for (let xx = bx + 2; xx < bx + bw - 2; xx += 2) P.px(xx, by + 8, 0xe07aa0);
    P.px(bx + bw - 3, by + 3, 0xffd23f);
    P.px(bx + 2, by + 3, 0xffd23f);
    // glaskupa med tårta, muffins och en krukväxt på disken
    const gx = x + 1;
    P.rect(gx + 1, ly - 4, 7, 3, 0x7a4424);
    P.hl(gx + 1, ly - 4, 7, 0xfff0f4);
    P.px(gx + 4, ly - 5, 0xd8303a);
    P.hl(gx, ly - 1, 9, 0xd8dce0);
    for (const [xx, yy] of [[0, -2], [0, -3], [1, -4], [1, -5], [2, -6], [3, -6], [4, -6], [5, -6], [6, -6], [7, -5], [7, -4], [8, -3], [8, -2]]) P.px(gx + xx, ly + yy, 0xe8f6ff, 0.75);
    for (let i = 0; i < 3; i++) {
      const mx = x + 11 + i * 3, my = ly - 4;
      P.rect(mx, my + 2, 2, 2, 0xd8b890);
      P.px(mx, my + 3, 0xa8845a);
      const c = [0xf29ab0, 0xfff4ea, 0x7a4424][i];
      P.rect(mx, my, 2, 2, c);
      P.px(mx, my, mix(c, WHITE, 0.4));
      P.px(mx + 1, my - 1, 0xd8303a);
    }
    P.rect(x + w - 5, ly - 3, 4, 3, 0xe8e0d0);
    P.hl(x + w - 5, ly - 3, 4, 0xffffff);
    leaves(P, x + w - 3, ly - 7, 3.5, 4, 74, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.7);
  }
  reflect(P, x, y, w, h, night, 0.95, x);
  reg.win.push([x, y, w, h]);
  reg.halo.push([x + w / 2, y + h / 2, w * 0.7 + 4, h * 0.6 + 3, 0xffc070, 0.3]);
  reg.halo.push([x + w / 2, BASE + 7, w * 0.6 + 5, 8, 0xffb060, 0.22]);
}

function paintKafe(P, b, night, reg, opts = {}) {
  const L = ART_OVER, W = b.w, R = L + W, T = BASE - b.h, cx = L + (W >> 1);
  const d0 = b.door.x0 - b.x + L, d1 = b.door.x1 - b.x + L;
  const EAVE = T - 2, RIDGE = TOP + 12;
  // ---- taket: tegelpannor, bakre fallet i skugga ----
  area(P, L - 2, TOP, W + 4, RIDGE - TOP, (X, Y) => tilePx(X, Y, TOP, 0.6));
  area(P, L - 3, RIDGE + 1, W + 6, EAVE - RIDGE - 1, (X, Y) => tilePx(X, Y, RIDGE + 1, 1 + ((EAVE - Y) / (EAVE - RIDGE)) * 0.1));
  for (const [x, c1, c2] of [[L - 5, 0xf0e8da, 0xb8ac98], [R + 3, 0xd8cfbe, 0x8e8474]]) { P.vl(x, RIDGE, EAVE - RIDGE, c1); P.vl(x + 1, RIDGE, EAVE - RIDGE, c2); }
  for (let x = L - 4; x < R + 4; x++) {
    const s = (x - L + 40) % 6;
    P.px(x, RIDGE - 1, s === 0 ? 0x7a3222 : 0xc8694a);
    P.px(x, RIDGE, s === 0 ? 0x6a2a1c : 0xa84a32);
    P.px(x, RIDGE + 1, 0x5a2216);
  }
  // skorsten med två rökhattar
  const chx = R - 24, chTop = TOP - 10, chBot = RIDGE + 18;
  area(P, chx, chTop, 9, chBot - chTop, (X, Y, i) => mul(brickPx(X, Y, 0x9a4632, 51, { bw: 5 }), [1.14, 1.06, 1, 1, 1, 0.95, 0.9, 0.82, 0.7][i]));
  P.rect(chx - 1, chTop - 2, 11, 2, 0xb8b0a4);
  P.hl(chx - 1, chTop - 2, 11, 0xdcd6cc);
  P.hl(chx, chTop, 9, 0x3a2a20, 0.45);
  P.rect(chx + 1, chTop - 6, 3, 4, 0xb86a44); P.vl(chx + 1, chTop - 6, 4, 0xd88a5c); P.hl(chx + 1, chTop - 6, 3, 0x3a2418);
  P.rect(chx + 5, chTop - 5, 3, 3, 0xa85a3a); P.vl(chx + 5, chTop - 5, 3, 0xc87a50); P.hl(chx + 5, chTop - 5, 3, 0x3a2418);
  P.rect(chx - 1, chBot - 2, 11, 2, 0x8a9096); P.hl(chx - 1, chBot - 2, 11, 0xb8bec4);
  reg.smoke = [chx + 2, chTop - 7];
  // takkupa med sadeltak
  const dTop = EAVE - 24, dBot = EAVE - 1;
  area(P, cx - 10, dTop, 21, dBot - dTop, (X, Y, i) => jit(i === 0 ? 0xcdb998 : i === 20 ? 0xa89878 : 0xecdcbc, X, Y, 61, 0.06));
  sashWin(P, cx - 6, dTop + 4, 13, dBot - dTop - 7, night, reg, { cols: 2, rows: 2, curtain: true, seed: 3 });
  P.darken(cx - 10, dTop, 21, 2, 0.72);
  // kupans gavel: putsad trekant med vita vindskivor och ett runt ventilhål
  for (let j = 0; j < 11; j++) {
    const y = dTop - 11 + j, half = 1 + Math.round(j * 1.3);
    for (let x = cx - half; x <= cx + half; x++) {
      const e = Math.abs(x - cx);
      P.px(x, y, e >= half - 1 ? (x < cx ? 0xfaf4e8 : 0xd8cfbe) : e === half - 2 ? 0xa89878 : jit(x > cx + 3 ? 0xdcc8a4 : 0xeadabc, x, y, 62, 0.06));
    }
  }
  P.rect(cx - 1, dTop - 5, 3, 3, 0x4a3a30);
  P.px(cx - 1, dTop - 5, 0xf6eedc); P.px(cx + 1, dTop - 5, 0xf6eedc); P.px(cx - 1, dTop - 3, 0xf6eedc); P.px(cx + 1, dTop - 3, 0xf6eedc);
  P.hl(cx - 14, dTop, 29, 0x6a4a3a);
  // takränna
  rows(P, L - 5, EAVE, W + 10, [0xd2d7dc, 0x7d848c]);
  for (let x = L - 4; x < R + 4; x += 12) P.px(x, EAVE + 1, 0x4a5058);

  // ---- gesims ----
  const cor = [0xf6ecd8, 0xe0cfae, 0xb09c7c, -1, 0xd4c3a2, 0x8b785a];
  cor.forEach((c, i) => area(P, L - 1, T + i, W + 2, 1, (X, Y) => (c < 0 ? ((X % 3) < 2 ? 0xe9dcc0 : 0x8f7c5c) : jit(c, X, Y, 11, 0.04))));
  // ---- övervåningen: puts, två fönster med blomlådor, guldskylt ----
  const U0 = T + 6, U1 = T + 32;
  area(P, L, U0, W, U1 - U0, (X, Y, i, j) => {
    let c = qmix(0xeedfc0, 0xd6c29c, j / (U1 - U0), X, Y, 3);
    if (hash(X >> 2, Y >> 1, 12) > 0.93) c = mul(c, 0.95);
    return jit(c, X, Y, 13, 0.07);
  });
  P.darken(L, U0, W, 1, 0.8);
  for (const wx of [L + 3, R - 17]) {
    area(P, wx - 2, T + 8, 18, 20, (X, Y) => jit(0xf6eedc, X, Y, 14, 0.05));
    P.rect(wx + 5, T + 6, 4, 3, 0xf8f2e4);
    P.hl(wx + 5, T + 9, 4, 0xb8a888);
    sashWin(P, wx, T + 10, 14, 15, night, reg, { cols: 2, rows: 3, curtain: true, seed: wx, lit: wx < cx });
    // blomlåda med pelargoner
    P.rect(wx - 2, T + 26, 18, 3, 0x7a4a2a);
    P.hl(wx - 2, T + 26, 18, 0xa0683c);
    P.hl(wx - 2, T + 28, 18, 0x4a2a16);
    leaves(P, wx + 7, T + 24, 9, 2.6, 15 + wx, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.7);
    blooms(P, wx - 1, T + 22, 16, 4, 16 + wx, [0xe8303a, 0xff5a6a, 0xf07ab0], 0.22);
    P.darken(wx - 2, T + 29, 18, 1, 0.8);
  }
  const kb = bits(BIG, 'KAFÉ', { x2: true, gap: 1 }), kx = cx - (kb.w >> 1), ky = T + 13;
  sign(P, kb, kx, ky, { shadow: 0x5a4226, sa: 0.5, outline: 0x3a2814, fill: (i, j, X, Y) => qmix(0xf8dc84, 0xc38f2c, j / kb.h, X, Y, 3), hi: 0xfff6cc, lo: 0x8a6220 });
  // svanhalslampor över skylten
  for (const lx of [kx - 3, kx + kb.w + 2]) {
    P.vl(lx, T + 7, 3, 0x2a2420);
    P.rect(lx - 1, T + 6, 3, 2, 0x2f5b46);
    P.px(lx, T + 8, 0xfff0b0);
    reg.halo.push([lx + 0.5, T + 14, 5, 8, 0xffd890, 0.3]);
  }
  // mellanlist
  rows(P, L - 1, U1, W + 2, [0xf6ecd8, 0x9c8868]);

  // ---- butiksfronten i grönmålat trä ----
  const A0 = U1 + 2, AS = 9, AV = 5, SF = A0 + AS;
  area(P, L, SF, W, BASE - SF, (X, Y) => jit(0x2f5b46, X, Y, 31, 0.06));
  for (const px0 of [L, R - 4]) {
    area(P, px0, SF, 4, BASE - SF - 3, (X, Y, i) => jit([0x4f8468, 0x3a6a52, 0x2f5b46, 0x1c3a2c][i], X, Y, 32, 0.05));
    P.hl(px0, SF + 7, 4, 0xc9a44a);
  }
  const wy = SF + 9, wh = 27;
  const wins = [[L + 5, d0 - 4 - (L + 5), 'l'], [d1 + 4, R - 5 - (d1 + 4), 'r']];
  for (const [wx, ww, side] of wins) {
    P.box(wx - 2, wy - 2, ww + 4, wh + 4, 0x1c3a2c);
    P.box(wx - 1, wy - 1, ww + 2, wh + 2, 0xc9a44a);
    kafeWin(P, wx, wy, ww, wh, night, reg, side);
    P.hl(wx - 2, wy + wh + 2, ww + 4, 0x5a8a70);
    // bröstning: infälld spegel med guldlinje
    const ry = wy + wh + 3, rh = BASE - 3 - ry;
    P.bevel(wx, ry, ww, rh, 0x1a3528, 0x4f8468);
    P.box(wx + 2, ry + 2, ww - 4, rh - 4, 0xb8943a);
  }
  // sockel i granit
  area(P, L, BASE - 3, W, 3, (X, Y, i, j) => jit(j === 0 ? 0x9a968e : 0x77736e, X, Y, 33, 0.22));
  // dörrkarm + överljus med guldtext
  for (const fx of [d0 - 2, d1]) { P.vl(fx, DT - 7, BASE - DT + 7, 0x1c3a2c); P.vl(fx + 1, DT - 7, BASE - DT + 7, 0x4f8468); }
  area(P, d0, DT - 7, d1 - d0, 6, (X, Y, i, j) => (night ? qmix(0xffe6a8, 0xf0b060, j / 6, X, Y, 2) : qmix(0x8aa0b0, 0x4a5a68, j / 6, X, Y, 2)));
  text(P, SMALL, 'FIKA', ((d0 + d1) >> 1) - 7, DT - 6, 0xe8c050);
  P.hl(d0, DT - 1, d1 - d0, 0x1c3a2c);
  P.hl(d0 - 2, DT - 8, d1 - d0 + 4, 0x4f8468);
  if (night) reg.win.push([d0, DT - 7, d1 - d0, 6]);

  // ---- markisen: randig duk med bågkappa ----
  const n = 14;
  for (let j = 0; j < AS; j++) {
    const y = A0 + j, t = j / (AS - 1);
    const l = Math.round(L - 1 - t * 5), r = Math.round(R + 1 + t * 5);
    for (let x = l; x < r; x++) {
      const u = (x - l) / (r - l), s = Math.floor(u * n) & 1;
      let c = mul(s ? 0xf2e6cc : 0xc63a3c, 0.74 + 0.28 * t);
      if (j === AS - 1) c = mix(c, WHITE, 0.2);
      if (j === 0) c = mul(c, 0.8);
      P.px(x, y, jit(c, x, y, 21, 0.05));
    }
  }
  const vl = L - 6, vr = R + 6;
  reg.bulbs = [];
  for (let j = 0; j < AV + 2; j++) {
    const y = A0 + AS + j;
    for (let x = vl; x < vr; x++) {
      const u = (x - vl) / (vr - vl), k = Math.floor(u * n), cu = u * n - k;
      if (j >= AV && Math.abs(cu - 0.5) * 2 > (j === AV ? 0.8 : 0.45)) continue;
      const c = mul(k & 1 ? 0xe9dcc0 : 0xb53234, j === 0 ? 1.02 : j >= AV - 1 ? 0.8 : 0.9);
      P.px(x, y, jit(c, x, y, 22, 0.04));
    }
  }
  for (let k = 0; k < n; k++) reg.bulbs.push([Math.round(vl + ((k + 0.5) * (vr - vl)) / n), A0 + AS + AV + 2, [0xffe0a0, 0xffb8c8, 0xfff4d0][k % 3]]);
  // markisarmar i smide
  P.line(L - 1, A0 + 1, L - 5, A0 + AS - 1, 0x2a2420);
  P.line(R, A0 + 1, R + 4, A0 + AS - 1, 0x2a2420);
  // markisens skugga på fronten
  [0.55, 0.65, 0.75, 0.85, 0.93].forEach((f, i) => P.darken(L, A0 + AS + AV + 1 + i, W, 1, f));

  // ---- hängskylt i smide: kaffekopp ----
  const hy = T + 12;
  P.hl(L - 7, hy, 8, 0x2a2420);
  P.px(L - 7, hy - 1, 0x2a2420);
  P.px(L - 6, hy - 2, 0x2a2420);
  P.line(L - 1, hy + 1, L - 1, hy + 3, 0x2a2420);
  P.vl(L - 6, hy + 1, 2, 0x5a5048);
  P.vl(L - 2, hy + 1, 2, 0x5a5048);
  area(P, L - 7, hy + 5, 5, 5, (X, Y, i, j) => (j === 4 && (i === 0 || i === 4) ? null : [0xffffff, 0xf4efe6, 0xe8e0d4, 0xe8e0d4, 0xc8bcac][i]));
  P.hl(L - 7, hy + 5, 5, 0x6a3a1c);
  P.px(L - 2, hy + 6, 0xe0d8cc); P.px(L - 1, hy + 7, 0xe0d8cc); P.px(L - 2, hy + 8, 0xe0d8cc);
  P.hl(L - 8, hy + 10, 8, 0xd8d0c4);
  P.px(L - 5, hy + 3, 0xf4f4f4, 0.7); P.px(L - 4, hy + 2, 0xf4f4f4, 0.5);
  // ---- stuprör, tröskel, kontaktskugga ----
  P.vl(R - 2, T, BASE - T, 0xaeb4ba);
  P.vl(R - 1, T, BASE - T, 0x6d737a);
  for (let y = T + 12; y < BASE; y += 18) P.hl(R - 3, y, 3, 0x4a5058);
  P.rect(L, BASE, W, 1, 0x1a1418, 0.35);
  P.rect(L, BASE + 1, W, 1, 0x1a1418, 0.15);
  rows(P, d0 - 2, BASE, d1 - d0 + 4, [0xd8d0c0, 0x9a9282]);
  // ---- snö: båda takfallen (skorsten och kupa lämnas), nocken, rännan, lister, blomlådor ----
  if (opts.snow) {
    const keep = (X, Y) => (X >= chx - 1 && X < chx + 10 && Y >= chTop - 6 && Y < chBot)
      || (Y >= dTop - 11 && Y < dTop && Math.abs(X - cx) <= 1 + Math.round((Y - (dTop - 11)) * 1.3))
      || (Y >= dTop && Y < dBot && Math.abs(X - cx) <= 10);
    snowArea(P, L - 2, TOP + 1, W + 4, RIDGE - TOP - 2, 506, 0.85, keep);
    snowArea(P, L - 3, RIDGE + 3, W + 6, EAVE - RIDGE - 4, 507, 0.9, keep);
    snowCap(P, L - 4, RIDGE - 2, W + 8, 2);
    snowCap(P, L - 5, EAVE - 1, W + 10, 1);
    // kupans vindskivor får en vit kant
    for (let j = 1; j < 11; j++) { const half = 1 + Math.round(j * 1.3), y = dTop - 11 + j; P.px(cx - half, y, 0xf8fbff); P.px(cx + half, y, 0xf8fbff); }
    for (const wx of [L + 3, R - 17]) snowCap(P, wx - 2, T + 22, 18, 2);
    snowCap(P, L - 1, U1 - 1, W + 2, 1);
    snowCap(P, L - 1, A0, W + 2, 1);
    snowCap(P, d0 - 2, DT - 9, d1 - d0 + 4, 1);
  }
}
DOOR_ART.kafe = {
  hinge: 'r', light: 0xffc27a, edge: 0x1c3a2c,
  interior(I, w, h) {
    area(I, 0, 0, w, h, (X, Y, i, j) => qmix(0xfbe6c0, 0xe8b878, j / 26, X, Y, 4));
    I.ell(w / 2, 6, 10, 7, 0xfff8e8, 0.55);
    I.vl(w >> 1, 0, 3, 0x3a2a1a);
    I.rect((w >> 1) - 2, 3, 5, 2, 0xc9a44a);
    I.hl((w >> 1) - 1, 5, 3, 0xfff6d0);
    area(I, 2, 7, 9, 7, (X, Y, i, j) => (i === 0 || j === 0 || i === 8 || j === 6 ? 0x8a5a34 : 0x2a3530));
    for (const yy of [9, 11]) for (let x = 4; x < 9; x++) if (hash(x, yy, 5) > 0.3) I.px(x, yy, 0xe8e4d4);
    I.rect(14, 12, 7, 6, 0xc8ccd2); I.hl(14, 12, 7, 0xeef2f6); I.vl(20, 12, 6, 0x8a9098);
    I.px(16, 14, 0xff4030); I.rect(15, 17, 5, 1, 0x3a3a40);
    // baristan bakom disken
    I.rect(7, 12, 6, 6, 0x3a2a24); I.rect(8, 13, 4, 5, 0xf4efe6); I.vl(7, 12, 6, 0x5a4034);
    I.rect(8, 8, 4, 4, 0xe0a97f); I.hl(8, 7, 4, 0x3b2619); I.px(8, 8, 0x3b2619); I.px(10, 9, 0x3a2a24);
    I.rect(0, 18, w, 1, 0xf4eee4); I.rect(0, 19, w, 1, 0xc8beb0);
    area(I, 0, 20, w, 7, (X, Y, i, j) => (i % 7 === 0 ? 0x3a2416 : jit(0x6a4028, X, Y, 6, 0.08)));
    for (let x = 1; x < 12; x += 3) I.rect(x, 16, 2, 2, [0xf29ab0, 0xb8743a, 0xf6e6c0, 0xe0607a][(x / 3) | 0]);
    for (let y = 27; y < h; y++) for (let x = 0; x < w; x++) I.px(x, y, ((x >> 1) + y) & 1 ? 0xf2ece0 : 0x4a4038);
  },
  leaf(S, w, h) {
    area(S, 0, 0, w, h, (X, Y) => jit(0x2f5b46, X, Y, 81, 0.06));
    S.bevel(0, 0, w, h, 0x4f8468, 0x1c3a2c);
    const gx = 3, gy = 3, gw = w - 6, gh = 15;
    S.erase(gx, gy, gw, gh);
    areaA(S, gx, gy, gw, gh, 0xb8d4dc, (X, Y, i, j) => 0.2 + ((((i * 2 - j * 3) % 23) + 23) % 23 < 3 ? 0.4 : 0));
    S.box(gx - 1, gy - 1, gw + 2, gh + 2, 0x1c3a2c);
    S.hl(gx - 1, gy + gh, gw + 2, 0x4f8468);
    S.vl(gx + (gw >> 1), gy, gh, 0x2f5b46);
    const py = gy + gh + 3;
    S.bevel(4, py, w - 8, h - py - 5, 0x1c3a2c, 0x4f8468);
    S.box(6, py + 2, w - 12, h - py - 9, 0xb8943a);
    S.rect(1, h - 4, w - 2, 3, 0xc9a44a);
    S.hl(1, h - 4, w - 2, 0xf0d890);
    S.hl(1, h - 2, w - 2, 0x8a6a24);
    S.rect(2, 17, 2, 3, 0xd8b45a);
    S.px(2, 17, 0xfff0b0);
  },
};
const KAFE = {
  paint: paintKafe,
  live(ctx, b, st, reg) {
    if (reg.smoke) smoke(ctx, b.x - ART_OVER + reg.smoke[0], reg.smoke[1], st.t, { tone: 'light', rate: 0.1, n: 6, drift: 12, rise: 26, alpha: 0.35, grow: 4 });
  },
  glow(ctx, b, st, k, reg) {
    const ox = b.x - ART_OVER;
    // ljusslinga längs markisens kappa
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < reg.bulbs.length; i++) {
      const [x, y, c] = reg.bulbs[i];
      const tw = 0.75 + 0.25 * Math.sin(st.t * 3 + i * 1.7);
      ctx.fillStyle = rgb(c);
      ctx.globalAlpha = k * 0.25 * tw;
      ctx.fillRect(ox + x - 1, y - 1, 3, 3);
      ctx.globalAlpha = k * 0.12 * tw;
      ctx.fillRect(ox + x - 2, y + 2, 5, 4);
      ctx.globalAlpha = k * tw;
      ctx.fillRect(ox + x, y, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },
};

// ======================= BURGARBAREN =======================
function seatBack(P, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (j === 0 && (i === 0 || i === w - 1)) continue;
    let c = [0xe8505a, 0xc42a38, 0x9a1e2c, 0xc42a38, 0x8a1a26][Math.min(4, i)];
    if (j === 0) c = 0xd8dde2;
    else if (j === 1) c = mix(c, WHITE, 0.25);
    else if (i === 2 && j % 3 === 0) c = 0x6a1420;
    P.px(x + i, y + j, c);
  }
}
function chromeFrame(P, x, y, w, h, body) {
  P.box(x - 2, y - 2, w + 4, h + 4, 0x7a8088);
  P.box(x - 1, y - 1, w + 2, h + 2, 0xe8ecf0);
  P.hl(x - 1, y + h, w + 2, 0xa8aeb6);
  for (const [cx, cy] of [[x - 2, y - 2], [x + w + 1, y - 2], [x - 2, y + h + 1], [x + w + 1, y + h + 1]]) P.px(cx, cy, body);
}
function diner(P, x, y, w, h, night, reg) {
  area(P, x, y, w, h, (X, Y, i, j) => {
    let c = night ? qmix(0xfff4e0, 0xf2d4b4, j / h, X, Y, 3) : qmix(0xc2e4d6, 0x80ac9e, j / h, X, Y, 3);
    if (j === 5 || j === 6) c = night ? 0xff9ab0 : 0xd86a80;
    else if (j > 6 && (i % 4 === 0 || j % 4 === 0)) c = mul(c, 0.93);
    return c;
  });
  const bw = Math.floor(w / 2);
  for (let k = 0; k < 2; k++) {
    const bx = x + k * bw, mid = bx + (bw >> 1);
    P.vl(mid, y, 3, 0x2a2a30);
    P.rect(mid - 1, y + 3, 3, 2, 0xfff8e8);
    P.hl(mid - 1, y + 5, 3, 0xd8c8a8);
    P.ell(mid + 0.5, y + 6, 6, 4, 0xfff4d0, night ? 0.5 : 0.25);
    // gäster
    if (hash(bx, y, 201) > 0.3) {
      const sc = [0x3a7bd5, 0xf0c040, 0x7ac070, 0xe07a30][Math.floor(hash(bx, y, 202) * 4)];
      const skin = [0xe0a97f, 0xa86a44, 0xf0c8a0][Math.floor(hash(bx, y, 203) * 3)];
      P.rect(bx + 7, y + 16, 4, 7, sc);
      P.vl(bx + 7, y + 16, 7, mix(sc, WHITE, 0.3));
      P.rect(bx + 7, y + 12, 3, 4, skin);
      P.hl(bx + 7, y + 11, 3, [0x3b2619, 0xe8c070, 0x1a1a1a][Math.floor(hash(bx, y, 204) * 3)]);
    }
    if (hash(bx, y, 205) > 0.55) {
      const sc = [0xd83a5a, 0x5a4ac0, 0x40a0a0][Math.floor(hash(bx, y, 206) * 3)];
      P.rect(bx + bw - 11, y + 16, 4, 7, sc);
      P.rect(bx + bw - 10, y + 12, 3, 4, 0xe0a97f);
      P.hl(bx + bw - 10, y + 11, 3, 0x6a3a1a);
    }
    seatBack(P, bx + 1, y + 13, 5, h - 13);
    seatBack(P, bx + bw - 6, y + 13, 5, h - 13);
    const tx = bx + 6, tw = bw - 12, ty = y + 22;
    P.hl(tx, ty, tw, 0xf8f8f6);
    P.hl(tx, ty + 1, tw, 0xb8bec6);
    P.vl(tx + (tw >> 1), ty + 2, h - 24, 0x8a9098);
    P.rect(tx + 1, ty - 4, 1, 4, 0xd8303a); P.px(tx + 1, ty - 5, 0xffffff);
    P.rect(tx + 2, ty - 3, 1, 3, 0xf0c020);
    // milkshake med sugrör och körsbär
    const mx = tx + tw - 4;
    P.rect(mx, ty - 5, 3, 5, 0xf6a8c0);
    P.hl(mx, ty - 5, 3, 0xffffff);
    P.px(mx + 1, ty - 6, 0xd8303a);
    P.vl(mx + 2, ty - 9, 3, 0xe84a5a);
    P.vl(mx, ty - 4, 4, 0xffe0ec);
  }
  reflect(P, x, y, w, h, night, 0.9, x + 7);
  reg.win.push([x, y, w, h]);
  reg.halo.push([x + w / 2, y + h / 2, w * 0.6 + 4, h * 0.6 + 3, 0xffe0c0, 0.28]);
  reg.halo.push([x + w / 2, BASE + 7, w * 0.55 + 4, 8, 0xffc8a0, 0.2]);
}
function giantBurger(P, cx, by) {
  const hw = 30;
  // ställning
  for (const lx of [cx - 18, cx + 16]) { P.vl(lx, by - 7, 8, 0x4a4e56); P.vl(lx + 1, by - 7, 8, 0x9aa0a8); }
  P.hl(cx - 19, by - 4, 38, 0x6a6e76);
  P.hl(cx - 22, by + 1, 44, 0x2a2c32, 0.6);
  const yb = by - 13, yp = by - 20, yc = by - 22, yt = by - 25, yl = by - 28, yd = by - 46;
  // underbröd
  for (let j = 0; j < 6; j++) {
    const w = hw - (j === 5 ? 3 : j === 4 ? 1 : 0), y = yb + j;
    for (let x = -w; x < w; x++) {
      let c = j === 0 ? 0xf2d09a : j === 1 ? 0xe8a650 : j < 4 ? 0xd08a3a : 0x9a5a1e;
      if (x < -w + 3) c = mix(c, WHITE, 0.12); else if (x > w - 4) c = mul(c, 0.8);
      P.px(cx + x, y, jit(c, cx + x, y, 211, 0.05));
    }
  }
  // köttet
  for (let j = 0; j < 7; j++) {
    const w = hw + 1 - (j === 0 || j === 6 ? 1 : 0), y = yp + j;
    for (let x = -w; x < w; x++) {
      const h = hash(cx + x, y, 212);
      let c = j === 0 ? 0x8a5234 : j === 6 ? 0x3a1e12 : 0x6a3a24;
      if (h > 0.8) c = 0x8a5234; else if (h < 0.18) c = 0x4a2618;
      if (x > w - 4) c = mul(c, 0.78);
      P.px(cx + x, y, c);
    }
  }
  // ost med droppar
  for (let j = 0; j < 2; j++) for (let x = -hw - 2; x < hw + 2; x++) P.px(cx + x, yc + j, j === 0 ? 0xffe060 : 0xf0b020);
  for (const [dx, len] of [[-24, 4], [-10, 3], [4, 5], [19, 3]]) for (let k = 0; k < len; k++) { const ww = Math.max(1, 3 - k); P.hl(cx + dx - (ww >> 1), yc + 2 + k, ww, k === 0 ? 0xf0b020 : 0xe0a018); }
  // tomat
  for (let j = 0; j < 3; j++) for (let x = -hw - 1; x < hw + 1; x++) {
    let c = [0xf0584a, 0xc8302a, 0x8a1e1e][j];
    if (j === 1 && hash(cx + x, yt, 213) > 0.85) c = 0xf8b060;
    P.px(cx + x, yt + j, c);
  }
  // sallad
  for (let x = -hw - 3; x < hw + 3; x++) {
    const top = yl + (Math.sin(x * 0.9) > 0.2 ? 0 : 1), bot = yl + 2 + (Math.sin(x * 0.7 + 1) > 0.3 ? 1 : 0);
    for (let y = top; y <= bot; y++) P.px(cx + x, y, y === top ? 0x9ae05a : y === bot ? 0x3a7a2a : 0x5aa83a);
  }
  // överbröd: kupol med sesamfrön, ljus uppe till vänster
  const dh = yl - yd;
  for (let j = 0; j < dh; j++) {
    const v = (dh - j - 0.5) / dh, w = Math.round(hw * Math.sqrt(Math.max(0, 1 - v * v)) + 0.5);
    for (let x = -w; x < w; x++) {
      const l = 0.55 - 0.45 * (x / hw) + 0.4 * v - (j === dh - 1 ? 0.35 : 0);
      const X = cx + x, Y = yd + j;
      let c = l > 0.95 ? 0xffd488 : l > 0.62 ? 0xf0aa4c : l > 0.3 ? 0xd88a34 : 0xa8581a;
      if (Math.abs(x) >= w - 1 && j < dh - 1) c = mul(c, 0.85);
      P.px(X, Y, jit(c, X, Y, 214, 0.04));
    }
  }
  for (let k = 0; k < 26; k++) {
    const sx = cx + Math.round((hash(k, 1, 215) - 0.5) * hw * 1.6), sy = yd + 2 + Math.round(hash(k, 2, 215) * (dh - 6));
    const v = (dh - (sy - yd) - 0.5) / dh, w = hw * Math.sqrt(Math.max(0, 1 - v * v));
    if (Math.abs(sx - cx) > w - 3) continue;
    P.hl(sx, sy, 2, 0xfff3d6);
    P.px(sx + 1, sy + 1, 0xc07a30);
  }
  // flagga
  P.vl(cx + 7, yd - 7, 8, 0xe8d8b0);
  P.rect(cx + 8, yd - 7, 5, 3, 0xd8303a);
  P.hl(cx + 8, yd - 6, 5, 0xffffff);
}
// Menylådans geometri: hänger från neonbandets underkant ner till huven över dörren,
// lika bred som huven och med 1 px luft till fönstrens kromramar. Två kolumner om
// 16 px: rätten (12 px hög, utan kontur) över priset ('10:-' är 13 px, så det blir
// 3 px luft mellan priserna). Samma rätter och priser som på jobbet.
function menuGeom(d0, d1, S1) {
  const x = d0 - 5, w = d1 - d0 + 10, y = S1, h = DT - 7 - y;
  const head = { x: x + 1, y: y + 1, w: w - 2, h: 7 };
  const py = y + 9, ph = h - 10, cw = 16;
  const cells = [[x + 1, py], [x + 1 + cw, py], [x + 1, py + 19], [x + 1 + cw, py + 19]]; // 16 × 18 var
  return { x, y, w, h, head, panel: { x: x + 1, y: py, w: w - 2, h: ph }, cells, cw };
}
// den lilla dinerklockan ovanför högra fönstret: kromring, vit tavla, fyra timmarkeringar
function clockFace(P, cx, cy, night) {
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    const d = Math.hypot(x, y);
    if (d > 5.3) continue;
    let c;
    if (d > 4.3) c = x + y < -1 ? 0xf6f8fa : x + y > 3 ? 0x6a7078 : 0xc2c8d0;
    else c = night ? 0xfff6e0 : (x - y > 3 ? 0xdcdad4 : 0xf8f6f0);
    P.px(cx + x, cy + y, c);
  }
  for (const [x, y] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) P.px(cx + x, cy + y, 0x2a2c30);
  P.px(cx, cy, 0xd02a3e);
}
function paintBurgare(P, b, night, reg, opts = {}) {
  const L = ART_OVER, W = b.w, R = L + W, T = BASE - b.h, cx = L + (W >> 1);
  const d0 = b.door.x0 - b.x + L, d1 = b.door.x1 - b.x + L;
  // krönet reser sig 12 px över fotavtryckets topp så att menylådan får plats över dörren
  const PT = T - 12;
  // ---- platt tak med grus, aggregat och jätteburgaren ----
  area(P, L, TOP, W, PT - TOP, (X, Y, i, j) => {
    let c = qmix(0x4a4c52, 0x62646a, j / (PT - TOP), X, Y, 3);
    const h = hash(X, Y, 41);
    if (h > 0.86) c = mix(c, 0x8a8c90, 0.5); else if (h < 0.1) c = mul(c, 0.8);
    return c;
  });
  rows(P, L, TOP, W, [0x9aa0a8, 0x7a7e86, 0x2e3036]);
  P.vl(L, TOP, PT - TOP, 0x8a8e96);
  P.vl(R - 1, TOP, PT - TOP, 0x3a3c42);
  // takbrunn med galler och en avrunnen fläck
  P.ell(L + 46, PT - 8, 6, 2.5, 0x2e3036, 0.5, 3);
  P.rect(L + 44, PT - 9, 5, 3, 0x3a3c42); P.hl(L + 44, PT - 9, 5, 0x6a6e76); P.px(L + 46, PT - 8, 0x1a1c20);
  // kylaggregat
  const ax = R - 32, ay = PT - 30;
  P.darken(ax + 2, ay + 16, 24, 3, 0.7);
  area(P, ax, ay, 24, 4, (X, Y, i, j) => (j === 0 ? 0xdfe3e8 : 0xc2c8ce));
  P.ell(ax + 12, ay + 2, 6, 1.6, 0x2a2c32, 1, 2);
  P.hl(ax + 7, ay + 2, 11, 0x3a3c42);
  area(P, ax, ay + 4, 24, 12, (X, Y, i, j) => (i % 3 === 0 ? 0x7a8088 : j === 0 ? 0xc8ced4 : jit(0xa8aeb6, X, Y, 42, 0.05)));
  P.vl(ax + 23, ay, 16, 0x6a7078);
  reg.fan = [ax + 12, ay + 2];
  // ventilationshuvar
  for (const vx of [L + 10, L + 20]) { P.rect(vx, PT - 16, 3, 8, 0x8a9098); P.vl(vx, PT - 16, 8, 0xc8ced4); P.rect(vx - 1, PT - 18, 5, 2, 0x6a7078); P.hl(vx - 1, PT - 18, 5, 0xaab0b8); }
  giantBurger(P, cx - 4, PT - 3);
  reg.halo.push([cx - 4, PT - 26, 38, 26, 0xffc070, 0.22]);
  // strålkastare på taket som lyser upp jätteburgaren (tänds i glow)
  for (const sx of [cx - 34, cx + 26]) { P.rect(sx, PT - 6, 4, 3, 0x3a3c42); P.hl(sx, PT - 6, 4, 0x8a9098); P.px(sx + 1, PT - 5, night ? 0xfff4c0 : 0xc8ced4); P.px(sx + 2, PT - 5, night ? 0xfff4c0 : 0xc8ced4); P.vl(sx + 1, PT - 3, 3, 0x5a5e66); }
  reg.spots = [[cx - 32, PT - 5], [cx + 28, PT - 5]];

  // ---- fasaden: krom, rött och vitt ----
  rows(P, L, PT, W, [0xf6f8fa, 0xc2c8d0, 0x7a808a]);
  const S0 = PT + 3, S1 = PT + 24;
  area(P, L, S0, W, S1 - S0, (X, Y, i, j) => qmix(0x262a34, 0x14161c, j / (S1 - S0), X, Y, 3));
  P.hl(L, S0, W, 0x3a3f4c);
  P.hl(L, S1 - 1, W, 0x0a0b0e);
  reg.bulbs = [];
  for (let x = L + 3; x < R - 3; x += 4) for (const y of [S0 + 1, S1 - 2]) {
    P.px(x, y, 0x6a5a30);
    P.px(x + 1, y, 0x2a2618);
    reg.bulbs.push([x, y]);
  }
  const nb = bits(BIG, b.sign || 'BURGARBAREN', { x2: true, gap: 1 }), nx = cx - (nb.w >> 1), ny = S0 + 3;
  sign(P, nb, nx, ny, { outline: 0x0c0d12, fill: 0x5a2834, hi: 0x74384a, lo: 0x401a24 });
  reg.neon = { B: nb, x: nx, y: ny };
  rows(P, L, S1, W, [0xe8ecf0, 0xaab0b8, 0x6a7078]);
  // vita emaljpaneler med stora fönster
  const Z0 = S1 + 3;
  area(P, L, Z0, W, DT - Z0, (X, Y, i, j) => jit(qmix(0xf6f4ee, 0xd8d4cc, j / (DT - Z0), X, Y, 3), X, Y, 43, 0.03));
  // listen ovanför fönstren: två röda "speed lines" med nitar emellan
  P.hl(L, Z0 + 3, W, 0xd02a3e); P.hl(L, Z0 + 4, W, 0xf07080, 0.5);
  P.hl(L, Z0 + 9, W, 0xd02a3e); P.hl(L, Z0 + 10, W, 0x7e1624, 0.5);
  for (let x = L + 4; x < R - 4; x += 12) { P.px(x, Z0 + 6, 0x8a9098); P.px(x, Z0 + 7, 0xffffff, 0.7); }
  const wy = Z0 + 15, wh = DT - wy - 5;
  // fönstren slutar 8 px från dörren så att menylådan (huvens bredd) får 1 px luft till kromramarna
  const wins = [[L + 6, d0 - 8 - (L + 6)], [d1 + 8, R - 6 - (d1 + 8)]];
  for (const [wx, ww] of wins) {
    diner(P, wx, wy, ww, wh, night, reg);
    P.vl(wx + (ww >> 1) - 1, wy, wh, 0xe8ecf0);
    P.vl(wx + (ww >> 1), wy, wh, 0x8a9098);
    chromeFrame(P, wx, wy, ww, wh, 0xf0eee8);
    P.darken(wx - 2, wy + wh + 2, ww + 4, 1, 0.85);
  }
  // ÖPPET-skylten hänger i listen över vänstra fönstret …
  const ob = bits(SMALL, 'ÖPPET'), ox0 = wins[0][0] + (wins[0][1] >> 1) - (ob.w >> 1), oy0 = Z0 + 5;
  P.rect(ox0 - 2, oy0 - 3, ob.w + 4, 9, 0x14161c);
  P.box(ox0 - 2, oy0 - 3, ob.w + 4, 9, 0x3a3f4c);
  for (const [sx, sy] of [[ox0 - 2, oy0 - 3], [ox0 + ob.w + 1, oy0 - 3], [ox0 - 2, oy0 + 5], [ox0 + ob.w + 1, oy0 + 5]]) P.px(sx, sy, 0x8a9098);
  sign(P, ob, ox0, oy0, { fill: 0x4a2a30 });
  reg.oppet = { B: ob, x: ox0, y: oy0 };
  // … och dinerklockan över det högra (visarna ritas i live)
  const ccx = wins[1][0] + (wins[1][1] >> 1), ccy = Z0 + 6;
  clockFace(P, ccx, ccy, night);
  reg.clock = [ccx, ccy];
  if (night) { reg.win.push([ccx - 4, ccy - 4, 9, 9]); reg.halo.push([ccx + 0.5, ccy + 0.5, 8, 7, 0xfff0c0, 0.25]); }

  // ---- menylådan ovanför dörren ----
  const M = menuGeom(d0, d1, S1);
  // kromram med fasad kant, rött huvud (texten ritas i live: MENY och rätternas namn i tur och ordning)
  P.rect(M.x, M.y, M.w, M.h, 0x9aa0a8);
  P.bevel(M.x, M.y, M.w, M.h, 0xf6f8fa, 0x5a6068);
  area(P, M.head.x, M.head.y, M.head.w, M.head.h, (X, Y, i, j) => jit(j === 0 ? 0xf07080 : j === M.head.h - 1 ? 0x7e1624 : 0xd02a3e, X, Y, 46, 0.05));
  P.hl(M.head.x, M.head.y + M.head.h, M.head.w, 0xe8ecf0);
  // mörk tavla som på jobbet, med tunn kritkant
  area(P, M.panel.x, M.panel.y, M.panel.w, M.panel.h, (X, Y) => {
    let c = hash(X, Y, 34) > 0.9 ? 0x3a4a40 : jit(0x26342c, X, Y, 35, 0.06);
    if (night) c = mix(c, 0x5a7a68, 0.35);
    return c;
  });
  if (MENU) {
    // kritstreck som delar tavlan i fyra rutor (varannan pixel, som dragna för hand)
    const dvx = M.panel.x + M.cw, dvy = M.cells[2][1] - 1;
    for (let y = M.panel.y + 1; y < M.panel.y + M.panel.h - 1; y++) if ((y + dvx) & 1) P.px(dvx, y, 0xb8c4bc, 0.55);
    for (let x = M.panel.x + 1; x < M.panel.x + M.panel.w - 1; x++) if ((x + dvy) & 1) P.px(x, dvy, 0xb8c4bc, 0.55);
    MENU.dishes.forEach((d, i) => {
      if (i >= M.cells.length) return;
      const [cx0, cy0] = M.cells[i];
      dishPx(P, d, cx0 + ((M.cw - dishW(d)) >> 1), cy0 + 12);
      text(P, SMALL, d.label, cx0 + ((M.cw - textW(SMALL, d.label)) >> 1), cy0 + 13, night ? 0xfff8e8 : 0xf4f1ea);
    });
  } else {
    text(P, SMALL, 'SNART', M.panel.x + ((M.panel.w - textW(SMALL, 'SNART')) >> 1), M.panel.y + 16, 0xc8c0a8);
  }
  if (night) {
    reg.win.push([M.panel.x, M.panel.y, M.panel.w, M.panel.h], [M.head.x, M.head.y, M.head.w, M.head.h]);
    reg.halo.push([M.x + M.w / 2, M.y + M.h / 2, M.w * 0.85, M.h * 0.65, 0xffd0a0, 0.28]);
    reg.halo.push([M.x + M.w / 2, M.y + M.h + 6, M.w * 0.7, 8, 0xffc8a0, 0.18]);
  }
  reg.menu = M;
  // huven över dörren
  const hy = DT - 7;
  area(P, d0 - 5, hy, d1 - d0 + 10, 3, (X, Y, i, j) => [0xf6f8fa, 0xc2c8d0, 0x9aa0a8][j]);
  area(P, d0 - 4, hy + 3, d1 - d0 + 8, 3, (X, Y, i, j) => (j === 1 ? 0xffffff : 0xd8303a));
  P.darken(d0 - 3, hy + 6, d1 - d0 + 6, 1, 0.6);
  // röd rand, blank röd emalj med vit pinnrand (INTE räfflat stål – det såg ut som nerdragna
  // jalusier) och schackrutig sockel
  area(P, L, DT, W, 4, (X, Y, i, j) => [0xf07080, 0xd02a3e, 0xc2263a, 0x7e1624][j]);
  P.hl(L, DT + 4, W, 0xffffff);
  const EH = BASE - 6 - DT - 5;
  area(P, L, DT + 5, W, EH, (X, Y, i, j) => {
    const glans = j < 2 ? 0.25 : j > EH - 3 ? -0.3 : 0;
    const base = mix(0xb8203a, 0xe0485a, 0.35 + 0.25 * Math.sin(i * 0.05));
    return glans > 0 ? mix(base, WHITE, glans) : glans < 0 ? mul(base, 1 + glans) : jit(base, X, Y, 61, 0.03);
  });
  const pin = DT + 5 + Math.floor(EH / 2);
  P.hl(L, pin, W, 0xffffff); P.hl(L, pin + 1, W, 0xf4c4c8);
  for (let x = L + 3; x < R - 2; x += 12) { P.px(x, DT + 7, 0xf0d0d4); P.px(x, BASE - 9, 0xf0d0d4); } // nitar
  P.hl(L, BASE - 7, W, 0x2a2c30);
  for (let y = BASE - 6; y < BASE; y++) for (let x = L; x < R; x++) {
    const on = ((Math.floor((x - L) / 3) + Math.floor((y - BASE + 6) / 3)) & 1) === 0;
    P.px(x, y, on ? jit(0xeceae4, x, y, 44, 0.05) : jit(0x1e1e24, x, y, 45, 0.1));
  }
  // rundade gavlar (cylinderskuggning)
  cylCols(P, L, PT, BASE - PT, [0.58, 0.8, 1.12, 1.05, 0.95]);
  cylCols(P, R - 5, PT, BASE - PT, [0.95, 0.9, 0.82, 0.7, 0.55]);
  // dörrkarm i krom + tröskel
  for (const fx of [d0 - 2, d1]) { P.vl(fx, hy + 6, BASE - hy - 6, 0xe8ecf0); P.vl(fx + 1, hy + 6, BASE - hy - 6, 0x7a808a); }
  rows(P, d0 - 2, BASE, d1 - d0 + 4, [0xd8dde2, 0x8a9098]);
  P.rect(L, BASE, W, 1, 0x1a1418, 0.35);
  P.rect(L, BASE + 1, W, 1, 0x1a1418, 0.15);
  // ---- snö: taket, krönet, burgaren, aggregatet, huvarna, listerna och fönsterblecken ----
  if (opts.snow) {
    snowArea(P, L + 1, TOP + 3, W - 2, PT - TOP - 3, 504, 0.9);
    snowCap(P, L, TOP, W, 2);
    snowCap(P, ax - 1, ay - 1, 26, 2);
    for (const vx of [L + 10, L + 20]) snowCap(P, vx - 1, PT - 19, 5, 1);
    // burgarens bröd: snökalott som följer kupolen
    const yd = PT - 3 - 46, hw = 30;
    for (let j = 0; j < 6; j++) {
      const v = (18 - j - 0.5) / 18, w = Math.round(hw * Math.sqrt(Math.max(0, 1 - v * v)) + 0.5) - 1;
      for (let x = -w; x < w; x++) if (j < 4 || hash(x, j, 505) > 0.5) P.px(cx - 4 + x, yd + j, j === 5 ? 0xd4e0ee : 0xf6f9ff);
    }
    snowCap(P, L - 1, PT - 1, W + 2, 2);
    snowCap(P, d0 - 6, hy - 1, d1 - d0 + 12, 2);
    for (const [wx, ww] of wins) snowCap(P, wx - 2, wy + wh + 1, ww + 4, 1);
    snowCap(P, M.x - 1, M.y - 1, M.w + 2, 1);
    snowCap(P, L, Z0 + 2, W, 1);
    snowCap(P, L, DT - 1, W, 1);
  }
}
DOOR_ART.burgare = {
  hinge: 'l', light: 0xffd8c0, edge: 0x9aa0a8,
  interior(I, w, h) {
    area(I, 0, 0, w, h, (X, Y, i, j) => {
      let c = qmix(0xe8fff6, 0xb8e4d4, j / 20, X, Y, 3);
      if (j === 3 || j === 4) c = 0xff8aa0;
      return c;
    });
    I.rect(3, 6, 12, 5, 0x1e2028);
    for (let x = 4; x < 14; x += 2) I.px(x, 8, 0xfff4c0);
    I.hl(4, 7, 5, 0xff6a80);
    I.ell(w - 5, 4, 5, 4, 0xffffff, 0.6);
    I.rect(w - 7, 10, 4, 5, 0xc8ced4); I.hl(w - 7, 10, 4, 0xffffff);
    I.rect(0, 16, w, 2, 0xd8303a); I.hl(0, 16, w, 0xf0e8ea);
    area(I, 0, 18, w, 7, (X, Y, i, j) => (j === 0 ? 0xe8ecf0 : [0xb8c0c8, 0xd8dde2][(i >> 1) & 1]));
    for (const sx of [3, 11, 19]) { I.rect(sx - 1, 21, 4, 2, 0xe8404a); I.hl(sx - 1, 21, 4, 0xff7a84); I.vl(sx, 23, 4, 0xc8ced4); }
    for (let y = 27; y < h; y++) for (let x = 0; x < w; x++) I.px(x, y, (((x >> 1) + ((y - 27) >> 1)) & 1) ? 0xf4f2ec : 0x1e1e24);
  },
  leaf(S, w, h) {
    S.erase(0, 0, w, h);
    areaA(S, 2, 2, w - 4, 22, 0xc8e8f0, (X, Y, i, j) => 0.18 + ((((i * 2 - j * 3) % 21) + 21) % 21 < 3 ? 0.4 : 0));
    area(S, 0, 0, w, h, (X, Y, i, j) => (i < 2 || i >= w - 2 || j < 2 || (j >= 24 && j < 26) ? (i >= w - 2 || j === 25 ? 0xaab0b8 : 0xe8ecf0) : null));
    area(S, 2, 26, w - 4, h - 29, (X, Y, i, j) => (j === 0 ? 0xf06070 : jit(0xc8283a, X, Y, 91, 0.05)));
    rows(S, 0, h - 3, w, [0xe8ecf0, 0xaab0b8, 0x6a7078]);
    text(S, SMALL, 'DRA', (w >> 1) - 5, 7, 0xffffff, 0.85);
    S.rect(w - 5, 11, 2, 9, 0xe8ecf0);
    S.vl(w - 4, 11, 9, 0x8a9098);
  },
};
function isOpen(b, hour) { return !b.open || (hour >= b.open[0] && hour < b.open[1]); }
const BURGARE = {
  paint: paintBurgare,
  kit(b, reg) {
    const K = {};
    const { B } = reg.neon;
    const P = new Pix(B.w + 2, B.h + 2);
    sign(P, B, 1, 1 + B.up, { outline: 0xff3a5c, oa: 0.45, fill: (i) => (i % 5 === 0 ? 0xffc8d0 : 0xfff2f4), lo: 0xff5a78 });
    K.neon = P.flush();
    K.neonHalo = haloOf(B, 0xff3a5c, 5, 0.5);
    const ob = reg.oppet.B, Q = new Pix(ob.w + 2, ob.h + 2);
    sign(Q, ob, 1, 1 + ob.up, { outline: 0x3ad0ff, oa: 0.4, fill: 0xe8fbff });
    K.oppet = Q.flush();
    K.oppetHalo = haloOf(ob, 0x3ad0ff, 3, 0.5);
    // menylådans huvud: MENY och rätternas namn i tur och ordning (vanlig + tänd variant)
    const M = reg.menu, names = ['MENY', ...(MENU ? MENU.dishes.map((d) => d.name) : [])];
    K.heads = names.map((s) => {
      const tb = bits(SMALL, s), H = new Pix(M.head.w, M.head.h);
      sign(H, tb, (M.head.w - tb.w) >> 1, 1, { fill: 0xfff4ea, shadow: 0x7e1624, sa: 0.7 });
      return H.flush();
    });
    K.headsLit = names.map((s) => {
      const tb = bits(SMALL, s), H = new Pix(M.head.w + 2, M.head.h + 2);
      sign(H, tb, 1 + ((M.head.w - tb.w) >> 1), 2, { outline: 0xff6a80, oa: 0.5, fill: 0xfffaf4 });
      return H.flush();
    });
    const HL = new Pix(M.w + 12, M.head.h + 12);
    HL.ell(M.w / 2 + 6, M.head.h / 2 + 6, M.w / 2 + 4, M.head.h / 2 + 5, 0xff5a78, 0.45);
    K.headHalo = HL.flush();
    return K;
  },
  // vilken text huvudet visar just nu: MENY två steg, sedan en rätt i taget
  headIdx(st, K) {
    const n = K.heads.length;
    if (n <= 1) return 0;
    const seq = [0, 0, 1, 2, 3, 4], i = seq[Math.floor(st.t / 1.6) % seq.length];
    return i < n ? i : 0;
  },
  menu(ctx, b, st, K, reg, lit) {
    const M = reg.menu, ox = b.x - ART_OVER, i = BURGARE.headIdx(st, K);
    if (lit) ctx.drawImage(K.headsLit[i], ox + M.head.x - 1, M.head.y - 1);
    else ctx.drawImage(K.heads[i], ox + M.head.x, M.head.y);
    if (i > 0 && M.cells[i - 1]) {
      // ram runt rätten som huvudet talar om
      const [cx0, cy0] = M.cells[i - 1], w = M.cw, h = 18;
      ctx.fillStyle = lit ? '#ff8aa0' : '#e8b230';
      ctx.fillRect(ox + cx0, cy0, w, 1); ctx.fillRect(ox + cx0, cy0 + h - 1, w, 1);
      ctx.fillRect(ox + cx0, cy0, 1, h); ctx.fillRect(ox + cx0 + w - 1, cy0, 1, h);
    }
  },
  clock(ctx, b, st, reg) {
    const [cx, cy] = reg.clock, ox = b.x - ART_OVER, h = st.hour ?? 12;
    const am = (h % 1) * Math.PI * 2 - Math.PI / 2, ah = ((h % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = '#2a2c30';
    for (let r = 1; r <= 3; r++) ctx.fillRect(ox + cx + Math.round(Math.cos(am) * r), cy + Math.round(Math.sin(am) * r), 1, 1);
    for (let r = 1; r <= 2; r++) ctx.fillRect(ox + cx + Math.round(Math.cos(ah) * r), cy + Math.round(Math.sin(ah) * r), 1, 1);
  },
  neon(ctx, b, st, K, reg) {
    const ox = b.x - ART_OVER, { B, x, y } = reg.neon, dx = ox + x - 1, dy = y - B.up - 1;
    const tick = Math.floor(st.t * 12);
    if (hash(tick, 3, 77) > 0.975) return;
    const bad = Math.floor(st.t / 5) % B.cols.length;
    const flick = hash(tick, bad, 78) > 0.55 && Math.floor(st.t * 1.5) % 4 === 0;
    if (!flick) { ctx.drawImage(K.neon, dx, dy); return; }
    const [c0, c1] = B.cols[bad], H = K.neon.height;
    if (c0 + 1 > 0) ctx.drawImage(K.neon, 0, 0, c0 + 1, H, dx, dy, c0 + 1, H);
    const rest = K.neon.width - (c1 + 1);
    if (rest > 0) ctx.drawImage(K.neon, c1 + 1, 0, rest, H, dx + c1 + 1, dy, rest, H);
  },
  live(ctx, b, st, reg, K) {
    const ox = b.x - ART_OVER;
    BURGARE.neon(ctx, b, st, K, reg);
    const ph = Math.floor(st.t * 7);
    ctx.fillStyle = '#fff2a8';
    reg.bulbs.forEach(([x, y], i) => { if ((i + ph) % 3 === 0) ctx.fillRect(ox + x, y, 1, 1); });
    if (isOpen(b, st.hour)) ctx.drawImage(K.oppet, ox + reg.oppet.x - 1, reg.oppet.y - reg.oppet.B.up - 1);
    BURGARE.menu(ctx, b, st, K, reg, false);
    BURGARE.clock(ctx, b, st, reg);
    // fläkten i kylaggregatet snurrar
    const [fx, fy] = reg.fan, spin = Math.floor(st.t * 9) % 2;
    ctx.fillStyle = spin ? '#5a5e66' : '#8a9098';
    ctx.fillRect(ox + fx - 3, fy, 7, 1);
    ctx.fillStyle = spin ? '#8a9098' : '#5a5e66';
    ctx.fillRect(ox + fx, fy - 1, 1, 3);
  },
  glow(ctx, b, st, k, reg, K) {
    const ox = b.x - ART_OVER, { B, x, y } = reg.neon;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * 0.85;
    BURGARE.neon(ctx, b, st, K, reg);
    ctx.globalAlpha = k * (0.8 + 0.2 * Math.sin(st.t * 9));
    ctx.drawImage(K.neonHalo.img, ox + x - K.neonHalo.pad, y - B.up - K.neonHalo.pad);
    const ph = Math.floor(st.t * 7);
    ctx.fillStyle = '#ffd860';
    reg.bulbs.forEach(([bx, by], i) => {
      if ((i + ph) % 3 !== 0) return;
      ctx.globalAlpha = k * 0.35; ctx.fillRect(ox + bx - 1, by - 1, 3, 3);
      ctx.globalAlpha = k; ctx.fillRect(ox + bx, by, 1, 1);
    });
    if (isOpen(b, st.hour)) {
      const o = reg.oppet;
      ctx.globalAlpha = k * 0.8;
      ctx.drawImage(K.oppetHalo.img, ox + o.x - K.oppetHalo.pad, o.y - o.B.up - K.oppetHalo.pad);
      ctx.globalAlpha = k * 0.85;
      ctx.drawImage(K.oppet, ox + o.x - 1, o.y - o.B.up - 1);
    }
    // menylådan: huvudet i rosa neon med gloria, tavlan får sitt sken via reg.win/halo
    const M = reg.menu;
    ctx.globalAlpha = k * 0.55;
    ctx.drawImage(K.headHalo, ox + M.x - 6, M.head.y - 6);
    ctx.globalAlpha = k * 0.8;
    BURGARE.menu(ctx, b, st, K, reg, true);
    // takstrålkastarna mot jätteburgaren
    ctx.fillStyle = '#ffe8a0';
    for (const [sx, sy] of reg.spots) {
      ctx.globalAlpha = k * 0.45; ctx.fillRect(ox + sx - 1, sy - 1, 4, 3);
      ctx.globalAlpha = k; ctx.fillRect(ox + sx, sy, 2, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },
};

// ======================= FRUKTFABRIKEN =======================
function indWin(P, x, y, w, h, night, reg, seed) {
  // valv av stående tegel
  const cxw = x + w / 2;
  for (let xx = x - 2; xx < x + w + 2; xx++) {
    const u = (xx + 0.5 - cxw) / (w / 2 + 2), top = y - 3 - Math.round(2.5 * (1 - u * u));
    for (let yy = top; yy < y; yy++) P.px(xx, yy, (xx + 64) % 3 === 2 ? 0xb8a890 : jit(yy === top ? 0x9a4a34 : 0x7e3424, xx, yy, 141, 0.08));
  }
  const cols = 4, rws = 5;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    const ci = Math.floor((i * cols) / w), rj = Math.floor((j * rws) / h);
    const edgeX = i === 0 || i === w - 1 || Math.floor(((i + 1) * cols) / w) !== ci;
    const edgeY = j === 0 || j === h - 1 || Math.floor(((j + 1) * rws) / h) !== rj;
    if (edgeX || edgeY) { P.px(X, Y, edgeY && j === h - 1 ? 0x1a2420 : 0x2e3c36); continue; }
    const hp = hash(ci, rj, seed);
    let c;
    if (night) c = hp > 0.14 ? qmix(0xf0f4d0, 0xb8c89c, j / h, X, Y, 3) : 0x4a5448;
    else {
      c = qmix(0x9ab8cc, 0x3e5666, j / h, X, Y, 4);
      if (hp > 0.82) c = mix(c, 0x9ac0a0, 0.35);
      else if (hp < 0.1) c = mul(c, 0.7);
    }
    P.px(X, Y, c);
  }
  reflect(P, x, y, w, h, night, 0.7, seed);
  // vädringsfönster på glänt
  const oi = Math.floor(hash(seed, 1, 142) * cols), px0 = x + Math.round((oi * w) / cols) + 1, pw = Math.round(w / cols) - 1;
  P.hl(px0, y + 1, pw, 0x5a6a64);
  P.darken(px0, y + 2, pw, 2, 0.65);
  rows(P, x - 2, y + h, w + 4, [0xd8d0bc, 0x8a8070]);
  P.darken(x - 1, y + h + 2, w + 2, 1, 0.7);
  if (night) {
    reg.win.push([x, y, w, h]);
    reg.halo.push([x + w / 2, y + h / 2, w * 0.75, h * 0.55, 0xd8f0ff, 0.2]);
  }
}
function fruitLogo(P, cx, cy, r) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > r + 0.3) continue;
    let c;
    if (d > r - 0.8) c = 0x1e4a26;
    else if (d > r - 3) c = hash(x, y, 151) > 0.95 ? 0xb8a888 : 0xf2e6c2;
    else if (d > r - 3.8) c = 0x1e4a26;
    else c = qmix(0x62b856, 0x2e7a38, (y - cy + r) / (2 * r), x, y, 3);
    P.px(x, y, c);
  }
  // apelsin
  const oxc = cx + 4, oyc = cy + 2;
  for (let y = oyc - 4; y <= oyc + 4; y++) for (let x = oxc - 4; x <= oxc + 4; x++) {
    const dx = x - oxc, dy = y - oyc, d = Math.hypot(dx, dy);
    if (d > 4.2) continue;
    const l = 0.5 - dx * 0.1 - dy * 0.12;
    P.px(x, y, d > 3.6 ? 0xa04a10 : hash(x, y, 152) > 0.85 ? 0xffb050 : qmix(0xc86a14, 0xffa030, l, x, y, 3));
  }
  // äpple
  const axc = cx - 3, ayc = cy + 1;
  for (let y = ayc - 5; y <= ayc + 5; y++) for (let x = axc - 5; x <= axc + 5; x++) {
    const dx = x - axc, dy = y - ayc;
    const d = Math.hypot(dx * (dy < -2 ? 1.1 : 1), dy);
    if (d > 5.2 || (dy < -3.5 && Math.abs(dx) < 1)) continue;
    const l = 0.55 - dx * 0.1 - dy * 0.1;
    P.px(x, y, d > 4.6 ? 0x6a1010 : qmix(0x9a1818, 0xf04a3a, l, x, y, 3));
  }
  P.px(axc - 2, ayc - 2, 0xffe0d8);
  P.px(axc - 3, ayc - 1, 0xffb0a0);
  P.vl(axc, ayc - 7, 3, 0x5a3a1a);
  P.hl(axc + 1, ayc - 7, 3, 0x5ac04a);
  P.px(axc + 2, ayc - 8, 0x5ac04a);
  P.px(oxc + 1, oyc - 5, 0x3a8a2a);
  P.px(oxc + 2, oyc - 5, 0x5ac04a);
}
function crate(P, x, y, fruit) {
  area(P, x, y, 13, 8, (X, Y, i, j) => {
    if (j === 2 || j === 5) return i > 0 && i < 12 && hash(X, Y, 161) > 0.3 ? fruit : 0x4a2e18;
    if (i === 0 || i === 12) return 0x8a5e30;
    return jit(j === 0 || j === 3 || j === 6 ? 0xd8aa70 : 0xb88a52, X, Y, 162, 0.08);
  });
  P.hl(x, y + 7, 13, 0x5a3a1c);
  P.rect(x + 5, y + 3, 3, 2, 0xf2e6c2);
  P.px(x + 6, y + 3, fruit);
}
function paintFrukt(P, b, night, reg, opts = {}) {
  const L = ART_OVER, W = b.w, R = L + W, T = BASE - b.h;
  const d0 = b.door.x0 - b.x + L, d1 = b.door.x1 - b.x + L;
  const TW = 32, GL = 8, RISE = 13, D = T - TOP - 2;
  const prof = (x) => {
    const u = x - L;
    if (u < 0 || u >= W) return 0;
    const v = u % TW;
    return v < TW - GL ? Math.round((v / (TW - GL)) * RISE) : Math.round(((TW - 1 - v) / (GL - 1)) * RISE);
  };
  // ---- sågtandstaket: korrugerad plåt + glasade branta partier ----
  for (let x = L; x < R; x++) {
    const p = prof(x), v = (x - L) % TW, y1 = T - p - 2, y0 = y1 - D;
    for (let y = y0; y < y1; y++) {
      let c;
      if (v >= TW - GL) {
        const e = v === TW - GL || v === TW - 1, g = (y + p) % 5 === 0;
        c = e || g ? 0x2e3640 : night ? qmix(0xd8ecf4, 0x8aa8b8, (y - y0) / D, x, y, 3) : qmix(0xd0ecfc, 0x6a90b0, (y - y0) / D, x, y, 3);
        if (!night && !e && !g && ((x * 2 + y) % 9 === 0 || (x * 2 + y) % 9 === 1)) c = mix(c, WHITE, 0.45);
        if (!e && !g && v === TW - GL + 1) c = mix(c, WHITE, 0.3);
      } else {
        const rib = (y + p) % 3, base = mix(0x7e848a, 0xb0b6bc, v / (TW - GL));
        c = rib === 0 ? mul(base, 1.12) : rib === 2 ? mul(base, 0.78) : base;
        if (hash(x >> 2, (y + p) >> 1, 101) > 0.9) c = mix(c, 0x9a6a3a, 0.35);
        c = jit(c, x, y, 102, 0.04);
      }
      P.px(x, y, c);
    }
    P.px(x, y0 - 1, 0x4a5058);
    P.px(x, y0, 0xc8ced4);
  }
  // takfläkt (live snurrar den)
  reg.turb = [L + 44, T - prof(L + 44) - 20];
  P.rect(reg.turb[0] + 2, reg.turb[1] + 5, 3, 5, 0x6a7076);
  P.vl(reg.turb[0] + 2, reg.turb[1] + 5, 5, 0xaab0b6);
  // ---- gavelmuren med sågtandsprofil + fasaden i tegel ----
  area(P, L, T - RISE, W, BASE - (T - RISE), (X, Y) => (Y < T - prof(X) ? null : brickPx(X, Y, 0x9a4630, 111)));
  for (let x = L; x < R; x++) {
    const y = T - prof(x), yn = T - prof(Math.min(R - 1, x + 1));
    if (Math.abs(yn - y) > 2) for (let yy = Math.min(y, yn); yy < Math.max(y, yn); yy++) P.px(x, yy - 2, 0x3a4250);
    P.px(x, y - 2, 0xd8d2c6);
    P.px(x, y - 1, 0x8a8478);
    P.darken(x, y, 1, 1, 0.8);
  }
  for (let t = 0; t * TW < W; t++) {
    const ox = L + t * TW + 15, oy = T - 4;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const d = Math.hypot(x, y);
      if (d > 2.5) continue;
      P.px(ox + x, oy + y, d > 1.6 ? 0xc8bca4 : x === 0 || y === 0 ? 0x3a4250 : night ? 0xd8e8c0 : 0x4a6070);
    }
  }
  // skorsten (tillräckligt låg för att röken ska synas inom världen)
  const chx = R - 30, chBot = T - 10, cT = 18;
  for (let y = cT; y < chBot; y++) {
    const w = 10 + Math.round(((y - cT) / (chBot - cT)) * 3), x0 = chx + 6 - (w >> 1);
    for (let i = 0; i < w; i++) {
      let c = brickPx(x0 + i, y, 0x8a3a28, 171, { bw: 5 });
      c = mul(c, 1.15 - (i / (w - 1)) * 0.5);
      if (y >= cT + 7 && y < cT + 10) c = mul(jit(0xece6da, x0 + i, y, 172, 0.06), 1.1 - (i / (w - 1)) * 0.45);
      if (y < cT + 7 && bayer(x0 + i, y) < (cT + 7 - y) / 9) c = mul(c, 0.55);
      P.px(x0 + i, y, c);
    }
  }
  P.rect(chx, cT - 2, 12, 2, 0x3a3a3e);
  P.hl(chx, cT - 2, 12, 0x6a6a70);
  P.hl(chx + 1, cT - 3, 10, 0x1a1a1e);
  P.rect(chx - 1, chBot - 2, 15, 2, 0x6a7076);
  reg.smoke = [chx + 6, cT - 2];
  // ---- målad reklamskylt på teglet ----
  const sx0 = L + 5, sx1 = R - 5, sy0 = T + 3, sy1 = T + 22;
  area(P, sx0, sy0, sx1 - sx0, sy1 - sy0, (X, Y) => {
    if (hash(X >> 1, Y, 121) > 0.965) return null;
    return mix(0xece0bc, P.get(X, Y), 0.14 + (hash(X, Y, 122) > 0.8 ? 0.12 : 0));
  });
  P.box(sx0 + 1, sy0 + 1, sx1 - sx0 - 2, sy1 - sy0 - 2, 0x2e6e3a);
  const fb = bits(BIG, 'FRUKTFABRIKEN', { x2: true, gap: 1 }), fx = L + ((W - fb.w) >> 1);
  sign(P, fb, fx, sy0 + 3, {
    shadow: 0xa89a74, fill: (i, j, X, Y) => (hash(X, Y, 123) > 0.95 ? 0xe4d8b4 : qmix(0x3a8a48, 0x245a2e, j / fb.h, X, Y, 3)), hi: 0x62b06a, lo: 0x1a4020,
  });
  // ---- övervåningens industrifönster + logga över personaldörren ----
  for (const wx of [L + 6, L + 32, R - 58, R - 28]) indWin(P, wx, T + 30, 22, 25, night, reg, wx);
  const lcx = (d0 + d1) >> 1;
  fruitLogo(P, lcx, T + 41, 12);
  const sb = bits(SMALL, 'SEDAN 1932');
  sign(P, sb, lcx - (sb.w >> 1), T + 57, { fill: 0xece0bc, shadow: 0x4a2418, sa: 0.6 });
  // ---- bottenvåningen vänster: rör, ventil, elskåp, fruktlådor ----
  const py = T + 66;
  rows(P, L, py, d0 - 8 - L, [0xb8c0c4, 0x7a868c, 0x4a5458]);
  for (let x = L + 12; x < d0 - 8; x += 16) { P.vl(x, py - 1, 5, 0x3a4448); P.vl(x + 1, py - 1, 5, 0x9aa4a8); }
  P.rect(d0 - 9, py, 3, 12, 0x7a868c); P.vl(d0 - 9, py, 12, 0xb8c0c4); P.vl(d0 - 7, py, 12, 0x4a5458);
  const vwx = L + 30, vwy = py - 6;
  P.vl(vwx + 2, vwy + 4, 3, 0x4a5458);
  for (const [dx, dy] of [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4]]) P.px(vwx + dx, vwy + dy - 1, dy < 2 ? 0xf04a3a : 0xb8201a);
  P.hl(vwx + 1, vwy + 1, 3, 0xb8201a); P.vl(vwx + 2, vwy, 3, 0xb8201a);
  const gx = L + 50;
  P.vl(gx + 1, py - 3, 3, 0x4a5458);
  area(P, gx - 1, py - 8, 5, 5, (X, Y, i, j) => ((i === 0 || i === 4) && (j === 0 || j === 4) ? null : i === 0 || j === 0 || i === 4 || j === 4 ? 0x3a4448 : 0xf4f2ea));
  P.px(gx + 2, py - 6, 0xd8303a); P.px(gx + 3, py - 7, 0xd8303a);
  // ventilationsgaller med sot
  area(P, L + 8, py + 6, 20, 12, (X, Y, i, j) => (i === 0 || j === 0 || i === 19 || j === 11 ? 0x3a4448 : j % 2 ? 0x5a6468 : 0xa8b0b4));
  for (let y = py - 10; y < py + 6; y++) for (let x = L + 10; x < L + 26; x++) if (bayer(x, y) < ((y - py + 10) / 16) * 0.4) P.darken(x, y, 1, 1, 0.8);
  // elskåp
  const ex = L + 36, ey = py + 10;
  area(P, ex, ey, 14, 22, (X, Y, i) => jit(i === 0 ? 0xc8ccd0 : i === 13 ? 0x6a7076 : 0xa0a6ac, X, Y, 181, 0.05));
  P.hl(ex, ey, 14, 0xdadee2); P.hl(ex, ey + 21, 14, 0x4a5058); P.vl(ex + 7, ey + 2, 18, 0x7a8086);
  for (const [dx, dy] of [[3, 2], [2, 3], [4, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4]]) P.px(ex + dx + 4, ey + dy + 1, 0xf0c020);
  P.px(ex + 7, ey + 4, 0x1a1a1a);
  for (let y = ey + 16; y < ey + 20; y += 2) P.hl(ex + 2, y, 4, 0x5a6066);
  P.darken(ex + 1, ey + 22, 14, 1, 0.65);
  // fruktlådor staplade mot väggen
  crate(P, L + 2, BASE - 8, 0xf08a1e);
  crate(P, L + 2, BASE - 16, 0xe8303a);
  crate(P, L + 16, BASE - 8, 0x9ad040);
  for (let i = 0; i < 6; i++) {
    const fcx = L + 3 + i * 2, c = [0xf08a1e, 0xe8303a, 0xf0c020][i % 3];
    P.rect(fcx, BASE - 18, 2, 2, c); P.px(fcx, BASE - 18, mix(c, WHITE, 0.5));
  }
  P.darken(L + 2, BASE, 27, 1, 0.6);
  // ---- personaldörren: karm, huv med lampa, skylt ----
  for (const fx of [d0 - 2, d1]) { P.vl(fx, DT - 2, DOOR_H + 2, 0x2a3034); P.vl(fx + 1, DT - 2, DOOR_H + 2, 0x6a7076); }
  area(P, d0 - 5, DT - 6, d1 - d0 + 10, 4, (X, Y, i, j) => [0xc8ced4, 0x9aa0a6, 0x7a8086, 0x4a5058][j]);
  P.darken(d0 - 4, DT - 2, d1 - d0 + 8, 1, 0.6);
  P.rect(((d0 + d1) >> 1) - 2, DT - 9, 5, 3, 0x2a3034);
  P.hl(((d0 + d1) >> 1) - 1, DT - 7, 3, 0xfff4c0);
  reg.halo.push([(d0 + d1) / 2, DT + 4, 14, 14, 0xfff0c0, 0.3]);
  const pb = bits(SMALL, 'PERSONAL'), pbx = ((d0 + d1) >> 1) - (pb.w >> 1), pby = DT - 17;
  P.rect(pbx - 3, pby - 2, pb.w + 6, 9, 0xf4f2ea);
  P.box(pbx - 3, pby - 2, pb.w + 6, 9, 0x3a4448);
  sign(P, pb, pbx, pby, { fill: 0x1e4a26 });
  rows(P, d0 - 2, BASE, d1 - d0 + 4, [0xb8b4aa, 0x7a766e]);
  // ---- rullporten och lastkajen ----
  const rx0 = d1 + 11, rx1 = R - 6, RT = T + 64, DKY = BASE - 8, rw = rx1 - rx0;
  area(P, rx0, RT, rw, DKY - RT, (X, Y, i, j) => {
    const r = j % 4;
    let c = mix(0x8a9096, 0xb0b6bc, 0.5 + 0.5 * Math.sin((i / rw) * Math.PI));
    c = r === 0 ? mix(c, WHITE, 0.35) : r === 3 ? mul(c, 0.6) : r === 2 ? mul(c, 0.9) : c;
    if (hash(X, 0, 191) > 0.88) c = mul(c, 0.93);
    if (j > DKY - RT - 10 && hash(X, Y, 192) > 0.8) c = mix(c, 0x8a5a30, 0.4);
    return c;
  });
  for (let k = 0; k < 5; k++) { const vx = rx0 + 5 + k * 10; P.rect(vx, RT + 16, 6, 2, 0x2a3440); P.hl(vx, RT + 16, 6, 0x5a7080); }
  const ptx = rx0 + ((rw - textW(SMALL, 'PORT 2')) >> 1);
  text(P, SMALL, 'PORT 2', ptx + 1, RT + 26, 0xe8ecf0, 0.7);
  text(P, SMALL, 'PORT 2', ptx, RT + 25, 0x2a3038, 0.9);
  rows(P, rx0, DKY - 2, rw, [0x2a2c30, 0x1a1a1e]);
  P.rect(rx0 + (rw >> 1) - 3, DKY - 6, 6, 2, 0x5a6066);
  P.hl(rx0 + (rw >> 1) - 3, DKY - 6, 6, 0xc8ced4);
  area(P, rx0 - 3, RT - 5, rw + 6, 5, (X, Y, i, j) => (j === 0 ? 0xd8dde2 : j === 4 ? 0x4a5058 : jit(0x9aa0a6, X, Y, 193, 0.05)));
  for (const fx of [rx0 - 3, rx1]) area(P, fx, RT, 3, DKY - RT, (X, Y, i, j) => (j > DKY - RT - 10 ? (((X + Y) >> 1) & 1 ? 0xf0c020 : 0x1e1e20) : [0xaab0b6, 0x7a8086, 0x4a5058][i]));
  // strålkastare + kajsignal (röd = porten stängd)
  P.rect(rx0 + (rw >> 1) - 3, RT - 9, 6, 3, 0x2a3034);
  P.hl(rx0 + (rw >> 1) - 2, RT - 6, 4, 0xfff4c0);
  reg.halo.push([rx0 + rw / 2, RT + 10, 26, 22, 0xfff0c8, 0.22]);
  const sgx = rx1 + 3, sgy = RT + 6;
  P.rect(sgx, sgy, 3, 8, 0x1a1a1e);
  P.px(sgx + 1, sgy + 2, 0xff3a2a); P.px(sgx + 1, sgy + 5, 0x1e5a2a);
  reg.signal = [sgx + 1, sgy + 2];
  // kajen
  area(P, rx0 - 6, DKY, R - (rx0 - 6), BASE - DKY, (X, Y, i, j) => {
    if (j === 0) return ((X + 64) >> 1) & 1 ? 0xf0c020 : 0x1e1e20;
    if (j === BASE - DKY - 1) return 0x5a5850;
    return jit(j === 1 ? 0xc8c4bc : 0xa8a49c, X, Y, 194, hash(X >> 3, Y, 195) > 0.9 ? 0.25 : 0.08);
  });
  for (const bx of [rx0 + 4, rx1 - 8]) { P.rect(bx, DKY + 1, 4, 7, 0x1e1e22); P.vl(bx, DKY + 1, 7, 0x4a4a50); }
  // mörkare sockel av klinker till vänster
  area(P, L, BASE - 9, d0 - 2 - L, 9, (X, Y) => (X >= L + 2 && X < L + 29 && Y >= BASE - 18 ? null : brickPx(X, Y, 0x5a3026, 196)));
  // stuprör i vänsterkanten
  P.vl(L + 1, T - 2, BASE - T + 2, 0x8a9096); P.vl(L + 2, T - 2, BASE - T + 2, 0x4a5058);
  for (let y = T + 8; y < BASE; y += 20) P.hl(L, y, 4, 0x3a4044);
  P.rect(L, BASE, W, 1, 0x1a1418, 0.35);
  P.rect(L, BASE + 1, W, 1, 0x1a1418, 0.15);
  // ---- snö: plåtfallen på sågtandstaket (glaset skottar sig självt), parapeten, bleck, kajen ----
  if (opts.snow) {
    for (let x = L; x < R; x++) {
      const p = prof(x), v = (x - L) % TW, y1 = T - p - 2, y0 = y1 - D;
      if (v < TW - GL) { for (let y = y0; y < y1; y++) if (hash(x, y, 508) < 0.93) P.px(x, y, y === y0 ? 0xf8fbff : qmix(0xf2f6fc, 0xd4e0ee, (y - y0) / D, x, y, 3)); }
      else P.px(x, y1 - 1, 0xeaf2fa, 0.8);
      P.px(x, y1, 0xf8fbff);
    }
    for (const wx of [L + 6, L + 32, R - 58, R - 28]) snowCap(P, wx - 2, T + 55, 26, 2);
    snowCap(P, L, py - 1, d0 - 8 - L, 1);
    snowCap(P, ex, ey - 1, 14, 1);
    snowCap(P, pbx - 3, pby - 3, pb.w + 6, 1);
    const lcx0 = (d0 + d1) >> 1;
    snowCap(P, d0 - 5, DT - 7, lcx0 - 2 - (d0 - 5), 1); snowCap(P, lcx0 + 3, DT - 7, d1 + 5 - (lcx0 + 3), 1);
    const scx = rx0 + (rw >> 1);
    snowCap(P, rx0 - 3, RT - 6, scx - 3 - (rx0 - 3), 1); snowCap(P, scx + 3, RT - 6, rx1 + 3 - (scx + 3), 1);
    const bol = [rx0 + 4, rx1 - 8];
    snowArea(P, rx0 - 6, DKY + 1, R - (rx0 - 6), BASE - DKY - 2, 509, 0.75, (X, Y) => bol.some((bx) => X >= bx && X < bx + 4 && Y < DKY + 8));
    snowCap(P, L + 2, BASE - 19, 13, 1);
    snowCap(P, L + 16, BASE - 9, 13, 1);
  }
}
DOOR_ART.frukt = {
  hinge: 'l', light: 0xe8f4ff, edge: 0x1e3a2c,
  interior(I, w, h) {
    area(I, 0, 0, w, h, (X, Y, i, j) => qmix(0xf4f8f4, 0xd8e0d8, j / 26, X, Y, 3));
    for (const x of [2, 15]) { I.hl(x, 1, 9, 0xffffff); I.hl(x, 2, 9, 0xc8d0d0); }
    I.ell(w / 2, 4, 12, 6, 0xffffff, 0.4);
    // transportband med frukt
    I.rect(0, 16, w, 2, 0x3a3e44); I.hl(0, 16, w, 0x6a7078);
    for (let x = 1; x < w - 1; x += 3) { const c = [0xf08a1e, 0xe8303a, 0x9ad040][x % 3]; I.rect(x, 14, 2, 2, c); I.px(x, 14, mix(c, WHITE, 0.5)); }
    for (const x of [3, w - 5]) I.vl(x, 18, 8, 0x5a6066);
    // lådor
    I.rect(w - 9, 20, 9, 7, 0xc89a5a); I.hl(w - 9, 23, 9, 0x6a4a28); I.hl(w - 9, 20, 9, 0xe8c080);
    I.rect(w - 8, 18, 7, 2, 0xf08a1e);
    for (let y = 26; y < h; y++) for (let x = 0; x < w; x++) I.px(x, y, y === 30 ? 0xf0c020 : jit(0xb8bab4, x, y, 7, 0.08));
  },
  leaf(S, w, h) {
    area(S, 0, 0, w, h, (X, Y) => jit(0x3f6e56, X, Y, 131, 0.07));
    S.bevel(0, 0, w, h, 0x6a9a80, 0x1e3a2c);
    const gx = 8, gy = 5, gw = 10, gh = 10;
    S.erase(gx, gy, gw, gh);
    areaA(S, gx, gy, gw, gh, 0xb8d0d8, () => 0.35);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if ((i + j) % 4 === 0 || (i - j + 40) % 4 === 0) S.px(gx + i, gy + j, 0x8a9498, 0.55);
    S.box(gx - 1, gy - 1, gw + 2, gh + 2, 0x1e3a2c);
    S.rect(w - 7, 17, 5, 1, 0xd8dce0); S.vl(w - 7, 16, 3, 0x9aa0a6); S.px(w - 3, 17, 0x6a7076);
    S.rect(1, h - 7, w - 2, 6, 0x9aa0a6); S.hl(1, h - 7, w - 2, 0xd0d4d8); S.hl(1, h - 2, w - 2, 0x5a6066);
    for (const [dx, dy] of [[2, 0], [1, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]) S.px(10 + dx, 20 + dy, 0xf0c020);
  },
};
const FRUKT = {
  paint: paintFrukt,
  live(ctx, b, st, reg) {
    const ox = b.x - ART_OVER;
    // vit ånga från fruktkokeriet – driver med vinden så den syns ovanför taket
    smoke(ctx, ox + reg.smoke[0], reg.smoke[1] - 1, st.t, { tone: 'light', rate: 0.15, n: 12, drift: 44, rise: 26, alpha: 0.85 });
    // takfläkten snurrar
    const [tx, ty] = reg.turb, ph = Math.floor(st.t * 10);
    for (let i = 0; i < 7; i++) {
      const f = [0.7, 0.9, 1.05, 1.1, 1, 0.85, 0.65][i], dark = (i + ph) % 3 === 0;
      ctx.fillStyle = rgb(mul(dark ? 0x6a7076 : 0xb8bec4, f));
      ctx.fillRect(ox + tx - 1 + i, ty + (i === 0 || i === 6 ? 1 : 0), 1, i === 0 || i === 6 ? 4 : 6);
    }
    ctx.fillStyle = '#5a6066';
    ctx.fillRect(ox + tx, ty - 1, 5, 1);
  },
  glow(ctx, b, st, k, reg) {
    const [x, y] = reg.signal, ox = b.x - ART_OVER;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff3a2a';
    ctx.globalAlpha = k * 0.35; ctx.fillRect(ox + x - 1, y - 1, 3, 3);
    ctx.globalAlpha = k; ctx.fillRect(ox + x, y, 1, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },
};

// ======================= FLYGPLATSEN =======================
const DEST = ['LONDON', 'OSLO', 'PARIS', 'BERLIN', 'HELSINKI', 'ROM', 'VISBY', 'MALAGA', 'ATEN', 'NEW YORK', 'LULEÅ', 'MADRID', 'TOKYO', 'KIRUNA', 'PRAG', 'MALMÖ', 'DUBAI', 'NICE', 'GÖTEBORG', 'WIEN', 'ISTANBUL', 'KRETA', 'MALLORCA', 'LISSABON', 'BANGKOK', 'UMEÅ', 'BRYSSEL', 'RIGA', 'TALLINN', 'DUBLIN'];
const FLIGHTS = [];
{
  let m = 5 * 60 + 40, i = 0;
  while (m < 23 * 60 + 50) {
    const gate = 'ABCD'[Math.floor(hash(i, 1, 5) * 4)] + (1 + Math.floor(hash(i, 2, 5) * 14));
    FLIGHTS.push({ m, dest: DEST[i % DEST.length], gate, key: i });
    m += 22 + Math.floor(hash(i, 3, 5) * 26);
    i++;
  }
}
const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const ROW_W = 75, ROW_H = 7;
const ROWS = new Map();
function rowImg(f) {
  let c = ROWS.get(f.key);
  if (c) return c;
  const P = new Pix(ROW_W, ROW_H);
  text(P, SMALL, hhmm(f.m), 0, 1, 0xffd23a);
  text(P, SMALL, f.dest, 21, 1, 0xf4f4ec);
  text(P, SMALL, f.gate, 72 - textW(SMALL, f.gate), 1, 0xffd23a);
  c = P.flush();
  ROWS.set(f.key, c);
  return c;
}
let NOISE = null;
function noiseRow(i) {
  if (!NOISE) {
    NOISE = [];
    const AB = 'ABCDEFGHIJKLMNOPRSTUVY0123456789';
    for (let k = 0; k < 6; k++) {
      const P = new Pix(ROW_W, ROW_H);
      for (let x = 0; x < 72; x += 4) {
        if (x > 16 && x < 21) continue;
        const ch = AB[Math.floor(hash(x, k, 301) * AB.length)];
        text(P, SMALL, ch, x, 1, x < 20 || x > 60 ? 0xffd23a : 0xf4f4ec, 0.85);
        P.hl(x, 3, 3, 0x0e0f12, 0.8);
      }
      NOISE.push(P.flush());
    }
  }
  return NOISE[((i % 6) + 6) % 6];
}
const BOARD = new Map();
function drawBoard(ctx, b, st, reg) {
  const S = BOARD.get(b.id) || { keys: [], at: [] };
  BOARD.set(b.id, S);
  const bx = b.x - ART_OVER + reg.board.x, by = reg.board.y, n = FLIGHTS.length;
  const now = (((st.hour || 12) * 60) | 0) % 1440;
  let i0 = FLIGHTS.findIndex((f) => f.m > now);
  if (i0 < 0) i0 = 0;
  const page = Math.floor(st.t / 6) % 3;
  for (let r = 0; r < 5; r++) {
    const f = FLIGHTS[(r === 0 ? i0 : i0 + 1 + page * 4 + (r - 1)) % n];
    if (S.keys[r] !== f.key) {
      if (S.keys[r] !== undefined) S.at[r] = st.t + r * 0.07;
      S.keys[r] = f.key;
    }
    const age = st.t - S.at[r], y = by + r * 8;
    if (age >= 0 && age < 0.6) ctx.drawImage(noiseRow(Math.floor(age * 24) + r), bx, y);
    else if (age < 0) ctx.drawImage(noiseRow(r), bx, y);
    else ctx.drawImage(rowImg(f), bx, y);
  }
  // raden överst: ombordstigning – blinkande grön lampa
  if (Math.floor(st.t * 2) % 2 === 0) { ctx.fillStyle = '#5aff8a'; ctx.fillRect(bx + ROW_W - 1, by + 2, 1, 3); }
}
function person(P, x, fy, shirt, pants, skin, hair) {
  P.rect(x, fy - 5, 2, 5, pants);
  P.rect(x + 3, fy - 5, 2, 5, pants);
  P.rect(x, fy - 11, 5, 6, shirt);
  P.vl(x, fy - 11, 6, mix(shirt, WHITE, 0.25));
  P.rect(x + 1, fy - 14, 3, 3, skin);
  P.hl(x + 1, fy - 15, 3, hair);
}
// glasfasadens mått – delas av målningen och av resenärerna som går inne i hallen
function flygGeom(b) {
  const L = ART_OVER, W = b.w, R = L + W, T = BASE - b.h;
  const d0 = b.door.x0 - b.x + L, d1 = b.door.x1 - b.x + L;
  return { L, W, R, T, d0, d1, G0: T + 24, G1: BASE - 2, mulls: [L, L + 18, L + 36, L + 54, L + 72, L + 88, d1 + 3, d1 + 21, d1 + 39, d1 + 57, d1 + 75, R - 2] };
}
// reflexer, spröjs, tvärposter och sparklist (ligger framför allt som syns genom glaset)
function flygFrame(P, g, night, str) {
  reflect(P, g.L, g.G0, g.W, g.G1 - g.G0, night, str, 3);
  for (const mx of g.mulls) {
    if (mx >= g.d0 - 3 && mx <= g.d1 + 2) continue;
    P.vl(mx, g.G0, g.G1 - g.G0, 0xd8dce2);
    P.vl(mx + 1, g.G0, g.G1 - g.G0, 0x6a7078);
  }
  for (const my of [g.G0, g.G0 + 14, DT - 2]) { P.hl(g.L, my, g.W, 0xdfe3e8); P.hl(g.L, my + 1, g.W, 0x7a8088); }
  rows(P, g.L, g.G1, g.W, [0xaab0b8, 0x5a6068]);
}
function flygTrolleys(P, R) {
  for (let k = 0; k < 3; k++) {
    const vx = R - 42 + k * 6, vy = BASE - 12;
    P.box(vx, vy, 12, 8, 0x8a9098);
    for (let x = vx + 2; x < vx + 11; x += 2) P.vl(x, vy + 1, 6, 0xaab0b8, 0.7);
    P.vl(vx + 11, vy - 6, 6, 0x9aa0a8);
    P.rect(vx + 9, vy - 7, 4, 2, 0xd8303a);
    P.px(vx + 1, vy + 9, 0x1a1a1e); P.px(vx + 10, vy + 9, 0x1a1a1e);
  }
}
// resenärer med rullväskor som går fram och tillbaka inne i hallen (två gångrutor per håll)
let WALKERS = null;
function walkers() {
  if (WALKERS) return WALKERS;
  WALKERS = [];
  const looks = [[0x3a7bd5, 0x2d3a5c, 0xe0a97f, 0x3b2619, 0xd8303a], [0xe0c040, 0x3a3a44, 0xa86a44, 0x1a1a1a, 0], [0x8a5ac0, 0x5a4a3a, 0xf0c8a0, 0xe8c070, 0x3a5a8a], [0x5aa05a, 0x2a2a30, 0xe0a97f, 0x6a3a1a, 0x2a2a30]];
  for (const [shirt, pants, skin, hair, bag] of looks) {
    const set = { r: [], l: [] };
    for (const dir of ['r', 'l']) for (let f = 0; f < 2; f++) {
      const P = new Pix(12, 17), px = 4, R = dir === 'r';
      if (f === 0) {
        P.rect(px, 11, 2, 5, pants); P.rect(px + 3, 11, 2, 5, pants);
        P.hl(px - 1, 16, 2, 0x1a1a1e); P.hl(px + 4, 16, 2, 0x1a1a1e);
      } else {
        P.rect(px + 1, 11, 3, 5, pants);
        P.hl(px + 1, 16, 3, 0x1a1a1e);
      }
      P.rect(px, 5, 5, 6, shirt);
      P.vl(R ? px : px + 4, 5, 6, mix(shirt, WHITE, 0.25));
      P.vl(R ? px + 4 : px, 5, 6, mul(shirt, 0.75));
      P.rect(px + 1, 1, 3, 4, skin);
      P.px(R ? px + 4 : px, 2, skin);
      P.hl(px + 1, 0, 3, hair);
      P.px(R ? px + 1 : px + 3, 1, hair);
      if (bag) {
        const bx = R ? 0 : 9;
        P.rect(bx, 11, 3, 5, bag);
        P.hl(bx, 11, 3, mix(bag, WHITE, 0.3));
        P.px(bx, 16, 0x1a1a1e); P.px(bx + 2, 16, 0x1a1a1e);
        P.line(R ? px - 1 : px + 5, 9, R ? 2 : 9, 10, 0x6a7078);
      }
      set[dir].push(P.flush());
    }
    WALKERS.push(set);
  }
  return WALKERS;
}
const PLANE = ['.....#.....', '....###....', '....###....', '...#####...', '.#########.', '###########', '....###....', '....###....', '...#####...', '..##...##..'];
function paintFlyg(P, b, night, reg, opts = {}) {
  const L = ART_OVER, W = b.w, R = L + W, T = BASE - b.h, cx = L + (W >> 1);
  const d0 = b.door.x0 - b.x + L, d1 = b.door.x1 - b.x + L, dcx = (d0 + d1) >> 1;
  // ---- taket: ljus takduk, lanternin, aggregat ----
  area(P, L, TOP, W, T - TOP, (X, Y, i, j) => {
    let c = qmix(0xb8bcc2, 0x9a9ea6, j / (T - TOP), X, Y, 3);
    if ((X - L) % 16 === 0) c = mul(c, 0.9);
    if (hash(X, Y, 91) > 0.95) c = mul(c, 0.94);
    return c;
  });
  rows(P, L, TOP, W, [0xdfe3e8, 0xb4b8c0, 0x6a6e76]);
  const lx0 = cx - 34, lw = 68, ly0 = TOP + 5;
  P.darken(lx0 + 2, ly0 + 11, lw, 2, 0.75);
  area(P, lx0, ly0 + 3, lw, 8, (X, Y, i, j) => ((i % 6) === 0 ? 0x4a525e : night ? qmix(0xf4f6ff, 0xc8d4e8, j / 8, X, Y, 2) : qmix(0xb8d8f0, 0x4a7aa0, j / 8, X, Y, 3)));
  rows(P, lx0 - 1, ly0, lw + 2, [0xf0f2f4, 0xc8ced6, 0x9aa2ac]);
  if (night) reg.win.push([lx0, ly0 + 3, lw, 8]);
  for (const [hx, hw] of [[L + 30, 22], [L + 58, 16]]) {
    const hy = T - 16;
    P.darken(hx + 2, hy + 10, hw, 2, 0.75);
    area(P, hx, hy, hw, 3, (X, Y, i, j) => (j === 0 ? 0xeef0f2 : 0xd4d8dc));
    P.ell(hx + hw / 2, hy + 1.5, hw / 4, 1.2, 0x2a2c32, 1, 2);
    area(P, hx, hy + 3, hw, 7, (X, Y, i) => (i % 3 === 0 ? 0x8a9098 : jit(0xb8bec4, X, Y, 92, 0.05)));
    P.vl(hx + hw - 1, hy, 10, 0x7a8088);
  }
  // vindstrutens stång
  const sx = L + 12;
  P.vl(sx, 20, T - 22, 0x5a5e66);
  P.vl(sx + 1, 20, T - 22, 0xb8bec6);
  P.rect(sx - 2, T - 3, 5, 2, 0x6a6e76);
  reg.sock = [sx + 2, 19];
  // ---- flygledartornet (TY = hyttens överkant; fyren sitter en bit ner i världen så den syns) ----
  const tx = R - 30, TY = 14, sTop = TY + 18, sBot = T - 6;
  P.darken(tx - 4, sBot - 1, 18, 3, 0.75);
  area(P, tx - 6, sTop, 12, sBot - sTop, (X, Y, i) => {
    let c = mul(jit(0xe2e0da, X, Y, 93, 0.05), [0.76, 0.9, 1, 1.06, 1.08, 1.05, 1, 0.96, 0.9, 0.84, 0.76, 0.64][i]);
    if ((Y - sTop) % 7 === 0) c = mul(c, 0.88);
    return c;
  });
  for (let y = sTop + 3; y < sBot - 3; y += 4) P.rect(tx - 1, y, 2, 2, night ? 0xffe8a8 : 0x2a3440);
  P.rect(tx - 12, TY + 15, 24, 2, 0x5a5e66);
  P.hl(tx - 12, TY + 15, 24, 0x9aa0a8);
  P.hl(tx - 12, TY + 13, 24, 0x6a6e76);
  for (let x = tx - 12; x < tx + 12; x += 3) P.px(x, TY + 14, 0x6a6e76);
  for (let j = 0; j < 10; j++) {
    const y = TY + 3 + j, half = 13 - Math.floor(j / 3);
    for (let x = tx - half; x < tx + half; x++) {
      const u = x - (tx - half);
      let c = night ? qmix(0xc8f8e0, 0x6ab89a, j / 10, x, y, 3) : qmix(0x5a8a98, 0x1e3a44, j / 10, x, y, 3);
      if (u % 5 === 0) c = 0x2a2e36;
      else if (!night && ((((x * 2 - y * 3) % 17) + 17) % 17) < 2) c = mix(c, WHITE, 0.4);
      P.px(x, y, c);
    }
  }
  if (night) { reg.win.push([tx - 13, TY + 3, 26, 10]); reg.halo.push([tx, TY + 8, 18, 9, 0xa8ffd8, 0.25]); }
  P.rect(tx - 15, TY, 30, 3, 0x4a4e56);
  P.hl(tx - 15, TY, 30, 0x9aa0a8);
  P.hl(tx - 15, TY + 2, 30, 0x2a2c32);
  P.vl(tx, TY - 8, 8, 0x6a6e76);
  P.hl(tx - 2, TY - 4, 5, 0x6a6e76);
  P.rect(tx - 1, TY - 9, 2, 2, 0x3a3e46);
  reg.beacon = [tx - 1, TY - 10];
  reg.obst = [[tx - 15, TY - 1], [tx + 14, TY - 1]];
  // liten radar som sticker upp från hyttaket
  P.vl(tx + 9, TY - 3, 3, 0x6a6e76);
  P.hl(tx + 7, TY - 4, 5, 0xc8ccd2);
  P.hl(tx + 8, TY - 5, 3, 0xe8ecf0);
  // ---- vingtaket + fasadskylten ----
  for (let x = 0; x < W + 16; x++) {
    const ov = x < L ? L - x : x >= R ? x - R + 1 : 0;
    const y0 = T + Math.round(ov * 0.3), th = Math.max(2, 5 - Math.round(ov * 0.4));
    for (let j = 0; j < th; j++) P.px(x, y0 + j, j === 0 ? 0xffffff : j === th - 1 ? 0x8a929c : j === 1 ? 0xe6eaee : 0xc4cad2);
  }
  area(P, L, T + 5, W, 18, (X, Y, i, j) => {
    let c = qmix(0xf2f4f6, 0xd0d6dc, j / 18, X, Y, 3);
    if ((X - L) % 38 === 37) c = 0xb4bac2;
    return c;
  });
  P.hl(L, T + 23, W, 0x4a5260);
  const fb = bits(BIG, 'FLYGPLATSEN', { x2: true, gap: 1 }), tw = 13 + 5 + fb.w, tx0 = cx - (tw >> 1);
  PLANE.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(tx0 + 1 + i, T + 9 + j, j < 5 ? 0x2a6ad0 : 0x1a4a9a); });
  sign(P, fb, tx0 + 18, T + 7, { shadow: 0xb8c0ca, fill: (i, j, X, Y) => qmix(0x3a7ad8, 0x1a4a9a, j / fb.h, X, Y, 3), hi: 0x6aa6f0, lo: 0x0e3070 });
  reg.letters = { B: fb, x: tx0 + 18, y: T + 7 };

  // ---- glasfasaden: insidan först, sedan reflexer, spröjs och detaljer ----
  const G0 = T + 24, G1 = BASE - 2;
  area(P, L, G0, W, G1 - G0, (X, Y) => {
    if (Y < G0 + 14) return night ? qmix(0xf4f6fc, 0xd8deea, (Y - G0) / 14, X, Y, 3) : qmix(0xd8ecfa, 0x8ab8dc, (Y - G0) / 14, X, Y, 3);
    if (Y < 140) return night ? qmix(0xf2efe6, 0xe0dccf, (Y - G0 - 14) / 40, X, Y, 3) : qmix(0xa4a8a8, 0x86898a, (Y - G0 - 14) / 40, X, Y, 3);
    return night ? qmix(0xeae6dc, 0xd0cabc, (Y - 140) / 44, X, Y, 4) : qmix(0x9c9a94, 0x74726c, (Y - 140) / 44, X, Y, 4);
  });
  if (!night) for (let k = 0; k < 7; k++) {
    const ccx = L + 20 + k * 33 + Math.round(hash(k, 0, 94) * 10), ccy = G0 + 5 + Math.round(hash(k, 1, 94) * 5);
    P.ell(ccx, ccy, 8 + hash(k, 2, 94) * 6, 2.6, 0xffffff, 0.55, 3);
  }
  for (let x = L + 4; x < R; x += 11) P.hl(x, G0 + 16, 5, night ? 0xffffff : 0xdce4ec);
  // rulltrappa upp till avgångshallen (syns genom glaset ovanför entrén)
  const ex0 = d0 + 2, ex1 = d1 - 2, ey0 = DT - 4, ey1 = G0 + 20;
  for (let x = ex0; x <= ex1; x++) {
    const yt = Math.round(ey0 + ((ey1 - ey0) * (x - ex0)) / (ex1 - ex0));
    P.px(x, yt - 3, 0x1e2026);
    P.px(x, yt - 2, 0xc8e4f0, 0.7);
    P.px(x, yt - 1, 0xc8e4f0, 0.7);
    P.px(x, yt, x % 3 === 0 ? 0x4a4e56 : 0x8a8e96);
    [0xe8ecf0, 0xc8ccd2, 0xa8aeb6, 0x5a6068].forEach((c, i) => P.px(x, yt + 1 + i, c));
  }
  const rideX = Math.round(ex0 + (ex1 - ex0) * 0.62);
  person(P, rideX, Math.round(ey0 + (ey1 - ey0) * 0.62) - 1, night ? 0xe07a30 : mul(0xe07a30, 0.8), 0x2d3a5c, 0xf0c8a0, 0x3b2619);
  // incheckningen till höger (skylten hängs upp efter spröjsen så den går att läsa)
  const ib = bits(SMALL, 'INCHECKNING'), ibx = R - 44 - (ib.w >> 1);
  for (let k = 0; k < 5; k++) {
    const kx = d1 + 16 + k * 15;
    if (kx + 12 > R - 2) break;
    P.vl(kx + 5, 122, 8, 0x3a3e46);
    P.rect(kx + 3, 119, 5, 3, 0x1e2026); P.hl(kx + 4, 120, 3, night ? 0x9ad0ff : 0x4a7aa0);
    P.rect(kx, 130, 12, 2, 0xf4f4f0);
    area(P, kx, 132, 12, 8, (X, Y, i, j) => (i === 0 ? 0x5a8ad0 : j === 7 ? 0x1e3460 : 0x2e5a9a));
    P.px(kx + 5, 135, 0xffd23a);
  }
  // resenärer i kön och i hallen
  const folk = [[d1 + 22, 158], [d1 + 34, 160], [d1 + 50, 157], [d1 + 58, 159], [d1 + 76, 158], [L + 24, 176], [L + 40, 174], [L + 70, 175]];
  folk.forEach(([px0, fy], i) => {
    const sc = [0x3a7bd5, 0xd8583a, 0x5aa05a, 0xe0c040, 0x8a5ac0, 0x2a2a30][i % 6], sk = [0xe0a97f, 0xa86a44, 0xf0c8a0][i % 3];
    person(P, px0, fy, night ? sc : mul(sc, 0.8), night ? 0x2d3a5c : 0x222a40, night ? sk : mul(sk, 0.85), [0x3b2619, 0x1a1a1a, 0xe8c070][i % 3]);
    if (i % 2 === 0) { P.rect(px0 + 6, fy - 6, 4, 6, [0xd8303a, 0x3a5a8a, 0x2a2a30][i % 3]); P.hl(px0 + 6, fy - 6, 4, 0xe8ecf0); P.vl(px0 + 8, fy - 9, 3, 0x8a9098); }
  });
  // sittbänkar + stor krukväxt till vänster
  for (let k = 0; k < 3; k++) { const sx0 = L + 50 + k * 8; P.rect(sx0, 162, 6, 3, 0x2e5a9a); P.rect(sx0, 159, 6, 3, 0x3a6ab0); P.vl(sx0 + 1, 165, 3, 0x8a9098); }
  leaves(P, L + 10, 150, 6, 9, 95, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.6);
  P.rect(L + 7, 158, 7, 6, 0xe8e4dc);
  flygFrame(P, flygGeom(b), night, 1.1);
  P.vl(ibx + 4, G0 + 16, 5, 0x3a3e46); P.vl(ibx + ib.w - 5, G0 + 16, 5, 0x3a3e46);
  P.rect(ibx - 3, G0 + 21, ib.w + 6, 9, 0x1e2026);
  P.hl(ibx - 3, G0 + 21, ib.w + 6, 0x4a4e56);
  sign(P, ib, ibx, G0 + 23, { fill: 0xffd23a });
  if (night) reg.halo.push([ibx + ib.w / 2, G0 + 25, ib.w / 2 + 4, 6, 0xffd23a, 0.2]);
  if (night) {
    reg.win.push([d0 - 5, G0, R - (d0 - 5), DT - G0], [d1 + 3, DT, R - d1 - 3, 22], [L, 148, d0 - 3 - L, 24]);
    reg.halo.push([cx, 120, W * 0.55, 40, 0xe8f0ff, 0.18]);
    reg.halo.push([cx + 40, BASE + 8, 70, 10, 0xe0ecff, 0.18]);
  }
  // ---- avgångstavlan (flip-display) på en granitpanel ----
  area(P, L + 4, G0 + 4, 83, 58, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0x6a6e78;
    if (i === 82 || j === 57) return 0x1a1c22;
    return jit(0x3a3e46, X, Y, 96, 0.12);
  });
  for (const [bx, by] of [[L + 6, G0 + 6], [L + 84, G0 + 6], [L + 6, G0 + 59], [L + 84, G0 + 59]]) P.px(bx, by, 0xb8bec6);
  const BX = L + 7, BY = G0 + 7, BW = 77, BH = 52;
  P.rect(BX, BY, BW, BH, 0x0c0d10);
  const hb = bits(BIG, 'AVGÅNGAR');
  sign(P, hb, BX + 3, BY + 3, { fill: 0xffd23a, lo: 0xd8a818 });
  PLANE.forEach((row, j) => { if (j < 9) for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(BX + BW - 14 + i, BY + 1 + j, 0xffd23a); });
  P.hl(BX + 1, BY + 12, BW - 2, 0x3a3e46);
  reg.board = { x: BX + 2, y: BY + 14 };
  for (let r = 0; r < 5; r++) {
    const ry = BY + 14 + r * 8;
    for (let x = BX + 1; x < BX + BW - 1; x++) for (let y = ry; y < ry + ROW_H; y++) {
      const cell = (x - BX - 2) % 4;
      P.px(x, y, cell === 3 ? 0x0c0d10 : y === ry + 3 ? 0x111317 : 0x22262c);
    }
  }
  // ---- entrén: portal, glastak, AVGÅNG-skylt, sensor ----
  area(P, d0 - 12, DT - 14, d1 - d0 + 24, 2, (X, Y, i, j) => (j === 0 ? 0xf0f8ff : 0xa8d0e8));
  P.hl(d0 - 12, DT - 12, d1 - d0 + 24, 0x3a3e46);
  P.hl(d0 - 12, DT - 11, d1 - d0 + 24, 0x5a5e66);
  P.darken(d0 - 10, DT - 10, d1 - d0 + 20, 2, 0.7);
  P.line(d0 - 12, DT - 13, d0 - 4, DT - 26, 0x6a6e76);
  P.line(d1 + 11, DT - 13, d1 + 3, DT - 26, 0x6a6e76);
  const ab = bits(SMALL, 'AVGÅNG'), abw = ab.w + 12, abx = dcx - (abw >> 1), aby = DT - 24;
  P.rect(abx, aby, abw, 10, 0x2a2c30);
  P.box(abx, aby, abw, 10, 0x4a4e56);
  sign(P, ab, abx + 10, aby + 3, { fill: 0xffd23a });
  for (const [i, j] of [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [1, 4], [3, 4]]) P.px(abx + 3 + i, aby + 2 + j, 0xffd23a);
  reg.avgang = { B: ab, x: abx + 10, y: aby + 3, bx: abx, bw: abw };
  for (const fx of [d0 - 3, d1]) area(P, fx, DT - 10, 3, BASE - DT + 10, (X, Y, i) => [0xe0e4ea, 0xa8aeb6, 0x5a6068][i]);
  area(P, d0, DT - 4, d1 - d0, 4, (X, Y, i, j) => [0xe0e4ea, 0xb8bec6, 0x8a9098, 0x3a3e46][j]);
  P.rect(dcx - 3, DT - 3, 6, 2, 0x1a1c22);
  P.px(dcx + 1, DT - 3, 0xff3a2a);
  // ---- planteringslåda och bagagevagnar ----
  const px0 = L + 6, pw = 80;
  leaves(P, px0 + 14, BASE - 14, 14, 6, 97, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.6);
  leaves(P, px0 + 40, BASE - 15, 16, 7, 98, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.6);
  leaves(P, px0 + 66, BASE - 14, 13, 6, 99, 0x2e6a2a, 0x4f9a3a, 0x7fc85a, 0.6);
  blooms(P, px0 + 2, BASE - 20, pw - 4, 10, 100, [0xe8303a, 0xffd23a, 0xffffff, 0xf07ab0], 0.12);
  area(P, px0, BASE - 9, pw, 9, (X, Y, i, j) => (j === 0 ? 0xe8e4dc : j === 8 ? 0x6a665e : i === 0 ? 0xd8d4cc : i === pw - 1 ? 0x8a867e : jit(0xb8b4ac, X, Y, 101, 0.08)));
  flygTrolleys(P, R);
  P.rect(L, BASE, W, 1, 0x1a1418, 0.35);
  P.rect(L, BASE + 1, W, 1, 0x1a1418, 0.15);
  rows(P, d0 - 3, BASE, d1 - d0 + 6, [0xc8ccd2, 0x8a9098]);
  // ---- snö: takduken (lanternin, aggregat, torn och stång lämnas), entréns glastak, skylt, lådan ----
  if (opts.snow) {
    const AGG = [[L + 30, 22], [L + 58, 16]], hy = T - 16;
    const keep = (X, Y) => (X >= lx0 - 1 && X < lx0 + lw + 1 && Y >= ly0 && Y < ly0 + 12)
      || AGG.some(([hx, hw]) => X >= hx && X < hx + hw && Y >= hy && Y < hy + 11)
      || (X >= tx - 6 && X < tx + 6 && Y >= sTop && Y < sBot) || (X >= tx - 4 && X < tx + 14 && Y >= sBot - 1 && Y < sBot + 2)
      || (X >= sx - 2 && X <= sx + 2 && Y >= 20);
    snowArea(P, L + 1, TOP + 3, W - 2, T - TOP - 3, 510, 0.88, keep);
    snowCap(P, L, TOP, W, 2);
    snowCap(P, lx0 - 1, ly0 - 1, lw + 2, 2);
    for (const [hx, hw] of AGG) snowCap(P, hx, hy - 1, hw, 2);
    snowCap(P, d0 - 12, DT - 15, d1 - d0 + 24, 1);
    snowCap(P, abx, aby - 1, abw, 1);
    snowCap(P, px0, BASE - 10, pw, 1);
  }
}
DOOR_ART.flyg = {
  light: 0xe8f2ff,
  interior(I, w, h) {
    area(I, 0, 0, w, h, (X, Y, i, j) => qmix(0xffffff, 0xe4e8ec, j / 24, X, Y, 3));
    for (let x = 2; x < w; x += 8) { I.hl(x, 1, 5, 0xffffff); I.hl(x, 2, 5, 0xd8dce2); }
    I.rect(4, 5, 16, 6, 0x1e2026);
    for (let y = 6; y < 11; y += 2) I.hl(5, y, 12, 0xffd23a, 0.8);
    I.rect(w - 18, 5, 14, 6, 0x1e2026);
    for (let y = 6; y < 11; y += 2) I.hl(w - 17, y, 10, 0xf4f4ec, 0.8);
    for (let k = 0; k < 3; k++) { const kx = 2 + k * 16; I.rect(kx, 16, 12, 2, 0xf4f4f0); I.rect(kx, 18, 12, 6, 0x2e5a9a); I.vl(kx, 18, 6, 0x5a8ad0); }
    for (let y = 24; y < h; y++) for (let x = 0; x < w; x++) {
      let c = qmix(0xf4f2ec, 0xd8d4ca, (y - 24) / 10, x, y, 3);
      if ((x + (y - 24) * 3) % 16 === 0) c = mul(c, 0.94);
      if (x > 29 && x < 36 && y > 27 && y < 31) c = mul(c, 0.9);
      I.px(x, y, c);
    }
    person(I, 30, 28, 0xd8583a, 0x2d3a5c, 0xe0a97f, 0x3b2619);
    I.rect(36, 22, 4, 6, 0x3a5a8a); I.hl(36, 22, 4, 0xe8ecf0);
  },
  panel(S, w, h, side) {
    S.erase(0, 0, w, h);
    areaA(S, 0, 0, w, h, 0xb8dcea, (X, Y, i, j) => 0.22 + ((((i * 2 - j * 3 + (side === 'r' ? 9 : 0)) % 29) + 29) % 29 < 3 ? 0.35 : 0));
    rows(S, 0, 0, w, [0xd8dce2, 0x9aa0a8]);
    rows(S, 0, h - 3, w, [0xd8dce2, 0x9aa0a8, 0x6a7078]);
    const oe = side === 'l' ? 0 : w - 2, ie = side === 'l' ? w - 1 : 0;
    S.vl(oe, 0, h, 0xd8dce2); S.vl(oe + 1, 0, h, 0x9aa0a8);
    S.vl(ie, 0, h, 0x7a8088);
    for (let x = 2; x < w - 2; x += 3) S.px(x, 15, 0xffffff, 0.85);
    for (let x = 3; x < w - 2; x += 3) S.px(x, 16, 0xffffff, 0.6);
    S.rect(side === 'l' ? w - 4 : 2, 12, 2, 9, 0xc8ccd2);
  },
};
const FLYG = {
  paint: paintFlyg,
  kit(b, reg) {
    const K = {};
    const { B } = reg.letters, P = new Pix(B.w, B.h);
    sign(P, B, 0, B.up, { fill: (i, j) => (j < 3 ? 0xffffff : 0xd8ecff), lo: 0x9ad0ff });
    K.lit = P.flush();
    K.halo = haloOf(B, 0x5aa8ff, 5, 0.45);
    const ab = reg.avgang.B, Q = new Pix(ab.w, ab.h);
    sign(Q, ab, 0, ab.up, { fill: 0xffe070 });
    K.avg = Q.flush();
    const hb = bits(BIG, 'AVGÅNGAR'), H = new Pix(hb.w, hb.h);
    sign(H, hb, 0, hb.up, { fill: 0xffd23a, lo: 0xd8a818 });
    K.head = H.flush();
    K.headUp = hb.up;
    // vindstrutens fyra bildrutor
    K.sock = [];
    for (let f = 0; f < 4; f++) {
      const S = new Pix(20, 12), droop = [0, 1, 2, 1][f];
      for (let u = 0; u < 17; u++) {
        const t = u / 16, cy = 3 + droop * t ** 1.5 + Math.sin(u * 0.6 + f * 1.6) * 0.8 * t, hh = 2.6 - u * 0.1;
        const y0 = Math.round(cy - hh), y1 = Math.round(cy + hh);
        for (let y = y0; y <= y1; y++) {
          let c = u === 0 ? 0x5a5e66 : Math.floor(u / 4) % 2 ? 0xf4f4f0 : 0xf07a1e;
          if (y === y1) c = mul(c, 0.75);
          else if (y === y0) c = mix(c, WHITE, 0.25);
          S.px(u, y, c);
        }
      }
      K.sock.push(S.flush());
    }
    return K;
  },
  beacon(st) {
    const a = st.t * Math.PI * 1.1;
    return { a, white: Math.cos(a), green: Math.cos(a + Math.PI) };
  },
  // resenärerna i hallen: ritas bakom en förmålad ram (reflexer, spröjs, bagagevagnar)
  travellers(ctx, b, st, K) {
    const g = flygGeom(b), ox = b.x - ART_OVER, x0 = g.d1 + 4, x1 = g.R - 2, span = x1 - x0 + 26;
    const W = walkers();
    for (let i = 0; i < W.length; i++) {
      const dir = i % 2 ? 'l' : 'r', sp = 8 + i * 2.6;
      const u = (st.t * sp + i * 41) % span;
      const x = Math.round(dir === 'r' ? x0 - 13 + u : x1 + 1 - u), fy = BASE - 5 - (i % 2) * 2;
      const vx0 = Math.max(x, x0), vx1 = Math.min(x + 12, x1);
      if (vx1 <= vx0) continue;
      const img = W[i][dir][Math.floor(st.t * 5 + i * 0.5) % 2];
      ctx.drawImage(img, vx0 - x, 0, vx1 - vx0, 17, ox + vx0, fy - 16, vx1 - vx0, 17);
    }
    const key = st.night ? 'n' : 'd';
    if (!K.front) K.front = {};
    if (!K.front[key]) {
      const P = new Pix(b.w + ART_OVER * 2, HGT);
      flygFrame(P, g, !!st.night, 0.55);
      flygTrolleys(P, g.R);
      K.front[key] = P.flush();
    }
    const fx = g.d1 + 3, fw = g.R - fx, fy0 = DT, fh = BASE - DT;
    ctx.drawImage(K.front[key], fx, fy0, fw, fh, ox + fx, fy0, fw, fh);
  },
  live(ctx, b, st, reg, K) {
    const ox = b.x - ART_OVER;
    FLYG.travellers(ctx, b, st, K);
    drawBoard(ctx, b, st, reg);
    const fr = K.sock[((Math.floor(st.t * 5 + Math.sin(st.t * 0.7) * 3) % 4) + 4) % 4];
    ctx.drawImage(fr, ox + reg.sock[0], reg.sock[1]);
    const bc = FLYG.beacon(st), [bx, by] = reg.beacon;
    ctx.fillStyle = bc.white > bc.green ? (bc.white > 0.6 ? '#ffffff' : '#c8ccd0') : bc.green > 0.6 ? '#5aff8a' : '#3a9a5a';
    ctx.fillRect(ox + bx, by, 2, 2);
    if (st.t % 1.6 < 0.6) { ctx.fillStyle = '#ff3a2a'; for (const [x, y] of reg.obst) ctx.fillRect(ox + x, y, 1, 1); }
  },
  glow(ctx, b, st, k, reg, K) {
    const ox = b.x - ART_OVER, { B, x, y } = reg.letters;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * 0.9;
    ctx.drawImage(K.lit, ox + x, y - B.up);
    const av = reg.avgang;
    ctx.drawImage(K.avg, ox + av.x, av.y - av.B.up);
    ctx.drawImage(K.head, ox + reg.board.x + 1, reg.board.y - 11 - K.headUp);
    drawBoard(ctx, b, st, reg);
    ctx.globalAlpha = k * 0.8;
    ctx.drawImage(K.halo.img, ox + x - K.halo.pad, y - B.up - K.halo.pad);
    ctx.globalAlpha = k * 0.06;
    ctx.fillStyle = '#ffe8a0';
    ctx.fillRect(ox + reg.board.x - 4, reg.board.y - 14, ROW_W + 8, 50);
    // fyren: två ljuskäglor (vit och grön) som sveper runt
    const bc = FLYG.beacon(st), [bx, by] = reg.beacon, lx = ox + bx + 1, ly = by + 1;
    for (const [ang, col] of [[bc.a, 0xffffff], [bc.a + Math.PI, 0x5aff8a]]) {
      const dx = Math.sin(ang) * 90, face = Math.cos(ang), n = Math.abs(Math.round(dx)), s = Math.sign(dx);
      ctx.fillStyle = rgb(col);
      for (let i = 2; i < n; i += 2) {
        const hh = 1 + Math.floor(i / 16);
        ctx.globalAlpha = k * 0.22 * (0.45 + 0.55 * Math.max(0, face)) * (1 - i / n);
        ctx.fillRect(lx + s * i - (s < 0 ? 2 : 0), ly - hh, 2, hh * 2 + 1);
      }
      if (face > 0.75) {
        ctx.globalAlpha = k * (face - 0.75) * 2.4;
        ctx.fillRect(lx - 3, ly - 3, 6, 6);
        ctx.fillRect(lx - 6, ly - 1, 12, 2);
      }
    }
    if (st.t % 1.6 < 0.6) {
      ctx.fillStyle = '#ff3a2a';
      for (const [ox2, oy2] of reg.obst) { ctx.globalAlpha = k * 0.4; ctx.fillRect(ox + ox2 - 1, oy2 - 1, 3, 3); ctx.globalAlpha = k; ctx.fillRect(ox + ox2, oy2, 1, 1); }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },
};

// ======================= gemensamt: paint / live / glow =======================
const SPECS = { kafe: KAFE, burgare: BURGARE, frukt: FRUKT, flyg: FLYG };
const REG = new Map(), KITS = new Map(), GLOWS = new Map();

function paintArt(b, night, opts = {}) {
  const spec = SPECS[b.kind];
  const reg = { win: [], halo: [] };
  const P = new Pix(b.w + ART_OVER * 2, HGT);
  spec.paint(P, b, !!night, reg, opts);
  // snö på alla fria överkanter (skorstenar, torn, skyltar) utöver husets egna snöytor
  if (opts.snow) snowEdges(P);
  const cv = P.flush();
  // den stängda dörren målas in i den statiska bilden (live() ritar den levande)
  try { drawDoorAt(P.ctx, doorKit(b), b.door.x0 - b.x + ART_OVER, DT, 0); } catch (e) { console.error('dörren kunde inte målas:', e); }
  REG.set(b.id, reg);
  return { cv, reg };
}
function regOf(b) {
  if (!REG.has(b.id)) paintArt(b, false);
  return REG.get(b.id);
}
function kitOf(b) {
  let K = KITS.get(b.id);
  if (!K) { K = SPECS[b.kind].kit ? SPECS[b.kind].kit(b, regOf(b)) : {}; KITS.set(b.id, K); }
  return K;
}
// lysande lager: tända fönster (kopierade från nattmålningen) + ljusglorior
function glowKit(b) {
  let G = GLOWS.get(b.id);
  if (G) return G;
  const { cv, reg } = paintArt(b, true);
  const W = b.w + ART_OVER * 2;
  const lit = mkCanvas(W, HGT), lc = lit.getContext('2d');
  for (const [x, y, w, h] of reg.win) if (w > 0 && h > 0) lc.drawImage(cv, x, y, w, h, x, y, w, h);
  const halo = new Pix(W, HGT + 30);
  for (const [hx, hy, rx, ry, c, a] of reg.halo) halo.ell(hx, hy, rx, ry, c, a);
  G = { lit, halo: halo.flush() };
  GLOWS.set(b.id, G);
  return G;
}

function makeArt(kind) {
  const spec = SPECS[kind];
  return {
    paint(b, night, opts) { return paintArt(b, night, opts || {}).cv; },
    live(ctx, b, st) {
      drawDoorAt(ctx, doorKit(b), b.door.x0, DT, st.doorOpen);
      spec.live?.(ctx, b, st, regOf(b), kitOf(b));
    },
    glow(ctx, b, st) {
      const dark = st.env?.dark ?? (st.night ? 0.5 : 0);
      const k = clamp(dark / 0.5, 0, 1);
      if (k <= 0) return;
      // Allt i glow() är additivt ('lighter') – glöden ritas efter allt annat, så en
      // täckande kopia skulle dölja folk och träd som står framför huset.
      const G = glowKit(b), ox = b.x - ART_OVER;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k * 0.42;
      ctx.drawImage(G.lit, ox, 0);
      ctx.globalAlpha = k * 0.6;
      ctx.drawImage(G.halo, ox, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      doorGlow(ctx, b, st, k);
      spec.glow?.(ctx, b, st, k, regOf(b), kitOf(b));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}

export const BUILDING_ART = { kafe: makeArt('kafe'), burgare: makeArt('burgare'), frukt: makeArt('frukt'), flyg: makeArt('flyg') };
