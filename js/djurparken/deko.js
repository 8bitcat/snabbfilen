// 🦁 DJURPARKENS REKVISITA – det som står på marken och ritas y-sorterat av scenen: grindstolparna med skylten
// DJURPARKEN och grindarna, biljettkassan, staketens framsidor per stil (tra/mur/nat/hog/rack/hack), informations-
// skyltarna, glass- och souvenirkiosken, ladan i klappzoo, apornas klätterställning, lejonklippan, björngrottan,
// akaciorna, getfoderautomaten, personalhuset, hållplatsen, picknickborden, vassen, skottkärran och ballongen.
// Allt stillastående cachas som bilder (origo = foten); ljuset uppifrån vänster, ett pixelkorn.
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { ENTRE, HAGN, KASSA, GLASSKIOSK, SOUVENIR, PERSONALHUS, LADA, KLATTER, GROTTA, LEJONKLIPPA, FODER, HALLPLATS, PARKSKYLT, OPPETTEXT } from './karta.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, STEN, TRA, FALU, BLAD, SAND, RODT } = FARGER;
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w, a = 0.24) => { ctx.fillStyle = `rgba(20,12,30,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ---------- entrén ----------
// grindstolpe i sten med lykta; den norra bär skylten DJURPARKEN
export function ritaGrindstolpe(ctx, x, y, { skylt = false, natt = false } = {}) {
  skugga(ctx, x, y, 14);
  put(ctx, bild('stolpe|' + skylt, 96, 70, 48, 66, (P) => {
    fyll(P, -6, -40, 6, 0, (X, Y) => tone(STEN, 0.6 + ((X + Y * 3) % 7 === 0 ? -0.2 : 0) + (hash(X >> 1, Y >> 2, 3) - 0.5) * 0.12 - (X + 6) * 0.015, X, Y));
    P.hl(-7, -41, 15, STEN[4]); P.rect(-8, -43, 17, 2, STEN[3]); P.hl(-8, -43, 17, STEN[4]);
    P.rect(-2, -49, 5, 6, JARN[1]); P.rect(-1, -48, 3, 4, natt ? 0xffe8a0 : 0xd8e8f0); P.px(0, -50, JARN[2]);   // lyktan
    if (skylt) {
      const s = $t('DJURPARKEN'), w = textW(SMALL, s) + 16;
      P.rect(-(w >> 1), -66, w, 14, 0x2e5a2a); P.box(-(w >> 1), -66, w, 14, MASS[3]); P.hl(-(w >> 1) + 1, -65, w - 2, 0x4a8a3a);
      text(P, SMALL, s, -(w >> 1) + 8, -62, 0xf8e080);
      P.rect(-1, -52, 3, 2, MASS[2]);
      spr(P, -(w >> 1) - 9, -66, ['..mm..', '.mmmm.', 'mhhhhm', 'mhkhkm', '.hhhh.', '..hh..'], { m: 0xc87a2c, h: 0xd8a860, k: 0x1a1414 });   // lejonhuvudet
      spr(P, (w >> 1) + 3, -66, ['..mm..', '.mmmm.', 'mhhhhm', 'mhkhkm', '.hhhh.', '..hh..'], { m: 0xc87a2c, h: 0xd8a860, k: 0x1a1414 });
    }
  }), x, y);
}
// smidesgrindarna: stängda spärrar de öppningen (en rad längs staketet), öppna står de insvängda
export function ritaGrind(ctx, oppen) {
  const x = ENTRE.X, [y0, y1] = ENTRE.GRIND;
  if (!oppen) { for (let y = y0 + 2; y < y1 - 2; y += 3) { R(ctx, '#1c2026', x, y, 1, 2); } R(ctx, '#434b56', x, y0 + 2, 1, y1 - y0 - 4); R(ctx, '#1c2026', x - 1, y0 + 2, 3, 1); R(ctx, '#1c2026', x - 1, y1 - 3, 3, 1); R(ctx, '#e6be4c', x - 1, (y0 + y1) / 2 - 1, 3, 2); return; }
  for (const [gy, s] of [[y0 + 2, 1], [y1 - 3, -1]]) { R(ctx, '#1c2026', x, gy, 30, 1); R(ctx, '#434b56', x, gy - 1, 30, 1); for (let i = 3; i < 30; i += 3) R(ctx, '#1c2026', x + i, gy - 1 - (s > 0 ? 0 : 0), 1, 2); }
}
// biljettkassan: liten grön kur med lucka, skylten BILJETTER och prislappen
export function ritaKassa(ctx, natt) {
  const { x, y } = KASSA;
  skugga(ctx, x, y, 34);
  put(ctx, bild('kassa|' + natt, 48, 60, 24, 56, (P) => {
    fyll(P, -15, -36, 15, 0, (X, Y) => (X === -15 || X === 15 ? 0x2e5a2a : tone([0x2e5a2a, 0x3e7a3a, 0x4a9a44, 0x5aa850, 0x7ac868], 0.52 - (X + 15) * 0.006 + (Y % 7 === 0 ? -0.15 : 0), X, Y)));
    for (let j = 0; j < 5; j++) P.hl(-18 + j, -41 + j, 37 - j * 2, j === 4 ? 0x6a3a1e : j % 2 ? 0xf4f1ea : 0xd8343c);   // randigt tak
    P.rect(-10, -30, 20, 14, natt ? 0xffe8a0 : 0xb8e4f4); P.box(-10, -30, 20, 14, VIT[3]); P.hl(-10, -16, 20, TRA[3]); P.hl(-10, -15, 20, TRA[1]);
    P.rect(-2, -27, 4, 5, 0x3a2a2a); P.px(-1, -27, 0xf0cfae); P.px(0, -27, 0xf0cfae); P.rect(-2, -24, 4, 2, 0xe04848);   // biljettförsäljaren
    const s = $t('BILJETTER'), w = textW(SMALL, s) + 6; P.rect(-(w >> 1), -48, w, 9, 0xf4f1ea); P.box(-(w >> 1), -48, w, 9, 0x2e5a2a); text(P, SMALL, s, -(w >> 1) + 3, -46, 0x2e5a2a);
    P.rect(4, -12, 9, 7, 0xf8e080); text(P, SMALL, String(ENTRE.PRIS), 5, -11, 0x2a1a0c);
  }), x, y);
}
// parkskylten vid hållplatsen med öppettiderna, och hållplatsstolpen
export function ritaParkskylt(ctx) {
  const { x, y } = PARKSKYLT, s1 = $t('DJURPARKEN'), s2 = OPPETTEXT(), w = Math.max(textW(SMALL, s1), textW(SMALL, s2)) + 10;
  skugga(ctx, x, y, 8);
  R(ctx, '#6e4a28', x - 1, y - 26, 3, 26); R(ctx, '#f4ecd8', x - (w >> 1), y - 44, w, 20); R(ctx, '#2e5a2a', x - (w >> 1), y - 44, w, 1); R(ctx, '#2e5a2a', x - (w >> 1), y - 25, w, 1); R(ctx, '#2e5a2a', x - (w >> 1), y - 44, 1, 20); R(ctx, '#2e5a2a', x + (w >> 1) - 1, y - 44, 1, 20);
  ctxText(ctx, SMALL, s1, x - (w >> 1) + 5, y - 41, '#2e5a2a'); ctxText(ctx, SMALL, s2, x - (w >> 1) + 5, y - 33, '#5a4632');
}
export function ritaHallplats(ctx) {
  const { x, y } = HALLPLATS;
  R(ctx, '#1c2026', x, y - 26, 2, 26); R(ctx, '#2a5aa8', x - 6, y - 34, 14, 9); R(ctx, '#f4ecd8', x - 5, y - 33, 12, 7);
  R(ctx, '#2a5aa8', x - 3, y - 31, 8, 1); R(ctx, '#2a5aa8', x - 3, y - 29, 6, 1); R(ctx, '#2a5aa8', x - 3, y - 28, 8, 1);
}

// ---------- staketens framsidor ----------
// H = inhägnaden (karta.js). Framsidan är y1 för de norra, y0 för de södra; grind = öppning med en liten grind
export function ritaStaketFram(ctx, H, natt) {
  const [x0, y0, x1, y1] = H.r, y = H.norr ? y1 : y0, g = H.grind;
  const gap = (x) => g && x >= g[0] && x <= g[1];
  if (H.staket === 'mur') {
    for (let x = x0; x <= x1; x++) { for (let j = 0; j < 8; j++) R(ctx, j === 0 ? '#b4aea4' : (x + j * 3) % 7 === 0 ? '#5a544c' : j > 6 ? '#56524c' : hex(mix(0x8a847a, 0x76716a, hash(x >> 2, j, 61))), x, y - 6 + j, 1, 1); }
    return;
  }
  if (H.staket === 'hack') { for (let x = x0; x <= x1; x++) for (let j = 0; j < 9; j++) R(ctx, hex(mix(0x2e6a26, 0x4a9a3a, hash(x >> 1, j, 62) * (j < 2 ? 1.2 : 0.8))), x, y - 6 + j, 1, 1); return; }
  if (H.staket === 'rack') { R(ctx, '#434b56', x0, y - 7, x1 - x0, 1); R(ctx, '#646e7a', x0, y - 8, x1 - x0, 1); R(ctx, '#434b56', x0, y - 3, x1 - x0, 1); for (let x = x0; x <= x1; x += 12) { R(ctx, '#2c323a', x, y - 9, 2, 10); R(ctx, '#646e7a', x, y - 9, 1, 1); } return; }
  // trä (tra/nat/hog): stolpar med två eller tre slanor, nätet med maskor för aporna
  const hog = H.staket === 'nat' || H.staket === 'hog', top = hog ? 22 : 11;
  for (let x = x0; x <= x1; x++) { if (gap(x)) continue; R(ctx, '#8a6236', x, y - 7, 1, 1); R(ctx, '#6e4a28', x, y - 6, 1, 1); R(ctx, '#8a6236', x, y - 3, 1, 1); R(ctx, '#6e4a28', x, y - 2, 1, 1); if (hog) { R(ctx, '#8a6236', x, y - 14, 1, 1); R(ctx, '#6e4a28', x, y - 13, 1, 1); } if (H.staket === 'nat' && (x + 1) % 3 === 0) for (let j = -21; j < -3; j += 3) R(ctx, 'rgba(154,154,148,.55)', x, y + j, 1, 1); }
  for (let x = x0; x <= x1 + 1; x += 16) { if (gap(x) && x !== g[0] && x !== g[1]) continue; R(ctx, '#6e4a28', x, y - top, 2, top + 1); R(ctx, '#a87848', x, y - top, 1, top); R(ctx, '#4a3020', x, y - top - 1, 2, 1); }
  if (g) { for (const gx of g) { R(ctx, '#6e4a28', gx, y - 12, 2, 13); R(ctx, '#a87848', gx, y - 12, 1, 12); } const gw = g[1] - g[0];   // den lilla grinden står öppen inåt
    for (let i = 0; i < 10; i++) { R(ctx, '#8a6236', g[0] + 2 + i, y - 8 - (H.norr ? i : -i) * 0.0, 1, 1); R(ctx, '#8a6236', g[0] + 2 + i, y - 4, 1, 1); } R(ctx, '#6e4a28', g[0] + 11, y - 10, 1, 8); void gw; }
  if (H.id === 'klapp') { const s = $t('GÅ IN OCH KLAPPA'), w = textW(SMALL, s) + 6; R(ctx, '#f4ecd8', g[1] + 6, y - 20, w, 9); R(ctx, '#2e5a2a', g[1] + 6, y - 20, w, 1); ctxText(ctx, SMALL, s, g[1] + 9, y - 18, '#2e5a2a'); }
  void natt;
}
// informationsskylten: stolpe, grön tavla med djurets namn i gult
export function ritaSkylt(ctx, x, y, namn) {
  const w = textW(SMALL, namn) + 10;
  skugga(ctx, x, y, 6);
  R(ctx, '#6e4a28', x - 1, y - 18, 3, 18); R(ctx, '#2e5a2a', x - (w >> 1), y - 30, w, 13); R(ctx, '#e6be4c', x - (w >> 1), y - 30, w, 1); R(ctx, '#1e3a1e', x - (w >> 1), y - 18, w, 1); R(ctx, '#e6be4c', x - (w >> 1), y - 30, 1, 13); R(ctx, '#1e3a1e', x + (w >> 1) - 1, y - 30, 1, 13);
  ctxText(ctx, SMALL, namn, x - (w >> 1) + 5, y - 27, '#f8e080');
}

// ---------- kioskerna ----------
export function ritaKiosk(ctx, typ, natt) {
  const K = typ === 'glass' ? GLASSKIOSK : SOUVENIR, { x, y } = K;
  skugga(ctx, x, y, 44);
  put(ctx, bild('kiosk|' + typ + natt, 72, 72, 36, 68, (P) => {
    const A1 = typ === 'glass' ? 0xf06aa0 : 0x3a7bd5, A2 = 0xf4f1ea;
    fyll(P, -20, -34, 20, 0, (X, Y) => (X === -20 || X === 20 ? 0x8a5a30 : tone([0x8a5a30, 0xb07a48, 0xd8a070, 0xe8b888, 0xf4d0a8], 0.55 - (X + 20) * 0.004 + ((X % 6) === 0 ? -0.12 : 0), X, Y)));
    P.rect(-14, -28, 28, 12, natt ? 0xffe8a0 : 0xb8e4f4); P.box(-14, -28, 28, 12, VIT[3]); P.rect(-16, -16, 32, 3, TRA[3]); P.hl(-16, -16, 32, TRA[4]);   // luckan och disken
    for (let j = 0; j < 7; j++) for (let i = -24 + j; i < 24 - j; i++) P.px(i, -42 + j, ((i + 24) / 6 | 0) % 2 ? A2 : A1);   // markisen
    P.hl(-24, -35, 48, mul(A1, 0.6)); for (let i = -24; i < 24; i += 6) P.px(i + 3, -34, A1);
    P.rect(-1, -30, 3, 4, 0x3a2a2a); P.px(0, -30, 0xf0cfae); P.px(1, -30, 0xf0cfae); P.rect(-2, -26, 5, 2, typ === 'glass' ? 0xf06aa0 : 0x3a7bd5);   // försäljaren
    if (typ === 'glass') {
      spr(P, 22, -60, ['..ppp..', '.ppppp.', 'ppppppp', '.ppppp.', '..ccc..', '..ccc..', '...c...'], { p: 0xf8a0c8, c: 0xd8a050 });   // strutskylten
      P.vl(25, -52, 10, 0x8a5a30); for (let i = 0; i < 4; i++) { P.rect(-12 + i * 7, -14, 4, 3, [0xf8a0c8, 0xf4f1ea, 0x8a5a30, 0xf0c030][i]); P.px(-11 + i * 7, -11, 0xd8a050); }   // glassar i disken
      const s = $t('GLASS'), w = textW(SMALL, s); P.rect(-(w >> 1) - 3, -48, w + 6, 8, 0xf4f1ea); text(P, SMALL, s, -(w >> 1), -46, 0xd8346a);
    } else {
      for (let i = 0; i < 5; i++) { const bx = 24 + (i % 3) * 4, by = -58 + (i >> 1) * 5 - (i % 2) * 3, c = [0xd8343c, 0xf0c030, 0x3a7bd5, 0x46a35a, 0xf06aa0][i]; P.rect(bx - 2, by - 3, 4, 5, c); P.px(bx - 2, by - 3, mix(c, 0xffffff, 0.4)); P.px(bx, by + 2, mul(c, 0.7)); for (let j = 0; j < 12; j++) P.px(bx + Math.round(Math.sin(j) * 0.5), by + 3 + j, 0xd8d4c8, 0.6); }   // ballongklasen
      spr(P, -12, -14, ['.mm.', 'mhhm', 'mkkm', '.hh.'], { m: 0xc87a2c, h: 0xd8a860, k: 0x1a1414 }); spr(P, -5, -14, ['.mm.', 'mhhm', 'mkkm', '.hh.'], { m: 0xc87a2c, h: 0xd8a860, k: 0x1a1414 });   // lejonnallar
      P.rect(3, -14, 6, 3, 0xd8343c); P.px(9, -13, 0xd8343c); P.rect(3, -11, 6, 1, 0xa8282a);   // kepsen
      const s = $t('SOUVENIRER'), w = textW(SMALL, s); P.rect(-(w >> 1) - 3, -48, w + 6, 8, 0xf4f1ea); text(P, SMALL, s, -(w >> 1), -46, 0x2a4ab0);
    }
  }), x, y);
}

// ---------- hagarnas saker ----------
export function ritaLada(ctx, natt) {
  const { x, y } = LADA;
  skugga(ctx, x, y, 60);
  put(ctx, bild('lada|' + natt, 72, 60, 36, 56, (P) => {
    fyll(P, -28, -28, 28, 0, (X, Y) => (X === -28 || X === 28 ? FALU[0] : tone(FALU, 0.55 - (X + 28) * 0.003 + ((X % 7) === 0 ? -0.15 : 0) + (hash(X >> 1, Y >> 2, 3) - 0.5) * 0.08, X, Y)));
    for (let j = 0; j < 14; j++) P.hl(-30 + j, -42 + j, 61 - j * 2, j % 3 === 2 ? 0x4a3020 : j === 0 ? 0xa87848 : 0x6e4a28);   // taket
    P.rect(-30, -29, 61, 2, VIT[3]);
    fyll(P, -8, -20, 8, 0, (X, Y) => (Y === -20 ? VIT[3] : (X === -8 || X === 8 || X === 0) ? VIT[2] : 0x1a1410)); P.line(-7, -19, 7, -1, VIT[2]); P.line(7, -19, -7, -1, VIT[2]);   // dörren med kryss
    P.rect(-22, -22, 8, 7, natt ? 0xffe8a0 : 0x8ab4d8); P.box(-22, -22, 8, 7, VIT[3]); P.rect(14, -22, 8, 7, natt ? 0xffe8a0 : 0x8ab4d8); P.box(14, -22, 8, 7, VIT[3]);
    for (let i = 0; i < 12; i++) P.px(-26 + i * 2 + (i & 1), -4 - (i % 3), 0xe8c860); P.rect(-27, -3, 14, 3, 0xd8a850);   // höet vid väggen
    spr(P, 20, -34, ['.k.', 'kkk', '.k.', 'kkk'], { k: 0x8a6236 });   // vindflöjeln
  }), x, y);
}
export function ritaKlatter(ctx, t) {
  const { x, y } = KLATTER;
  skugga(ctx, x, y, 70);
  put(ctx, bild('klatter', 90, 70, 45, 66, (P) => {
    for (const px of [-36, -12, 12, 36]) { P.rect(px, -50, 3, 50, TRA[2]); P.vl(px, -50, 50, TRA[3]); P.hl(px - 1, -51, 5, TRA[1]); }
    P.rect(-36, -46, 75, 2, TRA[3]); P.rect(-36, -28, 51, 2, TRA[3]); P.rect(12, -36, 27, 2, TRA[3]);   // stängerna
    for (let j = 0; j < 14; j++) P.px(-24 + (j % 2), -44 + j, 0xc8a060); P.rect(-27, -30, 7, 2, TRA[1]);   // repet med pinnen
    P.vl(24, -34, 10, 0xc8a060); for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; P.px(24 + Math.round(Math.cos(an) * 5), -20 + Math.round(Math.sin(an) * 4), 0x1c1a20); }   // däcket
    P.rect(-10, -14, 20, 5, 0xa8a296); P.hl(-10, -14, 20, 0xc8c2b6); P.rect(-6, -9, 12, 4, 0x8a847a);   // stenen under
  }), x, y);
  if (Math.floor(t) % 7 === 0) R(ctx, '#f0c030', x - 24, y - 52, 3, 3);   // en banan högst upp ibland
}
export function ritaGrotta(ctx) {
  const { x, y } = GROTTA;
  skugga(ctx, x, y, 60);
  put(ctx, bild('grotta', 80, 50, 40, 46, (P) => {
    for (let j = 0; j < 40; j++) { const half = Math.round(36 * Math.sqrt(Math.max(0, 1 - ((40 - j) / 40) ** 2))); for (let i = -half; i <= half; i++) P.px(i, -40 + j, tone(STEN, 0.55 - (j / 40) * 0.3 - (i + half) / (half * 2 + 1) * 0.1 + (hash(i >> 2, j >> 2, 3) - 0.5) * 0.2, i, j)); }
    for (let j = 0; j < 20; j++) { const half = Math.round(12 * Math.sqrt(Math.max(0, 1 - ((20 - j) / 20) ** 2))); for (let i = -half; i <= half; i++) P.px(i, -20 + j, j > 16 ? 0x1a1410 : 0x0a0808); }
    for (const [mx, my] of [[-30, -6], [26, -4], [-14, -30], [20, -28]]) { P.px(mx, my, 0x3e8a34); P.px(mx + 1, my, 0x4a9a3a); P.px(mx, my - 1, 0x4a9a3a); }   // mossa
    P.rect(-36, -2, 72, 2, 0x4a3a28);
  }), x, y);
}
export function ritaKlippa(ctx) {
  const { x, y } = LEJONKLIPPA;
  skugga(ctx, x, y, 56);
  put(ctx, bild('klippa', 70, 40, 35, 36, (P) => {
    fyll(P, -30, -30, 30, 0, (X, Y) => { const u = (Y + 30) / 30, half = 14 + u * 16; if (Math.abs(X) > half) return null; return tone([0x8a7050, 0xa88860, 0xc4a070, 0xd8b888, 0xe8cc9c], 0.6 - u * 0.4 + (X < -half + 6 ? 0.15 : 0) + (hash(X >> 2, Y >> 1, 4) - 0.5) * 0.15, X, Y); });
    P.hl(-14, -30, 28, 0xe8cc9c); for (let i = -10; i < 10; i += 5) P.px(i, -27, 0xa88860);
    for (const [gx, gy] of [[-20, -8], [18, -12], [8, -4]]) { P.px(gx, gy, 0xb8a040); P.px(gx + 1, gy - 1, 0xc8b050); P.px(gx + 2, gy, 0xb8a040); }   // torrt gräs
  }), x, y);
}
export function ritaAkacia(ctx, x, y, vind = 0) {
  skugga(ctx, x, y, 18);
  put(ctx, bild('akacia', 70, 60, 35, 56, (P) => {
    P.rect(-2, -30, 4, 30, TRA[1]); P.vl(-2, -30, 30, TRA[3]); P.vl(2, -30, 30, TRA[0]);
    for (let i = 0; i < 8; i++) { P.px(-3 - (i >> 1), -30 - i, TRA[1]); P.px(3 + (i >> 1), -32 - i, TRA[1]); P.px(-1 + (i >> 2), -34 - i, TRA[2]); }
    for (let j = 0; j < 10; j++) { const half = 30 - Math.round((j - 5) * (j - 5) * 0.9); for (let i = -half; i <= half; i++) { if (hash(i >> 1, j, 5) > 0.92) continue; P.px(i, -48 + j, tone(BLAD, 0.45 + (j < 3 ? 0.35 : 0) - Math.abs(i) / half * 0.15 + (hash(i >> 1, j >> 1, 6) - 0.5) * 0.3, i, j)); } }
    P.hl(-28, -39, 56, 0x1e4a1e, 0.5);
  }), x + vind, y);
}
export function ritaFoder(ctx) {
  const { x, y } = FODER;
  skugga(ctx, x, y, 10);
  put(ctx, bild('foder', 20, 30, 10, 28, (P) => { P.rect(-1, -16, 3, 16, JARN[2]); P.rect(-6, -26, 13, 11, 0xd8343c); P.hl(-6, -26, 13, 0xf07a7a); P.vl(6, -26, 11, 0x9a2a2a); P.rect(-4, -23, 6, 4, 0x1a1410); P.px(5, -20, MASS[3]); P.px(6, -21, MASS[3]); P.px(7, -20, MASS[2]); for (let i = 0; i < 3; i++) P.px(-3 + i * 2, -21, 0xe8c860); const s = '5'; text(P, SMALL, s, 0, -14, 0xf8e080); }), x, y);
}
export function ritaPersonalhus(ctx, natt) {
  const { x, y, w } = PERSONALHUS, h2 = w >> 1;
  skugga(ctx, x, y, w + 4);
  put(ctx, bild('personal|' + natt, 64, 70, 32, 66, (P) => {
    fyll(P, -h2, -34, h2, 0, (X, Y) => (X === -h2 || X === h2 ? 0x4a5a3a : tone([0x5a6a48, 0x7a8a62, 0x9aaa7e, 0xb0c094, 0xc8d4ac], 0.55 - (X + h2) * 0.004 + ((X % 5) === 0 ? -0.1 : 0), X, Y)));
    for (let j = 0; j < 12; j++) P.hl(-h2 - 3 + j, -46 + j, w + 7 - j * 2, j % 3 === 2 ? 0x4a3a28 : j === 0 ? 0x9a7a5a : 0x6e5a40);
    P.rect(-5, -20, 10, 20, TRA[1]); P.hl(-5, -20, 10, TRA[3]); P.px(3, -10, MASS[3]); P.rect(-13, -26, 7, 7, natt ? 0xffe8a0 : 0x8ab4d8); P.box(-13, -26, 7, 7, VIT[3]); P.rect(8, -26, 7, 7, natt ? 0xffe8a0 : 0x8ab4d8); P.box(8, -26, 7, 7, VIT[3]);
    const s = $t('PERSONAL'), tw = textW(SMALL, s); P.rect(-(tw >> 1) - 3, -32, tw + 6, 9, 0xf4f1ea); text(P, SMALL, s, -(tw >> 1), -30, 0x2e5a2a);
    P.rect(h2 - 10, -4, 8, 4, 0xa8a296); P.px(h2 - 8, -6, 0x6e4a28); P.px(h2 - 5, -6, 0x6e4a28);   // skottkärreplats: en hink
  }), x, y);
}
export function ritaPicknickbord(ctx, x, y) {
  skugga(ctx, x, y, 36);
  put(ctx, bild('picknick', 44, 24, 22, 22, (P) => { P.rect(-16, -14, 32, 3, TRA[3]); P.hl(-16, -14, 32, TRA[4]); P.rect(-18, -6, 10, 2, TRA[2]); P.rect(8, -6, 10, 2, TRA[2]); P.rect(-12, -11, 2, 11, TRA[1]); P.rect(10, -11, 2, 11, TRA[1]); P.rect(-14, -4, 2, 4, TRA[1]); P.rect(12, -4, 2, 4, TRA[1]); P.rect(-6, -17, 5, 3, 0xd8343c); P.px(-5, -18, 0xf4f1ea); P.rect(2, -16, 4, 2, 0xf0c030); }), x, y);
}
export function ritaVass(ctx, x, y, n = 5) {
  for (let i = 0; i < n; i++) { const vx = x + i * 3 - n, h = 10 + (i * 7) % 6; R(ctx, '#3e8a34', vx, y - h, 1, h); R(ctx, '#6a4a2a', vx, y - h - 3, 1, 4); R(ctx, '#8a5a30', vx, y - h - 3, 1, 1); }
}
export function ritaSkottkarra(ctx, x, y, dir) {
  const s = dir === 'left' ? -1 : 1;
  R(ctx, 'rgba(20,12,30,.22)', x - 8, y - 1, 16, 2);
  R(ctx, '#434b56', x - 7 * s, y - 2, 1, 2); R(ctx, '#1c2026', x + 6 * s - 1, y - 4, 3, 4); R(ctx, '#646e7a', x + 6 * s, y - 3, 1, 1);
  R(ctx, '#3e7e2a', x - 6, y - 10, 13, 6); R(ctx, '#5aa848', x - 6, y - 10, 13, 1); R(ctx, '#2e5a2a', x - 6, y - 5, 13, 1);
  for (let i = 0; i < 6; i++) R(ctx, i % 2 ? '#e8c860' : '#d8a850', x - 5 + i * 2, y - 12 - (i % 3), 2, 2);
  R(ctx, '#6e4a28', x - 11 * s, y - 9, 5, 1);
}
export function ritaBallong(ctx, x, y, t, c = '#d8343c') {
  const bx = x + Math.round(Math.sin(t * 1.3) * 2), by = y - 22;
  R(ctx, 'rgba(216,212,200,.7)', x, y - 14, 1, 14); R(ctx, c, bx - 3, by - 7, 6, 8); R(ctx, c, bx - 2, by - 8, 4, 1); R(ctx, c, bx - 2, by + 1, 4, 1); R(ctx, 'rgba(255,255,255,.45)', bx - 2, by - 6, 1, 2); R(ctx, c, bx, by + 2, 1, 1);
}
export function ritaTrag(ctx, x, y) {   // vattentråget hos elefanterna
  R(ctx, 'rgba(20,12,30,.22)', x - 12, y - 1, 24, 2); R(ctx, '#6e685e', x - 11, y - 7, 22, 7); R(ctx, '#8a847a', x - 11, y - 7, 22, 1); R(ctx, '#5aa8e0', x - 9, y - 6, 18, 2); R(ctx, '#9ad8f8', x - 8, y - 6, 4, 1);
}
export const SAFT = SAND; export const ROD = RODT; export const BLADF = BLAD;
