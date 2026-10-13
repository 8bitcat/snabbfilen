// 🎭 TEMALÄNDERNA på Pixelberg (v0.135, Carl 2026-10-14: "gör det till en riktig amerikansk temapark"). Parken är
// uppdelad i områden med varsin stil, och här är rekvisitan som gör dem till sina:
//   🏰 SAGOLANDET (karusellen, tekopparna, pariserhjulet, slottet): önskebrunnen, flugsvamparna, svampringen
//   🤠 VILDA VÄSTERN (radiobilarna – "Speedway"): saloonen och vattentornet på berget bakom, kaktusar, hövagnen
//   👻 SPÖKGRÄND (spökhuset): kyrkogården med gravstenar, det döda trädet med kråkan, kryptan som lyser, dimma på kvällen
// Stillastående saker är cachade bilder (origo = foten). Det som rör sig (kråkan, dimman, brunnens glitter) ritas live.
import { SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { tone, fyll, spr, skylttext, bild, put, skugga, F } from '../core/pennor.js';
import { $t } from '../core/i18n.js';

const { VIT, MASS, JARN, ZINK, STEN, TRA, TERR, BLAD, ROD, GUL, GRON, SAND } = F;
const DOD = [0x1a1410, 0x2e241c, 0x463828, 0x5e4c38, 0x786450];
const GRAV = [0x3a3e42, 0x565a60, 0x74787e, 0x92969c, 0xb0b4ba];
export const TEMAN = {
  BRUNN: { x: 362, y: 334 },
  SVAMPAR: [[532, 322, 0], [624, 346, 1], [1048, 330, 2], [340, 262, 1], [1110, 300, 0]],
  KAKTUSAR: [[1602, 332], [1936, 334], [1626, 452], [1898, 456]],
  VAGN: { x: 1612, y: 296 },
  KYRKOGARD: { x0: 2392, x1: 2552, y0: 240, y1: 302 },
  GRAVAR: [[2408, 288, 0], [2432, 272, 1], [2458, 290, 2], [2486, 270, 0], [2514, 292, 1], [2540, 276, 2]],
  DODA_TRAD: [[2162, 300], [2476, 252]],
  KRYPTA: { x: 2534, y: 262 },
  DIMMA: { x0: 2120, x1: 2560, y0: 300, y1: 470 },
};

// ---------------------------------------------------------------- 🏰 sagolandet
export function ritaOnskebrunn(ctx, x, y, t) {
  skugga(ctx, x, y, 28);
  put(ctx, bild('onskebrunn', 36, 50, 18, 46, (P) => {
    for (let j = -4; j <= 4; j++) { const w = Math.round(13 * Math.sqrt(Math.max(0, 1 - (j / 4.5) ** 2))); fyll(P, -w, -14 + j, w, -14 + j, (X) => tone(STEN, (j > 2 ? 0.4 : 0.7) + ((X + j * 2) % 5 === 0 ? -0.15 : 0), X, j)); }
    fyll(P, -13, -13, 12, 0, (X, Y) => { const rad = Math.floor((Y + 13) / 4), bx = X + 13 + (rad & 1) * 3, f = (Y + 13) % 4 === 3 || bx % 6 === 5; return tone(STEN, (f ? 0.35 : 0.68) - (X + 13) * 0.012 + (hash(X, Y, 3) - 0.5) * 0.1, X, Y); });
    for (let j = -3; j <= 2; j++) { const w = Math.round(9 * Math.sqrt(Math.max(0, 1 - (j / 3.5) ** 2))); fyll(P, -w, -15 + j, w, -15 + j, (X) => (((X + j * 3) % 7) === 0 ? 0x6ac0e8 : 0x1e3a5a)); }
    for (const sx of [-10, 8]) { P.rect(sx, -36, 3, 22, TRA[2]); P.vl(sx, -36, 22, TRA[4]); }
    for (let j = 0; j < 8; j++) { const hw = 15 - j; fyll(P, -hw, -36 - j, hw + 1, -36 - j, (X) => tone(ROD, 0.6 - (X + hw) / (hw * 2 + 1) * 0.3 + (j % 3 === 0 ? -0.12 : 0), X, j)); }
    P.hl(-16, -36, 33, ROD[0]); P.hl(-1, -37, 3, GUL[3]);
    P.hl(-9, -30, 19, TRA[1]); P.rect(-1, -31, 3, 3, TRA[3]); P.px(11, -29, TRA[3]); P.px(12, -28, TRA[3]);   // veven och axeln
    P.vl(0, -29, 10, 0xd8d4c8); P.rect(-2, -20, 5, 4, ZINK[2]); P.hl(-2, -20, 5, ZINK[4]);   // repet och hinken
    text(P, SMALL, '$', -2, -8, GUL[3]);
  }), x, y);
  // myntens glitter i vattnet och en önskning som stiger
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), w, h); };
  for (let k = 0; k < 3; k++) if (Math.floor(t * 3 + k * 1.7) % 5 === 0) R('#fff6c0', x - 5 + k * 4 + Math.floor(t + k) % 2, y - 29 + (k % 2), 1, 1);
  const u = (t * 0.4) % 1; if (u < 0.7) { ctx.globalAlpha = 1 - u / 0.7; R('#ffe08a', x + Math.sin(t * 2) * 2, y - 40 - u * 18, 2, 2); R('#ffe08a', x + 1 + Math.sin(t * 2) * 2, y - 41 - u * 18, 1, 1); ctx.globalAlpha = 1; }
}
export function ritaSvampar(ctx, x, y, i) {
  put(ctx, bild('svamp|' + i, 28, 22, 14, 20, (P) => {
    const S = (cx, cy, r, h, c, d) => { fyll(P, cx - 1, cy - h, cx + 1, cy, (X, Y) => (X === cx - 1 ? 0xf4ecd8 : 0xd8d0bc)); fyll(P, cx - r, cy - h - r, cx + r, cy - h, (X, Y) => { const dd = Math.hypot((X + 0.5 - cx) / (r + 0.5), (Y + 0.5 - cy + h) / (r + 0.5)); if (dd > 1) return null; const v = 0.62 - (X - cx) * 0.05 - (Y - cy + h) * 0.08; return (hash(X, Y, 7) > 0.84 ? 0xffffff : tone(c, v, X, Y)); }); for (let k = 0; k < d; k++) P.px(cx - r + 1 + ((hash(k, cx, 9) * (r * 2 - 2)) | 0), cy - h - r + 2 + ((hash(k, cy, 9) * (r - 2)) | 0), 0xffffff); };
    if (i === 0) { S(-6, 0, 6, 6, ROD, 4); S(5, 0, 4, 4, ROD, 2); S(0, -2, 3, 5, GUL, 0); }
    else if (i === 1) { S(0, 0, 8, 7, ROD, 5); S(-9, 0, 3, 3, ROD, 1); S(9, 0, 3, 4, ROD, 1); }
    else { S(-7, 0, 4, 5, GUL, 0); S(2, 0, 7, 6, ROD, 4); S(10, 0, 3, 3, ROD, 1); }
    for (let k = 0; k < 6; k++) P.px(-12 + k * 5, 0 - (k % 2), tone(BLAD, 0.5 + (k % 3) * 0.15, k, 0));
  }), x, y);
}

// ---------------------------------------------------------------- 🤠 vilda västern
// saloonen och vattentornet uppe på berget bakom radiobilarna – målas i marken (de står på sluttningens kant)
export function malaVastern(P, cx, by) {
  // saloonen: en falsk front i trä med SALOON, en veranda med tak och stolpar, svängdörrar, fönster
  const x0 = cx - 50, x1 = cx + 30, top = by - 60;
  fyll(P, x0, top, x1, by, (X, Y) => tone(TRA, 0.58 - (X - x0) / 80 * 0.14 + ((Y - top) % 5 === 4 ? -0.22 : 0) + ((Y - top) % 5 === 0 ? 0.1 : 0) + (hash(X >> 2, Y, 4) - 0.5) * 0.08, X, Y));
  for (let j = 0; j < 6; j++) P.hl(x0 - 2 + j * 2, top - 1 - j, 84 - j * 4, j === 5 ? TRA[4] : TRA[3]);   // den krönta falska fronten
  P.hl(x0 - 2, top, 84, TRA[0]);
  const s = 'SALOON', tw = textW(SMALL, s); fyll(P, cx - 10 - (tw >> 1) - 4, top + 5, cx - 10 + (tw >> 1) + 3, top + 13, (X, Y) => (Y === top + 5 || Y === top + 13 ? GUL[1] : tone(ROD, 0.6, X, Y))); text(P, SMALL, s, cx - 10 - (tw >> 1), top + 7, GUL[4]);
  for (const wx of [x0 + 6, x1 - 18]) { fyll(P, wx, top + 18, wx + 11, top + 30, (X, Y) => (X === wx || X === wx + 11 || Y === top + 18 || Y === top + 30 ? VIT[3] : mix(0x8ab8d8, 0x4e6e96, (Y - top - 18) / 12))); P.vl(wx + 5, top + 19, 11, VIT[3]); }
  P.hl(x0 - 4, top + 34, 88, TRA[4]); P.hl(x0 - 4, top + 35, 88, TRA[1]); for (let X = x0 - 3; X < x1 + 4; X += 5) P.px(X, top + 36, TRA[0]);   // verandataket
  for (const sx of [x0 - 3, cx - 10, x1 + 2]) { P.vl(sx, top + 36, by - top - 36, TRA[3]); P.vl(sx + 1, top + 36, by - top - 36, TRA[1]); }
  fyll(P, cx - 20, by - 16, cx - 2, by - 6, (X, Y) => tone(TRA, 0.4 + ((X - cx + 20) % 3 === 0 ? -0.15 : 0), X, Y)); P.vl(cx - 11, by - 16, 10, TRA[0]);   // svängdörrarna
  fyll(P, cx - 10, by - 25, cx - 11, by - 17, () => 0x1a1410); fyll(P, cx - 9, by - 5, cx - 13, by - 1, () => 0x1a1410);
  for (let k = 0; k < 2; k++) { fyll(P, x0 + 10 + k * 8, by - 8, x0 + 15 + k * 8, by, (X, Y) => tone(TRA, Y === by - 8 ? 0.8 : 0.5 + ((Y - by) % 3 === 0 ? -0.2 : 0), X, Y)); P.hl(x0 + 10 + k * 8, by - 5, 6, JARN[3]); }   // tunnorna
  P.rect(x1 - 8, by - 10, 2, 10, TRA[2]); P.hl(x1 - 12, by - 10, 10, TRA[3]);   // bindstången
  P.rect(cx + 12, top + 40, 3, 5, JARN[1]); P.px(cx + 13, top + 42, 0xffe8a0);   // lyktan
  // vattentornet: en tunna på fyra ben med koniskt tak och en stege
  const tx = cx + 58, tb = by;
  for (const lx of [tx - 10, tx + 8]) { P.vl(lx, tb - 46, 46, TRA[2]); P.vl(lx + 1, tb - 46, 46, TRA[0]); }
  P.line(tx - 10, tb - 30, tx + 9, tb - 10, TRA[1]); P.line(tx + 9, tb - 30, tx - 10, tb - 10, TRA[1]);
  fyll(P, tx - 13, tb - 74, tx + 12, tb - 46, (X, Y) => tone(TRA, 0.6 - (X - tx + 13) / 26 * 0.3 + ((Y - tb) % 7 === 0 ? -0.15 : 0) + ((X - tx) % 4 === 3 ? -0.08 : 0), X, Y));
  P.hl(tx - 14, tb - 66, 28, JARN[3]); P.hl(tx - 14, tb - 54, 28, JARN[3]);
  for (let j = 0; j < 10; j++) P.hl(tx - 15 + Math.round(j * 1.5), tb - 75 - j, 30 - j * 3, j % 2 ? ROD[1] : ROD[2]);
  P.vl(tx + 14, tb - 74, 74, ZINK[2]); for (let Y = tb - 70; Y < tb; Y += 6) P.hl(tx + 12, Y, 4, ZINK[3]);   // stegen
  const ws = 'H2O', ww = textW(SMALL, ws); text(P, SMALL, ws, tx - (ww >> 1), tb - 63, VIT[4]);
}
export function ritaKaktus(ctx, x, y) {
  skugga(ctx, x, y, 16);
  put(ctx, bild('kaktus', 24, 44, 12, 40, (P) => {
    fyll(P, -7, -8, 6, 0, (X, Y) => tone(TERR, 0.62 - (X + 7) * 0.03 + (Y === -8 ? 0.25 : 0), X, Y)); P.hl(-8, -9, 16, TERR[4]);
    fyll(P, -6, -10, 5, -9, (X) => mix(0xe8c870, 0xd8b860, hash(X, 1, 5)));
    const K = [0x1e5a26, 0x2a7a32, 0x3a9a40, 0x5ab858, 0x8ad880];
    fyll(P, -2, -34, 1, -9, (X, Y) => tone(K, 0.6 - (X + 2) * 0.12 + ((Y % 3) === 0 ? 0.1 : 0), X, Y));
    fyll(P, -8, -26, -6, -16, (X, Y) => tone(K, 0.65 - (X + 8) * 0.1, X, Y)); fyll(P, -8, -18, -3, -16, (X, Y) => tone(K, 0.55, X, Y));
    fyll(P, 5, -30, 7, -20, (X, Y) => tone(K, 0.65 - (X - 5) * 0.1, X, Y)); fyll(P, 2, -22, 7, -20, (X, Y) => tone(K, 0.55, X, Y));
    for (let Y = -33; Y < -10; Y += 3) { P.px(-3, Y, 0xf4ecd8); P.px(2, Y + 1, 0xf4ecd8); }
    P.px(-1, -35, 0xf06aa0); P.px(0, -36, 0xf06aa0); P.px(-1, -36, 0xffb0d0);
  }), x, y);
}
export function ritaVagn(ctx, x, y) {
  skugga(ctx, x, y, 44);
  put(ctx, bild('hovagn', 52, 36, 26, 32, (P) => {
    fyll(P, -22, -20, 20, -8, (X, Y) => tone(TRA, 0.55 - (X + 22) / 42 * 0.15 + ((X + 22) % 5 === 4 ? -0.2 : 0) + (Y === -20 ? 0.2 : 0), X, Y));
    for (let k = 0; k < 40; k++) { const X = -20 + ((hash(k, 1, 21) * 40) | 0), Y = -28 + ((hash(k, 2, 21) * 9) | 0); P.px(X, Y, hash(k, 3, 21) > 0.5 ? 0xe8c860 : 0xc8a040); P.px(X + 1, Y, 0xd8b850); }
    for (const wx of [-13, 12]) { for (let a = 0; a < 20; a++) { const v = a / 20 * 6.283; P.px(Math.round(wx + Math.cos(v) * 6), Math.round(-4 + Math.sin(v) * 6), TRA[1]); } P.px(wx, -4, TRA[3]); P.line(wx - 5, -4, wx + 5, -4, TRA[2]); P.line(wx, -9, wx, 1, TRA[2]); }
    P.line(20, -14, 28, -10, TRA[2]); P.line(28, -10, 28, -4, TRA[2]);
  }), x, y);
}

// ---------------------------------------------------------------- 👻 Spökgränd
export function ritaDottTrad(ctx, x, y, t) {
  skugga(ctx, x, y, 14);
  put(ctx, bild('dodtrad', 44, 70, 22, 66, (P) => {
    fyll(P, -3, -34, 2, 0, (X, Y) => tone(DOD, 0.5 - (X + 3) * 0.08 + ((Y % 7) === 0 ? -0.15 : 0), X, Y));
    P.hl(-5, -1, 10, DOD[1]); P.px(-6, 0, DOD[0]); P.px(5, 0, DOD[0]);
    const gren = (x0, y0, x1, y1, w) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const u = i / n, X = Math.round(x0 + (x1 - x0) * u + Math.sin(u * 7) * 1.2), Y = Math.round(y0 + (y1 - y0) * u); for (let k = 0; k < Math.max(1, Math.round(w * (1 - u))); k++) P.px(X + k, Y, k === 0 ? DOD[2] : DOD[1]); } };
    gren(0, -34, -16, -52, 3); gren(0, -30, 14, -50, 3); gren(-1, -42, -6, -60, 2); gren(1, -46, 8, -64, 2); gren(-10, -46, -20, -50, 1); gren(10, -44, 19, -40, 1); gren(-14, -50, -18, -58, 1); gren(10, -50, 16, -58, 1);
    P.px(-2, -20, 0x1a1410); P.px(-1, -21, 0x1a1410); P.px(-2, -21, 0x1a1410);   // ett hål
  }), x, y);
  // kråkan sitter på en gren och vänder på huvudet
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), w, h); };
  const kx = x + 12, ky = y - 50, v = Math.floor(t * 1.3) % 3;
  R('#101014', kx - 2, ky - 2, 5, 3); R('#101014', kx + (v === 2 ? -1 : 2), ky - 4, 2, 2); R('#f0c030', kx + (v === 2 ? -2 : 4), ky - 3, 1, 1); R('#101014', kx - 4, ky - 1, 2, 1);
  if (Math.floor(t * 0.5) % 4 === 0 && Math.floor(t * 6) % 2) R('#f4f1ea', kx + 1, ky - 7, 1, 1);
}
export function ritaGravsten(ctx, x, y, i) {
  skugga(ctx, x, y, 10);
  put(ctx, bild('grav|' + i, 16, 22, 8, 20, (P) => {
    if (i === 0) { fyll(P, -4, -14, 4, 0, (X, Y) => { if (Y < -10 && Math.hypot(X + 0.5, Y + 10) > 4.5) return null; return tone(GRAV, 0.65 - (X + 4) * 0.04 + (hash(X, Y, 3) - 0.5) * 0.15, X, Y); }); P.hl(-2, -8, 5, GRAV[1]); P.hl(-2, -6, 4, GRAV[1]); P.px(-3, -2, 0x58a03a); }
    else if (i === 1) { fyll(P, -1, -16, 1, 0, (X, Y) => tone(GRAV, 0.6 - (X + 1) * 0.1, X, Y)); fyll(P, -5, -12, 5, -10, (X, Y) => tone(GRAV, 0.6, X, Y)); P.hl(-4, -1, 9, GRAV[1]); }
    else { fyll(P, -5, -12, 5, 0, (X, Y) => tone(GRAV, 0.6 - (X + 5) * 0.03 + (hash(X, Y, 4) - 0.5) * 0.15, X, Y)); P.hl(-6, -13, 13, GRAV[3]); P.hl(-6, -12, 13, GRAV[1]); P.hl(-3, -8, 7, GRAV[0]); P.hl(-2, -5, 5, GRAV[0]); P.px(3, -2, 0x58a03a); P.px(4, -1, 0x58a03a); }
  }), x, y);
}
export function ritaKrypta(ctx, x, y, natt) {
  skugga(ctx, x, y, 34);
  put(ctx, bild(`krypta|${natt ? 1 : 0}`, 44, 52, 22, 48, (P) => {
    fyll(P, -15, -30, 14, 0, (X, Y) => { const rad = Math.floor((Y + 30) / 6), bx = X + 15 + (rad & 1) * 4, f = (Y + 30) % 6 === 5 || bx % 8 === 7; return tone(GRAV, (f ? 0.3 : 0.6) - (X + 15) * 0.01 + (hash(X, Y, 5) - 0.5) * 0.12, X, Y); });
    for (let j = 0; j < 10; j++) { const hw = 16 - j; fyll(P, -hw - 1, -30 - j, hw, -30 - j, (X) => tone(GRAV, 0.45 + (j === 0 ? 0.3 : 0) - (X + hw) / (hw * 2) * 0.2, X, j)); }
    P.vl(-1, -46, 7, GRAV[4]); P.hl(-3, -44, 5, GRAV[4]);   // korset
    fyll(P, -5, -20, 4, 0, (X, Y) => { const d = Y < -16 ? Math.hypot(X + 0.5, Y + 16) : 0; if (d > 5) return null; return natt ? ((X + Y) & 1 ? 0x2a6a3a : 0x1a3a26) : 0x0e0c10; });
    for (let Y = -18; Y < 0; Y += 3) P.hl(-4, Y, 8, JARN[3]); P.vl(0, -20, 20, JARN[2]);   // gallergrinden
    for (const sx of [-13, 12]) { P.rect(sx, -8, 2, 8, JARN[1]); P.rect(sx - 1, -11, 4, 3, JARN[2]); P.px(sx, -10, natt ? 0x8aff8a : 0x5a5a62); }   // lyktorna
  }), x, y);
  if (natt) { const g = ctx.createRadialGradient(x, y - 10, 1, x, y - 10, 24); g.addColorStop(0, 'rgba(120,255,140,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 24, y - 34, 48, 40); }
}
export function ritaKyrkogardsstaket(ctx, x0, x1, y) {
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), w, h); };
  R('#2a2e34', x0, y - 9, x1 - x0, 1); R('#2a2e34', x0, y - 3, x1 - x0, 1);
  for (let x = x0; x < x1; x += 4) { R('#1c2026', x, y - 14, 1, 14); R('#3a3e46', x + 1, y - 13, 1, 12); R('#5a3a2a', x, y - 15, 1, 1); }
  for (let x = x0; x <= x1; x += 32) { R('#3a3e42', x - 1, y - 18, 3, 19); R('#74787e', x - 1, y - 18, 1, 18); R('#1a1410', x - 2, y - 20, 5, 2); }
  R('rgba(20,12,30,.25)', x0, y, x1 - x0, 2);
}
// dimman på Spökgränd (kvällen): mjuka vita tussar som driver åt höger
export function ritaDimma(ctx, D, t, a = 0.18) {
  for (let k = 0; k < 14; k++) {
    const u = (t * 0.03 + k * 0.071) % 1, x = D.x0 + u * (D.x1 - D.x0), y = D.y0 + ((k * 37) % (D.y1 - D.y0)) + Math.sin(t * 0.5 + k) * 4, w = 50 + (k % 4) * 18;
    const g = ctx.createRadialGradient(x, y, 2, x, y, w); g.addColorStop(0, `rgba(230,236,255,${a})`); g.addColorStop(1, 'rgba(230,236,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w, y - w / 2, w * 2, w);
  }
}
export const temaHinder = () => {
  const o = [], T = TEMAN;
  o.push([T.BRUNN.x - 14, T.BRUNN.y - 10, T.BRUNN.x + 14, T.BRUNN.y + 1]);
  for (const [x, y] of T.SVAMPAR) o.push([x - 12, y - 6, x + 12, y + 1]);
  for (const [x, y] of T.KAKTUSAR) o.push([x - 7, y - 4, x + 7, y + 1]);
  o.push([T.VAGN.x - 24, T.VAGN.y - 10, T.VAGN.x + 28, T.VAGN.y + 1]);
  o.push([T.KYRKOGARD.x0 - 2, 160, T.KYRKOGARD.x1 + 2, T.KYRKOGARD.y1 + 1]);
  for (const [x, y] of T.DODA_TRAD) o.push([x - 5, y - 3, x + 5, y + 1]);
  return o;
};
