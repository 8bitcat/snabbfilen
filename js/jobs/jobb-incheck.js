// INCHECKNINGEN – jobbet bakom disk 3 i flygplatsens avgångshall. Resenärerna
// kommer fram ur kön en i taget med pass och biljett, och figuren går mellan
// skärmen på disken, lappskrivaren och vågen/bandet:
//   1) PASS  – liknar passfotot personen? Annars NEKA.
//   2) VIKT  – väskan på vågen: över 23 kg = ta ut AVGIFT eller be dem PACKA om,
//              över 32 kg får den inte följa med alls (packa om).
//   3) PLATS – fönster, gång, vilken som helst – eller tillsammans (barnfamiljer).
//   4) LAPP  – bagagelappen med rätt destinationskod (tavlan på väggen) på väskan.
//   5) BAND  – iväg på bandet; surfbrädor och hundburar till SPECIALBAGAGE.
//   6) KORT  – boardingkortet till resenären.
// Fel = avdrag. Stressade resenärer som är sena tränger sig före och ger upp om
// det tar för lång tid. Flygplatsen är öppen dygnet runt – nattpass fungerar.
//
// Scenen ses bakifrån disken: överst glasväggen ut mot plattan där plan landar,
// tankbilen tankar och ramppersonalen springer, sedan hallen med kön och
// stolarna, disken, gången där man själv står och längst fram uppsamlings-
// bandet. Allt statiskt målas EN gång per ljusläge; bara det som rör sig ritas
// varje bildruta. Ett pixelkorn: heltal, skala 1. Repliker = pratbubblor.
//
// Fyll-läget (main.js v.safe) beskär bilden: datorn tappar ~25 rader upptill,
// mobilen i NÄRA ~55 upptill och ~24 nertill, 4:3-paddan ~31 kolumner på var
// sida. Därför har scenen en kamera i hela spelpixlar (ingen skalning): den
// visar alltid det man jobbar med (skärmen, stationen, figuren, specialskåpet
// när det behövs, tavlan när lappen ska väljas) och i övrigt så mycket som
// möjligt av glasväggen. Är bandet väldigt lågt (mobilen) flyttas bakväggen
// med glaset närmare (DZ rader) så att planen som landar ändå syns ovanför
// skärmen. HUD, stegremsan och UTGÅNG ligger alltid innanför den synliga rutan.
//
// JOBBA IHOP: flera kan dela passet vid SAMMA disk (disk 4 bredvid är bara en smal
// kuliss utan lappskrivare, kortskrivare och specialskåp – och matarbandet stänger
// gången dit). Kön, resenären vid disken, vågen och banden är gemensamma, och arbetet
// delas: en CHECKAR IN vid skärmen (pass, vikt, plats och boardingkortet – resenären
// är låst åt den som tryckte GODKÄNN/NEKA) och en tar VÄSKORNA (lappen, bandet och
// specialskåpet). Ihop får väskan hanteras redan medan platsen väljs, så att båda
// har något att göra samtidigt (se "jobba tillsammans" nedan).
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from '../scenes/walkable.js';
import { makeShiftCoop } from '../net/coop.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { drawPerson, makeLook, FIRST_NAMES, GIRL_FIRST_NAMES, HAIR, SKIN, STYLES } from '../core/people.js';
import { play } from '../core/sound.js';
import { JOBS } from '../game.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
const WHITE = 0xffffff, INK = 0x17151a;
// flygbolaget SNABBFLYG: djupblått med gult
const AIR = 0x1f4f9a, AIR_L = 0x3a7ad8, AIR_D = 0x14345f, GOLD = 0xffd23a;

// ---------- scenens mått ----------
const GY0 = 20, GY1 = 66;                      // glasväggen (rader)
const WALL_X1 = 66;                             // vänstra väggpartiet med destinationstavlan
const MULLS = [66, 118, 170, 222, 274, 326, 378];
const HALL_Y = 72;                              // hallgolvet börjar
const TOP0 = 116, TOP1 = 126, BASE = 142;       // diskens skiva, front och golvlinje
const DESK = { x0: 36, x1: 250 };               // min disk
const NB = { x0: 295, x1: 384 };                // grannens disk (disk 4 – stängd på natten, precis som i terminalen)
const MON = { x: 60, y: 72, w: 72, h: 46 };     // skärmens ram
const SCR = { x: 64, y: 76, w: 64, h: 36 };     // själva skärmytan
const KNEE = [70, 126];                         // knäfacket under skärmen
const KIOSK = { x0: 137, x1: 169, top: 84, base: 121 }; // lappskrivaren står på disken
// specialskåpet står längst till vänster i diskens linje (framför glasskärmen) – så syns
// det i alla beskärningar utan att kameran behöver åka dit
const SPEC = { x0: 2, x1: 33, top: 116, base: 150 };
const SCALE = { x0: 252, x1: 282 };
const FEED = { x0: 254, x1: 281, y0: 127, y1: 188 };
const WDISP = { x: 254, y: 94, w: 27, h: 13 };  // vågens siffror (ovanför vågen)
const SEND = { x: 240, y: 127 };                // SKICKA-stolpen
const BPRN = { x: 176, y: 105, w: 24, h: 17 };  // boardingkortskrivaren på disken
const SCAN = { x: 203, y: 117 };                // passläsaren
const TERM = { x: 239, y: 109 };                // kortterminalen
const CB = { y0: 184, s0: 188, s1: 199, y1: 206 }; // uppsamlingsbandet
const TOTEM = { x0: 283, x1: 294 };
const DESK_P = { x: 228, y: 131 };              // resenären vid disken
const W0 = { x: 194, y: 98 };                   // VÄNTA HÄR – först i kön
const LANE_Y = 98, WALK_Y = 112;
const SPOT = { kiosk: [153, 152], bprn: [188, 152], disk: [96, 152], pass: [216, 152], vag: [236, 153], special: [46, 151] };
const SCALE_BAG = { x: 267, y: 121 };           // väskans mitt på vågen

const DEST = [
  { code: 'ARN', city: $t('STOCKHOLM'), say: $t('Stockholm'), c: 0x2c6fb7 },
  { code: 'GOT', city: $t('GÖTEBORG'), say: $t('Göteborg'), c: 0x2f8f46 },
  { code: 'CPH', city: $t('KÖPENHAMN'), say: $t('Köpenhamn'), c: 0xd9433b },
  { code: 'LHR', city: $t('LONDON'), say: $t('London'), c: 0x8e5bd1 },
  { code: 'BCN', city: $t('BARCELONA'), say: $t('Barcelona'), c: 0xe8b230 },
  { code: 'NYC', city: $t('NEW YORK'), say: $t('New York'), c: 0x2aa39a },
];
const STEPS = [
  { id: 'pass', n: $t('PASS'), hint: $t('KOLLA PASSFOTOT PÅ SKÄRMEN') },
  { id: 'vikt', n: $t('VIKT'), hint: $t('VIKTEN - OK, AVGIFT ELLER PACKA OM') },
  { id: 'plats', n: $t('PLATS'), hint: $t('VÄLJ PLATS PÅ SKÄRMEN') },
  { id: 'lapp', n: $t('LAPP'), hint: $t('SKRIV UT LAPPEN VID SKRIVAREN') },
  { id: 'band', n: $t('BAND'), hint: $t('SKICKA IVÄG VÄSKAN') },
  { id: 'kort', n: $t('KORT'), hint: $t('GE BOARDINGKORTET') },
];
const STEP_IX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));
const CASE_COLORS = [0x6a5030, 0x4a4a52, 0x2aa39a, 0x8e5bd1, 0x9a3a4a, 0x3a5a7c, 0xc8902a, 0x2e2e34, 0xd8d4cc, 0xc84a6a];
const SEAT_ROW0 = 14, SEAT_COLS = 'ABCDEF';
// tempot: vägningen, lappskrivaren, boardingkortet och ompackningen (sekunder)
const T_WEIGH = 0.6, T_PRINT = 0.5, T_CARD = 0.6, T_REPACK = 1.6;
// kameran: topplisten (shift.js) och stegremsan tar rader i den synliga rutan
const HUD_H = 18, STRIP_H = 11, DZ_MAX = 16;

// ======================= små målarverktyg =======================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (a) => a[(Math.random() * a.length) | 0];
const pickR = (R, a) => a[(R() * a.length) | 0];   // (samma, ur ett frö – se buildPassenger)
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
function rows(P, x, y, w, cs) { cs.forEach((c, i) => { if (c !== null) P.hl(x, y + i, w, c); }); }
function vcols(P, x, y, h, cs) { cs.forEach((c, i) => { if (c !== null) P.vl(x + i, y, h, c); }); }
// liten sprite ur teckenrader ('.' = genomskinligt) med halvgenomskinlig slagskugga
function stamp(P, x, y, rs, pal, shadow = 0.3) {
  const on = (i, j) => j >= 0 && j < rs.length && i >= 0 && i < rs[j].length && pal[rs[j][i]] !== undefined;
  if (shadow) for (let j = 0; j <= rs.length; j++) for (let i = 0; i <= rs[0].length; i++) if (!on(i, j) && on(i - 1, j - 1)) P.px(x + i, y + j, 0x1e1a16, shadow);
  for (let j = 0; j < rs.length; j++) for (let i = 0; i < rs[j].length; i++) { const c = pal[rs[j][i]]; if (c !== undefined) P.px(x + i, y + j, c); }
}
function reflect(P, x, y, w, h, str = 1, seed = 0, tint = 0xeef7ff) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, s = ((((X + seed) * 2 - Y * 3) % 61) + 61) % 61;
    let a = s < 4 ? 0.2 : s < 6 ? 0.1 : s === 12 || s === 13 ? 0.08 : 0;
    a += (1 - j / h) * 0.05;
    if (a > 0) P.px(X, Y, tint, a * str);
  }
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function pline(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
const fmtKg = (w) => w.toFixed(1).replace('.', ',');
// liten pil (3×5) – typsnittet saknar < och >
function arrow(ctx, x, y, dir, color) {
  ctx.fillStyle = color;
  for (let j = 0; j < 5; j++) { const n = 3 - Math.abs(j - 2); ctx.fillRect(dir > 0 ? x : x + 3 - n, y + j, n, 1); }
}

// ======================= väskorna =======================
// Liggande väska (på vågen och banden): hårt skal, mjuk resväska eller bag.
const CASE_SPR = new Map();
function caseSprite(body, style) {
  const key = body + ':' + style;
  let c = CASE_SPR.get(key);
  if (c) return c;
  const P = new Pix(22, 18), ox = 11, oy = 11;
  const hi = mix(body, WHITE, 0.3), lo = mul(body, 0.72), dk = mul(body, 0.55), line = mix(mul(body, 0.4), 0x1c1418, 0.45);
  const put = (x, y, col) => P.px(ox + x, oy + y, col);
  if (style === 0) {
    for (let y = -8; y <= 5; y++) for (let x = -10; x <= 9; x++) {
      const cx = x < -8 ? -8 - x : x > 7 ? x - 7 : 0, cy = y < -6 ? -6 - y : y > 3 ? y - 3 : 0;
      if (cx + cy > 2) continue;
      let col = x === -10 || x === 9 || y === -8 || y === 5 || cx + cy === 2 ? line : body;
      if (col === body) {
        if (y === -7 || x === -9) col = hi;
        else if (x === 8 || y === 4) col = lo;
        else if (x === -5 || x === -1 || x === 3) col = mix(body, WHITE, 0.16);
        else if (x === -4 || x === 0 || x === 4) col = mul(body, 0.84);
        col = jit(col, x, y, 3, 0.05);
      }
      put(x, y, col);
    }
    for (const x of [-4, 3]) { put(x, -9, 0x3a3e46); put(x, -10, 0x3a3e46); }
    for (let x = -4; x <= 3; x++) put(x, -11, x === -4 || x === 3 ? 0x3a3e46 : 0x5a6068);
    put(-9, 6, INK); put(-8, 6, 0x3a3e46); put(7, 6, 0x3a3e46); put(8, 6, INK);
  } else if (style === 1) {
    for (let y = -8; y <= 5; y++) for (let x = -10; x <= 9; x++) {
      if ((x === -10 || x === 9) && (y === -8 || y === 5)) continue;
      let col = x === -10 || x === 9 || y === -8 || y === 5 ? line : body;
      if (col === body) {
        if (y === -7) col = hi;
        else if (y === 4 || x === 8) col = lo;
        else if (y === -5) col = dk;
        else if (y > -3 && y < 3 && (x === -7 || x === 6)) col = dk;
        else if (y === 3 && x > -7 && x < 6) col = dk;
        col = jit(col, x, y, 4, 0.07);
      }
      put(x, y, col);
    }
    const strap = hash(body, 1, 7) > 0.5 ? 0x2a2c30 : 0xd8c8a0;
    for (const sx of [-5, 3]) for (let y = -8; y <= 5; y++) { put(sx, y, strap); put(sx + 1, y, mul(strap, 0.8)); }
    for (const sx of [-5, 3]) { put(sx, -2, 0xd8dce2); put(sx + 1, -2, 0x9aa0a8); }
    for (let x = -3; x <= 2; x++) put(x, -10, 0x2a2c30);
    put(-3, -9, 0x2a2c30); put(2, -9, 0x2a2c30);
    for (let x = -9; x <= 8; x += 2) put(x, -5, mix(dk, 0xd8dce2, 0.4));
  } else {
    for (let y = -6; y <= 5; y++) for (let x = -10; x <= 9; x++) {
      const ex = x < -5 ? (x + 5) : x > 4 ? (x - 4) : 0, ey = (y + 0.5) / 6.2;
      if (Math.hypot(ex / 5.6, ey) > 1 && ex !== 0) continue;
      const edge = Math.hypot(ex / 5.6, ey) > 0.84 && ex !== 0 || y === -6 || y === 5;
      let col = edge ? line : x < -5 || x > 4 ? mul(body, 0.8) : body;
      if (!edge) {
        if (y === -5) col = hi;
        else if (y === 4) col = lo;
        if (x === -5 || x === 4) col = dk;
        col = jit(col, x, y, 5, 0.06);
      }
      put(x, y, col);
    }
    for (let x = -4; x <= 3; x++) put(x, -4, x % 2 ? 0xd8dce2 : 0x8a9098);
    for (const hx of [-6, 1]) { put(hx, -7, 0x2a2c30); put(hx + 1, -8, 0x2a2c30); put(hx + 2, -8, 0x2a2c30); put(hx + 3, -7, 0x2a2c30); }
  }
  c = P.flush();
  CASE_SPR.set(key, c);
  return c;
}
// Stående väska bredvid resenären: dragväska med teleskophandtag, eller en bag i handen.
const ROLL_SPR = new Map();
function rollerSprite(body, style) {
  const key = body + ':' + style;
  let c = ROLL_SPR.get(key);
  if (c) return c;
  const hi = mix(body, WHITE, 0.3), lo = mul(body, 0.7), line = mix(mul(body, 0.4), 0x1c1418, 0.45);
  let P;
  if (style === 2) {
    // bag som bärs i handen (12×8)
    P = new Pix(12, 9);
    area(P, 0, 3, 12, 6, (X, Y, i, j) => {
      if ((i === 0 || i === 11) && (j === 0 || j === 5)) return null;
      if (i === 0 || i === 11 || j === 0 || j === 5) return line;
      return j === 1 ? hi : j === 4 ? lo : i === 3 || i === 8 ? mul(body, 0.6) : jit(body, X, Y, 9, 0.06);
    });
    P.hl(3, 0, 6, 0x2a2c30); P.px(2, 1, 0x2a2c30); P.px(9, 1, 0x2a2c30); P.px(2, 2, 0x2a2c30); P.px(9, 2, 0x2a2c30);
    for (let x = 3; x < 9; x += 2) P.px(x, 4, 0xd8dce2);
  } else {
    // dragväska (10×17): handtag rad 0–5, skal 6–15, hjul 16
    P = new Pix(10, 17);
    P.hl(2, 0, 6, 0x2a2c30); P.hl(3, 1, 4, 0x4a4e56);
    for (let y = 1; y < 6; y++) { P.px(2, y, 0x8a9098); P.px(7, y, 0x5a6068); }
    area(P, 0, 6, 10, 10, (X, Y, i, j) => {
      if ((i === 0 || i === 9) && (j === 0 || j === 9)) return null;
      if (i === 0 || i === 9 || j === 0 || j === 9) return line;
      let col = i === 1 ? hi : i === 8 ? lo : j === 1 ? mix(body, WHITE, 0.15) : body;
      if (style === 0 && (i === 3 || i === 6)) col = mix(col, WHITE, 0.14);
      if (style === 1 && j >= 4 && j <= 7 && i >= 2 && i <= 7) col = j === 4 ? mul(body, 0.62) : mul(body, 0.9);
      return jit(col, X, Y, 10, 0.06);
    });
    P.px(1, 16, INK); P.px(2, 16, 0x3a3e46); P.px(7, 16, 0x3a3e46); P.px(8, 16, INK);
  }
  c = P.flush();
  ROLL_SPR.set(key, c);
  return c;
}
// Bagagelappen på väskan: snöre + vit lapp med destinationens färg och kod.
const TAG_SPR = new Map();
function bagTag(di) {
  let c = TAG_SPR.get(di);
  if (c) return c;
  const d = DEST[di], P = new Pix(18, 9);
  P.px(0, 0, 0xd8dce2); P.px(1, 1, 0xd8dce2); P.px(2, 2, 0xd8dce2);
  P.rect(3, 1, 15, 8, 0x4a4e56);
  P.rect(4, 2, 13, 6, 0xfbfaf6);
  P.vl(4, 2, 6, d.c); P.vl(5, 2, 6, mix(d.c, WHITE, 0.3));
  P.hl(6, 7, 11, 0xd8d4ca);
  text(P, SMALL, d.code, 6, 2, INK);
  c = P.flush();
  TAG_SPR.set(di, c);
  return c;
}
// Remsan som rullar upp ur lappskrivaren: bokstäverna staplade, streckkod, färgband.
const STRIP_SPR = new Map();
function stripSprite(di) {
  let c = STRIP_SPR.get(di);
  if (c) return c;
  const d = DEST[di], P = new Pix(7, 26);
  area(P, 0, 0, 7, 26, (X, Y, i, j) => (i === 0 ? 0xe8e4da : i === 6 ? 0xc8c4ba : 0xfbfaf6));
  P.rect(1, 0, 5, 2, d.c);
  for (let k = 0; k < 3; k++) text(P, SMALL, d.code[k], 2, 3 + k * 6, INK);
  for (let y = 21; y < 25; y++) for (let x = 1; x < 6; x++) if (hash(x, di, 77) > 0.4) P.px(x, y, 0x2a2c30);
  c = P.flush();
  STRIP_SPR.set(di, c);
  return c;
}
// Små saker i handen: lappen, boardingkortet
let CARRY_ART = null;
function carryArt() {
  if (CARRY_ART) return CARRY_ART;
  const tag = new Pix(10, 7);
  area(tag, 0, 0, 10, 7, (X, Y, i, j) => (i === 0 || j === 0 ? 0xfbfaf6 : i === 9 || j === 6 ? 0xb8b4aa : 0xf0ece2));
  for (let x = 3; x < 9; x += 2) tag.vl(x, 2, 3, 0x2a2c30);
  tag.vl(1, 1, 5, 0xd9433b);
  const card = new Pix(12, 8);
  area(card, 0, 0, 12, 8, (X, Y, i, j) => (j < 2 ? (j === 0 ? AIR_L : AIR) : i === 11 || j === 7 ? 0xb8b4aa : 0xfbfaf6));
  card.px(1, 0, GOLD); card.px(2, 0, GOLD);
  card.hl(2, 3, 5, 0x6a6e76); card.hl(2, 5, 3, 0x9a9ea6);
  for (let x = 8; x < 11; x++) for (let y = 3; y < 7; y++) if ((x + y) % 2) card.px(x, y, 0x2a2c30);
  CARRY_ART = { tag: tag.flush(), card: card.flush() };
  return CARRY_ART;
}
// Surfbrädan: liggande (46×9) eller stående (9×46). Nos åt höger/uppåt.
const SURF_SPR = new Map();
function surfSprite(col, upright) {
  const key = col + ':' + upright;
  let c = SURF_SPR.get(key);
  if (c) return c;
  const L = 46, H = 9, P = upright ? new Pix(H, L) : new Pix(L, H);
  const put = (u, v, cc) => (upright ? P.px(v, L - 1 - u, cc) : P.px(u, v, cc));
  const half = (u) => (u < 3 ? 2 + u : u > 37 ? Math.max(0, Math.round(4.2 * Math.sqrt((45 - u) / 8))) : 4);
  for (let u = 0; u < L; u++) {
    const w = half(u);
    for (let v = 4 - w; v <= 4 + w; v++) {
      let cc = v === 4 - w || v === 4 + w || u === 0 ? 0x3a3a40 : v === 5 - w ? 0xffffff : v === 3 + w ? 0xd8d2c0 : 0xf6f2e6;
      if (cc === 0xf6f2e6 || cc === 0xffffff) {
        if (v === 4) cc = 0xa8784a;                            // listen i mitten
        else if ((u > 9 && u < 30) && (v === 2 || v === 6)) cc = col;
        else if (u > 12 && u < 22 && (v === 3 || v === 5) && hash(u, v, 5) > 0.5) cc = mix(col, WHITE, 0.4);
        if (hash(u, v, 6) > 0.93) cc = mix(cc, 0xd8c890, 0.4);  // vaxet
      }
      put(u, v, cc);
    }
  }
  if (!upright) for (const [u, v] of [[3, 8], [4, 8], [5, 8], [4, 9 - 1]]) put(u, v, 0x2a2c30);
  put(1, 4, 0x2a6ad0); put(2, 4, 0x2a6ad0);                      // koppelfästet
  c = P.flush();
  SURF_SPR.set(key, c);
  return c;
}
// Hundburen: plastbur med galler framtill och en hund som tittar ut. frame 0/1.
const CAGE_SPR = new Map();
function cageSprite(fur, frame) {
  const key = fur + ':' + frame;
  let c = CAGE_SPR.get(key);
  if (c) return c;
  const P = new Pix(20, 15);
  // handtaget
  P.hl(7, 0, 6, 0x5a6068); P.px(6, 1, 0x5a6068); P.px(13, 1, 0x5a6068);
  // övre skalet (ljust) med ventilationsspringor, nedre skalet (grått)
  area(P, 0, 2, 20, 12, (X, Y, i, j) => {
    if ((i === 0 || i === 19) && (j === 0 || j === 11)) return null;
    if (i === 0 || i === 19 || j === 0 || j === 11) return 0x3a3e46;
    if (j < 6) {
      let cc = j === 1 ? 0xfaf6ec : i === 18 ? 0xc8c0aa : 0xe8e0cc;
      if (j === 3 && (i < 5 || i > 14) && i % 2 === 1) cc = 0x6a6450;
      return cc;
    }
    if (j === 6) return 0x9aa0a8;
    return j === 10 ? 0x4a5260 : i === 18 ? 0x5a6474 : 0x6e7888;
  });
  for (const bx of [2, 17]) P.px(bx, 8, 0xd8dce2);
  // dörren: hunden bakom gallret
  const d = { x: 5, y: 4, w: 10, h: 8 };
  P.rect(d.x, d.y, d.w, d.h, 0x1e1a18);
  const fd = mul(fur, 0.7), fl = mix(fur, WHITE, 0.3);
  area(P, d.x + 1, d.y + 1, 8, 7, (X, Y, i, j) => {
    if (j === 0 && (i === 0 || i === 7)) return null;
    if ((i === 0 || i === 7) && j < 5) return fd;               // öronen
    if (i >= 2 && i <= 5 && j >= 4) return j === 6 && i >= 3 && i <= 4 ? (frame ? 0xe86a7a : 0xf4ecdc) : fl; // nosparti
    return fur;
  });
  P.px(d.x + 3, d.y + 3, INK); P.px(d.x + 6, d.y + 3, INK);     // ögonen
  P.px(d.x + 3, d.y + 2, frame ? fur : fl);
  P.rect(d.x + 4, d.y + 5, 2, 1, INK);                          // nosen
  if (frame) P.px(d.x + 4, d.y + 7, 0xe86a7a);                   // tungan
  for (let x = d.x; x < d.x + d.w; x += 2) P.vl(x, d.y, d.h, 0xc8ced4);
  P.box(d.x - 1, d.y - 1, d.w + 2, d.h + 2, 0x8a9098);
  P.hl(1, 14, 18, 0x1a1418);
  c = P.flush();
  CAGE_SPR.set(key, c);
  return c;
}
// Passet (uppslaget) och biljetten på disken
let DOCS_ART = null;
function docsArt() {
  if (DOCS_ART) return DOCS_ART;
  const pass = new Pix(12, 8);
  area(pass, 0, 0, 12, 8, (X, Y, i, j) => (i === 0 || i === 11 || j === 7 ? 0x6a1a26 : i === 5 || i === 6 ? 0xd8d0c0 : 0xf4efe2));
  pass.rect(1, 1, 3, 4, 0x8a9aa8); pass.px(2, 2, 0xe0b090); pass.px(2, 1, 0x3a2a20);
  pass.hl(7, 2, 3, 0x9a9ca2); pass.hl(7, 4, 3, 0x9a9ca2); pass.hl(1, 6, 4, 0xb8b0a0); pass.hl(7, 6, 3, 0xb8b0a0);
  const tick = new Pix(9, 6);
  area(tick, 0, 0, 9, 6, (X, Y, i, j) => (j === 0 ? AIR : i === 8 || j === 5 ? 0xc8c4ba : 0xfbfaf6));
  tick.hl(1, 2, 5, 0x6a6e76); tick.hl(1, 4, 3, 0x9a9ea6); tick.rect(6, 3, 2, 2, 0x2a2c30);
  DOCS_ART = { pass: pass.flush(), tick: tick.flush() };
  return DOCS_ART;
}

// ======================= passfotot =======================
// Huvudet ur personens egen sprite, 1:1 (samma pixelkorn som figuren själv).
const PHOTO = new WeakMap();
function photoOf(look) {
  let c = PHOTO.get(look);
  if (c) return c;
  const s = mkCanvas(24, 40), x = s.getContext('2d');
  drawPerson(x, 12, 39, look, 'down', 0);
  c = mkCanvas(12, 15);
  const top = look.kid ? 10 : 3;
  c.getContext('2d').drawImage(s, 6, top, 12, 15, 0, 0, 12, 15);
  PHOTO.set(look, c);
  return c;
}
// Någon annans pass: annat hår, ofta andra glasögon/skägg/hy – tydligt fel på nära håll.
const hexN = (h) => parseInt(h.slice(1), 16);
const cdist = (a, b) => { const A = hexN(a), B = hexN(b); return Math.abs((A >> 16) - (B >> 16)) + Math.abs(((A >> 8) & 255) - ((B >> 8) & 255)) + Math.abs((A & 255) - (B & 255)); };
function fakeOf(look, R = Math.random) {
  const f = { ...look };
  const far = HAIR.filter((h) => cdist(h, look.hair) > 150);
  f.hair = far.length ? pickR(R, far) : '#ecd489';
  const st = STYLES.filter((s) => s !== look.style && s !== 'bald');
  f.style = pickR(R, st);
  if (R() < 0.55) f.glasses = look.glasses ? false : pickR(R, ['square', 'round']);
  if (!look.kid && R() < 0.5) f.beard = look.beard ? false : pickR(R, ['full', 'mustache']);
  if (R() < 0.5) { const sk = SKIN.filter((s) => cdist(s, look.skin) > 90); if (sk.length) f.skin = pickR(R, sk); }
  f.hat = null;
  return f;
}

// ======================= flygplanen =======================
const LIVERY = [0x1f4f9a, 0xd8303a, 0x1e8a7a, 0xe07a1e, 0x6a3aa8];
// Litet plan långt bort på rullbanan (36×12). dir -1 = flyger åt vänster. gear = hjulen ute.
const SMALL_PL = new Map();
function smallPlane(liv, dir, night, gear) {
  const key = liv + ':' + dir + ':' + night + ':' + gear;
  let c = SMALL_PL.get(key);
  if (c) return c;
  const L = 36, P = new Pix(L, 12), lv = LIVERY[liv];
  const put = (u, y, col, a = 1) => P.px(dir > 0 ? u : L - 1 - u, y, col, a);
  const body = night ? 0x9aa2b4 : 0xf2f4f6, belly = night ? 0x6a7282 : 0xc4c8ce, line = night ? 0x3a4250 : 0x6a7078;
  for (let y = 0; y <= 5; y++) { const u0 = 1 + (y >> 2), u1 = 2 + y; for (let u = u0; u <= u1; u++) put(u, y, night ? mul(lv, 0.7) : u === u1 ? mix(lv, WHITE, 0.3) : lv); }
  put(3, 2, night ? 0xb8b0a0 : GOLD);
  for (let u = 0; u < 6; u++) put(u, 6, u < 5 ? 0x9aa0a8 : 0x6a7078);
  const prof = [[5, 7, 32], [6, 4, 34], [7, 3, 35], [8, 5, 34], [9, 8, 31]];
  for (const [y, u0, u1] of prof) for (let u = u0; u <= u1; u++) {
    let col = y === 5 ? mix(body, WHITE, 0.5) : y === 8 ? belly : y === 9 ? line : body;
    if (y === 8 && u > 8 && u < 30) col = night ? mul(lv, 0.8) : lv;
    put(u, y, col);
  }
  for (let u = 10; u <= 29; u += 2) put(u, 6, night ? 0xffe6a0 : 0x2a3440);
  put(32, 6, 0x1e2630); put(33, 6, 0x1e2630);
  for (let u = 13; u <= 22; u++) put(u, 8, 0x8a9098);
  for (let u = 16; u <= 20; u++) { put(u, 9, u === 20 ? 0x9aa0a8 : 0xc8ccd2); put(u, 10, 0x6a7078); }
  if (gear) { put(17, 11, INK); put(18, 11, INK); put(30, 10, 0x5a6068); put(30, 11, INK); }
  c = P.flush();
  SMALL_PL.set(key, c);
  return c;
}
// Det stora planet vid gaten (108×27), nosen åt vänster mot bryggan.
const BIG_PL = { x: 168, y: 38, L: 108, H: 27 };
function paintBigPlane(P, night) {
  const { x: X0, y: Y0, L } = BIG_PL;
  const put = (u, y, col, a = 1) => P.px(X0 + (L - 1 - u), Y0 + y, col, a);
  const body = night ? 0xa4acbc : 0xf4f6f8, belly = night ? 0x7a8292 : 0xcdd1d6, line = night ? 0x3a4250 : 0x6a7078;
  const top = (u) => (u < 16 ? 10 + Math.round((16 - u) * 0.12) : u > 92 ? 10 + Math.round(((u - 92) / 15) ** 2 * 5) : 10);
  const bot = (u) => (u < 18 ? 20 - Math.round(((18 - u) / 18) ** 1.2 * 7) : u > 94 ? 20 - Math.round(((u - 94) / 13) ** 1.5 * 4) : 20);
  // markskugga
  for (let u = 6; u < L - 4; u++) put(u, 26, 0x1a1418, u < 20 || u > 96 ? 0.14 : 0.28);
  // stjärtfenan med loggan
  for (let y = 0; y <= 10; y++) {
    const u0 = 2 + Math.round((10 - y) * 0.25), u1 = 19 - Math.round((10 - y) * 1.05);
    for (let u = u0; u <= u1; u++) {
      let col = u === u1 ? mix(AIR, WHITE, 0.35) : y === 0 ? mix(AIR, WHITE, 0.2) : u === u0 ? mul(AIR, 0.7) : AIR;
      if (night) col = mul(col, 0.7);
      put(u, y, col);
    }
  }
  stamp(P, X0 + L - 1 - 13, Y0 + 2, ['.###', '#...', '.##.', '...#', '###.'], { '#': night ? 0xb8a060 : GOLD }, 0);
  // höjdrodret
  for (let u = 0; u < 15; u++) { put(u, 13, u < 12 ? 0xb8bec6 : 0x8a9098); if (u > 2 && u < 12) put(u, 14, 0x6a7078); }
  // kroppen
  for (let u = 0; u < L; u++) {
    const t0 = top(u), b0 = bot(u);
    for (let y = t0; y <= b0; y++) {
      let col = y === t0 ? mix(body, WHITE, 0.6) : y >= b0 - 1 ? belly : body;
      if (y === b0) col = line;
      if (y === 18 && u > 14 && u < 96) col = night ? mul(AIR, 0.8) : AIR;          // magstrecket
      if (y === 17 && u > 16 && u < 94) col = night ? mul(GOLD, 0.6) : GOLD;
      if (y === 19 && u > 18 && u < 92) col = mul(belly, 0.94);
      put(u, y, col);
    }
  }
  // namnet
  const nm = $t('SNABBFLYG'), nx = X0 + L - 1 - 88;
  text(P, SMALL, nm, nx, Y0 + 11, night ? mul(AIR, 0.9) : AIR);
  // fönster, dörrar, cockpit
  for (let u = 20; u < 90; u += 3) if (u < 82 && !(u > 18 && u < 25)) put(u, 15, night ? 0xffe6a0 : 0x2a3440);
  for (const du of [20, 84]) { for (let y = 11; y <= 17; y++) { put(du, y, line); put(du + 3, y, line); } put(du + 1, 11, line); put(du + 2, 11, line); }
  for (let u = 98; u <= 103; u++) put(u, 12, 0x1e2630);
  put(99, 13, 0x1e2630); put(100, 13, 0x1e2630); put(98, 12, night ? 0x9ab0d0 : 0x6a8aa8);
  // lastlucka fram
  for (let u = 72; u <= 78; u++) put(u, 19, line);
  // vingen + motorn
  for (let u = 42; u <= 68; u++) { put(u, 20, 0x8a9098); if (u > 45 && u < 66) put(u, 21, 0x5a6068); }
  for (let u = 46; u <= 64; u++) {
    const cs = [0xeef0f2, 0xd8dce2, 0xc0c6cc, 0xa8aeb6, 0x7a8088];
    for (let j = 0; j < 5; j++) put(u, 21 + j, u === 64 ? (j === 0 || j === 4 ? 0x5a6068 : 0x2a2c30) : u === 63 ? 0xd8dce2 : u === 46 ? 0x4a4e56 : night ? mul(cs[j], 0.72) : cs[j]);
  }
  for (let u = 50; u <= 60; u++) put(u, 22, night ? 0x6a7078 : 0xf8fafc);
  // landningsställ
  for (let y = 21; y <= 24; y++) put(96, y, 0x5a6068);
  for (const u of [95, 96, 97]) { put(u, 25, INK); }
  for (let y = 22; y <= 24; y++) put(40, y, 0x5a6068);
  for (const u of [37, 38, 39, 41, 42, 43]) { put(u, 25, 0x1a1a1e); put(u, 24, u === 38 || u === 42 ? 0x5a5a60 : 0x1a1a1e); }
}

// ======================= utsikten: plattan =======================
const VIEW = {
  dag: { top: 0x5a98d8, hor: 0xd2eaf6, cloud: 0xffffff, hill: 0x8aa2b0, tree: 0x4a6a58, grass: 0x7aa05a, runway: 0x5e6064, twy: 0x76787c, apron: [0xa6a8a4, 0xc2c4c0], line: 0xe8c030, far: 0xd0d4d8, pole: 0x6a7078 },
  skymning: { top: 0x3a3c7a, hor: 0xf4a878, cloud: 0xffb898, hill: 0x6a5a7a, tree: 0x2e2a3a, grass: 0x4a5238, runway: 0x44444e, twy: 0x505060, apron: [0x747078, 0x86828a], line: 0xc8a030, far: 0x9a8a98, pole: 0x3a3a44 },
  natt: { top: 0x080e2a, hor: 0x283260, cloud: 0x3a4470, hill: 0x1c2242, tree: 0x0c101c, grass: 0x141e14, runway: 0x22242c, twy: 0x2a2c36, apron: [0x383c48, 0x484c58], line: 0xa89030, far: 0x4a5064, pole: 0x2a2e36 },
};
function viewMode(h) { return h >= 20.5 || h < 6 ? 'natt' : h >= 18 ? 'skymning' : 'dag'; }
const RWY = 37, TWY = 43;                        // rullbanan och taxibanan (rader)

function paintView(P, mode) {
  const V = VIEW[mode], night = mode === 'natt', dusk = mode === 'skymning';
  const x0 = WALL_X1, w = FW - x0;
  area(P, x0, GY0, w, 17, (X, Y) => qmix(V.top, V.hor, (Y - GY0) / 17, X, Y, 5));
  if (night) {
    for (let y = GY0; y < GY0 + 14; y++) for (let x = x0; x < FW; x++) if (hash(x, y, 31) > 0.986) P.px(x, y, 0xffffff, 0.35 + hash(x, y, 32) * 0.55);
    P.ell(128, 25, 3, 3, 0xf4f0d8, 0.95, 3); P.px(127, 24, 0xffffff); P.px(129, 26, 0xd8d4bc);
  } else {
    if (dusk) { P.ell(300, 35, 9, 5, 0xffe0a0, 0.8, 4); P.ell(300, 35, 24, 7, 0xffb070, 0.35, 4); }
    for (let k = 0; k < 7; k++) {
      const cx = x0 + 24 + k * 48 + Math.round(hash(k, 0, 33) * 20), cy = GY0 + 3 + Math.round(hash(k, 1, 33) * 5);
      const rx = 7 + hash(k, 2, 33) * 9;
      P.ell(cx, cy, rx, 2.4, V.cloud, 0.8, 3);
      P.ell(cx - rx * 0.3, cy - 1, rx * 0.5, 2, V.cloud, 0.7, 3);
      for (let x = Math.round(cx - rx * 0.8); x < cx + rx * 0.8; x++) P.px(x, Math.round(cy + 2), mix(V.cloud, V.hor, 0.4), 0.5);
    }
  }
  // kullar, skogsrand och byggnader långt bort
  for (let x = x0; x < FW; x++) {
    const hy = 30 + Math.round(Math.sin(x * 0.045) * 1.3 + Math.sin(x * 0.12 + 2) * 0.8);
    for (let y = hy; y < 35; y++) P.px(x, y, V.hill);
    const ty = 33 - (hash(x >> 1, 0, 34) > 0.55 ? 1 : 0) - (hash(x >> 2, 1, 34) > 0.8 ? 1 : 0);
    for (let y = ty; y < 35; y++) P.px(x, y, y === ty ? mix(V.tree, V.hill, 0.3) : V.tree);
  }
  // hangarer med välvda tak
  for (const [hx0, hw] of [[84, 44], [132, 26]]) for (let x = hx0; x < hx0 + hw; x++) {
    const u = (x - hx0 - hw / 2) / (hw / 2), ty = 28 + Math.round(u * u * 3);
    for (let y = ty; y < 36; y++) {
      let c = y === ty ? mix(V.far, WHITE, 0.3) : V.far;
      if (y > 30 && x > hx0 + 4 && x < hx0 + hw - 4) c = (x - hx0) % 5 === 0 ? mul(V.far, 0.72) : mul(V.far, 0.86);
      P.px(x, y, c);
    }
  }
  if (night) for (let x = 90; x < 124; x += 5) P.px(x, 31, 0xffe8a0, 0.7);
  // radarmasten (skålen snurrar – ritas levande)
  vcols(P, 358, 27, 9, [mix(V.far, WHITE, 0.2), mul(V.far, 0.7)]);
  for (let k = 0; k < 4; k++) P.px(356 + k, 34 - k * 2, mul(V.far, 0.8));
  // bränsledepån
  for (const [tx, tw] of [[300, 10], [312, 7]]) {
    area(P, tx, 31, tw, 5, (X, Y, i, j) => (j === 0 ? mix(V.far, WHITE, 0.4) : i === tw - 1 ? mul(V.far, 0.7) : V.far));
    P.hl(tx, 33, tw, mul(V.far, 0.85));
  }
  // gräs, rullbana, gräs, taxibana
  P.hl(x0, 35, w, V.grass); P.hl(x0, 36, w, mul(V.grass, 0.92));
  P.hl(x0, RWY, w, mix(V.runway, WHITE, night ? 0.1 : 0.45));
  for (let k = 1; k <= 3; k++) P.hl(x0, RWY + k, w, V.runway);
  P.hl(x0, RWY + 4, w, mix(V.runway, WHITE, night ? 0.08 : 0.35));
  for (let x = x0; x < FW; x++) if (x % 12 < 5) P.px(x, RWY + 2, night ? 0x6a6a60 : 0xe8ecf0, 0.85);
  // tröskeln (pianotangenter) längst till höger
  for (let x = 346; x < 362; x += 2) for (let k = 1; k <= 3; k++) P.px(x, RWY + k, night ? 0x3e3e46 : 0xf4f6f8);
  P.hl(x0, 42, w, V.grass);
  P.hl(x0, TWY, w, V.twy); P.hl(x0, TWY + 1, w, V.twy);
  for (let x = x0; x < FW; x++) if (x % 3 !== 2) P.px(x, TWY, V.line, 0.8);
  P.hl(x0, TWY + 2, w, mul(V.grass, 0.85));
  if (night) {
    for (let x = x0 + 3; x < FW; x += 8) { P.px(x, RWY, 0xfff4d0); P.px(x + 4, RWY + 3, 0xfff4d0, 0.8); }
    for (let x = x0 + 6; x < FW; x += 14) { P.px(x, TWY - 1, 0x5a8aff); P.px(x + 7, TWY + 2, 0x5a8aff, 0.8); }
    for (let x = 364; x < FW; x += 3) P.px(x, RWY + 1, 0xff5a4a, 0.6);
  }
  // plattan: betong med fogar, oljefläckar, ledlinjer till uppställningsplatserna
  area(P, x0, 46, w, GY1 - 46, (X, Y) => {
    let c = qmix(V.apron[0], V.apron[1], (Y - 46) / 20, X, Y, 3);
    if (Y === 52 || Y === 59 || (X - x0) % 22 === 0) c = mul(c, 0.91);
    else if (Y === 53 || Y === 60 || (X - x0) % 22 === 1) c = mix(c, WHITE, 0.05);
    return jit(c, X, Y, 35, 0.05);
  });
  for (let k = 0; k < 8; k++) P.ell(x0 + 14 + k * 42 + hash(k, 3, 36) * 18, 52 + hash(k, 5, 36) * 10, 4 + hash(k, 4, 36) * 5, 1.2, 0x2a2a30, 0.2, 3);
  const yl = V.line;
  // ledlinjer: taxibanan → under nosen på plats 12 och 13, stopplinjer
  for (const [sx, ex] of [[138, 172], [298, 332]]) {
    for (let i = 0; i <= 22; i++) { const u = i / 22; P.px(Math.round(sx + u * (ex - sx)), Math.round(45 + Math.sin(u * 1.57) * 16), yl); }
    P.hl(ex - 6, 62, 12, yl); P.hl(ex - 6, 63, 12, mul(yl, 0.7));
  }
  // platsnummer målade på betongen
  for (const [nx, s] of [[178, '12'], [340, '13']]) { P.rect(nx - 1, 55, 10, 7, yl); text(P, SMALL, s, nx + 1, 56, mul(yl, 0.25)); }
  // servicevägen närmast huset och röd säkerhetslinje runt uppställningsplatsen
  for (let x = x0; x < FW; x++) { if (x % 6 < 3) P.px(x, 64, night ? 0x8a8a80 : 0xeef0f2, 0.75); }
  for (let x = 120; x < 290; x++) if (x % 4 < 2) P.px(x, 50, night ? 0x8a3030 : 0xd8303a, 0.6);
  // strålkastarmaster
  for (const mx of [150, 318]) {
    P.vl(mx, GY0 + 3, GY1 - GY0 - 3, V.pole); P.vl(mx + 1, GY0 + 3, GY1 - GY0 - 3, mul(V.pole, 0.7));
    for (let y = GY0 + 8; y < GY1; y += 6) P.px(mx, y, mul(V.pole, 0.8));
    P.rect(mx - 3, GY0 + 1, 8, 3, night ? 0xfff0c0 : 0x5a6068);
    P.hl(mx - 3, GY0 + 4, 8, 0x3a3e46);
    if (night) P.ell(mx + 1, 58, 30, 6, 0xfff0c0, 0.24, 4);
  }
  // koner, en bagagevagn med containrar och ett kraftaggregat vid plats 13
  for (const cx of [292, 370, 378]) { P.px(cx, 61, 0xf07a1e); P.px(cx, 60, 0xffb070); P.hl(cx - 1, 62, 3, 0xd8601a); }
  for (let k = 0; k < 2; k++) {
    const cx = 352 + k * 11;
    area(P, cx, 53, 9, 7, (X, Y, i, j) => (j === 0 ? 0xd8dce2 : i === 8 ? 0x6a7078 : i === 0 ? 0xc8ced4 : night ? 0x6a7078 : 0xaab0b8));
    P.vl(cx + 4, 54, 5, 0x8a9098);
    P.hl(cx, 60, 9, 0x3a3e46); P.px(cx + 1, 61, INK); P.px(cx + 7, 61, INK);
  }
  area(P, 300, 55, 11, 7, (X, Y, i, j) => (j === 0 ? 0xf8e070 : i === 10 || j === 6 ? 0x8a6a10 : night ? 0x8a7a30 : 0xe8c030));
  P.rect(302, 57, 3, 2, 0x2a2c30); P.px(303, 62, INK); P.px(308, 62, INK);
}
// Det som står framför de rullande planen: bryggan, planet vid gaten, bandlastarna.
function paintApronFront(P, mode) {
  const night = mode === 'natt';
  paintBigPlane(P, night);
  // passagerarbryggan från huset till främre dörren
  const by0 = 47, by1 = 54, bx1 = 187;
  area(P, WALL_X1, by0, bx1 - WALL_X1, by1 - by0, (X, Y, i, j) => {
    if (j === 0) return night ? 0x8a90a0 : 0xe8ecf0;
    if (j === by1 - by0 - 1) return night ? 0x2a2e38 : 0x6a7078;
    let c = night ? 0x5a6070 : 0xc8ccd2;
    if (X % 5 === 0) c = mul(c, 0.86);
    if (j === 1) c = mix(c, WHITE, 0.2);
    if ((j === 2 || j === 3) && (X - WALL_X1) % 24 > 18 && (X - WALL_X1) % 24 < 22) c = night ? 0xffe6a0 : 0x4a6a8a;
    if (j === 5) c = mul(c, 0.8);
    return c;
  });
  text(P, SMALL, $t('SNABBFLYG'), 96, by0 + 1, night ? 0x3a5a9a : AIR, 0.9);
  // kabinen och bälgen mot dörren
  area(P, bx1 - 12, by0 - 1, 12, by1 - by0 + 2, (X, Y, i, j) => (i === 11 ? 0x2a2c30 : j === 0 ? (night ? 0x9aa0b0 : 0xf4f6f8) : i > 8 ? 0x3a3c42 : night ? 0x6a7080 : 0xd8dce2));
  P.rect(bx1 - 10, by0 + 2, 5, 3, night ? 0xffe6a0 : 0x3a5a7a);
  // stödbenet med drivhjulen
  P.vl(150, by1, 9, 0x5a6068); P.vl(151, by1, 9, 0x3a3e46);
  P.rect(146, 62, 10, 2, 0x3a3e46); for (const wx of [147, 148, 153, 154]) P.px(wx, 64, INK);
  // rotundan vid huset
  area(P, WALL_X1, by0 - 3, 8, 14, (X, Y, i, j) => (i === 0 ? 0xf0f2f4 : i === 7 ? 0x5a6068 : night ? 0x6a7080 : 0xb8bec6));
  P.vl(WALL_X1 + 3, by0 + 11, 8, 0x6a7078);
  // bandlastare vid främre och bakre lastluckan, en väska på väg upp
  for (const [lx, ly] of [[199, 58], [244, 58]]) {
    P.line(lx + 10, 64, lx, ly, 0x3a3e46); P.line(lx + 11, 64, lx + 1, ly, 0x5a6068); P.line(lx + 11, 63, lx + 2, ly, 0x2a2c30);
    area(P, lx + 6, 61, 12, 3, (X, Y, i, j) => (j === 0 ? 0xf0c020 : 0xa88010));
    P.px(lx + 7, 64, INK); P.px(lx + 15, 64, INK);
  }
  area(P, 203, 59, 4, 3, (X, Y, i, j) => (j === 0 ? 0x6a5030 : 0x4a3a20));
  // bagagetåg parkerat vid bakre lastluckan
  for (let k = 0; k < 2; k++) {
    const cx = 258 + k * 11;
    area(P, cx, 58, 9, 5, (X, Y, i, j) => (j === 0 ? 0xd8dce2 : i === 0 || i === 8 ? 0x6a7078 : null));
    P.rect(cx + 1, 59, 3, 3, [0x6a5030, 0x2c6fb7][k]); P.rect(cx + 5, 60, 3, 2, [0xd8303a, 0x4a4a52][k]);
    P.hl(cx, 63, 9, 0x3a3e46); P.px(cx + 1, 64, INK); P.px(cx + 7, 64, INK);
  }
  // en kon vid nosen
  P.px(172, 62, 0xf07a1e); P.px(172, 61, 0xffb070); P.hl(171, 63, 3, 0xd8601a);
}

// ======================= hallen (bakgrunden) =======================
function paintBack(mode) {
  const P = new Pix(FW, FH), night = mode === 'natt';
  // taket (mest under topplisten)
  area(P, 0, 0, FW, 18, (X, Y) => {
    let c = jit(0xe4e6ea, X, Y, 40, 0.04);
    if (Y % 6 === 0 || X % 32 === 0) c = 0xc8ccd2;
    if ((Y === 9 || Y === 10) && X % 64 > 12 && X % 64 < 50) c = Y === 9 ? 0xffffff : 0xf0f4fa;
    return c;
  });
  rows(P, 0, 17, FW, [0xb8bec6, 0x5a6068, 0x3a3e46]);
  // utsikten genom glaset
  paintView(P, mode);
  // vänstra väggpartiet: stenplattor och destinationstavlan
  area(P, 0, 20, WALL_X1, HALL_Y - 20, (X, Y) => {
    const r = Math.floor((Y - 20) / 12), c0 = Math.floor((X + (r & 1) * 11) / 22);
    let c = mix(0xcfc8ba, hash(c0, r, 50) > 0.5 ? 0xd8d2c6 : 0xc4bdb0, 0.5);
    if ((Y - 20) % 12 === 11 || (X + (r & 1) * 11) % 22 === 21) c = mul(c, 0.84);
    else if ((Y - 20) % 12 === 0) c = mix(c, WHITE, 0.12);
    return jit(c, X, Y, 51, 0.05);
  });
  P.vl(WALL_X1 - 1, 20, HALL_Y - 20, 0x8a8478);
  paintBoard(P, night);
  // bröstningen under glaset: fönsterbänk och golvkonvektorn
  rows(P, WALL_X1, GY1, FW - WALL_X1, [0xf4f6f8, 0xc8ced4, 0xa8aeb6, 0x7a8088]);
  area(P, 0, 70, FW, 2, (X, Y, i, j) => (j === 0 ? 0x3a3e46 : X % 3 === 0 ? 0x2a2c30 : 0x5a6068));
  // golvet: ljus kalksten i stora plattor, fönsterspeglingar
  area(P, 0, HALL_Y, FW, BASE - HALL_Y + 1, (X, Y) => {
    const ty = Y - HALL_Y, r = Math.floor(ty / 12), ry = ty - r * 12;
    const xx = X + (r & 1) * 16, c0 = Math.floor(xx / 32), rx = xx - c0 * 32;
    let c = mix(0xdcd6ca, hash(c0, r, 11) > 0.5 ? 0xe4dfd4 : 0xd2ccbf, 0.5 + (hash(c0, r, 12) - 0.5) * 0.5);
    c = mix(c, 0xb8b2a6, clamp((78 - Y) / 10, 0, 1) * 0.5);
    if (ry === 11 || rx === 31) c = mul(c, 0.88);
    else if (ry === 0 || rx === 0) c = mix(c, WHITE, 0.12);
    const h = hash(X, Y, 13);
    if (h > 0.95) c = mix(c, h > 0.985 ? 0x6a665e : WHITE, 0.3);
    return jit(c, X, Y, 14, 0.03);
  });
  for (let k = 0; k < MULLS.length - 1; k++) {
    const pc = MULLS[k] + 26;
    for (let y = HALL_Y + 1; y < HALL_Y + 34; y++) {
      const tt = (y - HALL_Y) / 34;
      for (let x = pc - 18; x < pc + 18; x++) if (bayer(x, y) < (1 - tt) * 0.5) P.px(x, y, night ? 0x6a7aa8 : 0xfbfdff, night ? 0.12 : 0.16);
    }
  }
  if (!night) for (let k = 0; k < MULLS.length - 1; k++) {
    // solkatter snett in genom glaset
    const x0 = MULLS[k] + 8;
    for (let y = HALL_Y + 2; y < HALL_Y + 16; y++) for (let x = x0 + (y - HALL_Y) * 2; x < x0 + (y - HALL_Y) * 2 + 20; x++) if (x < FW && bayer(x, y) < 0.35) P.px(x, y, 0xfff6dc, 0.2);
  }
  // personalgången bakom diskarna: grå vinylmatta med ljusa korn, skarvar och slitage
  area(P, 0, BASE, FW, CB.y0 - BASE, (X, Y) => {
    const ty = Y - BASE, r = Math.floor(ty / 14), xx = X + (r & 1) * 20, c0 = Math.floor(xx / 40);
    let c = mix(0x5e6674, hash(c0, r, 80) > 0.5 ? 0x656d7b : 0x58606e, 0.5);
    if (ty % 14 === 13 || xx % 40 === 39) c = mul(c, 0.84);
    else if (ty % 14 === 0 || xx % 40 === 0) c = mix(c, WHITE, 0.08);
    const h = hash(X, Y, 81);
    if (h > 0.9) c = mix(c, h > 0.975 ? 0xd0d4dc : 0x8a92a0, 0.45);
    c = mix(c, 0x23262d, clamp((BASE + 10 - Y) / 10, 0, 1) * 0.55);          // skuggan under disken
    c = mix(c, 0x23262d, clamp((Y - (CB.y0 - 6)) / 6, 0, 1) * 0.35);         // och vid bandet
    return jit(c, X, Y, 82, 0.035);
  });
  // ståmattan (svart gummi med gula kanter) där man jobbar vid skärmen
  area(P, 58, 147, 176, 21, (X, Y, i, j) => {
    if (i === 0 || j === 0 || i === 175 || j === 20) return j === 20 || i === 175 ? 0x9a7a18 : 0xe8c030;
    if (i === 1 || j === 1 || i === 174 || j === 19) return 0x16171a;
    return (X + (Y & 1) * 2) % 4 === 0 ? 0x3a3e46 : 0x23262d;
  });
  P.hl(59, 168, 175, 0x1a1418, 0.3);
  // kabelkanal längs diskens fot och målad text på golvet
  area(P, DESK.x0, BASE + 1, DESK.x1 - DESK.x0 - 12, 3, (X, Y, i, j) => (j === 0 ? 0x9aa0a8 : j === 1 ? 0x7a8088 : 0x3a3e46));
  for (let x = DESK.x0 + 10; x < DESK.x1 - 12; x += 30) P.px(x, BASE + 2, 0x5a6068);
  text(P, SMALL, $t('ENDAST PERSONAL'), 42, 172, 0xd8b028, 0.55);
  // säkerhetstejp längs uppsamlingsbandet
  for (let x = 0; x < FW; x++) for (const y of [180, 181]) P.px(x, y, (((x + y) >> 2) & 1) ? 0xe8c030 : 0x23262d, hash(x >> 2, y, 83) > 0.85 ? 0.5 : 0.9);
  // skräp och spår: avriven lapp, gem, penna, gummisnodd, kaffefläck, klackmärken
  stamp(P, 150, 172, ['..e.......', '.e.e......', 'CCppppppq.', 'CCppkkppq.', '.qqqqqqq..'], { e: 0x2a2c30, p: 0xf6f4ee, q: 0xcac6bc, k: 0x9a9ca2, C: 0xe8b230 });
  stamp(P, 196, 172, ['wbbbbbbk', '.BBBBBBx'], { w: 0xe8ecf0, b: 0x3a6ad8, B: 0x2a4aa8, k: 0x1a1a1e, x: 0x3a3a40 }, 0.25);
  stamp(P, 128, 176, ['.xxx.', 'x...x', 'x.x.x', '.x.x.'], { x: 0xb8bec6 }, 0.2);
  P.ell(58, 176, 5, 1.5, 0x3a2a1a, 0.3, 3);
  for (const [cx, cy] of [[160, 176], [214, 150], [300, 170], [340, 176], [44, 158]]) { P.px(cx, cy, 0xd8303a, 0.8); P.px(cx + 1, cy, 0xd8303a, 0.6); P.px(cx + 2, cy + 1, 0xd8303a, 0.5); }
  for (let k = 0; k < 12; k++) { const mx = Math.round(40 + hash(k, 2, 84) * 330), my = Math.round(146 + hash(k, 3, 84) * 30); P.hl(mx, my, 2 + (k % 3), 0x1a1c20, 0.25); }
  // mattan i köfållan
  const mx0 = 186, mx1 = 306, my0 = 91, my1 = 105;
  area(P, mx0, my0, mx1 - mx0, my1 - my0, (X, Y, i, j) => {
    if (j === 0 || i === 0 || i === mx1 - mx0 - 1 || j === my1 - my0 - 1) return 0x5a7ab0;
    if (j === 1 || i === 1 || i === mx1 - mx0 - 2 || j === my1 - my0 - 2) return 0x1a2a48;
    let c = jit(0x243a66, X, Y, 52, 0.12);
    const u = (X - mx0) % 20, v = Y - my0;
    if ((u === 9 || u === 10) && v >= 5 && v <= 8) c = 0x3a5a94;
    if (v === 6 && u >= 7 && u <= 12) c = 0x3a5a94;
    return c;
  });
  // VÄNTA HÄR vid köns utgång
  P.hl(180, 107, 26, 0xf0cc3a); P.hl(180, 108, 26, 0xc8a428);
  for (const fx of [186, 193]) { P.rect(fx, 110, 3, 3, 0xd8b028, 0.8); P.rect(fx, 114, 3, 1, 0xd8b028, 0.8); }
  // pelarens fot vid gränsen till personalgången (glasskärm)
  // återvinningsstationen i hallen: tre kärl med färgade lock
  for (let k = 0; k < 3; k++) {
    const rx = 5 + k * 9, col = [0x2f8f46, 0x2c6fb7, 0xe8b230][k];
    P.ell(rx + 4, 116, 5, 1.2, 0x1a1418, 0.35, 3);
    area(P, rx, 102, 8, 14, (X, Y, i, j) => (j < 2 ? (j === 0 ? mix(col, WHITE, 0.3) : col) : i === 0 ? 0xe4e8ec : i === 7 ? 0x6a7078 : j === 13 ? 0x5a6068 : jit(0xb8bec6, X, Y, 85, 0.04)));
    P.hl(rx + 2, 103, 4, 0x1a1c20);
    P.rect(rx + 2, 106, 4, 3, col); P.px(rx + 3, 107, WHITE);
  }
  // glasskärmen till vänster om disken (personalen går innanför)
  area(P, 0, 118, 36, 24, (X, Y, i, j) => {
    if (j === 0) return 0xe8ecf0;
    if (i === 35 || i === 0) return 0x9aa0a8;
    if (j === 23) return 0x6a7078;
    return null;
  });
  for (let j = 1; j < 23; j++) for (let i = 1; i < 35; i++) {
    const s = (((i * 2 - j * 3) % 29) + 29) % 29;
    P.px(i, 118 + j, 0xdcecf4, s < 3 ? 0.35 : 0.12);
  }
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const d = Math.hypot(x, y);
    if (d > 4.4) continue;
    P.px(16 + x, 128 + y, Math.abs(y) === 0 && Math.abs(x) <= 2 ? WHITE : d > 3.5 ? 0x9a1a1a : 0xd8303a);
  }
  P.vl(16, 133, 8, 0x9aa0a8, 0.6);
  if (night) {
    for (let y = HALL_Y; y < CB.y0; y++) for (let x = 0; x < FW; x++) {
      const c = P.get(x, y);
      P.px(x, y, mix(mul(c, 0.86), 0x1a2238, 0.1));
    }
    for (const cx of [40, 150, 260, 360]) { P.ell(cx, 96, 34, 9, 0xfff0d0, 0.12, 4); P.ell(cx, 164, 40, 10, 0xfff0d0, 0.08, 4); }
  }
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
// destinationstavlan på väggen: kod + stad (samma koder som på lappskrivaren)
function paintBoard(P, night) {
  const bx = 2, by = 22, bw = 62, bh = 46;
  P.darken(bx + 2, by + bh, bw - 2, 1, 0.8);
  area(P, bx, by, bw, bh, (X, Y, i, j) => (i === 0 || j === 0 ? 0x6a6e78 : i === bw - 1 || j === bh - 1 ? 0x1a1c22 : 0x0c0d10));
  const ix = bx + 1, iw = bw - 2;
  // rubrik: flygplansikon + AVGÅNGAR + klockslag-prickar
  P.rect(ix, by + 1, iw, 6, AIR_D);
  P.hl(ix, by + 1, iw, AIR);
  const pl = ['..#..', '.###.', '#####', '..#..', '.###.'];
  pl.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(ix + 2 + i, by + 2 + j, GOLD); });
  text(P, SMALL, $t('AVGÅNGAR'), ix + 9, by + 2, GOLD);
  for (let k = 0; k < 3; k++) P.px(ix + iw - 3 - k * 2, by + 4, k === 0 ? 0x5ad06a : 0x5a7ab0);
  DEST.forEach((d, k) => {
    const ry = by + 8 + k * 6;
    if (k & 1) P.rect(ix, ry - 1, iw, 6, 0x14161c);
    text(P, SMALL, d.code, ix + 2, ry, GOLD);
    text(P, SMALL, d.city, ix + 17, ry, 0xe4eaf4);
    P.px(ix + iw - 2, ry + 2, d.c); P.px(ix + iw - 2, ry + 1, mix(d.c, WHITE, 0.4));
  });
  reflect(P, ix, by + 1, iw, bh - 2, night ? 0.3 : 0.55, 5);
  for (const [sx, sy] of [[bx, by], [bx + bw - 1, by], [bx, by + bh - 1], [bx + bw - 1, by + bh - 1]]) P.px(sx, sy, 0xb8bec6);
}
// fönsterramen (ligger över allt ute): spröjs, tvärpost, reflexer
function paintWinFrame(mode) {
  const P = new Pix(FW, FH), night = mode === 'natt';
  reflect(P, WALL_X1, GY0, FW - WALL_X1, GY1 - GY0, night ? 0.4 : 0.85, 3, night ? 0x9fb4d8 : 0xeef7ff);
  if (night) for (let x = WALL_X1 + 20; x < FW; x += 64) { P.hl(x, 24, 26, 0xfff4dc, 0.22); P.hl(x + 2, 25, 22, 0xfff4dc, 0.12); } // takljusens spegling
  rows(P, 0, 18, FW, [0x9aa0a8, 0x5a6068]);
  for (const mx of MULLS) {
    vcols(P, mx, GY0, GY1 - GY0, [0xe4e8ec, 0xb8bec6, 0x6a7078]);
    P.px(mx + 1, GY0 + 9, 0x5a6068);
  }
  P.hl(WALL_X1, GY0 + 9, FW - WALL_X1, 0xd8dce2); P.hl(WALL_X1, GY0 + 10, FW - WALL_X1, 0x7a8088);
  return P.flush();
}

// ======================= köbanden (stolpar med utdragbart band) =======================
const POSTS_BACK = [188, 216, 244, 272, 300], POSTS_FRONT = [208, 236, 264, 292];
const POST_BACK_Y = 91, POST_FRONT_Y = 105;
function stanchion(P, x, by) {
  P.ell(x + 1, by + 1, 5, 1.4, 0x1a1418, 0.4, 3);
  rows(P, x - 1, by - 1, 4, [0xe4e8ec]);
  area(P, x - 2, by, 6, 1, (X, Y, i) => (i === 0 ? 0xc8ced4 : i === 5 ? 0x5a6068 : 0x9aa0a8));
  rows(P, x - 1, by + 1, 4, [0x3a3e46]);
  vcols(P, x, by - 14, 13, [0xf4f6f8, 0x8a9098]);
  for (let y = by - 13; y < by - 1; y += 5) P.px(x, y, 0xffffff);
  area(P, x - 1, by - 17, 4, 3, (X, Y, i, j) => (j === 0 ? (i === 0 || i === 3 ? 0x9aa0a8 : 0xf4f6f8) : i === 0 ? 0x5a6068 : i === 3 ? 0x16171a : 0x3a3e46));
  P.px(x + 1, by - 16, 0xd8303a);
}
function paintPosts(list, by, gapAfter = null) {
  const P = new Pix(FW, FH);
  for (let k = 0; k < list.length - 1; k++) {
    const x0 = list[k] + 3, x1 = list[k + 1] - 1, y = by - 16;
    rows(P, x0, y, x1 - x0, [0x5a8af0, 0x2a5ad0, 0x1e3a98]);
    for (let x = x0 + 2; x < x1 - 1; x += 4) P.px(x, y + 1, 0xdcecff, 0.5);
    P.hl(x0, y + 3, x1 - x0, 0x1a1418, 0.25);
  }
  for (const x of list) stanchion(P, x, by);
  // skylten på sista stolpen: DISK 3
  if (gapAfter) {
    const sx = list[list.length - 1] - 9, sy = by - 29;
    P.vl(sx + 9, sy + 9, 3, 0x8a9098);
    area(P, sx, sy, 20, 10, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a8ad0 : i === 19 || j === 9 ? AIR_D : AIR));
    text(P, SMALL, $t('DISK'), sx + 2, sy + 3, WHITE);
    P.rect(sx + 18 - 4, sy + 2, 3, 6, GOLD); text(P, SMALL, '3', sx + 14, sy + 3, AIR_D);
  }
  return P.flush();
}

// ======================= stolarna i hallen =======================
const CHAIRS = { x: 318, y: 92, n: 5, w: 13 };
function paintChairs(night) {
  const P = new Pix(FW, FH), { x: cx0, y: cy, n, w } = CHAIRS;
  // balken och benen
  P.ell(cx0 + n * w / 2, cy + 3, n * w / 2 + 4, 2, 0x1a1418, 0.35, 3);
  rows(P, cx0 - 2, cy - 3, n * w + 4, [0xd8dce2, 0x8a9098, 0x4a4e56]);
  for (const lx of [cx0 + 4, cx0 + n * w - 5]) { vcols(P, lx, cy, 3, [0xc8ced4, 0x6a7078]); P.hl(lx - 2, cy + 3, 6, 0x3a3e46); }
  for (let k = 0; k < n; k++) {
    const x = cx0 + k * w;
    // ryggen (ses framifrån, bakom den som sitter)
    area(P, x + 1, cy - 19, w - 2, 11, (X, Y, i, j) => {
      if ((i === 0 || i === w - 3) && j === 0) return null;
      if (i === 0 || i === w - 3) return 0x3a3e46;
      if (j === 0) return 0x6a7078;
      const c = j < 3 ? 0x3a6ab0 : 0x2e5a9a;
      return jit(i === 1 ? mix(c, WHITE, 0.2) : i === w - 4 ? mul(c, 0.75) : c, X, Y, 53, 0.06);
    });
    // sitsen
    area(P, x + 1, cy - 8, w - 2, 5, (X, Y, i, j) => (j === 0 ? 0x5a8ad0 : j === 4 ? 0x1e3a6a : i === 0 || i === w - 3 ? 0x24487a : jit(0x2e5a9a, X, Y, 54, 0.06)));
    // armstöden
    vcols(P, x, cy - 10, 8, [0xe4e8ec, 0x8a9098]);
  }
  vcols(P, cx0 + n * w, cy - 10, 8, [0xe4e8ec, 0x8a9098]);
  return P.flush();
}

// ======================= disken, skrivaren, vågen, bandet =======================
function paintCounterRun(P, x0, x1, { knee = null } = {}) {
  // skivan: ljus laminat, stålkant mot passagerarsidan, rundad kant mot mig
  area(P, x0, TOP0, x1 - x0, TOP1 - TOP0, (X, Y, i, j) => {
    if (j === 0) return 0xb8bec6;
    if (j === 1) return 0xeef0f2;
    if (j === TOP1 - TOP0 - 1) return 0xf8f8f6;
    let c = qmix(0xe6e3dc, 0xd8d4cc, j / 10, X, Y, 3);
    if (i === 0 || i === x1 - x0 - 1) c = mul(c, 0.9);
    return jit(c, X, Y, 60, 0.03);
  });
  // fronten mot min gång: paneler med blå rand, lådor, sparklist
  area(P, x0, TOP1, x1 - x0, BASE - TOP1, (X, Y, i, j) => {
    if (j === 0) return 0x9aa0a8;
    if (j >= 13) return j === 13 ? 0x3a3e46 : jit(0x23262d, X, Y, 61, 0.1);
    if (j === 2 || j === 3) return j === 2 ? AIR_L : AIR;
    let c = qmix(0xcdd1d6, 0xb4bac2, j / 13, X, Y, 3);
    if ((X - x0) % 36 === 0) c = 0x8a9098;
    else if ((X - x0) % 36 === 1) c = mix(c, WHITE, 0.25);
    return jit(c, X, Y, 62, 0.03);
  });
  P.darken(x0, TOP1 + 1, x1 - x0, 1, 0.82);
  // knäfacket (mörkt) med papperskorg och datorlåda
  if (knee) {
    const [kx0, kx1] = knee;
    area(P, kx0, TOP1 + 5, kx1 - kx0, BASE - TOP1 - 5, (X, Y, i, j) => (j === 0 ? 0x2a2c30 : i === 0 ? 0x3a3e46 : mix(0x1a1c20, 0x2a2c30, j / 12)));
    // datorn
    area(P, kx0 + 3, TOP1 + 7, 7, 9, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a5e66 : 0x3a3e46));
    P.px(kx0 + 5, TOP1 + 9, 0x5ad06a);
    // papperskorg med skrynklade lappar
    area(P, kx1 - 12, TOP1 + 8, 9, 8, (X, Y, i, j) => (j === 0 ? 0x8a9098 : i === 0 ? 0x6a7078 : i === 8 ? 0x2a2c30 : 0x4a4e56));
    P.px(kx1 - 10, TOP1 + 7, 0xfbfaf6); P.px(kx1 - 9, TOP1 + 7, 0xe8e4da); P.px(kx1 - 7, TOP1 + 6, 0xd9433b); P.px(kx1 - 6, TOP1 + 7, 0xfbfaf6);
    // fotstöd
    P.hl(kx0 + 14, BASE - 3, 14, 0x5a6068); P.hl(kx0 + 14, BASE - 2, 14, 0x3a3e46);
  }
  // lådornas handtag
  for (let x = x0 + 8; x < x1 - 8; x += 36) {
    if (knee && x > knee[0] - 4 && x < knee[1]) continue;
    P.hl(x, TOP1 + 7, 8, 0x6a7078); P.hl(x, TOP1 + 8, 8, 0xe4e8ec);
  }
}
function paintMonitorBezel(P) {
  const { x, y, w, h } = MON;
  P.darken(x + 2, y + h, w - 2, 1, 0.75);
  area(P, x, y, w, h, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0x4a4e56;
    if (i === w - 1 || j === h - 1) return 0x121316;
    if (i === 1 || j === 1) return 0x3a3e46;
    return jit(0x23262d, X, Y, 63, 0.05);
  });
  // lapparna på ramen
  P.rect(x + w - 9, y - 3, 7, 6, 0xfff07a); P.hl(x + w - 8, y - 1, 5, 0x9a8a3a); P.hl(x + w - 8, y + 1, 3, 0x9a8a3a); P.px(x + w - 3, y + 2, 0xd8c85a);
  P.rect(x + 2, y + h - 4, 5, 3, 0x7ad8ff); P.px(x + 3, y + h - 3, 0x3a7a9a);
  // loggan under skärmen + lampan
  text(P, SMALL, $t('SNABBFLYG'), x + 18, y + h - 5, 0x5a6068);
  // foten och halsen
  vcols(P, x + w / 2 - 3, y + h, 3, [0x5a5e66, 0x3a3e46, 0x3a3e46, 0x2a2c30, 0x2a2c30, 0x1a1c20]);
  area(P, x + w / 2 - 12, y + h + 1, 24, 3, (X, Y, i, j) => (j === 0 ? 0x5a5e66 : j === 1 ? 0x3a3e46 : 0x1a1c20));
  // tangentbordet
  const kx = x + 12, ky = TOP0 + 4;
  area(P, kx, ky, 44, 5, (X, Y, i, j) => {
    if (j === 0) return 0x5a5e66;
    if (j === 4 || i === 0 || i === 43) return 0x1a1c20;
    return (i + (j & 1)) % 3 === 0 ? 0x16171a : j === 1 ? 0x4a4e56 : 0x3a3e46;
  });
  P.darken(kx + 1, ky + 5, 44, 1, 0.8);
  // musen
  area(P, x + 60, TOP0 + 5, 4, 5, (X, Y, i, j) => ((i === 0 || i === 3) && (j === 0 || j === 4) ? null : j === 0 ? 0xd8dce2 : i === 3 ? 0x6a7078 : 0xb8bec6));
  P.vl(x + 61, TOP0 + 3, 2, 0x2a2c30);
}
function paintKiosk(P) {
  // lappskrivaren står på disken: skrivarhuvud med springa överst, kodknappar, fot
  const { x0, x1, top, base } = KIOSK, w = x1 - x0;
  P.ell(x0 + w / 2, base, w / 2 + 2, 1.5, 0x1a1418, 0.45, 3);
  area(P, x0, top, w, 8, (X, Y, i, j) => {
    if (j === 0) return i === 0 || i === w - 1 ? 0x5a5e66 : 0x8a9098;
    if (i === 0) return 0x4a4e56;
    if (i === w - 1 || j === 7) return 0x16171a;
    return jit(0x2e3138, X, Y, 64, 0.05);
  });
  P.rect(x0 + 8, top - 1, 14, 2, 0x0a0b0e); P.hl(x0 + 8, top - 1, 14, 0x3a3e46);      // springan där lappen kommer
  area(P, x0 + 2, top + 2, 7, 5, (X, Y, i, j) => (i === 0 || j === 0 ? 0x16171a : j === 1 ? 0xffffff : i === 6 ? 0xc8c4ba : 0xf0ece2)); // etikettrullen
  P.vl(x0 + 5, top + 3, 4, 0xd8d4ca);
  P.rect(x0 + 19, top + 2, 8, 4, 0x0e1a2e);                                         // displayen (levande)
  // tangentpanelen (koderna ritas levande ovanpå)
  area(P, x0, top + 8, w, 26, (X, Y, i, j) => {
    if (j === 0) return 0xc8ced4;
    if (i === 0) return 0xa8aeb6;
    if (i === w - 1) return 0x4a4e56;
    if (j === 25) return 0x3a3e46;
    return jit(qmix(0x7a8088, 0x62686f, j / 25, X, Y, 3), X, Y, 65, 0.04);
  });
  // foten mot disken
  area(P, x0 + 1, top + 34, w - 2, base - top - 34, (X, Y, i, j) => (j === 0 ? 0x5a5e66 : 0x2a2c30));
  P.px(x0 + 3, base - 1, 0x16171a); P.px(x1 - 4, base - 1, 0x16171a);
}
function paintSpecial(P) {
  const { x0, x1, top, base } = SPEC, w = x1 - x0;
  P.ell(x0 + w / 2, base, w / 2 + 3, 2, 0x1a1418, 0.45, 3);
  // fronten: rostfritt skåp med gulsvart rand, skylt och sparkplåt
  const fh = base - top - 6;                       // frontens höjd (28 rader)
  area(P, x0, top + 6, w, fh, (X, Y, i, j) => {
    if (j === 0) return 0x5a6068;
    if (j >= 2 && j <= 4) return (((X + Y) >> 1) & 1) ? 0xf0c020 : 0x1e1e20;
    if (j >= fh - 7) return j === fh - 7 ? 0x3a3e46 : j === fh - 1 ? 0x23262d : jit(0x4a4e56, X, Y, 67, 0.08);
    if (i === 0) return 0xd8dce2;
    if (i === w - 1) return 0x5a6068;
    let c = qmix(0xc0c6cc, 0xa0a6ae, j / fh, X, Y, 3);
    if (hash(X, Y, 68) > 0.9) c = mix(c, WHITE, 0.15);
    return c;
  });
  // sparkplåtens nitar
  for (let x = x0 + 3; x < x1 - 2; x += 6) P.px(x, base - 4, 0x8a9098);
  // skylten: surfbräda, hund, skidor + SPECIAL
  const sx = x0 + 2, sy = top + 12;
  area(P, sx, sy, w - 4, 14, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a8ad0 : i === w - 5 || j === 13 ? AIR_D : AIR));
  for (let k = 0; k < 9; k++) { P.px(sx + 3 + k, sy + 6 - Math.round(k * 0.45), 0xffffff); P.px(sx + 3 + k, sy + 7 - Math.round(k * 0.45), 0xd8e0f0); }
  stamp(P, sx + 14, sy + 2, ['.x..x', '.xxxx', 'xxxxx', '.xxx.', '.x.x.'], { x: GOLD }, 0);
  P.line(sx + 21, sy + 2, sx + 23, sy + 7, 0xffffff); P.line(sx + 23, sy + 2, sx + 25, sy + 7, 0xffffff);
  text(P, SMALL, $t('SPECIAL'), sx + 1, sy + 8, WHITE);
  // lockets gångjärn baktill (själva locket ritas levande)
  P.hl(x0 + 1, top, w - 2, 0x3a3e46);
}
function paintSpecialLid(open) {
  const { x0, x1, top } = SPEC, w = x1 - x0;
  const P = new Pix(w + 2, 20, x0 - 1, top - 14);
  if (open) {
    // locket uppfällt: undersidan syns, öppningen är mörk
    area(P, x0 + 1, top - 12, w - 2, 12, (X, Y, i, j) => (i === 0 || j === 0 ? 0xb8bec6 : i === w - 3 ? 0x5a6068 : jit(0x8a9098, X, Y, 69, 0.05)));
    area(P, x0 + 1, top, w - 2, 6, (X, Y, i, j) => (j === 0 ? 0x0a0b0e : mix(0x0a0b0e, 0x2a2c30, j / 6)));
  } else {
    area(P, x0, top, w, 6, (X, Y, i, j) => {
      if (j === 0) return 0xe4e8ec;
      if (j === 5) return 0x3a3e46;
      if (i === 0) return 0xd8dce2;
      if (i === w - 1) return 0x6a7078;
      return jit((i + j) % 4 === 0 ? 0x9aa0a8 : 0xb8bec6, X, Y, 70, 0.04);
    });
    P.hl(x0 + 10, top + 3, 10, 0x3a3e46); P.hl(x0 + 10, top + 4, 10, 0xe4e8ec);
  }
  return P.flush();
}
function paintScaleAndFeed(P) {
  // vågen: stålplatta i diskens höjd med rutmönster
  const { x0, x1 } = SCALE;
  area(P, x0, TOP0, x1 - x0, TOP1 - TOP0 + 2, (X, Y, i, j) => {
    if (j === 0) return 0x6a7078;
    if (i === 0 || i === x1 - x0 - 1) return 0x5a6068;
    if (j >= TOP1 - TOP0) return j === TOP1 - TOP0 ? 0x3a3e46 : 0x23262d;
    return (X + Y) % 3 === 0 ? 0x9aa0a8 : (X - Y) % 3 === 0 ? 0xc8ced4 : 0xb4bac2;
  });
  // matarbandet ner mot uppsamlingsbandet: skenor, gummiyta (levande), benen
  const { x0: fx0, x1: fx1, y0, y1 } = FEED;
  vcols(P, fx0, y0, y1 - y0, [0xe4e8ec, 0x8a9098]);
  vcols(P, fx1 - 2, y0, y1 - y0, [0xb8bec6, 0x5a6068]);
  for (let y = y0 + 6; y < y1; y += 14) { P.px(fx0, y, 0x5a6068); P.px(fx1 - 1, y, 0x3a3e46); }
  // ljusridån (sensorbåge)
  const ly = 150;
  vcols(P, fx0 - 2, ly - 12, 13, [0xf0c020, 0xa88010]);
  vcols(P, fx1, ly - 12, 13, [0xf0c020, 0xa88010]);
  rows(P, fx0 - 2, ly - 13, fx1 - fx0 + 4, [0xffe070, 0xa88010]);
  // SKICKA-stolpen: gul låda med stor grön knapp och rött nödstopp
  const { x, y } = SEND;
  P.ell(x + 5, y + 19, 6, 1.5, 0x1a1418, 0.4, 3);
  vcols(P, x + 4, y + 8, 11, [0xd8dce2, 0x6a7078]);
  area(P, x, y, 10, 9, (X, Y, i, j) => (j === 0 ? 0xffe070 : i === 0 ? 0xf8d850 : i === 9 || j === 8 ? 0xa88010 : 0xf0c020));
  // stor grön svampknapp (pil nedåt = iväg på bandet) och ett litet rött nödstopp
  stamp(P, x + 1, y + 1, ['.gGg.', 'gGWGg', 'gGGGg', '.ggg.'], { g: 0x1e8a3a, G: 0x3ac05a, W: 0xb8ffc8 }, 0);
  P.hl(x + 1, y + 5, 5, 0x9a7010);
  stamp(P, x + 7, y + 2, ['rr', 'RR'], { r: 0xff6a5a, R: 0xb8201a }, 0);
  for (let k = 0; k < 3; k++) P.hl(x + 2 + k, y + 6 + k, 3 - k * 2 > 0 ? 3 - k * 2 : 1, 0x2a2c30);
  P.hl(x + 2, y + 18, 6, 0x3a3e46);
  // vågens siffertavla på stolpe
  const D = WDISP;
  vcols(P, D.x + 13, D.y + D.h, TOP0 - D.y - D.h, [0xb8bec6, 0x5a6068]);
  area(P, D.x, D.y, D.w, D.h, (X, Y, i, j) => (i === 0 || j === 0 ? 0x6a6e76 : i === D.w - 1 || j === D.h - 1 ? 0x16171a : 0x2a2c30));
  P.rect(D.x + 2, D.y + 2, D.w - 4, D.h - 4, 0x120606);
  // skylt på vågens front: MAX 32 KG
  P.rect(x0 + 6, TOP1 + 1, 18, 1, 0x23262d);
}
function paintTotem(P) {
  const { x0, x1 } = TOTEM, w = x1 - x0;
  P.ell(x0 + w / 2, BASE, w / 2 + 3, 1.6, 0x1a1418, 0.4, 3);
  area(P, x0, 70, w, BASE - 70, (X, Y, i, j) => {
    if (i === 0) return 0xe4e8ec;
    if (i === w - 1) return 0x5a6068;
    if (j < 16) return j === 0 ? 0x5a8ad0 : jit(AIR, X, Y, 71, 0.05);
    return jit(qmix(0xc8ced4, 0xa8aeb6, (j - 16) / 56, X, Y, 3), X, Y, 72, 0.03);
  });
  // loggan (gult S) och disknumren
  stamp(P, x0 + 3, 73, ['.xxx', 'x...', '.xx.', '...x', 'xxx.'], { x: GOLD }, 0);
  P.rect(x0 + 2, 90, 7, 7, 0x16171a); text(P, SMALL, '3', x0 + 4, 91, GOLD);
  P.px(x0 + 1, 93, GOLD);
  P.rect(x0 + 2, 99, 7, 7, 0x16171a); text(P, SMALL, '4', x0 + 4, 100, 0xd8dce2);
  P.px(x0 + 9, 102, 0xd8dce2);
  // brandsläckare på pelaren
  P.rect(x0 + 3, 124, 5, 8, 0xd8303a); P.vl(x0 + 3, 124, 8, 0xff6a5a); P.vl(x0 + 7, 124, 8, 0x8a1a1a);
  P.rect(x0 + 4, 122, 3, 2, 0x2a2c30); P.rect(x0 + 4, 127, 3, 2, 0xf4f4ec);
}
function paintNeighbor(P, night) {
  paintCounterRun(P, NB.x0, NB.x1);
  // grannens skärm (mindre) och en lampa
  const mx = 318, my = 94;
  area(P, mx, my, 30, 21, (X, Y, i, j) => (i === 0 || j === 0 ? 0x4a4e56 : i === 29 || j === 20 ? 0x121316 : 0x23262d));
  area(P, mx + 2, my + 2, 26, 16, (X, Y, i, j) => (j < 3 ? AIR : night ? 0x0a1426 : 0x0e1a2e));
  for (let k = 0; k < 4; k++) P.hl(mx + 4, my + 6 + k * 3, 8 + ((k * 5) % 11), 0x8aa2c8, 0.8);
  P.rect(mx + 20, my + 7, 6, 8, 0x2a4a8a); P.px(mx + 21, my + 8, GOLD);
  vcols(P, mx + 13, my + 21, 3, [0x5a5e66, 0x3a3e46, 0x2a2c30]);
  P.hl(mx + 8, TOP0 + 3, 14, 0x3a3e46);
  area(P, mx - 2, TOP0 + 4, 30, 5, (X, Y, i, j) => (j === 0 ? 0x5a5e66 : j === 4 ? 0x1a1c20 : (i + j) % 3 === 0 ? 0x16171a : 0x3a3e46));
  // grannens våg och matarband (skymtar i kanten)
  area(P, 364, TOP0, 20, TOP1 - TOP0 + 2, (X, Y, i, j) => (j === 0 ? 0x6a7078 : j >= TOP1 - TOP0 ? 0x23262d : (X + Y) % 3 === 0 ? 0x9aa0a8 : 0xb4bac2));
  vcols(P, 366, FEED.y0, FEED.y1 - FEED.y0, [0xe4e8ec, 0x8a9098]);
  if (night) {
    // STÄNGT-skylt på disken
    const sw = textW(SMALL, $t('STÄNGT')) + 5;
    area(P, 298, 104, sw, 12, (X, Y, i, j) => (i === 0 || j === 0 ? 0xffffff : i === sw - 1 || j === 11 ? 0x9aa0a8 : 0xf4f4ec));
    text(P, SMALL, $t('STÄNGT'), 300, 108, 0xd8303a);
    P.hl(300, 106, sw - 4, 0xd8303a, 0.35);
    P.vl(298 + (sw >> 1), 116, 2, 0x6a7078);
  }
}
function paintCounterLayer(night) {
  const P = new Pix(FW, FH);
  // skuggan på golvet framför disken
  for (let k = 0; k < 3; k++) P.hl(DESK.x0, BASE + 1 + k, DESK.x1 - DESK.x0, 0x1a1418, 0.3 - k * 0.09);
  for (let k = 0; k < 3; k++) P.hl(NB.x0, BASE + 1 + k, NB.x1 - NB.x0, 0x1a1418, 0.3 - k * 0.09);
  paintCounterRun(P, DESK.x0, DESK.x1, { knee: KNEE });
  paintNeighbor(P, night);
  paintTotem(P);
  paintScaleAndFeed(P);
  paintMonitorBezel(P);
  // boardingkortskrivaren
  const b = BPRN;
  area(P, b.x, b.y, b.w, b.h, (X, Y, i, j) => {
    if (j === 0) return 0xf4f2ea;
    if (i === 0) return 0xe4e0d4;
    if (i === b.w - 1 || j === b.h - 1) return 0x6a665c;
    if (j >= 9 && j <= 11 && i > 3 && i < b.w - 4) return j === 10 ? 0x1a1a1e : 0x3a3a40;
    return jit(qmix(0xd8d4c8, 0xbcb8ac, j / b.h, X, Y, 3), X, Y, 73, 0.04);
  });
  P.rect(b.x + 3, b.y + 3, 6, 3, 0x0e1a2e); P.px(b.x + 4, b.y + 4, 0x5ad06a);
  P.rect(b.x + 15, b.y + 3, 6, 4, 0xfbfaf6); P.box(b.x + 15, b.y + 3, 6, 4, 0xa8a498); // bunt med tomma kort
  P.darken(b.x + 1, b.y + b.h, b.w, 1, 0.75);
  // passläsaren
  area(P, SCAN.x, SCAN.y, 20, 7, (X, Y, i, j) => (j === 0 ? 0x5a5e66 : j === 6 || i === 19 ? 0x121316 : i === 0 ? 0x4a4e56 : j > 1 && j < 5 && i > 2 && i < 17 ? 0x1a3a4a : 0x2a2c30));
  // kortterminalen
  area(P, TERM.x, TERM.y, 8, 14, (X, Y, i, j) => (i === 0 || j === 0 ? 0x5a5e66 : i === 7 || j === 13 ? 0x121316 : 0x2e3138));
  P.rect(TERM.x + 2, TERM.y + 2, 4, 3, 0x2a4a5a);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) P.px(TERM.x + 2 + i, TERM.y + 7 + j * 2, j === 2 && i === 2 ? 0x3ac05a : 0x9aa0a8);
  // kaffemuggen och pennburken på diskens vänstra ände
  area(P, 52, 109, 6, 7, (X, Y, i, j) => (j === 0 ? 0x3a2418 : i === 0 ? 0xffffff : i === 5 ? 0xb8b4aa : j === 3 ? AIR : 0xf4f2ea));
  P.px(58, 111, 0xd8d4ca); P.px(59, 112, 0xd8d4ca); P.px(58, 113, 0xd8d4ca);
  area(P, 45, 109, 5, 7, (X, Y, i, j) => (j === 0 ? 0x5a6068 : i === 0 ? 0x8a9098 : 0x6a7078));
  P.px(46, 107, 0x2a6ad0); P.px(46, 108, 0x2a6ad0); P.px(48, 106, 0xd9433b); P.px(48, 107, 0xd9433b); P.px(48, 108, 0xd9433b); P.px(47, 108, GOLD);
  // lappbunt och tejprulle
  area(P, 138, 119, 10, 4, (X, Y, i, j) => (j === 0 ? 0xffffff : i === 9 ? 0xb8b4aa : j === 3 ? 0xa8a498 : 0xf4f0e6));
  P.ell(232, 121, 3, 2, 0x8a9098, 1, 2); P.px(232, 121, 0x3a3e46);
  // disknumret i hörnet
  P.rect(DESK.x0 + 1, TOP0 - 7, 8, 7, AIR_D); P.box(DESK.x0 + 1, TOP0 - 7, 8, 7, 0x5a8ad0);
  text(P, SMALL, '3', DESK.x0 + 4, TOP0 - 6, GOLD);
  return P.flush();
}
// uppsamlingsbandet längst fram: bakre räcke, gummilameller (levande), frontplåt
function paintBeltFrame() {
  const P = new Pix(FW, FH);
  rows(P, 0, CB.y0, FW, [0xeef2f6, 0xb8bec6, 0x7a8088, 0x3a3e46]);
  for (let x = 10; x < FW; x += 32) P.px(x, CB.y0 + 1, 0x5a6068);
  rows(P, 0, CB.s1, FW, [0x5a5e66, 0x2a2c30]);
  area(P, 0, CB.s1 + 2, FW, 5, (X, Y, i, j) => {
    let c = [0xd8dde2, 0xc4cad0, 0xb0b6be, 0x9aa0a8, 0x6a7078][j];
    if (X % 64 === 63) c = 0x5a6068;
    else if (X % 64 === 0) c = mix(c, WHITE, 0.3);
    return jit(c, X, Y, 74, 0.04);
  });
  for (let x = 8; x < FW; x += 16) if (x % 64 !== 0) P.px(x, CB.s1 + 4, 0x6a7078);
  rows(P, 0, CB.s1 + 7, FW, [0x23262d, 0x16171a]);
  // gummiridåerna längst till vänster där väskorna försvinner
  area(P, 0, CB.y0 - 4, 9, CB.s1 - CB.y0 + 6, (X, Y, i, j) => (i === 8 ? 0x2a2c30 : j < 2 ? 0x3a3e46 : null));
  return P.flush();
}
const SURF_PERIOD = 64;
function paintBeltSurf(h, vertical = false) {
  const len = (vertical ? h : FW) + SURF_PERIOD, wid = vertical ? FEED.x1 - FEED.x0 - 4 : h;
  const P = vertical ? new Pix(wid, len) : new Pix(len, wid);
  for (let a = 0; a < len; a++) for (let b = 0; b < wid; b++) {
    const s = a % 8, k = Math.floor((a % SURF_PERIOD) / 8);
    let c = s === 0 ? 0x121316 : s === 1 ? 0x4c5058 : s === 2 ? 0x3e424a : mix(0x33363d, 0x282a30, (s - 3) / 4);
    if (b === 0) c = mul(c, 0.62);
    else if (b === wid - 1) c = mul(c, 0.7);
    if (s > 2 && (b % 4 === 2)) c = mix(c, 0x1e2024, 0.4);
    if (hash(a % SURF_PERIOD, b, 43) > 0.92) c = mix(c, 0x5a5e66, 0.4);
    if (hash(k, 0, 44) > 0.8 && s > 2 && b > 3 && b < wid - 3) c = mix(c, 0x4a4e56, 0.25);
    if (vertical) P.px(b, a, c); else P.px(a, b, c);
  }
  return P.flush();
}

// ======================= saker i personalgången =======================
const STOOL = { x: 188, y: 178 }, CRATE = { x: 210, y: 180 };
let LANE_PROPS = null;
function laneProps() {
  if (LANE_PROPS) return LANE_PROPS;
  // hög kontorspall: rund sits, gaslyft, fotring, femarmad fot
  const S = new Pix(15, 24);
  S.ell(7, 22, 7, 1.6, 0x1a1418, 0.45, 3);
  area(S, 2, 0, 11, 4, (X, Y, i, j) => ((i === 0 || i === 10) && (j === 0 || j === 3) ? null : j === 0 ? 0x4a4e56 : j === 3 ? 0x16171a : i < 3 ? 0x3a3e46 : 0x2a2c30));
  S.hl(4, 1, 5, 0x5a5e66);
  vcols(S, 6, 4, 12, [0xe4e8ec, 0x8a9098]);
  S.hl(3, 11, 9, 0xc8ced4); S.hl(3, 12, 9, 0x6a7078);
  for (const [x, y] of [[1, 20], [3, 19], [5, 18], [9, 18], [11, 19], [13, 20]]) S.px(x, y, 0x3a3e46);
  S.hl(5, 17, 5, 0x3a3e46);
  S.px(1, 21, INK); S.px(13, 21, INK); S.px(7, 20, INK);
  // plastback med nya lapprullar och buntband
  const C = new Pix(18, 13);
  C.ell(9, 12, 9, 1.4, 0x1a1418, 0.4, 3);
  area(C, 1, 4, 16, 8, (X, Y, i, j) => (j === 0 ? 0x5a8ad0 : i === 0 || i === 15 ? 0x2a4a8a : j === 7 ? 0x1e3460 : (i % 3 === 1 && j > 2 && j < 6) ? 0x1e3a6a : 0x2e5a9a));
  for (let k = 0; k < 4; k++) { C.ell(4 + k * 3.3, 3, 1.6, 1.6, 0xf4f0e6, 1, 1); C.px(4 + Math.round(k * 3.3), 3, 0xa8a498); }
  C.hl(2, 5, 3, 0xd9433b);
  // tre staplade grå backar (till lösa saker och trasiga väskhjul) i hörnet
  const T = new Pix(26, 17);
  T.ell(13, 15.5, 12.5, 1.5, 0x1a1418, 0.4, 3);
  T.hl(1, 0, 24, 0xe4e8ec);
  area(T, 1, 1, 24, 4, (X, Y, i, j) => (i === 0 || i === 23 ? 0xb8bec6 : j === 3 ? 0x4a4e56 : jit(0x2e3138, X, Y, 86, 0.08)));
  T.px(6, 3, 0xd9433b); T.px(7, 3, 0xd9433b); T.px(15, 2, 0xe8b230);        // ett gummiband och en bortglömd penna
  for (let k = 0; k < 3; k++) {
    const y = 5 + k * 3;
    T.hl(1 - (k === 2 ? 0 : 0), y, 24, 0xc8ced4);
    area(T, 1, y + 1, 24, 2, (X, Y, i, j) => (i === 0 ? 0x9aa0a8 : i === 23 ? 0x4a4e56 : j === 1 ? 0x5a6068 : jit(0x7a8088, X, Y, 87, 0.05)));
    T.rect(9, y + 1, 8, 1, 0x3a3e46);                                              // handtagsurtaget
  }
  T.hl(1, 14, 24, 0x3a3e46);
  T.rect(3, 12, 5, 2, 0xfbfaf6); T.px(4, 12, 0x6a6e76);                            // en lapp på nedersta backen
  // gul skylt "golvet är vått" (natten, städaren) – A-ställning
  const W = new Pix(11, 15);
  W.ell(5, 14, 5.5, 1.2, 0x1a1418, 0.35, 3);
  area(W, 1, 0, 9, 14, (X, Y, i, j) => {
    const half = Math.floor(j * 0.3) + 1;
    if (i < 4 - half || i > 4 + half) return null;
    if (i === 4 - half || i === 4 + half) return 0xb8900e;
    return j === 0 ? 0xffe070 : 0xf0c020;
  });
  stamp(W, 4, 5, ['.k.', 'kkk', '.k.', 'k.k'], { k: 0x1e1e20 }, 0);
  W.hl(3, 10, 5, 0x1e1e20);
  LANE_PROPS = { stool: S.flush(), crate: C.flush(), tubs: T.flush(), wet: W.flush() };
  return LANE_PROPS;
}
const TUBS = { x: 4, y: 180 };                      // där specialskåpet stod förut: backar i hörnet

// ======================= fordon och folk ute på plattan =======================
let TRUCK = null;
function truckSprite(night) {
  TRUCK ||= {};
  if (TRUCK[night]) return TRUCK[night];
  const P = new Pix(30, 11);
  // tanken
  area(P, 9, 2, 20, 6, (X, Y, i, j) => {
    if ((i === 0 || i === 19) && (j === 0 || j === 5)) return null;
    const cs = [0xf4f6f8, 0xe0e4e8, 0xc8ced4, 0xb0b6be, 0x9aa0a8, 0x6a7078];
    let c = cs[j];
    if (i === 6 || i === 13) c = mul(c, 0.85);
    return night ? mul(c, 0.62) : c;
  });
  P.hl(10, 5, 18, night ? 0x8a2a2a : 0xd8303a);
  for (let k = 0; k < 4; k++) P.px(24 + k, 1 - (k > 1 ? 0 : 0), 0x6a7078);
  P.vl(27, 0, 2, 0x6a7078);
  // hytten fram (vänster)
  area(P, 1, 2, 8, 6, (X, Y, i, j) => ((i === 0 && j < 2) ? null : j < 3 && i > 1 ? (night ? 0xffe6a0 : 0x3a5a7a) : i === 0 ? 0xe4e8ec : night ? 0x9aa0ac : 0xf4f6f8));
  P.hl(0, 7, 30, 0x3a3e46); P.hl(1, 8, 28, 0x2a2c30);
  for (const wx of [3, 20, 25]) { P.rect(wx, 8, 3, 3, INK); P.px(wx + 1, 9, 0x6a7078); }
  P.rect(22, 3, 4, 3, 0x2a2c30);                               // slangtrumman
  const c = P.flush();
  TRUCK[night] = c;
  return c;
}
// liten ramparbetare (3×6), gående eller stående. vest = varselfärgen
function tinyPerson(ctx, x, y, frame, vest, night) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = night ? '#6a5a4a' : '#e0a97f'; ctx.fillRect(x + 1, y - 5, 1, 1);
  ctx.fillStyle = night ? '#b0a060' : '#f4f4ec'; ctx.fillRect(x + 1, y - 6, 1, 1);
  ctx.fillStyle = vest; ctx.fillRect(x, y - 4, 3, 2);
  ctx.fillStyle = night ? '#e8f0a0' : '#f4f6f8'; ctx.fillRect(x, y - 3, 3, 1);
  ctx.fillStyle = '#23283a';
  if (frame) { ctx.fillRect(x, y - 2, 1, 2); ctx.fillRect(x + 2, y - 2, 1, 2); } else ctx.fillRect(x + 1, y - 2, 1, 2);
}

// ======================= personer i scenen =======================
const COLLEAGUE = {
  skin: '#a06a43', hair: '#1d1714', style: 'bun', hat: null, top: 'jacket', shirt: '#1e2a44', accent: '#f4f1ea',
  bottom: 'pants', pants: '#1e2a44', shoes: '#1c1c1c', glasses: false, beard: false, build: 5, bag: null,
};
const CLEANER = {
  skin: '#e0a97f', hair: '#b9b3ab', style: 'short', hat: 'cap', cap: '#2aa39a', top: 'tee', shirt: '#2aa39a', accent: '#f4f1ea',
  bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: 'square', beard: 'mustache', build: 5, bag: null,
};
function adultLook(R = Math.random) { let L; let n = 0; do { L = makeLook(R); n++; } while (L.kid && n < 20); L.kid = false; if (L.build === 4) L.build = 5; return L; }
// Namnet ska passa den som står vid disken: en MAJA med helskägg ser ut som ett
// falskt pass fast det är äkta. Skägg = ett av pojknamnen, annars vilket som helst.
const GIRL_NAMES = new Set(['Alva', 'Elsa', 'Maja', 'Ella', 'Wilma', 'Saga', 'Nora', 'Vera', 'Liv', 'Stina', 'Ines', 'Greta', 'Leila', 'Mira', 'Aiko', 'Sofia', 'Olga', 'Birgitta', 'Agneta']);
function nameFor(look, R = Math.random) {
  const pool = look.beard ? FIRST_NAMES.filter((n) => !(GIRL_FIRST_NAMES || GIRL_NAMES).has(n)) : FIRST_NAMES;
  return pickR(R, pool.length ? pool : FIRST_NAMES).toUpperCase();
}
function kidLook(R = Math.random) { const L = makeLook(R); L.kid = true; L.build = 4; L.beard = false; return L; }

// repliker
const HELLO = [
  (c) => $t`Hej! Till ${c}, tack.`, (c) => $t`Hejsan! Jag ska till ${c}.`, (c) => $t`Goddag! ${c}, tack.`,
  (c) => $t`Hallå! En resa till ${c}.`, (c) => $t`Hej hej! ${c} blir det.`,
];
const HELLO_NIGHT = [(c) => $t`God kväll! Nattflyget till ${c}.`, (c) => $t`Hej... Nattplanet till ${c}, tack.`, (c) => $t`God natt nästan! ${c}, tack.`];
const WISH_SAY = {
  fonster: [$t('Fönsterplats, tack!'), $t('Vid fönstret om det går!'), $t('Jag vill titta ut - fönster!')],
  gang: [$t('Vid gången, tack!'), $t('Gången - jag har långa ben.'), $t('Gångplats, tack!')],
  egal: [$t('Spelar ingen roll var jag sitter.'), $t('Vilken plats som helst!'), $t('Var som helst går bra.')],
  ihop: [$t('Vi vill sitta tillsammans!'), $t('Kan vi sitta bredvid varandra?'), $t('Alla i samma rad, tack!')],
};
const WISH_WRONG = { fonster: $t('Nej, jag ville sitta vid FÖNSTRET!'), gang: $t('Jag sa ju GÅNGEN!'), ihop: $t('Då hamnar vi ju isär!'), egal: '' };
const KID_SAY = [$t('Mamma, titta - ett flygplan!'), $t('När är vi framme?'), $t('Jag vill sitta vid fönstret!'), $t('Får jag trycka på knappen?'), $t('Pappa, jag är hungrig!')];
const QUEUE_SAY = [$t('Det går långsamt i dag...'), $t('Hoppas vi hinner!'), $t('Titta, ett plan som landar!'), $t('Har du passen?'), $t('Jag glömde tandborsten...')];
const DOG_NAMES = [$t('Charlie'), $t('Bamse'), $t('Sigge'), $t('Molly'), $t('Ludde'), $t('Tussan')];
const DOG_FUR = [0xa8703a, 0xd8b078, 0x3a2a20, 0xe8e0d0, 0x8a5a3a];
const SURF_COL = [0x2aa39a, 0xd9433b, 0xe8b230, 0x2c6fb7, 0xd84a8a];

// ======================= jobba ihop: det som skickas mellan kollegorna =======================
// Resenärerna ur ett frö: i ett delat pass skickar skiftledaren bara fröet (och det som tvingats
// fram), och alla ritar ändå samma människor med samma pass, väska, önskan och platskarta (som i
// Vårdcentralen, Verkstaden och Tvätteriet).
function seedRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TYPES = ['normal', 'sen', 'familj', 'surf', 'hund'];
const WISHES = ['fonster', 'gang', 'egal', 'ihop'];
// resenärernas lägen i skiftledarens snap (index = kod) – och stegen (0 = ingen vid disken)
const P_ST = ['in', 'queue', 'todesk', 'desk', 'out', 'gone'];
const STEP_ST = [null, 'fram', ...STEPS.map((s) => s.id)];
const DIRS = ['down', 'up', 'left', 'right'];
// ljuden som skiftledarens utfall får spela hos den det gäller
const LJUD = new Set(['ok', 'click', 'coin', 'fel', 'miss', 'box', 'slide', 'door']);

export function makeJobbIncheck(A, { onDone } = {}) {
  const stats = { ok: 0, fel: 0, miss: 0 };
  const wage = JOBS?.incheckning?.wage ?? 13;
  const walker = createWalker({ top: 147, bottom: 181, left: 34, right: 250, spawn: SPOT.disk });
  walker.speed = 95;                          // korta, snabba steg bakom disken
  walker.setObstacles([
    [SPEC.x0, SPEC.top, SPEC.x1, SPEC.base],
    [SEND.x - 1, SEND.y, FEED.x1 + 4, CB.y0 + 4],
    [STOOL.x - 5, STOOL.y - 3, STOOL.x + 5, STOOL.y],
    [CRATE.x, CRATE.y - 5, CRATE.x + 16, CRATE.y],
  ]);
  walker.dir = 'up';
  // den som hoppar in på en kompis pass (💼-inbjudan) börjar vid lappskrivaren – väskorna är lediga
  if (A.coop?.host) { walker.px = SPOT.kiosk[0]; walker.py = SPOT.kiosk[1]; }
  const pops = makePops();
  const popLog = [];                  // de senaste puffarnas text (provet läser dem: syntes "HANN FÖRE!"?)
  const addPop = pops.add;
  pops.add = (x, y, txt, c) => { popLog.push(txt); if (popLog.length > 30) popLog.shift(); addPop(x, y, txt, c); };
  const talkP = createSpeech(), talkQ = createSpeech(), talkMe = createSpeech();
  // passets plan: längd (P.seconds), resenärstakt (P.pace), speltid (P.gameMin). Kön behåller
  // sina sex platser (sjunde skulle stå i stolsraden) och stolarna är bara kuliss.
  const P = planOf(A);
  const startMin = A.game?.min ?? 12 * 60;
  const mode = viewMode(((startMin + P.gameMin / 2) / 60) % 24);   // ljuset mitt i passet
  const night = mode === 'natt';
  const G = {
    back: paintBack(mode),
    apron: (() => { const P = new Pix(FW, FH); P.clip(WALL_X1, GY0, FW, GY1); paintApronFront(P, mode); return P.flush(); })(),
    frame: paintWinFrame(mode),
    postsBack: paintPosts(POSTS_BACK, POST_BACK_Y),
    postsFront: paintPosts(POSTS_FRONT, POST_FRONT_Y),
    chairs: paintChairs(night),
    counter: paintCounterLayer(night),
    belt: paintBeltFrame(),
    surf: paintBeltSurf(CB.s1 - CB.s0),
    feed: paintBeltSurf(FEED.y1 - FEED.y0, true),
    kiosk: (() => { const P = new Pix(FW, FH); paintKiosk(P); return P.flush(); })(),
    special: (() => { const P = new Pix(FW, FH); paintSpecial(P); return P.flush(); })(),
    lidC: paintSpecialLid(false), lidO: paintSpecialLid(true),
  };

  let t = 0, seq = 0, done = false, doneT = 0, reported = false, hover = null;
  let cur = null, step = null;                 // resenären vid disken och var vi är
  const queue = [];                            // i kön, först = närmast disken
  let npcs = [];                               // alla som rör sig i hallen (inkl. kö och disk)
  let carry = null;                            // { k: 'tag', di } | { k: 'kort' } | { k: 'surf'|'hund', bag }
  let scaleBag = null, weighT = 0;             // väskan på vågen och vägningens förlopp
  let repackT = 0, payT = 0;
  let kioskPrint = null;                       // { di, t }
  let cardT = -1, cardReady = false;           // boardingkortet på väg ut ur skrivaren
  let feedBags = [], beltBags = [];
  let lidT = 0, specialIn = null, jamT = 0;
  let spawnIn = 2.5, autoSpawn = true;
  let beltOff = 0, feedOff = 0, feedRun = 0;
  const traffic = { land: null, landNext: 2.5, taxi: null, truck: { ph: 'away', x: FW + 30, t: 3 }, tug: 0 };
  const crew = [
    { x: 196, y: 64, tx: 196, v: 9, wait: 1, vest: '#f07a1e' },
    { x: 238, y: 65, tx: 238, v: 8, wait: 3, vest: '#e8e030' },
    { x: 262, y: 64, tx: 262, v: 10, wait: 0.5, vest: '#f07a1e' },
  ];
  const colleague = { busy: 0, frame: 0, pass: null, passT: 4, sendT: 6 };
  const sitting = [];
  const cleaner = night ? { x: 60, dir: 1 } : null;
  let kidTalkT = 6, queueTalkT = 9, dogTalkT = 5;
  let qKid = null;                             // familjen vars barn pratar i kö-bubblan just nu
  let later = [];                              // små fördröjda repliker { at, fn }
  let passers = [], passIn = 0.8, beltIn = 2.5;  // folk som går förbi längs glasväggen, väskor från andra diskar
  const after = (sec, fn) => later.push({ at: t + sec, fn });

  // ---------- kameran (fyll-lägets beskärning) ----------
  // Den synliga rutan i canvaspixlar (main.js v.safe); fy0/fy1 = raderna mellan
  // topplisten och stegremsan där själva scenen syns.
  function band() {
    const s = A.view?.safe || globalThis.SF?.view?.safe || {};
    const x0 = clamp(Math.round(s.x0 ?? 0), 0, 100), x1 = clamp(Math.round(s.x1 ?? FW), x0 + 200, FW);
    const y0 = clamp(Math.round(s.y0 ?? 0), 0, 80), y1 = clamp(Math.round(s.y1 ?? FH), y0 + 110, FH);
    return { x0, x1, y0, y1, fy0: y0 + HUD_H, fy1: y1 - STRIP_H };
  }
  let camX = 0, camY = 0, camInit = false, offX = 0, offY = 0, dz = 0, mouse = null;
  // bakväggen närmare när bandet är lågt: planen på rullbanan (rad 29–40 + dz) ska
  // synas ovanför skärmen när man står vid disken (fötterna på rad 152)
  const depthFor = (b) => clamp(124 - (b.fy1 - b.fy0), 0, DZ_MAX);
  const walkEnd = () => (walker.path.length ? walker.path[walker.path.length - 1] : [walker.px, walker.py]);
  // Kameran rör sig ALDRIG av sig själv när ett steg byts – då skulle knappen man
  // siktar på glida undan under fingret. Den följer bara figuren när man själv
  // klickat iväg den (golvet längst ner), och vågrätt står den still så länge allt
  // som går att klicka på (specialskåpet till pelaren) får plats i rutan.
  function camTarget(b) {
    const [ex, ey] = walkEnd();
    // lodrätt: skärmen (och resenärens bubbla) upptill, figuren nertill – och i
    // övrigt så mycket av glasväggen som får plats
    const top = MON.y - 10;
    const bot = Math.max(SPOT.disk[1] + 1, Math.round(Math.max(walker.py, ey)) + 1);
    let oy = Math.min(b.fy0 - (GY0 + dz), b.fy1 - bot);
    if (bot - top > b.fy1 - b.fy0) oy = b.fy1 - bot;               // får inte plats: figuren först
    oy = clamp(oy, b.y1 - FH, b.y0);                                // aldrig utanför scenen
    // vågrätt: skåpet, tavlan och disken till pelaren (x 2–294) – så centrerat som möjligt
    const vw = b.x1 - b.x0, L = SPEC.x0, R = TOTEM.x1;
    let lx;
    if (R - L <= vw) lx = clamp((FW - vw) >> 1, Math.max(0, R - vw), Math.min(L, FW - vw));
    else lx = clamp(Math.round(Math.max(walker.px, 0) - (vw >> 1)), 0, FW - vw);   // mycket smal ruta: följ figuren
    return [b.x0 - lx, oy];
  }
  function stepCam(dt) {
    const b = band();
    dz = depthFor(b);
    const [tx, ty] = camTarget(b);
    if (!camInit) { camX = tx; camY = ty; camInit = true; }
    else {
      const mv = (c, tg) => { const d = tg - c; return Math.abs(d) < 0.4 ? tg : c + clamp(d * Math.min(1, dt * 8), -200 * dt, 200 * dt); };
      camX = mv(camX, tx); camY = mv(camY, ty);
    }
    offX = Math.round(camX); offY = Math.round(camY);
  }
  // den synliga delen av scenen (scenkoordinater) mellan topplisten och stegremsan
  const vis = () => { const b = band(); return { l: b.x0 - offX, r: b.x1 - offX, t: b.fy0 - offY, b: b.fy1 - offY }; };
  // pratbubblorna hålls under topplisten: svansen minst 24 rader ner (två rader text syns)
  const keepIn = (at) => () => { const p = typeof at === 'function' ? at() : at; return p && { x: p.x, y: Math.max(p.y, vis().t + 24) }; };

  // ---------- resenärerna ----------
  function rollType(R = Math.random) {
    const r = R();
    return r < 0.12 ? 'sen' : r < 0.25 ? 'familj' : r < 0.33 ? 'surf' : r < 0.41 ? 'hund' : 'normal';
  }
  function roundW(w) { let v = Math.round(w * 10) / 10; if (v > 22.8 && v < 23.5) v = v < 23.15 ? 22.6 : 23.8; if (v > 31.8 && v < 32.5) v = 33.1; return v; }
  function makeSeats(p, R = Math.random) {
    const ok = (occ) => {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
        if (occ[r][c]) continue;
        if (p.wish === 'fonster' && (c === 0 || c === 5)) return true;
        if (p.wish === 'gang' && (c === 2 || c === 3)) return true;
        if (p.wish === 'egal') return true;
        if (p.wish === 'ihop' && blockAt(occ, r, c, p.need)) return true;
      }
      return false;
    };
    for (let k = 0; k < 60; k++) {
      const occ = Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => R() < 0.5));
      // se till att det finns frestande fel också (lediga platser som inte passar)
      if (ok(occ) && occ.flat().filter((v) => !v).length >= 4) return occ;
    }
    return Array.from({ length: 3 }, () => Array.from({ length: 6 }, (_, c) => c === 1 || c === 4));
  }
  function makePassenger(type, opts = {}) {
    return buildPassenger(seq++, type, opts, (Math.random() * 0x7fffffff) | 0);
  }
  // Allt resenären är – typ (om den inte är given), utseende, namn, pass, väska, önskan och platskartan
  // – kommer ur fröet ps, så att kollegorna i ett delat pass bygger exakt samma person ur snappen.
  // opts = det som tvingats fram ({ fake, weight, wish, dest }); det följer också med (p.po).
  function buildPassenger(id, type, opts, ps) {
    const R = seedRng(ps);
    const rolled = rollType(R);
    type = type || rolled;
    const look = adultLook(R);
    const p = {
      id, ps, type, look, name: nameFor(look, R), born: `${1950 + ((R() * 56) | 0)}-${String(1 + ((R() * 12) | 0)).padStart(2, '0')}-${String(1 + ((R() * 28) | 0)).padStart(2, '0')}`,
      dest: opts.dest ?? ((R() * DEST.length) | 0), x: FW + 14, y: WALK_Y - 4, dir: 'left', path: [], state: 'in', slot: -1,
      speed: type === 'sen' ? 72 : 46 + R() * 8, kids: [], talkT: 0, patience: Infinity, pmax: 1, hop: 0,
      by: null,   // (ihop) den som checkar in resenären – bara hen jobbar med skärmen och kortet
    };
    p.po = [opts.fake === undefined ? -1 : opts.fake ? 1 : 0, opts.weight === undefined ? -1 : Math.round(opts.weight * 100),
      opts.wish === undefined ? -1 : WISHES.indexOf(opts.wish), opts.dest === undefined ? -1 : opts.dest];
    p.fake = opts.fake ?? (type !== 'familj' && R() < 0.15);
    p.photo = p.fake ? fakeOf(look, R) : look;
    if (type === 'familj') {
      const n = R() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k++) p.kids.push({ look: kidLook(R), dx: k === 0 ? -11 : 11, dy: 1 + k, hop: 0 });
    }
    p.need = 1 + p.kids.length;
    if (type === 'surf') p.bag = { kind: 'surf', col: pickR(R, SURF_COL), w: roundW(6 + R() * 7) };
    else if (type === 'hund') p.bag = { kind: 'hund', fur: pickR(R, DOG_FUR), dog: pickR(R, DOG_NAMES), w: roundW(9 + R() * 11) };
    else {
      const r = R();
      const w = opts.weight ?? (r < 0.08 ? 33 + R() * 5 : r < 0.3 ? 23.6 + R() * 8 : 9 + R() * 13.5);
      p.bag = { kind: 'case', style: (R() * 3) | 0, body: pickR(R, CASE_COLORS), w: roundW(w) };
    }
    p.wish = opts.wish ?? (type === 'familj' ? 'ihop' : pickR(R, ['fonster', 'fonster', 'gang', 'gang', 'egal']));
    p.seats = makeSeats(p, R);
    p.sel = null;
    return p;
  }
  function blockAt(occ, r, c, n) {
    const side = c < 3 ? 0 : 3;
    for (let s = side; s + n <= side + 3; s++) {
      if (c < s || c >= s + n) continue;
      let free = true;
      for (let k = s; k < s + n; k++) if (occ[r][k]) free = false;
      if (free) return [s, s + n - 1];
    }
    return null;
  }
  const slotPos = (i) => ({ x: W0.x + i * 19, y: LANE_Y });
  function route(p, pts, then) { p.path = pts.map(([x, y]) => [x, y]); p.then = then || null; }
  function relayoutQueue() {
    queue.forEach((p, i) => {
      if (p.slot === i && p.state === 'queue') return;
      p.slot = i;
      const s = slotPos(i);
      if (p.state === 'in') route(p, [[FW - 70, WALK_Y - 4], [310, LANE_Y], [s.x, s.y]], () => { p.state = 'queue'; p.dir = 'down'; });
      else { p.state = 'queue'; route(p, [[s.x, s.y]], () => { p.dir = 'down'; }); }
    });
  }
  function spawn(type, opts, walkIn = true) {
    if (queue.length >= 6 && walkIn) return null;
    const p = makePassenger(type, opts);
    npcs.push(p);
    if (p.type === 'sen' && queue.length) {
      queue.unshift(p);
      const g = queue[1];
      if (g) { qKid = null; talkQ.say(pick([$t('Hallå! Här står man i kö!'), $t('Hörru, det finns en kö!'), $t('Tränga sig före...')]), keepIn(() => ({ x: Math.round(g.x), y: Math.round(g.y) - 36 })), 2.6, { voice: g.look }); }
    } else queue.push(p);
    if (!walkIn) { const s = slotPos(queue.indexOf(p)); p.x = s.x; p.y = s.y; p.state = 'queue'; p.dir = 'down'; p.slot = queue.indexOf(p); }
    relayoutQueue();
    return p;
  }
  const inPlace = (p) => !p.path.length;
  function callNext() {
    if (cur || !queue.length) return;
    const p = queue[0];
    if (p.state !== 'queue' || !inPlace(p)) return;
    queue.shift();
    cur = p;
    step = 'fram';
    p.state = 'todesk';
    route(p, [[W0.x + 4, WALK_Y + 2], [DESK_P.x, DESK_P.y]], () => arriveDesk(p));
    relayoutQueue();
  }
  function arriveDesk(p) {
    if (cur !== p) return;
    p.state = 'desk'; p.dir = 'down';
    step = 'pass';
    const c = DEST[p.dest].say;
    let line = night ? pick(HELLO_NIGHT)(c) : pick(HELLO)(c);
    if (p.type === 'sen') { line = $t`Ursäkta! Mitt plan till ${c} går snart - snabbt, snälla!`; p.patience = p.pmax = 22; }
    else if (p.type === 'familj') line = $t`Hej! Vi ska till ${c} allihop!`;
    else if (p.type === 'surf') line = $t`Tjena! Till ${c} - och brädan ska med!`;
    else if (p.type === 'hund') line = $t`Hej! Till ${c} med ${p.bag.dog} här.`;
    say(p, line);
    play('click');
  }
  // resenären säger något – i ett delat pass följer skiftledarens repliker med snappen (alla hör dem)
  function say(p, txt, secs) {
    talk(p, txt, secs);
    if (p && txt && coop.active && coop.leader) { spk.n++; spk.id = p.id; spk.txt = txt; spk.secs = secs || 0; snapAsap(); }
  }
  function talk(p, txt, secs) {
    if (!p || !txt) return;
    if (qKid === p && talkQ.active()) talkQ.clear();   // barnet tystnar när föräldern pratar
    talkP.say(txt, keepIn(() => ({ x: Math.round(p.x), y: Math.round(p.y) - 40 })), secs, { voice: p.look });
  }
  function meSay(txt, secs) { talkMe.say(txt, keepIn(() => ({ x: Math.round(walker.px), y: Math.round(walker.py) - 44 })), secs, { self: true }); }
  function leaveDesk(p, flee = false) {
    p.state = 'out';
    p.speed = flee ? 78 : 40;
    route(p, [[DESK_P.x - 34, WALK_Y + 1], [-24, WALK_Y + 1]], () => { p.state = 'gone'; });
  }
  function endPassenger() {
    if (cur && !cur.bagGone) cur.bagOn = false;      // går hen utan att checka in tar hen väskan med sig
    cur = null; step = null;
    scaleBag = null; weighT = 0; repackT = 0; payT = 0;
    cardT = -1; cardReady = false;
    carry = null;
    kortBy = null; lyftBy = null; lyftBag = null;     // (kortet och specialväskan hörde till resenären)
  }

  // ---------- hjälpare ----------
  // Puffarna läggs där man jobbar men aldrig över det man ska läsa: det som hör
  // till skärmen ovanför skärmen, vid lappskrivaren ovanför skrivaren, pengarna
  // ovanför resenären och annars ovanför figuren – alltid inom den synliga rutan.
  const near = (s) => Math.abs(walker.px - SPOT[s][0]) < 14 && Math.abs(walker.py - SPOT[s][1]) < 10;
  function popAt(where) {
    if (where === 'mon' || (!where && near('disk'))) return [MON.x + (MON.w >> 1), MON.y - 13];
    if (where === 'kiosk' || (!where && near('kiosk'))) return [(KIOSK.x0 + KIOSK.x1) >> 1, KIOSK.top - 14];
    if (where === 'pax') return [DESK_P.x, DESK_P.y - 52];
    return [Math.round(walker.px), Math.round(walker.py) - 50];
  }
  function pop(txt, col, where) {
    const V = vis(), w = textW(SMALL, txt) + 4;
    let [x, y] = popAt(where);
    if (where === 'mon' || (!where && near('disk'))) x = Math.max(x, WALL_X1 + 1 + (w >> 1));   // inte över tavlan
    x = clamp(x, V.l + (w >> 1) + 2, V.r - (w >> 1) - 2);
    y = Math.max(y, V.t + 14);
    pops.add(x, y, txt, col);
  }
  function hint(txt, where) { pop(txt, '#ffd23f', where); play('click'); }
  function stepHint() {
    if (!cur) return $t('VÄNTA PÅ NÄSTA RESENÄR');
    if (step === 'fram') return $t('RESENÄREN KOMMER');
    return STEPS[STEP_IX[step]].hint;
  }
  const special = () => !!cur && cur.bag.kind !== 'case';

  // ---------- jobba tillsammans (delat pass via js/net/coop.js) ----------
  // Skiftledaren (den som varit längst vid disken) kör det gemensamma: kön och resenärerna (när de
  // kommer, vad de har med sig och vill, den stressades tålamod, vägen fram till disken och ut),
  // resenären vid disken med stegen, vågen, bandet, specialskåpet och boardingkortskrivaren. Läget
  // delas ~3 ggr/s; medarbetarna ser samma kö – resenärerna går vidare längs samma väg hos dem
  // mellan lägena – och skickar varje handling på något gemensamt som ett önskemål med det de såg
  // vid disken (och det de bär). Skiftledaren kör samma koll och samma kod åt dem och är ENDA
  // domaren. Arbetet delas: den som trycker GODKÄNN/NEKA checkar in resenären, som sedan är LÅST åt
  // hen – bara hen väger, väljer plats och tar och ger boardingkortet (den andra ser KOLLEGANS
  // RESENÄR). Väskorna är allas: lappen (utskriften går hos var och en – skrivaren skriver hur många
  // som helst), bandet och specialskåpet – och ihop får lappen sitta på och väskan komma iväg redan
  // medan platsen väljs, så att båda jobbar samtidigt. Har det ändrats vid disken när man väl är
  // framme, så att det inte går längre, syns HANN FÖRE!. Det egna: var man står, lappen man skrivit
  // ut – och kortet eller specialväskan man bär (skiftledaren vet vem som har dem; går någon hem
  // läggs de tillbaka och låset släpps). Poängen går till den som gjorde det; lagets rätt, fel och
  // missade delas lika vid passets slut. Ihop kommer resenärerna tätare (kön har kvar sina sex
  // platser – en sjunde skulle stå i stolsraden).
  const coop = makeShiftCoop(A, 'away:jobbincheck');
  let snapIn = 0, wasLead = true, wasCoop = false, maxN = 1, snaps = 0, ihopT = -1;
  let pend = null, queued = null;                   // medarbetarens önskemål som väntar på svar (och ett köat klick)
  let reqN = (Math.random() * 1e6) | 0;             // önskemålens löpnummer (samma nummer två gånger = samma önskemål)
  let kortBy = null, lyftBy = null, lyftBag = null; // vem som bär boardingkortet / specialväskan (null = ingen) – och väskan
  const team = { ok: 0, fel: 0, miss: 0 };          // LAGETS räkning – delas lika vid passets slut
  const spk = { n: 0, id: -1, txt: '', secs: 0 };   // resenärens senaste replik (nummer, vem, vad, hur länge)
  const seenReq = new Map();                        // (skiftledaren) id → senaste önskemålets nummer
  const absent = new Map();                         // (skiftledaren) id → sedan när kollegan inte syns vid disken
  const mate = () => coop.active && !coop.leader;
  const meId = () => coop.myId || '';
  const ihop = () => maxN > 1;                      // (delat pass: väskan får hanteras medan platsen väljs)
  const freeBy = (by) => by === null || by === undefined || by === '';
  // får `by` jobba med resenären p? (ingen har låset, eller hen själv – ensam är allt mitt)
  const owns = (p, by) => freeBy(p.by) || p.by === by || (!coop.active && maxN === 1);
  const snapAsap = () => { snapIn = 0; };
  const int = (v, dflt) => (Number.isInteger(v) ? v : dflt);
  const str = (v, n = 64) => (typeof v === 'string' ? v.slice(0, n) : '');
  const byId = (id) => npcs.find((p) => p.id === id) || null;
  const hudTitle = () => (maxN > 1 ? $t('INCHECKNINGEN IHOP') : $t('INCHECKNINGEN'));
  // har väskan fått sin lapp? (på vågen med lapp – eller på väg till specialskåpet)
  const tagged = () => (!!scaleBag && scaleBag.tag !== null && scaleBag.tag !== undefined) || lyftBy !== null;
  // får väskan iväg nu? (ensam: steget BAND – ihop redan medan platsen väljs, om lappen sitter på)
  const bandOk = () => step === 'band' || (ihop() && step === 'plats' && tagged());
  // vinken för den som tar väskorna ihop (stegremsan visar skärmens steg)
  function bagHint() {
    if (!cur || STEP_IX[step] === undefined) return stepHint();
    if (cur.bagGone) return $t('VÄSKAN ÄR IVÄG');
    if (STEP_IX[step] < STEP_IX.plats) return $t('VÄNTA PÅ VIKTEN');
    return tagged() ? STEPS[STEP_IX.band].hint : STEPS[STEP_IX.lapp].hint;
  }
  // det man ser vid disken (följer med klicket: har det ändrats när man väl är framme – och går det
  // inte längre – hann någon annan före)
  const sig = () => (cur ? `${cur.id}.${STEP_IX[step] ?? 9}.${tagged() ? 1 : 0}${cur.bagGone ? 1 : 0}${lyftBy !== null ? 1 : 0}${kortBy !== null ? 1 : 0}` : '-');

  // resenär: [id, frö, typ, tvingat falskt pass, vikt·100, önskan och destination (−1 = inte tvingat), läge (P_ST),
  // x, y, håll (DIRS), köplats, vägpunkter kvar, fart, tålamod·10 (−1 = ingen brådska), max·10, flaggor (väskan
  // på vågen 1, väskan iväg 2), vald plats (rad·100 + från·10 + till, −1 = ingen), låst åt]
  const paxEnc = (p) => [p.id, p.ps, Math.max(0, TYPES.indexOf(p.type)), ...p.po, P_ST.indexOf(p.state), Math.round(p.x), Math.round(p.y),
    Math.max(0, DIRS.indexOf(p.dir)), p.slot, p.path.length, Math.round(p.speed), p.patience === Infinity ? -1 : Math.round(p.patience * 10),
    Math.round(p.pmax * 10), (p.bagOn ? 1 : 0) | (p.bagGone ? 2 : 0), p.sel ? p.sel.r * 100 + p.sel.c0 * 10 + p.sel.c1 : -1, p.by || ''];
  const tagIx = (v) => (v === null || v === undefined ? -1 : v);
  const sendSnap = () => coop.send({
    t: 'snap',
    pa: npcs.map(paxEnc),
    q: queue.map((p) => p.id),                                                   // köns ordning
    d: [cur ? cur.id : -1, STEP_ST.indexOf(step)],                               // resenären vid disken och steget
    // väskan: [vikt·10, lappen (−1 = ingen), 1 = den bärs till specialskåpet] eller 0
    sb: scaleBag ? [Math.round(scaleBag.w * 10), tagIx(scaleBag.tag), 0] : lyftBag ? [Math.round(lyftBag.w * 10), tagIx(lyftBag.tag), 1] : 0,
    // vägningen·100, ompackningen·100, betalningen·10, stopp på bandet·10, boardingkortet·100, kortet klart
    ti: [Math.round(weighT * 100), Math.round(repackT * 100), Math.round(Math.max(0, payT) * 10), Math.round(Math.max(0, jamT) * 10), Math.round(cardT * 100), cardReady ? 1 : 0],
    ho: [kortBy, lyftBy],                                                        // vem som bär kortet / specialväskan
    sp: [spk.n, spk.id, spk.txt, Math.round(spk.secs * 10)],                     // resenärens senaste replik
    tm: [team.ok, team.fel, team.miss],
    sq: seq,   // (nästa id – tar någon annan över fortsätter numreringen efter det)
  });
  // vägen en resenär går i ett läge (samma hos alla – medarbetaren går vidare längs den mellan snapparna)
  function routeOf(p) {
    const s = slotPos(Math.max(0, p.slot));
    if (p.state === 'in') return [[FW - 70, WALK_Y - 4], [310, LANE_Y], [s.x, s.y]];
    if (p.state === 'queue') return [[s.x, s.y]];
    if (p.state === 'todesk') return [[W0.x + 4, WALK_Y + 2], [DESK_P.x, DESK_P.y]];
    if (p.state === 'out') return [[DESK_P.x - 34, WALK_Y + 1], [-24, WALK_Y + 1]];
    return [];
  }
  // en resenär ur snappen: samma objekt som förut om det är samma person (kön och disken pekar på hen)
  function paxDec(a) {
    if (!Array.isArray(a) || a.length < 19) return null;
    const id = int(a[0], -1);
    if (id < 0) return null;
    const ps = int(a[1], 0), type = TYPES[clamp(a[2] | 0, 0, TYPES.length - 1)];
    let p = byId(id);
    if (p && (p.ps !== ps || p.type !== type)) p = null;   // (samma id, en annan resenär)
    const fresh = !p;
    if (!p) {
      const po = [3, 4, 5, 6].map((i) => int(a[i], -1));
      p = buildPassenger(id, type, {
        fake: po[0] < 0 ? undefined : !!po[0], weight: po[1] < 0 ? undefined : po[1] / 100,
        wish: po[2] < 0 ? undefined : WISHES[clamp(po[2], 0, WISHES.length - 1)], dest: po[3] < 0 ? undefined : clamp(po[3], 0, DEST.length - 1),
      }, ps);
    }
    p.state = P_ST[clamp(a[7] | 0, 0, P_ST.length - 1)];
    p.gx = +a[8] || 0; p.gy = +a[9] || 0;
    p.slot = clamp(a[11] | 0, -1, 11);
    const r = routeOf(p), n = clamp(a[12] | 0, 0, r.length);
    p.gpath = n ? r.slice(r.length - n) : [];
    if (!p.gpath.length) p.dir = DIRS[clamp(a[10] | 0, 0, 3)];
    p.speed = clamp(a[13] | 0, 20, 90);
    p.pmax = Math.max(1, (a[15] | 0) / 10);
    p.patience = (a[14] | 0) < 0 ? Infinity : clamp((a[14] | 0) / 10, 0, p.pmax);
    const fl = a[16] | 0, sv = int(a[17], -1);
    p.bagOn = !!(fl & 1); p.bagGone = !!(fl & 2);
    p.sel = sv < 0 ? null : { r: clamp(Math.floor(sv / 100), 0, 2), c0: clamp(Math.floor(sv / 10) % 10, 0, 5), c1: clamp(sv % 10, 0, 5) };
    p.by = str(a[18]) || null;
    if (fresh) { p.x = p.gx; p.y = p.gy; }
    return p;
  }
  const applySnap = (m) => {
    if (Number.isFinite(m.sq)) seq = Math.max(seq, m.sq | 0);
    const was = cur, wasDesk = !!cur && cur.state === 'desk', wasReady = cardReady;
    if (Array.isArray(m.pa)) {
      const next = [];
      for (const a of m.pa.slice(0, 24)) { const p = paxDec(a); if (p && !next.includes(p)) next.push(p); }
      npcs = next;
    }
    if (Array.isArray(m.q)) {
      queue.length = 0;
      for (const id of m.q.slice(0, 12)) { const p = byId(int(id, -1)); if (p && !queue.includes(p)) queue.push(p); }
    }
    if (Array.isArray(m.d)) {
      const p = byId(int(m.d[0], -1));
      cur = p && (p.state === 'todesk' || p.state === 'desk') ? p : null;
      step = cur ? STEP_ST[clamp(m.d[1] | 0, 0, STEP_ST.length - 1)] : null;
    }
    scaleBag = null; lyftBag = null;
    if (Array.isArray(m.sb) && cur) {
      const tg = int(m.sb[1], -1);
      const b = { ...cur.bag, w: Math.max(0, (m.sb[0] | 0) / 10), tag: tg >= 0 ? clamp(tg, 0, DEST.length - 1) : null };
      if (m.sb[2]) lyftBag = b; else scaleBag = b;
    }
    if (Array.isArray(m.ti)) {
      // (vägningen och kortet räknas vidare här mellan lägena – bara ett tydligt hopp rättas)
      const w = clamp((m.ti[0] | 0) / 100, 0, 1), ct = (m.ti[4] | 0) / 100;
      if (Math.abs(weighT - w) > 0.15) weighT = w;
      repackT = Math.max(0, (m.ti[1] | 0) / 100); payT = (m.ti[2] | 0) / 10; jamT = (m.ti[3] | 0) / 10;
      cardReady = !!m.ti[5];
      if (ct < 0) cardT = -1; else if (cardT < 0 || Math.abs(cardT - ct) > 0.15) cardT = ct;
    }
    if (Array.isArray(m.ho)) { kortBy = typeof m.ho[0] === 'string' ? str(m.ho[0]) : null; lyftBy = typeof m.ho[1] === 'string' ? str(m.ho[1]) : null; }
    // det jag bär som skiftledaren håller reda på (kortet, specialväskan) – och lappen hörde till resenären som gick
    if (!pend) {
      const me = meId();
      if (kortBy === me) { if (carry?.k !== 'kort') carry = { k: 'kort' }; }
      else if (carry?.k === 'kort') carry = null;
      if (lyftBy === me && lyftBag) { if (carry?.k !== lyftBag.kind) carry = { k: lyftBag.kind, bag: lyftBag }; }
      else if (carry && (carry.k === 'surf' || carry.k === 'hund')) carry = null;
    }
    if (carry?.k === 'tag' && was && cur !== was) carry = null;
    if (Array.isArray(m.sp) && (m.sp[0] | 0) !== spk.n) {   // resenären säger något
      spk.n = m.sp[0] | 0;
      const p = byId(int(m.sp[1], -1));
      if (snaps && p) talk(p, str(m.sp[2], 96), (m.sp[3] | 0) > 0 ? (m.sp[3] | 0) / 10 : undefined);
    }
    if (Array.isArray(m.tm)) { team.ok = m.tm[0] | 0; team.fel = m.tm[1] | 0; team.miss = m.tm[2] | 0; }
    // det som händer vid disken hörs hos alla: resenären kommer fram, boardingkortet är utskrivet
    if (snaps && cur && cur.state === 'desk' && !(wasDesk && was === cur)) play('click');
    if (snaps && cardReady && !wasReady) play('click');
    snaps++;
  };
  // Medarbetarens hall mellan ledarens lägen: resenärerna går vidare längs samma väg, ompackningen
  // och kortskrivaren går – och den stressades tålamod rinner. Nästa snap rättar allt.
  function mateTick(dt) {
    for (const p of npcs) {
      if (p.gx === undefined) { p.gx = p.x; p.gy = p.y; }
      const wp = p.gpath && p.gpath[0];
      if (wp) {
        const sp = p.speed * dt, dx = wp[0] - p.gx, dy = wp[1] - p.gy, d = Math.hypot(dx, dy);
        p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        if (d <= sp) { p.gx = wp[0]; p.gy = wp[1]; p.gpath.shift(); if (!p.gpath.length && p.state !== 'out') p.dir = 'down'; }
        else { p.gx += dx / d * sp; p.gy += dy / d * sp; }
      }
      for (const k of p.kids) k.hop = Math.max(0, k.hop - dt);
      // figuren glider mjukt efter "spöket"
      const ex = p.gx - p.x, ey = p.gy - p.y;
      if (Math.hypot(ex, ey) > 24) { p.x = p.gx; p.y = p.gy; } else { const f = Math.min(1, dt * 10); p.x += ex * f; p.y += ey * f; }
    }
    if (repackT > 0) repackT = Math.max(0, repackT - dt);
    if (cardT >= 0 && !cardReady) cardT = Math.min(T_CARD, cardT + dt);
    if (cur && cur.state === 'desk' && cur.patience < Infinity && step !== 'kort') cur.patience = Math.max(0, cur.patience - dt);
  }
  // (den nya skiftledaren) vad som händer när en resenär som går kommer fram – samma som hos förra ledaren
  function thenOf(p) {
    if (p.state === 'in') return () => { p.state = 'queue'; p.dir = 'down'; };
    if (p.state === 'queue') return () => { p.dir = 'down'; };
    if (p.state === 'todesk') return () => arriveDesk(p);
    if (p.state === 'out') return () => { p.state = 'gone'; };
    return null;
  }
  // JAG tar över passet: hoppa över gamla id:n (inga krockar), resenärerna går vidare från där de syns
  // mot samma mål (kön, disken, utgången) och nästa resenär kommer snart. (Låset, kortet och
  // specialväskan hos den som gick släpps av sweepGone.)
  function takeOver() {
    seq = Math.max(seq, 1 + Math.max(-1, ...npcs.map((p) => p.id)));
    for (const p of npcs) {
      if (!p.gpath) continue;   // (en egen resenär från förut, ingen snap emellan – hens väg gäller)
      if (p.gx !== undefined) { p.x = p.gx; p.y = p.gy; }
      p.path = p.gpath.map(([x, y]) => [x, y]);
      p.then = thenOf(p);
      p.gx = p.gy = undefined; p.gpath = null;
      if (!p.path.length && p.then) { const th = p.then; p.then = null; th(); }
    }
    later = [];
    spawnIn = Math.min(spawnIn, 2);
    pend = null; queued = null;
    snapAsap();
  }
  // jag blir medarbetare: nästa snap bestämmer var alla är (skiftledarens gång och repliker gäller inte här)
  function becomeMate() {
    for (const p of npcs) { p.path = []; p.then = null; p.gx = undefined; p.gpath = null; }
    later = [];
  }
  // (skiftledaren) kortet eller specialväskan hos någon som gått läggs tillbaka: kortet i skrivaren,
  // väskan på vågen
  function releaseCard() { kortBy = null; if (cur && step === 'kort') { cardReady = true; cardT = T_CARD; } snapAsap(); }
  function releaseLyft() {
    const b = lyftBag;
    lyftBy = null; lyftBag = null;
    if (cur && !cur.bagGone && b && !scaleBag) scaleBag = b;
    snapAsap();
  }
  // (skiftledaren) den som gått från disken (en stund – inte bara ett ögonblick) har ingen resenär
  // längre och bär inget: låset släpps, kortet och väskan läggs tillbaka
  function sweepGone() {
    const ids = new Set([meId(), ...coop.peers().map((f) => f.id)]);
    const gone = (id) => {
      if (freeBy(id)) return false;
      if (ids.has(id)) { absent.delete(id); return false; }
      if (!absent.has(id)) absent.set(id, t);
      return t - absent.get(id) > 1.5;
    };
    if (cur && gone(cur.by)) { cur.by = null; snapAsap(); }
    if (kortBy !== null && gone(kortBy)) releaseCard();
    if (lyftBy !== null && gone(lyftBy)) releaseLyft();
  }
  // mitt pass är slut: resenären jag checkade in släpps, kortet och väskan jag bar läggs tillbaka
  function letGo() {
    if (!coop.active) return;
    carry = null; kioskPrint = null;
    if (mate()) { coop.send({ t: 'lamna' }); return; }
    const me = meId();
    if (cur && cur.by === me) cur.by = null;
    if (kortBy === me) releaseCard();
    if (lyftBy === me) releaseLyft();
    sendSnap(); coop.sentSnap();
  }

  // Den som gör något med det gemensamma: jag själv, eller – hos skiftledaren – en medarbetare vars
  // önskemål körs åt hen. Det hen bär följer med önskemålet och tillbaka i svaret.
  const meK = () => ({ by: meId(), fx: [], get carry() { return carry; }, set carry(v) { carry = v; } });
  const forK = (by, c) => ({ by, fx: [], carry: c, remote: true });
  const kOf = (by) => (freeBy(by) || by === meId() ? meK() : forK(by, null));
  // det man bär, i önskemålen och svaren: 0 (inget) | [0, lappens destination] | [1] kortet | [2] specialväskan
  const carryEnc = (c) => (!c ? 0 : c.k === 'tag' ? [0, c.di] : c.k === 'kort' ? [1] : [2]);
  // (skiftledaren) det kollegan säger att hen bär: en lapp gäller alltid (skrivaren skriver hur många
  // som helst) – kortet och specialväskan bara om skiftledaren vet att de är hens
  function claimOf(by, c) {
    if (!Array.isArray(c)) return null;
    if (c[0] === 0) return { k: 'tag', di: clamp(c[1] | 0, 0, DEST.length - 1) };
    if (c[0] === 1 && kortBy === by) return { k: 'kort' };
    if (c[0] === 2 && lyftBy === by && lyftBag) return { k: lyftBag.kind, bag: lyftBag };
    return null;
  }
  // (medarbetaren) svaret: det jag bär nu
  function carryDec(c) {
    if (!Array.isArray(c)) return null;
    if (c[0] === 0) return { k: 'tag', di: clamp(c[1] | 0, 0, DEST.length - 1) };
    if (c[0] === 1) return { k: 'kort' };
    const b = lyftBag || (cur ? { ...cur.bag } : null);
    return c[0] === 2 && b ? { k: b.kind, bag: b } : null;
  }
  // Utfallet av en handling: [slag, vem (spelar-id; '' = alla vid disken), ...]. Det som gäller mig (eller
  // alla) syns och hörs här direkt – ensam gäller allt mig; i ett delat pass (eller när jag kör en
  // medarbetares önskemål) följer resten med svaret ut.
  function utfall(k, who, kind, ...a) {
    const me = meId(), sprid = coop.active || !!k.remote;
    if (!who || who === me || !sprid) doFx(kind, a);
    if (sprid && who !== me) k.fx.push([kind, who, ...a]);
  }
  function doFx(kind, a) {
    if (kind === 's') { if (LJUD.has(a[0])) play(a[0]); }
    else if (kind === 'p') pop(String(a[0]).slice(0, 40), String(a[1] || '#ffd23f'), ['mon', 'kiosk', 'pax'].includes(a[2]) ? a[2] : undefined);
    else if (kind === 'H') hannFore();
    else if (kind === 'o') stats.ok++;
    else if (kind === 'f') stats.fel++;
    else if (kind === 'm') stats.miss++;
    else if (kind === 'M') meSay(String(a[0]).slice(0, 40), (a[1] | 0) / 10 || undefined);
    else if (kind === 'G') walker.walkTo(...SPOT.pass, () => { walker.dir = 'up'; klick(() => handla('ge')); });   // fram till resenären med kortet
    else if (kind === 'L') {   // specialskåpet: locket upp och väskan ner
      const hund = a[0] === 'hund';
      specialIn = { bag: hund ? { kind: 'hund', fur: a[1] | 0 } : { kind: 'surf', col: a[1] | 0 }, t: 0 };
      lidT = 1.2;
    } else if (kind === 'B') {   // väskan ner på matarbandet
      const tg = int(a[2], -1);
      feedBags.push({ kind: 'case', style: clamp(a[0] | 0, 0, 2), body: a[1] | 0, tag: tg >= 0 ? clamp(tg, 0, DEST.length - 1) : null, y: SCALE_BAG.y });
    } else if (kind === 'T') {   // resenären tackar när hen vänt sig om
      const p = byId(a[0] | 0), txt = String(a[1] || '').slice(0, 64);
      if (p) after(1.1, () => { if (p.state === 'out') { qKid = null; talkQ.say(txt, keepIn(() => ({ x: Math.round(p.x), y: Math.round(p.y) - 40 })), 2.2, { voice: p.look }); } });
    }
  }
  const kLjud = (k, s) => utfall(k, k.by, 's', s);                                        // hörs hos den det gäller
  const kPop = (k, who, txt, col, where) => utfall(k, who, 'p', txt, col, where || '');   // who '' = syns hos alla
  const hannFore = () => { play('miss'); pop($t('HANN FÖRE!'), '#ff6a6a'); };                   // någon annan hann först
  // fel: avdrag hos den som gjorde det (och i lagets räkning). Puffen vid skärmen syns hos alla,
  // en puff ovanför figuren bara hos den det gäller.
  function kFel(k, txt, where) { team.fel++; utfall(k, k.by, 'f'); kPop(k, where ? '' : k.by, txt, '#ff6a6a', where); kLjud(k, 'fel'); }
  // rätt: lönen hos den som gjorde det – "+18 KR" ovanför resenären syns hos alla
  function kGood(k) { team.ok++; utfall(k, k.by, 'o'); kPop(k, '', $t`+${wage} KR`, '#8ee03c', 'pax'); kLjud(k, 'coin'); }
  // skiftledaren: läget ut direkt efter en handling (FÖRE svaret – då har den som frågade redan det
  // nya läget när svaret kommer) och utfallet till alla
  function publish(k, svar) {
    if (!svar && !(coop.active && coop.leader && coop.settled)) return;
    sendSnap(); coop.sentSnap(); snapIn = 0.35;
    if (svar) coop.send({ t: 'res', by: k.by, fx: k.fx, s: 1, c: carryEnc(k.carry) });
    else if (k.fx.length) coop.send({ t: 'res', by: k.by, fx: k.fx });
  }
  // medarbetarens önskemål: man väntar på skiftledarens svar (högst 2,5 s – sedan kan man försöka igen).
  // n = löpnumret: kommer samma önskemål fram två gånger görs det EN gång (provet skickar två).
  function ask(m, n = 1) {
    m.n = ++reqN; m.c = carryEnc(carry);
    for (let i = 0; i < n; i++) coop.send(m);
    pend = { t: 2.5 };
  }
  function answered() { pend = null; }
  // ett klick som gör något: väntar medarbetaren på svar tas det så fort svaret kommit
  function klick(fn) {
    if (mate() && pend) { queued = fn; return; }
    fn();
  }
  coop.on('snap', (m) => { if (!coop.leader) applySnap(m); });
  coop.on('res', (m) => {   // ledarens utfall: puffarna hos alla – poängen och det man bär hos den det gäller
    const me = coop.myId, mine = m.by === me;
    if (coop.leader && !mine) return;   // (skiftledaren har redan visat det hos sig)
    if (mine && m.s && 'c' in m) carry = carryDec(m.c);
    for (const f of (Array.isArray(m.fx) ? m.fx : []).slice(0, 24)) {
      if (!Array.isArray(f)) continue;
      const who = str(f[1]);
      if (!who || who === me) doFx(f[0], f.slice(2));
    }
    if (mine && m.s) answered();
  });
  coop.on('do', (m, from) => {   // en medarbetares handling på något gemensamt – körs här, åt hen
    if (!coop.leader || !coop.settled || done) return;   // (bara den som kör disken avgör)
    if (Number.isInteger(m.n)) { if (seenReq.get(from) === m.n) return; seenReq.set(from, m.n); }   // (samma önskemål igen)
    publish(handlaAt(from, m), true);
  });
  // en kollega går hem (passet slut): låset släpps, kortet och väskan läggs tillbaka
  coop.on('lamna', (m, from) => {
    if (!coop.leader) return;
    if (cur && cur.by === from) cur.by = null;
    if (kortBy === from) releaseCard();
    if (lyftBy === from) releaseLyft();
    snapAsap();
  });

  // ---------- stegen ----------
  // Varje handling på det gemensamma har en KOLL (får k göra det nu? – ändrar inget) och en HANDLING
  // (do…) som ändrar det; k = den som gör det (puffar, ljud, poäng och det man bär går till hen).
  // Kollen svarar null (kör!), 'H' (någon annan hann före) eller [vink, var den syns, 1 = vinken
  // står sig även om något hänt vid disken under tiden].
  function chkScreen(by, want) {
    if (cur && !owns(cur, by)) return want === 'pass' ? 'H' : [$t('KOLLEGANS RESENÄR'), 'mon', 1];
    if (step !== want) return [stepHint(), 'mon'];
    if (want === 'vikt' && (weighT < 1 || repackT > 0)) return [$t('VÄNTA - DEN VÄGS'), 'mon', 1];
    return null;
  }
  function chk(a, k, x) {
    switch (a) {
      case 'pass': case 'vikt': return chkScreen(k.by, a);
      case 'plats': return chkScreen(k.by, 'plats') || (cur.seats[x[0]][x[1]] ? [$t('UPPTAGEN'), 'mon', 1] : null);
      case 'lapp':     // lappen i handen på väskan på vågen
        if (!k.carry || k.carry.k !== 'tag') return [null];
        if (!scaleBag) return [cur ? stepHint() : $t('VÅGEN ÄR TOM')];
        if (ihop() && tagged()) return [$t('LAPPEN SITTER REDAN')];
        return step === 'lapp' || (ihop() && step === 'plats') ? null : [ihop() ? bagHint() : stepHint()];
      case 'lyft':     // specialväskan av vågen (annars bara en vink)
        if (!scaleBag) return [cur ? stepHint() : $t('VÅGEN ÄR TOM')];
        if (!bandOk() || !special()) return [bandOk() ? $t('TRYCK PÅ SKICKA') : ihop() && cur ? bagHint() : stepHint()];
        return k.carry ? [$t('HÄNDERNA ÄR FULLA'), null, 1] : null;
      case 'skicka':
        if (!bandOk()) return [ihop() && cur ? bagHint() : stepHint()];
        return scaleBag ? null : [k.carry ? $t('TILL SPECIALSKÅPET!') : $t('VÅGEN ÄR TOM')];
      case 'special': {
        const kd = k.carry && k.carry.k;
        return kd === 'surf' || kd === 'hund' ? null : [kd ? $t('BARA SPECIALBAGAGE HÄR') : $t('SURFBRÄDOR OCH DJUR HIT'), null, 1];
      }
      case 'kort':
        if (step !== 'kort') return [stepHint()];
        if (cur && !owns(cur, k.by)) return [$t('KOLLEGANS RESENÄR'), null, 1];
        if (!cardReady) return [$t('SKRIVER UT...')];
        return k.carry ? [$t('HÄNDERNA ÄR FULLA'), null, 1] : null;
      case 'ge':       // kortet till resenären (gick det inte händer inget)
        return cur && k.carry && k.carry.k === 'kort' ? null : [null];
    }
    return [null];
  }
  // en koll som sa nej: vinken hos den det gäller – eller HANN FÖRE! om något ändrats vid disken
  // sedan hen klickade (v = det hen såg då)
  function refuse(k, e, v) {
    if (e === 'H' || (!e[2] && e[0] && v !== undefined && v !== sig() && (coop.active || k.remote))) { utfall(k, k.by, 'H'); return; }
    if (e[0]) { kPop(k, k.by, e[0], '#ffd23f', e[1]); kLjud(k, 'click'); }
  }
  function run(a, k, x) {
    if (a === 'pass') doPass(k, !!x);
    else if (a === 'vikt') doWeight(k, x);
    else if (a === 'plats') doSeat(k, x[0], x[1]);
    else if (a === 'lapp') doTag(k);
    else if (a === 'lyft') doLift(k);
    else if (a === 'skicka') doSend(k);
    else if (a === 'special') doSpecial(k);
    else if (a === 'kort') doTakeCard(k);
    else if (a === 'ge') doGive(k);
  }
  // Framme vid stationen (v = det jag såg vid disken när jag klickade; inget = som nu). Ensam eller
  // som skiftledare görs det direkt; som medarbetare blir det ett önskemål till skiftledaren med det
  // jag ser nu – skiftledaren kollar igen.
  function handla(a, x = null, v) {
    const k = meK(), e = chk(a, k, x);
    if (e) { refuse(k, e, v); return false; }
    if (mate()) { ask({ t: 'do', a, id: cur ? cur.id : -1, v: sig(), x }); return true; }
    run(a, k, x);
    publish(k, false);
    return true;
  }
  // (skiftledaren) en medarbetares önskemål: samma koll och samma handling, åt hen
  function handlaAt(from, m) {
    const a = String(m.a || ''), k = forK(from, claimOf(from, m.c));
    let x = null;
    if (a === 'pass') x = m.x ? 1 : 0;
    else if (a === 'vikt') { x = ['ok', 'avgift', 'packa'].includes(m.x) ? m.x : null; if (!x) return k; }
    else if (a === 'plats') { if (!Array.isArray(m.x)) return k; x = [clamp(m.x[0] | 0, 0, 2), clamp(m.x[1] | 0, 0, 5)]; }
    else if (!['lapp', 'lyft', 'skicka', 'special', 'kort', 'ge'].includes(a)) return k;
    const e = cur && cur.id === int(m.id, -1) ? chk(a, k, x) : 'H';   // (resenären hann gå)
    if (e) refuse(k, e, typeof m.v === 'string' ? m.v : undefined);
    else run(a, k, x);
    return k;
  }

  // PASS: godkänn eller neka – den som trycker checkar in resenären (ihop: låset)
  function doPass(k, approve) {
    cur.by = k.by;
    if (approve) {
      if (cur.fake) {
        kFel(k, $t('FEL PERSON!'), 'mon');
        say(cur, pick([$t('Hoppsan... hej då!'), $t('Ehm... jag glömde en sak!'), $t('Oj, fel pass - jag springer!')]));
        const p = cur; endPassenger(); leaveDesk(p, true);
        return;
      }
      kLjud(k, 'ok');
      step = 'vikt';
      scaleBag = { ...cur.bag, tag: null };
      cur.bagOn = true;
      weighT = 0;
      if (scaleBag.kind === 'case' && scaleBag.w > 23 && Math.random() < 0.3) say(cur, $t('Den kan vara lite tung...'));
      else if (scaleBag.kind === 'hund') say(cur, $t`Var snäll mot ${scaleBag.dog}!`);
    } else {
      if (cur.fake) {
        kGood(k);
        say(cur, pick([$t('Äh... det är visst min brors pass.'), $t('Hmpf. Det var värt ett försök.'), $t('Oj... fel pass. Förlåt!')]));
        const p = cur; endPassenger(); leaveDesk(p);
        return;
      }
      kFel(k, $t('DET VAR RÄTT PERSON!'), 'mon');
      say(cur, pick([$t('Men det är ju JAG på bilden!'), $t('Va? Det är jag, titta noga!'), $t('Jag har bara klippt mig!')]));
    }
  }
  function doWeight(k, choice) {
    const w = scaleBag.w, kg = fmtKg(w);
    if (choice === 'ok') {
      if (w <= 23) { kLjud(k, 'ok'); step = 'plats'; say(cur, pick(WISH_SAY[cur.wish])); return; }
      kFel(k, w > 32 ? $t`${kg} KG - FÖR TUNG!` : $t`${kg} KG - ÖVERVIKT!`, 'mon');
      return;
    }
    if (choice === 'avgift') {
      if (w <= 23) { kFel(k, $t('INGEN ÖVERVIKT!'), 'mon'); say(cur, $t`Avgift? Den väger ju bara ${kg} kilo!`); return; }
      if (w > 32) { kFel(k, $t('MAX 32 KG - PACKA OM!'), 'mon'); say(cur, $t('Får den inte ens följa med? Då packar jag om...')); return; }
      kLjud(k, 'box'); payT = 1.4;
      say(cur, pick([$t('Oj, 400 kronor... okej då.'), $t('Dyrt! Men visst, jag betalar.'), $t('Blipp! Där.')]));
      step = 'plats';
      const p = cur;
      after(1.6, () => { if (cur === p && step === 'plats') say(p, pick(WISH_SAY[p.wish])); });
      return;
    }
    if (choice === 'packa') {
      if (w <= 23) { kFel(k, $t('INGEN ÖVERVIKT!'), 'mon'); say(cur, $t('Packa om? Den är ju inte tung!')); return; }
      repackT = T_REPACK; kLjud(k, 'slide');
      say(cur, pick([$t('Okej, jag flyttar lite till handbagaget.'), $t('Suck. Kängorna får åka i handen.'), $t('Jag tar tröjorna på mig då!')]));
    }
  }
  function repackDone() {
    repackT = 0;
    if (!scaleBag || !cur) return;
    scaleBag.w = roundW(16 + Math.random() * 6.5); weighT = 0.25;
    say(cur, $t('Så där! Nu borde den klara sig.'));
    step = 'plats';
    const p = cur;
    after(1.7, () => { if (cur === p && step === 'plats') say(p, pick(WISH_SAY[p.wish])); });
  }
  function doSeat(k, r, c) {
    const occ = cur.seats;
    let sel = null;
    if (cur.wish === 'ihop') { const b = blockAt(occ, r, c, cur.need); if (b) sel = { r, c0: b[0], c1: b[1] }; }
    else if (cur.wish === 'fonster' ? c === 0 || c === 5 : cur.wish === 'gang' ? c === 2 || c === 3 : true) sel = { r, c0: c, c1: c };
    if (!sel) { kFel(k, $t('FEL PLATS!'), 'mon'); say(cur, WISH_WRONG[cur.wish]); return; }
    cur.sel = sel;
    kLjud(k, 'ok');
    // (ihop kan väskan redan ha fått sin lapp – eller kommit iväg – medan platsen valdes)
    if (cur.bagGone) toCard(); else step = tagged() ? 'band' : 'lapp';
    if (Math.random() < 0.5) say(cur, pick([$t('Perfekt, tack!'), $t('Toppen!'), $t('Bra, tack.')]), 1.6);
  }
  const seatLabel = (p) => (p.sel ? `${SEAT_ROW0 + p.sel.r}${SEAT_COLS[p.sel.c0]}${p.sel.c1 > p.sel.c0 ? '-' + SEAT_COLS[p.sel.c1] : ''}` : '');
  // (proven) en ledig plats som passar önskan hos resenären vid disken – eller en som inte gör det
  function seatFor(right) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      if (cur.seats[r][c]) continue;
      const good2 = cur.wish === 'ihop' ? !!blockAt(cur.seats, r, c, cur.need) : cur.wish === 'fonster' ? c === 0 || c === 5 : cur.wish === 'gang' ? c === 2 || c === 3 : true;
      if (good2 === right) return [r, c];
    }
    return null;
  }
  // lappskrivaren: min egen utskrift – lappen hamnar i min hand och kollas först när den sätts på väskan
  function actPrint(di) {
    const lo = ihop() ? STEP_IX.pass : STEP_IX.lapp;   // (ihop får lappen skrivas ut redan medan resenären checkas in)
    if (!cur || STEP_IX[step] === undefined || STEP_IX[step] < lo) { hint(!cur ? $t('INGEN RESENÄR') : ihop() ? bagHint() : stepHint()); return; }
    if (STEP_IX[step] > STEP_IX.lapp || (ihop() && (tagged() || cur.bagGone))) { hint(ihop() && cur.bagGone ? $t('VÄSKAN ÄR IVÄG') : $t('LAPPEN SITTER REDAN')); return; }
    if (kioskPrint) return;
    if (carry && carry.k !== 'tag') { hint($t('HÄNDERNA ÄR FULLA')); return; }
    if (carry) { pop($t('SLÄNGD'), '#d8d2c0'); carry = null; }
    kioskPrint = { di, t: 0 };
    play('slide');
  }
  // vågen/väskan: lappen på (har man en i handen), annars specialväskan av – eller en vink
  function bagKlick(v) { handla(carry && carry.k === 'tag' ? 'lapp' : 'lyft', null, v); }
  function doTag(k) {
    const di = k.carry.di;
    k.carry = null;
    if (di !== cur.dest) {
      kFel(k, $t('FEL LAPP!'));
      say(cur, $t`${DEST[di].code}? Jag ska ju till ${DEST[cur.dest].say}!`);
      return;
    }
    scaleBag.tag = di;
    kLjud(k, 'ok');
    if (step === 'lapp') step = 'band';
  }
  function doLift(k) {
    lyftBy = k.by; lyftBag = scaleBag;
    k.carry = { k: scaleBag.kind, bag: scaleBag };
    scaleBag = null;
    kLjud(k, 'click');
  }
  function doSend(k) {
    if (special()) {
      jamT = 0.9;
      kFel(k, scaleBag.kind === 'surf' ? $t('FASTNADE! SPECIALBAGAGE') : $t('INTE PÅ BANDET!'));
      say(cur, scaleBag.kind === 'surf' ? $t('Brädan får ju inte plats på bandet!') : $t`🐶 Voff! ${scaleBag.dog} ska inte åka band!`);
      return;
    }
    utfall(k, '', 'B', scaleBag.style, scaleBag.body, tagIx(scaleBag.tag));   // (väskan ner på matarbandet – hos alla)
    scaleBag = null;
    cur.bagGone = true;
    kLjud(k, 'slide');
    if (step === 'band') toCard();   // (ihop kan den gå iväg medan platsen väljs – då kommer kortet efter platsen)
  }
  function doSpecial(k) {
    const bag = lyftBag || k.carry.bag;
    utfall(k, '', 'L', bag.kind, bag.kind === 'hund' ? bag.fur : bag.col);   // (locket upp och väskan ner – hos alla)
    if (cur) cur.bagGone = true;
    k.carry = null; lyftBy = null; lyftBag = null;
    kLjud(k, 'door');
    if (bag.kind === 'hund' && cur) say(cur, $t`Hej då ${bag.dog}! Vi ses i ${DEST[cur.dest].say}!`);
    if (step === 'band') toCard();
  }
  function toCard() {
    step = 'kort';
    cardT = 0; cardReady = false;
  }
  // boardingkortet ur skrivaren – och sedan fram till resenären med det (walk = gå dit)
  function doTakeCard(k, walk = true) {
    k.carry = { k: 'kort' }; cardReady = false; cardT = -1; kortBy = k.by;
    kLjud(k, 'click');
    if (walk) utfall(k, k.by, 'G');
  }
  function doGive(k) {
    k.carry = null; kortBy = null;
    kGood(k);
    const p = cur;
    // jag önskar trevlig resa först, resenären tackar när hen vänt sig om
    utfall(k, k.by, 'M', pick([$t('Trevlig resa!'), $t('Välkommen tillbaka!'), $t('Ha en bra resa!')]), 13);
    const thanks = night ? pick([$t('Tack! God natt!'), $t('Tack så mycket, sov gott!')]) : pick([$t('Tack så mycket! Hej då!'), $t('Tack! Hej hej!'), $t('Toppen, tack!')]);
    utfall(k, '', 'T', p.id, thanks);
    endPassenger();
    leaveDesk(p);
  }
  function actPassenger() {
    if (!cur || cur.state !== 'desk') { hint($t('INGEN VID DISKEN')); return; }
    if (carry && carry.k === 'kort') { handla('ge'); return; }
    const c = DEST[cur.dest].say;
    const line = step === 'pass' ? $t`Till ${c}, tack.` : step === 'vikt' ? $t('Här är väskan.') : step === 'plats' ? pick(WISH_SAY[cur.wish])
      : step === 'lapp' ? $t`${c}, som sagt!` : step === 'band' ? (special() ? $t('Den ska väl som specialbagage?') : $t('Iväg med den!')) : $t('Får jag boardingkortet?');
    say(cur, line, 2.4);
  }

  // ---------- klickytor ----------
  const inR = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
  const KEYS = DEST.map((d, i) => ({ di: i, r: [KIOSK.x0 + 1 + (i & 1) * 16, KIOSK.top + 9 + (i >> 1) * 8, KIOSK.x0 + 1 + (i & 1) * 16 + 15, KIOSK.top + 9 + (i >> 1) * 8 + 7] }));
  const seatRect = (r, c) => { const x = SCR.x + [6, 14, 22, 35, 43, 51][c], y = SCR.y + 9 + r * 9; return [x, y, x + 7, y + 7]; };
  function monButtons() {
    const X = SCR.x, Y = SCR.y;
    if (!cur) return [];
    // (v = det man såg vid disken när man klickade – se handla)
    if (step === 'pass') return [
      { id: 'godkann', label: $t('GODKÄNN'), r: [X + 2, Y + 27, X + 34, Y + 35], col: 0x2f8f46, act: (v) => handla('pass', 1, v) },
      { id: 'neka', label: $t('NEKA'), r: [X + 37, Y + 27, X + 62, Y + 35], col: 0xb8302a, act: (v) => handla('pass', 0, v) },
    ];
    if (step === 'vikt') return [
      { id: 'ok', label: $t('OK'), r: [X + 37, Y + 9, X + 62, Y + 17], col: 0x2f8f46, act: (v) => handla('vikt', 'ok', v) },
      { id: 'avgift', label: $t('AVGIFT'), r: [X + 37, Y + 18, X + 62, Y + 26], col: 0xc8902a, act: (v) => handla('vikt', 'avgift', v) },
      { id: 'packa', label: $t('PACKA'), r: [X + 37, Y + 27, X + 62, Y + 35], col: 0x3a5a9a, act: (v) => handla('vikt', 'packa', v) },
    ];
    if (step === 'plats') {
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) out.push({ id: `plats-${SEAT_ROW0 + r}${SEAT_COLS[c]}`, seat: [r, c], r: seatRect(r, c), act: (v) => handla('plats', [r, c], v) });
      return out;
    }
    return [];
  }
  function targets() {
    const T = [];
    for (const b of monButtons()) T.push({ id: b.id, r: b.r, spot: 'disk', name: b.label || (b.seat ? $t`PLATS ${`${SEAT_ROW0 + b.seat[0]}${SEAT_COLS[b.seat[1]]}`}` : ''), act: b.act, btn: b });
    for (const k of KEYS) T.push({ id: 'kod-' + DEST[k.di].code, r: k.r, spot: 'kiosk', name: `${DEST[k.di].code} ${DEST[k.di].city}`, act: () => actPrint(k.di), key: k });
    T.push({ id: 'skicka', r: [SEND.x - 1, SEND.y - 1, SEND.x + 11, SEND.y + 19], spot: 'vag', name: $t('SKICKA'), act: (v) => handla('skicka', null, v) });
    T.push({ id: 'vaska', r: [SCALE.x0 - 8, 98, SCALE.x1 + 6, TOP1 + 2], spot: 'vag', name: scaleBag ? $t('VÄSKAN') : $t('VÅGEN'), act: bagKlick });
    // (kortet ur skrivaren – sedan går man själv fram till resenären med det, se doTakeCard)
    T.push({ id: 'kort', r: [BPRN.x - 2, BPRN.y - 2, BPRN.x + BPRN.w + 2, TOP1 + 1], spot: 'bprn', name: $t('BOARDINGKORT'), act: (v) => handla('kort', null, v) });
    if (cur && cur.state === 'desk') T.push({ id: 'resenar', r: [cur.x - 9, cur.y - 40, cur.x + 9, TOP0], spot: 'pass', name: cur.name, act: actPassenger });
    T.push({ id: 'special', r: [SPEC.x0, SPEC.top - 4, SPEC.x1 + 2, SPEC.base], spot: 'special', name: $t('SPECIALBAGAGE'), act: (v) => handla('special', null, v) });
    T.push({ id: 'skrivare', r: [KIOSK.x0, KIOSK.top - 4, KIOSK.x1, KIOSK.base], spot: 'kiosk', name: $t('LAPPSKRIVAREN'), act: () => hint($t('TRYCK PÅ RÄTT KOD')) });
    T.push({ id: 'disk', r: [MON.x, MON.y, MON.x + MON.w, TOP1], spot: 'disk', name: $t('SKÄRMEN'), act: () => hint(stepHint()) });
    return T;
  }
  const targetAt = (x, y) => targets().find((tg) => inR(x, y, tg.r)) || null;
  // canvaspunkt → scenpunkt; topplisten och stegremsan ligger ovanpå scenen och tar inga klick
  const inScene = (x, y) => { const b = band(); return x >= b.x0 && x < b.x1 && y >= b.fy0 && y < b.fy1; };
  const targetAtScreen = (x, y) => (inScene(x, y) ? targetAt(x - offX, y - offY) : null);
  const EXIT_R = [FW - 44, 205, FW, 216];         // canvaskoordinater – sätts av drawStrip
  // gå till stationen och gör det där; v = det man såg vid disken när man klickade (har det ändrats
  // när man kommer fram och går det inte längre hann någon annan före). Väntar man ihop på
  // skiftledarens svar tas klicket så fort svaret kommit.
  function doTarget(tg) {
    const [sx, sy] = SPOT[tg.spot], v = sig();
    walker.walkTo(sx, sy, () => { walker.dir = tg.spot === 'special' ? 'left' : 'up'; klick(() => tg.act(v)); });
  }

  // ---------- uppdatering ----------
  function updNpc(p, dt) {
    const wp = p.path[0];
    if (wp) {
      const sp = p.speed * dt, dx = wp[0] - p.x, dy = wp[1] - p.y, d = Math.hypot(dx, dy);
      p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      if (d <= sp) { p.x = wp[0]; p.y = wp[1]; p.path.shift(); if (!p.path.length) { const th = p.then; p.then = null; th?.(); } }
      else { p.x += dx / d * sp; p.y += dy / d * sp; }
    }
    for (const k of p.kids) k.hop = Math.max(0, k.hop - dt);
  }
  function updTraffic(dt) {
    // landande plan: inflygning snett uppifrån höger, sättningen, utrullningen
    traffic.landNext -= dt;
    if (!traffic.land && traffic.landNext <= 0) {
      const takeoff = Math.random() < 0.3;
      traffic.land = takeoff ? { ph: 'roll', x: WALL_X1 - 30, y: RWY - 8, v: 6, liv: (Math.random() * LIVERY.length) | 0, dir: 1, takeoff: true }
        : { ph: 'app', x: FW + 8, y: GY0 + 1, v: 34, liv: (Math.random() * LIVERY.length) | 0, dir: -1 };
      traffic.landNext = 13 + Math.random() * 6;
    }
    const L = traffic.land;
    if (L) {
      if (L.takeoff) {
        L.v = Math.min(60, L.v + 16 * dt);
        L.x += L.v * dt;
        if (L.v > 42) { L.ph = 'climb'; L.y -= (L.v - 40) * 0.35 * dt; }
        if (L.x > FW + 40 || L.y < GY0 - 14) traffic.land = null;
      } else if (L.ph === 'app') {
        L.x -= L.v * dt;
        const td = 330, gy = RWY - 8;
        L.y = gy - Math.max(0, (L.x - td) * 0.19);
        if (L.x <= td) { L.ph = 'roll'; L.y = gy; L.smoke = 0.7; }
      } else {
        L.v = Math.max(9, L.v - 7 * dt);
        L.x -= L.v * dt;
        if (L.smoke) L.smoke = Math.max(0, L.smoke - dt);
        if (L.x < WALL_X1 - 40) traffic.land = null;
      }
    }
    // tankbilen: kör in under vingen, tankar, kör vidare
    const T = traffic.truck;
    T.t -= dt;
    if (T.ph === 'away' && T.t <= 0) { T.ph = 'in'; T.x = FW + 30; }
    if (T.ph === 'in') { T.x -= 22 * dt; if (T.x <= 208) { T.x = 208; T.ph = 'tank'; T.t = 14; } }
    else if (T.ph === 'tank' && T.t <= 0) T.ph = 'out';
    else if (T.ph === 'out') { T.x -= 22 * dt; if (T.x < WALL_X1 - 34) { T.ph = 'away'; T.t = 5; } }
    traffic.tug = (traffic.tug + dt * 13) % 560;
    for (const c of crew) {
      if (c.wait > 0) { c.wait -= dt; if (c.wait <= 0) c.tx = 186 + Math.random() * 96; continue; }
      const d = c.tx - c.x;
      if (Math.abs(d) < 0.6) { c.wait = 1.5 + Math.random() * 3; } else c.x += Math.sign(d) * Math.min(Math.abs(d), c.v * dt);
    }
  }
  function updColleague(dt) {
    if (night) return;
    colleague.passT -= dt;
    if (!colleague.pass && colleague.passT <= 0) {
      colleague.pass = { look: adultLook(), x: FW + 12, y: WALK_Y + 2, state: 'in', path: [[352, WALK_Y + 2], [352, 131]], speed: 34, dir: 'left', kids: [], then: null, t: 0 };
      colleague.pass.then = () => { colleague.pass.state = 'desk'; colleague.pass.dir = 'down'; colleague.pass.t = 9 + Math.random() * 4; };
    }
    const q = colleague.pass;
    if (q) {
      updNpc(q, dt);
      if (q.state === 'desk') {
        q.t -= dt;
        colleague.busy = 1;
        if (q.t < 4 && !q.sent) { q.sent = true; beltBags.push({ kind: 'case', style: (Math.random() * 3) | 0, body: pick(CASE_COLORS), x: 374, y: FEED.y0, down: true, tag: (Math.random() * 6) | 0 }); }
        if (q.t <= 0) { q.state = 'out'; q.speed = 40; q.path = [[330, WALK_Y + 3], [FW + 20, WALK_Y + 3]]; q.then = () => { colleague.pass = null; colleague.passT = 3 + Math.random() * 4; }; }
      } else colleague.busy = 0;
    }
  }
  function updPassers(dt) {
    passIn -= dt;
    if (passIn <= 0) {
      passIn = (night ? 9 : 4) + Math.random() * 4;
      const dir = Math.random() < 0.5 ? 1 : -1;
      passers.push({ look: adultLook(), x: dir > 0 ? WALL_X1 - 14 : FW + 14, y: 78 + Math.round(Math.random() * 7), dir, v: 24 + Math.random() * 16, bag: Math.random() < 0.75 ? { body: pick(CASE_COLORS), style: Math.random() < 0.75 ? 0 : 2 } : null, id: seq++ });
    }
    for (const p of passers) p.x += p.dir * p.v * dt;
    passers = passers.filter((p) => p.x > WALL_X1 - 26 && p.x < FW + 24);
    // väskor från diskarna längre bort glider förbi på uppsamlingsbandet
    beltIn -= dt;
    if (beltIn <= 0) {
      beltIn = (night ? 8 : 4) + Math.random() * 5;
      beltBags.push({ kind: 'case', style: (Math.random() * 3) | 0, body: pick(CASE_COLORS), x: FW + 12, y: CB.s0 + 4, tag: (Math.random() * DEST.length) | 0 });
    }
  }
  function updBags(dt) {
    // matarbandet: väskan glider ner och svänger in på uppsamlingsbandet
    feedRun = Math.max(0, feedRun - dt);
    for (const b of feedBags) { b.y += 34 * dt; feedRun = 0.3; if (b.y >= CB.s0 + 4) { b.done = true; beltBags.push({ ...b, x: SCALE_BAG.x, y: CB.s0 + 4 }); } }
    feedBags = feedBags.filter((b) => !b.done);
    for (const b of beltBags) {
      if (b.down) { b.y += 30 * dt; if (b.y >= CB.s0 + 4) { b.down = false; b.y = CB.s0 + 4; } continue; }
      b.x -= 26 * dt;
    }
    beltBags = beltBags.filter((b) => b.x > -14);
  }
  function update(dt) {
    stepCam(dt);
    // hovringen räknas om varje bildruta från senaste musläget: byts resenären
    // eller glider kameran står etiketten aldrig kvar över fel sak
    hover = !done && mouse ? targetAtScreen(mouse.x, mouse.y) : null;
    pops.update(dt);
    updTraffic(dt);
    updPassers(dt);
    beltOff = (beltOff + 26 * dt) % 1e6;
    if (feedRun > 0 || feedBags.length) feedOff = (feedOff + 34 * dt) % 1e6;
    updBags(dt);
    if (lidT > 0) lidT -= dt;
    if (specialIn) { specialIn.t += dt; if (specialIn.t > 0.8) specialIn = null; }
    if (cleaner) { cleaner.x += cleaner.dir * 7 * dt; if (cleaner.x > 176 || cleaner.x < 70) cleaner.dir *= -1; }
    if (done) {
      coop.tick(); coop.resign();   // MITT pass är slut – lämna över ledningen direkt (även på lönebeskedet)
      doneT += dt;
      if (doneT > 1.2 && !reported) {
        reported = true;
        if (maxN > 1) {   // jobbat ihop: laget delar lika på rätt, fel och missade
          const sh = (v) => Math.round(v / maxN);
          onDone?.({ ok: sh(team.ok), fel: sh(team.fel), miss: sh(team.miss), delat: maxN, lagOk: team.ok, lagFel: team.fel });
        } else onDone?.(stats);
      }
      return;
    }
    t += dt;
    if (t >= P.seconds) { done = true; pend = null; queued = null; letGo(); return; }
    walker.update(dt);
    updColleague(dt);
    if (jamT > 0) jamT -= dt;
    if (payT > 0) payT -= dt;
    // vägningen räknar upp
    if (scaleBag && weighT < 1) { const w0 = weighT; weighT = Math.min(1, weighT + dt / T_WEIGH); if (w0 < 0.35 && weighT >= 0.35) play('box'); }
    for (const l of later) if (t >= l.at) { l.done = true; l.fn(); }
    later = later.filter((l) => !l.done);
    // lappskrivaren (min egen utskrift – även som medarbetare)
    if (kioskPrint) { kioskPrint.t += dt; if (kioskPrint.t >= T_PRINT) { carry = { k: 'tag', di: kioskPrint.di }; kioskPrint = null; play('click'); } }
    if (pend) { pend.t -= dt; if (pend.t <= 0) answered(); }   // inget svar (ledaren gick?) – då får man försöka igen
    coop.tick();
    if (coop.active) maxN = Math.max(maxN, coop.peers().length + 1);
    if (coop.active !== wasCoop) {   // en kollega kom in: resenärerna kommer tätare
      wasCoop = coop.active;
      if (wasCoop) { play('knock'); pop($t('NI JOBBAR IHOP!'), '#8ee03c', 'pax'); ihopT = t; }
    }
    // Skiftledaren (eller solo) kör kön och disken; medarbetare följer ledarens läge
    const iLead = !coop.active || (coop.leader && coop.settled);
    if (iLead && !wasLead) takeOver();
    else if (!iLead && wasLead) becomeMate();
    wasLead = iLead;
    if (iLead) leadTick(dt); else mateTick(dt);
    // småprat: barn, kön, hunden (bara för syns skull – var och en har sitt eget)
    kidTalkT -= dt; queueTalkT -= dt; dogTalkT -= dt;
    if (kidTalkT <= 0) {
      kidTalkT = 7 + Math.random() * 6;
      // barnet väntar tills ingen annan pratar – annars hamnar bubblan ovanpå förälderns
      const fam = npcs.find((p) => p.kids.length && p.state !== 'out');
      if (fam && (talkP.active() || talkQ.active())) kidTalkT = 1.2;
      else if (fam) { const k = fam.kids[0]; k.hop = 0.6; qKid = fam; talkQ.say(pick(KID_SAY), keepIn(() => ({ x: Math.round(fam.x + k.dx), y: Math.round(fam.y) - 35 })), 2.6, { voice: k.look }); }
    }
    if (queueTalkT <= 0) {
      queueTalkT = 10 + Math.random() * 8;
      const q = queue.find((p) => p.state === 'queue' && !p.path.length && !(p.gpath && p.gpath.length) && !p.kids.length);
      if (q && !talkQ.active()) { qKid = null; talkQ.say(pick(QUEUE_SAY), keepIn(() => ({ x: Math.round(q.x), y: Math.round(q.y) - 36 })), 2.6, { voice: q.look }); }
    }
    if (dogTalkT <= 0) {
      dogTalkT = 6 + Math.random() * 5;
      if (scaleBag?.kind === 'hund' && !talkP.active()) talkP.say($t('🐶 Voff!'), keepIn({ x: SCALE_BAG.x, y: SCALE_BAG.y - 10 }), 1.4, { animal: 'hund' });
    }
    // det köade klicket (det kom medan skiftledaren svarade)
    if (!pend && queued && !done) { const q = queued; queued = null; q(); }
  }
  // Skiftledarens (och den ensammas) disk: ompackningen, kortskrivaren, nya resenärer, kön och den
  // stressades tålamod – och läget ut till medarbetarna ~3 ggr/s
  function leadTick(dt) {
    if (repackT > 0) { repackT -= dt; if (repackT <= 0) { repackDone(); if (coop.active) snapAsap(); } }
    // boardingkortet
    if (cardT >= 0 && !cardReady) { cardT += dt; if (cardT >= T_CARD) { cardReady = true; play('click'); if (coop.active) snapAsap(); } }
    // nya resenärer (tätare med vanan – P.pace – och ihop ännu tätare; kön har kvar sina sex platser)
    if (autoSpawn) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = ((night ? 8.5 : 5.2) - 1.5 * Math.min(1, t / P.seconds) + Math.random() * 2) * P.pace * (coop.active ? 0.45 : 1);
        if (spawn() && coop.active) snapAsap();
      }
    }
    for (const p of npcs) updNpc(p, dt);
    npcs = npcs.filter((p) => p.state !== 'gone');
    callNext();
    // den stressade ger upp (missen hör till den som checkade in hen – ingen? då skiftledaren)
    if (cur && cur.type === 'sen' && cur.state === 'desk' && step !== 'kort') {
      cur.patience -= dt;
      if (cur.patience <= 0) {
        const k = kOf(cur.by);
        team.miss++; utfall(k, k.by, 'm'); utfall(k, '', 's', 'miss');
        kPop(k, '', $t('HANN INTE!'), '#d8d2c0', 'pax');
        say(cur, $t('Jag hinner inte! Jag springer till en annan disk!'));
        const p = cur; endPassenger(); leaveDesk(p, true);
        publish(k, false);
      }
    }
    if (coop.active || maxN > 1) sweepGone();
    if (coop.active) { snapIn -= dt; if (snapIn <= 0) { snapIn = 0.35; sendSnap(); coop.sentSnap(); } }
  }

  // ---------- rita ----------
  function drawApron(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.rect(WALL_X1, GY0, FW - WALL_X1, GY1 - GY0); ctx.clip();
    // radarskålen
    const ph = Math.floor(t * 3) % 4;
    ctx.fillStyle = night ? '#4a5064' : '#d8dce2'; ctx.fillRect(356 + [0, 1, 2, 1][ph], 26, [5, 3, 1, 3][ph], 1);
    // landande/startande plan på rullbanan
    const L = traffic.land;
    if (L) {
      const px = Math.round(L.x), py = Math.round(L.y), gear = L.ph !== 'climb' || L.y > RWY - 14;
      ctx.drawImage(smallPlane(L.liv, L.dir, night, gear), px, py);
      if (night || mode === 'skymning') {
        // landningsljuset lyser framåt
        const fx = L.dir < 0 ? px - 1 : px + 36;
        ctx.fillStyle = '#fff8dc'; ctx.fillRect(fx, py + 7, 1, 1);
        ctx.fillStyle = 'rgba(255,248,220,0.35)'; ctx.fillRect(L.dir < 0 ? fx - 6 : fx + 1, py + 7, 6, 1);
        ctx.fillStyle = 'rgba(255,248,220,0.18)'; ctx.fillRect(L.dir < 0 ? fx - 12 : fx + 1, py + 6, 12, 3);
      }
      if (Math.floor(t * 2.4) % 2 === 0) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(px + 17, py + 4, 1, 1); }
      if (t % 1.1 < 0.07) { ctx.fillStyle = '#ffffff'; ctx.fillRect(L.dir < 0 ? px + 35 : px, py + 6, 1, 1); }
      if (L.smoke) {
        const a = L.smoke / 0.7;
        ctx.fillStyle = `rgba(230,230,235,${(0.7 * a).toFixed(2)})`;
        ctx.fillRect(px + 20, py + 9, 4, 2); ctx.fillRect(px + 23 + Math.round((1 - a) * 6), py + 8, 3, 2);
      }
    }
    ctx.drawImage(G.apron, 0, 0);
    // fyren på planet vid gaten
    if (Math.floor(t * 1.6) % 2 === 0) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(BIG_PL.x + 107 - 60, BIG_PL.y + 9, 1, 1); ctx.fillRect(BIG_PL.x + 107 - 56, BIG_PL.y + 21, 1, 1); }
    // tankbilen med slangen upp till vingen
    const T = traffic.truck;
    if (T.ph !== 'away') {
      const tx = Math.round(T.x), ty = 54;
      ctx.drawImage(truckSprite(night), tx, ty);
      if (T.ph === 'tank') {
        ctx.fillStyle = '#1a1a1e';
        pline(ctx, tx + 23, ty + 3, tx + 26, ty - 2);
        pline(ctx, tx + 26, ty - 2, tx + 30, ty - 4);
        tinyPerson(ctx, tx + 17, ty + 11, 0, '#e8e030', night);
      }
      if (Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = '#ffb020'; ctx.fillRect(tx + 4, ty + 1, 2, 1); }
    }
    // bagagetåget på servicevägen
    const gx = Math.round(traffic.tug - 90), gy = 62;
    for (let k = 0; k < 3; k++) {
      const cx = gx - 10 - k * 10;
      ctx.fillStyle = css(night ? mul([0xd8303a, 0x2c6fb7, 0x2f8f46][k], 0.6) : [0xd8303a, 0x2c6fb7, 0x2f8f46][k]); ctx.fillRect(cx, gy - 1, 8, 3);
      ctx.fillStyle = night ? '#5a5e6a' : '#9aa0a8'; ctx.fillRect(cx, gy + 2, 8, 1);
      ctx.fillStyle = '#16171a'; ctx.fillRect(cx + 1, gy + 3, 1, 1); ctx.fillRect(cx + 6, gy + 3, 1, 1);
    }
    ctx.fillStyle = night ? '#a89030' : '#f0c020'; ctx.fillRect(gx, gy - 1, 7, 4);
    ctx.fillStyle = night ? '#ffe6a0' : '#2a3440'; ctx.fillRect(gx + 1, gy - 3, 3, 2);
    ctx.fillStyle = '#16171a'; ctx.fillRect(gx + 1, gy + 3, 2, 1); ctx.fillRect(gx + 5, gy + 3, 2, 1);
    if (Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = '#ff9a2a'; ctx.fillRect(gx + 2, gy - 4, 1, 1); }
    // ramppersonalen och signalisten vid plats 13
    for (const c of crew) tinyPerson(ctx, c.x, c.y, c.wait > 0 ? 0 : Math.floor(t * 6 + c.x) % 2, c.vest, night);
    const up = Math.floor(t * 1.5) % 2;
    tinyPerson(ctx, 338, 64, 0, '#f07a1e', night);
    ctx.fillStyle = night ? '#ff8a3a' : '#f07a1e';
    ctx.fillRect(337, up ? 56 : 59, 1, 3); ctx.fillRect(341, up ? 56 : 59, 1, 3);
    ctx.restore();
  }
  function drawClock(ctx) {
    const m = startMin + (Math.min(t, P.seconds) / P.seconds) * P.gameMin;
    const s = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    const x = 74, y = 22;
    ctx.fillStyle = '#6a7078'; ctx.fillRect(x + 4, 19, 1, 3); ctx.fillRect(x + 20, 19, 1, 3);
    ctx.fillStyle = '#16171a'; ctx.fillRect(x, y, 25, 9);
    ctx.fillStyle = '#3a3e46'; ctx.fillRect(x, y, 25, 1);
    ctxText(ctx, SMALL, s, x + 3, y + 2, '#ff4a3a');
  }
  function drawMonitor(ctx) {
    const X = SCR.x, Y = SCR.y, W = SCR.w, H = SCR.h;
    ctx.fillStyle = '#0e1a2e'; ctx.fillRect(X, Y, W, H);
    // rubrikraden: steget + staden
    ctx.fillStyle = '#1f4f9a'; ctx.fillRect(X, Y, W, 7);
    ctx.fillStyle = '#3a7ad8'; ctx.fillRect(X, Y, W, 1);
    if (!cur || step === 'fram') {
      // viloläge: loggan och "NÄSTA RESENÄR"
      ctxText(ctx, SMALL, $t('DISK 3'), X + 2, Y + 1, '#ffd23a');
      ctx.fillStyle = '#ffd23a';
      const cx = X + 32, cy = Y + 16;
      for (const [dx, dy] of [[-1, -3], [0, -3], [1, -3], [-2, -2], [-1, -1], [0, -1], [1, 0], [2, 1], [1, 2], [0, 2], [-1, 2]]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
      const s = cur ? $t('VÄLKOMMEN!') : $t('NÄSTA RESENÄR');
      ctxText(ctx, SMALL, s, X + ((W - textW(SMALL, s)) >> 1), Y + 24, Math.floor(t * 2) % 2 && !cur ? '#8aa2c8' : '#d8e0f0');
      return;
    }
    const d = DEST[cur.dest];
    // (ihop: är resenären en kollegas är stegets namn släckt – skärmen är hens)
    ctxText(ctx, SMALL, STEPS[STEP_IX[step]].n, X + 2, Y + 1, owns(cur, meId()) ? '#ffd23a' : '#8aa2c8');
    ctxText(ctx, SMALL, d.city, X + W - 2 - textW(SMALL, d.city), Y + 1, '#ffffff');
    const hv = hover && hover.btn ? hover.btn.id : null;
    const button = (b) => {
      const [x0, y0, x1, y1] = b.r, on = hv === b.id;
      ctx.fillStyle = css(mul(b.col, 0.55)); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = css(on ? mix(b.col, WHITE, 0.25) : b.col); ctx.fillRect(x0 + 1, y0, x1 - x0 - 2, y1 - y0 - 1);
      ctx.fillStyle = css(mix(b.col, WHITE, 0.45)); ctx.fillRect(x0 + 1, y0, x1 - x0 - 2, 1);
      ctxText(ctx, SMALL, b.label, x0 + ((x1 - x0 - textW(SMALL, b.label)) >> 1), y0 + 2, '#ffffff');
      if (on) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(x0, y1, x1 - x0, 1); }
    };
    if (step === 'pass') {
      // fotot 1:1 med ram och ljus bakgrund
      ctx.fillStyle = '#5a6a8a'; ctx.fillRect(X + 1, Y + 9, 14, 17);
      ctx.fillStyle = '#c8dcf0'; ctx.fillRect(X + 2, Y + 10, 12, 15);
      ctx.drawImage(photoOf(cur.photo), X + 2, Y + 10);
      ctxText(ctx, SMALL, cur.name, X + 18, Y + 10, '#ffffff');
      ctxText(ctx, SMALL, cur.born, X + 18, Y + 17, '#8aa2c8');
      ctx.fillStyle = '#6a1a26'; ctx.fillRect(X + W - 7, Y + 10, 5, 6); ctx.fillStyle = '#d8b048'; ctx.fillRect(X + W - 5, Y + 12, 1, 2);
      for (const b of monButtons()) button(b);
    } else if (step === 'vikt') {
      const w = scaleBag ? scaleBag.w : 0;
      ctxText(ctx, SMALL, $t('VIKT'), X + 3, Y + 10, '#8aa2c8');
      let s;
      if (repackT > 0) s = Math.floor(t * 6) % 2 ? '--,-' : ' -,-';
      else if (weighT < 1) s = fmtKg(w * weighT * (0.9 + Math.random() * 0.1));
      else s = fmtKg(w);
      ctxText(ctx, BIG, s, X + 3, Y + 17, '#ffffff');
      ctxText(ctx, SMALL, 'KG', X + 5 + textW(BIG, s), Y + 19, '#d8e0f0');
      if (payT > 0) ctxText(ctx, SMALL, $t('BETALT'), X + 3, Y + 28, '#5ad06a');
      else ctxText(ctx, SMALL, $t('MAX 23'), X + 3, Y + 28, '#8aa2c8');
      for (const b of monButtons()) button(b);
    } else if (step === 'plats') {
      // kabinen: skrov med fönster, sätesrader, gången
      ctx.fillStyle = '#2a3a5a'; ctx.fillRect(X + 3, Y + 8, 58, 28);
      ctx.fillStyle = '#16223a'; ctx.fillRect(X + 4, Y + 8, 56, 28);
      ctx.fillStyle = '#23304a'; ctx.fillRect(X + 30, Y + 8, 4, 28);
      for (let r = 0; r < 3; r++) {
        const wy = Y + 10 + r * 9;
        ctx.fillStyle = '#8ad0ff'; ctx.fillRect(X + 3, wy, 1, 3); ctx.fillRect(X + 60, wy, 1, 3);
        ctxText(ctx, SMALL, String(SEAT_ROW0 + r).slice(1), X + 31, wy, '#5a6a8a');
      }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
        const [x0, y0] = seatRect(r, c), occ = cur.seats[r][c];
        const hv2 = hv === `plats-${SEAT_ROW0 + r}${SEAT_COLS[c]}`;
        const col = occ ? 0x4a5264 : hv2 ? 0xffd23a : 0x3a7ad8;
        ctx.fillStyle = css(mul(col, 0.6)); ctx.fillRect(x0, y0, 7, 7);
        ctx.fillStyle = css(col); ctx.fillRect(x0 + 1, y0 + 2, 5, 4);
        ctx.fillStyle = css(mix(col, WHITE, 0.3)); ctx.fillRect(x0 + 1, y0, 5, 2);
        if (occ) { ctx.fillStyle = '#c89a78'; ctx.fillRect(x0 + 2, y0 + 1, 3, 2); ctx.fillStyle = '#3a2a20'; ctx.fillRect(x0 + 2, y0, 3, 1); }
      }
    } else if (step === 'lapp') {
      ctxText(ctx, SMALL, $t('BAGAGELAPP TILL'), X + 3, Y + 10, '#8aa2c8');
      const cw = textW(BIG, d.city);
      ctxText(ctx, BIG, d.city, X + Math.max(2, (W - cw) >> 1), Y + 18, '#ffd23a');
      const c2 = Math.floor(t * 2) % 2 ? '#d8e0f0' : '#8aa2c8';
      ctxText(ctx, SMALL, $t('SKRIVAREN'), X + 3, Y + 29, c2);
      arrow(ctx, X + 5 + textW(SMALL, $t('SKRIVAREN')), Y + 29, 1, c2);
      ctxText(ctx, SMALL, seatLabel(cur), X + W - 3 - textW(SMALL, seatLabel(cur)), Y + 29, '#5ad06a');
    } else if (step === 'band') {
      const sp = special();
      ctxText(ctx, SMALL, sp ? $t('SPECIALBAGAGE') : $t('SKICKA VÄSKAN'), X + 3, Y + 11, sp ? '#ffb040' : '#d8e0f0');
      const c2 = Math.floor(t * 2) % 2 ? '#ffd23a' : '#8aa2c8';
      if (sp) { arrow(ctx, X + 3, Y + 20, -1, c2); ctxText(ctx, SMALL, $t('SPECIALSKÅPET'), X + 8, Y + 20, c2); }
      else { ctxText(ctx, SMALL, $t('TRYCK SKICKA'), X + 3, Y + 20, c2); arrow(ctx, X + 5 + textW(SMALL, $t('TRYCK SKICKA')), Y + 20, 1, c2); }
      ctxText(ctx, SMALL, $t`LAPP ${d.code}`, X + 3, Y + 29, '#5ad06a');
    } else if (step === 'kort') {
      // boardingkortets förhandsvisning
      ctx.fillStyle = '#f4f2ea'; ctx.fillRect(X + 3, Y + 9, 58, 25);
      ctx.fillStyle = '#1f4f9a'; ctx.fillRect(X + 3, Y + 9, 58, 5);
      ctxText(ctx, SMALL, $t('BOARDING'), X + 5, Y + 9, '#ffffff');
      ctxText(ctx, SMALL, cur.name, X + 5, Y + 16, '#17151a');
      ctxText(ctx, SMALL, d.code, X + 48, Y + 16, '#17151a');
      ctxText(ctx, SMALL, $t`PLATS ${seatLabel(cur)}`, X + 5, Y + 23, '#3a3e46');
      const s = cardReady ? $t('GE KORTET!') : $t('SKRIVER...');
      ctxText(ctx, SMALL, s, X + 5, Y + 29, cardReady ? '#2f8f46' : '#8a6a2a');
    }
    // stressad: tidsstapel under rubriken
    if (cur.type === 'sen' && cur.patience < Infinity) {
      const left = clamp(cur.patience / cur.pmax, 0, 1);
      ctx.fillStyle = '#3a1414'; ctx.fillRect(X, Y + 7, W, 1);
      ctx.fillStyle = left > 0.4 ? '#f0b429' : '#ff3a2a'; ctx.fillRect(X, Y + 7, Math.round(W * left), 1);
    }
  }
  function drawWeightDisplay(ctx) {
    const D = WDISP;
    let s = '0,0', col = '#5a1410';
    if (scaleBag) {
      col = '#ff3a2a';
      if (repackT > 0) s = '--,-';
      else s = fmtKg(weighT < 1 ? scaleBag.w * weighT : scaleBag.w);
    }
    const w = textW(BIG, s);
    ctxText(ctx, BIG, s, D.x + D.w - 3 - w, D.y + 3, col);
    if (scaleBag && scaleBag.w > 32 && weighT >= 1 && Math.floor(t * 3) % 2) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(D.x + 2, D.y + 2, 1, 1); }
  }
  function drawKioskLive(ctx) {
    const hv = hover && hover.key ? hover.key.di : -1;
    for (const k of KEYS) {
      const [x0, y0, x1, y1] = k.r, on = hv === k.di;
      ctx.fillStyle = '#23262d'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = on ? '#fff4c0' : '#e4e8ec'; ctx.fillRect(x0, y0, x1 - x0 - 1, y1 - y0 - 1);
      ctx.fillStyle = on ? '#ffffff' : '#f8fafc'; ctx.fillRect(x0, y0, x1 - x0 - 1, 1);
      const cw = textW(SMALL, DEST[k.di].code);
      ctxText(ctx, SMALL, DEST[k.di].code, x0 + ((x1 - x0 - 1 - cw) >> 1), y0 + 1, on ? '#1f4f9a' : '#2a2c30');
    }
    // lappen rullar upp ur springan
    const pr = kioskPrint;
    if (pr) {
      const hgt = Math.round(clamp(pr.t / T_PRINT, 0, 1) * 22), s = stripSprite(pr.di);
      if (hgt > 0) ctx.drawImage(s, 0, 26 - hgt, 7, hgt, KIOSK.x0 + 11, KIOSK.top - 1 - hgt, 7, hgt);
    }
    // displayen: KLAR / SKRIVER
    ctx.fillStyle = '#0e1a2e'; ctx.fillRect(KIOSK.x0 + 19, KIOSK.top + 2, 8, 4);
    ctx.fillStyle = pr ? '#ffb020' : '#5ad06a';
    ctx.fillRect(KIOSK.x0 + 20, KIOSK.top + 3, pr ? 1 + (Math.floor(t * 10) % 6) : 6, 2);
  }
  function drawCounterLive(ctx) {
    // passet och biljetten på passläsaren medan resenären står här
    if (cur && cur.state === 'desk' && STEP_IX[step] !== undefined) {
      const D = docsArt();
      ctx.drawImage(D.pass, SCAN.x + 3, SCAN.y - 3);
      ctx.drawImage(D.tick, SCAN.x + 11, SCAN.y - 1);
      if (step === 'pass' && Math.floor(t * 3) % 2) { ctx.fillStyle = 'rgba(120,220,255,0.5)'; ctx.fillRect(SCAN.x + 3, SCAN.y + 3, 14, 1); }
    }
    // boardingkortet kommer ut ur skrivaren
    if (cardT >= 0 || cardReady) {
      const k = cardReady ? 1 : clamp(cardT / T_CARD, 0, 1), c = carryArt().card, h = Math.max(1, Math.round(k * 8));
      ctx.drawImage(c, 0, 8 - h, 12, h, BPRN.x + 6, BPRN.y + 11, 12, h);
      if (cardReady && Math.floor(t * 3) % 2) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(BPRN.x + 5, BPRN.y + 19, 14, 1); }
    }
    // kortterminalen blinkar när någon betalar
    if (payT > 0) { ctx.fillStyle = Math.floor(t * 8) % 2 ? '#5ad06a' : '#2a4a5a'; ctx.fillRect(TERM.x + 2, TERM.y + 2, 4, 3); }
    // datorns lampa
    ctx.fillStyle = Math.floor(t * 1.3) % 3 ? '#5ad06a' : '#1a3a1a'; ctx.fillRect(KNEE[0] + 5, TOP1 + 9, 1, 1);
    // väskan på vågen
    if (scaleBag) {
      const jx = jamT > 0 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
      const lift = weighT < 0.35 ? Math.round((1 - weighT / 0.35) * 8) : 0;
      const bx = SCALE_BAG.x + jx - Math.round(lift * 1.2), by = SCALE_BAG.y - lift;
      drawScaleItem(ctx, scaleBag, bx, by);
      // packar om: kläder och skor flyger över till handbagaget
      if (repackT > 0) {
        for (let k = 0; k < 4; k++) {
          const q = ((T_REPACK - repackT) * 1.3 + k / 4) % 1;
          const x = Math.round(SCALE_BAG.x - 4 + (DESK_P.x + 5 - SCALE_BAG.x + 4) * q), y = Math.round(SCALE_BAG.y - 10 + (DESK_P.y - 26 - SCALE_BAG.y + 10) * q - Math.sin(q * Math.PI) * 12);
          ctx.fillStyle = ['#d9433b', '#3a7bd5', '#f0b429', '#e8e3d6'][k]; ctx.fillRect(x, y, 3, 2);
          ctx.fillStyle = 'rgba(23,21,26,0.5)'; ctx.fillRect(x, y + 2, 3, 1);
        }
      }
    }
    drawWeightDisplay(ctx);
    // SKICKA-knappen lyser grönt när det är dags
    if (step === 'band' && scaleBag && !special() && Math.floor(t * 3) % 2) { ctx.fillStyle = '#8affa0'; ctx.fillRect(SEND.x + 2, SEND.y + 3, 2, 1); }
  }
  function drawScaleItem(ctx, b, x, y) {
    if (b.kind === 'surf') { ctx.drawImage(surfSprite(b.col, false), x - 23, y - 3); }
    else if (b.kind === 'hund') { ctx.drawImage(cageSprite(b.fur, Math.floor(t * 2.5) % 3 === 0 ? 1 : 0), x - 10, y - 11); }
    else ctx.drawImage(caseSprite(b.body, b.style), x - 11, y - 11);
    if (b.tag !== null && b.tag !== undefined) ctx.drawImage(bagTag(b.tag), x + (b.kind === 'surf' ? 14 : 2), y - 13);
  }
  function drawFeed(ctx) {
    const off = Math.floor(feedOff) % SURF_PERIOD, h = FEED.y1 - FEED.y0;
    ctx.drawImage(G.feed, 0, SURF_PERIOD - 1 - off, FEED.x1 - FEED.x0 - 4, h, FEED.x0 + 2, FEED.y0, FEED.x1 - FEED.x0 - 4, h);
    for (const b of feedBags) ctx.drawImage(caseSprite(b.body, b.style), SCALE_BAG.x - 11, Math.round(b.y) - 11);
    for (const b of feedBags) if (b.tag !== null && b.tag !== undefined) ctx.drawImage(bagTag(b.tag), SCALE_BAG.x + 2, Math.round(b.y) - 13);
    // ljusridån blinkar när något passerar
    const hit = feedBags.some((b) => Math.abs(b.y - 150) < 8);
    ctx.fillStyle = hit ? '#ff3a2a' : '#5ad06a'; ctx.fillRect(FEED.x0 - 2, 137, 2, 1);
  }
  function drawBelt(ctx) {
    const off = Math.floor(beltOff) % SURF_PERIOD;
    ctx.drawImage(G.surf, off, 0, FW, CB.s1 - CB.s0, 0, CB.s0, FW, CB.s1 - CB.s0);
    ctx.drawImage(G.belt, 0, 0);
    for (const b of beltBags) {
      const bx = b.down ? 374 : Math.round(b.x), by = Math.round(b.y);
      ctx.drawImage(caseSprite(b.body, b.style), bx - 11, by - 11);
      if (b.tag !== null && b.tag !== undefined) ctx.drawImage(bagTag(b.tag), bx + 2, by - 13);
    }
    // rullarna under snurrar
    const ph = Math.floor(beltOff / 2) % 4;
    for (let x = 14; x < FW; x += 16) { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x, CB.s1 + 3, 4, 1); ctx.fillStyle = '#e4e8ec'; ctx.fillRect(x + 3 - ph, CB.s1 + 3, 1, 1); }
    // ridåerna där väskorna försvinner
    for (let sx = 0; sx < 8; sx += 2) {
      let push = 0;
      for (const b of beltBags) { const d = Math.abs(b.x - sx); if (d < 12) push = Math.max(push, 12 - d); }
      const lift = Math.min(6, Math.round(push * 0.6));
      ctx.fillStyle = sx % 4 ? '#3a3e46' : '#50545c';
      ctx.fillRect(sx, CB.y0 - 2, 2, CB.s1 - CB.y0 + 2 - lift);
    }
  }
  function drawPassengerProps(ctx, p) {
    // väskan bredvid (tills den ligger på vågen)
    const b = p.bag;
    const bx = Math.round(p.x) + (p.dir === 'left' ? -12 : 7), by = Math.round(p.y);
    if (p.bagOn || p.bagGone || p.state === 'gone') return;
    if (b.kind === 'surf') { const s = surfSprite(b.col, true); ctx.drawImage(s, bx + (p.dir === 'left' ? 1 : 0), by - 46); }
    else if (b.kind === 'hund') { const s = cageSprite(b.fur, 0); ctx.drawImage(s, 0, 0, 20, 15, bx - 4, by - 17, 20, 15); }
    else { const s = rollerSprite(b.body, b.style); ctx.drawImage(s, bx, by - s.height + (b.style === 2 ? -8 : 0)); }
  }
  function npcDrawables() {
    const out = [];
    for (const p of npcs) {
      const moving = p.path.length > 0 || !!(p.gpath && p.gpath.length);   // (medarbetaren: längs "spökets" väg)
      const fr = (id) => (moving ? WALK_SEQ[Math.abs(Math.floor(t * (p.speed > 50 ? 12 : 8.5) + id * 0.37)) % 4] : Math.sin(t * 1.7 + id) > 0.93 ? 4 : 0);
      const dir = moving ? p.dir : 'down';
      out.push({
        fy: p.y,
        draw: (ctx) => {
          const behind = dir === 'right' || dir === 'up';
          if (behind) drawPassengerProps(ctx, p);
          drawPerson(ctx, p.x, p.y, p.look, dir, fr(p.id));
          if (!behind) drawPassengerProps(ctx, p);
          // stressad: utropstecken och stapel
          if (p.type === 'sen' && p.state !== 'out') {
            // vid disken står utropstecknet bredvid tidsstapeln; stapeln ligger under
            // pratbubblans svans (y − 40) men ovanför huvudet, så att bubblan aldrig täcker den
            const atDesk = p === cur && p.patience < Infinity, ex = Math.round(p.x) + (atDesk ? 11 : 6);
            if (Math.floor(t * 4) % 2) { ctx.fillStyle = '#17151a'; ctx.fillRect(ex, Math.round(p.y) - 42, 4, 8); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(ex + 1, Math.round(p.y) - 41, 2, 4); ctx.fillRect(ex + 1, Math.round(p.y) - 36, 2, 1); }
            if (atDesk) {
              const left = clamp(p.patience / p.pmax, 0, 1), x0 = Math.round(p.x) - 8, y0 = Math.round(p.y) - 36;
              ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y0 - 1, 18, 4);
              ctx.fillStyle = left > 0.4 ? '#f0b429' : '#d9433b'; ctx.fillRect(x0, y0, Math.max(1, Math.round(16 * left)), 2);
            }
          }
        },
      });
      for (const k of p.kids) out.push({
        fy: p.y + k.dy,
        draw: (ctx) => {
          const hop = k.hop > 0 ? Math.round(Math.abs(Math.sin(k.hop * 12)) * 2) : 0;
          drawPerson(ctx, p.x + k.dx, p.y + k.dy - hop, k.look, dir, moving ? fr(p.id + 3 + k.dx) : (Math.sin(t * 2.3 + k.dx) > 0.9 ? 4 : 0));
        },
      });
    }
    // folket längs glaset följer bakväggen (dz) men går alltid bakom köns bakre stolpar
    const passY = (p) => Math.min(Math.round(p.y) + dz, POST_BACK_Y - 2);
    for (const p of passers) out.push({
      fy: passY(p),
      draw: (ctx) => {
        const x = Math.round(p.x), y = passY(p);
        ctx.save(); ctx.beginPath(); ctx.rect(WALL_X1, 0, FW - WALL_X1, FH); ctx.clip();
        if (p.bag) {
          const s = rollerSprite(p.bag.body, p.bag.style);
          if (p.bag.style === 2) ctx.drawImage(s, x + (p.dir > 0 ? 2 : -13), y - 17);
          else ctx.drawImage(s, x + (p.dir > 0 ? -16 : 6), y - s.height);
        }
        drawPerson(ctx, x, y, p.look, p.dir > 0 ? 'right' : 'left', WALK_SEQ[Math.floor(t * 8 + p.id) % 4]);
        ctx.restore();
      },
    });
    const q = colleague.pass;
    if (q) out.push({ fy: q.y, draw: (ctx) => { const mv = q.path.length > 0; drawPerson(ctx, q.x, q.y, q.look, mv ? q.dir : 'down', mv ? WALK_SEQ[Math.floor(t * 8.5) % 4] : 0); if (!mv || q.dir === 'left') ctx.drawImage(rollerSprite(0x3a5a7c, 0), Math.round(q.x) + 7, Math.round(q.y) - 17); } });
    return out;
  }
  function drawCarry(ctx) { if (carry) drawCarryAt(ctx, carry, walker.px, walker.py, walker.dir); }
  // det någon bär (jag – eller ihop en kollega: kortet eller specialväskan)
  function drawCarryAt(ctx, c, px, py, dir) {
    const x = Math.round(px), y = Math.round(py);
    const C = carryArt();
    if (c.k === 'tag') ctx.drawImage(stripSprite(c.di), 0, 0, 7, 12, x + (dir === 'left' ? -9 : 3), y - 22, 7, 12);
    else if (c.k === 'kort') ctx.drawImage(C.card, x + (dir === 'left' ? -12 : 1), y - 20);
    else if (c.k === 'surf') ctx.drawImage(surfSprite(c.bag.col, false), x - 23, y - 46);
    else if (c.k === 'hund') ctx.drawImage(cageSprite(c.bag.fur, Math.floor(t * 3) % 2), x - 10, y - 52);
  }
  function drawSitting(ctx) {
    for (const s of sitting) {
      if (s.sleep) continue;
      drawPerson(ctx, s.x, s.y, s.look, 'down', Math.sin(t * 1.1 + s.x) > 0.95 ? 6 : 5);
    }
    // nattgästen som sover över tre stolar (spriten vriden 90°, pixlarna hela)
    const z = sitting.find((s) => s.sleep);
    if (z) {
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(-Math.PI / 2);
      drawPerson(ctx, 0, 0, z.look, 'down', 5);
      ctx.restore();
      if (Math.floor(t * 1.2) % 2) ctxText(ctx, SMALL, 'Z', z.x - 40, z.y - 16 - (Math.floor(t * 2) % 3), '#ffffff');
    }
  }
  // Stegremsan längst ner i den SYNLIGA rutan (canvaskoordinater): stegen, nästa
  // resenär, kön och UTGÅNG längst till höger. Blir rutan smal (4:3-paddan) faller
  // ordet NÄSTA bort först, sedan visas bara siffran på stegen som inte pågår.
  const TYPE_LAB = { sen: $t('SEN!'), familj: $t('FAMILJ'), surf: $t('SURF'), hund: $t('HUND'), normal: '' };
  function drawStrip(ctx) {
    const b = band(), sy = b.y1 - STRIP_H, X0 = b.x0, X1 = b.x1;
    ctx.fillStyle = 'rgba(23,21,26,0.9)'; ctx.fillRect(X0, sy, X1 - X0, STRIP_H);
    ctx.fillStyle = '#3a3e46'; ctx.fillRect(X0, sy, X1 - X0, 1);
    const si = STEP_IX[step] ?? (step === 'fram' ? -1 : -2);
    const nx = queue[0], nlab = nx ? TYPE_LAB[nx.type] : '';
    const stepLab = (i, compact) => (compact && i !== si ? `${i + 1}` : `${i + 1} ${STEPS[i].n}`);
    const widthFor = (compact, noNext) => {
      let w = 3;
      for (let i = 0; i < STEPS.length; i++) w += textW(SMALL, stepLab(i, compact)) + 8;
      return w + 6 + (noNext ? 0 : textW(SMALL, $t('NÄSTA')) + 3) + (nx ? 12 + (nlab ? textW(SMALL, nlab) + 4 : 0) : 8) + 2 + textW(SMALL, $t`KÖ ${queue.length}`);
    };
    const avail = X1 - X0 - 46;
    const noNext = widthFor(false, false) > avail, compact = noNext && widthFor(false, true) > avail;
    let x = X0 + 3;
    STEPS.forEach((s, i) => {
      const lab = stepLab(i, compact), w = textW(SMALL, lab) + 6;
      // (ihop kan lappen sitta på och väskan vara iväg medan platsen väljs – de stegen är redan gjorda)
      const now = i === si, dn = cur && (i < si || (i === STEP_IX.lapp && tagged()) || (i === STEP_IX.band && cur.bagGone));
      ctx.fillStyle = now ? '#ffd23f' : dn ? '#2f6a3a' : '#2a2c34'; ctx.fillRect(x, sy + 2, w, 8);
      ctxText(ctx, SMALL, lab, x + 3, sy + 3, now ? '#17151a' : dn ? '#b8f0c0' : '#8a8e98');
      x += w + 2;
    });
    // nästa resenär
    x += 6;
    if (!noNext) { ctxText(ctx, SMALL, $t('NÄSTA'), x, sy + 3, '#8a8e98'); x += textW(SMALL, $t('NÄSTA')) + 3; }
    if (nx) {
      ctx.drawImage(photoOf(nx.look), 1, 2, 10, 9, x, sy + 1, 10, 9);
      x += 12;
      if (nlab) { ctxText(ctx, SMALL, nlab, x, sy + 3, nx.type === 'sen' ? '#ff6a6a' : '#ffd23f'); x += textW(SMALL, nlab) + 4; }
    } else { ctxText(ctx, SMALL, '-', x, sy + 3, '#8a8e98'); x += 8; }
    ctxText(ctx, SMALL, $t`KÖ ${queue.length}`, x + 2, sy + 3, '#d8d2c0');
    // UTGÅNG
    const ex = X1 - 42;
    ctx.fillStyle = '#0e4a24'; ctx.fillRect(ex, sy + 1, 40, 9);
    ctx.fillStyle = '#1e8a3a'; ctx.fillRect(ex + 1, sy + 2, 38, 7);
    ctxText(ctx, SMALL, $t('UTGÅNG'), ex + 8, sy + 3, '#ffffff');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ex + 3, sy + 4, 2, 3); ctx.fillRect(ex + 2, sy + 5, 1, 1);
    EXIT_R[0] = ex - 2; EXIT_R[1] = sy; EXIT_R[2] = X1; EXIT_R[3] = sy + STRIP_H;
  }
  // namnet på det man pekar på (scenkoordinater). Resenärens namn göms medan hen pratar
  // och läggs ovanför den stressades tidsstapel.
  function drawHover(ctx) {
    if (!hover || done || hover.btn) return;
    if (hover.id === 'resenar' && talkP.active()) return;
    if (hover.id === 'disk' && cur) return;                          // skärmen används – knapparna lyser själva
    const V = vis(), w = textW(SMALL, hover.name) + 4;
    const cx = (hover.r[0] + hover.r[2]) >> 1;
    const lift = hover.id === 'resenar' && cur && cur.type === 'sen' ? 8 : 0;
    const y = Math.max(V.t + 1, hover.r[1] - 11 - lift);
    const x0 = clamp(cx - (w >> 1), V.l + 1, V.r - w - 1);
    ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(x0, y, w, 9);
    ctxText(ctx, SMALL, hover.name, x0 + 2, y + 2, '#ffd23f');
  }
  // klockan i topplisten (speltiden under passet) – väggklockan göms av beskärningen på mobilen
  function hudClock(ctx, b) {
    const m = startMin + (Math.min(t, P.seconds) / P.seconds) * P.gameMin;
    const s = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    const x = b.x0 + 4 + textW(BIG, hudTitle()) + 10, y = b.y0 + 4;
    if (x + 26 > b.x1 - 170) return;                                // ingen plats (smal ruta)
    ctx.fillStyle = '#0a0b0e'; ctx.fillRect(x, y, 25, 10);
    ctx.fillStyle = '#3a3e46'; ctx.fillRect(x, y, 25, 1);
    ctxText(ctx, SMALL, s, x + 4, y + 3, night ? '#ffb040' : '#ff4a3a');
  }

  // sittande resenärer i stolsraden
  {
    // natt: en som väntar på stol 1 och en som sover över stolarna 3–5 (huvudet på stol 3,
    // fötterna vid armstödet längst till höger – ingen ligger i knät på någon)
    const seats = night ? (Math.random() < 0.6 ? [0] : []) : [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const s of seats) sitting.push({ x: CHAIRS.x + s * CHAIRS.w + 6, y: CHAIRS.y - 1, look: adultLook() });
    if (night) sitting.push({ x: CHAIRS.x + CHAIRS.n * CHAIRS.w - 2, y: CHAIRS.y - 7, look: adultLook(), sleep: true });
  }
  // startläget: en på väg till disken och två i kön
  spawn(null, {}, false); spawn(null, {}, false); spawn('normal', {}, false);

  const api = {
    _debug: {
      stats,
      // läget just nu: steg, resenären vid disken (typ, destination, rätt kod, vikt, önskan, falskt pass), kön, det jag bär
      state: () => ({
        t: +t.toFixed(2), step, queue: queue.length, carry: carry ? { k: carry.k, code: carry.di !== undefined ? DEST[carry.di].code : undefined } : null,
        passenger: cur ? { id: cur.id, by: cur.by || '', type: cur.type, dest: DEST[cur.dest].city, code: DEST[cur.dest].code, weight: cur.bag.w, wish: cur.wish, need: cur.need, fake: cur.fake, seat: seatLabel(cur), state: cur.state, patience: cur.patience === Infinity ? null : +cur.patience.toFixed(1), bagGone: !!cur.bagGone } : null,
        scale: scaleBag ? { kind: scaleBag.kind, w: scaleBag.w, tag: scaleBag.tag !== null && scaleBag.tag !== undefined ? DEST[scaleBag.tag].code : null } : null,
        cardReady, weigh: +weighT.toFixed(2), kortBy, lyftBy, mode, stats: { ...stats },
      }),
      // Nästa resenär direkt till disken (den som står där nu går utan att räknas).
      next() {
        if (cur) { const p = cur; endPassenger(); leaveDesk(p); }
        if (!queue.length) spawn(null, {}, false);
        const p = queue.shift(); relayoutQueue();
        cur = p; p.path = []; p.x = DESK_P.x; p.y = DESK_P.y; arriveDesk(p);
        snapAsap();
        return api._debug.state();
      },
      // Ett steg direkt, utan gång (ensam/skiftledaren). Rätt handling: 'pass' | 'vikt' | 'plats' | 'lapp' | 'band' | 'kort' | 'alla'.
      // Fel med flit: 'godkann' | 'neka' (tvingat val), 'ok' | 'avgift' | 'packa', 'fel-plats', 'fel-lapp', 'skicka' (bandet oavsett).
      step(name) {
        if (!cur || cur.state !== 'desk') return api._debug.state();
        const doIt = (n) => {
          if (n === 'pass') handla('pass', cur.fake ? 0 : 1);
          else if (n === 'godkann') handla('pass', 1);
          else if (n === 'neka') handla('pass', 0);
          else if (n === 'vikt') { weighT = 1; const w = scaleBag?.w ?? 0; handla('vikt', w <= 23 ? 'ok' : w > 32 ? 'packa' : 'avgift'); if (repackT > 0) repackDone(); }
          else if (n === 'ok' || n === 'avgift' || n === 'packa') { weighT = 1; handla('vikt', n); if (repackT > 0) repackDone(); }
          else if (n === 'plats' || n === 'fel-plats') { const hit = seatFor(n === 'plats'); if (hit) handla('plats', hit); }
          else if (n === 'lapp' || n === 'fel-lapp') {
            const di = n === 'lapp' ? cur.dest : (cur.dest + 1) % DEST.length;
            if (step === 'lapp') { carry = { k: 'tag', di }; bagKlick(); }
          } else if (n === 'band') {
            if (step === 'band') { if (special()) { bagKlick(); handla('special'); } else handla('skicka'); }
          } else if (n === 'skicka') handla('skicka');
          else if (n === 'kort') {
            if (step === 'kort') { cardReady = true; const k = meK(), e = chk('kort', k); if (e) refuse(k, e); else { doTakeCard(k, false); publish(k, false); handla('ge'); } }
          }
        };
        if (name === 'alla') { for (const n of ['pass', 'vikt', 'plats', 'lapp', 'band', 'kort']) { if (!cur) break; doIt(n); } }
        else doIt(name);
        return api._debug.state();
      },
      // klickpunkt [x, y] i CANVASkoordinater (samma som down(x, y) får – kamerans förskjutning
      // är inräknad): 'disk' | 'skrivare' | 'vag' | 'vaska' | 'skicka' | 'kort' | 'resenar' |
      // 'special' | 'godkann' | 'neka' | 'ok' | 'avgift' | 'packa' | 'kod-BCN' (osv) | 'plats-15A' (osv) | 'utgang'
      spot(id) {
        if (id === 'utgang') return [EXIT_R[0] + 22, EXIT_R[1] + 5];
        if (id === 'vag') id = 'vaska';
        const at = (x, y) => [x + offX, y + offY];
        const tg = targets().find((x) => x.id === id);
        if (tg) return at((tg.r[0] + tg.r[2]) >> 1, (tg.r[1] + tg.r[3]) >> 1);
        if (id.startsWith('plats-')) { const m = id.match(/^plats-(\d+)([A-F])$/); if (m) { const r = +m[1] - SEAT_ROW0, c = SEAT_COLS.indexOf(m[2]); if (r >= 0 && r < 3 && c >= 0) { const R = seatRect(r, c); return at(R[0] + 3, R[1] + 3); } } }
        return null;
      },
      // kameran: förskjutningen (canvas = scen + off), bakväggens flytt dz, den synliga
      // rutan (canvas) och vilka scenrader/-kolumner som syns mellan topplisten och remsan
      // vilka pratbubblor syns: resenären vid disken, kön/barnet, jag – och om barnet pratar
      talk: () => ({ p: talkP.text(), q: talkQ.text(), me: talkMe.text(), kid: !!qKid && talkQ.active(), kidAndParent: !!qKid && qKid === cur && talkQ.active() && talkP.active() }),
      cam: () => { const V = vis(); return { offX, offY, dz, band: band(), visible: { x0: V.l, x1: V.r, y0: V.t, y1: V.b } }; },
      // var figuren ställer sig för en station (gångmål)
      stand: (id) => SPOT[id] || null,
      // Byt resenären vid disken mot en ny av typen: 'normal' | 'sen' | 'familj' | 'surf' | 'hund' |
      // 'fel-pass' (någon annans pass) | 'overvikt' (24–31 kg) | 'tung' (över 32 kg) | 'latt' (under 23 kg)
      forcePassenger(typ = 'normal', opts = {}) {
        const o = { ...opts };
        let ty = typ;
        if (typ === 'fel-pass') { ty = 'normal'; o.fake = true; }
        else if (typ === 'overvikt') { ty = 'normal'; o.weight = 26.5; o.fake = false; }
        else if (typ === 'tung') { ty = 'normal'; o.weight = 34.2; o.fake = false; }
        else if (typ === 'latt') { ty = 'normal'; o.weight = 17.4; o.fake = false; }
        else if (o.fake === undefined) o.fake = false;
        if (cur) { const p = cur; endPassenger(); p.state = 'gone'; }
        const p = makePassenger(ty, o);
        npcs.push(p);
        cur = p; p.x = DESK_P.x; p.y = DESK_P.y; p.path = [];
        arriveDesk(p);
        snapAsap();
        return api._debug.state();
      },
      // är platsen ledig för resenären vid disken? (rad 14–16, kolumn 'A'–'F')
      seatFree: (row, col) => (cur ? !cur.seats[row - SEAT_ROW0]?.[SEAT_COLS.indexOf(col)] : false),
      // ett plan börjar inflygningen nu (för bilder av landningen)
      landing() { traffic.land = { ph: 'app', x: FW + 8, y: GY0 + 1, v: 34, liv: 1, dir: -1 }; traffic.landNext = 20; return true; },
      busy: () => walker.path.length > 0,
      pos: () => [Math.round(walker.px), Math.round(walker.py)],
      queueList: () => queue.map((p) => ({ id: p.id, type: p.type, name: p.name, dest: DEST[p.dest].code, x: Math.round(p.x), y: Math.round(p.y), state: p.state })),
      // ---------- jobba tillsammans (tools/coop-incheck-test.mjs) ----------
      coop: () => ({ leader: coop.leader, active: coop.active, mates: coop.peers().length, settled: coop.settled, myId: coop.myId }),
      lag: () => ({ ...team, maxN }),
      title: () => hudTitle(),
      // lugnt vid disken (skiftledaren/solo): inga nya resenärer, kön och disken tomma
      calm() {
        autoSpawn = false;
        endPassenger();
        for (const p of npcs) p.state = 'gone';
        npcs = []; queue.length = 0; later = [];
        snapAsap();
        return 0;
      },
      auto(on = true) { autoSpawn = !!on; return autoSpawn; },
      // n resenärer rakt in i kön (de står redan på sina platser); returnerar köns id:n
      fill(n = 3, typ = 'normal') { for (let i = 0; i < n; i++) spawn(typ, { fake: false }, false); snapAsap(); return queue.map((p) => p.id); },
      // en resenär kommer in från höger och går till kön; returnerar id:t
      komIn(typ = 'normal') { const p = spawn(typ, { fake: false }); snapAsap(); return p ? p.id : null; },
      all: () => npcs.map((p) => ({ id: p.id, type: p.type, state: p.state, x: Math.round(p.x), y: Math.round(p.y) })),
      // det man ser vid disken just nu (ett klick tar med sig det – se handla)
      sig: () => sig(),
      // Som ett klick framme vid stationen (figuren ställs där; hos en medarbetare blir det ett önskemål):
      // 'godkann' | 'neka' | 'ok' | 'avgift' | 'packa' | 'vikt' (rätt val) | 'plats' (rätt plats) | 'fel-plats' |
      // 'lapp' (rätt lapp i handen – på väskan) | 'fel-lapp' | 'lyft' (specialväskan) | 'skicka' | 'special' |
      // 'kort' (ta kortet – sedan går man fram och ger det) | 'ge'. v = det man såg vid disken (inget = som nu).
      act(key, v) {
        if (done) return false;
        const SP = { godkann: 'disk', neka: 'disk', ok: 'disk', avgift: 'disk', packa: 'disk', vikt: 'disk', plats: 'disk', 'fel-plats': 'disk',
          lapp: 'vag', 'fel-lapp': 'vag', lyft: 'vag', skicka: 'vag', special: 'special', kort: 'bprn', ge: 'pass' }[key];
        if (!SP) return false;
        walker.stop(); walker.px = SPOT[SP][0]; walker.py = SPOT[SP][1]; walker.dir = SP === 'special' ? 'left' : 'up';
        const vv = v ?? sig();
        klick(() => {
          if (key === 'godkann' || key === 'neka') handla('pass', key === 'godkann' ? 1 : 0, vv);
          else if (key === 'vikt') { const w = scaleBag?.w ?? 0; handla('vikt', w <= 23 ? 'ok' : w > 32 ? 'packa' : 'avgift', vv); }
          else if (key === 'ok' || key === 'avgift' || key === 'packa') handla('vikt', key, vv);
          else if (key === 'plats' || key === 'fel-plats') { const s = cur && seatFor(key === 'plats'); if (s) handla('plats', s, vv); }
          else if (key === 'lapp' || key === 'fel-lapp') { if (cur) { carry = { k: 'tag', di: key === 'lapp' ? cur.dest : (cur.dest + 1) % DEST.length }; bagKlick(vv); } }
          else if (key === 'lyft') bagKlick(vv);
          else handla(key, null, vv);
        });
        return true;
      },
      // provet: medarbetaren skickar SAMMA önskemål två gånger (som om svaret dröjde) – räknas EN gång
      twice(key) {
        if (!mate() || pend || !cur) return false;
        const m = { t: 'do', a: key, id: cur.id, v: sig(), x: null };
        if (key === 'godkann' || key === 'neka') { m.a = 'pass'; m.x = key === 'godkann' ? 1 : 0; }
        else if (key === 'plats') m.x = seatFor(true);
        else if (key === 'vikt') { const w = scaleBag?.w ?? 0; m.x = w <= 23 ? 'ok' : w > 32 ? 'packa' : 'avgift'; }
        else if (key === 'lapp') carry = { k: 'tag', di: cur.dest };
        ask(m, 2);
        return true;
      },
      // det jag bär: 'tag' | 'kort' | 'surf' | 'hund' | null
      carrying: () => (carry ? carry.k : null),
      // står figuren still – och väntar inte på skiftledarens svar (eller på lappskrivaren)?
      idle: () => !walker.path.length && !pend && !queued && !kioskPrint,
      pending: () => !!pend,
      // de senaste puffarnas text (även de som redan bleknat)
      popLog: () => popLog.slice(),
      time: () => t,
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() { play('door'); },
    exit() { talkP.clear(); talkQ.clear(); talkMe.clear(); coop.dispose(); },
    update,
    // x, y = canvaskoordinater; scenen ligger förskjuten (offX, offY) av kameran
    move(x, y) { mouse = { x, y }; hover = done ? null : targetAtScreen(x, y); },
    down(x, y) {
      if (done) return;
      if (inR(x, y, EXIT_R)) { walker.walkTo(SPOT.special[0] + 4, 178, () => { if (!done) abortShift(A); }); return; }
      if (!inScene(x, y)) return;                                  // topplisten och stegremsan
      const tg = targetAt(x - offX, y - offY);
      if (tg) { doTarget(tg); return; }
      walker.walkTo(x - offX, y - offY);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      if (!camInit) stepCam(0);
      const b = band();
      // utanför scenen (syns bara om kameran knuffat den – då ligger det i beskärningen)
      if (offX || offY) { ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, 0, FW, FH); }
      ctx.save();
      ctx.translate(offX, offY);
      ctx.drawImage(G.back, 0, 0);
      if (dz) {
        // bakväggen närmare: väggen med glaset och tavlan (raderna ovanför hallgolvet)
        // ritas dz rader längre ner, med en mjuk skugga på golvet under fönsterbänken
        ctx.drawImage(G.back, 0, 0, FW, HALL_Y, 0, dz, FW, HALL_Y);
        ctx.fillStyle = 'rgba(26,20,24,0.28)'; ctx.fillRect(0, HALL_Y + dz, FW, 1);
        ctx.fillStyle = 'rgba(26,20,24,0.14)'; ctx.fillRect(0, HALL_Y + dz + 1, FW, 2);
      }
      ctx.save();
      ctx.translate(0, dz);
      drawApron(ctx);
      ctx.drawImage(G.frame, 0, 0);
      drawClock(ctx);
      ctx.restore();
      const D = [
        { fy: CHAIRS.y - 2, draw: (c) => c.drawImage(G.chairs, 0, 0) },
        { fy: CHAIRS.y, draw: drawSitting },
        { fy: POST_BACK_Y, draw: (c) => c.drawImage(G.postsBack, 0, 0) },
        { fy: POST_FRONT_Y, draw: (c) => c.drawImage(G.postsFront, 0, 0) },
        { fy: BASE, draw: (c) => { c.drawImage(G.counter, 0, 0); drawMonitor(c); drawCounterLive(c); c.drawImage(G.kiosk, 0, 0); drawKioskLive(c); } },
        { fy: SPEC.base, draw: (c) => { c.drawImage(G.special, 0, 0); c.drawImage(lidT > 0 ? G.lidO : G.lidC, SPEC.x0 - 1, SPEC.top - 14); if (specialIn) { const k = specialIn.t / 0.8, b = specialIn.bag; c.save(); c.beginPath(); c.rect(0, 0, 40, SPEC.top + 1); c.clip(); if (b.kind === 'surf') c.drawImage(surfSprite(b.col, true), SPEC.x0 + 11, SPEC.top - 30 + Math.round(k * 34)); else c.drawImage(cageSprite(b.fur, 0), SPEC.x0 + 5, SPEC.top - 16 + Math.round(k * 18)); c.restore(); } } },
        { fy: FEED.y1, draw: drawFeed },
        { fy: CB.y1, draw: drawBelt },
        { fy: STOOL.y, draw: (c) => { const S = laneProps(); c.drawImage(S.stool, STOOL.x - 7, STOOL.y - 23); } },
        { fy: CRATE.y, draw: (c) => { const S = laneProps(); c.drawImage(S.crate, CRATE.x - 1, CRATE.y - 12); } },
        { fy: TUBS.y, draw: (c) => { const S = laneProps(); c.drawImage(S.tubs, TUBS.x, TUBS.y - 16); if (night) c.drawImage(S.wet, TUBS.x + 3, TUBS.y - 34); } },
        ...npcDrawables(),
        ...folkDrawables(A, t),
        selfDrawable(A, walker, t, { carry: !!carry && (carry.k === 'surf' || carry.k === 'hund') }),
        { fy: walker.py + 0.1, draw: drawCarry },
      ];
      // det kollegorna bär: boardingkortet eller specialväskan (skiftledaren håller reda på vem)
      if (coop.active) for (const f of coop.peers()) {
        const bag = lyftBag || (cur ? cur.bag : null);
        const c = f.id === kortBy ? { k: 'kort' } : f.id === lyftBy && bag ? { k: bag.kind, bag } : null;
        if (c) D.push({ fy: f.y + 0.1, draw: (cx) => drawCarryAt(cx, c, f.x, f.y, 'down') });
      }
      if (!night) D.push({ fy: 160, draw: (c) => drawPerson(c, 336, 160, COLLEAGUE, colleague.busy ? 'up' : 'down', colleague.busy ? (Math.floor(t * 3) % 2 ? 4 : 0) : (Math.sin(t) > 0.9 ? 4 : 0)) });
      if (cleaner) D.push({ fy: 114, draw: (c) => { drawPerson(c, cleaner.x, 114, CLEANER, cleaner.dir > 0 ? 'right' : 'left', WALK_SEQ[Math.floor(t * 5) % 4]); c.fillStyle = '#5a6068'; c.fillRect(Math.round(cleaner.x) + cleaner.dir * 8 - 3, 112, 7, 3); c.fillStyle = '#2aa39a'; c.fillRect(Math.round(cleaner.x) + cleaner.dir * 8 - 3, 110, 7, 2); } });
      D.sort((p, q) => p.fy - q.fy).forEach((d) => d.draw(ctx));
      pops.draw(ctx);
      const V = vis(), bv = { x0: V.l, x1: V.r };                    // bubblorna hålls i den synliga rutan
      talkQ.draw(ctx, bv);
      talkP.draw(ctx, bv);
      talkMe.draw(ctx, bv);
      drawHover(ctx);
      ctx.restore();
      // ---- allt nedan i canvaskoordinater, innanför den synliga rutan ----
      // en rad hjälp i början, strax ovanför stegremsan (täcker inte klockan eller skärmen) – och
      // när en kollega kommer: hur man delar på jobbet
      const ihopHelp = ihopT >= 0 && t - ihopT < 8, age = ihopHelp ? t - ihopT : t;
      if ((t < 8 || ihopHelp) && !done) {
        const s = ihopHelp ? $t('IHOP: EN CHECKAR IN VID SKÄRMEN - EN TAR VÄSKORNA!') : $t('PASS - VIKT - PLATS - LAPP - BAND - KORT. KLICKA PÅ SKÄRMEN!'), w = textW(SMALL, s) + 8;
        const hx = clamp(((b.x0 + b.x1) >> 1) - (w >> 1), b.x0 + 1, Math.max(b.x0 + 1, b.x1 - w - 1)), hy = b.fy1 - 12;
        ctx.globalAlpha = age > 7 ? 8 - age : 1;
        ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(hx, hy, w, 10);
        ctxText(ctx, SMALL, s, hx + 4, hy + 3, '#ffd23f');
        ctx.globalAlpha = 1;
      }
      drawStrip(ctx);
      // topplisten (shift.js) ritas från vänsterkanten av den synliga rutan och lika bred som den
      ctx.save();
      ctx.translate(b.x0, 0);
      drawShiftHud(ctx, { W: b.x1 - b.x0 }, { t, dur: P.seconds, ok: maxN > 1 ? team.ok : stats.ok, fel: maxN > 1 ? team.fel : stats.fel, title: hudTitle() });
      ctx.restore();
      hudClock(ctx, b);
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };
  return api;
}
