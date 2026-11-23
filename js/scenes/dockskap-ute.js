// 🌳 TRÄDGÅRDEN – Dockskåpets första köpbara rum (v0.172, Carl 2026-11-22: "det ska även finnas ingame purchables för
// dockskåpet … du kan sätta priserna"). Ett sjätte rum till höger om badrummet: husets baksida med fönster och dörr,
// gräsmattan, och utesaker som inte finns i möbelarket utan ritas här pixel för pixel (Pix): poolen, gungan,
// studsmattan, grillen, äppelträdet, sandlådan, parasollet, staketet, rabatten och hundkojan. Varje sak har en
// reaktion i Leka (re) och några är säten (seat: gungan, studsmattan). Rummet är låst (🔒) tills Trädgården är köpt i
// Butiken (kop.js 'dock.tradgard', 29 kr); låst ritas det ändå, med startmöbleringen, så att man ser vad man får.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t, $n } from '../core/i18n.js';

export const FW = 384, FH = 216, WALL_Y = 86;
const tone = (pal, v, x, y) => { const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t); return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))]; };

// rummet (samma fält som RUM i dockskap.js): ute = egen bakgrund (tradgardBg), kop = varan som låser upp det
export const TRADGARD_RUM = { id: 'tradgard', ik: '🌳', name: $n('TRÄDGÅRDEN'), ute: true, kop: 'tradgard', wall: 0x9ad0ff, wallDk: 0x5a8ab8, floorA: 0x5aa84a, floorB: 0x4e9a40, windows: [], view: 'tradgard' };
export const ARSTIDER = [{ id: 'sommar', namn: $t('Sommar'), ik: '☀️' }, { id: 'host', namn: $t('Höst'), ik: '🍂' }, { id: 'vinter', namn: $t('Vinter'), ik: '❄️' }];

// ---------- bakgrunden: himlen, husets baksida, gräsmattan (per årstid, dag/natt) ----------
function window_(P, x, y, w, h, night) {
  P.rect(x - 2, y - 2, w + 4, h + 4, 0xf4f1ea);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, night ? mix(0xffe2a0, 0xd8a050, j / h) : mix(0x6ab0e0, 0x2a5a8a, j / h));
  P.rect(x + (w >> 1) - 1, y, 2, h, 0xf4f1ea); P.rect(x, y + (h >> 1) - 1, w, 2, 0xf4f1ea);
  if (!night) for (let k = 0; k < 10; k++) P.px(x + 3 + k, y + 3 + (k >> 1), 0xffffff, 0.5);
}
function door_(P, x, y, w, h, night) {
  P.rect(x - 2, y - 2, w + 4, h + 2, 0x5a4a3a);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, j > 4 && j < h - 6 && i > 3 && i < w - 4 ? (night ? mix(0xffd890, 0xc08a40, j / h) : mix(0x9ad0f0, 0x5a90c0, j / h)) : mul(0x2a5a8a, 0.92 + (i === 0 ? 0.1 : 0)));
  P.rect(x + w - 6, y + (h >> 1), 3, 2, 0xd8b040);
}
export function tradgardBg(arstid, night) {
  const P = new Pix(FW, FH), vinter = arstid === 'vinter', host = arstid === 'host';
  // himlen (natt: mörkblå med stjärnor och måne)
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < FW; x++) P.px(x, y, night ? tone([0x0a1030, 0x16204a, 0x243060], y / WALL_Y, x, y) : vinter ? tone([0x8aa4c4, 0xa8bcd4, 0xc8d8e8, 0xe0e8f0], 0.2 + y / WALL_Y * 0.7, x, y) : tone([0x5aa0e0, 0x7ab8ec, 0x9acef4, 0xc0e2f8, 0xe2f2fc], 0.2 + y / WALL_Y * 0.7, x, y));
  if (night) { for (let k = 0; k < 40; k++) P.px(hash(k, 1, 77) * FW, hash(k, 2, 77) * 60, hash(k, 3, 77) > 0.7 ? 0xffffff : 0xc8d0ff); P.ell(330, 22, 9, 9, 0xfff4c8, 1, 1); P.ell(326, 20, 7, 7, night ? 0x16204a : 0, 1, 1); }
  else if (!vinter) { P.ell(40, 24, 10, 10, 0xfff0a0, 1, 1); P.ell(40, 24, 16, 16, 0xfff8d0, 0.25, 3); }
  // husets baksida: vit panel, takfot, två fönster och altandörren
  for (let y = 8; y < WALL_Y; y++) for (let x = 0; x < FW; x++) P.px(x, y, (x % 9 === 8) ? (night ? 0x6a6e78 : 0xc8ccc4) : night ? mix(0x8a8e98, 0x707480, (y - 8) / 78) : mix(0xf4f2ea, 0xe0ded4, (y - 8) / 78));
  P.rect(0, 4, FW, 4, 0x3a3a44); P.hl(0, 4, FW, 0x5a5a66);
  window_(P, 100, 20, 60, 40, night); window_(P, 250, 20, 60, 40, night);
  door_(P, 36, 28, 28, WALL_Y - 28, night);
  if (night) { P.ell(130, 60, 48, 20, 0xffe2a0, 0.12, 4); P.ell(280, 60, 48, 20, 0xffe2a0, 0.12, 4); }
  P.rect(0, WALL_Y - 4, FW, 4, night ? 0x5a5a5e : 0x8a8a8a); for (let x = 0; x < FW; x += 6) P.px(x, WALL_Y - 4, night ? 0x7a7a80 : 0xb8b8b8);   // stenkanten
  // gräsmattan (vinter: snö; höst: gulare med löv)
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    const band = Math.floor((x + (FH - y) * 0.4) / 20) & 1;
    let c = vinter ? (band ? 0xf4f6fa : 0xe8ecf4) : host ? (band ? 0x9ab04a : 0x8aa040) : (band ? 0x5aa84a : 0x4e9a40);
    if (!vinter && hash(x, y, 9) > 0.94) c = mix(c, host ? 0xe0a040 : 0xb8e070, 0.4);
    if (vinter && hash(x, y, 9) > 0.96) c = 0xd0d8e8;
    P.px(x, y, night ? mul(c, 0.45) : c);
  }
  if (host) for (let k = 0; k < 70; k++) { const x = hash(k, 1, 91) * FW, y = WALL_Y + hash(k, 2, 91) * (FH - WALL_Y); P.rect(x, y, 2, 1, night ? 0x6a3a18 : [0xd8782a, 0xe0a030, 0xb84a2a][k % 3]); }
  // en stenplattegång från dörren
  for (let y = WALL_Y; y < WALL_Y + 40; y += 8) for (let i = 0; i < 2; i++) { const x = 38 + i * 12 + ((y >> 3) & 1) * 4; P.rect(x, y + 2, 10, 5, night ? 0x6a6a6e : vinter ? 0xd8dce4 : 0xb8b4a8); P.hl(x, y + 2, 10, night ? 0x80808a : 0xd0ccc0); }
  return P.flush();
}

// ---------- utesakerna (ritade i kod) ----------
// { icon, name, w, h, solidH?, seat?: { up }, bilder(): canvas[] (bildrutor), re: reaktionen i Leka
//   (anim, dur, ljud, fx: { slag, n, o }, toggle: 'lit' tänd/släck) }
const F = new Map();
const frames = (k, n, fn) => { let a = F.get(k); if (!a) { a = Array.from({ length: n }, (_, i) => { const P = new Pix(UTE[k].w, UTE[k].h); fn(P, i); return P.flush(); }); F.set(k, a); } return a; };
export const UTE = {
  pool: { icon: '🏊', name: $t('Poolen'), w: 56, h: 22, solidH: 14, re: { anim: 'wiggle', dur: 0.5, ljud: 'splash', fx: { slag: 'bubbla', n: 8, o: { upp: 18, fart: 20, g: -3, dur: 1.2, bredd: 30 } } }, bilder: () => frames('pool', 3, (P, f) => {
    const W = 56, H = 22;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2 + 0.5) / (W / 2), dy = (y - 13) / 8; const d = dx * dx + dy * dy; if (d <= 1) P.px(x, y, d > 0.78 ? (y < 13 ? 0x6ab0e8 : 0x4a90d0) : tone([0x2a6ab8, 0x3a8ad8, 0x5ab0f0, 0x8ad0ff], 0.55 + Math.sin((x + f * 3) * 0.6 + y * 1.3) * 0.25, x, y)); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2 + 0.5) / (W / 2), dy = (y - 13) / 8, d = dx * dx + dy * dy; if (d > 0.78 && d <= 1) P.px(x, y, (x + y + f) % 7 < 3 ? 0xf4f1ea : 0x3a7ac8); }
    for (let k = 0; k < 6; k++) P.px(10 + k * 7 + f * 2, 10 + (k & 1) * 3, 0xffffff, 0.8);
    P.ell(W / 2, 21, 26, 3, 0x000000, 0.25, 3);
  }) },
  gunga: { icon: '🪢', name: $t('Gungan'), w: 48, h: 44, solidH: 8, seat: { up: 16, dx: 24 }, re: { anim: 'sway', dur: 1.4, ljud: 'squeak', hopp: true }, bilder: () => frames('gunga', 3, (P, f) => {
    const sw = [0, -3, 3][f];
    P.rect(2, 0, 44, 3, 0x8a5a30); P.hl(2, 0, 44, 0xb07a48);                       // överliggaren
    P.line(4, 3, 0, 43, 0x6a4424); P.line(7, 3, 3, 43, 0x8a5a30); P.line(43, 3, 47, 43, 0x6a4424); P.line(40, 3, 44, 43, 0x8a5a30);   // benen
    P.line(19, 3, 19 + sw, 26, 0x9a9aa4); P.line(29, 3, 29 + sw, 26, 0x9a9aa4);     // kedjorna
    P.rect(16 + sw, 26, 16, 3, 0xd84a3a); P.hl(16 + sw, 26, 16, 0xf07a6a);          // sätet
    P.ell(24, 43, 20, 2, 0x000000, 0.25, 2);
  }) },
  studsmatta: { icon: '🤸', name: $t('Studsmattan'), w: 50, h: 16, solidH: 6, seat: { up: 4, dx: 25 }, re: { anim: 'boing', dur: 0.6, ljud: 'boing', hopp: true }, bilder: () => frames('studsmatta', 2, (P, f) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 50; x++) { const dx = (x - 25 + 0.5) / 25, dy = (y - 6 - f) / 5, d = dx * dx + dy * dy; if (d <= 1) P.px(x, y, d > 0.72 ? 0x3a7ad8 : ((x + y) & 1 ? 0x1a1a22 : 0x2a2a34)); }
    for (const x of [8, 24, 40]) P.rect(x, 10, 2, 6, 0x8a8a94);
    P.ell(25, 15, 22, 2, 0x000000, 0.25, 2);
  }) },
  grill: { icon: '🔥', name: $t('Grillen'), w: 26, h: 30, solidH: 8, re: { anim: 'wiggle', dur: 0.5, ljud: 'sizzle', toggle: 'lit', fx: { slag: 'rok', n: 6, o: { upp: 18, fart: 8, g: -6, glapp: 0.12, dur: 1.4, col: ['#f4f4f8', '#d8d8e0'] } } }, bilder: () => frames('grill', 2, (P, f) => {
    P.rect(3, 6, 20, 10, 0x1e1e26); P.hl(3, 6, 20, 0x3a3a46); P.rect(2, 10, 22, 3, 0x2a2a34);     // grytan
    P.rect(4, 2, 18, 4, 0x1e1e26); P.hl(4, 2, 18, 0x4a4a56); P.rect(11, 0, 4, 2, 0x8a8a94);         // locket med handtag
    for (let x = 5; x < 21; x += 2) P.px(x, 7, f ? 0xff7a2a : 0x4a4a52);                            // glöden
    if (f) { P.rect(6, 8, 14, 2, 0xff5a1a); P.hl(7, 8, 12, 0xffc040); }
    P.rect(6, 16, 2, 13, 0x5a5a64); P.rect(18, 16, 2, 13, 0x5a5a64); P.rect(12, 16, 2, 12, 0x4a4a54);   // benen
    P.rect(5, 28, 4, 2, 0x2a2a34); P.rect(17, 28, 4, 2, 0x2a2a34);                                  // hjulen
    P.rect(23, 9, 3, 2, 0x8a5a30);                                                                   // handtaget på sidan
  }) },
  appeltrad: { icon: '🍎', name: $t('Äppelträdet'), w: 64, h: 84, solidH: 6, re: { anim: 'wiggle', dur: 0.8, ljud: 'shake', fx: { slag: 'apple', n: 3, o: { upp: -4, fart: 14, g: 90, glapp: 0.15, dur: 0.9, bredd: 40, hojd: 20, dy: 30 } }, fx2: { slag: 'lov', n: 4, o: { upp: -8, fart: 14, g: 12, glapp: 0.1, dur: 1.1, bredd: 40, dy: 30 } } }, bilder: () => frames('appeltrad', 1, (P) => {
    P.rect(29, 44, 7, 40, 0x6a4424); P.rect(29, 44, 2, 40, 0x8a5a30);
    for (let j = -24; j <= 24; j++) for (let i = -30; i <= 30; i++) { const d = (i / 30) ** 2 + (j / 24) ** 2; if (d > 1 || (d > 0.8 && hash(i, j, 41) > 0.6)) continue; P.px(32 + i, 30 + j, tone([0x1e4a1a, 0x2e6a26, 0x3e8a32, 0x6ab84a], 0.6 - i / 80 - j / 60 + (hash(i, j, 42) - 0.5) * 0.3, i, j)); }
    for (let k = 0; k < 9; k++) { const ax = 10 + hash(k, 1, 43) * 44, ay = 14 + hash(k, 2, 43) * 30; P.rect(ax, ay, 3, 3, 0xd02c30); P.px(ax, ay, 0xff9a88); }
    P.ell(32, 83, 14, 3, 0x000000, 0.25, 3);
  }) },
  sandlada: { icon: '🏖️', name: $t('Sandlådan'), w: 44, h: 18, solidH: 10, re: { anim: 'wiggle', dur: 0.4, ljud: 'shake', fx: { slag: 'rok', n: 4, o: { upp: 8, fart: 12, g: -2, dur: 0.8, col: ['#e8d8a0', '#f4e8c0'], bredd: 24 } } }, bilder: () => frames('sandlada', 1, (P) => {
    P.rect(0, 4, 44, 14, 0x8a5a30); P.hl(0, 4, 44, 0xb07a48); P.rect(3, 7, 38, 10, 0xe8d8a0);
    for (let k = 0; k < 40; k++) P.px(4 + hash(k, 1, 51) * 36, 8 + hash(k, 2, 51) * 8, 0xd8c080);
    P.rect(8, 6, 7, 7, 0xd84a3a); P.hl(8, 6, 7, 0xf07a6a); P.rect(9, 3, 5, 3, 0xd84a3a);                 // hinken
    P.rect(30, 2, 2, 10, 0x8a8a94); P.rect(28, 10, 6, 4, 0x3a7ad8);                                    // spaden
    P.ell(22, 17, 20, 2, 0x000000, 0.25, 2);
  }) },
  parasoll: { icon: '⛱️', name: $t('Parasollet'), w: 34, h: 44, solidH: 4, re: { anim: 'sway', dur: 0.8, ljud: 'shake' }, bilder: () => frames('parasoll', 1, (P) => {
    P.rect(16, 10, 2, 34, 0x8a8a94); P.rect(13, 42, 8, 2, 0x4a4a54);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 34; i++) { const dx = (i - 17 + 0.5) / 17, dy = j / 12; if (dx * dx + (1 - dy) * 0.0 + (dy * dy) * 0 > 1) continue; if (Math.abs(dx) > 1 - dy * 0.1 || j > 11) continue; if (j < 12 - Math.round(Math.sqrt(1 - dx * dx) * 11)) continue; P.px(i, j, (Math.floor((i + j * 0.3) / 5) & 1) ? 0xd84a3a : 0xf4f1ea); }
    P.hl(0, 11, 34, 0x8a3a2a); P.px(17, 0, 0x8a8a94);
    P.ell(17, 43, 10, 2, 0x000000, 0.2, 2);
  }) },
  staket: { icon: '🪵', name: $t('Staketet'), w: 48, h: 16, solidH: 4, re: { anim: 'wiggle', dur: 0.4, ljud: 'knock' }, bilder: () => frames('staket', 1, (P) => {
    for (let x = 0; x < 48; x += 8) { P.rect(x + 1, 2, 4, 14, 0xf4f1ea); P.px(x + 2, 0, 0xf4f1ea); P.px(x + 3, 0, 0xf4f1ea); P.rect(x + 1, 1, 4, 1, 0xf4f1ea); P.rect(x + 4, 2, 1, 14, 0xc8c4b8); }
    P.rect(0, 5, 48, 2, 0xe8e4d8); P.rect(0, 11, 48, 2, 0xe8e4d8);
  }) },
  blomrabatt: { icon: '🌷', name: $t('Rabatten'), w: 40, h: 14, solidH: 4, re: { anim: 'wiggle', dur: 0.6, ljud: 'shake', fx: { slag: 'lov', n: 5, o: { upp: 10, fart: 14, g: 6, glapp: 0.08, dur: 1, bredd: 30, col: ['#ff5a7a', '#ffd23f', '#ff9ec0', '#ffffff'] } } }, bilder: () => frames('blomrabatt', 1, (P) => {
    for (let y = 8; y < 14; y++) for (let x = 0; x < 40; x++) P.px(x, y, tone([0x3a2414, 0x4a2e1a, 0x5a3a22], 0.3 + hash(x, y, 7) * 0.6, x, y));
    P.hl(0, 8, 40, 0x7a5a36);
    for (let k = 0; k < 9; k++) { const x = 2 + k * 4 + (k & 1), h = 3 + (k % 3); P.rect(x + 1, 8 - h, 1, h, 0x3e8a32); P.rect(x, 7 - h, 3, 2, [0xff5a7a, 0xffd23f, 0xff9ec0, 0xd84a3a, 0xf4f1ea][k % 5]); P.px(x + 1, 7 - h, 0xffffff, 0.5); }
  }) },
  hundkoja: { icon: '🐶', name: $t('Hundkojan'), w: 28, h: 26, solidH: 10, re: { anim: 'boing', dur: 0.5, ljud: 'squeak', fx: { slag: 'hjarta', n: 2, o: { upp: 10, fart: 6, g: 0, dur: 1 } } }, bilder: () => frames('hundkoja', 1, (P) => {
    P.rect(2, 10, 24, 16, 0xd84a3a); P.rect(2, 10, 24, 1, 0xf07a6a); P.rect(2, 25, 24, 1, 0x8a2a1a);
    for (let j = 0; j < 10; j++) { const w = 28 - j * 2.6; P.rect(14 - w / 2, 10 - j, w, 1, j === 9 ? 0x4a2a1a : 0x6a4424); P.px(14 - w / 2, 10 - j, 0x8a5a30); }
    for (let j = 0; j < 12; j++) for (let i = 0; i < 10; i++) { const dx = (i - 4.5) / 5, dy = j < 5 ? (5 - j) / 5 : 0; if (dx * dx + dy * dy <= 1) P.px(9 + i, 14 + j, 0x1a1016); }
    P.rect(20, 22, 5, 2, 0xf4f1ea); P.px(20, 21, 0xf4f1ea); P.px(24, 21, 0xf4f1ea); P.px(20, 24, 0xf4f1ea); P.px(24, 24, 0xf4f1ea);   // benet
  }) },
};
// startmöbleringen i trädgården (x = vänsterkant, y = fotlinje)
export const TRADGARD_SEED = [{ k: 'appeltrad', x: 300, y: 150 }, { k: 'pool', x: 150, y: 190 }, { k: 'gunga', x: 60, y: 150 }, { k: 'grill', x: 240, y: 130 }, { k: 'sandlada', x: 110, y: 120 }, { k: 'staket', x: 320, y: 206 }, { k: 'blomrabatt', x: 200, y: 104 }];
export const uteBild = (k, f = 0) => { const a = UTE[k]?.bilder(); return a ? a[Math.min(f, a.length - 1)] : null; };
