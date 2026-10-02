// LANDET – djuren och traktorn (js/scenes/landet.js). Sprites målas pixel för pixel med mörk kontur
// och cachas per sort/färg/riktning/bildruta. Fötterna/marken vid (x, y) som drawPerson.
//   drawKo(ctx, x, y, dir, frame, flack)     frame: 0 står, 1/2 går, 3 betar (huvudet nere)
//   drawFar(ctx, x, y, dir, frame)            fluffigt får (svart huvud)
//   drawHast(ctx, x, y, dir, frame, farg)     häst (fux/svart/skimmel/brun), frame 1/2 trav, 3 betar
//   drawHona(ctx, x, y, dir, frame)           höna som pickar
//   drawTraktor(ctx, x, y, dir, t, rullar)    grön traktor med plog, avgaser när den kör
//   drawTrad(ctx, x, y, sort, t)              lövträd/gran (kronan gungar lite i vinden)
import { Pix, mix, mul, hash } from '../core/floor-pix.js';

const CACHE = new Map();
function outline(P, W, H) {
  const out = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (P.d[(y * W + x) * 4 + 3]) { out.px(x, y, P.get(x, y)); continue; }
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && P.d[(yy * W + xx) * 4 + 3]; })) out.px(x, y, 0x1e1a24);
  }
  return out.flush();
}
function mirror(cv) { const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height; const c = m.getContext('2d'); c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0); return m; }
function sprite(key, W, H, paint, dir) {
  const k = `${key}|${dir === 'left' ? 'L' : 'R'}`;
  if (CACHE.has(k)) return CACHE.get(k);
  let cv;
  if (dir === 'left') cv = mirror(sprite(key, W, H, paint, 'right'));
  else { const P = new Pix(W, H); paint(P); cv = outline(P, W, H); }
  CACHE.set(k, cv);
  return cv;
}
const shadow = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2); };
// ben: fyra ben som byter steg (frame 1/2)
function legs(P, xs, y0, len, frame, c, hov) {
  xs.forEach((x, i) => { const lift = frame === 1 ? (i % 2 ? 1 : 0) : frame === 2 ? (i % 2 ? 0 : 1) : 0; P.rect(x, y0, 2, len - lift, c); P.rect(x, y0 + len - lift - 1, 2, 1, hov); });
}

// ---------------------------------------------------------------- kossan (åt höger; 26×20, marken på rad 19)
export function drawKo(ctx, x, y, dir = 'right', frame = 0, flack = 0) {
  const s = sprite(`ko${frame}${flack}`, 28, 21, (P) => {
    const brun = flack === 2, body = brun ? 0x8a5a32 : 0xf4f1ea, spot = brun ? 0x6a4224 : 0x1e1a1c, lo = brun ? 0x6a4224 : 0xc8c4bc;
    legs(P, [5, 8, 17, 20], 13, 6, frame, lo, 0x2a2420);
    for (let j = 0; j < 9; j++) for (let i = 0; i < 18; i++) { const r = Math.hypot((i - 9) / 9.5, (j - 4.5) / 5); if (r < 1) P.px(4 + i, 5 + j, j > 6 ? lo : body); }
    if (!brun) for (const [sx, sy, r] of [[8, 7, 2.5], [15, 9, 3], [19, 6, 1.8]].map(([a, b, c]) => [a + (flack ? 2 : 0), b, c])) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i, j * 1.2) < r) P.px(sx + i, sy + j, spot);
    P.rect(10, 13, 4, 2, 0xf0a8b0);                           // juvret
    // huvudet (nere när den betar)
    const hy = frame === 3 ? 12 : 4, hx = 21;
    P.rect(hx, hy, 6, 6, body); P.rect(hx + 3, hy + 3, 4, 4, 0xf0b8b8); P.px(hx + 5, hy + 4, 0x6a3a3a); P.px(hx + 2, hy + 1, 0x1e1a1c);
    P.px(hx + 1, hy - 1, 0xe8e0c8); P.px(hx + 4, hy - 1, 0xe8e0c8);   // hornen
    P.px(hx - 1, hy + 1, brun ? 0x6a4224 : 0xd8d0c0);              // örat
    P.vl(3, 6, 6, lo); P.px(2, 11, 0x1e1a1c); P.px(2, 12, 0x1e1a1c);  // svansen med tofs
  }, dir);
  shadow(ctx, x, y, 22);
  ctx.drawImage(s, Math.round(x - 14), Math.round(y - 20));
}
// ---------------------------------------------------------------- fåret (16×13)
export function drawFar(ctx, x, y, dir = 'right', frame = 0) {
  const s = sprite(`far${frame}`, 17, 14, (P) => {
    legs(P, [4, 6, 10, 12], 9, 4, frame, 0x2a2420, 0x1a1414);
    for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) { const r = Math.hypot((i - 6) / 6.5, (j - 3.5) / 4); if (r < 1) P.px(2 + i, 2 + j, (i + j) % 3 ? 0xf0ece0 : 0xd8d2c4); }
    for (let k = 0; k < 8; k++) P.px(3 + ((k * 5) % 11), 2 + ((k * 3) % 6), 0xffffff);
    const hy = frame === 3 ? 7 : 3;
    P.rect(12, hy, 4, 4, 0x2a2420); P.px(15, hy + 3, 0x1a1414); P.px(13, hy + 1, 0xf4f1ea); P.px(12, hy - 1, 0x2a2420);
  }, dir);
  shadow(ctx, x, y, 12);
  ctx.drawImage(s, Math.round(x - 8), Math.round(y - 13));
}
// ---------------------------------------------------------------- hästen (32×26)
export const HASTFARG = { fux: [0xb8642a, 0x8a4a1e, 0xe8c070], svart: [0x2a2226, 0x1a1418, 0x4a3a3e], skimmel: [0xe8e4dc, 0xb8b4ac, 0x9a968e], brun: [0x6a3e22, 0x4a2a16, 0x2a1a10] };
export function drawHast(ctx, x, y, dir = 'right', frame = 0, farg = 'fux') {
  const [base, lo, man] = HASTFARG[farg] || HASTFARG.fux;
  const s = sprite(`hast${frame}${farg}`, 32, 27, (P) => {
    legs(P, [6, 9, 19, 22], 15, 9, frame, lo, 0x2a2420);
    for (let j = 0; j < 10; j++) for (let i = 0; i < 20; i++) { const r = Math.hypot((i - 10) / 10.5, (j - 5) / 5.4); if (r < 1) P.px(5 + i, 6 + j, j < 3 ? mix(base, 0xffffff, 0.15) : j > 7 ? lo : base); }
    // halsen och huvudet (sänkt när den betar)
    const down = frame === 3;
    for (let k = 0; k < 9; k++) P.rect(21 + Math.round(k * 0.5), (down ? 9 + k : 8 - k), 5, 3, base);
    const hx = down ? 25 : 24, hy = down ? 17 : -1;
    P.rect(hx, hy + 1, 5, 4, base); P.rect(hx + 3, hy + 3, 4, 4, base); P.px(hx + 6, hy + 5, 0x1e1a1c); P.px(hx + 2, hy + 2, 0x1e1a1c);
    P.px(hx + 1, hy, base); P.px(hx + 1, hy - 1, lo);                            // örat
    for (let k = 0; k < 8; k++) P.px(21 + Math.round(k * 0.5) - 1, (down ? 9 + k : 8 - k), man);   // manen
    for (let k = 0; k < 9; k++) P.px(4 - (k > 4 ? 1 : 0), 7 + k, man);           // svansen
    if (farg === 'skimmel') for (let k = 0; k < 14; k++) P.px(6 + ((k * 7) % 18), 7 + ((k * 3) % 8), 0x8a867e);
  }, dir);
  shadow(ctx, x, y, 26);
  ctx.drawImage(s, Math.round(x - 16), Math.round(y - 26));
}
// ---------------------------------------------------------------- hönan (8×8)
export function drawHona(ctx, x, y, dir = 'right', frame = 0) {
  const s = sprite(`hona${frame}`, 9, 9, (P) => {
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if (Math.hypot((i - 3) / 3.2, (j - 2) / 2.2) < 1) P.px(1 + i, 3 + j, j < 1 ? 0xf4f1ea : 0xd8c8a8);
    P.px(0, 3, 0xd8c8a8); P.px(0, 2, 0xf4f1ea);
    const hy = frame === 3 ? 4 : 1;
    P.rect(6, hy, 2, 3, 0xf4f1ea); P.px(8, hy + 1, 0xf0a020); P.px(6, hy - 1, 0xd8202a); P.px(7, hy + 1, 0x1e1a1c);
    P.px(3, 7, 0xf0a020); P.px(5, 7, 0xf0a020);
  }, dir);
  ctx.drawImage(s, Math.round(x - 4), Math.round(y - 8));
}
// ---------------------------------------------------------------- traktorn (44×32) med plog
export function drawTraktor(ctx, x, y, dir = 'right', t = 0, rullar = false) {
  const ph = rullar ? Math.floor(t * 8) % 2 : 0;
  const s = sprite(`traktor${ph}`, 46, 32, (P) => {
    // plogen bakom (vänster när den kör åt höger)
    P.rect(1, 22, 9, 4, 0x6a6a72); for (let k = 0; k < 3; k++) P.line(2 + k * 3, 26, 1 + k * 3, 29, 0x8a8e96); P.rect(8, 21, 4, 2, 0x3a3a3e);
    // stora bakhjulet och lilla framhjulet (ekrar som snurrar)
    for (const [cx, cy, r] of [[18, 22, 8], [37, 26, 4.5]]) for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) {
      const d = Math.hypot(i, j); if (d > r) continue;
      P.px(cx + i, cy + j, d > r - 2.2 ? (((Math.atan2(j, i) * 4 / Math.PI + ph) | 0) % 2 ? 0x1a1a1e : 0x2e2e34) : d > r - 3.2 ? 0xd8b030 : 0xf0c840);
    }
    // karossen: grön motorhuv, hytt med rutor, avgasröret
    P.rect(22, 15, 18, 8, 0x3a8a2a); P.hl(22, 15, 18, 0x6ac04a); P.rect(38, 17, 3, 5, 0x2a6a1e); P.px(40, 19, 0xffe9a0);
    P.rect(12, 3, 13, 14, 0x2a6a1e); P.rect(14, 5, 9, 8, 0x8ac8e8); P.hl(14, 5, 9, 0xc8e8f8); P.rect(11, 2, 15, 2, 0x1e4a16);
    P.rect(30, 7, 2, 8, 0x4a4a52); P.rect(29, 6, 4, 1, 0x2a2a2e);
    P.rect(14, 9, 3, 3, 0xe8b890);   // föraren
  }, dir);
  shadow(ctx, x, y, 40);
  ctx.drawImage(s, Math.round(x - 23), Math.round(y - 31));
}
// ---------------------------------------------------------------- träden
export function drawTrad(ctx, x, y, sort = 'lov', t = 0) {
  const s = sprite(`trad${sort}`, 34, 48, (P) => {
    if (sort === 'gran') {
      P.rect(16, 40, 3, 7, 0x5a3a1e);
      for (let j = 0; j < 40; j++) { const half = 2 + Math.round((j % 9) * 0.9 + j * 0.28); for (let i = -half; i <= half; i++) P.px(17 + i, 2 + j, i < -half * 0.3 ? 0x3a7a3a : (hash(i, j, 5) > 0.7 ? 0x1e4a26 : 0x2a5e2e)); }
    } else {
      P.rect(15, 28, 5, 19, 0x6a4424); P.vl(15, 28, 19, 0x8a5a30);
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const d = Math.hypot((i - 16) / 15, (j - 15) / 14) + (hash(i >> 1, j >> 1, 6) - 0.5) * 0.25; if (d < 1) P.px(1 + i, j, d > 0.82 ? 0x2e6a26 : (i + j < 26 ? 0x6ab84a : hash(i, j, 7) > 0.5 ? 0x4a9a3a : 0x3e8a32)); }
    }
  }, 'right');
  ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(Math.round(x - 12), Math.round(y - 2), 24, 4);
  ctx.drawImage(s, Math.round(x - 17 + Math.sin(t * 0.8 + x) * 0.5), Math.round(y - 47));
}
