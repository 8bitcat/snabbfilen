// BURGARBAREN INNE – 50-talsdinern man kliver in i från Pixelstaden (samma hus
// som fasaden med jätteburgaren på taket, js/city/buildings-work.js). Lokalen är
// 640 px bred (kameran följer figuren) och byggd som en riktig femtiotalsdiner:
//
//   VÄNSTER: kromdörren ut (med fjäderklocka), två stora fönster mot gatan
//     (bilar och folk går förbi, ÖPPET-neon), tuggummiautomaten och båsen med
//     röd vinyl under fönstren.
//   MITTEN: disken i rött och krom med barstolar, kassaapparaten och skylten
//     JOBBA HÄR, menytavlan med lösa bokstäver, KÖKSLUCKAN där man ser kocken
//     vända burgare över lågorna (animerat), fritösen, milkshakemaskinen och
//     läskfontänen på bakdisken.
//   HÖGER: glassdisken med glasstrutar och sundaeglas, jukeboxen som lyser och
//     spelar, neonklockan, vinylskivor och en inramad femtiotalsbil på väggen.
//
// FLÖDET (Carls beställning, ordagrant): gå fram till disken och handla →
// figuren bär en BRICKA med det man köpt → klicka på ett ledigt bord/bås →
// figuren går dit och sätter sig → äter bit för bit (maten på brickan minskar)
// → brickan försvinner FÖRST när man ätit upp → mättnad och energi ökar BARA
// medan man sitter vid bordet (inte i kön, inte stående). Alla platser upptagna
// = pratbubbla.
// REGELN I ALLA MATSTÄLLEN: sitter man och äter kan man inte gå därifrån förrän
// det är uppätet – klick någon annanstans → "ÄT UPP FÖRST! 😋" och figuren sitter
// kvar (att prata med gästerna vid borden går bra). Dörren med brickan i händerna
// eller mitt i maten → "DU MÅSTE SÄTTA DIG OCH ÄTA UPP!" och man stannar inne
// (dörren öppnas inte ens för en). Disken, jobbet och menyn väntar också tills
// brickan är tom. Byts scenen ändå mitt i (somnar vid midnatt, 👥-menyn …) får man
// det som var kvar i exit() – betald mat går aldrig förlorad, inte heller om sidan
// laddas om (ny version), stängs eller läggs undan (settleNow). leaveBlock() säger
// om man får gå just nu (för huvudprogrammets knappar som byter scen).
// Vid disken kan man också jobba: Servera (A.startJob('burgare')) eller Jobba i
// köket (A.startJob('kok') – huvudagenten kopplar JOBS.kok och scenen jobbkok).
//
// Gästerna (NPC) köar vid kassan, beställer, bär brickor, sitter och äter,
// pratar i pratbubblor (aldrig toast) och går. Kassörskan Doris tar ordern,
// ropar in den i köket, hämtar brickan på passet när kocken plinkar och
// ställer den på disken framför den som beställt.
//
// Allt statiskt målas pixel för pixel med Pix-pennan EN gång (per dag/kväll) –
// det som rör sig (folk, kocken, lågor, ånga, jukebox, trafik, dörr) ritas
// varje bildruta.
import { Pix, SMALL, BIG, text, textW, eachTextPixel, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal } from '../core/ui.js';
import { fmt, JOBS } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, sayBubble, iconBubble, createSpeech } from './walkable.js';
import { worldFolksHere, worldSeatsTaken } from '../net/world.js';
import { burgarMeny } from '../jobs/jobb-burgare.js';

const talk = createSpeech(); // repliker och beskrivningar som pratbubblor i scenen
// regelns två repliker (samma i alla matställen)
const MSG_ATUPP = 'ÄT UPP FÖRST! 😋';
const MSG_DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';

// ======================= menyn =======================
// Samma fyra rätter som menytavlan i serveringsjobbet och på fasaden (10:- styck,
// via burgarMeny i js/jobs/jobb-burgare.js). fill = mättnad, energy = energi –
// men de delas ut BIT FÖR BIT medan man sitter och äter, aldrig vid köpet.
const BM = burgarMeny();
const DISH_IX = Object.fromEntries(BM.dishes.map((d, i) => [d.id, i]));
export const BURGAR_MENY = [
  { id: 'burgare', icon: '🍔', name: 'Burgare', price: 25, fill: 24, energy: 6 },
  { id: 'pommes', icon: '🍟', name: 'Pommes', price: 15, fill: 12, energy: 4 },
  { id: 'lask', icon: '🥤', name: 'Läsk', price: 12, fill: 4, energy: 10 },
  { id: 'glass', icon: '🍦', name: 'Glass', price: 14, fill: 8, energy: 8 },
  // målet: alla tre klassikerna på en bricka – 5 kr billigare än var för sig
  // läsken först i listan = den står bakom på brickan (spots i trayCanvas)
  { id: 'mal', icon: '🍔', name: 'Burgarmål (burgare, pommes, läsk)', price: 47, items: ['lask', 'burgare', 'pommes'] },
];
const menyOf = (id) => BURGAR_MENY.find((m) => m.id === id);
const itemsOf = (m) => (m.items || [m.id]).map((id) => menyOf(id));
const fillOf = (m) => itemsOf(m).reduce((a, x) => a + x.fill, 0);
const energyOf = (m) => itemsOf(m).reduce((a, x) => a + x.energy, 0);

// ======================= mått (världskoordinater) =======================
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till lokalen
const W = 640, H = 216;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const WALL_Y = 84;                                   // där golvet möter bakväggen
const DOOR = { x0: 20, x1: 48, top: 24 };            // kromdörren ut
const WINS = [{ x0: 60, x1: 128 }, { x0: 140, x1: 208 }];
const WIN_T = 22, WIN_B = 64;                        // fönsterglasets över-/underkant
const BOARD = { x0: 236, x1: 300, y0: 8, y1: 48 };   // menytavlan (hänger högt på väggen)
const HATCH = { x0: 306, x1: 420, y0: 24, y1: 62 };  // köksluckan (kocken syns här)
const PASS_X = 412;                                  // passet där färdiga brickor plingas fram
const BACK = { x0: 232, x1: 464, top: 66, y: 86 };   // bakdisken mot väggen
const CNT = { x0: 232, x1: 464, top: 96, face: 103, y: 118 }; // disken (golvkant y)
const REG = { x0: 336, x1: 362 };                    // kassaapparaten
const JOBB_SKYLT = { x: 386, y: CNT.face + 2 };      // JOBBA HÄR-skylten på disken
const GLASSD = { x0: 470, x1: 526, top: 90, y: 118 };// glassdisken till höger
const JUKE = { x: 560, y: WALL_Y + 6 };              // jukeboxen (fotlinje)
const KLOCKA = { x: 610, y: 32 };                    // neonklockan på väggen
const GUM = { x: 57, y: 97 };                        // tuggummiautomaten vid dörren
const BIN = { x: 222, y: 131 };                      // soptunnan (TACK!)
const ORDER_Y = 127;                                 // där man står och beställer
const PAY_X = 348;                                   // framför kassan
const QPOS = [380, 396, 412, 428, 444];              // NPC-kön bakom kassan
const KASS_Y = 106;                                  // kassörskans fötter (bakom disken)
const DOOR_SPOT = [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 7];
const LAMPS = [258, 330, 402, 498];                  // pendellampor med röda skärmar

// Bås (50-talsbås i röd vinyl): x = mitt, y = bordets golvkant. Två platser:
// 'down' = sitter i bakre bänken vänd mot oss, 'up' = främre bänken, ryggen mot oss.
const BOOTHS = [
  { id: 'b1', x: 84, y: 150 }, { id: 'b2', x: 186, y: 150 },
  { id: 'b3', x: 64, y: 204 }, { id: 'b4', x: 166, y: 204 },
  { id: 'b5', x: 512, y: 158 }, { id: 'b6', x: 608, y: 158 },
];
// Kromborden (runda pelarbord med två wienerstolar i krom)
const TABLES = [
  { id: 't1', x: 292, y: 184 }, { id: 't2', x: 384, y: 196 },
  { id: 't3', x: 486, y: 202 }, { id: 't4', x: 574, y: 200 },
];
const STOOLS = [242, 262, 282];                      // barstolar vid diskens vänstra del
const STOOL_Y = 133;

// ======================= små målarverktyg =======================
const WHITE = 0xffffff, INK = 0x17151a;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const c100 = (v) => clamp(v, 0, 100);
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
function rowsOf(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) area(P, x, y + i, w, 1, (X, Y) => jit(c, X, Y, 9 + i, 0.05)); }); }
// pixelkarta: en sträng per rad, tecknet slås upp i paletten ('.' = genomskinligt)
function spr(P, x, y, rows, pal, a = 1) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, c, a); }
  }
}
// mörk kontur runt allt som är målat i en Pix (tonad efter grannfärgen)
function outline(P, dark = 0x1e1418) {
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
// glasreflex: diagonala strimmor och ljusare överkant
function reflect(P, x, y, w, h, night, str = 1, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    const s = ((((X + seed) * 2 - Y * 3) % 56) + 56) % 56;
    let a = s < 4 ? 0.24 : s < 6 ? 0.1 : s === 11 || s === 12 ? 0.09 : 0;
    a += (1 - j / h) * 0.06;
    if (a > 0) P.px(X, Y, night ? 0xffd8a0 : 0xf2f8ff, a * str * (night ? 0.35 : 1));
  }
}
// text som bitmapp (valfritt spegelvänd) med kontur, skugga och högdager
function textMask(F, s, mirror = false) {
  const w = textW(F, s), pts = [];
  eachTextPixel(F, s, 0, 0, 1, (x, y) => pts.push([mirror ? w - 1 - x : x, y]));
  return { w, pts, set: new Set(pts.map(([a, b]) => a + ',' + b)) };
}
function drawText(P, M, x, y, o) {
  const has = (a, b) => M.set.has(a + ',' + b);
  if (o.shadow !== undefined) for (const [a, b] of M.pts) if (!has(a + 1, b + 1)) P.px(x + a + 1, y + b + 1, o.shadow, o.sa ?? 0.6);
  if (o.out !== undefined) for (const [a, b] of M.pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(a + dx, b + dy)) P.px(x + a + dx, y + b + dy, o.out, o.oa ?? 1);
  for (const [a, b] of M.pts) {
    let c = typeof o.fill === 'function' ? o.fill(a, b) : o.fill;
    if (o.hi !== undefined && !has(a, b - 1)) c = o.hi;
    else if (o.lo !== undefined && !has(a, b + 1)) c = o.lo;
    P.px(x + a, y + b, c, o.a ?? 1);
  }
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const isNight = (h) => h >= 19.5 || h < 6.5;
function darkness(hour) {
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}

// ======================= färgerna (Burgarbarens stil) =======================
const MINT = { hi: 0x8ad6c6, lo: 0x62b2a3 };
const VINYL = [0x5a1018, 0x8a1a26, 0xb8243a, 0xd83a4e, 0xf07080]; // röd vinyl, mörk→ljus
const CHROME = { hi: 0xf6f8fa, base: 0xd8e0e6, mid: 0x9aa4ae, lo: 0x6a747e, dk: 0x3a4048 };
const CREAM = 0xf4f1ea, GUL = 0xffd23f;
const RED = { hi: 0xe8505a, base: 0xc0262e, lo: 0x8e1a22, dk: 0x5a1018 };

// ======================= brickorna =======================
// Rätterna ritas från pixelkartorna i jobb-burgare.js (samma sprites som på
// menytavlan och fasaden). stage: 0 = hel, 1 = halväten, 2 = uppäten (smulor).
const stageCache = {};
function dishStage(id, stage) {
  const key = id + ':' + stage;
  if (stageCache[key]) return stageCache[key];
  const d = BM.dishes[DISH_IX[id]];
  const w = Math.max(...d.map.map((r) => r.length)) + 2, h = d.map.length + 2;
  const P = new Pix(w, h);
  if (stage === 0) spr(P, 1, 1, d.map, d.pal);
  else if (stage === 1) {
    if (id === 'lask') spr(P, 1, 4, d.map.slice(3), d.pal);                        // sugröret uppdrucket
    else spr(P, 1, 1, d.map.map((r) => r.slice(0, Math.ceil(r.length * 0.55))), d.pal);
    const cr = [0xd4822c, 0xf5c03a, 0x8ec0ff, 0xff88bb][DISH_IX[id]];
    P.px(w - 3, h - 3, cr); P.px(w - 5, h - 2, mul(cr, 0.7));
  } else {
    // smulor + skrynklig servett (läsken: den tomma muggen ligger på sidan)
    if (id === 'lask') {
      spr(P, 1, h - 6, ['.hCCCCc.', 'hWWrrWWc', '.hCCCCc.'], { C: 0x3a7bd5, c: 0x25539e, h: 0x8ec0ff, W: 0xf4f1ea, r: 0xe8443a });
      P.line(w - 4, h - 8, w - 1, h - 10, 0xfff4ea); P.px(w - 4, h - 7, 0xe8443a);
    } else {
      const cr = [0xd4822c, 0xf5c03a, 0x8ec0ff, 0xff88bb][DISH_IX[id]];
      P.px(3, h - 3, cr); P.px(6, h - 4, mul(cr, 0.75)); P.px(8, h - 3, cr); P.px(5, h - 2, mul(cr, 0.6));
    }
    P.px(w - 4, h - 5, 0xf4f1ea); P.px(w - 3, h - 5, 0xdcd6ca); P.px(w - 4, h - 4, 0xffffff); P.px(w - 3, h - 4, 0xb8b0a0);
  }
  if (stage === 0) outline(P);
  return (stageCache[key] = P.flush());
}
// Brickan: röd plastbricka med rutigt smörgåspapper, rätterna ovanpå.
// Kompakt: läsken står bakom i mitten, burgaren och pommesen framför – så att
// hela målet får plats på en bricka man kan bära.
const trayCache = {};
const TRAY_W = 30, TRAY_H = 24;
// flat = uppställd på ett bord (alla rätter i en rad, lägre) i stället för buren
function trayCanvas(items, flat = false) {
  const key = (flat ? 'f' : 'h') + items.map((it) => it.id + it.stage).join(',');
  if (trayCache[key]) return trayCache[key];
  const P = new Pix(TRAY_W, TRAY_H);
  // brickan (nederst) med ljuskant och skugga
  area(P, 0, TRAY_H - 5, TRAY_W, 4, (X, Y, i, j) => (j === 0 ? RED.hi : j === 3 ? RED.dk : i === 0 ? RED.hi : i === TRAY_W - 1 ? RED.dk : jit(RED.base, X, Y, 21, 0.06)));
  P.hl(1, TRAY_H - 1, TRAY_W - 2, 0x1a1014, 0.4);
  // rutigt papper
  area(P, 2, TRAY_H - 6, TRAY_W - 4, 1, (X) => ((X >> 1) & 1 ? 0xf6e8d8 : 0xe8b0a8));
  const F = P.flush(), x2 = F.getContext('2d');
  // lägen: ensam rätt i mitten; två sida vid sida; tre = en bakom + två framför
  // (på bordet ställs alla tre i en rad så att inget skymmer ansiktet)
  const spots = items.length === 1 ? [[15, 0]] : items.length === 2 ? [[9, 0], [21, 0]]
    : flat ? [[15, 0], [6, 0], [24, 0]] : [[15, -4], [8, 0], [22, 0]];
  const order = items.map((it, k) => ({ it, s: spots[Math.min(k, spots.length - 1)] })).sort((a, b) => a.s[1] - b.s[1]);
  for (const { it, s } of order) {
    const c = dishStage(it.id, it.stage);
    x2.drawImage(c, s[0] - (c.width >> 1), TRAY_H - 6 - c.height + 1 + s[1]);
  }
  return (trayCache[key] = F);
}
// brickan i händerna (bär-bildrutorna håller armarna högt)
function drawTrayHeld(ctx, x, y, dir, items) {
  if (!items || !items.length) return;
  const c = trayCanvas(items);
  const tx = dir === 'left' ? x - c.width : dir === 'right' ? x + 1 : x - (c.width >> 1);
  ctx.drawImage(c, Math.round(tx), Math.round(y) - (dir === 'up' ? 20 : 22) - (c.height - 20));
}

// ======================= bakgrunden =======================
function paintWall(P, night) {
  // taket: mörkt med kromlist och små stjärnhål (50-talsplafond)
  for (let y = 0; y < 8; y++) area(P, 0, y, W, 1, (X, Y) => {
    if (y === 6) return 0xe8eef2;
    if (y === 7) return 0x8e98a4;
    let c = mix(0x2a2230, 0x3a2e3c, y / 6);
    if (hash(X, Y, 1) > 0.985) c = 0x6a6a7a;
    return jit(c, X, Y, 2, 0.05);
  });
  // mintgrön kakelvägg
  area(P, 0, 8, W, 38, (X, Y) => {
    let c = qmix(MINT.hi, MINT.lo, (Y - 8) / 38, X, Y, 3);
    if (X % 16 === 15 || (Y - 8) % 10 === 9) c = mul(c, 0.9);       // fogarna
    if ((Y - 8) % 10 === 0) c = mix(c, WHITE, 0.12);                 // glaserad överkant
    return jit(c, X, Y, 3, 0.04);
  });
  // rosa rand + kromlist (som fasadens interiör)
  area(P, 0, 46, W, 1, (X, Y) => jit(0xe0788c, X, Y, 4, 0.05));
  area(P, 0, 47, W, 1, (X, Y) => jit(0xc45a70, X, Y, 4, 0.05));
  rowsOf(P, 0, 48, W, [0xeef3f6, 0x98a2ae]);
  // schackbård i midjehöjd
  area(P, 0, 50, W, 6, (X, Y) => (((X >> 2) + (((Y - 50) / 3) | 0)) & 1 ? CREAM : INK));
  rowsOf(P, 0, 56, W, [0xeef3f6, 0x98a2ae]);
  // röd bröstpanel med vinylränder ner till golvlisten
  area(P, 0, 58, W, WALL_Y - 58, (X, Y) => {
    let c = mix(0xb8323a, 0x962630, (Y - 58) / 24 + (bayer(X, Y) - 0.5) * 0.2);
    if (X % 24 === 0) c = mul(c, 0.78); else if (X % 24 === 1) c = mix(c, WHITE, 0.14);
    if (Y >= WALL_Y - 4) c = Y === WALL_Y - 4 ? 0xe8eef2 : Y === WALL_Y - 3 ? 0x8e98a4 : 0x3a2230;
    return c;
  });
  // pendellampor med röda emaljskärmar (skenet målas i golvet/ljuskartan)
  for (const lx of LAMPS) {
    P.vl(lx, 8, 6, 0x2a2430);
    P.rect(lx - 1, 14, 3, 1, 0x7a1a22);
    P.rect(lx - 2, 15, 5, 1, 0xc8323a); P.px(lx - 1, 15, 0xff6a6a);
    P.rect(lx - 3, 16, 7, 2, 0xc8323a); P.px(lx - 3, 16, 0xff6a6a); P.px(lx - 2, 16, 0xff8a8a); P.hl(lx - 3, 17, 7, 0x9a2028);
    P.rect(lx - 1, 18, 3, 1, 0xfff2b0); P.px(lx, 19, 0xffe07a);
    P.ell(lx + 0.5, 30, 13, 9, 0xfff0b8, night ? 0.34 : 0.22);
  }
}

// Utsikten genom fönstren och dörren: gatan, parkerade femtiotalsbilar och
// trottoaren. Målas i en egen bild och kopieras in där det är glas.
function paintOutside(P, night) {
  const O = new Pix(214, WALL_Y);
  const sky = night ? [0x121a38, 0x1e2a50] : [0x9ccfee, 0xd6ecf6];
  area(O, 0, 0, 214, WALL_Y, (X, Y) => {
    if (Y < 34) return qmix(sky[0], sky[1], (Y - 12) / 22, X, Y, 3);
    if (Y < 37) return jit(night ? 0x16261a : (hash(X >> 1, Y, 5) > 0.5 ? 0x2e5a2a : 0x3f7a34), X, Y, 6, 0.1);   // häcken
    if (Y < 40) return jit(night ? 0x3a3a40 : 0xb2ac9e, X, Y, 7, 0.08);                                           // bortre trottoaren
    if (Y < 52) {                                                                                                 // gatan
      let c = jit(night ? 0x24242a : 0x4e4e56, X, Y, 8, 0.1);
      if (Y === 45 && X % 16 < 8) c = night ? 0x8a8470 : 0xe8e2c8;
      return c;
    }
    if (Y < 53) return night ? 0x6a6660 : 0xe6dece;                                                               // kantsten
    if (Y < 54) return night ? 0x3a3834 : 0x9a9486;
    // närmaste trottoaren: stenplattor
    const r = Y - 54, rowH = 5 + Math.floor(r / 10), jy = r % rowH === 0, jx = ((X + (Math.floor(r / rowH) & 1) * 6) % 13) === 0;
    let c = jx || jy ? 0x9a9488 : jit(hash(X >> 3, Y >> 2, 9) > 0.5 ? 0xc6beb0 : 0xbcb4a6, X, Y, 10, 0.08);
    if (night) c = mix(mul(c, 0.4), 0xffb070, 0.12 + clamp((Y - 60) / 40, 0, 1) * 0.25);
    return c;
  });
  // en parkerad rosa femtiotalsbil med fenor (utanför fönster 2)
  const bx = 150, by = 44;
  area(O, bx, by, 42, 8, (X, Y, i, j) => {
    if (j < 3) return i > 8 && i < 30 ? (i === 9 || i === 29 ? 0xd884a8 : night ? 0x2a2a40 : 0x8ab4d0) : null;    // kupén
    if (j === 3) return 0xf0a0c0;
    if (j < 7) return jit(i < 3 || i > 38 ? 0xd884a8 : 0xe894b4, X, Y, 11, 0.06);                                  // flanken
    return null;
  });
  O.hl(bx - 2, by + 4, 4, 0xe894b4); O.hl(bx + 40, by + 4, 4, 0xd884a8);                                           // fenorna
  O.px(bx + 43, by + 5, 0xd83a2a); O.px(bx - 2, by + 5, night ? 0xfff6b0 : 0xf8f0d0);
  O.hl(bx, by + 7, 42, 0x9a5a78);
  for (const wx of [bx + 8, bx + 32]) { O.rect(wx - 2, by + 6, 5, 3, 0x1a1a1e); O.px(wx, by + 7, 0xd8e0e6); }
  // lyktstolpe
  O.vl(104, 22, 15, night ? 0x1a2420 : 0x2a3a34); O.rect(102, 19, 5, 3, night ? 0xffe6a0 : 0x2a3a34);
  if (night) { O.ell(104, 21, 7, 5, 0xffd890, 0.45); O.ell(104, 40, 8, 2, 0xffd890, 0.3); }
  // glödande ljus från dinern på trottoaren i kväll
  if (night) for (const w of WINS) O.ell((w.x0 + w.x1) / 2, 74, (w.x1 - w.x0) / 2 + 4, 8, 0xffc27a, 0.28);
  const glass = (X, Y) => WINS.some((w) => X >= w.x0 && X < w.x1 && Y >= WIN_T && Y < WIN_B) || (X >= DOOR.x0 && X < DOOR.x1 && Y >= DOOR.top && Y < WALL_Y);
  for (let y = 12; y < WALL_Y; y++) for (let x = 0; x < 214; x++) if (glass(x, y)) P.px(x, y, O.get(x, y));
}

// Fönstrens kromfoder, spröjs, ÖPPET-neon och fönsterbänk (ovanpå folket utanför)
function paintWinOverlay(night) {
  const P = new Pix(214, 90);
  for (const [wi, w] of WINS.entries()) {
    const x0 = w.x0, x1 = w.x1, ww = x1 - x0, wh = WIN_B - WIN_T;
    for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) P.px(x0 + i, WIN_T + j, night ? 0x1a1030 : 0xb8d8e0, 0.08);
    reflect(P, x0, WIN_T, ww, wh, night, 1, x0);
    // kromfoder runt glaset + mittpost
    area(P, x0 - 4, WIN_T - 4, ww + 8, wh + 8, (X, Y, i, j) => {
      const e = Math.min(i, j, ww + 7 - i, wh + 7 - j);
      if (e > 3) return null;
      return [CHROME.dk, CHROME.hi, CHROME.base, CHROME.mid][e];
    });
    const midX = (x0 + x1) >> 1;
    P.vl(midX - 1, WIN_T, wh, CHROME.hi); P.vl(midX, WIN_T, wh, CHROME.mid);
    P.hl(x0, WIN_T + 10, ww, CHROME.hi); P.hl(x0, WIN_T + 11, ww, CHROME.mid);
    // ÖPPET-neonet hänger i första fönstret, spegelvänd guldtext i det andra
    if (wi === 0) {
      const M = textMask(BIG, 'ÖPPET', true), nx = midX - (M.w >> 1), ny = WIN_T + 18;
      for (const [a, b] of M.pts) P.ell(nx + a + 0.5, ny + b + 0.5, 3, 3, 0xff4a5a, night ? 0.16 : 0.09, 2);
      drawText(P, M, nx, ny, { fill: night ? 0xffd8dc : 0xffb8c0, out: 0xd8303a, oa: 0.6 });
      P.px(nx - 3, ny - 4, 0x3a3a40); P.px(nx + M.w + 2, ny - 4, 0x3a3a40);
    } else {
      const M = textMask(SMALL, 'SEDAN 1955', true);
      drawText(P, M, midX - (M.w >> 1), WIN_T + 20, { fill: (a, b) => (b < 2 ? 0xf6e0a0 : 0xd0aa50), out: 0x5a3a14, oa: 0.7 });
    }
    // fönsterbänk med en liten kaktus
    rowsOf(P, x0 - 4, WIN_B + 4, ww + 8, [0xf6f8fa, 0xd8e0e6, 0x8e98a4]);
    const px = wi === 0 ? x0 + 4 : x1 - 9;
    P.rect(px, WIN_B - 1, 5, 4, 0xc8643a); P.hl(px, WIN_B - 1, 5, 0xe0845a);
    P.rect(px + 1, WIN_B - 5, 3, 4, 0x3f8a34); P.px(px + 1, WIN_B - 5, 0x6ab04a); P.px(px + 3, WIN_B - 4, 0x2e6a2a);
  }
  return P.flush();
}

function paintZoneA(P, night) {
  // dörrens kromfoder och överljus med spegelvänd text
  const d0 = DOOR.x0, d1 = DOOR.x1;
  for (let i = 0; i < 4; i++) {
    const c = [CHROME.dk, CHROME.hi, CHROME.base, CHROME.mid][i];
    P.vl(d0 - 4 + i, 12, WALL_Y - 12, c); P.vl(d1 + 3 - i, 12, WALL_Y - 12, c);
  }
  rowsOf(P, d0 - 6, 9, d1 - d0 + 12, [CHROME.hi, CHROME.base, CHROME.mid]);
  area(P, d0, 12, d1 - d0, DOOR.top - 14, (X, Y) => qmix(0x8e1a22, 0x5a1018, (Y - 12) / 8, X, Y, 2));
  const hej = textMask(SMALL, 'HEJ DÅ!', true);
  drawText(P, hej, ((d0 + d1) >> 1) - (hej.w >> 1), 14, { fill: GUL, out: 0x3a1010, oa: 0.5 });
  // UT-skylten i två kedjor
  const ux = ((d0 + d1) >> 1) - 8;
  P.px(ux + 2, 6, 0x6a6a6a); P.px(ux + 14, 6, 0x6a6a6a);
  P.rect(ux, 2, 17, 8, 0x1a2a1e); P.box(ux, 2, 17, 8, 0x0e1812);
  text(P, SMALL, 'UT', ux + 5, 4, 0x6fe08a);
  P.ell(ux + 8.5, 6, 12, 6, 0x6fe08a, 0.12, 2);
  P.hl(d0, WALL_Y - 1, d1 - d0, 0x2a1e18);
  // väggen mellan fönstren: vinylskiva; efter fönstren: inramad bil + skivor
  vinylDisc(P, 134, 34);
  carPicture(P, 213, 26, night);
  vinylDisc(P, 217, 44); vinylDisc(P, 227, 40);
}

// vinylskiva på väggen (5×5 med blänk) – som fasadens interiör
function vinylDisc(P, cx, cy) {
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    if (Math.abs(x) === 2 && Math.abs(y) === 2) continue;
    const r2 = x * x + y * y;
    let c = r2 === 0 ? 0x1a1a22 : r2 <= 1 ? (x + y < 0 ? 0xe8505a : 0xc02a3a) : 0x16161c;
    if (r2 > 1 && (x + y === -2 || x + y === -3)) c = 0x4a4a58;
    else if (r2 > 1 && x + y >= 3) c = 0x0c0c10;
    P.px(cx + x, cy + y, c);
  }
}
// inramad bild: röd femtiotalsbil med fenor under blå himmel
function carPicture(P, x, y, night) {
  P.box(x, y, 13, 9, 0xc2c8d0);
  P.hl(x, y, 13, 0xf6f8fa); P.hl(x, y + 8, 13, 0x7a808a); P.vl(x + 12, y + 1, 7, 0x9aa0a8);
  area(P, x + 1, y + 1, 11, 7, (X, Y, i, j) => (j < 3 ? (night ? 0x9ad0f8 : 0x78aed0) : j === 3 ? 0xf6e0a8 : 0xe0c088));
  P.hl(x + 4, y + 3, 5, 0xd02a3e); P.px(x + 5, y + 3, 0xbfe8ff); P.px(x + 8, y + 3, 0xf04a5a);
  P.hl(x + 2, y + 4, 9, 0xe8404a); P.px(x + 2, y + 4, GUL); P.px(x + 10, y + 4, 0xff6a6a);
  P.px(x + 3, y + 5, 0x1a1a1e); P.px(x + 8, y + 5, 0x1a1a1e);
}

// Menytavlan: svart tavla med kromram – MENY överst, de fyra rätterna på en
// rad (sprites ritas efter flush) med gula priser under, MÅL-raden nederst.
const BOARD_CELL = (i) => ({ x: BOARD.x0 + 2 + i * 15, y: BOARD.y0 + 10 });
function paintBoard(P) {
  const { x0, x1, y0, y1 } = BOARD, w = x1 - x0, h = y1 - y0;
  area(P, x0, y0, w, h, (X, Y, i, j) => {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (e === 0) return CHROME.dk;
    if (e === 1) return i === 1 || j === 1 ? CHROME.hi : CHROME.mid;
    let c = jit(0x1e1c24, X, Y, 30, 0.06);
    if ((j - 2) % 4 === 3) c = 0x32303a;                       // de räfflade listerna
    return c;
  });
  const title = textMask(SMALL, 'MENY');
  drawText(P, title, x0 + ((w - title.w) >> 1), y0 + 2, { fill: GUL });
  for (let x = x0 + 4; x < x1 - 4; x += 2) P.px(x, y0 + 8, 0xd83a4e, 0.8);
  BM.dishes.forEach((d, i) => {
    const c = BOARD_CELL(i);
    const pm = textMask(SMALL, d.label);
    drawText(P, pm, c.x + 1, c.y + 16, { fill: GUL });
  });
  // MÅL-raden längst ner
  const mm = textMask(SMALL, 'MÅL 25:-');
  drawText(P, mm, x0 + ((w - mm.w) >> 1), y1 - 8, { fill: 0xff9ac0 });
}

// Köksluckan: kromram, kakel, KÖK-skylt, orderlist med lappar, upphängda
// stekpannor, grillen, fritösen och passet. Kocken, lågorna, burgarna och
// ångan ritas live (drawKitchen).
function paintHatch(P) {
  const { x0, x1, y0, y1 } = HATCH;
  // kromramen
  P.box(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, CHROME.mid);
  P.box(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4, CHROME.hi);
  P.box(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, CHROME.dk);
  // kakel därinne
  area(P, x0, y0, x1 - x0, y1 - y0, (X, Y) => {
    const gl = (X - x0) % 5 === 4 || (Y - y0) % 4 === 3;
    return gl ? 0xc4cac8 : mix(0xf4f6f2, 0xe2e6e2, hash(X >> 2, Y >> 2, 9) * 0.6);
  });
  // KÖK-skylten mitt på, orderlisten med lappar på båda sidor
  const mx = (x0 + x1) >> 1;
  P.hl(x0 + 2, y0 + 3, x1 - x0 - 4, 0xeef3f6); P.hl(x0 + 2, y0 + 4, x1 - x0 - 4, 0x98a2ae);
  P.rect(mx - 11, y0, 22, 9, INK); P.box(mx - 11, y0, 22, 9, 0xd0aa50);
  text(P, SMALL, 'KÖK', mx - 5, y0 + 2, GUL);
  for (const [lx, lh] of [[x0 + 6, 7], [x0 + 17, 6], [x0 + 42, 8], [x1 - x0 - 44 + x0, 6], [x1 - x0 - 30 + x0, 8], [x1 - x0 - 16 + x0, 6]]) {
    P.rect(lx, y0 + 5, 7, lh, 0xfffdf4); P.hl(lx, y0 + 5 + lh, 7, 0xc8c2b2);
    for (let r = y0 + 7; r < y0 + 4 + lh; r += 2) P.hl(lx + 1, r, 3 + ((r + lx) % 3), 0x8a8478);
  }
  // upphängda stekpannor och en slev på krokar
  for (const [px, pw] of [[x0 + 4, 7], [x0 + 13, 9]]) {
    P.px(px + (pw >> 1), y0 + 15, 0x5a646e);
    P.hl(px, y0 + 20, pw, 0x2a2d33); P.hl(px, y0 + 19, pw, 0x4a4e56); P.vl(px + (pw >> 1), y0 + 16, 3, 0x2a2d33);
  }
  P.px(x1 - 24, y0 + 15, 0x5a646e); P.vl(x1 - 24, y0 + 16, 5, CHROME.mid); P.rect(x1 - 26, y0 + 21, 5, 2, CHROME.base);
  // grillen (vänster): stekbord med front – kocken står bakom, ritas live
  P.rect(x0 + 4, y1 - 8, 50, 6, 0x4a4e56); P.hl(x0 + 4, y1 - 8, 50, 0x7a808a); P.hl(x0 + 4, y1 - 3, 50, 0x2a2d33);
  // fritösen (mitten-höger): två korgar över oljan
  P.rect(x0 + 58, y1 - 10, 26, 8, 0x8e98a4); P.box(x0 + 58, y1 - 10, 26, 8, 0x5a646e);
  P.rect(x0 + 60, y1 - 8, 22, 3, 0xe0a030); P.hl(x0 + 60, y1 - 8, 22, 0xffd060);
  for (const bx of [x0 + 63, x0 + 73]) { P.vl(bx, y1 - 14, 5, 0x2a2d33); P.hl(bx - 1, y1 - 15, 3, INK); }
  // passet (höger): kromhylla med värmelampa och klockan (plingas live)
  P.rect(x1 - 22, y1 - 4, 20, 2, CHROME.base); P.hl(x1 - 22, y1 - 4, 20, CHROME.hi);
  P.rect(x1 - 21, y1 - 13, 18, 1, 0xd83a4e); P.px(x1 - 12, y1 - 12, 0xffd060);
  P.ell(x1 - 12, y1 - 7, 8, 3, 0xffd890, 0.3, 3);
  spr(P, x1 - 7, y1 - 8, ['.gg.', 'gGGg', 'gggg', '.k..'], { g: 0xd0aa50, G: 0xf6e0a0, k: 0x3a2a10 }); // klockan
}

// Bakdisken: milkshakemaskinen, läskfontänen, kaffebryggaren, muggtravar och
// sugrörshållaren – allt i krom mot den röda panelen.
function paintBackCounter(P) {
  area(P, BACK.x0, BACK.top, BACK.x1 - BACK.x0, 3, (X, Y, i, j) => jit([0xf6f8fa, 0xd8e0e6, 0x98a2ae][j], X, Y, 43, 0.04));
  area(P, BACK.x0, BACK.top + 3, BACK.x1 - BACK.x0, BACK.y - BACK.top - 3, (X, Y, i, j) => {
    let c = jit(0xa8222c, X, Y, 44, 0.06);
    if ((X - BACK.x0) % 22 === 0) c = mul(c, 0.75); else if ((X - BACK.x0) % 22 === 1) c = mix(c, WHITE, 0.14);
    if (j === 0) return 0x6a141c;
    return c;
  });
  rowsOf(P, BACK.x0, BACK.y - 2, BACK.x1 - BACK.x0, [0x2a1a10, 0x1a100a]);
  // milkshakemaskinen: tre kromtorn med bägare i pastell (under menytavlan)
  const mx = 240;
  for (let k = 0; k < 3; k++) {
    const x = mx + k * 9;
    P.rect(x, 52, 6, 14, 0x2a2a30); P.vl(x, 52, 14, 0x4a4a54); P.vl(x + 5, 52, 14, 0x0e0e12);
    P.rect(x - 1, 50, 8, 3, CHROME.base); P.hl(x - 1, 50, 8, CHROME.hi);
    P.vl(x + 2, 55, 3, CHROME.base);                                       // vispaxeln
    const cup = [0xf0a0c0, 0xb8e0c8, 0xf6e0a0][k];
    P.rect(x + 1, 58, 4, 6, cup); P.hl(x + 1, 58, 4, mix(cup, WHITE, 0.4)); P.vl(x + 4, 58, 6, mul(cup, 0.7));
    P.px(x + 2, 57, 0xffffff);
  }
  // läskfontänen med tre kranar och SODA-skylt (under menytavlan)
  const sx = 274;
  P.rect(sx, 50, 34, 16, 0xb8c2cc); P.hl(sx, 50, 34, 0xe8eef2); P.vl(sx + 33, 51, 15, 0x6a747e);
  P.rect(sx + 3, 51, 28, 7, 0x17301f); P.box(sx + 3, 51, 28, 7, 0xd0aa50);
  text(P, SMALL, 'SODA', sx + 9, 52, 0x6fe08a);
  for (let k = 0; k < 3; k++) {
    const x = sx + 6 + k * 9;
    P.rect(x, 59, 3, 3, [0xc0262e, 0x3a7bd5, 0xe0a030][k]); P.px(x, 59, WHITE);
    P.rect(x, 62, 3, 1, 0x2a2a30); P.px(x + 1, 63, 0x1a1a1e);
  }
  P.hl(sx + 4, 64, 26, 0x8e98a4);
  // sugrörshållare + muggtravar vid passet
  P.rect(428, 56, 6, 10, 0xd8e0e6); P.hl(428, 56, 6, 0xf6f8fa);
  for (let k = 0; k < 5; k++) P.vl(429 + k, 52, 4, k & 1 ? 0xe8443a : 0xf4f1ea);
  for (let k = 0; k < 4; k++) { P.rect(440, 62 - k * 2, 6, 2, 0xf4f1ea); P.hl(440, 63 - k * 2, 6, 0xd0c8bc); }
  P.rect(440, 64, 6, 2, 0xc0262e);
  // kaffebryggaren i hörnet
  P.rect(233, 52, 4, 14, 0x2a2a30); P.vl(233, 52, 14, 0x4a4a54);
  P.rect(230, 58, 6, 8, 0x1a1a20);
  area(P, 230, 59, 5, 6, (X, Y, i, j) => (i === 0 || i === 4 ? 0xc8dce8 : j > 2 ? 0x4a2412 : null));
  P.px(236, 54, 0xff3a2a);
}

// Disken: laminatskiva, röd plisserad front med kromband, kassaapparaten,
// JOBBA HÄR-skylten, ketchup- och senapspumpar, servettställ.
function paintCounter() {
  const ox = CNT.x0 - 2, oy = 88;
  const P = new Pix(CNT.x1 - CNT.x0 + 4, CNT.y - oy + 3, ox, oy);
  const x0 = CNT.x0, x1 = CNT.x1, w = x1 - x0;
  // skivan: ljust laminat med boomerang-mönster
  area(P, x0, CNT.top, w, CNT.face - CNT.top - 1, (X, Y, i, j) => {
    let c = j === 0 ? 0xfffaf0 : mix(0xf0e8d8, 0xe2d8c4, (j) / 6 + (hash(X, Y, 2) - 0.5) * 0.3);
    if (j > 0 && hash(X >> 2, Y, 100) > 0.92) c = 0xc8b8a0;                 // boomerangerna
    return c;
  });
  P.hl(x0, CNT.face - 1, w, 0xfffaf2);
  P.hl(x0, CNT.face, w, 0xc8beb0);
  // fronten: röd plisserad vinyl med kromband
  area(P, x0, CNT.face + 1, w, CNT.y - CNT.face - 1, (X, Y, i, j) => {
    let c = mix(0xc0262e, 0x8e1a22, j / 15);
    const k = (X - x0) % 6;
    if (k === 0) c = mul(c, 0.7); else if (k === 1) c = mix(c, WHITE, 0.16);
    if (Y === CNT.face + 8 || Y === CNT.face + 9) c = Y === CNT.face + 8 ? 0xeef3f6 : 0x98a2ae;   // kromband
    if (Y >= CNT.y - 3) c = [0xd8b24a, 0x7a5a24, 0x2a1a1e][Y - (CNT.y - 3)];                       // sparklist
    return c;
  });
  P.vl(x0, CNT.top, CNT.y - CNT.top, 0x5a1018); P.vl(x1 - 1, CNT.top, CNT.y - CNT.top, 0x5a1018);
  // kassaapparaten i krom med kvittorulle
  const rx = REG.x0;
  area(P, rx, CNT.top - 9, 22, 9, (X, Y, i, j) => (j === 0 ? CHROME.hi : i === 0 ? CHROME.hi : i === 21 ? CHROME.dk : j === 8 ? CHROME.dk : jit(CHROME.base, X, Y, 108, 0.06)));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) P.px(rx + 3 + i * 3, CNT.top - 7 + j * 2, j === 0 ? 0xfaf8f0 : 0x2a2a2a);
  area(P, rx + 3, CNT.top - 15, 16, 6, (X, Y, i, j) => (j === 0 ? CHROME.hi : i === 0 || i === 15 ? CHROME.mid : 0x1a1a1a));
  P.rect(rx + 5, CNT.top - 14, 11, 3, 0x2a3a2a);
  P.vl(rx + 22, CNT.top - 8, 5, CHROME.dk); P.px(rx + 23, CNT.top - 8, 0x3a2a1a); P.px(rx + 23, CNT.top - 7, 0xfaf0d0);
  // JOBBA HÄR-skylten (tältskylt på disken)
  const jm = textMask(SMALL, 'JOBBA HÄR');
  const jx = JOBB_SKYLT.x - (jm.w >> 1);
  P.rect(jx - 3, CNT.top - 10, jm.w + 6, 10, 0x17301f);
  P.box(jx - 3, CNT.top - 10, jm.w + 6, 10, 0xd0aa50);
  P.hl(jx - 2, CNT.top - 9, jm.w + 4, 0xf6e0a0, 0.5);
  drawText(P, jm, jx, CNT.top - 7, { fill: (a, b) => (b < 2 ? 0xf6e0a0 : 0xd0aa50), shadow: 0x06100a, sa: 0.9 });
  // BESTÄLL HÄR på fronten vid kassan
  const bm = textMask(SMALL, 'BESTÄLL HÄR');
  P.rect(REG.x0 - 8, CNT.face + 3, bm.w + 8, 9, INK);
  P.box(REG.x0 - 8, CNT.face + 3, bm.w + 8, 9, CHROME.mid);
  drawText(P, bm, REG.x0 - 4, CNT.face + 5, { fill: CREAM });
  // ketchup- och senapspumpar + servettställ på skivan
  for (const [px, c1, c2] of [[248, 0xd9302a, 0x5a1414], [258, 0xf0c428, 0x6a5010]]) {
    P.rect(px, CNT.top - 6, 5, 6, c2); P.rect(px, CNT.top - 5, 4, 4, c1); P.px(px, CNT.top - 5, mix(c1, WHITE, 0.4));
    P.rect(px + 1, CNT.top - 8, 3, 2, CHROME.base); P.px(px + 3, CNT.top - 9, CHROME.mid);
  }
  P.rect(298, CNT.top - 6, 7, 6, 0xc8d0d8); P.hl(298, CNT.top - 6, 7, 0xf4f8fa); P.rect(299, CNT.top - 9, 5, 3, 0xffffff);
  // sockerströare och menyhållare
  P.rect(314, CNT.top - 5, 3, 5, 0xe8f4f8); P.px(315, CNT.top - 6, CHROME.mid);
  P.rect(438, CNT.top - 7, 8, 7, 0xfffdf4); P.box(438, CNT.top - 7, 8, 7, CHROME.mid); P.hl(440, CNT.top - 5, 4, 0x8a8478);
  outline(P, 0x1a1210);
  return { img: P.flush(), ox, oy };
}

// Glassdisken: svängd glasmonter med glasstrutar, sundaeglas och tre baljor
// glass (jordgubb, choklad, pistage) på kylrost – GLASS-skylt ovanpå.
function paintGlassdisk() {
  const ox = GLASSD.x0 - 2, oy = 52;
  const P = new Pix(GLASSD.x1 - GLASSD.x0 + 4, GLASSD.y - oy + 3, ox, oy);
  const x0 = GLASSD.x0, x1 = GLASSD.x1, w = x1 - x0;
  // korpusen: krom med rosa front
  area(P, x0, GLASSD.top, w, GLASSD.y - GLASSD.top, (X, Y, i, j) => {
    if (j === 0) return CHROME.hi;
    if (j === 1) return CHROME.mid;
    if (Y >= GLASSD.y - 3) return [0xd8b24a, 0x7a5a24, 0x2a1a1e][Y - (GLASSD.y - 3)];
    let c = mix(0xf0a0c0, 0xd8779c, j / 22);
    const k = (X - x0) % 6;
    if (k === 0) c = mul(c, 0.78); else if (k === 1) c = mix(c, WHITE, 0.2);
    if (Y === GLASSD.top + 12) c = 0xeef3f6; if (Y === GLASSD.top + 13) c = 0x98a2ae;
    return c;
  });
  P.vl(x0, GLASSD.top, GLASSD.y - GLASSD.top, 0x8a4a68); P.vl(x1 - 1, GLASSD.top, GLASSD.y - GLASSD.top, 0x8a4a68);
  // glasmontern ovanpå med baljorna
  const gt = 76, gb = GLASSD.top;
  area(P, x0 + 2, gt, w - 4, gb - gt, (X, Y, i, j) => (j === 0 ? 0xfff4d0 : qmix(0xd8ecf4, 0x9ab8c8, j / (gb - gt), X, Y, 3)));
  for (const [k, cols] of [[0, [0xf07080, 0xd83a4e]], [1, [0x6e4228, 0x4a2a18]], [2, [0x9ccc6a, 0x74a84e]]]) {
    const bx = x0 + 5 + k * 16;
    P.rect(bx, gb - 7, 13, 6, CHROME.base); P.hl(bx, gb - 7, 13, CHROME.hi);
    area(P, bx + 1, gb - 6, 11, 3, (X, Y, i, j) => jit(hash(X, Y, 60 + k) > 0.5 ? cols[0] : cols[1], X, Y, 61 + k, 0.1));
    P.px(bx + 3, gb - 7, WHITE); P.px(bx + 8, gb - 8, CHROME.mid);                       // glasskopan
  }
  reflect(P, x0 + 2, gt, w - 4, gb - gt, false, 0.8, 3);
  P.hl(x0 + 2, gt, w - 4, 0xffffff, 0.5);
  for (const fx of [x0, x0 + 1, x1 - 2, x1 - 1]) P.vl(fx, gt - 2, gb - gt + 2, fx === x0 || fx === x1 - 2 ? CHROME.mid : CHROME.dk);
  // strutar i hållare + sundaeglas på skivan
  const kx = x1 - 12;
  for (let k = 0; k < 3; k++) { P.line(kx + k * 3, gt - 6, kx + 1 + k * 3, gt - 1, 0xecb466); P.px(kx + k * 3, gt - 7, [0xf07080, 0xfff4d0, 0x9ccc6a][k]); }
  P.rect(kx - 1, gt - 1, 11, 2, CHROME.base);
  spr(P, x0 + 3, gt - 8, ['.p.', 'nGn', '.g.', '.k.', 'kKk'], { p: 0xff88bb, n: 0xd4fae6, G: 0x7fdcae, g: 0x3fae7a, k: 0xb8742c, K: 0xecb466 });
  // GLASS-skylten
  const gm = textMask(SMALL, 'GLASS');
  P.rect(x0 + ((w - gm.w) >> 1) - 3, gt - 16, gm.w + 6, 9, 0x2a1a2e);
  P.box(x0 + ((w - gm.w) >> 1) - 3, gt - 16, gm.w + 6, 9, 0xff88bb);
  drawText(P, gm, x0 + ((w - gm.w) >> 1), gt - 14, { fill: 0xffd0e4 });
  outline(P, 0x1a1210);
  return { img: P.flush(), ox, oy };
}

// ======================= möblerna (egna bilder, ritas i djupordning) =======================
// Båsets bakre bänk: hög rygg i röd kanalstoppad vinyl med kromlist
function paintBenchBack() {
  const P = new Pix(38, 26);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 38; x++) {
    if (y === 0 && (x < 2 || x > 35)) continue;
    let c;
    if (y === 0) c = CHROME.hi;
    else if (y === 1) c = x < 2 || x > 35 ? CHROME.mid : VINYL[4];
    else {
      const u = (x + (Math.floor((y - 2) / 6) & 1) * 5) % 10, v = (y - 2) % 6;
      const d = Math.abs(u - 5) / 5 + Math.abs(v - 3) / 3;
      c = d < 0.5 ? VINYL[3] : d < 1 ? VINYL[2] : VINYL[1];
      if (u === 5 && v === 3) c = VINYL[0];                       // knapparna
      if (x < 2 || x > 35) c = x === 0 || x === 37 ? VINYL[0] : VINYL[1];
      if (y > 19) c = mul(c, 0.85);
    }
    P.px(x, y, jit(c, x, y, 72, 0.05));
  }
  rowsOf(P, 1, 24, 36, [VINYL[2], VINYL[0]]);                     // sitsen skymtar
  outline(P);
  return P.flush();
}
// Båsets främre bänk: vi ser ryggens baksida (slät vinyl med kromlist)
function paintBenchFront() {
  const P = new Pix(38, 17);
  for (let y = 0; y < 17; y++) for (let x = 0; x < 38; x++) {
    if (y === 0 && (x < 2 || x > 35)) continue;
    let c;
    if (y === 0) c = CHROME.hi;
    else if (y === 1) c = CHROME.mid;
    else if (y === 16) c = VINYL[0];
    else {
      c = x < 3 ? VINYL[3] : x > 33 ? VINYL[1] : VINYL[2];
      if ((y - 2) % 5 === 4) c = mul(c, 0.8);                     // sömmarna
      if (y > 12) c = mul(c, 0.85);
    }
    P.px(x, y, jit(c, x, y, 73, 0.05));
  }
  outline(P);
  return P.flush();
}
// Båsbordet: vit laminatskiva med kromkant på ett kromben
function paintBoothTable() {
  const P = new Pix(36, 22);
  area(P, 1, 0, 34, 7, (X, Y, i, j) => {
    if (j === 0) return 0xffffff;
    if (j === 5) return CHROME.hi;
    if (j === 6) return CHROME.mid;
    let c = jit(0xf4efe6, X, Y, 74, 0.04);
    if (hash(X >> 2, Y, 101) > 0.9) c = 0xd8c8b0;                 // boomerangerna
    return c;
  });
  P.rect(16, 7, 3, 11, 0x2a2a30); P.vl(16, 7, 11, CHROME.mid);
  P.rect(12, 18, 11, 2, CHROME.dk); P.hl(12, 18, 11, CHROME.mid);
  outline(P);
  return P.flush();
}
// kromstol med röd sits (matchar borden): 'down' = framifrån, 'up' = bakifrån
function paintChair(dir) {
  const back = (T, top) => {
    T.vl(3, top, 9, CHROME.mid); T.vl(12, top, 9, CHROME.dk);
    for (let x = 4; x < 12; x++) T.px(x, top - 1, CHROME.hi);
    area(T, 4, top, 8, 6, (X, Y, i, j) => jit(j === 0 ? VINYL[4] : VINYL[2], X, Y, 75, 0.06));
  };
  const P = new Pix(16, 24);
  if (dir === 'down') back(P, 3);
  // sitsen
  for (let x = 2; x < 14; x++) { P.px(x, 12, x < 5 ? VINYL[4] : VINYL[3]); P.px(x, 13, VINYL[2]); P.px(x, 14, VINYL[1]); }
  P.hl(2, 15, 12, CHROME.mid);
  // benen i krom
  P.line(3, 16, 2, 23, CHROME.mid); P.line(12, 16, 13, 23, CHROME.dk);
  P.line(5, 16, 5, 21, CHROME.base); P.line(10, 16, 10, 21, CHROME.mid);
  outline(P);
  if (dir === 'down') return { img: P.flush() };
  const R = new Pix(16, 24);
  back(R, 3); // ryggen ritas framför den som sitter med ryggen mot oss
  outline(R);
  return { img: P.flush(), front: R.flush() };
}
// runt pelarbord i krom med röd kant
function paintTable() {
  const P = new Pix(30, 20);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 30; x++) {
    const d = Math.hypot((x + 0.5 - 15) / 14.5, (y + 0.5 - 3.5) / 3.5);
    if (d > 1) continue;
    let c = y < 1 ? 0xffffff : d > 0.8 && y > 3 ? 0xd8d0c4 : 0xf4efe6;
    if (hash(x >> 1, y, 93) > 0.9 && y > 0) c = 0xd8c8b0;
    P.px(x, y, c);
  }
  for (let x = 2; x < 28; x++) { const e = Math.abs(x + 0.5 - 15) > 11; P.px(x, e ? 5 : 6, RED.base); if (!e) P.px(x, 7, RED.lo); }
  P.rect(14, 8, 2, 8, 0x2a2a30); P.vl(14, 8, 8, CHROME.mid);
  P.rect(10, 16, 10, 2, CHROME.dk); P.hl(10, 16, 10, CHROME.mid);
  outline(P);
  return P.flush();
}
// barstol i krom med röd toppdyna
function paintStool() {
  const P = new Pix(12, 15);
  for (let x = 1; x < 11; x++) { P.px(x, 0, x < 4 ? VINYL[4] : VINYL[2]); P.px(x, 1, VINYL[1]); P.px(x, 2, VINYL[0]); }
  P.hl(2, 0, 3, 0xf49098);
  P.hl(1, 3, 10, CHROME.hi);
  P.vl(5, 4, 9, CHROME.base); P.vl(6, 4, 9, CHROME.mid);
  P.hl(3, 9, 6, CHROME.base); P.px(2, 9, CHROME.mid); P.px(9, 9, CHROME.mid);
  P.hl(2, 13, 8, CHROME.mid); P.hl(3, 14, 6, CHROME.lo);
  outline(P);
  return P.flush();
}
// jukeboxen: bågformad topp i körsbärsträ, lysande båge, skivfönster, knappar
function paintJukebox() {
  const P = new Pix(34, 44);
  const RADIE = 16;
  for (let y = 0; y < 44; y++) for (let x = 0; x < 34; x++) {
    const dx = x - 16.5, topY = 16 - Math.sqrt(Math.max(0, RADIE * RADIE - dx * dx));
    if (y < topY) continue;
    let c = jit(0x6a2e1a, x, y, 80, 0.08);
    if (x < 3 || x > 30) c = jit(0x4a1e10, x, y, 81, 0.06);
    P.px(x, y, c);
  }
  // den lysande bågen (två band: gult och rött)
  for (let x = 2; x < 32; x++) {
    const dx = x - 16.5, ty = 16 - Math.sqrt(Math.max(0, 14.5 * 14.5 - dx * dx));
    P.px(x, Math.round(ty), 0xffd060); P.px(x, Math.round(ty) + 1, 0xe8443a);
    const ty2 = 16 - Math.sqrt(Math.max(0, 11 * 11 - dx * dx));
    if (Math.abs(dx) < 11) P.px(x, Math.round(ty2) + 1, 0x6ad0a0);
  }
  // skivfönstret med vinylskivan
  area(P, 9, 10, 16, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === 15 || j === 8 ? 0xd0aa50 : 0x101018));
  vinylDisc(P, 17, 14);
  P.px(12, 12, 0x8ec0ff); P.px(22, 16, 0x8ec0ff);
  // titellistan och knappraden
  P.rect(7, 21, 20, 5, 0xf4f1ea); P.box(7, 21, 20, 5, 0xd0aa50);
  for (let r = 22; r < 25; r += 2) P.hl(9, r, 12 + (r & 3), 0x8a8478);
  for (let k = 0; k < 6; k++) P.px(8 + k * 3, 28, [0xe8443a, 0xffd060, 0x6ad0a0, 0x3a7bd5, 0xff88bb, 0xf4f1ea][k]);
  P.hl(6, 30, 22, 0xd0aa50);
  // högtalargallret bakom bågen nertill
  area(P, 6, 32, 22, 8, (X, Y, i, j) => ((i + j) & 1 ? 0x2a1810 : 0x4a2c1a));
  P.rect(4, 40, 26, 3, 0x3a1c10); P.hl(4, 40, 26, 0x6a2e1a);
  outline(P);
  return { img: P.flush(), ox: 17, oy: 43 };
}
// tuggummiautomaten: glaskula full av kulor på röd fot
function paintGumball() {
  const P = new Pix(14, 24);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 14; x++) {
    const d = Math.hypot((x - 6.5) / 6, (y - 5.5) / 5.5);
    if (d > 1) continue;
    let c = 0xd8ecf4;
    if (d < 0.85 && y > 2) c = [0xe8443a, 0xffd060, 0x6ad0a0, 0x3a7bd5, 0xff88bb][(hash(x, y, 90) * 5) | 0];
    if (x < 4 && y < 4) c = mix(c, WHITE, 0.5);
    P.px(x, y, c);
  }
  P.rect(5, 0, 4, 2, CHROME.mid); P.hl(5, 0, 4, CHROME.hi);
  P.rect(3, 11, 8, 3, CHROME.base); P.hl(3, 11, 8, CHROME.hi);
  area(P, 4, 14, 6, 8, (X, Y, i, j) => jit(i === 0 ? RED.hi : i === 5 ? RED.lo : RED.base, X, Y, 91, 0.06));
  P.rect(5, 15, 4, 3, CHROME.dk); P.px(6, 16, CHROME.base);       // luckan
  P.rect(2, 22, 10, 2, RED.dk); P.hl(2, 22, 10, RED.lo);
  outline(P);
  return { img: P.flush(), ox: 7, oy: 23 };
}
// soptunnan med vipplock: TACK!
function paintBin() {
  const P = new Pix(16, 22);
  area(P, 1, 4, 14, 17, (X, Y, i, j) => {
    let c = i < 3 ? RED.hi : i > 10 ? RED.lo : RED.base;
    if (j === 16) c = RED.dk;
    return jit(c, X, Y, 92, 0.06);
  });
  P.rect(0, 2, 16, 3, 0x8e1a22); P.hl(0, 2, 16, 0xd83a4e);
  P.rect(3, 0, 10, 3, 0x6a141c); P.hl(3, 0, 10, 0xa8222c);        // vipplocket
  const tm = textMask(SMALL, 'TACK');
  drawText(P, tm, 1, 9, { fill: CREAM });
  outline(P);
  return { img: P.flush(), ox: 8, oy: 21 };
}
// neonklockan på väggen: rosa ring, visarna ritas live
function paintClockFace(P) {
  const cx = KLOCKA.x, cy = KLOCKA.y;
  P.ell(cx, cy, 13, 13, 0xff88bb, 0.14, 3);
  for (let a = 0; a < 48; a++) { const th = a / 48 * Math.PI * 2; P.px(Math.round(cx + Math.cos(th) * 10), Math.round(cy + Math.sin(th) * 10), 0xff88bb); }
  for (let a = 0; a < 48; a++) { const th = a / 48 * Math.PI * 2; P.px(Math.round(cx + Math.cos(th) * 8.2), Math.round(cy + Math.sin(th) * 8.2), 0xf4f1ea, 0.9); }
  area(P, cx - 7, cy - 7, 15, 15, (X, Y) => (Math.hypot(X - cx, Y - cy) <= 7.2 ? 0x201e28 : null));
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(cx + Math.sin(a) * 5.6), Math.round(cy - Math.cos(a) * 5.6), k % 3 ? 0x8a8898 : GUL); }
}

// Golvet: schackrutigt i rött och kräm (som serveringsjobbet), skuggor under
// allt som står på det, solfläckar från fönstren om dagen.
function paintFloor(P, night) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const cx2 = ((x / 16) | 0) + (((y - WALL_Y) / 12) | 0);
    let c = cx2 % 2 ? 0xd8d2c6 : 0xb8302e;
    c = mul(c, 0.95 + hash(x, y, 4) * 0.08);
    if ((x % 16 === 0 || (y - WALL_Y) % 12 === 0)) c = mul(c, 0.88);         // fogen
    if (y < WALL_Y + 4) c = mul(c, 0.78 + (y - WALL_Y) * 0.055);             // skugga under väggen
    if (hash(x, y, 81) > 0.985) c = mix(c, WHITE, 0.3);                      // glasyrens blänk
    P.px(x, y, jit(c, x, y, 82, 0.04));
  }
  if (!night) {
    // solen faller in genom fönstren och dörren, snett åt höger
    const patch = (x0, x1, y0, len) => {
      for (let j = 0; j < len; j++) {
        const y = y0 + j, sh = j * 0.55, a = 0.24 * (1 - j / len) + 0.06;
        for (let x = Math.round(x0 + sh); x < Math.round(x1 + sh); x++) if (bayer(x, y) < 0.8) P.px(x, y, 0xfff4d8, a);
      }
    };
    for (const w of WINS) patch(w.x0, w.x1, WALL_Y + 2, 24);
    patch(DOOR.x0 + 4, DOOR.x1 - 4, WALL_Y + 1, 28);
  }
  // varma ljuspölar under lamporna
  for (const lx of LAMPS) P.ell(lx + 2, CNT.y + 8, 18, 5, 0xffd890, night ? 0.22 : 0.1, 3);
  // skuggorna
  for (const B of BOOTHS) { P.ell(B.x, B.y + 1, 20, 3, 0x1a1014, 0.35, 3); P.ell(B.x, B.y + 15, 20, 2.5, 0x1a1014, 0.3, 2); }
  for (const T of TABLES) { P.ell(T.x, T.y, 15, 3, 0x1a1014, 0.35, 3); P.ell(T.x - 6, T.y - 5, 7, 2, 0x1a1014, 0.3, 2); P.ell(T.x + 8, T.y + 10, 7, 2, 0x1a1014, 0.3, 2); }
  for (const sx of STOOLS) P.ell(sx, STOOL_Y, 5, 1.6, 0x1a1014, 0.35, 2);
  P.ell(JUKE.x, JUKE.y, 15, 2.6, 0x1a1014, 0.4, 2);
  P.ell(GUM.x, GUM.y, 6, 1.8, 0x1a1014, 0.4, 2);
  P.ell(BIN.x, BIN.y, 8, 2, 0x1a1014, 0.4, 2);
  P.darken(CNT.x0, CNT.y, CNT.x1 - CNT.x0, 2, 0.62); P.darken(CNT.x0, CNT.y + 2, CNT.x1 - CNT.x0, 1, 0.8);
  P.darken(GLASSD.x0, GLASSD.y, GLASSD.x1 - GLASSD.x0, 2, 0.62);
  // det blanka golvet speglar diskens röda front
  for (let j = 1; j < 8; j++) for (let x = CNT.x0; x < GLASSD.x1; x++) {
    if (x >= CNT.x1 && x < GLASSD.x0) continue;
    if (bayer(x, CNT.y + j) < 0.7) P.px(x, CNT.y + j, x >= GLASSD.x0 ? 0xd8779c : RED.base, 0.2 * (1 - j / 8));
  }
}
function paintSides(P) {
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, H, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WALL_Y + (5 - k) * 2) return null;
    return jit(Y < 8 ? 0x241c28 : Y < 46 ? mul(MINT.lo, 0.62 + k * 0.04) : mul(0x8e1a22, 0.6 + k * 0.04), X, Y, 91, 0.04);
  });
  P.box(0, 0, W, H, 0x0e0d12);
}

function paintBg(night) {
  const P = new Pix(W, H);
  paintWall(P, night);
  paintFloor(P, night);
  paintOutside(P, night);
  paintZoneA(P, night);
  paintBoard(P);
  paintHatch(P);
  paintBackCounter(P);
  paintClockFace(P);
  // neonskylten BURGARE i kursivt gult över glassdisken/jukeboxen
  const neon = textMask(BIG, 'BURGARE'), nx = 540, ny = 14;
  for (const [a, b] of neon.pts) P.ell(nx + a + 0.5, ny + b + 0.5, 3.2, 3.2, 0xffb030, night ? 0.14 : 0.08, 2);
  drawText(P, neon, nx, ny, { fill: 0xfff0d8, out: 0xe8912a, oa: 0.55 });
  P.hl(nx - 2, ny + 9, neon.w + 4, 0x6a6a6a, 0.6);
  paintSides(P);
  const cv = P.flush(), c2 = cv.getContext('2d');
  // rätterna på menytavlan (samma sprites som i jobbet och på fasaden)
  BM.dishes.forEach((d, i) => {
    const c = BOARD_CELL(i);
    c2.drawImage(d.sprite, c.x + ((15 - d.sprite.width) >> 1), c.y + 14 - d.sprite.height);
  });
  return cv;
}

// Kvällens ljuskarta: varma pölar i dithrade steg (läggs på med 'lighter')
function paintNightLight() {
  const P = new Pix(W, H);
  const AMB = 0xff9c48;
  for (const lx of LAMPS) { P.ell(lx + 0.5, 60, 30, 42, AMB, 0.24, 5); P.ell(lx + 0.5, 20, 9, 6, 0xffe0a0, 0.45, 3); }
  P.ell(348, 100, 120, 22, AMB, 0.16, 4);                                     // disken
  P.ell((HATCH.x0 + HATCH.x1) / 2, 44, 70, 26, 0xffd890, 0.22, 4);            // köksluckan lyser
  P.ell(498, 96, 40, 14, 0xffb8d8, 0.2, 4);                                   // glassdisken
  P.ell(JUKE.x, JUKE.y - 26, 30, 26, 0xffc060, 0.3, 5);                        // jukeboxen
  P.ell(575, 20, 44, 14, 0xffb030, 0.2, 4);                                   // neonskylten
  P.ell(KLOCKA.x, KLOCKA.y, 18, 16, 0xff88bb, 0.18, 3);                       // neonklockan
  for (const w of WINS) P.ell((w.x0 + w.x1) / 2, WIN_T + 6, (w.x1 - w.x0) / 2 + 6, 10, 0xffd890, 0.18, 3);
  return P.flush();
}

// Kromdörren (gångjärn till vänster) i bildrutor där den svänger in mot oss
function paintDoorFrames(N = 6) {
  const w = DOOR.x1 - DOOR.x0, h = WALL_Y - DOOR.top;
  const S = new Pix(w, h);
  area(S, 0, 0, w, h, (X, Y) => jit(RED.base, X, Y, 92, 0.05));
  S.bevel(0, 0, w, h, RED.hi, RED.dk);
  S.erase(4, 4, w - 8, 30);
  for (let j = 0; j < 30; j++) for (let i = 0; i < w - 8; i++) {
    const X = 4 + i, Y = 4 + j, s = ((X * 2 - Y * 3) % 40 + 40) % 40;
    S.px(X, Y, 0xc8e0e8, 0.1 + (s < 3 ? 0.22 : 0));
  }
  S.box(3, 3, w - 6, 32, CHROME.dk);
  S.hl(4, 4, w - 8, 0xffffff, 0.3);
  // nedre fyllning med kromband och sparkplåt
  S.bevel(4, 38, w - 8, 12, RED.hi, RED.dk);
  S.box(6, 40, w - 12, 8, CHROME.mid);
  area(S, 2, h - 6, w - 4, 4, (X, Y, i, j) => [CHROME.hi, CHROME.base, CHROME.base, CHROME.mid][j]);
  // handtag i krom
  S.vl(w - 6, 24, 12, CHROME.base); S.vl(w - 5, 24, 12, CHROME.lo); S.px(w - 6, 24, CHROME.hi);
  // skylten på glaset – baksidan säger VÄLKOMMEN ÅTER
  area(S, 4, 14, 21, 8, (X, Y, i, j) => (i === 0 || j === 0 || i === 20 || j === 7 ? 0x8a1a20 : 0xf4ecd8));
  text(S, SMALL, 'ÅTER!', 6, 16, 0xb82a30);
  S.line(8, 14, 14, 9, 0x6a5a4a); S.line(20, 14, 14, 9, 0x6a5a4a);
  const frames = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.25, pw = Math.max(3, Math.round(w * Math.cos(th))), shade = 1 - 0.35 * Math.sin(th);
    const F = new Pix(w, h + 6);
    for (let c = 0; c < pw; c++) {
      const sc = Math.min(w - 1, Math.floor((c * w) / pw));
      const drop = Math.round((c / Math.max(1, pw - 1)) * Math.sin(th) * 5);
      for (let y = 0; y < h; y++) {
        const i = (y * w + sc) * 4, a = S.d[i + 3];
        if (!a) continue;
        F.px(c, y + drop, mul((S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2], shade), a / 255);
      }
    }
    frames.push(F.flush());
  }
  return frames;
}

// notpixlarna (stiger från jukeboxen) och gästernas repliker
const NOTE = [[1, 0], [2, 0], [3, 1], [1, 1], [1, 2], [1, 3], [0, 3], [0, 4], [1, 4]];
const LINES = ['Bästa burgaren i stan!', 'Milkshaken är extra krämig i dag.', 'Jukeboxen spelar vår låt!', 'Pommesen är nyfriterad - akta, het!', 'Jag tar alltid burgarmålet.', 'Extra ketchup, tack!', 'Glassen smälter, skynda dig!', 'Shoo-bi-doo-wah!', 'Femtiotalet är bäst, punkt slut.'];

// ======================= scenen =======================
export function makeShopBurgarbar(A) {
  const g = A.game;
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9;

  // ---------- sittplatser ----------
  // Bås: 'a' = bakre bänken (vänd mot oss), 'b' = främre (ryggen mot oss).
  // Nedre radens bås är öppna mot oss (bara a-platsen). Kromborden har en stol
  // bakom och en framför, barstolarna sitter man på med ryggen mot oss.
  const seats = [];
  for (const B of BOOTHS) {
    B.solo = B.y >= 190;
    seats.push({ id: B.id + 'a', x: B.x, y: B.y - 6, dir: 'down', kind: 'bas', booth: B, occ: null, front: false });
    if (!B.solo) seats.push({ id: B.id + 'b', x: B.x, y: B.y + 11, dir: 'up', kind: 'bas', booth: B, occ: null, front: true });
  }
  for (const T of TABLES) {
    seats.push({ id: T.id + 'a', x: T.x - 7, y: T.y - 6, dir: 'down', kind: 'bord', table: T, occ: null, front: false });
    seats.push({ id: T.id + 'b', x: T.x + 8, y: T.y + 10, dir: 'up', kind: 'bord', table: T, occ: null, front: true });
  }
  STOOLS.forEach((x, k) => seats.push({ id: 'pall' + k, x, y: STOOL_Y, dir: 'up', kind: 'pall', occ: null, front: false }));
  const seatById = (id) => seats.find((s) => s.id === id);

  // ---------- hinder ----------
  const obstacles = [
    [CNT.x0 - 1, WALL_Y, CNT.x1 + 1, CNT.y + 1],
    [GLASSD.x0 - 1, WALL_Y, GLASSD.x1 + 1, GLASSD.y + 1],
    [JUKE.x - 16, WALL_Y, JUKE.x + 16, JUKE.y + 1],
    [GUM.x - 5, GUM.y - 5, GUM.x + 5, GUM.y + 1],
    [BIN.x - 6, BIN.y - 5, BIN.x + 6, BIN.y + 1],
  ];
  for (const B of BOOTHS) obstacles.push([B.x - 19, B.y - 26, B.x + 19, B.y + (B.solo ? 1 : 17)]);
  for (const T of TABLES) obstacles.push([T.x - 15, T.y - 10, T.x + 15, T.y + 1]);
  const walker = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: [DOOR_SPOT[0], DOOR_SPOT[1] + 6] });
  walker.setObstacles(obstacles);
  walker.snapFree();
  const cams = () => lockedCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  const cam = { x: cams() };
  // var man ställer sig för att sätta sig på en plats
  for (const s of seats) {
    const B = s.booth, T = s.table;
    const cands = s.kind === 'pall' ? [[s.x, s.y + 8]]
      : s.kind === 'bas' ? (s.front ? [[B.x + 27, s.y + 2], [B.x - 27, s.y + 2], [B.x, B.y + 25]] : [[B.x + 27, s.y + 2], [B.x - 27, s.y + 2], [B.x + 27, B.y + 4], [B.x - 27, B.y + 4]])
        : [[s.x + 20, s.y], [s.x - 20, s.y], [s.x + 18, s.y + 4], [s.x - 18, s.y + 4], [T.x, T.y + 14]];
    [s.ax, s.ay] = cands.find(([x, y]) => walker.walkable(x, y)) || walker.nearestFree(...cands[0]);
  }
  const freeSeats = () => seats.filter((s) => !s.occ);

  // ---------- bilder ----------
  const cache = {};
  const nightNow = () => isNight(g.min / 60);
  const bg = () => { const k = 'bg' + nightNow(); return (cache[k] ||= paintBg(nightNow())); };
  const winOv = () => { const k = 'win' + nightNow(); return (cache[k] ||= paintWinOverlay(nightNow())); };
  const nightLight = () => (cache.light ||= paintNightLight());
  const doorFr = paintDoorFrames();
  const counter = paintCounter();
  const glassdisk = paintGlassdisk();
  const benchBackImg = paintBenchBack();
  const benchFrontImg = paintBenchFront();
  const boothTableImg = paintBoothTable();
  const tableImg = paintTable();
  const chairDown = paintChair('down'), chairUp = paintChair('up');
  const stoolImg = paintStool();
  const jukeImg = paintJukebox();
  const gumImg = paintGumball();
  const binImg = paintBin();

  // ---------- kassörskan Doris ----------
  const DORIS = { skin: '#e8b48c', hair: '#c9743a', style: 'bun', top: 'tee', shirt: '#f4f1ea', accent: '#c0262e', bottom: 'skirt', pants: '#7ac0b0', shoes: '#f2f2f2', glasses: false, beard: false, phones: false, bag: null, hat: 'cap', cap: '#c0262e', apron: true, build: 5, blush: true, kid: false };
  const kass = { x: PAY_X + 4, tx: PAY_X + 4, dir: 'down', walking: false, phase: 'idle', t: 0, idleT: 2, carry: null, job: null, face: 'down' };
  const jobs = [];   // beställningar som väntar: { who, items, x }
  const trays = [];  // färdiga brickor PÅ DISKEN: { x, who, items, at }
  // köket bakom luckan: kocken lagar en beställning i taget, plingar på passet
  const kitchen = { state: 'idle', t: 0, order: null, done: [], bellT: -9, flipT: 0 };

  // ---------- ånga, noter, chatt ----------
  const parts = [];
  const puff = (x, y, big = false) => parts.push({ x: x + (Math.random() - 0.5) * (big ? 4 : 1), y, vx: (Math.random() - 0.5) * 3, vy: -(big ? 10 : 5) - Math.random() * 4, age: 0, max: big ? 1.6 : 1.1 + Math.random() * 0.6, kind: 'steam' });
  const note = (x, y) => parts.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -7, age: 0, max: 2.2, kind: 'note' });
  let steamT = 0, noteT = 3, bubbleT = 5, musicT = -9;

  // ---------- gästerna ----------
  const rng = rngOf((g.day | 0) * 6151 + 29);
  const guests = [];
  const lookOf = () => { const L = makeLook(rng); L.bag = null; return L; };
  const newTray = (n = 1) => {
    const ids = ['burgare', 'pommes', 'lask', 'glass'];
    const picked = [];
    for (let k = 0; k < n; k++) picked.push({ id: ids[(rng() * 4) | 0], stage: 0 });
    return picked;
  };
  const sitNPC = (seat, extra = {}) => {
    if (!seat || seat.occ) return null;
    const G = { look: lookOf(), seat, state: 'sit', items: newTray(1 + (rng() < 0.4 ? 1 : 0)), sitT: rng() * 8, stay: 1e9, eatT: rng() * 3, eating: 0, biteT: 1 + rng() * 2, bubble: null, fixed: true, slide: null, ...extra };
    seat.occ = G; guests.push(G); return G;
  };
  // stamgäster – några av dem saknas vissa dagar
  for (const id of ['b1a', 'b2b', 'b5a', 't1a', 't3a', 'pall1', 'b4a', 'b6a']) if (rng() < 0.8) sitNPC(seatById(id));
  // gäster som kommer in, köar, beställer, äter och går
  const mkWalker = () => { const w = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 3, bottom: H - 5, spawn: DOOR_SPOT }); w.setObstacles(obstacles); w.speed = 38; return w; };
  const queue = []; // gästerna som står i kön vid kassan (index 0 = längst fram)
  for (let k = 0; k < 3; k++) guests.push({ look: lookOf(), seat: null, state: 'away', t: 3 + k * 12 + rng() * 6, w: mkWalker(), items: null, sitT: 0, stay: 0, eatT: 0, eating: 0, biteT: 0, bubble: null, fixed: false, slide: null, ordered: false });

  // ---------- figuren (jag) ----------
  // order = rätterna man betalat för (samma objekt som sedan ligger på brickan) tills allt är
  // uppätet – så länge den finns får man inte gå ut
  const me = { state: 'free', seat: null, res: null, tray: null, order: null, biteT: 0, sitT: 0, eating: 0, slide: null, waitMsgT: -9, doneT: -9, hintGiven: false };
  const leftovers = []; // brickor som gäster lämnat (smulor) en liten stund
  const meAt = () => ({ x: me.seat ? me.seat.x : walker.px, y: (me.seat ? me.seat.y : walker.py) - 44 });
  // regelns repliker: samma text som redan syns babblas inte om på nytt
  function nag(text) {
    if (talk.text() === text) return;
    talk.say(text, meAt, 2.8);
    play('fel');
  }
  // Det som ännu inte ätits av den betalda maten räknas in (varje tugga = halva rättens
  // mättnad/energi). Rätten märks settled så att tuggorna efteråt inte ger något till.
  function settleOrder() {
    if (!me.order) return false;
    for (const it of me.order) {
      if (it.settled) continue;
      const left = Math.max(0, 2 - it.stage);
      g.hunger = c100(g.hunger + it.fill / 2 * left);
      g.energy = c100(g.energy + it.energy / 2 * left);
      it.settled = true;
    }
    return true;
  }
  // Sidan laddas om (ny version), stängs eller läggs undan mitt i maten: resten räknas in och
  // sparas NU – efter omladdningen står man hemma och brickan här finns inte längre. Brickan
  // ligger ändå kvar i scenen och regeln gäller om sidan skulle komma tillbaka. Tas bort i exit().
  function settleNow(e) {
    if (e?.type === 'visibilitychange' && document.visibilityState !== 'hidden') return;
    if (!settleOrder()) return;
    try { g.save(); } catch { /* sparas ändå regelbundet */ }
  }
  // capture: körs före menyns speglingslyssnare (menu.js), så att speglingen får med maten
  const UNLOAD = [[window, 'sf:before-reload'], [window, 'pagehide'], [document, 'visibilitychange']];
  for (const [el, ev] of UNLOAD) el.addEventListener(ev, settleNow, true);

  function release() { if (me.res && me.res.occ === 'me' && me.res !== me.seat) me.res.occ = null; me.res = null; }
  function standUp() {
    if (!me.seat) return;
    const s = me.seat;
    s.occ = null; me.seat = null; me.slide = null;
    walker.px = s.ax; walker.py = s.ay; walker.stop();
    // brickan försvinner bara när allt är uppätet – annars följer den med i händerna
    me.state = me.tray ? 'carry' : 'free';
  }
  function sitDown(s) {
    s.occ = 'me'; me.seat = s; me.res = null; me.sitT = 0; me.biteT = 0.9;
    me.slide = { fx: walker.px, fy: walker.py, k: 0 };
    me.state = 'sit';
    walker.stop();
    play('click');
  }
  function goSit(s) {
    release();
    me.res = s;
    walker.walkTo(s.ax, s.ay, () => {
      if (s.occ && s.occ !== 'me') {
        const alt = pickSeat();
        if (!alt) { me.state = me.tray ? 'carry' : 'free'; talk.say('😕 Alla platser är upptagna!', meAt); return; }
        goSit(alt); return;
      }
      sitDown(s);
    });
    if (!me.seat) s.occ = 'me';
  }
  // bästa lediga plats: helst ett bås eller bord där man sitter vänd mot oss
  function pickSeat() {
    const f = freeSeats();
    if (!f.length) return null;
    const score = (s) => Math.hypot(s.ax - walker.px, s.ay - walker.py) + (s.dir === 'up' ? 140 : 0) + (s.kind === 'pall' ? 60 : 0) + (leftovers.some((l) => l.seat === s) ? 200 : 0);
    return f.sort((a, b) => score(a) - score(b))[0];
  }

  // ---------- köpet ----------
  function buy(m) {
    if (!m) return { ok: false, msg: 'Det finns inte på menyn.' };
    if (me.state === 'wait' || me.state === 'toCounter') return { ok: false, msg: 'Doris fixar redan din beställning!' };
    if (me.tray) return { ok: false, msg: 'Ät upp det du har på brickan först!' };
    if (g.money < m.price) return { ok: false, msg: 'Du har inte råd!' };
    if (me.state === 'sit') standUp();
    release();
    g.money -= m.price;
    g.passTime(15);
    g.save();
    play('coin');
    // OBS: mättnaden och energin kommer bit för bit NÄR MAN SITTER OCH ÄTER
    const items = itemsOf(m).map((x) => ({ id: x.id, stage: 0, fill: x.fill, energy: x.energy }));
    me.order = items;
    const order = () => { me.state = 'wait'; jobs.push({ who: 'me', items, x: walker.px }); };
    const atCounter = Math.abs(walker.py - ORDER_Y) < 6 && Math.abs(walker.px - PAY_X) < 30 && !walker.path.length;
    if (atCounter) order();
    else { me.state = 'toCounter'; walker.walkTo(PAY_X, ORDER_Y, order); }
    talk.say(`🍔 Ska bli! ${fmt(m.price)}, tack!`, () => ({ x: kass.x, y: KASS_Y - 44 }));
    return { ok: true, price: m.price, fill: fillOf(m), energy: energyOf(m) };
  }

  function openMenu() {
    if (me.order) { nag(MSG_ATUPP); return; }   // brickan först – sedan kan man beställa mer
    const rows = BURGAR_MENY.map((m, i) => {
      const its = itemsOf(m);
      return `<div class="prow" style="grid-template-columns:84px 1fr auto;${m.id === 'mal' ? 'background:#fff8d6' : ''}">
        <canvas data-ic="${i}" width="40" height="16" style="width:80px;height:32px;image-rendering:pixelated;background:#e8dcc4;border:2px solid #17151a"></canvas>
        <span class="nm">${m.icon} ${m.name}${m.id === 'mal' ? ' <b style="color:#c9323a">★ SPARA 5 KR</b>' : ''}<br><small class="sp">+${fillOf(m)} mättnad · +${energyOf(m)} energi ${its.length > 1 ? '· tre saker på brickan' : ''}</small></span>
        <button class="btn btn-small btn-go" data-buy="${i}" data-key="${i + 1}" ${g.money < m.price ? 'disabled' : ''}>🍔 ${fmt(m.price)} <kbd>${i + 1}</kbd></button>
      </div>`;
    }).join('');
    const body = `<p style="font-size:var(--f2);margin:0 0 8px">💰 <b>${fmt(g.money)}</b> · 🍽️ Mättnad <b>${Math.round(g.hunger)}</b>/100 · ⚡ Energi <b>${Math.round(g.energy)}</b>/100</p>
      <div class="plist">${rows}</div>
      <p style="font-size:var(--f1);margin:10px 0 0;color:#6d6660">Du får en bricka och sätter dig vid ett ledigt bord. Mättnaden och energin kommer medan du äter – bara när du sitter!</p>`;
    const dlg = openModal('🍔 Burgarbaren – vad får det lov att vara?', body, [{ label: 'Nej tack', onClick: closeModal }]);
    dlg.querySelectorAll('canvas[data-ic]').forEach((cv) => {
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      const m = BURGAR_MENY[+cv.dataset.ic], its = itemsOf(m);
      its.forEach((it, k) => { const s = BM.dishes[DISH_IX[it.id]].sprite; x.drawImage(s, 20 - ((its.length - 1) * 13 + s.width) / 2 + k * 13, 15 - s.height); });
    });
    dlg.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const m = BURGAR_MENY[+b.dataset.buy], r = buy(m);
      if (!r.ok) { talk.say('😳 ' + r.msg, () => ({ x: kass.x, y: KASS_Y - 44 })); play('fel'); closeModal(); return; }
      closeModal();
    }));
  }

  // ---------- jobben vid disken ----------
  function openJobs() {
    if (me.order) { nag(MSG_ATUPP); return; }   // ingen smiter in på ett pass med maten kvar
    const bj = JOBS.burgare, kj = JOBS.kok;
    const body = `<p style="font-size:var(--f2);margin-top:0"><b>Vi behöver folk – välj ditt pass!</b></p>
      <div class="plist">
      <div class="prow" style="grid-template-columns:1fr auto"><span class="nm">🍽️ <b>Servera</b><br><small class="sp">${bj.verb}. ${bj.wage} kr per rätt, −${bj.oops} kr per fel.</small></span>
        <button class="btn btn-small btn-go" data-jobb="burgare">🍽️ Servera</button></div>
      <div class="prow" style="grid-template-columns:1fr auto"><span class="nm">👨‍🍳 <b>Jobba i köket</b><br><small class="sp">${kj ? `${kj.verb}. ${kj.wage} kr per rätt, −${kj.oops} kr per fel.` : 'Bygg rätterna som beställs – grillen väntar!'}</small></span>
        <button class="btn btn-small btn-go" data-jobb="kok">👨‍🍳 Köket</button></div>
      </div>
      <p style="font-size:var(--f1);margin:10px 0 0;color:#6d6660">Ett pass tar 4 timmar. Chefen betalar direkt efter passet.</p>`;
    const dlg = openModal('🍔 Jobba på Burgarbaren?', body, [{ label: 'En annan gång', onClick: closeModal }]);
    dlg.querySelectorAll('[data-jobb]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.jobb;
      closeModal();
      if (me.order) { nag(MSG_ATUPP); return; }
      if (id === 'kok' && !JOBS.kok) { talk.say('👨‍🍳 Köket öppnar för nyanställda alldeles strax – fråga igen snart!', () => ({ x: kass.x, y: KASS_Y - 44 })); play('click'); return; }
      A.startJob(id);
    }));
  }

  // ---------- klickbara saker ----------
  function jukebox() {
    play('box');
    musicT = t + 6;
    for (let i = 0; i < 3; i++) note(JUKE.x - 4 + i * 4, JUKE.y - 38);
    talk.say('🎵 Shoo-bi-doo-wah! Jukeboxen snurrar igång en riktig femtiotalsdänga.', { x: JUKE.x, y: JUKE.y - 48 });
  }
  function gumball() {
    if (g.money < 1) { talk.say('🍬 En krona för en kula … det har jag inte ens.', meAt); return; }
    g.money -= 1; g.hunger = c100(g.hunger + 1); g.save();
    play('coin');
    talk.say(['🍬 En röd tuggummikula!', '🍬 En gul tuggummikula!', '🍬 En grön – min turfärg!'][(Math.random() * 3) | 0], meAt);
  }
  const hot = [
    { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 12, DOOR.x1 + 3, WALL_Y + 10], go: () => DOOR_SPOT, act: () => { play('door'); A.go('city'); } },
    { id: 'jobb', r: [JOBB_SKYLT.x - 26, CNT.top - 12, JOBB_SKYLT.x + 26, CNT.y], go: () => [JOBB_SKYLT.x, ORDER_Y], act: () => { play('click'); openJobs(); } },
    { id: 'disk', r: [CNT.x0, 20, CNT.x1, CNT.y + 2], go: () => [PAY_X, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'glassdisk', r: [GLASSD.x0 - 2, 60, GLASSD.x1 + 2, GLASSD.y + 2], go: () => [(GLASSD.x0 + GLASSD.x1) / 2, ORDER_Y], act: () => { play('click'); openMenu(); } },
    { id: 'jukebox', r: [JUKE.x - 17, JUKE.y - 44, JUKE.x + 17, JUKE.y + 4], go: () => [JUKE.x, JUKE.y + 9], act: jukebox },
    { id: 'gumball', r: [GUM.x - 7, GUM.y - 24, GUM.x + 7, GUM.y + 2], go: () => [GUM.x, GUM.y + 7], act: gumball },
  ];
  const spotAt = (x, y) => hot.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const seatAt = (x, y) => seats.find((s) => {
    if (s.kind === 'pall') return Math.abs(x - s.x) < 8 && y > s.y - 34 && y < s.y + 3;
    if (s.kind === 'bas') return Math.abs(x - s.booth.x) < 17 && (s.front ? y > s.booth.y + 2 && y < s.booth.y + 19 : y > s.y - 34 && y < s.booth.y + 1);
    return Math.abs(x - s.x) < 9 && y > s.y - 32 && y < s.y + 4;
  });

  // ---------- kassörskan ----------
  function setPhase(p) { kass.phase = p; kass.t = 0; }
  function updateKass(dt) {
    const K = kass;
    const dx = K.tx - K.x;
    K.walking = Math.abs(dx) > 0.5;
    if (K.walking) { const st = Math.min(Math.abs(dx), 60 * dt); K.x += Math.sign(dx) * st; K.dir = dx < 0 ? 'left' : 'right'; return; }
    K.x = K.tx;
    K.t += dt;
    if (K.phase === 'idle') {
      if (kitchen.done.length) { setPhase('toPass'); K.tx = PASS_X; return; }
      if (jobs.length && kitchen.state === 'idle' && !kitchen.order && !K.job) { K.job = jobs.shift(); setPhase('toReg'); K.tx = clamp(K.job.x, CNT.x0 + 10, CNT.x1 - 10); return; }
      K.idleT -= dt;
      // ingen beställning: torka disken, kolla läskfontänen, stå vid kassan
      if (K.idleT <= 0) { K.tx = [PAY_X + 4, 258, 300, 432, 386][(Math.random() * 5) | 0]; K.idleT = 3 + Math.random() * 5; K.face = Math.random() < 0.4 ? 'up' : 'down'; }
      else K.dir = K.face;
      return;
    }
    if (K.phase === 'toReg') { K.dir = 'down'; if (K.t > 0.7) { setPhase('shout'); K.tx = (HATCH.x0 + HATCH.x1) / 2; } return; }
    if (K.phase === 'shout') {
      K.dir = 'up';
      if (K.t > 0.5) { kitchen.order = K.job; kitchen.state = 'cook'; kitchen.t = 0; K.job = null; setPhase('idle'); }
      return;
    }
    if (K.phase === 'toPass') {
      K.dir = 'up';
      const d = kitchen.done.shift();
      if (d) { K.carry = d; setPhase('serve'); K.tx = clamp(d.x, CNT.x0 + 10, CNT.x1 - 10); }
      else setPhase('idle');
      return;
    }
    if (K.phase === 'serve') {
      K.dir = 'down';
      trays.push({ x: Math.round(K.x), who: K.carry.who, items: K.carry.items, at: t });
      if (K.carry.who === 'me') play('ok');
      K.carry = null;
      setPhase('idle');
      K.idleT = 2 + Math.random() * 3;
    }
  }

  // ---------- köket ----------
  function updateKitchen(dt) {
    if (kitchen.state === 'cook') {
      kitchen.t += dt;
      if (Math.random() < dt * 16) puff(HATCH.x0 + 8 + Math.random() * 40, HATCH.y1 - 11, Math.random() < 0.3);
      if (kitchen.t > 1.8) {
        kitchen.done.push({ who: kitchen.order.who, items: kitchen.order.items, x: kitchen.order.x });
        kitchen.order = null; kitchen.state = 'idle'; kitchen.bellT = t;
        play('chirp');
      }
    }
  }

  // ---------- gästerna ----------
  const pickSeatNPC = () => { const f = freeSeats().filter((s) => s.kind !== 'pall' || Math.random() < 0.3); return f.length ? f[(Math.random() * f.length) | 0] : null; };
  function npcLeave(G, pause) {
    G.state = 'leave'; G.items = null;
    G.w.walkTo(...DOOR_SPOT, () => { G.state = 'away'; G.t = pause + Math.random() * 20; });
  }
  function updateGuest(G, dt) {
    if (G.slide) { G.slide.k += dt * 4; if (G.slide.k >= 1) G.slide = null; }
    if (G.state === 'sit') {
      G.sitT += dt; G.eatT -= dt;
      if (G.eating > 0) G.eating -= dt;
      if (G.eatT <= 0) { G.eating = 0.55; G.eatT = 2 + Math.random() * 3; }
      // tugga: maten på brickan minskar bit för bit
      G.biteT -= dt;
      if (G.biteT <= 0) {
        G.biteT = G.fixed ? 7 + Math.random() * 9 : 2.6 + Math.random() * 2;
        const it = G.items && G.items.reduce((a, b) => (b.stage < 2 && (!a || b.stage < a.stage) ? b : a), null);
        if (it) it.stage++;
        else if (G.fixed) G.items = newTray(1 + (rng() < 0.3 ? 1 : 0));   // stamgästen beställer "nytt" i tysthet
      }
      if (G.fixed) return;
      if (G.sitT > G.stay || (G.items && G.items.every((i) => i.stage >= 2) && G.sitT > 8)) {
        leftovers.push({ seat: G.seat, items: G.items.map((i) => ({ ...i, stage: 2 })), until: t + 10 });
        G.seat.occ = null; G.w.px = G.seat.ax; G.w.py = G.seat.ay; G.seat = null;
        npcLeave(G, 10);
      }
      return;
    }
    if (G.fixed) return;
    if (G.state === 'away') {
      G.t -= dt;
      if (G.t > 0) return;
      G.look = lookOf(); G.ordered = false; G.items = null;
      G.w.px = DOOR_SPOT[0]; G.w.py = DOOR_SPOT[1]; G.w.stop();
      G.state = 'enter';
      queue.push(G);
      G.qx = QPOS[Math.min(queue.indexOf(G), QPOS.length - 1)];
      G.w.walkTo(G.qx, ORDER_Y + 2, () => { G.state = 'queue'; });
      return;
    }
    if (G.state === 'enter' || G.state === 'queue') {
      const ix = queue.indexOf(G);
      const wantX = QPOS[Math.min(Math.max(ix, 0), QPOS.length - 1)];
      if (G.qx !== wantX) { // kön flyttar fram ett steg
        G.qx = wantX;
        G.state = 'enter';
        G.w.walkTo(wantX, ORDER_Y + 2, () => { G.state = 'queue'; });
      }
      if (G.state === 'queue') {
        G.w.dir = 'up';
        if (ix === 0 && !G.ordered) {
          G.ordered = true;
          G.items = newTray(1 + (Math.random() < 0.35 ? 1 : 0));
          G.bubble = { icon: G.items[0].id, until: t + 2.4 };
          jobs.push({ who: G, items: G.items, x: G.w.px });
        }
        if (G.ordered) {
          const k = trays.findIndex((tr) => tr.who === G && t - tr.at > 0.6);
          if (k >= 0) {
            trays.splice(k, 1);
            queue.splice(queue.indexOf(G), 1);
            const s = pickSeatNPC();
            if (!s) { npcLeave(G, 12); return; } // fullt: tar maten med sig hem
            s.occ = G; G.seat = s;
            G.state = 'carry';
            G.w.walkTo(s.ax, s.ay, () => { G.state = 'sit'; G.sitT = 0; G.stay = 20 + Math.random() * 18; G.eatT = 1; G.biteT = 2.5; G.slide = { fx: G.w.px, fy: G.w.py, k: 0 }; });
          }
        }
      }
    }
    G.w.update(dt);
  }

  // ---------- figuren (jag) ----------
  function updateMe(dt) {
    if (me.state === 'wait') {
      walker.dir = 'up';
      const k = trays.findIndex((tr) => tr.who === 'me' && t - tr.at > 0.6);
      if (k >= 0) {
        me.tray = { items: trays[k].items };
        trays.splice(k, 1);
        me.state = 'carry';
        if (!me.hintGiven) { me.hintGiven = true; talk.say('🍔 Klicka på ett ledigt bord eller bås så sätter jag mig där!', meAt); }
      }
    }
    // säkerhetsnät om gång-callbacken uteblev: sätt dig BARA om figuren faktiskt
    // står vid platsens angöringspunkt – annars släpps reservationen (t.ex. ångrad gång)
    if (me.state === 'carry' && !walker.path.length && !me.seat && me.res && me.res.occ === 'me') {
      if (Math.hypot(walker.px - me.res.ax, walker.py - me.res.ay) < 8) sitDown(me.res);
      else release();
    }
    if (me.state === 'sit') {
      me.sitT += dt;
      if (me.slide) { me.slide.k += dt * 4; if (me.slide.k >= 1) me.slide = null; }
      if (me.eating > 0) me.eating -= dt;
      if (me.tray) {
        me.biteT -= dt;
        if (me.biteT <= 0) {
          const it = me.tray.items.reduce((a, b) => (b.stage < 2 && (!a || b.stage < a.stage) ? b : a), null);
          if (it) {
            it.stage++; me.eating = 0.6; me.biteT = 1.35;
            // HÄR – och bara här – kommer mättnaden och energin: vid bordet, bit för bit
            // (settled = redan inräknad när sidan skulle laddas om/stängas – ge inte två gånger)
            if (!it.settled) {
              g.hunger = c100(g.hunger + it.fill / 2);
              g.energy = c100(g.energy + it.energy / 2);
            }
            if (me.tray.items.every((i) => i.stage >= 2)) { me.doneT = t; g.save(); play('ok'); }
          } else me.biteT = 1;
        }
        // brickan försvinner FÖRST när allt är uppätet
        if (me.doneT > 0 && t - me.doneT > 1.2 && me.tray.items.every((i) => i.stage >= 2)) {
          me.tray = null; me.order = null; me.doneT = -9;
          talk.say('😋 MUMS! Precis vad jag behövde.', meAt);
        }
      } else if (me.sitT > 14) standUp();   // vilar utan mat: res dig efter en stund
    }
  }

  // ---------- trafiken utanför ----------
  const peds = [], cars = [];
  let pedT = 1, carT = 2;
  const carImg = {};
  function carSprite(color, dir, night) {
    const k = color + dir + night;
    if (carImg[k]) return carImg[k];
    const P = new Pix(28, 12);
    const c = parseInt(color.slice(1), 16);
    area(P, 2, 4, 24, 5, (X, Y, i, j) => (j === 0 ? mix(c, WHITE, 0.3) : j === 4 ? mul(c, 0.6) : c));
    area(P, 7, 0, 13, 4, (X, Y, i, j) => (i === 0 || i === 12 ? c : j === 0 ? mix(c, WHITE, 0.2) : night ? 0x2a2a40 : (i + j) % 5 === 0 ? 0xe8f4fa : 0x8ab4d0));
    P.vl(13, 1, 3, c);
    P.hl(0, 5, 3, mul(c, 0.85)); P.hl(25, 5, 3, mul(c, 0.85));           // femtiotalsfenorna
    for (const wx of [7, 20]) { P.rect(wx - 2, 8, 5, 4, 0x1a1a1e); P.px(wx, 9, 0x8a8a90); }
    P.px(dir > 0 ? 26 : 1, 5, night ? 0xfff6b0 : 0xf8f0d0); P.px(dir > 0 ? 1 : 26, 5, 0xd8303a);
    outline(P);
    return (carImg[k] = P.flush());
  }
  function updateStreet(dt) {
    pedT -= dt; carT -= dt;
    if (pedT <= 0) { const dir = Math.random() < 0.5 ? 'left' : 'right'; peds.push({ x: dir === 'right' ? -14 : 226, dir, look: makeLook(), sp: 16 + Math.random() * 10, ph: Math.random() }); pedT = 3 + Math.random() * 6; }
    if (carT <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; cars.push({ x: dir > 0 ? -20 : 232, dir, y: dir > 0 ? 51 : 47, color: ['#e894b4', '#c9323a', '#3a7bd5', '#7ac0b0', '#f0b429', '#e8e3d6'][Math.floor(Math.random() * 6)], sp: 60 + Math.random() * 30 }); carT = 3 + Math.random() * 7; }
    for (const p of peds) { p.x += (p.dir === 'right' ? 1 : -1) * p.sp * dt; p.ph += dt * p.sp / 22; }
    for (const c of cars) c.x += c.dir * c.sp * dt;
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].x < -20 || peds[i].x > 232) peds.splice(i, 1);
    for (let i = cars.length - 1; i >= 0; i--) if (cars[i].x < -30 || cars[i].x > 244) cars.splice(i, 1);
    cars.sort((a, b) => a.y - b.y);
  }

  let doorOpen = 0, doorWas = false, doorForMe = false; // doorForMe: står jag vid dörren och får gå ut?
  function updateDoor(dt) {
    const near = (x, y) => x > DOOR.x0 - 10 && x < DOOR.x1 + 10 && y < WALL_Y + 14;
    // med maten i händerna öppnas dörren inte för en – den ska ätas här inne
    doorForMe = near(walker.px, walker.py) && !me.order;
    const any = doorForMe || guests.some((G) => !G.fixed && (G.state === 'enter' || G.state === 'leave') && near(G.w.px, G.w.py));
    doorOpen += ((any ? 1 : 0) - doorOpen) * Math.min(1, dt * 7);
    if (any && !doorWas) play('chirp');
    doorWas = any;
  }

  function updateParts(dt) {
    steamT -= dt;
    if (steamT <= 0) { puff(HATCH.x0 + 12 + Math.random() * 30, HATCH.y1 - 11); steamT = 0.5 + Math.random() * 0.5; }
    noteT -= dt;
    if (noteT <= 0) { note(JUKE.x - 4 + Math.random() * 8, JUKE.y - 38); noteT = musicT > t ? 0.5 + Math.random() * 0.5 : 4 + Math.random() * 5; }
    for (const p of parts) { p.age += dt; p.x += p.vx * dt + Math.sin(p.age * 5 + p.y) * dt * 2; p.y += p.vy * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
    if (parts.length > 120) parts.splice(0, parts.length - 120);
    // någon säger något ibland
    bubbleT -= dt;
    if (bubbleT <= 0) {
      const sitting = guests.filter((G) => G.state === 'sit' && G.seat);
      if (sitting.length) { const G = sitting[(Math.random() * sitting.length) | 0]; G.bubble = { text: LINES[(Math.random() * LINES.length) | 0], until: t + 4 }; }
      bubbleT = 6 + Math.random() * 8;
    }
    for (let i = leftovers.length - 1; i >= 0; i--) if (leftovers[i].until < t || leftovers[i].seat.occ) leftovers.splice(i, 1);
  }

  // ---------- ritning ----------
  function seatPos(s) {
    const o = s.occ;
    const slide = o === 'me' ? me.slide : o?.slide;
    if (!slide) return [s.x, s.y];
    const k = clamp(slide.k, 0, 1);
    return [slide.fx + (s.x - slide.fx) * k, slide.fy + (s.y - slide.fy) * k];
  }
  function drawSeated(ctx, s) {
    const o = s.occ;
    if (!o) return;
    const [x, y] = seatPos(s);
    const sliding = o === 'me' ? me.slide : o.slide;
    if (o === 'me') {
      if (!me.seat) return;
      const frame = sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : me.eating > 0 ? 6 : 5;
      drawPerson(ctx, x, y, A.avatar.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, frame);
      return;
    }
    if (o.state !== 'sit') return;
    const frame = sliding ? WALK_SEQ[Math.floor(t * 8.5) % 4] : o.eating > 0 ? 6 : 5;
    drawPerson(ctx, x, y, o.look, sliding ? (s.x < x ? 'left' : 'right') : s.dir, frame);
  }
  // brickan som hör till en plats (min, en gästs eller kvarlämnade smulor)
  function trayFor(s) {
    const o = s.occ;
    if (o === 'me' && me.seat === s && me.tray) return me.tray.items;
    if (o && o !== 'me' && o.state === 'sit' && o.items) return o.items;
    const l = leftovers.find((l) => l.seat === s);
    return l ? l.items : null;
  }
  function drawTrayAt(ctx, s) {
    const items = trayFor(s);
    if (!items) return;
    const c = trayCanvas(items, true);
    let px, py;
    if (s.kind === 'pall') { px = s.x - (TRAY_W >> 1); py = CNT.top + 3 - c.height; }
    else if (s.kind === 'bas') {
      const B = s.booth;
      if (s.front) { const back = seatById(B.id + 'a'); if (back && trayFor(back)) return; px = B.x - (TRAY_W >> 1); py = B.y - 16 - c.height; }
      else { px = B.x - (TRAY_W >> 1); py = B.y - 18 - c.height; }
    } else {
      const T = s.table;
      if (s.front) { const back = seatById(T.id + 'a'); if (back && trayFor(back)) return; px = T.x - (TRAY_W >> 1); py = T.y - 14 - c.height; }
      else { px = T.x - (TRAY_W >> 1); py = T.y - 15 - c.height; }
    }
    ctx.drawImage(c, Math.round(px), Math.round(py));
  }
  // linje med hela pixlar direkt på canvasen (klockvisarna)
  function ctxLine(ctx, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 100; n++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function drawClock(ctx) {
    const cx = KLOCKA.x, cy = KLOCKA.y;
    const m = g.min % 60, h = (g.min / 60) % 12;
    const ma = m / 60 * Math.PI * 2, ha = h / 12 * Math.PI * 2;
    ctx.fillStyle = '#f4f1ea'; ctxLine(ctx, cx, cy, cx + Math.sin(ha) * 3.4, cy - Math.cos(ha) * 3.4);
    ctx.fillStyle = '#d8d2c6'; ctxLine(ctx, cx, cy, cx + Math.sin(ma) * 5.4, cy - Math.cos(ma) * 5.4);
    ctx.fillStyle = '#ff88bb'; ctx.fillRect(cx, cy, 1, 1);
  }
  // köket bakom luckan: kocken som vänder burgare, glödande brännare, fritösen
  // och passet – kocken står BAKOM grillen (fronten ritas om över hans ben)
  function drawKitchen(ctx) {
    const { x0, x1, y1 } = HATCH;
    const cooking = kitchen.state === 'cook';
    const cx = x0 + 26, base = y1 - 2;
    const bob = Math.sin(t * (cooking ? 7 : 2.4)) > 0 ? 1 : 0;
    // kocken: vit rock, halsduk, mustasch, kockmössa
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(cx - 4, base - 16 + bob, 9, 12);
    ctx.fillStyle = '#d8d0c4'; ctx.fillRect(cx + 3, base - 16 + bob, 2, 12);
    ctx.fillStyle = '#c0262e'; ctx.fillRect(cx - 4, base - 16 + bob, 9, 1);
    ctx.fillStyle = '#e8b48c'; ctx.fillRect(cx - 3, base - 22 + bob, 7, 6);
    ctx.fillStyle = '#17151a'; ctx.fillRect(cx - 2, base - 20 + bob, 1, 1); ctx.fillRect(cx + 1, base - 20 + bob, 1, 1);
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(cx - 2, base - 18 + bob, 5, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 3, base - 26 + bob, 7, 4); ctx.fillRect(cx - 2, base - 28 + bob, 5, 2);
    // armen med stekspaden – lyfter när det steks
    const lift = cooking && (t * 4) % 1 > 0.5 ? 4 : 0;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(cx + 4, base - 13 + bob - lift, 4, 2);
    ctx.fillStyle = '#e8b48c'; ctx.fillRect(cx + 8, base - 12 + bob - lift, 2, 2);
    ctx.fillStyle = '#8e98a4'; ctx.fillRect(cx + 10, base - 12 - lift, 1, 3);
    ctx.fillStyle = '#d8e0e6'; ctx.fillRect(cx + 9, base - 9 - lift, 5, 1);
    // grillfronten på nytt – över kockens ben – och brännarnas glöd i slitsarna
    ctx.fillStyle = '#4a4e56'; ctx.fillRect(x0 + 4, y1 - 8, 50, 6);
    ctx.fillStyle = '#7a808a'; ctx.fillRect(x0 + 4, y1 - 8, 50, 1);
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(x0 + 4, y1 - 3, 50, 1);
    for (let i = 0; i < 7; i++) {
      const glow = (Math.sin(t * 13 + i * 2.7) + 1) * (cooking ? 0.8 : 0.4);
      ctx.fillStyle = glow > 0.9 ? '#ffd23f' : glow > 0.45 ? '#ff9a3a' : '#c84a1e';
      ctx.fillRect(x0 + 8 + i * 7, y1 - 6, 3, 2);
    }
    // burgarna på grillytan (en är uppe i luften när spaden lyfter)
    ctx.fillStyle = '#6a3a24';
    for (let i = 0; i < 3; i++) ctx.fillRect(x0 + 8 + i * 13, y1 - 10, 7, 2);
    ctx.fillStyle = '#4a2414';
    for (let i = 0; i < 3; i++) ctx.fillRect(x0 + 8 + i * 13, y1 - 9, 7, 1);
    if (lift) { ctx.fillStyle = '#8e5230'; ctx.fillRect(cx + 9, base - 17, 6, 2); }
    // fritöskorgarna skakas då och då
    const shake = Math.sin(t * 2) > 0.85 ? Math.round(Math.sin(t * 30)) : 0;
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x0 + 60 + shake, y1 - 12, 7, 3); ctx.fillRect(x0 + 70 + shake, y1 - 12, 7, 3);
    // klockan på passet gungar när kocken plingat
    if (t - kitchen.bellT < 0.9) {
      const sw = Math.round(Math.sin((t - kitchen.bellT) * 30) * 1.5);
      ctx.fillStyle = '#f6e0a0'; ctx.fillRect(x1 - 7 + sw, y1 - 9, 3, 2);
    }
    // färdiga brickor som väntar på passet under värmelampan
    kitchen.done.forEach((d, i) => { const c = trayCanvas(d.items, true); ctx.drawImage(c, x1 - 34 - i * 8, y1 - 4 - c.height); });
  }

  function drawWorld(ctx, cx, vw) {
    const hour = g.min / 60, night = isNight(hour), dark = darkness(hour);
    ctx.drawImage(bg(), 0, 0);
    // ---- utanför: bilar och folk som går förbi (klippt till glaset) ----
    ctx.save();
    ctx.beginPath();
    for (const w of WINS) ctx.rect(w.x0, WIN_T, w.x1 - w.x0, WIN_B - WIN_T);
    if (doorOpen > 0.05) ctx.rect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top);
    else ctx.rect(DOOR.x0 + 4, DOOR.top + 4, DOOR.x1 - DOOR.x0 - 8, 30);
    ctx.clip();
    for (const c of cars) {
      ctx.drawImage(carSprite(c.color, c.dir, night), Math.round(c.x) - 14, c.y - 11);
      if (night) { ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.fillRect(Math.round(c.x) + (c.dir > 0 ? 12 : -24), c.y - 6, 12, 2); }
    }
    for (const p of peds) drawPerson(ctx, p.x, 72, p.look, p.dir, WALK_SEQ[Math.floor(p.ph * 8.5) % 4]);
    if (!night && dark > 0) { ctx.fillStyle = `rgba(14,16,44,${dark})`; ctx.fillRect(10, 12, 204, WALL_Y - 12); }
    ctx.restore();
    // dörren och fjäderklockan
    ctx.drawImage(doorFr[Math.round(clamp(doorOpen, 0, 1) * (doorFr.length - 1))], DOOR.x0, DOOR.top);
    const swing = doorOpen > 0.1 ? Math.round(Math.sin(t * 18)) : 0;
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(DOOR.x0 + 3, DOOR.top - 1, 1, 2);
    ctx.fillStyle = '#d0aa50'; ctx.fillRect(DOOR.x0 + 2 + swing, DOOR.top + 1, 3, 3);
    ctx.fillStyle = '#f6e0a0'; ctx.fillRect(DOOR.x0 + 2 + swing, DOOR.top + 1, 1, 1);
    ctx.drawImage(winOv(), 0, 0);
    // ---- väggen: klockan och köket lever ----
    drawClock(ctx);
    drawKitchen(ctx);
    // milkshakemaskinens lampa blinkar
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#6fe08a' : '#2a6a3a'; ctx.fillRect(265, 51, 1, 1);

    // ---- allt på golvet i djupordning ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(CNT.y, () => {
      const kf = kass.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 1.7) > 0.93 ? 4 : 0);
      drawPerson(ctx, Math.round(kass.x), KASS_Y, DORIS, kass.dir, kf);
      ctx.drawImage(counter.img, counter.ox, counter.oy);
      if (kass.carry) { const c = trayCanvas(kass.carry.items, true); ctx.drawImage(c, Math.round(kass.x) - (TRAY_W >> 1), KASS_Y - 22 - c.height + 8); }
      for (const tr of trays) { const c = trayCanvas(tr.items, true); ctx.drawImage(c, tr.x - (TRAY_W >> 1), CNT.top + 3 - c.height); }
      for (const s of seats) if (s.kind === 'pall') drawTrayAt(ctx, s);
    });
    add(GLASSD.y, () => ctx.drawImage(glassdisk.img, glassdisk.ox, glassdisk.oy));
    for (const B of BOOTHS) {
      const sa = seatById(B.id + 'a'), sb = B.solo ? null : seatById(B.id + 'b');
      add(B.y, () => {
        ctx.drawImage(benchBackImg, B.x - 19, B.y - 32);
        drawSeated(ctx, sa);
        ctx.drawImage(boothTableImg, B.x - 18, B.y - 22);
        drawTrayAt(ctx, sa);
        if (sb) drawTrayAt(ctx, sb);
      });
      if (sb) add(B.y + 12, (c) => { drawSeated(c, sb); c.drawImage(benchFrontImg, B.x - 19, B.y + 2); });
    }
    for (const T of TABLES) {
      const sa = seatById(T.id + 'a'), sb = seatById(T.id + 'b');
      add(T.y, () => {
        ctx.drawImage(chairDown.img, sa.x - 8, sa.y - 22);
        drawSeated(ctx, sa);
        ctx.drawImage(tableImg, T.x - 15, T.y - 19);
        drawTrayAt(ctx, sa);
        drawTrayAt(ctx, sb);
      });
      add(sb.y, (c) => { c.drawImage(chairUp.img, sb.x - 8, sb.y - 22); drawSeated(c, sb); c.drawImage(chairUp.front, sb.x - 8, sb.y - 22); });
    }
    for (const s of seats) if (s.kind === 'pall') add(s.y, () => { ctx.drawImage(stoolImg, s.x - 6, s.y - 13); drawSeated(ctx, s); });
    add(GUM.y, () => ctx.drawImage(gumImg.img, GUM.x - gumImg.ox, GUM.y - gumImg.oy));
    add(BIN.y, () => ctx.drawImage(binImg.img, BIN.x - binImg.ox, BIN.y - binImg.oy));
    add(JUKE.y, () => {
      ctx.drawImage(jukeImg.img, JUKE.x - jukeImg.ox, JUKE.y - jukeImg.oy);
      // bågens lampor skimrar (snabbare när den spelar)
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI, lx = JUKE.x - Math.cos(a) * 13, ly = JUKE.y - 27 - Math.sin(a) * 13;
        const on = (Math.floor(t * (musicT > t ? 9 : 2.5)) + i) % 4 === 0;
        ctx.fillStyle = on ? '#fff2b0' : ['#e8443a', '#ffd060', '#6ad0a0'][i % 3];
        ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
      }
    });
    for (const G of guests) if (!G.fixed && (G.state === 'enter' || G.state === 'queue' || G.state === 'carry' || G.state === 'leave')) {
      add(G.w.py, (c) => {
        const carry = G.state === 'carry', walking = G.w.path.length > 0;
        const fr = carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0;
        const dir = G.state === 'queue' && !walking ? 'up' : G.w.dir;
        if (carry && dir === 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.items);
        drawPerson(c, G.w.px, G.w.py, G.look, dir, fr);
        if (carry && dir !== 'up') drawTrayHeld(c, G.w.px, G.w.py, dir, G.items);
      });
    }
    for (const d of folkDrawables(A, t)) add(d.fy, (c) => d.draw(c));
    if (me.state !== 'sit') {
      const carry = me.state === 'carry';
      const sd = selfDrawable(A, walker, t, { carry, folksHere: worldFolksHere(A).length });
      add(walker.py + 0.01, (c) => {
        if (carry && walker.dir === 'up') drawTrayHeld(c, walker.px, walker.py, walker.dir, me.tray?.items);
        sd.draw(c);
        if (carry && walker.dir !== 'up') drawTrayHeld(c, walker.px, walker.py, walker.dir, me.tray?.items);
      });
    }
    items.sort((a, b) => a.fy - b.fy).forEach((it) => it.draw(ctx));

    // ---- ånga från köket och noter från jukeboxen ----
    for (const p of parts) {
      const k = 1 - p.age / p.max;
      if (p.kind === 'note') {
        ctx.fillStyle = `rgba(58,42,26,${Math.min(1, k * 1.5).toFixed(2)})`;
        for (const [a, b] of NOTE) ctx.fillRect(Math.round(p.x) + a, Math.round(p.y) + b, 1, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255,255,255,${(k * 0.55).toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.age < 0.4 ? 1 : 2, 1);
    }

    // ---- kvällen: rummet mörknar, neonen och lamporna tar över ----
    if (night || dark > 0.2) {
      const k = night ? 1 : Math.min(1, (dark - 0.2) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = k;
      ctx.fillStyle = '#8a7a9a';
      ctx.fillRect(cx, 0, vw, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.drawImage(nightLight(), 0, 0);
      ctx.restore();
    }
    // ---- pratbubblor (ovanpå ljuset så att de syns även i kväll) ----
    const iView = (x) => x > cx - 10 && x < cx + vw + 10; // talaren måste synas (nästan) i bild
    for (const G of guests) {
      if (!G.bubble || G.bubble.until <= t) continue;
      if (G.state === 'queue' && G.bubble.icon) {
        if (!iView(G.w.px)) continue; // utanför kamerakanten: ingen bubbla utan avsändare
        const sprI = BM.dishes[DISH_IX[G.bubble.icon]].sprite;
        iconBubble(ctx, Math.round(G.w.px), Math.round(G.w.py) - 44, (c, ix, iy) => c.drawImage(sprI, ix - 8, iy - 7));
      } else if (G.seat && G.state === 'sit' && G.bubble.text) {
        const [x, y] = seatPos(G.seat);
        if (!iView(x)) continue; // stolen utanför bild: hoppa över i stället för att klämma in bubblan
        sayBubble(ctx, Math.round(x), Math.round(y) - (G.seat.front ? 36 : 42), G.bubble.text, { x0: cx, x1: cx + vw, voice: G.look }); // gästens egen röst
      }
    }
  }

  function update(dt) {
    t += dt;
    walker.update(dt);
    worldSeatsTaken(A, seats); // där en annan spelare sitter är det upptaget
    updateMe(dt);
    updateKass(dt);
    updateKitchen(dt);
    for (const G of guests) updateGuest(G, dt);
    updateStreet(dt);
    updateDoor(dt);
    updateParts(dt);
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (cams() - cam.x) * k;
  }
  // låt trafiken och ångan komma igång direkt när man kliver in
  for (let i = 0; i < 60; i++) { updateStreet(1 / 15); updateParts(1 / 15); }

  function dbg() {
    return {
      me: me.state, seat: me.seat?.id || null,
      tray: me.tray ? me.tray.items.map((i) => i.id + ':' + i.stage) : null,
      order: !!me.order, say: talk.text(), door: +doorOpen.toFixed(2), doorForMe,
      x: Math.round(walker.px), y: Math.round(walker.py),
      money: g.money, hunger: Math.round(g.hunger), energy: Math.round(g.energy),
      kassor: kass.phase, kok: kitchen.state, queue: queue.length,
      traysOnCounter: trays.length, guests: guests.map((G) => G.state),
    };
  }

  return {
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return me.seat ? me.seat.y : walker.py; },
    // andra spelare ser mig sitta vid bordet (och tugga så länge brickan står framme)
    get worldSit() { return me.state === 'sit' && me.seat && !me.slide ? { dir: me.seat.dir, eat: !!me.tray } : null; },
    _debug: {
      spot: (id) => {
        const h = hot.find((h) => h.id === id);
        if (h) return { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 };
        if (id === 'bord') { const s = freeSeats().find((s) => !s.front && s.kind !== 'pall'); return s ? { x: s.x - cam.x, y: s.y - 14 } : null; }
        const s = seatById(id);
        return s ? { x: s.x - cam.x, y: s.y - 14 } : null;
      },
      seated: () => (me.seat ? me.seat.id : null),
      tray: () => (me.tray ? me.tray.items.map((i) => ({ id: i.id, stage: i.stage })) : null),
      forceBuy: (id) => buy(typeof id === 'number' ? BURGAR_MENY[id] : menyOf(id)),
      eatFast: () => {
        for (let i = 0; i < 2400 && (me.tray || me.state === 'wait' || me.state === 'toCounter' || me.state === 'carry'); i++) {
          me.biteT = 0; kass.idleT = 0;
          if (me.state === 'carry' && !walker.path.length && !me.res && !me.seat) { const s = pickSeat(); if (s) goSit(s); }
          update(1 / 30);
        }
        return dbg();
      },
      state: dbg,
      seats: () => seats.map((s) => ({ id: s.id, x: s.x, y: s.y, occ: s.occ === 'me' ? 'me' : s.occ ? 'npc' : null })),
      sit: (id) => {
        const s = seatById(id);
        if (!s || s.occ || me.state === 'wait' || me.state === 'toCounter') return;
        if (me.state === 'sit' && me.tray) { nag(MSG_ATUPP); return; }
        if (me.state === 'sit') standUp();
        goSit(s);
      },
      menu: () => openMenu(),
      jobs: () => openJobs(),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = cams(); },
      teleport: (x, y) => { if (me.state === 'sit') standUp(); walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = cams(); },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      cam: () => cam.x,
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W);
        return c.toDataURL('image/png');
      },
    },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      if (me.state === 'wait' || me.state === 'toCounter') {
        if (t - me.waitMsgT > 2) { talk.say('🍔 Doris gör i ordning din beställning …', meAt); me.waitMsgT = t; }
        return;
      }
      // dörrens yta – även golvet precis framför den (där dörren slår upp)
      const atDoor = (px, py) => px > DOOR.x0 - 10 && px < DOOR.x1 + 10 && py < WALL_Y + 14;
      if (me.state === 'carry') {
        const s = seatAt(x, y);
        if (s && !s.occ) { goSit(s); play('click'); return; }
        if (s && s.occ) { if (t - me.waitMsgT > 2) { talk.say('😕 Där sitter någon redan!', meAt); me.waitMsgT = t; } return; }
        const h = spotAt(x, y);
        // med brickan i händerna kommer man inte ut – och disken, jobbet och menyn får vänta
        if ((h && h.id === 'dorr') || atDoor(x, y)) { nag(MSG_DORR); return; }
        if (h && (h.id === 'disk' || h.id === 'glassdisk' || h.id === 'jobb')) { nag(MSG_ATUPP); return; }
        if (y > WALL_Y) { release(); walker.walkTo(x, y); return; }  // golvklick = ångra platsvalet
        if (t - me.waitMsgT > 2.5) { talk.say('🍔 Klicka på ett ledigt bord så sätter jag mig där.', meAt); me.waitMsgT = t; }
        return;
      }
      if (me.state === 'sit' && me.tray) {
        // mitt i maten: man sitter kvar tills det är uppätet (prata med gästerna går bra)
        const h = spotAt(x, y);
        if ((h && h.id === 'dorr') || atDoor(x, y)) { nag(MSG_DORR); return; }
        const s = seatAt(x, y);
        if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') {
          s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 };
          play('click');
          return;
        }
        nag(MSG_ATUPP);
        return;
      }
      if (me.state === 'sit') standUp();
      release();
      const h = spotAt(x, y);
      if (h) { const [gx, gy] = h.go(x); walker.walkTo(gx, gy, h.act); return; }
      const s = seatAt(x, y);
      if (s && !s.occ) { goSit(s); return; }
      if (s && s.occ && s.occ !== 'me' && s.occ.state === 'sit') {
        s.occ.bubble = { text: LINES[Math.floor(Math.random() * LINES.length)], until: t + 4.5 };
        play('click');
        return;
      }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy)?.id || null; hoverT = t; },
    key() {},
    // Får man lämna dinern just nu? null = ja, annars repliken (som figuren också säger).
    // För huvudprogrammets knappar som byter scen (👥 Gå dit/Åk hem till, jobbinbjudan …).
    // { quiet: true } = bara fråga (ingen pratbubbla), t.ex. för omladdningen i version-ui.js.
    leaveBlock(o) {
      if (!me.order) return null;
      if (!o?.quiet) nag(MSG_DORR);
      return MSG_DORR;
    },
    // Scenen byts: blev maten inte uppäten (somnade vid midnatt, 👥-menyn …) får man det som var
    // kvar ändå – betald mat går aldrig förlorad (varje tugga = halva rättens mättnad/energi).
    exit() {
      for (const [el, ev] of UNLOAD) el.removeEventListener(ev, settleNow, true);
      if (settleOrder()) {
        for (const it of me.order) it.stage = 2;
        me.order = null; me.tray = null;
        g.save();
      }
      talk.clear();
    },
    draw(ctx) {
      syncView(A); // skärmen kan ha ändrat storlek – vyn följer med
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      drawWorld(ctx, cx, VW);
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      // skylt i nederkanten när man pekar på något klickbart
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const h = hoverId && t - hoverT < 3 ? hoverId : null;
      const label = h === 'disk' ? 'MENYN - KLICKA PÅ DISKEN' : h === 'glassdisk' ? 'GLASSDISKEN - KLICKA FÖR MENYN'
        : h === 'dorr' ? (me.order ? 'ÄT UPP MATEN FÖRST - SEN KAN DU GÅ UT' : 'GÅ UT') : h === 'jobb' ? 'JOBBA HÄR - SERVERA ELLER KÖKET'
          : h === 'jukebox' ? 'JUKEBOXEN - SPELA EN LÅT' : h === 'gumball' ? 'TUGGUMMIKULA - 1 KR' : null;
      if (label) {
        const w = textW(SMALL, label) + 10;
        ctx.fillStyle = '#17151a'; ctx.fillRect((VW - w) >> 1, H - 14, w, 11);
        ctx.fillStyle = '#e8b230'; ctx.fillRect(((VW - w) >> 1) + 1, H - 13, w - 2, 1);
        ctxText(ctx, SMALL, label, ((VW - w) >> 1) + 5, H - 10, '#f4f1ea');
      }
    },
  };
}
