// PIXELBANKEN – stadens bank i finanskvarteret downtown: en pampig bankhall i sten och
// mässing som man går runt i med sin egen figur (kameran följer figuren i sidled).
//
//   entrén:      karusselldörr i mässing mellan två höga bågfönster med sammetsdraperier
//                (skyskraporna i finanskvarteret syns utanför, folk och bilar passerar),
//                klockan över dörren, röd löpare, väktaren, palmen, skrivpulpeten med
//                kedjade pennor och skinnbänken
//   kassahallen: långa kassadisken i mahogny och grön marmor med glasrutor och mässingsram,
//                tre kassor med kassörer i bankens gröna väst. Bakom dem VALVET – den runda
//                ståldörren står öppen (guldtackor, säckar och bankfack därinne) – under
//                guldbokstäverna PIXELBANKEN, tavlan med sparräntan och valutatavlan.
//                Framför disken: kön med mässingsstolpar och röda repband, NÄSTA KUND-
//                skylten och spargrisen på sin sockel. I golvet bankens kompassros.
//   höger:       BANKOMATEN i väggen, BÖRSEN med tickande kurser och löpremsa, grundarens
//                porträtt, rådgivarens skrivbord med bankirlampa och besöksstolar,
//                broschyrstället och en palm
//
// Sparkontot (g.bank – logiken bor i game.js): i kassan sätter man in och tar ut,
// bankomaten tar bara ut, hos rådgivaren sätter man sig och får räntan, räntekalkylen
// och kontoutdraget. Räntan (BANK_RATE, 2 % i veckan på det som legat kvar hela veckan,
// högst på BANK_CAP kr) betalas ut varje måndag morgon av Game.sleep(). Allt syns i
// dialoger i spelets stil.
// Kunderna kommer in genom karusselldörren, ställer sig i kön och går fram när en kassa
// blir ledig – en kassa hålls alltid ledig åt spelaren – eller tar ut i bankomaten.
// Öppettiderna följer huset i staden; efter stängning går personalen hem (kassorna får en
// STÄNGT-skylt) och bara bankomaten tar ut.
// Allt målas en gång med Pix-pennan (ett pixelkorn, ramper med 3–5 toner, mörk kontur)
// och cachas; varje bildruta ritar bara färdiga bilder plus det som lever.
import { Pix, SMALL, BIG, ctxText, textW, text, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook, isValid } from '../core/people.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import * as GM from '../game.js';
import { fmt, clock, DAY_NAMES } from '../game.js';
import { play, audioContext, isMuted } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import * as MAP from '../city/map.js';

// ================= öppettiderna =================
// Hallen följer husets open i staden (js/city/map.js, husid 'bank') – då står samma tider
// på dörren som staden släpper in en. Saknas huset gäller BANK_OPEN. Bankomaten lovas
// "dygnet runt" bara om staden släpper in en när som helst (huset har ingen open) –
// annars står den i hallen och har samma tider som kassorna.
export const BANK_OPEN = [9, 18];
const CITY_BANK = (() => { try { return MAP.buildingById?.('bank') || null; } catch { return null; } })();
const HOURS = Array.isArray(CITY_BANK?.open) && CITY_BANK.open.length === 2 ? CITY_BANK.open : BANK_OPEN;
const ATM_24 = !!CITY_BANK && !CITY_BANK.open;
const STAFF_GRACE = 0.5;   // kassörerna betjänar den som är kvar en halvtimme efter stängning

// ================= sparkontot =================
// Logiken bor i game.js (g.bankDeposit / g.bankWithdraw, räntan och autogirot i g.sleep).
// Scenen läser BANK_RATE, BANK_CAP och bankInterest därifrån om de finns (namnrymdsimport –
// saknas de blir det inget importfel), annars samma tal här, så att banken aldrig fäller spelet.
// Räntan räknas på det som legat på kontot hela veckan (g.bankMin, veckans lägsta saldo)
// och på högst BANK_CAP kr.
const RATE = () => (typeof GM.BANK_RATE === 'number' ? GM.BANK_RATE : 0.02);
const CAP = () => (typeof GM.BANK_CAP === 'number' ? GM.BANK_CAP : 20000);
const pctTxt = () => String(Math.round(RATE() * 1000) / 10).replace('.', ',');
const interestOf = (s) => (typeof GM.bankInterest === 'function' ? GM.bankInterest(s) : Math.round(Math.min(CAP(), Math.max(0, +s || 0)) * RATE()));
const saldoOf = (g) => Math.max(0, Math.round(+g.bank || 0));
// det som legat kvar hela veckan (utan bankMin i game.js: hela saldot)
const minOf = (g) => (g.bankMin == null ? saldoOf(g) : Math.max(0, Math.min(saldoOf(g), Math.round(+g.bankMin || 0))));
const nextInterest = (g) => interestOf(minOf(g));
function bankDo(g, kind, kr, via = 'kassa') {
  if (kind === 'in' && typeof g.bankDeposit === 'function') return g.bankDeposit(kr);
  if (kind === 'ut' && typeof g.bankWithdraw === 'function') return g.bankWithdraw(kr, { via });
  // reserv om game.js-patchen saknas: samma regler, ingen logg
  kr = Math.floor(+kr || 0);
  if (kr <= 0) return { ok: false, msg: 'Välj ett belopp.' };
  if (kind === 'in' ? kr > g.money : kr > saldoOf(g)) return { ok: false, msg: kind === 'in' ? 'Så mycket har du inte på fickan.' : 'Så mycket finns inte på sparkontot.' };
  g.bank = saldoOf(g) + (kind === 'in' ? kr : -kr);
  if (kind === 'ut' && g.bankMin != null) g.bankMin = Math.min(g.bankMin, g.bank);
  g.money += kind === 'in' ? -kr : kr;
  g.save();
  return { ok: true, kr };
}
// dagar kvar till nästa måndag morgon (dag 1 = måndag; i morgon = 1)
const daysToMonday = (g) => 7 - ((Math.max(1, g.day | 0) - 1) % 7);
// saldot efter n veckor om pengarna ligger kvar (ränta på räntan, avrundat varje vecka)
const growOf = (kr, weeks) => { let s = Math.max(0, Math.round(kr)); for (let i = 0; i < weeks; i++) s += interestOf(s); return s; };
const groupNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ================= mått (spelpixlar, världskoordinater) =================
const W = 672, H = 216;
let VW = 384;                                    // vyns bredd (mobilfyllning: följer skärmen)
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const SIDE = 6;                                  // sidoväggarna
const CEIL = 12;                                 // taklistens underkant
const WALL_Y = 108;                              // golvet börjar här
const DADO = 80;                                 // mässingslisten över bröstpanelen av grön marmor
const WIN_A = { x0: 14, x1: 58, top: 30, bot: 92 };   // bågfönstren (glaset)
const WIN_B = { x0: 122, x1: 166, top: 30, bot: 92 };
const DOOR = { x0: 66, x1: 114, top: 42 };       // karusselldörrens trumma
const DOOR_X = 90;
const CLOCK = { x: 90, y: 21, r: 7 };            // klockan över dörren
const PILS = [172, 476];                         // pilastrarna (vänsterkant, 12 breda)
const CNT = { x0: 186, x1: 474, top: 118, face: 128, base: 150 }; // kassadisken
const GLASS_TOP = 76;                            // mässingsramen överst på glasrutorna
const WINS = [0, 1, 2].map((i) => ({ i, x0: CNT.x0 + i * 96, x1: CNT.x0 + (i + 1) * 96, cx: CNT.x0 + i * 96 + 48 }));
const TELLER_Y = 125;                            // kassörernas fötter (bakom disken)
const GRILLE = { dx: 19, y: GLASS_TOP + 27 };    // talgallret i glaset: vid sidan av kassören, inte framför ansiktet
const SERVE_Y = 162;                             // där kunden står vid luckan
const NAME_Y = 14;                               // guldbokstäverna PIXELBANKEN
const VAULT = { cx: 330, cy: 55, r: 20, ring: 6 };
const BOARD_L = { x0: 196, x1: 262, y0: 30, y1: 74 };  // sparräntan
const BOARD_R = { x0: 398, x1: 464, y0: 30, y1: 74 };  // valutan
const ATM = { x0: 496, x1: 532, top: 44 };
const ATM_SPOT = [514, WALL_Y + 12], ATM_WAIT = [514, 142];
const BORS = { x0: 540, x1: 600, y0: 32, y1: 78 };     // BÖRSEN-tavlan
const TICK = { x0: 543, x1: 597, y0: 67, y1: 75 };     // löpremsan nertill i tavlan
const PORTRAIT = { x0: 608, x1: 660, y0: 30, y1: 70 };
const CHAND = [118, 226, 434, 578];              // ljuskronorna
const RUNNER = { x0: 76, x1: 104, y1: 146 };     // röda löparen från dörren
const EMBLEM = { x: 404, y: 188, rx: 30, ry: 12 };
const PALM_L = { x: 24, base: 130 }, PALM_R = { x: 656, base: 210 };
const GUARD = { x: 150, y: 128 };
const PULPET = { x: 52, base: 176 };
const BENCH = { x: 126, base: 206 };
const BENCH_SEATS = [110, 142];
const POSTS = [198, 222, 246, 270, 294, 318];
const ROPES = [180, 198];
const LANE_Y = 190;
const QSLOTS = [306, 286, 266, 246, 226, 206].map((x) => [x, LANE_Y]);
const NEXT = { x: 338, base: 206 };              // NÄSTA KUND-skylten
const PIG = { x: 468, base: 206 };               // spargrisen
const BROCH = { x: 532, base: 172 };
const DESK = { x0: 560, x1: 640, base: 156 };
const ADV = { x: 600, y: 146 };                  // rådgivarens fötter (bakom skrivbordet)
const GUESTS = [[582, 178], [620, 178]];         // besöksstolarna (fotpunkt)

// allt man inte kan gå igenom (fotplanet)
const OBST = [
  [CNT.x0 - 3, WALL_Y - 6, CNT.x1 + 3, CNT.base + 1],
  [PILS[0] - 2, WALL_Y - 6, PILS[0] + 14, WALL_Y + 2],
  [PILS[1] - 2, WALL_Y - 6, PILS[1] + 14, WALL_Y + 2],
  [PALM_L.x - 9, PALM_L.base - 7, PALM_L.x + 9, PALM_L.base + 1],
  [GUARD.x - 6, GUARD.y - 5, GUARD.x + 6, GUARD.y + 1],
  [PULPET.x - 25, PULPET.base - 8, PULPET.x + 25, PULPET.base],
  [BENCH.x - 31, BENCH.base - 8, BENCH.x + 31, BENCH.base],
  [POSTS[0] - 2, ROPES[0] - 2, POSTS[5] + 2, ROPES[0] + 1],
  [POSTS[0] - 2, ROPES[1] - 2, POSTS[5] + 2, ROPES[1] + 1],
  [NEXT.x - 5, NEXT.base - 4, NEXT.x + 5, NEXT.base],
  [PIG.x - 11, PIG.base - 7, PIG.x + 11, PIG.base],
  [BROCH.x - 9, BROCH.base - 5, BROCH.x + 9, BROCH.base],
  [DESK.x0 - 3, WALL_Y - 6, W, DESK.base + 1],
  ...GUESTS.map(([x, b]) => [x - 7, b - 6, x + 7, b]),
  [PALM_R.x - 9, PALM_R.base - 7, W, PALM_R.base + 1],
];

// skyltarna på väggen som sparkontopanelen i hörnet helst inte ska täcka (världskoordinater)
const NAME_HW = Math.ceil(textW(BIG, 'PIXELBANKEN', 2) / 2);
const SIGNS = [
  [CLOCK.x - 16, CLOCK.y - 10, CLOCK.x + 16, CLOCK.y + 10],              // klockan med lagerkvistarna
  [DOOR.x0, DOOR.top - 7, DOOR.x1, DOOR.top],                             // baldakinen PIXELBANKEN över dörren
  [VAULT.cx - NAME_HW, NAME_Y - 1, VAULT.cx + NAME_HW, NAME_Y + 15],      // guldbokstäverna
  [BOARD_L.x0, BOARD_L.y0, BOARD_L.x1, BOARD_L.y0 + 12],                  // rubrikerna SPARKONTO och VALUTA
  [BOARD_R.x0, BOARD_R.y0, BOARD_R.x1, BOARD_R.y0 + 12],
  [(ATM.x0 + ATM.x1) / 2 - 13, ATM.top - 10, (ATM.x0 + ATM.x1) / 2 + 13, ATM.top + 10], // bankomatens skylt
  [BORS.x0, BORS.y0, BORS.x1, BORS.y0 + 11],
  [PORTRAIT.x0, PORTRAIT.y0, PORTRAIT.x1, PORTRAIT.y1],
];

// ================= färger =================
const OUT = 0x1e1a22;
const CREAM = [0x8e826a, 0xb8aa8c, 0xd8ccae, 0xece2c8, 0xfaf4e2];   // kalksten och ljus marmor
const GREEN = [0x0c221c, 0x163a2e, 0x245440, 0x387456, 0x5e9a7a];   // grön marmor
const BRASS = [0x4a3208, 0x7e5a1a, 0xb88a2a, 0xe0b850, 0xfff0a0];
const MAHOG = [0x220e08, 0x3a180c, 0x5a2814, 0x7c3a1e, 0xa0522c];
const STEEL = [0x2a2e34, 0x4a5058, 0x767e88, 0xa8b0ba, 0xdae0e6];
const VELVET = [0x3e0a12, 0x6a1220, 0x9a2032, 0xc83a4c, 0xe8707e];
const DRAPE = [0x081a14, 0x10302a, 0x1a4a3c, 0x2a6652, 0x46866e];
const NAVY = [0x0a1222, 0x14203a, 0x203252, 0x324a72, 0x56709a];
const LEAF = [0x0e2a14, 0x1a4422, 0x28602c, 0x3a7e38, 0x5a9e46, 0x8cc462];
const LEATHER = [0x2e0c0c, 0x4e1614, 0x72221c, 0x943428, 0xb85a44];
const PINK = [0x8a3a52, 0xc0607a, 0xe890a8, 0xf8b8c8, 0xfff0f4];
// småtypsnittet med mittpunkt och pil (som närbutikens)
const SM = { ...SMALL, '·': { rows: ['.', '.', '#', '.', '.'], up: [], w: 1 } };

// ================= små verktyg =================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const q = (t, x, y, n = 4) => clamp(Math.round(t * n + bayer(x, y) - 0.5), 0, n) / n;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// välj ton ur en palett; ordnad dithering bara i övergången mellan två toner
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
const rampOf = (c) => [mix(mul(c, 0.4), 0x160c26, 0.3), mix(mul(c, 0.7), 0x2a1f3a, 0.1), c, mix(c, 0xfff6e8, 0.32), mix(c, 0xffffff, 0.66)];
// skuggad låda: ljus överkant/vänsterkant, mörk högerkant/underkant
function sbox(P, x, y, w, h, c) {
  const r = rampOf(c);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let k = r[2];
    if (j === 0) k = r[3]; else if (j === h - 1) k = r[1]; else if (i === 0) k = r[3]; else if (i === w - 1) k = r[1];
    P.px(x + i, y + j, k);
  }
  if (w > 2 && h > 2) P.px(x, y, r[4]);
}
function disc(P, cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, c, a);
  }
}
// snedställda reflexstrimmor på glas
function glare(P, x, y, w, h, a = 0.25, step = 13, seed = 0, inside = null) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (inside && !inside(x + i, y + j)) continue;
    const d = (i + j + seed * 5) % step;
    if (d < 2) P.px(x + i, y + j, 0xffffff, a); else if (d === 3) P.px(x + i, y + j, 0xffffff, a * 0.45);
  }
}
// slagskugga på golvet – bara på tomma pixlar (läggs sist)
function groundShadow(P, cx, cy, rx, ry, a = 0.3) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const tt = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (tt >= 1) continue;
    const xx = x - P.ox, yy = y - P.oy;
    if (xx < 0 || yy < 0 || xx >= P.w || yy >= P.h || P.d[(yy * P.w + xx) * 4 + 3]) continue;
    const k = clamp(Math.round((1 - tt) * 3 + bayer(x, y) - 0.5), 0, 3) / 3;
    if (k > 0) P.px(x, y, 0x0a0c18, a * (0.4 + 0.6 * k));
  }
}
// mörk kontur runt allt målat: hård nedtill/höger, mjukare upptill/vänster
function outline(P, dark = OUT, softA = 0.7) {
  const { w, h, d } = P;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = on(x, y - 1) || on(x - 1, y), soft = on(x, y + 1) || on(x + 1, y);
    if (hard || soft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, dark, add[i + 2] ? 1 : softA);
}
// förmålad bild i världskoordinater
function sprite(x0, y0, w, h, fn) {
  const P = new Pix(w, h, x0, y0);
  fn(P);
  return { img: P.flush(), x: x0, y: y0, w, h };
}
const put = (ctx, s) => ctx.drawImage(s.img, s.x, s.y);
// förmålad bild med ankare (fotpunkt) – ritas med putA(ctx, s, x, golvlinje)
function spr(w, h, ax, ay, fn, line = true) {
  const P = new Pix(w, h);
  fn(P);
  if (line) outline(P, OUT, 0.7);
  return { img: P.flush(), ax, ay, w, h };
}
const putA = (ctx, s, x, base) => ctx.drawImage(s.img, Math.round(x - s.ax), Math.round(base - s.ay));
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
// marmorns ådring: nära 0 = en åder
function marble(x, y, seed, s = 1) {
  const n = vnoise(x, y, 11 * s, seed) * 0.65 + vnoise(x, y, 4 * s, seed + 7) * 0.35;
  return Math.abs(Math.sin(x * 0.07 / s + y * 0.19 / s + n * 6.5));
}
function clearPx(P, x, y) {
  x = Math.floor(x) - P.ox; y = Math.floor(y) - P.oy;
  if (x < 0 || y < 0 || x >= P.w || y >= P.h) return;
  P.d[(y * P.w + x) * 4 + 3] = 0;
}
const alphaAt = (P, x, y) => { x = Math.floor(x) - P.ox; y = Math.floor(y) - P.oy; return x < 0 || y < 0 || x >= P.w || y >= P.h ? 0 : P.d[(y * P.w + x) * 4 + 3]; };
// guld i relief: varje rad får sin ton ur mässingsrampen (ljus upptill), mörk skugga snett nedanför
function goldText(P, F, s, x, y, scale = 1, shadow = 0x3a2408) {
  const h = F.h * scale;
  eachTextPixel(F, s, x + 1, y + 1, scale, (px, py) => P.px(px, py, shadow, 0.85));
  eachTextPixel(F, s, x, y, scale, (px, py) => { const k = (py - y) / h; P.px(px, py, k < 0.22 ? BRASS[4] : k < 0.5 ? BRASS[3] : k < 0.8 ? BRASS[2] : BRASS[1]); });
}
const cxText = (F, s, cx, scale = 1) => Math.round(cx - textW(F, s, scale) / 2);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ================= utsikten: finanskvarteret genom fönstren och dörren =================
// Målas bakom rummet (rummets glas är genomskinligt). Höghusen står på andra sidan gatan:
// de flesta är så höga att de går ur bild, några lägre med himmel ovanför och ett med spira.
const OUT_W = 188;
const TOWERS_FAR = [[2, 44, 14], [20, 36, 12], [40, 50, 16], [58, 40, 10], [76, 34, 18], [98, 46, 12], [116, 38, 16], [138, 30, 14], [158, 42, 16], [174, 36, 14]];
const TOWERS = [
  { x: 0, w: 22, top: 10, c: 0x4e7090 },
  { x: 24, w: 26, top: 46, c: 0x8a7e6c, stone: true },
  { x: 53, w: 30, top: 2, c: 0x3e6488 },
  { x: 86, w: 24, top: 54, c: 0x96867a, stone: true },
  { x: 112, w: 34, top: 8, c: 0x45709a },
  { x: 149, w: 24, top: 40, c: 0x587890, spire: true },
  { x: 175, w: 13, top: 18, c: 0x4a6a8a },
];
const SPIRE = { x: 149 + 12, y: 26 };            // antennen med det röda ljuset
function cloud(P, cx, cy, s) {
  for (const [dx, dy, rx, ry] of [[0, 0, 9, 3.5], [-7, 1, 6, 2.5], [8, 1, 7, 2.5], [2, -2, 5, 3]]) disc(P, cx + dx * s, cy + dy * s, rx * s, ry * s, 0xffffff, 0.55);
  for (let x = Math.floor(cx - 12 * s); x < cx + 13 * s; x++) P.px(x, Math.round(cy + 3 * s), 0xc8d8e8, 0.35);
}
function paintTower(P, T, night) {
  const { x, w, top, c } = T, bot = 88;
  for (let y = top; y < bot; y++) for (let i = 0; i < w; i++) {
    const X = x + i;
    let col;
    if (T.stone) { // äldre stenhus: fönsterrader med vita omfattningar
      col = night ? 0x2a2630 : mix(c, 0xe8dcc8, 0.35);
      const wy = (y - top) % 7, wx = i % 5;
      if (wy >= 2 && wy <= 5 && wx >= 1 && wx <= 3) {
        col = night ? (hash(X >> 2, ((y - top) / 7) | 0, 311 + x) > 0.5 ? 0xffd070 : 0x1a1e2a) : (wy === 2 ? 0xf0ece0 : 0x3a4a5c);
        if (!night && wy === 3 && wx === 1) col = 0x8ab0d0; // himlen speglas i rutan
      }
      if ((y - top) === 0 || (y - top) === 1) col = night ? 0x3a3640 : mix(c, 0xffffff, 0.45); // takfris
    } else { // glasfasad: blå spegling, våningsband och profiler
      const tt = (y - top) / (bot - top);
      col = night ? mix(0x141c30, 0x0c1222, tt) : mix(mix(c, 0xb8dcf8, 0.3), c, tt);
      if (!night && ((i + (y >> 1)) % 13) < 2) col = mix(col, 0xe8f6ff, 0.4);
      if ((y - top) % 4 === 0) col = night ? 0x0a0e1a : mul(col, 0.76);
      else if (i % 6 === 0) col = night ? 0x0c1220 : mul(col, 0.86);
      else if (night && hash(X >> 1, (y - top) >> 2, 312 + x) > 0.78) col = hash(X, y, 313) > 0.3 ? 0xffe08a : 0x9ad0ff;
    }
    if (i === 0) col = mix(col, 0xffffff, night ? 0.05 : 0.28);   // solen från vänster
    if (i === w - 1) col = mul(col, 0.7);
    P.px(X, y, col);
  }
  P.hl(x, top, w, night ? 0x3a4050 : 0xe8f0f6);
  if (T.spire) {
    P.rect(x + 8, top - 5, w - 16, 5, night ? 0x222838 : mix(c, 0xffffff, 0.2));
    P.vl(SPIRE.x, SPIRE.y, top - 5 - SPIRE.y, night ? 0x4a5060 : 0xc8d0d8);
    P.px(SPIRE.x, SPIRE.y, 0xd83030);
  }
}
function paintOutside(night) {
  const P = new Pix(OUT_W, WALL_Y);
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < OUT_W; x++) {
    P.px(x, y, night ? mix(0x080c1e, 0x1e2650, q(y / 84, x, y, 6)) : mix(0x5a9ad8, 0xd8ecf6, q(y / 84, x, y, 6)));
  }
  if (!night) { cloud(P, 36, 38, 1); cloud(P, 140, 33, 0.8); cloud(P, 96, 44, 0.6); }
  else for (let k = 0; k < 50; k++) P.px(hash(k, 1, 301) * OUT_W | 0, 26 + hash(k, 2, 301) * 26 | 0, 0xe8ecff, 0.35 + hash(k, 3, 301) * 0.5);
  // bortre höghus i disen
  for (const [x, top, w] of TOWERS_FAR) for (let y = top; y < 88; y++) for (let i = 0; i < w; i++) {
    let c = night ? 0x181e36 : mix(0xa6c2da, 0x94b0c8, (y - top) / 60);
    if (!night && i === 0) c = mix(c, 0xdceaf4, 0.5);
    if (night && i % 3 === 1 && y % 4 === 1 && hash(x + i, y, 302) > 0.7) c = 0xc8a860;
    if (!night && (y - top) % 5 === 0) c = mul(c, 0.94);
    P.px(x + i, y, c);
  }
  for (const T of TOWERS) paintTower(P, T, night);
  // gatan: bortre trottoaren, körbanan med mittlinje, kantsten, närmaste trottoaren
  for (let x = 0; x < OUT_W; x++) {
    for (let y = 88; y < 91; y++) P.px(x, y, night ? 0x3a3a44 : (y === 88 ? 0xc8c4b8 : 0xa8a498));
    P.px(x, 91, night ? 0x2a2a30 : 0x6a665e);
    for (let y = 92; y < 101; y++) P.px(x, y, night ? 0x1c1e24 : mix(0x4a4c52, 0x3e4046, (y - 92) / 9));
    if (((x >> 2) & 3) === 0) P.px(x, 96, night ? 0x8a8466 : 0xe8e0c0);
    P.px(x, 101, night ? 0x5a5a60 : 0x9a968c);
    for (let y = 102; y < WALL_Y; y++) P.px(x, y, (x % 10 === 0 || (y - 102) % 5 === 0) ? (night ? 0x3a3a40 : 0x9a968a) : (night ? 0x4a4a52 : 0xbcb8ac));
  }
  // gatlykta vid dörren (utanför)
  P.rect(62, 58, 2, 44, night ? 0x2a2a30 : 0x3a3a40); P.rect(59, 55, 8, 4, night ? 0xffe8a0 : 0xe8e0c8); P.hl(59, 54, 8, 0x2a2a30);
  return P.flush();
}
// bilarna på gatan utanför (syns i dörren och i fönstrens underkant)
const CAR_COLS = [0xc9323a, 0x3a7bd5, 0xf0ece0, 0xf0c020, 0x2d3a5c, 0x46a35a, 0x1e1e24];
function paintCar(col, flip, taxi = false) {
  const P = new Pix(30, 14);
  const r = rampOf(col);
  for (let y = 5; y < 11; y++) for (let x = 1; x < 29; x++) P.px(x, y, y === 5 ? r[3] : y > 8 ? r[1] : r[2]);  // karossen
  for (let y = 1; y < 5; y++) for (let x = 7 + (5 - y); x < 22 - (5 - y) + 1; x++) P.px(x, y, y === 1 ? r[3] : r[2]); // taket
  for (let y = 2; y < 5; y++) for (let x = 9 + (5 - y); x < 20 - (5 - y) + 1; x++) if (x !== 15) P.px(x, y, 0x9ac0dc); // rutorna
  if (taxi) { P.rect(13, 0, 4, 1, 0xfff4a0); }
  P.rect(27, 6, 2, 2, 0xfff4c0); P.rect(1, 6, 1, 2, 0xd83030);  // lyktorna
  for (const wx of [7, 22]) { disc(P, wx, 11, 2.5, 2.5, 0x16161a); P.px(wx, 11, 0x8a8a90); }
  outline(P, 0x16141a, 0.6);
  if (!flip) return P.flush();
  const F = new Pix(30, 14);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 30; x++) { const i = (y * 30 + x) * 4; if (P.d[i + 3]) F.px(29 - x, y, (P.d[i] << 16) | (P.d[i + 1] << 8) | P.d[i + 2], P.d[i + 3] / 255); }
  return F.flush();
}

// ================= bankhallen (bakgrunden) =================
function paintFloor(P) {
  const X0 = SIDE, X1 = W - SIDE, B = 7; // B = kantbandet av grön marmor
  for (let y = WALL_Y - 1; y < H; y++) for (let x = X0; x < X1; x++) {
    let c;
    const border = y < WALL_Y + B || x < X0 + B || x >= X1 - B;
    if (border) {
      c = tone(GREEN, 0.42 + (vnoise(x, y, 7, 62) - 0.5) * 0.35, x, y);
      const v = marble(x, y, 61);
      if (v < 0.05) c = GREEN[4]; else if (v < 0.1) c = mix(c, GREEN[3], 0.6);
      // mässingslisten mot rutfältet
      if (y === WALL_Y + B - 1 && x >= X0 + B - 1 && x < X1 - B + 1) c = BRASS[3];
      else if ((x === X0 + B - 1 || x === X1 - B) && y >= WALL_Y + B - 1) c = BRASS[2];
    } else {
      // stora ljusa marmorplattor (24×12) med svarta diamanter i korsningarna
      const tx = x - (X0 + B), ty = y - (WALL_Y + B);
      const col = Math.floor(tx / 24), row = Math.floor(ty / 12), lx = tx - col * 24, ly = ty - row * 12;
      let base = mix(0xe2d8c2, 0xf0e8d6, hash(col, row, 63) * 0.7);
      const v = marble(x + col * 29, y + row * 17, 64 + ((col * 3 + row) & 3));
      if (v < 0.045) base = mix(base, 0x8a8068, 0.5); else if (v < 0.1) base = mix(base, 0xb0a68e, 0.3);
      if (lx === 0 || ly === 0) base = mix(base, 0x9a8e74, 0.5);
      else if (lx === 1 || ly === 1) base = mix(base, 0xffffff, 0.25);
      const dx = Math.min(lx, 24 - lx), dy = Math.min(ly, 12 - ly), dd = dx / 5 + dy / 2.5;
      if (dd <= 1) base = dd <= 0.4 ? 0x2c4a3c : (lx > 12 || ly > 6 ? 0x12241c : 0x1a3228);
      c = base;
    }
    P.px(x, y, c);
  }
  // karusselldörrens golvplatta (mässingsring framför trumman)
  for (let y = WALL_Y - 1; y < WALL_Y + 6; y++) for (let x = DOOR.x0 - 2; x < DOOR.x1 + 2; x++) {
    const d = Math.hypot((x + 0.5 - DOOR_X) / 26, (y + 0.5 - WALL_Y) / 6);
    if (d > 1) continue;
    P.px(x, y, d > 0.86 ? BRASS[3] : d > 0.78 ? BRASS[1] : tone([0x2a2622, 0x3e3830, 0x524a40], 0.5 + (x & 1) * 0.3, x, y));
  }
  // löparen från dörren: vinröd sammet med guldkant och fransar
  for (let y = WALL_Y + 5; y < RUNNER.y1; y++) for (let x = RUNNER.x0; x < RUNNER.x1; x++) {
    const ex = Math.min(x - RUNNER.x0, RUNNER.x1 - 1 - x), ey = RUNNER.y1 - 1 - y;
    let c = tone(VELVET, 0.42 + (hash(x, y, 71) - 0.5) * 0.14, x, y);
    if (ex === 0 || ey === 0) c = VELVET[0];
    else if (ex === 2 || ey === 2) c = BRASS[3];
    else if (ex > 3 && ey > 3 && (x - RUNNER.x0 + y) % 6 === 0 && (y % 6) < 3) c = VELVET[3];
    P.px(x, y, c);
  }
  for (let x = RUNNER.x0 + 1; x < RUNNER.x1 - 1; x += 2) { P.px(x, RUNNER.y1, BRASS[3]); P.px(x, RUNNER.y1 + 1, BRASS[2]); }
  // köns startlinje: mässing i golvet vid köns huvud
  for (let y = ROPES[0] + 2; y < ROPES[1] - 1; y++) { P.px(POSTS[5] + 6, y, BRASS[3]); P.px(POSTS[5] + 7, y, BRASS[1]); }
  // bankens kompassros inlagd i golvet
  const E = EMBLEM;
  for (let y = E.y - E.ry - 1; y <= E.y + E.ry + 1; y++) for (let x = E.x - E.rx - 1; x <= E.x + E.rx + 1; x++) {
    const nx = (x + 0.5 - E.x) / E.rx, ny = (y + 0.5 - E.y) / E.ry, r = Math.hypot(nx, ny);
    if (r > 1) continue;
    let c;
    if (r > 0.9) c = GREEN[1];
    else if (r > 0.84) c = BRASS[3];
    else if (r > 0.79) c = GREEN[2];
    else {
      const a = Math.atan2(ny, nx);
      const rs = Math.max(0.14 + 0.62 * Math.abs(Math.cos(2 * a)) ** 10, 0.14 + 0.38 * Math.abs(Math.sin(2 * a)) ** 10);
      if (r < 0.1) c = GREEN[3];
      else if (r < rs) c = Math.sin(a * 8) > 0 ? BRASS[4] : BRASS[2];
      else c = Math.abs(r - 0.55) < 0.04 ? GREEN[2] : mix(0xefe6d2, 0xfaf4e6, hash(x, y, 72) * 0.5);
    }
    P.px(x, y, c);
  }
}
function paintWall(P) {
  for (let y = CEIL; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y < DADO - 2) { // kalksten i kvadrar
      const ry = y - CEIL, row = Math.floor(ry / 11), ly = ry - row * 11;
      const off = row & 1 ? 16 : 0, col = Math.floor((x + off) / 32), lx = (x + off) - col * 32;
      c = mix(0xdfd0ae, 0xece2c6, hash(col, row, 41) * 0.8);
      c = mix(c, 0xcbbb96, Math.max(0, vnoise(x, y, 5, 42) - 0.5) * 0.6);
      if (hash(x, y, 43) > 0.94) c = mul(c, 0.95);
      if (ly === 0) c = 0xb4a27e; else if (ly === 1) c = mix(c, 0xfff6e0, 0.35);
      if (lx === 0) c = 0xbcaa86; else if (lx === 1) c = mix(c, 0xfff6e0, 0.22);
      c = mix(c, 0x5a4a34, Math.max(0, 1 - (y - CEIL) / 9) * 0.4); // skugga under taklisten
    } else if (y < DADO) c = y === DADO - 2 ? BRASS[4] : BRASS[2];  // mässingslisten
    else if (y >= WALL_Y - 4) c = y === WALL_Y - 4 ? GREEN[3] : tone(GREEN, 0.18, x, y); // sockeln
    else { // bröstpanel av grön marmor i fält om 48 px
      const px = x % 48, py = y - DADO, ph = WALL_Y - 4 - DADO;
      const inF = px >= 3 && px <= 44 && py >= 3 && py <= ph - 4;
      c = tone(GREEN, inF ? 0.52 : 0.3, x, y);
      const v = marble(x, y, 51);
      if (v < 0.06) c = GREEN[4]; else if (v < 0.13) c = mix(c, GREEN[3], 0.5);
      if (px >= 2 && px <= 45 && py >= 2 && py <= ph - 3) {
        if (px === 2 || py === 2) c = GREEN[1];
        else if (px === 45 || py === ph - 3) c = GREEN[4];
      }
      if (y === DADO) c = mix(c, 0x000000, 0.35);
    }
    P.px(x, y, c);
  }
}
function paintCeiling(P) {
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < 3; y++) P.px(x, y, mix(0x2a1e16, 0x4a3828, y / 3)); // kassettaket
    if (x % 28 === 14) { P.px(x, 1, BRASS[4]); P.px(x - 1, 1, BRASS[2]); P.px(x + 1, 1, BRASS[2]); P.px(x, 0, BRASS[1]); P.px(x, 2, BRASS[1]); }
    P.px(x, 3, BRASS[3]);                                         // pärlstav
    const k = x % 5;                                              // äggstav
    for (let y = 4; y < 8; y++) {
      let c = 0xe6dcc0;
      if (k === 4) c = y === 7 ? 0x5a4a30 : 0x7a6a4a;
      else if (y === 4 || y === 7) c = mix(0xe6dcc0, 0x6a5a40, 0.4);
      else if (k === 0) c = 0xfff6e0; else if (k === 3) c = 0xb8aa88;
      P.px(x, y, c);
    }
    P.px(x, 8, BRASS[2]);
    for (let y = 9; y < CEIL; y++) P.px(x, y, (x % 4 < 2) ? (y === 9 ? 0xf2e8d0 : 0xd4c8aa) : 0x4a3c28); // tandsnitt
  }
}
// ---------- bågfönstren ----------
function archIn(Wn, x, y, g = 0) {
  const cx = (Wn.x0 + Wn.x1) / 2, r = (Wn.x1 - Wn.x0) / 2, sy = Wn.top + r;
  if (y > Wn.bot + g) return false;
  if (y >= sy) return x >= Wn.x0 - g && x < Wn.x1 + g;
  return Math.hypot(x + 0.5 - cx, y + 0.5 - sy) <= r + g;
}
function paintWindow(P, Wn, night, seed) {
  const cx = (Wn.x0 + Wn.x1) / 2, r = (Wn.x1 - Wn.x0) / 2, sy = Wn.top + r;
  // stenomfattningen: profilerad list runt glaset, djup smyg närmast
  for (let y = Wn.top - 5; y <= Wn.bot; y++) for (let x = Wn.x0 - 5; x < Wn.x1 + 5; x++) {
    if (!archIn(Wn, x, y, 4) || archIn(Wn, x, y, 0)) continue;
    const d = archIn(Wn, x, y, 1) ? 1 : archIn(Wn, x, y, 2) ? 2 : archIn(Wn, x, y, 3) ? 3 : 4;
    P.px(x, y, [0, 0x7a6a4a, 0xb4a482, 0xf6ecd4, 0xc8b894][d]);
  }
  sbox(P, Math.round(cx) - 3, Wn.top - 7, 7, 6, 0xe8dcbc);          // slutstenen
  P.hl(Math.round(cx) - 2, Wn.top - 5, 5, 0xc8b894);
  // glaset: genomskinligt (utsikten ritas under rummet) med en svag ton
  const inG = (x, y) => archIn(Wn, x, y, 0);
  for (let y = Wn.top; y <= Wn.bot; y++) for (let x = Wn.x0; x < Wn.x1; x++) {
    if (!inG(x, y)) continue;
    clearPx(P, x, y);
    P.px(x, y, night ? 0x0a1024 : 0xe8f4fc, night ? 0.16 : 0.1);
  }
  glare(P, Wn.x0, Wn.top, Wn.x1 - Wn.x0, Wn.bot - Wn.top + 1, night ? 0.06 : 0.16, 17, seed, inG);
  // spröjsar: lodrät mitt, vågräta vid bågens fot och nertill, solfjäder i bågen
  const bar = (x, y, c = 0x2e2214) => { if (inG(x, y)) P.px(x, y, c); };
  for (let y = Wn.top; y <= Wn.bot; y++) { bar(Math.floor(cx), y); bar(Math.floor(cx) + 1, y, 0x6a5030); }
  for (let x = Wn.x0; x < Wn.x1; x++) { bar(x, Math.floor(sy)); bar(x, Math.floor(sy) + 1, 0x6a5030); bar(x, Wn.bot - 19); bar(x, Wn.bot - 18, 0x6a5030); }
  for (const a of [Math.PI * 0.25, Math.PI * 0.75]) for (let k = 0; k < r; k += 0.5) bar(Math.round(cx + Math.cos(a) * k), Math.round(sy - Math.sin(a) * k));
  for (let a = 0; a <= Math.PI; a += 0.05) bar(Math.round(cx + Math.cos(a) * r * 0.45), Math.round(sy - Math.sin(a) * r * 0.45));
  // fönsterbänken
  sbox(P, Wn.x0 - 6, Wn.bot + 1, Wn.x1 - Wn.x0 + 12, 3, 0xe8dcbc);
  // draperistången och sammetsdraperierna, uppknutna med guldtofsar
  const ry = Wn.top - 9;
  P.hl(Wn.x0 - 7, ry, Wn.x1 - Wn.x0 + 14, BRASS[3]); P.hl(Wn.x0 - 7, ry + 1, Wn.x1 - Wn.x0 + 14, BRASS[1]);
  disc(P, Wn.x0 - 8, ry + 0.5, 1.6, 1.6, BRASS[3]); disc(P, Wn.x1 + 7, ry + 0.5, 1.6, 1.6, BRASS[3]);
  const tie = Wn.bot - 26;
  for (const side of [-1, 1]) {
    const edge = side < 0 ? Wn.x0 - 3 : Wn.x1 + 2;             // draperiets yttre kant
    for (let y = ry + 2; y < WALL_Y - 6; y++) {
      const w = y < tie ? Math.round(5 + 6 * (1 - (y - ry) / (tie - ry)) ** 1.5) : y < tie + 3 ? 4 : Math.round(4 + (y - tie - 3) / 7);
      for (let i = 0; i < w; i++) {
        const x = edge - side * i;
        const f = 0.5 + 0.38 * Math.sin(i * 1.7 + (y < tie ? (y - ry) * 0.06 * side : 0));
        let c = tone(DRAPE, f - (i === w - 1 ? 0.2 : 0), x, y);
        if (y === ry + 2) c = DRAPE[4];
        P.px(x, y, c);
      }
    }
    // tofsen
    const tx = edge - side * 2;
    disc(P, tx, tie + 1, 2, 1.6, BRASS[3]); P.px(tx - 1, tie, BRASS[4]);
    for (let k = 0; k < 5; k++) P.px(tx - 1 + (k % 3), tie + 3 + (k >> 1), k & 1 ? BRASS[2] : BRASS[3]);
  }
}
// ---------- karusselldörren ----------
function paintDoor(P, night) {
  const { x0, x1, top } = DOOR;
  // stenportalen: smala smygar och ett överstycke
  for (let y = top - 10; y < WALL_Y; y++) for (let x = x0 - 3; x < x1 + 3; x++) {
    if (x >= x0 && x < x1 && y >= top - 6) continue;
    const e = x < x0 ? x - (x0 - 3) : x >= x1 ? (x1 + 2) - x : 3;
    P.px(x, y, y < top - 6 ? (y === top - 10 ? 0xf6ecd4 : y === top - 7 ? 0x9a8a68 : 0xe0d4b4) : [0xf6ecd4, 0xd8ccac, 0x9a8a68, 0x9a8a68][clamp(e, 0, 3)]);
  }
  // baldakinen i mässing med bankens namn
  for (let y = top - 6; y < top; y++) for (let x = x0; x < x1; x++) P.px(x, y, tone(BRASS, [0.95, 0.75, 0.6, 0.5, 0.35, 0.15][y - top + 6], x, y));
  text(P, SMALL, 'PIXELBANKEN', cxText(SMALL, 'PIXELBANKEN', DOOR_X), top - 5, 0x2a1c08);
  // trumman: glas runt om (genomskinligt), mörkt tak och kanter
  for (let y = top; y < WALL_Y; y++) for (let x = x0; x < x1; x++) {
    clearPx(P, x, y);
    P.px(x, y, night ? 0x0a1024 : 0xe0f0f8, night ? 0.2 : 0.12);
  }
  for (let x = x0; x < x1; x++) { P.px(x, top, 0x2a1e10); P.px(x, top + 1, BRASS[1]); P.px(x, top + 2, 0x000000, 0.35); }
  // den välvda glasväggen: ramstolpar och ljusa reflexband där glaset böjer sig
  for (const [x, c] of [[x0, BRASS[1]], [x0 + 1, BRASS[3]], [x0 + 8, BRASS[2]], [x1 - 9, BRASS[2]], [x1 - 2, BRASS[3]], [x1 - 1, BRASS[1]]]) P.vl(x, top + 1, WALL_Y - top - 1, c);
  for (let y = top + 3; y < WALL_Y - 1; y++) { P.px(x0 + 3, y, 0xffffff, night ? 0.08 : 0.3); P.px(x0 + 4, y, 0xffffff, night ? 0.05 : 0.15); P.px(x1 - 5, y, 0xffffff, night ? 0.06 : 0.2); }
  // öppettiderna etsade i glaset
  const op = `ÖPPET ${HOURS[0]}-${HOURS[1]}`, ow = textW(SMALL, op), ox = cxText(SMALL, op, DOOR_X);
  P.rect(ox - 3, top + 6, ow + 6, 9, 0x0e2a20, 0.9); P.box(ox - 3, top + 6, ow + 6, 9, BRASS[2]);
  text(P, SMALL, op, ox, top + 8, 0xf0d070);
  // klockan över dörren (visarna ritas levande), med förgyllda lagerkvistar
  const { x, y, r } = CLOCK;
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) { P.px(x + s * (r + 3 + k), y + 3 - (k >> 1), BRASS[3]); P.px(x + s * (r + 3 + k), y + 2 - (k >> 1), k & 1 ? BRASS[4] : LEAF[3]); }
  disc(P, x, y, r + 2, r + 2, BRASS[1]); disc(P, x - 0.5, y - 0.5, r + 1.4, r + 1.4, BRASS[3]); disc(P, x, y, r, r, 0xf8f2e2);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(x + Math.sin(a) * (r - 1)), Math.round(y - Math.cos(a) * (r - 1)), k % 3 ? 0x8a8070 : 0x1e1a22); }
}
// ---------- pilastrarna ----------
function paintPilaster(P, x0) {
  const w = 12;
  for (let y = CEIL; y < WALL_Y; y++) { P.px(x0 + w, y, 0x000000, 0.2); P.px(x0 + w + 1, y, 0x000000, 0.08); } // slagskugga
  for (let y = CEIL + 8; y < WALL_Y - 10; y++) for (let i = 0; i < w; i++) {
    let c = tone(CREAM, 0.78 - i / w * 0.4, x0 + i, y);
    if (i > 0 && i < w - 1 && i % 3 === 1) c = mul(c, 0.82);   // räfflorna
    if (i === 0) c = CREAM[4]; else if (i === w - 1) c = CREAM[1];
    if (marble(x0 + i, y, 81) < 0.05) c = mix(c, 0x9a8e76, 0.4);
    P.px(x0 + i, y, c);
  }
  // kapitälet: förgyllt, bredare, med volutsnäckor och bladrad
  for (let y = CEIL; y < CEIL + 8; y++) for (let i = -2; i < w + 2; i++) {
    const k = (y - CEIL) / 8;
    let c = tone(BRASS, 0.85 - k * 0.45 - (i + 2) / (w + 4) * 0.25, x0 + i, y);
    if (y === CEIL || y === CEIL + 7) c = BRASS[1];
    if (y === CEIL + 5 && (i + 2) % 3 === 0) c = BRASS[1];
    P.px(x0 + i, y, c);
  }
  for (const vx of [x0 - 2, x0 + w]) { P.rect(vx, CEIL + 1, 2, 3, BRASS[4]); P.px(vx + (vx < x0 ? 1 : 0), CEIL + 2, BRASS[0]); }
  // basen: grön marmorsockel med mässingsband
  for (let y = WALL_Y - 10; y < WALL_Y; y++) for (let i = -2; i < w + 2; i++) {
    let c = tone(GREEN, 0.55 - (i + 2) / (w + 4) * 0.35, x0 + i, y);
    if (y === WALL_Y - 10) c = BRASS[4]; else if (y === WALL_Y - 9) c = BRASS[2]; else if (y === WALL_Y - 8) c = BRASS[1];
    P.px(x0 + i, y, c);
  }
}
// ---------- valvet: runda stålramen, bankfacken, guldet och den öppna dörren ----------
function paintVault(P) {
  const { cx, cy, r, ring } = VAULT, R = r + ring;
  for (let y = cy - R - 1; y <= cy + R + 1; y++) for (let x = cx - R - 1; x <= cx + R + 1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > R + 0.5 || d <= r) continue;
    const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
    const lit = -Math.cos(a + Math.PI / 4);                // ljus från övre vänster
    let v = 0.52 + lit * 0.28;
    if (d > R - 1.2) v -= 0.3; else if (d < r + 1.3) v -= 0.25; else if (d < r + 2.3) v += 0.12;
    P.px(x, y, tone(STEEL, v, x, y));
  }
  for (let k = 0; k < 16; k++) {                           // nitarna
    const a = k / 16 * Math.PI * 2, nx = Math.round(cx + Math.cos(a) * (r + ring / 2)), ny = Math.round(cy + Math.sin(a) * (r + ring / 2));
    P.px(nx, ny, STEEL[4]); P.px(nx + 1, ny + 1, STEEL[0]);
  }
  const inner = r * 0.72, fy = Math.round(cy + inner * 0.3);   // bakväggen och golvlinjen inne i valvet
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > r) continue;
    let c;
    if (d > inner) c = tone(STEEL, 0.1 + (1 - (d - inner) / (r - inner)) * 0.3 + (y < cy ? 0.08 : 0), x, y);  // tunnelns väggar
    else if (y < fy) {                                     // bankfacken
      const bx = (x - Math.floor(cx - inner)) % 6, by = (y - Math.floor(cy - inner)) % 5;
      c = bx === 0 || by === 0 ? 0x3a4048 : by === 1 ? 0xb4bcc6 : 0x848c96;
      if (bx === 3 && by === 3) c = BRASS[3];
    } else c = tone([0x3a3024, 0x5a4a38, 0x7a6448, 0x9a8058], 0.35 + (y - fy) / (r - inner + 6), x, y); // golvet
    P.px(x, y, c);
  }
  P.ell(cx, cy - 2, inner, inner * 0.8, 0xffe8b0, 0.2, 4);   // varmt ljus därinne
  // guldtackor i en pyramid och två pengasäckar
  const gbar = (x, y) => { P.rect(x, y, 6, 3, BRASS[3]); P.hl(x + 1, y, 4, BRASS[4]); P.hl(x, y + 2, 6, BRASS[1]); P.px(x + 5, y + 1, BRASS[2]); };
  const gy = fy + 5;
  gbar(cx - 12, gy + 3); gbar(cx - 6, gy + 3); gbar(cx, gy + 3); gbar(cx - 9, gy); gbar(cx - 3, gy); gbar(cx - 6, gy - 3);
  for (const [sx, sy] of [[cx + 9, gy + 3], [cx + 14, gy + 4]]) {
    disc(P, sx, sy, 3.4, 3, 0xb89a62); P.px(sx - 1, sy - 1, 0xd8bc84); P.rect(sx - 1, sy - 4, 3, 1, 0x7a6038); P.px(sx, sy - 5, 0xb89a62);
    P.px(sx - 1, sy + 1, 0x6a5030); P.px(sx + 1, sy + 1, 0x6a5030);
  }
  // den öppna dörren: stor rund ståldörr, uppsvängd på gångjärnet till höger, sedd snett
  const hx = cx + R, ex = hx + 9, rx = 7;
  for (let y = cy - 14; y <= cy + 14; y++) for (let x = hx - 1; x < hx + 3; x++) P.px(x, y, (y - cy) % 9 === 0 ? STEEL[0] : tone(BRASS, 0.55 - (x - hx) * 0.1, x, y)); // gångjärnet
  for (let y = cy - R; y <= cy + R; y++) {
    const s = Math.sqrt(Math.max(0, 1 - ((y + 0.5 - cy) / R) ** 2));
    const left = Math.round(ex - rx * s);
    for (let k = 1; k <= 4; k++) P.px(left - k, y, tone(STEEL, 0.28 + (k === 4 ? 0.25 : 0) + (y < cy ? 0.1 : 0), left - k, y)); // tjocka kanten
    for (let x = left; x <= Math.round(ex + rx * s); x++) {
      const nx = (x + 0.5 - ex) / rx, ny = (y + 0.5 - cy) / R, rr = Math.hypot(nx, ny);
      let v = 0.55 - nx * 0.18 - ny * 0.1;
      if (Math.abs(rr - 0.78) < 0.06 || Math.abs(rr - 0.5) < 0.06) v -= 0.22;
      if (rr < 0.14) v = 0.2;
      P.px(x, y, tone(STEEL, v, x, y));
    }
  }
  for (let k = -3; k <= 3; k++) {                          // låskolvarna sticker ut ur kanten
    const yy = cy + k * 7, s = Math.sqrt(Math.max(0, 1 - (k * 7 / R) ** 2)), lx = Math.round(ex - rx * s) - 9;
    P.rect(lx, yy - 1, 5, 3, STEEL[3]); P.hl(lx, yy - 1, 5, STEEL[4]); P.hl(lx, yy + 1, 5, STEEL[1]); P.px(lx, yy, STEEL[2]);
  }
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) for (let k = 0.14; k < 0.5; k += 0.03) { // ratten med tre ekrar
    P.px(Math.round(ex + Math.cos(a) * rx * k), Math.round(cy + Math.sin(a) * R * k), BRASS[3]);
  }
  disc(P, ex, cy, 1.5, 2.5, BRASS[4]);
}
// förgylld ram med mörk tavla inuti
function frame(P, x0, y0, x1, y1, fill = NAVY) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    let c;
    if (e === 0) c = BRASS[1];
    else if (e === 1) c = (x - x0 === 1 || y - y0 === 1) ? BRASS[4] : BRASS[2];
    else if (e === 2) c = BRASS[1];
    else c = tone(fill, 0.25 + (1 - (y - y0) / (y1 - y0)) * 0.25, x, y);
    P.px(x, y, c);
  }
  for (let x = x0 + 1; x < x1 + 1; x++) P.px(x, y1, 0x000000, 0.3);  // skugga på väggen
  for (let y = y0 + 1; y <= y1; y++) P.px(x1, y, 0x000000, 0.3);
}
// ---------- tavlan med sparräntan ----------
function paintRateBoard(P) {
  const { x0, x1, y0, y1 } = BOARD_L, cx = (x0 + x1) / 2;
  frame(P, x0, y0, x1, y1);
  goldText(P, SMALL, 'SPARKONTO', cxText(SMALL, 'SPARKONTO', cx), y0 + 5);
  // räntan i stora guldsiffror och ett eget procenttecken (typsnittets % blir grötigt i dubbel storlek)
  const num = pctTxt(), nw = textW(BIG, num, 2), sx = Math.round(cx - (nw + 14) / 2), sy = y0 + 13, px0 = sx + nw + 4;
  goldText(P, BIG, num, sx, sy, 2);
  const ring = (x, y) => { for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]]) { P.px(x + dx + 1, y + dy + 1, 0x3a2408, 0.85); P.px(x + dx, y + dy, dy < 2 ? BRASS[4] : BRASS[2]); } };
  for (let k = 0; k < 14; k++) {
    const x = px0 + 9 - Math.round(k * 9 / 13), y = sy + k;
    P.px(x + 1, y + 1, 0x3a2408, 0.85); P.px(x + 2, y + 1, 0x3a2408, 0.85);
    P.px(x, y, k < 4 ? BRASS[4] : k < 9 ? BRASS[3] : BRASS[2]); P.px(x + 1, y, k < 7 ? BRASS[3] : BRASS[1]);
  }
  ring(px0, sy); ring(px0 + 6, sy + 10);
  text(P, SMALL, 'RÄNTA VARJE', cxText(SMALL, 'RÄNTA VARJE', cx), y0 + 30, 0xe8e0c8);
  text(P, SMALL, 'MÅNDAG', cxText(SMALL, 'MÅNDAG', cx), y0 + 36, 0xe8e0c8);
}
// ---------- valutatavlan ----------
function flag(P, x, y, kind) {
  const F = {
    EUR: () => { P.rect(x, y, 6, 4, 0x2a3a9a); P.px(x + 2, y + 1, 0xf0d040); P.px(x + 3, y + 2, 0xf0d040); P.px(x + 3, y + 1, 0xf0d040); },
    USD: () => { for (let j = 0; j < 4; j++) P.hl(x, y + j, 6, j & 1 ? 0xf4f1ea : 0xc8323a); P.rect(x, y, 3, 2, 0x2a3a8a); },
    GBP: () => { P.rect(x, y, 6, 4, 0x1e2a7a); P.hl(x, y + 1, 6, 0xf4f1ea); P.vl(x + 2, y, 4, 0xf4f1ea); P.px(x + 2, y + 1, 0xd8202a); P.hl(x, y + 2, 6, 0xd8202a); P.vl(x + 3, y, 4, 0xd8202a); },
    JPY: () => { P.rect(x, y, 6, 4, 0xf4f1ea); P.rect(x + 2, y + 1, 2, 2, 0xd8202a); },
  };
  F[kind]?.();
  P.box(x - 1, y - 1, 8, 6, 0x0a0a10, 0.6);
}
const FX = [['EUR', '11,48'], ['USD', '10,63'], ['GBP', '13,27'], ['JPY', '0,07']];
function paintFxBoard(P) {
  const { x0, x1, y0, y1 } = BOARD_R, cx = (x0 + x1) / 2;
  frame(P, x0, y0, x1, y1);
  goldText(P, SMALL, 'VALUTA', cxText(SMALL, 'VALUTA', cx), y0 + 5);
  P.hl(x0 + 8, y0 + 12, x1 - x0 - 16, BRASS[1]);
  FX.forEach(([k, v], i) => {
    const y = y0 + 15 + i * 6;
    flag(P, x0 + 6, y, k);
    text(P, SMALL, k, x0 + 15, y, 0xe8e0c8);
    text(P, SMALL, v, x1 - 7 - textW(SMALL, v), y, 0xffe890);
  });
}
// ---------- bankomaten i väggen (skärmen ritas levande) ----------
function paintAtm(P) {
  const { x0, x1, top } = ATM, w = x1 - x0, cx = (x0 + x1) / 2, bot = WALL_Y - 3;
  for (let y = top - 3; y < bot; y++) for (let x = x0 - 3; x < x1 + 3; x++) P.px(x, y, x < x0 || y < top ? tone(STEEL, 0.15, x, y) : 0x1a1c20);  // nischen
  for (let y = top; y < bot; y++) for (let x = x0; x < x1; x++) {        // borstat stål
    let v = 0.58 - (x - x0) / w * 0.2 + ((x * 3 + y) % 7 === 0 ? 0.06 : 0);
    if (x === x0) v = 0.9; else if (x === x1 - 1) v = 0.2;
    P.px(x, y, tone(STEEL, v, x, y));
  }
  P.rect(x0 + 1, top + 1, w - 2, 9, 0x146a3a); P.hl(x0 + 1, top + 1, w - 2, 0x5ad88a); P.hl(x0 + 1, top + 9, w - 2, 0x0a3a1e);   // skylten
  text(P, SMALL, 'BANKOMAT', cxText(SMALL, 'BANKOMAT', cx), top + 3, 0xffffff);
  P.rect(x0 + 3, top + 12, w - 6, 18, 0x22262c); P.box(x0 + 3, top + 12, w - 6, 18, STEEL[0]);   // skärmens ram
  for (let k = 0; k < 3; k++) { P.rect(x0 + 1, top + 15 + k * 5, 2, 3, STEEL[3]); P.rect(x1 - 3, top + 15 + k * 5, 2, 3, STEEL[3]); } // sidoknappar
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {              // tangentbordet
    const kx = x0 + 4 + c * 5, ky = top + 33 + r * 4;
    const col = r === 3 ? [0xd83a3a, 0xe8c030, 0x3ab85a][c] : 0xd8dce0;
    P.rect(kx, ky, 4, 3, col); P.hl(kx, ky, 4, mix(col, 0xffffff, 0.5)); P.hl(kx, ky + 2, 4, mul(col, 0.6));
  }
  P.rect(x1 - 12, top + 34, 8, 3, 0x14161a); P.hl(x1 - 12, top + 34, 8, STEEL[4]);   // kortläsaren
  P.rect(x1 - 12, top + 40, 8, 2, 0x14161a);                                          // kvittot
  P.rect(x0 + 5, top + 51, w - 10, 4, 0x0c0e12); P.hl(x0 + 5, top + 50, w - 10, STEEL[4]); P.hl(x0 + 5, top + 55, w - 10, STEEL[1]); // sedelluckan
  sbox(P, x0 - 3, top + 57, w + 6, 3, 0x9aa2ac);                                     // hyllan
  // liten grön skylt ovanför: 24 TIM bara om staden släpper in en dygnet runt, annars UTTAG
  const sign = ATM_24 ? '24 TIM' : 'UTTAG';
  P.rect(cx - 13, top - 10, 26, 7, 0x146a3a); P.box(cx - 13, top - 10, 26, 7, BRASS[2]);
  text(P, SMALL, sign, cxText(SMALL, sign, cx), top - 9, 0xd8ffe0);
}
// ---------- BÖRSEN (raderna ritas levande) och löpremsan ----------
function paintBorsBoard(P) {
  const { x0, x1, y0, y1 } = BORS, cx = (x0 + x1) / 2;
  frame(P, x0, y0, x1, y1, [0x06080c, 0x0c1016, 0x141a22, 0x1c242e, 0x28323e]);
  goldText(P, SMALL, 'BÖRSEN', cxText(SMALL, 'BÖRSEN', cx), y0 + 4);
  P.hl(x0 + 4, y0 + 11, x1 - x0 - 8, 0x2a3038);
  const T = TICK;
  for (let y = T.y0; y < T.y1; y++) for (let x = T.x0; x < T.x1; x++) {
    const e = Math.min(x - T.x0, T.x1 - 1 - x, y - T.y0, T.y1 - 1 - y);
    P.px(x, y, e === 0 ? BRASS[1] : e === 1 ? BRASS[3] : (x + y) % 2 ? 0x0a0c10 : 0x121418);
  }
}
// ---------- grundarens porträtt ----------
function paintPortrait(P) {
  const { x0, x1, y0, y1 } = PORTRAIT, cx = (x0 + x1) / 2;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {        // ram med ornament
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    let c;
    if (e < 4) {
      c = tone(BRASS, [0.25, 0.85, 0.6, 0.3][e], x, y);
      if (e === 2 && (x + y) % 3 === 0) c = BRASS[4];
    } else {                                                               // målningen: mörk bakgrund med vinjett
      const d = Math.hypot((x - cx) / (x1 - x0), (y - (y0 + y1) / 2) / (y1 - y0));
      c = tone([0x1a1410, 0x2a2014, 0x3e3020, 0x544028], 0.8 - d * 1.6, x, y);
    }
    P.px(x, y, c);
  }
  for (const [x, y] of [[x0, y0], [x1 - 4, y0], [x0, y1 - 4], [x1 - 4, y1 - 4]]) { P.rect(x, y, 4, 4, BRASS[3]); P.px(x + 1, y + 1, BRASS[4]); P.px(x + 2, y + 2, BRASS[1]); }
  // herr Gustaf Pixel: svart rock, vit krage, grått skägg, flint och monokel
  const hy = y0 + 15;
  for (let y = hy + 9; y < y1 - 4; y++) {                                 // rocken
    const hw = Math.min(15, 6 + (y - hy - 9) * 1.2);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) P.px(x, y, tone([0x0c0c10, 0x1a1a22, 0x2a2a34], 0.5 - (x - cx) / 40, x, y));
  }
  for (let k = 0; k < 6; k++) { P.px(cx - 2 + (k >> 2), hy + 9 + k, 0xf0ece0); P.px(cx + 1 - (k >> 2), hy + 9 + k, 0xf0ece0); } // kragen
  P.px(cx - 1, hy + 10, 0x6a1a2a); P.px(cx, hy + 10, 0x6a1a2a);           // flugan
  for (let k = 0; k < 6; k++) P.px(cx + 3 + k, hy + 16 + (k === 2 || k === 3 ? 1 : 0), BRASS[3]); // klockkedjan
  disc(P, cx, hy, 6, 7.5, 0xe8b494);                                       // ansiktet
  disc(P, cx - 2, hy - 4, 3, 2, 0xf6d0b0);                                 // blank flint
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { P.px(cx + s * 5, hy - 1 + k, 0xc8c8cc); P.px(cx + s * 6, hy + k, 0xa8a8b0); } // polisonger
  P.hl(cx - 3, hy + 3, 7, 0xd8d8dc); P.hl(cx - 4, hy + 4, 3, 0xc8c8cc); P.hl(cx + 2, hy + 4, 3, 0xc8c8cc); // mustaschen
  P.px(cx - 2, hy, 0x1a1414); P.px(cx + 2, hy, 0x1a1414);
  P.box(cx + 1, hy - 1, 3, 3, BRASS[3]); P.vl(cx + 3, hy + 2, 5, BRASS[2]); // monokeln
  P.px(cx, hy + 2, 0xc88a6a);
  // mässingsskylten under
  const s = 'GRUNDAREN 1887', tw = textW(SMALL, s);
  P.rect(Math.round(cx - tw / 2) - 3, y1 + 1, tw + 6, 7, BRASS[2]); P.hl(Math.round(cx - tw / 2) - 3, y1 + 1, tw + 6, BRASS[4]);
  text(P, SMALL, s, Math.round(cx - tw / 2), y1 + 2, 0x3a2408);
}
function paintSides(P) {
  for (const [x0, x1] of [[0, SIDE], [W - SIDE, W]]) for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
    let c = tone(GREEN, 0.25 + (x0 === 0 ? (x1 - x) : (x - x0)) * 0.05, x, y);
    if (marble(x, y, 91) < 0.07) c = GREEN[3];
    if ((x0 === 0 && x === x1 - 1) || (x0 > 0 && x === x0)) c = BRASS[2];
    P.px(x, y, c);
  }
}
// det blanka golvet speglar väggen närmast
function paintGloss(P, night) {
  for (let y = WALL_Y + 1; y < WALL_Y + 22; y++) {
    const k = 1 - (y - WALL_Y) / 22, my = WALL_Y - (y - WALL_Y) - 1;
    for (let x = SIDE; x < W - SIDE; x++) {
      if (bayer(x, y) > k * 0.9) continue;
      const c = alphaAt(P, x, my) < 128 ? (night ? 0x28304a : 0xc8e0f0) : P.get(x, my);
      P.px(x, y, c, 0.18 * k);
    }
  }
  for (const x of CHAND) P.ell(x, WALL_Y + 34, 26, 7, night ? 0xffd890 : 0xfff4d8, night ? 0.16 : 0.1, 4); // ljuskronornas sken i golvet
}
// solfläckar från fönstren (dag)
function paintSun(P) {
  for (const Wn of [WIN_A, WIN_B, { x0: DOOR.x0 + 8, x1: DOOR.x1 - 8 }]) {
    for (let y = WALL_Y + 8; y < WALL_Y + 64; y++) {
      const k = (y - WALL_Y - 8) / 56, sh = Math.round((y - WALL_Y) * 0.55), mid = Math.round((Wn.x0 + Wn.x1) / 2) + sh;
      for (let x = Wn.x0 + 2 + sh; x < Wn.x1 - 2 + sh; x++) {
        if (x >= W - SIDE || Math.abs(x - mid) < 1) continue;   // spröjsens skugga
        if (bayer(x, y) < 0.8 - k * 0.55) P.px(x, y, 0xfff0c0, 0.2 * (1 - k * 0.8));
      }
    }
  }
}
function paintRoom(night) {
  const P = new Pix(W, H);
  paintFloor(P);
  paintWall(P);
  paintCeiling(P);
  paintWindow(P, WIN_A, night, 1);
  paintWindow(P, WIN_B, night, 4);
  paintDoor(P, night);
  for (const x of PILS) paintPilaster(P, x);
  goldText(P, BIG, 'PIXELBANKEN', cxText(BIG, 'PIXELBANKEN', VAULT.cx, 2), NAME_Y, 2);
  paintVault(P);
  paintRateBoard(P);
  paintFxBoard(P);
  paintAtm(P);
  paintBorsBoard(P);
  paintPortrait(P);
  paintSides(P);
  paintGloss(P, night);
  if (!night) paintSun(P);
  return P.flush();
}

// ================= föremålen på golvet (förmålade, djupsorterade) =================
// ---------- kassadisken: marmorskiva, mahognyfront, glasrutor med mässingsram ----------
function paintCounter() {
  const X0 = CNT.x0 - 3, Y0 = GLASS_TOP - 2;
  return sprite(X0, Y0, CNT.x1 - CNT.x0 + 7, CNT.base - Y0 + 4, (P) => {
    const { x0, x1, top, face, base } = CNT;
    // kassörernas sida: skärmar sedda bakifrån, stämpelställ och sedelräknare (bakom glaset)
    for (const Wn of WINS) {
      const mx = Wn.cx + 24;
      P.rect(mx, top - 13, 12, 9, 0x2a2c32); P.hl(mx, top - 13, 12, 0x4a4e56); P.rect(mx + 5, top - 4, 2, 4, 0x3a3c42);
      P.rect(Wn.cx - 38, top - 6, 8, 5, 0x6a4a2a); for (let k = 0; k < 3; k++) P.vl(Wn.cx - 37 + k * 3, top - 10, 4, 0x2a2a30); // stämplarna
    }
    // skivan: grön marmor sedd uppifrån, ljus list i framkanten
    for (let y = top; y < face; y++) for (let x = x0; x < x1; x++) {
      let c;
      if (y >= face - 2) c = y === face - 2 ? CREAM[4] : CREAM[2];
      else { c = tone(GREEN, 0.48 + (y - top) / (face - top) * 0.25, x, y); if (marble(x, y * 2, 93) < 0.06) c = GREEN[4]; }
      P.px(x, y, c);
    }
    // fronten: två fyllningar per lucka, pilasterlister vid ramstolparna, sparklist i mässing
    const ph = base - 4 - face;
    for (let y = face; y < base; y++) for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 96, ly = y - face;
      let c = tone(MAHOG, 0.5 + (hash(x >> 1, y, 92) - 0.5) * 0.12 + ((x * 7 + (y >> 2) * 3) % 13 === 0 ? -0.2 : 0), x, y);
      if (y >= base - 4) c = y === base - 4 ? BRASS[4] : tone(BRASS, 0.6 - (y - base + 4) * 0.14, x, y);
      else if (lx < 5 || lx > 90) c = tone(MAHOG, lx < 5 ? 0.3 + lx * 0.09 : 0.62 - (lx - 90) * 0.07, x, y);
      else {
        const px0 = lx < 48 ? 7 : 50, pw = 39, pxx = lx - px0;
        if (pxx >= 0 && pxx < pw && ly >= 3 && ly < ph - 2) {
          const e = Math.min(pxx, pw - 1 - pxx, ly - 3, ph - 3 - ly);
          if (e === 0) c = pxx === 0 || ly === 3 ? MAHOG[4] : MAHOG[0];
          else if (e === 1) c = MAHOG[2];
          else c = tone(MAHOG, 0.62 + ((pxx + ly * 3) % 11 === 0 ? -0.15 : 0), x, y);
        }
      }
      P.px(x, y, c);
    }
    for (let x = x0; x < x1; x++) P.px(x, face, 0x000000, 0.35);          // skugga under skivans kant
    // mässingsbrickan i skivan under varje lucka + pennor och kortterminal på kundsidan
    for (const Wn of WINS) {
      const cx = Wn.cx;
      P.rect(cx - 8, top + 3, 16, 5, BRASS[2]); P.hl(cx - 8, top + 3, 16, BRASS[1]); P.hl(cx - 7, top + 6, 14, BRASS[4]); P.rect(cx - 6, top + 4, 12, 2, BRASS[1]);
      P.rect(cx + 16, top + 5, 4, 2, BRASS[2]); P.line(cx + 17, top + 5, cx + 21, top + 1, 0x1a1a22); P.px(cx + 21, top + 1, 0xc9323a); // pennan i kedja
      for (let k = 0; k < 4; k++) P.px(cx + 20 + k, top + 6 + (k & 1), 0xc0c4c8);
      if (Wn.i !== 1) { P.rect(cx - 24, top + 2, 6, 6, 0x1e2026); P.rect(cx - 23, top + 3, 4, 2, 0x5ad88a); P.hl(cx - 23, top + 6, 4, 0x6a6e76); } // kortterminalen
    }
    // glasrutorna (släpper igenom kassörerna, med reflexer; talgallret ritas efter konturen)
    for (const Wn of WINS) {
      const gx0 = Wn.x0 + 3, gx1 = Wn.x1 - 3, gy0 = GLASS_TOP + 7, gy1 = top + 2, cx = Wn.cx;
      const slot = (x, y) => y > gy1 - 5 && Math.abs(x + 0.5 - cx) / 7 + (gy1 - y) / 5 < 1.1;    // pengaluckan i glasets underkant
      for (let y = gy0; y < gy1; y++) for (let x = gx0; x < gx1; x++) if (!slot(x, y)) P.px(x, y, 0xd4ecf0, 0.14);
      glare(P, gx0, gy0, gx1 - gx0, gy1 - gy0, 0.15, 19, Wn.i * 3, (x, y) => !slot(x, y));
      for (let x = cx - 10; x <= cx + 10; x++) for (let y = gy1 - 8; y < gy1; y++) {
        if (slot(x, y) && !slot(x, y - 1)) P.px(x, y - 1, BRASS[3]);
      }
    }
    // ramstolparna och överliggaren med emaljskyltarna KASSA 1–3
    for (let k = 0; k <= 3; k++) {
      const x = x0 + k * 96 - (k === 3 ? 3 : k === 0 ? 0 : 1);
      for (let y = GLASS_TOP + 6; y < top + 2; y++) { P.px(x, y, BRASS[4]); P.px(x + 1, y, BRASS[2]); P.px(x + 2, y, BRASS[1]); }
      P.rect(x - 1, top - 1, 5, 3, BRASS[2]); P.hl(x - 1, top - 1, 5, BRASS[4]);
    }
    for (let y = GLASS_TOP; y < GLASS_TOP + 7; y++) for (let x = x0 - 1; x < x1 + 1; x++) P.px(x, y, tone(BRASS, [0.95, 0.8, 0.65, 0.55, 0.45, 0.3, 0.15][y - GLASS_TOP], x, y));
    for (const Wn of WINS) {
      const s = `KASSA ${Wn.i + 1}`, tw = textW(SMALL, s), px0 = Wn.cx - Math.round((tw + 6) / 2);
      P.rect(px0 - 1, GLASS_TOP - 1, tw + 8, 10, BRASS[1]); P.rect(px0, GLASS_TOP, tw + 6, 8, 0x0e2a20); P.hl(px0, GLASS_TOP, tw + 6, 0x1e4a38);
      text(P, SMALL, s, px0 + 3, GLASS_TOP + 2, 0xf0d070);
      disc(P, px0 + tw + 12, GLASS_TOP + 3.5, 2.5, 2.5, BRASS[1]);         // lampans sockel (lampan lyser levande)
    }
    outline(P, OUT, 0.6);
    // talgallret: en liten halvgenomskinlig mässingsring i glaset vid sidan av kassören (inte
    // framför ansiktet) – ritas efter konturen så att den inte får någon mörk kant
    for (const Wn of WINS) {
      const gx = Wn.cx + GRILLE.dx, gy = GRILLE.y;
      for (let a = 0; a < 12; a++) { const th = a / 12 * Math.PI * 2; P.px(Math.round(gx + Math.cos(th) * 3), Math.round(gy + Math.sin(th) * 2), a < 6 ? BRASS[2] : BRASS[4], 0.75); }
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) P.px(gx + dx, gy + dy, 0x1a2a30, (dx + dy) & 1 ? 0.25 : 0.4);
    }
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2 + 2, 2.5, 0.35);
  });
}
// kassalampans läge (samma räkning som skylten)
const lampOf = (Wn) => { const tw = textW(SMALL, `KASSA ${Wn.i + 1}`); return [Wn.cx - Math.round((tw + 6) / 2) + tw + 12, GLASS_TOP + 3]; };
// ---------- kön: mässingsstolpar med röda repband ----------
function paintRopes(y, sign) {
  const xa = POSTS[0] - 16, xb = POSTS[POSTS.length - 1] + 6;
  return sprite(xa, y - 26, xb - xa, 30, (P) => {
    for (let k = 0; k < POSTS.length - 1; k++) {       // repen hänger i bågar mellan stolparna
      const a = POSTS[k], b = POSTS[k + 1];
      for (let x = a + 1; x < b; x++) {
        const tt = (x - a) / (b - a), yy = y - 12 + Math.round(Math.sin(tt * Math.PI) * 3.5);
        P.px(x, yy, (x + k) % 4 === 0 ? VELVET[4] : VELVET[3]); P.px(x, yy + 1, VELVET[1]);
      }
    }
    for (const x of POSTS) {
      for (let dx = -3; dx <= 3; dx++) { P.px(x + dx, y, BRASS[Math.abs(dx) === 3 ? 1 : 2]); if (Math.abs(dx) < 3) P.px(x + dx, y - 1, BRASS[dx < 0 ? 4 : 3]); }
      P.rect(x - 1, y - 14, 2, 13, BRASS[2]); P.vl(x - 1, y - 14, 13, BRASS[4]);
      P.rect(x - 1, y - 17, 3, 3, BRASS[3]); P.px(x - 1, y - 17, BRASS[4]); P.px(x + 1, y - 15, BRASS[1]);
      P.px(x - 2, y - 12, BRASS[1]); P.px(x + 1, y - 12, BRASS[1]);
    }
    if (sign) { // KÖ HÄR-skylten på första stolpen
      const x = POSTS[0], s = 'KÖ HÄR', tw = textW(SMALL, s);
      P.rect(x - 1, y - 20, 2, 4, BRASS[2]);
      P.rect(x - Math.round(tw / 2) - 3, y - 26, tw + 6, 7, 0x0e2a20); P.box(x - Math.round(tw / 2) - 4, y - 27, tw + 8, 9, BRASS[3]);
      text(P, SMALL, s, x - Math.round(tw / 2), y - 25, 0xf0d070);
    }
    outline(P, OUT, 0.55);
    for (const x of POSTS) groundShadow(P, x + 1, y + 1, 5, 1.5, 0.35);
  });
}
// ---------- palm i mässingsurna ----------
function paintPalm(seed) {
  return spr(48, 60, 24, 58, (P) => {
    const cx = 24, base = 58, R = rng(seed);
    for (let y = base - 12; y <= base; y++) {                  // urnan
      const k = (y - (base - 12)) / 12, hw = Math.round(7 - k * 2.5 + (k < 0.15 ? 1 : 0));
      for (let x = cx - hw; x <= cx + hw; x++) P.px(x, y, tone(BRASS, 0.8 - (x - cx + hw) / (2 * hw + 1) * 0.6 - (y === base ? 0.3 : 0), x, y));
    }
    P.hl(cx - 8, base - 13, 17, BRASS[4]); P.hl(cx - 8, base - 12, 17, BRASS[2]); P.hl(cx - 6, base - 14, 13, 0x3a2414);
    for (let y = base - 32; y < base - 13; y++) {              // stammen
      P.px(cx - 1, y, y % 3 === 0 ? 0x5a3a1e : 0x8a6038); P.px(cx, y, y % 3 === 0 ? 0x4a2e16 : 0x6a4426); P.px(cx + 1, y, 0x3a2412);
    }
    const tx = cx, ty = base - 33;
    const FR = [[-3.05, 21], [-2.6, 23], [-2.15, 19], [-1.75, 15], [-1.35, 17], [-0.95, 21], [-0.5, 23], [-0.08, 20], [-1.55, 12]];
    for (const [a0, len] of FR) {
      const a = a0 + (R() - 0.5) * 0.12;
      for (let s = 0; s < len; s += 0.5) {
        const tt = s / len, x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s + tt * tt * len * 0.55;
        P.px(x, y, LEAF[1]);
        const L = Math.round(4.5 * (1 - tt * 0.7));
        if ((s * 2) % 2 === 0) for (let k = 1; k <= L; k++) {
          P.px(x - Math.sin(a) * k * 0.6, y + k * 0.9, k === L ? LEAF[2] : LEAF[4]);
          P.px(x + Math.sin(a) * k * 0.6, y + k * 0.7 - 0.5, k === L ? LEAF[3] : LEAF[5]);
        }
      }
    }
  });
}
// ---------- skrivpulpeten med blanketter och kedjade pennor ----------
function paintPulpet() {
  return spr(54, 38, 27, 37, (P) => {
    const x0 = 3, x1 = 51, base = 37, topY = 10;
    for (const lx of [8, 44]) { P.rect(lx, 20, 3, base - 20, BRASS[2]); P.vl(lx, 20, base - 20, BRASS[4]); P.vl(lx + 2, 20, base - 20, BRASS[1]); P.rect(lx - 2, base - 2, 7, 2, BRASS[1]); P.hl(lx - 2, base - 2, 7, BRASS[3]); }
    P.rect(10, 30, 34, 2, BRASS[2]); P.hl(10, 30, 34, BRASS[4]);
    for (let y = topY; y < 20; y++) for (let x = x0; x < x1; x++) { let c = tone(GREEN, 0.42 + (y - topY) * 0.035, x, y); if (marble(x, y * 2, 121) < 0.07) c = GREEN[4]; P.px(x, y, c); }
    P.hl(x0, topY, x1 - x0, BRASS[3]); P.rect(x0, 18, x1 - x0, 2, BRASS[2]); P.hl(x0, 18, x1 - x0, BRASS[4]);
    // blanketterna i fack: gula (INSÄTTNING), rosa (UTTAG), vita
    for (const [bx, c] of [[6, 0xf0e070], [14, 0xf0a0b0], [22, 0xf4f1ea]]) { P.rect(bx, topY - 3, 7, 7, c); P.hl(bx, topY - 3, 7, 0xffffff); P.hl(bx + 1, topY - 1, 5, mul(c, 0.72)); P.hl(bx + 1, topY + 1, 4, mul(c, 0.72)); P.rect(bx - 1, topY + 2, 9, 2, BRASS[1]); }
    P.rect(31, topY + 2, 10, 7, 0xf8f8f0); for (let k = 0; k < 3; k++) P.hl(32, topY + 3 + k * 2, 7 - k, 0x9a9aa8);   // en ifylld blankett
    P.line(42, topY + 2, 46, topY + 6, 0x1a1a22); P.px(42, topY + 2, 0xc9323a);                                     // pennan
    for (let k = 0; k < 5; k++) P.px(46 + (k & 1), topY + 7 + k, 0xc8ccd0);                                         // kedjan
    P.rect(46, topY + 11, 3, 2, BRASS[2]);
  });
}
// ---------- skinnbänken (capitonné i grönt läder) ----------
function paintBench() {
  return spr(66, 20, 33, 19, (P) => {
    P.rect(3, 10, 60, 5, MAHOG[2]); P.hl(3, 10, 60, MAHOG[4]); P.hl(3, 14, 60, MAHOG[0]);
    for (const x of [5, 31, 58]) { P.rect(x, 15, 3, 4, BRASS[2]); P.px(x, 15, BRASS[4]); P.hl(x - 1, 18, 5, BRASS[1]); }
    for (let y = 2; y < 11; y++) for (let x = 2; x < 64; x++) {
      if ((y === 2 && (x < 4 || x > 61)) || (y === 3 && (x < 3 || x > 62))) continue;
      const lx = (x - 2) % 8, ly = y - 2;
      let c = tone(GREEN, 0.6 + (ly < 2 ? 0.25 : 0) - (ly > 6 ? 0.2 : 0) + ((lx === 3 || lx === 5) && ly > 1 && ly < 6 ? -0.12 : 0), x, y);
      if ((lx === 4 && ly === 3) || (lx === 0 && ly === 6)) c = GREEN[0];
      P.px(x, y, c);
    }
  });
}
// ---------- spargrisen på sin sockel ----------
function paintPig() {
  return spr(34, 34, 17, 33, (P) => {
    const cx = 17, base = 33;
    for (let y = base - 11; y <= base; y++) for (let x = cx - 10; x <= cx + 10; x++) {       // sockeln
      let c = tone(GREEN, 0.62 - (x - cx + 10) / 21 * 0.45, x, y);
      if (y === base - 11 || y === base - 1) c = BRASS[3]; else if (y === base - 10 || y === base) c = BRASS[1];
      P.px(x, y, c);
    }
    disc(P, cx, base - 11, 10.5, 2.2, GREEN[3]);
    const s = 'SPARA!', tw = textW(SMALL, s); text(P, SMALL, s, cx - Math.round(tw / 2), base - 7, BRASS[4]);
    const by = base - 20;                                                                    // grisen
    for (const lx of [-6, -2, 3, 7]) P.rect(cx + lx, by + 4, 2, 4, PINK[1]);
    disc(P, cx, by, 10, 6.5, PINK[2]);
    disc(P, cx - 2, by - 2, 6, 3, PINK[3]); P.rect(cx - 5, by - 4, 3, 1, PINK[4]);
    for (let x = cx - 8; x <= cx + 7; x++) P.px(x, by + 5, PINK[1]);
    disc(P, cx + 10, by + 1, 2.5, 2.5, PINK[2]); P.px(cx + 10, by + 1, PINK[0]); P.px(cx + 11, by + 1, PINK[0]); // trynet
    P.rect(cx + 5, by - 7, 3, 3, PINK[1]); P.px(cx + 6, by - 8, PINK[2]);                   // örat
    P.px(cx + 6, by - 2, 0x1a1418);                                                          // ögat
    P.rect(cx - 3, by - 6, 6, 1, 0x3a1a24);                                                  // myntspringan
    P.px(cx - 11, by - 1, PINK[1]); P.px(cx - 12, by - 2, PINK[1]); P.px(cx - 11, by - 3, PINK[1]); // knorren
  });
}
// ---------- broschyrstället ----------
function paintBrochures() {
  return spr(24, 42, 12, 41, (P) => {
    const base = 41;
    P.rect(3, 6, 2, base - 6, BRASS[2]); P.rect(19, 6, 2, base - 6, BRASS[2]); P.vl(3, 6, base - 6, BRASS[4]);
    P.hl(1, base, 22, BRASS[1]); P.hl(2, base - 1, 20, BRASS[3]);
    const COVERS = [[0x1f6a4a, 0xf0d070], [0xf0c030, 0x2a2a30], [0x3a7bd5, 0xf4f1ea], [0xc9323a, 0xf4f1ea], [0x8e5bd1, 0xf4f1ea], [0x2aa39a, 0xf4f1ea]];
    for (let r = 0; r < 3; r++) {
      const y = 9 + r * 10;
      P.hl(4, y + 8, 16, BRASS[3]);
      for (let k = 0; k < 2; k++) {
        const [c, t2] = COVERS[r * 2 + k], x = 5 + k * 7;
        P.rect(x, y, 6, 8, c); P.hl(x, y, 6, mix(c, 0xffffff, 0.4)); P.hl(x + 1, y + 2, 4, t2); P.hl(x + 1, y + 4, 3, t2); P.px(x + 4, y + 6, t2);
      }
    }
    P.rect(2, 0, 21, 7, 0xf4f1ea); P.box(2, 0, 21, 7, BRASS[2]); text(P, SMALL, 'TA EN', cxText(SMALL, 'TA EN', 12.5), 1, 0x1f4a3a);
  });
}
// ---------- NÄSTA KUND-skylten (texten ritas levande) ----------
function paintNextSign() {
  return spr(36, 32, 18, 31, (P) => {
    const base = 31;
    P.rect(17, 15, 2, base - 15, BRASS[2]); P.vl(17, 15, base - 15, BRASS[4]);
    for (let dx = -4; dx <= 4; dx++) P.px(18 + dx, base, BRASS[Math.abs(dx) === 4 ? 1 : 2]);
    P.rect(1, 0, 34, 16, BRASS[2]); P.hl(1, 0, 34, BRASS[4]); P.rect(3, 2, 30, 12, 0x08080c);
    for (let y = 3; y < 13; y++) for (let x = 4; x < 32; x++) if ((x + y) % 2) P.px(x, y, 0x121016);
  });
}
// ---------- rådgivarens skrivbord, stolar och bankirlampa ----------
function paintDesk() {
  const w = DESK.x1 - DESK.x0;
  return spr(w + 4, 40, 2, 38, (P) => {
    const x0 = 2, x1 = w + 2, base = 38, top = base - 20, face = base - 14;
    for (let y = top; y < face; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? MAHOG[4] : y === face - 1 ? MAHOG[3] : (x > x0 + 3 && x < x1 - 4 && y > top + 1 ? tone(GREEN, 0.45, x, y) : MAHOG[2]));
    for (let y = face; y < base; y++) for (let x = x0; x < x1; x++) {
      const lx = x - x0, ly = y - face;
      let c = tone(MAHOG, 0.5 + ((x * 5 + (y >> 1)) % 11 === 0 ? -0.18 : 0), x, y);
      if (lx < 3 || lx > w - 4) c = MAHOG[lx < 3 ? 3 : 1];
      else if (ly === 0) c = MAHOG[0];
      P.px(x, y, c);
    }
    const s = 'RÅDGIVARE', tw = textW(SMALL, s), sx = Math.round(x0 + w / 2 - tw / 2);  // mässingsskylten
    P.rect(sx - 3, face + 3, tw + 6, 7, BRASS[2]); P.hl(sx - 3, face + 3, tw + 6, BRASS[4]); P.hl(sx - 3, face + 9, tw + 6, BRASS[0]);
    text(P, SMALL, s, sx, face + 4, 0x2a1a06);
    // bankirlampan: mässingsfot och grön glasskärm
    const lx = x0 + 10;
    P.rect(lx - 3, top - 1, 7, 2, BRASS[2]); P.vl(lx, top - 9, 8, BRASS[3]);
    for (let y = 0; y < 5; y++) for (let x = -6 + (4 - y); x <= 6 - (4 - y); x++) P.px(lx + x, top - 14 + y, y === 4 ? 0xb8f0c8 : tone([0x0a3a1e, 0x14602e, 0x2a8a46, 0x5ac878], 0.9 - y * 0.12 - (x + 6) / 20, lx + x, top - 14 + y));
    // skärmen (sedd bakifrån), pappershögen, pennstället och en kopp
    const mx = x1 - 22;
    P.rect(mx, top - 16, 16, 12, 0x2a2c32); P.hl(mx, top - 16, 16, 0x4a4e56); P.rect(mx + 7, top - 4, 2, 4, 0x3a3c42); P.rect(mx + 4, top - 1, 8, 1, 0x3a3c42);
    P.rect(x0 + 20, top + 1, 12, 3, 0xf4f1ea); P.hl(x0 + 21, top + 2, 10, 0xd8d4c8); P.rect(x0 + 22, top, 10, 2, 0xfaf8f0);
    P.rect(x0 + 36, top - 4, 3, 4, 0x1a1a22); P.px(x0 + 36, top - 6, 0xc9323a); P.px(x0 + 38, top - 5, 0x3a7bd5);
    P.rect(x1 - 32, top - 2, 3, 3, 0xf4f1ea); P.px(x1 - 29, top - 1, 0xf4f1ea);
  });
}
function paintAdvChair() {
  return spr(22, 46, 11, 45, (P) => {
    for (let y = 0; y < 34; y++) for (let x = 2; x < 20; x++) {
      if (y < 3 && (x < 4 + (3 - y) || x > 17 - (3 - y))) continue;
      const lx = (x - 2) % 6, ly = y % 7;
      let c = tone(LEATHER, 0.62 - (x - 2) / 18 * 0.35 + (y < 4 ? 0.15 : 0), x, y);
      if ((lx === 3 && ly === 3) || (lx === 0 && ly === 0 && y > 0)) c = LEATHER[0];
      if (x === 2 || x === 19) c = BRASS[2];
      P.px(x, y, c);
    }
    P.rect(1, 34, 20, 4, LEATHER[2]); P.hl(1, 34, 20, LEATHER[4]);
    P.rect(10, 38, 2, 5, 0x2a2a30); P.hl(5, 43, 12, 0x2a2a30); P.px(5, 44, 0x1a1a1e); P.px(16, 44, 0x1a1a1e);
  });
}
function paintGuestChair() {
  return spr(18, 22, 9, 21, (P) => {
    for (let y = 0; y < 13; y++) for (let x = 2; x < 16; x++) {
      if (y === 0 && (x < 4 || x > 13)) continue;
      let c = tone(LEATHER, 0.55 - (x - 2) / 14 * 0.3 + (y < 2 ? 0.2 : 0), x, y);
      if ((x === 2 || x === 15 || y === 0) && (x + y) % 2 === 0) c = BRASS[3];  // mässingsnitar
      P.px(x, y, c);
    }
    P.rect(1, 12, 16, 3, LEATHER[1]); P.hl(1, 12, 16, LEATHER[3]);
    for (const x of [2, 14]) { P.rect(x, 15, 2, 6, MAHOG[2]); P.px(x, 20, BRASS[2]); }
  });
}
// ---------- ljuskronan (hänger från taket, ovanpå allt) ----------
function paintChandelier() {
  const P = new Pix(32, 32), cx = 16;
  for (let y = 0; y < 8; y++) P.px(cx, y, y % 2 ? BRASS[1] : BRASS[3]);
  P.rect(cx - 2, 0, 5, 1, BRASS[2]);
  P.rect(cx - 1, 8, 3, 12, BRASS[2]); P.vl(cx - 1, 8, 12, BRASS[4]);
  disc(P, cx, 13, 2.5, 2, BRASS[3]); P.px(cx - 1, 12, BRASS[4]);
  for (let a = 0; a < 80; a++) { const th = a / 80 * Math.PI * 2; P.px(Math.round(cx + Math.cos(th) * 7), Math.round(12 + Math.sin(th) * 1.5), Math.sin(th) > 0 ? BRASS[3] : BRASS[1]); }
  for (let a = 0; a < 120; a++) { const th = a / 120 * Math.PI * 2; P.px(Math.round(cx + Math.cos(th) * 13), Math.round(21 + Math.sin(th) * 3), Math.sin(th) > 0 ? BRASS[3] : BRASS[1]); }
  disc(P, cx, 23, 5, 3, BRASS[2]); P.hl(cx - 3, 22, 7, BRASS[4]); P.px(cx, 26, BRASS[1]); P.px(cx, 27, BRASS[3]);
  const candle = (x, y) => { P.rect(x - 1, y, 3, 1, BRASS[3]); P.rect(x, y - 4, 1, 4, 0xf4f1ea); P.px(x, y - 5, 0xfff0b0); P.px(x, y - 6, 0xffffff); };
  for (const [dx, dy] of [[-13, 21], [-8, 23], [0, 24], [8, 23], [13, 21], [-5, 19], [5, 19]]) candle(cx + dx, dy);
  for (const dx of [-7, 0, 7]) candle(cx + dx, 12);
  for (let k = -12; k <= 12; k += 4) { const yy = 23 + Math.round(3 * Math.sqrt(Math.max(0, 1 - (k / 13) ** 2))); P.px(cx + k, yy + 1, 0xd8f0ff); P.px(cx + k, yy + 2, 0x8ab8d8); }
  outline(P, 0x2a1e10, 0.5);
  return P.flush();
}

// ================= förmålade bilder (cachas) =================
const CACHE = {};
function art() {
  if (CACHE.art) return CACHE.art;
  CACHE.art = {
    counter: paintCounter(), ropes: [paintRopes(ROPES[0], true), paintRopes(ROPES[1], false)],
    palmL: paintPalm(3), palmR: paintPalm(8), pulpet: paintPulpet(), bench: paintBench(), pig: paintPig(),
    broch: paintBrochures(), next: paintNextSign(), desk: paintDesk(), advChair: paintAdvChair(), guest: paintGuestChair(),
    chand: paintChandelier(),
    cars: CAR_COLS.map((c, i) => [paintCar(c, false, i === 3), paintCar(c, true, i === 3)]),
  };
  return CACHE.art;
}
const roomImg = (night) => CACHE['room' + night] || (CACHE['room' + night] = paintRoom(night));
const outsideImg = (night) => CACHE['out' + night] || (CACHE['out' + night] = paintOutside(night));
// kvällen: dunkel över hallen med ljuskäglor runt lamporna, och ett varmt sken ovanpå
const LIGHTS = [
  ...CHAND.map((x) => [x, 22, 118, 1]),
  [DESK.x0 + 12, DESK.base - 30, 40, 0.9], [(ATM.x0 + ATM.x1) / 2, ATM.top + 20, 32, 0.6],
  [(BORS.x0 + BORS.x1) / 2, (BORS.y0 + BORS.y1) / 2, 30, 0.5], [VAULT.cx, VAULT.cy, 34, 0.6],
];
function nightShade() {
  if (CACHE.shade) return CACHE.shade;
  const P = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let lit = 0;
    for (const [lx, ly, r, k] of LIGHTS) { const d = Math.hypot(x - lx, (y - ly) * (y > ly ? 0.7 : 1.2)) / r; if (d < 1) lit = Math.max(lit, (1 - d) * k); }
    const a = 0.34 * (1 - q(Math.min(1, lit * 1.5), x, y, 4));
    if (a > 0) P.px(x, y, 0x0c0f2a, a);
  }
  return (CACHE.shade = P.flush());
}
function nightGlow() {
  if (CACHE.glow) return CACHE.glow;
  const P = new Pix(W, H);
  for (const [lx, ly, r, k] of LIGHTS) P.ell(lx, ly, r * 0.5, r * 0.4, 0xffc870, 0.14 * k, 4);
  return (CACHE.glow = P.flush());
}

// ================= personerna =================
// look-värden som bara finns i nyare personregister faller tillbaka på äldre (isValid)
const pref = (field, ...vals) => vals.find((v) => isValid(field, v)) ?? vals[vals.length - 1];
const BANKGRON = '#1f4a3a', VINROD = '#7a2032', GULD = '#e0b850';
const STAFF = () => ({ top: pref('top', 'waistcoat', 'suit'), neck: pref('neck', 'bowtie', 'none'), neckColor: GULD, shirt: VINROD, accent: GULD, bottom: 'pants', pants: '#1e2a24', shoes: '#1c1c1c', hat: null, bag: null, phones: false, kid: false });
let LOOKS = null;
function looks() {
  if (LOOKS) return LOOKS;
  LOOKS = {
    tellers: [
      { ...STAFF(), skin: '#f6d7bf', hair: '#6b4226', style: 'bun', glasses: 'round', beard: false, build: 5, blush: true },
      { ...STAFF(), skin: '#a06a43', hair: '#1d1714', style: 'side', glasses: false, beard: 'mustache', build: 6, blush: false },
      { ...STAFF(), skin: '#eec3a0', hair: '#d9a95c', style: 'ponytail', glasses: false, beard: false, build: 5, blush: true },
    ],
    guard: { skin: '#c68a5c', hair: '#3b2619', style: 'buzz', top: pref('top', 'bomber', 'jacket'), shirt: '#1e2a44', accent: '#e8c040', neck: pref('neck', 'tie', 'none'), neckColor: '#1e2a44', hat: 'cap', cap: '#1e2a44', bottom: 'pants', pants: '#1a2236', shoes: '#1c1c1c', build: 6, glasses: false, beard: false, kid: false, bag: null, phones: false },
    adv: { skin: '#e0a97f', hair: '#1d1714', style: 'bun', top: pref('top', 'blazer', 'suit'), shirt: '#2a3450', accent: '#f4f1ea', neck: pref('neck', 'pearls', 'none'), glasses: 'square', bottom: 'skirt', pants: '#2a3450', shoes: '#1c1c1c', build: 5, blush: true, kid: false, hat: null, bag: null, beard: false, phones: false },
  };
  return LOOKS;
}
function npcLook(seed) {
  const r = rng(seed), L = makeLook(r), biz = r() < 0.35;
  const base = { ...L, kid: false, build: L.build === 4 ? 5 : L.build, phones: false, bag: L.bag === 'backpack' ? null : L.bag };
  if (!biz) return base;
  const S = ['#2d3a5c', '#2f3440', '#5a5e68', '#3a2e2a'], C = ['#c9323a', '#3a7bd5', '#e0b850'];
  return { ...base, top: 'suit', shirt: S[Math.floor(r() * S.length)], accent: C[Math.floor(r() * C.length)], bottom: 'pants', pants: '#2b2b30', bag: pref('bag', 'briefcase', 'shoulder'), bagColor: '#5a3a1e', hat: null };
}
const CUST_LINES = ['Jag vill sätta in lite.', 'Kan jag ta ut 200?', 'Hur mycket ränta blir det?', 'Lönen kom i dag!', 'Jag sparar till en villa.', 'Växla till euro, tack.', 'Ett kontoutdrag, tack.'];
const TELLER_IDLE = ['Nästa, tack!', 'Varsågod!', 'Välkommen till kassan.'];
const TELLER_BYE = ['Tack och välkommen åter!', 'Ha en fin dag!', 'Varsågod, klart!', 'Signera här, tack.'];
const QUEUE_LINES = ['Lång kö i dag...', 'Vilken fin bank.', 'Titta, valvet är öppet!', 'Snart min tur.', 'Guldtackor! Wow.'];
const ATM_LINES = ['Var är kortet...', 'Pip pip.', 'Tjugo kronor räcker.', 'Vad var koden nu?'];
const GUARD_LINES = ['Allt lugnt i dag.', 'Ingen springer i banken.', 'Valvet är bara för personal.', 'Trevlig dag!', 'Kassorna är där borta.'];
const BROCH_LINES = [
  () => `📄 SPARA SMART: ${pctTxt()} % ränta varje måndag på det som legat kvar hela veckan – ränta på räntan!`,
  () => '📄 BARNSPAR: Lägg undan lite varje vecka, så växer det av sig självt.',
  () => '📄 DRÖMRESAN: Spara till något stort. Pengar på banken är trygga.',
  () => '📄 AUTOGIRO: Räcker inte fickan till hyran tar banken resten från sparkontot.',
];

// ================= ljud (egna små syntar – ljud är aldrig ett krav) =================
function synth(notes) {
  if (isMuted()) return;
  try {
    const c = audioContext();
    if (!c) return;
    const t0 = c.currentTime;
    for (const [f, at, dur, v, type = 'sine'] of notes) {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t0 + at); gn.gain.exponentialRampToValueAtTime(v, t0 + at + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(gn); gn.connect(c.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    }
  } catch { /* ok */ }
}
const chime = () => synth([[988, 0, 0.9, 0.045], [784, 0.3, 1.1, 0.04]]);                       // ding-dong: nästa kund
const beep = () => synth([[1320, 0, 0.07, 0.03, 'square'], [1760, 0.09, 0.06, 0.025, 'square']]); // bankomaten
const brrr = () => synth(Array.from({ length: 10 }, (_, k) => [170 + (k % 3) * 45, k * 0.032, 0.028, 0.022, 'square'])); // sedelräknaren
const oink = () => synth([[330, 0, 0.12, 0.05, 'sawtooth'], [260, 0.1, 0.14, 0.04, 'sawtooth']]);

// ================= scenen =================
export function makeShopBank(A) {
  const g = A.game;
  if (g.bank == null) g.bank = Math.max(0, Math.round(+(g._keep?.top?.bank) || 0)); // reserv utan game.js-patchen
  const R = art(), L = looks();
  const talk = createSpeech();                   // mina egna tankar
  const talkGuard = createSpeech(), talkAdv = createSpeech();
  const walker = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: H - 4, spawn: [DOOR_X, WALL_Y + 10] });
  walker.speed = 66;
  walker.setObstacles(OBST);
  walker.snapFree();
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, lastHint = -9;
  let seat = null;                  // { x, y, dir, fy, exit } när man sitter (bänken, rådgivaren)
  let meWin = null;                 // kassan jag är på väg till eller står vid
  let pendingAtm = false, pendingHello = 0.8, greetedGuard = false;
  let dlg = null;                   // öppen bankdialog: { kind, win }
  let panelSide = 'left', panelHit = null, nextWin = null, nextT = -9, callCD = 0, served = 0, pigT = -9;
  // klickskydd: ett dubbelklick blir aldrig två transaktioner, och klicket efter att en
  // dialog stängts går inte vidare ner i hallen (performance.now, ms)
  let quietUntil = 0, lastTx = { key: '', at: -1e9 }, wasOpen = null, wasStaff = null;
  const now = () => performance.now();
  const hush = (ms = 350) => { quietUntil = Math.max(quietUntil, now() + ms); };
  const door = { a: 0.4, v: 0 };
  const atm = { occ: null, mode: 'idle', t: 0, kr: 0 };
  const anims = [];                 // sedlar och mynt som flyger
  const hour = () => (g.min / 60) % 24;
  const isNight = () => { const h = hour(); return h >= 19.5 || h < 6.5; };
  const isOpen = () => { const h = hour(); return h >= HOURS[0] && h < HOURS[1]; };
  // personalen är på plats från öppning till en halvtimme efter stängning (de som är kvar betjänas)
  const staffIn = () => { const h = hour(); return h >= HOURS[0] && h < HOURS[1] + STAFF_GRACE; };
  const tellerHere = (i) => staffIn() || !!win[i].occ;   // den som redan står vid luckan blir klar
  const closedTxt = () => `Kassorna har stängt – de öppnar kl. ${HOURS[0]}${hour() >= HOURS[0] ? ' i morgon' : ''}. ${ATM_24 ? 'Bankomaten fungerar dygnet runt.' : 'Bankomaten här inne tar ut pengar.'}`;
  const cam = { x: 0 };
  const camTarget = () => lockedCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  cam.x = camTarget();
  const inView = (x) => x > cam.x - 10 && x < cam.x + VW + 10;

  // ---------- personalen ----------
  const tellers = WINS.map((Wn, i) => ({ i, x: Wn.cx, y: TELLER_Y, look: L.tellers[i], mode: 'idle', dir: 'down', t: 1 + i * 1.7, talk: createSpeech() }));
  const win = WINS.map(() => ({ occ: null, call: -9 }));         // occ: null | kund | 'me'
  const freeWins = () => win.map((w, i) => (w.occ ? -1 : i)).filter((i) => i >= 0);
  const guard = { dir: 'down', t: 3 };
  const adv = { dir: 'down', t: 2, mode: 'idle' };
  function tellerSay(i, s, force = false) {
    const T = tellers[i];
    if (!force && !inView(T.x)) return;
    T.talk.say(s, { x: T.x, y: GLASS_TOP - 1 }, undefined, { voice: T.look });
  }
  const guardSay = (s) => { if (inView(GUARD.x)) talkGuard.say(s, { x: GUARD.x, y: GUARD.y - 42 }, undefined, { voice: L.guard }); };
  const advSay = (s) => talkAdv.say(s, { x: ADV.x, y: ADV.y - 44 }, undefined, { voice: L.adv });
  let lastHintTxt = '';
  const hint = (s) => {
    if (t - lastHint < 0.4) return;
    lastHint = t; lastHintTxt = s; play('click');
    talk.say(s, () => (seat ? { x: seat.x, y: seat.y - 44 } : { x: walker.px, y: walker.py - 44 }), undefined, { voice: 'self' });
  };
  function updateTeller(T, dt) {
    T.t -= dt;
    const busy = win[T.i].occ;
    if (T.mode === 'count') { if (T.t <= 0) { T.mode = busy ? 'serve' : 'idle'; T.dir = 'down'; T.t = 2 + Math.random() * 2; } return; }
    if (busy) { T.mode = 'serve'; T.dir = 'down'; return; }
    if (T.mode === 'serve') { T.mode = 'idle'; T.t = 1.5; }
    if (T.t > 0) return;
    const r = Math.random();
    if (r < 0.35) { T.mode = 'type'; T.dir = 'right'; T.t = 2 + Math.random() * 3; }
    else if (r < 0.55) { T.mode = 'count'; T.dir = 'down'; T.t = 1.4 + Math.random(); }
    else { T.mode = 'idle'; T.dir = 'down'; T.t = 3 + Math.random() * 4; }
  }
  const tellerFrame = (T) => (T.mode === 'count' ? 9 : T.mode === 'type' ? (Math.floor(t * 5 + T.i) % 3 === 0 ? 4 : 0) : Math.sin(t * 1.6 + T.i * 2) > 0.94 ? 4 : 0);

  // ---------- kunderna ----------
  let npcSeed = (g.day | 0) * 173 + 11;
  const queue = [];
  const npcs = [0, 1, 2].map((i) => {
    const w = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: H - 4, spawn: [DOOR_X, WALL_Y + 6] });
    w.setObstacles(OBST); w.speed = 30 + i * 4;
    return { i, w, look: npcLook(npcSeed + i * 29), state: 'away', t: 1.2 + i * 5, plan: [], goal: null, talk: createSpeech(), lineT: -9, win: null, dur: 0, s: 0 };
  });
  const active = () => npcs.filter((n) => n.state !== 'away').length;
  const maxNpcs = () => (isOpen() ? 3 : 0);
  function npcSay(n, s) {
    if (t - n.lineT < 3) return;
    n.lineT = t;
    n.talk.say(s, () => ({ x: n.w.px, y: n.w.py - 42 }), 2.8, { voice: n.look });
  }
  function spawnNpc(n) {
    n.look = npcLook(npcSeed += 37);
    n.w.px = DOOR_X + (n.i - 1) * 4; n.w.py = WALL_Y + 6; n.w.stop(); n.w.dir = 'down';
    n.win = null; n.s = 0;
    const r = Math.random();
    n.plan = r < 0.6 ? [{ kind: 'queue' }]
      : r < 0.8 ? [{ kind: 'atm' }]
        : [Math.random() < 0.5 ? { kind: 'browse', x: BROCH.x, y: BROCH.base + 10, dir: 'up' } : { kind: 'browse', x: PULPET.x + 6, y: PULPET.base + 9, dir: 'up' }, { kind: 'queue' }];
    n.plan.push({ kind: 'exit' });
    door.v = Math.max(door.v, 2);
    if (Math.random() < 0.4) setTimeout(() => guardSay(pick(['Välkommen!', 'God dag!', 'Hej hej!'])), 600);
    nextGoal(n);
  }
  const walkQ = (n) => { const k = Math.max(0, queue.indexOf(n)); const [x, y] = QSLOTS[Math.min(k, QSLOTS.length - 1)]; n.state = 'toQueue'; n.w.walkTo(x, y); };
  const nearAtm = () => Math.hypot(walker.px - ATM_SPOT[0], walker.py - ATM_SPOT[1]) < 26;
  function nextGoal(n) {
    n.goal = n.plan.shift() || null;
    const G = n.goal;
    if (!G) { n.state = 'away'; n.t = 5 + Math.random() * 10; return; }
    if (G.kind === 'queue') { queue.push(n); walkQ(n); return; }
    if (G.kind === 'atm') {
      n.state = 'walk';
      if (atm.occ || pendingAtm || nearAtm()) { n.goal = { kind: 'atmWait' }; n.w.walkTo(ATM_WAIT[0] + 10, ATM_WAIT[1]); }
      else { atm.occ = n; n.w.walkTo(ATM_SPOT[0], ATM_SPOT[1]); }
      return;
    }
    n.state = 'walk';
    if (G.kind === 'browse') n.w.walkTo(G.x, G.y);
    else if (G.kind === 'exit') n.w.walkTo(DOOR_X + (n.i - 1) * 6, WALL_Y + 5);
  }
  function arrive(n) {
    const G = n.goal;
    if (!G) return nextGoal(n);
    if (G.kind === 'queue') { n.state = 'queue'; n.w.dir = 'right'; if (Math.random() < 0.25) npcSay(n, pick(QUEUE_LINES)); return; }
    if (G.kind === 'win') { n.state = 'serve'; n.t = 0; n.s = 0; n.dur = 5 + Math.random() * 3.5; n.w.dir = 'up'; return; }
    if (G.kind === 'atm') { n.state = 'atm'; n.t = 0; n.w.dir = 'up'; atm.mode = 'pin'; atm.t = 0; if (Math.random() < 0.4) npcSay(n, pick(ATM_LINES)); return; }
    if (G.kind === 'atmWait') { n.state = 'atmWait'; n.t = 0; n.w.dir = 'up'; return; }
    if (G.kind === 'browse') { n.state = 'browse'; n.t = 2.5 + Math.random() * 3; n.w.dir = G.dir || 'up'; return; }
    if (G.kind === 'exit') { n.state = 'away'; n.t = 6 + Math.random() * 12; door.v = Math.max(door.v, 2); }
  }
  // köns första kund går fram när en kassa blir ledig – men en kassa hålls alltid ledig åt spelaren
  function tryCall(n) {
    if (t < callCD) return;
    const free = freeWins();
    if (free.length < 2) return;
    const i = free.sort((a, b) => b - a)[0];      // kassa 3 och 2 först – kassa 1 närmast dörren blir kvar
    queue.shift();
    for (const o of queue) walkQ(o);
    win[i].occ = n; win[i].call = t; n.win = i;
    n.goal = { kind: 'win' }; n.state = 'walk';
    n.w.walkTo(WINS[i].cx, SERVE_Y);
    nextWin = i; nextT = t; callCD = t + 1.5;
    if (inView(NEXT.x) || inView(WINS[i].cx)) chime();
    tellerSay(i, pick(TELLER_IDLE));
  }
  function serveTick(n) {
    const T = tellers[n.win];
    if (n.s === 0 && n.t > 0.8) { n.s = 1; npcSay(n, pick(CUST_LINES)); }
    if (n.s === 1 && n.t > 2.6) { n.s = 2; T.mode = 'count'; T.t = 1.8; if (inView(T.x)) brrr(); }
    if (n.s === 2 && n.t > n.dur - 1) { n.s = 3; tellerSay(n.win, pick(TELLER_BYE)); }
    if (n.t > n.dur) { win[n.win].occ = null; n.win = null; served++; nextGoal(n); }
  }
  function updateNpc(n, dt) {
    if (n.state === 'away') {
      n.t -= dt;
      if (n.t <= 0) { if (active() < maxNpcs()) spawnNpc(n); else n.t = 4; }
      return;
    }
    n.w.update(dt);
    if (n.state === 'walk' || n.state === 'toQueue') { if (!n.w.path.length) arrive(n); return; }
    if (n.state === 'queue') {
      if (!staffIn()) { queue.splice(queue.indexOf(n), 1); for (const o of queue) walkQ(o); n.plan = [{ kind: 'exit' }]; nextGoal(n); return; } // kassorna stängda: kön går hem
      if (queue[0] === n) tryCall(n);
      return;
    }
    if (n.state === 'serve') { n.t += dt; serveTick(n); return; }
    if (n.state === 'atm') {
      n.t += dt;
      if (n.t > 1.4 && atm.mode === 'pin') { atm.mode = 'count'; atm.t = 0; }
      if (n.t > 3.8) { atm.occ = null; atm.mode = 'thanks'; atm.t = 0; nextGoal(n); }
      return;
    }
    if (n.state === 'atmWait') {
      n.t += dt;
      if (!atm.occ && !pendingAtm && !nearAtm()) { atm.occ = n; n.goal = { kind: 'atm' }; n.state = 'walk'; n.w.walkTo(ATM_SPOT[0], ATM_SPOT[1]); }
      else if (n.t > 12) nextGoal(n);
      return;
    }
    if (n.state === 'browse') { n.t -= dt; if (n.t <= 0) nextGoal(n); }
  }
  const npcFrame = (n) => (n.w.path.length ? WALK_SEQ[Math.floor(t * 7 + n.i) % 4] : n.state === 'atm' && n.t > 1.2 ? 9 : Math.sin(t * 2 + n.i * 3) > 0.92 ? 4 : 0);

  // ---------- sedlar och mynt i luften ----------
  const bills = (x0, y0, x1, y1, n = 3, delay = 0, kind = 'bill') => anims.push({ kind, x0, y0, x1, y1, n, delay, t: 0, dur: 0.55, arc: kind === 'coin' ? 10 : 6 });
  function drawAnims(ctx) {
    for (const a of anims) {
      if (a.t < a.delay) continue;
      const k = (a.t - a.delay) / a.dur;
      for (let j = 0; j < a.n; j++) {
        const kk = clamp(k * 1.3 - j * 0.15, 0, 1);
        if (kk <= 0 || kk >= 1) continue;
        const x = Math.round(a.x0 + (a.x1 - a.x0) * kk), y = Math.round(a.y0 + (a.y1 - a.y0) * kk - Math.sin(kk * Math.PI) * a.arc);
        if (a.kind === 'coin') { ctx.fillStyle = '#7e5a1a'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#f0c850'; ctx.fillRect(x - 1, y - 1, 2, 2); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 1, y - 1, 1, 1); }
        else { ctx.fillStyle = '#1e5a34'; ctx.fillRect(x - 3, y - 2, 7, 4); ctx.fillStyle = '#6ac88a'; ctx.fillRect(x - 2, y - 1, 5, 2); ctx.fillStyle = '#e8f4d8'; ctx.fillRect(x, y - 1, 1, 2); }
      }
    }
  }

  // ---------- kassan ----------
  const atWin = (i) => i !== null && Math.hypot(walker.px - WINS[i].cx, walker.py - SERVE_Y) < 8;
  function releaseMe() {
    if (meWin !== null && win[meWin].occ === 'me') win[meWin].occ = null;
    meWin = null;
  }
  function goKassa(pref0 = null) {
    releaseMe(); seat = null;
    if (!staffIn()) { hint(`🔒 ${closedTxt()}`); guardSay('Kassorna har stängt för i dag.'); return; }
    let i = pref0;
    if (i === null || win[i].occ) {
      const free = freeWins();
      if (!free.length) { hint('Alla kassor är upptagna – jag väntar en stund.'); return; }
      i = free.sort((a, b) => Math.abs(WINS[a].cx - walker.px) - Math.abs(WINS[b].cx - walker.px))[0];
      if (pref0 !== null) tellerSay(i, `Kassa ${i + 1} är ledig – varsågod!`, true);
    }
    win[i].occ = 'me'; meWin = i;
    walker.walkTo(WINS[i].cx, SERVE_Y, () => { walker.dir = 'up'; atKassa(i); });
  }
  function greetLine() {
    const s = saldoOf(g), ranta = (g.bankLog || []).find((e) => e.t === 'ranta' && e.d === g.day);
    if (ranta) return `Räntan kom i morse: +${groupNum(ranta.n)} kr!`;
    if (s <= 0) return 'Hej! Vill du börja spara?';
    return `Hej! Du har ${groupNum(s)} kr hos oss.`;
  }
  function atKassa(i) {
    tellers[i].mode = 'serve'; tellers[i].dir = 'down';
    tellerSay(i, greetLine(), true);
    play('click');
    openKassa(i);
  }
  const moneyBox = (label, val, bg) => `<div style="flex:1;min-width:130px;background:${bg};border:2px solid var(--ink);padding:4px 8px"><small class="sp">${label}</small><br><b style="font-size:24px">${val}</b></div>`;
  function openKassa(i, receipt = '') {
    dlg = { kind: 'kassa', win: i };
    const s = saldoOf(g), m = Math.floor(g.money), r = nextInterest(g), dn = daysToMonday(g), fresh = s - minOf(g);
    const btn = (kind, kr, label) => {
      const ok = kr > 0 && (kind === 'in' ? kr <= m : kr <= s);
      return `<button class="btn btn-small${kind === 'in' ? ' btn-go' : ' btn-gold'}" data-${kind}="${kr}" ${ok ? '' : 'disabled'}>${label}</button>`;
    };
    const row = (kind) => [50, 100, 500, 1000].map((kr) => btn(kind, kr, groupNum(kr))).join('') + btn(kind, kind === 'in' ? m : s, `Allt (${fmt(Math.max(0, kind === 'in' ? m : s))})`);
    const body = `${receipt ? `<p style="font-size:18px;margin:0 0 8px;background:#e4f6e8;border:2px dashed #2a8a4a;padding:4px 8px">🧾 ${receipt}</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${moneyBox('💰 På fickan', fmt(g.money), g.money < 0 ? '#ffe3e3' : '#fff')}${moneyBox('🏦 Sparkontot', fmt(s), '#eaf6ee')}</div>
      ${g.money < 0 ? `<p class="bad" style="font-size:17px;margin:6px 0 0">⚠️ Du har en skuld på ${fmt(-g.money)}. Ta ut från sparkontot så är den betald.</p>` : ''}
      <p style="font-size:17px;margin:8px 0">📈 <b>${pctTxt()} % ränta</b> varje måndag morgon på det som legat kvar hela veckan – för dig blir det <b class="ok">+${fmt(r)}</b> ${dn === 1 ? 'i morgon bitti' : `om ${dn} dagar`}.${fresh > 0 ? ` <small class="sp">(${fmt(fresh)} som du satt in i veckan ger ränta från nästa vecka.)</small>` : ''}${s > CAP() ? ` <small class="sp">(Räntan räknas på högst ${fmt(CAP())}.)</small>` : ''}</p>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;font-size:18px">
        <b>⬆️ Sätt in</b><span style="display:flex;gap:4px;flex-wrap:wrap">${row('in')}</span>
        <b>⬇️ Ta ut</b><span style="display:flex;gap:4px;flex-wrap:wrap">${row('ut')}</span>
        <b>✏️ Eget</b><span style="display:flex;gap:4px;flex-wrap:wrap;align-items:center"><input id="bank-kr" type="number" min="1" step="1" inputmode="numeric" placeholder="kr" style="width:96px;font:inherit;font-size:18px;padding:2px 6px;border:2px solid var(--ink)"><button class="btn btn-small btn-go" data-own="in">Sätt in</button><button class="btn btn-small btn-gold" data-own="ut">Ta ut</button></span>
      </div>
      <p class="sp" style="font-size:15px;margin:10px 0 0">🔒 Pengarna på banken är trygga. Hyran dras först från fickan – räcker den inte tar banken resten från sparkontot, så du slipper hamna i skuld.</p>`;
    const el = openModal(`🏦 Kassa ${i + 1} – Pixelbanken`, body, [
      { label: '📄 Kontoutdrag', onClick: () => openStatement(() => openKassa(i)) },
      { label: 'Klar', cls: 'btn-go', onClick: closeModal },
    ]);
    el.querySelectorAll('[data-in]').forEach((b) => (b.onclick = () => doTx('in', +b.dataset.in, i)));
    el.querySelectorAll('[data-ut]').forEach((b) => (b.onclick = () => doTx('ut', +b.dataset.ut, i)));
    el.querySelectorAll('[data-own]').forEach((b) => (b.onclick = () => {
      const v = Math.floor(+el.querySelector('#bank-kr')?.value || 0);
      if (v <= 0) { play('fel'); toast('✏️ Skriv ett belopp först.', 'bad'); return; }
      doTx(b.dataset.own, v, i);
    }));
    return el;
  }
  // en insättning eller ett uttag i kassa i (kassörens räknande och sedlarna är bara för syns skull)
  function doTx(kind, kr, i = 0, { reopen = true } = {}) {
    // samma knapp två gånger inom 0,4 s = ett dubbelklick: bara den första räknas
    const key = `${kind}:${kr}`;
    if (key === lastTx.key && now() - lastTx.at < 400) return { ok: false, dup: true, msg: '' };
    const r = bankDo(g, kind, kr, 'kassa');
    if (r.ok) lastTx = { key, at: now() };
    if (!r.ok) {
      play('fel'); toast(`🏦 ${r.msg}`, 'bad');
      tellerSay(i, kind === 'in' ? 'Så mycket har du inte på fickan.' : 'Så mycket finns inte på kontot.', true);
      return r;
    }
    play('coin'); brrr();
    const T = tellers[i], wx = WINS[i].cx;
    T.mode = 'count'; T.t = 1.5; T.dir = 'down';
    if (kind === 'in') { bills(walker.px, walker.py - 24, wx, CNT.top + 2, 3); tellerSay(i, pick([`${groupNum(r.kr)} kronor in på kontot!`, 'Tack! Pengarna är trygga här.', 'Insatt och klart!']), true); }
    else { bills(wx, CNT.top + 2, walker.px, walker.py - 24, 3, 0.9); tellerSay(i, `Varsågod – ${groupNum(r.kr)} kronor.`, true); }
    const rc = `${kind === 'in' ? '⬆️ Insatt' : '⬇️ Uttaget'} <b>${fmt(r.kr)}</b> · sparkontot nu <b>${fmt(saldoOf(g))}</b> · på fickan <b>${fmt(g.money)}</b>`;
    if (reopen && modalOpen() && dlg?.kind === 'kassa') openKassa(i, rc);
    return r;
  }
  // ---------- kontoutdraget ----------
  const LOG_TXT = { in: ['⬆️', 'Insättning', 1], ut: ['⬇️', 'Uttag i kassan', -1], atm: ['🏧', 'Uttag i bankomaten', -1], ranta: ['📈', 'Ränta', 1], hyra: ['🏠', 'Hyran (autogiro)', -1] };
  function openStatement(back) {
    const log = (g.bankLog || []).slice().reverse();
    const rows = log.length ? log.map((e) => {
      const [ic, nm, sg] = LOG_TXT[e.t] || ['•', String(e.t), 1];
      const when = `${DAY_NAMES[(Math.max(1, e.d | 0) - 1) % 7]} · dag ${e.d | 0}${e.m != null ? ' · ' + clock(e.m) : ''}`;
      return `<div class="prow" style="grid-template-columns:40px 1fr auto"><span style="font-size:24px;text-align:center">${ic}</span><span class="nm">${esc(nm)}<br><small class="sp">${esc(when)}</small></span><b class="${sg > 0 ? 'ok' : 'bad'}" style="font-size:20px">${sg > 0 ? '+' : '−'}${fmt(e.n)}</b></div>`;
    }).join('') : '<p style="font-size:18px">Inga händelser än. Sätt in pengar i kassan så börjar kontot växa!</p>';
    const dn = daysToMonday(g);
    openModal('📄 Kontoutdrag – Sparkonto', `<p style="font-size:19px;margin-top:0">🏦 Saldo: <b>${fmt(saldoOf(g))}</b> · 📈 räntan ${dn === 1 ? 'i morgon' : 'på måndag'}: <b class="ok">+${fmt(nextInterest(g))}</b></p><div class="plist">${rows}</div>`, [
      ...(back ? [{ label: '↩ Tillbaka', onClick: back }] : []),
      { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
    ]);
  }
  // ---------- bankomaten ----------
  function releaseAtm() { if (atm.occ === 'me') { atm.occ = null; if (atm.mode === 'menu') atm.mode = 'idle'; } }
  function goAtm() {
    releaseMe(); seat = null;
    if (atm.occ && atm.occ !== 'me') { pendingAtm = true; walker.walkTo(ATM_WAIT[0] - 10, ATM_WAIT[1]); hint('Någon tar ut pengar – jag väntar på min tur.'); return; }
    atm.occ = 'me';
    walker.walkTo(ATM_SPOT[0], ATM_SPOT[1], () => { walker.dir = 'up'; atm.mode = 'menu'; atm.t = 0; beep(); openAtm(); });
  }
  function openAtm() {
    dlg = { kind: 'atm' };
    const s = saldoOf(g);
    const ab = (kr, label) => `<button class="btn btn-small" data-atm="${kr}" ${kr > 0 && kr <= s ? '' : 'disabled'} style="background:#1e8a4a;color:#fff;text-shadow:1px 1px 0 #0a3a1e">${label}</button>`;
    const body = `<div style="background:#0d2a22;border:4px solid #4a5058;box-shadow:inset 0 0 0 2px #1e8a4a;color:#bfffd0;padding:10px 12px;font-size:19px;line-height:1.25">
        <div style="display:flex;justify-content:space-between"><span>SPARKONTO</span><b>${fmt(s)}</b></div>
        <div style="display:flex;justify-content:space-between;opacity:.75"><span>PÅ FICKAN</span><span>${fmt(g.money)}</span></div>
        ${s > 0 ? `<div style="margin-top:8px">VÄLJ BELOPP:</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px">${[100, 200, 500, 1000, 2000].map((kr) => ab(kr, groupNum(kr) + ' kr')).join('')}${ab(s, 'ALLT')}</div>`
          : '<div style="margin-top:8px">KONTOT ÄR TOMT.<br>SÄTT IN PENGAR I KASSAN FÖRST.</div>'}
      </div>
      <p class="sp" style="font-size:15px;margin:8px 0 0">🏧 Bankomaten tar bara ut – vill du sätta in går du till kassan. Uttaget dras från sparkontot.</p>`;
    const el = openModal('🏧 Bankomat – Pixelbanken', body, [{ label: 'Avbryt', onClick: closeModal }]);
    el.querySelectorAll('[data-atm]').forEach((b) => (b.onclick = () => { hush(); closeModal(); atmWithdraw(+b.dataset.atm); }));
    return el;
  }
  function atmWithdraw(kr) {
    const r = bankDo(g, 'ut', kr, 'atm');
    if (!r.ok) { play('fel'); toast(`🏧 ${r.msg}`, 'bad'); return r; }
    beep(); atm.mode = 'count'; atm.t = 0; atm.kr = r.kr;
    toast(`🏧 Du tog ut ${fmt(r.kr)} – på sparkontot finns ${fmt(saldoOf(g))} kvar.`, 'good');
    return r;
  }
  function updateAtm(dt) {
    atm.t += dt;
    if (atm.mode === 'count' && atm.t > 1.0) { atm.mode = 'cash'; atm.t = 0; brrr(); }
    else if (atm.mode === 'cash' && atm.t > 1.4) {
      atm.mode = 'thanks'; atm.t = 0;
      if (atm.occ === 'me') { bills(ATM_SPOT[0], ATM.top + 52, walker.px, walker.py - 24, 3); play('coin'); talk.say(`💵 ${groupNum(atm.kr)} kr – tack, bankomaten!`, () => ({ x: walker.px, y: walker.py - 44 }), 2.5, { voice: 'self' }); }
    } else if (atm.mode === 'thanks' && atm.t > 1.6) { atm.mode = atm.occ === 'me' ? 'menu' : 'idle'; atm.t = 0; }
    else if (atm.mode === 'menu' && atm.occ !== 'me') atm.mode = 'idle';
  }
  // ---------- rådgivaren ----------
  function goAdvisor() {
    releaseMe(); releaseAtm();
    if (!staffIn()) { hint(`💼 Rådgivaren har gått hem för i dag – hon sitter här ${HOURS[0]}–${HOURS[1]}.`); return; }
    const [x, b] = GUESTS[0];
    walker.walkTo(x, b + 8, () => {
      seat = { x, y: b - 4, dir: 'up', fy: b + 0.5, exit: [x, b + 8] };
      play('click');
      advSay(saldoOf(g) > 0 ? `Välkommen! Ditt sparkonto växer med ${pctTxt()} % i veckan.` : 'Välkommen! Ska vi prata sparande?');
      openAdvisor();
    });
  }
  function openAdvisor() {
    dlg = { kind: 'adv' };
    const s = saldoOf(g), r = nextInterest(g), dn = daysToMonday(g), fresh = s - minOf(g);
    const amounts = [...new Set([s > 0 ? s : null, 500, 1000, 5000].filter(Boolean))].slice(0, 4);
    const rows = amounts.map((kr) => `<tr style="border-top:2px dashed #c8bca8"><td style="padding:3px 4px"><b>${fmt(kr)}</b>${kr === s ? ' <small class="sp">(ditt)</small>' : ''}</td><td>${fmt(growOf(kr, 1))}</td><td>${fmt(growOf(kr, 4))}</td><td class="ok"><b>${fmt(growOf(kr, 10))}</b></td></tr>`).join('');
    const name = esc(A.avatar?.name || 'du');
    const body = `<p style="font-size:19px;margin-top:0">"Hej ${name}! Ett sparkonto hos oss ger <b>${pctTxt()} % ränta varje vecka</b> på det som legat kvar hela veckan, måndag till måndag. Räntan sätts in varje måndag morgon – och veckan därpå får du ränta på räntan!"</p>
      <div style="background:#fff;border:2px solid var(--ink);padding:6px 10px;font-size:18px">
        <div style="display:flex;justify-content:space-between"><span>🏦 Ditt saldo</span><b>${fmt(s)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>📈 Ränta ${dn === 1 ? 'i morgon' : `om ${dn} dagar`}</span><b class="ok">+${fmt(r)}</b></div>
        ${fresh > 0 ? `<div style="font-size:15px" class="sp">${fmt(fresh)} har du satt in i veckan – de ger ränta från nästa vecka.</div>` : ''}
      </div>
      <p style="font-size:18px;margin:10px 0 4px"><b>🧮 Räntekalkyl</b> – hela veckor, om pengarna får ligga kvar:</p>
      <table style="width:100%;font-size:17px;border-collapse:collapse;text-align:left"><tr><th>Insatt</th><th>1 vecka</th><th>4 veckor</th><th>10 veckor</th></tr>${rows}</table>
      <p class="sp" style="font-size:15px;margin:10px 0 0">🔒 Tryggt: pengarna på banken rörs bara av hyran, och bara när fickan inte räcker (autogiro). Räntan räknas på högst ${fmt(CAP())}. ${ATM_24 ? 'Bankomaten tar ut dygnet runt.' : 'I bankomaten tar du ut utan att köa.'}</p>`;
    return openModal('💼 Rådgivaren – Sparkonto', body, [
      { label: '📄 Kontoutdrag', onClick: () => openStatement(() => openAdvisor()) },
      { label: '🏦 Till kassan', onClick: () => { closeModal(); if (seat) { [walker.px, walker.py] = seat.exit; seat = null; } goKassa(null); } },
      { label: 'Tack!', cls: 'btn-go', onClick: closeModal },
    ]);
  }
  // ---------- bänken och ut ----------
  function sitBench(x) {
    const sx = Math.abs(x - BENCH_SEATS[0]) < Math.abs(x - BENCH_SEATS[1]) ? BENCH_SEATS[0] : BENCH_SEATS[1];
    releaseMe(); releaseAtm();
    walker.walkTo(sx, BENCH.base - 14, () => { seat = { x: sx, y: BENCH.base - 5, dir: 'up', fy: BENCH.base + 0.5, exit: [sx, BENCH.base - 14] }; play('click'); });
  }
  function leave() { releaseMe(); releaseAtm(); door.v = Math.max(door.v, 2.5); play('door'); A.go('city'); }

  // ---------- klickbara platser (världskoordinater) ----------
  const spots = [
    { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 10, DOOR.x1 + 3, WALL_Y + 10], go: [DOOR_X, WALL_Y + 6], face: 'up', key: true, label: 'UTGÅNG', hint: 'TILLBAKA UT PÅ GATAN', act: leave },
    ...WINS.map((Wn) => ({ id: 'kassa' + Wn.i, win: Wn.i, key: true, r: [Wn.x0 + 4, GLASS_TOP - 2, Wn.x1 - 4, CNT.base], label: `KASSA ${Wn.i + 1}`, act: () => goKassa(Wn.i) })),
    { id: 'bankomat', key: true, r: [ATM.x0 - 3, ATM.top - 11, ATM.x1 + 3, WALL_Y + 4], label: 'BANKOMAT', act: goAtm },
    { id: 'radgivare', key: true, r: [DESK.x0, WALL_Y - 14, DESK.x1, DESK.base], label: 'RÅDGIVAREN', act: goAdvisor },
    { id: 'valv', r: [VAULT.cx - 28, VAULT.cy - 28, VAULT.cx + 45, VAULT.cy + 23], label: 'VALVET', hint: 'BARA FÖR PERSONAL',
      act: () => { hint(`🔒 Valvet! Guldtackor, säckar och bankfack – och någonstans därinne mina ${groupNum(saldoOf(g))} kr.`); tellerSay(1, 'Valvet är bara för personal!', true); } },
    { id: 'rantetavla', r: [BOARD_L.x0, BOARD_L.y0, BOARD_L.x1, BOARD_L.y1], label: 'SPARRÄNTAN', hint: `${pctTxt()} % VARJE MÅNDAG`,
      act: () => hint(`📈 ${pctTxt()} % ränta i veckan på det som legat kvar hela veckan. Jag får +${groupNum(nextInterest(g))} kr på måndag.`) },
    { id: 'valuta', r: [BOARD_R.x0, BOARD_R.y0, BOARD_R.x1, BOARD_R.y1], label: 'VALUTA', hint: 'EURO, DOLLAR, PUND OCH YEN',
      act: () => hint('💱 En euro kostar elva och femtio. Ett yen kostar nästan ingenting!') },
    { id: 'borsen', r: [BORS.x0, BORS.y0, BORS.x1, TICK.y1], label: 'BÖRSEN', hint: 'KURSERNA TICKAR',
      act: () => hint(`📊 ${stocks[0].n} ${stocks[0].d >= 0 ? 'upp' : 'ner'} ${String(Math.abs(stocks[0].d).toFixed(1)).replace('.', ',')} %. Ingen aning vad det betyder, men pilarna blinkar.`) },
    { id: 'portratt', r: [PORTRAIT.x0, PORTRAIT.y0, PORTRAIT.x1, PORTRAIT.y1 + 8], label: 'GRUNDAREN', hint: 'GUSTAF PIXEL 1887',
      act: () => hint('🎩 Gustaf Pixel startade banken 1887. Han har monokel och mustasch – och ser lite sträng ut.') },
    { id: 'klocka', r: [CLOCK.x - 10, CLOCK.y - 10, CLOCK.x + 10, CLOCK.y + 10], label: 'KLOCKAN', hint: `ÖPPET ${HOURS[0]}-${HOURS[1]}`,
      act: () => hint(`🕒 Klockan är ${clock(g.min)}. Banken har öppet ${HOURS[0]}–${HOURS[1]}${ATM_24 ? ' – bankomaten dygnet runt' : ''}.`) },
    { id: 'vakt', r: [GUARD.x - 9, GUARD.y - 40, GUARD.x + 9, GUARD.y + 1], go: [GUARD.x, GUARD.y + 12], face: 'up', label: 'VÄKTAREN', hint: 'HÅLLER KOLL PÅ BANKEN',
      act: () => { guard.dir = 'down'; guardSay(pick(GUARD_LINES)); } },
    { id: 'pulpet', r: [PULPET.x - 27, PULPET.base - 30, PULPET.x + 27, PULPET.base], go: [PULPET.x, PULPET.base + 9], face: 'up', label: 'SKRIVPULPETEN', hint: 'BLANKETTER OCH PENNOR',
      act: () => hint('🖊️ Blanketter för insättning och uttag. Pennorna sitter fast i kedjor – ingen tar hem en bankpenna.') },
    { id: 'banken', r: [BENCH.x - 33, BENCH.base - 16, BENCH.x + 33, BENCH.base + 1], label: 'BÄNKEN', hint: 'SITT OCH VILA EN STUND', act: null },
    { id: 'spargris', r: [PIG.x - 13, PIG.base - 30, PIG.x + 13, PIG.base], go: [PIG.x + 20, PIG.base - 2], face: 'left', label: 'SPARGRISEN', hint: 'BARNSPAR',
      act: () => { pigT = t; oink(); for (let k = 0; k < 3; k++) bills(walker.px - 6, walker.py - 22, PIG.x, PIG.base - 28, 1, k * 0.18, 'coin'); setTimeout(() => play('coin'), 450); hint('🐷 Oink! Spargrisen säger: lite i taget blir mycket till slut.'); } },
    { id: 'broschyrer', r: [BROCH.x - 12, BROCH.base - 42, BROCH.x + 12, BROCH.base], go: [BROCH.x, BROCH.base + 10], face: 'up', label: 'BROSCHYRER', hint: 'TA EN!',
      act: () => { hint(BROCH_LINES[brochK++ % BROCH_LINES.length]()); } },
    { id: 'nasta', r: [NEXT.x - 18, NEXT.base - 32, NEXT.x + 18, NEXT.base], label: 'NÄSTA KUND', hint: 'VISAR VILKEN KASSA SOM ÄR LEDIG',
      act: () => { const f = freeWins(); hint(!staffIn() ? `🔔 ${closedTxt()}` : f.length ? `🔔 Kassa ${f[0] + 1} är ledig – jag behöver inte köa.` : '🔔 Alla kassor är upptagna just nu.'); } },
    { id: 'kon', r: [POSTS[0] - 4, ROPES[0] - 18, POSTS[5] + 4, ROPES[1] + 2], label: 'KÖN', hint: 'KUNDERNA VÄNTAR HÄR',
      act: () => hint('🎗️ Kön är för kunderna – jag kan gå direkt till en ledig kassa.') },
    ...[WIN_A, WIN_B].map((Wn, k) => ({ id: 'fonster' + k, r: [Wn.x0 - 3, Wn.top - 8, Wn.x1 + 3, Wn.bot + 3], label: 'FÖNSTRET', hint: 'FINANSKVARTERET',
      act: () => hint(k ? '🏙️ Glasskyskrapor ända upp i himlen. Finanskvarteret!' : '🏙️ Höga hus överallt – och där borta ett gammalt stenhus mitt emellan.') })),
    ...[PALM_L, PALM_R].map((p, k) => ({ id: 'palm' + k, r: [p.x - 14, p.base - 56, p.x + 14, p.base], label: 'PALMEN', hint: 'I EN URNA AV MÄSSING', act: () => hint('🌴 En palm i en mässingsurna. Någon putsar den varje morgon.') })),
  ];
  let brochK = 0;
  spots.find((s) => s.id === 'banken').act = () => sitBench(walker.px);
  const spotAt = (x, y) => spots.find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const spotById = (id) => spots.find((s) => s.id === id);
  function focusSpot() {
    const h = hoverId && t - hoverT < 4 && spotById(hoverId);
    if (h && h.label) return h;
    if (walker.path.length || seat) return null;
    if (meWin !== null && atWin(meWin)) return spotById('kassa' + meWin);
    if (Math.hypot(walker.px - ATM_SPOT[0], walker.py - ATM_SPOT[1]) < 8) return spotById('bankomat');
    if (Math.hypot(walker.px - DOOR_X, walker.py - WALL_Y - 6) < 8) return spotById('dorr');
    return null;
  }
  function clickSpot(s) {
    if (Array.isArray(s.go)) walker.walkTo(s.go[0], s.go[1], () => { if (s.face) walker.dir = s.face; s.act(); });
    else s.act();
  }

  // ---------- det som lever ----------
  const stocks = [{ n: 'PIXEL', v: 128.4 }, { n: 'SNABB', v: 54.2 }, { n: 'BURGR', v: 77.9 }, { n: 'MÖBEL', v: 212.5 }].map((s) => ({ ...s, d: 0 }));
  let stockT = 0;
  function tickStocks() {
    for (const s of stocks) { const d = (Math.random() - 0.46) * 2.4; s.v = Math.max(1, s.v * (1 + d / 100)); s.d = d; }
  }
  tickStocks();
  const outCars = [0, 1].map((i) => ({ x: i * 95, dir: i ? -1 : 1, s: i * 3 % CAR_COLS.length, v: 34 + i * 8 }));
  const outPeds = [0, 1, 2].map((i) => ({ look: npcLook(900 + i * 13), x: 20 + i * 64, v: (i % 2 ? -1 : 1) * (11 + i * 2), ph: i }));
  function updateOutside(dt) {
    for (const c of outCars) {
      c.x += c.v * c.dir * dt;
      if (c.dir > 0 && c.x > OUT_W + 30) { c.x = -40 - Math.random() * 80; c.s = Math.floor(Math.random() * CAR_COLS.length); }
      if (c.dir < 0 && c.x < -40) { c.x = OUT_W + 30 + Math.random() * 80; c.s = Math.floor(Math.random() * CAR_COLS.length); }
    }
    for (const p of outPeds) { p.x += p.v * dt; if (p.x > OUT_W + 16) p.x = -16; else if (p.x < -16) p.x = OUT_W + 16; }
  }
  function drawOutside(ctx, night) {
    ctx.drawImage(outsideImg(night), 0, 0);
    for (const c of outCars) ctx.drawImage(R.cars[c.s][c.dir > 0 ? 0 : 1], Math.round(c.x) - 15, c.dir > 0 ? 88 : 83);
    for (const p of outPeds) drawPerson(ctx, p.x, 106, p.look, p.v > 0 ? 'right' : 'left', WALK_SEQ[(Math.floor(t * 7) + p.ph) % 4]);
    if (night && Math.floor(t * 1.2) % 2) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(SPIRE.x, SPIRE.y, 1, 1); ctx.fillStyle = 'rgba(255,60,60,.35)'; ctx.fillRect(SPIRE.x - 1, SPIRE.y - 1, 3, 3); }
    // ett flygplan som blinkar förbi högt uppe (natt) / ett som glänser (dag)
    const px = ((t * 9) % (OUT_W + 120)) - 60;
    if (night) { if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px), 34, 1, 1); } ctx.fillStyle = '#ff5050'; ctx.fillRect(Math.round(px) + 2, 34, 1, 1); }
    else { ctx.fillStyle = '#f4f8fc'; ctx.fillRect(Math.round(px), 36, 4, 1); ctx.fillRect(Math.round(px) + 1, 35, 1, 3); }
  }
  function drawDoorWings(ctx) {
    const cx = DOOR_X, RR = (DOOR.x1 - DOOR.x0) / 2 - 3, y0 = DOOR.top + 3, y1 = WALL_Y - 1;
    const wings = [0, 1, 2, 3].map((k) => { const a = door.a + k * Math.PI / 2; return { x: cx + Math.cos(a) * RR, z: Math.sin(a) }; }).sort((p, q2) => q2.z - p.z);
    for (const w of wings) {
      const x0 = Math.round(Math.min(cx, w.x)), x1 = Math.round(Math.max(cx, w.x)), back = w.z > 0;
      ctx.fillStyle = back ? 'rgba(200,230,240,.10)' : 'rgba(225,242,250,.2)';
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), y1 - y0);
      ctx.fillStyle = back ? '#7e5a1a' : '#e0b850';
      ctx.fillRect(Math.round(w.x) - (w.x < cx ? 0 : 1), y0, 2, y1 - y0);
      ctx.fillRect(x0, Math.round((y0 + y1) / 2), Math.max(1, x1 - x0), 1);         // tryckstången
      ctx.fillRect(x0, y1 - 3, Math.max(1, x1 - x0), 1);                             // sparklisten
    }
    ctx.fillStyle = '#b88a2a'; ctx.fillRect(cx - 1, y0, 2, y1 - y0); ctx.fillStyle = '#fff0a0'; ctx.fillRect(cx - 1, y0, 1, y1 - y0);
  }
  function drawClockHands(ctx) {
    const { x, y } = CLOCK, ha = ((g.min / 60) % 12) / 12 * Math.PI * 2, ma = (g.min % 60) / 60 * Math.PI * 2;
    ctx.fillStyle = '#1e1a22';
    for (let k = 0; k <= 3; k++) ctx.fillRect(Math.round(x + Math.sin(ha) * k), Math.round(y - Math.cos(ha) * k), 1, 1);
    ctx.fillStyle = '#3a3440';
    for (let k = 0; k <= 5; k++) ctx.fillRect(Math.round(x + Math.sin(ma) * k), Math.round(y - Math.cos(ma) * k), 1, 1);
    ctx.fillStyle = '#c9323a'; ctx.fillRect(x, y, 1, 1);
  }
  function drawAtmScreen(ctx) {
    const x = ATM.x0 + 4, y = ATM.top + 13, w = ATM.x1 - ATM.x0 - 8, h = 16, cx = (ATM.x0 + ATM.x1) / 2;
    ctx.fillStyle = '#0e3a2a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(120,255,170,.08)'; ctx.fillRect(x, y + (Math.floor(t * 20) % h), w, 1);
    const line = (s, yy, c = '#9affc0') => ctxText(ctx, SM, s, Math.round(cx - textW(SM, s) / 2), yy, c);
    if (atm.mode === 'idle') { line('HEJ!', y + 2); if (Math.floor(t * 1.5) % 2) line('UTTAG', y + 9, '#ffffff'); }
    else if (atm.mode === 'menu') { line('VÄLJ', y + 2); line('SUMMA', y + 9, '#ffffff'); }
    else if (atm.mode === 'pin') { line('KOD', y + 2); const n = Math.min(4, Math.floor(atm.t * 3)); for (let k = 0; k < 4; k++) { ctx.fillStyle = k < n ? '#ffffff' : '#2a6a4a'; ctx.fillRect(Math.round(cx) - 7 + k * 4, y + 10, 2, 2); } }
    else if (atm.mode === 'count') { line('RÄKNAR', y + 2); const k = Math.floor(atm.t * 8) % 4; ctx.fillStyle = '#ffffff'; for (let i = 0; i <= k; i++) ctx.fillRect(Math.round(cx) - 5 + i * 3, y + 10, 2, 2); }
    else { line('TACK!', y + 5, '#ffffff'); }
    // kortläsarens lampa och sedlarna som sticker ut ur luckan
    ctx.fillStyle = atm.mode === 'idle' ? (Math.floor(t * 2) % 2 ? '#40e070' : '#1a6a3a') : '#40e070'; ctx.fillRect(ATM.x1 - 5, ATM.top + 38, 2, 1);
    if (atm.mode === 'cash') {
      const out = Math.min(4, Math.floor(atm.t * 10));
      for (let k = 0; k < 3; k++) { ctx.fillStyle = '#1e5a34'; ctx.fillRect(ATM.x0 + 9 + k * 6, ATM.top + 55, 5, out); ctx.fillStyle = '#7ad89a'; ctx.fillRect(ATM.x0 + 10 + k * 6, ATM.top + 55, 3, Math.max(0, out - 1)); }
    }
  }
  function drawBors(ctx) {
    const { x0, x1, y0 } = BORS;
    stocks.forEach((s, i) => {
      const y = y0 + 13 + i * 6, up = s.d >= 0, col = up ? '#5aff8a' : '#ff6a5a';
      ctxText(ctx, SM, s.n, x0 + 5, y, '#ffc850');
      const v = s.v.toFixed(1).replace('.', ','), vx = x1 - 10 - textW(SM, v);
      ctxText(ctx, SM, v, vx, y, col);
      ctx.fillStyle = col;
      if (up) { ctx.fillRect(x1 - 7, y + 3, 5, 1); ctx.fillRect(x1 - 6, y + 2, 3, 1); ctx.fillRect(x1 - 5, y + 1, 1, 1); }
      else { ctx.fillRect(x1 - 7, y + 1, 5, 1); ctx.fillRect(x1 - 6, y + 2, 3, 1); ctx.fillRect(x1 - 5, y + 3, 1, 1); }
    });
    // löpremsan
    const T = TICK, msg = `PIXELBANKEN · SPARKONTO ${pctTxt()} % I VECKAN · ` + stocks.map((s) => `${s.n} ${s.d >= 0 ? '+' : '-'}${Math.abs(s.d).toFixed(1).replace('.', ',')} %`).join(' · ') + ' · ';
    const mw = textW(SM, msg) + 2, off = Math.floor(t * 16) % mw;
    ctx.save(); ctx.beginPath(); ctx.rect(T.x0 + 2, T.y0 + 2, T.x1 - T.x0 - 4, T.y1 - T.y0 - 4); ctx.clip();
    for (let k = 0; k < 2; k++) ctxText(ctx, SM, msg, T.x0 + 3 - off + k * mw, T.y0 + 2, '#ff9a3a');
    ctx.restore();
  }
  function liveWall(ctx, night, cx, vw) {
    drawClockHands(ctx);
    drawDoorWings(ctx);
    if (ATM.x0 < cx + vw + 10 && BORS.x1 > cx - 10) { drawAtmScreen(ctx); drawBors(ctx); }
    // valutatavlan: en pil som blinkar
    if (Math.floor(t * 1.3) % 3 === 0) { ctx.fillStyle = '#5aff8a'; ctx.fillRect(BOARD_R.x1 - 5, BOARD_R.y0 + 16, 1, 3); ctx.fillRect(BOARD_R.x1 - 6, BOARD_R.y0 + 17, 3, 1); }
    // guldet i valvet glimmar
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.7 + k * 0.37) % 1;
      if (ph < 0.12) {
        const gx = VAULT.cx - 10 + ((k * 7) % 14), gy = VAULT.cy + 12 - (k % 2) * 3;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(gx, gy - 1, 1, 3); ctx.fillRect(gx - 1, gy, 3, 1);
      }
    }
    if (night) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffe0a0'; ctx.fillRect(VAULT.cx - 14, VAULT.cy - 14, 28, 1); ctx.globalAlpha = 1; }
  }
  // kassalamporna, sedlar i händerna och NÄSTA KUND-texten
  function liveCounter(ctx) {
    for (const Wn of WINS) {
      const [lx, ly] = lampOf(Wn);
      if (!tellerHere(Wn.i)) {                     // stängt: släckt lampa och en STÄNGT-skylt i glaset
        ctx.fillStyle = '#4a1612'; ctx.fillRect(lx - 1, ly, 2, 2);
        const s = 'STÄNGT', tw = textW(SM, s), x0 = Wn.cx - Math.round((tw + 6) / 2), y0 = GLASS_TOP + 19;
        ctx.fillStyle = 'rgba(126,90,26,.9)'; ctx.fillRect(x0 + 2, GLASS_TOP + 7, 1, y0 - GLASS_TOP - 7); ctx.fillRect(x0 + tw + 3, GLASS_TOP + 7, 1, y0 - GLASS_TOP - 7); // snörena
        ctx.fillStyle = '#2a0a10'; ctx.fillRect(x0 - 1, y0 - 1, tw + 8, 11);
        ctx.fillStyle = '#9a2032'; ctx.fillRect(x0, y0, tw + 6, 9); ctx.fillStyle = '#c83a4c'; ctx.fillRect(x0, y0, tw + 6, 1);
        ctxText(ctx, SM, s, x0 + 3, y0 + 3, '#fff0d0');
        continue;
      }
      const o = win[Wn.i].occ, called = t - win[Wn.i].call < 2 && Math.floor(t * 6) % 2;
      ctx.fillStyle = called ? '#ffffff' : o === 'me' ? '#ffd040' : o ? '#e0503a' : '#40e070';
      ctx.fillRect(lx - 1, ly, 2, 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(lx - 1, ly, 1, 1);
    }
  }
  function drawNext(ctx) {
    const x0 = NEXT.x - 18 + 3, y0 = NEXT.base - 31 + 2;
    const fresh = nextWin !== null && t - nextT < 8;
    const l1 = 'NÄSTA', l2 = fresh ? `KASSA ${nextWin + 1}` : 'KUND';
    const blink = fresh && t - nextT < 3 && Math.floor(t * 4) % 2 === 0;
    ctxText(ctx, SM, l1, x0 + Math.round((30 - textW(SM, l1)) / 2), y0 + 1, '#ff5a3a');
    ctxText(ctx, SM, l2, x0 + Math.round((30 - textW(SM, l2)) / 2), y0 + 7, blink ? '#ffffff' : '#ffb03a');
  }
  function drawTeller(ctx, T) {
    drawPerson(ctx, T.x, T.y, T.look, T.dir, tellerFrame(T));
    if (T.mode === 'count') { // en sedelbunt som bläddras
      const k = Math.floor(t * 10) % 3;
      ctx.fillStyle = '#1e5a34'; ctx.fillRect(T.x - 4, T.y - 17, 8, 3);
      ctx.fillStyle = '#7ad89a'; ctx.fillRect(T.x - 3 + k * 2, T.y - 18, 3, 3);
    }
  }

  // ---------- hela hallen (även för panorama) ----------
  function drawWorld(ctx, cx, vw) {
    const night = isNight();
    if (cx < OUT_W) drawOutside(ctx, night);
    ctx.drawImage(roomImg(night), cx, 0, vw, H, cx, 0, vw, H);
    liveWall(ctx, night, cx, vw);
    const items = [];
    const add = (fy, x0, x1, draw) => { if (x1 >= cx - 8 && x0 <= cx + vw + 8) items.push({ fy, draw }); };
    for (const T of tellers) if (tellerHere(T.i)) add(T.y, T.x - 12, T.x + 12, () => drawTeller(ctx, T));
    add(CNT.base, CNT.x0 - 4, CNT.x1 + 4, () => { put(ctx, R.counter); liveCounter(ctx); });
    add(ROPES[0], POSTS[0] - 16, POSTS[5] + 6, () => put(ctx, R.ropes[0]));
    add(ROPES[1], POSTS[0] - 16, POSTS[5] + 6, () => put(ctx, R.ropes[1]));
    add(PALM_L.base, PALM_L.x - 24, PALM_L.x + 24, () => putA(ctx, R.palmL, PALM_L.x, PALM_L.base));
    add(PALM_R.base, PALM_R.x - 24, PALM_R.x + 24, () => putA(ctx, R.palmR, PALM_R.x, PALM_R.base));
    add(GUARD.y, GUARD.x - 12, GUARD.x + 12, () => drawPerson(ctx, GUARD.x, GUARD.y, L.guard, guard.dir, Math.sin(t * 1.3) > 0.95 ? 4 : 0));
    add(PULPET.base, PULPET.x - 27, PULPET.x + 27, () => putA(ctx, R.pulpet, PULPET.x, PULPET.base));
    add(BENCH.base, BENCH.x - 33, BENCH.x + 33, () => putA(ctx, R.bench, BENCH.x, BENCH.base));
    add(NEXT.base, NEXT.x - 18, NEXT.x + 18, () => { putA(ctx, R.next, NEXT.x, NEXT.base); drawNext(ctx); });
    add(PIG.base, PIG.x - 17, PIG.x + 17, () => { const wig = t - pigT < 0.8 ? (Math.floor(t * 16) % 2 ? 1 : -1) : 0; putA(ctx, R.pig, PIG.x + wig, PIG.base); });
    add(BROCH.base, BROCH.x - 12, BROCH.x + 12, () => putA(ctx, R.broch, BROCH.x, BROCH.base));
    // rådgivaren: stolen bakom, hon själv, skrivbordet framför (lampan lyser)
    add(DESK.base, DESK.x0 - 4, DESK.x1 + 4, () => {
      putA(ctx, R.advChair, ADV.x, ADV.y - 1);
      const near = Math.hypot(walker.px - ADV.x, walker.py - GUESTS[0][1]) < 60 || !!seat;
      if (staffIn() || (seat && seat.x === GUESTS[0][0])) drawPerson(ctx, ADV.x, ADV.y, L.adv, near ? 'down' : adv.dir, adv.mode === 'type' && !near ? (Math.floor(t * 5) % 3 === 0 ? 4 : 0) : 0);
      putA(ctx, R.desk, DESK.x0, DESK.base);
      ctx.fillStyle = 'rgba(200,255,210,.35)'; ctx.fillRect(DESK.x0 + 6, DESK.base - 20, 13, 1);
    });
    for (const [x, b] of GUESTS) add(b, x - 9, x + 9, () => putA(ctx, R.guest, x, b));
    for (const n of npcs) if (n.state !== 'away') add(n.w.py, n.w.px - 12, n.w.px + 12, () => drawPerson(ctx, n.w.px, n.w.py, n.look, n.w.dir, npcFrame(n)));
    for (const d of folkDrawables(A, t)) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
    if (seat) items.push({ fy: seat.fy, draw: () => drawPerson(ctx, seat.x, seat.y, A.avatar.look, seat.dir, 5) });
    else { const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length }); items.push({ fy: walker.py + 0.01, me: true, draw: () => me.draw(ctx) }); }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    const ghost = items.find((it) => it.me);   // min figur syns svagt genom det som står framför
    if (ghost) { ctx.globalAlpha = 0.22; ghost.draw(); ctx.globalAlpha = 1; }
    drawAnims(ctx);
    // damm som dansar i solstrålarna (dag)
    if (!night && hour() >= 7 && hour() < 18) {
      ctx.fillStyle = 'rgba(255,248,220,.55)';
      for (let k = 0; k < 14; k++) {
        const Wn = k % 2 ? WIN_A : WIN_B, ph = (t * 0.05 + k * 0.137) % 1, yy = WALL_Y - 20 + ph * 60;
        const xx = Wn.x0 + 4 + ((k * 13) % (Wn.x1 - Wn.x0 - 8)) + (yy - WALL_Y + 20) * 0.5 + Math.sin(t * 0.8 + k) * 2;
        ctx.fillRect(Math.round(xx), Math.round(yy), 1, 1);
      }
    }
    // ljuskronorna hänger ovanpå allt; lågorna fladdrar och kristallerna glittrar
    for (const x of CHAND) {
      if (x < cx - 20 || x > cx + vw + 20) continue;
      ctx.drawImage(R.chand, x - 16, 0);
      for (let k = 0; k < 2; k++) if (hash(Math.floor(t * 6), x, k) > 0.7) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 12 + Math.floor(hash(Math.floor(t * 6), x, k + 5) * 24), 24 + k, 1, 1); }
    }
    if (night) {
      ctx.drawImage(nightShade(), cx, 0, vw, H, cx, 0, vw, H);
      const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(nightGlow(), cx, 0, vw, H, cx, 0, vw, H);
      ctx.globalCompositeOperation = op;
    }
  }
  // ---------- skärmskyltar ----------
  const safe = () => globalThis.SF?.view?.safe || { y0: 0, y1: H };
  // sparkontot i hörnet (klick = kontoutdraget)
  // hur mycket panelen skulle täcka på en plats (skärmkoordinater): skyltarna på väggen räknas
  // i ytpixlar, och min egen figur under panelen väger tyngst
  function panelCost(x0, y0, w, h) {
    const cx = Math.round(cam.x), X0 = x0 - 2 + cx, X1 = x0 + w + 2 + cx, Y0 = y0 - 2, Y1 = y0 + h + 2;
    let c = 0;
    for (const [a, b, e, d] of SIGNS) { const ow = Math.min(X1, e) - Math.max(X0, a), oh = Math.min(Y1, d) - Math.max(Y0, b); if (ow > 0 && oh > 0) c += ow * oh; }
    const fx = (seat ? seat.x : walker.px) - cx, fy = seat ? seat.y : walker.py;
    if (fx > x0 - 10 && fx < x0 + w + 10 && fy - 46 < y0 + h + 4) c += 1e5;
    return c;
  }
  // Panelen står i det hörn där den täcker minst (med lite tröghet så att den inte fladdrar).
  // Täcker båda hörnen en skylt (t.ex. klockan till vänster och PIXELBANKEN till höger i smal
  // vy) krymper den till en enda rad uppe i taklisten.
  const PW = 68, PH = 26;            // den stora panelen: smal nog att rymmas mellan klockan och väggen
  let panelMini = false, panelRect = null;
  function drawPanel(ctx) {
    const s = saldoOf(g), r = nextInterest(g), dn = daysToMonday(g), sy = safe().y0 | 0;
    const big = { w: PW, h: PH, y0: 3 + sy };
    const miniTxt = [`${groupNum(s)} KR`, `+${groupNum(r)}`];
    const mini = { w: 12 + textW(SM, miniTxt[0]) + 5 + textW(SM, miniTxt[1]) + 3, h: 8, y0: 2 + sy };
    const best = (P) => { const xl = 4, xr = VW - 4 - P.w, cl = panelCost(xl, P.y0, P.w, P.h), cr = panelCost(xr, P.y0, P.w, P.h); return { xl, xr, cl, cr, min: Math.min(cl, cr) }; };
    const B = best(big);
    if (!panelMini && B.min > 60) panelMini = true;
    else if (panelMini && B.min <= 20) panelMini = false;
    const P = panelMini ? mini : big, C = panelMini ? best(mini) : B;
    if (panelSide === 'left' ? C.cr + 40 < C.cl : C.cl + 40 < C.cr) panelSide = panelSide === 'left' ? 'right' : 'left';
    const x0 = panelSide === 'left' ? C.xl : C.xr, y0 = P.y0, w = P.w, h = P.h;
    panelRect = { x0, y0, w, h };
    panelHit = [x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2];
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = '#c0922e'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#123a2c'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#1e5a44'; ctx.fillRect(x0, y0, w, 1);
    if (panelMini) {                 // en rad: valvdörren, saldot och räntan på måndag
      ctx.fillStyle = '#767e88'; ctx.fillRect(x0 + 2, y0 + 1, 6, 6); ctx.fillStyle = '#dae0e6'; ctx.fillRect(x0 + 2, y0 + 1, 6, 1);
      ctx.fillStyle = '#e0b850'; ctx.fillRect(x0 + 4, y0 + 3, 2, 2);
      ctxText(ctx, SM, miniTxt[0], x0 + 12, y0 + 2, '#ffffff');
      ctxText(ctx, SM, miniTxt[1], x0 + w - 3 - textW(SM, miniTxt[1]), y0 + 2, '#8ae8a8');
      return;
    }
    // en liten valvdörr som ikon
    ctx.fillStyle = '#767e88'; ctx.fillRect(x0 + 3, y0 + 3, 9, 9); ctx.fillStyle = '#dae0e6'; ctx.fillRect(x0 + 3, y0 + 3, 9, 1); ctx.fillRect(x0 + 3, y0 + 3, 1, 9);
    ctx.fillStyle = '#2a2e34'; ctx.fillRect(x0 + 5, y0 + 5, 5, 5); ctx.fillStyle = '#e0b850'; ctx.fillRect(x0 + 7, y0 + 5, 1, 5); ctx.fillRect(x0 + 5, y0 + 7, 5, 1);
    ctxText(ctx, SM, 'SPARKONTO', x0 + 15, y0 + 2, '#f0d070');
    let amt = `${groupNum(s)} KR`;
    if (textW(BIG, amt) > w - 8) amt = groupNum(s);                    // stora belopp: utan KR
    if (textW(BIG, amt) > w - 8) ctxText(ctx, SM, `${groupNum(s)} KR`, x0 + w - 4 - textW(SM, `${groupNum(s)} KR`), y0 + 11, '#ffffff');
    else ctxText(ctx, BIG, amt, x0 + w - 4 - textW(BIG, amt), y0 + 9, '#ffffff');
    const lbl = dn === 1 ? `I MORGON +${groupNum(r)}` : `MÅNDAG +${groupNum(r)} KR`;
    ctxText(ctx, SM, lbl, x0 + 4, y0 + 19, '#8ae8a8');
  }
  function bigLabel(ctx, s, atTop) {
    let name = s.label, val = '', valCol = '#f0d070', hintTxt = s.hint || '';
    if (s.win !== undefined) {
      const o = win[s.win].occ;
      val = o === 'me' ? 'DIN TUR' : o ? 'UPPTAGEN' : 'LEDIG'; valCol = o && o !== 'me' ? '#ff8a80' : '#8ae8a8';
      hintTxt = o && o !== 'me' ? 'KLICKA SÅ GÅR DU TILL EN LEDIG KASSA' : 'SÄTT IN ELLER TA UT PENGAR';
    } else if (s.id === 'bankomat') { val = `${groupNum(saldoOf(g))} KR`; hintTxt = 'TA UT PENGAR FRÅN SPARKONTOT'; }
    else if (s.id === 'radgivare') { val = `${pctTxt()} %`; hintTxt = 'RÄNTAN, RÄNTEKALKYLEN OCH KONTOUTDRAGET'; }
    const nw = textW(BIG, name), vw2 = val ? textW(BIG, val) : 0, hw = textW(SMALL, hintTxt);
    const w = Math.max(nw + (val ? vw2 + 10 : 0), hw) + 14, h = hintTxt ? 22 : 13;
    const S = safe(), x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 + (S.y0 | 0) : Math.min(H, S.y1 || H) - h - 3;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = '#d8b45a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#123a2c'; ctx.fillRect(x0, y0, w, h);
    ctxText(ctx, BIG, name, x0 + 7, y0 + 3, '#ffffff');
    if (val) ctxText(ctx, BIG, val, x0 + 17 + nw, y0 + 3, valCol);
    if (hintTxt) ctxText(ctx, SMALL, hintTxt, x0 + 7, y0 + 14, Math.floor(t * 2) % 2 === 0 ? '#fff0b0' : '#c9d2c2');
  }
  function edgeSign(ctx, lbl, left) {
    const w = textW(SMALL, lbl) + 13, x0 = left ? 3 : VW - w - 3, y0 = Math.min(H, safe().y1 || H) - 14;
    ctx.fillStyle = '#d8b45a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 11);
    ctx.fillStyle = '#123a2c'; ctx.fillRect(x0, y0, w, 9);
    ctxText(ctx, SMALL, lbl, left ? x0 + 9 : x0 + 3, y0 + 2, '#fff0b0');
    ctx.fillStyle = '#fff0b0';
    for (let i = 0; i < 3; i++) ctx.fillRect(left ? x0 + 3 + i : x0 + w - 4 - i, y0 + 4 - i, 1, 1 + 2 * i);
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() { door.v = 2.5; pendingHello = 0.8; wasOpen = wasStaff = null; },
    exit() { talk.clear(); talkGuard.clear(); talkAdv.clear(); for (const T of tellers) T.talk.clear(); for (const n of npcs) n.talk.clear(); },
    _debug: {
      spot: (id) => {
        const s = spotById(id);
        if (!s) return null;
        const mx = (s.r[0] + s.r[2]) / 2, my = (s.r[1] + s.r[3]) / 2;
        if (mx - cam.x < 8 || mx - cam.x > VW - 8) { lockedCam = clamp(mx - VW / 2, 0, W - VW); cam.x = lockedCam; }
        return { x: mx - Math.round(cam.x), y: my };
      },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = camTarget(); },
      cam: () => cam.x,
      teleport: (x, y) => { seat = null; walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py), path: walker.path.length }),
      walkable: (x, y) => walker.walkable(x, y),
      reach: (x, y) => walker.findPath(walker.px, walker.py, x, y).length,
      open: (id) => spotById(id)?.act?.(),
      spots: () => spots.map((s) => s.id),
      deposit: (kr, i = meWin ?? 0) => doTx('in', kr, i),
      withdraw: (kr, i = meWin ?? 0) => doTx('ut', kr, i),
      atm: (kr) => atmWithdraw(kr),
      interest: (s) => interestOf(s),
      next: () => nextInterest(g),
      grow: (kr, w) => growOf(kr, w),
      hours: () => ({ hours: HOURS.slice(), atm24: ATM_24, staff: staffIn(), open: isOpen() }),
      // panelen i hörnet: vilken sida och hur mycket skylt den täcker (ytpixlar, utan min figur)
      panel: () => (panelRect ? { side: panelSide, mini: panelMini, x0: panelRect.x0, cover: panelCost(panelRect.x0, panelRect.y0, panelRect.w, panelRect.h) % 1e5 } : null),
      quiet: () => Math.max(0, quietUntil - now()),
      said: () => lastHintTxt,
      tellersShown: () => tellers.filter((T) => tellerHere(T.i)).length,
      state: () => ({
        money: g.money, bank: saldoOf(g), log: (g.bankLog || []).map((e) => ({ ...e })), wins: win.map((w) => (w.occ === 'me' ? 'me' : w.occ ? 'npc' : null)),
        meWin, queue: queue.length, served, atm: { mode: atm.mode, occ: atm.occ === 'me' ? 'me' : atm.occ ? 'npc' : null }, seat: !!seat, dlg: dlg?.kind || null,
        npcs: npcs.map((n) => ({ i: n.i, state: n.state, x: Math.round(n.w.px), y: Math.round(n.w.py), win: n.win })), night: isNight(), open: isOpen(),
        pos: { x: Math.round(walker.px), y: Math.round(walker.py) }, cam: cam.x,
      }),
      hideNpcs: () => { for (const n of npcs) { if (n.win !== null) win[n.win].occ = null; n.win = null; n.state = 'away'; n.t = 999; } queue.length = 0; if (atm.occ && atm.occ !== 'me') atm.occ = null; },
      wakeNpcs: () => { for (const n of npcs) if (n.state === 'away') n.t = 0.1 + n.i * 0.7; },
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, W);
        const view = { x0: 0, x1: W };
        for (const T of tellers) if (tellerHere(T.i)) T.talk.draw(x, view);
        talkGuard.draw(x, view); talkAdv.draw(x, view); for (const n of npcs) n.talk.draw(x, view); talk.draw(x, view);
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      if (pendingHello > 0) {
        pendingHello -= dt;
        if (pendingHello <= 0) guardSay(isOpen() ? 'Välkommen till Pixelbanken!' : staffIn() ? 'Vi har stängt – men kassorna tar de sista kunderna!' : hour() < HOURS[0] ? `God morgon! Kassorna öppnar kl. ${HOURS[0]}.` : 'Kassorna har stängt – bankomaten tar ut pengar.');
      }
      // karusselldörren snurrar när någon går igenom
      const nearDoor = [walker, ...npcs.filter((n) => n.state !== 'away').map((n) => n.w)].some((w) => Math.abs(w.px - DOOR_X) < 24 && w.py < WALL_Y + 20 && w.path.length);
      door.v += ((nearDoor ? 2.4 : 0) - door.v) * Math.min(1, dt * (nearDoor ? 4 : 1.2));
      door.a += door.v * dt;
      // väktaren vänder sig ibland, hälsar när man kommer nära
      guard.t -= dt;
      if (guard.t <= 0) { guard.dir = pick(['down', 'down', 'left', 'right']); guard.t = 3 + Math.random() * 4; }
      if (!greetedGuard && Math.hypot(walker.px - GUARD.x, walker.py - GUARD.y) < 34) { greetedGuard = true; guard.dir = walker.px < GUARD.x ? 'left' : 'down'; guardSay('Kassorna är där borta – bankomaten längst in.'); }
      // rådgivaren skriver på datorn när ingen sitter hos henne
      adv.t -= dt;
      if (adv.t <= 0) { adv.mode = Math.random() < 0.6 ? 'type' : 'idle'; adv.dir = adv.mode === 'type' ? 'right' : 'down'; adv.t = 3 + Math.random() * 4; }
      for (const T of tellers) updateTeller(T, dt);
      for (const n of npcs) updateNpc(n, dt);
      updateAtm(dt);
      for (let i = anims.length - 1; i >= 0; i--) { anims[i].t += dt; if (anims[i].t > anims[i].delay + anims[i].dur * 1.6) anims.splice(i, 1); }
      stockT += dt; if (stockT > 2.6) { stockT = 0; tickStocks(); }
      updateOutside(dt);
      // mina reservationer släpps när jag går därifrån
      if (meWin !== null && !walker.path.length && !atWin(meWin)) releaseMe();
      if (atm.occ === 'me' && !walker.path.length && Math.hypot(walker.px - ATM_SPOT[0], walker.py - ATM_SPOT[1]) > 10) releaseAtm();
      if (pendingAtm && !atm.occ) { pendingAtm = false; goAtm(); }
      // dialogen stängd: personalen säger hej då (och klicket efter stängningen går inte ner i hallen)
      if (dlg && !modalOpen()) {
        hush(300);
        if (dlg.kind === 'kassa') tellerSay(dlg.win, pick(['Tack och välkommen åter!', 'Ha en fin dag!', 'Hej då!']), true);
        else if (dlg.kind === 'adv') advSay('Spara lite varje vecka, så växer det!');
        dlg = null;
      }
      // stängningsdags medan man är här inne: väktaren säger till, och en halvtimme senare går personalen hem
      const o = isOpen(), sIn = staffIn();
      if (wasOpen === true && !o) guardSay('Nu stänger vi för i dag – kassorna tar de sista kunderna!');
      if (wasStaff === true && !sIn) { guardSay(`Personalen har gått hem. Kassorna öppnar kl. ${HOURS[0]} i morgon.`); for (const T of tellers) T.talk.clear(); }
      wasOpen = o; wasStaff = sIn;
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },

    down(sx, sy) {
      if (now() < quietUntil) return;   // andra halvan av ett dubbelklick som stängde en dialog
      hoverId = null;
      if (panelHit && sx >= panelHit[0] && sx <= panelHit[2] && sy >= panelHit[1] && sy <= panelHit[3]) { play('click'); openStatement(null); return; }
      const x = sx + Math.round(cam.x), y = sy;
      if (seat) { [walker.px, walker.py] = seat.exit; walker.stop(); seat = null; }
      let s = spotAt(x, y);
      if (s && (s.id === 'kon' || s.id.startsWith('palm')) && walker.walkable(x, y)) s = null; // golvet i kön går före repen
      if (s && s.win !== undefined && meWin === s.win && atWin(meWin)) { atKassa(meWin); return; }
      if (s && s.id === 'bankomat' && atm.occ === 'me' && !walker.path.length) { atm.mode = 'menu'; openAtm(); return; }
      releaseMe(); releaseAtm(); pendingAtm = false;
      if (s) { clickSpot(s); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + Math.round(cam.x), sy)?.id || null; hoverT = t; },

    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      drawWorld(ctx, cx, VW);
      const view = { x0: cx, x1: cx + VW };
      // bubblor ritas bara när den som pratar syns – annars trycks de in vid kanten och svävar
      for (const T of tellers) if (inView(T.x) && tellerHere(T.i)) T.talk.draw(ctx, view);
      if (inView(GUARD.x)) talkGuard.draw(ctx, view);
      if (inView(ADV.x)) talkAdv.draw(ctx, view);
      for (const n of npcs) if (n.state !== 'away' && inView(n.w.px)) n.talk.draw(ctx, view);
      talk.draw(ctx, view);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawPanel(ctx);
      if (cx + VW < ATM.x0 + 10) edgeSign(ctx, 'BANKOMAT', false);
      else if (cx > DOOR.x1 + 20) edgeSign(ctx, 'UT', true);
      const f = focusSpot();
      if (f && f.label) bigLabel(ctx, f, walker.py > H - 52);
    },
  };
}
