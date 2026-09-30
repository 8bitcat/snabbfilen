// Tvätteriet – tvätta, torka, vik och lämna tillbaka! Kunderna tar en
// nummerlapp i automaten, lämnar sin tvättpåse på disken och sätter sig på
// väntbänken med lappen i en pratbubbla. Bär påsen till en maskin med rätt
// program (VITT 60, KULÖRT 40, MÖRKT 30) – fel maskin ger missfärgad tvätt.
// När maskinen är klar hämtar du den blöta tvätten, torkar den i en
// torktumlare, viker den på vikbordet och lämnar påsen till kunden med samma
// nummer. Fel påse blir fel, kunder som väntar för länge går hem.
//
// Lokalen ritas på Burgarbarens nivå: kakelvägg med hyllor fulla av tvättmedel,
// hängande skyltar med tvättsymboler, sex frontmatare med runda luckor (trumman
// snurrar åt båda hållen, vattnet skvalpar, skummet bubblar, centrifugen skakar),
// staplade torktumlare med varmt sken, nummerlappsautomat och NU-tavla, vikbord
// med tvättkorgar under, strykbräda där en kollega stryker (ånga), klädhängare
// med kemtvätt i plast och en väntbänk. Allt statiskt målas en gång och cachas;
// bara det som rör sig ritas varje bildruta. Ett pixelkorn: heltal, skala 1.
//
// Figuren ställer sig alltid snett vid sidan om det hen jobbar med (springan
// till höger om tvättmaskinen, springan mellan tumlarkolumnerna, bredvid kunden
// på bänken) så att luckor, displayer, nummerlappar och kunder syns. Maskinernas
// puffar dyker upp under maskinen vid golvet, inte över skyltarna. Klick under
// vikningen köas och utförs när påsen är knuten.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { FRAMES } from '../data/frames.js';
import { ATLAS } from '../scenes/room.js';

const FW = 384, FH = 216;
const FLOOR_Y = 98;                 // första golvraden
const WHITE = 0xffffff, INK = 0x17151a;

// ---------- tvättprogrammen ----------
// Varje påse är en sorts tvätt. Fel program färgar av sig: vitt blir rosa i
// kulörtvätten och grått i mörkt, kulört bleks i 60 grader, och så vidare.
const CLS = [
  { name: 'VITT', temp: '60', board: 0xf4f6f8, ink: 0x2c6fb7, cols: [0xf6f4ee, 0xeef2f8, 0xfaf3e2, 0xf2f2f4] },
  { name: 'KULÖRT', temp: '40', board: 0xffd86a, ink: 0x7a3a10, cols: [0xe0463c, 0xf2b630, 0x3f9e4c, 0x3a7bd5, 0xe07a2e, 0x8e5bd1, 0xe86aa0] },
  { name: 'MÖRKT', temp: '30', board: 0x2d3a5c, ink: 0xf4f1ea, cols: [0x2b2b36, 0x2d3a5c, 0x46464e, 0x3a2e28, 0x26402e] },
];
const STAIN = [
  (c) => mix(c, 0xe6dcc0, 0.62),   // 60 grader: bleks och gulnar
  (c) => mix(c, 0xe0487c, 0.58),   // kulört: rosa
  (c) => mix(c, 0x4a4660, 0.6),    // mörkt: grått
];
const SACKS = [0xd8c8a8, 0x9cc4e4, 0xe8a8b8, 0xbcd88e, 0xe8d070, 0xc8b0e0];

// ---------- tider (sekunder verklig tid; 1 s = 4 speltidsminuter) ----------
const WASH_T = 5.2, SPIN_T = 1.3, DRY_T = 4.2, FOLD_T = 1.5;

// ---------- lokalens mått ----------
const COUNTER = { x0: 20, x1: 92, top: 67, surf: 72, base: 97 };
const CSLOTS = [33, 55, 77];                       // tre platser på inlämningsdisken
const WASHERS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 96 + i * 34, y: 57, w: 32, h: 41, cls: i >> 1 }));
const DRYERS = [{ x: 302, y: 40 }, { x: 342, y: 40 }, { x: 302, y: 69 }, { x: 342, y: 69 }].map((d) => ({ ...d, w: 36, h: 29 }));
// Var man står vid maskinerna: snett vid sidan om luckan, så att trumma, display
// och nummerlapp syns medan man jobbar. Vid tvättmaskinen i springan till höger
// (vid handtaget, vänd åt vänster), vid torktumlarna i springan mellan kolumnerna.
const STAND_Y = FLOOR_Y + 8;
const washerStandX = (w) => w.x + w.w + 1;
const DRYER_STAND_X = DRYERS[0].x + DRYERS[0].w + 2;
// Maskinernas puffar ("VITT!", "TORKAR!", …) dyker upp under maskinen vid golvlisten
// och stiger över sockeln – aldrig över skyltarna eller displayerna.
const POP_Y = FLOOR_Y + 2;
const SIGNS = [0, 1, 2].map((c) => ({ c, x: 96 + c * 68 + 33 - 25, y: 41, w: 50, h: 13 }));
const TABLE = { x0: 136, x1: 232, top: 142, fy: 168 };
const TSLOTS = [158, 184, 210];                    // vikbordets tre platser
const WORK_Y = TABLE.top - 6;                      // där man står bakom vikbordet
const SEATS = [26, 50, 74, 98], SEAT_Y = 188;      // väntbänken (fötternas y)
const BENCH = { x0: 12, x1: 112 };
const IN_Y = 114, OUT_Y = 206;                     // dörrmattorna i vänsterkanten
const AUTO = { x: 12, top: 47, base: 102 };        // nummerlappsautomaten på sin stolpe
const IRON = { x0: 252, x1: 306, y: 160, cx: 278 }; // strykbrädan (benens golvrad)
const RACK = { x0: 318, x1: 378, fy: 206 };        // klädhängaren
const SIGN_FLOOR = { x: 212, fy: 130 };            // HALT GOLV-skylten vid pölen
const PLANT = { x: 290, fy: 212 };
const CART = { x: 150, fy: 206 };                  // tvättvagnen på hjul

const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lite = (c, k = 0.32) => mix(c, WHITE, k);
function pixelsToCanvas(grid, w, h) {
  const c = newCanvas(w, h), x2 = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = grid[y * w + x];
    if (v === -1 || v === undefined) continue;
    x2.fillStyle = typeof v === 'string' ? v : css(v);
    x2.fillRect(x, y, 1, 1);
  }
  return c;
}
// karta + färgfunktion → canvas med 1 px "sel-out"-kontur (mörkare ton av grannen)
function shapeSprite(map, colorAt, outline = true) {
  const w = Math.max(...map.map((r) => r.length)) + 2, h = map.length + 2;
  const g = new Array(w * h).fill(-1);
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) { if (row[x] === '.') continue; const v = colorAt(row[x], x, y); if (v !== undefined && v !== null) g[(y + 1) * w + x + 1] = v; } });
  if (outline) {
    const src = g.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== -1) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || src[yy * w + xx] === -1 || typeof src[yy * w + xx] === 'string') continue;
        g[y * w + x] = mix(mul(src[yy * w + xx], 0.42), 0x1c1418, 0.4);
        break;
      }
    }
  }
  return pixelsToCanvas(g, w, h);
}
// deterministisk slump (kollegan ser likadan ut varje pass)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ======================= tvätten: plaggens färger =======================
// o.g = tre plaggfärger. o.dye 0→1 = hur mycket de färgats av (fel maskin).
function gcol(o, k) { const c = o.g[k]; return o.stained && o.dye > 0 ? mix(c, STAIN[o.dyed](c), o.dye) : c; }

// ---------- små sprites (kartor i skala 1) ----------
// Tvättpåsen: tygsäck med dragsko, plaggen sticker upp ur öppningen.
const BAG_MAP = [
  '.....11..3.....',
  '....1112233....',
  '...x11122233z..',
  '....kkkkKkkk...',
  '.....FffeE.k...',
  '....FFfffeE.k..',
  '...FFffffffeK..',
  '..FFfffffffee..',
  '..Fffffffffffe.',
  '.FFfffffffffee.',
  '.FfffSffffffee.',
  '.FffffSfffffee.',
  '.Fffffffffffee.',
  '..effffffffeeE.',
  '...EEeeeeeeEE..',
];
// Tvättkorgen (blöt eller torr tvätt uppe i korgen)
const BASKET_MAP = [
  '......1122........',
  '....x11122233z....',
  '..x1111222223333z.',
  'hRRRRRRRRRRRRRRRRh',
  'hBbBbBbBbBbBbBbBBh',
  '.BBBBBBBBBBBBBBBB.',
  '.BbBbBbBbBbBbBbBB.',
  '.BBBBBBBBBBBBBBBB.',
  '..DDDDDDDDDDDDDD..',
];
// Den färdiga påsen: tre vikta plagg i en plastpåse, knuten upptill
const FOLD_MAP = [
  '.....ptp......',
  '....pP.Pp.....',
  '.pPPPPPPPPPPp.',
  '.P1111111111p.',
  '.Pa11111111ap.',
  '.P2222222222p.',
  '.Pb22222222bp.',
  '.P3333333333p.',
  '.Pc33333333cp.',
  '.Pdddddddddp..',
  '..pppppppppp..',
];
// T-tröjan (ikon i bubblor och på skyltar)
const TEE_MAP = [
  '...aab.bcc...',
  '.aabbbnbbbcc.',
  'abbbbbbbbbbbc',
  'abbbbbbbbbbcc',
  '.cc.abbbbc.cd',
  '....abbbbc...',
  '....abbbbc...',
  '....abbbbcc..',
  '....cccccd...',
];
function bagSprite(o) {
  if (o._bag) return o._bag;
  const s = o.sack;
  return (o._bag = shapeSprite(BAG_MAP, (ch) => {
    switch (ch) {
      case '1': return o.g[0]; case '2': return o.g[1]; case '3': return o.g[2];
      case 'x': return mul(o.g[0], 0.72); case 'z': return mul(o.g[2], 0.72);
      case 'k': return 0xf4f1ea; case 'K': return 0xc8323a;
      case 'F': return lite(s, 0.35); case 'f': return s; case 'e': return mul(s, 0.82); case 'E': return mul(s, 0.64);
      case 'S': return mul(s, 0.9);
      default: return undefined;
    }
  }));
}
function basketSprite(o, wet) {
  const key = (wet ? '_wet' : '_dry') + (o.stained ? 's' : '');
  if (o[key]) return o[key];
  const col = (k) => { const c = gcol(o, k); return wet ? mix(mul(c, 0.82), 0x3a6aa0, 0.12) : lite(c, 0.08); };
  return (o[key] = shapeSprite(BASKET_MAP, (ch, x) => {
    switch (ch) {
      case '1': return col(0); case '2': return col(1); case '3': return col(2);
      case 'x': return mul(col(0), 0.72); case 'z': return mul(col(2), 0.72);
      case 'h': return 0x2c6fb0; case 'R': return 0x9ad4f4; case 'B': return x < 3 ? 0x6ab8ea : 0x4aa0dc; case 'b': return 0x1e4e7e;
      case 'D': return 0x2c6fb0;
      default: return undefined;
    }
  }));
}
function foldedSprite(o) {
  const key = '_fold' + (o.stained ? 's' : '');
  if (o[key]) return o[key];
  const L = [gcol(o, 0), gcol(o, 1), gcol(o, 2)];
  return (o[key] = shapeSprite(FOLD_MAP, (ch, x, y) => {
    switch (ch) {
      case '1': return y === 3 ? lite(L[0], 0.25) : L[0]; case '2': return y === 5 ? lite(L[1], 0.25) : L[1]; case '3': return y === 7 ? lite(L[2], 0.25) : L[2];
      case 'a': return mul(L[0], 0.7); case 'b': return mul(L[1], 0.7); case 'c': return mul(L[2], 0.7);
      case 'd': return mul(L[2], 0.55);
      case 'P': return 0xe4f2fc; case 'p': return 0x9ab8cc; case 't': return 0xf4f1ea;
      default: return undefined;
    }
  }));
}
const TEE = [];
function teeSprite(c) {
  if (TEE[c]) return TEE[c];
  const stripes = [0xe0463c, 0xf2b630, 0x3f9e4c, 0x3a7bd5];
  const base = (y) => (c === 0 ? 0xf8f8f4 : c === 2 ? 0x2d3a5c : stripes[(y >> 1) % 4]);
  return (TEE[c] = shapeSprite(TEE_MAP, (ch, x, y) => {
    const b = base(y);
    switch (ch) {
      case 'a': return lite(b, 0.35); case 'b': return b;
      case 'c': return c === 0 ? 0xc8ccd8 : mul(b, 0.74); case 'd': return c === 0 ? 0xa4aabb : mul(b, 0.56);
      case 'n': return c === 0 ? 0x9aa0b0 : mul(b, 0.45);
      default: return undefined;
    }
  }));
}

// ---------- nummerlappar ----------
// liten lapp (11×9) med nummer, som hänger på påsar, korgar och luckor:
// mörk kant, krämvit yta med en pixels marginal runt siffrorna, snöre upptill
function drawTag(ctx, x, y, num, str = true) {
  if (str) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 5, y - 2, 1, 2); }
  ctx.fillStyle = '#6a2230'; ctx.fillRect(x + 1, y, 9, 9); ctx.fillRect(x, y + 1, 11, 7);
  ctx.fillStyle = '#fff6e8'; ctx.fillRect(x + 1, y + 1, 9, 7);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 8, 1);
  ctx.fillStyle = '#e8d8c4'; ctx.fillRect(x + 1, y + 7, 9, 1);
  ctx.fillStyle = '#6a2230'; ctx.fillRect(x + 5, y + 1, 1, 1);          // hålet för snöret
  ctxText(ctx, SMALL, String(num).padStart(2, '0'), x + 2, y + 2, '#c8202e');
}
// stor lapp (16×12) i kundens pratbubbla: rosa kant, riven överkant, stora siffror
function drawTicket(ctx, x, y, num) {
  ctx.fillStyle = '#9a2a3a'; ctx.fillRect(x, y + 1, 16, 11); ctx.fillRect(x + 1, y, 14, 12);
  ctx.fillStyle = '#fff6ea'; ctx.fillRect(x + 1, y + 1, 14, 10);
  ctx.fillStyle = '#f29ab0'; ctx.fillRect(x + 1, y + 1, 14, 1);
  for (let i = 1; i < 15; i += 2) { ctx.fillStyle = '#9a2a3a'; ctx.fillRect(x + i, y, 1, 1); }
  ctx.fillStyle = '#e8d8c4'; ctx.fillRect(x + 1, y + 10, 14, 1);
  ctxText(ctx, BIG, String(num).padStart(2, '0'), x + 3, y + 3, '#c8202e');
}

// ---------- pratbubblan (samma form som i Burgarbaren) ----------
function bubble(ctx, cx, tip, iw, ih, hot = false) {
  const w = iw + 2, h = ih + 2, x0 = cx - (w >> 1), y0 = tip - 2 - h;
  ctx.fillStyle = hot ? '#e8b230' : '#17151a';
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.fillRect(cx - 1, tip - 2, 3, 2); ctx.fillRect(cx, tip, 1, 1);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  ctx.fillRect(cx, tip - 2, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
  if (hot) { ctx.fillStyle = '#ffe07a'; ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3); }
  return [x0 + 1, y0 + 1];
}

// ======================= trumman i luckan =======================
// Cachad grund (stål med radiell skuggning) och glasöverlägg (kant + glans)
// per radie; hålen, plaggen, vattnet och skummet ritas ovanpå varje bildruta.
const DRUM = {};
function drumLayers(R, warm) {
  const key = R + (warm ? 'w' : 'c');
  if (DRUM[key]) return DRUM[key];
  const S = R * 2, base = new Pix(S, S), over = new Pix(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i + 0.5 - R, dy = j + 0.5 - R, d = Math.hypot(dx, dy);
    if (d > R) continue;
    const q = d / R;
    let c = warm ? mix(0x6a5a52, 0x2a2224, q * q) : mix(0x6a7684, 0x262c34, q * q);
    c = mix(c, 0, (bayer(i, j) - 0.5) * 0.08);
    // trummans nav i mitten
    if (d < 1.6) c = warm ? 0x8a7a70 : 0x8a96a4;
    base.px(i, j, c);
    // glaskant: mörk ring innerst mot packningen
    if (d > R - 1) over.px(i, j, 0x0e1016, 0.55);
    else if (d > R - 2) over.px(i, j, 0x0e1016, 0.2);
    // glans uppe till vänster (en böjd strimma)
    const a = Math.atan2(dy, dx);
    if (d > R - 3.2 && d < R - 1.6 && a > -2.75 && a < -1.75) over.px(i, j, WHITE, 0.55);
  }
  over.px(R - 3, R - 4, WHITE, 0.8); over.px(R - 4, R - 3, WHITE, 0.4);
  return (DRUM[key] = { base: base.flush(), over: over.flush() });
}
// (gx, gy) = glasets övre vänstra hörn (heltal); R = radie
function drawDrum(ctx, gx, gy, R, m, t, dryer) {
  const L = drumLayers(R, dryer);
  ctx.drawImage(L.base, gx, gy);
  const C = R, inC = (px, py) => Math.hypot(px + 0.5 - C, py + 0.5 - C) <= R - 0.6;
  // hålen i trumman roterar med
  ctx.fillStyle = dryer ? '#1e1618' : '#1a1e26';
  const holes = R >= 8 ? 10 : 8;
  for (let k = 0; k < holes; k++) {
    const a = m.rot + k * (Math.PI * 2 / holes), rr = R - 2.4;
    const hx = Math.floor(C + Math.cos(a) * rr), hy = Math.floor(C + Math.sin(a) * rr);
    if (inC(hx, hy)) ctx.fillRect(gx + hx, gy + hy, 1, 1);
  }
  for (let k = 0; k < 3; k++) {       // medbringarna (ljusa klackar)
    const a = m.rot + k * (Math.PI * 2 / 3) + 0.5, rr = R - 1.6;
    const hx = Math.floor(C + Math.cos(a) * rr), hy = Math.floor(C + Math.sin(a) * rr);
    if (inC(hx, hy)) { ctx.fillStyle = dryer ? '#b8a898' : '#b4c0cc'; ctx.fillRect(gx + hx, gy + hy, 1, 1); }
  }
  const o = m.o;
  const running = m.state === 'run';
  // varmt sken i torktumlaren
  if (dryer && running) {
    const gl = 0.22 + 0.08 * Math.sin(t * 5 + m.x);
    for (let j = 0; j < 2 * R; j++) {
      const dy = j + 0.5 - C; if (dy < -1) continue;
      const hw = Math.sqrt(Math.max(0, R * R - dy * dy)) - 0.6, x0 = Math.round(C - hw), x1 = Math.round(C + hw);
      ctx.fillStyle = `rgba(255,150,60,${(gl * (0.4 + dy / R)).toFixed(2)})`;
      ctx.fillRect(gx + x0, gy + j, x1 - x0, 1);
    }
  }
  if (o) {
    // plaggens lägen
    const spin = !dryer && running && m.tt > WASH_T - SPIN_T;
    const pos = [];
    for (let k = 0; k < 3; k++) {
      let bx, by;
      if (!running) { bx = (k - 1) * 3.2; by = R - 3.4 - (k === 1 ? 1 : 0); }
      else if (spin) { const a = m.rot + k * 2.09; bx = Math.cos(a) * (R - 2.2); by = Math.sin(a) * (R - 2.2); }
      else if (dryer) {
        // torktumling: plagget följer trumman upp längs väggen och faller ner
        const rr = R - 3, ph = (m.rot * 0.28 + k / 3) % 1;
        if (ph < 0.62) { const a = Math.PI / 2 + (ph / 0.62) * Math.PI * 0.9; bx = Math.cos(a) * rr; by = Math.sin(a) * rr; }
        else { const q = (ph - 0.62) / 0.38, a0 = Math.PI * 1.4; const x0 = Math.cos(a0) * rr, y0 = Math.sin(a0) * rr; bx = x0 * (1 - q) + (k - 1) * 1.5 * q; by = y0 + (rr - y0) * q * q; }
      } else {
        const a = m.rot * 0.9 + k * 2.09, rr = 2.6 + Math.sin(t * 3 + k * 2) * 1.2;
        bx = Math.cos(a) * rr; by = Math.sin(a) * rr + 1;
      }
      pos.push([bx, by]);
    }
    for (let k = 0; k < 3; k++) {
      const c0 = gcol(o, k), [bx, by] = pos[k];
      const rad = spin ? 1.5 : 2.2;
      for (let j = Math.floor(by - rad); j <= by + rad; j++) for (let i = Math.floor(bx - rad); i <= bx + rad; i++) {
        const ddx = i + 0.5 - bx, ddy = j + 0.5 - by;
        if (ddx * ddx + ddy * ddy > rad * rad) continue;
        const px = Math.floor(C + i), py = Math.floor(C + j);
        if (px < 0 || py < 0 || px >= 2 * R || py >= 2 * R || !inC(px, py)) continue;
        let c = ddx + ddy < -1.2 ? lite(c0, 0.28) : ddx + ddy > 1.2 ? mul(c0, 0.72) : c0;
        if (!dryer && (running || m.state === 'done')) c = mul(c, 0.9);
        ctx.fillStyle = css(c); ctx.fillRect(gx + px, gy + py, 1, 1);
      }
    }
    if (spin) {       // centrifugen: plaggen blir en suddig färgring
      for (let k = 0; k < 18; k++) {
        const a = m.rot * 1.3 + k * 0.35, rr = R - 1.9;
        const px = Math.floor(C + Math.cos(a) * rr), py = Math.floor(C + Math.sin(a) * rr);
        if (!inC(px, py)) continue;
        ctx.fillStyle = css(gcol(o, k % 3)); ctx.fillRect(gx + px, gy + py, 1, 1);
      }
    }
    // vattnet och skummet (bara i tvättmaskinen under tvätt)
    if (!dryer && running && !spin) {
      const wl = 1.2 + Math.sin(t * 4.2 + m.x) * 0.9 + Math.sin(m.rot) * 0.5;
      for (let j = 0; j < 2 * R; j++) {
        const dy = j + 0.5 - C;
        if (dy < wl) continue;
        const hw = Math.sqrt(Math.max(0, R * R - dy * dy)) - 0.6, x0 = Math.round(C - hw), x1 = Math.round(C + hw);
        if (x1 <= x0) continue;
        ctx.fillStyle = 'rgba(70,140,220,0.42)'; ctx.fillRect(gx + x0, gy + j, x1 - x0, 1);
        if (dy - wl < 1) { ctx.fillStyle = 'rgba(190,225,255,0.7)'; ctx.fillRect(gx + x0, gy + j, x1 - x0, 1); }
      }
      // skummet på ytan: små bubblor som poppar
      const ft = (t * 7) | 0;
      for (let i = 1; i < 2 * R - 1; i++) {
        const h = hash(i, ft, m.x);
        if (h < 0.35) continue;
        const py = Math.floor(C + wl - 1 - (h > 0.8 ? 1 : 0)), px = i;
        if (!inC(px, py)) continue;
        ctx.fillStyle = h > 0.7 ? '#ffffff' : '#d8e8f4'; ctx.fillRect(gx + px, gy + py, 1, 1);
      }
      // en bubbla som stiger mot glaset
      const bp = (t * 0.9 + m.x * 0.01) % 1, bxx = Math.floor(C - 2 + Math.sin(t * 3 + m.x) * 2), byy = Math.floor(C + wl - 2 - bp * 4);
      if (inC(bxx, byy)) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(gx + bxx, gy + byy, 1, 1); }
    }
    // droppar på glaset när tvätten är klar
    if (!dryer && m.state === 'done') {
      ctx.fillStyle = 'rgba(200,230,255,0.75)';
      for (let k = 0; k < 6; k++) {
        const px = 2 + Math.floor(hash(k, m.x, 3) * (2 * R - 4)), py = 2 + Math.floor(hash(k, m.x, 5) * (R)) + ((t * 2 + k) % 3 | 0);
        if (inC(px, py)) ctx.fillRect(gx + px, gy + py, 1, 1);
      }
    }
  }
  ctx.drawImage(L.over, gx, gy);
}

// blinkande ring runt en lucka (KLAR = gul, "lägg här" = grön). (cx, cy) är
// luckans mitt i spritens koordinater, som i paintWasher/paintDryer.
const RINGS = {};
function ringSprite(w, h, cx, cy, r0, r1, col) {
  const key = [w, h, cx, cy, r0, r1, col].join();
  if (RINGS[key]) return RINGS[key];
  const P = new Pix(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
    if (d > r0 && d <= r1) P.px(i, j, col);
    else if (d > r1 && d <= r1 + 0.9) P.px(i, j, col, 0.35);
  }
  return (RINGS[key] = P.flush());
}
const washerRing = (col) => ringSprite(23, 23, 11.5, 11.5, 9.9, 10.9, col);   // ritas i (w.x + 4, w.y + 14)
const dryerRing = (col) => ringSprite(24, 23, 12, 11.5, 9.4, 10.4, col);      // ritas i (d.x + 6, d.y + 7)

// ======================= maskinernas kroppar (cachade) =======================
function paintWasher(cls) {
  const W = 32, H = 41, P = new Pix(W, H);
  const cx = 15.5, cy = 25.5;
  const OUT = 0x3a3f4c;
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
    if ((y === 0 && (x < 2 || x > W - 3)) || (y === 1 && (x === 0 || x === W - 1))) continue;
    let c;
    const edge = x === 0 || x === W - 1 || y === 0 || y === H - 2;
    if (edge) c = OUT;
    else if (y <= 3) c = y === 1 ? 0xffffff : y === 2 ? 0xf2f4f6 : 0xe2e6ea;              // locket
    else if (y === 4 || y === 13) c = 0x9aa4b0;                                            // skarvar
    else if (y <= 12) c = mix(0xeef1f4, 0xdde2e8, (y - 5) / 7 + (bayer(x, y) - 0.5) * 0.2); // panelen
    else if (y >= 36) c = y === 36 ? 0xaab2bc : mix(0xcdd3da, 0xb4bcc6, (y - 37) / 2);      // sockeln
    else c = mix(0xeef1f4, 0xdce0e5, (y - 14) / 22 + (bayer(x, y) - 0.5) * 0.14);           // fronten
    if (!edge && y > 4) {
      if (x === 1) c = mix(c, WHITE, 0.6); else if (x === 2) c = mix(c, WHITE, 0.25);
      else if (x === W - 3) c = mul(c, 0.93); else if (x === W - 2) c = mul(c, 0.84);
    }
    P.px(x, y, c);
  }
  // fötterna
  P.rect(2, H - 1, 3, 1, 0x22262e); P.rect(W - 5, H - 1, 3, 1, 0x22262e);
  // ventilationsspringor i sockeln
  for (let x = 6; x < W - 6; x += 2) P.px(x, 38, 0x7a8492);
  // programklisterlapp på locket (visar maskinens tvätt)
  const strip = cls === 0 ? [0xffffff, 0xd8e4f4] : cls === 1 ? [0xe0463c, 0xf2b630, 0x3f9e4c, 0x3a7bd5] : [0x2d3a5c, 0x1e2640];
  for (let i = 0; i < 10; i++) P.px(11 + i, 2, strip[(i >> (cls === 1 ? 1 : 2)) % strip.length]);
  P.hl(11, 3, 10, cls === 0 ? 0xb8c4d4 : mul(strip[0], 0.7));
  // tvättmedelsfacket
  P.rect(2, 6, 8, 6, 0xf6f8fa); P.box(2, 6, 8, 6, 0x98a2ae);
  P.hl(4, 10, 4, 0x5a6270); P.hl(4, 9, 4, 0xc4ccd4);
  P.px(3, 7, 0x3a7bd5); P.px(5, 7, 0x9aa4b0); P.px(7, 7, 0xe86aa0);
  // displayen (texten ritas varje bildruta)
  P.rect(11, 6, 17, 7, 0x2a3038); P.rect(12, 7, 15, 5, 0x16221e); P.hl(12, 7, 15, 0x1e2e28);
  // programvredet
  P.rect(28, 7, 3, 3, 0xb4bcc6); P.px(28, 7, 0xeef3f6); P.px(29, 7, 0xdfe5ea); P.px(30, 9, 0x6a747e); P.px(29, 8, 0x3a3f4c);
  // luckan: kromring, gummipackning, glaset (trumman ritas ovanpå)
  for (let y = 14; y < 36; y++) for (let x = 3; x < W - 3; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > 9.9 && d <= 10.8 && dx + dy > 0) { P.px(x, y, mul(P.get(x, y), 0.9)); continue; }  // försänkningens skugga
    if (d > 9.9 || d <= 7.6) continue;
    const light = (-dx - dy) / (d * 1.414);
    let c = mix(0x7a8490, 0xf8fafc, clamp(0.5 + 0.6 * light, 0, 1));
    if (d > 9.2) c = dx + dy > 0 ? 0x4a525e : 0x6a7480;
    else if (d <= 8.2) c = 0x2a2e36;                   // gummipackningen
    P.px(x, y, c);
  }
  // handtaget och gångjärnen
  P.rect(26, 22, 2, 8, 0x5a6270); P.vl(26, 22, 8, 0x8a94a0); P.px(26, 22, 0xc4ccd4);
  P.rect(4, 20, 2, 2, 0xaab2bc); P.rect(4, 30, 2, 2, 0xaab2bc); P.px(4, 20, 0xeef3f6); P.px(4, 30, 0xeef3f6);
  return P.flush();
}
function paintDryer() {
  const W = 36, H = 29, P = new Pix(W, H);
  const cx = 18, cy = 18.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((y === 0 || y === H - 1) && (x === 0 || x === W - 1)) continue;
    let c;
    const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1;
    if (edge) c = 0x3a3f4c;
    else if (y <= 7) c = y === 7 ? 0x6a7480 : mix(0x3a404a, 0x2a2e36, (y - 1) / 6);   // kontrollisten
    else {                                                                          // borstat stål
      c = mix(0xc8d0d8, 0xa2acb6, (y - 8) / 20);
      c = mix(c, hash(y, x >> 3, 11) > 0.5 ? WHITE : 0x6a7480, 0.05 + hash(y, 1, 3) * 0.04);
      if (x === 1) c = mix(c, WHITE, 0.5); else if (x === W - 2) c = mul(c, 0.84);
      if (y === 8) c = mix(c, WHITE, 0.4);
    }
    P.px(x, y, c);
  }
  // display (texten ritas varje bildruta), myntinkast, startknapp
  P.rect(3, 2, 17, 5, 0x160c0c); P.hl(3, 2, 17, 0x221414);
  P.rect(23, 2, 5, 5, 0xc4ccd4); P.rect(24, 3, 3, 3, 0x8e98a4); P.vl(25, 3, 3, 0x17151a); P.px(23, 2, 0xf4f6f8);
  P.rect(30, 3, 3, 3, 0x3fa04c); P.px(30, 3, 0x9ef0a0); P.px(32, 5, 0x1e6a2a);
  // luckan
  for (let y = 8; y < H - 1; y++) for (let x = 7; x < W - 7; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > 9.4 && d <= 10.2 && dx + dy > 0) { P.px(x, y, mul(P.get(x, y), 0.88)); continue; }
    if (d > 9.4 || d <= 7) continue;
    const light = (-dx - dy) / (d * 1.414);
    let c = mix(0x2a2e36, 0x5a6270, clamp(0.5 + 0.6 * light, 0, 1));   // svart ring
    if (d <= 7.6) c = mix(0x8a94a0, 0xf4f6f8, clamp(0.5 + 0.7 * light, 0, 1)); // kromkant
    if (d > 9) c = 0x22262e;
    P.px(x, y, c);
  }
  // handtag och en varningsdekal (VARMT)
  P.rect(28, 14, 2, 8, 0x3a3f4c); P.vl(28, 14, 8, 0x6a7480);
  P.px(32, 22, 0xf0c428); P.hl(31, 23, 3, 0xf0c428); P.hl(30, 24, 5, 0xf0c428); P.px(32, 23, 0x17151a);
  return P.flush();
}
const MACH = {};
const washerBody = (c) => (MACH['w' + c] ||= paintWasher(c));
const dryerBody = () => (MACH.d ||= paintDryer());

// ======================= rekvisita (cachade sprites) =======================
function paintTable() {
  // vikbordet: vit laminatskiva, kromben, hylla under med tvättkorgar
  const X0 = TABLE.x0 - 2, W = TABLE.x1 - TABLE.x0 + 4, top = TABLE.top - 8, H = TABLE.fy - top + 2;
  const P = new Pix(W, H, X0, top);
  const x0 = TABLE.x0, x1 = TABLE.x1, st = TABLE.top;
  // golvskugga
  P.ell((x0 + x1) / 2, TABLE.fy - 1, (x1 - x0) / 2 + 3, 3, 0x1a1a2a, 0.35, 3);
  // ben och hylla
  for (const lx of [x0 + 2, x1 - 4]) { P.rect(lx, st + 13, 2, TABLE.fy - st - 14, 0x8e98a4); P.vl(lx, st + 13, TABLE.fy - st - 14, 0xdfe5ea); }
  P.rect(x0 + 2, TABLE.fy - 9, x1 - x0 - 4, 2, 0xb4bcc6); P.hl(x0 + 2, TABLE.fy - 9, x1 - x0 - 4, 0xeef3f6); P.hl(x0 + 2, TABLE.fy - 7, x1 - x0 - 4, 0x5a6270);
  // tvättkorgar och ett paket tvättmedel på hyllan
  const basket = (bx, c) => {
    P.rect(bx, TABLE.fy - 16, 16, 7, c); P.hl(bx, TABLE.fy - 16, 16, lite(c, 0.4));
    for (let i = 1; i < 15; i += 2) P.px(bx + i, TABLE.fy - 14, mul(c, 0.55));
    for (let i = 2; i < 15; i += 2) P.px(bx + i, TABLE.fy - 12, mul(c, 0.55));
    P.hl(bx, TABLE.fy - 10, 16, mul(c, 0.7)); P.px(bx - 1, TABLE.fy - 15, mul(c, 0.6)); P.px(bx + 16, TABLE.fy - 15, mul(c, 0.6));
  };
  basket(x0 + 8, 0xe86aa0);
  P.rect(x0 + 10, TABLE.fy - 18, 5, 2, 0xf4f1ea); P.rect(x0 + 16, TABLE.fy - 17, 4, 1, 0x3a7bd5);
  basket(x0 + 28, 0x4aa0dc);
  P.rect(x0 + 31, TABLE.fy - 18, 6, 2, 0x2d3a5c); P.px(x0 + 37, TABLE.fy - 17, 0x46464e);
  P.rect(x1 - 26, TABLE.fy - 19, 9, 10, 0xe07a2e); P.hl(x1 - 26, TABLE.fy - 19, 9, 0xffb070); P.rect(x1 - 25, TABLE.fy - 16, 7, 3, 0xf4f1ea); P.px(x1 - 22, TABLE.fy - 15, 0x3a7bd5); P.vl(x1 - 18, TABLE.fy - 18, 9, 0xa04a14);
  P.rect(x1 - 14, TABLE.fy - 16, 8, 7, 0xf2f0ea); P.hl(x1 - 14, TABLE.fy - 16, 8, WHITE); P.hl(x1 - 14, TABLE.fy - 13, 8, 0xd8d4ca); P.hl(x1 - 14, TABLE.fy - 10, 8, 0xc8c2b4);
  // skivan
  for (let y = st; y < st + 13; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y === st) c = 0xc8c4bc;
    else if (y < st + 10) c = mix(0xf6f4ee, 0xe8e4da, (y - st) / 10 + (hash(x, y, 21) - 0.5) * 0.25);
    else if (y === st + 10) c = WHITE;
    else if (y === st + 11) c = 0xc4ccd4;
    else c = 0x6a7480;
    if (x === x0 || x === x1 - 1) c = mul(c, 0.8);
    P.px(x, y, c);
  }
  P.ell((x0 + x1) / 2, st + 4, 30, 3, WHITE, 0.4, 3);   // lysrörens reflex
  // vikta handdukar i en stapel till vänster, sprayflaska till höger
  const towel = (tx, ty, c) => { P.rect(tx, ty, 10, 2, c); P.hl(tx, ty, 10, lite(c, 0.35)); P.px(tx + 9, ty + 1, mul(c, 0.7)); P.px(tx, ty + 1, mul(c, 0.85)); };
  towel(x0 + 3, st + 6, 0x3a7bd5); towel(x0 + 3, st + 4, WHITE); towel(x0 + 3, st + 2, 0xe86aa0); towel(x0 + 3, st + 0, 0xf2b630);
  P.hl(x0 + 3, st + 8, 10, 0x9aa4b0);
  P.rect(x1 - 8, st - 3, 3, 8, 0x2aa39a); P.vl(x1 - 8, st - 3, 8, 0x7ae0d4); P.rect(x1 - 8, st - 6, 3, 3, WHITE); P.px(x1 - 5, st - 5, WHITE); P.hl(x1 - 8, st + 1, 3, 0xf4f1ea);
  P.hl(x1 - 8, st + 5, 4, 0x9aa4b0);
  return { cv: P.flush(), x: X0, y: top };
}
function paintBench() {
  // väntbänk i ek med kromben; ritas bakom kunderna
  const X0 = BENCH.x0 - 1, W = BENCH.x1 - BENCH.x0 + 2, top = SEAT_Y - 32, H = 34;
  const P = new Pix(W, H, X0, top);
  const x0 = BENCH.x0, x1 = BENCH.x1, sy = SEAT_Y - 14;
  P.ell((x0 + x1) / 2, SEAT_Y - 2, (x1 - x0) / 2 + 2, 3, 0x1a1a2a, 0.3, 3);
  // stolpar till ryggen
  for (const px of [x0 + 3, (x0 + x1) >> 1, x1 - 5]) { P.rect(px, SEAT_Y - 30, 2, 18, 0x6a7480); P.vl(px, SEAT_Y - 30, 18, 0xc4ccd4); }
  // ryggens ribbor
  for (const ry of [SEAT_Y - 29, SEAT_Y - 24, SEAT_Y - 19]) {
    for (let x = x0; x < x1; x++) {
      const g = hash(x >> 2, ry, 5) * 0.12;
      P.px(x, ry, mix(0xe0a868, WHITE, 0.2)); P.px(x, ry + 1, mix(0xc88a4c, 0x8a5428, g)); P.px(x, ry + 2, mix(0xb07438, 0x7a4a22, g)); P.px(x, ry + 3, 0x5a3418);
    }
  }
  // sitsen
  for (let y = sy; y < sy + 5; y++) for (let x = x0; x < x1; x++) {
    let c = y === sy ? 0xecc08a : y < sy + 3 ? mix(0xd49a5c, 0xb87c40, (y - sy) / 3 + (hash(x, y, 8) - 0.5) * 0.3) : y === sy + 3 ? 0x9a6030 : 0x5a3418;
    if ((x - x0) % 25 === 24) c = mul(c, 0.8);
    P.px(x, y, c);
  }
  // benen
  for (const px of [x0 + 3, (x0 + x1) >> 1, x1 - 5]) { P.rect(px, sy + 5, 2, SEAT_Y - sy - 6, 0x5a6270); P.vl(px, sy + 5, SEAT_Y - sy - 6, 0xaab2bc); P.hl(px - 1, SEAT_Y - 2, 4, 0x2a2e36); }
  return { cv: P.flush(), x: X0, y: top };
}
function paintIronBoard() {
  // strykbrädan: blommigt överdrag, X-ben, strykjärnshållare
  const X0 = IRON.x0 - 2, top = IRON.y - 22, W = IRON.x1 - IRON.x0 + 10, H = 24;
  const P = new Pix(W, H, X0, top);
  const x0 = IRON.x0, x1 = IRON.x1, by = IRON.y - 19;
  P.ell((x0 + x1) / 2, IRON.y - 1, (x1 - x0) / 2, 2, 0x1a1a2a, 0.3, 3);
  // X-benen: mörkt stålrör med en ljus kant, gummifötter
  P.line(x0 + 12, by + 5, x1 - 14, IRON.y - 2, 0x3a3f4c); P.line(x0 + 13, by + 5, x1 - 13, IRON.y - 2, 0x9aa4b0);
  P.line(x1 - 14, by + 5, x0 + 12, IRON.y - 2, 0x3a3f4c); P.line(x1 - 13, by + 5, x0 + 13, IRON.y - 2, 0x9aa4b0);
  P.rect(x0 + 10, IRON.y - 2, 5, 2, 0x22262e); P.hl(x0 + 10, IRON.y - 2, 5, 0x4a525e);
  P.rect(x1 - 16, IRON.y - 2, 5, 2, 0x22262e); P.hl(x1 - 16, IRON.y - 2, 5, 0x4a525e);
  // fästena under brädan (där benen möter skivan)
  P.hl(x0 + 11, by + 5, 4, 0x5a6270); P.hl(x1 - 15, by + 5, 4, 0x5a6270);
  // brädan (spetsig till vänster)
  for (let y = by; y < by + 5; y++) {
    const inset = Math.abs(y - by - 2);
    for (let x = x0 + inset * 2; x < x1; x++) {
      let c = y === by ? 0xdce8f4 : y === by + 4 ? 0x6a7a94 : 0xb8cce4;
      if (y > by && y < by + 4 && hash(x >> 1, y, 13) > 0.8) c = hash(x, y, 2) > 0.5 ? 0xe86aa0 : 0xf2d04a;   // blommönster
      if (x === x0 + inset * 2) c = 0x4a5a74;
      P.px(x, y, c);
    }
  }
  // strykjärnsgallret längst till höger
  P.rect(x1, by, 5, 4, 0x8e98a4); P.hl(x1, by, 5, 0xeef3f6); P.px(x1 + 4, by + 3, 0x4a525e);
  return { cv: P.flush(), x: X0, y: top };
}
function paintRack() {
  // klädhängare på hjul med kemtvätt i plastfodral och lappar
  const X0 = RACK.x0 - 2, top = RACK.fy - 48, W = RACK.x1 - RACK.x0 + 4, H = 50;
  const P = new Pix(W, H, X0, top);
  const x0 = RACK.x0, x1 = RACK.x1, ry = top + 4, fy = RACK.fy;
  P.ell((x0 + x1) / 2, fy - 1, (x1 - x0) / 2 + 2, 2, 0x1a1a2a, 0.3, 3);
  // ställningen
  for (const px of [x0 + 1, x1 - 3]) { P.rect(px, ry, 2, fy - ry - 3, 0x8e98a4); P.vl(px, ry, fy - ry - 3, 0xeef3f6); }
  P.rect(x0, ry, x1 - x0, 2, 0xb4bcc6); P.hl(x0, ry, x1 - x0, 0xf4f6f8);
  P.rect(x0 - 1, fy - 5, x1 - x0 + 2, 2, 0x8e98a4); P.hl(x0 - 1, fy - 5, x1 - x0 + 2, 0xdfe5ea);
  for (const wx of [x0 - 1, x1 - 3]) { P.rect(wx, fy - 3, 4, 3, 0x2a2e36); P.px(wx + 1, fy - 3, 0x6a7480); }
  // plaggen
  const shirts = [0xf6f4ee, 0x3a7bd5, 0x2d3a5c, 0xe8d8b0, 0xd9433b, 0xf6f4ee, 0x46464e];
  for (let i = 0; i < 7; i++) {
    const sx = x0 + 4 + i * 8, c = shirts[i], long = i % 3 === 1;
    P.line(sx + 3, ry + 2, sx + 3, ry + 4, 0x6a7480);             // krok
    P.hl(sx, ry + 5, 7, 0x6a7480);                                 // galge
    const h = long ? 30 : 22;
    for (let y = ry + 6; y < ry + 6 + h; y++) for (let x = sx - 1; x < sx + 8; x++) {
      const yy = y - ry - 6;
      if (yy < 2 && (x < sx || x > sx + 6)) continue;
      let cc = c;
      if (x === sx - 1 || x === sx + 7) cc = mul(c, 0.72);
      else if (x === sx) cc = lite(c, 0.25);
      if (yy === 0 && x > sx + 1 && x < sx + 5) cc = x === sx + 3 ? mul(c, 0.6) : lite(c, 0.5);   // kragen
      if (yy === h - 1) cc = mul(c, 0.7);
      P.px(x, y, cc);
      if ((x + y) % 7 === 0 || x === sx + 6) P.px(x, y, WHITE, 0.35);                            // plastfodralets glans
    }
    // liten lapp på fodralet
    P.rect(sx + 4, ry + 8, 3, 4, 0xfff6e8); P.px(sx + 5, ry + 9, 0xc8202e); P.px(sx + 5, ry + 11, 0xc8202e);
  }
  return { cv: P.flush(), x: X0, y: top };
}
function paintFloorSign() {
  // gul "HALT GOLV"-skylt (A-bock)
  const W = 14, H = 20, P = new Pix(W, H);
  P.ell(7, 18.5, 7, 1.6, 0x1a1a2a, 0.3, 3);
  for (let y = 0; y < 18; y++) {
    const half = 2 + Math.floor(y / 3.6);
    for (let x = 7 - half; x <= 7 + half - 1; x++) {
      const c = x === 7 - half ? 0xb07a10 : x === 7 + half - 1 ? 0xc89018 : y === 0 ? 0xffe98a : 0xf5c518;
      P.px(x, y, c);
    }
  }
  P.hl(3, 17, 8, 0x8a5a10);
  // varningstriangel
  P.px(7, 4, INK); P.hl(6, 5, 3, INK); P.hl(5, 6, 5, INK); P.px(5, 7, INK); P.px(9, 7, INK); P.hl(4, 8, 7, INK);
  P.px(7, 6, 0xf5c518);
  P.hl(4, 11, 7, INK); P.hl(4, 13, 7, INK);   // textstreck
  return P.flush();
}
function paintCart() {
  // tvättvagn på hjul: kromram med klädstång, blå tygsäck full av handdukar,
  // två tomma galgar på stången
  const x0 = CART.x, fy = CART.fy, W = 36, H = 38, X0 = x0 - 3, top = fy - H + 1;
  const P = new Pix(W, H, X0, top);
  P.ell(x0 + 15.5, fy - 1, 17, 2.5, 0x1a1a2a, 0.35, 3);
  // stolparna och klädstången
  for (const px of [x0 + 1, x0 + 28]) { P.vl(px, fy - 34, 30, 0xeef3f6); P.vl(px + 1, fy - 34, 30, 0x8e98a4); }
  P.hl(x0 + 1, fy - 35, 29, 0xf8fafc); P.hl(x0 + 1, fy - 34, 29, 0xaab2bc); P.px(x0 + 29, fy - 34, 0x6a7480);
  // galgarna
  for (const gx of [x0 + 9, x0 + 16]) {
    P.px(gx + 2, fy - 36, 0x6a7480); P.px(gx + 3, fy - 35, 0x6a7480); P.px(gx + 3, fy - 33, 0x8e98a4);
    P.px(gx + 2, fy - 32, 0x8e98a4); P.px(gx + 1, fy - 31, 0x8e98a4); P.px(gx, fy - 30, 0x8e98a4); P.px(gx + 4, fy - 32, 0x8e98a4); P.px(gx + 5, fy - 31, 0x8e98a4); P.px(gx + 6, fy - 30, 0x8e98a4);
    P.hl(gx, fy - 29, 7, 0x6a7480);
  }
  // handdukar som sticker upp ur säcken
  const tw = [[x0 + 5, 0xf6f4ee], [x0 + 12, 0xe86aa0], [x0 + 18, 0x3a7bd5], [x0 + 23, 0xf2b630]];
  tw.forEach(([tx, c], i) => {
    const h = 4 + (i % 2) * 2;
    for (let y = fy - 23 - h; y < fy - 22; y++) for (let x = tx; x < tx + 6; x++) {
      const e = y === fy - 23 - h;
      if (e && (x === tx || x === tx + 5)) continue;
      P.px(x, y, e ? lite(c, 0.45) : x === tx ? lite(c, 0.2) : x === tx + 5 ? mul(c, 0.72) : ((y - fy) & 1) ? c : mul(c, 0.9));
    }
  });
  // säcken: vävd blå duk med sömmar, lite buktig nertill
  for (let y = fy - 22; y < fy - 6; y++) {
    const b = y > fy - 10 ? 1 : 0;
    for (let x = x0 + 3 - b; x < x0 + 27 + b; x++) {
      let c = mix(0x5a8ac0, 0x2c5486, (y - (fy - 22)) / 16 + (bayer(x, y) - 0.5) * 0.18);
      if (x <= x0 + 3 - b) c = mix(c, WHITE, 0.25); else if (x >= x0 + 26 + b) c = mul(c, 0.66);
      if ((x - x0) % 8 === 7) c = mul(c, 0.86);               // sömmar
      P.px(x, y, c);
    }
  }
  P.hl(x0 + 3, fy - 22, 24, 0xdfe5ea); P.hl(x0 + 3, fy - 21, 24, 0x6a7480);   // kromkanten
  P.hl(x0 + 2, fy - 6, 26, 0x1e3a60);
  // tvätteriets märke på säcken
  P.rect(x0 + 10, fy - 17, 10, 7, 0xf4f1ea); P.box(x0 + 10, fy - 17, 10, 7, 0xc8d0d8);
  P.hl(x0 + 12, fy - 15, 6, 0x3a7bd5); P.px(x0 + 12, fy - 14, 0x3a7bd5); P.px(x0 + 17, fy - 14, 0x3a7bd5); P.hl(x0 + 13, fy - 13, 4, 0x3a7bd5);
  // underredet och hjulen
  P.hl(x0, fy - 5, 30, 0xc4ccd4); P.hl(x0, fy - 4, 30, 0x5a6270);
  for (const wx of [x0, x0 + 26]) { P.rect(wx, fy - 3, 4, 3, 0x22262e); P.px(wx + 1, fy - 2, 0x8e98a4); P.px(wx + 2, fy - 3, 0x3a3f4c); }
  return { cv: P.flush(), x: X0, y: top };
}

// ======================= bakgrunden (väggen, disken, golvet) =======================
function paintShelfItem(P, x, base, kind, c) {
  if (kind === 0) {           // kartong med tvättmedel
    P.rect(x, base - 10, 9, 10, c); P.hl(x, base - 10, 9, lite(c, 0.4)); P.vl(x + 8, base - 9, 9, mul(c, 0.72));
    P.rect(x + 1, base - 7, 7, 4, 0xf8f6f0); P.px(x + 3, base - 6, c); P.px(x + 4, base - 5, 0xf2b630); P.px(x + 5, base - 6, mul(c, 0.7));
    P.hl(x + 1, base - 2, 7, mul(c, 0.85));
    return 10;
  }
  if (kind === 1) {           // dunk med handtag
    P.rect(x, base - 10, 7, 10, c); P.vl(x, base - 10, 10, lite(c, 0.4)); P.vl(x + 6, base - 9, 9, mul(c, 0.72));
    P.rect(x + 4, base - 13, 3, 3, mul(c, 0.8)); P.px(x + 5, base - 12, 0x2a2430);
    P.rect(x + 1, base - 13, 2, 3, 0xf4f1ea); P.hl(x + 1, base - 14, 2, WHITE);
    P.rect(x + 1, base - 6, 5, 3, 0xf8f6f0); P.hl(x + 2, base - 5, 3, 0x3a7bd5);
    return 8;
  }
  if (kind === 2) {           // sprayflaska
    P.rect(x, base - 8, 4, 8, c); P.vl(x, base - 8, 8, lite(c, 0.4));
    P.rect(x, base - 11, 3, 3, WHITE); P.px(x + 3, base - 10, WHITE); P.px(x + 1, base - 12, 0x9aa4b0);
    P.hl(x, base - 4, 4, 0xf8f6f0);
    return 5;
  }
  if (kind === 3) {           // vikta handdukar
    const cols = [c, 0xf6f4ee, lite(c, 0.4)];
    for (let i = 0; i < 3; i++) { const yy = base - 3 - i * 3; P.rect(x, yy, 11, 3, cols[i]); P.hl(x, yy, 11, lite(cols[i], 0.4)); P.px(x + 10, yy + 2, mul(cols[i], 0.7)); }
    return 12;
  }
  // flaska sköljmedel (rundad)
  P.rect(x + 1, base - 9, 5, 9, c); P.rect(x, base - 7, 7, 6, c); P.vl(x, base - 7, 6, lite(c, 0.4)); P.vl(x + 6, base - 7, 6, mul(c, 0.72));
  P.rect(x + 2, base - 11, 3, 2, 0xf4f1ea); P.px(x + 2, base - 5, WHITE); P.px(x + 3, base - 4, lite(c, 0.6));
  return 8;
}
function paintTub(P, x, y, temp, ink) {
  // tvättsymbolen: balja med vattenvåg och temperatur
  const MAP = [
    '.##..##..##..',
    '#..##..##..##',
    '#...........#',
    '#...........#',
    '#...........#',
    '.#.........#.',
    '.#.........#.',
    '.#.........#.',
    '..#########..',
  ];
  // (en tom rad under vågen, annars smälter 4:an ihop med den och ser ut som en 9:a)
  MAP.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') P.px(x + i, y + j, ink); });
  text(P, SMALL, temp, x + 3, y + 3, ink);
}
function paintLaundry() {
  const P = new Pix(FW, FH);
  // ---------- tak och vägg ----------
  for (let y = 0; y < FLOOR_Y; y++) for (let x = 0; x < FW; x++) {
    let c;
    if (y < 20) c = mix(0x2c2a38, 0x3c3848, y / 20);
    else if (y === 20) c = 0xf4f1ea;
    else if (y === 21) c = 0xb8b4c0;
    else if (y === 22) c = 0x7a90a0;
    else if (y < 56) {                                                   // ljusblå tapet med ränder
      c = mix(0xb4dcea, 0x92c4d8, (y - 23) / 33 + (bayer(x, y) - 0.5) * 0.18);
      if (x % 8 === 0) c = mix(c, WHITE, 0.16); else if (x % 8 === 4) c = mul(c, 0.97);
    } else if (y < 58) c = y === 56 ? 0x5a9ae0 : 0x2c6fb7;                 // blå kakelbård
    else if (y >= 95) c = y === 95 ? 0x6a7480 : y === 96 ? 0x4a525e : 0x2a2e38; // sockel
    else {                                                                // vitt kakel
      const tx = x % 8, ty = (y - 58) % 7, id = hash(x >> 3, ((y - 58) / 7) | 0, 17);
      c = tx === 7 || ty === 6 ? 0xb8c4cc : mix(0xf4f7f9, 0xe4eaee, id * 0.8);
      if (tx === 0 && ty === 0) c = WHITE;
      if (ty === 5 && tx < 7) c = mul(c, 0.97);
    }
    P.px(x, y, c);
  }
  // lysrör i taket (skymtar under HUD-listen) och deras sken på tapeten
  for (const lx of [60, 190, 320]) { P.rect(lx - 18, 17, 36, 2, 0xf8fcff); P.hl(lx - 18, 19, 36, 0x9aa4b0); P.ell(lx, 24, 40, 6, WHITE, 0.25, 4); }

  // ---------- vänster: NU-tavlan, INLÄMNING-skylten, anslagstavlan ----------
  P.rect(1, 23, 19, 19, 0x4a4450); P.rect(2, 24, 17, 17, 0x1a1418); P.hl(2, 24, 17, 0x2a2428);
  text(P, SMALL, 'NU', 7, 26, 0xffd23f);
  P.hl(1, 42, 19, 0x2a2430, 0.5);
  // emaljskylten med priset – högt upp, så att diskens bubblor aldrig skymmer texten
  {
    // 16 px hög: rad 1 (prickarna på Ä rad 25) y 26–30, rad 2 y 32–36
    const sx0 = 24, sw = 66, sy0 = 23, sh = 16;
    P.rect(sx0, sy0, sw, sh, 0x2f5a3a); P.box(sx0, sy0, sw, sh, 0x142618);
    P.hl(sx0 + 1, sy0 + 1, sw - 2, 0x5a9a6a); P.vl(sx0 + 1, sy0 + 2, sh - 4, 0x3f7a4c);
    P.hl(sx0 + 1, sy0 + sh - 2, sw - 2, 0x24462c); P.vl(sx0 + sw - 2, sy0 + 2, sh - 4, 0x24462c);
    const t1 = 'INLÄMNING', t2 = 'PRIS 70:-';
    text(P, SMALL, t1, sx0 + ((sw - textW(SMALL, t1)) >> 1), sy0 + 3, 0xf8e8a0);
    text(P, SMALL, t2, sx0 + ((sw - textW(SMALL, t2)) >> 1), sy0 + 9, 0xf4f1ea);
    for (const [qx, qy] of [[sx0 + 2, sy0 + 2], [sx0 + sw - 3, sy0 + 2], [sx0 + 2, sy0 + sh - 3], [sx0 + sw - 3, sy0 + sh - 3]]) { P.px(qx, qy, 0xc8d0d8); }
    P.hl(sx0, sy0 + sh, sw, 0x1a2a3a, 0.25);
  }
  // anslagstavlan i kork: lappar, ett foto, två hittestrumpor (bubblorna får täcka den)
  {
    const bx = 28, by = 43, bw = 58, bh = 21;
    P.rect(bx, by, bw, bh, 0x8a5a2e); P.box(bx, by, bw, bh, 0x4a2c14); P.hl(bx + 1, by + 1, bw - 2, 0xc08a50); P.vl(bx + 1, by + 2, bh - 3, 0xa87440);
    for (let y = by + 2; y < by + bh - 2; y++) for (let x = bx + 2; x < bx + bw - 2; x++) {
      const h = hash(x, y, 57);
      P.px(x, y, h > 0.86 ? 0x9a6436 : h < 0.12 ? 0xd8a468 : mix(0xc48a50, 0xb67c44, hash(x >> 1, y, 58)));
    }
    P.hl(bx + 1, by + bh - 1, bw - 1, 0x2a180a); P.hl(bx, by + bh, bw, 0x1a2a3a, 0.25);
    const note = (nx, ny, w, h, c, pin, lines = 2) => {
      P.rect(nx, ny, w, h, c); P.hl(nx, ny, w, lite(c, 0.4)); P.vl(nx + w - 1, ny + 1, h - 1, mul(c, 0.84)); P.hl(nx + 1, ny + h, w, 0x3a2410, 0.4);
      for (let i = 0; i < lines; i++) P.hl(nx + 2, ny + 3 + i * 2, w - 4 - ((i * 3 + nx) % 3), mul(c, 0.55));
      P.px(nx + (w >> 1), ny + 1, pin); P.px(nx + (w >> 1), ny, lite(pin, 0.5));
    };
    note(bx + 4, by + 4, 11, 9, 0xfff6c8, 0xd9302a, 3);
    note(bx + 18, by + 3, 9, 8, 0xf4f1ea, 0x2c6fb7);
    note(bx + 42, by + 11, 11, 7, 0xbfe6f4, 0x46a35a);
    // fotot (polaroid)
    P.rect(bx + 30, by + 4, 9, 10, 0xfafaf4); P.rect(bx + 31, by + 5, 7, 6, 0x6ab8ea); P.hl(bx + 31, by + 9, 7, 0x46a35a); P.hl(bx + 31, by + 10, 7, 0x2f8f46);
    P.px(bx + 36, by + 6, 0xffe07a); P.hl(bx + 31, by + 14, 9, 0x3a2410, 0.4); P.px(bx + 34, by + 4, 0xe8b230);
    // hittestrumpor på nålar (randig + prickig)
    const sock = (sx, sy, a, b, flip) => {
      const S = ['aa.', 'ba.', 'aa.', 'bb.', 'aaa', 'abba', '.aa'];
      S.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') P.px(flip ? sx + 3 - i : sx + i, sy + j, r[i] === 'a' ? a : b); });
      P.px(flip ? sx + 3 : sx, sy, lite(a, 0.4)); P.px(sx + 1, sy - 1, 0xffd23f);
    };
    sock(bx + 21, by + 12, 0xe0463c, 0xf4f1ea, false);
    sock(bx + 5, by + 14, 0x3a7bd5, 0xf2b630, true);
    P.rect(bx + 44, by + 3, 8, 6, 0xffb0c8); P.hl(bx + 45, by + 5, 6, 0xc86a8a); P.hl(bx + 45, by + 7, 4, 0xc86a8a); P.px(bx + 47, by + 3, 0x8e5bd1);
  }
  // ---------- disken ----------
  const { x0, x1, top, surf } = COUNTER;
  for (let y = top; y < FLOOR_Y; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y === top) c = 0xf8d8a8;
    else if (y <= surf) c = mix(0xd89e5e, 0xc0864a, (y - top) / 6 + (hash(x >> 2, y, 3) - 0.5) * 0.35);  // ekskiva
    else if (y === surf + 1) c = 0xecc08a;
    else if (y === surf + 2) c = 0x7a4a24;
    else if (y >= 95) c = y === 95 ? 0x3a4a54 : 0x22282e;
    else {                                                                                          // petrolblå front med speglar
      c = mix(0x3a8a9a, 0x2a6a78, (y - surf - 3) / 20);
      const px = (x - x0) % 24, py = y - surf - 3;
      if (px >= 3 && px <= 20 && py >= 3 && py <= 16) {
        if (px === 3 || py === 3) c = mul(c, 0.78); else if (px === 20 || py === 16) c = mix(c, WHITE, 0.2); else c = mix(c, WHITE, 0.05);
      }
    }
    if (x === x0 || x === x1 - 1) c = mul(c, 0.78);
    P.px(x, y, c);
  }
  // ringklocka och kvittospik på disken
  P.hl(85, surf - 1, 7, 0x3a3f4c); P.rect(86, surf - 4, 5, 3, 0xc8d0d8); P.hl(87, surf - 5, 3, 0xdfe5ea); P.px(86, surf - 3, WHITE); P.px(88, surf - 6, 0x6a7480); P.px(90, surf - 2, 0x8e98a4);
  P.vl(23, surf - 9, 8, 0x6a7480); P.px(23, surf - 10, 0xc4ccd4); P.hl(22, surf - 1, 3, 0x3a3f4c);
  for (const [dy, w] of [[-4, 5], [-6, 4], [-8, 5]]) { P.rect(21, surf + dy, w, 2, 0xfffcf2); P.px(21 + w - 1, surf + dy + 1, 0xd8d0c0); }

  // ---------- hyllan med tvättmedel ovanför tvättmaskinerna ----------
  const shx0 = 94, shx1 = 300, shy = 36;
  P.hl(shx0, shy, shx1 - shx0, 0xe8c090); P.hl(shx0, shy + 1, shx1 - shx0, 0xb07a44); P.hl(shx0, shy + 2, shx1 - shx0, 0x6a4424);
  P.hl(shx0, shy + 3, shx1 - shx0, 0x1a2a3a, 0.2);
  for (let bxk = shx0 + 8; bxk < shx1; bxk += 48) { P.vl(bxk, shy + 3, 3, 0x5a6270); P.px(bxk + 1, shy + 3, 0x5a6270); }
  const cols = [0x2c6fb7, 0xe07a2e, 0x46a35a, 0xd9433b, 0x8e5bd1, 0x2aa39a, 0xe86aa0];
  let sx = shx0 + 3, n = 0;
  while (sx < shx1 - 12) {
    const kind = (hash(n, 3, 41) * 5) | 0, c = cols[(hash(n, 7, 43) * cols.length) | 0];
    sx += paintShelfItem(P, sx, shy, kind, c) + 2 + ((hash(n, 1, 9) * 3) | 0);
    n++;
  }
  // kedjorna till skyltarna
  for (const s of SIGNS) for (const kx of [s.x + 5, s.x + s.w - 6]) for (let y = shy + 3; y < s.y; y++) P.px(kx, y, (y & 1) ? 0x8e98a4 : 0x5a6270);
  // ---------- programskyltarna ----------
  for (const s of SIGNS) {
    const C = CLS[s.c];
    P.rect(s.x, s.y, s.w, s.h, C.board); P.box(s.x, s.y, s.w, s.h, mul(C.board, 0.55));
    P.hl(s.x + 1, s.y + 1, s.w - 2, lite(C.board, 0.45));
    P.hl(s.x + 1, s.y + s.h - 2, s.w - 2, mul(C.board, 0.85));
    paintTub(P, s.x + 3, s.y + 2, C.temp, C.ink);
    const tw = textW(SMALL, C.name), tx = s.x + 18 + ((s.w - 20 - tw) >> 1);
    if (s.c === 1) {     // KULÖRT med regnbågsbokstäver
      const rc = [0xd9302a, 0x2c6fb7, 0x2f8f46, 0x8e3bb1, 0xc8501a, 0x2c6fb7];
      let cx2 = tx;
      for (let i = 0; i < C.name.length; i++) { text(P, SMALL, C.name[i], cx2, s.y + 4, rc[i % rc.length]); cx2 += textW(SMALL, C.name[i]) + 1; }
    } else text(P, SMALL, C.name, tx, s.y + 4, C.ink);
    P.px(s.x + 5, s.y + 1, 0x8e98a4); P.px(s.x + s.w - 6, s.y + 1, 0x8e98a4);
  }
  // ---------- torktumlarskylten ----------
  const tsx = 304, tsy = 24, tsw = 72, tsh = 13;
  P.rect(tsx, tsy, tsw, tsh, 0xc8502a); P.box(tsx, tsy, tsw, tsh, 0x7a2a14); P.hl(tsx + 1, tsy + 1, tsw - 2, 0xf08a5a); P.hl(tsx + 1, tsy + tsh - 2, tsw - 2, 0xa8401e);
  // torksymbolen: fyrkant med ring och en prick
  P.box(tsx + 3, tsy + 2, 9, 9, 0xfff4e0); P.box(tsx + 5, tsy + 4, 5, 5, 0xfff4e0); P.px(tsx + 5, tsy + 4, 0xc8502a); P.px(tsx + 9, tsy + 4, 0xc8502a); P.px(tsx + 5, tsy + 8, 0xc8502a); P.px(tsx + 9, tsy + 8, 0xc8502a); P.px(tsx + 7, tsy + 6, 0xfff4e0);
  text(P, SMALL, 'TORKTUMLARE', tsx + 16, tsy + 4, 0xfff4e0);

  // ---------- golvet: ljust klinker med terrazzostänk ----------
  for (let y = FLOOR_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    const chk = ((x / 12) | 0) + (((y - FLOOR_Y) / 8) | 0);
    let c = chk & 1 ? 0xdce5ea : 0xc6d3dc;
    const h = hash(x, y, 4);
    if (h > 0.955) c = mix(c, 0x7a8a98, 0.45); else if (h < 0.03) c = mix(c, WHITE, 0.6);
    else c = mul(c, 0.97 + hash(x >> 1, y >> 1, 6) * 0.05);
    if (y < FLOOR_Y + 4) c = mul(c, 0.8 + (y - FLOOR_Y) * 0.05);    // skugga under väggen
    P.px(x, y, c);
  }
  // dörrmattorna (IN uppe, UT nere)
  const mat = (my, label, lc) => {
    for (let y = my; y < my + 20; y++) for (let x = 0; x < 16; x++) {
      let c = x === 15 || y === my || y === my + 19 ? 0x2a2018 : mix(0x5a4636, 0x4a3828, hash(x, y, 19) * 0.8);
      if (x === 14 || y === my + 1 || y === my + 18) c = 0x3a2c20;
      P.px(x, y, c);
    }
    text(P, SMALL, label, 4, my + 7, lc);
  };
  mat(IN_Y - 10, 'IN', 0x8ee07c); mat(OUT_Y - 12, 'UT', 0xff8a7a);
  // golvbrunn och en vattenpöl (någon har spillt)
  const dx = 250, dy = 126;
  P.ell(dx + 0.5, dy + 0.5, 6, 3, 0x3a4450, 0.9, 2);
  for (let i = -4; i <= 4; i += 2) P.vl(dx + i, dy - 1, 3, 0x1a2028);
  P.hl(dx - 5, dy - 2, 11, 0x9aa4b0);
  P.ell(dx - 12, dy + 1, 10, 3.5, 0x9ad0f4, 0.45, 3);
  P.px(dx - 16, dy, WHITE, 0.8); P.hl(dx - 14, dy - 1, 3, WHITE, 0.6); P.px(dx - 6, dy + 2, WHITE, 0.5);
  P.hl(COUNTER.x0, FLOOR_Y, COUNTER.x1 - COUNTER.x0, 0x1a1a2a, 0.3);
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}

// ======================= kollegan vid strykbrädan =======================
let COWORKER = null;
function coworkerLook() {
  if (COWORKER) return COWORKER;
  const L = makeLook(rng(4711));
  L.top = 'tee'; L.shirt = '#2aa39a'; L.hat = null; L.bag = null; L.glasses = false;
  return (COWORKER = L);
}

// en sak (påse, korg eller färdig påse) med botten i (cx, by)
function drawItem(ctx, it, cx, by, t) {
  const o = it.o;
  let s;
  if (it.kind === 'bag') s = bagSprite(o);
  else if (it.kind === 'wet') s = basketSprite(o, true);
  else if (it.kind === 'dry') s = basketSprite(o, false);
  else s = foldedSprite(o);
  const x = cx - (s.width >> 1), y = by - s.height;
  ctx.drawImage(s, x, y);
  // droppar från blöt tvätt
  if (it.kind === 'wet') {
    const ph = (t * 1.8 + cx * 0.07) % 1;
    ctx.fillStyle = 'rgba(120,190,255,0.85)'; ctx.fillRect(x + 4 + ((t * 1.8 | 0) % 3) * 4, y + s.height + Math.round(ph * 5), 1, 1);
  }
  // nummerlappen hänger på sidan
  drawTag(ctx, x + s.width - 5, y + (it.kind === 'folded' ? 3 : it.kind === 'bag' ? 7 : 5), o.num);
}

// ======================= själva jobbet =======================
export function makeJobbTvatt(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0, missfargat: 0 };
  // passets plan: längd (P.seconds) och kundtakt (P.pace). Bänken får inga extra platser –
  // dörrarna står till vänster och vikbordet/tvättvagnen till höger.
  const P = planOf(A);
  const walker = createWalker({ top: FLOOR_Y + 4, bottom: FH - 4, spawn: [200, 118] });
  walker.setObstacles([
    [AUTO.x - 6, FLOOR_Y, AUTO.x + 8, AUTO.base + 2],
    [TABLE.x0 - 2, TABLE.top, TABLE.x1 + 2, TABLE.fy],
    [BENCH.x0 - 2, SEAT_Y - 22, BENCH.x1 + 2, SEAT_Y - 2],
    [IRON.x0 - 2, IRON.y - 22, IRON.x1 + 6, IRON.y],
    [RACK.x0 - 2, RACK.fy - 14, RACK.x1 + 2, RACK.fy],
    [SIGN_FLOOR.x - 1, SIGN_FLOOR.fy - 6, SIGN_FLOOR.x + 14, SIGN_FLOOR.fy],
    [PLANT.x - 2, PLANT.fy - 10, PLANT.x + 22, PLANT.fy],
    [CART.x - 2, CART.fy - 9, CART.x + 32, CART.fy],
  ]);
  const pops = makePops();
  const washers = WASHERS.map((w) => ({ ...w, state: 'idle', o: null, tt: 0, rot: 0 }));
  const dryers = DRYERS.map((d) => ({ ...d, state: 'idle', o: null, tt: 0, rot: 0 }));
  const cslots = CSLOTS.map((x) => ({ x, item: null, res: null }));
  const tslots = TSLOTS.map((x) => ({ x, item: null }));
  const seats = SEATS.map((x) => ({ x, k: null }));
  let customers = [], t = 0, seq = 0, custIn = 0.6, carry = null, folding = null;
  let queued = null;                  // klick som kom medan man vek – utförs när vikningen är klar
  let nextNum = 10 + ((Math.random() * 70) | 0), shownNum = nextNum - 1, ticketT = 0;
  let done = false, doneT = 0, reported = false;
  const cache = {};
  const bg = () => (cache.bg ||= paintLaundry());
  const prop = (k, fn) => (cache[k] ||= fn());

  // ---------- kunder och ordrar ----------
  function newOrder(cls) {
    const C = CLS[cls], g = [];
    for (let i = 0; i < 3; i++) g.push(C.cols[(Math.random() * C.cols.length) | 0]);
    const num = nextNum; nextNum = nextNum >= 99 ? 10 : nextNum + 1;
    return { num, cls, g, sack: SACKS[(Math.random() * SACKS.length) | 0], stained: false, dyed: 0, dye: 0 };
  }
  function spawnCustomer(instant = false, cls) {
    const seat = seats.find((s) => !s.k), slot = cslots.find((s) => !s.item && !s.res);
    if (!seat || !slot) return null;
    const o = newOrder(cls ?? ((Math.random() * 3) | 0));
    const k = { look: makeLook(), o, seat, slot, id: seq++, x: -12, y: IN_Y, dir: 'right', state: 'walk', plan: [], patience: 0, pmax: 1, shake: 0, bagOut: null };
    o.cust = k; seat.k = k; slot.res = k;
    if (instant) {
      slot.item = { kind: 'bag', o }; slot.res = null; shownNum = o.num;
      k.x = seat.x; k.y = SEAT_Y; sitDown(k);
    } else {
      k.plan = [
        { to: [AUTO.x + 12, AUTO.base + 4] },
        { wait: 0.6, face: 'left', fn: () => { shownNum = o.num; ticketT = 0.6; play('click'); } },
        { to: [slot.x, FLOOR_Y + 6] },
        { wait: 0.6, face: 'up', fn: () => { slot.item = { kind: 'bag', o }; slot.res = null; k.dropped = true; play('slide'); } },
        { to: [seat.x, SEAT_Y + 12] },
        { to: [seat.x, SEAT_Y], face: 'down' },
        { fn: () => sitDown(k) },
      ];
    }
    customers.push(k);
    return k;
  }
  function sitDown(k) {
    k.state = 'sit'; k.dir = 'down'; k.dropped = true;
    k.pmax = 48 - 10 * Math.min(1, t / P.seconds); k.patience = k.pmax;
  }
  function leave(k) {
    k.state = 'leave';
    if (k.seat.k === k) k.seat.k = null;
    k.plan = [{ to: [k.x, SEAT_Y + 14] }, { to: [8, OUT_Y] }, { to: [-18, OUT_Y] }];
  }
  // kunden gick: städa bort allt som hörde till ordern
  function purge(o) {
    for (const s of cslots) { if (s.item?.o === o) s.item = null; if (s.res === o.cust) s.res = null; }
    for (const s of tslots) if (s.item?.o === o) s.item = null;
    for (const m of [...washers, ...dryers]) if (m.o === o) { m.o = null; m.state = 'idle'; m.tt = 0; }
    if (carry?.o === o) { carry = null; pops.add(walker.px, walker.py + 3, 'KUNDEN GICK', '#d8d2c0'); }
    if (folding?.o === o) folding = null;
  }

  // ---------- handgrepp ----------
  function pickCounter(s) {
    if (s.item) {
      if (!carry) { carry = s.item; s.item = null; play('ok'); }
      else if (carry.kind === 'bag') { const tmp = s.item; s.item = carry; carry = tmp; play('click'); }
      else pops.add(s.x, POP_Y, 'HÄNDERNA FULLA', '#d8d2c0');
    } else if (carry?.kind === 'bag' && !s.res) { s.item = carry; carry = null; play('click'); }
  }
  function useWasher(w) {
    // puffen lite till vänster om mitten, så den inte hamnar på figuren som står i springan till höger
    const pop = (txt, col) => pops.add(w.x + 12, POP_Y, txt, col);
    if (w.state === 'idle') {
      if (carry?.kind === 'bag') {
        const o = carry.o; carry = null;
        w.o = o; w.state = 'run'; w.tt = 0;
        if (w.cls !== o.cls) {
          o.stained = true; o.dyed = w.cls; o.dye = 0;
          stats.fel++; play('fel');
          pop('FEL MASKIN!', '#ff6a6a');
        } else { play('door'); pop(CLS[w.cls].name + '!', '#8ee03c'); }
      } else if (carry) pop('INTE HÄR', '#d8d2c0');
    } else if (w.state === 'run') pop('TVÄTTAR...', '#9ad0f4');
    else if (w.state === 'done') {
      if (!carry) { carry = { kind: 'wet', o: w.o }; w.o = null; w.state = 'idle'; play('ok'); }
      else pop('HÄNDERNA FULLA', '#d8d2c0');
    }
  }
  function useDryer(d) {
    // puffen under tumlarkolumnen, en bit från springan där figuren står
    const pop = (txt, col) => pops.add(d.x + 14, POP_Y, txt, col);
    if (d.state === 'idle') {
      if (carry?.kind === 'wet') { d.o = carry.o; carry = null; d.state = 'run'; d.tt = 0; play('door'); pop('TORKAR!', '#ffb070'); }
      else if (carry) pop(carry.kind === 'bag' ? 'TVÄTTA FÖRST' : 'INTE HÄR', '#d8d2c0');
    } else if (d.state === 'run') pop('TORKAR...', '#ffb070');
    else if (d.state === 'done') {
      if (!carry) { carry = { kind: 'dry', o: d.o }; d.o = null; d.state = 'idle'; play('ok'); }
      else pop('HÄNDERNA FULLA', '#d8d2c0');
    }
  }
  // ett klick i lokalen: gå dit och gör det som finns där. Under vikningen
  // köas klicket (som i kaféet) och utförs så fort påsen är knuten.
  function handleDown(x, y) {
    if (done) return;
    if (folding) { queued = [x, y]; return; }
    // disken (påsen eller dess bubbla)
    if (x >= COUNTER.x0 && x < COUNTER.x1 && y >= 32 && y < FLOOR_Y + 4) {
      const s = cslots.reduce((b, c) => (Math.abs(c.x - x) < Math.abs(b.x - x) ? c : b));
      if (Math.abs(s.x - x) < 12) { walker.walkTo(s.x, STAND_Y, () => pickCounter(s)); return; }
    }
    const w = hitMachine(washers, x, y, 6);
    if (w) { walker.walkTo(washerStandX(w), STAND_Y, () => { walker.dir = 'left'; useWasher(w); }); return; }
    const d = hitMachine(dryers, x, y, 2);
    if (d) { walker.walkTo(DRYER_STAND_X, STAND_Y, () => { walker.dir = d.x < DRYER_STAND_X ? 'left' : 'right'; useDryer(d); }); return; }
    // vikbordet
    if (x >= TABLE.x0 - 4 && x < TABLE.x1 + 4 && y >= TABLE.top - 26 && y < TABLE.fy) {
      const s = tslots.reduce((b, c) => (Math.abs(c.x - x) < Math.abs(b.x - x) ? c : b));
      walker.walkTo(s.x, WORK_Y, () => useTable(s));
      return;
    }
    // en väntande kund (bubblan eller figuren): ställ dig snett vid sidan om hen,
    // på den sida du kommer från, så att kunden syns när påsen lämnas
    const k = customers.find((c) => c.state === 'sit' && Math.abs(c.x - x) < 12 && y > c.y - 62 && y < c.y + 4);
    if (k) {
      const side = walker.px < k.x ? -12 : 12;
      walker.walkTo(k.x + side, k.y + 14, () => { walker.dir = side < 0 ? 'right' : 'left'; deliver(k); });
      return;
    }
    walker.walkTo(x, y);
  }
  function useTable(s) {
    if (folding) return;
    if (!s.item) {
      if (carry?.kind === 'dry') { folding = { s, o: carry.o, tt: 0 }; carry = null; walker.stop(); walker.dir = 'down'; play('slide'); }
      else if (carry) { s.item = carry; carry = null; play('click'); }
    } else if (!carry) { carry = s.item; s.item = null; play('ok'); }
    else { const tmp = s.item; s.item = carry; carry = tmp; play('click'); }
  }
  function deliver(k) {
    if (!carry || k.state !== 'sit') return;
    if (carry.kind !== 'folded') { pops.add(k.x, k.y - 64, 'INTE KLAR ÄN', '#d8d2c0'); return; }
    if (carry.o.cust !== k) {
      stats.fel++; play('fel'); k.shake = 0.5;
      pops.add(k.x, k.y - 64, 'FEL PÅSE!', '#ff6a6a');
      return;
    }
    const o = carry.o; carry = null;
    k.bagOut = o;
    if (o.stained) { stats.missfargat++; play('miss'); pops.add(k.x, k.y - 64, 'MISSFÄRGAT!', '#ff9ac0'); }
    else { stats.ok++; play('coin'); pops.add(k.x, k.y - 64, 'TACK!', '#8ee03c'); }
    leave(k);
  }
  function finishMachine(m, dryer) {
    m.state = 'done'; m.tt = dryer ? DRY_T : WASH_T;
    if (!dryer && m.o?.stained) m.o.dye = 1;
    play('box');
  }
  const hitMachine = (list, x, y, pad) => list.find((m) => x >= m.x && x < m.x + m.w && y >= m.y - pad && y < m.y + m.h + 4);

  return {
    _debug: {
      stats,
      // en kund sitter direkt på bänken och påsen ligger på disken; returnerar
      // numret. Är bänken/disken full tas den äldsta kunden bort (utan miss).
      forceCustomer(cls) {
        let k = spawnCustomer(true, cls);
        if (!k) {
          const old = customers.find((c) => c.state !== 'leave' && c.o !== carry?.o && (c.seat.k === c || c.slot.res === c || cslots.some((s) => s.item?.o === c.o)));
          if (old) {
            purge(old.o);
            if (old.seat.k === old) old.seat.k = null;
            if (old.slot.res === old) old.slot.res = null;
            customers.splice(customers.indexOf(old), 1);
          }
          k = spawnCustomer(true, cls);
        }
        return k ? k.o.num : null;
      },
      // plocka en påse från disken (utan att gå): ett ordernummer (10–99), en
      // diskplats (0–2) eller inget = första påsen som ligger där. Det man bar
      // släpps (bara i testläget).
      pickBag(which) {
        if (folding) folding = null;
        queued = null; carry = null;
        let s = which >= 10 ? cslots.find((c) => c.item?.o.num === which) : cslots[which ?? -1];
        if (!s?.item) s = cslots.find((c) => c.item?.kind === 'bag');
        if (!s) return null;
        carry = s.item; s.item = null;
        return { num: carry.o.num, cls: carry.o.cls };
      },
      // hela kedjan direkt: rätt (eller fel) maskin → klar → torktumlare → klar → vikt påse i händerna
      process(right = true) {
        if (carry?.kind !== 'bag') return null;
        const fits = (m) => (right ? m.cls === carry.o.cls : m.cls !== carry.o.cls);
        let w = washers.find((m) => m.state === 'idle' && fits(m));
        if (!w) { w = washers.find(fits); if (w.o) purge(w.o); w.state = 'idle'; w.o = null; }
        useWasher(w); finishMachine(w, false); useWasher(w);
        let d = dryers.find((m) => m.state === 'idle');
        if (!d) { d = dryers[0]; if (d.o) purge(d.o); d.state = 'idle'; d.o = null; }
        useDryer(d); finishMachine(d, true); useDryer(d);
        carry = { kind: 'folded', o: carry.o };
        return { num: carry.o.num, stained: carry.o.stained };
      },
      // allt i ett för röktestet: ny kund → påsen → maskin → tork → vikt → till kunden.
      // forceRight: rätt maskin → ok +1. forceWrong: fel maskin (missfärgat) → fel +1,
      // påsen lämnas ändå till rätt kund som går hem sur (ingen ok).
      forceRight() { const n = this.forceCustomer(); if (n === null || !this.pickBag(n) || !this.process(true)) return null; return this.serve(true); },
      forceWrong() { const n = this.forceCustomer(); if (n === null || !this.pickBag(n) || !this.process(false)) return null; return this.serve(true); },
      // lämna påsen: rätt kund (samma nummer) eller en annan (tvingar fram en om det behövs)
      serve(right = true) {
        if (carry?.kind !== 'folded') return null;
        let k = customers.find((c) => c.state === 'sit' && (right ? c === carry.o.cust : c !== carry.o.cust));
        if (!k && !right) { const keep = carry; this.forceCustomer(); carry = keep; k = customers.find((c) => c.state === 'sit' && c !== carry.o.cust); }
        if (!k) return null;
        deliver(k);
        return stats;
      },
      finishAll() { for (const w of washers) if (w.state === 'run') finishMachine(w, false); for (const d of dryers) if (d.state === 'run') finishMachine(d, true); },
      carrying: () => (carry ? { kind: carry.kind, num: carry.o.num, cls: carry.o.cls, stained: carry.o.stained } : null),
      machines: () => ({ washers: washers.map((w) => ({ cls: w.cls, state: w.state, num: w.o?.num ?? null })), dryers: dryers.map((d) => ({ state: d.state, num: d.o?.num ?? null })) }),
      customers: () => customers.filter((k) => k.state === 'sit').map((k) => ({ num: k.o.num, cls: k.o.cls, patience: +k.patience.toFixed(1) })),
      // sant när figuren står still och varken viker eller har ett köat klick (för klicktester)
      idle: () => !folding && !queued && walker.path.length === 0,
      folding: () => (folding ? { num: folding.o.num, tt: +folding.tt.toFixed(2) } : null),
      queued: () => (queued ? [...queued] : null),
      where: () => ({ x: Math.round(walker.px), y: Math.round(walker.py), dir: walker.dir }),
      // för förhandsbilder: ställ upp lägen direkt
      stage(fn) { return fn({ washers, dryers, cslots, tslots, customers, spawnCustomer, newOrder, walker, setCarry: (c) => { carry = c; }, setFolding: (f) => { folding = f; } }); },
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= P.seconds) { done = true; queued = null; walker.stop(); return; }
      if (!folding) walker.update(dt);
      ticketT = Math.max(0, ticketT - dt);
      // nya kunder
      custIn -= dt;
      // (första två kommer tätt så att det blir fart direkt, sedan var 4–9:e sekund – tätare med vanan)
      if (custIn <= 0) custIn = spawnCustomer() ? (seq < 2 ? 3 : 6.6 - 2.4 * Math.min(1, t / P.seconds) + hash(seq, 3) * 2.2) * P.pace : 1;
      // tvättmaskinerna: trumman byter håll var 1,6 s (som en riktig maskin), centrifugen går fort
      for (const w of washers) {
        if (w.state !== 'run') continue;
        w.tt += dt;
        const spin = w.tt > WASH_T - SPIN_T;
        w.rot += dt * (spin ? 16 : 3.4 * (Math.sin(w.tt * 1.96) >= 0 ? 1 : -1));
        if (w.o.stained) w.o.dye = Math.min(1, w.tt / (WASH_T - SPIN_T));
        if (w.tt >= WASH_T) finishMachine(w, false);
      }
      for (const d of dryers) {
        if (d.state !== 'run') continue;
        d.tt += dt; d.rot += dt * 4.2;
        if (d.tt >= DRY_T) finishMachine(d, true);
      }
      // vikningen
      if (folding) {
        folding.tt += dt;
        if (folding.tt >= FOLD_T) { carry = { kind: 'folded', o: folding.o }; folding = null; play('box'); }
      }
      // det köade klicket (även om vikningen avbröts för att kunden gick)
      if (!folding && queued) { const q = queued; queued = null; handleDown(q[0], q[1]); }
      // kunderna
      for (const k of customers) {
        k.shake = Math.max(0, k.shake - dt);
        if (k.state === 'sit') {
          k.patience -= dt;
          if (k.patience <= 0) {
            stats.miss++; play('miss'); pops.add(k.x, k.y - 64, 'GICK HEM!', '#d8d2c0');
            purge(k.o); leave(k);
          }
          continue;
        }
        const step = k.plan[0];
        if (!step) continue;
        if (step.to) {
          const sp = (k.state === 'leave' ? 42 : 36) * dt, [tx, ty] = step.to;
          const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
          k.dir = step.face && d < 14 ? step.face : Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
          if (d <= sp) { k.x = tx; k.y = ty; k.plan.shift(); } else { k.x += dx / d * sp; k.y += dy / d * sp; }
        } else if (step.wait !== undefined) {
          if (step.face) k.dir = step.face;
          step.wait -= dt;
          if (step.wait <= 0) { step.fn?.(); k.plan.shift(); }
        } else { k.plan.shift(); step.fn?.(); }
      }
      customers = customers.filter((k) => !(k.state === 'leave' && !k.plan.length));
    },
    down(x, y) { handleDown(x, y); },
    key(kk) { if (kk === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      drawWall(ctx);
      // påsarna på disken
      for (const s of cslots) if (s.item) drawItem(ctx, s.item, s.x, COUNTER.surf + 1, t);
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry || !!folding })];
      // det jag bär (bakom kroppen när jag går uppåt)
      if (carry) {
        const dir = walker.dir, ox = dir === 'left' ? -7 : dir === 'right' ? 7 : 0;
        drawables.push({ fy: walker.py + (dir === 'up' ? -0.01 : 0.01), draw: () => drawItem(ctx, carry, Math.round(walker.px) + ox, Math.round(walker.py) - 11, t) });
      }
      // rekvisita
      const table = prop('table', paintTable), bench = prop('bench', paintBench), board = prop('board', paintIronBoard), rack = prop('rack', paintRack);
      drawables.push({ fy: SEAT_Y - 0.5, draw: () => ctx.drawImage(bench.cv, bench.x, bench.y) });
      drawables.push({ fy: TABLE.fy, draw: () => { ctx.drawImage(table.cv, table.x, table.y); drawTableTop(ctx); } });
      drawables.push({ fy: IRON.y, draw: () => { ctx.drawImage(board.cv, board.x, board.y); drawIroning(ctx); } });
      drawables.push({ fy: IRON.y - 12, draw: () => drawPerson(ctx, IRON.cx, IRON.y - 12, coworkerLook(), 'down', 9) });
      drawables.push({ fy: RACK.fy, draw: () => ctx.drawImage(rack.cv, rack.x, rack.y) });
      drawables.push({ fy: SIGN_FLOOR.fy, draw: () => ctx.drawImage(prop('sign', paintFloorSign), SIGN_FLOOR.x, SIGN_FLOOR.fy - 19) });
      const cart = prop('cart', paintCart);
      drawables.push({ fy: CART.fy, draw: () => ctx.drawImage(cart.cv, cart.x, cart.y) });
      drawables.push({ fy: AUTO.base, draw: () => drawAutomat(ctx) });
      const atlasOk = ATLAS && ATLAS.complete && ATLAS.naturalWidth > 0;
      if (atlasOk) drawables.push({ fy: PLANT.fy, draw: () => { const f = FRAMES.vaxtS0; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], PLANT.x, PLANT.fy - f[3], f[2], f[3]); } });
      for (const k of customers) drawables.push({ fy: k.y, draw: () => drawCustomer(ctx, k) });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // bubblor: påsarna på disken, maskiner som är klara, väntande kunder
      for (const s of cslots) {
        if (!s.item || s.item.kind !== 'bag') continue;
        const [ix, iy] = bubble(ctx, s.x, COUNTER.surf - 15, 16, 13);
        const tee = teeSprite(s.item.o.cls);
        ctx.drawImage(tee, ix + ((16 - tee.width) >> 1), iy + ((13 - tee.height) >> 1));
      }
      // gröna pilar över vikbordets lediga platser när man bär torr tvätt
      if (carry?.kind === 'dry' && !folding && (t * 3 | 0) % 2 === 0) {
        for (const s of tslots) {
          if (s.item) continue;
          const ax = s.x, ay = TABLE.top - 9;
          ctx.fillStyle = '#17151a'; ctx.fillRect(ax - 3, ay - 1, 7, 4); ctx.fillRect(ax - 2, ay + 3, 5, 1); ctx.fillRect(ax - 1, ay + 4, 3, 1);
          ctx.fillStyle = '#8ee03c'; ctx.fillRect(ax - 2, ay, 5, 2); ctx.fillRect(ax - 1, ay + 2, 3, 1); ctx.fillRect(ax, ay + 3, 1, 1);
        }
      }
      for (const k of customers) {
        if (k.state !== 'sit') continue;
        const hot = carry?.kind === 'folded' && carry.o.cust === k;
        const cx = Math.round(k.x), tip = Math.round(k.y) - 36 - (hot && (t * 4 | 0) % 2 ? 1 : 0);
        const [ix, iy] = bubble(ctx, cx, tip, 18, 19, hot);
        drawTicket(ctx, ix + 1, iy + 1, k.o.num);
        const left = clamp(k.patience / k.pmax, 0, 1);
        ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 16, 14, 2);
        ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
        ctx.fillRect(ix + 2, iy + 16, Math.max(1, Math.round(14 * left)), 2);
        if (k.patience < 8 && Math.sin(t * 6) > 0) {
          ctx.fillStyle = '#17151a'; ctx.fillRect(ix + 17, iy - 4, 5, 10);
          ctx.fillStyle = '#d9433b'; ctx.fillRect(ix + 18, iy - 3, 3, 5); ctx.fillRect(ix + 18, iy + 3, 3, 2);
        }
      }
      // vikningens förlopp: en liten stapel över huvudet
      if (folding) {
        const bx = Math.round(walker.px) - 8, by = Math.round(walker.py) - 43, q = clamp(folding.tt / FOLD_T, 0, 1), w = Math.max(1, Math.round(16 * q));
        ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 1, 18, 5);
        ctx.fillStyle = '#cfc6b2'; ctx.fillRect(bx, by, 16, 3);
        ctx.fillStyle = '#4aa0dc'; ctx.fillRect(bx, by, w, 3);
        ctx.fillStyle = '#bfe6ff'; ctx.fillRect(bx, by, w, 1);
      }
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: P.seconds, ok: stats.ok, fel: stats.fel, title: 'TVÄTTERIET' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  // ---------- rita: kunderna ----------
  function drawCustomer(ctx, k) {
    const moving = k.state !== 'sit' && !!k.plan[0]?.to;
    const carrying = !!k.bagOut;
    const frame = k.state === 'sit' ? 5 : moving ? (carrying ? [7, 9, 8, 9] : WALK_SEQ)[Math.floor(t * 8.5 + k.id * 0.37) % 4] : carrying ? 9 : 0;
    const sx = k.shake > 0 ? Math.round(Math.sin(k.shake * 40)) : 0;
    const dir = k.state === 'sit' ? 'down' : k.dir;
    // påsen i handen på väg in (bakom kroppen när hen går uppåt)
    const bagIn = !carrying && !k.dropped;
    const drawBag = () => {
      const s = bagSprite(k.o), ox = dir === 'left' ? -7 : dir === 'right' ? 7 : 6;
      ctx.drawImage(s, Math.round(k.x) + ox - (s.width >> 1), Math.round(k.y) - 5 - s.height);
    };
    if (bagIn && dir === 'up') drawBag();
    drawPerson(ctx, k.x + sx, k.y, k.look, dir, frame);
    if (bagIn && dir !== 'up') drawBag();
    if (carrying && dir !== 'up') {
      const s = foldedSprite(k.bagOut), ox = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
      ctx.drawImage(s, Math.round(k.x) + ox - (s.width >> 1), Math.round(k.y) - 11 - s.height);
    }
  }

  // ---------- rita: det rörliga på väggen ----------
  function drawWall(ctx) {
    const blink = (t * 3 | 0) % 2 === 0;
    // NU-tavlan
    ctxText(ctx, BIG, '88', 5, 32, '#3a1216');
    ctxText(ctx, BIG, String(shownNum).padStart(2, '0'), 5, 32, ticketT > 0 && (t * 10 | 0) % 2 ? '#ffb0a0' : '#ff3a3a');
    // blinkande ram runt skylten som passar påsen man bär
    if (carry?.kind === 'bag' && blink) {
      const s = SIGNS[carry.o.cls];
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(s.x - 1, s.y - 1, s.w + 2, 1); ctx.fillRect(s.x - 1, s.y + s.h, s.w + 2, 1);
      ctx.fillRect(s.x - 1, s.y, 1, s.h); ctx.fillRect(s.x + s.w, s.y, 1, s.h);
    }
    // tvättmaskinerna
    for (const w of washers) {
      const spin = w.state === 'run' && w.tt > WASH_T - SPIN_T;
      const jx = spin ? ((t * 28 | 0) % 2) : 0, jy = spin && ((t * 21 | 0) % 3 === 0) ? -1 : 0;
      ctx.fillStyle = 'rgba(20,20,40,0.28)'; ctx.fillRect(w.x + 1, FLOOR_Y, w.w - 2, 2);
      ctx.drawImage(washerBody(w.cls), w.x + jx, w.y + jy);
      drawDrum(ctx, w.x + jx + 8, w.y + jy + 18, 8, w, t, false);
      const dx = w.x + jx + 12, dy = w.y + jy + 7;
      if (w.state === 'run') ctxText(ctx, SMALL, timeStr(WASH_T - w.tt), dx + 1, dy, '#7cf0a0');
      else if (w.state === 'done') ctxText(ctx, SMALL, 'KLAR', dx, dy, (t * 3 | 0) % 2 ? '#ffd23f' : '#7a6a20');
      else ctxText(ctx, SMALL, CLS[w.cls].temp, dx + 4, dy, '#3a6a50');
      ctx.fillStyle = w.state === 'run' ? ((t * 2 | 0) % 2 ? '#ff5a3a' : '#9a2a1a') : w.state === 'done' ? '#7cf05a' : '#3a4048';
      ctx.fillRect(w.x + jx + 29, w.y + jy + 11, 1, 1);
      if (w.state === 'done' && blink) ctx.drawImage(washerRing(0xffd23f), w.x + 4, w.y + 14);
      else if (w.state === 'idle' && carry?.kind === 'bag' && carry.o.cls === w.cls && blink) ctx.drawImage(washerRing(0x8ee03c), w.x + 4, w.y + 14);
      // nummerlappen nere till vänster på luckan (figuren står till höger)
      if (w.o) drawTag(ctx, w.x + jx + 2, w.y + jy + 31, w.o.num);
    }
    // torktumlarna
    for (const d of dryers) {
      ctx.drawImage(dryerBody(), d.x, d.y);
      drawDrum(ctx, d.x + 11, d.y + 12, 7, d, t, true);
      if (d.state === 'run') ctxText(ctx, SMALL, timeStr(DRY_T - d.tt), d.x + 5, d.y + 2, '#ff6a3a');
      else if (d.state === 'done') ctxText(ctx, SMALL, 'KLAR', d.x + 4, d.y + 2, (t * 3 | 0) % 2 ? '#ffd23f' : '#6a4a10');
      else ctxText(ctx, SMALL, 'TORK', d.x + 4, d.y + 2, '#5a2418');
      if (d.state === 'run') {       // värmedaller ovanför luckan
        const ph = (t * 1.6 + d.x * 0.1) % 1;
        ctx.fillStyle = `rgba(255,200,150,${(0.4 * (1 - ph)).toFixed(2)})`;
        ctx.fillRect(d.x + 16 + Math.round(Math.sin(t * 5 + d.x) * 1.5), d.y + 9 - Math.round(ph * 3), 1, 1);
      }
      if (d.state === 'done' && blink) ctx.drawImage(dryerRing(0xffd23f), d.x + 6, d.y + 7);
      else if (d.state === 'idle' && carry?.kind === 'wet' && blink) ctx.drawImage(dryerRing(0x8ee03c), d.x + 6, d.y + 7);
      // nummerlappen på den sida av luckan som vetter bort från springan där figuren står
      if (d.o) drawTag(ctx, d.x + (d.x < DRYER_STAND_X ? 2 : 23), d.y + 19, d.o.num);
    }
  }
  function timeStr(sec) {
    const m = Math.max(0, Math.ceil(sec * 4));
    return `${(m / 60) | 0}:${String(m % 60).padStart(2, '0')}`;
  }
  // nummerlappsautomaten på sin stolpe; lappen sticker ut när någon tar en
  function drawAutomat(ctx) {
    const x = AUTO.x, top = AUTO.top;
    ctx.fillStyle = 'rgba(20,20,40,0.3)'; ctx.fillRect(x - 5, AUTO.base - 1, 11, 2);
    ctx.fillStyle = '#3a3f4c'; ctx.fillRect(x - 4, AUTO.base - 2, 9, 2); ctx.fillStyle = '#8e98a4'; ctx.fillRect(x - 3, AUTO.base - 2, 7, 1);
    ctx.fillStyle = '#5a6270'; ctx.fillRect(x, top + 15, 2, AUTO.base - top - 17); ctx.fillStyle = '#c4ccd4'; ctx.fillRect(x, top + 15, 1, AUTO.base - top - 17);
    ctx.fillStyle = '#5a0e16'; ctx.fillRect(x - 6, top + 1, 14, 14); ctx.fillRect(x - 5, top, 12, 16);
    ctx.fillStyle = '#d8303a'; ctx.fillRect(x - 5, top + 1, 12, 14);
    ctx.fillStyle = '#ff6a6a'; ctx.fillRect(x - 5, top + 1, 12, 1); ctx.fillRect(x - 5, top + 2, 1, 12);
    ctx.fillStyle = '#a01a24'; ctx.fillRect(x + 6, top + 2, 1, 13); ctx.fillRect(x - 4, top + 14, 11, 1);
    ctx.fillStyle = '#fff4e8'; ctx.fillRect(x - 1, top + 3, 3, 4); ctx.fillRect(x - 2, top + 7, 5, 1); ctx.fillRect(x - 1, top + 8, 3, 1); ctx.fillRect(x, top + 9, 1, 1);
    ctx.fillStyle = '#2a0a0e'; ctx.fillRect(x - 3, top + 11, 7, 2);
    const out = ticketT > 0 ? 4 : 2;
    ctx.fillStyle = '#fff6ea'; ctx.fillRect(x - 2, top + 12, 5, out); ctx.fillStyle = '#f29ab0'; ctx.fillRect(x - 2, top + 11 + out, 5, 1);
  }
  // vikbordets innehåll: saker på platserna och vikningen
  function drawTableTop(ctx) {
    const sy = TABLE.top + 9;
    for (const s of tslots) if (s.item) drawItem(ctx, s.item, s.x, sy, t);
    if (!folding) return;
    const f = folding, o = f.o, per = (FOLD_T - 0.2) / 3, k = Math.min(2, (f.tt / per) | 0), ph = (f.tt - k * per) / per;
    const x = f.s.x, y = sy;
    // redan vikta plagg i en stapel till höger
    for (let i = 0; i < k; i++) {
      const c = gcol(o, i), yy = y - 2 - i * 2;
      ctx.fillStyle = css(mul(c, 0.7)); ctx.fillRect(x + 4, yy, 9, 2);
      ctx.fillStyle = css(c); ctx.fillRect(x + 4, yy, 9, 1);
      ctx.fillStyle = css(lite(c, 0.3)); ctx.fillRect(x + 5, yy, 7, 1);
    }
    if (f.tt < FOLD_T - 0.2) {
      const c = gcol(o, k), C = css(c), D = css(mul(c, 0.72)), Lc = css(lite(c, 0.3));
      const gx = x - 10;
      if (ph < 0.35) {            // plagget ligger utbrett (tröja)
        ctx.fillStyle = D; ctx.fillRect(gx - 1, y - 6, 14, 3); ctx.fillRect(gx + 2, y - 3, 8, 4);
        ctx.fillStyle = C; ctx.fillRect(gx - 1, y - 6, 14, 2); ctx.fillRect(gx + 2, y - 4, 8, 4);
        ctx.fillStyle = Lc; ctx.fillRect(gx, y - 6, 12, 1);
        ctx.fillStyle = D; ctx.fillRect(gx + 5, y - 6, 2, 1);
      } else if (ph < 0.7) {      // ärmarna inåt
        ctx.fillStyle = D; ctx.fillRect(gx + 2, y - 6, 8, 7);
        ctx.fillStyle = C; ctx.fillRect(gx + 2, y - 6, 8, 6);
        ctx.fillStyle = Lc; ctx.fillRect(gx + 2, y - 6, 8, 1); ctx.fillRect(gx + 2, y - 5, 1, 4);
        ctx.fillStyle = D; ctx.fillRect(gx + 5, y - 5, 1, 5);
        ctx.fillStyle = Lc; ctx.fillRect(gx + (ph < 0.52 ? -1 : 10), y - 8, 3, 2);   // en ärm i luften
      } else {                    // vikt på mitten, lyfts över till stapeln
        const lift = Math.round((ph - 0.7) / 0.3 * 3);
        ctx.fillStyle = D; ctx.fillRect(gx + 2 + lift * 3, y - 4 - lift, 9, 3);
        ctx.fillStyle = C; ctx.fillRect(gx + 2 + lift * 3, y - 4 - lift, 9, 2);
        ctx.fillStyle = Lc; ctx.fillRect(gx + 2 + lift * 3, y - 4 - lift, 9, 1);
      }
      if ((t * 8 | 0) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(gx - 3, y - 9, 2, 1); ctx.fillRect(gx + 13, y - 10, 2, 1); }
    } else {                      // plastpåsen dras över
      const s = foldedSprite(o);
      ctx.drawImage(s, x - (s.width >> 1), y - s.height);
    }
  }
  // kollegans strykjärn: glider fram och tillbaka, pyser ånga
  function drawIroning(ctx) {
    const by = IRON.y - 19, ix = Math.round(IRON.cx - 6 + Math.sin(t * 2.2) * 9);
    ctx.fillStyle = '#f6f4ee'; ctx.fillRect(IRON.cx - 14, by + 1, 22, 3);
    ctx.fillStyle = '#d8dce4'; ctx.fillRect(IRON.cx - 14, by + 3, 22, 1); ctx.fillRect(IRON.cx - 6, by + 1, 1, 2);
    ctx.fillStyle = '#9ab8e4'; ctx.fillRect(IRON.cx - 14, by + 1, 2, 2);
    ctx.fillStyle = '#2a2e36'; ctx.fillRect(ix + 8, by - 2, 1, 1); ctx.fillRect(ix + 9, by - 3, 6, 1); ctx.fillRect(ix + 15, by - 2, 1, 1);
    ctx.fillStyle = '#17151a'; ctx.fillRect(ix, by - 2, 8, 4); ctx.fillRect(ix + 1, by - 3, 6, 1);
    ctx.fillStyle = '#c8d0d8'; ctx.fillRect(ix + 1, by + 1, 7, 1);
    ctx.fillStyle = '#e03a4a'; ctx.fillRect(ix + 1, by - 2, 6, 2); ctx.fillStyle = '#ff8a8a'; ctx.fillRect(ix + 1, by - 2, 4, 1);
    ctx.fillStyle = '#3a3f4c'; ctx.fillRect(ix + 3, by - 5, 4, 1); ctx.fillRect(ix + 6, by - 4, 1, 1); ctx.fillRect(ix + 2, by - 4, 1, 1);
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.9 + i * 0.2) % 1;
      const sx = ix + 2 + (i % 3) * 2 + Math.round(Math.sin(t * 3 + i * 1.9) * 1.5), sy = by - 3 - Math.round(ph * 13);
      ctx.fillStyle = `rgba(255,255,255,${(0.6 * (1 - ph)).toFixed(2)})`;
      ctx.fillRect(sx, sy, ph > 0.4 ? 2 : 1, ph > 0.6 ? 2 : 1);
    }
  }
}
