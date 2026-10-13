// 🏮 MARKNADSGATAN på Pixelberg – ministaden (Carl 2026-10-13: "pixelberg känns fortfarande väldigt öde, du kan ju göra
// gångar mellan allting nästan som en ministad med stånd överallt"). En rad mindre TÄLTSTÅND mitt på torget i grupper
// med tvärgränder emellan: man går i gränden bakom dem (mellan borden och stånden) och på promenaden framför.
// Samma hantverk som de stora stånden (js/pixelberg/kiosk.js): tonramper med dither, ljus från vänster, glödlampor.
//   tältet: ett randigt spetstak med en vimpel, bågkant med glödlampor, en liten hängskylt med namnet, tältväggen bakom
//   och ett bord med randig duk; varorna målas av varje stånd (inne = på väggen/hyllorna, bord = på bordet)
//   live(): det som rör sig – våffeljärnets ånga, korven som fräser, ankorna i fiskdammen, ballongerna
// Origo (0, 0) = mitt på ståndets fotlinje.
import { Pix, SMALL, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';
import { tone, klot, CREAM, WOOD, STEEL, IRON, GOLD, ROSA, ROD, BLA, GUL, TURK, LILA, GRON } from './kiosk.js';
import { knippe } from './liv.js';

const ORANGE = [0x6a3008, 0xb05a14, 0xee8a2a, 0xf8b462, 0xffdcac];
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const spr = (w, h, ax, ay, fn) => { const P = new Pix(w, h, -ax, -ay); fn(P); return { img: P.flush(), ax, ay }; };

// ---------- tältet ----------
function talt(S, natt, lampor) {
  const W = S.W, hw0 = (W >> 1) + 2, A = S.tema.a, B = S.tema.b;
  return spr(W + 24, 92, (W + 24) >> 1, 84, (P) => {
    // tältväggen bakom (veck), stolparna fram
    for (let y = -42; y <= -13; y++) for (let x = -(W >> 1) + 3; x <= (W >> 1) - 4; x++) {
      const veck = Math.sin(x * 0.55) * 0.08, top = y < -38 ? (y + 42) * 0.06 - 0.24 : 0;
      P.px(x, y, mul(tone(B, 0.62 + veck - (x + (W >> 1)) / W * 0.12 + top, x, y), natt ? 0.9 : 1));
    }
    S.inne(P, natt);
    for (const sx of [-(W >> 1) + 1, (W >> 1) - 3]) for (let y = -44; y <= 0; y++) { P.px(sx, y, tone(WOOD, 0.85, sx, y)); P.px(sx + 1, y, tone(WOOD, 0.45, sx, y)); }
    // spetstaket: våder som strålar ut från toppen, ljust till vänster
    for (let y = -62; y <= -44; y++) {
      const hw = Math.round((y + 62) / 18 * hw0);
      for (let x = -hw; x <= hw; x++) {
        const u = hw ? x / hw : 0, panel = Math.floor((u + 1) * 4) % 2 === 0, pal = panel ? A : B;
        let v = 0.9 - (u + 1) * 0.22 - (y + 62) / 18 * 0.12;
        if (Math.abs(x) === hw) v -= 0.25;
        P.px(x, y, tone(pal, v, x, y));
      }
    }
    // bågkanten med glödlampor
    const BAGE = [2, 3, 3, 2, 1, 0, 0, 1];
    for (let x = -hw0; x <= hw0; x++) {
      const i = x + hw0, panel = Math.floor(i / 6) % 2 === 0, yb = -43 + BAGE[i % 8];
      for (let y = -43; y <= yb; y++) P.px(x, y, tone(panel ? A : B, y === yb ? 0.25 : 0.7, x, y));
      P.px(x, yb + 1, 0x1e1626, 0.4);
      if (i % 8 === 2) lampor.push([x, yb + 1]);
    }
    // vimpeln på toppen
    P.vl(0, -70, 8, IRON[3]); for (let j = 0; j < 4; j++) P.hl(1, -70 + j, 6 - j * 2 > 0 ? 6 - j * 2 : 1, j === 0 ? mix(A[2], 0xffffff, 0.3) : A[2]); P.px(0, -71, GOLD[3]);
    // hängskylten med namnet
    const tw = textW(SMALL, S.namn), sw = tw + 6, sx = -(sw >> 1);
    P.vl(sx + 2, -41, 3, IRON[2]); P.vl(sx + sw - 3, -41, 3, IRON[2]);
    for (let y = -38; y <= -31; y++) for (let x = sx; x < sx + sw; x++) P.px(x, y, x === sx || x === sx + sw - 1 || y === -38 || y === -31 ? tone(GOLD, 0.7, x, y) : tone(S.tema.skylt, 0.75, x, y));
    text(P, SMALL, S.namn, sx + 3, -36, S.tema.skyltText);
    lampor.push([sx, -38], [sx + sw - 1, -38]);
  });
}
// bordet med randig duk (bågad nederkant) och det som ligger på bordet
function bord(S, natt) {
  const W = S.W;
  return spr(W + 24, 40, (W + 24) >> 1, 32, (P) => {
    const x0 = -(W >> 1) + 2, x1 = (W >> 1) - 3;
    for (let x = x0; x <= x1; x++) { P.px(x, -14, tone(WOOD, 0.95, x, 0)); P.px(x, -13, tone(WOOD, 0.55, x, 0)); }
    const BAGE = [3, 2, 1, 1, 2, 3];
    for (let x = x0; x <= x1; x++) {
      const yb = -2 - BAGE[(x - x0) % 6] + 2, rand = Math.floor((x - x0) / 4) % 2 === 0;
      for (let y = -12; y <= yb; y++) P.px(x, y, tone(rand ? S.tema.duk : CREAM, 0.78 - (x - x0) / W * 0.2 - (y + 12) * 0.02, x, y));
      P.px(x, yb + 1, 0x1e1626, 0.35);
    }
    for (const lx of [x0 + 2, x1 - 2]) { P.vl(lx, -1, 2, WOOD[1]); }
    S.bord(P, natt);
  });
}
const CACHE = new Map();
export function stallBilder(S, natt) {
  const k = S.id + (natt ? 'n' : 'd');
  if (!CACHE.has(k)) { const lampor = []; CACHE.set(k, { talt: talt(S, natt, lampor), bord: bord(S, natt), lampor }); }
  return CACHE.get(k);
}
export const putS = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);

// ---------- små varor ----------
function burk(P, x, y, w, h, pal, fyll) {   // en glasburk med godis/saft (x, y = nedre vänstra hörnet)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const kant = i === 0 || i === w - 1, inne = j >= h - Math.round(h * fyll);
    let c = kant ? 0xa8c4d0 : inne ? (pal ? tone(pal, 0.85 - i / w * 0.4 + (hash(x + i, y + j, 120) - 0.5) * 0.3, x + i, j) : 0xd8eef4) : 0xd8eef4;
    P.px(x + i, y - j, c, kant || inne ? 1 : 0.55);
  }
  P.hl(x, y - h, w, IRON[3]); P.px(x + 1, y - h + 2, 0xffffff, 0.8);
}
function godisbitar(P, x0, x1, y0, y1, fro) {
  const F = [0xe04848, 0xf0c030, 0x46a35a, 0x3a7bd5, 0xd060a0, 0xf08a2a, 0xffffff, 0x9a6ad8];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.px(x, y, F[Math.floor(hash(x, y, fro) * F.length)]);
}

// ======================= STÅNDEN =======================
export const SAFT = {
  id: 'saft', W: 60, namn: $t('SAFT'), meny: 'saft',
  tema: { a: ROD, b: CREAM, duk: ROD, skylt: CREAM, skyltText: 0xa01c26 },
  expedit: { dx: 12 },
  inne(P) {
    for (let x = -26; x <= 25; x++) { P.px(x, -28, tone(WOOD, 0.85, x, 0)); P.px(x, -27, tone(WOOD, 0.45, x, 0)); }
    for (let k = 0; k < 6; k++) { const x = -24 + k * 5; P.rect(x, -33, 4, 5, 0xfaf6ee); P.px(x, -33, 0xffffff); P.vl(x + 3, -32, 4, 0xc8c0b0); }   // muggarna
    for (let k = 0; k < 4; k++) klot(P, 12 + k * 4, -31, 2, 2, GUL);   // citronerna
  },
  bord(P) {
    burk(P, -24, -15, 9, 13, ROD, 0.7); burk(P, -12, -15, 9, 13, GUL, 0.6);
    for (const x of [-20, -8]) { P.rect(x, -16, 3, 2, STEEL[2]); P.px(x + 1, -14, IRON[2]); }   // kranarna
    for (let k = 0; k < 3; k++) { P.rect(4 + k * 5, -18, 4, 4, 0xfaf6ee); P.rect(4 + k * 5, -16, 4, 2, k === 1 ? GUL[3] : ROD[2]); }
  },
};
export const SMAGODIS = {
  id: 'smagodis', W: 60, namn: $t('SMÅGODIS'), meny: 'smagodis',
  tema: { a: LILA, b: CREAM, duk: LILA, skylt: LILA, skyltText: 0xfff6ff },
  expedit: { dx: -12 },
  inne(P) {
    for (const yy of [-30, -21]) for (let x = -26; x <= 25; x++) { P.px(x, yy, tone(WOOD, 0.85, x, 0)); P.px(x, yy + 1, tone(WOOD, 0.45, x, 0)); }
    const pal = [ROSA, GUL, GRON, BLA, ROD, LILA, ORANGE, TURK];
    for (let k = 0; k < 8; k++) burk(P, -26 + k * 6, -31, 5, 8, pal[k], 0.8);
    for (let k = 0; k < 8; k++) burk(P, -26 + k * 6, -22, 5, 7, pal[(k + 3) % 8], 0.75);
  },
  bord(P) {
    for (let k = 0; k < 5; k++) { const x = -26 + k * 11; P.rect(x, -18, 10, 4, 0xd8eef4); godisbitar(P, x + 1, x + 8, -18, -16, 121 + k); P.hl(x, -18, 10, 0xffffff, 0.6); }
    P.rect(18, -22, 6, 7, 0xf4ead0); P.px(18, -22, 0xffffff); P.hl(18, -20, 6, ROSA[2]);   // pappersstrutarna
  },
};
export const VAFFLOR = {
  id: 'vafflor', W: 60, namn: $t('VÅFFLOR'), meny: 'vafflor',
  tema: { a: GUL, b: CREAM, duk: GUL, skylt: [0x5a2e10, 0x7a4418, 0x9a5c24, 0xba7a3a, 0xd89a58], skyltText: 0xfff4d0 },
  expedit: { dx: 12 },
  inne(P) {
    // krittavlan med en våffla och ett hjärta
    for (let y = -38; y <= -24; y++) for (let x = -24; x <= -4; x++) P.px(x, y, x === -24 || x === -4 || y === -38 || y === -24 ? WOOD[2] : mix(0x1c362a, 0x284a38, hash(x, y, 122) * 0.6));
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) P.px(-20 + i, -34 + j, (i + j) % 2 ? 0xe8b860 : 0xc88a3a);
    P.px(-11, -33, 0xff8ac0); P.px(-9, -33, 0xff8ac0); P.hl(-12, -32, 5, 0xff8ac0); P.hl(-11, -31, 3, 0xff8ac0); P.px(-10, -30, 0xff8ac0);
    for (let k = 0; k < 3; k++) { P.rect(4 + k * 7, -31, 5, 6, ROD[2]); P.hl(4 + k * 7, -32, 5, 0xfaf6ee); P.px(5 + k * 7, -29, 0xffffff, 0.6); }   // syltburkarna
  },
  bord(P) {
    // våffeljärnet (stål, hjärtformade fack) och tallrikar med våfflor, grädde och sylt
    for (let y = -21; y <= -15; y++) for (let x = -25; x <= -11; x++) P.px(x, y, tone(STEEL, 0.85 - (x + 25) / 14 * 0.5 - (y === -21 ? -0.1 : 0), x, y));
    P.hl(-25, -22, 15, 0x3a3e44); P.rect(-12, -24, 2, 3, IRON[1]);
    for (const x of [-4, 10]) {
      P.hl(x - 1, -14, 10, 0xfaf6ee); P.hl(x, -15, 8, 0xfaf6ee);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) P.px(x + 1 + i, -18 + j, (i + j) % 2 ? 0xe8b860 : 0xc88a3a);
      P.rect(x + 2, -20, 3, 2, 0xfffaf0); P.px(x + 5, -19, ROD[2]); P.px(x + 4, -20, 0xffffff);
    }
  },
  live(ctx, x, y, t) { for (let k = 0; k < 3; k++) { const u = (t * 0.5 + k / 3) % 1; ctx.globalAlpha = 0.6 * (1 - u); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(Math.round(x - 20 + Math.sin(t * 2 + k) * 2), Math.round(y - 24 - u * 14), 2, 2); } ctx.globalAlpha = 1; },
};
export const CHURROS = {
  id: 'churros', W: 60, namn: $t('CHURROS'), meny: 'churros',
  tema: { a: ORANGE, b: CREAM, duk: ORANGE, skylt: ORANGE, skyltText: 0xfff4d0 },
  expedit: { dx: -12 },
  inne(P) {
    for (let x = -26; x <= 25; x++) { P.px(x, -27, tone(WOOD, 0.85, x, 0)); P.px(x, -26, tone(WOOD, 0.45, x, 0)); }
    for (let k = 0; k < 6; k++) { const x = -24 + k * 8; P.rect(x, -31, 5, 4, k % 2 ? 0xfff4d0 : ORANGE[2]); for (let s = 0; s < 3; s++) P.vl(x + 1 + s, -37 + s, 6, s === 1 ? 0xc8803a : 0xa8602a); }   // strutar med churros
  },
  bord(P) {
    // frityren med en korg churros, chokladsåsen och kanelsockret
    for (let y = -20; y <= -15; y++) for (let x = -24; x <= -10; x++) P.px(x, y, tone(STEEL, 0.8 - (x + 24) / 14 * 0.5, x, y));
    P.rect(-22, -23, 10, 3, 0x8a949c); for (let k = 0; k < 8; k++) P.px(-21 + k, -24 - (k % 2), 0xc8803a);
    klot(P, 4, -17, 4, 2.5, [0x2a1408, 0x4a2410, 0x6a3a1e, 0x8a5430, 0xa87048]); P.hl(1, -19, 7, STEEL[3]);
    P.rect(14, -20, 4, 5, 0xfaf6ee); P.hl(14, -21, 4, STEEL[2]); for (let k = 0; k < 3; k++) P.px(15 + k, -22, 0x8a5430);
  },
};
export const KORV = {
  id: 'korv', W: 60, namn: $t('KORV'), meny: 'korv',
  tema: { a: GRON, b: CREAM, duk: GRON, skylt: CREAM, skyltText: 0x22602a },
  expedit: { dx: 12 },
  inne(P) {
    for (let x = -26; x <= 25; x++) { P.px(x, -27, tone(WOOD, 0.85, x, 0)); P.px(x, -26, tone(WOOD, 0.45, x, 0)); }
    for (let k = 0; k < 5; k++) { const x = -24 + k * 6; P.rect(x, -30, 5, 3, 0xe8c080); P.hl(x, -30, 5, 0xf8dca0); }   // bröden
    for (let k = 0; k < 3; k++) { P.rect(8 + k * 5, -32, 3, 5, [ROD[2], GUL[3], 0xfaf6ee][k]); P.px(9 + k * 5, -33, [ROD[1], GUL[1], 0xd8d0c0][k]); }
  },
  bord(P) {
    // grillen med korvarna (de fräser i live), en hög bröd och flaskorna
    for (let y = -18; y <= -15; y++) for (let x = -25; x <= -5; x++) P.px(x, y, tone(IRON, 0.6 - (y + 18) * 0.1, x, y));
    for (let k = 0; k < 4; k++) { P.rect(-24 + k * 5, -20, 4, 2, 0xb05a3a); P.hl(-24 + k * 5, -20, 4, 0xd8805a); P.px(-21 + k * 5, -19, 0x7a3a2a); }
    for (let k = 0; k < 3; k++) { P.rect(4, -17 - k * 2, 7, 2, 0xe8c080); P.hl(4, -17 - k * 2, 7, 0xf8dca0); }
    P.rect(15, -21, 3, 6, ROD[2]); P.px(15, -21, ROD[4]); P.rect(19, -21, 3, 6, GUL[3]); P.px(19, -21, GUL[4]);
  },
  live(ctx, x, y, t) { if (Math.floor(t * 8) % 3 === 0) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(x - 24 + (Math.floor(t * 17) % 18)), y - 21, 1, 1); } for (let k = 0; k < 2; k++) { const u = (t * 0.6 + k / 2) % 1; ctx.globalAlpha = 0.5 * (1 - u); ctx.fillStyle = '#d8d4dc'; ctx.fillRect(Math.round(x - 18 + k * 8), Math.round(y - 22 - u * 12), 2, 2); } ctx.globalAlpha = 1; },
};
export const BALLONGER = {
  id: 'ballong', W: 60, namn: $t('BALLONGER'), meny: null,
  tema: { a: BLA, b: CREAM, duk: BLA, skylt: CREAM, skyltText: 0x1c4086 },
  expedit: { dx: -12 },
  inne(P) {
    for (let k = 0; k < 4; k++) { const x = 6 + k * 5; P.rect(x, -24, 4, 5, [ROSA[2], GUL[3], GRON[3], LILA[3]][k]); P.px(x + 1, -23, 0xffffff); }   // bandrullarna
  },
  bord(P) {
    // heliumtuben
    for (let y = -30; y <= -14; y++) for (let x = 10; x <= 16; x++) P.px(x, y, tone(STEEL, 0.85 - (x - 10) / 6 * 0.5 + (y < -27 ? 0.1 : 0), x, y));
    P.rect(12, -33, 3, 3, IRON[3]); P.px(15, -32, IRON[2]);
    P.rect(-24, -18, 12, 4, 0xfaf6ee); for (let k = 0; k < 4; k++) P.px(-23 + k * 3, -17, [0xe04848, 0x3a7bd5, 0xf0c030, 0x46a35a][k]);
  },
  live(ctx, x, y, t) { knippe(ctx, x, y - 62, t, 5, 9, 18); },
};
export const FISKDAM = {
  id: 'fiskdam', W: 64, namn: $t('FISKDAMMEN'), meny: null,
  tema: { a: TURK, b: CREAM, duk: TURK, skylt: TURK, skyltText: 0xffffff },
  expedit: { dx: -14 },
  inne(P) {
    // vinsthyllan: gosedjur och badankor
    for (let x = -26; x <= 25; x++) { P.px(x, -30, tone(WOOD, 0.85, x, 0)); P.px(x, -29, tone(WOOD, 0.45, x, 0)); }
    for (let k = 0; k < 7; k++) { const x = -24 + k * 7, c = [0xc8905a, 0xf8c8d8, 0xffe060, 0x9ad8f8, 0xf0d070, 0xc8905a, 0xf8c8d8][k]; P.rect(x, -35, 5, 5, c); P.px(x, -36, c); P.px(x + 4, -36, c); P.px(x + 1, -33, 0x1e1a24); P.px(x + 3, -33, 0x1e1a24); }
  },
  bord(P) {
    // dammen: ett runt kar med vatten (ankorna simmar i live) och två metspön
    for (let y = -24; y <= -14; y++) for (let x = -24; x <= 24; x++) {
      const d = (x / 24) ** 2 + ((y + 19) / 5.5) ** 2; if (d > 1) continue;
      P.px(x, y, d > 0.82 ? tone(TURK, 0.4, x, y) : d > 0.7 ? 0xe8f4f8 : mix(0x5ab0e0, 0x3a90c8, (y + 24) / 10 + (hash(x >> 1, y, 123) - 0.5) * 0.2));
    }
    for (const [x0, s] of [[-28, 1], [27, -1]]) for (let k = 0; k < 12; k++) P.px(x0 + s * Math.round(k * 0.4), -14 - k, WOOD[2]);
  },
  live(ctx, x, y, t) {
    for (let k = 0; k < 7; k++) {
      const a = t * 0.9 + k / 7 * Math.PI * 2, ax = Math.round(x + Math.cos(a) * 17), ay = Math.round(y - 19 + Math.sin(a) * 3.5);
      ctx.fillStyle = '#ffe060'; ctx.fillRect(ax - 2, ay - 1, 4, 2); ctx.fillRect(ax - 1, ay - 3, 2, 2);
      ctx.fillStyle = '#f08a2a'; ctx.fillRect(ax + (Math.cos(a) > 0 ? -2 : 1), ay - 2, 1, 1);
      ctx.fillStyle = '#1e1a24'; ctx.fillRect(ax, ay - 3, 1, 1);
    }
  },
};
const TYP = { saft: SAFT, smagodis: SMAGODIS, vafflor: VAFFLOR, churros: CHURROS, korv: KORV, ballong: BALLONGER, fiskdam: FISKDAM };
// var tältstånden står (mitten, fotlinjen y = MARKNAD_Y) – grupper med tvärgränder emellan
export const MARKNAD_Y = 414;
export const STALL = [
  ['saft', 262], ['smagodis', 330], ['vafflor', 440], ['churros', 508], ['ballong', 610], ['korv', 678], ['fiskdam', 748],
  ['saft', 992], ['smagodis', 1060], ['vafflor', 1150], ['ballong', 1218], ['korv', 1400], ['fiskdam', 1470], ['churros', 1540],
  ['saft', 1998], ['ballong', 2072], ['vafflor', 2250], ['korv', 2320],
].map(([typ, cx], i) => { const def = TYP[typ]; return { id: `${typ}-${i}`, typ, def, cx, y: MARKNAD_Y, w: def.W, x: cx - (def.W >> 1) }; });
// gränderna: promenaden framför, gången bakom och tvärgränderna mellan grupperna (stenläggningen i karta.js)
// 🎉 dekorationerna i ministaden (js/pixelberg/deko.js): portalerna över gränderna, tekopparna, fontänen, såpbubblorna,
// konfettikanonen vid entrén, flaggorna längs häcken och tivolilyktorna vid portalerna
const PORT_Y = MARKNAD_Y + 6;
export const DEKO = {
  portaler: [
    { x0: 362, x1: 408, namn: $t('GODISGATAN'), f: 0xd84a8a }, { x0: 540, x1: 578, namn: $t('BALLONGGATAN'), f: 0x3a7bd5 },
    { x0: 784, x1: 958, namn: $t('TEKOPPSTORGET'), f: 0xe04848 }, { x0: 1252, x1: 1366, namn: $t('FONTÄNTORGET'), f: 0x228c96 },
    { x0: 2106, x1: 2216, namn: $t('SPÖKGRÄND'), f: 0x8246c0 },
  ].map((p) => ({ ...p, y: PORT_Y })),
  // (tekopparna och fontänen står i torgen framför gången bakom – besökarna där går bakom dem, inte igenom)
  tekopp: { x: 871, y: 404 }, fontan: { x: 1309, y: 404 }, bubbel: { x: 1612, y: 406 }, konfetti: { x: 96, y: 412 },
  flaggor: [140, 226, 330, 640, 760, 940, 1210, 1470, 1610, 1930, 2160, 2430].map((x, i) => ({ x, y: 232, f: [0xe04848, 0x3a7bd5, 0xf0c030, 0x46a35a, 0xd060a0, 0xf08a2a][i % 6] })),
};
DEKO.lyktor = DEKO.portaler.flatMap((p) => [{ x: p.x0 - 8, y: PORT_Y + 8 }, { x: p.x1 + 6, y: PORT_Y + 8 }]);
