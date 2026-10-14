// 🪴 BLOMLÅDORNA längs promenaden (v0.136, Carl 2026-10-14: "träden måste stå lite mer organiserat – i rader eller
// blomlådor, nu står det lite random tillsammans med kaktusen"). En rad vita planteringslådor längs Marknadsgatans
// framkant, i jämn takt mellan vimpelstängerna och bänkarna: vartannat ett klippt kulträd, vartannat en blomlåda.
// I Vilda västern (radiobilarna) står kaktusar i tunnor i samma rad, och i Spökgränd svarta lådor med döda buskar
// och pumpor som lyser på kvällen. Lådorna är låga (under 40 px) så att de aldrig skymmer tältstånden bakom.
// Origo = lådans fot (mitten av framkanten). Bilderna cachas (bild) – en per sort.
import { hash, mix } from '../core/floor-pix.js';
import { tone, fyll, bild, put, skugga, F } from '../core/pennor.js';

const { VIT, JARN, TRA, BLAD, SAND, GLD, ROSA, LILA } = F;
const SVART = [0x14121a, 0x24202c, 0x36323e, 0x4a4652, 0x5e5a68];
const KAKT = [0x1e5a26, 0x2a7a32, 0x3a9a40, 0x5ab858, 0x8ad880];
const PUMPA = [0x7a3a08, 0xb85a14, 0xf08a2a, 0xf8a84a, 0xffd08a];
const DOD = [0x1a1410, 0x2e241c, 0x463828, 0x5e4c38, 0x786450];
const BLOM = [0xe0383c, 0xf0c030, 0xf06aa0, 0xffffff, 0x8a5ad0, 0xf08a2a];

export const LADOR_Y = 467;   // fotlinjen: promenadens framkant (vimpelstängerna står på 428–476)
// x-lägena: två per fack mellan vimpelstängerna (200, 420, 640 … var 220:e px), fritt från bänkarna (620, 980, 1300, 1990)
export const LADOR = [
  [380, 'trad'],
  [493, 'trad'], [567, 'blom'], [713, 'trad'], [787, 'blom'], [933, 'trad'], [1012, 'blom'],
  [1153, 'trad'], [1227, 'blom'], [1373, 'trad'], [1447, 'blom'], [1593, 'trad'],
  [1667, 'kaktus'], [1813, 'kaktus'], [1887, 'kaktus'],      // 🤠 Vilda västern – framför radiobilarna
  [2033, 'trad'], [2107, 'blom'],                              // 🎯 kast- och skjutstånden
  [2253, 'spok'], [2327, 'spok'], [2473, 'spok'],              // 👻 Spökgränd
].map(([x, typ]) => ({ x, y: LADOR_Y, typ }));
export const ladHinder = () => LADOR.map((l) => [l.x - 13, l.y - 7, l.x + 14, l.y + 1]);

// ---------------------------------------------------------------- lådorna
// en vit "Versailles-låda": liggande brädor, ljus kant upptill, hörnstolpar med små guldkulor, en färgad list
function lada(P, pal, list) {
  fyll(P, -11, -7, 10, 0, (X, Y) => tone(pal, 0.78 - (X + 11) * 0.012 - (Y + 7) * 0.02 + ((Y + 7) % 3 === 2 ? -0.16 : 0) + (hash(X >> 1, Y, 3) - 0.5) * 0.05, X, Y));
  P.hl(-12, -9, 24, pal[4]); P.hl(-12, -8, 24, pal[3]);
  for (const sx of [-13, 11]) {
    fyll(P, sx, -11, sx + 1, 0, (X, Y) => tone(pal, (X === sx ? 0.92 : 0.55) - (Y === 0 ? 0.25 : 0), X, Y));
    P.px(sx, -12, GLD[3]); P.px(sx + 1, -12, GLD[1]); P.px(sx, -13, GLD[4]); P.px(sx + 1, -13, GLD[2]);
  }
  P.hl(-11, -4, 22, list); P.hl(-11, -3, 22, list, 0.5);
  P.hl(-11, 0, 22, 0x000000, 0.25);
}
// jorden som syns bakom kanten
const jord = (P) => fyll(P, -10, -11, 9, -10, (X, Y) => tone(TRA, 0.22 + hash(X, Y, 7) * 0.2, X, Y));
// blommor i en rad: lite grönt och en blomma här och var (x0–x1, med foten på y)
function blommor(P, x0, x1, y, fro, hog = 3) {
  for (let X = x0; X <= x1; X++) {
    const h = 1 + ((hash(X, fro, 13) * hog) | 0);
    for (let j = 0; j < h; j++) P.px(X, y - j, tone(BLAD, 0.42 + hash(X, j + fro, 14) * 0.45, X, j));
    if (hash(X, fro + 1, 13) > 0.42) { const c = BLOM[(hash(X, fro + 2, 13) * BLOM.length) | 0]; P.px(X, y - h, c); if (hash(X, fro + 3, 7) > 0.55 && X < x1) P.px(X + 1, y - h, mix(c, 0xffffff, 0.45)); }
  }
}
// ett klippt kulträd: rak stam, rund krona med ljuset från vänster och mörk undersida
function kultrad(P) {
  fyll(P, -1, -23, 0, -9, (X, Y) => tone(TRA, X === -1 ? 0.62 : 0.36, X, Y));
  const cx = 0, cy = -31, r = 8;
  fyll(P, cx - r, cy - r, cx + r, cy + r, (X, Y) => {
    const d = Math.hypot((X + 0.5 - cx) / (r + 0.5), (Y + 0.5 - cy) / (r + 0.5));
    if (d > 1) return null;
    return tone(BLAD, 0.58 - (X - cx) * 0.03 - (Y - cy) * 0.045 + (hash(X, Y, 5) - 0.5) * 0.22 - (d > 0.86 ? 0.14 : 0), X, Y);
  });
  for (const [lx, ly] of [[-4, -36], [-1, -37], [-5, -32], [2, -35], [-3, -29]]) P.px(lx, ly, BLAD[4]);
  for (const [lx, ly] of [[3, -25], [5, -28], [1, -24]]) P.px(lx, ly, BLAD[0]);
}
// ---------------------------------------------------------------- 🤠 kaktusen i tunnan
function tunna(P) {
  fyll(P, -11, -9, 10, 0, (X, Y) => tone(TRA, 0.6 - (X + 11) / 22 * 0.3 + ((X + 11) % 4 === 3 ? -0.18 : 0) + (Y === -9 ? 0.12 : 0), X, Y));
  P.hl(-12, -10, 24, TRA[4]);
  P.hl(-11, -7, 22, JARN[3]); P.hl(-11, -6, 22, JARN[1]); P.hl(-11, -2, 22, JARN[3]); P.hl(-11, -1, 22, JARN[1]);
  P.hl(-11, 0, 22, 0x000000, 0.25);
  fyll(P, -10, -12, 9, -11, (X, Y) => tone(SAND, 0.62 + (hash(X, Y, 9) - 0.5) * 0.3, X, Y));
  P.px(-7, -13, VIT[2]); P.px(5, -13, VIT[1]); P.px(-2, -13, SAND[3]);
}
function kaktus(P) {
  fyll(P, -2, -35, 1, -12, (X, Y) => tone(KAKT, 0.6 - (X + 2) * 0.12 + ((Y % 3) === 0 ? 0.1 : 0), X, Y));
  fyll(P, -8, -28, -6, -18, (X, Y) => tone(KAKT, 0.65 - (X + 8) * 0.1, X, Y)); fyll(P, -8, -20, -3, -18, (X, Y) => tone(KAKT, 0.55, X, Y));
  fyll(P, 5, -32, 7, -22, (X, Y) => tone(KAKT, 0.65 - (X - 5) * 0.1, X, Y)); fyll(P, 2, -24, 7, -22, (X, Y) => tone(KAKT, 0.55, X, Y));
  for (let Y = -34; Y < -13; Y += 3) { P.px(-3, Y, 0xf4ecd8); P.px(2, Y + 1, 0xf4ecd8); }
  P.px(-1, -36, 0xf06aa0); P.px(0, -37, 0xf06aa0); P.px(-1, -37, 0xffb0d0);
}
// ---------------------------------------------------------------- 👻 den döda busken och pumpan
function dodBuske(P) {
  P.line(-3, -11, -3, -24, DOD[2]); P.line(-3, -18, -8, -26, DOD[2]); P.line(-3, -16, 1, -24, DOD[2]);
  P.line(-8, -26, -10, -31, DOD[1]); P.line(1, -24, 4, -29, DOD[1]); P.line(-3, -24, -5, -30, DOD[1]); P.line(-5, -30, -4, -34, DOD[1]); P.line(1, -24, -1, -28, DOD[1]);
  P.px(-10, -32, DOD[0]); P.px(4, -30, DOD[0]); P.px(-4, -35, DOD[0]);
  // spindelväv mellan två grenar
  for (let k = 0; k < 5; k++) P.px(-8 + k, -28 + (k % 2), 0xf4f1ea, 0.45);
}
function pumpa(P) {
  fyll(P, 3, -17, 10, -11, (X, Y) => { const dx = (X + 0.5 - 7) / 4, dy = (Y + 0.5 + 14) / 3.2; if (dx * dx + dy * dy > 1) return null; return tone(PUMPA, 0.62 - dx * 0.22 - dy * 0.18 + ((X - 3) % 3 === 0 ? -0.14 : 0), X, Y); });
  P.px(6, -18, 0x2e5a22); P.px(7, -19, 0x2e5a22); P.px(7, -18, 0x468634);
  P.px(5, -15, 0x1a1008); P.px(8, -15, 0x1a1008); P.hl(5, -13, 4, 0x1a1008); P.px(6, -12, 0x1a1008);   // ansiktet
}

const BILD = {
  trad: (P) => { lada(P, VIT, ROSA[2]); jord(P); blommor(P, -10, -3, -11, 1); blommor(P, 2, 9, -11, 2); kultrad(P); },
  blom: (P) => { lada(P, VIT, LILA[3]); jord(P); blommor(P, -10, 9, -11, 5, 5); blommor(P, -8, 7, -13, 8, 3); },
  kaktus: (P) => { tunna(P); kaktus(P); },
  spok: (P) => { lada(P, SVART, LILA[2]); fyll(P, -10, -11, 9, -10, (X, Y) => tone(DOD, 0.25 + hash(X, Y, 7) * 0.2, X, Y)); dodBuske(P); pumpa(P); },
};
export function ritaLada(ctx, x, y, typ) {
  skugga(ctx, x, y, 26);
  put(ctx, bild('lada|' + typ, 36, 48, 18, 44, BILD[typ] || BILD.blom), x, y);
}
// pumpans sken på kvällen (ritas i scenens ljuspass)
export const pumpaSken = (l) => (l.typ === 'spok' ? { x: l.x + 7, y: l.y - 14 } : null);
