// ☕ KATTCAFÉ KURR INIFRÅN i full prakt (Carl 2026-10-13: "jättetomt kafé – kan vi lägga till mycket mer saker?").
// Rummet är 640 px brett och rullar med figuren. Väggen (y < 72): dörren UT med klocka och ÖPPET-skylt, kapphyllan,
// tavelväggen med kattporträtt, hyllorna bakom disken (koppar, burkar, tekannor), krittavlan MENY, den stora
// ADOPTERA-tavlan med polaroider, kattklockan, KURR i träbokstäver, kattgången med ramper, hängmatta och tunnel,
// matskålarna med namn och vattenfontänen, det stora fönstret med gardiner, makraméampel, ÖPPET-skylt och en
// sughängmatta, bokhyllan med kattfigurer och kakelugnen i hörnet. Taklamporna hänger på sina sladdar och
// ljusslingan går längs taklisten. Golvet: brädor, den stora trasmattan, en rund matta vid fönstret, dörrmattan,
// solfläcken från fönstret och leksaker överallt. Allt stillastående målas EN gång (paintKafeBg); det som rör sig
// (lampornas sken, slingan, elden, fiskarna, ångan, klockan) ritas av ritaKafeLiv varje bildruta.
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { PENNOR, FARGER } from './hus.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, ZINK, STEN, TRA, TERR, BLAD, RODT, BLA, MINP, ROSP, GRONB, SAND } = FARGER;
const GUL = [0x845408, 0xc08c10, 0xeebc20, 0xffde5c, 0xfff6b4];
const KAKEL = [0x8a9aa0, 0xb4c2c6, 0xd6e0e2, 0xecf2f2, 0xfafcfc];
const TAPET = [0xc8a860, 0xe0c078, 0xf0d48a, 0xf6de9c, 0xfaeab8];
const BOK = [0xd84a6a, 0x3a7bd5, 0x46a35a, 0xf0c030, 0x8a5ad0, 0xf08a2a, 0x228c96, 0xf4f1ea, 0x5a3a28];

export const KAFE = {
  W: 640, H: 216, WALL_Y: 72,
  DOOR: { x0: 14, x1: 46 },
  TRAD: { x: 90, y: 122 },                           // klösträdets fot (tre hyllor, två katter)
  DISK: { x: 124, y: 82, w: 86, h: 26 },
  BORD: [{ x: 240, y: 150 }, { x: 338, y: 178 }, { x: 410, y: 146 }, { x: 500, y: 172, rund: true }],
  KORGAR: [{ x: 206, y: 196 }, { x: 476, y: 204 }],
  FONSTER: { x0: 446, x1: 556, y: 104 },             // fönsterbänken (katterna ligger på den)
  GANG: { x0: 362, x1: 440, y: 36 },                 // kattgången högt uppe på väggen (höger om kattklockan)
  SOFFA: { x: 236, y: 100 },
  VAXT: { x: 206, y: 112 }, LAMPA: { x: 312, y: 104 },
  HYLLA: { x0: 566, x1: 602 },                       // bokhyllan (står mot väggen)
  UGN: { x0: 608, x1: 636, y: 112 },                 // kakelugnen i hörnet (foten)
  HAGE: { x0: 548, x1: 626, y0: 184, y1: 212 },      // kattungehagen
  AKVARIUM: { x: 150, y: 200, w: 44 },               // akvariet på skåpet (foten, mitten)
  TUNNEL: { x: 300, y: 208 },                        // tygtunneln på golvet (mitten, foten)
  TALT: { x: 50, y: 164 },                           // katt-tältet (mitten, foten)
  SKALAR: [334, 350, 366, 382],                      // matskålarna längs väggen
  FONTAN: { x: 402, y: 84 },                         // vattenfontänen för katterna
  LAMPOR: [250, 338, 410, 500],                      // taklamporna över borden
  HANGMATTA: { x: 500, y: 56 },                      // sughängmattan i fönstret (en katt)
  SKYLT: { x: 224, y: 116 },                         // golvskylten KATTER ÄR GRATIS
};
const { W, H, WALL_Y, DOOR, DISK, FONSTER, GANG, HYLLA, UGN, HAGE, SKALAR, FONTAN, LAMPOR, HANGMATTA } = KAFE;
const KLOCKA_X = 350;   // kattklockan (mitten) – mellan ADOPTERA-tavlan och kattgången

const qm = (a, b, t, x, y) => mix(a, b, Math.floor(Math.max(0, Math.min(1, t)) * 4 + bayer(x, y)) / 4);
// en liten tavla i ram: motiv katt/tass/hund/fisk, färgad bakgrund
function tavla(P, x, y, w, h, motiv, bg = 0xf0d4b8, ram = MASS) {
  fyll(P, x, y, x + w - 1, y + h - 1, (X, Y) => (X === x || X === x + w - 1 || Y === y || Y === y + h - 1) ? tone(ram, X === x || Y === y ? 0.9 : 0.4, X, Y) : tone([mul(bg, 0.7), mul(bg, 0.85), bg, mix(bg, 0xffffff, 0.2), mix(bg, 0xffffff, 0.4)], 0.6 - (Y - y) * 0.04, X, Y));
  const mx = x + (w >> 1), my = y + (h >> 1), k = 0x3a2a2a;
  if (motiv === 'katt') { P.px(mx - 2, my - 3, k); P.px(mx + 2, my - 3, k); P.rect(mx - 2, my - 2, 5, 3, k); P.px(mx - 1, my - 1, 0x9ad860); P.px(mx + 1, my - 1, 0x9ad860); P.rect(mx - 1, my + 1, 3, 1, k); }
  else if (motiv === 'tass') { P.px(mx, my, k); P.px(mx - 1, my - 1, k); P.px(mx + 1, my - 1, k); P.px(mx - 1, my + 1, k); P.px(mx + 1, my + 1, k); P.px(mx, my + 1, k); }
  else if (motiv === 'fisk') { P.rect(mx - 3, my - 1, 5, 3, 0x3a7bd5); P.px(mx + 2, my - 2, 0x3a7bd5); P.px(mx + 2, my + 2, 0x3a7bd5); P.px(mx - 2, my, 0xffffff); }
  else if (motiv === 'hjarta') { P.px(mx - 1, my - 2, 0xe0384a); P.px(mx + 1, my - 2, 0xe0384a); P.rect(mx - 2, my - 1, 5, 2, 0xe0384a); P.rect(mx - 1, my + 1, 3, 1, 0xe0384a); P.px(mx, my + 2, 0xe0384a); }
  else { P.rect(mx - 2, my - 2, 5, 2, 0x8a5a30); P.px(mx - 3, my - 3, 0x8a5a30); P.px(mx + 3, my - 3, 0x8a5a30); P.rect(mx - 2, my, 5, 2, 0xc89a5a); }
}
const mugg = (P, x, y, c) => { P.rect(x, y, 3, 3, c); P.px(x, y, mix(c, 0xffffff, 0.4)); P.px(x + 3, y + 1, mul(c, 0.7)); };
const burk = (P, x, y, c, h = 6) => { fyll(P, x, y - h, x + 4, y, (X, Y) => (Y === y - h ? ZINK[3] : X === x ? mix(c, 0xffffff, 0.35) : X === x + 4 ? mul(c, 0.7) : c)); P.px(x + 1, y - 3, mix(c, 0xffffff, 0.5)); };
function kruka(P, x, y, farg = 0xe04848) { PENNOR.kruka(P, x, y, farg); }

// ================= bakgrunden =================
let BG = null;
export function paintKafeBg() {
  if (BG) return BG;
  const P = new Pix(W, H);
  // väggen: varm gul tapet med kattfigurer i rader, träpanel med list, taklist
  const KATTM = ['.#.#.', '#####', '#.#.#', '#####', '.###.'];
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, tone(TAPET, 0.62 + (((x >> 3) & 1) ? 0.08 : 0) + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.08 - y * 0.001, x, y));
  for (let y = 8; y < WALL_Y - 24; y += 14) for (let x = 6; x < W - 8; x += 22) { const ox = x + (((y / 14) | 0) % 2 ? 11 : 0); KATTM.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(ox + i, y + j, 0xe0a030, 0.5); }); }
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 20; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 20 ? TRA[4] : y === WALL_Y - 19 ? TRA[3] : y >= WALL_Y - 2 ? TRA[0] : ((x % 12) === 0 ? TRA[1] : tone(TRA, 0.56 + (hash(x >> 2, y, 3) - 0.5) * 0.14 + ((x % 12) === 1 ? 0.1 : 0), x, y)));
  P.rect(0, 0, W, 3, TRA[1]); P.hl(0, 3, W, TRA[4]); P.hl(0, 4, W, TRA[2]);
  // ljusslingan längs taklisten (tråden – lamporna tänds i ritaKafeLiv)
  for (let x = 0; x < W; x++) P.px(x, 6 + Math.round(Math.sin(x / 5) * 1.5), 0x4a3a2a);
  // dörren UT med fönster, ÖPPET-skylt och dörrklockan
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, TRA[0]);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, tone(TRA, 0.42 + (((x - DOOR.x0) % 8 === 0) ? -0.15 : 0) + (hash(x >> 2, y, 3) - 0.5) * 0.1, x, y));
  P.rect(DOOR.x0 + 6, 24, 20, 16, 0xb8e4f4); P.box(DOOR.x0 + 6, 24, 20, 16, VIT[3]); P.rect(DOOR.x0 + 6, 44, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 46, 0x6fe08a);
  fyll(P, DOOR.x0 + 9, 27, DOOR.x0 + 22, 33, (X, Y) => (Y === 27 || Y === 33 || X === DOOR.x0 + 9 || X === DOOR.x0 + 22) ? 0xd8343c : 0xfaf6ea);
  P.px(DOOR.x0 + 12, 29, 0xd8343c); P.px(DOOR.x0 + 14, 29, 0xd8343c); P.hl(DOOR.x0 + 12, 30, 3, 0xd8343c); P.px(DOOR.x0 + 17, 29, 0xd8343c); P.px(DOOR.x0 + 19, 30, 0xd8343c); P.px(DOOR.x0 + 17, 31, 0xd8343c);
  P.px(DOOR.x1 - 5, 44, MASS[3]); P.px(DOOR.x1 - 5, 45, MASS[2]);   // handtaget
  P.rect(DOOR.x0 + 12, 12, 8, 2, MASS[1]); P.rect(DOOR.x0 + 14, 14, 4, 3, MASS[3]); P.px(DOOR.x0 + 15, 17, MASS[1]);   // klockan ovanför dörren
  // kapphyllan: en list med krokar, en jacka, en halsduk och ett paraply
  P.rect(52, 24, 12, 2, TRA[3]); for (const kx of [54, 58, 62]) { P.px(kx, 26, JARN[3]); P.px(kx, 27, JARN[2]); }
  fyll(P, 52, 28, 56, 44, (X, Y) => tone(BLA, 0.6 - (X - 52) * 0.08 + (Y === 28 ? 0.2 : 0), X, Y)); P.px(54, 30, 0xf0c030);
  for (let y = 28; y < 46; y++) P.px(58 + (y % 4 === 3 ? 1 : 0), y, (y >> 1) & 1 ? 0xd8343c : 0xf4f1ea);
  P.vl(62, 28, 14, JARN[2]); P.px(63, 28, JARN[3]); P.rect(61, 42, 3, 3, 0x2a2a30); P.px(62, 45, MASS[3]);
  // tavelväggen: sex ramar med kattporträtt i olika storlekar
  tavla(P, 68, 14, 14, 12, 'katt', 0xf4c8d0); tavla(P, 86, 10, 20, 16, 'hund', 0xc8d4f4); tavla(P, 68, 30, 20, 14, 'fisk', 0xb8e0d0, VIT);
  tavla(P, 92, 30, 12, 10, 'tass', 0xf8e4a0); tavla(P, 70, 48, 16, 12, 'hjarta', 0xf4f1ea, VIT); tavla(P, 90, 44, 16, 16, 'katt', 0xe8c8f0);
  // hyllorna bakom disken: koppar i färger, burkar med kakor, tekannor, en kattfigur
  for (const hy of [16, 30, 44]) { P.hl(160, hy, 56, TRA[4]); P.hl(160, hy + 1, 56, TRA[2]); P.hl(160, hy + 2, 56, 0x000000, 0.15); }
  [0xd84a6a, 0xf0c030, 0x3a7bd5, 0x46a35a, 0xffffff, 0xf08a2a, 0x8a5ad0, 0xd84a6a, 0x3a7bd5, 0xf0c030, 0x46a35a, 0xffffff, 0xf08a2a, 0x8a5ad0].forEach((c, i) => mugg(P, 162 + (i % 7) * 6, 10 + Math.floor(i / 7) * 14 + (i >= 7 ? 2 : 0), c));
  for (let i = 0; i < 2; i++) burk(P, 204 + i * 6, 15, [0xc89a5a, 0xf0d8a0][i], 5 + i);
  for (const [tx, c] of [[204, 0xf06aa0]]) { fyll(P, tx, 22, tx + 8, 29, (X, Y) => { const d = Math.hypot((X - tx - 4) / 4.5, (Y - 25.5) / 3.8); return d > 1 ? null : tone([mul(c, 0.6), mul(c, 0.8), c, mix(c, 0xffffff, 0.25), mix(c, 0xffffff, 0.5)], 0.7 - (X - tx) * 0.05 - (Y - 22) * 0.04, X, Y); }); P.px(tx + 9, 24, c); P.px(tx + 10, 25, c); P.px(tx + 4, 21, mul(c, 0.7)); P.px(tx - 1, 25, c); }
  spr(P, 164, 36, ['k.k', 'kkk', 'kwk', 'kkk', '.k.'], { k: 0x22202a, w: 0x9ad860 });   // kattfiguren
  burk(P, 176, 43, 0xf4ecd8, 7); burk(P, 184, 43, 0xd8a050, 6); burk(P, 194, 43, 0x8a5a30, 5); mugg(P, 204, 40, 0xf4f1ea); mugg(P, 210, 40, 0xd84a6a);
  // krittavlan MENY med ritningar: en kopp, en bulle och en katt (vänster om hyllorna, ovanför disken)
  const mx = 112, mw = 44;
  P.rect(mx, 10, mw, 40, TRA[2]); P.rect(mx + 2, 12, mw - 4, 36, 0x2a3a2a); P.hl(mx, 10, mw, TRA[4]);
  text(P, SMALL, $t('MENY'), mx + (mw >> 1) - (textW(SMALL, $t('MENY')) >> 1), 14, 0xf8d860);
  for (let i = 0; i < 4; i++) { P.hl(mx + 5, 23 + i * 6, 12 + (i % 3) * 3, 0xe8e4dc, 0.9); P.hl(mx + 30, 23 + i * 6, 9, 0xf0c030, 0.9); }
  spr(P, mx + 36, 12, ['.www.', 'w...ww', 'w...w.', '.www.'], { w: 0xffffff }); P.px(mx + 33, 32, 0xf0c030); P.px(mx + 34, 31, 0xf0c030);
  // KURR i träbokstäver över soffan
  const ks = 'KURR', kw = textW(BIG, ks);
  text(P, BIG, ks, 268 - (kw >> 1) + 1, 15, TRA[0]); text(P, BIG, ks, 268 - (kw >> 1), 14, TRA[4]);
  P.px(268 - (kw >> 1) - 6, 16, 0xe0384a); P.px(268 - (kw >> 1) - 4, 16, 0xe0384a); P.hl(268 - (kw >> 1) - 6, 17, 3, 0xe0384a); P.px(268 - (kw >> 1) - 5, 18, 0xe0384a);
  // den stora ADOPTERA-tavlan med fyra polaroider
  fyll(P, 290, 12, 326, 60, (X, Y) => (X === 290 || X === 326 || Y === 12 || Y === 60) ? 0xa8382a : tone(SAND, 0.62 + (hash(X, Y, 4) - 0.5) * 0.2, X, Y));
  text(P, SMALL, $t('ADOPTERA'), 294, 15, 0xa8382a);
  [[294, 24, 0xe08a3a], [310, 24, 0x8a5a30], [294, 42, 0x3a3438], [310, 42, 0xf4f1ea]].forEach(([px, py, c]) => { P.rect(px, py, 12, 14, 0xfaf8f2); P.rect(px + 2, py + 2, 8, 7, c); P.px(px + 3, py + 3, mul(c, 0.7)); P.px(px + 7, py + 3, mul(c, 0.7)); P.px(px + 5, py + 6, 0xe86a8a); P.px(px + 5, py - 1, 0xd8343c); P.hl(px + 3, py + 11, 6, 0x9a9a8a); });
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px(320 + dx, 18 + dy, 0xa8382a);
  // kattklockan: svart katt, urtavlan på magen (ögonen och svansen i ritaKafeLiv)
  const KX = KLOCKA_X;
  spr(P, KX - 5, 10, ['.k.......k.', '.kk.....kk.', '.kkkkkkkkk.', 'kkwwwkwwwkk', 'kkwwwkwwwkk', '.kkkkkkkkk.', '.kkwwwwwkk.', '..kkkkkkk..'], { k: 0x22202a, w: 0xf4f1ea });
  fyll(P, KX - 5, 18, KX + 5, 29, (X, Y) => (Math.abs(X + 0.5 - KX) / 5.5 > 1 - Math.max(0, (Y - 26) * 0.2) ? null : 0x22202a));
  fyll(P, KX - 3, 20, KX + 3, 26, (X, Y) => (Math.hypot(X + 0.5 - KX, Y + 0.5 - 23) < 3.6 ? (Math.hypot(X + 0.5 - KX, Y + 0.5 - 23) > 2.8 ? MASS[3] : 0xfaf6ea) : null));
  P.vl(KX, 21, 2, 0x22202a); P.hl(KX, 23, 2, 0x22202a);
  // kattgången: hyllor med kant, en hängmatta och en tunnel på gången, trappsteg upp från klockan
  for (let x = GANG.x0; x <= GANG.x1; x++) { P.px(x, GANG.y, TRA[4]); P.px(x, GANG.y + 1, TRA[2]); P.px(x, GANG.y + 2, TRA[0], 0.7); if (x % 24 === 0) P.vl(x, GANG.y + 3, 4, TRA[1]); }
  for (let i = 0; i < 3; i++) { P.rect(GANG.x0 - 6 - i * 5, GANG.y + 8 + i * 7, 6, 2, TRA[3]); P.hl(GANG.x0 - 6 - i * 5, GANG.y + 8 + i * 7, 6, TRA[4]); }   // trappstegen upp från klockan
  fyll(P, GANG.x0 + 8, GANG.y + 3, GANG.x0 + 38, GANG.y + 11, (X, Y) => { const u = (X - GANG.x0 - 8) / 30, d = Math.sin(u * Math.PI) * 6; return Y - GANG.y - 3 > d ? null : Y - GANG.y - 3 > d - 2 ? ROSP[1] : ROSP[3]; });   // hängmattan
  for (const hx of [GANG.x0 + 7, GANG.x0 + 39]) { P.px(hx, GANG.y + 2, JARN[2]); P.px(hx, GANG.y + 3, JARN[2]); }
  fyll(P, GANG.x1 - 32, GANG.y - 12, GANG.x1 - 2, GANG.y - 1, (X, Y) => { const u = (Y - GANG.y + 12) / 11; return X === GANG.x1 - 32 || X === GANG.x1 - 2 ? MINP[1] : (X - GANG.x1) % 6 === 0 ? MINP[2] : tone(MINP, 0.72 - u * 0.2, X, Y); });   // tunneln på gången
  fyll(P, GANG.x1 - 31, GANG.y - 10, GANG.x1 - 27, GANG.y - 3, () => 0x14100e);
  // matskålarna (en tass på en träskylt ovanför) och vattenfontänen längs väggens fot
  SKALAR.forEach((sx, i) => { const c = [0xd84a6a, 0x3a7bd5, 0x46a35a, 0xf0c030][i]; fyll(P, sx - 5, WALL_Y + 4, sx + 5, WALL_Y + 8, (X, Y) => (Y === WALL_Y + 4 ? mix(c, 0xffffff, 0.4) : Y === WALL_Y + 8 ? mul(c, 0.6) : c)); P.hl(sx - 3, WALL_Y + 5, 7, i % 2 ? 0xc89a5a : 0x8a5a30); P.px(sx - 1, WALL_Y + 5, 0xf0d8a0); });
  fyll(P, SKALAR[0] - 8, WALL_Y - 14, SKALAR[3] + 8, WALL_Y - 6, (X, Y) => (Y === WALL_Y - 14 ? TRA[4] : Y === WALL_Y - 6 ? TRA[0] : tone(TRA, 0.55, X, Y)));
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px((SKALAR[1] + SKALAR[2]) / 2 + dx, WALL_Y - 10 + dy, 0xf0c030);
  fyll(P, FONTAN.x - 6, FONTAN.y - 10, FONTAN.x + 6, FONTAN.y, (X, Y) => (Y === FONTAN.y - 10 ? ZINK[4] : Y < FONTAN.y - 6 ? (Math.abs(X - FONTAN.x) < 4 ? 0x6ac0e8 : ZINK[3]) : tone(ZINK, 0.62 - (Y - FONTAN.y + 6) * 0.06, X, Y)));
  P.rect(FONTAN.x - 2, FONTAN.y - 14, 4, 4, ZINK[2]); P.px(FONTAN.x - 1, FONTAN.y - 13, 0x9ad8f8);
  // fönstret: utsikt mot gatan, spröjs, gardiner med mönster, makraméampel, ÖPPET-skylten och sughängmattan
  const fx0 = FONSTER.x0, fx1 = FONSTER.x1;
  P.rect(fx0 - 3, 8, fx1 - fx0 + 6, 66, VIT[3]); P.hl(fx0 - 3, 8, fx1 - fx0 + 6, VIT[4]); P.vl(fx1 + 2, 8, 66, VIT[1]);
  for (let y = 11; y < 70; y++) for (let x = fx0; x < fx1; x++) P.px(x, y, qm(0xb8e0f8, 0x7ab8e0, (y - 11) / 59, x, y));
  for (let x = fx0; x < fx1; x++) { const h = 48 + Math.round(Math.sin(x / 9) * 3 + Math.sin(x / 3) * 1); for (let y = h; y < 70; y++) P.px(x, y, tone(BLAD, 0.5 + (hash(x >> 1, y >> 1, 5) - 0.5) * 0.4 - (y - h) * 0.01, x, y)); }   // träden utanför
  for (let x = fx0 + 10; x < fx1 - 10; x += 26) { fyll(P, x, 36, x + 14, 47, (X, Y) => tone([0xa84a3a, 0xc85a4a, 0xe07a5a, 0xf0a080, 0xf8c8a8], 0.6 + (Y === 36 ? 0.2 : 0), X, Y)); P.hl(x - 2, 35, 18, 0x8a3a2a); for (let i = 0; i < 3; i++) P.rect(x + 2 + i * 4, 39, 2, 3, 0xd8f0ff); }   // husen på andra sidan gatan
  P.vl((fx0 + fx1) >> 1, 11, 59, VIT[3]); P.hl(fx0, 38, fx1 - fx0, VIT[3]);
  for (let k = 0; k < 6; k++) P.line(fx0 + 6 + k * 18, 14, fx0 + 20 + k * 18, 30, 0xffffff, 0.3);   // glansen
  for (const [gx, s] of [[fx0 - 3, 1], [fx1 + 2, -1]]) for (let y = 8; y < 70; y++) { const w = 7 + Math.round(Math.sin(y / 4) * 1.5) + (y > 60 ? 2 : 0); for (let i = 0; i < w; i++) { const X = gx + s * i; P.px(X, y, (i + y) % 5 === 0 ? 0xd84a6a : (y % 7 === 3 && i % 3 === 1) ? 0xffffff : tone(ROSP, 0.68 - i * 0.03, X, y)); } }   // gardinerna
  P.hl(fx0 - 12, 7, fx1 - fx0 + 24, JARN[2]); P.px(fx0 - 13, 7, MASS[3]); P.px(fx1 + 12, 7, MASS[3]);   // gardinstången
  for (let y = 8; y < 22; y++) P.px(fx0 + 14, y, 0xd8c8a8);   // makraméampeln: snören, krukan, rankorna
  fyll(P, fx0 + 9, 22, fx0 + 19, 27, (X, Y) => tone(TERR, 0.65 - (X - fx0 - 9) * 0.04 + (Y === 22 ? 0.2 : 0), X, Y));
  for (let k = 0; k < 14; k++) { const X = fx0 + 8 + ((hash(k, 1, 6) * 13) | 0), Y = 27 + ((hash(k, 2, 6) * 16) | 0); P.px(X, Y, tone(BLAD, 0.4 + hash(k, 3, 6) * 0.5, X, Y)); P.px(X + 1, Y, tone(BLAD, 0.55, X, Y)); }
  fyll(P, fx1 - 30, 12, fx1 - 6, 20, (X, Y) => (X === fx1 - 30 || X === fx1 - 6 || Y === 12 || Y === 20) ? 0xd8343c : 0xfaf6ea); P.px(fx1 - 18, 11, JARN[2]); P.px(fx1 - 18, 10, JARN[2]);
  P.hl(fx1 - 27, 15, 18, 0xd8343c); P.hl(fx1 - 25, 17, 14, 0xd8343c, 0.6);   // ÖPPET-skylten (hänger med baksidan in – bara streck)
  fyll(P, HANGMATTA.x - 15, HANGMATTA.y, HANGMATTA.x + 15, HANGMATTA.y + 8, (X, Y) => { const u = (X - HANGMATTA.x + 15) / 30, d = Math.sin(u * Math.PI) * 6; const yy = Y - HANGMATTA.y; return yy > d ? null : yy > d - 2 ? 0x8a5a30 : 0xc8a060; });   // sughängmattan
  for (const sx of [HANGMATTA.x - 16, HANGMATTA.x + 16]) { P.rect(sx - 1, HANGMATTA.y - 3, 3, 2, 0xd8dce4); P.px(sx, HANGMATTA.y - 1, ZINK[2]); }
  // bokhyllan: fyra hyllplan med böcker i alla färger, kattfigurer och en växt
  fyll(P, HYLLA.x0, 8, HYLLA.x1, WALL_Y + 3, (X, Y) => (X === HYLLA.x0 || X === HYLLA.x1 || Y === 8) ? TRA[1] : tone(TRA, 0.5 - (Y - 8) * 0.002, X, Y));
  for (const hy of [22, 36, 50, 64]) { P.hl(HYLLA.x0 + 1, hy, HYLLA.x1 - HYLLA.x0 - 1, TRA[4]); P.hl(HYLLA.x0 + 1, hy + 1, HYLLA.x1 - HYLLA.x0 - 1, TRA[0], 0.5); }
  let bx = HYLLA.x0 + 3;
  for (let r = 0; r < 3; r++) { bx = HYLLA.x0 + 3; const hy = [22, 36, 50][r]; let i = 0; while (bx < HYLLA.x1 - 4) { const w = 2 + ((hash(i, r, 11) * 2) | 0), hh = 8 + ((hash(i, r, 12) * 4) | 0), c = BOK[(i + r * 3) % BOK.length]; if (r === 1 && i === 4) { spr(P, bx, hy - 7, ['k.k', 'kkk', 'kwk', 'kkk'], { k: 0xe08a3a, w: 0x1a1414 }); bx += 5; i++; continue; } fyll(P, bx, hy - hh, bx + w - 1, hy - 1, (X, Y) => (X === bx ? mix(c, 0xffffff, 0.3) : X === bx + w - 1 ? mul(c, 0.7) : c)); if (hh > 9) P.px(bx + (w >> 1), hy - hh + 2, mix(c, 0xffffff, 0.5)); bx += w + (hash(i, r, 13) > 0.8 ? 2 : 0); i++; } }
  kruka(P, HYLLA.x0 + 6, 63, 0xf06aa0); spr(P, HYLLA.x0 + 16, 56, ['.ww.', 'wwww', 'w..w'], { w: 0xf4f1ea }); burk(P, HYLLA.x0 + 24, 63, 0x8ad8ff, 6);
  // taklamporna: sladdar från taket och skärmar (skenet i ritaKafeLiv)
  for (const lx of LAMPOR) { P.vl(lx, 5, 21, 0x3a2a2a); P.rect(lx - 1, 5, 3, 2, JARN[2]); for (let j = 0; j < 7; j++) P.hl(lx - 3 - j, 26 + j, 7 + j * 2, j === 6 ? mul(0xe0a030, 0.6) : j === 0 ? 0xffe8a0 : tone(GUL, 0.7 - j * 0.04, lx, 26 + j)); P.hl(lx - 9, 33, 19, 0xfff2c0); }
  malaGolv(P);
  // kakelugnen i hörnet (står på golvet – målas efter det): vit kakel med blå dekor, krönet, luckan i mässing (elden i ritaKafeLiv)
  fyll(P, UGN.x0, 10, UGN.x1, UGN.y, (X, Y) => { const f = (Y - 10) % 8 === 7 || (X - UGN.x0) % 8 === 7; let c = tone(KAKEL, (f ? 0.45 : 0.8) - (X - UGN.x0) * 0.004, X, Y); if (!f && ((X - UGN.x0) % 8 === 3 && (Y - 10) % 8 === 3)) c = 0x3a7bd5; return c; });
  for (let j = 0; j < 5; j++) P.hl(UGN.x0 - 2 + j, 6 + j, UGN.x1 - UGN.x0 + 5 - j * 2, j === 4 ? KAKEL[1] : KAKEL[4]);   // krönet
  P.hl(UGN.x0 - 1, 11, UGN.x1 - UGN.x0 + 3, KAKEL[0], 0.5);
  fyll(P, UGN.x0 + 7, UGN.y - 34, UGN.x1 - 7, UGN.y - 16, (X, Y) => (X === UGN.x0 + 7 || X === UGN.x1 - 7 || Y === UGN.y - 34 || Y === UGN.y - 16) ? MASS[2] : 0x1a0c08);   // luckan (elden ritas inuti)
  P.px(UGN.x1 - 9, UGN.y - 25, MASS[4]); P.px(UGN.x1 - 9, UGN.y - 24, MASS[3]);
  fyll(P, UGN.x0 + 4, UGN.y - 8, UGN.x1 - 4, UGN.y - 2, (X, Y) => (Y === UGN.y - 8 ? ZINK[4] : (X - UGN.x0) % 3 === 0 ? ZINK[1] : ZINK[2]));   // vedluckan
  fyll(P, UGN.x0 - 1, UGN.y - 1, UGN.x1 + 1, UGN.y + 1, () => STEN[2]);
  P.box(0, 0, W, H, 0x0e0d12);
  BG = P.flush();
  return BG;
}
// golvet: varma brädor, den stora trasmattan, den runda mattan, dörrmattan, solfläcken, leksaker
function malaGolv(P) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const row = ((y - WALL_Y) / 7) | 0, off = (hash(row, 1, 7) * 40) | 0;
    let c = mul(0xb07a48, 0.9 + hash(((x + off) / 40) | 0, row, 9) * 0.14);
    if ((y - WALL_Y) % 7 === 6) c = mul(c, 0.78); else if ((x + off) % 40 === 0) c = mul(c, 0.82);
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.78 + i * 0.045);
  for (let y = 128; y < 196; y++) for (let x = 216; x < 446; x++) { const e = x === 216 || x === 445 || y === 128 || y === 195, r = ((y - 128) >> 2) & 1; P.px(x, y, e ? 0xa8382a : r ? mix(0xd8a050, 0xc89040, hash(x >> 2, y, 6) * 0.4) : mix(0xe0c8a0, 0xd0b890, hash(x >> 2, y, 7) * 0.4)); if (!e && (x - 216) % 23 === 11 && r) P.px(x, y, 0xa8382a, 0.5); }
  for (let y = -16; y <= 16; y++) for (let x = -34; x <= 34; x++) { const d = Math.hypot(x / 34, y / 16); if (d > 1) continue; const ring = Math.floor(d * 5); P.px(500 + x, 180 + y, ring % 2 ? 0xd84a6a : 0xf4ecd8); }   // runda mattan vid fönsterbordet
  for (let y = 78; y < 90; y++) for (let x = DOOR.x0 - 4; x < DOOR.x1 + 4; x++) P.px(x, y, (x + y) % 2 ? 0x8a5a30 : 0x6a4424);   // dörrmattan
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px(29 + dx, 83 + dy, 0xf0c030);
  for (let y = WALL_Y + 4; y < WALL_Y + 40; y++) for (let x = FONSTER.x0 - 10; x < FONSTER.x1 + 4; x++) { const k = (x - FONSTER.x0 + 10) - (y - WALL_Y) * 0.6; if (k > 0 && k < 100) P.px(x, y, 0xfff4c8, 0.16); }
  for (const [tx, ty, typ] of [[120, 150, 'mus'], [392, 206, 'boll'], [560, 140, 'mus'], [250, 206, 'boll'], [448, 128, 'mus'], [180, 120, 'fjader']]) {
    if (typ === 'mus') { P.rect(tx, ty, 5, 3, 0x9a9aa4); P.px(tx + 5, ty + 1, 0xf0a0b0); P.px(tx, ty, 0xb8b8c4); for (let k = 0; k < 5; k++) P.px(tx - 1 - k, ty + 2 + (k & 1), 0x9a9aa4); }
    else if (typ === 'boll') { P.rect(tx, ty - 1, 4, 4, 0xd84a6a); P.px(tx, ty - 1, 0xf07ab8); P.px(tx + 3, ty + 2, 0x9a2a4a); P.px(tx + 1, ty, 0xffffff); }
    else { P.vl(tx, ty, 6, 0xc8a060); P.px(tx - 1, ty - 1, 0xd8343c); P.px(tx + 1, ty - 1, 0x3a7bd5); P.px(tx, ty - 2, 0xf0c030); }
  }
}

// ================= det som rör sig (varje bildruta) =================
export function ritaKafeLiv(ctx, t) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  // ljusslingan: varannan lampa tänd, vandrar
  for (let x = 4; x < W; x += 10) { const on = (Math.floor(t * 2) + (x / 10)) % 3 !== 0; R(on ? ['#ffe08a', '#ff9ac4', '#9ad8ff', '#a8ff9a'][(x / 10) % 4] : '#5a4a3a', x, 7 + Math.round(Math.sin(x / 5) * 1.5), 2, 2); }
  // taklampornas sken: en varm kägla ner mot bordet
  for (const lx of LAMPOR) { const g = ctx.createRadialGradient(lx, 34, 2, lx, 34, 40); g.addColorStop(0, 'rgba(255,228,150,.28)'); g.addColorStop(1, 'rgba(255,228,150,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 40, 30, 80, 60); R('#fff6d0', lx - 2, 33, 5, 1); }
  // kattklockan: ögonen tittar fram och tillbaka, svansen pendlar
  const o = Math.round(Math.sin(t * 3.2)), kcx = KLOCKA_X;
  for (const ex of [kcx - 3, kcx + 2]) { R('#f4f1ea', ex - 1, 13, 3, 2); R('#22202a', ex + o, 13, 1, 2); }
  const sv = Math.sin(t * 3.2) * 2; for (let j = 0; j < 5; j++) R('#22202a', kcx + Math.round(sv * j / 5), 29 + j, 2, 1);
  // elden i kakelugnen: flammor som fladdrar bakom luckan, glöd
  const ux = (UGN.x0 + UGN.x1) >> 1, uy = UGN.y - 17;
  for (let k = 0; k < 6; k++) { const ph = t * 7 + k * 1.3, h = 4 + Math.round(Math.sin(ph) * 2 + Math.sin(ph * 2.3) * 1.5), x = ux - 5 + k * 2; for (let j = 0; j < h; j++) R(j < h - 3 ? '#ffe060' : j < h - 1 ? '#ff8a20' : '#d83a1a', x, uy - j, 2, 1); }
  R('#ff6a20', ux - 6, uy, 12, 1); if (Math.floor(t * 9) % 4 === 0) R('#fff0a0', ux - 2 + (Math.floor(t * 5) % 3), uy - 9, 1, 1);
  const g2 = ctx.createRadialGradient(ux, uy - 4, 1, ux, uy - 4, 26); g2.addColorStop(0, 'rgba(255,150,60,.35)'); g2.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g2; ctx.fillRect(ux - 26, uy - 30, 52, 52);
}
// 🐟 akvariet på skåpet: skåpet, vattnet med bubblor och tre fiskar som simmar, en växt och en skattkista
export function ritaAkvarium(ctx, A, t) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const x0 = A.x - (A.w >> 1), y = A.y;
  R('rgba(20,12,30,.25)', x0 - 1, y - 1, A.w + 2, 3);
  for (let j = 0; j < 14; j++) R(j === 0 ? '#d29a5c' : (j === 13 ? '#3a2214' : ((j & 3) === 3 ? '#5e3a20' : '#86562e')), x0, y - 14 + j, A.w, 1);
  R('#ae7640', x0 + 4, y - 10, 2, 1); R('#ae7640', x0 + A.w - 6, y - 10, 2, 1);
  const ty0 = y - 32, ty1 = y - 15;
  for (let yy = ty0; yy < ty1; yy++) for (let xx = x0 + 2; xx < x0 + A.w - 2; xx++) { const u = (yy - ty0) / (ty1 - ty0); ctx.fillStyle = `rgb(${Math.round(90 + u * 20)},${Math.round(170 - u * 40)},${Math.round(230 - u * 40)})`; ctx.fillRect(xx, yy, 1, 1); }
  R('#e8c070', x0 + 2, ty1 - 3, A.w - 4, 3); for (let k = 0; k < 6; k++) R('#c8a050', x0 + 4 + k * 6, ty1 - 2, 2, 1);
  for (let j = 0; j < 9; j++) { R('#2e8a3a', x0 + 6 + Math.round(Math.sin(t * 2 + j * 0.6)), ty1 - 4 - j, 1, 1); R('#3ea848', x0 + 9 + Math.round(Math.sin(t * 2.3 + j * 0.5)), ty1 - 4 - j, 1, 1); }
  R('#8a5a30', x0 + A.w - 12, ty1 - 6, 7, 4); R('#f0c030', x0 + A.w - 12, ty1 - 7, 7, 1); R('#fff6c0', x0 + A.w - 9, ty1 - 5, 1, 1);
  for (let k = 0; k < 3; k++) { const u = (t * 0.25 + k / 3) % 1, fx = x0 + 4 + (Math.sin(u * Math.PI * 2 + k) * 0.5 + 0.5) * (A.w - 12), fy = ty0 + 4 + k * 4 + Math.sin(t * 2 + k) * 1.5, dir = Math.cos(u * Math.PI * 2 + k) > 0 ? 1 : -1, c = ['#f08a2a', '#f0c030', '#e04848'][k]; R(c, fx, fy, 4, 2); R(c, fx + (dir > 0 ? -1 : 4), fy, 1, 1); R(c, fx + (dir > 0 ? -1 : 4), fy + 1, 1, 1); R('#ffffff', fx + (dir > 0 ? 3 : 0), fy, 1, 1); }
  for (let k = 0; k < 4; k++) { const u = (t * 0.6 + k / 4) % 1; R('rgba(255,255,255,.6)', x0 + A.w - 16 + (k % 2) * 2, ty1 - 4 - u * 13, 1, 1); }
  R('rgba(255,255,255,.35)', x0 + 3, ty0 + 1, 1, 10); R('#8a9aa0', x0 + 1, ty0 - 1, A.w - 2, 1); R('#8a9aa0', x0 + 1, ty0 - 1, 1, ty1 - ty0 + 1); R('#5a6a70', x0 + A.w - 2, ty0 - 1, 1, ty1 - ty0 + 1);
  R('#3a3a42', x0 + 6, ty0 - 4, 10, 3); R('#8ad8ff', x0 + 8, ty0 - 3, 2, 1);   // lampan ovanpå
}
// 🛖 tygtunneln på golvet (en katt tittar ut – ritas av scenen i öppningen)
export function ritaTunnel(ctx, T) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  R('rgba(20,12,30,.25)', T.x - 24, T.y - 1, 48, 3);
  for (let j = 0; j < 16; j++) { const w = Math.round(Math.sqrt(1 - ((j - 8) / 8.5) ** 2) * 22); R(j < 3 ? '#8aa8e0' : j > 12 ? '#2a4a8a' : (j & 1) ? '#5a8ae8' : '#3a6ad0', T.x - w, T.y - 16 + j, w * 2, 1); }
  for (let x = T.x - 20; x < T.x + 20; x += 7) R('#2a4a8a', x, T.y - 15, 1, 15);
  for (let j = 0; j < 12; j++) { const w = Math.round(Math.sqrt(1 - ((j - 6) / 6.5) ** 2) * 5); R('#0e0c12', T.x - 22 - w + 4, T.y - 14 + j, w * 2, 1); }
}
// ⛺ katt-tältet (en katt sover inne i det – scenen ritar den i öppningen)
export function ritaTalt(ctx, T) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  R('rgba(20,12,30,.25)', T.x - 15, T.y - 1, 30, 3);
  for (let j = 0; j < 30; j++) { const half = Math.round(j * 0.5) + 1; for (let i = -half; i <= half; i++) { const s = (i + half + j) % 6 < 3; R(i === -half ? '#f8e4a0' : i === half ? '#9a7a30' : s ? '#f0c040' : '#f8f0d0', T.x + i, T.y - 30 + j, 1, 1); } }
  for (let j = 0; j < 14; j++) { const half = Math.max(0, Math.round((j - 2) * 0.4)); R('#1a1410', T.x - half, T.y - 14 + j, half * 2 + 1, 1); }
  R('#8a5a30', T.x - 1, T.y - 33, 2, 4); R('#d8343c', T.x + 1, T.y - 33, 5, 3);
}
// 🧸 kattungehagen: ett lågt staket av spjälor (bak och fram – ungarna ritas emellan)
export function ritaHageBak(ctx, Hg) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  R('#d8c8a8', Hg.x0, Hg.y0 + 2, Hg.x1 - Hg.x0, Hg.y1 - Hg.y0 - 2);
  for (let x = Hg.x0; x <= Hg.x1; x += 4) { R('#f4f1ea', x, Hg.y0 - 10, 2, 12); R('#c8c4b8', x + 1, Hg.y0 - 10, 1, 12); }
  R('#f4f1ea', Hg.x0, Hg.y0 - 8, Hg.x1 - Hg.x0 + 2, 1); R('#f4f1ea', Hg.x0, Hg.y0 - 3, Hg.x1 - Hg.x0 + 2, 1);
  R('#f06aa0', Hg.x0 + 8, Hg.y1 - 8, 10, 5); R('#ffb0d0', Hg.x0 + 8, Hg.y1 - 8, 10, 1);   // en liten kudde
  R('#3a7bd5', Hg.x1 - 16, Hg.y1 - 6, 4, 4); R('#8ad8ff', Hg.x1 - 16, Hg.y1 - 6, 1, 1);   // en boll
}
export function ritaHageFram(ctx, Hg) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  for (let x = Hg.x0; x <= Hg.x1; x += 4) { R('#f4f1ea', x, Hg.y1 - 10, 2, 12); R('#c8c4b8', x + 1, Hg.y1 - 10, 1, 12); }
  R('#f4f1ea', Hg.x0, Hg.y1 - 8, Hg.x1 - Hg.x0 + 2, 1); R('#f4f1ea', Hg.x0, Hg.y1 - 3, Hg.x1 - Hg.x0 + 2, 1);
  R('rgba(20,12,30,.25)', Hg.x0, Hg.y1 + 2, Hg.x1 - Hg.x0 + 2, 2);
  const s = $t('KATTUNGAR'), tw = textW(SMALL, s); R('#a8382a', Hg.x0 + 20, Hg.y1 - 18, tw + 6, 9); ctxText(ctx, SMALL, s, Hg.x0 + 23, Hg.y1 - 16, '#fff6e0');
}
// 🪧 golvskylten KATTER ÄR GRATIS – FIKAT KOSTAR (en liten A-skylt)
export function ritaGolvskylt(ctx, S) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  R('rgba(20,12,30,.25)', S.x - 9, S.y - 1, 18, 3);
  for (let j = 0; j < 22; j++) { const half = 5 + Math.round(j * 0.2); R('#2a2e2a', S.x - half, S.y - 22 + j, half * 2, 1); R('#8a5a30', S.x - half - 1, S.y - 22 + j, 1, 1); R('#8a5a30', S.x + half, S.y - 22 + j, 1, 1); }
  R('#ae7640', S.x - 6, S.y - 23, 12, 1);
  for (const [dy, w] of [[-19, 8], [-16, 6], [-13, 9], [-9, 7]]) R('#e8e4dc', S.x - 4, S.y + dy, w, 1);
  R('#f0c030', S.x - 3, S.y - 6, 2, 2); R('#f06aa0', S.x + 1, S.y - 6, 1, 1); R('#f06aa0', S.x + 3, S.y - 6, 1, 1); R('#f06aa0', S.x + 1, S.y - 5, 3, 1);
}
