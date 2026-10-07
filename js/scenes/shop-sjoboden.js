// SJÖBODEN INNE – fiskrestaurangen längst ut på piren i Linnéstaden (fasaden: buildings-linne.js
// paintKrog, piren och uteserveringen: js/city/pir.js). Carl 2026-10-07: "man ska kunna gå in i butiken".
// Lokalen är 480 px bred (kameran följer figuren) och ser ut som en gammal sjöbod som blivit krog:
//
//   VÄNSTER: tre spröjsade fönster rakt ut mot havet – himlen, fyren på Pixelskär som blinkar på
//     kvällen, en segelbåt som glider förbi, måsar och ibland en fisk som hoppar. Under fönstren en
//     bred fönsterbänk med tre barstolar (man sitter med ryggen mot oss och tittar ut).
//   MITTEN: trädörren med ett runt skeppsfönster, en åra och skylten VÄLKOMMEN OMBORD ovanför,
//     skeppsratten och tavlan med fyren på väggen, och en tunna där skeppskatten Sill sover.
//   HÖGER: disken med glasmontern full av is – torsk, lax, räkor, kräftor, en hummer och citroner –
//     kassan och en ringklocka. Bakom den Maja i randig tröja: soppgrytan som puttrar, fritösen,
//     kopparkastrullerna på stången, hyllan med sillburkar och griffeltavlan med dagens meny.
//     Längst in akvariet där hummern Harald bor (han är inte till salu).
//   I TAKET: fisknät med glaskulor och skeppslyktor som tänds på kvällen.
//
// FLÖDET (ätregeln, samma som på kebaben och i Burgarbaren): beställ vid disken → Maja lagar
// (grytan, fritösen, montern, upplägget) → brickan i händerna → klicka på en ledig plats → sätt
// dig och ät tugga för tugga (mättnaden och energin kommer bara medan man sitter) → lyckan kommer
// när allt är uppätet. Mitt i maten kommer man inte ut: "ÄT UPP FÖRST! 😋" / "DU MÅSTE SÄTTA DIG
// OCH ÄTA UPP!". Byts scenen ändå får man resten i exit(); omladdning/flikbyte räknas in (settleNow,
// saveAsEaten). Gästerna köar, beställer, sätter sig och äter – stamgästerna sitter redan där.
//
// _debug (för tester): spot(id) → SKÄRMkoordinater, state(), forceBuy(ids), tray(), seated(),
// seats(), sit(id), eatFast(), tick(sek), lockCam(x), teleport(x, y), cam(), panorama(), sheet().
import { Pix, SMALL, textW, eachTextPixel, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, modalOpen } from '../core/ui.js';
import { fmt, SAVE_KEY } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, sayBubble, sayLines, createSpeech } from './walkable.js';
import { worldFolksHere, worldSeatsTaken } from '../net/world.js';

const MSG_ATUPP = 'ÄT UPP FÖRST! 😋';
const MSG_DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';
const MENU_TITLE = '🐟 Sjöboden – vad får det lov att vara?';

// ======================= menyn =======================
// fill = mättnad, energy = energi, bites = tuggor (delas ut tugga för tugga medan man sitter),
// glad = lycka när allt är uppätet. main = varmrätt (en per beställning; glass och dricka läggs till).
export const SJO_MENY = [
  { id: 'fishchips', icon: '🐟', name: 'Fish and chips med remouladsås', board: 'FISH&CHIPS', price: 69, fill: 52, energy: 8, bites: 4, main: true, glad: 2 },
  { id: 'raksmorgas', icon: '🦐', name: 'Räksmörgås på rågbröd', board: 'RÄKMACKA', price: 85, fill: 44, energy: 8, bites: 4, main: true, glad: 4 },
  { id: 'fisksoppa', icon: '🍲', name: 'Fisksoppa med aioli', board: 'FISKSOPPA', price: 79, fill: 48, energy: 12, bites: 4, main: true, glad: 3 },
  { id: 'sill', icon: '🥔', name: 'Inlagd sill med färskpotatis', board: 'SILL', price: 59, fill: 45, energy: 6, bites: 3, main: true, glad: 2 },
  { id: 'hjortron', icon: '🍨', name: 'Vaniljglass med varma hjortron', board: 'HJORTRON', price: 39, fill: 9, energy: 6, bites: 3, glad: 3 },
  { id: 'soda', icon: '🥤', name: 'Hallonsoda', board: 'SODA', price: 15, fill: 4, energy: 10, bites: 2, glad: 0 },
];
const menyOf = (id) => SJO_MENY.find((m) => m.id === id);
// en giltig beställning: kända rätter, var och en högst en gång, högst en varmrätt – i menyordning
function normOrder(ids) {
  const out = [];
  let main = false;
  for (const id of ids || []) {
    const m = menyOf(id);
    if (!m || out.includes(m)) continue;
    if (m.main) { if (main) continue; main = true; }
    out.push(m);
  }
  return out.sort((a, b) => SJO_MENY.indexOf(a) - SJO_MENY.indexOf(b));
}
const priceOf = (list) => list.reduce((a, m) => a + m.price, 0);
const fillOf = (list) => list.reduce((a, m) => a + m.fill, 0);
const energyOf = (list) => list.reduce((a, m) => a + m.energy, 0);
const SAY = { fishchips: 'fish and chips', raksmorgas: 'en räksmörgås', fisksoppa: 'en fisksoppa', sill: 'sill med färskpotatis', hjortron: 'hjortronglass', soda: 'en hallonsoda' };
function orderText(list) {
  const names = list.map((m) => SAY[m.id]);
  return names.length < 2 ? names[0] || '' : names.slice(0, -1).join(', ') + ' och ' + names[names.length - 1];
}

// ======================= mått (världskoordinater) =======================
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till lokalen
const W = 480, H = 216;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const WALL_Y = 84;                                     // där golvet möter bakväggen
const WINS = [{ x0: 14, x1: 62 }, { x0: 70, x1: 118 }, { x0: 126, x1: 174 }];   // fönstren mot havet
const WIN_T = 16, WIN_B = 60, HORIZON = 37;            // glasets över-/underkant, horisonten
const SILL = { x0: 8, x1: 180, y: 66 };                // fönsterbänken (skivan, där maten står)
const DOOR = { x0: 184, x1: 212, top: 26 };            // trädörren med skeppsfönstret
const DOOR_SPOT = [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 7];
const RATT = { x: 226, y: 24 };                        // skeppsratten på väggen
const TAVLA = { x0: 216, x1: 236, y0: 42, y1: 60 };    // tavlan med fyren
const CNT = { x0: 238, x1: 446, top: 96, face: 103, y: 118 }; // disken med glasmontern (golvkant y)
const BACK = { x0: 238, x1: 446, top: 66, y: 86 };     // bakdisken mot väggen
const MENU = { x0: 296, x1: 412, y0: 4, y1: 44 };      // griffeltavlan med dagens meny
const POT = { x0: 248, x1: 276, top: 52 };             // soppgrytan på spisen
const FRY = { x0: 344, x1: 374, top: 54 };             // fritösen
const SHELF = { x0: 416, x1: 446, y0: 14, y1: 64 };    // hyllan med sillburkar, tallrikar och hjortronsylt
const MONTER = { x0: 246, x1: 350 };                   // glasmontern i disken
const REG = { x0: 382, x1: 402 };                      // kassan
const PAY_X = 392, ORDER_Y = 127;                      // där man står och beställer
const QPOS = [410, 426, 442];                          // gästernas kö
const COOK_FRONT = 106, COOK_BACK = 91;                // Majas fötter: vid disken / vid bakdisken
const POT_X = 262, FRY_X = 359, MONTER_X = 298, PLATE_X = 336, SHELF_X = 431;
const AQUA = { x0: 450, x1: 476, top: 62, y: 118 };    // akvariet på sitt skåp
const STOOLS = [38, 94, 150], STOOL_Y = 100;           // barstolarna vid fönstren
const TABLES = [{ id: 't1', x: 66, y: 156 }, { id: 't2', x: 162, y: 188 }, { id: 't3', x: 308, y: 174 }];
const TUNNA = { x: 228, y: 110 };                      // tunnan där skeppskatten sover
const ANKARE = { x: 24, y: 206 };                      // ankaret och repet i hörnet närmast oss
const TINOR = { x: 456, y: 208 };                      // hummertinor på hög
const LYKTOR = [{ x: 66, len: 12 }, { x: 162, len: 18 }, { x: 287, len: 14 }];  // skeppslyktorna i taket (inte framför tavlan)

// ======================= små målarverktyg =======================
const WHITE = 0xffffff;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const c100 = (v) => clamp(v, 0, 100);
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = fn(x + i, y + j, i, j);
    if (c !== null && c !== undefined) P.px(x + i, y + j, c);
  }
}
// pixelkarta: en sträng per rad, tecknet slås upp i paletten ('.' = genomskinligt)
function spr(P, x, y, rows, pal, a = 1) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, c, a); }
  }
}
// mörk kontur runt allt som är målat i en Pix (tonad efter grannfärgen)
function outline(P, dark = 0x1e1418) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] > 200) { best = j; break; }
    }
    if (best < 0) continue;
    const o = mix(dark, (src[best] << 16) | (src[best + 1] << 8) | src[best + 2], 0.28);
    d[i] = (o >> 16) & 255; d[i + 1] = (o >> 8) & 255; d[i + 2] = o & 255; d[i + 3] = 255;
  }
}
// text som bitmapp med kontur, skugga och högdager
function textMask(F, s) {
  const w = textW(F, s), pts = [];
  eachTextPixel(F, s, 0, 0, 1, (x, y) => pts.push([x, y]));
  return { w, pts, set: new Set(pts.map(([a, b]) => a + ',' + b)) };
}
function drawText(P, M, x, y, o) {
  const has = (a, b) => M.set.has(a + ',' + b);
  if (o.shadow !== undefined) for (const [a, b] of M.pts) if (!has(a + 1, b + 1)) P.px(x + a + 1, y + b + 1, o.shadow, o.sa ?? 0.6);
  for (const [a, b] of M.pts) P.px(x + a, y + b, typeof o.fill === 'function' ? o.fill(a, b) : o.fill, o.a ?? 1);
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const isNight = (h) => h >= 19.5 || h < 6.5;
function darkness(hour) {
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}

// ======================= färgerna (sjöbodens stil) =======================
const PANEL = { hi: 0xf6f0e2, base: 0xe8dfca, lo: 0xc8bca2, dk: 0x9a8c72 };   // vitlaserade väggbrädor
const NAVY = { hi: 0x5a7aa8, base: 0x34507e, lo: 0x22385e, dk: 0x142440 };    // den blå panelen och listerna
const TAR = { hi: 0x8a6440, base: 0x6a4a2e, lo: 0x4a321e, dk: 0x2e1e12 };     // tjärat trä (disken, bjälkarna)
const PLANK = { hi: 0xc89a64, base: 0xa87c4c, lo: 0x8a6238, dk: 0x5e4024 };   // golvplankorna
const ROPE = { hi: 0xe8d8b0, base: 0xc8b488, lo: 0x9a8660 };
const BRASS = { hi: 0xfff0a0, base: 0xd8b04a, lo: 0xa07a28, dk: 0x6a4e18 };
const COPPER = { hi: 0xf8b07a, base: 0xc8703a, lo: 0x8e4a22, dk: 0x5a2c12 };
const STEEL = { hi: 0xf0f2f4, base: 0xc4c9cf, mid: 0x9aa1a9, lo: 0x6e757e, dk: 0x444a52 };
const CLOTH = [0xf6f2e8, 0x2a5a9a];                                           // blårutiga dukar
const PLATE = { hi: 0xffffff, base: 0xf0eee8, lo: 0xc8c4bc, rim: 0x3a6ab0 };

// ======================= rätterna (en bild per tugga) =======================
// Alla rätter ligger på Sjöbodens vita tallrikar med blå kant (soppan i en skål, glassen i en
// glasskål, sodan i ett glas med sugrör). För varje tugga blir det mindre kvar; uppätet = tom
// tallrik med smulor (och citronskalet kvar).
function plate(P, cx, by, hw) {                                          // tallriken snett ovanifrån: blå kant runt om
  const rows = [[-2, hw - 3], [-1, hw - 1], [0, hw], [1, hw - 1], [2, hw - 3]];
  for (const [j, w] of rows) for (let i = -w; i <= w; i++) {
    const edge = j === -2 || j === 2 || Math.abs(i) >= w - (j === 0 ? 1 : 0);
    let c = edge ? (j > 0 ? mul(PLATE.rim, 0.75) : PLATE.rim) : j === -1 ? PLATE.hi : jit(PLATE.base, cx + i, by + j, 3, 0.03);
    if (j === 2) c = PLATE.lo;
    P.px(cx + i, by + j, c);
  }
}
function fishchipsImg(stage, bites) {
  const P = new Pix(22, 12), left = bites - stage;
  plate(P, 11, 9, 10);
  if (left <= 0) { P.px(7, 8, 0xd8a050); P.px(12, 9, 0xc89040); P.px(15, 8, 0xd8b050); spr(P, 15, 6, ['yy', 'yw'], { y: 0xf4d040, w: 0xfff4c0 }); return P.flush(); }
  const fishLen = Math.max(2, Math.round(9 * (left / bites)));                // fisken blir kortare
  area(P, 4, 6, fishLen, 3, (X, Y, i, j) => (j === 0 ? (i % 2 ? 0xf0c060 : 0xe8b048) : j === 2 ? 0xa86a28 : (hash(X, Y, 4) > 0.6 ? 0xd89038 : 0xe8a848)));
  if (fishLen < 9) { P.px(4 + fishLen, 7, 0xfaf4e8); P.px(4 + fishLen - 1, 7, 0xfaf4e8); }   // det vita fiskköttet där man tagit en bit
  const fries = [[12, 5], [14, 4], [13, 6], [16, 5], [15, 7], [17, 6]], n = Math.ceil(fries.length * left / bites);
  fries.slice(0, n).forEach(([x, y], k) => { P.hl(x, y, 1, 0xf8d860); P.vl(x, y, 3, k % 2 ? 0xf0c840 : 0xe8b830); });
  spr(P, 17, 3, ['.y', 'yw'], { y: 0xf4d040, w: 0xfff4c0 });                  // citronklyftan
  if (left > 1) { P.px(9, 4, 0xe8e4b0); P.px(10, 4, 0xd8d8a0); P.px(9, 5, 0xc8d090); }   // remouladen
  outline(P);
  return P.flush();
}
function raksmorgasImg(stage, bites) {
  const P = new Pix(22, 13), left = bites - stage;
  plate(P, 11, 10, 10);
  if (left <= 0) { P.px(8, 9, 0x5a3a24); P.px(13, 10, 0xf49a8a); P.px(10, 9, 0x6aa040); return P.flush(); }
  const bw = Math.max(4, Math.round(15 * (0.35 + 0.65 * left / bites)));       // brödet: bitar tas från höger
  area(P, 4, 7, bw, 3, (X, Y, i, j) => (j === 0 ? 0x7a5236 : j === 2 ? 0x3a2416 : hash(X, Y, 5) > 0.7 ? 0x6a4428 : 0x5a3a22));
  for (let i = 0; i < bw; i += 2) P.px(4 + i, 6, i % 4 ? 0x6ab040 : 0x4a9030);   // salladen sticker ut
  const pile = Math.max(1, Math.round(4 * left / bites));
  for (let k = 0; k < pile * 3; k++) { const x = 5 + ((k * 5) % Math.max(3, bw - 3)), y = 5 - (k % 3 === 0 && pile > 2 ? 1 : 0) - Math.floor(k / 6); P.px(x, y, k % 2 ? 0xf8a090 : 0xf07a6a); P.px(x + 1, y, 0xfac0b0); }   // räkorna
  if (left > 1) { spr(P, 6, 4, ['wy'], { w: 0xfaf8f0, y: 0xf8c838 }); P.px(11, 3, 0xfaf6e0); P.px(12, 3, 0xf4f0d0); P.px(9, 3, 0x4aa040); P.px(10, 2, 0x5ab050); }   // ägg, majonnäs, dill
  spr(P, 16, 5, ['.y.', 'yby', '.y.'], { y: 0xf4d040, b: 0xfff4c0 });            // citronskivan
  outline(P);
  return P.flush();
}
function fisksoppaImg(stage, bites) {
  const P = new Pix(20, 14), left = bites - stage;
  // skålen från sidan: vit med blå rand, soppans yta en ellips som sjunker
  for (let j = 0; j < 6; j++) { const hw = 7 - Math.floor(j * j / 9); for (let i = -hw; i <= hw; i++) P.px(10 + i, 7 + j, j === 1 ? PLATE.rim : i > hw - 2 ? PLATE.lo : jit(PLATE.base, i, j, 6, 0.03)); }
  P.hl(6, 13, 9, PLATE.lo); P.hl(7, 12, 7, PLATE.lo);
  if (left > 0) {
    const lvl = 7 - Math.round(2 * left / bites);
    for (let i = -6; i <= 6; i++) for (let j = 0; j < 2; j++) if ((i / 6.5) ** 2 + (j - 0.5) ** 2 < 1.1) P.px(10 + i, lvl + j, j ? 0xb8501e : 0xd86a2a);
    if (left > 1) { P.px(7, lvl, 0xfaf4e8); P.px(13, lvl, 0xf8a090); P.px(12, lvl + 1, 0xfaf4e8); }   // fisk och räkor
    if (left > 2) { P.px(10, lvl - 1, 0xfaf6e0); P.px(11, lvl - 1, 0xf4ecc8); P.px(10, lvl, 0xf0e8c0); }   // aiolin
  } else { P.hl(6, 7, 9, 0xe8a070); }
  P.line(14, 2, 17, 8, 0xb8bcc4); P.px(14, 2, 0xe8ecf0); P.px(13, 1, 0xd8dce4);   // skeden
  outline(P);
  return P.flush();
}
function sillImg(stage, bites) {
  const P = new Pix(22, 12), left = bites - stage;
  plate(P, 11, 9, 10);
  const pot = [[14, 6], [17, 7], [15, 8]].slice(0, Math.max(0, Math.ceil(3 * left / bites)));
  for (const [x, y] of pot) { spr(P, x - 1, y - 1, ['.yy', 'yyy', 'oyo'], { y: 0xf0d470, o: 0xc8a450 }); P.px(x, y - 1, 0xfaf0b0); }   // färskpotatisen
  if (left > 0) {
    const n = Math.max(1, Math.round(3 * left / bites));
    for (let k = 0; k < n; k++) { const x = 4 + k * 3; P.vl(x, 5, 4, 0xe8eef4); P.vl(x + 1, 5, 4, 0xc8d4e0); P.px(x, 5, 0x6a7a90); P.px(x + 1, 5, 0x4a5a70); }   // sillbitarna
    if (left > 1) { spr(P, 9, 4, ['ww', 'ww'], { w: 0xfaf8f0 }); P.px(9, 3, 0x4aa040); P.px(10, 3, 0x3a9030); }   // gräddfil och gräslök
  } else { P.px(8, 8, 0xe8eef4); P.px(13, 8, 0x4aa040); }
  outline(P);
  return P.flush();
}
function hjortronImg(stage, bites) {
  const P = new Pix(16, 14), left = bites - stage;
  // glasskålen på fot
  for (let j = 0; j < 4; j++) { const hw = 6 - j; for (let i = -hw; i <= hw; i++) P.px(8 + i, 7 + j, i === -hw ? 0xf0f8ff : 0xc8e0f0); }
  P.vl(8, 11, 2, 0xc8e0f0); P.hl(5, 13, 7, 0xb0c8dc);
  if (left > 0) {
    const sc = Math.max(1, Math.ceil(2 * left / bites));
    for (let s = 0; s < sc; s++) { const cx = 6 + s * 4, cy = 5 - (s === 0 && sc > 1 ? 0 : 0); for (let j = -2; j <= 1; j++) for (let i = -2; i <= 2; i++) if (i * i / 5 + j * j / 3 <= 1) P.px(cx + i, cy + j, j < 0 ? 0xfffaf0 : 0xf4ecd8); }
    for (const [x, y] of [[5, 3], [8, 2], [10, 4], [7, 5], [11, 3]].slice(0, 2 + left)) { P.px(x, y, 0xf0901a); P.px(x + 1, y, 0xf8b040); }   // hjortronen
  }
  outline(P);
  return P.flush();
}
function sodaImg(stage, bites) {
  const P = new Pix(10, 15), left = bites - stage;
  area(P, 2, 3, 6, 11, (X, Y, i, j) => (i === 0 ? 0xf0f8ff : i === 5 ? 0xa8c0d0 : 0xe4f0f6));   // glaset (tomt = ljust, inte svart)
  P.hl(2, 13, 6, 0xa8c0d0);
  const top = 13 - Math.round(9 * left / bites);
  for (let y = top; y < 13; y++) for (let x = 3; x < 7; x++) P.px(x, y, y === top ? 0xf86a8a : x === 3 ? 0xe84a6a : 0xd83050);
  if (left > 0) { P.px(4, top + 2, 0xffc0d0); P.px(5, top + 4, 0xffc0d0); }   // bubblorna
  P.line(6, 0, 4, 11, 0xf4f4f4); P.px(6, 0, 0xe8443a); P.px(5, 2, 0xe8443a);   // sugröret
  outline(P);
  return P.flush();
}
const dishCache = new Map();
function dishImg(id, stage, bites) {
  const k = id + ':' + stage + ':' + bites;
  let c = dishCache.get(k);
  if (!c) {
    const f = { fishchips: fishchipsImg, raksmorgas: raksmorgasImg, fisksoppa: fisksoppaImg, sill: sillImg, hjortron: hjortronImg, soda: sodaImg }[id] || fishchipsImg;
    c = f(stage, bites);
    dishCache.set(k, c);
  }
  return c;
}
// Brickan: en träbricka med repkant och en rutig servett, rätterna ovanpå (varmrätten fram till
// vänster, glassen fram till höger, sodan bakom)
const TRAY_W = 36, TRAY_H = 24;
const trayCache = new Map();
function trayCanvas(items) {
  const key = items.map((it) => it.id + it.stage + '/' + it.bites).join(',');
  let F = trayCache.get(key);
  if (F) return F;
  const P = new Pix(TRAY_W, TRAY_H);
  area(P, 0, TRAY_H - 5, TRAY_W, 4, (X, Y, i, j) => (j === 0 ? ROPE.hi : j === 3 ? TAR.dk : i === 0 ? TAR.hi : i === TRAY_W - 1 ? TAR.lo : jit(PLANK.base, X, Y, 21, 0.06)));
  for (let i = 1; i < TRAY_W - 1; i += 2) P.px(i, TRAY_H - 5, ROPE.base);
  P.hl(1, TRAY_H - 1, TRAY_W - 2, 0x1a1014, 0.4);
  area(P, 3, TRAY_H - 6, 9, 1, (X) => (X % 2 ? CLOTH[1] : CLOTH[0]));          // servetten
  F = P.flush();
  const x2 = F.getContext('2d');
  const n = items.length;
  const spots = n === 1 ? [[18, 0]] : n === 2 ? [[13, 0], [29, -1]] : [[12, 0], [29, 0], [24, -6]];
  const order = items.map((it, k) => ({ it, s: spots[Math.min(k, spots.length - 1)] })).sort((a, b) => a.s[1] - b.s[1]);
  for (const { it, s } of order) {
    const c = dishImg(it.id, it.stage, it.bites);
    x2.drawImage(c, s[0] - (c.width >> 1), TRAY_H - 5 - c.height + 1 + s[1]);
  }
  trayCache.set(key, F);
  return F;
}
function drawTrayHeld(ctx, x, y, dir, items) {
  if (!items || !items.length) return;
  const c = trayCanvas(items);
  const tx = dir === 'left' ? x - c.width + 2 : dir === 'right' ? x - 1 : x - (c.width >> 1);
  ctx.drawImage(c, Math.round(tx), Math.round(y) - (dir === 'up' ? 20 : 22) - (c.height - 20));
}
// ======================= bakgrunden =======================
// Väggen: takbjälkar, vitlaserade stående brädor med kvistar, en blå panel nertill och fönstren
// (glaset lämnas tomt – utsikten ritas levande bakom fönsterkarmarna, se paintWinOverlay).
function paintWall(P) {
  // taket: mörka bjälkar och de undre brädorna
  area(P, 0, 0, W, 9, (X, Y, i, j) => (j === 8 ? TAR.dk : (X % 40 < 6 ? jit(TAR.base, X, Y, 1, 0.05) : jit(mul(TAR.lo, 0.9), X, Y, 2, 0.05))));
  for (let x = 0; x < W; x += 40) { P.hl(x, 0, 6, TAR.hi); P.vl(x + 5, 0, 8, TAR.dk); }
  // de stående brädorna (7 px breda): ljus kant, mörk fog, en kvist här och där
  for (let y = 9; y < 64; y++) for (let x = 0; x < W; x++) {
    const b = Math.floor(x / 7), u = x % 7, k = hash(b, 1, 11);
    let c = mul(PANEL.base, 0.94 + k * 0.08);
    if (u === 0) c = PANEL.dk; else if (u === 1) c = PANEL.hi; else if (u === 6) c = PANEL.lo;
    const kv = hash(b, Math.floor(y / 18), 12);
    if (kv > 0.82 && Math.hypot(u - 3.5, (y % 18) - 9) < 1.4) c = 0xa89070;      // kvisten
    if (y < 12) c = mul(c, 0.8 + (y - 9) * 0.06);                                // skuggan under taket
    P.px(x, y, jit(c, x, y, 13, 0.03));
  }
  // den blå panelen nertill med en list överst
  area(P, 0, 64, W, WALL_Y - 64, (X, Y, i, j) => (j === 0 ? NAVY.hi : j === 1 ? NAVY.base : j === 2 ? NAVY.dk : (X % 22 === 0 ? NAVY.dk : X % 22 === 1 ? NAVY.hi : jit(NAVY.base, X, Y, 14, 0.04))));
  P.hl(0, WALL_Y - 1, W, NAVY.dk);
  // fönsterbänken: en tjock planka med repkant under fönstren
  area(P, SILL.x0, SILL.y - 2, SILL.x1 - SILL.x0, 5, (X, Y, i, j) => (j === 0 ? PLANK.hi : j === 4 ? TAR.dk : j === 3 ? PLANK.lo : jit(PLANK.base, X, Y, 15, 0.05)));
  for (let x = SILL.x0; x < SILL.x1; x += 2) { P.px(x, SILL.y + 3, ROPE.base); P.px(x + 1, SILL.y + 3, ROPE.lo); }
  for (const x of [SILL.x0 + 12, (SILL.x0 + SILL.x1) >> 1, SILL.x1 - 12]) { P.rect(x - 1, SILL.y + 3, 3, 8, TAR.lo); P.px(x - 1, SILL.y + 3, TAR.hi); }   // konsolerna
  // fönsterkarmarna (djupa, vita) – glaset fylls levande
  for (const w of WINS) {
    area(P, w.x0 - 4, WIN_T - 4, w.x1 - w.x0 + 8, WIN_B - WIN_T + 8, (X, Y, i, j) => {
      const e = Math.min(i, j, w.x1 - w.x0 + 7 - i, WIN_B - WIN_T + 7 - j);
      if (e >= 4) return null;
      return e === 0 ? PANEL.dk : e === 1 ? WHITE : e === 3 ? mul(PANEL.lo, 0.9) : jit(PANEL.hi, X, Y, 16, 0.02);
    });
    P.hl(w.x0 - 5, WIN_B + 4, w.x1 - w.x0 + 10, PANEL.hi); P.hl(w.x0 - 5, WIN_B + 5, w.x1 - w.x0 + 10, PANEL.lo);   // fönsterblecket
  }
  // dörren: karmen och en åra med skylten VÄLKOMMEN OMBORD ovanför
  area(P, DOOR.x0 - 3, DOOR.top - 3, DOOR.x1 - DOOR.x0 + 6, WALL_Y - DOOR.top + 3, (X, Y, i, j) => (i < 3 || i > DOOR.x1 - DOOR.x0 + 2 || j < 3 ? (i === 0 || j === 0 || i === DOOR.x1 - DOOR.x0 + 5 ? TAR.dk : jit(TAR.base, X, Y, 17, 0.05)) : null));
  P.rect(DOOR.x0 - 6, 12, DOOR.x1 - DOOR.x0 + 12, 2, PLANK.base); P.hl(DOOR.x0 - 6, 12, DOOR.x1 - DOOR.x0 + 12, PLANK.hi);   // åran (skaftet)
  P.rect(DOOR.x1 + 3, 10, 6, 6, PLANK.base); P.hl(DOOR.x1 + 3, 10, 6, PLANK.hi); P.rect(DOOR.x1 + 7, 11, 2, 4, 0xc8302a);    // årbladet med röd spets
  area(P, DOOR.x0 - 2, 16, DOOR.x1 - DOOR.x0 + 4, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === DOOR.x1 - DOOR.x0 + 3 || j === 7 ? NAVY.dk : NAVY.base));
  const vk = textMask(SMALL, 'OMBORD');
  drawText(P, vk, ((DOOR.x0 + DOOR.x1 - vk.w) >> 1), 18, { fill: 0xf4f0e2, shadow: NAVY.dk });
  // skeppsratten (målas – den svänger inte) och tavlan med fyren
  const { x: rx, y: ry } = RATT;
  for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; P.line(rx, ry, Math.round(rx + Math.cos(an) * 11), Math.round(ry + Math.sin(an) * 11), a % 2 ? PLANK.lo : PLANK.base); P.rect(Math.round(rx + Math.cos(an) * 12) - 1, Math.round(ry + Math.sin(an) * 12) - 1, 2, 2, PLANK.hi); }
  for (let a = 0; a < 48; a++) { const an = a / 48 * Math.PI * 2; for (const r of [7, 8]) P.px(Math.round(rx + Math.cos(an) * r), Math.round(ry + Math.sin(an) * r), r === 7 ? PLANK.hi : PLANK.lo); }
  P.rect(rx - 2, ry - 2, 4, 4, BRASS.base); P.px(rx - 1, ry - 1, BRASS.hi);
  area(P, TAVLA.x0, TAVLA.y0, TAVLA.x1 - TAVLA.x0, TAVLA.y1 - TAVLA.y0, (X, Y, i, j) => {
    const w = TAVLA.x1 - TAVLA.x0, h = TAVLA.y1 - TAVLA.y0;
    if (i < 2 || j < 2 || i >= w - 2 || j >= h - 2) return i === 0 || j === 0 ? BRASS.hi : BRASS.lo;
    if (j < 10) return j < 6 ? 0xf0c890 : 0xf8dca8;                                        // kvällshimmel
    return (i + j) % 5 === 0 ? 0x4a7aa8 : 0x2a5a8a;                                         // havet
  });
  spr(P, TAVLA.x0 + 12, TAVLA.y0 + 3, ['.y.', 'rwr', '.w.', '.r.', '.w.', 'ggg'], { y: 0xfff4a0, r: 0xd8302a, w: 0xf4f0e6, g: 0x5a5a50 });   // fyren på sitt skär
  P.hl(TAVLA.x0 + 2, TAVLA.y0 + 8, 9, 0xfff0b0, 0.5);                                      // fyrljuset
  // nätet i taket med glaskulor (vänstra halvan) och ett hängande rep
  for (let x = 0; x < 236; x++) for (let j = 0; j < 12; j++) {
    const sag = Math.round(Math.sin((x % 78) / 78 * Math.PI) * 6), y = 8 + j;
    if (j > sag + 4) continue;
    if ((x + j) % 4 === 0 || (x - j + 400) % 4 === 0) P.px(x, y, mix(ROPE.base, ROPE.lo, j / 12), 0.85);
  }
  for (const [gx, gy, c] of [[22, 14, 0x3a9a7a], [58, 17, 0x3a6ab0], [104, 15, 0x5ab08a], [140, 18, 0x3a8ab0], [196, 14, 0x4aa080]]) {
    P.ell(gx, gy, 3, 3, c, 1, 1); P.px(gx - 1, gy - 1, 0xe8fff8); P.px(gx + 1, gy + 1, mul(c, 0.7));
    for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; P.px(Math.round(gx + Math.cos(an) * 3.6), Math.round(gy + Math.sin(an) * 3.6), ROPE.lo, 0.7); }   // nätet runt kulan
  }
  // livbojen med SJÖBODEN på väggen till vänster om fönstren och ett gammalt foto
  const lb = { x: 6, y: 40 };
  for (let a = 0; a < 40; a++) { const an = a / 40 * Math.PI * 2; for (const r of [3, 4, 5]) P.px(Math.round(lb.x + Math.cos(an) * r), Math.round(lb.y + Math.sin(an) * r), Math.floor(an / (Math.PI / 2)) % 2 ? 0xf4f1ea : 0xe8443a); }
}
// köket bakom disken: blå-vitt kakel, spisen med soppgrytan, fritösen, kopparkastrullerna,
// griffeltavlan och hyllan med burkar
function paintKitchen(P) {
  // kaklet bakom spisen och fritösen
  for (let y = 46; y < BACK.top; y++) for (let x = BACK.x0; x < SHELF.x0; x++) {
    const u = (x - BACK.x0) % 8, v = (y - 46) % 8, tile = ((Math.floor((x - BACK.x0) / 8) + Math.floor((y - 46) / 8)) & 1);
    let c = tile ? 0xf4f6f8 : 0xe4ecf4;
    if ((u === 3 || u === 4) && (v === 3 || v === 4) && tile) c = 0x5a7ab0;                // små blå mönster i vartannat kakel
    if (u === 0 || v === 0) c = 0xb8c4d0;
    P.px(x, y, c);
  }
  // griffeltavlan i träram
  area(P, MENU.x0, MENU.y0, MENU.x1 - MENU.x0, MENU.y1 - MENU.y0, (X, Y, i, j) => {
    const w = MENU.x1 - MENU.x0, h = MENU.y1 - MENU.y0;
    if (i < 2 || j < 2 || i >= w - 2 || j >= h - 2) return i === 0 || j === 0 ? PLANK.hi : i === w - 1 || j === h - 1 ? TAR.dk : PLANK.base;
    return jit(0x2a3432, X, Y, 18, 0.06);
  });
  const head = textMask(SMALL, 'DAGENS FÅNGST');
  drawText(P, head, ((MENU.x0 + MENU.x1 - head.w) >> 1), MENU.y0 + 4, { fill: 0xf4d23c });
  SJO_MENY.forEach((m, k) => {
    const col = k < 3 ? 0 : 1, row = k % 3, x = MENU.x0 + 5 + col * 56, y = MENU.y0 + 13 + row * 9;
    const tm = textMask(SMALL, m.board), pm = textMask(SMALL, String(m.price));
    drawText(P, tm, x, y, { fill: 0xf0ece0, a: 0.92 });
    drawText(P, pm, x + 52 - pm.w, y, { fill: 0xf4d23c });
  });
  P.line(MENU.x0 + 58, MENU.y0 + 12, MENU.x0 + 58, MENU.y1 - 4, 0xf0ece0, 0.25);           // kritstrecket i mitten
  // kopparkastrullerna på en stång
  P.hl(BACK.x0 + 4, 30, 50, STEEL.lo); P.hl(BACK.x0 + 4, 29, 50, STEEL.base);
  [[BACK.x0 + 10, 6], [BACK.x0 + 24, 8], [BACK.x0 + 40, 5]].forEach(([x, r]) => {
    P.vl(x, 30, 3, STEEL.dk);
    for (let j = 0; j < r; j++) for (let i = -r; i <= r; i++) if (i * i + (j - 0.5) ** 2 * 1.6 <= r * r) P.px(x + i, 34 + j, i < -r / 2 ? COPPER.hi : i > r / 2 ? COPPER.lo : COPPER.base);
    P.hl(x - r, 33, 2 * r + 1, COPPER.dk);
  });
  // bakdisken: zinkskiva på trästomme
  area(P, BACK.x0, BACK.top, BACK.x1 - BACK.x0, BACK.y - BACK.top, (X, Y, i, j) => {
    if (j === 0) return STEEL.hi;
    if (j < 3) return j === 1 ? STEEL.base : STEEL.lo;
    return (X - BACK.x0) % 24 === 0 ? TAR.dk : jit(TAR.base, X, Y, 19, 0.05);
  });
  for (let x = BACK.x0 + 12; x < BACK.x1; x += 24) { P.rect(x - 1, BACK.top + 9, 3, 2, BRASS.base); P.px(x - 1, BACK.top + 9, BRASS.hi); }   // handtagen
  // spisen och soppgrytan (ångan ritas levande)
  area(P, POT.x0 - 4, BACK.top - 3, POT.x1 - POT.x0 + 8, 3, (X, Y, i, j) => (j === 0 ? 0x4a4a52 : 0x2a2a30));
  for (let j = 0; j < 14; j++) for (let i = 0; i < POT.x1 - POT.x0; i++) {
    const y = POT.top + j;
    let c = i < 4 ? COPPER.hi : i > POT.x1 - POT.x0 - 6 ? COPPER.lo : COPPER.base;
    if (j === 0) c = COPPER.dk; else if (j === 1) c = 0xd86a2a;                             // soppan syns i kanten
    if (j === 13) c = COPPER.dk;
    P.px(POT.x0 + i, y, c);
  }
  P.rect(POT.x0 - 2, POT.top + 3, 2, 3, COPPER.dk); P.rect(POT.x1, POT.top + 3, 2, 3, COPPER.dk);   // öronen
  P.line(POT.x1 - 6, POT.top - 8, POT.x1 - 10, POT.top + 1, PLANK.lo); P.px(POT.x1 - 6, POT.top - 8, PLANK.hi);   // sleven
  // fritösen
  area(P, FRY.x0, FRY.top, FRY.x1 - FRY.x0, BACK.top - FRY.top, (X, Y, i, j) => (j === 0 ? STEEL.hi : i === 0 ? STEEL.base : i === FRY.x1 - FRY.x0 - 1 ? STEEL.dk : j < 3 ? 0x8a6a2a : jit(STEEL.mid, X, Y, 20, 0.05)));
  P.hl(FRY.x0 + 2, FRY.top + 1, FRY.x1 - FRY.x0 - 4, 0xc89a3a);                              // oljan
  P.px(FRY.x1 - 4, FRY.top + 6, 0xff5a2a);
  // hyllan till höger: sillburkar, tallrikar, hjortronsylten, sodaflaskor
  for (const y of [SHELF.y0 + 12, SHELF.y0 + 30, SHELF.y0 + 48]) { P.hl(SHELF.x0, y, SHELF.x1 - SHELF.x0, PLANK.hi); P.hl(SHELF.x0, y + 1, SHELF.x1 - SHELF.x0, TAR.lo); }
  for (let k = 0; k < 3; k++) { const x = SHELF.x0 + 3 + k * 9; P.rect(x, SHELF.y0 + 3, 6, 9, 0xc8dce8); P.rect(x + 1, SHELF.y0 + 5, 4, 6, k === 1 ? 0xe8eef4 : 0xd8e4ec); P.rect(x, SHELF.y0 + 2, 6, 2, 0xd8b04a); P.px(x + 2, SHELF.y0 + 7, 0x8a9ab0); }   // sillburkarna
  for (let k = 0; k < 4; k++) { P.rect(SHELF.x0 + 3 + k * 2, SHELF.y0 + 20, 2, 10, k % 2 ? 0xf0eee8 : 0xdcd8d0); P.px(SHELF.x0 + 3 + k * 2, SHELF.y0 + 20, PLATE.rim); }   // tallrikarna på högkant
  P.rect(SHELF.x0 + 16, SHELF.y0 + 22, 8, 8, 0xf0901a); P.rect(SHELF.x0 + 16, SHELF.y0 + 21, 8, 2, 0xf4f0e6); P.px(SHELF.x0 + 18, SHELF.y0 + 25, 0xffc060);   // hjortronsylten
  for (let k = 0; k < 3; k++) { const x = SHELF.x0 + 4 + k * 8; P.rect(x, SHELF.y0 + 40, 4, 8, 0xd83050); P.rect(x + 1, SHELF.y0 + 37, 2, 3, 0xe8f0f4); P.px(x, SHELF.y0 + 42, 0xf8a0b0); }   // hallonsodan
}
// disken: tjärat trä med repkant, glasmontern full av is och fisk, kassan och ringklockan
function paintCounter() {
  const ox = CNT.x0 - 2, oy = CNT.top - 30, w = CNT.x1 - CNT.x0 + 4, h = CNT.y - oy + 2;
  const P = new Pix(w, h), X0 = (x) => x - ox, Y0 = (y) => y - oy;
  // diskens front (tjärade brädor, repkant upptill och nertill)
  area(P, X0(CNT.x0), Y0(CNT.face), CNT.x1 - CNT.x0, CNT.y - CNT.face, (X, Y, i, j) => (i % 16 === 0 ? TAR.dk : i % 16 === 1 ? TAR.hi : jit(TAR.base, X, Y, 22, 0.06)));
  for (let x = CNT.x0; x < CNT.x1; x += 2) { P.px(X0(x), Y0(CNT.face), ROPE.hi); P.px(X0(x) + 1, Y0(CNT.face), ROPE.lo); P.px(X0(x), Y0(CNT.y - 2), ROPE.base); }
  // skivan
  area(P, X0(CNT.x0 - 1), Y0(CNT.top), CNT.x1 - CNT.x0 + 2, CNT.face - CNT.top, (X, Y, i, j) => (j === 0 ? PLANK.hi : j === CNT.face - CNT.top - 1 ? TAR.lo : jit(PLANK.base, X, Y, 23, 0.05)));
  // glasmontern: lutande glas, isen och fångsten
  const m0 = MONTER.x0, m1 = MONTER.x1, gt = CNT.top - 22;
  for (let y = gt; y < CNT.top; y++) for (let x = m0; x < m1; x++) {
    const k = (y - gt) / 22, edge = x === m0 || x === m1 - 1;
    if (edge) { P.px(X0(x), Y0(y), STEEL.base); continue; }
    if (y > CNT.top - 8) { const ice = hash(x, y, 24); P.px(X0(x), Y0(y), ice > 0.7 ? WHITE : ice > 0.3 ? 0xe4f2fa : 0xc8e2f0); continue; }   // krossad is
    P.px(X0(x), Y0(y), 0xd8eef8, 0.12 + k * 0.05);
  }
  P.hl(X0(m0), Y0(gt), m1 - m0, STEEL.hi); P.hl(X0(m0), Y0(gt) + 1, m1 - m0, STEEL.mid);
  const lay = (x, rows, pal) => spr(P, X0(x), Y0(CNT.top - 6 - rows.length + 2), rows, pal);
  // torskar, laxfiléer, räkhögen, kräftorna, hummern och citronerna på isen
  lay(m0 + 4, ['..ggggggg.', '.gwwwwwwgg', 'gwwwwwwwwf', '.gggggggg.'], { g: 0x8a9a8a, w: 0xd8e0d8, f: 0x5a6a5a });
  lay(m0 + 16, ['oooooooo', 'ooOOoooO', 'oooooooo'], { o: 0xf08a5a, O: 0xf8b890 });
  lay(m0 + 28, ['..rrr..', '.rRrrr.', 'rrrRrrr', 'rRrrrRr'], { r: 0xf07a6a, R: 0xfab0a0 });
  lay(m0 + 38, ['r.r.....', '.rrrrrr.', 'rrrrrrrr', '.r.r.r..'], { r: 0xc8301e });
  lay(m0 + 50, ['bb..........', '.bbbbbbbbbb.', 'bbbbbbbbbbbb', 'b.b.b...b..b'], { b: 0x2a3a6a });
  lay(m0 + 64, ['.yy.', 'yyyy', '.yy.'], { y: 0xf4d040 });
  lay(m0 + 70, ['.yy.', 'yyyy', '.yy.'], { y: 0xf4d040 });
  lay(m0 + 78, ['..ggggggg.', '.gwwwwwwgg', 'gwwwwwwwwf', '.gggggggg.'], { g: 0x8a9a8a, w: 0xd8e0d8, f: 0x5a6a5a });
  lay(m0 + 90, ['dd.d', '.dd.', 'd.dd'], { d: 0x3a9a3a });                                  // dillen
  // prislappar i isen
  for (const [x, c] of [[m0 + 8, 0xf4f0e2], [m0 + 31, 0xf4f0e2], [m0 + 54, 0xf4f0e2]]) { P.rect(X0(x), Y0(CNT.top - 4), 6, 3, c); P.px(X0(x) + 1, Y0(CNT.top - 3), 0x2a2a30); P.px(X0(x) + 3, Y0(CNT.top - 3), 0x2a2a30); }
  // kassan och ringklockan
  area(P, X0(REG.x0), Y0(CNT.top - 12), REG.x1 - REG.x0, 12, (X, Y, i, j) => (j < 4 ? (i > 3 && i < 16 ? (j === 0 ? 0x4a5a4a : 0x2a3a2a) : null) : j === 4 ? BRASS.hi : i % 4 === 0 ? BRASS.lo : BRASS.base));
  P.px(X0(REG.x0) + 6, Y0(CNT.top - 10), 0x8aff8a); P.px(X0(REG.x0) + 8, Y0(CNT.top - 10), 0x8aff8a);
  P.ell(X0(REG.x1 + 10), Y0(CNT.top - 2), 3, 2, BRASS.base, 1, 1); P.px(X0(REG.x1 + 10), Y0(CNT.top - 5), BRASS.lo); P.px(X0(REG.x1 + 9), Y0(CNT.top - 3), BRASS.hi);   // ringklockan
  // en liten skylt: RING FÖR SERVICE … och en burk med dricks
  P.rect(X0(REG.x1 + 18), Y0(CNT.top - 9), 8, 9, 0xd8e8f0); P.rect(X0(REG.x1 + 19), Y0(CNT.top - 5), 6, 4, 0xd8b04a); P.px(X0(REG.x1 + 20), Y0(CNT.top - 6), 0x6ab04a);
  outline(P, 0x1a1014);
  return { img: P.flush(), ox, oy };
}
// golvet: breda plankor (en del utbytta), slitet där folk går, en flätad matta vid dörren
function paintFloor(P, night) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor((y - WALL_Y) / 9), off = (row * 37) % 60, b = Math.floor((x + off) / 60), u = (y - WALL_Y) % 9;
    const k = hash(b, row, 30);
    let c = mul(k > 0.9 ? PLANK.hi : PLANK.base, 0.92 + k * 0.1);
    if (u === 0) c = PLANK.dk; else if (u === 1) c = mix(c, WHITE, 0.08); else if (u === 8) c = mul(c, 0.86);
    if ((x + off) % 60 === 0) c = PLANK.dk;                                                // plankskarven
    if (((x + off) % 60 === 3 || (x + off) % 60 === 56) && u === 4) c = 0x4a3420;           // spikarna
    if (hash(x >> 2, y, 31) > 0.985) c = mul(c, 0.85);
    if (y < WALL_Y + 4) c = mul(c, 0.74 + (y - WALL_Y) * 0.06);
    const pu = clamp((x - DOOR_SPOT[0]) / (PAY_X - DOOR_SPOT[0]), 0, 1), py = DOOR_SPOT[1] + 8 + pu * (ORDER_Y - DOOR_SPOT[1] - 8);
    if (x > DOOR_SPOT[0] - 12 && x < PAY_X + 20 && Math.abs(y - py) < 9 && bayer(x, y) < 0.55) c = mix(c, 0xe0c8a0, 0.16);   // slitet
    P.px(x, y, jit(c, x, y, 32, 0.03));
  }
  // den flätade trasmattan vid dörren
  for (let j = 0; j < 10; j++) for (let i = -18; i <= 18; i++) {
    if ((i / 18.5) ** 2 + ((j - 4.5) / 5) ** 2 > 1) continue;
    const ring = Math.floor(Math.hypot(i / 3.6, j - 4.5) * 1.2) % 3;
    P.px(DOOR_SPOT[0] + i, WALL_Y + 2 + j, [0x3a6ab0, 0xe8e0c8, 0xc8402a][ring]);
  }
  if (!night) {
    // solen faller in genom fönstren (tre ljusa trapetser på golvet)
    for (const w of WINS) for (let j = 0; j < 22; j++) {
      const y = WALL_Y + 2 + j, sh = j * 0.7, a = 0.2 * (1 - j / 22) + 0.04;
      for (let x = Math.round(w.x0 + sh); x < Math.round(w.x1 + sh); x++) if (bayer(x, y) < 0.8 && Math.abs(x - (w.x0 + w.x1) / 2 - sh) > 1) P.px(x, y, 0xfff4d8, a);
    }
  }
  // skuggorna
  for (const T of TABLES) { P.ell(T.x, T.y, 16, 3, 0x1a1014, 0.35, 3); P.ell(T.x - 7, T.y - 6, 7, 2, 0x1a1014, 0.3, 2); P.ell(T.x + 8, T.y + 10, 7, 2, 0x1a1014, 0.3, 2); }
  for (const sx of STOOLS) P.ell(sx, STOOL_Y, 6, 1.8, 0x1a1014, 0.38, 2);
  P.ell(TUNNA.x, TUNNA.y, 9, 2.4, 0x1a1014, 0.4, 2);
  P.ell(ANKARE.x, ANKARE.y, 14, 2.4, 0x1a1014, 0.38, 2);
  P.ell(TINOR.x, TINOR.y, 14, 2.4, 0x1a1014, 0.4, 2);
  P.darken(AQUA.x0, AQUA.y, AQUA.x1 - AQUA.x0, 2, 0.62);
  P.darken(CNT.x0, CNT.y, CNT.x1 - CNT.x0, 2, 0.62); P.darken(CNT.x0, CNT.y + 2, CNT.x1 - CNT.x0, 1, 0.8);
  P.darken(0, WALL_Y, 8, 2, 0.7);
}
function paintSides(P) {
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, H, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WALL_Y + (5 - k) * 2) return null;
    return jit(Y < 9 ? TAR.lo : Y < 64 ? mul(PANEL.base, 0.62 + k * 0.04) : mul(NAVY.base, 0.6 + k * 0.04), X, Y, 33, 0.04);
  });
  P.box(0, 0, W, H, 0x0e0d12);
}
// akvariets skåp och ram (vattnet, hummern och bubblorna ritas levande)
function paintAquaFrame(P) {
  const { x0, x1, top, y } = AQUA;
  area(P, x0, top + 26, x1 - x0, y - top - 26, (X, Y, i, j) => (j === 0 ? PLANK.hi : i === 0 || i === x1 - x0 - 1 ? TAR.dk : jit(TAR.base, X, Y, 34, 0.05)));
  P.rect(x0 + 10, top + 34, 6, 2, BRASS.base);
  area(P, x0, top, x1 - x0, 26, (X, Y, i, j) => (i === 0 || i === x1 - x0 - 1 || j === 0 || j === 25 ? 0x2a2a30 : null));
  P.hl(x0, top - 1, x1 - x0, 0x4a4a52);
}
function paintBg(night) {
  const P = new Pix(W, H);
  paintWall(P);
  paintFloor(P, night);
  paintKitchen(P);
  paintAquaFrame(P);
  paintSides(P);
  return P.flush();
}
// fönsterspröjsen och karmarna ovanpå den levande utsikten (glaset får en reflex)
function paintWinOverlay(night) {
  const P = new Pix(W, H);
  for (const w of WINS) {
    const mx = (w.x0 + w.x1) >> 1, my = (WIN_T + WIN_B) >> 1;
    for (let y = WIN_T; y < WIN_B; y++) { P.px(mx, y, WHITE); P.px(mx + 1, y, PANEL.lo); }
    for (let x = w.x0; x < w.x1; x++) { P.px(x, my, WHITE); P.px(x, my + 1, PANEL.lo); }
    for (let j = 0; j < WIN_B - WIN_T; j++) for (let i = 0; i < w.x1 - w.x0; i++) {
      const s = ((((w.x0 + i) * 2 - (WIN_T + j) * 3) % 56) + 56) % 56;
      const a = s < 3 ? 0.18 : s === 9 ? 0.07 : 0;
      if (a) P.px(w.x0 + i, WIN_T + j, night ? 0xffd8a0 : 0xf2f8ff, a * (night ? 0.4 : 1));
    }
    // en krukväxt (pelargon) i mittenfönstret och en flaska med skepp i det högra
    if (w === WINS[1]) { P.rect(mx - 4, WIN_B - 6, 9, 6, 0xb8602a); P.hl(mx - 4, WIN_B - 6, 9, 0xd8804a); for (const [dx, dy] of [[-3, -9], [0, -11], [3, -8], [-1, -7], [2, -12]]) { P.px(mx + dx, WIN_B + dy, 0xe8304a); P.px(mx + dx + 1, WIN_B + dy, 0xf85a6a); } for (let k = -4; k <= 4; k += 2) P.px(mx + k, WIN_B - 7, 0x3a8a3a); }
    if (w === WINS[2]) { for (let i = 0; i < 18; i++) for (let j = 0; j < 7; j++) if ((i / 9 - 1) ** 2 + ((j - 3) / 3.5) ** 2 <= 1) P.px(mx - 9 + i, WIN_B - 8 + j, j === 0 ? 0xe8fff8 : 0x9ad8c8, 0.75); P.vl(mx - 2, WIN_B - 7, 4, PLANK.lo); P.hl(mx - 5, WIN_B - 3, 7, TAR.base); P.px(mx - 1, WIN_B - 6, WHITE); P.px(mx - 3, WIN_B - 5, WHITE); P.rect(mx + 9, WIN_B - 5, 2, 2, PLANK.base); }
  }
  return P.flush();
}
// Kvällens ljuskarta: skeppslyktornas varma pölar (läggs på med 'lighter')
function paintNightLight() {
  const P = new Pix(W, H);
  const AMB = 0xffb870;
  for (const L of LYKTOR) { P.ell(L.x + 0.5, 20 + L.len, 40, 30, AMB, 0.22, 5); P.ell(L.x + 0.5, 150, 42, 16, AMB, 0.12, 3); P.ell(L.x + 0.5, 20 + L.len, 6, 6, 0xffffff, 0.5, 3); }
  P.ell(340, 104, 110, 22, AMB, 0.16, 4);                                                   // disken
  P.ell((MENU.x0 + MENU.x1) / 2, 26, 64, 24, 0xfff0c0, 0.16, 4);
  P.ell((AQUA.x0 + AQUA.x1) / 2, AQUA.top + 14, 18, 18, 0x6ad0ff, 0.26, 4);               // akvariet
  P.ell(POT.x0 + 14, POT.top + 10, 18, 12, 0xff7a2a, 0.2, 3);                              // spisen
  return P.flush();
}
// Trädörren med det runda skeppsfönstret (gångjärn till vänster), i bildrutor där den svänger in
function paintDoorFrames(N = 6) {
  const w = DOOR.x1 - DOOR.x0, h = WALL_Y - DOOR.top;
  const S = new Pix(w, h);
  area(S, 0, 0, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e === 0) return TAR.dk;
    const plank = i % 7 === 0 ? TAR.lo : i % 7 === 1 ? NAVY.hi : NAVY.base;
    return jit(plank, X, Y, 35, 0.04);
  });
  for (const y of [8, h - 12]) { S.hl(1, y, w - 2, NAVY.dk); S.hl(1, y + 1, w - 2, NAVY.hi); }   // tvärslåarna
  const cx = (w >> 1), cy = 18;
  for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) { const r = Math.hypot(i, j); if (r <= 7.4) S.px(cx + i, cy + j, r > 5.6 ? (i + j < 0 ? BRASS.hi : BRASS.lo) : 0x8ac8e0); }   // skeppsfönstret
  S.px(cx - 2, cy - 2, WHITE); S.px(cx - 1, cy - 3, WHITE, 0.7);
  for (const [px, py] of [[cx, cy - 6], [cx + 6, cy], [cx, cy + 6], [cx - 6, cy]]) S.px(px, py, BRASS.dk);   // nitarna
  S.rect(w - 6, 34, 3, 6, BRASS.base); S.px(w - 6, 34, BRASS.hi);                          // handtaget
  S.rect(5, 26, w - 10, 6, 0xf4f0e2); S.rect(6, 27, w - 12, 4, 0xe8e0c8);                  // ÖPPET-skylten
  const om = textMask(SMALL, 'ÖPPET');
  drawText(S, om, ((w - om.w) >> 1), 28, { fill: 0x2a5a9a });
  const frames = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.25, pw = Math.max(3, Math.round(w * Math.cos(th))), shade = 1 - 0.35 * Math.sin(th);
    const F = new Pix(w, h + 6);
    for (let c = 0; c < pw; c++) {
      const sc = Math.min(w - 1, Math.floor((c * w) / pw));
      const drop = Math.round((c / Math.max(1, pw - 1)) * Math.sin(th) * 5);
      for (let y = 0; y < h; y++) {
        const i = (y * w + sc) * 4, a = S.d[i + 3];
        if (!a) continue;
        F.px(c, y + drop, mul((S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2], shade), a / 255);
      }
    }
    frames.push(F.flush());
  }
  return frames;
}
// ======================= möblerna (egna bilder, ritas i djupordning) =======================
// barstolen vid fönstret: rund träsits med repkant på tre ben
function paintStool() {
  const P = new Pix(14, 17);
  for (let x = 1; x < 13; x++) { P.px(x, 0, x < 4 ? PLANK.hi : PLANK.base); P.px(x, 1, PLANK.lo); P.px(x, 2, x % 2 ? ROPE.base : ROPE.lo); }
  P.line(3, 3, 1, 15, TAR.base); P.line(10, 3, 12, 15, TAR.lo); P.line(6, 3, 6, 15, TAR.lo); P.line(7, 3, 7, 15, TAR.dk);
  P.hl(2, 10, 10, TAR.hi);                                                                   // fotpinnen
  outline(P);
  return P.flush();
}
// bordet: trä med blårutig duk som hänger ner och ett ljus i en flaska (lågan ritas levande)
function paintTable() {
  const P = new Pix(30, 22);
  area(P, 1, 2, 28, 6, (X, Y, i, j) => {
    const chk = (((i >> 1) + (j >> 1)) & 1) ? CLOTH[1] : CLOTH[0];
    return j === 0 ? mix(chk, WHITE, 0.25) : j >= 4 ? mul(chk, 0.85) : chk;
  });
  for (let i = 1; i < 29; i += 2) P.px(i, 8, ((i >> 1) & 1) ? CLOTH[1] : CLOTH[0]);             // dukens fransar
  P.rect(13, 9, 4, 8, TAR.base); P.vl(13, 9, 8, TAR.hi); P.rect(9, 17, 12, 2, TAR.lo); P.hl(9, 17, 12, TAR.base);   // pelarfoten
  P.rect(14, 0, 2, 3, 0x2a6a3a); P.px(14, 0, 0x5aa06a); P.px(15, 0, 0xf4f0e2);                // flaskan med ljuset
  outline(P);
  return P.flush();
}
// blåmålad trästol med spjälor: 'down' = framifrån, 'up' = bakifrån (ryggen ritas framför den som sitter)
function paintChair(dir) {
  const back = (T, top, rear) => {
    for (let j = 0; j < 10; j++) {
      T.px(2, top + j, rear ? NAVY.lo : NAVY.hi); T.px(13, top + j, rear ? NAVY.dk : NAVY.lo);
      if (j === 0 || j === 4 || j === 7) for (let i = 3; i < 13; i++) T.px(i, top + j, j === 0 ? (rear ? NAVY.base : NAVY.hi) : rear ? NAVY.lo : NAVY.base);
    }
    T.px(2, top - 1, NAVY.hi); T.px(13, top - 1, NAVY.base);
  };
  const P = new Pix(16, 24);
  if (dir === 'down') back(P, 1, false);
  for (let x = 1; x < 15; x++) { P.px(x, 11, x < 4 ? NAVY.hi : mix(NAVY.base, WHITE, 0.15)); P.px(x, 12, NAVY.base); P.px(x, 13, NAVY.lo); }
  P.line(2, 14, 1, 23, NAVY.lo); P.line(13, 14, 14, 23, NAVY.dk);
  P.line(4, 14, 4, 21, NAVY.base); P.line(11, 14, 11, 21, NAVY.lo);
  outline(P);
  if (dir === 'down') return { img: P.flush() };
  const R = new Pix(16, 24);
  back(R, 1, true);
  outline(R);
  return { img: P.flush(), front: R.flush() };
}
// tunnan vid dörren (katten ritas levande ovanpå)
function paintTunna() {
  const P = new Pix(18, 22);
  for (let j = 0; j < 20; j++) {
    const bulge = Math.round(Math.sin((j / 19) * Math.PI) * 2), hw = 6 + bulge;
    for (let i = -hw; i <= hw; i++) {
      let c = i < -hw + 2 ? TAR.hi : i > hw - 2 ? TAR.lo : (i + 20) % 4 === 0 ? TAR.lo : TAR.base;
      if (j === 3 || j === 4 || j === 15 || j === 16) c = j === 3 || j === 15 ? 0x6a6e76 : 0x3a3e46;   // järnbanden
      P.px(9 + i, 1 + j, c);
    }
  }
  for (let i = -5; i <= 5; i++) { P.px(9 + i, 0, TAR.hi); P.px(9 + i, 1, mix(TAR.base, WHITE, 0.15)); }   // locket
  outline(P);
  return { img: P.flush(), ox: 9, oy: 21 };
}
// ankaret lutat mot väggen i hörnet, med ett hoprullat rep framför
function paintAnkare() {
  const P = new Pix(30, 34);
  const Ir = [0x2a2e34, 0x4a4e56, 0x6a707a];
  P.vl(13, 4, 24, Ir[1]); P.vl(14, 4, 24, Ir[0]); P.vl(12, 6, 20, Ir[2]);                     // läggen
  P.hl(7, 8, 15, Ir[1]); P.hl(7, 9, 15, Ir[0]); P.px(6, 8, Ir[2]); P.px(22, 8, Ir[2]);           // stocken
  for (let a = 0; a < 10; a++) { const an = a / 9 * Math.PI; P.px(Math.round(13.5 - Math.cos(an) * 10), Math.round(26 + Math.sin(an) * 4), Ir[1]); P.px(Math.round(13.5 - Math.cos(an) * 10), Math.round(27 + Math.sin(an) * 4), Ir[0]); }   // armarna
  for (const x of [3, 24]) { P.rect(x, 22, 3, 3, Ir[1]); P.px(x + 1, 21, Ir[2]); }             // flyerna
  P.ell(13.5, 2.5, 2.5, 2.5, Ir[1], 1, 1); P.px(13, 2, 0x1a1a1e);                              // ringen
  P.ell(7, 30, 6, 2.6, ROPE.base, 1, 1); P.ell(7, 30, 4, 1.6, ROPE.lo, 1, 1); P.ell(7, 30, 1.6, 0.7, 0x6a5a40, 1, 1);
  for (let x = 2; x <= 12; x += 2) P.px(x, 29, ROPE.hi);
  outline(P);
  return { img: P.flush(), ox: 15, oy: 33 };
}
// hummertinor på hög: trästomme, nät, en boj på toppen
function paintTinor() {
  const P = new Pix(30, 26);
  const tina = (x, y) => {
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) {
      const e = i === 0 || i === 11 || j === 7;
      P.px(x + i, y + j, e ? TAR.base : j === 0 ? TAR.hi : (i + j) % 3 === 0 ? 0x4a5a3a : null);
    }
    for (let i = 1; i < 11; i++) if (Math.abs(i - 5.5) < 5) P.px(x + i, y - 1 - (Math.abs(i - 5.5) < 3 ? 1 : 0), TAR.hi);   // den välvda överdelen
  };
  tina(2, 17); tina(15, 17); tina(8, 8);
  P.ell(15, 4, 3, 3, 0xe8443a, 1, 1); P.px(14, 3, 0xff8a7a); P.vl(15, 7, 2, ROPE.base);           // bojen
  outline(P);
  return { img: P.flush(), ox: 15, oy: 25 };
}

// ======================= kocken Maja =======================
const MAJA = { skin: '#f0c8a0', hair: '#c8803a', style: 'bun', beard: false, top: 'stripes', shirt: '#f4f1ea', accent: '#2a4a8a', bottom: 'pants', pants: '#2b3a5a', shoes: '#3a2a1e', glasses: false, phones: false, bag: null, hat: null, apron: true, build: 5, kid: false };
const COOK_NAME = 'Maja';

// ======================= det levande (utsikten, akvariet, katten, lyktorna) =======================
// utsikten genom fönstren: himlen efter klockan, havet med glitter, fyren på skäret (blinkar på
// kvällen), en segelbåt som glider förbi, måsar och ibland en fisk som hoppar
function skyAt(hour) {
  if (hour >= 7.5 && hour < 17) return [0x8ac8f0, 0xc8e8f8, 0x3a8ac0, 0x5aa8d8];
  if (hour >= 17 && hour < 20.5) { const k = clamp((hour - 17) / 3.5, 0, 1); return [mix(0x8ac8f0, 0x5a4a8a, k), mix(0xc8e8f8, 0xf8a060, k), mix(0x3a8ac0, 0x2a3a6a, k), mix(0x5aa8d8, 0xd88a5a, k)]; }
  if (hour >= 5.5 && hour < 7.5) { const k = clamp((hour - 5.5) / 2, 0, 1); return [mix(0x1a2048, 0x8ac8f0, k), mix(0x3a3a6a, 0xf8c8a0, 1 - Math.abs(k - 0.5) * 2), mix(0x0e1a34, 0x3a8ac0, k), mix(0x1a2a4a, 0x5aa8d8, k)]; }
  return [0x0e1430, 0x1a2048, 0x0a1428, 0x162a48];
}
function drawView(ctx, t, hour, sea) {
  const [skyT, skyB, seaD, seaL] = skyAt(hour), night = isNight(hour);
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  for (const w of WINS) {
    for (let y = WIN_T; y < HORIZON; y++) { ctx.fillStyle = hex(mix(skyT, skyB, (y - WIN_T) / (HORIZON - WIN_T))); ctx.fillRect(w.x0, y, w.x1 - w.x0, 1); }
    for (let y = HORIZON; y < WIN_B; y++) { ctx.fillStyle = hex(mix(seaL, seaD, (y - HORIZON) / (WIN_B - HORIZON))); ctx.fillRect(w.x0, y, w.x1 - w.x0, 1); }
  }
  // stjärnor och månen på kvällen, moln på dagen
  if (night) {
    ctx.fillStyle = '#f4f0d8';
    for (let k = 0; k < 18; k++) { const x = 14 + ((k * 37) % 160), y = WIN_T + 2 + ((k * 13) % 16); if (WINS.some((w) => x >= w.x0 && x < w.x1) && Math.sin(t * 2 + k) > -0.6) ctx.fillRect(x, y, 1, 1); }
    ctx.fillStyle = '#f8f0c8'; ctx.fillRect(40, WIN_T + 5, 4, 4); ctx.fillStyle = '#0e1430'; ctx.fillRect(42, WIN_T + 4, 3, 3);   // en månskära
    for (let y = HORIZON + 2; y < WIN_B; y += 2) { ctx.fillStyle = `rgba(248,240,200,${(0.5 - (y - HORIZON) / 50).toFixed(2)})`; ctx.fillRect(41 + Math.round(Math.sin(t * 2 + y) * 1.5), y, 3, 1); }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x0, y, w] of [[10, WIN_T + 5, 18], [96, WIN_T + 9, 14], [150, WIN_T + 4, 12]]) { const x = ((x0 + t * 1.5) % 200) - 10; ctx.fillRect(Math.round(x), y, w, 2); ctx.fillRect(Math.round(x) + 3, y - 2, w - 7, 2); }
  }
  // den bortre stranden och fyren på skäret (i det högra fönstret)
  ctx.fillStyle = night ? '#0a1424' : hex(mix(seaD, 0x3a5a4a, 0.6)); ctx.fillRect(14, HORIZON - 2, 50, 2); ctx.fillRect(20, HORIZON - 3, 22, 1);
  const fx = 158;
  ctx.fillStyle = night ? '#1a1e28' : '#5a5a50'; ctx.fillRect(fx - 6, HORIZON - 2, 13, 3);
  ctx.fillStyle = night ? '#4a2a2a' : '#d8302a'; ctx.fillRect(fx - 1, HORIZON - 12, 3, 10);
  ctx.fillStyle = night ? '#5a5a5a' : '#f4f0e6'; ctx.fillRect(fx - 1, HORIZON - 9, 3, 2); ctx.fillRect(fx - 1, HORIZON - 5, 3, 2);
  ctx.fillStyle = night ? '#2a2a2a' : '#3a3a40'; ctx.fillRect(fx - 2, HORIZON - 14, 5, 2);
  const blink = night ? (t % 4 < 0.6 ? 1 : 0.25) : 0.15;
  ctx.fillStyle = `rgba(255,240,160,${blink})`; ctx.fillRect(fx - 1, HORIZON - 13, 3, 1);
  if (night && t % 4 < 0.6) { ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.fillRect(fx - 14, HORIZON - 13, 30, 1); ctx.fillRect(fx - 8, HORIZON - 14, 18, 3); }
  // glittret och vågorna på havet
  for (let k = 0; k < 40; k++) {
    const x = 14 + ((k * 23 + Math.floor(t * 6) * (k % 3 === 0 ? 1 : 0)) % 160), y = HORIZON + 2 + ((k * 7) % (WIN_B - HORIZON - 3));
    if (!WINS.some((w) => x >= w.x0 && x < w.x1)) continue;
    const on = Math.sin(t * 3 + k * 1.7) > 0.3;
    ctx.fillStyle = on ? (night ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.75)') : (night ? 'rgba(40,70,110,0.5)' : 'rgba(140,200,240,0.55)');
    ctx.fillRect(x, y, on ? 2 : 3, 1);
  }
  // segelbåten glider förbi (en gång per halvminut)
  const bx = ((t * 6) % 260) - 40, by = HORIZON + 6;
  if (bx > 0 && bx < 190) {
    ctx.fillStyle = night ? '#3a3a4a' : '#f4f0e6'; ctx.fillRect(Math.round(bx), by - 10, 1, 9);
    for (let j = 0; j < 8; j++) ctx.fillRect(Math.round(bx) + 1, by - 9 + j, Math.round(j * 0.7), 1);
    for (let j = 0; j < 6; j++) ctx.fillRect(Math.round(bx) - Math.round(j * 0.6) - 1, by - 7 + j, Math.round(j * 0.6), 1);
    ctx.fillStyle = night ? '#1a1a24' : '#8a3a2a'; ctx.fillRect(Math.round(bx) - 5, by - 1, 11, 2); ctx.fillRect(Math.round(bx) - 3, by + 1, 7, 1);
    if (night) { ctx.fillStyle = '#ffe0a0'; ctx.fillRect(Math.round(bx), by - 11, 1, 1); }
  }
  // måsarna (två V som seglar)
  if (!night) { ctx.fillStyle = '#3a3a40'; for (let k = 0; k < 2; k++) { const x = Math.round(((t * (9 + k * 4) + k * 90) % 200) - 10), y = WIN_T + 8 + k * 6 + Math.round(Math.sin(t * 2 + k) * 2), f = Math.floor(t * 5 + k) % 2; ctx.fillRect(x - 2, y - f, 2, 1); ctx.fillRect(x + 1, y - f, 2, 1); ctx.fillRect(x, y, 1, 1); } }
  // en fisk som hoppar (sea.jump = 0–1 när den är i luften)
  if (sea.jump >= 0 && sea.jump <= 1) {
    const u = sea.jump, x = sea.jx + u * 10, y = sea.jy - Math.sin(Math.PI * u) * 6;
    ctx.fillStyle = '#c8d8e8'; ctx.fillRect(Math.round(x), Math.round(y), 3, 1); ctx.fillStyle = '#6a7a90'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - (u < 0.5 ? 1 : -1), 1, 1);
    if (u < 0.2 || u > 0.8) { ctx.fillStyle = 'rgba(230,248,255,0.8)'; ctx.fillRect(Math.round(u < 0.5 ? sea.jx : sea.jx + 10) - 2, sea.jy, 5, 1); }
  }
  // kvällen: fönstren mörknar lite mot rummet
  if (!night && darkness(hour) > 0) { ctx.fillStyle = `rgba(14,16,44,${(darkness(hour) * 0.6).toFixed(2)})`; for (const w of WINS) ctx.fillRect(w.x0, WIN_T, w.x1 - w.x0, WIN_B - WIN_T); }
}
// akvariet: vattnet, tången, två småfiskar, hummern Harald som promenerar och bubblorna
function drawAqua(ctx, t, aq) {
  const { x0, x1, top } = AQUA;
  ctx.fillStyle = '#2a7a9a'; ctx.fillRect(x0 + 1, top + 3, x1 - x0 - 2, 22);
  ctx.fillStyle = '#4a9aba'; ctx.fillRect(x0 + 1, top + 3, x1 - x0 - 2, 2);
  ctx.fillStyle = '#d8c890'; ctx.fillRect(x0 + 1, top + 22, x1 - x0 - 2, 3);                       // sanden
  ctx.fillStyle = '#8a8a80'; ctx.fillRect(x0 + 18, top + 19, 5, 3); ctx.fillRect(x0 + 4, top + 20, 4, 2);   // stenar
  for (const [x, h] of [[x0 + 6, 9], [x0 + 21, 12]]) for (let j = 0; j < h; j++) { ctx.fillStyle = j % 2 ? '#3a9a4a' : '#2a7a3a'; ctx.fillRect(x + Math.round(Math.sin(t * 2 + j * 0.6) * 1), top + 21 - j, 1, 1); }   // tången svajar
  // småfiskarna
  for (let k = 0; k < 2; k++) {
    const u = (t * (0.11 + k * 0.05) + k * 0.4) % 2, dir = u < 1 ? 1 : -1, fx = x0 + 3 + (u < 1 ? u : 2 - u) * (x1 - x0 - 8), fy = top + 8 + k * 6 + Math.round(Math.sin(t * 2 + k) * 1);
    ctx.fillStyle = k ? '#f8a040' : '#f4e040'; ctx.fillRect(Math.round(fx), fy, 3, 2); ctx.fillStyle = k ? '#d87020' : '#d8c020'; ctx.fillRect(Math.round(fx) + (dir > 0 ? -1 : 3), fy, 1, 2);   // stjärten
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(Math.round(fx) + (dir > 0 ? 2 : 0), fy, 1, 1);
  }
  // hummern Harald: går fram och tillbaka på botten och viftar med klorna
  const hx = Math.round(aq.hx), hy = top + 21, d = aq.hd, claw = Math.floor(t * 3) % 2;
  ctx.fillStyle = '#2a3a6a'; ctx.fillRect(hx - 3, hy - 2, 7, 2); ctx.fillRect(d > 0 ? hx - 5 : hx + 4, hy - 1, 2, 1);   // stjärtfenan
  ctx.fillStyle = '#3a4a8a'; ctx.fillRect(hx - 2, hy - 3, 4, 1);
  ctx.fillRect(hx + d * 4 - (d < 0 ? 1 : 0), hy - 3 - claw, 2, 2); ctx.fillRect(hx + d * 4 - (d < 0 ? 1 : 0), hy - claw, 2, 1);   // klorna
  ctx.fillStyle = '#1a1a1a'; for (let k = 0; k < 3; k++) ctx.fillRect(hx - 2 + k * 2, hy, 1, 1);    // benen
  ctx.fillStyle = '#c8302a'; ctx.fillRect(hx + d * 3, hy - 4, 1, 1);                                  // antennens spets
  // bubblorna från pumpen
  for (let k = 0; k < 5; k++) { const p = (t * 0.6 + k / 5) % 1; ctx.fillStyle = 'rgba(220,248,255,0.85)'; ctx.fillRect(x1 - 5 + Math.round(Math.sin(t * 4 + k) * 1), Math.round(top + 21 - p * 18), 1, 1); }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x0 + 2, top + 4, 2, 18);                   // glasets reflex
}
// skeppskatten Sill sover på tunnan: andas, viftar ibland på svansen, vaknar och tittar upp när man klappar
function drawCat(ctx, t, cat) {
  const x = TUNNA.x, y = TUNNA.y - 21, br = Math.round(Math.sin(t * 2) * 0.6 + 0.4), awake = cat.awake > 0;
  const O = '#e8a050', D = '#c87a30', L = '#fff0d8';
  ctx.fillStyle = O; ctx.fillRect(x - 6, y - 4 - br, 11, 4 + br);                                    // kroppen (andas)
  ctx.fillStyle = D; for (let k = 0; k < 3; k++) ctx.fillRect(x - 4 + k * 3, y - 4 - br, 1, 3);     // ränderna
  ctx.fillStyle = L; ctx.fillRect(x - 5, y - 1, 9, 1);
  const hy = awake ? y - 7 : y - 4;
  ctx.fillStyle = O; ctx.fillRect(x + 3, hy, 5, 4); ctx.fillRect(x + 3, hy - 1, 1, 1); ctx.fillRect(x + 7, hy - 1, 1, 1);   // huvudet och öronen
  ctx.fillStyle = '#1a1a1a';
  if (awake) { ctx.fillRect(x + 4, hy + 1, 1, 1); ctx.fillRect(x + 6, hy + 1, 1, 1); } else { ctx.fillRect(x + 4, hy + 2, 1, 1); ctx.fillRect(x + 6, hy + 2, 1, 1); }
  ctx.fillStyle = '#f08080'; ctx.fillRect(x + 5, hy + 2 + (awake ? 0 : 1), 1, 1);
  const wag = cat.tail > 0 ? Math.round(Math.sin(t * 10) * 2) : 0;                                   // svansen hänger ner över kanten
  ctx.fillStyle = O; ctx.fillRect(x - 7, y - 2, 1, 6); ctx.fillRect(x - 8 + (wag > 0 ? 1 : 0) - (wag < 0 ? 1 : 0), y + 4, 1, 3);
  ctx.fillStyle = D; ctx.fillRect(x - 8 + (wag > 0 ? 1 : 0) - (wag < 0 ? 1 : 0), y + 7, 1, 1);
  if (!awake && Math.floor(t * 0.8) % 3 === 0) { ctx.fillStyle = 'rgba(240,240,255,0.8)'; ctxText(ctx, SMALL, 'z', x + 9, y - 10 - Math.round((t * 4) % 3), '#e8ecf4'); }
}
// skeppslyktorna i taket: kedja, mässingshuv och glas med en låga som fladdrar
function drawLanterns(ctx, t, lit) {
  for (const L of LYKTOR) {
    const x = L.x, y = 9 + L.len, sw = Math.round(Math.sin(t * 0.8 + x) * 0.6);
    ctx.fillStyle = '#4a4a52'; for (let j = 9; j < y; j += 2) ctx.fillRect(x + (j > y - 6 ? sw : 0), j, 1, 1);
    ctx.fillStyle = '#a07a28'; ctx.fillRect(x - 3 + sw, y, 7, 2); ctx.fillStyle = '#d8b04a'; ctx.fillRect(x - 2 + sw, y - 1, 5, 1);
    ctx.fillStyle = lit ? '#fff0b0' : '#c8d8e0'; ctx.fillRect(x - 2 + sw, y + 2, 5, 6);
    ctx.fillStyle = '#6a4e18'; ctx.fillRect(x - 3 + sw, y + 2, 1, 6); ctx.fillRect(x + 3 + sw, y + 2, 1, 6); ctx.fillRect(x - 3 + sw, y + 8, 7, 2);
    if (lit) { const f = Math.sin(t * 11 + x) > 0; ctx.fillStyle = '#ffb030'; ctx.fillRect(x + sw, y + 4 + (f ? 0 : 1), 1, f ? 3 : 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + sw, y + 6, 1, 1); }
    else { ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x + sw, y + 5, 1, 3); }
  }
}
// ljusen på borden (lågan i flaskhalsen)
function drawCandles(ctx, t, lit) {
  if (!lit) return;
  for (const T of TABLES) { const f = Math.sin(t * 13 + T.x) > 0.2; ctx.fillStyle = '#ffb030'; ctx.fillRect(T.x, T.y - 22 - (f ? 1 : 0), 1, f ? 2 : 1); ctx.fillStyle = 'rgba(255,200,120,0.25)'; ctx.fillRect(T.x - 3, T.y - 25, 7, 6); }
}

// Bilderna som inte beror på scenen målas en gång per modul (dag/kväll var för sig)
const IMG = {};
const img = (k, fn) => (IMG[k] ||= fn());
const LINES = [
  'Bästa fisksoppan i stan!', 'Räkorna är färska i dag.', 'Titta, fyren blinkar!', 'Jag såg en delfin från piren en gång!',
  'Maja steker den bästa fisken.', 'Hjortronglassen ... oj oj.', 'Här luktar det hav.', 'Måsarna snor pommes om man inte ser upp!',
  'Har du hälsat på Harald i akvariet?', 'Katten Sill sover alltid.', 'Vilken utsikt!', 'Sill och färskpotatis – som midsommar.',
];
// ======================= scenen =======================
export function makeShopSjoboden(A) {
  const g = A.game;
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, pendingHello = 0, alive = true;
  const talkMe = createSpeech(), talkCook = createSpeech();

  // ---------- sittplatser ----------
  // barstolarna vid fönstren sitter man på med ryggen mot oss och tittar ut över havet (maten står
  // på fönsterbänken); borden har en stol bakom (vänd mot oss) och en framför (ryggen mot oss)
  const seats = [];
  STOOLS.forEach((x, k) => seats.push({ id: 'pall' + k, x, y: STOOL_Y, dir: 'up', kind: 'pall', occ: null, front: false, lift: 12 }));
  for (const T of TABLES) {
    seats.push({ id: T.id + 'a', x: T.x - 7, y: T.y - 6, dir: 'down', kind: 'bord', table: T, occ: null, front: false, lift: 0 });
    seats.push({ id: T.id + 'b', x: T.x + 8, y: T.y + 10, dir: 'up', kind: 'bord', table: T, occ: null, front: true, lift: 0 });
  }
  const seatById = (id) => seats.find((s) => s.id === id);

  // ---------- hinder ----------
  const obstacles = [
    [CNT.x0 - 1, WALL_Y, CNT.x1 + 1, CNT.y + 1],
    [AQUA.x0 - 1, WALL_Y, AQUA.x1 + 1, AQUA.y + 1],
    [TUNNA.x - 8, TUNNA.y - 5, TUNNA.x + 8, TUNNA.y + 1],
    [ANKARE.x - 14, ANKARE.y - 6, ANKARE.x + 12, ANKARE.y + 1],
    [TINOR.x - 14, TINOR.y - 7, TINOR.x + 14, TINOR.y + 1],
  ];
  for (const sx of STOOLS) obstacles.push([sx - 5, STOOL_Y - 3, sx + 5, STOOL_Y + 1]);
  for (const T of TABLES) obstacles.push([T.x - 15, T.y - 10, T.x + 15, T.y + 1]);
  const walker = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: [DOOR_SPOT[0], DOOR_SPOT[1] + 6] });
  walker.setObstacles(obstacles);
  walker.snapFree();
  const cams = () => lockedCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  const cam = { x: cams(), y: 0 };
  const camY = () => Math.round(cam.y);
  function safeBox() {
    const s = A.view?.safe;
    return {
      x0: clamp(s?.x0 | 0, 0, VW >> 1), x1: clamp(s?.x1 ? s.x1 | 0 : VW, VW >> 1, VW),
      y0: clamp(s?.y0 | 0, 0, H >> 1), y1: clamp(s?.y1 ? s.y1 | 0 : H, H >> 1, H),
    };
  }
  for (const s of seats) {
    const T = s.table;
    const cands = s.kind === 'pall' ? [[s.x, s.y + 8], [s.x + 10, s.y + 6]]
      : [[s.x + 20, s.y], [s.x - 20, s.y], [s.x + 18, s.y + 4], [s.x - 18, s.y + 4], [T.x, T.y + 14]];
    [s.ax, s.ay] = cands.find(([x, y]) => walker.walkable(x, y)) || walker.nearestFree(...cands[0]);
  }
  const freeSeats = () => seats.filter((s) => !s.occ);

  // ---------- bilder ----------
  const nightNow = () => isNight(g.min / 60);
  const bg = () => img('bg' + nightNow(), () => paintBg(nightNow()));
  const winOv = () => img('win' + nightNow(), () => paintWinOverlay(nightNow()));
  const nightLight = () => img('light', paintNightLight);
  const doorFr = img('door', () => paintDoorFrames());
  const counter = img('counter', paintCounter);
  const stoolImg = img('pall', paintStool);
  const tableImg = img('bord', paintTable);
  const chairDown = img('stol0', () => paintChair('down')), chairUp = img('stol1', () => paintChair('up'));
  const tunnaImg = img('tunna', paintTunna), ankareImg = img('ankare', paintAnkare), tinorImg = img('tinor', paintTinor);

  // ---------- kocken Maja ----------
  const cook = { x: PAY_X - 8, y: COOK_FRONT, tx: PAY_X - 8, ty: COOK_FRONT, dir: 'down', walking: false, phase: 'idle', t: 0, idleT: 2, job: null, steps: [], si: 0, act: null, face: 'down' };
  const jobs = [], trays = [];
  const cookAt = () => ({ x: cook.x, y: cook.y - 44 });

  // ---------- ånga, havet, akvariet, katten ----------
  const parts = [];
  const puff = (x, y) => parts.push({ x: x + (Math.random() - 0.5) * 2, y, vx: (Math.random() - 0.5) * 3, vy: -6 - Math.random() * 4, age: 0, max: 1 + Math.random() * 0.8 });
  const sea = { jump: -1, jx: 0, jy: 0, next: 4 };
  const aq = { hx: AQUA.x0 + 9, hd: 1, wait: 2 };
  const cat = { awake: 0, tail: 0, next: 5 };

  // ---------- gästerna ----------
  const rng = rngOf((g.day | 0) * 7919 + 77);
  const guests = [];
  const lookOf = () => { const L = makeLook(rng); L.bag = null; return L; };
  const newOrder = () => {
    const mains = ['fishchips', 'fishchips', 'raksmorgas', 'fisksoppa', 'sill'];
    const list = normOrder([mains[(rng() * mains.length) | 0], ...(rng() < 0.35 ? ['hjortron'] : []), ...(rng() < 0.55 ? ['soda'] : [])]);
    return list.map((m) => ({ id: m.id, stage: 0, bites: m.bites }));
  };
  const sitNPC = (seat) => {
    if (!seat || seat.occ) return null;
    const G = { look: lookOf(), seat, state: 'sit', items: newOrder(), sitT: rng() * 8, stay: 1e9, eatT: rng() * 3, eating: 0, biteT: 1 + rng() * 3, bubble: null, fixed: true, slide: null };
    G.items.forEach((it) => { it.stage = Math.min(it.bites - 1, (rng() * it.bites) | 0); });
    seat.occ = G; guests.push(G); return G;
  };
  for (const id of ['pall0', 't1a', 't2b', 't3a']) if (rng() < 0.6) sitNPC(seatById(id));
  const mkWalker = () => { const w = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: DOOR_SPOT }); w.setObstacles(obstacles); w.speed = 36; return w; };
  const queue = [];
  for (let k = 0; k < 3; k++) guests.push({ look: lookOf(), seat: null, state: 'away', t: 3 + k * 12 + rng() * 5, w: mkWalker(), items: null, sitT: 0, stay: 0, eatT: 0, eating: 0, biteT: 0, bubble: null, fixed: false, slide: null, ordered: false });

  // ---------- figuren (jag) ----------
  const me = { state: 'free', seat: null, res: null, tray: null, order: null, biteT: 0, sitT: 0, eating: 0, slide: null, waitMsgT: -9, doneT: -9, hintGiven: false, got: { fill: 0, energy: 0, glad: 0 } };
  const leftovers = [];
  const meAt = () => ({ x: me.seat ? me.seat.x : walker.px, y: (me.seat ? me.seat.y - me.seat.lift : walker.py) - 44 });
  function camYGoal() {
    const { y0, y1 } = safeBox(), vh = y1 - y0;
    if (y0 === 0 && y1 === H) return 0;
    const fy = me.seat ? me.seat.y : walker.py;
    const k = clamp((fy - 124) / 24, 0, 1), pull = k * k * (3 - 2 * k);
    const top = clamp(fy - vh * 0.55, 0, H - vh) * pull;
    return y0 - top;
  }
  function clampCamY() { const { y0, y1 } = safeBox(); cam.y = clamp(cam.y, y1 - H, y0); }
  let visTop = 0;
  function bubbleH(text, w, maxLines) {
    const lines = sayLines(text, w, maxLines);
    return lines.length ? lines.reduce((a, l) => a + (l.some((tk) => tk.emoji) ? 10 : 7), 0) + 4 : 0;
  }
  function bubbleY(text, y, w, maxLines) { const h = bubbleH(text, w, maxLines); return h ? Math.max(y, visTop + 2 + h + 4) : y; }
  function drawSpeech(ctx, sp, at, view) {
    const txt = sp.text();
    if (!txt) return;
    const y = at().y, dy = Math.ceil(bubbleY(txt, y, 124, 5) - y);
    if (dy) ctx.translate(0, dy);
    sp.draw(ctx, view);
    if (dy) ctx.translate(0, -dy);
  }
  function nag(text) { if (talkMe.text() === text) return; talkMe.say(text, meAt, 2.8); play('fel'); }
  function giveBite(it) {
    const f = it.fill / it.bites, e = it.energy / it.bites;
    g.hunger = c100(g.hunger + f); g.energy = c100(g.energy + e);
    me.got.fill += f; me.got.energy += e;
  }
  // lyckan när allt på brickan är uppätet (högst 8 om dagen från Sjöboden)
  function giveGlad(order) {
    const n = order.reduce((a, it) => a + (it.glad | 0), 0);
    const got = n ? (g.glad?.(n, 'Sjöboden', 'sjoboden', 8) || 0) : 0;
    me.got.glad += got;
    return got;
  }
  function settleOrder() {
    if (!me.order) return false;
    for (const it of me.order) {
      if (it.settled) continue;
      const left = Math.max(0, it.bites - it.stage);
      for (let k = 0; k < left; k++) giveBite(it);
      it.settled = true;
    }
    if (!me.order.gladGiven) { me.order.gladGiven = true; giveGlad(me.order); }
    return true;
  }
  function settleNow() { if (!settleOrder()) return; try { g.save(); } catch { /* sparas ändå regelbundet */ } }
  function saveIsOurs() {
    try { if (sessionStorage.getItem('sf_menu_skip') || sessionStorage.getItem('sf_restored')) return false; } catch { /* ingen sessionStorage */ }
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return !!p && p.day === g.day && p.home === g.home && Math.round(+p.money) === Math.round(g.money);
    } catch { return false; }
  }
  function saveAsEaten(e) {
    if (e?.type === 'visibilitychange' && document.visibilityState !== 'hidden') return;
    if (!me.order || !saveIsOurs()) return;
    const h0 = g.hunger, e0 = g.energy;
    for (const it of me.order) {
      if (it.settled) continue;
      for (let k = it.stage; k < it.bites; k++) { g.hunger = c100(g.hunger + it.fill / it.bites); g.energy = c100(g.energy + it.energy / it.bites); }
    }
    try { g.save(); } catch { /* sparas ändå regelbundet */ }
    g.hunger = h0; g.energy = e0;
  }
  const UNLOAD = [[window, 'sf:before-reload', settleNow], [window, 'pagehide', saveAsEaten], [document, 'visibilitychange', saveAsEaten]];
  for (const [el, ev, fn] of UNLOAD) el.addEventListener(ev, fn, true);

  function release() { if (me.res && me.res.occ === 'me' && me.res !== me.seat) me.res.occ = null; me.res = null; }
  function standUp() {
    if (!me.seat) return;
    const s = me.seat;
    s.occ = null; me.seat = null; me.slide = null;
    walker.px = s.ax; walker.py = s.ay; walker.stop();
    me.state = me.tray ? 'carry' : 'free';
  }
  function sitDown(s) {
    s.occ = 'me'; me.seat = s; me.res = null; me.sitT = 0; me.biteT = 0.9;
    me.slide = { fx: walker.px, fy: walker.py, k: 0 };
    me.state = 'sit';
    walker.stop();
    play('click');
  }
  function pickSeat() {
    const f = freeSeats();
    if (!f.length) return null;
    const score = (s) => Math.hypot(s.ax - walker.px, s.ay - walker.py) + (s.dir === 'up' && s.kind !== 'pall' ? 120 : 0) + (leftovers.some((l) => l.seat === s) ? 200 : 0);
    return f.sort((a, b) => score(a) - score(b))[0];
  }
  function goSit(s) {
    release();
    me.res = s;
    walker.walkTo(s.ax, s.ay, () => {
      if (s.occ && s.occ !== 'me') {
        const alt = pickSeat();
        if (!alt) { me.state = me.tray ? 'carry' : 'free'; talkMe.say('😕 Alla platser är upptagna!', meAt); return; }
        goSit(alt); return;
      }
      sitDown(s);
    });
    if (!me.seat) s.occ = 'me';
  }

  // ---------- köpet ----------
  function buy(ids) {
    if (!alive) return { ok: false, msg: 'Sjöboden är stängd.' };
    const list = normOrder(ids);
    if (!list.length) return { ok: false, msg: 'Välj något från menyn först!' };
    if (me.state === 'wait' || me.state === 'toCounter') return { ok: false, msg: `${COOK_NAME} lagar redan din beställning!` };
    if (me.order) return { ok: false, msg: 'Ät upp det du har först!' };
    const price = priceOf(list);
    if (g.money < price) return { ok: false, msg: 'Du har inte råd!' };
    if (me.state === 'sit') standUp();
    release();
    g.money -= price;
    g.passTime(10);
    g.save();
    play('coin');
    const items = list.map((m) => ({ id: m.id, stage: 0, bites: m.bites, fill: m.fill, energy: m.energy, glad: m.glad | 0 }));
    me.order = items;
    const order = () => { me.state = 'wait'; walker.dir = 'up'; jobs.push({ who: 'me', items, x: PAY_X }); };
    const atCounter = Math.abs(walker.py - ORDER_Y) < 6 && Math.abs(walker.px - PAY_X) < 26 && !walker.path.length;
    if (atCounter) order();
    else { me.state = 'toCounter'; walker.walkTo(PAY_X, ORDER_Y, order); }
    const line = orderText(list);
    talkCook.say(`🐟 ${line[0].toUpperCase() + line.slice(1)} – ${price} kr, tack! Det blir strax.`, cookAt, 3.6);
    return { ok: true, price, fill: fillOf(list), energy: energyOf(list), items: list.map((m) => m.id) };
  }
  // menyn vid disken: en varmrätt (eller ingen), lägg till hjortronglass och hallonsoda
  let pick = { main: null, hjortron: false, soda: false };
  function openMenu(pre) {
    if (me.order) { nag(MSG_ATUPP); return; }
    if (pre) pick = { main: null, hjortron: false, soda: false, ...pre };
    const ids = () => [pick.main, pick.hjortron && 'hjortron', pick.soda && 'soda'].filter(Boolean);
    const render = () => {
      const list = normOrder(ids()), price = priceOf(list);
      const on = (m) => (m.main ? pick.main === m.id : pick[m.id]);
      const rows = SJO_MENY.map((m, i) => `<div class="prow" style="grid-template-columns:52px 1fr auto;${on(m) ? 'background:#fff3c8' : ''}">
          <canvas data-ic="${i}" width="24" height="16" style="width:48px;height:32px;image-rendering:pixelated;background:#e4ecf4;border:2px solid #17151a"></canvas>
          <span class="nm">${m.icon} ${m.name} <b>${fmt(m.price)}</b><br><small class="sp">+${m.fill} mättnad · +${m.energy} energi${m.glad ? ' · 😊 lycka' : ''} · ${m.bites} tuggor</small></span>
          <button class="btn btn-small ${on(m) ? 'btn-gold' : ''}" data-pick="${m.id}" data-key="${i + 1}">${on(m) ? '✓ Vald' : m.main ? 'Välj' : '+ Lägg till'} <kbd>${i + 1}</kbd></button>
        </div>`).join('');
      const body = `<p style="font-size:var(--f2);margin:0 0 8px">💰 <b>${fmt(g.money)}</b> · 🍽️ Mättnad <b>${Math.round(g.hunger)}</b>/100 · ⚡ Energi <b>${Math.round(g.energy)}</b>/100</p>
        <div class="plist">${rows}</div>
        <p style="font-size:var(--f1);margin:10px 0 0;color:#6d6660">Du får maten på en bricka och sätter dig vid ett bord eller i fönstret med utsikt över havet. Mättnaden och energin kommer medan du äter – och när allt är uppätet blir du gladare!</p>`;
      const can = list.length > 0 && g.money >= price;
      const dlg = openModal(MENU_TITLE, body, [
        { label: 'Nej tack', onClick: closeModal },
        { label: list.length ? `🐟 Beställ – ${fmt(price)}` : '🐟 Beställ', cls: 'btn-go', disabled: !can, onClick: () => {
          const r = buy(ids());
          closeModal();
          if (!r.ok) { talkCook.say('😳 ' + r.msg, cookAt); play('fel'); }
        } },
      ]);
      dlg.querySelectorAll('canvas[data-ic]').forEach((cv) => {
        const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
        const m = SJO_MENY[+cv.dataset.ic], d = dishImg(m.id, 0, m.bites);
        x.drawImage(d, (24 - d.width) >> 1, 16 - d.height);
      });
      dlg.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
        const m = menyOf(b.dataset.pick);
        if (m.main) pick.main = pick.main === m.id ? null : m.id;
        else pick[m.id] = !pick[m.id];
        play('click');
        render();
      }));
    };
    render();
  }

  // ---------- klickbara saker ----------
  const quip = (text, at = meAt) => talkMe.say(text, at, 3.4);
  const atWall = (x) => [x, WALL_Y + 12];
  const hot = [
    { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 4, DOOR.x1 + 3, WALL_Y + 10], go: () => DOOR_SPOT, act: () => { play('door'); A.go('city'); } },
    { id: 'meny', r: [MENU.x0, MENU.y0, MENU.x1, MENU.y1], go: () => [PAY_X, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'monter', r: [MONTER.x0, CNT.top - 22, MONTER.x1, CNT.top + 2], go: () => [PAY_X, ORDER_Y], act: () => { walker.dir = 'up'; talkCook.say('🦐 Allt i montern kom in med båten i morse!', cookAt); play('click'); openMenu(); } },
    { id: 'disk', r: [CNT.x0, 70, CNT.x1, CNT.y + 2], go: () => [PAY_X, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'gryta', r: [POT.x0 - 4, POT.top - 10, POT.x1 + 4, BACK.top], go: () => [POT_X, ORDER_Y], act: () => { walker.dir = 'up'; talkCook.say('🍲 Fisksoppan har puttrat sen i morse – med saffran och fänkål!', cookAt); } },
    { id: 'frit', r: [FRY.x0, FRY.top - 4, FRY.x1, BACK.top], go: () => [FRY_X, ORDER_Y], act: () => { walker.dir = 'up'; talkCook.say('🐟 Torsk i ölsmet – krispig utanpå, saftig inuti.', cookAt); } },
    { id: 'hylla', r: [SHELF.x0, SHELF.y0, SHELF.x1, SHELF.y1], go: () => [SHELF_X, ORDER_Y], act: () => { play('click'); openMenu({ soda: true }); } },
    { id: 'fonster', r: [WINS[0].x0 - 4, WIN_T - 4, WINS[2].x1 + 4, SILL.y - 3], go: (x) => [clamp(x, 20, 170), WALL_Y + 14], act: () => { walker.dir = 'up'; quip(isNight(g.min / 60) ? '🌊 Fyren på Pixelskär blinkar ute i mörkret.' : sea.jump >= 0 ? '🐟 Såg du? En fisk hoppade!' : '🌊 Havet glittrar. Där borta står fyren på Pixelskär.'); } },
    { id: 'ratt', r: [RATT.x - 13, RATT.y - 13, RATT.x + 13, RATT.y + 13], go: () => atWall(RATT.x), act: () => { walker.dir = 'up'; quip('⎈ En riktig skeppsratt från en gammal fiskebåt.'); } },
    { id: 'tavla', r: [TAVLA.x0, TAVLA.y0, TAVLA.x1, TAVLA.y1], go: () => atWall((TAVLA.x0 + TAVLA.x1) / 2), act: () => { walker.dir = 'up'; quip('🖼️ Fyren på Pixelskär – målad av Majas morfar.'); } },
    { id: 'akvarium', r: [AQUA.x0 - 2, AQUA.top - 2, AQUA.x1 + 2, AQUA.top + 28], go: () => [AQUA.x0 - 6, AQUA.y + 8], act: () => { walker.dir = 'right'; talkCook.say('🦞 Det där är Harald. Han är INTE till salu!', cookAt); } },
    { id: 'katt', r: [TUNNA.x - 10, TUNNA.y - 32, TUNNA.x + 12, TUNNA.y - 18], go: () => [TUNNA.x + 12, TUNNA.y + 4], act: () => { walker.dir = 'left'; cat.awake = 3.2; cat.tail = 3; play('chirp'); quip('😺 Skeppskatten Sill spinner och blinkar mot dig.'); g.glad?.(1, '', 'sjokatt', 1); } },
    { id: 'ankare', r: [ANKARE.x - 15, ANKARE.y - 34, ANKARE.x + 15, ANKARE.y + 2], go: () => [ANKARE.x + 20, ANKARE.y - 4], act: () => { walker.dir = 'left'; quip('⚓ Ett gammalt ankare. Det går inte att rubba!'); } },
    { id: 'tinor', r: [TINOR.x - 15, TINOR.y - 26, TINOR.x + 15, TINOR.y + 2], go: () => [TINOR.x - 20, TINOR.y - 4], act: () => { walker.dir = 'right'; quip('🦞 Hummertinor. Maja lägger ut dem på hösten.'); } },
  ];
  const spotAt = (x, y) => hot.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const seatAt = (x, y) => seats.find((s) => {
    if (s.kind === 'pall') return Math.abs(x - s.x) < 9 && y > s.y - 36 && y < s.y + 3;
    return Math.abs(x - s.x) < 9 && y > s.y - 32 && y < s.y + 4;
  });

  // ---------- Maja lagar maten ----------
  function buildSteps(job) {
    const ids = job.items.map((i) => i.id), S = [];
    if (ids.includes('fishchips')) S.push({ x: FRY_X, y: COOK_BACK, dir: 'up', dur: 1.6, act: 'frit' });
    if (ids.includes('fisksoppa')) S.push({ x: POT_X, y: COOK_BACK, dir: 'up', dur: 1.3, act: 'soppa' });
    if (ids.includes('raksmorgas')) S.push({ x: MONTER_X, y: COOK_FRONT, dir: 'down', dur: 1.4, act: 'rakor' });
    if (ids.includes('sill')) { S.push({ x: SHELF_X, y: COOK_BACK, dir: 'up', dur: 0.9, act: 'burk' }); S.push({ x: POT_X, y: COOK_BACK, dir: 'up', dur: 0.8, act: 'soppa' }); }
    if (ids.some((i) => SJO_MENY.find((m) => m.id === i)?.main)) S.push({ x: PLATE_X, y: COOK_FRONT, dir: 'down', dur: 0.8, act: 'lagg' });
    if (ids.includes('hjortron')) S.push({ x: SHELF_X, y: COOK_BACK, dir: 'up', dur: 0.9, act: 'glass' });
    if (ids.includes('soda')) S.push({ x: SHELF_X, y: COOK_BACK, dir: 'up', dur: 0.5, act: 'soda' });
    S.push({ x: clamp(job.x, CNT.x0 + 22, CNT.x1 - 18), y: COOK_FRONT, dir: 'down', dur: 0.35, act: 'servera' });
    return S;
  }
  function cookGo(x, y) { cook.tx = x; cook.ty = y; }
  function updateCook(dt) {
    const K = cook;
    const dx = K.tx - K.x, dy = K.ty - K.y, dist = Math.hypot(dx, dy);
    K.walking = dist > 0.5;
    if (K.walking) {
      const st = Math.min(dist, 66 * dt);
      K.x += dx / dist * st; K.y += dy / dist * st;
      K.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      K.act = null;
      return;
    }
    K.x = K.tx; K.y = K.ty;
    if (K.phase === 'idle') {
      if (jobs.length) {
        K.job = jobs.shift(); K.steps = buildSteps(K.job); K.si = 0; K.t = 0; K.phase = 'work';
        cookGo(K.steps[0].x, K.steps[0].y);
        if (K.job.who !== 'me' && Math.random() < 0.45) talkCook.say(['Ska bli!', 'Kommer strax!', 'Ett gott val!'][(Math.random() * 3) | 0], cookAt, 2);
        return;
      }
      K.idleT -= dt;
      if (K.idleT <= 0) {
        const r = Math.random();
        if (r < 0.3) { K.act = 'torka'; cookGo(252 + Math.random() * 150, COOK_FRONT); K.face = 'down'; }
        else if (r < 0.55) { K.act = 'soppa'; cookGo(POT_X, COOK_BACK); K.face = 'up'; }
        else if (r < 0.7) { K.act = null; cookGo(CNT.x1 - 14, COOK_FRONT); K.face = 'right'; }
        else { K.act = null; cookGo(PAY_X - 8, COOK_FRONT); K.face = 'down'; }
        K.idleT = 3 + Math.random() * 4;
        K.idleAct = K.act;
      }
      K.dir = K.face; K.act = K.idleAct || null;
      return;
    }
    const s = K.steps[K.si];
    K.dir = s.dir; K.act = s.act; K.t += dt;
    if ((s.act === 'frit' || s.act === 'soppa') && Math.random() < dt * 8) puff(s.act === 'frit' ? FRY.x0 + 6 + Math.random() * 20 : POT.x0 + 6 + Math.random() * 16, (s.act === 'frit' ? FRY.top : POT.top) - 2);
    if (K.t < s.dur) return;
    K.t = 0; K.si++;
    if (K.si < K.steps.length) { const n = K.steps[K.si]; cookGo(n.x, n.y); return; }
    trays.push({ x: Math.round(clamp(K.job.x, CNT.x0 + 22, CNT.x1 - 18)), who: K.job.who, items: K.job.items, at: t });
    if (K.job.who === 'me') { play('ok'); talkCook.say('Varsågod! Smaklig måltid! 🐟', cookAt, 2.6); }
    K.job = null; K.act = null; K.phase = 'idle'; K.idleT = 1.5 + Math.random() * 2; K.idleAct = null;
  }

  // ---------- gästerna ----------
  const pickSeatNPC = () => { const f = freeSeats(); return f.length ? f[(Math.random() * f.length) | 0] : null; };
  function npcLeave(G, pause) {
    G.state = 'leave'; G.items = null;
    G.w.walkTo(...DOOR_SPOT, () => { G.state = 'away'; G.t = pause + Math.random() * 18; });
  }
  function nextBite(items) {
    let best = null;
    for (const it of items || []) if (it.stage < it.bites && (!best || it.stage / it.bites < best.stage / best.bites)) best = it;
    return best;
  }
  function updateGuest(G, dt) {
    if (G.slide) { G.slide.k += dt * 4; if (G.slide.k >= 1) G.slide = null; }
    if (G.state === 'sit') {
      G.sitT += dt; G.eatT -= dt;
      if (G.eating > 0) G.eating -= dt;
      if (G.eatT <= 0) { G.eating = 0.55; G.eatT = 2 + Math.random() * 3; }
      G.biteT -= dt;
      if (G.biteT <= 0) {
        G.biteT = G.fixed ? 6 + Math.random() * 8 : 2.4 + Math.random() * 2;
        const it = nextBite(G.items);
        if (it) it.stage++;
        else if (G.fixed) G.items = newOrder();
      }
      if (G.fixed) return;
      if (G.sitT > G.stay || (G.items && G.items.every((i) => i.stage >= i.bites) && G.sitT > 6)) {
        leftovers.push({ seat: G.seat, items: G.items.map((i) => ({ ...i, stage: i.bites })), until: t + 10 });
        G.seat.occ = null; G.w.px = G.seat.ax; G.w.py = G.seat.ay; G.seat = null;
        npcLeave(G, 10);
      }
      return;
    }
    if (G.fixed) return;
    if (G.state === 'away') {
      G.t -= dt;
      if (G.t > 0) return;
      G.look = lookOf(); G.ordered = false; G.items = null;
      G.w.px = DOOR_SPOT[0]; G.w.py = DOOR_SPOT[1]; G.w.stop();
      G.state = 'enter';
      queue.push(G);
      G.qx = QPOS[Math.min(queue.indexOf(G), QPOS.length - 1)];
      G.w.walkTo(G.qx, ORDER_Y + 2, () => { G.state = 'queue'; });
      return;
    }
    if (G.state === 'enter' || G.state === 'queue') {
      const ix = queue.indexOf(G);
      const wantX = QPOS[Math.min(Math.max(ix, 0), QPOS.length - 1)];
      if (G.qx !== wantX) { G.qx = wantX; G.state = 'enter'; G.w.walkTo(wantX, ORDER_Y + 2, () => { G.state = 'queue'; }); }
      if (G.state === 'queue') {
        G.w.dir = 'up';
        if (ix === 0 && !G.ordered) {
          G.ordered = true;
          G.items = newOrder();
          G.bubble = { icon: G.items[0].id, until: t + 2.4 };
          jobs.push({ who: G, items: G.items, x: G.w.px });
        }
        if (G.ordered) {
          const k = trays.findIndex((tr) => tr.who === G && t - tr.at > 0.5);
          if (k >= 0) {
            trays.splice(k, 1);
            queue.splice(queue.indexOf(G), 1);
            const s = pickSeatNPC();
            if (!s) { npcLeave(G, 12); return; }
            s.occ = G; G.seat = s;
            G.state = 'carry';
            G.w.walkTo(s.ax, s.ay, () => { G.state = 'sit'; G.sitT = 0; G.stay = 18 + Math.random() * 16; G.eatT = 1; G.biteT = 2; G.slide = { fx: G.w.px, fy: G.w.py, k: 0 }; });
          }
        }
      }
    }
    G.w.update(dt);
  }

  // ---------- figuren (jag) ----------
  function updateMe(dt) {
    if (me.state === 'wait') {
      walker.dir = 'up';
      const k = trays.findIndex((tr) => tr.who === 'me' && t - tr.at > 0.5);
      if (k >= 0) {
        me.tray = { items: trays[k].items };
        trays.splice(k, 1);
        me.state = 'carry';
        if (!me.hintGiven) { me.hintGiven = true; talkMe.say('🐟 Klicka på en ledig plats så sätter jag mig där!', meAt); }
      }
    }
    if (me.state === 'carry' && !walker.path.length && !me.seat && me.res && me.res.occ === 'me') {
      if (Math.hypot(walker.px - me.res.ax, walker.py - me.res.ay) < 8) sitDown(me.res);
      else release();
    }
    if (me.state === 'sit') {
      me.sitT += dt;
      if (me.slide) { me.slide.k += dt * 4; if (me.slide.k >= 1) me.slide = null; }
      if (me.eating > 0) me.eating -= dt;
      if (me.tray) {
        me.biteT -= dt;
        if (me.biteT <= 0) {
          const it = nextBite(me.tray.items);
          if (it) {
            it.stage++; me.eating = 0.6; me.biteT = 1.3;
            if (!it.settled) giveBite(it);
            if (me.tray.items.every((i) => i.stage >= i.bites)) { me.doneT = t; play('ok'); }
          } else me.biteT = 1;
        }
        if (me.doneT > 0 && t - me.doneT > 1.2 && me.tray.items.every((i) => i.stage >= i.bites)) {
          const glad = me.order && !me.order.gladGiven ? (me.order.gladGiven = true, giveGlad(me.order)) : 0;
          me.tray = null; me.order = null; me.doneT = -9;
          g.save();
          talkMe.say(glad ? `😋 MUMS! Mätt och glad. 😊 +${glad}` : '😋 MUMS! Mätt och belåten.', meAt);
        }
      } else if (me.sitT > 14 && me.seat?.kind !== 'pall') standUp();
    }
  }

  // ---------- havet, akvariet och katten ----------
  function updateLife(dt) {
    sea.next -= dt;
    if (sea.jump >= 0) { sea.jump += dt * 1.4; if (sea.jump > 1.2) sea.jump = -1; }
    else if (sea.next <= 0) { const w = WINS[(Math.random() * 3) | 0]; sea.jx = w.x0 + 6 + Math.random() * (w.x1 - w.x0 - 20); sea.jy = HORIZON + 8 + Math.random() * 12; sea.jump = 0; sea.next = 6 + Math.random() * 10; }
    if (aq.wait > 0) aq.wait -= dt;
    else { aq.hx += aq.hd * dt * 3; if (aq.hx > AQUA.x1 - 8 || aq.hx < AQUA.x0 + 7) { aq.hd = -aq.hd; aq.hx = clamp(aq.hx, AQUA.x0 + 7, AQUA.x1 - 8); aq.wait = 2 + Math.random() * 4; } else if (Math.random() < dt * 0.15) aq.wait = 1.5 + Math.random() * 3; }
    if (cat.awake > 0) cat.awake -= dt;
    if (cat.tail > 0) cat.tail -= dt;
    cat.next -= dt;
    if (cat.next <= 0) { cat.tail = 1.2; cat.next = 6 + Math.random() * 9; }
    if (Math.random() < dt * 1.2) puff(POT.x0 + 6 + Math.random() * 16, POT.top - 2);           // soppan ångar alltid lite
    for (const p of parts) { p.age += dt; p.x += p.vx * dt + Math.sin(p.age * 5 + p.y) * dt * 2; p.y += p.vy * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
    if (parts.length > 100) parts.splice(0, parts.length - 100);
    bubbleT -= dt;
    if (bubbleT <= 0) {
      const sitting = guests.filter((G) => G.state === 'sit' && G.seat);
      if (sitting.length) { const G = sitting[(Math.random() * sitting.length) | 0]; G.bubble = { text: LINES[(Math.random() * LINES.length) | 0], until: t + 4 }; }
      bubbleT = 7 + Math.random() * 8;
    }
    for (let i = leftovers.length - 1; i >= 0; i--) if (leftovers[i].until < t || leftovers[i].seat.occ) leftovers.splice(i, 1);
  }
  let bubbleT = 5;
  let doorOpen = 0, doorWas = false, doorForMe = false, bellT = -9;
  function updateDoor(dt) {
    const near = (x, y) => x > DOOR.x0 - 10 && x < DOOR.x1 + 10 && y < WALL_Y + 14;
    doorForMe = near(walker.px, walker.py) && !me.order && !me.seat;
    const any = doorForMe || guests.some((G) => !G.fixed && (G.state === 'enter' || G.state === 'leave') && near(G.w.px, G.w.py));
    doorOpen += ((any ? 1 : 0) - doorOpen) * Math.min(1, dt * 7);
    if (any && !doorWas) { play('chirp'); bellT = t; }
    doorWas = any;
  }
  // ---------- ritning ----------
  function seatPos(s) {
    const o = s.occ;
    const slide = o === 'me' ? me.slide : o?.slide;
    const y = s.y - s.lift;
    if (!slide) return [s.x, y];
    const k = clamp(slide.k, 0, 1);
    return [slide.fx + (s.x - slide.fx) * k, slide.fy + (y - slide.fy) * k];
  }
  function drawSeated(ctx, s) {
    const o = s.occ;
    if (!o) return;
    const [x, y] = seatPos(s);
    const sliding = o === 'me' ? me.slide : o.slide;
    if (o === 'me') {
      if (!me.seat) return;
      drawPerson(ctx, x, y, A.avatar.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : me.eating > 0 ? 6 : 5);
      return;
    }
    if (o.state !== 'sit') return;
    drawPerson(ctx, x, y, o.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : o.eating > 0 ? 6 : 5);
  }
  function trayFor(s) {
    const o = s.occ;
    if (o === 'me' && me.seat === s && me.tray) return me.tray.items;
    if (o && o !== 'me' && o.state === 'sit' && o.items) return o.items;
    const l = leftovers.find((l) => l.seat === s);
    return l ? l.items : null;
  }
  function drawTrayAt(ctx, s) {
    const items = trayFor(s);
    if (!items) return;
    const c = trayCanvas(items);
    let px, py;
    if (s.kind === 'pall') { px = s.x + 16 - (TRAY_W >> 1); py = SILL.y - 1 - c.height + 4; }
    else {
      const T = s.table;
      if (s.front) { const back = seatById(T.id + 'a'); if (back && trayFor(back)) return; px = T.x - (TRAY_W >> 1); py = T.y - 13 - c.height; }
      else { px = T.x - (TRAY_W >> 1); py = T.y - 14 - c.height; }
    }
    ctx.drawImage(c, Math.round(px), Math.round(py));
  }
  // det Maja har i händerna eller gör just nu
  function drawCookTools(ctx) {
    if (cook.walking) return;
    const x = Math.round(cook.x), y = Math.round(cook.y);
    if (cook.act === 'soppa') {                                                               // sleven rör i grytan
      const k = Math.round(Math.sin(t * 6) * 3);
      ctx.fillStyle = '#c8a070'; ctx.fillRect(x + 3 + k, y - 34, 1, 10); ctx.fillStyle = '#8a6a40'; ctx.fillRect(x + 2 + k, y - 25, 3, 2);
    } else if (cook.act === 'rakor') {                                                        // en skopa räkor ur montern
      ctx.fillStyle = '#c4c9cf'; ctx.fillRect(x - 5, y - 20, 6, 2); ctx.fillStyle = '#f07a6a'; ctx.fillRect(x - 4, y - 21, 4, 1); ctx.fillRect(x - 3, y - 22, 2, 1);
    } else if (cook.act === 'lagg') {                                                         // en tallrik som läggs upp
      ctx.fillStyle = '#f0eee8'; ctx.fillRect(x - 6, y - 19, 12, 2); ctx.fillStyle = '#3a6ab0'; ctx.fillRect(x - 6, y - 17, 12, 1);
      if (Math.floor(t * 4) % 2) { ctx.fillStyle = '#4aa040'; ctx.fillRect(x + 1, y - 20, 1, 1); }   // dillkvisten på toppen
    } else if (cook.act === 'torka') {
      const k = Math.round(Math.sin(t * 6) * 5);
      ctx.fillStyle = '#e8eef4'; ctx.fillRect(x + k - 2, y - 13, 4, 2); ctx.fillStyle = '#3a6ab0'; ctx.fillRect(x + k - 2, y - 13, 1, 2);
    }
  }
  // fritöskorgen lyfts och skakas när Maja friterar, oljan bubblar
  function drawKitchenLive(ctx) {
    const frying = cook.act === 'frit' && !cook.walking;
    const lift = frying && (t * 3) % 1 > 0.5 ? 4 : 0, shake = frying ? Math.round(Math.sin(t * 30)) : 0;
    ctx.fillStyle = '#6a6e76'; ctx.fillRect(FRY.x0 + 8 + shake, FRY.top - 1 - lift, 14, 2);
    ctx.fillStyle = '#2a2a2e'; ctx.fillRect(FRY.x0 + 14 + shake, FRY.top - 8 - lift, 1, 7); ctx.fillRect(FRY.x0 + 13 + shake, FRY.top - 9 - lift, 3, 1);
    if (lift) { ctx.fillStyle = '#e8b048'; ctx.fillRect(FRY.x0 + 9 + shake, FRY.top - 2 - lift, 12, 1); }
    for (let k = 0; k < 3; k++) if (hash(Math.floor(t * 9), k, 8) > 0.5) { ctx.fillStyle = '#fff0b0'; ctx.fillRect(FRY.x0 + 4 + ((k * 9 + Math.floor(t * 7)) % 22), FRY.top + 1, 1, 1); }
    // soppan bubblar i grytkanten
    if (Math.floor(t * 5) % 2) { ctx.fillStyle = '#f08a4a'; ctx.fillRect(POT.x0 + 6 + (Math.floor(t * 3) % 14), POT.top + 1, 2, 1); }
  }
  // beställningsbubblan ovanför en gäst i kön
  function orderBubble(ctx, x, y, items) {
    const imgs = items.map((it) => dishImg(it.id, 0, it.bites));
    if (!imgs.length) return;
    const w = imgs.reduce((a, c) => a + c.width - 3, 0) + 7, h = Math.max(...imgs.map((c) => c.height)) + 2;
    const bx = Math.round(x - w / 2), by = y - h - 3;
    ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x - 2, by + h, 5, 1); ctx.fillRect(x - 1, by + h + 1, 3, 1); ctx.fillRect(x, by + h + 2, 1, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 1, by + h, 3, 1);
    let ix = bx + 2;
    for (const c of imgs) { ctx.drawImage(c, ix, by + h - c.height); ix += c.width - 3; }
  }

  function drawWorld(ctx, cx, vw, bv = null) {
    const hour = g.min / 60, night = isNight(hour), dark = darkness(hour), lit = night || dark > 0.15;
    ctx.drawImage(bg(), 0, 0);
    // ---- utsikten genom fönstren (och genom dörren när den står öppen) ----
    ctx.save();
    ctx.beginPath();
    for (const w of WINS) ctx.rect(w.x0, WIN_T, w.x1 - w.x0, WIN_B - WIN_T);
    ctx.clip();
    drawView(ctx, t, hour, sea);
    ctx.restore();
    if (doorOpen > 0.05) {                                                                    // ute: himlen, havet och bryggans plankor
      const [skyT, , seaD] = skyAt(hour), hex = (c) => '#' + c.toString(16).padStart(6, '0');
      ctx.fillStyle = hex(skyT); ctx.fillRect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, 20);
      ctx.fillStyle = hex(seaD); ctx.fillRect(DOOR.x0, DOOR.top + 20, DOOR.x1 - DOOR.x0, 14);
      for (let y = DOOR.top + 34; y < WALL_Y; y++) { ctx.fillStyle = (y - DOOR.top) % 4 === 3 ? '#5a3c24' : '#9a6e44'; ctx.fillRect(DOOR.x0, y, DOOR.x1 - DOOR.x0, 1); }
    }
    ctx.drawImage(doorFr[Math.round(clamp(doorOpen, 0, 1) * (doorFr.length - 1))], DOOR.x0, DOOR.top);
    const sw = t - bellT < 1.2 ? Math.round(Math.sin((t - bellT) * 18) * 1.5) : 0;            // skeppsklockan över dörren
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(DOOR.x1 + 1, DOOR.top - 3, 1, 3);
    ctx.fillStyle = '#d0aa50'; ctx.fillRect(DOOR.x1 + sw, DOOR.top, 3, 3); ctx.fillStyle = '#f6e0a0'; ctx.fillRect(DOOR.x1 + sw, DOOR.top, 1, 1);
    ctx.drawImage(winOv(), 0, 0);
    drawLanterns(ctx, t, lit);
    drawKitchenLive(ctx);
    drawAqua(ctx, t, aq);
    for (const s of seats) if (s.kind === 'pall') drawTrayAt(ctx, s);                       // maten på fönsterbänken

    // ---- allt på golvet i djupordning ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(CNT.y, () => {
      const kf = cook.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 1.7) > 0.93 ? 4 : 0);
      drawPerson(ctx, Math.round(cook.x), Math.round(cook.y), MAJA, cook.dir, kf);
      if (cook.dir === 'up') drawCookTools(ctx);
      ctx.drawImage(counter.img, counter.ox, counter.oy);
      if (cook.dir !== 'up') drawCookTools(ctx);
      for (const tr of trays) { const c = trayCanvas(tr.items); ctx.drawImage(c, tr.x - (TRAY_W >> 1), CNT.top + 3 - c.height); }
    });
    add(TUNNA.y, () => { ctx.drawImage(tunnaImg.img, TUNNA.x - tunnaImg.ox, TUNNA.y - tunnaImg.oy); drawCat(ctx, t, cat); });
    add(ANKARE.y, () => ctx.drawImage(ankareImg.img, ANKARE.x - ankareImg.ox, ANKARE.y - ankareImg.oy));
    add(TINOR.y, () => ctx.drawImage(tinorImg.img, TINOR.x - tinorImg.ox, TINOR.y - tinorImg.oy));
    STOOLS.forEach((sx, k) => { const s = seats[k]; add(STOOL_Y, () => { ctx.drawImage(stoolImg, sx - 7, STOOL_Y - 16); drawSeated(ctx, s); }); });
    for (const T of TABLES) {
      const sa = seatById(T.id + 'a'), sb = seatById(T.id + 'b');
      add(T.y, () => {
        ctx.drawImage(chairDown.img, sa.x - 8, sa.y - 22);
        drawSeated(ctx, sa);
        ctx.drawImage(tableImg, T.x - 15, T.y - 21);
        drawTrayAt(ctx, sa);
        drawTrayAt(ctx, sb);
      });
      add(sb.y, (c) => { c.drawImage(chairUp.img, sb.x - 8, sb.y - 22); drawSeated(c, sb); c.drawImage(chairUp.front, sb.x - 8, sb.y - 22); });
    }
    for (const G of guests) if (!G.fixed && (G.state === 'enter' || G.state === 'queue' || G.state === 'carry' || G.state === 'leave')) {
      add(G.w.py, (c) => {
        const carry = G.state === 'carry', walking = G.w.path.length > 0;
        const fr = carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0;
        const dir = G.state === 'queue' && !walking ? 'up' : G.w.dir;
        if (carry && dir === 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.items);
        drawPerson(c, G.w.px, G.w.py, G.look, dir, fr);
        if (carry && dir !== 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.items);
      });
    }
    const folks = worldFolksHere(A);
    folkDrawables(A, t).forEach((d, i) => {
      const f = folks[i], s = f && f.sit && !f.walking ? seats.find((q) => q.kind === 'pall' && Math.abs(q.x - f.x) <= 4 && Math.abs(q.y - f.y) <= 4) : null;
      if (!s) { add(d.fy, (c) => d.draw(c)); return; }
      add(s.y + 0.02, (c) => { c.save(); c.translate(0, -s.lift); d.draw(c); c.restore(); });
    });
    if (me.state !== 'sit') {
      const carry = me.state === 'carry';
      const sd = selfDrawable(A, walker, t, { carry, folksHere: worldFolksHere(A).length });
      add(walker.py + 0.01, (c) => {
        if (carry && walker.dir === 'up') drawTrayHeld(c, walker.px, walker.py, walker.dir, me.tray?.items);
        sd.draw(c);
        if (carry && walker.dir !== 'up') drawTrayHeld(c, walker.px, walker.py, walker.dir, me.tray?.items);
      });
    }
    items.sort((a, b) => a.fy - b.fy).forEach((it) => it.draw(ctx));
    drawCandles(ctx, t, lit);
    // ångan från grytan och fritösen
    for (const p of parts) { const k = 1 - p.age / p.max; ctx.fillStyle = `rgba(255,255,255,${(k * 0.5).toFixed(2)})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.age < 0.4 ? 1 : 2, 1); }

    // ---- kvällen: rummet mörknar, lyktorna och ljusen tar över ----
    if (night || dark > 0.2) {
      const k = night ? 1 : Math.min(1, (dark - 0.2) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = k;
      ctx.fillStyle = '#8a7a9a'; ctx.fillRect(cx, 0, vw, H);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
      ctx.drawImage(nightLight(), 0, 0);
      ctx.restore();
    }
    // ---- pratbubblor ----
    const iView = (x) => x > cx - 10 && x < cx + vw + 10;
    for (const G of guests) {
      if (!G.bubble || G.bubble.until <= t) continue;
      if (G.state === 'queue' && G.bubble.icon) { if (iView(G.w.px)) orderBubble(ctx, Math.round(G.w.px), Math.round(G.w.py) - 44, G.items || []); }
      else if (G.seat && G.state === 'sit' && G.bubble.text) {
        const [x, y] = seatPos(G.seat);
        if (!iView(x)) continue;
        const by = bubbleY(G.bubble.text, Math.round(y) - (G.seat.front || G.seat.kind === 'pall' ? 36 : 42), 76, 4);
        sayBubble(ctx, Math.round(x), by, G.bubble.text, { w: 76, lines: 4, x0: bv?.x0 ?? cx, x1: bv?.x1 ?? cx + vw });
      }
    }
  }

  function update(dt) {
    t += dt;
    walker.update(dt);
    worldSeatsTaken(A, seats);
    updateMe(dt);
    updateCook(dt);
    for (const G of guests) updateGuest(G, dt);
    updateDoor(dt);
    updateLife(dt);
    if (pendingHello > 0) { pendingHello -= dt; if (pendingHello <= 0) talkCook.say(isNight(g.min / 60) ? 'God kväll! Soppan är fortfarande varm.' : 'Välkommen ombord! Vad får det lov att vara?', cookAt, 2.6); }
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (cams() - cam.x) * k;
    cam.y += (camYGoal() - cam.y) * Math.min(1, dt * 4);
    clampCamY();
  }
  for (let i = 0; i < 30; i++) updateLife(1 / 15);

  function dbg() {
    return {
      me: me.state, seat: me.seat?.id || null,
      tray: me.tray ? me.tray.items.map((i) => i.id + ':' + i.stage + '/' + i.bites) : null,
      order: !!me.order, say: talkMe.text(), cookSay: talkCook.text(), door: +doorOpen.toFixed(2), doorForMe,
      x: Math.round(walker.px), y: Math.round(walker.py),
      money: g.money, hunger: +g.hunger.toFixed(2), energy: +g.energy.toFixed(2), got: { ...me.got },
      cook: cook.phase, cookAct: cook.act, jobs: jobs.length, queue: queue.length,
      traysOnCounter: trays.length, guests: guests.map((G) => G.state), camY: camY(), cat: cat.awake > 0,
    };
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return me.seat ? me.seat.y : walker.py; },
    get worldSit() { return me.state === 'sit' && me.seat && !me.slide ? { dir: me.seat.dir, eat: !!me.tray } : null; },
    enter() { pendingHello = 0.7; cam.y = camYGoal(); clampCamY(); },
    _debug: {
      spot: (id) => {
        const cy = camY();
        const h = hot.find((h) => h.id === id);
        if (h) return { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 + cy };
        if (id === 'bord') { const s = freeSeats().find((s) => !s.front && s.kind === 'bord'); return s ? { x: s.x - cam.x, y: s.y - 14 + cy } : null; }
        if (id === 'golv') return { x: 300 - cam.x, y: 180 + cy };
        const s = seatById(id);
        return s ? { x: s.x - cam.x, y: s.y - 14 + cy } : null;
      },
      camY: () => camY(),
      seated: () => (me.seat ? me.seat.id : null),
      tray: () => (me.tray ? me.tray.items.map((i) => ({ id: i.id, stage: i.stage, bites: i.bites })) : null),
      forceBuy: (ids) => buy(Array.isArray(ids) ? ids : [ids]),
      eatFast: () => {
        for (let i = 0; i < 4000 && (me.tray || me.state === 'wait' || me.state === 'toCounter' || me.state === 'carry'); i++) {
          me.biteT = Math.min(me.biteT, 0.05);
          if (me.state === 'carry' && !walker.path.length && !me.res && !me.seat) { const s = pickSeat(); if (s) goSit(s); }
          update(1 / 30);
        }
        return dbg();
      },
      state: dbg,
      menu: SJO_MENY.map((m) => ({ id: m.id, price: m.price, fill: m.fill, energy: m.energy, bites: m.bites, glad: m.glad })),
      seats: () => seats.map((s) => ({ id: s.id, x: s.x, y: s.y, occ: s.occ === 'me' ? 'me' : s.occ?.state === 'remote' ? 'remote' : s.occ ? 'npc' : null })),
      sit: (id) => {
        const s = seatById(id);
        if (!s || s.occ || me.state === 'wait' || me.state === 'toCounter') return;
        if (me.state === 'sit' && me.tray) { nag(MSG_ATUPP); return; }
        if (me.state === 'sit') standUp();
        goSit(s);
      },
      openMenu: (pre) => openMenu(pre),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = cams(); },
      teleport: (x, y) => { if (me.state === 'sit') standUp(); walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = cams(); cam.y = camYGoal(); clampCamY(); },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      cam: () => cam.x,
      hover: (id) => { hoverId = id || null; hoverT = t; },
      jump: () => { sea.jx = WINS[1].x0 + 10; sea.jy = HORIZON + 12; sea.jump = 0.3; },
      cookTo: (act) => { const at = { frit: [FRY_X, COOK_BACK, 'up'], soppa: [POT_X, COOK_BACK, 'up'], rakor: [MONTER_X, COOK_FRONT, 'down'], lagg: [PLATE_X, COOK_FRONT, 'down'] }[act]; if (!at) return; cook.x = cook.tx = at[0]; cook.y = cook.ty = at[1]; cook.face = at[2]; cook.idleAct = act; cook.idleT = 99; cook.dir = at[2]; cook.act = act; },
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d'), vt = visTop;
        x.imageSmoothingEnabled = false;
        visTop = 0;
        drawWorld(x, 0, W);
        talkCook.draw(x, { x0: 0, x1: W }); talkMe.draw(x, { x0: 0, x1: W });
        visTop = vt;
        return c.toDataURL('image/png');
      },
      // alla rätter i alla tuggsteg + brickor (förhandsbild för utvecklingen)
      sheet: () => {
        const c = mkCanvas(200, 140), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.fillStyle = '#e4dccb'; x.fillRect(0, 0, 200, 140);
        SJO_MENY.forEach((m, r) => { for (let s = 0; s <= m.bites; s++) x.drawImage(dishImg(m.id, s, m.bites), 4 + s * 25, 4 + r * 18); });
        const tr = [[{ id: 'fishchips', stage: 0, bites: 4 }, { id: 'hjortron', stage: 0, bites: 3 }, { id: 'soda', stage: 0, bites: 2 }], [{ id: 'fisksoppa', stage: 2, bites: 4 }, { id: 'soda', stage: 1, bites: 2 }], [{ id: 'raksmorgas', stage: 0, bites: 4 }]];
        tr.forEach((items, k) => x.drawImage(trayCanvas(items), 132, 4 + k * 30));
        return c.toDataURL('image/png');
      },
    },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy - camY();
      if (me.state === 'wait' || me.state === 'toCounter') {
        if (t - me.waitMsgT > 2) { talkMe.say(`🐟 ${COOK_NAME} lagar min beställning ...`, meAt); me.waitMsgT = t; }
        return;
      }
      const atDoor = (px, py) => px > DOOR.x0 - 10 && px < DOOR.x1 + 10 && py < WALL_Y + 14;
      if (me.state === 'carry') {
        const s = seatAt(x, y);
        if (s && !s.occ) { goSit(s); play('click'); return; }
        if (s && s.occ) { if (t - me.waitMsgT > 2) { talkMe.say('😕 Där sitter någon redan!', meAt); me.waitMsgT = t; } return; }
        const h = spotAt(x, y);
        if ((h && h.id === 'dorr') || atDoor(x, y)) { nag(MSG_DORR); return; }
        if (h && (h.id === 'disk' || h.id === 'meny' || h.id === 'hylla')) { nag(MSG_ATUPP); return; }
        if (y > WALL_Y) { release(); walker.walkTo(x, y); return; }
        if (t - me.waitMsgT > 2.5) { talkMe.say('🐟 Klicka på en ledig plats så sätter jag mig där.', meAt); me.waitMsgT = t; }
        return;
      }
      if (me.state === 'sit' && me.tray) {
        const h = spotAt(x, y);
        if ((h && h.id === 'dorr') || atDoor(x, y)) { nag(MSG_DORR); return; }
        const s = seatAt(x, y);
        if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') { s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 }; play('click'); return; }
        if (h && (h.id === 'fonster' || h.id === 'katt' || h.id === 'akvarium')) { h.act(); return; }   // titta ut och klappa katten går bra mitt i maten
        nag(MSG_ATUPP);
        return;
      }
      if (me.state === 'sit') standUp();
      release();
      const h = spotAt(x, y);
      if (h) { const [gx, gy] = h.go(x); walker.walkTo(gx, gy, h.act); return; }
      const s = seatAt(x, y);
      if (s && !s.occ) { goSit(s); return; }
      if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') { s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 }; play('click'); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy - camY())?.id || null; hoverT = t; },
    key() {},
    leaveBlock(o) {
      if (!me.order) return null;
      if (!o?.quiet) nag(MSG_DORR);
      return MSG_DORR;
    },
    exit() {
      for (const [el, ev, fn] of UNLOAD) el.removeEventListener(ev, fn, true);
      if (settleOrder()) {
        for (const it of me.order) it.stage = it.bites;
        me.order = null; me.tray = null;
        g.save();
      }
      alive = false;
      if (modalOpen() && document.querySelector('#modal .dlg')?.dataset.title === MENU_TITLE) closeModal();
      talkMe.clear(); talkCook.clear();
    },
    draw(ctx) {
      syncView(A);
      clampCamY();
      const cx = Math.round(cam.x), cy = camY(), sb = safeBox();
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.fillStyle = '#17151a';
      if (cy > 0) ctx.fillRect(0, 0, VW, cy);
      if (cy < 0) ctx.fillRect(0, H + cy, VW, -cy);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, cy * A.pxs);
      visTop = sb.y0 - cy;
      const view = { x0: cx + sb.x0, x1: cx + sb.x1 };
      drawWorld(ctx, cx, VW, view);
      if (cook.x > cx - 6 && cook.x < cx + VW + 6) drawSpeech(ctx, talkCook, cookAt, view);
      drawSpeech(ctx, talkMe, meAt, view);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const h = hoverId && t - hoverT < 3 ? hoverId : null;
      const LABEL = { disk: 'BESTÄLL VID DISKEN', meny: 'BESTÄLL VID DISKEN', hylla: 'HALLONSODA 15 KR', monter: 'DAGENS FÅNGST', gryta: 'FISKSOPPAN', frit: 'FRITÖSEN', fonster: 'UTSIKTEN ÖVER HAVET', ratt: 'SKEPPSRATTEN', tavla: 'TAVLAN', akvarium: 'HUMMERN HARALD', katt: 'SKEPPSKATTEN SILL', ankare: 'ANKARET', tinor: 'HUMMERTINORNA' };
      const label = h === 'dorr' ? (me.order ? 'ÄT UPP MATEN FÖRST - SEN KAN DU GÅ UT' : 'GÅ UT PÅ BRYGGAN') : LABEL[h] || null;
      if (label) {
        const w = textW(SMALL, label) + 10, lx = (sb.x0 + sb.x1 - w) >> 1, ly = sb.y1 - 14;
        ctx.fillStyle = '#17151a'; ctx.fillRect(lx, ly, w, 11);
        ctx.fillStyle = '#3a8ac0'; ctx.fillRect(lx + 1, ly + 1, w - 2, 1);
        ctxText(ctx, SMALL, label, lx + 5, ly + 4, '#f4f1ea');
      }
    },
  };
}
