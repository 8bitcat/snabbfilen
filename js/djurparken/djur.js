// 🦁 DJURPARKENS DJUR – ritade i kod, ett pixelkorn, ljuset uppifrån vänster (Carl 2026-11-18: "Djurparken –
// inhägnader, djurskötarjobb med matning, ponnyridning, souvenirkiosk, entré"). Varje art har en målare som ritar
// djuret sett från sidan (vänt åt höger) med fötterna i origo; bildrutorna (gång, äta, sova, specialare) cachas per
// art/ruta/läge och speglas med ctx när djuret går åt vänster. Skugga under alla.
//
//   ritaDjur(ctx, art, x, y, { st = 'idle', f = 0, dir = 'right', natt })
//   art ∈ lejon · elefant · giraff · apa · pingvin · flamingo · bjorn · bjornunge · get · ponny · pafagel · anka
//   st:  idle | walk | ata | sov | ryt (lejon) | spray (elefant) | hang (apa) | sim (pingvin) | dipp (flamingo)
//        | sitt (björn) | fan (påfågel) | dyk (anka)
//   DJURFAKTA: skyltarnas texter per inhägnad (scenen).
import { Pix, mix, mul, hash } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

const K = 0x1a1414, VIT = 0xf4f1ea;
// paletter [mörk, skugga, bas, ljus, högdager]
const PAL = {
  lejon: [0x6e4216, 0x9a6424, 0xd8a860, 0xeac890, 0xf8e4b8], man: [0x7a3a10, 0xa85a1c, 0xc87a2c, 0xe09a44, 0xf0b860],
  elefant: [0x3e4048, 0x5e626c, 0x8a8e98, 0xa8acb6, 0xc4c8d0], giraff: [0x8a5a1a, 0xc08a2a, 0xe8c060, 0xf4dc90, 0xfcecb8], flack: 0x7a4418,
  apa: [0x3a2214, 0x5a3820, 0x7a5030, 0x9a6a44, 0xb88a60], apans: 0xe8c0a0, pingvin: [0x0c0c14, 0x1e1e2a, 0x2c2c3c, 0x40405a], mage: 0xf8f8f4,
  flamingo: [0xb8386a, 0xd85a88, 0xf07aa8, 0xf8a0c0, 0xffc8dc], bjorn: [0x2e1a10, 0x4a2c1a, 0x6a4028, 0x8a5838, 0xa87050], nos: 0xc89a6a,
  get: [0x8a847a, 0xb8b2a6, 0xe8e4da, 0xf4f1ea, 0xffffff], getbrun: [0x4a2c18, 0x6a4428, 0x8a5c38, 0xa87850, 0xc49868],
  ponny: [0x3a2010, 0x5e3418, 0x8a4e24, 0xa86a34, 0xc48a4c], man: 0x1a1414, pafagel: [0x0a2a5a, 0x124a8a, 0x1a6ab8, 0x3a9ad8, 0x6ac4f0], fjader: [0x0e5a3a, 0x1a8a52, 0x2ab86a, 0xf0c030],
  anka: [0x8a6a1a, 0xb89028, 0xe0b838, 0xf0d060, 0xf8e890],
};
const tone = (pal, u) => pal[Math.max(0, Math.min(pal.length - 1, Math.round(u * (pal.length - 1))))];
// fylld ellips med rund skuggning: ljus upptill vänster, mörk nertill höger
function ell(P, cx, cy, rx, ry, pal, lift = 0.55) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
    if (d > 1) continue;
    const u = lift - dy * 0.35 - dx * 0.12 - d * 0.25 + (hash(x, y, 3) - 0.5) * 0.06;
    P.px(x, y, d > 0.86 && (dy > 0.2 || dx > 0.5) ? pal[0] : tone(pal, u));
  }
}
const leg = (P, x, y, w, h, c, c2) => { P.rect(x, y - h, w, h, c); P.vl(x + w - 1, y - h, h, c2); };
const eye = (P, x, y) => { P.px(x, y, K); P.px(x, y - 1, VIT, 0.6); };
const S = new Map();
function bild(key, fn) { if (S.has(key)) return S.get(key); const P = new Pix(72, 72, -36, -64); fn(P); const s = P.flush(); S.set(key, s); return s; }

// ------------------------------------------------------------------ arterna
const ART = {
  // 🦁 lejonet: lång kropp, man runt huvudet, svans med tofs. ligg = ligger på mage, ryt = gapet öppet
  lejon(P, f, st) {
    const B = PAL.lejon, M = PAL.man, ligg = st === 'sov' || st === 'ligg';
    const by = ligg ? -5 : -11;
    if (!ligg) { leg(P, -9, 0, 3, 8, B[2], B[1]); leg(P, 5, 0, 3, 8, B[2], B[1]); leg(P, -5 + (f ? 2 : 0), 0, 3, 9, B[3], B[2]); leg(P, 9 - (f ? 2 : 0), 0, 3, 9, B[3], B[2]); }
    ell(P, -1, by, 12, ligg ? 5 : 6, B);
    for (let i = 0; i < 9; i++) P.px(-12 - i, by - 2 + Math.round(Math.sin(i * 0.6 + (f ? 1 : 0)) * 2), M[2]); P.rect(-22, by - 3 + (f ? 1 : 0), 3, 3, M[1]);   // svansen med tofs
    ell(P, 10, by - 6, 8, 7, M, 0.62);   // manen
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; P.px(10 + Math.round(Math.cos(a) * 8.5), by - 6 + Math.round(Math.sin(a) * 7.5), M[1]); }   // manens tofsar
    ell(P, 12, by - 6, 5, 4, B, 0.65);   // huvudet
    P.px(10, by - 10, M[2]); P.px(14, by - 10, M[2]); P.px(11, by - 11, B[2]); P.px(14, by - 11, B[2]);   // öronen
    eye(P, 14, by - 7); P.px(17, by - 5, 0x4a2a1a); P.px(16, by - 4, B[1]);
    if (st === 'ryt') { P.rect(15, by - 3, 4, 3, 0x7a1a1a); P.px(15, by - 3, VIT); P.px(18, by - 3, VIT); }
    if (ligg) { P.rect(-8, -2, 6, 2, B[3]); P.rect(2, -2, 6, 2, B[3]); P.hl(-9, -1, 20, B[0]); }
    if (st === 'sov') { P.rect(13, by - 8, 2, 1, K); }
  },
  // 🐘 elefanten: stor kropp, huvud med stort öra, snabel (ner/upp), betar. spray = snabeln upp och vattendroppar
  elefant(P, f, st) {
    const B = PAL.elefant, upp = st === 'spray' || f === 2;
    leg(P, -14, 0, 6, 12, B[2], B[1]); leg(P, 6, 0, 6, 12, B[2], B[1]);
    leg(P, -8 + (f === 1 ? 2 : 0), 0, 6, 13, B[3], B[2]); leg(P, 12 - (f === 1 ? 2 : 0), 0, 6, 13, B[3], B[2]);
    for (const lx of [-14, -8, 6, 12]) { P.hl(lx, -1, 6, B[0]); P.px(lx + 1, -2, B[4], 0.5); P.px(lx + 3, -2, B[4], 0.5); }   // tånaglar
    ell(P, 0, -22, 19, 12, B);
    for (let i = 0; i < 8; i++) P.px(-19 - (i >> 1), -24 + i, B[1]); P.rect(-23, -17, 2, 3, B[0]);   // svansen
    ell(P, 16, -25, 9, 9, B, 0.6);   // huvudet
    ell(P, 10, -24, 6, 8, [B[1], B[2], B[3], B[3], B[4]], 0.5); P.px(9, -26, 0xd8a0a0, 0.5); P.px(10, -23, 0xd8a0a0, 0.5);   // örat
    eye(P, 20, -27);
    if (upp) { for (let i = 0; i < 12; i++) { const x = 23 + Math.round(Math.sin(i * 0.28) * 5), y = -24 - i; P.rect(x, y, 3, 1, i < 4 ? B[3] : B[2]); } P.px(25, -36, B[1]);
      if (st === 'spray') for (let k = 0; k < 7; k++) P.px(26 + k * 2 + (k & 1), -40 - k * 2 + ((k * 3) % 4), 0x8ad8ff); }
    else { for (let i = 0; i < 14; i++) { const x = 22 + Math.round(Math.sin(i * 0.2) * 2) + (f === 1 && i > 9 ? 1 : 0), y = -22 + i; P.rect(x, y, 3, 1, i < 5 ? B[3] : B[2]); } P.px(24, -8, B[1]); }
    P.rect(21, -19, 5, 1, VIT); P.px(26, -18, VIT); P.px(25, -19, 0xd8d8d0);   // beten
  },
  // 🦒 giraffen: hög, lång hals, fläckar, hornknoppar. ata = huvudet nere vid trädet (framåt-ner)
  giraff(P, f, st) {
    const B = PAL.giraff, F = PAL.flack, ata = st === 'ata';
    leg(P, -8, 0, 3, 20, B[2], B[1]); leg(P, 5, 0, 3, 20, B[2], B[1]); leg(P, -4 + (f ? 2 : 0), 0, 3, 21, B[3], B[2]); leg(P, 9 - (f ? 2 : 0), 0, 3, 21, B[3], B[2]);
    for (const lx of [-8, -4, 5, 9]) P.hl(lx, -1, 3, B[0]);
    ell(P, 0, -26, 11, 7, B);
    for (let i = 0; i < 7; i++) P.px(-11 - (i >> 1), -28 + i, B[1]); P.rect(-15, -22, 2, 3, 0x4a2a10);
    const nx = ata ? 1 : 0;
    for (let i = 0; i < 24; i++) { const x = 8 + Math.round(i * (ata ? 0.9 : 0.42)) + nx, y = -30 - (ata ? Math.round(i * 0.45) : i); P.rect(x, y, 4, 1, i % 5 === 0 ? B[1] : B[2]); P.px(x + 3, y, B[1]); P.px(x, y, B[3]); }   // halsen
    for (let i = 0; i < 24; i += 3) P.px(9 + Math.round(i * (ata ? 0.9 : 0.42)) + 2, -30 - (ata ? Math.round(i * 0.45) : i), 0x4a2a10);   // manen
    const hx = ata ? 32 : 18, hy = ata ? -42 : -55;
    ell(P, hx + 2, hy, 5, 3, B, 0.6); P.rect(hx + 5, hy - 1, 3, 3, B[1]); eye(P, hx + 2, hy - 2);
    P.px(hx, hy - 4, B[1]); P.px(hx, hy - 5, 0x4a2a10); P.px(hx + 2, hy - 4, B[1]); P.px(hx + 2, hy - 5, 0x4a2a10);   // hornknopparna
    P.px(hx - 2, hy - 2, B[1]); P.px(hx - 3, hy - 3, B[1]);   // örat
    for (const [x, y] of [[-6, -27], [-1, -24], [3, -28], [-8, -23], [6, -24], [-3, -29]]) { P.rect(x, y, 3, 2, F); P.px(x + 1, y - 1, F); }
    for (let i = 0; i < 24; i += 6) { const x = 8 + Math.round(i * (ata ? 0.9 : 0.42)) + 1, y = -32 - (ata ? Math.round(i * 0.45) : i); P.rect(x, y, 2, 2, F); }
  },
  // 🐒 apan: liten, brun, lång ringlad svans, ljust ansikte. hang = armarna upp (hänger i stången)
  apa(P, f, st) {
    const B = PAL.apa, hang = st === 'hang';
    if (hang) {
      ell(P, 0, -8, 5, 6, B); leg(P, -5, -12, 2, 9, B[2], B[1]); leg(P, 4, -12, 2, 9, B[2], B[1]);   // kroppen hänger, armarna upp
      P.rect(-3, -2, 2, 3, B[1]); P.rect(2, -2, 2, 3, B[1]);
      ell(P, 1, -15, 4, 4, B, 0.6); P.rect(0, -16, 4, 3, PAL.apans); eye(P, 1, -16); eye(P, 3, -16); P.px(2, -14, 0x8a5a4a);
      for (let i = 0; i < 9; i++) P.px(5 + Math.round(Math.sin(i * 0.7) * 2), -6 + i, B[1]);
      return;
    }
    const sitt = st !== 'walk';
    leg(P, -3 + (f ? 1 : 0), 0, 2, sitt ? 3 : 6, B[2], B[1]); leg(P, 2 - (f ? 1 : 0), 0, 2, sitt ? 3 : 6, B[2], B[1]);
    ell(P, 0, sitt ? -6 : -8, 5, 5, B);
    P.rect(-5, sitt ? -6 : -8, 2, 5, B[1]); P.rect(4, sitt ? -6 : -8, 2, 5, B[1]);   // armarna
    ell(P, 2, sitt ? -13 : -15, 4, 4, B, 0.6); P.rect(1, sitt ? -14 : -16, 4, 3, PAL.apans); eye(P, 2, sitt ? -14 : -16); eye(P, 4, sitt ? -14 : -16); P.px(3, sitt ? -12 : -14, 0x8a5a4a);
    P.px(-1, sitt ? -16 : -18, B[2]); P.px(5, sitt ? -16 : -18, B[2]);   // öronen
    for (let i = 0; i < 10; i++) P.px(-5 - Math.round(Math.sin(i * 0.5 + (f ? 0.5 : 0)) * 3), (sitt ? -6 : -8) - i + 4, B[1]);   // svansen
  },
  // 🐧 pingvinen: svart rygg, vit mage, orange näbb och fötter. sim = bara huvud och rygg ovanför vattnet
  pingvin(P, f, st) {
    const B = PAL.pingvin;
    if (st === 'sim') { ell(P, 0, -2, 6, 2, B); P.rect(5, -6, 3, 4, B[2]); P.px(6, -6, B[3]); eye(P, 7, -6); P.rect(8, -5, 3, 1, 0xf0a030); return; }
    const lut = st === 'walk' ? (f ? 1 : -1) : 0;
    P.rect(-3 + lut, -1, 3, 1, 0xf0a030); P.rect(1 + lut, -1, 3, 1, 0xf0a030);
    ell(P, lut * 0.5, -7, 5, 6, B); for (let y = -11; y <= -3; y++) { const w = y > -10 && y < -4 ? 3 : 2; P.rect(Math.round(lut * 0.5) - w + 1, y, w * 2 - 1, 1, PAL.mage); }
    P.rect(-6 + lut, -9 + (f ? 1 : 0), 2, 5, B[1]); P.rect(5 + lut, -9 - (f ? 1 : 0), 2, 5, B[1]);   // vingarna
    P.px(2 + lut, -11, B[2]); eye(P, 2 + lut, -10); P.rect(4 + lut, -9, 3, 1, 0xf0a030); P.px(0 + lut, -10, PAL.mage); P.px(1 + lut, -11, PAL.mage, 0.5);
  },
  // 🦩 flamingon: rosa kropp högt upp, s-böjd hals, ett eller två ben. dipp = huvudet nere i vattnet
  flamingo(P, f, st) {
    const B = PAL.flamingo, dipp = st === 'dipp', ettben = st === 'idle' && !f;
    P.vl(0, -16, 16, B[1]); P.rect(-2, -1, 4, 1, B[1]); if (!ettben) { P.vl(3, -16, 16, B[1]); P.rect(1, -1, 4, 1, B[1]); } else { P.rect(3, -14, 2, 5, B[1]); }
    ell(P, 1, -20, 7, 4, B); P.rect(-7, -22, 3, 2, B[0]); P.px(-8, -21, B[0]);   // kroppen och stjärten
    if (dipp) { for (let i = 0; i < 10; i++) P.px(7 + Math.round(Math.sin(i * 0.5) * 3), -20 + i, B[2]); P.rect(7, -9, 4, 2, B[3]); P.rect(10, -8, 3, 2, K); P.px(13, -8, K); }
    else { for (let i = 0; i < 16; i++) P.px(6 + Math.round(Math.sin(i * 0.3) * 3), -22 - i, B[2]); P.rect(5, -40, 5, 3, B[3]); eye(P, 8, -39); P.rect(10, -39, 3, 2, VIT); P.px(12, -39, K); P.px(13, -38, K); }
  },
  // 🐻 björnen: rund rygg, runda öron, ljus nos. sitt = upprätt på baken; ungen = samma i mindre skala (bjornunge)
  bjorn(P, f, st, s = 1) {
    const B = PAL.bjorn, Z = (v) => Math.round(v * s);
    if (st === 'sitt') {
      ell(P, 0, Z(-10), Z(8), Z(10), B); P.rect(Z(-8), Z(-2), Z(5), Z(3), B[2]); P.rect(Z(3), Z(-2), Z(5), Z(3), B[2]);
      P.rect(Z(-5), Z(-12), Z(2), Z(6), B[1]); P.rect(Z(4), Z(-12), Z(2), Z(6), B[1]);
      ell(P, 0, Z(-22), Z(6), Z(5), B, 0.6); P.px(Z(-5), Z(-26), B[2]); P.px(Z(5), Z(-26), B[2]); P.rect(Z(2), Z(-21), Z(4), Z(3), PAL.nos); P.px(Z(5), Z(-22), K); eye(P, Z(1), Z(-24)); eye(P, Z(-2), Z(-24));
      return;
    }
    leg(P, Z(-9), 0, Z(4), Z(7), B[2], B[1]); leg(P, Z(5), 0, Z(4), Z(7), B[2], B[1]); leg(P, Z(-5) + (f ? 1 : 0), 0, Z(4), Z(8), B[3], B[2]); leg(P, Z(9) - (f ? 1 : 0), 0, Z(4), Z(8), B[3], B[2]);
    ell(P, 0, Z(-12), Z(12), Z(8), B); P.px(Z(-12), Z(-14), B[1]); P.px(Z(-13), Z(-13), B[1]);
    ell(P, Z(11), Z(-14), Z(6), Z(5), B, 0.6); P.px(Z(8), Z(-19), B[2]); P.px(Z(13), Z(-19), B[2]); P.rect(Z(14), Z(-14), Z(4), Z(3), PAL.nos); P.px(Z(17), Z(-15), K); eye(P, Z(12), Z(-16));
    if (st === 'sov') { P.rect(Z(11), Z(-16), 2, 1, K); }
  },
  bjornunge(P, f, st) { ART.bjorn(P, f, st, 0.6); },
  // 🐐 geten: vit eller brun, horn, bockskägg, kort svans uppåt. ata = huvudet nere i gräset
  get(P, f, st, brun = false) {
    const B = brun ? PAL.getbrun : PAL.get, ata = st === 'ata';
    leg(P, -6, 0, 2, 7, B[2], B[1]); leg(P, 4, 0, 2, 7, B[2], B[1]); leg(P, -3 + (f ? 1 : 0), 0, 2, 8, B[3], B[2]); leg(P, 7 - (f ? 1 : 0), 0, 2, 8, B[3], B[2]);
    ell(P, 0, -11, 8, 4, B); P.rect(-8, -14, 2, 3, B[1]);   // svansen upp
    const hx = ata ? 9 : 8, hy = ata ? -6 : -15;
    P.rect(hx - 1, hy - 2, 4, 5, B[2]); P.px(hx + 3, hy, B[1]); P.px(hx + 3, hy + 1, B[1]); eye(P, hx + 1, hy - 1);
    P.px(hx, hy - 3, 0x5a4a3a); P.px(hx, hy - 4, 0x5a4a3a); P.px(hx + 2, hy - 3, 0x5a4a3a); P.px(hx + 3, hy - 4, 0x5a4a3a);   // hornen
    P.px(hx - 2, hy - 1, B[1]); P.px(hx + 1, hy + 3, B[0]); P.px(hx + 2, hy + 3, B[0]);   // öra och bockskägg
    if (!ata) P.rect(hx - 1, hy - 1, 1, 3, B[3]);
  },
  getbrun(P, f, st) { ART.get(P, f, st, true); },
  // 🐴 ponnyn: brun med svart man och svans, röd sadel. Ryttaren ritas av scenen ovanpå sadeln (SADEL)
  ponny(P, f, st) {
    const B = PAL.ponny, M = PAL.man;
    leg(P, -9, 0, 3, 10, B[2], B[1]); leg(P, 6, 0, 3, 10, B[2], B[1]); leg(P, -5 + (f ? 2 : 0), 0, 3, 11, B[3], B[2]); leg(P, 10 - (f ? 2 : 0), 0, 3, 11, B[3], B[2]);
    for (const lx of [-9, -5, 6, 10]) P.hl(lx, -1, 3, 0x2a1a10);
    ell(P, 0, -15, 12, 6, B);
    for (let i = 0; i < 10; i++) P.rect(-12 - Math.round(Math.sin(i * 0.4 + (f ? 0.6 : 0)) * 2), -18 + i, 2, 1, M);   // svansen
    for (let i = 0; i < 9; i++) { P.rect(8 + Math.round(i * 0.5), -20 - i, 3, 1, B[2]); P.px(8 + Math.round(i * 0.5), -20 - i, B[3]); P.px(8 + Math.round(i * 0.5) - 1, -20 - i, M); }   // halsen med man
    ell(P, 14, -29, 5, 3, B, 0.6); P.rect(17, -29, 3, 3, B[1]); P.px(19, -28, 0x2a1a10); eye(P, 14, -30); P.px(12, -32, B[2]); P.px(13, -33, B[2]); P.px(11, -31, M);   // huvudet
    P.rect(-4, -20, 8, 3, 0xc82a2a); P.hl(-4, -20, 8, 0xe85a5a); P.rect(-5, -17, 1, 6, 0x5a3a1e); P.rect(3, -17, 1, 6, 0x5a3a1e); P.px(-5, -11, 0xd8d8d0); P.px(3, -11, 0xd8d8d0);   // sadeln och stigbyglarna
    P.rect(16, -27, 1, 2, 0x5a3a1e); P.px(9, -24, 0x5a3a1e); P.px(12, -26, 0x5a3a1e);   // grimman
  },
  // 🦚 påfågeln: blå kropp, krona, lång grön stjärt – fan = uppslagen solfjäder med ögon
  pafagel(P, f, st) {
    const B = PAL.pafagel, F = PAL.fjader;
    P.vl(-1, -6, 6, 0x6a5a3a); P.vl(2, -6, 6, 0x6a5a3a); P.rect(-2, -1, 3, 1, 0x6a5a3a); P.rect(1, -1, 3, 1, 0x6a5a3a);
    if (st === 'fan') {
      for (let a = 0; a <= 12; a++) { const an = Math.PI * (0.08 + a / 12 * 0.84); for (let r = 4; r < 22; r++) { const x = Math.round(-Math.cos(an) * r), y = -8 - Math.round(Math.sin(an) * r); P.px(x, y, r > 19 ? F[0] : (r + a) % 3 ? F[1] : F[2]); if (r === 17) { P.px(x, y, F[3]); P.px(x, y - 1, B[2]); } } }
    } else { for (let i = 0; i < 18; i++) { const x = -6 - i, y = -6 + Math.round(i * 0.2); P.rect(x, y, 1, 3, i % 4 === 0 ? F[0] : i % 4 === 2 ? F[2] : F[1]); if (i % 5 === 3) P.px(x, y + 1, F[3]); } }
    ell(P, 0, -10, 5, 4, B);
    for (let i = 0; i < 8; i++) P.px(4 + Math.round(Math.sin(i * 0.4) * 1), -12 - i, B[2]);   // halsen
    ell(P, 5, -21, 3, 2, B, 0.6); eye(P, 6, -22); P.rect(8, -21, 3, 1, 0xd8d8d0); P.px(5, -24, B[3]); P.px(4, -25, F[3]); P.px(6, -25, F[3]); P.px(5, -26, F[3]);   // huvudet och kronan
    P.px(-2, -9 + (f ? 1 : 0), B[3]); P.px(1, -8, B[4], 0.6);
  },
  // 🦆 ankan på dammen: gul/brun, simmar – dyk = stjärten upp
  anka(P, f, st) {
    const B = PAL.anka;
    if (st === 'dyk') { ell(P, 0, -3, 4, 2, B); P.rect(1, -7, 2, 4, B[2]); P.px(1, -8, B[3]); P.px(-1, -5, 0xf0a030); return; }
    ell(P, 0, -3, 5, 2, B); P.rect(3, -7, 3, 4, B[3]); P.px(4, -8, B[3]); eye(P, 5, -7); P.rect(6, -6, 2, 1, 0xf0a030); P.px(-4, -5, B[1]); P.px(-5, -6 + (f ? 1 : 0), B[1]);
  },
};
export const ARTER = Object.keys(ART);

// ritar djuret: (x, y) = fötternas mitt. Spegling vid dir 'left'. natt = mörkare
export function ritaDjur(ctx, art, x, y, { st = 'idle', f = 0, dir = 'right', natt = false, skugga = true } = {}) {
  const fn = ART[art]; if (!fn) return;
  const key = `${art}|${f}|${st}`;
  const img = bild(key, (P) => fn(P, f, st));
  const X = Math.round(x), Y = Math.round(y);
  if (skugga && st !== 'sim' && st !== 'dyk' && st !== 'hang') { const w = art === 'elefant' ? 44 : art === 'giraff' || art === 'lejon' || art === 'ponny' || art === 'bjorn' ? 28 : 12; ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(X - (w >> 1), Y - 1, w, 3); }
  ctx.save();
  if (dir === 'left') { ctx.translate(X, Y); ctx.scale(-1, 1); ctx.drawImage(img, -36, -64); }
  else ctx.drawImage(img, X - 36, Y - 64);
  if (natt) { ctx.globalCompositeOperation = 'source-atop'; }
  ctx.restore();
}
// var sadeln sitter på ponnyn (relativt fötterna) – ryttaren ritas där av scenen
export const SADEL = { dx: 0, dy: -22 };

// ------------------------------------------------------------------ skyltarnas texter (scenen visar dem vid skylten)
export const DJURFAKTA = {
  klapp: { namn: $t('KLAPPZOO'), rad: $t('Getterna Majsan, Bosse och Lilla My älskar att bli kliade bakom hornen. Kaninerna är blygare – gå lugnt.') },
  apor: { namn: $t('APORNA'), rad: $t('Kapucinaporna sover i en hög varje natt. Den äldsta heter Farbror Bo och är 31 år.') },
  lejon: { namn: $t('LEJONEN'), rad: $t('Lejonen Simba och Nala sover 20 timmar om dygnet. Rytet hörs ända till Gamla stan.') },
  elefant: { namn: $t('ELEFANTERNA'), rad: $t('Elefanterna Dumbo och Elsa dricker 150 liter vatten om dagen – och sprutar hälften på varandra.') },
  giraff: { namn: $t('GIRAFFERNA'), rad: $t('Girafferna Greta och Gösta är nästan fem meter höga och har blå tunga. På riktigt!') },
  bjorn: { namn: $t('BJÖRNEN'), rad: $t('Brunbjörnen Bamse och ungen Nalle sover hela vintern i grottan. På våren äter de blåbär – många.') },
  pingvin: { namn: $t('PINGVINERNA'), rad: $t('Pingvinerna kan inte flyga – men de simmar snabbare än du kan springa.') },
  flamingo: { namn: $t('FLAMINGORNA'), rad: $t('Flamingorna är rosa av maten de äter. Står de på ett ben vilar de – precis som du på bussen.') },
  ponny: { namn: $t('PONNYRIDNINGEN'), rad: $t('Ponnyn Pricken går runt, runt och har gjort det i nio år. Han får morötter efter varje varv.') },
  damm: { namn: $t('ANKDAMMEN'), rad: $t('Gräsänderna på dammen är vilda och kommer och går som de vill. Mata dem inte med bröd – de mår bäst av ärtor.') },
};
