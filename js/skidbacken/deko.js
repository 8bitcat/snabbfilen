// ⛷️ SKIDBACKENS STUGOR OCH REKVISITA – ritas y-sorterat av scenen (js/scenes/skidbacken.js): VÄRMESTUGAN (timmer med
// snö på taket och rök), SKIDUTHYRNINGEN (skidor och pulkor på väggen), TOPPSTUGAN (skidpatrullens röda stuga med vitt
// kors), liftens dal- och toppstation, stolparna, linan och stolarna (ritas av scenen), slalomportarna, snögubben,
// eldstaden med lågor, snökanonen som sprutar, snöklädda granar, stenar, utsiktsskylten, skidor och pulkan under
// åkaren, snöröken bakom skidorna. Cachade bilder (origo = foten), ett pixelkorn, ljuset från vänster.
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { VARMESTUGA, UTHYRNING, TOPPSTUGA, LIFT, SNOGUBBE, ELD, TOPPSKYLT, SKYLT, HALLPLATS, OPPETTEXT } from './karta.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, STEN, TRA, FALU } = FARGER;
const TIMMER = [0x5a3a1e, 0x7a5028, 0x9a6a36, 0xb88448, 0xd0a060];
const SNO = 0xf4f8fc, SNOS = 0xd0dcea;
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w, a = 0.18) => { ctx.fillStyle = `rgba(60,80,120,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function fonster(P, x, y, w, h, natt) { P.rect(x - 1, y - 1, w + 2, h + 2, VIT[3]); P.rect(x, y, w, h, natt ? 0xffe8a0 : 0x8ab4d8); if (!natt) P.px(x, y, 0xc8e4f8); P.vl(x + (w >> 1), y, h, VIT[3]); P.hl(x, y + (h >> 1), w, VIT[3]); }
// snö på en takås: ett vitt tjockt lager med droppande kant
function snotak(P, x0, x1, y, tjock = 4) { for (let x = x0; x <= x1; x++) { const h = tjock + (hash(x >> 2, 1, 3) > 0.7 ? 1 : 0); for (let j = 0; j < h; j++) P.px(x, y - j, j === h - 1 ? 0xffffff : SNO); if (hash(x, 2, 3) > 0.85) P.px(x, y + 1, SNO); } }

// ---------- stugorna (fasaden står på y) ----------
function stugBild(H, typ, natt) {
  return bild(`stuga|${typ}|${natt}`, H.w + 20, H.h + 60, 10, H.h + 56, (P) => {
    const w = H.w, h = H.h, cx = w >> 1;
    if (typ === 'varme' || typ === 'uthyr') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => ((Y + h) % 6 === 5 ? TIMMER[0] : tone(TIMMER, 0.55 - (X / w) * 0.06 + ((Y + h) % 6 === 0 ? 0.12 : 0) + (hash(X >> 3, Y >> 3, 3) - 0.5) * 0.08, X, Y)));   // liggtimmer
      P.rect(-2, -h - 2, 5, h + 2, TIMMER[3]); P.rect(w - 3, -h - 2, 5, h + 2, TIMMER[3]);   // knutarna
      for (let j = 0; j < 16; j++) P.hl(-6 + j, -h - 16 + j, w + 12 - j * 2, j % 3 === 2 ? 0x4a3020 : 0x6e4a28);   // sadeltaket
      snotak(P, -6, w + 5, -h - 16, 5);
      P.rect(w - 36, -h - 32, 10, 18, STEN[1]); P.hl(w - 37, -h - 33, 12, STEN[3]); snotak(P, w - 37, w - 26, -h - 33, 2);   // skorstenen
      const dw = H.door.x1 - H.door.x0, dx = H.door.x0 - H.x;
      P.rect(dx, -32, dw, 32, 0x4a2a14); P.hl(dx, -32, dw, 0x6e4a28); P.vl(dx + (dw >> 1), -30, 28, 0x3a2010); P.px(dx + dw - 4, -16, MASS[3]);
      P.rect(dx - 8, -38, dw + 16, 6, TIMMER[1]); P.hl(dx - 8, -38, dw + 16, TIMMER[4]);   // förstukvisten
      if (typ === 'varme') {
        fonster(P, 16, -h + 22, 22, 18, natt); fonster(P, w - 40, -h + 22, 22, 18, natt);
        P.rect(12, -h + 42, 30, 3, 0x8a5a30); for (let k = 0; k < 4; k++) P.px(15 + k * 7, -h + 41, [0xe04848, 0xf0d040, 0xffffff, 0xe04848][k]);   // blomlådan med vinterljung
        const s = $t('VÄRMESTUGAN'), tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 5, -h + 4, tw + 10, 10, 0xf4f1ea); P.box(cx - (tw >> 1) - 5, -h + 4, tw + 10, 10, 0x8a3a2a); text(P, SMALL, s, cx - (tw >> 1), -h + 6, 0x8a3a2a);
        spr(P, cx - (tw >> 1) - 15, -h + 4, ['..k..', '.kkk.', 'kkkkk', '.kkk.', '..k..', '..k..'], { k: 0xf0c030 });   // en liten lykta
        P.rect(w - 24, -14, 10, 14, 0xf4f1ea); P.rect(w - 23, -13, 8, 12, 0x8a3a2a); text(P, SMALL, '!', w - 20, -11, 0xf4f1ea);   // skylt: varm choklad
      } else {
        for (let k = 0; k < 4; k++) { P.rect(12 + k * 7, -h + 16, 2, 34, [0xd8343c, 0x3a7bd5, 0xf0c030, 0x46a35a][k]); P.px(12 + k * 7, -h + 16, 0x1a1414); P.px(13 + k * 7, -h + 16, 0x1a1414); }   // skidor på väggen
        for (let k = 0; k < 2; k++) { P.rect(w - 44 + k * 18, -h + 22, 14, 6, 0xd8343c); P.hl(w - 44 + k * 18, -h + 22, 14, 0xf07a7a); P.rect(w - 45 + k * 18, -h + 28, 16, 2, 0x8a5a30); }   // pulkor
        P.rect(w - 40, -h + 40, 30, 2, 0x5a3a1e); for (let k = 0; k < 5; k++) P.rect(w - 38 + k * 6, -h + 34, 3, 6, [0x1a1414, 0xd8343c, 0x3a7bd5, 0x1a1414, 0xf0c030][k]);   // pjäxor på hyllan
        const s = $t('SKIDUTHYRNING'), tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 5, -h + 4, tw + 10, 10, 0x2a5aa8); P.box(cx - (tw >> 1) - 5, -h + 4, tw + 10, 10, 0xf4f1ea); text(P, SMALL, s, cx - (tw >> 1), -h + 6, 0xf4f1ea);
      }
    } else {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => (X === 0 || X === w - 1 ? FALU[0] : tone(FALU, 0.55 + ((X % 7) === 0 ? -0.12 : 0) + (hash(X >> 2, Y >> 2, 4) - 0.5) * 0.08, X, Y)));
      for (let j = 0; j < 14; j++) P.hl(-5 + j, -h - 14 + j, w + 10 - j * 2, j % 3 === 2 ? 0x3a3a42 : 0x5a5a66); snotak(P, -5, w + 4, -h - 14, 5);
      P.rect(cx - 10, -h + 14, 20, 20, 0xf4f1ea); P.rect(cx - 3, -h + 16, 6, 16, 0xd8343c); P.rect(cx - 8, -h + 21, 16, 6, 0xd8343c);   // vita korset
      fonster(P, 10, -h + 30, 14, 12, natt); fonster(P, w - 24, -h + 30, 14, 12, natt);
      const dw = H.door.x1 - H.door.x0, dx = H.door.x0 - H.x; P.rect(dx, -28, dw, 28, 0xf4f1ea); P.rect(dx + 2, -26, dw - 4, 24, 0x3a3a42); P.px(dx + dw - 5, -14, MASS[3]);
      const s = $t('SKIDPATRULLEN'), tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 4, -h + 38, tw + 8, 9, 0xf4f1ea); text(P, SMALL, s, cx - (tw >> 1), -h + 40, 0xd8343c);
      P.vl(w - 6, -h - 34, 20, 0x3a3a42); P.rect(w - 5, -h - 33, 10, 7, 0xf0c030); P.rect(w - 5, -h - 30, 10, 2, 0x1a1414);   // flaggan
    }
    for (let x = 0; x < w; x++) P.px(x, 1, 0x6a84a8, 0.3);
  });
}
export function ritaStuga(ctx, H, typ, natt) { put(ctx, stugBild(H, typ, natt), H.x + 10, H.y + 4); }
export function ritaRok(ctx, x, y, t) { for (let k = 0; k < 6; k++) { const u = ((t * 0.3 + k / 6) % 1); R(ctx, `rgba(220,226,236,${(0.6 * (1 - u)).toFixed(2)})`, x + Math.round(Math.sin(u * 5 + k) * 5) + u * 10, y - u * 40, 3 + Math.round(u * 5), 2); } }

// ---------- liften ----------
export function ritaLiftstation(ctx, x, y, topp, natt) {
  skugga(ctx, x, y, 50);
  put(ctx, bild('liftst|' + topp + natt, 72, 70, 36, 66, (P) => {
    P.rect(-20, -38, 40, 38, 0x3a3a42); P.vl(-20, -38, 38, 0x5a5a66); P.rect(-24, -42, 48, 5, 0x5a5a66); P.hl(-24, -42, 48, 0x8a8a94); snotak(P, -24, 23, -42, 3);
    P.rect(-14, -20, 28, 20, 0x8a8a94, 0.3); for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; P.px(Math.round(Math.cos(an) * 9), -26 + Math.round(Math.sin(an) * 9), 0x1a1414); } P.rect(-2, -28, 5, 5, 0x6a6a72);   // drivhjulet
    P.rect(-6, -64, 12, 22, 0x3a3a42); P.rect(-10, -66, 20, 3, 0x5a5a66);   // masten på taket
    P.rect(-9, -16, 18, 16, natt ? 0xffe8a0 : 0x8ab4d8); P.box(-9, -16, 18, 16, 0x5a5a66);
    const s = topp ? $t('TOPPEN') : $t('DALSTATIONEN'), tw = textW(SMALL, s); P.rect(-(tw >> 1) - 3, -52, tw + 6, 9, 0xf4f1ea); text(P, SMALL, s, -(tw >> 1), -50, 0x2a5aa8);
  }), x, y);
}
export function ritaLiftstolpe(ctx, x, y) { skugga(ctx, x, y, 10); R(ctx, '#3a3a42', x - 2, y - 70, 5, 70); R(ctx, '#6a6a72', x - 1, y - 70, 1, 68); R(ctx, '#3a3a42', x - 12, y - 72, 25, 3); R(ctx, '#8a8a94', x - 12, y - 72, 25, 1); R(ctx, '#f4f8fc', x - 12, y - 73, 25, 1); R(ctx, '#3a3a42', x - 5, y - 2, 11, 2); }
export function ritaLina(ctx, x0, y0, x1, y1) { ctx.strokeStyle = '#2a2a32'; ctx.lineWidth = 1; for (const d of [-6, 6]) { ctx.beginPath(); ctx.moveTo(x0 + d, y0 - 62); ctx.lineTo(x1 + d, y1 - 62); ctx.stroke(); } }
// en liftstol på linan: stång, säte, skyddsbygel; rider = { look, dir } ritas av scenen
export function ritaStol(ctx, x, y, upp) {
  R(ctx, '#2a2a32', x, y - 62, 1, 22); R(ctx, '#d8343c', x - 7, y - 40, 15, 3); R(ctx, '#f07a7a', x - 7, y - 40, 15, 1); R(ctx, '#d8343c', x - 7, y - 50, 2, 10); R(ctx, '#d8343c', x + 6, y - 50, 2, 10); R(ctx, '#a8282e', x - 7, y - 37, 15, 2); R(ctx, '#8a8a94', x - 8, y - 46, 17, 1);
  void upp;
}
// ---------- backen ----------
export function ritaPort(ctx, x, y, rod) {
  const c = rod ? '#d8343c' : '#2a5aa8', cl = rod ? '#f07a7a' : '#5890e8';
  for (const dx of [-13, 13]) { skugga(ctx, x + dx, y, 4, 0.12); R(ctx, '#3a3a42', x + dx, y - 22, 1, 22); R(ctx, c, x + dx + 1, y - 22, 9, 7); R(ctx, cl, x + dx + 1, y - 22, 9, 1); R(ctx, c, x + dx + 1, y - 15, 5, 2); }
}
export function ritaSnogubbe(ctx, t) {
  const { x, y } = SNOGUBBE;
  skugga(ctx, x, y, 22);
  put(ctx, bild('snogubbe', 30, 44, 15, 40, (P) => {
    for (let j = -9; j <= 9; j++) { const w = Math.round(10 * Math.sqrt(1 - (j / 9.5) ** 2)); P.hl(-w, -9 + j, w * 2 + 1, j < -5 ? 0xffffff : j > 5 ? SNOS : SNO); }
    for (let j = -7; j <= 7; j++) { const w = Math.round(7 * Math.sqrt(1 - (j / 7.5) ** 2)); P.hl(-w, -24 + j, w * 2 + 1, j < -4 ? 0xffffff : j > 4 ? SNOS : SNO); }
    for (let j = -5; j <= 5; j++) { const w = Math.round(5 * Math.sqrt(1 - (j / 5.5) ** 2)); P.hl(-w, -35 + j, w * 2 + 1, j < -3 ? 0xffffff : SNO); }
    P.rect(-6, -42, 12, 3, 0x1a1414); P.rect(-4, -47, 8, 5, 0x1a1414); P.px(-2, -36, 0x1a1414); P.px(2, -36, 0x1a1414); P.rect(0, -34, 4, 1, 0xf08a2a); P.px(-1, -32, 0x1a1414); P.px(1, -32, 0x1a1414);
    for (let j = 0; j < 3; j++) P.px(0, -27 + j * 4, 0x1a1414);
    P.rect(-8, -30, 16, 3, 0xd8343c); P.rect(6, -29, 3, 8, 0xd8343c); for (let i = 0; i < 9; i++) P.px(-10 - i, -24 + Math.round(i * 0.4), 0x6e4a28); for (let i = 0; i < 9; i++) P.px(10 + i, -26 - Math.round(i * 0.4), 0x6e4a28);
  }), x, y);
  void t;
}
export function ritaEld(ctx, t) {
  const { x, y } = ELD;
  for (const [dx, dy, w] of [[-8, -2, 9], [0, -3, 10], [6, -1, 8]]) { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + dx - (w >> 1), y + dy, w, 3); ctx.fillStyle = '#8a6236'; ctx.fillRect(x + dx - (w >> 1), y + dy, w, 1); }
  for (let k = 0; k < 7; k++) { const ph = t * 7 + k * 1.3, h = 5 + Math.round(Math.sin(ph) * 2.5 + Math.sin(ph * 2.3) * 1.5), fx = x - 7 + k * 2; for (let j = 0; j < h; j++) R(ctx, j < h - 3 ? '#ffe060' : j < h - 1 ? '#ff8a20' : '#d83a1a', fx, y - 4 - j, 2, 1); }
  if (Math.floor(t * 9) % 4 === 0) R(ctx, '#fff0a0', x - 3 + (Math.floor(t * 5) % 6), y - 16 - (Math.floor(t * 3) % 5), 1, 1);
  const g = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 40); g.addColorStop(0, 'rgba(255,150,60,.35)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - 40, y - 46, 80, 80);
}
export function ritaSnokanon(ctx, x, y, t) {
  skugga(ctx, x, y, 16);
  put(ctx, bild('snokanon', 30, 30, 15, 28, (P) => { P.rect(-8, -8, 16, 8, 0xf0c030); P.hl(-8, -8, 16, 0xf8e080); for (const wx of [-7, 4]) { P.rect(wx, -3, 4, 4, 0x1a1414); P.px(wx + 1, -2, 0x8a8a94); } P.rect(-4, -14, 8, 6, 0x3a3a42); for (let i = 0; i < 14; i++) { P.rect(2 + Math.round(i * 0.7), -14 - i, 6, 2, 0x5a5a66); } P.rect(10, -29, 9, 4, 0x3a3a42); }), x, y);
  for (let k = 0; k < 10; k++) { const u = ((t * 1.3 + k / 10) % 1); ctx.fillStyle = `rgba(255,255,255,${(0.8 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(x + 14 + u * 36 + Math.sin(k) * 3), Math.round(y - 30 - u * 18 + k * 1.5 + u * u * 20), 2, 2); }
}
export function ritaGran(ctx, x, y, s = 1) {
  skugga(ctx, x, y, 14 * s);
  put(ctx, bild('gran|' + s, 40, 60, 20, 56, (P) => {
    const H = Math.round(40 * s);
    P.rect(-1, -6, 3, 6, 0x4a3020);
    for (let j = 0; j < H; j++) { const half = Math.round((j / H) * 14 * s) + ((j % 8) < 2 ? 2 : 0); for (let i = -half; i <= half; i++) { const kant = Math.abs(i) > half - 2; P.px(i, -6 - H + j, kant && (j % 8) < 3 ? SNO : (i < 0 ? 0x2e6a3a : 0x1e4a2a)); } if ((j % 8) === 2) for (let i = -half; i <= half; i += 2) P.px(i, -6 - H + j - 1, SNO); }
    P.px(0, -7 - H, SNO); P.px(0, -8 - H, SNO);
  }), x, y);
}
export function ritaSten(ctx, x, y) { skugga(ctx, x, y, 20); put(ctx, bild('sten', 26, 16, 13, 14, (P) => { fyll(P, -11, -12, 11, 0, (X, Y) => { const u = (Y + 12) / 12, half = 6 + u * 5; if (Math.abs(X) > half) return null; return tone(STEN, 0.55 - u * 0.3 + (X < -half + 4 ? 0.15 : 0) + (hash(X >> 1, Y >> 1, 5) - 0.5) * 0.15, X, Y); }); P.hl(-5, -12, 10, SNO); P.hl(-7, -11, 14, SNO); }), x, y); }
export function ritaToppskylt(ctx) {
  const { x, y } = TOPPSKYLT, s = $t('UTSIKTEN'), w = textW(SMALL, s) + 14;
  skugga(ctx, x, y, 6); R(ctx, '#6e4a28', x - 1, y - 24, 3, 24); R(ctx, '#f4f1ea', x - (w >> 1), y - 36, w, 13); R(ctx, '#8a3a2a', x - (w >> 1), y - 36, w, 1); R(ctx, '#8a3a2a', x - (w >> 1), y - 24, w, 1);
  ctxText(ctx, SMALL, s, x - (w >> 1) + 7, y - 33, '#8a3a2a'); R(ctx, '#8a3a2a', x + (w >> 1), y - 32, 5, 5); R(ctx, '#f4f1ea', x + (w >> 1) + 1, y - 31, 3, 3);
}
export function ritaSkylt(ctx) {
  const { x, y } = SKYLT, s1 = $t('SKIDBACKEN'), s2 = OPPETTEXT(), w = Math.max(textW(SMALL, s1), textW(SMALL, s2)) + 10;
  skugga(ctx, x, y, 8); R(ctx, '#6e4a28', x - 1, y - 26, 3, 26); R(ctx, '#f4ecd8', x - (w >> 1), y - 44, w, 20); R(ctx, '#2a5aa8', x - (w >> 1), y - 44, w, 1); R(ctx, '#2a5aa8', x - (w >> 1), y - 25, w, 1);
  ctxText(ctx, SMALL, s1, x - (w >> 1) + 5, y - 41, '#2a5aa8'); ctxText(ctx, SMALL, s2, x - (w >> 1) + 5, y - 33, '#5a4632'); R(ctx, '#f4f8fc', x - (w >> 1) - 1, y - 46, w + 2, 2);
}
export function ritaHallplats(ctx) { const { x, y } = HALLPLATS; R(ctx, '#1c2026', x, y - 26, 2, 26); R(ctx, '#2a5aa8', x - 6, y - 34, 14, 9); R(ctx, '#f4ecd8', x - 5, y - 33, 12, 7); R(ctx, '#2a5aa8', x - 3, y - 31, 8, 1); R(ctx, '#2a5aa8', x - 3, y - 29, 6, 1); R(ctx, '#2a5aa8', x - 3, y - 28, 8, 1); R(ctx, '#f4f8fc', x - 7, y - 36, 16, 2); }
// skidor och pulka under åkaren
export function ritaSkidor(ctx, x, y, styr = 0, bar = false) {
  if (bar) { R(ctx, '#d8343c', x + 4, y - 30, 2, 34); R(ctx, '#d8343c', x + 7, y - 28, 2, 34); return; }
  const dx = styr * 3;
  R(ctx, '#d8343c', x - 5 - dx, y - 6, 2, 12); R(ctx, '#d8343c', x + 3 - dx, y - 6, 2, 12); R(ctx, '#f07a7a', x - 5 - dx, y - 6, 2, 1); R(ctx, '#f07a7a', x + 3 - dx, y - 6, 2, 1); R(ctx, '#3a3a42', x - 6 - dx, y + 6, 4, 1); R(ctx, '#3a3a42', x + 2 - dx, y + 6, 4, 1);
  R(ctx, '#8a8a94', x - 9, y - 10, 1, 12); R(ctx, '#8a8a94', x + 9, y - 10, 1, 12);   // stavarna
}
export function ritaPulka(ctx, x, y, bar = false) {
  if (bar) { R(ctx, '#d8343c', x + 5, y - 28, 6, 14); R(ctx, '#f07a7a', x + 5, y - 28, 6, 1); R(ctx, '#8a5a30', x + 4, y - 14, 8, 2); return; }
  R(ctx, 'rgba(60,80,120,.18)', x - 10, y, 20, 2); R(ctx, '#d8343c', x - 9, y - 7, 18, 6); R(ctx, '#f07a7a', x - 9, y - 7, 18, 1); R(ctx, '#a8282e', x - 9, y - 2, 18, 1); R(ctx, '#8a5a30', x - 11, y - 1, 22, 2); R(ctx, '#8a5a30', x + 9, y - 9, 2, 8); R(ctx, '#f4f1ea', x - 6, y - 10, 1, 3); R(ctx, '#f4f1ea', x - 12, y - 12, 7, 1);
}
export function ritaSnorok(ctx, x, y, t) { for (let k = 0; k < 6; k++) { const u = (t * 2 + k / 6) % 1; ctx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(x - 6 + k * 2 + Math.sin(k) * 2), Math.round(y - 2 - u * 10), 2, 2); } }
export function ritaUtsikt(ctx, cx, VW, N) { void cx; void VW; void N; }
export const _p = { put, bild, LIFT, VARMESTUGA, UTHYRNING, TOPPSTUGA };
