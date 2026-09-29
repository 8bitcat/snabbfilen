// PIXELHÖGSKOLAN – universitetet i downtown (scen 'universitet' i js/main.js). Gåbar och
// bredare än skärmen (752 px, kameran följer figuren). Från vänster till höger:
//
//   ENTRÉHALLEN      sandstensvägg, anslagstavla med lappar (SPEX, KÅRFEST, KORRIDORRUM …),
//                    ett högt välvt fönster mot campus, ekdörrarna ut och STUDENTEXPEDITIONEN
//                    där studievägledaren tar emot anmälningar. På golvet schackrutig sten,
//                    högskolans vapen i mosaik och bysten av grundaren Professor Pixel.
//   AULA 1           svarta tavlan (kritan skriver fram föreläsningen medan den pågår),
//                    katedern med dator, en klocka och tre bänkrader där studenterna sitter
//                    med ryggen mot oss. Sätt dig i en ledig bänk → föreläsningen (2 timmar).
//   BIBLIOTEKET      bokhyllor från golv till tak med rullstege, läsbord med gröna lampor,
//                    bibliotekarien bakom disken, en jordglob – och TENTABORDET där man skriver
//                    tentan när alla föreläsningar är gjorda. Godkänd = examen (diplom!).
//
// Spellogiken ligger i game.js (COURSES, g.enroll, g.canLecture/attendLecture,
// g.canExam/takeExam); examen öppnar de utbildade jobben (JOBS[id].kraver). Scenen läser
// allt defensivt – saknas metoderna säger personalen att kurserna inte har börjat än.
//
// Pratbubblor: bara den som syns i bild pratar (createSpeech per talare).
// _debug: spot(id) → { x, y } i SKÄRMkoordinater, id ∈ 'dorr', 'expedition', 'anslag',
//   'byst', 'tavla', 'lektor', 'katedern', 'hylla', 'bibliotekarie', 'tenta', 'glob',
//   'lasbord' och varje plats-id (aula-A0 … aula-C9, las-0 … las-3, tenta-0).
//   seats(), state(), enroll(id), sit(id), lecture(id) (sätt dig i en ledig bänk och börja
//   direkt), fastLecture() (spola fram föreläsningen), exam(id, svar[]) (svarar med
//   index i rätt ordning, -1 = fel svar), quiz(id) (frågorna), lockCam(x|null),
//   teleport(x, y), tick(sek), cam(), panorama() (hela salen som data-URL).
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook, isValid } from '../core/people.js';
import { openModal, closeModal, esc, toast } from '../core/ui.js';
import * as GM from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech, sayLines } from './walkable.js';
import { worldFolksHere } from '../net/world.js';

// ======================= mått (världskoordinater) =======================
let VW = 384;
const W = 752, H = 216;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const WALL_Y = 92;                                   // där golvet börjar
const Z_AULA = 260, Z_BIB = 508;                     // salarnas vänsterkant (pelare före)
const BOARD = { x0: 292, x1: 460, y0: 18, y1: 68 };  // svarta tavlan (insidan)
const DOOR = { x0: 108, x1: 152, top: 24 };
const DOOR_SPOT = [130, 104];
const NOTE = { x0: 12, x1: 66, y0: 28, y1: 68 };     // anslagstavlan
const WIN_E = { x0: 74, x1: 100, y0: 18, y1: 76 };   // entréns välvda fönster
const EXP = { x0: 170, x1: 246, top: 100, face: 106, y: 118 }; // expeditionens disk
const EXP_SPOT = [208, 128];
const GUIDE = [208, 102];                            // studievägledarens fötter (bakom disken)
const BUST = { x: 34, y: 158 };                      // bysten på sockeln
const LECT = { x0: 466, x1: 490, top: 98, y: 114 };  // katedern
const WIN_A = { x0: 470, x1: 494, y0: 26, y1: 66 };  // aulans fönster (ovanför katedern)
const CLOCK = { x: 276, y: 30 };
const ROWS = [136, 162, 188];                        // bänkradernas säten (fötterna)
const SEAT_X = [290, 306, 322, 338, 354, 398, 414, 430, 446, 462];
const SHELF = { x0: 516, x1: 700, y0: 10, y1: 88 };
const LADDER_X = 604;
const LIB = { x0: 672, x1: 744, top: 102, face: 108, y: 120 };   // bibliotekariens disk
const LIBR = [708, 104];
const RTAB = { x0: 526, x1: 598, top: 142, y: 152 };  // läsbordet
const TTAB = { x0: 612, x1: 656, top: 172, y: 182 };  // tentabordet
const GLOBE = { x: 730, y: 196 };
const OPEN_LECT = [8, 17];                            // föreläsningar börjar 08–17
const BENCH = { x0: 50, x1: 106, y: 206 };           // träbänken i entrén
const EASEL = { x: 214, y: 182 };                   // VÄLKOMMEN NYA STUDENTER!

// ======================= små hjälpare =======================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgb = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const jit = (c, x, y, s, a) => mul(c, 1 + (hash(x, y, s) - 0.5) * 2 * a);
const g0 = () => globalThis.SF?.game;
const safeTxt = (s) => String(s).toUpperCase().replace(/[^A-ZÅÄÖÉ0-9 .,:!?+\-/%=']/g, '');
function lookOr(field, v, fb) { try { return isValid(field, v) ? v : fb; } catch { return fb; } }

// ======================= kursernas innehåll (föreläsningar + tenta) =======================
// Tavlan: vad kritan skriver fram under föreläsningen (i ordning), och lektorns repliker.
const LECTURES = {
  datorteknik: {
    lines: ['GOD MORGON! I DAG: DATORNS DELAR.', 'PROCESSORN ÄR HJÄRNAN – DEN RÄKNAR ALLT.', 'MINNET, RAM, SITTER BREDVID OCH HÅLLER DET SOM KÖRS JUST NU.', 'GRAFIKKORTET I PCIE-PLATSEN RITAR BILDEN. GLÖM INTE STRÖMMEN!', 'BRA JOBBAT – VI SES NÄSTA GÅNG!'],
    board: 'dator',
  },
  ekonomi: {
    lines: ['VÄLKOMNA! I DAG: BÖRSEN.', 'EN AKTIE ÄR EN LITEN BIT AV ETT FÖRETAG.', 'KURSEN GÅR UPP OCH NER HELA DAGEN – KÖP LÅGT, SÄLJ HÖGT!', 'KUNDEN SÄTTER GRÄNSEN. HÅLL DIG TILL DEN.', 'TACK FÖR I DAG – PLUGGA INFÖR TENTAN!'],
    board: 'borsen',
  },
};
// Tentafrågor: [fråga, rätt svar, fel, fel] – tre slumpas per tenta, svaren blandas.
const QUIZ = {
  datorteknik: [
    ['Vilken del är datorns hjärna?', 'Processorn (CPU)', 'Nätaggregatet', 'Fläkten'],
    ['Var sätter man arbetsminnet (RAM)?', 'I minnesplatserna bredvid processorn', 'I nätaggregatet', 'Bakom skärmen'],
    ['Vad behöver grafikkortet?', 'En PCIe-plats och ström', 'En diskettstation', 'Ett extra tangentbord'],
    ['Vad gör nätaggregatet?', 'Ger alla delar ström', 'Kyler processorn', 'Sparar filerna'],
    ['Vad sätter man ovanpå processorn?', 'Kylpasta och en kylare', 'Ett RAM-minne', 'Grafikkortet'],
    ['Var ligger filerna kvar när datorn är av?', 'På SSD-disken', 'I RAM-minnet', 'I fläkten'],
  ],
  ekonomi: [
    ['Aktien kostar 40 kr. Kunden vill köpa under 45 kr. Vad gör du?', 'Köper nu', 'Väntar tills den stiger', 'Säljer'],
    ['Vad betyder en röd pil nedåt på börstavlan?', 'Kursen har gått ner', 'Kursen har gått upp', 'Börsen har stängt'],
    ['Kunden vill sälja över 60 kr. Kursen är 55 kr. Vad gör du?', 'Väntar tills den stiger över 60', 'Säljer nu', 'Köper fler'],
    ['Vad är ränta?', 'Det man får för att låna ut pengar', 'En avgift för att gå in på banken', 'En sorts aktie'],
    ['Vad är en budget?', 'En plan för inkomster och utgifter', 'Ett kontokort', 'En aktie i banken'],
    ['Du köper 10 aktier för 20 kr styck. Vad kostar det?', '200 kr', '30 kr', '2 kr'],
  ],
};

// ======================= bakgrunden (målas en gång per ljusläge) =======================
const FLOW = [0xd84a4a, 0xf0c040, 0xf4f1ea, 0x8a5ad0, 0xf08ab0];
function paintBg(night) {
  const P = new Pix(W, H);
  // --- taklist ---
  for (let x = 0; x < W; x++) {
    P.px(x, 0, 0x2a1e16); P.px(x, 1, 0x4a3424); P.px(x, 2, jit(0x6a4a30, x, 2, 1, 0.05)); P.px(x, 3, 0x7a5a3c); P.px(x, 4, 0x3a2a1c); P.px(x, 5, 0x000000);
    if (x % 8 === 0) { P.px(x, 2, 0x8a6a48); P.px(x, 3, 0x8a6a48); }
  }
  // --- entréns sandstensvägg ---
  for (let y = 6; y < WALL_Y; y++) for (let x = 0; x < Z_AULA - 8; x++) {
    const row = (y - 6) >> 3, bx = (x + (row & 1) * 8) % 16, by = (y - 6) % 8;
    let c = jit(0xe4d4b0, (x + (row & 1) * 8) >> 4, row, 11, 0.05);
    c = jit(c, x, y, 12, 0.025);
    if (by === 7 || bx === 15) c = 0xb8a47e; else if (by === 0 || bx === 0) c = mix(c, 0xfff4dc, 0.35);
    if (by === 6 && bx !== 15) c = mul(c, 0.93);
    P.px(x, y, c);
  }
  // bröstpanel i ek under sandstenen (entrén)
  wainscot(P, 0, Z_AULA - 8, 70);
  // --- aulans puts + ribbpanel ---
  for (let y = 6; y < WALL_Y; y++) for (let x = Z_AULA; x < Z_BIB - 8; x++) P.px(x, y, jit(jit(0xece2cc, x >> 2, y >> 3, 21, 0.02), x, y, 22, 0.02));
  for (let x = Z_AULA; x < Z_BIB - 8; x++) {
    for (let y = 74; y < WALL_Y; y++) { const k = (x - Z_AULA) % 4; P.px(x, y, k === 0 ? 0x5a3a22 : k === 3 ? 0x7a5234 : jit(0x946a44, x, y, 23, 0.05)); }
    P.px(x, 73, 0xc8a878); P.px(x, 72, 0x6a4a30);
  }
  // --- bibliotekets mörka boasering ---
  for (let y = 6; y < WALL_Y; y++) for (let x = Z_BIB; x < W; x++) P.px(x, y, jit(0x4a3020, x, y >> 1, 31, 0.06));
  // --- pelarna mellan salarna ---
  for (const px of [Z_AULA - 8, Z_BIB - 8]) pillar(P, px, 8);
  // --- golvlist ---
  for (let x = 0; x < W; x++) { P.px(x, WALL_Y - 4, 0x3a2618); P.px(x, WALL_Y - 3, 0x6a4a30); P.px(x, WALL_Y - 2, 0x5a3c26); P.px(x, WALL_Y - 1, 0x2a1c12); }
  // --- golven ---
  for (let y = WALL_Y; y < H; y++) {
    // entrén: schackrutig sten i perspektiv (rutorna blir högre närmare oss)
    const ty = Math.floor(Math.pow((y - WALL_Y) / (H - WALL_Y), 0.8) * 9);
    for (let x = 0; x < Z_AULA - 4; x++) {
      const tx = Math.floor((x + 4) / 20), dark = (tx + ty) & 1;
      let c = dark ? jit(0x6a7482, x, y, 41, 0.05) : jit(0xe8e0cc, x, y, 42, 0.03);
      if (hash(x, y, 43) > 0.985) c = mix(c, dark ? 0x8a94a4 : 0xc8bca4, 0.6);
      P.px(x, y, c);
    }
    // aulan: parkett i fiskbensmönster
    for (let x = Z_AULA - 4; x < Z_BIB - 4; x++) {
      const u = x - (Z_AULA - 4), v = y - WALL_Y, blk = Math.floor(u / 8) + Math.floor(v / 8);
      const lu = u % 8, lv = v % 8, seam = blk & 1 ? (lu + lv) % 8 === 0 : (lu - lv + 8) % 8 === 0;
      let c = jit(0xb07a48, Math.floor(u / 8), Math.floor(v / 8) + (blk & 1) * 17, 51, 0.09);
      c = jit(c, x, y, 52, 0.03);
      P.px(x, y, seam ? mul(c, 0.72) : c);
    }
    // biblioteket: grön matta med guldmönster och bård
    for (let x = Z_BIB - 4; x < W; x++) {
      const u = x - (Z_BIB - 4), v = y - WALL_Y;
      let c = jit(0x2e5a44, x, y, 61, 0.05);
      if (u < 4 || v > H - WALL_Y - 5) c = u === 3 || v === H - WALL_Y - 5 ? 0xc8a050 : 0x6a2a2a;
      else if (((u + 6) % 12 === 0 && (v + 3) % 8 < 1) || ((u % 12 === 0) && (v + 7) % 8 < 1)) c = 0xb89040;
      P.px(x, y, c);
    }
  }
  // tröskelskenor i mässing
  for (const tx of [Z_AULA - 5, Z_BIB - 5]) for (let y = WALL_Y; y < H; y++) { P.px(tx, y, 0xd8b060); P.px(tx + 1, y, 0x8a6a30); }
  // mosaiken med högskolans vapen mitt i entrén
  mosaic(P, 130, 162);
  // golvets skugga längs väggen
  for (let x = 0; x < W; x++) { P.px(x, WALL_Y, 0x000000, 0.35); P.px(x, WALL_Y + 1, 0x000000, 0.15); }

  // --- väggens saker ---
  noticeBoard(P);
  archWindow(P, WIN_E, night, 0);
  doorway(P, night);
  crestBanner(P);
  hatch(P, night);
  chalkboardFrame(P);
  archWindow(P, WIN_A, night, 1);
  aulaSign(P);
  portraits(P);
  shelves(P);
  libSign(P);
  libWindow(P, night);
  // kvällsljus: taklampornas pölar på golven
  if (night) for (const lx of [60, 200, 320, 420, 560, 680]) P.ell(lx, 150, 60, 34, 0xffe8b0, 0.1, 4);
  return P.flush();
}
function wainscot(P, x0, x1, top) {
  for (let y = top; y < WALL_Y - 4; y++) for (let x = x0; x < x1; x++) {
    const px = (x - x0) % 28, edge = px === 0 || px === 27 || y === top || y === WALL_Y - 5;
    let c = jit(0x7a5234, x, y >> 1, 71, 0.05);
    if (y === top) c = 0xc8a070; else if (y === top + 1) c = 0x4a3020;
    else if (edge) c = 0x5a3a22;
    else if (px === 3 || y === top + 4) c = 0x9a7048; else if (px === 24 || y === WALL_Y - 8) c = 0x5a3a24;
    P.px(x, y, c);
  }
}
function pillar(P, x, w) {
  for (let y = 6; y < WALL_Y - 4; y++) for (let i = 0; i < w; i++) {
    let c = i === 0 ? 0xfff6e4 : i === w - 1 ? 0xa8987c : i === w - 2 ? 0xc8b89c : jit(0xece0c4, x + i, y, 81, 0.02);
    if (i === 3 && y > 16 && y < WALL_Y - 12) c = mul(c, 0.94);   // räffla
    P.px(x + i, y, c);
  }
  for (let i = -2; i < w + 2; i++) { P.px(x + i, 6, 0xd8c8a8); P.px(x + i, 7, 0xfff4dc); P.px(x + i, 8, 0xc8b490); P.px(x + i, 9, 0x8a7a60); }
  for (let i = -2; i < w + 2; i++) { P.px(x + i, WALL_Y - 8, 0xfff4dc); P.px(x + i, WALL_Y - 7, 0xd8c8a8); P.px(x + i, WALL_Y - 6, 0xb8a484); P.px(x + i, WALL_Y - 5, 0x6a5a44); }
}
function mosaic(P, cx, cy) {
  const rx = 26, ry = 13;
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (d > 1) continue;
    let c = d > 0.86 ? 0xc89a40 : d > 0.78 ? 0x1f3a6a : jit(0x2a4a80, x, y, 91, 0.06);
    if (d > 0.86 && hash(x, y, 92) > 0.6) c = 0xe8c060;
    P.px(x, y, c);
  }
  // en uppslagen bok och en stjärna i guld
  for (let i = 0; i < 9; i++) { P.px(cx - 9 + i, cy + 1 - (i < 5 ? i >> 1 : (8 - i) >> 1), 0xf4f1ea); P.px(cx + i, cy + 1 - (i < 5 ? (4 - i) >> 1 : 0), 0xf4f1ea); }
  P.rect(cx - 9, cy + 2, 18, 2, 0xf4f1ea); P.vl(cx, cy - 1, 4, 0x9a8a70);
  for (const [dx, dy] of [[0, -8], [0, -7], [-1, -6], [0, -6], [1, -6], [-3, -5], [-2, -5], [-1, -5], [0, -5], [1, -5], [2, -5], [3, -5], [-1, -4], [0, -4], [1, -4], [-2, -3], [2, -3]]) P.px(cx + dx, cy + dy, 0xf0c850);
}
function noticeBoard(P) {
  const { x0, x1, y0, y1 } = NOTE;
  P.rect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4, 0x5a3a22); P.box(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4, 0x3a2414);
  P.hl(x0 - 1, y0 - 1, x1 - x0 + 2, 0x8a6240);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) P.px(x, y, jit(hash(x, y, 101) > 0.7 ? 0xb88a58 : 0xc89a64, x, y, 102, 0.06));
  // lapparna (text i pixeltypsnittet, häftstift i färg)
  const notes = [
    [x0 + 2, y0 + 2, 24, 16, 0xf4f1ea, ['SPEX', 'FRE 19'], 0xc83a3a],
    [x0 + 28, y0 + 3, 23, 12, 0xf8e070, ['KÅR-', 'FEST'], 0x3a7bd5],
    [x0 + 3, y0 + 21, 21, 17, 0xa8d8f0, ['RUM', 'SÖKES'], 0x46a35a],
    [x0 + 27, y0 + 18, 24, 20, 0xf4f1ea, ['PLUGG-', 'KOMPIS?'], 0xf0b429],
  ];
  for (const [nx, ny, nw, nh, bg, lines, pin] of notes) {
    P.rect(nx + 1, ny + 1, nw, nh, 0x000000, 0.25);
    P.rect(nx, ny, nw, nh, bg); P.hl(nx, ny + nh - 1, nw, mul(bg, 0.85));
    lines.forEach((l, i) => text(P, SMALL, l, nx + Math.max(1, (nw - textW(SMALL, l)) >> 1), ny + 3 + i * 6, 0x2a2430));
    P.px(nx + (nw >> 1), ny + 1, pin); P.px(nx + (nw >> 1), ny, mul(pin, 1.3));
  }
  // avrivningslappar under rumsannonsen
  for (let i = 0; i < 5; i++) if (i !== 2) { P.rect(x0 + 4 + i * 4, y0 + 38, 3, 4, 0xa8d8f0); P.px(x0 + 5 + i * 4, y0 + 39, 0x4a5a6a); }
  text(P, SMALL, 'ANSLAG', x0 + ((x1 - x0 - textW(SMALL, 'ANSLAG')) >> 1), y0 - 8, 0x3a2414);
}
function archWindow(P, R, night, seed) {
  const { x0, x1, y0, y1 } = R, w = x1 - x0, cx = (x0 + x1) / 2, r = w / 2;
  const inside = (x, y) => y >= y0 + r ? x >= x0 && x < x1 && y < y1 : Math.hypot(x + 0.5 - cx, y + 0.5 - (y0 + r)) < r;
  for (let y = y0 - 3; y < y1 + 3; y++) for (let x = x0 - 3; x < x1 + 3; x++) {
    const inn = inside(x, y), near = !inn && (inside(x - 3, y) || inside(x + 3, y) || inside(x, y + 3) || inside(x, y - 3) || inside(x - 2, y - 2) || inside(x + 2, y - 2));
    if (near) P.px(x, y, y > y1 ? 0xd8c8a8 : x < cx ? 0xfff4dc : 0xb8a484);
    if (!inn) continue;
    // utsikt: himmel, campusträd och en röd tegelbyggnad; kvällshimmel med stjärnor
    const t = (y - y0) / (y1 - y0);
    let c = night ? mix(0x1a2448, 0x3a3a6a, t) : mix(0x8ac4ec, 0xd8ecf8, t);
    if (night && hash(x, y, 111 + seed) > 0.985) c = 0xf4f1ea;
    const roofY = y0 + (y1 - y0) * 0.55 + Math.sin(x * 0.4 + seed) * 1.5;
    if (y > roofY) c = night ? 0x3a2430 : jit(0xa84a3a, x >> 1, y >> 1, 112, 0.08);
    if (y > roofY && (x % 6 === 2 || x % 6 === 3) && (y - Math.floor(roofY)) % 7 > 2 && (y - Math.floor(roofY)) % 7 < 6) c = night ? (hash(x >> 2, y >> 3, 113) > 0.4 ? 0xf8d878 : 0x2a2a3a) : 0x5a7a9a;
    const tree = Math.hypot((x - (x0 + 6 + seed * 10)) / 7, (y - (y1 - 14)) / 9) < 1 || Math.hypot((x - (x1 - 5)) / 6, (y - (y1 - 10)) / 8) < 1;
    if (tree) c = night ? 0x1a2a22 : jit(hash(x, y, 114) > 0.6 ? 0x5a9a3e : 0x3f7a34, x, y, 115, 0.1);
    P.px(x, y, c);
  }
  // spröjs och fönsterbänk
  for (let y = y0 + 2; y < y1; y++) if (inside(cx, y)) { P.px(Math.floor(cx), y, 0xf4f1ea); P.px(Math.floor(cx) + 1, y, 0xc8c0b0); }
  for (const yy of [y0 + r, y0 + r + ((y1 - y0 - r) >> 1)]) for (let x = x0; x < x1; x++) { P.px(x, Math.floor(yy), 0xf4f1ea); P.px(x, Math.floor(yy) + 1, 0xc8c0b0); }
  P.rect(x0 - 4, y1 + 2, w + 8, 3, 0xd8c8a8); P.hl(x0 - 4, y1 + 2, w + 8, 0xfff4dc); P.hl(x0 - 4, y1 + 5, w + 8, 0x000000, 0.25);
  if (!night) for (let i = 0; i < 6; i++) P.px(x0 + 3 + i * 4, y0 + r + 3 + (i & 1) * 9, 0xffffff, 0.8);   // glasreflexer
}
function doorway(P, night) {
  const { x0, x1, top } = DOOR, w = x1 - x0, cx = (x0 + x1) / 2, r = w / 2;
  // sandstensomfattning med slutsten
  for (let y = top - 6; y < WALL_Y - 4; y++) for (let x = x0 - 6; x < x1 + 6; x++) {
    const inArch = y >= top + r ? x >= x0 && x < x1 : Math.hypot(x + 0.5 - cx, y + 0.5 - (top + r)) < r;
    const inFrame = y >= top + r ? x >= x0 - 6 && x < x1 + 6 : Math.hypot(x + 0.5 - cx, y + 0.5 - (top + r)) < r + 6;
    if (inArch || !inFrame) continue;
    const ang = Math.atan2(y + 0.5 - (top + r), x + 0.5 - cx), seg = y < top + r ? Math.floor((ang + Math.PI) / (Math.PI / 7)) : Math.floor(y / 8);
    let c = jit(0xd8c49c, seg, 3, 121, 0.08);
    if (x === x0 - 6 || (y < top + r && Math.hypot(x + 0.5 - cx, y + 0.5 - (top + r)) > r + 5)) c = 0xfff0d0;
    if (x === x1 + 5) c = 0x9a8664;
    P.px(x, y, c);
  }
  P.rect(cx - 4, top - 7, 8, 8, 0xe8d8b0); P.box(cx - 4, top - 7, 8, 8, 0xa8946c); P.px(cx - 1, top - 4, 0xc89a40); P.px(cx, top - 4, 0xc89a40);
  // dubbeldörrarna i ek med fönster i överdelen
  for (let y = top; y < WALL_Y - 4; y++) for (let x = x0; x < x1; x++) {
    const inArch = y >= top + r ? true : Math.hypot(x + 0.5 - cx, y + 0.5 - (top + r)) < r;
    if (!inArch) continue;
    const leaf = x < cx ? 0 : 1, lx = leaf ? x - cx : x - x0, lw = r;
    let c = jit(0x7a4a28, x, y >> 2, 131, 0.06);
    if (y < top + r + 6) {                         // glaset överst (bågen)
      c = night ? 0x2a3050 : mix(0xa8d0ec, 0xe0f0fa, (y - top) / (r + 6));
      if (((x - x0) % 8 === 0) || y === top + r + 5) c = 0x5a3a20;
    } else if (lx === 1 || lx === lw - 2) c = 0x5a3418;
    else if ((y - top - r - 6) % 20 < 2 || lx === 4 || lx === lw - 5) c = mul(c, 1.14);
    if (lx === 0 || x === x1 - 1) c = 0x3a2210;
    P.px(x, y, c);
  }
  P.vl(Math.floor(cx) - 1, top + r, WALL_Y - 4 - top - r, 0x2a1808); P.vl(Math.floor(cx), top + r, WALL_Y - 4 - top - r, 0x2a1808);
  for (const hx of [Math.floor(cx) - 4, Math.floor(cx) + 3]) { P.rect(hx, 58, 2, 6, 0xd8b050); P.px(hx, 58, 0xfff0a0); }
  // UT-skylten över dörren
  P.rect(cx - 7, top + 12, 14, 8, 0x1f6a3a); P.box(cx - 7, top + 12, 14, 8, 0x0f3a1e); text(P, SMALL, 'UT', cx - 3, top + 14, 0xe8f8e8);
  P.vl(cx - 5, top + 6, 6, 0x3a3a44); P.vl(cx + 4, top + 6, 6, 0x3a3a44);   // skylten hänger i två kedjor
  // dörrmatta
  for (let y = WALL_Y + 1; y < WALL_Y + 9; y++) for (let x = x0 + 2; x < x1 - 2; x++) P.px(x, y, (x + y) % 3 === 0 ? 0x5a3a2a : 0x7a4a34);
}
function crestBanner(P) {
  // PIXELHÖGSKOLAN i guldbokstäver + ANNO 1893
  const s = 'PIXELHÖGSKOLAN', w = textW(BIG, s);
  const x = 130 - (w >> 1), y = 8;
  for (let i = -3; i < w + 3; i++) { P.px(x + i, y - 1, 0x2a1e16, 0.35); P.px(x + i, y + 8, 0x2a1e16, 0.35); }
  text(P, BIG, s, x + 1, y + 1, 0x6a4a1a);
  text(P, BIG, s, x, y, 0xe8b848);
  for (let i = 0; i < w; i += 3) P.px(x + i, y, 0xfff0a0);
}
function hatch(P, night) {
  // STUDENTEXPEDITIONEN: glasat fönster i väggen, skylt ovanför, broschyrställ
  const x0 = EXP.x0 + 4, x1 = EXP.x1 - 4, y0 = 36, y1 = 74;
  P.rect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, 0x5a3a22); P.box(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, 0x3a2414); P.hl(x0 - 2, y0 - 2, x1 - x0 + 4, 0x9a7048);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = night ? mix(0xf0dca8, 0xd8c090, (y - y0) / (y1 - y0)) : mix(0xe8eef0, 0xc8d4dc, (y - y0) / (y1 - y0));
    // kontoret bakom glaset: hyllor med pärmar, en krukväxt och en skärm
    if (y > y0 + 6 && y < y0 + 9) c = 0x8a6a48;
    if (y >= y0 + 1 && y <= y0 + 6 && x % 5 < 3 && x < x0 + 40) c = FLOW[(x >> 2) % 5] === 0xf4f1ea ? 0x3a7bd5 : mul(FLOW[(x >> 2) % 5], 0.85);
    if (y > y0 + 16 && y < y0 + 19) c = 0x8a6a48;
    if (y >= y0 + 11 && y <= y0 + 16 && x % 4 < 3 && x > x0 + 44) c = [0xd84a4a, 0x46a35a, 0xf0b429, 0x3a7bd5][(x >> 2) & 3];
    P.px(x, y, c);
  }
  // reflexer i glaset
  for (let i = 0; i < 10; i++) { P.px(x0 + 6 + i, y0 + 30 - i, 0xffffff, 0.35); P.px(x0 + 9 + i, y0 + 30 - i, 0xffffff, 0.2); }
  P.vl((x0 + x1) >> 1, y0, y1 - y0, 0x5a3a22);
  // talgaller
  P.ell((x0 + x1) >> 1, y0 + 26, 3, 2, 0x8a7a60, 0.6, 2);
  // skylten
  const s = 'STUDENTEXPEDITIONEN', sw = textW(SMALL, s) + 8, sx = ((EXP.x0 + EXP.x1) >> 1) - (sw >> 1), sy = 24;
  P.rect(sx, sy, sw, 9, 0x1f3a6a); P.box(sx, sy, sw, 9, 0xc89a40); P.hl(sx + 1, sy + 1, sw - 2, 0x2f4a80);
  text(P, SMALL, s, sx + 4, sy + 2, 0xf4ecd8);
  // öppettidsskylt
  P.rect(159, 44, 11, 14, 0xf4f1ea); P.box(159, 44, 11, 14, 0x8a8478); text(P, SMALL, '8-', 161, 46, 0x2a2430); text(P, SMALL, '17', 161, 52, 0x2a2430);
}
function chalkboardFrame(P) {
  const { x0, x1, y0, y1 } = BOARD;
  P.rect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, 0x6a4424); P.box(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, 0x3a2412);
  P.hl(x0 - 3, y0 - 3, x1 - x0 + 6, 0xa07048); P.vl(x0 - 3, y0 - 3, y1 - y0 + 6, 0x8a5c36);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = jit(0x2a4a3a, x >> 1, y >> 1, 141, 0.05);
    if (hash(x, y, 142) > 0.97) c = mix(c, 0xd8e0d8, 0.18);      // gammal krita som suddats
    P.px(x, y, c);
  }
  // mittskarven mellan tavlorna
  P.vl((x0 + x1) >> 1, y0, y1 - y0, 0x1a2a22);
  // kritlist med krita och sudd
  P.rect(x0 - 2, y1 + 4, x1 - x0 + 4, 3, 0x8a5c36); P.hl(x0 - 2, y1 + 4, x1 - x0 + 4, 0xb88458); P.hl(x0 - 2, y1 + 7, x1 - x0 + 4, 0x000000, 0.3);
  P.rect(x0 + 20, y1 + 3, 4, 1, 0xf4f1ea); P.rect(x0 + 28, y1 + 3, 3, 1, 0xf0c8c8); P.rect(x0 + 34, y1 + 3, 3, 1, 0xf8e878);
  P.rect(x1 - 30, y1 + 2, 9, 2, 0x3a3a44); P.hl(x1 - 30, y1 + 2, 9, 0xd8c8a0);
  // uppdragen projektorduk ovanför
  P.rect(x0 + 30, 8, x1 - x0 - 60, 3, 0xe8e8e8); P.hl(x0 + 30, 10, x1 - x0 - 60, 0x9a9aa4); P.px(x0 + 29, 9, 0x5a5a64); P.px(x1 - 30, 9, 0x5a5a64);
}
function aulaSign(P) {
  const s = 'AULA 1', sw = textW(SMALL, s) + 8, x = Z_AULA - 4 - (sw >> 1) + 2, y = 12;
  P.rect(x, y, sw, 9, 0x1f3a6a); P.box(x, y, sw, 9, 0xc89a40); text(P, SMALL, s, x + 4, y + 2, 0xf4ecd8);
}
function portraits(P) {
  // en porträttrad med professorer i guldramar i aulan (mellan tavlan och fönstret)
  for (let k = 0; k < 1; k++) {
    const x = 272 + k * 0, y = 44, w = 14, h = 18;
    P.rect(x - 2, y - 2, w + 4, h + 4, 0xc89a40); P.box(x - 2, y - 2, w + 4, h + 4, 0x6a4a1a); P.hl(x - 1, y - 1, w + 2, 0xf0d070);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) P.px(x + xx, y + yy, mix(0x3a2a20, 0x5a4030, yy / h));
    P.ell(x + 7, y + 7, 4, 5, 0xe8b890, 1, 1); P.rect(x + 3, y + 3, 8, 3, 0xd8d8d0); P.rect(x + 4, y + 12, 7, 6, 0x1a1a24); P.px(x + 7, y + 12, 0xf4f1ea);
    P.px(x + 5, y + 7, 0x2a1a10); P.px(x + 9, y + 7, 0x2a1a10); P.hl(x + 5, y + 10, 5, 0xb8b8b0);
  }
  text(P, SMALL, 'PROF.', 270, 66, 0x6a4a1a);
}
const BOOK = [0x8a2a2a, 0x2a4a7a, 0x2f6a3a, 0x6a4a2a, 0xc8a050, 0x4a2a5a, 0x1a3a4a, 0xa84a2a, 0x3a3a3a, 0x7a6a2a];
function shelves(P) {
  const { x0, x1, y0, y1 } = SHELF;
  const bays = 4, bw = (x1 - x0) / bays;
  for (let b = 0; b < bays; b++) {
    const bx = Math.round(x0 + b * bw), bx1 = Math.round(x0 + (b + 1) * bw);
    P.rect(bx, y0, bx1 - bx, y1 - y0, 0x2a1a10);
    // hyllplan var 15:e pixel, böcker i olika höjd och färg
    for (let s = 0; s < 5; s++) {
      const sy = y0 + 3 + s * 15, base = sy + 13;
      let x = bx + 3;
      while (x < bx1 - 3) {
        const n = hash(x, s, 151 + b), bwid = n > 0.85 ? 3 : 2, bh = 8 + ((hash(x, s, 152 + b) * 5) | 0);
        if (n < 0.06) { // en lutande bok
          for (let j = 0; j < bh - 1; j++) P.px(x + (j >> 2), base - j, BOOK[(x + s) % BOOK.length]);
          x += 4; continue;
        }
        const c = BOOK[((x * 7 + s * 3 + b) >> 1) % BOOK.length];
        for (let j = 0; j < bh; j++) for (let i = 0; i < bwid; i++) P.px(x + i, base - j, i === 0 ? mul(c, 1.25) : j === bh - 1 ? mul(c, 1.15) : c);
        if (bh > 9) P.hl(x, base - bh + 3, bwid, 0xd8b060);          // guldtryck på ryggen
        x += bwid + (hash(x, s, 153) > 0.9 ? 2 : 0);
      }
      P.rect(bx, base + 1, bx1 - bx, 2, 0x7a5234); P.hl(bx, base + 1, bx1 - bx, 0xa87a4c); P.hl(bx, base + 3, bx1 - bx, 0x000000, 0.35);
    }
    P.rect(bx, y0, 2, y1 - y0, 0x6a4428); P.vl(bx, y0, y1 - y0, 0x9a6a40);
    P.rect(bx1 - 2, y0, 2, y1 - y0, 0x5a3a22);
    // mässingsskylt per sektion
    const lab = ['A-F', 'G-M', 'N-S', 'T-Ö'][b];
    P.rect(bx + ((bx1 - bx) >> 1) - 7, y0 - 1, 14, 6, 0xc89a40); text(P, SMALL, lab, bx + ((bx1 - bx) >> 1) - (textW(SMALL, lab) >> 1), y0, 0x3a2410);
  }
  P.rect(x0 - 2, y0 - 4, x1 - x0 + 4, 3, 0x6a4428); P.hl(x0 - 2, y0 - 4, x1 - x0 + 4, 0xa07048);
  // rullstegen på sin skena
  P.hl(x0, y0 + 1, x1 - x0, 0xc8a050);
  for (let y = y0 + 2; y < y1; y++) { const k = (y - y0) * 0.12; P.px(LADDER_X + k, y, 0x8a5c36); P.px(LADDER_X + 9 + k, y, 0x8a5c36); if ((y - y0) % 7 === 0) P.hl(LADDER_X + k, y, 10, 0xb88458); }
  P.rect(LADDER_X - 1, y0, 3, 3, 0xc8a050); P.rect(LADDER_X + 8, y0, 3, 3, 0xc8a050);
}
function libSign(P) {
  // BIBLIOTEKET på pelaren mellan aulan och biblioteket (som AULA 1 på den vänstra)
  const s = 'BIBLIOTEKET', sw = textW(SMALL, s) + 8, x = Z_BIB - 4 - (sw >> 1), y = 12;
  P.rect(x, y, sw, 9, 0x2f5a44); P.box(x, y, sw, 9, 0xc89a40); P.hl(x + 1, y + 1, sw - 2, 0x3f7a5a); text(P, SMALL, s, x + 4, y + 2, 0xf4ecd8);
}
function libWindow(P, night) {
  // högt fönster längst till höger och TYST, TACK! under det
  archWindow(P, { x0: 712, x1: 740, y0: 16, y1: 58 }, night, 2);
  const tx = 714, ty = 68;
  P.rect(tx, ty, 24, 13, 0xf4f1ea); P.box(tx, ty, 24, 13, 0xa83a3a); text(P, SMALL, 'TYST', tx + 5, ty + 2, 0xa83a3a); text(P, SMALL, 'TACK', tx + 5, ty + 7, 0xa83a3a);
  P.hl(tx + 1, ty + 13, 24, 0x000000, 0.3);
}

// ======================= möbler (egna bilder, y-sorteras med figurerna) =======================
function paintCounter(x0, x1, top, face, y, wood, trim) {
  const w = x1 - x0, h = y - top + 2, P = new Pix(w + 2, h + 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const yy = top + j;
    let c;
    if (yy < face) c = yy === top ? mix(trim, 0xffffff, 0.3) : jit(mix(wood, 0xffffff, 0.12), i, j, 161, 0.04);
    else if (yy === face) c = trim;
    else c = (i % 16 === 0 || i % 16 === 15) ? mul(wood, 0.7) : (yy === face + 2 || yy === y - 2) ? mul(wood, 1.12) : jit(wood, i, j >> 1, 162, 0.05);
    if (i === 0 || i === w - 1) c = mul(wood, 0.6);
    P.px(i, j, c);
  }
  P.hl(1, h, w, 0x000000, 0.3); P.hl(1, h + 1, w, 0x000000, 0.15);
  return { img: P.flush(), x: x0, y: top };
}
function paintExpDesk() {
  const D = paintCounter(EXP.x0, EXP.x1, EXP.top, EXP.face, EXP.y, 0x7a4a28, 0xc89a40);
  const P = new Pix(EXP.x1 - EXP.x0 + 2, EXP.y - EXP.top + 4);
  P.ctx.drawImage(D.img, 0, 0); const img = P.ctx.getImageData(0, 0, P.w, P.h); P.d.set(img.data);
  // broschyrställ, ringklocka, anmälningsblanketter
  for (let i = 0; i < 3; i++) { P.rect(6 + i * 5, 0, 4, 5, [0xd84a4a, 0x3a7bd5, 0x46a35a][i]); P.hl(6 + i * 5, 0, 4, 0xf4f1ea); }
  P.rect(5, 4, 16, 2, 0x5a5a64);
  P.rect(56, 2, 5, 2, 0xd8b050); P.px(58, 1, 0xfff0a0); P.hl(55, 4, 7, 0x6a5a30);
  P.rect(30, 1, 12, 4, 0xf4f1ea); P.hl(31, 2, 8, 0x9a9aa4); P.hl(31, 3, 6, 0x9a9aa4); P.px(40, 1, 0x2a4a8a);
  text(P, SMALL, 'ANMÄLAN', 20, 10, 0xe8c060);
  return { img: P.flush(), x: EXP.x0, y: EXP.top };
}
function paintLibDesk() {
  const D = paintCounter(LIB.x0, LIB.x1, LIB.top, LIB.face, LIB.y, 0x5a3420, 0xb89040);
  const P = new Pix(LIB.x1 - LIB.x0 + 2, LIB.y - LIB.top + 12);
  P.ctx.drawImage(D.img, 0, 8); const img = P.ctx.getImageData(0, 0, P.w, P.h); P.d.set(img.data);
  // bokstapel, stämpel, grön lampa, återlämningslåda
  for (let i = 0; i < 4; i++) P.rect(6 + (i & 1), 8 - i * 2, 12, 2, BOOK[i + 2]);
  P.rect(26, 5, 3, 3, 0x6a4a2a); P.rect(25, 8, 5, 1, 0x2a2a30);
  P.rect(46, 1, 12, 3, 0x2f7a4a); P.hl(46, 1, 12, 0x5aba7a); P.vl(51, 4, 5, 0xc8a050); P.rect(49, 9, 6, 1, 0xc8a050);
  text(P, SMALL, 'LÅN', 28, 18, 0xe8c060);
  return { img: P.flush(), x: LIB.x0, y: LIB.top - 8 };
}
function paintLectern() {
  const w = LECT.x1 - LECT.x0, P = new Pix(w + 2, 24);
  for (let j = 0; j < 18; j++) for (let i = 0; i < w; i++) {
    let c = j < 4 ? (j === 0 ? 0xb88458 : 0x8a5c36) : jit(0x6a4424, i, j, 171, 0.05);
    if (j >= 4 && (i === 0 || i === w - 1)) c = 0x3a2412;
    if (j === 8 && i > 2 && i < w - 3) c = 0xc89a40;
    P.px(i, j + 4, c);
  }
  // bärbar dator på katedern
  P.rect(5, 0, 12, 5, 0x2a2a34); P.rect(6, 1, 10, 3, 0x6ab0e8); P.hl(4, 5, 14, 0x9a9aa4);
  P.hl(1, 22, w, 0x000000, 0.3);
  // högskolans vapen på fronten
  P.rect((w >> 1) - 3, 13, 6, 7, 0x1f3a6a); P.px(w >> 1, 15, 0xf0c850); P.px((w >> 1) - 1, 16, 0xf0c850); P.px(w >> 1, 16, 0xf0c850); P.px((w >> 1) + 1, 16, 0xf0c850);
  return { img: P.flush(), x: LECT.x0, y: LECT.top - 4 };
}
// en bänkrad: bordsskiva framför sätena (studenterna sitter med ryggen mot oss) + fällsätena
function paintBenchRow(r) {
  const y = ROWS[r], P = new Pix(200, 22), ox = 280, oy = y - 20;
  for (const [a, b] of [[282, 364], [388, 472]]) {
    for (let x = a; x < b; x++) {
      // bordsskivan
      P.px(x - ox, y - 17 - oy, 0xc89a64); P.px(x - ox, y - 16 - oy, jit(0xa87a48, x, 0, 181, 0.05)); P.px(x - ox, y - 15 - oy, jit(0xa87a48, x, 1, 181, 0.05));
      P.px(x - ox, y - 14 - oy, 0x5a3a22); P.px(x - ox, y - 13 - oy, 0x3a2412);
      // ryggstöden (baksidan mot oss)
      P.px(x - ox, y - 8 - oy, 0x5a3a22); P.px(x - ox, y - 7 - oy, jit(0x7a4a2a, x, 2, 182, 0.05)); P.px(x - ox, y - 6 - oy, 0x4a2a18);
    }
    P.vl(a - ox, y - 17 - oy, 12, 0x3a2412); P.vl(b - 1 - ox, y - 17 - oy, 12, 0x3a2412);
    // benen/sidogavlarna i ändarna och radnumret
    P.rect(a - ox, y - 12 - oy, 2, 11, 0x4a2a18); P.rect(b - 2 - ox, y - 12 - oy, 2, 11, 0x4a2a18);
  }
  text(P, SMALL, 'ABC'[r], 366 - ox + 6, y - 11 - oy, 0xc89a40);
  return { img: P.flush(), x: ox, y: oy, fy: y - 9 };
}
function paintReadTable() {
  const w = RTAB.x1 - RTAB.x0, P = new Pix(w + 2, 20);
  for (let i = 0; i < w; i++) {
    P.px(i, 3, 0xb88458); for (let j = 4; j < 8; j++) P.px(i, j, jit(0x8a5c36, i, j, 191, 0.04));
    P.px(i, 8, 0x5a3a22); P.px(i, 9, 0x3a2412);
  }
  P.rect(2, 10, 3, 8, 0x4a2a18); P.rect(w - 5, 10, 3, 8, 0x4a2a18); P.hl(1, 18, w, 0x000000, 0.25);
  // gröna bankirlampor, uppslagna böcker
  for (const lx of [14, w - 18]) { P.rect(lx, 0, 8, 2, 0x2f7a4a); P.hl(lx, 0, 8, 0x6aca8a); P.vl(lx + 4, 2, 3, 0xc8a050); P.rect(lx + 2, 4, 5, 1, 0xc8a050); }
  P.rect(30, 4, 10, 3, 0xf4f1ea); P.vl(35, 4, 3, 0xb8b0a0); P.rect(46, 5, 8, 2, 0x8a2a2a);
  return { img: P.flush(), x: RTAB.x0, y: RTAB.top - 3 };
}
function paintExamTable() {
  const w = TTAB.x1 - TTAB.x0, P = new Pix(w + 2, 24);
  for (let i = 0; i < w; i++) {
    P.px(i, 7, 0xd8d0c0); for (let j = 8; j < 11; j++) P.px(i, j, 0xb8b0a0); P.px(i, 11, 0x6a6460); P.px(i, 12, 0x3a3634);
  }
  P.rect(2, 13, 2, 8, 0x5a5a64); P.rect(w - 4, 13, 2, 8, 0x5a5a64);
  // tentapappret, pennan och timglaset
  P.rect(14, 8, 9, 3, 0xf8f8f4); P.hl(15, 9, 6, 0x9aa0b0); P.px(24, 8, 0xf0c040); P.px(25, 9, 0xf0c040);
  P.rect(34, 6, 3, 1, 0xc8a050); P.px(35, 7, 0xe8d8a0); P.px(35, 8, 0xe8d8a0); P.rect(34, 9, 3, 1, 0xc8a050);
  // skylten TENTA på en fot
  P.rect(0, 0, 21, 7, 0xf4f1ea); P.box(0, 0, 21, 7, 0xa83a3a); text(P, SMALL, 'TENTA', 1, 1, 0xa83a3a);
  P.hl(1, 22, w, 0x000000, 0.25);
  return { img: P.flush(), x: TTAB.x0, y: TTAB.top - 7 };
}
function paintBust() {
  const P = new Pix(22, 44);
  // sockel i marmor
  for (let j = 18; j < 42; j++) for (let i = 3; i < 19; i++) {
    let c = jit(0xe8e4dc, i, j, 201, 0.03);
    if (hash(i, j, 202) > 0.93) c = 0xb8b4ac;
    if (i === 3) c = 0xfaf8f4; if (i === 18) c = 0xa8a49c; if (j === 18 || j === 22) c = 0xfaf8f4; if (j === 41) c = 0x8a8680;
    P.px(i, j, c);
  }
  P.rect(5, 28, 12, 5, 0xc89a40); text(P, SMALL, 'PROF', 5, 28, 0x3a2410);
  // bysten i brons
  const br = (i, j) => jit(0x9a6a3a, i, j, 203, 0.08);
  P.ell(11, 10, 5, 6, 0x9a6a3a, 1, 1);
  for (let j = 4; j < 16; j++) for (let i = 6; i < 17; i++) if (Math.hypot((i - 11) / 5.2, (j - 9) / 6.2) < 1) P.px(i, j, i < 10 ? mul(br(i, j), 1.2) : br(i, j));
  for (let j = 14; j < 19; j++) for (let i = 4 + (18 - j); i < 18 - (18 - j); i++) P.px(i, j, br(i, j + 3));
  P.px(9, 9, 0x5a3a1a); P.px(13, 9, 0x5a3a1a); P.hl(9, 13, 5, 0x6a4424);
  P.px(11, 11, 0xe8c070);                                   // den blankputsade näsan (tur på tentan)
  P.hl(7, 5, 8, 0xc8a070);
  P.hl(3, 42, 16, 0x000000, 0.3);
  return { img: P.flush(), x: BUST.x - 11, y: BUST.y - 42 };
}
function paintGlobe(ang) {
  const P = new Pix(20, 30);
  P.rect(9, 20, 2, 7, 0x5a3a22); P.rect(5, 26, 10, 2, 0x6a4428); P.hl(5, 26, 10, 0x9a6a40);
  for (let j = 0; j < 17; j++) for (let i = 0; i < 17; i++) {
    const dx = i - 8, dy = j - 8; if (Math.hypot(dx, dy) > 8) continue;
    const lon = Math.asin(clamp(dx / Math.sqrt(Math.max(1, 64 - dy * dy)), -1, 1)) + ang, lat = dy / 8;
    const land = Math.sin(lon * 3) * Math.cos(lat * 3) + Math.sin(lon * 5 + 1) * 0.5 > 0.35;
    let c = land ? (lat < -0.7 ? 0xf4f1ea : 0x6a9a4a) : 0x3a6ab8;
    if (dx < -3) c = mul(c, 1.15); if (dx > 4) c = mul(c, 0.8);
    P.px(i + 1, j + 3, c);
  }
  for (let a = 0; a < 20; a++) { const t = (a / 19) * Math.PI; P.px(10 + Math.cos(t) * 10, 11 - Math.sin(t) * 10, 0xc8a050); }
  P.hl(4, 28, 12, 0x000000, 0.25);
  return P.flush();
}
function paintChair(dir) {
  const P = new Pix(12, 18);
  const c = 0x6a3a22;
  if (dir === 'down') { // stolen på bortre sidan (ryggen ovanför figuren)
    P.rect(2, 0, 8, 9, c); P.box(2, 0, 8, 9, 0x3a2012); P.hl(3, 1, 6, 0x9a5a34);
  } else {              // stolen på vår sida: sits + ben syns under figuren
    P.rect(2, 8, 8, 3, c); P.hl(2, 8, 8, 0x9a5a34); P.rect(2, 11, 1, 6, 0x3a2012); P.rect(9, 11, 1, 6, 0x3a2012);
  }
  return P.flush();
}

// ======================= tavlans innehåll (ritas med krita under föreläsningen) =======================
// Varje steg = en liten ritfunktion; k = hur mycket av steget som hunnit skrivas (0–1).
function chalk(ctx, x, y, w = 1, h = 1, col = '#e8ece4') { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function chalkText(ctx, s, x, y, k = 1, col = '#e8ece4') {
  const n = Math.floor(String(s).length * k);
  if (n > 0) ctxText(ctx, SMALL, String(s).slice(0, n), x, y, col);
}
function chalkLine(ctx, x0, y0, x1, y1, k = 1, col) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), m = Math.floor(n * k);
  for (let i = 0; i <= m; i++) chalk(ctx, x0 + ((x1 - x0) * i) / (n || 1), y0 + ((y1 - y0) * i) / (n || 1), 1, 1, col);
}
function chalkBox(ctx, x, y, w, h, k = 1, col) {
  const per = 2 * (w + h), m = per * k;
  chalkLine(ctx, x, y, x + w, y, clamp(m / w, 0, 1), col);
  if (m > w) chalkLine(ctx, x + w, y, x + w, y + h, clamp((m - w) / h, 0, 1), col);
  if (m > w + h) chalkLine(ctx, x + w, y + h, x, y + h, clamp((m - w - h) / w, 0, 1), col);
  if (m > 2 * w + h) chalkLine(ctx, x, y + h, x, y, clamp((m - 2 * w - h) / h, 0, 1), col);
}
const BOARDS = {
  // DATORNS DELAR: moderkort med CPU, RAM, GPU och nätaggregat + pilar
  dator: [
    (c, k) => chalkText(c, 'DATORNS DELAR', BOARD.x0 + 6, BOARD.y0 + 4, k),
    (c, k) => { chalkBox(c, BOARD.x0 + 8, BOARD.y0 + 12, 72, 28, k); },
    (c, k) => { chalkBox(c, BOARD.x0 + 14, BOARD.y0 + 17, 16, 13, k, '#f8e878'); if (k > 0.6) chalkText(c, 'CPU', BOARD.x0 + 17, BOARD.y0 + 21, 1, '#f8e878'); },
    (c, k) => { for (let i = 0; i < 4; i++) if (k > i / 4) chalkLine(c, BOARD.x0 + 36 + i * 4, BOARD.y0 + 15, BOARD.x0 + 36 + i * 4, BOARD.y0 + 29, 1, '#a8d8f0'); if (k > 0.8) chalkText(c, 'RAM', BOARD.x0 + 36, BOARD.y0 + 32, 1, '#a8d8f0'); },
    (c, k) => { chalkBox(c, BOARD.x0 + 58, BOARD.y0 + 16, 16, 18, k, '#f0a8a8'); if (k > 0.6) chalkText(c, 'GPU', BOARD.x0 + 60, BOARD.y0 + 23, 1, '#f0a8a8'); },
    (c, k) => { chalkLine(c, BOARD.x0 + 84, BOARD.y0 + 25, BOARD.x0 + 98, BOARD.y0 + 25, k); if (k > 0.5) { chalk(c, BOARD.x0 + 96, BOARD.y0 + 24); chalk(c, BOARD.x0 + 96, BOARD.y0 + 26); } if (k > 0.7) chalkText(c, 'STRÖM', BOARD.x0 + 102, BOARD.y0 + 23, 1); },
    (c, k) => chalkText(c, 'PSU = NÄTAGGREGAT', BOARD.x0 + 90, BOARD.y0 + 34, k),
    (c, k) => chalkText(c, 'CPU + KYLPASTA + KYLARE!', BOARD.x0 + 6, BOARD.y0 + 43, k, '#f8e878'),
  ],
  // BÖRSEN: kursgraf som går upp och ner, KÖP LÅGT / SÄLJ HÖGT
  borsen: [
    (c, k) => chalkText(c, 'BÖRSEN', BOARD.x0 + 6, BOARD.y0 + 4, k),
    (c, k) => { chalkLine(c, BOARD.x0 + 10, BOARD.y0 + 44, BOARD.x0 + 10, BOARD.y0 + 12, k); chalkLine(c, BOARD.x0 + 10, BOARD.y0 + 44, BOARD.x0 + 96, BOARD.y0 + 44, k); },
    (c, k) => {
      const pts = [[12, 36], [22, 30], [30, 38], [40, 40], [50, 28], [60, 22], [70, 26], [80, 16], [92, 18]];
      const m = (pts.length - 1) * k;
      for (let i = 0; i < Math.floor(m); i++) chalkLine(c, BOARD.x0 + pts[i][0], BOARD.y0 + pts[i][1], BOARD.x0 + pts[i + 1][0], BOARD.y0 + pts[i + 1][1], 1, '#f8e878');
    },
    (c, k) => { if (k > 0) { chalk(c, BOARD.x0 + 39, BOARD.y0 + 42, 3, 1, '#a8f0a8'); chalkText(c, 'KÖP LÅGT', BOARD.x0 + 26, BOARD.y0 + 47 - 1, k, '#a8f0a8'); } },
    (c, k) => { if (k > 0) chalkText(c, 'SÄLJ HÖGT', BOARD.x0 + 72, BOARD.y0 + 8, k, '#f0a8a8'); },
    (c, k) => chalkText(c, 'AKTIE = DEL AV FÖRETAG', BOARD.x0 + 102, BOARD.y0 + 18, k),
    (c, k) => chalkText(c, '10 X 20 KR = 200 KR', BOARD.x0 + 102, BOARD.y0 + 28, k),
    (c, k) => chalkText(c, 'RÄNTA 2%', BOARD.x0 + 102, BOARD.y0 + 38, k),
  ],
  // mellan föreläsningarna: schemat och en gammal formel
  idle: [
    (c) => chalkText(c, 'VÄLKOMMEN TILL AULA 1', BOARD.x0 + 6, BOARD.y0 + 5),
    (c) => chalkText(c, 'FÖRELÄSNINGAR 8-17', BOARD.x0 + 6, BOARD.y0 + 15, 1, '#f8e878'),
    (c) => chalkText(c, 'DATORTEKNIK', BOARD.x0 + 10, BOARD.y0 + 25, 1, '#a8d8f0'),
    (c) => chalkText(c, 'EKONOMI', BOARD.x0 + 10, BOARD.y0 + 33, 1, '#f0a8a8'),
    (c) => chalkText(c, 'ANMÄLAN I EXPEDITIONEN!', BOARD.x0 + 6, BOARD.y0 + 43),
    (c) => { chalkText(c, '1+1=2', BOARD.x0 + 128, BOARD.y0 + 30, 1, '#c8d0c8'); chalk(c, BOARD.x0 + 152, BOARD.y0 + 31); chalk(c, BOARD.x0 + 155, BOARD.y0 + 31); chalkLine(c, BOARD.x0 + 151, BOARD.y0 + 34, BOARD.x0 + 156, BOARD.y0 + 34, 1, '#c8d0c8'); },
  ],
};

// ======================= scenen =======================
export function makeShopUniversitet(A /* , opts */) {
  const g = A.game;
  const hour = () => (g?.min || 0) / 60;
  const isNight = () => hour() >= 18 || hour() < 7;
  let t = 0, bgKey = null, bg = null, lockedCam = null, peekCam = null;
  const cam = { x: 0 };

  // ---------- platser ----------
  const seats = [];
  ROWS.forEach((y, r) => SEAT_X.forEach((x, i) => seats.push({ id: 'aula-' + 'ABC'[r] + i, x, y, dir: 'up', kind: 'aula', occ: null, ax: x, ay: y })));
  // läsbordet: två på bortre sidan (vända mot oss), två på vår sida (ryggen mot oss)
  [[RTAB.x0 + 16, RTAB.top + 5, 'down'], [RTAB.x1 - 16, RTAB.top + 5, 'down'], [RTAB.x0 + 18, RTAB.y + 12, 'up'], [RTAB.x1 - 18, RTAB.y + 12, 'up']]
    .forEach(([x, y, dir], i) => seats.push({ id: 'las-' + i, x, y, dir, kind: 'las', occ: null, ax: x, ay: dir === 'down' ? RTAB.top - 8 : y + 2 }));
  seats.push({ id: 'tenta-0', x: TTAB.x0 + 18, y: TTAB.y + 12, dir: 'up', kind: 'tenta', occ: null, ax: TTAB.x0 + 18, ay: TTAB.y + 14 });
  const seatById = (id) => seats.find((s) => s.id === id);

  // ---------- gångbart ----------
  const obstacles = [
    [EXP.x0 - 2, EXP.top - 4, EXP.x1 + 2, EXP.y],
    [LIB.x0 - 2, LIB.top - 4, LIB.x1 + 2, LIB.y],
    [LECT.x0 - 1, LECT.top, LECT.x1 + 1, LECT.y],
    [BUST.x - 9, BUST.y - 8, BUST.x + 9, BUST.y],
    [RTAB.x0, RTAB.top - 2, RTAB.x1, RTAB.y],
    [TTAB.x0, TTAB.top, TTAB.x1, TTAB.y],
    [GLOBE.x - 7, GLOBE.y - 5, GLOBE.x + 8, GLOBE.y],
    [4, 196, 18, 212],                                             // krukväxten i hörnet
    [BENCH.x0, BENCH.y - 6, BENCH.x1, BENCH.y],                    // bänken
    [EASEL.x - 12, EASEL.y - 4, EASEL.x + 12, EASEL.y],            // välkomstskylten
    ...ROWS.map((y) => [282, y - 18, 364, y - 12]), ...ROWS.map((y) => [388, y - 18, 472, y - 12]),
  ];
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: 100, bottom: 212, spawn: DOOR_SPOT });
  walker.setObstacles(obstacles);

  // ---------- folket ----------
  const rng = ((s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; })(((g?.day || 1) * 7919) | 0);
  const student = () => { const L = makeLook(rng); L.kid = false; L.build = [4, 5, 5, 6][(rng() * 4) | 0]; if (rng() < 0.45) { L.bag = 'backpack'; } return L; };
  const guideLook = { ...makeLook(rng), kid: false, skin: '#eec3a0', hair: '#b9b3ab', style: lookOr('style', 'bun', 'bun'), top: lookOr('top', 'cardigan', 'sweater'), shirt: '#7a2e3e', accent: '#f4f1ea', bottom: 'skirt', pants: '#2d3a5c', glasses: 'round', beard: false, hat: null, bag: null, build: 5 };
  const lectLook = { ...makeLook(rng), kid: false, skin: '#e0a97f', hair: '#e6e2da', style: lookOr('style', 'side', 'short'), top: lookOr('top', 'blazer', 'jacket'), shirt: '#5a4632', accent: '#f4f1ea', bottom: 'pants', pants: '#3c3c3c', glasses: 'square', beard: 'full', hat: null, bag: null, build: 5 };
  const libLook = { ...makeLook(rng), kid: false, skin: '#a06a43', hair: '#1d1714', style: lookOr('style', 'braids', 'long'), top: lookOr('top', 'sweater', 'sweater'), shirt: '#26605a', bottom: 'pants', pants: '#5a4632', glasses: 'square', beard: false, hat: null, bag: null, build: 5 };
  const guide = { look: guideLook, x: GUIDE[0], y: GUIDE[1], talk: createSpeech(), name: 'Birgitta' };
  const lecturer = { look: lectLook, x: 380, y: 100, tx: 380, dir: 'down', talk: createSpeech(), writeT: 0, name: 'Docent Lind' };
  const librarian = { look: libLook, x: LIBR[0], y: LIBR[1], talk: createSpeech(), stampT: 0, name: 'Amira' };
  const talkMe = createSpeech(), talkStud = createSpeech();
  const meAt = () => (me.seat ? { x: me.seat.x, y: me.seat.y - 40 } : { x: walker.px, y: walker.py - 44 });
  // sittande studenter: i aulan dagtid (fler under föreläsningstid), några i biblioteket
  const sitters = [];
  function seatStudents() {
    for (const s of seats) if (s.occ && s.occ !== 'me') s.occ = null;
    sitters.length = 0;
    const h = hour(), lectOn = h >= OPEN_LECT[0] && h < OPEN_LECT[1];
    for (const s of seats) {
      if (s.kind === 'tenta') continue;
      const p = s.kind === 'aula' ? (lectOn ? 0.55 : 0.12) : s.kind === 'las' ? 0.55 : 0;
      if (hash(s.x, s.y, g?.day || 1) < p && s.id !== 'aula-C4' && s.id !== 'aula-C5') {
        const S = { seat: s, look: student(), write: hash(s.x, 3, 7) * 6, sleep: s.kind === 'las' && hash(s.x, 5, g?.day || 1) < 0.3, book: s.kind === 'las' };
        s.occ = S; sitters.push(S);
      }
    }
  }
  seatStudents();
  // gående studenter (anslagstavlan ↔ expeditionen ↔ bokhyllorna ↔ bysten)
  const SPOTS_WALK = [[40, 108], [208, 130], [140, 150], [560, 118], [640, 110], [540, 196], [250, 120], [90, 190]];
  const walkers = [];
  for (let i = 0; i < 3; i++) {
    const w = createWalker({ W, H, left: 6, right: W - 6, top: 100, bottom: 212, spawn: SPOTS_WALK[(i * 3) % SPOTS_WALK.length] });
    w.setObstacles(obstacles); w.speed = 30 + i * 5;
    walkers.push({ w, look: student(), wait: 1 + i * 2, book: i === 1 });
  }

  // ---------- jag ----------
  const me = { seat: null, state: 'free', lec: null, exam: null, waitT: -9 };
  let doorOpen = 0;

  // ---------- spellogik (defensivt) ----------
  const COURSES = () => GM.COURSES || {};
  const hasEdu = () => typeof g?.enroll === 'function' && typeof g?.attendLecture === 'function';
  const eduOf = (id) => (g?.edu || {})[id] || null;
  const courseStatus = (id) => {
    const c = COURSES()[id], e = eduOf(id);
    if (!e) return { key: 'ny', txt: 'Inte antagen' };
    if (e.klar) return { key: 'klar', txt: '🎓 Examen klar!' };
    if (e.lect >= c.lectures) return { key: 'tenta', txt: `Tentan väntar i biblioteket` };
    return { key: 'las', txt: `Föreläsning ${e.lect} av ${c.lectures}` };
  };

  // ---------- expeditionen: kurserna ----------
  function openCourses() {
    if (!hasEdu()) { guide.talk.say('Kurserna har inte börjat än – kom tillbaka snart!', guideAt(), 4); return; }
    const rows = Object.values(COURSES()).map((c) => {
      const st = courseStatus(c.id), job = GM.JOBS?.[c.job];
      const btn = st.key === 'ny'
        ? `<button class="btn btn-go" data-kurs="${c.id}" ${g.money < c.fee ? 'disabled' : ''}>📝 Anmäl mig – ${GM.fmt(c.fee)}</button>`
        : `<span style="font-size:18px"><b>${st.txt}</b></span>`;
      return `<div style="border:3px solid var(--ink);padding:8px 10px;margin:8px 0;background:rgba(255,255,255,.35)">
        <div style="font-size:21px"><b>${c.icon} ${esc(c.name)}</b></div>
        <div style="font-size:17px;margin:4px 0">${esc(c.blurb)}</div>
        <div style="font-size:17px">📚 ${c.lectures} föreläsningar i Aula 1 (2 timmar var, en om dagen) · ✏️ tenta i biblioteket</div>
        ${job ? `<div style="font-size:17px">💼 Examen ger jobb: <b>${job.icon} ${esc(job.name)}</b> – ${job.wage} kr per rätt</div>` : ''}
        <div style="margin-top:6px">${btn}</div></div>`;
    }).join('');
    const dlg = openModal('🎓 Studentexpeditionen', `<p style="font-size:19px;margin-top:0">"Välkommen till Pixelhögskolan! Vilken utbildning lockar?"</p>${rows}
      <p style="font-size:16px;margin-bottom:0">Föreläsningarna går 08–17. Sätt dig i en ledig bänk i Aula 1 när du är antagen.</p>`, [
      { label: 'Tack, hej!', onClick: closeModal },
    ]);
    dlg.querySelectorAll('[data-kurs]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.kurs, r = g.enroll(id);
      if (!r?.ok) { toast(r?.msg || 'Det gick inte.', 'bad'); return; }
      play('coin'); closeModal();
      guide.talk.say(`Välkommen till ${COURSES()[id].name}! Första föreläsningen är i Aula 1 – sätt dig i en ledig bänk.`, guideAt(), 6);
    }));
  }
  const guideAt = () => ({ x: guide.x, y: guide.y - 46 });
  const lectAt = () => ({ x: lecturer.x, y: lecturer.y - 46 });
  const librAt = () => ({ x: librarian.x, y: librarian.y - 46 });

  // ---------- föreläsningen ----------
  function lectureChoices() { return Object.values(COURSES()).filter((c) => g.canLecture?.(c.id)?.ok); }
  function whyNoLecture() {
    const list = Object.values(COURSES());
    if (!list.some((c) => eduOf(c.id))) return 'Du måste vara antagen först – anmäl dig i studentexpeditionen!';
    for (const c of list) { const r = g.canLecture?.(c.id); if (r && !r.ok && eduOf(c.id) && !eduOf(c.id).klar) return r.msg; }
    return 'Du har redan examen – snyggt! Titta förbi biblioteket om du vill plugga mer.';
  }
  function offerLecture() {
    if (!hasEdu()) return;
    const h = hour();
    if (h < OPEN_LECT[0] || h >= OPEN_LECT[1]) { lecturer.talk.say(h < OPEN_LECT[0] ? 'Första föreläsningen börjar 08:00.' : 'Dagens sista föreläsning har börjat – kom tillbaka i morgon 08:00!', lectAt(), 4); return; }
    const ch = lectureChoices();
    if (!ch.length) { lecturer.talk.say(whyNoLecture(), lectAt(), 5); return; }
    const btns = ch.map((c) => ({ label: `${c.icon} ${esc(c.name)} (${eduOf(c.id).lect + 1} av ${c.lectures})`, cls: 'btn-go', onClick: () => { closeModal(); startLecture(c.id); } }));
    openModal('📚 Föreläsning i Aula 1', `<p style="font-size:20px;margin-top:0">Föreläsningen tar <b>2 timmar</b> och lite ork. Anteckna flitigt – det kommer på tentan!</p>`,
      [{ label: 'Inte nu', onClick: closeModal }, ...btns]);
  }
  function startLecture(id) {
    const L = LECTURES[id] || LECTURES.datorteknik;
    me.lec = { id, t: 0, dur: 9, board: L.board, lines: L.lines, said: -1 };
    lecturer.talk.clear();
    play('click');
  }
  function endLecture() {
    const L = me.lec; me.lec = null;
    const r = g.attendLecture(L.id);
    if (!r?.ok) { toast(r?.msg || 'Föreläsningen blev inställd.', 'bad'); return; }
    const c = COURSES()[L.id];
    play('ok');
    toast(`📚 Föreläsning ${r.lect} av ${r.of} i ${c.name} klar!`, 'good');
    talkMe.say(r.lect >= r.of ? 'Sista föreläsningen! Nu väntar tentan i biblioteket.' : ['Nu fattar jag!', 'Jag antecknade allt!', 'Spännande!'][r.lect % 3], meAt, 4);
  }

  // ---------- tentan ----------
  function examChoices() { return Object.values(COURSES()).filter((c) => g.canExam?.(c.id)?.ok); }
  function offerExam() {
    if (!hasEdu()) return;
    const ch = examChoices();
    if (!ch.length) {
      const list = Object.values(COURSES());
      let msg = 'Tentorna skrivs här när alla föreläsningar är gjorda. Anmäl dig i expeditionen!';
      for (const c of list) { const r = g.canExam?.(c.id); if (r && !r.ok && eduOf(c.id)) { msg = r.msg; if (!eduOf(c.id).klar) break; } }
      librarian.talk.say(msg, librAt(), 5); return;
    }
    if (ch.length === 1) { startExam(ch[0].id); return; }
    openModal('✏️ Tentabordet', '<p style="font-size:20px;margin-top:0">Vilken tenta vill du skriva?</p>', [{ label: 'Inte nu', onClick: closeModal }, ...ch.map((c) => ({ label: `${c.icon} ${esc(c.name)}`, cls: 'btn-go', onClick: () => { closeModal(); startExam(c.id); } }))]);
  }
  function pickQuiz(id) {
    const pool = (QUIZ[id] || []).slice(), out = [];
    const r = ((s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(((g?.day || 1) * 131 + (eduOf(id)?.tenta || 0) * 977 + id.length) | 0 || 1);
    while (out.length < 3 && pool.length) out.push(pool.splice((r() * pool.length) | 0, 1)[0]);
    return out.map(([q, right, ...wrong]) => { const opts = [right, ...wrong].map((s, i) => ({ s, ok: i === 0 })); for (let i = opts.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [opts[i], opts[j]] = [opts[j], opts[i]]; } return { q, opts }; });
  }
  function startExam(id) {
    const s = seatById('tenta-0');
    if (me.seat !== s) sitAt(s);
    me.exam = { id, qs: pickQuiz(id), i: 0, right: 0 };
    showQuestion();
  }
  function showQuestion() {
    const E = me.exam; if (!E) return;
    const c = COURSES()[E.id], Q = E.qs[E.i];
    const dlg = openModal(`✏️ Tenta i ${esc(c.name)} – fråga ${E.i + 1} av ${E.qs.length}`, `<p style="font-size:21px;margin-top:0"><b>${esc(Q.q)}</b></p>
      ${Q.opts.map((o, i) => `<button class="btn" style="display:block;width:100%;margin:6px 0;text-align:left;font-size:19px" data-svar="${i}">${'ABC'[i]}. ${esc(o.s)}</button>`).join('')}`, [], { closable: false });
    dlg.querySelectorAll('[data-svar]').forEach((b) => (b.onclick = () => answer(+b.dataset.svar)));
  }
  function answer(i) {
    const E = me.exam; if (!E) return;
    const Q = E.qs[E.i];
    if (Q.opts[i]?.ok) E.right += 1;
    play(Q.opts[i]?.ok ? 'click' : 'click');
    E.i += 1;
    if (E.i < E.qs.length) { showQuestion(); return; }
    finishExam();
  }
  function finishExam() {
    const E = me.exam; me.exam = null;
    const c = COURSES()[E.id], r = g.takeExam(E.id, E.right, E.qs.length);
    if (!r?.ok) { closeModal(); toast(r?.msg || 'Tentan gick inte att lämna in.', 'bad'); return; }
    if (r.pass) {
      play('fanfare');
      const job = GM.JOBS?.[c.job];
      openModal('🎓 GODKÄND – EXAMEN!', `<div style="text-align:center"><img src="${diplomaURL(c)}" alt="Examensbevis" style="width:360px;max-width:100%;image-rendering:pixelated"></div>
        <p style="font-size:20px">${r.right} av ${r.of} rätt – du har nu examen i <b>${esc(c.name)}</b>!</p>
        ${job ? `<p style="font-size:19px">💼 Nu kan du jobba som <b>${job.icon} ${esc(job.name)}</b> i downtown – ${job.wage} kr per rätt.</p>` : ''}`, [{ label: '🎉 Hurra!', cls: 'btn-go', onClick: closeModal }]);
      librarian.talk.say('Grattis till examen! 🎓', librAt(), 4);
    } else {
      play('fel');
      openModal('✏️ Underkänd', `<p style="font-size:20px;margin-top:0">${r.right} av ${r.of} rätt – det krävs ${Math.ceil((r.of * 2) / 3)} för godkänt.</p>
        <p style="font-size:19px">Omtentan kan du skriva i morgon. Läs på: tavlan i Aula 1 och bokhyllorna har svaren!</p>`, [{ label: 'Okej…', cls: 'btn-go', onClick: closeModal }]);
      talkMe.say('Suck. Omtenta i morgon…', meAt, 4);
    }
  }
  // examensbeviset: pergament med sigill, namnet och kursen
  function diplomaURL(c) {
    const P = new Pix(120, 80);
    for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) {
      let col = jit(0xf4e8c8, x >> 1, y >> 1, 211, 0.04);
      if (x < 3 || x > 116 || y < 3 || y > 76) col = 0x8a6a3a;
      else if (x === 5 || x === 114 || y === 5 || y === 74) col = 0xc89a40;
      P.px(x, y, col);
    }
    const ctr = (s, y, F, col) => text(P, F, s, 60 - (textW(F, s) >> 1), y, col);
    ctr('PIXELHÖGSKOLAN', 9, SMALL, 0x6a4a1a);
    ctr('EXAMEN', 18, BIG, 0x1f3a6a);
    ctr(safeTxt(A.avatar?.name || 'STUDENT').slice(0, 18), 32, SMALL, 0x2a2430);
    ctr('I ' + safeTxt(c.name), 42, SMALL, 0x2a2430);
    ctr('DAG ' + (g?.day || 1), 52, SMALL, 0x6a5a40);
    P.ell(96, 64, 7, 7, 0xb82a20, 1, 1); P.px(96, 64, 0xf0c850); P.px(95, 63, 0xf0c850); P.px(97, 63, 0xf0c850);
    P.rect(93, 69, 2, 6, 0xb82a20); P.rect(98, 69, 2, 6, 0xb82a20);
    P.line(14, 66, 44, 66, 0x2a2430); for (let i = 0; i < 24; i++) P.px(16 + i, 63 + Math.round(Math.sin(i * 0.8) * 2), 0x1f3a6a);
    return P.flush().toDataURL();
  }

  // ---------- sitta ----------
  function sitAt(s) {
    if (me.seat) me.seat.occ = null;
    walker.stop(); me.seat = s; s.occ = 'me'; me.state = 'sit';
    walker.px = s.x; walker.py = s.y;
  }
  function standUp() {
    if (!me.seat) return;
    const s = me.seat; s.occ = null; me.seat = null; me.state = 'free';
    walker.px = s.ax; walker.py = s.kind === 'aula' ? s.y : s.ay; walker.snapFree();
    walker.dir = 'down';
  }
  function goSeat(s) {
    if (s.occ && s.occ !== 'me') { talkMe.say('Där sitter någon redan.', meAt, 2); return; }
    if (me.seat === s) { onSeated(s); return; }
    standUp();
    walker.walkTo(s.ax, s.ay, () => {
      if (s.occ && s.occ !== 'me') { talkMe.say('Någon hann före!', meAt, 2); return; }
      sitAt(s); onSeated(s);
    });
  }
  function onSeated(s) {
    if (s.kind === 'aula') offerLecture();
    else if (s.kind === 'tenta') offerExam();
    else talkMe.say(['Skönt med lite lugn och ro.', 'Jag läser en stund.', 'Pssst… tyst i biblioteket!'][Math.floor(t) % 3], meAt, 3);
  }

  // ---------- klickytor ----------
  const hot = [
    { id: 'dorr', r: [DOOR.x0, DOOR.top, DOOR.x1, WALL_Y + 8], go: DOOR_SPOT, label: 'UT TILL STADEN', act: () => { play('door'); doorOpen = 1; A.go('city'); } },
    { id: 'expedition', r: [EXP.x0, 22, EXP.x1, EXP.y], go: EXP_SPOT, label: 'STUDENTEXPEDITIONEN - ANMÄLAN', act: openCourses },
    { id: 'anslag', r: [NOTE.x0 - 2, NOTE.y0 - 8, NOTE.x1 + 2, NOTE.y1 + 2], go: [40, 104], label: 'ANSLAGSTAVLAN', act: () => talkMe.say(['SPEX på fredag kl 19 – det låter kul!', '"Pluggkompis sökes inför ekonomitentan." Hm!', 'Korridorrum sökes… någon har rivit alla lappar utom en.', 'Kårfest! Man måste visa studentkortet.'][Math.floor(t * 0.7) % 4], meAt, 4) },
    { id: 'byst', r: [BUST.x - 10, BUST.y - 44, BUST.x + 10, BUST.y], go: [BUST.x + 4, BUST.y + 10], label: 'PROFESSOR PIXEL', act: () => { talkMe.say('Professor Pixel, grundare 1893. Man klappar näsan för tur på tentan!', meAt, 5); play('click'); } },
    { id: 'tavla', r: [BOARD.x0 - 4, BOARD.y0 - 4, BOARD.x1 + 4, BOARD.y1 + 8], go: [376, 108], label: 'SVARTA TAVLAN', act: () => lecturer.talk.say(me.lec ? 'Anteckna – det här kommer på tentan!' : 'Föreläsningarna går 08–17. Sätt dig i en ledig bänk!', lectAt(), 4) },
    { id: 'lektor', r: () => [lecturer.x - 8, lecturer.y - 44, lecturer.x + 8, lecturer.y], go: () => [lecturer.x, 118], label: 'DOCENT LIND', act: () => lecturer.talk.say(me.lec ? 'Tyst i salen, tack!' : whyNoLectureShort(), lectAt(), 5) },
    { id: 'katedern', r: [LECT.x0, LECT.top - 4, LECT.x1, LECT.y], go: [478, 122], label: 'KATEDERN', act: () => talkMe.say('Docentens anteckningar… "KOM IHÅG: TENTAN!"', meAt, 3) },
    { id: 'hylla', r: [SHELF.x0, SHELF.y0 - 4, SHELF.x1, SHELF.y1 + 2], go: () => [clamp(walker.px, SHELF.x0 + 10, SHELF.x1 - 10), 106], label: 'BOKHYLLORNA', act: () => talkMe.say(studyTip(), meAt, 5) },
    { id: 'bibliotekarie', r: [LIB.x0, LIB.top - 50, LIB.x1, LIB.y], go: [LIBR[0], 130], label: 'BIBLIOTEKARIEN', act: () => { librarian.stampT = 1; play('click'); librarian.talk.say(examChoices().length ? 'Du får skriva tentan vid tentabordet. Lycka till!' : 'Välkommen! Tentorna skrivs vid tentabordet, lånen här.', librAt(), 4); } },
    { id: 'glob', r: [GLOBE.x - 10, GLOBE.y - 30, GLOBE.x + 10, GLOBE.y], go: [GLOBE.x - 14, GLOBE.y + 6], label: 'JORDGLOBEN', act: () => { globeSpin = 3; play('slide'); } },
  ];
  function whyNoLectureShort() {
    const h = hour();
    if (h < OPEN_LECT[0] || h >= OPEN_LECT[1]) return 'Föreläsningarna går 08–17.';
    return lectureChoices().length ? 'Sätt dig i en ledig bänk så börjar vi!' : whyNoLecture();
  }
  function studyTip() {
    const on = Object.values(COURSES()).find((c) => eduOf(c.id) && !eduOf(c.id).klar);
    if (on?.id === 'datorteknik') return '"Datorns delar": CPU räknar, RAM minns, PSU ger ström. Kylpasta på processorn!';
    if (on?.id === 'ekonomi') return '"Börsen för nybörjare": köp under kundens gräns, sälj över den. 10 × 20 kr = 200 kr.';
    return ['"Pixelstadens historia", del 1–12. Tjocka!', 'En hel hylla om kokkonst. Hungrig nu.', '"Sagan om den sista nattbussen". Den har jag läst!'][Math.floor(t) % 3];
  }
  let globeSpin = 0, globeAng = 0;
  const rOf = (h) => (typeof h.r === 'function' ? h.r() : h.r);
  const goOf = (h) => (typeof h.go === 'function' ? h.go() : h.go);
  function spotAt(x, y) {
    for (const s of seats) if (s.occ !== 'me' && Math.abs(x - s.x) <= 7 && y >= s.y - 30 && y <= s.y + 3) return { seat: s };
    for (const h of hot) { const [x0, y0, x1, y1] = rOf(h); if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return h; }
    return null;
  }

  // ---------- kameran ----------
  const cams = () => clamp((lockedCam ?? peekCam ?? walker.px - VW / 2), 0, W - VW);

  // ---------- uppdatering ----------
  function update(dt) {
    t += dt;
    if (!me.seat) walker.update(dt);
    cam.x += (cams() - cam.x) * (lockedCam !== null ? 1 : Math.min(1, dt * 6));
    if (doorOpen > 0) doorOpen = Math.max(0, doorOpen - dt);
    if (globeSpin > 0) { globeSpin -= dt; globeAng += dt * (1 + globeSpin * 2); }
    if (librarian.stampT > 0) librarian.stampT -= dt;
    // föreläsaren: skriver på tavlan (ryggen mot salen) och vänder sig om och pratar
    const L = me.lec;
    if (L) {
      L.t += dt;
      const li = Math.min(L.lines.length - 1, Math.floor((L.t / L.dur) * L.lines.length));
      if (li !== L.said) { L.said = li; L.line = L.lines[li]; }
      const phase = (L.t % 2.4) / 2.4;
      lecturer.tx = BOARD.x0 + 14 + ((L.t / L.dur) * (BOARD.x1 - BOARD.x0 - 28));
      lecturer.dir = phase < 0.55 ? 'up' : 'down';
      if (L.t >= L.dur) endLecture();
    } else {
      lecturer.dir = 'down';
      if (Math.abs(lecturer.x - lecturer.tx) < 1) lecturer.tx = hash(Math.floor(t / 7), 1, 5) < 0.5 ? 330 : 420;
    }
    const d = lecturer.tx - lecturer.x;
    lecturer.walking = Math.abs(d) > 1;
    if (lecturer.walking) { lecturer.x += Math.sign(d) * Math.min(Math.abs(d), 26 * dt); if (!L) lecturer.dir = d < 0 ? 'left' : 'right'; }
    // gående studenter
    for (const P of walkers) {
      if (P.w.path.length) { P.w.update(dt); continue; }
      P.wait -= dt;
      if (P.wait <= 0) { const [x, y] = SPOTS_WALK[Math.floor(hash(Math.floor(t * 3), walkers.indexOf(P), 9) * SPOTS_WALK.length)]; P.w.walkTo(x, y); P.wait = 2 + hash(Math.floor(t), 2, walkers.indexOf(P)) * 6; }
    }
    // studentprat då och då (bara i bild)
    if (!talkStud.active() && hash(Math.floor(t / 5), 3, 11) < 0.02 * dt * 60) {
      const S = sitters.filter((s) => seenX(s.seat.x) && s.seat.kind === 'aula')[0];
      if (S && !me.lec) talkStud.say(['Har du anteckningarna från i går?', 'Kaffe efteråt?', 'Jag hann inte läsa…'][Math.floor(t) % 3], { x: S.seat.x, y: S.seat.y - 40 }, 3);
    }
  }
  const seenX = (x, m = 0) => x >= cam.x - m && x <= cam.x + VW + m;

  // ---------- ritning ----------
  let imgs = null;
  function ensureImgs() {
    if (imgs) return imgs;
    imgs = {
      exp: paintExpDesk(), lib: paintLibDesk(), lect: paintLectern(), bust: paintBust(), rtab: paintReadTable(), ttab: paintExamTable(),
      rows: ROWS.map((_, r) => paintBenchRow(r)), chairDown: paintChair('down'), chairUp: paintChair('up'), plant: paintPlant(), bench: paintHallBench(), easel: paintEasel(),
    };
    return imgs;
  }
  function paintHallBench() {
    const w = BENCH.x1 - BENCH.x0, P = new Pix(w + 2, 18);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < 3; j++) P.px(i, j, j === 0 ? 0xb88458 : jit(0x8a5c36, i, j, 221, 0.05));          // ryggstödet
      P.px(i, 7, 0xc89464); P.px(i, 8, jit(0x9a6a40, i, 8, 222, 0.05)); P.px(i, 9, 0x6a4424); P.px(i, 10, 0x3a2412); // sitsen
    }
    for (const lx of [2, w - 4]) { P.rect(lx, 3, 2, 4, 0x5a3a22); P.rect(lx, 11, 2, 5, 0x4a2a18); }
    P.rect(w >> 1, 3, 2, 4, 0x5a3a22);
    P.hl(1, 16, w, 0x000000, 0.25);
    // någon har glömt en bok och en mössa
    P.rect(10, 5, 8, 2, 0x2a4a7a); P.hl(10, 5, 8, 0xd8b060); P.rect(w - 20, 5, 6, 2, 0xc83a3a); P.px(w - 17, 4, 0xf4f1ea);
    return P.flush();
  }
  function paintEasel() {
    const P = new Pix(28, 36);
    P.line(4, 34, 10, 2, 0x6a4428); P.line(23, 34, 17, 2, 0x6a4428); P.line(14, 30, 14, 4, 0x5a3a22);
    P.rect(2, 3, 24, 24, 0xf4f1ea); P.box(2, 3, 24, 24, 0x8a5c36); P.hl(3, 4, 22, 0xffffff);
    const L = ['VÄLKOM-', 'MEN', 'NYA', 'STUDEN-', 'TER!'];
    L.forEach((l, i) => text(P, SMALL, l, 14 - (textW(SMALL, l) >> 1), 5 + i * 6 - (i > 1 ? 1 : 0), i < 2 ? 0x1f3a6a : 0xa83a3a));
    P.rect(3, 27, 22, 2, 0x8a5c36);
    P.hl(3, 35, 22, 0x000000, 0.25);
    return P.flush();
  }
  function paintPlant() {
    const P = new Pix(20, 28);
    P.rect(5, 18, 10, 9, 0xb8683a); P.hl(4, 18, 12, 0xd8885a); P.hl(5, 26, 10, 0x6a3a1a);
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 4 + (i % 3) * 2; P.line(10, 16, 10 + Math.cos(a) * r, 10 + Math.sin(a) * r * 0.9, i % 2 ? 0x3f8a3a : 0x5aaa4a); }
    return P.flush();
  }
  function drawWorld(ctx, cx) {
    const key = isNight() ? 'n' : 'd';
    if (key !== bgKey) { bg = paintBg(key === 'n'); bgKey = key; }
    ctx.drawImage(bg, 0, 0);
    const I = ensureImgs();
    // tavlans krita
    drawBoard(ctx);
    // klockan (visarna följer speltiden)
    drawClock(ctx, CLOCK.x, CLOCK.y);
    // allt på golvet sorteras på fötterna
    const items = [];
    const add = (fy, fn) => items.push({ fy, fn });
    add(EXP.y, (c) => c.drawImage(I.exp.img, I.exp.x, I.exp.y));
    add(LIB.y, (c) => c.drawImage(I.lib.img, I.lib.x, I.lib.y));
    add(LECT.y, (c) => c.drawImage(I.lect.img, I.lect.x, I.lect.y));
    add(BUST.y, (c) => c.drawImage(I.bust.img, I.bust.x, I.bust.y));
    add(RTAB.y, (c) => c.drawImage(I.rtab.img, I.rtab.x, I.rtab.y));
    add(TTAB.y, (c) => c.drawImage(I.ttab.img, I.ttab.x, I.ttab.y));
    add(GLOBE.y, (c) => c.drawImage(paintGlobeCached(), GLOBE.x - 10, GLOBE.y - 28));
    add(210, (c) => c.drawImage(I.plant, 1, 186));
    add(BENCH.y, (c) => c.drawImage(I.bench, BENCH.x0 - 1, BENCH.y - 16));
    add(EASEL.y, (c) => c.drawImage(I.easel, EASEL.x - 14, EASEL.y - 34));
    I.rows.forEach((R) => add(R.fy, (c) => c.drawImage(R.img, R.x, R.y)));
    // stolarna vid läsbordet och tentabordet
    for (const s of seats) if (s.kind !== 'aula') {
      if (s.dir === 'down') add(s.y - 0.5, (c) => c.drawImage(I.chairDown, s.x - 6, s.y - 24));
      else add(s.y - 0.4, (c) => c.drawImage(I.chairUp, s.x - 6, s.y - 12));
    }
    // personalen
    add(guide.y, (c) => drawPerson(c, guide.x, guide.y, guide.look, 'down', Math.sin(t * 1.3) > 0.92 ? 4 : 0));
    add(librarian.y, (c) => drawPerson(c, librarian.x, librarian.y, librarian.look, 'down', librarian.stampT > 0 ? 6 : Math.sin(t * 1.1 + 2) > 0.93 ? 4 : 0));
    add(lecturer.y, (c) => {
      const writing = me.lec && lecturer.dir === 'up' && !lecturer.walking;
      drawPerson(c, lecturer.x, lecturer.y, lecturer.look, lecturer.dir, lecturer.walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0);
      if (writing && Math.floor(t * 8) % 2) { c.fillStyle = '#f4f1ea'; c.fillRect(Math.round(lecturer.x) + 5, lecturer.y - 34, 1, 1); }
    });
    // sittande studenter
    for (const S of sitters) {
      const s = S.seat;
      add(s.y, (c) => {
        const note = me.lec && s.kind === 'aula' && Math.floor(t * 2 + S.write) % 5 === 0;
        drawPerson(c, s.x, s.y, S.look, s.dir, S.sleep ? 5 : note ? 6 : 5);
        if (S.book && s.dir === 'down') { c.fillStyle = '#f4f1ea'; c.fillRect(s.x - 4, s.y + 2, 8, 3); c.fillStyle = '#8a2a2a'; c.fillRect(s.x - 5, s.y + 5, 10, 1); }
        if (S.sleep && Math.floor(t * 1.5 + s.x) % 3 === 0) ctxText(c, SMALL, 'Z', s.x + 6, s.y - 42 - (Math.floor(t * 3) % 4), '#e8ecf8');
      });
    }
    // gående studenter
    for (const P of walkers) add(P.w.py, (c) => drawPerson(c, P.w.px, P.w.py, P.look, P.w.dir, P.w.path.length ? WALK_SEQ[Math.floor(t * 7) % 4] : 0));
    // andra spelare och jag
    for (const d of folkDrawables(A, t)) add(d.fy, (c) => d.draw(c));
    if (me.seat) {
      const s = me.seat;
      add(s.y + 0.01, (c) => {
        const note = me.lec && Math.floor(t * 2) % 3 === 0;
        drawPerson(c, s.x, s.y, A.avatar.look, s.dir, note || me.exam ? 6 : 5);
      });
    } else {
      const sd = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length });
      add(walker.py + 0.01, (c) => sd.draw(c));
    }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.fn(ctx);
    // kvällsljus: lamporna vid läsbordet lyser
    if (isNight()) { ctx.fillStyle = 'rgba(255,230,160,0.10)'; for (const lx of [RTAB.x0 + 18, RTAB.x1 - 14]) ctx.fillRect(lx - 10, RTAB.top - 6, 20, 10); }
  }
  let globeImg = null, globeKey = -1;
  function paintGlobeCached() { const k = Math.round(globeAng * 4) % 50; if (k !== globeKey) { globeImg = paintGlobe(k / 4); globeKey = k; } return globeImg; }
  function drawBoard(ctx) {
    const L = me.lec;
    const steps = L ? BOARDS[L.board] : BOARDS.idle;
    const prog = L ? clamp(L.t / (L.dur * 0.92), 0, 1) * steps.length : steps.length;
    for (let i = 0; i < steps.length; i++) {
      const k = clamp(prog - i, 0, 1);
      if (k > 0) steps[i](ctx, k);
    }
  }
  function drawClock(ctx, x, y) {
    ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 7, y - 7, 15, 15);
    ctx.fillStyle = '#c89a40'; ctx.fillRect(x - 6, y - 6, 13, 13);
    ctx.fillStyle = '#f8f4ea'; ctx.fillRect(x - 5, y - 5, 11, 11);
    ctx.fillStyle = '#2a2430'; for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) ctx.fillRect(x + dx, y + dy, 1, 1);
    const m = (g?.min || 0) % (12 * 60), ha = (m / 720) * Math.PI * 2 - Math.PI / 2, ma = ((m % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    for (let i = 0; i <= 3; i++) ctx.fillRect(Math.round(x + Math.cos(ha) * i * 0.8), Math.round(y + Math.sin(ha) * i * 0.8), 1, 1);
    ctx.fillStyle = '#a83a3a'; for (let i = 0; i <= 4; i++) ctx.fillRect(Math.round(x + Math.cos(ma) * i), Math.round(y + Math.sin(ma) * i), 1, 1);
  }

  // ---------- rörelse ----------
  function goSpot(h) {
    const [gx, gy] = goOf(h);
    walker.walkTo(gx, gy, () => { walker.dir = 'up'; h.act(); });
  }

  let hoverId = null, hoverT = -9;
  const api = {
    viewMax: { w: W, h: H },
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return me.seat ? me.seat.y : walker.py; },
    get worldSit() { return me.seat ? { dir: me.seat.dir } : null; },
    enter() { cam.x = cams(); },
    exit() { closeModalIfMine(); guide.talk.clear(); lecturer.talk.clear(); librarian.talk.clear(); talkMe.clear(); talkStud.clear(); },
    // mitt i en föreläsning eller tenta går man inte därifrån (👥-menyn frågar här)
    leaveBlock() { return me.lec ? 'Föreläsningen pågår – lyssna klart först! 📚' : me.exam ? 'Skriv klart tentan först! ✏️' : null; },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      peekCam = null;
      if (me.lec) { if (t - me.waitT > 2) { talkMe.say('Tyst – föreläsningen pågår!', meAt, 2); me.waitT = t; } return; }
      if (me.exam) return;
      const h = spotAt(x, y);
      if (h?.seat) { goSeat(h.seat); return; }
      if (me.seat) standUp();
      if (h) { goSpot(h); return; }
      if (y > WALL_Y + 4) walker.walkTo(x, y);
    },
    move(sx, sy) { const h = spotAt(sx + cam.x, sy); hoverId = h ? (h.seat ? h.seat.id : h.id) : null; hoverT = t; },
    key(k) { if (k === 'Escape' && !me.lec && !me.exam) { walker.stop(); standUp(); } },
    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      drawWorld(ctx, cx);
      const view = { x0: cx, x1: cx + VW };
      for (const [S, at] of [[guide.talk, guideAt()], [lecturer.talk, lectAt()], [librarian.talk, librAt()], [talkMe, meAt()], [talkStud, null]]) {
        if (!S.active()) continue;
        if (at && !seenX(at.x, -2)) continue;
        S.draw(ctx, view);
      }
      // skylt i nederkanten: vad man pekar på
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      let label = null;
      if (hoverId && t - hoverT < 3) {
        const s = seatById(hoverId);
        if (s) label = s.kind === 'aula' ? 'SÄTT DIG - FÖRELÄSNING' : s.kind === 'tenta' ? 'TENTABORDET - SKRIV TENTAN' : 'LÄSPLATS';
        else label = hot.find((h) => h.id === hoverId)?.label || null;
      }
      // föreläsningen: docentens repliker som textremsa längst ner (bubblan skulle skymma tavlan)
      if (me.lec) drawCaption(ctx);
      if (label && !me.lec) {
        const safe = globalThis.SF?.view?.safe || { y1: H };
        const by = Math.min(H, safe.y1) - 14, w = textW(SMALL, label) + 10;
        ctx.fillStyle = '#1f3a6a'; ctx.fillRect((VW - w) >> 1, by, w, 11);
        ctx.fillStyle = '#c89a40'; ctx.fillRect(((VW - w) >> 1) + 1, by + 1, w - 2, 1);
        ctxText(ctx, SMALL, label, ((VW - w) >> 1) + 5, by + 4, '#f4ecd8');
      }
      // pilar mot resten av huset
      if (cx > 40) edgeSign(ctx, true, cx > Z_BIB - 40 ? 'AULA 1' : 'ENTRÉ');
      if (cx < W - VW - 40) edgeSign(ctx, false, cx + VW < Z_BIB ? 'BIBLIOTEK' : 'MER');
    },
    _debug: {
      spot: (id) => {
        const s = seatById(id);
        let x, y;
        if (s) { x = s.x; y = s.y - 14; } else {
          const h = hot.find((q) => q.id === id) || (id === 'tenta' ? { r: [TTAB.x0, TTAB.top - 7, TTAB.x1, TTAB.y] } : id === 'lasbord' ? { r: [RTAB.x0, RTAB.top, RTAB.x1, RTAB.y] } : null);
          if (!h) return null;
          const [x0, y0, x1, y1] = rOf(h); x = (x0 + x1) / 2; y = (y0 + y1) / 2;
        }
        if (x < cam.x + 8 || x > cam.x + VW - 8) { lockedCam = clamp(x - VW / 2, 0, W - VW); cam.x = lockedCam; }
        return { x: Math.round(x - cam.x), y: Math.round(y) };
      },
      seats: () => seats.map((s) => ({ id: s.id, x: s.x, y: s.y, kind: s.kind, occ: s.occ === 'me' ? 'me' : s.occ ? 'npc' : null })),
      state: () => ({ seat: me.seat?.id || null, lec: me.lec ? { id: me.lec.id, t: +me.lec.t.toFixed(2) } : null, exam: me.exam ? { id: me.exam.id, i: me.exam.i } : null, x: Math.round(walker.px), y: Math.round(walker.py), edu: JSON.parse(JSON.stringify(g?.edu || {})), money: g?.money, min: g?.min, sitters: sitters.length, guide: guide.talk.text(), lect: lecturer.talk.text(), libr: librarian.talk.text(), me: talkMe.text() }),
      enroll: (id) => g.enroll(id),
      sit: (id) => { const s = seatById(id); if (s) { sitAt(s); } return me.seat?.id || null; },
      lecture: (id) => { const s = seats.find((q) => q.kind === 'aula' && !q.occ) || seats.find((q) => q.occ === 'me'); if (s && me.seat !== s) sitAt(s); const ok = g.canLecture?.(id); if (!ok?.ok) return ok; startLecture(id); return { ok: true }; },
      fastLecture: () => { if (me.lec) { me.lec.t = me.lec.dur - 0.01; update(0.05); } return api._debug.state(); },
      quiz: (id) => pickQuiz(id).map((q) => ({ q: q.q, right: q.opts.findIndex((o) => o.ok) })),
      exam: (id, svar) => { const s = seatById('tenta-0'); if (me.seat !== s) sitAt(s); me.exam = { id, qs: pickQuiz(id), i: 0, right: 0 }; for (let i = 0; i < me.exam.qs.length; i++) { const Q = me.exam.qs[i]; const a = svar?.[i] ?? -1; if (Q.opts[a]?.ok) me.exam.right += 1; } me.exam.i = me.exam.qs.length; const right = me.exam.right; finishExam(); return { right, edu: g.edu?.[id] }; },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = cams(); },
      teleport: (x, y) => { standUp(); walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = cams(); },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      cam: () => cam.x,
      panorama: () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        drawWorld(x, 0);
        return c.toDataURL();
      },
    },
  };
  function drawCaption(ctx) {
    const L = me.lec, c = COURSES()[L.id], e = eduOf(L.id);
    const safe = globalThis.SF?.view?.safe || { y1: H };
    const lines = sayLines(L.line || '', VW - 56, 2);
    const h = 18 + lines.length * 7, x = 8, w = VW - 16, y = Math.min(H, safe.y1) - h - 4;
    ctx.fillStyle = '#0f1f3a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1f3a6a'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#c89a40'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    const head = `FÖRELÄSNING ${Math.min((e?.lect || 0) + 1, c?.lectures || 1)} AV ${c?.lectures || 1} - ${safeTxt(c?.name || '')}`;
    ctxText(ctx, SMALL, head, x + 6, y + 4, '#f0c850');
    const k = clamp(L.t / L.dur, 0, 1), bx = x + 12 + textW(SMALL, head), bw = w - (bx - x) - 8;
    ctx.fillStyle = '#0f1f3a'; ctx.fillRect(bx, y + 5, bw, 3); ctx.fillStyle = '#f0c850'; ctx.fillRect(bx, y + 5, Math.round(bw * k), 3);
    // docenten själv, liten, till vänster om texten
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 6, y + 13, 2, 2 + lines.length * 7 - 4);
    lines.forEach((ln, i) => ctxText(ctx, SMALL, safeTxt(ln.map((q) => q.g).join('')), x + 12, y + 13 + i * 7, '#f4ecd8'));
  }
  function closeModalIfMine() { if (me.exam) { me.exam = null; closeModal(); } }
  function edgeSign(ctx, left, s) {
    const w = textW(SMALL, s) + 14, x = left ? 3 : VW - w - 3, y = 100;
    ctx.fillStyle = '#1f3a6a'; ctx.fillRect(x, y, w, 11);
    ctx.fillStyle = '#c89a40'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, s, x + (left ? 9 : 4), y + 3, '#f4ecd8');
    ctx.fillStyle = '#f0c850';
    for (let i = 0; i < 3; i++) { const ax = left ? x + 3 + i : x + w - 4 - i; ctx.fillRect(ax, y + 5 - i, 1, 1 + i * 2); }
  }
  return api;
}
