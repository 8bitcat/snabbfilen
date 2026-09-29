// FRISÖREN – salongen man går in i (💈 FRISÖR på Södergatan i centrum). Samma färger som
// fasaden i js/city/buildings-downtown.js: mintgrön tapet, marinblå boasering med guldlister,
// barberarstolpen i rött/vitt/blått. Butiken är 640 px bred och rullar med figuren.
//
// Från vänster: väntsoffan (rosa sammet) med tidningsställ och glasbord, dörren med
// FRISÖR-neon och den snurrande randiga frisörstolpen, kassadisken med prislistan,
// produkthyllan, tre frisörstolar framför var sin spegel med glödlampor (verktygsvagnar
// mellan), tvätthoarna med handdukshyllan och torkhuvarna. Framför stolarna ligger mattan
// med saxen och FRISYRBOKEN på sitt ställ.
//
// Så går det till: sätt dig i en ledig stol → frisören Sami kommer fram → välj frisyr
// (alla frisyrer i registret, grupperade) och hårfärg (färg + slingor/toppar/tvåfärgat)
// med förhandsbild på DIN figur → betala (klippning 100–300 kr efter frisyrens sort,
// färgning 250 kr, se FRISOR_PRIS) → Sami klipper i en kort sekvens: kappan på, sprej,
// färg, sax, fön och "Tadaa!" – och du går ut med den nya frisyren (sparas i avataren).
// Frisyrboken visar samma katalog utan att man sätter sig.
//
// Salongen lever: Fia tar emot kunder som kommer in, väntar i soffan med en tidning, får
// håret tvättat (skum och vatten), klipps (sax, hårtussar som faller, ny frisyr), betalar
// vid disken och går ut. En kund sitter under torkhuven. Speglarna visar den som sitter i
// stolen framifrån. Hårtussarna ligger kvar på golvet tills frisören sopar.
//
// _debug-API för tools/frisor-test.mjs.
import { drawPerson, makeLookRich, HAIR, LOOK_FIELDS } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer, hex, css } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import { fmt } from '../game.js';
import * as SND from '../core/sound.js';
import { saveAvatar } from '../core/avatar.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, WALK_SEQ } from './walkable.js';
import * as WORLD from '../net/world.js';

const play = (n) => { try { SND.play(n); } catch { /* ljud är aldrig ett krav */ } };

// ================= mått och plan =================
const W = 640, H = 216;                 // salongens storlek (rullar i sidled)
const WALL_Y = 70;                       // bakväggens fot = golvets början
let VW = 384;                            // synlig bredd (mobilfyllning: följer skärmen, klampad till salongen)
const syncView = (A) => { VW = Math.max(384, Math.min(A?.W || 384, W)); };
const SOFA = { x0: 12, x1: 72, y: 86, seats: [26, 42, 58] };
const TABLE = { x0: 26, x1: 58, y0: 96, y1: 108 };
const RACK = { x0: 76, x1: 88 };
const DOOR = { x0: 96, x1: 128, top: 26 }, DOOR_CX = 112;
const NEON = { x0: 112 - ((textW(BIG, 'FRISÖR') + 12) >> 1), w: textW(BIG, 'FRISÖR') + 12 }; // skylten ovanför dörren
const POLE = { x: 134, y0: 20, y1: 58 };
const BOARD = { x0: 146, x1: 220, y0: 8, y1: 66 };
const DESK = { x0: 148, x1: 216, y0: 78, y1: 106 };
const SAMI_DESK = [178, 92];             // bakom disken
const PAY_AT = [182, 116];               // kunden betalar här (framför disken)
const SHELF = { x0: 224, x1: 264, y0: 12, y1: 80 };
const STATIONS = [300, 372, 444];        // frisörstolarnas mitt
const SEAT_Y = 112;                      // fötterna på den som sitter i en frisörstol
const GLASS = { dx0: -13, dx1: 13, y0: 11, y1: 49 }; // spegelglaset (relativt stolens mitt)
const TROLLEYS = [336, 408];
const WASH = [504, 544], WASH_Y = 94;
const DRYERS = [588, 620], DRYER_Y = 94;
const CLOCK = [604, 22];
const BOOK = { x: 248, y: 166 };
const RUG = { x0: 272, x1: 472, y0: 132, y1: 198 };
const PLANTS = [[20, 208], [620, 208]];
const KIDCAR = { x: 62, y: 192 };          // barnstolen (bilen) – mitt och fot
const GONDOLA = { x0: 128, x1: 200, y: 178 }; // hyllgondolen HÅRVÅRD – fot
const NAILS = { x: 548, y: 180 };          // nagelbaren – mitt och fot
const LAMPS = [42, 186, 336, 408, 524, 566];

// ================= färger =================
const INK = 0x1d1822;
const NAVY = 0x1c2a4a, NAVY2 = 0x283a62, NAVY_HI = 0x3c5486, NAVY_DK = 0x101a30;
const GOLD = 0xd8b060, GOLD_HI = 0xf4dc98, GOLD_LO = 0x9a7430;
const CHROME = 0xc8ccd4, CHROME_HI = 0xf4f6f8, CHROME_LO = 0x8a9098, CHROME_DK = 0x5a5e66;
const LEATHER = 0x7a2434, LEATHER_HI = 0xa8404e, LEATHER_LO = 0x551824, LEATHER_DK = 0x36101a;
const ROSE = 0xd98a9a, ROSE_HI = 0xefb4c0, ROSE_LO = 0xb0606e, ROSE_DK = 0x7a3a48;
const WHITE = 0xffffff, CREAM = 0xf4f1ea;
const POLE_C = [0xd8323a, 0xf4f4f4, 0x2a5ab0, 0xf4f4f4];

// ================= priser =================
// Klippningens pris beror på frisyrens sort (registrets grupp i js/core/people/hair.js).
// Nya grupper utan egen rad räknas som vanlig klippning. Gruppen Kul (kattöron, hjärtknutar,
// animetaggar …) räknas som uppsättning – prislistan på väggen har bara plats för sex rader.
export const FRISOR_PRIS = {
  klippning: { label: 'Klippning', board: 'KLIPPNING', price: 150 },
  rakning: { label: 'Rakning & snagg', board: 'RAKNING', price: 100 },
  uppsatt: { label: 'Uppsättning', board: 'UPPSÄTTNING', price: 200 },
  lockar: { label: 'Lockar & afro', board: 'LOCKAR', price: 250 },
  flator: { label: 'Flätor & dreads', board: 'FLÄTOR', price: 300 },
  fargning: { label: 'Färgning', board: 'FÄRGNING', price: 250 },
};
const GROUP_KIND = { 'Rakat': 'rakning', 'Uppsatt': 'uppsatt', 'Kul': 'uppsatt', 'Lockar': 'lockar', 'Afro': 'lockar', 'Dreads & twists': 'flator', 'Flätor': 'flator' };
const styleReg = () => LOOK_FIELDS.style.reg;
const fxReg = () => LOOK_FIELDS.hairFx.reg;
const hasStyle = (id) => typeof id === 'string' && Object.hasOwn(styleReg(), id);
const groupOf = (id) => styleReg()[id]?.group || 'Övrigt';
const labelOf = (id, reg = styleReg()) => String(reg[id]?.label || id).replace(/­/g, '');
export const cutKind = (style) => GROUP_KIND[groupOf(style)] || 'klippning';
const HEXRE = /^#[0-9a-f]{6}$/i;
const cleanHair = (c, fb) => (typeof c === 'string' && HEXRE.test(c) ? c.toLowerCase() : fb);
// Vad kostar det att gå från utseendet `from` till valet `to` ({ style, hair, hairFx, hair2 })?
export function frisorPris(from, to) {
  const f = hairOf(from), s = hairOf({ ...from, ...to });
  const cut = s.style !== f.style;
  const color = s.hair !== f.hair || s.hairFx !== f.hairFx || (s.hairFx !== 'none' && s.hair2 !== f.hair2);
  const lines = [];
  if (cut) { const k = FRISOR_PRIS[cutKind(s.style)]; lines.push({ id: 'cut', label: `${k.label} (${labelOf(s.style)})`, price: k.price }); }
  if (color) lines.push({ id: 'color', label: FRISOR_PRIS.fargning.label, price: FRISOR_PRIS.fargning.price });
  return { cut, color, lines, total: lines.reduce((a, l) => a + l.price, 0) };
}
// Bara hårets fält ur ett utseende (normaliserat)
function hairOf(L) {
  const fx = typeof L?.hairFx === 'string' && Object.hasOwn(fxReg(), L.hairFx) ? L.hairFx : 'none';
  return {
    style: hasStyle(L?.style) ? L.style : 'short',
    hair: cleanHair(L?.hair, '#3b2619'),
    hairFx: fx,
    hair2: fx === 'none' ? null : cleanHair(L?.hair2, null),
  };
}

// ================= figurer =================
// Frisörerna (förkläde = butiksbiträde i people.js)
const FIA = { skin: '#f6d7bf', hair: '#f28bb3', style: 'pixie', hairFx: 'tips', hair2: '#8e5bd1', top: 'tee', shirt: '#23222a', accent: '#23222a',
  bottom: 'jeans', pants: '#2b2b30', shoes: '#1c1c1c', apron: true, build: 4, glasses: false, beard: false, phones: false, bag: null, hat: null, jewel: 'hoops', blush: true };
const SAMI = { skin: '#a06a43', hair: '#1d1714', style: 'pompadour', top: 'shirt', shirt: '#1c2a4a', accent: '#d8b060', bottom: 'pants', pants: '#2b2b30',
  shoes: '#6b3e1e', apron: true, build: 5, glasses: false, beard: 'stubble', phones: false, bag: null, hat: null };
// frisörkappan: marinblå med guldprickar (polotröjan ger kragen runt halsen)
const CAPE = { top: 'turtleneck', topPrint: 'dots', shirt: '#1c2a4a', print2: '#d8b060', accent: '#1c2a4a', neck: 'none', bag: null, apron: false, hat: null, phones: false, hairAcc: 'none' };
const noHead = (L) => ({ ...L, hat: null, phones: false, hairAcc: 'none' });
const caped = (L) => ({ ...L, ...CAPE });
// kundens utseende med kappa – samma objekt så länge utseendet är detsamma (spritecachen i people.js)
const capeOf = (c) => { if (c._capeSrc !== c.look) { c._capeSrc = c.look; c._cape = caped(c.look); } return c._cape; };
// Frisyrer som kunderna går ut med (bara de som finns i registret används)
const NPC_STYLES = ['bob', 'lob', 'pixie', 'quiff', 'shag', 'wolf', 'curlyBob', 'highPony', 'messyBun', 'frenchBraid', 'fade', 'undercut', 'crop',
  'curtains', 'layered', 'sidePony', 'afroPuff', 'twists', 'boxBraids', 'slick', 'crew', 'bubblePony', 'halfUp', 'flipped', 'afroFade', 'longWaves',
  'ivy', 'edgar', 'swoop', 'mop', 'aLine', 'bixie', 'feathered', 'hollywood', 'shortCurls', 'perm', 'afroPart', 'twistOut', 'dreadsTop',
  'ballerina', 'halfBuns', 'longPony', 'scrunchiePony', 'curlyPony', 'fishtail', 'braidsLong', 'braidBun'];
const NPC_COLORS = ['#3b2619', '#1d1714', '#6b4226', '#a5692f', '#d9a95c', '#ecd489', '#b7392b', '#c65fa0', '#3f4fa8', '#e0702a'];
// Hårfärgerna i väljaren
const uniq = (a) => [...new Set(a.map((c) => c.toLowerCase()))];
const HAIR_PAL = uniq([...HAIR, '#f4f1ea', '#7b4fb8', '#e0702a', '#f28bb3', '#ff5d8f', '#3fc4ff', '#46a35a', '#9fd356']);
const HAIR2_PAL = uniq(['#ecd489', '#f4f1ea', '#d9a95c', '#b9b3ab', '#b7392b', '#e0702a', '#f28bb3', '#ff5d8f', '#c65fa0', '#8e5bd1', '#3fc4ff', '#3f4fa8', '#2f8f6f', '#9fd356', '#1d1714', '#6b4226']);

// Enkel fröad slump (samma frö ger samma kund)
const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const pickOf = (rng, a) => a[Math.floor(rng() * a.length)];
const mixHex = (a, b, k) => css(mix(hex(a, 0x3b2619), hex(b, 0x3b2619), k));

// Var sitter huvudet på en sittande figur (fötterna i fx, fy, bildruta 5)?
const headOf = (L, fx, fy) => (L?.kid ? { x0: fx - 5, x1: fx + 4, top: fy - 24, bot: fy - 14, cy: fy - 19 } : { x0: fx - 5, x1: fx + 4, top: fy - 32, bot: fy - 21, cy: fy - 26 });

// ================= ljud (små egna effekter; tyst om ljudet är av) =================
let NOISE = null;
function sfx(kind) {
  try {
    if (SND.isMuted?.()) return;
    const c = SND.audioContext?.();
    if (!c) return;
    if (!NOISE || NOISE.sampleRate !== c.sampleRate) {
      NOISE = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      const d = NOISE.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const burst = (at, dur, type, freq, q, vol, attack = 0.004) => {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + at;
      src.buffer = NOISE; f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
    };
    if (kind === 'snip') { burst(0, 0.035, 'bandpass', 6200, 2.5, 0.09); burst(0.06, 0.03, 'bandpass', 7400, 3, 0.06); }
    else if (kind === 'sprej') burst(0, 0.22, 'highpass', 3800, 0.7, 0.05, 0.01);
    else if (kind === 'fon') burst(0, 1.3, 'lowpass', 1100, 0.8, 0.035, 0.12);
    else if (kind === 'vatten') burst(0, 0.9, 'bandpass', 2400, 0.6, 0.025, 0.1);
    else if (kind === 'pling') {
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime;
      o.type = 'sine'; o.frequency.value = 1760;
      g.gain.setValueAtTime(0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + 0.62);
    }
  } catch { /* ljud är aldrig värt en krasch */ }
}

// ================= scenen =================
export function makeShopFrisor(A) {
  const g = A.game;
  const OBST = [
    [SOFA.x0 - 2, 64, SOFA.x1 + 2, 88],
    [TABLE.x0, TABLE.y0 + 1, TABLE.x1, TABLE.y1],
    [RACK.x0, 60, RACK.x1, 88],
    [DESK.x0, 74, DESK.x1, DESK.y1],
    [SHELF.x0, 70, SHELF.x1, 80],
    ...STATIONS.map((cx) => [cx - 10, 104, cx + 10, 118]),
    ...TROLLEYS.map((x) => [x - 7, 66, x + 7, 86]),
    ...WASH.map((x) => [x - 12, 66, x + 12, 100]),
    ...DRYERS.map((x) => [x - 12, 66, x + 12, 100]),
    [BOOK.x - 10, BOOK.y - 16, BOOK.x + 10, BOOK.y + 2],
    [KIDCAR.x - 18, KIDCAR.y - 12, KIDCAR.x + 18, KIDCAR.y + 1],
    [GONDOLA.x0 - 2, GONDOLA.y - 12, GONDOLA.x1 + 2, GONDOLA.y + 1],
    [NAILS.x - 23, NAILS.y - 14, NAILS.x + 23, NAILS.y + 1],
    ...PLANTS.map(([x, y]) => [x - 8, y - 6, x + 8, y + 2]),
  ];
  const walker = createWalker({ W, H, top: WALL_Y + 4, bottom: H - 6, spawn: [DOOR_CX, WALL_Y + 10] });
  walker.setObstacles(OBST);
  walker.snapFree();
  const nav = createWalker({ W, H, top: WALL_Y + 4, bottom: H - 6 }); // bara vägvisare för personalen och kunderna
  nav.setObstacles(OBST);

  const R = paintAll();
  const talkMe = createSpeech(), talkSami = createSpeech(), talkFia = createSpeech(), talkCust = createSpeech();
  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, greetT = 0.9;
  const camTarget = () => {
    if (lockedCam !== null) return lockedCam;
    const fx = me.state === 'chair' ? STATIONS[me.chair] : me.state === 'sofa' ? SOFA.seats[me.sofa] : walker.px;
    return Math.max(0, Math.min(W - VW, fx - VW / 2));
  };
  const cam = { x: 0 };

  // ---------- stolarna ----------
  // occ: null | 'me' | kund; tufts = hårtussar på golvet; fall = tussar i luften; fx = puff/glitter
  const chairs = STATIONS.map((cx, i) => ({ i, cx, x: cx, y: SEAT_Y, occ: null, tufts: [], fall: [], fx: [] }));
  const sofaSeats = SOFA.seats.map((x) => ({ x, y: SOFA.y, occ: null })); // bara för andra spelare som sitter där
  const freeChair = (pref = [0, 2, 1]) => pref.map((i) => chairs[i]).find((c) => !c.occ) || null;

  // ---------- jag ----------
  // state: free | chair | sofa | cut (sekvensen) ; seq = klippningen som pågår
  const me = { state: 'free', chair: -1, sofa: -1, seq: null, doneT: 0, openT: 0, pendingSel: null, readT: 0, mag: 0 };

  // ---------- personalen (enkel rörelse längs vägvisarens vägar) ----------
  const mover = (x, y, dir = 'down') => ({ x, y, dir, path: [], speed: 48, cb: null, walking: false });
  function moveTo(m, tx, ty, cb, pre = []) {
    const pts = [...pre];
    const [sx, sy] = pre.length ? pre[pre.length - 1] : [m.x, m.y];
    const way = nav.findPath(sx, sy, tx, ty);
    pts.push(...way, [tx, ty]);
    m.path = pts; m.cb = cb || null;
  }
  function stepMover(m, dt) {
    if (!m.path.length) { m.walking = false; return; }
    m.walking = true;
    const [gx, gy] = m.path[0];
    const dx = gx - m.x, dy = gy - m.y, d = Math.hypot(dx, dy), st = m.speed * dt;
    if (d > 0.5) m.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (d <= st) {
      m.x = gx; m.y = gy; m.path.shift();
      if (!m.path.length) { m.walking = false; const cb = m.cb; m.cb = null; cb?.(); }
    } else { m.x += dx / d * st; m.y += dy / d * st; }
  }
  const walkFrame = (m, carry = false) => (m.walking ? (carry ? [7, 9, 8, 9] : WALK_SEQ)[Math.floor(t * 8.5) % 4] : carry ? 9 : (Math.sin(t * 2 + m.x) > 0.93 ? 4 : 0));
  // bredvid stolen, vänd mot huvudet (händerna i höjd med huvudet på den som sitter)
  const besideChair = (i) => [STATIONS[i] + 11, SEAT_Y - 9];
  // tillbaka bakom disken: fram till diskens högra ände, sedan rakt in bakom den
  const samiHome = (m, cb) => moveTo(m, 222, 92, () => { m.path = [[SAMI_DESK[0], SAMI_DESK[1]]]; m.cb = cb || null; });
  const fromDesk = (m) => (m.x < 220 && m.y < 106 && m.x > 146 ? [[222, 92]] : []);

  // Sami tar hand om mig; Fia om kunderna
  const sami = { m: mover(SAMI_DESK[0], SAMI_DESK[1]), state: 'desk', chair: -1, tool: null, sweepChair: -1, look: SAMI };
  const fia = { m: { ...mover(STATIONS[0] + 22, 94), speed: 54 }, state: 'idle', chair: -1, tool: null, cust: null, look: FIA, t: 0 };

  // ---------- kunderna ----------
  let custSeed = 1 + Math.floor(Math.random() * 999), spawnT = 7 + Math.random() * 5; // Samis hälsning hörs först
  const custs = [];
  function newCust(at = 'door') {
    const look = noHead(makeLookRich(rngOf(custSeed * 7919 + 17)));
    custSeed++;
    look.bag = null; look.apron = false;
    const c = { look, m: { ...mover(DOOR_CX, WALL_Y + 6), speed: 56 }, state: 'in', t: 0, sofa: -1, chair: -1, wash: -1, paid: false, mag: (custSeed % 4) };
    if (at === 'sofa') { const s = freeSofa(); if (s >= 0) { c.sofa = s; c.state = 'sofa'; c.m.x = SOFA.seats[s]; c.m.y = SOFA.y; c.t = Math.random() * 6; } }
    custs.push(c);
    return c;
  }
  const sofaTaken = (k) => (me.sofa === k && me.state === 'sofa') || sofaSeats[k]?.occ?.state === 'remote' || custs.some((c) => c.sofa === k && (c.state === 'sofa' || c.state === 'toSofa'));
  const freeSofa = () => [1, 0, 2].find((k) => !sofaTaken(k)) ?? -1;
  // den som sitter under torkhuven (sitter kvar hela besöket, bläddrar i en tidning)
  const dryerCust = { look: noHead(makeLookRich(rngOf(4242))), pling: 20 + Math.random() * 20, mag: 1 };
  dryerCust.look.bag = null;
  // en kund väntar redan i soffan när man kommer in, och Fia har en kund i stolen
  newCust('sofa');
  {
    const c = newCust('sofa');
    c.sofa = -1; c.state = 'cut'; c.chair = 0; chairs[0].occ = c; c.m.x = STATIONS[0]; c.m.y = SEAT_Y; c.t = 2 + Math.random() * 3;
    fia.state = 'cut'; fia.cust = c; fia.chair = 0; [fia.m.x, fia.m.y] = besideChair(0); fia.m.dir = 'left';
  }

  // ================= kundflödet =================
  function updateCusts(dt) {
    spawnT -= dt;
    if (spawnT <= 0 && custs.length < 3 && freeSofa() >= 0) {
      spawnT = 10 + Math.random() * 14;
      const c = newCust();
      c.state = 'toSofa'; c.sofa = freeSofa();
      moveTo(c.m, SOFA.seats[c.sofa], SOFA.y + 8, () => { c.state = 'sofa'; c.m.x = SOFA.seats[c.sofa]; c.m.y = SOFA.y; c.m.dir = 'down'; c.t = 0; });
      talkCust.say(pickOf(Math.random, ['Hej! Har ni en tid över?', 'Hej hej! 👋', 'Jag vill ha något nytt i dag!', 'Hej! Jag tar en tidning och väntar.']), () => ({ x: c.m.x, y: c.m.y - 44 }), 3);
    }
    for (const c of custs) {
      c.t += dt;
      stepMover(c.m, dt);
      if (c.state === 'sofa') c.mag = Math.floor(c.t / 5) % 4;
    }
    // Fia ropar in nästa kund när hon är ledig, tvättstolen och en frisörstol är lediga
    if (fia.state === 'idle' && fia.t > 2.5) {
      const next = custs.filter((c) => c.state === 'sofa').sort((a, b) => b.t - a.t)[0];
      const ch = freeChair();
      if (next && ch) {
        fia.state = 'toWash'; fia.cust = next; fia.chair = -1;
        next.state = 'toWash'; next.wash = 0; const bx = WASH[0];
        talkFia.say(pickOf(Math.random, ['Nästa, varsågod! 😊', 'Då är det din tur!', 'Varsågod, vi börjar med en hårtvätt!']), () => ({ x: fia.m.x, y: fia.m.y - 44 }), 3, { voice: FIA });
        const s = next.sofa; next.sofa = -1;
        moveTo(next.m, bx, WASH_Y + 12, () => { next.m.x = bx; next.m.y = WASH_Y; next.m.dir = 'down'; next.state = 'wash'; next.t = 0; }, [[SOFA.seats[s], SOFA.y + 8]]);
        moveTo(fia.m, bx + 15, 86, () => { fia.m.dir = 'left'; fia.state = 'washing'; fia.t = 0; sfx('vatten'); });
      }
    }
    // hårtvätt
    if (fia.state === 'washing' && fia.cust?.state === 'wash') {
      fia.tool = 'dusch';
      if (fia.cust.t > 6.5) { // tvätten räknas från att kunden satt sig
        const c = fia.cust, ch = freeChair();
        if (ch) {
          fia.tool = null; fia.state = 'toChair'; fia.chair = ch.i; ch.occ = c; c.chair = ch.i; c.wash = -1;
          c.state = 'toChair';
          moveTo(c.m, ch.cx, SEAT_Y + 14, () => { c.m.x = ch.cx; c.m.y = SEAT_Y; c.m.dir = 'up'; c.state = 'cut'; c.t = 0; });
          const [bx, by] = besideChair(ch.i);
          moveTo(fia.m, bx + 4, by + 3, () => { fia.m.x = bx; fia.m.y = by; fia.m.dir = 'left'; fia.state = 'cut'; fia.t = 0; });
        }
      }
    }
    // klippning (Fia + kund i stolen)
    if (fia.state === 'cut' && fia.cust?.state === 'cut') {
      const c = fia.cust, ch = chairs[c.chair];
      const T = c.t;
      fia.tool = T < 8.5 ? 'sax' : T < 10.5 ? 'fon' : 'spegel';
      if (T < 8.5 && Math.floor(T / 0.26) !== Math.floor((T - dt) / 0.26)) { if (inView(ch.cx)) sfx('snip'); }
      if (T < 8.5) spawnTufts(ch, c.look, dt, c.look.hair);
      if (T >= 4.8 && !c.newDone) {
        c.newDone = true;
        const rng = Math.random;
        const pool = NPC_STYLES.filter((id) => hasStyle(id) && id !== c.look.style);
        c.look = { ...c.look, style: pickOf(rng, pool.length ? pool : ['bob']), ...(rng() < 0.3 ? { hair: pickOf(rng, NPC_COLORS) } : {}) };
        poof(ch, c.look);
      }
      if (T >= 8.5 && T - dt < 8.5 && inView(ch.cx)) sfx('fon');
      if (T >= 10.5 && T - dt < 10.5) { sparkle(ch, c.look); talkFia.say(pickOf(Math.random, ['Klart! Så fint det blev! ✨', 'Tadaa! Titta i spegeln!', 'Snyggt! Vad tycker du?']), () => ({ x: fia.m.x, y: fia.m.y - 44 }), 3, { voice: FIA }); }
      if (T >= 12) {
        // kunden reser sig, betalar vid disken och går ut – Fia sopar
        ch.occ = null; c.chair = -1; c.state = 'toPay'; c.m.y = SEAT_Y + 14; c.m.x = ch.cx;
        moveTo(c.m, PAY_AT[0], PAY_AT[1], () => { c.m.dir = 'up'; c.state = 'pay'; c.t = 0; });
        talkCust.say(pickOf(Math.random, ['Tack! Jag älskar den! 😍', 'Wow, tack Fia!', 'Nu känner jag mig som en ny människa!', 'Perfekt! Tack!']), () => ({ x: c.m.x, y: c.m.y - 44 }), 3);
        fia.state = 'sweep'; fia.tool = 'kvast'; fia.t = 0; fia.chair = ch.i; fia.cust = null;
        moveTo(fia.m, ch.cx + 8, SEAT_Y + 12, () => { fia.m.dir = 'left'; });
      }
    }
    // betala och gå ut
    for (const c of custs) {
      if (c.state === 'pay' && c.t > 1.6 && !c.paid) {
        c.paid = true;
        const price = FRISOR_PRIS[cutKind(c.look.style)].price;
        if (sami.state === 'desk') talkSami.say(`Det blir ${price} kr. Tack och välkommen åter! 💈`, () => ({ x: sami.m.x, y: sami.m.y - 44 }), 3, { voice: SAMI });
        if (inView(PAY_AT[0])) play('coin');
      }
      if (c.state === 'pay' && c.t > 3) { c.state = 'out'; moveTo(c.m, DOOR_CX, WALL_Y + 6, () => { c.state = 'gone'; if (inView(DOOR_CX)) play('door'); }); }
    }
    for (let i = custs.length - 1; i >= 0; i--) if (custs[i].state === 'gone') custs.splice(i, 1);
  }

  function updateStaff(dt) {
    fia.t += dt;
    stepMover(fia.m, dt);
    stepMover(sami.m, dt);
    // Fia sopar upp hårtussarna och går tillbaka till sin plats vid vagnen
    if (fia.state === 'sweep') {
      const ch = chairs[fia.chair];
      if (!fia.m.walking) fadeTufts(ch, dt);
      if (fia.t > 3.4 && !fia.m.walking) {
        ch.tufts = []; fia.tool = null; fia.state = 'toIdle'; fia.chair = -1;
        moveTo(fia.m, TROLLEYS[0] - 14, 96, () => { fia.m.dir = 'down'; fia.state = 'idle'; fia.t = 0; });
      }
    }
    if (sami.state === 'sweep') {
      const ch = chairs[sami.sweepChair];
      if (!sami.m.walking && ch) { fadeTufts(ch, dt); sami.t = (sami.t || 0) + dt; }
      if ((sami.t || 0) > 2.8 && !sami.m.walking) {
        if (ch) ch.tufts = [];
        sami.tool = null; sami.t = 0; sami.state = 'toDesk'; sami.sweepChair = -1;
        samiHome(sami.m, () => { sami.m.dir = 'down'; sami.state = 'desk'; });
      }
    }
  }

  // ================= hårtussar, puff och glitter =================
  function spawnTufts(ch, look, dt, color) {
    const hd = headOf(look, ch.cx, SEAT_Y - (look.kid ? 7 : 0));
    ch.spawnAcc = (ch.spawnAcc || 0) + dt;
    while (ch.spawnAcc > 0.07) {
      ch.spawnAcc -= 0.07;
      const base = hex(color, 0x3b2619);
      const c = [base, mul(base, 0.8), mix(base, 0xffffff, 0.18)][Math.floor(Math.random() * 3)];
      ch.fall.push({ x: hd.x0 - 1 + Math.random() * 11, y: hd.cy - 2 + Math.random() * 8, vx: (Math.random() - 0.5) * 16, vy: 6 + Math.random() * 10, c, s: Math.random() < 0.35 ? 2 : 1,
        land: SEAT_Y + 1 + Math.random() * 9 });
    }
  }
  function updateFx(dt) {
    for (const ch of chairs) {
      for (let i = ch.fall.length - 1; i >= 0; i--) {
        const p = ch.fall[i];
        p.vy += 70 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96;
        if (p.y >= p.land) {
          ch.fall.splice(i, 1);
          const x = Math.max(ch.cx - 16, Math.min(ch.cx + 16, Math.round(p.x)));
          if (ch.tufts.length < 90) ch.tufts.push({ x, y: Math.round(p.land), c: p.c, s: p.s, a: 1 });
        }
      }
      for (let i = ch.fx.length - 1; i >= 0; i--) { ch.fx[i].t += dt; if (ch.fx[i].t > ch.fx[i].dur) ch.fx.splice(i, 1); }
    }
  }
  function fadeTufts(ch, dt) { for (const q of ch.tufts) q.a = Math.max(0, q.a - dt * 0.45); }
  function poof(ch, look) { const hd = headOf(look, ch.cx, SEAT_Y - (look.kid ? 7 : 0)); ch.fx.push({ kind: 'puff', t: 0, dur: 0.45, x: (hd.x0 + hd.x1) / 2, y: hd.cy }); if (inView(ch.cx)) play('slide'); }
  function sparkle(ch, look) { const hd = headOf(look, ch.cx, SEAT_Y - (look.kid ? 7 : 0)); ch.fx.push({ kind: 'glitter', t: 0, dur: 1.6, x: (hd.x0 + hd.x1) / 2, y: hd.cy }); }
  const inView = (x) => x > cam.x - 20 && x < cam.x + VW + 20;

  // ================= jag: stolen, soffan, klippningen =================
  function sitChair(i, sel = null) {
    const ch = chairs[i];
    if (ch.occ && ch.occ !== 'me') { talkMe.say('Den stolen är upptagen – jag tar en ledig! 💺', () => ({ x: walker.px, y: walker.py - 44 }), 3); return; }
    ch.occ = 'me'; me.state = 'chair'; me.chair = i; me.pendingSel = sel;
    walker.stop(); walker.px = ch.cx; walker.py = SEAT_Y + 14; walker.dir = 'up';
    play('click');
    // Sami kommer fram (från disken, eller från där han står)
    const [bx, by] = besideChair(i);
    if (sami.state === 'atChair' && sami.chair === i) { samiReady(); return; }
    if (sami.state === 'sweep' && chairs[sami.sweepChair]) { chairs[sami.sweepChair].tufts = []; sami.sweepChair = -1; } // han hann sopa klart
    sami.state = 'toChair'; sami.chair = i; sami.tool = null;
    moveTo(sami.m, bx + 4, by + 3, () => { sami.m.x = bx; sami.m.y = by; sami.m.dir = 'left'; sami.state = 'atChair'; samiReady(); }, fromDesk(sami.m));
  }
  function samiReady() {
    if (me.state !== 'chair') return;
    talkSami.say(pickOf(Math.random, ['Hej! Vad ska vi göra med håret i dag? ✂️', 'Välkommen! Något nytt i dag?', 'Hej hej! Klippa, färga – eller både och?']), () => ({ x: sami.m.x, y: sami.m.y - 44 }), 3, { voice: SAMI });
    me.openT = 0.7; // väljaren öppnas strax (så att man hinner se Sami)
  }
  function standUp() {
    if (me.state === 'chair') {
      const ch = chairs[me.chair];
      ch.occ = null;
      walker.px = ch.cx; walker.py = SEAT_Y + 14; walker.dir = 'down'; walker.snapFree();
      // Sami sopar om det ligger hår på golvet, annars tillbaka till disken
      if (ch.tufts.length) {
        sami.state = 'sweep'; sami.sweepChair = ch.i; sami.tool = 'kvast'; sami.t = 0;
        moveTo(sami.m, ch.cx + 8, SEAT_Y + 12, () => { sami.m.dir = 'left'; });
      } else if (sami.chair === ch.i) { sami.state = 'toDesk'; sami.tool = null; samiHome(sami.m, () => { sami.m.dir = 'down'; sami.state = 'desk'; }); }
      sami.chair = -1;
    } else if (me.state === 'sofa') {
      walker.px = SOFA.seats[me.sofa]; walker.py = SOFA.y + 8; walker.dir = 'down'; walker.snapFree();
    }
    me.state = 'free'; me.chair = -1; me.sofa = -1; me.openT = 0;
  }
  function sitSofa(k) {
    if (k < 0 || sofaTaken(k)) { talkMe.say('Soffan är full – jag står en stund.', () => ({ x: walker.px, y: walker.py - 44 }), 3); return; }
    me.state = 'sofa'; me.sofa = k; me.readT = 0; me.mag = Math.floor(Math.random() * 4);
    walker.stop(); walker.px = SOFA.seats[k]; walker.py = SOFA.y;
    play('click');
    talkMe.say(pickOf(Math.random, HEADLINES), () => ({ x: SOFA.seats[k], y: SOFA.y - 44 }), 4.5);
  }

  // ---------- klippningen (sekvensen) ----------
  function startCut(sel, { instant = false } = {}) {
    if (me.state !== 'chair') return { ok: false, msg: 'Sätt dig i en frisörstol först.' };
    const now = A.avatar.look, pris = frisorPris(now, sel);
    if (!pris.total) return { ok: false, msg: 'Välj en ny frisyr eller färg först.' };
    if (g.money < pris.total) return { ok: false, msg: `Du har inte råd – det kostar ${fmt(pris.total)}.` };
    g.money -= pris.total;
    g.save();
    play('buy');
    const to = hairOf({ ...now, ...sel });
    me.seq = buildSeq(noHead(now), to, pris);
    me.state = 'cut';
    sami.state = 'cut';
    if (instant) finishSeq();
    return { ok: true, price: pris.total };
  }
  function buildSeq(from, to, pris) {
    const phases = [];
    let t0 = 0;
    const add = (name, dur) => { phases.push({ name, t0, t1: t0 + dur }); t0 += dur; };
    add('kappa', 1.1); add('sprej', 1.2);
    if (pris.color) add('farg', 3.0);
    if (pris.cut) add('klipp', 3.8); else add('kam', 1.2);
    add('fon', 1.8); add('klar', 1.6);
    const steps = [];
    for (let k = 0; k <= 4; k++) steps.push(caped({ ...from, hair: pris.color ? mixHex(from.hair, to.hair, k / 4) : from.hair, ...(pris.color && k === 4 ? { hairFx: to.hairFx, hair2: to.hair2 } : {}) }));
    const cutDone = { ...steps[4], style: to.style };
    const fin = { ...from, ...to };
    return { t: 0, phases, total: t0, from, to, pris, steps, cutDone, fin, uncaped: from, said: {} };
  }
  const phaseOf = (s) => s.phases.find((p) => s.t < p.t1) || s.phases[s.phases.length - 1];
  function seqLook(s) {
    const p = phaseOf(s), k = Math.max(0, Math.min(1, (s.t - p.t0) / (p.t1 - p.t0)));
    switch (p.name) {
      case 'kappa': return k < 0.3 ? s.uncaped : s.steps[0];
      case 'sprej': return s.steps[0];
      case 'farg': return s.steps[Math.min(4, Math.floor(k * 5))];
      case 'klipp': return k < 0.55 ? s.steps[4] : s.cutDone;
      case 'kam': return s.steps[4];
      case 'fon': return s.cutDone;
      default: return s.fin;
    }
  }
  const SEQ_TALK = {
    kappa: 'Kappan på – så där! 🧥', sprej: 'Lite vatten först …', farg: 'Nu färgar vi! 🎨', klipp: 'Klipp, klipp! ✂️',
    kam: 'Lite kam och form …', fon: 'Och så fönar vi! 💨', klar: 'Tadaa! Titta i spegeln! ✨',
  };
  function updateSeq(dt) {
    const s = me.seq;
    if (!s) return;
    const prevT = s.t;
    s.t += dt;
    const p = phaseOf(s), ch = chairs[me.chair];
    if (!s.said[p.name]) {
      s.said[p.name] = true;
      talkSami.say(SEQ_TALK[p.name], () => ({ x: sami.m.x, y: sami.m.y - 44 }), 2.4, { voice: SAMI });
      if (p.name === 'kappa') play('slide');
      if (p.name === 'sprej') sfx('sprej');
      if (p.name === 'fon') sfx('fon');
      if (p.name === 'klar') { sparkle(ch, s.fin); play('fanfare'); }
    }
    sami.tool = { kappa: 'kam', sprej: 'sprej', farg: 'pensel', klipp: 'sax', kam: 'kam', fon: 'fon', klar: 'spegel' }[p.name];
    if (p.name === 'klipp') {
      if (Math.floor(s.t / 0.24) !== Math.floor(prevT / 0.24)) sfx('snip');
      spawnTufts(ch, s.from, dt, s.pris.color ? s.to.hair : s.from.hair);
      const swapAt = p.t0 + (p.t1 - p.t0) * 0.55;
      if (prevT < swapAt && s.t >= swapAt) poof(ch, s.from);
    }
    if (p.name === 'sprej' && Math.floor(s.t / 0.4) !== Math.floor(prevT / 0.4)) sfx('sprej');
    if (s.t >= s.total) finishSeq();
  }
  function finishSeq(quiet = false) {
    const s = me.seq;
    if (!s) return;
    me.seq = null;
    const patch = { style: s.to.style, hair: s.to.hair, hairFx: s.to.hairFx, hair2: s.to.hair2 };
    A.avatar = saveAvatar({ ...A.avatar, look: { ...A.avatar.look, ...patch } });
    g.passTime((s.pris.cut ? 30 : 0) + (s.pris.color ? 30 : 0) || 20);
    g.save();
    sami.tool = null;
    const name = labelOf(s.to.style);
    if (!quiet) toast(s.pris.cut ? `✂️ Ny frisyr: ${name}! Snyggt!` : '🎨 Ny hårfärg – snyggt!', 'good');
    me.state = 'chair'; me.doneT = 1.4; me.openT = 0;
    sami.state = 'atChair';
    if (quiet && me.state === 'chair') standUp();
  }

  // ================= klickbara saker =================
  const say = (txt) => talkMe.say(txt, () => ({ x: walker.px, y: walker.py - 44 }), 4);
  const spots = [
    { id: 'dorr', r: [DOOR.x0 - 2, DOOR.top, DOOR.x1 + 2, WALL_Y + 6], go: [DOOR_CX, WALL_Y + 8], label: 'UTGÅNG', hint: 'KLICKA FÖR ATT GÅ UT PÅ GATAN', act: () => { play('door'); A.go('city'); } },
    ...chairs.map((ch) => ({ id: 'stol' + ch.i, r: [ch.cx - 13, 78, ch.cx + 13, SEAT_Y + 6], go: [ch.cx, SEAT_Y + 14], chair: ch.i, label: 'FRISÖRSTOL', hint: 'KLICKA OCH SÄTT DIG – VÄLJ NY FRISYR', act: () => sitChair(ch.i) })),
    ...chairs.map((ch) => ({ id: 'spegel' + ch.i, r: [ch.cx - 17, 6, ch.cx + 17, 62], go: [ch.cx, SEAT_Y + 14], chair: ch.i, label: 'SPEGELN', hint: 'KLICKA OCH SÄTT DIG I STOLEN', act: () => sitChair(ch.i) })),
    { id: 'bok', r: [BOOK.x - 13, BOOK.y - 30, BOOK.x + 13, BOOK.y + 2], go: [BOOK.x, BOOK.y + 10], label: 'FRISYRBOKEN', hint: 'BLÄDDRA BLAND ALLA FRISYRER', act: () => openBook() },
    { id: 'affisch', r: [14, 10, 70, 46], go: [42, 94], label: 'NYA FRISYRER', hint: 'KLICKA SÅ BLÄDDRAR DU I FRISYRBOKEN', act: () => openBook() },
    { id: 'pris', r: [BOARD.x0, BOARD.y0, BOARD.x1, BOARD.y1], go: [182, 114], label: 'PRISLISTAN', hint: 'VAD KOSTAR DET?', act: () => talkSami.say('Klippning 150, rakning 100, uppsättning 200, lockar 250, flätor 300 och färgning 250 kr. 💈', () => ({ x: sami.m.x, y: sami.m.y - 44 }), 6, { voice: SAMI }) },
    { id: 'kassa', r: [DESK.x0, 62, DESK.x1, DESK.y1], go: [182, 114], label: 'KASSAN', hint: 'PRATA MED FRISÖREN', act: () => talkSami.say(sami.state === 'desk' ? pickOf(Math.random, ['Sätt dig i en ledig stol så kommer jag! 💺', 'Bläddra i frisyrboken om du vill ha tips!', `Vi har ${Object.keys(styleReg()).length} frisyrer – och alla färger!`]) : 'Jag kommer strax!', () => ({ x: sami.m.x, y: sami.m.y - 44 }), 4, { voice: SAMI }) },
    { id: 'hylla', r: [SHELF.x0, SHELF.y0, SHELF.x1, SHELF.y1], go: [244, 92], label: 'HÅRPRODUKTER', hint: 'SCHAMPO, BALSAM OCH VAX', act: () => say(pickOf(Math.random, ['Schampo med kokosdoft … mmm! 🥥', 'Hårvax, hårspray och glitterspray! ✨', 'Balsam för lockigt hår – och ett för rakt.'])) },
    { id: 'stolpe', r: [POLE.x - 4, POLE.y0 - 6, POLE.x + 10, POLE.y1 + 6], go: [140, 84], label: 'FRISÖRSTOLPEN', hint: 'RÖD, VIT OCH BLÅ – DEN SNURRAR!', act: () => say('Frisörstolpen snurrar och snurrar … jag blir yr! 💈') },
    { id: 'soffa', r: [SOFA.x0 - 2, 48, SOFA.x1 + 2, 88], go: () => { const k = freeSofa(); return [k >= 0 ? SOFA.seats[k] : 42, SOFA.y + 8]; }, label: 'VÄNTSOFFAN', hint: 'SLÅ DIG NER OCH LÄS EN TIDNING', act: () => sitSofa(freeSofa()) },
    { id: 'tidning', r: [RACK.x0, 54, RACK.x1, 88], go: [82, 94], label: 'TIDNINGAR', hint: 'LÄS EN RUBRIK', act: () => say(pickOf(Math.random, HEADLINES)) },
    ...WASH.map((x, i) => ({ id: 'tvatt' + i, r: [x - 12, 40, x + 12, 100], go: [x, 108], label: 'TVÄTTHOARNA', hint: 'HÄR TVÄTTAR FIA HÅRET', act: () => say(i === 0 && fia.state === 'washing' ? 'Skum och varmt vatten … det ser skönt ut! 🫧' : 'Här tvättar Fia håret på kunderna innan de klipps.') })),
    ...DRYERS.map((x, i) => ({ id: 'huv' + i, r: [x - 12, 44, x + 12, 100], go: [x, 108], label: 'TORKHUVEN', hint: 'HÄR TORKAR FÄRGEN', act: () => say(i === 0 ? 'Hon under torkhuven hör nog inte ett ord av vad jag säger. 😄' : 'Torkhuven – här sitter man när färgen ska torka.') })),
    { id: 'bil', r: [KIDCAR.x - 18, KIDCAR.y - 44, KIDCAR.x + 18, KIDCAR.y + 2], go: [KIDCAR.x, KIDCAR.y + 10], label: 'BARNSTOLEN', hint: 'EN BIL! TUT TUT!', act: () => { play('honk'); say('En frisörstol som ser ut som en bil! 🚗 Tut tut!'); } },
    { id: 'gondol', r: [GONDOLA.x0, GONDOLA.y - 44, GONDOLA.x1, GONDOLA.y + 2], go: [(GONDOLA.x0 + GONDOLA.x1) / 2, GONDOLA.y + 10], label: 'HÅRVÅRD', hint: 'SCHAMPO, BALSAM OCH GLITTERSPRAY', act: () => say(pickOf(Math.random, ['Glitterspray! Då glittrar håret i mörkret. ✨', 'Lockkräm, plattång-skydd och torrschampo …', 'NYTT: schampo som luktar jordgubbe! 🍓'])) },
    { id: 'nagel', r: [NAILS.x - 24, NAILS.y - 36, NAILS.x + 24, NAILS.y + 2], go: [NAILS.x, NAILS.y + 10], label: 'NAGELBAREN', hint: 'SÅ MÅNGA FÄRGER!', act: () => say('Nagelbaren – tio färger nagellack! 💅 Fia målar naglar på fredagar.') },
    { id: 'klocka', r: [CLOCK[0] - 8, CLOCK[1] - 8, CLOCK[0] + 8, CLOCK[1] + 8], go: [604, 108], label: 'KLOCKAN', hint: 'SALONGEN HAR ÖPPET 9–18', act: () => say('Salongen har öppet 9 till 18. ⏰') },
  ];
  const spotAt = (x, y) => spots.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const goOf = (h) => (typeof h.go === 'function' ? h.go() : h.go);
  const focusSpot = () => {
    if (me.state !== 'free') return null;
    const h = hoverId && t - hoverT < 4 && spots.find((s) => s.id === hoverId);
    if (h) return h;
    if (walker.path.length) return null;
    return spots.find((s) => s.chair !== undefined && s.id.startsWith('stol') && Math.abs(walker.px - goOf(s)[0]) < 7 && Math.abs(walker.py - goOf(s)[1]) < 7)
      || spots.find((s) => s.id === 'bok' && Math.abs(walker.px - BOOK.x) < 8 && Math.abs(walker.py - BOOK.y - 10) < 8) || null;
  };

  // ---------- väljaren ----------
  function openChooser(sel) {
    const pre = sel || me.pendingSel || null;
    me.pendingSel = null;
    openFrisyrValjare(A, {
      mode: 'stol', sel: pre,
      onBuy: (s) => {
        const r = startCut(s);
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return false; }
        return true;
      },
      onCancel: (s) => {
        me.pendingSel = s; // valet ligger kvar om man öppnar väljaren igen
        talkSami.say('Okej! Säg till om du ångrar dig – klicka på spegeln. 🙂', () => ({ x: sami.m.x, y: sami.m.y - 44 }), 3.5, { voice: SAMI });
      },
    });
  }
  function openBook() {
    play('click');
    openFrisyrValjare(A, {
      mode: 'bok',
      onGoSit: (s) => {
        const ch = freeChair([1, 2, 0]);
        if (!ch) { toast('Alla stolar är upptagna – vänta en liten stund!', 'bad'); return; }
        walker.walkTo(ch.cx, SEAT_Y + 14, () => sitChair(ch.i, s));
      },
    });
  }

  // ================= ritning =================
  function drawSeatedChair(ctx, look, cx) {
    const fy = SEAT_Y - (look.kid ? 7 : 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 16, 0, 32, SEAT_Y - 7); ctx.clip(); // benen döljs av stolen
    drawPerson(ctx, cx, fy, look, 'up', 5);
    ctx.restore();
  }
  const staffDrawable = (s) => ({
    fy: s.m.y,
    draw(ctx) {
      const carry = !!s.tool && !s.m.walking;
      drawPerson(ctx, s.m.x, s.m.y, s.look, s.m.dir, s.m.walking ? walkFrame(s.m, !!s.tool) : carry ? 9 : walkFrame(s.m));
    },
  });
  // en stol + den som sitter i den (kund, jag) – samma djup
  function chairDrawables(list) {
    for (const ch of chairs) {
      list.push({
        fy: SEAT_Y + 4,
        draw(ctx) {
          let look = null;
          if (ch.occ === 'me') look = me.seq ? seqLook(me.seq) : A.avatar.look;
          else if (ch.occ && ch.occ.state === 'cut') look = capeOf(ch.occ);
          if (look) drawSeatedChair(ctx, look, ch.cx);
          ctx.drawImage(R.chair, ch.cx - 12, SEAT_Y - 19);
        },
      });
    }
  }
  function custDrawable(c) {
    if (c.state === 'cut' || c.state === 'gone') return null; // i stolen ritas med stolen
    if (c.state === 'sofa') return { fy: SOFA.y, draw(ctx) { drawPerson(ctx, c.m.x, c.m.y, c.look, 'down', 5); drawMag(ctx, c.m.x, c.m.y, c.look, c.mag); } };
    if (c.state === 'wash') return { fy: WASH_Y, draw(ctx) { drawPerson(ctx, c.m.x, c.m.y, c.look, 'down', 5); } };
    return { fy: c.m.y, draw(ctx) { drawPerson(ctx, c.m.x, c.m.y, c.look, c.m.dir, walkFrame(c.m)); } };
  }

  function drawWorld(ctx, x0, x1, forPano = false) {
    ctx.drawImage(R.bg, 0, 0);
    // ---- väggen: levande detaljer ----
    drawPole(ctx, t);
    drawClock(ctx, g.min);
    drawPosterBusts(ctx);
    drawNeon(ctx, t);
    for (const ch of chairs) drawMirror(ctx, ch);
    // ---- golvet: hårtussar ----
    for (const ch of chairs) for (const q of ch.tufts) {
      if (q.a <= 0.02) continue;
      ctx.globalAlpha = q.a; ctx.fillStyle = css(q.c); ctx.fillRect(q.x, q.y, q.s, 1); if (q.s > 1) ctx.fillRect(q.x + 1, q.y - 1, 1, 1);
      ctx.globalAlpha = 1;
    }
    // vattenpölen under tvättstolen när Fia sköljer
    if (fia.state === 'washing') { ctx.fillStyle = 'rgba(160,210,240,.35)'; ctx.fillRect(WASH[0] - 6, WASH_Y + 3, 12, 1); }
    // ---- allt som står på golvet, i djupordning ----
    const list = [];
    if (me.state === 'free') list.push(selfDrawable(A, walker, t, { folksHere: A.worldFolksHere?.().length || 0 }));
    else if (me.state === 'sofa') list.push({ fy: SOFA.y, draw: (c2) => { drawPerson(c2, SOFA.seats[me.sofa], SOFA.y, A.avatar.look, 'down', 5); drawMag(c2, SOFA.seats[me.sofa], SOFA.y, A.avatar.look, me.mag); } });
    if (!forPano) list.push(...folkDrawables(A, t));
    chairDrawables(list);
    for (const c of custs) { const d = custDrawable(c); if (d) list.push(d); }
    list.push(staffDrawable(sami), staffDrawable(fia));
    // torkhuvskunden: stolen och huven bakom (bakgrunden), kanten framför
    list.push({ fy: DRYER_Y, draw(ctx2) { drawPerson(ctx2, DRYERS[0], DRYER_Y, dryerCust.look, 'down', 5); drawMag(ctx2, DRYERS[0], DRYER_Y, dryerCust.look, dryerCust.mag); } });
    for (const x of DRYERS) list.push({ fy: DRYER_Y + 0.5, draw(ctx2) { ctx2.drawImage(R.dryerRim, x - 13, 55); drawDryerGlow(ctx2, x, x === DRYERS[0]); } });
    for (const x of WASH) list.push({ fy: WASH_Y + 0.5, draw(ctx2) { ctx2.drawImage(R.washArms, x - 12, 76); } });
    list.push({ fy: SOFA.y + 0.5, draw: (c2) => c2.drawImage(R.sofaArms, SOFA.x0 - 3, 58) });
    list.push({ fy: TABLE.y1, draw: (c2) => c2.drawImage(R.table, TABLE.x0 - 1, TABLE.y0 - 2) });
    list.push({ fy: DESK.y1, draw: (c2) => c2.drawImage(R.desk, DESK.x0, DESK.y0 - 14) });
    list.push({ fy: BOOK.y + 2, draw: (c2) => c2.drawImage(R.lectern, BOOK.x - 13, BOOK.y - 32) });
    for (const [x, y] of PLANTS) list.push({ fy: y, draw: (c2) => c2.drawImage(R.plant, x - 11, y - 33) });
    list.push({ fy: KIDCAR.y, draw: (c2) => { drawBalloons(c2, KIDCAR.x, KIDCAR.y - 24, t); c2.drawImage(R.kidCar, KIDCAR.x - 18, KIDCAR.y - 25); } });
    list.push({ fy: GONDOLA.y, draw: (c2) => c2.drawImage(R.gondola, GONDOLA.x0, GONDOLA.y - 43) });
    list.push({ fy: NAILS.y, draw: (c2) => c2.drawImage(R.nails, NAILS.x - 24, NAILS.y - 35) });
    list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
    // ---- ovanpå: verktyg, tussar i luften, skum, puff, glitter ----
    drawToolOf(ctx, sami);
    drawToolOf(ctx, fia);
    for (const ch of chairs) {
      for (const p of ch.fall) { ctx.fillStyle = css(p.c); ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, 1); }
      for (const f of ch.fx) drawFx(ctx, f);
    }
    if (fia.state === 'washing' && fia.cust?.state === 'wash') drawFoam(ctx, WASH[0], WASH_Y, fia.cust.look, t);
    if (me.seq) drawSeqFx(ctx);
    if (sami.state === 'sweep' || fia.state === 'sweep') { /* kvasten ritas i drawToolOf */ }
    // pratbubblor
    const view = { x0, x1 };
    talkCust.draw(ctx, view); talkFia.draw(ctx, view); talkSami.draw(ctx, view); talkMe.draw(ctx, view);
  }

  // verktyget i frisörens händer (sax, fön, kam, sprej, pensel, spegel, dusch, kvast)
  function drawToolOf(ctx, s) {
    if (!s.tool || s.m.walking) return;
    const L = s.m.dir === 'left', x = s.m.x, y = s.m.y;
    const hx = L ? x - 6 : x + 5, hy = y - 17; // händerna i bildruta 9 (sidovy)
    const d = L ? -1 : 1;
    drawTool(ctx, s.tool, hx, hy, d, t, s === sami ? me.seq : null, s);
  }
  function drawTool(ctx, tool, hx, hy, d, tt, seq, who) {
    const px = [], fx = []; // verktygets pixlar (får en mörk kontur) och partiklar (luft, dimma, vatten) utan kontur
    const P = (x, y, c) => px.push([Math.round(x), Math.round(y), c]);
    const Rr = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c); };
    const F = (x, y, c) => fx.push([Math.round(x), Math.round(y), c]);
    const bob = Math.round(Math.sin(tt * 3.1) * 2); // verktyget rör sig lite kring huvudet
    if (tool === 'sax') {
      const open = Math.floor(tt * 9) % 2 === 0, y = hy - 3 + bob, x = hx;
      // handtagen: två röda ringar vid handen, skänklar och skruven
      for (const oy of [-2, 1]) { P(x - d, y + oy, '#d8323a'); P(x - 2 * d, y + oy, '#e85a60'); P(x - d, y + oy + 1, '#a8202a'); P(x - 2 * d, y + oy + 1, '#a8202a'); }
      P(x, y - 1, '#c8ccd4'); P(x, y + 1, '#c8ccd4'); P(x + d, y, '#5a5e66');
      if (open) for (let i = 2; i <= 5; i++) { P(x + i * d, y - 1 - (i >> 2), i < 4 ? '#f4f6f8' : '#c8ccd4'); P(x + i * d, y + 1 + (i >> 2), i < 4 ? '#dfe3ea' : '#a8acb4'); }
      else { for (let i = 2; i <= 6; i++) P(x + i * d, y, i < 5 ? '#f4f6f8' : '#c8ccd4'); P(x + 3 * d, y - 1, '#ffffff'); }
      if (!open && Math.floor(tt * 9) % 4 === 1) { F(x + 7 * d, y - 2, '#ffffff'); F(x + 8 * d, y - 1, '#fff6b0'); F(x + 7 * d, y + 1, '#fff6b0'); } // snipp!
    } else if (tool === 'kam') {
      const y = hy - 4 + bob, x = hx + d;
      for (let i = 0; i < 7; i++) { P(x + i * d, y, '#f4f1ea'); if (i % 2 === 0) P(x + i * d, y + 1, '#c8c2b6'); }
    } else if (tool === 'sprej') {
      const x = hx, y = hy - 5;
      Rr(x - 1, y + 1, 3, 5, '#3a8ad8'); P(x - 1, y + 1, '#8ac0f0'); P(x - 1, y + 2, '#8ac0f0'); P(x + 1, y + 5, '#2a5ab0');
      P(x, y, '#f4f6f8'); P(x, y - 1, '#f4f6f8'); P(x + d, y - 1, '#f4f6f8'); P(x - d, y + 1, '#f4f6f8'); // pip och avtryckare
      if (Math.floor(tt * 6) % 3 !== 0) for (let k = 0; k < 6; k++) { const ph = (tt * 3 + k / 6) % 1; F(x + d * (2 + ph * 7), y - 1 + Math.sin(k * 2.3) * ph * 3, `rgba(220,240,255,${(0.95 - ph * 0.7).toFixed(2)})`); }
    } else if (tool === 'pensel') {
      const y = hy - 5 + bob, x = hx, c = seq ? seq.to.hair : '#f28bb3';
      Rr(x, y + 1, 1, 4, '#6b4a33'); P(x, y, '#c8ccd4'); P(x + d, y - 1, c); P(x, y - 1, c); P(x + d, y - 2, c); // pensel
      // färgskålen i andra handen
      const bx = x - 4 * d; Rr(Math.min(bx, bx - 3 * d), hy + 1, 4, 2, '#f4f1ea'); P(bx, hy + 1, c); P(bx - d, hy + 1, c); P(bx - 2 * d, hy + 1, c);
      if (Math.floor(tt * 4) % 2) F(x + 2 * d, y + 1, c);
    } else if (tool === 'fon') {
      const x = hx, y = hy - 3;
      Rr(Math.min(x, x - 2 * d), y, 3, 3, '#e06a8a'); P(x - 2 * d, y, '#f7a8c0'); P(x - d, y, '#f7a8c0'); // kroppen (rosa fön)
      Rr(Math.min(x + d, x + 2 * d), y, 2, 2, '#5a5e66'); P(x + 2 * d, y, '#c8ccd4'); // munstycket
      Rr(x - d, y + 3, 1, 3, '#c04a6a'); // handtaget
      for (let k = 0; k < 5; k++) { const ph = (tt * 4 + k / 5) % 1; F(x + d * (4 + ph * 6), y + Math.round(Math.sin(tt * 20 + k) * 1.3), `rgba(236,248,255,${(0.95 - ph * 0.8).toFixed(2)})`); }
    } else if (tool === 'spegel') {
      // handspegeln bakom huvudet (så man ser nacken)
      const x = hx - 2 * d, y = hy - 12;
      Rr(x - 2, y, 5, 6, '#d8b060'); Rr(x - 1, y + 1, 3, 4, '#bfe0ec'); P(x - 1, y + 1, '#ffffff'); Rr(x, y + 6, 1, 3, '#9a7430');
    } else if (tool === 'dusch') {
      const x = hx, y = hy - 1;
      Rr(Math.min(x, x + 2 * d), y, 3, 2, '#c8ccd4'); P(x + 2 * d, y + 1, '#8a9098'); P(x, y, '#f4f6f8');
      Rr(x - d, y + 2, 1, 4, '#5a5e66');
      for (let k = 0; k < 7; k++) { const ph = (tt * 2.6 + k / 7) % 1; F(x + d * (2 + k % 3) - d * ph * 2, y + 2 + ph * 8, `rgba(150,200,240,${(1 - ph).toFixed(2)})`); }
    } else if (tool === 'kvast') {
      // kvasten mot golvet framför frisören, borsten sveper fram och tillbaka
      const sw = Math.round(Math.sin(tt * 7) * 3);
      const fx0 = who.m.x + 2 * d, fy0 = who.m.y - 12, bx = who.m.x + 8 * d + sw, by = who.m.y + 1;
      const n = Math.max(Math.abs(bx - fx0), Math.abs(by - fy0));
      for (let i = 0; i <= n; i++) P(fx0 + (bx - fx0) * i / n, fy0 + (by - fy0) * i / n, '#a87a48');
      Rr(bx - 3, by, 7, 2, '#e0bc5a'); Rr(bx - 3, by + 2, 7, 1, '#9a7a28');
      if (Math.floor(tt * 7) % 2) F(bx + 4 * Math.sign(sw || 1), by + 2, 'rgba(200,190,170,.7)');
    }
    if (px.length) {
      const taken = new Set(px.map(([x, y]) => x + ',' + y));
      ctx.fillStyle = 'rgba(29,24,34,.85)';
      for (const [x, y] of px) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (x + dx) + ',' + (y + dy);
        if (!taken.has(k)) { taken.add(k); ctx.fillRect(x + dx, y + dy, 1, 1); }
      }
      for (const [x, y, c] of px) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
    }
    for (const [x, y, c] of fx) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  }
  function drawFx(ctx, f) {
    const k = f.t / f.dur;
    if (f.kind === 'puff') {
      const r = 3 + k * 9, a = 1 - k;
      ctx.fillStyle = `rgba(250,248,244,${(0.9 * a).toFixed(2)})`;
      for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2 + k; const x = f.x + Math.cos(an) * r, y = f.y + Math.sin(an) * r * 0.8; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2); }
      ctx.fillStyle = `rgba(210,206,220,${(0.8 * a).toFixed(2)})`;
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 - k * 2; ctx.fillRect(Math.round(f.x + Math.cos(an) * r * 0.6), Math.round(f.y + Math.sin(an) * r * 0.5), 2, 1); }
    } else if (f.kind === 'glitter') {
      for (let i = 0; i < 6; i++) {
        const an = i / 6 * Math.PI * 2 + f.t * 1.5, rr = 8 + Math.sin(f.t * 4 + i) * 2;
        const x = Math.round(f.x + Math.cos(an) * rr), y = Math.round(f.y - 2 + Math.sin(an) * rr * 0.8), on = Math.floor(f.t * 8 + i) % 3;
        if (on === 0) continue;
        ctx.fillStyle = on === 1 ? '#fff6b0' : '#ffffff';
        ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
      }
    }
  }
  function drawFoam(ctx, x, fy, look, tt) {
    const hd = headOf(look, x, fy);
    const blobs = [[-4, 0], [-2, -1], [0, -2], [2, -1], [4, 0], [-3, 2], [3, 2], [-1, 0], [1, 0]];
    for (const [dx, dy] of blobs) {
      const bx = Math.round((hd.x0 + hd.x1) / 2 + dx), by = hd.top + 2 + dy;
      ctx.fillStyle = '#f8fbff'; ctx.fillRect(bx - 1, by - 1, 3, 2);
      ctx.fillStyle = '#d8e8f4'; ctx.fillRect(bx - 1, by + 1, 3, 1);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hd.x0 + 2, hd.top, 2, 1);
    for (let k = 0; k < 4; k++) {
      const ph = (tt * 0.6 + k / 4) % 1, bx = Math.round((hd.x0 + hd.x1) / 2 + Math.sin(k * 2.1 + tt) * 6), by = Math.round(hd.top - 2 - ph * 14);
      ctx.fillStyle = `rgba(230,244,255,${(1 - ph).toFixed(2)})`;
      ctx.fillRect(bx, by, 2, 2); ctx.fillStyle = `rgba(255,255,255,${(1 - ph).toFixed(2)})`; ctx.fillRect(bx, by, 1, 1);
    }
  }
  function drawSeqFx(ctx) {
    const s = me.seq, p = phaseOf(s), ch = chairs[me.chair], k = (s.t - p.t0) / (p.t1 - p.t0);
    const hd = headOf(s.from, ch.cx, SEAT_Y - (s.from.kid ? 7 : 0));
    if (p.name === 'kappa' && k < 0.45) {
      // kappan svischar på: ett tygstreck som sveper över axlarna
      const sx = Math.round(ch.cx + 12 - k / 0.45 * 24);
      ctx.fillStyle = '#1c2a4a'; ctx.fillRect(sx - 3, hd.bot + 1, 7, 3);
      ctx.fillStyle = '#d8b060'; ctx.fillRect(sx - 2, hd.bot + 2, 1, 1); ctx.fillRect(sx + 2, hd.bot + 1, 1, 1);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(sx + 5, hd.bot, 3, 1); ctx.fillRect(sx + 6, hd.bot + 3, 2, 1);
    }
    if (p.name === 'farg') {
      const c = s.to.hair;
      ctx.fillStyle = c;
      for (let i = 0; i < 3; i++) { const ph = (s.t * 1.7 + i / 3) % 1; ctx.fillRect(Math.round(hd.x0 + 2 + i * 3), Math.round(hd.top + 1 + ph * 3), 1, 1); }
    }
  }

  // Spegeln: den som sitter i stolen syns framifrån (och frisören bredvid)
  function drawMirror(ctx, ch) {
    const cx = ch.cx, gx0 = cx + GLASS.dx0, gx1 = cx + GLASS.dx1, gy0 = GLASS.y0, gy1 = GLASS.y1;
    ctx.save();
    ctx.beginPath(); ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); ctx.clip();
    let look = null, stylist = null;
    if (ch.occ === 'me') { look = me.seq ? seqLook(me.seq) : A.avatar.look; if (sami.chair === ch.i && (sami.state === 'atChair' || sami.state === 'cut')) stylist = sami; }
    else if (ch.occ && ch.occ.state === 'cut') { look = capeOf(ch.occ); if (fia.cust === ch.occ && fia.state === 'cut') stylist = fia; }
    else if (ch.occ?.state === 'remote') look = A.worldFolksHere?.().find((f) => f.id === ch.occ.id)?.av?.look || null; // en kompis i stolen
    // stolens framsida bakom den som sitter
    const rfy = gy0 + 38; // spegelbildens "fötter" (vuxen)
    ctx.fillStyle = css(LEATHER_LO); ctx.fillRect(cx - 8, rfy - 24, 16, 17);
    ctx.fillStyle = css(LEATHER); ctx.fillRect(cx - 7, rfy - 23, 14, 15);
    ctx.fillStyle = css(LEATHER_HI); ctx.fillRect(cx - 7, rfy - 23, 14, 1);
    ctx.fillStyle = css(LEATHER_DK); for (const [dx, dy] of [[-4, -19], [3, -19], [-4, -13], [3, -13], [0, -16]]) ctx.fillRect(cx + dx, rfy + dy, 1, 1);
    ctx.fillStyle = css(CHROME); ctx.fillRect(cx - 11, rfy - 10, 3, 1); ctx.fillRect(cx + 8, rfy - 10, 3, 1);
    if (stylist) drawPerson(ctx, cx + (stylist.m.dir === 'left' ? 11 : -11), rfy - 6, stylist.look, stylist.m.dir, stylist.tool && !stylist.m.walking ? 9 : 0);
    if (look) drawPerson(ctx, cx, rfy - (look.kid ? 8 : 0), look, 'down', 5);
    if (stylist?.tool && !stylist.m.walking) {
      const L = stylist.m.dir === 'left';
      drawTool(ctx, stylist.tool, L ? cx + 5 : cx - 6, rfy - 6 - 17, L ? -1 : 1, t, stylist === sami ? me.seq : null, stylist);
    }
    for (const f of ch.fx) if (f.kind === 'glitter') drawFx(ctx, { ...f, x: cx, y: gy0 + 12 });
    ctx.restore();
    ctx.drawImage(R.sheen, gx0, gy0);
  }

  // ================= scenobjektet =================
  const scene = {
    viewMax: { w: W, h: H },
    // sittande: platsen (andra spelare ritar mig sittande där, se worldSit i js/net/world.js)
    get worldX() { return me.state === 'chair' || me.state === 'cut' ? STATIONS[me.chair] : me.state === 'sofa' ? SOFA.seats[me.sofa] : walker.px; },
    get worldY() { return me.state === 'chair' || me.state === 'cut' ? SEAT_Y : me.state === 'sofa' ? SOFA.y : walker.py; },
    get worldSit() { return me.state === 'chair' || me.state === 'cut' ? 'up' : me.state === 'sofa' ? 'down' : null; },
    enter() { greetT = 0.9; },
    exit() {
      if (me.seq) finishSeq(true); // betald klippning blir aldrig av med – man går ut med den nya frisyren
      talkMe.clear(); talkSami.clear(); talkFia.clear(); talkCust.clear();
    },
    leaveBlock() { return me.seq ? 'Frisören är mitt i klippningen – sitt still en liten stund! ✂️' : null; },
    _debug: {
      spot: (id) => { const h = spots.find((s) => s.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 } : null; },
      state: () => ({
        me: { state: me.state, chair: me.chair, sofa: me.sofa, x: Math.round(walker.px), y: Math.round(walker.py), path: walker.path.length },
        seq: me.seq ? { t: +me.seq.t.toFixed(2), phase: phaseOf(me.seq).name, total: me.seq.total, price: me.seq.pris.total } : null,
        look: hairOf(A.avatar.look), money: g.money, min: g.min,
        sami: { state: sami.state, x: Math.round(sami.m.x), y: Math.round(sami.m.y), tool: sami.tool },
        fia: { state: fia.state, x: Math.round(fia.m.x), y: Math.round(fia.m.y), tool: fia.tool },
        custs: custs.map((c) => ({ state: c.state, style: c.look.style, x: Math.round(c.m.x), y: Math.round(c.m.y) })),
        chairs: chairs.map((c) => (c.occ === 'me' ? 'me' : c.occ ? 'kund' : null)), tufts: chairs.map((c) => c.tufts.length),
        cam: Math.round(cam.x), modal: modalOpen(),
      }),
      sit: (i = 1) => { walker.px = STATIONS[i]; walker.py = SEAT_Y + 14; walker.stop(); sitChair(i); return me.state; },
      samiNow: () => { if (me.state === 'chair') { const [bx, by] = besideChair(me.chair); sami.m.path = []; sami.m.cb = null; sami.m.x = bx; sami.m.y = by; sami.m.dir = 'left'; sami.state = 'atChair'; sami.chair = me.chair; samiReady(); } },
      buy: (sel, opts) => startCut(sel, opts),
      finish: () => { if (me.seq) finishSeq(); },
      fast: (secs) => { for (let i = 0; i < Math.round(secs / 0.05); i++) scene.update(0.05); return me.seq ? phaseOf(me.seq).name : me.state; },
      seqAt: (secs) => { if (me.seq) { const target = Math.min(me.seq.total - 0.01, secs); while (me.seq && me.seq.t < target) scene.update(Math.min(0.05, target - me.seq.t + 0.001)); } return me.seq ? phaseOf(me.seq).name : null; },
      stand: () => { if (me.state !== 'cut') standUp(); return me.state; },
      sofa: (k) => { walker.px = SOFA.seats[k] ?? 42; walker.py = SOFA.y + 8; sitSofa(k); return me.state; },
      openChooser: () => openChooser(),
      openBook: () => openBook(),
      price: (sel) => frisorPris(A.avatar.look, sel),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : Math.max(0, Math.min(W - VW, x)); cam.x = camTarget(); },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => cam.x,
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, W, true);
        return c.toDataURL('image/png');
      },
    },
    update(dt) {
      t += dt;
      // där en annan spelare sitter är det upptaget (stolarna och soffan)
      try { WORLD.worldSeatsTaken?.(A, chairs); WORLD.worldSeatsTaken?.(A, sofaSeats); } catch { /* världen är aldrig ett krav */ }
      if (greetT > 0) { greetT -= dt; if (greetT <= 0 && sami.state === 'desk') talkSami.say('Välkommen till frisören! Sätt dig i en ledig stol, så fixar vi håret. 💇', () => ({ x: sami.m.x, y: sami.m.y - 44 }), 4.5, { voice: SAMI }); }
      if (me.state === 'free') walker.update(dt);
      updateCusts(dt);
      updateStaff(dt);
      updateSeq(dt);
      updateFx(dt);
      if (me.state === 'sofa') { me.readT += dt; me.mag = Math.floor(me.readT / 4) % 4; }
      // väljaren öppnas en liten stund efter att Sami kommit fram
      if (me.openT > 0) { me.openT -= dt; if (me.openT <= 0 && me.state === 'chair' && !me.seq && !modalOpen()) openChooser(); }
      // klar: sitt kvar en stund med nya frisyren, res dig sedan
      if (me.doneT > 0 && !me.seq) { me.doneT -= dt; if (me.doneT <= 0 && me.state === 'chair') standUp(); }
      // torkhuven plingar ibland
      dryerCust.pling -= dt;
      if (dryerCust.pling <= 0) { dryerCust.pling = 35 + Math.random() * 30; if (inView(DRYERS[0])) sfx('pling'); talkCust.say(pickOf(Math.random, ['Pling! Fem minuter till …', 'Mmm, varmt och skönt här inne.', 'VA? Jag hör ingenting under huven! 😄']), { x: DRYERS[0], y: DRYER_Y - 48 }, 3); }
      dryerCust.mag = Math.floor(t / 6) % 4;
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hoverId = null;
      if (me.state === 'cut') { talkSami.say('Sitt still, annars blir det snett! ✂️😄', () => ({ x: sami.m.x, y: sami.m.y - 44 }), 2.5, { voice: SAMI }); return; }
      const h = spotAt(x, y);
      if (me.state === 'chair') {
        // klick på den egna stolen/spegeln = väljaren igen; annat = res dig
        if (h && h.chair === me.chair) { if (sami.state === 'atChair' && sami.chair === me.chair) openChooser(); return; }
        standUp();
      } else if (me.state === 'sofa') {
        if (h?.id === 'soffa') { talkMe.say(pickOf(Math.random, HEADLINES), () => ({ x: SOFA.seats[me.sofa], y: SOFA.y - 44 }), 4.5); return; }
        standUp();
      }
      if (h) { const [gx, gy] = goOf(h); walker.walkTo(gx, gy, h.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy)?.id || null; hoverT = t; },
    draw(ctx) {
      syncView(A);
      cam.x = Math.max(0, Math.min(W - VW, cam.x));
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      drawWorld(ctx, cx, cx + VW);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const safe = globalThis.SF?.view?.safe || { y0: 0, y1: H };
      if (me.state === 'chair' && !me.seq && !modalOpen() && sami.state === 'atChair') hintBar(ctx, 'KLICKA PÅ SPEGELN = VÄLJ FRISYR / PÅ GOLVET = RES DIG', safe, t);
      else if (me.state === 'sofa') hintBar(ctx, 'KLICKA PÅ GOLVET FÖR ATT RESA DIG', safe, t);
      else {
        const focus = focusSpot();
        if (focus) bigLabel(ctx, focus, t, walker.py > H - 44, safe);
      }
    },
  };
  return scene;
}

// Rubriker i tidningarna i soffan och tidningsstället
const HEADLINES = [
  '📰 PIXELSTADEN: BUSSEN KOM I TID – IGEN!', '📰 KATTEN SOM LÄRDE SIG ÅKA SKATEBOARD', '📰 10 FRISYRER FÖR HÖSTEN', '📰 RECEPT: TÅRTA PÅ FEM MINUTER',
  '📰 KÄNDISEN BYTTE FRISYR – FEM GÅNGER!', '📰 BURGARBAREN: NY MILKSHAKE MED GLITTER', '📰 SÅ FÅR DU LOCKAR SOM HÅLLER HELA DAGEN', '📰 HUNDEN SOM ÄLSKAR ATT BLI FÖNAD',
];

// ================= ritning utan scenstate =================
// Tidning i knät (sittande, bildruta 5): omslag till vänster, text till höger
const MAG_C = ['#d8323a', '#2a5ab0', '#f0b429', '#8e5bd1'];
function drawMag(ctx, x, fy, look, k) {
  const y = fy - (look?.kid ? 9 : 14), x0 = Math.round(x) - 5;
  ctx.fillStyle = '#1d1822'; ctx.fillRect(x0 - 1, y - 1, 12, 7);
  ctx.fillStyle = MAG_C[k % 4]; ctx.fillRect(x0, y, 5, 5);
  ctx.fillStyle = '#fff4d0'; ctx.fillRect(x0 + 1, y + 1, 3, 2);
  ctx.fillStyle = '#f8f6f0'; ctx.fillRect(x0 + 5, y, 5, 5);
  ctx.fillStyle = '#a8a4a0'; ctx.fillRect(x0 + 6, y + 1, 3, 1); ctx.fillRect(x0 + 6, y + 3, 3, 1);
  ctx.fillStyle = '#6a6660'; ctx.fillRect(x0 + 5, y, 1, 5);
}

function drawPole(ctx, t) {
  const x0 = POLE.x, y0 = POLE.y0, h = POLE.y1 - POLE.y0, w = 6;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const ph = (((y + i * 1.3 + t * 14) % 16) + 16) % 16;
    let c = POLE_C[ph < 5 ? 0 : ph < 8 ? 1 : ph < 13 ? 2 : 3];
    if (i === 0) c = mix(c, WHITE, 0.3); else if (i === 1) c = mix(c, WHITE, 0.12); else if (i === 4) c = mul(c, 0.84); else if (i === 5) c = mul(c, 0.66);
    ctx.fillStyle = css(c); ctx.fillRect(x0 + i, y0 + y, 1, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x0 + 1, y0 + 2, 1, h - 4);
}
function drawClock(ctx, min) {
  const [kx, ky] = CLOCK;
  const ha = ((min % 720) / 720) * Math.PI * 2 - Math.PI / 2, ma = ((min % 60) / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.fillStyle = '#1d1822';
  for (let k = 0; k <= 3; k++) ctx.fillRect(Math.round(kx + Math.cos(ha) * k), Math.round(ky + Math.sin(ha) * k), 1, 1);
  ctx.fillStyle = '#c9323a';
  for (let k = 0; k <= 5; k++) ctx.fillRect(Math.round(kx + Math.cos(ma) * k), Math.round(ky + Math.sin(ma) * k), 1, 1);
  ctx.fillStyle = '#d8b060'; ctx.fillRect(kx, ky, 1, 1);
}
// affischen över soffan: tre huvuden med nya frisyrer
const POSTER_LOOKS = [
  { skin: '#eec3a0', hair: '#b7392b', style: 'hollywood', top: 'tee', shirt: '#f28bb3', blush: true, build: 4 },
  { skin: '#744a2d', hair: '#1d1714', style: 'twistOut', top: 'tee', shirt: '#2aa39a', build: 4 },
  { skin: '#e0a97f', hair: '#d9a95c', style: 'swoop', top: 'tee', shirt: '#3a7bd5', build: 5 },
];
function drawPosterBusts(ctx) {
  ctx.save();
  ctx.beginPath(); ctx.rect(17, 13, 50, 22); ctx.clip();
  POSTER_LOOKS.forEach((L, i) => drawPerson(ctx, 26 + i * 16, 13 + 34, L, 'down', 0));
  ctx.restore();
}
function drawNeon(ctx, t) {
  // neonet flimrar ibland till
  const off = Math.sin(t * 13) > 0.97 && Math.sin(t * 0.7) > 0.5;
  if (off) { ctx.fillStyle = 'rgba(16,10,28,.6)'; ctx.fillRect(NEON.x0 + 2, 9, NEON.w - 4, 10); }
}
// ballongerna vid barnstolen guppar i luften
function drawBalloons(ctx, x, y, t) {
  const B = [[-9, -22, '#d8323a', '#f06a70', 0], [6, -26, '#f0b429', '#ffe070', 1.7], [-1, -32, '#3a8ad8', '#8ac0f0', 3.1]];
  for (const [dx, dy, c, hi, ph] of B) {
    const bx = Math.round(x + dx + Math.sin(t * 1.3 + ph) * 1.4), by = Math.round(y + dy + Math.sin(t * 1.9 + ph) * 1.2);
    // snöret
    ctx.fillStyle = '#6a6660';
    const n = Math.max(1, y - (by + 7));
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(bx + (x - 2 - bx) * i / n + Math.sin(i * 0.7 + t * 2) * 0.6), by + 7 + i, 1, 1);
    ctx.fillStyle = '#1d1822'; ctx.fillRect(bx - 3, by, 7, 6); ctx.fillRect(bx - 2, by - 1, 5, 8);
    ctx.fillStyle = c; ctx.fillRect(bx - 2, by, 5, 6); ctx.fillRect(bx - 1, by - 1, 3, 7);
    ctx.fillStyle = hi; ctx.fillRect(bx - 1, by, 1, 2);
    ctx.fillStyle = c; ctx.fillRect(bx, by + 7, 1, 1);
  }
}
function drawDryerGlow(ctx, x, on) {
  if (!on) return;
  const k = 0.35 + Math.sin(performance.now() / 300) * 0.1;
  ctx.fillStyle = `rgba(255,170,80,${k.toFixed(2)})`;
  ctx.fillRect(x - 7, 62, 1, 6); ctx.fillRect(x + 7, 62, 1, 6);
}

// Namnskylt längst ner för det man pekar på / står vid
function bigLabel(ctx, spot, t, atTop, safe) {
  const name = spot.label, hint = spot.hint || '';
  const nw = textW(BIG, name), hw = textW(SMALL, hint);
  const w = Math.max(nw + 20, hw + 20), h = hint ? 22 : 14;
  const x0 = Math.round((VW - w) / 2), y0 = atTop ? Math.max(3, (safe.y0 | 0) + 3) : Math.min(H, safe.y1 | 0) - h - 3;
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = '#d8b060'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = '#1c2a4a'; ctx.fillRect(x0, y0, w, h);
  scissorsIcon(ctx, x0 + 4, y0 + 4);
  ctxText(ctx, BIG, name, x0 + 15, y0 + 3, '#ffffff');
  if (hint) ctxText(ctx, SMALL, hint, x0 + 15, y0 + 14, Math.floor(t * 2) % 2 ? '#f4dc98' : '#c9d4e8');
}
function hintBar(ctx, txt, safe, t) {
  const w = textW(SMALL, txt) + 12, x0 = Math.round((VW - w) / 2), y0 = Math.min(H, safe.y1 | 0) - 14;
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 12);
  ctx.fillStyle = '#1c2a4a'; ctx.fillRect(x0, y0, w, 10);
  ctxText(ctx, SMALL, txt, x0 + 6, y0 + 3, Math.floor(t * 1.5) % 2 ? '#f4dc98' : '#ffffff');
}
function scissorsIcon(ctx, x, y) {
  const P = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, 1, 1); };
  for (const [dx, dy] of [[0, 0], [1, 1], [2, 2], [4, 0], [3, 1]]) P(dx, dy, '#e8ecf0');
  P(2, 3, '#9aa0a8');
  for (const [dx, dy] of [[1, 4], [3, 4], [0, 5], [4, 5], [1, 6], [3, 6]]) P(dx, dy, '#d8323a');
}

// ================= förmålade bilder =================
function paintAll() {
  return {
    bg: paintSalon(), chair: paintChair(), sheen: paintSheen(), sofaArms: paintSofaArms(), table: paintTable(), desk: paintDesk(),
    lectern: paintLectern(), plant: paintPlant(), washArms: paintWashArms(), dryerRim: paintDryerRim(),
    kidCar: paintKidCar(), gondola: paintGondola(), nails: paintNails(),
  };
}

// En rad hårprodukter på ett hyllplan (sy = hyllans ovansida): pumpflaskor, burkar, sprej, flaskor, tuber
const PROD = [0xd8323a, 0x2a5ab0, 0xf0b429, 0x2aa39a, 0x8e5bd1, 0xf28bb3, 0x46a35a, 0xe07a2e, 0xf4f1ea, 0x1d1d22];
function productRow(P, x0, x1, sy, r) {
  let x = x0, k = r * 3;
  while (x < x1) {
    const kind = (k * 7 + r) % 5, c = PROD[(k * 3 + r * 5) % PROD.length];
    const hi = mix(c, WHITE, 0.35), lo = mul(c, 0.7);
    if (kind === 0) { P.rect(x, sy - 9, 4, 9, c); P.vl(x, sy - 9, 9, hi); P.vl(x + 3, sy - 9, 9, lo); P.rect(x + 1, sy - 11, 2, 2, 0x2a2a32); P.px(x + 1, sy - 12, 0x2a2a32); P.hl(x + 1, sy - 6, 2, WHITE); x += 5; }        // pumpflaska
    else if (kind === 1) { P.rect(x, sy - 6, 5, 6, c); P.hl(x, sy - 6, 5, hi); P.rect(x, sy - 7, 5, 1, 0xe8e8ec); P.hl(x + 1, sy - 4, 3, WHITE); x += 6; }            // burk
    else if (kind === 2) { P.rect(x, sy - 10, 3, 10, c); P.vl(x, sy - 10, 10, hi); P.rect(x, sy - 12, 3, 2, 0xc8ccd4); P.px(x + 1, sy - 13, 0x5a5e66); x += 4; }       // sprejburk
    else if (kind === 3) { P.rect(x, sy - 7, 4, 7, c); P.rect(x + 1, sy - 9, 2, 2, lo); P.vl(x, sy - 7, 7, hi); P.hl(x, sy - 4, 4, mix(c, WHITE, 0.6)); x += 5; }     // flaska
    else { P.rect(x, sy - 4, 6, 4, c); P.hl(x, sy - 4, 6, hi); P.rect(x + 1, sy - 3, 4, 1, WHITE); x += 7; }                                                          // tub/låda
    k++;
  }
}

// Barnstolen: en röd leksaksbil framifrån (ballongerna ritas levande)
function paintKidCar() {
  const P = new Pix(36, 26);
  const RED = 0xd8323a, RED_HI = 0xf06a70, RED_LO = 0xa8202a, RED_DK = 0x6a1018;
  // sätets rygg bakom vindrutan
  P.rect(11, 0, 14, 5, RED_LO); P.hl(11, 0, 14, RED); P.vl(13, 1, 3, RED_DK); P.vl(22, 1, 3, RED_DK);
  // vindrutan med ratten
  P.rect(8, 4, 20, 7, 0x1d1822); P.rect(9, 5, 18, 5, 0xbfe0f4); P.px(10, 5, WHITE); P.px(11, 5, WHITE);
  P.hl(15, 6, 6, 0x2a2a32); P.px(14, 7, 0x2a2a32); P.px(21, 7, 0x2a2a32); P.hl(15, 8, 6, 0x2a2a32); P.px(17, 7, 0x2a2a32); P.px(18, 7, 0x2a2a32);
  // kaross
  for (let y = 10; y < 21; y++) for (let x = 2; x < 34; x++) {
    if ((y === 10 || y === 20) && (x < 4 || x > 31)) continue;
    let c = RED;
    if (y === 10) c = RED_HI; else if (y === 11) c = mix(RED, RED_HI, 0.5); else if (y >= 18) c = RED_LO;
    if (x === 2) c = RED_HI; if (x === 33) c = RED_DK;
    if (x >= 16 && x <= 19 && y < 18) c = y === 10 ? WHITE : 0xf4f1ea; // racerrand
    P.px(x, y, c);
  }
  // strålkastare, grill, nummer
  for (const hx of [7, 28]) { P.rect(hx - 2, 13, 4, 3, 0xfff0a0); P.px(hx - 2, 13, WHITE); P.box(hx - 3, 12, 6, 5, RED_DK); }
  P.rect(12, 15, 12, 3, 0x2a2a32); for (let x = 13; x < 23; x += 2) P.vl(x, 15, 3, CHROME_LO);
  // stötfångare och hjul
  P.rect(4, 19, 28, 2, CHROME); P.hl(4, 19, 28, CHROME_HI);
  for (const wx of [2, 27]) { P.rect(wx, 20, 7, 5, 0x1d1822); P.rect(wx + 2, 21, 3, 2, 0x8a8e9a); P.px(wx + 3, 21, CHROME_HI); }
  P.darken(3, 25, 30, 1, 0.7);
  return outlined(P, 36, 26, (x, y) => y < 25);
}

// Hyllgondolen HÅRVÅRD framför kassan: skylt, pegboard, två hyllplan, sockel
function paintGondola() {
  const w = GONDOLA.x1 - GONDOLA.x0, h = 44, P = new Pix(w, h);
  P.rect(2, 9, w - 4, 29, 0xf0e8dc);
  for (let y = 11; y < 37; y += 3) for (let x = 4; x < w - 3; x += 3) P.px(x, y, 0xd8ccb8);
  for (const [sy, r] of [[22, 1], [36, 3]]) {
    productRow(P, 3, w - 7, sy, r);
    P.rect(1, sy, w - 2, 2, 0x8a6446); P.hl(1, sy, w - 2, 0xb08a60);
  }
  P.rect(0, 0, w, 9, NAVY); P.hl(0, 0, w, NAVY_HI); P.hl(0, 8, w, GOLD);
  { const s = 'HÅRVÅRD'; text(P, SMALL, s, Math.round(w / 2 - textW(SMALL, s) / 2), 3, GOLD_HI); }
  P.rect(3, 2, 4, 4, 0xf28bb3); P.rect(w - 7, 2, 4, 4, 0x3fc4ff);
  P.rect(0, 38, w, 6, NAVY); P.hl(0, 38, w, NAVY_HI); P.hl(0, h - 1, w, NAVY_DK);
  P.vl(0, 9, 29, CHROME_LO); P.vl(w - 1, 9, 29, CHROME_LO);
  // NYTT-lapp
  P.rect(w - 22, 25, 17, 7, 0xd8323a); P.hl(w - 22, 25, 17, 0xf06a70); { const s = 'NYTT'; text(P, SMALL, s, w - 20, 26, WHITE); }
  return outlined(P, w, h);
}

// Nagelbaren: bord med lampa, nagellack, handkudde och en pall framför
function paintNails() {
  const P = new Pix(48, 36);
  // nagellacken på en liten trappställning längst bak
  P.rect(14, 5, 22, 8, 0xf4f1ea); P.hl(14, 8, 22, 0xd8d0c4); P.hl(14, 12, 22, 0xd8d0c4);
  const NL = [0xd8323a, 0xf28bb3, 0x8e5bd1, 0x3fc4ff, 0xf0b429, 0x46a35a, 0x1d1d22, 0xff5d8f, 0xe07a2e, 0x2a5ab0];
  for (let i = 0; i < 10; i++) { const x = 15 + i * 2, row = i % 2, y = row ? 9 : 5; P.px(x, y, 0x1d1822); P.rect(x, y + 1, 1, 2, NL[i]); }
  for (let i = 0; i < 10; i++) { const x = 16 + i * 2; if (x < 35) { P.px(x, 9 + 1, NL[(i + 3) % 10]); } }
  // lampan (svanhals) till vänster
  P.rect(5, 12, 5, 2, 0x2a2a32); P.vl(7, 3, 9, 0x2a2a32); P.hl(7, 3, 5, 0x2a2a32); P.rect(10, 3, 5, 3, 0x2a2a32); P.hl(10, 6, 5, 0xfff6c8);
  P.ell(12.5, 12, 8, 4, 0xfff6c8, 0.35, 3);
  // bordsskivan och kjolen
  P.rect(2, 13, 44, 4, WHITE); P.hl(2, 13, 44, WHITE); P.hl(2, 16, 44, 0xd8d8e0);
  P.rect(18, 13, 12, 3, 0xf7dbe2); P.hl(18, 13, 12, 0xffeef2); // handkudden
  P.rect(3, 17, 42, 8, ROSE); P.hl(3, 17, 42, ROSE_HI); P.hl(3, 24, 42, ROSE_DK);
  { const s = 'NAGLAR'; text(P, SMALL, s, Math.round(24 - textW(SMALL, s) / 2), 19, WHITE); }
  for (const lx of [4, 42]) { P.rect(lx, 25, 2, 6, CHROME); P.vl(lx, 25, 6, CHROME_HI); }
  // pallen framför
  P.rect(19, 27, 10, 3, 0xf28bb3); P.hl(19, 27, 10, 0xffb8d8); P.hl(19, 29, 10, ROSE_DK);
  P.rect(23, 30, 2, 4, CHROME); P.hl(20, 34, 8, CHROME_LO);
  P.darken(2, 35, 44, 1, 0.7);
  return outlined(P, 48, 36, (x, y) => y > 12 && y < 26);
}

function disc(P, cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, c, a);
  }
}
function glowText(P, F, s, x, y, c, glow, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, F, s, x + dx, y + dy, glow, 0.45, scale);
  for (const [dx, dy] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) text(P, F, s, x + dx, y + dy, glow, 0.2, scale);
  text(P, F, s, x, y, c, 1, scale);
}

function paintSalon() {
  const P = new Pix(W, H);
  // ===== väggen: mintgrön tapet med ränder och små romber =====
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    const band = ((x + 3) % 12) < 6;
    let c = band ? 0xd3eadf : 0xc5e1d3;
    const mx = (x + 3) % 12, my = (y + (((x + 3) / 12) | 0) * 5) % 10;
    if (band && Math.abs(mx - 2.5) + Math.abs(my - 4.5) < 1.6) c = 0xe6f4ec;
    if (!band && mx === 6) c = 0xbcdacb;
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.035 + (hash(x >> 3, y >> 3, 5) - 0.5) * 0.02);
    P.px(x, y, c);
  }
  // taket + taklist
  P.rect(0, 0, W, 3, 0x2e3446); P.hl(0, 2, W, 0x44506a);
  P.hl(0, 3, W, CREAM); P.hl(0, 4, W, 0xe2ddd2); P.hl(0, 5, W, 0xf8f6f0); P.hl(0, 6, W, 0xb8cabf);
  for (let x = 2; x < W; x += 6) P.px(x, 4, 0xc8c2b6);
  // boasering: marinblå med guldlist
  const WY = WALL_Y - 16;
  for (let y = WY; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c = NAVY;
    if (y === WY) c = GOLD; else if (y === WY + 1) c = GOLD_LO; else if (y === WY + 2) c = NAVY_HI;
    else if (y >= WALL_Y - 3) c = y === WALL_Y - 3 ? NAVY_HI : NAVY_DK;
    else {
      const px = x % 40, py = y - (WY + 4);
      if (py >= 0 && py < 8 && px >= 4 && px < 36) {
        if (py === 0 || px === 4) c = NAVY_DK; else if (py === 7 || px === 35) c = NAVY_HI; else c = NAVY2;
      }
    }
    P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.04));
  }
  paintFloor(P); // golvet först – möblerna står ovanpå
  // taklampor: mässingskupor som lyser på väggen
  for (const lx of LAMPS) {
    P.ell(lx + 0.5, 26, 22, 30, 0xfff4d8, 0.2, 5);
    P.vl(lx, 3, 7, 0x2a2430);
    P.rect(lx - 4, 10, 9, 2, GOLD); P.rect(lx - 3, 9, 7, 1, GOLD_HI); P.rect(lx - 5, 12, 11, 2, GOLD_LO); P.hl(lx - 4, 12, 9, GOLD);
    P.hl(lx - 2, 14, 5, 0xfff6c8); P.px(lx, 15, 0xffffff);
  }

  // ===== väntsoffan (rosa sammet) + affischen + tidningsställ =====
  // affisch "NYA FRISYRER" (huvudena ritas levande)
  P.rect(14, 10, 56, 36, 0x1d1822); P.rect(16, 12, 52, 32, 0xf7dbe2);
  for (let y = 12; y < 36; y++) for (let x = 16; x < 68; x++) if ((x + y) % 6 === 0) P.px(x, y, 0xffffff, 0.6);
  P.rect(16, 36, 52, 8, 0xd8323a); P.hl(16, 36, 52, 0xf06a70);
  { const s = 'NYA FRISYRER!'; text(P, SMALL, s, Math.round(42 - textW(SMALL, s) / 2), 38, 0xffffff); }
  P.box(14, 10, 56, 36, GOLD_LO);
  // soffan
  const sx0 = SOFA.x0, sx1 = SOFA.x1;
  for (let y = 50; y < 72; y++) for (let x = sx0; x < sx1; x++) { // ryggkuddarna (tre, knappade)
    const lx = (x - sx0) % 20;
    let c = ROSE;
    if (y === 50 || (y === 51 && (lx < 1 || lx > 18))) c = ROSE_HI;
    else if (lx === 0) c = ROSE_LO; else if (lx === 19) c = ROSE_DK;
    else if (y > 68) c = ROSE_LO;
    if ((lx === 6 || lx === 13) && (y === 56 || y === 63)) c = ROSE_DK;
    if ((lx === 9 || lx === 10) && y === 59) c = ROSE_DK;
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.05);
    P.px(x, y, c);
  }
  for (let y = 72; y < 80; y++) for (let x = sx0; x < sx1; x++) { // sittdynorna
    const lx = (x - sx0) % 20;
    let c = y === 72 ? ROSE_HI : y === 73 ? mix(ROSE, ROSE_HI, 0.5) : y >= 78 ? ROSE_LO : ROSE;
    if (lx === 0 || lx === 19) c = ROSE_LO;
    P.px(x, y, c);
  }
  P.rect(sx0, 80, sx1 - sx0, 5, ROSE_LO); P.hl(sx0, 80, sx1 - sx0, ROSE); P.hl(sx0, 84, sx1 - sx0, ROSE_DK);
  for (const lx of [sx0 + 3, sx1 - 5]) { P.rect(lx, 85, 2, 3, GOLD); P.px(lx, 85, GOLD_HI); }
  P.darken(sx0 - 2, 86, sx1 - sx0 + 4, 3, 0.8);
  // tidningsställ (trådställ med tidningar)
  P.rect(RACK.x0, 58, 12, 30, 0x3a3440); P.rect(RACK.x0 + 1, 59, 10, 28, 0x5a5460);
  [[0xd8323a, 60], [0x2a5ab0, 67], [0xf0b429, 74], [0x2aa39a, 81]].forEach(([c, y], i) => {
    P.rect(RACK.x0 + 1, y, 10, 6, c); P.rect(RACK.x0 + 2, y + 1, 5, 2, 0xfff4d0); P.hl(RACK.x0 + 2, y + 4, 7, mix(c, WHITE, 0.4));
    P.hl(RACK.x0, y + 6, 12, 0xa8a0aa); if (i === 1) P.rect(RACK.x0 + 7, y + 1, 3, 3, 0xffffff);
  });
  P.darken(RACK.x0 - 1, 88, 14, 2, 0.75);

  // ===== dörren + neon + stolpens fästen =====
  P.rect(DOOR.x0 - 3, DOOR.top - 3, DOOR.x1 - DOOR.x0 + 6, WALL_Y - DOOR.top + 3, NAVY);
  P.hl(DOOR.x0 - 3, DOOR.top - 3, DOOR.x1 - DOOR.x0 + 6, NAVY_HI); P.hl(DOOR.x0 - 3, DOOR.top - 2, DOOR.x1 - DOOR.x0 + 6, GOLD);
  for (let i = 0; i < 2; i++) {
    const gx = DOOR.x0 + i * 16, gw = 15;
    for (let y = DOOR.top; y < WALL_Y - 1; y++) for (let x = gx; x < gx + gw; x++) {
      // gatan utanför: himmel, huset mittemot, trottoaren
      let c;
      if (y < DOOR.top + 10) c = mix(0xbfe0f4, 0x8ec4ea, (y - DOOR.top) / 10);
      else if (y < DOOR.top + 30) { c = 0xc8a888; if ((x % 7 === 2 || x % 7 === 3) && (y - DOOR.top) % 8 > 2 && (y - DOOR.top) % 8 < 6) c = 0x5a7a9a; }
      else if (y < DOOR.top + 34) c = 0x8a8680;
      else c = 0xa8a49c;
      c = mix(c, 0xe8f4fa, 0.28);
      if ((x - y + 400) % 19 < 2) c = mix(c, WHITE, 0.4);
      P.px(x, y, c);
    }
    P.vl(gx - 1, DOOR.top, WALL_Y - DOOR.top - 1, NAVY2); P.vl(gx + gw, DOOR.top, WALL_Y - DOOR.top - 1, NAVY2);
    P.rect(gx + 2, 47, gw - 4, 2, GOLD); P.hl(gx + 2, 47, gw - 4, GOLD_HI); // skjuthandtag
  }
  // ÖPPET-skylten hänger i snören mitt på glaset
  P.vl(DOOR_CX - 8, DOOR.top, 5, 0x8a8e9a); P.vl(DOOR_CX + 8, DOOR.top, 5, 0x8a8e9a);
  P.rect(DOOR_CX - 11, DOOR.top + 5, 23, 9, 0xffffff); P.box(DOOR_CX - 11, DOOR.top + 5, 23, 9, 0xd8323a);
  { const s = 'ÖPPET'; text(P, SMALL, s, Math.round(DOOR_CX + 0.5 - textW(SMALL, s) / 2), DOOR.top + 8, 0xd8323a); }
  // dörrmatta
  P.rect(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 9, 0x2a2e3a); P.box(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 9, NAVY_HI);
  for (let x = DOOR.x0 - 2; x < DOOR.x1 + 2; x += 2) P.vl(x, WALL_Y + 2, 5, 0x22242e);
  { const s = 'HEJ!'; text(P, SMALL, s, DOOR_CX - textW(SMALL, s) / 2, WALL_Y + 2, GOLD); }
  // neonskylten FRISÖR ovanför dörren (+ en liten sax)
  { const s = 'FRISÖR', w = textW(BIG, s);
    P.vl(NEON.x0 + 4, 3, 4, 0x8a8e9a); P.vl(NEON.x0 + NEON.w - 5, 3, 4, 0x8a8e9a);
    P.rect(NEON.x0, 7, NEON.w, 13, NAVY_DK); P.box(NEON.x0, 7, NEON.w, 13, GOLD_LO); P.hl(NEON.x0 + 1, 8, NEON.w - 2, NAVY2);
    P.ell(DOOR_CX, 13, NEON.w * 0.7, 9, 0xff7ab8, 0.2, 4);
    glowText(P, BIG, s, Math.round(DOOR_CX - w / 2), 10, 0xffe6f2, 0xff4aa0); }
  // barberarstolpens fäste, huvar och kula (glasröret ritas levande)
  { const x = POLE.x, y0 = POLE.y0, y1 = POLE.y1;
    P.rect(x + 7, 24, 4, 3, CHROME_LO); P.rect(x + 7, 50, 4, 3, CHROME_LO); P.hl(x + 7, 24, 4, CHROME);
    P.rect(x - 1, y0 - 4, 8, 4, CHROME); P.hl(x - 1, y0 - 4, 8, CHROME_HI); P.hl(x - 1, y0 - 1, 8, CHROME_DK);
    P.rect(x + 1, y0 - 7, 4, 3, GOLD); P.px(x + 1, y0 - 7, GOLD_HI); P.px(x + 2, y0 - 8, GOLD_HI); P.px(x + 3, y0 - 8, GOLD);
    P.rect(x - 1, y1, 8, 4, CHROME); P.hl(x - 1, y1, 8, CHROME_HI); P.hl(x - 1, y1 + 3, 8, CHROME_DK); P.rect(x + 2, y1 + 4, 2, 2, CHROME_LO);
    P.vl(x - 1, y0, y1 - y0, 0x9aa0a8); P.vl(x + 6, y0, y1 - y0, 0x6a6e76); }

  // ===== prislistan =====
  { const { x0, x1, y0, y1 } = BOARD, w = x1 - x0, h = y1 - y0;
    P.rect(x0, y0, w, h, GOLD_LO); P.rect(x0 + 1, y0 + 1, w - 2, h - 2, GOLD); P.rect(x0 + 2, y0 + 2, w - 4, h - 4, NAVY_DK);
    P.hl(x0 + 1, y0 + 1, w - 2, GOLD_HI);
    for (let y = y0 + 2; y < y1 - 2; y++) for (let x = x0 + 2; x < x1 - 2; x++) if (hash(x, y, 91) > 0.93) P.px(x, y, 0x1a2640);
    const title = 'PRISLISTA'; text(P, BIG, title, Math.round(x0 + w / 2 - textW(BIG, title) / 2), y0 + 4, GOLD_HI);
    P.hl(x0 + 6, y0 + 13, w - 12, GOLD_LO);
    const rows = ['klippning', 'rakning', 'uppsatt', 'lockar', 'flator', 'fargning'];
    rows.forEach((k, i) => {
      const y = y0 + 16 + i * 7, lab = FRISOR_PRIS[k].board, pr = `${FRISOR_PRIS[k].price}:-`;
      text(P, SMALL, lab, x0 + 4, y, k === 'fargning' ? 0xffa8d0 : 0xf4f1ea);
      const pw = textW(SMALL, pr), lw = textW(SMALL, lab);
      text(P, SMALL, pr, x1 - 4 - pw, y, GOLD_HI);
      for (let x = x0 + 6 + lw; x < x1 - 6 - pw; x += 2) P.px(x, y + 4, 0x5a6a8a);
    });
    P.vl(x0 + w / 2, y0 - 6, 6, 0x8a8e9a); P.px(x0 + w / 2, y0 - 7, GOLD);
  }

  // ===== produkthyllan =====
  { const { x0, x1, y0 } = SHELF, w = x1 - x0;
    P.rect(x0, y0, w, 68, 0x6b4a33); P.rect(x0 + 2, y0 + 8, w - 4, 58, 0xf0e8dc);
    for (let y = y0 + 8; y < y0 + 66; y++) for (let x = x0 + 2; x < x1 - 2; x++) if ((x + y) % 5 === 0) P.px(x, y, 0xe4d8c8);
    P.rect(x0, y0, w, 8, NAVY); P.hl(x0, y0, w, NAVY_HI); P.hl(x0, y0 + 7, w, GOLD);
    { const s = 'PRODUKTER'; text(P, SMALL, s, Math.round(x0 + w / 2 - textW(SMALL, s) / 2), y0 + 2, GOLD_HI); }
    for (let r = 0; r < 4; r++) {
      const sy = y0 + 22 + r * 14; // hyllplanets ovansida
      P.rect(x0 + 1, sy, w - 2, 2, 0x8a6446); P.hl(x0 + 1, sy, w - 2, 0xb08a60); P.hl(x0 + 2, sy + 2, w - 4, 0xc8bcac);
      productRow(P, x0 + 3, x1 - 5, sy, r);
    }
    P.rect(x0, y0 + 64, w, 4, 0x4a3222); P.hl(x0, y0 + 64, w, 0x8a6446);
    P.vl(x0, y0 + 8, 58, 0x4a3222); P.vl(x1 - 1, y0 + 8, 58, 0x4a3222);
    P.darken(x0 - 1, y0 + 68, w + 2, 2, 0.75);
  }

  // ===== stationerna: speglar med glödlampor, disklist med verktyg =====
  for (const cx of STATIONS) {
    const fx0 = cx - 16, fx1 = cx + 16, fy0 = 8, fy1 = 52;
    P.ell(cx, 30, 26, 28, 0xfff4d8, 0.16, 5);
    P.rect(fx0, fy0, fx1 - fx0, fy1 - fy0, GOLD_LO); P.rect(fx0 + 1, fy0 + 1, fx1 - fx0 - 2, fy1 - fy0 - 2, GOLD);
    P.hl(fx0 + 1, fy0 + 1, fx1 - fx0 - 2, GOLD_HI); P.vl(fx0 + 1, fy0 + 1, fy1 - fy0 - 2, GOLD_HI);
    // glaset: den motsatta väggen (skyltfönster) och golvet långt bort
    const gx0 = cx + GLASS.dx0, gx1 = cx + GLASS.dx1, gy0 = GLASS.y0, gy1 = GLASS.y1;
    for (let y = gy0; y < gy1; y++) for (let x = gx0; x < gx1; x++) {
      let c;
      if (y < gy0 + 22) {
        c = mix(0xdcecec, 0xc2d8d4, (y - gy0) / 22);
        if ((x - gx0) % 9 === 0 || y === gy0 + 3) c = 0x7c8ea0;                      // fönsterspröjsar
      } else if (y < gy0 + 26) c = y === gy0 + 22 ? 0x46566e : 0x2e3a52;           // boaseringen mittemot
      else c = ((((x - gx0) >> 2) + ((y - gy0) >> 1)) % 2) ? 0xd0ccc4 : 0x5a5a64;   // rutgolvet
      P.px(x, y, mix(c, 0x9ec8c0, 0.22));
    }
    P.box(gx0 - 1, gy0 - 1, gx1 - gx0 + 2, gy1 - gy0 + 2, GOLD_LO);
    // glödlamporna runt ramen
    const bulb = (x, y) => { P.px(x, y, 0xfffbe8); P.px(x + 1, y, 0xfff0c0); P.px(x, y + 1, 0xfff0c0); P.px(x + 1, y + 1, 0xe8c070); };
    for (let x = fx0 + 3; x < fx1 - 3; x += 6) bulb(x, fy0 + 1 - 1 + 0);
    for (let y = fy0 + 6; y < fy1 - 2; y += 7) { bulb(fx0 - 1 + 1, y); bulb(fx1 - 2, y); }
    // disklisten under spegeln: marmor + marinblå front
    P.rect(cx - 20, 52, 40, 3, 0xf4f1ec); P.hl(cx - 20, 52, 40, WHITE);
    for (let x = cx - 20; x < cx + 20; x++) if (hash(x, 53, 3) > 0.8) P.px(x, 53, 0xc8c4cc);
    P.rect(cx - 20, 55, 40, 6, NAVY); P.hl(cx - 20, 55, 40, GOLD); P.hl(cx - 20, 60, 40, NAVY_DK);
    P.rect(cx - 17, 61, 2, 5, NAVY_DK); P.rect(cx + 15, 61, 2, 5, NAVY_DK); // konsoler
    // verktyg på listan: sprejflaska, kam, borste, kopp med penslar, liten kaktus
    P.rect(cx - 17, 45, 3, 7, 0x3a8ad8); P.vl(cx - 17, 45, 7, 0x8ac0f0); P.rect(cx - 16, 43, 1, 2, 0xe8ecf0); P.px(cx - 15, 43, 0xe8ecf0);
    P.hl(cx - 12, 51, 6, INK); for (let i = 0; i < 6; i += 2) P.px(cx - 12 + i, 50, 0x3a3440);
    P.rect(cx + 6, 47, 4, 5, 0xf4f1ea); P.hl(cx + 6, 47, 4, 0xd8d0c4); P.vl(cx + 7, 43, 4, 0x6b4a33); P.vl(cx + 9, 44, 3, 0xd8323a); P.px(cx + 8, 42, 0x2a2a32);
    P.rect(cx + 12, 48, 4, 4, 0xe07a2e); P.hl(cx + 12, 48, 4, 0xf0a060); P.rect(cx + 13, 45, 2, 3, 0x46a35a); P.px(cx + 12, 46, 0x46a35a);
    // fönen hänger på en krok på sidan
    P.rect(cx + 20, 40, 3, 3, 0x2a2a32); P.px(cx + 20, 40, 0x5a5a66); P.vl(cx + 21, 43, 5, 0x2a2a32); P.px(cx + 20, 39, CHROME);
  }
  // verktygsvagnarna mellan stolarna
  for (const vx of TROLLEYS) {
    const x0 = vx - 7;
    P.rect(x0, 70, 14, 14, 0x2a2a32); P.hl(x0, 70, 14, 0x4a4a56);
    for (let k = 0; k < 3; k++) { P.hl(x0 + 1, 73 + k * 4, 12, 0x1a1a20); P.rect(x0 + 5, 71 + k * 4, 4, 1, CHROME); }
    P.rect(x0 - 1, 66, 16, 4, 0x3a3a44); P.hl(x0 - 1, 66, 16, 0x5a5a66);
    // på vagnen: fön, borste, klämmor
    P.rect(x0 + 1, 63, 5, 3, 0x2a2a32); P.px(x0 + 1, 63, 0x5a5a66); P.rect(x0 + 6, 63, 2, 2, INK);
    P.rect(x0 + 9, 62, 2, 4, 0x6b4a33); P.rect(x0 + 8, 60, 4, 2, 0x3a3440);
    P.px(x0 + 12, 65, 0xf28bb3); P.px(x0 + 13, 65, 0x3fc4ff);
    for (const wx of [x0 + 1, x0 + 11]) { P.rect(wx, 84, 2, 2, INK); P.px(wx, 84, 0x5a5a66); }
    P.darken(x0 - 1, 86, 16, 2, 0.75);
  }

  // ===== tvätthoarna: kaklad vägg, handdukshylla, vita hoar på skåp, tvättstolar =====
  { const x0 = WASH[0] - 20, x1 = WASH[1] + 20;
    // vitt kakel bakom hoarna (ovanför boaseringen)
    for (let y = 36; y < 54; y++) for (let x = x0; x < x1; x++) {
      const row = (y - 36) >> 2, off = row % 2 ? 4 : 0, lx = (x - x0 + off) % 8, ly = (y - 36) % 4;
      let c = 0xf4f6f4;
      if (ly === 3 || lx === 7) c = 0xc8d4d0; else if (ly === 0) c = WHITE;
      c = mix(c, 0x9ec8c0, hash((x - x0 + off) >> 3, row, 7) * 0.08);
      P.px(x, y, c);
    }
    P.hl(x0, 36, x1 - x0, 0xb8c8c4); P.vl(x0, 36, 18, 0xb8c8c4); P.vl(x1 - 1, 36, 18, 0xb8c8c4);
    // handdukshyllan med rullade handdukar
    P.rect(x0, 30, x1 - x0, 3, 0x8a6446); P.hl(x0, 30, x1 - x0, 0xb08a60); P.hl(x0, 33, x1 - x0, 0x9ab8ac);
    for (const bx of [x0 + 4, x1 - 6]) P.rect(bx, 33, 2, 3, 0x6b4a33);
    const TW = [0xf4f1ea, NAVY_HI, 0xf4f1ea, 0xd98a9a, 0xf4f1ea, NAVY_HI, 0xd98a9a, 0xf4f1ea, 0xf4f1ea, NAVY_HI];
    let i = 0;
    for (let x = x0 + 3; x < x1 - 8; x += 8) {
      for (const row of [0, 1]) {
        if (row === 1 && i % 3 === 1) continue;
        const c = TW[(i + row * 3) % TW.length], cy = 26 - row * 7;
        disc(P, x + 3.5, cy, 3.6, 3.2, mul(c, 0.72)); disc(P, x + 3.5, cy, 2.7, 2.4, c);
        P.px(x + 3, cy - 1, mul(c, 0.8)); P.px(x + 4, cy, mul(c, 0.85)); P.px(x + 2, cy - 2, mix(c, WHITE, 0.5));
      }
      i++;
    }
  }
  for (const bx of WASH) {
    // skåpet under hon (marinblått med guldlist)
    P.rect(bx - 12, 60, 25, 14, NAVY); P.hl(bx - 12, 60, 25, GOLD); P.hl(bx - 12, 61, 25, GOLD_LO); P.hl(bx - 12, 73, 25, NAVY_DK);
    P.box(bx - 10, 63, 9, 8, NAVY_DK); P.box(bx + 2, 63, 9, 8, NAVY_DK); P.px(bx - 3, 67, GOLD); P.px(bx + 3, 67, GOLD);
    // kranen (svanhals) och handduschen på kaklet
    P.rect(bx - 1, 44, 3, 8, CHROME); P.vl(bx - 1, 44, 8, CHROME_HI); P.vl(bx + 1, 44, 8, CHROME_LO);
    P.rect(bx - 1, 42, 6, 2, CHROME); P.hl(bx - 1, 42, 6, CHROME_HI); P.rect(bx + 4, 44, 1, 2, CHROME_DK);
    P.rect(bx - 6, 47, 3, 2, 0xd8323a); P.rect(bx + 7, 47, 3, 2, 0x2a5ab0); // varmt/kallt
    P.rect(bx + 9, 40, 2, 5, 0x2a2a32); P.px(bx + 9, 40, 0x5a5a66); P.vl(bx + 10, 45, 5, 0x3a3a44); // handduschen i sin hållare
    // den vita hon: kant (ellips uppifrån), vatten, framsida med nackurgröpning
    for (let y = 50; y < 62; y++) for (let x = bx - 12; x <= bx + 12; x++) {
      const eo = ((x + 0.5 - bx) / 12) ** 2 + ((y + 0.5 - 54) / 4) ** 2;
      const ei = ((x + 0.5 - bx) / 9.5) ** 2 + ((y + 0.5 - 54) / 2.6) ** 2;
      if (y <= 54 && eo > 1) continue;
      if (y > 54) { // framsidan: skålen smalnar av neråt
        const hw = 12 - (y - 54) * 0.9;
        if (Math.abs(x + 0.5 - bx) > hw) continue;
        let c = x < bx - 4 ? WHITE : x > bx + 5 ? 0xc8ccd4 : 0xeef0f2;
        if (y === 61) c = 0xa8acb4;
        if (y <= 56 && Math.abs(x - bx) <= 2) c = 0x4a4a54; // nackurgröpningen
        P.px(x, y, c);
        continue;
      }
      P.px(x, y, ei < 1 ? (ei < 0.35 ? 0xb8d8e8 : 0x8ab4cc) : y < 53 ? WHITE : 0xdfe3ea);
    }
    P.px(bx - 5, 53, WHITE); P.px(bx - 4, 53, 0xe8f4fa);
    // tvättstolen: framsidan av den lutade ryggen, sits, benstöd
    for (let y = 62; y < 82; y++) for (let x = bx - 8; x <= bx + 8; x++) {
      let c = LEATHER; if (x === bx - 8) c = LEATHER_HI; if (x === bx + 8) c = LEATHER_LO; if (y === 62) c = LEATHER_HI;
      if ((x === bx - 4 || x === bx + 4) && y % 5 === 1) c = LEATHER_DK;
      if (x === bx && y % 5 === 3) c = LEATHER_DK;
      P.px(x, y, c);
    }
    P.rect(bx - 9, 80, 19, 6, LEATHER); P.hl(bx - 9, 80, 19, LEATHER_HI); P.hl(bx - 9, 85, 19, LEATHER_DK);
    P.rect(bx - 7, 86, 15, 5, LEATHER_LO); P.hl(bx - 7, 86, 15, LEATHER); P.hl(bx - 7, 90, 15, LEATHER_DK);
    P.rect(bx - 1, 91, 3, 3, CHROME_LO); P.vl(bx - 1, 91, 3, CHROME);
    P.rect(bx - 8, 94, 17, 2, CHROME); P.hl(bx - 8, 94, 17, CHROME_HI); P.hl(bx - 8, 95, 17, CHROME_DK);
    P.darken(bx - 10, 96, 21, 2, 0.72);
  }

  // ===== torkhuvarna =====
  for (const dx of DRYERS) {
    // stolen (rygg + sits)
    for (let y = 72; y < 84; y++) for (let x = dx - 9; x <= dx + 9; x++) { let c = ROSE; if (x === dx - 9) c = ROSE_HI; if (x === dx + 9) c = ROSE_LO; if (y === 72) c = ROSE_HI; P.px(x, y, c); }
    P.rect(dx - 10, 82, 21, 5, ROSE_LO); P.hl(dx - 10, 82, 21, ROSE); P.hl(dx - 10, 86, 21, ROSE_DK);
    for (const lx of [dx - 8, dx + 7]) { P.rect(lx, 87, 2, 6, GOLD); P.px(lx, 87, GOLD_HI); }
    P.darken(dx - 11, 93, 23, 3, 0.72);
    // stativet bakom stolen (stång + arm till huven)
    P.rect(dx + 11, 52, 2, 42, CHROME_LO); P.vl(dx + 11, 52, 42, CHROME);
    P.rect(dx + 8, 92, 8, 2, CHROME_DK); P.hl(dx + 8, 92, 8, CHROME);
    // huven (baksidan) – krämvit med kromband, sänkt över huvudet
    for (let y = 53; y < 80; y++) for (let x = dx - 12; x <= dx + 12; x++) {
      const e = ((x + 0.5 - dx) / 12) ** 2 + ((y + 0.5 - 66) / 13) ** 2;
      if (e > 1) continue;
      let c = e > 0.8 ? 0xd8cfbe : 0xf0e8d8;
      if (x < dx - 5 && e < 0.78) c = 0xfaf4e8;
      if (x > dx + 6) c = mul(c, 0.9);
      if (y === 58 || y === 59) c = y === 58 ? CHROME_HI : CHROME;
      P.px(x, y, c);
    }
    // öppningen där huvudet sitter (mörk insida med varm glöd)
    for (let y = 59; y < 80; y++) for (let x = dx - 9; x <= dx + 9; x++) {
      const e = ((x + 0.5 - dx) / 8.5) ** 2 + ((y + 0.5 - 69) / 10) ** 2;
      if (e <= 1) P.px(x, y, e > 0.72 ? 0x6a4a36 : 0x3a2a24);
    }
    P.rect(dx + 11, 56, 4, 5, 0x2a2a32); P.px(dx + 12, 57, 0xf0b429); P.px(dx + 13, 59, 0xd8323a); // reglaget
  }
  // klockan ovanför torkhuvarna
  { const [kx, ky] = CLOCK; disc(P, kx + 0.5, ky + 0.5, 7.5, 7.5, NAVY); disc(P, kx + 0.5, ky + 0.5, 6, 6, 0xfaf8f2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.px(Math.round(kx + Math.cos(a) * 5), Math.round(ky + Math.sin(a) * 5), i % 3 === 0 ? INK : 0xa8a4a0); }
    P.px(kx - 3, ky - 4, WHITE); }

  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}

// Golvet: svartvita rutor (dämpade), matta med sax och kam, ljuspölar, skugga längs väggen
function paintFloor(P) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = Math.floor(x / 12), ty = Math.floor((y - WALL_Y) / 10), lx = x % 12, ly = (y - WALL_Y) % 10;
    const dark = (tx + ty) % 2 === 1;
    let c = dark ? 0x5e5c6e : 0xe8e2d6;
    c = mix(c, dark ? 0x6c6a7c : 0xd8d0c2, hash(tx, ty, 13) * 0.4);
    if (lx === 0 || ly === 0) c = dark ? 0x4e4c5c : 0xcac2b4;
    else if (ly === 1) c = mix(c, WHITE, dark ? 0.08 : 0.3);
    if (hash(x, y, 4) > 0.985) c = mul(c, 0.95);
    P.px(x, y, c);
  }
  // blanka golvet speglar lamporna och speglarna lite
  for (const lx of LAMPS) P.ell(lx, WALL_Y + 22, 30, 16, 0xfff6e0, 0.18, 4);
  for (const cx of STATIONS) P.ell(cx, WALL_Y + 8, 12, 6, 0xffffff, 0.1, 3);
  // mattan framför stolarna: marinblå med guldkant, stor sax och kam
  { const { x0, x1, y0, y1 } = RUG;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
      let c = NAVY2;
      if (e < 2) c = NAVY_DK; else if (e < 4) c = GOLD; else if (e === 4) c = GOLD_LO; else if (e === 7) c = NAVY_HI;
      else if ((x + y) % 10 === 0 && e > 8) c = mix(NAVY2, NAVY_HI, 0.5);
      if ((e === 0 || e === 1) && (x + y) % 2) c = mix(c, 0x000000, 0.2);
      P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.05));
    }
    for (let x = x0 + 2; x < x1 - 2; x += 3) { P.px(x, y0 - 1, GOLD_LO); P.px(x, y1, GOLD_LO); }
    const mx = Math.round((x0 + x1) / 2) + 8, my = Math.round((y0 + y1) / 2) - 4;
    for (let i = -14; i <= 6; i++) { P.px(mx + i, my - 2 - Math.round(i * 0.35), GOLD_HI); P.px(mx + i, my + 2 + Math.round(i * 0.35), GOLD); }
    disc(P, mx + 11, my - 6, 4.2, 3.2, GOLD); disc(P, mx + 11, my - 6, 2.2, 1.4, NAVY2);
    disc(P, mx + 11, my + 6, 4.2, 3.2, GOLD); disc(P, mx + 11, my + 6, 2.2, 1.4, NAVY2);
    P.rect(mx + 6, my - 1, 3, 3, GOLD_HI);
    P.rect(mx - 22, my + 14, 30, 3, 0xf4f1ea); for (let i = 0; i < 30; i += 2) P.vl(mx - 22 + i, my + 17, 3, 0xd8d0c4);
    const star = (sx, sy) => { P.px(sx, sy - 1, GOLD_HI); P.px(sx - 1, sy, GOLD_HI); P.px(sx, sy, WHITE); P.px(sx + 1, sy, GOLD_HI); P.px(sx, sy + 1, GOLD_HI); };
    star(mx - 40, my - 8); star(mx + 30, my + 10); star(mx - 34, my + 12); star(mx + 36, my - 10); star(mx - 58, my + 2); star(mx + 56, my + 2);
  }
  for (const cx of STATIONS) P.ell(cx, SEAT_Y + 3, 13, 4, 0x1a1420, 0.28, 3);
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  P.ell(DOOR_CX, WALL_Y + 18, 18, 10, 0xffffff, 0.08, 3);
}

// Frisörstolen bakifrån (ryggen mot oss): rygg, armstöd, sits, pump och fot
function paintChair() {
  const P = new Pix(24, 24);
  for (let y = 0; y < 12; y++) for (let x = 3; x < 21; x++) {
    if (y === 0 && (x < 5 || x > 18)) continue;
    if (y === 1 && (x < 4 || x > 19)) continue;
    let c = LEATHER;
    if (y <= 1) c = LEATHER_HI; else if (x === 3 || (y === 2 && x === 4)) c = LEATHER_HI; else if (x === 20) c = LEATHER_LO; else if (y === 11) c = LEATHER_DK;
    if ((x === 8 || x === 15) && y > 2 && y < 10) c = LEATHER_LO;
    if (y === 2 && x > 4 && x < 19) c = mix(LEATHER, LEATHER_HI, 0.5);
    P.px(x, y, c);
  }
  P.hl(5, 0, 14, INK, 0); // (konturen läggs nedan)
  // armstöden
  for (const ax of [0, 20]) { P.rect(ax, 7, 4, 2, LEATHER_HI); P.hl(ax, 9, 4, LEATHER_LO); P.vl(ax + 1, 10, 2, CHROME); P.vl(ax + 2, 10, 2, CHROME_LO); }
  // sitsens baksida
  P.rect(2, 12, 20, 4, LEATHER_LO); P.hl(2, 12, 20, CHROME); P.hl(2, 15, 20, LEATHER_DK);
  // pumpen: bälg + krompelare
  P.rect(9, 16, 6, 2, 0x1d1d22); P.hl(9, 16, 6, 0x3a3a44);
  P.rect(10, 18, 4, 2, CHROME); P.vl(10, 18, 2, CHROME_HI); P.vl(13, 18, 2, CHROME_LO);
  // foten: rund kromplatta + pedal
  for (let y = 19; y < 24; y++) for (let x = 0; x < 24; x++) {
    const e = ((x + 0.5 - 12) / 11.5) ** 2 + ((y + 0.5 - 21.5) / 2.6) ** 2;
    if (e > 1) continue;
    P.px(x, y, y <= 20 ? CHROME_HI : y === 21 ? CHROME : y === 22 ? CHROME_LO : CHROME_DK);
  }
  P.rect(18, 18, 5, 2, 0x1d1d22); P.hl(18, 18, 5, 0x4a4a56);
  return outlined(P, 24, 24, (x, y) => y < 16);
}

// Lägger en mörk kontur runt det som är ritat i P (bara där when(x, y) säger ja)
function outlined(P, w, h, when = () => true) {
  const d = P.d, out = new Pix(w, h);
  const has = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (has(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => has(x + dx, y + dy) && when(x + dx, y + dy))) out.px(x, y, INK);
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(out.flush(), 0, 0); cx.drawImage(P.flush(), 0, 0);
  return c;
}

// Spegelns glans (ligger över spegelbilden)
function paintSheen() {
  const w = GLASS.dx1 - GLASS.dx0, h = GLASS.y1 - GLASS.y0;
  const P = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = x + y * 0.55;
    if ((d > 4 && d < 7) || (d > 9 && d < 10)) P.px(x, y, WHITE, 0.28);
    if (d > 26 && d < 28) P.px(x, y, WHITE, 0.16);
    P.px(x, y, 0xb8e0e0, 0.08);
  }
  return P.flush();
}

function paintSofaArms() {
  const P = new Pix(SOFA.x1 - SOFA.x0 + 6, 32);
  for (const ax of [0, SOFA.x1 - SOFA.x0]) {
    for (let y = 0; y < 28; y++) for (let x = ax; x < ax + 6; x++) {
      let c = ROSE;
      if (y < 3) c = y === 0 ? ROSE_HI : mix(ROSE, ROSE_HI, 0.5);
      else if (x === ax) c = ROSE_HI; else if (x === ax + 5) c = ROSE_DK; else if (y > 24) c = ROSE_LO;
      if (y === 3) c = ROSE_LO;
      P.px(x, y, c);
    }
    P.box(ax, 0, 6, 28, ROSE_DK);
    P.rect(ax + 2, 28, 2, 2, GOLD); P.px(ax + 2, 28, GOLD_HI);
  }
  return P.flush();
}

// Glasbordet framför soffan med tidningar
function paintTable() {
  const w = TABLE.x1 - TABLE.x0 + 2, P = new Pix(w, 16);
  for (let y = 0; y < 6; y++) for (let x = 0; x < w; x++) {
    const e = ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - 3) / 3) ** 2;
    if (e <= 1) P.px(x, y, e > 0.75 ? 0x8ab8c8 : 0xc8e4ec, 0.85);
  }
  P.hl(4, 1, 8, WHITE, 0.8);
  for (const lx of [4, w - 6]) { P.rect(lx, 5, 2, 9, CHROME); P.vl(lx, 5, 9, CHROME_HI); }
  P.rect(w / 2 - 1, 5, 2, 9, CHROME_LO);
  // tidningar
  P.rect(5, 1, 7, 4, 0xd8323a); P.rect(6, 2, 3, 1, 0xfff4d0); P.box(5, 1, 7, 4, 0x8a1a20);
  P.rect(14, 2, 8, 3, 0xf8f6f0); P.rect(14, 2, 4, 3, 0x2a5ab0); P.hl(19, 3, 2, 0xa8a4a0);
  P.rect(24, 1, 4, 3, 0xf0b429); P.box(24, 1, 4, 3, 0x9a7020);
  P.darken(2, 14, w - 4, 2, 0.75);
  return P.flush();
}

// Kassadisken: marmorskiva, marinblå front med guldsax, kassaapparat, blomma, tidbok
function paintDesk() {
  const w = DESK.x1 - DESK.x0, h = DESK.y1 - DESK.y0 + 14, P = new Pix(w, h);
  const top = 14;
  P.rect(0, top, w, 6, 0xf4f1ec); P.hl(0, top, w, WHITE); P.hl(0, top + 5, w, 0xb8b0a8);
  for (let x = 0; x < w; x++) for (let y = top + 1; y < top + 5; y++) if (hash(x, y, 8) > 0.86) P.px(x, y, 0xd0ccd4);
  P.rect(1, top + 6, w - 2, h - top - 8, NAVY);
  for (let x = 4; x < w - 4; x += 16) { P.box(x, top + 9, 13, h - top - 14, NAVY_DK); P.hl(x + 1, top + h - top - 6, 11, NAVY_HI); }
  P.hl(1, top + 6, w - 2, GOLD); P.hl(1, top + 7, w - 2, GOLD_LO);
  P.rect(0, h - 2, w, 2, NAVY_DK);
  // guldsaxen på fronten
  const mx = w / 2, my = top + 16;
  for (let i = -5; i <= 3; i++) { P.px(mx + i, my - 1 - Math.round(i * 0.3), GOLD_HI); P.px(mx + i, my + 1 + Math.round(i * 0.3), GOLD); }
  disc(P, mx + 5, my - 3, 2, 1.5, GOLD); disc(P, mx + 5, my + 3, 2, 1.5, GOLD);
  P.box(0, top, w, h - top, INK);
  // kassaapparaten
  P.rect(44, 3, 18, 11, 0x2a2a32); P.rect(45, 4, 16, 4, 0x6fe08a); P.hl(46, 5, 6, 0x1d5a2c); P.hl(46, 6, 10, 0x2f8f46);
  P.rect(43, 10, 20, 4, 0x3a3a44); P.hl(43, 10, 20, 0x5a5a64); for (let i = 0; i < 5; i++) P.px(46 + i * 3, 12, 0xc8ccd4);
  // kortläsare, tidbok, vas med blomma, visitkort
  P.rect(36, 9, 5, 5, 0x2a2a32); P.hl(37, 10, 3, 0x8fa0b8);
  P.rect(12, 10, 14, 4, 0xd8323a); P.rect(13, 10, 12, 1, 0xf8f6f0); P.vl(19, 10, 4, 0x8a1a20); // tidboken
  P.rect(3, 7, 4, 7, 0xbfe0ec); P.vl(3, 7, 7, WHITE); P.vl(5, 1, 6, 0x46a35a); P.px(4, 3, 0x46a35a); // vasen med en ros
  disc(P, 5.5, 1.5, 2.2, 1.8, 0xf28bb3); P.px(5, 1, 0xfff0a0);
  P.rect(28, 12, 4, 2, WHITE); P.hl(28, 12, 4, GOLD); // visitkort
  return P.flush();
}

// Frisyrboken på ett ställ: stor uppslagen bok med små frisyrbilder
function paintLectern() {
  const P = new Pix(26, 34);
  // stolpe och fot
  P.rect(11, 14, 4, 16, 0x8a6038); P.vl(11, 14, 16, 0xb8875a); P.vl(14, 14, 16, 0x5a3a20);
  P.rect(5, 30, 16, 3, 0x6b4a33); P.hl(5, 30, 16, 0x8a6446); P.hl(5, 32, 16, 0x3a2414);
  // lutande skiva
  P.rect(1, 8, 24, 7, 0x6b4a33); P.hl(1, 8, 24, 0x8a6446); P.hl(1, 14, 24, 0x3a2414);
  // boken
  P.rect(2, 1, 22, 9, 0x2a5ab0); P.rect(3, 2, 9, 7, 0xfaf8f2); P.rect(14, 2, 9, 7, 0xfaf8f2); P.vl(12, 1, 9, 0x1c3a7a); P.vl(13, 1, 9, 0x1c3a7a);
  P.hl(3, 8, 9, 0xd8d4cc); P.hl(14, 8, 9, 0xd8d4cc);
  const heads = [[5, 4, 0xb7392b], [9, 4, 0x3b2619], [16, 4, 0xecd489], [20, 4, 0x1d1714], [5, 7, 0xc65fa0], [9, 7, 0xa5692f], [16, 7, 0x3f4fa8], [20, 7, 0x6b4226]];
  for (const [x, y, c] of heads) { P.px(x, y - 1, c); P.px(x + 1, y - 1, c); P.px(x - 1, y, c); P.px(x, y, 0xeec3a0); P.px(x + 1, y, 0xeec3a0); P.px(x + 2, y, c); }
  P.vl(18, 0, 3, 0xd8323a); P.px(18, 3, 0xa8202a); // bokmärket
  P.box(2, 1, 22, 9, 0x10204a);
  P.darken(4, 33, 18, 1, 0.7);
  return P.flush();
}

function paintPlant() {
  const P = new Pix(22, 34);
  const leaves = [[11, 7, 4, 6, 0x2f7a3e], [6, 11, 4, 5, 0x3a8f48], [16, 11, 4, 5, 0x2f7a3e], [8, 17, 4, 4, 0x46a35a], [14, 17, 4, 4, 0x3a8f48], [11, 12, 3, 4, 0x56b866], [4, 19, 3, 3, 0x2f7a3e], [18, 19, 3, 3, 0x46a35a]];
  for (const [x, y, rx, ry] of leaves) disc(P, x, y, rx + 0.7, ry + 0.7, 0x173d22);
  for (const [x, y, rx, ry, c] of leaves) { disc(P, x, y, rx, ry, c); P.vl(x, y - ry + 1, ry * 2 - 1, mul(c, 0.78)); P.px(x - 1, y - ry + 2, mix(c, WHITE, 0.35)); }
  P.vl(11, 18, 5, 0x2a5a2e);
  // kruka i mässing
  P.rect(6, 23, 10, 9, GOLD); P.rect(5, 22, 12, 2, GOLD_HI); P.vl(15, 24, 8, GOLD_LO); P.vl(6, 24, 8, GOLD_HI);
  P.box(5, 22, 12, 2, 0x6a5020); P.vl(5, 24, 8, 0x6a5020); P.vl(16, 24, 8, 0x6a5020); P.hl(6, 32, 10, 0x6a5020);
  P.darken(4, 33, 14, 1, 0.7);
  return P.flush();
}

// tvättstolens armstöd (ritas framför den som sitter)
function paintWashArms() {
  const P = new Pix(24, 14);
  for (const ax of [0, 20]) { P.rect(ax, 0, 4, 3, LEATHER_HI); P.hl(ax, 3, 4, LEATHER_LO); P.rect(ax + 1, 4, 2, 8, CHROME); P.vl(ax + 1, 4, 8, CHROME_HI); }
  return P.flush();
}
// torkhuvens främre kant runt ansiktet
function paintDryerRim() {
  const P = new Pix(26, 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 26; x++) {
    const ex = (x + 0.5 - 13) / 10.8, ey = (y + 0.5 - 14) / 12, e = ex * ex + ey * ey;
    const ei = ((x + 0.5 - 13) / 8.5) ** 2 + ((y + 0.5 - 14) / 10) ** 2;
    if (e <= 1 && ei > 1 && y < 19) P.px(x, y, y < 4 ? 0xfaf4e8 : ex < 0 ? 0xf0e8d8 : 0xd8cfbe);
  }
  for (let x = 4; x < 22; x++) if (P.get(x, 3)) P.px(x, 3, CHROME);
  return P.flush();
}

// ================= väljaren: frisyr och färg med förhandsbild på DIN figur =================
const DIRS = ['down', 'left', 'up', 'right'];
const DIR_NAMES = ['Framifrån', 'Från sidan', 'Bakifrån', 'Från sidan'];
const GROUP_ICON = { 'Kort hår': '✂️', 'Lugg': '💇', 'Rakat': '🪒', 'Mellanlångt': '💁', 'Långt hår': '👸', 'Lockar': '🌀', 'Afro': '✨', 'Dreads & twists': '🧶', 'Uppsatt': '🎀', 'Hästsvansar': '🐴', 'Flätor': '🪢', 'Kul': '🎉' };
function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('fr-style')) return;
  const st = document.createElement('style');
  st.id = 'fr-style';
  st.textContent = `
.dlg.dlg-frisor { width: min(940px, 100%); height: min(720px, 100%); display: flex; flex-direction: column; overflow: hidden; }
.dlg-frisor .dlg-head { background: #1c2a4a; flex: none; }
.dlg-frisor .dlg-head h2 { text-shadow: 2px 2px 0 #0a1020; }
.dlg-frisor .dlg-body { flex: 1; min-height: 0; padding: 10px 12px; }
.dlg-frisor .dlg-foot { flex: none; padding-top: 10px; padding-bottom: 10px; border-top: 3px solid var(--ink); background: var(--paper2); }
.dlg-frisor .dlg-foot .fr-reset { margin-right: auto; }
.fr { height: 100%; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 14px; }
.fr-l { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow-y: auto; }
.fr-stage { display: flex; align-items: flex-end; justify-content: center; gap: 4px; padding: 10px 8px 0; border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  background: linear-gradient(#d3eadf 0 66%, #d8b060 66% 67%, #1c2a4a 67% 76%, #ece6da 76% 100%); position: relative; }
.fr-fig { display: flex; flex-direction: column; align-items: center; }
.fr-fig canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.fr-fig small { font-size: var(--f1); line-height: 1; background: var(--ink); color: #fff; padding: 2px 6px 1px; margin-bottom: 6px; white-space: nowrap; }
.fr-arrow { font-size: var(--f2); padding-bottom: 44px; }
.fr-turn { display: flex; gap: 6px; align-items: center; justify-content: center; }
.fr-turn b { font-size: var(--f2); min-width: 88px; text-align: center; font-weight: 400; }
.fr-bill { border: 3px solid var(--ink); background: #fffdf6; padding: 6px 8px; font-size: var(--f2); line-height: 1.05; box-shadow: 3px 3px 0 var(--ink); }
.fr-bill .row { display: flex; justify-content: space-between; gap: 8px; }
.fr-bill .row b { white-space: nowrap; }
.fr-cap { font-size: var(--f1); color: var(--muted); line-height: 1; margin: 0; text-align: center; }
.fr-bill .sum { border-top: 2px dashed var(--ink); margin-top: 4px; padding-top: 4px; font-size: var(--f2); }
.fr-bill .none { color: var(--muted); font-size: var(--f2); }
.fr-bill .money { font-size: var(--f1); color: var(--muted); margin-top: 4px; }
.fr-r { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.fr-tabs { display: flex; gap: 6px; flex: none; }
.fr-tab { font: var(--f2) var(--head); color: var(--ink); background: var(--paper2); border: 2px solid var(--ink); box-shadow: 2px 2px 0 var(--ink); padding: 3px 12px 2px; cursor: pointer; }
.fr-tab.on { background: var(--gold); transform: translate(2px, 2px); box-shadow: none; }
.fr-panel { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; margin-top: 8px; border: 3px solid var(--ink); background: #f7f2ea; padding: 6px 10px 12px; }
.fr-panel h4 { font: var(--f2) var(--head); font-weight: 400; text-transform: uppercase; letter-spacing: 1px; color: #1c2a4a; margin: 8px 0 5px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.fr-panel h4 .fr-now { font: var(--f2) var(--font); text-transform: none; letter-spacing: 0; background: #fff4c7; border: 2px solid var(--ink); padding: 0 6px; }
.fr-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0 6px; }
.fr-chip { font: var(--f1) var(--font); line-height: 1; color: var(--ink); background: var(--paper2); border: 2px solid var(--ink); box-shadow: 1px 1px 0 var(--ink); padding: 2px 6px 1px; cursor: pointer; white-space: nowrap; }
.fr-chip b { font-weight: 400; color: var(--muted); margin-left: 3px; }
.fr-chip.on { background: var(--gold); transform: translate(1px, 1px); box-shadow: none; }
.fr-chip.on b { color: var(--ink); }
.fr-chip.has { background: #fff4c7; }
.fr-chip.on.has { background: var(--gold); }
.fr-price { font-size: var(--f1); color: var(--muted); margin: -2px 0 6px; }
.fr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px; }
.fr-tile { position: relative; background: #fff; border: 2px solid var(--ink); box-shadow: 2px 2px 0 var(--ink); padding: 2px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; font: var(--f1) var(--font); line-height: .9; color: var(--ink); min-width: 0; }
.fr-tile canvas { display: block; image-rendering: pixelated; background: #e9f2ec; }
.fr-tile span { max-width: 100%; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-tile:hover { background: #fffbe8; }
.fr-tile.on { background: #fff4c7; outline: 3px solid var(--gold); outline-offset: -1px; }
.fr-tile.on::after { content: "✓"; position: absolute; top: -7px; right: -7px; width: 18px; height: 18px; font: var(--f1)/16px var(--head); text-align: center; background: var(--green2); color: #fff; border: 2px solid var(--ink); }
.fr-tile.now::before { content: "NU"; position: absolute; top: -7px; left: -7px; font: var(--f1)/14px var(--head); padding: 0 3px; background: #1c2a4a; color: #fff; border: 2px solid var(--ink); }
.fr-sws { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
.fr-sw { width: 28px; height: 28px; padding: 0; border: 3px solid var(--ink); background: var(--c); cursor: pointer; box-shadow: 2px 2px 0 var(--ink); position: relative; }
.fr-sw.on { outline: 3px solid #ffd23f; outline-offset: 1px; transform: translate(-1px, -1px); }
.fr-sw.own { background: repeating-linear-gradient(45deg, #fff 0 4px, #e3dac9 4px 8px); display: inline-flex; align-items: center; justify-content: center; font: var(--f2) var(--head); overflow: hidden; }
.fr-sw.own input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.fr-hint { font-size: var(--f1); color: var(--muted); margin: 0 0 6px; line-height: 1; }
.fr-dim { opacity: .45; }
@media (max-width: 639px) {
  .fr { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); gap: 8px; }
  .fr-l { flex-direction: row; flex-wrap: wrap; align-items: flex-start; overflow: visible; }
  .fr-stage { padding: 6px 6px 0; }
  .fr-bill { flex: 1; min-width: 140px; font-size: var(--f1); }
  .fr-turn { width: 100%; }
  .fr-grid { grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 4px; }
  .fr-tile span { display: none; }
  .fr-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
}
@media (max-height: 540px) and (min-width: 640px) {
  .fr-grid { grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); } .fr-tile span { display: none; }
  .fr { grid-template-columns: 220px minmax(0, 1fr); gap: 10px; } .fr-l { gap: 5px; } .fr-stage { padding: 6px 6px 0; }
  .fr-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; } .fr-chip { font-size: var(--f1); }
  .fr-bill { font-size: var(--f1); padding: 4px 6px; } .fr-bill .sum { font-size: var(--f2); } .fr-panel h4 { margin: 4px 0 4px; }
  .dlg-frisor .dlg-body { padding: 6px 10px; } .dlg-frisor .dlg-foot { padding-top: 6px; padding-bottom: 6px; }
}`;
  document.head.appendChild(st);
}

// Figuren i heltalsskala (hela enhetspixlar) – aldrig suddig
function figure(look, dir, S) {
  const src = document.createElement('canvas'); src.width = 28; src.height = 44;
  drawPerson(src.getContext('2d'), 14, 41, look, dir, 0);
  const dpr = globalThis.devicePixelRatio || 1, D = Math.max(1, Math.round(S * dpr));
  const c = document.createElement('canvas');
  c.width = 28 * D; c.height = 44 * D;
  c.style.width = (28 * D / dpr) + 'px'; c.style.height = (44 * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
// Huvudet (utsnitt ur spriten) för rutnätet
function headTile(look, S) {
  const src = document.createElement('canvas'); src.width = 24; src.height = 41;
  drawPerson(src.getContext('2d'), 12, 39, look, 'down', 0);
  const [sx, sy, sw, sh] = [2, look.kid ? 8 : 0, 20, 22];
  const k = S * Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  const c = document.createElement('canvas'); c.width = sw * k; c.height = sh * k;
  c.style.width = sw * S + 'px'; c.style.height = sh * S + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, sw * k, sh * k);
  return c;
}

// mode 'stol' = man sitter i stolen (betala och klipp), 'bok' = frisyrboken (bläddra, gå till en stol)
export function openFrisyrValjare(A, { mode = 'stol', sel: preset = null, onBuy, onCancel, onGoSit } = {}) {
  injectCss();
  const g = A.game;
  const start = hairOf(A.avatar.look);
  const sel = { ...start, ...(preset ? hairOf({ ...A.avatar.look, ...preset }) : {}) };
  const ids = Object.keys(styleReg());
  const groups = [];
  for (const id of ids) { const gr = groupOf(id); if (!groups.includes(gr)) groups.push(gr); }
  let tab = 'frisyr', group = groupOf(sel.style), dirI = 0;
  const compact = () => typeof matchMedia === 'function' && matchMedia('(max-width: 639px), (max-height: 540px)').matches;
  const body = `<div class="fr">
    <div class="fr-l">
      <div class="fr-stage">
        <div class="fr-fig" data-fig="now"><i></i><small>Nu</small></div>
        <div class="fr-arrow">➜</div>
        <div class="fr-fig" data-fig="new"><i></i><small>Efter</small></div>
      </div>
      <div class="fr-turn"><button class="btn btn-small" data-turn="-1" aria-label="Vrid åt vänster">⟲</button><b data-view>Framifrån</b><button class="btn btn-small" data-turn="1" aria-label="Vrid åt höger">⟳</button></div>
      ${A.avatar.look.hat || A.avatar.look.phones || (A.avatar.look.hairAcc && A.avatar.look.hairAcc !== 'none') ? '<p class="fr-cap">🧢 Visas utan huvudbonad – den får du tillbaka efteråt.</p>' : ''}
      <div class="fr-bill" data-bill></div>
    </div>
    <div class="fr-r">
      <div class="fr-tabs"><button class="fr-tab" data-tab="frisyr">✂️ Frisyr</button><button class="fr-tab" data-tab="farg">🎨 Hårfärg</button></div>
      <div class="fr-panel" data-panel></div>
    </div>
  </div>`;
  const buttons = mode === 'stol' ? [
    { label: '↺ Som förut', cls: 'fr-reset', onClick: () => { Object.assign(sel, start); group = groupOf(sel.style); play('click'); renderAll(); } },
    { label: '🎲 Överraska mig', onClick: () => surprise() },
    { label: 'Avbryt', onClick: () => { closeModal(); onCancel?.({ ...sel }); } },
    { label: '✂️ Klipp! <span data-sum></span>', cls: 'btn-go fr-go', onClick: () => {
      const p = frisorPris(A.avatar.look, sel);
      if (!p.total || g.money < p.total) return;
      if (onBuy?.({ ...sel }) !== false) closeModal();
    } },
  ] : [
    { label: 'Stäng', onClick: () => { closeModal(); } },
    { label: '🎲 Överraska mig', onClick: () => surprise() },
    { label: '💺 Till en stol', cls: 'btn-go fr-go', onClick: () => { closeModal(); onGoSit?.({ ...sel }); } },
  ];
  const dlg = openModal(mode === 'stol' ? '💈 Frisören – vad ska vi göra?' : '📖 Frisyrboken', body, buttons);
  dlg.classList.add('dlg-frisor');
  const xb = dlg.querySelector('[data-close]');
  if (xb) xb.onclick = () => { closeModal(); if (mode === 'stol') onCancel?.({ ...sel }); };
  const $ = (s) => dlg.querySelector(s);
  const panel = $('[data-panel]');

  const lookWith = (patch) => noHead({ ...A.avatar.look, ...sel, ...patch });
  function surprise() {
    const rng = Math.random;
    sel.style = pickOf(rng, ids.filter((id) => id !== start.style));
    if (rng() < 0.5) sel.hair = pickOf(rng, HAIR_PAL);
    group = groupOf(sel.style);
    play('click'); renderAll();
  }
  function renderStage() {
    const dir = DIRS[dirI];
    const h = window.innerHeight, big = h >= 620 && !compact() ? 5 : h > 480 ? (compact() ? 3 : 4) : h > 400 ? 3 : 2;
    $('[data-fig="now"] i').replaceChildren(figure(noHead(A.avatar.look), dir, big <= 2 ? 1 : 2));
    $('[data-fig="new"] i').replaceChildren(figure(lookWith({}), dir, big));
    $('[data-view]').textContent = DIR_NAMES[dirI];
  }
  function renderBill() {
    const p = frisorPris(A.avatar.look, sel), short = p.total - g.money;
    $('[data-bill]').innerHTML = (p.lines.length
      ? p.lines.map((l) => `<div class="row"><span>${esc(l.label)}</span><b>${fmt(l.price)}</b></div>`).join('') + `<div class="row sum"><span>Summa</span><b>${fmt(p.total)}</b></div>`
      : `<div class="none">${mode === 'stol' ? 'Välj en ny frisyr eller hårfärg – förhandsbilden visar hur det blir på dig.' : 'Bläddra och prova – förhandsbilden visar hur det blir på dig.'}</div>`)
      + `<div class="money">💰 Du har <b>${fmt(g.money)}</b>${p.total ? (short > 0 ? ` · <b class="bad">du saknar ${fmt(short)}</b>` : ` · kvar sedan: ${fmt(g.money - p.total)}`) : ''}</div>`;
    const go = dlg.querySelector('.fr-go');
    if (go && mode === 'stol') {
      go.disabled = !p.total || short > 0;
      const sp = go.querySelector('[data-sum]');
      if (sp) sp.textContent = p.total ? `(${fmt(p.total)})` : '';
    }
  }
  const tileBtn = (attrs, label, on, now) => `<button class="fr-tile${on ? ' on' : ''}${now ? ' now' : ''}" ${attrs} title="${esc(label)}" aria-label="${esc(label)}" aria-pressed="${on}"><i data-t></i><span>${esc(label)}</span></button>`;
  let pending = [];
  function renderPanel() {
    dlg.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const S = compact() ? 2 : 3;
    pending = [];
    let html = '';
    if (tab === 'frisyr') {
      const count = (gr) => ids.filter((id) => groupOf(id) === gr).length;
      html += `<h4>Frisyr <span class="fr-now">${esc(labelOf(sel.style))}</span></h4>`;
      html += `<div class="fr-chips">${groups.map((gr) => `<button class="fr-chip${gr === group ? ' on' : ''}${gr === groupOf(sel.style) ? ' has' : ''}" data-g="${esc(gr)}">${GROUP_ICON[gr] || '💇'} ${esc(gr)}<b>${count(gr)}</b></button>`).join('')}</div>`;
      const k = FRISOR_PRIS[GROUP_KIND[group] || 'klippning'];
      html += `<p class="fr-price">${esc(group)}: ${esc(k.label.toLowerCase())} ${fmt(k.price)}${mode === 'stol' ? '' : ' hos frisören'}</p>`;
      const list = ids.filter((id) => groupOf(id) === group);
      html += `<div class="fr-grid">${list.map((id) => { pending.push(lookWith({ style: id })); return tileBtn(`data-style="${esc(id)}"`, labelOf(id), id === sel.style, id === start.style); }).join('')}</div>`;
    } else {
      const fxIds = Object.keys(fxReg());
      html += `<h4>Hårfärg</h4><div class="fr-sws">${HAIR_PAL.map((c) => `<button class="fr-sw${c === sel.hair ? ' on' : ''}" data-hair="${c}" style="--c:${c}" aria-label="Hårfärg ${c}"></button>`).join('')}
        <label class="fr-sw own${!HAIR_PAL.includes(sel.hair) ? ' on' : ''}" style="${!HAIR_PAL.includes(sel.hair) ? `background:${sel.hair}` : ''}" title="Egen färg">+<input type="color" data-own="hair" value="${sel.hair}" aria-label="Egen hårfärg"></label></div>
        <p class="fr-hint">Färgen gäller även ögonbryn och skägg.</p>`;
      html += `<h4>Slingor, toppar & tvåfärgat <span class="fr-now">${esc(labelOf(sel.hairFx, fxReg()))}</span></h4><div class="fr-grid">${fxIds.map((id) => { pending.push(lookWith({ hairFx: id, hair2: sel.hair2 || '#ecd489' })); return tileBtn(`data-fx="${esc(id)}"`, labelOf(id, fxReg()), id === sel.hairFx, id === start.hairFx); }).join('')}</div>`;
      html += `<h4>Andra färgen</h4><div class="fr-sws${sel.hairFx === 'none' ? ' fr-dim' : ''}">${HAIR2_PAL.map((c) => `<button class="fr-sw${c === sel.hair2 ? ' on' : ''}" data-hair2="${c}" style="--c:${c}" aria-label="Andra färgen ${c}"></button>`).join('')}
        <label class="fr-sw own" title="Egen färg">+<input type="color" data-own="hair2" value="${sel.hair2 || '#ecd489'}" aria-label="Egen andra färg"></label></div>
        <p class="fr-hint">Slingor, toppar, ombré och tvåfärgat använder den andra färgen.</p>`;
    }
    const top = panel.scrollTop;
    panel.innerHTML = html;
    panel.scrollTop = top;
    // rita rutorna lite i taget (många frisyrer)
    const els = [...panel.querySelectorAll('i[data-t]')];
    let i = 0;
    const pump = () => {
      if (!dlg.isConnected) return;
      const t0 = performance.now();
      while (i < els.length && performance.now() - t0 < 12) { const el = els[i], L = pending[i]; i++; if (el.isConnected && L) el.replaceWith(headTile(L, S)); }
      if (i < els.length) requestAnimationFrame(pump);
    };
    pump();
  }
  function renderAll() { renderStage(); renderBill(); renderPanel(); }
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !dlg.contains(b)) return;
    if (b.dataset.tab) { tab = b.dataset.tab; panel.scrollTop = 0; play('click'); renderPanel(); return; }
    if (b.dataset.turn) { dirI = (dirI + +b.dataset.turn + 4) % 4; play('click'); renderStage(); return; }
    if (b.dataset.g) { group = b.dataset.g; panel.scrollTop = 0; play('click'); renderPanel(); return; }
    if (b.dataset.style) {
      // bara markeringen byts – rutorna behöver inte ritas om
      sel.style = b.dataset.style; play('click');
      panel.querySelectorAll('[data-style]').forEach((x) => { const on = x.dataset.style === sel.style; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      const now = panel.querySelector('.fr-now'); if (now) now.textContent = labelOf(sel.style);
      panel.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('has', x.dataset.g === groupOf(sel.style)));
      renderStage(); renderBill(); return;
    }
    if (b.dataset.fx) { sel.hairFx = b.dataset.fx; if (sel.hairFx !== 'none' && !sel.hair2) sel.hair2 = '#ecd489'; play('click'); renderAll(); return; }
    if (b.dataset.hair) { sel.hair = b.dataset.hair; play('click'); renderAll(); return; }
    if (b.dataset.hair2) { sel.hair2 = b.dataset.hair2; if (sel.hairFx === 'none') sel.hairFx = 'highlights'; play('click'); renderAll(); return; }
  });
  dlg.addEventListener('input', (e) => {
    const k = e.target?.dataset?.own;
    if (!k || !HEXRE.test(e.target.value)) return;
    sel[k] = e.target.value.toLowerCase();
    if (k === 'hair2' && sel.hairFx === 'none') sel.hairFx = 'highlights';
    renderStage(); renderBill();
  });
  dlg.addEventListener('change', (e) => { if (e.target?.dataset?.own) renderPanel(); });
  renderAll();
  return dlg;
}
