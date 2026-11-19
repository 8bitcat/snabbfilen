// ⚓ FISKEHAMNENS HUS OCH REKVISITA – ritas y-sorterat av scenen (js/scenes/hamnen.js). Husen (husBild per typ:
// hamnkontoret i gul puts med klocka och flagga, magasinet i rött tegel med hissbom och portar, fiskmarknadens öppna
// hall på stolpar, båtaffärens plåtskjul med skjutport, skeppshandeln i vit panel med ankarskylt, rökeriet i tjärad
// panel med skorsten, färjeterminalen i vitt med stora fönster), marknadsstånden, Fisk & chips-vagnen, båtarna på
// trailers, hamnkranen, ankaret, pollare, hamnlyktor, fisklådor, hummertinor, nätställningar, tunnor, pirstolparna med
// kätting, bojar, fiskebåtarna (trawler/snipa/segelbåt/eka – guppar i scenen), måsen och sälen.
// Allt stillastående cachas som bilder (origo = foten); ett pixelkorn, ljuset uppifrån vänster.
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { HUS, FISKBIL, KRAN, ANKARE, SKYLT, BATTYPER } from './karta.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, ZINK, STEN, TRA, FALU, BLA, RODT, SAND } = FARGER;
const TEGEL = [0x5a2a1e, 0x8a3a28, 0xa84c34, 0xc06448, 0xd88060];
const PLAT = [0x3a4a5a, 0x50627a, 0x6a7e96, 0x88a0b8, 0xa8c0d4];
const GUL = [0x8a6a1a, 0xc09a2a, 0xe0b840, 0xf0d070, 0xf8e8a0];
const TJARA = [0x1a1410, 0x2a2018, 0x3a2c20, 0x4a3828, 0x5e4a36];
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w, a = 0.24) => { ctx.fillStyle = `rgba(20,12,30,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ---------- husen (fasaden står på BASE, bilden ritas med foten i husets vänstra nederkant) ----------
function fonster(P, x, y, w, h, natt, ram = VIT[3]) { P.rect(x - 1, y - 1, w + 2, h + 2, ram); P.rect(x, y, w, h, natt ? 0xffe8a0 : 0x6a8ab0); if (!natt) { P.px(x, y, 0xb8d8f0); P.px(x + 1, y, 0xb8d8f0); } if (w > 6) P.vl(x + (w >> 1), y, h, ram); }
function dorr(P, x, y, w, h, c, natt) { P.rect(x, y - h, w, h, c); P.hl(x, y - h, w, mix(c, 0xffffff, 0.3)); P.vl(x + w - 1, y - h, h, mul(c, 0.7)); P.px(x + w - 3, y - (h >> 1), MASS[3]); if (natt) P.rect(x + 2, y - h + 3, w - 4, 3, 0xffe8a0); }
function skylt(P, x, y, s, bg, fg) { const w = textW(SMALL, s) + 8; P.rect(x - (w >> 1), y, w, 9, bg); P.box(x - (w >> 1), y, w, 9, mul(bg, 0.6)); text(P, SMALL, s, x - (w >> 1) + 4, y + 2, fg); return w; }
export function husBild(id, natt) {
  const Hs = HUS[id];
  return bild(`hus|${id}|${natt}`, Hs.w + 20, Hs.h + 60, 10, Hs.h + 56, (P) => {
    const w = Hs.w, h = Hs.h, cx = w >> 1;
    if (Hs.typ === 'kontor') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => (X === 0 || X === w - 1 ? GUL[0] : tone(GUL, 0.58 - (X / w) * 0.08 + (hash(X >> 2, Y >> 2, 3) - 0.5) * 0.08, X, Y)));
      for (let j = 0; j < 10; j++) P.hl(-4 + j, -h - 10 + j, w + 8 - j * 2, j % 3 === 2 ? 0x4a3a40 : 0x6a5a62);   // valmat tak i skiffer
      for (const fx of [16, 48, w - 64, w - 32]) { fonster(P, fx, -h + 24, 14, 16, natt); fonster(P, fx, -46, 14, 16, natt); }
      dorr(P, Hs.door.x0 - Hs.x, 0, Hs.door.x1 - Hs.door.x0, 30, 0x2a5aa8, natt); P.rect(Hs.door.x0 - Hs.x - 3, -32, Hs.door.x1 - Hs.door.x0 + 6, 3, STEN[3]);
      for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; P.px(cx + Math.round(Math.cos(an) * 8), -h + 10 + Math.round(Math.sin(an) * 8), 0x3a3a42); } P.rect(cx - 6, -h + 4, 13, 13, 0xfaf6ea, 0.9); P.vl(cx, -h + 6, 5, 0x1c1a20); P.hl(cx, -h + 10, 4, 0x1c1a20);   // klockan
      P.vl(w - 8, -h - 30, 30, 0x8a8a94); P.rect(w - 7, -h - 29, 10, 6, 0x2a5aa8); P.hl(w - 7, -h - 26, 10, 0xf0d040); P.vl(w - 4, -h - 29, 6, 0xf0d040);   // flaggan
      skylt(P, cx, -h + 26, $t('HAMNKONTORET'), 0x2a5aa8, 0xf4f1ea);
    } else if (Hs.typ === 'magasin') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => { const r = Math.floor(Y / 4), b = Math.floor((X + (r & 1) * 5) / 10); return (Y % 4 === 3 || (X + (r & 1) * 5) % 10 === 9) ? TEGEL[0] : tone(TEGEL, 0.55 + (hash(b, r, 4) - 0.5) * 0.3 - (X / w) * 0.06, X, Y); });
      for (let j = 0; j < 12; j++) P.hl(-4 + j, -h - 12 + j, w + 8 - j * 2, j % 3 === 2 ? 0x3a3a42 : 0x5a5a62);
      for (const fx of [20, 60, w - 76, w - 36]) { fonster(P, fx, -h + 20, 16, 14, natt, 0x2a2a30); P.vl(fx + 5, -h + 20, 14, 0x2a2a30); P.vl(fx + 10, -h + 20, 14, 0x2a2a30); }
      P.rect(cx - 8, -h + 44, 16, 18, 0x3a2a20); P.box(cx - 8, -h + 44, 16, 18, 0x6e4a28);   // hissluckan
      P.rect(cx - 2, -h - 2, 4, 30, 0x3a3a42); P.rect(cx - 14, -h - 4, 28, 3, 0x3a3a42); P.vl(cx + 10, -h - 1, 12, 0x8a8a94); P.rect(cx + 8, -h + 11, 5, 4, 0x3a3a42);   // hissbommen med kroken
      dorr(P, Hs.door.x0 - Hs.x, 0, Hs.door.x1 - Hs.door.x0, 40, 0x4a5a3a, natt); P.vl(Hs.door.x0 - Hs.x + ((Hs.door.x1 - Hs.door.x0) >> 1), -40, 40, 0x2a3a2a);
      skylt(P, cx, -h + 6, $t('MAGASIN 3'), 0xf4f1ea, 0x2a2a30);
    } else if (Hs.typ === 'hall') {
      // öppen hall: stolpar, takstolar, böljande plåttak, en bakvägg i trä med skylten och krokar med nät; fronten är öppen
      fyll(P, 2, -h + 24, w - 3, 0, (X, Y) => tone(TRA, 0.42 + ((X % 7) === 0 ? -0.1 : 0) + (hash(X >> 2, Y >> 3, 5) - 0.5) * 0.1, X, Y));
      P.hl(2, -h + 24, w - 5, TRA[4]);
      for (let j = 0; j < 20; j++) { const wv = Math.round(Math.sin(j * 0.8) * 1); P.hl(-6 + (j >> 1) + wv, -h - 2 + j, w + 12 - j, j === 0 ? ZINK[4] : (j % 4 === 1 ? ZINK[1] : ZINK[2])); }   // plåttaket
      for (const px of [6, w >> 1, w - 10]) { P.rect(px, -h + 18, 4, h - 18, TRA[1]); P.vl(px, -h + 18, h - 18, TRA[3]); }
      for (let k = 0; k < 5; k++) { const nx = 24 + k * 56; for (let j = 0; j < 14; j++) P.px(nx + Math.round(Math.sin(j) * 2), -h + 30 + j, 0x8aa0a8, 0.8); P.px(nx, -h + 29, JARN[3]); }   // hängande nät
      const s = $t('FISKMARKNADEN'), tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 6, -h + 30, tw + 12, 11, 0x1e3a5a); P.box(cx - (tw >> 1) - 6, -h + 30, tw + 12, 11, 0x8ab0d0); text(P, SMALL, s, cx - (tw >> 1), -h + 33, 0xf4f1ea);
      spr(P, cx - (tw >> 1) - 18, -h + 31, ['.....', 'k..kk', 'kk.kk', 'kkkkk', 'kk.kk', 'k..kk'], { k: 0x8ab0d0 });   // en fisk
      for (let i = 0; i < 6; i++) P.rect(8 + i * 48, -h + 44, 3, 3, natt ? 0xffe8a0 : 0xf4f1ea);   // lampor under taket
      fyll(P, 0, -h + 24, 1, 0, () => TRA[0]); fyll(P, w - 2, -h + 24, w - 1, 0, () => TRA[0]);
    } else if (Hs.typ === 'bataffar') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(PLAT, 0.55 + ((X % 5) === 0 ? -0.15 : (X % 5) === 1 ? 0.1 : 0) - (X / w) * 0.05, X, Y));
      for (let j = 0; j < 14; j++) { const half = Math.round((w / 2 + 6) * (1 - j / 14)); for (let x = cx - half; x <= cx + half; x++) P.px(x, -h - 14 + j, j === 0 ? 0xf4f1ea : (x % 5 === 0 ? PLAT[1] : PLAT[2])); }   // gaveltak
      dorr(P, Hs.door.x0 - Hs.x, 0, Hs.door.x1 - Hs.door.x0, 46, 0x2a4a6a, natt); for (let x = Hs.door.x0 - Hs.x + 4; x < Hs.door.x1 - Hs.x; x += 6) P.vl(x, -46, 46, 0x1e3a56); P.rect(Hs.door.x0 - Hs.x - 2, -48, Hs.door.x1 - Hs.door.x0 + 4, 3, JARN[3]);   // skjutporten på skena
      fonster(P, 14, -h + 22, 18, 12, natt); fonster(P, w - 34, -h + 22, 18, 12, natt);
      spr(P, cx - 15, -h - 30, ['.............b', '............bb', '...........bbb', '..........bbbb', '.........bbbbb', '........bbbbbb', '.......bbbbbbb', 'rrrrrrrrrrrrrrrrrr', '.rrrrrrrrrrrrrrrr.', '..rrrrrrrrrrrrrr..'], { b: 0xf4f1ea, r: 0xd8343c });   // segelbåtsskylten på taket
      skylt(P, cx, -h + 6, $t('BÅTAFFÄREN'), 0xf4f1ea, 0x2a4a6a);
    } else if (Hs.typ === 'skeppshandel') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => (Y % 6 === 5 ? VIT[1] : tone(VIT, 0.7 - (X / w) * 0.1 + (hash(X >> 3, Y >> 3, 6) - 0.5) * 0.06, X, Y)));
      for (let j = 0; j < 10; j++) P.hl(-3 + j, -h - 10 + j, w + 6 - j * 2, j % 3 === 2 ? 0x1e3a56 : 0x2a5aa8);
      fonster(P, 10, -h + 20, 22, 18, natt, 0x2a5aa8); fonster(P, w - 32, -h + 20, 22, 18, natt, 0x2a5aa8);
      for (let k = 0; k < 3; k++) { P.rect(13 + k * 7, -h + 30, 4, 6, [0xd8343c, 0xf0c030, 0x3a7bd5][k]); P.rect(w - 29 + k * 7, -h + 32, 4, 4, [0x8a6236, 0xf4f1ea, 0x3e8a34][k]); }   // varor i fönstren
      dorr(P, Hs.door.x0 - Hs.x, 0, Hs.door.x1 - Hs.door.x0, 30, 0x2a5aa8, natt);
      spr(P, cx - 4, -h + 44, ['...k...', '..kkk..', '...k...', 'k..k..k', 'kk.k.kk', '.kkkkk.', '..kkk..'], { k: 0x2a2a30 });   // ankarskylten
      skylt(P, cx, -h + 6, $t('SKEPPSHANDEL'), 0x2a5aa8, 0xf4f1ea);
    } else if (Hs.typ === 'rokeri') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(TJARA, 0.5 + ((X % 6) === 0 ? -0.2 : 0) + (hash(X >> 2, Y >> 2, 7) - 0.5) * 0.15, X, Y));
      for (let j = 0; j < 12; j++) P.hl(-3 + j, -h - 12 + j, w + 6 - j * 2, j % 3 === 2 ? 0x5e3a20 : 0x86562e);   // brädtak
      P.rect(w - 30, -h - 30, 10, 22, STEN[1]); P.hl(w - 31, -h - 31, 12, STEN[3]);   // skorstenen (röken i scenen)
      fonster(P, 12, -h + 26, 12, 10, natt, 0x6e4a28);
      dorr(P, Hs.door.x0 - Hs.x, 0, Hs.door.x1 - Hs.door.x0, 28, 0x5e3a20, natt);
      for (let k = 0; k < 4; k++) { P.vl(40 + k * 10, -h + 22, 10, 0x8a6236); spr(P, 38 + k * 10, -h + 32, ['.k.', 'kkk', 'kkk', '.k.'], { k: [0xd88060, 0xc06448][k % 2] }); }   // rökt fisk på krokar
      skylt(P, cx, -h + 4, $t('RÖKERI'), 0x5e3a20, 0xf8e080);
    } else if (Hs.typ === 'terminal') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(VIT, 0.72 - (X / w) * 0.06 + (Y % 20 === 19 ? -0.2 : 0), X, Y));
      P.rect(-4, -h - 6, w + 8, 6, 0x2a5aa8); P.hl(-4, -h - 6, w + 8, 0x5890e8);
      for (let x = 10; x < w - 10; x += 34) fonster(P, x, -h + 20, 26, 30, natt, 0x3a3a42);
      dorr(P, Hs.door.x0 - Hs.x, 0, Hs.door.x1 - Hs.door.x0, 34, 0x8ab4d8, natt); P.vl(Hs.door.x0 - Hs.x + ((Hs.door.x1 - Hs.door.x0) >> 1), -34, 34, 0x3a3a42);
      for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; P.px(cx + Math.round(Math.cos(an) * 7), -h + 10 + Math.round(Math.sin(an) * 7), 0x2a2a30); } P.rect(cx - 5, -h + 5, 11, 11, 0xfaf6ea, 0.9); P.vl(cx, -h + 7, 4, 0x1c1a20); P.hl(cx, -h + 10, 3, 0x1c1a20);
      skylt(P, cx, -h + 62, $t('FÄRJA SOLÖN'), 0x2a5aa8, 0xf4f1ea);
      spr(P, cx + 36, -h + 62, ['........', 'kkkkkkkk', '.kkkkkk.', '..kkkk..', 'k.......', 'kkk..kkk', 'kkkkkkkk'], { k: 0x2a5aa8 });
    }
    for (let x = 0; x < w; x++) P.px(x, 1, 0x000000, 0.25);
  });
}
export function ritaHus(ctx, id, natt, baseY) { const Hs = HUS[id]; put(ctx, husBild(id, natt), Hs.x + 10, baseY + 4); }

// ---------- rekvisitan på kajen ----------
export function ritaStand(ctx, s, natt) {
  const typ = s.id;
  skugga(ctx, s.x, s.y, 44);
  put(ctx, bild('stand|' + typ + natt, 56, 52, 28, 48, (P) => {
    P.rect(-21, -12, 42, 12, TRA[2]); P.hl(-21, -12, 42, TRA[4]); P.hl(-21, -1, 42, TRA[0]); P.vl(-20, -36, 36, TRA[1]); P.vl(19, -36, 36, TRA[1]);
    for (let i = -23; i < 23; i++) { const c = ((i + 23) / 5 | 0) % 2 ? 0xf4f1ea : 0x2a5aa8; P.rect(i, -42, 1, 7 + [2, 3, 3, 2, 1][(i + 23) % 5], c); }
    fyll(P, -19, -18, 18, -13, (X, Y) => (Y === -18 ? 0xe8f4f8 : 0xc8e0ec));   // isen i disken
    if (typ === 'fisk') { for (let k = 0; k < 4; k++) spr(P, -18 + k * 9, -18, ['k..kkkk', 'kk.kkkw', 'k..kkkk'], { k: [0x8ab0c0, 0xa8b8a0, 0x9ab8d0, 0xb0a890][k], w: 0x1a1414 }); }
    else if (typ === 'rokt') { for (let k = 0; k < 4; k++) spr(P, -17 + k * 9, -18, ['kkkkkk.', 'kkkkkkk', '.kkkkk.'], { k: [0xd88060, 0xc06448][k % 2] }); P.rect(-18, -22, 36, 1, 0x3a2a20); }
    else { for (let k = 0; k < 14; k++) { const px = -18 + (k % 7) * 5, py = -18 + (k > 6 ? 3 : 0); P.px(px, py, 0xf0a0a0); P.px(px + 1, py, 0xf8c0b0); P.px(px + 2, py + 1, 0xf0a0a0); } }
    const s2 = typ === 'fisk' ? $t('FÄRSK FISK') : typ === 'rokt' ? $t('RÖKT') : $t('RÄKOR'), tw = textW(SMALL, s2); P.rect(-(tw >> 1) - 3, -31, tw + 6, 9, 0x1e3a5a); text(P, SMALL, s2, -(tw >> 1), -29, 0xf4f1ea);
    P.rect(-2, -8, 4, 6, 0x3a2a2a); P.px(-1, -8, 0xf0cfae); P.px(0, -8, 0xf0cfae); P.rect(-3, -3, 6, 2, 0xf4f1ea);   // säljaren bakom disken (förkläde)
  }), s.x, s.y);
}
export function ritaFiskbil(ctx, natt) {
  const { x, y } = FISKBIL;
  skugga(ctx, x, y, 56);
  put(ctx, bild('fiskbil|' + natt, 72, 64, 36, 60, (P) => {
    fyll(P, -26, -36, 26, -4, (X, Y) => (X === -26 || X === 26 ? 0x1e3a5a : tone([0x1e3a5a, 0x2a5aa8, 0x3a7bd5, 0x5890e8, 0x8ab4e8], 0.55 - (X + 26) * 0.003 + (Y > -10 ? -0.15 : 0), X, Y)));
    P.rect(-20, -28, 28, 14, natt ? 0xffe8a0 : 0xb8e4f4); P.box(-20, -28, 28, 14, VIT[3]); P.rect(-22, -14, 32, 3, TRA[3]);
    for (let j = 0; j < 6; j++) for (let i = -30 + j; i < 30 - j; i++) P.px(i, -44 + j, ((i + 30) / 6 | 0) % 2 ? 0xf4f1ea : 0xd8343c);   // markis
    P.rect(-1, -26, 3, 4, 0x3a2a2a); P.px(0, -26, 0xf0cfae); P.rect(-2, -22, 5, 2, 0xf4f1ea);
    for (const wx of [-18, 14]) { P.rect(wx, -4, 6, 5, 0x1c1a20); P.px(wx + 2, -2, 0x8a8a94); }   // hjulen
    P.rect(26, -20, 4, 3, 0x8a8a94); P.rect(-30, -20, 4, 3, 0x8a8a94);
    const s = $t('FISK & CHIPS'), tw = textW(SMALL, s); P.rect(-(tw >> 1) - 3, -36, tw + 6, 9, 0xf4f1ea); text(P, SMALL, s, -(tw >> 1), -34, 0xd8343c);
    spr(P, 12, -12, ['.kkkk.', 'kkkkkk', 'kgkgkk', '.kkkk.'], { k: 0xf0c030, g: 0xd8a040 }); P.rect(-16, -12, 8, 5, 0xf4f1ea); P.rect(-15, -11, 6, 3, 0xe0b040);   // en strut pommes och en fisk
  }), x, y);
}
export function ritaTrailer(ctx, T, natt) {
  skugga(ctx, T.x, T.y, 50);
  put(ctx, bild('trailer|' + T.typ, 64, 40, 32, 36, (P) => {
    P.rect(-24, -8, 48, 2, JARN[2]); P.hl(-24, -8, 48, JARN[3]); P.rect(24, -7, 8, 1, JARN[2]); for (const wx of [-14, 10]) { P.rect(wx, -6, 6, 6, 0x1c1a20); P.px(wx + 2, -4, 0x8a8a94); }
    const motor = T.typ === 'motor', hull = motor ? [0xc8ccd4, 0xf4f4f6] : [0x5e3a20, 0x86562e];
    for (let x = -20; x <= 20; x++) { const t = -22 + Math.round(Math.pow(Math.abs(x) / 20, 2) * 4), b = -9 - Math.round(Math.pow(Math.abs(x) / 20, 2.2) * 4); for (let y = t; y <= b; y++) P.px(x, y, y === t ? (motor ? 0xffffff : TRA[4]) : y > b - 3 ? (motor && y === b - 1 ? 0x2a5ad0 : hull[0]) : hull[1]); }
    if (motor) { P.rect(-8, -30, 14, 8, 0xf4f4f6); P.hl(-8, -31, 14, 0xffffff); P.rect(-6, -28, 4, 3, 0x6a8ab0); P.rect(2, -28, 3, 3, 0x6a8ab0); P.rect(18, -16, 4, 7, 0x2a2a30); } else { P.line(-14, -16, 14, -19, TRA[4]); P.line(-14, -15, 14, -18, TRA[2]); }
    const s = `${BATTYPER[T.typ].namn} ${BATTYPER[T.typ].pris} kr`; void s;
  }), T.x, T.y);
}
export function ritaKran(ctx) {
  const { x, y } = KRAN;
  skugga(ctx, x, y, 30);
  put(ctx, bild('kran', 120, 110, 40, 106, (P) => {
    P.rect(-14, -10, 28, 10, 0xd8a030); P.hl(-14, -10, 28, 0xf0c060); for (const wx of [-12, -2, 8]) { P.rect(wx, -3, 5, 4, 0x1c1a20); P.px(wx + 2, -1, 0x8a8a94); }   // underredet på räls
    for (let y = -100; y < -10; y++) { P.px(-4, y, 0xd8a030); P.px(4, y, 0xd8a030); if ((y + 100) % 8 === 0) P.hl(-4, y, 9, 0xb88020); if ((y + 100) % 8 === 4) P.line(-4, y, 4, y + 4, 0xb88020); }   // masten (fackverk)
    P.rect(-8, -100, 16, 6, 0x3a3a42); P.rect(-10, -106, 20, 6, 0xf4f1ea); P.rect(-8, -105, 7, 4, 0x6a8ab0);   // hytten
    for (let i = 0; i < 70; i++) { const yy = -96 - Math.round(i * 0.12); P.px(6 + i, yy, 0xd8a030); P.px(6 + i, yy + 3, 0xd8a030); if (i % 6 === 0) P.vl(6 + i, yy, 4, 0xb88020); }   // bommen
    for (let i = 0; i < 30; i++) P.px(-8 - i, -94 + Math.round(i * 0.6), 0xd8a030);   // motvikten
    P.rect(-40, -78, 12, 8, 0x3a3a42);
    P.vl(70, -100, 50, 0x3a3a42); P.rect(66, -50, 9, 5, 0x3a3a42); P.rect(60, -45, 20, 14, 0xa84c34); P.hl(60, -45, 20, 0xc06448); for (let x = 62; x < 80; x += 4) P.vl(x, -44, 12, 0x8a3a28);   // kroken med en container
  }), x, y);
}
export function ritaAnkare(ctx) {
  const { x, y } = ANKARE;
  skugga(ctx, x, y, 30);
  put(ctx, bild('ankare', 40, 50, 20, 46, (P) => {
    P.rect(-14, -8, 28, 8, STEN[2]); P.hl(-14, -8, 28, STEN[4]); P.rect(-14, -1, 28, 1, STEN[0]);   // sockeln
    P.rect(-1, -42, 3, 32, 0x2a2a30); P.rect(-9, -36, 19, 3, 0x2a2a30); for (let a = 0; a < 20; a++) { const an = Math.PI * (0.1 + a / 20 * 0.8); P.px(Math.round(-Math.cos(an) * 11), -10 - Math.round(Math.sin(an) * 9) + 0, 0x2a2a30); P.px(Math.round(-Math.cos(an) * 11), -9 - Math.round(Math.sin(an) * 9), 0x3a3a42); }
    P.px(-12, -14, 0x2a2a30); P.px(12, -14, 0x2a2a30); P.px(-11, -16, 0x2a2a30); P.px(11, -16, 0x2a2a30);
    for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; P.px(Math.round(Math.cos(an) * 3), -44 + Math.round(Math.sin(an) * 3), 0x2a2a30); }   // ringen
    P.rect(-6, -6, 12, 4, MASS[3]); P.hl(-5, -5, 10, MASS[1]);   // plaketten
  }), x, y);
}
export function ritaPollare(ctx, x, y) { skugga(ctx, x, y, 8); R(ctx, '#1c2026', x - 3, y - 9, 6, 9); R(ctx, '#434b56', x - 3, y - 9, 2, 9); R(ctx, '#1c2026', x - 4, y - 11, 8, 3); R(ctx, '#646e7a', x - 4, y - 11, 8, 1); R(ctx, '#8a6236', x - 6, y - 7, 2, 1); R(ctx, '#8a6236', x + 4, y - 7, 2, 1); }
export function ritaHamnlykta(ctx, x, y, natt) { skugga(ctx, x, y, 6); R(ctx, '#1c2026', x - 1, y - 34, 3, 34); R(ctx, '#434b56', x, y - 34, 1, 32); R(ctx, '#1c2026', x - 4, y - 42, 9, 9); R(ctx, natt ? '#ffe8a0' : '#d8e8f0', x - 3, y - 41, 7, 7); R(ctx, natt ? '#fff6d0' : '#eef4f8', x - 1, y - 40, 2, 5); R(ctx, '#1c2026', x - 2, y - 44, 5, 2); R(ctx, '#1c2026', x - 5, y - 2, 11, 2); }
export function ritaLada(ctx, x, y, k = 0) { skugga(ctx, x, y, 14); put(ctx, bild('lada|' + (k % 3), 18, 16, 9, 14, (P) => { const c = [0x3a7bd5, 0x8a9098, 0xd8343c][k % 3]; fyll(P, -7, -10, 7, 0, (X, Y) => (Y === -10 ? mix(c, 0xffffff, 0.3) : X === 7 ? mul(c, 0.7) : (Y % 3 === 1 && X > -6 && X < 6) ? mul(c, 0.85) : c)); for (let i = 0; i < 4; i++) spr(P, -6 + i * 3, -13, ['k.kk', 'kkkw'], { k: 0x9ab8d0, w: 0x1a1414 }); P.hl(-7, -11, 15, 0xe8f4f8, 0.8); }), x, y); }
export function ritaTina(ctx, x, y) { skugga(ctx, x, y, 12); put(ctx, bild('tina', 16, 14, 8, 12, (P) => { for (let j = 0; j < 10; j++) { const hw = 6 - (j < 3 ? (3 - j) : 0); for (let i = -hw; i <= hw; i++) P.px(i, -10 + j, ((i + j) % 3 === 0) ? 0x5e3a20 : (j % 2 ? 0xa87848 : 0x86562e)); } P.rect(-2, -9, 4, 2, 0x8aa0a8, 0.6); P.px(0, -11, 0xd8343c); }), x, y); }
export function ritaNatstall(ctx, x, y) { skugga(ctx, x, y, 36); put(ctx, bild('nat', 40, 34, 20, 32, (P) => { P.rect(-18, -30, 2, 30, TRA[1]); P.rect(16, -30, 2, 30, TRA[1]); P.hl(-18, -30, 36, TRA[3]); for (let i = -16; i < 16; i++) for (let j = 0; j < 22; j++) { const sag = Math.round(Math.sin((i + 16) / 32 * Math.PI) * 5); if ((i + j) % 3 === 0 && j < 20 - sag + 5) P.px(i, -28 + j + sag, 0x6a7a8a, 0.75); } for (let k = 0; k < 4; k++) P.rect(-12 + k * 8, -24 + (k % 2) * 6, 2, 2, 0xf0c030); }), x, y); }
export function ritaTunna(ctx, x, y) { skugga(ctx, x, y, 10); put(ctx, bild('tunna', 12, 16, 6, 14, (P) => { fyll(P, -4, -12, 4, 0, (X, Y) => (Y === -12 ? TRA[4] : X === -4 || X === 4 ? TRA[1] : (Y === -8 || Y === -3) ? JARN[3] : tone(TRA, 0.55 - (X + 4) * 0.03, X, Y))); P.px(-2, -11, TRA[4]); }), x, y); }
export function ritaRep(ctx, x, y) { skugga(ctx, x, y, 12, 0.15); for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; R(ctx, a % 3 ? '#c8b890' : '#a89868', x + Math.round(Math.cos(an) * 5), y - 2 + Math.round(Math.sin(an) * 2.5), 1, 1); R(ctx, a % 3 ? '#c8b890' : '#a89868', x + Math.round(Math.cos(an) * 3), y - 3 + Math.round(Math.sin(an) * 1.5), 1, 1); } R(ctx, '#c8b890', x + 4, y - 1, 4, 1); }
export function ritaPirstolpe(ctx, x, y) { R(ctx, '#3a3a42', x - 1, y - 12, 3, 12); R(ctx, '#646e7a', x, y - 12, 1, 10); R(ctx, '#1c2026', x - 2, y - 13, 5, 2); }
export function ritaKatting(ctx, x0, x1, y) { for (let x = x0; x < x1; x += 2) R(ctx, '#3a3a42', x, y - 8 + Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 3), 1, 1); }
export function ritaBoj(ctx, x, y, c = '#d8343c', t = 0) { const b = Math.round(Math.sin(t * 1.4 + x) * 1); R(ctx, c, x - 3, y - 7 + b, 6, 6); R(ctx, '#f4f1ea', x - 3, y - 5 + b, 6, 1); R(ctx, '#1c2026', x - 1, y - 9 + b, 2, 2); R(ctx, 'rgba(255,255,255,.35)', x - 5, y + b, 10, 1); }
export function ritaSkylt(ctx) {
  const { x, y } = SKYLT, s = $t('FISKEHAMNEN'), w = textW(SMALL, s) + 20;
  skugga(ctx, x, y, 6); R(ctx, '#5a5e66', x - 1, y - 22, 2, 22); R(ctx, '#1e3a5a', x - (w >> 1) - 1, y - 37, w + 2, 16); R(ctx, '#f4ecd8', x - (w >> 1), y - 36, w, 14);
  ctxText(ctx, SMALL, s, x - (w >> 1) + 11, y - 33, '#1e3a5a'); spr2(ctx, x - (w >> 1) + 3, y - 32, ['.k.', 'kkk', '.k.', 'kkk'], '#2a5aa8');
}
const spr2 = (ctx, x, y, rows, c) => { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'k') R(ctx, c, x + i, y + j, 1, 1); }); };
export function ritaHallplats(ctx, x, y) { R(ctx, '#1c2026', x, y - 26, 2, 26); R(ctx, '#2a5aa8', x - 6, y - 34, 14, 9); R(ctx, '#f4ecd8', x - 5, y - 33, 12, 7); R(ctx, '#2a5aa8', x - 3, y - 31, 8, 1); R(ctx, '#2a5aa8', x - 3, y - 29, 6, 1); R(ctx, '#2a5aa8', x - 3, y - 28, 8, 1); }

// ---------- båtarna (foten = vattenlinjen mitt under skrovet; scenen guppar dem) ----------
export function ritaBat(ctx, b, t, natt) {
  const bob = Math.round(Math.sin(t * 1.1 + b.x * 0.01) * 1.5), y = b.y + bob;
  put(ctx, bild('bat|' + b.id, 90, 70, 45, 60, (P) => {
    const [mork, ljus] = b.farg;
    if (b.typ === 'trawler') {
      // skrovet: rak reling med språng (fören till höger reser sig), rundad köl, vit reling, röd vattenlinje
      for (let x = -34; x <= 34; x++) { const d = Math.pow(Math.abs(x) / 34, 2.4), top = -13 - (x > 20 ? Math.round((x - 20) / 3) : 0) + (x < -30 ? 1 : 0), bot = 2 - Math.round(d * 7); for (let yy = top; yy <= bot; yy++) P.px(x, yy, yy === top ? 0xf4f1ea : yy >= bot - 2 ? (yy === bot - 2 ? 0xf4f1ea : 0x8a1a1a) : x < -30 ? mul(mork, 0.8) : (yy < top + 5 ? ljus : mork)); }
      P.hl(-30, -9, 56, mix(mork, 0xffffff, 0.25)); P.rect(-33, -15, 3, 3, 0x1c1a20); P.px(31, -18, 0x1c1a20);   // avbärarlisten, pollarna i för och akter
      P.rect(-10, -30, 24, 16, 0xf4f1ea); P.hl(-10, -31, 24, 0xffffff); P.rect(-8, -27, 6, 5, 0x6a8ab0); P.rect(2, -27, 6, 5, 0x6a8ab0); P.vl(13, -30, 16, 0xc8ccd4); P.rect(-12, -32, 28, 2, mork);   // styrhytten
      P.vl(-20, -44, 30, 0x5a3a20); P.vl(-19, -44, 30, 0x86562e); P.line(-20, -44, 20, -30, 0xd8d0c0); P.rect(-22, -46, 6, 3, mork);   // masten och bommen
      P.rect(-26, -20, 12, 6, 0x6a7a8a, 0.8); for (let i = 0; i < 12; i += 2) for (let j = 0; j < 6; j += 2) P.px(-26 + i, -20 + j, 0x3a4a5a, 0.8);   // nätet på däck
      for (let k = 0; k < 3; k++) { P.px(-14 + k * 5, -9, 0xf0c030); P.rect(-15 + k * 5, -17 + (k % 2), 3, 3, 0xf0c030); }   // lådor och bojar
      if (b.namn) text(P, SMALL, b.namn, -6, -8, 0xf4f1ea);
      P.rect(22, -13, 3, 2, 0xd8343c); P.rect(28, -13, 3, 2, 0xd8343c);
    } else if (b.typ === 'snipa') {
      for (let x = -26; x <= 26; x++) { const d = Math.pow(Math.abs(x) / 26, 2.2), top = -10 - (Math.abs(x) > 18 ? Math.round((Math.abs(x) - 18) / 3) : 0), bot = 2 - Math.round(d * 6); for (let yy = top; yy <= bot; yy++) P.px(x, yy, yy === top ? 0xf4f1ea : yy >= bot - 1 ? 0x8a1a1a : (yy < top + 4 ? ljus : mork)); }
      P.rect(-6, -22, 14, 11, 0xf4f1ea); P.rect(-4, -20, 4, 4, 0x6a8ab0); P.rect(2, -20, 4, 4, 0x6a8ab0); P.rect(-7, -24, 16, 2, mork); P.vl(12, -32, 20, 0x5a3a20);
      P.rect(-20, -14, 8, 3, 0x6a7a8a, 0.8); P.px(-24, -9, 0xf0c030); if (b.namn) text(P, SMALL, b.namn, -22, -8, 0xf4f1ea);
    } else if (b.typ === 'segel') {
      for (let x = -24; x <= 24; x++) { const d = Math.pow(Math.abs(x) / 24, 2.2), top = -8 - (x > 14 ? Math.round((x - 14) / 3) : 0), bot = 2 - Math.round(d * 6); for (let yy = top; yy <= bot; yy++) P.px(x, yy, yy === top ? 0xffffff : yy >= bot - 1 ? 0x2a5aa8 : (yy < top + 3 ? mork : mul(mork, 0.9))); }
      P.vl(-2, -52, 44, 0xd8d0c0); P.vl(-1, -52, 44, 0xa8a090); P.line(-2, -52, -22, -8, 0xb8b0a0); P.line(-1, -52, 20, -9, 0xb8b0a0);
      P.rect(-1, -16, 18, 3, 0xf4f0e6); P.hl(-1, -16, 18, 0xffffff); P.rect(-14, -11, 8, 2, 0xe8443a); P.px(-2, -53, 0xd8343c); P.px(-3, -54, 0xd8343c);
      if (b.namn) text(P, SMALL, b.namn, -22, -7, 0x2a5aa8);
    } else {
      for (let x = -14; x <= 14; x++) { const d = Math.pow(Math.abs(x) / 14, 2.2), top = -6 - (Math.abs(x) > 10 ? 1 : 0), bot = 1 - Math.round(d * 4); for (let yy = top; yy <= bot; yy++) P.px(x, yy, yy === top ? TRA[4] : yy === bot ? TRA[0] : (yy < top + 3 ? ljus : mork)); }
      for (const tx of [-7, 0, 7]) P.vl(tx, -6, 5, TRA[4]); P.line(-12, -3, 12, -5, TRA[4]);
    }
    for (let x = -36; x <= 36; x++) P.px(x, 3, 0x0a1a2a, 0.35);
  }), b.x, y);
  // förtöjningen upp till pollaren och reflexen i vattnet
  ctx.strokeStyle = 'rgba(216,208,192,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x + 20, y - 8); ctx.quadraticCurveTo(b.x + 30, y - 26, b.x + 36, y - 34 + (y - b.y)); ctx.stroke();
  if (natt) { ctx.fillStyle = 'rgba(255,220,150,.14)'; ctx.fillRect(b.x - 10, y + 4, 20, 6); }
}
export function ritaMas(ctx, x, y, t, flyg = false) {
  const X = Math.round(x), Y = Math.round(y);
  if (flyg) { const up = Math.sin(t * 12 + x) > 0; R(ctx, '#f4f1ea', X - 1, Y, 3, 2); R(ctx, '#f4f1ea', X - 6, Y - (up ? 3 : 0), 5, 1); R(ctx, '#f4f1ea', X + 2, Y - (up ? 3 : 0), 5, 1); R(ctx, '#8a8a94', X - 6, Y - (up ? 2 : 1), 2, 1); R(ctx, '#8a8a94', X + 5, Y - (up ? 2 : 1), 2, 1); R(ctx, '#f0a030', X + 2, Y + 1, 1, 1); return; }
  R(ctx, '#f4f1ea', X - 3, Y - 5, 6, 4); R(ctx, '#8a8a94', X - 3, Y - 4, 4, 2); R(ctx, '#f4f1ea', X + 2, Y - 7, 3, 3); R(ctx, '#f0a030', X + 5, Y - 6, 2, 1); R(ctx, '#1c1a20', X + 3, Y - 7, 1, 1); R(ctx, '#f0a030', X - 2, Y - 1, 1, 1); R(ctx, '#f0a030', X, Y - 1, 1, 1);
}
export function ritaSal(ctx, x, y, k) {
  // sälen tittar upp: huvudet stiger (k 0–1) ur vattnet
  const Y = Math.round(y - k * 10);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 12, y - 14, 24, 14); ctx.clip();
  R(ctx, '#5a5a62', x - 5, Y, 10, 8); R(ctx, '#7a7a84', x - 4, Y, 8, 2); R(ctx, '#1c1a20', x - 3, Y + 2, 1, 1); R(ctx, '#1c1a20', x + 2, Y + 2, 1, 1); R(ctx, '#1c1a20', x - 1, Y + 4, 2, 1); R(ctx, '#f4f1ea', x - 4, Y + 5, 2, 1); R(ctx, '#f4f1ea', x + 2, Y + 5, 2, 1);
  ctx.restore();
  R(ctx, 'rgba(255,255,255,.3)', x - 8, y, 16, 1);
}
export function ritaRok(ctx, x, y, t) { for (let k = 0; k < 6; k++) { const u = ((t * 0.35 + k / 6) % 1); R(ctx, `rgba(200,200,210,${(0.5 * (1 - u)).toFixed(2)})`, x + Math.round(Math.sin(u * 6 + k) * 4), y - u * 40, 3 + Math.round(u * 4), 2); } }
