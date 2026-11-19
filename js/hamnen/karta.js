// ⚓ FISKEHAMNEN – kartan och marken (Carl 2026-11-18: stadsdelstabellen – "Hamnen + skärgården: pir, fiskmarknad,
// färja, båt att köpa, sommarstuga på ön"). En egen plats som Djurparken och Gamla stan: hamnbussen går hit från
// stadens hållplatser (city.js) och tillbaka från hållplatsen på hamnplanen.
//
// Norr om KAJEN står hamnens hus med fasaderna mot vattnet: HAMNKONTORET, MAGASINET med kranen, FISKMARKNADEN (en
// öppen hall med stånd), BÅTAFFÄREN med båtar på trailers, SKEPPSHANDELN, RÖKERIET med rök ur skorstenen och
// FÄRJETERMINALEN längst i öster. Kajen är stenlagd med pollare, stegar och lyktor längs kanten; på den står
// fisklådor, hummertinor, nätställningar, tunnor, ankaret på hamnplanen och FISK & CHIPS-vagnen. Söder om kajen
// HAVET: fiskebåtarna ligger förtöjda vid kajen och guppar, PIREN går ut i vattnet till fyren och färjeläget där
// SOLÖ-FÄRJAN ligger, BÅTRAMPEN är där man lägger ut med egen eller hyrd båt. Bakom husen hamnstadens tak, kranar
// och stadens siluett (parallax). Måsar, en säl och fiskar som hoppar.
//
// Scenen (js/scenes/hamnen.js) ritar: himlen + takåsarna (parallax) → marken (paintGround, en gång: kajen, vattnet,
// piren) → husen, rekvisitan, båtarna, folket y-sorterade (deko.js) → kvällens mörker och lyktornas sken.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 1800, TH = 460;
export const H = { BASE: 196, KAJ: [200, 300], KANT: 300, VATTEN: [304, 460], TOP: 200, BOTTOM: 452 };
export const HALLPLATS = { x: 60, y: 282 };
export const ANKARE = { x: 150, y: 268 };               // ankaret på hamnplanen
// husen norr om kajen (fasaden står på BASE; dörren x0–x1). typ styr målningen i deko.js
export const HUS = {
  kontor: { id: 'kontor', namn: $t('HAMNKONTORET'), x: 30, w: 150, h: 96, door: { x0: 92, x1: 116 }, typ: 'kontor' },
  magasin: { id: 'magasin', namn: $t('MAGASINET'), x: 200, w: 220, h: 110, door: { x0: 290, x1: 330 }, typ: 'magasin' },
  marknad: { id: 'marknad', namn: $t('FISKMARKNADEN'), x: 460, w: 300, h: 90, door: { x0: 580, x1: 640 }, typ: 'hall' },
  bataffar: { id: 'bataffar', namn: $t('BÅTAFFÄREN'), x: 900, w: 220, h: 104, door: { x0: 980, x1: 1040 }, typ: 'bataffar' },
  skeppshandel: { id: 'skeppshandel', namn: $t('SKEPPSHANDELN'), x: 1160, w: 120, h: 92, door: { x0: 1210, x1: 1232 }, typ: 'skeppshandel' },
  rokeri: { id: 'rokeri', namn: $t('RÖKERIET'), x: 1320, w: 120, h: 86, door: { x0: 1366, x1: 1388 }, typ: 'rokeri' },
  terminal: { id: 'terminal', namn: $t('FÄRJETERMINALEN'), x: 1520, w: 200, h: 94, door: { x0: 1596, x1: 1640 }, typ: 'terminal' },
};
export const HUSLISTA = Object.keys(HUS);
export const STAND = [{ id: 'fisk', x: 520, y: 206 }, { id: 'rokt', x: 610, y: 206 }, { id: 'rakor', x: 700, y: 206 }];   // marknadsståndens fot (i hallens öppna front)
export const FISKBIL = { x: 820, y: 262 };               // Fisk & chips-vagnen (foten, mitten)
export const TRAILERS = [{ x: 930, y: 226, typ: 'rodd' }, { x: 1080, y: 228, typ: 'motor' }];   // båtarna på trailers framför båtaffären
export const KRAN = { x: 300, y: 250 };                  // hamnkranen på rälsen (foten)
export const PIR = { x0: 1588, x1: 1612, y0: 300, y1: 446 };   // piren ut i vattnet (gåbar)
export const PIRHUVUD = { x0: 1560, x1: 1640, y0: 420, y1: 450 };
export const FYR = { x: 1600, y: 452 };                  // fyrens fot längst ut på piren
export const FARJA = { x: 1618, y: 334, w: 100, h: 42 };  // Solö-färjan förtöjd öster om piren
export const RAMP = { x: 1400, y: 300 };                 // båtrampen (där man lägger ut)
export const BATAR = [                                   // fiskebåtarna vid kajen (foten = vattenlinjen)
  { id: 'anna', x: 230, y: 334, typ: 'trawler', farg: [0x2a4a8a, 0x3a6ab8], namn: 'ANNA' },
  { id: 'elsa', x: 520, y: 340, typ: 'trawler', farg: [0xa8282e, 0xd8343c], namn: 'ELSA' },
  { id: 'majken', x: 760, y: 332, typ: 'snipa', farg: [0x3e7e2a, 0x5aa848], namn: 'MAJKEN' },
  { id: 'stina', x: 1050, y: 338, typ: 'segel', farg: [0xf4f1ea, 0x2a5aa8], namn: 'STINA' },
  { id: 'eka', x: 1250, y: 324, typ: 'eka', farg: [0x86562e, 0xae7640], namn: '' },
];
export const POLLARE = [120, 300, 440, 600, 700, 850, 980, 1130, 1300, 1480, 1700].map((x) => ({ x, y: H.KANT - 2 }));
export const LYKTOR = [200, 540, 880, 1220, 1500].map((x) => ({ x, y: H.KANT - 6 }));
export const LADOR = [[480, 268], [500, 272], [650, 284], [1180, 268], [1200, 264], [672, 288], [1160, 290]];   // fisklådor på kajen
export const TINOR = [[760, 268], [780, 274], [1440, 278], [1456, 284]];                        // hummertinor
export const NATSTALL = [[380, 264], [1360, 268]];                                            // nätställningar
export const TUNNOR = [[250, 284], [262, 288], [1270, 284], [1282, 280]];
export const BANKAR = [[100, 250], [820, 290], [1460, 252]];
export const REP = [[560, 276], [1120, 282], [1700, 268]];                                    // repringar på kajen
export const SKYLT = { x: 1570, y: 286 };                 // skylten FISKEHAMNEN vid piren
export const MAS = [[120, 296], [700, 296], [1130, 296], [1700, 296], [1600, 340]];           // måsarnas favoritpollare
export const SAL = { x: 1500, y: 380 };                   // sälen tittar upp här ibland
export const FARJA_PRIS = 20, HYRA_PRIS = 60;
export const BATTYPER = { rodd: { namn: $t('Roddbåt'), pris: 1200, fart: 55 }, motor: { namn: $t('Motorbåt'), pris: 5500, fart: 110 } };

// gånghinder på land (fotavtryck). Vattnet är hinder utom piren.
export function hinder() {
  const o = [];
  for (const id of HUSLISTA) { const h = HUS[id]; o.push([h.x, H.BASE - 34, h.door.x0 - 1, H.BASE - 2], [h.door.x1 + 1, H.BASE - 34, h.x + h.w, H.BASE - 2]); }
  o.push([0, 0, TW, H.BASE - 6]);                                                        // bakom husen
  o.push([0, H.KANT + 2, PIR.x0 - 2, TH], [PIR.x1 + 2, H.KANT + 2, TW, TH]);              // vattnet (piren går att gå på)
  o.push([PIR.x0 - 2, PIRHUVUD.y1, PIR.x1 + 2, TH]);                                      // bortom pirhuvudet
  for (const s of STAND) o.push([s.x - 22, s.y - 10, s.x + 22, s.y + 2]);
  o.push([FISKBIL.x - 26, FISKBIL.y - 10, FISKBIL.x + 26, FISKBIL.y + 2]);
  for (const t of TRAILERS) o.push([t.x - 26, t.y - 8, t.x + 26, t.y + 2]);
  o.push([KRAN.x - 10, KRAN.y - 6, KRAN.x + 10, KRAN.y + 2], [ANKARE.x - 10, ANKARE.y - 6, ANKARE.x + 10, ANKARE.y + 2]);
  for (const p of POLLARE) o.push([p.x - 3, p.y - 3, p.x + 3, p.y + 1]);
  for (const l of LYKTOR) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const [x, y] of LADOR) o.push([x - 7, y - 5, x + 7, y + 1]);
  for (const [x, y] of TINOR) o.push([x - 6, y - 5, x + 6, y + 1]);
  for (const [x, y] of NATSTALL) o.push([x - 18, y - 4, x + 18, y + 1]);
  for (const [x, y] of TUNNOR) o.push([x - 5, y - 4, x + 5, y + 1]);
  for (const [x, y] of BANKAR) o.push([x - 15, y - 4, x + 16, y + 1]);
  for (const [x, y] of REP) o.push([x - 6, y - 3, x + 6, y + 1]);
  o.push([SKYLT.x - 8, SKYLT.y - 3, SKYLT.x + 8, SKYLT.y + 1]);
  return o;
}
// hinder på vattnet (båtturen): land, piren, de förtöjda båtarna och färjan
export function vattenHinder() {
  const o = [];
  o.push([0, 0, TW, H.KANT + 6]);
  o.push([PIR.x0 - 6, H.KANT, PIR.x1 + 6, PIRHUVUD.y1 + 4], [PIRHUVUD.x0 - 4, PIRHUVUD.y0 - 4, PIRHUVUD.x1 + 4, TH]);
  for (const b of BATAR) o.push([b.x - 36, b.y - 20, b.x + 36, b.y + 6]);
  o.push([FARJA.x - 4, FARJA.y - 30, FARJA.x + FARJA.w + 4, FARJA.y + 8]);
  o.push([0, TH - 8, TW, TH], [0, 0, 16, TH], [TW - 16, 0, TW, TH]);
  return o;
}

// ---------------------------------------------------------------- takåsarna, kranarna och staden bakom (parallax)
const BACK = new Map();
export function takCanvas(night) {
  if (BACK.has(night)) return BACK.get(night);
  const w = 1200, h = 120, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.4), 0x101634, 0.35) : c);
  // stadens siluett långt bort, hamnmagasinens tak närmare, två stora kranar
  for (let x = 0; x < w; x++) { const hus = Math.floor(x / 11), hh = 10 + Math.floor(hash(hus, 1, 81) * 22) + (hash(hus, 2, 81) > 0.9 ? 18 : 0); for (let y = h - 70 - hh; y < h - 70; y++) P.px(x, y, N(x % 11 === 0 ? 0x6a7890 : mix(0x8a98b0, 0x7a88a0, (h - 70 - y) / 40))); if (x % 4 === 1 && hash(x, 3, 81) > 0.6) P.px(x, h - 72 - Math.floor(hash(x, 4, 81) * (hh - 4)), N(night ? 0xf0d080 : 0xa8b8d0)); }
  let x = -10, k = 0;
  while (x < w + 40) {
    const bw = 60 + ((hash(k, 1, 82) * 70) | 0), bh = 26 + ((hash(k, 2, 82) * 22) | 0), pal = [[0x5a6068, 0x6e747c, 0x848a92], [0x8a3a2a, 0xa84c34, 0xc06a4a], [0x4a5a6a, 0x5a6c7c, 0x6a7e90]][k % 3], yb = h - 1, yt = yb - bh;
    for (let i = 0; i < bw; i++) for (let y = yt; y <= yb; y++) { const sag = Math.abs(((i % 24) - 12) / 12); if (y < yt + 10 && y - yt < sag * 10) continue; P.px(x + i, y, N(y < yt + 10 ? pal[2] : (i % 24 === 23 ? pal[0] : pal[1]))); }   // sågtandstak
    for (let i = 0; i < bw; i += 24) P.rect(x + i + 3, yt + 14, 6, 5, N(night ? 0xf0d080 : 0x8ab0d0));
    x += bw + 6 + ((hash(k, 3, 82) * 20) | 0); k++;
  }
  for (const kx of [240, 820]) { P.rect(kx, h - 108, 5, 108, N(0xd8a030)); for (let y = h - 108; y < h; y += 6) P.px(kx + 2, y, N(0x8a6a10)); P.rect(kx - 40, h - 112, 110, 4, N(0xd8a030)); P.rect(kx + 60, h - 108, 2, 30, N(0x3a3a42)); P.rect(kx + 56, h - 78, 10, 6, N(0x3a3a42)); P.rect(kx - 46, h - 116, 16, 8, N(0x3a3a42)); }   // kranarna
  const cv = P.flush(); BACK.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
const vnoise = (x, y, s, cell) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
export function paintGround() {
  const P = new Pix(TW, TH);
  // (bakom husen lämnas genomskinligt – där syns takåsarna)
  // kajen: stora stenplattor med fogar, oljefläckar, en vit kantlinje och den gula varningsranden vid kanten
  for (let y = H.BASE; y <= H.KANT; y++) for (let x = 0; x < TW; x++) {
    const fx = ((x + (((y / 14) | 0) & 1) * 20) % 40) === 39, fy = (y % 14) === 13;
    let c = mix(0x9a9690, 0xb4b0a8, vnoise(x, y, 5, 50) * 0.7 + (hash(x >> 2, y >> 2, 6) - 0.5) * 0.2);
    if (fx || fy) c = mul(c, 0.78);
    if (vnoise(x, y, 7, 36) > 0.87) c = mix(c, 0x3e5a6e, 0.22);                                  // vattenpölar
    if (vnoise(x, y, 14, 18) > 0.9 && y > H.KANT - 40) c = mix(c, 0x4a4650, 0.25);              // tjärfläckar vid kanten
    if (y < H.BASE + 4 && hash(x >> 1, y, 8) > 0.7) c = mix(c, 0x3a6a2a, 0.4);                   // mossa vid husfoten
    if (y > 220 && y < 224 && ((x >> 4) & 1) && x > 440 && x < 1300) c = mix(c, 0xf4f1ea, 0.5);  // den vita linjen längs hallen
    if (y >= H.KANT - 5 && y < H.KANT - 1) c = ((x >> 3) & 1) ? 0xf0c030 : 0x2a2a30;              // varningsranden
    if (y === H.KANT - 1) c = 0x6e6a64; if (y === H.KANT) c = 0x3e3a36;
    P.px(x, y, c);
  }
  // hamnplanen framför kontoret: rundel av gatsten kring ankaret
  for (let y = ANKARE.y - 30; y <= ANKARE.y + 30; y++) for (let x = ANKARE.x - 60; x <= ANKARE.x + 60; x++) { const d = Math.hypot((x - ANKARE.x) / 60, (y - ANKARE.y) / 30); if (d > 1) continue; const ring = Math.floor(d * 6); P.px(x, y, (d > 0.95 || (d * 6) % 1 < 0.15) ? 0x6e685e : mix(0xa8a296, 0xc4bcae, hash(ring, (x + y) >> 2, 9))); }
  // vattnet: mörkt grönblått närmast kajen (skuggan), ljusare utåt, oljeskimmer vid båtarna, vågtoppar i rader
  for (let y = H.KANT + 1; y < TH; y++) for (let x = 0; x < TW; x++) {
    const u = (y - H.KANT) / (TH - H.KANT);
    let c = mix(0x1e4a66, 0x2e7aa8, Math.min(1, u * 1.6) + (vnoise(x, y, 10, 24) - 0.5) * 0.3);
    if (y < H.KANT + 6) c = mul(c, 0.7);
    const vag = hash(Math.floor((x + Math.sin(y * 0.7) * 5) / (5 + u * 8)), y, 11);
    if (vag > 0.92) c = mix(c, 0xa8d8ec, 0.55); else if (vag < 0.06) c = mul(c, 0.86);
    if (vnoise(x, y, 12, 30) > 0.82 && y < H.KANT + 60) c = mix(c, 0x8a6ab8, 0.18);          // oljeskimmer
    P.px(x, y, c);
  }
  // piren: betong med räcke av kätting (stolparna ritas av scenen), pirhuvudet brett med fyren
  for (let y = H.KANT; y <= PIRHUVUD.y1; y++) for (let x = PIR.x0; x <= PIR.x1; x++) P.px(x, y, mix(0xa8a49c, 0x8e8a82, hash(x >> 2, y >> 2, 13) * 0.5 + ((y % 10) === 9 ? 0.4 : 0)));
  for (let y = PIRHUVUD.y0; y <= PIRHUVUD.y1; y++) for (let x = PIRHUVUD.x0; x <= PIRHUVUD.x1; x++) P.px(x, y, mix(0xa8a49c, 0x8e8a82, hash(x >> 2, y >> 2, 13) * 0.5 + ((y % 10) === 9 ? 0.4 : 0)));
  for (let y = H.KANT; y <= PIRHUVUD.y1; y++) { P.px(PIR.x0, y, 0x6e6a64); P.px(PIR.x1, y, 0x5e5a54); }
  for (let x = PIRHUVUD.x0; x <= PIRHUVUD.x1; x++) { P.px(x, PIRHUVUD.y0, 0x6e6a64); P.px(x, PIRHUVUD.y1, 0x4e4a44); }
  // båtrampen: lutande betong ner i vattnet
  for (let y = H.KANT - 2; y < H.KANT + 22; y++) for (let x = RAMP.x - 20; x <= RAMP.x + 20; x++) P.px(x, y, mix(0xa8a49c, 0x3e6a86, Math.max(0, (y - H.KANT) / 22) * 0.8 + ((y % 4) === 3 ? 0.1 : 0)));
  // stegarna ner till vattnet och kajkantens stenar
  for (const sx of [160, 640, 1100, 1540]) for (let y = H.KANT - 6; y < H.KANT + 14; y++) { P.px(sx, y, 0x3a3a42); P.px(sx + 5, y, 0x3a3a42); if ((y - H.KANT) % 4 === 0) P.hl(sx, y, 6, 0x5a5a62); }
  return P.flush();
}
