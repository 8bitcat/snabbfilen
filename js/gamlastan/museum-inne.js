// 🏛️ MUSEET I GAMLA STAN inifrån (Carl 2026-11-18: "Gamla stan: … museum"). Rummet är 640 px brett och rullar med
// figuren. Väggen (y < 72): dörren UT, intendentens disk med kassan, TAVELGALLERIET (tre tavlor med skyltar), den stora
// banderollen PIXELSTADENS HISTORIA, höga fönster med gardiner, ett vapensköld. På golvet (y-sorterat av scenen):
// montrarna på piedestaler – KATTSTATYNS KRONA under glas, DEN FÖRSTA BUSSEN som modell, GUNVORS FOTBOLLSSKO, SOLÖNS
// GAMLA FYRLAMPA, PIRAT-PETTERS KISTA – och mitt i salen PIXELOSAURUS, skelettet, inhägnat av sammetsrep på stolpar.
// Golvet: marmorrutor i två toner, den röda löparen från dörren, spotlights i taket (skenet ritas av scenen).
// Allt stillastående målas EN gång (paintMuseumBg); montrarna, repen, skelettet ritas av ritarna längst ner.
import { Pix, SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { dorrmatta } from '../tassbacken/inne-kit.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, STEN, TRA } = FARGER;
const PUTS = [0x6a4a4a, 0x8a6060, 0xa87a7a, 0xc8a0a0, 0xe0c0c0];       // dammrosa putsvägg
const MARMOR = [0xb8b4b0, 0xd0ccc8, 0xe4e0dc, 0xf0ecea];
const MARMOR2 = [0x8a8684, 0xa8a4a0, 0xbcb8b4];
const GULD = [0x8a6a10, 0xb89020, 0xe0b830, 0xffe070];
const SAMMET = [0x5a0c14, 0x8a1820, 0xb8283a];
const BEN = [0xb8b0a0, 0xd8d0c0, 0xf0ece0];

export const MUS = {
  W: 640, H: 216, WALL_Y: 72,
  DOOR: { x0: 14, x1: 46 },
  DISK: { x: 56, y: 92, w: 64, h: 22 },                         // intendentens disk (golv)
  TAVLOR: [{ x0: 134, x1: 178 }, { x0: 190, x1: 234 }, { x0: 246, x1: 290 }],   // galleriet på väggen
  BANDEROLL: { x0: 300, x1: 470 },
  FONSTER: [{ x0: 482, x1: 516 }, { x0: 536, x1: 570 }],
  SKOLD: { x: 606, y: 36 },
  // montrarna på golvet (foten = piedestalens underkant)
  KRONA: { x: 170, y: 150 },
  BUSS: { x: 250, y: 196 },
  SKO: { x: 330, y: 146 },
  FYR: { x: 586, y: 150 },
  KISTA: { x: 560, y: 200 },
  DINO: { x0: 380, x1: 530, y0: 110, y1: 190, cx: 455, fy: 178 },   // skelettet och repen runt
  VAKT: { x: 540, y: 118 },
  SPOTS: [170, 250, 330, 455, 586],                               // spotlights i taket (x), skenet ritas av scenen
};
const { W, H, WALL_Y, DOOR, DISK, TAVLOR, BANDEROLL, FONSTER, SKOLD } = MUS;

// föremålen: id, namn, skylttext (det man lär sig), quizfråga med tre svar (rätt först – blandas i scenen)
export const FOREMAL = [
  { id: 'tavlor', namn: $t('Tavelgalleriet'), ik: '🖼️', fakta: $t('"Pixelstaden 1699" är stadens äldsta målning – torget, brunnen och bara sju hus. Bredvid: "Hamnen i storm" och Huldas självporträtt från Solön.'), fraga: $t('Hur många hus hade Pixelstaden på den äldsta målningen?'), svar: [$t('Sju'), $t('Tolv'), $t('Tre')] },
  { id: 'krona', namn: $t('Kattstatyns krona'), ik: '👑', fakta: $t('Kronan satt på kattstatyn i parken tills den försvann en höstnatt. Den hittades i en skatas bo – av en detektiv med förstoringsglas.'), fraga: $t('Var hittades kattstatyns krona?'), svar: [$t('I ett skatbo'), $t('I brunnen'), $t('På Pixelberg')] },
  { id: 'buss', namn: $t('Den första bussen'), ik: '🚌', fakta: $t('Linje 1 gick mellan Pixeltorget och Hamnen 1931. Bussen hade 14 platser, träbänkar och en klocka som chauffören ringde i kurvorna.'), fraga: $t('Hur många platser hade den första bussen?'), svar: [$t('Fjorton'), $t('Fyrtio'), $t('Fyra')] },
  { id: 'sko', namn: $t('Gunvors fotbollssko'), ik: '👟', fakta: $t('Den vänstra skon Gunvor Pixelsson hade på sig när hon gjorde bicycletamålet i finalen 1987. Dobbarna är fortfarande leriga.'), fraga: $t('Vilket år gjorde Gunvor bicycletamålet?'), svar: [$t('1987'), $t('1965'), $t('2001')] },
  { id: 'dino', namn: $t('Pixelosaurus'), ik: '🦕', fakta: $t('Skelettet grävdes fram vid Pixelbergets fot 1954. Pixelosaurus var åtta meter lång, åt barr och hade – tror man – fyrkantiga fjäll.'), fraga: $t('Var grävdes Pixelosaurus fram?'), svar: [$t('Vid Pixelberget'), $t('På Solön'), $t('Under Pixeltorget')] },
  { id: 'fyr', namn: $t('Solöns gamla fyrlampa'), ik: '🔦', fakta: $t('Linsen lyste från Solöns fyr i 90 år. Fyrvaktaren Hulda tände den varje kväll och skrev vädret i en bok – boken ligger kvar i stugan.'), fraga: $t('Hur länge lyste den gamla fyrlampan?'), svar: [$t('90 år'), $t('9 år'), $t('900 år')] },
  { id: 'kista', namn: $t('Pirat-Petters kista'), ik: '🧰', fakta: $t('Kistan flöt i land vid piren 1848. Tom – utom en karta med ett kryss som ingen har lyckats tyda. Museet låter barnen gissa var skatten ligger.'), fraga: $t('Vad låg i Pirat-Petters kista?'), svar: [$t('En karta med ett kryss'), $t('Guldmynt'), $t('En papegoja')] },
];

const PSTEN = (P, x, y, w, h) => { fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => tone(MARMOR2, 0.55 + (hash(X >> 2, Y >> 2, 7) - 0.5) * 0.2 + (Y === y ? 0.3 : 0) + (X === x ? 0.15 : 0), X, Y)); P.hl(x, y + h - 1, w, MARMOR2[0]); };

// ---------- väggen och golvet (en gång) ----------
let BGc = null;
export function paintMuseumBg() {
  if (BGc) return BGc;
  const P = new Pix(W, H);
  // väggen: puts med en bröstlist, golvlist, banderollen, dörren, tavlorna, fönstren, skölden
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, tone(PUTS, 0.62 + (hash(x >> 3, y >> 3, 3) - 0.5) * 0.06 + (y > 56 ? -0.1 : 0), x, y));
  for (let x = 0; x < W; x++) { P.px(x, 54, PUTS[4]); P.px(x, 55, PUTS[1]); P.px(x, WALL_Y - 2, MARMOR[0]); P.px(x, WALL_Y - 1, MARMOR[2]); }
  // dörren UT
  P.rect(DOOR.x0 - 3, 10, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 10, TRA[1]); P.rect(DOOR.x0, 14, DOOR.x1 - DOOR.x0, WALL_Y - 14, 0x4a2a14); P.vl((DOOR.x0 + DOOR.x1) >> 1, 16, WALL_Y - 18, 0x2a1a0c); P.px(DOOR.x1 - 5, 44, GULD[3]); P.px(DOOR.x0 + 4, 44, GULD[3]);
  const ut = $t('UT'), uw = textW(SMALL, ut); P.rect(DOOR.x0 + ((DOOR.x1 - DOOR.x0 - uw - 6) >> 1), 2, uw + 6, 9, 0x2a3a2a); text(P, SMALL, ut, DOOR.x0 + ((DOOR.x1 - DOOR.x0 - uw) >> 1), 4, 0x8ae08a);
  // tavlorna i galleriet: guldramar, motiv och små skyltar
  TAVLOR.forEach((T, i) => {
    const w = T.x1 - T.x0, h = 30, y0 = 12;
    P.rect(T.x0 - 3, y0 - 3, w + 6, h + 6, GULD[1]); P.box(T.x0 - 3, y0 - 3, w + 6, h + 6, GULD[0]); P.box(T.x0 - 2, y0 - 2, w + 4, h + 4, GULD[3]);
    if (i === 0) { for (let y = y0; y < y0 + h; y++) for (let x = T.x0; x < T.x0 + w; x++) P.px(x, y, y < y0 + 12 ? mix(0x9ab8d8, 0xd8e4ec, (y - y0) / 12) : mix(0x6a8a4a, 0x4a6a3a, hash(x, y, 4))); for (let k = 0; k < 7; k++) { const hx = T.x0 + 3 + k * 6, hh = 6 + (k % 3) * 2; P.rect(hx, y0 + 18 - hh, 4, hh, [0xd8a060, 0xc87a4a, 0xf0e0c0][k % 3]); P.rect(hx - 1, y0 + 16 - hh, 6, 2, 0x8a3a2a); } P.rect(T.x0 + 18, y0 + 20, 8, 4, 0x4a4a52); }
    else if (i === 1) { for (let y = y0; y < y0 + h; y++) for (let x = T.x0; x < T.x0 + w; x++) P.px(x, y, y < y0 + 14 ? mix(0x3a3a52, 0x6a6a80, hash(x >> 2, y >> 1, 5) * 0.5) : mix(0x1e4a66, 0x3a7a9a, Math.sin(x * 0.4 + y) * 0.3 + 0.5)); for (let x = T.x0; x < T.x0 + w; x += 3) P.px(x, y0 + 14 + Math.round(Math.sin(x * 0.5) * 2), 0xf4f1ea); P.rect(T.x0 + 16, y0 + 12, 10, 5, 0x5a3a20); P.vl(T.x0 + 20, y0 + 4, 9, 0x5a3a20); P.rect(T.x0 + 21, y0 + 5, 5, 5, 0xf4f1ea); }
    else { for (let y = y0; y < y0 + h; y++) for (let x = T.x0; x < T.x0 + w; x++) P.px(x, y, mix(0x8a6a4a, 0x6a4a3a, hash(x >> 2, y >> 2, 6) * 0.4)); P.rect(T.x0 + 16, y0 + 8, 12, 12, 0xf0cfae); P.rect(T.x0 + 15, y0 + 6, 14, 5, 0xb8b4ac); P.rect(T.x0 + 12, y0 + 20, 20, 10, 0x4a6a8a); P.px(T.x0 + 19, y0 + 13, 0x1a1a1a); P.px(T.x0 + 24, y0 + 13, 0x1a1a1a); P.rect(T.x0 + 19, y0 + 7, 6, 2, 0xd8d4cc); }
    P.rect(T.x0 + (w >> 1) - 10, y0 + h + 6, 20, 6, GULD[2]); P.hl(T.x0 + (w >> 1) - 10, y0 + h + 6, 20, GULD[3]); P.hl(T.x0 + (w >> 1) - 8, y0 + h + 9, 16, GULD[0]);
  });
  // banderollen: röd duk med guldtext, veck
  for (let y = 8; y < 44; y++) for (let x = BANDEROLL.x0; x < BANDEROLL.x1; x++) P.px(x, y, tone(SAMMET, 0.5 + Math.sin(x * 0.25) * 0.15 + (y > 40 && ((x >> 2) & 1) ? -0.2 : 0), x, y));
  for (let x = BANDEROLL.x0; x < BANDEROLL.x1; x += 4) P.rect(x, 42, 2, 4, GULD[2]);
  const b1 = $t('MUSEET'), b2 = $t('PIXELSTADENS HISTORIA'), bc = (BANDEROLL.x0 + BANDEROLL.x1) >> 1;
  text(P, SMALL, b1, bc - (textW(SMALL, b1) >> 1), 13, GULD[3]); text(P, SMALL, b2, bc - (textW(SMALL, b2) >> 1), 26, GULD[3]);
  P.hl(BANDEROLL.x0 - 6, 6, BANDEROLL.x1 - BANDEROLL.x0 + 12, GULD[1]); P.rect(BANDEROLL.x0 - 8, 4, 4, 4, GULD[2]); P.rect(BANDEROLL.x1 + 4, 4, 4, 4, GULD[2]);
  // fönstren med gardiner, dagsljus
  for (const F of FONSTER) { P.rect(F.x0 - 2, 8, F.x1 - F.x0 + 4, 44, VIT[3]); for (let y = 10; y < 50; y++) for (let x = F.x0; x < F.x1; x++) P.px(x, y, mix(0xa8d0f0, 0xe0f0f8, (y - 10) / 40)); P.vl((F.x0 + F.x1) >> 1, 10, 40, VIT[3]); P.hl(F.x0, 30, F.x1 - F.x0, VIT[3]); for (const gx of [F.x0 - 8, F.x1 + 1]) for (let y = 6; y < 54; y++) for (let k = 0; k < 7; k++) P.px(gx + k, y, tone(SAMMET, 0.5 + ((k + (y >> 2)) % 3 === 0 ? -0.2 : 0.1), gx + k, y)); P.hl(F.x0 - 10, 5, F.x1 - F.x0 + 20, GULD[1]); }
  // vapenskölden
  spr(P, SKOLD.x - 8, SKOLD.y - 12, ['gggggggggggggggg', 'grrrrrrrbbbbbbbg', 'grrrrrrrbbbbbbbg', 'grrrryrrbbbybbbg', 'grrrrrrrbbbbbbbg', 'gbbbbbbbrrrrrrrg', 'gbbbybbbrrryrrrg', 'gbbbbbbbrrrrrrrg', '.gbbbbbbrrrrrrg.', '..gbbbbbrrrrrg..', '...ggbbbrrrgg...', '.....gggggg.....'], { g: GULD[2], r: SAMMET[1], b: 0x2a4a9a, y: GULD[3] });
  // golvet: marmorrutor, den röda löparen från dörren, gränsen mot väggen
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) { const rx = Math.floor(x / 16), ry = Math.floor((y - WALL_Y) / 12), m = (rx + ry) & 1; P.px(x, y, mix(m ? MARMOR[1] : MARMOR[3], m ? MARMOR[0] : MARMOR[2], (hash(x >> 1, y >> 1, 8) * 0.6 + ((x % 16 === 15 || (y - WALL_Y) % 12 === 11) ? 0.6 : 0)))); if (hash(x, y, 9) > 0.985) P.px(x, y, 0xffffff); }
  for (let y = WALL_Y; y < H; y++) for (let x = DOOR.x0 - 10; x < DOOR.x1 + 10; x++) P.px(x, y, (x === DOOR.x0 - 10 || x === DOOR.x1 + 9) ? GULD[2] : tone(SAMMET, 0.5 + (hash(x >> 2, y >> 2, 10) - 0.5) * 0.1, x, y));   // löparen
  dorrmatta(P, (DOOR.x0 + DOOR.x1) >> 1, WALL_Y + 4, 30, 8);
  BGc = P.flush(); return BGc;
}

// ---------- golvets saker (ritas y-sorterat av scenen) ----------
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
function piedestal(P, w, h) { PSTEN(P, -(w >> 1), -h, w, h); P.rect(-(w >> 1) - 2, -h, w + 4, 3, MARMOR2[2]); P.rect(-(w >> 1) - 2, -3, w + 4, 3, MARMOR2[0]); }
function glas(P, x0, y0, x1, y1) { fyll(P, x0, y0, x1, y1, (X, Y) => (X === x0 || X === x1 || Y === y0 || Y === y1 ? 0xd8e8f4 : null)); P.vl(x0 + 2, y0 + 2, Math.max(1, (y1 - y0) >> 1), 0xffffff, 0.6); }
function skylt(P, s, cx, y) { const w = textW(SMALL, s) + 6; P.rect(cx - (w >> 1), y, w, 9, GULD[2]); P.box(cx - (w >> 1), y, w, 9, GULD[0]); text(P, SMALL, s, cx - (w >> 1) + 3, y + 2, 0x2a1a0c); }
export function ritaKrona(ctx, x, y, t) {
  put(ctx, bild('krona', 40, 70, 20, 66, (P) => { piedestal(P, 26, 26); glas(P, -11, -56, 11, -27); spr(P, -7, -48, ['g.g.g.g.g.g.g', 'ggggggggggggg', 'gbgggrgggbggg', 'ggggggggggggg', '.ggggggggggg.'], { g: GULD[2], b: 0x2a4ab0, r: SAMMET[2] }); P.hl(-6, -43, 13, GULD[3]); P.rect(-8, -41, 17, 2, SAMMET[1]); skylt(P, $t('KRONAN'), 0, -26 + 4); }), x, y);
  if (Math.floor(t * 2) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4 + Math.floor(t) % 7, y - 50, 1, 1); }
}
export function ritaBussModell(ctx, x, y) {
  put(ctx, bild('bussm', 60, 56, 30, 52, (P) => { piedestal(P, 50, 20); P.rect(-22, -42, 44, 18, 0xd8343c); P.hl(-22, -42, 44, 0xf07a7a); P.rect(-22, -34, 44, 2, 0xf4f1ea); for (let k = 0; k < 5; k++) P.rect(-18 + k * 8, -40, 6, 5, 0x8ab4d8); P.rect(-23, -28, 46, 3, 0x1a1414); P.rect(-16, -26, 6, 4, 0x1a1414); P.rect(10, -26, 6, 4, 0x1a1414); P.px(-21, -30, GULD[3]); P.px(20, -30, GULD[3]); skylt(P, $t('LINJE 1 · 1931'), 0, -18); }), x, y);
}
export function ritaSko(ctx, x, y) {
  put(ctx, bild('sko', 40, 66, 20, 62, (P) => { piedestal(P, 26, 26); glas(P, -11, -52, 11, -27); P.rect(-8, -36, 14, 6, 0x1a1414); P.rect(-8, -40, 8, 5, 0x1a1414); P.hl(-7, -39, 6, 0xf4f1ea); P.rect(-8, -31, 16, 2, 0x8a6a40); for (let k = 0; k < 4; k++) P.px(-6 + k * 3, -29, 0x6a4a20); P.rect(0, -38, 2, 1, 0xf4f1ea); skylt(P, $t('GUNVOR 1987'), 0, -22); }), x, y);
}
export function ritaFyrlampa(ctx, x, y, t) {
  put(ctx, bild('fyrl', 44, 76, 22, 72, (P) => { piedestal(P, 30, 24); P.rect(-10, -48, 20, 24, JARN[1]); P.vl(-10, -48, 24, JARN[3]); for (let j = -46; j < -26; j += 4) P.hl(-8, j, 16, 0xe0f0f8); for (let j = -44; j < -26; j += 4) P.hl(-8, j, 16, 0xb8d8e8); P.rect(-12, -50, 24, 3, JARN[2]); P.rect(-4, -56, 8, 6, JARN[2]); P.px(0, -58, GULD[3]); skylt(P, $t('SOLÖNS FYR'), 0, -20); }), x, y);
  const a = 0.25 + Math.sin(t * 1.5) * 0.15; ctx.fillStyle = `rgba(255,240,160,${a.toFixed(2)})`; ctx.fillRect(x - 6, y - 44, 12, 14);
}
export function ritaKista(ctx, x, y) {
  put(ctx, bild('kista', 46, 40, 23, 36, (P) => { PSTEN(P, -20, -8, 40, 8); fyll(P, -17, -28, 16, -9, (X, Y) => tone(TRA, 0.5 + ((Y + 28) % 5 === 4 ? -0.2 : 0) + (hash(X >> 2, Y >> 2, 11) - 0.5) * 0.1, X, Y)); for (let j = 0; j < 6; j++) P.hl(-17 + j, -34 + j, 34 - j * 2, j < 2 ? TRA[3] : TRA[1]); P.rect(-17, -22, 34, 2, JARN[2]); P.rect(-2, -24, 5, 6, GULD[2]); P.px(0, -22, 0x1a1a1a); P.vl(-12, -28, 19, JARN[2]); P.vl(11, -28, 19, JARN[2]); P.rect(-10, -31, 20, 2, 0xe8d8b0); P.rect(-4, -31, 3, 1, 0xd8343c); skylt(P, $t('PIRAT-PETTER 1848'), 0, -6); }), x, y);
}
// skelettet: ryggrad med revben, hals upp till huvudet, svans, fyra ben – allt på en låg sockel, repen runt
export function ritaDino(ctx) {
  const D = MUS.DINO;
  put(ctx, bild('dino', 180, 100, 90, 96, (P) => {
    PSTEN(P, -80, -14, 160, 14);
    const b = (x0, y0, x1, y1) => P.line(x0, y0, x1, y1, BEN[1]);
    // ryggrad från svansspets till nacke
    const rygg = [[-76, -40], [-60, -50], [-40, -56], [-20, -58], [0, -58], [20, -56], [40, -52], [52, -50]];
    for (let i = 0; i < rygg.length - 1; i++) { b(...rygg[i], ...rygg[i + 1]); P.px(rygg[i][0], rygg[i][1] - 1, BEN[2]); }
    for (let k = 0; k < 7; k++) { const x = -34 + k * 10, y = -56 + Math.abs(k - 3); b(x, y, x - 4, y + 22); b(x - 4, y + 22, x - 1, y + 26); b(x - 4, y + 22 - 10, x + 2, y + 22 - 8); }   // revben
    b(52, -50, 60, -70); b(60, -70, 64, -84);   // halsen
    P.rect(58, -96, 22, 12, BEN[1]); P.rect(70, -92, 12, 8, BEN[2]); P.rect(74, -90, 3, 3, 0x1a1a1a); for (let k = 0; k < 5; k++) P.px(62 + k * 4, -84, BEN[0]);   // huvudet med öga och tänder
    for (const lx of [-30, 30]) { b(lx, -40, lx - 6, -24); b(lx - 6, -24, lx - 2, -14); b(lx + 6, -40, lx + 10, -24); b(lx + 10, -24, lx + 6, -14); P.rect(lx - 6, -15, 8, 2, BEN[0]); P.rect(lx + 4, -15, 8, 2, BEN[0]); }   // benen
    for (let k = 0; k < 4; k++) P.rect(-74 + k * 12, -41 + k, 2, 2, BEN[0]);
    const s = $t('PIXELOSAURUS'); P.rect(-(textW(SMALL, s) >> 1) - 4, -12, textW(SMALL, s) + 8, 9, GULD[2]); text(P, SMALL, s, -(textW(SMALL, s) >> 1), -10, 0x2a1a0c);
  }), D.cx, D.fy);
}
export function ritaRep(ctx) {
  const D = MUS.DINO, post = (x, y) => { ctx.fillStyle = '#b89020'; ctx.fillRect(x - 1, y - 18, 3, 18); ctx.fillStyle = '#ffe070'; ctx.fillRect(x - 2, y - 20, 5, 3); ctx.fillStyle = '#8a6a10'; ctx.fillRect(x - 3, y - 1, 7, 2); };
  const pts = [[D.x0, D.y1], [D.cx, D.y1 + 4], [D.x1, D.y1], [D.x1 + 6, D.y0 + 30], [D.x0 - 6, D.y0 + 30]];
  ctx.strokeStyle = '#8a1820'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; ctx.moveTo(x0, y0 - 14); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 8, x1, y1 - 14); }
  ctx.stroke();
  for (const [x, y] of pts) post(x, y);
}
export function ritaDisk(ctx) {
  const { x, y, w, h } = DISK;
  put(ctx, bild('disk', w + 4, h + 30, 2, h + 26, (P) => { fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(TRA, 0.5 + ((Y + h) % 6 === 0 ? -0.15 : 0) + (hash(X >> 3, Y >> 2, 12) - 0.5) * 0.1, X, Y)); P.rect(-2, -h - 3, w + 4, 4, TRA[3]); P.hl(-2, -h - 3, w + 4, TRA[4]); P.rect(6, -h - 12, 14, 9, 0x2a2a30); P.rect(7, -h - 11, 12, 6, 0x8ae08a); P.rect(w - 22, -h - 8, 12, 5, 0xf4f1ea); for (let k = 0; k < 3; k++) P.hl(w - 20, -h - 7 + k * 2, 8, 0x8a8a94); skylt(P, $t('ENTRÉ'), w >> 1, -h + 6); }), x + 2, y + h + 4);
}
export { W as MUS_W, H as MUS_H };
