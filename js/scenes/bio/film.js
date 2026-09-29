// BIO PIXEL – filmerna som går på duken i salongen (js/scenes/shop-bio.js) och
// affischerna i foajén. Samma sex filmer som fasadens ljusskylt (buildings-south.js):
// PIXELHÄMNAREN 3, KÄRLEK PÅ PIXELGATAN, TURBOPOLIS, SOMMAR I STAN, SISTA NATTBUSSEN
// och AMORE PÅ SÖDER.
//
// Varje film är en rad tagningar (shots) på 240 × 80 spelpixlar – ett pixelkorn, samma
// figurer som i resten av spelet (drawPerson) och spelets pixeltypsnitt för titlar och
// textremsor. En visning = BIO PIXEL-vinjetten + filmens titel + fyra tagningar + slutskylt,
// runt 32 sekunder. Klippen tonas med ett dithrat svart (Bayer) i stället för halvgenomskinligt.
//
// cues = när publiken reagerar (skratt, gråt, oj, aww, heja) – salongen läser dem.
// light = tagningens huvudfärg – duken lyser upp publikens huvuden i den färgen.
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { drawPerson } from '../../core/people.js';

export const FW = 240, FH = 80;
const WALK = [1, 3, 2, 3];
const WHITE = 0xffffff;
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const R = (c, x, y, w, h, col) => { c.fillStyle = typeof col === 'number' ? css(col) : col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const P1 = (c, x, y, col) => R(c, x, y, 1, 1, col);

// ---------- målarverktyg (samma stil som butikerna) ----------
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
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
// pixelkarta direkt på canvasen: en sträng per rad, '.' = genomskinligt
function spr(c, x, y, rows, pal, flip = false) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j], n = r.length;
    for (let i = 0; i < n; i++) { const col = pal[r[i]]; if (col !== undefined) P1(c, x + (flip ? n - 1 - i : i), y + j, col); }
  }
}
// samma sak i en Pix (bakgrunder och affischer som målas en gång)
function sprP(P, x, y, rows, pal) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const col = pal[rows[j][i]]; if (col !== undefined) P.px(x + i, y + j, col); }
}
// text med svart kontur runt om (textremsor, titlar)
function outlined(c, F, s, x, y, fill, out = '#000000', thick = true) {
  const d = thick ? [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [ox, oy] of d) ctxText(c, F, s, x + ox, y + oy, out);
  ctxText(c, F, s, x, y, fill);
}
const cx = (F, s) => Math.round((FW - textW(F, s)) / 2);
// textremsan längst ner (svensk textning, som på riktigt bio)
function sub(c, s) { outlined(c, SMALL, s, cx(SMALL, s), FH - 9, '#fff6c8'); }

// bakgrunder målas en gång och cachas
const BG = new Map();
function bg(key, w, paint) {
  let cv = BG.get(key);
  if (!cv) { const P = new Pix(w, FH); paint(P, w); cv = P.flush(); BG.set(key, cv); }
  return cv;
}
// rullande bakgrund (sömlös i x)
function scroll(c, img, off) {
  const w = img.width, x = -Math.round(((off % w) + w) % w);
  c.drawImage(img, x, 0); c.drawImage(img, x + w, 0);
}
// dithrad svart ton (0 = inget, 1 = helsvart) – förberäknade Bayer-masker
const FADE = [];
function fade(c, k) {
  const lv = Math.round(clamp(k, 0, 1) * 16);
  if (!lv) return;
  if (!FADE[lv]) {
    const P = new Pix(FW, FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (bayer(x, y) < lv / 16) P.px(x, y, 0x000000);
    FADE[lv] = P.flush();
  }
  c.drawImage(FADE[lv], 0, 0);
}
// hjärta ur hjärtkurvan (x² + y² − 1)³ − x²y³ ≤ 0, s = halva bredden
function heart(c, hx, hy, s, col = 0xe0304a, hi = 0xff7a94, lo = 0xa01830) {
  hx = Math.round(hx); hy = Math.round(hy);
  for (let j = 0; j <= Math.ceil(2.3 * s); j++) for (let i = -Math.ceil(1.25 * s); i <= Math.ceil(1.25 * s); i++) {
    const u = i / s, v = 1.2 - (j + 0.5) / s, f = (u * u + v * v - 1) ** 3 - u * u * v * v * v;
    if (f > 0) continue;
    P1(c, hx + i, hy + j, f > -0.03 ? lo : (j < s * 0.7 && i < 0) ? hi : col);
  }
}
function smallHeart(c, x, y, col = 0xff5a7a) {
  spr(c, x, y, ['.#.#.', '#####', '.###.', '..#..'], { '#': col });
}
// explosion: glödande kärna, eldring, rök och gnistor (r växer med k)
function boom(c, ex, ey, k, seed = 1) {
  const r = 3 + ease(Math.min(1, k * 1.6)) * 17, fadeK = clamp((k - 0.55) / 0.45, 0, 1);
  for (let j = -Math.ceil(r); j <= r; j++) for (let i = -Math.ceil(r * 1.2); i <= r * 1.2; i++) {
    const d = Math.hypot(i / 1.15, j) + (hash(i, j, 700 + seed) - 0.5) * 3;
    if (d > r) continue;
    const q = d / r;
    let col;
    if (fadeK > 0.6) col = q < 0.5 ? 0x5a4a4a : 0x3a3434;                       // bara rök kvar
    else if (q < 0.25 - fadeK * 0.25) col = 0xfff6d0;
    else if (q < 0.45) col = fadeK > 0.2 ? 0xf07a20 : 0xffd040;
    else if (q < 0.7) col = fadeK > 0.2 ? 0xb8301a : 0xf07a20;
    else if (q < 0.88) col = 0xb8301a;
    else col = 0x4a3434;
    if (fadeK > 0.3 && hash(i, j, 710 + seed) < fadeK * 0.5) continue;
    P1(c, ex + i, ey + j, col);
  }
  for (let n = 0; n < 12; n++) {                                                    // gnistor som flyger ut
    const a = hash(n, 3, 720 + seed) * 6.283, v = 16 + hash(n, 4, 720 + seed) * 22;
    const px = ex + Math.cos(a) * v * k * 1.4, py = ey + Math.sin(a) * v * k + 30 * k * k;
    if (k < 0.9) P1(c, px, py, n & 1 ? 0xffd040 : 0xf07a20);
  }
}
// regn: snedställda streck i två lager
function rain(c, t, dark = false) {
  for (let n = 0; n < 70; n++) {
    const sp = n % 3 === 0 ? 150 : 110, x0 = hash(n, 1, 801) * (FW + 40);
    const y = ((hash(n, 2, 801) * FH + t * sp) % (FH + 10)) - 6, x = x0 - y * 0.35 - 20;
    const col = n % 3 === 0 ? (dark ? 0x8a9ab8 : 0xc8d8f0) : (dark ? 0x5a6a88 : 0x9aaac8);
    P1(c, x, y, col); P1(c, x - 0.35, y + 1, col); if (n % 3 === 0) P1(c, x - 0.7, y + 2, col);
  }
}
function stars(P, w, h, seed) {
  for (let i = 0; i < w / 5; i++) {
    const x = Math.floor(hash(i, 1, seed) * w), y = Math.floor(hash(i, 2, seed) * h);
    P.px(x, y, hash(i, 3, seed) > 0.7 ? 0xffffff : 0x9aa8d8, hash(i, 4, seed) > 0.5 ? 1 : 0.6);
  }
}
function moon(P, mx, my, r = 6) {
  area(P, mx - r - 3, my - r - 3, r * 2 + 7, r * 2 + 7, (X, Y) => {
    const d = Math.hypot(X + 0.5 - mx, Y + 0.5 - my);
    if (d < r) return hash(X >> 1, Y >> 1, 42) > 0.8 ? 0xd8d0b0 : (X - mx + Y - my < -3 ? 0xfffbe8 : 0xf0e8c8);
    return null;
  });
  P.ell(mx, my, r + 6, r + 6, 0xe8e0c0, 0.14, 3);
}
// siluett av en stad med tända fönster
function skyline(P, w, y0, hMin, hMax, col, win, seed, winP = 0.3) {
  let x = 0;
  while (x < w) {
    const bw = 8 + Math.floor(hash(x, 1, seed) * 16), bh = hMin + Math.floor(hash(x, 2, seed) * (hMax - hMin));
    for (let yy = y0 - bh; yy < FH; yy++) for (let xx = x; xx < Math.min(w, x + bw - 1); xx++) {
      let c = col;
      if (yy > y0 - bh + 2 && (xx - x) % 3 === 1 && (yy - y0) % 3 === 0 && hash(xx, yy, seed + 1) < winP) c = hash(xx, yy, seed + 2) > 0.3 ? win : mix(win, 0x8ab0e0, 0.6);
      P.px(xx, yy, c);
    }
    if (hash(x, 5, seed) > 0.6) P.vl(x + (bw >> 1), y0 - bh - 5, 5, col);                    // antenn
    if (hash(x, 6, seed) > 0.75) P.px(x + (bw >> 1), y0 - bh - 6, 0xff3a3a);                 // flyglampa
    x += bw;
  }
}

// ---------- figurerna (fasta objekt – drawPerson cachar per objekt) ----------
const L = {
  hjalte: { skin: '#e0a97f', hair: '#1d1714', style: 'spiky', top: 'jacket', shirt: '#2b2b30', accent: '#7a2e3e', bottom: 'jeans', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: false, build: 6 },
  hjalteSol: { skin: '#e0a97f', hair: '#1d1714', style: 'spiky', top: 'jacket', shirt: '#2b2b30', accent: '#7a2e3e', bottom: 'jeans', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: 'sun', build: 6 },
  glitch: { skin: '#f6d7bf', hair: '#2f8f6f', style: 'mohawk', top: 'jacket', shirt: '#e8e3d6', accent: '#8e5bd1', bottom: 'pants', pants: '#5a4a7a', shoes: '#2f2f36', glasses: 'round', beard: 'mustache', build: 5 },
  nora: { skin: '#f6d7bf', hair: '#b7392b', style: 'long', top: 'tee', shirt: '#f8a0b8', accent: '#ffffff', bottom: 'dress', pants: '#e85a7a', shoes: '#c23b3b', blush: true, build: 4 },
  leo: { skin: '#c68a5c', hair: '#3b2619', style: 'short', top: 'shirt', shirt: '#3a7bd5', accent: '#f4f1ea', bottom: 'pants', pants: '#2b2b30', shoes: '#6b3e1e', build: 5 },
  polis: { skin: '#eec3a0', hair: '#6b4226', style: 'short', top: 'jacket', shirt: '#2d3a5c', accent: '#f0b429', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', hat: 'cap', cap: '#2d3a5c', build: 5 },
  unge: { skin: '#eec3a0', hair: '#ecd489', style: 'ponytail', top: 'tee', shirt: '#f0b429', accent: '#d9433b', bottom: 'shorts', pants: '#3f5f8f', shoes: '#f2f2f2', hat: 'cap', cap: '#d9433b', kid: true, build: 4, blush: true },
  glassfarbror: { skin: '#f6d7bf', hair: '#e6e2da', style: 'bald', beard: 'full', top: 'shirt', shirt: '#f4f1ea', accent: '#e8443a', bottom: 'pants', pants: '#5f7f99', shoes: '#6b3e1e', hat: 'cap', cap: '#f4f1ea', apron: true, build: 6 },
  springare: { skin: '#744a2d', hair: '#1d1714', style: 'afro', top: 'hoodie', shirt: '#e07a2e', accent: '#2f3440', bottom: 'jeans', pants: '#3f5f8f', shoes: '#f2f2f2', build: 5 },
  chauffor: { skin: '#e0a97f', hair: '#6b4226', style: 'short', beard: 'full', top: 'shirt', shirt: '#5f7f99', accent: '#f4f1ea', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', hat: 'cap', cap: '#2d3a5c', glasses: 'square', build: 6 },
  sofia: { skin: '#a06a43', hair: '#1d1714', style: 'bun', top: 'tee', shirt: '#c9323a', accent: '#f4f1ea', bottom: 'dress', pants: '#a8222c', shoes: '#1c1c1c', blush: true, build: 4 },
  marco: { skin: '#eec3a0', hair: '#6b4226', style: 'side', top: 'suit', shirt: '#2f3440', accent: '#c9323a', bottom: 'pants', pants: '#2f3440', shoes: '#1c1c1c', build: 5 },
  servitor: { skin: '#e0a97f', hair: '#1d1714', style: 'short', beard: 'mustache', top: 'shirt', shirt: '#f4f1ea', accent: '#2b2b30', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', build: 6 },
};
const person = (c, x, y, look, dir = 'down', frame = 0) => drawPerson(c, Math.round(x), Math.round(y), look, dir, frame);
const walkF = (t, sp = 8.5) => WALK[Math.floor(t * sp) % 4];

// ---------- föremål ----------
const CRYSTAL = ['..#..', '.#o#.', '#ooo#', '.#o#.', '..#..'];
function crystal(c, x, y, t) {
  const g = Math.sin(t * 8) > 0 ? 0xbff8ff : 0x7ae8f8;
  for (let r = 5; r >= 3; r--) for (let a = 0; a < 16; a++) { const th = a / 16 * 6.283 + t; if (hash(a, r, 90) > 0.5) P1(c, x + 2 + Math.cos(th) * r, y + 2 + Math.sin(th) * r, 0x3ab8d8); }
  spr(c, x, y, CRYSTAL, { '#': 0x1a8ab0, o: g });
}
// sportbilen (röd med spoiler) och polisbilen, 30 × 12, vänd åt höger
function sportbil(c, x, y, t, flame = false) {
  x = Math.round(x); y = Math.round(y);
  const B = 0xd8242e, H = 0xff6a5a, D = 0x8a141c;
  R(c, x + 2, y + 5, 26, 4, B); R(c, x + 2, y + 5, 26, 1, H);
  R(c, x + 9, y + 1, 11, 4, B); R(c, x + 10, y + 2, 4, 3, 0x9ad8f8); R(c, x + 15, y + 2, 4, 3, 0x6aa8d8); R(c, x + 9, y + 1, 11, 1, H);
  R(c, x, y + 3, 4, 1, D); R(c, x + 1, y + 4, 1, 2, D);                                  // spoilern bak
  R(c, x + 2, y + 9, 26, 1, D);
  R(c, x + 27, y + 6, 2, 1, 0xfff6b0); R(c, x + 2, y + 6, 1, 1, 0xff2a2a);
  R(c, x + 6, y + 6, 12, 1, 0xf6f6f6);                                                   // racingrand
  for (const wx of [x + 7, x + 22]) { R(c, wx - 2, y + 8, 5, 4, 0x141418); P1(c, wx, y + 9 + (Math.floor(t * 20) & 1), 0x8a8a90); }
  if (flame) for (let k = 0; k < 6; k++) P1(c, x - 1 - k - (Math.floor(t * 30 + k) % 2), y + 6 + ((k + Math.floor(t * 25)) % 2), k < 2 ? 0xfff0a0 : k < 4 ? 0xffa030 : 0xe0401a);
}
function polisbil(c, x, y, t, lights = true) {
  x = Math.round(x); y = Math.round(y);
  R(c, x + 1, y + 5, 28, 4, 0xf4f4f8); R(c, x + 1, y + 7, 28, 2, 0x2a4ab8);
  R(c, x + 8, y + 1, 13, 4, 0xf4f4f8); R(c, x + 9, y + 2, 5, 3, 0x9ad8f8); R(c, x + 15, y + 2, 5, 3, 0x6aa8d8);
  const on = Math.floor(t * 8) & 1;
  if (lights) { R(c, x + 11, y, 3, 1, on ? 0x3a6aff : 0x1a2a6a); R(c, x + 15, y, 3, 1, on ? 0x6a1a1a : 0xff3a3a); }
  ctxText(c, SMALL, 'POLIS', x + 5, y + 5, '#2a4ab8');
  R(c, x + 28, y + 6, 1, 1, 0xfff6b0);
  for (const wx of [x + 7, x + 23]) { R(c, wx - 2, y + 8, 5, 4, 0x141418); P1(c, wx, y + 9 + (Math.floor(t * 20) & 1), 0x8a8a90); }
}
// bussen (röd stadsbuss, linje 4), 112 × 48 (y = taket, hjulen står på y + 48), vänd åt höger;
// doors 0..1 = dörrarna glider upp
function buss(c, x, y, t, doors = 0, night = true) {
  x = Math.round(x); y = Math.round(y);
  const B = 0xc8262e, H = 0xe8605a, D = 0x7a141c, GL = night ? 0xf8d890 : 0x9ac8e8, GD = night ? 0xd8b060 : 0x6a9ac0;
  // karossen med rundat tak
  R(c, x + 2, y, 104, 1, H); R(c, x + 1, y + 1, 108, 1, H); R(c, x, y + 2, 111, 38, B);
  R(c, x, y + 2, 111, 1, mix(B, WHITE, 0.25)); R(c, x + 110, y + 3, 1, 36, D);
  R(c, x + 8, y - 2, 20, 2, 0x8a8a90); R(c, x + 9, y - 3, 18, 1, 0xa8a8b0);                  // ventilationen på taket
  // fönsterraden (lyser gult i kväll) med passagerare
  for (let k = 0; k < 9; k++) {
    const wx = x + 4 + k * 10;
    if (k === 4 || k === 8) continue;                                                     // dörrarna sitter där
    R(c, wx, y + 7, 8, 14, GL); R(c, wx, y + 7, 8, 1, 0x3a1a14); R(c, wx + 1, y + 8, 2, 12, mix(GL, WHITE, 0.3));
    if (k % 3 !== 2) { const hc = [0x3a2a1a, 0x1d1714, 0xa5692f][k % 3]; R(c, wx + 3, y + 12, 4, 4, 0xe0a97f); R(c, wx + 3, y + 11, 4, 2, hc); R(c, wx + 2, y + 16, 6, 5, mix([0x3a7bd5, 0x46a35a, 0x8e5bd1][k % 3], GL, 0.2)); }
  }
  R(c, x, y + 24, 111, 2, 0xf4f1ea); R(c, x, y + 26, 111, 1, 0xb8b0a0);                    // vita randen
  R(c, x, y + 34, 111, 6, D); R(c, x, y + 34, 111, 1, mul(B, 0.8));
  ctxText(c, SMALL, 'LINJE 4', x + 10, y + 28, '#f4f1ea');
  // vindrutan fram (höger) och destinationsskylten 4 CENTRUM
  R(c, x + 98, y + 6, 12, 18, night ? 0x2a3450 : 0x8ac0e0); R(c, x + 99, y + 7, 3, 16, night ? 0x4a5a80 : 0xc8e8f8);
  R(c, x + 60, y + 1, 38, 7, 0x141418);
  ctxText(c, SMALL, '4 CENTRUM', x + 61, y + 2, '#ffb030');
  // dörrarna (mitt och fram) glider isär
  for (const dx of [x + 44, x + 84]) {
    const o = Math.round(clamp(doors, 0, 1) * 4);
    R(c, dx - 1, y + 6, 12, 30, 0x3a1a14);
    R(c, dx, y + 7, 10, 29, night ? 0xf8e0a0 : 0xc8e0f0);
    R(c, dx - o, y + 7, 5, 29, 0x8a98a8); R(c, dx + 5 + o, y + 7, 5, 29, 0x8a98a8);
    R(c, dx - o + 1, y + 8, 3, 12, GD); R(c, dx + 6 + o, y + 8, 3, 12, GD);
    R(c, dx - o + 1, y + 22, 3, 12, GD); R(c, dx + 6 + o, y + 22, 3, 12, GD);
  }
  R(c, x + 110, y + 29, 1, 3, 0xfff6b0); R(c, x, y + 29, 1, 3, 0xff3a3a);
  // hjulen
  for (const wx of [x + 22, x + 76]) {
    R(c, wx - 7, y + 36, 15, 4, 0x2a0a0e);
    area2(c, wx - 6, y + 36, 13, 13, (X, Y) => { const d = Math.hypot(X - wx, Y - (y + 42)); return d < 6.2 ? (d < 3 ? (d < 1.5 ? 0x9a9aa0 : 0x5a5a64) : 0x141418) : null; });
    P1(c, wx + Math.round(Math.cos(t * 12) * 2), y + 42 + Math.round(Math.sin(t * 12) * 2), 0xc8c8d0);
  }
}
// hunden (glad, viftar på svansen), 16 × 11, vänd åt vänster
function hund(c, x, y, t, lick = false) {
  const wag = Math.floor(t * 10) & 1;
  const rows = [
    '..........bb....',
    '.hh......bbbb...',
    'hhhhh....b.bb...',
    'hehhbbbbbbbbb.' + (wag ? 'b.' : '.b'),
    '.hhbbbbbbbbbbb..',
    '..bbbbbbbbbbb...',
    '..bbwbbbbbwbb...',
    '..b.b.....b.b...',
    '..b.b.....b.b...',
    '..k.k.....k.k...',
  ];
  spr(c, x, y, rows, { h: 0xc8904a, b: 0xd8a45a, e: 0x1a1210, w: 0xf0d8a8, k: 0x3a2414 });
  P1(c, x, y + 3, 0x2a1a10);                                                             // nosen
  if (lick) { R(c, x - 1, y + 4 + (Math.floor(t * 12) & 1), 2, 1, 0xe85a7a); }
  else P1(c, x + 1, y + 5, 0xe85a7a);
}
// glasstrut med tre kulor (rosa, vit, choklad)
function strut(c, x, y) {
  spr(c, x, y, ['.pp.', 'pPpp', '.vv.', 'vVvv', '.cc.', 'cCcc', 'wwww', '.ww.', '.ww.', '..w.'], { p: 0xf08ab0, P: 0xffc8dc, v: 0xf4f1ea, V: 0xffffff, c: 0x7a4a2a, C: 0xa86a3a, w: 0xd8a45a });
}
function pizzakartong(c, x, y) { R(c, x, y, 9, 3, 0xe8d8b0); R(c, x, y, 9, 1, 0xf8ecd0); R(c, x + 3, y + 1, 3, 1, 0xc8262e); }
function parasoll(c, x, y, col = 0xd8242e) {
  spr(c, x, y, ['....ssss....', '..ssssssss..', '.ssssssssss.', 'ssSsSsSsSsss', 'z.....h....z', '......h.....', '......h.....', '......h.....', '.....hh.....'], { s: col, S: mix(col, WHITE, 0.3), z: mul(col, 0.6), h: 0x3a2a1a });
}
// stort paraply över två: kupol (halvbredd r), fransad kant, spröt och handtag ner till handen (hx)
function paraply(c, cxp, top, r, col, hx) {
  const hi = mix(col, WHITE, 0.3), lo = mul(col, 0.65);
  for (let j = 0; j <= 10; j++) {
    const half = Math.round(r * Math.sqrt(1 - ((10 - j) / 10) ** 2));
    for (let i = -half; i <= half; i++) P1(c, cxp + i, top + j, j < 3 && i < 0 ? hi : Math.abs(i) % 7 === 0 && j > 1 ? lo : col);
  }
  for (let i = -r; i <= r; i++) if (((i + r) % 7) < 4) P1(c, cxp + i, top + 11, lo);        // fransen
  P1(c, cxp, top - 1, 0x3a2a1a); P1(c, cxp, top - 2, 0x3a2a1a);
  const hxr = Math.round(hx ?? cxp);
  for (let y = top + 11; y < top + 32; y++) P1(c, hxr, y, 0x3a2a1a);
  P1(c, hxr - 1, top + 32, 0x3a2a1a); P1(c, hxr - 2, top + 31, 0x3a2a1a);
}
function not(c, x, y, col = '#fff0b0') {
  c.fillStyle = col;
  for (const [a, b] of [[1, 0], [2, 0], [3, 1], [1, 1], [1, 2], [1, 3], [0, 3], [0, 4], [1, 4]]) c.fillRect(Math.round(x) + a, Math.round(y) + b, 1, 1);
}
function konfetti(c, t, n = 40, seed = 5) {
  const COL = [0xff5a7a, 0xffd040, 0x5ad0ff, 0x7ae06a, 0xc07aff, 0xffffff];
  for (let i = 0; i < n; i++) {
    const x = hash(i, 1, seed) * FW + Math.sin(t * 3 + i) * 3, y = ((hash(i, 2, seed) * FH + t * (20 + hash(i, 3, seed) * 20)) % (FH + 4)) - 4;
    P1(c, x, y, COL[i % COL.length]); if (Math.floor(t * 6 + i) & 1) P1(c, x + 1, y, COL[i % COL.length]);
  }
}
// fyrverkeri: en raket i sekunden som slår ut i en krans
function fyrverkeri(c, t, seed = 3) {
  const COL = [0xff5a7a, 0xffd040, 0x5ad0ff, 0x7ae06a, 0xc07aff];
  for (let n = 0; n < 5; n++) {
    const t0 = n * 1.1, u = t - t0;
    if (u < 0 || u > 2.4) continue;
    const bx = 40 + hash(n, 1, seed) * 160, by = 10 + hash(n, 2, seed) * 18, col = COL[n % COL.length];
    if (u < 0.6) { const k = u / 0.6; P1(c, bx, lerp(FH - 20, by, k), 0xfff0c0); P1(c, bx, lerp(FH - 20, by, k) + 2, 0xffa040); continue; }
    const k = (u - 0.6) / 1.8, r = 4 + ease(k) * 16;
    for (let a = 0; a < 18; a++) {
      const th = a / 18 * 6.283, px = bx + Math.cos(th) * r, py = by + Math.sin(th) * r + k * k * 8;
      if (k < 0.85 || hash(a, n, Math.floor(t * 10)) > 0.5) P1(c, px, py, k > 0.6 && a & 1 ? mix(col, 0xffffff, 0.5) : col);
      if (k < 0.5) P1(c, bx + Math.cos(th) * r * 0.6, by + Math.sin(th) * r * 0.6 + k * k * 8, 0xfff6d0);
    }
  }
}

// ---------- bakgrunderna ----------
const bgNattStad = () => bg('nattstad', 480, (P, w) => {
  area(P, 0, 0, w, FH, (X, Y) => qmix(0x070a1c, 0x2a2050, Y / 62, X, Y, 4));
  stars(P, w, 40, 11);
  moon(P, 70, 14, 6);
  skyline(P, w, 60, 14, 36, 0x161a36, 0xf0c860, 12, 0.35);
  skyline(P, w, 72, 6, 16, 0x0c0e1c, 0xe8b050, 13, 0.25);
  // neonreklam PIXEL på ett av taken
  area(P, 300, 34, 34, 12, (X, Y, i, j) => (i === 0 || j === 0 || i === 33 || j === 11 ? 0x2a2a34 : 0x140c18));
  P.ell(317, 40, 22, 10, 0xff4a6a, 0.16, 3);
  text(P, SMALL, 'PIXEL', 308, 38, 0xff6a8a);
  P.vl(306, 46, 10, 0x2a2a34); P.vl(328, 46, 10, 0x2a2a34);
});
const bgGata = (regn) => bg('gata' + (regn ? 'R' : ''), 240, (P, w) => {
  const sky = regn ? [0x6a7280, 0x9aa2ae] : [0x7ec0ee, 0xd8f0ff];
  area(P, 0, 0, w, 20, (X, Y) => qmix(sky[0], sky[1], Y / 20, X, Y, 3));
  if (!regn) for (const [mx, my] of [[40, 5], [150, 8], [210, 3]]) { P.ell(mx, my, 12, 3.5, 0xffffff, 0.8, 3); P.ell(mx + 6, my - 2, 7, 3, 0xffffff, 0.9, 3); }
  // tre hus: tegel, kräm och turkos
  const HUS = [[0, 70, regn ? 0x8a4a3c : 0xb85a44], [70, 170, regn ? 0xb8ac90 : 0xe8d8b0], [170, 240, regn ? 0x4a7878 : 0x5a9a9a]];
  for (const [x0, x1, col] of HUS) {
    area(P, x0, 6, x1 - x0, 52, (X, Y) => {
      let c = jit(col, X, Y, 20, 0.07);
      if (col === HUS[0][2] && (Y % 4 === 0 || (X + (Y >> 2) * 3) % 7 === 0)) c = mul(c, 0.85);           // tegelfogar
      return c;
    });
    P.hl(x0, 6, x1 - x0, mix(col, WHITE, 0.3)); P.hl(x0, 7, x1 - x0, mul(col, 0.7));
    for (let wx = x0 + 6; wx < x1 - 10; wx += 16) for (const wy of [11, 23]) {                          // fönster
      area(P, wx, wy, 9, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === 8 || j === 8 ? 0xf4f1ea : i === 4 || j === 4 ? 0xe8e4dc : regn ? 0x4a5a70 : (i + j < 5 ? 0xbfe4f8 : 0x7aa8d0)));
      P.hl(wx - 1, wy + 9, 11, 0xd8d0c0);
      if ((wx + wy) % 3 === 0) { P.rect(wx + 1, wy + 1, 2, 7, 0xf8b8c8); P.rect(wx + 6, wy + 1, 2, 7, 0xf8b8c8); }
      else { P.rect(wx + 1, wy + 9, 7, 2, 0xc84a3a); P.px(wx + 2, wy + 8, 0xff6a8a); P.px(wx + 5, wy + 8, 0xffd040); P.px(wx + 7, wy + 8, 0xff6a8a); }
    }
  }
  // kaféet i mittenhuset: randig markis, skylt KAFÉ, dörr och skyltfönster med tårta
  area(P, 80, 36, 80, 6, (X, Y, i, j) => (j === 5 ? ((X >> 1) & 1 ? 0xb82a2a : 0xf4f1ea) : ((X >> 2) & 1 ? (regn ? 0x9a2a2a : 0xd83a3a) : (regn ? 0xc8c0b0 : 0xf8f4ec))));
  P.rect(104, 29, 32, 7, 0x2a1a14); P.box(104, 29, 32, 7, 0xd8b060);
  text(P, SMALL, 'KAFÉ', 113, 30, 0xf0cc5a);
  area(P, 84, 43, 22, 15, (X, Y, i, j) => (i === 0 || j === 0 || i === 21 ? 0x5a3a24 : regn ? 0x3a4a58 : 0x8ab8d8));
  P.rect(90, 51, 10, 6, 0xf4f1ea); P.rect(91, 49, 8, 2, 0xf08ab0); P.px(95, 48, 0xd83a3a);
  area(P, 112, 42, 12, 16, (X, Y, i, j) => (i === 0 || j === 0 || i === 11 ? 0x5a3a24 : j < 7 ? (regn ? 0x3a4a58 : 0x9ac8e0) : 0x7a4a2a));
  P.px(121, 51, 0xf0c040);
  area(P, 130, 43, 26, 15, (X, Y, i, j) => (i === 0 || j === 0 || i === 25 ? 0x5a3a24 : regn ? 0x3a4a58 : 0x8ab8d8));
  for (let k = 0; k < 3; k++) { P.rect(134 + k * 7, 52, 4, 5, 0xc89a6a); P.hl(134 + k * 7, 52, 4, 0xe8c090); }
  // trottoaren med stenplattor, kantsten och gatan
  area(P, 0, 58, w, 22, (X, Y) => {
    if (Y < 72) { const r = Y - 58, j = r % 5 === 0 || (X + ((r / 5) | 0) * 6) % 12 === 0; return j ? (regn ? 0x6a6a70 : 0x9a9488) : jit(regn ? 0x8a8a90 : 0xc6beb0, X, Y, 21, 0.08); }
    if (Y < 74) return Y === 72 ? (regn ? 0x9a9aa0 : 0xe6dece) : 0x6a6660;
    return jit(regn ? 0x2a2a30 : 0x4e4e56, X, Y, 22, 0.1);
  });
  if (regn) for (let k = 0; k < 8; k++) { const px = 10 + k * 29; P.hl(px, 66 + (k % 3), 8 + (k % 4) * 2, 0xb8c8d8, 0.5); }  // pölar
  // lyktstolpe och parkbänk
  P.vl(30, 26, 32, 0x2a3a34); P.rect(27, 24, 7, 3, 0x2a3a34); P.px(30, 27, 0xfff0b0);
  P.rect(186, 52, 22, 2, 0x8a5a2a); P.rect(186, 49, 22, 2, 0xa86a3a); P.vl(188, 54, 4, 0x2a2a2a); P.vl(205, 54, 4, 0x2a2a2a);
});
const bgSolnedgang = () => bg('solned', 240, (P, w) => {
  area(P, 0, 0, w, 50, (X, Y) => (Y < 22 ? qmix(0x4a2a7a, 0xe0607a, Y / 22, X, Y, 4) : qmix(0xe0607a, 0xffc070, (Y - 22) / 28, X, Y, 4)));
  // solen med retroränder
  area(P, 100, 30, 41, 21, (X, Y) => { const d = Math.hypot(X + 0.5 - 120, Y + 0.5 - 50); if (d > 16) return null; if (Y > 40 && (Y % 3 === 0)) return null; return d < 12 ? 0xfff4b0 : 0xffd070; });
  skyline(P, w, 50, 3, 12, 0x5a2a4a, 0xffd890, 31, 0.15);
  // vattnet med solens glitter
  area(P, 0, 50, w, 30, (X, Y) => {
    let c = qmix(0x7a3a6a, 0x2a1a3a, (Y - 50) / 30, X, Y, 3);
    if (Math.abs(X - 120) < 18 - (Y - 50) * 0.3 && hash(X >> 1, Y, 33) > 0.55 && Y % 2 === 0) c = 0xffd890;
    return c;
  });
  // bron: bågar, räcke och lyktor
  area(P, 0, 56, w, 4, (X, Y, i, j) => (j === 0 ? 0x3a1a2a : 0x2a1020));
  for (let a = 0; a < 4; a++) { const ax = 30 + a * 60; for (let i = -24; i <= 24; i++) { const yy = 60 + Math.round((i * i) / 50); P.px(ax + i, yy, 0x2a1020); P.px(ax + i, yy + 1, 0x2a1020); } P.rect(ax - 1, 60, 3, 20, 0x2a1020); }
  for (let x = 0; x < w; x += 4) P.vl(x, 52, 4, 0x3a1a2a);
  P.hl(0, 52, w, 0x4a2a3a);
  for (let x = 18; x < w; x += 48) { P.vl(x, 42, 14, 0x2a1020); P.rect(x - 1, 40, 3, 2, 0xfff0b0); P.ell(x, 41, 5, 4, 0xfff0b0, 0.3, 2); }
});
const bgMotorvag = () => bg('motorvag', 480, (P, w) => {
  area(P, 0, 0, w, 50, (X, Y) => qmix(0x100828, 0x4a1a5a, Y / 50, X, Y, 4));
  stars(P, w, 26, 41);
  skyline(P, w, 48, 8, 26, 0x1a1030, 0xff5ad0, 42, 0.25);
  // neonskyltar i fjärran
  for (const [nx, ny, col] of [[60, 28, 0x3ae8ff], [190, 24, 0xff5ad0], [330, 30, 0xffd040], [420, 26, 0x3ae8ff]]) { P.rect(nx, ny, 12, 3, col); P.ell(nx + 6, ny + 1, 12, 5, col, 0.25, 3); }
  // vägräcket och vägen
  area(P, 0, 48, w, 4, (X, Y, i, j) => (j === 0 ? 0xa8b0bc : j === 1 ? 0x6a7280 : (X % 16 < 2 ? 0x4a5260 : null)));
  area(P, 0, 52, w, 28, (X, Y) => { let c = jit(0x24222c, X, Y, 44, 0.12); if (Y === 53 || Y === 78) c = 0xd8d0b0; return c; });
  for (let x = 24; x < w; x += 80) { P.vl(x, 14, 34, 0x3a3a48); P.hl(x, 14, 8, 0x3a3a48); P.rect(x + 6, 15, 4, 2, 0xffc070); P.ell(x + 8, 18, 10, 8, 0xffb060, 0.2, 3); }
});
const bgFlod = () => bg('flod', 240, (P, w) => {
  area(P, 0, 0, w, 48, (X, Y) => qmix(0x0a0e28, 0x2a2a5a, Y / 48, X, Y, 4));
  stars(P, w, 30, 51);
  moon(P, 150, 12, 7);
  skyline(P, w, 46, 4, 18, 0x14163a, 0xf0c860, 52, 0.25);
  area(P, 0, 46, w, 34, (X, Y) => {
    let c = qmix(0x1a2a5a, 0x0a1230, (Y - 46) / 34, X, Y, 3);
    if (Math.abs(X - 150) < 5 && Y % 2 === 0 && hash(X, Y, 53) > 0.3) c = 0xe8e0c0;                  // månens spegling
    if (hash(X >> 2, Y, 54) > 0.93) c = mix(c, 0x6a8ad8, 0.5);
    return c;
  });
  // vänstra kajen med rampen, högra kajen
  area(P, 0, 50, 64, 30, (X, Y, i, j) => (j === 0 ? 0x8a8a90 : jit(0x5a5a64, X, Y, 55, 0.1)));
  for (let i = 0; i < 26; i++) { const top = 50 - Math.round(i * 0.4); P.vl(38 + i, top, 50 - top + 1, i === 25 ? 0xd8b040 : 0xa87a3a); P.px(38 + i, top, 0xd8a050); }
  area(P, 176, 50, 64, 30, (X, Y, i, j) => (j === 0 ? 0x8a8a90 : jit(0x5a5a64, X, Y, 56, 0.1)));
  for (let x = 2; x < 64; x += 6) P.rect(x, 51, 3, 1, (x >> 1) & 1 ? 0xd8b040 : 0x2a2a2a);
});
const bgMal = () => bg('mal', 240, (P, w) => {
  area(P, 0, 0, w, 14, (X, Y) => qmix(0x3a1a5a, 0xc8508a, Y / 14, X, Y, 3));
  // läktaren: rader med publik (huvud + tröja) på mörka bänkar
  area(P, 0, 14, w, 30, (X, Y, i, j) => (j % 6 === 5 ? 0x4a4a58 : 0x24242e));
  const SK = [0xf6d7bf, 0xe0a97f, 0xc68a5c, 0x744a2d], SH = [0xe85a5a, 0x5a8ae8, 0xf0c040, 0x7ad06a, 0xf4f1ea, 0xc07aff, 0xff9a3a];
  for (let r = 0; r < 5; r++) for (let x = 2 + (r & 1) * 2; x < w - 2; x += 5) {
    if (hash(x, r, 61) < 0.18) continue;
    const y = 14 + r * 6, sk = SK[Math.floor(hash(x, r, 62) * 4)], sh = SH[Math.floor(hash(x, r, 63) * SH.length)];
    P.rect(x, y + 1, 2, 2, sk); P.px(x, y + 1, mix(sk, 0x2a1a10, 0.5)); P.rect(x - 1, y + 3, 4, 2, sh);
    if (hash(x, r, 64) > 0.8) { P.px(x - 1, y + 1, sh); P.px(x - 1, y, sh); }                   // en vinkande arm
  }
  area(P, 0, 44, w, 6, (X, Y, i, j) => (j === 0 ? 0xf4f1ea : (X >> 3) & 1 ? 0xd8242e : 0xf4f1ea));  // sarg med reklam
  area(P, 0, 50, w, 30, (X, Y) => { let c = jit(0x3a3a44, X, Y, 63, 0.1); if (Y === 51 || Y === 78) c = 0xf4f1ea; return c; });
  // mållinjen och portalen MÅL
  for (let y = 50; y < 80; y++) for (let x = 170; x < 176; x++) P.px(x, y, ((x >> 1) + (y >> 1)) & 1 ? 0x141418 : 0xf4f1ea);
  P.rect(166, 18, 3, 32, 0x8a8a90); P.rect(177, 18, 3, 32, 0x8a8a90);
  area(P, 162, 12, 22, 8, (X, Y, i, j) => (((i >> 1) + (j >> 1)) & 1 ? 0x141418 : 0xf4f1ea));
});
const bgPark = () => bg('park', 240, (P, w) => {
  area(P, 0, 0, w, 36, (X, Y) => qmix(0x6ab8f0, 0xd0ecff, Y / 36, X, Y, 3));
  for (const [mx, my] of [[50, 8], [170, 5]]) { P.ell(mx, my, 14, 4, 0xffffff, 0.9, 3); P.ell(mx + 8, my - 3, 8, 3.5, 0xffffff, 0.9, 3); }
  P.ell(20, 8, 10, 10, 0xfff0a0, 0.35, 3); area(P, 14, 2, 13, 13, (X, Y) => (Math.hypot(X - 20, Y - 8) < 5 ? 0xfff6c0 : null));
  // vattnet och andra stranden
  area(P, 0, 30, w, 8, (X, Y) => (Y < 32 ? jit(0x4a8a4a, X, Y, 71, 0.12) : jit(Y % 2 ? 0x4a9ad8 : 0x5aaae0, X, Y, 72, 0.08)));
  // gräset och grusgången
  area(P, 0, 38, w, 42, (X, Y) => {
    const path = Y > 60 && Y < 71;
    if (path) return jit((Y === 61 || Y === 70) ? 0xb8a070 : 0xd8c8a0, X, Y, 73, 0.1);
    let c = jit(Y < 50 ? 0x5aa84a : 0x4a9a3a, X, Y, 74, 0.14);
    if (hash(X, Y, 75) > 0.986) c = hash(X, Y, 76) > 0.5 ? 0xf8f4ec : 0xffd040;                        // blommor
    return c;
  });
  // träd till vänster och höger
  for (const [tx, ty, r] of [[16, 40, 13], [226, 38, 15], [62, 36, 9]]) {
    P.rect(tx - 1, ty, 3, 18, 0x6a4a2a); P.vl(tx - 1, ty, 18, 0x8a6a3a);
    area(P, tx - r - 1, ty - r - 4, r * 2 + 3, r * 2 + 3, (X, Y) => { const d = Math.hypot(X - tx, (Y - (ty - 4)) * 1.1); if (d > r) return null; return d < r * 0.5 && X < tx ? 0x7ac85a : hash(X >> 1, Y >> 1, 77) > 0.5 ? 0x4a9a3a : 0x3a8a2e; });
  }
  // glasskiosken: randigt parasoll och skylten GLASS (vagnen ritas ovanpå glassfarbrorn)
  area(P, 158, 14, 44, 10, (X, Y, i, j) => { const e = Math.abs(i - 21.5); if (j < 2 && e > 12) return null; if (j < 4 && e > 18) return null; return (i >> 2) & 1 ? 0xf08ab0 : 0xf8f4ec; });
  P.vl(180, 24, 18, 0xc8c8c8);
});
const bgKvall = () => bg('kvall', 240, (P, w) => {
  area(P, 0, 0, w, 50, (X, Y) => (Y < 26 ? qmix(0x0e0e32, 0x4a2a6a, Y / 26, X, Y, 4) : qmix(0x4a2a6a, 0xe0806a, (Y - 26) / 24, X, Y, 4)));
  stars(P, w, 20, 81);
  skyline(P, w, 50, 4, 16, 0x2a1a3a, 0xffd890, 82, 0.3);
  area(P, 0, 50, w, 16, (X, Y) => { let c = qmix(0x3a2a5a, 0x141432, (Y - 50) / 16, X, Y, 3); if (hash(X >> 1, Y, 83) > 0.9) c = 0xffc890; return c; });
  area(P, 0, 64, w, 16, (X, Y, i, j) => { let c = jit(0x6a4a2a, X, Y, 84, 0.1); if (j === 0) c = 0x8a6a3a; if (X % 20 === 0) c = 0x3a2a14; return c; });  // bryggan
  for (let x = 12; x < w; x += 56) { P.vl(x, 46, 18, 0x2a2a2a); P.rect(x - 1, 44, 3, 2, 0xfff0b0); P.ell(x, 45, 6, 4, 0xfff0b0, 0.3, 2); }
});
const bgHallplats = () => bg('hallpl', 240, (P, w) => {
  area(P, 0, 0, w, 56, (X, Y) => {
    const hus = X < 90 ? 0x2a2438 : X < 170 ? 0x24283a : 0x2e2230;
    let c = jit(hus, X, Y, 91, 0.06);
    if (Y < 8) c = qmix(0x0a0c1e, 0x1a1a34, Y / 8, X, Y, 2);
    if (Y > 12 && Y < 50 && X % 14 > 3 && X % 14 < 11 && (Y - 12) % 13 < 8) c = hash(X >> 3, Y >> 3, 92) > 0.55 ? 0xf0c068 : 0x14182a;
    return c;
  });
  P.hl(0, 8, w, 0x3a3448); P.hl(90, 8, 80, 0x3a3e54);
  // trottoaren blank av regn, gatan
  area(P, 0, 56, w, 8, (X, Y) => jit(0x3a3a48, X, Y, 93, 0.1));
  P.hl(0, 63, w, 0x6a6a78);
  area(P, 0, 64, w, 16, (X, Y) => { let c = jit(0x1a1a24, X, Y, 94, 0.1); if (Y === 72 && X % 16 < 8) c = 0x8a8470; return c; });
  for (let k = 0; k < 6; k++) P.hl(8 + k * 40, 58 + (k % 3), 12, 0xf0c068, 0.35);                       // fönstrens spegling
  // busskuren (glas) med skylten 4 och lyktstolpen
  area(P, 150, 30, 40, 26, (X, Y, i, j) => (i === 0 || i === 39 || j === 0 ? 0x8a9aa8 : null));
  for (let j = 1; j < 26; j++) for (let i = 1; i < 39; i++) P.px(150 + i, 30 + j, 0x9ab8d8, 0.12);
  P.rect(150, 28, 40, 2, 0x5a6a78);
  P.vl(196, 20, 36, 0x6a6a78); P.rect(192, 14, 9, 7, 0xf4f4f4); P.rect(193, 15, 7, 5, 0x2a4ab8); text(P, SMALL, '4', 195, 15, 0xffffff);
  P.vl(40, 18, 38, 0x3a3a48); P.rect(37, 16, 7, 3, 0x3a3a48); P.px(40, 19, 0xfff0b0);
  P.ell(40, 22, 12, 10, 0xfff0b0, 0.18, 3); P.ell(40, 58, 12, 3, 0xfff0b0, 0.3, 3);
});
const bgGataNatt = () => bg('gatanatt', 480, (P, w) => {
  area(P, 0, 0, w, 58, (X, Y) => {
    const blk = Math.floor(X / 60), hus = [0x2a2438, 0x24283a, 0x2e2230, 0x282a30][blk % 4];
    let c = jit(hus, X, Y, 101, 0.06);
    if (Y < 6) c = 0x0c0e20;
    if (Y > 10 && Y < 30 && X % 12 > 3 && X % 12 < 9 && (Y - 10) % 10 < 6) c = hash(X >> 3, Y >> 3, 102) > 0.5 ? 0xf0c068 : 0x14182a;
    return c;
  });
  // butiksfönster: bageriet, PIZZA och kiosken
  for (const [x0, col] of [[20, 0xffd890], [140, 0xff9a5a], [260, 0x9ae0ff], [380, 0xffc0e0]]) {
    area(P, x0, 36, 44, 20, (X, Y, i, j) => (i === 0 || j === 0 || i === 43 ? 0x5a4a3a : j < 4 ? mul(col, 0.7) : jit(col, X, Y, 103, 0.1)));
    P.ell(x0 + 22, 62, 22, 3, col, 0.3, 3);
  }
  area(P, 0, 58, w, 8, (X, Y) => jit(0x3a3a48, X, Y, 104, 0.1));
  P.hl(0, 65, w, 0x6a6a78);
  area(P, 0, 66, w, 14, (X, Y) => jit(0x1a1a24, X, Y, 105, 0.1));
  for (let x = 100; x < w; x += 120) { P.vl(x, 20, 38, 0x3a3a48); P.rect(x - 3, 18, 7, 3, 0x3a3a48); P.px(x, 21, 0xfff0b0); P.ell(x, 24, 12, 10, 0xfff0b0, 0.18, 3); }
});
const bgBussInne = () => bg('bussinne', 240, (P, w) => {
  area(P, 0, 0, w, 80, (X, Y) => {
    if (Y < 4) return 0x8a8a90;
    if (Y < 8) return jit(0xd8d4c8, X, Y, 111, 0.05);
    if (Y < 36) return (X % 40 < 3) ? 0xc8c4b8 : null;                                   // fönsterstolparna
    if (Y < 40) return 0xd8d4c8;
    if (Y < 66) return jit(0xe8e4d8, X, Y, 112, 0.05);
    return jit(0x4a4a54, X, Y, 113, 0.1);                                                 // golvet
  });
  // stolarna (blått tyg med mönster), gula stänger
  for (let x = 44; x < w - 10; x += 40) {
    area(P, x, 44, 26, 22, (X, Y, i, j) => (j < 12 ? (i < 4 ? jit(0x2a4ab8, X, Y, 114, 0.1) : null) : jit(((X + Y) % 5 === 0 ? 0xd8b040 : 0x2a4ab8), X, Y, 115, 0.08)));
    P.hl(x, 56, 26, 0x3a5ad8);
  }
  for (let x = 38; x < w; x += 40) { P.vl(x, 8, 58, 0xf0c040); P.vl(x + 1, 8, 58, 0xb88a20); }
  P.hl(0, 10, w, 0xf0c040);
  // förarplatsen till vänster
  area(P, 0, 8, 36, 58, (X, Y, i, j) => (i === 35 ? 0x8a8a90 : j < 28 ? null : jit(0x3a3a44, X, Y, 116, 0.08)));
  P.rect(22, 34, 3, 16, 0x2a2a2a);
});
const bgRestaurang = () => bg('resto', 240, (P, w) => {
  area(P, 0, 0, w, 80, (X, Y) => {
    if (Y < 50) {
      let c = jit(0xa84a32, X, Y, 121, 0.06);
      if (Y > 36) c = jit(0x5a2a1a, X, Y, 122, 0.06);                                   // boaseringen
      if (Y === 36) c = 0xd8b060;
      return c;
    }
    const tile = ((X >> 3) + ((Y - 50) >> 2)) & 1;
    return jit(tile ? 0xe8dcc0 : 0x8a3a2a, X, Y, 123, 0.05);
  });
  // fönstret med månen och Söders tak
  area(P, 180, 6, 40, 28, (X, Y, i, j) => (i === 0 || j === 0 || i === 39 || j === 27 || i === 19 ? 0x5a3a1a : qmix(0x0e1030, 0x2a2a5a, j / 28, X, Y, 3)));
  area(P, 203, 9, 10, 10, (X, Y) => (Math.hypot(X - 208, Y - 14) < 4 ? 0xfffbe8 : null));
  for (let x = 181; x < 219; x++) if (x !== 199) P.vl(x, 26 + Math.round(hash(x >> 2, 0, 124) * 4), 7, 0x14142a);
  // tavlan med Italien (stövel) och den randiga girlangen
  area(P, 30, 10, 26, 18, (X, Y, i, j) => (i < 2 || j < 2 || i > 23 || j > 15 ? 0xd8b060 : j < 8 ? 0x8ac8e8 : 0x5aa84a));
  sprP(P, 40, 14, ['.gg.', '.gg.', '..gg', '..g.', '.gg.'], { g: 0x2a7a3a });
  for (let x = 0; x < w; x++) { const y = 4 + Math.round(Math.sin(x / 12) * 2); P.px(x, y, 0x3a2a1a); if (x % 12 === 6) P.px(x, y + 1, [0xff5a5a, 0xffffff, 0x5ad06a][(x / 12 | 0) % 3]); }
  // en hylla med flaskor (saft) och ett fat
  P.rect(96, 22, 44, 2, 0x5a3a1a);
  for (let k = 0; k < 6; k++) { const col = [0x2a7a3a, 0xc83a3a, 0xf0c040][k % 3]; P.rect(99 + k * 7, 14, 3, 8, col); P.px(100 + k * 7, 13, col); P.px(99 + k * 7, 15, mix(col, WHITE, 0.4)); }
});
const bgSoder = () => bg('soder', 240, (P, w) => {
  area(P, 0, 0, w, 40, (X, Y) => qmix(0x080a22, 0x2a2450, Y / 40, X, Y, 4));
  stars(P, w, 20, 131);
  moon(P, 200, 10, 5);
  // kyrktornet och husen med tända fönster
  area(P, 110, 4, 16, 40, (X, Y, i, j) => (j < 10 && Math.abs(i - 7.5) > j * 0.8 ? null : 0x1a1a30));
  P.px(118, 2, 0xd8b060); P.vl(118, 3, 2, 0xd8b060);
  area(P, 114, 18, 8, 8, (X, Y) => (Math.hypot(X - 118, Y - 22) < 3.5 ? 0xf0e0a0 : null));
  area(P, 0, 18, w, 40, (X, Y) => {
    const blk = Math.floor(X / 36), top = 18 + (blk % 3) * 4;
    if (Y < top) return null;
    if (X >= 108 && X < 128 && Y < 44) return null;
    let c = jit([0x3a2a3a, 0x2a2a44, 0x3a3030][blk % 3], X, Y, 132, 0.06);
    if (Y > top + 4 && Y < 52 && X % 9 > 2 && X % 9 < 7 && (Y - top - 4) % 9 < 5) c = hash(X >> 3, Y >> 3, 133) > 0.4 ? 0xf8d080 : 0x141428;
    return c;
  });
  // kullerstenen
  area(P, 0, 58, w, 22, (X, Y) => { const r = Y - 58, off = (r >> 2) & 1 ? 3 : 0; const edge = r % 4 === 3 || (X + off) % 6 === 5; return edge ? 0x1a1a24 : jit(0x4a4a5a, X, Y, 134, 0.14); });
  for (let x = 20; x < w; x += 70) { P.vl(x, 28, 30, 0x2a2a34); P.rect(x - 2, 25, 5, 4, 0x2a2a34); P.rect(x - 1, 26, 3, 2, 0xfff0b0); P.ell(x, 28, 14, 12, 0xfff0b0, 0.2, 3); P.ell(x, 62, 16, 4, 0xfff0b0, 0.25, 3); }
});

// ---------- titelskyltar ----------
// BIO PIXEL-vinjetten före varje film: guldtext som tänds bokstav för bokstav, strålkransen snurrar
function vinjett(c, u) {
  R(c, 0, 0, FW, FH, 0x0a0608);
  for (let a = 0; a < 24; a++) {
    const th = a / 24 * 6.283 + u * 0.6;
    for (let r = 14; r < 60; r += 2) { const x = 120 + Math.cos(th) * r * 1.6, y = 36 + Math.sin(th) * r * 0.7; if (hash(a, r, 140) > 0.35) P1(c, x, y, a & 1 ? 0x3a1a10 : 0x2a1408); }
  }
  const s = 'BIO PIXEL', n = Math.min(s.length, Math.floor(u * 7)), x = cx(BIG, s);
  const shown = s.slice(0, n);
  if (shown) outlined(c, BIG, shown, x, 30, '#f0cc5a', '#5a3a10');
  if (u > 1.4) { const p = 'PRESENTERAR'; ctxText(c, SMALL, p, cx(SMALL, p), 44, '#c8a44a'); }
  if (u > 1.2) for (let k = 0; k < 6; k++) { const sx = x + ((u * 60 + k * 23) % 60) - 4, sy = 29 + (k % 3) * 4; if (Math.floor(u * 12 + k) % 3 === 0) { P1(c, sx, sy, 0xffffff); P1(c, sx - 1, sy, 0xfff0b0); P1(c, sx + 1, sy, 0xfff0b0); P1(c, sx, sy - 1, 0xfff0b0); P1(c, sx, sy + 1, 0xfff0b0); } }
}
// filmens titelskylt: bakgrund per film + titeln i BIG med kontur
function titelskylt(c, u, lines, { bgc, bgc2, fill, out }) {
  for (let y = 0; y < FH; y++) { c.fillStyle = css(mix(bgc, bgc2, y / FH)); c.fillRect(0, y, FW, 1); }
  const k = ease(u / 0.8);
  lines.forEach(([s, F, y], i) => {
    const x = cx(F, s) + Math.round((1 - k) * (i & 1 ? 40 : -40));
    outlined(c, F, s, x, y, fill, out);
  });
}
function slutskylt(c, u, text = 'SLUT', col = '#f4f1ea', bgc = 0x08060a) {
  R(c, 0, 0, FW, FH, bgc);
  const k = ease(u / 0.6);
  if (k > 0) outlined(c, BIG, text, cx(BIG, text), 30, col, '#2a2020');
  if (u > 0.9) { const s = 'BIO PIXEL TACKAR FÖR BESÖKET'; ctxText(c, SMALL, s, cx(SMALL, s), 48, '#8a7a6a'); }
}

// ================= FILMERNA =================
// shots: { d: sekunder, light: dukens färg, subs: [[från, till, text]], draw(c, u) }
const VINJETT = { d: 2.5, light: 0x6a4a20, draw: vinjett };

// ----- PIXELHÄMNAREN 3 (action) -----
function roofRun(c, u) {
  // hjälten springer över taken, bakgrunden rullar (parallax), hopp över gapet mellan två hus
  scroll(c, bgNattStad(), u * 30 + 120);
  const off = u * 70, gap = 80 + (3.05 - u) * 70;                                  // gapet passerar under hoppet
  for (let x = -(off % 24) - 24; x < FW + 24; x += 24) {
    R(c, x, 68, 24, 12, 0x1a1a26); R(c, x, 68, 24, 1, 0x3a3a50); R(c, x + 23, 68, 1, 12, 0x0a0a12);
    if ((Math.floor((x + off) / 24) & 3) === 1) { R(c, x + 6, 60, 6, 8, 0x2a2a38); R(c, x + 6, 60, 6, 1, 0x4a4a60); }   // ventilationstrumma
  }
  R(c, gap - 9, 68, 18, 12, 0x05050a); R(c, gap - 10, 68, 1, 12, 0x3a3a50); R(c, gap + 9, 68, 1, 12, 0x2a2a38);
  for (let y = 70; y < FH; y += 3) { P1(c, gap - 6, y, 0x2a2a14); P1(c, gap + 5, y + 1, 0x3a3014); }       // gränden därnere
  const jump = u > 2.6 && u < 3.5 ? Math.sin((u - 2.6) / 0.9 * Math.PI) * 14 : 0;
  person(c, 80, 68 - jump, L.hjalte, 'right', jump ? 2 : walkF(u, 11));
  if (jump) for (let k = 0; k < 3; k++) P1(c, 70 - k * 4, 60 - jump + k * 3, 0x8a8aa8);
}
const FILM_HAMNAREN = [
  { d: 3, light: 0x8a2a1a, draw: (c, u) => {
    titelskylt(c, u, [['PIXELHÄMNAREN', BIG, 24], ['3', BIG, 40]], { bgc: 0x0a0406, bgc2: 0x5a1a10, fill: '#ffd040', out: '#5a1a08' });
    if (u > 0.4 && u < 0.55) R(c, 0, 0, FW, FH, 0xfff6d0);                               // blixten
    for (let k = 0; k < 20; k++) P1(c, (hash(k, 1, 150) * FW + u * 40) % FW, 70 - ((u * 30 + k * 7) % 60), 0xf07a20);  // gnistor
  } },
  { d: 6, light: 0x3a4a8a, subs: [[0.8, 3.6, 'HA HA! STADENS PIXELKRISTALL ÄR MIN!'], [3.8, 5.8, 'INGEN KAN STOPPA DOKTOR GLITCH!']], draw: (c, u) => {
    scroll(c, bgNattStad(), 40 + u * 4);
    for (const sx of [40, 200]) { const a = Math.sin(u * 0.9 + sx) * 0.5; for (let r = 0; r < 70; r++) P1(c, sx + Math.sin(a) * r, 78 - Math.cos(a) * r, 0x3a4a70); }  // strålkastare
    R(c, 110, 58, 80, 22, 0x10101a); R(c, 110, 58, 80, 1, 0x2a2a3a);                   // taket han står på
    const bob = Math.floor(u * 6) & 1;
    person(c, 150, 58, L.glitch, 'down', bob ? 4 : 0);
    crystal(c, 148, 12 + bob, u);
    P1(c, 144, 23, 0xf6d7bf); P1(c, 157, 23, 0xf6d7bf);
  } },
  { d: 6, light: 0x2a3a6a, subs: [[0.4, 2.4, 'STOPP, DOKTOR GLITCH!']], draw: roofRun },
  { d: 6, light: 0xa84a1a, cues: [[2.6, 'oj'], [4.4, 'skratt']], subs: [[4.2, 5.9, 'ÄSCH! JAG KOMMER TILLBAKA...']], draw: (c, u) => {
    scroll(c, bgNattStad(), 300);
    // reklamskylten som skotern flyger in i
    R(c, 162, 22, 40, 16, 0x2a2a34); R(c, 163, 23, 38, 14, u < 2.6 ? 0x1a0a14 : 0x3a1a10);
    if (u < 2.6) outlined(c, SMALL, 'PIXEL', 172, 28, Math.floor(u * 4) & 1 ? '#ff4a6a' : '#ff8aa0', '#3a0a14', false);
    R(c, 170, 38, 2, 20, 0x2a2a34); R(c, 192, 38, 2, 20, 0x2a2a34);
    R(c, 0, 62, FW, 18, 0x10101a); R(c, 0, 62, FW, 1, 0x2a2a3a);
    // svävarskotern med Glitch
    if (u < 2.6) {
      const sx = lerp(-30, 160, u / 2.6), sy = 30 + Math.sin(u * 6) * 2;
      person(c, sx + 8, sy, L.glitch, 'right', 5);
      R(c, sx, sy - 2, 20, 4, 0x8e5bd1); R(c, sx + 1, sy - 2, 18, 1, 0xc08aff); R(c, sx, sy + 2, 20, 1, 0x4a2a7a);
      for (let k = 0; k < 4; k++) P1(c, sx - 2 - k, sy - 1 + (Math.floor(u * 20 + k) & 1), k < 2 ? 0x9ae8ff : 0x3a8ad8);
      crystal(c, sx + 12, sy - 28, u);
    }
    if (u >= 2.6) boom(c, 180, 30, (u - 2.6) / 2.2, 3);
    // kristallen flyger i en båge ner i hjältens händer
    if (u >= 2.6 && u < 4) { const k = (u - 2.6) / 1.4; crystal(c, lerp(178, 88, k), 26 - Math.sin(k * Math.PI) * 18 + k * 16, u); }
    const hx = u < 2.6 ? 60 : lerp(60, 90, (u - 2.6) / 1.2);
    person(c, hx, 62, L.hjalte, u < 2.6 ? 'right' : 'down', u > 2.6 && u < 3.8 ? walkF(u, 11) : u > 4 ? 9 : 0);
    if (u >= 4) crystal(c, hx - 2, 42, u);
    // Glitch seglar ner med ett litet paraply
    if (u > 3.6) { const py = lerp(20, 50, (u - 3.6) / 2.4), px = 210 + Math.sin(u * 3) * 4; parasoll(c, px - 6, py - 48, 0x8e5bd1); person(c, px, py, L.glitch, 'down', 0); }
  } },
  { d: 6, light: 0xd8601a, cues: [[2.2, 'heja']], subs: [[1.8, 5.8, 'JAG SA JU ATT JAG SKULLE KOMMA TILLBAKA.']], draw: (c, u) => {
    for (let y = 0; y < FH; y++) { c.fillStyle = css(mix(0x2a0a08, 0xc84a1a, y / FH)); c.fillRect(0, y, FW, 1); }
    for (let k = 0; k < 40; k++) {                                                      // lågorna bakom
      const x = (k * 6 + 3) % FW, h = 12 + Math.sin(u * 7 + k) * 5 + hash(k, 1, 160) * 16;
      for (let j = 0; j < h; j++) P1(c, x + Math.round(Math.sin(u * 5 + j * 0.3 + k) * 1.5), 70 - j, j < h * 0.3 ? 0xffd040 : j < h * 0.7 ? 0xf07a20 : 0xa8301a);
    }
    R(c, 0, 70, FW, 10, 0x140808);
    person(c, 120, 74, u > 1 ? L.hjalteSol : L.hjalte, 'down', u > 1.2 && u < 1.5 ? 4 : 9);
    crystal(c, 118, 55, u);
    if (u > 0.8 && u < 1.2) { const k = (u - 0.8) / 0.4; R(c, 116, lerp(30, 42, k), 9, 2, 0x141414); }        // solglasögonen åker på
    if (u > 1.2 && u < 1.6 && Math.floor(u * 20) & 1) { P1(c, 123, 43, 0xffffff); P1(c, 122, 42, 0xffffff); P1(c, 124, 44, 0xffffff); }  // blänket
    for (let k = 0; k < 30; k++) { const y = 70 - ((u * 25 + k * 11) % 70); P1(c, (hash(k, 2, 161) * FW + Math.sin(u + k) * 4), y, 0xffd040); }
  } },
  { d: 3.5, light: 0x5a1a10, cues: [[1.0, 'skratt']], draw: (c, u) => {
    R(c, 0, 0, FW, FH, 0x08040a);
    const a = 'PIXELHÄMNAREN 4', b = 'KOMMER SNART!';
    if (Math.floor(u * 10) % 7 !== 0) outlined(c, BIG, a, cx(BIG, a), 26, '#ffd040', '#5a1a08');
    if (u > 0.8) outlined(c, SMALL, b, cx(SMALL, b), 44, '#f4f1ea', '#3a1a10');
  } },
];

// ----- KÄRLEK PÅ PIXELGATAN (romantisk komedi) -----
const boken = (c, x, y, n = 3) => { for (let k = 0; k < n; k++) { const col = [0x3a7bd5, 0xc9323a, 0x46a35a][k % 3]; R(c, x - (k & 1), y - k * 2, 8, 2, col); R(c, x - (k & 1), y - k * 2, 8, 1, mix(col, WHITE, 0.35)); } };
const FILM_KARLEK = [
  { d: 3, light: 0xd86a8a, draw: (c, u) => {
    titelskylt(c, u, [['KÄRLEK PÅ', BIG, 20], ['PIXELGATAN', BIG, 34]], { bgc: 0xf8c8d8, bgc2: 0xe87a9a, fill: '#fffaf4', out: '#a01830' });
    for (let k = 0; k < 10; k++) smallHeart(c, (hash(k, 1, 170) * FW) | 0, ((hash(k, 2, 170) * FH + u * 20 * (1 + (k & 1))) % (FH + 6)) - 6, k & 1 ? 0xffffff : 0xe0304a);
  } },
  { d: 6, light: 0x8ab8d8, cues: [[3.1, 'skratt']], subs: [[3.3, 5.8, 'OJ! FÖRLÅT, FÖRLÅT!']], draw: (c, u) => {
    c.drawImage(bgGata(false), 0, 0);
    const meet = 3;
    if (u < meet) {
      const nx = lerp(-10, 112, u / meet), lx = lerp(250, 128, u / meet);
      person(c, nx, 70, L.nora, 'right', [7, 9, 8, 9][Math.floor(u * 8) % 4]); boken(c, nx + 1, 55);
      person(c, lx, 70, L.leo, 'left', walkF(u)); R(c, lx - 8, 54, 3, 4, 0xf4f1ea); R(c, lx - 8, 54, 3, 1, 0x7a4a2a); P1(c, lx - 9, 55, 0xf4f1ea);
    } else {
      const k = u - meet;
      person(c, 110 - Math.min(4, k * 20), 70, L.nora, 'right', 0);
      person(c, 130 + Math.min(4, k * 20), 70, L.leo, 'left', 0);
      // böckerna och kaffet flyger
      for (let b = 0; b < 3; b++) { const bk = Math.min(1, k / 0.9); const bx = 118 + (b - 1) * 18 * bk, by = 52 - Math.sin(bk * Math.PI) * 16 + bk * 16; R(c, bx, by, 8, 2, [0x3a7bd5, 0xc9323a, 0x46a35a][b]); }
      for (let d = 0; d < 7; d++) { const dk = Math.min(1, k / 0.7); P1(c, 124 + (d - 3) * 5 * dk, 50 - Math.sin(dk * Math.PI) * 10 + dk * 18 + (d & 1), 0x7a4a2a); }
      if (k < 0.4) { for (const [a, b] of [[0, -4], [3, -3], [-3, -3], [4, 0], [-4, 0]]) P1(c, 120 + a, 40 + b, 0xfff6a0); }
    }
  } },
  { d: 6, light: 0xe8a0b8, cues: [[2.7, 'aww']], subs: [[0.8, 2.4, '...HEJ.'], [3.2, 5.8, 'HEJ. JAG HETER NORA.']], draw: (c, u) => {
    c.drawImage(bgGata(false), 0, 0);
    person(c, 106, 72, L.nora, 'right', 5); person(c, 134, 72, L.leo, 'left', 5);
    R(c, 110, 69, 8, 2, 0x3a7bd5); R(c, 124, 70, 8, 2, 0xc9323a); R(c, 116, 71, 8, 2, 0x46a35a);
    if (u > 2.5) { const k = ease((u - 2.5) / 0.8); heart(c, 120, 30 - k * 6, 2 + k * 4); }
    if (u > 2.5) for (const hx of [104, 136]) { P1(c, hx - 1, 53, 0xf07a8a); P1(c, hx + 1, 53, 0xf07a8a); }   // rodnaden
  } },
  { d: 6, light: 0x7a8a9a, cues: [[2.5, 'aww']], subs: [[2.2, 4.6, 'SKA VI DELA PARAPLY?']], draw: (c, u) => {
    c.drawImage(bgGata(true), 0, 0);
    const walk = u > 3.2, off = walk ? (u - 3.2) * 16 : 0;
    person(c, 104 + off, 70, L.nora, walk ? 'right' : 'down', walk ? walkF(u) : 9);
    if (!walk) boken(c, 101, 29);
    person(c, 126 + off, 70, L.leo, walk ? 'right' : 'left', walk ? walkF(u + 0.3) : 0);
    if (u > 2) { const k = ease((u - 2) / 0.4); paraply(c, 116 + off, 22 + Math.round((1 - k) * 8), 21, 0xd8242e, 124 + off); }
    rain(c, u, true);
    if (u > 2) for (let k = 0; k < 8; k++) P1(c, 96 + off + k * 5 + (k > 3 ? 2 : 0), 32 + ((u * 40 + k * 5) % 7), 0x9aaac8);    // droppar rinner av paraplyet
  } },
  { d: 6, light: 0xf0906a, cues: [[3.6, 'grat']], subs: [[4.0, 5.9, 'SLUT? NEJ - BÖRJAN.']], draw: (c, u) => {
    c.drawImage(bgSolnedgang(), 0, 0);
    const k = ease(u / 3);
    person(c, lerp(70, 113, k), 52, L.nora, 'right', k < 1 ? walkF(u) : 0);
    person(c, lerp(170, 127, k), 52, L.leo, 'left', k < 1 ? walkF(u + 0.4) : 0);
    if (u > 3.2) { const hk = ease((u - 3.2) / 1.2); heart(c, 120, 6 + (1 - hk) * 8, 3 + hk * 6, 0xff5a7a, 0xffb0c0, 0xc02040); }
    if (u > 3.5) for (let n = 0; n < 6; n++) smallHeart(c, 100 + n * 8, 20 - ((u - 3.5) * 12 + n * 5) % 20, 0xffc0d0);
  } },
  { d: 3, light: 0xd86a8a, draw: (c, u) => { slutskylt(c, u, 'SLUT', '#ffb0c8', 0x1a0810); smallHeart(c, 116, 16, 0xe0304a); } },
];

// ----- TURBOPOLIS (action) -----
const FILM_TURBO = [
  { d: 3, light: 0xa03ac8, draw: (c, u) => {
    for (let y = 0; y < FH; y++) { c.fillStyle = css(mix(0x14062a, 0x4a1260, y / 40)); c.fillRect(0, y, FW, 1); }
    area2(c, 96, 40, 48, 22, (X, Y) => (Math.hypot(X - 120, Y - 62) < 22 && (Y < 50 || Y % 3) ? (Y < 50 ? 0xffd040 : 0xff5a9a) : null));  // synthsolen
    for (let x = -12; x <= 12; x++) { for (let y = 60; y < FH; y++) { const tx = 120 + x * (y - 56) * 1.2; if (Math.abs(tx - Math.round(tx)) < 0.5) P1(c, tx, y, 0xff3ad0); } }
    for (let r = 0; r < 6; r++) { const y = 62 + ((r * 4 + u * 12) % 20); R(c, 0, y, FW, 1, 0xa01ac8); }
    const s = 'TURBOPOLIS', x = cx(BIG, s) + Math.round((1 - ease(u / 0.6)) * -80);
    for (let i = 0; i < 3; i++) ctxText(c, BIG, s, x + 2 - i, 22 + 2 - i, ['#2a0a3a', '#3ae8ff', '#ff5ad0'][i]);
    outlined(c, BIG, s, x, 20, '#f4f8ff', '#1a0a2a', false);
  } },
  { d: 6, light: 0x6a3a9a, subs: [[1.0, 3.6, 'HALLÅ DÄR! STANNA BILEN!']], draw: (c, u) => {
    scroll(c, bgMotorvag(), u * 260);
    for (let x = -((u * 400) % 40); x < FW; x += 40) R(c, x, 65, 18, 1, 0xe8e0c0);      // mittlinjen rusar förbi
    sportbil(c, 150, 58 + (Math.floor(u * 10) & 1), u, false);
    polisbil(c, 40 + Math.sin(u * 1.5) * 10, 60, u);
    const on = Math.floor(u * 8) & 1;
    c.fillStyle = on ? 'rgba(80,120,255,.25)' : 'rgba(255,60,60,.25)'; c.fillRect(30 + Math.sin(u * 1.5) * 10, 70, 50, 3);
  } },
  { d: 6, light: 0xe06a2a, cues: [[2.2, 'heja']], subs: [[0.4, 1.9, 'DAGS FÖR ... TURBO!']], draw: (c, u) => {
    const shake = u > 2 ? Math.round(Math.sin(u * 60) * 1) : 0;
    c.save(); c.translate(shake, 0);
    for (let y = 0; y < 30; y++) { c.fillStyle = css(mix(0x14062a, 0x6a1a6a, y / 30)); c.fillRect(-2, y, FW + 4, 1); }
    for (let x = -2; x < FW + 2; x++) { const h = 3 + Math.round(hash(x >> 2, 0, 181) * 6); R(c, x, 30 - h, 1, h, 0x1a0a2a); if ((x & 3) === 1 && hash(x, 1, 181) > 0.5) P1(c, x, 30 - h + 2, 0xff5ad0); }
    R(c, -2, 30, FW + 4, 14, 0x1a0a2a);
    const sp = u > 2 ? 3 : 1;
    for (let y = 30; y < 44; y++) { const k = (y - 30) / 14, hw = 3 + k * 118; R(c, 120 - hw, y, hw * 2, 1, y & 1 ? 0x24222c : 0x2a2832); R(c, 120 - hw, y, 2, 1, 0xd8d0b0); R(c, 120 + hw - 2, y, 2, 1, 0xd8d0b0); }
    for (let n = 0; n < 6; n++) { const k = ((u * 0.9 * sp + n / 6) % 1), y = 30 + k * k * 14; R(c, 120 - (k * 3), y, 1 + k * 6, 1 + k, 0xe8e0c0); }   // mittlinjen rusar emot
    for (let n = 0; n < 6; n++) { const k = ((u * 0.7 * sp + n / 6) % 1); const x = 120 + (n & 1 ? 1 : -1) * (8 + k * k * 140); R(c, x, 28 - k * 18, 2, 2 + k * 8, [0x3ae8ff, 0xff5ad0, 0xffd040][n % 3]); }
    if (u > 2) for (let n = 0; n < 16; n++) { const a = hash(n, 1, 180) * 6.283, r = ((u * 120 + n * 13) % 120); R(c, 120 + Math.cos(a) * r, 30 + Math.sin(a) * r * 0.5, 2, 1, 0xfff0d0); }
    R(c, 20, 40, 200, 4, 0xd8242e); R(c, 20, 40, 200, 1, 0xff6a5a); R(c, 60, 41, 120, 1, 0xf6f6f6);   // motorhuven
    // instrumentbrädan: hastighetsmätaren och den röda TURBO-knappen
    R(c, -2, 44, FW + 4, 36, 0x1a1a22); R(c, -2, 44, FW + 4, 1, 0x4a4a58);
    area2(c, 44, 48, 30, 26, (X, Y) => { const d = Math.hypot(X - 59, Y - 66); return d < 12 ? (d > 10 ? 0x8a8a98 : 0x0a0a12) : null; });
    for (let a = 0; a < 40; a++) { const th = Math.PI * (1.05 + a / 40 * 0.9); P1(c, 110 + Math.cos(th) * 26, 86 + Math.sin(th) * 20, 0x3a3a48); P1(c, 110 + Math.cos(th) * 25, 86 + Math.sin(th) * 19, 0x5a5a68); }  // ratten
    const ang = Math.PI * (0.9 + clamp(u / 4, 0, 1) * 1.1);
    for (let r = 0; r < 9; r++) P1(c, 59 + Math.cos(ang) * r, 66 + Math.sin(ang) * r, 0xff3a3a);
    for (let a = 0; a < 9; a++) { const th = Math.PI * (0.9 + a / 8 * 1.2); P1(c, 59 + Math.cos(th) * 9, 66 + Math.sin(th) * 9, a > 6 ? 0xff3a3a : 0xf4f1ea); }
    const pressed = u > 1.9;
    R(c, 150, 58 + (pressed ? 2 : 0), 30, 12, pressed ? 0xa8141c : 0xd8242e); R(c, 150, 58 + (pressed ? 2 : 0), 30, 1, 0xff7a6a); R(c, 148, 70, 34, 3, 0x2a2a34);
    ctxText(c, SMALL, 'TURBO', 156, 62 + (pressed ? 2 : 0), '#fff0d0');
    if (pressed && Math.floor(u * 6) & 1) R(c, 146, 56, 38, 1, 0xffd040);
    const hy = pressed ? 50 : lerp(80, 48, u / 1.9);                                    // handsken trycker
    spr(c, 160, hy, ['.kkkk.', 'kKKKKk', 'kKKKKk', 'kKKKKk', '.kKKk.', '.kKKk.', '.kKKk.', '.kKKk.', '.kKKk.', '.kKKk.'], { k: 0x0a0a0a, K: 0x2a2a34 });
    c.restore();
    if (u > 2) for (let n = 0; n < 10; n++) { const y = (n * 8 + u * 50) % FH; R(c, 0, y, 4 + (n % 3), 1, 0xff9a3a); R(c, FW - 5, (y + 20) % FH, 5, 1, 0xff9a3a); }
  } },
  { d: 6, light: 0x2a3a7a, cues: [[1.9, 'oj']], draw: (c, u) => {
    c.drawImage(bgFlod(), 0, 0);
    const t0 = 1.4, T = 2.6;
    let x, y;
    if (u < t0) { x = lerp(-30, 34, u / t0); y = 39; }
    else if (u < t0 + T) { const k = (u - t0) / T; x = lerp(34, 186, k); y = 39 - Math.sin(k * Math.PI) * 30 + k * 0; }
    else { x = 186 + (u - t0 - T) * 30; y = 39 - Math.max(0, 2 - (u - t0 - T) * 10); }
    sportbil(c, x, y, u, u > t0 - 0.2);
    if (u > t0 + T && u < t0 + T + 0.5) for (let k = 0; k < 8; k++) P1(c, 196 + k * 3, 48 - ((u * 40 + k) % 4), 0xc8c8d0);
    polisbil(c, Math.min(6, lerp(-40, 6, u / 2.2)), 40, u);
    if (u > 2.3) for (let n = 0; n < 3; n++) P1(c, 22 + n * 2, 38 - n, 0xf4f4f8);              // polisen kliar sig
    if (u > t0 && u < t0 + T) for (let n = 0; n < 5; n++) { const k = clamp((u - t0) / T - n * 0.04, 0, 1); P1(c, lerp(34, 186, k) + 2, 45 - Math.sin(k * Math.PI) * 30, 0xff9a3a); }
  } },
  { d: 6, light: 0xc8508a, cues: [[3.0, 'skratt']], subs: [[2.2, 5.9, 'SNYGGT KÖRT! MEN HÄR GÄLLER 50, KOMPIS.']], draw: (c, u) => {
    c.drawImage(bgMal(), 0, 0);
    const x = u < 1.6 ? lerp(-30, 190, u / 1.6) : 190 + Math.min(10, (u - 1.6) * 20);
    sportbil(c, x, 58, u, u < 1.6);
    if (u > 1.2) konfetti(c, u - 1.2, 50, 7);
    const px = u < 2 ? lerp(-40, 90, u / 2) : 90;
    polisbil(c, px, 60, u, u < 2);
    if (u > 2.2) person(c, 130, 72, L.polis, 'right', u > 3.4 && u < 4 ? 4 : 0);
  } },
  { d: 3, light: 0x6a2a8a, draw: (c, u) => slutskylt(c, u, 'SLUT', '#3ae8ff', 0x0a0418) },
];

// ----- SOMMAR I STAN (romantisk komedi / feelgood) -----
const FILM_SOMMAR = [
  { d: 3, light: 0xf0b030, draw: (c, u) => {
    R(c, 0, 0, FW, FH, 0xffe070);
    for (let a = 0; a < 16; a++) { const th = a / 16 * 6.283 + u * 0.4; for (let r = 10; r < 140; r++) if (a & 1) P1(c, 120 + Math.cos(th) * r, 40 + Math.sin(th) * r * 0.6, 0xfff0a0); }
    area2(c, 104, 24, 33, 33, (X, Y) => (Math.hypot(X - 120, Y - 40) < 14 ? 0xffb030 : null));
    titelskylt2(c, u, [['SOMMAR', BIG, 24], ['I STAN', BIG, 38]], '#fffaf0', '#c8501a');
  } },
  { d: 6, light: 0x8ac86a, subs: [[1.0, 3.0, 'TRE KULOR, TACK!'], [3.8, 5.8, 'VARSÅGOD, LILLA VÄN!']], draw: (c, u) => {
    c.drawImage(bgPark(), 0, 0);
    person(c, 180, 60, L.glassfarbror, 'down', Math.floor(u * 2) & 1 ? 4 : 0);
    glassvagn(c, 160, 44);
    const kx = u < 1 ? lerp(20, 146, u) : 146;
    person(c, kx, 70, L.unge, u < 1 ? 'right' : 'right', u < 1 ? walkF(u) : u > 3.6 ? (Math.floor(u * 4) & 1 ? 3 : 0) : 0);
    if (u > 3.4 && u < 3.8) strut(c, lerp(172, 151, (u - 3.4) / 0.4), lerp(40, 48, (u - 3.4) / 0.4));
    if (u >= 3.8) strut(c, 151, 48 - (Math.floor(u * 4) & 1));
  } },
  { d: 6, light: 0x7ab85a, cues: [[2.8, 'grat']], subs: [[2.8, 4.8, 'NEEEJ! MIN GLASS!']], draw: (c, u) => {
    c.drawImage(bgPark(), 0, 0);
    const fall = 2;
    if (u < fall) { const kx = lerp(40, 110, u / fall); person(c, kx, 68, L.unge, 'right', walkF(u)); strut(c, kx + 4, 46 - (Math.floor(u * 8) & 1)); }
    else {
      person(c, 114, 70, L.unge, 'right', 5);
      const k = clamp((u - fall) / 0.6, 0, 1);
      if (k < 1) strut(c, lerp(118, 140, k), 46 - Math.sin(k * Math.PI) * 16 + k * 16);
      else { spr(c, 136, 66, ['..pp.vv..', '.pPpvVvcc', 'pppvvvccc', '.wwwwww..'], { p: 0xf08ab0, P: 0xffc8dc, v: 0xf4f1ea, V: 0xffffff, c: 0x7a4a2a, w: 0xd8a45a }); }
      if (u > fall + 0.8) for (let n = 0; n < 2; n++) { const ty = 44 + ((u * 20 + n * 6) % 12); P1(c, 111 + n * 6, ty, 0x6ac8ff); P1(c, 111 + n * 6, ty + 1, 0x3a8ad8); }
    }
    R(c, 104, 69, 4, 2, 0x8a8a90); R(c, 104, 68, 3, 1, 0xb8b8c0);                        // stenen
  } },
  { d: 6, light: 0x8ac86a, cues: [[1.8, 'skratt'], [3.6, 'skratt']], subs: [[2.4, 4.4, 'VOFF!'], [4.6, 5.9, 'HAHA! DEN GILLAR JORDGUBB!']], draw: (c, u) => {
    c.drawImage(bgPark(), 0, 0);
    person(c, 114, 70, L.unge, 'right', u > 3.5 ? (Math.floor(u * 6) & 1 ? 5 : 6) : 5);
    const dx = u < 1.6 ? lerp(250, 142, u / 1.6) : 142;
    const lick = u > 1.6;
    if (!lick || Math.floor(u * 3) % 2) spr(c, 136, 66, ['..pp.vv..', '.pPpvVvcc', 'pppvvvccc', '.wwwwww..'].map((r) => (u > 4 ? r.replace(/[pP]/g, '.') : r)), { p: 0xf08ab0, P: 0xffc8dc, v: 0xf4f1ea, V: 0xffffff, c: 0x7a4a2a, w: 0xd8a45a });
    hund(c, dx, 60, u, lick);
    if (lick) for (let n = 0; n < 3; n++) { if ((Math.floor(u * 4) + n) % 3 === 0) smallHeart(c, 150 + n * 6, 50 - n * 4, 0xff7a9a); }
  } },
  { d: 6, light: 0xc86a8a, cues: [[2.0, 'aww']], subs: [[1.4, 4.2, 'BÄSTA SOMMAREN NÅGONSIN!']], draw: (c, u) => {
    c.drawImage(bgKvall(), 0, 0);
    fyrverkeri(c, u);
    person(c, 104, 72, L.unge, 'right', 0); strut(c, 108, 50);
    person(c, 132, 72, L.glassfarbror, 'left', Math.floor(u * 2) & 1 ? 4 : 0);
    hund(c, 150, 62, u);
  } },
  { d: 3, light: 0xf0b030, draw: (c, u) => slutskylt(c, u, 'SLUT', '#ffd040', 0x1a1004) },
];

// ----- SISTA NATTBUSSEN (action) -----
function ledText(c, s, x, y, on = '#ffb030', off = '#3a2408') {
  // LED-skylt: varje tänd typsnittspixel blir en lysdiod med en mörk diod bredvid
  ctxText(c, SMALL, s, x + 1, y + 1, off); ctxText(c, SMALL, s, x, y, on);
}
const FILM_NATTBUSS = [
  { d: 3, light: 0x8a6a2a, draw: (c, u) => {
    R(c, 0, 0, FW, FH, 0x06080e);
    R(c, 30, 22, 180, 28, 0x141418); R(c, 32, 24, 176, 24, 0x0a0a08);
    for (let y = 25; y < 47; y += 2) for (let x = 33; x < 207; x += 2) P1(c, x, y, 0x1a1408);
    const s = '4  SISTA NATTBUSSEN', w = textW(SMALL, s), off = Math.round(lerp(176, 0, ease(u / 1.4)));
    c.save(); c.beginPath(); c.rect(32, 24, 176, 24); c.clip();
    ledText(c, s, 120 - (w >> 1) + off, 33);
    c.restore();
    rain(c, u, true);
  } },
  { d: 6, light: 0x3a3a5a, cues: [[4.6, 'grat']], subs: [[2.2, 3.6, 'VÄNTA! VÄNTA PÅ MIG!'], [4.6, 5.9, 'NEEEJ!']], draw: (c, u) => {
    c.drawImage(bgHallplats(), 0, 0);
    let bx; if (u < 1.5) bx = lerp(-120, 118, ease(u / 1.5)); else if (u < 3.6) bx = 118; else bx = 118 + (u - 3.6) * (u - 3.6) * 40;
    const doors = u < 1.5 ? 0 : u < 1.8 ? (u - 1.5) / 0.3 : u < 3.3 ? 1 : Math.max(0, 1 - (u - 3.3) / 0.3);
    buss(c, bx, 28, u, doors);
    const rx = u < 2 ? -20 : lerp(-20, 150, (u - 2) / 2.6);
    person(c, rx, 72, L.springare, u < 4.6 ? 'right' : 'down', u < 4.6 ? [7, 9, 8, 9][Math.floor(u * 13) % 4] : 0);
    if (u < 4.6) pizzakartong(c, rx + 2, 55);
    else pizzakartong(c, rx - 4, 70);
    rain(c, u, true);
  } },
  { d: 6, light: 0x6a5a4a, cues: [[3.0, 'skratt']], subs: [[0.5, 2.2, 'JAG GER INTE UPP!']], draw: (c, u) => {
    scroll(c, bgGataNatt(), u * 90);
    buss(c, 176 + Math.sin(u) * 4, 26, u, 0);                                            // bussen syns där framme
    const jump = u > 1.6 && u < 2.3 ? Math.sin((u - 1.6) / 0.7 * Math.PI) * 10 : 0;
    person(c, 90, 70 - jump, L.springare, 'right', jump ? 8 : [7, 9, 8, 9][Math.floor(u * 14) % 4]);
    pizzakartong(c, 92, 53 - jump);
    const px = 104 - ((u * 90) % 480) + 220;                                             // vattenpölen
    R(c, px, 71, 14, 2, 0x4a5a80); R(c, px + 2, 71, 10, 1, 0x8aa0d0);
    if (u > 1.5 && u < 2.1) for (let k = 0; k < 6; k++) P1(c, 92 + k * 2, 66 - Math.sin(k) * 4, 0x8aa0d0);
    // katten på planket fräser
    const kx = 260 - ((u * 90) % 480) + 60;
    R(c, kx - 10, 52, 26, 2, 0x5a4a3a); for (let i = 0; i < 26; i += 4) R(c, kx - 10 + i, 54, 2, 12, 0x5a4a3a);
    spr(c, kx, 44, ['k...k.', 'kk.kk.', 'kkkkk.', '.kkkkk', '..kkkk', '..k.k.'], { k: 0x141418 }, true);
    if (u > 2.6 && u < 3.8) { P1(c, kx + 1, 46, 0xffe040); P1(c, kx + 3, 46, 0xffe040); outlined(c, SMALL, 'FRÄS!', kx - 2, 34, '#ffffff', '#000000', false); }
  } },
  { d: 6, light: 0x8a7a4a, cues: [[2.4, 'heja']], subs: [[2.2, 4.6, 'HOPPA IN, DU. JAG VÄNTADE.'], [4.8, 5.9, 'TACK!']], draw: (c, u) => {
    c.drawImage(bgHallplats(), 0, 0);
    buss(c, 96, 28, u, 1);
    person(c, 185, 66, L.chauffor, 'left', Math.floor(u * 2) & 1 ? 4 : 0);            // föraren i framdörren
    const rx = u < 2 ? lerp(-20, 160, u / 2) : 160;
    person(c, rx, 72, L.springare, 'right', u < 2 ? [7, 9, 8, 9][Math.floor(u * 12) % 4] : 9);
    pizzakartong(c, rx + 2, 55 - (u > 2 && Math.floor(u * 3) & 1 ? 1 : 0));
    rain(c, u, true);
  } },
  { d: 6, light: 0xd8b060, cues: [[3.0, 'aww']], subs: [[1.0, 4.0, 'PIZZA? DEN ÄR FORTFARANDE VARM!']], draw: (c, u) => {
    c.drawImage(bgBussInne(), 0, 0);
    for (let n = 0; n < 8; n++) { const x = FW - ((u * 120 + n * 37) % (FW + 30)); R(c, x, 12 + (n % 3) * 7, 10 + (n % 4) * 4, 2, [0xf0c068, 0xff9a5a, 0x9ae0ff][n % 3]); }  // stadens ljus
    for (let x = 0; x < FW; x += 40) R(c, x, 8, 3, 28, 0xc8c4b8);
    person(c, 14, 66, L.chauffor, 'right', 5);
    R(c, 20, 40, 8, 8, 0x1a1a1a); R(c, 21, 41, 6, 6, 0x3a3a3a);                         // ratten
    person(c, 58, 66, L.springare, 'left', Math.floor(u * 3) & 1 ? 6 : 5);
    R(c, 44, 48, 9, 3, 0xe8d8b0); R(c, 45, 48, 7, 1, 0xf8ecd0);
    if (u > 2) spr(c, 34, 44 - (u > 3 ? 3 : 0), ['yy.', 'yry', '.y.'], { y: 0xf0c040, r: 0xc8262e });   // pizzabiten
    if (u > 3.2) for (let n = 0; n < 3; n++) smallHeart(c, 36 + n * 8, 26 - ((u - 3.2) * 10 + n * 4) % 12, 0xff8a9a);
  } },
  { d: 3, light: 0x8a6a2a, draw: (c, u) => { R(c, 0, 0, FW, FH, 0x06080e); R(c, 70, 26, 100, 20, 0x0a0a08); ledText(c, 'SLUT', 120 - (textW(SMALL, 'SLUT') >> 1), 33); if (u > 1) { const s = 'BIO PIXEL TACKAR FÖR BESÖKET'; ctxText(c, SMALL, s, cx(SMALL, s), 56, '#8a7a6a'); } } },
];

// ----- AMORE PÅ SÖDER (romantisk komedi) -----
function stol(c, x, y, right) {
  // pinnstol från sidan: ryggen bakom den som sitter
  const bx = right ? x - 6 : x + 5;
  R(c, bx, y - 22, 2, 22, 0x5a3a1a); R(c, bx, y - 22, 2, 1, 0x8a5a2a);
  R(c, Math.min(bx, x) - 1, y - 9, 9, 2, 0x6a4424); R(c, x - 4, y - 7, 1, 7, 0x4a2a14); R(c, x + 4, y - 7, 1, 7, 0x4a2a14);
}
function bord(c, x, y) {
  // bordet med rödvitrutig duk, ljuset och spaghettitallriken
  for (let j = 0; j < 8; j++) for (let i = 0; i < 40; i++) P1(c, x + i, y + j, j === 0 ? 0xf4f1ea : ((i >> 1) + (j >> 1)) & 1 ? 0xc8262e : 0xf4f1ea);
  R(c, x + 2, y + 8, 36, 1, 0x8a1a1a); R(c, x + 18, y + 9, 4, 8, 0x3a2a1a);
}
function ljus(c, x, y, t) {
  R(c, x, y, 3, 6, 0xf4f1ea); R(c, x - 1, y + 6, 5, 1, 0xd8b060);
  const f = Math.floor(t * 9) % 3;
  P1(c, x + 1, y - 1, 0xffd040); P1(c, x + 1, y - 2 - (f & 1), 0xfff0a0); if (f === 2) P1(c, x + 2, y - 2, 0xffa030);
}
const FILM_AMORE = [
  { d: 3, light: 0xc8262e, draw: (c, u) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x += 4) R(c, x, y, 4, 1, ((x >> 3) + (y >> 3)) & 1 ? 0xc8262e : 0xf4f1ea);
    R(c, 40, 16, 160, 42, 0x1a0a08); R(c, 41, 17, 158, 40, 0x2a1210);
    titelskylt2(c, u, [['AMORE', BIG, 24], ['PÅ SÖDER', BIG, 38]], '#ff6a6a', '#1a0404');
    for (let n = 0; n < 4; n++) not(c, 60 + n * 36, 50 - ((u * 14 + n * 9) % 30), n & 1 ? '#6ad07a' : '#fff0b0');
  } },
  { d: 6, light: 0xd8904a, subs: [[2.0, 4.4, 'EN SPAGHETTI FÖR TVÅ, PREGO!']], draw: (c, u) => {
    c.drawImage(bgRestaurang(), 0, 0);
    stol(c, 98, 70, true); stol(c, 142, 70, false);
    person(c, 98, 70, L.sofia, 'right', 5); person(c, 142, 70, L.marco, 'left', 5);
    bord(c, 100, 56); ljus(c, 118, 49, u);
    const wx = u < 2 ? lerp(250, 180, u / 2) : 180;
    person(c, wx, 72, L.servitor, 'left', u < 2 ? walkF(u) : 9);
    R(c, wx - 12, 48, 10, 8, 0x8a1a1a); R(c, wx - 11, 49, 8, 6, 0xf4f1ea); for (let k = 0; k < 4; k++) R(c, wx - 11 + k * 2, 49, 1, 6, 0x2a2a2a);  // dragspelet
    if (u > 1) for (let n = 0; n < 3; n++) not(c, wx - 8 + n * 5, 40 - ((u * 16 + n * 7) % 26), n & 1 ? '#fff0b0' : '#ffd0e0');
  } },
  { d: 6, light: 0xe0a060, cues: [[3.0, 'skratt'], [4.3, 'aww']], draw: (c, u) => {
    c.drawImage(bgRestaurang(), 0, 0);
    const k = ease(clamp((u - 0.6) / 3.6, 0, 1));
    const sx = 100 + k * 10, mx = 140 - k * 10;
    stol(c, sx, 70, true); stol(c, mx, 70, false);
    person(c, sx, 70, L.sofia, 'right', 6); person(c, mx, 70, L.marco, 'left', 6);
    bord(c, 100, 56); ljus(c, 102, 49, u);
    // tallriken och spaghettin – ett enda strå mellan deras munnar som blir kortare
    R(c, 112, 54, 16, 2, 0xf4f1ea); R(c, 114, 53, 12, 1, 0xe8d890);
    for (let i = 0; i < 12; i++) P1(c, 114 + i, 52 - (i % 3 === 0 ? 1 : 0), 0xf0d060);
    P1(c, 119, 51, 0x8a2a1a); P1(c, 120, 51, 0xa83a2a);
    const ax = sx + 5, bx = mx - 5, ay = 38;
    for (let x = Math.round(ax); x <= Math.round(bx); x++) P1(c, x, ay + Math.round(Math.sin((x - ax) / Math.max(1, bx - ax) * Math.PI) * (6 - k * 6)), 0xf0d060);
    if (u > 4.2) { const hk = ease((u - 4.2) / 0.6); smallHeart(c, 118, 26 - hk * 6, 0xff5a7a); }
  } },
  { d: 6, light: 0xc85a5a, cues: [[2.0, 'grat']], subs: [[3.0, 5.6, 'TI AMO!']], draw: (c, u) => {
    c.drawImage(bgRestaurang(), 0, 0);
    stol(c, 110, 70, true); stol(c, 130, 70, false);
    person(c, 110, 70, L.sofia, 'right', 5); person(c, 130, 70, L.marco, 'left', 5);
    bord(c, 100, 56); ljus(c, 102, 49, u);
    const hk = ease(u / 1.6); heart(c, 120, 14 - hk * 4, 2 + hk * 7, 0xe0304a, 0xff7a94, 0xa01830);
    person(c, 190, 72, L.servitor, 'left', Math.floor(u * 4) & 1 ? 4 : 0);
    R(c, 176, 48, 10, 8, 0x8a1a1a); R(c, 177, 49, 8, 6, 0xf4f1ea);
    for (let n = 0; n < 5; n++) not(c, 170 + n * 6, 44 - ((u * 24 + n * 7) % 30), n & 1 ? '#fff0b0' : '#ffd0e0');
  } },
  { d: 6, light: 0x4a4a8a, cues: [[2.0, 'aww']], subs: [[1.5, 4.6, 'SÖDER ÄR VÅRT ITALIEN.']], draw: (c, u) => {
    c.drawImage(bgSoder(), 0, 0);
    const x = lerp(40, 170, u / 6);
    person(c, x, 72, L.sofia, 'right', walkF(u, 7)); person(c, x + 14, 72, L.marco, 'right', walkF(u + 0.2, 7));
    R(c, x + 5, 55, 5, 1, 0xa06a43);                                                     // hand i hand
    for (let n = 0; n < 6; n++) smallHeart(c, x + 2 + (n % 3) * 5, 28 - ((u * 10 + n * 6) % 30), n & 1 ? 0xff7a9a : 0xffc0d0);
  } },
  { d: 3, light: 0xc8262e, draw: (c, u) => slutskylt(c, u, 'FINE', '#ff6a6a', 0x14040a) },
];

// glasskiosken: vagnen framför glassfarbrorn
function glassvagn(c, x, y) {
  R(c, x, y, 40, 14, 0xf4f1ea); R(c, x, y, 40, 1, 0xffffff); R(c, x, y + 13, 40, 1, 0xb8b0a0);
  for (let i = 0; i < 40; i += 5) R(c, x + i, y + 4, 3, 6, 0xf08ab0);
  outlined(c, SMALL, 'GLASS', x + 10, y + 5, '#c8264a', '#ffffff', false);
  for (const wx of [x + 6, x + 32]) { R(c, wx - 3, y + 13, 7, 7, 0x2a2a2a); R(c, wx - 1, y + 15, 3, 3, 0x8a8a8a); }
}
// titelskylt utan egen bakgrund (bakgrunden målas av tagningen)
function titelskylt2(c, u, lines, fill, out) {
  const k = ease(u / 0.8);
  lines.forEach(([s, F, y], i) => outlined(c, F, s, cx(F, s) + Math.round((1 - k) * (i & 1 ? 40 : -40)), y, fill, out));
}
// område direkt på canvasen (fn → färg eller null)
function area2(c, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const col = fn(x + i, y + j, i, j); if (col !== null && col !== undefined) P1(c, x + i, y + j, col); }
}

// ================= programmet =================
// Samma filmer och kvällstider som fasadens ljusskylt; alder = åldersgräns på affischen.
export const FILMER = [
  { id: 'hamnaren', titel: 'PIXELHÄMNAREN 3', typ: 'action', genre: 'ACTION', alder: '11 ÅR', tid: '21:30', blurb: 'Doktor Glitch har stulit stadens pixelkristall. Bara en kan stoppa honom.', shots: FILM_HAMNAREN },
  { id: 'karlek', titel: 'KÄRLEK PÅ PIXELGATAN', typ: 'romkom', genre: 'ROMANTIK', alder: 'BTL', tid: '18:30', blurb: 'Nora och Leo krockar utanför kaféet – och sedan regnar det.', shots: FILM_KARLEK },
  { id: 'turbo', titel: 'TURBOPOLIS', typ: 'action', genre: 'ACTION', alder: '7 ÅR', tid: '19:00', blurb: 'Snabbaste bilen i stan, en polis i hälarna och en ramp över floden.', shots: FILM_TURBO },
  { id: 'sommar', titel: 'SOMMAR I STAN', typ: 'romkom', genre: 'FEELGOOD', alder: 'BTL', tid: '20:00', blurb: 'En glass, en sten, en hund – och den bästa sommaren någonsin.', shots: FILM_SOMMAR },
  { id: 'nattbuss', titel: 'SISTA NATTBUSSEN', typ: 'action', genre: 'SPÄNNING', alder: '11 ÅR', tid: '22:45', blurb: 'En pizza, ett ösregn och linje 4 som går utan dig.', shots: FILM_NATTBUSS },
  { id: 'amore', titel: 'AMORE PÅ SÖDER', typ: 'romkom', genre: 'ROMANTIK', alder: 'BTL', tid: '20:15', blurb: 'En spaghetti för två på Söders mysigaste trattoria.', shots: FILM_AMORE },
];
for (const f of FILMER) {
  f.shots = [VINJETT, ...f.shots];
  f.langd = f.shots.reduce((a, s) => a + s.d, 0);
  f.cues = [];
  let t0 = 0;
  for (const s of f.shots) { for (const [at, kind] of s.cues || []) f.cues.push({ at: t0 + at, kind }); t0 += s.d; }
}
export const filmById = (id) => FILMER.find((f) => f.id === id) || null;

function shotAt(film, t) {
  let u = clamp(t, 0, film.langd - 1e-3);
  for (const s of film.shots) { if (u < s.d) return { s, u }; u -= s.d; }
  const s = film.shots[film.shots.length - 1];
  return { s, u: s.d };
}
// dukens ljus just nu (för publikens ansikten i salongen)
export function filmLight(film, t) { return shotAt(film, t).s.light ?? 0x4a4a6a; }
// reaktionerna mellan t0 och t1 (för salongens publik)
export function filmCues(film, t0, t1) { return film.cues.filter((q) => q.at > t0 && q.at <= t1); }

// Ritar filmen vid tiden t (sekunder från start) med övre vänstra hörnet i (x, y).
export function drawFilm(ctx, film, t, x, y) {
  const { s, u } = shotAt(film, t);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
  s.draw(ctx, u);
  grain(ctx, t);                                                                    // repor och damm – under textremsan
  for (const [a, b, text] of s.subs || []) if (u >= a && u < b) sub(ctx, text);
  // klippen: dithrad svart in och ut
  if (u < 0.25) fade(ctx, 1 - u / 0.25);
  else if (u > s.d - 0.25) fade(ctx, (u - (s.d - 0.25)) / 0.25);
  ctx.restore();
}
// projektorns liv: repor och dammkorn som hoppar förbi
function grain(c, t) {
  const f = Math.floor(t * 12);
  if (hash(f, 1, 190) > 0.8) R(c, Math.floor(hash(f, 2, 190) * FW), 0, 1, FH, 'rgba(255,250,230,.35)');
  for (let k = 0; k < 2; k++) if (hash(f, 3 + k, 190) > 0.6) P1(c, hash(f, 5 + k, 190) * FW, hash(f, 7 + k, 190) * FH, 0x14100c);
}

// ================= affischerna =================
// 26 × 36 (utan ram). Titeln i spelets typsnitt, en egen bild per film.
const POSTER = new Map();
export const POSTER_W = 26, POSTER_H = 36;
export function posterCanvas(id) {
  let cv = POSTER.get(id);
  if (cv) return cv;
  const P = new Pix(POSTER_W, POSTER_H), w = POSTER_W, h = POSTER_H;
  const A = (x, y, c) => P.px(x, y, c);
  const title = (s, y, fill, out) => { const x = (w - textW(SMALL, s)) >> 1; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) text(P, SMALL, s, x + ox, y + oy, out); text(P, SMALL, s, x, y, fill); };
  if (id === 'hamnaren') {
    area(P, 0, 0, w, h, (X, Y) => qmix(0x0a0c1e, 0x2a1030, Y / h, X, Y, 4));
    for (let i = 0; i < w; i++) { const th = 26 + ((hash(i >> 2, 3, 201) * 4) | 0); for (let j = th; j < h; j++) A(i, j, 0x06060c); if ((i & 3) === 1 && hash(i, 4, 201) > 0.4) A(i, th + 2, 0xffd060); }
    for (let r = 0; r < 8; r++) for (let a = 0; a < 20; a++) { const th = a / 20 * 6.283; if (r > 4 && hash(a, r, 202) > 0.5) A(Math.round(13 + Math.cos(th) * r), Math.round(20 + Math.sin(th) * r), 0x3ab8d8); }
    sprP(P, 11, 18, CRYSTAL, { '#': 0x1a8ab0, o: 0xbff8ff });
    for (let j = 12; j <= 30; j++) for (let i = 4; i <= 8; i++) if (j > 14 || i === 6) A(i, j, 0x0c0a10);   // hjältens siluett
    A(5, 13, 0x0c0a10); A(7, 13, 0x0c0a10); A(5, 14, 0x0c0a10); A(6, 14, 0x0c0a10); A(7, 14, 0x0c0a10); A(5, 15, 0x3ae8ff); A(7, 15, 0x3ae8ff);
    title('PIXEL', 2, 0xffd040, 0x3a0a08);
    text(P, BIG, '3', 19, 27, 0x3a0a08); text(P, BIG, '3', 18, 26, 0xe8302a);
  } else if (id === 'karlek') {
    area(P, 0, 0, w, h, (X, Y) => qmix(0xf8b8c8, 0xf8d8a8, Y / h, X, Y, 3));
    heartPix(P, 13, 11, 5);
    for (let j = 22; j < h; j++) for (let i = 0; i < w; i++) if (hash(i >> 2, 0, 203) * 6 + 24 < j) A(i, j, 0xd88a70);
    for (let j = 20; j <= 33; j++) { for (let i = 7; i <= 10; i++) A(i, j, j < 24 ? 0xf6d7bf : 0xf8a0b8); for (let i = 15; i <= 18; i++) A(i, j, j < 24 ? 0xc68a5c : 0x3a7bd5); }
    for (let i = 6; i <= 11; i++) A(i, 19, 0xb7392b); A(6, 20, 0xb7392b); A(6, 21, 0xb7392b); for (let i = 14; i <= 19; i++) A(i, 19, 0x3b2619);
    title('KÄRLEK', 2, 0xfffaf4, 0xa01830);
  } else if (id === 'turbo') {
    area(P, 0, 0, w, h, (X, Y) => qmix(0x14062a, 0x5a1a6a, Y / 24, X, Y, 4));
    for (let j = 24; j < h; j++) for (let i = 0; i < w; i++) A(i, j, (j - 24) % 3 === 0 || Math.abs((i - 13) / Math.max(1, j - 22)) % 1 < 0.15 ? 0xff3ad0 : 0x1a0428);
    const sp = (x, y, c) => A(x, y, c);
    for (let i = 4; i <= 22; i++) sp(i, 24, 0xd8242e); for (let i = 3; i <= 23; i++) { sp(i, 25, 0xd8242e); sp(i, 26, 0xa8141c); }
    for (let i = 8; i <= 16; i++) sp(i, 23, 0xd8242e); sp(10, 23, 0x9ad8f8); sp(11, 23, 0x9ad8f8); sp(14, 23, 0x6aa8d8);
    sp(6, 27, 0x141418); sp(7, 27, 0x141418); sp(19, 27, 0x141418); sp(20, 27, 0x141418); sp(23, 25, 0xfff6b0);
    title('TURBO', 2, 0xffe060, 0x2a0a3a); title('POLIS', 9, 0x3ae8ff, 0x2a0a3a);
  } else if (id === 'sommar') {
    area(P, 0, 0, w, h, (X, Y) => (Y < 22 ? qmix(0x6ab8f0, 0xd0ecff, Y / 22, X, Y, 3) : jit(Y < 26 ? 0x4a9ad8 : 0x5aa84a, X, Y, 204, 0.12)));
    area(P, 14, 12, 11, 11, (X, Y) => (Math.hypot(X - 19, Y - 17) < 5 ? 0xffd040 : null));
    sprP(P, 5, 18, ['.pp.', 'pPpp', '.vv.', 'vVvv', '.cc.', 'cCcc', 'wwww', '.ww.', '.ww.', '..w.', '..w.'], { p: 0xf08ab0, P: 0xffc8dc, v: 0xf4f1ea, V: 0xffffff, c: 0x7a4a2a, C: 0xa86a3a, w: 0xd8a45a });
    title('SOMMAR', 2, 0xfffaf0, 0xc8501a); title('I STAN', 9, 0xffd040, 0x8a3a0a);
  } else if (id === 'nattbuss') {
    area(P, 0, 0, w, h, (X, Y) => qmix(0x06080e, 0x1a2040, Y / h, X, Y, 4));
    for (let k = 0; k < 18; k++) A(Math.floor(hash(k, 1, 205) * w), Math.floor(hash(k, 2, 205) * h), 0x6a7ab0);
    area(P, 3, 22, 20, 10, (X, Y, i, j) => (j === 9 ? 0x141418 : j < 1 ? 0xe85a5a : (i % 4 === 1 && j > 1 && j < 5) ? 0xf8d890 : 0xc8262e));
    A(5, 32, 0x141418); A(6, 32, 0x141418); A(18, 32, 0x141418); A(19, 32, 0x141418);
    title('SISTA', 2, 0xffb030, 0x2a1404); title('NATT-', 9, 0xffb030, 0x2a1404); title('BUSSEN', 15, 0xffb030, 0x2a1404);
  } else {
    // AMORE: solnedgång, hjärta och paret – samma motiv som fasadens montrar
    area(P, 0, 0, w, h, (X, Y, i, j) => (j < 12 ? qmix(0xf8a0b8, 0xf8c4a0, j / 12, X, Y, 3) : qmix(0xf8c4a0, 0xe89060, (j - 12) / 24, X, Y, 3)));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = Math.hypot(i + 0.5 - 13, (j + 0.5 - 28) * 1.1); if (d < 9) A(i, j, d < 7 ? 0xfff0b0 : 0xffe0a0); }
    heartPix(P, 13, 11, 4);
    for (let j = 22; j <= 35; j++) { for (let i = 14; i <= 17; i++) A(i, j, j < 26 ? 0xf2cca6 : 0xe85a7a); for (let i = 7; i <= 10; i++) A(i, j, j < 26 ? 0xd8a47c : 0x3a6ab0); }
    for (let j = 21; j <= 28; j++) { A(17, j, 0xa8401a); A(18, j, 0x8a3014); } for (let i = 6; i <= 10; i++) A(i, 21, 0x4a2a1a);
    title('AMORE', 2, 0xfffaf4, 0xa01830);
  }
  // glansen över trycket
  for (let d = 0; d < 10; d++) P.px(4 + d, 22 - d, WHITE, 0.14);
  cv = P.flush();
  POSTER.set(id, cv);
  return cv;
}
function heartPix(P, hx, hy, s) {
  for (let j = 0; j <= Math.ceil(2.3 * s); j++) for (let i = -Math.ceil(1.25 * s); i <= Math.ceil(1.25 * s); i++) {
    const u = i / s, v = 1.2 - (j + 0.5) / s, f = (u * u + v * v - 1) ** 3 - u * u * v * v * v;
    if (f > 0) continue;
    P.px(hx + i, hy + j, f > -0.03 ? 0xa01830 : (j < s * 0.7 && i < 0) ? 0xff7a94 : 0xe0304a);
  }
}
