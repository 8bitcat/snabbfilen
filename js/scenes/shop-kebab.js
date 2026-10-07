// KEBAB GRILL INNE – förortens lilla sunkiga grill (samma hus som fasaden med
// KEBAB-neonet där en bokstav är släckt, js/city/buildings-suburb.js). Lokalen är
// 480 px bred (kameran följer figuren) och ser ut som en riktig kvarterskebab:
//
//   VÄNSTER: stora fönstret mot gatan (betonghuset mitt emot, björkarna, bilarna och
//     folk som går förbi) med GRILL-neonet baklänges – R:et är dött, precis som
//     utifrån – och Betong IF-halsduken ovanför. Under fönstret en smal bardisk med
//     tre barstolar (en lagad med silvertejp), två små bord med röda plaststolar och
//     en dammig plastfikus i hörnet.
//   MITTEN: glasdörren med nödutgångsskylten, flugfångaren som lyser blått (och
//     ibland säger ZZT), en solblekt affisch och väggklockan.
//   HÖGER: disken – salladsbaren under glaset, såsflaskorna, dricksburken och kassan –
//     och bakom den grillkocken Deniz vid de två spetten som snurrar (kött och
//     kyckling) framför glödande värmeelement, fritösen, mikron som blinkar 12:00,
//     läskkylen och menyn på en ljusskylt där ett lysrör krånglar. Längst in: tv:n på
//     väggarmen (fotboll – ibland MÅL!) och en spelautomat som varit trasig länge.
//     Och en HALT GOLV-skylt, för det är det alltid.
//
// FLÖDET (ätregeln, samma som i Burgarbaren): gå fram till disken och beställ
// (kebabrulle 45 kr, falafel 40 kr, pommes 25 kr, läsk 15 kr – vitlök, stark eller mix)
// → Deniz skär från spettet, friterar, fyller brödet ur salladsbaren, häller sås och
// rullar ihop i folien → man tar brickan i händerna → klickar på en ledig plats → sätter
// sig och äter bit för bit (rullen blir kortare för varje tugga, pommesen färre, läsken
// får ett sugrör) → brickan försvinner FÖRST när allt är uppätet. Mättnaden och energin
// kommer BARA tugga för tugga medan man sitter.
// REGELN I ALLA MATSTÄLLEN: sitter man och äter kan man inte gå därifrån förrän det är
// uppätet – klick någon annanstans → "ÄT UPP FÖRST! 😋" och figuren sitter kvar (att
// prata med gästerna vid borden går bra). Dörren med maten i händerna eller mitt i maten
// → "DU MÅSTE SÄTTA DIG OCH ÄTA UPP!" och man stannar inne (dörren öppnas inte ens).
// Byts scenen ändå mitt i (somnar vid midnatt, 👥-menyn …) får man det som var kvar i
// exit() – betald mat går aldrig förlorad, inte heller om sidan laddas om (settleNow) eller
// stängs/läggs undan (saveAsEaten: bara SPARFILEN får resten, man tuggar vidare som
// vanligt). leaveBlock() säger om man får gå just nu (för huvudprogrammets knappar som
// byter scen).
//
// Gästerna köar, beställer (ikonbubbla), hämtar maten och sätter sig och äter – eller
// tar den med sig i en påse. Allt statiskt målas pixel för pixel med Pix-pennan EN gång
// (per dag/kväll, cachat i modulen) – det som rör sig ritas varje bildruta.
//
// MOBILEN (fyll-läget NÄRA) beskär överkanten och lite av nederkanten. Då följer kameran
// figuren även på höjden (cam.y, camYGoal): vid disken syns spetten, menyn och Deniz, vid
// borden längst fram golvet. Pratbubblorna och pekskylten hålls innanför den synliga rutan
// (A.view.safe). Utan beskärning (datorn, RAM, testrobotar) står cam.y still på 0.
//
// _debug (för tester): spot(id) → SKÄRMkoordinater (världen − kameran, x och y), state(),
// forceBuy(ids, sås), tray(), seated(), seats(), sit(id), eatFast(), tick(sek), lockCam(x),
// teleport(x, y), cam(), camY(), safe(), hover(id), panorama(), sheet().
import { Pix, SMALL, BIG, text, textW, eachTextPixel, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, modalOpen } from '../core/ui.js';
import { fmt, SAVE_KEY } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, sayBubble, sayLines, createSpeech } from './walkable.js';
import { worldFolksHere, worldSeatsTaken } from '../net/world.js';
import { $t } from '../core/i18n.js';

// regelns två repliker (samma i alla matställen)
const MSG_ATUPP = $t('ÄT UPP FÖRST! 😋');
const MSG_DORR = $t('DU MÅSTE SÄTTA DIG OCH ÄTA UPP!');
const MENU_TITLE = $t('🥙 Kebab Grill – vad blir det?');

// ======================= menyn =======================
// fill = mättnad, energy = energi, bites = antal tuggor. Mättnaden och energin delas ut
// TUGGA FÖR TUGGA medan man sitter och äter (fill/bites per tugga – heltal), aldrig vid
// köpet. main = huvudrätt (en rulle per beställning; pommes och läsk kan läggas till).
export const KEBAB_MENY = [
  { id: 'kebab', icon: '🥙', name: $t('Kebabrulle'), board: $t('KEBAB'), price: 45, fill: 56, energy: 8, bites: 4, main: true },
  { id: 'falafel', icon: '🧆', name: $t('Falafelrulle'), board: $t('FALAFEL'), price: 40, fill: 48, energy: 12, bites: 4, main: true },
  { id: 'pommes', icon: '🍟', name: $t('Pommes'), board: $t('POMMES'), price: 25, fill: 21, energy: 3, bites: 3 },
  { id: 'lask', icon: '🥤', name: $t('Läsk'), board: $t('LÄSK'), price: 15, fill: 4, energy: 12, bites: 2 },
];
// den eviga frågan vid disken
export const KEBAB_SASER = [
  { id: 'vitlok', icon: '🧄', name: $t('Vitlök'), say: $t('vitlökssås') },
  { id: 'stark', icon: '🌶️', name: $t('Stark'), say: $t('stark sås') },
  { id: 'mix', icon: '🥫', name: $t('Mix'), say: $t('mixsås') },
];
const menyOf = (id) => KEBAB_MENY.find((m) => m.id === id);
const sasOf = (id) => KEBAB_SASER.find((s) => s.id === id) || KEBAB_SASER[2];
// en giltig beställning: kända rätter, var och en högst en gång, högst en rulle – i menyordning
function normOrder(ids) {
  const out = [];
  let main = false;
  for (const id of ids || []) {
    const m = menyOf(id);
    if (!m || out.includes(m)) continue;
    if (m.main) { if (main) continue; main = true; }
    out.push(m);
  }
  return out.sort((a, b) => KEBAB_MENY.indexOf(a) - KEBAB_MENY.indexOf(b));
}
const priceOf = (list) => list.reduce((a, m) => a + m.price, 0);
const fillOf = (list) => list.reduce((a, m) => a + m.fill, 0);
const energyOf = (list) => list.reduce((a, m) => a + m.energy, 0);
// "en kebabrulle med vitlökssås, pommes och en läsk"
function orderText(list, sauce) {
  const names = list.map((m) => (m.main ? (m.id === 'kebab' ? $t`en kebabrulle med ${sasOf(sauce).say}` : $t`en falafelrulle med ${sasOf(sauce).say}`) : m.id === 'lask' ? $t('en läsk') : $t('pommes')));
  return names.length < 2 ? names[0] || '' : $t`${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;
}

// ======================= mått (världskoordinater) =======================
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till lokalen
const W = 480, H = 216;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const WALL_Y = 84;                                    // där golvet möter bakväggen
const WIN = { x0: 16, x1: 172, t: 18, b: 64, mid: 94 }; // stora fönstret mot gatan (glaset)
const SHELF = { x0: 12, x1: 176, y: 69 };             // bardisken under fönstret (skivan, där saker står)
const DOOR = { x0: 184, x1: 212, top: 24 };           // glasdörren ut
const DOOR_SPOT = [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 7];
const ZAP = { x0: 216, x1: 234, y0: 10, y1: 20 };     // flugfångaren
const POSTER = { x0: 216, x1: 234, y0: 25, y1: 47 };  // den solblekta affischen
const KLOCKA = { x: 225, y: 60 };                     // väggklockan
const CNT = { x0: 238, x1: 446, top: 96, face: 103, y: 118 }; // disken (golvkant y)
const BACK = { x0: 238, x1: 414, top: 66, y: 86 };    // bakdisken (rostfri) mot väggen
const HOOD = { x0: 242, x1: 292, y0: 16, y1: 30 };    // fläktkåpan över spetten
const SPITS = [{ x: 256, kind: 'kott' }, { x: 282, kind: 'kyckling' }];
const FRY = { x0: 302, x1: 334, top: 52 };            // fritösen på bakdisken
const MICRO = { x0: 380, x1: 406, top: 50 };          // mikron (12:00 blinkar)
const FRIDGE = { x0: 416, x1: 446, top: 20 };         // läskkylen bakom disken
const MENU = { x0: 294, x1: 414, y0: 4, y1: 47 };     // ljusskylten med menyn (fyra rutor à 29 px)
const TV = { x0: 448, x1: 476, y0: 7, y1: 27 };       // tv:n på väggarmen
const SLOT = { x0: 448, x1: 474, top: 76, y: 118 };   // spelautomaten (trasig)
const SALAD = { x0: 248, x1: 326 };                   // salladsbaren under glaset
const REG = { x0: 353, x1: 373 };                     // kassan
const PAY_X = 386, ORDER_Y = 127;                     // där man står och beställer
const QPOS = [406, 422, 438];                         // gästernas kö bakom den som beställer
const COOK_FRONT = 106, COOK_BACK = 91;               // grillkockens fötter: vid disken / vid bakdisken
const FRY_X = 318, FRIDGE_X = 431, SALAD_X = 288, SAUCE_X = 330;
const STOOLS = [48, 92, 136], STOOL_Y = 100;          // barstolarna vid fönstret
const TABLES = [{ id: 't1', x: 64, y: 154 }, { id: 't2', x: 156, y: 184 }, { id: 't3', x: 302, y: 172 }];
const DRAIN = { x: 236, y: 146 };                     // golvbrunnen
const BIN = { x: 228, y: 106 };                       // soptunnan vid dörren
const PLANT = { x: 11, y: 110 };                      // plastfikusen
const SIGN = { x: 436, y: 152 };                      // HALT GOLV-skylten
const MOP = { x: 22, y: 206 };                        // moppen i hinken (hörnet närmast oss)
const CRATES = { x: 458, y: 208 };                    // läskbackar som ingen burit in på lagret
const TUBES = [{ x: 44, broken: true }, { x: 148, broken: false }]; // lysrören i taket (över borden)

// ======================= små målarverktyg =======================
const WHITE = 0xffffff;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const c100 = (v) => clamp(v, 0, 100);
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
function rowsOf(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) area(P, x, y + i, w, 1, (X, Y) => jit(c, X, Y, 9 + i, 0.05)); }); }
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
// glasreflex: diagonala strimmor och ljusare överkant
function reflect(P, x, y, w, h, night, str = 1, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    const s = ((((X + seed) * 2 - Y * 3) % 56) + 56) % 56;
    let a = s < 4 ? 0.22 : s < 6 ? 0.09 : s === 11 || s === 12 ? 0.08 : 0;
    a += (1 - j / h) * 0.05;
    if (a > 0) P.px(X, Y, night ? 0xffd8a0 : 0xf2f8ff, a * str * (night ? 0.35 : 1));
  }
}
// text som bitmapp (valfritt spegelvänd) med kontur, skugga och högdager
function textMask(F, s, mirror = false) {
  const w = textW(F, s), pts = [];
  eachTextPixel(F, s, 0, 0, 1, (x, y) => pts.push([mirror ? w - 1 - x : x, y]));
  return { w, pts, set: new Set(pts.map(([a, b]) => a + ',' + b)) };
}
function drawText(P, M, x, y, o) {
  const has = (a, b) => M.set.has(a + ',' + b);
  if (o.shadow !== undefined) for (const [a, b] of M.pts) if (!has(a + 1, b + 1)) P.px(x + a + 1, y + b + 1, o.shadow, o.sa ?? 0.6);
  if (o.out !== undefined) for (const [a, b] of M.pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(a + dx, b + dy)) P.px(x + a + dx, y + b + dy, o.out, o.oa ?? 1);
  for (const [a, b] of M.pts) {
    let c = typeof o.fill === 'function' ? o.fill(a, b) : o.fill;
    if (o.hi !== undefined && !has(a, b - 1)) c = o.hi;
    else if (o.lo !== undefined && !has(a, b + 1)) c = o.lo;
    P.px(x + a, y + b, c, o.a ?? 1);
  }
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

// ======================= färgerna (grillens stil) =======================
const STEEL = { hi: 0xf0f2f4, base: 0xc4c9cf, mid: 0x9aa1a9, lo: 0x6e757e, dk: 0x444a52 };
const ALU = { hi: 0xe8ecf0, base: 0xb4bac2, mid: 0x9098a2, lo: 0x6a727c, dk: 0x3e444c };
const KAKEL = { base: 0xece2cc, alt: 0xe2d6bc, fog: 0xb0a48c };
const BRUN = { base: 0xa65e3a, alt: 0x965230, fog: 0x683820 };
const RODA = { hi: 0xe8504a, base: 0xc8302a, lo: 0x8e1e1a, dk: 0x5a1210 };
const CHAIR = { hi: 0xf2584e, base: 0xd8202a, lo: 0xa0161e, dk: 0x6a0e14 };
const FOIL = { hi: 0xf6f8fa, base: 0xc6ccd4, lo: 0x8c94a0, dk: 0x5c6470 };
const PAPER = { hi: 0xfcf8ee, base: 0xece4d2, lo: 0xc8bca4, dk: 0x8a7e68 };
const SAUCE = { vitlok: [0xf6f2e4, 0xe2dccb], stark: [0xe4442c, 0xa82818], mix: [0xf6f2e4, 0xe4442c] };
const CYAN = 0x3ae8ff;

// ======================= rätterna (en bild per tugga) =======================
// Kebab- och falafelrullen ligger ner: tunnbröd i folie (kebab) eller i papper med röd
// rand (falafel), fyllningen väller ut i den öppna änden med såsen ringlad över. För
// varje tugga blir rullen kortare och får ett bett i änden; uppäten = hopknycklad folie,
// en servett och en såsfläck.
function rulleImg(id, stage, bites, sauce) {
  const P = new Pix(21, 11);
  const Wc = id === 'kebab' ? FOIL : PAPER;
  const sc = SAUCE[sauce] || SAUCE.mix;
  if (stage >= bites) {
    spr(P, 9, 5, ['.hbb.', 'hbbbl', 'bbldd', '.ldd.'], { h: Wc.hi, b: Wc.base, l: Wc.lo, d: Wc.dk });
    spr(P, 3, 6, ['wwv.', 'wvvv'], { w: 0xfaf8f0, v: 0xd8d2c4 });            // servetten
    P.px(15, 8, sc[0]); P.px(16, 8, sc[1]); P.px(16, 9, sc[0]); P.px(7, 9, 0x6aa83a); // såsfläck + en salladsbit
    return P.flush();
  }
  const R = 17, L = Math.max(5, Math.round(14 - (stage / bites) * 9)), x0 = R - L + 1;
  // omslaget + tunnbrödet: liggande cylinder på raderna 4–9
  for (let y = 4; y <= 9; y++) for (let x = x0; x <= R; x++) {
    const r = y - 4;
    let c;
    if (x >= x0 + 3) {
      c = r === 0 ? Wc.hi : r === 5 ? Wc.dk : r === 4 ? Wc.lo : Wc.base;
      if (id === 'kebab') { const h = hash(x, y, 71); if (r > 0 && r < 4) { if (h > 0.8) c = Wc.hi; else if (h < 0.14) c = Wc.lo; } }
      else if (r === 2) c = (x & 1) ? 0xc83a2a : 0xd8584a;                     // papperets röda rand
    } else {
      c = r === 0 ? 0xf2d8a0 : r >= 4 ? 0xc08448 : 0xe8c080;                   // tunnbrödet i den öppna änden
      if (r > 0 && r < 4 && hash(x, y, 72) > 0.72) c = 0xb87a3a;              // rostade fläckar
    }
    P.px(x, y, c);
  }
  // folien/papperet vriden till en tofs i högra änden
  P.px(R + 1, 6, Wc.base); P.px(R + 1, 7, Wc.lo); P.px(R + 2, 5, Wc.hi); P.px(R + 2, 8, Wc.lo); P.px(R + 3, 6, Wc.lo);
  // fyllningen som väller upp ur den öppna änden
  const fillC = id === 'kebab'
    ? [0x9a5428, 0x6a3418, 0xb8703a, 0x5aa83a, 0xd83a2a, 0x8ad05a, 0xe8d0e8]
    : [0x8a6a30, 0x6a7a3a, 0xa8823a, 0x5aa83a, 0xd83a2a, 0x8ad05a, 0x6a4a1e];
  const mound = [[x0, 3], [x0 + 1, 3], [x0 + 2, 3], [x0 + 3, 3], [x0 + 1, 2], [x0 + 2, 2], [x0 - 1, 5], [x0 - 1, 6], [x0 - 1, 7], [x0, 4], [x0 + 1, 4]];
  mound.forEach(([x, y], k) => P.px(x, y, fillC[(k * 3 + stage + (hash(x, y, 73) * 7 | 0)) % fillC.length]));
  if (id === 'falafel') { P.px(x0, 5, 0x8a6a30); P.px(x0 - 1, 6, 0x6a7a3a); }  // falafelbollarna
  // såsen ringlad över fyllningen
  P.px(x0 + 1, 2, sc[0]); P.px(x0 + 2, 3, sc[1]); P.px(x0 - 1, 5, sc[0]); P.px(x0 + 3, 3, sc[0]);
  // bettet: en halvmåne ur den öppna änden
  if (stage > 0) { P.erase(x0 - 1, 2, 1, 3); P.erase(x0, 2, 1, 2); P.px(x0, 5, 0xd8a868); P.px(x0, 6, 0xe8c080); }
  outline(P);
  return P.flush();
}
// pommes i ett röd-vitt randigt pappersträg, ketchupklick vid sidan
const FRIES = [[2, 4], [3, 6], [4, 5], [5, 7], [6, 6], [7, 4], [8, 7], [9, 5], [10, 4]];
const FRY_ORDER = [4, 1, 7, 3, 6, 0, 8, 2, 5]; // vilka pommes som försvinner först
function pommesImg(stage, bites) {
  const P = new Pix(14, 13);
  const top = 8;
  const n = stage >= bites ? 0 : Math.round(FRIES.length * (1 - stage / bites));
  const gone = new Set(FRY_ORDER.slice(0, FRIES.length - n));
  FRIES.forEach(([x, h], k) => {
    if (gone.has(k)) return;
    for (let j = 0; j < h; j++) P.px(x + 1, top - j, j === h - 1 ? 0xffe68a : (x & 1) ? 0xf0b830 : 0xf8c83a);
    P.px(x + 1, top - h + 1, 0xffd060);
  });
  // tråget: ränder, smalare nertill
  for (let j = 0; j < 4; j++) {
    const inset = j >> 1;
    for (let x = 1 + inset; x <= 12 - inset; x++) {
      let c = ((x >> 1) & 1) ? 0xd83a2a : 0xf4efe2;
      if (j === 0) c = mix(c, WHITE, 0.3);
      if (j === 3) c = mul(c, 0.72);
      P.px(x, top + 1 + j, c);
    }
  }
  if (stage < bites) { P.rect(11, top - 1, 2, 2, 0xc8201a); P.px(11, top - 1, 0xf05a4a); } // ketchup
  else { P.hl(3, top, 3, 0xf0b830); P.px(8, top, 0xc8201a); P.px(9, top, 0xa8181a); }     // en ensam pommes + kladd
  outline(P);
  return P.flush();
}
// läsk: en röd burk – öppnad får den ett sugrör, urdrucken ligger den på sidan
function laskImg(stage, bites) {
  const P = new Pix(13, 15);
  if (stage >= bites) {
    area(P, 1, 10, 10, 4, (X, Y, i, j) => (i === 0 || i === 9 ? (j === 1 || j === 2 ? STEEL.base : null) : j === 0 ? 0xf05a4a : j === 3 ? 0x8e1414 : i === 4 && j > 0 && j < 3 ? 0xf4efe2 : 0xd8202a));
    P.px(5, 11, 0xa8181a); P.px(6, 12, 0xf4efe2);   // bucklan
    P.px(11, 13, 0xd8202a, 0.6);                    // en sista droppe
    outline(P);
    return P.flush();
  }
  const bx = 3;
  area(P, bx, 5, 6, 10, (X, Y, i, j) => {
    if (j === 0) return i === 0 || i === 5 ? null : STEEL.hi;
    if (j === 1) return STEEL.mid;
    if (j === 9) return i === 0 || i === 5 ? null : STEEL.lo;
    let c = 0xd8202a;
    if (j === 4 || j === 5) c = (i + j) % 3 === 0 ? 0xf4efe2 : j === 4 ? 0xf4efe2 : 0xf0c830;   // den vita vågen
    if (i === 0) c = mix(c, WHITE, 0.3); else if (i === 5) c = mul(c, 0.7);
    return c;
  });
  if (stage === 0) P.px(bx + 3, 4, STEEL.lo);                                  // öppnaren
  else { P.vl(bx + 3, 0, 5, 0xf4efe2); P.px(bx + 3, 1, 0xd83a4a); P.px(bx + 3, 3, 0xd83a4a); P.px(bx + 4, 0, 0xf4efe2); P.px(bx + 5, 0, 0xd83a4a); } // sugröret
  outline(P);
  return P.flush();
}
const dishCache = new Map();
function dishImg(id, stage, bites, sauce = 'mix') {
  const k = id + ':' + stage + ':' + bites + ':' + (id === 'kebab' || id === 'falafel' ? sauce : '');
  let c = dishCache.get(k);
  if (!c) {
    c = id === 'kebab' || id === 'falafel' ? rulleImg(id, stage, bites, sauce) : id === 'pommes' ? pommesImg(stage, bites) : laskImg(stage, bites);
    dishCache.set(k, c);
  }
  return c;
}
// Brickan: brun plastbricka med ett tryckt underlägg, rätterna ovanpå. Rullen fram till
// vänster, pommesen fram till höger, läsken bakom.
const TRAY_W = 34, TRAY_H = 22;
const trayCache = new Map();
function trayCanvas(items) {
  const key = items.map((it) => it.id + it.stage + '/' + it.bites + (it.sauce || '')).join(',');
  let F = trayCache.get(key);
  if (F) return F;
  const P = new Pix(TRAY_W, TRAY_H);
  area(P, 0, TRAY_H - 5, TRAY_W, 4, (X, Y, i, j) => (j === 0 ? 0x9a6a44 : j === 3 ? 0x3a2416 : i === 0 ? 0x8a5e3c : i === TRAY_W - 1 ? 0x4a3020 : jit(0x6e4a30, X, Y, 21, 0.06)));
  P.hl(1, TRAY_H - 1, TRAY_W - 2, 0x1a1014, 0.4);
  area(P, 2, TRAY_H - 6, TRAY_W - 4, 1, (X) => (X % 3 === 0 ? 0xd8584a : 0xf6efe0)); // underlägget
  F = P.flush();
  const x2 = F.getContext('2d');
  const n = items.length;
  const spots = n === 1 ? [[17, 0]] : n === 2 ? [[12, 0], [27, -1]] : [[11, 0], [27, 0], [22, -5]];
  const order = items.map((it, k) => ({ it, s: spots[Math.min(k, spots.length - 1)] })).sort((a, b) => a.s[1] - b.s[1]);
  for (const { it, s } of order) {
    const c = dishImg(it.id, it.stage, it.bites, it.sauce);
    x2.drawImage(c, s[0] - (c.width >> 1), TRAY_H - 5 - c.height + 1 + s[1]);
  }
  trayCache.set(key, F);
  return F;
}
// brickan i händerna (bär-bildrutorna håller armarna högt)
function drawTrayHeld(ctx, x, y, dir, items) {
  if (!items || !items.length) return;
  const c = trayCanvas(items);
  const tx = dir === 'left' ? x - c.width + 2 : dir === 'right' ? x - 1 : x - (c.width >> 1);
  ctx.drawImage(c, Math.round(tx), Math.round(y) - (dir === 'up' ? 20 : 22) - (c.height - 20));
}
// hämtpåsen: brun papperspåse med rött tryck (för dem som tar med sig maten)
let BAG = null;
function bagImg() {
  if (BAG) return BAG;
  const P = new Pix(11, 14);
  area(P, 1, 4, 9, 9, (X, Y, i, j) => (i === 0 ? 0xd8b080 : i === 8 ? 0x9a7040 : i === 2 || i === 6 ? 0xb48a54 : j === 8 ? 0x8a6038 : jit(0xc49a64, X, Y, 31, 0.08)));
  area(P, 1, 1, 9, 3, (X, Y, i, j) => (j === 0 ? ((i & 1) ? 0xe0bc8a : null) : j === 1 ? 0xe0bc8a : 0xa8804c)); // ihopvikt, tandad kant
  P.rect(4, 7, 3, 3, 0xc8302a); P.px(5, 8, 0xf4efe2);                           // grillens stämpel
  P.px(9, 5, 0x8a6038, 0.6); P.px(3, 11, 0x8a5a2a, 0.4);                        // en fettfläck
  outline(P);
  return (BAG = P.flush());
}

// ======================= bakgrunden =======================
function paintWall(P) {
  // taket: gulnade isoleringsplattor i ett galler och en gammal vattenfläck
  for (let y = 0; y < 8; y++) area(P, 0, y, W, 1, (X, Y) => {
    if (y === 6) return 0xa8a090;
    if (y === 7) return 0x6e6658;
    let c = mix(0xd6d0c0, 0xc6c0b0, y / 6);
    if (X % 40 === 0) c = 0x9a9484;
    if (hash(X, Y, 1) > 0.9) c = mul(c, 0.86);
    return jit(c, X, Y, 2, 0.04);
  });
  P.ell(146, 3, 13, 4, 0x8a6a3a, 0.35, 3); P.ell(150, 2, 6, 2, 0x6a4a24, 0.3, 2);
  // övre väggen: gulnat vitt kakel 8×8
  area(P, 0, 8, W, 44, (X, Y) => {
    const tx = X >> 3, ty = (Y - 8) >> 3;
    if (X % 8 === 7 || (Y - 8) % 8 === 7) return jit(KAKEL.fog, X, Y, 3, 0.05);
    let c = hash(tx, ty, 5) > 0.72 ? KAKEL.alt : KAKEL.base;
    if ((Y - 8) % 8 === 0 || X % 8 === 0) c = mix(c, WHITE, 0.3);
    return jit(c, X, Y, 4, 0.035);
  });
  // röd bård med små kakel
  area(P, 0, 52, W, 4, (X, Y, i, j) => (j === 3 || X % 4 === 3 ? RODA.lo : jit(j === 0 ? RODA.hi : RODA.base, X, Y, 5, 0.05)));
  // nedre väggen: brunt klinkerkakel 12×8 i förband
  area(P, 0, 56, W, WALL_Y - 60, (X, Y) => {
    const row = (Y - 56) >> 3, off = row & 1 ? 6 : 0;
    if ((X + off) % 12 === 11 || (Y - 56) % 8 === 7) return jit(BRUN.fog, X, Y, 6, 0.05);
    let c = hash(((X + off) / 12) | 0, row, 6) > 0.5 ? BRUN.base : BRUN.alt;
    if ((Y - 56) % 8 === 0) c = mix(c, WHITE, 0.16);
    return jit(c, X, Y, 7, 0.06);
  });
  rowsOf(P, 0, WALL_Y - 4, W, [0x5a3a26, 0x3a2418, 0x2a1a10, 0x1a100a]); // sockeln
  // sunkigt: spricka i kaklet, en bortfallen platta, smuts vid dörren och soptunnan
  P.line(6, 12, 11, 20, 0x8a7e68); P.line(11, 20, 9, 27, 0x8a7e68); P.px(12, 21, 0x9a8e78);
  area(P, 216, 72, 12, 7, (X, Y) => jit(0x8a8478, X, Y, 8, 0.22));
  P.hl(216, 72, 12, 0x4a4640); P.vl(216, 73, 6, 0x4a4640); P.px(221, 75, 0x6a665e); P.px(224, 77, 0x6a665e);
  P.ell(228, 76, 10, 5, 0x3a2a1a, 0.18, 3); P.ell(198, 78, 18, 4, 0x3a2a1a, 0.12, 3);
  for (const T of TUBES) P.ell(T.x + 0.5, 20, 22, 8, 0xf4f8ff, 0.14, 3); // lysrörens sken på väggen
}
// lysrören som hänger i taket – ritas framför halsduken och fönstret
function paintTubes() {
  const P = new Pix(W, 16);
  for (const T of TUBES) {
    P.vl(T.x - 13, 6, 3, 0x4a4a4a); P.vl(T.x + 13, 6, 3, 0x4a4a4a);
    P.rect(T.x - 16, 9, 33, 3, 0xd8d8d2); P.hl(T.x - 16, 9, 33, 0xf0f0ea); P.hl(T.x - 16, 11, 33, 0x8a8a84);
    P.hl(T.x - 15, 12, 31, 0xf8fcff); P.hl(T.x - 15, 13, 31, 0xd8e4ec);
    P.px(T.x - 16, 12, 0x8a8a84); P.px(T.x + 16, 12, 0x8a8a84);
  }
  return P.flush();
}

// Utsikten genom fönstret och dörren: betonghuset mitt emot med balkonger, björkar,
// en parkerad Volvo, gatan och trottoaren. Målas i en egen bild och kopieras in där
// det är glas.
function paintOutside(P, night) {
  const OW = 214, O = new Pix(OW, WALL_Y);
  const sky = night ? [0x0e1430, 0x1c2650] : [0x8ec0e4, 0xd0e4f0];
  area(O, 0, 0, OW, WALL_Y, (X, Y) => {
    if (Y < 37) return qmix(sky[0], sky[1], Y / 37, X, Y, 3);
    if (Y < 40) return jit(night ? 0x14241a : (hash(X >> 1, Y, 5) > 0.5 ? 0x4a7a3a : 0x5a8a44), X, Y, 6, 0.12); // gräsremsan
    if (Y < 43) return jit(night ? 0x34343a : 0xa8a49a, X, Y, 7, 0.07);                                           // bortre trottoaren
    if (Y < 54) { let c = jit(night ? 0x222228 : 0x4a4a52, X, Y, 8, 0.1); if (Y === 48 && X % 14 < 7) c = night ? 0x8a8470 : 0xe8e2c8; return c; }
    if (Y < 55) return night ? 0x6a6660 : 0xd8d2c4;                                                               // kantsten
    if (Y < 56) return night ? 0x3a3834 : 0x8a8478;
    const r = Y - 56, jy = r % 9 === 0, jx = ((X + ((r / 9) & 1) * 7) % 15) === 0;                                 // betongplattor
    let c = jx || jy ? 0x8a8680 : jit(hash(X >> 3, Y >> 2, 9) > 0.5 ? 0xb8b4ac : 0xb0aca4, X, Y, 10, 0.08);
    if (night) c = mix(mul(c, 0.4), 0xffb070, 0.1 + clamp((Y - 60) / 30, 0, 1) * 0.28);
    return c;
  });
  // betonghuset mitt emot: element, fönster, balkonger i blått och orange, en parabol
  const bx0 = 6, bx1 = 150, byB = 37;
  area(O, bx0, 0, bx1 - bx0, byB, (X, Y, i, j) => {
    const ex = (X - bx0) % 18, ey = (Y + 4) % 9;
    let c = hash((X - bx0) / 18 | 0, (Y + 4) / 9 | 0, 11) > 0.5 ? 0xb8b2a8 : 0xaea89e;
    if (ex === 0 || ey === 0) c = 0x8a857c;                                 // elementfogarna
    if (night) c = mul(c, 0.32);
    if (hash(X, Y >> 2, 12) > 0.93) c = mul(c, 0.9);                        // rinnränder
    return jit(c, X, Y, 13, 0.05);
  });
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
    const wx = bx0 + 5 + col * 18, wy = -4 + row * 9 + 2;
    const lit = night && hash(col, row, 14) > 0.42;
    const wc = night ? (lit ? (hash(col, row, 15) > 0.5 ? 0xffd890 : 0xffecb8) : 0x141a28) : 0x4e6478;
    O.rect(wx, wy, 7, 4, wc);
    if (!night) { O.px(wx, wy, 0x9ab4c8); O.px(wx + 1, wy, 0x8aa4b8); }
    else if (lit && hash(col, row, 16) > 0.6) O.rect(wx + 4, wy, 3, 4, 0xe8a060);  // gardin
    if ((col + row) % 2 === 0 && row > 0) {                                        // balkongen
      const bc = [0x5a8ac0, 0xe0903a, 0x5a8ac0, 0xd8d0c0][(col + row * 3) % 4];
      O.rect(wx - 2, wy + 4, 11, 3, night ? mul(bc, 0.35) : bc); O.hl(wx - 2, wy + 4, 11, night ? mul(bc, 0.5) : mix(bc, WHITE, 0.3));
      if (hash(col, row, 17) > 0.6) for (let k = 0; k < 3; k++) O.px(wx + 1 + k * 2, wy + 3, [0xf4efe2, 0xd83a2a, 0x3a7bd5][k]); // tvätt
    }
  }
  O.ell(118, 3, 3, 3, night ? 0x3a3e44 : 0xe0e4e8, 1, 1); O.px(119, 4, 0x6a707a);   // parabolen
  // låga huset till höger: tegel med LIVS-skylt
  area(O, 152, 16, OW - 152, byB - 16, (X, Y, i, j) => {
    if (j < 2) return night ? 0x2a2420 : 0x5a4a40;
    let c = ((Y + (((X >> 2) & 1) ? 0 : 1)) % 3 === 0) ? 0x7a3a2a : 0x9a4a36;
    if (X % 8 === 0 && Y % 3 !== 0) c = 0x6a3024;
    return night ? mul(c, 0.35) : jit(c, X, Y, 18, 0.06);
  });
  O.rect(160, 20, 22, 7, 0xf4efe2); O.box(160, 20, 22, 7, 0xc8302a);
  text(O, SMALL, $t('LIVS'), 164, 21, 0xc8302a);
  if (night) O.ell(171, 23, 14, 6, 0xfff4d0, 0.25, 3);
  O.rect(158, 29, 30, 8, night ? 0xe8c878 : 0x3a4a58); if (!night) O.hl(158, 29, 30, 0x7a9ab0);
  // björkarna i gräsremsan
  for (const tx of [52, 138]) {
    for (let y = 18; y < 39; y++) O.px(tx, y, (y % 4 === 1) ? 0x2a2a2a : night ? 0x8a8a84 : 0xf0f0ea);
    O.px(tx + 1, 30, night ? 0x6a6a64 : 0xd8d8d2);
    for (let k = 0; k < 26; k++) {
      const lx = tx + Math.round((hash(tx, k, 19) - 0.5) * 14), ly = 12 + Math.round(hash(k, tx, 20) * 12);
      O.px(lx, ly, night ? 0x1a2a1a : [0x6ab04a, 0x4a8a34, 0x8ac85a][k % 3]);
    }
  }
  // en parkerad gammal Volvo vid bortre trottoaren
  const vx = 64, vy = 42;
  area(O, vx, vy, 34, 7, (X, Y, i, j) => {
    if (j < 3) return i > 7 && i < 25 ? (i === 8 || i === 24 ? 0x6a1e1e : night ? 0x20283a : 0x8ab0c8) : null;
    if (j === 3) return 0xa83a34;
    return jit(j === 6 ? 0x5a1a1a : 0x8a2a2a, X, Y, 22, 0.06);
  });
  for (const wx of [vx + 7, vx + 27]) { O.rect(wx - 2, vy + 5, 5, 3, 0x141418); O.px(wx, vy + 6, 0x9a9aa0); }
  O.px(vx + 33, vy + 4, night ? 0xfff6b0 : 0xe8e4d0); O.px(vx, vy + 4, 0xd83a2a);
  // lyktstolpe
  O.vl(122, 16, 22, night ? 0x1a2420 : 0x4a5058); O.rect(119, 14, 7, 2, night ? 0x2a3430 : 0x5a6068); O.rect(120, 16, 5, 1, night ? 0xffe6a0 : 0xd8d8d0);
  if (night) { O.ell(122, 18, 9, 6, 0xffd890, 0.4); O.ell(122, 40, 10, 3, 0xffd890, 0.28); }
  // grillens eget sken på trottoaren i kväll
  if (night) O.ell(94, 74, 90, 10, 0xffc27a, 0.22);
  const glass = (X, Y) => (X >= WIN.x0 && X < WIN.x1 && Y >= WIN.t && Y < WIN.b) || (X >= DOOR.x0 && X < DOOR.x1 && Y >= DOOR.top && Y < WALL_Y);
  for (let y = 12; y < WALL_Y; y++) for (let x = 0; x < OW; x++) if (glass(x, y)) P.px(x, y, O.get(x, y));
}

// Fönstrets aluminiumfoder, mittposten, GRILL-neonet baklänges (R:et dött), klistermärken,
// smuts i nederkanten, halsduken ovanför och bardisken under – ovanpå folket utanför.
function paintWinOverlay(night) {
  const P = new Pix(214, 84);
  const { x0, x1, t, b, mid } = WIN, ww = x1 - x0, wh = b - t;
  for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) P.px(x0 + i, t + j, night ? 0x1a1030 : 0xb8d8e0, 0.08);
  reflect(P, x0, t, ww, wh, night, 1, 7);
  // smutsen längs glasets nederkant
  for (let j = 0; j < 4; j++) for (let i = 0; i < ww; i++) if (bayer(x0 + i, b - 1 - j) < 0.5 - j * 0.1) P.px(x0 + i, b - 1 - j, 0x6a5a3a, 0.28);
  // aluminiumfodret runt glaset + mittposten
  area(P, x0 - 4, t - 4, ww + 8, wh + 8, (X, Y, i, j) => {
    const e = Math.min(i, j, ww + 7 - i, wh + 7 - j);
    if (e > 3) return null;
    return [ALU.dk, ALU.hi, ALU.base, ALU.mid][e];
  });
  P.rect(mid - 1, t, 3, wh, ALU.base); P.vl(mid - 1, t, wh, ALU.hi); P.vl(mid + 1, t, wh, ALU.lo);
  // GRILL-neonet baklänges i högra rutan (R:et är dött – som på fasaden)
  const M = textMask(BIG, $t('GRILL'), true), nx = ((mid + x1) >> 1) - (M.w >> 1), ny = t + 10;
  const dead = (a) => a >= M.w - 11 && a < M.w - 5; // R:et (andra bokstaven) sitter spegelvänt här
  for (const [a, bb] of M.pts) if (!dead(a)) P.ell(nx + a + 0.5, ny + bb + 0.5, 3, 3, CYAN, night ? 0.16 : 0.08, 2);
  drawText(P, M, nx, ny, { fill: (a) => (dead(a) ? 0x5a6a70 : night ? 0xd8fcff : 0x9af4ff), out: 0x1a8aa8, oa: 0.55 });
  P.px(nx + 2, ny - 5, 0x3a3a40); P.px(nx + M.w - 3, ny - 5, 0x3a3a40);                 // kedjorna
  for (let k = 1; k < 5; k++) { P.px(nx + 2, ny - 5 + k, 0x5a5a60, 0.8); P.px(nx + M.w - 3, ny - 5 + k, 0x5a5a60, 0.8); }
  // klistermärken: öppettider (baklänges) och ett kortmärke
  const om = textMask(SMALL, '11-24', true);
  P.rect(x0 + 4, b - 12, om.w + 6, 9, 0xf6f2e8); P.box(x0 + 4, b - 12, om.w + 6, 9, 0xc8302a);
  drawText(P, om, x0 + 7, b - 10, { fill: 0x2a2a2a });
  P.rect(mid - 16, b - 10, 11, 7, 0x2a5ab8); P.rect(mid - 15, b - 8, 9, 2, 0xf0c020); P.px(mid - 14, b - 5, 0xf4efe2);
  // halsduken ovanför fönstret: Betong IF i blått och gult, fransar i ändarna
  const sx0 = x0 + 6, sx1 = x1 - 6, sy = 9;
  for (let x = sx0; x <= sx1; x++) {
    const u = (x - sx0) / (sx1 - sx0), sag = Math.round(Math.sin(u * Math.PI) * 3);
    for (let j = 0; j < 5; j++) {
      let c = (((x - sx0) >> 2) & 1) ? 0xf0c020 : 0x2a5ab8;
      if (j === 0) c = mix(c, WHITE, 0.25); else if (j === 4) c = mul(c, 0.72);
      P.px(x, sy + sag + j, c);
    }
  }
  const tm = textMask(SMALL, $t('BETONG IF')), tx = ((sx0 + sx1) >> 1) - (tm.w >> 1);
  P.rect(tx - 2, sy + 3, tm.w + 4, 6, 0x2a5ab8);
  drawText(P, tm, tx, sy + 3, { fill: 0xf4efe2 });
  for (const fx of [sx0, sx1]) for (let k = -1; k <= 1; k++) P.vl(fx + k * 2, sy + 5, 4, k & 1 ? 0xf0c020 : 0x2a5ab8);
  P.px(sx0 + 1, sy, 0x8a8a8a); P.px(sx1 - 1, sy, 0x8a8a8a);                                  // häftstiften
  // bardisken: laminat i ljust trä med konsoler under
  const { x0: s0, x1: s1, y: sy2 } = SHELF;
  area(P, s0, sy2 - 2, s1 - s0, 3, (X, Y, i, j) => jit(j === 0 ? 0xe0b884 : 0xc8985e, X, Y, 23, 0.07));
  area(P, s0, sy2 + 1, s1 - s0, 3, (X, Y, i, j) => (j === 2 ? 0x5a3a20 : jit(0x9a6a3a, X, Y, 24, 0.07)));
  for (const kx of [30, 94, 158]) { P.line(kx, sy2 + 4, kx, sy2 + 9, 0x2a2a2e); P.line(kx + 1, sy2 + 4, kx + 5, sy2 + 4, 0x2a2a2e); P.line(kx + 1, sy2 + 8, kx + 5, sy2 + 4, 0x3a3a40); }
  // servettställ, salt och peppar, ketchupflaska – mellan platserna
  P.rect(18, sy2 - 8, 7, 6, STEEL.base); P.hl(18, sy2 - 8, 7, STEEL.hi); P.rect(19, sy2 - 10, 5, 2, 0xfaf8f0); P.vl(24, sy2 - 7, 5, STEEL.lo);
  P.rect(78, sy2 - 5, 2, 4, 0xf4f4f0); P.px(78, sy2 - 6, STEEL.mid); P.rect(81, sy2 - 5, 2, 4, 0x3a3a3a); P.px(81, sy2 - 6, STEEL.mid);
  P.rect(166, sy2 - 8, 4, 7, 0xd8202a); P.px(166, sy2 - 8, 0xf05a4a); P.rect(167, sy2 - 10, 2, 2, 0xf4efe2);
  outline(P, 0x1c1814);
  return P.flush();
}

// dörrens omfattning i aluminium, nödutgångsskylten ovanför och dörrmattan
function paintDoorSurround(P) {
  const d0 = DOOR.x0, d1 = DOOR.x1;
  for (let i = 0; i < 3; i++) {
    const c = [ALU.dk, ALU.hi, ALU.mid][i];
    P.vl(d0 - 3 + i, DOOR.top - 3, WALL_Y - DOOR.top + 3, c); P.vl(d1 + 2 - i, DOOR.top - 3, WALL_Y - DOOR.top + 3, c);
    P.hl(d0 - 3, DOOR.top - 3 + i, d1 - d0 + 6, c);
  }
  // NÖDUTGÅNG: grön skylt med springande gubbe och pil
  const ex = ((d0 + d1) >> 1) - 8, ey = 10;
  P.rect(ex, ey, 17, 9, 0x1a8a3a); P.box(ex, ey, 17, 9, 0x0e5a24); P.hl(ex + 1, ey + 1, 15, 0x3ab85a);
  spr(P, ex + 3, ey + 2, ['.w..', 'www.', '.w.w', 'w.w.', '..w.'], { w: 0xf4fff4 });
  spr(P, ex + 10, ey + 3, ['.w.', 'www', '.w.'], { w: 0xf4fff4 });
  P.ell(ex + 8.5, ey + 4.5, 12, 7, 0x6aff9a, 0.1, 2);
  // flugfångaren: svart ram, två lila-blå UV-rör bakom ett glest galler, uppsamlingsbricka
  const { x0: z0, x1: z1, y0: zy0, y1: zy1 } = ZAP, zw = z1 - z0, zh = zy1 - zy0;
  P.ell((z0 + z1) / 2, (zy0 + zy1) / 2 + 1, 17, 10, 0x8a7aff, 0.2, 3);                  // skenet på kaklet
  P.rect(z0, zy0, zw, zh, 0x1c1c24); P.hl(z0, zy0, zw, 0x4a4a56);
  P.rect(z0 + 2, zy0 + 2, zw - 4, zh - 4, 0x2a2468);
  for (const ry of [zy0 + 3, zy0 + 6]) { P.hl(z0 + 2, ry, zw - 4, 0xd0c8ff); P.hl(z0 + 2, ry + 1, zw - 4, 0x8a7aff); }
  for (let x = z0 + 3; x < z1 - 2; x += 3) P.vl(x, zy0 + 2, zh - 4, 0x5a5a68);
  P.rect(z0, zy0 + 1, 2, zh - 2, 0x3a3a46); P.rect(z1 - 2, zy0 + 1, 2, zh - 2, 0x3a3a46);  // ändlocken
  P.rect(z0 - 1, zy1 - 1, zw + 2, 2, 0x4a4a54); P.hl(z0 - 1, zy1 - 1, zw + 2, 0x7a7a86);  // brickan
  for (let k = 0; k < 4; k++) P.px(z0 + 3 + k * 4, zy1 - 2, 0x0a0a0a);                    // döda flugor i brickan
  // den solblekta affischen: hav, sol och vita hus – tejpad i hörnen, ett hörn lossnat
  const { x0: p0, x1: p1, y0: py0, y1: py1 } = POSTER, pw = p1 - p0, ph = py1 - py0;
  area(P, p0, py0, pw, ph, (X, Y, i, j) => {
    let c;
    if (j < 9) c = qmix(0x6ab0e0, 0xb8e0f0, j / 9, X, Y, 2);
    else if (j < 13) c = (i + j) % 5 === 0 ? 0x9ad0f0 : 0x2a8ac8;
    else if (j < 17) c = (i % 6 < 4) ? 0xfafaf4 : 0x3a6ab8;
    else c = 0xe8d0a0;
    if (Math.hypot(i - 13, j - 4) < 2.6) c = 0xffe060;
    return mix(c, 0xf8f4e8, 0.38);                                                      // solblekt
  });
  area(P, p0 + 2, py1 - 5, pw - 4, 3, (X, Y, i, j) => (j === 1 && i % 2 === 0 ? 0x5a6a8a : null));
  for (const [tx, ty] of [[p0, py0], [p1 - 2, py0], [p0, py1 - 2]]) P.rect(tx, ty, 2, 2, 0xe8e4d4, 0.85);
  P.erase(p1 - 3, py1 - 3, 3, 3); P.px(p1 - 3, py1 - 1, 0xd0c8b0); P.px(p1 - 2, py1 - 2, 0xd0c8b0); P.px(p1 - 1, py1 - 3, 0xd0c8b0);
  // väggklockan (visarna ritas live)
  const cx = KLOCKA.x, cy = KLOCKA.y;
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const r = Math.hypot(x, y);
    if (r > 6.3) continue;
    P.px(cx + x, cy + y, r > 5.2 ? 0x2a2a2e : r > 4.6 ? 0xc8c8c8 : 0xf8f6f0);
  }
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(cx + Math.sin(a) * 4), Math.round(cy - Math.cos(a) * 4), k % 3 ? 0xa8a8a8 : 0x2a2a2e); }
}

// Köket bakom disken: rostfri stänkskärm, fläktkåpan med kanalen, spettmaskinerna med
// värmeelementen (köttkonerna snurrar live), fritösen, brödstapeln, såshinkarna, mikron
// och bakdiskens skåpluckor.
function paintKitchen(P) {
  // stänkskärmen i borstat stål (med fettstänk vid fritösen)
  area(P, CNT.x0, 40, W - 34 - CNT.x0, BACK.top - 40, (X, Y) => {
    const s = hash(X, (Y / 9) | 0, 40);                                           // borstade strimmor
    let c = s > 0.82 ? mix(STEEL.base, STEEL.hi, 0.6) : s < 0.14 ? mix(STEEL.base, STEEL.mid, 0.6) : STEEL.base;
    const k = (X - CNT.x0) % 44;
    if (k === 0) c = STEEL.lo; else if (k === 1) c = STEEL.hi;                    // skarvarna mellan plåtarna
    return jit(c, X, Y, 40, 0.04);
  });
  P.hl(CNT.x0, 40, W - 34 - CNT.x0, STEEL.hi);
  for (let k = 0; k < 40; k++) { const x = FRY.x0 - 4 + (hash(k, 1, 41) * 42 | 0), y = 42 + (hash(k, 2, 41) * 12 | 0); P.px(x, y, 0x8a6a2a, 0.35); }
  // fläktkanalen upp i taket
  area(P, 262, 0, 16, HOOD.y0, (X, Y, i) => jit(i === 0 ? STEEL.hi : i === 15 ? STEEL.lo : STEEL.base, X, Y, 42, 0.04));
  P.hl(262, 8, 16, STEEL.mid); P.hl(262, 9, 16, STEEL.hi);
  // kåpan: trapets, smalare upptill, filtergaller i underkanten och fettränder
  for (let y = HOOD.y0; y < HOOD.y1; y++) {
    const inset = Math.floor((HOOD.y1 - 3 - y) / 3), j = y - HOOD.y0;
    for (let x = HOOD.x0 + inset; x < HOOD.x1 - inset; x++) {
      let c = j === 0 ? STEEL.hi : (x === HOOD.x0 + inset ? STEEL.hi : x === HOOD.x1 - inset - 1 ? STEEL.lo : STEEL.base);
      if (y >= HOOD.y1 - 3) c = y === HOOD.y1 - 3 ? STEEL.hi : y === HOOD.y1 - 1 ? STEEL.dk : ((x & 1) ? 0x3a3e46 : STEEL.mid);
      if (y < HOOD.y1 - 3 && hash(x, 3, 43) > 0.9 && j > 3) c = mix(c, 0x8a6a2a, 0.35);
      P.px(x, y, jit(c, x, y, 44, 0.03));
    }
  }
  // spettmaskinerna: värmeelement med glödande rutnät, motorhus upptill, droppskål nertill
  for (const S of SPITS) {
    const cx = S.x;
    area(P, cx - 8, 31, 17, 32, (X, Y, i, j) => {
      if (i === 0 || i === 16 || j === 0 || j === 31) return STEEL.dk;
      if (i === 1 || j === 1) return 0x2a1a14;
      const gx = (i - 2) % 3, gy = (j - 2) % 4;
      if (gx === 2 || gy === 3) return 0x3a1a10;
      return qmix(0xff9a3a, 0xc8401a, Math.abs(i - 8) / 8, X, Y, 3);
    });
    P.rect(cx - 6, 27, 13, 4, STEEL.base); P.hl(cx - 6, 27, 13, STEEL.hi); P.hl(cx - 6, 30, 13, STEEL.lo); P.px(cx + 4, 28, 0xd8302a);
    P.rect(cx - 9, 62, 19, 4, STEEL.base); P.hl(cx - 9, 62, 19, STEEL.hi); P.rect(cx - 7, 63, 15, 2, 0x5a3418); P.hl(cx - 6, 63, 13, 0x8a5a2a);
  }
  // bakdisken: rostfria skåpluckor med handtag
  area(P, BACK.x0, BACK.top, BACK.x1 - BACK.x0, 3, (X, Y, i, j) => jit([STEEL.hi, STEEL.base, STEEL.mid][j], X, Y, 45, 0.03));
  area(P, BACK.x0, BACK.top + 3, BACK.x1 - BACK.x0, BACK.y - BACK.top - 5, (X, Y, i, j) => {
    const k = (X - BACK.x0) % 29;
    if (k === 0) return STEEL.lo;
    if (k === 1) return STEEL.hi;
    return jit((X % 4 === 0) ? STEEL.mid : STEEL.base, X, Y, 46, 0.04);
  });
  for (let x = BACK.x0 + 24; x < BACK.x1; x += 29) { P.vl(x, BACK.top + 7, 6, STEEL.dk); P.vl(x + 1, BACK.top + 7, 6, STEEL.hi); }
  rowsOf(P, BACK.x0, BACK.y - 2, BACK.x1 - BACK.x0, [0x2a2a2e, 0x1a1a1e]);
  // fritösen: två oljekar med korgarna (korgarna och bubblorna ritas live)
  const { x0: f0, x1: f1, top: ft } = FRY;
  area(P, f0, ft, f1 - f0, BACK.top - ft, (X, Y, i, j) => (j === 0 ? STEEL.hi : i === 0 ? STEEL.hi : i === f1 - f0 - 1 ? STEEL.lo : jit(STEEL.base, X, Y, 47, 0.04)));
  for (const kx of [f0 + 3, f0 + 17]) { P.rect(kx, ft + 1, 12, 3, 0xc88a28); P.hl(kx, ft + 1, 12, 0xe8b040); P.box(kx - 1, ft, 14, 5, STEEL.dk); }
  for (let k = 0; k < 4; k++) P.px(f0 + 5 + k * 7, ft + 9, 0x1a1a1e);
  P.hl(f0 + 2, ft + 12, f1 - f0 - 4, STEEL.mid);
  // brödstapeln (tunnbröd i påsar) och såshinkarna
  for (let k = 0; k < 5; k++) { P.rect(338, 64 - k * 2, 18, 2, k & 1 ? 0xe8cc98 : 0xf0d8a8); P.hl(338, 65 - k * 2, 18, 0xc8a870); }
  P.hl(338, 55, 18, 0xe8eef2, 0.6); P.vl(337, 56, 10, 0xe8eef2, 0.4);
  for (const [tx, lid] of [[359, 0xf4f0e4], [369, 0xd8302a]]) { P.rect(tx, 58, 8, 8, 0xf4f4f0); P.vl(tx + 7, 58, 8, 0xc8c8c0); P.rect(tx - 1, 56, 10, 2, lid); P.hl(tx - 1, 56, 10, mix(lid, WHITE, 0.4)); }
  // mikron: gulnad vit låda, mörk lucka, displayen (12:00 blinkar live)
  const { x0: m0, x1: m1, top: mt } = MICRO;
  area(P, m0, mt, m1 - m0, BACK.top - mt, (X, Y, i, j) => (j === 0 ? 0xf4f0e0 : i === m1 - m0 - 1 ? 0xa8a490 : j === BACK.top - mt - 1 ? 0x8a8674 : jit(0xe0dcc8, X, Y, 48, 0.05)));
  P.rect(m0 + 2, mt + 2, 15, 12, 0x2a2a28); P.hl(m0 + 3, mt + 3, 6, 0x5a5a58); P.px(m0 + 3, mt + 4, 0x4a4a48);
  P.rect(m0 + 18, mt + 3, 7, 4, 0x0a1a0a);
  for (let k = 0; k < 6; k++) P.px(m0 + 19 + (k % 3) * 2, mt + 9 + (k / 3 | 0) * 2, 0x6a6a64);
}

// Läskkylen: röd kyl med ljus topskylt, glasdörr, burkar i rader. open = dörren uppe
function paintFridge(open) {
  const { x0, x1, top } = FRIDGE, w = x1 - x0, h = BACK.y - top;
  const P = new Pix(w + 8, h + 1);
  area(P, 0, 0, w, h, (X, Y, i, j) => (i === 0 ? RODA.hi : i === w - 1 ? RODA.dk : j === h - 1 ? RODA.dk : jit(RODA.base, X, Y, 50, 0.05)));
  P.rect(2, 2, w - 4, 7, 0xf8f4ea); P.box(2, 2, w - 4, 7, RODA.lo);
  text(P, SMALL, $t('LÄSK'), ((w - textW(SMALL, $t('LÄSK'))) >> 1), 3, RODA.base);
  // insidan: hyllor med burkar och flaskor
  const gx0 = 3, gx1 = w - 3, gy0 = 11, gy1 = h - 6;
  area(P, gx0, gy0, gx1 - gx0, gy1 - gy0, (X, Y) => (open ? 0xe8f4fa : 0x9ab8c8));
  const cols = [0xd8202a, 0x3a7bd5, 0xf0b429, 0x46a35a, 0xe07a2e, 0xf4f1ea, 0x8e5bd1];
  for (let s = 0; s < 5; s++) {
    const sy = gy0 + 2 + s * 11;
    if (sy + 8 > gy1) break;
    for (let k = 0; k < 4; k++) {
      const c = cols[(s * 3 + k * 5) % cols.length], cx = gx0 + 1 + k * 6;
      P.rect(cx, sy, 4, 7, c); P.vl(cx, sy, 7, mix(c, WHITE, 0.3)); P.hl(cx, sy, 4, STEEL.hi);
      if (s % 2) { P.rect(cx + 1, sy - 2, 2, 2, c); }                                    // flaskhalsar
    }
    P.hl(gx0, sy + 7, gx1 - gx0, STEEL.mid); P.hl(gx0, sy + 8, gx1 - gx0, STEEL.lo);
  }
  if (!open) {
    // glaset + handtaget
    for (let j = gy0; j < gy1; j++) for (let i = gx0; i < gx1; i++) P.px(i, j, 0xc8e8f4, 0.14);
    reflect(P, gx0, gy0, gx1 - gx0, gy1 - gy0, false, 1.1, 3);
    P.rect(gx0 - 1, gy0 + 16, 2, 14, STEEL.hi); P.vl(gx0, gy0 + 16, 14, STEEL.lo);
  } else {
    // dörren uppsvängd mot oss: en smal glasskiva i högerkanten
    area(P, w - 1, gy0 - 3, 8, gy1 - gy0 + 6, (X, Y, i, j) => (i === 0 || i === 7 ? RODA.lo : j === 0 || j === gy1 - gy0 + 5 ? RODA.base : 0xc8e8f4));
    reflect(P, w, gy0 - 2, 6, gy1 - gy0 + 4, false, 1.4, 1);
  }
  P.rect(2, h - 5, w - 4, 3, 0x1a1a1e); for (let x = 3; x < w - 3; x += 2) P.px(x, h - 4, 0x4a4a4e); // ventilationsgallret
  outline(P, 0x1a1210);
  return P.flush();
}

// Ljusskylten med menyn: KEBAB GRILL överst, fyra bakbelysta rutor med bild, namn och
// pris. dim = ett av lysrören bakom krånglar (FALAFEL-rutan blir grå)
function paintMenuBox(dim) {
  const { x0, x1, y0, y1 } = MENU, w = x1 - x0, h = y1 - y0;
  const P = new Pix(w, h);
  area(P, 0, 0, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e === 0) return ALU.dk;
    if (e === 1) return i === 1 || j === 1 ? ALU.hi : ALU.mid;
    return 0xfaf6ea;
  });
  area(P, 2, 2, w - 4, 7, (X, Y, i, j) => (j === 6 ? RODA.lo : jit(RODA.base, X, Y, 51, 0.04)));
  const tm = textMask(SMALL, $t('KEBAB GRILL'));
  drawText(P, tm, (w - tm.w) >> 1, 3, { fill: 0xfff8e8 });
  const F = P.flush(), c2 = F.getContext('2d');
  KEBAB_MENY.forEach((m, k) => {
    const px = 2 + k * 29, off = dim && k === 1, PW = 28;
    const Q = new Pix(PW + 1, 33);
    area(Q, 0, 0, PW, 33, (X, Y, i, j) => {
      let c = j < 18 ? qmix(0xfff4d8, 0xf0c070, j / 18, X, Y, 3) : 0xfbf7ec;
      if (j === 18) c = 0xe0d4bc;
      return off ? mix(mul(c, 0.6), 0x6a6a70, 0.35) : c;
    });
    if (k < 3) Q.vl(PW, 0, 33, ALU.mid);                                      // listen mellan rutorna
    const nm = textMask(SMALL, m.board), pr = textMask(SMALL, $t`${m.price}:-`);
    drawText(Q, nm, Math.max(0, (PW - nm.w) >> 1), 21, { fill: off ? 0x5a3a36 : 0x8a1a14 });
    drawText(Q, pr, (PW - pr.w) >> 1, 27, { fill: off ? 0x3a3a3a : 0x1a1a1a });
    c2.drawImage(Q.flush(), px, 9);
    const d = dishImg(m.id, 0, m.bites, 'mix');
    if (off) c2.globalAlpha = 0.55;
    c2.drawImage(d, px + ((PW - d.width) >> 1), 9 + 17 - d.height);
    c2.globalAlpha = 1;
  });
  return F;
}

// Disken: rostfri skiva, fronten i laminatträ med röd rand och sparkplåt, salladsbaren
// under glaset, såsflaskor, feferoniburk, dricksburk, kortterminal, kassan och påsarna.
function paintCounter() {
  const ox = CNT.x0 - 2, oy = 76;
  const P = new Pix(CNT.x1 - CNT.x0 + 4, CNT.y - oy + 3, ox, oy);
  const x0 = CNT.x0, x1 = CNT.x1, w = x1 - x0;
  // skivan: rostfritt
  area(P, x0, CNT.top, w, CNT.face - CNT.top, (X, Y, i, j) => (j === 0 ? STEEL.hi : jit((X % 5 === 0) ? STEEL.mid : STEEL.base, X, Y, 60, 0.04)));
  P.hl(x0, CNT.face - 1, w, STEEL.hi);
  // fronten: laminat i trä, röd rand, rostfri sparkplåt
  area(P, x0, CNT.face, w, CNT.y - CNT.face, (X, Y, i, j) => {
    if (j === 0) return STEEL.lo;
    if (j === 3 || j === 4) return j === 3 ? RODA.hi : RODA.base;
    if (Y >= CNT.y - 4) return Y === CNT.y - 4 ? STEEL.hi : Y === CNT.y - 1 ? STEEL.dk : jit(STEEL.base, X, Y, 61, 0.06);
    let c = mix(0x9a6a40, 0x7a4e2c, hash(X >> 3, Y, 62) * 0.5);
    if (hash(X, Y >> 1, 63) > 0.86) c = mul(c, 0.82);                      // ådringen
    if ((X - x0) % 52 === 0) c = 0x4a2e18; else if ((X - x0) % 52 === 1) c = 0xb8885a;
    return c;
  });
  P.vl(x0, CNT.top, CNT.y - CNT.top, STEEL.dk); P.vl(x1 - 1, CNT.top, CNT.y - CNT.top, STEEL.dk);
  // skavanker och klistermärken: KORT OK och ett halvt bortrivet
  P.hl(x0 + 60, CNT.y - 3, 9, 0x8a8e96); P.hl(x0 + 140, CNT.y - 2, 6, 0x8a8e96);
  const km = textMask(SMALL, $t('KORT OK')), kx = REG.x0 + 2;
  P.rect(kx - 2, CNT.face + 7, km.w + 4, 7, 0xf8f6ee); P.hl(kx - 2, CNT.face + 7, km.w + 4, 0x3a7bd5);
  drawText(P, km, kx, CNT.face + 8, { fill: 0x1a3a8a });
  P.rect(x0 + 18, CNT.face + 7, 9, 6, 0xf0d040); P.erase(x0 + 23, CNT.face + 10, 4, 3); P.px(x0 + 22, CNT.face + 10, 0xd8b030);
  // feferoniburken
  area(P, 240, 86, 7, 10, (X, Y, i, j) => (j < 2 ? 0xd8302a : i === 0 || i === 6 ? 0xd8ecd8 : (hash(X, Y, 64) > 0.45 ? 0xb8d050 : 0xd8e8a0)));
  // salladsbaren: åtta rostfria kantiner
  const fills = [
    [0x9ad870, 0x6ab04a], [0xd83a2a, 0xf0604a], [0x5a9a3a, 0xd0f0a0], [0xb05a9a, 0xe8c0e0],
    [0x8a2a6a, 0xb04a8a], [0x3a7a2a, 0x8ac05a], [0xf0d040, 0xd8b030], [0x2a2a24, 0x5a5a40],
  ];
  for (let k = 0; k < 8; k++) {
    const cx0 = SALAD.x0 + 3 + k * 9;
    P.rect(cx0, 89, 9, 7, STEEL.lo); P.hl(cx0, 89, 9, STEEL.hi);
    area(P, cx0 + 1, 90, 7, 5, (X, Y, i, j) => {
      const [a, b] = fills[k];
      if (j === 0 && (hash(X, Y, 65 + k) > 0.5)) return null;                  // högen bucklar
      return hash(X, Y, 66 + k) > 0.55 ? b : a;
    });
    P.vl(cx0 + 8, 90, 6, STEEL.dk);
  }
  // nysskyddet: glasskiva med förkromad list och stolpar
  P.vl(SALAD.x0, 78, 18, STEEL.mid); P.vl(SALAD.x1, 78, 18, STEEL.lo);
  P.hl(SALAD.x0, 78, SALAD.x1 - SALAD.x0 + 1, STEEL.hi); P.hl(SALAD.x0, 79, SALAD.x1 - SALAD.x0 + 1, STEEL.mid);
  for (let y = 80; y < 89; y++) for (let x = SALAD.x0 + 1; x < SALAD.x1; x++) P.px(x, y, 0xd8f0f8, 0.16);
  reflect(P, SALAD.x0 + 1, 80, SALAD.x1 - SALAD.x0 - 1, 9, false, 1.2, 5);
  // såsflaskorna: vitlök och stark
  for (const [bx, c] of [[328, 0xf6f2e4], [332, 0xe4442c]]) { P.rect(bx, 88, 3, 8, c); P.vl(bx, 88, 8, mix(c, WHITE, 0.4)); P.px(bx + 1, 86, c); P.px(bx + 1, 87, mul(c, 0.8)); }
  // dricksburken med mynt och ett hjärta
  area(P, 336, 88, 7, 8, (X, Y, i, j) => (i === 0 || i === 6 ? 0xd8ecf4 : j > 5 ? (hash(X, Y, 67) > 0.5 ? 0xe8c040 : 0xc8ccd4) : null));
  P.hl(336, 88, 7, 0xf4fafc); P.rect(337, 90, 5, 3, 0xf8f4e8); P.px(338, 91, 0xd8302a); P.px(340, 91, 0xd8302a); P.px(339, 92, 0xd8302a);
  for (let j = 89; j < 94; j++) P.px(341, j, 0xffffff, 0.4);
  // kortterminalen
  P.rect(346, 88, 6, 8, 0x2a2a2e); P.rect(347, 89, 4, 2, 0x6ad0a0); for (let k = 0; k < 6; k++) P.px(347 + (k % 3), 92 + (k / 3 | 0) * 2, 0x8a8a90);
  // kassan: mörk låda, skärmens baksida mot oss, kunddisplayen och kvittoskrivaren
  const rx = REG.x0;
  area(P, rx, 88, 20, 8, (X, Y, i, j) => (j === 0 ? 0x6a6e76 : i === 0 ? 0x5a5e66 : i === 19 ? 0x1a1a1e : jit(0x3a3e46, X, Y, 68, 0.05)));
  P.rect(rx + 4, 80, 10, 8, 0x4a4e56); P.hl(rx + 4, 80, 10, 0x7a7e86); P.vl(rx + 8, 86, 2, 0x2a2a2e);
  P.rect(rx + 5, 76, 9, 4, 0x1a1a1e); P.rect(rx + 6, 77, 7, 2, 0x2a3a2a); P.hl(rx + 7, 77, 5, 0x6ad07a);
  P.rect(rx + 15, 84, 5, 4, 0xe8e8e4); P.rect(rx + 16, 82, 3, 2, 0xfaf8f0);
  // längst ut: en mugg med sugrör och ett servettställ
  P.rect(424, 89, 5, 7, 0xf4efe2); P.vl(428, 89, 7, 0xc8c0b0); P.hl(424, 92, 5, 0xc8302a);
  for (let k = 0; k < 4; k++) P.vl(424 + k + (k > 1 ? 1 : 0), 84 + (k & 1), 5 - (k & 1), [0xd83a2a, 0x3a7bd5, 0xf0c020, 0x46a35a][k]);
  P.rect(432, 89, 9, 7, STEEL.base); P.hl(432, 89, 9, STEEL.hi); P.vl(440, 90, 6, STEEL.lo); P.rect(433, 87, 7, 2, 0xfaf8f0); P.px(436, 86, 0xfaf8f0);
  outline(P, 0x1a1210);
  return { img: P.flush(), ox, oy };
}

// ======================= möblerna (egna bilder, ritas i djupordning) =======================
// barstol: svart vinyldyna på förkromad pelare med fotring – taped = lagad med silvertejp
function paintStool(taped) {
  const P = new Pix(14, 17);
  for (let x = 1; x < 13; x++) { P.px(x, 0, x < 4 ? 0x6a6a74 : 0x3a3a42); P.px(x, 1, 0x2a2a30); P.px(x, 2, 0x16161a); }
  P.hl(2, 0, 3, 0x9a9aa4);
  if (taped) { P.px(5, 0, 0xd8dce0); P.px(6, 1, 0xd8dce0); P.px(7, 0, 0xc8ccd0); P.px(7, 1, 0xb8bcc0); P.px(6, 0, 0xe8ecf0); }
  P.hl(1, 3, 12, STEEL.hi);
  P.vl(6, 4, 10, STEEL.base); P.vl(7, 4, 10, STEEL.lo);
  P.hl(3, 9, 8, STEEL.base); P.px(2, 9, STEEL.mid); P.px(11, 9, STEEL.mid);             // fotringen
  P.hl(2, 14, 10, STEEL.mid); P.hl(3, 15, 8, STEEL.lo);
  outline(P);
  return P.flush();
}
// fyrkantigt bord: marmorerat laminat på svart pelarfot
function paintTable() {
  const P = new Pix(30, 20);
  area(P, 1, 0, 28, 7, (X, Y, i, j) => {
    if (j === 0) return 0xf8f8f4;
    if (j >= 5) return j === 5 ? 0x3a3a40 : 0x2a2a30;
    let c = jit(0xe4e4de, X, Y, 70, 0.04);
    if (Math.abs(((X * 2 + Y * 5) % 23) - 11) < 1) c = 0xb8b8b2;              // marmoreringen
    return c;
  });
  P.rect(14, 7, 2, 9, 0x2a2a30); P.vl(14, 7, 9, 0x4a4a54);
  P.rect(8, 16, 14, 2, 0x1a1a1e); P.hl(8, 16, 14, 0x4a4a54);
  outline(P);
  return P.flush();
}
// röd plaststol med spalter i ryggen: 'down' = framifrån, 'up' = bakifrån
function paintChair(dir) {
  // ryggen: rundad överkant, tre vågräta spalter (klassisk stapelbar plaststol)
  const back = (T, top, rear) => {
    for (let j = 0; j < 9; j++) for (let i = 0; i < 12; i++) {
      if (j === 0 && (i < 2 || i > 9)) continue;
      if (j === 1 && (i === 0 || i === 11)) continue;
      let c = i < 2 ? CHAIR.hi : i > 9 ? CHAIR.lo : CHAIR.base;
      if (j === 0 || (j === 1 && i < 3)) c = CHAIR.hi;
      if ((j === 3 || j === 5) && i > 2 && i < 9) c = rear ? CHAIR.lo : CHAIR.dk;       // spalterna
      if (j === 8) c = mul(c, 0.8);
      T.px(2 + i, top + j, c);
    }
    T.vl(3, top + 9, 2, CHAIR.lo); T.vl(12, top + 9, 2, CHAIR.dk);
  };
  const P = new Pix(16, 24);
  if (dir === 'down') back(P, 1, false);
  for (let x = 1; x < 15; x++) { P.px(x, 11, x < 4 ? 0xff8a80 : CHAIR.hi); P.px(x, 12, CHAIR.base); P.px(x, 13, CHAIR.lo); }
  P.line(2, 14, 1, 23, CHAIR.lo); P.line(13, 14, 14, 23, CHAIR.dk);
  P.line(4, 14, 4, 21, CHAIR.base); P.line(11, 14, 11, 21, CHAIR.lo);
  outline(P);
  if (dir === 'down') return { img: P.flush() };
  const R = new Pix(16, 24);
  back(R, 1, true); // ryggen ritas framför den som sitter med ryggen mot oss
  outline(R);
  return { img: P.flush(), front: R.flush() };
}
// spelautomaten: svart-lila skåp, rullfönster, knappar – en handskriven TRASIG-lapp
function paintSlot() {
  const w = SLOT.x1 - SLOT.x0, h = SLOT.y - SLOT.top;
  const P = new Pix(w, h + 1);
  area(P, 0, 0, w, h, (X, Y, i, j) => {
    if (i === 0) return 0x5a3a7a;
    if (i === w - 1) return 0x1a0e24;
    if (j >= h - 4) return j === h - 4 ? 0x4a2e62 : 0x1a1020;
    return jit(j < 8 ? 0x3a1e52 : 0x2a1a3a, X, Y, 80, 0.05);
  });
  P.rect(3, 2, w - 6, 5, 0xf0c020); P.hl(3, 2, w - 6, 0xfff080);
  text(P, SMALL, $t('SPEL'), ((w - textW(SMALL, $t('SPEL'))) >> 1), 2, 0x8a1a14);
  // rullarna: sju, körsbär, sju
  P.rect(3, 10, w - 6, 12, 0x0e0e14); P.hl(3, 10, w - 6, 0x6a4a8a);
  const SYM = [['rrr', '..r', '.r.', '.r.', '.r.'], ['..g', '.g.', 'g.g', 'r.r', 'rrr'], ['rrr', '..r', '.r.', '.r.', '.r.']];
  for (let k = 0; k < 3; k++) {
    const rx = 5 + k * 6;
    area(P, rx, 11, 5, 10, (X, Y, i, j) => (j === 0 || j === 9 ? 0xc8c0b0 : 0xf6f2e8));
    spr(P, rx + 1, 13, SYM[k], { r: 0xd8202a, g: 0x46a35a });
  }
  P.hl(3, 16, w - 6, 0xff3a3a, 0.45);                                                   // vinstlinjen
  // lappen: TRASIG, tejpad
  P.rect(1, 23, w - 2, 8, 0xfaf6e0); P.hl(1, 23, w - 2, 0xe8e0c0);
  text(P, SMALL, $t('TRASIG'), 2, 24, 0x1a1a8a);
  P.rect(0, 22, 3, 2, 0xd8d8c8, 0.9); P.rect(w - 3, 22, 3, 2, 0xd8d8c8, 0.9);
  for (let k = 0; k < 4; k++) P.rect(4 + k * 5, 33, 3, 2, [0xd8302a, 0xf0c020, 0x46a35a, 0x3a7bd5][k]);
  P.rect(w - 6, 28, 2, 4, 0x1a1a1e);                                                    // myntinkastet
  outline(P);
  return { img: P.flush(), ox: 0, oy: h };
}
// soptunna i grå plast med vipplock
function paintBin() {
  const P = new Pix(18, 21);
  area(P, 1, 4, 16, 16, (X, Y, i, j) => (j === 15 ? 0x3a4038 : jit(i < 3 ? 0x8a9486 : i > 12 ? 0x4e584c : 0x6a7466, X, Y, 81, 0.06)));
  P.rect(0, 2, 18, 3, 0x5a6456); P.hl(0, 2, 18, 0x9aa496);
  P.rect(4, 0, 10, 3, 0x4a5448); P.hl(4, 0, 10, 0x8a9486);
  text(P, SMALL, $t('TACK'), 2, 9, 0xe8ecd8);
  P.px(6, 1, 0xf4efe2); P.px(7, 1, 0xd8d2c4); P.px(11, 2, 0xd8302a); P.vl(11, 5, 3, 0xa8281e, 0.7); // en servett och ett såsspår
  outline(P);
  return { img: P.flush(), ox: 9, oy: 20 };
}
// dammig plastfikus i terrakottakruka
function paintPlant() {
  const P = new Pix(18, 32);
  P.rect(5, 24, 8, 7, 0xb86a3a); P.hl(4, 24, 10, 0xd88a5a); P.vl(12, 25, 6, 0x8a4a28); P.hl(6, 30, 6, 0x7a4020);
  P.vl(9, 8, 16, 0x6a4a2a);
  for (let k = 0; k < 40; k++) {
    const a = hash(k, 1, 82) * Math.PI * 2, r = 2 + hash(k, 2, 82) * 7;
    const x = Math.round(9 + Math.cos(a) * r), y = Math.round(12 + Math.sin(a) * r * 0.9);
    const c = [0x4a7a3a, 0x5a8a44, 0x6a9a4a][k % 3];
    P.px(x, y, mix(c, 0xb8b4a8, 0.28)); P.px(x + 1, y, mix(mul(c, 0.8), 0xb8b4a8, 0.22));
  }
  outline(P);
  return { img: P.flush(), ox: 9, oy: 31 };
}
// HALT GOLV: gul A-skylt med halkande gubbe
function paintSign() {
  const P = new Pix(12, 17);
  area(P, 1, 0, 10, 16, (X, Y, i, j) => {
    const inset = Math.floor((15 - j) / 8);
    if (i < inset || i > 9 - inset) return null;
    return j === 0 ? 0xfff080 : jit(0xf0c020, X, Y, 83, 0.05);
  });
  spr(P, 3, 4, ['..k.', '.kkk', 'k.k.', '..kk', '.k..', 'kk..'], { k: 0x1a1a1a });
  P.hl(2, 12, 8, 0x1a1a1a); P.px(1, 16, 0x6a5a10); P.px(10, 16, 0x6a5a10);
  outline(P);
  return { img: P.flush(), ox: 6, oy: 16 };
}

// moppen i den gula vridhinken, skaftet lutat bakåt
function paintMop() {
  const P = new Pix(22, 40);
  P.line(15, 1, 10, 28, 0x8a6a3a); P.line(16, 1, 11, 28, 0xb89058); P.rect(14, 0, 3, 2, 0x3a7bd5);  // skaftet
  area(P, 3, 29, 14, 9, (X, Y, i, j) => {
    const inset = j > 6 ? 1 : 0;
    if (i < inset || i > 13 - inset) return null;
    return j === 0 ? 0xfff080 : j === 8 ? 0x8a6a10 : jit(i < 3 ? 0xf8d040 : i > 10 ? 0xc89818 : 0xf0c020, X, Y, 85, 0.05);
  });
  P.rect(3, 29, 14, 1, 0xfff4a0); P.rect(4, 30, 12, 2, 0x5a6a6a, 0.8);                           // det grå vattnet
  for (let k = 0; k < 6; k++) P.line(8 + k, 29, 7 + k + (k & 1), 33, [0xd8d4c8, 0xb8b4a8][k & 1]); // moppsnörena
  P.rect(15, 26, 5, 5, 0x3a3a40); P.hl(15, 26, 5, 0x6a6a72);                                     // vridpressen
  P.px(1, 36, 0x5a6a6a, 0.6); P.px(19, 37, 0x5a6a6a, 0.5);                                        // skvättar
  outline(P);
  return { img: P.flush(), ox: 10, oy: 38 };
}
// läskbackar i röd plast, tre på höjden, flaskhalsar som sticker upp ur den översta
function paintCrates() {
  const P = new Pix(20, 26);
  for (let k = 0; k < 3; k++) {
    const y = 18 - k * 7;
    area(P, 1, y, 18, 7, (X, Y, i, j) => {
      if (j === 0) return 0xf05a4a;
      if (j === 6) return 0x7a1414;
      if ((i === 4 || i === 13) && j > 1 && j < 5) return 0x5a0e0e;                          // handtagen
      return jit(i === 0 ? 0xe8403a : i === 17 ? 0x9a1a1a : 0xc82828, X, Y, 86 + k, 0.05);
    });
  }
  for (let k = 0; k < 5; k++) { P.rect(2 + k * 3 + (k > 2 ? 1 : 0), 1, 2, 3, k === 3 ? 0x6a3a1a : 0x3a7a3a); P.px(2 + k * 3 + (k > 2 ? 1 : 0), 0, 0xd8d8d0); }
  outline(P);
  return { img: P.flush(), ox: 10, oy: 25 };
}

// Spettens köttkoner som snurrar: kött (brunt, en tomat på toppen) och kyckling (gyllene,
// en lök på toppen). Ränderna vandrar runt för varje bildruta.
const CONES = {};
function coneFrames(kind) {
  if (CONES[kind]) return CONES[kind];
  const cols = kind === 'kott'
    ? [0x6a3418, 0x8a4a24, 0xa8602e, 0xc07a3a, 0xd89a5a]
    : [0x9a6a20, 0xc08830, 0xd8a040, 0xe8c060, 0xf6dc8a];
  const frames = [];
  for (let f = 0; f < 6; f++) {
    const P = new Pix(16, 34);
    P.vl(7, 0, 34, 0x8a8a92); P.vl(8, 0, 34, 0x5a5a62);                                // spettet
    for (let j = 5; j < 30; j++) {
      const hw = Math.round(6.4 - (j - 5) * 0.14);
      for (let i = -hw; i <= hw; i++) {
        const u = (i + hw) / (2 * hw + 1);
        const band = ((j * 2 + Math.floor(u * 6 + f)) % 5 + 5) % 5;
        let c = cols[[1, 2, 3, 2, 0][band]];
        if (i === -hw) c = mix(c, 0xffd8a0, 0.35);                                     // glöden från elementet
        else if (i === hw) c = mul(c, 0.62);
        if (hash(i + f * 3, j, 84) > 0.93) c = cols[4];                                // fettglans
        P.px(8 + i, j, c);
      }
    }
    if (kind === 'kott') spr(P, 5, 1, ['.rrr.', 'rRrrr', 'rrrrr', '.rrr.'], { r: 0xd83a2a, R: 0xff8a6a });
    else spr(P, 5, 1, ['.www.', 'wWwvw', 'wwwww', '.www.'], { w: 0xe8d8b8, W: 0xfff4e0, v: 0xc8a878 });
    P.rect(5, 30, 7, 2, STEEL.base); P.hl(5, 30, 7, STEEL.hi);
    outline(P, 0x1a0e08);
    frames.push(P.flush());
  }
  return (CONES[kind] = frames);
}

// Golvet: brunbeige klinker med mörka fogar, en ljusare gångväg från dörren till disken,
// såsfläckar, en tappad pommes, dörrmattan och skuggor under allt som står.
function paintFloor(P, night) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const ty = ((y - WALL_Y) / 11) | 0, tx = (x / 12) | 0, u = x % 12, v = (y - WALL_Y) % 11;
    const hv = hash(tx, ty, 90);
    let c = hv > 0.975 ? 0xa2927e : hv > 0.5 ? 0xb09474 : 0xa4886a;              // en och annan utbytt platta
    c = mul(c, 0.95 + hash(x, y, 91) * 0.08);
    if (u === 1 || v === 1) c = mix(c, WHITE, 0.07);                              // plattornas kanter
    else if (u === 11 || v === 10) c = mul(c, 0.9);
    if (u === 0 || v === 0) c = 0x7e6852;                                         // fogen
    if (hash(tx, ty, 96) > 0.985 && Math.abs(u - v * 0.9 - 1) < 0.6) c = 0x7a6450; // spruckna plattor
    if (y < WALL_Y + 4) c = mul(c, 0.76 + (y - WALL_Y) * 0.06);
    // gångvägen (slitet ljusare) från dörren mot disken
    const pu = clamp((x - DOOR_SPOT[0]) / (PAY_X - DOOR_SPOT[0]), 0, 1), py = DOOR_SPOT[1] + 8 + pu * (ORDER_Y - DOOR_SPOT[1] - 8);
    if (x > DOOR_SPOT[0] - 12 && x < PAY_X + 20 && Math.abs(y - py) < 9 && bayer(x, y) < 0.55) c = mix(c, 0xd8c8a8, 0.2);
    P.px(x, y, jit(c, x, y, 92, 0.035));
  }
  // dörrmattan
  area(P, DOOR.x0 - 2, WALL_Y + 1, DOOR.x1 - DOOR.x0 + 4, 9, (X, Y, i, j) => (j === 0 || j === 8 ? 0x1a1a1e : (X % 2 ? 0x3a3a40 : 0x2a2a30)));
  // fläckar: stark sås, vitlökssås, en tappad pommes, en servett, tuggummin
  P.ell(300, 132, 5, 2, 0x8a2a1a, 0.3, 2); P.ell(92, 190, 4, 1.6, 0x8a3a1a, 0.25, 2); P.ell(262, 150, 3, 1.4, 0xf4f0e0, 0.4, 2);
  P.hl(118, 170, 3, 0xf0b830); P.px(121, 169, 0xe0a020);
  P.rect(212, 120, 3, 2, 0xf4f1ea); P.px(214, 119, 0xd8d2c4);
  for (let k = 0; k < 9; k++) { const gx = 180 + (hash(k, 3, 97) * 260 | 0), gy = 110 + (hash(k, 4, 97) * 90 | 0); P.px(gx, gy, 0x4a3e34); P.px(gx + 1, gy, 0x5a4c40); }
  // smutsen samlas längs diskens sparkplåt och i hörnen
  for (let x = CNT.x0; x < CNT.x1; x++) for (let j = 0; j < 4; j++) if (bayer(x, CNT.y + 2 + j) < 0.35 - j * 0.08) P.px(x, CNT.y + 2 + j, 0x5a4634, 0.35);
  for (let j = 0; j < 6; j++) for (let i = 0; i < 14 - j * 2; i++) if (bayer(i, WALL_Y + j) < 0.45) { P.px(6 + i, WALL_Y + j, 0x4a3a2a, 0.3); P.px(W - 7 - i, WALL_Y + j, 0x4a3a2a, 0.3); }
  // golvbrunnen: rund galler i en fyrkantig ram, fuktfläck runt om
  P.ell(DRAIN.x, DRAIN.y, 10, 4, 0x5a4a3a, 0.22, 3);
  area(P, DRAIN.x - 5, DRAIN.y - 3, 11, 6, (X, Y, i, j) => {
    const r = Math.hypot((i - 5) / 5.2, (j - 2.5) / 2.8);
    if (i === 0 || j === 0) return 0x6a6e76;
    if (i === 10 || j === 5) return 0x3a3e46;
    if (r < 0.9) return (i + j) % 2 ? 0x2a2a2e : 0x8a8e96;
    return 0x9aa0a8;
  });
  if (!night) {
    // solen faller in genom fönstret, snett åt höger
    for (let j = 0; j < 26; j++) {
      const y = WALL_Y + 2 + j, sh = j * 0.6, a = 0.22 * (1 - j / 26) + 0.05;
      for (let x = Math.round(WIN.x0 + sh); x < Math.round(WIN.x1 + sh); x++) if (bayer(x, y) < 0.8 && Math.abs(x - WIN.mid - sh) > 1) P.px(x, y, 0xfff4d8, a);
    }
  }
  // lysrörens sken
  for (const T of TUBES) P.ell(T.x, 140, 44, 12, 0xf4f8ff, night ? 0.12 : 0.06, 3);
  // skuggorna
  for (const T of TABLES) { P.ell(T.x, T.y, 15, 3, 0x1a1014, 0.35, 3); P.ell(T.x - 7, T.y - 6, 7, 2, 0x1a1014, 0.3, 2); P.ell(T.x + 8, T.y + 10, 7, 2, 0x1a1014, 0.3, 2); }
  for (const sx of STOOLS) P.ell(sx, STOOL_Y, 6, 1.8, 0x1a1014, 0.38, 2);
  P.ell(PLANT.x, PLANT.y, 7, 2, 0x1a1014, 0.4, 2);
  P.ell(BIN.x, BIN.y, 8, 2, 0x1a1014, 0.4, 2);
  P.ell(SIGN.x, SIGN.y, 7, 1.6, 0x1a1014, 0.35, 2);
  P.ell(MOP.x, MOP.y, 9, 2, 0x1a1014, 0.38, 2); P.ell(MOP.x + 12, MOP.y + 1, 6, 1.5, 0x4a5a5a, 0.25, 2); // blött runt hinken
  P.ell(CRATES.x, CRATES.y, 11, 2, 0x1a1014, 0.4, 2);
  P.darken(SLOT.x0, SLOT.y, SLOT.x1 - SLOT.x0, 2, 0.62);
  P.darken(CNT.x0, CNT.y, CNT.x1 - CNT.x0, 2, 0.62); P.darken(CNT.x0, CNT.y + 2, CNT.x1 - CNT.x0, 1, 0.8);
  P.darken(0, WALL_Y, 8, 2, 0.7);
  // golvet speglar diskens sparkplåt lite grand
  for (let j = 1; j < 6; j++) for (let x = CNT.x0; x < CNT.x1; x++) if (bayer(x, CNT.y + j) < 0.6) P.px(x, CNT.y + j, STEEL.base, 0.14 * (1 - j / 6));
}
function paintSides(P) {
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, H, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WALL_Y + (5 - k) * 2) return null;
    return jit(Y < 8 ? 0x8a8478 : Y < 52 ? mul(KAKEL.base, 0.62 + k * 0.04) : mul(BRUN.base, 0.6 + k * 0.04), X, Y, 93, 0.04);
  });
  P.box(0, 0, W, H, 0x0e0d12);
}

// tv:ns hölje på väggarmen (skärmen ritas live)
function paintTvFrame(P) {
  const { x0, x1, y0, y1 } = TV;
  P.rect(x0 + 11, y1, 6, 3, 0x2a2a2e); P.rect(x0 + 13, y1 + 3, 2, 6, 0x3a3a40); P.rect(x0 + 10, y1 + 9, 8, 2, 0x2a2a2e); // armen
  P.rect(x0, y0, x1 - x0, y1 - y0, 0x16161a); P.hl(x0, y0, x1 - x0, 0x4a4a52); P.hl(x0, y1 - 1, x1 - x0, 0x0a0a0c);
  P.px(x1 - 3, y1 - 2, 0xd8302a);
}

function paintBg(night) {
  const P = new Pix(W, H);
  paintWall(P);
  paintFloor(P, night);
  paintOutside(P, night);
  paintDoorSurround(P);
  paintKitchen(P);
  paintTvFrame(P);
  paintSides(P);
  return P.flush();
}

// Kvällens ljuskarta: varma pölar i dithrade steg (läggs på med 'lighter')
function paintNightLight() {
  const P = new Pix(W, H);
  const AMB = 0xffb870;
  for (const T of TUBES) { P.ell(T.x + 0.5, 64, 46, 44, 0xfff0d8, 0.13, 5); P.ell(T.x + 0.5, 12, 20, 4, 0xffffff, 0.4, 3); P.ell(T.x + 0.5, 150, 40, 14, 0xfff0d8, 0.08, 3); }
  P.ell(340, 104, 118, 24, AMB, 0.18, 4);                                          // disken
  P.ell(340, 150, 110, 30, AMB, 0.08, 4);
  P.ell((MENU.x0 + MENU.x1) / 2, 26, 72, 28, 0xfff0c0, 0.32, 4);                   // ljusskylten
  for (const S of SPITS) P.ell(S.x, 48, 17, 22, 0xff7a2a, 0.32, 4);                // värmeelementen
  P.ell((FRIDGE.x0 + FRIDGE.x1) / 2, 52, 22, 36, 0xd8f0ff, 0.22, 4);             // läskkylen
  P.ell((WIN.mid + WIN.x1) / 2, WIN.t + 14, 36, 16, CYAN, 0.26, 4);                // GRILL-neonet
  P.ell((ZAP.x0 + ZAP.x1) / 2, ZAP.y1, 22, 16, 0x8a7aff, 0.32, 4);                 // flugfångaren
  P.ell((TV.x0 + TV.x1) / 2, TV.y1, 18, 16, 0x8ad08a, 0.16, 3);                    // tv:n
  P.ell((SLOT.x0 + SLOT.x1) / 2, SLOT.top + 14, 18, 22, 0xd87aff, 0.2, 3);         // spelautomaten
  P.ell(DOOR_SPOT[0], 60, 16, 26, 0x6aff9a, 0.06, 3);                              // nödutgångsskylten
  return P.flush();
}

// Glasdörren (gångjärn till vänster) i bildrutor där den svänger in mot oss
function paintDoorFrames(N = 6) {
  const w = DOOR.x1 - DOOR.x0, h = WALL_Y - DOOR.top;
  const S = new Pix(w, h);
  area(S, 0, 0, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e < 3) return [ALU.dk, ALU.hi, ALU.base][e];
    if (j >= h - 12) return j === h - 12 ? ALU.hi : jit(ALU.base, X, Y, 94, 0.05);   // sparkplåten
    return null;
  });
  for (let j = 3; j < h - 12; j++) for (let i = 3; i < w - 3; i++) {
    const s = (((i + 3) * 2 - j * 3) % 40 + 40) % 40;
    S.px(i, j, 0xc8e0e8, 0.08 + (s < 3 ? 0.2 : 0));
  }
  S.rect(3, 30, w - 6, 3, ALU.base); S.hl(3, 30, w - 6, ALU.hi); S.hl(3, 32, w - 6, ALU.lo);  // tryckbommen
  // ÖPPET-skylten i ett snöre (baksidan säger VÄLKOMMEN)
  area(S, 5, 10, w - 10, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === w - 11 || j === 7 ? 0x8a1a20 : 0xf6f2e4));
  const om = textMask(SMALL, $t('ÖPPET'), true);
  drawText(S, om, ((w - om.w) >> 1), 12, { fill: 0xc8302a });
  S.line(8, 10, 14, 5, 0x6a5a4a); S.line(w - 9, 10, 14, 5, 0x6a5a4a);
  S.rect(4, 38, 8, 5, 0xf0c020); S.px(5, 39, 0x1a1a1a); S.px(10, 41, 0x1a1a1a);            // ett gammalt klistermärke
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

// Bilderna som inte beror på scenen målas en gång per modul (dag/kväll var för sig)
const IMG = {};
const img = (k, fn) => (IMG[k] ||= fn());

// notpixlar (radion) används inte här – men pratbubblornas repliker gör:
const LINES = [
  $t('Bästa såsen i hela förorten!'), $t('Mixsås. Alltid mix.'), $t('Grillen funkar igen, äntligen!'), $t('Jag käkar här varje fredag.'),
  $t('Pommesen är krispiga i dag.'), $t('Såg du matchen? Vilken straff!'), $t('Extra stark sås, tack!'), $t('Den här rullen väger ett kilo.'),
  $t('Vitlökssås ... i morgon luktar jag.'), $t('Deniz är en legend.'), $t('Stängt? Här? Aldrig.'), $t('Läsken är iskall i alla fall.'),
];
const CHEER = [$t('MÅÅÅL!'), $t('JAAA! MÅL!'), $t('Vilken smäll!'), $t('Betong IF!')];

// ======================= scenen =======================
export function makeShopKebab(A) {
  const g = A.game;
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, pendingHello = 0, alive = true;
  const talkMe = createSpeech(), talkCook = createSpeech(); // repliker som pratbubblor

  // ---------- sittplatser ----------
  // barstolarna vid fönstret sitter man på med ryggen mot oss (maten står på bardisken);
  // borden har en stol bakom (vänd mot oss) och en framför (ryggen mot oss)
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
    [SLOT.x0 - 1, WALL_Y, SLOT.x1 + 1, SLOT.y + 1],
    [PLANT.x - 7, PLANT.y - 5, PLANT.x + 7, PLANT.y + 1],
    [BIN.x - 8, BIN.y - 5, BIN.x + 8, BIN.y + 1],
    [SIGN.x - 6, SIGN.y - 4, SIGN.x + 6, SIGN.y + 1],
    [MOP.x - 9, MOP.y - 7, MOP.x + 9, MOP.y + 1],
    [CRATES.x - 10, CRATES.y - 6, CRATES.x + 10, CRATES.y + 1],
  ];
  for (const sx of STOOLS) obstacles.push([sx - 5, STOOL_Y - 3, sx + 5, STOOL_Y + 1]);
  for (const T of TABLES) obstacles.push([T.x - 15, T.y - 10, T.x + 15, T.y + 1]);
  const walker = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: [DOOR_SPOT[0], DOOR_SPOT[1] + 6] });
  walker.setObstacles(obstacles);
  walker.snapFree();
  const cams = () => lockedCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  // cam.y = hur mycket världen flyttas NED på skärmen (skärm-y = värld-y + cam.y) – bara när
  // mobilens fyll-läge beskär (se camYGoal längre ner), annars 0
  const cam = { x: cams(), y: 0 };
  const camY = () => Math.round(cam.y);
  // den SYNLIGA rutan i skärmpixlar (main.js räknar ut den – fyll-läget beskär mest upptill)
  function safeBox() {
    const s = A.view?.safe;
    return {
      x0: clamp(s?.x0 | 0, 0, VW >> 1), x1: clamp(s?.x1 ? s.x1 | 0 : VW, VW >> 1, VW),
      y0: clamp(s?.y0 | 0, 0, H >> 1), y1: clamp(s?.y1 ? s.y1 | 0 : H, H >> 1, H),
    };
  }
  // var man ställer sig för att sätta sig på en plats
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
  const menuLit = img('menu1', () => paintMenuBox(false)), menuDim = img('menu0', () => paintMenuBox(true));
  const fridgeShut = img('kyl0', () => paintFridge(false)), fridgeOpen = img('kyl1', () => paintFridge(true));
  const stoolImg = img('pall', () => paintStool(false)), stoolTaped = img('pallT', () => paintStool(true));
  const tableImg = img('bord', paintTable);
  const chairDown = img('stol0', () => paintChair('down')), chairUp = img('stol1', () => paintChair('up'));
  const slotImg = img('spel', paintSlot);
  const binImg = img('sop', paintBin);
  const plantImg = img('fikus', paintPlant);
  const signImg = img('skylt', paintSign);
  const tubesImg = img('ror', paintTubes);
  const mopImg = img('mopp', paintMop), cratesImg = img('backar', paintCrates);
  const cones = SPITS.map((S) => coneFrames(S.kind));

  // ---------- grillkocken Deniz ----------
  const DENIZ = { skin: '#c68a5c', hair: '#1d1714', style: 'buzz', beard: 'stubble', top: 'tee', shirt: '#2f3440', accent: '#c8302a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: false, phones: false, bag: null, hat: null, apron: true, build: 6, kid: false };
  const cook = { x: PAY_X - 8, y: COOK_FRONT, tx: PAY_X - 8, ty: COOK_FRONT, dir: 'down', walking: false, phase: 'idle', t: 0, idleT: 2, job: null, steps: [], si: 0, act: null, face: 'down' };
  const jobs = [];   // beställningar som väntar: { who, items, x, sauce, bag }
  const trays = [];  // färdig mat PÅ DISKEN: { x, who, items, bag, at }
  const COOK_NAME = $t('Deniz');
  const cookAt = () => ({ x: cook.x, y: cook.y - 44 });

  // ---------- partiklar: ånga, köttspån, flugor ----------
  const parts = [];
  const puff = (x, y) => parts.push({ x: x + (Math.random() - 0.5) * 2, y, vx: (Math.random() - 0.5) * 3, vy: -6 - Math.random() * 4, age: 0, max: 1 + Math.random() * 0.6, kind: 'steam' });
  const shave = (x, y) => {
    const S = SPITS.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
    parts.push({ x, y, vx: (Math.random() - 0.6) * 6, vy: 4, age: 0, max: 0.8, kind: 'shave', c: S.kind === 'kott' ? (Math.random() < 0.5 ? '#8a4a24' : '#b8703a') : (Math.random() < 0.5 ? '#c08830' : '#e8c060') });
  };
  const flies = [{ x: 150, y: 110, vx: 10, vy: 0, t: 0 }, { x: 300, y: 90, vx: -8, vy: 3, t: 5 }];
  let zapT = -9, zapX = 0, zapY = 0;

  // ---------- gästerna ----------
  const rng = rngOf((g.day | 0) * 7919 + 41);
  const guests = [];
  const lookOf = () => { const L = makeLook(rng); L.bag = null; return L; };
  const newOrder = () => {
    const main = rng() < 0.62 ? 'kebab' : 'falafel';
    const list = normOrder([main, ...(rng() < 0.45 ? ['pommes'] : []), ...(rng() < 0.55 ? ['lask'] : [])]);
    const sauce = KEBAB_SASER[(rng() * 3) | 0].id;
    return list.map((m) => ({ id: m.id, stage: 0, bites: m.bites, sauce }));
  };
  const sitNPC = (seat) => {
    if (!seat || seat.occ) return null;
    const G = { look: lookOf(), seat, state: 'sit', items: newOrder(), sitT: rng() * 8, stay: 1e9, eatT: rng() * 3, eating: 0, biteT: 1 + rng() * 3, bubble: null, fixed: true, slide: null };
    G.items.forEach((it) => { it.stage = Math.min(it.bites - 1, (rng() * it.bites) | 0); });
    seat.occ = G; guests.push(G); return G;
  };
  // stamgästerna – någon av dem saknas vissa dagar
  for (const id of ['pall2', 't1a', 't2b', 't3a']) if (rng() < 0.65) sitNPC(seatById(id));
  const mkWalker = () => { const w = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: DOOR_SPOT }); w.setObstacles(obstacles); w.speed = 38; return w; };
  const queue = []; // gästerna som står i kön (index 0 = den som beställer)
  for (let k = 0; k < 3; k++) guests.push({ look: lookOf(), seat: null, state: 'away', t: 2 + k * 11 + rng() * 5, w: mkWalker(), items: null, sitT: 0, stay: 0, eatT: 0, eating: 0, biteT: 0, bubble: null, fixed: false, slide: null, ordered: false, bag: false });

  // ---------- figuren (jag) ----------
  // order = rätterna man betalat för (samma objekt som sedan ligger på brickan) tills allt är
  // uppätet – så länge den finns får man inte gå ut. got = det man faktiskt fått (för testerna)
  const me = { state: 'free', seat: null, res: null, tray: null, order: null, sauce: 'mix', biteT: 0, sitT: 0, eating: 0, slide: null, waitMsgT: -9, doneT: -9, hintGiven: false, got: { fill: 0, energy: 0 } };
  const leftovers = []; // brickor som gäster lämnat en liten stund
  const meAt = () => ({ x: me.seat ? me.seat.x : walker.px, y: (me.seat ? me.seat.y - me.seat.lift : walker.py) - 44 });
  // Mobilens fyll-läge (NÄRA) visar bara ~135–180 av de 216 raderna. Kameran följer då figuren
  // på höjden. Uppe vid väggen (dörren, barstolarna, disken – fötterna ovanför y 124) syns hela
  // väggen: spetten, menyn, Deniz och fönstret. Längre ner glider kameran mot figuren (fötterna
  // strax under mitten) så att borden längst fram går att nå med ett eller två tryck.
  // Ingen beskärning → 0.
  function camYGoal() {
    const { y0, y1 } = safeBox(), vh = y1 - y0;
    if (y0 === 0 && y1 === H) return 0;
    const fy = me.seat ? me.seat.y : walker.py;
    const k = clamp((fy - 124) / 24, 0, 1), pull = k * k * (3 - 2 * k); // mjuk övergång vägg → golv
    const top = clamp(fy - vh * 0.55, 0, H - vh) * pull; // översta synliga världsraden
    return y0 - top;
  }
  // cam.y får aldrig blotta något utanför lokalen i den synliga rutan (skärmen kan byta storlek)
  function clampCamY() { const { y0, y1 } = safeBox(); cam.y = clamp(cam.y, y1 - H, y0); }
  // Pratbubblans ankare (världskoordinater) flyttas ner så att hela bubblan syns under den
  // synliga överkanten – samma mått som sayBubble (walkable.js) räknar med.
  let visTop = 0; // översta synliga världsraden – draw() sätter den varje bildruta
  function bubbleH(text, w, maxLines) {
    const lines = sayLines(text, w, maxLines);
    return lines.length ? lines.reduce((a, l) => a + (l.some((tk) => tk.emoji) ? 10 : 7), 0) + 4 : 0;
  }
  function bubbleY(text, y, w, maxLines) {
    const h = bubbleH(text, w, maxLines);
    return h ? Math.max(y, visTop + 2 + h + 4) : y; // + ramen runt bubblan
  }
  // createSpeech ritar bubblan vid sitt eget ankare – flytta ritningen ner vid behov
  function drawSpeech(ctx, sp, at, view) {
    const txt = sp.text();
    if (!txt) return;
    const y = at().y, dy = Math.ceil(bubbleY(txt, y, 124, 5) - y);
    if (dy) ctx.translate(0, dy);
    sp.draw(ctx, view);
    if (dy) ctx.translate(0, -dy);
  }
  function nag(text) {
    if (talkMe.text() === text) return;
    talkMe.say(text, meAt, 2.8);
    play('fel');
  }
  // en tugga av rätten: fill/bites (heltal) mättnad och energy/bites energi
  function giveBite(it) {
    const f = it.fill / it.bites, e = it.energy / it.bites;
    g.hunger = c100(g.hunger + f); g.energy = c100(g.energy + e);
    me.got.fill += f; me.got.energy += e;
  }
  // Det som ännu inte ätits av den betalda maten räknas in. Rätten märks settled så att
  // tuggorna efteråt inte ger något till.
  function settleOrder() {
    if (!me.order) return false;
    for (const it of me.order) {
      if (it.settled) continue;
      const left = Math.max(0, it.bites - it.stage);
      for (let k = 0; k < left; k++) giveBite(it);
      it.settled = true;
    }
    return true;
  }
  // Den automatiska uppdateringen laddar om sidan mitt i maten ('sf:before-reload', version-ui
  // sparar direkt efteråt): resten räknas in på riktigt och sparas NU.
  function settleNow() {
    if (!settleOrder()) return;
    try { g.save(); } catch { /* sparas ändå regelbundet */ }
  }
  // Sparningen är fortfarande vår? Menyns figurbyte, nytt spel, omstart, borttagning och
  // återställningen byter eller tömmer den precis före omladdningen (och märker det i
  // sessionStorage) – den får aldrig skrivas över. Samma kontroll som i Mataffären.
  function saveIsOurs() {
    try { if (sessionStorage.getItem('sf_menu_skip') || sessionStorage.getItem('sf_restored')) return false; } catch { /* ingen sessionStorage: kolla sparningen */ }
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return !!p && p.day === g.day && p.home === g.home && Math.round(+p.money) === Math.round(g.money);
    } catch { return false; }
  }
  // Fliken byts, mobilen låses eller sidan stängs mitt i maten: bara SPARFILEN får resten,
  // som om den vore uppäten. Spelet självt fortsätter tugga för tugga (mätaren hoppar inte).
  // Dödas fliken i bakgrunden är maten inräknad nästa gång; kommer man tillbaka skriver
  // nästa vanliga sparning de riktiga värdena, och läggs sidan undan igen görs det om.
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
        if (!alt) { me.state = me.tray ? 'carry' : 'free'; talkMe.say($t('😕 Alla platser är upptagna!'), meAt); return; }
        goSit(alt); return;
      }
      sitDown(s);
    });
    if (!me.seat) s.occ = 'me';
  }

  // ---------- köpet ----------
  function buy(ids, sauce = 'mix') {
    if (!alive) return { ok: false, msg: $t('Grillen är stängd.') }; // scenen är redan bytt (menyn låg kvar öppen)
    const list = normOrder(ids);
    if (!list.length) return { ok: false, msg: $t('Välj något från menyn först!') };
    if (me.state === 'wait' || me.state === 'toCounter') return { ok: false, msg: $t`${COOK_NAME} fixar redan din beställning!` };
    if (me.order) return { ok: false, msg: $t('Ät upp det du har först!') };
    const price = priceOf(list);
    if (g.money < price) return { ok: false, msg: $t('Du har inte råd!') };
    if (me.state === 'sit') standUp();
    release();
    g.money -= price;
    g.passTime(10);
    g.save();
    play('coin');
    me.sauce = sasOf(sauce).id;
    // OBS: mättnaden och energin kommer tugga för tugga NÄR MAN SITTER OCH ÄTER
    const items = list.map((m) => ({ id: m.id, stage: 0, bites: m.bites, fill: m.fill, energy: m.energy, sauce: me.sauce }));
    me.order = items;
    const order = () => { me.state = 'wait'; walker.dir = 'up'; jobs.push({ who: 'me', items, x: PAY_X, bag: false }); };
    const atCounter = Math.abs(walker.py - ORDER_Y) < 6 && Math.abs(walker.px - PAY_X) < 26 && !walker.path.length;
    if (atCounter) order();
    else { me.state = 'toCounter'; walker.walkTo(PAY_X, ORDER_Y, order); }
    const line = orderText(list, me.sauce);
    talkCook.say($t`🥙 ${line[0].toUpperCase() + line.slice(1)} – ${price} kr, tack! Kommer direkt.`, cookAt, 3.6);
    return { ok: true, price, fill: fillOf(list), energy: energyOf(list), items: list.map((m) => m.id) };
  }

  // menyn vid disken: välj en rulle (eller ingen), lägg till pommes och läsk, välj sås
  let pick = { main: null, pommes: false, lask: false, sauce: 'mix' };
  function openMenu(pre) {
    if (me.order) { nag(MSG_ATUPP); return; }   // maten först – sedan kan man beställa mer
    if (pre) pick = { main: null, pommes: false, lask: false, sauce: pick.sauce, ...pre };
    const ids = () => [pick.main, pick.pommes && 'pommes', pick.lask && 'lask'].filter(Boolean);
    const render = () => {
      const list = normOrder(ids()), price = priceOf(list), hasMain = !!pick.main;
      const on = (m) => (m.main ? pick.main === m.id : pick[m.id]);
      const rows = KEBAB_MENY.map((m, i) => `<div class="prow" style="grid-template-columns:52px 1fr auto;${on(m) ? 'background:#fff3c8' : ''}">
          <canvas data-ic="${i}" width="24" height="16" style="width:48px;height:32px;image-rendering:pixelated;background:#f0e2c4;border:2px solid #17151a"></canvas>
          <span class="nm">${m.icon} ${m.name} <b>${fmt(m.price)}</b><br><small class="sp">${$t`+${m.fill} mättnad · +${m.energy} energi · ${m.bites} tuggor`}</small></span>
          <button class="btn btn-small ${on(m) ? 'btn-gold' : ''}" data-pick="${m.id}" data-key="${i + 1}">${on(m) ? $t('✓ Vald') : m.main ? $t('Välj') : $t('+ Lägg till')} <kbd>${i + 1}</kbd></button>
        </div>`).join('');
      const sas = KEBAB_SASER.map((s) => `<button class="btn btn-small ${pick.sauce === s.id ? 'btn-gold' : ''}" data-sas="${s.id}" data-key="${s.name[0]}" ${hasMain ? '' : 'disabled'}>${s.icon} ${s.name} <kbd>${s.name[0]}</kbd></button>`).join(' ');
      const body = `<p style="font-size:var(--f2);margin:0 0 8px">${$t`💰 <b>${fmt(g.money)}</b> · 🍽️ Mättnad <b>${Math.round(g.hunger)}</b>/100 · ⚡ Energi <b>${Math.round(g.energy)}</b>/100`}</p>
        <div class="plist">${rows}</div>
        <p style="font-size:var(--f2);margin:10px 0 4px">${$t`${COOK_NAME}: <i>"Vitlök eller stark?"</i>`}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${sas}</div>
        <p style="font-size:var(--f1);margin:10px 0 0;color:#6d6660">${$t('Du får maten på en bricka och sätter dig vid ett ledigt bord eller vid fönstret. Mättnaden och energin kommer medan du äter – bara när du sitter!')}</p>`;
      const can = list.length > 0 && g.money >= price;
      const dlg = openModal(MENU_TITLE, body, [
        { label: $t('Nej tack'), onClick: closeModal },
        { label: list.length ? $t`🥙 Beställ – ${fmt(price)}` : $t('🥙 Beställ'), cls: 'btn-go', disabled: !can, onClick: () => {
          const r = buy(ids(), pick.sauce);
          closeModal();
          if (!r.ok) { talkCook.say('😳 ' + r.msg, cookAt); play('fel'); }
        } },
      ]);
      dlg.querySelectorAll('canvas[data-ic]').forEach((cv) => {
        const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
        const m = KEBAB_MENY[+cv.dataset.ic], d = dishImg(m.id, 0, m.bites, pick.sauce);
        x.drawImage(d, (24 - d.width) >> 1, 16 - d.height);
      });
      dlg.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
        const m = menyOf(b.dataset.pick);
        if (m.main) pick.main = pick.main === m.id ? null : m.id;
        else pick[m.id] = !pick[m.id];
        play('click');
        render();
      }));
      dlg.querySelectorAll('[data-sas]').forEach((b) => (b.onclick = () => { pick.sauce = b.dataset.sas; play('click'); render(); }));
    };
    render();
  }

  // ---------- klickbara saker ----------
  const quip = (text, at = meAt) => talkMe.say(text, at, 3.4);
  let goalT = -99, score = [1, 0];
  const hot = [
    { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 6, DOOR.x1 + 3, WALL_Y + 10], go: () => DOOR_SPOT, act: () => { play('door'); A.go('city'); } },
    { id: 'spett', r: [HOOD.x0, 26, HOOD.x1, 68], go: () => [272, ORDER_Y], act: () => { walker.dir = 'up'; talkCook.say($t('🔪 Kött eller kyckling – båda har snurrat sen i morse!'), cookAt); } },
    { id: 'kyl', r: [FRIDGE.x0, FRIDGE.top, FRIDGE.x1, BACK.y], go: () => [PAY_X, ORDER_Y], act: () => { play('click'); openMenu({ lask: true }); } },
    { id: 'meny', r: [MENU.x0, MENU.y0, MENU.x1, MENU.y1], go: () => [PAY_X, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'disk', r: [CNT.x0, 70, CNT.x1, CNT.y + 2], go: () => [PAY_X, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'spel', r: [SLOT.x0 - 2, SLOT.top - 2, SLOT.x1 + 2, SLOT.y + 2], go: () => [(SLOT.x0 + SLOT.x1) / 2, SLOT.y + 9], act: () => { walker.dir = 'up'; play('miss'); quip($t('🎰 Lamporna blinkar ... men den har varit trasig sen i fjol.')); } },
    { id: 'tv', r: [TV.x0 - 2, TV.y0 - 2, TV.x1 + 2, TV.y1 + 10], go: () => [440, ORDER_Y + 4], act: () => { walker.dir = 'up'; quip(t - goalT < 8 ? $t('📺 MÅÅÅL! Hela grillen jublar.') : $t`📺 Fotboll. Betong IF leder ${score[0]}-${score[1]}!`); } },
    { id: 'zap', r: [ZAP.x0 - 2, ZAP.y0 - 2, ZAP.x1 + 2, ZAP.y1 + 4], go: () => [226, WALL_Y + 14], act: () => { walker.dir = 'up'; quip($t('⚡ Flugfångaren. ZZT! En fluga mindre.')); } },
    { id: 'affisch', r: [POSTER.x0, POSTER.y0, POSTER.x1, POSTER.y1], go: () => [226, WALL_Y + 14], act: () => { walker.dir = 'up'; quip($t('🏖️ En solblekt affisch. Någon längtar bort.')); } },
    { id: 'skylt', r: [SIGN.x - 7, SIGN.y - 17, SIGN.x + 7, SIGN.y + 2], go: () => [SIGN.x - 12, SIGN.y + 4], act: () => quip($t('⚠️ HALT GOLV. Den står alltid där.')) },
    { id: 'fikus', r: [PLANT.x - 9, PLANT.y - 32, PLANT.x + 9, PLANT.y + 2], go: () => [PLANT.x + 12, PLANT.y + 6], act: () => { walker.dir = 'left'; quip($t('🌿 En plastfikus. Dammig.')); } },
    { id: 'mopp', r: [MOP.x - 10, MOP.y - 38, MOP.x + 12, MOP.y + 2], go: () => [MOP.x + 18, MOP.y - 4], act: () => { walker.dir = 'left'; quip($t('🧹 Moppen står alltid framme. Golvet är halt ändå.')); } },
    { id: 'backar', r: [CRATES.x - 11, CRATES.y - 26, CRATES.x + 11, CRATES.y + 2], go: () => [CRATES.x - 18, CRATES.y - 4], act: () => { walker.dir = 'right'; quip($t('🥤 Läskbackar som ingen orkat bära in på lagret.')); } },
  ];
  const spotAt = (x, y) => hot.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const seatAt = (x, y) => seats.find((s) => {
    if (s.kind === 'pall') return Math.abs(x - s.x) < 9 && y > s.y - 36 && y < s.y + 3;
    return Math.abs(x - s.x) < 9 && y > s.y - 32 && y < s.y + 4;
  });

  // ---------- grillkocken ----------
  // arbetsstegen för en beställning: spettet → fritösen → salladsbaren → såsen → rulla
  // ihop → läskkylen → ställ fram på disken
  function buildSteps(job) {
    const ids = job.items.map((i) => i.id), S = [];
    const main = ids.find((i) => i === 'kebab' || i === 'falafel');
    if (main === 'kebab') S.push({ x: SPITS[0].x - 3, y: COOK_BACK, dir: 'up', dur: 1.4, act: 'spett' });
    if (main === 'falafel' || ids.includes('pommes')) S.push({ x: FRY_X, y: COOK_BACK, dir: 'up', dur: 1.3, act: 'frit' });
    if (main) {
      S.push({ x: SALAD_X, y: COOK_FRONT, dir: 'down', dur: 1.1, act: 'sallad' });
      S.push({ x: SAUCE_X, y: COOK_FRONT, dir: 'down', dur: 0.6, act: 'sas' });
      S.push({ x: SAUCE_X, y: COOK_FRONT, dir: 'down', dur: 0.6, act: 'rulla' });
    }
    if (ids.includes('lask')) S.push({ x: FRIDGE_X, y: COOK_BACK, dir: 'up', dur: 0.6, act: 'kyl' });
    S.push({ x: clamp(job.x, CNT.x0 + 22, CNT.x1 - 18), y: COOK_FRONT, dir: 'down', dur: 0.35, act: 'servera' });
    return S;
  }
  function cookGo(x, y) { cook.tx = x; cook.ty = y; }
  function updateCook(dt) {
    const K = cook;
    const dx = K.tx - K.x, dy = K.ty - K.y, dist = Math.hypot(dx, dy);
    K.walking = dist > 0.5;
    if (K.walking) {
      const st = Math.min(dist, 70 * dt);
      K.x += dx / dist * st; K.y += dy / dist * st;
      K.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      K.act = null;
      return;
    }
    K.x = K.tx; K.y = K.ty;
    if (K.phase === 'idle') {
      if (jobs.length) {
        K.job = jobs.shift(); K.steps = buildSteps(K.job); K.si = 0; K.t = 0; K.phase = 'work';
        const s = K.steps[0]; cookGo(s.x, s.y);
        if (K.job.who !== 'me' && Math.random() < 0.45) talkCook.say([$t('Vitlök eller stark?'), $t('Allt på?'), $t('Ska bli!')][(Math.random() * 3) | 0], cookAt, 2);
        return;
      }
      K.idleT -= dt;
      if (K.idleT <= 0) {
        // ingen beställning: torka disken, skära lite av spettet, kolla tv:n, stå vid kassan
        const r = Math.random();
        if (r < 0.3) { K.act = 'torka'; cookGo(250 + Math.random() * 160, COOK_FRONT); K.face = 'down'; }
        else if (r < 0.55) { K.act = 'spett'; cookGo(SPITS[(Math.random() * 2) | 0].x - 3, COOK_BACK); K.face = 'up'; }
        else if (r < 0.75) { K.act = null; cookGo(CNT.x1 - 14, COOK_FRONT); K.face = 'right'; }
        else { K.act = null; cookGo(PAY_X - 8, COOK_FRONT); K.face = 'down'; }
        K.idleT = 3 + Math.random() * 4;
        K.idleAct = K.act;
      }
      K.dir = K.face; K.act = K.idleAct || null;
      return;
    }
    // arbetar: stå vid stationen tills steget är klart
    const s = K.steps[K.si];
    K.dir = s.dir; K.act = s.act; K.t += dt;
    if (s.act === 'frit' && Math.random() < dt * 10) puff(FRY.x0 + 6 + Math.random() * 22, FRY.top - 2);
    if (K.t < s.dur) return;
    K.t = 0; K.si++;
    if (K.si < K.steps.length) { const n = K.steps[K.si]; cookGo(n.x, n.y); return; }
    // allt klart: ställ fram brickan (eller påsen) på disken
    trays.push({ x: Math.round(clamp(K.job.x, CNT.x0 + 22, CNT.x1 - 18)), who: K.job.who, items: K.job.items, bag: K.job.bag, at: t });
    if (K.job.who === 'me') { play('ok'); talkCook.say($t('Varsågod! Smaklig måltid! 🥙'), cookAt, 2.6); }
    K.job = null; K.act = null; K.phase = 'idle'; K.idleT = 1.5 + Math.random() * 2; K.idleAct = null;
  }

  // ---------- gästerna ----------
  const pickSeatNPC = () => { const f = freeSeats(); return f.length ? f[(Math.random() * f.length) | 0] : null; };
  function npcLeave(G, pause) {
    G.state = 'leave'; G.items = null;
    G.w.walkTo(...DOOR_SPOT, () => { G.state = 'away'; G.t = pause + Math.random() * 18; G.bag = false; });
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
        else if (G.fixed) G.items = newOrder();   // stamgästen beställer "nytt" i tysthet
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
      G.look = lookOf(); G.ordered = false; G.items = null; G.bag = false;
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
          G.bag = Math.random() < 0.4; // hämtmat i påse
          G.bubble = { icon: G.items[0].id, until: t + 2.4 };
          jobs.push({ who: G, items: G.items, x: G.w.px, bag: G.bag });
        }
        if (G.ordered) {
          const k = trays.findIndex((tr) => tr.who === G && t - tr.at > 0.5);
          if (k >= 0) {
            trays.splice(k, 1);
            queue.splice(queue.indexOf(G), 1);
            if (G.bag) { npcLeave(G, 14); return; }                    // hämtmat: påsen i handen och ut
            const s = pickSeatNPC();
            if (!s) { G.bag = true; npcLeave(G, 12); return; }          // fullt: tar maten med sig
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
        if (!me.hintGiven) { me.hintGiven = true; talkMe.say($t('🥙 Klicka på en ledig plats så sätter jag mig där!'), meAt); }
      }
    }
    // säkerhetsnät om gång-callbacken uteblev: sätt dig BARA om figuren står vid platsen
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
            // HÄR – och bara här – kommer mättnaden och energin: vid bordet, tugga för tugga
            if (!it.settled) giveBite(it);
            if (me.tray.items.every((i) => i.stage >= i.bites)) { me.doneT = t; g.save(); play('ok'); }
          } else me.biteT = 1;
        }
        if (me.doneT > 0 && t - me.doneT > 1.2 && me.tray.items.every((i) => i.stage >= i.bites)) {
          me.tray = null; me.order = null; me.doneT = -9;
          talkMe.say($t('😋 MUMS! Mätt och belåten.'), meAt);
        }
      } else if (me.sitT > 14) standUp();
    }
  }

  // ---------- trafiken utanför ----------
  const peds = [], cars = [];
  let pedT = 1, carT = 2;
  const carImg = {};
  function carSprite(color, dir, night) {
    const k = color + dir + night;
    if (carImg[k]) return carImg[k];
    const P = new Pix(30, 12);
    const c = parseInt(color.slice(1), 16);
    area(P, 1, 4, 28, 5, (X, Y, i, j) => (j === 0 ? mix(c, WHITE, 0.3) : j === 4 ? mul(c, 0.55) : c));
    area(P, 6, 0, 17, 4, (X, Y, i, j) => (i === 0 || i === 16 ? c : j === 0 ? mix(c, WHITE, 0.2) : night ? 0x2a2a40 : (i + j) % 5 === 0 ? 0xe8f4fa : 0x8ab4d0));
    P.vl(13, 1, 3, c);
    for (const wx of [7, 22]) { P.rect(wx - 2, 8, 5, 4, 0x1a1a1e); P.px(wx, 9, 0x8a8a90); }
    P.px(dir > 0 ? 28 : 1, 5, night ? 0xfff6b0 : 0xf8f0d0); P.px(dir > 0 ? 1 : 28, 5, 0xd8303a);
    outline(P);
    return (carImg[k] = P.flush());
  }
  function updateStreet(dt) {
    pedT -= dt; carT -= dt;
    if (pedT <= 0) { const dir = Math.random() < 0.5 ? 'left' : 'right'; peds.push({ x: dir === 'right' ? -14 : 226, dir, look: makeLook(), sp: 14 + Math.random() * 10, ph: Math.random() }); pedT = 3 + Math.random() * 6; }
    if (carT <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; cars.push({ x: dir > 0 ? -20 : 234, dir, y: dir > 0 ? 53 : 49, color: ['#8a2a2a', '#c9323a', '#3a7bd5', '#e8e3d6', '#2f3440', '#46a35a', '#9aa0aa'][Math.floor(Math.random() * 7)], sp: 55 + Math.random() * 30 }); carT = 3 + Math.random() * 7; }
    for (const p of peds) { p.x += (p.dir === 'right' ? 1 : -1) * p.sp * dt; p.ph += dt * p.sp / 22; }
    for (const c of cars) c.x += c.dir * c.sp * dt;
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].x < -20 || peds[i].x > 232) peds.splice(i, 1);
    for (let i = cars.length - 1; i >= 0; i--) if (cars[i].x < -32 || cars[i].x > 246) cars.splice(i, 1);
    cars.sort((a, b) => a.y - b.y);
  }

  let doorOpen = 0, doorWas = false, doorForMe = false, bellT = -9;
  function updateDoor(dt) {
    const near = (x, y) => x > DOOR.x0 - 10 && x < DOOR.x1 + 10 && y < WALL_Y + 14;
    // med maten i händerna öppnas dörren inte för en – den ska ätas här inne
    doorForMe = near(walker.px, walker.py) && !me.order && !me.seat;
    const any = doorForMe || guests.some((G) => !G.fixed && (G.state === 'enter' || G.state === 'leave') && near(G.w.px, G.w.py));
    doorOpen += ((any ? 1 : 0) - doorOpen) * Math.min(1, dt * 7);
    if (any && !doorWas) { play('chirp'); bellT = t; }
    doorWas = any;
  }

  // lysröret över fönstret krånglar, menyskyltens rör också, tv:n visar fotboll med mål ibland
  let tubeOn = true, tubeT = 3, menuDimOn = false, menuT = 6;
  function updateFx(dt) {
    tubeT -= dt;
    if (tubeT <= 0) { tubeOn = !tubeOn; tubeT = tubeOn ? 2 + Math.random() * 7 : 0.05 + Math.random() * 0.18; }
    menuT -= dt;
    if (menuT <= 0) { menuDimOn = !menuDimOn; menuT = menuDimOn ? 0.1 + Math.random() * 1.2 : 3 + Math.random() * 9; }
    // fotboll: ibland mål – och stamgästerna jublar
    if (Math.random() < dt / 40) {
      goalT = t; score[Math.random() < 0.65 ? 0 : 1]++;
      const sitting = guests.filter((G) => G.state === 'sit' && G.seat);
      if (sitting.length) { const G = sitting[(Math.random() * sitting.length) | 0]; G.bubble = { text: CHEER[(Math.random() * CHEER.length) | 0], until: t + 3 }; }
    }
    // flugorna surrar runt; ibland flyger en in i flugfångaren
    for (const f of flies) {
      f.t += dt;
      if (f.dead) { if (f.t > 12) { f.dead = false; f.x = BIN.x; f.y = BIN.y - 8; f.t = 0; } continue; }
      const toZap = f.t > 16 && f.t < 22;
      const tx = toZap ? (ZAP.x0 + ZAP.x1) / 2 : 40 + ((Math.sin(f.t * 0.37 + f.x * 0.01) + 1) / 2) * 400;
      const ty = toZap ? ZAP.y1 + 1 : 70 + ((Math.cos(f.t * 0.53) + 1) / 2) * 90;
      f.vx += ((tx - f.x) * 0.8 + (Math.random() - 0.5) * 160) * dt; f.vy += ((ty - f.y) * 0.8 + (Math.random() - 0.5) * 160) * dt;
      f.vx *= 0.94; f.vy *= 0.94;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (toZap && Math.abs(f.x - (ZAP.x0 + ZAP.x1) / 2) < 6 && Math.abs(f.y - ZAP.y1) < 5) { f.dead = true; f.t = 0; zapT = t; zapX = f.x; zapY = f.y; }
      if (f.t >= 22) f.t = 0;
    }
  }

  function updateParts(dt) {
    if (Math.random() < dt * 2) puff(FRY.x0 + 6 + Math.random() * 22, FRY.top - 2);
    if (cook.act === 'spett' && !cook.walking && Math.random() < dt * 14) shave(cook.x + 5, cook.y - 52 + Math.random() * 10);
    for (const p of parts) {
      p.age += dt;
      if (p.kind === 'shave') { p.vy += 60 * dt; p.x += p.vx * dt; p.y = Math.min(62, p.y + p.vy * dt); }
      else { p.x += p.vx * dt + Math.sin(p.age * 5 + p.y) * dt * 2; p.y += p.vy * dt; }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
    if (parts.length > 120) parts.splice(0, parts.length - 120);
    bubbleT -= dt;
    if (bubbleT <= 0) {
      const sitting = guests.filter((G) => G.state === 'sit' && G.seat);
      if (sitting.length) { const G = sitting[(Math.random() * sitting.length) | 0]; G.bubble = { text: LINES[(Math.random() * LINES.length) | 0], until: t + 4 }; }
      bubbleT = 7 + Math.random() * 8;
    }
    for (let i = leftovers.length - 1; i >= 0; i--) if (leftovers[i].until < t || leftovers[i].seat.occ) leftovers.splice(i, 1);
  }
  let bubbleT = 5;

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
      const frame = sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : me.eating > 0 ? 6 : 5;
      drawPerson(ctx, x, y, A.avatar.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, frame);
      return;
    }
    if (o.state !== 'sit') return;
    const frame = sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : o.eating > 0 ? 6 : 5;
    drawPerson(ctx, x, y, o.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, frame);
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
    if (s.kind === 'pall') { px = s.x + 16 - (TRAY_W >> 1); py = SHELF.y + 3 - c.height; }
    else {
      const T = s.table;
      if (s.front) { const back = seatById(T.id + 'a'); if (back && trayFor(back)) return; px = T.x - (TRAY_W >> 1); py = T.y - 13 - c.height; }
      else { px = T.x - (TRAY_W >> 1); py = T.y - 14 - c.height; }
    }
    ctx.drawImage(c, Math.round(px), Math.round(py));
  }
  function ctxLine(ctx, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 100; n++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function drawClock(ctx) {
    const cx = KLOCKA.x, cy = KLOCKA.y;
    const m = g.min % 60, h = (g.min / 60) % 12;
    const ma = m / 60 * Math.PI * 2, ha = h / 12 * Math.PI * 2;
    ctx.fillStyle = '#2a2a2e'; ctxLine(ctx, cx, cy, cx + Math.sin(ha) * 2.6, cy - Math.cos(ha) * 2.6);
    ctx.fillStyle = '#5a5a60'; ctxLine(ctx, cx, cy, cx + Math.sin(ma) * 4, cy - Math.cos(ma) * 4);
    ctx.fillStyle = '#d8302a'; ctx.fillRect(cx, cy, 1, 1);
  }
  // tv-skärmen: fotbollsplan med spelare, bollen och ställningen – MÅL! blinkar ibland
  function drawTv(ctx) {
    const x0 = TV.x0 + 2, y0 = TV.y0 + 2, w = TV.x1 - TV.x0 - 4, h = TV.y1 - TV.y0 - 4;
    for (let i = 0; i < w; i += 3) { ctx.fillStyle = ((i / 3) & 1) ? '#3a9a4a' : '#46a856'; ctx.fillRect(x0 + i, y0, Math.min(3, w - i), h); }
    ctx.fillStyle = '#d8f0d8'; ctx.fillRect(x0 + (w >> 1), y0, 1, h); ctx.fillRect(x0, y0 + h - 1, w, 1);
    const pan = Math.sin(t * 0.4) * 3;
    for (let k = 0; k < 6; k++) {
      const px = x0 + 2 + ((k * 7 + t * (3 + k) + pan + 40) % (w - 4)), py = y0 + 4 + ((k * 5 + Math.sin(t * (1 + k * 0.3) + k) * 3 + 20) % (h - 6));
      ctx.fillStyle = k & 1 ? '#f0c020' : '#2a5ab8'; ctx.fillRect(Math.round(px), Math.round(py), 1, 2);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0 + w / 2 + Math.sin(t * 1.7) * (w / 2 - 3)), Math.round(y0 + h / 2 + Math.cos(t * 2.3) * 3), 1, 1);
    ctx.fillStyle = '#16161a'; ctx.fillRect(x0, y0, 13, 7);
    ctxText(ctx, SMALL, `${score[0]}-${score[1]}`, x0 + 1, y0 + 1, '#f4f1ea');
    if (t - goalT < 4 && Math.floor(t * 4) % 2 === 0) {
      ctx.fillStyle = '#16161a'; ctx.fillRect(x0 + 3, y0 + 6, w - 6, 8);
      ctxText(ctx, SMALL, $t('MÅL!'), x0 + ((w - textW(SMALL, $t('MÅL!'))) >> 1), y0 + 8, '#ffe040');
    }
  }
  // köket lever: spetten snurrar, elementen glöder, fritösen bubblar, mikron blinkar 12:00
  function drawKitchen(ctx) {
    ctx.drawImage(menuDimOn ? menuDim : menuLit, MENU.x0, MENU.y0); // ljusskylten (ett rör krånglar)
    const fr = Math.floor(t * 5) % 6;
    SPITS.forEach((S, k) => {
      const glow = (Math.sin(t * 7 + k * 2) + 1) / 2;
      ctx.fillStyle = glow > 0.6 ? '#ffd060' : '#ff9a3a';
      for (let i = 0; i < 4; i++) ctx.fillRect(S.x - 6 + ((i * 5 + Math.floor(t * 3)) % 13), 34 + i * 7, 1, 2);
      ctx.drawImage(cones[k][(fr + k * 2) % 6], S.x - 8, 30);
      if (hash(Math.floor(t * 3), k, 7) > 0.7) { ctx.fillStyle = '#e8b040'; ctx.fillRect(S.x - 2 + k, 61, 1, 1); } // en fettdroppe
    });
    // fritöskorgarna: lyfts och skakas när det friteras
    const frying = cook.act === 'frit' && !cook.walking;
    const lift = frying && (t * 3) % 1 > 0.5 ? 4 : 0, shake = frying ? Math.round(Math.sin(t * 30)) : 0;
    for (const [k, bx] of [[0, FRY.x0 + 5], [1, FRY.x0 + 19]]) {
      const ly = k === 0 ? lift : 0;
      ctx.fillStyle = '#6a6e76'; ctx.fillRect(bx + shake, FRY.top - 1 - ly, 8, 2);
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(bx + 3 + shake, FRY.top - 7 - ly, 1, 6); ctx.fillRect(bx + 2 + shake, FRY.top - 8 - ly, 3, 1);
      if (ly) { ctx.fillStyle = '#f0c040'; ctx.fillRect(bx + 1 + shake, FRY.top - 2 - ly, 6, 1); }
    }
    for (let k = 0; k < 3; k++) { if (hash(Math.floor(t * 9), k, 8) > 0.5) { ctx.fillStyle = '#fff0b0'; ctx.fillRect(FRY.x0 + 5 + ((k * 9 + Math.floor(t * 7)) % 24), FRY.top + 1 + (k & 1), 1, 1); } }
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff3a2a' : '#6a1a14'; ctx.fillRect(FRY.x1 - 4, FRY.top + 9, 1, 1);
    // mikrons display: 12:00 som aldrig blivit ställd
    if (Math.floor(t * 2) % 2 === 0) ctxText(ctx, SMALL, '12', MICRO.x0 + 18, MICRO.top + 3, '#4aff6a');
    // läskkylen: dörren uppe när kocken tar en burk
    const open = cook.act === 'kyl' && !cook.walking;
    ctx.drawImage(open ? fridgeOpen : fridgeShut, FRIDGE.x0, FRIDGE.top);
  }
  // kniven vid spettet och det kocken har i händerna vid disken
  function drawCookTools(ctx) {
    if (cook.walking) return;
    const x = Math.round(cook.x), y = Math.round(cook.y);
    if (cook.act === 'spett') {
      // armen upp mot spettet och den långa kniven som sågar upp och ner längs köttet
      const k = Math.round(Math.sin(t * 14) * 4);
      ctx.fillStyle = '#2f3440'; ctx.fillRect(x + 5, y - 31, 2, 3); ctx.fillRect(x + 6, y - 37 + k, 2, 7);
      ctx.fillStyle = '#c68a5c'; ctx.fillRect(x + 6, y - 39 + k, 2, 2);
      ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x + 5, y - 42 + k, 4, 3);                      // skaftet
      ctx.fillStyle = '#17151a'; ctx.fillRect(x + 4, y - 54 + k, 1, 12); ctx.fillRect(x + 8, y - 53 + k, 1, 11); ctx.fillRect(x + 5, y - 55 + k, 3, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 5, y - 54 + k, 1, 12);                      // eggen
      ctx.fillStyle = '#d8dee4'; ctx.fillRect(x + 6, y - 54 + k, 1, 12);
      ctx.fillStyle = '#9aa2aa'; ctx.fillRect(x + 7, y - 53 + k, 1, 11);
      if (Math.floor(t * 6) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y - 50 + k, 1, 1); } // blänket
    } else if (cook.act === 'sallad') {
      const k = Math.floor(t * 6) % 3;
      ctx.fillStyle = ['#6ab04a', '#d83a2a', '#e8c0e0'][k]; ctx.fillRect(x - 3 + k * 2, y - 20, 2, 1);
      ctx.fillStyle = '#f2d8a0'; ctx.fillRect(x - 5, y - 18, 10, 2);
    } else if (cook.act === 'sas') {
      const c = me.sauce === 'stark' ? '#e4442c' : '#f6f2e4';
      ctx.fillStyle = c; ctx.fillRect(x + 4, y - 24, 2, 5); ctx.fillStyle = '#f2d8a0'; ctx.fillRect(x - 5, y - 18, 10, 2);
      if (Math.floor(t * 8) % 2) { ctx.fillStyle = c; ctx.fillRect(x + 4, y - 19, 1, 1); }
    } else if (cook.act === 'rulla') {
      ctx.fillStyle = '#c6ccd4'; ctx.fillRect(x - 4, y - 20, 8, 3); ctx.fillStyle = '#f6f8fa'; ctx.fillRect(x - 4, y - 20, 8, 1);
    } else if (cook.act === 'torka') {
      const k = Math.round(Math.sin(t * 6) * 5);
      ctx.fillStyle = '#6a9ad8'; ctx.fillRect(x + k - 2, y - 13, 4, 2);
    }
  }

  // beställningsbubblan ovanför en gäst i kön: rätterna bredvid varandra (påse = hämtmat)
  function orderBubble(ctx, x, y, items, bag) {
    const imgs = items.map((it) => dishImg(it.id, 0, it.bites, it.sauce));
    if (bag) imgs.push(bagImg());
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

  // bv = den synliga rutan i världens x (pratbubblorna hålls innanför), annars cx … cx + vw
  function drawWorld(ctx, cx, vw, bv = null) {
    const hour = g.min / 60, night = isNight(hour), dark = darkness(hour);
    ctx.drawImage(bg(), 0, 0);
    // ---- utanför: bilar och folk som går förbi (klippt till glaset) ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x0, WIN.t, WIN.x1 - WIN.x0, WIN.b - WIN.t);
    if (doorOpen > 0.05) ctx.rect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top);
    else ctx.rect(DOOR.x0 + 3, DOOR.top + 3, DOOR.x1 - DOOR.x0 - 6, WALL_Y - DOOR.top - 15);
    ctx.clip();
    for (const c of cars) {
      ctx.drawImage(carSprite(c.color, c.dir, night), Math.round(c.x) - 15, c.y - 11);
      if (night) { ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.fillRect(Math.round(c.x) + (c.dir > 0 ? 14 : -26), c.y - 6, 12, 2); }
    }
    for (const p of peds) drawPerson(ctx, p.x, 78, p.look, p.dir, WALK_SEQ[Math.floor(p.ph * 8.5) % 4]);
    if (!night && dark > 0) { ctx.fillStyle = `rgba(14,16,44,${dark})`; ctx.fillRect(10, 12, 204, WALL_Y - 12); }
    ctx.restore();
    // dörren och dörrklockan
    ctx.drawImage(doorFr[Math.round(clamp(doorOpen, 0, 1) * (doorFr.length - 1))], DOOR.x0, DOOR.top);
    const sw = t - bellT < 1.2 ? Math.round(Math.sin((t - bellT) * 18) * 1.5) : 0;
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(DOOR.x1 - 5, DOOR.top - 1, 1, 2);
    ctx.fillStyle = '#d0aa50'; ctx.fillRect(DOOR.x1 - 6 + sw, DOOR.top + 1, 3, 3);
    ctx.fillStyle = '#f6e0a0'; ctx.fillRect(DOOR.x1 - 6 + sw, DOOR.top + 1, 1, 1);
    ctx.drawImage(winOv(), 0, 0);
    // ---- väggen: klockan, tv:n, flugfångaren och lysröret lever ----
    drawClock(ctx);
    drawTv(ctx);
    // UV-rören surrar och flimrar lite
    const zf = Math.floor(t * 12);
    ctx.fillStyle = '#f0ecff';
    for (let k = 0; k < 3; k++) ctx.fillRect(ZAP.x0 + 2 + ((zf * 5 + k * 7) % (ZAP.x1 - ZAP.x0 - 4)), ZAP.y0 + (k & 1 ? 6 : 3), 1, 1);
    if (t - zapT < 0.35) {
      ctx.fillStyle = Math.floor(t * 30) % 2 ? '#ffffff' : '#bfe0ff';
      ctx.fillRect(Math.round(zapX) - 1, ZAP.y0 + 2, 3, ZAP.y1 - ZAP.y0 - 4);
      ctx.fillRect(Math.round(zapX) - 3, Math.round(zapY) - 1, 7, 1);
    }
    ctx.drawImage(tubesImg, 0, 0);
    for (const T of TUBES) if (T.broken && !tubeOn) { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(T.x - 15, 12, 31, 1); ctx.fillStyle = '#7a8088'; ctx.fillRect(T.x - 15, 13, 31, 1); }
    drawKitchen(ctx);
    // barstolarnas mat står på bardisken (bakom dem som sitter)
    for (const s of seats) if (s.kind === 'pall') drawTrayAt(ctx, s);

    // ---- allt på golvet i djupordning ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(CNT.y, () => {
      const kf = cook.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 1.7) > 0.93 ? 4 : 0);
      if (cook.act === 'spett' || cook.act === 'kyl' || cook.act === 'frit') { drawPerson(ctx, Math.round(cook.x), Math.round(cook.y), DENIZ, cook.dir, kf); drawCookTools(ctx); }
      else { drawPerson(ctx, Math.round(cook.x), Math.round(cook.y), DENIZ, cook.dir, kf); }
      for (const p of parts) if (p.kind === 'shave') { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      ctx.drawImage(counter.img, counter.ox, counter.oy);
      if (!(cook.act === 'spett' || cook.act === 'kyl' || cook.act === 'frit')) drawCookTools(ctx);
      for (const tr of trays) {
        if (tr.bag) { const b = bagImg(); ctx.drawImage(b, tr.x - (b.width >> 1), CNT.top + 3 - b.height); continue; }
        const c = trayCanvas(tr.items); ctx.drawImage(c, tr.x - (TRAY_W >> 1), CNT.top + 3 - c.height);
      }
    });
    add(SLOT.y, () => {
      ctx.drawImage(slotImg.img, SLOT.x0, SLOT.top);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = (Math.floor(t * 3) + i) % 3 === 0 ? '#fff2b0' : ['#e8443a', '#ffd060', '#6ad0a0', '#3a7bd5', '#ff88bb'][i]; ctx.fillRect(SLOT.x0 + 4 + i * 4, SLOT.top + 8, 2, 1); }
    });
    STOOLS.forEach((sx, k) => {
      const s = seats[k];
      add(STOOL_Y, () => { ctx.drawImage(k === 1 ? stoolTaped : stoolImg, sx - 7, STOOL_Y - 16); drawSeated(ctx, s); });
    });
    for (const T of TABLES) {
      const sa = seatById(T.id + 'a'), sb = seatById(T.id + 'b');
      add(T.y, () => {
        ctx.drawImage(chairDown.img, sa.x - 8, sa.y - 22);
        drawSeated(ctx, sa);
        ctx.drawImage(tableImg, T.x - 15, T.y - 19);
        drawTrayAt(ctx, sa);
        drawTrayAt(ctx, sb);
      });
      add(sb.y, (c) => { c.drawImage(chairUp.img, sb.x - 8, sb.y - 22); drawSeated(c, sb); c.drawImage(chairUp.front, sb.x - 8, sb.y - 22); });
    }
    add(PLANT.y, () => ctx.drawImage(plantImg.img, PLANT.x - plantImg.ox, PLANT.y - plantImg.oy));
    add(BIN.y, () => ctx.drawImage(binImg.img, BIN.x - binImg.ox, BIN.y - binImg.oy));
    add(SIGN.y, () => ctx.drawImage(signImg.img, SIGN.x - signImg.ox, SIGN.y - signImg.oy));
    add(MOP.y, () => ctx.drawImage(mopImg.img, MOP.x - mopImg.ox, MOP.y - mopImg.oy));
    add(CRATES.y, () => ctx.drawImage(cratesImg.img, CRATES.x - cratesImg.ox, CRATES.y - cratesImg.oy));
    for (const G of guests) if (!G.fixed && (G.state === 'enter' || G.state === 'queue' || G.state === 'carry' || G.state === 'leave')) {
      add(G.w.py, (c) => {
        const carry = G.state === 'carry', walking = G.w.path.length > 0;
        const fr = carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0;
        const dir = G.state === 'queue' && !walking ? 'up' : G.w.dir;
        if (carry && dir === 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.items);
        drawPerson(c, G.w.px, G.w.py, G.look, dir, fr);
        if (carry && dir !== 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.items);
        if (G.state === 'leave' && G.bag) { const b = bagImg(); c.drawImage(b, Math.round(G.w.px) + (G.w.dir === 'left' ? -9 : 3), Math.round(G.w.py) - 19); }
      });
    }
    // andra spelare: sitter någon på en barstol lyfts figuren upp på den (som för mig själv)
    // och ritas efter stolen – world.js skickar bara platsens golvpunkt
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

    // ---- ånga från fritösen, flugorna ----
    for (const p of parts) {
      if (p.kind !== 'steam') continue;
      const k = 1 - p.age / p.max;
      ctx.fillStyle = `rgba(255,255,255,${(k * 0.5).toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.age < 0.4 ? 1 : 2, 1);
    }
    for (const f of flies) {
      if (f.dead) continue;
      ctx.fillStyle = '#141414'; ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      if (Math.floor(t * 20 + f.x) % 2) { ctx.fillStyle = '#b8c0c8'; ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 1, 1); ctx.fillRect(Math.round(f.x) + 1, Math.round(f.y) - 1, 1, 1); }
    }

    // ---- kvällen: rummet mörknar, neonet, skylten och lysrören tar över ----
    if (night || dark > 0.2) {
      const k = night ? 1 : Math.min(1, (dark - 0.2) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = k;
      ctx.fillStyle = tubeOn ? '#86789a' : '#6c6282'; // lysröret som krånglar gör kvällen mörkare
      ctx.fillRect(cx, 0, vw, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.drawImage(nightLight(), 0, 0);
      ctx.restore();
    }
    // ---- pratbubblor (ovanpå ljuset så att de syns även i kväll) ----
    const iView = (x) => x > cx - 10 && x < cx + vw + 10;
    for (const G of guests) {
      if (!G.bubble || G.bubble.until <= t) continue;
      if (G.state === 'queue' && G.bubble.icon) {
        if (!iView(G.w.px)) continue;
        orderBubble(ctx, Math.round(G.w.px), Math.round(G.w.py) - 44, G.items || [], G.bag);
      } else if (G.seat && G.state === 'sit' && G.bubble.text) {
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
    worldSeatsTaken(A, seats); // där en annan spelare sitter är det upptaget
    updateMe(dt);
    updateCook(dt);
    for (const G of guests) updateGuest(G, dt);
    updateStreet(dt);
    updateDoor(dt);
    updateFx(dt);
    updateParts(dt);
    if (pendingHello > 0) { pendingHello -= dt; if (pendingHello <= 0) talkCook.say(isNight(g.min / 60) ? $t('Sent ute? Grillen är varm!') : $t('Välkommen! Vad blir det?'), cookAt, 2.6); }
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (cams() - cam.x) * k;
    cam.y += (camYGoal() - cam.y) * Math.min(1, dt * 4);
    clampCamY();
  }
  // låt trafiken och köket komma igång direkt när man kliver in
  for (let i = 0; i < 60; i++) { updateStreet(1 / 15); updateParts(1 / 15); }

  function dbg() {
    return {
      me: me.state, seat: me.seat?.id || null,
      tray: me.tray ? me.tray.items.map((i) => i.id + ':' + i.stage + '/' + i.bites) : null,
      order: !!me.order, say: talkMe.text(), cookSay: talkCook.text(), door: +doorOpen.toFixed(2), doorForMe,
      x: Math.round(walker.px), y: Math.round(walker.py),
      money: g.money, hunger: +g.hunger.toFixed(2), energy: +g.energy.toFixed(2), got: { ...me.got },
      cook: cook.phase, cookAct: cook.act, jobs: jobs.length, queue: queue.length,
      traysOnCounter: trays.length, guests: guests.map((G) => G.state), sauce: me.sauce, camY: camY(),
    };
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return me.seat ? me.seat.y : walker.py; }, // platsens golvpunkt (barstolens lyft ritas hos var och en)
    // andra spelare ser mig sitta (och tugga så länge maten står framme)
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
      safe: () => safeBox(),
      cookSay: (text) => talkCook.say(text, cookAt, 4, { silent: true }),
      // pratbubblans överkant (med ramen) i skärmkoordinater, som den ritades senast – null = tyst
      bubbleTop: (who) => {
        const sp = who === 'cook' ? talkCook : talkMe, at = who === 'cook' ? cookAt : meAt, txt = sp.text();
        if (!txt) return null;
        const y = at().y;
        return Math.round(y - bubbleH(txt, 124, 5) - 4) + Math.ceil(bubbleY(txt, y, 124, 5) - y) - 1 + camY();
      },
      seated: () => (me.seat ? me.seat.id : null),
      tray: () => (me.tray ? me.tray.items.map((i) => ({ id: i.id, stage: i.stage, bites: i.bites })) : null),
      forceBuy: (ids, sauce) => buy(Array.isArray(ids) ? ids : [ids], sauce),
      eatFast: () => {
        for (let i = 0; i < 4000 && (me.tray || me.state === 'wait' || me.state === 'toCounter' || me.state === 'carry'); i++) {
          me.biteT = Math.min(me.biteT, 0.05);
          if (me.state === 'carry' && !walker.path.length && !me.res && !me.seat) { const s = pickSeat(); if (s) goSit(s); }
          update(1 / 30);
        }
        return dbg();
      },
      state: dbg,
      menu: KEBAB_MENY.map((m) => ({ id: m.id, price: m.price, fill: m.fill, energy: m.energy, bites: m.bites })),
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
      goal: () => { goalT = t; score[0]++; },
      zap: () => { zapT = t; zapX = (ZAP.x0 + ZAP.x1) / 2; zapY = ZAP.y1; },
      cookTo: (act) => { const at = { spett: [SPITS[0].x - 3, COOK_BACK, 'up'], frit: [FRY_X, COOK_BACK, 'up'], kyl: [FRIDGE_X, COOK_BACK, 'up'], sallad: [SALAD_X, COOK_FRONT, 'down'], sas: [SAUCE_X, COOK_FRONT, 'down'] }[act]; if (!at) return; cook.x = cook.tx = at[0]; cook.y = cook.ty = at[1]; cook.face = at[2]; cook.idleAct = act; cook.idleT = 99; cook.dir = at[2]; cook.act = act; },
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d'), vt = visTop;
        x.imageSmoothingEnabled = false;
        visTop = 0; // hela lokalen syns
        drawWorld(x, 0, W);
        talkCook.draw(x, { x0: 0, x1: W }); talkMe.draw(x, { x0: 0, x1: W });
        visTop = vt;
        return c.toDataURL('image/png');
      },
      // alla rätter i alla tuggsteg + brickor (förhandsbild för utvecklingen)
      sheet: () => {
        const c = mkCanvas(200, 120), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.fillStyle = '#e8dcc4'; x.fillRect(0, 0, 200, 120);
        KEBAB_MENY.forEach((m, r) => { for (let s = 0; s <= m.bites; s++) x.drawImage(dishImg(m.id, s, m.bites, r === 0 ? 'vitlok' : 'stark'), 4 + s * 24, 4 + r * 18); });
        const tr = [[{ id: 'kebab', stage: 0, bites: 4, sauce: 'mix' }, { id: 'pommes', stage: 0, bites: 3 }, { id: 'lask', stage: 0, bites: 2 }], [{ id: 'falafel', stage: 2, bites: 4, sauce: 'vitlok' }, { id: 'lask', stage: 1, bites: 2 }], [{ id: 'kebab', stage: 4, bites: 4, sauce: 'stark' }, { id: 'pommes', stage: 3, bites: 3 }, { id: 'lask', stage: 2, bites: 2 }]];
        tr.forEach((items, k) => x.drawImage(trayCanvas(items), 130, 4 + k * 26));
        x.drawImage(bagImg(), 176, 8);
        return c.toDataURL('image/png');
      },
    },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy - camY();
      if (me.state === 'wait' || me.state === 'toCounter') {
        if (t - me.waitMsgT > 2) { talkMe.say($t`🥙 ${COOK_NAME} gör i ordning min beställning ...`, meAt); me.waitMsgT = t; }
        return;
      }
      const atDoor = (px, py) => px > DOOR.x0 - 10 && px < DOOR.x1 + 10 && py < WALL_Y + 14;
      if (me.state === 'carry') {
        const s = seatAt(x, y);
        if (s && !s.occ) { goSit(s); play('click'); return; }
        if (s && s.occ) { if (t - me.waitMsgT > 2) { talkMe.say($t('😕 Där sitter någon redan!'), meAt); me.waitMsgT = t; } return; }
        const h = spotAt(x, y);
        // med maten i händerna kommer man inte ut – och disken och menyn får vänta
        if ((h && h.id === 'dorr') || atDoor(x, y)) { nag(MSG_DORR); return; }
        if (h && (h.id === 'disk' || h.id === 'meny' || h.id === 'kyl')) { nag(MSG_ATUPP); return; }
        if (y > WALL_Y) { release(); walker.walkTo(x, y); return; }  // golvklick = ångra platsvalet
        if (t - me.waitMsgT > 2.5) { talkMe.say($t('🥙 Klicka på en ledig plats så sätter jag mig där.'), meAt); me.waitMsgT = t; }
        return;
      }
      if (me.state === 'sit' && me.tray) {
        // mitt i maten: man sitter kvar tills det är uppätet (prata med gästerna går bra)
        const h = spotAt(x, y);
        if ((h && h.id === 'dorr') || atDoor(x, y)) { nag(MSG_DORR); return; }
        const s = seatAt(x, y);
        if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') {
          s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 };
          play('click');
          return;
        }
        nag(MSG_ATUPP);
        return;
      }
      if (me.state === 'sit') standUp();
      release();
      const h = spotAt(x, y);
      if (h) { const [gx, gy] = h.go(x); walker.walkTo(gx, gy, h.act); return; }
      const s = seatAt(x, y);
      if (s && !s.occ) { goSit(s); return; }
      if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') {
        s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 };
        play('click');
        return;
      }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy - camY())?.id || null; hoverT = t; },
    key() {},
    // Får man lämna grillen just nu? null = ja, annars repliken (som figuren också säger).
    // { quiet: true } = bara fråga (ingen pratbubbla), t.ex. för omladdningen i version-ui.js.
    leaveBlock(o) {
      if (!me.order) return null;
      if (!o?.quiet) nag(MSG_DORR);
      return MSG_DORR;
    },
    // Scenen byts: blev maten inte uppäten (somnade vid midnatt, 👥-menyn …) får man det som
    // var kvar ändå – betald mat går aldrig förlorad.
    exit() {
      for (const [el, ev, fn] of UNLOAD) el.removeEventListener(ev, fn, true);
      if (settleOrder()) {
        for (const it of me.order) it.stage = it.bites;
        me.order = null; me.tray = null;
        g.save();
      }
      alive = false;
      // bara grillens egen meny stängs – huvudprogrammets dialoger (t.ex. "Utmattad!") får vara kvar
      if (modalOpen() && document.querySelector('#modal .dlg')?.dataset.title === MENU_TITLE) closeModal();
      talkMe.clear(); talkCook.clear();
    },
    draw(ctx) {
      syncView(A); // skärmen kan ha ändrat storlek – vyn följer med
      clampCamY();
      const cx = Math.round(cam.x), cy = camY(), sb = safeBox();
      // remsan som kameran blottar utanför lokalen (ligger alltid i den beskurna kanten)
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.fillStyle = '#17151a';
      if (cy > 0) ctx.fillRect(0, 0, VW, cy);
      if (cy < 0) ctx.fillRect(0, H + cy, VW, -cy);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, cy * A.pxs);
      visTop = sb.y0 - cy;
      const view = { x0: cx + sb.x0, x1: cx + sb.x1 }; // pratbubblorna hålls innanför det som syns
      drawWorld(ctx, cx, VW, view);
      if (cook.x > cx - 6 && cook.x < cx + VW + 6) drawSpeech(ctx, talkCook, cookAt, view);
      drawSpeech(ctx, talkMe, meAt, view);
      // skylt i nederkanten när man pekar på något klickbart (innanför den synliga rutan)
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const h = hoverId && t - hoverT < 3 ? hoverId : null;
      const label = h === 'disk' || h === 'meny' ? $t('BESTÄLL VID DISKEN') : h === 'kyl' ? $t('LÄSKKYLEN - LÄSK 15 KR')
        : h === 'dorr' ? (me.order ? $t('ÄT UPP MATEN FÖRST - SEN KAN DU GÅ UT') : $t('GÅ UT')) : h === 'spett' ? $t('GRILLSPETTEN - KÖTT OCH KYCKLING')
          : h === 'spel' ? $t('SPELAUTOMATEN') : h === 'tv' ? $t('TV:N - FOTBOLL') : h === 'zap' ? $t('FLUGFÅNGAREN') : h === 'affisch' ? $t('AFFISCHEN')
            : h === 'skylt' ? $t('HALT GOLV') : h === 'fikus' ? $t('PLASTFIKUSEN') : h === 'mopp' ? $t('MOPPEN') : h === 'backar' ? $t('LÄSKBACKARNA') : null;

      if (label) {
        const w = textW(SMALL, label) + 10, lx = (sb.x0 + sb.x1 - w) >> 1, ly = sb.y1 - 14;
        ctx.fillStyle = '#17151a'; ctx.fillRect(lx, ly, w, 11);
        ctx.fillStyle = '#e8b230'; ctx.fillRect(lx + 1, ly + 1, w - 2, 1);
        ctxText(ctx, SMALL, label, lx + 5, ly + 4, '#f4f1ea');
      }
    },
  };
}
