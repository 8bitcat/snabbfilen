// 🏛️ GAMLA STANS HUS – fasaderna längs Storgatan (karta.js HUS). Gamla hus vägg i vägg: puts i ockra, rosa, kalkvitt,
// terrakotta och blekblått, korsvirke på några, små spröjsade fönster med fönsterluckor och blomlådor, välvda dörrar
// med järnbeslag och trappsteg, tegeltak med kupor och skorstenar, trappgavlar i tegel, hängskyltar i smide:
//   STADSPORTEN  – stentornet med valvet, urtavlan och tinnarna (längst i väster)
//   BIBLIOTEKET  – gråsten med välvda fönster fulla av böcker, kolonner vid porten, "BIBLIOTEK" i huggen sten
//   ANTIKAFFÄREN – burspråk med klocka, vas och lampa i fönstret, hängskylt med en klocka
//   GAMLA KAFÉET – lyktor, menytavla, koppen på skylten, gardiner
//   VALVET       – gränden norrut genom huset, med en lykta i valvet
//   MUSEET       – kolonner, tympanon med årtal, vepa, trappa
//   GULDSMEDEN   – litet fönster med ringar på sammet, gyllene ring som skylt
//   TEATERN      – markis med glödlampor (husLiv), affischer, dubbeldörrar, "TEATERN" i guld
//   LYKTMAKAREN  – fönstret fullt av lyktor (tända om natten), en lykta som skylt
//   bostadshusen – luckor, blomlådor, en katt i fönstret, skorstensrök (husLiv)
// husBild(id, natt) målas EN gång per hus och dag/natt (pennor.bild cachar), ritas med put(ctx, s, H.x, G.BASE):
// (0,0) = husets vänstra fot på BASE, väggen går uppåt (negativa y). husLiv() ritar det som rör sig, husSken()
// fönsterglöden efter mörkret.
import { SMALL, BIG, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { tone, fyll, spr, skylttext, bild, put, palett, F } from '../core/pennor.js';
import { glodlampa } from '../pixelberg/liv.js';
import { $t } from '../core/i18n.js';
import { HUS, G } from './karta.js';

const { VIT, MASS, JARN, ZINK, STEN, SAND, TRA, TERR, BLAD, ROD, BLA, GUL, GRON, ROSA, GLD, GLN } = F;
const OCKRA = palett(0xd8a84a), ROSAPUTS = palett(0xe4ac9e), BLAPUTS = palett(0x8eb0c6), GRONPUTS = palett(0x98b88a), KALK = VIT;
const TEGEL = palett(0xb4553c), BRUNTAK = palett(0x8a5a3a), SKIFFER = palett(0x565a6a), GRASTEN = palett(0x9a9488), BRICK = palett(0x9a4a34);
const GLM = [0x080c18, 0x0e1626, 0x162238, 0x22324e, 0x34486a];
const PUTS = { ockra: OCKRA, rosa: ROSAPUTS, bla: BLAPUTS, gron: GRONPUTS, terra: palett(0xc8744a), kalk: KALK };
const LIT = {};   // id|natt → lysande rutor [x, y, w, h] (i husets koordinater)

// ---------------------------------------------------------------- delarna
// puts: lätt flammig, mörkare nedtill och vid skarvarna, sprickor här och var
function puts(P, x0, y0, x1, y1, pal, s, o = {}) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    let v = 0.62 + (hash(x >> 2, y >> 2, s) - 0.5) * 0.12 - (y - y0) / Math.max(1, y1 - y0) * 0.1 + (x - x0) / Math.max(1, x1 - x0) * -0.06;
    if (hash(x, y, s + 1) > 0.985) v -= 0.18;
    if (o.sned && (x - x0) < 2) v += 0.12;
    return tone(pal, v, x, y);
  });
}
// korsvirke: stolpar, bjälkar och snedsträvor i mörkt trä över putsen
function korsvirke(P, x0, y0, x1, y1, s) {
  const b = (x, y, w, h) => fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => tone(TRA, 0.22 + (hash(X, Y, s) - 0.5) * 0.1, X, Y));
  b(x0, y0, 3, y1 - y0 + 1); b(x1 - 2, y0, 3, y1 - y0 + 1);
  for (let x = x0 + 18; x < x1 - 8; x += 20) b(x, y0, 3, y1 - y0 + 1);
  b(x0, y0, x1 - x0 + 1, 3); b(x0, y1 - 2, x1 - x0 + 1, 3);
  for (let x = x0 + 18, k = 0; x + 20 < x1; x += 20, k++) if (hash(k, 1, s) > 0.5) for (let j = 0; j < y1 - y0 - 4; j++) P.px(x + 3 + Math.round(j / (y1 - y0 - 4) * 14), y0 + 3 + j, TRA[1]);
}
// gråsten i skift
function sten(P, x0, y0, x1, y1, pal, s) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    const r = Math.floor((y - y0) / 8), xx = x - x0 + (r & 1) * 11, c = Math.floor(xx / 22), rx = xx - c * 22, ry = (y - y0) % 8;
    if (ry === 7 || rx === 21) return tone(pal, 0.25, x, y);
    return tone(pal, 0.6 + (hash(c, r, s) - 0.5) * 0.2 + (ry === 0 ? 0.1 : 0) + (rx === 0 ? 0.06 : 0) + (hash(x, y, s + 2) > 0.97 ? -0.15 : 0), x, y);
  });
}
// tegelpannor sedda framifrån: rader om 3 px, ljusare mot nocken
function pannor(P, x0, x1, y0, y1, pal, s) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    const r = Math.floor((y - y0) / 3), rr = (y - y0) % 3, xx = x + (r & 1) * 2;
    let v = rr === 0 ? 0.78 : rr === 2 ? 0.34 : 0.58;
    if (xx % 4 === 3) v -= 0.14;
    v += (y1 - y) / Math.max(1, y1 - y0) * 0.1;
    if (hash(x, y, s) > 0.965) v -= 0.2;
    return tone(pal, v, x, y);
  });
}
// sadeltak från gatan: pannorna med takfot (hängränna) och nock
function sadeltak(P, x0, x1, top, rh, pal, s) {
  pannor(P, x0 - 3, x1 + 3, top - rh, top - 1, pal, s);
  P.hl(x0 - 3, top - rh, x1 - x0 + 7, mix(pal[4], 0xffffff, 0.2)); P.hl(x0 - 3, top - rh + 1, x1 - x0 + 7, pal[0]);
  P.hl(x0 - 4, top - 1, x1 - x0 + 9, ZINK[3]); P.hl(x0 - 4, top, x1 - x0 + 9, ZINK[1]);
  P.hl(x0, top + 1, x1 - x0 + 1, 0x000000, 0.3);
}
// trappgavel i tegel: gaveln stiger i steg upp till en spets, med en liten lucka högst upp
function trappgavel(P, x0, x1, top, rh, wallPal, s, natt, lit) {
  const cx = (x0 + x1) >> 1, hw = (x1 - x0) >> 1, steg = 5;
  for (let y = top - 1; y >= top - rh; y--) {
    const u = (top - 1 - y) / rh, k = Math.floor(u * steg), half = Math.round(hw * (1 - k / steg)) + 2;
    for (let x = cx - half; x <= cx + half; x++) {
      const edge = x <= cx - half + 2 || x >= cx + half - 2;
      P.px(x, y, edge ? tone(BRICK, 0.55 + (hash(x, y, s) - 0.5) * 0.2 + ((y + 1) % 3 === 0 ? -0.15 : 0), x, y) : tone(wallPal, 0.6 + (hash(x >> 2, y >> 2, s) - 0.5) * 0.12, x, y));
    }
    P.hl(cx - half, y, 1, BRICK[4], 0.5);
  }
  P.rect(cx - 2, top - rh - 2, 5, 2, BRICK[1]); P.hl(cx - 3, top - rh - 3, 7, BRICK[3]);
  fonster(P, cx - 3, top - rh + 14, 7, 8, { natt, valv: true, lucka: null }, lit);
}
// vanlig gavel (triangel) med vita vindskivor
function gavel(P, x0, x1, top, rh, wallPal, s, natt, lit) {
  const cx = (x0 + x1) >> 1, hw = (x1 - x0) >> 1;
  for (let y = top - 1; y >= top - rh; y--) {
    const u = (top - 1 - y) / (rh - 1), half = Math.round((hw + 3) * (1 - u));
    for (let x = cx - half; x <= cx + half; x++) P.px(x, y, x <= cx - half + 1 || x >= cx + half - 1 ? VIT[3] : tone(wallPal, 0.62 + (hash(x >> 2, y >> 2, s) - 0.5) * 0.1, x, y));
  }
  P.hl(cx - 1, top - rh - 1, 3, VIT[4]);
  fonster(P, cx - 3, top - rh + 12, 7, 8, { natt, lucka: null }, lit);
}
// fönster: vit karm, spröjs, luckor i färg, blomlåda; valv = rund överkant
function fonster(P, x, y, w, h, o, lit) {
  const lyser = o.natt && (o.lyser ?? hash(x, y, 9) > 0.35);
  P.rect(x - 1, y - 1, w + 2, h + 2, o.sten ? STEN[3] : VIT[3]);
  P.box(x - 2, y - 2, w + 4, h + 4, 0x2a2420, 0.9);
  fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => (lyser ? tone(GLN, 0.85 - (Y - y) * 0.03 + (hash(X, Y, 5) - 0.5) * 0.1, X, Y) : o.natt ? tone(GLM, 0.5, X, Y) : tone(GLD, 0.78 - (Y - y) * 0.03 + ((((X * 2 - Y * 3) % 17) + 17) % 17 < 2 ? 0.2 : 0), X, Y)));
  if (o.valv) { for (let i = 0; i < w; i++) { const d = Math.abs(i - (w - 1) / 2); const hh = Math.round(d * d / (w * 0.9)); for (let j = 0; j < hh; j++) P.px(x + i, y + j, o.sten ? STEN[3] : VIT[3]); } P.hl(x - 1, y - 2, w + 2, o.sten ? STEN[2] : VIT[2]); }
  if (o.spröjs !== false) { P.vl(x + (w >> 1), y, h, VIT[3]); if (h > 7) P.hl(x, y + (h >> 1), w, VIT[3]); }
  if (o.gardin) { for (let j = 0; j < h; j++) { P.px(x, y + j, o.gardin); P.px(x + w - 1, y + j, o.gardin); if (j < 3) P.hl(x, y + j, w, o.gardin, 0.6); } }
  if (o.lucka) { fyll(P, x - 5, y - 1, x - 3, y + h, (X, Y) => tone(o.lucka, (Y - y) % 4 === 0 ? 0.75 : 0.5, X, Y)); fyll(P, x + w + 2, y - 1, x + w + 4, y + h, (X, Y) => tone(o.lucka, (Y - y) % 4 === 0 ? 0.75 : 0.5, X, Y)); for (let j = 2; j < h - 1; j += 4) { P.px(x - 4, y + j, o.lucka[0]); P.px(x + w + 3, y + j, o.lucka[0]); } }
  P.hl(x - 2, y + h + 1, w + 4, VIT[4]); P.hl(x - 2, y + h + 2, w + 4, 0x000000, 0.25);
  if (o.blom) { fyll(P, x - 1, y + h + 2, x + w, y + h + 4, (X, Y) => tone(TRA, Y === y + h + 2 ? 0.8 : 0.45, X, Y)); for (let i = 0; i < w + 2; i++) { P.px(x - 1 + i, y + h + 1, tone(BLAD, 0.4 + hash(i, y, 6) * 0.5, i, 0)); if (hash(i, y, 7) > 0.45) P.px(x - 1 + i, y + h + (hash(i, y, 8) > 0.5 ? 0 : 1), [0xe0383c, 0xf0c030, 0xf06aa0, 0xffffff][(hash(i, y, 9) * 4) | 0]); } }
  if (lyser && lit) lit.push([x, y, w, h]);
}
// välvd dörr i trä med järnbeslag, trappsteg i sten och en lykta bredvid
function dorr(P, x0, x1, pal, o, natt, lit) {
  const w = x1 - x0 + 1, h = o.h || 22, y0 = -h, cx = (x0 + x1) >> 1;
  fyll(P, x0 - 2, y0 - 3, x1 + 2, -1, (X, Y) => (X < x0 || X > x1 || Y < y0) ? tone(o.karm || STEN, 0.7 - (X - x0) / w * 0.2, X, Y) : null);
  for (let i = 0; i < w + 4; i++) { const d = Math.abs(i - (w + 3) / 2); const hh = Math.round(d * d / (w * 0.7)); for (let j = 0; j < hh; j++) P.px(x0 - 2 + i, y0 - 3 + j, VIT[1], 0.001); for (let j = 0; j < hh; j++) P.px(x0 - 2 + i, y0 - 3 + j, tone(o.karm || STEN, 0.55, i, j)); }
  fyll(P, x0, y0, x1, -1, (X, Y) => tone(pal, 0.55 - (X - x0) / w * 0.2 + ((X - x0) % 5 === 4 ? -0.15 : 0) + (Y === y0 ? 0.15 : 0), X, Y));
  for (let i = 0; i < w; i++) { const d = Math.abs(i - (w - 1) / 2); const hh = Math.round(d * d / (w * 0.7)); for (let j = 0; j < hh; j++) P.px(x0 + i, y0 + j, tone(o.karm || STEN, 0.55, i, j)); }
  P.hl(x0 + 1, y0 + 6, w - 2, JARN[2]); P.hl(x0 + 1, -8, w - 2, JARN[2]);
  for (const bx of [x0 + 2, x1 - 3]) { P.px(bx, y0 + 6, JARN[4]); P.px(bx, -8, JARN[4]); }
  P.px(x1 - 3, -11, MASS[3]); P.px(x1 - 2, -11, MASS[1]);
  if (o.glas) { fyll(P, x0 + 2, y0 + 2, x1 - 2, y0 + 5, (X, Y) => (natt ? tone(GLN, 0.8, X, Y) : tone(GLD, 0.75, X, Y))); if (natt && lit) lit.push([x0 + 2, y0 + 2, w - 4, 4]); }
  P.hl(x0 - 3, 0, w + 6, STEN[3]); P.hl(x0 - 3, 1, w + 6, STEN[1]); P.hl(x0 - 5, 2, w + 10, STEN[2]); P.hl(x0 - 5, 3, w + 10, STEN[0]);
  if (o.lykta !== false) lykta(P, x1 + 7, y0 + 4, natt, lit);
}
// vägglykta i smide
function lykta(P, x, y, natt, lit) {
  P.hl(x - 3, y - 1, 3, JARN[2]); P.px(x - 3, y, JARN[2]);
  P.rect(x - 1, y, 3, 5, JARN[1]); P.hl(x - 2, y - 1, 5, JARN[3]); P.px(x, y - 2, JARN[3]);
  P.rect(x, y + 1, 1, 3, natt ? 0xffe8a0 : 0xd8e8f0); P.px(x, y + 5, JARN[2]);
  if (natt && lit) lit.push([x, y + 1, 1, 3]);
}
// hängskylt på smidesarm: en liten bild (rows + pal) i en ram
function hangskylt(P, x, y, rows, pal, ram = MASS) {
  P.hl(x - 10, y, 11, JARN[2]); P.px(x - 10, y - 1, JARN[3]); P.px(x - 10, y + 1, JARN[3]); P.px(x - 1, y + 1, JARN[2]);
  const w = rows[0].length + 4, h = rows.length + 4;
  fyll(P, x - (w >> 1), y + 2, x - (w >> 1) + w - 1, y + 1 + h, (X, Y) => (X === x - (w >> 1) || X === x - (w >> 1) + w - 1 || Y === y + 2 || Y === y + 1 + h) ? ram[2] : 0x2a2420);
  spr(P, x - (w >> 1) + 2, y + 4, rows, pal);
}
// skorsten på taket
function skorsten(P, x, y, h) { P.rect(x, y, 6, h, BRICK[1]); for (let j = 0; j < h; j += 2) for (let i = 0; i < 6; i++) if ((i + j) % 3 === 0) P.px(x + i, y + j, BRICK[3]); P.hl(x - 1, y - 1, 8, STEN[3]); P.hl(x - 1, y, 8, STEN[1]); }
// namnskylt målad på fasaden
function namnskylt(P, cx, y, s, bg, fg, kant) {
  const F2 = textW(BIG, s) <= 120 ? BIG : SMALL, tw = textW(F2, s), sw = tw + 10;
  fyll(P, cx - (sw >> 1), y, cx - (sw >> 1) + sw - 1, y + F2.h + 5, (X, Y) => (X === cx - (sw >> 1) || X === cx - (sw >> 1) + sw - 1 || Y === y || Y === y + F2.h + 5) ? kant : bg);
  skylttext(P, F2, s, cx - (tw >> 1), y + 3, fg, mul(bg, 0.6), null);
}

// ---------------------------------------------------------------- husen
export function husBild(id, natt) {
  const H = HUS[id], w = H.w, h = H.h;
  return bild(`gs|${id}|${natt ? 1 : 0}`, w + 16, h + 46, 8, h + 42, (P) => {
    const lit = [], s = 11 + w, x0 = 0, x1 = w - 1, d0 = H.door.x0 - H.x, d1 = H.door.x1 - H.x, cx = w >> 1;
    const typ = H.typ;
    if (typ === 'port') {
      // STADSPORTEN: stentorn med valv, urtavla, tinnar och en flagga
      sten(P, x0, -h + 10, x1, -1, GRASTEN, s);
      for (let i = 0; i < w; i += 8) P.rect(i, -h + 4, 5, 7, tone(GRASTEN, 0.7, i, 0)); P.hl(x0, -h + 10, w, GRASTEN[0]);
      for (let y = -36; y < 0; y++) { const half = y > -30 ? 18 : Math.round(Math.sqrt(Math.max(0, 1 - ((y + 30) / 6) ** 2)) * 18); for (let x = cx - half; x <= cx + half; x++) P.px(x, y, tone(GRONPUTS, 0.3 - (y + 36) * 0.005, x, y)); }
      for (let y = -36; y < 0; y++) { const half = y > -30 ? 18 : Math.round(Math.sqrt(Math.max(0, 1 - ((y + 30) / 6) ** 2)) * 18); P.px(cx - half - 1, y, STEN[0]); P.px(cx + half + 1, y, STEN[0]); }
      P.rect(cx - 10, -24, 20, 1, 0x3a5a2a, 0.5);
      for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) { const d = Math.hypot(i - 6, j - 6); if (d < 6.5) P.px(cx - 6 + i, -h + 24 + j, d > 5.4 ? JARN[1] : natt ? 0xf8e8a8 : 0xfaf6ea); }
      P.vl(cx, -h + 27, 4, JARN[0]); P.hl(cx, -h + 30, 3, JARN[0]);
      fonster(P, cx - 4, -h + 46, 9, 10, { natt, valv: true, sten: true, lucka: null }, lit);
      fonster(P, cx - 4, -h + 70, 9, 10, { natt, valv: true, sten: true, lucka: null }, lit);
      P.vl(cx, -h - 2, 8, JARN[2]); for (let k = 0; k < 5; k++) P.px(cx + 1 + k, -h - 2 + (k > 2 ? 1 : 0), k < 3 ? GUL[3] : BLA[2]);
      lykta(P, cx - 22, -14, natt, lit); lykta(P, cx + 24, -14, natt, lit);
    } else if (typ === 'valv') {
      // VALVET: ett valv genom huset ovanför (mörk gång med trappsteg – marken) och huset ovanpå i puts
      puts(P, x0 - 2, -h, x1 + 2, -1, PUTS.kalk, s);
      for (let y = -34; y < 0; y++) { const half = y > -28 ? 15 : Math.round(Math.sqrt(Math.max(0, 1 - ((y + 28) / 6) ** 2)) * 15); for (let x = cx - half; x <= cx + half; x++) P.px(x, y, mix(0x2a2622, 0x4a4238, (y + 34) / 34)); P.px(cx - half - 1, y, STEN[0]); P.px(cx + half + 1, y, STEN[0]); }
      for (let x = cx - 13; x <= cx + 13; x += 2) P.px(x, -36, STEN[2]);
      lykta(P, cx, -20, natt, lit);
      fonster(P, cx - 5, -h + 14, 10, 10, { natt, lucka: GRON, blom: true }, lit);
      sadeltak(P, x0 - 2, x1 + 2, -h + 4, 18, TEGEL, s);
    } else if (typ === 'bibliotek') {
      sten(P, x0, -h + 26, x1, -1, GRASTEN, s);
      // balustrad och attika med bokrullar
      P.hl(x0 - 2, -h + 26, w + 4, STEN[4]); P.hl(x0 - 2, -h + 27, w + 4, STEN[1]);
      for (let x = x0 + 2; x < x1 - 1; x += 5) { P.rect(x, -h + 20, 3, 6, STEN[3]); P.px(x, -h + 20, STEN[4]); }
      P.hl(x0 - 2, -h + 18, w + 4, STEN[4]); P.hl(x0 - 2, -h + 19, w + 4, STEN[2]);
      skylttext(P, BIG, $t('BIBLIOTEK'), cx - (textW(BIG, $t('BIBLIOTEK')) >> 1), -h + 4, STEN[4], STEN[0], null);
      // två välvda fönster per sida fulla av böcker, kolonner vid porten
      for (const fx of [x0 + 14, x0 + 48, x1 - 60, x1 - 26]) {
        fonster(P, fx, -h + 36, 14, 24, { natt, valv: true, sten: true, lucka: null, spröjs: false, lyser: true }, lit);
        for (let j = 0; j < 3; j++) for (let i = 0; i < 12; i++) if (hash(fx + i, j, 3) > 0.3) P.rect(fx + 1 + i, -h + 40 + j * 7, 1, 5 + (hash(i, j, 4) * 2 | 0), [0x8a2a2a, 0x2a4a8a, 0x4a7a3a, 0xc8a040, 0x6a3a7a][(hash(fx + i, j, 5) * 5) | 0]);
      }
      for (const fx of [x0 + 14, x0 + 48, x1 - 60, x1 - 26]) fonster(P, fx, -24, 14, 12, { natt, sten: true, lucka: null, lyser: true }, lit);
      for (const kx of [d0 - 10, d1 + 6]) { fyll(P, kx, -h + 66, kx + 5, -1, (X, Y) => tone(STEN, X === kx ? 0.9 : X === kx + 5 ? 0.35 : 0.68, X, Y)); P.rect(kx - 1, -h + 64, 8, 3, STEN[3]); P.rect(kx - 1, -4, 8, 4, STEN[2]); }
      dorr(P, d0, d1, TRA, { h: 30, karm: STEN, glas: true, lykta: false }, natt, lit);
      lykta(P, d0 - 16, -30, natt, lit); lykta(P, d1 + 12, -30, natt, lit);
    } else if (typ === 'museum') {
      puts(P, x0, -h + 40, x1, -1, PUTS.kalk, s);
      // tympanon med årtal och kolonner, vepa, trappa
      for (let y = -h + 40; y >= -h + 2; y--) { const u = (-h + 40 - y) / 38, half = Math.round((w / 2 + 2) * (1 - u)); for (let x = cx - half; x <= cx + half; x++) P.px(x, y, x <= cx - half + 2 || x >= cx + half - 2 ? STEN[3] : tone(KALK, 0.72, x, y)); }
      skylttext(P, SMALL, '1699', cx - 8, -h + 24, STEN[1], KALK[4], null);
      P.hl(x0 - 3, -h + 40, w + 6, STEN[4]); P.hl(x0 - 3, -h + 41, w + 6, STEN[1]); P.hl(x0 - 3, -h + 42, w + 6, STEN[2]);
      for (let k = 0; k < 6; k++) { const kx = x0 + 12 + k * ((w - 30) / 5 | 0); if (Math.abs(kx - cx) < 24) continue; fyll(P, kx, -h + 44, kx + 7, -5, (X, Y) => tone(STEN, X === kx ? 0.92 : X === kx + 7 ? 0.3 : X === kx + 1 ? 0.8 : 0.66 - ((X - kx) % 3 === 2 ? 0.08 : 0), X, Y)); P.rect(kx - 1, -h + 42, 10, 3, STEN[3]); P.rect(kx - 1, -6, 10, 2, STEN[2]); }
      for (const fx of [x0 + 24, x1 - 36]) fonster(P, fx, -h + 56, 14, 18, { natt, sten: true, lucka: null, lyser: true }, lit);
      // vepan: "UTSTÄLLNING"
      fyll(P, cx - 22, -h + 48, cx + 22, -h + 86, (X, Y) => (X === cx - 22 || X === cx + 22 || Y === -h + 48) ? MASS[2] : tone(ROD, 0.55 - (Y + h - 48) * 0.004, X, Y));
      skylttext(P, SMALL, $t('KONST'), cx - (textW(SMALL, $t('KONST')) >> 1), -h + 56, 0xfff0a0, ROD[0], null);
      spr(P, cx - 6, -h + 66, ['.yyyy.', 'yBBBBy', 'yBwwBy', 'yBwwBy', 'yBBBBy', '.yyyy.'], { y: 0xe8c040, B: 0x3a5a8a, w: 0xf0d8a0 });
      namnskylt(P, cx, -h + 92, H.namn, MASS[2], 0x2a2420, MASS[0]);
      dorr(P, d0, d1, [0x2a3a4a, 0x3a5060, 0x4a6878, 0x6a8898, 0x8aa8b8], { h: 32, karm: STEN, glas: true, lykta: false }, natt, lit);
      for (let k = 0; k < 3; k++) { P.hl(d0 - 8 - k * 3, 2 + k * 2, d1 - d0 + 17 + k * 6, STEN[3]); P.hl(d0 - 8 - k * 3, 3 + k * 2, d1 - d0 + 17 + k * 6, STEN[1]); }
    } else if (typ === 'teater') {
      puts(P, x0, -h + 30, x1, -1, PUTS.rosa, s);
      sadeltak(P, x0, x1, -h + 30, 22, SKIFFER, s);
      skorsten(P, x1 - 20, -h + 2, 10);
      for (let k = 0; k < 5; k++) fonster(P, x0 + 14 + k * ((w - 40) / 4 | 0), -h + 42, 12, 16, { natt, valv: true, lucka: null, gardin: 0xb02838, lyser: true }, lit);
      // markisen med glödlampor (husLiv), "TEATERN" i guld, affischer och dubbeldörrar
      const my = -46;
      fyll(P, cx - 60, my, cx + 60, my + 14, (X, Y) => (Y === my || Y === my + 14) ? MASS[3] : (X === cx - 60 || X === cx + 60) ? MASS[2] : tone(ROD, 0.5, X, Y));
      skylttext(P, BIG, H.namn, cx - (textW(BIG, H.namn) >> 1), my + 3, 0xfff0a0, ROD[0], 0xffffff);
      P.hl(cx - 62, my + 15, 125, JARN[1]); for (let x = cx - 60; x <= cx + 60; x += 4) P.px(x, my + 16, natt ? 0xfff0a0 : 0xd8d8c8);
      for (const px of [x0 + 8, x1 - 30]) { fyll(P, px, -34, px + 22, -6, (X, Y) => (X === px || X === px + 22 || Y === -34 || Y === -6) ? MASS[1] : tone(px < cx ? BLA : GRON, 0.75 - (Y + 34) * 0.01, X, Y)); spr(P, px + 7, -28, ['..kk..', '.kkkk.', '.kwwk.', '..kk..', 'kkkkkk', '.kkkk.', '.k..k.'], { k: px < cx ? 0xf0c030 : 0xf4f1ea, w: 0x1c1a20 }); P.hl(px + 3, -12, 16, 0xfff0a0); }
      dorr(P, d0, d0 + ((d1 - d0) >> 1), ROD, { h: 26, karm: MASS, glas: true, lykta: false }, natt, lit);
      dorr(P, d0 + ((d1 - d0) >> 1) + 1, d1, ROD, { h: 26, karm: MASS, glas: true, lykta: false }, natt, lit);
      lykta(P, d0 - 8, -32, natt, lit); lykta(P, d1 + 10, -32, natt, lit);
    } else if (typ === 'kafe') {
      puts(P, x0, -h + 26, x1, -1, PUTS.ockra, s);
      sadeltak(P, x0, x1, -h + 26, 24, TEGEL, s); skorsten(P, x0 + 24, -h + 4, 12);
      for (const fx of [x0 + 14, x1 - 26]) fonster(P, fx, -h + 36, 12, 12, { natt, lucka: GRON, blom: true, gardin: 0xf4f1ea }, lit);
      // skyltfönstret med bakelser och gardiner, menytavlan, koppen på skylten
      fonster(P, x0 + 10, -36, 34, 22, { natt, lucka: null, spröjs: false, gardin: 0xf4e0d0, lyser: true }, lit);
      for (let i = 0; i < 5; i++) { const bx = x0 + 14 + i * 6; P.rect(bx, -22, 4, 3, [0xf0a0b8, 0xffffff, 0xd8a050, 0xf0c030, 0x8a4a2a][i]); P.px(bx + 1, -23, [0xd82838, 0xf0c030, 0xffffff, 0xd82838, 0xf4f1ea][i]); }
      P.hl(x0 + 12, -19, 30, TRA[4]);
      namnskylt(P, cx, -48, H.namn, GRON[1], 0xfff0a0, GRON[0]);
      hangskylt(P, x1 + 2, -40, ['wwww.', 'wwwwk', 'wwwwk', '.www.', 'kkkkk'], { w: 0xf4f1ea, k: 0x6a4a2a }, MASS);
      dorr(P, d0, d1, GRON, { h: 24, glas: true }, natt, lit);
      lykta(P, d0 - 8, -26, natt, lit);
    } else if (typ === 'antik') {
      puts(P, x0, -h + 40, x1, -1, PUTS.bla, s);
      korsvirke(P, x0, -h + 40, x1, -30, s);
      trappgavel(P, x0, x1, -h + 40, 40, PUTS.bla, s, natt, lit);
      fonster(P, x0 + 12, -h + 50, 10, 11, { natt, lucka: TRA, blom: true }, lit); fonster(P, x1 - 22, -h + 50, 10, 11, { natt, lucka: TRA }, lit);
      // burspråket: klocka, vas och lampa i fönstret
      fyll(P, x0 + 6, -30, x0 + 44, -1, (X, Y) => (X === x0 + 6 || X === x0 + 44 || Y === -30) ? TRA[1] : tone(TRA, 0.55, X, Y));
      fonster(P, x0 + 9, -27, 32, 18, { natt, lucka: null, spröjs: false, lyser: true }, lit);
      spr(P, x0 + 12, -24, ['.kkk.', 'kwwwk', 'kwkwk', 'kwwwk', '.kkk.', '..k..', '.kkk.'], { k: 0x6a4a2a, w: 0xf4f1ea });   // bordsklockan
      spr(P, x0 + 22, -22, ['.bb.', 'bbbb', '.bb.', '.bb.', 'bbbb'], { b: 0x3a7bd5 });   // vasen
      spr(P, x0 + 30, -26, ['.yyy.', 'yyyyy', '..k..', '..k..', '.kkk.'], { y: 0xf0c030, k: 0x8a6a2a });   // lampan
      P.hl(x0 + 10, -10, 30, TRA[4]);
      hangskylt(P, x1 + 2, -44, ['.kkk.', 'kwwwk', 'kwkwk', 'kwwwk', '.kkk.'], { k: 0x6a4a2a, w: 0xf4f1ea }, MASS);
      namnskylt(P, cx + 10, -42, H.namn, 0x2a2420, 0xf0c030, MASS[1]);
      dorr(P, d0, d1, TRA, { h: 22, glas: true }, natt, lit);
    } else if (typ === 'guldsmed') {
      puts(P, x0, -h + 28, x1, -1, PUTS.kalk, s);
      korsvirke(P, x0, -h + 28, x1, -32, s);
      sadeltak(P, x0, x1, -h + 28, 26, BRUNTAK, s); skorsten(P, x1 - 18, -h + 4, 12);
      fonster(P, x0 + 12, -h + 40, 10, 11, { natt, lucka: ROD, blom: true }, lit); fonster(P, x1 - 22, -h + 40, 10, 11, { natt, lucka: ROD }, lit);
      // det lilla fönstret med ringar på sammet, galler
      fonster(P, x0 + 10, -28, 24, 14, { natt, lucka: null, spröjs: false, lyser: true }, lit);
      fyll(P, x0 + 11, -20, x0 + 32, -15, (X, Y) => tone(ROD, 0.3, X, Y));
      for (let i = 0; i < 4; i++) { const rx = x0 + 13 + i * 5; P.px(rx, -22, MASS[3]); P.px(rx + 1, -23, MASS[4]); P.px(rx + 2, -22, MASS[3]); P.px(rx + 1, -21, MASS[2]); P.px(rx + 1, -24, [0xffffff, 0x60c0ff, 0xf06aa0, 0x60e080][i]); }
      for (let x = x0 + 12; x < x0 + 34; x += 4) P.vl(x, -27, 13, JARN[2], 0.5);
      hangskylt(P, x1 + 2, -40, ['.yyy.', 'yy.yy', 'y...y', 'yy.yy', '.yyy.'], { y: 0xf0c030 }, MASS);
      namnskylt(P, cx, -42, H.namn, 0x2a2420, 0xf0c030, MASS[2]);
      dorr(P, d0, d1, [0x2a1a3a, 0x4a2a5a, 0x6a3a7a, 0x8a5a9a, 0xaa7aba], { h: 22, glas: true, lykta: false }, natt, lit);
    } else if (typ === 'lykt') {
      puts(P, x0, -h + 30, x1, -1, PUTS.terra, s);
      sadeltak(P, x0, x1, -h + 30, 24, SKIFFER, s); skorsten(P, x0 + 20, -h + 6, 12);
      fonster(P, x0 + 12, -h + 42, 10, 11, { natt, lucka: BLA }, lit); fonster(P, x1 - 22, -h + 42, 10, 11, { natt, lucka: BLA, blom: true }, lit);
      // fönstret fullt av lyktor – tända om natten
      fonster(P, x0 + 8, -32, 34, 20, { natt, lucka: null, spröjs: false, lyser: true }, lit);
      for (let i = 0; i < 5; i++) { const lx = x0 + 11 + i * 7, ly = -28 + (i % 2) * 7; P.rect(lx, ly, 4, 6, JARN[1]); P.hl(lx - 1, ly - 1, 6, JARN[3]); P.px(lx + 2, ly - 2, JARN[3]); P.rect(lx + 1, ly + 1, 2, 4, natt ? [0xffe8a0, 0xffb060, 0xa0e0ff, 0xffe8a0, 0xf0c0ff][i] : [0xd8e8f0, 0xe0c0a0, 0xa0d0e0, 0xd8e8f0, 0xe0d0f0][i]); }
      hangskylt(P, x1 + 2, -42, ['.kkk.', 'kwwwk', 'kwwwk', 'kwwwk', '.kkk.'], { k: 0x2a2a30, w: natt ? 0xffe8a0 : 0xd8e8f0 }, JARN);
      namnskylt(P, cx, -44, H.namn, 0x2a2420, 0xfff0a0, JARN[3]);
      dorr(P, d0, d1, [0x1a2a3a, 0x2a4050, 0x3a5868, 0x5a7888, 0x7a98a8], { h: 22, glas: true, lykta: false }, natt, lit);
    } else {
      // bostadshus: puts eller korsvirke, två våningar, gavel/trappgavel/sadeltak, luckor, blomlådor, katt
      const pal = PUTS[H.farg] || PUTS.ockra, takTyp = ['gavel', 'trapp', 'sadel'][(H.x / 97 | 0) % 3], rh = takTyp === 'sadel' ? 26 : takTyp === 'trapp' ? 40 : 34;
      const wt = -h + rh;
      puts(P, x0, wt, x1, -1, pal, s, { sned: true });
      if (H.farg === 'ockra' || H.farg === 'gron') korsvirke(P, x0, wt, x1, -1, s);
      if (takTyp === 'sadel') { sadeltak(P, x0, x1, wt, rh, TEGEL, s); skorsten(P, x0 + 12, -h + 2, 12); }
      else if (takTyp === 'trapp') trappgavel(P, x0, x1, wt, rh, pal, s, natt, lit);
      else { gavel(P, x0, x1, wt, rh, pal, s, natt, lit); skorsten(P, x1 - 14, wt - 16, 10); }
      const lucka = [GRON, ROD, BLA, TRA][(H.x / 53 | 0) % 4];
      fonster(P, x0 + 10, wt + 10, 10, 11, { natt, lucka, blom: hash(w, 1, 2) > 0.4 }, lit); fonster(P, x1 - 20, wt + 10, 10, 11, { natt, lucka, blom: hash(w, 2, 2) > 0.4 }, lit);
      fonster(P, x0 + 10, -30, 10, 11, { natt, lucka, gardin: 0xf4f1ea }, lit);
      if (hash(w, 3, 2) > 0.5) spr(P, x0 + 12, -24, ['k.k', 'kkk', 'kek', '.k.'], { k: H.farg === 'rosa' ? 0x2a2a30 : 0xd88a30, e: 0x60e080 });   // katten i fönstret
      if (x1 - 20 > d1 + 6) fonster(P, x1 - 20, -30, 10, 11, { natt, lucka, gardin: 0xf4f1ea }, lit);
      dorr(P, d0, d1, [TRA, ROD, GRON, BLA][(H.x / 71 | 0) % 4], { h: 20 }, natt, lit);
      if (hash(w, 4, 2) > 0.5) { P.rect(x0 + 2, -4, 5, 4, TERR[2]); P.hl(x0 + 1, -5, 7, TERR[3]); for (const [i, j] of [[1, -1], [3, -2], [5, -1], [2, -3], [4, -3]]) P.px(x0 + 1 + i, -5 + j, j === -3 ? 0xf06aa0 : 0x3e7e2a); }
    }
    // husfoten och skarven mot grannen
    P.hl(x0, 0, w, 0x000000, 0.2); P.hl(x0, 1, w, 0x000000, 0.1);
    P.vl(x0, -h + 40, h - 40, 0x000000, 0.18); P.vl(x1, -h + 40, h - 40, 0xffffff, 0.08);
    LIT[`${id}|${natt ? 1 : 0}`] = lit;
  });
}
export function ritaHus(ctx, id, natt) { put(ctx, husBild(id, natt), HUS[id].x, G.BASE); }
// det som rör sig: teaterns glödlampor, skorstensröken på bostadshusen och gnistan hos guldsmeden
export function husLiv(ctx, id, t, natt) {
  const H = HUS[id], x = H.x, y = G.BASE;
  if (H.typ === 'teater') { const cx = x + (H.w >> 1); for (let i = 0, lx = cx - 60; lx <= cx + 60; lx += 4, i++) glodlampa(ctx, lx, y - 46 + 16, i, t, natt); }
  if (H.typ === 'bostad' && ['sadel', 'gavel'].includes(['gavel', 'trapp', 'sadel'][(H.x / 97 | 0) % 3])) {
    const takTyp = ['gavel', 'trapp', 'sadel'][(H.x / 97 | 0) % 3], sx = takTyp === 'sadel' ? x + 15 : x + H.w - 11, sy = takTyp === 'sadel' ? y - H.h + 1 : y - H.h + 34 - 17;
    for (let k = 0; k < 4; k++) { const u = ((t * 0.25 + k * 0.25) % 1); ctx.fillStyle = `rgba(230,228,220,${(0.5 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(sx + Math.sin(t + k) * 2 + u * 4), Math.round(sy - 2 - u * 14), 2 + (u > 0.5 ? 1 : 0), 2); }
  }
  if (H.typ === 'guldsmed' && Math.sin(t * 5 + x) > 0.96) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 20 + ((t * 3 | 0) % 3) * 5, y - 25, 1, 1); }
}
// glöden från tända fönster och lyktor om natten
export function husSken(ctx, id, t) {
  const lit = LIT[`${id}|1`]; if (!lit) return;
  const H = HUS[id];
  ctx.globalCompositeOperation = 'lighter';
  for (const [lx, ly, lw, lh] of lit) {
    const X = H.x + lx, Y = G.BASE + ly;
    ctx.fillStyle = 'rgba(255,200,112,0.3)'; ctx.fillRect(X, Y, lw, lh);
    ctx.fillStyle = 'rgba(255,154,64,0.1)'; ctx.fillRect(X - 3, Y - 2, lw + 6, lh + 6);
  }
  ctx.globalCompositeOperation = 'source-over';
}
export const _lit = (id, natt) => LIT[`${id}|${natt ? 1 : 0}`] || null;
