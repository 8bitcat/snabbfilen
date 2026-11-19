// 🏊 SIMHALLEN PÅ ARENATORGET inifrån (Carl 2026-11-18: "Arenan: … simhall"; arenan.js lovade "bassäng, rutschkana och
// bubbelpool"). Rummet är 640 px brett och rullar med figuren. Väggen (y < 72): dörren UT, omklädningsrummets dörr,
// kassan/receptionen, de höga fönstren med himlen, klockan, skylten SIMHALLEN, badvaktsstolen och RUTSCHKANAN som
// kommer ut ur väggen i tre kurvor och landar i bassängens bortre hörn. På golvet: den stora 25-METERSBASSÄNGEN med
// fyra banor och linor, stegarna, BUBBELPOOLEN (rund, bubblor), BASTUN (en liten träkabin med glasdörr), bänkar och
// en palm i kruka. Golvet: ljusblått kakel med halkskydd, vatten som skvätt. Allt stillastående målas EN gång
// (paintSimhallBg); vattnets glitter, bubblorna, kanans vatten och ångan ritas levande av scenen.
import { Pix, SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, JARN, TRA } = FARGER;
const KAKEL = [0xa8c8e0, 0xc8e0ee, 0xe0eef6, 0xf0f6fa];
const VAGG = [0xd8e8ee, 0xe8f2f6, 0xf4f8fa];
const VATTEN = [0x1a5aa0, 0x2a7ac0, 0x4a9ad8, 0x7ac0ec];
const GUL = [0x9a6c0c, 0xd8a020, 0xf0c030, 0xffe070];

export const SIM = {
  W: 640, H: 216, WALL_Y: 72,
  DOOR: { x0: 14, x1: 46 },
  OMKL: { x0: 60, x1: 92 },
  KASSA: { x: 110, y: 92, w: 50, h: 18 },
  FONSTER: [{ x0: 180, x1: 240 }, { x0: 260, x1: 320 }, { x0: 340, x1: 400 }],
  KLOCKA: { x: 430, y: 24 },
  STOL: { x: 468, y: 88 },                                      // badvaktens höga stol (golv, foten)
  KANA: { x0: 520, bana: [[612, 20], [590, 34], [556, 40], [540, 56], [566, 70], [588, 86], [566, 104], [538, 110]], mynning: [538, 110] },   // rutschkanan: punkter i världen, slutet i bassängen
  BASSANG: { x0: 128, y0: 100, x1: 560, y1: 196, banor: 4 },
  STEGE: { x: 136, y: 196 },                                    // stegen ner (sydvästra hörnet)
  STEGE2: { x: 552, y: 196 },
  BUBBEL: { x: 602, y: 164, rx: 26, ry: 14 },
  BASTU: { x: 596, y: 110, w: 40, h: 28 },                      // bastukabinen (golv)
  BANKAR: [[60, 150], [60, 190]],
  PALM: { x: 100, y: 200 },
  PRIS: 40, OPPET: [7, 21],
};
const { W, H, WALL_Y, DOOR, OMKL, FONSTER, KLOCKA, KANA, BASSANG, BUBBEL } = SIM;

let BGc = null;
export function paintSimhallBg() {
  if (BGc) return BGc;
  const P = new Pix(W, H);
  // väggen: ljust kakel upp till en blå bård, vitt ovanför
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, y < 30 ? tone(VAGG, 0.6 + (hash(x >> 3, y >> 3, 3) - 0.5) * 0.05, x, y) : (x % 8 === 7 || y % 8 === 7) ? KAKEL[0] : tone(KAKEL, 0.68 + (hash(x >> 3, y >> 3, 4) - 0.5) * 0.08, x, y));
  for (let x = 0; x < W; x++) { P.px(x, 30, 0x2a5aa8); P.px(x, 31, 0x3a7bd5); P.px(x, WALL_Y - 2, 0x8aa8c0); P.px(x, WALL_Y - 1, 0xc8dce8); }
  // dörrarna: UT och OMKLÄDNING
  for (const [D, s, c] of [[DOOR, $t('UT'), 0x3a7bd5], [OMKL, $t('OMKL.'), 0xe060a0]]) { P.rect(D.x0 - 3, 12, D.x1 - D.x0 + 6, WALL_Y - 12, VIT[3]); P.rect(D.x0, 16, D.x1 - D.x0, WALL_Y - 16, c); P.rect(D.x0 + 4, 24, D.x1 - D.x0 - 8, 14, 0xd8ecf8); P.px(D.x1 - 5, 46, GUL[3]); const w = textW(SMALL, s); P.rect(D.x0 + ((D.x1 - D.x0 - w - 6) >> 1), 2, w + 6, 9, 0x2a3a4a); text(P, SMALL, s, D.x0 + ((D.x1 - D.x0 - w) >> 1), 4, 0x8ae08a); }
  // fönstren: himmel och moln
  for (const F of FONSTER) { P.rect(F.x0 - 2, 6, F.x1 - F.x0 + 4, 48, VIT[3]); for (let y = 8; y < 52; y++) for (let x = F.x0; x < F.x1; x++) P.px(x, y, mix(0x7ab8e8, 0xd0e8f8, (y - 8) / 44)); P.vl((F.x0 + F.x1) >> 1, 8, 44, VIT[3]); P.hl(F.x0, 30, F.x1 - F.x0, VIT[3]); for (let k = 0; k < 3; k++) { const cx = F.x0 + 8 + k * 18, cy = 14 + (k % 2) * 8; P.rect(cx, cy, 10, 3, 0xffffff); P.rect(cx + 2, cy - 1, 6, 1, 0xffffff); } }
  // klockan och skylten
  for (let a = 0; a < 48; a++) { const an = a / 48 * Math.PI * 2; P.px(Math.round(KLOCKA.x + Math.cos(an) * 9), Math.round(KLOCKA.y + Math.sin(an) * 9), JARN[2]); }
  for (let y = KLOCKA.y - 8; y <= KLOCKA.y + 8; y++) for (let x = KLOCKA.x - 8; x <= KLOCKA.x + 8; x++) if (Math.hypot(x - KLOCKA.x, y - KLOCKA.y) < 8.5) P.px(x, y, 0xfaf6ea);
  const s = $t('SIMHALLEN'), sw = textW(SMALL, s); P.rect(470 - (sw >> 1) - 6, 10, sw + 12, 12, 0x2a5aa8); P.box(470 - (sw >> 1) - 6, 10, sw + 12, 12, 0xf4f1ea); text(P, SMALL, s, 470 - (sw >> 1), 13, 0xf4f1ea);
  // golvet: ljust kakel med mörkare fogar, halkskyddsränder runt bassängen
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) { const fog = (x % 10 === 9) || ((y - WALL_Y) % 10 === 9); P.px(x, y, fog ? 0x9ab8cc : tone(KAKEL, 0.7 + (hash(x >> 2, y >> 2, 6) - 0.5) * 0.1, x, y)); }
  // bassängen: kakelkant, vatten (djupare mitt i), banlinorna med flöten, startpallarna
  const B = BASSANG;
  for (let y = B.y0 - 5; y <= B.y1 + 4; y++) for (let x = B.x0 - 5; x <= B.x1 + 5; x++) {
    const inne = x >= B.x0 && x <= B.x1 && y >= B.y0 && y <= B.y1;
    if (!inne) { P.px(x, y, ((x + y) & 2) ? 0xf4f1ea : 0x3a7bd5); continue; }
    const d = Math.min(x - B.x0, B.x1 - x, y - B.y0, B.y1 - y);
    if (d < 3) { P.px(x, y, VATTEN[2]); continue; }
    const u = (y - B.y0) / (B.y1 - B.y0), dj = Math.min(1, Math.min(u, 1 - u) * 3);
    let c = mix(VATTEN[3], VATTEN[1], dj * 0.8 + (hash(x >> 2, y >> 2, 7) - 0.5) * 0.2);
    if (hash(x >> 2, y, 8) > 0.95 && (x + y) % 3 === 0) c = mix(c, 0xffffff, 0.3);
    P.px(x, y, c);
  }
  for (let b = 1; b < B.banor; b++) { const y = B.y0 + Math.round((B.y1 - B.y0) * b / B.banor); for (let x = B.x0 + 3; x < B.x1 - 3; x++) P.px(x, y, ((x >> 2) & 1) ? 0xd8343c : 0xf4f1ea); }
  for (let x = B.x0 + 3; x < B.x1 - 3; x += 6) P.px(x, (B.y0 + B.y1) >> 1, 0x1a1a1a);   // mittlinjen (T:n) i botten – antydd
  for (let b = 0; b < B.banor; b++) { const y = B.y0 + Math.round((B.y1 - B.y0) * (b + 0.5) / B.banor); P.rect(B.x0 - 12, y - 4, 8, 8, VIT[3]); P.rect(B.x0 - 12, y - 4, 8, 2, 0x3a7bd5); text(P, SMALL, String(b + 1), B.x0 - 10, y - 2, 0x2a3a4a); }   // startpallar med nummer
  // bubbelpoolen: rund, träkant
  for (let y = BUBBEL.y - BUBBEL.ry - 4; y <= BUBBEL.y + BUBBEL.ry + 4; y++) for (let x = BUBBEL.x - BUBBEL.rx - 4; x <= BUBBEL.x + BUBBEL.rx + 4; x++) { const d = ((x - BUBBEL.x) / BUBBEL.rx) ** 2 + ((y - BUBBEL.y) / BUBBEL.ry) ** 2; if (d > 1.4) continue; if (d > 1) { P.px(x, y, tone(TRA, 0.5 + (hash(x >> 1, y >> 1, 9) - 0.5) * 0.2, x, y)); continue; } P.px(x, y, mix(0x6ab8e8, 0x3a8ac8, d * 0.6 + (hash(x, y, 10) - 0.5) * 0.3)); }
  // vattenskvätt på golvet runt bassängen
  for (let k = 0; k < 60; k++) { const x = B.x0 - 20 + ((hash(k, 1, 11) * (B.x1 - B.x0 + 40)) | 0), y = hash(k, 2, 11) < 0.5 ? B.y0 - 6 - ((hash(k, 3, 11) * 14) | 0) : B.y1 + 6 + ((hash(k, 3, 11) * 12) | 0); if (y >= WALL_Y && y < H) P.rect(x, y, 2 + ((hash(k, 4, 11) * 3) | 0), 1, 0x8ab8d8); }
  BGc = P.flush(); return BGc;
}

// ---------- saker på golvet och väggen (ritas av scenen) ----------
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
export function ritaKana(ctx, t) {
  // röret: gult med ljusrand, på stolpar; vattnet som rinner (prickar som följer banan)
  put(ctx, bild('simkana', 140, 120, -500, 0, (P) => {
    const pts = KANA.bana;
    for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0))); for (let j = 0; j <= n; j++) { const u = j / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u); for (let k = -5; k <= 5; k++) P.px(x, y + k, k === -5 ? GUL[3] : k === 5 ? GUL[0] : k < -2 ? GUL[2] : k > 2 ? GUL[1] : mix(GUL[2], GUL[1], 0.5)); } }
    for (const i of [1, 3, 5]) { const [x, y] = pts[i]; P.rect(x - 1, y + 5, 3, 120 - y - 10, JARN[1]); P.vl(x - 1, y + 5, 120 - y - 10, JARN[3]); }
    const [ex, ey] = KANA.mynning; P.rect(ex - 7, ey - 5, 14, 10, 0x0a2a4a); P.box(ex - 8, ey - 6, 16, 12, GUL[1]);
    const s = $t('RUTSCHKANAN'); P.rect(560, 4, textW(SMALL, s) + 8, 10, GUL[1]); text(P, SMALL, s, 564, 6, 0x2a1a0c);
  }), 0, 0);
  for (let k = 0; k < 10; k++) { const u = (t * 0.35 + k / 10) % 1, p = kanaPos(u); ctx.fillStyle = `rgba(220,240,255,${(0.6).toFixed(2)})`; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 2, 2, 1); }
}
export function kanaPos(u) {
  const pts = KANA.bana; let L = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); L += d; }
  let s = u * L;
  for (let i = 0; i < seg.length; i++) { if (s <= seg[i]) { const v = seg[i] ? s / seg[i] : 0; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * v, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * v, dx: pts[i + 1][0] - pts[i][0] }; } s -= seg[i]; }
  const e = pts[pts.length - 1]; return { x: e[0], y: e[1], dx: 0 };
}
export function ritaStol(ctx, x, y) {
  put(ctx, bild('bvstol', 30, 60, 15, 56, (P) => { for (const px of [-8, 6]) { P.rect(px, -40, 3, 40, VIT[3]); P.vl(px + 2, -40, 40, VIT[1]); } P.rect(-10, -44, 21, 5, VIT[3]); P.hl(-10, -44, 21, 0xffffff); P.rect(-10, -54, 21, 2, VIT[3]); for (let s = 0; s < 6; s++) P.rect(8 + s, -s * 6, 5, 2, VIT[2]); P.rect(-6, -52, 13, 6, 0xd8343c); P.rect(-4, -51, 9, 2, 0xf4f1ea); }), x, y);
}
export function ritaStege(ctx, x, y) { ctx.fillStyle = css(JARN[3]); ctx.fillRect(x - 6, y - 14, 2, 16); ctx.fillRect(x + 4, y - 14, 2, 16); for (let k = 0; k < 3; k++) ctx.fillRect(x - 5, y - 12 + k * 5, 10, 1); ctx.fillStyle = css(JARN[1]); ctx.fillRect(x - 6, y - 15, 2, 2); ctx.fillRect(x + 4, y - 15, 2, 2); }
export function ritaBastu(ctx, t, pa) {
  const Bz = SIM.BASTU;
  put(ctx, bild('bastu', Bz.w + 10, Bz.h + 50, 5, Bz.h + 46, (P) => { fyll(P, 0, -Bz.h - 20, Bz.w - 1, 0, (X, Y) => tone(TRA, 0.55 + ((Y % 6) === 0 ? -0.15 : 0) + (hash(X >> 3, Y >> 2, 12) - 0.5) * 0.08, X, Y)); P.rect(-3, -Bz.h - 24, Bz.w + 6, 5, TRA[1]); P.hl(-3, -Bz.h - 24, Bz.w + 6, TRA[3]); P.rect(6, -Bz.h - 10, 14, 26, 0xa8d0e8); P.box(5, -Bz.h - 11, 16, 28, TRA[0]); P.px(17, -Bz.h + 4, GUL[3]); P.rect(24, -Bz.h - 8, 12, 10, 0x1a1a1a); for (let k = 0; k < 4; k++) P.rect(25 + k * 3, -Bz.h - 7 + (k % 2) * 3, 2, 2, 0xd8343c); const s = $t('BASTU'); P.rect(((Bz.w - textW(SMALL, s)) >> 1) - 3, -Bz.h - 20, textW(SMALL, s) + 6, 9, 0xf4f1ea); text(P, SMALL, s, (Bz.w - textW(SMALL, s)) >> 1, -Bz.h - 18, 0x5a3a20); }), Bz.x + 5, Bz.y + Bz.h + 4);
  if (pa) for (let k = 0; k < 6; k++) { const u = (t * 0.4 + k / 6) % 1; ctx.fillStyle = `rgba(240,245,250,${(0.5 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(Bz.x + 10 + k * 5 + Math.sin(u * 4 + k) * 3), Math.round(Bz.y - 20 - u * 24), 3 + Math.round(u * 4), 2); }
}
export function ritaBubblor(ctx, t) {
  for (let k = 0; k < 14; k++) { const u = (t * 0.7 + k / 14) % 1, an = k / 14 * Math.PI * 2; const x = BUBBEL.x + Math.cos(an) * BUBBEL.rx * 0.7 * (0.5 + hash(k, 1, 13) * 0.5), y = BUBBEL.y + Math.sin(an) * BUBBEL.ry * 0.7 - u * 4; ctx.fillStyle = `rgba(255,255,255,${(0.9 - u * 0.6).toFixed(2)})`; ctx.fillRect(Math.round(x), Math.round(y), u < 0.5 ? 1 : 2, u < 0.5 ? 1 : 2); }
}
export function ritaGlitter(ctx, t) {
  const B = BASSANG; ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let k = 0; k < 24; k++) { const u = (t * 0.5 + k * 0.37) % 1; if (Math.sin(u * Math.PI * 2 + k) < 0.6) continue; ctx.fillRect(B.x0 + 6 + Math.round(hash(k, 1, 14) * (B.x1 - B.x0 - 12)), B.y0 + 6 + Math.round(hash(k, 2, 14) * (B.y1 - B.y0 - 12)), 2, 1); }
}
export function ritaPlask(ctx, x, y, u) {
  for (let k = 0; k < 10; k++) { const an = -Math.PI * (0.15 + k / 10 * 0.7), r = u * 20, px = x + Math.cos(an) * r, py = y + Math.sin(an) * r * 0.8 + u * u * 22; ctx.fillStyle = `rgba(230,245,255,${(1 - u).toFixed(2)})`; ctx.fillRect(Math.round(px), Math.round(py), 2, 2); }
}
export function ritaKlocka(ctx, min) {
  const h = ((min / 60) % 12) / 12 * Math.PI * 2 - Math.PI / 2, m = ((min % 60) / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#22202a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(KLOCKA.x, KLOCKA.y); ctx.lineTo(KLOCKA.x + Math.cos(h) * 4, KLOCKA.y + Math.sin(h) * 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(KLOCKA.x, KLOCKA.y); ctx.lineTo(KLOCKA.x + Math.cos(m) * 6, KLOCKA.y + Math.sin(m) * 6); ctx.stroke();
}
export function ritaBank(ctx, x, y) { put(ctx, bild('simbank', 30, 16, 15, 14, (P) => { P.rect(-13, -8, 26, 3, VIT[3]); P.rect(-13, -4, 26, 2, VIT[2]); P.rect(-11, -2, 2, 2, JARN[1]); P.rect(9, -2, 2, 2, JARN[1]); P.rect(-13, -12, 26, 2, 0x3a7bd5); }), x, y); }
export function ritaKassa(ctx) {
  const K = SIM.KASSA;
  put(ctx, bild('simkassa', K.w + 4, K.h + 24, 2, K.h + 20, (P) => { fyll(P, 0, -K.h, K.w - 1, 0, (X, Y) => tone([0x2a5aa8, 0x3a7bd5, 0x5a9ae8], 0.5 + ((Y + K.h) % 5 === 0 ? -0.2 : 0), X, Y)); P.rect(-2, -K.h - 3, K.w + 4, 4, VIT[3]); P.rect(6, -K.h - 12, 12, 8, 0x2a2a30); P.rect(7, -K.h - 11, 10, 5, 0x8ae08a); const s = $t('ENTRÉ'); P.rect(((K.w - textW(SMALL, s)) >> 1) - 3, -K.h + 4, textW(SMALL, s) + 6, 9, 0xf4f1ea); text(P, SMALL, s, (K.w - textW(SMALL, s)) >> 1, -K.h + 6, 0x2a5aa8); }), K.x + 2, K.y + K.h + 4);
}
export { W as SIM_W, H as SIM_H };
