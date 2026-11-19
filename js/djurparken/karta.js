// 🦁 DJURPARKEN – kartan och marken (Carl 2026-11-18: stadsdelstabellen – "Djurparken: inhägnader, djurskötarjobb
// med matning, ponnyridning, souvenirkiosk, entré"). En egen plats som Pixelberg och Gamla stan: djurbussen går
// hit från vilken hållplats som helst i stan (city.js) och tillbaka från hållplatsen utanför grinden.
//
// Väster om parkstaketet (x < ENTRE.X): hållplatsen, biljettkassan och grinden under valvet DJURPARKEN. Innanför
// går HUVUDGÅNGEN (grus, y 236–332) genom hela parken. Norr om gången inhägnaderna: KLAPPZOO (getter och kaniner,
// man får gå in), APORNA (klätterställning), LEJONEN (savann bakom stenmur), ELEFANTERNA (lerpöl), GIRAFFERNA (höga
// akacior) och BJÖRNEN (skog med grotta), längst i öster personalhuset. Söder om gången: PINGVINERNA (is och bassäng),
// FLAMINGORNA (rosa damm), PONNYRIDNINGEN (ring med grind), PICKNICKÄNGEN med glasskiosken, SOUVENIRKIOSKEN och
// ANKDAMMEN med bron. Bakom parken skogen och kullarna (parallax). Påfågeln går fritt på gräset vid entrén.
//
// Scenen (js/scenes/djurparken.js) ritar: himlen + kullarna (parallax) → marken (paintGround, en gång: gräs, gång,
// inhägnadernas golv, bakre staket/murar) → staketens framsidor, kiosker, träd, djur, folk y-sorterade (deko.js,
// djur.js) → kvällens mörker och lyktornas sken.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 2000, TH = 520;
export const G = { GANG: [236, 332], TOP: 40, BOTTOM: 512 };
export const ENTRE = { X: 140, GRIND: [250, 322], PRIS: 20, OPPET: [9, 18] };   // staketet längs x = 140, grinden y 250–322, entré 20 kr, öppet 9–18
export const HALLPLATS = { x: 54, y: 352 };
export const KASSA = { x: 84, y: 236 };          // biljettkassan (foten, mitten) – står strax norr om grinden utanför
export const PARKSKYLT = { x: 60, y: 300 };      // skylten DJURPARKEN med öppettider vid hållplatsen
// inhägnaderna: r = [x0, y0, x1, y1], golv styr markmålningen, staket framsidans/bakre stil, grind = öppning i
// framsidan (x-intervall), skylt = informationsskylten på gångsidan. norr = ligger norr om gången (framsidan = y1)
export const HAGN = {
  klapp: { id: 'klapp', r: [180, 80, 436, 222], golv: 'hage', staket: 'tra', grind: [290, 312], skylt: [250, 232], norr: true },
  apor: { id: 'apor', r: [466, 70, 706, 222], golv: 'djungel', staket: 'nat', skylt: [586, 232], norr: true },
  lejon: { id: 'lejon', r: [736, 70, 1016, 222], golv: 'savann', staket: 'mur', skylt: [876, 232], norr: true },
  elefant: { id: 'elefant', r: [1046, 70, 1366, 222], golv: 'lera', staket: 'mur', skylt: [1206, 232], norr: true },
  giraff: { id: 'giraff', r: [1396, 70, 1656, 222], golv: 'savann', staket: 'hog', skylt: [1526, 232], norr: true },
  bjorn: { id: 'bjorn', r: [1686, 70, 1926, 222], golv: 'skog', staket: 'mur', skylt: [1806, 232], norr: true },
  pingvin: { id: 'pingvin', r: [206, 346, 466, 500], golv: 'is', staket: 'rack', skylt: [336, 340], norr: false },
  flamingo: { id: 'flamingo', r: [506, 346, 766, 500], golv: 'damm', staket: 'rack', skylt: [636, 340], norr: false },
  ponny: { id: 'ponny', r: [806, 346, 1106, 500], golv: 'sand', staket: 'tra', grind: [944, 968], skylt: [900, 340], norr: false },
  damm: { id: 'damm', r: [1566, 346, 1966, 500], golv: 'sjo', staket: 'hack', skylt: [1766, 340], norr: false },
};
export const HAGNLISTA = Object.keys(HAGN);
export const PICKNICK = { r: [1146, 346, 1406, 500], bord: [[1200, 420], [1310, 460], [1370, 400]] };
export const GLASSKIOSK = { x: 1240, y: 386 };   // glasskiosken (foten, mitten) i picknickängens norra kant
export const SOUVENIR = { x: 1486, y: 392 };     // souvenirkiosken mellan ängen och dammen
export const PERSONALHUS = { x: 1964, y: 222, w: 44 };   // djurskötarnas hus längst i öster (dörren mot gången)
export const FODER = { x: 204, y: 208 };          // getfoderautomaten inne i klappzoo
export const LADA = { x: 214, y: 120 };           // lilla ladan längst bak i klappzoo (foten, mitten)
export const KLATTER = { x: 586, y: 150 };        // apornas klätterställning (foten, mitten)
export const GROTTA = { x: 1800, y: 120 };        // björnens grotta längst bak
export const AKACIOR = [[1446, 152], [1612, 142]];   // giraffernas akacior (fötterna – kronorna når upp till hagens bakre del)
export const LEJONKLIPPA = { x: 900, y: 130 };
export const LERPOL = { x: 1150, y: 170, rx: 50, ry: 16 };
export const BASSANG = { x: 376, y: 440, rx: 70, ry: 30 };      // pingvinernas vatten
export const RING = { x: 956, y: 428, rx: 120, ry: 48 };        // ponnyns bana
export const BRO = { x: 1766, y: 420 };                          // bron över ankdammen
export const BANKAR = [[452, 232], [1030, 232], [1380, 232], [1950, 338], [486, 340], [786, 340], [1126, 340], [1426, 340]];
export const PAPPERSKORGAR = [[470, 340], [1120, 340], [1700, 340], [1546, 232], [722, 232]];
export const LYKTOR = [220, 480, 740, 1000, 1260, 1520, 1780].map((x) => ({ x, y: 338 }));
export const TRAD = [
  ...[60, 160, 300, 440, 580, 720, 860, 1000, 1140, 1280, 1420, 1560, 1700, 1840, 1980].map((x, i) => ({ x, y: 56 + (i % 3) * 4, kind: ['gran', 'ek', 'bjork', 'lonn', 'gran'][i % 5] })),   // skogsbrynet längst bak
  { x: 1170, y: 470, kind: 'ek' }, { x: 1395, y: 490, kind: 'bjork' }, { x: 1520, y: 470, kind: 'lonn' }, { x: 110, y: 470, kind: 'bjork' }, { x: 170, y: 480, kind: 'ek' },
];
export const PAFAGELPLATS = { x0: 160, x1: 200, y0: 352, y1: 440 };   // påfågelns gräsmatta söder om grinden

// gånghinder (fotavtryck). betalt = grinden öppen (annars står staketet hela vägen)
export function hinder(betalt) {
  const o = [];
  o.push([0, 0, TW, 66]);                                                      // skogsbrynet bakom hagarna
  o.push([ENTRE.X - 3, 0, ENTRE.X + 3, ENTRE.GRIND[0]], [ENTRE.X - 3, ENTRE.GRIND[1], ENTRE.X + 3, TH]);   // parkstaketet
  if (!betalt) o.push([ENTRE.X - 3, ENTRE.GRIND[0] - 2, ENTRE.X + 3, ENTRE.GRIND[1] + 2]);
  for (const id of HAGNLISTA) {
    const H = HAGN[id], [x0, y0, x1, y1] = H.r;
    if (id === 'klapp' || id === 'ponny') {   // man får gå in genom grinden – bara staketet är hinder
      const gy = H.norr ? y1 : y0, [gx0, gx1] = H.grind;
      o.push([x0 - 2, y0 - 2, x0 + 2, y1 + 2], [x1 - 2, y0 - 2, x1 + 2, y1 + 2]);
      o.push([x0, (H.norr ? y0 : y1) - 2, x1, (H.norr ? y0 : y1) + 2]);
      o.push([x0, gy - 2, gx0, gy + 2], [gx1, gy - 2, x1, gy + 2]);
      continue;
    }
    o.push([x0 - 2, y0 - 2, x1 + 2, y1 + 2]);
  }
  o.push([KASSA.x - 16, KASSA.y - 20, KASSA.x + 16, KASSA.y + 2]);
  o.push([GLASSKIOSK.x - 22, GLASSKIOSK.y - 16, GLASSKIOSK.x + 22, GLASSKIOSK.y + 2], [SOUVENIR.x - 22, SOUVENIR.y - 16, SOUVENIR.x + 22, SOUVENIR.y + 2]);
  o.push([PERSONALHUS.x - PERSONALHUS.w / 2, PERSONALHUS.y - 40, PERSONALHUS.x + PERSONALHUS.w / 2, PERSONALHUS.y - 2]);
  o.push([FODER.x - 5, FODER.y - 4, FODER.x + 5, FODER.y + 1], [LADA.x - 30, LADA.y - 30, LADA.x + 30, LADA.y + 1]);
  for (const [x, y] of PICKNICK.bord) o.push([x - 18, y - 8, x + 18, y + 2]);
  for (const [x, y] of BANKAR) o.push([x - 15, y - 4, x + 16, y + 1]);
  for (const [x, y] of PAPPERSKORGAR) o.push([x - 4, y - 4, x + 4, y + 1]);
  for (const l of LYKTOR) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const t of TRAD) o.push([t.x - 4, t.y - 3, t.x + 5, t.y + 2]);
  o.push([PARKSKYLT.x - 14, PARKSKYLT.y - 4, PARKSKYLT.x + 14, PARKSKYLT.y + 1]);
  return o;
}

// ---------------------------------------------------------------- kullarna och skogen bakom parken (parallax)
const BACK = new Map();
export function kullCanvas(night) {
  if (BACK.has(night)) return BACK.get(night);
  const w = 1000, h = 90, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.4), 0x101634, 0.35) : c);
  // två rader kullar (fjärran blågrön, nära grön) och en skogsrand med granar och lövträd
  for (let x = 0; x < w; x++) {
    const h1 = 44 + Math.round(Math.sin(x / 90) * 10 + Math.sin(x / 37 + 1) * 5), h2 = 24 + Math.round(Math.sin(x / 60 + 2) * 8 + Math.sin(x / 23) * 3);
    for (let y = h - h1; y < h; y++) P.px(x, y, N(mix(0x5a8a7a, 0x3e6e5e, (y - (h - h1)) / h1)));
    for (let y = h - h2; y < h; y++) P.px(x, y, N(mix(0x4a8a3a, 0x2e6a2a, (y - (h - h2)) / h2 + (hash(x >> 2, y >> 1, 5) - 0.5) * 0.2)));
  }
  for (let k = 0; k < 70; k++) {
    const x = (hash(k, 1, 9) * w) | 0, gran = hash(k, 2, 9) > 0.45, th = 10 + ((hash(k, 3, 9) * 10) | 0), yb = h - 2 - ((hash(k, 4, 9) * 14) | 0);
    if (gran) { for (let j = 0; j < th; j++) { const half = Math.round(j * 0.3) + (j % 4 === 3 ? 1 : 0); for (let i = -half; i <= half; i++) P.px(x + i, yb - th + j, N(i < 0 ? 0x2a6a2a : 0x1e4e22)); } P.vl(x, yb - 2, 3, N(0x4a3020)); }
    else { for (let j = -5; j <= 5; j++) for (let i = -6; i <= 6; i++) if (i * i / 36 + j * j / 25 <= 1) P.px(x + i, yb - 9 + j, N(i < 0 && j < 0 ? 0x5aa848 : 0x3a8a34)); P.vl(x, yb - 4, 5, N(0x5a3a20)); }
  }
  const cv = P.flush(); BACK.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
const vnoise = (x, y, s, cell) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
const GRASS = [0x3e8a32, 0x4a9a3a, 0x58a842, 0x6ab84a];
const SAVANN = [0xb89a48, 0xc8ac58, 0xd8bc68, 0xe4cc80];
const grass = (P, x, y, s = 3) => P.px(x, y, GRASS[Math.min(3, Math.max(0, Math.round(1.5 + (hash(x >> 1, y >> 1, s) - 0.5) * 2 + (vnoise(x, y, s + 1, 50) - 0.5) * 2 + (bayer(x, y) - 0.5))))]);
const inEll = (x, y, e) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1;
function water(P, x, y, e, deep = 0x2a6ab8, shallow = 0x6ab4e0, s = 7) {
  const d = ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2;
  let c = mix(shallow, deep, Math.min(1, d * 0.3 + 0.5) + (vnoise(x, y, s, 12) - 0.5) * 0.3);
  if (hash(x >> 2, y, s + 1) > 0.93 && (x + y) % 4 === 0) c = mix(c, 0xffffff, 0.35);
  if (d > 0.9) c = mix(c, 0xd8c89a, 0.5);
  P.px(x, y, c);
}
export function paintGround() {
  const P = new Pix(TW, TH);
  // gräset överallt (ovanför TOP lämnas genomskinligt – där syns kullarna)
  for (let y = G.TOP - 8; y < TH; y++) for (let x = 0; x < TW; x++) grass(P, x, y);
  for (let k = 0; k < 400; k++) { const x = (hash(k, 1, 21) * TW) | 0, y = G.TOP + ((hash(k, 2, 21) * (TH - G.TOP)) | 0); if (hash(k, 3, 21) > 0.4) P.px(x, y, [0xf8f0a0, 0xffffff, 0xf4a8c8, 0xf0c030][k % 4]); }
  // entrétorget utanför staketet: stenplattor
  for (let y = G.TOP; y < TH; y++) for (let x = 0; x < ENTRE.X; x++) { if (y < 200 || y > 420) continue; const e = (x % 12 === 11) || (y % 8 === 7); P.px(x, y, e ? 0x8a847a : mix(0xb8b2a6, 0xa8a296, hash(x >> 2, y >> 3, 22) * 0.6)); }
  // huvudgången: grus med kantsten, slitet mitt på; förgreningar till grinden, kioskerna och hagarnas skyltar
  const grus = (x, y, k = 1) => { let c = mix(0xc8b890, 0xb8a47c, hash(x, y, 23) * 0.6 + (vnoise(x, y, 24, 30) - 0.5) * 0.4); if (hash(x >> 1, y >> 1, 25) > 0.92) c = mix(c, 0x8a8070, 0.5); P.px(x, y, k < 1 ? mix(P.get(x, y), c, k) : c); };
  for (let y = G.GANG[0]; y < G.GANG[1]; y++) for (let x = ENTRE.X - 60; x < TW; x++) grus(x, y);
  for (let x = ENTRE.X - 60; x < TW; x++) { P.px(x, G.GANG[0] - 1, 0x8a8478); P.px(x, G.GANG[0] - 2, 0xa8a296); P.px(x, G.GANG[1], 0x8a8478); P.px(x, G.GANG[1] + 1, 0x6e685e); }
  for (const [x0, x1, y0, y1] of [[GLASSKIOSK.x - 14, GLASSKIOSK.x + 14, G.GANG[1], GLASSKIOSK.y + 2], [SOUVENIR.x - 14, SOUVENIR.x + 14, G.GANG[1], SOUVENIR.y + 2], [HAGN.ponny.grind[0] - 6, HAGN.ponny.grind[1] + 6, G.GANG[1], HAGN.ponny.r[1]], [HAGN.klapp.grind[0] - 6, HAGN.klapp.grind[1] + 6, HAGN.klapp.r[3], G.GANG[0]], [PERSONALHUS.x - 8, PERSONALHUS.x + 8, PERSONALHUS.y - 2, G.GANG[0]], [BRO.x - 60, BRO.x + 60, G.GANG[1], HAGN.damm.r[1]]])
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grus(x, y);
  for (let y = G.TOP; y < TH; y++) for (let x = 0; x < TW; x++) if (y > 436 && y < 470 && x > 1146 && x < 1406 && vnoise(x, y, 26, 24) > 0.6) grus(x, y, 0.5);   // slitna fläckar på picknickängen
  // inhägnadernas golv
  for (const id of HAGNLISTA) {
    const H = HAGN[id], [x0, y0, x1, y1] = H.r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const n = vnoise(x, y, 31, 28);
      if (H.golv === 'hage') { const c = n > 0.55 ? mix(0x9a7a4a, 0xb08a52, hash(x, y, 32)) : null; if (c) P.px(x, y, c); if (hash(x >> 2, y >> 1, 33) > 0.9 && n > 0.5) P.px(x, y, 0xe8c860); }
      else if (H.golv === 'djungel') { P.px(x, y, n > 0.5 ? mix(0x6a4a2a, 0x8a6236, hash(x, y, 34)) : mix(0x2e6a26, 0x3e8a34, hash(x >> 1, y >> 1, 35))); if (hash(x, y, 36) > 0.96) P.px(x, y, 0x1e4a1a); }
      else if (H.golv === 'savann') { P.px(x, y, SAVANN[Math.min(3, Math.max(0, Math.round(1.5 + (hash(x >> 1, y >> 1, 37) - 0.5) * 2 + (n - 0.5) * 2)))]); if (n < 0.3) P.px(x, y, mix(0xa88a50, 0x8a6a3a, hash(x, y, 38))); if (hash(x, y >> 1, 39) > 0.9 && n > 0.6) P.px(x, y, 0x8a7a3a); }
      else if (H.golv === 'lera') { P.px(x, y, n > 0.45 ? mix(0x7a5a34, 0x9a7244, hash(x, y, 40)) : mix(0x5a8a3a, 0x6a9a44, hash(x >> 1, y, 41))); if (inEll(x, y, LERPOL)) water(P, x, y, LERPOL, 0x4a3420, 0x7a5a38, 42); }
      else if (H.golv === 'skog') { P.px(x, y, n > 0.5 ? mix(0x3a2a18, 0x5a4228, hash(x, y, 43)) : mix(0x1e4a1e, 0x2e6a2a, hash(x >> 1, y >> 1, 44))); if (hash(x, y, 45) > 0.95) P.px(x, y, 0x8a6a30); }
      else if (H.golv === 'is') { P.px(x, y, mix(0xe8f4f8, 0xc0dcec, hash(x >> 2, y >> 2, 46) * 0.7 + (n - 0.5) * 0.4)); if ((x + y * 3) % 23 === 0) P.px(x, y, 0xa0c8e0); if (inEll(x, y, BASSANG)) water(P, x, y, BASSANG, 0x1e5aa8, 0x5aa8e0, 47); }
      else if (H.golv === 'damm') { const E = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 6, rx: (x1 - x0) / 2 - 12, ry: (y1 - y0) / 2 - 14 }; if (inEll(x, y, E)) water(P, x, y, E, 0x4a8ab8, 0x9ad0e0, 48); else if (n > 0.6) P.px(x, y, mix(0xc8b878, 0xd8c888, hash(x, y, 49))); }
      else if (H.golv === 'sand') { const d = ((x - RING.x) / RING.rx) ** 2 + ((y - RING.y) / RING.ry) ** 2; P.px(P.get(x, y) === undefined ? x : x, y, mix(0xd8c090, 0xc8ac78, hash(x, y, 50) * 0.5)); if (d > 0.68 && d < 1.02) P.px(x, y, mix(0xb89a68, 0xa88a58, hash(x >> 1, y, 51))); if (d < 0.6 && n > 0.5) grass(P, x, y, 52); }
      else if (H.golv === 'sjo') { const E = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 4, rx: (x1 - x0) / 2 - 8, ry: (y1 - y0) / 2 - 10 }; if (inEll(x, y, E)) { water(P, x, y, E, 0x2a5a98, 0x5a9ad0, 53); if (hash(x >> 3, y >> 2, 54) > 0.86 && ((x >> 3) + (y >> 2)) % 3 === 0 && (x % 8) < 5 && (y % 4) < 3) P.px(x, y, (x % 8) === 2 && (y % 4) === 1 ? 0xf06aa0 : 0x3e8a3a); } else if (n > 0.55) P.px(x, y, mix(0xc8b878, 0xa89a58, hash(x, y, 55))); }
    }
    // det bakre staketet och sidorna (framsidan ritas av scenen, y-sorterad – deko.js)
    const bak = H.norr ? y0 : y1, fram = H.norr ? y1 : y0;
    for (let x = x0; x <= x1; x++) { if (H.staket === 'mur') { for (let j = 0; j < 6; j++) P.px(x, bak - 4 + j, j === 0 ? 0xb4aea4 : (x + j) % 7 === 0 ? 0x5a544c : mix(0x8a847a, 0x76716a, hash(x >> 2, j, 56))); } else if (H.staket === 'hack') { for (let j = 0; j < 7; j++) P.px(x, bak - 5 + j, mix(0x2e6a26, 0x4a9a3a, hash(x >> 1, j, 57))); } else { if (x % 16 === 0) { P.rect(x, bak - 10, 2, 11, 0x6e4a28); P.px(x, bak - 11, 0x8a6236); } P.px(x, bak - 7, 0x8a6236); P.px(x, bak - 3, 0x8a6236); if (H.staket === 'nat' || H.staket === 'hog') { P.px(x, bak - 14, 0x8a6236); if (x % 16 === 0) P.rect(x, bak - 22, 2, 12, 0x6e4a28); if (H.staket === 'nat' && (x + 1) % 3 === 0) for (let j = -21; j < -3; j += 3) P.px(x, bak + j, 0x9a9a94, 0.5); } } }
    for (const sx of [x0, x1]) for (let y = Math.min(bak, fram); y <= Math.max(bak, fram); y++) { if (H.staket === 'mur') { P.px(sx, y, (y % 5) ? 0x8a847a : 0x5a544c); P.px(sx + (sx === x0 ? 1 : -1), y, 0x76716a); } else if (H.staket === 'hack') { P.px(sx, y, 0x3e8a34); P.px(sx + (sx === x0 ? 1 : -1), y, 0x2e6a26); } else { P.px(sx, y, 0x8a6236); if (y % 14 === 0) { P.rect(sx - 1, y - 6, 2, 7, 0x6e4a28); } } }
  }
  // ankdammens bro: plankor tvärs över dammen
  for (let y = HAGN.damm.r[1] + 6; y < HAGN.damm.r[3] - 6; y++) for (let x = BRO.x - 9; x <= BRO.x + 9; x++) P.px(x, y, (y % 4 === 3) ? 0x5e3a20 : mix(0xa87848, 0x8a5e34, hash(x >> 1, y >> 2, 58)));
  for (let y = HAGN.damm.r[1] + 6; y < HAGN.damm.r[3] - 6; y += 2) { P.px(BRO.x - 10, y, 0x6e4a28); P.px(BRO.x + 10, y, 0x6e4a28); }
  // påfågelns gräsmatta har en liten rabatt, och framför kassan en stenlagd väntyta
  for (const [rx, ry] of [[180, 440], [1180, 480]]) for (let y = ry - 4; y <= ry + 4; y++) for (let x = rx - 11; x <= rx + 11; x++) { const d = Math.hypot((x - rx) / 11.5, (y - ry) / 4.5); if (d > 1) continue; P.px(x, y, d > 0.82 ? 0x6e685e : (x + y) % 3 ? 0x4a3020 : [0xd82838, 0xf06aa0, 0xffffff, 0xf0c030][(x >> 1) % 4]); }
  // parkstaketet (smidesräcke på låg mur) längs x = ENTRE.X, med öppningen vid grinden
  for (let y = G.TOP; y < TH; y++) { if (y > ENTRE.GRIND[0] && y < ENTRE.GRIND[1]) continue; P.px(ENTRE.X - 1, y, 0x5a544c); P.px(ENTRE.X, y, 0x8a847a); P.px(ENTRE.X + 1, y, 0x76716a); if (y % 3 === 0) P.px(ENTRE.X, y, 0x1c2026); }
  return P.flush();
}
export const OPPETTEXT = () => $t`Öppet ${ENTRE.OPPET[0]}–${ENTRE.OPPET[1]}, entré ${ENTRE.PRIS} kr`;
