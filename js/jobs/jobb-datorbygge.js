// PIXEL DATA – bygg datorerna precis som beställningen säger (jobbet 'datorbygge', kräver examen
// i Datorteknik från Pixelhögskolan). Verkstaden ses framifrån:
//
//   VÄNSTER HYLLA   processorer (PX3, PX5, PX7) och minnen (8, 16, 32 GB) i lådor med etiketter
//   ARBETSBÄNKEN    datorlådan står på bänken med sidan av – moderkortet syns med sockeln,
//                   minnesplatserna, grafikkortsplatsen, M.2-platsen och nätaggregatsfacket.
//                   Kylpastan och kylaren ligger bredvid. Ovanför hänger ORDERSKÄRMEN.
//   HÖGER HYLLA     grafikkort (RX 60, RX 80), SSD-diskar (500 GB, 1 TB) och nätaggregat (450 W, 750 W)
//
// Klicka på en låda → figuren går dit och tar delen → klicka på datorlådan → figuren sätter i den.
// Rätt modell = rätt (+lön), fel modell = fel (delen åker tillbaka). Kylaren kräver processor och
// kylpasta först. När allt i ordern sitter i: tryck på STARTKNAPPEN → fläktarna snurrar, skärmen
// säger BIOS OK och kollegan bär iväg datorn (stats.boxes = färdiga datorer, JOBS.bonus per dator).
// Passet via shift.js som de andra jobben (60 s för en nybörjare, längre med vanan – planOf;
// nästa låda kommer när den förra är buren, så takten styrs av en själv). Escape = avbryt passet.
//
// JOBBA IHOP: flera kan dela passet (💼-inbjudan, js/net/coop.js). Man bygger SAMMA dator – en
// bänk, en låda och en orderskärm, som på bilden – och delar upp jobbet som man vill (en hämtar i
// hyllorna, en skruvar). Skiftledaren avgör allt som gäller lådan och ordern, medarbetarnas
// handlingar blir önskemål – se "jobba tillsammans" i makeJobbDatorbygge.
//
// _debug: state(), order(), bins() (id, x, y), spot(id) → { x, y } (skärm), pick(id) (ta delen
//   direkt), install() (sätt i det man bär), tool(id), power(), finish() (spola till slutet av
//   passet), stats – och för jobba ihop (tools/coop-datorbygge-test.mjs): coop(), lag(), title(),
//   held(), carrying(), setOrder(ix), standAt(id), teleport(x, y), toolTwice(id), handled(),
//   idle(), pops().
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { makeShiftCoop } from '../net/coop.js';
import { JOBS } from '../game.js';

const FW = 384, FH = 216;
const WALL_Y = 124;                          // golvet börjar
const BENCH = { x0: 134, x1: 250, top: 116, y: 138 };
const CASE = { x: 166, y: 50, w: 54, h: 66 }; // datorlådan på bänken (öppen sida mot oss)
const SCREEN = { x0: 140, x1: 244, y0: 20, y1: 46 };
const STAND = [238, 148];                    // där figuren står vid bänken (bredvid lådan – den ska synas)
const PALLET = { x0: 16, x1: 84, y: 204 };   // pallen med färdigpackade datorer
const CART = { x0: 300, x1: 352, y: 196 };  // vagnen med kartonger
const POWER = { x: CASE.x + CASE.w - 7, y: CASE.y + 4 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- delarna ----------
// kind = platsen i datorn, v = modellen/storleken (det ordern frågar efter)
const PARTS = [
  { id: 'cpu3', kind: 'cpu', v: 'PX3', label: 'PX3' },
  { id: 'cpu5', kind: 'cpu', v: 'PX5', label: 'PX5' },
  { id: 'cpu7', kind: 'cpu', v: 'PX7', label: 'PX7' },
  { id: 'ram8', kind: 'ram', v: '8 GB', label: '8GB' },
  { id: 'ram16', kind: 'ram', v: '16 GB', label: '16GB' },
  { id: 'ram32', kind: 'ram', v: '32 GB', label: '32GB' },
  { id: 'gpu6', kind: 'gpu', v: 'RX 60', label: 'RX60' },
  { id: 'gpu8', kind: 'gpu', v: 'RX 80', label: 'RX80' },
  { id: 'ssd5', kind: 'ssd', v: '500 GB', label: '500' },
  { id: 'ssd1', kind: 'ssd', v: '1 TB', label: '1TB' },
  { id: 'psu4', kind: 'psu', v: '450 W', label: '450W' },
  { id: 'psu7', kind: 'psu', v: '750 W', label: '750W' },
];
const partOf = (id) => PARTS.find((p) => p.id === id);
const KIND_NAME = { cpu: 'PROCESSOR', ram: 'MINNE', gpu: 'GRAFIKKORT', ssd: 'SSD', psu: 'NÄTAGGREGAT' };
// beställningarna (gpu: null = inget grafikkort)
const ORDERS = [
  { name: 'KONTOR', cpu: 'PX3', ram: '8 GB', gpu: null, ssd: '500 GB', psu: '450 W' },
  { name: 'SKOLDATOR', cpu: 'PX5', ram: '16 GB', gpu: null, ssd: '500 GB', psu: '450 W' },
  { name: 'GAMING', cpu: 'PX7', ram: '32 GB', gpu: 'RX 80', ssd: '1 TB', psu: '750 W' },
  { name: 'STREAMING', cpu: 'PX7', ram: '16 GB', gpu: 'RX 60', ssd: '1 TB', psu: '750 W' },
  { name: 'BUDGETSPEL', cpu: 'PX5', ram: '16 GB', gpu: 'RX 60', ssd: '500 GB', psu: '450 W' },
  { name: 'FILMKLIPP', cpu: 'PX7', ram: '32 GB', gpu: 'RX 60', ssd: '1 TB', psu: '750 W' },
];
// hyllorna: vänster CPU + RAM (2 rader × 3), höger GPU/SSD/PSU (3 rader × 2)
const BINS = [];
PARTS.slice(0, 3).forEach((p, i) => BINS.push({ id: p.id, x: 12 + i * 38, y: 36, w: 34 }));
PARTS.slice(3, 6).forEach((p, i) => BINS.push({ id: p.id, x: 12 + i * 38, y: 72, w: 34 }));
PARTS.slice(6, 8).forEach((p, i) => BINS.push({ id: p.id, x: 262 + i * 58, y: 30, w: 54 }));
PARTS.slice(8, 10).forEach((p, i) => BINS.push({ id: p.id, x: 262 + i * 58, y: 62, w: 54 }));
PARTS.slice(10, 12).forEach((p, i) => BINS.push({ id: p.id, x: 262 + i * 58, y: 94, w: 54 }));
const binOf = (id) => BINS.find((b) => b.id === id);
const binFront = (b) => [b.x + (b.w >> 1), WALL_Y + 12];

// ---------- delarnas bilder (skala 1) ----------
const SPR = {};
function spr(id) {
  if (SPR[id]) return SPR[id];
  let P;
  const p = partOf(id) || { kind: id };
  if (p.kind === 'cpu') {
    P = new Pix(10, 10);
    P.rect(0, 0, 10, 10, 0x2a6a3a); P.rect(1, 1, 8, 8, 0xc8ccd4); P.rect(2, 2, 6, 6, 0xe0e4ec); P.hl(2, 2, 6, 0xf4f6fa);
    for (let i = 0; i < 10; i += 2) { P.px(i, 0, 0xd8b050); P.px(i, 9, 0xd8b050); }
    P.px(1, 8, 0xd8b050);                                  // triangeln i hörnet
    text(P, SMALL, p.v === 'PX7' ? '7' : p.v === 'PX5' ? '5' : '3', 4, 3, p.v === 'PX7' ? 0xc83a3a : p.v === 'PX5' ? 0x3a7bd5 : 0x3a8a4a);
  } else if (p.kind === 'ram') {
    P = new Pix(4, 16);
    const hs = p.v === '32 GB' ? 0x2a2a34 : p.v === '16 GB' ? 0x3a3a44 : 0x2f7a3a;
    P.rect(0, 0, 4, 15, hs); P.vl(0, 0, 15, mul(hs, 1.4)); P.hl(0, 15, 4, 0xd8b050);
    if (p.v === '32 GB') { P.hl(0, 0, 4, 0xe84aa0); P.hl(0, 1, 4, 0x4ad8e8); }       // RGB-list
    else if (p.v === '16 GB') P.hl(0, 0, 4, 0xc83a3a);
    for (let j = 3; j < 13; j += 3) P.px(2, j, 0x1a1a20);
  } else if (p.kind === 'gpu') {
    const big = p.v === 'RX 80';
    P = new Pix(big ? 30 : 24, 9);
    const w = P.w;
    P.rect(0, 0, w, 7, big ? 0x1e1e24 : 0x5a5e68); P.hl(0, 0, w, big ? 0x4a4a54 : 0x8a8e98);
    if (big) P.hl(2, 3, w - 4, 0xc83a3a);
    P.rect(0, 7, w - 4, 2, 0x2a6a3a); for (let i = 2; i < w - 6; i += 2) P.px(i, 8, 0xd8b050);  // kontaktfingrarna
    P.rect(w - 2, 0, 2, 7, 0xa8acb4);                                                           // fästet
  } else if (p.kind === 'ssd') {
    const big = p.v === '1 TB';
    P = new Pix(14, 4);
    P.rect(0, 0, 14, 4, 0x2a6a3a); P.rect(2, 1, 4, 2, 0x1a1a20); P.rect(7, 1, 4, 2, 0x1a1a20); P.hl(0, 0, 14, 0x3a8a4a);
    P.rect(0, 1, 1, 2, 0xd8b050); if (big) P.px(12, 1, 0xf0c850);
  } else if (p.kind === 'psu') {
    const big = p.v === '750 W';
    P = new Pix(18, 12);
    P.rect(0, 0, 18, 12, big ? 0x1e1e24 : 0xa8acb4); P.box(0, 0, 18, 12, big ? 0x0e0e14 : 0x6a6e78);
    P.ell(9, 6, 4.5, 4.5, big ? 0x3a3a44 : 0x6a6e78, 1, 1);
    for (let i = 5; i < 14; i += 2) P.vl(i, 3, 6, big ? 0x5a5a64 : 0x4a4e58);
    P.rect(13, 2, 3, 2, big ? 0xf0c850 : 0x2a2a30);
  } else if (id === 'kylare') {
    P = new Pix(14, 16);
    for (let j = 0; j < 12; j++) P.hl(1, j, 12, j % 2 ? 0x8a8e98 : 0xc8ccd4);          // flänsarna
    P.rect(0, 2, 3, 9, 0x2a2a30); P.ell(1.5, 6.5, 1.5, 3.5, 0x4a4e58, 1, 1);           // fläkten på sidan
    P.rect(4, 12, 6, 4, 0x6a6e78); P.hl(4, 12, 6, 0xd8a050);                            // heatpipes + bottenplatta
  } else if (id === 'pasta') {
    P = new Pix(12, 5);
    P.rect(0, 1, 9, 3, 0xd8dce4); P.hl(0, 1, 9, 0xf4f6fa); P.rect(9, 2, 3, 1, 0x8a8e98); text(P, SMALL, '', 0, 0, 0);
    P.rect(2, 2, 4, 1, 0x3a7bd5);
  } else P = new Pix(4, 4);
  SPR[id] = P.flush();
  return SPR[id];
}

// ---------- bakgrunden (målas en gång) ----------
let BG = null;
function paintBg() {
  if (BG) return BG;
  const P = new Pix(FW, FH);
  // vägg: ljusgrå puts med en blå list, golv: grått epoxigolv med gul säkerhetslinje
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0xd4d8dc, 0xc4c8d0, y / WALL_Y);
    c = mul(c, 1 + (hash(x >> 1, y >> 1, 3) - 0.5) * 0.04);
    if (y > WALL_Y - 22) c = y === WALL_Y - 22 ? 0x3a7bd5 : y === WALL_Y - 21 ? 0x2a5aa5 : mul(0x9aa2ae, 1 + (hash(x, y, 4) - 0.5) * 0.05);
    P.px(x, y, c);
  }
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = mul(0x8a8e94, 1 + (hash(x, y, 5) - 0.5) * 0.06);
    if (hash(x, y, 6) > 0.992) c = 0xb8bcc2;
    if (y === WALL_Y + 1 || y === WALL_Y + 2) c = 0x4a4e54;
    if (y >= FH - 8 && y <= FH - 6) c = ((x >> 3) & 1) ? 0xf0c040 : 0x2a2a2a;    // gul/svart säkerhetslinje
    P.px(x, y, c);
  }
  for (let x = 0; x < FW; x++) { P.px(x, WALL_Y, 0x2a2e34); P.px(x, WALL_Y + 3, 0x000000, 0.2); }
  // PIXEL DATA-skylten och fönstret mot downtown (vänster), lagerskylt (höger)
  const s = 'PIXEL DATA', sw = textW(SMALL, s) + 10;
  P.rect(12, 20, sw, 11, 0x1a2a4a); P.box(12, 20, sw, 11, 0x3a7bd5); text(P, SMALL, s, 17, 23, 0xf4f6fa); P.px(14, 22, 0x4ad8e8); P.px(14, 27, 0xe84aa0);
  P.rect(262, 20, 24, 8, 0xf4f1ea); P.box(262, 20, 24, 8, 0x8a8e98); text(P, SMALL, 'LAGER', 264, 21, 0x2a2e34);
  // hyllorna (stålhyllor med lådor och etiketter)
  const shelf = (x0, x1, rows) => {
    P.rect(x0 - 3, rows[0] - 4, 3, WALL_Y - rows[0] + 4, 0x5a6270); P.rect(x1, rows[0] - 4, 3, WALL_Y - rows[0] + 4, 0x5a6270);
    P.vl(x0 - 3, rows[0] - 4, WALL_Y - rows[0] + 4, 0x8a94a4); P.vl(x1, rows[0] - 4, WALL_Y - rows[0] + 4, 0x8a94a4);
    for (const ry of rows) { P.rect(x0 - 3, ry + 22, x1 - x0 + 6, 3, 0x6a7280); P.hl(x0 - 3, ry + 22, x1 - x0 + 6, 0x9aa4b4); P.hl(x0 - 3, ry + 25, x1 - x0 + 6, 0x000000, 0.3); }
  };
  shelf(10, 124, [36, 72]);
  shelf(260, 378, [30, 62, 94]);
  for (const b of BINS) {
    const p = partOf(b.id), h = 20;
    // plastlåda i blått med etikett
    P.rect(b.x, b.y + 2, b.w, h, 0x2a5aa5); P.box(b.x, b.y + 2, b.w, h, 0x1a3a75); P.hl(b.x + 1, b.y + 3, b.w - 2, 0x4a7ac5);
    P.rect(b.x + 3, b.y + 14, b.w - 6, 7, 0xf4f1ea); P.box(b.x + 3, b.y + 14, b.w - 6, 7, 0xb8bcc4);
    text(P, SMALL, p.label, b.x + (b.w >> 1) - (textW(SMALL, p.label) >> 1), b.y + 15, 0x1a1a24);
  }
  // arbetsbänken
  for (let y = BENCH.top; y < BENCH.y; y++) for (let x = BENCH.x0; x < BENCH.x1; x++) {
    let c;
    if (y < BENCH.top + 4) c = y === BENCH.top ? 0xd8c8a8 : mul(0xb8a07a, 1 + (hash(x, y, 7) - 0.5) * 0.06);   // bordsskivan i bok
    else if (y === BENCH.top + 4) c = 0x6a5a40;
    else c = (x - BENCH.x0) % 29 === 0 ? 0x4a525c : mul(0x6a7280, 1 + (hash(x >> 2, y, 8) - 0.5) * 0.05);    // lådor i stål
    if ((x - BENCH.x0) % 29 === 14 && y === BENCH.top + 10) c = 0xc8ccd4;
    P.px(x, y, c);
  }
  P.rect(BENCH.x0 + 2, BENCH.top + 1, BENCH.x1 - BENCH.x0 - 4, 2, 0x3a5a8a);          // blå antistatmatta
  P.hl(BENCH.x0, BENCH.y, BENCH.x1 - BENCH.x0, 0x000000, 0.35);
  // orderskärmen på väggarmen
  P.rect(SCREEN.x0 - 2, SCREEN.y0 - 2, SCREEN.x1 - SCREEN.x0 + 4, SCREEN.y1 - SCREEN.y0 + 4, 0x1a1a20);
  P.rect(((SCREEN.x0 + SCREEN.x1) >> 1) - 2, SCREEN.y1 + 2, 4, 3, 0x3a3a44);
  // skruvdragare och kablar på bänken, eluttag
  P.rect(236, BENCH.top - 3, 10, 3, 0xe8a030); P.rect(238, BENCH.top - 6, 3, 3, 0x2a2a30);
  P.rect(BENCH.x1 - 20, BENCH.top + 6, 12, 5, 0xf4f1ea); P.px(BENCH.x1 - 17, BENCH.top + 8, 0x2a2a30); P.px(BENCH.x1 - 12, BENCH.top + 8, 0x2a2a30);
  // pallen med färdigpackade datorer och vagnen med kartonger (golvet)
  const kartong = (x, y, w, h, lbl) => {
    P.rect(x, y, w, h, 0xc8a070); P.hl(x, y, w, 0xe0bc88); P.vl(x + w - 1, y, h, 0x9a7650); P.hl(x, y + h - 1, w, 0x8a6a48);
    P.rect(x + (w >> 1) - 1, y, 2, h, 0xd8c8a0);                              // tejpen
    if (lbl) { P.rect(x + 2, y + 3, 10, 5, 0x1a2a4a); P.px(x + 3, y + 5, 0x4ad8e8); P.hl(x + 5, y + 5, 6, 0xf4f6fa); }
  };
  P.rect(PALLET.x0, PALLET.y - 4, PALLET.x1 - PALLET.x0, 4, 0xa8845a); for (let x = PALLET.x0; x < PALLET.x1; x += 12) P.rect(x, PALLET.y - 1, 6, 2, 0x6a4a30);
  P.hl(PALLET.x0, PALLET.y + 1, PALLET.x1 - PALLET.x0, 0x000000, 0.3);
  for (let i = 0; i < 4; i++) kartong(PALLET.x0 + 2 + (i % 2) * 32, PALLET.y - 22 - (i >> 1) * 16, 30, 16, true);
  kartong(PALLET.x0 + 18, PALLET.y - 52, 30, 16, true);
  P.rect(CART.x0, CART.y - 22, 2, 22, 0x5a6270); P.rect(CART.x0, CART.y - 4, CART.x1 - CART.x0, 3, 0x6a7280); P.hl(CART.x0, CART.y - 4, CART.x1 - CART.x0, 0x9aa4b4);
  for (const wx of [CART.x0 + 4, CART.x1 - 6]) { P.rect(wx, CART.y - 1, 3, 3, 0x1a1a20); P.px(wx + 1, CART.y, 0x6a6e78); }
  kartong(CART.x0 + 4, CART.y - 18, 20, 14, false); kartong(CART.x0 + 26, CART.y - 16, 22, 12, false); kartong(CART.x0 + 12, CART.y - 30, 18, 12, false);
  // papperskorgen
  P.rect(360, 186, 12, 14, 0x3a7bd5); P.hl(360, 186, 12, 0x6a9ae5); P.rect(362, 184, 8, 2, 0xf4f1ea);
  BG = P.flush();
  return BG;
}

// ---------- jobba ihop: det som skickas mellan byggarna ----------
// ljuden som skiftledarens utfall får spela hos den det gäller (eller hos alla)
const LJUD = new Set(['click', 'ok', 'fel', 'miss', 'slide', 'coin']);
// platserna på moderkortet (i snappen: delens nummer i PARTS, −1 = tom)
const SLOTS = ['cpu', 'ram', 'gpu', 'ssd', 'psu'];
// det man såg vid bänken när man klickade: ordernumret · 256 + det som satt i (bitarna) – har det
// ändrats när man väl är framme, och går det inte längre, hann någon annan före
const BIT = { cpu: 1, ram: 2, gpu: 4, ssd: 8, psu: 16, pasta: 32, kylare: 64, upptagen: 128 };
const BUD_ST = ['away', 'in', 'take', 'out'];   // kollegan från lagret som bär iväg datorn
const MATE_LINES = ['Snyggt bygge!', 'Kunden blir glad!', 'Den tar jag!', 'Nästa order kommer!'];
const pIx = (id) => PARTS.findIndex((p) => p.id === id);
const partAt = (ix) => (Number.isInteger(ix) && ix >= 0 && ix < PARTS.length ? PARTS[ix] : null);

// ---------- scenen ----------
export function makeJobbDatorbygge(A, { onDone } = {}) {
  let t = 0, done = false, doneT = 0, reported = false;
  const P = planOf(A);   // passets plan: längden (P.seconds) växer med vanan
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  const popLog = [];   // de senaste puffarnas text (provet läser dem: syntes "HANN FÖRE!"?)
  const addPop = pops.add;
  pops.add = (x, y, txt, c) => { popLog.push(txt); if (popLog.length > 30) popLog.shift(); addPop(x, y, txt, c); };
  const talk = createSpeech(), talkMate = createSpeech();
  const walker = createWalker({ W: FW, H: FH, left: 6, right: FW - 6, top: WALL_Y + 6, bottom: FH - 10, spawn: [STAND[0], STAND[1] + 20] });
  walker.speed = 118;
  walker.setObstacles([[BENCH.x0, BENCH.top, BENCH.x1, BENCH.y], [PALLET.x0, PALLET.y - 12, PALLET.x1, PALLET.y + 2], [CART.x0, CART.y - 10, CART.x1, CART.y + 2], [360, 188, 372, 200]]);
  const meAt = () => ({ x: walker.px, y: walker.py - 46 });

  // ordern (ix = vilken av ORDERS) och det som sitter i datorn
  let seq = 0, maxNr = 0, order = null, box = null, carry = null, power = null, slideIn = 0, slideOut = null;
  const emptyBox = () => ({ cpu: null, pasta: false, kylare: false, ram: null, gpu: null, ssd: null, psu: null });
  function newOrder() {
    seq += 1; maxNr = Math.max(maxNr, seq);
    const ix = (hash(seq, 17, 91) * ORDERS.length) | 0;
    order = { ...ORDERS[ix], nr: seq, ix };
    box = emptyBox();
    power = null; slideIn = seq > 1 ? 1 : 0;   // första lådan står redan på bänken
  }
  newOrder();
  const needs = () => ['cpu', 'ram', ...(order.gpu ? ['gpu'] : []), 'ssd', 'psu'];
  const complete = () => needs().every((k) => box[k]) && box.pasta && box.kylare;
  // kollegan som bär iväg den färdiga datorn
  const mate = { look: { ...makeLook(() => 0.37), kid: false, shirt: '#3a7bd5', top: 'tee', hat: 'cap', cap: '#1a2a4a' }, x: FW + 20, y: STAND[1] - 6, state: 'away', carry: false };
  const TAKE_X = CASE.x + CASE.w + 14;

  // ---------- jobba tillsammans (delat pass via js/net/coop.js) ----------
  // Man bygger SAMMA dator: verkstaden har en bänk, en datorlåda och en orderskärm, och den bilden
  // gäller ihop också (två bänkar hade krävt nya möbler och en delad orderskärm som inte ryms). Arbetet
  // delar man som man vill – en hämtar i hyllorna, en skruvar – och båda ser på orderskärmen vad som
  // redan sitter i. Skiftledaren (den som varit längst i verkstaden) kör det gemensamma: ordern, det
  // som sitter i lådan, kylpastan och kylaren, startknappen och fläktarna, kollegan från lagret och
  // nästa låda – och håller reda på vilken del var och en bär (hyllorna tar aldrig slut, så det man
  // bär är ens eget; skiftledarens bok gör bara att alla ser det i ens händer). Läget delas ~3 ggr/s;
  // medarbetarna skickar varje handling som ett numrerat önskemål med det de såg vid bänken (ordern
  // och vad som satt i), det de bär och var de står: ta en del ur hyllan, sätta i den, kylpasta,
  // kylare och startknappen. Skiftledaren kör samma kod åt dem och är ENDA domaren: varje plats i
  // lådan fylls EN gång och datorn startas EN gång – den som kommer för sent ser HANN FÖRE! och delen
  // åker tillbaka i hyllan (inget fel). Poängen går till den som satte i delen, datorbonusen till den
  // som tryckte på startknappen; lagets rätt, fel och färdiga datorer delas lika vid passets slut.
  // Ihop går det fortare mellan lådorna: kollegan från lagret kommer redan när fläktarna går igång
  // och datorn startar snabbare – nästa låda står på bänken nästan direkt.
  const coop = makeShiftCoop(A, 'away:jobbdatorbygge');
  let snapIn = 0, wasLead = true, wasCoop = false, maxN = 1, handled = 0;
  let pend = null, queued = null;                    // medarbetarens önskemål som väntar på svar (och ett köat klick)
  let reqN = (Math.random() * 1e6) | 0;              // önskemålens löpnummer (samma nummer två gånger = samma önskemål)
  const team = { ok: 0, fel: 0, miss: 0, boxes: 0 }; // LAGETS räkning – delas lika vid passets slut
  const held = new Map();                            // spelar-id → delen hen bär (PARTS-index; skiftledarens bok – hos medarbetaren ur snappen)
  const seenReq = new Map();                         // (skiftledaren) id → senaste önskemålets nummer
  const absent = new Map();                          // (skiftledaren) id → sedan när den som bär inte syns i verkstaden
  const medarb = () => coop.active && !coop.leader;
  const meId = () => coop.myId || '';
  const snapAsap = () => { snapIn = 0; };
  const int = (v, dflt) => (Number.isInteger(v) ? v : dflt);
  const str = (v) => (typeof v === 'string' ? v.slice(0, 64) : '');
  const hudTitle = () => (maxN > 1 ? 'PIXEL DATA IHOP' : 'PIXEL DATA');
  const bits = () => SLOTS.reduce((b, k) => b | (box[k] ? BIT[k] : 0), 0) | (box.pasta ? BIT.pasta : 0) | (box.kylare ? BIT.kylare : 0) | (power || slideOut ? BIT.upptagen : 0);
  const sig = () => order.nr * 256 + bits();
  const powT = () => (coop.active ? 1.6 : 2.2);        // fläktarna till BIOS OK (ihop lite snabbare)
  const budFart = () => (coop.active ? 150 : 120);     // kollegan från lagret (ihop springer hen)

  function sendSnap() {
    const me = meId(), ho = [...held].filter(([by]) => by !== me);
    if (carry && me) ho.push([me, pIx(carry.id)]);
    coop.send({
      t: 'snap',
      // ordern [nummer, vilken], lådan [cpu, ram, gpu, ssd, psu (PARTS-index, −1 = tom), kylpasta, kylare]
      o: [order.nr, order.ix],
      bx: [...SLOTS.map((k) => (box[k] ? PARTS.findIndex((p) => p.kind === k && p.v === box[k]) : -1)), box.pasta ? 1 : 0, box.kylare ? 1 : 0],
      // startknappen [fläktarnas tid·100, vem som tryckte], lådan in/ut ·100, kollegan från lagret [läge, x, bär]
      pw: power ? [Math.round(power.t * 100), power.by || ''] : 0,
      sl: [Math.round(slideIn * 100), slideOut ? Math.round(slideOut.t * 100) : -1],
      nb: [BUD_ST.indexOf(mate.state), Math.round(mate.x), mate.carry ? 1 : 0],
      ho,   // vem som bär vilken del: [spelar-id, PARTS-index]
      tm: [team.ok, team.fel, team.miss, team.boxes],
    });
  }
  function applySnap(m) {
    if (Array.isArray(m.o) && Number.isInteger(m.o[0]) && m.o[0] > 0) {
      const nr = m.o[0], ix = clamp(m.o[1] | 0, 0, ORDERS.length - 1);
      if (nr !== order.nr || ix !== order.ix) order = { ...ORDERS[ix], nr, ix };
      seq = nr; maxNr = Math.max(maxNr, nr);
    }
    if (Array.isArray(m.bx)) {
      const b = emptyBox();
      SLOTS.forEach((k, j) => { const p = partAt(m.bx[j]); if (p && p.kind === k) b[k] = p.v; });
      b.pasta = !!m.bx[5]; b.kylare = !!m.bx[6];
      box = b;
    }
    if (Array.isArray(m.pw)) {
      const pt = Math.max(0, (m.pw[0] | 0) / 100);
      if (!power || Math.abs(power.t - pt) > 0.3) power = { t: pt, by: '' };
      power.by = str(m.pw[1]);
    } else if (m.pw === 0) power = null;
    if (Array.isArray(m.sl)) {
      // (lådan glider vidare här mellan lägena – bara ett tydligt hopp rättas)
      const si = clamp((m.sl[0] | 0) / 100, 0, 1), so = m.sl[1] | 0;
      if (Math.abs(slideIn - si) > 0.2) slideIn = si;
      if (so < 0) slideOut = null;
      else if (!slideOut || Math.abs(slideOut.t - so / 100) > 0.2) slideOut = { t: clamp(so / 100, 0, 0.5) };
    }
    if (Array.isArray(m.nb)) {
      mate.state = BUD_ST[clamp(m.nb[0] | 0, 0, BUD_ST.length - 1)];
      mate.carry = !!m.nb[2];
      const x = +m.nb[1] || 0;
      if (Math.abs(mate.x - x) > 10) mate.x = x;
    }
    if (Array.isArray(m.ho)) {
      held.clear();
      for (const h of m.ho.slice(0, 12)) if (Array.isArray(h) && str(h[0]) && partAt(h[1])) held.set(str(h[0]), h[1]);
    }
    // det jag bär enligt skiftledarens bok (inte mitt i ett önskemål – då kommer svaret strax)
    if (!pend) { const mine = partAt(held.get(meId())); carry = mine ? { id: mine.id } : null; }
    if (Array.isArray(m.tm)) { team.ok = m.tm[0] | 0; team.fel = m.tm[1] | 0; team.miss = m.tm[2] | 0; team.boxes = m.tm[3] | 0; }
  }
  // Medarbetarens verkstad mellan ledarens lägen: lådan glider, fläktarna snurrar och kollegan från
  // lagret går vidare – men bara skiftledaren räknar datorn och sätter upp nästa order.
  function mateTick(dt) {
    if (slideIn > 0) slideIn = Math.max(0, slideIn - dt * 2.2);
    if (power) power.t += dt;
    if (mate.state === 'in') { mate.x -= budFart() * dt; if (mate.x <= TAKE_X) { mate.x = TAKE_X; mate.state = 'take'; } }
    else if (mate.state === 'take') { if (slideOut) slideOut.t = Math.min(0.5, slideOut.t + dt); }
    else if (mate.state === 'out') { mate.x += 110 * dt; if (mate.x > FW + 24) { mate.state = 'away'; mate.carry = false; } }
  }
  // JAG tar över passet: nästa order får ett nummer över allt som synts (inga krockar), delen jag
  // bar enligt boken är min, och lådan, fläktarna och kollegan från lagret fortsätter där de var.
  // (Delen hos den som gick åker tillbaka i hyllan – sweepGone.)
  function takeOver() {
    const mine = partAt(held.get(meId()));
    if (mine && !carry) carry = { id: mine.id };
    held.delete(meId());
    seq = Math.max(seq, maxNr, order.nr);
    pend = null; queued = null;
    snapAsap();
  }
  // jag blir medarbetare: nästa snap bestämmer ordern och lådan. En del jag tog i min egen verkstad
  // innan vi möttes anmäls till skiftledaren (hyllorna är samma) – så syns den i mina händer hos alla.
  function becomeMate() {
    held.clear();
    if (carry) ask({ t: 'do', a: 'ta', id: carry.id, v: -1, x: Math.round(walker.px), y: Math.round(walker.py) });
  }
  // (skiftledaren) den som gått ur verkstaden (en stund – inte bara ett ögonblick) bär inget längre
  function sweepGone() {
    const ids = new Set([meId(), ...coop.peers().map((f) => f.id)]);
    for (const by of [...held.keys()]) {
      if (ids.has(by)) { absent.delete(by); continue; }
      if (!absent.has(by)) absent.set(by, t);
      if (t - absent.get(by) > 1.5) { absent.delete(by); held.delete(by); snapAsap(); }   // (delen åker tillbaka i hyllan)
    }
  }
  // mitt pass är slut: delen jag bär åker tillbaka i hyllan
  function letGo() {
    if (!coop.active) return;
    carry = null;
    if (medarb()) { coop.send({ t: 'lamna' }); return; }
    sendSnap(); coop.sentSnap();
  }

  // Byggaren som gör något med det gemensamma: jag själv, eller – hos skiftledaren – en medarbetare
  // vars önskemål körs åt hen. v = det hen såg vid bänken när hen klickade. Det hen bär följer med
  // önskemålet och tillbaka i svaret.
  const meK = (v) => ({ by: meId(), fx: [], v, get carry() { return carry; }, set carry(c) { carry = c; } });
  const forK = (by, c, v) => ({ by, fx: [], v, carry: c, remote: true });
  const kOf = (by) => (!by || by === meId() ? meK() : forK(by, null));
  // (skiftledaren) det kollegan bär: det som står i boken
  const claimOf = (by) => { const p = partAt(held.get(by)); return p ? { id: p.id } : null; };
  // Utfallet av en handling: [slag, vem (spelar-id; '' = alla i verkstaden), ...]. Det som gäller mig
  // (eller alla) syns och hörs här direkt – ensam gäller allt mig; i ett delat pass (eller när jag kör
  // en medarbetares önskemål) följer resten med svaret ut.
  const delat = (k) => coop.active || !!k.remote;
  function fx(k, who, kind, ...a) {
    const me = meId(), ut = delat(k);
    if (!who || who === me || !ut) doFx(kind, a);
    if (ut && who !== me) k.fx.push([kind, who, ...a]);
  }
  function doFx(kind, a) {
    if (kind === 's') { if (LJUD.has(a[0])) play(a[0]); }
    else if (kind === 'p') pops.add(CASE.x + CASE.w / 2, CASE.y - ((a[2] | 0) || 4), String(a[0]).slice(0, 40), String(a[1] || '#f4f1ea'));
    else if (kind === 'M') talk.say(String(a[0]).slice(0, 60), meAt, +a[1] || 2);
    else if (kind === 'H') hannFore();
    else if (kind === 'o') stats.ok += 1;
    else if (kind === 'f') stats.fel += 1;
    else if (kind === 'b') stats.boxes += 1;   // jag tryckte på startknappen: datorbonusen är min
    else if (kind === 'D') talkMate.say(MATE_LINES[(a[0] | 0) % MATE_LINES.length], () => ({ x: mate.x, y: mate.y - 46 }), 2);
  }
  const kLjud = (k, s) => fx(k, k.by, 's', s);                          // hörs hos den det gäller
  const kPop = (k, txt, col, dy) => fx(k, '', 'p', txt, col, dy || 4);   // vid datorlådan – syns hos alla
  const kPopMe = (k, txt, col) => fx(k, k.by, 'p', txt, col, 4);        // vid datorlådan – bara hos den det gäller
  const kSay = (k, txt, secs) => fx(k, k.by, 'M', txt, secs);           // pratbubblan ovanför den det gäller
  function hannFore() { play('miss'); pops.add(walker.px, walker.py - 58, 'HANN FÖRE!', '#ff6a6a'); }
  // (ihop) det jag såg när jag klickade: en annan order då – eller var platsen tom?
  const seenNr = (k) => (Number.isInteger(k.v) && k.v >= 0 ? k.v >> 8 : order.nr);
  const seenBits = (k) => (Number.isInteger(k.v) && k.v >= 0 ? k.v & 255 : bits());
  const late = (k) => delat(k) && seenNr(k) !== order.nr;
  const wasFree = (k, bit) => delat(k) && !(seenBits(k) & bit);
  // någon annan hann före: delen åker tillbaka i hyllan – inget fel
  function fore(k) { fx(k, k.by, 'H'); k.carry = null; }
  function kWrong(k, msg) {
    team.fel += 1; fx(k, k.by, 'f'); kLjud(k, 'fel');
    kPop(k, msg, '#ff6a5a');
    k.carry = null;                      // delen åker tillbaka i lådan
  }

  // ---------- det gemensamma (körs av skiftledaren – eller den ensamma – åt byggaren k) ----------
  // ta delen id ur hyllan (hyllorna tar aldrig slut)
  function doPick(k, id) {
    if (k.carry) { kSay(k, 'Jag bär redan något – sätt i det först!', 2); return; }
    k.carry = { id }; kLjud(k, 'click');
  }
  // sätt i delen k bär – varje plats fylls EN gång
  function doInstall(k) {
    const c = k.carry;
    if (!c) return;
    const p = partOf(c.id);
    if (!p) { k.carry = null; return; }
    if (power || slideOut) { kPopMe(k, 'VÄNTA PÅ NÄSTA LÅDA!', '#ffd23f'); return; }
    if (p.kind === 'gpu' && !order.gpu) { if (late(k)) fore(k); else kWrong(k, 'INGET GRAFIKKORT!'); return; }
    if (box[p.kind]) { if (late(k) || wasFree(k, BIT[p.kind])) fore(k); else kWrong(k, 'SITTER REDAN EN ' + KIND_NAME[p.kind] + '!'); return; }
    if (p.v !== order[p.kind]) { if (late(k)) fore(k); else kWrong(k, 'FEL MODELL!'); return; }
    box[p.kind] = p.v; k.carry = null;
    team.ok += 1; fx(k, k.by, 'o'); kLjud(k, 'ok');
    kPop(k, '+ ' + KIND_NAME[p.kind], '#8ee03c');
    if (complete()) kSay(k, 'Allt sitter i – tryck på startknappen!', 3);
  }
  // kylpastan och kylaren ligger på bänken bredvid lådan
  function doTool(k, id) {
    if (power || slideOut) { kPopMe(k, 'VÄNTA PÅ NÄSTA LÅDA!', '#ffd23f'); return; }
    if (k.carry) { kSay(k, 'Sätt i delen jag bär först!', 2); return; }
    if (!box.cpu) { if (late(k)) fx(k, k.by, 'H'); else { kPopMe(k, 'PROCESSORN FÖRST!', '#ffd23f'); kLjud(k, 'miss'); } return; }
    const hann = late(k) || wasFree(k, BIT[id]);
    if (id === 'pasta') {
      if (box.pasta) { if (hann) fx(k, k.by, 'H'); else kPopMe(k, 'PASTAN ÄR PÅ!', '#ffd23f'); return; }
      box.pasta = true; team.ok += 1; fx(k, k.by, 'o'); kLjud(k, 'click'); kPop(k, '+ KYLPASTA', '#8ee03c');
    } else {
      if (box.kylare) { if (hann) fx(k, k.by, 'H'); return; }
      if (!box.pasta) { kWrong(k, 'KYLPASTA FÖRST!'); return; }
      box.kylare = true; team.ok += 1; fx(k, k.by, 'o'); kLjud(k, 'ok'); kPop(k, '+ KYLARE', '#8ee03c');
    }
    if (complete()) kSay(k, 'Allt sitter i – tryck på startknappen!', 3);
  }
  // startknappen – datorn startas EN gång, bonusen blir den som tryckte
  function doPower(k) {
    if (power || slideOut) { if (wasFree(k, BIT.upptagen)) fx(k, k.by, 'H'); return; }
    if (!complete()) {
      if (late(k)) { fx(k, k.by, 'H'); return; }
      const miss = [...needs().filter((kk) => !box[kk]).map((kk) => KIND_NAME[kk]), ...(!box.pasta ? ['KYLPASTA'] : []), ...(!box.kylare ? ['KYLARE'] : [])];
      kPopMe(k, 'SAKNAS: ' + miss[0], '#ffd23f'); kLjud(k, 'miss'); return;
    }
    power = { t: 0, by: k.by }; fx(k, '', 's', 'slide');
    if (coop.active && mate.state === 'away') mate.state = 'in';   // (ihop: kollegan från lagret kommer redan nu)
  }
  // En handling på det gemensamma (framme vid hyllan eller bänken; v = det jag såg när jag klickade):
  // ensam (eller som skiftledare) görs den direkt, som medarbetare blir den ett önskemål till
  // skiftledaren – med det jag såg, bär och var jag står.
  function act(a, id = null, v = sig()) {
    if (medarb()) { if (!pend) ask({ t: 'do', a, id, v, x: Math.round(walker.px), y: Math.round(walker.py) }); return; }
    const k = meK(v);
    if (a === 'ta') doPick(k, id);
    else if (a === 'in') doInstall(k);
    else if (a === 'verktyg') doTool(k, id);
    else if (a === 'start') doPower(k);
    else return;
    publish(k, false);
  }
  // skiftledaren: läget ut direkt efter en handling (FÖRE svaret – då har den som frågade redan det
  // nya läget när svaret kommer) och utfallet till alla
  function publish(k, svar) {
    if (!svar && !(coop.active && coop.leader && coop.settled)) return;
    sendSnap(); coop.sentSnap(); snapIn = 0.35;
    if (svar) coop.send({ t: 'res', by: k.by, fx: k.fx, s: 1, c: k.carry ? pIx(k.carry.id) : -1 });
    else if (k.fx.length) coop.send({ t: 'res', by: k.by, fx: k.fx });
  }
  // medarbetarens önskemål: man väntar på skiftledarens svar (högst 2,5 s – sedan kan man försöka
  // igen). n = löpnumret: kommer samma önskemål fram två gånger görs det EN gång (provet skickar två).
  function ask(m, n = 1) {
    m.n = ++reqN; m.c = carry ? pIx(carry.id) : -1;
    for (let i = 0; i < n; i++) coop.send(m);
    pend = { t: 2.5 };
  }
  function answered() {
    pend = null;
    if (queued && !done) { const q = queued; queued = null; api.down(q[0], q[1]); }
  }
  coop.on('snap', (m) => { if (!coop.leader) applySnap(m); });
  coop.on('res', (m) => {   // ledarens utfall: puffarna hos alla – poängen och det man bär hos den det gäller
    const me = coop.myId, mine = m.by === me;
    if (coop.leader && !mine) return;   // (skiftledaren har redan visat det hos sig)
    if (mine && m.s && 'c' in m) { const p = partAt(m.c); carry = p ? { id: p.id } : null; }
    for (const f of (Array.isArray(m.fx) ? m.fx : []).slice(0, 24)) {
      if (!Array.isArray(f)) continue;
      const who = str(f[1]);
      if (!who || who === me) doFx(f[0], f.slice(2));
    }
    if (mine && m.s) answered();
  });
  coop.on('do', (m, from) => {   // en medarbetares handling på det gemensamma – körs här, åt hen
    if (!coop.leader || !coop.settled || done) return;   // (bara den som kör verkstaden avgör)
    if (Number.isInteger(m.n)) { if (seenReq.get(from) === m.n) return; seenReq.set(from, m.n); }   // (samma önskemål igen)
    const k = forK(from, claimOf(from), int(m.v, -1));
    if (m.a === 'ta') { const p = partAt(pIx(str(m.id))); if (!p) return; doPick(k, p.id); }
    else if (m.a === 'in') doInstall(k);
    else if (m.a === 'verktyg') doTool(k, m.id === 'kylare' ? 'kylare' : 'pasta');
    else if (m.a === 'start') doPower(k);
    else return;
    handled += 1;
    if (k.carry) held.set(from, pIx(k.carry.id)); else held.delete(from);
    publish(k, true);
  });
  // en kollega går hem (passet slut): delen hen bar åker tillbaka i hyllan
  coop.on('lamna', (m, from) => { if (coop.leader && held.delete(from)) snapAsap(); });

  function pickBin(b) {
    if (carry) { talk.say('Jag bär redan något – sätt i det först!', meAt, 2); return; }
    const [x, y] = binFront(b);
    walker.walkTo(x, y, () => { walker.dir = 'up'; act('ta', b.id); });
  }
  function toBench(fn) { walker.walkTo(STAND[0], STAND[1], () => { walker.dir = 'up'; fn(); }); }

  // klickytor
  const hitCase = (x, y) => x >= CASE.x - 4 && x <= CASE.x + CASE.w + 4 && y >= CASE.y - 4 && y <= BENCH.top + 2;
  const TOOL = { pasta: [BENCH.x0 + 4, BENCH.top - 6, BENCH.x0 + 16, BENCH.top + 2], kylare: [BENCH.x0 + 16, BENCH.top - 18, BENCH.x0 + 32, BENCH.top + 2] };
  const inR = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

  // skiftledarens (och den ensammas) verkstad: fläktarna, datorn räknas, kollegan från lagret bär
  // iväg den och nästa låda glider in – och läget ut till medarbetarna ~3 ggr/s
  function leadTick(dt) {
    if (slideIn > 0) slideIn = Math.max(0, slideIn - dt * 2.2);
    if (power) {
      power.t += dt;
      if (power.t > powT() && !slideOut) {
        const k = kOf(power.by);   // (bonusen till den som tryckte på startknappen)
        team.boxes += 1; fx(k, k.by, 'b'); fx(k, '', 's', 'coin');
        kPop(k, 'FÄRDIG DATOR!', '#8ee03c', 12);
        if (mate.state !== 'take') mate.state = 'in';
        slideOut = { t: 0 };
        fx(k, '', 'D', seq % 4);
        publish(k, false);
      }
    }
    // kollegan går in, tar datorn och går ut
    if (mate.state === 'in') { mate.x -= budFart() * dt; if (mate.x <= TAKE_X) { mate.x = TAKE_X; mate.state = 'take'; } }
    else if (mate.state === 'take') { if (slideOut) { slideOut.t += dt; if (slideOut.t > 0.5) { mate.state = 'out'; mate.carry = true; newOrder(); slideOut = null; snapAsap(); } } }
    else if (mate.state === 'out') { mate.x += 110 * dt; if (mate.x > FW + 24) { mate.state = 'away'; mate.carry = false; } }
    if (coop.active || maxN > 1) sweepGone();
    if (coop.active) { snapIn -= dt; if (snapIn <= 0) { snapIn = 0.35; sendSnap(); coop.sentSnap(); } }
  }

  function update(dt) {
    pops.update(dt);
    if (done) {
      coop.tick(); coop.resign();   // MITT pass är slut – lämna över ledningen direkt (även på lönebeskedet)
      doneT += dt;
      if (doneT > 1.2 && !reported) {
        reported = true;
        if (maxN > 1) {   // jobbat ihop: laget delar lika på rätt, fel och färdiga datorer
          const sh = (v) => Math.round(v / maxN);
          onDone?.({ ok: sh(team.ok), fel: sh(team.fel), miss: sh(team.miss), boxes: sh(team.boxes), delat: maxN, lagOk: team.ok, lagFel: team.fel });
        } else onDone?.({ ...stats });
      }
      return;
    }
    t += dt;
    if (t >= P.seconds) { done = true; play('fanfare'); pend = null; queued = null; letGo(); return; }
    walker.update(dt);
    if (pend) { pend.t -= dt; if (pend.t <= 0) answered(); }   // inget svar (ledaren gick?) – då får man försöka igen
    coop.tick();
    if (coop.active) maxN = Math.max(maxN, coop.peers().length + 1);
    if (coop.active !== wasCoop) {   // en kollega kom in: det går fortare mellan lådorna
      wasCoop = coop.active;
      if (wasCoop) { play('knock'); pops.add(FW / 2, 96, 'NI JOBBAR IHOP!', '#8ee03c'); }
    }
    // Skiftledaren (eller solo) kör verkstaden; medarbetare följer ledarens läge
    const iLead = !coop.active || (coop.leader && coop.settled);
    if (iLead && !wasLead) takeOver();
    else if (!iLead && wasLead) becomeMate();
    wasLead = iLead;
    if (iLead) leadTick(dt); else mateTick(dt);
  }

  // ---------- ritning ----------
  function drawOrderScreen(ctx) {
    const { x0, y0, x1, y1 } = SCREEN;
    ctx.fillStyle = '#0e1a2e'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const k = slideIn > 0 ? 1 - slideIn : 1;
    if (k < 0.5 && Math.floor(t * 12) % 2) return;                                  // skärmen blinkar till när ordern byts
    ctxText(ctx, SMALL, `ORDER ${order.nr} - ${order.name}`, x0 + 3, y0 + 2, '#f0c850');
    const rows = [['cpu', order.cpu], ['ram', order.ram], ['gpu', order.gpu || 'INGET'], ['ssd', order.ssd], ['psu', order.psu], ['kyl', 'KYLARE']];
    rows.forEach(([kk, v], i) => {
      const cx = x0 + 3 + (i % 2) * 52, cy = y0 + 9 + Math.floor(i / 2) * 6;
      const got = kk === 'kyl' ? box.kylare : kk === 'gpu' && !order.gpu ? true : !!box[kk];
      ctx.fillStyle = got ? '#8ee03c' : '#3a4a6a'; ctx.fillRect(cx, cy + 1, 3, 3);
      ctxText(ctx, SMALL, (kk === 'kyl' ? '' : kk.toUpperCase() + ' ') + v, cx + 5, cy, got ? '#8ee03c' : '#d8e4f4');
    });
  }
  function drawCase(ctx) {
    const off = slideIn > 0 ? -Math.round(slideIn * 120) : slideOut ? Math.round(slideOut.t * 40) : 0;
    if (mate.state === 'out' && mate.carry) return;
    const X = CASE.x + off, Y = CASE.y, Wd = CASE.w, Ht = CASE.h;
    const on = power && power.t > 0.3;
    // lådan: svart plåt, öppen sida, fötter
    ctx.fillStyle = '#16161c'; ctx.fillRect(X, Y, Wd, Ht);
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(X + 2, Y + 2, Wd - 4, Ht - 4);
    ctx.fillStyle = '#3a3a46'; ctx.fillRect(X, Y, Wd, 1); ctx.fillRect(X, Y, 1, Ht);
    ctx.fillStyle = '#0e0e14'; ctx.fillRect(X + 4, Y + Ht, 6, 2); ctx.fillRect(X + Wd - 10, Y + Ht, 6, 2);
    // moderkortet
    const MX = X + 5, MY = Y + 5, MW = Wd - 16, MH = 42;
    ctx.fillStyle = '#1e4a2e'; ctx.fillRect(MX, MY, MW, MH);
    ctx.fillStyle = '#2a5a3a'; for (let i = 0; i < MW; i += 6) ctx.fillRect(MX + i, MY + 22, 3, 1);
    ctx.fillStyle = '#6a6e78'; ctx.fillRect(MX, MY, 3, 16);                                  // I/O-skölden
    // CPU-sockeln
    const SX = MX + 8, SY = MY + 6;
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(SX - 1, SY - 1, 12, 12); ctx.fillStyle = '#3a3a44'; ctx.fillRect(SX, SY, 10, 10);
    if (box.cpu) ctx.drawImage(spr(PARTS.find((p) => p.kind === 'cpu' && p.v === box.cpu).id), SX, SY);
    if (box.pasta && !box.kylare) { ctx.fillStyle = '#e8ecf4'; ctx.fillRect(SX + 3, SY + 3, 4, 4); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(SX + 4, SY + 4, 2, 2); }
    if (box.kylare) {
      ctx.drawImage(spr('kylare'), SX - 2, SY - 5);
      if (on) { ctx.fillStyle = Math.floor(t * 20) % 2 ? '#8a8e98' : '#4a4e58'; ctx.fillRect(SX - 2, SY - 2, 3, 8); }
    }
    // minnesplatserna (4) – två stickor i platserna 1 och 3
    const RX = MX + 24;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#1a1a20' : '#2a2a30'; ctx.fillRect(RX + i * 3, MY + 3, 2, 18); }
    if (box.ram) { const id = PARTS.find((p) => p.kind === 'ram' && p.v === box.ram).id; ctx.drawImage(spr(id), RX - 1, MY + 3); ctx.drawImage(spr(id), RX + 5, MY + 3);
      if (on && box.ram === '32 GB') { ctx.fillStyle = `hsl(${(t * 200) % 360},90%,60%)`; ctx.fillRect(RX - 1, MY + 3, 4, 1); ctx.fillRect(RX + 5, MY + 3, 4, 1); } }
    // grafikkortsplatsen (PCIe) och M.2-platsen
    ctx.fillStyle = '#1a1a20'; ctx.fillRect(MX + 4, MY + 28, 30, 2);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(MX + 6, MY + 36, 14, 2);
    if (box.ssd) ctx.drawImage(spr(PARTS.find((p) => p.kind === 'ssd' && p.v === box.ssd).id), MX + 6, MY + 35);
    if (box.gpu) {
      const id = PARTS.find((p) => p.kind === 'gpu' && p.v === box.gpu).id;
      ctx.drawImage(spr(id), MX + 4, MY + 22);
      if (on && box.gpu === 'RX 80') { ctx.fillStyle = `hsl(${(t * 200 + 120) % 360},90%,60%)`; ctx.fillRect(MX + 6, MY + 25, 24, 1); }
    }
    // nätaggregatsfacket (hölje) längst ner
    ctx.fillStyle = '#1e1e26'; ctx.fillRect(X + 3, Y + Ht - 18, Wd - 12, 14);
    ctx.fillStyle = '#3a3a46'; ctx.fillRect(X + 3, Y + Ht - 18, Wd - 12, 1);
    if (box.psu) {
      ctx.drawImage(spr(PARTS.find((p) => p.kind === 'psu' && p.v === box.psu).id), X + 5, Y + Ht - 17);
      // kablarna upp till moderkortet
      ctx.fillStyle = '#1a1a1a'; for (let i = 0; i < 3; i++) ctx.fillRect(X + Wd - 16 + i * 2, MY + 10, 1, Ht - 28);
    }
    // fronten med fläktar (höger kant) och startknappen
    ctx.fillStyle = '#1e1e26'; ctx.fillRect(X + Wd - 9, Y + 2, 7, Ht - 4);
    for (let i = 0; i < 3; i++) {
      const fy = Y + 12 + i * 16;
      ctx.fillStyle = on ? (Math.floor(t * 18 + i) % 2 ? '#4a8ad8' : '#2a5aa5') : '#2a2a34'; ctx.fillRect(X + Wd - 8, fy, 5, 12);
    }
    const blink = !power && complete() && Math.floor(t * 3) % 2;
    ctx.fillStyle = on ? '#8ee03c' : blink ? '#ffd23f' : '#6a6e78'; ctx.fillRect(POWER.x + off, POWER.y, 3, 3);
    // skärmen på bänken visar BIOS OK när den startar
    if (on) {
      ctx.fillStyle = '#0e1a2e'; ctx.fillRect(X - 26, Y + 30, 22, 16);
      ctxText(ctx, SMALL, 'BIOS', X - 23, Y + 32, '#8ee03c'); ctxText(ctx, SMALL, 'OK!', X - 21, Y + 39, '#8ee03c');
    }
  }
  function drawTools(ctx) {
    // kylpastan och kylaren i sin kartong bredvid lådan
    if (!box.pasta) ctx.drawImage(spr('pasta'), BENCH.x0 + 4, BENCH.top - 5);
    if (!box.kylare) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(BENCH.x0 + 16, BENCH.top - 16, 16, 16); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(BENCH.x0 + 16, BENCH.top - 16, 16, 4); ctx.drawImage(spr('kylare'), BENCH.x0 + 17, BENCH.top - 12); }
  }
  function drawBins(ctx) {
    for (const b of BINS) {
      const s = spr(b.id), p = partOf(b.id);
      // några delar sticker upp ur lådan
      for (let i = 0; i < 2; i++) ctx.drawImage(s, b.x + (b.w >> 1) - (s.width >> 1) + (i ? 4 : -4) * (p.kind === 'gpu' || p.kind === 'psu' ? 0.5 : 1), b.y + 3 - Math.min(10, s.height) + i * 2);
    }
  }
  function drawCarry(ctx) {
    if (!carry) return;
    const s = spr(carry.id), dir = walker.dir, ox = dir === 'left' ? -8 : dir === 'right' ? 8 : 0;
    ctx.drawImage(s, Math.round(walker.px + ox - s.width / 2), Math.round(walker.py - 20 - s.height / 2));
  }

  const api = {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update,
    exit() { coop.dispose(); },
    down(x, y) {
      if (done) return;
      if (pend) { queued = [x, y]; return; }   // väntar på skiftledarens svar – klicket tas strax
      const v = sig();   // (det jag ser vid bänken nu – följer med handlingen)
      if (hitCase(x, y) && Math.abs(x - POWER.x) <= 4 && Math.abs(y - POWER.y) <= 4) { toBench(() => act('start', null, v)); return; }
      for (const [id, r] of Object.entries(TOOL)) if (inR(r, x, y)) { toBench(() => act('verktyg', id, v)); return; }
      if (hitCase(x, y)) { toBench(() => (carry ? act('in', null, v) : complete() ? act('start', null, v) : talk.say('Hämta delarna i hyllorna!', meAt, 2))); return; }
      for (const b of BINS) if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 10 && y <= b.y + 26) { pickBin(b); return; }
      if (y > WALL_Y + 4) walker.walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawBins(ctx);
      drawOrderScreen(ctx);
      drawCase(ctx);
      drawTools(ctx);
      const items = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry })];
      if (mate.state !== 'away') items.push({ fy: mate.y, draw: (c) => { drawPerson(c, mate.x, mate.y, mate.look, mate.state === 'out' ? 'right' : 'left', mate.carry ? [7, 9, 8, 9][Math.floor(t * 8) % 4] : mate.state === 'take' ? 9 : WALK_SEQ[Math.floor(t * 8) % 4]);
        if (mate.carry) { c.fillStyle = '#16161c'; c.fillRect(Math.round(mate.x) + 2, mate.y - 30, 14, 18); c.fillStyle = '#4a8ad8'; c.fillRect(Math.round(mate.x) + 13, mate.y - 28, 2, 14); } } });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawCarry(ctx);
      // det kollegorna bär (skiftledaren håller reda på vem som bär vilken del)
      if (coop.active) for (const f of coop.peers()) {
        const p = partAt(held.get(f.id));
        if (p) { const s = spr(p.id); ctx.drawImage(s, Math.round(f.x - s.width / 2), Math.round(f.y - 20 - s.height / 2)); }
      }
      talk.draw(ctx, { x0: 0, x1: FW }); talkMate.draw(ctx, { x0: 0, x1: FW });
      pops.draw(ctx);
      const n = maxN > 1 ? team.boxes : stats.boxes;
      drawShiftHud(ctx, A, { t, dur: P.seconds, ok: maxN > 1 ? team.ok : stats.ok, fel: maxN > 1 ? team.fel : stats.fel, title: `${hudTitle()} - ${n} ${n === 1 ? 'DATOR' : 'DATORER'}` });
      if (done) drawTimeUp(ctx, A);
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), carry: carry?.id || null, box: { ...box }, order: { ...order }, power: !!power, boxes: stats.boxes, x: Math.round(walker.px), y: Math.round(walker.py), done }),
      order: () => ({ ...order }),
      bins: () => BINS.map((b) => ({ id: b.id, x: b.x + (b.w >> 1), y: b.y + 10 })),
      spot: (id) => { if (id === 'lada') return { x: CASE.x + CASE.w / 2, y: CASE.y + 30 }; if (id === 'start') return { x: POWER.x + 1, y: POWER.y + 1 }; if (TOOL[id]) return { x: (TOOL[id][0] + TOOL[id][2]) >> 1, y: (TOOL[id][1] + TOOL[id][3]) >> 1 }; const b = binOf(id); return b ? { x: b.x + (b.w >> 1), y: b.y + 10 } : null; },
      // ta delen direkt (hos en medarbetare blir det ett önskemål till skiftledaren)
      pick: (id) => { if (medarb()) { act('ta', id); return null; } carry = { id }; return carry; },
      install: () => { act('in'); return { ...box }; },
      tool: (id) => { act('verktyg', id); return { ...box }; },
      power: () => { act('start'); return !!power; },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      finish: () => { t = P.seconds - 0.01; update(0.02); for (let i = 0; i < 60; i++) update(0.05); },
      wanted: () => { const o = order; return PARTS.filter((p) => o[p.kind] === p.v).map((p) => p.id); },
      // ---------- jobba tillsammans (tools/coop-datorbygge-test.mjs) ----------
      coop: () => ({ leader: coop.leader, active: coop.active, mates: coop.peers().length, settled: coop.settled, myId: coop.myId }),
      lag: () => ({ ...team, maxN }),
      title: () => hudTitle(),
      // vem bär vilken del enligt boken (skiftledaren: kollegorna; medarbetaren: alla, ur snappen)
      held: () => Object.fromEntries([...held].map(([by, ix]) => [by, PARTS[ix]?.id || null])),
      carrying: () => carry?.id || null,
      // ny order (skiftledaren/solo): ORDERS[ix] i en tom låda – numret över allt som synts
      setOrder(ix) {
        if (medarb()) return null;
        seq = Math.max(seq, maxNr) + 1; maxNr = seq;
        const i = clamp(ix | 0, 0, ORDERS.length - 1);
        order = { ...ORDERS[i], nr: seq, ix: i };
        box = emptyBox(); power = null; slideOut = null; slideIn = 0;
        if (mate.state === 'in' || mate.state === 'take') { mate.state = 'away'; mate.x = FW + 20; }
        snapAsap();
        return order.nr;
      },
      // där byggaren står när klicket gått fram: 'lada' 'start' 'pasta' 'kylare' eller en hylla (del-id)
      standAt: (id) => { if (id === 'lada' || id === 'start' || TOOL[id]) return [STAND[0], STAND[1]]; const b = binOf(id); return b ? binFront(b) : null; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); },
      // provet: medarbetaren skickar SAMMA önskemål (kylpasta/kylare) två gånger – görs EN gång
      toolTwice: (id) => { if (!medarb() || pend) return false; ask({ t: 'do', a: 'verktyg', id, v: sig(), x: Math.round(walker.px), y: Math.round(walker.py) }, 2); return true; },
      handled: () => handled,   // (skiftledaren) hur många önskemål som körts
      idle: () => !pend && !queued && walker.path.length === 0,
      pending: () => !!pend,
      time: () => t,
      pops: () => popLog.slice(),
    },
  };
  return api;
}
