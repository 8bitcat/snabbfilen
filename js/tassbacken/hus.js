// 🏘️ TASSBACKENS HUS i full prakt (Carl 2026-10-13: "höj nivån rejält med alla detaljer … kattkaffet ser ut utan
// detaljer … själva husen och allt i Tassbacken saknar väldigt mycket detaljer"). Samma hantverk som glasståndet och
// leksaksaffären: tonramper (mörk → ljus) med Bayer-dither i övergångarna, ljuset från vänster uppe, socklar,
// stuprör, takfötter med tandsnitt, fönster med spröjs, gardiner och blomlådor, dörrar med speglar och mässing – och
// skyltfönster där man ser in:
//   KATTCAFÉ KURR      – kattansiktet på taket (KURR i neon), kattklockan, tapeten, klösträdet, bakelsedisken,
//                        espressomaskinen och baristan
//   TASSARNAS HEM      – falurött med frontespis och oxöga, farstukvist, anslagstavlan med djuren som söker hem
//   DJURKLINIKEN       – ljuslådan med korset, EKG-bandet, väntrummet och receptionen bakom glaset
//   UTSTÄLLNINGSHALLEN – kopparvalv med takryttare, sandstensbågar, vepor och en biografmarkis med glödlampor
//   KLIPP & KLO        – rosa puts, bubbelfönstret med en hund i badet, trimbordet och en snurrande frisörstolpe
//   bostadshusen       – balkonger med smidesräcken, tvätten som fladdrar, cykeln vid porten, klätterrosen
// husBild(id, natt) målas EN gång per hus och dag/natt; husLiv() ritar det som rör sig varje bildruta och husSken()
// glöden efter mörkret. Bildens origo: husPos(id) i karta.js (8 px marginal åt sidorna, 40 px ovanför taket).
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { WALLS } from '../city/facade-kit.js';
import { drawPerson, makeLook } from '../core/people.js';
import { $t } from '../core/i18n.js';
import { HUS, tass } from './karta.js';

// ---------------------------------------------------------------- paletterna (mörk → ljus)
const VIT = [0x8a867c, 0xb6b2a8, 0xd8d4ca, 0xefece3, 0xfffdf7];
const FALU = [0x4a1410, 0x6e1d16, 0x92281e, 0xae3626, 0xc85440];
const SKIF = [0x1e1e26, 0x2c2c36, 0x3e3e4a, 0x545462, 0x70707e];
const TAKR = [0x521810, 0x76281a, 0x9c3824, 0xc04c32, 0xdc7050];
const KOPP = [0x1a4238, 0x2a6152, 0x3a8270, 0x58a68e, 0x8ccab2];
const GULP = [0x7a5410, 0xa87c20, 0xd0a238, 0xeec254, 0xf8de8c];
const ROSP = [0x8a3a52, 0xb86680, 0xdc90a8, 0xf2b4c6, 0xfcd6e0];
const MINP = [0x3e6e5a, 0x5a8e78, 0x80b49c, 0xaedcc4, 0xd4f0e2];
const BLAP = [0x34506e, 0x50709a, 0x7096c0, 0x8cb2d8, 0xb6d2ec];
const PUTS = [0xa4a29a, 0xc4c2ba, 0xdcdad2, 0xeeece6, 0xfaf9f6];
const GRONB = [0x0a2016, 0x12341f, 0x1c4c30, 0x2c6a46, 0x4c8c64];
const MASS = [0x5a3c0c, 0x8a6418, 0xc0922c, 0xe6be4c, 0xfff0a0];
const JARN = [0x101216, 0x1c2026, 0x2c323a, 0x434b56, 0x646e7a];
const ZINK = [0x4a5058, 0x6a727c, 0x8e98a2, 0xb4bcc4, 0xd8dee4];
const STEN = [0x56524c, 0x76716a, 0x969088, 0xb4aea4, 0xd0cac0];
const SAND = [0x7a5a3a, 0xa07a50, 0xc49c6a, 0xdcbc88, 0xf0dcb0];
const TRA = [0x3a2214, 0x5e3a20, 0x86562e, 0xae7640, 0xd29a5c];
const TERR = [0x6a2a14, 0x9a4020, 0xc0602e, 0xdc8048, 0xf0a870];
const BLAD = [0x163414, 0x24521c, 0x387628, 0x52983a, 0x80c05a];
const PERS = [0x9a5a4a, 0xc07a64, 0xe09a80, 0xf4b89c, 0xffd8c0];
const KAKEL = [0x8a9aa0, 0xb4c2c6, 0xd6e0e2, 0xecf2f2, 0xfafcfc];
const GLD = [0x26364e, 0x3a5274, 0x5a7ca4, 0x8eb2d6, 0xcce2f4];   // glas på dagen
const GLN = [0x7a3e14, 0xb06a28, 0xe09a44, 0xffcc78, 0xfff0c4];   // tänt fönster
const GLM = [0x080c18, 0x0e1626, 0x162238, 0x22324e, 0x34486a];   // mörkt fönster
const RODT = [0x5e0e16, 0x9a1a24, 0xd4323a, 0xf06868, 0xffb4ac];
const BLA = [0x122656, 0x1c4086, 0x285ec0, 0x5890e8, 0xa8ccff];
const BLOMMOR = { rod: [0xe0383c, 0xff6a5a, 0xffffff], rosa: [0xf06aa0, 0xffb0d0, 0xffffff], lila: [0x9a5ad8, 0xd0a8f8, 0xfff0a0], gul: [0xf0c030, 0xfff08a, 0xe06a2a] };

// ---------------------------------------------------------------- pennorna
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
function fyll(P, x0, y0, x1, y1, fn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = fn(x, y); if (c != null) P.px(x, y, c); } }
function spr(P, x, y, rows, pal) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c != null) P.px(x + i, y + j, c); } }); }
const skugga = (P, x0, x1, y, n, f = 0.1) => { for (let i = 0; i < n; i++) P.darken(x0, y + i, x1 - x0 + 1, 1, 1 - (n - i) * f); };
// text med mörk kant runt om (och en ljus överkant på bokstäverna)
function skylttext(P, F, s, x, y, c, kant, ljus) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) text(P, F, s, x + dx, y + dy, kant);
  text(P, F, s, x, y, c);
  if (ljus != null) { const rad = new Map(); text({ px: (px, py) => { if (!rad.has(px) || py < rad.get(px)) rad.set(px, py); } }, F, s, x, y, 0); for (const [px, py] of rad) P.px(px, py, ljus); }
}
// störst typsnitt som ryms (översättningarna är ofta längre än svenskan)
const passa = (s, maxW) => (textW(BIG, s) <= maxW ? BIG : SMALL);
// (parken på södra sidan – js/tassbacken/park.js – målar med samma pennor och färger)
export const PENNOR = { tone, fyll, spr, skylttext, passa, kruka: (...a) => kruka(...a), blomlada: (...a) => blomlada(...a) };
export const FARGER = { VIT, FALU, SKIF, TAKR, KOPP, GULP, ROSP, MINP, BLAP, PUTS, GRONB, MASS, JARN, ZINK, STEN, SAND, TRA, TERR, BLAD, RODT, BLA, BLOMMOR };

// ---------------------------------------------------------------- väggarna
// stående lockpanel: bräder med lock (ljus vänsterkant, skugga till höger om locket), ljuset uppifrån
function lockpanel(P, x0, y0, x1, y1, pal, s) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    const k = (((x - x0) % 7) + 7) % 7, bord = Math.floor((x - x0) / 7), u = (y - y0) / Math.max(1, y1 - y0);
    let v = 0.6 - u * 0.12 + (hash(bord, 0, s) - 0.5) * 0.1;
    if (k === 5) v += 0.24; else if (k === 6) v += 0.06; else if (k === 0) v -= 0.2;
    if (k > 0 && k < 5 && hash(bord, y >> 2, s + 1) > 0.93) v -= 0.1;
    if (hash(x, y, s + 2) > 0.985) v -= 0.14;
    return tone(pal, v, x, y);
  });
}
// liggande panel: 4 px höga bräder, ljus överkant och skuggan under överlappet
function liggpanel(P, x0, y0, x1, y1, pal, s) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    const r = (((y - y0) % 4) + 4) % 4, rad = Math.floor((y - y0) / 4);
    let v = 0.62 + (hash(rad, x >> 4, s) - 0.5) * 0.08 - (x - x0) / (x1 - x0 + 1) * 0.08;
    if (r === 0) v -= 0.24; else if (r === 1) v += 0.14;
    if (hash(x >> 1, rad, s + 3) > 0.97) v -= 0.1;
    return tone(pal, v, x, y);
  });
}
function puts(P, x0, y0, x1, y1, pal, s) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    let v = 0.64 + (hash(x >> 1, y >> 1, s) - 0.5) * 0.08 - (x - x0) / (x1 - x0 + 1) * 0.06;
    if (hash(x, y, s + 4) > 0.97) v -= 0.08;
    const ner = y1 - y; if (ner < 8) v -= (8 - ner) * 0.015;   // stänk från gatan
    return tone(pal, v, x, y);
  });
}
const tegel = (P, x0, y0, x1, y1, c, s) => fyll(P, x0, y0, x1, y1, (x, y) => WALLS.brick(x, y, c, s));
// sockeln: huggen sten i förband med en ljus avtäckning
function sockel(P, x0, x1, y0, y1, s, pal = STEN) {
  fyll(P, x0, y0, x1, y1, (x, y) => {
    const rad = Math.floor((y - y0) / 5), bx = x + (rad & 1) * 6 + 60, blk = Math.floor(bx / 12), ry = (y - y0) % 5, rx = bx % 12;
    if (ry === 4 || rx === 11) return pal[0];
    let v = 0.55 + (hash(blk, rad, s) - 0.5) * 0.22 - ry * 0.04 + (rx === 0 ? 0.1 : 0) + (ry === 0 ? 0.12 : 0);
    if (hash(x, y, s + 5) > 0.9) v += 0.1; else if (hash(x, y, s + 6) > 0.92) v -= 0.12;
    return tone(pal, v, x, y);
  });
  P.hl(x0 - 1, y0 - 2, x1 - x0 + 3, pal[4]); P.hl(x0 - 1, y0 - 1, x1 - x0 + 3, pal[2]);
}
// takfoten / taklisten: profil i flera band med tandsnitt, och skuggan på väggen under
function taklist(P, x0, x1, y, pal = VIT, tand = true) {
  P.hl(x0 - 3, y, x1 - x0 + 7, pal[4]); P.hl(x0 - 3, y + 1, x1 - x0 + 7, pal[3]); P.hl(x0 - 2, y + 2, x1 - x0 + 5, pal[1]);
  if (tand) for (let x = x0 - 2; x <= x1 + 2; x++) { P.px(x, y + 3, (x & 3) < 2 ? pal[3] : pal[0]); P.px(x, y + 4, (x & 3) < 2 ? pal[2] : pal[0]); }
  P.hl(x0 - 1, y + (tand ? 5 : 3), x1 - x0 + 3, pal[2]);
  skugga(P, x0, x1, y + (tand ? 6 : 4), 3, 0.08);
}
function stupror(P, x, y0, y1) {
  for (let y = y0; y <= y1; y++) { P.px(x, y, ZINK[3]); P.px(x + 1, y, ZINK[2]); P.px(x + 2, y, ZINK[1]); P.px(x + 3, y, 0x000000, 0.2); }
  P.rect(x - 1, y0 - 2, 5, 2, ZINK[2]); P.hl(x - 1, y0 - 2, 5, ZINK[4]);   // tratten
  for (let y = y0 + 8; y < y1 - 4; y += 14) { P.hl(x - 1, y, 5, JARN[2]); P.px(x - 1, y - 1, ZINK[4]); }   // fästena
  P.rect(x, y1 + 1, 3, 1, ZINK[2]); P.rect(x + 1, y1 + 2, 4, 1, ZINK[1]); P.px(x + 4, y1 + 1, ZINK[3]);   // utkastaren
}
// en vägglykta: plåten på väggen, armen och lyktan (tänd på kvällen)
function vagglykta(P, x, y, natt, M, pal = JARN) {
  P.rect(x - 1, y - 14, 3, 4, pal[2]); P.px(x - 1, y - 14, pal[4]);
  P.px(x, y - 10, pal[3]); P.px(x + 1, y - 11, pal[3]); P.px(x + 2, y - 11, pal[2]);
  P.hl(x - 2, y - 9, 7, pal[1]); P.hl(x - 1, y - 10, 5, pal[2]); P.px(x + 1, y - 11, pal[4]);
  fyll(P, x - 1, y - 8, x + 3, y - 3, (X, Y) => (natt ? (X === x - 1 ? GLN[4] : GLN[3]) : X === x - 1 ? 0xe8f0f4 : Y > y - 5 ? 0xa8b8c4 : 0xc8d8e0));
  P.vl(x - 2, y - 8, 6, pal[2]); P.vl(x + 4, y - 8, 6, pal[0]); P.vl(x + 1, y - 8, 6, pal[1], 0.6);
  P.hl(x - 2, y - 2, 7, pal[1]); P.hl(x - 1, y - 1, 5, pal[2]); P.px(x + 1, y, pal[3]);
  if (natt) M.sken.push([x + 1, y - 5, 16, 0xffd890]);
}
function kruka(P, x, y, farg = 0xe04848) {
  P.rect(x, y - 2, 4, 3, TERR[2]); P.hl(x - 1, y - 3, 6, TERR[4]); P.vl(x + 3, y - 2, 3, TERR[1]);
  for (const [i, j] of [[1, -4], [2, -4], [0, -5], [1, -6], [2, -5], [3, -5], [2, -6], [4, -4]]) P.px(x + i, y + j, tone(BLAD, 0.45 + hash(i, j, x) * 0.45, x + i, y + j));
  P.px(x + 1, y - 7, farg); P.px(x + 2, y - 7, mix(farg, 0xffffff, 0.35)); P.px(x + 3, y - 6, farg);
}
// blomlåda: trälåda med pelargoner och rankor som hänger ner
function blomlada(P, x, y, w, farger, pal = TRA) {
  fyll(P, x, y + 1, x + w - 1, y + 4, (X, Y) => tone(pal, 0.66 - (Y - y) * 0.1 - ((X - x) % 7 === 6 ? 0.18 : 0), X, Y));
  P.hl(x, y + 1, w, pal[4]);
  for (let X = x; X < x + w; X++) {
    const hh = 2 + Math.floor(hash(X, y, 31) * 3);
    for (let j = 0; j < hh; j++) P.px(X, y - j, tone(BLAD, 0.38 + hash(X, j, 32) * 0.55, X, y - j));
    if (hash(X, y, 33) > 0.5) { const c = farger[Math.floor(hash(X, y, 34) * farger.length)]; P.px(X, y - hh, c); if (hash(X, y, 35) > 0.55) P.px(X, y - hh + 1, mul(c, 0.8)); }
    if (hash(X, y, 36) > 0.78) { const n = 1 + Math.floor(hash(X, y, 37) * 4); for (let j = 0; j < n; j++) P.px(X, y + 2 + j, tone(BLAD, 0.55 - j * 0.1, X, y + j)); if (hash(X, y, 38) > 0.5) P.px(X, y + 2 + n, farger[0]); }
  }
}
// en tavla i guldram (motivet: en katt, en hund eller en tass)
function tavla(P, x, y, w, h, motiv, natt) {
  P.rect(x, y, w, h, MASS[1]); P.hl(x, y, w, MASS[3]); P.vl(x, y, h, MASS[3]);
  fyll(P, x + 1, y + 1, x + w - 2, y + h - 2, (X, Y) => tone(motiv === 'hund' ? BLAP : PERS, 0.75 - (Y - y) * 0.06, X, Y));
  const mx = x + (w >> 1), my = y + (h >> 1);
  if (motiv === 'tass') { P.px(mx, my, 0x3a2a2a); P.px(mx - 1, my - 1, 0x3a2a2a); P.px(mx + 1, my - 1, 0x3a2a2a); P.px(mx - 1, my + 1, 0x3a2a2a); P.px(mx + 1, my + 1, 0x3a2a2a); return; }
  const k = motiv === 'hund' ? 0x8a5a30 : 0x3a3036;
  P.px(mx - 1, my - 2, k); P.px(mx + 1, my - 2, k); P.rect(mx - 1, my - 1, 3, 2, k); P.px(mx, my + 1, k);
}
// djuren i fönstren
const KATT_SITT = ['.a...a..', '.aa.aa..', '.aaaaa..', '.aeaea..', '.aanaa..', '..aaa...', '.abbba..', '.abbba.t', '.aa.aatt'];
const KATT_LIGG = ['..a.a......', '.aaaa..aaa.', 'aeeaaaaaaaa', 'aaaaaaaaaat', '.bbbbbbbbtt'];
const HUND_TITT = ['oo....oo', 'oaaaaaao', 'oaeaaeao', '.aaaaaa.', '.aannaa.', '..arra..'];
function djur(P, x, y, typ, natt, tand, farg = 0xe08a3a) {
  const sil = natt && tand ? 0x2a1a14 : null;
  const pal = sil != null ? { a: sil, b: sil, e: sil, n: sil, t: sil, o: sil, r: sil } : { a: farg, b: mix(farg, 0xffffff, 0.6), e: 0x1a2a1a, n: 0xe86a8a, t: mul(farg, 0.8), o: mul(farg, 0.7), r: 0xf07a9a };
  if (natt && !tand) return;
  if (typ === 'katt') spr(P, x, y - 9, KATT_SITT, pal);
  else if (typ === 'sover') spr(P, x, y - 5, KATT_LIGG, pal);
  else if (typ === 'hund') spr(P, x, y - 6, HUND_TITT, pal);
}

// ---------------------------------------------------------------- fönster och dörrar
// o: natt, tand, ram (palett), sp [kolumner, rader], gardin (färg), spets, krona ('tri'|'rak'|'bage'), lada (blommor),
//    luckor (palett), djur ('katt'|'sover'|'hund' + djurfarg), kruka (blomfärg), M (metan för skenet)
function fonster(P, x, y, w, h, o = {}) {
  const R = o.ram || VIT, natt = !!o.natt, tand = natt && !!o.tand;
  if (o.luckor) for (const lx of [x - 6, x + w + 1]) {
    fyll(P, lx, y, lx + 4, y + h - 1, (X, Y) => tone(o.luckor, (Y - y) % 3 === 0 ? 0.3 : 0.72 - (X - lx) * 0.07, X, Y));
    P.vl(lx, y, h, tone(o.luckor, 0.92, lx, y)); P.px(lx + (lx < x ? 4 : 0), y + (h >> 1), MASS[2]);
  }
  P.rect(x - 1, y - 1, w + 2, h + 2, mul(R[0], 0.65));
  fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => tone(R, X === x || Y === y ? 0.95 : X === x + w - 1 || Y === y + h - 1 ? 0.42 : 0.74, X, Y));
  const gx0 = x + 2, gy0 = y + 2, gx1 = x + w - 3, gy1 = y + h - 3, gw = gx1 - gx0 + 1, gh = gy1 - gy0 + 1;
  if (o.bage) {   // rundbåge överst (stenhusens fönster)
    const r = (w >> 1);
    for (let Y = y - r; Y < y; Y++) for (let X = x; X < x + w; X++) { const d = Math.hypot(X + 0.5 - (x + w / 2), Y + 0.5 - y); if (d < r) P.px(X, Y, d > r - 2 ? tone(R, X < x + w / 2 ? 0.92 : 0.5, X, Y) : natt ? (tand ? tone(GLN, 0.9, X, Y) : tone(GLM, 0.6, X, Y)) : tone(GLD, 0.85, X, Y)); }
  }
  fyll(P, gx0, gy0, gx1, gy1, (X, Y) => {
    const u = (Y - gy0) / Math.max(1, gh - 1);
    if (tand) return tone(GLN, 0.88 - u * 0.42, X, Y);
    if (natt) return tone(GLM, 0.6 - u * 0.35, X, Y);
    let v = 0.8 - u * 0.52; if ((((X * 2 - Y * 3) % 23) + 23) % 23 < 2) v += 0.24;
    return tone(GLD, v, X, Y);
  });
  if (o.persienn) for (let Y = gy0; Y < gy0 + Math.round(gh * o.persienn); Y++) P.hl(gx0, Y, gw, (Y - gy0) % 2 ? (tand ? 0xc8a070 : 0x9aa4ae) : (tand ? 0xf8e0b0 : 0xdce2e8));
  if (o.gardin != null) {
    const G = natt && !tand ? mul(o.gardin, 0.3) : tand ? mix(o.gardin, 0xffd890, 0.25) : o.gardin;
    P.hl(gx0, gy0, gw, mul(G, 0.78)); P.hl(gx0, gy0 + 1, gw, G);
    for (let Y = gy0 + 2; Y <= gy1; Y++) { const u = (Y - gy0) / gh, b = Math.max(1, Math.round(1 + Math.abs(u - 0.5) * 3)); for (let i = 0; i < b; i++) { P.px(gx0 + i, Y, i === b - 1 ? mul(G, 0.74) : G); P.px(gx1 - i, Y, i === b - 1 ? mul(G, 0.74) : mix(G, 0xffffff, 0.14)); } }
  }
  if (o.spets) for (let Y = gy0 + (gh >> 1); Y <= gy1; Y++) for (let X = gx0; X <= gx1; X++) if (((X + Y) & 1) === 0 || (Y - gy0) % 3 === 0) P.px(X, Y, natt ? (tand ? 0xfff2d4 : 0x323c50) : 0xf6f4ee, (Y - gy0) % 3 === 0 ? 0.85 : 0.5);
  if (o.djur) djur(P, gx0 + 1, gy1 + 1, o.djur, natt, tand, o.djurfarg);
  if (o.kruka) kruka(P, gx1 - 4, gy1, o.kruka);
  const [nk, nr] = o.sp || [2, 2];
  for (let k = 1; k < nk; k++) { const X = gx0 + Math.round(gw * k / nk) - 1; P.vl(X, gy0, gh, R[3]); P.vl(X + 1, gy0, gh, R[1]); }
  for (let r = 1; r < nr; r++) { const Y = gy0 + Math.round(gh * r / nr) - 1; P.hl(gx0, Y, gw, R[3]); P.hl(gx0, Y + 1, gw, R[1]); }
  P.hl(x - 2, y + h, w + 4, R[4]); P.hl(x - 2, y + h + 1, w + 4, R[1]); P.hl(x - 1, y + h + 2, w + 2, 0x000000, 0.22);
  if (o.krona === 'tri') {
    const hh = Math.max(3, Math.round(w / 4));
    for (let j = 0; j < hh; j++) { const ins = Math.round(j * (w / 2 + 2) / hh); P.hl(x - 2 + ins, y - 3 - j, w + 4 - ins * 2, j === 0 ? R[1] : tone(R, 0.95 - j / hh * 0.35, x + ins, y - j)); }
    P.hl(x - 2, y - 2, w + 4, R[2]);
  } else if (o.krona === 'rak') { P.hl(x - 2, y - 4, w + 4, R[4]); P.hl(x - 2, y - 3, w + 4, R[3]); P.hl(x - 1, y - 2, w + 2, R[1]); }
  else if (o.krona === 'snick') {   // snickarglädje: en sågad list med droppar över fönstret
    P.hl(x - 3, y - 4, w + 6, R[4]); P.hl(x - 3, y - 3, w + 6, R[2]);
    for (let X = x - 2; X < x + w + 2; X += 3) { P.px(X, y - 2, R[3]); P.px(X + 1, y - 2, R[3]); P.px(X, y - 1, R[1]); }
    P.px(x + (w >> 1), y - 6, R[4]); P.hl(x + (w >> 1) - 1, y - 5, 3, R[3]);
  }
  if (o.lada) blomlada(P, x - 1, y + h + 2, w + 2, o.lada);
  if (tand && o.M) o.M.ljus.push([gx0, gy0, gw, gh]);
}
// o: pal, ram, natt, glas (andel glas uppifrån), overljus ('rak'|'bage'), nr, brev, spark, dekal(P, gx0, gy0, gx1, gy1)
function dorr(P, x, y, w, h, o) {
  const D = o.pal, R = o.ram || VIT, natt = !!o.natt;
  fyll(P, x - 2, y - 2, x + w + 1, y + h - 1, (X, Y) => (X < x || X >= x + w || Y < y) ? tone(R, X < x ? 0.85 : X >= x + w ? 0.38 : 0.78, X, Y) : null);
  if (o.overljus) {
    const ty1 = y - 3, ty0 = ty1 - 5;
    fyll(P, x - 2, ty0 - 1, x + w + 1, ty1, (X, Y) => tone(R, X < x ? 0.85 : 0.6, X, Y));
    if (o.overljus === 'bage') {   // solfjäder: en tillplattad halvcirkel med strålar
      const cx = x + w / 2, rx = w / 2 + 2, ry = 9, by = ty1 + 1;
      for (let Y = by - ry - 1; Y <= ty1; Y++) for (let X = x - 2; X < x + w + 2; X++) {
        const d = Math.hypot((X + 0.5 - cx) / rx, (Y + 0.5 - by) / ry);
        if (d > 1) continue;
        if (d > 0.8) { P.px(X, Y, tone(R, X < cx ? 0.92 : 0.5, X, Y)); continue; }
        const a = Math.atan2(by - Y - 0.5, X + 0.5 - cx);
        P.px(X, Y, Math.floor(a / Math.PI * 7) % 2 === 0 && d > 0.25 ? R[2] : natt ? tone(GLN, 0.85 - d * 0.3, X, Y) : tone(GLD, 0.8 - d * 0.3, X, Y));
      }
    }
    else { fyll(P, x, ty0, x + w - 1, ty1 - 1, (X, Y) => natt ? tone(GLN, 0.8, X, Y) : tone(GLD, 0.78 - (Y - ty0) * 0.08, X, Y)); for (let X = x + 3; X < x + w - 2; X += 4) P.vl(X, ty0, 4, R[2]); }
    if (o.nr) { const tw = textW(SMALL, o.nr); text(P, SMALL, o.nr, x + ((w - tw) >> 1), ty0 + (o.overljus === 'bage' ? -3 : 0), MASS[3]); }
  }
  const n = w >= 18 ? 2 : 1, bw = Math.floor(w / n), gl = o.glas ?? 0.45;
  let glasRekt = null;
  for (let k = 0; k < n; k++) {
    const bx = x + k * bw, bx1 = k === n - 1 ? x + w - 1 : bx + bw - 1, pw = bx1 - bx + 1;
    fyll(P, bx, y, bx1, y + h - 1, (X, Y) => tone(D, 0.62 - (X - bx) / pw * 0.14 + (X === bx ? 0.18 : 0) - (X === bx1 ? 0.24 : 0) + (hash(X >> 1, Y >> 3, 9) - 0.5) * 0.06, X, Y));
    const gh = Math.round((h - 8) * gl);
    if (gh > 2) {
      const gx0 = bx + 2, gx1 = bx1 - 2, gy0 = y + 3, gy1 = y + 2 + gh;
      fyll(P, gx0, gy0, gx1, gy1, (X, Y) => natt ? tone(GLN, 0.85 - (Y - gy0) / gh * 0.4, X, Y) : tone(GLD, 0.72 - (Y - gy0) / gh * 0.36 + ((((X * 2 - Y * 3) % 17) + 17) % 17 < 2 ? 0.24 : 0), X, Y));
      P.hl(gx0 - 1, gy0 - 1, gx1 - gx0 + 3, D[1]); P.hl(gx0 - 1, gy1 + 1, gx1 - gx0 + 3, D[4]); P.vl(gx0 - 1, gy0, gh, D[1]); P.vl(gx1 + 1, gy0, gh, D[4]);
      if (gx1 - gx0 >= 6) P.vl((gx0 + gx1) >> 1, gy0, gh, D[3]);
      if (gh >= 9) P.hl(gx0, gy0 + (gh >> 1), gx1 - gx0 + 1, D[3]);
      glasRekt = glasRekt ? [glasRekt[0], gy0, gx1, gy1] : [gx0, gy0, gx1, gy1];
    }
    const py0 = y + 5 + Math.max(0, gh), py1 = y + h - 5;
    if (py1 - py0 >= 3) { P.hl(bx + 2, py0, pw - 4, D[1]); P.vl(bx + 2, py0, py1 - py0 + 1, D[1]); P.hl(bx + 3, py1, pw - 5, D[4]); P.vl(bx1 - 2, py0 + 1, py1 - py0, D[4]); fyll(P, bx + 3, py0 + 1, bx1 - 3, py1 - 1, (X, Y) => tone(D, 0.7 - (Y - py0) * 0.02, X, Y)); }
    if (o.spark) { P.rect(bx + 1, y + h - 3, pw - 2, 2, MASS[2]); P.hl(bx + 1, y + h - 3, pw - 2, MASS[4]); }
  }
  if (n === 2) P.vl(x + bw, y, h, D[0]);
  if (o.dekal && glasRekt) o.dekal(P, ...glasRekt);
  for (const hx of n === 2 ? [x + bw - 3, x + bw + 2] : [x + w - 4]) { const hy = y + (h >> 1) + 1; P.rect(hx, hy - 2, 2, 5, MASS[1]); P.px(hx, hy - 2, MASS[4]); P.px(hx + (n === 2 && hx > x + bw ? 0 : -1), hy, MASS[3]); P.px(hx, hy + 2, 0x1a1414); }
  if (o.brev) { const bx = x + (n === 2 ? 2 : 3), by = y + h - 11; P.rect(bx, by, 6, 2, MASS[1]); P.hl(bx, by, 6, MASS[4]); }
  P.hl(x - 3, y + h, w + 6, STEN[4]); P.hl(x - 3, y + h + 1, w + 6, STEN[2]);   // tröskeln och steget
  return glasRekt;
}
// skyltbräde i guldram med texten centrerad (största typsnitt som ryms)
function brade(P, cx, y, s, bg, fg, maxW, o = {}) {
  const F = passa(s, maxW - 10), tw = textW(F, s), w = Math.min(maxW, tw + 12), h = F.h + 8, x0 = Math.round(cx - w / 2);
  for (let Y = y; Y < y + h; Y++) for (let X = x0; X < x0 + w; X++) {
    if ((X === x0 || X === x0 + w - 1) && (Y === y || Y === y + h - 1)) continue;
    const ram = X < x0 + 2 || X >= x0 + w - 2 || Y < y + 2 || Y >= y + h - 2;
    P.px(X, Y, ram ? tone(o.ram || MASS, 0.9 - (X - x0) / w * 0.45 - (Y - y) / h * 0.3 + (Y === y ? 0.1 : 0), X, Y) : tone(bg, 0.7 - (Y - y) / h * 0.3 - (X - x0) / w * 0.12 + (hash(X >> 2, Y, 71) - 0.5) * 0.06, X, Y));
  }
  skylttext(P, F, s, Math.round(cx - tw / 2), y + 4, fg, o.kant ?? mul(bg[0] ?? 0, 1), o.ljus ?? mix(fg, 0xffffff, 0.55));
  P.hl(x0 + 1, y + h, w - 2, 0x000000, 0.3);
  return [x0, y, w, h];
}
// randig markis med bågkant; skuggan faller på väggen under
function markis(P, x0, x1, y, h, A, B) {
  const BAGE = [1, 2, 3, 3, 2, 1];
  for (let i = 0; i < 5; i++) P.darken(x0 + 1, y + h + 2 + i, x1 - x0 - 1, 1, 0.6 + i * 0.08);
  for (let x = x0; x <= x1; x++) {
    const i = x - x0, pal = Math.floor(i / 6) % 2 ? B : A, yb = y + h + BAGE[i % 6];
    for (let Y = y; Y <= yb; Y++) {
      let v = 0.92 - (Y - y) / (h + 3) * 0.42 - (i / (x1 - x0)) * 0.1;
      if (i % 6 === 0) v -= 0.07;
      if (Y >= y + h) v = Y === yb ? 0.22 : 0.62;
      P.px(x, Y, tone(pal, v, x, Y));
    }
    P.px(x, yb + 1, 0x1e1626, 0.4);
  }
  P.hl(x0 - 1, y - 2, x1 - x0 + 3, JARN[1]); P.hl(x0 - 1, y - 1, x1 - x0 + 3, JARN[3]);
  for (const ax of [x0 - 1, x1 + 1]) { P.vl(ax, y - 2, h + 4, JARN[2]); P.px(ax, y + h + 2, JARN[4]); }
}
// skyltfönster: ram i butiksfärgen, interiören (inne(P, natt) – klippt till glaset) och glaset ovanpå
function skyltfonster(P, x0, y0, x1, y1, R, natt, M, inne) {
  fyll(P, x0 - 2, y0 - 2, x1 + 2, y1 + 2, (X, Y) => (X < x0 || X > x1 || Y < y0 || Y > y1) ? tone(R, X < x0 || Y < y0 ? 0.82 : 0.32, X, Y) : null);
  P.clip(x0, y0, x1 + 1, y1 + 1);
  inne(P, natt);
  if (!natt) {
    P.darken(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0.86);
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const s = (((X - Y * 2) % 41) + 41) % 41; if (s < 4) P.px(X, Y, 0xffffff, s === 1 || s === 2 ? 0.26 : 0.14); else if (Y - y0 < 2) P.px(X, Y, 0xe4eef6, 0.4); }
  } else M.ljus.push([x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
  P.clip();
  P.hl(x0 - 2, y1 + 3, x1 - x0 + 5, R[4]); P.hl(x0 - 2, y1 + 4, x1 - x0 + 5, R[1]);   // bänken
}

// ---------------------------------------------------------------- husen
const HUSBILD = new Map(), META = new Map();
export function husBild(id, natt) {
  const key = `${id}|${natt ? 1 : 0}`;
  if (HUSBILD.has(key)) return HUSBILD.get(key);
  const H = HUS[id], W = H.w + 16, HH = H.h + 44;
  const P = new Pix(W, HH), M = { ljus: [], sken: [] };
  const ox = 8, gy = HH - 4, top = gy - H.h, L = (x) => ox + x;
  const K = { P, H, W, HH, ox, gy, top, L, natt: !!natt, M, dx: L(H.door.x0 - H.x), dw: H.door.x1 - H.door.x0, w: H.w, x1: L(H.w - 1) };
  ({ hem: malaHem, klinik: malaKlinik, hall: malaHall, kafe: malaKafe, trim: malaTrim, bo1: malaBo1, bo2: malaBo2 })[id](K);
  // mörk kontur runt huset (där bilden möter luften)
  const out = new Pix(W, HH), d = P.d, A = (x, y) => x >= 0 && y >= 0 && x < W && y < HH && d[(y * W + x) * 4 + 3] > 180;
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3]) { out.d[i] = d[i]; out.d[i + 1] = d[i + 1]; out.d[i + 2] = d[i + 2]; out.d[i + 3] = d[i + 3]; continue; }
    if (A(x, y - 1) || A(x - 1, y) || A(x + 1, y) || A(x, y + 1)) out.px(x, y, 0x1e1a24);
  }
  const cv = out.flush();
  HUSBILD.set(key, cv); META.set(key, M);
  return cv;
}

// ☕ KATTCAFÉ KURR
function malaKafe(K) {
  const { P, L, gy, top, natt, M, w, x1 } = K;
  // kattansiktet på taket: öronen, huvudet, ögonen (lyser på kvällen), nosen, morrhåren – och KURR i neon
  const hx = L(80), hy = top - 9;
  for (const [ex, dir] of [[hx - 11, -1], [hx + 11, 1]]) for (let j = 0; j < 11; j++) {
    const half = Math.round((11 - j) * 0.5);
    for (let i = -half; i <= half; i++) { const X = ex + i + dir * Math.round(j * 0.2), Y = hy - 7 - j; P.px(X, Y, Math.abs(i) < half - 1 && j < 8 ? tone(ROSP, 0.6 + j * 0.03, X, Y) : tone(GULP, 0.62 - i * dir * 0.05 + (i * dir < 0 ? 0.08 : 0), X, Y)); }
  }
  fyll(P, hx - 19, hy - 14, hx + 19, hy + 14, (X, Y) => { const dx = (X + 0.5 - hx) / 19, dy = (Y + 0.5 - hy) / 14, q = dx * dx + dy * dy; return q > 1 ? null : tone(GULP, 0.74 - dx * 0.26 - dy * 0.3 + (1 - q) * 0.1, X, Y); });
  for (const sx of [-5, 0, 5]) for (let j = 0; j < 4 - Math.abs(sx) / 5; j++) P.px(hx + sx, hy - 13 + j, GULP[0]);
  for (const sx of [-17, 17]) for (const dy of [-3, 0]) P.hl(hx + (sx < 0 ? sx : sx - 2), hy + dy, 3, GULP[1]);
  fyll(P, hx - 9, hy - 1, hx + 9, hy + 12, (X, Y) => { const dx = (X + 0.5 - hx) / 9.5, dy = (Y + 0.5 - (hy + 5)) / 7.5; return dx * dx + dy * dy > 1 ? null : tone(VIT, 0.8 - dy * 0.2, X, Y); });
  for (const ex of [hx - 8, hx + 7]) {
    fyll(P, ex - 2, hy - 7, ex + 2, hy - 3, (X, Y) => ((X === ex - 2 || X === ex + 2) && (Y === hy - 7 || Y === hy - 3)) ? null : natt ? 0xd8ff9a : tone(MINP, 0.5 + (X < ex ? 0.3 : 0), X, Y));
    P.vl(ex, hy - 7, 5, 0x101418); P.px(ex - 1, hy - 6, 0xffffff);
    if (natt) M.sken.push([ex, hy - 5, 7, 0xa8ff6a]);
  }
  P.rect(hx - 1, hy - 1, 3, 2, 0xe86a8a); P.px(hx - 1, hy - 1, 0xff9ab4); P.vl(hx, hy + 1, 1, 0x5a2a30);
  for (const s of [-1, 1]) for (const [dy, sl] of [[0, -0.15], [2, 0.1]]) for (let i = 0; i < 9; i++) P.px(hx + s * (13 + i), hy + dy + Math.round(i * sl), 0xfff6e0);
  // neonskylten KURR i munnen (plattan mörk, rören rosa – tänds på kvällen)
  const kurr = 'KURR', kw = textW(SMALL, kurr), kx = hx - (kw >> 1);
  fyll(P, kx - 3, hy + 3, kx + kw + 1, hy + 10, (X, Y) => ((X === kx - 3 || X === kx + kw + 1) && (Y === hy + 3 || Y === hy + 10)) ? null : tone(JARN, 0.35 + (Y === hy + 3 ? 0.3 : 0), X, Y));
  text(P, SMALL, kurr, kx, hy + 4, natt ? 0xffe0f0 : 0xd0608e);
  if (natt) M.sken.push([hx, hy + 6, 16, 0xff6ab8]);
  // takfoten, väggen (liggande gul panel) och knutbrädorna
  taklist(P, L(0), x1, top);
  const vy0 = top + 6, vy1 = gy - 52;
  liggpanel(P, L(0), vy0, x1, vy1, GULP, 16);
  for (const kx2 of [L(0), x1 - 2]) fyll(P, kx2, vy0, kx2 + 2, vy1, (X, Y) => tone(VIT, X === kx2 ? 0.95 : 0.6, X, Y));
  skugga(P, L(3), x1 - 3, vy0, 3, 0.07);
  // övervåningen: fyra fönster med spetsgardiner, gavelkrön och blomlådor – en katt sover i ett av dem
  const ff = [10, 36, 112, 138];
  ff.forEach((fx, i) => fonster(P, L(fx), top + 13, 12, 14, { natt, tand: hash(fx, 3, 1) > 0.25, M, gardin: [0xd84a6a, 0x5a9a6a][i % 2], spets: true, krona: 'tri', lada: [BLOMMOR.rosa, BLOMMOR.rod, BLOMMOR.lila, BLOMMOR.rod][i], djur: i === 1 ? 'sover' : i === 2 ? 'katt' : null, djurfarg: i === 1 ? 0x8a8a96 : 0x2a2428 }));
  // kattklockan mellan fönstren (svart katt, urtavlan på magen – ögonen och svansen rör sig i husLiv)
  const kcx = L(80), kcy = top + 10;
  spr(P, kcx - 5, kcy, ['.k.......k.', '.kk.....kk.', '.kkkkkkkkk.', 'kkwwwkwwwkk', 'kkwwwkwwwkk', '.kkkkkkkkk.', '.kkwwwwwkk.', '..kkkkkkk..'], { k: 0x22202a, w: 0xf4f1ea });
  fyll(P, kcx - 5, kcy + 8, kcx + 5, kcy + 19, (X, Y) => { const dx = Math.abs(X + 0.5 - kcx) / 5.5; return dx > 1 - Math.max(0, (Y - kcy - 16) * 0.2) ? null : 0x22202a; });
  fyll(P, kcx - 3, kcy + 10, kcx + 3, kcy + 16, (X, Y) => (Math.hypot(X + 0.5 - kcx, Y + 0.5 - (kcy + 13)) < 3.6 ? (Math.hypot(X + 0.5 - kcx, Y + 0.5 - (kcy + 13)) > 2.8 ? MASS[3] : 0xfaf6ea) : null));
  P.vl(kcx, kcy + 11, 2, 0x22202a); P.hl(kcx, kcy + 13, 2, 0x22202a);
  P.px(kcx - 3, kcy + 18, 0xf4f1ea); P.px(kcx + 3, kcy + 18, 0xf4f1ea);
  // listen och skyltbandet (grönt med guldram och guldtext)
  const fy0 = gy - 51, fy1 = gy - 41;
  P.hl(L(-2), fy0 - 1, w + 4, VIT[4]); P.hl(L(-2), fy0, w + 4, VIT[2]);
  fyll(P, L(0), fy0 + 1, x1, fy1, (X, Y) => tone(GRONB, 0.6 - (Y - fy0) * 0.04 + (Y === fy0 + 1 ? 0.25 : 0), X, Y));
  fyll(P, L(3), fy0 + 2, x1 - 3, fy1 - 1, (X, Y) => (X === L(3) || X === x1 - 3 || Y === fy0 + 2 || Y === fy1 - 1) ? tone(MASS, 0.75 - (X - L(3)) / w * 0.4, X, Y) : null);
  const namn = $t('KATTCAFÉ KURR'), F = passa(namn, w - 26), nw = textW(F, namn);
  skylttext(P, F, namn, L(80) - (nw >> 1), fy0 + (F === BIG ? 2 : 3), MASS[3], GRONB[0], MASS[4]);
  tass(P, L(8), fy0 + 5, MASS[3]); tass(P, x1 - 7, fy0 + 5, MASS[3]);
  if (natt) M.sken.push([L(80), fy0 + 5, 44, 0xc89a40]);
  // markisen: grädde och rosa, bågkant
  markis(P, L(-3), x1 + 3, gy - 40, 5, [0xb8ac92, 0xd4c9ae, 0xe9dfc9, 0xf6efe2, 0xfffaf0], ROSP);
  // butiksfasaden: gröna pilastrar med guldkapitäl, sockelpanelen
  for (const [a, b] of [[0, 4], [62, 68], [92, 98], [155, 159]]) {
    fyll(P, L(a), gy - 32, L(b), gy - 1, (X, Y) => tone(GRONB, 0.66 - (X - L(a)) / (b - a + 1) * 0.36 + (X === L(a) ? 0.15 : 0), X, Y));
    P.hl(L(a) - 1, gy - 32, b - a + 3, MASS[3]); P.hl(L(a) - 1, gy - 31, b - a + 3, MASS[1]); P.hl(L(a) - 1, gy - 3, b - a + 3, GRONB[4]);
  }
  for (const [a, b] of [[4, 62], [98, 155]]) {
    fyll(P, L(a), gy - 5, L(b), gy - 1, (X, Y) => tone(GRONB, 0.5 + (Y === gy - 5 ? 0.3 : 0), X, Y));
    for (let X = L(a) + 3; X < L(b) - 6; X += 12) P.box(X, gy - 4, 9, 3, GRONB[1]);
  }
  // vänstra fönstret: kaférummet (tapet, taklampor, tavlor, hyllan, klösträdet med en katt, ett bord med koppar)
  skyltfonster(P, L(6), gy - 30, L(60), gy - 7, GRONB, natt, M, (P, natt) => {
    const X0 = L(6), X1 = L(60), Y0 = gy - 30, Y1 = gy - 7, lj = natt ? 0.08 : 0;
    fyll(P, X0, Y0, X1, Y1, (X, Y) => {
      if (Y > Y1 - 7) return tone(TRA, 0.42 + ((X - X0) % 9 === 0 ? -0.18 : 0) + (Y === Y1 - 6 ? 0.32 : 0) + lj, X, Y);
      const r = ((X - X0) % 6) < 3; let c = tone(PERS, 0.62 + (r ? 0.08 : -0.06) - (Y - Y0) * 0.008 + lj, X, Y);
      if (!r && (X + Y * 3) % 7 === 0) c = mix(c, 0xffffff, 0.45);
      return c;
    });
    tavla(P, X0 + 22, Y0 + 5, 8, 7, 'katt'); tavla(P, X0 + 33, Y0 + 7, 6, 5, 'tass'); tavla(P, X0 + 41, Y0 + 5, 7, 7, 'hund');
    P.hl(X0 + 22, Y0 + 15, 30, TRA[3]); P.hl(X0 + 22, Y0 + 16, 30, TRA[1]);
    for (const [kx2, f] of [[X0 + 24, 0xf06aa0], [X0 + 34, 0xf0c030], [X0 + 46, 0xffffff]]) kruka(P, kx2, Y0 + 14, f);
    for (const lx of [X0 + 16, X0 + 37]) { P.vl(lx, Y0, 3, JARN[1]); P.rect(lx - 2, Y0 + 3, 5, 2, MASS[2]); P.hl(lx - 3, Y0 + 5, 7, MASS[1]); P.px(lx - 2, Y0 + 3, MASS[4]); P.px(lx, Y0 + 6, natt ? 0xfff6c0 : 0xf8e8b0); if (natt) M.sken.push([lx, Y0 + 6, 9, 0xffd890]); }
    // klösträdet: sisalstolpe, två hyllor och en grå katt överst
    for (let Y = Y1 - 15; Y <= Y1; Y++) { P.px(X0 + 6, Y, (Y & 1) ? SAND[2] : SAND[3]); P.px(X0 + 7, Y, (Y & 1) ? SAND[1] : SAND[2]); }
    for (const [py, pw] of [[Y1 - 15, 11], [Y1 - 8, 8]]) { P.hl(X0 + 7 - (pw >> 1), py, pw, ROSP[3]); P.hl(X0 + 7 - (pw >> 1), py + 1, pw, ROSP[1]); }
    P.hl(X0 + 1, Y1, 12, ROSP[1]);
    spr(P, X0 + 3, Y1 - 24, KATT_SITT, { a: 0x9a98a4, b: 0xe8e6ee, e: 0x3a7a3a, n: 0xe86a8a, t: 0x7a7884 });
    // bordet med två koppar och thonetstolarna
    const bx = X0 + 40;
    P.hl(bx - 5, Y1 - 6, 11, VIT[4]); P.hl(bx - 5, Y1 - 5, 11, VIT[2]); P.vl(bx, Y1 - 4, 4, JARN[2]); P.hl(bx - 2, Y1, 5, JARN[2]);
    for (const cx of [bx - 3, bx + 2]) { P.rect(cx, Y1 - 8, 2, 2, 0xffffff); P.px(cx + 2, Y1 - 7, 0xd8d4ca); }
    for (const s of [-1, 1]) { const cx = bx + s * 9; P.vl(cx + s * 2, Y1 - 10, 10, TRA[1]); P.hl(cx - 2, Y1 - 4, 5, TRA[2]); P.vl(cx - 2 * s, Y1 - 4, 4, TRA[1]); }
  });
  // högra fönstret: disken (kakel, griffeltavlan, muggarna, bakelsedisken, espressomaskinen)
  skyltfonster(P, L(100), gy - 30, L(154), gy - 7, GRONB, natt, M, (P, natt) => {
    const X0 = L(100), X1 = L(154), Y0 = gy - 30, Y1 = gy - 7, lj = natt ? 0.08 : 0;
    fyll(P, X0, Y0, X1, Y1, (X, Y) => { const rad = Math.floor((Y - Y0) / 3), f = (Y - Y0) % 3 === 2 || ((X - X0 + (rad & 1) * 3) % 6) === 5; return tone(KAKEL, (f ? 0.42 : 0.72) + lj, X, Y); });
    // griffeltavlan
    fyll(P, X0 + 3, Y0 + 2, X0 + 22, Y0 + 12, (X, Y) => (X === X0 + 3 || X === X0 + 22 || Y === Y0 + 2 || Y === Y0 + 12) ? TRA[2] : tone(JARN, 0.3, X, Y));
    for (const [ry, rw] of [[Y0 + 4, 10], [Y0 + 6, 13], [Y0 + 8, 9], [Y0 + 10, 12]]) { P.hl(X0 + 5, ry, rw, 0xe8e4dc); P.px(X0 + 20, ry, 0xf0c030); }
    P.px(X0 + 17, Y0 + 4, 0xf06aa0); P.px(X0 + 19, Y0 + 4, 0xf06aa0); P.hl(X0 + 17, Y0 + 5, 3, 0xf06aa0);
    // hyllan med muggar i alla färger
    P.hl(X0 + 26, Y0 + 7, 27, TRA[3]); P.hl(X0 + 26, Y0 + 8, 27, TRA[1]);
    [0xd84a6a, 0xf0c030, 0x3a7bd5, 0x46a35a, 0xffffff, 0xf08a2a, 0x8a5ad0].forEach((c, i) => { P.rect(X0 + 27 + i * 4, Y0 + 4, 3, 3, c); P.px(X0 + 27 + i * 4, Y0 + 4, mix(c, 0xffffff, 0.4)); P.px(X0 + 30 + i * 4, Y0 + 5, mul(c, 0.7)); });
    // disken: bänkskivan och träfronten med speglar
    const dy0 = Y1 - 8;
    P.hl(X0, dy0, X1 - X0 + 1, TRA[4]); P.hl(X0, dy0 + 1, X1 - X0 + 1, TRA[2]);
    fyll(P, X0, dy0 + 2, X1, Y1, (X, Y) => tone(GRONB, 0.6 - ((X - X0) % 10 === 0 ? 0.25 : 0) + ((X - X0) % 10 === 1 ? 0.2 : 0) + lj, X, Y));
    // bakelsedisken (glasmonter) med prinsesstårta, chokladbollar, kanelbullar och jordgubbstårta
    const mx0 = X0 + 3, mx1 = X0 + 24, my0 = dy0 - 9;
    fyll(P, mx0, my0, mx1, dy0 - 1, (X, Y) => (X === mx0 || X === mx1 || Y === my0) ? 0xd8e8f0 : null);
    P.hl(mx0 + 1, dy0 - 4, mx1 - mx0 - 1, 0xc8d4dc);
    spr(P, mx0 + 2, dy0 - 9, ['.ggg.', 'ggggg', 'gwwwg'], { g: 0x8ad89a, w: 0xfff6e8 }); P.px(mx0 + 4, dy0 - 10, 0xf06aa0);
    for (let i = 0; i < 3; i++) { P.rect(mx0 + 9 + i * 3, dy0 - 7, 2, 2, 0x5a3420); P.px(mx0 + 9 + i * 3, dy0 - 7, 0x8a5a3a); P.px(mx0 + 10 + i * 3, dy0 - 6, 0xf4f1ea); }
    for (let i = 0; i < 3; i++) { P.rect(mx0 + 2 + i * 4, dy0 - 3, 3, 2, 0xc88a44); P.px(mx0 + 3 + i * 4, dy0 - 3, 0xf0d8a0); }
    spr(P, mx0 + 15, dy0 - 3, ['rrrr', 'wwww'], { r: 0xe8384a, w: 0xfff2e0 });
    for (let Y = my0 + 1; Y < dy0 - 1; Y++) P.px(mx0 + 1 + ((Y - my0) % 3), Y, 0xffffff, 0.5);
    // espressomaskinen i krom med koppar på toppen och en kaffekopp under
    const ex = X0 + 28;
    fyll(P, ex, dy0 - 10, ex + 13, dy0 - 1, (X, Y) => tone(ZINK, 0.85 - (X - ex) / 13 * 0.5 + (Y === dy0 - 10 ? 0.15 : 0), X, Y));
    P.hl(ex + 1, dy0 - 11, 12, 0xffffff); P.rect(ex + 2, dy0 - 13, 3, 2, 0xd84a6a); P.rect(ex + 6, dy0 - 13, 3, 2, 0xffffff); P.rect(ex + 10, dy0 - 13, 2, 2, 0x3a7bd5);
    P.rect(ex + 3, dy0 - 7, 3, 2, JARN[2]); P.rect(ex + 8, dy0 - 7, 3, 2, JARN[2]); P.px(ex + 4, dy0 - 5, 0x3a2414); P.px(ex + 9, dy0 - 5, 0x3a2414);
    P.rect(ex + 3, dy0 - 3, 3, 2, 0xffffff); P.rect(ex + 8, dy0 - 3, 3, 2, 0xffffff);
    P.px(ex + 1, dy0 - 8, RODT[3]); P.px(ex + 12, dy0 - 8, MINP[3]);
    // kassaapparaten och en blomvas
    P.rect(X0 + 45, dy0 - 5, 7, 5, JARN[2]); P.hl(X0 + 45, dy0 - 5, 7, JARN[4]); P.rect(X0 + 46, dy0 - 8, 5, 3, 0x3a7a5a); P.px(X0 + 47, dy0 - 7, 0x9af0b0);
  });
  // dörren: grön med glas och en kattdekal, "ÖPPET"-skylten och vägglyktorna på pilastrarna
  dorr(P, K.dx, gy - 30, K.dw, 29, { pal: GRONB, ram: GRONB, natt, glas: 0.62, dekal: (P, gx0, gy0, gx1) => { const cx = (gx0 + gx1) >> 1; spr(P, cx - 3, gy0 + 3, ['k...k', 'kkkkk', 'kwkwk', 'kkkkk', '.kkk.'], { k: MASS[3], w: null }); fyll(P, cx - 5, gy0 + 10, cx + 4, gy0 + 14, (X, Y) => (Y === gy0 + 10 || Y === gy0 + 14 || X === cx - 5 || X === cx + 4) ? 0xd8343c : (Y === gy0 + 12 && X > cx - 4 && X < cx + 3) ? 0xd8343c : 0xfaf6ea); P.px(cx - 3, gy0 + 9, JARN[2]); P.px(cx + 2, gy0 + 9, JARN[2]); } });
  for (const lx of [L(65), L(95)]) vagglykta(P, lx, gy - 18, natt, M, MASS);
  sockel(P, L(0), x1, gy - 1, gy, 3);
}

// 🐾 TASSARNAS HEM – falurött med vita knutar, frontespis med oxöga, farstukvist och anslagstavlan
function malaHem(K) {
  const { P, L, gy, top, natt, M, w, x1, dx, dw } = K;
  const vy0 = top + 14, mid = L(107);
  // taket: skiffer, två skorstenar, takränna; frontespisen över dörren
  const rise = 26;
  for (let j = 0; j < rise; j++) {
    const ins = Math.round(j * (w / 2 + 4) / rise), X0 = L(-4) + ins, ww = w + 8 - ins * 2;
    for (let i = 0; i < ww; i++) { const X = X0 + i, Y = vy0 - 1 - j, r = j % 3, rx = (X + (Math.floor(j / 3) & 1) * 3) % 6; let v = 0.55 - j / rise * 0.1 + (rx === 0 ? -0.18 : rx === 1 ? 0.12 : 0) + (r === 2 ? -0.16 : 0) + (hash(X >> 1, j, 7) - 0.5) * 0.08; P.px(X, Y, tone(SKIF, v, X, Y)); }
  }
  P.hl(L(w / 2 - 4 - 1) - 0, vy0 - rise - 1, 10, SKIF[4]);
  for (const sx of [L(36), L(166)]) { fyll(P, sx, vy0 - rise - 6, sx + 7, vy0 - 14, (X, Y) => WALLS.brick(X, Y, 0x9a4a32, 5)); P.rect(sx - 1, vy0 - rise - 8, 10, 2, STEN[3]); P.hl(sx - 1, vy0 - rise - 8, 10, STEN[4]); }
  P.hl(L(-4), vy0, w + 8, ZINK[3]); P.hl(L(-4), vy0 + 1, w + 8, ZINK[1]);
  // frontespisen: gavelvägg med vindskivor, snickarglädje och oxöga med en tass
  const fw = 34, peak = vy0 - 24;
  for (let Y = peak; Y < vy0; Y++) { const half = Math.round((Y - peak) / (vy0 - peak) * fw); for (let X = mid - half; X <= mid + half; X++) P.px(X, Y, tone(FALU, 0.6 + ((((X - mid + 70) % 7) === 5) ? 0.22 : 0) - (Y - peak) * 0.004, X, Y)); }
  for (let Y = peak - 2; Y < vy0 + 2; Y++) { const half = Math.round((Y - peak + 2) / (vy0 - peak + 2) * (fw + 3)); for (const s of [-1, 1]) { P.px(mid + s * half, Y, VIT[4]); P.px(mid + s * (half - 1), Y, VIT[2]); P.px(mid + s * (half + 1), Y, SKIF[1]); } }
  for (let Y = peak + 3; Y < vy0 - 1; Y += 3) { const half = Math.round((Y - peak) / (vy0 - peak) * fw) - 2; for (const s of [-1, 1]) P.px(mid + s * half, Y, VIT[3]); }
  P.vl(mid, peak - 6, 5, VIT[3]); P.px(mid, peak - 7, MASS[3]);
  fyll(P, mid - 6, peak + 8, mid + 6, peak + 20, (X, Y) => { const d = Math.hypot(X + 0.5 - mid, Y + 0.5 - (peak + 14)); return d > 6.5 ? null : d > 5 ? tone(VIT, X < mid ? 0.95 : 0.55, X, Y) : natt ? tone(GLN, 0.8, X, Y) : tone(GLD, 0.75 - (Y - peak - 8) * 0.04, X, Y); });
  tass(P, mid, peak + 14, natt ? 0x8a4a1a : 0xf4f1ea);
  if (natt) M.sken.push([mid, peak + 14, 10, 0xffd890]);
  // fasaden: stående lockpanel, knutar, mellanlist, sockel och stuprör
  lockpanel(P, L(0), vy0 + 2, x1, gy - 7, FALU, 11);
  skugga(P, L(0), x1, vy0 + 2, 3, 0.08);
  for (const kx of [L(0), x1 - 3]) fyll(P, kx, vy0 + 2, kx + 3, gy - 7, (X, Y) => tone(VIT, X === kx ? 0.95 : X === kx + 3 ? 0.45 : 0.72, X, Y));
  P.hl(L(0), gy - 41, w, VIT[4]); P.hl(L(0), gy - 40, w, VIT[2]); P.hl(L(0), gy - 39, w, 0x000000, 0.2);
  sockel(P, L(0), x1, gy - 6, gy, 21);
  stupror(P, L(0), vy0 + 2, gy - 8); stupror(P, x1 - 3, vy0 + 2, gy - 8);
  // skylten TASSARNAS HEM (vit med röd text) mellan övervåningens fönster
  brade(P, mid, vy0 + 6, $t('TASSARNAS HEM'), VIT, 0xa8382a, 96, { kant: 0x5a1410, ljus: 0xe86a5a, ram: VIT });
  // fönstren: övervåningen med krön, nedervåningen med blomlådor – djur som tittar ut
  const fo = (fx, fy, o) => fonster(P, L(fx), fy, 12, 15, { natt, tand: hash(fx, fy, 2) > 0.3, M, ram: VIT, sp: [2, 3], ...o });
  fo(14, vy0 + 6, { krona: 'snick', gardin: 0xf4c8d0, djur: 'katt', djurfarg: 0x3a3438 }); fo(38, vy0 + 6, { krona: 'snick', gardin: 0xf8e4a0 });
  fo(160, vy0 + 6, { krona: 'snick', gardin: 0xf8e4a0, djur: 'sover', djurfarg: 0xe08a3a }); fo(184, vy0 + 6, { krona: 'snick', gardin: 0xf4c8d0 });
  [[12, BLOMMOR.rod, null], [34, BLOMMOR.gul, 'hund'], [56, BLOMMOR.rod, null], [146, BLOMMOR.rod, null], [168, BLOMMOR.gul, 'katt'], [190, BLOMMOR.rod, null]].forEach(([fx, b, dj]) => fo(fx, gy - 32, { krona: 'rak', lada: b, gardin: 0xb8e0d0, djur: dj, djurfarg: dj === 'hund' ? 0xc89a5a : 0xf4f1ea }));
  // anslagstavlan: djuren som söker hem (polaroider) under rubriken
  const ax = L(72), ay = gy - 31;
  fyll(P, ax, ay, ax + 15, ay + 15, (X, Y) => (X === ax || X === ax + 15 || Y === ay || Y === ay + 15) ? TRA[1] : tone(SAND, 0.6 + (hash(X, Y, 4) - 0.5) * 0.2, X, Y));
  [[1, 2, 0xe08a3a], [8, 1, 0x8a5a30], [2, 8, 0x3a3438], [9, 8, 0xf4f1ea]].forEach(([i, j, c]) => { const px = ax + i + 1, py = ay + j + 1; P.rect(px, py, 5, 6, 0xfaf8f2); P.rect(px + 1, py + 1, 3, 3, c); P.px(px + 1, py + 1, mul(c, 0.7)); P.px(px + 3, py + 1, mul(c, 0.7)); P.px(px + 2, py, 0xd8343c); });
  // farstukvisten: ett litet sadeltak på två vita stolpar med konsoler, ett hjärta på gaveln
  const kv0 = L(88), kv1 = L(126), kvy = gy - 38;
  for (let j = 0; j < 7; j++) { const ins = Math.round(j * 2.6); P.hl(kv0 - 2 + ins, kvy - j, kv1 - kv0 + 5 - ins * 2, tone(SKIF, 0.62 - j * 0.04, kv0, kvy - j)); }
  for (let j = 0; j < 6; j++) { const half = Math.round((6 - j) * 2.6); P.hl(mid - half, kvy - j, half * 2 + 1, j === 0 ? VIT[1] : tone(FALU, 0.62, mid, kvy - j)); }
  spr(P, mid - 2, kvy - 5, ['.r.r.', 'rrrrr', '.rrr.', '..r..'], { r: 0xf06a8a });
  P.hl(kv0 - 2, kvy + 1, kv1 - kv0 + 5, VIT[4]); P.hl(kv0 - 2, kvy + 2, kv1 - kv0 + 5, VIT[1]);
  for (const sx of [kv0, kv1 - 2]) { fyll(P, sx, kvy + 3, sx + 2, gy - 2, (X, Y) => tone(VIT, X === sx ? 0.95 : 0.55, X, Y)); P.px(sx + (sx === kv0 ? 3 : -1), kvy + 3, VIT[3]); P.px(sx + (sx === kv0 ? 4 : -2), kvy + 3, VIT[3]); P.px(sx + (sx === kv0 ? 3 : -1), kvy + 4, VIT[2]); }
  skugga(P, kv0 + 3, kv1 - 3, kvy + 3, 3, 0.1);
  dorr(P, dx, gy - 28, dw, 26, { pal: [0x14301e, 0x1e4a2e, 0x2a6a42, 0x3a8a56, 0x5aaa72], ram: VIT, natt, glas: 0.45, brev: true, dekal: (P, gx0, gy0) => { if (!natt) spr(P, gx0, gy0 + 1, HUND_TITT.slice(0, 4), { o: 0x6a4020, a: 0xc89a5a, e: 0x1a1414, n: 0x1a1414, r: 0xf07a9a }); } });
  for (const lx of [L(92), L(121)]) vagglykta(P, lx, gy - 18, natt, M);
  // vattenskålen och en hundkorg vid trappan
  P.rect(L(128), gy - 3, 5, 2, 0x3a7bd5); P.hl(L(128), gy - 3, 5, 0x9ad8f8);
}

// ⚕️ DJURKLINIKEN – vit puts, ljuslådan med korset, EKG-bandet, väntrummet och receptionen
function malaKlinik(K) {
  const { P, L, gy, top, natt, M, w, x1, dx, dw } = K;
  // taket: plåtavtäckt bröstning, ett aggregat och en ventil bakom
  fyll(P, L(18), top - 8, L(40), top, (X, Y) => tone(ZINK, 0.7 - (X - L(18)) / 22 * 0.4 + (Y === top - 8 ? 0.2 : 0), X, Y));
  for (let X = L(21); X < L(37); X += 2) P.vl(X, top - 6, 5, ZINK[1]);
  fyll(P, L(116), top - 11, L(120), top, (X, Y) => tone(ZINK, X === L(116) ? 0.9 : 0.45, X, Y)); P.rect(L(114), top - 13, 9, 2, ZINK[2]);
  fyll(P, L(-2), top, x1 + 2, top + 3, (X, Y) => tone(ZINK, Y === top ? 0.95 : 0.55 - (Y - top) * 0.1, X, Y));
  puts(P, L(0), top + 4, x1, gy - 8, PUTS, 12);
  skugga(P, L(0), x1, top + 4, 3, 0.08);
  sockel(P, L(0), x1, gy - 6, gy, 31, [0x46484e, 0x5e6068, 0x7a7c84, 0x9a9ca4, 0xbabcc2]);
  // övervåningen: moderna fönster med persienner
  [10, 34, 104, 128].forEach((fx, i) => fonster(P, L(fx), top + 12, 14, 17, { natt, tand: hash(fx, 7, 3) > 0.3, M, ram: [0x2a2e36, 0x3c424c, 0x545c68, 0x6e7884, 0x8e98a4], sp: [1, 1], persienn: [0.4, 0.65, 0.3, 0.55][i] }));
  // ljuslådan med korset (djup åt höger, vit tass) – lyser på kvällen
  const kx = L(75), ky = top + 18;
  const kors = (X, Y) => (Math.abs(X - kx) <= 3 && Math.abs(Y - ky) <= 10) || (Math.abs(X - kx) <= 10 && Math.abs(Y - ky) <= 3);
  for (let Y = ky - 11; Y <= ky + 11; Y++) for (let X = kx - 11; X <= kx + 12; X++) if (!kors(X, Y) && kors(X - 1, Y + 1)) P.px(X, Y, 0x1a5a34);
  for (let Y = ky - 10; Y <= ky + 10; Y++) for (let X = kx - 10; X <= kx + 10; X++) if (kors(X, Y)) P.px(X, Y, natt ? tone([0x2ac86a, 0x4ae08a, 0x7af0aa, 0xb0ffd0, 0xe0fff0], 0.6 - (Math.abs(X - kx) + Math.abs(Y - ky)) * 0.02, X, Y) : tone([0x14603a, 0x1e7e4a, 0x2a9a5a, 0x4ab878, 0x80d8a0], 0.62 - (X - kx) * 0.02 - (Y - ky) * 0.02 + (X === kx - 10 || Y === ky - 10 ? 0.2 : 0), X, Y));
  tass(P, kx, ky, 0xffffff);
  if (natt) M.sken.push([kx, ky, 26, 0x40ff90]);
  // det blå bandet med DJURKLINIK och EKG-linjen
  const by0 = gy - 45, by1 = gy - 36;
  fyll(P, L(0), by0, x1, by1, (X, Y) => tone(BLA, 0.62 - (Y - by0) * 0.05 + (Y === by0 ? 0.3 : 0) + ((((X - Y * 2) % 29) + 29) % 29 < 2 ? 0.12 : 0), X, Y));
  P.hl(L(0), by1 + 1, w, 0x000000, 0.25);
  const namn = $t('DJURKLINIK'), F = passa(namn, 80), nw = textW(F, namn), nx = L(75) - (nw >> 1);
  skylttext(P, F, namn, nx, by0 + (F === BIG ? 1 : 2), 0xffffff, BLA[0], null);
  const EKG = [0, 0, 0, -1, 0, 0, 2, -4, 3, 0, 0, -1, 0, 0];
  for (const [a, b] of [[L(4), nx - 4], [nx + nw + 4, x1 - 4]]) { let X = a, i = 0; while (X <= b) { P.px(X, by0 + 5 + EKG[i % EKG.length], 0xffffff); X++; i++; } }
  // väntrummet (vänster): stolar, en hund och husse, affischerna, en monstera
  skyltfonster(P, L(8), gy - 29, L(56), gy - 8, [0x2a2e36, 0x3c424c, 0x545c68, 0x6e7884, 0x8e98a4], natt, M, (P, natt) => {
    const X0 = L(8), X1 = L(56), Y0 = gy - 29, Y1 = gy - 8, lj = natt ? 0.06 : 0;
    fyll(P, X0, Y0, X1, Y1, (X, Y) => Y > Y1 - 4 ? tone(KAKEL, 0.5 + ((X + Y) % 4 === 0 ? -0.1 : 0), X, Y) : tone(MINP, 0.66 + lj - (Y - Y0) * 0.005, X, Y));
    fyll(P, X0 + 3, Y0 + 3, X0 + 12, Y0 + 13, (X, Y) => (X === X0 + 3 || X === X0 + 12 || Y === Y0 + 3 || Y === Y0 + 13) ? 0xffffff : tone(BLA, 0.7, X, Y));
    P.hl(X0 + 5, Y0 + 8, 5, 0xffffff); P.vl(X0 + 7, Y0 + 6, 5, 0xffffff); P.px(X0 + 10, Y0 + 8, 0xd8343c);
    fyll(P, X0 + 16, Y0 + 3, X0 + 24, Y0 + 13, (X, Y) => (X === X0 + 16 || X === X0 + 24 || Y === Y0 + 3 || Y === Y0 + 13) ? 0xffffff : tone(ROSP, 0.75, X, Y));
    spr(P, X0 + 18, Y0 + 6, ['wwwww', 'wwwww', '.w.w.'], { w: 0xffffff });
    for (let i = 0; i < 4; i++) { const sx = X0 + 4 + i * 6; P.rect(sx, Y1 - 9, 5, 2, 0x3a7bd5); P.rect(sx, Y1 - 13, 1, 4, 0x2a5aa8); P.hl(sx, Y1 - 7, 5, JARN[2]); P.vl(sx + 1, Y1 - 6, 3, JARN[2]); P.vl(sx + 4, Y1 - 6, 3, JARN[2]); }
    spr(P, X0 + 5, Y1 - 6, ['oo...', 'oaao.', '.aea.', 'aaaaa', 'aa.aa'], { o: 0x6a4020, a: 0xc89a5a, e: 0x1a1414 });
    for (let j = 0; j < 14; j++) { const by = Y1 - 3 - j; for (const s of [-1, 1]) if (j > 3 && (j % 3) === 0) { P.px(X1 - 6 + s * (2 + (j % 5)), by, tone(BLAD, 0.6, X1, by)); P.px(X1 - 6 + s * (3 + (j % 5)), by + 1, tone(BLAD, 0.4, X1, by)); } P.px(X1 - 6, by, tone(BLAD, 0.35, X1, by)); }
    P.rect(X1 - 8, Y1 - 3, 5, 3, 0xf4f1ea);
  });
  // receptionen (höger): disken med datorn, ett djurbur-skåp och en våg
  skyltfonster(P, L(98), gy - 29, L(144), gy - 8, [0x2a2e36, 0x3c424c, 0x545c68, 0x6e7884, 0x8e98a4], natt, M, (P, natt) => {
    const X0 = L(98), X1 = L(144), Y0 = gy - 29, Y1 = gy - 8, lj = natt ? 0.06 : 0;
    fyll(P, X0, Y0, X1, Y1, (X, Y) => tone(PUTS, 0.6 + lj - (Y - Y0) * 0.006, X, Y));
    for (let i = 0; i < 3; i++) { const sx = X0 + 2 + i * 8; P.box(sx, Y0 + 3, 7, 6, ZINK[2]); P.rect(sx + 1, Y0 + 4, 5, 4, ZINK[0]); P.vl(sx + 2, Y0 + 4, 4, ZINK[3]); P.vl(sx + 4, Y0 + 4, 4, ZINK[3]); }
    spr(P, X0 + 11, Y0 + 5, ['a.a', 'aaa'], { a: 0xf4f1ea });
    const dy0 = Y1 - 8;
    fyll(P, X0, dy0, X1, Y1, (X, Y) => Y === dy0 ? 0xffffff : tone(BLA, 0.55 + ((X - X0) % 12 === 0 ? -0.2 : 0) + lj, X, Y));
    P.hl(X0 + 3, dy0 + 3, 24, 0xffffff, 0.6);
    fyll(P, X0 + 28, dy0 - 7, X0 + 37, dy0 - 2, (X, Y) => (X === X0 + 28 || X === X0 + 37 || Y === dy0 - 7 || Y === dy0 - 2) ? JARN[2] : natt ? 0x8ad8ff : 0x5aa0d8);
    P.vl(X0 + 32, dy0 - 1, 1, JARN[2]); P.hl(X0 + 30, dy0 - 1, 5, JARN[3]);
    kruka(P, X0 + 40, dy0, 0xf06aa0);
  });
  // entrén: skjutdörrar i glas, skärmtaket med spotlights, öppettiderna och en dörrmatta
  const ey = gy - 30;
  fyll(P, dx - 2, ey - 2, dx + dw + 1, gy - 1, (X, Y) => (X < dx || X >= dx + dw || Y < ey) ? tone(ZINK, X < dx ? 0.9 : 0.45, X, Y) : null);
  fyll(P, dx, ey, dx + dw - 1, gy - 2, (X, Y) => natt ? tone(GLN, 0.85 - (Y - ey) * 0.012, X, Y) : tone(GLD, 0.72 - (Y - ey) * 0.012 + ((((X * 2 - Y * 3) % 19) + 19) % 19 < 2 ? 0.24 : 0), X, Y));
  P.vl(dx + (dw >> 1) - 1, ey, gy - ey - 1, ZINK[1]); P.vl(dx + (dw >> 1), ey, gy - ey - 1, ZINK[3]);
  for (const s of [dx + 3, dx + dw - 6]) P.rect(s, ey + 12, 3, 1, ZINK[1]);
  const kcx = dx + (dw >> 1);
  P.rect(kcx - 4, ey + 4, 3, 1, 0x2a9a5a); P.rect(kcx + 2, ey + 4, 3, 1, 0x2a9a5a); P.rect(kcx - 3, ey + 3, 1, 3, 0x2a9a5a); P.rect(kcx + 3, ey + 3, 1, 3, 0x2a9a5a);
  if (natt) M.ljus.push([dx, ey, dw, gy - ey - 1]);
  const sy = ey - 5;
  fyll(P, dx - 6, sy, dx + dw + 5, sy + 2, (X, Y) => Y === sy ? ZINK[4] : Y === sy + 2 ? ZINK[0] : tone(ZINK, 0.62 - (X - dx) / dw * 0.1, X, Y));
  for (const s of [dx + 4, dx + dw - 5]) { P.px(s, sy + 3, natt ? 0xfff8d0 : 0xe8eef2); if (natt) M.sken.push([s, sy + 5, 10, 0xfff0c0]); }
  P.rect(dx - 2, gy - 1, dw + 4, 1, 0x3a3a46);
  stupror(P, x1 - 5, top + 4, gy - 8);
}

// 🏛️ UTSTÄLLNINGSHALLEN – tegel, kopparvalv med takryttare, sandstensdetaljer, vepor och en biografmarkis
const HALL_FONSTER = [14, 50, 86, 204, 240, 276];
const HALL_VEPOR = [[39, RODT, 'katt'], [75, BLA, 'hund'], [229, [0x163e1c, 0x22602a, 0x34883c, 0x58b45a, 0x9ce08c], 'kanin'], [265, [0x845408, 0xc08c10, 0xeebc20, 0xffde5c, 0xfff6b4], 'rosett']];
function malaHall(K) {
  const { P, L, gy, top, natt, M, w, x1, dx, dw } = K;
  const cy = top + 20, half = w / 2 + 3, mid = L(w / 2);
  // takryttaren: en liten åttkantig lanternin med fönster, kupol och en tass på spiran
  const ty1 = cy - 28, ty0 = ty1 - 12;
  fyll(P, mid - 9, ty0, mid + 9, ty1, (X, Y) => (X - mid + 9) % 6 === 0 ? tone(VIT, 0.7, X, Y) : natt ? tone(GLN, 0.75, X, Y) : tone(GLD, 0.7 - (Y - ty0) * 0.03, X, Y));
  P.hl(mid - 10, ty1, 21, SAND[3]); P.hl(mid - 10, ty0 - 1, 21, SAND[4]);
  for (let j = 0; j < 8; j++) { const hw = Math.round(Math.sqrt(1 - (j / 8) ** 2) * 10); P.hl(mid - hw, ty0 - 2 - j, hw * 2 + 1, tone(KOPP, 0.7 - j * 0.03, mid, ty0 - j)); P.px(mid - hw + 1, ty0 - 2 - j, KOPP[4]); }
  P.vl(mid, ty0 - 16, 6, MASS[2]); tass(P, mid, ty0 - 18, MASS[3]);
  if (natt) M.sken.push([mid, ty0 + 6, 14, 0xffd890]);
  // kopparvalvet med falsar (ärgad koppar, ljusare till vänster)
  for (let j = 0; j < 30; j++) {
    const hw = Math.round(Math.sqrt(Math.max(0, 1 - (j / 30) ** 2)) * half);
    for (let i = -hw; i <= hw; i++) { const X = mid + i, Y = cy - j, fals = ((i + 400) % 8) === 0; let v = 0.62 - i / half * 0.22 + j / 30 * 0.1 + (hash(X >> 2, Y >> 1, 14) - 0.5) * 0.14; if (fals) v += 0.22; else if (((i + 400) % 8) === 1) v -= 0.14; P.px(X, Y, tone(KOPP, v, X, Y)); }
  }
  // fasaden: tegel med sandstenslisen, sockel, pilastrar och taklist
  tegel(P, L(0), cy + 1, x1, gy - 10, 0xb46646, 13);
  sockel(P, L(0), x1, gy - 9, gy, 41, SAND);
  for (const [a, b] of [[0, 5], [w - 6, w - 1]]) fyll(P, L(a), cy + 1, L(b), gy - 10, (X, Y) => { const ry = (Y - cy) % 8; return tone(SAND, (ry === 7 ? 0.3 : 0.66) - (X - L(a)) * 0.05 + (ry === 0 ? 0.15 : 0), X, Y); });
  taklist(P, L(0), x1, cy + 1, SAND);
  // skylten: guldbokstäver på mörkblått, uppställd på taket framför kopparvalvet (stöttorna syns under)
  const sk = brade(P, mid, cy - 17, $t('UTSTÄLLNINGSHALLEN'), [0x0c1a34, 0x142a50, 0x1e3a68, 0x2a4e86, 0x3e66a8], 0xf8d860, 200, { kant: 0x0a1020, ljus: 0xfff4c0 });
  for (const sx of [sk[0] + 8, sk[0] + sk[2] - 9]) { P.vl(sx, sk[1] + sk[3], cy - sk[1] - sk[3] + 1, JARN[2]); P.px(sx + 1, sk[1] + sk[3], JARN[3]); }
  if (natt) M.sken.push([mid, sk[1] + (sk[3] >> 1), 40, 0xffd890]);
  // de höga välvda fönstren med sandstensomfattning och slutsten
  const fy0 = gy - 58, fh = 36;
  for (const fx of HALL_FONSTER) {
    const X = L(fx);
    fyll(P, X - 3, fy0 - 13, X + 22, fy0 + fh + 2, (XX, Y) => { if (Y < fy0) { const d = Math.hypot(XX + 0.5 - (X + 10), Y + 0.5 - fy0); return d > 13 || d < 10 ? null : tone(SAND, 0.75 - (XX - X) * 0.015 - (d > 12 ? 0.15 : 0), XX, Y); } return XX < X - 1 || XX > X + 20 ? tone(SAND, XX < X ? 0.8 : 0.45, XX, Y) : null; });
    fyll(P, X + 8, fy0 - 14, X + 12, fy0 - 9, (XX, Y) => tone(SAND, 0.85 - (XX - X - 8) * 0.1, XX, Y));
    fonster(P, X, fy0, 20, fh, { natt, tand: true, M, ram: VIT, sp: [3, 4], bage: true });
  }
  // veporna mellan fönstren: röd (katt), blå (hund), grön (kanin), gul (rosett) – med svalstjärt
  for (const [vx, pal, motiv] of HALL_VEPOR) {
    const X0 = L(vx), Y0 = fy0 - 2, Y1 = fy0 + 28;
    P.hl(X0 - 2, Y0 - 1, 14, MASS[2]); P.px(X0 - 2, Y0 - 1, MASS[4]); P.px(X0 + 11, Y0 - 1, MASS[4]);
    fyll(P, X0, Y0, X0 + 9, Y1, (X, Y) => { const sv = Y > Y1 - 4 && Math.abs(X + 0.5 - (X0 + 5)) < Y - (Y1 - 4) + 0.5; return sv ? null : tone(pal, 0.68 - (X - X0) * 0.03 + (X === X0 ? 0.15 : 0) - (Y - Y0) * 0.004 + (X === X0 + 2 || X === X0 + 7 ? -0.08 : 0), X, Y); });
    P.hl(X0 + 1, Y0 + 3, 8, MASS[3]); P.hl(X0 + 1, Y1 - 6, 8, MASS[3]);
    const mx = X0 + 2, my = Y0 + 9, vit = { w: 0xffffff, d: mul(pal[0], 0.8) };
    if (motiv === 'katt') spr(P, mx, my, ['w...w', 'ww.ww', 'wwwww', 'wdwdw', 'wwwww', '.www.'], vit);
    else if (motiv === 'hund') spr(P, mx, my, ['ww.ww', 'wwwww', 'wdwdw', '.www.', '.wdw.', '..w..'], vit);
    else if (motiv === 'kanin') spr(P, mx, my - 2, ['w...w', 'w...w', 'w...w', 'wwwww', 'wdwdw', 'wwwww', '.www.'], vit);
    else spr(P, mx, my, ['.www.', 'wwdww', 'wdddw', 'wwdww', '.www.', 'w...w', 'w...w'], { w: 0xffffff, d: 0xd8343c });
  }
  // portalen: sandstensomfattning med kolonner, solfjäderöverljus, pardörrar – och biografmarkisen med glödlampor
  const px0 = dx - 9, px1 = dx + dw + 8;
  fyll(P, px0, gy - 56, px1, gy - 10, (X, Y) => { const kol = X < dx - 3 || X > dx + dw + 2 || Y < gy - 50; return kol ? tone(SAND, 0.75 - ((X - px0) % 7) * 0.05 + ((Y - gy) % 6 === 0 ? -0.1 : 0) + (Y === gy - 56 ? 0.2 : 0), X, Y) : null; });
  for (const kx of [px0 + 2, px1 - 4]) { P.hl(kx - 2, gy - 44, 7, SAND[4]); P.hl(kx - 2, gy - 43, 7, SAND[1]); P.hl(kx - 2, gy - 11, 7, SAND[4]); }
  dorr(P, dx, gy - 32, dw, 31, { pal: [0x14223a, 0x1e3456, 0x2a4a78, 0x3e64a0, 0x5a86c4], ram: SAND, natt, glas: 0.55, overljus: 'bage', spark: true });
  const my = gy - 51;
  fyll(P, px0 - 3, my, px1 + 3, my + 6, (X, Y) => Y === my ? MASS[4] : Y === my + 6 ? MASS[0] : tone(RODT, 0.6 - (Y - my) * 0.06, X, Y));
  const mt = $t('VÄLKOMMEN'), mtw = textW(SMALL, mt);
  if (mtw < px1 - px0) text(P, SMALL, mt, ((px0 + px1) >> 1) - (mtw >> 1), my + 1, 0xfff0a0);
  skugga(P, px0, px1, my + 7, 3, 0.1);
  // den röda mattan nerför trappan
  fyll(P, dx + 6, gy - 1, dx + dw - 7, gy, (X, Y) => tone(RODT, Y === gy - 1 ? 0.7 : 0.45, X, Y));
  // affischskåpen vid portalen (KATTUTSTÄLLNING / HUNDUTSTÄLLNING)
  for (const [ax, pal, motiv] of [[px0 - 14, RODT, 'katt'], [px1 + 4, BLA, 'hund']]) {
    fyll(P, ax, gy - 34, ax + 10, gy - 14, (X, Y) => (X === ax || X === ax + 10 || Y === gy - 34 || Y === gy - 14) ? JARN[2] : tone(pal, 0.7 - (Y - gy + 34) * 0.012, X, Y));
    tavla(P, ax + 2, gy - 31, 7, 7, motiv);
    for (let i = 0; i < 3; i++) P.hl(ax + 2, gy - 22 + i * 2, 7 - (i % 2) * 2, 0xffffff);
    P.hl(ax + 1, gy - 33, 9, 0xffffff, 0.4);
    if (natt) M.ljus.push([ax + 1, gy - 33, 9, 18]);
  }
  for (const lx of [px0 - 3, px1 + 3]) vagglykta(P, lx, gy - 30, natt, M, MASS);
  stupror(P, L(7), cy + 4, gy - 11); stupror(P, x1 - 10, cy + 4, gy - 11);
}

// ✂️ KLIPP & KLO – rosa puts med vita hörnkedjor, bubbelfönstret, trimsalongen och frisörstolpen
function malaTrim(K) {
  const { P, L, gy, top, natt, M, w, x1, dx, dw } = K;
  // rosetten på taket och sockerglasyrlisten med bågar
  const rx = L(80), ry = top - 6;
  spr(P, rx - 9, ry - 4, ['pp.......pp', 'pppp...pppp', 'ppppp.ppppp', 'ppppwwwpppp', 'ppppp.ppppp', 'pppp...pppp', 'pp..p.p..pp', '...p...p...', '..p.....p..'], { p: 0xe8508a, w: 0xffd0e4 });
  P.hl(rx - 8, ry - 3, 3, 0xffb0d0); P.hl(rx + 3, ry - 3, 3, 0xffb0d0);
  P.hl(L(-3), top, w + 6, VIT[4]); P.hl(L(-3), top + 1, w + 6, VIT[3]);
  for (let X = L(-3); X <= x1 + 3; X++) { const i = (X - L(-3)) % 6, d = [1, 2, 3, 3, 2, 1][i]; for (let j = 0; j < d; j++) P.px(X, top + 2 + j, j === d - 1 ? VIT[1] : VIT[3]); }
  puts(P, L(0), top + 2, x1, gy - 8, ROSP, 17);
  for (let Y = top + 5; Y < gy - 8; Y += 6) for (const [a, wi] of [[0, (Y / 6) % 2 ? 6 : 4], [w - ((Y / 6) % 2 ? 6 : 4), (Y / 6) % 2 ? 6 : 4]]) fyll(P, L(a), Y, L(a) + wi - 1, Y + 4, (X, YY) => tone(VIT, (YY === Y ? 0.95 : 0.7) - (X - L(a)) * 0.04, X, YY));
  skugga(P, L(0), x1, top + 5, 2, 0.08);
  sockel(P, L(0), x1, gy - 6, gy, 51, [0x6a5a60, 0x8a7a80, 0xa89aa0, 0xc4b8bc, 0xdcd2d6]);
  // övervåningen: två fönster med små randiga markiser och mintgröna luckor
  for (const fx of [14, 132]) {
    fonster(P, L(fx), top + 15, 14, 17, { natt, tand: hash(fx, 1, 9) > 0.3, M, ram: VIT, sp: [2, 2], gardin: 0xf4f1ea, spets: true, luckor: MINP, kruka: 0xf06aa0 });
    markis(P, L(fx) - 2, L(fx) + 15, top + 9, 2, [0xb8ac92, 0xd4c9ae, 0xe9dfc9, 0xf6efe2, 0xfffaf0], ROSP);
  }
  // bubbelfönstret: ett runt "skeppsfönster" med en hund i badet (bubblorna stiger i husLiv)
  const bx = L(80), by = top + 22;
  fyll(P, bx - 12, by - 12, bx + 12, by + 12, (X, Y) => {
    const d = Math.hypot(X + 0.5 - bx, Y + 0.5 - by);
    if (d > 12.2) return null;
    if (d > 9.6) return tone(ZINK, 0.85 - (X - bx + Y - by) * 0.02, X, Y);
    return natt ? tone(GLN, 0.8 - (Y - by) * 0.02, X, Y) : tone([0x3a7aa8, 0x5a9ac8, 0x8ac4e8, 0xb8e4f8, 0xe0f6ff], 0.8 - (Y - by + 9) * 0.03, X, Y);
  });
  for (let a = 0; a < 8; a++) P.px(Math.round(bx + Math.cos(a * Math.PI / 4) * 11), Math.round(by + Math.sin(a * Math.PI / 4) * 11), ZINK[4]);
  fyll(P, bx - 8, by + 3, bx + 8, by + 8, (X, Y) => { const d = Math.hypot((X + 0.5 - bx) / 8.5, (Y + 0.5 - by - 3) / 5.5); return d > 1 || Math.hypot(X + 0.5 - bx, Y + 0.5 - by) > 9.5 ? null : tone(VIT, Y === by + 3 ? 0.95 : 0.7, X, Y); });
  spr(P, bx - 4, by - 5, ['.f.ff.f.', 'ffffffff', 'oaaaaaao', 'oaeaaeao', '.aaaaaa.', '.aannaa.'], { f: 0xffffff, o: 0x6a4020, a: 0xc89a5a, e: 0x1a1414, n: 0x2a1a1a });
  for (const [i, j] of [[-6, 2], [-3, 1], [4, 1], [6, 2], [0, 2]]) { P.px(bx + i, by + j, 0xffffff); P.px(bx + i + 1, by + j, 0xe8f4ff); }
  if (natt) M.ljus.push([bx - 9, by - 9, 18, 18]);
  // två runda medaljonger med rosa tassar mellan fönstren och bubbelfönstret
  for (const mx of [L(48), L(112)]) {
    fyll(P, mx - 6, top + 17, mx + 6, top + 29, (X, Y) => { const d = Math.hypot(X + 0.5 - mx, Y + 0.5 - top - 23); return d > 6.3 ? null : d > 5 ? tone(MASS, X < mx ? 0.9 : 0.4, X, Y) : tone(VIT, 0.85 - (Y - top - 17) * 0.02, X, Y); });
    tass(P, mx, top + 23, 0xe8508a);
  }
  // sockerglasyrlisten med pärlor mellan övervåningen och skylten
  const gl = top + 36;
  P.hl(L(0), gl, w, VIT[4]); P.hl(L(0), gl + 1, w, VIT[3]);
  for (let X = L(0); X <= x1; X++) { const i = (X - L(0)) % 8, d = [1, 2, 3, 3, 3, 2, 1, 0][i]; for (let j = 0; j < d; j++) P.px(X, gl + 2 + j, j === d - 1 ? VIT[1] : VIT[3]); if (i === 3) P.px(X, gl + 3, 0xf06aa0); }
  skugga(P, L(0), x1, gl + 5, 2, 0.06);
  // skylten KLIPP & KLO med saxen och kammen målade på väggen
  const sn = $t('KLIPP & KLO');
  const s = brade(P, L(80), top + 41, sn, VIT, 0xd84a8a, 104, { kant: 0x7a1840, ljus: 0xffb0d0 });
  const sax = (x, y) => spr(P, x, y, ['o...o', 'oo.oo', '.o.o.', '..x..', '.b.b.', 'b...b', 'b...b'], { o: 0x8a929c, x: MASS[3], b: 0xd84a8a });
  sax(s[0] - 9, top + 45);
  spr(P, s[0] + s[2] + 3, top + 46, ['kkkkkk', 'k.k.k.', 'k.k.k.', 'k.k.k.'], { k: 0x46a090 });
  // markisen över skyltfönstren: mint och vitt
  markis(P, L(-3), x1 + 3, gy - 39, 5, MINP, [0xb8ac92, 0xd4c9ae, 0xe9dfc9, 0xf6efe2, 0xfffaf0]);
  const ram = [0x9aa4a8, 0xc0c8cc, 0xdde2e4, 0xf0f2f2, 0xffffff];
  // trimsalongen (vänster): spegeln med lampor, trimbordet med en pudel under hårtorken, hyllan med schampo
  skyltfonster(P, L(5), gy - 30, L(62), gy - 8, ram, natt, M, (P, natt) => {
    const X0 = L(5), X1 = L(62), Y0 = gy - 30, Y1 = gy - 8, lj = natt ? 0.06 : 0;
    fyll(P, X0, Y0, X1, Y1, (X, Y) => { if (Y > Y1 - 3) return tone(ROSP, 0.45, X, Y); const k = (Y - Y0) % 4 === 3 || (X - X0) % 4 === 3; return tone(MINP, (k ? 0.55 : 0.8) + lj, X, Y); });
    P.hl(X0, Y0 + 12, X1 - X0 + 1, ROSP[2]);
    fyll(P, X0 + 3, Y0 + 2, X0 + 14, Y0 + 13, (X, Y) => { const d = Math.hypot((X + 0.5 - X0 - 8.5) / 6, (Y + 0.5 - Y0 - 7.5) / 6); return d > 1 ? null : d > 0.8 ? 0xf4f1ea : tone(KAKEL, 0.85 - (Y - Y0) * 0.04, X, Y); });
    for (let a = 0; a < 8; a++) P.px(Math.round(X0 + 8.5 + Math.cos(a * Math.PI / 4) * 6.4), Math.round(Y0 + 7.5 + Math.sin(a * Math.PI / 4) * 6.4), natt ? 0xfff8d0 : 0xfff0a0);
    const tx = X0 + 20, ty = Y1 - 7;
    P.hl(tx, ty, 18, ZINK[4]); P.hl(tx, ty + 1, 18, ZINK[2]); P.vl(tx + 8, ty + 2, 5, ZINK[1]); P.hl(tx + 4, Y1 - 1, 9, ZINK[1]);
    spr(P, tx + 3, ty - 10, ['.......pp..', '......pwwp.', '......wwwe.', 'pp....wwwwn', 'pwwwwwwww..', '.wwwwwwww..', '..w.w..w.w.', '..w.w..w.w.', '.pp.p..p.pp'], { p: 0xf06aa0, w: 0xfaf6f8, e: 0x1a1414, n: 0x2a1a1a });
    P.vl(tx + 16, Y0 + 2, 6, ZINK[2]); P.hl(tx + 11, Y0 + 2, 6, ZINK[2]); P.rect(tx + 10, Y0 + 8, 4, 3, ZINK[3]); P.px(tx + 10, Y0 + 10, ZINK[1]);
    for (let r = 0; r < 2; r++) { const hy = Y0 + 5 + r * 8; P.hl(X1 - 13, hy + 4, 13, VIT[3]); [0xf06aa0, 0x5ab4e8, 0xf0c030, 0x8ad89a, 0xd8a0f0].forEach((c, i) => { P.rect(X1 - 12 + i * 2 + (i > 2 ? 1 : 0), hy + 1, 2, 3, c); P.px(X1 - 12 + i * 2 + (i > 2 ? 1 : 0), hy, mix(c, 0xffffff, 0.5)); }); }
  });
  // butiken (höger): koppel och halsband på en hålpanel, tuggben, en hund som sover i en korg
  skyltfonster(P, L(98), gy - 30, L(153), gy - 8, ram, natt, M, (P, natt) => {
    const X0 = L(98), X1 = L(153), Y0 = gy - 30, Y1 = gy - 8, lj = natt ? 0.06 : 0;
    fyll(P, X0, Y0, X1, Y1, (X, Y) => { const h = (X - X0) % 3 === 1 && (Y - Y0) % 3 === 1; return tone(SAND, (h ? 0.35 : 0.68) + lj, X, Y); });
    [0xd8343c, 0x3a7bd5, 0xf06aa0, 0x46a35a, 0xf0c030, 0x8a5ad0].forEach((c, i) => { const hx = X0 + 4 + i * 5, hy = Y0 + 3; P.px(hx + 1, hy, JARN[2]); for (let j = 0; j < 6; j++) { P.px(hx, hy + 1 + j, c); P.px(hx + 2, hy + 1 + j, mul(c, 0.8)); } P.hl(hx, hy + 7, 3, c); });
    fyll(P, X0 + 34, Y0 + 2, X0 + 52, Y0 + 13, (X, Y) => (X === X0 + 34 || X === X0 + 52 || Y === Y0 + 2 || Y === Y0 + 13) ? 0xffffff : tone(ROSP, 0.8, X, Y));
    spr(P, X0 + 39, Y0 + 4, ['p.......', 'oo....oo', 'oaaaaaao', 'oaeaaeao', '.aannaa.', '..aaaa..'], { p: 0xd8343c, o: 0x2a2024, a: 0x4a3a40, e: 0xf4f1ea, n: 0xf06aa0 });
    P.px(X0 + 38, Y0 + 3, 0xd8343c); P.px(X0 + 40, Y0 + 3, 0xd8343c);
    for (let i = 0; i < 3; i++) spr(P, X0 + 4 + i * 6, Y1 - 3 - (i % 2) * 2, ['w..w', '.ww.', 'w..w'], { w: 0xf4ecd8 });
    fyll(P, X0 + 26, Y1 - 6, X0 + 46, Y1, (X, Y) => { const d = Math.hypot((X + 0.5 - X0 - 36) / 10.5, (Y + 0.5 - Y1) / 6.5); return d > 1 ? null : d > 0.75 ? tone(TRA, 0.7 - (Y - Y1 + 6) * 0.05, X, Y) : tone(RODT, 0.55, X, Y); });
    spr(P, X0 + 29, Y1 - 6, ['..o.o.......', '.oaaaa..aaa.', 'aaeeaaaaaaaa', 'aaaaaaaaaaat'], { o: 0x6a4020, a: 0xc89a5a, e: 0x3a2a1a, t: 0xa87a40 });
  });
  dorr(P, dx, gy - 30, dw, 29, { pal: MINP, ram: VIT, natt, glas: 0.6, dekal: (P, gx0, gy0, gx1) => { const cx = (gx0 + gx1) >> 1; spr(P, cx - 3, gy0 + 4, ['.w.w.', 'wwwww', '.www.', '..w..'], { w: 0xf06aa0 }); } });
  // frisörstolpen i mässingsfästen bredvid dörren (ränderna snurrar i husLiv)
  const fp = TRIM_STOLPE(K);
  fyll(P, fp.x, fp.y0, fp.x + 3, fp.y1, (X, Y) => tone([0x9aa4a8, 0xc0c8cc, 0xdde2e4, 0xf0f2f2, 0xffffff], 0.8 - (X - fp.x) * 0.12, X, Y));
  P.rect(fp.x - 1, fp.y0 - 3, 6, 3, MASS[2]); P.hl(fp.x - 1, fp.y0 - 3, 6, MASS[4]); P.px(fp.x + 1, fp.y0 - 4, MASS[3]); P.rect(fp.x - 1, fp.y1 + 1, 6, 2, MASS[1]); P.hl(fp.x, fp.y1 + 3, 4, MASS[2]);
  stupror(P, x1 - 1, top + 3, gy - 8);
}
const TRIM_STOLPE = (K) => ({ x: K.L(93), y0: K.gy - 26, y1: K.gy - 10 });

// 🏢 BOSTADSHUS 1 – mintgrön puts, tre våningar, balkonger med smidesräcken, cykeln vid porten
function malaBo1(K) {
  const { P, L, gy, top, natt, M, w, x1, dx, dw } = K;
  for (const sx of [L(26), L(140)]) { fyll(P, sx, top - 10, sx + 8, top, (X, Y) => WALLS.brick(X, Y, 0x8a5a4a, 6)); P.rect(sx - 1, top - 12, 11, 2, STEN[3]); P.hl(sx - 1, top - 12, 11, STEN[4]); }
  P.vl(L(31), top - 26, 14, JARN[3]); P.hl(L(27), top - 23, 9, JARN[3]); P.hl(L(28), top - 19, 7, JARN[3]); P.hl(L(29), top - 15, 5, JARN[3]);
  fyll(P, L(100), top - 7, L(108), top - 1, (X, Y) => { const d = Math.hypot((X + 0.5 - L(104)) / 4.5, (Y + 0.5 - top + 4) / 3.5); return d > 1 ? null : tone(ZINK, 0.85 - (X - L(100)) * 0.06, X, Y); }); P.vl(L(104), top - 1, 2, JARN[3]);
  taklist(P, L(0), x1, top, VIT);
  for (let X = L(4); X < x1 - 3; X += 10) { P.rect(X, top + 6, 2, 3, VIT[3]); P.px(X + 1, top + 8, VIT[1]); }
  puts(P, L(0), top + 6, x1, gy - 17, MINP, 18);
  skugga(P, L(0), x1, top + 9, 2, 0.06);
  for (const by of [top + 34, top + 62]) { P.hl(L(0), by, w, VIT[4]); P.hl(L(0), by + 1, w, VIT[2]); P.hl(L(0), by + 2, w, 0x000000, 0.15); }
  fyll(P, L(0), gy - 16, x1, gy - 7, (X, Y) => tone(MINP, ((Y - gy + 16) % 4 === 3 ? 0.32 : 0.56) - (X - L(0)) / w * 0.06, X, Y));
  sockel(P, L(0), x1, gy - 6, gy, 61);
  // fönstren: tre våningar med olika krön, gardiner och krukväxter
  const rader = [[top + 14, 'rak'], [top + 42, 'tri'], [top + 70, 'rak']];
  rader.forEach(([fy, kr], r) => [12, 42, 116, 146].forEach((fx, i) => fonster(P, L(fx), fy, 12, 15, { natt, tand: hash(fx, fy, 5) > 0.32, M, ram: VIT, sp: [2, 3], krona: kr, gardin: [0xf4c8d0, 0xf8e4a0, 0xc8d4f4][(i + r) % 3], kruka: (i + r) % 3 === 0 ? [0xe04848, 0xf06aa0, 0xf0c030][r] : null, djur: r === 2 && i === 3 ? 'katt' : null, djurfarg: 0xf4f1ea })));
  // källarfönstren med galler
  for (const fx of [18, 48, 122, 152]) { fyll(P, L(fx), gy - 13, L(fx) + 7, gy - 9, (X, Y) => natt ? GLM[1] : tone(GLD, 0.4, X, Y)); for (let X = L(fx) + 1; X < L(fx) + 7; X += 2) P.vl(X, gy - 13, 5, JARN[2]); }
  // balkongerna: franska dörrar bakom, plattan, smidesräcket med blomlådor; tvätt på den övre (fladdrar i husLiv)
  for (const [i, by] of [[0, top + 32], [1, top + 60]]) {
    fonster(P, L(76), by - 22, 16, 22, { natt, tand: i === 0, M, ram: VIT, sp: [2, 3], gardin: 0xf4f1ea });
    fyll(P, L(64), by, L(105), by + 2, (X, Y) => tone(STEN, Y === by ? 0.95 : 0.5 - (Y - by) * 0.1, X, Y));
    for (const kx of [L(66), L(102)]) { P.px(kx, by + 3, STEN[1]); P.px(kx, by + 4, STEN[0]); }
    P.hl(L(64), by - 9, 42, JARN[3]); P.hl(L(64), by - 8, 42, JARN[1]);
    for (let X = L(65); X < L(105); X += 3) { P.vl(X, by - 7, 7, JARN[2]); }
    for (let X = L(68); X < L(102); X += 9) { P.px(X, by - 4, JARN[3]); P.px(X + 1, by - 5, JARN[3]); P.px(X + 2, by - 4, JARN[3]); P.px(X + 1, by - 3, JARN[3]); }
    blomlada(P, L(66), by - 12, 10, BLOMMOR.rod); blomlada(P, L(94), by - 12, 10, BLOMMOR.rosa);
  }
  // porten: pardörrar i ek med överljus och husnummer, lyktor, porttelefonen – och cykeln mot väggen
  dorr(P, dx - 3, gy - 26, dw + 6, 25, { pal: TRA, ram: VIT, natt, glas: 0.35, overljus: 'rak', nr: '12', brev: true });
  for (const lx of [dx - 8, dx + dw + 7]) vagglykta(P, lx, gy - 16, natt, M);
  P.rect(dx + dw + 10, gy - 20, 3, 5, ZINK[3]); P.px(dx + dw + 11, gy - 18, 0x2a9a5a);
  const cx = L(112), cyy = gy - 1;
  for (const hx of [cx, cx + 16]) for (let a = 0; a < 20; a++) { const v = a / 20 * Math.PI * 2; P.px(Math.round(hx + Math.cos(v) * 5), Math.round(cyy - 5 + Math.sin(v) * 5), JARN[1]); }
  for (const hx of [cx, cx + 16]) { P.px(hx, cyy - 5, ZINK[3]); P.line(hx, cyy - 5, hx + (hx === cx ? 3 : -2), cyy - 8, ZINK[2]); }
  P.line(cx, cyy - 5, cx + 7, cyy - 5, 0x3a7bd5); P.line(cx + 7, cyy - 5, cx + 12, cyy - 11, 0x3a7bd5); P.line(cx + 3, cyy - 11, cx + 12, cyy - 11, 0x3a7bd5); P.line(cx + 3, cyy - 11, cx + 7, cyy - 5, 0x3a7bd5); P.line(cx + 12, cyy - 11, cx + 16, cyy - 5, 0x3a7bd5);
  P.hl(cx + 1, cyy - 13, 4, JARN[1]); P.vl(cx + 3, cyy - 12, 1, JARN[2]); P.hl(cx + 11, cyy - 14, 3, JARN[2]); P.px(cx + 13, cyy - 13, JARN[2]);
  P.rect(cx + 13, cyy - 13, 4, 3, 0xc8a050); P.hl(cx + 13, cyy - 13, 4, 0xe8c070);
  stupror(P, L(2), top + 6, gy - 8); stupror(P, x1 - 4, top + 6, gy - 8);
}

// 🏡 BOSTADSHUS 2 – ljusblått trähus med tegeltak, takkupa, farstukvist och klätterrosen
function malaBo2(K) {
  const { P, L, gy, top, natt, M, w, x1, dx, dw } = K;
  const vy0 = top + 16, rise = 22;
  fyll(P, L(84), vy0 - rise - 8, L(91), vy0 - 8, (X, Y) => WALLS.brick(X, Y, 0x8a4a3a, 9)); P.rect(L(83), vy0 - rise - 10, 10, 2, STEN[3]); P.hl(L(83), vy0 - rise - 10, 10, STEN[4]);
  for (let j = 0; j < rise; j++) {
    const ins = Math.round(j * (w / 2 + 4) / rise), X0 = L(-4) + ins, ww = w + 8 - ins * 2;
    for (let i = 0; i < ww; i++) { const X = X0 + i, Y = vy0 - 1 - j, r = j % 4, rx = (X + (Math.floor(j / 4) & 1) * 2 + 40) % 5; let v = 0.6 - j / rise * 0.08 + [0.14, 0.05, -0.02, -0.12, -0.28][rx]; if (r === 3) v -= 0.22; P.px(X, Y, tone(TAKR, v, X, Y)); }
  }
  P.hl(L(w / 2 - 5), vy0 - rise - 1, 10, TAKR[1]);
  for (let X = L(-2); X < x1 + 2; X += 6) P.px(X, vy0 - 4, ZINK[3]); P.hl(L(-2), vy0 - 5, w + 4, ZINK[2]);
  // takkupan med ett litet fönster där en katt sitter
  const kx0 = L(26), kx1 = L(50), kyy = vy0 - 6;
  fyll(P, kx0, kyy - 12, kx1, kyy, (X, Y) => tone(BLAP, 0.62 + ((Y - kyy) % 4 === 0 ? -0.2 : 0), X, Y));
  for (let j = 0; j < 7; j++) P.hl(kx0 - 2 + j * 2, kyy - 13 - j, kx1 - kx0 + 5 - j * 4, tone(TAKR, 0.62, kx0, kyy - j));
  fonster(P, kx0 + 6, kyy - 10, 12, 10, { natt, tand: true, M, ram: VIT, sp: [2, 1], djur: 'katt', djurfarg: 0x2a2428 });
  P.hl(L(-4), vy0, w + 8, ZINK[3]); P.hl(L(-4), vy0 + 1, w + 8, ZINK[1]);
  liggpanel(P, L(0), vy0 + 2, x1, gy - 7, BLAP, 19);
  skugga(P, L(0), x1, vy0 + 2, 3, 0.08);
  for (const kx of [L(0), x1 - 3]) fyll(P, kx, vy0 + 2, kx + 3, gy - 7, (X, Y) => tone(VIT, X === kx ? 0.95 : X === kx + 3 ? 0.45 : 0.72, X, Y));
  sockel(P, L(0), x1, gy - 6, gy, 71);
  for (const [fx, fy, o] of [[10, vy0 + 10, { gardin: 0xf4f1ea }], [30, vy0 + 10, { gardin: 0xf4c8d0, kruka: 0xe04848 }], [84, vy0 + 10, { gardin: 0xf4c8d0 }], [104, vy0 + 10, { gardin: 0xf4f1ea }], [10, gy - 32, { lada: BLOMMOR.gul }], [30, gy - 32, { lada: BLOMMOR.rod }], [84, gy - 32, { lada: BLOMMOR.lila }], [104, gy - 32, { lada: BLOMMOR.rod }]]) fonster(P, L(fx) - 2, fy, 12, 14, { natt, tand: hash(fx, fy, 6) > 0.3, M, ram: VIT, sp: [2, 2], krona: 'snick', spets: true, ...o });
  // fågelholken mellan övervåningens fönster
  const fh = L(60);
  P.rect(fh - 3, vy0 + 12, 7, 8, TRA[3]); P.vl(fh + 3, vy0 + 12, 8, TRA[1]); for (let j = 0; j < 4; j++) P.hl(fh - 4 + j, vy0 + 11 - j, 9 - j * 2, TAKR[2 + (j === 0 ? 1 : 0)]);
  P.rect(fh - 1, vy0 + 14, 2, 2, 0x1a1414); P.px(fh, vy0 + 17, TRA[0]);
  // farstukvisten med svarvade stolpar och sågad gavel
  const kv0 = dx - 6, kv1 = dx + dw + 5, kvy = gy - 34;
  for (let j = 0; j < 6; j++) P.hl(kv0 - 2 + j * 2, kvy - j, kv1 - kv0 + 5 - j * 4, tone(TAKR, 0.62 - j * 0.03, kv0, kvy - j));
  for (let j = 0; j < 5; j++) { const half = Math.round((5 - j) * 2); P.hl(((kv0 + kv1) >> 1) - half, kvy - j, half * 2 + 1, j === 0 ? VIT[1] : VIT[3]); }
  P.hl(kv0 - 2, kvy + 1, kv1 - kv0 + 5, VIT[4]);
  for (let X = kv0 - 1; X < kv1 + 2; X += 3) P.px(X, kvy + 2, VIT[2]);
  for (const sx of [kv0, kv1 - 1]) for (let Y = kvy + 2; Y < gy - 1; Y++) { const b = (Y - kvy) % 6 === 0 ? 1 : 0; P.px(sx - b, Y, VIT[4]); P.px(sx + 1, Y, VIT[2]); if (b) P.px(sx + 2, Y, VIT[1]); }
  skugga(P, kv0 + 2, kv1 - 2, kvy + 2, 3, 0.1);
  dorr(P, dx, gy - 24, dw, 22, { pal: [0x8a867c, 0xb6b2a8, 0xd8d4ca, 0xefece3, 0xfffdf7], ram: VIT, natt, glas: 0.4, brev: true });
  text(P, SMALL, '7', dx + (dw >> 1) - 1, gy - 30, MASS[2]);
  vagglykta(P, kv0 - 4, gy - 14, natt, M);
  // klätterrosen på spaljén till höger om dörren
  const sx0 = kv1 + 2;
  for (let Y = gy - 40; Y < gy - 2; Y++) for (let X = sx0; X < sx0 + 8; X++) if ((X - sx0 + Y) % 4 === 0 || (X - sx0 - Y + 400) % 4 === 0) P.px(X, Y, VIT[2], 0.8);
  for (let k = 0; k < 70; k++) { const X = sx0 + Math.floor(hash(k, 1, 8) * 8), Y = Math.round(gy - 4 - hash(k, 2, 8) * 36 * (0.5 + hash(k, 3, 8) * 0.5)); P.px(X, Y, tone(BLAD, 0.3 + hash(k, 4, 8) * 0.6, X, Y)); if (hash(k, 7, 8) > 0.5) P.px(X + 1, Y, tone(BLAD, 0.5, X, Y)); }
  for (let k = 0; k < 12; k++) { const X = sx0 + 1 + Math.floor(hash(k, 5, 8) * 6), Y = gy - 8 - Math.floor(hash(k, 6, 8) * 28); P.px(X, Y, 0xf06a9a); P.px(X + 1, Y, 0xffb0d0); P.px(X, Y + 1, 0xc83a6a); }
  stupror(P, x1 - 7, vy0 + 2, gy - 8);
}

// ---------------------------------------------------------------- det som rör sig (varje bildruta)
// ox, oy = husbildens övre vänstra hörn i världen (husPos)
const bubbelFas = [0, 0.37, 0.71, 0.18, 0.55];
export function husLiv(ctx, id, ox, oy, t, natt) {
  const H = HUS[id], HH = H.h + 44, gy = oy + HH - 4, top = gy - H.h, L = (x) => ox + 8 + x;
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  if (id === 'kafe') {
    // kattklockan: ögonen tittar fram och tillbaka, svansen pendlar
    const kcx = L(80), kcy = top + 10, o = Math.round(Math.sin(t * 3.2));
    for (const ex of [kcx - 2, kcx + 2]) { R('#f4f1ea', ex - 1, kcy + 3, 3, 2); R('#22202a', ex + o, kcy + 3, 1, 2); }
    const sv = Math.sin(t * 3.2) * 2;
    for (let j = 0; j < 4; j++) R('#22202a', kcx + Math.round(sv * j / 4), kcy + 20 + j, 2, 1);
    // ångan från espressomaskinen och kopparna
    for (let k = 0; k < 3; k++) { const u = (t * 0.7 + k / 3) % 1; ctx.globalAlpha = 0.6 * (1 - u); R('#ffffff', L(132) + Math.sin(t * 3 + k) * 1.5 + (k - 1) * 3, gy - 18 - u * 7); ctx.globalAlpha = 1; }
    for (const cx of [L(43), L(48)]) { const u = (t * 0.5 + cx * 0.1) % 1; ctx.globalAlpha = 0.5 * (1 - u); R('#ffffff', cx + Math.sin(t * 2 + cx) * 1, gy - 16 - u * 5); ctx.globalAlpha = 1; }
    // baristan bakom disken (klippt ovanför bänkskivan)
    ctx.save(); ctx.beginPath(); ctx.rect(L(100), gy - 30, 55, 14); ctx.clip();
    drawPerson(ctx, L(146) + Math.round(Math.sin(t * 0.4) * 3), gy + 2, BARISTA, Math.sin(t * 0.4) > 0.6 ? 'left' : 'down', 0);
    ctx.restore();
    // KURR-neonen: ett R blinkar till ibland på kvällen
    if (natt && Math.floor(t * 1.3) % 7 === 3) { const kw = textW(SMALL, 'KURR'); R('rgba(30,24,36,.85)', L(80) - (kw >> 1) + 12, top - 9 + 4, 3, 5); }
  } else if (id === 'trim') {
    // frisörstolpen: rosa och vita ränder som snurrar uppåt
    const x = L(93), y0 = gy - 26, y1 = gy - 10;
    for (let y = y0; y <= y1; y++) for (let i = 0; i < 4; i++) { const r = Math.floor((y + i * 1.2 - t * 8) / 3) % 2 === 0; R(r ? (i === 0 ? '#ff9ac4' : i === 3 ? '#b83a6a' : '#e8508a') : (i === 0 ? '#ffffff' : i === 3 ? '#b8bcc4' : '#f0f2f4'), x + i, y); }
    // bubblorna i badfönstret
    const bx = L(80), by = top + 22;
    for (let k = 0; k < 5; k++) { const u = (t * 0.35 + bubbelFas[k]) % 1, x = bx - 6 + k * 3 + Math.sin(t * 2 + k) * 1.5, y = by + 2 - u * 10; if (Math.hypot(x - bx, y - by) > 8.5) continue; ctx.globalAlpha = 0.85 * (1 - u * 0.6); R('#ffffff', x, y); if (k % 2) R('#e8f6ff', x + 1, y - 1); ctx.globalAlpha = 1; }
    // hårtorkens luft och trimmaren
    for (let k = 0; k < 3; k++) { const u = (t * 2 + k / 3) % 1; ctx.globalAlpha = 0.5 * (1 - u); R('#ffffff', L(5) + 31 + k, gy - 20 + u * 6); ctx.globalAlpha = 1; }
    ctx.save(); ctx.beginPath(); ctx.rect(L(5), gy - 30, 58, 16); ctx.clip();
    drawPerson(ctx, L(52) + Math.round(Math.sin(t * 0.5) * 2), gy + 3, TRIMMARE, 'left', 0);
    ctx.restore();
  } else if (id === 'klinik') {
    ctx.save(); ctx.beginPath(); ctx.rect(L(98), gy - 29, 47, 13); ctx.clip();
    drawPerson(ctx, L(118), gy + 3, VERA_LOOK, 'down', 0);
    ctx.restore();
    if (natt) { const p = 0.25 + Math.sin(t * 2) * 0.15; ctx.globalAlpha = p; R('#aaffcc', L(75) - 3, top + 8, 7, 21); R('#aaffcc', L(75) - 10, top + 15, 21, 7); ctx.globalAlpha = 1; }
  } else if (id === 'hall') {
    // biografmarkisens glödlampor jagar varandra; flaggorna på taket vajar
    const dx = L(H.door.x0 - H.x), px0 = dx - 12, px1 = dx + (H.door.x1 - H.door.x0) + 11, my = gy - 51;
    for (let x = px0, i = 0; x <= px1; x += 3, i++) { const pa = (i + Math.floor(t * 6)) % 4 === 0; R(pa ? '#fff6c0' : natt ? '#e0a040' : '#c89a40', x, my - 1); R(pa ? '#fff6c0' : natt ? '#e0a040' : '#c89a40', x, my + 7); }
    const mid = L(H.w / 2);
    for (const [i, c, fx] of [[0, '#d8343c', mid - 128], [1, '#3a7bd5', mid - 108], [2, '#f0b429', mid + 108], [3, '#46a35a', mid + 128]]) {
      const half = H.w / 2 + 3, j = Math.sqrt(Math.max(0, 1 - ((fx - mid) / half) ** 2)) * 30, base = Math.round(top + 20 - j) + 1;
      R('#5a5e66', fx, base - 18, 1, 18); R('#c8a040', fx, base - 19);
      for (let k = 0; k < 9; k++) R(c, fx + 1 + k, base - 18 + Math.round(Math.sin(t * 5 + k * 0.7 + i) * 1), 1, 5);
    }
  } else if (id === 'bo1') {
    // tvätten på den övre balkongen fladdrar
    const by = top + 32, x0 = L(70);
    R('#e8e4dc', x0, by - 17, 30, 1);
    [['#f06aa0', 4, 6], ['#ffffff', 5, 7], ['#3a7bd5', 4, 5], ['#f0c030', 3, 4], ['#ffffff', 4, 6]].forEach(([c, w, h], i) => { const x = x0 + 2 + i * 6, s = Math.round(Math.sin(t * 4 + i * 0.9) * 1); R(c, x + s, by - 16, w, h); R('rgba(0,0,0,.18)', x + s + w - 1, by - 16, 1, h); R('#8a5a3a', x + 1, by - 17, 1, 1); });
  } else if (id === 'bo2') {
    // röken ur skorstenen
    for (let k = 0; k < 5; k++) { const u = (t * 0.22 + k / 5) % 1; ctx.globalAlpha = 0.45 * (1 - u); const s = 2 + Math.round(u * 4); R(natt ? '#8a8aa0' : '#e8e8ee', L(87) + Math.sin(t + k) * 2 + u * 10 - s / 2, top + 16 - 32 - u * 22, s, s); ctx.globalAlpha = 1; }
  } else if (id === 'hem') {
    // vindflöjeln på frontespisen (tassen) vänder sig med vinden
    const mid = L(107), peak = top + 14 - 24, s = Math.sin(t * 0.6) > 0 ? 1 : -1;
    R('#c8a040', mid, peak - 9, 1, 3); R('#c8a040', mid + s, peak - 9); R('#c8a040', mid + s * 2, peak - 10, 1, 2);
  }
}
// folket bakom fönstren (stabila utseenden ur ett eget frö)
const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const BARISTA = { ...makeLook(lcg(311)), kid: false, skin: '#c88a5a', hair: '#2a1a14', style: 'bun', shirt: '#f4f1ea', top: 'tee', hat: null, glasses: false };
const TRIMMARE = { ...makeLook(lcg(312)), kid: false, skin: '#f0c8a8', hair: '#d84a8a', style: 'bob', shirt: '#46a090', top: 'tee', hat: null };
const VERA_LOOK = { ...makeLook(lcg(313)), kid: false, skin: '#e8b890', hair: '#8a5a3a', style: 'ponytail', shirt: '#4ab878', top: 'tee', hat: null };

// ---------------------------------------------------------------- glöden efter mörkret
export function husSken(ctx, id, ox, oy, t) {
  const M = META.get(`${id}|1`); if (!M) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, w, h] of M.ljus) { ctx.fillStyle = 'rgba(255,190,110,.22)'; ctx.fillRect(ox + x, oy + y, w, h); ctx.fillStyle = 'rgba(255,170,90,.10)'; ctx.fillRect(ox + x - 2, oy + y + h, w + 4, 6); }
  for (const [x, y, r, c] of M.sken) {
    const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r), rr = (c >> 16) & 255, gg = (c >> 8) & 255, bb = c & 255;
    g.addColorStop(0, `rgba(${rr},${gg},${bb},.5)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(ox + x - r, oy + y - r, r * 2, r * 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- saker på trottoaren (scenen ritar dem y-sorterade)
// ✏️ kattcaféets gatupratare: DAGENS KANELBULLE med en ritad katt
export function ritaGatupratare(ctx, x, y) {
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(X, Y, w, h); };
  R('rgba(20,12,30,.25)', x - 7, y, 14, 2);
  for (let j = 0; j < 18; j++) { const u = j / 18, half = Math.round(5 + u * 2); R('#86562e', x - half - 1, y - 18 + j); R('#86562e', x + half, y - 18 + j); R('#2a2e2a', x - half, y - 18 + j, half * 2, 1); }
  R('#ae7640', x - 6, y - 19, 12, 1);
  for (const [dy, w] of [[-15, 8], [-12, 6], [-9, 9]]) R('#e8e4dc', x - 4, y + dy, w, 1);
  R('#f0c030', x - 4, y - 6, 2, 2); R('#f06aa0', x + 1, y - 6, 1, 1); R('#f06aa0', x + 3, y - 6, 1, 1); R('#f06aa0', x + 1, y - 5, 3, 1);
}
// 🐩 pudelbusken i en kruka (buxbom klippt som en pudel) vid trimmaren
export function ritaPudelbuske(ctx, x, y) {
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(X, Y, w, h); };
  R('rgba(20,12,30,.25)', x - 6, y, 12, 2);
  R('#c0602e', x - 4, y - 6, 8, 6); R('#dc8048', x - 5, y - 7, 10, 2); R('#9a4020', x + 3, y - 5, 1, 5);
  const boll = (cx, cy, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) R(i + j < -r * 0.6 ? '#80c05a' : i + j > r * 0.6 ? '#24521c' : '#387628', cx + i, cy + j); };
  R('#5e3a20', x, y - 14, 1, 7);
  boll(x, y - 11, 3); boll(x, y - 18, 4); boll(x - 3, y - 25, 3); boll(x + 3, y - 23, 2); boll(x - 6, y - 23, 2);
}
