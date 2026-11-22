// 🧸 DOCKSKÅPET – lekläget (Carl 2026-11-21: "ett mode där man likt Toca Boca kan möblera …
// vi vill ha med husdjuren och allt sådant … lägg som ett menyval på första sidan").
// Ett eget hus med fem rum i rad (vardagsrum, kök, barnrum, sovrum, badrum) som man möblerar
// fritt: hela möbelkatalogen ligger i lådan, gratis, och allt dras med fingret – från lådan in
// i rummet, mellan rummen och upp på borden. Inga pengar, ingen klocka, inga behov: spelet
// (A.game) står still medan man leker (main.js tickReal hoppar över scener med .dockskap).
// Huset sparas för sig i localStorage (DOCK_KEY), utanför sparfilen, och syns inte i världen.
//   • Rummen ritas som hemma (room.js buildBg, spriteProp, wallProp …) med samma möbelbilder,
//     rotationer, omfärgning, bordsskivor att ställa småsaker på (ON_TABLE/SURFACES) och brasor.
//   • Tryck och dra på en möbel = flytta den (också till ett annat rum – det som står på ett
//     bord följer med). Ett kort tryck = menyn: vrid, byt modell, färg, tänd, ta bort.
//     Dra i tomrummet = panorera; rumsknapparna i lådan hoppar till ett rum.
//   • Lådan: dra en möbel från lådan rakt in i rummet, eller tryck på den och sedan i rummet.
//   • 🌙 Natt: lamporna tänds och rummen mörknar (room.js light).
//   • Dörren UT i första rummet och ⬅ i lådan går tillbaka dit man kom ifrån (A.leaveDockskap).
//   • Figurerna (v0.163): fliken 🧑 i lådan har alla sparade figurer och sex egna bottar (makeLookRich,
//     samma varje gång – de ligger i huset). Dra in en figur i ett rum, dra den mellan rummen; släpps den
//     på en soffa, stol eller säng sätter den sig (frame 5). Kort tryck = Prata (en pratbubbla på valt
//     språk, med röst), Vänd, Till lådan. Då och då säger någon något av sig själv (på natten sömnigt).
//   • Husdjuren (v0.164): fliken 🐾 har alla raser (katt, hund, kanin) och prylarna (skålar, korgar,
//     bur, klösträd, leksaker, säckar), gratis. Djuren bor i en egen butik (createPetStore,
//     DOCK_PETS_KEY) och ritas och rör sig med husdjurslagret (js/pets/layer.js), ett lager per rum,
//     utan spelklocka (sync: false) – de blir aldrig hungriga. Dra ett djur eller en pryl dit du
//     vill, också till ett annat rum. Kort tryck på ett djur = Klappa, Leka, Till lådan; på en pryl
//     = lagrets egna val (säcken bärs till skålen, bollen kastas, lådan töms).
//   • Lösa saker (v0.164): fliken 🎁 har alla leksaker ur leksaksaffären (js/data/toys.js) och alla
//     råvaror ur mataffären (ravaraIcon), gratis. De ligger på golvet eller uppe på borden (samma
//     bordsskivor som småsakerna), dras mellan rummen, och släpps de på en figur håller den saken i
//     händerna (bär-bildrutan) – mat äts upp på några sekunder ("Mums!"). Släpps de på ett djur blir
//     det glatt: leksaken hamnar vid tassarna, maten äts upp. Kort tryck på en figur som håller något:
//     🧸 Lägg ner. Sakerna sparas i huset (H.saker).
//   • Teman (v0.165): fliken 🎨 gäller rummet i bild: tapet (12), golv (12, Vit marmor med guldådror = plan.lyx),
//     utsikt genom fönstren (7) och åtta färdiga teman (tapet + golv + utsikt i ett tryck); badrummet byter
//     kakel (room.js BATH-stilarna) i stället. Sparas per rum (H.rooms[i].tema) och bakgrunden byggs om (buildBg).
//   • Leka och Bygga (v0.166, Carl 2026-11-22: "två stora knappar i hörnet, leka och bygga … när man är i playmode
//     ska man kunna trycka på dumplings och pianot ska spela melodi och allt sånt"): två stora knappar uppe till
//     vänster. LEKA (huset öppnas så): lådan är borta, möblerna står fast och allt man trycker på svarar – pianot
//     och fiolen spelar en melodi, lamporna tänds och släcks var för sig, brasan tänds, brödrosten poppar, spisen
//     fräser, kranarna bubblar, skärmarna blinkar, soffan och sängen studsar (och den som sitter där hoppar),
//     klockan pinglar, växterna fäller löv, figurerna hoppar och skrattar, djuren blir kärleksfulla, bollen
//     studsar, bilen tutar, klämkompisarna kläms. Figurer, djur och lösa saker går fortfarande att dra. BYGGA:
//     lådan framme och allt som förut. Läget sparas i huset (H.lage).
//   • Belysningen (v0.167, Carl 2026-11-22: "olika belysningar så man kan skapa en mysig miljö … discokula och
//     julbelysning inne"): varje lampa har en ljusfärg (menyn i Bygga: 🎨 Ljus – varmt, vitt, rosa, blått, grönt, lila,
//     rött) och tänds/släcks var för sig; de levande ljusen fladdrar; julbelysningen (blinkande girlangen,
//     adventsljusen, julgranen med ljus) kan släckas (d.slackt). 🪩 Discokulan är husets egen sak (EGNA, ritad i
//     kod): hänger i taket, snurrar och sveper färgade ljusfläckar över rum och golv, och figurerna i rummet dansar.
//     Natten är mörkare (NIGHT_DIM) så lamporna betyder något. Temat 🎄 Jul ställer också fram gran, girlang och
//     julstrumpa i rummet.
// Test: tools/dockskap-test.mjs.
import { buildBg, spriteProp, wallProp, flatProp, rugImg, makePlantProp, dimsOf, isWall, isFlat, ON_TABLE, SURFACES, surfaceRow,
  thumbCanvas, furnView, drawArt, nameOf, canRecolor, halo, FW, FH, WALL_Y, WALL_TOP, DOOR, RUG, APT } from './room.js';
import { createSpeech } from './walkable.js';
import { KATALOG, katalogOf, knownKind, rotStates, functionOf, RAVAROR, ravaraOf } from '../game.js';
import { TOYS, toyOf, toyFrame, toyHit, toyNamn, drawToy, toyFx, SQUISH_STEPS } from '../data/toys.js';
import { ravaraIcon, IW as RAVARA_W } from '../core/ravara-art.js';
import { VISNING } from '../core/visning.js';
import { drawPerson, portrait, makeLookRich } from '../core/people.js';
import { listAvatars } from '../core/avatar.js';
import { seededRng, createPetStore, ARTER, MAX_PETS } from '../pets/sim.js';
import { createPetLayer } from '../pets/layer.js';
import { SPECIES, drawPet, drawPetIcon, petBox, ICON_W, ICON_H } from '../pets/sprites.js';
import { PET_ITEMS, drawPetItem, drawItemIcon } from '../pets/items.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play, toner } from '../core/sound.js';
import { mix, css, Pix } from '../core/floor-pix.js';
import { $t, $n } from '../core/i18n.js';

export const DOCK_KEY = 'snabbfilen_dockskap';
const WALLW = APT.WALLW;
const NIGHT_DIM = 0.42;   // (mörkare än hemma sedan v0.167 – lamporna ska betyda något)
const MAX_I_RUM = 60;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- figurerna ----------
// möbler man sätter sig på (figuren sätter sig när den släpps på möbelns fotavtryck)
const SEATS = new Set(['soffa', 'kuddsoffa', 'fatolj', 'stol', 'matstol', 'kontorsstol', 'barnstol', 'skolstol', 'pall', 'sittbank', 'hallbank',
  'skobank', 'badbank', 'sang', 'enkelsang', 'golvkudde', 'molnkudde', 'stjarnkudde', 'piano', 'kista']);
const BOTTAR = 6;
const DOCK_NAMN = [$t('Alva'), $t('Leo'), $t('Saga'), $t('Elias'), $t('Wilma'), $t('Hugo'), $t('Maja'), $t('Noah'), $t('Ebba'), $t('Liam')];
const DOCK_PRAT = [$t('Vilket fint hus!'), $t('Ska vi leka?'), $t('Jag vill sitta i soffan!'), $t('Var är katten?'), $t('Vem har tagit min nalle?'),
  $t('Dags för mellis!'), $t('Kan jag få en egen säng?'), $t('Titta, vad mysigt!'), $t('Jag gillar den färgen.'), $t('Ska vi byta rum?'),
  $t('Hoppa i sängen!'), $t('Jag är hungrig.'), $t('Får jag bjuda på te?'), $t('Flytta soffan hit!'), $t('Var ska jag sova?'), $t('Hej! Vad heter du?')];
const DOCK_PRAT_NATT = [$t('Godnatt!'), $t('Jag är så trött …'), $t('Släck lampan!'), $t('Zzz …'), $t('Får jag sova här?')];
const nyaBottar = () => Array.from({ length: BOTTAR }, (_, i) => ({ id: 'bot' + i, namn: DOCK_NAMN[i % DOCK_NAMN.length], look: makeLookRich(seededRng(7100 + i * 37)) }));

// ---------- leka och bygga ----------
// Två lägen: i LEKA trycker man på allt och det svarar (möblerna står fast, men figurer, djur och lösa saker
// dras som vanligt); i BYGGA är lådan framme och möblerna dras, vrids, målas. Huset öppnas i Leka.
const LAGEN = ['leka', 'bygga'];
const LAMPOR = new Set(['lampa', 'bordslampa', 'golvlampa', 'nattlampa', 'ljus', 'ljusgrupp', 'julljus']);   // tänds och släcks var för sig (d.lit)
const INSTRUMENT = { piano: 'triangle', fiol: 'sawtooth', skivor: 'square' };   // vågformen melodin spelas med
const MJUKT = new Set(['jattenalle', 'leksakslada', 'byggklossar', 'golvkudde', 'molnkudde', 'stjarnkudde']);
const BOLL = /^boll-/, BIL = /^bil-/;
const DOCK_LEK = [$t('Hihi!'), $t('Det kittlas!'), $t('Hoppsan!'), $t('Igen, igen!'), $t('Wiii!'), $t('Fånga mig!')];
const NOTFARGER = ['#ff5a8a', '#ffd23f', '#5ac8ff', '#8ee08a', '#ff9d3a'];
// melodierna (början på Blinka lilla stjärna, Björnen sover, Imse vimse spindel) – bokstav = ton, mellanslag = paus
const TON = { C: 523, D: 587, E: 659, F: 698, G: 784, A: 880, B: 988, c: 1047, d: 1175 };
const MELODIER = ['CCGGAAG FFEEDDC', 'GABG GABG BcdB cd', 'GCCCDEEE EDCDEC'];
function melodi(type) {
  const m = pick(MELODIER), seq = [];
  let t = 0;
  for (const ch of m) { if (TON[ch]) seq.push([TON[ch], t, 0.16]); t += ch === ' ' ? 0.1 : 0.17; }
  toner(seq, { type, vol: type === 'sawtooth' ? 0.06 : type === 'square' ? 0.07 : 0.11 });
  return seq.length;
}

// ---------- belysningen (v0.167) ----------
const LJUSFARGER = [
  { id: 'varm', namn: $t('Varmt'), c: '#ffe2a0', m: '#fff0c8' }, { id: 'vit', namn: $t('Vitt'), c: '#e8f0ff', m: '#ffffff' },
  { id: 'rosa', namn: $t('Rosa'), c: '#ffb0d8', m: '#ffd8ec' }, { id: 'bla', namn: $t('Blått'), c: '#9ad0ff', m: '#cce8ff' },
  { id: 'gron', namn: $t('Grönt'), c: '#b0ffb0', m: '#d8ffd8' }, { id: 'lila', namn: $t('Lila'), c: '#d0a8ff', m: '#e8d4ff' },
  { id: 'rod', namn: $t('Rött'), c: '#ff9090', m: '#ffc0c0' },
];
const ljusFarg = (d) => LJUSFARGER.find((x) => x.id === d.ljus) || LJUSFARGER[0];
const LEVANDE = new Set(['ljus', 'ljusgrupp', 'julljus']);                                  // levande ljus – fladdrar
const GLODER = new Set(['ljusgirlang', 'adventsljus', 'ljusgran', 'adventsstjarna']);      // lyser av sig själva – kan släckas (d.slackt)
const DISKOFARGER = ['#ff6a9a', '#ffd23f', '#5ac8ff', '#8ee08a', '#d0a8ff', '#ff9d3a'];
// Husets egna saker (finns inte i möbelarket, ritas i kod): discokulan hänger i taket mot bakväggen.
const EGNA = { discokula: { icon: '🪩', name: $t('Discokula'), w: 14, h: 26, wall: true } };
const kand = (k) => knownKind(k) || !!EGNA[k];
const arVagg = (k) => isWall(k) || !!EGNA[k]?.wall;
const dimsAv = (k, v, r) => (EGNA[k] ? { w: EGNA[k].w, h: EGNA[k].h } : dimsOf(k, v, r));
const namnAv = (k) => EGNA[k]?.name || nameOf(k);
// discokulan i tre faser (speglarna vandrar när den snurrar): tråd, fäste, kula med glans
function diskoBild(fas) {
  const P = new Pix(14, 26);
  P.vl(7, 0, 12, 0x5a5a66); P.rect(5, 11, 4, 2, 0x8a8a96); P.hl(5, 11, 4, 0xb0b0bc);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const dx = x - 5.5, dy = y - 5.5;
    if (dx * dx + dy * dy > 36) continue;
    const kant = dx * dx + dy * dy > 27, t = ((x >> 1) + (y >> 1) + fas) % 3;
    P.px(1 + x, 13 + y, kant ? 0x6a7084 : t === 0 ? 0xf4f8ff : t === 1 ? 0xb8c0d0 : 0x8890a4);
  }
  P.px(4, 15, 0xffffff); P.px(5, 15, 0xffffff); P.px(4, 16, 0xffffff);
  return P.flush();
}
let DISKO = null;
const diskoBilder = () => DISKO || (DISKO = [0, 1, 2].map(diskoBild));
const tvattaDocka = (d) => ({ id: String(d.id), room: d.room | 0, x: d.x | 0, y: d.y | 0, dir: ['down', 'up', 'left', 'right'].includes(d.dir) ? d.dir : 'down' });

// ---------- husdjuren ----------
// Husets egen djurbutik (samma simulering som hemma, egen sparfil): djuren hör till hemmet 'dockskap'
// och rummet = rummets index. Klockan kopplas aldrig in, så ingen blir hungrig eller växer.
export const DOCK_PETS_KEY = 'snabbfilen_dockskap_pets';
const DJUR_HEM = 'dockskap';
const ART_IK = { katt: '🐱', hund: '🐶', kanin: '🐰' };
let djurStore = null;
export function djurButik() {
  if (!djurStore) {
    let storage = null;
    try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
    djurStore = createPetStore({ storage, key: DOCK_PETS_KEY });
    djurStore.load();
  }
  return djurStore;
}
const RASER = ARTER.flatMap((sp) => (SPECIES[sp]?.breeds || []).map((b) => ({ species: sp, breed: b.id, namn: `${ART_IK[sp] || ''} ${b.namn}` })));
const PRYLAR = Object.keys(PET_ITEMS);
const klammaDjur = (q) => { q.x = clamp(q.x, 12, FW - 12); q.y = clamp(q.y, WALL_Y + 8, FH - 6); return q; };

// ---------- lösa saker ----------
// { id, slag: 'leksak' | 'mat', k, room, x, y, up?, hos? } – x = mitten, y = fotpunkten (på ett
// bord: skivans rad, up = så många rader upp). hos = { typ: 'docka', id } när en figur håller den.
const MAX_SAKER_I_RUM = 40;
const LEKSAKER = TOYS.map((t) => t.id);
const MATEN = RAVAROR.map((r) => r.id);
const DOCK_MUMS = [$t('Mums!'), $t('Nam nam!'), $t('Gott!'), $t('Tack för maten!')];
const sakFinns = (slag, k) => (slag === 'leksak' ? !!toyOf(k) : slag === 'mat' ? !!ravaraOf(k) : false);
const sakNamn = (s) => (s.slag === 'leksak' ? toyNamn(toyOf(s.k)) : (ravaraOf(s.k)?.name || s.k));
const sakIkon = (s) => (s.slag === 'leksak' ? '🧸' : (ravaraOf(s.k)?.icon || '🍎'));
// rutan runt saken, relativt dess fotpunkt
const sakBox = (s) => { if (s.slag === 'leksak') { const f = toyFrame(s.k, 0, 'vila', 1); return f ? { x0: f.x0, y0: f.y0, x1: f.x0 + f.w, y1: f.y0 + f.h } : { x0: -6, y0: -12, x1: 6, y1: 0 }; } return { x0: -RAVARA_W / 2, y0: -RAVARA_W, x1: RAVARA_W / 2, y1: 0 }; };
const klammaSak = (q) => { q.x = clamp(q.x, 8, FW - 8); q.y = clamp(q.y, WALL_Y + 6, FH - 3); return q; };
const tvattaSak = (s) => ({ id: String(s.id), slag: s.slag, k: String(s.k), room: s.room | 0, x: s.x | 0, y: s.y | 0, ...(s.up > 0 ? { up: +s.up } : {}),
  ...(s.hos && s.hos.typ === 'docka' && s.hos.id ? { hos: { typ: 'docka', id: String(s.hos.id) } } : {}) });
// saken ritad med fotpunkten i (x, y): leksaken med sin skugga och sitt liv (blinkar, lampor), råvaran 12 × 12
function drawSak(ctx, s, x, y, t, skugga = true) {
  if (s.slag === 'leksak') { drawToy(ctx, s.k, x, y, t, { levande: true, ...(skugga ? {} : { skugga: false }) }); return; }
  ctx.drawImage(ravaraIcon(s.k), Math.round(x) - RAVARA_W / 2, Math.round(y) - RAVARA_W);
}

// Husets rum (samma fält som room.js PLANS): ljusa, glada färger – badrummet sist.
export const RUM = [
  { id: 'vardagsrum', ik: '🛋️', name: $n('VARDAGSRUM'), wall: 0xf2d6a0, wallDk: 0xc49c62, floorA: 0xe4cfa8, floorB: 0xcab088, windows: [[80, 130], [250, 300]], view: 'tradgard' },
  { id: 'kok', ik: '🍳', name: $n('KÖK'), wall: 0xcfe6c4, wallDk: 0x86ae82, floorA: 0xe6e8dc, floorB: 0xc6ccbe, windows: [[150, 190], [250, 290]], view: 'tradgard' },
  { id: 'barnrum', ik: '🧸', name: $n('BARNRUM'), wall: 0xf6cfe0, wallDk: 0xc088a8, floorA: 0xf0e2cc, floorB: 0xd8c8ae, windows: [[90, 140], [240, 290]], view: 'sky' },
  { id: 'sovrum', ik: '🛏️', name: $n('SOVRUM'), wall: 0xc4d6f0, wallDk: 0x8099c2, floorA: 0xe8ded0, floorB: 0xd2c4b2, windows: [[120, 170], [300, 350]], view: 'sky' },
  { id: 'badrum', ik: '🛁', name: $n('BADRUM'), bath: true, tiles: 'bla', wall: 0xa6cfe0, wallDk: 0x7aa4b8, floorA: 0xf0eee8, floorB: 0x6a9ec0, windows: [[150, 186], [250, 286]], winY: [16, 38], view: 'frost', towels: [128, 312], lamp: 'plafond' },
];
const PLAN = { partition: 0, rooms: RUM };

// ---------- teman: tapet, golv, utsikt och kakel per rum ----------
const TAPETER = [
  { id: 'sand', namn: $t('Sand'), wall: 0xf2d6a0, wallDk: 0xc49c62 }, { id: 'mint', namn: $t('Mint'), wall: 0xcfe6c4, wallDk: 0x86ae82 },
  { id: 'rosa', namn: $t('Rosa'), wall: 0xf6cfe0, wallDk: 0xc088a8 }, { id: 'himmel', namn: $t('Himmelsblå'), wall: 0xc4d6f0, wallDk: 0x8099c2 },
  { id: 'lavendel', namn: $t('Lavendel'), wall: 0xdcd0f0, wallDk: 0xa08cc4 }, { id: 'solgul', namn: $t('Solgul'), wall: 0xf8e690, wallDk: 0xc8ac48 },
  { id: 'persika', namn: $t('Persika'), wall: 0xf8d4b8, wallDk: 0xc89a70 }, { id: 'skog', namn: $t('Skogsgrön'), wall: 0x9ec49a, wallDk: 0x5e8a5c },
  { id: 'marin', namn: $t('Marinblå'), wall: 0x6a84b8, wallDk: 0x3a4e7a }, { id: 'korsbar', namn: $t('Körsbär'), wall: 0xd87a88, wallDk: 0x9a4a58 },
  { id: 'kram', namn: $t('Krämvit'), wall: 0xf6f0e2, wallDk: 0xc8bea8 }, { id: 'grafit', namn: $t('Grafit'), wall: 0x5a5e68, wallDk: 0x3a3d46 },
];
const GOLV = [
  { id: 'ek', namn: $t('Ljus ek'), floorA: 0xe4cfa8, floorB: 0xcab088 }, { id: 'morkek', namn: $t('Mörk ek'), floorA: 0xa8744a, floorB: 0x8a5c38 },
  { id: 'furu', namn: $t('Furu'), floorA: 0xf0d8a8, floorB: 0xdcc088 }, { id: 'gra', namn: $t('Grå sten'), floorA: 0xc8c8c4, floorB: 0xa8a8a4 },
  { id: 'marmor', namn: $t('Vit marmor'), floorA: 0xf2eee6, floorB: 0xe0dad0, lyx: true }, { id: 'rosa', namn: $t('Rosa'), floorA: 0xf6d8e4, floorB: 0xe4bccc },
  { id: 'mint', namn: $t('Mintgrön'), floorA: 0xd4ecd4, floorB: 0xb4d4b4 }, { id: 'himmel', namn: $t('Himmelsblå'), floorA: 0xd0e0f4, floorB: 0xb0c4e0 },
  { id: 'terrakotta', namn: $t('Terrakotta'), floorA: 0xd08a5a, floorB: 0xb07040 }, { id: 'schack', namn: $t('Schackrutigt'), floorA: 0xf4f4f0, floorB: 0x2a2a30 },
  { id: 'gras', namn: $t('Gräsmatta'), floorA: 0x8ac860, floorB: 0x6aa848 }, { id: 'natt', namn: $t('Nattsvart'), floorA: 0x3a3a44, floorB: 0x2a2a32 },
];
const UTSIKTER = [
  { id: 'tradgard', namn: $t('Trädgården'), ik: '🌳' }, { id: 'sky', namn: $t('Himlen'), ik: '☁️' }, { id: 'stad', namn: $t('Staden'), ik: '🏙️' },
  { id: 'landet', namn: $t('Landet'), ik: '🌾' }, { id: 'tomt', namn: $t('Tomten'), ik: '🏡' }, { id: 'betong', namn: $t('Gården'), ik: '🏢' }, { id: 'frost', namn: $t('Frostat glas'), ik: '🪟' },
];
// badrummets kakelstilar (room.js BATH) med rummets färger som de bostäderna har dem
const KAKEL = [
  { id: 'bla', namn: $t('Blått'), wall: 0xa6cfe0, wallDk: 0x7aa4b8, floorA: 0xf0eee8, floorB: 0x6a9ec0 }, { id: 'vit', namn: $t('Vitt'), wall: 0xf0f0ea, wallDk: 0xc4c4bc, floorA: 0xb4b8bc, floorB: 0xa4a8ac },
  { id: 'marmor', namn: $t('Marmor'), wall: 0xf2eee8, wallDk: 0xb8ae9c, floorA: 0xece6da, floorB: 0xdcd4c6 }, { id: 'skiffer', namn: $t('Skiffer'), wall: 0x3e4248, wallDk: 0x2a2d32, floorA: 0x34373c, floorB: 0x2c2f34 },
  { id: '70tal', namn: $t('70-tal'), wall: 0xc88a3a, wallDk: 0x6a4020, floorA: 0x7a5236, floorB: 0x6a4630 }, { id: 'sliten', namn: $t('Slitet'), wall: 0xe2ddd0, wallDk: 0xa39a86, floorA: 0x9c968a, floorB: 0x8c8678 },
];
const TEMAN = [   // färdiga: tapet + golv + utsikt i ett tryck (badrummet får kaklet)
  { id: 'prinsessa', namn: $t('Prinsessan'), ik: '👑', tapet: 'rosa', golv: 'rosa', utsikt: 'tradgard', kakel: 'vit' },
  { id: 'rymden', namn: $t('Rymden'), ik: '🚀', tapet: 'marin', golv: 'natt', utsikt: 'sky', kakel: 'skiffer' },
  { id: 'skogen', namn: $t('Skogen'), ik: '🌲', tapet: 'skog', golv: 'gras', utsikt: 'landet', kakel: '70tal' },
  { id: 'sommarstugan', namn: $t('Sommarstugan'), ik: '🏡', tapet: 'kram', golv: 'furu', utsikt: 'tomt', kakel: 'sliten' },
  { id: 'lyx', namn: $t('Lyxvåningen'), ik: '💎', tapet: 'grafit', golv: 'marmor', utsikt: 'stad', kakel: 'marmor' },
  { id: 'solsken', namn: $t('Solsken'), ik: '🌞', tapet: 'solgul', golv: 'ek', utsikt: 'tradgard', kakel: 'bla' },
  { id: 'havet', namn: $t('Havet'), ik: '🌊', tapet: 'himmel', golv: 'himmel', utsikt: 'sky', kakel: 'bla' },
  { id: 'godis', namn: $t('Godislandet'), ik: '🍭', tapet: 'lavendel', golv: 'schack', utsikt: 'tradgard', kakel: 'vit' },
  // 🎄 Jul (v0.167): ställer också fram gran, girlang och julstrumpa om rummet inte redan har dem
  { id: 'jul', namn: $t('Jul'), ik: '🎄', tapet: 'korsbar', golv: 'morkek', utsikt: 'frost', kakel: 'vit', mobler: [{ k: 'kulgran', x: 296, y: 152 }, { k: 'ljusgirlang', x: 150, y: 28 }, { k: 'julstrumpa', x: 60, y: 74 }] },
];
const tvattaTema = (t) => {
  const o = {};
  if (!t || typeof t !== 'object') return o;
  if (TAPETER.some((x) => x.id === t.tapet)) o.tapet = t.tapet;
  if (GOLV.some((x) => x.id === t.golv)) o.golv = t.golv;
  if (UTSIKTER.some((x) => x.id === t.utsikt)) o.utsikt = t.utsikt;
  if (KAKEL.some((x) => x.id === t.kakel)) o.kakel = t.kakel;
  return o;
};

// Startmöbleringen (x = vänsterkant, y = fotlinje; mattan överkant; väggsaker underkant) – det
// som inte finns i arket hoppas över, och allt kläms innanför rummet (klamma).
const SEED = [
  [{ k: 'matta', v: 0, x: 130, y: 118 }, { k: 'soffa', v: 0, x: 150, y: 152 }, { k: 'soffbord', v: 0, x: 152, y: 172 }, { k: 'fatolj', v: 0, x: 104, y: 150 },
    { k: 'lampa', v: 0, x: 216, y: 150 }, { k: 'bokhylla', v: 0, x: 290, y: 122 }, { k: 'blomtavla', v: 0, x: 170, y: 72 }, { k: 'vaxtS', v: 0, x: 340, y: 150 }],
  [{ k: 'kyl', v: 0, x: 24, y: 122 }, { k: 'koksspis', v: 0, x: 66, y: 122 }, { k: 'diskbank', v: 0, x: 104, y: 122 }, { k: 'overskap', v: 0, x: 66, y: 60 },
    { k: 'bordM', v: 0, x: 200, y: 166 }, { k: 'matstol', v: 0, x: 182, y: 168 }, { k: 'matstol', v: 0, x: 256, y: 168 }, { k: 'fruktskal', v: 0, x: 218, y: 167 }],
  [{ k: 'lillmatta', v: 0, x: 150, y: 190 }, { k: 'enkelsang', v: 0, x: 40, y: 150 }, { k: 'leksakslada', v: 0, x: 220, y: 166 }, { k: 'jattenalle', v: 0, x: 290, y: 160 },
    { k: 'byggklossar', v: 0, x: 160, y: 196 }, { k: 'barntavla', v: 0, x: 130, y: 66 }, { k: 'golvkudde', v: 0, x: 120, y: 170 }],
  [{ k: 'rundmatta', v: 0, x: 150, y: 190 }, { k: 'sang', v: 2, x: 60, y: 150 }, { k: 'nattduksbord', v: 0, x: 100, y: 150 }, { k: 'garderob', v: 0, x: 250, y: 122 },
    { k: 'ramtavla', v: 0, x: 200, y: 62 }, { k: 'lagbyra', v: 0, x: 180, y: 150 }],
  [{ k: 'badkar', v: 0, x: 40, y: 152 }, { k: 'toalett', v: 0, x: 280, y: 142 }, { k: 'handfat', v: 0, x: 200, y: 130 }, { k: 'medicinskap', v: 0, x: 200, y: 62 },
    { k: 'badhylla', v: 0, x: 120, y: 128 }],
];

// Lådans flikar: katalogens avdelningar, väggsakerna för sig, jul och spök för sig.
const JUL = /^(jul|advents|polkagris|pepparkakshus|snogubbe|kulgran|ljusgran|minigran|girlang|ljusgirlang)/;
const SPOK = /^(pumpa|pumplykta|spindelnat|fladdermoss|gravsten|haxkittel|skelett|fagelskramma|gargoyl|spoktrad)/;
const av = (rum) => (k) => k.room === rum && !k.wall && !JUL.test(k.kind) && !SPOK.test(k.kind);
export const FLIKAR = [
  { id: 'figurer', ik: '🧑', namn: $t('Figurer'), figurer: true },
  { id: 'djur', ik: '🐾', namn: $t('Djur'), djur: true },
  { id: 'saker', ik: '🎁', namn: $t('Saker'), saker: true },
  { id: 'teman', ik: '🎨', namn: $t('Teman'), teman: true },
  { id: 'vardagsrum', ik: '🛋️', namn: $t('Vardagsrum'), valj: av('VARDAGSRUM') },
  { id: 'kok', ik: '🍳', namn: $t('Kök'), valj: av('KÖK') },
  { id: 'sovrum', ik: '🛏️', namn: $t('Sovrum'), valj: av('SOVRUM') },
  { id: 'barnrum', ik: '🧸', namn: $t('Barnrum'), valj: av('BARNRUM') },
  { id: 'badrum', ik: '🛁', namn: $t('Badrum'), valj: av('BADRUM') },
  { id: 'kontor', ik: '💼', namn: $t('Kontor'), valj: av('KONTOR') },
  { id: 'hall', ik: '🚪', namn: $t('Hall'), valj: av('HALL') },
  { id: 'vagg', ik: '🖼️', namn: $t('Väggen'), valj: (k) => !!k.wall && !JUL.test(k.kind) && !SPOK.test(k.kind) },
  { id: 'ovrigt', ik: '🪴', namn: $t('Övrigt'), valj: av('ÖVRIGT') },
  { id: 'jul', ik: '🎄', namn: $t('Jul'), valj: (k) => JUL.test(k.kind) },
  { id: 'spok', ik: '🎃', namn: $t('Spök'), valj: (k) => SPOK.test(k.kind) },
];
// allt i katalogen utom visningsmöblerna (de visar ens egna designer), plus monsteran och husets egna saker
const KAT = [...KATALOG.filter((k) => !VISNING.has(k.kind)), { kind: 'vaxt', icon: '🪴', name: nameOf('vaxt'), vars: 1, room: 'ÖVRIGT' },
  ...Object.entries(EGNA).map(([kind, e]) => ({ kind, icon: e.icon, name: e.name, vars: 1, room: 'ÖVRIGT' }))];

// ---------- huset i localStorage ----------
function klamma(d) {
  const { w, h } = dimsAv(d.k, d.v, d.r | 0);
  if (arVagg(d.k)) { d.x = clamp(d.x, 5, FW - 5 - w); d.y = clamp(d.y, WALL_TOP + h, WALL_Y - 3); }
  else if (d.k === 'matta') { d.x = clamp(d.x, 6, FW - 4 - w); d.y = clamp(d.y, WALL_Y + 2, FH - 3 - h); }
  else if (isFlat(d.k)) { d.x = clamp(d.x, 6, FW - 4 - w); d.y = clamp(d.y, WALL_Y + 2 + h, FH - 3); }
  else { d.x = clamp(d.x, 8, FW - 5 - w); d.y = clamp(d.y, WALL_Y + 6, FH - 4); }
  return d;
}
const tvattaDeco = (d) => ({ k: d.k, v: d.v | 0, ...(d.c ? { c: d.c } : {}), ...(d.r ? { r: d.r | 0 } : {}), x: d.x | 0, y: d.y | 0, ...(d.up > 0 ? { up: +d.up } : {}), ...(d.lit ? { lit: true } : {}),
  ...(LJUSFARGER.some((f) => f.id === d.ljus) ? { ljus: d.ljus } : {}), ...(d.slackt ? { slackt: true } : {}) });
function lasHus() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(DOCK_KEY) || 'null'); } catch { p = null; }
  if (!p || !Array.isArray(p.rooms)) return null;
  const bottar = Array.isArray(p.bottar) && p.bottar.length ? p.bottar.filter((b) => b && b.id && b.look).map((b) => ({ id: String(b.id), namn: String(b.namn || ''), look: b.look })) : nyaBottar();
  const dockor = (Array.isArray(p.dockor) ? p.dockor : []).filter((d) => d && d.id).map(tvattaDocka).filter((d) => d.room >= 0 && d.room < RUM.length);
  const saker = (Array.isArray(p.saker) ? p.saker : []).filter((s) => s && s.id && sakFinns(s.slag, s.k)).map(tvattaSak).filter((s) => s.room >= 0 && s.room < RUM.length);
  for (const s of saker) if (s.hos && !dockor.some((d) => d.id === s.hos.id)) delete s.hos;   // (figuren är borta: saken ligger kvar där den stod)
  return { v: 1, natt: !!p.natt, lage: LAGEN.includes(p.lage) ? p.lage : 'leka', rooms: RUM.map((_, i) => ({ deco: (p.rooms[i]?.deco || []).filter((d) => d && kand(d.k)).map(tvattaDeco), tema: tvattaTema(p.rooms[i]?.tema) })),
    dockor, bottar, saker, sakN: Math.max(p.sakN | 0, saker.length) };
}
// (två av bottarna står i vardagsrummet från början, så att huset lever – och några leksaker i barnrummet)
const SEED_SAKER = [{ id: 's1', slag: 'leksak', k: 'nalle-liten', room: 2, x: 262, y: 202 }, { id: 's2', slag: 'leksak', k: 'bil-racer', room: 2, x: 110, y: 208 },
  { id: 's3', slag: 'leksak', k: 'boll-fot', room: 2, x: 330, y: 196 }, { id: 's4', slag: 'mat', k: 'applR', room: 1, x: 236, y: 167, up: 0 }];
const nyttHus = () => ({ v: 1, natt: false, lage: 'leka', rooms: SEED.map((list) => ({ deco: list.filter((d) => knownKind(d.k)).map(tvattaDeco), tema: {} })),
  dockor: [{ id: 'bot0', room: 0, x: 236, y: 186, dir: 'down' }, { id: 'bot1', room: 0, x: 112, y: 150, dir: 'down' }], bottar: nyaBottar(),
  saker: SEED_SAKER.filter((s) => sakFinns(s.slag, s.k)).map(tvattaSak), sakN: SEED_SAKER.length });

// pekarens plats på skärmen → spelpixlar (samma räkning som main.js toLocal)
function tillLogisk(A, cv, clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const lw = cv.width / A.pxs, lh = cv.height / A.pxs;
  return { x: (clientX - r.left) / r.width * lw - A.view.boxX, y: (clientY - r.top) / r.height * lh - A.view.boxY,
    inne: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom };
}

export function makeDockskap(A) {
  const H = lasHus() || nyttHus();
  for (const r of H.rooms) for (const d of r.deco) if (!(d.up > 0)) klamma(d);
  const n = RUM.length;
  const ox = (i) => i * (FW + WALLW);
  const W = n * FW + (n - 1) * WALLW;
  const roomAt = (wx) => clamp(Math.floor(wx / (FW + WALLW)), 0, n - 1);
  let lage = LAGEN.includes(H.lage) ? H.lage : 'leka';
  const leker = () => lage === 'leka';
  // rummets utseende = RUM-definitionen med rummets tema ovanpå (tapet/golv/utsikt, badrummet kakel)
  function rumDef(i) {
    const R = RUM[i], t = H.rooms[i].tema || {}, d = { ...R };
    if (R.bath) { const k = KAKEL.find((x) => x.id === t.kakel); if (k) Object.assign(d, { tiles: k.id, wall: k.wall, wallDk: k.wallDk, floorA: k.floorA, floorB: k.floorB }); }
    else {
      const ta = TAPETER.find((x) => x.id === t.tapet); if (ta) { d.wall = ta.wall; d.wallDk = ta.wallDk; }
      const g = GOLV.find((x) => x.id === t.golv); if (g) { d.floorA = g.floorA; d.floorB = g.floorB; d.lyx = !!g.lyx; }
    }
    const u = UTSIKTER.find((x) => x.id === t.utsikt); if (u) d.view = u.id;
    return d;
  }
  const defs = RUM.map((_, i) => rumDef(i));
  const byggBg = (i) => buildBg(defs[i], FW, [], i === 0, defs[i].lyx ? { ...PLAN, lyx: true } : PLAN, false);
  const bgs = defs.map((_, i) => byggBg(i));
  function sattTema(i, key, id) {
    const t = H.rooms[i].tema || (H.rooms[i].tema = {});
    if (id == null || id === '') delete t[key]; else t[key] = id;
    defs[i] = rumDef(i); bgs[i] = byggBg(i);
    play('ok'); spara(); fyllLada();
  }
  function sattTemaPaket(i, T) {
    if (!T) return;
    const t = H.rooms[i].tema || (H.rooms[i].tema = {});
    if (RUM[i].bath) t.kakel = T.kakel; else { t.tapet = T.tapet; t.golv = T.golv; }
    if (T.utsikt) t.utsikt = T.utsikt; else delete t.utsikt;
    defs[i] = rumDef(i); bgs[i] = byggBg(i);
    for (const m of T.mobler || []) if (kand(m.k) && !H.rooms[i].deco.some((d) => d.k === m.k)) laggTill(i, { k: m.k, v: 0, x: m.x, y: m.y });   // (temats egna saker, t.ex. julgranen)
    play('pling'); spara(); fyllLada();
  }

  // ---------- kameran ----------
  const seen = () => { const sf = A.view?.safe; const x0 = sf ? sf.x0 : 0, x1 = sf ? sf.x1 : (A.W || FW); return x1 > x0 ? [x0, x1] : [0, A.W || FW]; };
  const clampCam = (c) => { const [x0, x1] = seen(), vis = x1 - x0; if (W <= vis) return -(x0 + (vis - W) / 2); return Math.max(-x0, Math.min(W - x1, c)); };
  const camRoom = (i) => { const [x0, x1] = seen(), vis = x1 - x0; return clampCam(ox(i) - x0 - (vis - FW) / 2); };
  let camX = camRoom(0), camTo = null;
  const rumIVy = () => { const [x0, x1] = seen(); return roomAt(camX + (x0 + x1) / 2); };   // rummet mitt i bild

  // ---------- sparningen ----------
  let tmr = 0;
  const skriv = () => { try { localStorage.setItem(DOCK_KEY, JSON.stringify(H)); } catch { /* fullt */ } };
  function spara(nu = false) { clearTimeout(tmr); if (nu) skriv(); else tmr = setTimeout(skriv, 300); }

  // ---------- småsaker på bord (som i room.js) ----------
  const isRider = (d) => !!d && d.up > 0;
  const upOn = (s) => { const row = surfaceRow(s.k, s.v, s.r | 0); return row == null ? null : dimsOf(s.k, s.v, s.r | 0).h - row + 1; };
  function surfaceOf(d, list, skip = -1) {
    const { w } = dimsOf(d.k, d.v, d.r | 0);
    return list.find((s, j) => j !== skip && s !== d && s && SURFACES.has(s.k) && !isRider(s) && d.y === s.y + 1 && d.x >= s.x && d.x + w <= s.x + dimsOf(s.k, s.v, s.r | 0).w) || null;
  }
  const ridersOf = (list, idx) => list.filter((d) => isRider(d) && surfaceOf(d, list) === list[idx]).map((d) => ({ d, dx: d.x - list[idx].x }));
  // det som stod på ett bord som försvann står nu på golvet
  function settle(i) {
    for (const d of H.rooms[i].deco) if (isRider(d) && !surfaceOf(d, H.rooms[i].deco)) { delete d.up; klamma(d); }
  }

  // ---------- det ritade, per rum ----------
  let drag = null;   // { room, idx, d, k, v, c, r, offx, offy, moved, px, py, sx, sy, riders, groom, gx, gy, gup, fromTray }
  let pan = null;    // { sx, cam0, moved }
  let armed = null;  // { k, v, r } – vald i lådan: nästa tryck i rummet ställer den där
  const built = RUM.map(() => ({ props: [], rugs: [], walls: [] }));
  let layers = [];   // husdjurslagren, ett per rum (skapas när möblerna är byggda)
  function rebuild(i) {
    const b = built[i]; b.props = []; b.rugs = []; b.walls = [];
    H.rooms[i].deco.forEach((d, idx) => {
      if (drag && !drag.fromTray && drag.room === i && drag.idx === idx) return;   // lyft just nu
      if (drag?.riders?.some((q) => q.d === d)) return;                             // står på bordet man bär
      if (d.k === 'matta') { b.rugs.push({ idx, x: d.x, y: d.y, w: RUG.w, h: RUG.h, draw: (ctx) => ctx.drawImage(rugImg(d.v, d.c), d.x, d.y) }); return; }
      if (d.k === 'vaxt') { const p = makePlantProp(d.x + 10, d.y); b.props.push({ ...p, k: 'vaxt', idx, rect: [d.x - 2, p.top, d.x + 22, d.y + 1] }); return; }
      if (EGNA[d.k]) {   // husets egna: discokulan hänger mot bakväggen (ritas i kod, snurrar när den är igång)
        const { w, h } = dimsAv(d.k), top = d.y - h;
        b.walls.push({ k: d.k, idx, x: d.x, top, w, h, egen: true, draw: (ctx) => ctx.drawImage(diskoBilder()[d.lit ? Math.floor(tid * 6) % 3 : 0], d.x, top), light: null });
        return;
      }
      if (arVagg(d.k)) { const w = wallProp(d, idx); if (w) b.walls.push({ ...w, idx }); return; }
      if (isFlat(d.k)) { const f = flatProp(d, idx); if (f) b.rugs.push({ ...f, idx }); return; }
      const p = spriteProp(d, idx, false);
      if (p) b.props.push({ ...p, idx, rect: p.hit || [p.solid[0] + 1, p.top, p.solid[2] - 1, p.solid[3] - 1] });
    });
    b.props.sort((a, c) => a.sort - c.sort);
    layers[i]?.invalidate();   // (djurens vägnät byggs om)
  }
  const rebuildAll = () => { for (let i = 0; i < n; i++) rebuild(i); };
  rebuildAll();

  // ---------- husdjuren: ett lager per rum ----------
  // Lagret får en app utan spel (AL.game = null): ingen spelklocka, inget bärande som läcker till
  // spelet. isFree = golvet utanför möblerna (det möblerna skymmer, från ovankant till fotlinjen).
  const store = djurButik();
  const AL = Object.create(A); AL.game = null; AL.carrying = null; AL.roomSub = 0;
  const petFree = (i, x, y) => x > 7 && x < FW - 5 && y > WALL_Y + 4 && y < FH - 4
    && !built[i].props.some((p) => p.solid && x > p.solid[0] - 1 && x < p.solid[2] + 1 && y > p.top && y < p.solid[3] + 2);
  layers = RUM.map((_, i) => createPetLayer(AL, { store, home: DJUR_HEM, room: i, bounds: { left: 8, right: FW - 8, top: WALL_Y + 4, bottom: FH - 4 },
    isFree: (x, y) => petFree(i, x, y), walker: null, onObstacles: () => {}, toasts: false, sync: false, here: () => true, playerRoom: () => i,
    liveAll: true, W: FW, H: FH, autoPlace: false, hour: 12 }));
  const djurI = (i) => layers[i]._debug.pets();
  function djurAt(i, lx, ly) {
    for (const a of djurI(i)) {
      const p = store.petById(a.id);
      if (!p) continue;
      const b = petBox(p, a.anim, a.dir);
      if (lx >= a.x + b.x0 - 2 && lx <= a.x + b.x1 + 2 && ly >= a.y + b.y0 - 2 && ly <= a.y + b.y1 + 2) return a.id;
    }
    return null;
  }
  // flytta ett djur (också till ett annat rum): lagret som hade det släpper det, det nya tar
  // upp det vid nästa bildruta (syncActors) på sin nya plats
  function flyttaDjur(id, room, x, y) {
    const p = store.petById(id);
    if (!p) return false;
    const q = klammaDjur({ x: Math.round(x), y: Math.round(y) });
    for (const L of layers) L._debug.actors.delete(id);
    store.setPos(id, q.x, q.y, room);
    store.save();
    layers[room].update(0);
    return true;
  }
  function nyttDjur(species, breed, room, x, y) {
    const q = klammaDjur({ x: Math.round(x), y: Math.round(y) });
    const p = store.adopt(species, breed, Math.random() < 0.5 ? 'hona' : 'hane', '', DJUR_HEM, { room, x: q.x, y: q.y, day: 1 });
    if (!p) { play('fel'); toast(store.lastError || $t`Du kan ha högst ${MAX_PETS} djur i huset.`, 'bad'); return null; }
    layers[room].update(0);
    play('ok'); fyllLada();
    return p;
  }
  function taBortDjur(id) {
    for (const L of layers) L._debug.actors.delete(id);
    const p = store.removePet(id);
    if (p) { play('click'); fyllLada(); }
    return !!p;
  }
  function nyPryl(k, room, x, y) {
    if (!PET_ITEMS[k]) return null;
    const q = klammaDjur({ x: Math.round(x), y: Math.round(y) });
    store.buyItem(k);
    const it = store.placeItem(k, DJUR_HEM, room, q.x, q.y);
    if (!it) { play('fel'); toast(store.lastError || $t('Det gick inte att ställa ut den.'), 'bad'); return null; }
    layers[room].invalidate();
    play('ok');
    return it;
  }
  function flyttaPryl(id, room, x, y) {
    const it = store.itemById(id);
    if (!it) return false;
    const q = klammaDjur({ x: Math.round(x), y: Math.round(y) });
    const fran = it.room;
    it.x = q.x; it.y = q.y; it.room = room;
    store.save();
    if (fran !== room && layers[fran]) layers[fran].invalidate();
    layers[room].invalidate();
    return true;
  }
  function menyDjur(id) {
    const p = store.petById(id);
    if (!p) return;
    const L = layers[p.room | 0];
    openModal(`${ART_IK[p.species] || '🐾'} ${esc(p.name)}`, `<p style="font-size:var(--f2);margin:0">${$t('Dra djuret dit du vill ha det – också in i ett annat rum. Klappa det, lek med det eller lägg det i lådan.')}</p>`, [
      { label: $t('🤚 Klappa'), cls: 'btn-go', onClick: () => { closeModal(); store.pet(id); L?._debug.setMode(id, 'love'); play('pling'); } },
      { label: $t('🎾 Leka'), onClick: () => { closeModal(); store.play(id); L?._debug.setMode(id, 'happy'); play('chirp'); } },
      { label: $t('🧸 Till lådan'), cls: 'btn-red', onClick: () => { closeModal(); taBortDjur(id); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
  }

  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

  // ---------- leka: små animationer och partiklar ----------
  // anims: nyckel ('deco:rum:idx', 'docka:id', 'sak:id') → { typ, t, dur, h }. typ: wiggle (klämmer ihop och ut),
  // boing (studsar på bredden/höjden), hopp (lyfter h rader), studs (två hopp), sway (svajar i sidled, väggsaker),
  // kor (bilen kör fram och tillbaka), klam (klämkompisen kläms, egen bildruta). fx: partiklarna i rummens pixlar.
  const anims = new Map();
  const fx = [];
  let reaktioner = 0, senaste = null;
  const anim = (key, typ, dur = 0.6, h = 10) => anims.set(key, { typ, t: 0, dur, h });
  // n partiklar av ett slag från (x, y) i rummet: upp = fart uppåt (negativ = faller), fart = spridning i sidled,
  // g = tyngd (negativ = stiger fortare), glapp = sekunder mellan varje, col = färger att välja bland
  function spruta(room, x, y, slag, n, o = {}) {
    for (let k = 0; k < n; k++) {
      fx.push({ room, x: x + (Math.random() - 0.5) * (o.bredd ?? 10), y: y + (Math.random() - 0.5) * (o.hojd ?? 0), vx: (Math.random() - 0.5) * (o.fart ?? 18),
        vy: -(o.upp ?? 22) * (0.6 + Math.random() * 0.8), g: o.g ?? -8, t: -k * (o.glapp ?? 0.08), dur: o.dur ?? 1.2, slag, col: o.col ? pick(o.col) : null });
    }
  }
  // ritar fn med animationen för key: skalning kring (cx, cy) = möbelns fotpunkt, eller en förflyttning
  function medAnim(ctx, key, cx, cy, fn) {
    const a = anims.get(key);
    if (!a) { fn(); return; }
    const u = a.t / a.dur, k = 1 - u;
    ctx.save();
    if (a.typ === 'hopp') ctx.translate(0, -Math.round(a.h * Math.sin(Math.PI * u)));
    else if (a.typ === 'studs') ctx.translate(0, -Math.round(a.h * Math.abs(Math.sin(2 * Math.PI * u)) * k));
    else if (a.typ === 'sway') ctx.translate(Math.round(2.5 * Math.sin(a.t * 22) * k), 0);
    else if (a.typ === 'kor') ctx.translate(Math.round(a.h * Math.sin(Math.PI * u)), 0);
    else { const s = (a.typ === 'boing' ? 0.16 : 0.07) * Math.sin(a.t * (a.typ === 'boing' ? 24 : 32)) * k; ctx.translate(cx, cy); ctx.scale(1 - s, 1 + s); ctx.translate(-cx, -cy); }
    fn();
    ctx.restore();
  }
  function ritaFx(ctx, i) {
    for (const q of fx) {
      if (q.room !== i || q.t < 0) continue;
      const u = q.t / q.dur, x = Math.round(q.x), y = Math.round(q.y);
      ctx.globalAlpha = Math.max(0, 1 - u * u);
      switch (q.slag) {
        case 'not': ctx.fillStyle = q.col || '#ff5a8a'; ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + 3, y - 5, 1, 7); ctx.fillRect(x + 4, y - 5, 2, 1); ctx.fillRect(x + 5, y - 4, 1, 2); break;
        case 'hjarta': ctx.fillStyle = q.col || '#ff5a7a'; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1); ctx.fillRect(x - 1, y + 1, 7, 2); ctx.fillRect(x, y + 3, 5, 1); ctx.fillRect(x + 1, y + 4, 3, 1); ctx.fillRect(x + 2, y + 5, 1, 1); break;
        case 'gnista': { ctx.fillStyle = q.col || '#fff6c8'; ctx.fillRect(x, y, 1, 1); if (Math.floor(q.t * 14) % 2 === 0) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); } break; }
        case 'bubbla': ctx.fillStyle = '#e8f8ff'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 2, y + 1, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + 1, 1, 1); break;
        case 'lov': ctx.fillStyle = q.col || '#5aa84a'; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 1, y + 1, 2, 1); break;
        case 'rok': { const r = 1 + Math.floor(u * 2); ctx.fillStyle = q.col || '#f0f0f4'; ctx.fillRect(x - r + 1, y - r + 1, 2 * r - 1, 2 * r - 1); break; }
        case 'rost': ctx.fillStyle = '#b8742e'; ctx.fillRect(x - 3, y - 7, 7, 7); ctx.fillStyle = '#f0c882'; ctx.fillRect(x - 2, y - 6, 5, 5); ctx.fillStyle = '#d99a4a'; ctx.fillRect(x - 1, y - 4, 1, 1); ctx.fillRect(x + 1, y - 3, 1, 1); break;
      }
    }
    ctx.globalAlpha = 1;
  }
  // en tänd lampa (d.lit): sken i lampans ljusfärg (d.ljus) och lampan ljus igen ovanpå nattmörkret – på dagen bara
  // en glimt vid skärmen. De levande ljusen fladdrar.
  function lampSken(ctx, p, d, night) {
    const cx = p.solid ? (p.solid[0] + p.solid[2]) / 2 : (p.hit[0] + p.hit[2]) / 2, fh = p.sort - p.top, cy = p.top + Math.max(3, fh * 0.3);
    const f = ljusFarg(d), lev = LEVANDE.has(d.k);
    const fl = lev ? 0.7 + 0.3 * Math.abs(Math.sin(tid * 13 + cx) * Math.sin(tid * 5.3 + cx * 0.7)) : 0.9 + 0.1 * Math.sin(tid * 9 + cx);
    if (!night) { halo(ctx, cx, cy, lev ? 6 : 10, lev ? 4 : 6, f.m, 0.3 * fl); return; }
    const s = lev ? 0.6 : 1;
    halo(ctx, cx, cy, 52 * s, 32 * s, f.c, 0.12 * fl); halo(ctx, cx, cy, 26 * s, 16 * s, f.m, 0.17 * fl); halo(ctx, cx, p.sort + 5, 44 * s, 9 * s, f.c, 0.1 * fl);
    const a = furnView(d.k, d.v, d.c, d.r);
    if (a) { ctx.globalAlpha = 0.85; drawArt(ctx, a, d.x, p.top); ctx.globalAlpha = 1; }
  }
  // 🪩 discokulan igång: färgade ljusfläckar sveper runt rummet (väggen och golvet), kulan gnistrar
  function diskoSken(ctx, w, night) {
    const cx = w.x + 7, cy = w.top + 19;
    for (let k = 0; k < DISKOFARGER.length; k++) {
      const ang = tid * 1.1 + k * Math.PI / 3;
      const sx = cx + Math.cos(ang) * 150, sy = WALL_Y + 40 + Math.sin(ang) * 62;
      halo(ctx, sx, sy, 18, 10, DISKOFARGER[k], night ? 0.26 : 0.13);
      halo(ctx, sx, sy, 9, 5, '#ffffff', night ? 0.1 : 0.05);
    }
    const g = Math.floor(tid * 10) % 4;
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
    ctx.fillRect(cx - 4 + (g & 1) * 6, cy - 3 + (g >> 1) * 5, 1, 1); ctx.fillRect(cx + 3 - (g & 1) * 5, cy + 2 - (g >> 1) * 4, 1, 1);
    ctx.globalAlpha = 1;
  }
  const diskoIgang = (i) => H.rooms[i].deco.some((d) => d.k === 'discokula' && d.lit);

  // ---------- figurerna ----------
  // gänget = alla sparade figurer (deras utseende följer med om de ändras hemma) + husets bottar
  let gangList = null;
  const gang = () => gangList || (gangList = [...listAvatars().map((a) => ({ id: 'av:' + a.id, namn: a.name, look: a.look || {} })), ...H.bottar]);
  const figOf = (id) => gang().find((f) => f.id === id) || null;
  const dockaMed = (id) => H.dockor.find((d) => d.id === id) || null;
  // sätet under en figur med fötterna i (x, y) i rummet i – det främsta vinner
  function seatUnder(i, x, y) {
    let best = null;
    for (const p of built[i].props) {
      if (!SEATS.has(p.k) || !p.solid) continue;
      if (x < p.solid[0] + 3 || x > p.solid[2] - 3 || y < p.sort - 16 || y > p.sort + 2) continue;
      if (!best || p.sort > best.sort) best = p;
    }
    return best;
  }
  const dockaPos = (d) => { const s = seatUnder(d.room, d.x, d.y); return s ? { x: d.x, y: s.sort - 1, sitter: true, fy: s.sort + 0.3, frame: 5 } : { x: d.x, y: d.y, sitter: false, fy: d.y, frame: 0 }; };
  const dockaRect = (d) => { const q = dockaPos(d); return [q.x - 10, q.y - 39, q.x + 10, q.y + 1]; };
  const klammaDocka = (d) => { d.x = clamp(d.x, 10, FW - 10); d.y = clamp(d.y, WALL_Y + 8, FH - 3); return d; };
  const talk = createSpeech();
  let talkAt = null;   // var bubblan sitter (skärmens x/y, följer kameran) – ritas bara när figuren syns
  let pratT = 5, tid = 0;
  function sag(d, text, secs = 3) {
    const fig = figOf(d.id);
    if (!fig) return null;
    talkAt = () => { const q = dockaPos(d); return { x: q.x + ox(d.room) - camX, y: q.y - 44 }; };
    talk.say(text, talkAt, secs, { voice: fig.look });
    return text;
  }
  const prata = (d) => sag(d, pick(H.natt ? DOCK_PRAT_NATT : DOCK_PRAT));
  function stallDocka(id, room, x, y) {
    if (!figOf(id)) return null;
    let d = dockaMed(id);
    if (!d) { d = { id, room, x, y, dir: 'down' }; H.dockor.push(d); } else { d.room = room; d.x = x; d.y = y; }
    klammaDocka(d);
    play('ok'); spara(); fyllLada();
    return d;
  }
  function taBortDocka(id) {
    const k = H.dockor.findIndex((d) => d.id === id);
    if (k < 0) return false;
    const held = sakHos(id);
    if (held) laggNer(held);   // (det hen höll i ligger kvar på golvet)
    H.dockor.splice(k, 1);
    play('click'); spara(); fyllLada();
    return true;
  }
  function menyDocka(d) {
    const fig = figOf(d.id);
    if (!fig) return;
    const held = sakHos(d.id);
    openModal(`🧑 ${esc(fig.namn)}`, `<div class="dock-meny"><span data-port></span><p style="font-size:var(--f2);margin:0">${held ? $t`Håller i: ${sakNamn(held)}.` + ' ' : ''}${$t('Dra figuren dit du vill ha den – släpp den på en soffa, stol eller säng så sätter den sig.')}</p></div>`, [
      { label: $t('💬 Prata'), cls: 'btn-go', onClick: () => { closeModal(); prata(d); } },
      ...(held ? [{ label: $t('🧸 Lägg ner'), onClick: () => { closeModal(); laggNer(held); play('click'); } }] : []),
      { label: $t('↔ Vänd'), onClick: () => { d.dir = { down: 'left', left: 'up', up: 'right', right: 'down' }[d.dir] || 'down'; spara(); play('click'); closeModal(); menyDocka(d); } },
      { label: $t('🧸 Till lådan'), cls: 'btn-red', onClick: () => { closeModal(); taBortDocka(d.id); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    const el = document.querySelector('#modal [data-port]');
    if (el) { const c = portrait(fig.look, '#f4f1ea'); c.style.height = '48px'; c.style.width = '40px'; el.replaceWith(c); }
  }

  // ---------- lösa saker: leksakerna och maten ----------
  const sakMed = (id) => H.saker.find((s) => s.id === id) || null;
  const sakHos = (dockId) => H.saker.find((s) => s.hos?.id === dockId) || null;
  const sakerI = (i) => H.saker.filter((s) => s.room === i && !s.hos);
  const sakFot = (s) => s.y - (s.up > 0 ? s.up : 0);   // där saken står: golvet eller bordsskivan
  function sakAt(i, lx, ly) {
    const list = sakerI(i);
    for (let j = list.length - 1; j >= 0; j--) {
      const s = list[j];
      if (drag?.typ === 'sak' && drag.id === s.id) continue;
      const fy = sakFot(s);
      if (s.slag === 'leksak') { if (toyHit(s.k, lx - s.x, ly - fy) || inRect(lx, ly, [s.x - 4, fy - 6, s.x + 4, fy + 1])) return s; }
      else if (inRect(lx, ly, [s.x - RAVARA_W / 2 - 1, fy - RAVARA_W - 1, s.x + RAVARA_W / 2 + 1, fy + 1])) return s;
    }
    return null;
  }
  // bordsskivan under pekaren (mx, my) i rummet j, för något w brett: { s, sd, u } eller null
  function ytaUnder(j, mx, my, w, skip = -1) {
    let best = null;
    H.rooms[j].deco.forEach((s, k2) => {
      if (k2 === skip || !s || !SURFACES.has(s.k) || isRider(s)) return;
      const sd = dimsOf(s.k, s.v, s.r | 0), u = upOn(s);
      if (u == null || w > sd.w - 2 || mx < s.x || mx > s.x + sd.w || my < s.y - sd.h - 4 || my > s.y + 2) return;
      if (!best || s.y > best.s.y) best = { s, sd, u };
    });
    return best;
  }
  // var en sak hamnar i rummet j med pekaren på (mx, my): uppe på en skiva, annars på golvet
  function sakPlats(s, j, mx, my) {
    const b = sakBox(s), w = b.x1 - b.x0;
    const y = ytaUnder(j, mx, my, w);
    if (y) return { x: Math.round(clamp(mx, y.s.x + 1 - b.x0, y.s.x + y.sd.w - 1 - b.x1)), y: y.s.y + 1, up: y.u };
    const q = klammaSak({ x: Math.round(mx), y: Math.round(my) });
    return { x: q.x, y: q.y, up: 0 };
  }
  // figuren eller djuret under pekaren – den man kan ge saken till
  function malUnder(i, lx, ly) {
    const pid = djurAt(i, lx, ly);
    if (pid) return { typ: 'djur', id: pid };
    for (let j = H.dockor.length - 1; j >= 0; j--) { const d = H.dockor[j]; if (d.room === i && inRect(lx, ly, dockaRect(d))) return { typ: 'docka', id: d.id }; }
    return null;
  }
  // det som låg på en skiva som försvann (eller flyttades) ligger nu på golvet; det som ligger rätt får sin höjd
  function settleSaker(i) {
    for (const s of sakerI(i)) {
      const b = sakBox(s);
      const y = H.rooms[i].deco.find((d) => d && SURFACES.has(d.k) && !isRider(d) && s.y === d.y + 1 && s.x + b.x0 >= d.x && s.x + b.x1 <= d.x + dimsOf(d.k, d.v, d.r | 0).w);
      const u = y ? upOn(y) : null;
      if (u != null) s.up = u; else { delete s.up; klammaSak(s); }
    }
  }
  const ater = new Map();   // sak-id → sekunder kvar tills maten är uppäten
  function nySak(slag, k, room, x, y, up = 0, mal = null) {
    if (!sakFinns(slag, k)) return null;
    if (!mal && sakerI(room).length >= MAX_SAKER_I_RUM) { play('fel'); toast($t('Rummet är fullt – ta bort något först.'), 'bad'); return null; }
    H.sakN = (H.sakN | 0) + 1;
    const s = { id: 's' + H.sakN, slag, k, room, x: Math.round(x), y: Math.round(y) };
    H.saker.push(s);
    return stallSak(s, room, x, y, up, mal);
  }
  // lägg eller flytta saken: på golvet eller en skiva, i en figurs händer, eller till ett djur
  function stallSak(s, room, x, y, up = 0, mal = null) {
    delete s.hos; ater.delete(s.id);
    s.room = room;
    const d = mal?.typ === 'docka' ? dockaMed(mal.id) : null;
    if (d) {
      const annan = sakHos(d.id);
      if (annan && annan !== s) laggNer(annan);   // händerna är fulla: det gamla läggs ner
      s.hos = { typ: 'docka', id: d.id }; s.room = d.room; s.x = d.x; s.y = d.y; delete s.up;
      if (s.slag === 'mat') ater.set(s.id, 4.5);
      play('ok'); spara();
      return s;
    }
    const p = mal?.typ === 'djur' ? store.petById(mal.id) : null;
    if (p) {
      const L = layers[p.room | 0], a = L?._debug.actors.get(p.id);   // (där djuret står just nu, inte där det ställdes)
      L?._debug.setMode(p.id, 'happy'); store.play(p.id); play('chirp');
      if (s.slag === 'mat') { H.saker.splice(H.saker.indexOf(s), 1); spara(); return null; }   // (uppäten)
      const q = klammaSak({ x: Math.round((a ? a.x : p.x) + 12), y: Math.round((a ? a.y : p.y) + 1) });
      s.room = p.room | 0; s.x = q.x; s.y = q.y; delete s.up;
      spara();
      return s;
    }
    s.x = Math.round(x); s.y = Math.round(y);
    if (up > 0) s.up = up; else { delete s.up; klammaSak(s); }
    play('ok'); spara();
    return s;
  }
  function laggNer(s) {
    const d = s.hos ? dockaMed(s.hos.id) : null;
    delete s.hos; ater.delete(s.id); delete s.up;
    if (d) { s.room = d.room; const q = klammaSak({ x: d.x + 14, y: d.y }); s.x = q.x; s.y = q.y; }
    spara();
  }
  function taBortSak(id) {
    const k = H.saker.findIndex((s) => s.id === id);
    if (k < 0) return false;
    H.saker.splice(k, 1); ater.delete(id);
    play('click'); spara();
    return true;
  }
  function menySak(s) {
    openModal(`${sakIkon(s)} ${esc(sakNamn(s))}`, `<div class="dock-meny"><span data-sakik></span><p style="font-size:var(--f2);margin:0">${$t('Dra saken dit du vill ha den – upp på ett bord, till en figur som håller den, eller till ett djur som leker med den.')}</p></div>`, [
      { label: $t('🗑 Ta bort'), cls: 'btn-red', onClick: () => { closeModal(); taBortSak(s.id); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    const el = document.querySelector('#modal [data-sakik]');
    if (el) el.replaceWith(sakIkonCanvas(s.slag, s.k, 3));
  }
  // ikonen i lådan och menyn: leksakens vilobild, råvarans 12 × 12, uppskalade
  function sakIkonCanvas(slag, k, scale = 2) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    if (slag === 'leksak') {
      const f = toyFrame(k, 0, 'vila', 1);
      if (!f) return c;
      const sc = f.w * scale > 54 || f.h * scale > 44 ? 1 : scale;
      c.width = f.w * sc; c.height = f.h * sc; x.imageSmoothingEnabled = false;
      x.drawImage(f.c, 0, 0, f.w, f.h, 0, 0, f.w * sc, f.h * sc);
      return c;
    }
    c.width = RAVARA_W * scale; c.height = RAVARA_W * scale; x.imageSmoothingEnabled = false;
    x.drawImage(ravaraIcon(k), 0, 0, RAVARA_W, RAVARA_W, 0, 0, c.width, c.height);
    return c;
  }
  // saken i en figurs händer: bär-bildrutan har händerna ihop framför magen (ca 17 rader över fötterna,
  // sittande 13); mat som äts förs mot munnen (sittande: ät-bildrutan, händerna vid munnen 21 rader upp)
  function drawHeld(ctx, s, x, y, sitter, t) {
    const ats = ater.has(s.id);
    const bit = ats && !sitter && Math.sin(t * 7) > 0.2 ? 5 : 0;
    const hy = sitter ? (ats ? y - 21 : y - 13) : y - 17 - bit;
    x = Math.round(x);
    if (s.slag === 'leksak') { const f = toyFrame(s.k, 0, 'vila', 1); if (!f) return; const hh = Math.max(1, Math.min(f.h, -f.y0)); ctx.drawImage(f.c, 0, 0, f.w, hh, x + f.x0, Math.round(hy - hh / 2), f.w, hh); return; }
    ctx.drawImage(ravaraIcon(s.k), x - RAVARA_W / 2, Math.round(hy) - RAVARA_W / 2);
  }
  for (let i = 0; i < n; i++) settleSaker(i);   // (höjden på borden räknas fram ur möblerna)

  // ---------- leka: det man trycker på svarar ----------
  function reagera(h, i, lx, ly) {
    if (!h) return;
    reaktioner++;
    if (h.typ === 'docka') { reageraDocka(h.d); return; }
    if (h.typ === 'djur') { reageraDjur(h.id, i); return; }
    if (h.typ === 'sak') { reageraSak(h.s); return; }
    if (h.typ === 'pryl') { layers[i].down(lx, ly); senaste = { typ: 'pryl', k: h.k }; return; }   // lagrets eget: kasta bollen, fylla skålen …
    if (h.typ === 'deco') reageraDeco(i, h.idx);
  }
  function reageraDeco(i, idx) {
    const d = H.rooms[i].deco[idx];
    if (!d) return;
    const b = built[i], p = b.props.find((q) => q.idx === idx), w = b.walls.find((q) => q.idx === idx), r = b.rugs.find((q) => q.idx === idx);
    const key = `deco:${i}:${idx}`, k = d.k, fn = functionOf(k);
    const cx = p ? (p.solid ? (p.solid[0] + p.solid[2]) / 2 : (p.hit[0] + p.hit[2]) / 2) : w ? w.x + w.w / 2 : r ? r.x + r.w / 2 : d.x;
    const top = p ? p.top : w ? w.top : r ? r.y : d.y - 10, bot = p ? p.sort : w ? w.top + w.h : r ? r.y + r.h : d.y;
    let ljud = 'pop', info = k;
    if (INSTRUMENT[k]) {   // 🎹 pianot, fiolen och skivsamlingen spelar en melodi, noterna stiger
      const antal = melodi(INSTRUMENT[k]);
      spruta(i, cx, top, 'not', Math.min(7, antal), { col: NOTFARGER, upp: 14, fart: 8, g: 0, glapp: 0.17, dur: 1.6 });
      anim(key, 'wiggle', 0.9); ljud = 'melodi'; info = k + ':' + antal;
    } else if (LAMPOR.has(k)) {   // 💡 tänds och släcks
      if (d.lit) delete d.lit; else d.lit = true;
      spara(); ljud = d.lit ? 'ok' : 'click'; info = k + (d.lit ? ':tand' : ':slack');
      if (d.lit) spruta(i, cx, top + 4, 'gnista', 5, { col: ['#fff6c8', ljusFarg(d).c], upp: 6, fart: 14, g: 0, dur: 0.6 });
    } else if (k === 'discokula') {   // 🪩 igång / stopp
      if (d.lit) delete d.lit; else d.lit = true;
      spara(); ljud = d.lit ? 'disco' : 'click'; info = k + (d.lit ? ':tand' : ':slack');
      if (d.lit) spruta(i, cx, top + 20, 'gnista', 8, { col: DISKOFARGER, upp: 4, fart: 30, g: 0, dur: 0.8, hojd: 10 });
    } else if (GLODER.has(k)) {   // ✨ julbelysningen släcks och tänds
      if (d.slackt) delete d.slackt; else d.slackt = true;
      spara(); ljud = d.slackt ? 'click' : 'pling'; info = k + (d.slackt ? ':slack' : ':tand');
      if (!d.slackt) spruta(i, cx, top + 6, 'gnista', 6, { col: ['#ffd23f', '#ff5a5a', '#8ee08a', '#ffffff'], upp: 6, fart: 16, g: 0, dur: 0.8, hojd: 10 });
    } else if (fn === 'brasa' || fn === 'lykta') {   // 🔥 brasan och pumplyktan tänds och släcks
      if (d.lit) delete d.lit; else d.lit = true;
      spara(); ljud = d.lit ? 'ok' : 'slide'; info = k + (d.lit ? ':tand' : ':slack');
      spruta(i, cx, top + 6, 'rok', d.lit ? 4 : 3, { col: ['#d8d0c8', '#efe9e0'], upp: 14, fart: 6, g: -4, dur: 1.4 });
    } else if (k === 'brodrost') {   // 🍞 brödet poppar upp och faller ner igen
      anim(key, 'boing', 0.5); ljud = 'toast';
      for (const dx of [-2, 3]) fx.push({ room: i, x: cx + dx, y: top + 2, vx: 0, vy: -72, g: 190, t: dx > 0 ? -0.05 : 0, dur: 0.75, slag: 'rost' });
    } else if (fn === 'laga') {   // 🍳 spisen och ugnen fräser och ångar
      anim(key, 'wiggle', 0.6); ljud = 'sizzle';
      spruta(i, cx, top + 2, 'rok', 6, { col: ['#f4f4f8', '#e8e8f0'], upp: 18, fart: 8, g: -6, glapp: 0.12, dur: 1.4, bredd: Math.max(10, (p?.solid ? p.solid[2] - p.solid[0] : 20) - 8) });
    } else if (k === 'mikro') { anim(key, 'wiggle', 0.5); ljud = 'ding'; spruta(i, cx, top + 2, 'gnista', 3, { col: ['#fff6c8', '#ffe28a'], upp: 8, fart: 10, g: 0, dur: 0.6 }); }
    else if (fn === 'ata') { anim(key, 'wiggle', 0.5); ljud = 'door'; spruta(i, cx, top + 8, 'gnista', 6, { col: ['#bfe8ff', '#ffffff'], upp: 8, fart: 16, g: 0, dur: 0.8, hojd: 10 }); }   // 🧊 kylan ryker ut
    else if (fn === 'tvatta' || fn === 'toalett') { anim(key, 'wiggle', 0.5); ljud = 'splash'; spruta(i, cx, top + 4, 'bubbla', 7, { upp: 20, fart: 10, g: -3, glapp: 0.1, dur: 1.4 }); }   // 🫧 vatten
    else if (fn === 'tv') { anim(key, 'wiggle', 0.5); ljud = 'tv'; spruta(i, cx, top + 4, 'gnista', 6, { col: ['#8ad0ff', '#ffffff', '#ff8ad0'], upp: 10, fart: 20, g: 0, dur: 0.7 }); }   // 📺 skärmen blinkar
    else if (fn === 'sova' || SEATS.has(k)) {   // 🛋️ studsar – och den som sitter där hoppar
      anim(key, 'boing', 0.6); ljud = 'boing';
      for (const dd of H.dockor) if (dd.room === i && seatUnder(i, dd.x, dd.y)?.idx === idx) anim('docka:' + dd.id, 'hopp', 0.45, 8);
    } else if (k === 'vaggklocka') { anim(key, 'sway', 1.2); ljud = 'ding'; }
    else if (k === 'spegel') { anim(key, 'sway', 0.6); ljud = 'pling'; spruta(i, cx, top + 6, 'gnista', 5, { col: ['#ffffff', '#fff6c8'], upp: 6, fart: 12, g: 0, dur: 0.7, hojd: 12 }); }
    else if (fn === 'garderob') { anim(key, 'wiggle', 0.5); ljud = 'knock'; }
    else if (k === 'vaxt' || /^vaxt|blom|trad$/.test(k)) { anim(key, 'wiggle', 0.7); ljud = 'shake'; spruta(i, cx, top + 6, 'lov', 4, { col: ['#5aa84a', '#8ad060', '#3a8a3a'], upp: -8, fart: 14, g: 12, glapp: 0.1, dur: 1.1 }); }   // 🌿 löv faller
    else if (JUL.test(k) || /gran$/.test(k)) { anim(key, 'wiggle', 0.7); ljud = 'pling'; spruta(i, cx, top + 8, 'gnista', 6, { col: ['#ffd23f', '#ff5a5a', '#8ee08a', '#ffffff'], upp: 6, fart: 16, g: 0, dur: 0.8, hojd: 14 }); }
    else if (MJUKT.has(k)) { anim(key, 'boing', 0.6); ljud = 'squeak'; }
    else if (w) { anim(key, 'sway', 0.8); ljud = 'knock'; }   // tavlor och hyllor svajar
    else if (r) { ljud = 'shake'; spruta(i, cx, bot - 2, 'rok', 3, { col: ['#d8d0c8'], upp: 6, fart: 10, g: -2, dur: 0.8, bredd: 20 }); }   // mattan dammar
    else { anim(key, 'wiggle', 0.6); ljud = 'pop'; }
    if (ljud !== 'melodi') play(ljud);
    senaste = { typ: 'deco', k: info, ljud, room: i, idx };
  }
  function reageraDocka(d) {
    const q = dockaPos(d);
    anim('docka:' + d.id, 'hopp', 0.5, q.sitter ? 7 : 10);
    play('boing');
    sag(d, pick(DOCK_LEK), 2.5);
    if (Math.random() < 0.5) spruta(d.room, q.x, q.y - 40, 'hjarta', 2, { upp: 10, fart: 6, g: 0, dur: 1 });
    senaste = { typ: 'docka', id: d.id };
  }
  function reageraDjur(id, i) {
    const L = layers[i], love = (reaktioner & 1) === 0;
    if (love) { store.pet(id); L._debug.setMode(id, 'love'); } else { store.play(id); L._debug.setMode(id, 'happy'); }
    play(love ? 'pling' : 'chirp');
    const a = L._debug.actors.get(id);
    if (a) spruta(i, a.x, a.y - 14, 'hjarta', love ? 3 : 1, { upp: 10, fart: 8, g: 0, dur: 1 });
    senaste = { typ: 'djur', id, mode: love ? 'love' : 'happy' };
  }
  function reageraSak(s) {
    const key = 'sak:' + s.id, def = s.slag === 'leksak' ? toyOf(s.k) : null;
    let ljud = 'pop';
    if (s.slag === 'mat') anim(key, 'hopp', 0.35, 5);
    else if (BOLL.test(s.k)) { anim(key, 'studs', 0.7, 18); ljud = 'boing'; }
    else if (BIL.test(s.k)) { anim(key, 'kor', 0.9, s.x < FW / 2 ? 16 : -16); ljud = 'honk'; }
    else if (def?.squish) { anim(key, 'klam', 0.6); ljud = 'squeak'; }
    else { anim(key, 'hopp', 0.4, 6); ljud = def?.grupp === 'nalle' || def?.kompis ? 'squeak' : 'pop'; }
    play(ljud);
    senaste = { typ: 'sak', id: s.id, k: s.k, ljud };
  }
  // en lös sak med sin animation: klämkompisen kläms (egen bildruta), annars lyfts eller körs den
  function drawSakAnim(ctx, s, x, y, t, skugga) {
    const a = anims.get('sak:' + s.id);
    if (!a) { drawSak(ctx, s, x, y, t, skugga); return; }
    const u = a.t / a.dur;
    if (a.typ === 'klam' && s.slag === 'leksak') {
      const f = toyFrame(s.k, Math.round(SQUISH_STEPS * Math.sin(Math.PI * u)), u < 0.55 ? 'klamd' : 'glad', 1);
      if (!f) { drawSak(ctx, s, x, y, t, skugga); return; }
      const X = Math.round(x), Y = Math.round(y);
      if (skugga) ctx.drawImage(f.c, X + f.x0, Y + f.y0);
      else { const hh = Math.min(f.h, -f.y0); if (hh > 0) ctx.drawImage(f.c, 0, 0, f.w, hh, X + f.x0, Y + f.y0, f.w, hh); }
      toyFx(ctx, f, X, Y, t, s.k, 2);
      return;
    }
    medAnim(ctx, 'sak:' + s.id, x, y, () => drawSak(ctx, s, x, y, t, skugga));
  }

  // det som ligger under pekaren i rummet i: djuren och prylarna, de lösa sakerna, figurerna, sedan
  // golvmöblerna (den längst fram vinner), väggsakerna, sist mattorna → { typ, … } | null
  function hitAt(i, lx, ly) {
    const pid = djurAt(i, lx, ly);
    if (pid) return { typ: 'djur', id: pid };
    const it = layers[i].itemAt(lx, ly);
    if (it) return { typ: 'pryl', id: it.id, k: it.k };
    const sk = sakAt(i, lx, ly);
    if (sk) return { typ: 'sak', s: sk };
    for (let j = H.dockor.length - 1; j >= 0; j--) { const d = H.dockor[j]; if (d.room === i && inRect(lx, ly, dockaRect(d))) return { typ: 'docka', d }; }
    const b = built[i];
    for (let j = b.props.length - 1; j >= 0; j--) if (inRect(lx, ly, b.props[j].rect)) return { typ: 'deco', idx: b.props[j].idx };
    for (let j = b.walls.length - 1; j >= 0; j--) { const w = b.walls[j]; if (inRect(lx, ly, [w.x, w.top, w.x + w.w, w.top + w.h])) return { typ: 'deco', idx: w.idx }; }
    for (let j = b.rugs.length - 1; j >= 0; j--) { const r = b.rugs[j]; if (inRect(lx, ly, [r.x, r.y, r.x + r.w, r.y + r.h])) return { typ: 'deco', idx: r.idx }; }
    return null;
  }

  // var det man håller i hamnar i rummet j med pekaren på (mx, my): { x, y, up } – en småsak
  // över en bordsskiva ställs uppe på skivan, annars kläms den innanför golvet/väggen
  function placeFor(c, j, mx, my) {
    const { w } = dimsAv(c.k, c.v, c.r);
    if (ON_TABLE.has(c.k)) {
      const best = ytaUnder(j, mx, my, w, !c.fromTray && c.room === j ? c.idx : -1);
      if (best) { const { s, sd, u } = best; return { x: Math.max(s.x + 1, Math.min(s.x + sd.w - 1 - w, Math.round(mx - w / 2))), y: s.y + 1, up: u }; }
    }
    const d = klamma({ k: c.k, v: c.v, r: c.r, x: Math.round(mx + c.offx), y: Math.round(my + c.offy) });
    return { x: d.x, y: d.y, up: 0 };
  }
  function ghostTo(x, y) {
    const wx = x + camX, j = roomAt(wx), lx = clamp(wx - ox(j), 0, FW);
    if (drag.typ === 'docka') { const q = klammaDocka({ x: Math.round(lx + drag.offx), y: Math.round(y + drag.offy) }); drag.groom = j; drag.gx = q.x; drag.gy = q.y; return; }
    if (drag.typ === 'djur' || drag.typ === 'pryl') { const q = klammaDjur({ x: Math.round(lx + drag.offx), y: Math.round(y + drag.offy) }); drag.groom = j; drag.gx = q.x; drag.gy = q.y; return; }
    if (drag.typ === 'sak') {   // över en figur eller ett djur: dit; annars på skivan under pekaren eller på golvet
      const mal = malUnder(j, lx, y);
      drag.groom = j; drag.mal = mal;
      if (mal) { drag.gx = Math.round(lx); drag.gy = Math.round(y); drag.gup = 0; return; }
      const pos = sakPlats(drag.s, j, lx + drag.offx, y + drag.offy);
      drag.gx = pos.x; drag.gy = pos.y; drag.gup = pos.up;
      return;
    }
    const pos = placeFor(drag, j, lx, y);
    drag.groom = j; drag.gx = pos.x; drag.gy = pos.y; drag.gup = pos.up;
  }
  function laggTill(i, d) {
    const list = H.rooms[i].deco;
    if (list.length >= MAX_I_RUM) { play('fel'); toast($t('Rummet är fullt – ta bort något först.'), 'bad'); return false; }
    const it = tvattaDeco(d);
    if (!(it.up > 0)) klamma(it);
    list.push(it);
    play('ok'); spara(); rebuild(i);
    return true;
  }
  function taBort(i, idx) {
    const list = H.rooms[i].deco;
    if (!list[idx]) return;
    list.splice(idx, 1);
    settle(i); settleSaker(i);
    play('click'); spara(); rebuild(i);
  }
  // släpp det man drar: nytt från lådan, flyttat i rummet, eller flyttat till ett annat rum
  function commit(c) {
    if (c.typ === 'docka') { stallDocka(c.id, c.groom, c.gx, c.gy); return; }
    if (c.typ === 'djur') { if (c.fromTray) nyttDjur(c.species, c.breed, c.groom, c.gx, c.gy); else { flyttaDjur(c.id, c.groom, c.gx, c.gy); play('click'); } return; }
    if (c.typ === 'pryl') { if (c.fromTray) nyPryl(c.k, c.groom, c.gx, c.gy); else { flyttaPryl(c.id, c.groom, c.gx, c.gy); play('click'); } return; }
    if (c.typ === 'sak') { if (c.fromTray) nySak(c.slag, c.k, c.groom, c.gx, c.gy, c.gup, c.mal); else if (sakMed(c.id)) stallSak(c.s, c.groom, c.gx, c.gy, c.gup, c.mal); return; }
    if (c.fromTray) { laggTill(c.groom, { k: c.k, v: c.v, r: c.r, x: c.gx, y: c.gy, up: c.gup }); return; }
    const from = H.rooms[c.room].deco, d = c.d;
    if (!from.includes(d)) { rebuild(c.room); return; }
    if (c.groom !== c.room) {
      from.splice(from.indexOf(d), 1);
      for (const q of c.riders) { const qi = from.indexOf(q.d); if (qi >= 0) from.splice(qi, 1); }
      const to = H.rooms[c.groom].deco;
      to.push(d); for (const q of c.riders) to.push(q.d);
    }
    d.x = c.gx; d.y = c.gy;
    if (c.gup > 0) d.up = c.gup; else delete d.up;
    for (const q of c.riders) { q.d.x = d.x + q.dx; q.d.y = d.y + 1; }
    settle(c.groom); settleSaker(c.groom); if (c.groom !== c.room) { settle(c.room); settleSaker(c.room); }
    play('click'); spara(); rebuild(c.room); rebuild(c.groom);
  }

  // ---------- menyn för en möbel (kort tryck) ----------
  function menyFor(i, idx) {
    const d = H.rooms[i].deco[idx];
    if (!d) return;
    const kat = katalogOf(d.k), vars = kat?.vars | 0, fn = functionOf(d.k);
    const igen = () => { spara(); rebuild(i); play('click'); menyFor(i, idx); };
    openModal(`${EGNA[d.k]?.icon || kat?.icon || '🪴'} ${namnAv(d.k)}`, `<div class="dock-meny"><span data-thumb></span><p style="font-size:var(--f2);margin:0">${$t('Dra möbeln dit du vill ha den – även in i ett annat rum. Här vrider, målar och byter du den.')}</p></div>`, [
      ...(d.k !== 'vaxt' && !EGNA[d.k] ? [{ label: $t('🔄 Vrid'), onClick: () => { d.r = ((d.r | 0) + 1) % rotStates(d.k); if (!d.r) delete d.r; if (!(d.up > 0)) klamma(d); igen(); } }] : []),
      // belysningen (v0.167): lamporna tänds, släcks och får en ljusfärg; julbelysningen släcks; discokulan startas
      ...(LAMPOR.has(d.k) ? [{ label: d.lit ? $t('💡 Släck') : $t('💡 Tänd'), cls: 'btn-gold', onClick: () => { if (d.lit) delete d.lit; else d.lit = true; igen(); } },
        { label: $t`🎨 Ljus: ${ljusFarg(d).namn}`, onClick: () => { const n = LJUSFARGER.findIndex((f) => f.id === ljusFarg(d).id); d.ljus = LJUSFARGER[(n + 1) % LJUSFARGER.length].id; if (d.ljus === LJUSFARGER[0].id) delete d.ljus; d.lit = true; igen(); } }] : []),
      ...(GLODER.has(d.k) ? [{ label: d.slackt ? $t('✨ Tänd') : $t('✨ Släck'), cls: 'btn-gold', onClick: () => { if (d.slackt) delete d.slackt; else d.slackt = true; igen(); } }] : []),
      ...(d.k === 'discokula' ? [{ label: d.lit ? $t('🪩 Stoppa') : $t('🪩 Starta'), cls: 'btn-gold', onClick: () => { if (d.lit) delete d.lit; else { d.lit = true; play('disco'); } igen(); } }] : []),
      ...(vars > 1 ? [{ label: $t('🔁 Byt modell'), onClick: () => { d.v = ((d.v | 0) + 1) % vars; if (!(d.up > 0)) klamma(d); igen(); } }] : []),
      ...(canRecolor(d.k) ? [{ label: $t('🎨 Färg'), cls: 'btn-gold', onClick: () => {
        closeModal();
        import('./shop-mobler.js').then((m) => m.openRecolor(A, { kind: d.k, v: d.v, c: d.c, onPick: (hex) => { if (hex) d.c = hex; else delete d.c; spara(); rebuild(i); play('ok'); } })).catch(() => {});
      } }] : []),
      ...(fn === 'brasa' || fn === 'lykta' ? [{ label: d.lit ? $t('🔥 Släck') : $t('🔥 Tänd'), onClick: () => { if (d.lit) delete d.lit; else d.lit = true; igen(); } }] : []),
      { label: $t('🗑 Ta bort'), cls: 'btn-red', onClick: () => { closeModal(); taBort(i, idx); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    const el = document.querySelector('#modal [data-thumb]');
    if (el) el.replaceWith(egenThumb(d.k) || thumbCanvas(d.k, d.v, d.c));
  }
  // miniatyren i lådan och menyn för husets egna saker (×2)
  function egenThumb(k) {
    if (!EGNA[k]) return null;
    const img = diskoBilder()[0], c = document.createElement('canvas'), x = c.getContext('2d'), y0 = 9;   // (utan tråden – annars får namnet inte plats)
    c.width = img.width * 2; c.height = (img.height - y0) * 2; x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, y0, img.width, img.height - y0, 0, 0, c.width, c.height);
    return c;
  }

  // ---------- pekaren ----------
  function down(x, y) {
    camTo = null;
    const wx = x + camX, i = roomAt(wx), lx = wx - ox(i);
    if (armed) {   // vald i lådan: ställ den här
      if (armed.typ === 'docka') { stallDocka(armed.id, i, Math.round(lx), Math.round(y)); armed = null; fyllLada(); return; }
      if (armed.typ === 'djur') { nyttDjur(armed.species, armed.breed, i, lx, y); armed = null; fyllLada(); return; }
      if (armed.typ === 'pryl') { nyPryl(armed.k, i, lx, y); armed = null; fyllLada(); return; }
      if (armed.typ === 'sak') { const s0 = { slag: armed.slag, k: armed.k }, pos = sakPlats(s0, i, lx, y); nySak(armed.slag, armed.k, i, pos.x, pos.y, pos.up, malUnder(i, lx, y)); armed = null; fyllLada(); return; }
      const c = { ...armed, fromTray: true, offx: -dimsAv(armed.k, armed.v, armed.r).w / 2, offy: 0 };
      const pos = placeFor(c, i, lx, y);
      laggTill(i, { k: c.k, v: c.v, r: c.r, x: pos.x, y: pos.y, up: pos.up });
      armed = null; fyllLada();
      return;
    }
    const h = hitAt(i, lx, y);
    // LEKA: möblerna och djurens prylar står fast – ett tryck på dem svarar (i up), ett drag panorerar;
    // figurer, djur och lösa saker dras som i Bygga, men ett kort tryck blir en reaktion i stället för menyn
    if (leker() && (!h || h.typ === 'deco' || h.typ === 'pryl')) { pan = { sx: x, cam0: camX, moved: false, tapp: h ? { h, i, lx, ly: y } : null }; return; }
    if (h?.typ === 'djur') {
      const a = djurI(i).find((q) => q.id === h.id);
      drag = { typ: 'djur', id: h.id, room: i, offx: a.x - lx, offy: a.y - y, moved: false, px: x, py: y, sx: x, sy: y, groom: i, gx: a.x, gy: a.y };
      layers[i]._debug.setMode(h.id, 'idle');   // (står still medan man håller i det)
      return;
    }
    if (h?.typ === 'pryl') {
      const it = store.itemById(h.id);
      drag = { typ: 'pryl', id: h.id, k: h.k, room: i, offx: it.x - lx, offy: it.y - y, moved: false, px: x, py: y, sx: x, sy: y, groom: i, gx: it.x, gy: it.y, lx, ly: y };
      return;
    }
    if (h?.typ === 'sak') {
      const s = h.s, fy = sakFot(s);
      drag = { typ: 'sak', id: s.id, s, slag: s.slag, k: s.k, room: i, offx: s.x - lx, offy: fy - y, moved: false, px: x, py: y, sx: x, sy: y, groom: i, gx: s.x, gy: s.y, gup: s.up || 0, mal: null };
      return;
    }
    if (h?.typ === 'docka') {
      const d = h.d;
      drag = { typ: 'docka', id: d.id, docka: d, room: i, offx: d.x - lx, offy: d.y - y, moved: false, px: x, py: y, sx: x, sy: y, groom: i, gx: d.x, gy: d.y };
      return;
    }
    if (h?.typ === 'deco') {
      const idx = h.idx, d = H.rooms[i].deco[idx];
      drag = { typ: 'deco', room: i, idx, d, k: d.k, v: d.v, c: d.c, r: d.r | 0, offx: d.x - lx, offy: d.y - y, moved: false, px: x, py: y, sx: x, sy: y,
        riders: SURFACES.has(d.k) ? ridersOf(H.rooms[i].deco, idx) : [], groom: i, gx: d.x, gy: d.y, gup: d.up || 0 };
      rebuild(i);
      return;
    }
    pan = { sx: x, cam0: camX, moved: false };
  }
  function move(x, y) {
    if (drag) {
      drag.px = x; drag.py = y;
      if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 3) drag.moved = true;
      if (drag.moved) ghostTo(x, y);
      return;
    }
    if (pan) { const dx = x - pan.sx; if (Math.abs(dx) > 3) pan.moved = true; if (pan.moved) camX = clampCam(pan.cam0 - dx); }
  }
  function up(x, y) {
    if (drag) {
      const c = drag; drag = null;
      if (c.moved) commit(c);
      else if (leker()) reagera(c.typ === 'docka' ? { typ: 'docka', d: c.docka } : c.typ === 'sak' ? (sakMed(c.id) ? { typ: 'sak', s: c.s } : null) : c.typ === 'djur' ? { typ: 'djur', id: c.id } : null, c.room, c.lx, c.ly);
      else if (c.typ === 'docka') menyDocka(c.docka);
      else if (c.typ === 'sak') { if (sakMed(c.id)) menySak(c.s); }
      else if (c.typ === 'djur') menyDjur(c.id);
      else if (c.typ === 'pryl') layers[c.room].down(c.lx, c.ly);   // lagrets egna val: bära säcken, fylla skålen, kasta bollen, tömma lådan
      else { rebuild(c.room); menyFor(c.room, c.idx); }
      return;
    }
    if (pan) {
      const p = pan; pan = null;
      if (p.moved) return;
      if (p.tapp) { reagera(p.tapp.h, p.tapp.i, p.tapp.lx, p.tapp.ly); return; }   // (Leka: trycket på en möbel)
      const wx = x + camX, i = roomAt(wx), lx = wx - ox(i);
      if (i === 0 && inRect(lx, y, [DOOR.x0, 30, DOOR.x1, WALL_Y + 9])) { play('door'); A.leaveDockskap?.(); }
    }
  }
  function key(k) {
    if (k === 'Escape') {
      if (drag) { const c = drag; drag = null; if (c.typ === 'deco' && !c.fromTray) rebuild(c.room); return; }
      if (armed) { armed = null; fyllLada(); }
      return;
    }
    if ((k === 'r' || k === 'R') && drag?.typ === 'deco') { drag.r = (drag.r + 1) % rotStates(drag.k); if (drag.moved) ghostTo(drag.px, drag.py); return; }
    if (k === 'ArrowLeft') camTo = clampCam((camTo ?? camX) - 120);
    if (k === 'ArrowRight') camTo = clampCam((camTo ?? camX) + 120);
  }

  // ---------- lådan (DOM) ----------
  let panel = null, flik = 'vardagsrum', temaRum = -1;
  function byggPanel() {
    panel = document.getElementById('dock-panel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'dock-panel'; document.body.append(panel); }
    panel.innerHTML = `<div class="dp-head"><span>🧸 ${$t('Dockskåpet')}</span><span class="dock-rum">${RUM.map((r, i) => `<button class="btn btn-small" data-rum="${i}" title="${$t(r.name)}">${r.ik}</button>`).join('')}</span></div>
      <div class="dock-flikar">${FLIKAR.map((f) => `<button class="btn btn-small ${f.id === flik ? 'btn-go' : ''}" data-flik="${f.id}" title="${f.namn}">${f.ik}</button>`).join('')}</div>
      <div id="dock-items"></div>
      <div class="dp-foot"><button class="btn btn-small" data-natt>${H.natt ? $t('☀️ Dag') : $t('🌙 Natt')}</button><button class="btn btn-small" data-ut title="${$t('Tillbaka till menyn')}">${$t('⬅ Tillbaka')}</button></div>`;
    panel.querySelectorAll('[data-rum]').forEach((b) => (b.onclick = () => { play('click'); camTo = camRoom(+b.dataset.rum); }));
    panel.querySelectorAll('[data-flik]').forEach((b) => (b.onclick = () => { play('click'); flik = b.dataset.flik; byggPanel(); }));
    panel.querySelector('[data-natt]').onclick = nattToggle;
    panel.querySelector('[data-ut]').onclick = () => { play('door'); A.leaveDockskap?.(); };
    fyllLada();
    panel.classList.toggle('hidden', lage !== 'bygga');   // (lådan är bara framme i Bygga)
  }
  function nattToggle() { H.natt = !H.natt; spara(true); play('click'); byggPanel(); byggLage(); }
  // ---------- de två stora knapparna: 🧸 Leka och 🔨 Bygga (DOM, uppe till vänster) ----------
  // I Leka ligger också 🌙 och ⬅ här, eftersom lådan med sin fot är borta.
  let lageEl = null;
  function byggLage() {
    lageEl = document.getElementById('dock-lage');
    if (!lageEl) { lageEl = document.createElement('div'); lageEl.id = 'dock-lage'; document.body.append(lageEl); }
    lageEl.innerHTML = `<button class="dl-btn ${lage === 'leka' ? 'on' : ''}" data-lage="leka">🧸<span>${$t('Leka')}</span></button><button class="dl-btn ${lage === 'bygga' ? 'on' : ''}" data-lage="bygga">🔨<span>${$t('Bygga')}</span></button>`
      + `<span class="dl-sma"><button class="btn btn-small" data-natt2 title="${H.natt ? $t('☀️ Dag') : $t('🌙 Natt')}">${H.natt ? '☀️' : '🌙'}</button><button class="btn btn-small" data-ut2 title="${$t('Tillbaka till menyn')}">⬅</button></span>`;
    lageEl.querySelectorAll('[data-lage]').forEach((b) => (b.onclick = () => sattLage(b.dataset.lage)));
    lageEl.querySelector('[data-natt2]').onclick = nattToggle;
    lageEl.querySelector('[data-ut2]').onclick = () => { play('door'); A.leaveDockskap?.(); };
    lageEl.classList.remove('hidden');
  }
  function sattLage(l, tyst = false) {
    if (!LAGEN.includes(l)) return;
    const bytte = l !== lage;
    lage = l; H.lage = l;
    if (drag) { const c = drag; drag = null; if (c.typ === 'deco' && !c.fromTray) rebuild(c.room); }
    armed = null; pan = null;
    document.body.classList.toggle('dock-leka', l === 'leka'); document.body.classList.toggle('dock-bygga', l === 'bygga');
    panel?.classList.toggle('hidden', l !== 'bygga');
    lageEl?.querySelectorAll('[data-lage]').forEach((b) => b.classList.toggle('on', b.dataset.lage === l));
    if (bytte) {
      spara(true); play(l === 'leka' ? 'pling' : 'click'); fyllLada();
      if (!tyst) toast(l === 'leka' ? $t('🧸 Leka: tryck på allt i huset! Figurerna, djuren och sakerna går att dra.') : $t('🔨 Bygga: dra möbler från lådan, flytta, vrid och måla dem.'));
    }
    window.dispatchEvent(new Event('resize'));   // (rummet blir bredare utan lådan)
  }
  function fyllLada() {
    const box = panel?.querySelector('#dock-items');
    if (!box) return;
    const f = FLIKAR.find((x) => x.id === flik) || FLIKAR[0];
    if (f.djur) {   // 🐾 nya djur (alla raser), prylarna och djuren som bor i huset
      const hemma = store.petsHome(DJUR_HEM);
      box.innerHTML = `<div class="dock-rubrik">${$t('Nytt djur')}</div>`
        + RASER.map((r, k) => `<button class="dock-item ${armed?.typ === 'djur' && armed.breed === r.breed && armed.species === r.species ? 'on' : ''}" data-ras="${k}" title="${esc(r.namn)}"><span data-petik="${k}"></span><small>${esc(r.namn)}</small></button>`).join('')
        + `<div class="dock-rubrik">${$t('Prylar')}</div>`
        + PRYLAR.map((k) => `<button class="dock-item ${armed?.typ === 'pryl' && armed.k === k ? 'on' : ''}" data-pryl="${k}" title="${esc(PET_ITEMS[k].namn)}"><span data-prylik="${k}"></span><small>${esc(PET_ITEMS[k].namn)}</small></button>`).join('')
        + (hemma.length ? `<div class="dock-rubrik">${$t('I huset')}</div>` + hemma.map((p) => `<button class="dock-item dock-hemma" data-djur="${esc(p.id)}" title="${esc(p.name)}"><span data-petik2="${esc(p.id)}"></span><small>${esc(p.name)}</small><b class="dock-x" data-bort="${esc(p.id)}" title="${$t('🧸 Till lådan')}">✕</b></button>`).join('') : '');
      const ikon = (pet) => { const c = document.createElement('canvas'); c.width = ICON_W * 2; c.height = ICON_H * 2; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; drawPetIcon(x, 0, 0, pet, 2); return c; };
      box.querySelectorAll('[data-petik]').forEach((el) => { const r = RASER[+el.dataset.petik]; el.replaceWith(ikon({ species: r.species, breed: r.breed, stage: 'vuxen', sex: 'hane', id: 'ikon' })); });
      box.querySelectorAll('[data-petik2]').forEach((el) => { const p = store.petById(el.dataset.petik2); if (p) el.replaceWith(ikon(p)); });
      box.querySelectorAll('[data-prylik]').forEach((el) => { const c = document.createElement('canvas'); c.width = 48; c.height = 40; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; const d = PET_ITEMS[el.dataset.prylik]; const W2 = (Math.max(d.w, 11) + 4) * 2, H2 = (d.h + 4) * 2; drawItemIcon(x, el.dataset.prylik, (48 - Math.min(48, W2)) / 2, Math.max(0, 40 - H2), 2); el.replaceWith(c); });
      box.querySelectorAll('[data-ras]').forEach((b) => { b.onpointerdown = (e) => tagDjur(e, RASER[+b.dataset.ras]); });
      box.querySelectorAll('[data-pryl]').forEach((b) => { b.onpointerdown = (e) => tagPryl(e, b.dataset.pryl); });
      box.querySelectorAll('[data-djur]').forEach((b) => { b.onclick = (e) => { if (e.target.closest('[data-bort]')) { taBortDjur(b.dataset.djur); return; } const p = store.petById(b.dataset.djur); if (p) { play('click'); camTo = camRoom(p.room | 0); } }; });
      return;
    }
    if (f.teman) {   // 🎨 tapet, golv och utsikt för rummet i bild (badrummet: kakel) + färdiga teman
      const i = rumIVy(), R = RUM[i], t = H.rooms[i].tema || {};
      temaRum = i;
      const chip = (a, b) => `<i class="dock-chip" style="background:${b != null ? `linear-gradient(135deg, ${css(a)} 50%, ${css(b)} 50%)` : css(a)}"></i>`;
      const knapp = (attr, id, on, inner, namn) => `<button class="dock-item dock-tema ${on ? 'on' : ''}" data-${attr}="${id}" title="${esc(namn)}">${inner}<small>${esc(namn)}</small></button>`;
      let html = `<div class="dock-rubrik">${R.ik} ${$t(R.name)}</div>`;
      if (!R.bath) {
        html += `<div class="dock-rubrik">${$t('Färdiga teman')}</div>` + TEMAN.map((T) => { const ta = TAPETER.find((x) => x.id === T.tapet), g = GOLV.find((x) => x.id === T.golv); return knapp('tema', T.id, t.tapet === T.tapet && t.golv === T.golv, `<span class="dock-tema-ik">${T.ik}</span>${chip(ta.wall, g.floorA)}`, T.namn); }).join('');
        html += `<div class="dock-rubrik">${$t('Tapet')}</div>` + knapp('tapet', '', !t.tapet, chip(R.wall, R.wallDk), $t('Rummets egen'))
          + TAPETER.map((x) => knapp('tapet', x.id, t.tapet === x.id, chip(x.wall, x.wallDk), x.namn)).join('');
        html += `<div class="dock-rubrik">${$t('Golv')}</div>` + knapp('golv', '', !t.golv, chip(R.floorA, R.floorB), $t('Rummets egen'))
          + GOLV.map((x) => knapp('golv', x.id, t.golv === x.id, chip(x.floorA, x.floorB), x.namn)).join('');
      } else {
        html += `<div class="dock-rubrik">${$t('Kakel')}</div>` + KAKEL.map((x) => knapp('kakel', x.id, (t.kakel || R.tiles) === x.id, chip(x.wall, x.floorB), x.namn)).join('');
      }
      html += `<div class="dock-rubrik">${$t('Utsikt')}</div>` + UTSIKTER.map((x) => knapp('utsikt', x.id, (t.utsikt || R.view) === x.id, `<span class="dock-tema-ik">${x.ik}</span>`, x.namn)).join('');
      box.innerHTML = html;
      box.querySelectorAll('[data-tema]').forEach((b) => { b.onclick = () => sattTemaPaket(i, TEMAN.find((T) => T.id === b.dataset.tema)); });
      for (const key of ['tapet', 'golv', 'kakel', 'utsikt']) box.querySelectorAll(`[data-${key}]`).forEach((b) => { b.onclick = () => sattTema(i, key, b.dataset[key] || null); });
      return;
    }
    if (f.saker) {   // 🎁 leksakerna och maten – gratis, hur många som helst
      const on = (slag, k) => (armed?.typ === 'sak' && armed.slag === slag && armed.k === k ? 'on' : '');
      box.innerHTML = `<div class="dock-rubrik">${$t('Leksaker')}</div>`
        + LEKSAKER.map((k) => { const nm = toyNamn(toyOf(k)); return `<button class="dock-item ${on('leksak', k)}" data-sak="${k}" data-slag="leksak" title="${esc(nm)}"><span data-sakik="${k}"></span><small>${esc(nm)}</small></button>`; }).join('')
        + `<div class="dock-rubrik">${$t('Mat')}</div>`
        + MATEN.map((k) => { const nm = ravaraOf(k).name; return `<button class="dock-item ${on('mat', k)}" data-sak="${k}" data-slag="mat" title="${esc(nm)}"><span data-sakik="${k}"></span><small>${esc(nm)}</small></button>`; }).join('');
      box.querySelectorAll('[data-sakik]').forEach((el) => { const slag = el.parentElement.dataset.slag; el.replaceWith(sakIkonCanvas(slag, el.dataset.sakik, slag === 'mat' ? 3 : 2)); });
      box.querySelectorAll('[data-sak]').forEach((b) => { b.onpointerdown = (e) => tagSak(e, b.dataset.slag, b.dataset.sak); });
      return;
    }
    if (f.figurer) {   // 🧑 gänget: de som står i huset är markerade (tryck = kameran dit), de andra dras in
      box.innerHTML = gang().map((g) => { const d = dockaMed(g.id); return `<button class="dock-item dock-fig ${d ? 'on' : ''} ${armed?.id === g.id ? 'vald' : ''}" data-fig="${esc(g.id)}" title="${esc(g.namn)}${d ? ' · ' + $t(RUM[d.room].name) : ''}"><span data-port="${esc(g.id)}"></span><small>${esc(g.namn)}</small></button>`; }).join('');
      box.querySelectorAll('[data-port]').forEach((el) => { const g = figOf(el.dataset.port); const c = portrait(g?.look || {}, '#f4f1ea'); c.style.height = '44px'; c.style.width = '36px'; el.replaceWith(c); });
      box.querySelectorAll('.dock-fig').forEach((b) => { b.onpointerdown = (e) => tagFigur(e, b.dataset.fig); });
      return;
    }
    const list = KAT.filter(f.valj);
    box.innerHTML = list.map((k) => `<button class="dock-item ${armed?.k === k.kind ? 'on' : ''}" data-k="${k.kind}" title="${k.name}"><span data-thumb="${k.kind}"></span><small>${k.name}</small></button>`).join('');
    box.querySelectorAll('[data-thumb]').forEach((el) => el.replaceWith(egenThumb(el.dataset.thumb) || thumbCanvas(el.dataset.thumb, 0, null)));
    box.querySelectorAll('.dock-item').forEach((b) => { b.onpointerdown = (e) => tagFranLadan(e, b.dataset.k); });
  }
  // Ur lådan: drar man möbeln in över rummet följer ett spöke med och släpps där; ett kort
  // tryck väljer den i stället (nästa tryck i rummet ställer den där).
  function tagFranLadan(e, k) {
    if (!kand(k)) return;
    e.preventDefault();
    const cv = document.getElementById('scene');
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      const p = tillLogisk(A, cv, ev.clientX, ev.clientY);
      if (!p.inne) { if (drag?.fromTray) drag = null; return; }
      if (!drag) drag = { fromTray: true, room: -1, idx: -1, k, v: 0, r: 0, offx: -dimsAv(k, 0, 0).w / 2, offy: 0, moved: true, riders: [], px: p.x, py: p.y, sx: p.x, sy: p.y, groom: 0, gx: 0, gy: 0, gup: 0 };
      drag.px = p.x; drag.py = p.y;
      ghostTo(p.x, p.y);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); document.removeEventListener('pointercancel', onUp);
      if (drag?.fromTray) { const c = drag; drag = null; commit(c); return; }
      if (moved) return;
      armed = armed?.k === k ? null : { k, v: 0, r: 0 };
      if (armed) toast($t('Tryck i rummet där den ska stå – eller dra den dit.'));
      fyllLada();
    };
    document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp); document.addEventListener('pointercancel', onUp);
  }

  // En figur ur lådan: dras in i rummet (står den redan i huset flyttas den), ett kort tryck på
  // en som står i huset flyttar kameran dit, på en som inte gör det väljer den (nästa tryck ställer den)
  function tagFigur(e, id) {
    if (!figOf(id)) return;
    e.preventDefault();
    const cv = document.getElementById('scene');
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      const p = tillLogisk(A, cv, ev.clientX, ev.clientY);
      if (!p.inne) { if (drag?.fromTray) drag = null; return; }
      if (!drag) drag = { typ: 'docka', fromTray: true, id, room: -1, offx: 0, offy: 0, moved: true, px: p.x, py: p.y, sx: p.x, sy: p.y, groom: 0, gx: 0, gy: 0 };
      drag.px = p.x; drag.py = p.y;
      ghostTo(p.x, p.y);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); document.removeEventListener('pointercancel', onUp);
      if (drag?.fromTray) { const c = drag; drag = null; commit(c); return; }
      if (moved) return;
      const d = dockaMed(id);
      if (d) { play('click'); camTo = camRoom(d.room); return; }
      armed = armed?.id === id ? null : { typ: 'docka', id };
      if (armed) toast($t('Tryck i rummet där figuren ska stå – eller dra den dit.'));
      fyllLada();
    };
    document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp); document.addEventListener('pointercancel', onUp);
  }

  // Ur lådan: ett djur (ras) eller en pryl – dras in i rummet, eller väljs med ett kort tryck
  function tagUrLadan(e, start0, klar) {
    e.preventDefault();
    const cv = document.getElementById('scene');
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      const p = tillLogisk(A, cv, ev.clientX, ev.clientY);
      if (!p.inne) { if (drag?.fromTray) drag = null; return; }
      if (!drag) drag = { ...start0(), fromTray: true, room: -1, offx: 0, offy: 0, moved: true, px: p.x, py: p.y, sx: p.x, sy: p.y, groom: 0, gx: 0, gy: 0 };
      drag.px = p.x; drag.py = p.y;
      ghostTo(p.x, p.y);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); document.removeEventListener('pointercancel', onUp);
      if (drag?.fromTray) { const c = drag; drag = null; commit(c); return; }
      if (!moved) klar();
    };
    document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp); document.addEventListener('pointercancel', onUp);
  }
  const tagDjur = (e, r) => tagUrLadan(e, () => ({ typ: 'djur', species: r.species, breed: r.breed }), () => {
    armed = armed?.typ === 'djur' && armed.breed === r.breed && armed.species === r.species ? null : { typ: 'djur', species: r.species, breed: r.breed };
    if (armed) toast($t('Tryck i rummet där djuret ska vara – eller dra det dit.'));
    fyllLada();
  });
  const tagPryl = (e, k) => tagUrLadan(e, () => ({ typ: 'pryl', k }), () => {
    armed = armed?.typ === 'pryl' && armed.k === k ? null : { typ: 'pryl', k };
    if (armed) toast($t('Tryck i rummet där prylen ska stå – eller dra den dit.'));
    fyllLada();
  });
  const tagSak = (e, slag, k) => tagUrLadan(e, () => ({ typ: 'sak', slag, k, s: { slag, k }, gup: 0, mal: null }), () => {
    armed = armed?.typ === 'sak' && armed.slag === slag && armed.k === k ? null : { typ: 'sak', slag, k };
    if (armed) toast($t('Tryck i rummet där saken ska ligga – eller dra den dit.'));
    fyllLada();
  });

  // ---------- ritandet ----------
  // mellanväggen mellan två rum (som i js/scenes/apartment.js): gaveln mot bakväggen, krönet
  // ut över golvet och en öppning på golvets höjd med tröskel
  function drawWall(ctx, L, R, rx) {
    const x0 = Math.round(rx - WALLW - camX), w = WALLW;
    if (x0 > (A.W || FW) || x0 + w < 0) return;
    const face = mix(L.wallDk, R.wallDk, 0.5), cap = mix(mix(L.wall, R.wall, 0.5), 0xf4f0e6, 0.45), edge = 0x1c1a20;
    const f = (c, a, b, cw, ch) => { ctx.fillStyle = css(c); ctx.fillRect(a, b, cw, ch); };
    f(face, x0, 0, w, WALL_Y);
    f(mix(face, 0xffffff, 0.18), x0 + 1, 0, 1, WALL_Y);
    f(mix(face, 0x000000, 0.25), x0 + w - 2, 0, 1, WALL_Y);
    const seg = (a, b) => { f(cap, x0, a, w, b - a); f(edge, x0, a, 1, b - a); f(edge, x0 + w - 1, a, 1, b - a); f(mix(cap, 0x000000, 0.12), x0 + 1, b - 2, w - 2, 2); };
    seg(WALL_Y, APT.DY0);
    seg(APT.DY1, FH);
    f(mix(L.floorA, R.floorA, 0.5), x0, APT.DY0, w, APT.DY1 - APT.DY0);
    f(mix(mix(L.floorB, R.floorB, 0.5), 0x000000, 0.1), x0 + 2, APT.DY0, w - 4, APT.DY1 - APT.DY0);
    f(0x6a4a2a, x0, APT.DY0 - 2, w, 2);
    f(0x6a4a2a, x0, APT.DY1, w, 2);
    ctx.fillStyle = 'rgba(20,12,28,0.18)';
    ctx.fillRect(x0 - 2, WALL_Y, 2, APT.DY0 - 2 - WALL_Y); ctx.fillRect(x0 + w, WALL_Y, 2, APT.DY0 - 2 - WALL_Y);
    ctx.fillRect(x0 - 2, APT.DY1 + 2, 2, FH - APT.DY1 - 2); ctx.fillRect(x0 + w, APT.DY1 + 2, 2, FH - APT.DY1 - 2);
    if (R.bath) { const dx = x0 + w, dy = APT.DY0 - 2; f(0x1c1a20, dx, dy - 1, 20, 5); f(0xb08a5a, dx, dy, 19, 3); f(0xd0aa74, dx, dy, 19, 1); f(0xe8c070, dx + 15, dy + 1, 2, 1); }
  }
  // spöket: det man drar, halvgenomskinligt där det kommer att hamna (med det som står på bordet)
  function drawGhost(ctx) {
    const c = drag;
    ctx.globalAlpha = 0.72;
    if (c.typ === 'docka') {   // figuren där den skulle hamna – sittande om det är ett säte
      const fig = figOf(c.id), s = seatUnder(c.groom, c.gx, c.gy);
      if (fig) drawPerson(ctx, c.gx, s ? s.sort - 1 : c.gy, fig.look, c.docka?.dir || 'down', s ? 5 : 0);
      ctx.globalAlpha = 1;
      return;
    }
    if (c.typ === 'djur') {
      const pet = c.fromTray ? { species: c.species, breed: c.breed, stage: 'vuxen', sex: 'hane', id: 'spoke' } : store.petById(c.id);
      if (pet) drawPet(ctx, c.gx, c.gy, pet, 'idle', tid, 'down');
      ctx.globalAlpha = 1;
      return;
    }
    if (c.typ === 'pryl') {
      const it = c.fromTray ? null : store.itemById(c.id);
      drawPetItem(ctx, c.k, c.gx, c.gy, it ? { food: it.food, foodKind: it.foodKind, water: it.water, dirt: it.dirt, left: it.left } : { food: 0, water: 0 });
      ctx.globalAlpha = 1;
      return;
    }
    if (c.typ === 'sak') {   // i händerna på figuren / vid djuret man håller den över, annars där den skulle ligga
      const s = c.fromTray ? { slag: c.slag, k: c.k } : c.s;
      const d = c.mal?.typ === 'docka' ? dockaMed(c.mal.id) : null, a = c.mal?.typ === 'djur' ? layers[c.groom]._debug.actors.get(c.mal.id) : null;
      if (d) { const q = dockaPos(d); drawHeld(ctx, s, q.x, q.y, q.sitter, tid); }
      else if (a) drawSak(ctx, s, a.x + 12, a.y + 1, tid);
      else drawSak(ctx, s, c.gx, c.gy - (c.gup || 0), tid, !(c.gup > 0));
      ctx.globalAlpha = 1;
      return;
    }
    const rita = (k, v, col, r, x, y, upp) => {
      if (k === 'matta') { ctx.drawImage(rugImg(v, col), x, y); return; }
      if (k === 'vaxt') { makePlantProp(x + 10, y).draw(ctx); return; }
      if (EGNA[k]) { ctx.drawImage(diskoBilder()[0], x, y - dimsAv(k).h); return; }
      const a = furnView(k, v, col, r);
      if (a) drawArt(ctx, a, x, y - (upp || 0) - a.sh);
    };
    rita(c.k, c.v, c.c, c.r, c.gx, c.gy, c.gup);
    if (c.riders?.length) for (const q of c.riders) rita(q.d.k, q.d.v, q.d.c, q.d.r | 0, c.gx + q.dx, c.gy + 1, q.d.up);
    ctx.globalAlpha = 1;
  }
  function draw(ctx) {
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    ctx.fillStyle = '#17151a'; ctx.fillRect(0, 0, A.W, A.H);
    const night = H.natt, vw = A.W || FW;
    for (let i = 0; i < n; i++) {
      const x0 = Math.round(ox(i) - camX);
      if (x0 >= vw || x0 + FW <= 0) continue;
      ctx.save();
      ctx.setTransform(A.pxs, 0, 0, A.pxs, x0 * A.pxs, 0);
      ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
      ctx.drawImage(bgs[i](night), 0, 0);
      const b = built[i];
      for (const r of b.rugs) r.draw(ctx);
      for (const w of b.walls) medAnim(ctx, `deco:${i}:${w.idx}`, w.x + w.w / 2, w.top, () => w.draw(ctx));
      const items = b.props.map((p) => ({ fy: p.sort, draw: () => medAnim(ctx, `deco:${i}:${p.idx}`, p.solid ? (p.solid[0] + p.solid[2]) / 2 : (p.hit[0] + p.hit[2]) / 2, p.sort, () => p.draw(ctx)) }));
      const disco = diskoIgang(i);
      for (const d of H.dockor) {   // figurerna: stående (blinkar till ibland) eller sittande på sitt säte – hoppar när man trycker, dansar till discokulan
        if (d.room !== i || (drag?.typ === 'docka' && drag.id === d.id)) continue;
        const fig = figOf(d.id);
        if (!fig) continue;
        const q = dockaPos(d), held = sakHos(d.id), key = 'docka:' + d.id;
        const hoppar = anims.get(key)?.typ === 'hopp';
        const frame = q.sitter ? (held && ater.has(held.id) ? 6 : 5) : held ? 9 : hoppar ? 10 : disco ? ((Math.floor(tid * 4 + d.x / 7) & 1) ? 1 : 4) : (Math.sin(tid * 2 + d.x) > 0.9 ? 4 : 0);
        items.push({ fy: q.fy, draw: () => medAnim(ctx, key, q.x, q.y, () => { drawPerson(ctx, q.x, q.y, fig.look, d.dir, frame); if (held) drawHeld(ctx, held, q.x, q.y, q.sitter, tid); }) });
      }
      for (const s of sakerI(i)) {   // de lösa sakerna på golvet och borden (den man drar i ritas som spöke)
        if (drag?.typ === 'sak' && drag.id === s.id && drag.moved) continue;
        const fy = sakFot(s);
        items.push({ fy: s.y + 0.15, draw: () => drawSakAnim(ctx, s, s.x, fy, tid, !(s.up > 0)) });
      }
      // husdjuren och deras prylar (lagret): det djur eller den pryl man håller i ritas inte där det stod
      const hall = drag?.moved && drag.room === i && !drag.fromTray ? (drag.typ === 'djur' ? layers[i]._debug.actors.get(drag.id) : drag.typ === 'pryl' ? store.itemById(drag.id) : null) : null;
      for (const d of layers[i].drawables()) { if (hall && d.x === hall.x && (drag.typ === 'pryl' ? d.fy === hall.y || d.fy === hall.y + 0.2 || d.fy < hall.y : true)) continue; items.push({ fy: d.fy, draw: () => d.draw(ctx) }); }
      if (drag?.moved && drag.groom === i) {
        const gfy = drag.typ === 'docka' ? (seatUnder(i, drag.gx, drag.gy)?.sort ?? drag.gy) + 0.6 : drag.typ === 'sak' ? (drag.mal ? 9000 : drag.gy + 0.6)
          : drag.typ === 'djur' || drag.typ === 'pryl' ? drag.gy + 0.5 : arVagg(drag.k) ? -1 : drag.gy + 0.5;
        items.push({ fy: gfy, draw: () => drawGhost(ctx) });
      }
      items.sort((a, c) => a.fy - c.fy).forEach((it) => it.draw());
      const deco = H.rooms[i].deco;
      if (night) {
        ctx.fillStyle = `rgba(10,12,40,${NIGHT_DIM})`; ctx.fillRect(0, 0, FW, FH);
        for (const w of b.walls) { const d = deco[w.idx]; if (w.egen) { if (d?.lit) diskoSken(ctx, w, true); } else if (!d?.slackt) w.light?.(ctx); }   // (julbelysningen kan vara släckt)
        for (const p of b.props) { const d = deco[p.idx]; if (LAMPOR.has(p.k)) { if (d?.lit) lampSken(ctx, p, d, true); } else if (!(GLODER.has(p.k) && d?.slackt)) p.light?.(ctx); }   // (lamporna: egna sken, tända var för sig)
      } else {
        for (const w of b.walls) if (w.egen && deco[w.idx]?.lit) diskoSken(ctx, w, false);
        for (const p of b.props) if (LAMPOR.has(p.k) && deco[p.idx]?.lit) lampSken(ctx, p, deco[p.idx], false);
      }
      if (fx.length) ritaFx(ctx, i);
      ctx.restore();
    }
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    for (let i = 0; i < n - 1; i++) drawWall(ctx, defs[i], defs[i + 1], ox(i + 1));
    if (night) { ctx.fillStyle = `rgba(10,12,40,${NIGHT_DIM})`; for (let i = 0; i < n - 1; i++) ctx.fillRect(Math.round(ox(i + 1) - WALLW - camX), 0, WALLW, FH); }
    const [sx0, sx1] = seen();
    // pratbubblan (i skärmens koordinater, innanför det synliga) – createSpeech klämmer in den i bilden,
    // så en figur i ett rum utanför bilden får ingen bubbla fastklistrad vid kanten
    const ta = talk.active() ? talkAt?.() : null;
    if (ta && ta.x >= sx0 - 12 && ta.x <= sx1 + 12) talk.draw(ctx, { x0: sx0, x1: sx1 });
  }
  function update(dt) {
    tid += dt;
    for (const L of layers) L.update(dt);
    // animationerna och partiklarna (Leka)
    for (const [key, a] of anims) { a.t += dt; if (a.t >= a.dur) anims.delete(key); }
    for (let k = fx.length - 1; k >= 0; k--) {
      const q = fx[k];
      q.t += dt;
      if (q.t < 0) continue;
      if (q.t >= q.dur) { fx.splice(k, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt;
      if (q.slag === 'not' || q.slag === 'bubbla') q.x += Math.sin(q.t * 6 + q.y) * 8 * dt;
      if (q.slag === 'lov') q.x += Math.sin(q.t * 5 + q.y) * 12 * dt;
    }
    // maten i en figurs händer äts upp på några sekunder – och smakar
    if (ater.size) for (const [id, t] of [...ater]) {
      const s = sakMed(id);
      if (!s || !s.hos) { ater.delete(id); continue; }
      if (t - dt > 0) { ater.set(id, t - dt); continue; }
      ater.delete(id);
      H.saker.splice(H.saker.indexOf(s), 1); spara();
      const d = dockaMed(s.hos.id);
      if (d) sag(d, pick(DOCK_MUMS), 2.5);
    }
    // någon av figurerna i bild säger något då och då
    pratT -= dt;
    if (pratT <= 0) {
      pratT = 7 + Math.random() * 6;
      const [sx0, sx1] = seen();
      const kand = H.dockor.filter((d) => { const sx = d.x + ox(d.room) - camX; return sx > sx0 + 10 && sx < sx1 - 10; });
      if (kand.length && !talk.active() && !drag) prata(pick(kand));
    }
    if (camTo != null && !pan) {
      camX += (camTo - camX) * Math.min(1, dt * 8);
      if (Math.abs(camTo - camX) < 0.3) { camX = camTo; camTo = null; }
    }
    if (flik === 'teman' && camTo == null && !pan && temaRum !== rumIVy()) fyllLada();   // (fliken följer rummet i bild)
    if (drag?.moved) {   // dra mot kanten → bilden rullar med
      const [x0, x1] = seen();
      if (drag.px < x0 + 24) camX = clampCam(camX - 170 * dt);
      else if (drag.px > x1 - 24) camX = clampCam(camX + 170 * dt);
      ghostTo(drag.px, drag.py);
    }
  }

  const scene = {
    dockskap: true,   // (main.js: spelklockan står still, ingen pixel-HUD)
    get viewMax() { return { w: W, h: FH }; },
    update, draw, down, move, up, key,
    enter() { gangList = null; document.body.classList.add('dock-on'); byggPanel(); byggLage(); sattLage(lage, true); },
    exit() {
      spara(true); talk.clear(); drag = null; armed = null; pan = null; anims.clear(); fx.length = 0;
      for (const L of layers) L.exit();
      document.body.classList.remove('dock-on', 'dock-leka', 'dock-bygga'); panel?.classList.add('hidden'); lageEl?.classList.add('hidden');
      window.dispatchEvent(new Event('resize'));
    },
  };
  // testerna (tools/dockskap-test.mjs)
  scene._debug = {
    W, rooms: () => RUM.map((r, i) => ({ id: r.id, name: r.name, ox: ox(i) })),
    deco: (i) => H.rooms[i].deco.map((d) => ({ ...d })),
    cam: () => camX, goRoom: (i) => { camX = camRoom(i); camTo = null; return camX; },
    natt: () => H.natt,
    // skärmläge för möbeln idx i rummet i (mitt på, strax ovanför fotlinjen)
    spot: (i, idx) => { const d = H.rooms[i].deco[idx]; if (!d) return null; const { w, h } = dimsAv(d.k, d.v, d.r | 0); const y = d.k === 'matta' ? d.y + h / 2 : arVagg(d.k) ? d.y - h / 2 : d.y - Math.min(6, h / 2); return { x: d.x + w / 2 + ox(i) - camX, y }; },
    place: (k, i, x, y) => laggTill(i, { k, v: 0, x, y }),
    remove: (i, idx) => taBort(i, idx),
    rotate: (i, idx) => { const d = H.rooms[i].deco[idx]; if (!d) return false; d.r = ((d.r | 0) + 1) % rotStates(d.k); klamma(d); spara(); rebuild(i); return true; },
    arm: (k) => { armed = { k, v: 0, r: 0 }; fyllLada(); },
    drag: () => (drag ? { typ: drag.typ || 'deco', id: drag.id, room: drag.room, idx: drag.idx, moved: drag.moved, groom: drag.groom, gx: drag.gx, gy: drag.gy, gup: drag.gup, fromTray: !!drag.fromTray, mal: drag.mal || null } : null),
    flik: (id) => { flik = id; byggPanel(); },
    // figurerna
    gang: () => gang().map((g) => ({ id: g.id, namn: g.namn })),
    dolls: () => H.dockor.map((d) => ({ ...d, ...(() => { const q = dockaPos(d); return { sitter: q.sitter, ry: q.y }; })() })),
    placeDoll: (id, room, x, y) => !!stallDocka(id, room, x, y),
    removeDoll: (id) => taBortDocka(id),
    spotDoll: (id) => { const d = dockaMed(id); if (!d) return null; const q = dockaPos(d); return { x: q.x + ox(d.room) - camX, y: q.y - 20 }; },
    prata: (id) => { const d = dockaMed(id); return d ? prata(d) : null; },
    talking: () => talk.active(),
    armDoll: (id) => { armed = { typ: 'docka', id }; fyllLada(); },
    // husdjuren
    pets: () => store.petsHome(DJUR_HEM).map((p) => ({ id: p.id, name: p.name, species: p.species, breed: p.breed, room: p.room, x: p.x, y: p.y })),
    petItems: () => store.items.filter((it) => it.home === DJUR_HEM).map((it) => ({ id: it.id, k: it.k, room: it.room, x: it.x, y: it.y })),
    placePet: (species, breed, room, x, y) => { const p = nyttDjur(species, breed, room, x, y); return p ? p.id : null; },
    placePetItem: (k, room, x, y) => { const it = nyPryl(k, room, x, y); return it ? it.id : null; },
    movePet: (id, room, x, y) => flyttaDjur(id, room, x, y),
    removePet: (id) => taBortDjur(id),
    spotPet: (id) => { const p = store.petById(id); if (!p) return null; const s = layers[p.room | 0]?._debug.spot(id); return s ? { x: s.x + ox(p.room | 0) - camX, y: s.y } : null; },
    spotPetItem: (id) => { const it = store.itemById(id); if (!it) return null; const s = layers[it.room | 0]?._debug.spot(id); return s ? { x: s.x + ox(it.room | 0) - camX, y: s.y } : null; },
    layer: (i) => layers[i]._debug,
    // lösa saker
    saker: () => H.saker.map((s) => ({ ...s, hos: s.hos ? { ...s.hos } : null })),
    placeSak: (slag, k, room, x, y) => { const pos = sakPlats({ slag, k }, room, x, y); const s = nySak(slag, k, room, pos.x, pos.y, pos.up, malUnder(room, x, y)); return s ? s.id : null; },
    moveSak: (id, room, x, y) => { const s = sakMed(id); if (!s) return false; const pos = sakPlats(s, room, x, y); stallSak(s, room, pos.x, pos.y, pos.up, malUnder(room, x, y)); return true; },
    giveSak: (id, typ, till) => { const s = sakMed(id); if (!s) return false; stallSak(s, s.room, s.x, s.y, 0, { typ, id: till }); return true; },
    heldBy: (dockId) => sakHos(dockId)?.id || null,
    eating: (id) => ater.get(id) ?? 0,
    removeSak: (id) => taBortSak(id),
    spotSak: (id) => { const s = sakMed(id); if (!s || s.hos) return null; const b = sakBox(s), fy = sakFot(s); return { x: s.x + ox(s.room) - camX, y: fy + (b.y0 + b.y1) / 2 }; },
    armSak: (slag, k) => { armed = { typ: 'sak', slag, k }; fyllLada(); },
    // teman
    tema: (i) => ({ ...(H.rooms[i].tema || {}) }),
    setTema: (i, key, id) => { sattTema(i, key, id); return { ...(H.rooms[i].tema || {}) }; },
    roomInView: () => rumIVy(),
    pixel: (i, x, y) => { const d = bgs[i](H.natt).getContext('2d').getImageData(x, y, 1, 1).data; return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); },
    // leka och bygga
    lage: () => lage,
    setLage: (l) => { sattLage(l, true); return lage; },
    reaktioner: () => reaktioner,
    senaste: () => (senaste ? { ...senaste } : null),
    anims: () => [...anims.keys()],
    fx: (room, slag) => fx.filter((q) => (room == null || q.room === room) && (!slag || q.slag === slag)).length,
    lit: (i, idx) => !!H.rooms[i].deco[idx]?.lit,
    findDeco: (i, k) => H.rooms[i].deco.findIndex((d) => d.k === k),
    // belysningen
    setLjus: (i, idx, id) => { const d = H.rooms[i].deco[idx]; if (!d) return null; if (id) d.ljus = id; else delete d.ljus; d.lit = true; spara(); rebuild(i); return ljusFarg(d).id; },
    disco: (i) => diskoIgang(i),
    ljusfarger: LJUSFARGER.map((f) => f.id),
    petsKey: DOCK_PETS_KEY,
    key: DOCK_KEY,
  };
  return scene;
}
