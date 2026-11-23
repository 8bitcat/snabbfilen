// 🏰 SLOTTSVÅNINGEN – Dockskåpets andra köpbara rum (v0.173). En tronsal: stenvalv med två höga bågfönster, röd matta
// över ett schackrutigt marmorgolv och guldlist längs väggen. Sakerna ritas här (Pix) som i trädgården
// (dockskap-ute.js): tronen (säte), kristallkronan (hänger i taket, lyser), rustningen, banderollen, kronan på sin
// kudde, fontänen (vattnet rör sig), himmelssängen (säte), facklorna (tänds och släcks, fladdrar på natten), draken
// (ryker ur näsborrarna) och riddarskölden. Låst (🔒) tills Slottsvåningen är köpt (kop.js 'dock.slott', 39 kr).
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t, $n } from '../core/i18n.js';

export const FW = 384, FH = 216, WALL_Y = 86;
const tone = (pal, v, x, y) => { const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t); return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))]; };

export const SLOTT_RUM = { id: 'slott', ik: '🏰', name: $n('SLOTTSVÅNINGEN'), ute: true, kop: 'slott', wall: 0xb8b0a0, wallDk: 0x8a8278, floorA: 0xf0ece4, floorB: 0x3a3438, windows: [], view: 'sky' };

// ---------- bakgrunden: stenvalv, bågfönster, guldlist, marmorgolv med röd matta ----------
function bagfonster(P, x, y, w, h, night) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (i - w / 2 + 0.5) / (w / 2), top = j < w / 2 ? Math.sqrt(1 - dx * dx) * (w / 2) : w / 2;
    if (j < w / 2 - top) continue;
    const kant = i === 0 || i === w - 1 || (j < w / 2 && j < w / 2 - top + 1.5);
    P.px(x + i, y + j, kant ? 0x6a6258 : night ? tone([0x0c1230, 0x1a2450, 0x2a3870], j / h, i, j) : tone([0x5aa0e0, 0x7ab8ec, 0x9acef4, 0xc0e2f8], j / h, i, j));
  }
  P.vl(x + (w >> 1), y + (w >> 1), h - (w >> 1), 0x6a6258); P.hl(x + 1, y + (h >> 1), w - 2, 0x6a6258);   // spröjs
  if (night) for (let k = 0; k < 6; k++) P.px(x + 3 + hash(k, x, 71) * (w - 6), y + 4 + hash(k, y, 71) * (h / 2), 0xffffff);
  else for (let k = 0; k < 3; k++) { const cx = x + 4 + hash(k, x, 73) * (w - 10), cy = y + 6 + k * 9; P.rect(cx, cy, 6, 2, 0xffffff, 0.7); P.rect(cx + 1, cy - 1, 4, 1, 0xffffff, 0.7); }
}
export function slottBg(_tema, night) {
  const P = new Pix(FW, FH);
  // stenvalvet
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < FW; x++) {
    const row = Math.floor(y / 9), off = row & 1 ? 12 : 0, fog = y % 9 === 8 || (x + off) % 24 === 23;
    const c = fog ? 0x7a7268 : mix(0xc4bcac, 0xa89e8e, hash((x + off) >> 4, row, 5) * 0.8);
    P.px(x, y, night ? mul(c, 0.55) : c);
  }
  P.rect(0, 0, FW, 3, night ? 0x3a3630 : 0x5a564e);
  bagfonster(P, 92, 10, 36, 66, night); bagfonster(P, 256, 10, 36, 66, night);
  // guldlisten och sockeln
  P.rect(0, WALL_Y - 6, FW, 3, night ? 0x8a6a20 : 0xd8a830); P.hl(0, WALL_Y - 6, FW, night ? 0xb08a30 : 0xf4d060);
  P.rect(0, WALL_Y - 3, FW, 3, night ? 0x4a4640 : 0x6a665e);
  // marmorgolvet i schack, rutor om 16 px i perspektivband
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    const band = (Math.floor((x + (FH - y) * 0.4) / 16) + Math.floor((y - WALL_Y) / 16)) & 1;
    let c = band ? 0x3a3438 : 0xf0ece4;
    if (hash(x, y, 9) > 0.97) c = mix(c, band ? 0x6a6470 : 0xc8c4bc, 0.6);
    P.px(x, y, night ? mul(c, 0.5) : c);
  }
  // den röda mattan mitt i rummet, med guldkant
  const mx0 = 132, mx1 = 252;
  for (let y = WALL_Y; y < FH; y++) for (let x = mx0; x < mx1; x++) {
    const kant = x < mx0 + 3 || x >= mx1 - 3;
    const c = kant ? 0xd8a830 : mix(0xb81e2a, 0x8e1420, hash(x >> 2, y >> 2, 11) * 0.5);
    P.px(x, y, night ? mul(c, 0.55) : c);
  }
  if (night) { for (const wx of [110, 274]) P.ell(wx, WALL_Y + 20, 44, 16, 0xc8d8ff, 0.08, 4); }
  return P.flush();
}

// ---------- sakerna ----------
const F = new Map();
const frames = (k, n, fn) => { let a = F.get(k); if (!a) { a = Array.from({ length: n }, (_, i) => { const P = new Pix(SLOTT[k].w, SLOTT[k].h); fn(P, i); return P.flush(); }); F.set(k, a); } return a; };
const G1 = 0xd8a830, G2 = 0xf4d060, G3 = 0x8a6a20, R1 = 0xb81e2a, R2 = 0xe03a48;
export const SLOTT = {
  tron: { icon: '👑', name: $t('Tronen'), w: 30, h: 40, solidH: 10, seat: { up: 8 }, re: { anim: 'boing', dur: 0.6, ljud: 'fanfare', fx: { slag: 'gnista', n: 6, o: { col: ['#f4d060', '#ffffff'], upp: 8, fart: 16, g: 0, dur: 0.8, hojd: 20 } } }, bilder: () => frames('tron', 1, (P) => {
    P.rect(3, 0, 24, 30, G1); P.rect(5, 2, 20, 26, R1); P.rect(5, 2, 20, 1, R2); P.px(15, 6, G2); P.px(14, 7, G2); P.px(16, 7, G2);   // ryggstödet
    P.rect(1, 24, 28, 8, G1); P.rect(3, 25, 24, 5, R1); P.hl(3, 25, 24, R2);                                                     // sätet
    P.rect(0, 20, 3, 14, G1); P.rect(27, 20, 3, 14, G1); P.px(1, 19, G2); P.px(28, 19, G2);                                       // armstöden
    for (const x of [3, 25]) P.rect(x, 32, 3, 8, G3);                                                                             // benen
    P.ell(15, 39, 14, 2, 0x000000, 0.25, 2);
  }) },
  kristallkrona: { icon: '💎', name: $t('Kristallkronan'), w: 34, h: 30, wall: true, glow: true, re: { anim: 'sway', dur: 1, ljud: 'pling', fx: { slag: 'gnista', n: 8, o: { col: ['#ffffff', '#f4d060', '#c8e8ff'], upp: 6, fart: 22, g: 2, dur: 0.9, hojd: 10, dy: 14 } } }, bilder: () => frames('kristallkrona', 2, (P, f) => {
    P.vl(17, 0, 10, 0x8a6a20); P.rect(11, 10, 13, 2, G1);
    for (let k = 0; k < 7; k++) { const x = 3 + k * 4.5, y = 12 + Math.abs(k - 3) * 2; P.vl(x, 12, y - 10, G1); P.rect(x - 1, y + 2, 3, 3, f && k % 2 ? 0xffffff : 0xc8e8ff); P.px(x, y + 5, 0xf4f8ff); P.rect(x - 1, y + 6, 3, 1, 0xfff6c0); }
    P.rect(5, 19, 25, 2, G1); P.hl(5, 19, 25, G2);
    for (let k = 0; k < 6; k++) { const x = 7 + k * 4; P.rect(x, 21, 2, 4, 0xc8e8ff); P.px(x, 25, 0xffffff); }
  }) },
  rustning: { icon: '🛡️', name: $t('Rustningen'), w: 22, h: 44, solidH: 6, re: { anim: 'wiggle', dur: 0.5, ljud: 'knock' }, bilder: () => frames('rustning', 1, (P) => {
    const S = 0xb8bcc6, D = 0x6a6e78, L = 0xe8ecf4;
    P.rect(7, 0, 8, 9, S); P.rect(8, 3, 6, 2, 0x1a1a22); P.rect(9, 0, 4, 1, L); P.rect(10, -1, 2, 1, R2);                     // hjälmen
    P.rect(5, 9, 12, 14, S); P.rect(5, 9, 12, 1, L); P.rect(10, 12, 2, 8, D);                                                    // bröstplåten
    P.rect(1, 10, 4, 12, S); P.rect(17, 10, 4, 12, S); P.rect(2, 22, 3, 3, D); P.rect(17, 22, 3, 3, D);                          // armarna
    P.rect(6, 23, 4, 14, S); P.rect(12, 23, 4, 14, S); P.rect(5, 37, 6, 3, D); P.rect(11, 37, 6, 3, D);                          // benen
    P.rect(2, 40, 18, 4, 0x4a4650); P.hl(2, 40, 18, 0x7a7680);                                                                    // sockeln
    P.vl(19, 2, 22, 0x8a6a20); P.rect(18, 0, 3, 3, L);                                                                            // spjutet
  }) },
  banderoll: { icon: '🚩', name: $t('Banderollen'), w: 20, h: 40, wall: true, re: { anim: 'sway', dur: 0.8, ljud: 'shake' }, bilder: () => frames('banderoll', 1, (P) => {
    P.rect(0, 0, 20, 2, G1); P.px(0, 2, G2); P.px(19, 2, G2);
    for (let y = 2; y < 40; y++) { const w = y > 32 ? 20 - (y - 32) * 2 : 20, x0 = (20 - w) >> 1; for (let x = x0; x < x0 + w; x++) P.px(x, y, x === x0 || x === x0 + w - 1 ? G1 : R1); }
    P.rect(7, 10, 6, 8, G2); P.rect(6, 12, 8, 2, G2); P.px(9, 8, G2); P.px(10, 8, G2);                                           // lejonet (symbol)
  }) },
  kronkudde: { icon: '👑', name: $t('Kronan'), w: 20, h: 30, solidH: 8, re: { anim: 'hopp', dur: 0.5, ljud: 'coin', fx: { slag: 'gnista', n: 6, o: { col: ['#f4d060', '#ffffff'], upp: 10, fart: 14, g: 0, dur: 0.8 } } }, bilder: () => frames('kronkudde', 1, (P) => {
    P.rect(2, 18, 16, 12, 0x6a6e78); P.rect(3, 18, 14, 1, 0x9a9eaa); P.rect(4, 14, 12, 5, R1); P.hl(4, 14, 12, R2);             // piedestal + kudde
    P.rect(5, 8, 10, 6, G1); P.hl(5, 8, 10, G2); for (const x of [5, 9, 13]) { P.px(x, 7, G2); P.px(x, 6, G2); P.px(x, 5, 0xe03a48); }   // kronan
    P.px(7, 11, 0x3a8ae0); P.px(12, 11, 0x46a35a);
  }) },
  fontan: { icon: '⛲', name: $t('Fontänen'), w: 52, h: 40, solidH: 12, re: { anim: 'wiggle', dur: 0.5, ljud: 'splash', fx: { slag: 'bubbla', n: 8, o: { upp: 24, fart: 16, g: -2, dur: 1.2, bredd: 20, dy: 6 } } }, bilder: () => frames('fontan', 3, (P, f) => {
    for (let y = 26; y < 40; y++) for (let x = 0; x < 52; x++) { const dx = (x - 26 + 0.5) / 26, dy = (y - 33) / 7, d = dx * dx + dy * dy; if (d <= 1) P.px(x, y, d > 0.8 ? 0x9a9eaa : tone([0x2a6ab8, 0x3a8ad8, 0x5ab0f0, 0x8ad0ff], 0.5 + Math.sin((x + f * 4) * 0.5 + y) * 0.3, x, y)); }
    P.rect(22, 10, 8, 20, 0x9a9eaa); P.rect(22, 10, 2, 20, 0xc8ccd4); P.rect(18, 8, 16, 3, 0x9a9eaa);                            // pelaren och skålen
    for (let k = 0; k < 5; k++) { const h = 6 + ((k + f) % 3) * 2; P.vl(26 + (k - 2) * 2, 8 - h, h, 0xbfe8ff); P.px(26 + (k - 2) * 2, 7 - h, 0xffffff); }   // strålarna
    P.ell(26, 39, 24, 2, 0x000000, 0.2, 2);
  }) },
  himmelssang: { icon: '🛏️', name: $t('Himmelssängen'), w: 56, h: 50, solidH: 16, seat: { up: 0 }, re: { anim: 'boing', dur: 0.6, ljud: 'boing', hopp: true }, bilder: () => frames('himmelssang', 1, (P) => {
    for (const x of [2, 52]) P.rect(x, 0, 2, 48, G3);                                                                           // stolparna
    P.rect(0, 0, 56, 4, R1); P.hl(0, 0, 56, R2); P.rect(0, 4, 56, 2, G1);                                                       // baldakinen
    for (let y = 6; y < 20; y++) { P.px(3, y, R1, 0.8); P.px(52, y, R1, 0.8); }
    P.rect(4, 28, 48, 16, 0xf4f1ea); P.rect(4, 36, 48, 8, R1); P.hl(4, 36, 48, R2); P.rect(8, 24, 14, 6, 0xffffff); P.rect(30, 24, 14, 6, 0xffffff);   // madrassen, täcket, kuddarna
    P.rect(2, 44, 52, 4, G3); P.hl(2, 44, 52, G1);
    P.ell(28, 49, 26, 2, 0x000000, 0.25, 2);
  }) },
  fackla: { icon: '🔥', name: $t('Facklan'), w: 10, h: 24, wall: true, re: { anim: 'none', ljud: 'ok', toggle: 'lit', fx: { slag: 'gnista', n: 4, o: { col: ['#ff9d3a', '#ffd23f'], upp: 10, fart: 6, g: -4, dur: 0.6 } } }, bilder: () => frames('fackla', 2, (P, f) => {
    P.rect(3, 10, 4, 14, 0x6a4424); P.rect(2, 9, 6, 2, G1); P.rect(2, 16, 6, 2, G3);
    if (f) { P.rect(2, 2, 6, 8, 0xff7a2a); P.rect(3, 0, 4, 4, 0xffd23f); P.px(4, 4, 0xfff6c0); P.px(5, 5, 0xfff6c0); } else P.rect(3, 6, 4, 4, 0x3a3034);
  }) },
  drake: { icon: '🐉', name: $t('Draken'), w: 40, h: 44, solidH: 8, re: { anim: 'wiggle', dur: 0.7, ljud: 'bu', fx: { slag: 'rok', n: 6, o: { col: ['#9a9aa4', '#d8d8e0'], upp: 14, fart: 10, g: -5, glapp: 0.1, dur: 1.2, bredd: 6, dy: 12 } } }, bilder: () => frames('drake', 1, (P) => {
    const G = 0x3a8a4a, L = 0x6ab86a, D = 0x245a30;
    for (let j = 0; j < 14; j++) for (let i = 0; i < 24; i++) { const dx = (i - 12) / 12, dy = (j - 7) / 7; if (dx * dx + dy * dy <= 1) P.px(8 + i, 26 + j, j < 4 ? L : G); }   // kroppen
    P.rect(4, 36, 32, 4, D); for (const x of [6, 14, 22, 30]) P.rect(x, 39, 4, 5, D);                                            // tassarna
    P.rect(2, 14, 14, 12, G); P.rect(2, 14, 14, 2, L); P.rect(14, 10, 6, 8, G); P.px(4, 17, 0xffd23f); P.px(5, 17, 0x1a1a22);     // huvudet och nacken
    P.rect(0, 20, 6, 3, G); P.px(0, 20, 0xff5a1a); P.px(1, 22, 0xff5a1a);                                                        // nosen
    for (let k = 0; k < 5; k++) P.rect(10 + k * 5, 24 - (k % 2) * 2, 2, 4, 0xe03a48);                                            // ryggtaggarna
    P.rect(30, 24, 10, 6, G); P.rect(36, 20, 4, 6, G); P.px(39, 18, G);                                                          // svansen
    for (let j = 0; j < 10; j++) P.rect(16 + j, 12 - Math.round(Math.abs(j - 5) * 0.4), 1, 1, D);                                // vingen
    P.ell(20, 43, 18, 2, 0x000000, 0.25, 2);
  }) },
  riddarskold: { icon: '⚔️', name: $t('Riddarskölden'), w: 24, h: 28, wall: true, re: { anim: 'sway', dur: 0.6, ljud: 'knock' }, bilder: () => frames('riddarskold', 1, (P) => {
    P.line(2, 2, 22, 24, 0xc8ccd4); P.line(22, 2, 2, 24, 0xc8ccd4); P.rect(1, 1, 3, 2, G3); P.rect(20, 1, 3, 2, G3);             // svärden
    for (let y = 4; y < 26; y++) { const w = y < 16 ? 16 : 16 - (y - 16) * 1.6; const x0 = Math.round(12 - w / 2); for (let x = x0; x < x0 + w; x++) P.px(x, y, x === x0 || x === x0 + Math.round(w) - 1 || y === 4 ? G1 : (x < 12 ? R1 : 0x3a6ad0)); }
    P.rect(10, 10, 4, 4, G2);
  }) },
};
export const SLOTT_SEED = [{ k: 'tron', x: 176, y: 140 }, { k: 'kristallkrona', x: 175, y: 44 }, { k: 'banderoll', x: 40, y: 70 }, { k: 'banderoll', x: 330, y: 70 }, { k: 'rustning', x: 60, y: 150 }, { k: 'fontan', x: 290, y: 196 }, { k: 'kronkudde', x: 230, y: 150 }, { k: 'fackla', x: 150, y: 60 }, { k: 'fackla', x: 226, y: 60 }, { k: 'drake', x: 24, y: 206 }];
export const slottBild = (k, f = 0) => { const a = SLOTT[k]?.bilder(); return a ? a[Math.min(f, a.length - 1)] : null; };
