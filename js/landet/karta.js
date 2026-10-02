// LANDET – kartan och marken (Carl 2026-10-02: "bygga ut staden så att vi har landet längre ut och att
// man går förbi staket med böljande landskap med kossor och får och en traktor som kör … köpa en gård
// och bli bonde … häst att rida och hoppa runt med på en bana över hinder").
//
// Landet ligger öster om förorten: Pixelgatan fortsätter som LANDSVÄGEN på samma höjd (y 218–276,
// dikesrenar 186–218 och 276–306), så man går rakt ut ur staden förbi ortsskylten. Ett pixelkorn,
// ljuset från sydväst som i staden. Världen är LW × LH; scenen (js/scenes/landet.js) ritar
//   himlen och de bortre kullarna (parallax, drawSky) → marken (paintLand, cachad per ljusläge)
//   → husen/staketen/djuren y-sorterade → ljuset.
// Norr om vägen: kohagen, GÅRDEN (boningshus, ladugård, silo, hönsgård), fårhagen och skogsbrynet.
// Söder om vägen: vetefältet (traktorn plöjer), rapsfältet, bäcken under stenbron, STALLET med
// hästhagen och RIDBANAN med hindren. Busshållplatsen LANDET vid vägen tar en tillbaka till stan.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';

export const LW = 2400, LH = 520;
export const L = {
  HORIZON: 92,                      // där kullarna möter det nära landskapet
  VERGE_N: [186, 218], ROAD: [218, 276], VERGE_S: [276, 306],
  LANES: [244, 271],
  BOTTOM: 512,
};
// hagar och fält (rektanglar [x0, y0, x1, y1]); djuren håller sig innanför
export const KOHAGE = [100, 112, 640, 182];
export const FARHAGE = [1250, 112, 1700, 182];
export const HONSGARD = [1140, 150, 1210, 182];
export const VETE = [40, 322, 520, 472];
export const RAPS = [560, 322, 900, 472];
export const HASTHAGE = [1390, 318, 1600, 470];
export const RIDBANA = [1640, 324, 2120, 488];
export const BACK_X = (y) => 982 + Math.round(Math.sin(y / 38) * 16);   // bäckens mitt i x vid höjden y (söder om vägen)
export const BACK_Y0 = 306;
// husen: dörr (x0, x1) och fasaden står på base
export const HUS = {
  gard: { id: 'gard', namn: 'GÅRDEN', x: 700, w: 150, base: 186, h: 62, door: { x0: 760, x1: 778 } },
  lada: { id: 'lada', namn: 'LADUGÅRDEN', x: 880, w: 170, base: 182, h: 74, door: { x0: 940, x1: 990 } },
  silo: { id: 'silo', x: 1070, w: 28, base: 182, h: 86 },
  stall: { id: 'stall', namn: 'STALLET', x: 1110, w: 250, base: 398, h: 66, door: { x0: 1220, x1: 1250 } },
  domartorn: { id: 'domartorn', x: 2130, w: 30, base: 360, h: 50 },
};
export const GRIND = { hage: [1480, 1510], bana: [1660, 1700] };   // grindarna (norrsidan, mot vägen)
export const HALLPLATS = { x: 140, y: 300 };            // busshållplatsen LANDET (södra renen)
export const ORTSSKYLT = { x: 34, y: 212 };              // PIXELSTADEN med rött streck (norra renen)
export const BRO = { x0: 952, x1: 1014 };                // stenbron där bäcken går under vägen
export const SPANG = { x0: 966, x1: 1000, y0: 420, y1: 436 };   // spången över bäcken vid stallet
// ridbanans hinder: x längs banan, typ och färg
export const HINDER = [
  { x: 1720, y: 400, typ: 'bom', c: 0xd8343c }, { x: 1800, y: 372, typ: 'oxer', c: 0x3a7bd5 }, { x: 1880, y: 430, typ: 'mur', c: 0xb85a3a },
  { x: 1960, y: 384, typ: 'bom', c: 0xf0b429 }, { x: 2040, y: 440, typ: 'oxer', c: 0x46a35a },
];
// gånghinder (fotavtryck) som marken vet om – djuren och folket läggs till av scenen
export function landHinder() {
  const o = [];
  const fence = ([x0, y0, x1, y1], gap = null) => {
    // staketen runt hagarna (en lucka = grind, på norrsidan mot vägen)
    for (const [ax, ay, bx, by] of [[x0, y0, x1, y0 + 3], [x0, y1 - 2, x1, y1 + 1], [x0, y0, x0 + 3, y1], [x1 - 3, y0, x1, y1]]) {
      if (gap && ay === y0) { o.push([ax, ay, gap[0], by], [gap[1], ay, bx, by]); } else o.push([ax, ay, bx, by]);
    }
  };
  fence(KOHAGE); fence(FARHAGE); fence(HONSGARD); fence(HASTHAGE, GRIND.hage);
  fence(RIDBANA, GRIND.bana);
  for (const k of ['gard', 'lada', 'silo', 'stall', 'domartorn']) { const h = HUS[k]; o.push([h.x, h.base - (k === 'stall' ? 40 : 30), h.x + h.w, h.base]); }
  // fälten går man inte rakt igenom (man går runt på renarna)
  o.push(VETE, RAPS);
  // bäcken (utom under bron och vid spången)
  for (let y = BACK_Y0; y < LH; y += 4) { if (y >= SPANG.y0 && y < SPANG.y1) continue; const cx = BACK_X(y); o.push([cx - 10, y, cx + 10, y + 4]); }
  // norra kanten: kullarna går man inte upp på
  o.push([0, 0, LW, L.HORIZON + 18]);
  // hinder i ridbanan (hoppas bara till häst)
  for (const h of HINDER) o.push([h.x - 12, h.y - 3, h.x + 12, h.y + 2]);
  return o;
}

// ---------------------------------------------------------------- himlen och de bortre kullarna
// Ritas i skärmrymden bakom marken med parallax (kullarna glider långsammare än marken).
const SKY = new Map();
export function skyCanvas(vw, night, dusk) {
  const key = `${vw}|${night}|${dusk}`;
  if (SKY.has(key)) return SKY.get(key);
  const P = new Pix(vw, 110);
  const top = night ? 0x141c3a : dusk ? 0x4a5a98 : 0x5aa0e0, bot = night ? 0x2a3462 : dusk ? 0xf0a070 : 0xc8e4f8;
  for (let y = 0; y < 110; y++) for (let x = 0; x < vw; x++) P.px(x, y, mix(top, bot, Math.min(1, y / 90)));
  if (night) for (let k = 0; k < vw / 6; k++) P.px((hash(k, 1, 4) * vw) | 0, (hash(k, 2, 4) * 70) | 0, 0xf8f4d8, 0.4 + hash(k, 3, 4) * 0.6);
  else for (let c = 0; c < vw / 90; c++) { const cx = hash(c, 5, 6) * vw, cy = 14 + hash(c, 6, 6) * 30, w = 26 + hash(c, 7, 6) * 30; for (let y = -6; y <= 6; y++) for (let x = -w; x <= w; x++) { const d = (x / w) ** 2 + (y / 6) ** 2 - Math.sin(x / 5) * 0.12; if (d < 1) P.px(cx + x, cy + y, y > 2 ? 0xe8eef6 : 0xffffff, d > 0.75 ? 0.6 : 0.95); } }
  const cv = P.flush(); SKY.set(key, cv); return cv;
}
// två lager kullar som en lång remsa (x i lagrets rymd)
const HILLS = new Map();
export function hillsCanvas(layer, night) {
  const key = `${layer}|${night}`;
  if (HILLS.has(key)) return HILLS.get(key);
  const w = layer === 0 ? 1400 : 1900, h = 70;
  const P = new Pix(w, h);
  const base = layer === 0 ? [0x6a8aa0, 0x7a9aae, 0x8aaabc] : [0x4a7a3a, 0x5a8a42, 0x6a9a4a];
  for (let x = 0; x < w; x++) {
    const hgt = layer === 0 ? 34 + Math.sin(x / 70) * 10 + Math.sin(x / 23) * 4 : 26 + Math.sin(x / 55 + 1) * 12 + Math.sin(x / 17) * 3;
    for (let y = Math.round(h - hgt); y < h; y++) {
      let c = base[Math.min(2, ((y - (h - hgt)) / 9) | 0)];
      if (layer === 1) { // lapptäcke: åkrar i olika gröna/gula och häckar längs konturerna
        const f = Math.floor((x + Math.sin(y / 6) * 20) / 60) + Math.floor(y / 12) * 7;
        c = [0x5a8a42, 0x6a9a4a, 0x8aa84a, 0xb8b058, 0x4a7a3a][f % 5];
        if ((y + Math.round(Math.sin(x / 30) * 4)) % 12 === 0) c = 0x2e5a26;
        if (hash(x >> 2, y >> 2, 9) > 0.93) c = mul(c, 0.85);
      }
      P.px(x, y, night ? mul(c, 0.45) : c);
    }
  }
  if (layer === 1) {
    // en gammal väderkvarn på kullen och några gårdar långt bort
    const mx = 1500, my = 22;
    for (let y = my; y < my + 22; y++) { const half = 3 + ((y - my) >> 2); for (let x = mx - half; x <= mx + half; x++) P.px(x, y, night ? 0x4a4038 : (x === mx - half ? 0xd8d0c0 : 0xb8ae9a)); }
    P.rect(mx - 3, my - 4, 7, 5, 0x6a4a3a);
    for (const [dx, dy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) for (let k = 2; k < 15; k++) P.px(mx + dx * k, my + dy * k * 0.8, night ? 0x5a5048 : 0xe8e0d0);
    for (const fx of [300, 820, 1240]) { P.rect(fx, 40, 12, 7, night ? 0x4a2a24 : 0xa8382a); P.rect(fx - 1, 37, 14, 3, night ? 0x2a2a2a : 0x4a4a4e); P.rect(fx + 14, 42, 6, 5, night ? 0x8a8a7a : 0xf0ece0); }
  }
  const cv = P.flush(); HILLS.set(key, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång per ljusläge)
const GRASS = [0x3e8a32, 0x4a9a3a, 0x58a842, 0x6ab84a];
const grass = (x, y, k = 0) => GRASS[Math.min(3, Math.max(0, Math.round(1.4 + (hash(x >> 1, y >> 1, 3) - 0.5) * 2 + k + (bayer(x, y) - 0.5))))];
export function paintLand() {
  const P = new Pix(LW, LH);
  // ---- de nära kullarna (norr om hagarna): böljande gräs med skuggade svackor och häckar
  for (let x = 0; x < LW; x++) {
    const ridge = L.HORIZON - 6 + Math.sin(x / 90) * 8 + Math.sin(x / 31) * 3;
    for (let y = 0; y < 112; y++) {
      if (y < ridge) continue;
      const slope = Math.cos(x / 90) * 0.6 + Math.cos(x / 31) * 0.3;   // ljus på västsluttningen
      let c = grass(x, y, slope * 0.8);
      if (Math.abs(((y - ridge) + Math.sin(x / 22) * 3) % 16) < 1) c = 0x2e6a26;      // häckar längs konturen
      if (y - ridge < 2) c = mix(c, 0x8aca6a, 0.4);
      P.px(x, y, c);
    }
  }
  // ---- gräset överallt annars
  for (let y = 112; y < LH; y++) for (let x = 0; x < LW; x++) P.px(x, y, grass(x, y, (y > 306 ? -0.1 : 0.1)));
  // blommor och tuvor
  for (let k = 0; k < 900; k++) { const x = (hash(k, 1, 21) * LW) | 0, y = 112 + ((hash(k, 2, 21) * (LH - 112)) | 0); P.px(x, y, [0xf8f0a0, 0xffffff, 0xd84a6a, 0x8a5ad8, 0x2e6a26][k % 5]); if (k % 5 === 4) { P.px(x + 1, y - 1, 0x2e6a26); P.px(x - 1, y - 1, 0x2e6a26); } }
  // ---- landsvägen: asfalt med lagade fläckar, mittlinje, dikesrenar med grus och gräs
  for (let y = L.ROAD[0]; y < L.ROAD[1]; y++) for (let x = 0; x < LW; x++) {
    let c = mix(0x4e4e54, 0x5e5e64, hash(x >> 1, y >> 1, 8));
    if (hash(x >> 4, y >> 3, 12) > 0.86) c = mul(c, 0.86);                              // lagningar
    if ((y === L.ROAD[0] + 1 || y === L.ROAD[1] - 2) && (x >> 1) % 2) c = 0xd8d8d0;    // kantlinjen (streckad)
    if (Math.abs(y - (L.ROAD[0] + L.ROAD[1]) / 2) < 1 && (x % 24) < 12) c = 0xf0f0e8;  // mittlinjen
    P.px(x, y, c);
  }
  for (const [y0, y1] of [L.VERGE_N, L.VERGE_S]) for (let y = y0; y < y1; y++) for (let x = 0; x < LW; x++) {
    const nearRoad = y0 === L.VERGE_N[0] ? y1 - y : y - y0;
    P.px(x, y, nearRoad < 5 ? mix(0x9a9284, 0x8a8274, hash(x, y, 13)) : grass(x, y, 0.3 - (nearRoad < 9 ? 0.4 : 0)));
  }
  // stadens asfalt som tunnar ut i väster (övergången från Pixelgatan)
  for (let y = L.VERGE_N[0]; y < L.VERGE_S[1]; y++) for (let x = 0; x < 60; x++) if (y < L.ROAD[0] || y >= L.ROAD[1]) { if (bayer(x, y) < 1 - x / 60) P.px(x, y, mix(0x9a9a96, 0xa8a8a2, hash(x, y, 2))); }
  // ---- kohagens och fårhagens bete: lite kortare (ljusare) gräs och trampade stigar
  for (const [x0, y0, x1, y1] of [KOHAGE, FARHAGE]) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const h = hash(x, y, 31); if (h > 0.9 || (h > 0.78 && bayer(x, y) < 0.3)) P.px(x, y, 0x6ab04e); if (Math.abs((x - x0) * 0.3 - (y - y0) - Math.sin(x / 20) * 4) < 1 && hash(x, 0, 5) > 0.3) P.px(x, y, 0x8a8a5a); }
  // fårhagen har en stenmur mot vägen (ritas här: platta stenar)
  for (let x = FARHAGE[0]; x < FARHAGE[2]; x += 6) { const c = mix(0x8a8a86, 0xb8b4ac, hash(x, 3, 7)); P.rect(x, FARHAGE[3] - 4, 6, 5, c); P.hl(x, FARHAGE[3] - 4, 6, mix(c, 0xffffff, 0.3)); P.px(x, FARHAGE[3], 0x5a5a56); }
  // ---- gårdsplanen: grus framför husen, hönsgårdens sand
  for (let y = 182; y < L.VERGE_N[0] + 4; y++) for (let x = 690; x < 1110; x++) P.px(x, y, mix(0xc8b890, 0xb8a880, hash(x, y, 15)));
  for (let y = HONSGARD[1]; y < HONSGARD[3]; y++) for (let x = HONSGARD[0]; x < HONSGARD[2]; x++) P.px(x, y, mix(0xc8a870, 0xb89860, hash(x >> 1, y >> 1, 16)));
  // ---- vetefältet (gula rader) och rapsfältet (knallgult med gröna stjälkar)
  for (let y = VETE[1]; y < VETE[3]; y++) for (let x = VETE[0]; x < VETE[2]; x++) {
    const row = (y - VETE[1]) % 6;
    P.px(x, y, row === 0 ? 0x8a6a2a : mix(0xd8b048, 0xf0d070, (hash(x >> 1, y, 17) + (row < 3 ? 0.3 : 0)) * 0.7));
  }
  for (let y = RAPS[1]; y < RAPS[3]; y++) for (let x = RAPS[0]; x < RAPS[2]; x++) {
    const h = hash(x, y, 18);
    P.px(x, y, h > 0.85 ? 0x4a8a2a : h > 0.3 ? 0xf8e030 : 0xe8c820);
  }
  // åkerkanterna: en smal remsa plöjd jord
  for (const [x0, y0, x1, y1] of [VETE, RAPS]) { for (let x = x0; x < x1; x++) { P.px(x, y0, 0x6a4a2a); P.px(x, y1 - 1, 0x5a3a1e); } for (let y = y0; y < y1; y++) { P.px(x0, y, 0x6a4a2a); P.px(x1 - 1, y, 0x5a3a1e); } }
  // ---- bäcken: slingrar söderut från vägen; stenar i kanten och glitter
  for (let y = BACK_Y0 - 30; y < LH; y++) {
    const cx = y < BACK_Y0 ? 983 : BACK_X(y), w = 9;
    for (let x = cx - w - 2; x <= cx + w + 2; x++) {
      const d = Math.abs(x - cx);
      if (y >= L.ROAD[0] && y < L.VERGE_S[1] && y < BACK_Y0) continue;   // under vägen (kulverten)
      if (d > w) P.px(x, y, mix(0x7a7a72, 0x9a968a, hash(x, y, 19)));
      else P.px(x, y, d > w - 2 ? 0x3a7aa8 : mix(0x4a9ad0, 0x6ab8e0, hash(x >> 1, y >> 2, 20)));
    }
  }
  // stenbron i vägen (räcken på båda sidor)
  for (const yy of [L.ROAD[0] - 4, L.ROAD[1]]) for (let x = BRO.x0; x < BRO.x1; x++) { const c = mix(0x9a968a, 0xb8b4a8, hash(x >> 2, yy, 22)); P.rect(x, yy, 1, 4, c); if (x % 8 === 0) P.vl(x, yy, 4, 0x6a665e); }
  // spången vid stallet (plankor)
  for (let x = SPANG.x0; x < SPANG.x1; x++) for (let y = SPANG.y0; y < SPANG.y1; y++) P.px(x, y, (x - SPANG.x0) % 5 === 0 ? 0x5a3a1e : mix(0x9a6a3a, 0xb07a48, hash(x, y, 23)));
  // ---- hästhagen: trampad jord; ridbanan: sand med spår, vita staket ritas av scenen
  for (let y = HASTHAGE[1]; y < HASTHAGE[3]; y++) for (let x = HASTHAGE[0]; x < HASTHAGE[2]; x++) if (hash(x >> 2, y >> 2, 24) > 0.55) P.px(x, y, mix(0x8a7a50, 0x9a8a5a, hash(x, y, 25)));
  for (let y = RIDBANA[1]; y < RIDBANA[3]; y++) for (let x = RIDBANA[0]; x < RIDBANA[2]; x++) {
    let c = mix(0xd8c49a, 0xe8d4aa, hash(x >> 1, y >> 1, 26));
    const track = Math.hypot((x - (RIDBANA[0] + RIDBANA[2]) / 2) / ((RIDBANA[2] - RIDBANA[0]) / 2 - 18), (y - (RIDBANA[1] + RIDBANA[3]) / 2) / ((RIDBANA[3] - RIDBANA[1]) / 2 - 14));
    if (Math.abs(track - 1) < 0.04) c = mul(c, 0.88);                                      // hovspåret runt banan
    P.px(x, y, c);
  }
  // ---- grusgångar: från vägen till gården, till stallet och längs bäcken
  const path = (x0, y0, x1, y1, w = 7) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w) P.px(x + dx, y + dy, mix(0xc8b890, 0xb0a078, hash((x + dx) >> 1, (y + dy) >> 1, 27))); } };
  path(1090, 306, 1090, 406, 6); path(1090, 406, 1236, 406, 6);                      // till stallets dörr (söderut runt västra gaveln)
  path(1495, 306, 1495, 322, 6); path(1680, 306, 1680, 328, 7);                      // in genom grindarna till hagen och banan
  return P.flush();
}

// ---------------------------------------------------------------- husen (bilder, ritas av scenen y-sorterat)
const HUSBILD = new Map();
function wood(P, x0, y0, w, h, base, plank = 4) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const p = (x - x0) % plank, c = p === 0 ? mul(base, 0.72) : p === 1 ? mix(base, 0xffffff, 0.12) : mix(base, mul(base, 0.9), hash(x >> 1, y >> 2, 41));
    P.px(x, y, c);
  }
}
function windowW(P, x, y, w, h, night, white = 0xf4f1ea) {
  P.rect(x - 1, y - 1, w + 2, h + 2, white);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, night ? (hash(x, y, 3) > 0.4 ? 0xf8d878 : 0x2a3448) : mix(0x6aa8d8, 0x2a5a8a, j / h));
  P.vl(x + (w >> 1), y, h, white); P.hl(x, y + (h >> 1), w, white);
}
export function husBild(id, night) {
  const key = `${id}|${night}`;
  if (HUSBILD.has(key)) return HUSBILD.get(key);
  const H = HUS[id], W = H.w + 16, HH = H.h + 40;
  const P = new Pix(W, HH);
  const ox = 8, gy = HH - 4;                         // bildens markrad
  const FALU = 0xa8382a, VIT = 0xf4f1ea;
  if (id === 'gard') {
    // falurött boningshus i två våningar med vita knutar, tegeltak och farstukvist
    const top = gy - H.h;
    wood(P, ox, top + 18, H.w, H.h - 18, FALU);
    for (const x of [ox, ox + H.w - 3]) P.rect(x, top + 18, 3, H.h - 18, VIT);
    for (let j = 0; j < 22; j++) { const inset = Math.round(j * 0.9); P.hl(ox - 4 + inset, top + 18 - j, H.w + 8 - inset * 2, j % 3 === 0 ? 0x6a2a20 : mix(0x8a3a2a, 0xa84a32, hash(j, 1, 3))); }
    P.rect(ox + 22, top - 8, 8, 12, 0x8a8a86); P.rect(ox + 21, top - 9, 10, 2, 0x6a6a66);   // skorstenen
    for (const wx of [ox + 12, ox + 40, ox + 96, ox + 124]) { windowW(P, wx, top + 24, 10, 12, night); windowW(P, wx, top + 44, 10, 12, night); }
    // farstukvisten och dörren
    const dx = H.door.x0 - H.x + ox;
    P.rect(dx - 6, gy - 22, (H.door.x1 - H.door.x0) + 12, 3, VIT); P.rect(dx - 5, gy - 19, 2, 19, VIT); P.rect(dx + (H.door.x1 - H.door.x0) + 3, gy - 19, 2, 19, VIT);
    P.rect(dx, gy - 18, H.door.x1 - H.door.x0, 18, 0x3a5a3a); P.rect(dx + 2, gy - 16, H.door.x1 - H.door.x0 - 4, 6, night ? 0xf8d878 : 0x6aa8d8); P.px(dx + H.door.x1 - H.door.x0 - 3, gy - 8, 0xd8b040);
    P.rect(dx - 4, gy - 2, (H.door.x1 - H.door.x0) + 8, 2, 0x8a8a86);
    // pelargoner i fönstren och en postlåda
    for (const wx of [ox + 12, ox + 40, ox + 96, ox + 124]) { P.px(wx + 2, top + 54, 0xd8304a); P.px(wx + 6, top + 54, 0xd8304a); P.hl(wx + 1, top + 55, 8, 0x3a8a2a); }
  } else if (id === 'lada') {
    // stora röda ladugården med vitt kryssade portar och höskulle
    const top = gy - H.h;
    wood(P, ox, top + 22, H.w, H.h - 22, 0xb03a2a, 5);
    for (let j = 0; j < 30; j++) { const inset = Math.round(j * 1.6); if (H.w + 8 - inset * 2 <= 0) break; P.hl(ox - 4 + inset, top + 22 - j, H.w + 8 - inset * 2, j % 4 === 0 ? 0x3a3a3e : mix(0x5a5a62, 0x6a6a72, hash(j, 2, 3))); }
    const px0 = H.door.x0 - H.x + ox, pw = H.door.x1 - H.door.x0;
    P.rect(px0, gy - 40, pw, 40, 0x8a2a20); P.box(px0, gy - 40, pw, 40, VIT); P.vl(px0 + (pw >> 1), gy - 40, 40, VIT);
    for (const [a, b] of [[px0, px0 + (pw >> 1)], [px0 + (pw >> 1), px0 + pw]]) { P.line(a, gy - 40, b - 1, gy - 1, VIT); P.line(b - 1, gy - 40, a, gy - 1, VIT); }
    P.rect(ox + (H.w >> 1) - 10, top + 6, 20, 14, 0x6a2a20); P.box(ox + (H.w >> 1) - 10, top + 6, 20, 14, VIT);    // höluckan
    for (const wx of [ox + 14, ox + H.w - 26]) windowW(P, wx, gy - 34, 12, 9, false);
    for (let k = 0; k < 6; k++) P.px(ox + (H.w >> 1) - 6 + k * 2, top + 18 + (k % 2), 0xe8c858);   // hö som sticker ut
  } else if (id === 'silo') {
    const top = gy - H.h;
    for (let y = top + 8; y < gy; y++) for (let x = 0; x < H.w; x++) { const k = x / H.w; P.px(ox + x, y, ((y - top) % 10 === 0) ? 0x7a7e86 : mix(0xb8bcc4, 0x7a7e86, Math.abs(k - 0.3) * 1.4)); }
    for (let j = 0; j < 9; j++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - ((8 - j) / 9) ** 2)) * (H.w / 2)); P.hl(ox + (H.w >> 1) - half, top + j, half * 2, mix(0x9aa0aa, 0xd8dce4, j / 9)); }
    P.vl(ox + H.w - 4, top + 10, H.h - 12, 0x5a5e66); for (let y = top + 12; y < gy - 4; y += 4) P.hl(ox + H.w - 6, y, 4, 0x5a5e66);
  } else if (id === 'stall') {
    // stallet: brunt trä, vita fönsterkarmar, boxdörrar med hästhuvuden, väderflöjel
    const top = gy - H.h;
    wood(P, ox, top + 18, H.w, H.h - 18, 0x7a4a2a, 5);
    for (let j = 0; j < 22; j++) { const inset = Math.round(j * 1.2); P.hl(ox - 4 + inset, top + 18 - j, H.w + 8 - inset * 2, j % 3 === 0 ? 0x3a3a3e : mix(0x4a5058, 0x5a6068, hash(j, 5, 3))); }
    P.rect(ox + (H.w >> 1) - 2, top - 10, 4, 8, 0x6a6a66); P.line(ox + (H.w >> 1) - 6, top - 12, ox + (H.w >> 1) + 6, top - 12, 0x2a2a2e);   // väderflöjeln
    for (let i = 0; i < 6; i++) {
      const bx = ox + 10 + i * 40; if (bx + 22 > ox + H.w - 8) break;
      if (Math.abs(bx + 11 - (H.door.x0 - H.x + ox + 15)) < 26) continue;
      P.rect(bx, gy - 30, 22, 30, 0x5a3a1e); P.box(bx, gy - 30, 22, 30, VIT); P.line(bx, gy - 15, bx + 21, gy - 1, VIT); P.line(bx + 21, gy - 15, bx, gy - 1, VIT); P.hl(bx, gy - 15, 22, VIT);
      P.rect(bx + 3, gy - 28, 16, 12, 0x2a1e14);
    }
    const dx = H.door.x0 - H.x + ox;
    P.rect(dx, gy - 34, H.door.x1 - H.door.x0, 34, 0x4a2a14); P.box(dx, gy - 34, H.door.x1 - H.door.x0, 34, VIT);
    // skylten
    const s = 'STALLET', tw = textW(SMALL, s) + 8; P.rect(ox + (H.w >> 1) - (tw >> 1), top + 22, tw, 10, 0xf4f1ea); text(P, SMALL, s, ox + (H.w >> 1) - (tw >> 1) + 4, top + 24, 0x5a3a1e);
  } else if (id === 'domartorn') {
    const top = gy - H.h;
    for (const lx of [ox + 2, ox + H.w - 4]) P.rect(lx, top + 20, 2, H.h - 20, 0xf4f1ea);
    wood(P, ox, top + 4, H.w, 18, 0xf4f1ea, 4); P.rect(ox + 3, top + 8, H.w - 6, 8, 0x2a3a4a);
    P.rect(ox - 2, top, H.w + 4, 4, 0x3a7bd5); P.hl(ox - 2, top, H.w + 4, 0x6aa8e8);
    for (let k = 0; k < 4; k++) P.line(ox + 4, top + 22 + k * 8, ox + H.w - 4, top + 26 + k * 8, 0xd8d4c8);
  }
  // mörk kontur
  const out = new Pix(W, HH);
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
    if (P.d[(y * W + x) * 4 + 3]) { out.px(x, y, P.get(x, y)); continue; }
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < HH && P.d[(yy * W + xx) * 4 + 3]; })) out.px(x, y, 0x1e1a24);
  }
  const cv = out.flush();
  HUSBILD.set(key, cv);
  return cv;
}
// husbildens övre vänstra hörn i världen
export const husPos = (id) => { const H = HUS[id]; return { x: H.x - 8, y: H.base + 4 - (H.h + 40) }; };
