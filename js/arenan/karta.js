// 🏟️ ARENAN – kartan och marken (Carl 2026-11-18: stadsdelstabellen – "Arenan: matchdag-minispel, simhall, sportaffär,
// skridskobana"). En egen plats som Djurparken och Fiskehamnen: arenabussen går hit från stadens hållplatser (city.js)
// och tillbaka från hållplatsen på Arenatorget.
//
// Norr om torget: SPORTAFFÄREN, PIXEL ARENA (den stora läktaren med valvbågar, torn, storbildsskärmen och KBK-flaggorna)
// med biljettluckan och statyn av KBK-legendaren framför, SIMHALLEN med glasfasaden och vågen på taket, och FIKAT.
// Söder om torget: SKRIDSKOBANAN (is med sarg, entrégrind, strålkastare, chokladkiosken) och KBK-PLANEN (konstgräs i
// bur med ett mål – skjut straffar!). Flaggstänger, bänkar, lyktor, en varmkorvsgubbe och supportrar i vinrött och
// svart. Bakom husen stadens tak och arenans läktartak (parallax).
//
// Scenen (js/scenes/arenan.js) ritar: himlen + takåsarna → marken (paintGround, en gång) → husen, rekvisitan,
// folket, skridskoåkarna och spelaren y-sorterade (deko.js) → kvällens mörker och strålkastarnas sken.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 1800, TH = 500;
export const G = { BASE: 196, TORG: [200, 332], TOP: 200, BOTTOM: 492 };
export const HALLPLATS = { x: 60, y: 300 };
export const KBK = { rod: 0x7a1a2a, rodL: 0xa8303e, svart: 0x1a1414, vit: 0xf4f1ea };   // KBK:s färger: vinrött och svart
export const HUS = {
  sport: { id: 'sport', namn: $t('SPORTAFFÄREN'), x: 40, w: 220, h: 100, door: { x0: 136, x1: 164 }, typ: 'sport' },
  arena: { id: 'arena', namn: $t('PIXEL ARENA'), x: 320, w: 760, h: 150, door: { x0: 676, x1: 724 }, typ: 'arena' },
  simhall: { id: 'simhall', namn: $t('SIMHALLEN'), x: 1140, w: 300, h: 110, door: { x0: 1272, x1: 1308 }, typ: 'simhall' },
};
export const HUSLISTA = Object.keys(HUS);
export const BILJETT = { x: 560, y: 246 };                  // biljettluckan framför arenan (foten, mitten)
export const STATY = { x: 760, y: 282 };                    // statyn av KBK-legendaren
export const FIKAT = { x: 1560, y: 250 };                   // fikakiosken öster om simhallen
export const KORV = { x: 980, y: 300 };                     // varmkorvsgubben med vagnen
export const FLAGGOR = [[460, 330], [1000, 330]];           // flaggstängerna vid torgets södra kant
export const RINK = { x0: 300, y0: 350, x1: 820, y1: 490, grind: [548, 572] };   // skridskobanan (isen innanför sargen), grinden i norra sargen
export const RINK_LJUS = [[310, 346], [810, 346], [310, 494], [810, 494]];       // strålkastarmasterna i hörnen
export const CHOKLAD = { x: 230, y: 420 };                  // chokladkiosken vid banan
export const PLAN = { x0: 1000, y0: 350, x1: 1400, y1: 490, grind: [1040, 1064], mal: { x: 1388, y: 420 } };   // KBK-planen (bur), målet i östra änden
export const STRAFF = { x: 1300, y: 420 };                  // straffpunkten
export const BANKAR = [[120, 300], [380, 234], [1120, 234], [1480, 300], [900, 480], [1700, 460]];
export const LYKTOR = [200, 640, 1200, 1680].map((x) => ({ x, y: 338 }));
export const PAPPERSKORGAR = [[360, 236], [1460, 234], [860, 340], [1420, 340]];
export const TRAD = [[1600, 480], [1740, 400], [160, 480], [1520, 364]].map(([x, y], i) => ({ x, y, kind: ['lonn', 'bjork', 'ek', 'lonn'][i] }));
export const SKYLT = { x: 110, y: 240 };
export const SKRIDSKO_PRIS = 300, HYRA_PRIS = 25, HALSDUK_PRIS = 60;

// gånghinder på torget (foten). pa = 'is' när man åker skridskor (bara banan), 'plan' på KBK-planen
export function hinder(pa = 'torg') {
  const o = [];
  if (pa === 'is') { o.push([0, 0, TW, RINK.y0 + 4], [0, RINK.y1 - 4, TW, TH], [0, 0, RINK.x0 + 6, TH], [RINK.x1 - 6, 0, TW, TH]); for (const [cx, cy] of [[RINK.x0, RINK.y0], [RINK.x1, RINK.y0], [RINK.x0, RINK.y1], [RINK.x1, RINK.y1]]) o.push([cx - 14, cy - 10, cx + 14, cy + 10]); return o; }
  if (pa === 'plan') { o.push([0, 0, TW, PLAN.y0 + 4], [0, PLAN.y1 - 4, TW, TH], [0, 0, PLAN.x0 + 4, TH], [PLAN.x1 - 4, 0, TW, TH], [PLAN.mal.x - 6, PLAN.mal.y - 22, PLAN.mal.x + 6, PLAN.mal.y + 22]); return o; }
  for (const id of HUSLISTA) { const h = HUS[id]; o.push([h.x, G.BASE - 34, h.door.x0 - 1, G.BASE - 2], [h.door.x1 + 1, G.BASE - 34, h.x + h.w, G.BASE - 2]); }
  o.push([0, 0, TW, G.BASE - 6]);
  // banan och planen: sargen/buren är hinder, men grindarna öppna (man kliver in genom grinden – scenen byter hinder)
  o.push([RINK.x0 - 4, RINK.y0 - 6, RINK.grind[0], RINK.y0 + 2], [RINK.grind[1], RINK.y0 - 6, RINK.x1 + 4, RINK.y0 + 2], [RINK.x0 - 4, RINK.y0, RINK.x0 + 2, TH], [RINK.x1 - 2, RINK.y0, RINK.x1 + 4, TH], [RINK.x0, RINK.y1 - 2, RINK.x1, TH]);
  o.push([RINK.grind[0], RINK.y0 + 2, RINK.grind[1], TH]);   // innanför grinden står man inte utan skridskor
  o.push([PLAN.x0 - 4, PLAN.y0 - 6, PLAN.grind[0], PLAN.y0 + 2], [PLAN.grind[1], PLAN.y0 - 6, PLAN.x1 + 4, PLAN.y0 + 2], [PLAN.x0 - 4, PLAN.y0, PLAN.x0 + 2, TH], [PLAN.x1 - 2, PLAN.y0, PLAN.x1 + 4, TH], [PLAN.x0, PLAN.y1 - 2, PLAN.x1, TH]);
  o.push([PLAN.grind[0], PLAN.y0 + 2, PLAN.grind[1], TH]);
  for (const [x, y] of RINK_LJUS) o.push([x - 3, y - 3, x + 3, y + 1]);
  o.push([BILJETT.x - 16, BILJETT.y - 20, BILJETT.x + 16, BILJETT.y + 2], [STATY.x - 14, STATY.y - 8, STATY.x + 14, STATY.y + 2]);
  o.push([FIKAT.x - 22, FIKAT.y - 16, FIKAT.x + 22, FIKAT.y + 2], [KORV.x - 12, KORV.y - 8, KORV.x + 12, KORV.y + 2], [CHOKLAD.x - 22, CHOKLAD.y - 16, CHOKLAD.x + 22, CHOKLAD.y + 2]);
  for (const [x, y] of FLAGGOR) o.push([x - 3, y - 3, x + 3, y + 1]);
  for (const [x, y] of BANKAR) o.push([x - 15, y - 4, x + 16, y + 1]);
  for (const [x, y] of PAPPERSKORGAR) o.push([x - 4, y - 4, x + 4, y + 1]);
  for (const l of LYKTOR) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const t of TRAD) o.push([t.x - 4, t.y - 3, t.x + 5, t.y + 2]);
  o.push([SKYLT.x - 8, SKYLT.y - 3, SKYLT.x + 8, SKYLT.y + 1]);
  return o;
}

// ---------------------------------------------------------------- takåsarna och arenans läktartak (parallax)
const BACK = new Map();
export function takCanvas(night) {
  if (BACK.has(night)) return BACK.get(night);
  const w = 1200, h = 120, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.4), 0x101634, 0.35) : c);
  for (let x = 0; x < w; x++) { const hus = Math.floor(x / 13), hh = 12 + Math.floor(hash(hus, 1, 91) * 26) + (hash(hus, 2, 91) > 0.9 ? 16 : 0); for (let y = h - 60 - hh; y < h - 60; y++) P.px(x, y, N(x % 13 === 0 ? 0x6a7890 : mix(0x8a98b0, 0x7a88a0, (h - 60 - y) / 40))); if (x % 4 === 1 && hash(x, 3, 91) > 0.6) P.px(x, h - 62 - Math.floor(hash(x, 4, 91) * (hh - 4)), N(night ? 0xf0d080 : 0xa8b8d0)); }
  // arenans läktartak: en stor båge i vitt med röda ribbor och fyra ljusmaster
  for (let x = 300; x < 900; x++) { const u = (x - 300) / 600, top = h - 60 - Math.round(Math.sin(u * Math.PI) * 50); for (let y = top; y < h - 58; y++) P.px(x, y, N(y === top ? 0xffffff : (x % 24 < 2 ? 0x7a1a2a : mix(0xe8ecf0, 0xc8ccd4, (y - top) / 50)))); }
  for (const mx of [340, 520, 700, 860]) { P.rect(mx, h - 118, 3, 60, N(0x3a3a42)); P.rect(mx - 5, h - 122, 13, 5, N(night ? 0xfff0a0 : 0x8a8a94)); }
  for (let x = 0; x < w; x++) for (let y = h - 58; y < h; y++) P.px(x, y, N(mix(0x5a6068, 0x6e747c, hash(x >> 3, y >> 2, 92) * 0.4)));
  const cv = P.flush(); BACK.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
const vnoise = (x, y, s, cell) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
const GRASS = [0x3e8a32, 0x4a9a3a, 0x58a842, 0x6ab84a];
export function paintGround() {
  const P = new Pix(TW, TH);
  // gräset söder om torget, Arenatorget i stora betongplattor med en röd-svart KBK-rand mot arenan
  for (let y = G.BASE - 8; y < TH; y++) for (let x = 0; x < TW; x++) P.px(x, y, GRASS[Math.min(3, Math.max(0, Math.round(1.5 + (hash(x >> 1, y >> 1, 3) - 0.5) * 2 + (vnoise(x, y, 4, 50) - 0.5) * 2 + (bayer(x, y) - 0.5))))]);
  for (let y = G.BASE; y <= G.TORG[1]; y++) for (let x = 0; x < TW; x++) {
    const fx = (x % 24) === 23, fy = (y % 24) === 23;
    let c = mix(0xa8a49c, 0xc4c0b8, vnoise(x, y, 5, 60) * 0.7 + (hash(x >> 2, y >> 2, 6) - 0.5) * 0.2);
    if (fx || fy) c = mul(c, 0.8);
    if (y >= G.BASE + 2 && y < G.BASE + 6 && x > 320 && x < 1080) c = ((x >> 3) & 1) ? 0x7a1a2a : 0x1a1414;   // KBK-randen framför arenan
    if (y === G.TORG[1]) c = 0x6e6a64;
    P.px(x, y, c);
  }
  // gångar till banan och planen
  for (const [x0, x1] of [[RINK.grind[0] - 8, RINK.grind[1] + 8], [PLAN.grind[0] - 8, PLAN.grind[1] + 8], [CHOKLAD.x - 14, CHOKLAD.x + 14], [FIKAT.x - 14, FIKAT.x + 14]]) for (let y = G.TORG[1]; y < 352; y++) for (let x = x0; x < x1; x++) P.px(x, y, mix(0xb8b4ac, 0xa8a49c, hash(x, y, 7) * 0.5));
  for (let y = G.TORG[1]; y < CHOKLAD.y + 4; y++) for (let x = CHOKLAD.x - 14; x < CHOKLAD.x + 14; x++) P.px(x, y, mix(0xb8b4ac, 0xa8a49c, hash(x, y, 7) * 0.5));
  // skridskobanan: isen i ljusblått med skär, mittlinje och cirklar, sargen i vitt med röd och blå linje
  for (let y = RINK.y0; y <= RINK.y1; y++) for (let x = RINK.x0; x <= RINK.x1; x++) {
    const cx = Math.max(RINK.x0 + 24, Math.min(RINK.x1 - 24, x)), cy = Math.max(RINK.y0 + 18, Math.min(RINK.y1 - 18, y));
    if (Math.hypot((x - cx) / 24, (y - cy) / 18) > 1) continue;   // rundade hörn
    let c = mix(0xd8ecf8, 0xb8dcf0, hash(x >> 2, y >> 2, 8) * 0.5 + (vnoise(x, y, 9, 30) - 0.5) * 0.4);
    if (hash(x >> 1, y, 10) > 0.93 && (x + y) % 3 === 0) c = 0xf4fbff;
    if ((x + y * 7) % 41 === 0) c = mix(c, 0x9ac4e0, 0.6);   // skären
    const mx = (RINK.x0 + RINK.x1) / 2, my = (RINK.y0 + RINK.y1) / 2;
    if (Math.abs(x - mx) < 1) c = 0xd8343c;
    const d = Math.hypot((x - mx) / 44, (y - my) / 32); if (Math.abs(d - 1) < 0.04) c = 0x2a5aa8;
    for (const px of [RINK.x0 + 110, RINK.x1 - 110]) { const dd = Math.hypot((x - px) / 30, (y - my) / 22); if (Math.abs(dd - 1) < 0.05) c = 0xd8343c; if (dd < 0.08) c = 0xd8343c; }
    P.px(x, y, c);
  }
  // KBK-planen: konstgräs i ränder, sidlinjer, straffområde och straffpunkt
  for (let y = PLAN.y0; y <= PLAN.y1; y++) for (let x = PLAN.x0; x <= PLAN.x1; x++) { const rand = ((x - PLAN.x0) / 40 | 0) & 1; let c = mix(rand ? 0x3e9a3a : 0x46a842, rand ? 0x36883a : 0x3e9a3a, hash(x >> 1, y >> 1, 11) * 0.5); if (x === PLAN.x0 + 2 || x === PLAN.x1 - 2 || y === PLAN.y0 + 2 || y === PLAN.y1 - 2) c = 0xf4f1ea; if (x === PLAN.x1 - 70 && y > PLAN.mal.y - 46 && y < PLAN.mal.y + 46) c = 0xf4f1ea; if ((y === PLAN.mal.y - 46 || y === PLAN.mal.y + 46) && x > PLAN.x1 - 70) c = 0xf4f1ea; if (Math.hypot(x - STRAFF.x, y - STRAFF.y) < 2) c = 0xf4f1ea; P.px(x, y, c); }
  for (let y = PLAN.mal.y - 30; y <= PLAN.mal.y + 30; y++) for (let x = PLAN.x1 - 30; x <= PLAN.x1 - 2; x++) if (Math.hypot((x - PLAN.x1 + 2) / 30, (y - PLAN.mal.y) / 30) < 1 && Math.hypot((x - PLAN.x1 + 2) / 30, (y - PLAN.mal.y) / 30) > 0.93) P.px(x, y, 0xf4f1ea);
  return P.flush();
}
