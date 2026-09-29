// VÅRDCENTRALEN – jobbet i receptionen på Söder (öppet 08–17). Patienterna kommer
// in genom skjutdörrarna, drar en nummerlapp i automaten och sätter sig i väntrummet
// med en pratbubbla som visar vad de söker för: FEBER, HOSTA, VACCIN, BLODPROV,
// BRUTEN ARM – eller AKUT. Man står bakom disken med två luckor:
//   1) Klicka på en patient (eller NÄSTA-knappen på disken) – numret ropas upp på
//      NU-tavlan och patienten går fram till en ledig lucka.
//   2) Klicka på rätt dörr: LÄKARE, SJUKSKÖTERSKA, LABB eller AKUTEN. Bilderna på
//      dörrarna visar vilka besvär som hör till vilket rum.
// Rätt rum = lön. Fel rum = avdrag (personalen i dörren skickar vidare patienten).
// Väntar någon för länge går hen hem = missad: 0 kr för den patienten (Carl 2026-09-29),
// en egen rad på lönebeskedet – inte ett "fel". AKUT-patienterna (röd blinkande
// bubbla, ingen nummerlapp – de står i AKUT-rutan vid entrén, ambulansen syns
// utanför glaset) ger BONUS om de tas emot FÖRST, innan någon annan ropas in
// (stats.boxes × JOBS.vard.bonus).
//
// Lokalen målas på stadens detaljnivå: akustiktak med armaturer, avbärarlist i björk
// och vårdcentralens gröna profilrand (samma gröna som fasaden), skjutdörrar med
// gatan utanför, nummerlappsautomat och NU-tavla, fyra dörrar i rummens färger med
// skyltar och bildbrickor, vattenautomat, handsprit, broschyrställ, sittgrupper i
// grön plast, barnhörna med bilmatta, disken med glasskiva, skärm och NÄSTA-knapp,
// personalytan med trägolv, kontorsstol och pärmhylla. Allt statiskt målas EN gång
// (cachas); bara det som rör sig ritas varje bildruta. Ett pixelkorn: heltal, skala 1.
//
// Bred vy (viewMax): kärnan är 384×216 (testrobotar och RAM-läget ser exakt den); i
// breda fönster syns upp till 32 px till på var sida (kapphyllan till vänster,
// personaldörren till höger). Mobilens fyll-läge (NÄRA) beskär ~50–56 rader upptill och
// ~22 nertill, och passets remsa ligger de 18 raderna närmast under kanten. Då flyttas
// lokalen ner (camY) tills dörrskyltarna ligger helt under remsan, personalens bubblor
// kläms under den och remsan får ogenomskinlig botten – ingen text skymtar igenom den.
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, folkDrawables, emoteBubble, WALK_SEQ, createSpeech, sayLines } from '../scenes/walkable.js';
import { worldMyEmote } from '../net/world.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { drawPerson, makeLook } from '../core/people.js';
import { play } from '../core/sound.js';
import { levelOf } from '../game.js';

const FW = 384, FH = 216;
const XL = -32, XR = 416, WW = XR - XL;      // hela lokalen i världskoordinater (kärnan = 0–384)
const WHITE = 0xffffff;
const GREEN = 0x3aa050, GREEN_L = 0x5ad070, GREEN_D = 0x1e6a30;   // vårdcentralens gröna (fasaden)

// ---------- lokalens mått ----------
const CEIL = 12;            // takets underkant
const FLOOR_Y = 104;        // bakväggens fot = golvets början
const DOOR_TOP = 60;        // dörrkarmarnas överkant (öppningen 60–104)
const SIGN_Y = 50;          // skyltarna ovanför dörrarna (rad 50–58)
const ENTRY = { x0: 6, x1: 48, cx: 27, top: 56 };                  // skjutdörrarna
const GLASS = { x0: 9, x1: 45, y0: 59 };                            // entréglaset (gatan syns igenom)
const AUTO = { x: 63, y: 116 };                                     // nummerlappsautomaten (fötterna)
const NU = { x0: 54, x1: 96, y0: 62, y1: 80 };                      // NU-tavlan över automaten
const AKUT_ZONE = { x0: 8, x1: 50, y0: 112, y1: 138 };
const AKUT_SPOTS = [[19, 125], [39, 125]];                          // där akutpatienterna står
const COOLER = { x: 146, y: 110 };                                  // vattenautomaten
const SEAT_X = [84, 102, 120, 138, 180, 198, 216, 234];
const ROW_Y = [162, 202];                                           // sittgruppernas sits (= fötterna när man sitter)
const GROUPS = [[84, 162], [180, 162], [84, 202], [180, 202]];      // sittgrupper à fyra: vänstra sitsens x, rad
const TOYBOX = { x: 50, y: 150 };
const TABLE = { x: 262, y: 178 };                                   // tidningsbordet
const PLANT = { x: 266, y: 213 };                                   // monsteran vid mellanväggen
const DESK = { x0: 284, top: 118, face: 124, base: 150 };           // disken (skivan 118–124, fronten 124–150)
const WIN = [318, 370];                                             // luckorna
const PAT_Y = 126;          // patienten vid luckan (fötterna bakom disken)
const WORK_Y = 156;         // där man själv står vid luckan
const MON = { x0: 331, x1: 357, y0: 100, y1: 117 };                 // skärmen mellan luckorna (vänd mot oss)
const NEXT = { x0: 284, x1: 306, y0: 107, y1: 118 };                // NÄSTA-knappen på disken
const CHAIR = { x: 346, y: 190 };                                   // kontorsstolen
const CLOCK = { x: 76, y: 36 };

// ---------- rummen och besvären ----------
// to = vart personalen skickar vidare ("GÅ TILL LABBET!")
const ROOMS = [
  { id: 'lakare', name: 'LÄKARE', to: 'LÄKAREN', x0: 104, x1: 134, col: 0x2f6fd8 },
  { id: 'ssk', name: 'SJUKSKÖTERSKA', to: 'SJUKSKÖTERSKAN', x0: 158, x1: 188, col: 0x9050c8 },
  { id: 'labb', name: 'LABB', to: 'LABBET', x0: 212, x1: 242, col: 0xe08418 },
  { id: 'akut', name: 'AKUTEN', to: 'AKUTEN', x0: 258, x1: 302, col: 0xd8342c, double: true },
];
ROOMS.forEach((r, i) => { r.i = i; r.cx = (r.x0 + r.x1) >> 1; });
// p = hur vanliga besvären är bland de vanliga patienterna (akut kommer för sig)
const SYMS = [
  { id: 'feber', word: 'FEBER', room: 0, p: 0.21 },
  { id: 'hosta', word: 'HOSTA', room: 0, p: 0.18 },
  { id: 'vaccin', word: 'VACCIN', room: 1, p: 0.21 },
  { id: 'blod', word: 'BLODPROV', room: 2, p: 0.22 },
  { id: 'arm', word: 'BRUTEN ARM', room: 3, p: 0.18 },
  { id: 'akut', word: 'AKUT!', room: 3, p: 0, akut: true },
];
const AKUT = SYMS.findIndex((s) => s.akut);
const symIndex = (s) => (typeof s === 'number' ? s : SYMS.findIndex((x) => x.id === s));
const roomIndex = (r) => (typeof r === 'number' ? r : ROOMS.findIndex((x) => x.id === r || x.name === String(r).toUpperCase()));
function randomSym() {
  let r = Math.random(), acc = 0;
  for (let i = 0; i < SYMS.length; i++) { acc += SYMS[i].p; if (r < acc) return i; }
  return 0;
}

// ---------- personalen ----------
const STAFF = [
  { skin: '#eec3a0', hair: '#6b4226', style: 'side', top: 'doctor', shirt: '#f4f1ea', accent: '#3a7bd5', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: 'square', beard: false, build: 5, hat: null, bag: null },
  { skin: '#c68a5c', hair: '#1d1714', style: 'bun', top: 'nurse', shirt: '#9a6ad8', accent: '#f4f1ea', bottom: 'pants', pants: '#8a5ac8', shoes: '#f2f2f2', glasses: false, beard: false, build: 5, hat: null, bag: null },
  { skin: '#f6d7bf', hair: '#d9a95c', style: 'ponytail', top: 'doctor', shirt: '#f4f1ea', accent: '#e08418', bottom: 'pants', pants: '#6f7c8a', shoes: '#f2f2f2', glasses: 'round', beard: false, build: 4, hat: null, bag: null },
  { skin: '#a06a43', hair: '#1d1714', style: 'buzz', top: 'nurse', shirt: '#2a7a8a', accent: '#d8342c', bottom: 'pants', pants: '#2a7a8a', shoes: '#1c1c1c', glasses: false, beard: 'stubble', build: 6, hat: null, bag: null },
];
const GREET = ['VÄLKOMMEN IN!', 'KOM IN, KOM IN!', 'HEJ! STIG PÅ!', 'HÄR ÄR DET!'];

// ======================= små målarverktyg =======================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
function disc(P, cx, cy, r, fn) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= r) { const c = fn(x, y, d); if (c !== null && c !== undefined) P.px(x, y, c); }
  }
}
function knob(P, cx, cy, r, c) {
  disc(P, cx + 0.5, cy + 0.5, r + 0.4, (x, y, d) => (d > r - 0.3 ? mul(c, 0.5) : x - cx + y - cy < 0 ? mix(c, WHITE, 0.45) : c));
}
// mörk "sel-out"-kontur runt allt ogenomskinligt (tonad efter grannpixeln)
function outline(P) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[(y * w + x) * 4 + 3]) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const k = (yy * w + xx) * 4;
      if (src[k + 3] < 200) continue;
      const c = (src[k] << 16) | (src[k + 1] << 8) | src[k + 2];
      P.px(x + P.ox, y + P.oy, mix(mul(c, 0.42), 0x1c1418, 0.4));
      break;
    }
  }
}
// text med skugga (skyltar)
function stext(P, F, s, x, y, c, sh) { text(P, F, s, x + 1, y + 1, sh); text(P, F, s, x, y, c); }

// ======================= symbolerna (13×13 med kontur) =======================
function paintIcon(id) {
  const P = new Pix(13, 13);
  if (id === 'feber') {
    // termometer: glasrör med röd pelare och kula, skala, värmevågor
    area(P, 4, 1, 4, 8, (X, Y, i) => (i === 0 ? 0xffffff : i === 3 ? 0xc8d4de : 0xeef4f8));
    P.rect(5, 4, 2, 6, 0xe0342c); P.px(5, 4, 0xff7a6a);
    for (const y of [2, 4, 6]) P.px(7, y, 0x8a96a2);
    disc(P, 6, 10.4, 2.3, (x, y, d) => (d < 1.1 && x <= 5 && y <= 10 ? 0xffa090 : d > 1.7 ? 0xb0201c : 0xe0342c));
    for (const [x, y] of [[10, 1], [11, 2], [10, 3], [11, 4], [10, 5], [11, 6]]) P.px(x, y, (y & 1) ? 0xff9a2a : 0xffc04a);
  } else if (id === 'hosta') {
    // ett gult ansikte som hostar: hopknipna ögon, öppen mun, hostmoln åt höger
    disc(P, 5, 6.5, 4.3, (x, y, d) => (d > 3.6 ? 0xd8a020 : x + y < 8 ? 0xffe88a : 0xffd23f));
    P.hl(2, 5, 2, 0x3a2410); P.hl(5, 5, 2, 0x3a2410); P.px(2, 4, 0x3a2410); P.px(6, 4, 0x3a2410);
    P.rect(6, 8, 2, 2, 0x9a1e1a); P.px(6, 8, 0x5a0e0c); P.hl(3, 8, 2, 0xe89a70);
    disc(P, 10.2, 5.3, 1.7, (x, y, d) => (d > 1.2 ? 0xb8c4d0 : 0xf2f6fa));
    disc(P, 11.2, 9, 1.4, (x, y, d) => (d > 1 ? 0xb8c4d0 : 0xf2f6fa));
    P.px(9, 8, 0xdce4ec);
  } else if (id === 'vaccin') {
    // spruta: tumplatta, kolv, fingergrepp, cylinder med blå vätska och skala, nål
    P.hl(4, 0, 5, 0xc8d0d8); P.hl(4, 1, 5, 0x8a929c);
    P.vl(6, 2, 2, 0xb0b8c0);
    P.hl(3, 4, 7, 0xdce2e8);
    area(P, 4, 5, 5, 5, (X, Y, i, j) => (i === 0 ? 0xffffff : j === 0 ? 0xc8e4f8 : i === 4 ? 0x2a6ad8 : j === 4 ? 0x2a6ad8 : 0x5ab0f0));
    for (const y of [6, 8]) P.px(7, y, 0xeaf6ff);
    P.rect(5, 10, 3, 1, 0xa8b0b8);
    P.vl(6, 11, 2, 0x8a929c);
  } else if (id === 'blod') {
    // provrör med röd kork + en bloddroppe
    P.rect(1, 1, 5, 2, 0xd8342c); P.hl(1, 1, 5, 0xff7a6a);
    area(P, 2, 3, 3, 8, (X, Y, i, j) => (j < 3 ? (i === 0 ? 0xffffff : 0xe4eef4) : i === 0 ? 0xff5a4a : j === 7 ? 0x8a1612 : 0xc8201c));
    P.px(3, 11, 0x9a1a16);
    disc(P, 9, 8.6, 2.6, (x, y, d) => (d < 1.1 && x <= 8 && y <= 8 ? 0xff8a7a : d > 1.9 ? 0x9a1612 : 0xd8201c));
    P.px(9, 4, 0xd8201c); P.hl(8, 5, 3, 0xd8201c); P.px(9, 5, 0xe8342c);
  } else if (id === 'arm') {
    // ett ben (hundbensform) som har gått av på mitten, med röda "aj"-streck vid brottet
    const boneC = (x, y) => (y <= 5 ? 0xffffff : y >= 8 ? 0xd4c6a4 : 0xf4ecd6);
    for (const [cx, cy] of [[1.9, 5.1], [1.9, 8.1], [11.1, 5.1], [11.1, 8.1]]) disc(P, cx, cy, 1.55, (x, y) => boneC(x, y));
    area(P, 2, 5, 9, 4, (X, Y, i) => (i === 3 || i === 5 ? null : boneC(X, Y)));
    P.px(5, 5, 0xf4ecd6); P.px(6, 6, 0xf4ecd6); P.px(5, 7, 0xd4c6a4);          // den taggiga brottytan
    P.px(7, 6, 0xf4ecd6); P.px(8, 5, 0xffffff); P.px(8, 8, 0xd4c6a4);
    for (const [x, y] of [[5, 2], [6, 1], [8, 2], [7, 3], [4, 11], [8, 11]]) P.px(x, y, 0xe0342c);
  } else if (id === 'akut') {
    // rött hjärta med vit EKG-linje
    disc(P, 4.2, 4.6, 3.1, () => 0xe0342c);
    disc(P, 8.8, 4.6, 3.1, () => 0xe0342c);
    for (let y = 5; y <= 11; y++) { const hw = Math.max(0, 6 - (y - 5)); P.hl(6.5 - hw, y, hw * 2, 0xe0342c); }
    P.px(3, 3, 0xff9a8a); P.px(2, 4, 0xff9a8a); P.px(3, 4, 0xff7a6a);
    for (const [x, y] of [[1, 7], [2, 7], [3, 7], [4, 7], [5, 6], [5, 5], [6, 8], [6, 9], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7]]) P.px(x, y, 0xffffff);
    for (let x = 1; x < 12; x++) for (let y = 3; y < 12; y++) if (P.get(x, y) === 0xe0342c && y > 8) P.px(x, y, 0xb82420);
  }
  outline(P);
  return P.flush();
}
const ICONS = new Map();
const iconOf = (i) => { let c = ICONS.get(i); if (!c) { c = paintIcon(SYMS[i].id); ICONS.set(i, c); } return c; };

// ======================= lokalen (statisk, en gång) =======================
function paintBack() {
  const P = new Pix(WW, FH, XL, 0);
  paintCeiling(P);
  paintWall(P);
  paintEntrance(P);
  paintNuBox(P);
  for (const r of ROOMS) paintDoor(P, r);
  paintWallDecor(P);
  paintReceptionWall(P);
  paintCoats(P);
  paintFloor(P);
  return P.flush();
}

function paintCeiling(P) {
  area(P, XL, 0, WW, CEIL, (X, Y) => {
    let c = qmix(0xdadcd6, 0xe8eae4, Y / CEIL, X, Y, 3);
    const tx = (X - XL) % 32;
    if (tx === 0) c = 0xb8beb6; else if (tx === 1) c = 0xf4f6f0;
    if (Y === 5) c = 0xbec4bc; else if (Y === 6) c = mix(c, WHITE, 0.3);
    if (hash(X, Y, 3) > 0.9) c = mul(c, 0.95);       // akustikplattornas hål
    return c;
  });
  rows(P, XL, CEIL - 2, WW, [0xd8dcd4, 0xa4aaa2]);
  for (const lx of [22, 118, 214, 310, 400, -18]) {
    area(P, lx - 12, 1, 24, 4, (X, Y, i, j) => (i === 0 || i === 23 || j === 0 || j === 3 ? 0xb4bab2 : i % 6 === 0 ? 0xe4eef2 : 0xfdfefe));
  }
}

function paintWall(P) {
  area(P, XL, CEIL, WW, FLOOR_Y - CEIL, (X, Y) => {
    const j = Y - CEIL;
    let c = qmix(0xf4f5ef, 0xe4e7df, j / (FLOOR_Y - CEIL), X, Y, 4);
    if ((X - XL) % 96 === 95) c = mul(c, 0.95);
    else if ((X - XL) % 96 === 0) c = mix(c, WHITE, 0.3);
    return jit(c, X, Y, 11, 0.022);
  });
  for (const lx of [22, 118, 214, 310, 400]) P.ell(lx, CEIL + 1, 36, 18, 0xfffbe8, 0.2, 4);
  P.darken(XL, CEIL, WW, 1, 0.88);
  // avbärarlisten i björk (skyddar väggen mot rullstolar och barnvagnar)
  rows(P, XL, 82, WW, [0xf6e6c4, 0xe4c894, 0xd4b27c, 0xb08c5a]);
  P.darken(XL, 86, WW, 1, 0.84);
  for (let x = XL + 6; x < XR; x += 40) { P.px(x, 83, 0x9a7a4a); P.px(x, 84, 0xfff4d8); }
  // vårdcentralens gröna profilrand och golvsockeln (vinylhålkäl)
  rows(P, XL, 91, WW, [GREEN_L, GREEN, GREEN, GREEN_D]);
  rows(P, XL, 98, WW, [0xb4c0ba, 0x96a69e, 0x86968e, 0x7a8a82, 0x6e7e76, 0x627068]);
}

// ---------- entrén: aluminiumkarm, glas med gatan utanför, UTGÅNG-skylt, sensor ----------
function paintEntrance(P) {
  const { x0, x1, top } = ENTRY, w = x1 - x0;
  // gatan utanför (syns genom glaset)
  const gx0 = GLASS.x0, gx1 = GLASS.x1, gy0 = GLASS.y0;
  area(P, gx0, gy0, gx1 - gx0, FLOOR_Y - gy0, (X, Y) => {
    if (Y < 66) return qmix(0x9ccfee, 0xd0eaf8, (Y - gy0) / 7, X, Y, 3);
    if (Y < 83) {                                           // huset mittemot: gul puts, fönster med vita karmar
      const fx = (X - gx0 + 3) % 12, fy = (Y - 67) % 8;
      let c = jit(qmix(0xe8d098, 0xd8bc80, (Y - 66) / 17, X, Y, 2), X, Y, 12, 0.06);
      if (Y === 66) c = 0xa88a58;
      if (fx >= 2 && fx <= 7 && fy >= 1 && fy <= 5) c = fx === 2 || fx === 7 || fy === 1 || fy === 5 ? 0xf4f0e6 : fy === 2 && fx < 5 ? 0xb8d8ec : 0x5a7a90;
      return c;
    }
    if (Y < 85) return Y === 83 ? 0xb0b4b0 : 0x8a8e8c;       // bortre trottoarkanten
    if (Y < 94) {                                            // gatan med mittlinje
      let c = jit(0x5a5e62, X, Y, 13, 0.1);
      if (Y === 89 && ((X >> 2) & 1)) c = 0xf0f0e8;
      return c;
    }
    if (Y < 96) return Y === 94 ? 0xc8ccc8 : 0x9aa09c;       // trottoarkant
    const tx = (X - gx0) % 8, ty = (Y - 96) % 4;             // trottoarens plattor
    return tx === 7 || ty === 3 ? 0xa8aca8 : jit(0xc8ccc6, X, Y, 14, 0.05);
  });
  // ett träd och en lyktstolpe på andra sidan gatan
  P.vl(14, 70, 14, 0x6a4a2a); P.vl(15, 72, 12, 0x4a3018);
  for (let k = 0; k < 40; k++) { const a = hash(k, 1, 15) * 6.28, r = hash(k, 2, 15) * 6; P.px(15 + Math.cos(a) * r, 67 + Math.sin(a) * r * 0.8, hash(k, 3, 15) > 0.5 ? 0x4a9a3a : 0x2e7a2a); }
  P.vl(38, 64, 20, 0x3a3e44); P.hl(36, 64, 4, 0x3a3e44); P.px(36, 65, 0xfff0a0);
  // karmen: borstad aluminium, ljus kant uppe/vänster, mörk nere/höger
  area(P, x0, top, w, FLOOR_Y - top, (X, Y, i, j) => {
    const inside = i >= 3 && i < w - 3 && j >= 3;
    if (inside) return null;
    if (j < 3 && i >= 3 && i < w - 3) return [0xe8ecf0, 0xc0c8d0, 0x8a929a][j];
    const s = i < 3 ? i : w - 1 - i;
    return [i < 3 ? 0xeef2f6 : 0x6a727a, 0xc4ccd4, i < 3 ? 0x9aa2aa : 0xa8b0b8][s];
  });
  // sensorn och den gröna UTGÅNG-skylten (springande gubbe mot dörren)
  P.rect(ENTRY.cx - 3, top + 3, 7, 2, 0x2a2e34); P.px(ENTRY.cx + 2, top + 3, 0xff4a3a);
  const ux = ENTRY.cx - 11, uy = 43;
  area(P, ux, uy, 22, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === 21 || j === 8 ? 0x1e6a30 : j === 1 ? 0x5ad070 : 0x2aa84a));
  const man = ['..#...', '.###..', '#.#.#.', '..#...', '.#.#..', '#...#.'];
  man.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(ux + 3 + i, uy + 2 + j, WHITE); });
  P.rect(ux + 11, uy + 2, 4, 5, WHITE); P.rect(ux + 12, uy + 3, 2, 4, 0x1e6a30);   // dörren på skylten
  P.hl(ux + 16, uy + 4, 3, WHITE); P.px(ux + 18, uy + 3, WHITE); P.px(ux + 18, uy + 5, WHITE);
  P.darken(ux + 1, uy + 9, 22, 1, 0.84);
}

// ---------- NU-tavlan (siffrorna ritas levande) ----------
function paintNuBox(P) {
  const { x0, x1, y0, y1 } = NU, w = x1 - x0, h = y1 - y0;
  for (const bx of [x0 + 7, x1 - 9]) { P.rect(bx, y0 - 5, 2, 5, 0x9aa2aa); P.px(bx, y0 - 5, 0xd8dce0); }
  P.darken(x0 + 2, y1, w, 2, 0.84); P.darken(x1, y0 + 2, 2, h, 0.88);
  area(P, x0, y0, w, h, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0x5a6068;
    if (i === w - 1 || j === h - 1) return 0x16181c;
    if (i === 1 || j === 1 || i === w - 2 || j === h - 2) return 0x2a2e34;
    return ((X + Y) & 1) && (Y & 1) ? 0x1a1210 : 0x100a08;       // LED-rutnätet
  });
  text(P, SMALL, 'NU', x0 + 4, y0 + 4, 0x5ad070);
  text(P, SMALL, 'LUCKA', x0 + 4, y0 + 11, 0x8a6a2a);
}

// ---------- dörrarna: karm, blad i rummets färg, skylt ovanför, bildbricka ----------
// bildbrickan: symbolerna för besvären som hör till rummet (staplade, eller i rad på dubbeldörren)
function iconPlate(P, cx, y, syms, edge, across = false) {
  const n = syms.length, pw = across ? n * 14 + 2 : 16, ph = across ? 16 : n * 14 + 2, px0 = cx - (pw >> 1);
  P.darken(px0 + 1, y + ph, pw, 1, 0.8); P.darken(px0 + pw, y + 1, 1, ph, 0.86);
  area(P, px0, y, pw, ph, (X, Y, i, j) => {
    if ((i === 0 || i === pw - 1) && (j === 0 || j === ph - 1)) return null;
    if (i === 0 || j === 0 || i === pw - 1 || j === ph - 1) return edge;
    if (j === 1) return 0xffffff;
    return j === ph - 2 ? 0xe4e0d6 : 0xfbfaf6;
  });
  syms.forEach((s, k) => {
    const ic = iconOf(s), d = ic.getContext('2d').getImageData(0, 0, 13, 13).data;
    const ix = px0 + (across ? 1 + k * 14 : 2), iy = y + (across ? 2 : 1 + k * 14);
    for (let yy = 0; yy < 13; yy++) for (let xx = 0; xx < 13; xx++) { const q = (yy * 13 + xx) * 4; if (d[q + 3] > 128) P.px(ix + xx, iy + yy, (d[q] << 16) | (d[q + 1] << 8) | d[q + 2]); }
  });
}
function paintDoor(P, r) {
  const { x0, x1, col } = r, w = x1 - x0, top = DOOR_TOP, h = FLOOR_Y - top;
  const leafL = mix(col, WHITE, 0.72), leaf = mix(col, WHITE, 0.58), leafD = mix(col, WHITE, 0.4);
  // karmen
  area(P, x0 - 3, top - 3, w + 6, h + 3, (X, Y, i, j) => {
    if (i >= 3 && i < w + 3 && j >= 3) return null;
    if (i === 0 || j === 0) return 0xeef0f2;
    if (i === w + 5) return 0x5a6068;
    if (j === 1 || i === 1) return 0xc8ccd2;
    return i >= w + 3 ? 0x8a9098 : 0xa4aab2;
  });
  P.darken(x1 + 3, top - 2, 1, h + 2, 0.86);
  const leafAt = (lx0, lw, hinge) => {
    area(P, lx0, top, lw, h, (X, Y, i, j) => {
      let c = qmix(leafL, leaf, j / h, X, Y, 4);
      if (i === 0) c = mix(c, WHITE, 0.4);
      if (i === lw - 1) c = mul(c, 0.84);
      if (hinge === 'l' && i === 1) c = mul(c, 0.94);
      if (j === 0) c = mix(c, WHITE, 0.3);
      if (j >= h - 8) {                                          // sparkplåten
        const k = j - (h - 8);
        c = k === 0 ? 0xeef2f6 : k === 7 ? 0x6a7078 : (X + k) % 5 === 0 ? 0xb8c0c8 : 0xcdd3d9;
      }
      return jit(c, X, Y, 20 + r.i, 0.03);
    });
  };
  if (!r.double) {
    leafAt(x0, w, 'l');
    // smalt glasfönster på låssidan
    area(P, x1 - 8, top + 5, 4, 19, (X, Y, i, j) => (i === 0 || j === 0 ? leafD : i === 3 || j === 18 ? leafL : (i + j) % 7 === 1 ? 0xe8f4fc : qmix(0x9ab8cc, 0x6a8aa0, j / 19, X, Y, 3)));
    // trycket: rosett + handtag åt vänster
    P.rect(x1 - 5, top + 24, 2, 4, 0x9aa2aa); P.px(x1 - 5, top + 24, 0xe8ecf0);
    P.hl(x1 - 10, top + 25, 6, 0xd8dee4); P.hl(x1 - 10, top + 26, 6, 0x7a828a); P.px(x1 - 10, top + 25, 0xffffff);
    iconPlate(P, x0 + 11, top + 4, SYMS.filter((s) => s.room === r.i && !s.akut).map((s) => SYMS.indexOf(s)), mul(col, 0.8));
  } else {
    const hw = w >> 1;
    leafAt(x0, hw, 'l'); leafAt(x0 + hw, w - hw, 'r');
    P.vl(x0 + hw - 1, top, h, mul(leafD, 0.8));
    // runda fönster (hyttventiler) i båda bladen
    for (const cx of [x0 + (hw >> 1), x0 + hw + ((w - hw) >> 1)]) {
      disc(P, cx + 0.5, top + 8.5, 4.4, (x, y, d) => (d > 3.6 ? 0xb8c0c8 : d > 3.1 ? 0x6a7078 : x - cx + y - top - 8 < -2 ? 0xe8f4fc : qmix(0xa8c4d8, 0x7a9ab0, (y - top - 4) / 8, x, y, 3)));
    }
    // röda randen, tryckplattor
    rows(P, x0, top + 30, w, [0xff6a5a, 0xd8342c, 0x9a1a16]);
    for (const px of [x0 + hw - 6, x0 + hw + 2]) { P.rect(px, top + 22, 4, 6, 0xd8dee4); P.hl(px, top + 22, 4, 0xffffff); P.vl(px + 3, top + 23, 5, 0x8a929a); }
    iconPlate(P, r.cx, top + 13, SYMS.filter((s) => s.room === r.i).map((s) => SYMS.indexOf(s)).reverse(), mul(col, 0.8), true);
  }
  // skylten ovanför: färgad bricka med rummets namn
  const tw = textW(SMALL, r.name), bw = Math.max(w + 2, tw + 8), bx = r.cx - (bw >> 1), by = SIGN_Y;
  P.darken(bx + 1, by + 9, bw, 1, 0.8);
  area(P, bx, by, bw, 9, (X, Y, i, j) => {
    if ((i === 0 || i === bw - 1) && (j === 0 || j === 8)) return null;
    if (j === 0) return mix(col, WHITE, 0.4);
    if (j === 8 || i === bw - 1) return mul(col, 0.58);
    if (i === 0) return mix(col, WHITE, 0.2);
    return jit(col, X, Y, 30 + r.i, 0.04);
  });
  stext(P, SMALL, r.name, bx + ((bw - tw) >> 1), by + 2, WHITE, mul(col, 0.5));
  if (r.double) { // AKUTEN: röd lampa på var sida om skylten
    for (const lx of [bx - 5, bx + bw + 1]) { knob(P, lx + 2, by + 4, 2, 0xe8342c); }
  }
}

// ---------- väggen: logga, klocka, galler, affischer, vattenautomat (golv), handsprit, broschyrer ----------
function paintWallDecor(P) {
  // VÅRDCENTRALEN i gröna bokstäver + korset (övre väggen, dekor)
  const s = 'VÅRDCENTRALEN', tw = textW(BIG, s), lx = 203 - (tw >> 1), ly = 24;
  const cx = lx - 12, cy = ly + 3;
  P.rect(cx - 2, cy - 5, 5, 11, GREEN); P.rect(cx - 5, cy - 2, 11, 5, GREEN);
  P.rect(cx - 1, cy - 4, 3, 9, GREEN_L); P.rect(cx - 4, cy - 1, 9, 3, GREEN_L);
  P.darken(cx - 1, cy + 6, 5, 1, 0.88); P.darken(cx + 3, cy + 3, 3, 1, 0.88);
  text(P, BIG, s, lx + 1, ly + 1, 0xc8d4cc);
  text(P, BIG, s, lx, ly, GREEN_D);
  for (let x = lx; x < lx + tw; x++) for (let y = ly - 2; y < ly + 7; y++) if (P.get(x, y) === GREEN_D && P.get(x, y - 1) !== GREEN_D) P.px(x, y, GREEN);
  // väggklockan (visarna ritas levande)
  disc(P, CLOCK.x + 0.5, CLOCK.y + 0.5, 7.4, (x, y, d) => (d > 6.6 ? 0x2a2c30 : d > 5.9 ? 0x9aa2aa : y < CLOCK.y - 2 ? 0xffffff : 0xf0f2f4));
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(CLOCK.x + Math.round(Math.sin(a) * 5), CLOCK.y - Math.round(Math.cos(a) * 5), k % 3 ? 0xb0b6bc : 0x2a2c30); }
  P.darken(CLOCK.x - 5, CLOCK.y + 8, 11, 1, 0.86);
  // ventilationsgaller
  for (const gx of [132, 280]) area(P, gx, 16, 22, 8, (X, Y, i, j) => (i === 0 || j === 0 ? 0xffffff : i === 21 || j === 7 ? 0xa8aea6 : j % 2 ? 0x8a908a : 0xd8dcd4));
  // affisch: tvätta händerna – kran med vattenstråle över två händer och skumbubblor
  const ax = 138, ay = 57, aw = 16, ah = 22;
  P.darken(ax + 1, ay + ah, aw, 1, 0.84); P.darken(ax + aw, ay + 1, 1, ah, 0.88);
  area(P, ax, ay, aw, ah, (X, Y, i, j) => (i === 0 || j === 0 || i === aw - 1 || j === ah - 1 ? 0x2a6ab0 : j < 6 ? (j === 1 ? 0x7ab4ec : 0x4a8ad0) : j === ah - 2 ? 0xe4e0d6 : 0xfbfaf6));
  P.hl(ax + 4, ay + 2, 6, 0xe8ecf0); P.vl(ax + 9, ay + 2, 3, 0xe8ecf0); P.px(ax + 10, ay + 4, 0xe8ecf0);   // kranen
  P.vl(ax + 9, ay + 6, 4, 0x6ab8f0); P.px(ax + 9, ay + 10, 0xa8dcff);                                     // strålen
  for (const [hx, flip] of [[ax + 3, 0], [ax + 9, 1]]) {
    area(P, hx, ay + 11, 5, 8, (X, Y, i, j) => (j > 5 && (flip ? i === 4 : i === 0) ? null : (flip ? i === 4 : i === 0) ? 0xd09a70 : j === 0 ? 0xffd8b8 : 0xf0c8a0));
  }
  for (const [bx, by, br] of [[ax + 5, ay + 9, 1.4], [ax + 12, ay + 8, 1.2], [ax + 8, ay + 11, 1]]) disc(P, bx, by, br, (x, y, d) => (d > br - 0.6 ? 0x6ab8f0 : 0xeef8ff));
  // handsprit på väggen (vit låda, grön droppe, pump)
  const hx = 194, hy = 66;
  area(P, hx, hy, 11, 16, (X, Y, i, j) => (i === 0 || j === 0 ? 0xffffff : i === 10 || j === 15 ? 0xa8b0b8 : j > 11 ? 0xd8dee4 : 0xf0f4f6));
  disc(P, hx + 5.5, hy + 6.5, 2.6, (x, y, d) => (d > 1.8 ? GREEN_D : x < hx + 5 && y < hy + 6 ? GREEN_L : GREEN));
  P.px(hx + 5, hy + 3, GREEN); P.rect(hx + 4, hy + 16, 3, 2, 0x5a6068); P.px(hx + 5, hy + 18, 0x8a929a);
  P.darken(hx + 1, hy + 16, 11, 1, 0.86);
  // broschyrställ mellan LABB och AKUTEN
  const bx = 245, by = 64;
  area(P, bx, by, 11, 28, (X, Y, i, j) => (i === 0 || i === 10 ? 0x9aa2aa : (j % 9) === 8 ? 0xc8ced4 : null));
  for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) {
    const c = [0x3a7ad8, GREEN, 0xe0842a, 0xd8342c, 0x9a5ad8, 0xffd23f][(k * 3 + i) % 6];
    area(P, bx + 1 + i * 3, by + k * 9 + 1, 3, 7, (X, Y, ii, jj) => (jj === 0 ? mix(c, WHITE, 0.5) : ii === 2 ? mul(c, 0.8) : jj === 3 ? WHITE : c));
  }
  P.darken(bx + 1, by + 28, 11, 1, 0.86);
}

// ---------- receptionsväggen bakom disken: träribbor, RECEPTION, öppettider, personaldörren ----------
function paintReceptionWall(P) {
  const x0 = 306;
  area(P, x0, CEIL + 2, XR - x0, 80 - CEIL - 2, (X, Y, i, j) => {
    const k = i % 5;
    let c = qmix(0xe0c08c, 0xcca672, j / 66, X, Y, 3);
    if (k === 4) c = 0x8a6a42; else if (k === 0) c = mix(c, WHITE, 0.18);
    return jit(c, X, Y, 40, 0.05);
  });
  rows(P, x0, 80, XR - x0, [0x6a4e30, 0xf6e6c4]);
  P.vl(x0, CEIL + 2, 80 - CEIL - 2, 0x8a6a42);
  // RECEPTION: vit skylt med gröna bokstäver och kors
  const s = 'RECEPTION', tw = textW(SMALL, s), sw = tw + 16, sx = 344 - (sw >> 1), sy = 36;
  P.darken(sx + 1, sy + 10, sw, 1, 0.8);
  area(P, sx, sy, sw, 10, (X, Y, i, j) => ((i === 0 || i === sw - 1) && (j === 0 || j === 9) ? null : i === 0 || j === 0 || i === sw - 1 || j === 9 ? GREEN_D : 0xfbfaf6));
  P.rect(sx + 3, sy + 3, 5, 1, GREEN); P.rect(sx + 5, sy + 1, 1, 5, GREEN); P.rect(sx + 4, sy + 2, 3, 3, GREEN);
  text(P, SMALL, s, sx + 11, sy + 3, GREEN_D);
  // öppettider (liten mässingsskylt)
  const o = 'ÖPPET 8-17', ow = textW(SMALL, o) + 6;
  area(P, 312, 22, ow, 9, (X, Y, i, j) => (i === 0 || j === 0 ? 0xfff0b0 : i === ow - 1 || j === 8 ? 0x8a6a1a : 0xd8b04a));
  text(P, SMALL, o, 315, 24, 0x4a3408);
  // personaldörren (bara i bred vy)
  const dx = 387, dw = 26, top = DOOR_TOP;
  area(P, dx - 2, top - 2, dw + 4, FLOOR_Y - top + 2, (X, Y, i, j) => (i < 2 || j < 2 || i >= dw + 2 ? (i === 0 || j === 0 ? 0xe8ecf0 : 0x8a9098) : null));
  area(P, dx, top, dw, FLOOR_Y - top, (X, Y, i, j) => {
    let c = qmix(0xe8e4dc, 0xd4cec4, j / 44, X, Y, 3);
    if (i === 0) c = 0xf8f6f2; if (i === dw - 1) c = 0xa8a298;
    if (j >= 36) c = j === 36 ? 0xeef2f6 : 0xc4cad0;
    return c;
  });
  const t = 'PRIVAT', ptw = textW(SMALL, t);
  area(P, dx, top + 6, dw, 7, (X, Y, i, j) => (j === 0 || j === 6 ? 0x3a3e44 : 0x5a6068));
  text(P, SMALL, t, dx + ((dw - ptw) >> 1), top + 7, WHITE);
  P.rect(dx + 3, top + 20, 4, 6, 0x2a2e34); P.px(dx + 4, top + 21, 0x5ad070); P.hl(dx + 4, top + 23, 2, 0x8a929a); P.hl(dx + 4, top + 25, 2, 0x8a929a);
  P.hl(dx + dw - 8, top + 24, 5, 0xd8dee4); P.hl(dx + dw - 8, top + 25, 5, 0x7a828a);
}

// ---------- kapphyllan och paraplyställ (vänster kant, syns i bred vy) ----------
function paintCoats(P) {
  rows(P, -30, 58, 26, [0xd8b884, 0xb08c5a, 0x7a5a32]);
  const coats = [[-26, 0x3a5a8a], [-17, 0xc8402a], [-9, 0x6a7a4a]];
  for (const [cx, c] of coats) {
    P.rect(cx, 61, 1, 2, 0x5a6068);
    area(P, cx - 3, 62, 7, 20, (X, Y, i, j) => ((j > 14 && (i === 0 || i === 6)) || (j < 2 && (i === 0 || i === 6)) ? null : i === 0 ? mix(c, WHITE, 0.2) : i >= 5 ? mul(c, 0.72) : j === 8 ? mul(c, 0.8) : jit(c, X, Y, 41, 0.05)));
  }
  // paraplyställ på golvet
  area(P, -22, 90, 10, 14, (X, Y, i, j) => (i === 0 ? 0xc8ccd0 : i === 9 ? 0x5a6068 : j === 0 ? 0xe8ecf0 : 0x8a929a));
  P.vl(-19, 80, 10, 0x2a2e34); P.vl(-15, 83, 7, 0xc8402a); P.px(-20, 79, 0x2a2e34);
}

// ---------- golvet ----------
function paintFloor(P) {
  area(P, XL, FLOOR_Y, WW, FH - FLOOR_Y, (X, Y) => {
    let c = qmix(0xd0d4c8, 0xdadcd2, (Y - FLOOR_Y) / 112, X, Y, 3);
    const h = hash(X, Y, 31);
    if (h > 0.935) c = [0xb2b6aa, 0xeef0e8, 0xc4baa6, 0xa6b6be][(hash(X, Y, 32) * 4) | 0];   // vinylens flingor
    else if (h < 0.04) c = mul(c, 0.95);
    if ((X - XL) % 112 === 0) c = mul(c, 0.92);                                               // svetsfogar
    return c;
  });
  [0.7, 0.8, 0.88, 0.94].forEach((f, i) => P.darken(XL, FLOOR_Y + i, WW, 1, f));
  // blanka speglingar av armaturerna
  for (const lx of [22, 118, 214]) for (let y = 110; y < 150; y++) for (let x = lx - 11; x < lx + 11; x++) if (bayer(x, y) < (1 - (y - 110) / 40) * 0.32) P.px(x, y, WHITE, 0.2);
  // personalytan bakom disken: plankgolv
  area(P, DESK.x0, DESK.base - 2, XR - DESK.x0, FH - DESK.base + 2, (X, Y, i, j) => {
    const row = (j / 6) | 0, ry = j % 6, off = ((hash(row, 1, 50) * 40) | 0), px = (X + off) % 38;
    let c = mix(0xc8a472, 0xb08a58, hash(Math.floor((X + off) / 38), row, 51) * 0.7);
    if (ry === 5 || px === 0) c = mul(c, 0.78);
    else if (ry === 0) c = mix(c, WHITE, 0.14);
    if (hash(X, Y >> 1, 52) > 0.8) c = mul(c, 0.94);
    return jit(c, X, Y, 53, 0.03);
  });
  // entrémattan (ribbad, grön kant)
  area(P, ENTRY.x0 + 1, FLOOR_Y, ENTRY.x1 - ENTRY.x0 - 2, 8, (X, Y, i, j) => (i === 0 || j === 7 || i === ENTRY.x1 - ENTRY.x0 - 3 ? GREEN_D : (i + (j >> 1)) % 3 === 0 ? 0x3a3e40 : 0x4a4e50));
  // AKUT-rutan: röd kant och text
  const Z = AKUT_ZONE;
  area(P, Z.x0, Z.y0, Z.x1 - Z.x0, Z.y1 - Z.y0, (X, Y, i, j) => {
    const edge = i < 2 || j < 2 || i >= Z.x1 - Z.x0 - 2 || j >= Z.y1 - Z.y0 - 2;
    if (edge) return ((X + Y) >> 1) % 3 === 0 ? 0xf4f0e8 : 0xd8342c;
    return mix(P.get(X, Y), 0xe86a5a, 0.16);
  });
  text(P, SMALL, 'AKUT', ((Z.x0 + Z.x1) >> 1) - 7, Z.y1 - 8, 0xc8201c);
  // dörrmattorna i rummens färger (visar vilken dörr som är vilken)
  for (const r of ROOMS) area(P, r.x0, FLOOR_Y + 1, r.x1 - r.x0, 5, (X, Y, i, j) => (j === 4 ? mul(r.col, 0.45) : (i % 3 === 0) ? mul(r.col, 0.62) : mul(r.col, 0.8)));
  // barnhörnans bilmatta: gräs, väg i en slinga, damm, hus och träd
  const mx0 = 4, my0 = 150, mw = 60, mh = 54;
  area(P, mx0, my0, mw, mh, (X, Y, i, j) => {
    if (i === 0 || j === 0 || i === mw - 1 || j === mh - 1) return 0x2e6a2a;
    const onRoad = (i >= 5 && i <= 10 || i >= mw - 11 && i <= mw - 6) && j >= 5 && j <= mh - 6 || (j >= 5 && j <= 10 || j >= mh - 11 && j <= mh - 6) && i >= 5 && i <= mw - 6;
    if (onRoad) {
      const mid = (i === 7 || i === 8 || i === mw - 9 || i === mw - 8) && j > 10 && j < mh - 11 ? (j >> 1) & 1 : (j === 7 || j === 8 || j === mh - 9 || j === mh - 8) && i > 10 && i < mw - 11 ? (i >> 1) & 1 : 0;
      return mid ? 0xf4f0e0 : jit(0x7a7e84, X, Y, 54, 0.06);
    }
    return jit((i + j) % 11 === 0 ? 0x6ab85a : 0x5aa84a, X, Y, 55, 0.08);
  });
  disc(P, 26.5, 173.5, 6, (x, y, d) => (d > 5 ? 0x2a6aa8 : d < 2 && x < 26 ? 0x9ad0f8 : 0x4a9ae0));
  area(P, 40, 168, 9, 8, (X, Y, i, j) => (j < 3 ? (Math.abs(i - 4) <= j + 1 ? 0xc8402a : null) : i === 3 && j > 4 ? 0x6a4a2a : 0xf4e8c8));
  for (const [tx, ty] of [[20, 186], [44, 186], [34, 182]]) { disc(P, tx + 0.5, ty + 0.5, 2.6, (x, y, d) => (d > 1.8 ? 0x2a6a2a : 0x3a8a3a)); P.px(tx, ty + 3, 0x6a4a2a); }
  // en leksaksbil på vägen
  P.rect(46, 158, 6, 3, 0xd8342c); P.hl(47, 157, 3, 0xff7a6a); P.px(47, 161, 0x1a1a1a); P.px(50, 161, 0x1a1a1a); P.px(48, 158, 0x9ad0f8);
}

// ======================= möblerna (drawables, en gång) =======================
// sittgrupp: fyra sammanbyggda stolar i grön plast på en kromad balk, vända mot oss.
// Spriten ritas med (0,0) = (vänstra sitsens x − 10, sitsens y − 24).
const GROUP_OX = 10, GROUP_OY = 24;
function paintGroup() {
  const n = 4, sp = 18, w = n * sp + 4, h = 30, SY = GROUP_OY;
  const P = new Pix(w, h);
  P.ell(w / 2, SY + 3, w / 2 - 1, 2.6, 0x1a1418, 0.35, 3);
  const shell = 0x2e9a5a, shellL = 0x5ac87a, shellD = 0x1e6a3e;
  // balken och benen (krom)
  rows(P, 3, SY - 6, w - 6, [0xeef2f6, 0xa8b0b8, 0x6a727a]);
  for (const lx of [5, (w >> 1) - 1, w - 7]) { vcols(P, lx, SY - 4, 6, [0xd8dee4, 0x8a929a]); P.rect(lx - 1, SY + 1, 4, 1, 0x2a2e34); }
  for (let k = 0; k < n; k++) {
    const cx = GROUP_OX + k * sp;                 // sitsens mitt i spriten
    // ryggstödet (skal med rundade hörn)
    area(P, cx - 7, SY - 22, 14, 12, (X, Y, i, j) => {
      if ((i === 0 || i === 13) && (j === 0 || j === 11)) return null;
      if (j === 0) return shellL;
      if (i === 0) return mix(shell, WHITE, 0.2);
      if (i === 13) return shellD;
      if (j === 11) return mul(shell, 0.8);
      return qmix(shell, mul(shell, 0.86), j / 11, X, Y, 3);
    });
    P.hl(cx - 4, SY - 20, 7, mix(shellL, WHITE, 0.3));
    // sitsen
    area(P, cx - 8, SY - 10, 16, 5, (X, Y, i, j) => {
      if ((i === 0 || i === 15) && j === 0) return null;
      if (j === 0) return mix(shellL, WHITE, 0.25);
      if (j === 4) return shellD;
      if (i === 0) return mix(shell, WHITE, 0.15);
      if (i === 15) return mul(shell, 0.78);
      return j === 1 ? shellL : shell;
    });
  }
  outline(P);
  return P.flush();
}
// nummerlappsautomaten: röd pelare med display, lappspringa och skylt (0,0) = (x − 9, y − 34)
function paintAutomat() {
  const P = new Pix(18, 36);
  P.ell(9, 33, 7, 2, 0x1a1418, 0.35, 3);
  // foten
  rows(P, 3, 31, 12, [0x9aa2aa, 0x5a6068]);
  // pelaren
  area(P, 4, 8, 10, 23, (X, Y, i, j) => {
    let c = qmix(0xe0443a, 0xb02028, j / 23, X, Y, 3);
    if (i === 0) c = 0xff7a6a; if (i === 9) c = 0x7a1418;
    if (j === 0) c = 0xff8a7a;
    return c;
  });
  // displayen och lappspringan med en lapp som sticker ut
  P.rect(6, 11, 6, 4, 0x1a1210); P.hl(7, 12, 3, 0xff4a2a);
  P.rect(6, 18, 6, 2, 0x3a0a08); P.rect(7, 19, 4, 3, 0xfbfaf6); P.hl(7, 21, 4, 0xd8d4c8);
  P.hl(6, 25, 6, 0x9a1a16); P.px(8, 26, 0xffd23f);
  // skylten på stången: NR i röda bokstäver
  P.vl(8, 6, 2, 0x9aa2aa);
  area(P, 3, 0, 12, 7, (X, Y, i, j) => (i === 0 || j === 0 || i === 11 || j === 6 ? 0x8a1612 : 0xfbfaf6));
  text(P, SMALL, 'NR', 5, 1, 0xc8202a);
  outline(P);
  return P.flush();
}
// vattenautomaten: vit kropp, blå dunk, kopphållare (0,0) = (x − 8, y − 32)
function paintCooler() {
  const P = new Pix(18, 34);
  P.ell(8, 31, 7, 2, 0x1a1418, 0.35, 3);
  area(P, 3, 13, 11, 18, (X, Y, i, j) => (i === 0 ? 0xffffff : i === 10 ? 0xa8b0b8 : j === 17 ? 0x8a929a : j === 6 ? 0x2a2e34 : j === 7 ? 0x5a6068 : 0xeef2f4));
  P.px(5, 17, 0x3a7ad8); P.px(10, 17, 0xd8342c); P.rect(6, 20, 5, 1, 0x9aa2aa);
  disc(P, 8.5, 7.5, 5.2, (x, y, d) => (d > 4.4 ? 0x2a6ab8 : x < 7 && y < 6 ? 0xc8eaff : 0x5ab0f0));
  P.rect(6, 0, 5, 3, 0x2a6ab8); P.hl(7, 0, 3, 0x7ac8ff);
  area(P, 14, 16, 3, 9, (X, Y, i, j) => (i === 0 ? 0xffffff : j % 3 === 0 ? 0xd8dce0 : 0xf4f6f8));
  outline(P);
  return P.flush();
}
// monsteran i vit kruka (0,0) = (x − 14, y − 44)
function paintPlant() {
  const P = new Pix(28, 46);
  P.ell(14, 43, 9, 2.4, 0x1a1418, 0.35, 3);
  area(P, 7, 32, 14, 11, (X, Y, i, j) => (j === 0 ? 0xffffff : i === 0 ? 0xf4f4f0 : i === 13 ? 0xb8bcb8 : j === 10 ? 0xc8ccc8 : 0xe8eae6));
  P.hl(8, 33, 12, 0x5a3a20);
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (k - 4) * 0.36, len = 14 + hash(k, 1, 60) * 10;
    const ex = 14 + Math.cos(a) * len, ey = 33 + Math.sin(a) * len * 0.95;
    P.line(14, 33, ex, ey, 0x2a6a2a);
    disc(P, ex, ey, 4.2 + hash(k, 2, 60) * 1.4, (x, y, d) => {
      if (((x * 3 + y * 5 + k) % 7 === 0) && d > 1.5) return null;   // monsterans hål
      return d > 3.6 ? 0x1e5a24 : x < ex - 1 ? 0x5ab85a : 0x3a9a3e;
    });
  }
  outline(P);
  return P.flush();
}
// leksakslådan med klossar (0,0) = (x − 9, y − 16)
function paintToybox() {
  const P = new Pix(20, 18);
  P.ell(9, 15, 8, 2, 0x1a1418, 0.35, 3);
  area(P, 1, 5, 17, 10, (X, Y, i, j) => (j === 0 ? 0xffe07a : i === 0 ? 0xffd23f : i === 16 ? 0xb88a18 : j === 9 ? 0xb88a18 : j === 4 ? 0x2a6ad8 : 0xf0c030));
  for (const [x, y, c] of [[3, 2, 0xd8342c], [7, 1, 0x3a7ad8], [11, 3, GREEN], [14, 2, 0x9a5ad8]]) { P.rect(x, y, 3, 3, c); P.hl(x, y, 3, mix(c, WHITE, 0.4)); }
  text(P, SMALL, 'ABC', 4, 8, 0xd8342c);
  outline(P);
  return P.flush();
}
// tidningsbordet med tidningar och en vas (0,0) = (x − 14, y − 18)
function paintTable() {
  const P = new Pix(28, 20);
  P.ell(14, 17, 12, 2, 0x1a1418, 0.35, 3);
  area(P, 1, 6, 26, 4, (X, Y, i, j) => (j === 0 ? 0xe8cc98 : j === 3 ? 0x8a6a3a : i === 0 ? 0xdcbc88 : 0xc8a470));
  for (const lx of [3, 23]) vcols(P, lx, 10, 7, [0xa8845a, 0x6a4a2a]);
  for (const [x, y, c] of [[4, 5, 0xd8342c], [9, 4, 0x3a7ad8], [13, 5, 0xffd23f]]) { P.rect(x, y, 6, 2, c); P.hl(x + 1, y, 4, WHITE); }
  P.rect(20, 1, 3, 5, 0x9ad0f8); P.px(21, 0, 0xff7aa0); P.px(20, 0, GREEN);
  outline(P);
  return P.flush();
}
// kontorsstolen (sedd framifrån-ovanifrån) (0,0) = (x − 9, y − 26)
function paintChair() {
  const P = new Pix(18, 28);
  P.ell(9, 25, 8, 2, 0x1a1418, 0.35, 3);
  for (const [x, y] of [[2, 24], [8, 25], [15, 24]]) P.rect(x, y, 2, 2, 0x1a1a1e);
  P.hl(3, 23, 12, 0x3a3e44); P.vl(8, 17, 6, 0x9aa2aa); P.vl(9, 17, 6, 0x5a6068);
  area(P, 2, 12, 14, 5, (X, Y, i, j) => (j === 0 ? 0x5a6a7a : i === 0 ? 0x4a5a6a : i === 13 ? 0x1e2630 : 0x2e3a48));
  area(P, 4, 0, 10, 12, (X, Y, i, j) => ((i === 0 || i === 9) && j === 0 ? null : j === 0 ? 0x5a6a7a : i === 0 ? 0x4a5a6a : i === 9 ? 0x1e2630 : (i + j) % 4 === 0 ? 0x3a4858 : 0x2e3a48));
  outline(P);
  return P.flush();
}
// pärmhyllan längst ner i personalytan (0,0) = (DESK.x0 + 4, 198)
function paintShelf() {
  const w = XR - DESK.x0 - 4, P = new Pix(w, 18);
  area(P, 0, 0, w, 18, (X, Y, i, j) => (j === 0 ? 0xf0dcb4 : j === 1 ? 0xc8a878 : i === 0 ? 0xdcc090 : 0xb89868));
  for (let x = 3; x < w - 4; x += 5) {
    const c = [0x3a7ad8, 0xd8342c, GREEN, 0xffd23f, 0x9a5ad8, 0x3a3e44][((x * 7) >> 2) % 6], hh = 11 + ((hash(x, 1, 70) * 3) | 0);
    area(P, x, 17 - hh, 4, hh, (X, Y, i, j) => (i === 0 ? mix(c, WHITE, 0.25) : i === 3 ? mul(c, 0.7) : j === 3 ? WHITE : c));
    P.px(x + 1, 17 - hh + 6, 0x2a2e34);
  }
  return P.flush();
}

// ======================= disken (ritas framför patienterna vid luckorna) =======================
function paintDesk() {
  const P = new Pix(WW, FH, XL, 0);
  const x0 = DESK.x0, w = XR - x0, top = DESK.top, face = DESK.face, base = DESK.base;
  // glasskivan på diskens bakkant: stolpar, överlist, glas med blänk, talgaller och passerlucka
  const gy0 = 104, gy1 = top;
  for (let X = x0; X < XR; X++) for (let Y = gy0; Y < gy1; Y++) {
    const slot = WIN.some((wx) => Math.abs(X - wx) <= 9) && Y >= gy1 - 5;
    if (slot) continue;
    const d = (X + (Y - gy0) * 2) % 37;
    if (d === 0 || d === 2) P.px(X, Y, WHITE, 0.55);
    else if (d === 1) P.px(X, Y, 0xe8f6ff, 0.28);
    else if ((X * 3 + Y) % 11 === 0) P.px(X, Y, 0xd8eef8, 0.12);
  }
  for (const wx of WIN) {
    for (const [dx, dy] of [[-2, 0], [0, 0], [2, 0], [-1, 2], [1, 2], [-2, 4], [0, 4], [2, 4]]) P.px(wx + dx, gy0 + 3 + dy, 0x8a929a);
    P.hl(wx - 10, gy1 - 6, 21, 0x9aa2aa);
  }
  rows(P, x0, gy0 - 2, w, [0xeef2f6, 0x9aa2aa]);
  for (const px of [x0, 344, XR - 2]) vcols(P, px, gy0 - 2, gy1 - gy0 + 2, [0xe0e6ec, 0x8a929a]);
  // luckornas nummer: gröna dekaler på glaset till vänster om talgallret
  WIN.forEach((wx, i) => {
    const px = wx - 12, py = gy0 + 1;
    area(P, px, py, 7, 9, (X, Y, ii, jj) => ((ii === 0 || ii === 6) && (jj === 0 || jj === 8) ? null : ii === 0 || jj === 0 || ii === 6 || jj === 8 ? GREEN_D : GREEN));
    text(P, SMALL, String(i + 1), px + 2, py + 2, WHITE);
  });
  // skivan (björklaminat, sedd ovanifrån) och kanten mot oss
  area(P, x0, top, w, face - top, (X, Y, i, j) => {
    let c = qmix(0xe0c898, 0xecd8b0, j / 6, X, Y, 3);
    if (j === face - top - 1) c = 0xf8ecd0;
    if (i === 0) c = 0xf4e4c0;
    if ((X * 5 + (Y << 3)) % 29 === 0) c = mul(c, 0.95);
    return c;
  });
  // fronten mot personalsidan: vit laminat med björklist, lådhurtsar och knäutrymmen
  area(P, x0, face, w, base - face, (X, Y, i, j) => {
    let c = qmix(0xf2f0ea, 0xdcd8cc, j / (base - face), X, Y, 3);
    if (j === 0) c = 0xb08c5a; else if (j === 1) c = 0xd8bc88;
    if (j === base - face - 1) c = 0x8a8478; else if (j === base - face - 2) c = 0xc8c4b8;
    if (i === 0) c = mix(c, WHITE, 0.3);
    const knee = WIN.some((wx) => Math.abs(X - wx) <= 11) && j >= 3 && j < base - face - 2;
    if (knee) c = qmix(0x7a7870, 0x5a5850, (j - 3) / 20, X, Y, 2);
    return jit(c, X, Y, 80, 0.02);
  });
  // lådor i hurtsarna (mellan och till vänster om luckorna)
  for (const [hx, hw] of [[x0 + 3, 20], [MON.x0 - 1, 28], [396, 18]]) {
    for (let k = 0; k < 3; k++) {
      const y = face + 3 + k * 7;
      area(P, hx, y, hw, 6, (X, Y, i, j) => (j === 0 ? WHITE : j === 5 ? 0xb8b4a8 : i === 0 ? 0xfafaf6 : i === hw - 1 ? 0xc8c4b8 : 0xeceae2));
      P.hl(hx + (hw >> 1) - 3, y + 2, 6, 0x9aa2aa); P.hl(hx + (hw >> 1) - 3, y + 3, 6, 0x5a6068);
    }
  }
  // datorn under disken (lucka 2) och papperskorgen (lucka 1)
  area(P, WIN[1] + 3, face + 6, 7, 18, (X, Y, i, j) => (i === 0 ? 0x5a5e66 : i === 6 ? 0x1a1c20 : j === 0 ? 0x6a6e76 : 0x2e3238));
  P.px(WIN[1] + 6, face + 9, 0x5ab0ff); P.hl(WIN[1] + 5, face + 12, 3, 0x1a1c20);
  area(P, WIN[0] - 9, face + 14, 7, 10, (X, Y, i, j) => (j === 0 ? 0x5a6068 : i === 0 ? 0x4a5058 : i === 6 ? 0x1e2226 : 0x3a3e44));
  P.px(WIN[0] - 7, face + 13, 0xfbfaf6); P.px(WIN[0] - 6, face + 12, 0xfbfaf6);
  // tangentbord framför luckorna, mus, pennkopp, blanketter, telefon, blomma
  for (const wx of WIN) {
    area(P, wx - 8, top + 1, 15, 4, (X, Y, i, j) => (j === 0 ? 0x9aa2aa : j === 3 ? 0x3a3e44 : (i + j) % 2 ? 0xd8dce0 : 0x6a7078));
    P.rect(wx + 9, top + 2, 2, 3, 0xe8ecf0); P.px(wx + 9, top + 4, 0x6a7078);
  }
  P.rect(381, top - 4, 3, 5, 0x3a7ad8); P.px(381, top - 6, 0xd8342c); P.px(382, top - 5, 0xffd23f); P.px(383, top - 6, 0x2a2e34);
  area(P, 389, top - 4, 10, 5, (X, Y, i, j) => (j === 0 ? 0x5a6068 : i < 3 ? 0x2a2e34 : j === 4 ? 0x1a1c20 : 0x3a3e44));
  P.px(392, top - 2, 0x5ad070);
  disc(P, 406.5, top - 6, 3.4, (x, y, d) => (d > 2.6 ? 0x2a6a2a : 0x4a9a3e)); P.rect(404, top - 3, 5, 3, 0xd8c8b0);
  // skärmen mellan luckorna: ram, fot (innehållet ritas levande)
  const { x0: mx0, x1: mx1, y0: my0, y1: my1 } = MON;
  area(P, mx0, my0, mx1 - mx0, my1 - my0, (X, Y, i, j) => (i === 0 || j === 0 ? 0x4a4e56 : i === mx1 - mx0 - 1 || j === my1 - my0 - 1 ? 0x121416 : j === my1 - my0 - 2 ? 0x2a2e34 : 0x1e2126));
  P.rect(((mx0 + mx1) >> 1) - 2, my1, 4, top - my1 + 1, 0x3a3e44); P.hl(((mx0 + mx1) >> 1) - 5, top, 10, 0x2a2e34);
  P.px(mx1 - 3, my1 - 2, 0x5ad070);
  // NÄSTA-knappen: grå låda med stor grön knapp och etikett
  const { x0: nx0, x1: nx1, y0: ny0, y1: ny1 } = NEXT;
  area(P, nx0, ny0 + 3, nx1 - nx0, ny1 - ny0 - 3, (X, Y, i, j) => (j === 0 ? 0xd8dee4 : i === 0 ? 0xc8ced4 : i === nx1 - nx0 - 1 ? 0x6a7078 : j === ny1 - ny0 - 4 ? 0x5a6068 : 0x9aa2aa));
  text(P, SMALL, 'NÄSTA', nx0 + 2, ny0 + 6, 0x1e2226);
  // mellanväggen mot väntrummet (halvhög, björklist överst)
  area(P, x0 - 4, face, 4, FH - face, (X, Y, i, j) => (i === 0 ? 0xf4e4c0 : i === 3 ? 0x9a7a4a : 0xdcc090));
  area(P, x0 - 4, FH - 12, 4, 12, (X, Y, i) => (i === 0 ? WHITE : i === 3 ? 0xa8a498 : 0xe8e6de));
  return P.flush();
}

// ---------- rummen bakom dörrarna (syns när dörren står öppen) ----------
function paintInterior(r) {
  const w = r.x1 - r.x0, h = FLOOR_Y - DOOR_TOP, P = new Pix(w, h);
  const wallC = [0xc8dcf4, 0xe0d0f4, 0xf8e0c4, 0xf4f6f8][r.i], floorC = [0xa8b8c8, 0xbcaec8, 0xc8b49c, 0xc0c8cc][r.i];
  area(P, 0, 0, w, h, (X, Y, i, j) => (j < h - 12 ? qmix(mul(wallC, 0.78), wallC, j / (h - 12), X, Y, 3) : qmix(floorC, mul(floorC, 0.8), (j - h + 12) / 12, X, Y, 3)));
  P.hl(0, h - 12, w, mul(wallC, 0.6));
  if (r.i === 0) {          // LÄKARE: britsen med pappersrulle och en syntavla
    area(P, 3, h - 18, w - 8, 5, (X, Y, i, j) => (j === 0 ? 0xffffff : j < 3 ? 0x6a9ad8 : 0x3a5a8a));
    P.hl(3, h - 19, w - 8, 0xf4f4ee); vcols(P, 4, h - 13, 6, [0x9aa2aa]); vcols(P, w - 6, h - 13, 6, [0x9aa2aa]);
    area(P, w - 11, 6, 8, 11, (X, Y, i, j) => (i === 0 || j === 0 || i === 7 || j === 10 ? 0x9aa2aa : WHITE));
    for (let k = 0; k < 4; k++) P.hl(w - 9 + (k >> 1), 7 + k * 2, 4 - (k >> 1) * 2, 0x2a2e34);
  } else if (r.i === 1) {   // SJUKSKÖTERSKA: skåp med flaskor och en stol
    area(P, 2, 8, 12, 16, (X, Y, i, j) => (i === 0 || j === 0 ? 0xffffff : j % 5 === 4 ? 0xb8bcc4 : 0xeef0f4));
    for (const [x, y, c] of [[4, 10, 0x5ab0f0], [7, 10, 0xd8342c], [10, 11, GREEN], [5, 15, 0xffd23f], [9, 15, 0x9a5ad8]]) P.rect(x, y, 2, 3, c);
    area(P, w - 10, h - 20, 7, 8, (X, Y, i, j) => (j < 5 ? 0x7a5ab8 : i === 0 || i === 6 ? 0x6a7078 : null));
  } else if (r.i === 2) {   // LABB: bänk med provrörsställ och mikroskop
    area(P, 0, h - 22, w, 4, (X, Y, i, j) => (j === 0 ? 0xffffff : j === 3 ? 0x9aa2aa : 0xdce2e8));
    for (let k = 0; k < 5; k++) { P.rect(3 + k * 3, h - 29, 2, 7, 0xe8f4fc); P.rect(3 + k * 3, h - 26, 2, 4, [0xd8342c, 0xffd23f, 0xd8342c, 0x5ab0f0, 0xd8342c][k]); }
    P.rect(w - 10, h - 30, 3, 8, 0x3a3e44); P.rect(w - 12, h - 32, 6, 3, 0x5a6068); P.px(w - 9, h - 33, 0xffffff);
  } else {                  // AKUTEN: ljus korridor med en brits på hjul och röd linje i golvet
    P.hl(0, h - 5, w, 0xd8342c); P.hl(0, h - 4, w, 0x9a1a16);
    area(P, 6, h - 20, w - 14, 5, (X, Y, i, j) => (j === 0 ? 0xffffff : j < 3 ? 0xe8ecf0 : 0x8a929a));
    for (const lx of [8, w - 10]) { P.vl(lx, h - 15, 5, 0x9aa2aa); P.px(lx, h - 10, 0x1a1a1e); }
    for (let x = 4; x < w - 4; x += 10) P.rect(x, 2, 6, 2, 0xfdfefe);
  }
  P.darken(0, 0, w, 2, 0.7); P.darken(0, 0, 2, h, 0.8); P.darken(w - 2, 0, 2, h, 0.8);
  return P.flush();
}

let ART = null;
function art() {
  if (!ART) ART = {
    back: paintBack(), desk: paintDesk(), group: paintGroup(), automat: paintAutomat(), cooler: paintCooler(),
    plant: paintPlant(), toybox: paintToybox(), table: paintTable(), chair: paintChair(), shelf: paintShelf(),
    rooms: ROOMS.map(paintInterior),
  };
  return ART;
}

// Pratbubbla med rundade hörn och spets nedåt i (cx, tip) – samma som i de andra jobben
// (bx = bubblans vänsterkant om den ska klämmas in i bild; spetsen pekar ändå på cx)
function bubble(ctx, cx, tip, iw, ih, hot = false, edge = null, bx = null) {
  const w = iw + 2, h = ih + 2, x0 = bx ?? cx - (w >> 1), y0 = tip - 2 - h;
  ctx.fillStyle = edge || (hot ? '#e8b230' : '#17151a');
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.fillRect(cx - 1, tip - 2, 3, 2); ctx.fillRect(cx, tip, 1, 1);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  ctx.fillRect(cx, tip - 2, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
  if (hot) { ctx.fillStyle = '#ffe07a'; ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3); }
  return [x0 + 1, y0 + 1];
}

// ======================= jobbet =======================
export function makeJobbVard(A, { onDone } = {}) {
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0, patienter: 0, akut: 0, felrum: 0 };
  const G = art();
  const lvl = levelOf(A.game?.jobs?.vard || 0);
  const pace = 1 - 0.05 * (lvl - 1);                 // högre nivå = fler patienter
  const startMin = A.game?.min ?? 10 * 60;
  const myLook = { ...(A.avatar?.look || {}), neck: 'lanyard', neckColor: '#3aa050' };
  const pops = makePops();
  const talkDoor = ROOMS.map(() => createSpeech());
  // spelaren står bakom disken och går mellan luckorna
  const walker = createWalker({ W: XR, H: FH, left: DESK.x0 + 4, right: XR - 4, top: WORK_Y - 4, bottom: 198, spawn: [WIN[0], WORK_Y] });
  walker.speed = 80;
  walker.setObstacles([[CHAIR.x - 8, CHAIR.y - 6, CHAIR.x + 8, CHAIR.y + 2]]);
  walker.dir = 'up';
  // patienternas gångytor (A* i väntrummet)
  const OBST = [
    [AUTO.x - 8, AUTO.y - 8, AUTO.x + 8, AUTO.y + 1],
    [COOLER.x - 7, COOLER.y - 6, COOLER.x + 8, COOLER.y + 1],
    ...GROUPS.map(([gx, gy]) => [gx - 9, gy - 7, gx + 3 * 18 + 9, gy + 1]),
    [TOYBOX.x - 9, TOYBOX.y - 5, TOYBOX.x + 10, TOYBOX.y + 1],
    [TABLE.x - 13, TABLE.y - 8, TABLE.x + 13, TABLE.y + 1],
    [PLANT.x - 6, PLANT.y - 5, PLANT.x + 7, PLANT.y + 1],
    [DESK.x0 - 4, 130, XR, FH],
  ];
  const mkWalker = (x, y) => { const w = createWalker({ W: XR, H: FH, left: 2, right: XR - 2, top: FLOOR_Y + 2, bottom: FH - 4, spawn: [x, y] }); w.setObstacles(OBST); w.speed = 46; w.px = x; w.py = y; return w; };

  const seats = [];
  for (const [gx, gy] of GROUPS) for (let k = 0; k < 4; k++) seats.push({ x: gx + k * 18, y: gy, occ: null });
  const akutSpots = AKUT_SPOTS.map(([x, y]) => ({ x, y, occ: null }));
  const wins = [null, null];                     // vem som är på väg till / står vid luckan
  const doors = ROOMS.map(() => ({ open: 0, hold: 0, staff: 0 }));
  let patients = [], t = 0, clk = 0, seq = 0, ticketNo = 20 + ((Math.random() * 50) | 0);
  let spawnIn = 1.6, akutIn = 14 + Math.random() * 8, akutSpawned = 0, autoSpawn = true;
  let done = false, doneT = 0, reported = false;
  let nuNo = null, nuWin = 0, nuFlash = 0, entryOpen = 0, entrySound = 0, amb = null;
  let calls = 0, sends = 0, hintT = 0, nextGlow = 0;

  const R = Math.random;
  const pick = (a) => a[(R() * a.length) | 0];
  const say = (x, y, s, c = '#d8d2c0') => { const hw = (textW(SMALL, s) + 4) >> 1; pops.add(clamp(Math.round(x), hw + 2, FW - hw - 2), y, s, c); };
  const myWin = () => { const i = Math.abs(walker.px - WIN[0]) <= Math.abs(walker.px - WIN[1]) ? 0 : 1; return Math.abs(walker.px - WIN[i]) < 14 ? i : -1; };
  const nearWin = () => (Math.abs(walker.px - WIN[0]) <= Math.abs(walker.px - WIN[1]) ? 0 : 1);
  const waiting = () => patients.filter((p) => p.state === 'wait');

  // ---------- patienterna ----------
  function newPatient(sym, { seated = false, akut = false } = {}) {
    const s = SYMS[sym], isAkut = akut || !!s.akut;
    const prog = Math.min(1, t / SHIFT_SECONDS);
    const pmax = isAkut ? 17 : 36 - 10 * prog;
    const p = {
      id: seq++, look: makeLook(), sym, akut: isAkut, num: null, state: 'in', w: mkWalker(ENTRY.cx, 110),
      x: ENTRY.cx, y: 97, dir: 'down', seat: null, spot: null, win: null, room: null, dest: null, wrong: null,
      pat: pmax, pmax, deskPat: isAkut ? 11 : 15, deskMax: isAkut ? 11 : 15, passed: 0, t: 0, angry: false, sat: 0,
    };
    if (seated) {
      if (isAkut) {
        const sp = akutSpots.find((q) => !q.occ);
        if (!sp) return null;
        sp.occ = p; p.spot = sp; p.x = sp.x; p.y = sp.y; p.state = 'wait'; p.dir = 'down';
      } else {
        const free = freeSeats();
        if (!free.length) return null;
        const st = free[(R() * free.length) | 0];
        st.occ = p; p.seat = st; p.x = st.x; p.y = st.y; p.state = 'wait'; p.dir = 'down'; p.sat = 1;
        p.num = ticketNo++;
      }
      p.w.px = p.x; p.w.py = p.y + 8;
    }
    if (isAkut) stats.akut++;
    patients.push(p);
    return p;
  }
  function spawn(akut = false) {
    const open = akut ? akutSpots.some((q) => !q.occ) || seats.some((q) => !q.occ) : seats.some((q) => !q.occ);
    if (!open || patients.filter((p) => p.state === 'in').length) return null;
    const p = newPatient(akut ? AKUT : randomSym(), { akut });
    if (!p) return null;
    if (akut) { amb = { t: 0, x: 60 }; akutSpawned++; }
    return p;
  }
  function freeSeat(p) { if (p.seat && p.seat.occ === p) p.seat.occ = null; p.seat = null; if (p.spot && p.spot.occ === p) p.spot.occ = null; p.spot = null; }
  function freeWin(p) { if (p.win !== null && wins[p.win] === p) wins[p.win] = null; p.win = null; }
  function go(p, x, y, state, cb) {
    p.state = state;
    p.w.px = p.x; p.w.py = p.y;
    p.w.walkTo(x, y, () => { p.x = p.w.px; p.y = p.w.py; cb?.(); });
  }
  // lediga platser – bakre raden först (då skymmer främre radens bubblor ingen), sedan främre
  function freeSeats() { const back = seats.filter((q) => !q.occ && q.y === ROW_Y[0]); return back.length ? back : seats.filter((q) => !q.occ); }
  function goSeat(p) {
    const free = freeSeats();
    if (!free.length) { leave(p, false); return; }
    free.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const st = free[Math.min(free.length - 1, (R() * 3) | 0)];
    st.occ = p; p.seat = st;
    go(p, st.x, st.y + 8, 'toSeat', () => { p.state = 'sit'; p.t = 0.22; p.dir = 'down'; });
  }
  function goSpot(p) {
    const sp = akutSpots.find((q) => !q.occ);
    if (!sp) { goSeat(p); return; }
    sp.occ = p; p.spot = sp;
    go(p, sp.x, sp.y, 'toSpot', () => { p.state = 'wait'; p.dir = 'down'; });
  }
  // ropa in en patient till en ledig lucka (den man står vid i första hand)
  function call(p) {
    if (!p || p.state !== 'wait') return false;
    const mine = myWin();
    let wi = mine >= 0 && !wins[mine] ? mine : !wins[nearWin()] ? nearWin() : wins[0] ? (wins[1] ? -1 : 1) : 0;
    if (wi < 0) { say(WIN[0] + 26, 92, 'LUCKORNA ÄR FULLA!', '#ffd23f'); play('miss'); return false; }
    // akutfall först: alla andra akutpatienter som väntar blev passerade
    for (const q of patients) if (q !== p && q.akut && q.state === 'wait') q.passed++;
    calls++;
    wins[wi] = p; p.win = wi;
    freeSeat(p);
    if (p.sat) { p.y = p.y + 8; p.sat = 0; }
    nuNo = p.akut ? 'AKUT' : String(p.num % 1000).padStart(3, '0'); nuWin = wi; nuFlash = 1.6;
    play('ok');
    go(p, WIN[wi], PAT_Y, 'called', () => { p.state = 'desk'; p.dir = 'down'; if (p.dest !== null) { const d = p.dest; p.dest = null; send(p, d); } });
    // man går själv till luckan om man inte redan har någon framför sig
    const cur = mine >= 0 ? wins[mine] : null;
    if (!cur || cur === p) walker.walkTo(WIN[wi], WORK_Y, () => { walker.dir = 'up'; });
    return true;
  }
  function callNext() {
    const list = waiting().filter((p) => !p.akut && p.num !== null).sort((a, b) => a.num - b.num);
    nextGlow = 0.4;
    if (!list.length) { const ak = waiting().find((p) => p.akut); if (ak) return call(ak); say(NEXT.x0 + 12, 96, 'INGEN I KÖN', '#d8d2c0'); play('miss'); return false; }
    return call(list[0]);
  }
  // skicka patienten till ett rum: rätt = lön (+ bonus för akutfall först), fel = avdrag
  function send(p, ri) {
    const right = SYMS[p.sym].room;
    const r = ROOMS[ri];
    freeWin(p);
    sends++;
    if (ri === right) {
      stats.ok++; stats.patienter++;
      if (p.akut && p.passed === 0) { stats.boxes++; say(WIN[0] + 26, 92, 'AKUT FÖRST! BONUS!', '#ffd23f'); play('box'); }
      else { say(p.x, 94, 'RÄTT RUM!', '#8ee03c'); play('coin'); }
    } else {
      stats.fel++; stats.felrum++;
      p.wrong = ri;
      say(p.x, 94, 'FEL RUM!', '#ff6a6a'); play('fel');
    }
    p.room = ri;
    go(p, r.cx, FLOOR_Y + 6, 'toDoor', () => { p.state = 'atDoor'; p.t = 0.7; p.dir = 'up'; openDoor(ri, p); });
  }
  function openDoor(ri, p) {
    const d = doors[ri];
    d.hold = Math.max(d.hold, 1.5); d.staff = 1.5;
    if (p.wrong !== null) doorSay(ri, `FEL RUM! GÅ TILL ${ROOMS[SYMS[p.sym].room].to}!`, 2.4);
    else doorSay(ri, pick(GREET), 1.8);
  }
  // personalens pratbubbla ovanför dörren. Spetsen sitter normalt strax under karmen; i
  // mobilens fyll-läge flyttas den ner så att hela bubblan (sayBubble: 7 px per rad + 4,
  // spets och kant 5 till) hamnar under passets remsa – aldrig text under remsan.
  const doorTip = (s) => Math.max(DOOR_TOP + 4, hudBottom() + 2 + sayLines(s, 124, 5).length * 7 + 4 + 5);
  function doorSay(ri, s, secs) {
    const r = ROOMS[ri];
    talkDoor[ri].say(s, () => ({ x: r.cx, y: doorTip(s) }), secs, { voice: STAFF[ri] });
  }
  function leave(p, late) {
    if (late) {
      // räknas bara som missad (som i de andra jobben): 0 kr, en egen rad på lönebeskedet, inte ett "fel"
      stats.miss++;
      say(p.x, Math.min(p.y - 50, 96), p.akut ? 'FÖR SENT!' : 'GICK HEM!', '#ff6a6a');
      play('miss');
      p.angry = true;
    }
    freeSeat(p); freeWin(p);
    if (p.sat) { p.y += 8; p.sat = 0; }
    p.w.speed = late ? 60 : 50;
    go(p, ENTRY.cx, FLOOR_Y + 6, 'leave', () => { p.state = 'out'; p.dir = 'up'; });
  }
  // Vem en dörrklick (eller tangent 1–4) gäller – och vems bubbla som lyser: den som STÅR
  // FRAMME vid en lucka går alltid före den som fortfarande är på väg (först min lucka, sedan
  // den andra). Bara när ingen står framme gäller den som är på väg: hen får rummet som mål
  // och går dit när hen kommer fram – i första hand någon som inte redan fått ett rum.
  // (Förut fick den som var på väg till min lucka dörrens rum, fast en annan patient stod
  // och väntade vid andra luckan – en snabb spelare skickade då fel person till fel rum.)
  function deskTarget() {
    const mine = myWin(), idx = mine >= 0 ? mine : nearWin(), order = [idx, 1 - idx];
    const find = (ok) => { for (const wi of order) { const p = wins[wi]; if (p && ok(p)) return { p, wi, idx }; } return null; };
    return find((p) => p.state === 'desk') || find((p) => p.state === 'called' && p.dest === null) || find((p) => p.state === 'called');
  }
  function sendFromDesk(ri) {
    const tg = deskTarget();
    if (!tg) { say(ROOMS[ri].cx, 96, 'KLICKA PÅ EN PATIENT FÖRST!', '#ffd23f'); play('miss'); return false; }
    const { p, wi, idx } = tg;
    // står patienten vid den andra luckan går man dit – men patienten skickas direkt, så att
    // inget klick kan gå förlorat om man hinner klicka på något annat under tiden
    if (wi !== idx) walker.walkTo(WIN[wi], WORK_Y, () => { walker.dir = 'up'; });
    if (p.state === 'desk') send(p, ri);
    else { p.dest = ri; say(p.x, 94, ROOMS[ri].name + '!', css(mix(ROOMS[ri].col, WHITE, 0.4))); play('click'); }
    return true;
  }

  // ---------- uppdateringen ----------
  function updatePatients(dt) {
    for (const p of patients) {
      if (p.state === 'in') {                            // genom skjutdörrarna och in
        p.y += 38 * dt;
        if (p.y >= FLOOR_Y + 6) { p.y = FLOOR_Y + 6; if (p.akut) goSpot(p); else go(p, AUTO.x, AUTO.y + 8, 'toTicket', () => { p.state = 'ticket'; p.t = 0.9; p.dir = 'up'; }); }
      } else if (p.state === 'ticket') {
        p.t -= dt;
        if (p.t <= 0.45 && p.num === null) { p.num = ticketNo++; play('click'); }
        if (p.t <= 0) goSeat(p);
      } else if (p.state === 'sit') {                     // glider in på stolen
        p.t -= dt;
        const k = clamp(1 - p.t / 0.22, 0, 1);
        p.y = p.seat.y + 8 - 8 * k; p.x = p.seat.x;
        if (p.t <= 0) { p.state = 'wait'; p.sat = 1; p.y = p.seat.y; }
      } else if (p.state === 'wait') {
        p.pat -= dt;
        if (p.pat <= 0) leave(p, true);
      } else if (p.state === 'desk') {
        p.deskPat -= dt;
        if (p.deskPat <= 0) leave(p, true);
      } else if (p.state === 'atDoor') {
        p.t -= dt;
        if (p.t <= 0) {
          if (p.wrong !== null) {                         // personalen skickar vidare till rätt rum
            const ri = SYMS[p.sym].room; p.wrong = null; p.room = ri;
            go(p, ROOMS[ri].cx, FLOOR_Y + 6, 'toDoor', () => { p.state = 'atDoor'; p.t = 0.6; p.dir = 'up'; openDoor(ri, p); });
          } else { p.state = 'enter'; p.t = 0.6; doors[p.room].hold = Math.max(doors[p.room].hold, 0.9); }
        }
      } else if (p.state === 'enter') {
        p.y -= 14 * dt; p.t -= dt;
        if (p.t <= 0) p.gone = true;
      } else if (p.state === 'out') {
        p.y -= 36 * dt;
        if (p.y < GLASS.y0 + 34) p.gone = true;
      }
      // gång längs A*-vägen
      if (p.w.path.length && (p.state === 'toTicket' || p.state === 'toSeat' || p.state === 'toSpot' || p.state === 'called' || p.state === 'toDoor' || p.state === 'leave')) {
        p.w.update(dt);
        p.x = p.w.px; p.y = p.w.py; p.dir = p.w.dir;
      }
    }
    for (const p of patients) if (p.gone) { freeSeat(p); freeWin(p); }
    patients = patients.filter((p) => !p.gone);
  }
  function updateWorld(dt) {
    // entrén: dörrarna glider isär när någon är nära
    const near = patients.some((p) => Math.abs(p.x - ENTRY.cx) < 16 && p.y < FLOOR_Y + 16 && (p.state === 'in' || p.state === 'out' || p.state === 'leave' || p.state === 'toTicket' || p.state === 'toSpot'));
    const was = entryOpen;
    entryOpen = clamp(entryOpen + (near ? 3 : -1.6) * dt, 0, 1);
    entrySound -= dt;
    if (was === 0 && entryOpen > 0 && entrySound <= 0) { play('door'); entrySound = 1.2; }
    for (const d of doors) { d.hold -= dt; d.staff -= dt; d.open = clamp(d.open + (d.hold > 0 ? 5 : -3) * dt, 0, 1); }
    if (amb) { amb.t += dt; if (amb.t > 7.5) amb = null; }
    if (nuFlash > 0) nuFlash -= dt;
    if (nextGlow > 0) nextGlow -= dt;
  }

  // ---------- klicken ----------
  const ox = () => ((Math.max(FW, Math.min(WW, A.W || FW)) - FW) >> 1);
  // Fyll-läget beskär överkanten (mobilen i NÄRA: ~55 rader) och passets remsa (18 rader,
  // halvgenomskinlig) ligger precis under kanten. Då flyttas lokalen ner så att dörrskyltarna
  // (LÄKARE, SJUKSKÖTERSKA …) hamnar helt under remsan – men aldrig mer än att man själv vid
  // luckan och bakre stolsraden (fötterna på rad 162) fortfarande syns nertill. Utan beskärning
  // (datorn, RAM, testrobotar) är camY 0.
  const HUD_H = 18, KEEP_BOTTOM = 168;
  const camY = () => {
    const s = A.view?.safe, y0 = s?.y0 | 0;
    if (y0 <= 0) return 0;
    const want = y0 + HUD_H + 1 - SIGN_Y, room = ((s.y1 | 0) || FH) - KEEP_BOTTOM;
    return clamp(Math.min(want, room), 0, 40);
  };
  // passets remsa i lokalens koordinater (första raden under den)
  const hudBottom = () => (A.view?.safe?.y0 | 0) + HUD_H - camY();
  function patientAt(x, y) {
    let best = null, bd = 1e9;
    for (const p of patients) {
      if (p.state !== 'wait' && p.state !== 'desk' && p.state !== 'called') continue;
      const head = p.state === 'desk' || p.state === 'called' ? PAT_Y : p.y;
      const b = bubbleDims(p);
      const inBubble = !!b && x >= b.x0 - 1 && x <= b.x1 + 1 && y >= b.y0 - 1 && y <= b.tip + 1;
      const inBody = Math.abs(x - p.x) <= 8 && y >= head - 38 && y <= head + 2;
      if (!inBubble && !inBody) continue;
      const d = Math.abs(x - p.x) + (inBubble ? 0 : 4);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function handleDown(x, y) {
    if (done) return;
    // 1) en patient (bubblan eller figuren)
    const p = patientAt(x, y);
    if (p) {
      if (p.state === 'wait') { call(p); return; }
      // patienten vid luckan: gå dit
      walker.walkTo(WIN[p.win], WORK_Y, () => { walker.dir = 'up'; });
      return;
    }
    // 2) en dörr (skylten, dörrbladet eller mattan framför)
    const r = ROOMS.find((q) => x >= q.x0 - 4 && x <= q.x1 + 4 && y >= SIGN_Y - 2 && y <= FLOOR_Y + 6);
    if (r) { sendFromDesk(r.i); return; }
    // 3) NÄSTA-knappen eller NU-tavlan
    if ((x >= NEXT.x0 - 2 && x <= NEXT.x1 + 2 && y >= NEXT.y0 - 4 && y <= DESK.face + 2) || (x >= NU.x0 && x <= NU.x1 && y >= NU.y0 && y <= NU.y1 + 11)) { callNext(); return; }
    // 4) luckorna / personalytan: gå dit
    if (x >= DESK.x0 && y >= DESK.top - 30) {
      if (y < DESK.base) { const wi = Math.abs(x - WIN[0]) < Math.abs(x - WIN[1]) ? 0 : 1; walker.walkTo(WIN[wi], WORK_Y, () => { walker.dir = 'up'; }); }
      else walker.walkTo(x, y);
      return;
    }
    if (t < 20) { say(x, Math.max(60, y - 12), 'KLICKA PÅ EN PATIENT!', '#d8d2c0'); }
  }
  const bubbleTip = (p) => (p.state === 'wait' ? (p.sat ? p.y - 38 : p.y - 41) : p.state === 'desk' ? PAT_Y - 41 : null);
  // bubblans mått: väntrummet = bara symbolen, vid luckan även ordet (FEBER, BLODPROV …) på
  // en rad – så att hela bubblan ryms under HUD:en även på mobilen. Den kläms in i bild i sidled.
  function bubbleDims(p) {
    const tip = bubbleTip(p);
    if (tip === null) return null;
    const lines = p.state === 'desk' ? [SYMS[p.sym].word] : [];
    const iw = Math.max(13, ...lines.map((l) => textW(SMALL, l) + 4)), ih = 13 + lines.length * 6 + 3;
    const o = ox(), w = iw + 2;
    const x0 = clamp(Math.round(p.x) - (w >> 1), -o + 1, FW + o - w - 1);
    return { tip, lines, iw, ih, x0, x1: x0 + w, y0: tip - 4 - ih };
  }

  // ---------- ritningen ----------
  function drawPatient(ctx, p) {
    const ph = Math.floor(clk * 8.5 + p.id * 0.37) % 4;
    const moving = p.w.path.length > 0 || p.state === 'in' || p.state === 'out' || p.state === 'enter' || p.state === 'sit';
    let frame = moving ? WALK_SEQ[ph] : 0, dir = moving ? p.dir : p.dir || 'down';
    if (p.state === 'wait' && p.sat) frame = 5;
    else if (p.state === 'wait' && p.akut) frame = Math.sin(clk * 6 + p.id) > 0.2 ? 4 : 0;   // andas tungt
    else if (p.state === 'ticket') frame = 9;
    else if (!moving) frame = Math.sin(clk * 2 + p.id) > 0.9 ? 4 : 0;
    const clip = p.state === 'in' || p.state === 'out' ? [GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, FLOOR_Y + 12 - GLASS.y0]
      : p.state === 'enter' ? [ROOMS[p.room].x0 + 1, DOOR_TOP, ROOMS[p.room].x1 - ROOMS[p.room].x0 - 2, FLOOR_Y + 12 - DOOR_TOP] : null;
    if (clip) { ctx.save(); ctx.beginPath(); ctx.rect(...clip); ctx.clip(); }
    drawPerson(ctx, p.x, p.y, p.look, dir, frame);
    if (clip) ctx.restore();
    // nummerlappen i handen
    if (p.state === 'ticket' && p.num !== null) { ctx.fillStyle = '#fbfaf6'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 17, 3, 4); }
    if (p.angry && (p.state === 'leave' || p.state === 'out') && Math.floor(clk * 4) % 2) { ctx.fillStyle = '#d9433b'; ctx.fillRect(Math.round(p.x) + 5, Math.round(p.y) - 42, 1, 3); ctx.fillRect(Math.round(p.x) + 7, Math.round(p.y) - 43, 1, 3); }
  }
  function drawMe(ctx) {
    const walking = walker.path.length > 0;
    const frame = walking ? WALK_SEQ[Math.floor(clk * 8.5) % 4] : (Math.sin(clk * 2) > 0.9 ? 4 : 0);
    drawPerson(ctx, walker.px, walker.py, myLook, walker.dir, frame);
    const mine = worldMyEmote();
    if (mine) emoteBubble(ctx, walker.px, walker.py - 60, mine);
  }
  function drawBack(ctx) {
    ctx.drawImage(G.back, XL, 0);
    // entrén: bilen utanför och glasdörrarna som glider isär
    ctx.save(); ctx.beginPath(); ctx.rect(GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, FLOOR_Y - GLASS.y0); ctx.clip();
    if (amb) drawAmbulance(ctx);
    const e = entryOpen * entryOpen * (3 - 2 * entryOpen), slide = Math.round(e * 17);
    for (const [lx, dir] of [[GLASS.x0, -1], [ENTRY.cx, 1]]) {
      const x = lx + dir * slide, w = ENTRY.cx - GLASS.x0;
      ctx.fillStyle = '#c4ccd4'; ctx.fillRect(x, GLASS.y0, w, 1); ctx.fillRect(x, FLOOR_Y - 3, w, 3);
      ctx.fillStyle = '#9aa2aa'; ctx.fillRect(x + (dir < 0 ? w - 1 : 0), GLASS.y0, 1, FLOOR_Y - GLASS.y0);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + k * 2 + (dir > 0 ? 6 : 0), GLASS.y0 + 8 + k * 3, 1, 12);
      // gröna markeringsprickar i ögonhöjd
      ctx.fillStyle = '#3aa050';
      for (let i = 2; i < w - 1; i += 3) ctx.fillRect(x + i, 82, 2, 1);
    }
    ctx.restore();
    // NU-tavlan: numret och luckan
    const blink = nuFlash > 0 && Math.floor(nuFlash * 6) % 2 === 0;
    if (nuNo && !blink) {
      if (nuNo === 'AKUT') ctxText(ctx, SMALL, 'AKUT', NU.x0 + 18, NU.y0 + 5, '#ff4a2a');
      else ctxText(ctx, BIG, nuNo, NU.x0 + 17, NU.y0 + 3, '#ff4a2a');
      ctxText(ctx, SMALL, String(nuWin + 1), NU.x0 + 28, NU.y0 + 11, '#ffb02a');
    } else if (!nuNo) ctxText(ctx, BIG, '---', NU.x0 + 17, NU.y0 + 3, '#5a1a10');
    // klockan: passet är fyra timmar
    const m = startMin + (Math.min(t, SHIFT_SECONDS) / SHIFT_SECONDS) * 240;
    hand(ctx, ((m / 60) % 12) / 12, 3, '#2a2c30'); hand(ctx, (m % 60) / 60, 5, '#4a4e56');
    ctx.fillStyle = '#d8342c'; ctx.fillRect(CLOCK.x, CLOCK.y, 1, 1);
    // dörrarna som står öppna: rummet innanför och personalen i dörren
    for (const r of ROOMS) {
      const d = doors[r.i];
      if (d.open <= 0) continue;
      const w = r.x1 - r.x0, h = FLOOR_Y - DOOR_TOP, k = d.open;
      ctx.save(); ctx.beginPath(); ctx.rect(r.x0, DOOR_TOP, w, h); ctx.clip();
      ctx.drawImage(G.rooms[r.i], r.x0, DOOR_TOP);
      if (d.staff > 0) drawPerson(ctx, r.cx, FLOOR_Y - 2, STAFF[r.i], 'down', Math.sin(clk * 3) > 0.6 ? 4 : 0);
      // dörrbladet svänger inåt: en smal remsa kvar vid gångjärnet
      const leafC = css(mix(r.col, WHITE, 0.58)), edgeC = css(mix(r.col, WHITE, 0.4));
      if (!r.double) {
        const lw = Math.max(2, Math.round(w * (1 - k)));
        ctx.fillStyle = leafC; ctx.fillRect(r.x0, DOOR_TOP, lw, h);
        ctx.fillStyle = edgeC; ctx.fillRect(r.x0 + lw - 1, DOOR_TOP, 1, h);
      } else {
        const hw = w >> 1, lw = Math.max(2, Math.round(hw * (1 - k)));
        ctx.fillStyle = leafC; ctx.fillRect(r.x0, DOOR_TOP, lw, h); ctx.fillRect(r.x1 - lw, DOOR_TOP, lw, h);
        ctx.fillStyle = edgeC; ctx.fillRect(r.x0 + lw - 1, DOOR_TOP, 1, h); ctx.fillRect(r.x1 - lw, DOOR_TOP, 1, h);
      }
      ctx.restore();
    }
    // AKUTEN-lamporna blinkar när en akutpatient väntar
    if (patients.some((p) => p.akut && (p.state === 'wait' || p.state === 'called' || p.state === 'desk')) && Math.floor(clk * 3) % 2 === 0) {
      const r = ROOMS[3], bw = Math.max(r.x1 - r.x0 + 2, textW(SMALL, r.name) + 8), bx = r.cx - (bw >> 1);
      for (const lx of [bx - 5, bx + bw + 1]) { ctx.fillStyle = '#ffd0c0'; ctx.fillRect(lx + 1, SIGN_Y + 3, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(lx + 1, SIGN_Y + 3, 1, 1); }
    }
  }
  function hand(ctx, f, len, col) {
    const a = f * Math.PI * 2;
    ctx.fillStyle = col;
    for (let r = 1; r <= len; r++) ctx.fillRect(CLOCK.x + Math.round(Math.sin(a) * r), CLOCK.y - Math.round(Math.cos(a) * r), 1, 1);
  }
  function drawAmbulance(ctx) {
    // ambulansen kör in från höger, står med blåljuset på och kör sedan vidare
    const a = amb, x = a.t < 1.3 ? Math.round(60 - (a.t / 1.3) * 48) : a.t < 6.2 ? 12 : Math.round(12 - (a.t - 6.2) * 40), y = 76;
    ctx.fillStyle = '#f4f4ee'; ctx.fillRect(x, y, 30, 12);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y + 6, 30, 2);
    ctx.fillStyle = '#2a8a4a'; ctx.fillRect(x, y + 8, 30, 1);
    ctx.fillStyle = '#8ac8f0'; ctx.fillRect(x + 1, y + 2, 6, 4);
    ctx.fillStyle = '#d8342c'; ctx.fillRect(x + 17, y + 2, 5, 1); ctx.fillRect(x + 19, y + 1, 1, 3);
    ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x + 4, y + 11, 5, 3); ctx.fillRect(x + 21, y + 11, 5, 3);
    const on = Math.floor(clk * 8) % 2 === 0;
    ctx.fillStyle = on ? '#6aa8ff' : '#1e3a8a'; ctx.fillRect(x + 3, y - 2, 4, 2);
    ctx.fillStyle = on ? '#1e3a8a' : '#6aa8ff'; ctx.fillRect(x + 22, y - 2, 4, 2);
    if (on) { ctx.fillStyle = 'rgba(106,168,255,0.25)'; ctx.fillRect(x - 2, y - 5, 12, 6); }
  }
  function drawDeskLive(ctx) {
    // skärmen: vilka som står vid luckorna (grönt = framme, gult = på väg)
    ctx.save(); ctx.beginPath(); ctx.rect(MON.x0 + 2, MON.y0 + 2, MON.x1 - MON.x0 - 4, MON.y1 - MON.y0 - 5); ctx.clip();
    ctx.fillStyle = '#0e2a3a'; ctx.fillRect(MON.x0 + 2, MON.y0 + 2, MON.x1 - MON.x0 - 4, MON.y1 - MON.y0 - 5);
    for (let i = 0; i < 2; i++) {
      const p = wins[i], y = MON.y0 + 3 + i * 6;
      const s = `${i + 1} ${p ? (p.akut ? 'AKUT' : String(p.num % 1000).padStart(3, '0')) : '---'}`;
      ctxText(ctx, SMALL, s, MON.x0 + 3, y, !p ? '#4a6a7a' : p.state === 'desk' ? '#8ef08a' : '#ffd23f');
    }
    if (Math.floor(clk * 2) % 2) { ctx.fillStyle = '#8ef08a'; ctx.fillRect(MON.x1 - 5, MON.y0 + 9, 2, 1); }
    ctx.restore();
    // NÄSTA-knappen (lyser när man trycker, pulserar när någon väntar)
    const anyone = waiting().length > 0;
    const glow = nextGlow > 0 || (anyone && !wins[0] && !wins[1] && Math.floor(clk * 2) % 2 === 0);
    const bx = NEXT.x0 + 11, by = NEXT.y0 - 1;   // knappen sitter som en kupol ovanpå lådan
    ctx.fillStyle = '#1e5a2a'; ctx.fillRect(bx - 4, by, 9, 4);
    ctx.fillStyle = glow ? '#8ef08a' : '#3aa050'; ctx.fillRect(bx - 3, by - 1, 7, 4);
    ctx.fillStyle = glow ? '#ffffff' : '#6ad07a'; ctx.fillRect(bx - 2, by - 1, 3, 1);
    if (glow) { ctx.fillStyle = '#c8ffc0'; ctx.fillRect(bx - 5, by + 1, 1, 1); ctx.fillRect(bx + 5, by + 1, 1, 1); ctx.fillRect(bx, by - 3, 1, 1); }
  }
  function drawBubbles(ctx) {
    const tg = deskTarget(), active = tg && tg.p.state === 'desk' ? tg.p : null;   // den som nästa dörrklick gäller lyser
    for (const p of patients) {
      const b = bubbleDims(p);
      if (!b) continue;
      const atDesk = p.state === 'desk';
      const hot = atDesk && p === active;
      const akutBlink = p.akut && Math.floor(clk * 4) % 2 === 0;
      const tip = Math.round(b.tip - (hot && (clk * 4 | 0) % 2 ? 1 : 0));
      const { lines, iw, ih } = b;
      const [ix, iy] = bubble(ctx, Math.round(p.x), tip, iw, ih, hot, p.akut ? (akutBlink ? '#ff4a2a' : '#9a1a16') : null, b.x0);
      ctx.drawImage(iconOf(p.sym), ix + ((iw - 13) >> 1), iy);
      lines.forEach((l, k) => ctxText(ctx, SMALL, l, ix + ((iw - textW(SMALL, l)) >> 1), iy + 14 + k * 6, p.akut ? '#c8201c' : '#2a2430'));
      const left = atDesk ? clamp(p.deskPat / p.deskMax, 0, 1) : clamp(p.pat / p.pmax, 0, 1), bw = iw - 2;
      ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 1, iy + ih - 2, bw, 2);
      ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
      ctx.fillRect(ix + 1, iy + ih - 2, Math.max(1, Math.round(bw * left)), 2);
      if ((left < 0.25 || (p.akut && akutBlink)) && Math.sin(clk * 6) > 0) {
        const ex = ix + iw + 1;
        ctx.fillStyle = '#17151a'; ctx.fillRect(ex, iy - 4, 5, 10);
        ctx.fillStyle = '#d9433b'; ctx.fillRect(ex + 1, iy - 3, 3, 5); ctx.fillRect(ex + 1, iy + 3, 3, 2);
      }
    }
  }
  // hjälpraden – de första sekunderna och när man verkar fast. Den ligger längst ner över
  // väntrummet (i skärmkoordinater, ovanför fyll-lägets nederkant) så att den aldrig skymmer
  // dörrarnas bilder eller luckorna.
  function drawHint(ctx, vw, o) {
    let s = null;
    const atDesk = wins.some((p) => p && p.state === 'desk');
    if (t < 6 && !calls) s = 'KLICKA PÅ EN PATIENT - ELLER NÄSTA';
    else if (atDesk && sends < 2 && hintT > 2.5) s = 'SKICKA TILL RÄTT DÖRR - TITTA PÅ BILDERNA!';
    else if (!calls && t > 8) s = 'KLICKA PÅ EN PATIENT I VÄNTRUMMET!';
    if (!s) return;
    const sy = Math.min(FH, (A.view?.safe?.y1 | 0) || FH) - 13;
    const w = textW(SMALL, s) + 8, x = clamp(150 + o - (w >> 1), 2, vw - w - 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x, sy, w, 10);
    ctx.fillStyle = '#3a3440'; ctx.fillRect(x, sy + 9, w, 1);
    ctxText(ctx, SMALL, s, x + 4, sy + 3, '#ffd23f');
  }

  // ---------- början: tre patienter sitter redan och väntar ----------
  for (let k = 0; k < 3; k++) { const p = newPatient(randomSym(), { seated: true }); if (p) p.pat = p.pmax * (0.65 + 0.3 * R()); }

  const api = {
    viewMax: { w: WW, h: FH },
    _debug: {
      stats,
      syms: SYMS.map((s) => s.id),
      rooms: ROOMS.map((r) => r.id),
      // en patient som redan väntar (sitter, eller står i AKUT-rutan): sym = id eller index
      forcePatient(sym = 'feber', { akut = false } = {}) { const i = symIndex(sym); const p = newPatient(i < 0 ? 0 : i, { seated: true, akut: akut || SYMS[i]?.akut }); return p ? p.id : null; },
      patients: () => patients.map((p) => ({ id: p.id, sym: SYMS[p.sym].id, akut: p.akut, num: p.num, state: p.state, x: Math.round(p.x), y: Math.round(p.y), win: p.win, room: p.room, dest: p.dest, passed: p.passed, pat: +p.pat.toFixed(1) })),
      // vem nästa dörrklick gäller: { id, win } (den som står framme går före den som är på väg)
      target: () => { const tg = deskTarget(); return tg ? { id: tg.p.id, win: tg.wi, state: tg.p.state } : null; },
      camY: () => camY(),
      // dörrarnas pratbubblor: text, spetsens y och bubblans överkant i lokalens koordinater (null = ingen)
      talk: () => talkDoor.map((s, i) => { const txt = s.text(); if (!txt) return null; const tip = doorTip(txt); return { room: ROOMS[i].id, text: txt, tip, top: tip - sayLines(txt, 124, 5).length * 7 - 4 - 5 }; }),
      hudBottom: () => hudBottom(),
      // ropa in (utan id = NÄSTA-knappen)
      call(id) { if (id === undefined) return callNext(); return call(patients.find((p) => p.id === id)); },
      // alla som är på väg till en lucka ställer sig där direkt
      arrive() { for (const p of patients) if (p.state === 'called') { p.w.stop(); p.x = WIN[p.win]; p.y = PAT_Y; p.state = 'desk'; p.dir = 'down'; if (p.dest !== null) { const d = p.dest; p.dest = null; send(p, d); } } return patients.filter((p) => p.state === 'desk').map((p) => p.id); },
      // skicka patienten vid luckan (id, annars den vid min lucka / första vid disken) till ett rum
      send(room, id) {
        const ri = roomIndex(room); if (ri < 0) return null;
        const p = id !== undefined ? patients.find((q) => q.id === id && q.state === 'desk') : (wins[myWin()]?.state === 'desk' ? wins[myWin()] : patients.find((q) => q.state === 'desk'));
        if (!p) return null; send(p, ri); return stats;
      },
      sendRight(right = true) { const p = patients.find((q) => q.state === 'desk'); if (!p) return null; const ri = SYMS[p.sym].room; send(p, right ? ri : (ri + 1) % ROOMS.length); return stats; },
      giveUp(id) { const p = patients.find((q) => (id === undefined || q.id === id) && (q.state === 'wait' || q.state === 'desk')); if (!p) return null; if (p.state === 'wait') p.pat = 0; else p.deskPat = 0; api.update(0.001); return stats; },
      // en patient kommer in genom entrén på riktigt (akut = med ambulansen utanför); returnerar id
      komIn(akut = false) { const p = spawn(!!akut); return p ? p.id : null; },
      skip(s) { t = Math.min(SHIFT_SECONDS - 0.05, t + s); return t; },
      auto(on = true) { autoSpawn = !!on; return autoSpawn; },
      clear() { for (const p of patients) { freeSeat(p); freeWin(p); } patients = []; return 0; },
      player: () => ({ x: Math.round(walker.px), y: Math.round(walker.py), win: myWin(), path: walker.path.length }),
      teleport(x, y) { walker.px = x; walker.py = y; walker.stop(); walker.dir = 'up'; },
      doors: () => doors.map((d) => ({ open: +d.open.toFixed(2), staff: d.staff > 0 })),
      nu: () => ({ no: nuNo, win: nuWin }),
      // klickpunkter i canvasens koordinater (för scene.down): 'dorr:lakare' | 'dorr:2' |
      // 'patient:<id>' | 'bubbla:<id>' | 'nasta' | 'nu' | 'lucka:0'
      spot(id) {
        const o = ox(), cy = camY(), [k, v] = String(id).split(':');
        const at = (x, y) => ({ x: Math.round(x + o), y: Math.round(y + cy) });
        if (k === 'dorr') { const ri = roomIndex(isNaN(+v) ? v : +v); const r = ROOMS[ri]; return r ? at(r.cx, DOOR_TOP + 24) : null; }
        if (k === 'patient' || k === 'bubbla') {
          const p = patients.find((q) => q.id === +v); if (!p) return null;
          if (k === 'bubbla' && bubbleTip(p) !== null) return at(p.x, bubbleTip(p) - 9);
          return at(p.x, (p.state === 'desk' || p.state === 'called' ? PAT_Y : p.y) - 20);
        }
        if (k === 'nasta') return at(NEXT.x0 + 11, NEXT.y0 + 4);
        if (k === 'nu') return at((NU.x0 + NU.x1) / 2, (NU.y0 + NU.y1) / 2);
        if (k === 'lucka') return at(WIN[+v || 0], DESK.face + 6);
        return null;
      },
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    exit() { for (const s of talkDoor) s.clear(); },
    update(dt) {
      clk += dt;
      pops.update(dt);
      updateWorld(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      walker.update(dt);
      updatePatients(dt);
      hintT = wins.some((p) => p && p.state === 'desk') ? hintT + dt : 0;
      if (!autoSpawn) return;
      // nya patienter: tätare mot slutet av passet
      spawnIn -= dt;
      if (spawnIn <= 0) {
        const prog = Math.min(1, t / SHIFT_SECONDS);
        spawn(false);
        spawnIn = (4.4 - 1.6 * prog + R() * 1.4) * pace;
      }
      // akutfall: minst ett per pass, sedan ibland
      akutIn -= dt;
      if (akutIn <= 0) {
        if (!patients.some((p) => p.akut && p.state !== 'enter')) spawn(true);
        akutIn = (akutSpawned ? 16 : 6) + R() * 12;
      }
    },
    down(sx, sy) { handleDown(sx - ox(), sy - camY()); },
    key(k) {
      if (k === 'Escape' && !done) abortShift(A);
      else if (!done && (k === 'Enter' || k === ' ' || k === 'n' || k === 'N')) callNext();
      else if (!done && k >= '1' && k <= '4') sendFromDesk(+k - 1);
    },
    draw(ctx) {
      const o = ox(), vw = FW + o * 2, cy = camY();
      ctx.setTransform(A.pxs, 0, 0, A.pxs, o * A.pxs, cy * A.pxs);
      drawBack(ctx);
      const ds = [];
      for (const p of patients) ds.push({ fy: p.y + (p.state === 'wait' && p.sat ? 0.2 : 0), draw: () => drawPatient(ctx, p) });
      for (const [gx, gy] of GROUPS) ds.push({ fy: gy - 0.5, draw: () => ctx.drawImage(G.group, gx - GROUP_OX, gy - GROUP_OY) });
      ds.push({ fy: AUTO.y, draw: () => ctx.drawImage(G.automat, AUTO.x - 9, AUTO.y - 34) });
      ds.push({ fy: COOLER.y, draw: () => ctx.drawImage(G.cooler, COOLER.x - 8, COOLER.y - 32) });
      ds.push({ fy: PLANT.y, draw: () => ctx.drawImage(G.plant, PLANT.x - 14, PLANT.y - 44) });
      ds.push({ fy: TOYBOX.y, draw: () => ctx.drawImage(G.toybox, TOYBOX.x - 9, TOYBOX.y - 16) });
      ds.push({ fy: TABLE.y, draw: () => ctx.drawImage(G.table, TABLE.x - 14, TABLE.y - 18) });
      ds.push({ fy: 129.5, draw: () => { ctx.drawImage(G.desk, XL, 0); drawDeskLive(ctx); } });
      ds.push({ fy: CHAIR.y, draw: () => ctx.drawImage(G.chair, CHAIR.x - 9, CHAIR.y - 26) });
      ds.push({ fy: 214, draw: () => ctx.drawImage(G.shelf, DESK.x0 + 4, 198) });
      for (const f of folkDrawables(A, clk)) ds.push(f);
      ds.push({ fy: walker.py, draw: () => drawMe(ctx) });
      ds.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawBubbles(ctx);
      for (const s of talkDoor) s.draw(ctx, { x0: -o, x1: FW + o });
      pops.draw(ctx);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      // I fyll-läget ligger remsan över väggen (RECEPTION-skylten, ev. överkanten av en bubbla):
      // en ogenomskinlig botten under den så att ingen text skymtar igenom den halvgenomskinliga
      // remsan. På datorn (ingen beskärning) ligger remsan bara över taket och ser ut som i de
      // andra jobben.
      // (från raden ovanför: beskärningen avrundas, så en bråkdel av den raden syns)
      const sy = A.view?.safe?.y0 | 0;
      if (sy > 0) { ctx.fillStyle = '#17151a'; ctx.fillRect(0, sy - 1, vw, HUD_H + 1); }
      drawShiftHud(ctx, { W: vw }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'VÅRDCENTRALEN' });
      if (!done) drawHint(ctx, vw, o);
      if (done) drawTimeUp(ctx, { W: vw, H: FH });
    },
  };
  return api;
}
