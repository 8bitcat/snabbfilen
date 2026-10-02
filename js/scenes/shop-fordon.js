// GARAGET – garagelängan i förorten (🚗 GARAGEN, js/city/map.js) är en cykel- och mopedverkstad
// (Carl 2026-10-01: "köpa cykel, elsparkcykel och moppe"). Man går in genom den uppskjutna
// rullporten till vänster.
//
// Från vänster: rullporten (dagsljuset och förortsgatan utanför), hyllan med hjälmar och
// oljedunkar, den målade skylten GARAGET, verktygstavlan med nycklar, hammare och skruvmejslar
// och arbetsbänken med skruvstycket. På golvet: oljefatet och kompressorn, fordonen i rad med
// prislappar (game.js FORDON – begagnad herrcykel, stadscykel, elsparkcykel, racer, moppe),
// lyften där mekanikern Kenta skruvar på en röd moppe, och däckstapeln.
//
// Klick på ett fordon → köpdialogen: stor bild med DIG på fordonet, färgerna, farten och priset.
// Köper man åker man iväg på det direkt; har man det redan kan man måla om det (OMLACK kr) eller
// välja att åka på det. 🚲-knappen i HUD:en (rideHud/openRide nedan) växlar mellan att åka och gå.
//
// _debug-API för tools/fordon-test.mjs.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { FORDON, fordonOf, fmt, OMLACK, TRUCK_PRIS } from '../game.js';
import * as SND from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, WALK_SEQ } from './walkable.js';
import { drawVehicle, drawRide } from '../core/fordon-art.js';
import { openTruckKop } from '../core/foretag.js';   // 🚚 eget företag: foodtrucken säljs här
import { truckIcon } from '../jobs/jobb-truck.js';

const play = (n) => { try { SND.play(n); } catch { /* ljud är aldrig ett krav */ } };

// ================= mått och plan =================
const FW = 384, FH = 216, WALL_Y = 80;
const DOOR = { x0: 14, x1: 74, y0: 16 };
const SHELF = { x0: 84, x1: 118 };
const SIGN = { x0: 126, x1: 262, y0: 10, y1: 40 };
const PEG = { x0: 272, x1: 368, y0: 12, y1: 52 };
const BENCH = { x0: 286, x1: 376, top: 68 };
const LIFT = { x0: 300, x1: 364, y: 150 };
const DRUM = { x: 16, y: 150 };
const TIRES = { x: 368, y: 196 };
// fordonen på golvet (mitt, marklinje)
const SHOW = [
  { id: 'begcykel', x: 106, y: 126 },
  { id: 'stadscykel', x: 150, y: 126 },
  { id: 'elspark', x: 192, y: 126 },
  { id: 'racer', x: 234, y: 126 },
  { id: 'moppe', x: 254, y: 182 },
];
const KENTA = { skin: '#e0a97f', hair: '#6b4226', style: 'short', beard: 'stubble', hat: 'cap', cap: '#d9433b',
  top: 'tee', shirt: '#2d3a5c', accent: '#f0b429', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c' };
const KENTA_POS = { x: 300, y: 172 };
const SKYLT = { x: 74, y: 126 };   // griffeltavlan: FOODTRUCK TILL SALU
const KENTA_SAY = [
  'Hej! Kolla in fordonen – klicka på det du gillar. 🔧',
  'Med cykel kommer du fram nästan dubbelt så fort genom stan!',
  'Moppen är snabbast. Hjälmen ingår, så klart! 🛵',
  'Tryck på 🚲-knappen uppe till höger när du vill gå i stället.',
  'Den begagnade gnisslar lite, men den håller i hundra år.',
  'Elsparkcykeln är tyst som en mus. Perfekt i parken.',
  'Har du sett tavlan? Jag säljer en foodtruck – starta ett eget företag! 🚚',
];

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(FW, FH);
  // taket med lysrören
  P.rect(0, 0, FW, 8, 0x2a2a30); P.hl(0, 7, FW, 0x3a3a42);
  for (const x of [60, 190, 320]) { P.rect(x - 22, 3, 44, 3, 0xe8f4f0); P.hl(x - 22, 3, 44, 0xffffff); P.rect(x - 24, 2, 2, 5, 0x6a6a72); P.rect(x + 22, 2, 2, 5, 0x6a6a72); }
  // väggen: målade lättbetongblock med fogar, mörkare sockel
  for (let y = 8; y < WALL_Y; y++) for (let x = 0; x < FW; x++) {
    const row = (y - 8) >> 3, bx = (x + (row & 1) * 8) % 16, fog = (y - 8) % 8 === 7 || bx === 15;
    const sockel = y >= WALL_Y - 16;
    const base = sockel ? 0x56685e : 0x93a597;
    const v = 0.94 + hash(x >> 1, y >> 1, 3) * 0.08 - (y - 8) * 0.0012;
    P.px(x, y, fog ? mul(base, 0.82) : mul(base, v));
  }
  P.hl(0, WALL_Y - 17, FW, 0x7a8a80);
  // ljuset från lysrören på väggen
  for (const x of [60, 190, 320]) for (let y = 8; y < 40; y++) for (let i = -40; i <= 40; i++) { const k = 1 - Math.hypot(i / 40, (y - 8) / 32); if (k > 0 && bayer(x + i, y) < k * 0.5) P.px(x + i, y, 0xffffff, 0.08); }
  // ---- rullporten: uppskjuten, dagsljus och förortsgatan utanför
  for (let y = DOOR.y0; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) {
    const u = (y - DOOR.y0) / (WALL_Y - DOOR.y0);
    let c = u < 0.55 ? mix(0x8ac8f0, 0xcfe8f8, u / 0.55) : u < 0.62 ? 0x6a7a6a : mix(0x5a5a60, 0x6e6e74, (u - 0.62) / 0.38);
    if (u >= 0.55 && u < 0.62 && (x % 6 === 0)) c = 0x4a5a4a;                 // staketet över gatan
    if (u > 0.8 && (x - DOOR.x0) % 14 < 6 && y === WALL_Y - 6) c = 0xe8e8e0;    // vägmarkering
    P.px(x, y, c);
  }
  for (let x = DOOR.x0 + 4; x < DOOR.x1 - 4; x += 18) { P.rect(x, DOOR.y0 + 20, 10, 6, 0x6a8a5a); P.rect(x + 2, DOOR.y0 + 16, 6, 4, 0x7a9a6a); }   // buskar
  P.rect(DOOR.x0 - 3, DOOR.y0 - 6, DOOR.x1 - DOOR.x0 + 6, 8, 0x8a929c);         // rullen (porten uppskjuten)
  for (let x = DOOR.x0 - 3; x < DOOR.x1 + 3; x++) { P.px(x, DOOR.y0 - 6, 0xb8c0ca); if (x % 3 === 0) P.vl(x, DOOR.y0 - 5, 6, 0x6a727c); }
  P.rect(DOOR.x0 - 3, DOOR.y0, 3, WALL_Y - DOOR.y0, 0x5a626c); P.rect(DOOR.x1, DOOR.y0, 3, WALL_Y - DOOR.y0, 0x5a626c);
  P.rect(DOOR.x0, WALL_Y - 2, DOOR.x1 - DOOR.x0, 2, 0xc8b040);                   // gula tröskeln
  for (let x = DOOR.x0; x < DOOR.x1; x += 6) P.rect(x, WALL_Y - 2, 3, 2, 0x2a2a2a);
  // ---- hyllan: hjälmar och oljedunkar
  for (const y of [30, 50]) { P.rect(SHELF.x0, y, SHELF.x1 - SHELF.x0, 2, 0x8a6a40); P.hl(SHELF.x0, y, SHELF.x1 - SHELF.x0, 0xb08a58); P.vl(SHELF.x0 + 2, y + 2, 3, 0x5a4a30); P.vl(SHELF.x1 - 3, y + 2, 3, 0x5a4a30); }
  [[88, 0xd9433b], [100, 0xf4f1ea], [112, 0x3a7bd5]].forEach(([x, c]) => {         // hjälmarna
    for (let j = 0; j < 7; j++) for (let i = -5; i <= 5; i++) { const k = Math.hypot(i / 5.5, (6 - j) / 7); if (k <= 1) P.px(x + i, 23 + j, k > 0.82 ? mul(c, 0.6) : (i < -1 && j < 4 ? mix(c, 0xffffff, 0.4) : c)); }
    P.rect(x + 1, 27, 4, 2, 0x2a3a4e);
  });
  [[86, 0x2a6ab8], [93, 0xe0a02a], [100, 0x3a8a4a], [107, 0xd9433b]].forEach(([x, c], i) => {   // oljedunkarna
    P.rect(x, 40, 6, 10, c); P.vl(x, 40, 10, mix(c, 0xffffff, 0.35)); P.vl(x + 5, 40, 10, mul(c, 0.65)); P.rect(x + 4, 38, 2, 2, 0x2a2a2a); P.rect(x + 1, 44, 4, 3, 0xf4f1ea); P.px(x + 2, 45, mul(c, 0.7));
    if (i === 1) P.px(x + 1, 39, 0xffd23f);
  });
  // ---- skylten GARAGET (handmålad på plåt)
  P.rect(SIGN.x0, SIGN.y0, SIGN.x1 - SIGN.x0, SIGN.y1 - SIGN.y0, 0xf0c838);
  P.box(SIGN.x0, SIGN.y0, SIGN.x1 - SIGN.x0, SIGN.y1 - SIGN.y0, 0x2a2a2a);
  for (let x = SIGN.x0 + 1; x < SIGN.x1 - 1; x++) for (let y = SIGN.y0 + 1; y < SIGN.y1 - 1; y++) if (hash(x, y, 9) > 0.93) P.px(x, y, 0xd8b028);
  for (const [x, y] of [[SIGN.x0 + 3, SIGN.y0 + 3], [SIGN.x1 - 4, SIGN.y0 + 3], [SIGN.x0 + 3, SIGN.y1 - 4], [SIGN.x1 - 4, SIGN.y1 - 4]]) P.px(x, y, 0x6a6a6a);
  const title = 'GARAGET', tw = textW(BIG, title, 2);
  text(P, BIG, title, Math.round((SIGN.x0 + SIGN.x1 - tw) / 2) + 1, SIGN.y0 + 6, 0x8a6a10, 1, 2);
  text(P, BIG, title, Math.round((SIGN.x0 + SIGN.x1 - tw) / 2), SIGN.y0 + 5, 0x1a1a1a, 1, 2);
  const sub = 'CYKLAR - SPARKCYKLAR - MOPEDER', sw = textW(SMALL, sub);
  text(P, SMALL, sub, Math.round((SIGN.x0 + SIGN.x1 - sw) / 2), SIGN.y1 - 9, 0xb83a2a);
  // ---- verktygstavlan (perforerad masonit med verktygens konturer)
  P.rect(PEG.x0, PEG.y0, PEG.x1 - PEG.x0, PEG.y1 - PEG.y0, 0xb08a5a);
  P.box(PEG.x0, PEG.y0, PEG.x1 - PEG.x0, PEG.y1 - PEG.y0, 0x6a4a2a);
  for (let y = PEG.y0 + 3; y < PEG.y1 - 2; y += 4) for (let x = PEG.x0 + 3; x < PEG.x1 - 2; x += 4) P.px(x, y, 0x7a5a32);
  // nycklar i storleksordning
  for (let k = 0; k < 6; k++) {
    const x = PEG.x0 + 6 + k * 5, len = 10 + k * 2, y = PEG.y0 + 4;
    P.vl(x, y + 3, len - 3, 0xa8b0ba); P.vl(x + 1, y + 3, len - 3, 0x7a828c);
    P.rect(x - 1, y, 4, 3, 0xa8b0ba); P.px(x, y, 0xb08a5a); P.px(x + 1, y + 1, 0xb08a5a);
    P.rect(x - 1, y + len, 4, 2, 0xa8b0ba);
  }
  // hammaren, skruvmejslarna, tången
  P.rect(PEG.x0 + 42, PEG.y0 + 6, 3, 18, 0x9a6a3a); P.rect(PEG.x0 + 38, PEG.y0 + 4, 11, 4, 0x5a5e66); P.hl(PEG.x0 + 38, PEG.y0 + 4, 11, 0x8a8e96);
  [[0xd9433b, 0], [0xf0b429, 6], [0x3a7bd5, 12]].forEach(([c, dx]) => { const x = PEG.x0 + 56 + dx; P.rect(x, PEG.y0 + 5, 3, 7, c); P.vl(x, PEG.y0 + 5, 7, mix(c, 0xffffff, 0.4)); P.vl(x + 1, PEG.y0 + 12, 9, 0xb8c0ca); });
  const tx = PEG.x0 + 78;
  P.line(tx, PEG.y0 + 6, tx + 4, PEG.y0 + 16, 0x5a5e66); P.line(tx + 6, PEG.y0 + 6, tx + 2, PEG.y0 + 16, 0x5a5e66);
  P.line(tx + 4, PEG.y0 + 16, tx + 3, PEG.y0 + 26, 0xd9433b); P.line(tx + 2, PEG.y0 + 16, tx + 1, PEG.y0 + 26, 0xd9433b);
  // en kalender från mopedklubben
  P.rect(PEG.x0 + 4, PEG.y0 + 30, 26, 18, 0xf4f1ea); P.rect(PEG.x0 + 4, PEG.y0 + 30, 26, 8, 0x3a7bd5);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 5; i++) P.rect(PEG.x0 + 6 + i * 5, PEG.y0 + 40 + j * 4, 3, 2, i === 3 && j === 0 ? 0xd9433b : 0xb8b8b8);
  P.rect(PEG.x0 + 10, PEG.y0 + 32, 14, 4, 0xe0a02a); P.px(PEG.x0 + 11, PEG.y0 + 36, 0x1a1a1a); P.px(PEG.x0 + 22, PEG.y0 + 36, 0x1a1a1a);
  // klockan
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = Math.hypot(i, j); if (d <= 5.4) P.px(PEG.x0 + 48 + i, PEG.y0 + 40 + j, d > 4.4 ? 0x2a2a2a : 0xf4f1ea); }
  P.vl(PEG.x0 + 48, PEG.y0 + 36, 4, 0x1a1a1a); P.hl(PEG.x0 + 48, PEG.y0 + 40, 3, 0x1a1a1a);
  // ---- arbetsbänken med skruvstycket, verktygslådan och lampan
  P.rect(BENCH.x0, BENCH.top, BENCH.x1 - BENCH.x0, 4, 0x8a5a30); P.hl(BENCH.x0, BENCH.top, BENCH.x1 - BENCH.x0, 0xb07a48);
  P.rect(BENCH.x0, BENCH.top + 4, BENCH.x1 - BENCH.x0, WALL_Y + 6 - BENCH.top - 4, 0x5a4a3a);
  for (let x = BENCH.x0 + 4; x < BENCH.x1 - 4; x += 22) { P.rect(x, BENCH.top + 6, 18, 6, 0x6a5a48); P.hl(x, BENCH.top + 6, 18, 0x7a6a58); P.rect(x + 7, BENCH.top + 8, 4, 1, 0xb8c0ca); }
  P.rect(BENCH.x0 + 6, BENCH.top - 6, 10, 6, 0x4a5a6a); P.rect(BENCH.x0 + 4, BENCH.top - 8, 14, 2, 0x5a6a7a); P.rect(BENCH.x0 + 16, BENCH.top - 5, 6, 2, 0x8a929c);
  P.rect(BENCH.x0 + 40, BENCH.top - 9, 18, 9, 0xc83a32); P.hl(BENCH.x0 + 40, BENCH.top - 9, 18, 0xe86a5a); P.rect(BENCH.x0 + 46, BENCH.top - 11, 6, 2, 0x2a2a2a); P.hl(BENCH.x0 + 40, BENCH.top - 5, 18, 0x8a2a24);
  P.line(BENCH.x1 - 12, BENCH.top, BENCH.x1 - 16, BENCH.top - 14, 0x3a3a42); P.line(BENCH.x1 - 16, BENCH.top - 14, BENCH.x1 - 8, BENCH.top - 20, 0x3a3a42);
  P.rect(BENCH.x1 - 10, BENCH.top - 22, 7, 4, 0x3a7a5a); P.hl(BENCH.x1 - 9, BENCH.top - 18, 5, 0xfff0b0);
  // ---- golvet: betong med fogar, oljefläckar och en gul linje runt verkstaden
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    const v = 0.93 + hash(x, y, 5) * 0.07 + (y - WALL_Y) * 0.0004;
    let c = mul(0x9a9a94, v);
    if ((x % 96 === 0) || ((y - WALL_Y) % 46 === 45)) c = mul(c, 0.86);
    P.px(x, y, c);
  }
  for (const [ox, oy, r] of [[60, 168, 9], [196, 150, 6], [330, 196, 11], [120, 200, 5], [292, 116, 7]]) P.ell(ox, oy, r, r * 0.45, 0x2a2a30, 0.45);
  for (let y = 100; y < FH; y++) if ((y >> 2) % 2 === 0) P.px(288, y, 0xe0b830);   // gul streckad linje
  P.rect(176, 196, 14, 8, 0x5a5a5e); for (let x = 177; x < 189; x += 2) P.vl(x, 197, 6, 0x3a3a3e);   // golvbrunnen
  // ---- lyften (plattform) – mopeden och Kenta ritas ovanpå
  P.rect(LIFT.x0, LIFT.y - 6, LIFT.x1 - LIFT.x0, 6, 0xc83a32); P.hl(LIFT.x0, LIFT.y - 6, LIFT.x1 - LIFT.x0, 0xe86a5a); P.hl(LIFT.x0, LIFT.y - 1, LIFT.x1 - LIFT.x0, 0x8a2a24);
  for (let x = LIFT.x0 + 2; x < LIFT.x1 - 2; x += 5) P.px(x, LIFT.y - 4, 0x8a2a24);
  P.rect(LIFT.x0 + 8, LIFT.y, 6, 3, 0x5a5a5e); P.rect(LIFT.x1 - 14, LIFT.y, 6, 3, 0x5a5a5e);
  P.ell((LIFT.x0 + LIFT.x1) / 2, LIFT.y + 3, 34, 4, 0x1a1a20, 0.3);
  return P.flush();
}
// oljefatet, kompressorn och däckstapeln (står på golvet – sorteras med figurerna)
function drawDrum(ctx) {
  const { x, y } = DRUM;
  ctx.fillStyle = 'rgba(20,12,28,.25)'; ctx.fillRect(x - 1, y - 1, 16, 3);
  ctx.fillStyle = '#2a6ab8'; ctx.fillRect(x, y - 22, 14, 22);
  ctx.fillStyle = '#5a9ae0'; ctx.fillRect(x, y - 22, 3, 22);
  ctx.fillStyle = '#1a4a8a'; ctx.fillRect(x + 11, y - 22, 3, 22); ctx.fillRect(x, y - 15, 14, 1); ctx.fillRect(x, y - 7, 14, 1);
  ctx.fillStyle = '#3a7ac8'; ctx.fillRect(x, y - 24, 14, 2);
  ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x + 9, y - 24, 3, 1);
  // kompressorn bredvid
  ctx.fillStyle = 'rgba(20,12,28,.25)'; ctx.fillRect(x + 18, y - 1, 16, 2);
  ctx.fillStyle = '#c83a32'; ctx.fillRect(x + 18, y - 10, 16, 8);
  ctx.fillStyle = '#e86a5a'; ctx.fillRect(x + 18, y - 10, 16, 1);
  ctx.fillStyle = '#3a3a42'; ctx.fillRect(x + 20, y - 15, 6, 5); ctx.fillRect(x + 19, y - 2, 3, 2); ctx.fillRect(x + 30, y - 2, 3, 2);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 28, y - 14, 4, 4); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 30, y - 13, 1, 2);
  ctx.fillStyle = '#e8c838'; for (let k = 0; k < 7; k++) ctx.fillRect(x + 34 + k, y - 6 + (k & 1), 1, 1);   // slangen
}
// griffeltavlan vid porten: en liten truck i krita, rätterna och priset (SÅLD när man köpt den)
function drawSkylt(ctx, sald) {
  const { x, y } = SKYLT;
  ctx.fillStyle = 'rgba(20,12,28,.25)'; ctx.fillRect(x - 12, y - 1, 24, 3);
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 11, y - 26, 2, 26); ctx.fillRect(x + 9, y - 26, 2, 26);
  ctx.fillStyle = '#26342a'; ctx.fillRect(x - 10, y - 27, 20, 20); ctx.fillStyle = '#8a6a3e'; ctx.fillRect(x - 11, y - 28, 22, 1); ctx.fillRect(x - 11, y - 7, 22, 1);
  ctx.fillStyle = '#e8e4d8'; ctx.fillRect(x - 7, y - 23, 10, 6); ctx.fillRect(x + 3, y - 21, 4, 4);
  ctx.fillStyle = '#26342a'; ctx.fillRect(x - 6, y - 22, 6, 3);
  ctx.fillStyle = '#e8e4d8'; ctx.fillRect(x - 6, y - 16, 2, 2); ctx.fillRect(x + 3, y - 16, 2, 2);
  ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(truckIcon('korv'), 0, 0, 12, 12, x - 9, y - 14, 7, 7); ctx.drawImage(truckIcon('dricka'), 0, 0, 12, 12, x + 2, y - 14, 7, 7); ctx.restore();
  if (sald) { ctx.save(); ctx.translate(x, y - 17); ctx.rotate(-0.4); ctx.fillStyle = '#d9433b'; ctx.fillRect(-11, -3, 22, 6); ctx.restore(); ctxText(ctx, SMALL, 'SÅLD', x - 8, y - 20, '#f4f1ea'); return; }
  // prislappen som på fordonen
  const lbl = String(TRUCK_PRIS), w = textW(SMALL, lbl) + 6, lx = Math.round(x - w / 2), ly = y + 5;
  ctx.fillStyle = '#f0d048'; ctx.fillRect(lx, ly, w, 9); ctx.fillStyle = '#8a6a2a'; ctx.fillRect(lx, ly + 8, w, 1);
  ctxText(ctx, SMALL, lbl, lx + 3, ly + 2, '#3a2a10');
}
function drawTires(ctx) {
  const { x, y } = TIRES;
  ctx.fillStyle = 'rgba(20,12,28,.25)'; ctx.fillRect(x - 12, y - 1, 24, 3);
  for (let k = 0; k < 4; k++) {
    const ty = y - 7 - k * 7;
    ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 11, ty, 22, 7);
    ctx.fillStyle = '#3e3b44'; ctx.fillRect(x - 11, ty, 22, 1); for (let i = -10; i < 11; i += 3) ctx.fillRect(x + i, ty + 2, 1, 4);
    ctx.fillStyle = '#0e0e12'; ctx.fillRect(x - 5, ty + 1, 10, 1);
  }
}

// ================= scenen =================
export function makeShopFordon(A) {
  const g = A.game;
  if (!BG) BG = paintBg();
  const walker = createWalker({ W: FW, H: FH, left: 6, right: FW - 6, top: WALL_Y + 6, bottom: FH - 4, spawn: [44, WALL_Y + 12] });
  const obst = SHOW.map((s) => [s.x - 17, s.y - 6, s.x + 17, s.y + 2]);
  obst.push([SKYLT.x - 11, SKYLT.y - 4, SKYLT.x + 11, SKYLT.y + 1], [BENCH.x0, WALL_Y, BENCH.x1, WALL_Y + 6], [LIFT.x0, LIFT.y - 8, LIFT.x1, LIFT.y + 2], [DRUM.x - 1, DRUM.y - 6, DRUM.x + 36, DRUM.y + 1], [TIRES.x - 12, TIRES.y - 6, TIRES.x + 12, TIRES.y + 1]);
  walker.setObstacles(obst); walker.snapFree();
  walker.speed = 64;
  let t = 0, hover = null, kentaLook = 'right', greeted = false;
  const talkK = createSpeech(), talkMe = createSpeech();
  const kSay = (s, secs) => talkK.say(s, () => ({ x: KENTA_POS.x, y: KENTA_POS.y - 44 }), secs, { voice: KENTA });
  let sayIdx = 0, sayT = 6;

  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, DOOR.y0, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: 'UT', act: () => { play('door'); A.go('city'); } },
    ...SHOW.map((s) => ({ id: s.id, r: [s.x - 18, s.y - 34, s.x + 18, s.y + 12], go: [s.x, s.y + 12], label: fordonOf(s.id).name.toUpperCase(), act: () => openFordon(A, s.id) })),
    { id: 'kenta', r: [KENTA_POS.x - 9, KENTA_POS.y - 34, KENTA_POS.x + 9, KENTA_POS.y + 2], go: [KENTA_POS.x - 14, KENTA_POS.y + 6], label: 'KENTA', act: () => { kentaLook = 'left'; kSay(KENTA_SAY[sayIdx++ % KENTA_SAY.length], 4); } },
    { id: 'foodtruck', r: [SKYLT.x - 13, SKYLT.y - 28, SKYLT.x + 13, SKYLT.y + 2], go: [SKYLT.x, SKYLT.y + 10], label: g.truck ? 'DIN FOODTRUCK' : 'FOODTRUCK TILL SALU', act: () => openTruckKop(A) },
    { id: 'hjalmar', r: [SHELF.x0, 18, SHELF.x1, 56], go: [(SHELF.x0 + SHELF.x1) / 2, WALL_Y + 10], label: 'HJÄLMAR', act: () => kSay('Hjälmarna? En följer med moppen – säkerheten först! ⛑️', 4) },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);

  function drawShow(ctx, s) {
    const F = fordonOf(s.id), own = g.hasFordon(s.id), c = own ? g.fordonFarg(s.id) : F.colors[0];
    // en gummimatta under, fordonet, prislappen på en liten skylt
    ctx.fillStyle = 'rgba(40,40,46,.35)'; ctx.fillRect(s.x - 18, s.y - 3, 36, 6);
    drawVehicle(ctx, s.id, s.x, s.y, 'right', c, 0);
    const lbl = own ? 'DIN' : String(F.price), w = textW(SMALL, lbl) + 6, lx = Math.round(s.x - w / 2), ly = s.y + 5;
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(s.x, ly - 2, 1, 2);
    ctx.fillStyle = own ? '#46a35a' : '#f0d048'; ctx.fillRect(lx, ly, w, 9);
    ctx.fillStyle = own ? '#2a6a3a' : '#8a6a2a'; ctx.fillRect(lx, ly + 8, w, 1);
    ctxText(ctx, SMALL, lbl, lx + 3, ly + 2, own ? '#f4f1ea' : '#3a2a10');
  }
  function drawKenta(ctx) {
    // Kenta skruvar på den röda moppen på lyften (vänder sig mot en när man kommer nära)
    drawVehicle(ctx, 'moppe', (LIFT.x0 + LIFT.x1) / 2 + 6, LIFT.y - 6, 'left', '#d9433b', 0);
    const near = Math.hypot(walker.px - KENTA_POS.x, walker.py - KENTA_POS.y) < 70;
    const dir = near ? 'left' : kentaLook === 'left' && talkK.active() ? 'left' : 'up';
    const frame = !near && Math.floor(t * 2) % 2 ? 4 : 0;
    drawPerson(ctx, KENTA_POS.x, KENTA_POS.y, KENTA, dir, frame);
    if (!near && Math.floor(t * 2) % 2) { ctx.fillStyle = '#b8c0ca'; ctx.fillRect(KENTA_POS.x + 4, KENTA_POS.y - 24, 4, 1); ctx.fillStyle = '#fff6c0'; if (Math.floor(t * 6) % 3 === 0) ctx.fillRect(KENTA_POS.x + 8, KENTA_POS.y - 25, 1, 1); }
  }
  function label(ctx) {
    const s = hover && spotAt(hover.x, hover.y);
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(2, Math.min(FW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22);
    ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      t += dt; walker.update(dt);
      const near = Math.hypot(walker.px - KENTA_POS.x, walker.py - KENTA_POS.y) < 70;
      if (!greeted && t > 0.8) { greeted = true; kSay(g.fordon.length ? 'Välkommen tillbaka! Allt rullar som det ska? 🔧' : KENTA_SAY[0], 4); }
      if (near && !talkK.active()) { sayT -= dt; if (sayT <= 0) { sayT = 9; kSay(KENTA_SAY[1 + (sayIdx++ % (KENTA_SAY.length - 1))], 4); } }
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, 0, 0);
      const items = SHOW.map((s) => ({ fy: s.y, draw: () => drawShow(ctx, s) }));
      items.push({ fy: KENTA_POS.y, draw: () => drawKenta(ctx) });
      items.push({ fy: DRUM.y, draw: () => drawDrum(ctx) }, { fy: TIRES.y, draw: () => drawTires(ctx) }, { fy: SKYLT.y, draw: () => drawSkylt(ctx, !!g.truck) });
      items.push(...folkDrawables(A, t), selfDrawable(A, walker, t));
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      talkK.draw(ctx); talkMe.draw(ctx);
      label(ctx);
    },
    down(x, y) {
      hover = { x, y };
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(x, y) { hover = { x, y }; },
    exit() { talkK.clear(); talkMe.clear(); },
    _debug: {
      spot: (id) => { const s = spots().find((q) => q.id === id); return s ? { x: Math.round((s.r[0] + s.r[2]) / 2), y: Math.round((s.r[1] + s.r[3]) / 2) } : null; },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      kenta: () => talkK.text(),
    },
  };
}

// ================= köpdialogen =================
// Stor bild med DIG på fordonet (från sidan, på rutigt golv), färgrutorna, farten och priset.
export function openFordon(A, id) {
  const g = A.game, F = fordonOf(id);
  if (!F) return;
  play('click');
  let col = g.hasFordon(id) ? g.fordonFarg(id) : F.colors[0];
  const draw = () => {
    const own = g.hasFordon(id), aker = g.akerMed === id;
    const swatches = F.colors.map((c) => `<button class="fd-sw${c === col ? ' on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
    const info = `<p style="font-size:var(--f2);margin:0 0 6px">${esc(F.blurb)}</p>
      <p style="font-size:var(--f1);margin:0">⚡ <b>${F.fart.toLocaleString('sv-SE')} × så fort</b> som att gå · 💰 Du har <b>${fmt(g.money)}</b>${own ? ` · ✅ <b>Din!</b>${aker ? ' Du åker på den.' : ''}` : ` · Pris <b>${fmt(F.price)}</b>`}</p>`;
    const btns = [];
    if (!own) btns.push({ label: `🛒 Köp · ${fmt(F.price)}`, cls: 'btn-go', onClick: () => {
      const r = g.buyFordon(id, col);
      if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      play('ok'); rideHud(A, true);
      toast(`${F.icon} Grattis till ${F.den}! Du åker på den när du går ut – 🚲-knappen uppe till höger växlar mellan att åka och gå.${r.glad ? ` +${r.glad} 😊` : ''}`, 'good');
      draw();
    } });
    else {
      if (col !== g.fordonFarg(id)) btns.push({ label: `🎨 Måla om · ${fmt(OMLACK)}`, cls: 'btn-gold', onClick: () => { const r = g.paintFordon(id, col); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); toast('🎨 Nymålad och fin!', 'good'); draw(); } });
      if (!aker) btns.push({ label: `${F.icon} Åk på den`, cls: 'btn-go', onClick: () => { g.setAker(id); rideHud(A, true); A.scene?.rideChanged?.(); play('ok'); toast(`${F.icon} Du åker ${F.den} när du går ut.`, 'good'); draw(); } });
    }
    btns.push({ label: 'Stäng', onClick: closeModal });
    const dlg = openModal(`${F.icon} ${F.name}`, `<div class="fd"><canvas class="fd-big" width="96" height="56"></canvas>
      <div class="fd-side"><span class="fb-lbl">Färg</span><div class="fd-sws">${swatches}</div></div></div>${info}`, btns);
    const cv = dlg.querySelector('.fd-big'), c = cv.getContext('2d');
    // rutigt golv och du på fordonet
    for (let y = 0; y < 56; y += 8) for (let x = 0; x < 96; x += 8) { c.fillStyle = ((x + y) >> 3) & 1 ? '#e8e4da' : '#f4f1ea'; c.fillRect(x, y, 8, 8); }
    c.fillStyle = '#b8b2a4'; c.fillRect(0, 50, 96, 1);
    drawRide(c, id, 46, 50, 'right', 0, false, A.avatar.look, col);
    dlg.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { col = b.dataset.c; play('click'); draw(); }));
  };
  draw();
}

// ================= 🚲-knappen i HUD:en =================
// Syns när man har ett fordon. Ikonen = det man åker på (🚶 = går). Ett fordon: tryck = växla
// mellan att åka och gå. Flera: välj i en liten ruta.
let hudKey = '';
export function rideHud(A, force = false) {
  const b = typeof document !== 'undefined' && document.getElementById('hud-fordon');
  if (!b) return;
  const g = A.game, own = g.ownedFordon(), F = g.aker;
  const key = `${own.length}|${F?.id || ''}`;
  if (key === hudKey && !force) return;
  hudKey = key;
  b.classList.toggle('hidden', !own.length);
  b.textContent = F ? F.icon : '🚶';
  b.title = F ? `Du åker ${F.den} – tryck för att gå` : 'Du går – tryck för att åka';
}
export function openRide(A) {
  const g = A.game, own = g.ownedFordon();
  if (!own.length) { toast('🚲 Köp en cykel, elsparkcykel eller moppe i GARAGET i förorten!'); return; }
  const set = (id) => {
    g.setAker(id);
    rideHud(A, true);
    A.scene?.rideChanged?.();
    play('click');
    const F = g.aker;
    toast(F ? `${F.icon} Du tar ${F.den} – ${F.fart.toLocaleString('sv-SE')} × så fort genom stan!` : '🚶 Du går. (Fordonet står parkerat tills du vill åka igen.)', 'good');
  };
  if (own.length === 1) { set(g.akerMed ? null : own[0].id); return; }
  const rows = own.map((F) => `<button class="btn ${g.akerMed === F.id ? 'btn-gold' : 'btn-go'}" data-f="${F.id}" style="display:block;width:100%;margin:4px 0">${F.icon} ${esc(F.name)} · ${F.fart.toLocaleString('sv-SE')} ×${g.akerMed === F.id ? ' (nu)' : ''}</button>`).join('');
  const dlg = openModal('🚲 Åka eller gå?', `<p style="font-size:var(--f2);margin-top:0">Vad vill du ta genom stan?</p>${rows}
    <button class="btn" data-f="" style="display:block;width:100%;margin:4px 0">🚶 Gå${g.akerMed ? '' : ' (nu)'}</button>`, [{ label: 'Stäng', onClick: closeModal }]);
  dlg.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { closeModal(); set(b.dataset.f || null); }));
}
