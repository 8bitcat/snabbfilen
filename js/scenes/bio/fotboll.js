// FOTBOLLSFILMERNA på BIO PIXEL (Carl 2026-10-01): två filmer om Kungsladugårds (KBK) flicklag.
//   KUNGSLADUGÅRD – EN STILLSAM BÖRJAN: träningen och lilla cupen – Näset, Hovås/Billdal,
//     Sandarna (väldigt stort) och finalen mot Älvsborg.
//   KUNGSLADUGÅRD – UT I VÄRLDEN: Champions League – Häcken, Manchester United, Juventus och
//     finalen mot Barcelona (damlagen – det är tjejer som spelar, åt båda hållen).
// Julia, Märta, Nina, Ellen och Alice G gör och passar målen; Lily står i mål och räddar en straff
// i finalen; resten av laget spelar med. Utseendet (hår, hy) är Carls beskrivning 2026-10-01.
// Barnen har BARA förnamn (Carls beslut 2026-09-28). Motståndarlagen i lilla cupen är också
// flicklag – deras spelare får inga namn. Damlagens mål görs av riktiga spelare (namn i texten).
// Inga klubbmärken, sponsorer eller loggor: lagen syns med namn och sina färger.
//
// Skotten i matcherna går i "anime": bilden fryser, skytten i närbild med fartlinjer och en stor
// blixt – SKOTTTTT! – sen slow motion när bollen flyger med eldsvans (se superskott/warp).
//
// Samma format som de andra filmerna (film.js): tagningar på 240 × 80 spelpixlar, spelets figurer
// (drawPerson) och pixeltypsnitt. Tagningar med music: 'traning' spelar träningslåten
// (filmmusik.js – en egen 80-talsrock, CC0, eftersom spelet bara har fria ljud).
//
// Planen ritas snett från sidan: ett djup d (0 = närmaste långsidan) flyttar en punkt 0,3 px åt
// höger och 1 px uppåt per rad – målet till höger blir ett parallellogram med nät bakom.
import { Pix, SMALL, BIG, textW, ctxText, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { drawPerson } from '../../core/people.js';
import { $t, $n } from '../../core/i18n.js';

const FW = 240, FH = 80, WHITE = 0xffffff;
const WALK = [1, 3, 2, 3];
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const R = (c, x, y, w, h, col) => { c.fillStyle = typeof col === 'number' ? css(col) : col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const P1 = (c, x, y, col) => R(c, x, y, 1, 1, col);
const walkF = (t, sp = 8.5) => WALK[Math.floor(t * sp) % 4];
const person = (c, x, y, look, dir = 'down', frame = 0) => drawPerson(c, Math.round(x), Math.round(y), look, dir, frame);

// ---------- målarverktyg (samma recept som i resten av spelet) ----------
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(clamp(t, 0, 1) * steps + bayer(x, y)) / steps;
  return mix(a, b, clamp(q, 0, 1));
}
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(x + i, y + j, i, j); if (c !== null && c !== undefined) P.px(x + i, y + j, c); }
}
function spr(c, x, y, rows, pal, flip = false) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) { const r = rows[j], n = r.length; for (let i = 0; i < n; i++) { const col = pal[r[i]]; if (col !== undefined) P1(c, x + (flip ? n - 1 - i : i), y + j, col); } }
}
function outlined(c, F, s, x, y, fill, out = '#000000', scale = 1) {
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) ctxText(c, F, s, x + ox, y + oy, out, scale);
  ctxText(c, F, s, x, y, fill, scale);
}
const cx = (F, s, scale = 1) => Math.round((FW - textW(F, s, scale)) / 2);
const BG = new Map();
function bg(key, paint) {
  let cv = BG.get(key);
  if (!cv) { const P = new Pix(FW, FH); paint(P); cv = P.flush(); BG.set(key, cv); }
  return cv;
}

// ================= laget =================
// KBK:s matchställ: vinröd fotbollströja med ljusare röda kanter, svarta shorts
const kbk = (o) => ({ kid: true, build: 4, top: 'football', shirt: '#7a1e2e', accent: '#e0505a', bottom: 'shorts', pants: '#1c1c1c', eyes: 'lashes', ...o });
const KBK = {
  julia: kbk({ skin: '#eec3a0', hair: '#d9a95c', style: 'wavy', shoes: '#d8f040', shirtNum: 34 }),          // blond, vågigt
  marta: kbk({ skin: '#f6d7bf', hair: '#e4c878', style: 'veryLong', shoes: '#f05aa0', shirtNum: 10 }),      // långt blont
  nina: kbk({ skin: '#d39a6c', hair: '#1d1714', style: 'long', shoes: '#f2f2f2', shirtNum: 8 }),            // svart hår, ljusbrun hy
  ellen: kbk({ skin: '#e0a97f', hair: '#2a1a12', style: 'longPony', shoes: '#1c1c1c', shirtNum: 19 }),     // svart/mörkbrunt, solbränd
  aliceG: kbk({ skin: '#eec3a0', hair: '#c49a5a', style: 'bun', shoes: '#3a6bc2' }),                       // mellanblont, uppsatt (numret: 7 eller 9 – Carl säger vilket)
  lily: kbk({ shirt: '#2aa35a', accent: '#1c1c1c', skin: '#f6d7bf', hair: '#ecd489', style: 'long', shoes: '#1c1c1c', shirtNum: 20 }),   // målvakten: långt blont
};
const NAMN = { julia: $t('JULIA'), marta: $t('MÄRTA'), nina: $t('NINA'), ellen: $t('ELLEN'), aliceG: $t('ALICE G'), lily: $t('LILY') };
// resten av laget (spelar med, namnen bara i eftertexterna)
const RESTEN = [$t('KLARA'), $t('SAGA'), $t('VALENCIA'), $t('ALICE'), $t('ISABELLE'), $t('ELISA'), $t('NATALIA'), $t('KAJSA'), $t('MOA'), $t('ISABELLA'), $t('EDESSA'), $t('JULIE'), $t('NOOMI')];
const SKINS = ['#f6d7bf', '#eec3a0', '#e0a97f', '#c68a5c', '#a06a43', '#744a2d', '#553522'];
const HAIRS = ['#1d1714', '#3b2619', '#6b4226', '#a5692f', '#d9a95c', '#ecd489', '#b7392b'];
// tjejfrisyrer (långt, svansar, knutar, flätor) – inga korta "pojkfrillor" i filmerna
const STYLES = ['ponytail', 'long', 'highPony', 'bun', 'longPony', 'braids', 'wavy', 'lowPony', 'frenchBraid', 'messyBun', 'sleek', 'pigtails', 'curlyPony', 'afroPuff', 'boxBraids'];
const SHOES = ['#d8f040', '#f05aa0', '#1c1c1c', '#f2f2f2', '#3a6bc2', '#8edc4c'];
const MATES = Array.from({ length: 9 }, (_, i) => kbk({ skin: SKINS[(i * 3 + 1) % SKINS.length], hair: HAIRS[(i * 5 + 2) % HAIRS.length], style: STYLES[(i * 4 + 1) % STYLES.length], shoes: SHOES[(i * 2 + 1) % SHOES.length] }));
const KBK_KEEPER = KBK.lily;
const TRANAREN = { skin: '#e0a97f', hair: '#3b2619', style: 'short', top: 'hoodie', shirt: '#7a1e2e', accent: '#f4f1ea', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', hat: 'cap', cap: '#7a1e2e', build: 5 };

// motståndarna (flicklag i lilla cupen, damlagen i Champions League)
const LAG = {
  naset: { namn: $t('NÄSET'), kort: $t('NÄSET'), shirt: '#2f8f46', accent: '#f4f1ea', pants: '#f4f1ea', kid: true },
  hovas: { namn: $t('HOVÅS/BILLDAL'), kort: $t('HOVÅS'), shirt: '#3a7bd5', accent: '#f0c03a', pants: '#2d3a5c', kid: true },
  sandarna: { namn: $t('SANDARNA'), kort: $t('SANDARNA'), shirt: '#f0c03a', accent: '#1c1c1c', pants: '#1c1c1c', kid: true },
  alvsborg: { namn: $t('ÄLVSBORG'), kort: $t('ÄLVSBORG'), shirt: '#f4f1ea', accent: '#2c6fb7', pants: '#2c6fb7', kid: true },
  hacken: { namn: $t('HÄCKEN'), kort: $t('HÄCKEN'), shirt: '#f6d02a', accent: '#1c1c1c', pants: '#1c1c1c', kid: false },
  united: { namn: $t('MANCHESTER UNITED'), kort: $t('MAN UTD'), shirt: '#d0202a', accent: '#f4f1ea', pants: '#f4f1ea', kid: false },
  juventus: { namn: $t('JUVENTUS'), kort: $t('JUVENTUS'), top: 'stripes', shirt: '#1c1c1c', accent: '#f4f1ea', pants: '#f4f1ea', kid: false },
  barca: { namn: $t('BARCELONA'), kort: $t('BARCELONA'), top: 'stripes', shirt: '#a50044', accent: '#1f4fa0', pants: '#1f4fa0', kid: false },
};
// damspelarna: samma tjejfrisyrer men det som håller på en elitplan (svansar, knutar, flätor)
const VSTYLES = ['ponytail', 'highPony', 'bun', 'longPony', 'lowPony', 'frenchBraid', 'messyBun', 'sleek', 'boxBraids', 'afroPuff'];
for (const [k, T] of Object.entries(LAG)) {
  const seed = k.length * 7;
  const look = (i, keeper) => ({
    kid: T.kid, build: T.kid ? 4 : 4 + (i % 2), top: keeper ? 'football' : T.top || 'football', eyes: 'lashes',
    shirt: keeper ? '#f08a2a' : T.shirt, accent: keeper ? '#1c1c1c' : T.accent, bottom: 'shorts', pants: keeper ? '#1c1c1c' : T.pants,
    skin: SKINS[(i * 3 + seed) % SKINS.length], hair: HAIRS[(i * 2 + seed) % HAIRS.length],
    style: keeper ? 'highPony' : T.kid ? STYLES[(i * 2 + seed) % STYLES.length] : VSTYLES[(i + seed) % VSTYLES.length], shoes: SHOES[(i + seed) % SHOES.length],
  });
  T.p = Array.from({ length: 5 }, (_, i) => look(i, false));
  T.keeper = look(9, true);
}

// ================= bollen, målet, poängtavlan =================
const BALL = [['.ooo.', 'oWWko', 'oWkWo', 'okWwo', '.ooo.'], ['.ooo.', 'okWWo', 'oWWko', 'oWkwo', '.ooo.']];
const BALL_PAL = { o: 0x2a2630, W: 0xf6f6f2, w: 0xc8c8d0, k: 0x2a2630 };
// (x, y) = punkten på marken, z = höjden över den
function ball(c, x, y, z = 0, t = 0) {
  x = Math.round(x); y = Math.round(y);
  const s = z > 12 ? 1 : z > 4 ? 2 : 3;
  R(c, x - s, y, s * 2 + 1, 1, 'rgba(20,12,30,.35)');
  spr(c, x - 2, y - 4 - Math.round(z), BALL[Math.floor(t * 12) & 1], BALL_PAL);
}
// målet till höger: främre stolpen (222, 74→54), bakre (234, 56→36); nätet bakom
const GM = { fx: 222, fy: 74, h: 20, dx: 12, dy: -18 };
// bulge = 0..1 (nätet buktar ut runt (bx, by) när bollen går in)
function goal(c, bulge = 0, bx = 228, by = 58, night = false) {
  const { fx, fy, h } = GM, slope = GM.dy / GM.dx;
  const mesh = night ? 0xc8d0e0 : 0xf2f2f0;
  for (let x = fx + 1; x < FW; x++) {
    const top = Math.round(fy - h + slope * (x - fx)), bot = Math.round(fy + slope * (x - fx));
    for (let y = top; y <= bot; y++) {
      const d = Math.hypot(x - bx, y - by), push = bulge > 0 && d < 9 ? Math.round(bulge * (9 - d) / 3) : 0;
      const X = x - push;
      if ((X + y) % 3 === 0 || (X - y) % 3 === 0) R(c, x, y, 1, 1, `rgba(${mesh >> 16 & 255},${mesh >> 8 & 255},${mesh & 255},${x > fx + 14 ? 0.35 : 0.6})`);
    }
  }
  // stolparna och ribban (vita med skuggsida)
  const bx2 = fx + GM.dx, by2 = fy + GM.dy;
  R(c, bx2, by2 - h, 1, h + 1, 0xd8d8dc);
  for (let k = 0; k <= GM.dx; k++) { const y = Math.round(fy - h + slope * k); R(c, fx + k, y, 1, 2, k & 1 ? 0xf6f6f2 : 0xe2e2e6); }
  R(c, fx, fy - h, 2, h + 1, 0xf6f6f2); R(c, fx + 1, fy - h, 1, h + 1, 0xc8c8d0);
  R(c, fx - 1, fy + 1, 4, 1, 'rgba(20,12,30,.3)');
}
function scoreboard(c, a, b, na, nb, clock, flash = false, late = false) {
  const s = `${na} ${a}-${b} ${nb}`, w = textW(SMALL, s) + (clock ? textW(SMALL, clock) + 7 : 0) + 8;
  R(c, 3, 3, w, 10, 0x14121a); R(c, 3, 3, w, 1, 0xe8b230); R(c, 3, 12, w, 1, 0x0a080e);
  ctxText(c, SMALL, s, 7, 6, flash ? '#ffd23f' : '#f4f1ea');
  if (clock) { const x = 7 + textW(SMALL, s) + 5; R(c, x - 3, 4, 1, 8, 0x3a3540); ctxText(c, SMALL, clock, x, 6, late ? '#ff6a6a' : '#9ad8f8'); }
}
const clockStr = (min) => `${String(Math.floor(min)).padStart(2, '0')}:${String(Math.floor((min % 1) * 60)).padStart(2, '0')}`;
// "MÅL!" i stor guldtext som studsar in
function malText(c, k, text = $t('MÅL!')) {
  if (k <= 0 || k >= 1) return;
  const s = 2, bounce = Math.round(Math.sin(Math.min(1, k * 4) * Math.PI) * -4);
  const flash = Math.floor(k * 14) & 1;
  outlined(c, BIG, text, cx(BIG, text, s), 16 + bounce, flash ? '#fff6c8' : '#ffd23f', '#5a1a08', s);
}
// banderollen när en match börjar
function matchBanner(c, u, rubrik, rad2) {
  if (u > 2.2) return;
  const k = ease(Math.min(u / 0.3, (2.2 - u) / 0.3));
  const w = Math.max(textW(SMALL, rubrik), textW(SMALL, rad2)) + 16, x = Math.round(FW - (w + 4) * k);
  R(c, x, 52, w, 21, 0x14121a); R(c, x, 52, w, 1, 0xe8b230); R(c, x, 52, 2, 21, 0x7a1e2e);
  ctxText(c, SMALL, rubrik, x + 8, 56, '#e8b230'); ctxText(c, SMALL, rad2, x + 8, 64, '#f4f1ea');
}

// ================= bakgrunderna =================
// gräset med klippta ränder, plus linjerna (mittlinjen, straffområdet vid målet)
function grass(P, y0, night, turf = false) {
  const A = night ? 0x2f7a34 : turf ? 0x3aa046 : 0x4aa83e, B = night ? 0x276a2e : turf ? 0x339340 : 0x3f9636;
  area(P, 0, y0, FW, FH - y0, (X, Y) => {
    const band = Math.floor((X + (FH - Y) * 0.3) / 16) & 1;
    let c = band ? A : B;
    c = jit(c, X, Y, 31, turf ? 0.05 : 0.08);
    if (hash(X, Y, 32) > 0.965) c = mix(c, 0xb8e070, night ? 0.15 : 0.35);
    if (turf && hash(X >> 1, Y, 33) > 0.97) c = mix(c, 0x1a1a1a, 0.4);                  // gummikorn i konstgräset
    return mix(c, 0x10183a, (1 - (Y - y0) / (FH - y0)) * (night ? 0.18 : 0.08));
  });
  const L = night ? 0xd8dce4 : 0xf4f4ee;
  const line = (x, y) => P.px(Math.round(x), y, L, 0.85);
  for (let x = 0; x < FW; x++) { line(x, y0 + 1); line(x, FH - 3); }
  for (let y = y0 + 1; y < FH - 2; y++) line(96 + (FH - 3 - y) * 0.3, y);                 // mittlinjen
  for (let y = y0 + 7; y <= FH - 9; y++) line(178 + (FH - 3 - y) * 0.3, y);                // straffområdet
  for (let x = 178 + (FH - 3 - (y0 + 7)) * 0.3; x < FW; x++) line(x, y0 + 7);
  for (let x = 178; x < FW; x++) line(x, FH - 9);
  P.px(204 + 6, 64, L); P.px(205 + 6, 64, L);                                              // straffpunkten
  for (let a = 0; a < 80; a++) { const th = a / 80 * Math.PI * 2, my = (y0 + FH) / 2 - 2; P.px(Math.round(96 + (FH - 3 - my) * 0.3 + Math.cos(th) * 18), Math.round(my + Math.sin(th) * 7), L, 0.6); }   // mittcirkeln
}
function sky(P, y1, top, bot, stars = false) {
  area(P, 0, 0, FW, y1, (X, Y) => {
    const c = qmix(top, bot, Y / y1, X, Y, 5);
    return stars && hash(X, Y, 41) > 0.985 ? (hash(X, Y, 42) > 0.5 ? 0xfff6d8 : 0xb8c8f0) : c;
  });
}
function treeline(P, y, dark, mid, light, seed) {
  for (let x = -6; x < FW + 6; x += 9) {
    const r = 7 + Math.round(hash(x, 1, seed) * 5), cy = y - r + 3;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const d = Math.hypot(i / r, j / (r * 0.85));
      if (d > 1 || (d > 0.75 && hash(x + i, cy + j, seed) > 0.55)) continue;
      const l = (-i / r - j / r) * 0.45 + (hash(x + i, cy + j, seed + 1) - 0.5) * 0.9;
      P.px(x + i, cy + j, l > 0.35 ? light : l > -0.25 ? mid : dark);
    }
  }
}
// läktare med publik (publiken ritas live – den hoppar vid mål)
function standPaint(P, y0, y1, night, big = false) {
  area(P, 0, y0, FW, y1 - y0, (X, Y) => {
    const row = Math.floor((Y - y0) / 4), ry = (Y - y0) % 4;
    let c = night ? 0x2a2634 : 0x5a5662;
    if (ry === 3) c = night ? 0x1a1822 : 0x3e3a46;
    else if (ry === 0) c = mix(c, WHITE, 0.08);
    if (big && row % 6 === 5) c = night ? 0x3a2030 : 0x7a1e2e;                           // läktarens mittband
    return jit(c, X, Y, 51 + row, 0.06);
  });
}
// reklamskyltarna längs planen (egna texter – inga riktiga sponsorer)
function boards(P, y, texts, night) {
  let x = 0, i = 0;
  while (x < FW) {
    const s = texts[i % texts.length], w = textW(SMALL, s) + 10;
    const col = [0x7a1e2e, 0x14121a, 0x2c6fb7, 0xe8b230][i % 4];
    area(P, x, y, w, 7, (X, Y, a, b) => (b === 0 ? mix(col, WHITE, 0.3) : b === 6 ? mul(col, 0.6) : a === w - 1 ? 0x0a080e : night ? mul(col, 0.85) : col));
    drawSmallP(P, s, x + 5, y + 1, col === 0xe8b230 ? 0x14121a : 0xf4f1ea);
    x += w; i++;
  }
}
function drawSmallP(P, s, x, y, col) {
  // samma som floor-pix text(), lokalt för att slippa importera Pix-hjälpen
  let cxp = x;
  for (const ch of String(s).toUpperCase()) {
    const G = SMALL[ch] || SMALL['?'];
    const rows = [...G.up, ...G.rows], y0 = y - G.up.length;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(cxp + i, y0 + j, col); });
    cxp += G.w + 1;
  }
}
function mast(P, x, top, base) {                                                          // strålkastarmast
  for (let y = top; y < base; y++) { P.px(x, y, 0x3a3a44); P.px(x + 1, y, 0x5a5a66); }
  area(P, x - 5, top - 6, 12, 6, (X, Y, i, j) => (j === 5 ? 0x2a2a34 : (i % 3 === 1 && j > 0 && j < 5) ? 0xfff6d0 : 0x4a4a56));
  P.ell(x + 1, top - 3, 14, 10, 0xfff6d0, 0.18, 4);
}
const BGS = {
  // konstgräs i gryningen: trädrad, staket, KBK:s klubbstuga
  morgon: () => bg('morgon', (P) => {
    sky(P, 36, 0xf0a060, 0xffe0a0);
    area(P, 150, 6, 18, 18, (X, Y) => (Math.hypot(X - 158, Y - 18) < 8 ? (Y < 16 ? 0xfff6c0 : 0xffe080) : null));
    treeline(P, 30, 0x2a4a2a, 0x3e6a34, 0x6a9a4a, 61);
    area(P, 20, 18, 34, 14, (X, Y, i, j) => (j < 3 ? (j === 0 ? 0x9a2a2a : 0x7a1e1e) : i === 0 || i === 33 ? 0x5a3a2a : (i > 13 && i < 20 && j > 5) ? 0x3a2a1e : (i % 8 === 3 && j > 4 && j < 9) ? 0xf0d890 : jit(0xb8442a, X, Y, 62, 0.08)));
    drawSmallP(P, $t('KBK'), 28, 6 + 15 - 1, 0xf4f1ea);
    for (let x = 0; x < FW; x++) for (let y = 28; y < 36; y++) if ((x + y) % 4 === 0 || (x - y) % 4 === 0) P.px(x, y, 0x8a9aa0, 0.55);
    grass(P, 36, false, true);
  }),
  // kvällsträning i regn under strålkastarna
  kvall: () => bg('kvall', (P) => {
    sky(P, 36, 0x0e1230, 0x2a3060, false);
    treeline(P, 32, 0x0e1a14, 0x14261c, 0x1e3626, 63);
    mast(P, 30, 10, 36); mast(P, 206, 10, 36);
    for (let x = 0; x < FW; x++) for (let y = 28; y < 36; y++) if ((x + y) % 4 === 0 || (x - y) % 4 === 0) P.px(x, y, 0x5a6a80, 0.5);
    grass(P, 36, true, true);
  }),
  // lilla cupen: liten läktare med tak, reklamskyltar
  cup: () => bg('cup', (P) => {
    sky(P, 30, 0x5aa8e8, 0xc8e8f8);
    treeline(P, 22, 0x2a4a2a, 0x3e6a34, 0x6a9a4a, 64);
    area(P, 30, 10, 180, 3, (X, Y, i, j) => (j === 2 ? 0x2a2a34 : 0x6a6a76));         // taket
    for (const x of [32, 120, 207]) area(P, x, 13, 2, 16, () => 0x3a3a44);
    standPaint(P, 13, 29, false);
    boards(P, 29, [$t('LILLA CUPEN'), $t('HEJA KBK'), $t('FOTBOLL ÄR KUL'), $t('KBK')], false);
    grass(P, 36, false);
  }),
  // finalen: kväll, strålkastare, större läktare
  final: () => bg('final', (P) => {
    sky(P, 30, 0x0a0e26, 0x2a2a58, true);
    standPaint(P, 8, 29, true);
    mast(P, 14, 6, 26); mast(P, 222, 6, 26);
    boards(P, 29, [$t('FINAL'), $t('LILLA CUPEN'), $t('HEJA KBK'), $t('KBK')], true);
    grass(P, 36, true);
  }),
  // Champions League: en jättearena i tre ringar, flaggor, kvällshimmel
  varld: () => bg('varld', (P) => {
    sky(P, 12, 0x0a0820, 0x1e1a40, true);
    standPaint(P, 4, 29, true, true);
    for (let k = 0; k < 9; k++) {                                                          // flaggor på taket
      const x = 8 + k * 28, col = [0x7a1e2e, 0xe8b230, 0x2c6fb7, 0xf4f1ea, 0x2f8f46][k % 5];
      P.vl(x, 0, 8, 0x8a8a94); area(P, x + 1, 0, 7, 4, (X, Y, i, j) => (j === 3 ? mul(col, 0.7) : col));
    }
    mast(P, 6, 4, 12); mast(P, 230, 4, 12);
    boards(P, 29, [$t('CHAMPIONS LEAGUE'), $t('UT I VÄRLDEN'), $t('HEJA KBK'), $t('FINAL')], true);
    grass(P, 36, true);
  }),
  // stadionläktaren man springer uppför (träningslägret)
  trappa: () => bg('trappa', (P) => {
    sky(P, 14, 0x5aa8e8, 0xc8e8f8);
    area(P, 0, 6, FW, FH - 6, (X, Y) => {
      const step = Math.floor((Y - 6) / 5), ry = (Y - 6) % 5, seat = Math.floor((X + step * 3) / 6) % 4 === 0;
      let c = ry === 4 ? 0x5a5662 : ry === 0 ? 0xb8b4c0 : 0x8a8694;
      if (seat && ry > 0 && ry < 3) c = [0x7a1e2e, 0xc9323a, 0x7a1e2e, 0xe0505a][step % 4];
      return jit(c, X, Y, 71, 0.05);
    });
    area(P, 108, 6, 18, FH - 6, (X, Y) => { const ry = (Y - 6) % 5; return jit(ry === 4 ? 0x4a4650 : ry === 0 ? 0xd8d4dc : 0xa8a4b0, X, Y, 72, 0.05); });   // trappan
  }),
};

// ================= publiken =================
const CROWD = new Map();
function crowdFor(key, y0, y1, n, tint) {
  let L = CROWD.get(key);
  if (!L) {
    L = [];
    for (let i = 0; i < n; i++) {
      const x = Math.floor(hash(i, 1, 81) * (FW - 4)) + 2, row = Math.floor(hash(i, 2, 81) * ((y1 - y0) / 4));
      const y = y0 + row * 4 + 3;
      const sh = hash(i, 3, 81) < tint ? [0x7a1e2e, 0xe0505a][i & 1] : [0x3a7bd5, 0xf0b429, 0x46a35a, 0xe8e3d6, 0x8e5bd1, 0x2b2b30][i % 6];
      L.push({ x, y, sk: [0xf6d7bf, 0xeec3a0, 0xe0a97f, 0xc68a5c, 0x744a2d][i % 5], ha: [0x1d1714, 0x6b4226, 0xd9a95c, 0xb9b3ab, 0x3b2619][(i * 3) % 5], sh, ph: hash(i, 4, 81) * 6 });
    }
    L.sort((a, b) => a.y - b.y);
    CROWD.set(key, L);
  }
  return L;
}
// cheer 0..1: hur mycket publiken hoppar och viftar
function crowd(c, key, y0, y1, n, t, cheer = 0, tint = 0.5) {
  for (const p of crowdFor(key, y0, y1, n, tint)) {
    const jump = cheer > 0 && Math.sin(t * 14 + p.ph) > 0.2 - cheer ? 1 : 0;
    const y = p.y - jump;
    R(c, p.x, y - 3, 2, 1, p.ha); R(c, p.x, y - 2, 2, 1, p.sk); R(c, p.x, y - 1, 2, 2, p.sh);
    if (jump && cheer > 0.4) { P1(c, p.x - 1, y - 4, p.sk); P1(c, p.x + 2, y - 4, p.sk); }      // armarna i luften
  }
}

// ================= anfallet (ett mål) =================
// Spelar upp ett anfall i en tagning: passningsläggaren dribblar fram, passar (längs marken eller
// inlägg), målskytten skjuter eller nickar in bollen förbi målvakten, nätet buktar och laget firar.
//   o = { passer, scorer, mates: [looks], opp: LAG, keeper, t0, tPass, tShot, tGoal, kind: 'skott'|'nick', night, y }
// Tider i sekunder inom tagningen. Ritar allt i "anfall åt höger"-läge – motståndarnas mål
// speglas av anroparen.
function anfall(c, u, o) {
  const t = u - (o.t0 || 0);
  const { tPass, tShot, tGoal } = o;
  const nick = o.kind === 'nick';
  // passningsläggaren
  const pa0 = [o.from?.[0] ?? 62, o.from?.[1] ?? (nick ? 72 : 66)], pa1 = [nick ? 168 : 146, nick ? 72 : 66];
  const pk = clamp(t / tPass, 0, 1), pax = lerp(pa0[0], pa1[0], pk), pay = lerp(pa0[1], pa1[1], pk);
  // målskytten
  const sc0 = [118, nick ? 54 : 56], sc1 = [nick ? 196 : 176, nick ? 60 : 58];
  const scAt = (tt) => { const k = ease(clamp(tt / (tPass + 0.45), 0, 1)); return [lerp(sc0[0], sc1[0], k), lerp(sc0[1], sc1[1], k)]; };
  const sk = clamp(t / (tPass + 0.45), 0, 1), [scx, scy] = scAt(t);
  // bollen vid tiden tt: [x, y] på marken och höjden z (en funktion – eldsvansen läser bakåt i tiden)
  const ballAt = (tt) => {
    const [sx0, sy0] = scAt(tt);
    if (tt < tPass) { const k = clamp(tt / tPass, 0, 1); return [lerp(pa0[0], pa1[0], k) + 5 + Math.round(Math.sin(tt * 18)), lerp(pa0[1], pa1[1], k), 0]; }
    if (tt < tShot) {
      const k = clamp((tt - tPass) / (tShot - tPass), 0, 1);
      if (!nick && k >= 1) return [sx0 + 4, sy0, 0];
      return [lerp(pa1[0] + 5, sx0 + 3, k), lerp(pa1[1], sy0, k), nick ? Math.sin(k * Math.PI) * 16 + k * 14 : 0];
    }
    if (tt < tGoal) {
      const k = clamp((tt - tShot) / (tGoal - tShot), 0, 1), sx = sx0 + (nick ? 1 : 5), sz = nick ? 14 : 1;
      return [lerp(sx, 228, k), lerp(sy0, 64, k), lerp(sz, nick ? 6 : 7, k) + Math.sin(k * Math.PI) * (nick ? 2 : 4)];
    }
    const k = clamp((tt - tGoal) / 0.5, 0, 1);
    return [231 + k * 2, 63, Math.max(0, 7 - k * 9)];
  };
  const [bx, by, bz] = ballAt(t);
  const scored = t >= tGoal;
  // målvakten: står på linjen, kastar sig när skottet går
  const kp = o.keeper, kx0 = 212, ky0 = 66;
  // försvararna jagar bollen med eftersläpning
  const opp = o.opp.p;
  const df = [[lerp(150, Math.min(bx - 10, 190), clamp(t / 3, 0, 1)), 60], [lerp(170, Math.min(bx + 6, 200), clamp(t / 3.4, 0, 1)), 70], [lerp(80, 128, clamp(t / 4, 0, 1)), 52]];
  // medspelarna springer med i anfallet
  const mates = o.mates || [];
  const mp = mates.map((_, i) => [lerp(40 + i * 18, 120 + i * 22, clamp(t / 4, 0, 1)), [50, 62, 74][i % 3]]);
  // firandet: målskytten springer mot kameran och hoppar, laget kommer dit
  const cel = scored ? clamp((t - tGoal) / 2.4, 0, 1) : 0;
  const cx0 = scx, cy0 = scy, cxe = scx - 30, cye = 76;
  const scorerPos = scored ? [lerp(cx0, cxe, ease(cel)), lerp(cy0, cye, ease(cel))] : [scx, scy];
  const jumpY = scored && cel >= 1 ? Math.abs(Math.sin(t * 9)) * 5 : 0;
  // allt som står på planen, sorterat efter djup
  const L = [];
  const add = (y, fn) => L.push({ y, fn });
  add(ky0, () => {
    if (t >= tShot + 0.1) {
      const k = clamp((t - tShot - 0.1) / 0.4, 0, 1);
      const x = lerp(kx0, 216, k), y = lerp(ky0, ky0 - 4, k), lift = Math.sin(k * Math.PI) * 6;
      c.save(); c.translate(Math.round(x), Math.round(y - lift)); c.rotate(-Math.PI / 2); drawPerson(c, 0, 0, kp, 'right', 0); c.restore();
    } else person(c, kx0, ky0, kp, 'left', Math.sin(t * 3) > 0.9 ? 4 : 0);
  });
  df.forEach(([x, y], i) => add(y, () => person(c, x, y, opp[i], 'right', scored ? 0 : walkF(t + i * 0.3, 10))));
  mp.forEach(([x, y], i) => add(y, () => {
    if (scored) { const k = ease(clamp((t - tGoal - 0.3) / 1.6, 0, 1)); person(c, lerp(x, scorerPos[0] - 12 + i * 8, k), lerp(y, scorerPos[1] - 4 + (i & 1) * 6, k), mates[i], k < 1 ? 'right' : 'down', k < 1 ? walkF(t, 11) : (Math.sin(t * 8 + i) > 0 ? 4 : 0)); }
    else person(c, x, y, mates[i], 'right', walkF(t + i * 0.2, 10));
  }));
  add(pay, () => {
    if (scored) { const k = ease(clamp((t - tGoal - 0.2) / 1.8, 0, 1)); person(c, lerp(pa1[0], scorerPos[0] + 10, k), lerp(pa1[1], scorerPos[1] + 2, k), o.passer, k < 1 ? 'right' : 'down', k < 1 ? walkF(t, 11) : 4); }
    else person(c, pax, pay, o.passer, 'right', t < tPass ? walkF(t, 11) : t < tPass + 0.25 ? 2 : 0);
  });
  add(scorerPos[1], () => {
    const kick = !nick && t >= tShot - 0.05 && t < tShot + 0.25;
    const head = nick && t >= tShot - 0.35 && t < tShot + 0.15;
    const lift = head ? Math.sin(clamp((t - tShot + 0.35) / 0.5, 0, 1) * Math.PI) * 7 : 0;
    if (scored) person(c, scorerPos[0], scorerPos[1] - jumpY, o.scorer, cel < 1 ? 'left' : 'down', cel < 1 ? walkF(t, 12) : (jumpY > 2 ? 4 : 9));
    else person(c, scorerPos[0], scorerPos[1] - lift, o.scorer, 'right', kick ? 2 : head ? 4 : sk < 1 ? walkF(t, 11) : 0);
  });
  add(by, () => {
    if (o.trail && t >= tShot && t < tGoal + 0.12) svans(c, ballAt, t, tShot, o.trail);
    if (bx < 245) ball(c, bx, by, bz, t);
  });
  L.sort((a, b) => a.y - b.y);
  // målet ritas efter bakre spelare men före de närmaste (ungefärligt: före allt med y > 70)
  const netK = scored ? clamp(1 - (t - tGoal) / 0.7, 0, 1) : 0;
  let goalDrawn = false;
  for (const d of L) { if (!goalDrawn && d.y > 66) { goal(c, netK, 230, 57, o.night); goalDrawn = true; } d.fn(); }
  if (!goalDrawn) goal(c, netK, 230, 57, o.night);
  return { scored, cel, tGoal };
}
// kör anfallet speglat (motståndarna anfaller åt vänster)
function speglat(c, fn) { c.save(); c.translate(FW, 0); c.scale(-1, 1); fn(); c.restore(); }

// ================= anime-effekterna =================
// Eldsvansen (KBK) eller issvansen (motståndarna) bakom bollen: skivor som krymper och svalnar
// bakåt i tiden, plus gnistor. at(tt) = bollens [x, y, z] vid tiden tt.
const SVANS = { eld: [0xfff6c8, 0xffd23f, 0xff8a2a, 0xe0301a], is: [0xffffff, 0xbfefff, 0x6ad0ff, 0x2a6ad8] };
function svans(c, at, t, t0, kind) {
  const C = SVANS[kind] || SVANS.eld;
  for (let k = 10; k >= 1; k--) {
    const tt = t - k * 0.02;
    if (tt < t0) continue;
    const [x, y, z] = at(tt), cy = y - 2 - z, r = 3.2 - k * 0.26, col = C[Math.min(3, k >> 1)];
    c.globalAlpha = Math.min(1, 1.15 - k / 10);
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r) P1(c, x + i, cy + j, col);
    if (hash(k, Math.floor(t * 30), 141) > 0.55) P1(c, x + Math.round((hash(k, 2, Math.floor(t * 30)) - 0.5) * 8), cy + Math.round((hash(k, 3, Math.floor(t * 30)) - 0.5) * 7), C[0]);
  }
  c.globalAlpha = 1;
}
// Fokuslinjerna och blixtarna byts bara 14–20 gånger i sekunden – de ritas pixel för pixel en gång
// till en egen duk och återanvänds mellan bildrutorna (en liten iPhone hinner annars inte med).
const MEMO = new Map();
function memo(key, draw) {
  let cv = MEMO.get(key);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
    draw(cv.getContext('2d'));
    MEMO.set(key, cv);
    if (MEMO.size > 24) MEMO.delete(MEMO.keys().next().value);
  }
  return cv;
}
// fokuslinjer (manga): vita kilar från kanten in mot (cx0, cy0) – nya varje 1/20 s. Pixel för
// pixel, så kanterna blir skarpa.
function fokus(c, cx0, cy0, t, col, n = 34, r0 = 30, seed = 151) {
  const f = Math.floor(t * 20);
  c.drawImage(memo(`f${Math.round(cx0)},${cy0},${f},${col},${n},${r0},${seed}`, (x) => fokusPix(x, Math.round(cx0), cy0, f, col, n, r0, seed)), 0, 0);
}
function fokusPix(c, cx0, cy0, f, col, n, r0, seed) {
  const W = [], O = [];
  for (let i = 0; i < n; i++) { W.push(0.05 + hash(i, f, seed) * 0.16); O.push(hash(i, f + 7, seed) * 0.6); }
  c.fillStyle = css(col);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const dx = x - cx0, dy = (y - cy0) * 2.4, r = Math.hypot(dx, dy);
    if (r < r0) continue;
    const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) * n, i = Math.floor(a) % n, fr = a - Math.floor(a);
    const w = W[i] * Math.min(1, (r - r0) / 70);
    if (Math.abs(fr - 0.5 - (O[i] - 0.3) * 0.5) < w) c.fillRect(x, y, 1, 1);
  }
}
// en taggig blixt/explosion (rx × ry) i tre lager: orange kant, gul, vit kärna
function smack(c, cx0, cy0, rx, ry, f, outer = 0xff7a1a, mid = 0xffe14a, core = 0xfff6d8, spikes = 14) {
  if (rx < 2) return;
  rx = Math.round(rx); ry = Math.round(ry);
  c.drawImage(memo(`s${cx0},${cy0},${rx},${ry},${f},${outer},${mid},${core},${spikes}`, (x) => smackPix(x, cx0, cy0, rx, ry, f, outer, mid, core, spikes)), 0, 0);
}
function smackPix(c, cx0, cy0, rx, ry, f, outer, mid, core, spikes) {
  const S = []; for (let i = 0; i < spikes * 2; i++) S.push(i & 1 ? 0.55 + hash(i, f, 161) * 0.15 : 0.92 + hash(i, f, 162) * 0.18);
  const cs = [css(outer), css(mid), css(core)];
  let last = -1;
  for (let y = Math.floor(cy0 - ry * 1.1); y <= cy0 + ry * 1.1; y++) for (let x = Math.floor(cx0 - rx * 1.1); x <= cx0 + rx * 1.1; x++) {
    const dx = (x - cx0) / rx, dy = (y - cy0) / ry, d = Math.hypot(dx, dy);
    if (d > 1.3) continue;
    const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) * spikes * 2, i = Math.floor(a) % (spikes * 2), fr = a - Math.floor(a);
    const lim = lerp(S[i], S[(i + 1) % (spikes * 2)], fr);
    if (d > lim) continue;
    const k = d > lim - 0.14 ? 0 : d > lim * 0.55 ? 1 : 2;
    if (k !== last) { c.fillStyle = cs[k]; last = k; }
    c.fillRect(x, y, 1, 1);
  }
}
// en blixt (sicksack) från (x0, y0) mot (x1, y1), två pixlar bred
function bolt(c, x0, y0, x1, y1, f, seed) {
  let px = x0, py = y0;
  for (let s = 1; s <= 6; s++) {
    const k = s / 6, nx = lerp(x0, x1, k) + (s < 6 ? (hash(s, f, seed) - 0.5) * 10 : 0), ny = lerp(y0, y1, k) + (s < 6 ? (hash(s, f + 1, seed) - 0.5) * 6 : 0);
    const n = Math.max(Math.abs(nx - px), Math.abs(ny - py));
    for (let q = 0; q <= n; q++) { const x = lerp(px, nx, q / n), y = lerp(py, ny, q / n); P1(c, x, y, WHITE); P1(c, x + 1, y, 0xffe14a); }
    px = nx; py = ny;
  }
}
// en stor boll (dubbel storlek) med glöd – i närbilderna
function storBoll(c, x, y, t, glow) {
  const f = Math.floor(t * 12);
  for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) { const d = Math.hypot(i, j); if (d > 5.5 && d < 7 && (f + i + j) % 3) P1(c, x + i, y + j, glow); }
  const rows = BALL[f & 1];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const col = BALL_PAL[rows[j][i]]; if (col !== undefined) R(c, x - 5 + i * 2, y - 5 + j * 2, 2, 2, col); }
}
// en figur som enfärgad siluett (aura och efterbilder) – cachad per utseende/riktning/ruta/färg
const SIL = new Map();
function siluett(look, dir, frame, col) {
  const key = JSON.stringify([look.style, look.hair, look.skin, look.shirt, dir, frame, col]);
  let cv = SIL.get(key);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = 24; cv.height = 42;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    drawPerson(x, 12, 39, look, dir, frame);
    const im = x.getImageData(0, 0, 24, 42);                                                  // skuggan är halvgenomskinlig – bort med den
    for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] < 128 ? 0 : 255;
    x.putImageData(im, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = css(col); x.fillRect(0, 0, 24, 42);
    SIL.set(key, cv);
  }
  return cv;
}
// en stjärnglimt (fyra uddar) – ögonen som glimmar, handskarna
function glimt(c, x, y, r = 3, col = WHITE) {
  P1(c, x, y, col);
  for (let k = 1; k <= r; k++) { const a = k === r ? mix(col, 0xffe14a, 0.5) : col; P1(c, x + k, y, a); P1(c, x - k, y, a); P1(c, x, y + k, a); P1(c, x, y - k, a); }
}
// NÄRBILDEN när någon skjuter: skytten i dubbel storlek mot fokuslinjer, en stor blixt med texten
// som växer (SKOTT → SKOTTTTTT!), vitt blixtljus in och ut. k = 0..1 genom närbilden.
//   side 'kbk' = rött och guld, 'opp' = kallt blått · right = skytten vänd åt höger (in från vänster)
function narbild(c, k, t, look, kind, side, right = side !== 'opp') {
  const kb = side !== 'opp', nick = kind === 'nick', sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;                                                         // dubbel storlek – skarpa pixlar
  c.drawImage(memo(`bg${kb}`, (x) => { for (let y = 0; y < FH; y++) { x.fillStyle = css(qmix(kb ? 0x2a0610 : 0x081028, kb ? 0x9a2434 : 0x24407a, 1 - Math.abs(y - 46) / 46, 0, y, 6)); x.fillRect(0, y, FW, 1); } }), 0, 0);
  const px = right ? 60 : FW - 60, slide = Math.round((1 - ease(k / 0.18)) * (right ? -90 : 90));
  fokus(c, px + slide, 40, t, kb ? 0xffd8a0 : 0xc8e8ff);
  // auran: guldkant runt skytten (siluetten förskjuten åt alla håll)
  const dir = right ? 'right' : 'left', fr = nick ? 4 : 2, sil = siluett(look, dir, fr, kb ? 0xffd23f : 0x8ad8ff);
  if (k > 0.15) for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) if ((Math.floor(t * 20) + ox + oy) & 1 || k > 0.5) c.drawImage(sil, 0, 0, 24, 42, px + slide - 24 + ox, 0 + oy, 48, 84);
  c.save(); c.translate(px + slide, 78); c.scale(2, 2); drawPerson(c, 0, 0, look, dir, fr); c.restore();
  // bollen i närbild
  storBoll(c, px + slide + (right ? 1 : -1) * (nick ? 12 : 24), nick ? 16 : 70, t, kb ? 0xffd23f : 0x8ad8ff);
  // ögonen glimmar
  if (k > 0.28 && k < 0.5) glimt(c, px + slide + (right ? 5 : -5), 33, 2 + (Math.floor(t * 16) & 1));
  // blixten med texten
  const pop = ease(clamp((k - 0.14) / 0.12, 0, 1));
  if (pop > 0) {
    const tx = right ? 168 : 72, f = Math.floor(t * 14), p8 = Math.round(pop * 8) / 8;
    const n = Math.min(5, Math.floor((k - 0.14) * 9));
    c.drawImage(memo(`b${right}${kb}${nick}${f},${n},${p8}`, (x) => {                       // blixtarna, explosionen och texten
      for (let b = 0; b < 3; b++) bolt(x, tx + (b - 1) * 30, 0, tx + (b - 1) * 18 + (hash(b, f, 171) - 0.5) * 20, 30, f, 172 + b);
      smack(x, tx, 38, 66 * p8, 30 * p8, f, kb ? 0xff6a1a : 0x2a8ad8, kb ? 0xffe14a : 0xbfefff);
      const s = nick ? $t`NI${'I'.repeat(1 + n)}CK!` : $t`SKOTT${'T'.repeat(n)}!`;
      const jx = Math.round((hash(1, f, 173) - 0.5) * 3), jy = Math.round((hash(2, f, 173) - 0.5) * 3);
      const sx = Math.round(tx - textW(BIG, s, 2) / 2) + jx;
      ctxText(x, BIG, s, sx + 2, 30 + jy + 2, kb ? '#5a0a10' : '#08142a', 2);
      outlined(x, BIG, s, sx, 30 + jy, kb ? '#ffffff' : '#f4fbff', kb ? '#5a0a10' : '#08142a', 2);
    }), 0, 0);
  }
  // snedställda svarta kanter (mangaruta)
  c.fillStyle = '#08060a';
  for (let x = 0; x < FW; x++) { const a = Math.round(2 + (right ? x : FW - x) / FW * 6); c.fillRect(x, 0, 1, a); c.fillRect(x, FH - (10 - a), 1, 10 - a); }
  // blixtljus in och ut
  const fl = k < 0.08 ? 1 - k / 0.08 : k > 0.9 ? (k - 0.9) / 0.1 : 0;
  if (fl > 0) { c.fillStyle = `rgba(255,255,255,${fl.toFixed(2)})`; c.fillRect(0, 0, FW, FH); }
  c.imageSmoothingEnabled = sm;
}
// fartstreck över hela bilden när bollen flyger i slow motion (dir 1 = åt höger)
function fartstreck(c, t, dir = 1) {
  const f = Math.floor(t * 24);
  c.fillStyle = 'rgba(255,255,255,.35)';
  for (let k = 0; k < 14; k++) {
    const y = 26 + Math.floor(hash(k, f, 181) * 52), w = 18 + Math.floor(hash(k, f + 1, 181) * 40), x = Math.floor(hash(k, f + 2, 181) * (FW + w)) - w;
    c.fillRect(x, y, w, 1);
  }
  c.fillStyle = 'rgba(8,6,10,.18)'; c.fillRect(0, 0, FW, 4); c.fillRect(0, FH - 4, FW, 4);
}
// Tidsförvrängningen för ett mål: handlingstiden fryser medan närbilden visas (CUT s) och går i
// slow motion (SLOW) medan bollen flyger. a(u) = handlingstiden vid filmtiden u, real(a) = när en
// handlingstid syns på duken, extra = hur mycket längre tagningen blir.
const CUT = 0.9, SLOW = 0.35;
function warp(G) {
  const c0 = G.t0 + G.tShot - 0.04, F = G.t0 + G.tGoal - c0, fl = F / SLOW, extra = CUT + fl - F;
  return {
    c0, extra, flyStart: c0 + CUT, flyEnd: c0 + CUT + fl,
    a: (u) => (u < c0 ? u : u < c0 + CUT ? c0 : u < c0 + CUT + fl ? c0 + (u - c0 - CUT) * SLOW : u - extra),
    real: (a) => (a < c0 ? a : a < c0 + F ? c0 + CUT + (a - c0) / SLOW : a + extra),
  };
}

// ================= matcherna =================
// Ett mål i en tagning med poängtavla, klocka, MÅL!-text och publik.
//   m = { opp, bg, crowd: [key, y0, y1, n], ha, hb (ställningen före), mins: [från, till], goal: { at, by: 'kbk'|'opp', ... } }
// Skottet går i anime (se warp): närbild på skytten, sen slow motion med eldsvans, skakning och
// vitt blixtljus när bollen går i nät. Tiderna i m (goal, d) är handlingstid – tagningens
// tider (d, subs, cues) skjuts fram av animeTider() när filmen byggs.
function matchShot(m) {
  const G = m.goal, W = warp(G), kb = G.by === 'kbk';
  const fn = (c, u) => {
    // närbilden: skytten, fartlinjerna och SKOTTTTT!
    if (u >= W.c0 && u < W.flyStart) { narbild(c, (u - W.c0) / CUT, u, G.scorer, G.kind, G.by); return; }
    const a = W.a(u), gt = G.t0 + G.tGoal, ug = W.real(gt), scored = a >= gt;
    const shake = scored && u - ug < 0.4;
    if (shake) { R(c, 0, 0, FW, FH, 0x08060a); c.save(); c.translate(Math.round(Math.sin(u * 95) * 2), Math.round(Math.cos(u * 77) * 1.4)); }
    c.drawImage(BGS[m.bg](), 0, 0);
    const cheerK = scored && kb ? clamp(1 - (u - ug) / 3, 0.3, 1) : m.cheerBase || 0.1;
    if (m.crowd) crowd(c, m.crowd[0], m.crowd[1], m.crowd[2], m.crowd[3], u, cheerK, m.crowd[4] ?? 0.5);
    const o = { ...G, opp: kb ? m.opp : { p: [KBK.julia, KBK.nina, MATES[2]] }, keeper: kb ? m.opp.keeper : KBK_KEEPER, night: m.night, trail: kb ? 'eld' : 'is' };
    if (kb) anfall(c, a, o);
    else speglat(c, () => anfall(c, a, { ...o, mates: m.opp.p.slice(2, 4) }));
    if (shake) c.restore();
    if (u >= W.flyStart && u < W.flyEnd) fartstreck(c, u, kb ? 1 : -1);
    // ljus från strålkastarna
    if (m.night) { c.fillStyle = 'rgba(255,246,208,.05)'; c.fillRect(0, 30, FW, 50); }
    if (scored && u - ug < 0.14) { c.fillStyle = `rgba(255,255,255,${(0.75 * (1 - (u - ug) / 0.14)).toFixed(2)})`; c.fillRect(0, 0, FW, FH); }
    const ha = m.ha + (scored && kb ? 1 : 0), hb = m.hb + (scored && !kb ? 1 : 0);
    const min = lerp(m.mins[0], m.mins[1], a / m.d);
    scoreboard(c, ha, hb, $t('KBK'), m.opp.kort, clockStr(min), scored && u - ug < 2 && Math.floor(u * 8) & 1, m.late && min > m.late);
    if (scored && kb) malText(c, (u - ug) / 1.8);
    if (scored && !kb) { const k = (u - ug) / 1.8; if (k > 0 && k < 1) outlined(c, BIG, `${m.opp.kort}...`, cx(BIG, `${m.opp.kort}...`), 18, '#d8d8e0', '#2a2a34'); }
    if (m.banner) matchBanner(c, u, m.banner[0], m.banner[1]);
    if (m.after) m.after(c, u, scored);
  };
  fn.match = m; fn.warp = W;                                                              // (ljudsättningen och animeTider läser tiderna)
  return fn;
}
const SHOT = (by, scorer, passer, kind, extra = {}) => ({ by, scorer, passer, kind, t0: 0, tPass: 2.4, tShot: 3.1, tGoal: 3.45, mates: [MATES[0], MATES[3]], ...extra });

// Storsegern: mål på mål i snabb följd, ställningen räknas upp
function storseger(opp, total, names, bgKey, cr) {
  const fn = (c, u) => {
    c.drawImage(BGS[bgKey](), 0, 0);
    const per = 6.6 / total, i = Math.min(total - 1, Math.floor(u / per)), t = u - i * per;
    crowd(c, cr[0], cr[1], cr[2], cr[3], u, 0.9);
    const who = names[i % names.length], pass = names[(i + 2) % names.length];
    anfall(c, t, { scorer: KBK[who], passer: KBK[pass], mates: [MATES[i % 9]], opp, keeper: opp.keeper, kind: i % 3 === 2 ? 'nick' : 'skott', t0: 0, tPass: per * 0.3, tShot: per * 0.48, tGoal: per * 0.62, from: [120, 66], trail: 'eld' });
    const scored = t >= per * 0.62, n = i + (scored ? 1 : 0);
    scoreboard(c, n, 0, $t('KBK'), opp.kort, clockStr(lerp(5, 58, u / 7)), scored && Math.floor(u * 8) & 1);
    if (scored) { const s = `${NAMN[who]}!`; outlined(c, BIG, s, cx(BIG, s), 18, '#ffd23f', '#5a1a08'); }
  };
  fn.storseger = { total, per: 6.6 / total };
  return fn;
}

// ================= straffen: Lily räddar =================
// Närbilden på målvakten: Lily i dubbel storlek med guldaura som pulserar, ögonen glimmar och
// namnet i en grön-guld blixt. k = 0..1.
function narbildLily(c, k, t, look) {
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(memo('bgLily', (x) => { for (let y = 0; y < FH; y++) { x.fillStyle = css(qmix(0x06200e, 0x1e7a3a, 1 - Math.abs(y - 46) / 46, 0, y, 6)); x.fillRect(0, y, FW, 1); } }), 0, 0);
  const px = FW - 64, slide = Math.round((1 - ease(k / 0.18)) * 90);
  fokus(c, px + slide, 40, t, 0xfff0a0, 30, 34, 191);
  const fr = k > 0.45 ? 4 : 0, sil = siluett(look, 'left', fr, 0xffd23f), f = Math.floor(t * 20);
  const glow = 2 + (f & 1);
  for (const [ox, oy] of [[-glow, 0], [glow, 0], [0, -glow], [0, glow], [-2, -2], [2, -2]]) c.drawImage(sil, 0, 0, 24, 42, px + slide - 24 + ox, oy, 48, 84);
  c.save(); c.translate(px + slide, 78); c.scale(2, 2); drawPerson(c, 0, 0, look, 'left', fr); c.restore();
  // gnistor i auran
  for (let n = 0; n < 8; n++) { const a = hash(n, f, 192) * Math.PI * 2, r = 22 + hash(n, f + 1, 192) * 12; glimt(c, px + slide + Math.cos(a) * r, 40 + Math.sin(a) * r * 0.9, 1 + (n & 1), n & 2 ? 0xffe14a : WHITE); }
  if (k > 0.3 && k < 0.55) glimt(c, px + slide - 5, 33, 3);
  const pop = ease(clamp((k - 0.14) / 0.12, 0, 1));
  if (pop > 0) {
    const tx = 82, f14 = Math.floor(t * 14), p8 = Math.round(pop * 8) / 8;
    c.drawImage(memo(`lily${f14},${p8}`, (x) => {                                             // explosionen och namnet
      smack(x, tx, 38, 56 * p8, 28 * p8, f14, 0x2aa35a, 0xffe14a, 0xfff6d8);
      const s = $t('LILY!'), sx = Math.round(tx - textW(BIG, s, 2) / 2) + Math.round((hash(1, f14, 193) - 0.5) * 3);
      ctxText(x, BIG, s, sx + 2, 32, '#06200e', 2);
      outlined(x, BIG, s, sx, 30, '#ffffff', '#06200e', 2);
    }), 0, 0);
  }
  c.fillStyle = '#08060a';
  for (let x = 0; x < FW; x++) { const a = Math.round(2 + (FW - x) / FW * 6); c.fillRect(x, 0, 1, a); c.fillRect(x, FH - (10 - a), 1, 10 - a); }
  const fl = k < 0.08 ? 1 - k / 0.08 : k > 0.9 ? (k - 0.9) / 0.1 : 0;
  if (fl > 0) { c.fillStyle = `rgba(255,255,255,${fl.toFixed(2)})`; c.fillRect(0, 0, FW, FH); }
  c.imageSmoothingEnabled = sm;
}
// Hela straffen i en tagning (filmtid, ingen förvrängning): domaren blåser, skytten tar sats,
// närbild på skytten (SKOTTTTT!), närbild på Lily, sen slow motion – bollen med issvans mot krysset,
// Lily flyger med guldaura och efterbilder, boxar ut bollen över ribban: RÄDDNING! Laget rusar fram.
//   m = { opp, taker (utseendet), bg, crowd, night, ha, hb, mins, d }
const ST = { run: 2.4, cutA: 3.1, cutB: 3.9, fly: 4.6, hit: 5.8 };
function straffShot(m) {
  // bollen träffas i bortre krysset: handskarna sitter 34 px framför Lilys fötter (liggande sprite)
  const spot = [196, 66], hitAt = [234, 57, 15];
  // Lily: står på linjen, flyger snett uppåt mot bortre krysset (liggande sprite, huvudet åt höger)
  const lilyAt = (u) => {
    if (u < ST.fly) return { x: 214, y: 66, lie: false };
    if (u < ST.hit) { const k = ease((u - ST.fly) / (ST.hit - ST.fly)); return { x: lerp(194, 200, k), y: lerp(62, 40, k), lie: true }; }
    if (u < ST.hit + 0.6) { const k = (u - ST.hit) / 0.6; return { x: lerp(200, 198, k), y: lerp(40, 66, k * k), lie: true }; }
    if (u < ST.hit + 1.5) return { x: 198, y: 66, lie: true };
    return { x: 214, y: 66, lie: false, jump: true };
  };
  const ballAt = (u) => {
    if (u < ST.fly) return [spot[0], spot[1], 0];
    if (u < ST.hit) { const k = (u - ST.fly) / (ST.hit - ST.fly); return [lerp(spot[0], hitAt[0], k), lerp(spot[1], hitAt[1], k), lerp(0, hitAt[2], k) + Math.sin(k * Math.PI) * 4]; }
    const k = (u - ST.hit) / 0.9; return [lerp(hitAt[0], 222, k), lerp(hitAt[1], 44, k), hitAt[2] + k * 60];
  };
  const drawLily = (c, u, p, alpha = 1, tint = null) => {
    if (!p.lie) { person(c, p.x + (u < ST.fly ? Math.round(Math.sin(u * 5) * 2) : 0), p.y - (p.jump ? Math.abs(Math.sin(u * 9)) * 5 : 0), KBK.lily, p.jump ? 'down' : 'left', p.jump ? 4 : (Math.sin(u * 5) > 0.6 ? 4 : 0)); return; }
    c.save(); c.globalAlpha = alpha; c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(Math.PI / 2);
    if (tint) c.drawImage(siluett(KBK.lily, 'down', 4, tint), -12, -39); else drawPerson(c, 0, 0, KBK.lily, 'down', 4);
    c.restore();
  };
  const fn = (c, u) => {
    if (u >= ST.cutA && u < ST.cutB) { narbild(c, (u - ST.cutA) / (ST.cutB - ST.cutA), u, m.taker, 'skott', 'opp', true); return; }
    if (u >= ST.cutB && u < ST.fly) { narbildLily(c, (u - ST.cutB) / (ST.fly - ST.cutB), u, KBK.lily); return; }
    const hk = u - ST.hit, shake = hk >= 0 && hk < 0.45;
    if (shake) { R(c, 0, 0, FW, FH, 0x08060a); c.save(); c.translate(Math.round(Math.sin(u * 95) * 2), Math.round(Math.cos(u * 77) * 1.4)); }
    c.drawImage(BGS[m.bg](), 0, 0);
    crowd(c, m.crowd[0], m.crowd[1], m.crowd[2], m.crowd[3], u, hk >= 0 ? clamp(1 - hk / 3.5, 0.4, 1) : 0.05, m.crowd[4] ?? 0.5);
    const L = [], add = (y, f) => L.push({ y, f });
    // de som väntar vid straffområdet – rusar fram till Lily efter räddningen
    const run = clamp((hk - 0.7) / 1.2, 0, 1);
    // (utspridda utanför straffområdet så att skytten syns fritt vid straffpunkten)
    [[KBK.julia, 64, 60, 196], [KBK.marta, 90, 74, 204], [KBK.nina, 116, 58, 190], [KBK.ellen, 142, 72, 222], [KBK.aliceG, 160, 60, 226]].forEach(([look, x, y, tx], i) => add(y, () => {
      if (run > 0) person(c, lerp(x, tx, ease(run)), lerp(y, 68 + (i % 3) * 3, ease(run)), look, run < 1 ? 'right' : 'down', run < 1 ? walkF(u + i * 0.2, 12) : (Math.sin(u * 8 + i) > 0 ? 4 : 0));
      else person(c, x, y, look, 'right', 0);
    }));
    [[m.opp.p[1], 77, 66], [m.opp.p[2], 103, 68], [m.opp.p[3], 129, 64]].forEach(([look, x, y]) => add(y, () => person(c, x, y, look, 'right', 0)));
    // skytten: står bakom bollen, tar sats, skjuter – och tar sig för huvudet efter räddningen
    const tk = clamp((u - ST.run) / (ST.cutA - ST.run), 0, 1);
    add(66, () => person(c, u < ST.run ? 176 : lerp(176, spot[0] - 6, tk), 66, m.taker, hk > 0.5 ? 'down' : 'right', u >= ST.run && u < ST.cutA ? walkF(u, 12) : u >= ST.fly && u < ST.fly + 0.4 ? 2 : hk > 0.5 ? 9 : 0));
    // Lily (med efterbilder i guld när hon flyger)
    const p = lilyAt(u);
    add(p.lie ? 70 : 66, () => {
      if (u >= ST.fly && u < ST.hit + 0.2) for (const [dt, a] of [[0.24, 0.18], [0.16, 0.3], [0.08, 0.45]]) { const q = lilyAt(u - dt); if (q.lie) drawLily(c, u, q, a, 0xffd23f); }
      drawLily(c, u, p);
      if (u >= ST.fly && u < ST.hit + 0.3) {                                                // auran och handskarna
        const f = Math.floor(u * 20);
        for (let n = 0; n < 7; n++) glimt(c, p.x + hash(n, f, 194) * 36, p.y - 12 + hash(n, f + 1, 194) * 24, 1, n & 1 ? 0xffe14a : WHITE);
        if (u > ST.hit - 0.35) glimt(c, p.x + 34, p.y, 2 + (f & 1), 0xfff6c8);
      }
    });
    // bollen med issvans (den flyger i slow motion – 1,2 s för en straff)
    const [bx, by, bz] = ballAt(u);
    add(u >= ST.fly ? 99 : by, () => {                                                      // (i luften: framför Lily)
      if (u >= ST.fly && u < ST.hit) svans(c, (uu) => ballAt(uu), u, ST.fly, 'is');
      if (by - 4 - bz > -6) ball(c, bx, by, bz, u);
    });
    L.sort((a, b) => a.y - b.y);
    let goalDrawn = false;
    for (const d of L) { if (!goalDrawn && d.y > 66) { goal(c, 0, 230, 57, m.night); goalDrawn = true; } d.f(); }
    if (!goalDrawn) goal(c, 0, 230, 57, m.night);
    if (shake) c.restore();
    if (u >= ST.fly && u < ST.hit) fartstreck(c, u, 1);
    if (m.night) { c.fillStyle = 'rgba(255,246,208,.05)'; c.fillRect(0, 30, FW, 50); }
    // RÄDDNINGEN: vitt blixtljus, en stor blixt vid handskarna och texten
    if (hk >= 0 && hk < 0.16) { c.fillStyle = `rgba(255,255,255,${(0.85 * (1 - hk / 0.16)).toFixed(2)})`; c.fillRect(0, 0, FW, FH); }
    if (hk >= 0 && hk < 2.2) {
      const pop = ease(clamp(hk / 0.15, 0, 1)) * (hk > 1.9 ? 1 - (hk - 1.9) / 0.3 : 1), f = Math.floor(u * 14);
      smack(c, 120, 26, 74 * pop, 20 * pop, f, 0x2aa35a, 0xffe14a, 0xfff6d8, 18);
      if (pop > 0.6) {
        const s = $t('RÄDDNING!'), x = Math.round(120 - textW(BIG, s, 2) / 2) + Math.round((hash(1, f, 195) - 0.5) * 3);
        ctxText(c, BIG, s, x + 2, 20, '#06200e', 2);
        outlined(c, BIG, s, x, 18, '#ffffff', '#06200e', 2);
      }
    }
    const min = lerp(m.mins[0], m.mins[1], u / m.d);
    scoreboard(c, m.ha, m.hb, $t('KBK'), m.opp.kort, clockStr(min), false, true);
    if (u < ST.run) matchBanner(c, u + 0.2, $t('STRAFF!'), $t`${m.opp.namn} - KBK`);
  };
  fn.straff = true;
  return fn;
}
// Ljudsättningen (filmljud.js): matcherna får sorl, domarens visselpipa vid avspark, spark,
// nät och läktarens jubel (eller "oooh" när motståndarna gör mål) – slutsignalen där den står i
// texten. Övriga tagningar har sina egna sfx/amb i listorna.
// Matchtagningarna skrivs i handlingstid; närbilden och slow motion gör dem längre. Här skjuts
// allt som händer efter skottet (undertexter, publikens reaktioner, egna ljud) fram lika mycket.
function animeTider(s) {
  const W = s.draw.warp;
  if (!W) return;
  const flytta = (t) => (t >= W.c0 ? t + W.extra : t);
  s.d += W.extra;
  if (s.subs) s.subs = s.subs.map(([a, b, txt]) => [flytta(a), b > W.c0 ? b + W.extra : b, txt]);
  if (s.cues) s.cues = s.cues.map(([t, k]) => [flytta(t), k]);
  if (s.sfx) s.sfx = s.sfx.map(([t, k]) => [flytta(t), k]);
}
function ljudsatt(film) {
  for (const s of film) {
    const m = s.draw.match, st = s.draw.storseger;
    if (m) {
      animeTider(s);
      const G = m.goal, W = s.draw.warp, sfx = [], ug = W.real(G.t0 + G.tGoal);
      if (m.banner) sfx.push([0.35, 'vissla']);
      sfx.push([W.c0, 'cutin'], [W.flyStart + 0.05, 'spark'], [W.flyStart + 0.08, 'swoosh'], [ug, 'nat'], [ug + 0.02, 'boom'], [ug + 0.05, G.by === 'kbk' ? 'mal' : 'oj']);
      if ((s.subs || []).some((x) => /SLUTSIGNAL/.test(x[2]))) sfx.push([ug + 2.3, 'slutsignal']);
      s.sfx = [...(s.sfx || []), ...sfx];
      s.amb ||= 'publik';
    } else if (st) {
      const sfx = [];
      for (let i = 0; i < st.total; i++) sfx.push([i * st.per + st.per * 0.48, 'spark'], [i * st.per + st.per * 0.62, 'nat'], [i * st.per + st.per * 0.64, 'heja']);
      s.sfx = [...(s.sfx || []), ...sfx];
      s.amb ||= 'publik';
    }
  }
  return film;
}

// ================= träningen =================
function dagSkylt(c, s) { const w = textW(SMALL, s) + 8; R(c, FW - w - 3, 3, w, 9, 0x14121a); R(c, FW - w - 3, 3, w, 1, 0xe8b230); ctxText(c, SMALL, s, FW - w + 1, 5, '#e8b230'); }
function konor(c, xs, y) { for (const x of xs) spr(c, x - 2, y - 5, ['..o..', '.oOo.', '.wWw.', 'oOOOo', 'ooooo'], { o: 0xe8601a, O: 0xff8a3a, w: 0xf4f1ea, W: 0xffffff }); }
function rain(c, t) {
  for (let n = 0; n < 60; n++) {
    const sp = n % 3 === 0 ? 150 : 110, x0 = hash(n, 1, 91) * (FW + 40);
    const y = ((hash(n, 2, 91) * FH + t * sp) % (FH + 10)) - 6, x = x0 - y * 0.35 - 20;
    const col = n % 3 === 0 ? 0x8a9ab8 : 0x5a6a88;
    P1(c, x, y, col); P1(c, x - 0.35, y + 1, col); if (n % 3 === 0) P1(c, x - 0.7, y + 2, col);
  }
}
// liggande figur (armhävningar): spriten vriden 90° runt fötterna – exakt pixelrutnät
function liggande(c, x, y, look, upp) {
  c.save(); c.translate(Math.round(x), Math.round(y) - (upp ? 3 : 1)); c.rotate(Math.PI / 2); drawPerson(c, 0, 0, look, 'right', 0); c.restore();
  if (upp) { const sk = look.skin; R(c, x + 24, y - 2, 1, 3, sk); R(c, x + 25, y - 2, 1, 3, mul(parseInt(sk.slice(1), 16), 0.8)); }   // armarna
}
// pokalen: guld i fyra toner, handtag, sockel med plakett (s = 1 lilla, 1.4 stora)
//   oron = Champions League-pokalen: silver med stora öronformade handtag hela vägen ner
function pokal(c, x, y, s = 1, glint = 0, oron = false) {
  if (oron) return pokalOron(c, x, y, s, glint);
  const G = { hi: 0xfff0a0, base: 0xe8b230, lo: 0xa87818, dk: 0x5a3c0c };
  const w = Math.round(14 * s), h = Math.round(12 * s);
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < h; j++) {                                                        // skålen
    const k = j / h, half = Math.round((w / 2) * (1 - k * k * 0.55));
    for (let i = -half; i <= half; i++) {
      const t = (i + half) / (2 * half + 1);
      R(c, x + i, y + j, 1, 1, i === -half || i === half ? G.dk : t < 0.25 ? G.hi : t < 0.6 ? G.base : t < 0.85 ? G.lo : G.dk);
    }
  }
  R(c, x - Math.round(w / 2), y, w + 1, 1, G.hi);
  for (const sgn of [-1, 1]) for (let j = 1; j < Math.round(7 * s); j++) {               // handtagen
    const hx = x + sgn * (Math.round(w / 2) + 1 + Math.round(Math.sin(j / (7 * s) * Math.PI) * 3 * s));
    R(c, hx, y + j, 1, 1, sgn < 0 ? G.base : G.lo);
  }
  const st = Math.round(5 * s);
  R(c, x - 1, y + h, 3, st, G.base); R(c, x - 1, y + h, 1, st, G.hi); R(c, x + 1, y + h, 1, st, G.lo);
  const bw = Math.round(10 * s), bh = Math.round(5 * s);
  R(c, x - (bw >> 1), y + h + st, bw + 1, bh, 0x3a2414); R(c, x - (bw >> 1), y + h + st, bw + 1, 1, 0x6a4424);
  R(c, x - 2, y + h + st + 2, 5, 1, G.base);
  if (glint > 0) { const gx = x - 3, gy = y + 3; P1(c, gx, gy, WHITE); P1(c, gx - 1, gy, 0xfff6c8); P1(c, gx + 1, gy, 0xfff6c8); P1(c, gx, gy - 1, 0xfff6c8); P1(c, gx, gy + 1, 0xfff6c8); }
}
function pokalOron(c, x, y, s, glint) {
  const G = { hi: 0xffffff, base: 0xd8dce4, lo: 0x9aa0ae, dk: 0x4a4e5a };
  const w = Math.round(12 * s), h = Math.round(16 * s);
  x = Math.round(x); y = Math.round(y);
  // öronen: en tjock ring på var sida, från skålens kant ner mot foten (pixel för pixel)
  const rx = 4.5 * s, ry = h * 0.44;
  for (const sgn of [-1, 1]) {
    const ex = x + sgn * (w / 2 + rx - 2.5), ey = y + h * 0.44;
    for (let j = Math.floor(-ry - 1); j <= ry + 1; j++) for (let i = Math.floor(-rx - 1); i <= rx + 1; i++) {
      const d = Math.hypot(i / rx, j / ry);
      if (d > 1 || d < 0.6) continue;
      const lit = (-i * sgn) / rx - j / ry;                                              // ljuset uppifrån och inifrån
      P1(c, Math.round(ex + i), Math.round(ey + j), d > 0.9 ? G.dk : lit > 0.5 ? G.hi : lit > -0.3 ? G.base : G.lo);
    }
  }
  for (let j = 0; j < h; j++) {                                                        // skålen: smal nertill
    const k = j / h, half = Math.round((w / 2) * (1 - k * k * 0.75));
    for (let i = -half; i <= half; i++) {
      const t = (i + half) / (2 * half + 1);
      R(c, x + i, y + j, 1, 1, i === -half || i === half ? G.dk : t < 0.25 ? G.hi : t < 0.6 ? G.base : t < 0.85 ? G.lo : G.dk);
    }
  }
  R(c, x - Math.round(w / 2), y, w + 1, 1, G.hi);
  const st = Math.round(4 * s);
  R(c, x - 1, y + h, 3, st, G.base); R(c, x - 1, y + h, 1, st, G.hi); R(c, x + 1, y + h, 1, st, G.lo);
  const bw = Math.round(8 * s), bh = Math.round(4 * s);
  R(c, x - (bw >> 1), y + h + st, bw + 1, bh, G.lo); R(c, x - (bw >> 1), y + h + st, bw + 1, 1, G.hi);
  if (glint > 0) glimt(c, x - 3, y + 4, 2);
}
function konfetti(c, t, n = 70, seed = 95) {
  const cols = [0xe8b230, 0xf4f1ea, 0xc9323a, 0x7a1e2e, 0x3a7bd5, 0x8edc4c];
  for (let k = 0; k < n; k++) {
    const sp = 14 + hash(k, 1, seed) * 18, x = hash(k, 2, seed) * FW + Math.sin(t * 3 + k) * 3;
    const y = ((hash(k, 3, seed) * (FH + 20) + t * sp) % (FH + 20)) - 10;
    const col = cols[k % cols.length];
    P1(c, x, y, col); if (Math.floor(t * 6 + k) & 1) P1(c, x + 1, y, mul(col, 0.7));
  }
}
function fyrverkeri(c, t, seed = 97) {
  for (let b = 0; b < 4; b++) {
    const per = 1.6, tb = (t + b * 0.4) % per, k = tb / per;
    const bx = 30 + hash(b, Math.floor((t + b * 0.4) / per), seed) * 180, by = 8 + hash(b + 9, Math.floor((t + b * 0.4) / per), seed) * 14;
    const col = [0xffd23f, 0xff5a7a, 0x8edcff, 0xb8f070][b];
    if (k < 0.2) { P1(c, bx, by + (0.2 - k) * 120, 0xfff6c8); continue; }
    const r = ease((k - 0.2) / 0.5) * 14;
    for (let a = 0; a < 16; a++) {
      const th = a / 16 * Math.PI * 2;
      if (k > 0.75 && hash(a, b, seed) < (k - 0.75) * 4) continue;
      P1(c, bx + Math.cos(th) * r, by + Math.sin(th) * r * 0.8 + (k - 0.2) * 6, k > 0.6 ? mul(col, 0.7) : col);
    }
  }
}
function blixtar(c, t) { for (let k = 0; k < 5; k++) if (hash(k, Math.floor(t * 5), 99) > 0.8) { const x = 10 + hash(k, 1, 99) * 220, y = 12 + hash(k, 2, 99) * 14; R(c, x - 1, y, 3, 1, WHITE); R(c, x, y - 1, 1, 3, WHITE); } }

// ================= affischerna (26 × 36) =================
export function kbkPoster(P, id) {
  const w = 26, h = 36, A = (x, y, c) => P.px(x, y, c);
  const title = (s, y, fill, out, F = SMALL) => { const x = (w - textW(F, s)) >> 1; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) drawText(P, F, s, x + ox, y + oy, out); drawText(P, F, s, x, y, fill); };
  if (id === 'kbk1') {
    area(P, 0, 0, w, h, (X, Y) => (Y < 24 ? qmix(0x4a0e1a, 0x9a2a3a, Y / 24, X, Y, 4) : jit((X + (h - Y)) >> 2 & 1 ? 0x4aa83e : 0x3f9636, X, Y, 211, 0.08)));
    for (let k = 0; k < 3; k++) { const x0 = 5 + k * 6; area(P, x0, 20, 3, 8, (X, Y, i, j) => (j < 2 ? 0xeec3a0 : j < 5 ? (i === 0 ? 0xa02a3a : 0x7a1e2e) : j < 7 ? 0x1c1c1c : 0xd8f040)); A(x0, 19, [0xd9a95c, 0x6b4226, 0x1d1714][k]); A(x0 + 1, 19, [0xd9a95c, 0x6b4226, 0x1d1714][k]); }
    area(P, 20, 26, 5, 5, (X, Y, i, j) => { const d = Math.hypot(i - 2, j - 2); return d > 2.4 ? null : d > 1.8 ? 0x2a2630 : (i + j) % 3 === 0 ? 0x2a2630 : 0xf6f6f2; });
    title($t('KBK'), 3, 0xffd23f, 0x3a0a08, BIG);
    title($t('CUPEN'), 12, 0xf4f1ea, 0x3a0a08);
  } else {
    area(P, 0, 0, w, h, (X, Y) => qmix(0x06081e, 0x1e2a5a, Y / h, X, Y, 4));
    for (let k = 0; k < 12; k++) A(Math.floor(hash(k, 1, 212) * w), Math.floor(hash(k, 2, 212) * 14), 0xb8c8f0);
    area(P, 6, 14, 15, 15, (X, Y, i, j) => {                                             // jordgloben
      const d = Math.hypot(i - 7, j - 7); if (d > 7.2) return null;
      const land = hash((i + 3) >> 1, j >> 1, 213) > 0.55;
      return d > 6.4 ? 0x0a1430 : land ? (i + j < 10 ? 0x8edc4c : 0x46a35a) : (i + j < 10 ? 0x6ab8f0 : 0x2c6fb7);
    });
    title($t('KBK'), 3, 0xffd23f, 0x3a0a08, BIG);
    drawText(P, BIG, '2', 20, 27, 0x3a0a08); drawText(P, BIG, '2', 19, 26, 0xe0505a);
  }
}
function drawText(P, F, s, x, y, col) {
  let cxp = x;
  for (const ch of String(s).toUpperCase()) {
    const G = F[ch] || F['?'];
    const rows = [...G.up, ...G.rows], y0 = y - G.up.length;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(cxp + i, y0 + j, col); });
    cxp += G.w + 1;
  }
}

// ================= titelskyltarna =================
function titel(c, u, rad1, rad2, theme) {
  if (theme === 'varld') {
    for (let y = 0; y < FH; y++) { c.fillStyle = css(mix(0x06081e, 0x1e2a5a, y / FH)); c.fillRect(0, y, FW, 1); }
    for (let k = 0; k < 40; k++) P1(c, hash(k, 1, 131) * FW, hash(k, 2, 131) * FH, hash(k, 3, 131) > 0.6 ? 0xfff6d8 : 0x6a7ab0);
    // jordgloben snurrar
    const gx = 218, gy = 44, r = 16;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const d = Math.hypot(i, j); if (d > r) continue;
      const lon = Math.floor((Math.asin(clamp(i / Math.sqrt(Math.max(1, r * r - j * j)), -1, 1)) + u * 0.8) * 4), lat = Math.floor((j + r) / 4);
      const land = hash(((lon % 24) + 24) % 24, lat, 132) > 0.55;
      const light = (-i - j) / (2 * r);
      P1(c, gx + i, gy + j, d > r - 1 ? 0x0a1430 : land ? (light > 0.1 ? 0x8edc4c : 0x46a35a) : (light > 0.1 ? 0x6ab8f0 : 0x2c6fb7));
    }
  } else {
    for (let y = 0; y < FH; y++) { c.fillStyle = css(mix(0x2a060e, 0x7a1e2e, y / FH)); c.fillRect(0, y, FW, 1); }
    for (let y = 62; y < FH; y++) for (let x = 0; x < FW; x += 12) { const k = Math.floor((x + (FH - y) * 0.3) / 12) & 1; R(c, x, y, 12, 1, y === 62 ? 0x6ac04e : k ? 0x3f9636 : 0x4aa83e); }
    ball(c, 204, 72, Math.abs(Math.sin(u * 4)) * 12, u);
  }
  const k = ease(u / 0.8);
  const x1 = cx(BIG, rad1, 2) + Math.round((1 - k) * -60);
  outlined(c, BIG, rad1, x1, 16, '#ffd23f', '#3a0a08', 2);
  if (u > 0.6) { const k2 = ease((u - 0.6) / 0.6), x2 = cx(BIG, rad2) + Math.round((1 - k2) * 60); outlined(c, BIG, rad2, x2, 40, '#f4f1ea', '#3a0a08'); }
  if (u > 1.6) { const s = $t('BIO PIXEL PRESENTERAR'); ctxText(c, SMALL, s, cx(SMALL, s), 56, '#c8a44a'); }
}
function slut(c, u, rader, teaser) {
  R(c, 0, 0, FW, FH, 0x08060a);
  const k = ease(u / 0.6);
  if (k > 0) outlined(c, BIG, $t('SLUT'), cx(BIG, $t('SLUT')), 6, '#ffd23f', '#3a1a08');
  rader.forEach((s, i) => { if (u > 0.5 + i * 0.35) ctxText(c, SMALL, s, cx(SMALL, s), 20 + i * 8, i === 0 ? '#e8b230' : '#c8c0b0'); });
  if (teaser && u > 3) { const blink = Math.floor(u * 3) & 1; outlined(c, SMALL, teaser, cx(SMALL, teaser), FH - 10, blink ? '#ffd23f' : '#f4f1ea', '#3a1a08'); }
}

// ======================================================================
//  FILM 1: KUNGSLADUGÅRD – EN STILLSAM BÖRJAN
// ======================================================================
const LAGET_LISTA = (resten) => {
  const r = [];
  for (let i = 0; i < resten.length; i += 5) r.push(resten.slice(i, i + 5).join(', '));
  return r;
};
const HUVUDROLLER = $t('JULIA  MÄRTA  NINA  ELLEN  ALICE G  LILY');
// laget presenteras: tränaren, de fem och Lily i mål – namnen tänds en i taget ovanför
// (skyltarna i två höjder så att de inte krockar)
function presentation(c, u) {
  c.drawImage(BGS.morgon(), 0, 0);
  person(c, 24, 72, TRANAREN, 'right', Math.sin(u * 2) > 0.9 ? 4 : 0);
  if (u > 2.8) { R(c, 30, 54, 1, 2, 0xc8c8d0); P1(c, 31, 54, 0xe8e8ec); }                     // visselpipan
  const sex = ['julia', 'marta', 'nina', 'ellen', 'aliceG', 'lily'];
  sex.forEach((k, i) => {
    const x = 52 + i * 30;
    person(c, x, 68, KBK[k], 'down', Math.sin(u * 2 + i) > 0.92 ? 4 : 0);
    if (u > 1 + i * 0.3) { const w = textW(SMALL, NAMN[k]) + 4, y = i & 1 ? 18 : 26; R(c, x - (w >> 1), y - 1, w, 7, 0x14121a); ctxText(c, SMALL, NAMN[k], x - (w >> 1) + 2, y, k === 'lily' ? '#8edc4c' : '#ffd23f'); }
  });
  ball(c, 224, 72, 0, 0);
}
export const FILM_KBK1 = ljudsatt([
  { d: 4, light: 0x7a1e2e, music: 'intro', draw: (c, u) => titel(c, u, $t('KUNGSLADUGÅRD'), $t('EN STILLSAM BÖRJAN'), 'kbk') },
  // laget på konstgräset – lilla cupen om en vecka
  { d: 5.5, light: 0xe8a060, music: 'intro', sfx: [[2.9, 'vissla']], subs: [[0.6, 2.8, $n('LILLA CUPEN BÖRJAR OM EN VECKA.')], [3.0, 5.4, $n('DÅ ÄR DET DAGS ATT TRÄNA. HÅRT.')]], draw: (c, u) => presentation(c, u) },
  // TRÄNINGSMONTAGET: löprunda i gryningen
  { d: 5, light: 0xf0a060, music: 'traning', cues: [[0.4, 'heja']], draw: (c, u) => {
    c.drawImage(BGS.morgon(), 0, 0);
    const order = ['julia', 'nina', 'marta', 'ellen', 'aliceG'];
    for (let i = 0; i < 10; i++) {
      const L = i < 5 ? KBK[order[i]] : MATES[i - 5];
      const x = ((u * 46 + 250 - i * 22) % 290) - 30, y = i % 2 ? 62 : 72;
      person(c, x, y, L, 'right', walkF(u + i * 0.13, 12));
      if (Math.floor(u * 4 + i) % 4 === 0) { P1(c, x + 6, y - 26, 0xf4f1ea); P1(c, x + 7, y - 27, 0xe8e8ec); }   // andedräkt i morgonkylan
    }
    dagSkylt(c, $t('DAG 1'));
    if (u < 1.2) { const s = $t('TRÄNING!'); outlined(c, BIG, s, cx(BIG, s, 2), 18, '#ffd23f', '#5a1a08', 2); }
  } },
  // koner och skott
  { d: 6, light: 0x6ab84a, music: 'traning', cues: [[1.4, 'oj'], [3.8, 'heja']], sfx: [0, 1, 2, 3].flatMap((n) => [[n * 1.5 + 0.53, 'spark'], [n * 1.5 + 0.98, 'nat']]), draw: (c, u) => {
    c.drawImage(BGS.morgon(), 0, 0);
    const kx = [30, 46, 62, 78, 94];
    konor(c, kx, 70);
    // Märta dribblar mellan konerna
    const p = (u * 0.42) % 1, mx = lerp(18, 106, p), my = 70 + Math.round(Math.sin(p * Math.PI * 5) * 5);
    person(c, mx, my, KBK.marta, 'right', walkF(u, 13));
    ball(c, mx + 6 + Math.round(Math.sin(u * 16)), my, 0, u);
    // Nina skjuter boll på boll, målvakten kastar sig
    goal(c, 0);
    const per = 1.5, k = (u % per) / per, n = Math.floor(u / per);
    const sx = 164, sy = 66;
    for (let b = 0; b < 4 - Math.min(3, n); b++) ball(c, 150 + b * 4, 74, 0, 0);           // bollhögen
    if (k >= 0.42 && k < 0.95) { const dk = clamp((k - 0.42) / 0.3, 0, 1); c.save(); c.translate(212 + Math.round(dk * 3), 66 - Math.round(Math.sin(dk * Math.PI) * 5 + dk * (n & 1 ? 8 : -2))); c.rotate(-Math.PI / 2); drawPerson(c, 0, 0, KBK_KEEPER, 'right', 0); c.restore(); }
    else person(c, 212, 66, KBK_KEEPER, 'left', 0);
    if (k < 0.3) person(c, sx, sy, KBK.nina, 'right', walkF(u, 12));
    else person(c, sx, sy, KBK.nina, 'right', k < 0.45 ? 2 : 0);
    if (k >= 0.35) { const bk = clamp((k - 0.35) / 0.3, 0, 1); ball(c, lerp(sx + 5, 229, bk), lerp(sy, 64 - (n & 1) * 4, bk), lerp(1, 9, bk) + Math.sin(bk * Math.PI) * 4, u); }
    dagSkylt(c, $t('DAG 3'));
  } },
  // styrka: armhävningar, upphopp och stegen
  { d: 6, light: 0x9a6a40, music: 'traning', subs: [[0.8, 3.0, $n('...18, 19, 20!')], [3.4, 5.8, $n('EN GÅNG TILL!')]], draw: (c, u) => {
    c.drawImage(BGS.morgon(), 0, 0);
    person(c, 24, 68, TRANAREN, 'right', Math.floor(u * 2) & 1 ? 9 : 0);
    const upp = Math.floor(u * 2.4) & 1;
    liggande(c, 46, 74, KBK.nina, upp); liggande(c, 46, 62, MATES[1], 1 - upp);
    // upphopp: Ellen och Alice G
    for (const [k, x, ph] of [['ellen', 108, 0], ['aliceG', 128, 0.5]]) {
      const s = (u * 1.6 + ph) % 1, up = Math.sin(s * Math.PI);
      person(c, x, 70 - Math.round(up * 9), KBK[k], 'down', up > 0.15 ? 4 : 5);
    }
    // stegen: Julia trampar fram över stegpinnarna, Märta väntar
    for (let i = 0; i < 9; i++) { R(c, 150 + i * 8, 64, 1, 9, 0xf0c03a); }
    R(c, 150, 64, 65, 1, 0xf0c03a); R(c, 150, 72, 65, 1, 0xf0c03a);
    const jx = 150 + ((u * 36) % 72);
    person(c, jx, 70 - (Math.floor(u * 16) & 1), KBK.julia, 'right', walkF(u, 18));
    person(c, 226, 70, KBK.marta, 'left', 0);
    dagSkylt(c, $t('DAG 5'));
  } },
  // kvällspass i regnet: inlägg och nickar, laget samlas – KBK!
  { d: 6.5, light: 0x2a3a6a, music: 'traning', amb: 'regn', cues: [[2.2, 'heja'], [5.0, 'heja']], draw: (c, u) => {
    c.drawImage(BGS.kvall(), 0, 0);
    if (u < 4.2) {
      anfall(c, (u % 2.1) * 1.0, { passer: KBK.aliceG, scorer: KBK.ellen, mates: [], opp: { p: [MATES[5], MATES[6], MATES[7]] }, keeper: KBK_KEEPER, kind: 'nick', t0: 0, tPass: 0.6, tShot: 1.2, tGoal: 1.5, night: true });
    } else {
      // laget i en ring med händerna i mitten
      const k = ease((u - 4.2) / 0.8);
      const ring = ['julia', 'marta', 'nina', 'ellen', 'aliceG', 0, 1, 2];
      ring.forEach((key, i) => {
        const a = i / ring.length * Math.PI * 2, x = 120 + Math.cos(a) * 18 * (2 - k), y = 64 + Math.sin(a) * 7 * (2 - k);
        const L = typeof key === 'string' ? KBK[key] : MATES[key];
        const dx = 120 - x, dy = 64 - y;
        person(c, x, y, L, Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up', 0);
      });
      if (u > 5) { const s = $t('KBK!'); outlined(c, BIG, s, cx(BIG, s, 2), 12 - (Math.floor(u * 6) & 1), '#ffd23f', '#5a1a08', 2); }
    }
    rain(c, u);
    dagSkylt(c, $t('DAG 7'));
  } },
  // MATCH 1: Näset – Nina gör 1-0 på passning från Julia, KBK vinner 3-1
  { d: 7, light: 0x5aa8e8, cues: [[3.5, 'heja']], subs: [[4.0, 6.9, $n('NINA! PASSNING: JULIA. SLUTRESULTAT 3-1.')]], draw: matchShot({
    opp: LAG.naset, bg: 'cup', crowd: ['cup', 14, 28, 90, 0.5], ha: 0, hb: 0, mins: [11, 13], d: 7, banner: [$t('LILLA CUPEN - MATCH 1'), $t('KBK - NÄSET')],
    goal: SHOT('kbk', KBK.nina, KBK.julia, 'skott'),
  }) },
  // MATCH 2: Hovås/Billdal – 1-1 i sista minuten, Märta gör 2-1 på passning från Ellen
  { d: 7, light: 0x5aa8e8, cues: [[3.7, 'heja']], subs: [[0.4, 2.6, $n('1-1. EN MINUT KVAR...')], [4.2, 6.9, $n('MÄRTA! PASSNING: ELLEN. UDDAMÅLET!')]], draw: matchShot({
    opp: LAG.hovas, bg: 'cup', crowd: ['cup', 14, 28, 90, 0.4], ha: 1, hb: 1, mins: [59, 60], late: 59, d: 7, banner: [$t('LILLA CUPEN - MATCH 2'), $t('KBK - HOVÅS/BILLDAL')],
    goal: SHOT('kbk', KBK.marta, KBK.ellen, 'skott', { tPass: 2.6, tShot: 3.3, tGoal: 3.65 }),
  }) },
  // MATCH 3: Sandarna – mål på mål
  { d: 7, light: 0x5aa8e8, cues: [[1.0, 'heja'], [3.0, 'heja'], [5.0, 'heja']], subs: [[6.0, 7, $n('SLUTRESULTAT: KBK 10-0 SANDARNA!')]], draw: storseger(LAG.sandarna, 10, ['julia', 'aliceG', 'ellen', 'nina', 'marta'], 'cup', ['cup', 14, 28, 90]) },
  // FINALEN mot Älvsborg (1/3): Älvsborg tar ledningen
  { d: 6, light: 0x2a2a58, cues: [[3.5, 'oj']], subs: [[4.0, 5.9, $n('NEJ! ÄLVSBORG LEDER 0-1.')]], draw: matchShot({
    opp: LAG.alvsborg, bg: 'final', crowd: ['final', 9, 28, 140, 0.5], night: true, ha: 0, hb: 0, mins: [20, 22], d: 6, banner: [$t('FINAL - LILLA CUPEN'), $t('KBK - ÄLVSBORG')],
    goal: SHOT('opp', LAG.alvsborg.p[0], LAG.alvsborg.p[1], 'skott'),
  }) },
  // (2/3): Ellen nickar in 1-1 på inlägg från Alice G
  { d: 6, light: 0x2a2a58, cues: [[3.5, 'heja']], subs: [[4.0, 5.9, $n('ELLEN NICKAR! INLÄGG: ALICE G. 1-1!')]], draw: matchShot({
    opp: LAG.alvsborg, bg: 'final', crowd: ['final', 9, 28, 140, 0.5], night: true, ha: 0, hb: 1, mins: [41, 43], d: 6,
    goal: SHOT('kbk', KBK.ellen, KBK.aliceG, 'nick'),
  }) },
  // (3/3): sista minuten – Julia gör 2-1 på passning från Märta
  { d: 7, light: 0x2a2a58, cues: [[3.6, 'heja'], [5.6, 'heja']], subs: [[0.3, 2.4, $n('SISTA MINUTEN...')], [4.0, 6.9, $n('JULIA! PASSNING: MÄRTA. 2-1 - SLUTSIGNAL!')]], draw: matchShot({
    opp: LAG.alvsborg, bg: 'final', crowd: ['final', 9, 28, 140, 0.5], night: true, ha: 1, hb: 1, mins: [59, 60], late: 59, d: 7,
    goal: SHOT('kbk', KBK.julia, KBK.marta, 'skott', { tPass: 2.5, tShot: 3.2, tGoal: 3.55 }),
  }) },
  // pokalen
  { d: 6.5, light: 0xe8b230, amb: 'publik', sfx: [[0.7, 'pokal'], [1.0, 'mal'], [3.6, 'heja']], cues: [[1.2, 'heja'], [3.5, 'aww']], subs: [[1.0, 3.4, $n('KBK VINNER LILLA CUPEN!')], [3.6, 6.4, $n('KUNGSLADUGÅRD - MÄSTARE!')]], draw: (c, u) => {
    c.drawImage(BGS.final(), 0, 0);
    crowd(c, 'final', 9, 28, 140, u, 1, 0.6);
    // pallen
    R(c, 72, 66, 96, 8, 0x3a2414); R(c, 72, 66, 96, 1, 0x7a5434); R(c, 72, 73, 96, 1, 0x1a0e08);
    const back = [0, 1, 2, 3, 4, 5];
    back.forEach((i) => person(c, 82 + i * 15, 60, MATES[i], 'down', Math.sin(u * 7 + i) > 0.3 ? 4 : 0));
    const sex = ['lily', 'aliceG', 'ellen', 'julia', 'nina', 'marta'];
    const lift = ease(clamp((u - 0.8) / 0.6, 0, 1)) * 10 + (u > 1.4 ? Math.abs(Math.sin(u * 3)) * 2 : 0);
    sex.forEach((k, i) => person(c, 85 + i * 14, 70, KBK[k], 'down', i === 3 ? 9 : Math.sin(u * 8 + i) > 0 ? 4 : 0));
    pokal(c, 127, 22 - lift, 1, Math.floor(u * 4) & 1);
    konfetti(c, u);
    blixtar(c, u);
  } },
  { d: 6, light: 0x7a1e2e, music: 'intro', draw: (c, u) => slut(c, u, [HUVUDROLLER, $t('OCH HELA KUNGSLADUGÅRD:'), ...LAGET_LISTA(RESTEN)], $t('FORTSÄTTNING FÖLJER: UT I VÄRLDEN')) },
]);

// ======================================================================
//  FILM 2: KUNGSLADUGÅRD – UT I VÄRLDEN
// ======================================================================
function flygplan(c, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  R(c, x - 1, y + 3, 46, 8, 0x5a6070);                                                      // kontur mot himlen
  R(c, x, y + 4, 44, 6, 0xf4f4f8); R(c, x, y + 9, 44, 1, 0xc8c8d0); R(c, x + 2, y + 4, 40, 1, WHITE);
  R(c, x + 44, y + 5, 3, 4, 0xe0e0e8); R(c, x + 46, y + 6, 2, 2, 0x9ad8f8);                  // nosen
  for (let i = 0; i < 9; i++) R(c, x + 10 + i * 3, y + 5, 2, 2, 0x6aa8d8);                   // fönstren
  R(c, x + 1, y - 2, 6, 6, 0x7a1e2e); R(c, x + 2, y - 2, 4, 1, 0xe0505a);                   // stjärtfenan
  R(c, x + 16, y + 9, 14, 3, 0xd8d8e0); R(c, x + 18, y + 12, 8, 1, 0xa8a8b0);               // vingen
  ctxText(c, SMALL, $t('KBK'), x + 34, y + 2, '#7a1e2e');
  if (Math.floor(t * 4) & 1) P1(c, x + 2, y + 6, 0xff3a3a);
}
function moln(c, t, seed, sp, y0, col) {
  for (let k = 0; k < 6; k++) {
    const x = ((hash(k, 1, seed) * 300 - t * sp) % 300 + 300) % 300 - 40, y = y0 + hash(k, 2, seed) * 30, r = 6 + hash(k, 3, seed) * 6;
    for (let j = -r; j <= r * 0.5; j++) for (let i = -r * 2; i <= r * 2; i++) { const d = Math.hypot(i / 2, j); if (d < r) P1(c, x + i, y + j, j > r * 0.2 ? mul(col, 0.88) : col); }
  }
}
export const FILM_KBK2 = ljudsatt([
  { d: 4, light: 0x1e2a5a, music: 'intro', draw: (c, u) => titel(c, u, $t('KUNGSLADUGÅRD'), $t('UT I VÄRLDEN'), 'varld') },
  // flyget ut i världen
  { d: 5.5, light: 0x6ab8f0, music: 'intro', subs: [[0.6, 2.8, $n('CHAMPIONS LEAGUE. DE BÄSTA LAGEN.')], [3.0, 5.4, $n('OCH KBK ÄR MED.')]], draw: (c, u) => {
    for (let y = 0; y < FH; y++) { c.fillStyle = css(mix(0x5aa8e8, 0xc8e8f8, y / FH)); c.fillRect(0, y, FW, 1); }
    moln(c, u, 141, 18, 44, 0xffffff);
    flygplan(c, 96 + Math.sin(u * 1.4) * 6, 22 + Math.sin(u * 2) * 2, u);
    moln(c, u, 142, 40, 58, 0xf0f4f8);
  } },
  // TRÄNINGSLÄGRET: uppför läktartrapporna
  { d: 5, light: 0xb84a4a, music: 'traning', cues: [[0.5, 'heja']], draw: (c, u) => {
    c.drawImage(BGS.trappa(), 0, 0);
    const order = ['julia', 'ellen', 'nina', 'aliceG', 'marta'];
    order.forEach((k, i) => {
      const p = ((u * 0.24 + i * 0.2) % 1), x = 100 + p * 30, y = 86 - p * 76;
      const L = typeof k === 'string' ? KBK[k] : MATES[k];
      person(c, x, y, L, 'up', walkF(u + i * 0.2, 13));
    });
    dagSkylt(c, $t('TRÄNINGSLÄGRET'));
    if (u < 1.2) { const s = $t('TRÄNING!'); outlined(c, BIG, s, 20, 18, '#ffd23f', '#5a1a08', 2); }
  } },
  // jonglering till 100 och däcket
  { d: 6, light: 0x6ab84a, music: 'traning', cues: [[2.6, 'heja']], draw: (c, u) => {
    c.drawImage(BGS.morgon(), 0, 0);
    // Nina jonglerar: 98, 99, 100!
    const n = Math.min(100, 98 + Math.floor(u / 1.4)), b = Math.abs(Math.sin(u * Math.PI / 0.7));
    person(c, 90, 72, KBK.nina, 'right', b < 0.25 ? 2 : 0);
    ball(c, 96, 72, b * 16, u);
    const s = n >= 100 ? '100!' : String(n), sc = n >= 100 ? 2 : 1;
    outlined(c, BIG, s, 92 - (textW(BIG, s, sc) >> 1), n >= 100 ? 18 : 24, n >= 100 ? '#ffd23f' : '#f4f1ea', '#3a1a08', sc);
    // Julia drar ett däck i ett rep
    const jx = 140 + ((u * 26) % 100), ty = 70;
    person(c, jx, ty, KBK.julia, 'right', walkF(u, 13));
    for (let k = 0; k < 14; k++) P1(c, jx - 4 - k, ty - 12 + k * 0.6, 0xc8b890);
    for (let j = -3; j <= 3; j++) for (let i = -6; i <= 6; i++) { const d = Math.hypot(i / 6, j / 3); if (d < 1 && d > 0.45) P1(c, jx - 22 + i, ty - 2 + j, d > 0.8 ? 0x14141a : 0x2e2e36); }
    if (Math.floor(u * 8) & 1) for (let k = 0; k < 3; k++) P1(c, jx - 30 - k * 3, ty - 1 - k, 0xb89a6a);   // dammet
    dagSkylt(c, $t('DAG 2'));
  } },
  // kvällspasset: skott i krysset, målvakten räddar, sprint
  { d: 6, light: 0x2a3a6a, music: 'traning', cues: [[1.6, 'oj'], [4.4, 'heja']], sfx: [[1.6, 'spark'], [1.9, 'nat'], [4.6, 'spark'], [4.9, 'nat']], subs: [[4.6, 5.9, $n('VI ÄR REDO FÖR VÄRLDEN.')]], draw: (c, u) => {
    c.drawImage(BGS.kvall(), 0, 0);
    // tavlor i hörnen
    for (const [x, y] of [[226, 42], [232, 34]]) { for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const d = Math.hypot(i, j); if (d < 3.5) P1(c, x + i, y + j, d < 1.2 ? 0xe8b230 : d < 2.4 ? 0xf4f1ea : 0xc9323a); } }
    anfall(c, u % 3, { passer: KBK.ellen, scorer: KBK.marta, mates: [MATES[4]], opp: { p: [MATES[5], MATES[6], MATES[7]] }, keeper: KBK_KEEPER, kind: 'skott', t0: 0, tPass: 1.0, tShot: 1.6, tGoal: 1.9, night: true });
    // Alice G sprintar längs långsidan
    const ax = ((u * 70) % 300) - 30;
    person(c, ax, 78, KBK.aliceG, 'right', walkF(u, 16));
    for (let k = 0; k < 4; k++) R(c, ax - 10 - k * 6, 70 + k * 2, 4, 1, 'rgba(244,241,234,.5)');
    dagSkylt(c, $t('DAG 6'));
  } },
  // HÄCKEN: Felicia Schröder kvitterar, Julia gör 3-2
  { d: 7, light: 0xf6d02a, cues: [[3.5, 'heja']], subs: [[0.3, 2.3, $n('SCHRÖDER HAR KVITTERAT TILL 2-2...')], [4.0, 6.9, $n('JULIA! PASSNING: NINA. KBK VINNER 3-2!')]], draw: matchShot({
    opp: LAG.hacken, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.35], night: true, ha: 2, hb: 2, mins: [77, 79], d: 7, banner: [$t('CHAMPIONS LEAGUE - MATCH 1'), $t('KBK - HÄCKEN')],
    goal: SHOT('kbk', KBK.julia, KBK.nina, 'skott'),
  }) },
  // MANCHESTER UNITED: Ella Toone gör 1-0 …
  { d: 6, light: 0xd0202a, cues: [[3.5, 'oj']], subs: [[4.0, 5.9, $n('TOONE! 0-1 TILL UNITED.')]], draw: matchShot({
    opp: LAG.united, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.3], night: true, ha: 0, hb: 0, mins: [8, 10], d: 6, banner: [$t('CHAMPIONS LEAGUE - MATCH 2'), $t('KBK - MANCHESTER UNITED')],
    goal: SHOT('opp', LAG.united.p[0], LAG.united.p[1], 'skott'),
  }) },
  // … men KBK vänder: Alice G nickar in 4-1
  { d: 7, light: 0xd0202a, cues: [[3.5, 'heja']], subs: [[0.3, 2.3, $n('MEN KBK VÄNDER MATCHEN...')], [4.0, 6.9, $n('ALICE G NICKAR IN 4-1! INLÄGG: MÄRTA.')]], draw: matchShot({
    opp: LAG.united, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.4], night: true, ha: 3, hb: 1, mins: [70, 72], d: 7,
    goal: SHOT('kbk', KBK.aliceG, KBK.marta, 'nick'),
  }) },
  // JUVENTUS: Barbara Bonansea har gjort 1-1, Ellen avgör med uddamålet
  { d: 7, light: 0xe8e8ec, cues: [[3.7, 'heja']], subs: [[0.3, 2.5, $n('BONANSEA HAR KVITTERAT. 1-1...')], [4.2, 6.9, $n('ELLEN! PASSNING: JULIA. UDDAMÅLET - 2-1!')]], draw: matchShot({
    opp: LAG.juventus, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.35], night: true, ha: 1, hb: 1, mins: [88, 89], late: 88, d: 7, banner: [$t('CHAMPIONS LEAGUE - MATCH 3'), $t('KBK - JUVENTUS')],
    goal: SHOT('kbk', KBK.ellen, KBK.julia, 'skott', { tPass: 2.6, tShot: 3.3, tGoal: 3.65 }),
  }) },
  // FINALEN mot Barcelona (1/4): Ewa Pajor gör 0-1
  { d: 6, light: 0xa50044, cues: [[3.5, 'oj']], subs: [[4.0, 5.9, $n('PAJOR! BARCELONA LEDER 0-1.')]], draw: matchShot({
    opp: LAG.barca, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.4], night: true, ha: 0, hb: 0, mins: [14, 16], d: 6, banner: [$t('CHAMPIONS LEAGUE - FINAL'), $t('KBK - BARCELONA')],
    goal: SHOT('opp', LAG.barca.p[0], LAG.barca.p[1], 'skott'),
  }) },
  // (2/4): Alexia Putellas har gjort 1-2, Nina kvitterar 2-2 på passning från Ellen
  { d: 6, light: 0xa50044, cues: [[3.5, 'heja']], subs: [[0.3, 2.4, $n('MÄRTA 1-1, PUTELLAS 1-2...')], [4.0, 5.9, $n('NINA KVITTERAR! PASSNING: ELLEN. 2-2!')]], draw: matchShot({
    opp: LAG.barca, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.45], night: true, ha: 1, hb: 2, mins: [74, 76], d: 6,
    goal: SHOT('kbk', KBK.nina, KBK.ellen, 'skott'),
  }) },
  // (3/4): STRAFF till Barcelona – Aitana Bonmatí skjuter, Lily räddar
  { d: 9.6, light: 0x2aa35a, amb: 'publik', cues: [[0.6, 'oj'], [ST.hit + 0.1, 'heja'], [ST.hit + 1.8, 'heja']],
    sfx: [[2.3, 'vissla'], [ST.cutA, 'cutin'], [ST.cutB, 'cutin'], [ST.fly + 0.05, 'spark'], [ST.fly + 0.08, 'swoosh'], [ST.hit, 'boom'], [ST.hit + 0.03, 'mal']],
    subs: [[0.3, 2.3, $n('STRAFF TILL BARCELONA! BONMATI SKA SLÅ...')], [6.0, 9.4, $n('LILY RÄDDAR STRAFFEN! FORTFARANDE 2-2!')]], draw: straffShot({
      opp: LAG.barca, taker: LAG.barca.p[4], bg: 'varld', crowd: ['varld', 6, 28, 220, 0.45], night: true, ha: 2, hb: 2, mins: [84, 85], d: 9.6,
    }) },
  // (4/4): 90:e minuten – Julia gör 3-2 på passning från Alice G
  { d: 7, light: 0xa50044, cues: [[3.6, 'heja'], [5.6, 'heja']], subs: [[0.3, 2.4, $n('90 MINUTER SPELADE...')], [4.0, 6.9, $n('JULIA! PASSNING: ALICE G. 3-2 - SLUTSIGNAL!')]], draw: matchShot({
    opp: LAG.barca, bg: 'varld', crowd: ['varld', 6, 28, 220, 0.5], night: true, ha: 2, hb: 2, mins: [89, 90], late: 89, d: 7,
    goal: SHOT('kbk', KBK.julia, KBK.aliceG, 'skott', { tPass: 2.5, tShot: 3.2, tGoal: 3.55 }),
  }) },
  // Champions League-pokalen (den med de stora öronen) och fyrverkerierna
  { d: 7, light: 0xe8b230, amb: 'publik', sfx: [[0.7, 'pokal'], [1.0, 'mal'], [3.8, 'mal']], cues: [[1.2, 'heja'], [4.0, 'grat']], subs: [[1.0, 3.6, $n('KBK VINNER CHAMPIONS LEAGUE!')], [3.8, 6.9, $n('KUNGSLADUGÅRD - BÄST I VÄRLDEN!')]], draw: (c, u) => {
    c.drawImage(BGS.varld(), 0, 0);
    fyrverkeri(c, u);
    crowd(c, 'varld', 6, 28, 220, u, 1, 0.7);
    R(c, 64, 66, 112, 8, 0x3a2414); R(c, 64, 66, 112, 1, 0x7a5434); R(c, 64, 73, 112, 1, 0x1a0e08);
    for (let i = 0; i < 7; i++) person(c, 74 + i * 15, 60, MATES[i], 'down', Math.sin(u * 7 + i) > 0.3 ? 4 : 0);
    const sex = ['lily', 'marta', 'nina', 'julia', 'ellen', 'aliceG'];
    const lift = ease(clamp((u - 0.8) / 0.6, 0, 1)) * 12 + (u > 1.4 ? Math.abs(Math.sin(u * 3)) * 2 : 0);
    sex.forEach((k, i) => person(c, 85 + i * 14, 70, KBK[k], 'down', i === 3 ? 9 : Math.sin(u * 8 + i) > 0 ? 4 : 0));
    pokal(c, 127, 22 - lift, 1.4, Math.floor(u * 4) & 1, true);
    konfetti(c, u, 90, 96);
    blixtar(c, u);
  } },
  { d: 6, light: 0x1e2a5a, music: 'intro', draw: (c, u) => slut(c, u, [HUVUDROLLER, $t('OCH HELA KUNGSLADUGÅRD:'), ...LAGET_LISTA(RESTEN)], $t('KBK - BÄST I VÄRLDEN')) },
]);
