// FLYGTERMINALEN – Pixelstadens flygplats inifrån (scen 'terminal'). Hallen är 1440 px
// bred (tre och en halv skärm – kameran följer figuren) och stänger aldrig: dag, kväll
// och natt går det flyg. Bakom allt en hel vägg av STORA GLASFÖNSTER ut mot plattan.
//
// Från vänster till höger:
//   ANKOMST + BAGAGEBANDET: ankommande resenärer kommer ut ur ankomstgången och väntar
//     vid karusellen där väskorna glider ner för rutschen och snurrar runt. Bagagechefen
//     (varselväst) erbjuder ett pass vid bandet – det befintliga bagagejobbet.
//   ENTRÉN: den murade entréväggen med skjutdörrarna ut mot stan (korridoren till taxi
//     och buss syns genom glaset), den stora AVGÅNGAR-tavlan som bläddrar (split-flap),
//     uttagsautomat, bagagevagnar och en kompassros i golvet.
//   INCHECKNINGEN: fyra diskar med bagagevåg, skärmar och ett uppsamlingsband bakom som
//     tar väskorna in i luckan, en kö mellan bandspärrar. Stationschefen erbjuder ett
//     pass i incheckningen.
//   SÄKERHETSKONTROLLEN: glasväggar, röntgenmaskin med rullband och lådor, metallbågen
//     (piper grönt – ibland rött) och två vakter. Man går genom bågen till gaterna.
//   AVGÅNGSHALLEN: gate A1 och A2 med bryggor ut till planen, rader av väntstolar där
//     resenärer läser, sover, tittar i mobilen, barn som springer, kaffebaren PIXEL
//     KAFFE och toaletterna längst in.
//
// Genom glaset (två lager: det bortre rullar i halv fart = djup): himmel med moln, sol,
// måne och stjärnor, Pixelstadens silhuett, flygledartornet, hangarer, vindkraftverk,
// rullbanan där plan landar (hjulen fälls ut, landningsljus, rökpuff vid sättningen)
// och lyfter. Närmast: plattan med två plan vid gaterna (sedda rakt framifrån, bryggor,
// blinkande lampor), en uppställningsplats där plan taxar in efter signalgubbens stavar
// med trappbil och buss, tankbilen som kör fram och tankar, bagagetåg, bussar och
// follow-me-bilen på servicevägen. På kvällen och natten: landningsljus, blinkande
// vinglampor, strålkastarmaster med ljuskäglor, blå och gröna taxibanljus.
//
// Figuren kan sätta sig på en ledig stol (sitt-bildrutan), prata med folk (repliker i
// pratbubblor ovanför den som pratar – aldrig rutor överst) och högtalarna gör utrop
// som pratbubblor. Allt statiskt målas pixel för pixel med Pix-pennan EN gång per
// ljusläge – det som rör sig ritas varje bildruta. Ett pixelkorn: heltal, skala 1.
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { play, audioContext, isMuted } from '../core/sound.js';
import { JOBS } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, nameTag, emoteBubble, createSpeech } from './walkable.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';

const talk = createSpeech(); // repliker från folk (och figuren själv) som pratbubblor
const pa = createSpeech();   // högtalarutropen – en egen bubbla från högtalaren
const chat = createSpeech(); // småprat i bakgrunden (personalen, barnen, föräldern) – tyst

// ======================= mått (världskoordinater) =======================
const W = 1440, H = 216;
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till hallen
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, 640)); };
const GT = 10, GB = 90;                  // glasväggens över-/underkant
const WALL_Y = 96;                       // där golvet möter glasväggen
const TRANSOM = 34;                      // tvärposten i glaset
const FAR_H = 58, NEAR_Y = 58, NEAR_H = 34; // lagren utanför: bortre (himmel–rullbana) och plattan
const ARR = { x0: 0, x1: 28 };           // ankomstgången längst till vänster
const ENTRY = { x0: 290, x1: 470 };      // den murade entréväggen
const DOOR = { x0: 352, x1: 408, top: 66 }; // skjutdörrarna ut mot stan
const WCW = { x0: 1384, x1: 1440 };      // toalettväggen längst till höger
const BOARD = { x: 296, y: 12, w: 168, h: 50 }; // avgångstavlan över dörren
const COLS = [272, 1048, 1258];           // runda pelare framför glaset
const MULL = 48;                         // spröjsavstånd
const DOOR_SPOT = [380, 104];
// incheckningen
const DESKS = [0, 1, 2, 3].map((k) => ({ k, x0: 494 + k * 74, x1: 546 + k * 74, sx0: 474 + k * 74 }));
const DESK_Y = 124;                      // diskens framkant (golvlinje)
const FASCIA = 36;                       // diskskyltarna hänger i taket (så att man ser ut mellan dem)
const AGENT_Y = 110;
const BELT = { x0: 486, x1: 790, y: 98 };  // uppsamlingsbandet bakom diskarna
const HATCH = { x0: 470, x1: 492 };      // luckan där väskorna försvinner
const LANE = { x0: 488, x1: 790, y: 138, bar: 148 }; // kön mellan diskarna och bandspärren
const MANAGER = { x: 784, y: 162 };
// säkerhetskontrollen
const SEC = { x0: 796, x1: 896, y: 140 };
const XRAY = { x0: 800, x1: 832 };
const ARCH = { x: 846, p0: 836, p1: 852 };  // bågens stolpar: [p0, p0+4] och [p1, p1+4]
const GUARD1 = { x: 874, y: 124 }, GUARD2 = { x: 872, y: 158 };
// bagagebandet (karusellen)
const CAR = { cx: 150, cy: 148, rx: 92, ry: 17 };
const CHUTE = { x0: 141, x1: 159, top: 80 };
const FEED = { x0: 126, x1: 174, top: 60 };
const CHIEF = { x: 266, y: 142 };
// gaterna
const GATES = [{ id: 'A1', x: 1000, plane: 940, liv: 0, scr: 1 }, { id: 'A2', x: 1216, plane: 1156, liv: 1, scr: -1 }]; // x = dörren i glasväggen (bryggans ände)
const KIOSK = { x0: 1262, x1: 1378, y: 126 };
const LOOK_SPOTS = [906, 920, 934, 948, 1136, 1150, 1164, 1016];  // vid fönstret i avgångshallen
const WC_DOOR = { x0: 1400, x1: 1424 };
const PLANTS = [{ x: 462, y: 110, k: 0 }, { x: 1250, y: 112, k: 1 }, { x: 30, y: 206, k: 1 }, { x: 918, y: 210, k: 0 }];
const BINS = [{ x: 432, y: 108 }, { x: 1094, y: 112 }, { x: 252, y: 206 }];
const SPEAKERS = [{ x: 272, y: 58 }, { x: 640, y: 46 }, { x: 904, y: 46 }, { x: 1048, y: 58 }, { x: 1258, y: 58 }];

// ======================= små målarverktyg =======================
const WHITE = 0xffffff, INK = 0x17151a;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
// färg med lätt brus (hash + bayer) → levande ytor utan platta fält
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
// kvantiserad gradient med bayer-dither (3–4 toner i stället för mjuk övergång)
function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(clamp(t, 0, 1) * steps + bayer(x, y)) / steps;
  return mix(a, b, clamp(q, 0, 1));
}
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = fn(x + i, y + j, i, j);
    if (c !== null && c !== undefined) P.px(x + i, y + j, c);
  }
}
function rows(P, x, y, w, cs) { cs.forEach((c, i) => { if (c !== null) P.hl(x, y + i, w, c); }); }
function vcols(P, x, y, h, cs) { cs.forEach((c, i) => { if (c !== null) P.vl(x + i, y, h, c); }); }
// mörk kontur runt allt som är målat i en Pix (tonad efter grannfärgen)
function outline(P, dark = 0x1a1820) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] > 200) { best = j; break; }
    }
    if (best < 0) continue;
    const o = mix(dark, (src[best] << 16) | (src[best + 1] << 8) | src[best + 2], 0.28);
    d[i] = (o >> 16) & 255; d[i + 1] = (o >> 8) & 255; d[i + 2] = o & 255; d[i + 3] = 255;
  }
}
// glasreflex: diagonala strimmor och en ljusare överkant
function reflect(P, x, y, w, h, str = 1, seed = 0, tint = 0xeef7ff) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, s = ((((X + seed) * 2 - Y * 3) % 67) + 67) % 67;
    let a = s < 5 ? 0.16 : s < 7 ? 0.08 : s === 14 || s === 15 ? 0.07 : 0;
    a += (1 - j / h) * 0.05;
    if (a > 0) P.px(X, Y, tint, a * str);
  }
}
// rund knopp/lampa: mörk kant, färg, ljusprick
function knob(P, cx, cy, r, c) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 0.3) continue;
    P.px(cx + x, cy + y, d > r - 0.7 ? mul(c, 0.45) : x + y < -r * 0.6 ? mix(c, WHITE, 0.5) : x + y > r * 0.6 ? mul(c, 0.75) : c);
  }
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// pixeltext som liten bild (cachad) – billigare än att rita punkt för punkt varje bildruta
const TXT = new Map();
function ctext(ctx, s, x, y, color) {
  const k = s + '|' + color;
  let c = TXT.get(k);
  if (!c) {
    c = mkCanvas(Math.max(1, textW(SMALL, s) + 1), 7);
    ctxText(c.getContext('2d'), SMALL, s, 0, 1, color);
    if (TXT.size > 500) TXT.clear();
    TXT.set(k, c);
  }
  ctx.drawImage(c, Math.round(x), Math.round(y) - 1);
}
function glowImg(rx, ry, c, amax, steps = 4) {
  const P = new Pix(Math.ceil(rx) * 2 + 2, Math.ceil(ry) * 2 + 2);
  P.ell(P.w / 2, P.h / 2, rx, ry, c, amax, steps);
  return P.flush();
}
// linje med heltalspixlar direkt på canvasen
function pline(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 400; n++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// text med skugga i en Pix (skyltar)
function stext(P, F, s, x, y, c, sh = 0x000000, sa = 0.5) {
  if (sh !== null) text(P, F, s, x + 1, y + 1, sh, sa);
  text(P, F, s, x, y, c);
}

// ======================= ljusläget =======================
// dag · kväll (solnedgång) · natt · gryning. Flygplatsen stänger aldrig.
function modeOf(h) {
  if (h >= 7 && h < 17.5) return 'dag';
  if (h >= 17.5 && h < 21.75) return 'kvall';
  if (h >= 5 && h < 7) return 'gryning';
  return 'natt';
}
// hur mycket inneljuset (lampor, skyltar) märks: 0 dag … 1 natt
function lampLevel(h) {
  if (h >= 7.5 && h < 17) return 0;
  if (h >= 17 && h < 21) return (h - 17) / 4;
  if (h >= 5 && h < 7.5) return (7.5 - h) / 2.5;
  return 1;
}
const SKY = {
  dag: { top: 0x3e86d6, mid: 0x7cb6e6, hor: 0xd4ecf6, cloud: 0xffffff, cloudLo: 0xc6d6e6, far: 0x9ab2c4, far2: 0x86a0b4, tree: 0x46684e, grass: 0x78a058, grass2: 0x6a9450, run: 0x5c5e64, conc: 0xb4b6b0, conc2: 0xa2a49e, asph: 0x505258, bld: 0xd6dade, win: 0x5a7a96 },
  kvall: { top: 0x23265e, mid: 0x6a4282, hor: 0xf08e56, sun: 0xffd890, cloud: 0xf29a82, cloudLo: 0x7a4a72, far: 0x5a4668, far2: 0x6e5474, tree: 0x2a2234, grass: 0x3c4232, grass2: 0x343a2c, run: 0x3a3a44, conc: 0x7c7682, conc2: 0x6c6672, asph: 0x3a3842, bld: 0x9a8898, win: 0xffd070 },
  natt: { top: 0x060a20, mid: 0x0c1434, hor: 0x1c2850, cloud: 0x222c54, cloudLo: 0x141a36, far: 0x151a30, far2: 0x1a2038, tree: 0x0a0d16, grass: 0x121812, grass2: 0x0e140e, run: 0x202228, conc: 0x3a3e4a, conc2: 0x333644, asph: 0x1c1e26, bld: 0x3a4054, win: 0xffd070 },
  gryning: { top: 0x2c3a78, mid: 0x7a78b0, hor: 0xf4b8a0, sun: 0xfff0c0, cloud: 0xf0c0c8, cloudLo: 0x8a7ca0, far: 0x6a6a8a, far2: 0x7a789a, tree: 0x2c3040, grass: 0x44503e, grass2: 0x3c4638, run: 0x42424e, conc: 0x8a8894, conc2: 0x7a7884, asph: 0x42404a, bld: 0xa8a4b4, win: 0xffd890 },
};
// allt ute tonas efter ljuset (plan, bilar, folk)
function tintOf(mode) {
  if (mode === 'dag') return (c) => c;
  if (mode === 'kvall') return (c) => mix(mul(c, 0.78), 0xff9460, 0.12);
  if (mode === 'gryning') return (c) => mix(mul(c, 0.78), 0xd8a8d0, 0.12);
  if (mode === 'nattlit') return (c) => mix(mul(c, 0.72), 0xffd8a8, 0.1); // saker ute i strålkastarljuset
  if (mode === 'nattfar') return (c) => mix(mul(c, 0.56), 0x3a4a7a, 0.2);  // planen borta vid rullbanan
  return (c) => mix(mul(c, 0.4), 0x26345e, 0.24);
}
const lightsOn = (mode) => mode !== 'dag';
const objMode = (mode) => (mode === 'natt' ? 'nattlit' : mode);

// ======================= flygen (tavlan, skärmarna, utropen) =======================
const DEST = ['LONDON', 'OSLO', 'PARIS', 'BERLIN', 'HELSINKI', 'ROM', 'VISBY', 'MALAGA', 'ATEN', 'NEW YORK', 'LULEÅ', 'MADRID', 'TOKYO', 'KIRUNA', 'PRAG', 'MALMÖ', 'DUBAI', 'NICE', 'GÖTEBORG', 'WIEN', 'ISTANBUL', 'KRETA', 'MALLORCA', 'LISSABON', 'BANGKOK', 'UMEÅ', 'BRYSSEL', 'RIGA', 'TALLINN', 'DUBLIN'];
const GATE_IDS = ['A1', 'A2', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4'];
// dygnets avgångar: tätt på dagen, glest på natten (flygplatsen stänger aldrig)
function flightsOf(day) {
  const F = [];
  // dagens ordning på destinationerna: blandad, men samma hela dagen
  const order = DEST.map((d, k) => [hash(k, day, 43), d]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  let m = 0, i = 0;
  while (m < 24 * 60) {
    const night = m < 5 * 60 + 30 || m >= 23 * 60;
    const d = (day * 97 + i) | 0;
    F.push({
      m, key: day * 1000 + i,
      dest: order[i % order.length],
      no: (hash(d, 2, 41) < 0.7 ? 'SF ' : 'PX ') + (100 + Math.floor(hash(d, 3, 41) * 880)),
      gate: GATE_IDS[Math.floor(hash(d, 4, 41) * GATE_IDS.length)],
      late: hash(d, 5, 41) < 0.14 ? 15 + Math.floor(hash(d, 6, 41) * 5) * 10 : 0,
      off: hash(d, 7, 41) < 0.025,
    });
    m += night ? 55 + Math.floor(hash(d, 8, 41) * 60) : 14 + Math.floor(hash(d, 9, 41) * 26);
    i++;
  }
  return F;
}
const hhmm = (m) => { const v = ((Math.floor(m) % 1440) + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
// status efter hur långt det är kvar (minuter)
function statusOf(f, now) {
  if (f.off) return { s: 'INSTÄLLD', c: 0xff5a4a, blink: false };
  const left = f.m + f.late - now;
  if (f.late && left > 12) return { s: 'FÖRSENAD', c: 0xffb030, blink: false };
  if (left <= 4) return { s: 'STÄNGD', c: 0xff5a4a, blink: false };
  if (left <= 12) return { s: 'STÄNGER', c: 0xffd23a, blink: true };
  if (left <= 40) return { s: 'BOARDING', c: 0x5aff8a, blink: true };
  return { s: 'I TID', c: 0xd8e4f0, blink: false };
}

// ======================= flygplanen =======================
const LIVERY = [0x2a6ad0, 0xd8303a, 0x1e8a7a, 0xe07a1e, 0x6a3ab0];
// Planet från sidan, rastrerat pixel för pixel ur en form (så att det kan luta – nosen upp
// vid starten – utan att någon bild skalas eller roteras). L = längd, pitch = grader nosen
// upp, gear 0..1 (hjulen fälls ut), dir +1 = nosen åt höger. Förankring (0, 0) = där
// huvudhjulen möter marken. u = 0 vid stjärten … L vid nosen, v = 0 på mittlinjen (+ ner).
function sideGeom(L) {
  const r = Math.max(2, Math.round(L * 0.056 * 2) / 2), gl = Math.max(2, Math.round(r * 1.15));
  return { L, r, gl, yc: -(r + gl) };
}
function sideSample(u, v, G, liv, gear, lit, T) {
  const { L, r, gl } = G;
  const body = T(0xf2f4f6), hi = T(0xffffff), belly = T(0xc4c8ce), line = T(0x6a7078), dark = T(0x2a3440);
  const livc = T(liv);
  // --- landningsställ (framför kroppen) ---
  if (gear > 0) {
    const gb = r + gl * gear;
    for (const [gu, half] of [[0.86 * L, 1], [0.5 * L, 2]]) {
      if (Math.abs(u - gu) <= half + 0.5 && v >= gb - 2 && v <= gb) return T(0x1a1a1e);
      if (Math.abs(u - gu) < 0.5 && v > r * 0.8 && v < gb - 2) return T(0x7a8088);
    }
  }
  // --- motorn under vingen, med pylon ---
  const ec = 0.6 * L, ev = r * 1.08, ea = Math.max(2.2, 0.075 * L), eb = Math.max(1.2, r * 0.55);
  const ed = ((u - ec) / ea) ** 2 + ((v - ev) / eb) ** 2;
  if (ed <= 1) {
    if (u > ec + ea * 0.78) return T(0x3a3e46);
    if (u < ec - ea * 0.8) return T(0x4a4e56);
    if (v < ev - eb * 0.55) return mix(body, hi, 0.5);
    if (v > ev + eb * 0.5) return T(0xa8aeb6);
    return u < ec - ea * 0.4 ? livc : T(0xe4e8ec);
  }
  if (u > ec - ea * 0.4 && u < ec + ea * 0.2 && v > r * 0.4 && v < ev - eb * 0.7) return T(0x9aa0a8);
  // --- vingen (från sidan en tunn kil) ---
  const wt = Math.max(1, r * 0.22);
  if (v >= r * 0.42 && v < r * 0.42 + wt + 0.2 && u > 0.36 * L && u < 0.63 * L) return v < r * 0.42 + 1 ? T(0xdfe3e8) : T(0x8a9098);
  // --- höjdrodret ---
  if (u >= -0.3 && u < 0.15 * L && v >= -0.4 * r && v < -0.4 * r + Math.max(1, r * 0.2) + 0.2) return u > 0.13 * L ? T(0xd8dce2) : T(0xa8b0ba);
  // --- kroppen ---
  let top, bot;
  if (u > 0.86 * L) {
    const nt = (u - 0.86 * L) / (0.14 * L), h = r * Math.sqrt(Math.max(0, 1 - nt ** 1.8)), c = nt * r * 0.3;
    top = c - h; bot = c + h;
  } else {
    top = -r + (1 - Math.min(1, u / (0.1 * L))) * r * 0.35;
    bot = u < 0.28 * L ? lerp(-0.25 * r, r, (u / (0.28 * L)) ** 0.85) : r;
  }
  if (u >= 0 && u <= L && v >= top && v <= bot) {
    if (v < top + 1) return hi;
    if (u > 0.875 * L && u < 0.935 * L && v < top + 1 + Math.max(1, r * 0.35)) return lit ? 0x3a6a5a : dark;
    if (v >= -0.48 * r && v < -0.48 * r + Math.max(1, r * 0.26) && u > 0.2 * L && u < 0.83 * L && (L < 60 ? Math.floor(u) % 2 === 0 : Math.floor(u) % 3 !== 2)) return lit ? 0xffe6a0 : dark;
    if (L >= 60 && (Math.abs(u - 0.84 * L) < 0.5 || Math.abs(u - 0.2 * L) < 0.5) && v > -0.62 * r && v < 0.5 * r) return line;
    if (v >= 0.08 * r && v < 0.08 * r + Math.max(1, r * 0.28) && u > 0.1 * L && u < 0.9 * L) return livc;
    if (v > bot - 1) return line;
    if (v > bot - Math.max(1, r * 0.4)) return belly;
    return body;
  }
  // --- stjärtfenan (bakom kroppen) ---
  const fh = 0.24 * L, ftop = -r - fh;
  if (v >= ftop && v < -r * 0.6) {
    const k = (-r - v) / fh; // 0 vid roten … 1 i toppen
    const ule = 0.2 * L - 0.1 * L * k, ute = 0.035 * L * Math.max(0, k);
    if (u >= ute && u <= ule) {
      if (v < ftop + 1) return mix(livc, hi, 0.35);
      if (u > ule - 1) return mix(livc, hi, 0.3);
      const lx = 0.11 * L, ly = -r - fh * 0.5, lr = Math.max(1, 0.035 * L);
      if (Math.hypot(u - lx, (v - ly) * 1.1) < lr) return Math.hypot(u - lx, (v - ly) * 1.1) < lr * 0.45 ? mix(livc, hi, 0.2) : hi;
      return u < ute + 1 ? mul(livc, 0.8) : livc;
    }
  }
  return null;
}
const SIDE_IMG = new Map();
function sidePlane(L, liv, pitch, gear, mode, dir, ol = true) {
  const pi = Math.round(pitch / 2) * 2, gi = Math.round(gear * 2) / 2;
  const key = [L, liv, pi, gi, mode, dir, ol].join('|');
  let s = SIDE_IMG.get(key);
  if (s) return s;
  const G = sideGeom(L), T = tintOf(mode), lit = lightsOn(mode);
  const th = pi * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  // ramen: rotera lådans hörn
  const us = [-2, L + 2], vs = [-G.r - 0.26 * L - 2, G.r + G.gl + 3];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const u of us) for (const v of vs) {
    const xp = u - 0.5 * L, yp = v + G.yc;
    const X = (xp * cs + yp * sn) * dir, Y = -xp * sn + yp * cs;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  const ox = Math.ceil(-x0) + 1, oy = Math.ceil(-y0) + 1, w = Math.ceil(x1 - x0) + 3, h = Math.ceil(y1 - y0) + 3;
  const P = new Pix(w, h);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const X = (px - ox + 0.5) * dir, Y = py - oy + 0.5;
    const xp = X * cs - Y * sn, yp = X * sn + Y * cs;
    const c = sideSample(xp + 0.5 * L, yp - G.yc, G, LIVERY[liv % LIVERY.length], gi, lit, T);
    if (c !== null) P.px(px, py, c);
  }
  if (ol) outline(P, mode === 'dag' ? 0x2a3040 : 0x0a0c18);
  s = { img: P.flush(), ox, oy, G };
  SIDE_IMG.set(key, s);
  return s;
}
// en punkt på planet (u, v) → förskjutning från förankringen (för lampor och rök)
function sidePt(G, pitch, dir, u, v) {
  const th = pitch * Math.PI / 180, xp = u - 0.5 * G.L, yp = v + G.yc;
  return [(xp * Math.cos(th) + yp * Math.sin(th)) * dir, -xp * Math.sin(th) + yp * Math.cos(th)];
}

// Planet rakt framifrån vid gaten (nosen mot oss): runda kroppen, cockpitfönstren,
// vingarna med uppåtvinkel och winglets, motorerna med fläkt och spinner, fenan bakom,
// landningsstället. Målas direkt i plattans lager. (cx, gy) = mitten på marken.
const NOSE = { R: 13, lift: 27, span: 100, eng: 40, er: 10, fin: 34 };
function paintNosePlane(P, cx, gy, liv, T, mode) {
  const lv = T(LIVERY[liv]), body = T(0xf2f4f6), hi = T(0xffffff), lo = T(0xb8bec6), line = T(0x5a6068);
  const lit = mode !== 'dag', { R, span } = NOSE, fx = cx, fy = gy - NOSE.lift;
  // markskugga
  P.ell(cx, gy, span + 6, 3.5, 0x0c0a14, mode === 'dag' ? 0.32 : 0.5, 3);
  // fenan och höjdrodret (bakom kroppen)
  const ft = fy - R - NOSE.fin + 3;
  for (let y = ft; y < fy - R + 4; y++) {
    const wdt = y < ft + 12 ? 3 : 4;
    for (let i = 0; i < wdt; i++) P.px(cx - 2 + i, y, y === ft ? mix(lv, hi, 0.4) : i === 0 ? mix(lv, hi, 0.25) : i === wdt - 1 ? mul(lv, 0.72) : lv);
  }
  for (const s of [-1, 1]) for (let i = 3; i <= 36; i++) {
    const y = fy - 11 - Math.round((i - 3) / 11);
    P.px(cx + s * i, y, T(0xe4e8ec)); P.px(cx + s * i, y + 1, T(0x9aa0a8));
    if (i > 30) P.px(cx + s * i, y + 1, T(0x7a8088));
  }
  // vingarna (roten nere vid kroppen, tippen högre upp) + winglets
  for (const s of [-1, 1]) {
    const n = span - 12;
    for (let k = 0; k <= n; k++) {
      const x = cx + s * (12 + k), t = k / n, yt = Math.round(gy - 20 - t * 10), th = Math.max(1, Math.round(5 - t * 4));
      P.px(x, yt, T(0xf4f6f8));
      for (let j = 1; j < th; j++) P.px(x, yt + j, j === th - 1 ? T(0x6a7078) : j === 1 ? T(0xd0d4da) : T(0xaab0b8));
      if (k === 20 || k === 44 || k === 66) { P.px(x, yt + th, T(0x9aa0a8)); P.px(x, yt + th + 1, T(0x7a8088)); }
    }
    const tx = cx + s * span, ty = gy - 30;
    for (let j = 0; j < 10; j++) { P.px(tx, ty - j, j === 9 ? mix(lv, hi, 0.4) : lv); P.px(tx + s, ty - j, mul(lv, 0.75)); }
  }
  // motorerna: kåpa i flygbolagets färg, läpp, mörkt intag, fläkt och spinner
  for (const s of [-1, 1]) {
    const ex = cx + s * NOSE.eng, ey = gy - 16, er = NOSE.er;
    for (let y = -er - 1; y <= er + 1; y++) for (let x = -er - 1; x <= er + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > er + 0.3) continue;
      let c;
      if (d > er - 1.4) c = y < -3 ? mix(lv, hi, 0.3) : y > 3 ? mul(lv, 0.68) : lv;
      else if (d > er - 2.4) c = y < 0 ? T(0xeef0f2) : T(0xa0a6ae);
      else if (d > er - 4.2) c = T(0x1e2228);
      else if (d > 1.8) c = ((Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI * 2) * 16) & 1) ? T(0x4a4e58) : T(0x363a44));
      else c = T(0xe0e4e8);
      P.px(ex + x, ey + y, c);
    }
    P.px(ex - 1, ey - 1, hi); P.px(ex + 1, ey + 1, T(0x5a6068)); P.px(ex, ey, T(0x8a9098));
  }
  // kroppen: ett runt tvärsnitt med ljus uppe till vänster
  for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
    const d = Math.hypot(x, y);
    if (d > R + 0.4) continue;
    const nx = x / R, ny = y / R, l = -(nx * 0.55 + ny * 0.8);
    let c = d > R - 0.8 ? line : l > 0.62 ? hi : l < -0.5 ? lo : body;
    if (ny > 0.6 && d <= R - 0.8) c = mix(c, lo, 0.55);
    if (ny > 0.3 && ny < 0.42 && Math.abs(nx) > 0.62 && d <= R - 0.8) c = lv; // fuskstrecket syns på sidorna
    P.px(fx + x, fy + y, c);
  }
  // noskonen (en ljusare ring nedtill) + cockpitfönstren
  for (let a = 0; a < 60; a++) {
    const ang = a / 60 * Math.PI;
    P.px(Math.round(fx + Math.cos(ang) * 8), Math.round(fy + 1 + Math.sin(ang) * 8), mix(body, lo, 0.6));
  }
  P.px(fx, fy + 2, mix(body, hi, 0.6)); P.px(fx + 1, fy + 3, lo);
  const cockpit = lit ? 0x2a5a4a : T(0x1e2a36);
  for (const [a, b, dy] of [[-11, -8, 2], [-6, -1, 0], [1, 6, 0], [8, 11, 2]]) {
    for (let x = a; x <= b; x++) for (let r = 0; r < 3; r++) P.px(fx + x, fy - 8 + dy + r, cockpit);
    P.px(fx + a, fy - 8 + dy, lit ? 0x4a8a7a : T(0x9ac0e0)); P.px(fx + a + 1, fy - 8 + dy, lit ? 0x3a7a6a : T(0x6a90b0));
  }
  P.hl(fx - 9, fy - 9, 19, T(0xe8ecf0));
  // landningsstället
  P.vl(fx, gy - 14, 9, T(0x9aa0a8)); P.vl(fx + 1, gy - 14, 9, T(0x6a7078));
  for (const wx of [-4, 2]) { P.rect(fx + wx, gy - 5, 3, 5, T(0x16161a)); P.px(fx + wx + 1, gy - 3, T(0x6a6e76)); }
  P.px(fx, gy - 9, lit ? 0xfffbe8 : T(0xd8dce2));
  for (const s of [-1, 1]) {
    const gx = fx + s * 22;
    P.vl(gx, gy - 19, 14, T(0x9aa0a8)); P.vl(gx + s, gy - 19, 14, T(0x5a6068));
    for (const wx of [-6, 2]) { P.rect(gx + wx, gy - 5, 4, 5, T(0x16161a)); P.px(gx + wx + 1, gy - 3, T(0x6a6e76)); P.px(gx + wx + 2, gy - 3, T(0x4a4e56)); }
  }
}
// Bryggan från terminalen ut till planets dörr (på planets vänstra sida = vår högra).
function paintBridge(P, cx, gy, T, mode) {
  const lit = mode !== 'dag';
  const xa = cx + 19, xb = cx + 60, fy = gy - NOSE.lift;
  // bälgen vid dörren
  for (let y = fy - 12; y <= fy + 9; y++) for (let x = cx + 10; x <= xa; x++) P.px(x, y, (x & 1) ? T(0x3a3e46) : T(0x5a5e66));
  P.rect(cx + 11, fy - 9, 3, 15, lit ? 0xffd890 : T(0x1e2026));
  // benen och hjulboggin
  for (const lx of [cx + 36, cx + 41]) { P.vl(lx, gy - 12, 11, T(0x7a8088)); P.vl(lx + 1, gy - 12, 11, T(0x4a4e56)); }
  P.rect(cx + 33, gy - 2, 12, 2, T(0x3a3e46)); P.rect(cx + 33, gy, 4, 3, T(0x16161a)); P.rect(cx + 41, gy, 4, 3, T(0x16161a));
  // röret: mörkt golv, sidan med fönsterrad, ljust tak
  for (let x = xa; x <= xb; x++) {
    const t = (x - xa) / (xb - xa), top = Math.round(lerp(fy - 13, 72, t)), bot = Math.round(lerp(fy + 10, 89, t));
    for (let y = top; y <= bot; y++) {
      const k = (y - top) / (bot - top);
      let c = y === top ? T(0xf0f2f4) : y === top + 1 ? T(0xc8ccd2) : k > 0.84 ? T(0x4a4e56) : k > 0.78 ? T(0x6a7078) : T(0xa4acb6);
      if (k > 0.28 && k < 0.56 && (x - xa) % 6 !== 0) c = lit ? mix(0xffe8b0, 0xc89a50, k) : (k < 0.36 ? T(0x7a9ab8) : T(0x3a5068));
      if ((x - xa) % 12 === 11 && k > 0.12 && k < 0.78) c = T(0x7a8088);
      P.px(x, y, c);
    }
  }
  // rotundan vid terminalen
  area(P, xb - 5, 70, 11, 20, (X, Y, i, j) => (j === 0 ? T(0xf0f2f4) : i === 0 ? T(0xd8dce2) : i === 10 ? T(0x5a6068) : i > 7 ? T(0x8a9098) : T(0xb0b8c2)));
}

// ======================= fordonen på plattan (från sidan) =======================
// Varje fordon målas en gång per ljusläge och riktning. put(u, y): u = bakifrån 0 → fram.
const VEH = new Map();
function vehicle(kind, dir, mode, variant = 0) {
  const key = kind + dir + mode + variant;
  let v = VEH.get(key);
  if (v) return v;
  const T = tintOf(mode), lit = lightsOn(mode);
  const dims = { tank: [40, 16], tug: [13, 10], cart: [15, 11], bus: [46, 17], follow: [17, 10], stairs: [36, 24], gpu: [12, 8] }[kind];
  const [w, h] = dims, P = new Pix(w, h);
  const put = (u, y, c) => P.px(dir > 0 ? u : w - 1 - u, y, c);
  const rect = (u, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(u + i, y + j, c); };
  const wheel = (u, y) => { rect(u - 1, y, 3, 3, T(0x16161a)); put(u, y + 1, T(0x7a7e86)); };
  if (kind === 'tank') {
    // tankbilen: vit tank med rött band, slangvinda bak, hytt fram, gult blinkljus
    rect(0, 12, 40, 1, T(0x2a2c30));
    for (let u = 1; u <= 28; u++) for (let y = 3; y <= 11; y++) {
      let c = y === 3 ? T(0xffffff) : y === 4 ? T(0xf4f4f0) : y >= 10 ? T(0xb8bcc0) : T(0xe6e8e4);
      if (y === 8) c = T(0xd8303a);
      if (u === 1 || u === 28) c = mul(c, 0.82);
      put(u, y, c);
    }
    rect(2, 2, 25, 1, T(0x9aa0a8)); for (let u = 4; u < 26; u += 5) put(u, 1, T(0x9aa0a8)); // räcke
    rect(0, 6, 4, 5, T(0x3a3e46)); put(1, 7, T(0x8a9098)); put(2, 8, T(0x6a7078));        // slangvindan
    for (let y = 4; y < 11; y++) put(5, y, T(0x6a7078));                                  // stege
    rect(30, 2, 9, 10, T(0xe8e8e0)); rect(30, 2, 9, 1, T(0xffffff));
    rect(33, 3, 5, 3, lit ? T(0x3a4a5a) : T(0x6a9ac0)); put(33, 3, T(0xcfe4f4));
    rect(30, 9, 9, 1, T(0xd8303a));
    put(39, 9, lit ? 0xfff6c0 : T(0xf0f0e0)); put(0, 10, 0xd8303a);
    rect(34, 1, 2, 1, T(0xe08a1e));
    for (const u of [7, 14, 34]) wheel(u, 12);
  } else if (kind === 'tug') {
    // bagagetraktorn: gul, störtbåge, förare i varselväst
    rect(0, 5, 13, 3, T(0xf0c020)); rect(0, 5, 13, 1, T(0xffe070)); rect(0, 7, 13, 1, T(0xb08a10));
    put(2, 1, T(0x3a3e46)); put(2, 2, T(0x3a3e46)); put(2, 3, T(0x3a3e46)); put(2, 4, T(0x3a3e46));
    put(9, 2, T(0x3a3e46)); put(9, 3, T(0x3a3e46)); put(9, 4, T(0x3a3e46)); rect(2, 1, 8, 1, T(0x3a3e46));
    rect(5, 2, 2, 2, T(0xe0a97f)); rect(5, 4, 2, 1, T(0xf07a1e)); put(5, 2, T(0x2a1a14));
    put(12, 6, lit ? 0xfff6c0 : T(0xf0f0e0));
    wheel(3, 8); wheel(10, 8);
  } else if (kind === 'cart') {
    // bagagevagn med kapell och väskor
    const tarp = T([0x2e5a9a, 0x9a3a3a, 0x3a7a4a][variant % 3]);
    rect(0, 7, 14, 1, T(0x9aa0a8)); rect(0, 8, 14, 1, T(0x5a6068));
    for (const u of [1, 12]) for (let y = 1; y < 7; y++) put(u, y, T(0x7a8088));
    rect(0, 0, 14, 2, tarp); rect(0, 0, 14, 1, mix(tarp, WHITE, 0.3));
    rect(1, 2, 2, 3, mul(tarp, 0.8)); rect(11, 2, 2, 3, mul(tarp, 0.8));
    const bags = [0x6a5030, 0x3a5a7c, 0x8e5bd1, 0x2aa39a, 0x9a3a4a, 0x4a4a52];
    for (let k = 0; k < 3; k++) { const c = T(bags[(k + variant * 2) % bags.length]); rect(3 + k * 3, 4 - (k % 2), 3, 3 + (k % 2), c); put(3 + k * 3, 4 - (k % 2), mix(c, WHITE, 0.3)); }
    put(14 - 0, 7, T(0x5a6068));
    wheel(3, 9); wheel(11, 9);
  } else if (kind === 'bus') {
    // plattbussen: låggolv, stora fönster, tre dörrar
    rect(0, 1, 46, 12, T(0xe8ecf0)); rect(0, 0, 46, 1, T(0xc8ccd2)); rect(1, 1, 44, 1, T(0xffffff));
    rect(0, 11, 46, 2, T(0x2a6ad0)); rect(0, 13, 46, 1, T(0x2a2c30));
    for (let u = 2; u < 44; u++) for (let y = 3; y <= 8; y++) {
      if ((u - 2) % 7 === 6) continue;
      put(u, y, lit ? (y < 5 ? 0xfff0c0 : 0xe8c880) : (y === 3 ? T(0x9ac0dc) : T(0x3a5470)));
    }
    for (const du of [5, 20, 35]) for (let y = 2; y <= 12; y++) { put(du, y, T(0x7a8088)); put(du + 4, y, T(0x7a8088)); }
    put(45, 10, lit ? 0xfff6c0 : T(0xf0f0e0)); put(0, 10, 0xd8303a);
    wheel(8, 13); wheel(38, 13);
  } else if (kind === 'follow') {
    // FOLLOW ME-bilen: gul med rutig skylt på taket
    for (let u = 3; u < 14; u++) put(u, 0, (u & 1) ? T(0x1a1a1e) : T(0xf0c020));
    for (let u = 3; u < 14; u++) put(u, 1, (u & 1) ? T(0xf0c020) : T(0x1a1a1e));
    rect(3, 3, 11, 2, lit ? T(0x3a4a5a) : T(0x7aa6c8)); put(8, 3, T(0xf0c020));
    rect(0, 5, 17, 3, T(0xf0c020)); rect(0, 5, 17, 1, T(0xffe070)); rect(4, 2, 9, 1, T(0xf0c020));
    put(16, 6, lit ? 0xfff6c0 : T(0xf0f0e0)); put(0, 6, 0xd8303a);
    wheel(3, 7); wheel(13, 7);
  } else if (kind === 'stairs') {
    // trappbilen: vit/blå bil med trappa som stiger mot planets dörr (framåt)
    rect(0, 17, 36, 3, T(0xe8ecf0)); rect(0, 17, 36, 1, T(0xffffff)); rect(0, 19, 36, 1, T(0x2a6ad0));
    rect(27, 11, 9, 6, T(0xe8ecf0)); rect(29, 12, 5, 3, lit ? T(0x3a4a5a) : T(0x6a9ac0));
    for (let k = 0; k <= 22; k++) {
      const u = 3 + k, y = 16 - Math.round(k * 0.62);
      put(u, y, T(0x9aa0a8)); if (k % 2 === 0) put(u, y - 1, T(0xc8ccd2));
      if (k % 4 === 0) for (let j = 2; j <= 5; j++) put(u, y - j, T(0x7a8088));
      put(u, y - 5, T(0xd8dce2));
    }
    rect(25, 2, 7, 1, T(0x9aa0a8)); for (const u of [25, 31]) for (let y = 0; y < 3; y++) put(u, y - 1 < 0 ? 0 : y, T(0x7a8088));
    put(35, 16, lit ? 0xfff6c0 : T(0xf0f0e0));
    wheel(6, 20); wheel(30, 20);
  } else if (kind === 'gpu') {
    rect(0, 1, 12, 5, T(0xf0c020)); rect(0, 1, 12, 1, T(0xffe070)); rect(2, 3, 5, 2, T(0x3a3e46)); put(9, 3, 0x5aff8a);
    wheel(2, 5); wheel(9, 5);
  }
  outline(P, mode === 'dag' ? 0x2a2c34 : 0x0a0c14);
  v = { img: P.flush(), w, h };
  VEH.set(key, v);
  return v;
}

// Små människor ute på plattan (7×14): markpersonal i varselväst, resenärer och
// signalgubben med två orange stavar. frame: 0 stå · 1/2 gå · marsh: 0 upp · 1 ut · 2 kors.
const MINI = new Map();
function miniSprite(kind, frame, mode, variant = 0) {
  const key = kind + frame + mode + variant;
  let m = MINI.get(key);
  if (m) return m;
  const T = tintOf(mode), P = new Pix(9, 15);
  const skin = T([0xe0a97f, 0xa86a44, 0xf0c8a0, 0x7a4a2d][variant % 4]);
  const shirt = kind === 'pax' ? T([0x3a7bd5, 0xd8583a, 0x5aa05a, 0xe0c040, 0x8a5ac0, 0xe8e3d6][variant % 6]) : T(0xf07a1e);
  const pants = T(kind === 'pax' ? [0x2d3a5c, 0x3a3a44, 0x5a4a3a][variant % 3] : 0x2a2e3a);
  const x = 2;
  // ben
  if (frame === 1 && kind !== 'marsh') { P.rect(x + 1, 9, 1, 5, pants); P.rect(x + 3, 9, 1, 4, pants); P.px(x, 13, T(0x1a1a1e)); P.px(x + 3, 13, T(0x1a1a1e)); }
  else if (frame === 2 && kind !== 'marsh') { P.rect(x + 1, 9, 1, 4, pants); P.rect(x + 3, 9, 1, 5, pants); P.px(x + 1, 13, T(0x1a1a1e)); P.px(x + 4, 13, T(0x1a1a1e)); }
  else { P.rect(x + 1, 9, 1, 5, pants); P.rect(x + 3, 9, 1, 5, pants); P.px(x + 1, 14, T(0x1a1a1e)); P.px(x + 3, 14, T(0x1a1a1e)); }
  // kropp
  P.rect(x, 4, 5, 5, shirt); P.vl(x, 4, 5, mix(shirt, WHITE, 0.25)); P.vl(x + 4, 4, 5, mul(shirt, 0.75));
  if (kind !== 'pax') { P.hl(x, 6, 5, T(0xe8ecf0)); P.hl(x, 8, 5, T(0xe8ecf0)); }
  // huvud
  P.rect(x + 1, 1, 3, 3, skin); P.hl(x + 1, 0, 3, T([0x3b2619, 0x1a1a1a, 0xe8c070, 0x6a3a1a][variant % 4]));
  if (kind !== 'pax') { P.px(x, 2, T(0x2a2c34)); P.px(x + 4, 2, T(0x2a2c34)); } // hörselskydd
  // armar
  const wand = 0xff7a1e;
  if (kind === 'marsh') {
    if (frame === 0) { P.vl(x - 1, 1, 4, shirt); P.vl(x + 5, 1, 4, shirt); P.vl(x - 1, 0, 2, wand); P.vl(x + 5, 0, 2, wand); P.px(x - 1, -0 + 0, wand); }
    else if (frame === 1) { P.hl(x - 2, 4, 2, shirt); P.hl(x + 5, 4, 2, shirt); P.px(x - 2, 3, wand); P.px(x + 6, 3, wand); P.px(x - 2, 2, wand); P.px(x + 6, 2, wand); }
    else { P.px(x, 3, shirt); P.px(x + 4, 3, shirt); P.line(x - 1, 0, x + 5, 3, wand); P.line(x + 5, 0, x - 1, 3, wand); }
  } else {
    P.vl(x - 1, 4, 4, shirt); P.vl(x + 5, 4, 4, shirt); P.px(x - 1, 8, skin); P.px(x + 5, 8, skin);
  }
  m = P.flush();
  MINI.set(key, m);
  return m;
}

// ======================= utsikten: det bortre lagret =======================
// Himmel, moln, sol/måne/stjärnor, Pixelstadens silhuett, flygledartornet, hangarer,
// bränsledepå, radar, vindkraftverk och rullbanan. Rullar i halv fart (djup).
const HOR = 47;                           // horisonten
const FARL = 52;                          // längden på planen borta vid rullbanan
const RWY = { x0: 40, x1: 1400, y: 50 };  // rullbanan (y 50–54)
const TOWER_X = 700, RADAR_X = 1172, TURBINES = [1250, 1312, 1394], HOTEL_X = 24, TVTOWER_X = 250;
function cloudBlob(P, cx, cy, w, hgt, V, seed, a) {
  const n = 3 + Math.floor(hash(seed, 1, 7) * 3), puffs = [];
  for (let i = 0; i < n; i++) puffs.push([cx - w / 2 + (i + 0.5) * w / n + (hash(seed, i, 8) - 0.5) * 5, cy - hash(seed, i, 9) * hgt * 0.7, w / n * (0.75 + hash(seed, i, 10) * 0.5), hgt * (0.55 + hash(seed, i, 11) * 0.5)]);
  for (let y = Math.floor(cy - hgt * 1.5); y <= cy + 1; y++) for (let x = Math.floor(cx - w * 0.75); x <= cx + w * 0.75; x++) {
    let best = 9;
    for (const [px, py, rx, ry] of puffs) best = Math.min(best, Math.hypot((x - px) / rx, (y - py) / ry));
    if (best - 1 + (bayer(x, y) - 0.5) * 0.3 > 0) continue;
    const k = (y - (cy - hgt * 1.2)) / (hgt * 1.3);
    P.px(x, y, k > 0.78 ? V.cloudLo : k > 0.5 ? qmix(V.cloud, V.cloudLo, (k - 0.5) / 0.28, x, y, 2) : V.cloud, a);
  }
}
function paintFar(mode) {
  const V = SKY[mode], P = new Pix(W, FAR_H), lit = lightsOn(mode), T = tintOf(mode);
  const G = lit ? new Pix(W, FAR_H) : null; // det som lyser läggs på med 'lighter'
  const glow = (x, y, rx, ry, c, a) => { if (G) G.ell(x, y, rx, ry, c, a, 3); };
  // himlen
  area(P, 0, 0, W, HOR, (X, Y) => { const t = Y / (HOR - 1); return t < 0.5 ? qmix(V.top, V.mid, t / 0.5, X, Y, 4) : qmix(V.mid, V.hor, (t - 0.5) / 0.5, X, Y, 4); });
  if (mode === 'natt') {
    for (let y = 8; y < 40; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 51);
      if (h > 0.991) P.px(x, y, 0xffffff, 0.35 + hash(x, y, 52) * 0.55);
    }
    for (const [sx, sy] of [[130, 16], [455, 22], [820, 14], [1010, 25], [1290, 18]]) { P.px(sx, sy, 0xffffff); P.px(sx - 1, sy, 0xc8d0ff, 0.5); P.px(sx + 1, sy, 0xc8d0ff, 0.5); P.px(sx, sy - 1, 0xc8d0ff, 0.5); P.px(sx, sy + 1, 0xc8d0ff, 0.5); }
    // månskära
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      if (Math.hypot(x, y) > 4.6 || Math.hypot(x - 2, y + 1) < 4.2) continue;
      P.px(560 + x, 21 + y, x + y < -2 ? 0xfffcec : 0xe8e2c4);
    }
    glow(560, 21, 12, 10, 0x8090c0, 0.18);
  }
  if (mode === 'kvall' || mode === 'gryning') {
    const sx = mode === 'kvall' ? 900 : 262, sy = mode === 'kvall' ? 44 : 45, sr = mode === 'kvall' ? 7 : 5;
    P.ell(sx, sy, sr * 5, sr * 2.2, V.sun, 0.35, 4);
    for (let y = -sr; y <= 0; y++) for (let x = -sr; x <= sr; x++) if (Math.hypot(x, y) <= sr + 0.3 && sy + y < HOR) P.px(sx + x, sy + y, Math.hypot(x, y) > sr - 1 ? mix(V.sun, V.hor, 0.35) : V.sun);
    for (const dy of [-3, -1]) for (let x = sx - sr - 4; x < sx + sr + 6; x++) if (hash(x, dy, 53) > 0.3) P.px(x, sy + dy, V.cloudLo, 0.7);
  }
  // molnen
  for (let k = 0; k < 12; k++) {
    const cx = 40 + k * 124 + hash(k, 0, 54) * 60, cy = 17 + hash(k, 1, 54) * 14;
    cloudBlob(P, cx, cy, 20 + hash(k, 2, 54) * 26, 4 + hash(k, 3, 54) * 4, V, k * 13 + 1, mode === 'natt' ? 0.55 : 0.95);
  }
  // kullar långt bort
  for (let x = 0; x < W; x++) {
    const hy = Math.round(41 + Math.sin(x * 0.011) * 2.2 + Math.sin(x * 0.031 + 1) * 1.2);
    for (let y = hy; y < HOR; y++) P.px(x, y, qmix(V.far2, V.far, (y - hy) / 6, x, y, 2));
  }
  // hotellet längst till vänster
  area(P, HOTEL_X - 10, 22, 22, HOR - 22, (X, Y, i, j) => {
    if (i === 0) return mix(V.bld, WHITE, 0.15);
    if (i === 21) return mul(V.bld, 0.72);
    if (j % 3 === 1 && i % 3 === 1 && i > 1 && i < 20) return lit && hash(X, Y, 55) > 0.45 ? V.win : mul(V.bld, mode === 'dag' ? 0.78 : 0.6);
    return mul(V.bld, 0.9);
  });
  text(P, SMALL, 'HOTELL', HOTEL_X - 9, 16, lit ? 0xff7a5a : T(0x3a5a8a));
  P.hl(HOTEL_X - 10, 21, 22, mul(V.bld, 0.7));
  if (lit) { for (let x = HOTEL_X - 9; x < HOTEL_X + 11; x++) if (G) G.px(x, 18, 0xff5a3a, 0.4); }
  // Pixelstadens silhuett
  let bx = 60;
  while (bx < 440) {
    const bw = 5 + Math.floor(hash(bx, 0, 56) * 10), cen = 1 - Math.abs(bx - 250) / 220;
    const bh = 5 + Math.floor(hash(bx, 1, 56) * 9 + cen * 9);
    const top = HOR - bh, col = hash(bx, 2, 56) > 0.5 ? V.far : mix(V.far, V.far2, 0.5);
    for (let x = bx; x < bx + bw; x++) for (let y = top; y < HOR; y++) {
      let c = x === bx ? mix(col, WHITE, 0.08) : x === bx + bw - 1 ? mul(col, 0.85) : col;
      if ((y - top) % 2 === 1 && (x - bx) % 2 === 1 && x < bx + bw - 1) {
        if (lit && hash(x, y, 57) > 0.55) { c = V.win; if (G) G.px(x, y, V.win, 0.35); }
        else if (mode === 'dag') c = mix(col, 0xe8f0f8, 0.25);
      }
      P.px(x, y, c);
    }
    if (bh > 14 && lit) { P.px(bx + (bw >> 1), top - 1, 0xff3a2a); glow(bx + (bw >> 1), top - 1, 2, 2, 0xff3a2a, 0.5); }
    bx += bw + (hash(bx, 3, 56) > 0.7 ? 2 : 0);
  }
  // TV-tornet
  P.vl(TVTOWER_X, 14, HOR - 14, mix(V.far, WHITE, 0.1)); P.vl(TVTOWER_X + 1, 14, HOR - 14, mul(V.far, 0.85));
  area(P, TVTOWER_X - 2, 19, 6, 4, (X, Y, i, j) => (j === 0 ? mix(V.far, WHITE, 0.2) : lit && j === 2 && i % 2 === 0 ? V.win : mul(V.far, 0.95)));
  P.vl(TVTOWER_X, 8, 6, mul(V.far, 0.8));
  // trädrand
  for (let x = 0; x < W; x++) {
    const ty = 44 - (hash(x >> 1, 0, 58) > 0.55 ? 1 : 0) - (hash(x >> 2, 1, 58) > 0.8 ? 1 : 0) - (hash(x >> 3, 2, 58) > 0.9 ? 1 : 0);
    for (let y = ty; y < HOR; y++) P.px(x, y, y === ty ? mix(V.tree, V.far, 0.35) : V.tree);
  }
  // parkeringshuset
  area(P, 488, 38, 86, 9, (X, Y, i, j) => (j % 3 === 0 ? mix(V.bld, WHITE, 0.1) : lit && hash(X, Y, 59) > 0.8 ? V.win : mul(V.bld, j % 3 === 1 ? 0.55 : 0.7)));
  // flygledartornet
  area(P, TOWER_X - 3, 20, 7, HOR - 20, (X, Y, i) => mul(jit(V.bld, X, Y, 60, 0.05), [0.8, 0.95, 1.05, 1.08, 1, 0.9, 0.78][i]));
  for (let y = 24; y < HOR - 2; y += 4) P.px(TOWER_X, y, lit ? V.win : mul(V.bld, 0.6));
  area(P, TOWER_X - 7, 19, 15, 2, (X, Y, i, j) => (j === 0 ? mix(V.bld, WHITE, 0.2) : mul(V.bld, 0.7)));
  for (let j = 0; j < 6; j++) {
    const y = 13 + j, half = 7 - (j < 2 ? 0 : Math.floor((j - 2) / 2));
    for (let x = TOWER_X - half; x <= TOWER_X + half; x++) {
      let c = lit ? qmix(0xb8ffe0, 0x5ab89a, j / 6, x, y, 3) : qmix(0x6a9aa8, 0x2a4a54, j / 6, x, y, 3);
      if ((x - TOWER_X + 8) % 4 === 0) c = mul(V.bld, 0.45);
      P.px(x, y, lit ? c : T(c));
    }
  }
  if (lit) glow(TOWER_X, 16, 12, 5, 0x9affd8, 0.3);
  area(P, TOWER_X - 8, 11, 17, 2, (X, Y, i, j) => (j === 0 ? mix(V.bld, WHITE, 0.25) : mul(V.bld, 0.55)));
  P.vl(TOWER_X, 5, 6, mul(V.bld, 0.7)); P.hl(TOWER_X - 2, 8, 5, mul(V.bld, 0.7));
  // hangarerna (en stjärtfena sticker ut ur porten)
  for (const [hx, hw, lbl] of [[768, 70, 'HANGAR 2'], [846, 56, 'HANGAR 3']]) {
    for (let x = hx; x < hx + hw; x++) {
      const u = (x - hx - hw / 2) / (hw / 2), ty = 33 + Math.round(u * u * 5);
      for (let y = ty; y < HOR; y++) {
        let c = y === ty ? mix(V.bld, WHITE, 0.3) : V.bld;
        if (y > 39 && x > hx + 5 && x < hx + hw - 5) c = (x - hx) % 5 === 0 ? mul(V.bld, 0.7) : mul(V.bld, 0.85);
        if (lit && y > 39 && x > hx + 5 && x < hx + hw - 5 && y > 41) c = mix(c, 0xfff0c0, 0.35);
        P.px(x, y, c);
      }
    }
    text(P, SMALL, lbl, hx + (hw >> 1) - (textW(SMALL, lbl) >> 1), 35, lit ? 0xffe8a0 : T(0x3a5a8a), 0.85);
  }
  for (let j = 0; j < 7; j++) for (let i = 0; i <= j; i++) P.px(800 + i, 40 + j, T(LIVERY[2]));
  // fraktterminalen
  area(P, 910, 38, 100, 9, (X, Y, i, j) => (j === 0 ? mix(V.bld, WHITE, 0.2) : i % 12 < 8 && j > 3 ? (lit ? mix(V.bld, 0xffe0a0, 0.4) : mul(V.bld, 0.7)) : mul(V.bld, 0.92)));
  text(P, SMALL, 'CARGO', 944, 39, lit ? 0xffd070 : T(0xd8303a));
  // bränsledepån
  for (const [tx, tw] of [[1032, 13], [1048, 11], [1062, 13]]) {
    area(P, tx, 40, tw, 7, (X, Y, i, j) => (j === 0 ? mix(V.bld, WHITE, 0.4) : i === 0 ? mix(V.bld, WHITE, 0.2) : i === tw - 1 ? mul(V.bld, 0.72) : V.bld));
    P.hl(tx + 2, 39, tw - 4, mix(V.bld, WHITE, 0.3));
    P.hl(tx, 44, tw, T(0xd8303a));
  }
  // radartornet (antennen roterar – ritas i bilden)
  P.line(RADAR_X - 3, HOR, RADAR_X, 32, mul(V.bld, 0.75)); P.line(RADAR_X + 3, HOR, RADAR_X, 32, mul(V.bld, 0.75));
  for (let y = 35; y < HOR; y += 3) P.hl(RADAR_X - Math.floor((y - 32) / 5), y, Math.floor((y - 32) / 2.5) + 1, mul(V.bld, 0.7));
  // vindkraftverkens torn (bladen snurrar – ritas i bilden)
  for (const tx of TURBINES) { P.vl(tx, 24, HOR - 24, mix(V.bld, WHITE, 0.2)); P.px(tx, 23, V.bld); }
  // marken, rullbanan, gräset
  area(P, 0, HOR, W, 3, (X, Y) => jit(V.grass2, X, Y, 61, 0.06));
  for (let x = 0; x < W; x++) {
    const on = x >= RWY.x0 && x <= RWY.x1;
    for (let y = 50; y <= 54; y++) {
      let c = on ? jit(V.run, x, y, 62, 0.05) : jit(V.grass, x, y, 63, 0.07);
      if (on && (y === 50 || y === 54)) c = mix(V.run, WHITE, mode === 'natt' ? 0.18 : 0.4);
      if (on && y === 52 && (x % 16) < 8 && x > RWY.x0 + 20 && x < RWY.x1 - 20) c = mix(V.run, WHITE, mode === 'natt' ? 0.25 : 0.6);
      if (on && y > 50 && y < 54 && ((x > RWY.x0 + 3 && x < RWY.x0 + 16) || (x > RWY.x1 - 16 && x < RWY.x1 - 3)) && x % 2 === 0) c = mix(V.run, WHITE, mode === 'natt' ? 0.3 : 0.75);
      if (on && (y === 51 || y === 53) && ((x > RWY.x0 + 44 && x < RWY.x0 + 56) || (x > RWY.x1 - 56 && x < RWY.x1 - 44))) c = mix(V.run, WHITE, mode === 'natt' ? 0.3 : 0.7);
      P.px(x, y, c);
    }
    for (let y = 55; y < FAR_H; y++) P.px(x, y, jit(V.grass, x, y, 64, 0.07));
  }
  // rullbanans kantljus, tröskelljus, inflygningsljus, PAPI, taxiskyltar, vindstrut
  for (let x = RWY.x0; x <= RWY.x1; x += 10) for (const y of [50, 54]) {
    P.px(x, y, lit ? 0xfff0c0 : mix(V.run, WHITE, 0.7));
    if (lit) glow(x + 0.5, y + 0.5, 2.2, 1.2, 0xfff0c0, 0.45);
  }
  for (let y = 50; y <= 54; y++) { P.px(RWY.x1 + 1, y, lit ? 0x5aff8a : T(0x3a8a4a)); P.px(RWY.x0 - 1, y, lit ? 0xff4a3a : T(0x8a3a3a)); if (lit) { glow(RWY.x1 + 1.5, y + 0.5, 2, 2, 0x5aff8a, 0.3); glow(RWY.x0 - 0.5, y + 0.5, 2, 2, 0xff4a3a, 0.3); } }
  for (let x = RWY.x1 + 6; x < W; x += 5) { P.vl(x, 53, 2, T(0x5a5e66)); P.px(x, 52, lit ? 0xfff6d8 : T(0x9aa0a8)); }
  for (let y = 49; y <= 55; y++) P.px(RWY.x1 + 21, y, lit ? 0xfff6d8 : T(0x9aa0a8));
  [0xffffff, 0xffffff, 0xff4a3a, 0xff4a3a].forEach((c, i) => { P.px(1330 + i * 2, 56, lit ? c : T(0x6a6e76)); if (lit) glow(1330.5 + i * 2, 56.5, 1.6, 1.6, c, 0.4); });
  for (let x = 120; x < W - 40; x += 170) { P.rect(x, 55, 5, 2, T(0xf0c020)); P.px(x + 2, 55, T(0x1a1a1e)); if (lit) glow(x + 2.5, 56, 3, 1.5, 0xf0c020, 0.3); }
  P.vl(1362, 48, 8, T(0x9aa0a8));
  [0xf07a1e, 0xffffff, 0xf07a1e, 0xffffff].forEach((c, i) => { P.px(1363 + i, 48 + (i >> 1), T(c)); P.px(1363 + i, 49 + (i >> 1), T(mul(c, 0.8))); });
  return { img: P.flush(), glow: G ? G.flush() : null };
}

// ======================= utsikten: plattan (närmast) =======================
// Taxibanan, betongen med målade linjer, uppställningsplatsen, gate A1/A2 med planen
// rakt framifrån och bryggorna, bagagetaket, strålkastarmasterna och servicevägen.
// Täcker y 10–91: marken från y 58, ovanför bara det som sticker upp (fenor, master).
const NEAR_TOP = 10;
const MASTS = [200, 700, 1060];
// strålkastarnas ljuspölar på plattan: [x, räckvidd, styrka]
const POOLS = [[200, 170, 0.9], [700, 170, 0.9], [1060, 150, 0.8], [940, 120, 1], [1156, 120, 1], [606, 110, 0.85], [36, 90, 0.6]];
const RS = { stop: 606, y: 74, L: 150 };  // uppställningsplatsen framför incheckningen (planet mot vänster)
const GATE_GY = 86;
// På kvällen och natten: samma plattan målas två gånger – i mörker och i dagsljus – och
// blandas pixel för pixel där strålkastarna lyser (det som själv lyser behålls).
function paintNear(mode) {
  if (mode === 'dag') { const D = paintNearRaw('dag'); return { img: D.P.flush(), gates: D.Q.flush(), glow: null }; }
  const N = paintNearRaw(mode), D = paintNearRaw('dag'), k = mode === 'natt' ? 0.85 : 0.3;
  const lum = (r, g2, b) => r * 0.3 + g2 * 0.59 + b * 0.11;
  for (const [A2, B2] of [[N.P, D.P], [N.Q, D.Q]]) {
    const dn = A2.d, dd = B2.d, w = A2.w;
    for (let i = 0; i < dn.length; i += 4) {
      if (!dn[i + 3]) continue;
      const x = (i >> 2) % w, y = ((i >> 2) / w | 0) + NEAR_TOP;
      let pool = 0;
      for (const [px, pr, ps] of POOLS) { const u = (x - px) / pr; if (u > -1 && u < 1) pool = Math.max(pool, ps * (1 - u * u)); }
      pool *= k * (y < 40 ? 0.7 : 1);
      if (pool < 0.03) continue;
      // tolv steg i stället för fyra: grannpixlarna skiljer bara en tolftedel → jämn yta
      // i pölens mitt och en mjuk, nästan osynlig övergång i kanten (inget myggnät)
      const q = clamp(Math.floor(pool * 12 + bayer(x, y)) / 12, 0, 1);
      if (q <= 0) continue;
      const fc = mix(mul((dd[i] << 16) | (dd[i + 1] << 8) | dd[i + 2], 0.9), 0xffe4b0, 0.12);
      const fr = (fc >> 16) & 255, fg = (fc >> 8) & 255, fb = fc & 255;
      if (lum(dn[i], dn[i + 1], dn[i + 2]) >= lum(fr, fg, fb)) continue;
      dn[i] = dn[i] + (fr - dn[i]) * q; dn[i + 1] = dn[i + 1] + (fg - dn[i + 1]) * q; dn[i + 2] = dn[i + 2] + (fb - dn[i + 2]) * q;
    }
  }
  return { img: N.P.flush(), gates: N.Q.flush(), glow: N.G ? N.G.flush() : null };
}
function paintNearRaw(mode) {
  const V = SKY[mode], T = tintOf(mode), lit = lightsOn(mode);
  const P = new Pix(W, GB - NEAR_TOP + 2, 0, NEAR_TOP);
  const G = lit ? new Pix(W, GB - NEAR_TOP + 2, 0, NEAR_TOP) : null;
  const Q = new Pix(W, GB - NEAR_TOP + 2, 0, NEAR_TOP); // gateplanen: ett eget lager framför uppställningsplatsen
  const glow = (x, y, rx, ry, c, a) => { if (G) G.ell(x, y, rx, ry, c, a, 3); };
  // gräs + blå kantljus
  area(P, 0, NEAR_Y, W, 3, (X, Y) => jit(V.grass, X, Y, 70, 0.08));
  for (let x = 4; x < W; x += 12) { P.px(x, 59, lit ? 0x4a7aff : T(0x3a5a9a)); if (lit) glow(x + 0.5, 59.5, 2, 1.4, 0x4a7aff, 0.5); }
  // taxibanan
  for (let x = 0; x < W; x++) for (let y = 61; y <= 65; y++) {
    let c = jit(V.asph, x, y, 71, 0.06);
    if (y === 63) c = lit ? mix(V.asph, 0xe8c030, 0.55) : T(0xe8c030);
    if (y === 61 || y === 65) c = mix(c, T(0xe8c030), 0.45);
    P.px(x, y, c);
  }
  if (lit) for (let x = 2; x < W; x += 8) { P.px(x, 63, 0x5aff8a); glow(x + 0.5, 63.5, 1.8, 1.2, 0x5aff8a, 0.45); }
  // betongen
  area(P, 0, 66, W, 21, (X, Y) => {
    let c = qmix(V.conc2, V.conc, (Y - 66) / 21, X, Y, 3);
    if (Y === 72 || Y === 80 || X % 32 === 0) c = mul(c, 0.92);
    return jit(c, X, Y, 72, 0.05);
  });
  for (let k = 0; k < 44; k++) P.ell(hash(k, 0, 73) * W, 68 + hash(k, 1, 73) * 17, 4 + hash(k, 2, 73) * 6, 1 + hash(k, 3, 73), 0x1a1a22, 0.16, 3);
  // servicevägen närmast glaset
  for (let x = 0; x < W; x++) for (let y = 87; y <= 91; y++) {
    let c = jit(mix(V.asph, V.conc2, 0.2), x, y, 74, 0.05);
    if (y === 87) c = mix(c, WHITE, mode === 'natt' ? 0.25 : 0.6);
    if (y === 89 && x % 12 < 6) c = mix(c, WHITE, mode === 'natt' ? 0.2 : 0.5);
    P.px(x, y, c);
  }
  for (let x = 862; x < 884; x += 3) for (let y = 88; y <= 91; y++) P.px(x, y, mix(V.asph, WHITE, mode === 'natt' ? 0.3 : 0.7));
  // uppställningsplatsen R3: ledlinje, stoppstreck, nummer
  const yl = lit ? mix(V.conc, 0xe8c030, 0.6) : T(0xe8c030);
  for (let x = 300; x < 1440; x++) P.px(x, RS.y, yl);
  const stopX = RS.stop - RS.L * 0.36;
  P.vl(Math.round(stopX), RS.y - 3, 7, yl); P.vl(Math.round(stopX) - 1, RS.y - 3, 7, yl);
  text(P, BIG, 'R3', 716, 70, yl, 0.85);
  // bagagetaket till vänster: tak, stolpar, vagnar och containrar
  area(P, 12, 60, 262, 3, (X, Y, i, j) => (j === 0 ? T(0xe8ecf0) : j === 1 ? T(0xb8bec6) : T(0x6a7078)));
  for (let x = 20; x < 274; x += 50) { P.vl(x, 63, 13, T(0x9aa0a8)); P.vl(x + 1, 63, 13, T(0x6a7078)); }
  P.darken(12, 63, 262, 13, mode === 'dag' ? 0.82 : 0.9);
  for (let k = 0; k < 9; k++) {
    const ux = 26 + k * 27, uy = 68;
    area(P, ux, uy, 11, 8, (X, Y, i, j) => (j === 0 ? T(0xe8ecf0) : i === 0 ? T(0xd8dce2) : i === 10 ? T(0x7a8088) : T(0xb8bec6)));
    for (let j = 1; j < 3; j++) P.px(ux + 10 + j, uy + j, T(0x9aa0a8));
    P.hl(ux + 2, uy + 3, 6, T(0x8a9098));
    text(P, SMALL, 'AK', ux + 2, uy + 2, T(0x3a5a8a), 0.6);
  }
  text(P, SMALL, 'BAGAGE', 118, 56, lit ? 0xffe070 : T(0x3a5a8a));
  if (lit) for (let x = 30; x < 270; x += 40) glow(x, 64, 10, 3, 0xfff0c0, 0.25);
  // strålkastarmasterna
  for (const mx of MASTS) {
    P.vl(mx, 16, 51, T(0x8a9098)); P.vl(mx + 1, 16, 51, T(0x5a6068));
    for (let y = 20; y < 66; y += 6) P.px(mx - 1, y, T(0x9aa0a8));
    area(P, mx - 4, 12, 10, 4, (X, Y, i, j) => (j === 0 || j === 3 ? T(0x4a4e56) : i % 2 === 0 ? (lit ? 0xfffbe8 : T(0x7a8088)) : T(0x3a3e46)));
    if (lit) { glow(mx + 1, 14, 9, 4, 0xfff4d0, 0.55); for (let k = 0; k < 4; k++) glow(mx + 1, 70 + k * 4, 22 + k * 7, 3 + k, 0xfff0c8, 0.12); }
  }
  // gate A1 och A2: stand, planet rakt framifrån, bryggan, utrustning
  const red = lit ? mix(V.conc, 0xd8303a, 0.5) : T(0xd8303a);
  GATES.forEach((gt, gi) => {
    const cx = gt.plane, gy = GATE_GY;
    for (let y = 66; y < gy; y++) P.px(cx, y, yl);
    for (let x = cx - 108; x < cx + 108; x += 4) { P.px(x, 86, red); P.px(x + 1, 86, red); }
    text(P, BIG, gt.id, cx - 90, 76, yl, 0.8);
    paintNosePlane(Q, cx, gy, gt.liv, T, mode);
    paintBridge(Q, cx, gy, T, mode);
    // gateskylten ovanpå bryggans rotunda
    Q.rect(cx + 53, 63, 14, 7, T(0x1e2026)); Q.hl(cx + 53, 63, 14, T(0x4a4e56)); text(Q, SMALL, gt.id, cx + 56, 64, 0xffd23a);
    // bogserbil framför nosen, koner vid vingspetsarna
    area(Q, cx - 13, 86, 27, 3, (X, Y, i, j) => (j === 0 ? T(0xffe070) : j === 2 ? T(0x8a6a10) : T(0xe0b020)));
    Q.rect(cx - 8, 83, 7, 3, T(0x3a3e46)); Q.px(cx - 6, 84, lit ? 0xffd890 : T(0x7a9ab8)); Q.hl(cx - 1, 86, 2, T(0x1a1a1e));
    Q.rect(cx - 12, 89, 4, 2, T(0x16161a)); Q.rect(cx + 9, 89, 4, 2, T(0x16161a));
    for (const s of [-1, 1]) { const kx = cx + s * (NOSE.span + 3); Q.px(kx, 84, T(0xf07a1e)); Q.px(kx, 85, T(0xffffff)); Q.px(kx, 86, T(0xf07a1e)); Q.hl(kx - 1, 87, 3, T(0xd8601a)); }
    if (gi === 0) {
      // bandlastare och bagagevagnar till höger om bryggan
      const bx = cx + 70;
      for (let k = 0; k <= 16; k++) { Q.px(bx + k, 80 - Math.round(k * 0.55), T(0x3a3e46)); Q.px(bx + k, 81 - Math.round(k * 0.55), T(0x8a9098)); }
      area(Q, bx - 2, 81, 20, 3, (X, Y, i, j) => (j === 0 ? T(0xf0c020) : T(0xb08a10)));
      Q.rect(bx, 84, 3, 2, T(0x16161a)); Q.rect(bx + 13, 84, 3, 2, T(0x16161a));
      for (let k = 0; k < 2; k++) {
        const vx = bx + 22 + k * 15;
        area(Q, vx, 82, 13, 2, (X, Y, i, j) => (j === 0 ? T(0x9aa0a8) : T(0x5a6068)));
        [0x6a5030, 0x3a5a7c, 0x9a3a4a].forEach((c, i) => Q.rect(vx + 1 + i * 4, 78 - (i & 1), 3, 4 + (i & 1), T(c)));
        Q.px(vx + 2, 84, T(0x16161a)); Q.px(vx + 10, 84, T(0x16161a));
      }
    } else {
      // cateringbilen med lådan upphissad till dörren på vänstra sidan
      const kx = cx - 42, fy = gy - NOSE.lift;
      area(Q, kx, fy - 8, 24, 13, (X, Y, i, j) => (j === 0 ? T(0xffffff) : i === 0 ? T(0xe8ecf0) : i === 23 ? T(0x9aa0a8) : j === 6 ? T(0x2a6ad0) : T(0xdfe3e8)));
      text(Q, SMALL, 'MAT', kx + 7, fy - 5, T(0x2a6ad0));
      for (let y = fy + 5; y < gy - 5; y++) { Q.px(kx + 4 + ((y >> 1) & 1) * 3, y, T(0x6a7078)); Q.px(kx + 19 - ((y >> 1) & 1) * 3, y, T(0x6a7078)); }
      area(Q, kx - 3, gy - 5, 30, 4, (X, Y, i, j) => (j === 0 ? T(0xe8ecf0) : T(0x9aa0a8)));
      area(Q, kx + 22, gy - 11, 8, 7, (X, Y, i, j) => (j === 0 ? T(0xffffff) : i > 2 && j > 1 && j < 4 ? (lit ? 0x3a4a5a : T(0x6a9ac0)) : T(0xe0e4e8)));
      Q.rect(kx - 1, gy - 1, 4, 3, T(0x16161a)); Q.rect(kx + 23, gy - 1, 4, 3, T(0x16161a));
      if (lit) glow(kx + 12, fy - 2, 12, 6, 0xfff0c0, 0.2);
    }
    if (lit) { glow(cx + 40, 76, 16, 8, 0xffe0a0, 0.25); glow(cx, 74, 70, 12, 0xe8f0ff, 0.12); glow(cx, gy - 9, 10, 4, 0xfffbe8, 0.4); }
  });
  return { P, Q, G };
}

// ======================= hallen (bakgrunden) =======================
// Tak med fackverk och ljuslister, glasväggen (hålen släpper fram utsikten), de murade
// väggarna, bröstningen, terrazzogolvet med fönsterreflexer, mattan i väntehallen,
// pelarna, hängande skyltar och allt som sitter på väggen. Samma bild dygnet runt.
const ICON = {
  case: ['..###..', '.#...#.', '#######', '#######', '#######', '#######', '.#...#.'],
  plane: ['......##.', '.....##..', '##..###..', '.#######.', '..####...', '...##....', '..##.....'],
  desk: ['.#.....', '###....', '.#.####', '##.#..#', '.#.####', '#.#....', '#.#....'],
  guard: ['..#....', '.###...', '#####..', '.###.##', '.#.#.##', '.#.#...', '.#.#...'],
  cup: ['.#.#...', '#.#....', '#####..', '#####.#', '#####.#', '.###.#.', '.......'],
  arrow: ['..#..', '...#.', '#####', '...#.', '..#..'],
  man: ['.#.', '###', '###', '.#.', '#.#'],
  lady: ['.#.', '###', '###', '###', '#.#'],
  wheel: ['.#.', '##.', '.##', '#.#', '.#.'],
  run: ['...#.', '.##..', '#.##.', '..#.#', '.#.#.', '#...#'],
  info: ['#', '.', '#', '#', '#'],
};
function icon(P, x, y, rs, c) { rs.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') P.px(x + i, y + j, c); }); }
// hängande skylt: svart med gul text, två vajrar upp till taket
function hangSign(P, cx, y, label, ic = null, arrow = false) {
  const tw = textW(SMALL, label), w = tw + (ic ? 11 : 0) + (arrow ? 8 : 0) + 8, x0 = Math.round(cx - w / 2);
  for (const vx of [x0 + 4, x0 + w - 5]) P.vl(vx, 9, y - 9, 0x5a5e66);
  P.rect(x0, y, w, 11, 0x16161a);
  P.hl(x0, y, w, 0x4a4c54); P.hl(x0, y + 10, w, 0x0a0a0c);
  let x = x0 + 4;
  if (ic) { icon(P, x, y + 2, ic, 0xffd23a); x += 11; }
  text(P, SMALL, label, x, y + 3, 0xffd23a);
  x += tw + 3;
  if (arrow) icon(P, x, y + 3, ICON.arrow, 0xffd23a);
  return { x: x0, y, w, h: 11 };
}
// pixelkarta med palett (små skyltbilder)
function sprP(P, x, y, rs, pal) { rs.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, c); } }); }
const PANES = [[ARR.x1 + 8, ENTRY.x0], [ENTRY.x1, WCW.x0]];
const inGlassX = (x) => PANES.some(([a, b]) => x >= a && x < b);
function paintHall() {
  const P = new Pix(W, H);
  const signs = []; // lysande skyltar (för kvällsglöden)
  // ---- taket: fackverk, ljuslister ----
  area(P, 0, 0, W, 10, (X, Y) => {
    let c = qmix(0x2e3038, 0x44474f, Y / 9, X, Y, 3);
    if (Y === 1) c = 0x6a6e78;
    if (Y === 8) c = 0x7a7e88;
    if (Y > 1 && Y < 8 && (((X + Y * 2) % 14) === 0 || ((X - Y * 2) % 14 + 14) % 14 === 0)) c = 0x5a5e68;
    return c;
  });
  for (let x = 12; x < W; x += 48) { P.hl(x, 4, 14, 0xf4f6fa); P.hl(x, 5, 14, 0xc8d0dc); P.px(x - 1, 4, 0x8a8e98); P.px(x + 14, 4, 0x8a8e98); }
  P.hl(0, 9, W, 0xd8dce2);
  // ---- väggarna (murade partier) ----
  const stone = (X, Y, x0) => {
    let c = jit(0xd2cabc, X, Y, 80, 0.06);
    if ((Y - 10) % 17 === 0 || ((X - x0) + (Math.floor((Y - 10) / 17) % 2) * 15) % 30 === 0) c = mul(c, 0.86);
    return c;
  };
  area(P, 0, 10, ARR.x1 + 8, 86, (X, Y) => stone(X, Y, 0));
  area(P, ENTRY.x0, 10, ENTRY.x1 - ENTRY.x0, 86, (X, Y) => stone(X, Y, ENTRY.x0));
  area(P, WCW.x0, 10, WCW.x1 - WCW.x0, 86, (X, Y) => { let c = jit(0xe8ecee, X, Y, 81, 0.03); if ((X - WCW.x0) % 8 === 0 || (Y - 10) % 8 === 0) c = mul(c, 0.9); return c; });
  for (const [a, b] of [[0, ARR.x1 + 8], [ENTRY.x0, ENTRY.x1], [WCW.x0, WCW.x1]]) { P.vl(a, 10, 86, 0x8a867c); P.vl(b - 1, 10, 86, 0x8a867c); }
  // ---- glasväggen: ram och bröstning, sedan hål för utsikten ----
  for (const [a, b] of PANES) {
    rows(P, a, GT, b - a, [0xb8bec6, 0x7a8088]);
    area(P, a, GB, b - a, WALL_Y - GB, (X, Y, i, j) => (j === 0 ? 0xe4e8ec : j === 5 ? 0x5a5e66 : (X % 3 === 0 ? 0x6a7078 : 0x9aa0a8)));
    P.erase(a, GT + 2, b - a, GB - GT - 2);
    for (let x = Math.ceil(a / MULL) * MULL; x < b; x += MULL) vcols(P, x, GT, GB - GT, [0xd8dce2, 0x6a7078]);
    vcols(P, a, GT, GB - GT, [0xd8dce2, 0x6a7078]); vcols(P, b - 2, GT, GB - GT, [0xd8dce2, 0x6a7078]);
    rows(P, a, TRANSOM, b - a, [0xdfe3e8, 0x7a8088]);
    rows(P, a, GB - 2, b - a, [0xc8ccd2, 0x7a8088]);
  }
  // skirting under the stone walls
  for (const [a, b] of [[0, ARR.x1 + 8], [ENTRY.x0, ENTRY.x1], [WCW.x0, WCW.x1]]) rows(P, a, WALL_Y - 3, b - a, [0x8a8478, 0x6a665e, 0x4a4640]);
  // ---- golvet: terrazzo med fogar och fläckar ----
  const JOINTS = [96, 103, 111, 120, 130, 141, 153, 166, 180, 195, 211];
  area(P, 0, WALL_Y, W, H - WALL_Y, (X, Y) => {
    let c = qmix(0xe0dcd2, 0xd2cdc2, (Y - WALL_Y) / 120, X, Y, 3);
    const h = hash(X, Y, 82);
    if (h > 0.93) c = mul(c, 0.86); else if (h > 0.9) c = mix(c, 0xffffff, 0.35);
    else if (h < 0.006) c = 0x7a8a9a; else if (h < 0.012) c = 0xb88a60;
    if (JOINTS.includes(Y) || X % 40 === 0) c = mul(c, 0.9);
    return c;
  });
  // mattan i väntehallen (blå med prickar och kant)
  area(P, 924, 136, 330, 78, (X, Y, i, j) => {
    if (i < 2 || j < 2 || i > 327 || j > 75) return i === 0 || j === 0 || i === 329 || j === 77 ? 0x1a2a4a : 0xc8a050;
    let c = jit(0x2a4270, X, Y, 83, 0.1);
    if ((i + j * 2) % 12 === 0 && j % 6 === 0) c = 0x4a6aa0;
    return c;
  });
  // fönstrens reflex i det blanka golvet
  for (const [a, b] of PANES) for (let x = a; x < b; x++) {
    if (x % MULL < 2) continue;
    for (let y = WALL_Y; y < WALL_Y + 24; y++) {
      const k = 1 - (y - WALL_Y) / 24;
      if (bayer(x, y) < k * 0.9) P.px(x, y, 0xffffff, 0.1 * k + 0.04);
    }
  }
  // entrémattan
  area(P, 348, 97, 64, 13, (X, Y, i, j) => (i === 0 || j === 0 || i === 63 || j === 12 ? 0x2e3036 : (Y % 2 === 0 ? 0x4a4c54 : 0x3e4046)));
  text(P, SMALL, 'VÄLKOMMEN', 380 - (textW(SMALL, 'VÄLKOMMEN') >> 1), 101, 0xa8aab0);
  // kompassrosen i golvet
  const RX = 380, RY = 156;
  for (let y = -9; y <= 9; y++) for (let x = -24; x <= 24; x++) {
    const d = Math.hypot(x / 22, y / 7.5);
    if (d > 1 && d < 1.14) P.px(RX + x, RY + y, 0xb88a40);
    else if (d > 0.86 && d <= 1) P.px(RX + x, RY + y, 0x3a4a6a);
  }
  for (const [dx, dy, len] of [[0, -1, 7], [0, 1, 7], [-1, 0, 20], [1, 0, 20]]) {
    for (let k = 0; k < len; k++) {
      const w2 = Math.round((1 - k / len) * (dy ? 3 : 1.4));
      for (let s = -w2; s <= w2; s++) P.px(RX + dx * k + (dy ? s : 0), RY + dy * k + (dx ? s : 0), s < 0 ? 0xe8c070 : 0xb88a40);
    }
  }
  text(P, SMALL, 'N', RX - 1, RY - 15, 0xb88a40);
  // gula linjer framför säkerhetsbågen
  for (let x = 836; x < 860; x += 4) P.hl(x, 170, 2, 0xe8b820);
  text(P, SMALL, 'VÄNTA HÄR', 848 - (textW(SMALL, 'VÄNTA HÄR') >> 1), 174, 0xc89a20);
  // ---- ankomstgången ----
  area(P, 6, 48, 24, 48, (X, Y, i, j) => {
    const vx = 18, vy = 66, k = j / 48;
    if (Y > vy + 4 + Math.abs(X - vx) * 0.5) return qmix(0x8a8a86, 0xc8c6c0, k, X, Y, 3);
    if (Y < vy - 6 - Math.abs(X - vx) * 0.4) return (X % 5 === 0 ? 0xf4f6fa : 0x6a6e76);
    return i < 5 || i > 18 ? 0xb8b2a4 : mix(0xe8e4d8, 0xfff8e0, 0.4);
  });
  P.rect(14, 60, 8, 10, 0x1e2026); P.hl(15, 62, 6, 0x5aff8a);
  rows(P, 5, 47, 26, [0x6a6e76, 0x9aa0a8]); P.vl(5, 48, 48, 0x7a8088); P.vl(30, 48, 48, 0x7a8088);
  signs.push(hangLike(P, 18, 36, 'ANKOMST', null));
  // ---- entréväggen: tavlan, UTGÅNG, dörren med korridoren, uttaget, kartan ----
  const B = BOARD;
  area(P, B.x, B.y, B.w, B.h, (X, Y, i, j) => (i < 2 || j < 2 || i >= B.w - 2 || j >= B.h - 2 ? (i === 0 || j === 0 ? 0x5a5e66 : 0x2a2c32) : 0x0c0d10));
  for (const [bx2, by2] of [[B.x + 3, B.y + 3], [B.x + B.w - 4, B.y + 3], [B.x + 3, B.y + B.h - 4], [B.x + B.w - 4, B.y + B.h - 4]]) P.px(bx2, by2, 0x6a6e76);
  text(P, BIG, 'AVGÅNGAR', B.x + 5, B.y + 4, 0xffd23a);
  icon(P, B.x + 5 + textW(BIG, 'AVGÅNGAR') + 4, B.y + 4, ICON.plane, 0xffd23a);
  P.hl(B.x + 3, B.y + 13, B.w - 6, 0x3a3e46);
  for (let r = 0; r < 5; r++) {
    const ry = B.y + 16 + r * 6;
    for (let x = B.x + 4; x < B.x + B.w - 4; x++) for (let y = ry; y < ry + 5; y++) {
      const cell = (x - B.x - 4) % 4;
      P.px(x, y, cell === 3 ? 0x0c0d10 : y === ry + 2 ? 0x121418 : 0x22262c);
    }
  }
  signs.push({ x: B.x, y: B.y, w: B.w, h: B.h, c: 0xffd23a, a: 0.08 });
  // UTGÅNG-skylten
  const ug = 'UTGÅNG', ugw = textW(SMALL, ug) + 16, ugx = 380 - (ugw >> 1);
  P.rect(ugx, 59, ugw, 7, 0x1e8a4a); P.hl(ugx, 59, ugw, 0x5ad88a); P.hl(ugx, 65, ugw, 0x0e4a26);
  icon(P, ugx + 3, 60, ICON.run.map((r) => r.slice(0, 5)), 0xffffff);
  text(P, SMALL, ug, ugx + 12, 60, 0xffffff);
  signs.push({ x: ugx, y: 59, w: ugw, h: 7, c: 0x5aff8a, a: 0.3 });
  // dörröppningen: karm + korridoren mot taxi och buss
  area(P, DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top, (X, Y, i, j) => {
    const vx = 380, vy = 80, dx = Math.abs(X - vx);
    if (Y > vy + 3 + dx * 0.45) return qmix(0x9a968c, 0xd8d4ca, (Y - vy) / 16, X, Y, 3);
    if (Y < vy - 5 - dx * 0.35) return (X % 6 === 0 && Y > DOOR.top + 2) ? 0xfff8e0 : 0x7a7a80;
    if (dx < 5 && Math.abs(Y - vy + 1) < 5) return 0x000000; // bortre öppningen (fylls varje bildruta)
    return X < vx ? qmix(0xc8c0b0, 0xa8a090, dx / 28, X, Y, 2) : qmix(0xb8b0a0, 0x98907e, dx / 28, X, Y, 2);
  });
  P.vl(366, DOOR.top, 3, 0x5a5e66); P.vl(394, DOOR.top, 3, 0x5a5e66);
  area(P, 362, DOOR.top + 3, 37, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === 36 || j === 7 ? 0x2a2c32 : 0x16161a));
  text(P, SMALL, 'TAXI', 365, DOOR.top + 5, 0xffd23a); P.px(381, DOOR.top + 7, 0xffd23a); text(P, SMALL, 'BUSS', 384, DOOR.top + 5, 0xffd23a);
  for (const fx of [DOOR.x0 - 3, DOOR.x1]) vcols(P, fx, DOOR.top - 2, WALL_Y - DOOR.top + 2, [0xe0e4ea, 0xa8aeb6, 0x5a6068]);
  rows(P, DOOR.x0 - 3, DOOR.top - 3, DOOR.x1 - DOOR.x0 + 6, [0xe0e4ea, 0xa8aeb6, 0x5a6068]);
  P.rect(376, DOOR.top - 1, 8, 2, 0x1a1c22); P.px(382, DOOR.top - 1, 0xff3a2a);
  // uttagsautomaten
  area(P, 298, 64, 22, 28, (X, Y, i, j) => (i === 0 || j === 0 ? 0xd8dce2 : i === 21 || j === 27 ? 0x5a6068 : 0xa8aeb6));
  P.rect(300, 60, 18, 5, 0xd8303a); text(P, SMALL, 'UTTAG', 300, 60, 0xffffff);
  P.rect(302, 68, 14, 9, 0x10141c); P.rect(303, 69, 12, 7, 0x2a5aa8); text(P, SMALL, 'KR', 305, 70, 0xd8ecff);
  for (let k = 0; k < 9; k++) P.rect(303 + (k % 3) * 3, 80 + Math.floor(k / 3) * 3, 2, 2, k === 8 ? 0x5ad88a : 0xe8ecf0);
  P.rect(313, 80, 3, 1, 0x1a1a1e); P.rect(312, 86, 5, 1, 0x1a1a1e);
  signs.push({ x: 302, y: 68, w: 14, h: 9, c: 0x5a9aff, a: 0.25 });
  // kartan HITTA RÄTT
  area(P, 420, 64, 42, 28, (X, Y, i, j) => (i === 0 || j === 0 || i === 41 || j === 27 ? 0x3a3e46 : j < 7 ? 0x16161a : 0xf4f2ec));
  text(P, SMALL, 'HITTA RÄTT', 422, 65, 0xffd23a);
  for (const [zx, zw, zc] of [[422, 6, 0x5a8ad0], [429, 6, 0xb8b2a4], [436, 9, 0x2e5a9a], [446, 4, 0xd8303a], [451, 9, 0x5aa05a]]) P.rect(zx, 76, zw, 8, zc);
  P.rect(430, 79, 2, 2, 0xd8303a); text(P, SMALL, 'DU', 426, 85, 0xd8303a);
  // ---- toalettväggen ----
  area(P, 1394, 56, 36, 40, (X, Y, i, j) => {
    const vx = 1412, vy = 70, dx = Math.abs(X - vx);
    if (Y > vy + 2 + dx * 0.5) return qmix(0xb8c4c8, 0xd8e0e2, (Y - vy) / 26, X, Y, 3);
    if (Y < vy - 4 - dx * 0.3) return X % 5 === 0 ? 0xf4f6fa : 0x8a9096;
    if (dx < 4) return 0x3a4048;
    return X < vx ? 0xd0d8da : 0xb8c0c2;
  });
  for (const dx of [1398, 1422]) { P.rect(dx, 64, 4, 12, 0x6a8aa8); P.px(dx + 3, 70, 0xd8dce2); }
  vcols(P, 1392, 54, 42, [0xe0e4ea, 0x8a9096]); vcols(P, 1429, 54, 42, [0xe0e4ea, 0x8a9096]); rows(P, 1392, 53, 39, [0xe0e4ea, 0x8a9096]);
  area(P, 1394, 36, 34, 14, (X, Y, i, j) => (i === 0 || j === 0 || i === 33 || j === 13 ? 0x2a2c32 : 0x16161a));
  text(P, BIG, 'WC', 1397, 39, 0xffd23a);
  icon(P, 1411, 40, ICON.man, 0xffd23a); icon(P, 1416, 40, ICON.lady, 0xffd23a); icon(P, 1421, 40, ICON.wheel, 0xffd23a);
  signs.push({ x: 1394, y: 36, w: 34, h: 14, c: 0xffd23a, a: 0.2 });
  // vattenfontänen
  area(P, 1432, 74, 7, 12, (X, Y, i, j) => (j === 0 ? 0xf4f6f8 : i === 6 ? 0x7a8088 : 0xc8ccd2));
  P.px(1434, 73, 0x5ab4ff);
  // ---- incheckningens skärmtavlor (bakom bandet) ----
  for (const D of DESKS) {
    for (const vx of [D.x0 + 6, D.x1 - 7]) P.vl(vx, 10, FASCIA - 10, 0x5a5e66);
    area(P, D.x0, FASCIA, D.x1 - D.x0, 17, (X, Y, i, j) => (j === 0 ? 0x4a6aa8 : j === 16 ? 0x0e1a34 : j === 15 ? 0xffd23a : 0x1e3460));
    P.rect(D.x0 + 2, FASCIA + 2, 7, 7, 0xffd23a); text(P, SMALL, String(D.k + 1), D.x0 + 4, FASCIA + 3, 0x16161a);
    text(P, SMALL, 'SNABBFLYG', D.x0 + 12, FASCIA + 3, 0xffffff);
    P.rect(D.x0 + 2, FASCIA + 10, D.x1 - D.x0 - 4, 7, 0x0a0c12);
    signs.push({ x: D.x0, y: FASCIA, w: D.x1 - D.x0, h: 17, c: 0x7aa0ff, a: 0.12 });
  }
  // ---- bandets matning vid karusellen (rutschens lucka i väggen) ----
  area(P, FEED.x0, FEED.top, FEED.x1 - FEED.x0, WALL_Y - FEED.top, (X, Y, i, j) => {
    if (i === 0 || j === 0) return 0xe8ecf0;
    if (i === FEED.x1 - FEED.x0 - 1) return 0x6a7078;
    return jit(0xb8bec6, X, Y, 84, 0.05);
  });
  P.rect(FEED.x0 + 4, FEED.top + 2, 40, 7, 0x0a0a0c);
  area(P, FEED.x0 + 8, 72, 32, 16, (X, Y, i) => (i % 4 === 3 ? 0x0a0a0e : (Y % 5 === 0 ? 0x2a2a30 : 0x1a1a1e)));
  rows(P, FEED.x0 + 6, 70, 36, [0x8a9098, 0x4a4e56]);
  for (let x = FEED.x0 + 6; x < FEED.x1 - 6; x++) P.px(x, 89, ((x >> 1) & 1) ? 0xffd23a : 0x16161a);
  text(P, SMALL, 'BAND 1', FEED.x0 + 12, 91, 0x3a3e46);
  // ---- pelarna ----
  for (const cx of COLS) {
    const sh = [0xa8aeb6, 0xd8dce2, 0xf4f6f8, 0xffffff, 0xf0f2f4, 0xdce0e4, 0xc0c6cc, 0x9aa0a8, 0x7a8088];
    for (let x = 0; x < 9; x++) P.vl(cx - 4 + x, 10, 90, sh[x]);
    rows(P, cx - 5, 10, 11, [0x5a5e66, 0x8a9098]);
    area(P, cx - 5, 96, 11, 5, (X, Y, i, j) => (j === 0 ? 0xe8ecf0 : i === 0 ? 0xc8ccd2 : i === 10 ? 0x5a6068 : 0x9aa0a8));
    // högtalaren på pelaren
    area(P, cx - 3, 54, 7, 6, (X, Y, i, j) => (j === 0 ? 0x9aa0a8 : (i + j) % 2 ? 0x3a3e46 : 0x5a5e66));
    P.hl(cx - 4, 60, 9, 0x6a6e76);
  }
  // reklamljuslådor på två pelare
  for (const [cx, kind] of [[1048, 0], [1258, 1]]) {
    const x0 = cx - 7, y0 = 64;
    P.rect(x0 - 1, y0 - 1, 16, 22, 0x2a2c32);
    area(P, x0, y0, 14, 20, (X, Y, i, j) => {
      if (kind === 0) return j < 9 ? qmix(0x5ab4f0, 0xbfe6ff, j / 9, X, Y, 3) : j < 13 ? 0x2a8ac8 : 0xf0dca0;
      return j < 11 ? qmix(0x1e2a5a, 0x6a4a8a, j / 11, X, Y, 3) : 0x2a2440;
    });
    if (kind === 0) { P.ell(x0 + 10, y0 + 3, 2.2, 2.2, 0xffe070, 1, 2); P.vl(x0 + 4, y0 + 8, 8, 0x6a4a2a); for (const [lx, ly] of [[1, 7], [2, 6], [3, 6], [5, 6], [6, 6], [7, 7]]) P.px(x0 + lx, y0 + ly, 0x2e8a3a); text(P, SMALL, 'SOL', x0 + 2, y0 + 14, 0xd8303a); }
    else { for (let k = 0; k < 5; k++) P.rect(x0 + 1 + k * 3, y0 + 10 - (k % 3) * 2 - 3, 2, 3 + (k % 3) * 2, 0x0e1224); for (let k = 0; k < 8; k++) P.px(x0 + 1 + hash(k, 0, 85) * 12, y0 + 5 + hash(k, 1, 85) * 6, 0xffd070); text(P, SMALL, 'STAN', x0 + 0, y0 + 14, 0xffd23a); }
    signs.push({ x: x0, y: y0, w: 14, h: 20, c: 0xfff0d0, a: 0.25 });
  }
  // ---- gate-dörrarna i glasväggen (till bryggorna) ----
  for (const gt of GATES) {
    const d0 = gt.x - 13, d1 = gt.x + 13;
    area(P, d0 - 3, 44, d1 - d0 + 6, WALL_Y - 44, (X, Y, i, j) => (i < 3 || i > d1 - d0 + 2 ? (i === 0 || i === d1 - d0 + 5 ? 0x6a7078 : 0xd8dce2) : Y < 56 ? (j < 2 ? 0x9aa0a8 : 0x16161a) : null));
    area(P, d0, 56, d1 - d0, WALL_Y - 56, (X, Y, i, j) => (i === 12 || i === 13 ? 0x6a7078 : j === 0 ? 0xd8dce2 : qmix(0xb8c8d4, 0x8aa0b0, j / 40, X, Y, 3)));
    for (const hx of [gt.x - 3, gt.x + 2]) P.rect(hx, 74, 2, 6, 0xe8ecf0);
    text(P, BIG, gt.id, gt.x - (textW(BIG, gt.id) >> 1), 47, 0xffd23a);
    signs.push({ x: d0, y: 44, w: 26, h: 12, c: 0xffd23a, a: 0.2 });
    // gateskärmen på en stolpe bredvid
    const sx0 = gt.scr > 0 ? gt.x + 18 : gt.x - 56;
    vcols(P, sx0 + 18, 79, 17, [0xb8bec6, 0x6a7078]);
    area(P, sx0, 59, 38, 21, (X, Y, i, j) => (i === 0 || j === 0 || i === 37 || j === 20 ? 0x3a3e46 : 0x0a0c12));
    signs.push({ x: sx0, y: 59, w: 38, h: 21, c: 0x7aa0ff, a: 0.15 });
  }
  // ---- kaffebaren: bakväggen med hyllor, maskin och ljusskylten ----
  const KX = KIOSK.x0, KW = KIOSK.x1 - KIOSK.x0;
  area(P, KX, 40, KW, 56, (X, Y, i, j) => {
    if (j < 11) return i === 0 || i === KW - 1 || j === 0 || j === 10 ? 0x3a2418 : 0x4a2c1c;
    if (j === 11) return 0x2a1a10;
    let c = jit(0x6a4630, X, Y, 86, 0.08);
    if ((j - 12) % 13 === 0) c = 0xc89a60;
    if ((j - 12) % 13 === 1) c = 0x4a3020;
    return c;
  });
  const kt = 'PIXEL KAFFE';
  text(P, BIG, kt, KX + (KW >> 1) - (textW(BIG, kt) >> 1) + 5, 42, 0xffe8b0);
  icon(P, KX + (KW >> 1) - (textW(BIG, kt) >> 1) - 6, 42, ICON.cup, 0xffe8b0);
  signs.push({ x: KX, y: 40, w: KW, h: 11, c: 0xffb060, a: 0.3 });
  for (let s = 0; s < 3; s++) {
    const sy = 52 + s * 13;
    for (let x = KX + 4; x < KX + KW - 4; x += 5) {
      const k = Math.floor(hash(x, sy, 87) * 5);
      const col = [0xe8e4d8, 0xd8303a, 0x3a7bd5, 0x5aa05a, 0xe0b030][k];
      const hh = 4 + ((x >> 2) % 3);
      P.rect(x, sy + 11 - hh, 3, hh, col); P.px(x, sy + 11 - hh, mix(col, WHITE, 0.4));
    }
  }
  // espressomaskinen på bakdisken
  area(P, KX + 70, 76, 30, 16, (X, Y, i, j) => (j === 0 ? 0xf4f6f8 : i === 0 ? 0xd8dce2 : i === 29 ? 0x6a7078 : j < 6 ? 0xc9323a : 0xb8bec6));
  for (const gx of [KX + 76, KX + 86]) { P.rect(gx, 86, 4, 2, 0x2a2c30); P.vl(gx + 1, 88, 2, 0x5a5e66); }
  P.rect(KX + 92, 79, 5, 3, 0x0a0c12); P.px(KX + 93, 80, 0x5aff8a);
  // ---- hängande skyltar och högtalare ----
  signs.push(hangLike(P, 150, 13, 'BAGAGEBAND 1', ICON.case));
  signs.push(hangLike(P, 640, 13, 'INCHECKNING', ICON.desk));
  signs.push(hangLike(P, 846, 13, 'SÄKERHETSKONTROLL', ICON.guard));
  signs.push(hangLike(P, 1100, 13, 'GATE A1-A2', ICON.plane, true));
  signs.push(hangLike(P, 1320, 22, 'KAFÉ', ICON.cup));
  for (const sp of SPEAKERS) {
    if (COLS.includes(sp.x)) continue;
    P.vl(sp.x, 9, sp.y - 9, 0x5a5e66);
    area(P, sp.x - 3, sp.y, 7, 7, (X, Y, i, j) => (j === 0 ? 0x9aa0a8 : i === 0 ? 0x7a8088 : (i + j) % 2 ? 0x3a3e46 : 0x5a5e66));
  }
  return { img: P.flush(), signs };
}
// hängande skylt + dess lysruta
function hangLike(P, cx, y, label, ic, arrow = false) { const r = hangSign(P, cx, y, label, ic, arrow); return { ...r, c: 0xffd23a, a: 0.18 }; }

// Reflexerna i glaset (ovanpå utsikten, under allt inne): diagonala strimmor på dagen,
// på natten speglas takets lampor och hallens ljus svagt i rutorna.
function paintGlass(mode) {
  const P = new Pix(W, GB - GT);
  for (const [a, b] of PANES) {
    if (mode === 'dag') reflect(P, a, 0, b - a, GB - GT, 0.8, 5);
    else {
      reflect(P, a, 0, b - a, GB - GT, 0.35, 5, 0xffe8c8);
      for (let x = a + 4; x < b; x += 48) { P.hl(x + 6, GB - GT - 10, 12, 0xfff0d0, 0.18); P.hl(x + 8, GB - GT - 9, 8, 0xfff0d0, 0.12); }
      for (let x = a; x < b; x++) if ((x & 3) === 0) P.px(x, GB - GT - 4, 0xd8c8a8, 0.1);
    }
  }
  return P.flush();
}
// Kvällens ljus inne: pölar under taklisterna, sken runt skyltarna, kaffebarens värme.
function paintHallLight(signs) {
  const P = new Pix(W, H);
  for (let x = 19; x < W; x += 48) { P.ell(x, 6, 16, 5, 0xfff4d8, 0.5, 4); P.ell(x, WALL_Y + 14, 26, 8, 0xfff0d0, 0.12, 4); }
  for (const s of signs) P.ell(s.x + s.w / 2, s.y + s.h / 2, s.w / 2 + 6, s.h / 2 + 5, s.c, s.a + 0.1, 4);
  P.ell((KIOSK.x0 + KIOSK.x1) / 2, 120, 70, 22, 0xffc080, 0.16, 4);
  P.ell(380, 100, 30, 10, 0xffe8c0, 0.14, 4);
  return P.flush();
}

// ======================= föremålen på golvet =======================
// Varje sak är en liten bild med förankring: { img, x, y } = var bilden ritas i världen.
function sprite(x, y, w, h, paint, ol = true, dark = 0x1e1c24) {
  const P = new Pix(w, h);
  paint(P);
  if (ol) outline(P, dark);
  return { img: P.flush(), x, y };
}
// lövklump: ljus uppe till vänster, taggig kant
function leaves(P, cx, cy, rx, ry, seed, dark, midc, light, dens = 0.55) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) continue;
    const h = hash(x, y, seed);
    if (d > 0.72 && h > dens) continue;
    const l = ((cx - x) / rx + (cy - y) / ry) * 0.45 + (h - 0.5) * 0.9;
    P.px(x, y, l > 0.35 ? light : l > -0.25 ? midc : dark);
  }
}
// incheckningsdisken (framsidan mot resenärerna): blå front med logga och nummer,
// vit disk, skärmens baksida och boardingkortskrivaren
function deskSprite(D) {
  const w = D.x1 - D.x0 + 4;
  return sprite(D.x0 - 2, DESK_Y - 28, w, 30, (P) => {
    area(P, 0, 10, w, 18, (X, Y, i, j) => {
      if (j === 0) return 0x5a8ad0;
      if (j >= 16) return 0x16223e;
      if (i === 0) return 0x4a7ac0;
      if (i === w - 1) return 0x1e3a6a;
      let c = jit(0x2e5a9a, X, Y, 90, 0.05);
      if (i % 12 === 11) c = 0x24487e;
      return c;
    });
    rows(P, 0, 7, w, [0xffffff, 0xe8e8e0, 0xb8b8b0]);
    area(P, 4, 13, 12, 7, (X, Y, i, j) => (j === 0 ? 0xffe070 : 0xffd23a));
    text(P, SMALL, 'SF', 6, 14, 0x1e3460);
    P.rect(w - 11, 13, 7, 7, 0xffffff); text(P, SMALL, String(D.k + 1), w - 9, 14, 0x1e3460);
    // skärmen (baksidan) och skrivaren på disken
    area(P, 30, 0, 13, 7, (X, Y, i, j) => (j === 0 ? 0x6a6e76 : i === 0 ? 0x5a5e66 : 0x3a3e46));
    P.rect(35, 6, 3, 1, 0x2a2c30);
    area(P, 14, 3, 9, 4, (X, Y, i, j) => (j === 0 ? 0xe8ecf0 : 0xb8bec6)); P.rect(16, 2, 5, 1, 0xffffff);
    P.rect(w - 20, 5, 4, 2, 0xc9323a); // en liten klocka att ringa i
  });
}
// vågen framför bandet (resenären lyfter upp väskan här) + bandet in till uppsamlingsbandet
function scaleSprite(D) {
  return sprite(D.sx0, WALL_Y + 1, 20, 28, (P) => {
    for (let y = 0; y < 22; y++) {
      P.px(1, y, 0xd8dce2); P.px(18, y, 0x7a8088);
      for (let x = 2; x < 18; x++) P.px(x, y, (y % 4 === 0) ? 0x3a3c42 : 0x2a2c30);
    }
    rows(P, 0, 20, 20, [0xe8ecf0, 0xc8ccd2, 0x9aa0a8, 0x8a9098, 0x7a8088, 0x5a6068, 0x3a3e46]);
    for (let x = 2; x < 18; x += 3) P.px(x, 21, 0xf4f6f8);
    P.vl(17, 8, 12, 0x9aa0a8); P.vl(18, 8, 12, 0x5a6068);
    area(P, 11, 2, 9, 7, (X, Y, i, j) => (i === 0 || j === 0 || i === 8 || j === 6 ? 0x3a3e46 : 0x0a0a0c));
  });
}
// uppsamlingsbandet bakom diskarna (bandytan ritas levande ovanpå)
function beltSprite() {
  const w = BELT.x1 - BELT.x0;
  return sprite(BELT.x0, 91, w, 9, (P) => {
    rows(P, 0, 0, w, [0xd8dce2, 0x2a2c30, 0x2a2c30, 0x2a2c30, 0xe0e4ea, 0xb8bec6, 0xa8aeb6, 0x8a9098, 0x3a3e46]);
    for (let x = 6; x < w; x += 16) { P.px(x, 6, 0x5a6068); P.px(x + 1, 7, 0xe0e4ea); }
  }, false);
}
function hatchSprite() {
  return sprite(HATCH.x0, 64, 24, 36, (P) => {
    area(P, 0, 0, 24, 36, (X, Y, i, j) => {
      if (i === 0 || j === 0) return 0xe8ecf0;
      if (i === 23) return 0x5a6068;
      if (j >= 30) return ((i + j) >> 1) % 2 ? 0x16161a : 0xffd23a;
      return jit(0xb8bec6, X, Y, 91, 0.05);
    });
    area(P, 12, 18, 11, 12, (X, Y, i) => (i % 3 === 2 ? 0x0a0a0e : 0x22222a));
    text(P, SMALL, 'IN', 4, 4, 0x3a3e46);
    P.rect(4, 12, 5, 3, 0xff7a1e);
  });
}
// kön: bandspärrar med rött band, stängt i högra änden, KÖ-skylt vid ingången
function laneSprite() {
  const x0 = 470, w = LANE.x1 - x0 + 10, top = 112, base = LANE.bar - top;
  return sprite(x0, top, w, 40, (P) => {
    const post = (x, by) => {
      P.vl(x, by - 13, 13, 0xe8ecf0); P.vl(x + 1, by - 13, 13, 0x8a9098);
      P.rect(x - 1, by - 14, 4, 2, 0x3a3e46); P.rect(x - 2, by, 6, 2, 0x6a7078);
    };
    const xs = [];
    for (let x = LANE.x0 - x0; x <= LANE.x1 - x0 - 4; x += 22) xs.push(x);
    for (let k = 0; k < xs.length - 1; k++) for (let x = xs[k] + 2; x < xs[k + 1]; x++) {
      const sag = Math.round(Math.sin((x - xs[k]) / (xs[k + 1] - xs[k]) * Math.PI));
      P.px(x, base - 10 + sag, 0xd8303a); P.px(x, base - 9 + sag, 0x8a1a20);
    }
    for (const x of xs) post(x, base);
    // stängt i högra änden (bandet går in i djupet – syns som ett lodrätt band)
    const ex = xs[xs.length - 1];
    for (let y = base - 30; y <= base - 10; y++) { P.px(ex, y, 0xd8303a); P.px(ex + 1, y, 0x8a1a20); }
    post(ex, base - 20);
    // skylten vid ingången
    P.vl(8, base - 16, 16, 0x9aa0a8); P.vl(9, base - 16, 16, 0x5a6068); P.rect(5, base, 8, 2, 0x6a7078);
    area(P, 0, base - 26, 22, 10, (X, Y, i, j) => (i === 0 || j === 0 || i === 21 || j === 9 ? 0x2a2c32 : 0x16161a));
    text(P, SMALL, 'KÖ', 3, base - 23, 0xffd23a); icon(P, 14, base - 23, ICON.arrow, 0xffd23a);
  });
}
// röntgenmaskinen: ljus låda, tunnel med gummiridå, skärm ovanpå
function xraySprite() {
  return sprite(XRAY.x0 - 2, 106, 36, 36, (P) => {
    area(P, 2, 6, 32, 8, (X, Y, i, j) => (j === 0 ? 0xc8ccd2 : jit(0xeef0f2, X, Y, 92, 0.03)));
    area(P, 2, 14, 32, 21, (X, Y, i, j) => {
      if (j === 0) return 0xffffff;
      if (i === 0) return 0xe8ecf0;
      if (i === 31) return 0x8a9098;
      if (j >= 17 && j <= 18) return 0x2a6ad0;
      if (j === 20) return 0x3a3e46;
      return jit(0xd8dce2, X, Y, 93, 0.03);
    });
    area(P, 8, 19, 20, 12, (X, Y, i) => (i % 3 === 2 ? 0x0a0a0e : 0x2a2c34));
    rows(P, 7, 18, 22, [0x8a9098]);
    text(P, SMALL, 'RÖNTGEN', 5, 15 - 1, 0x2a6ad0);
    for (const [i, j] of [[1, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]) P.px(30 + i, 21 + j, 0xffd23a);
    area(P, 20, 0, 13, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === 12 || j === 7 ? 0x2a2c32 : 0x0a0c12));
    P.vl(26, 8, 1, 0x3a3e46);
  });
}
function xrayBeltSprite() {
  return sprite(XRAY.x0 + 4, 140, 24, 27, (P) => {
    for (let y = 0; y < 24; y++) { vcols(P, 0, y, 1, [0xe8ecf0, 0x9aa0a8]); vcols(P, 22, y, 1, [0x9aa0a8, 0x5a6068]); for (let x = 2; x < 22; x++) P.px(x, y, 0x3a3c42); }
    rows(P, 0, 24, 24, [0xd8dce2, 0x9aa0a8, 0x5a6068]);
  });
}
function trayStackSprite() {
  return sprite(806, 160, 18, 13, (P) => {
    for (let k = 0; k < 5; k++) { const y = 10 - k * 2; P.hl(1, y, 16, 0x8a9098); P.hl(0, y - 1, 18, 0xc8ccd2); }
    P.rect(3, 11, 12, 2, 0x5a6068);
  });
}
// metallbågen (öppningen mot oss)
function archSprite() {
  return sprite(ARCH.p0 - 1, 99, 22, 43, (P) => {
    for (const px of [1, 17]) {
      for (let y = 1; y < 41; y++) { P.px(px, y, 0xf0f2f4); P.px(px + 1, y, 0xd0d4dc); P.px(px + 2, y, 0xb8bec6); P.px(px + 3, y, 0x8a9098); }
      P.rect(px - 1, 40, 6, 2, 0x3a3e46);
    }
    area(P, 1, 1, 20, 6, (X, Y, i, j) => (j === 0 ? 0xf4f6f8 : j === 5 ? 0x8a9098 : 0xd0d4dc));
    P.rect(7, 2, 8, 4, 0x16181c);
  });
}
// glasväggarna runt säkerhetskontrollen
function glassFront() {
  return sprite(832, 117, 66, 25, (P) => {
    for (const [a, b] of [[0, 4], [24, 64]]) {
      area(P, a, 1, b - a, 21, (X, Y, i, j) => 0xb8d8e8);
      for (let y = 1; y < 22; y++) for (let x = a; x < b; x++) if ((((x * 2 - y * 3) % 23) + 23) % 23 < 2) P.px(x, y, 0xffffff);
      rows(P, a, 0, b - a, [0xe8ecf0]); rows(P, a, 22, b - a, [0x9aa0a8, 0x5a6068]);
    }
    for (const x of [24, 44, 64]) { P.vl(x, 0, 24, 0xe8ecf0); P.vl(x + 1, 0, 24, 0x8a9098); }
  }, false);
}
function glassEdge(x, ya, yb) {
  const h = yb - ya + 24;
  return sprite(x - 2, ya - 22, 5, h, (P) => {
    for (let y = 0; y < h - 2; y++) { P.px(1, y, 0xb8d8e8); P.px(2, y, 0xa8c8d8); }
    for (let y = 0; y < yb - ya; y++) P.px(2, y, 0xe8ecf0);
    P.vl(1, h - 24, 23, 0xe8ecf0); P.vl(2, h - 24, 23, 0x8a9098); P.rect(0, h - 2, 5, 2, 0x5a6068);
  }, false);
}
// karusellen: golvskugga, kjol, lamellbandet (ytan) – ön ovanpå – rutschen bakifrån
const CS = { cy: CAR.cy - 5, orx: 92, ory: 17, irx: 80, iry: 11, mrx: 86, mry: 14 };
function carBaseSprite() {
  const ox = CAR.cx - 100, oy = CAR.cy - 28;
  return sprite(ox, oy, 200, 40, (P) => {
    const cx = CAR.cx - ox, cy = CS.cy - oy;
    P.ell(cx, cy + 9, 100, 12, 0x1a1418, 0.28, 4);
    for (let y = -CS.ory - 1; y <= CS.ory + 6; y++) for (let x = -CS.orx - 1; x <= CS.orx + 1; x++) {
      const dO = Math.hypot(x / CS.orx, y / CS.ory), dI = Math.hypot(x / CS.irx, y / CS.iry);
      if (dO <= 1 && dI > 1) {
        const ang = Math.atan2(y / CS.ory, x / CS.orx);
        let c = dO > 0.93 ? 0xc8ccd2 : dI < 1.06 ? 0x1a1c20 : 0x3e4048;
        if (Math.sin(ang) < -0.2 && dO > 0.93) c = 0xe0e4ea;
        P.px(cx + x, cy + y, c);
      } else if (dO > 1 && y > 0) {
        // kjolen: framsidan under bandytan (5 px)
        const yEdge = CS.ory * Math.sqrt(Math.max(0, 1 - (x / CS.orx) ** 2));
        if (Math.abs(x) <= CS.orx && y > yEdge && y <= yEdge + 5) P.px(cx + x, cy + y, y > yEdge + 4 ? 0x3a3e46 : y > yEdge + 3 ? 0x6a7078 : (x % 9 === 0 ? 0x8a9098 : 0xa8aeb6));
      }
    }
  });
}
function carIslandSprite() {
  const ox = CAR.cx - 82, oy = CAR.cy - 22;
  return sprite(ox, oy, 164, 26, (P) => {
    const cx = CAR.cx - ox, cy = CAR.cy - 9 - oy, rx = 76, ry = 9;
    for (let y = -ry - 1; y <= ry + 5; y++) for (let x = -rx; x <= rx; x++) {
      const d = Math.hypot(x / rx, y / ry);
      if (d <= 1) {
        let c = jit(0xc8ccd4, cx + x, cy + y, 94, 0.04);
        if (((x * 3 + y * 7) % 19 + 19) % 19 === 0) c = 0xe0e4ea;
        if (d > 0.94) c = y < 0 ? 0xeef0f2 : 0xa8aeb6;
        P.px(cx + x, cy + y, c);
      } else if (y > 0) {
        const yEdge = ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
        if (y > yEdge && y <= yEdge + 4) P.px(cx + x, cy + y, y > yEdge + 3 ? 0x4a4e56 : 0x8a9098);
      }
    }
    // mitten: en skylt med bandnumret
    area(P, cx - 9, cy - 6, 18, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === 17 || j === 7 ? 0x2a2c32 : 0x16161a));
    text(P, SMALL, '1', cx - 1, cy - 4, 0xffd23a);
  });
}
function chuteSprite() {
  // rutschen från luckan ner till bandet: smal där uppe (längre bort), bredare nertill,
  // med rullar som glesnar mot oss och upphöjda kanter
  return sprite(CHUTE.x0 - 5, CHUTE.top - 2, 30, 52, (P) => {
    const RIB = [3, 6, 10, 15, 21, 28, 36, 45];
    for (let y = 0; y < 50; y++) {
      const k = y / 49, half = Math.round(lerp(6, 10, k)), cx = 15;
      for (let x = cx - half; x < cx + half; x++) {
        let c = qmix(0xb8bec6, 0xd8dce2, k, x, y, 3);
        if (RIB.includes(y)) c = 0xeef0f2; else if (RIB.includes(y - 1)) c = 0x8a9098;
        if (y < 3) c = mix(c, 0x2a2c30, 0.6 - y * 0.2);
        P.px(x, y + 1, c);
      }
      P.px(cx - half - 2, y + 1, 0xe8ecf0); P.px(cx - half - 1, y + 1, 0x9aa0a8);
      P.px(cx + half, y + 1, 0xc8ccd2); P.px(cx + half + 1, y + 1, 0x5a6068);
    }
    rows(P, 7, 0, 16, [0x3a3e46]);
    for (let x = 4; x < 27; x++) P.px(x, 50, 0x5a6068);
  });
}
// väntstolar i rad (aluminiumram, blå dynor). dir 'down' = vänd mot oss, 'up' = mot fönstret.
function benchSprites(B) {
  const x0 = B.x - 7, w = (B.n - 1) * 13 + 15, y0 = B.y - 25;
  const seatPan = (P, sx) => { rows(P, sx - 5, 14, 11, [0x5a8ad0, 0x2e5a9a, 0x1e3a6a]); };
  const beam = (P) => {
    rows(P, 0, 17, w, [0xd8dce2, 0x8a9098]);
    for (let k = 0; k < B.n; k += 3) { const lx = 7 + k * 13 + (k === B.n - 1 ? 0 : 6); P.vl(lx, 19, 6, 0xc8ccd4); P.vl(lx + 1, 19, 6, 0x7a8088); P.hl(lx - 1, 24, 4, 0x3a3e46); }
    P.vl(1, 19, 6, 0xc8ccd4); P.vl(w - 2, 19, 6, 0x7a8088); P.hl(0, 24, 3, 0x3a3e46); P.hl(w - 3, 24, 3, 0x3a3e46);
  };
  const arms = (P) => { for (let k = 0; k <= B.n; k++) { const ax = 7 + k * 13 - 7; P.hl(ax - 1, 10, 3, 0x2a2c30); P.vl(ax, 11, 4, 0x8a9098); } };
  const restFront = (P, sx) => {
    for (let y = 2; y <= 13; y++) for (let x = sx - 5; x <= sx + 5; x++) {
      if ((y === 2) && (x === sx - 5 || x === sx + 5)) continue;
      let c = y === 2 ? 0xd8dce2 : y === 13 ? 0xa8aeb6 : 0x2e5a9a;
      if (y > 2 && y < 13) { if (x === sx - 5) c = 0x4a7ac0; else if (x === sx + 5) c = 0x1e3a6a; else if (x === sx - 2 || x === sx + 2) c = 0x24487e; else if (y === 3) c = 0x4a7ac0; }
      P.px(x, y, c);
    }
  };
  const restBack = (P, sx) => {
    for (let y = 4; y <= 13; y++) for (let x = sx - 5; x <= sx + 5; x++) {
      if (y === 4 && (x === sx - 5 || x === sx + 5)) continue;
      let c = y === 4 ? 0xe8ecf0 : x === sx - 5 ? 0xd0d4dc : x === sx + 5 ? 0x7a8088 : 0xa8aeb6;
      if (x === sx && y > 5 && y < 12) c = 0x8a9098;
      P.px(x, y, c);
    }
  };
  if (B.dir === 'down') {
    return { seat: sprite(x0, y0, w, 26, (P) => { for (let k = 0; k < B.n; k++) restFront(P, 7 + k * 13); beam(P); for (let k = 0; k < B.n; k++) seatPan(P, 7 + k * 13); arms(P); }) };
  }
  return {
    seat: sprite(x0, y0, w, 26, (P) => { beam(P); for (let k = 0; k < B.n; k++) seatPan(P, 7 + k * 13); }),
    rest: sprite(x0, y0, w, 26, (P) => { for (let k = 0; k < B.n; k++) restBack(P, 7 + k * 13); arms(P); }),
  };
}
// gatedisken
function podiumSprite(gt) {
  return sprite(gt.x - 40, 98, 24, 22, (P) => {
    area(P, 0, 6, 24, 14, (X, Y, i, j) => (j === 0 ? 0x5a8ad0 : j >= 12 ? 0x16223e : i === 0 ? 0x4a7ac0 : i === 23 ? 0x1e3a6a : jit(0x2e5a9a, X, Y, 95, 0.05)));
    rows(P, 0, 4, 24, [0xffffff, 0xd8d8d0]);
    P.rect(3, 9, 18, 5, 0xffd23a); text(P, SMALL, gt.id, 12 - (textW(SMALL, gt.id) >> 1), 9, 0x1e3460);
    area(P, 12, 0, 9, 4, (X, Y, i, j) => (j === 0 ? 0x6a6e76 : 0x3a3e46));
  });
}
// kaffebarens disk: glasmonter med bullar, kassa, menyskylt
function kioskSprite() {
  const w = KIOSK.x1 - KIOSK.x0 + 2;
  return sprite(KIOSK.x0 - 1, KIOSK.y - 30, w, 32, (P) => {
    area(P, 0, 12, w, 18, (X, Y, i, j) => {
      if (j === 0) return 0xf4f0e8;
      if (j === 1) return 0xd8d0c0;
      if (j >= 16) return 0x3a2418;
      let c = jit(0x8a5a34, X, Y, 96, 0.06);
      if (i % 6 === 5) c = 0x6a4226;
      if (i === 0) c = 0xa8744a;
      return c;
    });
    // glasmontern
    area(P, 6, 2, 40, 10, (X, Y, i, j) => (j === 0 ? 0xe8f4fa : i === 0 || i === 39 ? 0xc8dce8 : j === 9 ? 0xc8a070 : 0xdcecf2));
    for (let k = 0; k < 9; k++) { const bx = 9 + k * 4, by = 8 - (k % 2) * 3; P.rect(bx, by, 3, 2, [0xd88c46, 0xf0c888, 0x8a4a2a, 0xe8b0c0][k % 4]); P.px(bx, by, 0xf4c47c); }
    // menyskylten
    area(P, 52, 2, 34, 10, (X, Y, i, j) => (i === 0 || j === 0 || i === 33 || j === 9 ? 0x6a4a2a : 0x1a1a1e));
    text(P, SMALL, 'KAFFE 49', 54, 4, 0xf4f1ea);
    // kassan
    area(P, 94, 3, 12, 9, (X, Y, i, j) => (j < 4 ? (i === 0 || j === 0 ? 0x2a2c30 : 0x3a8a6a) : j === 4 ? 0x16161a : 0x3a3e46));
    P.rect(108, 8, 4, 4, 0xe8f4fa); P.px(109, 10, 0xe0b030); P.px(110, 9, 0xe0b030);
  });
}
function highTableSprite(x, y) {
  return sprite(x - 7, y - 18, 14, 19, (P) => {
    rows(P, 0, 0, 14, [0xf4f0e8, 0xc8c0b0, 0x8a8070]);
    P.vl(6, 3, 13, 0xc8ccd4); P.vl(7, 3, 13, 0x7a8088);
    P.rect(3, 16, 8, 2, 0x5a6068); P.hl(4, 18, 6, 0x3a3e46);
    P.rect(2, -0, 2, 1, 0xffffff);
  });
}
function plantSprite(x, y, k) {
  return sprite(x - 14, y - 44, 28, 45, (P) => {
    if (k === 0) {
      P.vl(13, 14, 20, 0x6a4a2a); P.vl(14, 14, 20, 0x4a3018);
      for (const [lx, ly, rx, ry] of [[14, 8, 8, 6], [8, 15, 6, 5], [20, 14, 6, 5], [11, 22, 7, 5], [18, 24, 6, 4], [14, 2, 5, 3]]) leaves(P, lx, ly, rx, ry, lx * 7 + ly, 0x1e5a2a, 0x3a8a3a, 0x6ab85a);
    } else {
      for (let k2 = 0; k2 < 7; k2++) {
        const a = -Math.PI / 2 + (k2 - 3) * 0.42, len = 14 + (k2 % 2) * 5;
        for (let s = 0; s < len; s++) {
          const px = 14 + Math.cos(a) * s, py = 32 + Math.sin(a) * s + (s * s) / 60;
          P.px(px, py, 0x2e6a2a);
          if (s > 4) { P.px(px + 1, py + 1, s % 3 ? 0x4f9a3a : 0x7fc85a); P.px(px - 1, py + 1, 0x3a7a30); }
        }
      }
    }
    area(P, 7, 34, 14, 10, (X, Y, i, j) => (j === 0 ? 0xffffff : j === 1 ? 0xd8dcd8 : i === 0 ? 0xf0f2f0 : i === 13 ? 0xa8aca8 : 0xe0e4e0));
  });
}
function binsSprite(x, y) {
  return sprite(x - 9, y - 15, 18, 16, (P) => {
    [0x3a8a4a, 0xe0b020, 0x3a6ab0].forEach((c, k) => {
      const bx = k * 6;
      area(P, bx, 2, 5, 13, (X, Y, i, j) => (j < 2 ? mix(c, WHITE, 0.3) : i === 0 ? mix(c, WHITE, 0.15) : i === 4 ? mul(c, 0.7) : c));
      P.hl(bx + 1, 1, 3, mul(c, 0.6)); P.px(bx + 2, 7, 0xffffff);
    });
  });
}
function trolleyRackSprite() {
  return sprite(300, 88, 50, 22, (P) => {
    for (let k = 0; k < 7; k++) {
      const x = 2 + k * 6;
      P.line(x, 2, x + 4, 14, 0x9aa0a8); P.hl(x - 2, 2, 6, 0xd8303a); P.hl(x - 2, 1, 6, 0xf07070);
      P.hl(x + 3, 14, 10, 0xc8ccd4); P.hl(x + 3, 15, 10, 0x7a8088);
      P.px(x + 4, 17, 0x16161a); P.px(x + 12, 17, 0x16161a); P.px(x + 4, 18, 0x3a3e46); P.px(x + 12, 18, 0x3a3e46);
    }
  });
}
function infoSprite() {
  return sprite(444, 90, 14, 36, (P) => {
    area(P, 2, 6, 10, 28, (X, Y, i, j) => (i === 0 ? 0xffffff : i === 9 ? 0xa8aeb6 : 0xe8ecf0));
    P.rect(3, 12, 8, 10, 0x10141c); P.rect(4, 13, 6, 8, 0x2a6ad0); P.hl(5, 15, 4, 0x9ad0ff); P.hl(5, 17, 3, 0x9ad0ff);
    knob(P, 7, 3, 3, 0x2a6ad0); P.px(7, 2, 0xffffff); P.vl(7, 3, 2, 0xffffff);
    P.rect(1, 34, 12, 2, 0x5a6068);
  });
}
function chargeSprite(x, y) {
  return sprite(x - 5, y - 28, 11, 29, (P) => {
    area(P, 1, 0, 9, 27, (X, Y, i, j) => (j === 0 ? 0x5a5e66 : i === 0 ? 0x4a4e56 : i === 8 ? 0x1e2026 : 0x2e3038));
    for (let k = 0; k < 4; k++) { P.rect(3, 4 + k * 5, 5, 3, 0x0a0a0e); P.px(7, 5 + k * 5, 0x5aff8a); }
    icon(P, 3, 22, ['.#.', '##.', '.##', '.#.'], 0xffd23a);
    P.rect(0, 27, 11, 2, 0x5a6068);
  });
}
function liquidSignSprite(x, y) {
  return sprite(x - 9, y - 22, 19, 23, (P) => {
    P.line(2, 22, 5, 12, 0x6a7078); P.line(16, 22, 13, 12, 0x6a7078);
    area(P, 0, 0, 19, 13, (X, Y, i, j) => (i === 0 || j === 0 || i === 18 || j === 12 ? 0x2a2c32 : 0xffd23a));
    text(P, SMALL, 'MAX', 3, 1, 0x16161a); text(P, SMALL, '1 DL', 2, 7, 0x16161a);
  });
}
function lostTrolleySprite(x, y) {
  return sprite(x - 12, y - 20, 26, 21, (P) => {
    P.line(20, 3, 17, 15, 0x9aa0a8); P.hl(18, 2, 6, 0xd8303a);
    P.hl(2, 15, 18, 0xc8ccd4); P.hl(2, 16, 18, 0x7a8088);
    area(P, 3, 6, 11, 9, (X, Y, i, j) => (j === 0 ? 0x8e5bd1 + 0 : i === 0 ? 0x9a6ad8 : i === 10 ? 0x5a3a90 : 0x7a4ab8));
    area(P, 5, 1, 8, 5, (X, Y, i, j) => (j === 0 ? 0xd8a060 : 0xb07838));
    P.px(4, 18, 0x16161a); P.px(18, 18, 0x16161a);
  });
}
function guardDeskSprite() {
  return sprite(GUARD1.x - 10, 104, 20, 14, (P) => {
    area(P, 0, 6, 20, 7, (X, Y, i, j) => (j === 0 ? 0xe8ecf0 : j === 6 ? 0x3a3e46 : 0xb8bec6));
    area(P, 5, 0, 10, 6, (X, Y, i, j) => (i === 0 || j === 0 || i === 9 || j === 5 ? 0x2a2c32 : 0x0a0c12));
  });
}

// städvagnen och VÅTT GOLV-skylten
function janitorCart() {
  const P = new Pix(16, 16);
  area(P, 1, 9, 14, 4, (X, Y, i, j) => (j === 0 ? 0xc8ccd2 : 0x8a9098));
  area(P, 2, 4, 6, 6, (X, Y, i, j) => (j === 0 ? 0xffe070 : i === 0 ? 0xf0c020 : i === 5 ? 0xb08a10 : 0xe0b020));
  P.hl(3, 5, 4, 0x6ab4d0);
  area(P, 9, 3, 5, 7, (X, Y, i, j) => (j === 0 ? 0x5a8ad0 : 0x3a6ab0));
  P.vl(14, 0, 10, 0x9aa0a8); P.hl(12, 0, 3, 0x3a3e46);
  P.vl(6, 0, 5, 0xc8a070); P.px(5, 0, 0xc8a070);
  P.px(2, 13, 0x16161a); P.px(3, 14, 0x3a3e46); P.px(12, 13, 0x16161a); P.px(13, 14, 0x3a3e46);
  outline(P);
  return P.flush();
}
function wetSign() {
  const P = new Pix(14, 17);
  P.line(1, 16, 4, 1, 0xe0b020); P.line(12, 16, 9, 1, 0xe0b020);
  area(P, 3, 1, 8, 12, (X, Y, i, j) => (i === 0 ? 0xffe070 : i === 7 ? 0xb08a10 : 0xf0c020));
  icon(P, 4, 3, ['..#..', '.##..', '#.##.', '..#.#', '.#.#.', '#...#'], 0x16161a);
  P.hl(4, 10, 6, 0x16161a);
  outline(P);
  return P.flush();
}

// ---------- väskor ----------
const BAG_COLORS = [0x6a5030, 0x4a4a52, 0x2aa39a, 0x8e5bd1, 0x9a3a4a, 0x3a5a7c, 0xd8583a, 0x2a2c34, 0xe0b030, 0x5aa05a];
const BAGS = new Map();
// liggande väska på karusellen (ovansida + framkant), med tagg
function lyingBag(ci, style = 0) {
  const key = 'l' + ci + style;
  let c = BAGS.get(key);
  if (c) return c;
  const col = BAG_COLORS[ci % BAG_COLORS.length], P = new Pix(15, 9);
  const w = style === 2 ? 11 : 13, x0 = style === 2 ? 2 : 1;
  area(P, x0, 1, w, 4, (X, Y, i, j) => (j === 0 ? mix(col, WHITE, 0.3) : i === 0 ? mix(col, WHITE, 0.15) : jit(col, X, Y, 97, 0.06)));
  area(P, x0, 5, w, 3, (X, Y, i, j) => (j === 2 ? mul(col, 0.55) : mul(col, 0.75)));
  if (style === 0) { P.hl(x0 + 4, 0, w - 8, 0x2a2c30); P.vl(x0 + 3, 1, 4, mul(col, 0.8)); P.vl(x0 + w - 4, 1, 4, mul(col, 0.8)); }
  else if (style === 1) { P.hl(x0 + 1, 3, w - 2, mul(col, 0.8)); P.hl(x0 + 4, 0, 5, 0x2a2c30); }
  else { for (let x = x0 + 2; x < x0 + w - 2; x += 2) P.px(x, 2, 0xd8dce2); }
  P.rect(x0 + w - 3, 5, 3, 2, 0xffe070);
  outline(P, 0x1a1418);
  c = P.flush();
  BAGS.set(key, c);
  return c;
}
// stående resväska (rullväska) med utdraget handtag
function upCase(ci, handle = true) {
  const key = 'u' + ci + handle;
  let c = BAGS.get(key);
  if (c) return c;
  const col = BAG_COLORS[ci % BAG_COLORS.length], P = new Pix(10, 16);
  area(P, 1, 5, 8, 9, (X, Y, i, j) => {
    if ((i === 0 || i === 7) && (j === 0 || j === 8)) return null;
    if (i === 0) return mix(col, WHITE, 0.25);
    if (i === 7) return mul(col, 0.65);
    if (j === 0) return mix(col, WHITE, 0.35);
    return (i === 3 || i === 4) ? mul(col, 0.85) : jit(col, X, Y, 98, 0.06);
  });
  if (handle) { P.vl(3, 1, 4, 0x6a7078); P.vl(6, 1, 4, 0x6a7078); P.hl(3, 0, 4, 0x2a2c30); }
  else P.hl(3, 4, 4, 0x2a2c30);
  P.px(2, 14, 0x16161a); P.px(7, 14, 0x16161a);
  outline(P, 0x1a1418);
  c = P.flush();
  BAGS.set(key, c);
  return c;
}

// ======================= ljud: högtalarens ding-dong och bågens pip =======================
function tones(list) {
  if (isMuted()) return;
  const c = audioContext();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    for (const [f, at, dur, type, vol] of list) {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t0 + at);
      gn.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.015);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(gn); gn.connect(c.destination);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    }
  } catch { /* ljud är aldrig ett krav */ }
}
const chime = () => tones([[659.3, 0, 1.1, 'sine', 0.08], [523.3, 0.45, 1.3, 'sine', 0.08]]);
const beepOk = () => tones([[1760, 0, 0.12, 'sine', 0.05]]);
const beepBad = () => tones([[440, 0, 0.14, 'square', 0.04], [440, 0.2, 0.14, 'square', 0.04], [440, 0.4, 0.2, 'square', 0.04]]);

// ======================= personalen och repliker =======================
const AGENT_LOOKS = [
  { skin: '#f6d7bf', hair: '#d9a95c', style: 'bun', top: 'blazer', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'skirt', pants: '#1e2a44', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#ffd23a', build: 5 },
  { skin: '#a06a43', hair: '#1d1714', style: 'short', top: 'blazer', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'pants', pants: '#1e2a44', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#ffd23a', build: 5, glasses: 'square' },
  { skin: '#eec3a0', hair: '#b7392b', style: 'ponytail', top: 'blazer', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'skirt', pants: '#1e2a44', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#ffd23a', build: 4 },
  { skin: '#c68a5c', hair: '#3b2619', style: 'curly', top: 'blazer', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'pants', pants: '#1e2a44', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#ffd23a', build: 6 },
];
const MANAGER_LOOK = { skin: '#eec3a0', hair: '#b9b3ab', style: 'bob', top: 'suit', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'pants', pants: '#1e2a44', shoes: '#1c1c1c', glasses: 'round', build: 5 };
const CHIEF_LOOK = { skin: '#744a2d', hair: '#1d1714', style: 'buzz', top: 'hiVis', shirt: '#f07a1e', accent: '#2d3a5c', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', hat: 'cap', cap: '#2d3a5c', phones: 'headset', build: 6 };
const GUARD_LOOKS = [
  { skin: '#e0a97f', hair: '#3b2619', style: 'side', top: 'police', shirt: '#2a2e3a', accent: '#ffd23a', bottom: 'pants', pants: '#1e2028', shoes: '#1c1c1c', build: 6 },
  { skin: '#f6d7bf', hair: '#ecd489', style: 'ponytail', top: 'police', shirt: '#2a2e3a', accent: '#ffd23a', bottom: 'pants', pants: '#1e2028', shoes: '#1c1c1c', build: 5 },
];
const JANITOR_LOOK = { skin: '#a06a43', hair: '#b9b3ab', style: 'short', top: 'workshirt', shirt: '#3a6ab0', accent: '#ffd23a', bottom: 'pants', pants: '#2a3a5a', shoes: '#1c1c1c', hat: 'cap', cap: '#3a6ab0', beard: 'mustache', build: 6 };
const L_JANITOR = ['Akta, det är vått! 🧹', 'Jag har städat här i trettio år.', 'Nattskiftet är lugnast.', 'Du skulle se hur det ser ut efter ett charterplan ...'];
const BARISTA_LOOK = { skin: '#c68a5c', hair: '#2f8f6f', style: 'mohawk', top: 'tee', shirt: '#2f3440', accent: '#c9a44a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', apron: true, hat: 'beanie', cap: '#6a3a1a', build: 5 };
const GATE_LOOKS = [
  { skin: '#f6d7bf', hair: '#1d1714', style: 'bun', top: 'blazer', shirt: '#c9323a', accent: '#f4f1ea', bottom: 'skirt', pants: '#2a2a34', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#f4f1ea', build: 5 },
  { skin: '#a06a43', hair: '#3b2619', style: 'short', top: 'blazer', shirt: '#c9323a', accent: '#f4f1ea', bottom: 'pants', pants: '#2a2a34', shoes: '#1c1c1c', build: 6 },
];
const CREW_LOOKS = [
  { skin: '#eec3a0', hair: '#6b4226', style: 'short', top: 'pilot', shirt: '#f4f1ea', accent: '#1e2a44', bottom: 'pants', pants: '#1e2a44', shoes: '#1c1c1c', build: 6 },
  { skin: '#f6d7bf', hair: '#d9a95c', style: 'bun', top: 'blazer', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'skirt', pants: '#1e2a44', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#ffd23a', build: 5 },
  { skin: '#744a2d', hair: '#1d1714', style: 'bun', top: 'blazer', shirt: '#1e3a6e', accent: '#ffd23a', bottom: 'skirt', pants: '#1e2a44', shoes: '#1c1c1c', neck: 'scarf', neckColor: '#ffd23a', build: 5 },
];
const L_SEAT = ['Mitt flyg är försenat IGEN.', 'Ska till Mallorca! ☀️', 'Jag har suttit här sedan i morse ...', 'Har du sett min boardingkort?', 'Flygplatskaffe kostar skjortan.', 'Kolla, där tankar de planet!', 'Jag åker och hälsar på mormor.', 'Tror du vi hinner handla tax free?', 'Jag hatar att flyga. Men jag älskar att landa.', 'Gate A2, var är den?'];
const L_NIGHT = ['Nattflyg är billigast.', 'Jag missade sista bussen ...', 'Zzz ... va? Boardar vi?', 'Det är så tyst här på natten.'];
const L_SLEEP = ['Zzz ... 😴', 'Mmm ... fem minuter till ...', 'Zzz ... inte nu ...'];
const L_KID = ['Titta, ett flygplan! ✈️', 'Jag vill sitta vid fönstret!', 'Är vi framme snart?', 'Pappa! Planet blinkar!', 'Tagen! Du är den!'];
const L_WAIT = ['Min väska kommer ALLTID sist.', 'Blå väska, blå väska ...', 'Är det min? Nej ...', 'Hoppas den inte hamnade i Oslo.', 'Nu kommer de! 🧳'];
const L_WALK = ['Ursäkta, vart går gate A1?', 'Vi kommer att missa planet!', 'Hinner jag köpa en bulle?', 'Hej hej!'];
const L_AGENT = ['Nästa, tack!', 'Fönster eller gång?', 'Väskan väger 22,9 kilo - precis under gränsen!', 'Har du packat väskan själv?', 'Trevlig resa!'];
const L_GUARD = ['Vätskor i påsen, tack!', 'Töm fickorna i lådan.', 'Ta av dig bältet, tack.', 'Datorn i en egen låda.'];
const L_BARISTA = ['Flygplatskaffe - 49 kr. Ja, jag vet.', 'Kanelbullen är från i morse. Tror jag.', 'Vi har öppet dygnet runt! ☕', 'Nattskiftet är mitt favoritskift.'];
const L_GATE = ['Boarding börjar snart vid gaten!', 'Ha boardingkortet redo, tack.', 'Barnfamiljer får gå ombord först.'];
const L_WINDOW = ['Jag älskar att titta på planen.', 'Där landar ett till!', 'Kolla signalgubben med stavarna!', 'Tankbilen är här!'];

// ======================= scenen =======================
export function makeShopTerminal(A, opts = {}) {
  const g = A.game;
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9;
  const rng = rngOf(((g.day | 0) * 7919 + 101) >>> 0);
  const R = () => Math.random();
  const hourNow = () => (((g.min / 60) % 24) + 24) % 24;
  const nightNow = () => { const h = hourNow(); return h >= 22 || h < 5.5; };

  // ---------- flygen ----------
  let FL = null, FLday = -1;
  function upcoming(n, gate = null) {
    const day = g.day | 0;
    if (FLday !== day) { FL = [...flightsOf(day), ...flightsOf(day + 1).map((f) => ({ ...f, m: f.m + 1440, key: f.key + 500 }))]; FLday = day; }
    const out = [];
    for (const f of FL) if (f.m + f.late >= g.min - 3 && (!gate || f.gate === gate)) { out.push(f); if (out.length >= n) break; }
    return out;
  }

  // ---------- bilder ----------
  const cache = {};
  const farImg = (m) => (cache['far' + m] ||= paintFar(m));
  const nearImg = (m) => (cache['near' + m] ||= paintNear(m));
  const glassImg = (m) => (cache['glass' + m] ||= paintGlass(m));
  const hall = paintHall();
  const hallLight = paintHallLight(hall.signs);
  const S = {
    desks: DESKS.map(deskSprite), scales: DESKS.map(scaleSprite), belt: beltSprite(), hatch: hatchSprite(), lane: laneSprite(),
    xray: xraySprite(), xbelt: xrayBeltSprite(), trays: trayStackSprite(), arch: archSprite(), gFront: glassFront(),
    gLeft: glassEdge(SEC.x0, WALL_Y, SEC.y), gRight: [[140, 160], [160, 180], [180, 200], [200, 216]].map(([a, b]) => ({ ...glassEdge(SEC.x1, a, b), fy: b })),
    carBase: carBaseSprite(), island: carIslandSprite(), chute: chuteSprite(),
    podiums: GATES.map(podiumSprite), kiosk: kioskSprite(), tables: [highTableSprite(1296, 162), highTableSprite(1350, 162)],
    plants: PLANTS.map((p) => ({ ...plantSprite(p.x, p.y, p.k), fy: p.y })), bins: BINS.map((b) => ({ ...binsSprite(b.x, b.y), fy: b.y })),
    rack: trolleyRackSprite(), info: infoSprite(), charge: chargeSprite(1214, 206), liquid: liquidSignSprite(784, 196), lost: lostTrolleySprite(60, 186),
    guardDesk: guardDeskSprite(),
  };
  S.rack.x = 40; // bagagevagnarna står vid ankomsten
  const glowSm = glowImg(3, 3, 0xffffff, 0.8, 3), glowLand = glowImg(8, 4, 0xfff6d8, 0.5, 4);
  const glowRed = glowImg(3, 3, 0xff3a2a, 0.6, 3), glowGreen = glowImg(3, 3, 0x5aff8a, 0.5, 3);
  // karusellens lameller: sex förmålade lägen (bandet rör sig en lamell per varv av lägena)
  const RING = [];
  const carRing = (k) => (RING[k] ||= (() => {
    const c = mkCanvas(S.carBase.img.width, S.carBase.img.height), x = c.getContext('2d');
    x.drawImage(S.carBase.img, 0, 0);
    x.fillStyle = '#26282e';
    const ox = S.carBase.x, oy = S.carBase.y;
    for (let i = 0; i < 64; i++) {
      const a = ((i - k / 6) / 64) * Math.PI * 2, co = Math.cos(a), si = Math.sin(a);
      if (si < -0.3) continue;
      pline(x, CAR.cx + co * (CS.irx + 1) - ox, CS.cy + si * (CS.iry + 1) - oy, CAR.cx + co * (CS.orx - 2) - ox, CS.cy + si * (CS.ory - 1) - oy);
    }
    return c;
  })());

  // ---------- väntstolarna ----------
  const BENCHES = [
    { id: 'v', x: 1030, y: 120, n: 8, dir: 'up' },
    { id: 'a', x: 940, y: 166, n: 8, dir: 'up' }, { id: 'b', x: 940, y: 196, n: 8, dir: 'down' },
    { id: 'c', x: 1070, y: 166, n: 8, dir: 'up' }, { id: 'd', x: 1070, y: 196, n: 8, dir: 'down' },
    { id: 'e', x: 72, y: 208, n: 5, dir: 'up' }, { id: 'f', x: 560, y: 200, n: 6, dir: 'down' },
    { id: 'g', x: 1300, y: 206, n: 6, dir: 'down' },
  ];
  const seats = [];
  for (const B of BENCHES) {
    B.img = benchSprites(B);
    for (let i = 0; i < B.n; i++) seats.push({ id: B.id + i, x: B.x + i * 13, y: B.y, dir: B.dir, bench: B, occ: null, air: B.x > 900 });
  }
  const seatById = (id) => seats.find((s) => s.id === id);

  // ---------- hinder och gång ----------
  const obstacles = [
    ...COLS.map((c) => [c - 6, 96, c + 6, 102]),
    [60, 128, 240, 166], [74, 124, 226, 130], [138, 96, 162, 128], [124, 96, 176, 100],
    [40, 100, 92, 110], [444, 116, 458, 127],
    [470, 96, 792, 125], [486, 146, 792, 150], [784, 124, 796, 150],
    [SEC.x0 - 2, 96, SEC.x0 + 2, SEC.y + 1], [XRAY.x0, 118, XRAY.x1, SEC.y + 1], [XRAY.x0 + 4, SEC.y, XRAY.x1 - 4, 166], [808, 160, 822, 172],
    [XRAY.x1, SEC.y - 2, ARCH.p0 + 4, SEC.y + 1], [ARCH.p1, SEC.y - 2, SEC.x1 + 1, SEC.y + 1], [SEC.x1 - 2, SEC.y - 2, SEC.x1 + 2, H],
    [GUARD1.x - 10, 110, GUARD1.x + 10, 118],
    ...GATES.map((gt) => [gt.x - 40, 108, gt.x - 16, 119]),
    [KIOSK.x0 - 1, 96, KIOSK.x1 + 1, KIOSK.y + 1], [1290, 156, 1302, 163], [1344, 156, 1356, 163],
    ...PLANTS.map((p) => [p.x - 7, p.y - 6, p.x + 7, p.y + 1]), ...BINS.map((b) => [b.x - 9, b.y - 5, b.x + 9, b.y + 1]),
    [1209, 198, 1219, 207], [775, 190, 793, 197], [48, 180, 72, 187],
    ...BENCHES.map((B) => [B.x - 7, B.y - 8, B.x + (B.n - 1) * 13 + 7, B.y + 1]),
  ];
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 4, bottom: H - 4, spawn: [DOOR_SPOT[0], DOOR_SPOT[1] + 4] });
  walker.setObstacles(obstacles);
  walker.snapFree();
  for (const s of seats) {
    const c = s.dir === 'down' ? [[s.x, s.y + 9], [s.x, s.y + 13]] : [[s.x, s.y - 12], [s.x, s.y - 15]];
    [s.ax, s.ay] = c.find(([x, y]) => walker.walkable(x, y)) || walker.nearestFree(...c[0]);
  }
  const me = { state: 'free', seat: null, res: null, slide: null, rise: null };
  const meAt = () => (me.seat ? { x: me.seat.x, y: me.seat.y - 40 } : { x: walker.px, y: walker.py - 44 });
  const camTarget = () => (me.seat ? me.seat.x : walker.px);
  const cams = () => lockedCam ?? clamp(camTarget() - VW / 2, 0, W - VW);
  // Det synliga radbandet: fyll-läget på mobilen (NÄRA) beskär upptill och nertill
  // (main.js v.safe). Då följer en lodrät kamera figuren – fönstren, planen och tavlan
  // syns så länge figuren står högt, golvet längst ner först när man går dit.
  const band = () => {
    const s = A.view?.safe;
    const y0 = clamp(Math.round(s?.y0 ?? 0), 0, H - 96);
    const y1 = clamp(Math.round(s?.y1 ?? H), y0 + 96, H);
    return { y0, y1, v: y1 - y0 };
  };
  const camYs = () => {
    const b = band();
    if (b.v >= H) return 0;
    const fy = me.seat ? me.seat.y : walker.py;
    return clamp(Math.round(fy + 10 - b.v), 0, H - b.v);
  };
  syncView(A);
  const cam = { x: cams(), y: camYs() };
  let ty = 0; // radförskjutningen i senaste ritningen (skärm-y = värld-y + ty)
  const snapCam = () => { cam.x = cams(); cam.y = camYs(); ty = band().y0 - Math.round(cam.y); };

  // ---------- folket ----------
  const npcs = [];
  let nid = 0;
  const lookOf = (kidOk = true) => { const L = makeLook(R); if (!kidOk && L.kid) { L.kid = false; L.build = 5; } return L; };
  function mkNpc(o) { const n = { id: ++nid, x: 0, y: 0, dir: 'down', path: [], onArrive: null, speed: 30 + R() * 8, state: 'idle', t: 0, bag: null, seat: null, act: null, ...o }; npcs.push(n); return n; }
  function goNpc(n, x, y, cb) {
    n.path = walker.findPath(n.x, n.y, x, y);
    // ingen väg (borde inte hända): gå raka vägen i stället – aldrig en direkt återkoppling
    // (barnens springslinga skulle annars kunna anropa sig själv i all oändlighet)
    if (!n.path.length) n.path = [[x + 0.01, y]];
    n.onArrive = cb || null;
  }
  function stepNpc(n, dt) {
    if (!n.path.length) return false;
    const [gx, gy] = n.path[0];
    const dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy), st = n.speed * dt;
    n.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    const py = n.y;
    if (d <= st) { n.x = gx; n.y = gy; n.path.shift(); if (!n.path.length) { const c = n.onArrive; n.onArrive = null; c?.(); } }
    else { n.x += dx / d * st; n.y += dy / d * st; }
    archCheck(n.x, py, n.y, false);
    return true;
  }
  const freeSeats = (air) => seats.filter((s) => !s.occ && (air === undefined || s.air === air));
  const ACTS_DOWN = ['read', 'phone', 'phone', 'laptop', 'sleep', 'coffee', 'book', 'eat', 'phone'];
  function sitNpc(n, s, slide = true) {
    s.occ = n; n.seat = s; n.state = 'sit'; n.path = [];
    n.act = s.dir === 'down' ? (nightNow() && R() < 0.45 ? 'sleep' : ACTS_DOWN[Math.floor(R() * ACTS_DOWN.length)]) : (R() < 0.25 && nightNow() ? 'sleep' : 'watch');
    if (n.cup && s.dir === 'down') n.act = 'coffee';
    n.sitT = 0; n.stay = 60 + R() * 110; n.eatT = R() * 3; n.eating = 0;
    n.slide = slide ? { fx: n.x, fy: n.y, k: 0 } : null;
    n.x = s.x; n.y = s.y;
  }
  // resa sig: figuren glider från stolen fram till gångplatsen (samma glidning som när den satte sig)
  function standNpc(n) { const s = n.seat; if (!s) return; s.occ = null; n.seat = null; n.x = s.ax; n.y = s.ay; n.slide = null; n.rise = { ox: s.x - s.ax, oy: s.y - s.ay, k: 0 }; }
  // gå ombord: till gatedörren och försvinn in i bryggan
  function board(n) {
    const gt = GATES[n.gate ?? (R() < 0.5 ? 0 : 1)];
    n.state = 'board';
    goNpc(n, gt.x, WALL_Y + 6, () => { n.gone = true; });
  }
  function afterSecurity(n) {
    n.state = 'air';
    if (n.crew) { board(n); return; }
    const r = R();
    if (r < 0.52) { const fs = freeSeats(true); if (fs.length) { const s = fs[Math.floor(R() * fs.length)]; s.occ = n; n.state = 'toSeat'; goNpc(n, s.ax, s.ay, () => { if (s.occ === n) sitNpc(n, s); else afterSecurity(n); }); return; } }
    if (r < 0.7) { n.state = 'look'; const wx = LOOK_SPOTS[Math.floor(R() * LOOK_SPOTS.length)]; goNpc(n, wx, WALL_Y + 8, () => { n.state = 'looking'; n.dir = 'up'; n.t = 7 + R() * 9; }); return; }
    if (r < 0.84) { n.state = 'kiosk'; goNpc(n, 1290 + Math.floor(R() * 5) * 14, KIOSK.y + 10, () => { n.state = 'buying'; n.dir = 'up'; n.t = 4 + R() * 3; }); return; }
    if (r < 0.92) { n.state = 'wc'; goNpc(n, (WC_DOOR.x0 + WC_DOOR.x1) / 2, WALL_Y + 6, () => { n.state = 'inwc'; n.hidden = true; n.t = 5 + R() * 5; }); return; }
    board(n);
  }
  // ---- incheckningskön ----
  const queue = [];
  const deskState = DESKS.map((D) => ({ D, pax: null, t: 0, weight: 0, wT: -9, open: true }));
  const spot = (i) => [776 - i * 13, LANE.y];
  function joinQueue(n) {
    n.state = 'toQueue';
    queue.push(n);
    const i = queue.indexOf(n), [qx, qy] = spot(i);
    goNpc(n, 482, LANE.y + 2, () => goNpc(n, qx, qy, () => { n.state = 'queue'; n.dir = 'right'; reQueue(); }));
  }
  function reQueue() {
    queue.forEach((n, i) => {
      if (n.state !== 'queue') return;
      const [qx, qy] = spot(i);
      if (Math.abs(n.x - qx) > 1) { n.state = 'shuffle'; goNpc(n, qx, qy, () => { n.state = 'queue'; n.dir = 'right'; }); }
    });
  }
  const beltBags = [];  // på väg upp från vågen / på uppsamlingsbandet
  function updateDesks(dt) {
    const night = nightNow();
    deskState.forEach((ds, k) => {
      ds.open = !night || k < 2;
      if (!ds.open) return;
      if (!ds.pax && queue.length && queue[0].state === 'queue') {
        const n = queue.shift();
        ds.pax = n; n.state = 'toDesk';
        goNpc(n, ds.D.x0 + 22, DESK_Y + 6, () => { n.state = 'atDesk'; n.dir = 'up'; ds.t = 0; ds.dur = 8 + R() * 5; });
        ambient(R() < 0.5 ? 'Nästa, tack!' : 'Välkommen fram!', { x: agents[k].x, y: agents[k].y - 40 }, agents[k].x);
        reQueue();
      }
      const n = ds.pax;
      if (!n || n.state !== 'atDesk') return;
      ds.t += dt;
      if (ds.t > 1.3 && n.bag && !n.bagDone) {
        n.bagDone = true;
        ds.weight = 14 + Math.floor(R() * 10); ds.wT = t;
        beltBags.push({ x: ds.D.sx0 + 9, y: DESK_Y - 2, ci: n.bag.ci, ph: 'scale', at: t, k });
        n.bag = null;
      }
      if (ds.t > (ds.dur || 7)) {
        ds.pax = null;
        n.state = 'toSec';
        goNpc(n, ARCH.x + 4, SEC.y + 32, () => goNpc(n, ARCH.x + 2, SEC.y - 16, () => afterSecurity(n)));
      }
    });
    for (let i = beltBags.length - 1; i >= 0; i--) {
      const b = beltBags[i];
      if (b.ph === 'scale' && t - b.at > 1.4) { b.ph = 'up'; b.at = t; }
      else if (b.ph === 'up') { b.y = lerp(DESK_Y - 2, 94, Math.min(1, (t - b.at) / 1.1)); if (t - b.at >= 1.1) { b.ph = 'belt'; b.y = 94; } }
      else if (b.ph === 'belt') { b.x -= 24 * dt; if (b.x < HATCH.x1 - 4) beltBags.splice(i, 1); }
    }
  }
  // ---- karusellen ----
  const carBags = [];  // { s (0..1 runt), ci, st, ph: 'chute'|'belt', p }
  let carPhase = 0, carSpawnT = 0;
  const bagPos = (s) => { const a = s * Math.PI * 2; return [CAR.cx + CS.mrx * Math.cos(a), CS.cy + CS.mry * Math.sin(a), Math.sin(a)]; };
  for (let k = 0; k < 9; k++) carBags.push({ s: (k / 9 + rng() * 0.03) % 1, ci: Math.floor(rng() * 10), st: Math.floor(rng() * 3), ph: 'belt', p: 1 });
  function updateCarousel(dt) {
    carPhase = (carPhase + dt * 0.02) % 1;
    for (const b of carBags) {
      if (b.ph === 'chute') { b.p += dt * (0.35 + b.p * 1.2); if (b.p >= 1) { b.ph = 'belt'; b.s = 0.75; } }
      else b.s = (b.s - dt * 0.02 + 1) % 1;
    }
    carSpawnT -= dt;
    const cap = nightNow() ? 7 : 13;
    if (carSpawnT <= 0 && carBags.length < cap && !carBags.some((b) => b.ph === 'chute' || (b.ph === 'belt' && Math.abs(((b.s - 0.75 + 1.5) % 1) - 0.5) < 0.035))) {
      carBags.push({ s: 0.75, ci: Math.floor(R() * 10), st: Math.floor(R() * 3), ph: 'chute', p: 0 });
      carSpawnT = 2.5 + R() * 3;
    }
  }
  const WAIT_SPOTS = [[76, 176], [98, 178], [122, 176], [146, 178], [170, 176], [194, 178], [218, 176], [46, 150], [252, 156], [240, 172]];
  const waitTaken = new Set();
  function arrive() {
    const free = WAIT_SPOTS.map((p, i) => i).filter((i) => !waitTaken.has(i));
    if (!free.length) return;
    const i = free[Math.floor(R() * free.length)], [wx, wy] = WAIT_SPOTS[i];
    waitTaken.add(i);
    const n = mkNpc({ look: lookOf(), x: 18, y: WALL_Y + 6, role: 'arr', spot: i, state: 'toWait' });
    goNpc(n, wx, wy, () => { n.state = 'waitBag'; n.t = 8 + R() * 18; n.dir = wy > 170 ? 'up' : wx < 100 ? 'right' : 'left'; });
  }
  function updateArrival(n, dt) {
    if (n.state !== 'waitBag') return;
    n.t -= dt;
    if (n.t > 0) return;
    // ta en väska som passerar framför en
    let best = null, bd = 26;
    for (const b of carBags) {
      if (b.ph !== 'belt') continue;
      const [bx, by, sn] = bagPos(b.s);
      if (sn < 0.2) continue;
      const d = Math.hypot(bx - n.x, by - n.y) * 0.6 + Math.abs(bx - n.x) * 0.4;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) { n.t = 0.4; return; }
    carBags.splice(carBags.indexOf(best), 1);
    n.bag = { ci: best.ci }; waitTaken.delete(n.spot);
    if (R() < 0.4) ambient(R() < 0.5 ? 'Där är den! 🧳' : 'Äntligen!', () => ({ x: n.x, y: n.y - 44 }), n.x);
    n.state = 'leave';
    goNpc(n, DOOR_SPOT[0] + (R() - 0.5) * 20, WALL_Y + 6, () => { n.gone = true; });
  }
  // ---- barnen som springer runt stolsraderna ----
  const LOOP = [[928, 182], [1180, 182], [1184, 150], [928, 148]];
  function kidRun(n) { n.leg = (n.leg + 1) % LOOP.length; const [x, y] = LOOP[n.leg]; goNpc(n, x, y + (n.id % 2) * 3, () => kidRun(n)); }
  // ---- säkerhetsbågen ----
  let archFlash = -9, archRed = false;
  const trays = [];
  let trayT = 1, xrayShow = -9;
  function archCheck(x, y0, y1, mine) {
    if (x < ARCH.p0 + 4 || x > ARCH.p1 || (y0 - SEC.y) * (y1 - SEC.y) > 0 || y0 === y1) return;
    archFlash = t;
    archRed = mine ? R() < 0.15 : R() < 0.06;
    if (!mine && archRed) ambient('Pip! Har du något i fickorna?', { x: GUARD2.x, y: GUARD2.y - 44 }, GUARD2.x, true);
    if (mine) {
      if (archRed) { beepBad(); say('PIP! Stick ut armarna, tack.', { x: GUARD2.x, y: GUARD2.y - 44 }, 3, { voice: GUARD_LOOKS[1] }); }
      else beepOk();
    }
    if (y1 < y0 && R() < 0.8) trays.push({ y: 162, c: BAG_COLORS[Math.floor(R() * BAG_COLORS.length)], k: Math.floor(R() * 3) });
  }
  // ---- fasta figurer ----
  const agents = DESKS.map((D, k) => ({ look: AGENT_LOOKS[k], x: D.x0 + 26, y: AGENT_Y, dir: 'down', role: 'agent' }));
  const staff = [
    { look: MANAGER_LOOK, x: MANAGER.x, y: MANAGER.y, dir: 'down', role: 'manager' },
    { look: CHIEF_LOOK, x: CHIEF.x, y: CHIEF.y, dir: 'left', role: 'chief' },
    { look: GUARD_LOOKS[0], x: GUARD1.x, y: GUARD1.y, dir: 'down', role: 'guard' },
    { look: GUARD_LOOKS[1], x: GUARD2.x, y: GUARD2.y, dir: 'left', role: 'guard' },
    { look: GATE_LOOKS[0], x: GATES[0].x - 28, y: 108, dir: 'down', role: 'gate' },
    { look: GATE_LOOKS[1], x: GATES[1].x - 28, y: 108, dir: 'down', role: 'gate' },
  ];
  const barista = { look: BARISTA_LOOK, x: 1320, y: 114, tx: 1320, dir: 'down', role: 'barista', walking: false, idle: 3 };
  const cartImg = janitorCart(), wetImg = wetSign();
  // ---- start: folk på plats direkt ----
  const dens = nightNow() ? 0.32 : 0.62;
  for (const s of seats) {
    if (rng() > dens || s.id === 'b2' || s.id === 'd5') continue;
    const n = mkNpc({ look: lookOf(), role: s.air ? 'air' : 'land', gate: rng() < 0.5 ? 0 : 1 });
    sitNpc(n, s, false);
    n.sitT = rng() * 40; n.stay = 40 + rng() * 160;
  }
  for (let i = 0; i < (nightNow() ? 3 : 6); i++) {
    const n = mkNpc({ look: lookOf(), role: 'ci', bag: { ci: Math.floor(rng() * 10) } });
    const [qx, qy] = spot(i);
    n.x = qx; n.y = qy; n.state = 'queue'; n.dir = 'right'; queue.push(n);
  }
  for (let i = 0; i < (nightNow() ? 3 : 6); i++) {
    const free = WAIT_SPOTS.map((p, k) => k).filter((k) => !waitTaken.has(k));
    const k = free[Math.floor(rng() * free.length)], [wx, wy] = WAIT_SPOTS[k];
    waitTaken.add(k);
    const n = mkNpc({ look: lookOf(), role: 'arr', spot: k, x: wx, y: wy, state: 'waitBag', t: 3 + rng() * 20 });
    n.dir = wy > 170 ? 'up' : wx < 100 ? 'right' : 'left';
  }
  for (let i = 0; i < 2; i++) {
    const L = makeLook(R); L.kid = true; L.build = 4;
    const n = mkNpc({ look: L, role: 'kid', x: LOOP[i * 2][0], y: LOOP[i * 2][1], speed: 50 + i * 8, leg: i * 2, state: 'run' });
    kidRun(n);
  }
  // städaren: kör runt med vagnen i avgångshallen och moppar
  const janitor = mkNpc({ look: JANITOR_LOOK, role: 'janitor', x: 1330, y: 176, speed: 16, state: 'jmop', t: 3, wet: { x: 1316, y: 179 } });
  function janitorNext(n) {
    n.state = 'jwalk';
    const [x, y] = [[1290, 176], [1380, 150], [1360, 182], [1220, 212], [1400, 206], [1150, 212], [980, 212]][Math.floor(R() * 7)];
    goNpc(n, x, y, () => { n.state = 'jmop'; n.t = 5 + R() * 6; n.wet = { x: n.x - 14, y: n.y + 3 }; });
  }
  const parent = mkNpc({ look: lookOf(false), role: 'parent' });
  sitNpc(parent, seatById('b2'), false); parent.stay = 1e9; parent.act = 'phone';
  for (let i = 0; i < 3; i++) {
    const n = mkNpc({ look: lookOf(false), role: 'air', x: 940 + i * 130, y: 140 + i * 20, bag: R() < 0.7 ? { ci: Math.floor(R() * 10) } : null, gate: i % 2 });
    afterSecurity(n);
  }
  let ciT = 2, arrT = 4, crewT = 25, olT = 5;
  function spawnPax(dt) {
    const night = nightNow(), full = npcs.length > 72;
    ciT -= dt; arrT -= dt; crewT -= dt; olT -= dt;
    if (ciT <= 0) { ciT = (night ? 12 : 2.6) + R() * (night ? 6 : 2); if (queue.length < 10 && !full) joinQueue(mkNpc({ look: lookOf(), role: 'ci', x: DOOR_SPOT[0] + (R() - 0.5) * 30, y: WALL_Y + 6, bag: { ci: Math.floor(R() * 10) }, gate: R() < 0.5 ? 0 : 1 })); }
    if (arrT <= 0) { arrT = (night ? 14 : 5) + R() * (night ? 6 : 4); if (!full) arrive(); }
    // incheckade på nätet: bara handbagage, rakt till säkerhetskontrollen
    if (olT <= 0) {
      olT = (night ? 18 : 7) + R() * (night ? 8 : 4);
      if (!full) {
        const n = mkNpc({ look: lookOf(), role: 'air', x: DOOR_SPOT[0] + (R() - 0.5) * 30, y: WALL_Y + 6, bag: R() < 0.6 ? { ci: Math.floor(R() * 10) } : null, gate: R() < 0.5 ? 0 : 1, state: 'toSec' });
        goNpc(n, ARCH.x + 4, SEC.y + 32, () => goNpc(n, ARCH.x + 2, SEC.y - 16, () => afterSecurity(n)));
      }
    }
    if (crewT <= 0) {
      crewT = 80 + R() * 60;
      CREW_LOOKS.forEach((L, i) => {
        const n = mkNpc({ look: L, role: 'crew', crew: true, x: DOOR_SPOT[0] - 10 - i * 12, y: WALL_Y + 8, bag: { ci: 7 }, gate: 1, speed: 36 });
        n.state = 'toSec';
        goNpc(n, ARCH.x + 4, SEC.y + 32 + i * 4, () => goNpc(n, ARCH.x + 2, SEC.y - 16, () => afterSecurity(n)));
      });
    }
  }
  function updateNpcs(dt) {
    for (const n of npcs) {
      if (n.gone) continue;
      if (n.slide) { n.slide.k += dt * 4; if (n.slide.k >= 1) n.slide = null; }
      if (n.rise) { n.rise.k += dt * 4; if (n.rise.k >= 1) n.rise = null; }
      if (n.state === 'sit') {
        n.sitT += dt; n.eatT -= dt;
        if (n.eating > 0) n.eating -= dt;
        if ((n.act === 'eat' || n.act === 'coffee') && n.eatT <= 0) { n.eating = 0.6; n.eatT = 3 + R() * 5; }
        if (n.act === 'sleep' && R() < dt * 0.5) zzz(n.x + 4, n.y - 36);
        if (n.sitT > n.stay && n.role !== 'parent') { standNpc(n); board(n); }
        continue;
      }
      if (n.state === 'looking' || n.state === 'buying') {
        n.t -= dt;
        if (n.t <= 0) { if (n.state === 'buying') n.cup = true; afterSecurity(n); }
        continue;
      }
      if (n.state === 'inwc') { n.t -= dt; if (n.t <= 0) { n.hidden = false; n.state = 'air'; board(n); } continue; }
      if (n.state === 'jmop') { n.t -= dt; n.dir = 'down'; if (n.t <= 0) { n.wet = null; janitorNext(n); } continue; }
      if (n.role === 'arr') updateArrival(n, dt);
      stepNpc(n, dt);
    }
    for (let i = npcs.length - 1; i >= 0; i--) if (npcs[i].gone) { const n = npcs[i]; const q = queue.indexOf(n); if (q >= 0) queue.splice(q, 1); npcs.splice(i, 1); }
  }
  // Z-bubblor från de som sover
  const parts = [];
  function zzz(x, y) { if (parts.length < 60) parts.push({ x, y, vx: 2 + R() * 2, vy: -6, age: 0, max: 2.2, kind: 'z' }); }
  function updateParts(dt) {
    for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
  }
  function updateBarista(dt) {
    const B = barista, dx = B.tx - B.x;
    B.walking = Math.abs(dx) > 0.5;
    if (B.walking) { B.x += Math.sign(dx) * Math.min(Math.abs(dx), 30 * dt); B.dir = dx < 0 ? 'left' : 'right'; return; }
    B.idle -= dt;
    if (B.idle <= 0) { B.tx = [1284, 1320, 1350, 1366][Math.floor(R() * 4)]; B.idle = 3 + R() * 5; B.face = B.tx === 1350 ? 'up' : 'down'; }
    else B.dir = B.face || 'down';
  }
  function updateSecurity(dt) {
    trayT -= dt;
    if (trayT <= 0) { trayT = (nightNow() ? 9 : 3.5) + R() * 3; trays.push({ y: 162, c: BAG_COLORS[Math.floor(R() * BAG_COLORS.length)], k: Math.floor(R() * 3) }); }
    for (let i = trays.length - 1; i >= 0; i--) { trays[i].y -= 9 * dt; if (trays[i].y < 131) { trays.splice(i, 1); xrayShow = t; } }
  }

  // ---------- ute: plan, fordon, markpersonal ----------
  let farPlane = null, farNext = 3;
  const smoke = [];
  // Landning eller start åt något håll (vinden vänder ibland). Sättningen läggs i bild.
  function startFar(kind, tau = 0, dir = R() < 0.6 ? -1 : 1, at = null) {
    const vis0 = cam.x * 0.5;
    if (kind === 'land') {
      const td = at ?? (dir < 0 ? clamp(vis0 + VW * 0.4, RWY.x0 + 150, RWY.x1 - 60) : clamp(vis0 + VW * 0.6, RWY.x0 + 60, RWY.x1 - 150));
      farPlane = { kind, t: tau, dir, liv: Math.floor(R() * LIVERY.length), td };
    } else {
      const x0 = at ?? (dir > 0 ? clamp(vis0 + VW * 0.08, RWY.x0 + 20, RWY.x1 - 500) : clamp(vis0 + VW * 0.92, RWY.x0 + 500, RWY.x1 - 20));
      farPlane = { kind, t: tau, dir, liv: Math.floor(R() * LIVERY.length), x0 };
    }
  }
  // läget för bortre planet: { x, y (far-koordinater), pitch, gear, dir, lights }
  function farState(p) {
    const τ = p.t, d = p.dir;
    if (p.kind === 'land') {
      // inflygning snett uppifrån, hjulen fälls ut, flare, sättning, utrullning
      const v0 = 22;
      if (τ < 9) return { x: p.td - d * v0 * (9 - τ), y: 53 - (9 - τ) * 3.4, pitch: τ > 8.2 ? 6 : 2, gear: τ < 1.8 ? 0 : τ < 2.6 ? 0.5 : 1, dir: d, land: true };
      const s = τ - 9, dec = 2.2, vEnd = 11, sStop = (v0 - vEnd) / dec;
      const dist = s < sStop ? v0 * s - dec / 2 * s * s : v0 * sStop - dec / 2 * sStop * sStop + vEnd * (s - sStop);
      return { x: p.td + d * dist, y: 53, pitch: s < 0.5 ? 4 : s < 1 ? 2 : 0, gear: 1, dir: d, land: s < 7 };
    }
    const a = 6;
    if (τ < 9.5) { const x = p.x0 + d * 0.5 * a * τ * τ; return { x, y: 53, pitch: τ > 8 ? (τ - 8) / 1.5 * 10 : 0, gear: 1, dir: d, land: true }; }
    const s = τ - 9.5, v = a * 9.5;
    return { x: p.x0 + d * (0.5 * a * 9.5 * 9.5 + v * s), y: 53 - s * 10, pitch: 10, gear: s < 1.2 ? 1 : s < 1.9 ? 0.5 : 0, dir: d, land: s < 4 };
  }
  function updateFar(dt) {
    if (!farPlane) { farNext -= dt; if (farNext <= 0) startFar(R() < 0.55 ? 'land' : 'dep'); return; }
    const pv = farPlane.t;
    farPlane.t += dt;
    const st = farState(farPlane);
    if (farPlane.kind === 'land' && pv < 9 && farPlane.t >= 9) {
      for (let k = 0; k < 7; k++) smoke.push({ x: st.x - st.dir * (2 + R() * 3), y: 52, vx: -st.dir * (6 + R() * 8), vy: -1 - R() * 2, age: 0, max: 1.2 + R() * 0.8 });
    }
    const vis0 = cam.x * 0.5;
    const out = st.x < vis0 - 70 || st.x > vis0 + VW + 70;
    if ((farPlane.kind === 'land' && (farPlane.t > 45 || (farPlane.t > 9 && out))) || (farPlane.kind === 'dep' && (st.y < 4 || (farPlane.t > 9 && out)))) { farPlane = null; farNext = 5 + R() * 9; }
    for (const s of smoke) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.97; }
    for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].age > smoke[i].max) smoke.splice(i, 1);
  }
  // uppställningsplatsen: planet taxar in efter signalgubben, trappbil och buss, taxar ut igen
  const RS_CYCLE = 84;
  let rsT = 6;
  const rsLiv = [2, 3, 4, 0];
  function rsState() {
    const τ = rsT % RS_CYCLE, cyc = Math.floor(rsT / RS_CYCLE), L = RS.L;
    const st = { liv: rsLiv[cyc % rsLiv.length], plane: null, marsh: null, stairs: null, bus: null, pax: [], beacon: false, taxi: false };
    if (τ >= 0 && τ < 20) {
      const e = τ / 20;
      st.plane = RS.stop + (1500 - RS.stop) * (1 - e) * (1 - e); st.beacon = true; st.taxi = true;
    } else if (τ >= 20 && τ < 62) { st.plane = RS.stop; st.beacon = τ < 23 || τ > 56; }
    else { const s = τ - 62; st.plane = RS.stop - (1.6 * s * s + 4 * s); st.beacon = true; st.taxi = true; }
    if (τ >= 2 && τ < 26) {
      const nx = RS.stop - L * 0.5 - 22;
      st.marsh = { x: nx + (τ > 23 ? (τ - 23) * 10 : 0), f: τ < 18 ? (Math.floor(τ * 2.5) % 2) : 2 };
    }
    const doorX = RS.stop - L * 0.34;
    if (τ >= 23 && τ < 58) {
      const sx = doorX - 10;
      st.stairs = { x: τ < 29 ? lerp(300, sx, clamp((τ - 23) / 6, 0, 1) ** 0.7) : τ > 52 ? sx - (τ - 52) * 34 : sx, dir: τ > 52 ? -1 : 1 };
    }
    if (τ >= 26 && τ < 70) {
      const bx = doorX + 34;
      st.bus = { x: τ < 31 ? lerp(420, bx, clamp((τ - 26) / 5, 0, 1) ** 0.6) : τ > 47 ? bx + (τ - 47) * 40 : bx };
    }
    if (τ >= 31 && τ < 46) {
      for (let k = 0; k < 10; k++) {
        const s = τ - 31 - k * 1.3;
        if (s < 0 || s > 4) continue;
        const u = Math.min(1, s / 2.2);
        const x = s < 2.2 ? lerp(doorX - 1, doorX - 20, u) : lerp(doorX - 20, doorX + 24, (s - 2.2) / 1.8);
        const y = s < 2.2 ? lerp(60, 80, u) : 80 + (s - 2.2) * 2.5;
        st.pax.push({ x, y, v: k, f: Math.floor(s * 6) % 2 + 1 });
      }
    }
    return st;
  }
  // tankbilen till gate A1: kör fram, tankar under vänstra vingen, kör vidare
  const TK_CYCLE = 72;
  let tkT = 10;
  function tankState() {
    const τ = tkT % TK_CYCLE, px = GATES[0].plane - 66;
    if (τ < 14) return { x: lerp(1500, px, 1 - (1 - τ / 14) ** 2), fuel: false };
    if (τ < 36) return { x: px, fuel: τ > 16 && τ < 34, fuelT: τ - 16 };
    return { x: px - (τ - 36) * (τ - 36) * 1.2 - (τ - 36) * 8, fuel: false };
  }
  // trafiken på servicevägen
  const road = [];
  let roadT = 2;
  function updateRoad(dt) {
    roadT -= dt;
    if (roadT <= 0) {
      roadT = 5 + R() * 7;
      const r = R();
      if (r < 0.45) road.push({ kind: 'train', x: -70, dir: 1, y: 87, sp: 28 + R() * 8, v: Math.floor(R() * 3) });
      else if (r < 0.7) road.push({ kind: 'bus', x: 1500, dir: -1, y: 90, sp: 34 });
      else if (r < 0.85) road.push({ kind: 'follow', x: -30, dir: 1, y: 87, sp: 46 });
      else road.push({ kind: 'gpu', x: 1480, dir: -1, y: 90, sp: 20 });
    }
    for (const v of road) v.x += v.dir * v.sp * dt;
    for (let i = road.length - 1; i >= 0; i--) if (road[i].x < -120 || road[i].x > 1560) road.splice(i, 1);
  }
  // ---------- pratbubblorna: i bild och isär ----------
  // Tre bubbelsystem (repliker, högtalaren, småprat) samordnas: bubblan trycks ner så
  // att den syns under en beskuren överkant, en replik tar bort småpratet och ett utrop
  // som den skulle krocka med, och utropen väntar medan någon pratar.
  const posOf = (at) => (typeof at === 'function' ? at() : at);
  const bubW = (s) => Math.min(131, textW(SMALL, s) + 8);
  const bubH = (s) => clamp(Math.ceil((textW(SMALL, s) + 12) / 108), 1, 5) * 7 + (/\p{Extended_Pictographic}/u.test(s) ? 3 : 0) + 8;
  const inBand = (at, s) => () => {
    const p = posOf(at);
    if (!p) return p;
    const top = Math.round(cam.y) + bubH(s) + 5;
    return p.y >= top ? p : { x: p.x, y: top };
  };
  // bubblans ruta så som sayBubble ritar den: klämd innanför vyns kanter (en bubbla vid
  // hallens ände trycks inåt – och kan då hamna över en annan)
  const bubRect = (p, s) => {
    const w = bubW(s), h = bubH(s), cx = Math.round(cam.x);
    const bx = clamp(Math.round(p.x - w / 2), cx + 2, cx + VW - w - 2);
    return [bx - 1, p.y - h - 5, bx + w + 1, p.y];
  };
  const clash = (a, b) => a[0] < b[2] + 3 && b[0] < a[2] + 3 && a[1] < b[3] + 3 && b[1] < a[3] + 3;
  let paCur = null, talkCur = null;
  const talkRect = () => (talk.active() && talkCur ? bubRect(posOf(talkCur.at), talkCur.s) : null);
  // alla repliker i scenen (personal, resenärer, figurens egna tankar) går hit
  function say(text2, at, secs, opts) {
    const f = inBand(at, text2);
    chat.clear();
    if (pa.active() && paCur && clash(bubRect(f(), text2), bubRect(posOf(paCur.at), paCur.s))) pa.clear();
    talkCur = { at: f, s: text2 };
    talk.say(text2, f, secs, opts);
  }

  // ---------- högtalarutropen ----------
  let paT = 6;
  function announce(force = false) {
    const fl = upcoming(8);
    const f = fl[Math.floor(R() * Math.min(4, fl.length))] || null;
    const lines = [];
    if (f) {
      const st = statusOf(f, g.min);
      if (st.s === 'BOARDING') lines.push(`DING DONG! ${f.no} TILL ${f.dest} BOARDAR NU VID GATE ${f.gate}.`);
      if (st.s === 'STÄNGER') lines.push(`SISTA UTROP FÖR ${f.no} TILL ${f.dest}! GATE ${f.gate} STÄNGER.`);
      if (st.s === 'FÖRSENAD') lines.push(`${f.no} TILL ${f.dest} ÄR FÖRSENAT. NY TID ${hhmm(f.m + f.late)}.`);
      lines.push(`DING DONG! ${f.no} TILL ${f.dest} AVGÅR ${hhmm(f.m)} FRÅN GATE ${f.gate}.`);
    }
    lines.push('LÄMNA INTE BAGAGE UTAN TILLSYN, TACK.', 'BAGAGET FRÅN PARIS KOMMER PÅ BAND 1.', 'RESENÄR SIXTEN PIXELSSON OMBEDES KOMMA TILL GATE A2.', 'VÄLKOMMEN TILL PIXELSTADENS FLYGPLATS - VI HAR ÖPPET DYGNET RUNT.');
    const text2 = lines[Math.floor(R() * lines.length)];
    // närmaste högtalaren i bild vars bubbla inte hamnar ovanpå en pågående replik. Bubblan
    // sitter alltid PÅ högtalaren (trycks aldrig ner – då skulle den se ut att komma från
    // någon som står under). Syns ingen högtalare med sin bubbla (mobilens radband när man
    // står längst ner på golvet) väntar utropet tills en gör det.
    const c = cam.x + VW / 2, top = Math.round(cam.y) + bubH(text2) + 5;
    const byDist = SPEAKERS.slice().sort((a, b) => Math.abs(a.x - c) - Math.abs(b.x - c));
    const vis = byDist.filter((q) => q.x > cam.x + 12 && q.x < cam.x + VW - 12 && q.y - 2 >= top);
    if (!vis.length && !force) return false;
    const tr = talkRect();
    const cand = vis.length ? vis : byDist;
    const sp = cand.find((q) => !tr || !clash(bubRect({ x: q.x, y: q.y - 2 }, text2), tr)) || cand[0];
    chat.clear(); // småpratet får vika för utropet
    const at = { x: sp.x, y: sp.y - 2 };
    paCur = { at, s: text2 };
    pa.say(text2, at, 6.5, { voice: 'Högtalaren' });
    chime();
    return true;
  }

  // ---------- figuren ----------
  let doorOpen = 0, doorWas = false;
  const gateOpen = GATES.map(() => 0);
  function release() { if (me.res && me.res.occ === 'me' && me.res !== me.seat) me.res.occ = null; me.res = null; }
  function standUp() {
    if (!me.seat) return;
    const s = me.seat;
    s.occ = null; me.seat = null; me.slide = null; me.state = 'free';
    walker.px = s.ax; walker.py = s.ay; walker.stop();
    me.rise = { ox: s.x - s.ax, oy: s.y - s.ay, k: 0 }; // glid upp från stolen, inget hopp
  }
  function sitDown(s) {
    s.occ = 'me'; me.seat = s; me.res = null; me.state = 'sit';
    me.slide = { fx: walker.px, fy: walker.py, k: 0 };
    walker.stop();
    play('click');
  }
  function goSit(s) {
    release();
    me.res = s; s.occ = 'me';
    walker.walkTo(s.ax, s.ay, () => { if (s.occ && s.occ !== 'me') { me.res = null; say('Oj, upptaget!', meAt, 2); return; } sitDown(s); });
  }
  // Jobbet: den som erbjuder passet säger sin replik i en pratbubbla (med sin egen röst)
  // och vänder sig mot figuren, sedan kommer passdialogen. Går det inte att jobba nu
  // (för trött, eller nattpassen inte inlagda) svarar hen i bubblan i stället.
  const pick = (a) => a[Math.floor(R() * a.length)];
  function offerJob(jobId, who, line, face = null) {
    const at = { x: who.x, y: who.y - 44 }, v = { voice: who.look };
    if (face) { who.faceDir = face; who.faceUntil = t + 5; }
    play('click');
    const job = JOBS[jobId];
    if (!job) { say(line, at, 3.5, v); setTimeout(() => { if (A.scene === api) say('... fast passen är inte inlagda i schemat än!', at, 3, v); }, 1600); return; }
    let chk = { ok: true };
    try { chk = g.canWork?.(jobId) || chk; } catch { /* kontrollen är aldrig ett krav här */ }
    const tired = /trött/i.test(chk.msg || '');
    const nightJob = job.nattoppet || job['nattöppet'] || job.night;
    if (!chk.ok && !chk.waitTo && (tired || !nightJob)) {
      say(tired ? 'Du ser helt slut ut! Gå hem och sov först, så ses vi.' : 'Nattpassen är inte inlagda i schemat än. Kom tillbaka i morgon bitti!', at, 4, v);
      return;
    }
    say(line, at, 3.5, v);
    setTimeout(() => { if (A.scene === api) A.startJob(jobId); }, 900);
  }
  // Fram till en disk: står man vid den öppna disken frågar incheckaren där, är den
  // stängd (natt) ropar stationschefen att man kan öppna den.
  function deskOffer(k) {
    walker.dir = 'up';
    if (deskState[k].open) offerJob('incheckning', agents[k], pick(['Vill du jobba här vid disken? Ta ett pass i incheckningen!', 'Hoppa in bakom disken - vi behöver en till!', 'Kliv in bakom disken! Ett pass i incheckningen?']));
    else offerJob('incheckning', staff[0], `Disk ${k + 1} är stängd i natt - men du kan öppna den! Ta ett pass?`, 'left');
  }
  const hot = [
    { id: 'dorr', r: [DOOR.x0 - 4, BOARD.y + BOARD.h + 1, DOOR.x1 + 4, WALL_Y + 8], go: () => [DOOR_SPOT[0], WALL_Y + 6], act: () => { play('door'); A.go('city'); } },
    // cheferna: figuren ställer sig snett bredvid och vänder sig mot dem (skymmer dem inte)
    { id: 'incheckning', r: [MANAGER.x - 9, MANAGER.y - 40, MANAGER.x + 9, MANAGER.y + 2], go: () => [MANAGER.x - 18, MANAGER.y + 4], act: () => { walker.dir = 'right'; offerJob('incheckning', staff[0], 'Hej! Vi behöver folk i incheckningen - vill du ta ett pass?', 'left'); } },
    { id: 'band', r: [CHIEF.x - 9, CHIEF.y - 40, CHIEF.x + 9, CHIEF.y + 2], go: () => [CHIEF.x + 18, CHIEF.y + 4], act: () => { walker.dir = 'left'; offerJob('flygplats', staff[1], 'Bandet går varmt! Hjälp oss med väskorna i bagagehallen?', 'right'); } },
    // diskarna: man går fram till disken man klickar på (vid dess högra ände)
    ...DESKS.map((D, k) => ({ id: 'disk' + k, r: [D.sx0, AGENT_Y - 34, D.x1, DESK_Y + 2], go: () => [D.x1 - 6, DESK_Y + 7], act: () => deskOffer(k) })),
    { id: 'karusell', r: [58, 118, 242, 168], go: (x) => [clamp(x, 70, 230), 182], act: () => say(pick(L_WAIT), meAt, 3) },
    { id: 'tavla', r: [BOARD.x, BOARD.y, BOARD.x + BOARD.w, BOARD.y + BOARD.h], go: () => [380, 124], act: () => readBoard() },
    { id: 'uttag', r: [296, BOARD.y + BOARD.h + 1, 322, 94], go: () => [309, 106], act: () => { play('click'); say(`SALDO: ${Math.round(g.money).toLocaleString('sv-SE').replace(/\s/g, ' ')} KR 💳`, { x: 309, y: 60 }, 3, { silent: true }); } },
    { id: 'info', r: [444, 90, 458, 127], go: () => [451, 134], act: () => { play('click'); say('VÄLKOMMEN! BAGAGE TILL VÄNSTER, INCHECKNING OCH GATER TILL HÖGER.', { x: 451, y: 88 }, 4, { silent: true }); } },
    { id: 'kiosk', r: [KIOSK.x0, 40, KIOSK.x1, KIOSK.y + 2], go: () => [1320, KIOSK.y + 10], act: () => { play('click'); say(pick(L_BARISTA), () => ({ x: Math.round(barista.x), y: barista.y - 44 }), 3.5, { voice: barista.look }); } },
    { id: 'wc', r: [1392, 34, 1432, WALL_Y], go: () => [1412, WALL_Y + 8], act: () => { play('knock'); say('Upptaget! Det är alltid kö här ... 🚽', meAt, 3); } },
    { id: 'gateA1', r: [GATES[0].x - 16, 44, GATES[0].x + 16, WALL_Y], go: () => [GATES[0].x, WALL_Y + 8], act: () => gateTalk(0) },
    { id: 'gateA2', r: [GATES[1].x - 16, 44, GATES[1].x + 16, WALL_Y], go: () => [GATES[1].x, WALL_Y + 8], act: () => gateTalk(1) },
  ];
  function gateTalk(i) {
    const who = staff[4 + i], f = upcoming(1, GATES[i].id)[0];
    play('click');
    say(f ? `${f.no} till ${f.dest} går ${hhmm(f.m)}. Har du biljett? Nej? Då får du stanna här!` : pick(L_GATE), { x: who.x, y: who.y - 44 }, 4, { voice: who.look });
  }
  function readBoard() {
    const f = upcoming(1)[0];
    play('click');
    if (f) say(`Nästa: ${f.no} till ${f.dest} ${hhmm(f.m)}, gate ${f.gate}. ${statusOf(f, g.min).s}.`, meAt, 4);
  }
  const spotAt = (x, y) => hot.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const seatAt = (x, y) => seats.find((s) => Math.abs(x - s.x) < 7 && y > s.y - 32 && y < s.y + 3);
  const npcAt = (x, y) => {
    let best = null, bd = 1e9;
    // incheckarna vid de stängda diskarna (natt) är inte där – de går inte att prata med
    const all = [...npcs.filter((n) => !n.hidden), ...staff, ...agents.filter((a, k) => deskState[k].open), barista];
    for (const n of all) {
      const top = n.state === 'sit' ? 30 : 38;
      if (Math.abs(x - n.x) < 7 && y > n.y - top && y < n.y + 2) { const d = Math.abs(y - (n.y - 18)); if (d < bd) { bd = d; best = n; } }
    }
    return best;
  };
  function replyOf(n) {
    const pick = (a) => a[Math.floor(R() * a.length)];
    if (n.role === 'agent') return pick(L_AGENT);
    if (n.role === 'guard') return pick(L_GUARD);
    if (n.role === 'barista') return pick(L_BARISTA);
    if (n.role === 'gate') return pick(L_GATE);
    if (n.role === 'kid') return pick(L_KID);
    if (n.role === 'crew') return 'Kaptenen här - vi lyfter snart! ✈️';
    if (n.role === 'janitor') return pick(L_JANITOR);
    if (n.act === 'sleep') return pick(L_SLEEP);
    if (n.role === 'arr' && n.state === 'waitBag') return pick(L_WAIT);
    if (n.state === 'looking' || n.act === 'watch') return pick(L_WINDOW);
    if (n.state === 'sit') return pick(nightNow() && R() < 0.5 ? L_NIGHT : L_SEAT);
    return pick(L_WALK);
  }
  function talkTo(n) {
    // cheferna: gå fram till dem (snett bredvid) och få passet erbjudet där
    if (n.role === 'manager' || n.role === 'chief') { const h = hot.find((q) => q.id === (n.role === 'manager' ? 'incheckning' : 'band')); walker.walkTo(...h.go(), h.act); return; }
    play('click');
    const up = n.state === 'sit' ? 40 : 44;
    // talaren ska låta som sig själv – även när hen står alldeles intill figuren
    say(replyOf(n), () => ({ x: Math.round(n.x), y: Math.round(n.y) - up }), 3.5, { voice: n.look });
    if (n.act === 'sleep') { n.act = 'phone'; }
  }

  // småprat: bara det som syns i bild, och inte för ofta – och aldrig mitt i ett utrop
  let chatT = 0, chatAt = null;
  const onScreen = (x) => x > cam.x + 10 && x < cam.x + VW - 10;
  function ambient(text2, at, x, force = false) {
    if (!onScreen(x) || (!force && t < chatT) || talk.active() || pa.active()) return;
    chatT = t + 5 + R() * 4; chatAt = at;
    chat.say(text2, inBand(at, text2), 2.6, { silent: true });
  }
  let parentT = 8;
  function updateChatter(dt) {
    parentT -= dt;
    if (parentT <= 0) {
      parentT = 10 + R() * 12;
      const kid = npcs.find((n) => n.role === 'kid' && Math.abs(n.x - parent.x) < 90);
      if (kid && R() < 0.6) ambient(R() < 0.5 ? 'SPRING INTE!' : 'Kom hit nu, gubben!', { x: parent.x, y: parent.y - 40 }, parent.x);
      else if (kid) ambient(L_KID[Math.floor(R() * L_KID.length)], () => ({ x: kid.x, y: kid.y - 36 }), kid.x);
    }
  }
  // ---------- uppdatering ----------
  function update(dt) {
    t += dt;
    const py = walker.py;
    walker.update(dt);
    archCheck(walker.px, py, walker.py, true);
    if (me.slide) { me.slide.k += dt * 4; if (me.slide.k >= 1) me.slide = null; }
    if (me.rise) { me.rise.k += dt * 4; if (me.rise.k >= 1) me.rise = null; }
    spawnPax(dt);
    updateDesks(dt);
    updateCarousel(dt);
    updateNpcs(dt);
    updateChatter(dt);
    updateParts(dt);
    updateBarista(dt);
    updateSecurity(dt);
    updateFar(dt);
    updateRoad(dt);
    rsT += dt; tkT += dt;
    paT -= dt;
    // utropet väntar tills pågående replik är klar (bubblorna ska inte hamna på varandra)
    if (paT <= 0) { if (talk.active()) paT = 1.5; else paT = announce() ? 24 + R() * 14 : 3; }
    // skjutdörrarna
    const near = (x, y) => Math.abs(x - 380) < 26 && y < WALL_Y + 18;
    const any = near(walker.px, walker.py) || npcs.some((n) => !n.hidden && near(n.x, n.y));
    doorOpen += ((any ? 1 : 0) - doorOpen) * Math.min(1, dt * 6);
    // gatedörrarna glider upp när någon går ombord
    GATES.forEach((gt, i) => {
      const nb = npcs.some((n) => !n.hidden && Math.abs(n.x - gt.x) < 14 && n.y < WALL_Y + 16) || (Math.abs(walker.px - gt.x) < 14 && walker.py < WALL_Y + 12);
      gateOpen[i] += ((nb ? 1 : 0) - gateOpen[i]) * Math.min(1, dt * 5);
    });
    if (any && !doorWas) play('slide');
    doorWas = any;
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (cams() - cam.x) * k;
    const ky = camYs() - cam.y;
    cam.y = Math.abs(ky) < 0.5 ? camYs() : cam.y + ky * Math.min(1, dt * 5);
  }
  // låt allt komma igång direkt när man kliver in
  for (let i = 0; i < 60; i++) { const d = 1 / 15; t += d; updateCarousel(d); updateRoad(d); updateSecurity(d); updateDesks(d); for (const n of npcs) if (n.state !== 'sit') stepNpc(n, d); }

  // ---------- ritning ----------
  const rowImg = new Map();
  let NOISE = null;
  function noiseRow(i) {
    if (!NOISE) {
      NOISE = [];
      const AB = 'ABCDEFGHIJKLMNOPRSTUVY0123456789';
      for (let k = 0; k < 6; k++) {
        const P = new Pix(160, 6);
        for (let x = 0; x < 156; x += 4) { const ch = AB[Math.floor(hash(x, k, 301) * AB.length)]; text(P, SMALL, ch, x, 1, x < 20 || (x > 92 && x < 104) ? 0xffd23a : 0xf4f4ec, 0.85); P.hl(x, 3, 3, 0x0e0f12, 0.8); }
        NOISE.push(P.flush());
      }
    }
    return NOISE[((i % 6) + 6) % 6];
  }
  function boardRow(f, blinkOn) {
    const st = statusOf(f, g.min), key = f.key + '|' + st.s + '|' + (st.blink && !blinkOn ? 0 : 1);
    let c = rowImg.get(key);
    if (c) return c;
    const P = new Pix(160, 6);
    text(P, SMALL, hhmm(f.m), 0, 1, 0xffd23a);
    text(P, SMALL, f.dest, 23, 1, 0xf4f4ec);
    text(P, SMALL, f.no, 66, 1, 0xc8d0e0);
    text(P, SMALL, f.gate, 94, 1, 0xffd23a);
    if (!st.blink || blinkOn) text(P, SMALL, st.s, 110, 1, st.c);
    c = P.flush();
    rowImg.set(key, c);
    if (rowImg.size > 200) rowImg.clear();
    return c;
  }
  const boardMem = { keys: [], at: [] };
  function drawBoard(ctx) {
    const list = upcoming(10), page = Math.floor(t / 8) % 2, blink = Math.floor(t * 2) % 2 === 0;
    for (let r = 0; r < 5; r++) {
      const f = list[page * 5 + r] || list[r];
      if (!f) continue;
      if (boardMem.keys[r] !== f.key) { if (boardMem.keys[r] !== undefined) boardMem.at[r] = t + r * 0.08; boardMem.keys[r] = f.key; }
      const age = t - (boardMem.at[r] ?? -9), x = BOARD.x + 4, y = BOARD.y + 15 + r * 6;
      if (age >= 0 && age < 0.6) ctx.drawImage(noiseRow(Math.floor(age * 24) + r), x, y);
      else if (age < 0) ctx.drawImage(noiseRow(r), x, y);
      else ctx.drawImage(boardRow(f, blink), x, y);
    }
    // klockan uppe till höger
    ctext(ctx, hhmm(g.min), BOARD.x + BOARD.w - 25, BOARD.y + 5, '#ffd23a');
    if (blink) { ctx.fillStyle = '#5aff8a'; ctx.fillRect(BOARD.x + BOARD.w - 29, BOARD.y + 6, 1, 3); }
  }
  function drawScreens(ctx) {
    const fl = upcoming(8).filter((f) => !f.off && f.m + f.late - g.min > 30);
    deskState.forEach((ds, k) => {
      const D = ds.D, x = D.x0 + 4, y = FASCIA + 11;
      if (!ds.open) { ctext(ctx, 'STÄNGD', x + 8, y, '#ff5a4a'); return; }
      const f = fl[k % Math.max(1, fl.length)];
      if (!f) return;
      const ph = Math.floor(t / 2.5 + k) % 3, s = ph === 0 ? f.dest : ph === 1 ? f.no : 'AVG ' + hhmm(f.m);
      ctext(ctx, s, x, y, ph === 0 ? '#f4f4ec' : '#ffd23a');
      // vågens display
      if (t - ds.wT < 3) ctext(ctx, String(Math.min(ds.weight, Math.floor((t - ds.wT) * 30))), D.sx0 + 12, WALL_Y + 4, '#ff5a3a');
      else { ctx.fillStyle = '#5a1a14'; ctx.fillRect(D.sx0 + 13, WALL_Y + 6, 5, 1); }
    });
    GATES.forEach((gt) => {
      const f = upcoming(1, gt.id)[0], x = (gt.scr > 0 ? gt.x + 18 : gt.x - 56) + 2;
      if (!f) return;
      const st = statusOf(f, g.min);
      ctext(ctx, gt.id + ' ' + f.no, x, 62, '#ffd23a');
      ctext(ctx, f.dest.slice(0, 8), x, 68, '#f4f4ec');
      if (!st.blink || Math.floor(t * 2) % 2) ctext(ctx, st.s === 'I TID' ? 'AVG ' + hhmm(f.m) : st.s, x, 74, rgb(st.c));
    });
    // LED-skylten över bagagerutschen (rullande text)
    const msg = '  BAND 1 + SF 311 FRÅN PARIS + BAGAGET KOMMER +', mw = textW(SMALL, msg) + 4, off = Math.floor(t * 12) % mw;
    ctx.save(); ctx.beginPath(); ctx.rect(FEED.x0 + 5, FEED.top + 3, 38, 5); ctx.clip();
    ctext(ctx, msg, FEED.x0 + 5 - off, FEED.top + 3, '#ffb030'); ctext(ctx, msg, FEED.x0 + 5 - off + mw, FEED.top + 3, '#ffb030');
    ctx.restore();
    // uttagets skärm blinkar, röntgenskärmen visar innehållet i lådan
    if (Math.floor(t * 1.5) % 2) { ctx.fillStyle = '#9ad0ff'; ctx.fillRect(305, 75, 3, 1); }
    const xs = t - xrayShow < 2.5;
    ctx.fillStyle = xs ? '#1e3a6a' : '#0a1a2a'; ctx.fillRect(XRAY.x0 + 19, 107, 11, 6);
    if (xs) { ctx.fillStyle = '#f08a2a'; ctx.fillRect(XRAY.x0 + 20, 108, 4, 3); ctx.fillStyle = '#5ad88a'; ctx.fillRect(XRAY.x0 + 25, 109, 3, 2); ctx.fillStyle = '#9ac8ff'; ctx.fillRect(XRAY.x0 + 21, 111, 7, 1); }
    // klockan på gateskärmarna … och en analog klocka ovanför kartan
    const cx = 441, cy = 60;
    ctx.fillStyle = '#e8ecf0'; ctx.fillRect(cx - 3, cy - 3, 7, 7); ctx.fillStyle = '#3a3e46';
    const mm = g.min % 60, hh = (g.min / 60) % 12;
    pline(ctx, cx, cy, cx + Math.sin(hh / 12 * Math.PI * 2) * 2, cy - Math.cos(hh / 12 * Math.PI * 2) * 2);
    pline(ctx, cx, cy, cx + Math.sin(mm / 60 * Math.PI * 2) * 3, cy - Math.cos(mm / 60 * Math.PI * 2) * 3);
  }
  function drawOutside(ctx, cx, vw, mode) {
    const lit = lightsOn(mode), T = tintOf(mode);
    ctx.save();
    ctx.beginPath();
    for (const [a, b] of PANES) { const x0 = Math.max(a, cx - 2), x1 = Math.min(b, cx + vw + 2); if (x1 > x0) ctx.rect(x0, GT + 2, x1 - x0, GB - GT - 2); }
    ctx.clip();
    // --- bortre lagret (halv fart) ---
    const fx0 = Math.round(cx * 0.5), F = farImg(mode);
    ctx.drawImage(F.img, cx - fx0, 0, vw, FAR_H, cx, 0, vw, FAR_H);
    if (F.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(F.glow, cx - fx0, 0, vw, FAR_H, cx, 0, vw, FAR_H); ctx.globalCompositeOperation = 'source-over'; }
    ctx.save();
    ctx.translate(fx0, 0);
    // vindkraftverkens blad, radarn, blinkande hinderljus, inflygningsljusens "kanin"
    ctx.fillStyle = rgb(T(0xeef0f2));
    TURBINES.forEach((tx, i) => {
      for (let k = 0; k < 3; k++) { const a = t * (1.1 + i * 0.13) + k * Math.PI * 2 / 3 + i; pline(ctx, tx, 23, tx + Math.cos(a) * 7, 23 + Math.sin(a) * 7); }
      if (lit && Math.floor(t * 1.2 + i) % 2) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(tx, 22, 1, 1); ctx.fillStyle = rgb(T(0xeef0f2)); }
    });
    ctx.fillStyle = rgb(T(0xd8dce2)); const rw = Math.round(Math.abs(Math.cos(t * 2.4)) * 3); ctx.fillRect(RADAR_X - rw, 31, rw * 2 + 1, 1);
    if (lit) {
      if (Math.floor(t * 1.3) % 2) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(TOWER_X, 11, 1, 1); ctx.fillRect(TVTOWER_X, 13, 1, 1); ctx.fillRect(HOTEL_X, 21, 1, 1); }
      const k = Math.floor(t * 14) % 8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSm, W - 9 - k * 5 - 4, 48); ctx.fillStyle = '#ffffff'; ctx.fillRect(W - 9 - k * 5, 52, 1, 1);
      ctx.globalCompositeOperation = 'source-over';
    }
    // en liten fågelflock (dagtid) som drar förbi över himlen
    if ((mode === 'dag' || mode === 'gryning') && Math.floor(t / 40) % 2 === 0) {
      ctx.fillStyle = '#2a3040';
      for (let k = 0; k < 5; k++) {
        const bx = Math.round(cx * 0.5 + ((t * 9 + k * 7) % (vw + 80)) - 40 + (k % 2) * 6), by = Math.round(22 + k * 2 + Math.sin(t * 0.8 + k) * 2);
        if (Math.floor(t * 5 + k) % 2) { ctx.fillRect(bx - 1, by, 1, 1); ctx.fillRect(bx, by + 1, 1, 1); ctx.fillRect(bx + 1, by, 1, 1); }
        else ctx.fillRect(bx - 1, by + 1, 3, 1);
      }
    }
    // bortre planet
    if (farPlane) {
      const s = farState(farPlane), sp = sidePlane(FARL, farPlane.liv, s.pitch, s.gear, mode === 'natt' ? 'nattfar' : mode, s.dir, true);
      const px = Math.round(s.x), py = Math.round(s.y);
      ctx.drawImage(sp.img, px - sp.ox, py - sp.oy);
      const G2 = sp.G, pt = (u, v) => { const [dx, dy] = sidePt(G2, s.pitch, s.dir, u, v); return [px + Math.round(dx), py + Math.round(dy)]; };
      const bl = Math.floor(t * 3) % 3 === 0, strobe = (t * 1.3) % 1 < 0.1;
      const [ba, bb] = pt(0.5 * FARL, -G2.r - 0.6);
      if (bl) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(ba, bb, 1, 1); }
      if (lit) {
        ctx.globalCompositeOperation = 'lighter';
        if (bl) ctx.drawImage(glowRed, ba - 4, bb - 4);
        const [nx, ny] = pt(0.47 * FARL, G2.r * 0.6);
        ctx.drawImage(s.dir < 0 ? glowRed : glowGreen, nx - 4, ny - 4);
        if (strobe) { const [tx2, ty2] = pt(0, -G2.r * 0.2); ctx.drawImage(glowSm, tx2 - 4, ty2 - 4); ctx.drawImage(glowSm, nx - 4, ny - 4); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = s.dir < 0 ? '#ff3a2a' : '#5aff8a'; ctx.fillRect(nx, ny, 1, 1);
      }
      if (s.land) {
        const [lx, ly] = pt(0.62 * FARL, G2.r * 0.8);
        if (lit) {
          // landningsljuset: en stark punkt och en kägla framåt/nedåt mot banan
          const down = farPlane.kind === 'land' && farPlane.t < 9 ? 0.22 : 0.02;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowLand, lx - 9, ly - 5); ctx.drawImage(glowLand, lx - 9, ly - 5);
          for (let i = 2; i < 40; i += 2) {
            const k = 1 - i / 40, bx = lx + s.dir * i, by = ly + Math.round(i * down), hh = 1 + Math.floor(i / 7);
            ctx.fillStyle = `rgba(255,246,216,${(0.26 * k).toFixed(3)})`;
            ctx.fillRect(bx - (s.dir < 0 ? 1 : 0), by - (hh >> 1), 2, hh);
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#ffffff'; ctx.fillRect(lx, ly, 2, 1);
        } else { ctx.fillStyle = '#fffbe8'; ctx.fillRect(lx, ly, 1, 1); }
      }
    }
    for (const s of smoke) { ctx.fillStyle = `rgba(230,230,235,${(0.6 * (1 - s.age / s.max)).toFixed(2)})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), s.age < 0.4 ? 1 : 2, 1); }
    ctx.restore();
    // --- plattan (full fart) ---
    const om = objMode(mode);
    const N = nearImg(mode);
    ctx.drawImage(N.img, cx, 0, vw, N.img.height, cx, NEAR_TOP, vw, N.img.height);
    // uppställningsplatsen
    const rs = rsState();
    if (rs.plane !== null && rs.plane > cx - 80 && rs.plane < cx + vw + 80) {
      const sp = sidePlane(RS.L, rs.liv, 0, 1, om, -1, true), px = Math.round(rs.plane), py = RS.y;
      ctx.drawImage(sp.img, px - sp.ox, py - sp.oy);
      const G2 = sp.G, pt = (u, v) => { const [dx, dy] = sidePt(G2, 0, -1, u, v); return [px + Math.round(dx), py + Math.round(dy)]; };
      if (rs.beacon && Math.floor(t * 2.5) % 3 === 0) { ctx.fillStyle = '#ff3a2a'; const [a, b] = pt(0.5 * RS.L, -G2.r - 0.6); ctx.fillRect(a - 1, b, 2, 1); const [c2, d2] = pt(0.5 * RS.L, G2.r + 0.6); ctx.fillRect(c2 - 1, d2, 2, 1); }
      if (lit) {
        const [nx, ny] = pt(0.47 * RS.L, G2.r * 0.7); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(nx, ny, 1, 1);
        if (rs.taxi) { const [lx, ly] = pt(0.86 * RS.L, G2.r + G2.gl - 2); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowLand, lx - 9 - 8, ly - 5); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fffbe8'; ctx.fillRect(lx, ly, 1, 1); }
        const [fx, fy] = pt(0.1 * RS.L, -G2.r - RS.L * 0.12); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSm, fx - 4, fy - 4); ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (rs.marsh) ctx.drawImage(miniSprite('marsh', rs.marsh.f, om), Math.round(rs.marsh.x) - 4, RS.y - 12);
    for (const p of rs.pax) ctx.drawImage(miniSprite('pax', p.f, om, p.v), Math.round(p.x) - 4, Math.round(p.y) - 14);
    if (rs.stairs) { const v = vehicle('stairs', rs.stairs.dir, om); ctx.drawImage(v.img, Math.round(rs.stairs.x - v.w / 2), 81 - v.h); }
    if (rs.bus) { const v = vehicle('bus', 1, om); ctx.drawImage(v.img, Math.round(rs.bus.x - v.w / 2), 86 - v.h); }
    ctx.drawImage(N.gates, cx, 0, vw, N.gates.height, cx, NEAR_TOP, vw, N.gates.height);
    // gateplanens lampor
    GATES.forEach((gt, i) => {
      const cx2 = gt.plane, gy = GATE_GY;
      const fy = gy - NOSE.lift, sp = NOSE.span;
      if (i === 1 && Math.floor(t * 2.5) % 3 === 0) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(cx2 - 1, fy - NOSE.R - 1, 2, 1); ctx.fillRect(cx2 - 1, fy + NOSE.R + 1, 2, 1); }
      if (lit) {
        ctx.fillStyle = '#5aff8a'; ctx.fillRect(cx2 - sp - 1, gy - 31, 2, 2); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(cx2 + sp, gy - 31, 2, 2);
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSm, cx2 - sp - 4, gy - 34); ctx.drawImage(glowSm, cx2 + sp - 3, gy - 34);
        if ((t * 0.9 + i * 0.4) % 1 < 0.07) { ctx.drawImage(glowSm, cx2 - sp - 4, gy - 35); ctx.drawImage(glowSm, cx2 + sp - 3, gy - 35); }
        ctx.globalAlpha = 0.7; ctx.drawImage(glowLand, cx2 - 9, fy - NOSE.R - NOSE.fin + 6); ctx.drawImage(glowLand, cx2 - 9, fy - NOSE.R - NOSE.fin + 16); ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    });
    // tankbilen vid A1
    const tk = tankState();
    if (tk.x > cx - 60 && tk.x < cx + vw + 60) {
      const v = vehicle('tank', -1, om), tx = Math.round(tk.x);
      ctx.drawImage(v.img, tx - (v.w >> 1), 90 - v.h);
      if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#ffa020'; ctx.fillRect(tx - (v.w >> 1) + 4, 90 - v.h + 1, 2, 1); }
      if (tk.fuel) {
        ctx.fillStyle = rgb(T(0x2a2c30));
        pline(ctx, tx + 12, 75, tx + 9, 68); pline(ctx, tx + 9, 68, tx + 4, 63);
        ctx.drawImage(miniSprite('crew', 0, om, 1), tx + 20, 74);
        if (Math.floor(t * 4) % 2) { ctx.fillStyle = '#5aff8a'; ctx.fillRect(tx + 17, 81, 1, 1); }
      }
    }
    // servicevägen
    for (const v of road) {
      if (v.x < cx - 100 || v.x > cx + vw + 100) continue;
      if (v.kind === 'train') {
        const tug = vehicle('tug', v.dir, om);
        const x = Math.round(v.x);
        ctx.drawImage(tug.img, x - tug.w, v.y - tug.h);
        for (let k = 0; k < 3; k++) { const c = vehicle('cart', v.dir, om, v.v + k); ctx.drawImage(c.img, x - tug.w - (k + 1) * (c.w + 1), v.y - c.h); }
        if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#ffa020'; ctx.fillRect(x - tug.w + 5, v.y - tug.h, 2, 1); }
      } else {
        const im = vehicle(v.kind, v.dir, om);
        ctx.drawImage(im.img, Math.round(v.x - im.w / 2), v.y - im.h);
        if (v.kind === 'follow' && Math.floor(t * 4) % 2) { ctx.fillStyle = '#ffa020'; ctx.fillRect(Math.round(v.x) - 1, v.y - im.h - 1, 2, 1); }
      }
    }
    // markpersonal vid gaterna
    for (let k = 0; k < 4; k++) {
      const gx = GATES[k % 2].plane + [-20, 76, 66, -64][k], w2 = Math.sin(t * 0.4 + k * 2) * 9;
      ctx.drawImage(miniSprite('crew', Math.abs(Math.cos(t * 0.4 + k * 2)) > 0.2 ? 1 + (Math.floor(t * 5 + k) % 2) : 0, mode, k), Math.round(gx + w2) - 4, 74);
    }
    if (N.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(N.glow, cx, 0, vw, N.glow.height, cx, NEAR_TOP, vw, N.glow.height); ctx.globalCompositeOperation = 'source-over'; }
    // regn på rutorna
    if (g.eventIs?.('regn')) {
      ctx.fillStyle = 'rgba(40,50,70,0.25)'; ctx.fillRect(cx, GT, vw, GB - GT);
      ctx.fillStyle = 'rgba(200,215,240,0.45)';
      for (let i = 0; i < 90; i++) { const rx = cx + ((i * 53.3 + t * 14) % vw), ry = GT + ((i * 31.7 + t * (70 + (i % 5) * 12)) % (GB - GT)); ctx.fillRect(rx | 0, ry | 0, 1, 3); }
    }
    ctx.restore();
    // glasets reflexer
    ctx.drawImage(glassImg(mode), cx, 0, vw, GB - GT, cx, GT, vw, GB - GT);
  }
  function drawSeated(ctx, s) {
    const o = s.occ;
    if (!o) return;
    if (o === 'me') {
      if (me.seat !== s) return;
      const sl = me.slide, k = sl ? clamp(sl.k, 0, 1) : 1;
      const x = sl ? lerp(sl.fx, s.x, k) : s.x, y = sl ? lerp(sl.fy, s.y, k) : s.y;
      drawPerson(ctx, x, y, A.avatar.look, sl ? (s.x < x ? 'left' : 'right') : s.dir, sl ? WALK_SEQ[Math.floor(t * 8.5) % 4] : 5);
      if (worldFolksHere(A).length) nameTag(ctx, x, y - 50, A.avatar);
      const mine = worldMyEmote();
      if (mine) emoteBubble(ctx, x, y - 58, mine);
      return;
    }
    if (o.state !== 'sit' || o.seat !== s) return;
    const sl = o.slide, k = sl ? clamp(sl.k, 0, 1) : 1;
    const x = sl ? lerp(sl.fx, s.x, k) : s.x, y = sl ? lerp(sl.fy, s.y, k) : s.y;
    if (sl) { drawPerson(ctx, x, y, o.look, s.x < x ? 'left' : 'right', WALK_SEQ[Math.floor(t * 8.5) % 4]); return; }
    const fr = o.eating > 0 ? 6 : 5;
    drawPerson(ctx, x, y, o.look, s.dir, fr);
    if (s.dir === 'down') drawAct(ctx, o, Math.round(x), Math.round(y));
  }
  // vad de som sitter vända mot oss håller på med
  function drawAct(ctx, o, x, y) {
    const a = o.act;
    if (a === 'read') {
      const flip = Math.floor(t * 0.3 + o.id) % 7 === 0;
      ctx.fillStyle = '#6a665e'; ctx.fillRect(x - 7, y - 29, 14, 10);
      ctx.fillStyle = '#f0ece0'; ctx.fillRect(x - 6, y - 28, 12, 8);
      ctx.fillStyle = '#b8b2a4'; for (let r = 0; r < 3; r++) { ctx.fillRect(x - 5, y - 26 + r * 2, 4, 1); ctx.fillRect(x + 1, y - 26 + r * 2, 4, 1); }
      ctx.fillStyle = '#c9323a'; ctx.fillRect(x - 5, y - 27, 3, 1);
      ctx.fillStyle = '#8a8478'; ctx.fillRect(x, y - 28, 1, flip ? 4 : 8);
    } else if (a === 'phone') {
      ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x - 1, y - 21, 3, 4);
      ctx.fillStyle = Math.floor(t * 0.7 + o.id) % 3 ? '#6ab4ff' : '#9ad8ff'; ctx.fillRect(x, y - 20, 1, 2);
    } else if (a === 'laptop') {
      ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 6, y - 23, 12, 1);
      ctx.fillStyle = '#b8bec6'; ctx.fillRect(x - 6, y - 22, 12, 6);
      ctx.fillStyle = '#e8ecf0'; ctx.fillRect(x - 6, y - 22, 12, 1); ctx.fillStyle = '#f4f6f8'; ctx.fillRect(x - 1, y - 20, 2, 2);
      ctx.fillStyle = '#8a9098'; ctx.fillRect(x - 7, y - 16, 14, 1);
    } else if (a === 'sleep') {
      ctx.fillStyle = '#6aa8e0'; ctx.fillRect(x - 4, y - 27, 1, 3); ctx.fillRect(x + 4, y - 27, 1, 3); ctx.fillRect(x - 3, y - 25, 7, 1);
      ctx.fillStyle = '#9ad0ff'; ctx.fillRect(x - 4, y - 27, 1, 1); ctx.fillRect(x + 4, y - 27, 1, 1);
    } else if (a === 'coffee') {
      const up = o.eating > 0;
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 3, y - (up ? 27 : 20), 3, 3);
      ctx.fillStyle = '#6a3a1a'; ctx.fillRect(x + 3, y - (up ? 27 : 20), 3, 1);
      ctx.fillStyle = '#c9a44a'; ctx.fillRect(x + 3, y - (up ? 25 : 18), 3, 1);
    } else if (a === 'book') {
      ctx.fillStyle = ['#c9323a', '#2e5a9a', '#46a35a'][o.id % 3]; ctx.fillRect(x - 3, y - 21, 6, 4);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 2, y - 20, 4, 2); ctx.fillStyle = '#3a3e46'; ctx.fillRect(x, y - 21, 1, 4);
    } else if (a === 'eat') {
      const up = o.eating > 0;
      ctx.fillStyle = '#e8c070'; ctx.fillRect(x - 2, y - (up ? 27 : 19), 5, 2);
      ctx.fillStyle = '#5aa05a'; ctx.fillRect(x - 2, y - (up ? 26 : 18), 5, 1);
    }
  }
  function drawWalking(ctx, n, frameRate = 8.5) {
    if (n.role === 'janitor') { drawJanitor(ctx, n); return; }
    const walking = n.path.length > 0;
    const fr = walking ? WALK_SEQ[Math.floor(t * frameRate + n.id) % 4] : (Math.sin(t * 2 + n.id) > 0.93 ? 4 : 0);
    let x = Math.round(n.x), y = Math.round(n.y);
    if (n.rise) { const r = 1 - clamp(n.rise.k, 0, 1); x += Math.round(n.rise.ox * r); y += Math.round(n.rise.oy * r); } // glider upp från stolen
    if (n.bag) {
      const img = upCase(n.bag.ci, true);
      if (n.dir === 'down') ctx.drawImage(img, x + 3, y - 17);
      drawPerson(ctx, x, y, n.look, n.dir, fr);
      ctx.fillStyle = '#3a3e46';
      if (n.dir === 'right') { ctx.drawImage(img, x - 17, y - 15); pline(ctx, x - 3, y - 18, x - 11, y - 16); }
      else if (n.dir === 'left') { ctx.drawImage(img, x + 7, y - 15); pline(ctx, x + 3, y - 18, x + 11, y - 16); }
      else if (n.dir === 'up') ctx.drawImage(img, x + 4, y - 13);
    } else drawPerson(ctx, x, y, n.look, n.dir, fr);
    if (n.cup) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + (n.dir === 'left' ? -6 : 4), y - 19, 2, 3); }
  }
  function drawJanitor(ctx, n) {
    const x = Math.round(n.x), y = Math.round(n.y), walking = n.path.length > 0;
    const cxo = n.dir === 'left' ? -18 : n.dir === 'right' ? 4 : 6;
    if (n.dir === 'up') ctx.drawImage(cartImg, x + cxo, y - 15);
    drawPerson(ctx, x, y, n.look, walking ? n.dir : 'down', walking ? WALK_SEQ[Math.floor(t * 6) % 4] : (Math.sin(t * 5) > 0 ? 0 : 4));
    if (n.dir !== 'up') ctx.drawImage(cartImg, x + cxo, y - 15);
    if (!walking) {
      // moppen svischar fram och tillbaka
      const mx = x - 6 + Math.round(Math.sin(t * 5) * 4);
      ctx.fillStyle = '#c8a070'; pline(ctx, x - 3, y - 19, mx, y - 2);
      ctx.fillStyle = '#e8e4d8'; ctx.fillRect(mx - 2, y - 2, 5, 2);
      ctx.fillStyle = 'rgba(160,200,230,0.35)'; ctx.fillRect(x - 14, y - 1, 16, 3);
    }
  }
  function drawWorld(ctx, cx, vw) {
    const hour = hourNow(), mode = modeOf(hour), lamps = lampLevel(hour);
    drawOutside(ctx, cx, vw, mode);
    ctx.drawImage(hall.img, cx, 0, vw, H, cx, 0, vw, H);
    // korridoren bakom dörren: dagsljus eller natt längst bort
    ctx.fillStyle = mode === 'dag' ? '#e8f4fc' : mode === 'natt' ? '#141c38' : '#e89868';
    ctx.fillRect(376, 75, 9, 9);
    if (mode !== 'dag') { ctx.fillStyle = '#ffd070'; ctx.fillRect(378, 76, 1, 1); ctx.fillRect(383, 77, 1, 1); }
    if (Math.floor(t / 7) % 3 === 0) { ctx.fillStyle = '#f0c020'; ctx.fillRect(376 + Math.floor((t * 6) % 9), 81, 3, 2); }
    // skjutdörrarna
    const op = Math.round(clamp(doorOpen, 0, 1) * 24);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? DOOR.x0 - op : 380 + op, w = 28;
      ctx.save(); ctx.beginPath(); ctx.rect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top); ctx.clip();
      ctx.fillStyle = 'rgba(200,228,240,0.28)'; ctx.fillRect(x0, DOOR.top, w, WALL_Y - DOOR.top);
      ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x0, DOOR.top, w, 1); ctx.fillRect(x0, WALL_Y - 2, w, 2); ctx.fillRect(side < 0 ? x0 + w - 1 : x0, DOOR.top, 1, WALL_Y - DOOR.top);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 4 + k * 2, DOOR.top + 4 + k * 3, 1, 3);
      ctx.fillStyle = '#e8ecf0'; ctx.fillRect(x0 + (side < 0 ? w - 5 : 3), DOOR.top + 14, 2, 7);
      ctx.restore();
    }
    drawBoard(ctx);
    drawScreens(ctx);
    GATES.forEach((gt, i) => {
      const w2 = Math.round(clamp(gateOpen[i], 0, 1) * 11);
      if (w2 < 1) return;
      ctx.fillStyle = '#3a3e48'; ctx.fillRect(gt.x - w2, 57, w2 * 2, WALL_Y - 57);
      ctx.fillStyle = '#6a6e78'; ctx.fillRect(gt.x - w2, 88, w2 * 2, WALL_Y - 88);
      ctx.fillStyle = lampLevel(hourNow()) > 0.5 ? '#ffe8b0' : '#d8e4ee'; ctx.fillRect(gt.x - Math.min(w2, 3), 66, Math.min(w2, 3) * 2, 12);
      ctx.fillStyle = '#e8ecf0'; ctx.fillRect(gt.x - w2 - 1, 57, 1, WALL_Y - 57); ctx.fillRect(gt.x + w2, 57, 1, WALL_Y - 57);
    });
    // uppsamlingsbandets rörelse
    // ---- allt på golvet i djupordning ----
    const items = [];
    const add = (fy, fn) => items.push({ fy, fn });
    const inView = (x0, x1) => x1 > cx - 8 && x0 < cx + vw + 8;
    const img = (sp, fy) => { if (inView(sp.x, sp.x + sp.img.width)) add(fy, () => ctx.drawImage(sp.img, sp.x, sp.y)); };
    if (inView(HATCH.x0, BELT.x1)) {
      add(99, () => {
        ctx.drawImage(S.belt.img, S.belt.x, S.belt.y);
        ctx.fillStyle = '#4a4c54';
        for (let x = BELT.x0 + ((-(t * 24) % 8 + 8) % 8); x < BELT.x1; x += 8) ctx.fillRect(Math.round(x), 92, 1, 3);
        for (const b of beltBags) if (b.ph === 'belt') ctx.drawImage(lyingBag(b.ci, b.ci % 3), Math.round(b.x) - 7, Math.round(b.y) - 8);
        ctx.drawImage(S.hatch.img, S.hatch.x, S.hatch.y);
      });
      DESKS.forEach((D, k) => {
        const ds = deskState[k];
        add(DESK_Y - 0.4, () => {
          ctx.drawImage(S.scales[k].img, S.scales[k].x, S.scales[k].y);
          const active = beltBags.some((b) => b.k === k && b.ph === 'up');
          if (active) { ctx.fillStyle = '#4a4c54'; for (let y = WALL_Y + 1 + (Math.floor(t * 30) % 4); y < WALL_Y + 22; y += 4) ctx.fillRect(D.sx0 + 2, y, 16, 1); }
          for (const b of beltBags) if (b.k === k && b.ph !== 'belt') ctx.drawImage(upCase(b.ci, false), Math.round(b.x) - 5, Math.round(b.y) - 15);
        });
        if (ds.open) add(AGENT_Y, () => drawPerson(ctx, agents[k].x, agents[k].y, agents[k].look, ds.pax && ds.pax.state === 'atDesk' ? 'down' : (Math.sin(t * 0.3 + k * 2) > 0.8 ? 'left' : 'down'), Math.sin(t * 1.3 + k) > 0.9 ? 4 : 0));
        add(DESK_Y, () => {
          ctx.drawImage(S.desks[k].img, S.desks[k].x, S.desks[k].y);
          if (!ds.open) { ctx.fillStyle = '#16161a'; ctx.fillRect(D.x0 + 10, DESK_Y - 21, 30, 7); ctext(ctx, 'STÄNGD', D.x0 + 13, DESK_Y - 20, '#ff5a4a'); }
        });
      });
      img(S.lane, LANE.bar);
    }
    img(S.xray, SEC.y);
    if (inView(XRAY.x0, XRAY.x1)) add(SEC.y + 0.5, () => {
      ctx.drawImage(S.xbelt.img, S.xbelt.x, S.xbelt.y);
      ctx.fillStyle = '#4a4c54'; for (let y = SEC.y + 2 + (Math.floor(t * 9) % 4); y < SEC.y + 24; y += 4) ctx.fillRect(XRAY.x0 + 6, 164 - (y - SEC.y), 20, 1);
      for (const tr of trays) {
        const y = Math.round(tr.y);
        ctx.fillStyle = '#6a7078'; ctx.fillRect(XRAY.x0 + 7, y - 1, 18, 4); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(XRAY.x0 + 7, y - 2, 18, 1);
        ctx.fillStyle = rgb(tr.c); ctx.fillRect(XRAY.x0 + 10 + tr.k * 3, y - 4, tr.k === 1 ? 10 : 6, 3);
      }
      ctx.fillStyle = '#16181c'; ctx.fillRect(XRAY.x0 + 8, 125, 20, 1);
    });
    img(S.trays, 172); img(S.guardDesk, 118); img(S.gLeft, SEC.y - 0.2); img(S.gFront, SEC.y + 0.1); img(S.liquid, 196);
    for (const seg of S.gRight) img(seg, seg.fy);
    if (inView(ARCH.p0, ARCH.p1 + 4)) add(SEC.y + 0.2, () => {
      ctx.drawImage(S.arch.img, S.arch.x, S.arch.y);
      const on = t - archFlash < 0.8;
      ctx.fillStyle = on ? (archRed ? (Math.floor(t * 10) % 2 ? '#ff3a2a' : '#5a1a14') : '#5aff8a') : '#2a3a2e';
      ctx.fillRect(ARCH.p0 + 8, 102, 6, 2);
      for (let y = 106; y < 138; y += 3) { ctx.fillStyle = on ? (archRed ? '#ff5a4a' : '#6aff9a') : '#3a6a4a'; ctx.fillRect(ARCH.p0 + 3, y, 1, 1); ctx.fillRect(ARCH.p1, y, 1, 1); }
    });
    // karusellen
    if (inView(CAR.cx - 100, CAR.cx + 100)) add(CAR.cy - 6, () => {
      ctx.drawImage(carRing(Math.floor(((carPhase * 64) % 1) * 6)), S.carBase.x, S.carBase.y);
      ctx.drawImage(S.chute.img, S.chute.x, S.chute.y);
      for (const b of carBags) if (b.ph === 'chute') ctx.drawImage(lyingBag(b.ci, b.st), CAR.cx - 7, Math.round(lerp(CHUTE.top, 124, b.p)) - 7);
      const sorted = carBags.filter((b) => b.ph === 'belt').map((b) => ({ b, p: bagPos(b.s) })).sort((a, b2) => a.p[1] - b2.p[1]);
      for (const { b, p } of sorted) if (p[2] < 0.25) ctx.drawImage(lyingBag(b.ci, b.st), Math.round(p[0]) - 7, Math.round(p[1]) - 7);
      ctx.drawImage(S.island.img, S.island.x, S.island.y);
      for (const { b, p } of sorted) if (p[2] >= 0.25) ctx.drawImage(lyingBag(b.ci, b.st), Math.round(p[0]) - 7, Math.round(p[1]) - 7);
    });
    // stolarna och de som sitter
    for (const B of BENCHES) {
      if (!inView(B.x - 8, B.x + B.n * 13)) continue;
      add(B.y - 0.5, () => ctx.drawImage(B.img.seat.img, B.img.seat.x, B.img.seat.y));
      if (B.img.rest) add(B.y + 0.5, () => ctx.drawImage(B.img.rest.img, B.img.rest.x, B.img.rest.y));
    }
    for (const s of seats) if (s.occ && inView(s.x - 10, s.x + 10)) add(s.y, () => drawSeated(ctx, s));
    GATES.forEach((gt, i) => img(S.podiums[i], 118));
    img(S.kiosk, KIOSK.y); for (const tb of S.tables) img(tb, 162);
    for (const p of S.plants) img(p, p.fy);
    for (const b of S.bins) img(b, b.fy);
    img(S.rack, 110); img(S.info, 127); img(S.charge, 206); img(S.lost, 186);
    // personalen
    // (den som pratar med figuren vänder sig mot den en stund)
    for (const st of staff) if (inView(st.x - 12, st.x + 12)) add(st.y, () => drawPerson(ctx, st.x, st.y, st.look, st.faceUntil > t ? st.faceDir : st.role === 'guard' && st.x === GUARD1.x ? (Math.sin(t * 0.5) > 0.6 ? 'up' : 'down') : st.dir, Math.sin(t * 1.4 + st.x) > 0.92 ? 4 : 0));
    if (inView(barista.x - 12, barista.x + 12)) add(barista.y, () => drawPerson(ctx, Math.round(barista.x), barista.y, barista.look, barista.dir, barista.walking ? WALK_SEQ[Math.floor(t * 8) % 4] : 0));
    // resenärerna
    for (const n of npcs) {
      if (n.hidden || n.state === 'sit' || !inView(n.x - 20, n.x + 20)) continue;
      add(n.y, () => drawWalking(ctx, n, n.role === 'kid' ? 11 : 8.5));
    }
    if (janitor.wet && inView(janitor.wet.x - 10, janitor.wet.x + 10)) add(janitor.wet.y, () => ctx.drawImage(wetImg, janitor.wet.x - 7, janitor.wet.y - 16));
    for (const d of folkDrawables(A, t)) add(d.fy, () => d.draw(ctx));
    if (me.state !== 'sit') {
      const sd = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length });
      const r = me.rise ? 1 - clamp(me.rise.k, 0, 1) : 0, ox = Math.round((me.rise?.ox || 0) * r), oy = Math.round((me.rise?.oy || 0) * r);
      add(walker.py + 0.01, () => { if (ox || oy) { ctx.save(); ctx.translate(ox, oy); sd.draw(ctx); ctx.restore(); } else sd.draw(ctx); });
    }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.fn();
    // Z från de som sover
    for (const p of parts) {
      const k = 1 - p.age / p.max;
      ctx.fillStyle = `rgba(244,241,234,${(k * 0.9).toFixed(2)})`;
      const zx = Math.round(p.x), zy = Math.round(p.y);
      ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
    }
    // ---- kvällsljuset inne ----
    if (lamps > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = lamps * 0.4;
      ctx.fillStyle = '#c4bccc'; ctx.fillRect(cx, 0, vw, H);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = lamps * 0.6;
      ctx.drawImage(hallLight, cx, 0, vw, H, cx, 0, vw, H);
      ctx.restore();
    }
  }
  const api = {
    viewMax: { w: 640, h: H },
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return me.seat ? me.seat.y : walker.py; },
    update,
    // vyns bredd (A.W) är satt först när scenen är byggd – räkna kameran med den rätta
    // bredden direkt, annars glider den 20–130 px första sekunden
    enter() { syncView(A); snapCam(); },
    exit() { talk.clear(); pa.clear(); chat.clear(); },
    down(sx, sy) {
      const x = sx + cam.x, y = sy - ty; // skärm → värld (radbandet kan vara förskjutet)
      const wasSeat = me.seat;
      const h = spotAt(x, y);
      const who = npcAt(x, y);
      // en resenär vid karusellen, eller framför disken (under diskskivan), svarar själv –
      // klick högre upp på disken (incheckaren, skärmen, skylten) går till disken
      const npcFirst = who && who.role !== 'agent' && (h?.id === 'karusell' || (h?.id.startsWith('disk') && y > DESK_Y - 12));
      if (h && !npcFirst) {
        if (me.state === 'sit') standUp();
        release();
        const [gx, gy] = h.go(x);
        walker.walkTo(gx, gy, h.act);
        return;
      }
      const s = seatAt(x, y);
      // en ledig stol mitt under pekaren går före folk som råkar springa förbi
      if (s && !s.occ && Math.abs(x - s.x) < 5 && s !== wasSeat) { if (me.state === 'sit') standUp(); goSit(s); return; }
      if (who) { talkTo(who); return; }
      if (s && s === wasSeat) { standUp(); return; }
      if (s && !s.occ) { if (me.state === 'sit') standUp(); goSit(s); return; }
      if (me.state === 'sit') standUp();
      release();
      if (y < WALL_Y && inGlassX(x)) {
        // fram till fönstret och titta ut
        walker.walkTo(x, WALL_Y + 6, () => { walker.dir = 'up'; say(farPlane && farPlane.kind === 'land' ? 'Titta, ett plan landar! ✈️' : farPlane ? 'Där lyfter ett plan!' : pick(L_WINDOW), meAt, 3); });
        return;
      }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) {
      const x = sx + cam.x, y = sy - ty, h = spotAt(x, y);
      hoverId = h ? h.id : seatAt(x, y) && !seatAt(x, y).occ ? 'stol' : null;
      hoverT = t;
    },
    key(k) {
      if (k === 'Escape' && me.state === 'sit') standUp();
    },
    _debug: {
      // skärmkoordinater (det down(x, y) får): x − kameran, y + radförskjutningen
      spot(id) {
        if (id === 'diskar' || id === 'disk') id = 'disk' + Math.max(0, deskState.findIndex((d) => d.open));
        const h = hot.find((q) => q.id === id || (id === 'tavlan' && q.id === 'tavla'));
        if (h) return { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 + ty };
        if (id === 'stol' || id === 'stolar') { const s = seats.find((q) => !q.occ && q.dir === 'down' && q.air); return s ? { x: s.x - cam.x, y: s.y - 14 + ty, id: s.id } : null; }
        const s = seatById(id);
        return s ? { x: s.x - cam.x, y: s.y - 14 + ty } : null;
      },
      seats: () => seats.map((q) => ({ id: q.id, x: q.x - cam.x, y: q.y - 14 + ty, dir: q.dir, occ: q.occ === 'me' ? 'me' : q.occ ? 'npc' : null })),
      seated: () => (me.state === 'sit' && me.seat ? { seat: me.seat.id, x: me.seat.x, y: me.seat.y, dir: me.seat.dir } : null),
      sit(id) { const s = id ? seatById(id) : seats.find((q) => !q.occ && q.dir === 'down' && q.air); if (!s || (s.occ && s.occ !== 'me')) return false; if (me.state === 'sit') standUp(); me.rise = null; walker.px = s.ax; walker.py = s.ay; sitDown(s); me.slide = null; syncView(A); snapCam(); return s.id; },
      lockCam(x) { syncView(A); lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); snapCam(); },
      teleport(x, y) { if (me.state === 'sit') standUp(); me.rise = null; walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); syncView(A); snapCam(); },
      tick(sec) { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      cam: () => cam.x,
      camY: () => ({ y: cam.y, ty, band: band() }),
      // bortre planet: kind 'land'|'dep', tau = sekunder in i förloppet → läget i världen
      // bortre planet: kind 'land'|'dep', tau = sekunder in i förloppet, liv = färg, dir = ±1,
      // at = sättning/startpunkt i VÄRLDENS x (valfritt) → läget i världen
      far(kind = 'land', tau = 5, liv = null, dir = -1, at = null) {
        startFar(kind, tau, dir < 0 ? -1 : 1, at === null ? null : at - Math.round(cam.x * 0.5));
        if (liv !== null) farPlane.liv = liv | 0;
        const s = farState(farPlane);
        return { x: s.x + Math.round(cam.x * 0.5), y: s.y, gear: s.gear, pitch: s.pitch };
      },
      rs(tau) { rsT = tau; return rsState(); },
      tanker(tau) { tkT = tau; return tankState(); },
      state: () => ({ me: me.state, seat: me.seat?.id || null, x: Math.round(walker.px), y: Math.round(walker.py), npcs: npcs.length, queue: queue.length, bags: carBags.length, far: farPlane ? farPlane.kind : null, say: talk.text(), pa: pa.text(), door: +doorOpen.toFixed(2), mode: modeOf(hourNow()) }),
      announce: () => { announce(true); return pa.text(); },
      // utsiktens lager för ett ljusläge (för förhandsbilder)
      layers(mode = 'dag') { return { far: farImg(mode).img.toDataURL(), near: nearImg(mode).img.toDataURL() }; },
      panorama() {
        const c = mkCanvas(W, H), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W);
        chat.draw(x, { x0: 0, x1: W }); talk.draw(x, { x0: 0, x1: W }); pa.draw(x, { x0: 0, x1: W });
        return c.toDataURL('image/png');
      },
    },
    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x);
      ty = band().y0 - Math.round(cam.y);
      if (ty !== 0) {
        // radbandet är förskjutet (mobilens fyll-läge): raderna utanför hallen – som ändå
        // ligger under beskärningen – får taket/golvets mörka ton i stället för skräp
        ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
        ctx.fillStyle = '#17151a'; ctx.fillRect(0, 0, VW, Math.max(H, A.H || H));
      }
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, ty * A.pxs);
      drawWorld(ctx, cx, VW);
      const cp = typeof chatAt === 'function' ? chatAt() : chatAt;
      if (cp && cp.x > cx - 2 && cp.x < cx + VW + 2) chat.draw(ctx, { x0: cx, x1: cx + VW });
      pa.draw(ctx, { x0: cx, x1: cx + VW });
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      // skylt i nederkanten när man pekar på något
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const h = hoverId && t - hoverT < 3 ? hoverId : null;
      const label = { dorr: 'UTGÅNG - TILL STADEN', incheckning: 'STATIONSCHEFEN - JOBBA I INCHECKNINGEN', disk0: 'DISK 1 - JOBBA I INCHECKNINGEN', disk1: 'DISK 2 - JOBBA I INCHECKNINGEN', disk2: 'DISK 3 - JOBBA I INCHECKNINGEN', disk3: 'DISK 4 - JOBBA I INCHECKNINGEN', band: 'BAGAGECHEFEN - JOBBA VID BANDET', karusell: 'BAGAGEBAND 1', tavla: 'AVGÅNGAR', uttag: 'UTTAGSAUTOMAT', info: 'INFORMATION', kiosk: 'PIXEL KAFFE - ÖPPET DYGNET RUNT', wc: 'TOALETTER', gateA1: 'GATE A1', gateA2: 'GATE A2', stol: 'SÄTT DIG' }[h] || null;
      if (label) {
        const safe = globalThis.SF?.view?.safe || { y1: H };
        const by = Math.min(H, safe.y1) - 14, w = textW(SMALL, label) + 10;
        ctx.fillStyle = '#17151a'; ctx.fillRect((VW - w) >> 1, by, w, 11);
        ctx.fillStyle = '#e8b230'; ctx.fillRect(((VW - w) >> 1) + 1, by + 1, w - 2, 1);
        ctxText(ctx, SMALL, label, ((VW - w) >> 1) + 5, by + 4, '#f4f1ea');
      }
    },
  };
  return api;
}
