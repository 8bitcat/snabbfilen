// MARKNADEN på Marknadstorget (v4, Linnéstaden) – Carl 2026-10-07: "marknaden … med stånd och lite
// karnevalsstämning". Två rader stånd med randiga tak och handlare bakom diskarna (grönsaker, frukt
// och bär, ost och ägg, bröd, fisk, blommor, våfflor, sockervadd), en karusell med hästar som går
// runt, en ballongförsäljare, ett lyckohjul, en dragspelare på en pall och vimpel- och ljusslingor
// från brunnen ut till lyktorna. Kunder står och handlar vid stånden.
//
// Kontrakt (som stadens andra moduler, scenen kopplar in den i city.js):
//   createMarket(env) → { items(), obstacles, glow(ctx, view), update(dt), stallAt(x, y), stalls }
//   openStall(A, stall, ctx) → handelsrutan när figuren har gått fram: råvarorna hamnar i skafferiet
//   (g.skafferi, samma som mataffärens), godsakerna äts på plats och ger lycka (g.glad med dagstak),
//   karusellen, ballongen, lyckohjulet och dragspelaren ger lycka.
// Öppet 8–20 (karusellen 10–20); på kvällen lyser slingorna och karusellens lampor.
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { LINNE_LAYOUT } from './map.js';
import { ravaraOf, MAX_RAVA, fmt } from '../game.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const WHITE = 0xffffff, OUT = 0x221a26;
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
export const OPEN = [8, 20], KARUSELL = [10, 20];
const isOpen = (h, span = OPEN) => h >= span[0] && h < span[1];

// ---------- stånden ----------
// x = ståndets mitt, y = fotlinjen (diskens framkant). Den norra raden står norr om brunnen, den
// södra (karusellen, ballongerna, lyckohjulet, dragspelaren) söder om den – gångarna runt brunnen
// och tvärs över torget hålls fria.
const YN = 352, YS = 440;
const look = (o) => ({ build: 5, shoes: '#2a2a30', ...o });
export const STALLS = [
  { id: 'gront', name: $t('GRÖNSAKER'), icon: '🥕', x: -996, y: YN, canopy: [0x3a8a4a, 0xf4f0e6], cloth: 0x6aa848, goods: 'gront', vara: ['morot', 'potatis', 'lok', 'rodlok', 'tomat', 'paprika', 'champ'], rop: $t('FÄRSKA MORÖTTER!'),
    look: look({ skin: '#e0a97f', hair: '#6a4a2a', style: 'short', hat: 'straw', shirt: '#4a7aa8', pants: '#3a4a2a', apron: true }) },
  { id: 'frukt', name: $t('FRUKT'), icon: '🍎', x: -948, y: YN, canopy: [0xd8443a, 0xf4f0e6], cloth: 0xf0c8c0, goods: 'frukt', vara: ['applR', 'applG', 'paron', 'plommon', 'druva', 'bar'], rop: $t('SÖTA PLOMMON!'),
    look: look({ skin: '#c68a5c', hair: '#1a1a1a', style: 'ponytail', shirt: '#e86a5a', pants: '#2d3a5c', apron: true }) },
  { id: 'ost', name: $t('OST'), icon: '🧀', x: -900, y: YN, canopy: [0xe0b030, 0xf4f0e6], cloth: 0xf4e8b0, goods: 'ost', vara: ['ost', 'smor', 'agg', 'mjolk', 'yoghurt'], rop: $t('SMAKA PÅ OSTEN!'),
    look: look({ skin: '#f6d7bf', hair: '#d8c8a0', style: 'bun', shirt: '#f4f1ea', pants: '#5a4a3a', apron: true }) },
  { id: 'brod', name: $t('BRÖD'), icon: '🥖', x: -852, y: YN, canopy: [0x9a5a2a, 0xf4f0e6], cloth: 0xe8d0a0, goods: 'brod', vara: ['brod', 'mjol', 'havre'],
    treat: [{ id: 'bulle', icon: '🥐', namn: $t('Kanelbulle'), pris: 15, matt: 8, glad: 2 }], rop: $t('NYGRÄDDAT!'),
    look: look({ skin: '#eec3a0', hair: '#8a5a2a', style: 'curly', shirt: '#f4f1ea', pants: '#f4f1ea', apron: true }) },
  { id: 'fisk', name: $t('FISK'), icon: '🐟', x: -636, y: YN, canopy: [0x2a5a9a, 0xf4f0e6], cloth: 0xb8d4e8, goods: 'fisk', vara: ['fisk'], rop: $t('FÅNGAD I MORSE!'),
    look: look({ skin: '#e0a97f', hair: '#d8d8d8', style: 'short', hat: 'cap', cap: '#2a3a5a', shirt: '#2a3a5a', pants: '#3a3a44', beard: true, apron: true }) },
  { id: 'blommor', name: $t('BLOMMOR'), icon: '💐', x: -588, y: YN, canopy: [0xe070a8, 0xf4f0e6], cloth: 0xf8d8e8, goods: 'blommor',
    treat: [{ id: 'bukett', icon: '💐', namn: $t('En bukett tulpaner'), pris: 35, glad: 4, text: $t('Du köper en bukett tulpaner – de luktar vår.') }], rop: $t('TULPANER!'),
    look: look({ skin: '#eabf98', hair: '#c8642a', style: 'long', shirt: '#5aa060', pants: '#2d3a5c', apron: true }) },
  { id: 'vafflor', name: $t('VÅFFLOR'), icon: '🧇', x: -540, y: YN, canopy: [0xe8902a, 0xf4f0e6], cloth: 0xf8e0b0, goods: 'vafflor',
    treat: [{ id: 'vaffla', icon: '🧇', namn: $t('Våffla med sylt och grädde'), pris: 25, matt: 12, glad: 3 }, { id: 'saft', icon: '🧃', namn: $t('Hallonsaft'), pris: 10, matt: 2, glad: 1 }], rop: $t('VARMA VÅFFLOR!'),
    look: look({ skin: '#a06a43', hair: '#2a1a12', style: 'afro', shirt: '#f0c040', pants: '#3a6ab0', apron: true }) },
  { id: 'godis', name: $t('GODIS'), icon: '🍭', x: -492, y: YN, canopy: [0xe84a8a, 0xf8f0f4], cloth: 0xf8c8e0, goods: 'godis',
    treat: [{ id: 'sockervadd', icon: '🍭', namn: $t('Rosa sockervadd'), pris: 20, matt: 3, glad: 4 }, { id: 'popcorn', icon: '🍿', namn: $t('En strut popcorn'), pris: 15, matt: 5, glad: 2 }], rop: $t('SOCKERVADD!'),
    look: look({ skin: '#eec3a0', hair: '#e8a0c8', style: 'bob', shirt: '#9a6ab0', pants: '#2a2a34' }) },
  // söder om brunnen: karnevalen
  { id: 'karusell', name: $t('KARUSELLEN'), icon: '🎠', x: -912, y: YS + 2, kind: 'karusell', pris: 20, rop: $t('ETT VARV TILL!') },
  { id: 'ballonger', name: $t('BALLONGER'), icon: '🎈', x: -826, y: YS, kind: 'ballong', pris: 15, rop: $t('BALLONGER!'),
    look: look({ skin: '#e0a97f', hair: '#3b2619', style: 'short', hat: 'bucket', cap: '#e8443a', shirt: '#3a9bff', pants: '#2d3a5c' }) },
  { id: 'dragspel', name: $t('DRAGSPELAREN'), icon: '🪗', x: -744, y: YS + 6, kind: 'musik',
    look: look({ skin: '#eabf98', hair: '#a8a8a8', style: 'short', hat: 'cap', cap: '#3a3a44', shirt: '#8a2a24', pants: '#2a2a34', beard: true }) },
  { id: 'lyckohjul', name: $t('LYCKOHJULET'), icon: '🎡', x: -640, y: YS, kind: 'hjul', pris: 10, rop: $t('SNURRA OCH VINN!'),
    look: look({ skin: '#c68a5c', hair: '#2a1a12', style: 'long', shirt: '#f4d23c', pants: '#2a2a34' }) },
];

// ---------- ritningen ----------
const spr = (w, h, ax, ay, fn) => { const P = new Pix(w, h, -ax, -ay); fn(P); return { img: P.flush(), ax, ay }; };
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
// randigt tak med bågad kappa, och skylttavlan med ståndets namn
function canopy(P, x0, x1, y0, c1, c2, name) {
  for (let j = 0; j < 11; j++) for (let x = x0 - (j >> 2); x <= x1 + (j >> 2); x++) {
    const st = ((x - x0 + 40) >> 2) & 1 ? c2 : c1;
    P.px(x, y0 + j, j === 0 ? mul(st, 0.6) : mix(mix(st, WHITE, 0.15), mul(st, 0.78), j / 11));
  }
  for (let x = x0 - 3; x <= x1 + 3; x++) { const st = ((x - x0 + 40) >> 2) & 1 ? c2 : c1, u = (x - x0 + 40) % 4; P.px(x, y0 + 11, mul(st, 0.85)); if (u === 1 || u === 2) P.px(x, y0 + 12, mul(st, 0.75)); }
  if (name) {
    const tw = textW(SMALL, name), w = tw + 6, sx = Math.round((x0 + x1) / 2 - w / 2);
    P.rect(sx, y0 + 2, w, 8, 0xfaf4e4); P.box(sx - 1, y0 + 1, w + 2, 10, 0x5a3a24); P.hl(sx, y0 + 9, w, 0xd8c8a8);
    text(P, SMALL, name, sx + 3, y0 + 3, mul(c1, 0.7));
  }
}
// varorna på disken (y = diskens ovansida)
function goods(P, kind, x0, x1, y) {
  const R = (x, yy, w, h, c) => P.rect(x, yy, w, h, c);
  const crate = (x, c, c2) => { R(x, y - 4, 8, 4, 0xb08a58); P.hl(x, y - 4, 8, 0xd8b480); for (let i = 0; i < 4; i++) { P.rect(x + i * 2, y - 6 + (i & 1), 2, 2, i & 1 ? c2 : c); } };
  if (kind === 'gront') { const C = [[0xe0802a, 0xc86a1a], [0xc8a050, 0xa88038], [0xd8302a, 0xb82018], [0x6ab04a, 0x4c8a3a], [0xe8d8b0, 0xc8b890]]; for (let i = 0, x = x0; x < x1 - 8; x += 9, i++) crate(x, ...C[i % C.length]); for (let x = x0; x < x1; x += 4) P.px(x, y - 7, 0x4c8a3a); }
  else if (kind === 'frukt') { const C = [[0xd8302a, 0xf06a5a], [0x7ac040, 0xa8d860], [0xd8c040, 0xf0e070], [0x7a3a8a, 0x9a5aaa], [0x3a5ac8, 0x6a8ae8]]; for (let i = 0, x = x0; x < x1 - 8; x += 9, i++) { R(x, y - 3, 8, 3, 0x9a6a3a); for (let k = 0; k < 7; k++) P.px(x + k, y - 4 - ((k * 3) % 2), C[i % C.length][k & 1]); for (let k = 1; k < 6; k += 2) P.px(x + k, y - 6, C[i % C.length][0]); } }
  else if (kind === 'ost') { for (let x = x0; x < x1 - 7; x += 9) { R(x, y - 5, 7, 5, 0xf0d060); P.hl(x, y - 5, 7, 0xf8e890); P.vl(x + 6, y - 4, 4, 0xc8a030); P.px(x + 2, y - 3, 0xe0b840); } R(x1 - 9, y - 4, 7, 4, 0xe8e0d0); for (let k = 0; k < 3; k++) P.px(x1 - 8 + k * 2, y - 5, 0xf8f4ec); }
  else if (kind === 'brod') { for (let x = x0; x < x1 - 5; x += 7) { R(x, y - 4, 6, 4, 0xb87a3a); P.hl(x, y - 4, 6, 0xd8a060); P.px(x + 2, y - 3, 0x8a5a2a); P.px(x + 4, y - 3, 0x8a5a2a); } P.line(x1 - 3, y - 1, x1 - 1, y - 12, 0xd8a050); P.line(x1 - 2, y - 1, x1, y - 12, 0xb07a30); }
  else if (kind === 'fisk') { R(x0, y - 3, x1 - x0, 3, 0xe8f4fa); for (let x = x0 + 1; x < x1 - 6; x += 7) { R(x, y - 5, 6, 2, 0x8a9ab0); P.px(x + 6, y - 5, 0x6a7a90); P.px(x + 6, y - 4, 0x6a7a90); P.px(x + 1, y - 5, 0x2a2a30); P.hl(x + 1, y - 4, 4, 0xc8d4e0); } for (let x = x0; x < x1; x += 3) P.px(x, y - 3, WHITE); }
  else if (kind === 'blommor') { const C = [0xe8443a, 0xf4d23c, 0xe070c0, 0xf4f1ea, 0xff8a2a, 0x9a7ae0]; for (let i = 0, x = x0; x < x1 - 4; x += 6, i++) { R(x, y - 4, 5, 4, 0x9aa0aa); P.hl(x, y - 4, 5, 0xd8dce2); for (let k = 0; k < 5; k++) { P.vl(x + k, y - 8 + (k % 2), 4, 0x3e7a34); P.px(x + k, y - 9 + (k % 2), C[(i + k) % C.length]); P.px(x + k, y - 10 + ((k + 1) % 2), mix(C[(i + k) % C.length], WHITE, 0.3)); } } }
  else if (kind === 'vafflor') { R(x0 + 2, y - 5, 10, 5, 0x3a3a44); P.hl(x0 + 2, y - 5, 10, 0x6a6a74); R(x0 + 4, y - 7, 6, 2, 0x2a2a30); for (let k = 0; k < 4; k++) { R(x0 + 15, y - 2 - k * 2, 9, 2, 0xe8b860); P.hl(x0 + 15, y - 2 - k * 2, 9, 0xf8d888); } P.px(x0 + 18, y - 10, 0xd8303a); P.px(x0 + 20, y - 10, 0xf8f8f0); R(x1 - 8, y - 6, 4, 6, 0xd84a6a); P.hl(x1 - 8, y - 6, 4, 0xf8f0f4); }
  else if (kind === 'godis') { R(x0 + 2, y - 4, 12, 4, 0xd8d8e0); P.ell(x0 + 8, y - 8, 6, 4, 0xf8c8dc, 1, 2); P.ell(x0 + 8, y - 8, 4, 3, 0xfadcea, 1, 2); for (let k = 0; k < 3; k++) { P.ell(x0 + 20 + k * 5, y - 7, 2.5, 2.5, 0xf8b8d0, 1, 1); P.vl(x0 + 20 + k * 5, y - 5, 5, 0xf4f0e0); } R(x1 - 7, y - 6, 5, 6, 0xe8443a); for (let k = 0; k < 5; k += 2) P.px(x1 - 7 + k, y - 6, WHITE); for (let k = 0; k < 4; k++) P.px(x1 - 6 + k, y - 7 - (k & 1), 0xfaf4d0); }
}
function stallSprites(s) {
  const [c1, c2] = s.canopy, cl = s.cloth;
  const back = spr(52, 52, 26, 48, (P) => {
    for (let y = -34; y < -12; y++) for (let x = -18; x <= 17; x++) P.px(x, y, mix(mul(c1, 0.45), mul(c2, 0.4), ((x + 40) >> 2) & 1 ? 0.6 : 0.3));
    for (const x of [-17, 16]) { P.vl(x, -36, 36, 0x4a3020); P.vl(x + 1, -36, 36, 0x3a2418); }
  });
  const front = (open) => spr(52, 52, 26, 48, (P) => {
    // disken: plankor, duk med bågad fåll, varorna (eller en presenning när det är stängt)
    for (let y = -12; y <= 0; y++) for (let x = -20; x <= 19; x++) { const pl = (x + 40) % 5; P.px(x, y, pl === 4 ? 0x5a3a24 : pl === 0 ? 0xa8805a : 0x8a6440); }
    P.hl(-21, -14, 42, 0xc8a478); P.hl(-21, -13, 42, 0x8a6440);
    for (let y = -12; y < -8; y++) for (let x = -21; x <= 20; x++) P.px(x, y, (x + y) & 1 ? cl : mul(cl, 0.92));
    for (let x = -21; x <= 20; x++) if ((x + 40) % 4 < 2) P.px(x, -8, mul(cl, 0.85));
    if (open) goods(P, s.goods, -19, 19, -14);
    else { for (let y = -18; y < -11; y++) for (let x = -20; x <= 19; x++) P.px(x, y, (x + y) % 5 ? 0x5a6a7a : 0x4a5a6a); P.hl(-20, -18, 40, 0x7a8a9a); }
    for (const x of [-20, 19]) { P.vl(x, -34, 34, 0x6a4a2a); P.vl(x + 1, -34, 34, 0x4a3020); }
    canopy(P, -21, 20, -46, c1, c2, s.name);
    for (let x = -21; x <= 20; x++) P.px(x, 1, 0x1a1422, 0.3);
  });
  return { back, open: front(true), shut: front(false) };
}
// karusellen: plattform, mittstång, hästar på stänger som går runt, randigt tak med lampor och flagga
function carouselSprites() {
  const R = 30;
  const base = spr(70, 22, 35, 14, (P) => {
    P.ell(0, -4, R + 2, 9, 0x6a3a2a, 1, 1); P.ell(0, -5, R, 8, 0xd8b070, 1, 1);
    for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; P.px(Math.round(Math.cos(an) * (R - 3)), Math.round(-5 + Math.sin(an) * 7), 0xb08a50); }
    for (let x = -R; x <= R; x++) { const yy = -5 + Math.round(Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * 8); for (let j = 1; j <= 3; j++) P.px(x, yy + j, j === 1 ? 0xe8443a : j === 2 ? 0xf4d23c : 0x8a2a24); }
  });
  const roof = spr(78, 40, 39, 40, (P) => {
    for (let j = 0; j < 18; j++) {
      const hw = Math.round(4 + j * 1.9);
      for (let i = -hw; i <= hw; i++) { const st = Math.floor((i / hw + 1) * 6) & 1 ? 0xf4f0e6 : 0xd8303a; P.px(i, -40 + j + 6, j === 17 ? mul(st, 0.8) : mix(st, mul(st, 0.75), j / 18)); }
    }
    for (let i = -38; i <= 38; i++) { const u = (i + 40) % 6; if (u > 0 && u < 5) P.px(i, -16, (i >> 1) & 1 ? 0xd8303a : 0xf4f0e6); if (u > 1 && u < 4) P.px(i, -15, 0xd8303a); }
    P.vl(0, -40, 6, 0x5a5a60); for (let k = 0; k < 5; k++) P.px(1 + k, -40 + (k >> 1), 0x3a9bff);
  });
  const HORSE = [
    '..............mm....',
    '.............m###...',
    '............m##e##..',
    '............m#####..',
    '...........m###.....',
    'mm........####......',
    'mmm###########......',
    '.m#sssss########....',
    '..#sssss#########...',
    '..###############...',
    '...#############....',
    '...#..#.....#..#....',
    '...#..#.....#..#....',
    '...h..h.....h..h....',
  ];
  const horse = (c, saddle, dir) => spr(24, 18, 12, 16, (P) => {
    HORSE.forEach((row, j) => { for (let i = 0; i < row.length; i++) {
      const ch = row[i]; if (ch === '.') continue;
      const x = dir > 0 ? i - 10 : 9 - i, y = j - 13;
      P.px(x, y, ch === '#' ? (j < 7 ? mix(c, WHITE, 0.18) : j > 9 ? mul(c, 0.8) : c) : ch === 'm' ? mul(saddle, 0.85) : ch === 's' ? (j === 7 ? mix(saddle, WHITE, 0.25) : saddle) : ch === 'e' ? 0x2a2a30 : 0x3a3a40);
    } });
  });
  const H = [];
  for (const [c, s] of [[0xf8f4ec, 0xd8303a], [0xc89a6a, 0x3a6ab0], [0x8a8e96, 0xf4d23c], [0xf8f4ec, 0x5aa060], [0x6a4a2a, 0xe070c0], [0xf8f4ec, 0x9a6ab0]]) H.push([horse(c, s, 1), horse(c, s, -1)]);
  return { R, base, roof, H };
}
function balloonSprites() {
  const C = [0xe8443a, 0xf4d23c, 0x3a9bff, 0x5ad35a, 0xe070c0, 0xff8a2a, 0x9a7ae0];
  return C.map((c) => spr(8, 10, 4, 9, (P) => { P.ell(0, -5, 3.2, 4, c, 1, 1); P.px(-1, -7, mix(c, WHITE, 0.6)); P.px(0, -1, mul(c, 0.7)); }));
}
function wheelSprites() {
  const C = [0xe8443a, 0xf4f0e6, 0x3a9bff, 0xf4d23c, 0x5ad35a, 0xf4f0e6, 0xe070c0, 0xff8a2a];
  const F = [];
  for (let f = 0; f < 16; f++) F.push(spr(28, 28, 14, 14, (P) => {
    for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) {
      const d = Math.hypot(x, y);
      if (d > 12.5) continue;
      if (d > 11.3) { P.px(x, y, (Math.round(Math.atan2(y, x) * 8) & 1) ? 0xf8e070 : 0x8a6a2a); continue; }
      const an = (Math.atan2(y, x) / (Math.PI * 2) + 1 + f / 16) % 1, seg = Math.floor(an * 8);
      P.px(x, y, d < 2 ? 0xd8b050 : mul(C[seg], 0.92 + (d < 6 ? 0.08 : 0)));
    }
  }));
  const booth = spr(40, 50, 20, 46, (P) => {
    for (let y = -16; y <= 0; y++) for (let x = -18; x <= 17; x++) P.px(x, y, ((x + 40) >> 2) & 1 ? 0xf4d23c : 0xe8443a);
    P.hl(-19, -17, 38, 0xf8f4ec); P.hl(-19, -16, 38, 0xc8a050);
    for (const x of [-18, 17]) { P.vl(x, -44, 44, 0x6a4a2a); }
    canopy(P, -19, 18, -46, 0x3a6ab0, 0xf4f0e6, $t('LYCKOHJUL'));
    P.rect(-1, -34, 3, 18, 0x6a4a2a);
    for (let k = 0; k < 3; k++) { P.rect(-14 + k * 4, -14, 3, 4, [0xb07a4a, 0xe070c0, 0x6ab0d0][k]); P.px(-13 + k * 4, -15, [0xb07a4a, 0xe070c0, 0x6ab0d0][k]); }   // priserna: nallar
    P.rect(7, -14, 8, 4, 0xfaf6ea); text(P, SMALL, '10', 8, -14, 0xd8303a, 0.9);
  });
  return { F, booth };
}
function stoolSprite() { return spr(10, 8, 5, 7, (P) => { P.rect(-4, -5, 8, 2, 0x8a5a3a); P.hl(-4, -5, 8, 0xb07a4a); for (const x of [-3, 2]) P.vl(x, -3, 4, 0x5a3a24); }); }
// vimpel- och ljusslingorna från brunnens lykta ut till torgets fyra lyktor (en bild för hela torget)
function buntingArt(T) {
  const [tx0, ty0, tx1, ty1] = T, W = tx1 - tx0, H = ty1 - ty0 + 120, ox = tx0, oy = ty0 - 100;
  const P = new Pix(W, H, ox, oy), bulbs = [];
  const well = LINNE_LAYOUT.well, hub = [well.x, well.y + 8 - 52];
  const lamps = [[tx0 + 52, ty0 + 16 - 46], [tx1 - 52, ty0 + 16 - 46], [tx0 + 52, ty1 - 6 - 46], [tx1 - 52, ty1 - 6 - 46]];
  const FL = [0xe8443a, 0xf4d23c, 0x3a9bff, 0x5ad35a, 0xe070c0, 0xff8a2a, 0xf4f1ea];
  const string = (a, b, sag, k0) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    let last = -99;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag;
      P.px(x, y, 0x3a3a40);
      if (i - last >= 7 && i > 3 && i < n - 3) {
        last = i;
        const c = FL[((i / 7) | 0) + k0 & 0x7fffffff % FL.length] ?? FL[(((i / 7) | 0) + k0) % FL.length];
        for (let r = 0; r < 4; r++) for (let q = -(2 - (r >> 1)); q <= 2 - (r >> 1); q++) P.px(x + q, y + 1 + r, r === 0 ? mix(c, WHITE, 0.2) : r >= 2 ? mul(c, 0.82) : c);
      } else if (i % 7 === 3) { bulbs.push([Math.round(x), Math.round(y + 1)]); P.px(x, y + 1, 0xfff0c0); }
    }
  };
  // (inte mot den sydvästra lyktan och inte längs södra kanten – där står karusellen)
  [0, 1, 3].forEach((k) => string(hub, lamps[k], 8, k * 2));
  string(lamps[0], lamps[1], 10, 1);
  return { img: P.flush(), x: ox, y: oy, bulbs };
}

// ---------- modulen ----------
export function createMarket(env) {
  if (!LINNE_LAYOUT) return { items: () => [], obstacles: [], glow() {}, update() {}, stallAt: () => null, stalls: [] };
  const T = LINNE_LAYOUT.torg;
  const art = {}, CAR = carouselSprites(), BAL = balloonSprites(), WHEEL = wheelSprites(), STOOL = stoolSprite();
  for (const s of STALLS) if (!s.kind) art[s.id] = stallSprites(s);
  const BUNT = buntingArt(T);
  let wheelSpin = 0, wheelAt = 0, rideT = -9;
  const obstacles = [];
  for (const s of STALLS) {
    if (!s.kind) obstacles.push([s.x - 21, s.y - 14, s.x + 21, s.y + 1]);
    else if (s.kind === 'karusell') obstacles.push([s.x - 32, s.y - 12, s.x + 32, s.y + 2]);
    else if (s.kind === 'hjul') obstacles.push([s.x - 19, s.y - 16, s.x + 19, s.y + 1]);
    else obstacles.push([s.x - 6, s.y - 3, s.x + 6, s.y + 1]);
  }
  // kunderna vid stånden (dekor – de byts ut då och då)
  const rng = (seed) => { let i = 0; return () => hash(seed, i++, 911); };
  const shoppers = STALLS.filter((s) => !s.kind).flatMap((s, i) => [0, 1].map((k) => ({ s, k, dx: k ? 9 : -9, looks: [0, 1, 2].map((v) => makeLook(rng(i * 97 + k * 13 + v * 7 + 3))) })));
  const kids = [0, 1, 2].map((v) => ({ ...makeLook(rng(500 + v)), kid: true }));
  const hour = () => env.hour ?? 12;
  const items = () => {
    const h = hour(), open = isOpen(h), t = env.t || 0, out = [];
    // stånden: bakvägg → handlaren → disken med varorna och taket
    for (const s of STALLS) {
      if (s.kind) continue;
      const A = art[s.id];
      out.push({ x: s.x, y: s.y - 0.5, draw: (ctx) => {
        put(ctx, A.back, s.x, s.y);
        if (open) {
          const sh = Math.floor(t / 7 + s.x) % 5 === 0, sway = Math.sin(t * 0.6 + s.x) * 6;
          drawPerson(ctx, s.x + Math.round(sway), s.y - 5, s.look, 'down', sh ? (Math.floor(t * 3) % 2 ? 11 : 0) : 0);
          if (sh && s.rop) shout(ctx, s.x, s.y - 62, s.rop);
        }
        put(ctx, open ? A.open : A.shut, s.x, s.y);
      } });
    }
    // kunderna
    if (open) for (const c of shoppers) {
      const slot = Math.floor((t + c.s.x * 0.37 + c.k * 11) / 22), on = hash(slot, c.s.x + c.k, 71) > 0.35;
      if (!on) continue;
      const L = c.looks[((slot % 3) + 3) % 3], x = c.s.x + c.dx, y = c.s.y + 10 + c.k;
      out.push({ x, y, draw: (ctx) => drawPerson(ctx, x, y, L, Math.floor(t * 0.4 + c.k) % 4 === 0 ? (c.k ? 'left' : 'right') : 'up', Math.sin(t * 2 + x) > 0.92 ? 4 : 0) });
    }
    // karusellen
    const K = STALLS.find((s) => s.kind === 'karusell');
    if (K) {
      const spin = isOpen(h, KARUSELL), ang = spin ? t * 0.7 : 0.4;
      const horses = CAR.H.map((H, i) => { const a = ang + i * Math.PI / 3; return { H, i, x: K.x + Math.cos(a) * (CAR.R - 9), y: K.y - 5 + Math.sin(a) * 6, back: Math.sin(a) < 0, dir: -Math.sin(a) > 0 ? 1 : -1, bob: spin ? Math.round(Math.sin(t * 3 + i * 1.7) * 2) : 0 }; });
      const drawHorses = (ctx, back) => {
        for (const ho of horses.filter((q) => q.back === back).sort((a, b) => a.y - b.y)) {
          ctx.fillStyle = '#e8c860'; const px = Math.round(ho.x) + (ho.dir > 0 ? -5 : 5); ctx.fillRect(px, Math.round(K.y - 41), 1, Math.round(ho.y + ho.bob - 6 - (K.y - 41)));   // stången
          put(ctx, ho.H[ho.dir > 0 ? 0 : 1], ho.x, ho.y + ho.bob);
        }
      };
      out.push({ x: K.x, y: K.y - 8, draw: (ctx) => { put(ctx, CAR.base, K.x, K.y); drawHorses(ctx, true); ctx.fillStyle = '#c8a050'; ctx.fillRect(K.x - 2, K.y - 42, 5, 36); ctx.fillStyle = '#e8d8a0'; ctx.fillRect(K.x - 1, K.y - 40, 1, 32); ctx.fillStyle = '#d8303a'; for (let k = 0; k < 4; k++) ctx.fillRect(K.x - 2, K.y - 38 + k * 8, 5, 2); } });
      out.push({ x: K.x, y: K.y + 1, draw: (ctx) => { drawHorses(ctx, false); put(ctx, CAR.roof, K.x, K.y - 26); if (spin && Math.floor(t / 9) % 3 === 0) shout(ctx, K.x, K.y - 78, K.rop); } });
    }
    // ballongförsäljaren
    const B = STALLS.find((s) => s.kind === 'ballong');
    if (B) out.push({ x: B.x, y: B.y, draw: (ctx) => {
      const hx = B.x + 5, hy = B.y - 16;
      BAL.forEach((s, i) => {
        const bx = B.x + 5 + Math.round(Math.sin(i * 2.1) * 8 + Math.sin(t * 1.3 + i) * 1.5), by = B.y - 38 - (i % 3) * 6 + Math.round(Math.sin(t * 1.7 + i * 1.3) * 1.5);
        ctx.fillStyle = 'rgba(240,236,224,0.8)'; const n = Math.max(1, Math.round(Math.hypot(bx - hx, by - hy)));
        for (let k = 0; k <= n; k += 2) ctx.fillRect(Math.round(hx + (bx - hx) * k / n), Math.round(hy + (by - hy) * k / n), 1, 1);
        put(ctx, s, bx, by);
      });
      if (open) drawPerson(ctx, B.x, B.y, B.look, 'down', Math.floor(t / 6) % 4 === 0 ? 11 : 0);
    } });
    // dragspelaren på sin pall, noterna stiger
    const M = STALLS.find((s) => s.kind === 'musik');
    if (M) out.push({ x: M.x, y: M.y, draw: (ctx) => {
      put(ctx, STOOL, M.x, M.y);
      if (!open) return;
      drawPerson(ctx, M.x, M.y - 1, M.look, 'down', 5);
      const bw = 6 + Math.round(Math.sin(t * 4) * 2);
      ctx.fillStyle = '#c8302a'; ctx.fillRect(M.x - Math.ceil(bw / 2) - 3, M.y - 16, 3, 6); ctx.fillRect(M.x + Math.floor(bw / 2), M.y - 16, 3, 6);
      ctx.fillStyle = '#f4f0e6'; for (let k = 0; k < bw; k += 2) ctx.fillRect(M.x - Math.ceil(bw / 2) + k, M.y - 16, 1, 6);
      ctx.fillStyle = '#2a2a30'; for (let k = 1; k < bw; k += 2) ctx.fillRect(M.x - Math.ceil(bw / 2) + k, M.y - 16, 1, 6);
      for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3) % 1, nx = Math.round(M.x + 6 + ph * 10 + Math.sin(t * 2 + i) * 2), ny = Math.round(M.y - 24 - ph * 18); ctx.fillStyle = rgba(0x2a2430, 1 - ph); ctx.fillRect(nx, ny, 1, 4); ctx.fillRect(nx - 2, ny + 3, 2, 2); ctx.fillRect(nx + 1, ny, 2, 1); }
    } });
    // lyckohjulet (snurrar efter ett köp och stannar på vinsten)
    const W = STALLS.find((s) => s.kind === 'hjul');
    if (W) out.push({ x: W.x, y: W.y, draw: (ctx) => {
      put(ctx, WHEEL.booth, W.x, W.y);
      if (open) drawPerson(ctx, W.x + 10, W.y - 17, W.look, 'down', 0);
      const left = wheelAt - t, f = left > 0 ? Math.floor((wheelSpin - left * left * 6) * 1) & 15 : Math.floor(wheelSpin) & 15;
      put(ctx, WHEEL.F[(f + 16) % 16], W.x - 5, W.y - 30);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(W.x - 5, W.y - 44, 1, 3); ctx.fillRect(W.x - 6, W.y - 44, 3, 1);
    } });
    // vimplarna och ljusslingorna (hänger över allt på torget)
    out.push({ y: 1e5 + 1, draw: (ctx) => ctx.drawImage(BUNT.img, BUNT.x, BUNT.y) });
    return out;
  };
  function shout(ctx, cx, y, s) {
    const tw = textW(SMALL, s), w = tw + 6, x = Math.round(cx - w / 2);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1, y - 1, w + 2, 12);
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(x, y, w, 10); ctx.fillRect(Math.round(cx), y + 10, 1, 2);
    ctxText(ctx, SMALL, s, x + 3, y + 3, '#8a2a1a');
  }
  function glow(ctx, view) {
    const k = Math.max(0, Math.min(1, ((env.dark || 0) - 0.1) / 0.28));
    if (k <= 0 || !view || view.x > T[2] + 40 || view.x + view.w < T[0] - 40) return;
    const t = env.t || 0, h = hour();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    BUNT.bulbs.forEach(([x, y], i) => {
      const tw = 0.75 + 0.25 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = rgba(0xffd070, 0.85 * k * tw); ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = rgba(0xffb050, 0.2 * k * tw); ctx.fillRect(x - 2, y - 1, 5, 4);
    });
    const K = STALLS.find((s) => s.kind === 'karusell');
    if (K && h < 22) for (let i = -36; i <= 36; i += 6) { const on = (Math.floor(t * 4) + i) % 12 < 6; ctx.fillStyle = rgba(on ? 0xfff0a0 : 0xffb060, 0.8 * k); ctx.fillRect(K.x + i, K.y - 43, 1, 1); ctx.fillStyle = rgba(0xffd070, 0.18 * k); ctx.fillRect(K.x + i - 2, K.y - 45, 5, 5); }
    for (const s of STALLS) if (!s.kind && isOpen(h, [OPEN[0], 22])) { ctx.fillStyle = rgba(0xffe0a0, 0.16 * k); ctx.fillRect(s.x - 18, s.y - 34, 36, 22); }
    ctx.restore();
  }
  function stallAt(x, y) {
    for (const s of STALLS) {
      const r = s.kind === 'karusell' ? [s.x - 34, s.y - 60, s.x + 34, s.y + 4] : s.kind === 'musik' || s.kind === 'ballong' ? [s.x - 10, s.y - 44, s.x + 14, s.y + 4] : [s.x - 22, s.y - 48, s.x + 22, s.y + 4];
      if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) return { ...s, walk: { x: s.x + (s.kind === 'karusell' ? 0 : 0), y: s.y + 9 } };
    }
    return null;
  }
  return {
    items, obstacles, glow, stallAt, stalls: STALLS,
    update() {},
    spinWheel(t) { wheelAt = t + 2.2; wheelSpin = (wheelSpin + 20 + Math.random() * 16) % 64; },
    ride(t) { rideT = t; },
  };
}

// ---------- handelsrutan ----------
const marketPrice = (r) => Math.max(2, Math.round(r.price * 0.9));   // marknaden är lite billigare än affären
export function openStall(A, s, M) {
  const g = A.game, h = (g.min ?? 720) / 60;
  if (!isOpen(h)) { toast($t`🌙 Marknaden har stängt – stånden öppnar ${OPEN[0]}.00.`, 'bad'); return; }
  const money = () => $t`💰 <b>${g.money} kr</b>`;
  if (s.kind === 'karusell') {
    if (!isOpen(h, KARUSELL)) { toast($t('🎠 Karusellen vilar – den går 10–20.')); return; }
    openModal($t('🎠 Karusellen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Ett varv på karusellen kostar <b>${s.pris} kr</b>. Välj häst!`}<br>${money()}</p>`, [
      { label: $t('Inte nu'), onClick: closeModal },
      { label: $t`🎠 Åk (${s.pris} kr)`, cls: g.money >= s.pris ? 'btn-go' : '', onClick: () => {
        closeModal();
        if (g.money < s.pris) { play('fel'); toast($t('💸 Du har inte råd med ett varv.'), 'bad'); return; }
        g.money -= s.pris; g.passTime(10); g.glad?.(6, $t('Karusellen'), 'karusell', 12); g.save();
        M?.ride?.(A.scene?._debug?.env?.t || 0);
        play('coin'); toast($t('🎠 Wiii! Du åker ett varv på den vita hästen – musiken spelar och allt snurrar. 😊'), 'good');
      } },
    ]);
    return;
  }
  if (s.kind === 'ballong') {
    openModal($t('🎈 Ballonger'), `<p style="font-size:var(--f2);margin-top:0">${$t`En ballong kostar <b>${s.pris} kr</b>.`}<br>${money()}</p>`, [
      { label: $t('Inte nu'), onClick: closeModal },
      { label: $t`🎈 Köp en (${s.pris} kr)`, cls: g.money >= s.pris ? 'btn-go' : '', onClick: () => {
        closeModal();
        if (g.money < s.pris) { play('fel'); toast($t('💸 Du har inte råd med en ballong.'), 'bad'); return; }
        g.money -= s.pris; g.glad?.(3, $t('En ballong'), 'ballong', 6); g.save();
        const C = [$t('röd'), $t('gul'), $t('blå'), $t('grön'), $t('rosa'), $t('orange'), $t('lila')];
        play('coin'); toast($t`🎈 Du får en ${C[Math.floor(Math.random() * C.length)]} ballong! 😊`, 'good');
      } },
    ]);
    return;
  }
  if (s.kind === 'musik') {
    play('click'); g.glad?.(2, $t('Dragspelaren'), 'dragspel', 4); g.save();
    toast($t('🪗 Dragspelaren nickar och spelar en vals bara för dig. 🎵'), 'good');
    return;
  }
  if (s.kind === 'hjul') {
    openModal($t('🎡 Lyckohjulet'), `<p style="font-size:var(--f2);margin-top:0">${$t`Snurra hjulet för <b>${s.pris} kr</b> – vinn pengar eller en nalle!`}<br>${money()}</p>`, [
      { label: $t('Inte nu'), onClick: closeModal },
      { label: $t`🎡 Snurra (${s.pris} kr)`, cls: g.money >= s.pris ? 'btn-go' : '', onClick: () => {
        closeModal();
        if (g.money < s.pris) { play('fel'); toast($t('💸 Du har inte råd att snurra.'), 'bad'); return; }
        g.money -= s.pris; g.save();
        M?.spinWheel?.(A.scene?._debug?.env?.t || 0);
        play('click');
        const r = Math.random();
        setTimeout(() => {
          if (r < 0.45) toast($t('🎡 Nitlott! Hjulet stannade på den vita rutan. Försök igen!'));
          else if (r < 0.75) { g.money += 20; g.save(); play('coin'); toast($t('🎡 Du vann 20 kr! 🎉'), 'good'); }
          else if (r < 0.9) { g.glad?.(5, $t('Vann en nalle'), 'lyckohjul', 10); g.save(); play('coin'); toast($t('🎡 Du vann en nalle! 🧸 😊'), 'good'); }
          else { g.money += 50; g.save(); play('coin'); toast($t('🎡 STORVINST – 50 kr! 🎉🎉'), 'good'); }
        }, 2300);
      } },
    ]);
    return;
  }
  const rows = [];
  for (const id of s.vara || []) {
    const r = ravaraOf(id);
    if (!r) continue;
    const p = marketPrice(r), full = (g.skafferi?.[id] | 0) >= MAX_RAVA;
    rows.push(`<div class="prow shoprow"><span style="font-size:28px;text-align:center">${r.icon}</span>
      <span class="nm">${esc(r.name)}<br><small class="sp">${$t('till skafferiet')}${(g.skafferi?.[id] | 0) ? ` · ${$t`du har ${g.skafferi[id]}`}` : ''}</small></span>
      <button class="btn btn-small ${g.money >= p && !full ? 'btn-go' : ''}" data-vara="${id}" ${g.money >= p && !full ? '' : 'disabled'}>${full ? $t('fullt') : fmt(p)}</button></div>`);
  }
  for (const m of s.treat || []) {
    rows.push(`<div class="prow shoprow"><span style="font-size:28px;text-align:center">${m.icon}</span>
      <span class="nm">${esc(m.namn)}<br><small class="sp">${m.matt ? `${$t`+${m.matt} mätthet`} · ` : ''}${$t('😊 lycka')}</small></span>
      <button class="btn btn-small ${g.money >= m.pris ? 'btn-go' : ''}" data-treat="${m.id}" ${g.money >= m.pris ? '' : 'disabled'}>${fmt(m.pris)}</button></div>`);
  }
  const dlg = openModal(`${s.icon} ${esc(s.name.charAt(0) + s.name.slice(1).toLowerCase())}`, `<p style="font-size:var(--f2);margin-top:0">"${esc(s.rop.charAt(0) + s.rop.slice(1).toLowerCase())}" ${$t('Marknadspris – lite billigare än i affären.')}<br>${money()}</p><div class="plist">${rows.join('')}</div>`,
    [{ label: $t('Klar'), onClick: closeModal }]);
  const refresh = () => { closeModal(); openStall(A, s, M); };
  dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => {
    const r = ravaraOf(b.dataset.vara), p = marketPrice(r);
    if (g.money < p) { play('fel'); toast($t('💸 Du har inte råd.'), 'bad'); return; }
    if ((g.skafferi[r.id] | 0) >= MAX_RAVA) { toast($t`Skafferiet är fullt av ${r.name.toLowerCase()}.`, 'bad'); return; }
    g.money -= p; g.skafferi[r.id] = (g.skafferi[r.id] | 0) + 1; g.save();
    play('coin'); toast($t`${r.icon} ${r.name} till skafferiet – ${p} kr.`, 'good');
    refresh();
  }));
  dlg.querySelectorAll('[data-treat]').forEach((b) => (b.onclick = () => {
    const m = (s.treat || []).find((x) => x.id === b.dataset.treat);
    if (!m || g.money < m.pris) { play('fel'); toast($t('💸 Du har inte råd.'), 'bad'); return; }
    g.money -= m.pris;
    if (m.matt) g.hunger = Math.min(100, g.hunger + m.matt);
    g.glad?.(m.glad || 1, $t('Marknaden'), 'marknad', 10);
    g.passTime(5); g.save();
    closeModal(); play('coin');
    toast(m.text ? `${m.icon} ${m.text} 😊` : $t`${m.icon} Mums! ${m.namn}. 😊`, 'good');
  }));
}
