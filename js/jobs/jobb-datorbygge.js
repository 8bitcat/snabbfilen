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
// _debug: state(), order(), bins() (id, x, y), spot(id) → { x, y } (skärm), pick(id) (ta delen
//   direkt), install() (sätt i det man bär), power(), finish() (spola till slutet av passet),
//   stats.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
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

// ---------- scenen ----------
export function makeJobbDatorbygge(A, { onDone } = {}) {
  let t = 0, done = false, doneT = 0, reported = false;
  const P = planOf(A);   // passets plan: längden (P.seconds) växer med vanan
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  const talk = createSpeech(), talkMate = createSpeech();
  const walker = createWalker({ W: FW, H: FH, left: 6, right: FW - 6, top: WALL_Y + 6, bottom: FH - 10, spawn: [STAND[0], STAND[1] + 20] });
  walker.speed = 118;
  walker.setObstacles([[BENCH.x0, BENCH.top, BENCH.x1, BENCH.y], [PALLET.x0, PALLET.y - 12, PALLET.x1, PALLET.y + 2], [CART.x0, CART.y - 10, CART.x1, CART.y + 2], [360, 188, 372, 200]]);
  const meAt = () => ({ x: walker.px, y: walker.py - 46 });

  // ordern och det som sitter i datorn
  let seq = 0, order = null, box = null, carry = null, power = null, slideIn = 0, slideOut = null;
  const rngOrder = () => ORDERS[(hash(seq, 17, 91) * ORDERS.length) | 0];
  function newOrder() {
    seq += 1;
    order = { ...rngOrder(), nr: seq };
    box = { cpu: null, pasta: false, kylare: false, ram: null, gpu: null, ssd: null, psu: null };
    power = null; slideIn = seq > 1 ? 1 : 0;   // första lådan står redan på bänken
  }
  newOrder();
  const needs = () => ['cpu', 'ram', ...(order.gpu ? ['gpu'] : []), 'ssd', 'psu'];
  const complete = () => needs().every((k) => box[k]) && box.pasta && box.kylare;
  // kollegan som bär iväg den färdiga datorn
  const mate = { look: { ...makeLook(() => 0.37), kid: false, shirt: '#3a7bd5', top: 'tee', hat: 'cap', cap: '#1a2a4a' }, x: FW + 20, y: STAND[1] - 6, state: 'away', carry: false };

  function pickBin(b) {
    if (carry) { talk.say('Jag bär redan något – sätt i det först!', meAt, 2); return; }
    const [x, y] = binFront(b);
    walker.walkTo(x, y, () => { walker.dir = 'up'; carry = { id: b.id }; play('click'); });
  }
  function toBench(fn) { walker.walkTo(STAND[0], STAND[1], () => { walker.dir = 'up'; fn(); }); }
  function install() {
    if (!carry) return;
    const p = partOf(carry.id), want = order[p.kind];
    if (power || slideOut) { pops.add(CASE.x + CASE.w / 2, CASE.y - 4, 'VÄNTA PÅ NÄSTA LÅDA!', '#ffd23f'); return; }
    if (p.kind === 'gpu' && !order.gpu) { wrong('INGET GRAFIKKORT!'); return; }
    if (box[p.kind]) { wrong('SITTER REDAN EN ' + KIND_NAME[p.kind] + '!'); return; }
    if (p.v !== want) { wrong('FEL MODELL!'); return; }
    box[p.kind] = p.v; carry = null;
    stats.ok += 1; play('ok');
    pops.add(CASE.x + CASE.w / 2, CASE.y - 4, '+ ' + KIND_NAME[p.kind], '#8ee03c');
    if (complete()) talk.say('Allt sitter i – tryck på startknappen!', meAt, 3);
  }
  function wrong(msg) {
    stats.fel += 1; play('fel');
    pops.add(CASE.x + CASE.w / 2, CASE.y - 4, msg, '#ff6a5a');
    carry = null;                      // delen åker tillbaka i lådan
  }
  function benchTool(id) {
    // kylpastan och kylaren ligger på bänken bredvid lådan
    if (power || slideOut) { pops.add(CASE.x + CASE.w / 2, CASE.y - 4, 'VÄNTA PÅ NÄSTA LÅDA!', '#ffd23f'); return; }
    if (carry) { talk.say('Sätt i delen jag bär först!', meAt, 2); return; }
    if (!box.cpu) { pops.add(CASE.x + CASE.w / 2, CASE.y - 4, 'PROCESSORN FÖRST!', '#ffd23f'); play('miss'); return; }
    if (id === 'pasta') {
      if (box.pasta) { pops.add(CASE.x + CASE.w / 2, CASE.y - 4, 'PASTAN ÄR PÅ!', '#ffd23f'); return; }
      box.pasta = true; stats.ok += 1; play('click'); pops.add(CASE.x + CASE.w / 2, CASE.y - 4, '+ KYLPASTA', '#8ee03c');
    } else {
      if (box.kylare) return;
      if (!box.pasta) { wrong('KYLPASTA FÖRST!'); return; }
      box.kylare = true; stats.ok += 1; play('ok'); pops.add(CASE.x + CASE.w / 2, CASE.y - 4, '+ KYLARE', '#8ee03c');
    }
    if (complete()) talk.say('Allt sitter i – tryck på startknappen!', meAt, 3);
  }
  function pressPower() {
    if (power || slideOut) return;
    if (!complete()) {
      const miss = [...needs().filter((k) => !box[k]).map((k) => KIND_NAME[k]), ...(!box.pasta ? ['KYLPASTA'] : []), ...(!box.kylare ? ['KYLARE'] : [])];
      pops.add(CASE.x + CASE.w / 2, CASE.y - 4, 'SAKNAS: ' + miss[0], '#ffd23f'); play('miss'); return;
    }
    power = { t: 0 }; play('slide');
  }

  // klickytor
  const hitCase = (x, y) => x >= CASE.x - 4 && x <= CASE.x + CASE.w + 4 && y >= CASE.y - 4 && y <= BENCH.top + 2;
  const TOOL = { pasta: [BENCH.x0 + 4, BENCH.top - 6, BENCH.x0 + 16, BENCH.top + 2], kylare: [BENCH.x0 + 16, BENCH.top - 18, BENCH.x0 + 32, BENCH.top + 2] };
  const inR = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

  function update(dt) {
    pops.update(dt);
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= P.seconds) { done = true; play('fanfare'); return; }
    walker.update(dt);
    if (slideIn > 0) slideIn = Math.max(0, slideIn - dt * 2.2);
    if (power) {
      power.t += dt;
      if (power.t > 2.2 && !slideOut) {
        stats.boxes += 1; play('coin');
        pops.add(CASE.x + CASE.w / 2, CASE.y - 12, 'FÄRDIG DATOR!', '#8ee03c');
        mate.state = 'in'; slideOut = { t: 0 };
        talkMate.say(['Snyggt bygge!', 'Kunden blir glad!', 'Den tar jag!', 'Nästa order kommer!'][seq % 4], () => ({ x: mate.x, y: mate.y - 46 }), 2);
      }
    }
    // kollegan går in, tar datorn och går ut
    if (mate.state === 'in') { mate.x -= 120 * dt; if (mate.x <= CASE.x + CASE.w + 14) { mate.x = CASE.x + CASE.w + 14; mate.state = 'take'; } }
    else if (mate.state === 'take') { slideOut.t += dt; if (slideOut.t > 0.5) { mate.state = 'out'; mate.carry = true; newOrder(); slideOut = null; } }
    else if (mate.state === 'out') { mate.x += 110 * dt; if (mate.x > FW + 24) { mate.state = 'away'; mate.carry = false; } }
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

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update,
    down(x, y) {
      if (done) return;
      if (hitCase(x, y) && Math.abs(x - POWER.x) <= 4 && Math.abs(y - POWER.y) <= 4) { toBench(pressPower); return; }
      for (const [id, r] of Object.entries(TOOL)) if (inR(r, x, y)) { toBench(() => benchTool(id)); return; }
      if (hitCase(x, y)) { toBench(() => (carry ? install() : complete() ? pressPower() : talk.say('Hämta delarna i hyllorna!', meAt, 2))); return; }
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
      talk.draw(ctx, { x0: 0, x1: FW }); talkMate.draw(ctx, { x0: 0, x1: FW });
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: P.seconds, ok: stats.ok, fel: stats.fel, title: `PIXEL DATA - ${stats.boxes} ${stats.boxes === 1 ? 'DATOR' : 'DATORER'}` });
      if (done) drawTimeUp(ctx, A);
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), carry: carry?.id || null, box: { ...box }, order: { ...order }, power: !!power, boxes: stats.boxes, x: Math.round(walker.px), y: Math.round(walker.py), done }),
      order: () => ({ ...order }),
      bins: () => BINS.map((b) => ({ id: b.id, x: b.x + (b.w >> 1), y: b.y + 10 })),
      spot: (id) => { if (id === 'lada') return { x: CASE.x + CASE.w / 2, y: CASE.y + 30 }; if (id === 'start') return { x: POWER.x + 1, y: POWER.y + 1 }; if (TOOL[id]) return { x: (TOOL[id][0] + TOOL[id][2]) >> 1, y: (TOOL[id][1] + TOOL[id][3]) >> 1 }; const b = binOf(id); return b ? { x: b.x + (b.w >> 1), y: b.y + 10 } : null; },
      pick: (id) => { carry = { id }; return carry; },
      install: () => { install(); return { ...box }; },
      tool: (id) => { benchTool(id); return { ...box }; },
      power: () => { pressPower(); return !!power; },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      finish: () => { t = P.seconds - 0.01; update(0.02); for (let i = 0; i < 60; i++) update(0.05); },
      wanted: () => { const o = order; return PARTS.filter((p) => o[p.kind] === p.v).map((p) => p.id); },
    },
  };
}
