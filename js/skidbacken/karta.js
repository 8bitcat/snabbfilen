// ⛷️ SKIDBACKEN – kartan och marken (Carl 2026-11-18: stadsdelstabellen – "Skidbacken: lift, slalom, pulka, värmestuga").
// En egen plats som Djurparken: skidbussen går hit från stadens hållplatser (city.js) och tillbaka från hållplatsen vid
// DALSTATIONEN. Här är det vinter året om.
//
// Nederst DALEN (gåbar): hållplatsen, VÄRMESTUGAN med rök ur skorstenen, SKIDUTHYRNINGEN, liftens dalstation, snögubben,
// eldstaden med bänkar och granarna. Uppåt BACKEN (inte gåbar – man åker!): till vänster PULKABACKEN med gupp, i mitten
// SLALOMBACKEN med portarna (röda och blå flaggor), till höger LIFTEN med stolarna som går upp och ner. Överst TOPPEN
// (gåbar när man åkt upp): toppstationen, TOPPSTUGAN, utsiktsskylten och starten på slalom och pulka. Bakom allt
// fjällen och himlen (parallax). Snökanoner, en skidpatrull och åkare som susar förbi.
//
// Scenen (js/scenes/skidbacken.js) ritar: himlen + fjällen → marken (paintGround, en gång: snön, pisterna, spåren,
// liftlinan) → stugor, träd, lift, portar, folk, spelaren y-sorterade (deko.js) → kvällens blå mörker och ljusen.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 1800, TH = 560;
export const S = { TOPP: [96, 150], BACKE: [150, 430], DAL: [430, 552], TOP: 100, BOTTOM: 552 };
export const HALLPLATS = { x: 70, y: 480 };
export const VARMESTUGA = { x: 200, y: 452, w: 150, h: 84, door: { x0: 262, x1: 290 } };     // fasaden står på y (foten)
export const UTHYRNING = { x: 560, y: 452, w: 110, h: 70, door: { x0: 602, x1: 626 } };
export const TOPPSTUGA = { x: 1340, y: 140, w: 120, h: 66, door: { x0: 1390, x1: 1412 } };
export const LIFT = { x0: 1520, y0: 436, x1: 1600, y1: 116, stolar: 6, tid: 9 };               // dalstation → toppstation, stolarnas antal och turen i sekunder
export const LIFTKO = { x: 1480, y: 470 };                                                     // där man ställer sig för att åka upp
export const SLALOM = { x0: 780, x1: 1160, start: { x: 960, y: 150 }, mal: 418, portar: [] };  // slalombacken; portarna fylls nedan
for (let k = 0; k < 9; k++) SLALOM.portar.push({ x: 960 + (k % 2 ? 34 : -34) + Math.round(Math.sin(k * 1.7) * 12), y: 184 + k * 27, rod: k % 2 === 0 });   // omväxlande vänster/höger, 27 px mellan
export const PULKA = { x0: 260, x1: 700, start: { x: 480, y: 160 }, mal: 410, gupp: [230, 280, 330, 370] };   // pulkabacken med guppen (y)
export const TOPPSKYLT = { x: 1240, y: 128 };
export const SNOGUBBE = { x: 760, y: 500 };
export const ELD = { x: 930, y: 498 };
export const BANKAR = [[880, 520], [980, 520], [420, 508], [1240, 500]];
export const SNOKANONER = [[740, 200], [1200, 300]];
export const GRANAR = [
  [40, 420], [1240, 440], [720, 190], [1180, 170], [1230, 240], [1700, 300], [1740, 420], [1660, 520], [1120, 520], [1300, 530], [100, 540], [1660, 190],
  [740, 300], [1190, 390], [250, 180], [200, 260], [120, 330], [1720, 140], [1780, 230], [1760, 500],
].map(([x, y]) => ({ x, y }));
export const STENAR = [[1160, 250], [700, 240], [160, 390]];
export const SKYLT = { x: 130, y: 446 };   // välkomstskylten står i dalens överkant så den inte skymmer den som kliver av bussen
export const SKID_HYRA = 40, PULKA_HYRA = 20, LIFT_PRIS = 0;

// gånghinder: lage 'dal' (nere) eller 'topp' (uppe) – backen är aldrig gåbar
export function hinder(lage = 'dal') {
  const o = [];
  if (lage === 'topp') {
    o.push([0, 0, TW, S.TOPP[0] - 4], [0, S.TOPP[1] + 2, TW, TH], [0, 0, 1180, TH], [1640, 0, TW, TH]);
    o.push([TOPPSTUGA.x, TOPPSTUGA.y - 30, TOPPSTUGA.door.x0 - 1, TOPPSTUGA.y - 2], [TOPPSTUGA.door.x1 + 1, TOPPSTUGA.y - 30, TOPPSTUGA.x + TOPPSTUGA.w, TOPPSTUGA.y - 2]);
    o.push([TOPPSKYLT.x - 6, TOPPSKYLT.y - 4, TOPPSKYLT.x + 6, TOPPSKYLT.y + 1]);
    for (const g of GRANAR) if (g.y < 200) o.push([g.x - 4, g.y - 3, g.x + 5, g.y + 2]);
    return o;
  }
  o.push([0, 0, TW, S.DAL[0] - 6]);
  for (const H of [VARMESTUGA, UTHYRNING]) o.push([H.x, H.y - 30, H.door.x0 - 1, H.y - 2], [H.door.x1 + 1, H.y - 30, H.x + H.w, H.y - 2]);
  o.push([LIFT.x0 - 20, LIFT.y0 - 20, LIFT.x0 + 20, LIFT.y0 + 4]);
  o.push([SNOGUBBE.x - 8, SNOGUBBE.y - 6, SNOGUBBE.x + 8, SNOGUBBE.y + 1], [ELD.x - 12, ELD.y - 8, ELD.x + 12, ELD.y + 2]);
  for (const [x, y] of BANKAR) o.push([x - 15, y - 4, x + 16, y + 1]);
  for (const g of GRANAR) if (g.y > S.DAL[0]) o.push([g.x - 4, g.y - 3, g.x + 5, g.y + 2]);
  o.push([SKYLT.x - 8, SKYLT.y - 3, SKYLT.x + 8, SKYLT.y + 1]);
  return o;
}

// ---------------------------------------------------------------- fjällen bakom (parallax)
const BACK = new Map();
export function fjallCanvas(night) {
  if (BACK.has(night)) return BACK.get(night);
  const w = 1200, h = 140, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.5), 0x101634, 0.4) : c);
  for (let x = 0; x < w; x++) {
    const h1 = 70 + Math.round(Math.sin(x / 110) * 26 + Math.sin(x / 41 + 2) * 10), h2 = 44 + Math.round(Math.sin(x / 70 + 1) * 16 + Math.sin(x / 23) * 5);
    for (let y = h - h1; y < h; y++) { const u = (y - (h - h1)) / h1; P.px(x, y, N(u < 0.18 ? mix(0xf8fbff, 0xe0ecf8, u / 0.18) : mix(0x8aa0c0, 0x5a6e90, u))); }
    for (let y = h - h2; y < h; y++) { const u = (y - (h - h2)) / h2; P.px(x, y, N(u < 0.25 ? 0xf4f8fc : mix(0x6a84a8, 0x3e5478, u) )); if (u > 0.4 && hash(x >> 2, y >> 2, 7) > 0.8) P.px(x, y, N(0x2e4a3a)); }
  }
  const cv = P.flush(); BACK.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
const vnoise = (x, y, s, cell) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
const SNO = [0xc8d8ec, 0xdce8f4, 0xeef4fa, 0xf8fbff];
export function paintGround() {
  const P = new Pix(TW, TH);
  // snön: ljus med blå skuggor i svackorna, glitter
  for (let y = S.TOPP[0] - 10; y < TH; y++) for (let x = 0; x < TW; x++) {
    const n = vnoise(x, y, 3, 60), k = Math.round(1.6 + (n - 0.5) * 2.2 + (hash(x >> 1, y >> 1, 4) - 0.5) * 0.6 + (bayer(x, y) - 0.5) * 0.5);
    let c = SNO[Math.min(3, Math.max(0, k))];
    if (hash(x, y, 5) > 0.985) c = 0xffffff;
    P.px(x, y, c);
  }
  // slalombacken: pistad i ränder (fräsens spår), kanterna mjuka
  for (let y = S.TOPP[1] - 10; y < S.DAL[0]; y++) for (let x = SLALOM.x0; x < SLALOM.x1; x++) { const edge = Math.min(x - SLALOM.x0, SLALOM.x1 - 1 - x); if (edge < 10 && hash(x, y, 6) > edge / 10) continue; P.px(x, y, (x % 6 === 0) ? 0xd0dcea : (x % 6 === 3 ? 0xf4f8fc : 0xe4eef8)); }
  // pulkabacken: nedåkta spår, guppen som ljusa kullar med skugga under
  for (let y = S.TOPP[1] - 10; y < S.DAL[0]; y++) for (let x = PULKA.x0; x < PULKA.x1; x++) { const edge = Math.min(x - PULKA.x0, PULKA.x1 - 1 - x); if (edge < 14 && hash(x, y, 7) > edge / 14) continue; let c = mix(0xe6eef8, 0xd8e4f2, hash(x >> 2, y, 8) * 0.5); for (const gy of PULKA.gupp) { const d = (y - gy) / 10; if (d > -1 && d < 1) c = d < 0 ? mix(c, 0xffffff, 0.5 * (1 + d)) : mix(c, 0xa8bcd4, 0.5 * (1 - d)); } if ((x - PULKA.x0) % 60 < 3 || (x - PULKA.x0) % 60 > 56) c = mul(c, 0.9); P.px(x, y, c); }
  for (let k = 0; k < 10; k++) { const sx = PULKA.x0 + 40 + k * 40; for (let y = S.TOPP[1]; y < S.DAL[0]; y += 2) { const wob = Math.round(Math.sin(y / 20 + k) * 6); P.px(sx + wob, y, 0xc0d0e4); P.px(sx + wob + 4, y, 0xc0d0e4); } }   // pulkaspåren
  // liftgatan: trampad snö under linan
  for (let t = 0; t <= 1; t += 0.002) { const x = Math.round(LIFT.x0 + (LIFT.x1 - LIFT.x0) * t), y = Math.round(LIFT.y0 + (LIFT.y1 - LIFT.y0) * t); for (let i = -14; i <= 14; i++) P.px(x + i, y, mix(0xdce8f4, 0xc8d8ec, hash(x + i, y, 9) * 0.5)); }
  // dalen: trampad snö runt stugorna, en skottad gång till bussen, eldstadens svarta ring
  for (let y = S.DAL[0]; y < TH; y++) for (let x = 0; x < TW; x++) if (vnoise(x, y, 10, 40) > 0.6) P.px(x, y, mix(P.get(x, y), 0xd4dfec, 0.5));
  for (let y = S.DAL[0] + 20; y < S.DAL[0] + 40; y++) for (let x = 60; x < 1520; x++) P.px(x, y, mix(0xd0dcea, 0xc0ccdc, hash(x >> 2, y >> 1, 11) * 0.5));
  for (let a = 0; a < 40; a++) { const an = a / 40 * Math.PI * 2; P.px(Math.round(ELD.x + Math.cos(an) * 13), Math.round(ELD.y + Math.sin(an) * 6), 0x6a6a72); }
  for (let y = ELD.y - 4; y <= ELD.y + 4; y++) for (let x = ELD.x - 10; x <= ELD.x + 10; x++) if (Math.hypot((x - ELD.x) / 11, (y - ELD.y) / 5) < 1) P.px(x, y, mix(0x2a2a30, 0x4a4a52, hash(x, y, 12)));
  // toppen: en platt avsats, skidspår som leder till starterna
  for (let y = S.TOPP[0]; y < S.TOPP[1] + 6; y++) for (let x = 1180; x < 1640; x++) if (vnoise(x, y, 13, 30) > 0.5) P.px(x, y, mix(P.get(x, y), 0xd8e4f2, 0.6));
  for (let x = 1000; x < 1240; x++) { P.px(x, 140 + Math.round(Math.sin(x / 30) * 2), 0xc0d0e4); P.px(x, 143 + Math.round(Math.sin(x / 30) * 2), 0xc0d0e4); }
  for (let x = 520; x < 1180; x++) { P.px(x, 128 + Math.round(Math.sin(x / 40) * 3), 0xc0d0e4); P.px(x, 131 + Math.round(Math.sin(x / 40) * 3), 0xc0d0e4); }
  return P.flush();
}
export const OPPETTEXT = () => $t`Skidor ${SKID_HYRA} kr, pulka ${PULKA_HYRA} kr – liften är gratis`;
