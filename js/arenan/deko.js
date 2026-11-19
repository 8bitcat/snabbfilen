// 🏟️ ARENANS HUS OCH REKVISITA – ritas y-sorterat av scenen (js/scenes/arenan.js): PIXEL ARENA (läktaren med valvbågar,
// tornen, storbildsskärmen, KBK-flaggorna och huvudentrén), SPORTAFFÄREN (skyltfönster med bollar och skridskor),
// SIMHALLEN (glasfasad, vågen på taket), biljettluckan, statyn av KBK-legendaren, fikakiosken, varmkorvsvagnen,
// flaggstängerna med vajande KBK-flaggor, skridskobanans sarg med grind och strålkastare, chokladkiosken, KBK-planens
// bur och mål, skridskor på fötterna, fotbollen och skylten. Cachade bilder (origo = foten), ett pixelkorn.
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { HUS, KBK, BILJETT, STATY, FIKAT, KORV, RINK, PLAN, CHOKLAD, SKYLT, HALLPLATS } from './karta.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, ZINK, STEN, TRA } = FARGER;
const BETONG = [0x6a6e74, 0x8a8e94, 0xa8acb2, 0xc0c4ca, 0xd8dce0];
const GLAS = [0x2a4a6a, 0x3a6a94, 0x5a94c0, 0x8ab8dc, 0xb8dcf0];
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w, a = 0.24) => { ctx.fillStyle = `rgba(20,12,30,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function fonster(P, x, y, w, h, natt, ram = VIT[3]) { P.rect(x - 1, y - 1, w + 2, h + 2, ram); P.rect(x, y, w, h, natt ? 0xffe8a0 : 0x6a8ab0); if (!natt) { P.px(x, y, 0xb8d8f0); P.px(x + 1, y, 0xb8d8f0); } }
function skylt(P, x, y, s, bg, fg) { const w = textW(SMALL, s) + 8; P.rect(x - (w >> 1), y, w, 9, bg); P.box(x - (w >> 1), y, w, 9, mul(bg, 0.6)); text(P, SMALL, s, x - (w >> 1) + 4, y + 2, fg); }

// ---------- husen (fasaden står på BASE) ----------
export function husBild(id, natt) {
  const Hs = HUS[id];
  return bild(`hus|${id}|${natt}`, Hs.w + 20, Hs.h + 70, 10, Hs.h + 66, (P) => {
    const w = Hs.w, h = Hs.h, cx = w >> 1;
    if (Hs.typ === 'sport') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => (X === 0 || X === w - 1 ? 0x1a2a4a : tone([0x1e3a5a, 0x2a5080, 0x3a6aa8, 0x5a8ac8, 0x8ab4e0], 0.5 - (X / w) * 0.06 + (Y % 12 === 11 ? -0.15 : 0), X, Y)));
      P.rect(-4, -h - 6, w + 8, 6, 0xf4f1ea); P.hl(-4, -h - 6, w + 8, 0xffffff); P.rect(-4, -h, w + 8, 2, 0x1a2a4a);
      for (const fx of [12, w - 92]) { P.rect(fx - 2, -h + 30, 84, 56, VIT[3]); P.rect(fx, -h + 32, 80, 52, natt ? 0x3a3a52 : 0xa8d0ec); if (!natt) P.line(fx + 4, -h + 36, fx + 30, -h + 60, 0xffffff, 0.3);
        for (let k = 0; k < 4; k++) { const bx = fx + 8 + k * 18; for (let a = 0; a < 20; a++) { const an = a / 20 * Math.PI * 2; P.px(bx + 5 + Math.round(Math.cos(an) * 5), -h + 62 + Math.round(Math.sin(an) * 5), k === 1 ? 0xf0c030 : 0x1a1414); } P.rect(bx + 3, -h + 60, 5, 5, k === 1 ? 0xf0c030 : 0xf4f1ea); }   // bollar
        for (let k = 0; k < 3; k++) { P.rect(fx + 10 + k * 22, -h + 42, 12, 8, [KBK.rod, 0x3a7bd5, 0x46a35a][k]); P.hl(fx + 10 + k * 22, -h + 42, 12, 0xf4f1ea); P.rect(fx + 8 + k * 22, -h + 50, 16, 2, [KBK.rod, 0x3a7bd5, 0x46a35a][k]); }   // tröjor
        P.rect(fx + 56, -h + 72, 18, 4, 0x3a3a42); P.rect(fx + 56, -h + 76, 18, 2, 0xc8ccd4); P.rect(fx + 58, -h + 66, 14, 6, 0xf4f1ea); }   // skridskor
      P.rect(Hs.door.x0 - Hs.x, -34, Hs.door.x1 - Hs.door.x0, 34, 0x8ab4d8); P.vl(Hs.door.x0 - Hs.x + ((Hs.door.x1 - Hs.door.x0) >> 1), -34, 34, 0x1a2a4a); P.px(Hs.door.x0 - Hs.x + 4, -16, MASS[3]);
      skylt(P, cx, -h + 10, $t('SPORTAFFÄREN'), 0xf4f1ea, 0x1e3a5a);
      spr(P, cx - 30, -h + 10, ['..kk..', '.kkkk.', 'kkwwkk', 'kkwwkk', '.kkkk.', '..kk..'], { k: 0x1a1414, w: 0xf4f1ea }); spr(P, cx + 24, -h + 10, ['..kk..', '.kkkk.', 'kkwwkk', 'kkwwkk', '.kkkk.', '..kk..'], { k: 0x1a1414, w: 0xf4f1ea });
    } else if (Hs.typ === 'arena') {
      // läktarens fasad i betong med valvbågar, två torn, storbildsskärmen, KBK-flaggorna och huvudentrén med glasdörrar
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(BETONG, 0.55 - (X / w) * 0.05 + ((Y + h) % 30 === 29 ? -0.2 : 0) + (hash(X >> 3, Y >> 3, 3) - 0.5) * 0.08, X, Y));
      for (let k = 0; k < 9; k++) { const ax = 28 + k * 86, aw = 56; fyll(P, ax, -h + 60, ax + aw, -2, (X, Y) => { const u = (X - ax) / aw; if (Y < -h + 60 + 28 && Math.hypot((u - 0.5) * 2, (Y + h - 88) / 28) > 1) return null; return k === 4 ? null : (Y % 9 === 8 ? 0x1a1414 : mix(0x2a2a34, 0x3a3a48, hash(X >> 2, Y >> 2, 4) * 0.5)); }); if (k !== 4) { P.rect(ax + 10, -h + 96, 36, 2, 0x5a5a66); fonster(P, ax + 16, -h + 100, 24, 10, natt, 0x3a3a42); } }   // valvbågarna med fönster
      // huvudentrén: glasdörrar under baldakinen
      const dx = Hs.door.x0 - Hs.x, dw = Hs.door.x1 - Hs.door.x0;
      P.rect(dx - 16, -46, dw + 32, 46, 0x1e1e26); P.rect(dx - 14, -44, dw + 28, 44, natt ? 0x4a4a62 : 0x8ab4d8); for (let x = dx - 14; x < dx + dw + 14; x += 12) P.vl(x, -44, 44, 0x1e1e26); P.hl(dx - 14, -22, dw + 28, 0x1e1e26);
      P.rect(dx - 24, -52, dw + 48, 6, KBK.rod); P.hl(dx - 24, -52, dw + 48, KBK.rodL); text(P, SMALL, $t('ENTRÉ'), dx + (dw >> 1) - (textW(SMALL, $t('ENTRÉ')) >> 1), -50, 0xf4f1ea);
      // tornen i ändarna
      for (const tx of [-6, w - 30]) { fyll(P, tx, -h - 30, tx + 36, 0, (X, Y) => (X === tx || X === tx + 35 ? 0x4a4e56 : tone(BETONG, 0.5 + ((Y + h) % 16 === 15 ? -0.2 : 0), X, Y))); P.rect(tx + 2, -h - 36, 32, 6, KBK.rod); P.hl(tx + 2, -h - 36, 32, KBK.rodL); for (let fy = -h - 20; fy < -20; fy += 24) fonster(P, tx + 12, fy, 12, 10, natt, 0x3a3a42); }
      // storbildsskärmen över entrén
      P.rect(cx - 90, -h + 8, 180, 46, 0x1a1a22); P.box(cx - 90, -h + 8, 180, 46, 0x5a5a66); P.rect(cx - 86, -h + 12, 172, 38, natt ? 0x1e3a5a : 0x244a74);
      for (let y = 0; y < 38; y += 2) for (let x = 0; x < 172; x += 2) if (hash(x, y, 5) > 0.5) P.px(cx - 86 + x, -h + 12 + y, 0x2a5a8a, 0.5);
      { const s = 'KBK', tw = textW(SMALL, s); text(P, SMALL, s, cx - 60 - (tw >> 1), -h + 22, 0xf4f1ea); text(P, SMALL, '2 – 1', cx - (textW(SMALL, '2 – 1') >> 1), -h + 22, 0xf0c030); text(P, SMALL, 'FC PIX', cx + 56 - (textW(SMALL, 'FC PIX') >> 1), -h + 22, 0xf4f1ea); text(P, SMALL, $t('MATCHDAG'), cx - (textW(SMALL, $t('MATCHDAG')) >> 1), -h + 36, 0xf4f1ea); }
      // flaggorna på taket, skylten PIXEL ARENA
      for (let k = 0; k < 7; k++) { const fx = 60 + k * 100; P.vl(fx, -h - 26, 26, 0x3a3a42); P.rect(fx + 1, -h - 25, 14, 9, k % 2 ? KBK.rod : KBK.svart); P.rect(fx + 1, -h - 21, 14, 2, k % 2 ? KBK.svart : KBK.rod); }
      { const s = $t('PIXEL ARENA'), tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 10, -h - 14, tw + 20, 14, 0x1a1414); P.box(cx - (tw >> 1) - 10, -h - 14, tw + 20, 14, KBK.rod); text(P, SMALL, s, cx - (tw >> 1), -h - 10, 0xf4f1ea); }
      for (let x = 4; x < w - 4; x += 2) P.px(x, -h - 1, 0xffffff, 0.5);
    } else if (Hs.typ === 'simhall') {
      // glasfasad i blått, vit betongram, vågen och skylten på taket, blå entrédörr
      fyll(P, 0, -h, w - 1, 0, (X, Y) => (X % 20 === 19 || (Y + h) % 20 === 19 ? 0xf4f1ea : tone(GLAS, natt ? 0.45 : 0.6 - (X / w) * 0.1 + ((X + Y) % 37 === 0 ? 0.25 : 0), X, Y)));
      P.rect(-4, -h - 8, w + 8, 8, 0xf4f1ea); P.hl(-4, -h - 8, w + 8, 0xffffff); P.rect(-4, -2, w + 8, 2, 0xf4f1ea);
      for (let x = 0; x < 60; x++) { const yy = -h - 14 - Math.round(Math.sin(x / 60 * Math.PI * 2) * 6); P.rect(cx - 30 + x, yy, 1, 4, 0x3a7bd5); P.px(cx - 30 + x, yy, 0x8ab4e8); }   // vågen
      skylt(P, cx, -h - 26, $t('SIMHALLEN'), 0x3a7bd5, 0xf4f1ea);
      P.rect(Hs.door.x0 - Hs.x, -36, Hs.door.x1 - Hs.door.x0, 36, 0x2a5aa8); P.hl(Hs.door.x0 - Hs.x, -36, Hs.door.x1 - Hs.door.x0, 0x5890e8); P.vl(Hs.door.x0 - Hs.x + ((Hs.door.x1 - Hs.door.x0) >> 1), -36, 36, 0x1a2a4a); P.px(Hs.door.x0 - Hs.x + 6, -18, MASS[3]);
      if (!natt) { P.rect(20, -h + 30, 40, 20, 0x5aa0d8, 0.6); P.rect(w - 60, -h + 30, 40, 20, 0x5aa0d8, 0.6); for (let k = 0; k < 6; k++) P.px(26 + k * 6, -h + 36, 0xffffff); }   // bassängen skymtar genom glaset
      spr(P, 30, -h + 60, ['...kk...', '..kkkk..', '.kkkkkk.', 'kkkkkkkk', '..kkkk..', '.kk..kk.'], { k: 0xf4f1ea }); spr(P, w - 40, -h + 60, ['.......k', '....kkkk', '.kkkkkkk', 'kkkkkkk.', '.kkkk...', '..kk....'], { k: 0xf4f1ea });   // badhjälpar-ikoner
    }
    for (let x = 0; x < w; x++) P.px(x, 1, 0x000000, 0.25);
  });
}
export function ritaHus(ctx, id, natt, baseY) { const Hs = HUS[id]; put(ctx, husBild(id, natt), Hs.x + 10, baseY + 4); }

// ---------- torget ----------
export function ritaBiljett(ctx, natt) {
  const { x, y } = BILJETT;
  skugga(ctx, x, y, 34);
  put(ctx, bild('biljett|' + natt, 48, 60, 24, 56, (P) => {
    fyll(P, -15, -36, 15, 0, (X, Y) => (X === -15 || X === 15 ? 0x4a1414 : tone([0x4a1414, KBK.rod, KBK.rodL, 0xc04a58, 0xd87080], 0.5 - (X + 15) * 0.006 + (Y % 7 === 0 ? -0.15 : 0), X, Y)));
    for (let j = 0; j < 5; j++) P.hl(-18 + j, -41 + j, 37 - j * 2, j === 4 ? 0x1a1414 : j % 2 ? 0xf4f1ea : KBK.svart);
    P.rect(-10, -30, 20, 14, natt ? 0xffe8a0 : 0xb8e4f4); P.box(-10, -30, 20, 14, VIT[3]); P.hl(-10, -16, 20, TRA[3]);
    P.rect(-2, -27, 4, 5, 0x3a2a2a); P.px(-1, -27, 0xf0cfae); P.px(0, -27, 0xf0cfae); P.rect(-2, -24, 4, 2, KBK.rod);
    const s = $t('BILJETTER'), w = textW(SMALL, s) + 6; P.rect(-(w >> 1), -50, w, 9, 0xf4f1ea); P.box(-(w >> 1), -50, w, 9, KBK.rod); text(P, SMALL, s, -(w >> 1) + 3, -48, KBK.rod);
  }), x, y);
}
export function ritaStaty(ctx) {
  const { x, y } = STATY;
  skugga(ctx, x, y, 30);
  put(ctx, bild('staty', 40, 70, 20, 66, (P) => {
    P.rect(-14, -12, 28, 12, STEN[2]); P.hl(-14, -12, 28, STEN[4]); P.rect(-14, -1, 28, 1, STEN[0]); P.rect(-10, -8, 20, 5, MASS[2]); P.hl(-9, -7, 18, MASS[1]);   // sockeln med plaketten
    const B = [0x3a4a38, 0x4a5e48, 0x5a7258, 0x6e8a6a];   // ärgad brons
    P.rect(-3, -50, 7, 14, B[2]); P.rect(-3, -50, 2, 14, B[3]); P.rect(-5, -48, 2, 9, B[2]); P.rect(5, -52, 2, 11, B[2]); P.px(6, -53, B[2]);   // kroppen, armarna
    for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; P.px(Math.round(Math.cos(an) * 4), -56 + Math.round(Math.sin(an) * 4), B[1]); } P.rect(-3, -59, 7, 6, B[2]); P.px(-2, -57, B[0]); P.px(2, -57, B[0]);   // huvudet
    P.rect(-3, -36, 3, 12, B[1]); P.rect(1, -36, 3, 10, B[2]); P.rect(3, -27, 5, 3, B[1]);   // benen, sparkande fot
    for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; P.px(10 + Math.round(Math.cos(an) * 3), -26 + Math.round(Math.sin(an) * 3), B[3]); } P.px(10, -26, B[0]);   // bollen
  }), x, y);
}
export function ritaKiosk(ctx, K, typ, natt) {
  const { x, y } = K;
  skugga(ctx, x, y, 44);
  put(ctx, bild('kiosk|' + typ + natt, 64, 66, 32, 62, (P) => {
    const A1 = typ === 'fika' ? 0x3a7bd5 : 0x8a4a2a, A2 = 0xf4f1ea;
    fyll(P, -20, -34, 20, 0, (X, Y) => (X === -20 || X === 20 ? 0x5a3a20 : tone([0x5a3a20, 0x86562e, 0xae7640, 0xd29a5c, 0xe8b880], 0.55 - (X + 20) * 0.004 + ((X % 6) === 0 ? -0.12 : 0), X, Y)));
    P.rect(-14, -28, 28, 12, natt ? 0xffe8a0 : 0xb8e4f4); P.box(-14, -28, 28, 12, VIT[3]); P.rect(-16, -16, 32, 3, TRA[3]); P.hl(-16, -16, 32, TRA[4]);
    for (let j = 0; j < 7; j++) for (let i = -24 + j; i < 24 - j; i++) P.px(i, -42 + j, ((i + 24) / 6 | 0) % 2 ? A2 : A1);
    P.hl(-24, -35, 48, mul(A1, 0.6)); for (let i = -24; i < 24; i += 6) P.px(i + 3, -34, A1);
    P.rect(-1, -30, 3, 4, 0x3a2a2a); P.px(0, -30, 0xf0cfae); P.px(1, -30, 0xf0cfae); P.rect(-2, -26, 5, 2, A1);
    const s = typ === 'fika' ? $t('FIKAT') : $t('VARM CHOKLAD'), w = textW(SMALL, s); P.rect(-(w >> 1) - 3, -50, w + 6, 8, 0xf4f1ea); text(P, SMALL, s, -(w >> 1), -48, A1);
    if (typ === 'fika') { P.rect(-10, -14, 5, 4, 0xf4f1ea); P.rect(-4, -14, 6, 3, 0xd8a050); P.rect(4, -14, 5, 4, 0x3a7bd5); } else { P.rect(-8, -14, 5, 4, 0xf4f1ea); P.px(-7, -15, 0xf4f1ea); P.rect(2, -14, 6, 4, 0x6a4a2a); P.hl(2, -15, 6, 0xf4f1ea); }
  }), x, y);
}
export function ritaKorvgubbe(ctx, t) {
  const { x, y } = KORV;
  skugga(ctx, x, y, 26);
  put(ctx, bild('korvvagn', 36, 40, 18, 36, (P) => { P.rect(-12, -18, 24, 12, 0xf4f1ea); P.hl(-12, -18, 24, 0xffffff); P.rect(-12, -7, 24, 2, 0xd8343c); for (const wx of [-9, 6]) { P.rect(wx, -4, 4, 4, 0x1c1a20); P.px(wx + 1, -3, 0x8a8a94); } P.rect(-10, -24, 20, 6, 0x3a3a42); P.hl(-10, -24, 20, 0x6a6a72); P.rect(-8, -23, 16, 4, 0xd8a050); for (let k = 0; k < 4; k++) P.rect(-7 + k * 4, -22, 3, 2, 0xc8663a); P.vl(-12, -34, 16, 0x3a3a42); P.vl(11, -34, 16, 0x3a3a42); for (let i = -14; i < 14; i++) P.rect(i, -36, 1, 3 + ((i + 14) % 4 === 0 ? 1 : 0), ((i + 14) / 4 | 0) % 2 ? 0xd8343c : 0xf4f1ea); }), x, y);
  if (Math.floor(t * 2) % 3 === 0) R(ctx, 'rgba(255,255,255,.5)', x + 2, y - 28 - (Math.floor(t * 4) % 3), 1, 2);
}
export function ritaFlagga(ctx, x, y, t) {
  skugga(ctx, x, y, 8);
  R(ctx, '#c8ccd4', x - 1, y - 70, 3, 70); R(ctx, '#f4f1ea', x, y - 70, 1, 68); R(ctx, '#e6be4c', x - 2, y - 73, 5, 3);
  for (let i = 0; i < 22; i++) { const sv = Math.round(Math.sin(t * 5 + i * 0.4) * 1.5), h = 12 - Math.round(i * 0.25); R(ctx, (i >> 2) % 2 ? hex(KBK.rod) : hex(KBK.svart), x + 2 + i, y - 66 + sv - (h >> 1) + 6, 1, h); }
}
// skridskobanans sarg: framsidan (södra) och kortsidorna ritas av scenen y-sorterat; norra sargen med grinden
export function ritaSarg(ctx, sida) {
  const { x0, y0, x1, y1, grind } = RINK;
  const rail = (xa, xb, y) => { R(ctx, '#f4f1ea', xa, y - 10, xb - xa, 10); R(ctx, '#ffffff', xa, y - 10, xb - xa, 1); R(ctx, '#d8343c', xa, y - 4, xb - xa, 2); R(ctx, '#2a5aa8', xa, y - 7, xb - xa, 1); R(ctx, '#c8ccd4', xa, y - 1, xb - xa, 1); for (let x = xa; x < xb; x += 16) R(ctx, '#8a8e94', x, y - 10, 1, 10); };
  if (sida === 'norr') { rail(x0, grind[0], y0 + 2); rail(grind[1], x1, y0 + 2); R(ctx, '#3a3a42', grind[0] - 1, y0 - 12, 2, 14); R(ctx, '#3a3a42', grind[1] - 1, y0 - 12, 2, 14); R(ctx, '#f4f1ea', grind[0] + 1, y0 - 10, 2, 8); }
  else if (sida === 'soder') rail(x0, x1, y1 + 2);
  else { for (let y = y0; y < y1; y++) { R(ctx, '#f4f1ea', x0 - 2, y, 3, 1); R(ctx, '#f4f1ea', x1 - 1, y, 3, 1); if (y % 16 === 0) { R(ctx, '#8a8e94', x0 - 2, y, 3, 1); R(ctx, '#8a8e94', x1 - 1, y, 3, 1); } } }
}
export function ritaStralkastare(ctx, x, y, natt) { skugga(ctx, x, y, 8); R(ctx, '#3a3a42', x - 1, y - 60, 3, 60); R(ctx, '#646e7a', x, y - 60, 1, 58); R(ctx, '#1c2026', x - 6, y - 68, 13, 8); for (let k = 0; k < 3; k++) R(ctx, natt ? '#fff0a0' : '#c8ccd4', x - 5 + k * 4, y - 66, 3, 4); R(ctx, '#1c2026', x - 4, y - 2, 9, 2); }
export function ritaBur(ctx, sida) {
  const { x0, y0, x1, y1, grind } = PLAN;
  const net = (xa, xb, y, h) => { for (let x = xa; x < xb; x += 3) R(ctx, 'rgba(140,150,160,.55)', x, y - h, 1, h); for (let yy = y - h; yy < y; yy += 3) R(ctx, 'rgba(140,150,160,.55)', xa, yy, xb - xa, 1); for (let x = xa; x <= xb; x += 24) R(ctx, '#3a4a3a', x - 1, y - h - 2, 2, h + 2); R(ctx, '#3a4a3a', xa, y - h - 2, xb - xa, 1); };
  if (sida === 'norr') { net(x0, grind[0], y0 + 2, 28); net(grind[1], x1, y0 + 2, 28); R(ctx, '#3a4a3a', grind[0] - 1, y0 - 28, 2, 30); R(ctx, '#3a4a3a', grind[1] - 1, y0 - 28, 2, 30); }
  else if (sida === 'soder') net(x0, x1, y1 + 2, 28);
  else { for (let y = y0; y < y1; y += 3) { R(ctx, 'rgba(140,150,160,.55)', x0 - 1, y, 1, 1); R(ctx, 'rgba(140,150,160,.55)', x1, y, 1, 1); } for (let y = y0 - 28; y < y0; y += 3) { R(ctx, 'rgba(140,150,160,.55)', x0 - 1, y, 1, 1); R(ctx, 'rgba(140,150,160,.55)', x1, y, 1, 1); } }
}
export function ritaMal(ctx) {
  const { x, y } = PLAN.mal;
  skugga(ctx, x, y + 22, 12, 0.15);
  R(ctx, '#f4f1ea', x - 1, y - 24, 3, 48); R(ctx, '#f4f1ea', x - 1, y - 24, 12, 3); R(ctx, '#f4f1ea', x - 1, y + 21, 12, 3); R(ctx, '#f4f1ea', x + 9, y - 24, 3, 48);
  for (let yy = y - 22; yy < y + 22; yy += 3) for (let xx = x + 2; xx < x + 10; xx += 3) R(ctx, 'rgba(244,241,234,.5)', xx, yy, 1, 1);
}
export function ritaBoll(ctx, x, y, h = 0, r = 0) {
  R(ctx, 'rgba(20,12,30,.25)', x - 3, y, 6, 1);
  const Y = y - 3 - h;
  for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; R(ctx, '#f4f1ea', x + Math.round(Math.cos(an) * 3), Y + Math.round(Math.sin(an) * 3), 1, 1); }
  R(ctx, '#f4f1ea', x - 2, Y - 2, 5, 5); R(ctx, '#1a1414', x - 1 + Math.round(Math.cos(r) * 1), Y - 1 + Math.round(Math.sin(r) * 1), 2, 2); R(ctx, '#1a1414', x + 1 - Math.round(Math.cos(r)), Y + 1, 1, 1);
}
export function ritaSkridskor(ctx, x, y, dir) { const s = dir === 'left' ? -1 : 1; R(ctx, '#c8ccd4', x - 5, y, 4, 1); R(ctx, '#c8ccd4', x + 1, y, 4, 1); R(ctx, '#f4f1ea', x - 5 + (s < 0 ? 1 : 0), y - 1, 3, 1); R(ctx, '#f4f1ea', x + 2, y - 1, 3, 1); }
export function ritaIsspar(ctx, spar) { for (const s of spar) { ctx.fillStyle = `rgba(160,200,230,${(s.a * 0.6).toFixed(2)})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 1); } }
export function ritaSkylt(ctx) {
  const { x, y } = SKYLT, s = $t('ARENATORGET'), w = textW(SMALL, s) + 16;
  skugga(ctx, x, y, 6); R(ctx, '#5a5e66', x - 1, y - 22, 2, 22); R(ctx, '#1a1414', x - (w >> 1) - 1, y - 37, w + 2, 16); R(ctx, '#f4ecd8', x - (w >> 1), y - 36, w, 14);
  ctxText(ctx, SMALL, s, x - (w >> 1) + 11, y - 33, '#1a1414'); R(ctx, hex(KBK.rod), x - (w >> 1) + 3, y - 33, 5, 8); R(ctx, '#1a1414', x - (w >> 1) + 3, y - 29, 5, 2);
}
export function ritaHallplats(ctx) { const { x, y } = HALLPLATS; R(ctx, '#1c2026', x, y - 26, 2, 26); R(ctx, '#2a5aa8', x - 6, y - 34, 14, 9); R(ctx, '#f4ecd8', x - 5, y - 33, 12, 7); R(ctx, '#2a5aa8', x - 3, y - 31, 8, 1); R(ctx, '#2a5aa8', x - 3, y - 29, 6, 1); R(ctx, '#2a5aa8', x - 3, y - 28, 8, 1); }
export function ritaChoklad(ctx, natt) { ritaKiosk(ctx, CHOKLAD, 'choklad', natt); }
export function ritaFikat(ctx, natt) { ritaKiosk(ctx, FIKAT, 'fika', natt); }
export const _p = { put, bild };
