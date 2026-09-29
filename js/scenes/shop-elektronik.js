// BLIXT ELEKTRONIK – elektronikbutiken i Downtown (finanskvarteret med de höga husen) som
// man går runt i med sin egen figur. Modern och ljus: vita väggar, blankt stengolv som
// speglar ljuset, LED-list i taket och en hel glasfasad mot gatan där man ser skyskraporna,
// börstickern som rullar, bilarna och folk som går förbi (och regnet/snön när det är sånt väder).
//
//   bakväggen:  TV-VÄGGEN (sex skärmar – alla visar SAMMA bild i live(), kanalen byts var
//               åttonde sekund: havet, fotboll, rymden, BLIXT-reklam) · glasfasaden med
//               skjutdörrarna (UT) · KASSAN med loggan och varulådorna · HÖRLURSVÄGGEN
//   golvet:     långbord med TELEFONER och SURFPLATTOR på ställ (skärmarna lyser och byter
//               bild), SPELKONSOLERNA på en podie med en TV där ett barn kör bilspel,
//               RETROHYLLAN (tjock-TV och telefoner med nummerskiva), DATORHÖRNAN med
//               gamingriggar på svarta skrivbord med RGB-ljus, stationära datorer med torn
//               och bärbara, en kartongskylt med nya Päronfon, PROVA-ÖN med nyheterna
//               (smartklockor, högtalare, kameror – säljs inte än, men högtalaren spelar och
//               kameran blixtrar), en griffeltavla vid entrén – och kunder som provar allt.
//
// KÖPFLÖDE (gåbart): klicka på en vara → figuren går dit → produktbladet (bild, modell,
// pris, nytta) → "Till kassan" → figuren bär lådan till kassan → expediten piper in den →
// betalt. Datorsakerna är samma möbelnycklar som förut i Möbeljätten (GAME.KATALOG, som nu
// inte ställs ut där – ELEKTRONIK i js/scenes/ikea/kat.js): de hamnar i FÖRRÅDET och ställs
// ut hemma med Möblera (fullt förråd = knappen släckt). Telefoner och surfplattor är PRYLAR
// (GAME.GADGETS / g.buyGadget, sparas i g.gadgets) med en liten nytta som följer modellen
// (GADGETS[].bonus – den bästa man har räknas). Hörlurarna låser upp hörlurarna i garderoben
// (samma som i klädaffären, g.buyClothes). En sak i taget; går man ut med en obetald låda
// frågar dörren först, och byts scenen utifrån släpps lådan (inga pengar dras).
import { Pix, SMALL, BIG, ctxText, textW, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import * as GAME from '../game.js';
import { play, audioContext, isMuted } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import * as ROOM from './room.js';
import * as WX from '../city/weather.js';

// ================= geometri (spelpixlar, världskoordinater) =================
const W = 640, H = 232;
let VW = 384, VH = 216; // mobilfyllning: vyn följer skärmen, klampad till butiken
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); VH = Math.max(216, Math.min(A.H || 216, H)); };
const SIDE = 6;                 // sidoväggarnas tjocklek
const CEIL = 12;                // taklistens underkant = bakväggens överkant
const WALL_Y = 76;              // bakväggens fot = golvets början
const TVW = { x0: SIDE, x1: 206 };                  // TV-väggen
const GLASS = { x0: 206, x1: 418, top: 21 };        // glasfasaden (under den blanka överkarmen)
const DOOR = { x0: 294, x1: 330 }, DOOR_X = 312;    // skjutdörrarna i fasaden
const KW = { x0: 418, x1: 530 };                    // kassaväggen med loggan
const PEG = { x0: 530, x1: W - SIDE };              // hörlursväggen (perforerad skiva)
const TICKER = { x0: 287, x1: 335, y: 38, h: 7 };   // börstickern på tornet mitt emot
// TV-väggens skärmar (skärmytan – ramen ritas runt om). Den nedre raden står på samma
// linje med storleken på en lapp under, två mindre hänger ovanför.
// (Lapparna visar vad Platt-TV:n kan – det finns en modell, de är bara olika stora på väggen.)
const TVS = [
  { x: 16, y: 38, w: 34, h: 19, tag: '4K' },
  { x: 60, y: 18, w: 70, h: 39, tag: 'SMART-TV' },
  { x: 138, y: 32, w: 44, h: 25, tag: 'HDR' },
  { x: 20, y: 18, w: 26, h: 14 },
  { x: 142, y: 17, w: 36, h: 10 },   // ultrabred biograf-TV
  { x: 188, y: 44, w: 12, h: 13 },   // en liten stående skärm (reklamskärm)
];
const TVB = { x0: 12, x1: 200, base: 90 };          // låg TV-bänk längs väggen
const CNT = { x0: 428, x1: 520, top: 90, base: 112 }; // kassadisken
const EXP = { x: 474, y: 101 };                     // expeditens fötter (bakom disken)
const PAY = [494, 124];                             // där jag står och betalar
const NPC_PAY = [452, 124];                         // där kunderna betalar
const QUEUE = [418, 126];
const HPT = { x0: 552, x1: 622, base: 104 };        // lyssningsbordet framför hörlursväggen
const CON = { x0: 12, x1: 128, base: 150 };         // spelkonsolernas podie
const GAME_TV = { x: 22, y: 106, w: 42, h: 24 };    // TV:n på podien (barnet kör bilspel)
const KID = { x: 43, y: 166 };
const RET = { x0: 12, x1: 124, base: 212 };         // retrohyllan
const PT = { x0: 148, x1: 304, base: 148 };         // telefonbordet
const TT = { x0: 148, x1: 304, base: 202 };         // surfplattebordet
const GD = [{ x0: 430, v: 0 }, { x0: 496, v: 2 }, { x0: 562, v: 4 }]; // gamingborden (riggarnas modell)
const GD_BASE = 158, GD_W = 60;
const CD = { x0: 430, x1: 566, base: 210 };         // datorbordet (stationära + torn)
const LT = { x0: 570, x1: 630, base: 210 };         // bordet med bärbara
const STD = { x: 386, base: 156, w: 34, h: 54 };    // kartongskylten med Päronfon
const ISL = { x0: 318, x1: 410, base: 200 };        // PROVA-ÖN: smartklockor, högtalare och kameror (säljs inte än)
const AF = { x: 250, base: 108, w: 30 };            // golvskylten (trottoarpratare) innanför entrén
const PLANTS = [{ x: 212, base: 98, k: 0 }, { x: 396, base: 98, k: 1 }, { x: 128, base: 226, k: 2 }];

// allt man inte kan gå igenom
const OBST = [
  [TVB.x0, WALL_Y - 8, TVB.x1, TVB.base],
  [KW.x0 + 6, WALL_Y - 8, CNT.x1 + 4, CNT.base],
  [HPT.x0 - 4, WALL_Y - 8, HPT.x1 + 2, HPT.base],
  [PEG.x0, WALL_Y - 8, W, WALL_Y + 6],
  [CON.x0, CON.base - 16, CON.x1, CON.base],
  [KID.x - 8, KID.y - 6, KID.x + 8, KID.y + 2],
  [RET.x0, RET.base - 20, RET.x1, RET.base],
  [PT.x0, PT.base - 26, PT.x1, PT.base],
  [TT.x0, TT.base - 26, TT.x1, TT.base],
  [GD[0].x0 - 2, GD_BASE - 22, GD[2].x0 + GD_W + 2, GD_BASE],
  [CD.x0 - 2, CD.base - 22, CD.x1 + 2, CD.base],
  [LT.x0 - 2, LT.base - 22, LT.x1 + 2, LT.base],
  [STD.x, STD.base - 8, STD.x + STD.w, STD.base],
  [ISL.x0 - 2, ISL.base - 12, ISL.x1 + 2, ISL.base],
  [AF.x + 2, AF.base - 5, AF.x + AF.w - 2, AF.base],
  ...PLANTS.map((p) => [p.x, p.base - 7, p.x + 16, p.base]),
];

// ================= färger och små penslar =================
const OUT = 0x1c1a24;
const NAVY = 0x1b2a5a, NAVY2 = 0x2a3c78, CYAN = 0x20b8f0, YEL = 0xffd23f;
const OAK = [0x8a6a44, 0xae8a5c, 0xcaa878, 0xdcc096, 0xecd6b2];
const TEAK = [0x3e2414, 0x5e3820, 0x7e4e2c, 0x9a643a, 0xb47e50];
const WHITE = [0xb8bec8, 0xd2d7de, 0xe6e9ee, 0xf2f4f7, 0xffffff];
const APPS = [0xff5a5a, 0xffc23a, 0x4ad86a, 0x3aa8ff, 0xb46aff, 0xff8a3a, 0x2ad8c8, 0xff6ab8, 0xf4f1ea];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexs = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const rampOf = (c) => [mix(mul(c, 0.4), 0x160c26, 0.3), mix(mul(c, 0.7), 0x2a1f3a, 0.1), c, mix(c, 0xfff6e8, 0.32), mix(c, 0xffffff, 0.66)];
// skuggad låda: ljus överkant/vänsterkant, mörk högerkant/underkant
function sbox(P, x, y, w, h, c) {
  const r = rampOf(c);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let k = r[2];
    if (j === 0) k = r[3]; else if (j === h - 1) k = r[1]; else if (i === 0) k = r[3]; else if (i === w - 1) k = r[1];
    P.px(x + i, y + j, k);
  }
  if (w > 2 && h > 2) P.px(x, y, r[4]);
}
// snedställda reflexstrimmor på glas
function glare(P, x, y, w, h, a = 0.22, step = 17, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j + seed * 5) % step;
    if (d < 2) P.px(x + i, y + j, 0xffffff, a); else if (d === 3) P.px(x + i, y + j, 0xffffff, a * 0.45);
  }
}
// mjuk skugga på golvet (blandas över det som redan är målat)
function shade(P, cx, cy, rx, ry, a = 0.26) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t >= 1) continue;
    const q = clamp(Math.round((1 - t) * 3 + bayer(x, y) - 0.5), 0, 3) / 3;
    if (q > 0) P.px(x, y, 0x1a2030, a * (0.35 + 0.65 * q));
  }
}
// mörk kontur runt allt målat i en sprite
function outline(P, dark = OUT, softA = 0.6) {
  const { w, h, d } = P;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = on(x, y - 1) || on(x - 1, y), soft = on(x, y + 1) || on(x + 1, y);
    if (hard || soft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, dark, add[i + 2] ? 1 : softA);
}
// förmålad bild i världskoordinater
function sprite(x0, y0, w, h, fn) {
  const P = new Pix(w, h, x0, y0);
  fn(P);
  return { img: P.flush(), x: x0, y: y0, w, h };
}
const put = (ctx, s) => ctx.drawImage(s.img, s.x, s.y);
const txt = (P, F, s, x, y, c, a = 1) => eachTextPixel(F, s, x, y, 1, (px, py) => P.px(px, py, c, a));
const txtC = (P, F, s, cx, y, c, a = 1) => txt(P, F, s, Math.round(cx - textW(F, s) / 2), y, c, a);
// prisets text: 1900 → "1900:-"
const priceTxt = (n) => (n == null ? 'SNART' : `${Math.round(n)}:-`);
// en liten blixt (loggan): 4×7
const BOLT = ['..##', '.##.', '###.', '.###', '.##.', '##..', '#...'];
function bolt(P, x, y, c, dark = null) {
  BOLT.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(x + i, y + j, c); });
  if (dark !== null) BOLT.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#' && row[i + 1] !== '#') P.px(x + i + 1, y + j, dark, 0.6); });
}

// ================= sortimentet =================
// type: 'furn' = möbel ur GAME.KATALOG (hamnar i förrådet), 'gadget' = pryl (GAME.GADGETS),
// 'clothes' = hörlurarna i garderoben. models = vilka varianter (atlasens index) som säljs här.
const PRODUCTS = [
  { id: 'tv', type: 'furn', k: 'tv', models: [1], name: 'Platt-TV', icon: '📺', desc: 'Skarp bild i vardagsrummet. Hemma zappar du en stund vid TV:n.' },
  { id: 'rigg', type: 'furn', k: 'tv', models: [0, 2, 3, 4], name: 'Gamingrigg', icon: '🕹️', desc: 'Tre skärmar, tangentbord med regnbågsljus och en mus som glöder.' },
  { id: 'dator', type: 'furn', k: 'dator', models: [0, 1, 2, 3], name: 'Dator', icon: '🖥️', desc: 'Skärm, tangentbord och mus. Hemma surfar du en stund – var tog timmen vägen?' },
  { id: 'datortorn', type: 'furn', k: 'datortorn', models: [0, 1, 2, 3], name: 'Datortorn', icon: '💾', desc: 'Lådan som surrar under skrivbordet – med blinkande lampor.' },
  { id: 'laptop', type: 'furn', k: 'laptop', models: [0, 1], name: 'Bärbar dator', icon: '💻', desc: 'Lite skärmtid i soffan, var du vill.' },
  { id: 'spelkonsol', type: 'furn', k: 'spelkonsol', models: [0, 1, 2], name: 'Spelkonsol', icon: '🎮', desc: 'En runda till … bara en till.' },
  { id: 'retrotv', type: 'furn', k: 'retrotv', models: [0], name: 'Retro-TV', icon: '📺', desc: 'Tjock-TV i träskåp. Myrornas krig ingår.' },
  { id: 'telefon', type: 'furn', k: 'telefon', models: [0, 1, 2], name: 'Fast telefon', icon: '☎️', desc: 'Med nummerskiva – precis som hos mormor. Står fint på en byrå.' },
  // (bonus här är bara reserv – det riktiga värdet står i GAME.GADGETS)
  { id: 'fonmini', type: 'gadget', icon: '📱', name: 'Blixtfon Mini', price: 900, bonus: 3, desc: 'Liten, tålig och billig. Väckarklockan piper lite snällt.' },
  { id: 'fon12', type: 'gadget', icon: '📱', name: 'Blixtfon 12', price: 1900, bonus: 5, desc: 'Stor skärm och ett batteri som räcker hela dagen. Väckarklockan väcker dig mjukt med fågelsång.' },
  { id: 'paronfon', type: 'gadget', icon: '📱', name: 'Päronfon 16 Pro', price: 4500, bonus: 8, desc: 'Tre kameror och en päronlogga på baksidan. Sömnkoll väcker dig när du sover som lättast. Årets pryl!' },
  { id: 'platta', type: 'gadget', icon: '📲', name: 'Blixtplatta', price: 1500, bonus: 4, desc: 'Serier, spel och recept – på stor skärm.' },
  { id: 'paronplatta', type: 'gadget', icon: '📲', name: 'Päronplatta Pro', price: 3900, bonus: 7, desc: 'Tunn som en pepparkaka, skärmen blir varm och gul på kvällen. Pennan ingår.' },
  { id: 'horlurar', type: 'clothes', kind: 'phones', v: true, icon: '🎧', name: 'Hörlurar', desc: 'Stora, sköna hörlurar – de syns på din figur.' },
];
const prodOf = (id) => PRODUCTS.find((p) => p.id === id) || null;
const katOf = (k) => (typeof GAME.katalogOf === 'function' ? GAME.katalogOf(k) : null);
// prylarna (telefoner och surfplattor) läses ur game.js – finns de inte där än går de inte att köpa
const gadgetOf = (id) => (Array.isArray(GAME.GADGETS) ? GAME.GADGETS.find((x) => x.id === id) : null) || null;
const gadgetKind = (id) => gadgetOf(id)?.kind || (/platta/.test(id) ? 'platta' : 'mobil');
// nyttan följer modellen (dyrare pryl, mer energi) – har man flera av samma sort räknas den bästa
const bonusOf = (id) => gadgetOf(id)?.bonus ?? prodOf(id)?.bonus ?? 0;
const gadgetList = (kind) => PRODUCTS.filter((p) => p.type === 'gadget' && gadgetKind(p.id) === kind);
// den bästa prylen av en sort som man redan har: { id, name, bonus } eller null
function bestOwned(g, kind) {
  let best = null;
  for (const id of Array.isArray(g?.gadgets) ? g.gadgets : []) {
    if (gadgetKind(id) !== kind || !gadgetOf(id)) continue;
    const b = bonusOf(id);
    if (!best || b > best.bonus) best = { id, name: gadgetOf(id).name, bonus: b };
  }
  return best;
}
const USE = {
  mobil: (id) => `⏰ Väckarklockan: du vaknar piggare i din säng – <b>+${bonusOf(id)} energi</b> varje morgon.`,
  platta: (id) => `🌙 Kvällsserie i sängen: lägger du dig efter kl. 20 somnar du gott – <b>+${bonusOf(id)} energi</b> på morgonen.`,
};
// säljarens tips om prylarna: alla modellers nytta på en rad
const useTip = (kind) => `${kind === 'mobil' ? '⏰ Mobilens väckarklocka ger energi på morgonen' : '🌙 Surfplattan ger energi om du lägger dig efter kl. 20'}: ${gadgetList(kind).map((p) => `${nameOf(p)} +${bonusOf(p.id)}`).join(', ')}. Har du flera räknas den bästa.`;
const sortimentHP = () => (Array.isArray(GAME.SORTIMENT) ? GAME.SORTIMENT.find((s) => s.kind === 'phones') : null);
function priceOf(g, p) {
  if (!p) return null;
  if (p.type === 'furn') return katOf(p.k)?.price ?? null;
  if (p.type === 'gadget') { const x = gadgetOf(p.id); return x ? x.price : null; }
  const s = sortimentHP();
  return s ? (typeof g?.clothesPrice === 'function' ? g.clothesPrice(s) : s.price) : null;
}
const nameOf = (p) => (p.type === 'gadget' ? gadgetOf(p.id)?.name || p.name : p.name);
// kan varan köpas här just nu? (null = ja, annars varför inte)
function blockedOf(g, p) {
  if (p.type === 'furn') {
    if (!katOf(p.k)) return 'Slut i lager.';
    return Array.isArray(g.storage) && g.storage.length >= (GAME.MAX_STORAGE ?? 80) ? 'Förrådet är fullt – möblera hemma först!' : null;
  }
  if (p.type === 'gadget') {
    if (!gadgetOf(p.id) || typeof g.buyGadget !== 'function') return 'Kommer snart – leveransen är försenad!';
    if (Array.isArray(g.gadgets) && g.gadgets.includes(p.id)) return 'Den har du redan!';
    return null;
  }
  if (!sortimentHP() || typeof g.buyClothes !== 'function') return 'Slut i lager.';
  return g.clothesLocked?.('phones', true) ? null : 'Du har redan hörlurar – ta på dem i garderoben hemma!';
}

// ================= TV-bilderna (samma bild på alla skärmar) =================
// Varje program är en funktion av (u, v) i 0–1 över skärmen, tiden t och pixeln (x, y) för
// dithring – en stor och en liten TV visar därför SAMMA bild, bara i olika upplösning.
const PROGS = ['hav', 'fotboll', 'rymd', 'reklam'];
const PROG_SECS = 8, STATIC_SECS = 0.28;
const progAt = (t) => PROGS[Math.floor(t / PROG_SECS) % PROGS.length];
const BOLT_POLY = [[0.56, 0.1], [0.36, 0.54], [0.5, 0.54], [0.42, 0.92], [0.68, 0.42], [0.53, 0.42], [0.64, 0.1]];
function inPoly(poly, u, v) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function progPixel(prog, u, v, t, x, y, w, h) {
  const dith = (bayer(x, y) - 0.5) * 0.14;
  if (prog === 'hav') {
    const hz = 0.56;
    if (v < hz) {
      let c = mix(0x2a1f66, 0xf07a3a, Math.pow(v / hz, 1.3) + dith);
      const d = Math.hypot((u - 0.5) * 1.78, v - (hz - 0.01));
      if (d < 0.2) c = d < 0.13 ? 0xfff2a8 : 0xffc85a;
      else if (d < 0.26) c = mix(c, 0xffb050, 0.4);
      // en segelbåt glider förbi
      const bx = ((t * 0.04) % 1.3) - 0.15, sv = hz - 0.03 - v;
      if (sv > 0 && sv < 0.2 && u > bx - 0.002 && u < bx + sv * 0.35) c = 0x241a2e;
      // måsar
      const mx = ((t * 0.07 + 0.4) % 1.2) - 0.1, my = 0.18 + Math.sin(t * 0.5) * 0.04;
      if (Math.abs(v - my - Math.abs(u - mx) * 0.9) < 0.5 / h && Math.abs(u - mx) < 0.035) c = 0x2a1a30;
      return c;
    }
    const k = (v - hz) / (1 - hz);
    let c = mix(0x2a3a8a, 0x0e1840, k + dith);
    const bx = ((t * 0.04) % 1.3) - 0.15;
    if (v < hz + 0.05 && u > bx - 0.05 && u < bx + 0.08) c = 0x1a1224; // skrovet och dess skugga
    if (Math.abs(u - 0.5) < 0.04 + k * 0.14 && (Math.floor(v * 40 + t * 3) + Math.floor(u * 22)) % 3 === 0) c = mix(c, 0xffc860, 0.85 - k * 0.4);
    if (Math.sin(u * 28 + v * 80 - t * 2.2) > 0.93) c = mix(c, 0x6a8ad8, 0.5);
    return c;
  }
  if (prog === 'fotboll') {
    let c = (Math.floor(u * 10) % 2) ? 0x3a9a44 : 0x2f8a3a;
    const px = u * w, py = v * h;
    const line = (a, b) => Math.abs(a - b) < 0.55;
    if (line(px, 1.5) || line(px, w - 1.5) || line(py, 1.5) || line(py, h - 1.5) || line(px, w / 2)) c = 0xe8f0e0;
    const cr = Math.hypot((u - 0.5) * w, (v - 0.5) * h);
    if (Math.abs(cr - h * 0.22) < 0.55) c = 0xe8f0e0;
    if ((u < 0.12 || u > 0.88) && v > 0.3 && v < 0.7 && (line(px, w * 0.12) || line(px, w * 0.88) || line(py, h * 0.3) || line(py, h * 0.7))) c = 0xe8f0e0;
    // spelarna och bollen
    for (let i = 0; i < 8; i++) {
      const ux = 0.12 + 0.76 * ((hash(i, 1, 55) + 0.1 * Math.sin(t * (0.6 + i * 0.07) + i)) % 1);
      const vy = 0.15 + 0.7 * ((hash(i, 2, 55) + 0.12 * Math.cos(t * (0.5 + i * 0.05) + i * 2)) % 1);
      if (Math.abs((u - ux) * w) < 0.9 && Math.abs((v - vy) * h) < 1.3) c = i < 4 ? 0xe83a3a : 0x3a6ae8;
    }
    const bu = 0.5 + 0.3 * Math.sin(t * 0.9), bv = 0.5 + 0.28 * Math.sin(t * 1.3 + 1);
    if (Math.abs((u - bu) * w) < 0.8 && Math.abs((v - bv) * h) < 0.8) c = 0xffffff;
    return c;
  }
  if (prog === 'rymd') {
    let c = mix(0x05060f, 0x161c40, v + dith);
    const sx = Math.floor(u * 64), sy = Math.floor(v * 36), hs = hash(sx, sy, 71);
    if (hs > 0.955) c = mix(0x8890b0, 0xffffff, 0.5 + 0.5 * Math.sin(t * 3 + hs * 40));
    // planeten med ring
    const pu = (u - 0.36) * 1.78, pv = v - 0.5, pd = Math.hypot(pu, pv);
    const ring = Math.abs(Math.hypot(pu / 0.4, pv / 0.09) - 1) < 0.16;
    if (ring && pv < 0 && pd < 0.22) { /* ringen bakom planeten */ }
    if (pd < 0.22) {
      const band = Math.floor((pv + 0.3) * 18) % 3;
      c = [0xe8a060, 0xc87840, 0xf0c890][band];
      if (pu > 0.08) c = mul(c, 0.65);
    }
    if (ring && (pv >= 0 || pd >= 0.22)) c = 0xd8c8a8;
    // raketen
    const k = (t * 0.07) % 1, ru = k * 1.4 - 0.2, rv = 0.85 - k * 0.7;
    const du = (u - ru) * w, dv = (v - rv) * h;
    if (Math.abs(du) < 1.2 && Math.abs(dv) < 0.8) c = 0xf4f4f8;
    else if (du < -1 && du > -3.5 && Math.abs(dv + du * 0.3) < 0.9) c = Math.sin(t * 30) > 0 ? 0xffa030 : 0xff5020;
    return c;
  }
  // reklam: diagonala ränder i blått och en stor gul blixt
  let c = ((u * 1.78 + v) * 3 - t * 0.6) % 1 < 0.5 ? NAVY : NAVY2;
  if (c === NAVY2 && ((u * 1.78 + v) * 3 - t * 0.6) % 1 > 0.9) c = mix(NAVY2, CYAN, 0.35);
  if (inPoly(BOLT_POLY, u, v)) c = (Math.floor(t * 2) % 4 === 0) ? 0xfff2a0 : YEL;
  return c;
}
// en skärm som ritas om i live(): { w, h, cv, ctx, img, prog }
function makeScreen(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  return { w, h, cv, ctx: cx, img: cx.createImageData(w, h), key: '' };
}
function renderScreen(S, prog, t, pixel = progPixel) {
  const { w, h, img } = S, d = img.data;
  const noise = prog === 'brus';
  let i = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const c = noise ? (hash(x, y, Math.floor(t * 30)) > 0.5 ? mix(0x9a9aa4, 0xf4f4f8, hash(y, x, 3)) : mix(0x18181e, 0x5a5a64, hash(x + 3, y, 5))) : pixel(prog, (x + 0.5) / w, (y + 0.5) / h, t, x, y, w, h);
    d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255;
  }
  // reklamen: "BLIXT" längst ner när skärmen är stor nog
  if (prog === 'reklam' && w >= 30 && h >= 18) {
    const s = 'BLIXT', tw = textW(SMALL, s), x0 = Math.round((w - tw) / 2), y0 = h - 7;
    eachTextPixel(SMALL, s, x0, y0, 1, (px, py) => { if (px >= 0 && py >= 0 && px < w && py < h) { const k = (py * w + px) * 4; d[k] = 255; d[k + 1] = 255; d[k + 2] = 255; } });
  }
  S.ctx.putImageData(img, 0, 0);
}
// spelkonsolens TV: bilspel (vägen kurvar, mittlinjen rusar mot en)
function racePixel(_p, u, v, t, x, y, w, h) {
  const hz = 0.42;
  if (v < hz) {
    let c = mix(0x5ab0ff, 0xc8e8ff, v / hz + (bayer(x, y) - 0.5) * 0.2);
    const m = 0.3 + 0.08 * Math.sin(u * 9 + 1) + 0.05 * Math.sin(u * 23);
    if (v > m * hz + hz * 0.45) c = 0x6a7aa8;
    return c;
  }
  const k = (v - hz) / (1 - hz), z = 1 / (k + 0.06);
  const curve = Math.sin(t * 0.7) * 0.22 * (1 - k) * (1 - k);
  const hw = 0.06 + k * 0.44, du = Math.abs(u - 0.5 - curve);
  const stripe = ((z * 0.9 + t * 3.2) % 1) < 0.5;
  if (du < hw) {
    if (du > hw * 0.86) return stripe ? 0xe83a3a : 0xf4f4f4;
    if (du < 0.012 + k * 0.012 && stripe) return 0xf4f0d8;
    return stripe ? 0x55555e : 0x4c4c55;
  }
  return stripe ? 0x46a846 : 0x3c963c;
}
// bilen i bilspelet (ritas ovanpå, längst ner i mitten)
const CAR = ['..rr..', '.rwwr.', 'rrrrrr', 'k.rr.k'];
// kartongskyltens skärm: Päronfon-reklam (rosa/lila och ett grönt päron)
function paronPixel(_p, u, v, t, x, y) {
  let c = mix(0xff6ab8, 0x7a3ae0, v + (bayer(x, y) - 0.5) * 0.18 + 0.15 * Math.sin(t * 0.8 + u * 3));
  const pu = (u - 0.5) * 1.1, pv = v - 0.52;
  const body = Math.hypot(pu / 0.3, (pv - 0.08) / 0.2) < 1 || Math.hypot(pu / 0.18, (pv + 0.1) / 0.16) < 1;
  if (body) c = pu < -0.06 ? 0x8ae05a : pu > 0.12 ? 0x3a9a3a : 0x5ac84a;
  if (Math.abs(pu - 0.02) < 0.04 && pv < -0.24 && pv > -0.32) c = 0x6a4a2a; // skaftet
  if (Math.hypot(pu - 0.1, pv + 0.29) < 0.06) c = 0x3ab04a;                   // bladet
  return c;
}

// ================= bakgrundsbilder på telefonernas och plattornas skärmar =================
const WPS = ['appar', 'fjall', 'hav', 'chatt', 'spel', 'karta'];
function wpPixel(k, u, v, x, y, w, h) {
  const dith = (bayer(x, y) - 0.5) * 0.18;
  switch (k) {
    case 'appar': {
      let c = mix(0x7a3ae0, 0x2a8af0, v * 0.9 + dith);
      const cols = w >= 12 ? 4 : 2, rows = h >= 18 ? 5 : h >= 8 ? 3 : 2;
      const gu = ((u - 0.1) / 0.8) * cols, gv = ((v - 0.14) / 0.64) * rows;
      if (gu >= 0 && gv >= 0 && gu < cols && gv < rows && gu % 1 < 0.64 && gv % 1 < 0.64) c = APPS[(Math.floor(gu) + Math.floor(gv) * 3) % APPS.length];
      if (v > 0.84) { c = mix(c, 0xffffff, 0.3); const du = (u - 0.1) / 0.8 * cols; if (du >= 0 && du < cols && du % 1 < 0.6 && v > 0.87 && v < 0.96) c = APPS[(Math.floor(du) + 5) % APPS.length]; }
      return c;
    }
    case 'fjall': {
      let c = mix(0x6ab8f0, 0xd8f0ff, v * 1.6 + dith);
      const ridge = 0.34 + 0.22 * Math.abs(((u * 2.4 + 0.3) % 1) - 0.5) * 2;
      if (v > ridge) c = v < ridge + 0.07 ? 0xf4f8ff : mix(0x6a7a8a, 0x4a5a6a, (v - ridge) * 2 + dith);
      if (v > 0.74) c = mix(0x5ab04a, 0x3a8a3a, (v - 0.74) * 3 + dith);
      return c;
    }
    case 'hav': return progPixel('hav', u, v, 26, x, y, w, h);
    case 'chatt': {
      let c = 0xf2f2ee;
      const band = Math.floor(v * 5), f = (v * 5) % 1;
      if (f > 0.2 && f < 0.8) { if (band % 2 === 0 && u > 0.08 && u < 0.62) c = 0xd8d8e0; if (band % 2 === 1 && u > 0.38 && u < 0.92) c = 0x5ad86a; }
      if (v < 0.1) c = 0xe0e0e8;
      return c;
    }
    case 'spel': {
      let c = mix(0x1a1030, 0x2a1850, v + dith);
      const gx = Math.floor(u * 6), gy = Math.floor(v * 8);
      if (gy >= 5 && hash(gx, gy, 9) > 0.25) c = APPS[(gx * 3 + gy) % 7];
      if (gx === 3 && (gy === 1 || gy === 2)) c = 0xffc23a;
      return c;
    }
    default: { // karta
      let c = mix(0xe8dcc0, 0xe0d2b0, dith + 0.5);
      if (Math.hypot(u - 0.3, v - 0.35) < 0.18) c = 0x9ad07a;
      if (Math.abs(v - (0.2 + u * 0.7)) < 0.06) c = 0x6ab0f0;
      if (Math.abs(u - 0.62) < 0.03 || Math.abs(v - 0.7) < 0.03) c = 0xffffff;
      if (Math.hypot(u - 0.62, v - 0.42) < 0.08) c = 0xe83a3a;
      return c;
    }
  }
}
const wpCache = new Map();
function wallpaper(k, w, h) {
  const key = `${k}:${w}x${h}`;
  if (wpCache.has(key)) return wpCache.get(key);
  const P = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) P.px(x, y, wpPixel(k, (x + 0.5) / w, (y + 0.5) / h, x, y, w, h));
  const c = P.flush();
  wpCache.set(key, c);
  return c;
}

// ================= prylarnas utseende =================
// Butiksstorlek (på borden) och dialogstorlek (produktbladet). frame = ramens/baksidans färg.
const LOOKS = {
  fonmini: { kind: 'mobil', w: 6, h: 10, frame: 0x5ac8a0, back: 0x7ad8b0, cam: 1 },
  fon12: { kind: 'mobil', w: 7, h: 12, frame: 0x2a2c34, back: 0x30323c, cam: 2 },
  paronfon: { kind: 'mobil', w: 7, h: 13, frame: 0xc8bca8, back: 0xd8cfc0, cam: 3, island: true, pear: true },
  platta: { kind: 'platta', w: 17, h: 12, frame: 0x4a4e58, back: 0x6a6e78, cam: 1 },
  paronplatta: { kind: 'platta', w: 19, h: 13, frame: 0xd0d4da, back: 0xdde0e4, cam: 2, pear: true, pen: true },
};
// en pryl sedd framifrån (skärmen ritas separat) eller bakifrån, i Pix P med övre vänstra hörnet (x, y)
function paintDevice(P, L, x, y, back, big = false) {
  const w = big ? (L.kind === 'mobil' ? 24 : 52) : L.w, h = big ? (L.kind === 'mobil' ? 44 : 36) : L.h;
  const r = rampOf(back ? L.back : L.frame);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const corner = (i === 0 || i === w - 1) && (j === 0 || j === h - 1);
    if (corner) continue;
    let c = r[2];
    if (i === 0 || j === 0) c = r[3]; else if (i === w - 1 || j === h - 1) c = r[1];
    P.px(x + i, y + j, c);
  }
  if (!back) {
    // skärmens svarta kant (själva bilden läggs ovanpå)
    const b = big ? 2 : 1;
    for (let j = b; j < h - b; j++) for (let i = b; i < w - b; i++) P.px(x + i, y + j, 0x0c0e14);
    if (L.island && !big) P.px(x + (w >> 1), y + 1, 0x0c0e14);
    if (big && L.kind === 'mobil') for (let i = -2; i <= 2; i++) P.px(x + (w >> 1) + i, y + 4, 0x0c0e14);
    return;
  }
  // baksidan: kamerorna uppe till vänster och loggan
  const cx = x + (big ? 4 : 1), cy = y + (big ? 4 : 1);
  if (big) {
    sbox(P, cx - 1, cy - 1, L.cam >= 3 ? 12 : 9, L.cam >= 2 ? 12 : 7, mix(L.back, 0x000000, 0.12));
    const pos = [[0, 0], [5, 0], [0, 5], [5, 5]].slice(0, L.cam);
    for (const [dx, dy] of pos) { P.rect(cx + dx, cy + dy, 4, 4, 0x1a1c24); P.px(cx + dx + 1, cy + dy + 1, 0x5a6a9a); }
    if (L.pear) { // päronet mitt på
      const px = x + (w >> 1), py = y + (h >> 1);
      for (const [dx, dy] of [[-1, -1], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2]]) P.px(px + dx, py + dy, mul(L.back, 0.72));
      P.px(px, py - 3, 0x5a8a3a); P.px(px + 1, py - 3, 0x5a8a3a);
    } else txtC(P, SMALL, 'BLIXT', x + (w >> 1), y + (h >> 1), mul(L.back, 0.7));
  } else {
    P.px(cx, cy, 0x1a1c24); if (L.cam >= 2) P.px(cx, cy + 2, 0x1a1c24); if (L.cam >= 3) P.px(cx + 2, cy, 0x1a1c24);
    if (L.pear) P.px(x + (w >> 1), y + (h >> 1), mul(L.back, 0.7));
  }
}
// skärmytan på en pryl (relativt prylens hörn)
const screenOf = (L, big = false) => {
  const w = big ? (L.kind === 'mobil' ? 24 : 52) : L.w, h = big ? (L.kind === 'mobil' ? 44 : 36) : L.h, b = big ? 2 : 1;
  return { x: b, y: b, w: w - 2 * b, h: h - 2 * b };
};

// ================= bakgrunden =================
function paintCeiling(P) {
  for (let y = 0; y < CEIL; y++) for (let x = 0; x < W; x++) {
    let c = y < 2 ? 0x8a929e : mix(0xf2f4f7, 0xdfe3e9, (y - 2) / (CEIL - 2) + (bayer(x, y) - 0.5) * 0.15);
    if (y === CEIL - 1) c = 0xc2c8d0;
    P.px(x, y, c);
  }
  // LED-listerna i taket
  for (const [x0, x1] of [[18, 196], [226, 398], [432, 622]]) {
    P.hl(x0, 5, x1 - x0, 0xffffff); P.hl(x0, 6, x1 - x0, 0xf6fbff);
    P.hl(x0 - 1, 4, x1 - x0 + 2, 0xe8f2ff, 0.8); P.hl(x0, 7, x1 - x0, 0xdbe6f2, 0.8);
  }
  // spotlights
  for (let x = 30; x < W - 20; x += 46) { P.rect(x - 1, 9, 3, 1, 0x6a7280); P.px(x, 9, 0xfffbe0); }
}
function paintTvWall(P) {
  const { x0, x1 } = TVW;
  for (let y = CEIL; y < WALL_Y; y++) for (let x = x0; x < x1; x++) {
    let c = mix(0x3a4256, 0x232838, (y - CEIL) / (WALL_Y - CEIL) + (bayer(x, y) - 0.5) * 0.18);
    if ((x - x0) % 40 === 0) c = mul(c, 0.82);
    if (y < CEIL + 3) c = mix(c, 0xf0f4ff, 0.25 * (1 - (y - CEIL) / 3)); // ljuset från LED-listen
    P.px(x, y, c);
  }
  P.vl(x1 - 1, CEIL, WALL_Y - CEIL, 0x14171f);
  // skärmarnas ramar och fästen
  for (const T of TVS) {
    P.rect(T.x - 3, T.y - 2, T.w + 6, T.h + 5, 0x14161c, 0.5); // skugga på väggen
    P.rect(T.x - 2, T.y - 2, T.w + 4, T.h + 4, 0x0c0d12);
    P.hl(T.x - 2, T.y - 2, T.w + 4, 0x3a3e4a); P.vl(T.x - 2, T.y - 1, T.h + 3, 0x2a2e38);
    P.rect(T.x, T.y, T.w, T.h, 0x101420);
    P.px(T.x + T.w, T.y + T.h + 1, 0xff4040); // standbylampan
    if (T.tag) {
      const tw = textW(SMALL, T.tag) + 4, tx = Math.round(T.x + T.w / 2 - tw / 2), ty = T.y + T.h + 4;
      if (ty + 8 <= WALL_Y) { P.rect(tx, ty, tw, 8, 0xf4f6fa); P.hl(tx, ty, tw, CYAN); txt(P, SMALL, T.tag, tx + 2, ty + 2, NAVY); }
    }
  }
}
// utsikten genom glasfasaden: finanskvarterets skyskrapor på andra sidan gatan
const BUILDINGS = [
  { x0: 206, x1: 240, top: 21, c: 0x3a7a8a, kind: 'glas' },
  { x0: 241, x1: 285, top: 30, c: 0xd8d0bc, kind: 'sten' },
  { x0: 286, x1: 336, top: 21, c: 0x2a3a5a, kind: 'torn' },
  { x0: 337, x1: 372, top: 34, c: 0xc89a6a, kind: 'kontor' },
  { x0: 373, x1: 418, top: 21, c: 0x4a7ab8, kind: 'glas' },
];
function paintOutside(P, night) {
  const { x0, x1, top } = GLASS;
  // himlen
  for (let y = top; y < 56; y++) for (let x = x0; x < x1; x++) P.px(x, y, night ? mix(0x0a1030, 0x1e2a58, (y - top) / 35 + (bayer(x, y) - 0.5) * 0.2) : mix(0x7ec0f0, 0xd2ecfa, (y - top) / 35 + (bayer(x, y) - 0.5) * 0.2));
  // husen
  for (const B of BUILDINGS) {
    const base = 56;
    for (let y = B.top; y < base; y++) for (let x = B.x0; x < B.x1; x++) {
      const lx = x - B.x0, ly = y - B.top, bw = B.x1 - B.x0;
      let c = B.c;
      if (B.kind === 'glas' || B.kind === 'torn') {
        const cell = lx % 5 === 0 || ly % 4 === 0;
        c = cell ? mul(B.c, 0.7) : mix(B.c, night ? 0x10182a : 0xbfe0ff, night ? 0.5 : (0.15 + 0.35 * (((lx + ly) % 11) < 3 ? 1 : 0)));
        if (night && !cell && hash(Math.floor(lx / 5), Math.floor(ly / 4), B.x0) > 0.55) c = hash(lx, B.x0, 3) > 0.5 ? 0xffe08a : 0xa8d8ff;
      } else if (B.kind === 'sten') {
        c = mix(B.c, 0xb8ae98, (lx % 6 < 2 ? 0.4 : 0) + (bayer(x, y) - 0.5) * 0.15);
        if (ly < 4) c = mix(B.c, 0xffffff, 0.2);               // taklisten
        else if (ly === 4) c = mul(B.c, 0.6);
        else if (lx % 6 === 3 || lx % 6 === 4) c = night ? (hash(lx, ly >> 2, 7) > 0.5 ? 0xffd880 : 0x2a2a38) : 0x4a5468; // fönsterrader mellan pelarna
        if (ly > 18) c = lx % 6 < 2 ? 0xe8e0cc : mul(B.c, 0.75); // pelarna nedtill
      } else {
        const win = lx % 4 !== 0 && ly % 5 > 1;
        c = win ? (night ? (hash(lx >> 2, ly, B.x0) > 0.5 ? 0xffd070 : 0x2a2a3a) : mix(0x5a6a80, 0xa0c0e0, (lx % 4) / 4)) : mix(B.c, 0x8a5a3a, (bayer(x, y) - 0.5) * 0.3 + 0.2);
      }
      if (lx === 0) c = mul(c, 0.8); if (lx === bw - 1) c = mul(c, 0.7);
      P.px(x, y, night ? mix(c, 0x080c1c, B.kind === 'sten' ? 0.35 : 0.2) : c);
    }
  }
  // tickerns svarta band (texten rullar i live())
  P.rect(TICKER.x0 - 1, TICKER.y - 1, TICKER.x1 - TICKER.x0 + 2, TICKER.h + 2, 0x08080c);
  // bortre trottoaren, gatan, närmaste trottoaren
  for (let x = x0; x < x1; x++) {
    for (let y = 56; y < 59; y++) P.px(x, y, night ? 0x4a4c58 : 0xb8b8b0);
    for (let y = 59; y < 67; y++) P.px(x, y, night ? 0x1e2028 : mix(0x4a4c54, 0x42444c, (bayer(x, y) - 0.5) + 0.5));
    if ((x >> 2) % 3 < 2) P.px(x, 63, night ? 0x8a8a78 : 0xe8e8d8);
    P.px(x, 67, night ? 0x3a3a40 : 0x8a8a84);
    for (let y = 68; y < WALL_Y; y++) P.px(x, y, night ? mix(0x3a3c48, 0x30323c, (bayer(x, y))) : mix(0xcac6bc, 0xbeb9ae, (x % 12 === 0 || (y - 68) % 4 === 0) ? 1 : bayer(x, y) * 0.4));
  }
  // gatlyktor
  for (const lx of [252, 382]) {
    P.vl(lx, 36, 32, 0x2a2e36); P.rect(lx - 3, 35, 7, 2, 0x2a2e36);
    P.rect(lx - 2, 37, 5, 1, night ? 0xfff0b0 : 0xd8dce0);
    if (night) for (let r = 1; r < 6; r++) for (let dx = -r; dx <= r; dx++) P.px(lx + dx, 37 + r, 0xfff0b0, 0.12);
  }
}
function paintKassaWall(P) {
  const { x0, x1 } = KW;
  for (let y = CEIL; y < WALL_Y; y++) for (let x = x0; x < x1; x++) P.px(x, y, mix(0xf4f5f7, 0xe4e7ec, (y - CEIL) / (WALL_Y - CEIL) + (bayer(x, y) - 0.5) * 0.1));
  // loggan på en marinblå skylt
  const lx = 430, ly = 16, lw = 88, lh = 25;
  sbox(P, lx, ly, lw, lh, NAVY);
  P.rect(lx + 1, ly + lh - 3, lw - 2, 1, CYAN);
  bolt(P, lx + 6, ly + 5, YEL, 0x000000);
  bolt(P, lx + 10, ly + 8, YEL);
  eachTextPixel(BIG, 'BLIXT', lx + 20, ly + 4, 1, (px, py) => { P.px(px, py, 0xffffff); P.px(px + 1, py + 1, 0x0a1230, 0.8); });
  txt(P, SMALL, 'ELEKTRONIK', lx + 20, ly + 14, CYAN);
  // hyllorna bakom disken med varulådor
  for (const sy of [52, 66]) {
    P.rect(x0 + 8, sy, x1 - x0 - 16, 2, OAK[3]); P.hl(x0 + 8, sy + 2, x1 - x0 - 16, OAK[0]);
    let x = x0 + 10, i = 0;
    while (x < x1 - 14) {
      const wide = hash(i, sy, 21) > 0.62, bw = wide ? 11 : 6, bh = wide ? 8 : 10;
      const col = [0xffffff, 0x2a2c34, 0xf4f4f0, NAVY, 0xe8e8ec][Math.floor(hash(i, sy, 22) * 5)];
      sbox(P, x, sy - bh, bw, bh, col);
      P.rect(x + 2, sy - bh + 2, bw - 4, Math.max(2, bh - 5), APPS[(i * 3 + sy) % APPS.length]); // bilden på kartongen
      x += bw + 1 + (hash(i, sy, 23) > 0.8 ? 3 : 0); i++;
    }
  }
}
// hörlurar som hänger: 9×9
const HP_MAP = ['..kkkkk..', '.k.....k.', 'k.......k', 'k.......k', 'kk.....kk', 'ccc...ccc', 'cCc...cCc', 'ccc...ccc', '.c.....c.'];
const HP_COLS = [0x2a2c34, 0xf4f4f0, 0xe83a3a, CYAN, 0xff6ab8, YEL, 0x4ad86a, 0x8e5bd1];
function paintHeadphones(P, x, y, col, band = 0x1c1e24) {
  const r = rampOf(col);
  HP_MAP.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === 'k') P.px(x + i, y + j, band); else if (ch === 'c') P.px(x + i, y + j, r[2]); else if (ch === 'C') P.px(x + i, y + j, r[4]); } });
}
function paintPegboard(P) {
  const { x0, x1 } = PEG;
  for (let y = CEIL; y < WALL_Y; y++) for (let x = x0; x < x1; x++) {
    let c = mix(0xe6d2a8, 0xd4bc8c, (y - CEIL) / (WALL_Y - CEIL) + (bayer(x, y) - 0.5) * 0.14);
    if ((x - x0) % 4 === 2 && (y - CEIL) % 4 === 2) c = 0xa88c60;
    P.px(x, y, c);
  }
  P.vl(x0, CEIL, WALL_Y - CEIL, 0xb89e74);
  // skylten HÖRLURAR
  const s = 'HÖRLURAR', tw = textW(SMALL, s) + 10, sx = Math.round((x0 + x1) / 2 - tw / 2);
  sbox(P, sx, 15, tw, 10, 0xffffff); txt(P, SMALL, s, sx + 5, 18, NAVY); P.hl(sx + 1, 23, tw - 2, CYAN);
  // tre rader hörlurar på krokar
  let i = 0;
  for (const ry of [30, 44, 58]) for (let x = x0 + 6; x < x1 - 10; x += 16) {
    P.vl(x + 4, ry - 3, 3, 0x8a8e96);
    paintHeadphones(P, x, ry, HP_COLS[(i * 3 + ry) % HP_COLS.length]);
    i++;
  }
}
function paintFloor(P, night) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = Math.floor(x / 32), ty = Math.floor((y - WALL_Y) / 16);
    let c = mix(0xe4e7ec, 0xd4d8df, hash(tx, ty, 31) * 0.55 + (bayer(x, y) - 0.5) * 0.12);
    if (x % 32 === 0 || (y - WALL_Y) % 16 === 0) c = 0xc3c9d2;
    const gl = ((x % 32) + ((y - WALL_Y) % 16) * 2) % 40; // blanka strimmor
    if (gl < 2 && hash(tx, ty, 33) > 0.45) c = mix(c, 0xffffff, 0.4);
    P.px(x, y, night ? mix(c, 0xb8c0d0, 0.15) : c);
  }
  // ljuset från glasfasaden faller in över golvet (på kvällen: gatans blå sken)
  for (let y = WALL_Y; y < WALL_Y + 44; y++) for (let x = GLASS.x0 - 10; x < GLASS.x1 + 10; x++) {
    const k = (1 - (y - WALL_Y) / 44) * Math.min(1, Math.min(x - GLASS.x0 + 10, GLASS.x1 + 10 - x) / 16);
    if (k > 0 && bayer(x, y) < k * 0.8) P.px(x, y, night ? 0x6a8ad8 : 0xffffff, night ? 0.12 : 0.3 * k);
  }
  // TV-väggens färgsken på golvet
  for (let y = WALL_Y; y < WALL_Y + 18; y++) for (let x = TVW.x0; x < TVW.x1; x++) if (bayer(x, y) < 0.5 * (1 - (y - WALL_Y) / 18)) P.px(x, y, 0x8aa8ff, 0.08);
  // fotlist
  P.hl(0, WALL_Y - 1, W, 0xb0b8c4); P.hl(0, WALL_Y, W, 0xc8ced8);
  // entrémattan innanför dörren: marinblå med en gul blixt
  const mx0 = DOOR.x0 - 6, mx1 = DOOR.x1 + 6, my0 = WALL_Y + 2, my1 = WALL_Y + 16;
  for (let y = my0; y < my1; y++) for (let x = mx0; x < mx1; x++) {
    const edge = x === mx0 || x === mx1 - 1 || y === my0 || y === my1 - 1;
    P.px(x, y, edge ? 0x10183a : ((x + y) % 3 === 0 ? mul(NAVY, 0.85) : NAVY));
  }
  bolt(P, DOOR_X - 2, my0 + 4, YEL);
}
function paintSides(P) {
  for (let y = 0; y < H; y++) for (let x = 0; x < SIDE; x++) {
    const c = mix(0xd0d6de, 0xa8b0bc, x / SIDE + (bayer(x, y) - 0.5) * 0.1);
    P.px(x, y, c); P.px(W - 1 - x, y, mix(0xd0d6de, 0xa8b0bc, x / SIDE));
  }
  P.vl(SIDE, CEIL, H - CEIL, 0x9aa2ae); P.vl(W - SIDE - 1, CEIL, H - CEIL, 0x9aa2ae);
}
function paintBackground(night) {
  const P = new Pix(W, H);
  paintFloor(P, night);
  paintCeiling(P);
  paintTvWall(P);
  paintOutside(P, night);
  paintKassaWall(P);
  paintPegboard(P);
  // golvskuggor under inredningen
  shade(P, (TVB.x0 + TVB.x1) / 2, TVB.base, (TVB.x1 - TVB.x0) / 2 + 2, 4);
  shade(P, (CNT.x0 + CNT.x1) / 2, CNT.base, (CNT.x1 - CNT.x0) / 2 + 3, 5);
  shade(P, (HPT.x0 + HPT.x1) / 2, HPT.base, (HPT.x1 - HPT.x0) / 2 + 2, 4);
  shade(P, (CON.x0 + CON.x1) / 2, CON.base, (CON.x1 - CON.x0) / 2 + 3, 5);
  shade(P, (RET.x0 + RET.x1) / 2, RET.base, (RET.x1 - RET.x0) / 2 + 3, 5);
  for (const T of [PT, TT]) shade(P, (T.x0 + T.x1) / 2, T.base, (T.x1 - T.x0) / 2 + 4, 6);
  for (const D of GD) shade(P, D.x0 + GD_W / 2, GD_BASE, GD_W / 2 + 2, 5);
  shade(P, (CD.x0 + CD.x1) / 2, CD.base, (CD.x1 - CD.x0) / 2 + 3, 5);
  shade(P, (LT.x0 + LT.x1) / 2, LT.base, (LT.x1 - LT.x0) / 2 + 3, 5);
  shade(P, STD.x + STD.w / 2, STD.base, STD.w / 2 + 3, 4);
  shade(P, (ISL.x0 + ISL.x1) / 2, ISL.base, (ISL.x1 - ISL.x0) / 2 + 3, 5);
  shade(P, AF.x + AF.w / 2, AF.base, AF.w / 2, 3, 0.2);
  for (const p of PLANTS) shade(P, p.x + 8, p.base, 10, 3);
  paintSides(P);
  return P.flush();
}
// glasfasaden framför utsikten: karmar, blå ton, reflexer och BLIXT baklänges på rutan
function paintGlass(night) {
  return sprite(GLASS.x0, CEIL, GLASS.x1 - GLASS.x0, WALL_Y - CEIL, (P) => {
    const { x0, x1, top } = GLASS;
    // överkarmen med UT-skylten
    for (let y = CEIL; y < top; y++) for (let x = x0; x < x1; x++) P.px(x, y, mix(0xc8d0da, 0x9aa4b0, (y - CEIL) / (top - CEIL)));
    P.hl(x0, top - 1, x1 - x0, 0x6a7482);
    const ux = DOOR_X - 8;
    P.rect(ux, CEIL + 1, 17, 7, 0x1d6a3a); P.hl(ux, CEIL + 1, 17, 0x3aa85a); txt(P, SMALL, 'UT', ux + 5, CEIL + 2, 0xeaffea);
    // rutorna: blå ton och reflexer (inte där dörrarna glider – de ritas i live())
    for (let y = top; y < WALL_Y - 2; y++) for (let x = x0; x < x1; x++) {
      if (x >= DOOR.x0 && x < DOOR.x1) continue;
      P.px(x, y, night ? 0x1a2a4a : 0x9adcf0, night ? 0.18 : 0.14);
    }
    glare(P, x0, top, DOOR.x0 - x0, WALL_Y - 2 - top, night ? 0.08 : 0.2, 19, 1);
    glare(P, DOOR.x1, top, x1 - DOOR.x1, WALL_Y - 2 - top, night ? 0.08 : 0.2, 19, 3);
    // BLIXT baklänges på rutan till höger om dörren (man läser den inifrån)
    const s = 'BLIXT', tw = textW(BIG, s), bx = 356, by = 44;
    eachTextPixel(BIG, s, 0, 0, 1, (px, py) => P.px(bx + tw - 1 - px, by + py, 0xffffff, 0.85));
    const s2 = 'ÖPPET 9-21', tw2 = textW(SMALL, s2), sx2 = 234;
    eachTextPixel(SMALL, s2, 0, 0, 1, (px, py) => P.px(sx2 + tw2 - 1 - px, 50 + py, 0xffffff, 0.75));
    // karmarna
    for (const mx of [x0, 250, DOOR.x0 - 2, DOOR.x1, 374, x1 - 2]) { P.rect(mx, top, 2, WALL_Y - top, 0xaab2bc); P.vl(mx, top, WALL_Y - top, 0xd8dee6); }
    P.rect(x0, WALL_Y - 3, x1 - x0, 3, 0x8a929e); P.hl(x0, WALL_Y - 3, x1 - x0, 0xc8d0da);
  });
}
// en skjutdörr (glas i ram), w × h
function paintDoorPanel(night) {
  const w = (DOOR.x1 - DOOR.x0) / 2, h = WALL_Y - 3 - GLASS.top;
  const P = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = night ? 0.2 : 0.16, c = night ? 0x1a2a4a : 0x9adcf0;
    if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) { c = 0x9aa4b0; a = 1; }
    P.px(x, y, c, a);
  }
  glare(P, 1, 1, w - 2, h - 2, night ? 0.1 : 0.24, 13, 2);
  for (let x = 3; x < w - 3; x += 3) P.px(x, 30, 0xffffff, 0.8); // säkerhetsprickarna
  return P.flush();
}

// ================= inredningen (förmålade bilder) =================
function paintBench() {
  return sprite(TVB.x0, TVB.base - 24, TVB.x1 - TVB.x0, 25, (P) => {
    const { x0, x1, base } = TVB, top = base - 12;
    for (let x = x0; x < x1; x++) { P.px(x, top, WHITE[4]); P.px(x, top + 1, WHITE[3]); P.px(x, top + 2, WHITE[3]); }
    for (let y = top + 3; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : mix(WHITE[2], WHITE[1], (y - top - 3) / 9));
    P.hl(x0, base - 1, x1 - x0, WHITE[0]);
    for (let x = x0 + 30; x < x1; x += 46) P.vl(x, top + 4, 7, WHITE[1]); // lådfronter
    txt(P, SMALL, 'TV OCH BILD', x0 + 4, top + 5, NAVY);
    // prisskylt: tältkort på bänken
    const pt = 'PLATT-TV ' + priceTxt(katOf('tv')?.price), pw = textW(SMALL, pt) + 6, px = x0 + 111;
    sbox(P, px, top - 7, pw, 8, 0xffffff); P.hl(px + 1, top - 6, pw - 2, CYAN); txt(P, SMALL, pt, px + 3, top - 5, NAVY);
    // soundbar, en subwoofer och fjärrkontroller
    P.rect(x0 + 58, top - 3, 50, 3, 0x1a1c22); P.hl(x0 + 58, top - 3, 50, 0x3a3e48); for (let x = x0 + 60; x < x0 + 106; x += 2) P.px(x, top - 2, 0x2a2c34);
    sbox(P, x0 + 10, top - 9, 9, 9, 0x2a2c34); P.px(x0 + 14, top - 5, 0x5a5e6a); P.px(x0 + 14, top - 7, 0x8a8e96);
    P.rect(x0 + 174, top - 1, 6, 1, 0x2a2c34); P.rect(x0 + 181, top - 1, 6, 1, 0x3a3c44);
  });
}
function paintCounter() {
  return sprite(CNT.x0 - 4, CNT.top - 12, CNT.x1 - CNT.x0 + 8, CNT.base - CNT.top + 13, (P) => {
    const { x0, x1, top, base } = CNT;
    // toppen (vit sten), fronten marinblå med KASSA och en blixt
    for (let y = top; y < top + 6; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? 0xffffff : mix(0xf2f2ee, 0xe0e0dc, (y - top) / 6 + (bayer(x, y) - 0.5) * 0.2));
    for (let y = top + 6; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? NAVY2 : x === x1 - 1 ? mul(NAVY, 0.7) : mix(NAVY, mul(NAVY, 0.8), (y - top - 6) / (base - top - 6)));
    P.hl(x0, top + 6, x1 - x0, CYAN); P.hl(x0, base - 1, x1 - x0, 0x0e1430);
    bolt(P, x0 + 8, top + 9, YEL);
    txt(P, BIG, 'KASSA', x0 + 16, top + 9, YEL);
    // kortterminalen och kunddisplayen (summan skrivs i live())
    sbox(P, 494, top - 5, 7, 6, 0x2a2c34); P.rect(495, top - 4, 5, 2, 0x5ad8ff);
    sbox(P, 446, top - 9, 18, 9, 0x2a2c34); P.rect(447, top - 8, 16, 6, 0x0a2a1a); P.vl(454, top - 1, 1, 0x2a2c34);
    // kassar med blixten i ett ställ till vänster
    for (let i = 0; i < 3; i++) { sbox(P, x0 - 3 + i * 3, top - 9 + i, 7, 9, NAVY); bolt(P, x0 - 1 + i * 3, top - 7 + i, YEL); }
  });
}
function paintHpTable() {
  return sprite(HPT.x0, HPT.base - 26, HPT.x1 - HPT.x0, 27, (P) => {
    const { x0, x1, base } = HPT, top = base - 12;
    for (let x = x0; x < x1; x++) { P.px(x, top, 0xffffff); P.px(x, top + 1, WHITE[3]); P.px(x, top + 2, WHITE[3]); }
    for (let y = top + 3; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : WHITE[2]);
    P.hl(x0, base - 1, x1 - x0, WHITE[0]);
    txt(P, SMALL, 'LYSSNA', x0 + 4, top + 5, NAVY);
    const hs = sortimentHP(), pt = priceTxt(hs?.price), pw = textW(SMALL, pt) + 6;
    sbox(P, x1 - pw - 4, top + 3, pw, 8, 0xffffff); P.hl(x1 - pw - 3, top + 4, pw - 2, CYAN); txt(P, SMALL, pt, x1 - pw - 1, top + 5, NAVY);
    // två hörlurar på ställ
    for (const [hx, col] of [[x0 + 12, 0x2a2c34], [x0 + 40, CYAN]]) {
      P.rect(hx + 3, top - 2, 3, 2, 0xd0d4da); P.vl(hx + 4, top - 12, 10, 0xb0b8c2);
      paintHeadphones(P, hx, top - 14, col);
    }
  });
}
function paintPodium() {
  return sprite(CON.x0, GAME_TV.y - 3, CON.x1 - CON.x0, CON.base - GAME_TV.y + 4, (P) => {
    const { x0, x1, base } = CON, top = base - 14;
    for (let y = top; y < top + 5; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? 0xffffff : mix(WHITE[4], WHITE[2], (y - top) / 5));
    for (let y = top + 5; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : mix(0x2a3c78, 0x1b2a5a, (y - top - 5) / 9));
    P.hl(x0, top + 5, x1 - x0, CYAN); P.hl(x0, base - 1, x1 - x0, 0x0e1430);
    // barnet står framför vänstra halvan – skylten och priset sitter till höger
    const pt = priceTxt(katOf('spelkonsol')?.price), pw = textW(SMALL, pt) + 4;
    txt(P, SMALL, 'KONSOLER', x1 - pw - 8 - textW(SMALL, 'KONSOLER'), top + 7, 0xffffff);
    P.rect(x1 - pw - 4, top + 6, pw, 7, 0xffffff); txt(P, SMALL, pt, x1 - pw - 2, top + 7, NAVY);
    // TV:n på sin fot (bilden ritas i live())
    const T = GAME_TV;
    P.rect(T.x - 2, T.y - 2, T.w + 4, T.h + 4, 0x0c0d12); P.hl(T.x - 2, T.y - 2, T.w + 4, 0x3a3e4a);
    P.rect(T.x + T.w / 2 - 2, T.y + T.h + 2, 4, top - T.y - T.h - 2, 0x2a2c34);
    P.rect(T.x + T.w / 2 - 8, top - 1, 16, 2, 0x2a2c34);
  });
}
function paintRetro() {
  return sprite(RET.x0, RET.base - 22, RET.x1 - RET.x0, 23, (P) => {
    const { x0, x1, base } = RET, top = base - 18;
    for (let y = top; y < top + 4; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? TEAK[4] : mix(TEAK[3], TEAK[2], (y - top) / 4 + (bayer(x, y) - 0.5) * 0.3));
    for (let y = top + 4; y < base; y++) for (let x = x0; x < x1; x++) {
      let c = mix(TEAK[2], TEAK[1], (y - top) / 18 + (((x * 7 + (y >> 2)) % 13) < 2 ? 0.3 : 0));
      if ((x - x0) % 28 === 0) c = TEAK[0];
      P.px(x, y, c);
    }
    P.hl(x0, base - 1, x1 - x0, TEAK[0]);
    for (let x = x0 + 14; x < x1; x += 28) P.rect(x, top + 12, 2, 2, 0xd8b060); // knoppar
    txt(P, SMALL, 'RETRO', x0 + 4, top + 6, 0xffb04a);
    const lo = [katOf('telefon')?.price, katOf('retrotv')?.price].filter((x) => x != null);
    const pt = `FRÅN ${priceTxt(lo.length ? Math.min(...lo) : null)}`, pw = textW(SMALL, pt) + 4;
    P.rect(x0 + 30, top + 5, pw, 7, 0xf4ecd8); txt(P, SMALL, pt, x0 + 32, top + 6, TEAK[0]);
    // skivspelaren längst till höger
    sbox(P, x1 - 26, top - 5, 22, 6, TEAK[3]); P.rect(x1 - 23, top - 4, 10, 3, 0x1a1a20); P.px(x1 - 18, top - 3, 0xe83a3a); P.vl(x1 - 9, top - 5, 3, 0xd8dce2);
  });
}
// långborden: ljus ek på vita ben, kategori på framkanten, prylarna på små ställ
function paintTable(T, label, groups) {
  const top = T.base - 26;
  return sprite(T.x0, top - 18, T.x1 - T.x0, T.base - top + 19, (P) => {
    const { x0, x1, base } = T;
    for (let y = top; y < top + 12; y++) for (let x = x0; x < x1; x++) {
      let c = mix(OAK[4], OAK[2], (y - top) / 12 + (((x * 3 + y * 17) % 23) < 2 ? 0.2 : 0) + (bayer(x, y) - 0.5) * 0.1);
      if (y === top) c = OAK[4];
      P.px(x, y, c);
    }
    P.hl(x0, top + 12, x1 - x0, OAK[0]);
    for (let y = top + 13; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : mix(WHITE[3], WHITE[1], (y - top - 13) / 13));
    P.hl(x0 + 1, top + 13, x1 - x0 - 2, CYAN);
    P.hl(x0, base - 1, x1 - x0, WHITE[0]);
    txt(P, SMALL, label, x0 + 5, top + 17, NAVY);
    // prylarna: framsida (skärmen tänds i live()) och baksida, prislapp framför
    for (const G of groups) {
      const L = LOOKS[G.id];
      for (const u of G.units) {
        const sy = top + 7 - L.h; // står på bordet, en bit in
        P.rect(u.x + 1, top + 6, L.w - 2, 2, 0xe8ecf2); P.hl(u.x, top + 8, L.w, 0x9aa2ae, 0.6); // stället
        paintDevice(P, L, u.x, sy, u.back);
        if (L.pen && !u.back) { P.hl(u.x + 2, top + 9, 9, 0xf4f4f0); P.px(u.x + 11, top + 9, 0x8a8e96); }
      }
      // prislappen sitter på bordskanten under modellen
      const pt = priceTxt(gadgetOf(G.id)?.price), pw = textW(SMALL, pt) + 6, px = Math.round(G.cx - pw / 2);
      sbox(P, px, top + 15, pw, 9, 0xffffff); P.hl(px + 1, top + 16, pw - 2, gadgetOf(G.id) ? CYAN : 0xff9a3a); txt(P, SMALL, pt, px + 3, top + 18, NAVY);
    }
  });
}
// gamingbordet: svart med RGB-list (lyser i live()), riggen ur atlasen ritas ovanpå
function paintGamingDesk(D, i) {
  const top = GD_BASE - 20;
  return sprite(D.x0, top, GD_W, 21, (P) => {
    const x0 = D.x0, x1 = x0 + GD_W, base = GD_BASE;
    for (let y = top; y < top + 5; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? 0x4a4e5a : mix(0x2a2c34, 0x1c1e24, (y - top) / 5));
    for (let y = top + 5; y < base; y++) for (let x = x0; x < x1; x++) {
      const leg = x < x0 + 4 || x >= x1 - 4;
      if (y > top + 11 && !leg) continue; // under skivan syns golvet mellan benen
      P.px(x, y, leg ? (x === x0 || x === x1 - 1 ? 0x3a3e48 : 0x22242c) : 0x1c1e24);
    }
    P.hl(x0 + 4, top + 11, GD_W - 8, 0x14161a);
    // mittbordet: prislappen på fronten (vänstra bordet får GAMING i regnbågsljus i live())
    if (i === 1) { const pt = priceTxt(katOf('tv')?.price), pw = textW(SMALL, pt) + 4, px = x0 + ((GD_W - pw) >> 1); P.rect(px, top + 5, pw, 6, 0xffffff); txt(P, SMALL, pt, px + 2, top + 5, NAVY); }
  });
}
function paintCompDesk() {
  const top = CD.base - 20;
  return sprite(CD.x0, top, CD.x1 - CD.x0, 21, (P) => {
    const { x0, x1, base } = CD;
    for (let y = top; y < top + 5; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? 0xffffff : mix(WHITE[4], WHITE[2], (y - top) / 5));
    for (let y = top + 5; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : mix(WHITE[2], WHITE[1], (y - top - 5) / 15));
    P.hl(x0 + 1, top + 5, x1 - x0 - 2, CYAN); P.hl(x0, base - 1, x1 - x0, WHITE[0]);
    txt(P, SMALL, 'DATORER', x0 + 4, top + 8, NAVY);
    const cards = [['DATOR', katOf('dator')?.price, x0 + 40], ['TORN', katOf('datortorn')?.price, x0 + 94]];
    for (const [nm, pr, cx] of cards) {
      const pt = `${nm} ${priceTxt(pr)}`, pw = textW(SMALL, pt) + 6;
      sbox(P, cx, top + 7, pw, 8, 0xffffff); P.hl(cx + 1, top + 8, pw - 2, CYAN); txt(P, SMALL, pt, cx + 3, top + 9, NAVY);
    }
  });
}
function paintLaptopTable() {
  const top = LT.base - 20;
  return sprite(LT.x0, top, LT.x1 - LT.x0, 21, (P) => {
    const { x0, x1, base } = LT;
    for (let y = top; y < top + 5; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === top ? OAK[4] : mix(OAK[3], OAK[2], (y - top) / 5));
    for (let y = top + 5; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : mix(WHITE[2], WHITE[1], (y - top - 5) / 15));
    P.hl(x0 + 1, top + 5, x1 - x0 - 2, CYAN); P.hl(x0, base - 1, x1 - x0, WHITE[0]);
    // kategorin till vänster (som DATORER bredvid), priset i en lapp till höger
    txt(P, SMALL, 'BÄRBARA', x0 + 3, top + 8, NAVY);
    const pt = priceTxt(katOf('laptop')?.price), pw = textW(SMALL, pt) + 4, px = x1 - pw - 2;
    sbox(P, px, top + 7, pw, 8, 0xffffff); P.hl(px + 1, top + 8, pw - 2, CYAN); txt(P, SMALL, pt, px + 2, top + 9, NAVY);
  });
}
// PROVA-ÖN: vit ö med cyan LED-kant – smartklockor på små kuddar, högtalare och kameror.
// De säljs inte än (NYHETER): man provar dem – högtalaren spelar, kameran blixtrar.
// Skärmar och lampor ritas i live() (drawIsland).
const ISL_TOP = ISL.base - 20;
const WATCHES = [{ x: ISL.x0 + 5, band: 0x2a2c34 }, { x: ISL.x0 + 14, band: 0xff6ab8 }, { x: ISL.x0 + 23, band: 0x4ad86a }];
const SPK = { x: ISL.x0 + 36, w: 9, h: 16 };                 // den höga smarthögtalaren (LED-ringen överst)
const BOOM = { x: ISL.x0 + 47, w: 15, h: 9 };                // bärbar högtalare med två baselement
const CAMS = { x: ISL.x0 + 66 };                             // systemkameran på stativ + actionkameran
function paintIsland() {
  return sprite(ISL.x0 - 2, ISL_TOP - 22, ISL.x1 - ISL.x0 + 4, ISL.base - ISL_TOP + 23, (P) => {
    const { x0, x1, base } = ISL, top = ISL_TOP;
    // skivan (vit, lite rundad i hörnen) och fronten med LED-kant
    for (let y = top; y < top + 5; y++) for (let x = x0; x < x1; x++) {
      if ((x === x0 || x === x1 - 1) && y === top) continue;
      P.px(x, y, y === top ? 0xffffff : mix(WHITE[4], WHITE[2], (y - top) / 5));
    }
    for (let y = top + 5; y < base; y++) for (let x = x0; x < x1; x++) {
      if ((x === x0 || x === x1 - 1) && y === base - 1) continue;
      P.px(x, y, x === x0 ? WHITE[3] : x === x1 - 1 ? WHITE[0] : mix(WHITE[3], WHITE[1], (y - top - 5) / 15));
    }
    P.hl(x0 + 1, top + 5, x1 - x0 - 2, CYAN); P.hl(x0 + 1, base - 1, x1 - x0 - 2, WHITE[0]);
    txt(P, SMALL, 'NYHETER', x0 + 4, top + 9, NAVY);
    const pv = 'PROVA!', pw = textW(SMALL, pv) + 6, px = x1 - pw - 4;
    sbox(P, px, top + 8, pw, 8, 0xff6ab8); txt(P, SMALL, pv, px + 3, top + 10, 0xffffff);
    // smartklockorna: ett litet vitt ställ var, armbandet runt och urtavlan framåt
    for (const Wt of WATCHES) {
      const wx = Wt.x;
      sbox(P, wx, top - 4, 7, 4, 0xf4f6fa);                     // stället (en liten kudde)
      const br = rampOf(Wt.band);
      for (let j = 0; j < 3; j++) { P.rect(wx + 2, top - 13 + j, 3, 1, br[j === 0 ? 3 : 2]); P.rect(wx + 2, top - 5 + j - 1, 3, 1, br[1]); }
      sbox(P, wx + 1, top - 10, 5, 6, 0x3a3e48);                // boetten (skärmen ritas i live())
      P.px(wx + 6, top - 8, 0x8a8e96);                           // kronan
    }
    // den höga smarthögtalaren: tygklädd cylinder
    for (let j = 0; j < SPK.h; j++) for (let i = 0; i < SPK.w; i++) {
      const y = top - SPK.h + j, x = SPK.x + i;
      if ((i === 0 || i === SPK.w - 1) && (j === 0 || j === SPK.h - 1)) continue;
      let c = mix(0x5a5e6a, 0x3a3e48, i / SPK.w + (j === 0 ? -0.3 : 0));
      if (j > 1 && (i + j) % 2 === 0) c = mul(c, 0.88);           // tygets väv
      if (i === 1) c = mix(c, 0xffffff, 0.18);
      P.px(x, y, c);
    }
    P.hl(SPK.x + 1, top - SPK.h, SPK.w - 2, 0x2a2c34);           // ringen överst (lyser i live())
    // bärbara högtalaren: gul med två baselement och ett bärhandtag
    sbox(P, BOOM.x, top - BOOM.h, BOOM.w, BOOM.h, YEL);
    P.hl(BOOM.x + 3, top - BOOM.h - 2, BOOM.w - 6, 0x2a2c34); P.px(BOOM.x + 3, top - BOOM.h - 1, 0x2a2c34); P.px(BOOM.x + BOOM.w - 4, top - BOOM.h - 1, 0x2a2c34);
    for (const cx of [BOOM.x + 4, BOOM.x + BOOM.w - 5]) {
      for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]]) P.px(cx + dx, top - 5 + dy, 0x2a2c34);
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) P.px(cx + dx, top - 5 + dy, 0x3a3e48);
      P.px(cx, top - 5, 0x6a6e7a);
    }
    // systemkameran på ett litet stativ (objektivet mot kunden) och en actionkamera bredvid
    const cx = CAMS.x;
    P.vl(cx + 6, top - 5, 5, 0x2a2c34); P.px(cx + 4, top - 1, 0x2a2c34); P.px(cx + 8, top - 1, 0x2a2c34); P.px(cx + 5, top - 2, 0x2a2c34); P.px(cx + 7, top - 2, 0x2a2c34);
    sbox(P, cx, top - 13, 13, 8, 0x2a2c34);
    P.rect(cx + 2, top - 15, 5, 2, 0x2a2c34); P.px(cx + 10, top - 14, 0xe83a3a); // sökaren och avtryckaren
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) { const d = Math.hypot(i - 2.5, j - 2.5); if (d < 3) P.px(cx + 4 + i, top - 12 + j, d < 1.2 ? 0x5a7ac8 : d < 2.1 ? 0x14161c : 0x8a8e96); }
    P.px(cx + 6, top - 11, 0xffffff);                            // glinten i linsen
    P.px(cx + 1, top - 12, 0xf4f4f0);                            // blixten (tänds i live())
    // actionkameran på en liten fot
    sbox(P, cx + 16, top - 7, 7, 6, 0xf4f4f0); P.rect(cx + 17, top - 6, 3, 3, 0x14161c); P.px(cx + 18, top - 5, 0x5a7ac8); P.px(cx + 21, top - 6, 0xe83a3a);
    P.rect(cx + 18, top - 1, 3, 1, 0x8a8e96);
  });
}
// golvskylten innanför entrén: en svart griffeltavla på ben med krita
function paintAFrame() {
  const { x, base, w } = AF, h = 24, top = base - h;
  return sprite(x, top, w, h + 1, (P) => {
    // benen (lite snett utåt) och tavlan i träram
    for (let j = 0; j < 6; j++) { P.px(x + 3 - (j >> 2), base - 6 + j, TEAK[1]); P.px(x + w - 4 + (j >> 2), base - 6 + j, TEAK[1]); }
    sbox(P, x + 1, top, w - 2, h - 5, TEAK[3]);
    for (let yy = top + 2; yy < base - 7; yy++) for (let xx = x + 3; xx < x + w - 3; xx++) P.px(xx, yy, mix(0x2a3230, 0x1e2624, (bayer(xx, yy) - 0.5) * 0.3 + 0.5));
    txtC(P, SMALL, 'LADDARE', x + w / 2, top + 3, 0xf4f4ec);
    txtC(P, SMALL, 'INGÅR!', x + w / 2, top + 10, YEL);
    P.hl(x + 6, top + 17, w - 12, 0xf4f4ec, 0.5);                // ett kritstreck
  });
}
function paintStandee() {
  const { x, base, w, h } = STD, top = base - h;
  return sprite(x - 2, top - 10, w + 4, h + 11, (P) => {
    // kartongen: vit ram, telefonen i jätteformat, NYHET! överst, en fot bakom
    sbox(P, x, top, w, h - 4, 0xf4f4f0);
    P.rect(x + 1, top + 1, w - 2, 9, 0xff6ab8); txtC(P, SMALL, 'NYHET!', x + w / 2, top + 3, 0xffffff);
    const px = x + 6, py = top + 12, pw = w - 12, ph = h - 22;
    P.rect(px - 1, py - 1, pw + 2, ph + 2, 0xc8bca8); P.rect(px, py, pw, ph, 0x0c0e14);
    txtC(P, SMALL, 'PÄRONFON', x + w / 2, top + h - 11, NAVY);
    P.rect(x + 4, base - 4, w - 8, 3, 0xd8d0c0); P.hl(x + 4, base - 1, w - 8, 0xa89a80);
  });
}
function paintPlant(k) {
  return sprite(0, 0, 16, 34, (P) => {
    // vit kruka med stora blad
    for (let y = 22; y < 34; y++) for (let x = 2; x < 14; x++) P.px(x, y, x === 2 ? 0xffffff : x === 13 ? WHITE[0] : mix(WHITE[3], WHITE[1], (y - 22) / 12));
    P.hl(2, 22, 12, 0xffffff); P.hl(3, 23, 10, 0x4a3a2a);
    for (let i = 0; i < 26; i++) {
      const a = hash(i, k, 91) * Math.PI - Math.PI, r = 4 + hash(i, k, 92) * 8;
      const lx = Math.round(8 + Math.cos(a) * r * 0.8), ly = Math.round(18 + Math.sin(a) * r * 1.3);
      const c = [0x2a7a3a, 0x3a9a4a, 0x5ab85a, 0x2a6a32][i % 4];
      P.px(lx, ly, c); P.px(lx + 1, ly, c); P.px(lx, ly + 1, mul(c, 0.8));
    }
    outline(P, 0x1a2a1a, 0.4);
  });
}
// lådan man bär till kassan (liten för prylar, platt och bred för TV och rigg)
function boxSprite(big) {
  const w = big ? 16 : 10, h = big ? 11 : 8;
  const P = new Pix(w, h);
  sbox(P, 0, 0, w, h, 0xf4f6fa);
  P.hl(1, 2, w - 2, CYAN);
  bolt(P, (w >> 1) - 2, big ? 3 : 1, NAVY);
  return P.flush();
}
function bagSprite() {
  const P = new Pix(11, 14);
  P.rect(3, 0, 1, 3, 0x0e1430); P.rect(7, 0, 1, 3, 0x0e1430); P.hl(3, 0, 5, 0x0e1430);
  sbox(P, 0, 3, 11, 11, NAVY); bolt(P, 4, 5, YEL);
  return P.flush();
}
// bilar på gatan utanför (sidvy, 18×7)
function carSprite(col, dir) {
  const P = new Pix(18, 7), r = rampOf(col);
  for (let x = 1; x < 17; x++) for (let y = 3; y < 6; y++) P.px(x, y, y === 3 ? r[3] : r[2]);
  for (let x = 5; x < 13; x++) for (let y = 1; y < 3; y++) P.px(x, y, y === 1 ? r[3] : r[2]);
  P.rect(6, 1, 3, 2, 0x9ad0f0); P.rect(10, 1, 2, 2, 0x9ad0f0);
  for (const wx of [3, 12]) { P.rect(wx, 5, 3, 2, 0x1a1a20); P.px(wx + 1, 5, 0x8a8a90); }
  P.px(dir > 0 ? 16 : 1, 4, 0xfff0a0); P.px(dir > 0 ? 1 : 16, 4, 0xe83a3a);
  return P.flush();
}
// tickerns text: grön för upp, röd för ner
const TICKS = [['PIXELINDEX', '+2.4%'], ['BLIXT', '+5.1%'], ['KORV AB', '-0.8%'], ['MÖBELJÄTTEN', '+1.2%'], ['BANKEN', '+0.3%'], ['PÄRON', '+3.9%'], ['FRUKTFABRIKEN', '-1.6%'], ['BURGARBAREN', '+0.7%']];
function tickerStrip() {
  let w = 0;
  for (const [n, v] of TICKS) w += textW(SMALL, n) + textW(SMALL, v) + 16;
  const P = new Pix(w, TICKER.h);
  let x = 0;
  for (const [n, v] of TICKS) {
    txt(P, SMALL, n, x, 1, 0xffd060); x += textW(SMALL, n) + 4;
    const up = v[0] === '+', col = up ? 0x4af06a : 0xff4a4a;
    // en liten pil
    if (up) { P.px(x + 1, 2, col); P.hl(x, 3, 3, col); P.hl(x, 4, 3, col); } else { P.hl(x, 2, 3, col); P.hl(x, 3, 3, col); P.px(x + 1, 4, col); }
    x += 5; txt(P, SMALL, v, x, 1, col); x += textW(SMALL, v) + 8;
  }
  return { img: P.flush(), w };
}

// ================= figurerna =================
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// personalen: BLIXT-tröjan (ljusblå t-shirt med gul krage) och mörkblå byxor
const STAFF = { top: 'tee', shirt: '#1ea0e6', accent: '#ffd23f', bottom: 'pants', pants: '#1b2a5a', shoes: '#1c1c1c', glasses: false, beard: false, phones: false, kid: false, bag: null, hat: null, build: 5, blush: false };
const CLERK = { ...STAFF, skin: '#a06a43', hair: '#1d1714', style: 'short', glasses: 'square', beard: 'stubble', build: 6 };
const SELLER = { ...STAFF, skin: '#f6d7bf', hair: '#d9a95c', style: 'ponytail', blush: true };
const npcLook = (seed) => { const L = makeLook(rng(seed)); return { ...L, kid: false, build: L.build === 4 ? 5 : L.build, bag: null }; };
const KID_LOOK = (() => { const L = makeLook(rng(4242)); return { ...L, kid: true, build: 4, bag: null, hat: 'cap', cap: '#e83a3a', shirt: '#46a35a' }; })();

const CLERK_LINES = ['Välkommen till BLIXT!', 'Garanti i två år på allt.', 'Kvittot hamnar i påsen.', 'Allt levereras hem till förrådet.', 'Laddare ingår!', 'Behöver du en påse?'];
const SELLER_LINES = ['Testa gärna!', 'Säg till om du undrar något!', 'Alla TV-apparater visar samma film.', 'Päronfon har tre kameror!', 'Kolla in gamingriggarna!', 'Hörlurarna kan man lyssna i.'];
const SELLER_TIPS = [
  () => useTip('mobil'),
  () => useTip('platta'),
  () => '🖥️ Datorer, TV-apparater och spelkonsoler hamnar i förrådet hemma – ställ ut dem med 🛋️ Möblera.',
  () => '🎧 Hörlurarna syns på din figur – sätt på dem i garderoben hemma.',
  () => '🕹️ Gamingriggarna finns i fyra färger – klicka på en så väljer du modell.',
  () => '📺 Möbeljätten säljer inga TV-apparater längre – allt med sladd finns här hos oss på BLIXT!',
  () => '⌚ Prova-ön är för nyheterna: smartklockor, högtalare och kameror. De säljs inte än – men prova gärna!',
];
const TRY_LINES = {
  phone: ['WOW, VILKEN KAMERA!', 'SÅ TUNN!', 'KAN MAN SPELA PÅ DEN?', 'MIN GAMLA ÄR SPRUCKEN...', 'VILKEN SKÄRM!'],
  tab: ['PERFEKT FÖR SERIER!', 'SÅ STOR SKÄRM!', 'MED PENNA OCKSÅ!'],
  tv: ['SÅ SKARP BILD!', 'STÖRRE ÄN MIN SOFFA!', 'ALLA VISAR SAMMA...'],
  pc: ['DEN HÄR ÄR SNABB.', 'VILKET TANGENTBORD!', 'RGB PÅ ALLT!', 'TRE SKÄRMAR!'],
  hp: ['BASEN! 🎧', 'SÅ TYST DET BLEV!'],
  retro: ['MORMOR HADE EN SÅN!', 'KAN MAN RINGA PÅ DEN?'],
  game: ['EN RUNDA TILL!', 'SNYGG GRAFIK!'],
  watch: ['DEN RÄKNAR STEGEN!', 'SÅ LITEN SKÄRM!', 'KLOCKAN PIPER...'],
  speaker: ['VILKET LJUD!', 'SPELA MIN LÅT!', 'BASEN!'],
  camera: ['SÄG OMELETT!', 'VILKEN ZOOM!', 'KLICK!'],
};
const KID_LINES = ['JAG VANN! 🎮', 'EN RUNDA TILL!', 'MAMMA, KOLLA!', 'NIVÅ 3!', 'SNABBAST!'];
// där kunderna provar saker: [x, y, riktning, vad]
const BROWSE = [
  [180, 156, 'up', 'phone'], [216, 156, 'up', 'phone'], [252, 156, 'up', 'phone'], [288, 156, 'up', 'phone'],
  [196, 210, 'up', 'tab'], [240, 210, 'up', 'tab'], [282, 210, 'up', 'tab'],
  [40, 98, 'up', 'tv'], [100, 98, 'up', 'tv'], [168, 98, 'up', 'tv'],
  [460, 166, 'up', 'pc'], [526, 166, 'up', 'pc'], [592, 166, 'up', 'pc'],
  [456, 218, 'up', 'pc'], [520, 218, 'up', 'pc'], [600, 218, 'up', 'pc'],
  [572, 112, 'up', 'hp'], [604, 112, 'up', 'hp'],
  [46, 220, 'up', 'retro'], [84, 220, 'up', 'retro'],
  [100, 158, 'up', 'game'],
  [334, 208, 'up', 'watch'], [364, 208, 'up', 'speaker'], [396, 208, 'up', 'camera'],
];
const SELLER_SPOTS = [[230, 164, 'left'], [330, 150, 'down'], [372, 176, 'down'], [140, 104, 'down'], [540, 118, 'down'], [310, 216, 'right']];

// ---------- ljud: dörrens ding-dong och kassans pip ----------
function tones(list) {
  if (isMuted()) return;
  try {
    const c = audioContext();
    if (!c) return;
    const t0 = c.currentTime;
    for (const [f, at, v, len, type] of list) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(v, t0 + at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g); g.connect(c.destination); o.start(t0 + at); o.stop(t0 + at + len + 0.05);
    }
  } catch { /* ljud är aldrig ett krav */ }
}
const chime = () => tones([[1046, 0, 0.035, 0.7], [784, 0.2, 0.03, 0.9]]);
const beep = () => tones([[1880, 0, 0.03, 0.09, 'square']]);
// prova-öns högtalare: en kort glad slinga med bas · kamerans slutare: klick-klack
const jingle = () => tones([[523, 0, 0.03, 0.2, 'triangle'], [659, 0.18, 0.03, 0.2, 'triangle'], [784, 0.36, 0.03, 0.2, 'triangle'], [1046, 0.54, 0.03, 0.45, 'triangle'],
  [131, 0, 0.05, 0.3, 'sine'], [196, 0.36, 0.05, 0.3, 'sine'], [262, 0.54, 0.05, 0.5, 'sine']]);
const shutter = () => tones([[2600, 0, 0.03, 0.03, 'square'], [1300, 0.07, 0.025, 0.05, 'square']]);
const DEMO_SECS = 3.2; // så länge högtalaren spelar när man provar den

// ================= förmålade bilder (dag/natt) =================
let ART = null;
function art() {
  if (ART) return ART;
  const phones = { id: 'phones', groups: [
    { id: 'fonmini', cx: PT.x0 + 56 }, { id: 'fon12', cx: PT.x0 + 98 }, { id: 'paronfon', cx: PT.x0 + 140 },
  ] };
  const tabs = { id: 'tabs', groups: [{ id: 'platta', cx: TT.x0 + 74 }, { id: 'paronplatta', cx: TT.x0 + 126 }] };
  for (const G of [...phones.groups, ...tabs.groups]) {
    const L = LOOKS[G.id], gap = L.kind === 'mobil' ? 4 : 3;
    const x0 = Math.round(G.cx - (L.w * 2 + gap) / 2);
    G.units = [{ x: x0, back: false }, { x: x0 + L.w + gap, back: true }];
  }
  const tableTop = (T) => T.base - 26;
  // skärmarna på borden (för live()): världskoordinater
  const screens = [];
  for (const [T, set] of [[PT, phones], [TT, tabs]]) for (const G of set.groups) {
    const L = LOOKS[G.id], s = screenOf(L);
    for (const u of G.units) if (!u.back) screens.push({ id: G.id, table: set.id, x: u.x + s.x, y: tableTop(T) + 7 - L.h + s.y, w: s.w, h: s.h, seed: screens.length * 3 + 1, island: !!L.island });
  }
  ART = {
    bgDay: null, bgNight: null, glassDay: null, glassNight: null, doorDay: null, doorNight: null,
    phones, tabs, screens,
    bench: paintBench(), counter: paintCounter(), hpTable: paintHpTable(), podium: paintPodium(), retro: paintRetro(),
    phoneTable: paintTable(PT, 'TELEFONER', phones.groups), tabTable: paintTable(TT, 'SURFPLATTOR', tabs.groups),
    gdesks: GD.map((D, i) => paintGamingDesk(D, i)), cdesk: paintCompDesk(), ltable: paintLaptopTable(), standee: paintStandee(),
    island: paintIsland(), aframe: paintAFrame(),
    plants: [0, 1, 2].map((k) => paintPlant(k)),
    box: boxSprite(false), bigBox: boxSprite(true), bag: bagSprite(),
    cars: [0xe83a3a, 0xf4f4f0, 0x2a2c34, 0x3a6ae8, 0xffc23a].flatMap((c) => [carSprite(c, 1), carSprite(c, -1)]),
    ticker: tickerStrip(),
    tv: new Map(), // skärmstorlek → skärm (TV-väggen visar samma program på alla)
    gameTv: makeScreen(GAME_TV.w, GAME_TV.h),
    standTv: makeScreen(STD.w - 12, STD.h - 22),
  };
  for (const T of TVS) { const key = `${T.w}x${T.h}`; if (!ART.tv.has(key)) ART.tv.set(key, makeScreen(T.w, T.h)); }
  return ART;
}
const bgOf = (R, night) => (night ? (R.bgNight ||= paintBackground(true)) : (R.bgDay ||= paintBackground(false)));
const glassOf = (R, night) => (night ? (R.glassNight ||= paintGlass(true)) : (R.glassDay ||= paintGlass(false)));
const doorOf = (R, night) => (night ? (R.doorNight ||= paintDoorPanel(true)) : (R.doorDay ||= paintDoorPanel(false)));

// ================= scenen =================
export function makeShopElektronik(A, opts = {}) {
  const g = A.game;
  const R = art();
  const talk = createSpeech();      // mina egna tankar
  const talkExp = createSpeech();   // expediten i kassan
  const talkSel = createSpeech();   // säljaren på golvet
  const talkKid = createSpeech();   // barnet vid spelkonsolen
  const mkWalker = (spawn) => { const w = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: H - 4, spawn }); w.setObstacles(OBST); return w; };
  const walker = mkWalker([DOOR_X, WALL_Y + 8]);
  walker.speed = 70; walker.snapFree(); walker.dir = 'down';

  let t = 0, lockedCam = null, hoverId = null, hoverSpot = null, hoverT = -9, lastHint = -9;
  let cart = null;          // lådan man bär till kassan: { p, v, price, name, icon }
  let bag = false;          // köpt något – bär BLIXT-påsen tills man går
  let scan = null;          // expediten piper in lådan: { t, done }
  let door = 0, doorWas = false, pendingHello = 0.7, panelHits = [];
  let lastBuy = null;       // senaste köpet (för tester och påsens innehåll)
  let paidT = -9;           // när senaste köpet betalades (kunddisplayen säger TACK!)
  const demo = { spk: -99, cam: -99, flash: -99, camNpc: -99 }; // prova-ön: när högtalaren/kameran provades senast
  const cam = { x: 0, y: 0 };
  const hour = () => (g.min / 60) % 24;
  const isNight = () => { const h = hour(); return h >= 20 || h < 6.5; };
  const camTarget = () => lockedCam || { x: clamp(walker.px - VW / 2, 0, W - VW), y: clamp(walker.py - VH * 0.55, 0, H - VH) };
  Object.assign(cam, camTarget());

  // ---------- vädret utanför fasaden ----------
  let wx = null, wxT = -9;
  const weather = () => {
    if (t - wxT > 5 || !wx) { wxT = t; try { wx = typeof WX.weatherAt === 'function' ? WX.weatherAt(g.day, hour(), g.event?.id ?? null) : null; } catch { wx = null; } }
    return wx;
  };
  const drops = Array.from({ length: 90 }, (_, i) => ({ x: GLASS.x0 + hash(i, 1, 61) * (GLASS.x1 - GLASS.x0), y: GLASS.top + hash(i, 2, 61) * 55, s: 0.6 + hash(i, 3, 61) * 0.6 }));

  // ---------- gatan: bilar och folk som går förbi ----------
  const cars = [];
  const walkers = [];
  let carT = 1.5, walkT = 2.5, streetSeed = (g.day | 0) * 71 + 3;
  function updateStreet(dt) {
    carT -= dt; walkT -= dt;
    if (carT <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1, k = Math.floor(Math.random() * 5);
      cars.push({ x: dir > 0 ? GLASS.x0 - 20 : GLASS.x1 + 2, y: dir > 0 ? 60 : 57, dir, v: 55 + Math.random() * 40, img: R.cars[k * 2 + (dir > 0 ? 0 : 1)] });
      carT = (isNight() ? 4 : 1.6) + Math.random() * 4;
    }
    if (walkT <= 0 && walkers.length < 2) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      walkers.push({ x: dir > 0 ? GLASS.x0 - 10 : GLASS.x1 + 10, y: 73 + Math.floor(Math.random() * 2), dir, v: 16 + Math.random() * 10, look: npcLook(streetSeed += 53) });
      walkT = (isNight() ? 9 : 4) + Math.random() * 8;
    }
    for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; c.x += c.v * c.dir * dt; if (c.x < GLASS.x0 - 30 || c.x > GLASS.x1 + 10) cars.splice(i, 1); }
    for (let i = walkers.length - 1; i >= 0; i--) { const p = walkers[i]; p.x += p.v * p.dir * dt; if (p.x < GLASS.x0 - 16 || p.x > GLASS.x1 + 16) walkers.splice(i, 1); }
  }

  // ---------- expediten ----------
  const exp = { dir: 'down', mode: 'idle', t: 3, said: -9 };
  const expInView = () => EXP.x + 8 >= cam.x && EXP.x - 8 <= cam.x + VW && EXP.y - 40 <= cam.y + VH && EXP.y >= cam.y;
  function expSay(s, secs, force = false) {
    if (!force && !expInView()) return;
    if (t - exp.said < 1.2 && talkExp.active()) return;
    exp.said = t;
    talkExp.say(s, { x: EXP.x, y: EXP.y - 32 }, secs, { voice: CLERK });
  }
  function updateClerk(dt) {
    exp.t -= dt;
    if (scan || npcs.some((n) => n.state === 'pay')) { exp.mode = 'scan'; return; }
    if (exp.mode === 'scan') { exp.mode = 'idle'; exp.t = 3; }
    if (exp.t > 0) return;
    exp.t = 4 + Math.random() * 6;
    exp.dir = Math.random() < 0.2 ? (Math.random() < 0.5 ? 'left' : 'right') : 'down';
    if (Math.random() < 0.35 && Math.hypot(walker.px - EXP.x, walker.py - EXP.y) < 150) expSay(CLERK_LINES[Math.floor(Math.random() * CLERK_LINES.length)]);
  }

  // ---------- säljaren på golvet ----------
  const sel = { w: mkWalker(SELLER_SPOTS[1]), state: 'stand', t: 3, spot: 1, dir: 'down', greetT: -99, tipI: 0 };
  sel.w.speed = 34;
  const selInView = () => sel.w.px + 10 >= cam.x && sel.w.px - 10 <= cam.x + VW;
  function selSay(s, secs) { if (!selInView()) return; talkSel.say(s, () => ({ x: sel.w.px, y: sel.w.py - 32 }), secs, { voice: SELLER }); }
  function updateSeller(dt) {
    sel.t -= dt;
    if (sel.state === 'walk') {
      sel.w.update(dt);
      if (!sel.w.path.length) { sel.state = 'stand'; sel.dir = SELLER_SPOTS[sel.spot][2]; sel.t = 7 + Math.random() * 9; }
      return;
    }
    if (sel.state === 'talk') { if (sel.t <= 0) { sel.state = 'stand'; sel.t = 4; } return; }
    // hälsa när jag kommer nära
    if (Math.hypot(walker.px - sel.w.px, walker.py - sel.w.py) < 44 && t - sel.greetT > 40) {
      sel.greetT = t; sel.dir = walker.px < sel.w.px ? 'left' : 'right';
      selSay(['Hej! Säg till om du undrar något!', 'Hej! Testa gärna telefonerna!', 'Hej hej! Kolla gärna runt.'][Math.floor(Math.random() * 3)]);
    }
    if (sel.t <= 0) {
      let k = sel.spot;
      while (k === sel.spot) k = Math.floor(Math.random() * SELLER_SPOTS.length);
      sel.spot = k; sel.state = 'walk';
      sel.w.walkTo(SELLER_SPOTS[k][0], SELLER_SPOTS[k][1]);
      if (Math.random() < 0.25) selSay(SELLER_LINES[Math.floor(Math.random() * SELLER_LINES.length)]);
    }
  }
  function talkToSeller() {
    sel.state = 'talk'; sel.t = 3.5; sel.w.stop();
    sel.dir = walker.px < sel.w.px ? 'left' : 'right';
    walker.dir = walker.px < sel.w.px ? 'right' : 'left';
    selSay(['Bra fråga!', 'Absolut!', 'Här kommer ett tips!'][sel.tipI % 3], 2.5);
    play('chirp');
    toast(`💬 ${SELLER_TIPS[sel.tipI % SELLER_TIPS.length]()}`);
    sel.tipI++;
  }

  // ---------- barnet vid spelkonsolen ----------
  const kid = { lineT: 6 + Math.random() * 8, here: () => { const h = hour(); return h >= 9 && h < 19.5; } };

  // ---------- kunderna ----------
  let npcSeed = (g.day | 0) * 131 + 17;
  // kunderna kommer in genom skjutdörrarna, lite åt sidan på mattan (inte rakt på mig)
  const NPC_IN = [[DOOR_X - 9, WALL_Y + 5], [DOOR_X + 9, WALL_Y + 5], [DOOR_X - 13, WALL_Y + 7], [DOOR_X + 13, WALL_Y + 7]];
  const npcs = [0, 1, 2, 3].map((i) => {
    const w = mkWalker(NPC_IN[i]);
    w.speed = 30 + i * 4;
    return { i, w, look: npcLook(npcSeed + i * 19), state: 'away', t: 2.5 + i * 5, plan: [], goal: null, bag: false, talk: createSpeech(), lineT: -9 };
  });
  const maxNpcs = () => (isNight() ? 1 : 4);
  // står jag i dörren väntar kunden en stund (annars kliver den in ovanpå mig)
  const meInDoor = () => Math.abs(walker.px - DOOR_X) < 22 && walker.py < WALL_Y + 18;
  function spawnNpc(n) {
    n.look = npcLook(npcSeed += 37);
    n.lookHp = { ...n.look, phones: true, phoneColor: hexs(HP_COLS[(npcSeed >> 3) % HP_COLS.length]) }; // med hörlurarna på (provar vid lyssningsbordet)
    [n.w.px, n.w.py] = NPC_IN[n.i]; n.w.stop(); n.w.dir = 'down';
    n.bag = false;
    const pool = BROWSE.filter(([x, y]) => !npcs.some((o) => o !== n && o.goal && Math.hypot(o.goal.x - x, o.goal.y - y) < 8));
    const picks = [];
    const k = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < k && pool.length; j++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    n.plan = picks.map(([x, y, dir, act]) => ({ x, y, dir, act, kind: 'browse' }));
    if (Math.random() < 0.45) n.plan.push({ x: NPC_PAY[0], y: NPC_PAY[1], dir: 'up', kind: 'pay' });
    n.plan.push({ x: DOOR_X, y: WALL_Y + 5, dir: 'up', kind: 'exit' });
    nextGoal(n);
  }
  function nextGoal(n) {
    n.goal = n.plan.shift() || null;
    if (!n.goal) { n.state = 'away'; n.t = 5 + Math.random() * 12; return; }
    n.state = 'walk';
    let { x, y } = n.goal;
    if (n.goal.kind === 'pay' && npcs.some((o) => o !== n && o.state === 'pay')) { x = QUEUE[0]; y = QUEUE[1]; n.goal = { ...n.goal, queue: true }; }
    n.w.walkTo(x, y);
    if (!n.w.path.length) arrive(n);
  }
  function npcSay(n, s) {
    if (n.w.px < cam.x - 20 || n.w.px > cam.x + VW + 20) return;
    if (talk.active() && Math.hypot(walker.px - n.w.px, walker.py - n.w.py) < 60) return;
    n.lineT = t;
    n.talk.say(s, () => ({ x: n.w.px, y: n.w.py - 32 }), 2.6, { voice: n.look });
  }
  function arrive(n) {
    const G = n.goal;
    if (!G) return nextGoal(n);
    if (G.dir) n.w.dir = G.dir;
    if (G.kind === 'browse') {
      n.state = 'try'; n.t = 3 + Math.random() * 4;
      if (Math.random() < 0.45 && t - n.lineT > 6) { const L = TRY_LINES[G.act] || TRY_LINES.phone; npcSay(n, L[Math.floor(Math.random() * L.length)]); }
      // på prova-ön: högtalaren börjar spela (bara ljuset – ljudet är mitt eget), kameran blixtrar
      if (G.act === 'speaker' && t - demo.spk > DEMO_SECS) demo.spk = t;
      if (G.act === 'camera') demo.cam = t + 1 + Math.random();
    } else if (G.kind === 'pay') {
      if (G.queue) { n.state = 'queue'; n.t = 0; return; }
      n.state = 'pay'; n.t = 0;
      exp.dir = 'left';
      expSay('Hej! Hittade du allt?');
    } else if (G.kind === 'exit') {
      n.state = 'away'; n.t = 6 + Math.random() * 12;
    }
  }
  function updateNpc(n, dt) {
    if (n.state === 'away') {
      n.t -= dt;
      if (n.t <= 0) {
        if (meInDoor()) n.t = 0.8 + n.i * 1.3; // (i otakt – inte alla på en gång när jag kliver undan)
        else if (npcs.filter((o) => o.state !== 'away').length < maxNpcs()) spawnNpc(n);
        else n.t = 4;
      }
      return;
    }
    n.w.update(dt);
    if (n.state === 'walk') { if (!n.w.path.length) arrive(n); }
    else if (n.state === 'try') { n.t -= dt; if (n.t <= 0) nextGoal(n); }
    else if (n.state === 'queue') {
      n.t += dt;
      if (!npcs.some((o) => o !== n && o.state === 'pay')) { n.goal = { x: NPC_PAY[0], y: NPC_PAY[1], dir: 'up', kind: 'pay' }; n.state = 'walk'; n.w.walkTo(NPC_PAY[0], NPC_PAY[1]); }
      else if (n.t > 12) nextGoal(n);
    } else if (n.state === 'pay') {
      n.t += dt;
      if (n.t > 1 && n.t - dt <= 1) beep();
      if (n.t > 1.5 && n.t - dt <= 1.5) beep();
      if (n.t > 2.4 && !n.bag) { n.bag = true; expSay('Tack så mycket! Ha en bra dag!'); play('coin'); }
      if (n.t > 3.2) { exp.dir = 'down'; nextGoal(n); }
    }
  }

  // ---------- köpet: produktbladet, lådan och kassan ----------
  function productSheet(p, v0) {
    const price = priceOf(g, p), block = blockedOf(g, p), name = nameOf(p);
    const models = p.type === 'furn' ? p.models.filter((i) => i < (katOf(p.k)?.vars ?? 1)) : [];
    const st = { v: models.includes(v0) ? v0 : models[0] ?? 0 };
    const afford = price != null && g.money >= price;
    let info = '';
    if (p.type === 'furn') {
      const inStore = g.storage.filter((s) => s.k === p.k).length, kn = katOf(p.k)?.name;
      info = `📦 Hamnar i <b>förrådet</b> hemma – ställ ut den med 🛋️ Möblera. I förrådet nu: ${inStore}.`;
      if (kn && kn !== p.name) info += `<br><span class="sp">I förrådet heter den <b>${esc(kn)}</b>.</span>`;
    } else if (p.type === 'gadget') {
      const k = gadgetKind(p.id), mine = bestOwned(g, k), b = bonusOf(p.id);
      info = USE[k](p.id);
      if (mine && mine.id !== p.id) info += `<br><span class="sp">${mine.bonus >= b ? `Din ${esc(mine.name)} ger redan +${mine.bonus} – den här ger inget extra.` : `Din ${esc(mine.name)} ger +${mine.bonus} – med den här blir det +${b}.`}</span>`;
      info += '<br><span class="sp">Prylen bär du med dig i fickan – den ställs inte ut hemma.</span>';
    } else info = '👕 Låses upp i <b>garderoben</b> – ta på dem hemma när du vill.';
    const money = `💰 Du har <b>${GAME.fmt ? GAME.fmt(g.money) : g.money + ' kr'}</b> · Pris: <b>${price != null ? (GAME.fmt ? GAME.fmt(price) : price + ' kr') : '–'}</b>`;
    const dlg = openModal(`${p.icon} ${esc(name)}`, `
      <div class="fb">
        <div class="fb-top${models.length > 1 ? '' : ' solo'}">
          <div class="fb-stage"><canvas class="fb-big"></canvas></div>
          ${models.length > 1 ? `<div class="fb-side"><span class="fb-lbl">Modell</span>
            <div class="fb-models">${models.map((i) => `<button class="fb-model" data-v="${i}" title="Modell ${i + 1}"><canvas></canvas></button>`).join('')}</div></div>` : ''}
        </div>
        <p class="fb-info" style="margin-top:10px">${esc(p.desc)}</p>
        <p class="fb-info">${money}<br>${info}</p>
        ${block ? `<p class="fb-info bad"><b>${esc(block)}</b></p>` : !afford ? `<p class="fb-info bad"><b>⚠️ Pengarna räcker inte</b> – det fattas ${GAME.fmt ? GAME.fmt(price - g.money) : price - g.money + ' kr'}. Dags att jobba ett pass!</p>` : ''}
      </div>`, [
      { label: 'Stäng', onClick: closeModal },
      { label: `🛒 Till kassan (${price != null ? (GAME.fmt ? GAME.fmt(price) : price + ' kr') : '–'})`, cls: 'btn-go', disabled: !!block || !afford, onClick: () => { closeModal(); pickUp(p, st.v); } },
    ]);
    dlg.classList.add('dlg-furn');
    const big = dlg.querySelector('.fb-big');
    const tiles = [...dlg.querySelectorAll('.fb-model')];
    const drawArt = (cv, a, s) => {
      cv.width = a.sw * s; cv.height = (a.sh + 2) * s;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = 'rgba(20,12,28,0.2)'; x.fillRect(s, (a.sh - 1) * s, (a.sw - 2) * s, 2 * s);
      x.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, 0, 0, a.sw * s, a.sh * s);
    };
    const intScale = (v, hi) => Math.max(1, Math.min(hi, Math.floor(v)));
    function render() {
      if (p.type === 'furn') {
        const a = typeof ROOM.furnArt === 'function' ? ROOM.furnArt(p.k, st.v, null) : null;
        if (a) drawArt(big, a, intScale(Math.min(236 / a.sw, 170 / (a.sh + 2)), 7));
        for (const b of tiles) {
          const i = +b.dataset.v, ta = ROOM.furnArt?.(p.k, i, null);
          if (ta) drawArt(b.querySelector('canvas'), ta, intScale(Math.min(104 / ta.sw, 64 / (ta.sh + 2)), 3));
          b.classList.toggle('on', i === st.v);
        }
      } else {
        const c = sheetArt(p);
        const s = intScale(Math.min(236 / c.width, 176 / c.height), p.type === 'clothes' ? 7 : 5);
        big.width = c.width * s; big.height = c.height * s;
        const x = big.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, c.width * s, c.height * s);
      }
    }
    for (const b of tiles) b.onclick = () => { st.v = +b.dataset.v; play('click'); render(); };
    if (p.type !== 'furn' || ROOM.ATLAS?.complete) render(); else ROOM.ATLAS?.addEventListener?.('load', render, { once: true });
    play('chirp');
    return dlg;
  }
  // produktbladets bild för prylar och hörlurar
  function sheetArt(p) {
    if (p.type === 'clothes') {
      const P = new Pix(30, 26);
      for (const [dx, col] of [[1, 0x2a2c34], [16, CYAN]]) { P.rect(dx + 3, 22, 7, 2, 0xd0d4da); P.vl(dx + 6, 12, 10, 0xb0b8c2); paintHeadphones(P, dx + 2, 3, col); }
      return P.flush();
    }
    const L = LOOKS[p.id];
    const mob = L.kind === 'mobil', w = mob ? 24 : 52, h = mob ? 44 : 36;
    const P = new Pix(mob ? w * 2 + 6 : w, h + (L.pen ? 5 : 0));
    paintDevice(P, L, 0, 0, false, true);
    const s = screenOf(L, true);
    // låsskärmen: bakgrund + klockan (och vädret) – samma pixelkorn
    const wp = mob ? 'hav' : 'fjall';
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) P.px(s.x + x, s.y + y, wpPixel(wp, (x + 0.5) / s.w, (y + 0.5) / s.h, x, y, s.w, s.h));
    if (L.island) for (let i = -3; i <= 3; i++) { P.px((w >> 1) + i, s.y + 2, 0x0c0e14); P.px((w >> 1) + i, s.y + 3, 0x0c0e14); }
    const clk = GAME.clock ? GAME.clock(g.min) : '12:00';
    if (mob) {
      eachTextPixel(SMALL, clk, Math.round(w / 2 - textW(SMALL, clk) / 2), s.y + 7, 1, (px, py) => P.px(px, py, 0xffffff));
      weatherIcon(P, (w >> 1) - 3, s.y + 14);
    } else {
      eachTextPixel(SMALL, clk, s.x + 3, s.y + 3, 1, (px, py) => P.px(px, py, 0xffffff));
      weatherIcon(P, s.x + s.w - 10, s.y + 3);
    }
    if (mob) paintDevice(P, L, w + 6, 0, true, true);
    if (L.pen) { P.hl(8, h + 2, 30, 0xf4f4f0); P.hl(8, h + 3, 30, 0xc8ccd4); P.px(38, h + 2, 0x8a8e96); P.px(38, h + 3, 0x5a5e66); P.px(7, h + 2, 0xd0d4da); }
    return P.flush();
  }
  // en liten väderikon på låsskärmen (7×5)
  function weatherIcon(P, x, y) {
    const k = weather()?.kind || 'sol';
    if (k === 'sol') { P.rect(x + 2, y, 3, 3, YEL); P.px(x + 1, y + 1, 0xffe890); P.px(x + 5, y + 1, 0xffe890); P.px(x + 3, y + 3, 0xffe890); }
    else {
      P.rect(x + 1, y + 1, 5, 2, 0xf4f4f8); P.rect(x + 2, y, 2, 1, 0xf4f4f8);
      if (k === 'regn') { P.px(x + 1, y + 4, 0x6ab0ff); P.px(x + 3, y + 4, 0x6ab0ff); P.px(x + 5, y + 4, 0x6ab0ff); }
      if (k === 'snö') { P.px(x + 2, y + 4, 0xffffff); P.px(x + 4, y + 4, 0xffffff); }
    }
  }
  function pickUp(p, v) {
    const price = priceOf(g, p);
    if (price == null || blockedOf(g, p)) return false;
    cart = { p, v: v | 0, price, name: nameOf(p), icon: p.icon };
    scan = null;
    play('ok');
    toast(`${p.icon} ${cart.name} – bär lådan till kassan och betala!`, 'good');
    goPay();
    return true;
  }
  function putBack() {
    if (!cart) return;
    toast(`↩ Du ställde tillbaka ${cart.name}.`);
    cart = null; scan = null;
    play('click');
  }
  function goPay() {
    walker.walkTo(PAY[0], PAY[1], () => { walker.dir = 'up'; startScan(); });
  }
  function startScan() {
    if (!cart) { expSay('Välj något i butiken så slår jag in det!'); hint('🛒 Klicka på en vara – sedan betalar du här.'); return; }
    if (scan) return;
    scan = { t: 0, done: false };
    exp.dir = 'right';
    expSay('Hej! Den ska jag slå in.');
  }
  function updateScan(dt) {
    if (!scan) return;
    scan.t += dt;
    if (!walker.path.length && Math.hypot(walker.px - PAY[0], walker.py - PAY[1]) > 14) { scan = null; return; } // gick därifrån
    if (scan.t > 0.5 && scan.t - dt <= 0.5) beep();
    if (scan.t > 1.1 && !scan.done) { scan.done = true; pay(); }
  }
  // Betala lådan man bär. { ok, msg }
  function pay() {
    if (!cart) return { ok: false, msg: 'Du bär ingenting.' };
    const { p, v, price, name } = cart;
    let r;
    if (p.type === 'furn') r = g.buyFurniture(p.k, v);
    else if (p.type === 'gadget') r = typeof g.buyGadget === 'function' ? g.buyGadget(p.id) : { ok: false, msg: 'Kommer snart!' };
    else r = g.buyClothes('phones', true);
    scan = null;
    exp.dir = 'down';
    if (!r?.ok) {
      // köpet gick inte (fullt förråd, inte råd …) – expediten ställer tillbaka lådan, så man
      // inte står kvar med en låda som aldrig går att betala
      play('fel');
      const why = r?.msg || 'Det gick inte.';
      cart = null;
      toast(`💳 ${why} ↩ Expediten ställer tillbaka ${name}.`, 'bad');
      expSay(/råd/.test(why) ? 'Kortet nekades... Tyvärr.' : /förråd/i.test(why) ? 'Oj, förrådet är fullt! Jag ställer tillbaka den.' : 'Oj, det gick inte.');
      return { ok: false, msg: why };
    }
    const prevBest = p.type === 'gadget' ? bestOwned(g, gadgetKind(p.id)) : null; // (efter köpet – den nya räknas in)
    cart = null; bag = true; paidT = t;
    lastBuy = { id: p.id, k: p.k || null, v, price };
    play('buy');
    expSay(['Tack för köpet!', 'Varsågod – kvittot ligger i påsen!', 'Tack! Ha så kul med den!'][Math.floor(Math.random() * 3)], 3);
    if (p.type === 'furn') { const kn = katOf(p.k)?.name; toast(`${p.icon} ${name} ligger i förrådet${kn && kn !== p.name ? ` (som ”${kn}”)` : ''} – ställ ut den hemma med 🛋️ Möblera!`, 'good'); }
    else if (p.type === 'gadget') {
      const mob = gadgetKind(p.id) === 'mobil', b = bonusOf(p.id), top = prevBest && prevBest.id !== p.id && prevBest.bonus > b ? prevBest : null;
      toast(`${p.icon} ${name} är din! ${top ? `(Din ${top.name} ger fortfarande mest: +${top.bonus}.)` : mob ? `⏰ Väckarklockan: +${b} energi när du vaknar i din säng.` : `🌙 Kvällsserie efter kl. 20: +${b} energi på morgonen.`}`, 'good');
    }
    else toast('🎧 Hörlurarna är dina – ta på dem i garderoben hemma!', 'good');
    g.save?.();
    return { ok: true };
  }

  // ---------- gå ut ----------
  function exit() {
    if (cart) {
      openModal('📦 Obetald vara', `<p style="font-size:20px;margin-top:0">Du bär på <b>${esc(cart.name)}</b> (${GAME.fmt ? GAME.fmt(cart.price) : cart.price + ' kr'}) som inte är betald.</p>
        <p style="font-size:18px">Betala i kassan – eller ställ tillbaka den innan du går. Larmbågarna vid dörren piper annars!</p>`, [
        { label: '↩ Ställ tillbaka och gå', onClick: () => { closeModal(); cart = null; scan = null; leave(); } },
        { label: '🧾 Till kassan', cls: 'btn-go', onClick: () => { closeModal(); goPay(); } },
      ]);
      return;
    }
    leave();
  }
  function leave() { play('door'); A.go('city'); }

  // ---------- mina tankar ----------
  const sayHint = (s) => talk.say(s, () => ({ x: walker.px, y: walker.py - 32 }), undefined, { voice: 'self' });
  function hint(s) { if (t - lastHint < 1.6) return; lastHint = t; play('click'); sayHint(s); }

  // ---------- klickbara platser ----------
  const spots = [];
  const addSpot = (s) => { spots.push(s); return s; };
  const buySpot = (id, v, r, go, face = 'up') => addSpot({ id, prod: id, v, r, go, face, act: () => onProduct(id, v) });
  // TV-väggen och TV-bänken
  buySpot('tv', 1, [TVW.x0 + 6, CEIL + 4, TVW.x1 - 6, TVB.base], [106, TVB.base + 8]);
  // hörlurarna: väggen och lyssningsbordet
  buySpot('horlurar', 0, [PEG.x0, CEIL + 2, PEG.x1, HPT.base], [588, HPT.base + 8]);
  // telefonerna och plattorna (per modell)
  for (const G of R.phones.groups) buySpot(G.id, 0, [G.cx - 20, PT.base - 44, G.cx + 20, PT.base - 2], [G.cx, PT.base + 8]);
  for (const G of R.tabs.groups) buySpot(G.id, 0, [G.cx - 26, TT.base - 44, G.cx + 26, TT.base - 2], [G.cx, TT.base + 8]);
  // spelkonsolerna på podien
  [0, 1, 2].forEach((v) => { const x = CON.x0 + 58 + v * 20; buySpot('spelkonsol', v, [x - 2, CON.base - 32, x + 18, CON.base - 8], [x + 8, CON.base + 8]); });
  // retrohyllan
  buySpot('retrotv', 0, [RET.x0 + 6, RET.base - 42, RET.x0 + 28, RET.base - 8], [RET.x0 + 17, RET.base + 8]);
  [0, 1, 2].forEach((v) => { const x = RET.x0 + 34 + v * 16; buySpot('telefon', v, [x - 2, RET.base - 32, x + 14, RET.base - 8], [x + 6, RET.base + 8]); });
  // gamingriggarna
  GD.forEach((D) => buySpot('rigg', D.v, [D.x0 + 2, GD_BASE - 46, D.x0 + GD_W - 2, GD_BASE - 6], [D.x0 + GD_W / 2, GD_BASE + 8]));
  // datorerna, tornen och de bärbara
  const slotX = (i) => CD.x0 + 4 + i * 33;
  [0, 1, 2, 3].forEach((v) => {
    buySpot('datortorn', v, [slotX(v) - 1, CD.base - 38, slotX(v) + 8, CD.base - 14], [slotX(v) + 4, CD.base + 8]);
    buySpot('dator', v, [slotX(v) + 8, CD.base - 42, slotX(v) + 32, CD.base - 14], [slotX(v) + 20, CD.base + 8]);
  });
  [0, 1].forEach((v) => { const x = LT.x0 + 13 + v * 22; buySpot('laptop', v, [x - 3, LT.base - 36, x + 15, LT.base - 12], [x + 6, LT.base + 8]); });
  // kassan, dörren, skylten, barnet
  addSpot({ id: 'kassa', r: [CNT.x0, CNT.top - 12, CNT.x1, CNT.base], go: PAY, face: 'up', act: () => { walker.dir = 'up'; startScan(); } });
  addSpot({ id: 'dorr', r: [DOOR.x0 - 4, GLASS.top - 8, DOOR.x1 + 4, WALL_Y + 6], go: [DOOR_X, WALL_Y + 5], face: 'up', act: exit });
  addSpot({ id: 'skylt', r: [STD.x, STD.base - STD.h - 10, STD.x + STD.w, STD.base], go: [STD.x + STD.w / 2, STD.base + 8], face: 'up', act: () => { play('chirp'); toast('📱 NYHET! Päronfon 16 Pro med tre kameror – den står på telefonbordet.'); } });
  addSpot({ id: 'golvskylt', r: [AF.x, AF.base - 24, AF.x + AF.w, AF.base], go: [AF.x + AF.w / 2, AF.base + 8], face: 'up', act: () => hint('🔌 Laddare ingår till alla telefoner och plattor!') });
  // prova-ön: klockorna, högtalarna och kamerorna går att prova (de säljs inte än)
  const demoSpot = (id, x0, x1, act) => addSpot({ id, demo: true, r: [x0, ISL_TOP - 18, x1, ISL.base - 2], go: [Math.round((x0 + x1) / 2), ISL.base + 8], face: 'up', act });
  demoSpot('klocka', ISL.x0 + 2, ISL.x0 + 33, () => { play('chirp'); lastHint = -9; hint(`⌚ Smartklockan visar ${GAME.clock ? GAME.clock(g.min) : 'tiden'} och räknar stegen. Säljs snart!`); });
  demoSpot('hogtalare', ISL.x0 + 34, ISL.x0 + 64, () => { demo.spk = t; jingle(); lastHint = -9; hint('🔊 Högtalaren spelar en glad slinga. Säljs snart!'); });
  demoSpot('kamera', ISL.x0 + 65, ISL.x1 - 2, () => { demo.cam = t; demo.flash = t; shutter(); lastHint = -9; hint('📸 Klick! Ett foto på dig. Kamerorna säljs snart!'); });
  addSpot({ id: 'barnet', r: [KID.x - 9, KID.y - 40, KID.x + 9, KID.y + 2], go: [KID.x + 18, KID.y + 2], face: 'left', act: () => { if (kid.here()) { talkKid.say(KID_LINES[Math.floor(Math.random() * KID_LINES.length)], { x: KID.x, y: KID.y - 36 }, 2.5, { voice: KID_LOOK }); } else hint('🎮 Barnet har gått hem – TV:n kör demoläget.'); } });
  addSpot({ id: 'fonster', r: [GLASS.x0 + 2, GLASS.top, DOOR.x0 - 4, WALL_Y - 2], go: [250, WALL_Y + 8], face: 'up', act: () => hint('🏙️ Skyskraporna i finanskvarteret. Börsen rullar på tornet mitt emot.') });
  addSpot({ id: 'fonster2', r: [DOOR.x1 + 4, GLASS.top, GLASS.x1 - 2, WALL_Y - 2], go: [372, WALL_Y + 8], face: 'up', act: () => hint('🏙️ Höga hus så långt man ser. Här jobbar alla med slips.') });
  const spotAt = (x, y) => {
    // säljaren först (om man träffar figuren)
    if (Math.abs(x - sel.w.px) < 8 && y > sel.w.py - 38 && y < sel.w.py + 2) return { id: 'saljare', seller: true };
    return spots.find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]) || null;
  };
  const spotById = (id) => spots.find((s) => s.id === id) || null;
  function onProduct(id, v) {
    const p = prodOf(id);
    if (!p) return;
    if (cart) {
      if (cart.p.id === id) { putBack(); return; }
      hint('📦 En sak i taget – först kassan!');
      return;
    }
    productSheet(p, v);
  }
  function clickSpot(s) {
    if (s.seller) {
      const side = walker.px < sel.w.px ? -14 : 14;
      const cand = [[sel.w.px + side, sel.w.py + 2], [sel.w.px - side, sel.w.py + 2], [sel.w.px, sel.w.py + 16]].find(([cx, cy]) => walker.walkable(cx, cy)) || [sel.w.px, sel.w.py + 16];
      sel.state = 'talk'; sel.t = 6; sel.w.stop();
      walker.walkTo(cand[0], cand[1], () => talkToSeller());
      return;
    }
    if (cart && s.prod && s.prod !== cart.p.id) { hint('📦 En sak i taget – först kassan!'); return; }
    walker.walkTo(s.go[0], s.go[1], () => { walker.dir = s.face || 'up'; s.act(); });
  }
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && (hoverSpot?.id === hoverId ? hoverSpot : spotById(hoverId));
    if (h && (h.prod || h.demo || h.id === 'kassa' || h.id === 'dorr')) return h;
    if (walker.path.length) return null;
    return spots.find((s) => (s.prod || s.demo) && Math.abs(walker.px - s.go[0]) < 8 && Math.abs(walker.py - s.go[1]) < 8) || null;
  };

  // ---------- ritning ----------
  function drawScreens(ctx, night) {
    // TV-väggen: rendera varje skärmstorlek en gång (12 bilder/s) och rita samma bild på alla
    const inStatic = (t % PROG_SECS) < STATIC_SECS && t > PROG_SECS;
    const prog = inStatic ? 'brus' : progAt(t);
    const frame = Math.floor(t * 12);
    for (const [, S] of R.tv) if (S.key !== prog + frame) { S.key = prog + frame; renderScreen(S, prog, t); }
    for (const T of TVS) ctx.drawImage(R.tv.get(`${T.w}x${T.h}`).cv, T.x, T.y);
    // skärmskenet på väggen runt TV-apparaterna
    ctx.fillStyle = night ? 'rgba(140,170,255,0.10)' : 'rgba(140,170,255,0.05)';
    for (const T of TVS) ctx.fillRect(T.x - 4, T.y + T.h + 2, T.w + 8, 2);
  }
  // bilspelet på podiets TV (ritas efter podiet – annars täcker dess målade ram bilden)
  function drawGameTv(ctx) {
    const gs = R.gameTv, frame = Math.floor(t * 12), demo = !kid.here();
    if (gs.key !== 'race' + frame) { gs.key = 'race' + frame; renderScreen(gs, 'race', t, racePixel); }
    ctx.drawImage(gs.cv, GAME_TV.x, GAME_TV.y);
    const cx = GAME_TV.x + (GAME_TV.w >> 1) - 3 + Math.round(Math.sin(t * 1.3) * 3), cy = GAME_TV.y + GAME_TV.h - 6;
    CAR.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = ch === 'r' ? '#e83a3a' : ch === 'w' ? '#9ad0f0' : '#1a1a20'; ctx.fillRect(cx + i, cy + j, 1, 1); } });
    if (demo && Math.floor(t * 1.5) % 2) ctxText(ctx, SMALL, 'DEMO', GAME_TV.x + 2, GAME_TV.y + 2, '#ffffff');
  }
  function drawDeviceScreens(ctx, table) {
    for (const s of R.screens) {
      if (s.table !== table) continue;
      const k = WPS[(Math.floor((t + s.seed * 1.7) / 4) + s.seed) % WPS.length];
      ctx.drawImage(wallpaper(k, s.w, s.h), s.x, s.y);
      if (s.island) { ctx.fillStyle = '#0c0e14'; ctx.fillRect(s.x + (s.w >> 1), s.y, 1, 1); }
    }
  }
  function drawOutside(ctx, night) {
    // allt på gatan klipps mot glasfasaden
    ctx.save();
    ctx.beginPath(); ctx.rect(GLASS.x0, GLASS.top, GLASS.x1 - GLASS.x0, WALL_Y - GLASS.top - 2); ctx.clip();
    // tickern på tornet
    const tk = R.ticker, off = Math.floor(t * 14) % tk.w;
    ctx.save(); ctx.beginPath(); ctx.rect(TICKER.x0, TICKER.y, TICKER.x1 - TICKER.x0, TICKER.h); ctx.clip();
    ctx.drawImage(tk.img, TICKER.x0 - off, TICKER.y); ctx.drawImage(tk.img, TICKER.x0 - off + tk.w, TICKER.y);
    ctx.restore();
    for (const c of cars) ctx.drawImage(c.img, Math.round(c.x), c.y);
    for (const p of walkers) drawPerson(ctx, p.x, p.y, p.look, p.dir > 0 ? 'right' : 'left', WALK_SEQ[Math.floor(t * 7 + p.x * 0.01) % 4]);
    // vädret: gråare himmel och hus när det är mulet, regn i snedstreck, snöflingor, dimma
    const w = weather(), GW = GLASS.x1 - GLASS.x0;
    if (w && ['moln', 'regn', 'snö', 'dimma'].includes(w.kind)) {
      const k = w.kind === 'dimma' ? 0.55 : w.kind === 'moln' ? 0.16 + 0.14 * (w.cloud ?? 0.7) : 0.3;
      ctx.fillStyle = night ? `rgba(14,18,34,${(k * 0.8).toFixed(3)})` : w.kind === 'dimma' ? `rgba(214,220,228,${k})` : w.kind === 'snö' ? `rgba(196,204,216,${k})` : `rgba(112,122,140,${k})`;
      ctx.fillRect(GLASS.x0, GLASS.top, GW, WALL_Y - GLASS.top);
    }
    if (w && (w.kind === 'regn' || w.kind === 'snö')) {
      const snow = w.kind === 'snö', n = Math.round(drops.length * (0.45 + 0.55 * (w.intensity ?? 0.6)));
      ctx.fillStyle = snow ? 'rgba(255,255,255,0.95)' : night ? 'rgba(170,190,230,0.6)' : 'rgba(226,236,255,0.75)';
      for (let i = 0; i < n; i++) {
        const d = drops[i], sp = snow ? 12 * d.s : 110 * d.s, span = WALL_Y - GLASS.top;
        const y = GLASS.top + ((d.y - GLASS.top + t * sp) % span), x = GLASS.x0 + (((d.x - GLASS.x0 + (snow ? Math.sin(t * 0.8 + i) * 3 : -(t * sp) * 0.25)) % GW) + GW) % GW;
        const rx = Math.round(x), ry = Math.round(y);
        if (snow) { ctx.fillRect(rx, ry, 1, 1); if (i % 4 === 0) ctx.fillRect(rx + 1, ry, 1, 1), ctx.fillRect(rx, ry + 1, 1, 1); }
        else { ctx.fillRect(rx, ry, 1, 2); ctx.fillRect(rx - 1, ry + 2, 1, 2); }
      }
    }
    ctx.restore();
    // glaset, karmarna och skjutdörrarna
    put(ctx, glassOf(R, night));
    const dp = doorOf(R, night), o = Math.round(door * 17), dw = (DOOR.x1 - DOOR.x0) / 2;
    ctx.drawImage(dp, DOOR.x0 - o, GLASS.top);
    ctx.drawImage(dp, DOOR.x0 + dw + o, GLASS.top);
    // regndroppar på själva rutan
    if (w?.kind === 'regn') {
      ctx.fillStyle = 'rgba(230,240,255,0.5)';
      for (let i = 0; i < 14; i++) { const x = GLASS.x0 + 4 + hash(i, 5, 62) * (GLASS.x1 - GLASS.x0 - 8), y = GLASS.top + ((hash(i, 6, 62) * 50 + t * (2 + hash(i, 7, 62) * 4)) % 50); if (x < DOOR.x0 - 2 || x > DOOR.x1 + 2) ctx.fillRect(Math.round(x), Math.round(y), 1, 2); }
    }
  }
  function drawRgb(ctx, i) {
    // gamingbordets RGB-list under skivan och skenet på golvet
    const D = GD[i];
    for (let x = 0; x < GD_W - 8; x++) {
      ctx.fillStyle = `hsl(${(x * 6 + t * 120 + i * 90) % 360},95%,58%)`;
      ctx.fillRect(D.x0 + 4 + x, GD_BASE - 9, 1, 1);
    }
    ctx.fillStyle = `hsla(${(t * 90 + i * 120) % 360},90%,60%,0.18)`;
    ctx.fillRect(D.x0 + 6, GD_BASE - 1, GD_W - 12, 2);
    // GAMING i regnbågsljus på vänstra bordets front
    if (i === 0) {
      const s = 'GAMING';
      let cx = D.x0 + ((GD_W - textW(SMALL, s)) >> 1);
      for (const ch of s) { ctxText(ctx, SMALL, ch, cx, GD_BASE - 15, `hsl(${(cx * 8 + t * 160) % 360},95%,62%)`); cx += textW(SMALL, ch) + 1; }
    }
  }
  // prova-ön med sina skärmar och lampor: klockornas urtavlor, högtalarens LED-ring (och
  // noterna när den spelar), baselementen som pumpar, kamerans blixt och actionkamerans lampa
  function drawIsland(ctx) {
    put(ctx, R.island);
    const top = ISL_TOP;
    WATCHES.forEach((Wt, i) => {
      const sx = Wt.x + 2, sy = top - 9;
      ctx.fillStyle = '#0a0e18'; ctx.fillRect(sx, sy, 3, 4);
      if (i === 0) { // en sekundvisare som går runt kanten
        const per = [[1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]], k = per[Math.floor(t * 2.5) % per.length];
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 1, sy + 1, 1, 2);
        ctx.fillStyle = '#5ad8ff'; ctx.fillRect(sx + k[0], sy + k[1], 1, 1);
      } else if (i === 1) { // aktivitetsstaplar som fylls på
        ['#ff4a6a', '#9af04a', '#4ad8ff'].forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(sx, sy + j, 1 + (Math.floor(t * 1.5 + j * 1.3) % 3), 1); });
      } else { // ett hjärta som slår
        const beat = (t * 1.3) % 1 < 0.22;
        ctx.fillStyle = beat ? '#ff3a4a' : '#b02838';
        ctx.fillRect(sx, sy + 1, 1, 1); ctx.fillRect(sx + 2, sy + 1, 1, 1); ctx.fillRect(sx, sy + 2, 3, 1); ctx.fillRect(sx + 1, sy + 3, 1, 1);
        if (beat) ctx.fillRect(sx + 1, sy + 1, 1, 1);
      }
    });
    const e = t - demo.spk, playing = e >= 0 && e < DEMO_SECS;
    for (let i = 0; i < SPK.w - 2; i++) {
      ctx.fillStyle = playing ? ((Math.floor(t * 10) + i) % 7 < 3 ? '#b8f6ff' : '#20b8f0') : Math.sin(t * 1.4) > 0.3 ? '#2a6a8a' : '#1a4058';
      ctx.fillRect(SPK.x + 1 + i, top - SPK.h, 1, 1);
    }
    if (playing) {
      for (let i = 0; i < 3; i++) { // tre noter som stiger och bleknar
        const k = (e * 0.9 + i / 3) % 1, nx = Math.round(SPK.x + 1 + i * 9 + Math.sin((e + i) * 3) * 2), ny = Math.round(top - SPK.h - 5 - k * 16);
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillStyle = ['#ff6ab8', '#20b8f0', '#ffb020'][i];
        ctx.fillRect(nx + 2, ny, 1, 4); ctx.fillRect(nx, ny + 3, 2, 2); ctx.fillRect(nx + 3, ny, 1, 1);
      }
      ctx.globalAlpha = 1;
      if (Math.floor(e * 6) % 2 === 0) { ctx.fillStyle = 'rgba(150,156,168,0.75)'; for (const cx of [BOOM.x + 4, BOOM.x + BOOM.w - 5]) ctx.fillRect(cx - 1, top - 6, 3, 3); }
    }
    const cf = t - demo.cam;
    if (cf >= 0 && cf < 0.2) {
      ctx.fillStyle = 'rgba(255,251,224,0.35)'; ctx.fillRect(CAMS.x - 3, top - 16, 9, 9);
      ctx.fillStyle = '#fffbe0'; ctx.fillRect(CAMS.x, top - 13, 3, 3);
    }
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff3a3a' : '#5a1a1a'; ctx.fillRect(CAMS.x + 21, top - 6, 1, 1);
  }
  function drawAtlas(ctx, k, v, x, base) {
    const a = typeof ROOM.furnArt === 'function' ? ROOM.furnArt(k, v, null) : null;
    if (!a) return 0;
    ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, Math.round(x), Math.round(base - a.sh), a.sw, a.sh);
    return a.sw;
  }
  function highlight(ctx, s) {
    if (!s?.r) return;
    const [x0, y0, x1, y1] = s.r, on = Math.floor(t * 3) % 2;
    ctx.fillStyle = on ? 'rgba(255,255,255,0.9)' : 'rgba(32,184,240,0.9)';
    ctx.fillRect(x0, y0, x1 - x0, 1); ctx.fillRect(x0, y1, x1 - x0 + 1, 1); ctx.fillRect(x0, y0, 1, y1 - y0); ctx.fillRect(x1, y0, 1, y1 - y0);
  }
  function drawHeld(ctx, px, py, dir) {
    const ox = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
    if (cart) {
      const big = cart.p.type === 'furn' && (cart.p.k === 'tv' || cart.p.k === 'dator' || cart.p.k === 'retrotv');
      const img = big ? R.bigBox : R.box;
      ctx.drawImage(img, Math.round(px + ox - img.width / 2), Math.round(py - 12 - img.height));
    } else if (bag) ctx.drawImage(R.bag, Math.round(px + ox - 5), Math.round(py - 25));
  }
  function drawWorld(ctx, cx, cy, vw, vh) {
    const night = isNight();
    ctx.drawImage(bgOf(R, night), cx, cy, vw, vh, cx, cy, vw, vh);
    drawScreens(ctx, night);
    drawOutside(ctx, night);
    const inView = (x0, y0, x1, y1) => x1 >= cx - 8 && x0 <= cx + vw + 8 && y1 >= cy - 8 && y0 <= cy + vh + 8;
    const items = [];
    const add = (fy, box, draw) => { if (inView(...box)) items.push({ fy, draw }); };
    add(TVB.base, [TVB.x0, TVB.base - 16, TVB.x1, TVB.base], () => put(ctx, R.bench));
    // expediten bakom disken, sedan disken
    add(EXP.y, [EXP.x - 12, EXP.y - 40, EXP.x + 12, EXP.y], () => {
      const scanning = exp.mode === 'scan';
      drawPerson(ctx, EXP.x, EXP.y, CLERK, scanning ? (scan ? 'right' : 'left') : exp.dir, scanning ? 9 : Math.sin(t * 1.4) > 0.93 ? 4 : 0);
    });
    add(CNT.base, [CNT.x0 - 4, CNT.top - 12, CNT.x1 + 4, CNT.base], () => {
      put(ctx, R.counter);
      // kunddisplayen: priset som piper in
      const sum = scan ? cart?.price ?? 0 : 0, st = scan ? String(sum) : t - paidT < 3 ? 'TACK!' : 'HEJ!';
      ctxText(ctx, SMALL, st, 462 - textW(SMALL, st), CNT.top - 7, scan && Math.floor(t * 8) % 2 ? '#ffffff' : '#6fe08a');
      // lådan på disken medan den slås in
      if (scan && cart) ctx.drawImage(R.box, 478, CNT.top - 7);
    });
    add(HPT.base, [HPT.x0, HPT.base - 26, HPT.x1, HPT.base], () => put(ctx, R.hpTable));
    add(CON.base, [CON.x0, GAME_TV.y - 3, CON.x1, CON.base], () => {
      put(ctx, R.podium);
      drawGameTv(ctx);
      [0, 1, 2].forEach((v) => drawAtlas(ctx, 'spelkonsol', v, CON.x0 + 58 + v * 20, CON.base - 11));
    });
    add(RET.base, [RET.x0, RET.base - 42, RET.x1, RET.base], () => {
      put(ctx, R.retro);
      drawAtlas(ctx, 'retrotv', 0, RET.x0 + 9, RET.base - 17);
      [0, 1, 2].forEach((v) => drawAtlas(ctx, 'telefon', v, RET.x0 + 34 + v * 16, RET.base - 17));
    });
    add(PT.base, [PT.x0, PT.base - 46, PT.x1, PT.base], () => { put(ctx, R.phoneTable); drawDeviceScreens(ctx, 'phones'); });
    add(TT.base, [TT.x0, TT.base - 46, TT.x1, TT.base], () => { put(ctx, R.tabTable); drawDeviceScreens(ctx, 'tabs'); });
    GD.forEach((D, i) => add(GD_BASE, [D.x0, GD_BASE - 46, D.x0 + GD_W, GD_BASE], () => {
      put(ctx, R.gdesks[i]);
      const a = ROOM.furnArt?.('tv', D.v, null);
      if (a) drawAtlas(ctx, 'tv', D.v, D.x0 + (GD_W - a.sw) / 2, GD_BASE - 17);
      drawRgb(ctx, i);
    }));
    add(CD.base, [CD.x0, CD.base - 46, CD.x1, CD.base], () => {
      put(ctx, R.cdesk);
      [0, 1, 2, 3].forEach((v) => { drawAtlas(ctx, 'datortorn', v, slotX(v), CD.base - 16); drawAtlas(ctx, 'dator', v, slotX(v) + 9, CD.base - 16); });
    });
    add(LT.base, [LT.x0, LT.base - 40, LT.x1, LT.base], () => {
      put(ctx, R.ltable);
      [0, 1].forEach((v) => drawAtlas(ctx, 'laptop', v, LT.x0 + 13 + v * 22, LT.base - 16));
    });
    add(STD.base, [STD.x - 2, STD.base - STD.h - 10, STD.x + STD.w + 2, STD.base], () => {
      put(ctx, R.standee);
      const S = R.standTv, frame = Math.floor(t * 8);
      if (S.key !== 'paron' + frame) { S.key = 'paron' + frame; renderScreen(S, 'paron', t, paronPixel); }
      ctx.drawImage(S.cv, STD.x + 6, STD.base - STD.h + 12);
    });
    add(ISL.base, [ISL.x0 - 2, ISL_TOP - 40, ISL.x1 + 2, ISL.base], () => drawIsland(ctx));
    add(AF.base, [AF.x, AF.base - 24, AF.x + AF.w, AF.base], () => put(ctx, R.aframe));
    for (const p of PLANTS) add(p.base, [p.x, p.base - 34, p.x + 16, p.base], () => ctx.drawImage(R.plants[p.k].img, p.x, p.base - 34));
    // barnet vid spelkonsolen
    if (kid.here()) add(KID.y, [KID.x - 12, KID.y - 40, KID.x + 12, KID.y], () => drawPerson(ctx, KID.x, KID.y, KID_LOOK, 'up', Math.sin(t * 5) > 0.7 ? 7 : 9));
    // säljaren
    add(sel.w.py, [sel.w.px - 12, sel.w.py - 40, sel.w.px + 12, sel.w.py], () => {
      const walking = sel.w.path.length > 0;
      drawPerson(ctx, sel.w.px, sel.w.py, SELLER, walking ? sel.w.dir : sel.dir, walking ? WALK_SEQ[Math.floor(t * 7) % 4] : Math.sin(t * 1.7) > 0.93 ? 4 : 0);
    });
    // kunderna
    for (const n of npcs) {
      if (n.state === 'away') continue;
      const w = n.w, walking = w.path.length > 0;
      const trying = n.state === 'try' && !['tv', 'retro', 'hp', 'speaker'].includes(n.goal?.act); // håller i prylen
      const frame = n.bag ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : trying ? 9 : Math.sin(t * 2 + w.px) > 0.9 ? 4 : 0;
      const look = n.state === 'try' && n.goal?.act === 'hp' && n.lookHp ? n.lookHp : n.look;
      add(w.py, [w.px - 12, w.py - 44, w.px + 12, w.py + 2], () => {
        drawPerson(ctx, w.px, w.py, look, w.dir, frame);
        if (n.bag && w.dir !== 'up') ctx.drawImage(R.bag, Math.round(w.px + (w.dir === 'left' ? -6 : w.dir === 'right' ? 6 : 0) - 5), Math.round(w.py - 25));
      });
    }
    // andra spelare och jag
    for (const d of folkDrawables(A, t)) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
    const carrying = !!cart || bag;
    const me = selfDrawable(A, walker, t, { carry: carrying, folksHere: worldFolksHere(A).length });
    items.push({
      fy: walker.py, me: true,
      draw: () => {
        if (carrying && walker.dir === 'up') drawHeld(ctx, walker.px, walker.py, walker.dir);
        me.draw(ctx);
        if (carrying && walker.dir !== 'up') drawHeld(ctx, walker.px, walker.py, walker.dir);
      },
    });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    // jag syns svagt även bakom borden
    const ghost = items.find((it) => it.me);
    if (ghost) { ctx.globalAlpha = 0.22; ghost.draw(); ctx.globalAlpha = 1; }
    const f = focusSpot();
    if (f) highlight(ctx, f);
  }
  // ---------- HUD: det man bär (panel) och namnskylten för det man pekar på ----------
  function drawPanel(ctx) {
    panelHits = [];
    if (!cart) return;
    const safe = A.view?.safe || { x0: 0, y0: 0, x1: VW };
    // panelen får aldrig täcka dörren (eller figuren): den står på andra sidan
    const w = 124, h = 36, doorX = DOOR_X - cam.x, meX = walker.px - cam.x;
    const doorVis = doorX > -24 && doorX < VW + 24;
    const right = doorVis ? doorX < VW / 2 : meX < VW / 2 && walker.py - cam.y < 90;
    const x0 = right ? Math.min(VW, safe.x1 ?? VW) - w - 4 : 4 + Math.max(0, safe.x0 | 0), y0 = 4 + Math.max(0, safe.y0 | 0);
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = hexs(CYAN); ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#f6f8fc'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = hexs(NAVY); ctx.fillRect(x0, y0, w, 11);
    ctxText(ctx, SMALL, 'I HÄNDERNA', x0 + 4, y0 + 3, '#ffffff');
    const pr = `${cart.price} KR`;
    ctxText(ctx, SMALL, pr, x0 + w - 4 - textW(SMALL, pr), y0 + 3, hexs(YEL));
    const nm = cart.name.toUpperCase().replace(/[^A-ZÅÄÖÉ0-9 .:!?-]/g, '').slice(0, 26);
    ctxText(ctx, SMALL, nm, x0 + 4, y0 + 14, '#2a2430');
    const btn = scan ? 'PIP PIP...' : 'TILL KASSAN';
    const blink = !scan && Math.floor(t * 2) % 2 === 0;
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0 + 3, y0 + 22, w - 6, 11);
    ctx.fillStyle = scan ? '#8a909a' : blink ? '#ffd23f' : '#f0c020'; ctx.fillRect(x0 + 4, y0 + 23, w - 8, 9);
    ctxText(ctx, SMALL, btn, x0 + Math.round((w - textW(SMALL, btn)) / 2), y0 + 25, '#1a1420');
    if (!scan) panelHits.push({ r: [x0 + 3, y0 + 22, x0 + w - 3, y0 + 33], act: () => goPay() });
  }
  function bigLabel(ctx, s, atTop) {
    let name, price = '', sub, col = hexs(CYAN);
    if (s.prod) {
      const p = prodOf(s.prod), pr = priceOf(g, p), block = blockedOf(g, p);
      name = nameOf(p).toUpperCase(); price = pr != null ? `${pr} KR` : '';
      sub = cart ? (cart.p.id === p.id ? 'KLICKA FÖR ATT STÄLLA TILLBAKA' : 'EN SAK I TAGET - FÖRST KASSAN') : block ? block.toUpperCase().replace(/–/g, '-').replace(/[^A-ZÅÄÖÉ0-9 .:!?-]/g, '') : 'KLICKA FÖR ATT TITTA OCH KÖPA';
    } else if (s.id === 'kassa') { name = 'KASSAN'; price = cart ? `${cart.price} KR` : ''; sub = cart ? 'KLICKA SÅ BETALAR DU' : 'VÄLJ EN VARA FÖRST'; col = hexs(YEL); }
    else if (s.id === 'dorr') { name = 'UTGÅNG'; sub = cart ? 'BETALA FÖRST!' : 'UT TILL DOWNTOWN'; col = hexs(YEL); }
    else if (s.demo) { name = { klocka: 'SMARTKLOCKOR', hogtalare: 'HÖGTALARE', kamera: 'KAMEROR' }[s.id] || 'NYHETER'; sub = 'PROVA GÄRNA - SÄLJS SNART'; col = '#ff6ab8'; }
    else return;
    const nw = textW(BIG, name), pw = price ? textW(BIG, price) : 0, hw = textW(SMALL, sub);
    const w = Math.max(nw + pw + (price ? 8 : 0), hw) + 12, h = 22;
    const safe = A.view?.safe || { y0: 0, y1: VH };
    const x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 + Math.max(0, safe.y0 | 0) + (cart ? 42 : 0) : Math.min(VH, safe.y1 ?? VH) - h - 3;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
    ctxText(ctx, BIG, name, x0 + 6, y0 + 3, '#ffffff');
    if (price) ctxText(ctx, BIG, price, x0 + 6 + nw + 8, y0 + 3, col);
    ctxText(ctx, SMALL, sub, x0 + 6, y0 + 14, Math.floor(t * 2) % 2 === 0 ? col : '#c9c2d2');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() { pendingHello = 0.8; },
    exit() {
      // obetald låda släpps (inga pengar dras), påsen följer inte med ut
      cart = null; scan = null;
      talk.clear(); talkExp.clear(); talkSel.clear(); talkKid.clear(); for (const n of npcs) n.talk.clear();
    },
    // Får man lämna butiken via huvudprogrammets knappar? (null = ja) – en obetald låda
    // släpps bara, så det går alltid.
    leaveBlock() { return null; },
    _debug: {
      spot: (id, i = 0) => {
        const P = { gang: [330, 140], kassa: [CNT.x0 + 40, CNT.top + 6], dorr: [DOOR_X, 50], 'dörr': [DOOR_X, 50], tvvagg: [100, 40], saljare: [sel.w.px, sel.w.py - 20] }[id];
        let x, y;
        if (P) [x, y] = P;
        else {
          const s = spots.filter((q) => q.id === id)[i];
          if (!s) return null;
          x = (s.r[0] + s.r[2]) / 2; y = (s.r[1] + s.r[3]) / 2;
        }
        return { x: x - cam.x, y: y - cam.y };
      },
      products: () => PRODUCTS.map((p) => ({ id: p.id, type: p.type, k: p.k || null, name: nameOf(p), price: priceOf(g, p), blocked: blockedOf(g, p) })),
      pick: (id, v = 0) => { const p = prodOf(id); return p ? pickUp(p, v) : false; },
      pay: () => pay(),
      buy: (id, v = 0) => { const p = prodOf(id); if (!p) return { ok: false, msg: 'finns inte' }; if (!pickUp(p, v)) return { ok: false, msg: blockedOf(g, p) || 'går inte' }; walker.stop(); return pay(); },
      putBack: () => { putBack(); return !cart; },
      // prylarnas nytta: den här modellens och den bästa man redan har
      gadgetInfo: (id) => ({ bonus: bonusOf(id), best: bestOwned(g, gadgetKind(id)) }),
      // prova-ön: när högtalaren spelade / kameran blixtrade senast (och tiden nu)
      demo: () => ({ ...demo, t }),
      tryDemo: (id) => { const s = spotById(id); if (s?.demo) s.act(); return !!s?.demo; }, // prova direkt (utan att gå dit)
      state: () => ({
        money: g.money, cart: cart ? { id: cart.p.id, v: cart.v, price: cart.price } : null, bag, scan: scan ? { t: +scan.t.toFixed(2), done: scan.done } : null, lastBuy,
        pos: { x: Math.round(walker.px), y: Math.round(walker.py), path: walker.path.length }, cam: { ...cam }, night: isNight(), hour: hour(),
        prog: progAt(t), door: +door.toFixed(2), kid: kid.here(), seller: { x: Math.round(sel.w.px), y: Math.round(sel.w.py), state: sel.state },
        npcs: npcs.map((n) => ({ i: n.i, state: n.state, x: Math.round(n.w.px), y: Math.round(n.w.py), goal: n.goal?.kind || null, bag: n.bag })),
        cars: cars.length, walkers: walkers.length, weather: weather()?.kind ?? null,
      }),
      // TV-väggen: färgen i samma (u, v)-punkter på varje TV – ska vara samma bild
      tvSample: (pts = [[0.5, 0.25], [0.2, 0.8], [0.8, 0.8], [0.5, 0.6]]) => TVS.map((T) => {
        const S = R.tv.get(`${T.w}x${T.h}`), d = S.ctx.getImageData(0, 0, S.w, S.h).data;
        return pts.map(([u, v]) => { const x = Math.min(S.w - 1, Math.floor(u * S.w)), y = Math.min(S.h - 1, Math.floor(v * S.h)), k = (y * S.w + x) * 4; return [d[k], d[k + 1], d[k + 2]]; });
      }),
      // TV-väggen: medelfärgen på varje skärm (samma bild i olika upplösning ≈ samma medelfärg)
      tvMean: () => TVS.map((T) => {
        const S = R.tv.get(`${T.w}x${T.h}`), d = S.ctx.getImageData(0, 0, S.w, S.h).data, n = S.w * S.h, m = [0, 0, 0];
        for (let k = 0; k < d.length; k += 4) { m[0] += d[k]; m[1] += d[k + 1]; m[2] += d[k + 2]; }
        return m.map((v) => Math.round(v / n));
      }),
      tvTime: (secs) => { t = secs; },
      wakeNpcs: () => { npcs.forEach((n, i) => { if (n.state === 'away') n.t = 0.3 + i; }); },
      // tvinga vädret utanför fasaden (null = det riktiga igen)
      weather: (kind, intensity = 0.8) => { if (kind) { wx = { kind, intensity, cloud: 0.8 }; wxT = t + 1e6; } else { wx = null; wxT = -9; } return weather()?.kind ?? null; },
      check: () => { // går allt att nå och klicka?
        const out = [];
        for (const s of spots) {
          const p = walker.findPath(DOOR_X, WALL_Y + 8, s.go[0], s.go[1]), last = p[p.length - 1];
          if (!last || Math.hypot(last[0] - s.go[0], last[1] - s.go[1]) > 6) out.push(`${s.id}${s.v != null ? s.v : ''} går inte att nå`);
          const cx = (s.r[0] + s.r[2]) / 2, cy = (s.r[1] + s.r[3]) / 2, hit = spots.find((q) => cx >= q.r[0] && cx <= q.r[2] && cy >= q.r[1] && cy <= q.r[3]);
          if (hit !== s) out.push(`${s.id}${s.v != null ? s.v : ''} skyms av ${hit?.id}`);
        }
        for (const [x, y] of [...BROWSE.map((b) => [b[0], b[1]]), ...SELLER_SPOTS.map((b) => [b[0], b[1]]), ...NPC_IN, PAY, NPC_PAY, QUEUE]) if (!walker.walkable(x, y)) out.push(`platsen ${x},${y} står i ett hinder`);
        return out;
      },
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: clamp(x, 0, W - VW), y: clamp(y ?? cam.y, 0, H - VH) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      walkable: (x, y) => walker.walkable(x, y),
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => ({ ...cam }),
      pos: () => ({ x: walker.px, y: walker.py, path: walker.path.length }),
      speech: () => talk.text(),
      hideNpcs: () => { for (const n of npcs) { n.state = 'away'; n.t = 999; } },
      npcs: () => npcs.map((n) => ({ i: n.i, state: n.state, x: Math.round(n.w.px), y: Math.round(n.w.py) })),
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, 0, W, H);
        const all = { x0: 0, x1: W };
        talkExp.draw(x, all); talkSel.draw(x, all); talkKid.draw(x, all); for (const n of npcs) n.talk.draw(x, all); talk.draw(x, all);
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      if (pendingHello > 0) { pendingHello -= dt; if (pendingHello <= 0) expSay(isNight() ? 'Hej! Vi har kvällsöppet!' : 'Hej och välkommen till BLIXT!', 3, true); }
      // skjutdörrarna öppnas när någon är nära (ding-dong när jag går in eller ut)
      const near = [{ x: walker.px, y: walker.py, me: true }, ...npcs.filter((n) => n.state !== 'away').map((n) => ({ x: n.w.px, y: n.w.py }))].some((p) => Math.abs(p.x - DOOR_X) < 20 && p.y < WALL_Y + 20);
      if (near && !doorWas && Math.abs(walker.px - DOOR_X) < 20 && walker.py < WALL_Y + 20) chime();
      door += ((near ? 1 : 0) - door) * Math.min(1, dt * 7);
      doorWas = near;
      updateStreet(dt);
      updateClerk(dt);
      updateSeller(dt);
      for (const n of npcs) updateNpc(n, dt);
      updateScan(dt);
      if (kid.here()) { kid.lineT -= dt; if (kid.lineT <= 0) { kid.lineT = 10 + Math.random() * 14; if (KID.x > cam.x && KID.x < cam.x + VW) talkKid.say(KID_LINES[Math.floor(Math.random() * KID_LINES.length)], { x: KID.x, y: KID.y - 36 }, 2.4, { voice: KID_LOOK }); } }
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },

    down(sx, sy) {
      hoverId = null; hoverSpot = null;
      for (const h of panelHits) if (sx >= h.r[0] && sx <= h.r[2] && sy >= h.r[1] && sy <= h.r[3]) { h.act(); return; }
      const x = sx + cam.x, y = sy + cam.y;
      const s = spotAt(x, y);
      if (s) { clickSpot(s); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { const s = spotAt(sx + cam.x, sy + cam.y); hoverSpot = s && !s.seller ? s : null; hoverId = hoverSpot?.id || null; hoverT = t; },
    key(k) { if (k === 'Escape' && cart && !modalOpen()) putBack(); },

    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      const view = { x0: cx, x1: cx + VW };
      if (expInView()) talkExp.draw(ctx, view);
      talkSel.draw(ctx, view);
      talkKid.draw(ctx, view);
      for (const n of npcs) if (n.w.px > cx - 6 && n.w.px < cx + VW + 6) n.talk.draw(ctx, view);
      talk.draw(ctx, view);
      // kamerablixten på prova-ön: hela vyn blir vit en kort stund
      const fl = t - demo.flash;
      if (fl >= 0 && fl < 0.35) { ctx.fillStyle = `rgba(255,255,255,${(0.8 * (1 - fl / 0.35)).toFixed(3)})`; ctx.fillRect(cx, cy, VW, VH); }
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawPanel(ctx);
      const focus = focusSpot();
      if (focus) bigLabel(ctx, focus, walker.py - cam.y > VH - 60);
    },
  };
}
