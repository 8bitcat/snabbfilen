// 🌊 VATTENLANDETS HUS OCH REKVISITA – ritas y-sorterat av scenen (js/scenes/vattenlandet.js): ENTRÉHUSET med kassan och
// VATTENLANDET-skylten, OMKLÄDNINGSRUMMET, KIOSKEN med randig markis och menytavla, RUTSCHTORNET (stålställning, trappor,
// tre plattformar, flagga) och KANORNA (tjocka färgade rör på stolpar med ljusrand), staketet och vändkorset, svampfontänen,
// badvaktstornet, solstolar och parasoller, duschen, palmer, badringar, plasket, vågorna över vågpoolen (per bildruta),
// skyltar och hållplatsen. Cachade bilder (origo = foten), ett pixelkorn, ljuset från vänster.
import { Pix, SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { KASSA, OMKLADNING, KIOSK, TORN, STAKET, VANDKORS, SVAMP, BADVAKT, DUSCH, SKYLT, HALLPLATS, VAGPOOL, KANOR, GLASS_PRIS, POMMES_PRIS, MELON_PRIS, OPPETTEXT } from './karta.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, STEN, TRA } = FARGER;
const BLA = [0x1e4a90, 0x2a6ab8, 0x3a8ad8, 0x6ab0e8, 0x9ad0f4];
const GUL = [0x9a6c0c, 0xd8a020, 0xf0c030, 0xffe070, 0xfff0a0];
const ROSA = [0x8a2058, 0xc04080, 0xe060a0, 0xf090c0, 0xffc0e0];
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w, a = 0.2) => { ctx.fillStyle = `rgba(40,30,60,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function fonster(P, x, y, w, h, natt) { P.rect(x - 1, y - 1, w + 2, h + 2, VIT[3]); P.rect(x, y, w, h, natt ? 0xffe8a0 : 0x8ab4d8); if (!natt) P.px(x, y, 0xc8e4f8); P.vl(x + (w >> 1), y, h, VIT[3]); }
function skylt(P, s, cx, y, bg, fg, ram = fg) { const tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 5, y, tw + 10, 10, bg); P.box(cx - (tw >> 1) - 5, y, tw + 10, 10, ram); text(P, SMALL, s, cx - (tw >> 1), y + 2, fg); }

// ---------- husen (fasaden står på y) ----------
function husBild(H, typ, natt) {
  return bild(`hus|${typ}|${natt}`, H.w + 24, H.h + 70, 12, H.h + 66, (P) => {
    const w = H.w, h = H.h, cx = w >> 1;
    if (typ === 'kassa') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(VIT, 0.78 - (X / w) * 0.06 + (hash(X >> 3, Y >> 3, 3) - 0.5) * 0.05, X, Y));
      for (let x = 0; x < w; x += 1) P.px(x, -h + 10 + ((x >> 3) & 1 ? 0 : 1), BLA[2]);                            // en blå rand
      P.rect(-4, -h - 8, w + 8, 10, BLA[1]); P.hl(-4, -h - 8, w + 8, BLA[3]); for (let x = -4; x < w + 4; x += 6) P.rect(x, -h + 2, 4, 3, BLA[1]);   // platt tak med list och tandad kant
      const s = $t('VATTENLANDET'), tw = textW(SMALL, s); P.rect(cx - (tw >> 1) - 8, -h - 26, tw + 16, 16, BLA[0]); P.box(cx - (tw >> 1) - 8, -h - 26, tw + 16, 16, GUL[2]); text(P, SMALL, s, cx - (tw >> 1), -h - 22, GUL[3]);
      spr(P, cx - (tw >> 1) - 20, -h - 24, ['..bb..', '.bbbb.', 'bbbbbb', '.bwwb.', '..bb..'], { b: BLA[3], w: 0xffffff });   // en droppe
      spr(P, cx + (tw >> 1) + 12, -h - 24, ['..bb..', '.bbbb.', 'bbbbbb', '.bwwb.', '..bb..'], { b: BLA[3], w: 0xffffff });
      const lx0 = H.lucka.x0 - H.x, lw = H.lucka.x1 - H.lucka.x0;
      P.rect(lx0 - 2, -40, lw + 4, 30, BLA[0]); P.rect(lx0, -38, lw, 22, natt ? 0x2a2a3a : 0xa8d0f0); P.vl(lx0 + (lw >> 1), -38, 22, BLA[0]);   // kassaluckan
      P.rect(lx0 - 4, -14, lw + 8, 4, TRA[2]); P.hl(lx0 - 4, -14, lw + 8, TRA[3]);                                             // disken
      skylt(P, $t('KASSA'), lx0 + (lw >> 1), -52, GUL[2], BLA[0]);
      fonster(P, 14, -h + 20, 18, 16, natt); fonster(P, w - 32, -h + 20, 18, 16, natt);
      const o = OPPETTEXT(), ow = textW(SMALL, o); P.rect(8, -h + 42, ow + 6, 9, 0xf4f1ea); text(P, SMALL, o, 11, -h + 44, BLA[0]);     // öppettiderna
    } else if (typ === 'omkladning') {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(GUL, 0.62 - (X / w) * 0.05 + ((Y + h) % 14 === 0 ? -0.1 : 0) + (hash(X >> 3, Y >> 3, 4) - 0.5) * 0.05, X, Y));
      for (let j = 0; j < 10; j++) P.hl(-6 + j, -h - 10 + j, w + 12 - j * 2, j % 2 ? 0x8a6a40 : 0xa88450);                        // lågt sadeltak
      const dw = H.door.x1 - H.door.x0, dx = H.door.x0 - H.x;
      P.rect(dx - 1, -34, dw + 2, 34, BLA[0]); P.rect(dx + 1, -32, dw - 4, 30, BLA[2]); P.px(dx + dw - 5, -17, MASS[3]);
      spr(P, dx + 2, -28, ['.w.w.', 'wwwww', '.www.', '.w.w.', '.w.w.'], { w: 0xffffff }); spr(P, dx + dw - 10, -28, ['.w.w.', 'wwwww', '.www.', '.w.w.', '..w..'], { w: 0xffffff });   // figurerna på dörren
      skylt(P, $t('OMKLÄDNING'), cx, -h + 8, BLA[0], 0xf4f1ea);
      P.rect(10, -h + 24, 3, 14, JARN[2]); P.rect(13, -h + 24, 12, 10, ROSA[3]); P.rect(13, -h + 24, 12, 2, ROSA[1]); P.rect(13, -h + 30, 12, 2, ROSA[1]);   // handduken på kroken
      P.rect(w - 30, -h + 24, 3, 14, JARN[2]); P.rect(w - 27, -h + 24, 12, 10, BLA[3]); P.rect(w - 27, -h + 26, 12, 2, BLA[1]);
      fonster(P, 36, -h + 22, 12, 8, natt); fonster(P, w - 48, -h + 22, 12, 8, natt);
    } else {
      fyll(P, 0, -h, w - 1, 0, (X, Y) => tone(VIT, 0.72 + (hash(X >> 3, Y >> 3, 5) - 0.5) * 0.06, X, Y));
      for (let x = -6; x < w + 6; x++) for (let j = 0; j < 12; j++) if (j < 9 || ((x + 3) % 6) < 3) P.px(x, -h - 2 + j, ((x + j) % 12) < 6 ? 0xd8343c : 0xf4f1ea);   // randig markis med tandad kant
      P.hl(-6, -h - 3, w + 12, 0x8a1820);
      const lx0 = H.lucka.x0 - H.x, lw = H.lucka.x1 - H.lucka.x0;
      P.rect(lx0 - 2, -44, lw + 4, 34, 0x5a3a20); P.rect(lx0, -42, lw, 26, natt ? 0x2a2a3a : 0xf8e8c0);
      spr(P, lx0 + 4, -36, ['.ppp.', 'ppppp', '.www.', '.www.', '..w..'], { p: ROSA[2], w: 0xf0d8a0 }); spr(P, lx0 + 14, -36, ['.ggg.', 'ggggg', '.www.', '.www.', '..w..'], { g: 0x7ac060, w: 0xf0d8a0 });   // glassar i luckan
      spr(P, lx0 + lw - 14, -38, ['yyyy', 'y..y', 'yyyy', 'rrrr', 'rrrr'], { y: GUL[3], r: 0xd8343c }); P.rect(lx0 + lw - 13, -40, 1, 3, GUL[3]); P.rect(lx0 + lw - 10, -41, 1, 4, GUL[3]); P.rect(lx0 + lw - 7, -40, 1, 3, GUL[3]);   // pommesbägaren
      P.rect(lx0 - 4, -16, lw + 8, 4, TRA[2]); P.hl(lx0 - 4, -16, lw + 8, TRA[3]);
      skylt(P, $t('KIOSKEN'), cx, -h + 12, 0xd8343c, 0xf4f1ea);
      const rows = [`${$t('GLASS')} ${GLASS_PRIS}`, `${$t('POMMES')} ${POMMES_PRIS}`, `${$t('MELON')} ${MELON_PRIS}`];
      P.rect(4, -h + 24, 58, 32, 0x2a2a30); P.box(4, -h + 24, 58, 32, TRA[3]); rows.forEach((r, i) => text(P, SMALL, r, 8, -h + 27 + i * 9, i === 0 ? ROSA[4] : 0xf4f1ea));   // menytavlan
    }
    for (let x = 0; x < w; x++) P.px(x, 1, 0x3a3a60, 0.25);
  });
}
export function ritaHus(ctx, H, typ, natt) { put(ctx, husBild(H, typ, natt), H.x + 12, H.y + 4); }

// ---------- rutschtornet och kanorna ----------
export function ritaTorn(ctx, natt) {
  const T = TORN;
  put(ctx, bild(`torn|${natt}`, T.w + 40, T.h + 60, 20, T.h + 56, (P) => {
    const w = T.w, h = T.h;
    // fyra stolpar, kryss, tre plattformar med räcke, trappor i sicksack, flaggan högst upp
    for (const px of [6, w - 12]) { P.rect(px, -h, 6, h, JARN[1]); P.vl(px, -h, h, JARN[3]); P.vl(px + 5, -h, h, JARN[0]); }
    for (let y = -h + 8; y < -4; y += 28) { for (let i = 0; i < w - 12; i++) { P.px(6 + i, y + Math.round(i / (w - 12) * 24), JARN[2]); P.px(6 + i, y + 24 - Math.round(i / (w - 12) * 24), JARN[2]); } }
    const platt = (yy, x0, x1) => { P.rect(x0, yy, x1 - x0, 5, BLA[1]); P.hl(x0, yy, x1 - x0, BLA[3]); for (let x = x0; x < x1; x += 6) P.vl(x, yy - 14, 14, VIT[3]); P.hl(x0, yy - 14, x1 - x0, VIT[3]); P.hl(x0, yy - 8, x1 - x0, VIT[2]); };
    for (const K of KANOR) platt(-K.hojd, 20, w - 4);
    for (let i = 0; i < 3; i++) { const y0 = -[0, 56, 84][i], y1 = -[56, 84, 112][i], steps = Math.round((y0 - y1) / 4); for (let s = 0; s < steps; s++) { const u = s / steps, x = i % 2 ? 24 + u * 60 : 84 - u * 60; P.rect(Math.round(x), y0 - s * 4, 10, 2, i % 2 ? GUL[2] : GUL[1]); } }
    P.vl(w >> 1, -h - 30, 30, JARN[2]); P.rect((w >> 1) + 1, -h - 30, 14, 9, BLA[2]); P.rect((w >> 1) + 1, -h - 27, 14, 3, 0xffffff); P.rect((w >> 1) + 1, -h - 24, 14, 3, 0xd8343c);
    const s = $t('RUTSCHTORNET'), tw = textW(SMALL, s); P.rect((w >> 1) - (tw >> 1) - 5, -h - 14, tw + 10, 10, BLA[0]); text(P, SMALL, s, (w >> 1) - (tw >> 1), -h - 12, GUL[3]);
    if (natt) for (const K of KANOR) P.rect(22, -K.hojd - 10, 3, 3, 0xffe080);
    for (let x = 0; x < w; x++) P.px(x, 1, 0x3a3a60, 0.25);
  }), T.x + 20, T.y + 4);
}
// kanan: ett tjockt rör längs banan (punkterna i världen), ljus rand ovanpå, mörk kant under, stolpar ner till marken
export function ritaKana(ctx, K, natt) {
  // bilden täcker världens x 1080–1500, y 0–360 (origo förskjutet så att banans världskoordinater kan ritas rakt av)
  put(ctx, bild(`kana|${K.id}|${natt}`, 420, 360, -1080, 0, (P) => {
    const pts = K.bana;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)));
      for (let j = 0; j <= n; j++) {
        const u = j / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u);
        for (let k = -6; k <= 6; k++) P.px(x, y + k, k === -6 ? mix(K.cl, 0xffffff, 0.5) : k === 6 ? mul(K.cd, 0.7) : k < -3 ? K.cl : k > 3 ? K.cd : k === -3 ? mix(K.c, K.cl, 0.5) : K.c);
        if ((i * 97 + j) % 9 === 0) P.px(x, y - 4, 0xffffff);   // blänk
      }
    }
    const [ex, ey] = pts[pts.length - 1]; P.rect(ex - 8, ey - 6, 17, 12, mul(K.cd, 0.8)); P.rect(ex - 6, ey - 4, 13, 8, 0x0a1a2a); for (let k = -6; k <= 6; k++) P.px(ex + k, ey + 5, K.cl);   // mynningen (mörk öppning)
    if (natt) for (let i = 0; i < pts.length; i++) P.rect(pts[i][0] - 1, pts[i][1] - 8, 2, 2, 0xffe080);
  }), 0, 0);
}
// stolparna ritas separat under röret så att de hamnar bakom folk på promenaden: smala stålrör ner till marken (y 296)
export function ritaKanaStolpar(ctx, K) {
  const pts = K.bana;
  for (let i = 1; i < pts.length - 1; i += 3) { const [x, y] = pts[i]; if (y > 280) continue; R(ctx, hex(JARN[2]), x - 1, y + 6, 2, 290 - y); R(ctx, hex(JARN[4] ?? JARN[3]), x - 1, y + 6, 1, 290 - y); R(ctx, hex(JARN[1]), x - 3, 294, 6, 3); R(ctx, 'rgba(40,30,60,.18)', x - 6, 296, 12, 2); }
}
export function kanaPos(K, u) {   // 0..1 längs banan → punkt
  const pts = K.bana; let L = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); L += d; }
  let s = u * L;
  for (let i = 0; i < seg.length; i++) { if (s <= seg[i]) { const v = seg[i] ? s / seg[i] : 0; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * v, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * v, dx: pts[i + 1][0] - pts[i][0] }; } s -= seg[i]; }
  const e = pts[pts.length - 1]; return { x: e[0], y: e[1], dx: 0 };
}

// ---------- staketet och vändkorset ----------
// staketet löper i y-led: vita stolpar var 12:e px med två blå rör emellan (sett snett uppifrån)
export function ritaStaketbit(ctx, y0, y1) {
  for (let y = y0; y < y1; y += 12) { R(ctx, '#f4f1ea', STAKET - 2, y - 20, 4, 21); R(ctx, '#c8c4bc', STAKET + 1, y - 20, 1, 21); R(ctx, '#ffffff', STAKET - 3, y - 21, 6, 2); R(ctx, 'rgba(40,30,60,.18)', STAKET - 3, y, 8, 2); }
  R(ctx, hex(BLA[2]), STAKET - 1, y0 - 16, 2, y1 - y0); R(ctx, hex(BLA[2]), STAKET - 1, y0 - 8, 2, y1 - y0);
}
export function ritaVandkors(ctx, open, t) {
  const { x, y0, y1 } = VANDKORS, cy = (y0 + y1) >> 1;
  // två portalstolpar med en skylt ovanför, snurrkorset i mitten och en bom som är nere tills man betalat
  for (const yy of [y0 - 2, y1 + 2]) { R(ctx, hex(BLA[1]), x - 4, yy - 44, 8, 44); R(ctx, hex(BLA[3]), x - 4, yy - 44, 2, 44); R(ctx, hex(BLA[0]), x + 2, yy - 44, 2, 44); R(ctx, '#f4f1ea', x - 5, yy - 46, 10, 3); }
  R(ctx, hex(BLA[0]), x - 16, y0 - 54, 32, 12); R(ctx, hex(GUL[2]), x - 16, y0 - 54, 32, 1); R(ctx, hex(GUL[2]), x - 16, y0 - 43, 32, 1);
  for (let k = 0; k < 3; k++) R(ctx, '#f4f1ea', x - 9 + k * 7, y0 - 50, 5, 4);
  R(ctx, hex(JARN[1]), x - 2, cy - 18, 4, 18); R(ctx, hex(JARN[3]), x - 2, cy - 18, 1, 18); R(ctx, hex(JARN[2]), x - 5, cy - 1, 10, 3);
  const a = open ? t * 1.6 : 0.3;
  for (let k = 0; k < 3; k++) { const an = a + k * Math.PI * 2 / 3; const dx = Math.cos(an) * 14, dy = Math.sin(an) * 6; ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, cy - 14); ctx.lineTo(x + dx, cy - 14 + dy); ctx.stroke(); R(ctx, '#d8343c', x + dx - 1, cy - 15 + dy, 3, 3); }
  if (!open) { R(ctx, '#f4f1ea', x - 3, y0 - 2, 6, y1 - y0 + 4); for (let y = y0; y < y1; y += 6) R(ctx, '#d8343c', x - 3, y, 6, 3); }   // bommen
}

// ---------- fontänen, tornet, duschen ----------
export function ritaSvamp(ctx, t) {
  const { x, y } = SVAMP;
  for (let k = 0; k < 28; k++) { const an = k / 28 * Math.PI * 2, u = (t * 1.4 + k / 28) % 1; const r = 16 + u * 6; ctx.fillStyle = `rgba(230,245,255,${(0.9 - u * 0.7).toFixed(2)})`; ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y - 22 + u * 22 + Math.sin(an) * r * 0.4), 2, 3); }
  put(ctx, bild('svamp', 48, 44, 24, 40, (P) => { P.rect(-3, -28, 7, 28, ROSA[1]); P.vl(-3, -28, 28, ROSA[3]); P.vl(3, -28, 28, ROSA[0]); for (let j = 0; j < 12; j++) { const u = j / 11, w = Math.round(Math.sqrt(1 - (1 - u) ** 2) * 21); P.hl(-w, -40 + j, w * 2 + 1, j < 3 ? ROSA[4] : j < 9 ? ROSA[2] : ROSA[1]); } P.hl(-21, -29, 43, ROSA[0]); for (let k = 0; k < 6; k++) P.rect(-17 + k * 7, -37 + (k % 2) * 3, 3, 2, 0xffffff); }), x, y);
}
export function ritaBadvaktstorn(ctx, natt) {
  const { x, y } = BADVAKT;
  put(ctx, bild(`torn-bv|${natt}`, 50, 86, 25, 82, (P) => {
    for (const px of [-10, 8]) { P.rect(px, -56, 3, 56, VIT[3]); P.vl(px + 2, -56, 56, VIT[1]); }
    for (let i = 0; i < 18; i++) { P.px(-10 + i, -50 + Math.round(i / 18 * 20), VIT[2]); P.px(-10 + i, -30 - Math.round(i / 18 * 20), VIT[2]); }
    P.rect(-14, -62, 29, 6, VIT[3]); P.hl(-14, -62, 29, 0xffffff); P.rect(-14, -72, 29, 2, VIT[3]); for (let x = -14; x < 15; x += 7) P.vl(x, -72, 10, VIT[2]);
    for (let s = 0; s < 8; s++) P.rect(12 + s * 2, -s * 7, 6, 2, VIT[2]);                                                                   // stegen
    P.rect(-2, -58, 2, 8, 0xd8343c); P.rect(0, -58, 2, 8, 0xf4f1ea); P.rect(-10, -74, 21, 3, 0xd8343c); P.hl(-10, -74, 21, 0xf07a7a);       // skylt + rand
    P.rect(-4, -98, 2, 26, JARN[2]); for (let j = 0; j < 10; j++) { const w = 18 - j * 1.6; P.hl(Math.round(-3 - w), -98 + j, Math.round(w * 2), ((j >> 1) & 1) ? 0xd8343c : 0xf4f1ea); }   // parasollet
    skylt(P, $t('BADVAKT'), 0, -70, 0xd8343c, 0xf4f1ea, 0xf4f1ea);
    if (natt) P.rect(-2, -80, 4, 3, 0xffe080);
  }), x, y);
}
export function ritaDusch(ctx, pa, t) {
  const { x, y } = DUSCH;
  skugga(ctx, x, y, 10);
  R(ctx, hex(JARN[2]), x - 1, y - 60, 3, 60); R(ctx, hex(JARN[3]), x - 1, y - 60, 1, 58); R(ctx, hex(JARN[2]), x - 12, y - 60, 14, 3); R(ctx, hex(JARN[1]), x - 16, y - 58, 9, 4); R(ctx, hex(JARN[3]), x - 16, y - 58, 9, 1);
  R(ctx, '#d8343c', x + 3, y - 30, 4, 4); R(ctx, '#3a7bd5', x + 3, y - 24, 4, 4);
  if (pa) for (let k = 0; k < 12; k++) { const u = (t * 2.2 + k / 12) % 1; ctx.fillStyle = `rgba(220,240,255,${(0.9 - u * 0.5).toFixed(2)})`; ctx.fillRect(Math.round(x - 15 + (k % 4) * 2 + Math.sin(k) * 1), Math.round(y - 54 + u * 52), 1, 3); }
}

// ---------- solstolar, parasoller, palmer, bänkar ----------
const STOLFARG = [[0xd8343c, 0xf4f1ea], [0x3a7bd5, 0xf4f1ea], [0xf0c030, 0xf4f1ea], [0x46a35a, 0xf4f1ea]];
export function ritaSolstol(ctx, x, y, i) {
  const [a, b] = STOLFARG[i % STOLFARG.length];
  skugga(ctx, x, y, 28);
  put(ctx, bild(`solstol|${i % 4}`, 40, 34, 20, 30, (P) => {
    P.rect(-16, -4, 3, 4, VIT[1]); P.rect(13, -4, 3, 4, VIT[1]); P.rect(-6, -4, 2, 4, VIT[1]); P.rect(5, -4, 2, 4, VIT[1]);                  // benen
    P.rect(-17, -12, 34, 9, VIT[2]); P.hl(-17, -12, 34, VIT[3]); P.hl(-17, -4, 34, VIT[0]);                                                  // ramen
    for (let x = -15; x < 2; x++) for (let j = 0; j < 6; j++) P.px(x, -11 + j, ((x + 15) % 6) < 3 ? (j === 0 ? mix(a, 0xffffff, 0.3) : a) : b);   // dynan med ränder
    for (let j = 0; j < 14; j++) { const xx = 2 + Math.round(j * 0.9), yy = -11 - j; for (let k = 0; k < 6; k++) P.px(xx + k, yy, ((j) % 6) < 3 ? a : b); P.px(xx + 6, yy, mul(a, 0.6)); }   // ryggstödet lutat bakåt
    P.rect(-19, -14, 3, 3, VIT[3]); P.rect(16, -26, 3, 3, VIT[3]);                                                                            // armstöd
    P.rect(-14, -16, 10, 4, 0xf4f1ea); P.hl(-14, -16, 10, 0xd8d4cc);                                                                          // en handduk
  }), x, y);
}
export function ritaParasoll(ctx, x, y, i, t) {
  const [a, b] = STOLFARG[(i + 1) % STOLFARG.length];
  skugga(ctx, x + 4, y + 12, 36, 0.12);
  put(ctx, bild(`parasoll|${(i + 1) % 4}`, 48, 70, 24, 66, (P) => {
    P.rect(-1, -46, 3, 46, JARN[2]); P.vl(-1, -46, 46, JARN[3]);
    for (let j = 0; j < 14; j++) { const w = 22 - j * 1.5; for (let x = Math.round(-w); x <= Math.round(w); x++) P.px(x, -60 + j, ((Math.floor((x + 22) / 7) + 0) & 1) ? a : b); }
    for (let x = -22; x <= 22; x += 7) P.px(x, -46, mul(a, 0.6)); P.px(0, -62, GUL[2]); P.px(0, -61, GUL[2]);
  }), x, y - Math.round(Math.sin(t * 0.8 + x) * 0.5));
}
export function ritaPalm(ctx, x, y, s, t) {
  skugga(ctx, x + 6, y, 22 * s, 0.16);
  const sv = Math.sin(t * 0.9 + x * 0.01) * 1.5;
  put(ctx, bild(`palm|${s}`, 90, 100, 45, 96, (P) => {
    const H = Math.round(54 * s);
    for (let j = 0; j < H; j++) { const xx = Math.round(Math.sin(j / H * 1.2) * 8 * s); P.rect(xx - 2, -j, 5, 1, j % 5 === 0 ? 0x6a4a28 : 0x8a6a40); P.px(xx - 2, -j, 0x5a3a20); P.px(xx + 2, -j, 0xa8865a); }
    const tx = Math.round(Math.sin(1.2) * 8 * s), ty = -H;
    // åtta blad runt kronan: mittnerv med småblad på tvären, allt tyngre ju längre ut (hänger), ljusare på ovansidan
    for (let k = 0; k < 8; k++) {
      const an = k / 8 * Math.PI * 2 + 0.3, L = Math.round((k % 2 ? 24 : 20) * s), ex = Math.cos(an), ey = Math.sin(an) * 0.5, nx = -Math.sin(an), ny = Math.cos(an) * 0.5;
      const morkt = k % 2 ? 0x2a6e34 : 0x337a3c, ljust = k % 2 ? 0x46a050 : 0x58b060;
      for (let i = 0; i < L; i++) {
        const u = i / L, droop = u * u * 12, cxp = tx + ex * i, cyp = ty - 2 + ey * i + droop, w = Math.max(1, Math.round(4 * Math.sin(u * Math.PI) + (u < 0.9 ? 1 : 0)));
        for (let d = -w; d <= w; d++) { const px = Math.round(cxp + nx * d), py = Math.round(cyp + ny * d + Math.abs(d) * 0.4); P.px(px, py, d === 0 ? morkt : (d < 0 ? ljust : mix(morkt, ljust, 0.4))); }
      }
    }
    P.rect(tx - 3, ty - 1, 3, 3, 0x6a4a20); P.rect(tx + 1, ty, 3, 3, 0x8a5a28); P.rect(tx - 1, ty + 2, 3, 3, 0x5a3a18);   // kokosnötter
  }), x + sv, y);
}
export function ritaBank(ctx, x, y) { put(ctx, bild('bank', 36, 20, 18, 16, (P) => { P.rect(-16, -10, 32, 3, 0xc8a060); P.rect(-16, -6, 32, 3, 0xc8a060); P.rect(-16, -16, 32, 3, 0xb08850); P.rect(-14, -3, 2, 3, JARN[1]); P.rect(12, -3, 2, 3, JARN[1]); P.rect(-14, -16, 2, 13, JARN[1]); P.rect(12, -16, 2, 13, JARN[1]); }), x, y); }
export function ritaPapperskorg(ctx, x, y) { put(ctx, bild('korg', 12, 16, 6, 14, (P) => { P.rect(-4, -12, 9, 12, BLA[1]); P.rect(-4, -12, 9, 2, BLA[0]); for (let j = -10; j < -1; j += 3) P.hl(-3, j, 7, BLA[2]); P.rect(-5, -14, 11, 2, JARN[2]); }), x, y); }
export function ritaBlommor(ctx, x, y) { put(ctx, bild('urna', 24, 22, 12, 18, (P) => { P.rect(-7, -8, 14, 8, 0xb86a48); P.hl(-8, -9, 16, 0xd08860); for (let k = 0; k < 7; k++) { const px = -8 + k * 2.5, py = -12 - (k % 3) * 2; P.rect(Math.round(px), py, 2, 2, [0xd8343c, 0xf0c030, 0xf090c0, 0xffffff][k % 4]); P.px(Math.round(px), py + 2, 0x46a35a); } }), x, y); }

// ---------- i vattnet ----------
export function ritaBadring(ctx, x, y, c) { ctx.strokeStyle = hex(c); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) - 6, 9, 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) - 7, 9, 4, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
export function ritaPlask(ctx, x, y, u) {   // u 0..1
  for (let k = 0; k < 10; k++) { const an = -Math.PI * (0.15 + k / 10 * 0.7), r = u * 22, px = x + Math.cos(an) * r, py = y + Math.sin(an) * r * 0.8 + u * u * 24; ctx.fillStyle = `rgba(230,245,255,${(1 - u).toFixed(2)})`; ctx.fillRect(Math.round(px), Math.round(py), 2, 2); }
  ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - u)).toFixed(2)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), 6 + u * 16, 2 + u * 5, 0, 0, Math.PI * 2); ctx.stroke();
}
// vågorna över vågpoolen varje bildruta: krusningar som rullar söderut, vid "vågor" breda skumkammar
export function ritaVagor(ctx, t, styrka) {
  const { x0, y0, x1, y1 } = VAGPOOL;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8); ctx.clip();
  const n = 9;
  for (let k = 0; k < n; k++) {
    const u = ((t * (0.08 + styrka * 0.12) + k / n) % 1), y = y0 + 8 + u * (y1 - y0 - 16);
    const a = (0.12 + styrka * 0.45) * (1 - Math.abs(u - 0.5) * 0.6);
    ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.lineWidth = 1 + styrka * 2;
    ctx.beginPath(); for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, y + Math.sin(x / 18 + t * 2 + k) * (1.5 + styrka * 3)); ctx.stroke();
    if (styrka > 0.3) { ctx.fillStyle = `rgba(255,255,255,${(styrka * 0.5).toFixed(2)})`; for (let x = x0 + 6; x < x1; x += 7) if (hash(x >> 2, k, 3) > 0.5) ctx.fillRect(x, Math.round(y + Math.sin(x / 18 + t * 2 + k) * 3) - 2, 3, 2); }
  }
  ctx.restore();
  if (styrka > 0) { ctx.fillStyle = `rgba(255,255,255,${(styrka * 0.5).toFixed(2)})`; for (let x = x0 + 2; x < x1; x += 5) ctx.fillRect(x, y0 - 4 + Math.round(Math.sin(x / 7 + t * 9) * 2), 3, 2); }   // skummet vid vågmaskinen
}
export function ritaGlitter(ctx, x0, y0, x1, y1, t) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 14; k++) { const u = (t * 0.5 + k * 0.37) % 1; if (Math.sin(u * Math.PI * 2 + k) < 0.6) continue; ctx.fillRect(x0 + 6 + Math.round(hash(k, 1, 4) * (x1 - x0 - 12)), y0 + 6 + Math.round(hash(k, 2, 4) * (y1 - y0 - 12)), 2, 1); } }

// ---------- skyltar och hållplatsen ----------
export function ritaSkylt(ctx) {
  const { x, y } = SKYLT;
  put(ctx, bild('skylt', 150, 46, 75, 44, (P) => {
    P.rect(-3, -34, 5, 34, BLA[1]); P.vl(-3, -34, 34, BLA[3]);
    const s1 = $t('VATTENLANDET'), s2 = $t('RUTSCHKANOR · VÅGPOOL · SOLDÄCK'), w = Math.max(textW(SMALL, s1), textW(SMALL, s2)) + 14;
    P.rect(-(w >> 1), -42, w, 24, BLA[0]); P.box(-(w >> 1), -42, w, 24, GUL[2]); P.hl(-(w >> 1) + 1, -41, w - 2, BLA[3]);
    text(P, SMALL, s1, -(textW(SMALL, s1) >> 1), -39, GUL[3]); text(P, SMALL, s2, -(textW(SMALL, s2) >> 1), -29, 0xf4f1ea);
  }), x, y);
}
export function ritaHallplats(ctx) { const { x, y } = HALLPLATS; R(ctx, '#1c2026', x, y - 26, 2, 26); R(ctx, '#2a5aa8', x - 6, y - 34, 14, 9); R(ctx, '#f4ecd8', x - 5, y - 33, 12, 7); R(ctx, '#2a5aa8', x - 3, y - 31, 8, 1); R(ctx, '#2a5aa8', x - 3, y - 29, 6, 1); R(ctx, '#2a5aa8', x - 3, y - 28, 8, 1); R(ctx, '#f4f8fc', x - 7, y - 36, 16, 2); }
export { STOLFARG };
