// Hemma – Pixelverkstans butiksstil i spelets gemensamma 384×216-rymd.
// Bostäderna har flera delrum (dörrar i bakväggen), och allt bohag är
// "deco"-poster { k, v, x, y, c?, r?, fx? } per delrum som ritas från möbelatlasen
// (köpta EmanuelleDev-sprites; c = egen färg, ritas med tintSprite; r = rotation
// 0–3, se viewOf i game.js; fx = startmöbel som inte kan säljas). Med
// Möblera-läget flyttar, roterar, placerar, målar om och säljer man möbler
// fritt – även startmöblerna, också via förrådet till ett annat delrum – och
// besökare ser din inredning (med färger och rotation) via världen.
//
// Funktionerna (sova, garderob, äta, toalett, tvätta, tv) sitter på möbelsorten
// och följer med möbeln vart den än står. Står ingen säng ute alls (alla ligger
// i förrådet) rullas en madrass ut på golvet så att man ändå kan sova.
//
// Väggsaker (KATALOG.wall) hänger på bakväggen: de fästs i väggens höjdled,
// är inga hinder för gången och ritas bakom allt som står på golvet. De får inte
// hänga över dörrar, varandra eller fönstren (utom gardiner: KATALOG.overWindow).
//
// Husdjuren (js/pets/layer.js) bor i det egna hemmet: lagret skapas per delrum med
// möblerna som gångbarhet, djuren och prylarna ritas sorterade bland möblerna, klick
// på djur/prylar/olyckor går till lagret före möbelklicken (inte i Möblera-läget –
// där flyttar man i stället husdjursprylarna som möbler, och knappen 🐾 Djurprylar
// i förrådspanelen öppnar lagrets förråd). Bär man en matsäck (A.carrying) ritas
// figuren med bär-bildrutorna. Kommer man hem från staden tas kopplet av
// (petStore().walkEnd()); byte av delrum räknas inte som att komma hem.
import { drawPerson } from '../core/people.js';
import { openAvatarEditor, avatarTagColors } from '../core/avatar.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { foodOf, katalogOf, functionOf, viewOf, rotStates, knownKind, fmt, MAX_STORAGE, MAX_PER_ROOM } from '../game.js';
import { play } from '../core/sound.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';
import { FRAMES } from '../data/frames.js';
import { tintSprite, spriteBaseColor, isHex } from '../core/recolor.js';
import { createPetLayer } from '../pets/layer.js';
import { petStore } from '../pets/sim.js';
import { itemBox } from '../pets/items.js';

const WALK_SEQ = [1, 3, 2, 3];
const CARRY_SEQ = [7, 9, 8, 9];     // bär-bildrutorna (matsäcken till skålen)
const FW = 384, FH = 216;
const WALL_Y = 86;
const WALL_TOP = 8;                 // väggsaker får inte hänga högre än så (ovanför är taklisten)
const DOOR = { x0: 28, x1: 62, cx: 45 };
const RUG = { w: 90, h: 48 };
const WIN_Y = [17, 49];             // fönstrens glas (över-/underkant); takvåningen har högre fönster
// sant mellan två delrum i samma bostad (dörren i bakväggen) – då är man inte "hemkommen"
let hopping = false;

export const ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (ATLAS) ATLAS.src = 'assets/interior.png';

// Bostädernas delrum: tema + fönster per rum. partition = hur bred lokalen är.
// shabby = Lilla rummet: sprickor, fuktfläckar, flagnande tapet, spindelväv, naken
// glödlampa och slitet golv (de finare bostäderna slipper). worn = 'husvagn' | 'hoghus':
// egen sjabbighet (rost och nitar / sliten tapet och radiator). view = vad man ser
// genom fönstren: 'sky' (standard), 'tomt', 'betong', 'tradgard', 'stad'. winY = glasets
// över-/underkant (takvåningen har högre fönster). Ordningen är billigast → dyrast.
const PLANS = {
  husvagn: {
    partition: 148, worn: 'husvagn',
    rooms: [{ name: 'HUSVAGNEN', wall: 0xd8ccb0, wallDk: 0x8c7c62, floorA: 0x9c8c70, floorB: 0x80705a, windows: [[84, 118]], view: 'tomt' }],
  },
  rum: {
    partition: 176, shabby: true,
    rooms: [{ name: 'RUMMET', wall: 0x8c7a62, wallDk: 0x6a5c48, floorA: 0xcbb894, floorB: 0xb09a74, windows: [[80, 120]] }],
  },
  hoghus: {
    partition: 244, worn: 'hoghus',
    rooms: [{ name: 'ETTAN', wall: 0xb4ac9c, wallDk: 0x787064, floorA: 0xb8a88a, floorB: 0x9e8e72, windows: [[72, 116], [150, 198]], view: 'betong' }],
  },
  lagenhet: {
    partition: 310,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0x6e88a0, wallDk: 0x4e6478, floorA: 0xd9cbaf, floorB: 0xc0ac88, windows: [[80, 120], [134, 174]] },
      { name: 'SOVRUM', wall: 0x8a7f9a, wallDk: 0x685e78, floorA: 0xd0c2b0, floorB: 0xb8a892, windows: [[100, 140]] },
    ],
  },
  radhus: {
    partition: 340,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xd8c8a4, wallDk: 0xa08c68, floorA: 0xdcc8a4, floorB: 0xc2ac86, windows: [[80, 130], [150, 200]], view: 'tradgard' },
      { name: 'SOVRUM', wall: 0xa4b6c6, wallDk: 0x788a9a, floorA: 0xd6c8b2, floorB: 0xbeb096, windows: [[110, 160]], view: 'tradgard' },
    ],
  },
  villa: {
    partition: 0, lyx: true,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xc4b190, wallDk: 0x9a8a6a, floorA: 0xefe6d2, floorB: 0xd9ccb2, windows: [[80, 120], [134, 172], [240, 280]] },
      { name: 'SOVRUM', wall: 0xb8a0a8, wallDk: 0x907880, floorA: 0xe8ded0, floorB: 0xd2c4b2, windows: [[110, 150], [210, 250]] },
      { name: 'KÖK', wall: 0xa8b8a0, wallDk: 0x808f78, floorA: 0xe2e6da, floorB: 0xc8cec0, windows: [[110, 150], [230, 270]] },
    ],
  },
  takvaning: {
    partition: 0, lyx: true, winY: [12, 56],
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xe6dcc8, wallDk: 0xb0a284, floorA: 0xf2eee6, floorB: 0xdcd6cc, windows: [[70, 280]], view: 'stad' },
      { name: 'SOVRUM', wall: 0x9c8cac, wallDk: 0x6e6082, floorA: 0xe8e0d4, floorB: 0xd2c8b8, windows: [[100, 150], [200, 250]], view: 'stad' },
      { name: 'KÖK', wall: 0xd2dad2, wallDk: 0x8a9a8c, floorA: 0xe8eae2, floorB: 0xcccec4, windows: [[100, 150], [230, 280]], view: 'stad' },
    ],
  },
};

// Startmöbleringen per bostad och delrum. fx = startmöbel (kan flyttas, inte säljas).
const SEEDS = {
  'husvagn:0': [ // brits, litet kylskåp och klädskåp – kokplattan sitter i väggen under fönstret
    { k: 'enkelsang', v: 2, x: 12, y: 150, fx: 1 }, { k: 'kylskap', v: 0, x: 66, y: 94, fx: 1 },
    { k: 'kladskap', v: 1, x: 118, y: 94, fx: 1 }, { k: 'pall', v: 0, x: 100, y: 192 }, { k: 'lillmatta', v: 3, x: 56, y: 200 },
  ],
  'rum:0': [
    { k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 106, y: 96, fx: 1 },
    { k: 'kylskap', v: 0, x: 150, y: 94, fx: 1 }, { k: 'dass', v: 0, x: 138, y: 174, fx: 1 },
  ],
  'hoghus:0': [ // ett rum och kök: pentryt sitter under det högra fönstret, radiatorn under det vänstra
    { k: 'enkelsang', v: 4, x: 14, y: 140, fx: 1 }, { k: 'kylskap', v: 0, x: 122, y: 94, fx: 1 },
    { k: 'garderob', v: 3, x: 204, y: 96, fx: 1 },
    { k: 'koksbord', v: 0, x: 150, y: 175 }, { k: 'matstol', v: 0, x: 134, y: 173 }, { k: 'matstol', v: 0, x: 178, y: 173 },
    { k: 'lillmatta', v: 6, x: 40, y: 200 },
  ],
  'lagenhet:0': [
    { k: 'kylskap', v: 0, x: 214, y: 94, fx: 1 },
    { k: 'soffa', v: 4, x: 106, y: 179 }, { k: 'bordR', v: 0, x: 150, y: 196 }, { k: 'vaxt', v: 0, x: 270, y: 206 },
  ],
  'lagenhet:1': [
    { k: 'sang', v: 2, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 196, y: 96, fx: 1 },
    { k: 'byra', v: 1, x: 120, y: 96 },
  ],
  'villa:0': [
    { k: 'soffa', v: 0, x: 112, y: 182 }, { k: 'fatolj', v: 3, x: 164, y: 166 }, { k: 'bordR', v: 0, x: 150, y: 200 },
    { k: 'tv', v: 0, x: 176, y: 151 }, { k: 'bokhylla', v: 0, x: 180, y: 96 }, { k: 'spis', v: 1, x: 336, y: 131 },
    { k: 'lampa', v: 0, x: 320, y: 151 }, { k: 'vaxt', v: 0, x: 48, y: 151 }, { k: 'matta', v: 0, x: 100, y: 156 },
  ],
  'villa:1': [
    { k: 'sang', v: 1, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 250, y: 96, fx: 1 },
    { k: 'byra', v: 3, x: 160, y: 96 }, { k: 'spegel', v: 0, x: 220, y: 94 }, { k: 'matta', v: 1, x: 80, y: 150 },
  ],
  'villa:2': [ // (kylskåpet står till vänster om SOVRUM-dörren, som börjar vid x=290)
    { k: 'kylskap', v: 0, x: 270, y: 94, fx: 1 },
    { k: 'bordM', v: 0, x: 130, y: 160 }, { k: 'matstol', v: 0, x: 114, y: 158 }, { k: 'matstol', v: 0, x: 186, y: 158 },
    { k: 'byra', v: 0, x: 60, y: 96 }, { k: 'vaxtS', v: 0, x: 340, y: 140 },
  ],
  'radhus:0': [ // vardagsrum med trädgårdsfönster (SOVRUM-dörren börjar vid x=292)
    { k: 'kylskap', v: 0, x: 250, y: 94, fx: 1 },
    { k: 'soffa', v: 1, x: 96, y: 180 }, { k: 'soffbord', v: 0, x: 100, y: 202 }, { k: 'fatolj', v: 1, x: 150, y: 185 },
    { k: 'tv', v: 2, x: 150, y: 150 }, { k: 'bokhylla', v: 1, x: 200, y: 96 }, { k: 'golvlampa', v: 0, x: 66, y: 150 },
    { k: 'stormatta', v: 1, x: 80, y: 205 }, { k: 'vaxt', v: 0, x: 300, y: 205 },
  ],
  'radhus:1': [
    { k: 'sang', v: 5, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 2, x: 200, y: 96, fx: 1 },
    { k: 'nattduksbord', v: 1, x: 84, y: 120 }, { k: 'byra', v: 2, x: 120, y: 96 }, { k: 'rundspegel', v: 0, x: 180, y: 44 },
    { k: 'lillmatta', v: 4, x: 40, y: 200 },
  ],
  'takvaning:0': [ // panoramafönstret upptar bakväggen 70–280; dörrarna till SOVRUM (336) och KÖK (292)
    { k: 'kuddsoffa', v: 0, x: 110, y: 186 }, { k: 'soffbord', v: 2, x: 114, y: 205 }, { k: 'fatolj', v: 4, x: 150, y: 172 },
    { k: 'golvlampa', v: 1, x: 176, y: 172 }, { k: 'piano', v: 1, x: 300, y: 150 }, { k: 'hoghylla', v: 1, x: 200, y: 96 },
    { k: 'tv', v: 2, x: 40, y: 150 }, { k: 'stormatta', v: 2, x: 100, y: 210 }, { k: 'vaxt', v: 0, x: 250, y: 206 },
    { k: 'fredslilja', v: 0, x: 350, y: 205 },
  ],
  'takvaning:1': [
    { k: 'sang', v: 9, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 8, x: 250, y: 96, fx: 1 },
    { k: 'nattduksbord', v: 3, x: 84, y: 120 }, { k: 'byra', v: 1, x: 160, y: 96 }, { k: 'rundspegel', v: 2, x: 170, y: 44 },
    { k: 'golvlampa', v: 2, x: 100, y: 150 }, { k: 'lillmatta', v: 8, x: 40, y: 200 },
  ],
  'takvaning:2': [ // (kylskåpet står till vänster om SOVRUM-dörren, som börjar vid x=292)
    { k: 'kylskap', v: 0, x: 270, y: 94, fx: 1 },
    { k: 'kokso', v: 1, x: 110, y: 160 }, { k: 'bordM', v: 2, x: 190, y: 165 }, { k: 'matstol', v: 1, x: 176, y: 163 }, { k: 'matstol', v: 1, x: 244, y: 163 },
    { k: 'diskbank', v: 0, x: 170, y: 96 }, { k: 'bankskap', v: 3, x: 110, y: 96 }, { k: 'overskap', v: 1, x: 166, y: 44 },
    { k: 'vaxtS', v: 0, x: 340, y: 140 }, { k: 'soptunna', v: 0, x: 60, y: 200 },
  ],
};
// Startmöbleringen måste stå rätt från början (annars flyttas den vid första besöket
// med en toast) – tools/room-check.mjs kontrollerar varje delrum mot fits().
const seedFor = (home, sub) => (SEEDS[`${home}:${sub}`] || []).map((d) => ({ ...d }));

// Möbler som är "djupa" (sängar, soffor, bord): hindret är halva höjden. Övriga
// (skåp, hyllor, lampor) står upp – bara foten är hinder.
const SOLID_LOW = new Set(['soffa', 'fatolj', 'stol', 'bordR', 'bordM', 'byra', 'sang', 'enkelsang', 'kuddsoffa', 'matstol', 'pelarbord',
  'sidobord', 'koksbord', 'soffbord', 'glasbord', 'skrivbord', 'arbetsbank', 'barnbord', 'skolbank', 'hallbank', 'sittbank', 'skobank',
  'kokso', 'diskbank', 'bankskap', 'badkar', 'dusch', 'djurbadd', 'golvkudde', 'molnkudde', 'stjarnkudde', 'badbank', 'strykbrada',
  'lagbyra', 'tvbank', 'nattduksbord', 'kista', 'leksakslada', 'backar', 'kontorsstol', 'skolstol', 'barnstol', 'pall', 'dass']);
const solidH = (k, fh) => (SOLID_LOW.has(k) ? Math.round(fh * 0.5) : Math.min(13, Math.round(fh * 0.4)));
const frameOf = (k, v) => FRAMES[k + (v | 0)] || FRAMES[k + '0'];
const frameName = (k, v) => (FRAMES[k + (v | 0)] ? k + (v | 0) : k + '0');
const isWall = (k) => !!katalogOf(k)?.wall;
// mattor ur arken: ligger platt på golvet, går att gå på, ritas under allt
const isFlat = (k) => k !== 'matta' && /matta$/.test(k);
// vad skylten över en funktionsmöbel säger
const FN_LABEL = { sova: 'SÄNG', garderob: 'GARDEROB', ata: 'KYLSKÅP', toalett: 'TOALETT', tvatta: 'TVÄTTA', tv: 'TV' };
const KIND_LABEL = { koksspis: 'SPIS', mikro: 'MIKRO', dusch: 'DUSCH', badkar: 'BADKAR', tvattmaskin: 'TVÄTT', tvattpelare: 'TVÄTT',
  handfat: 'HANDFAT', tvattstall: 'HANDFAT', dator: 'DATOR', laptop: 'DATOR', spelkonsol: 'KONSOL', dass: 'DASSET', kladskap: 'KLÄDSKÅP', linneskap: 'LINNESKÅP' };
const labelOf = (k) => { const fn = functionOf(k); return fn ? KIND_LABEL[k] || FN_LABEL[fn] : null; };
// namn på startmöbler som inte finns i katalogen (till förrådspanelen)
const FX_NAMES = { kylskap: 'Kylskåp', dass: 'Dasset', vaxt: 'Monstera' };
export const nameOf = (k) => katalogOf(k)?.name || FX_NAMES[k] || k;

// ---------- möbelbilder (atlas, omfärgade eller mattor) ----------
// Tips till omfärgningen där huvudmaterialet inte är det största: krukväxten
// ska få ny kruka (inte nya blad), silverspegeln ny ram (inte nytt glas),
// golvlampan ny skärm (foten blir en mörkare ton av samma färg).
const TINT_HINT = { vaxtS0: { hue: 24 }, spegel2: { maxL: 0.5 }, lampa0: { minL: 0.8 }, dass0: { minL: 0.6 } };
export const canRecolor = (k) => k !== 'vaxt'; // monsteran är ritad för hand, inte ur atlasen
// Möbeln k/v i färgen c (null = original): { img, sx, sy, sw, sh } att rita
// i heltalsskala, eller null om atlasen inte har laddats än.
export function furnArt(k, v, c = null) {
  if (k === 'matta') return { img: rugImg(v, c), sx: 0, sy: 0, sw: RUG.w, sh: RUG.h };
  const f = frameOf(k, v);
  if (!f || !ATLAS?.complete) return null;
  const t = isHex(c) ? tintSprite(ATLAS, f, c, TINT_HINT[frameName(k, v)]) : null;
  return t ? { img: t, sx: 0, sy: 0, sw: f[2], sh: f[3] } : { img: ATLAS, sx: f[0], sy: f[1], sw: f[2], sh: f[3] };
}
// Samma sak i rotationsläge r: rätt vy ur atlasen (soffan från sidan …) och om
// den ska speglas – rita med drawArt.
export function furnView(k, v, c = null, r = 0) {
  const vw = viewOf(k, v, r);
  const a = furnArt(vw.k, vw.v, c);
  return a ? { ...a, flip: vw.flip } : null;
}
// Ritar en möbelbild med övre vänstra hörnet i (x, y), speglad pixelexakt om
// flip (heltalskoordinater + scale(-1,1) = samma pixelkorn, ingen kantutjämning).
export function drawArt(ctx, a, x, y) {
  if (!a.flip) { ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, x, y, a.sw, a.sh); return; }
  ctx.save();
  ctx.translate(x + a.sw, y);
  ctx.scale(-1, 1);
  ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, 0, 0, a.sw, a.sh);
  ctx.restore();
}
// möbelns originalkulör (till "Original"-rutan i färgvalet)
export function furnBaseColor(k, v) {
  if (k === 'matta') return (v | 0) === 1 ? '#3f5667' : '#5e1622';
  const f = frameOf(k, v);
  return f && ATLAS?.complete ? spriteBaseColor(ATLAS, f, TINT_HINT[frameName(k, v)]) : null;
}
// möbelns mått i rotationsläge r
function dimsOf(k, v, r) {
  if (k === 'matta') return { w: RUG.w, h: RUG.h };
  if (k === 'vaxt') return { w: 20, h: 52 };
  const vw = viewOf(k, v, r);
  const f = frameOf(vw.k, vw.v);
  return f ? { w: f[2], h: f[3] } : { w: 16, h: 16 };
}
// Fotavtrycket för en möbel med vänsterkant x och fotlinje y (mattan: överkant y):
// { t: 'wall' | 'flat' | 'solid', r: [x0, y0, x1, y1], w, h }
function footOf(k, v, r, x, y) {
  const { w, h } = dimsOf(k, v, r);
  if (isWall(k)) return { t: 'wall', r: [x, y - h, x + w, y], w, h };
  if (k === 'matta') return { t: 'flat', r: [x, y, x + w, y + h], w, h };
  if (isFlat(k)) return { t: 'flat', r: [x, y - h, x + w, y], w, h };
  const sh = k === 'vaxt' ? 12 : solidH(k, h);
  return { t: 'solid', r: [x - 1, y - sh, x + w + 1, y + 1], w, h };
}
const overlaps = (a, b) => a[2] > b[0] && a[0] < b[2] && a[3] > b[1] && a[1] < b[3];

export function makeRoom(A, { visit = false } = {}) {
  const hopped = hopping; // kom vi genom en dörr i bakväggen (inte hem från staden)?
  hopping = false;
  const g = A.game;
  const home = visit ? A.visitTarget?.home || 'rum' : g.home;
  const plan = PLANS[home] || PLANS.rum;
  const sub = Math.max(0, Math.min(plan.rooms.length - 1, A.roomSub | 0));
  A.roomSub = sub;
  const roomDef = plan.rooms[sub];
  const RIGHT = plan.partition || FW;
  const decoKey = `${home}:${sub}`;

  // deco-listan: min egen (seedas vid behov) eller värdens (read-only)
  function decoList() {
    if (visit) return A.visitTarget?.deco?.[decoKey] || seedFor(home, sub);
    if (!g.deco[decoKey]) { g.deco[decoKey] = seedFor(home, sub); g.save(); }
    return g.deco[decoKey];
  }

  // husdjurslagret (skapas längre ner, bara i det egna hemmet) och dess prylars hinder
  let L = null, petObstacles = [], petHover = null;
  // alla husdjursprylar i delrummet (även skålar och säckar) – möbler får inte ställas på dem
  const petRects = () => (L ? petStore().itemsIn(home, sub).map((it) => { const b = itemBox(it.k); return [it.x + b.x0 - 1, it.y + b.y0 - 1, it.x + b.x1 + 1, it.y + b.y1 + 1]; }) : []);
  // står en husdjurspryl bakom (högre upp än fotlinjen y) det möbeln med vänsterkant x ritar?
  const petBehind = (x, y, w, h) => !!L && petStore().itemsIn(home, sub).some((it) => {
    const b = itemBox(it.k);
    return it.y < y && overlaps([x, y - h, x + w, y], [it.x + b.x0, it.y + b.y0, it.x + b.x1, it.y + b.y1]);
  });
  // lagret håller i en pryl (spöke på golvet) → nästa klick ställer den
  const petPlacing = () => !!L?.placing;

  // ---------- delrumsdörrar + bakgrund ----------
  const subDoors = plan.rooms.map((r, i) => i).filter((i) => i !== sub)
    .map((i, n) => ({ to: i, name: plan.rooms[i].name, x0: RIGHT - 48 - n * 44, x1: RIGHT - 18 - n * 44 }));
  const doorRects = [...(sub === 0 ? [[DOOR.x0 - 2, 26, DOOR.x1 + 2, WALL_Y]] : []), ...subDoors.map((sd) => [sd.x0 - 2, 26, sd.x1 + 2, WALL_Y])];
  // fönstren som faktiskt ritas (samma urval som i buildBg), med karm: väggsaker får inte hänga där
  const winY = plan.winY || WIN_Y;
  const winDrawn = roomDef.windows.filter(([wx0, wx1]) => !(wx1 > RIGHT - 5 || subDoors.some((sd) => wx1 > sd.x0 - 4 && wx0 < sd.x1 + 4)));
  const windowRects = winDrawn.map(([wx0, wx1]) => [wx0 - 2, winY[0] - 2, wx1 + 2, winY[1] + 2]);
  const bg = buildBg(roomDef, RIGHT, subDoors, sub === 0, plan, visit);

  // ---------- var får möbler stå? ----------
  // De andra möblernas fotavtryck (räknas en gång per sökning – fitRoom prövar tusentals lägen)
  const feetOf = (list, skip) => list.map((o, i) => (i === skip ? null : { wall: isWall(o.k), flat: o.k === 'matta' || isFlat(o.k), r: footOf(o.k, o.v, o.r, o.x, o.y).r }));
  // x/y som i deco-posten (vänsterkant + fotlinje; mattan överkant). skip = index i listan att bortse från.
  function fits(k, v, r, x, y, list, skip = -1, feet = feetOf(list, skip)) {
    const ft = footOf(k, v, r, x, y);
    const [x0, y0, x1, y1] = ft.r;
    if (ft.t === 'wall') {
      if (x0 < 5 || x1 > RIGHT - 5 || y0 < WALL_TOP || y1 > WALL_Y - 3) return false;
      for (const dr of doorRects) if (overlaps(ft.r, dr)) return false;
      if (!katalogOf(k)?.overWindow) for (const wr of windowRects) if (overlaps(ft.r, wr)) return false;
      return !feet.some((o) => o && o.wall && overlaps(ft.r, o.r));
    }
    if (ft.t === 'flat') return x0 >= 6 && x1 <= RIGHT - 4 && y0 >= WALL_Y + 2 && y1 <= FH - 3;
    if (x < 8 || x + ft.w > RIGHT - 5 || y < WALL_Y + 6 || y > FH - 4) return false;
    for (const dr of doorRects) if (x1 > dr[0] && x0 < dr[2] && y1 > WALL_Y && y0 < WALL_Y + 15) return false; // fritt framför dörrarna
    if (petRects().some((r) => overlaps(ft.r, r))) return false; // inte ovanpå husdjurens skålar, korgar och lådor
    if (petBehind(x, y, ft.w, ft.h)) return false; // och inte så att möbeln skymmer en pryl bakom sig
    return !feet.some((o) => o && !o.wall && !o.flat && overlaps(ft.r, o.r));
  }
  // Närmaste lediga plats för möbeln d: ett rutnät om 4 px förankrat där den står (plus
  // kanterna), sorterat på avståndet – lodrätt räknas tredubbelt så att den helst stannar
  // på sin rad (höga skåp vid bakväggen blir kvar vid väggen, en väggsak som hänger 1 px
  // för lågt knuffas bara upp). Väggsaker undviker lägen bakom höga golvmöbler.
  function nearestSpot(d, list, skip) {
    const { w, h } = dimsOf(d.k, d.v, d.r);
    const wall = isWall(d.k);
    const axis = (from, lo, hi, step) => {
      const s = new Set([lo, hi]);
      for (let v = from; v >= lo; v -= step) if (v <= hi) s.add(v);
      for (let v = from + step; v <= hi; v += step) if (v >= lo) s.add(v);
      return [...s].filter((v) => v >= lo && v <= hi);
    };
    const xs = axis(d.x, wall ? 5 : 8, RIGHT - 5 - w, 4);
    const ys = wall ? axis(d.y, WALL_TOP + h, WALL_Y - 3, 4)
      : d.k === 'matta' ? axis(d.y, WALL_Y + 2, FH - 3 - h, 4)
        : isFlat(d.k) ? axis(d.y, WALL_Y + 2 + h, FH - 3, 4) : axis(d.y, WALL_Y + 6, FH - 4, 4);
    const feet = feetOf(list, skip);
    // de ritade rektanglarna för golvmöblerna: en väggsak ska helst inte hamna bakom dem,
    // och en golvmöbel ska helst inte skymma (eller skymmas av) en annan
    const drawn = list.filter((o, j) => j !== skip && !isWall(o.k) && o.k !== 'matta' && !isFlat(o.k))
      .map((o) => { const dm = dimsOf(o.k, o.v, o.r); return [o.x, o.y - dm.h, o.x + dm.w, o.y]; });
    const flat = d.k === 'matta' || isFlat(d.k);
    const cands = [];
    for (const y of ys) for (const x of xs) {
      let cost = Math.abs(x - d.x) + Math.abs(y - d.y) * 3;
      if (!flat && drawn.some((r) => overlaps([x, y - h, x + w, y], r))) cost += wall ? 300 : 150;
      cands.push({ x, y, cost });
    }
    cands.sort((a, b) => a.cost - b.cost);
    for (const c of cands) if (fits(d.k, d.v, d.r, c.x, c.y, list, skip, feet)) return c;
    return null;
  }
  // deco-position ur pekarläget (mitten under pekaren; väggsaker fästs i väggens höjdled)
  function posFor(k, v, r, mx, my) {
    const { w, h } = dimsOf(k, v, r);
    const x = Math.round(mx - w / 2);
    if (isWall(k)) return { x, y: Math.max(WALL_TOP + h, Math.min(WALL_Y - 3, Math.round(my))) };
    if (k === 'matta') return { x, y: Math.round(my - h / 2) };
    return { x, y: Math.round(my) };
  }

  // finns en möbel med funktionen fn utställd i något av bostadens delrum? (delrum man
  // inte varit i än räknas med sin startmöblering)
  const homeHasFunction = (fn) => plan.rooms.some((r, i) => (g.deco[`${home}:${i}`] || seedFor(home, i)).some((d) => functionOf(d.k) === fn));

  // ---------- äldre sparfiler: se till att allt får plats i (den mindre) lokalen ----------
  // Lilla rummet krympte och fick ett dass, och väggsaker får inte längre hänga över
  // fönstren: det som står fel knuffas till närmaste lediga plats, annars till förrådet.
  // Är förrådet fullt får möbeln stå kvar (inne i lokalen, så att den går att plocka
  // upp) – inget försvinner någonsin, spelaren flyttar den själv med Möblera.
  function fitRoom() {
    if (visit) return;
    const list = decoList();
    let changed = false, nudged = 0, stored = 0;
    const stuck = [];
    if (home === 'rum' && sub === 0 && list.length < MAX_PER_ROOM && !list.some((d) => functionOf(d.k) === 'toalett') && !g.storage.some((it) => it.k === 'dass')) {
      list.push({ k: 'dass', v: 0, x: 138, y: 174, fx: 1 });
      changed = true;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (!knownKind(d.k) || fits(d.k, d.v, d.r, d.x, d.y, list, i)) continue;
      changed = true;
      const spot = nearestSpot(d, list, i);
      if (spot) { d.x = spot.x; d.y = spot.y; if (!d.fx) nudged++; continue; } // startmöbler knuffas tyst
      if (g.storage.length < MAX_STORAGE) {
        list.splice(i, 1);
        g.storage.push({ k: d.k, v: d.v, ...(d.c ? { c: d.c } : {}), ...(d.fx ? { fx: 1 } : {}), ...(d.r ? { r: d.r } : {}) });
        stored++;
      } else {
        const { w, h } = dimsOf(d.k, d.v, d.r);
        d.x = Math.max(isWall(d.k) ? 5 : 8, Math.min(RIGHT - 5 - w, d.x));
        d.y = isWall(d.k) ? Math.max(WALL_TOP + h, Math.min(WALL_Y - 3, d.y))
          : d.k === 'matta' ? Math.max(WALL_Y + 2, Math.min(FH - 3 - h, d.y))
            : isFlat(d.k) ? Math.max(WALL_Y + 2 + h, Math.min(FH - 3, d.y)) : Math.max(WALL_Y + 6, Math.min(FH - 4, d.y));
        stuck.push(nameOf(d.k));
      }
    }
    if (changed) g.save();
    if (stored) toast(`📦 ${home === 'rum' ? 'Rummet är mindre nu – ' : ''}${stored === 1 ? 'en möbel fick' : `${stored} möbler fick`} inte plats och ligger i förrådet.`);
    else if (nudged) toast(`🛋️ ${nudged === 1 ? 'En möbel knuffades' : `${nudged} möbler knuffades`} till en ledig plats.`);
    if (stuck.length) toast(`⚠️ Förrådet är fullt – ${stuck.slice(0, 2).join(', ')}${stuck.length > 2 ? ' m.fl.' : ''} står i vägen. Flytta med 🛋️ Möblera!`, 'bad');
  }
  fitRoom();

  // ---------- vad man gör vid funktionsmöblerna ----------
  function actFor(fn, kind) {
    if (visit || !fn) return null;
    switch (fn) {
      case 'sova': return () => A.sleepFlow();
      case 'garderob': return () => { play('click'); openAvatarEditor({ onDone: (av) => { A.avatar = av; toast('👕 Snyggt!', 'good'); } }); };
      case 'ata': return () => openFridge(A);
      case 'toalett': return () => useToilet(A, kind);
      case 'tvatta': return () => wash(A, kind);
      case 'tv': return () => watchTv(A, kind);
    }
    return null;
  }
  const exitAct = visit
    ? () => { A.visitTarget = null; A.roomSub = 0; g.passTime(20); g.save(); play('door'); toast('🚗 Hemma igen.'); A.go('city'); }
    : () => { A.roomSub = 0; play('door'); A.go('city'); };

  // ---------- props byggs ur deco (görs om efter varje ändring) ----------
  // freeGrid = gångbart för spelaren (möbler + husdjurens korgar/lådor), furnGrid = djurens
  // gångbarhet: möblerna och det de skymmer, men inte husdjursprylarna (djuren ska kunna
  // kliva in i sina korgar – lagret sköter prylarna självt)
  let props = [], rugs = [], wallItems = [], obstacles = [], hotRects = [], freeGrid, furnGrid;
  const CELL = 4, GW = Math.ceil(FW / CELL), GH = Math.ceil(FH / CELL);

  function rebuild() {
    props = []; rugs = []; wallItems = [];
    const list = decoList();
    list.forEach((d, i) => {
      if (decor.carry && decor.carry.src === 'deco' && decor.carry.idx === i) return; // lyftad just nu
      if (d.k === 'matta') { rugs.push({ decoIdx: i, x: d.x, y: d.y, w: RUG.w, h: RUG.h, img: rugImg(d.v, d.c), draw: (ctx) => ctx.drawImage(rugImg(d.v, d.c), d.x, d.y) }); return; }
      if (d.k === 'vaxt') { props.push({ ...makePlantProp(d.x + 10, d.y), k: 'vaxt', decoIdx: i, fx: d.fx }); return; }
      if (isWall(d.k)) { const w = wallProp(d, i); if (w) wallItems.push(w); return; }
      if (isFlat(d.k)) { const f = flatProp(d, i); if (f) rugs.push(f); return; }
      const p = spriteProp(d, i, !visit);
      if (p) props.push(p);
    });
    // ingen säng utställd någonstans hemma? då får madrassen på golvet duga
    if (!visit && !homeHasFunction('sova') && !(decor.carry && functionOf(decor.carry.k) === 'sova')) {
      const m = makeMattressProp(list, RIGHT);
      if (m) { m.act = () => floorSleep(A); props.push(m); }
    }
    const furn = props.map((p) => p.solid).filter(Boolean);
    // det möblerna skymmer (från ovankant till fotlinjen): där går inga djur och där ställs
    // inga husdjursprylar – annars hamnar kattkorgen bakom sänggaveln
    const drawn = props.filter((p) => p.solid).map((p) => [p.solid[0], p.top ?? p.solid[1], p.solid[2], p.solid[3]]);
    obstacles = [...furn, ...petObstacles];
    freeGrid = new Uint8Array(GW * GH); furnGrid = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL + 2, y = gy * CELL + 2;
      let ok = x > 7 && x < RIGHT - 5 && y > WALL_Y + 4 && y < FH - 4;
      if (ok) for (const [x0, y0, x1, y1] of furn) if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) { ok = false; break; }
      let pet = ok;
      if (pet) for (const [x0, y0, x1, y1] of drawn) if (x > x0 - 1 && x < x1 + 1 && y > y0 && y < y1 + 2) { pet = false; break; }
      furnGrid[gy * GW + gx] = pet ? 1 : 0;
      if (ok) for (const [x0, y0, x1, y1] of petObstacles) if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) { ok = false; break; }
      freeGrid[gy * GW + gx] = ok ? 1 : 0;
    }
    hotRects = [];
    if (sub === 0) hotRects.push({ id: 'dorr', act: exitAct, r: [DOOR.x0, 30, DOOR.x1, WALL_Y + 9], go: [DOOR.cx, WALL_Y + 12] });
    for (const sd of subDoors) hotRects.push({ id: 'sub' + sd.to, act: () => { hopping = true; A.roomSub = sd.to; play('door'); A.go(A.sceneName); }, r: [sd.x0, 34, sd.x1, WALL_Y + 6], go: [(sd.x0 + sd.x1) / 2, WALL_Y + 12] });
    for (const p of props) {
      if (!p.solid) continue;
      const act = p.act || actFor(p.fn, p.k);
      if (!act) continue;
      hotRects.push({ id: p.k, act, r: [p.solid[0], p.top, p.solid[2], p.solid[3] + 2], go: [(p.solid[0] + p.solid[2]) / 2, p.solid[3] + 5] });
    }
    for (const w of wallItems) { // t.ex. tvättstället: gå fram till väggen under det
      const act = actFor(w.fn, w.k);
      if (!act) continue;
      hotRects.push({ id: w.k, act, r: [w.x, w.top, w.x + w.w, w.top + w.h], go: [w.x + w.w / 2, WALL_Y + 12] });
    }
    L?.invalidate(); // möblerna kan ha flyttats: djurens vägnät byggs om
  }

  const cellAt = (x, y) => Math.max(0, Math.min(GH - 1, (y / CELL) | 0)) * GW + Math.max(0, Math.min(GW - 1, (x / CELL) | 0));
  const walkable = (x, y) => !!freeGrid[cellAt(x, y)];
  const furnFree = (x, y) => !!furnGrid[cellAt(x, y)];
  function nearestFree(x, y) {
    if (walkable(x, y)) return [x, y];
    for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx * CELL, ny = y + dy * CELL;
      if (nx > 0 && ny > 0 && nx < FW && ny < FH && walkable(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }
  const los = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let i = 1; i < n; i++) if (!walkable(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  };
  function findPath(sx, sy, tx, ty) {
    [tx, ty] = nearestFree(tx, ty);
    if (los(sx, sy, tx, ty)) return [[tx, ty]];
    const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, (x / CELL) | 0)), Math.max(0, Math.min(GH - 1, (y / CELL) | 0))];
    const [s0, s1] = cellOf(...nearestFree(sx, sy)), [t0, t1] = cellOf(tx, ty);
    const from = new Map([[s1 * GW + s0, -1]]);
    const q = [s1 * GW + s0];
    const goal = t1 * GW + t0;
    while (q.length) {
      const cur = q.shift();
      if (cur === goal) break;
      const cx = cur % GW, cy = (cur / GW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (!freeGrid[ni] || from.has(ni)) continue;
        if (dx && dy && (!freeGrid[cy * GW + nx] || !freeGrid[ny * GW + cx])) continue;
        from.set(ni, cur);
        q.push(ni);
      }
    }
    if (!from.has(goal)) return [[tx, ty]].filter(() => los(sx, sy, tx, ty));
    const cells = [];
    for (let i = goal; i !== -1; i = from.get(i)) cells.push([(i % GW) * CELL + 2, ((i / GW) | 0) * CELL + 2]);
    cells.reverse();
    cells[cells.length - 1] = [tx, ty];
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !los(ax, ay, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]); [ax, ay] = cells[j]; i = j + 1;
    }
    return out;
  }

  // ---------- möblera-läget ----------
  // carry = möbeln man håller i: { src: 'deco'|'storage', idx, k, v, c, r, r0 (rotationen den hade), fx }
  const decor = { on: false, carry: null, mx: 100, my: 150 };
  const carrySkip = () => (decor.carry?.src === 'deco' ? decor.carry.idx : -1);
  function canPlaceCarry(mx, my) {
    const c = decor.carry;
    const { x, y } = posFor(c.k, c.v, c.r, mx, my);
    return fits(c.k, c.v, c.r, x, y, decoList(), carrySkip());
  }
  function commitPlace() {
    const c = decor.carry;
    const pos = posFor(c.k, c.v, c.r, decor.mx, decor.my);
    if (c.src === 'storage') {
      if (!g.placeFromStorage(c.idx, sub, pos.x, pos.y)) { play('fel'); toast('Rummet är fullt!', 'bad'); return; }
      const list = decoList();
      if (c.r) g.rotateDeco(sub, list.length - 1, c.r);
    } else {
      g.moveDeco(sub, c.idx, pos.x, pos.y);
      g.rotateDeco(sub, c.idx, c.r);
    }
    decor.carry = null;
    rebuild(); renderStoragePanel();
  }
  // 🔄 rotera möbeln man håller i (även tangenten R)
  function rotateCarry() {
    const c = decor.carry;
    if (!c || c.k === 'vaxt') return; // monsteran är ritad för hand och har bara en vy (knappen är också avstängd)
    c.r = (c.r + 1) % rotStates(c.k);
    if (c.src === 'storage') g.rotateStorage(c.idx, c.r);
    play('click');
    updateSellBtn();
  }
  // 📦 lägg möbeln man håller i i förrådet (så kan den ställas ut i ett annat delrum)
  function storeCarry() {
    const c = decor.carry;
    if (!c) return;
    if (c.src === 'deco') {
      if (!g.decoToStorage(sub, c.idx)) { play('fel'); toast('Förrådet är fullt!', 'bad'); return; }
      toast(`📦 ${nameOf(c.k)} ligger i förrådet.`);
    }
    play('ok');
    decor.carry = null;
    rebuild(); renderStoragePanel();
  }
  // lägg ner det man håller i utan att flytta det (rotationen återställs)
  function dropCarry() {
    const c = decor.carry;
    if (!c) return;
    if (c.src === 'deco' && c.r !== c.r0) g.rotateDeco(sub, c.idx, c.r0);
    if (c.src === 'storage' && c.r !== c.r0) g.rotateStorage(c.idx, c.r0);
    decor.carry = null;
    rebuild();
  }
  function toggleDecor(force) {
    if (visit) return;
    const was = decor.on;
    decor.on = force !== undefined ? !!force : !decor.on;
    if (!decor.on && decor.carry) dropCarry(); // lyft möbel läggs tillbaka (låg kvar i listan)
    document.querySelector('#decor-panel')?.classList.toggle('hidden', !decor.on);
    // förrådspanelen tar plats till höger: body.decor-on ger #app en marginal och canvasen
    // räknas om (fit i main.js) så att panelen aldrig döljer rummets högerkant
    if (decor.on !== was) { document.body.classList.toggle('decor-on', decor.on); window.dispatchEvent(new Event('resize')); }
    if (decor.on) { renderStoragePanel(); syncPetBtn(); toast('🛋️ Möblera: klicka på en möbel för att flytta, R eller 🔄 vrider den, eller välj ur förrådet.'); }
    else { if (L?.placing) L.key('Escape'); g.save(); } // en pryl i handen läggs tillbaka
  }
  function renderStoragePanel() {
    const box = document.querySelector('#decor-storage');
    if (!box) return;
    box.innerHTML = g.storage.length
      ? g.storage.map((it, i) => {
        const kat = katalogOf(it.k);
        const hint = kat?.wall ? 'väggsak' : it.fx ? 'startmöbel' : functionOf(it.k) ? FN_LABEL[functionOf(it.k)].toLowerCase() : '';
        return `<button class="dp-item" data-st="${i}"><span data-thumb="${i}"></span><span>${nameOf(it.k)}${hint ? `<small>${hint}</small>` : ''}</span></button>`;
      }).join('')
      : '<div class="dp-empty">Tomt – köp möbler på MÖBELJÄTTEN, eller lägg något här med 📦.</div>';
    box.querySelectorAll('[data-thumb]').forEach((el) => { const it = g.storage[+el.dataset.thumb]; el.replaceWith(thumbCanvas(it.k, it.v, it.c)); });
    box.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => {
      const it = g.storage[+b.dataset.st];
      if (!it) return;
      if (decor.carry) dropCarry();
      decor.carry = { src: 'storage', idx: +b.dataset.st, k: it.k, v: it.v, c: it.c, fx: it.fx, r: it.r | 0, r0: it.r | 0 };
      updateSellBtn();
    }));
    updateSellBtn();
  }
  function updateSellBtn() {
    const c = decor.carry;
    document.querySelectorAll('#decor-storage [data-st]').forEach((b) => b.classList.toggle('on', c?.src === 'storage' && +b.dataset.st === c.idx));
    const paintBtn = document.querySelector('#decor-paint');
    if (paintBtn) {
      paintBtn.disabled = !c || !canRecolor(c.k);
      paintBtn.title = c ? (canRecolor(c.k) ? 'Måla om möbeln du håller i – gratis' : 'Den här går inte att måla om') : 'Välj en möbel först';
      paintBtn.onclick = () => paintCarry();
    }
    const rotBtn = document.querySelector('#decor-rotate');
    if (rotBtn) {
      rotBtn.disabled = !c || c.k === 'vaxt';
      rotBtn.textContent = c && rotStates(c.k) === 4 ? `🔄 Rotera (${['fram', 'höger', 'bak', 'vänster'][c.r]})` : '🔄 Rotera';
      rotBtn.onclick = () => rotateCarry();
    }
    const storeBtn = document.querySelector('#decor-store');
    if (storeBtn) {
      storeBtn.disabled = !c || c.src !== 'deco';
      storeBtn.onclick = () => storeCarry();
    }
    const btn = document.querySelector('#decor-sell');
    if (!btn) return;
    const item = c ? (c.src === 'storage' ? g.storage[c.idx] : decoList()[c.idx]) : null;
    const sellable = !!c && g.sellable(item);
    btn.disabled = !sellable;
    btn.textContent = sellable ? `Sälj +${Math.round(katalogOf(c.k).price / 2)} kr` : c?.fx ? 'Sälj (startmöbel)' : 'Sälj';
    btn.title = c?.fx ? 'Startmöblerna går att flytta men inte sälja' : '';
    btn.onclick = () => {
      if (!sellable) return;
      if (c.src === 'storage') g.sellStorage(c.idx); else g.sellDeco(sub, c.idx);
      play('coin');
      decor.carry = null;
      rebuild(); renderStoragePanel();
    };
    const done = document.querySelector('#decor-done');
    if (done) done.onclick = () => toggleDecor(false);
  }
  // 🎨 Färg: samma färgval som i varuhuset, för möbeln man håller i – gratis.
  // (Dialogen laddas vid behov så att room.js och shop-mobler.js inte
  // importerar varandra.)
  function paintCarry() {
    const c = decor.carry;
    if (!c || !canRecolor(c.k)) return;
    play('click');
    import('./shop-mobler.js').then((m) => m.openRecolor(A, { kind: c.k, v: c.v, c: c.c, onPick: (hex) => {
      const ok = c.src === 'storage' ? g.recolorStorage(c.idx, hex) : g.recolorDeco(sub, c.idx, hex);
      if (!ok) return;
      c.c = hex || undefined;
      play('ok');
      toast(hex ? '🎨 Nymålad!' : '🎨 Tillbaka i originalfärgen.', 'good');
      rebuild(); renderStoragePanel();
    } }));
  }

  // ---------- figuren ----------
  rebuild();
  let px = visit ? DOOR.cx : Math.min(RIGHT - 40, 100), py = WALL_Y + 34;
  [px, py] = nearestFree(px, py);
  let path = [], onArrive = null, dir = 'down', t = 0;
  function walkTo(x, y, cb) { path = findPath(px, py, x, y); onArrive = cb || null; if (!path.length) { const d = onArrive; onArrive = null; d?.(); } }

  // ---------- husdjuren (bara i det egna hemmet) ----------
  // Lagret får möblernas gångbarhet (furnGrid – utan husdjurens egna prylar, djuren ska
  // kunna kliva in i korgen) minus fläcken framför dörrarna (där ställs inga prylar ut, så
  // att vägen ut aldrig blockeras). Prylarnas hinder läggs till spelarens gångbarhet.
  if (!visit) {
    const store = petStore();
    if (!hopped) store.walkEnd(); // hemkommen från staden (eller jobbet): kopplet av
    const inDoorway = (x, y) => y < WALL_Y + 16 && ((sub === 0 && x > DOOR.x0 - 4 && x < DOOR.x1 + 4) || subDoors.some((sd) => x > sd.x0 - 4 && x < sd.x1 + 4));
    const walker = {
      get px() { return px; }, get py() { return py; }, get dir() { return dir; }, get path() { return path; },
      walkTo, stop() { path = []; onArrive = null; },
    };
    L = createPetLayer(A, {
      home, room: sub, walker,
      bounds: { left: 8, right: RIGHT - 6, top: WALL_Y + 4, bottom: FH - 4 },
      isFree: (x, y) => furnFree(x, y) && !inDoorway(x, y),
      onObstacles: (list) => { petObstacles = list; rebuild(); },
    });
    petObstacles = L.obstacles();
    rebuild();
    [px, py] = nearestFree(px, py);
  }
  // 🐾 Djurprylar i förrådspanelen (Möblera): lagrets egen dialog – ställ ut, flytta, plocka upp
  function syncPetBtn() {
    const foot = document.querySelector('#decor-panel .dp-foot');
    if (!foot) return;
    let b = document.querySelector('#decor-pets');
    if (!b) {
      b = document.createElement('button');
      b.id = 'decor-pets'; b.className = 'btn btn-small';
      b.textContent = '🐾 Djurprylar'; b.title = 'Husdjurens prylar: ställ ut, flytta eller plocka upp';
      foot.insertBefore(b, document.querySelector('#decor-done'));
    }
    const s = L ? petStore() : null;
    const any = !!s && (s.pets.some((p) => p.home === home) || s.items.some((i) => i.home === home) || Object.values(s.inventory).some((n) => n > 0));
    b.classList.toggle('hidden', !any);
    b.onclick = () => { if (!L) return; play('click'); if (decor.carry) dropCarry(); L.openInventory(); };
  }

  return {
    get worldX() { return px; },
    get worldY() { return py; },
    toggleDecor,
    _debug: {
      spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; },
      tile: (a, b) => ({ x: Math.min(RIGHT - 20, 30 + a * 40), y: Math.min(FH - 10, WALL_Y + 15 + b * 18) }),
      // för testerna: lyft möbel i (i deco-listan) / förrådspost, rotera, släpp vid (x, y)
      pick: (idx) => { const d = decoList()[idx]; if (!d) return false; decor.carry = { src: 'deco', idx, k: d.k, v: d.v, c: d.c, fx: d.fx, r: d.r | 0, r0: d.r | 0 }; rebuild(); return true; },
      pickStorage: (idx) => { const it = g.storage[idx]; if (!it) return false; decor.carry = { src: 'storage', idx, k: it.k, v: it.v, c: it.c, fx: it.fx, r: it.r | 0, r0: it.r | 0 }; return true; },
      rotate: () => rotateCarry(),
      store: () => storeCarry(),
      drop: (x, y) => { decor.mx = x; decor.my = y; if (!decor.carry || !canPlaceCarry(x, y)) return false; commitPlace(); return true; },
      canPlace: (x, y) => !!decor.carry && canPlaceCarry(x, y),
      props: () => props.map((p) => ({ k: p.k, fn: p.fn, solid: p.solid })),
      walls: () => wallItems.map((w) => ({ k: w.k, x: w.x, top: w.top })),
      // står varje post i listan rätt (som fitRoom ser det)? – för startmöbleringstestet
      allFit: () => { const list = decoList(); return list.every((d, i) => !knownKind(d.k) || fits(d.k, d.v, d.r, d.x, d.y, list, i)); },
      seeds: () => seedFor(home, sub),
      windows: windowRects, doors: doorRects,
      partition: RIGHT,
      // husdjurslagret (null vid besök) och figurens läge/väg – för tools/pets-home-test.mjs
      layer: () => L,
      me: () => ({ x: px, y: py, dir, walking: path.length > 0 }),
      walkable: (x, y) => walkable(x, y),
    },

    update(dt) {
      t += dt;
      if (path.length) {
        const [gx, gy] = path[0];
        const dx = gx - px, dy = gy - py, dist = Math.hypot(dx, dy), step = 62 * dt;
        dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        if (dist <= step) {
          px = gx; py = gy;
          path.shift();
          if (!path.length) { dir = 'down'; const cb = onArrive; onArrive = null; cb?.(); }
        } else { px += dx / dist * step; py += dy / dist * step; }
      }
      L?.update(dt); // djuren: rörelser, behov och simuleringen mot spelklockan
      if (visit && !A.visitTarget) A.go('city');
    },

    move(x, y) { decor.mx = x; decor.my = y; L?.move(x, y); },
    // mobilen: dra möbeln med fingret och släpp – då ställs den där man släppte
    // (tryck för att plocka upp + tryck för att ställa ner fungerar som förut)
    up(x, y) {
      const p = decor.press;
      decor.press = null;
      if (!decor.on || !p) return;
      if (Math.hypot(x - p.x, y - p.y) < 6) return; // ett tryck utan att dra: behåll möbeln i handen
      decor.mx = x; decor.my = y;
      if (p.pet) { if (L?.placing) { L.move(x, y); L.down(x, y); } return; } // husdjursprylen: ställ där fingret släppte
      if (!decor.carry) return;
      if (canPlaceCarry(x, y)) { play('ok'); commitPlace(); } else play('fel');
    },
    down(x, y) {
      decor.mx = x; decor.my = y;
      if (decor.on) {
        // husdjursprylarna (skål, låda, korg, bur, säckar …) flyttas som möbler: lagret håller
        // spöket, nästa klick (eller släppet efter ett drag) ställer den
        if (L?.placing) { L.move(x, y); L.down(x, y); return; }
        if (!decor.carry && L) {
          const pi = L.itemAt(x, y);
          if (pi) { L.startMoving(pi.id); L.move(x, y); decor.press = { x, y, pet: true }; play('click'); return; }
        }
        if (decor.carry) { if (canPlaceCarry(x, y)) { play('ok'); commitPlace(); } else play('fel'); return; }
        // plocka upp möbeln under pekaren (främst sorterad först; väggsaker och mattor sist)
        const list = decoList();
        const hit = [
          ...props.filter((p) => p.decoIdx !== undefined).sort((a, b) => b.solid[3] - a.solid[3]).map((p) => ({ decoIdx: p.decoIdx, r: [p.solid[0], p.top, p.solid[2], p.solid[3] + 2] })),
          ...wallItems.map((w) => ({ decoIdx: w.decoIdx, r: [w.x, w.top, w.x + w.w, w.top + w.h] })),
          ...rugs.map((r) => ({ decoIdx: r.decoIdx, r: [r.x, r.y, r.x + r.w, r.y + r.h] })),
        ].find((p) => x >= p.r[0] && x <= p.r[2] && y >= p.r[1] && y <= p.r[3]);
        if (hit) {
          const d = list[hit.decoIdx];
          decor.carry = { src: 'deco', idx: hit.decoIdx, k: d.k, v: d.v, c: d.c, fx: d.fx, r: d.r | 0, r0: d.r | 0 };
          decor.press = { x, y }; // släpps den efter att ha dragits ställs den ner där (se up)
          rebuild(); updateSellBtn();
        }
        return;
      }
      // djur (meny), prylar (säck, skål, låda …) och olyckor får klicket före möblerna
      if (L && L.down(x, y)) return;
      for (const h of hotRects) {
        if (x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) {
          walkTo(h.go[0], h.go[1], h.act || undefined);
          return;
        }
      }
      if (y > WALL_Y && x < RIGHT) walkTo(x, y);
    },
    key(k) {
      if (L && L.key(k)) return; // Esc: lägg tillbaka prylen/säcken man håller i
      if (k === 'Escape' && decor.on) toggleDecor(false);
      if ((k === 'r' || k === 'R') && decor.on && decor.carry) rotateCarry();
    },
    exit() {
      toggleDecor(false);
      document.querySelector('#decor-panel')?.classList.add('hidden');
      if (document.body.classList.contains('decor-on')) { document.body.classList.remove('decor-on'); window.dispatchEvent(new Event('resize')); }
      if (L) {
        L.exit();
        // genom en dörr i bakväggen: djur som följer dig ("Följ mig") går med in i nästa rum
        if (hopping) {
          const s = petStore();
          let n = 0;
          for (const p of s.pets) if (p.home === home && p.following && !p.out && p.room === sub) { p.room = A.roomSub; p.x = null; p.y = null; n++; }
          if (n) s.save();
        }
        L = null;
      }
    },

    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const night = isNight(g);
      ctx.drawImage(bg(night), 0, 0);
      drawWindowLife(ctx, roomDef.view || 'sky', winDrawn, winY[0], winY[1], t, night); // grannar, bilar, katten på staketet
      for (const w of wallItems) w.draw(ctx);
      if (plan.shabby) drawSpider(ctx, RIGHT, t);
      for (const r of rugs) r.draw(ctx);

      const folks = worldFolksHere(A);
      const drawables = props.map((p) => ({ fy: p.sort, draw: () => p.draw(ctx) }));
      const mine = worldMyEmote();
      // husdjuren, deras prylar och olyckor (plus mätare/bubblor/spöken med fy ≥ 10000 överst)
      if (L) for (const d of L.drawables()) drawables.push({ fy: d.fy, draw: () => d.draw(ctx) });
      drawables.push({ fy: py, draw: () => {
        // bär man en matsäck (A.carrying) ritas figuren med bär-bildrutorna
        const frame = A.carrying ? (path.length ? CARRY_SEQ[Math.floor(t * 8.5) % 4] : 9)
          : path.length ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
        drawPerson(ctx, px, py, A.avatar.look, dir, frame);
        if (folks.length) nameTag(ctx, px, py - 50, A.avatar);
        if (mine) emoteBubble(ctx, px, py - 60, mine);
      } });
      for (const f of folks) {
        drawables.push({ fy: f.y, draw: () => {
          drawPerson(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
          nameTag(ctx, f.x, f.y - 50, f.av);
          if (f.emote) emoteBubble(ctx, f.x, f.y - 60, f.emote);
        } });
      }
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));

      // spöket i möblera-läget
      if (decor.on && decor.carry) {
        const { k, v, c, r } = decor.carry;
        const okHere = canPlaceCarry(decor.mx, decor.my);
        const pos = posFor(k, v, r, decor.mx, decor.my);
        ctx.globalAlpha = 0.7;
        if (k === 'matta') ctx.drawImage(rugImg(v, c), pos.x, pos.y);
        else if (k === 'vaxt') { const p = makePlantProp(pos.x + 10, pos.y); p.draw(ctx); }
        else { const a = furnView(k, v, c, r); if (a) drawArt(ctx, a, pos.x, pos.y - a.sh); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = okHere ? 'rgba(80,220,110,0.8)' : 'rgba(230,60,60,0.8)';
        if (isWall(k)) ctx.fillRect(pos.x, pos.y + 1, dimsOf(k, v, r).w, 2);
        else ctx.fillRect(decor.mx - 6 | 0, decor.my | 0, 12, 2);
      } else if (decor.on) {
        ctx.fillStyle = 'rgba(23,21,26,0.7)'; ctx.fillRect(4, 4, 150, 10);
        ctxText(ctx, SMALL, 'MÖBLERA: KLICKA PÅ EN MÖBEL', 7, 6, '#ffd23f');
      }

      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.22)'; ctx.fillRect(0, 0, FW, FH); }
    },
  };
}

const isNight = (g) => { const h = g.min / 60; return h >= 19.5 || h < 6.5; };

// ---------- sprite-props ----------
// En golvmöbel ur atlasen i sin rotationsvy: x = vänsterkant, y = fotlinje.
function spriteProp(d, decoIdx, sign) {
  const vw = viewOf(d.k, d.v, d.r);
  const f = frameOf(vw.k, vw.v);
  if (!f) return null;
  const [, , fw, fh] = f;
  const x = d.x, base = d.y, top = base - fh;
  const fn = functionOf(d.k);
  const label = sign ? labelOf(d.k) : null;
  return {
    k: d.k, fn, decoIdx, fx: d.fx, sort: base, top,
    solid: [x - 1, base - solidH(d.k, fh), x + fw + 1, base + 1],
    draw(ctx) {
      ctx.fillStyle = 'rgba(20,12,28,0.22)';
      ctx.fillRect(x + 1, base - 1, fw - 2, 2);
      ctx.fillRect(x + 3, base + 1, fw - 6, 1);
      const a = furnView(d.k, d.v, d.c, d.r); // cachad per (ruta, färg)
      if (a) drawArt(ctx, a, x, top);
      if (label) ctxPlate(ctx, x + fw / 2, top - 9, label);
    },
  };
}
// väggsak: hänger på bakväggen med underkant y, inget hinder
function wallProp(d, decoIdx) {
  const vw = viewOf(d.k, d.v, d.r);
  const f = frameOf(vw.k, vw.v);
  if (!f) return null;
  const [, , fw, fh] = f;
  const top = d.y - fh;
  return {
    k: d.k, fn: functionOf(d.k), decoIdx, fx: d.fx, x: d.x, top, w: fw, h: fh,
    draw(ctx) {
      ctx.fillStyle = 'rgba(20,12,28,0.18)';
      ctx.fillRect(d.x + 1, d.y, fw - 1, 1); ctx.fillRect(d.x + fw, top + 1, 1, fh - 1);
      const a = furnView(d.k, d.v, d.c, d.r);
      if (a) drawArt(ctx, a, d.x, top);
    },
  };
}
// matta ur arken: platt, gåbar, ritas under allt
function flatProp(d, decoIdx) {
  const vw = viewOf(d.k, d.v, d.r);
  const f = frameOf(vw.k, vw.v);
  if (!f) return null;
  const [, , fw, fh] = f;
  return { k: d.k, decoIdx, x: d.x, y: d.y - fh, w: fw, h: fh, draw(ctx) { const a = furnView(d.k, d.v, d.c, d.r); if (a) drawArt(ctx, a, d.x, d.y - fh); } };
}
function ctxPlate(ctx, cx, y, label) {
  const w = textW(SMALL, label) + 6;
  ctx.fillStyle = '#8a6a2a'; ctx.fillRect(cx - w / 2 - 1 | 0, y - 1, w + 2, 9);
  ctx.fillStyle = '#d8b85a'; ctx.fillRect(cx - w / 2 | 0, y, w, 7);
  ctxText(ctx, SMALL, label, (cx - textW(SMALL, label) / 2) | 0, y + 1, '#3a2a10');
}
// miniatyr till förrådspanelen (DOM) – i färgen c. Pixelkonst i heltalsskala:
// små möbler dubbelt så stora, stora i 1:1 (mattan beskärs till ett hörn).
const THUMB = { w: 52, h: 44 };
function thumbCanvas(k, v, c) {
  const cv = document.createElement('canvas');
  cv.width = THUMB.w; cv.height = THUMB.h;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const draw = () => {
    if (k === 'vaxt') { const p = makePlantProp(20, 52); cv.width = 40; cv.height = 44; x.imageSmoothingEnabled = false; x.drawImage(p.img, 0, -10); return; }
    const a = furnArt(k, v, c);
    if (!a) return;
    const s = a.sw * 2 <= THUMB.w && a.sh * 2 <= THUMB.h ? 2 : 1;
    const w = Math.min(a.sw, THUMB.w / s | 0), h = Math.min(a.sh, THUMB.h / s | 0);
    cv.width = w * s; cv.height = h * s;
    x.imageSmoothingEnabled = false;
    x.drawImage(a.img, a.sx, a.sy, w, h, 0, 0, w * s, h * s);
  };
  if (ATLAS.complete) draw(); else ATLAS.addEventListener('load', draw, { once: true });
  return cv;
}

// ---------- madrassen på golvet (när ingen säng står ute) ----------
let mattressImg = null;
function mattressArt() {
  if (mattressImg) return mattressImg;
  const P = new Pix(34, 16);
  // madrass med kudde: blågrå, randig, lite tillplattad
  P.rect(1, 4, 32, 11, 0x2a2430);
  P.rect(2, 5, 30, 9, 0x6f7f9a); P.rect(2, 5, 30, 1, 0x93a3bc); P.rect(2, 13, 30, 1, 0x4c5a72);
  for (let x = 4; x < 30; x += 4) P.rect(x, 7, 1, 6, 0x5d6d88);
  P.rect(3, 6, 8, 6, 0xf0ece0); P.rect(3, 6, 8, 1, 0xffffff); P.rect(3, 11, 8, 1, 0xc8c4b4); P.box(3, 6, 8, 6, 0x9a9686);
  for (let x = 2; x < 32; x++) P.px(x, 14, 0x000000, (x & 1) ? 0.25 : 0.1);
  mattressImg = P.flush();
  return mattressImg;
}
function makeMattressProp(list, RIGHT) {
  const w = 34, h = 16;
  let x = -1, y = -1;
  // en ledig fläck: helst nere till vänster
  const free = (tx, ty) => {
    if (tx < 8 || tx + w > RIGHT - 5 || ty < WALL_Y + 16 || ty > FH - 4) return false;
    const me = [tx - 1, ty - 8, tx + w + 1, ty + 1];
    if (me[2] > DOOR.x0 - 2 && me[0] < DOOR.x1 + 2 && me[1] < WALL_Y + 15) return false;
    for (const o of list) { if (isWall(o.k) || o.k === 'matta' || isFlat(o.k)) continue; if (overlaps(me, footOf(o.k, o.v, o.r, o.x, o.y).r)) return false; }
    return true;
  };
  for (let ty = FH - 8; y < 0 && ty > WALL_Y + 16; ty -= 6) for (let tx = 10; x < 0 && tx + w < RIGHT - 5; tx += 6) if (free(tx, ty)) { x = tx; y = ty; }
  if (x < 0) return null;
  const img = mattressArt();
  return {
    k: 'madrass', fn: 'sova', sort: y, top: y - h,
    solid: [x - 1, y - 8, x + w + 1, y + 1],
    act: null, // sätts av rummet: floorSleep (golvet ger sämre sömn)
    draw(ctx) { ctx.drawImage(img, x, y - h); ctxPlate(ctx, x + w / 2, y - h - 9, 'GOLVET'); },
  };
}
// Sova på golvet: som sängen, fast sämre (kvalitet 0,75) – och en påminnelse om förrådet.
function floorSleep(A) {
  const g = A.game;
  openModal('😴 Sova på golvet', `<p style="font-size:20px">Ingen säng är utställd – den ligger i förrådet. Golvet är hårt, kallt och lite dammigt, men du somnar.</p>
    <p style="font-size:18px" class="bad">Sämre sömn än i en säng. Ställ ut sängen med 🛋️ Möblera!</p>`, [
    { label: 'Inte än', onClick: closeModal },
    { label: '😴 Sov ändå', cls: 'btn-go', onClick: () => {
      closeModal();
      play('sleep');
      const { rent, eventText } = g.sleep(0.75);
      setTimeout(() => play('morning'), 600);
      toast(`☀️ God morgon! ${g.dayName}, dag ${g.day}. Aj, ryggen …`, 'good');
      if (rent) toast(`💸 Hyra betald: ${fmt(rent)}`, g.money < 0 ? 'bad' : '');
      if (g.money < 0) toast('⚠️ Du är skyldig hyresvärden pengar – jobba ihop dem!', 'bad');
      if (eventText) setTimeout(() => toast(eventText, 'good'), 900);
    } },
  ]);
}

// ---------- funktionerna man gör vid möblerna ----------
const DASS_LINES = [
  '🚽 *KLONK* … *gurgel* … Det spolade. Typ.',
  '🚽 Locket ramlade av igen. Du satte dit det. Det ramlade av.',
  '🚽 Grannen bankar i väggen: "SLUTA SPOLA!"',
  '🚽 Vattnet snurrade åt fel håll, sedan åt rätt håll, sedan stannade det.',
  '🚽 Pumpen fick jobba. Du också.',
  '🚽 Något bubblade till nere i röret. Du väljer att inte tänka på det.',
];
const WC_LINES = ['🚽 Skönt. Livet går vidare.', '🚽 *spol* Fräscht och fint.', '🚽 Toapapper: check. Handtvätt: check.', '🚽 Lugnt och stilla. Bästa stunden på dagen.'];
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
// spolningen: sus → nedåtsvep → gurgel (dasset klonkar dessutom)
function flushSound(bad) {
  play('slide');
  setTimeout(() => play('sleep'), 120);
  setTimeout(() => play('chirp'), 650);
  if (bad) { setTimeout(() => play('knock'), 900); setTimeout(() => play('miss'), 1250); }
}
function useToilet(A, kind) {
  const g = A.game;
  const bad = kind === 'dass';
  flushSound(bad);
  toast(pick(bad ? DASS_LINES : WC_LINES), bad ? 'wrap' : 'good');
  g.passTime(5);
  g.save();
}
function wash(A, kind) {
  const g = A.game;
  play('slide');
  const long = kind === 'dusch' || kind === 'badkar';
  const msg = { dusch: '🚿 Fräsch och ren!', badkar: '🛁 Ett långt varmt bad. Ahh.', tvattmaskin: '🫧 Tvätten snurrar. Rena kläder i morgon!', tvattpelare: '🧺 Tvätt och tork i ett – lyx!' }[kind] || '🧼 Rena händer!';
  g.energy = Math.min(100, g.energy + (long ? 5 : 2));
  g.passTime(long ? 20 : 5);
  g.save();
  toast(msg, 'good');
}
function watchTv(A, kind) {
  const g = A.game;
  play('click');
  const msg = { dator: '💻 Du surfar en stund. Var tog timmen vägen?', laptop: '💻 Lite skärmtid i soffan.', spelkonsol: '🎮 En runda till … bara en till.' }[kind] || '📺 Du zappar en stund. Inget bra på, som vanligt.';
  g.passTime(30);
  g.save();
  toast(msg);
}

// mattor: två mönster (museum/rand), valfri bottenfärg c – cachade
const rugCache = new Map();
function rugImg(v, c) {
  const key = `${v | 0}|${isHex(c) ? c.toLowerCase() : ''}`;
  if (rugCache.has(key)) return rugCache.get(key);
  const P = new Pix(RUG.w, RUG.h);
  const own = isHex(c) ? parseInt(c.slice(1), 16) : null;
  if ((v | 0) === 1) paintRug(P, 0, 0, RUG.w, RUG.h, own ?? 0x3f5667, 0xd9d2c3, 'stripe');
  else paintRug(P, 0, 0, RUG.w, RUG.h, own ?? 0x5e1622, 0xd8b24a, 'museum');
  if (rugCache.size > 120) rugCache.delete(rugCache.keys().next().value); // egen färg kan ge många
  rugCache.set(key, P.flush());
  return rugCache.get(key);
}
function paintRug(P, x0, y0, x1, y1, base, trim, kind) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const bx = Math.min(x - x0, x1 - 1 - x), by = Math.min(y - y0, y1 - 1 - y), b = Math.min(bx, by);
    let c = mul(base, 0.95 + hash(x, y, 11) * 0.08);
    if (b === 0) c = mul(base, 0.6);
    else if (b === 2) c = trim;
    else if (kind === 'museum' && b > 4) {
      const u = Math.abs(((x - x0) % 12) - 6) + Math.abs(((y - y0) % 10) - 5);
      if (u === 4) c = mix(base, trim, 0.45);
      if (u === 0) c = trim;
    } else if (kind === 'stripe' && b > 3 && ((y - y0) >> 1) % 3 === 0) c = mix(base, trim, 0.18);
    if (b === 1 && (x + y) % 2) c = mix(c, 0x000000, 0.2);
    P.px(x, y, c);
  }
}

// Monsteran (Pix)
function makePlantProp(cx, base) {
  const P = new Pix(40, 54, cx - 20, base - 52);
  P.rect(cx - 7, base - 12, 14, 12, 0xe8e4da); P.hl(cx - 8, base - 13, 16, 0xffffff); P.hl(cx - 8, base - 12, 16, 0xcfc8b8);
  P.vl(cx + 5, base - 11, 11, 0xbdb5a5); P.vl(cx + 6, base - 11, 11, 0xa9a192); P.hl(cx - 6, base - 1, 12, 0x9a9282);
  P.rect(cx - 6, base - 12, 12, 1, 0x3a2a1c);
  const leaves = [[-10, -30, 9, 6], [2, -38, 8, 7], [-4, -44, 7, 6], [6, -26, 9, 6], [-12, -20, 8, 5], [8, -16, 7, 5], [-2, -24, 8, 6]];
  for (const [dx, dy, rx, ry] of leaves) {
    for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
      const dd = Math.hypot(xx / rx, yy / ry);
      if (dd >= 1) continue;
      let c = dd < 0.5 && xx + yy < 0 ? 0x5fbf6e : 0x2f8f46;
      if (dd > 0.8) c = 0x216b36;
      if (xx === 0 || (Math.abs(xx - yy) === 0 && dd < 0.7)) c = 0x7fd48a;
      P.px(cx + dx + xx, base + dy + yy, c);
    }
    P.line(cx, base - 12, cx + dx, base + dy + ry, 0x2c6e3a);
  }
  P.ell(cx, base + 1, 10, 3, 0x140c1c, 0.3, 3);
  const img = P.flush();
  const ox = cx - 20, oy = base - 52;
  return { img, sort: base, top: oy, solid: [cx - 9, base - 12, cx + 9, base + 1], draw: (ctx) => ctx.drawImage(img, ox, oy) };
}

// ================= bakgrunden (per delrum + dag/natt) =================
// Fönstrens ram: 'classic' (vit karm med spröjs), 'caravan' (husvagnens rundade fönster
// med gummilist) och 'steel' (takvåningens smala svarta stålramar).
const winStyle = (plan, view) => (view === 'stad' ? 'steel' : plan.worn === 'husvagn' ? 'caravan' : 'classic');

function buildBg(roomDef, RIGHT, subDoors, hasExit, plan, visit) {
  const lyx = !!plan.lyx, shabby = !!plan.shabby, worn = plan.worn || null;
  const [wy0, wy1] = plan.winY || WIN_Y;
  const view = roomDef.view || 'sky', style = winStyle(plan, view);
  // fönstren som faktiskt ritas (inte bakom en dörr eller utanför lokalen)
  const wins = roomDef.windows.filter(([wx0, wx1]) => !(wx1 > RIGHT - 5 || subDoors.some((sd) => wx1 > sd.x0 - 4 && wx0 < sd.x1 + 4)));
  const cache = {};
  return (night) => {
    const key = night ? 'n' : 'd';
    if (cache[key]) return cache[key];
    const P = new Pix(FW, FH);
    const wall = night ? mul(roomDef.wall, 0.8) : roomDef.wall;
    const wallDk = night ? mul(roomDef.wallDk, 0.8) : roomDef.wallDk;

    // golvet
    const TW2 = 23, TH2 = 15;
    for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (worn === 'husvagn') { P.px(x, y, caravanFloor(x, y, roomDef)); continue; }
      const tx = (x / TW2) | 0, ty = ((y - WALL_Y) / TH2) | 0;
      const lx = x - tx * TW2, ly = (y - WALL_Y) - ty * TH2;
      let c = mix(roomDef.floorA, roomDef.floorB, ((tx + ty) & 1) ? 0.2 : 0.62);
      c = mul(c, 0.97 + hash(tx, ty, 1) * 0.05);
      const h = hash(x, y, 2);
      if (h > 0.94) c = mul(c, 0.95); else if (h < 0.02) c = mix(c, 0xffffff, 0.25);
      if (lyx) { const vein = Math.sin(x * 0.31 + y * 0.55 + Math.sin(x * 0.09) * 4); if (vein > 0.96) c = mix(c, 0xd8b24a, 0.22); }
      if (shabby) { // slitet: blekta och smutsiga brädor, gamla fläckar
        if (hash(tx, ty, 21) > 0.7) c = mix(c, 0x8a7a5c, 0.22);
        if (hash(x >> 1, y >> 1, 22) > 0.965) c = mul(c, 0.8);
      }
      if (worn === 'hoghus') { // plastmattan: ett nött gångstråk från dörren och in, gamla repor
        const path = Math.max(0, 1 - Math.hypot((x - DOOR.cx - (y - WALL_Y) * 0.9) / 26, (y - WALL_Y - 40) / 60));
        if (path > 0 && bayer(x, y) < path * 0.7) c = mix(c, 0xd8ccb0, 0.22);
        if (hash(x >> 2, y, 24) > 0.985) c = mul(c, 0.82);
      }
      if (lx === 0 || ly === 0) c = mul(c, 0.84);
      else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, worn === 'hoghus' ? 0.1 : 0.2);
      else if (lx + ly > 7 && lx + ly < 9 && ly < 6) c = mix(c, 0xffffff, 0.07);
      P.px(x, y, c);
    }

    // väggen med bröstpanel (husvagnen och Förortsettan har egna väggar)
    if (worn === 'husvagn') paintCaravanWall(P, RIGHT, wall, wallDk);
    else if (worn === 'hoghus') paintEttaWall(P, RIGHT, wall, wallDk);
    else for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < FW - 4; x++) {
      let c = mix(mul(wall, 0.8), wall, Math.min(1, (y - 5) / 20) + (bayer(x, y) - 0.5) * 0.12);
      if (x % 27 === 0) c = mul(c, 0.9); else if (x % 27 === 1) c = mix(c, 0xffffff, 0.05);
      if (y >= WALL_Y - 19) {
        const bx = (x - 4) % 24, by = y - (WALL_Y - 19);
        c = wallDk;
        if (by === 0) c = mul(wallDk, 0.75);
        else if (bx === 2 || by === 2) c = mix(wallDk, 0xffffff, 0.12);
        else if (bx === 22 || by === 17) c = mul(wallDk, 0.8);
        c = mix(c, wallDk, (bayer(x, y) - 0.5) * 0.2 + 0.15);
      }
      if (y >= WALL_Y - 2) c = mul(wallDk, 0.55);
      P.px(x, y, c);
    }
    if (!worn) {
      P.hl(4, 5, FW - 8, mul(wall, 0.6));
      P.hl(4, WALL_Y - 2, FW - 8, mix(wallDk, 0xffffff, 0.25));
    }
    if (lyx) { P.hl(4, WALL_Y - 20, FW - 8, 0xf0d070); P.hl(4, WALL_Y - 19, FW - 8, 0xc8a24a); }
    if (view === 'stad') ceilingSpots(P, RIGHT, night); // takvåningens infällda spotlights

    // dörrarna: ut (bara rum 0) + delrumsdörrar
    const paintDoor = (x0, x1, signText, signCol) => {
      for (let y = 28; y < WALL_Y; y++) for (let x = x0; x < x1; x++) {
        let c = mix(0x5a4632, 0x6a5238, hash(x >> 1, y >> 2, 7) * 0.6 + (bayer(x, y) - 0.5) * 0.1);
        if ((y - 28) % 22 < 2 || x === x0 + ((x1 - x0) >> 1)) c = mul(c, 0.7);
        P.px(x, y, c);
      }
      P.box(x0 - 1, 27, x1 - x0 + 2, WALL_Y - 27, 0x2e2418);
      P.box(x0, 28, x1 - x0, WALL_Y - 28, 0x8a7050);
      P.rect(x1 - 6, 54, 2, 4, 0xd8b24a);
      const tw = textW(SMALL, signText) + 8;
      const sx = Math.round((x0 + x1) / 2 - tw / 2);
      P.rect(sx, 20, tw, 9, 0x1d2b1f); P.box(sx, 20, tw, 9, 0x0e1510);
      text(P, SMALL, signText, sx + 4, 22, signCol);
    };
    if (hasExit) {
      paintDoor(DOOR.x0, DOOR.x1, visit ? 'HEM' : 'UT', 0x6fe08a);
      for (let y = WALL_Y + 1; y < WALL_Y + 9; y++) for (let x = DOOR.cx - 13; x < DOOR.cx + 13; x++) P.px(x, y, (x + y) % 2 ? 0x4a4038 : 0x3e352e);
      P.box(DOOR.cx - 13, WALL_Y + 1, 26, 8, 0x2a2018);
    }
    for (const sd of subDoors) paintDoor(sd.x0, sd.x1, sd.name, 0xffd23f);

    // fönster: karm, utsikten (samma landskap genom alla fönster i rummet), spröjs, bänk
    for (const [wx0, wx1] of wins) {
      const ww = wx1 - wx0, wh = wy1 - wy0;
      const frame = style === 'steel' ? 0x2a2e36 : style === 'caravan' ? 0x2e2c30 : shabby ? 0xd8d0bc : worn === 'hoghus' ? 0xe2ddcc : 0xf0ece0;
      P.rect(wx0 - 2, wy0 - 2, ww + 4, wh + 4, frame);
      if (style !== 'caravan') P.box(wx0 - 2, wy0 - 2, ww + 4, wh + 4, style === 'steel' ? 0x14161c : mul(wall, 0.5));
      P.clip(wx0, wy0, wx1, wy1);
      paintView(P, view, wx0, wx1, wy0, wy1, night, shabby);
      if (worn === 'hoghus') for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) if (hash(x >> 1, y >> 2, 25) > 0.93) P.px(x, y, 0xb8b09a, 0.25); // flottiga rutor
      P.clip();
      if (style === 'classic') {
        const mc = worn === 'hoghus' ? 0xe2ddcc : 0xf0ece0;
        P.rect(wx0, (wy0 + wy1 >> 1), ww, 1, mc);
        P.rect((wx0 + wx1 >> 1), wy0, 1, wh, mc);
        P.hl(wx0 - 2, wy1 + 2, ww + 4, 0xd8d2c2);
      } else if (style === 'steel') {
        // smala stålposter var ~40:e px, en tunn tvärslå högt upp och en ljus reflex
        const n = Math.max(1, Math.round(ww / 42));
        for (let i = 1; i < n; i++) { const mx = wx0 + Math.round(ww * i / n); P.vl(mx - 1, wy0, wh, 0x2a2e36); P.vl(mx, wy0, wh, 0x3e434c); }
        P.hl(wx0, wy0 + Math.round(wh * 0.18), ww, 0x2a2e36);
        for (let i = 0; i < ww; i += 1) { const y = wy0 + 2 + ((i * 0.6) | 0); if (y < wy1 - 2 && (i % 37) < 5) P.px(wx0 + i, y, 0xffffff, 0.18); }
        P.hl(wx0 - 2, wy1 + 2, ww + 4, 0x14161c);
      } else { // husvagnen: rundade hörn i gummilisten, en aluminiumram innanför och brunt akrylglas
        for (const [cx, cy] of [[wx0 - 2, wy0 - 2], [wx1 + 1, wy0 - 2], [wx0 - 2, wy1 + 1], [wx1 + 1, wy1 + 1]]) P.px(cx, cy, wall);
        for (const [cx, cy] of [[wx0, wy0], [wx1 - 1, wy0], [wx0, wy1 - 1], [wx1 - 1, wy1 - 1]]) P.px(cx, cy, 0x2e2c30);
        P.box(wx0 - 1, wy0 - 1, ww + 2, wh + 2, 0x9a9ea4);
        P.px(wx0 - 1, wy0 - 1, 0x2e2c30); P.px(wx1, wy0 - 1, 0x2e2c30); P.px(wx0 - 1, wy1, 0x2e2c30); P.px(wx1, wy1, 0x2e2c30);
        for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) P.px(x, y, 0x6a4a28, 0.14);
        P.hl(wx0, wy0 + Math.round(wh * 0.55), ww, 0x7a7e84); // skjutrutans list
      }
      if (shabby) { P.line(wx0 + 4, wy0 + 2, wx0 + 11, wy0 + 12, 0xe8f0f8); P.line(wx0 + 11, wy0 + 12, wx0 + 9, wy0 + 19, 0xe8f0f8); } // spricka i rutan
      if (!night) for (let y = WALL_Y; y < WALL_Y + 30; y++) {
        const s = (y - WALL_Y) * 0.5, fade = 1 - (y - WALL_Y) / 30;
        for (let x = Math.round(wx0 + s); x < wx1 + s; x++) if (bayer(x, y) < fade * 0.85) P.px(x, y, 0xfff6dc, 0.1);
      }
    }
    if (worn === 'husvagn') caravanFixtures(P, RIGHT, wins, wy0, wy1, night, hasExit, wall, wallDk);
    if (worn === 'hoghus') ettaFixtures(P, RIGHT, wins, wy0, wy1, night, hasExit, wall, wallDk);

    // avdelarvägg + mörker utanför lokalen
    if (RIGHT < FW) {
      for (let y = 5; y < FH; y++) for (let x = RIGHT; x < FW; x++) P.px(x, y, mix(0x17131c, 0x221c28, (bayer(x, y) - 0.5) * 0.4 + 0.5));
      for (let y = 5; y < FH; y++) {
        P.px(RIGHT - 3, y, mul(wallDk, 0.5)); P.px(RIGHT - 2, y, mix(wallDk, 0xffffff, 0.15));
        P.px(RIGHT - 1, y, wallDk);
      }
    }

    if (shabby) paintShabby(P, RIGHT, wall, wallDk, night, hasExit, roomDef);

    // ljuskäglor + AO
    if (!shabby && !worn) for (let sx = 60; sx < RIGHT - 20; sx += 85) P.ell(sx, WALL_Y + 23, 22, 10, 0xfff3d0, night ? 0.05 : 0.1, 4);
    for (let y = WALL_Y; y < WALL_Y + 4; y++) for (let x = 0; x < RIGHT; x++) {
      if (hasExit && x >= DOOR.cx - 13 && x < DOOR.cx + 13) continue;
      if (bayer(x, y) < 1 - (y - WALL_Y) / 4) P.px(x, y, 0x1a1426, 0.18);
    }
    P.box(0, 0, FW, FH, 0x0e0d12); P.box(1, 1, FW - 2, FH - 2, 0x1d1a20);
    for (let x = 0; x < FW; x++) for (let y = 0; y < 5; y++) P.px(x, y, 0x14121a);

    cache[key] = P.flush();
    return cache[key];
  };
}

// ================= utsikten genom fönstren =================
// Varje utsikt målas i rummets koordinater (P.clip = glaset), så att två fönster i samma
// rum ser ut över samma, sammanhängande landskap. x0..x1 × y0..y1 = glaset.
//   sky      – bara himmel (Lilla rummet, Lägenheten, Villan)
//   tomt     – husvagnens tomt i förorten: nätstängsel, grus, ett däck, höghusen långt bort
//   betong   – Förortsettan: höghuset mittemot, med grannar som rör sig i fönstren
//   tradgard – radhusets trädgård: plankstaket, äppelträd, grill, grannarnas tegeltak
//   stad     – takvåningens panorama: skylinen, TV-tornet, ån med bron och terrassen
function paintView(P, view, x0, x1, y0, y1, night, dirty) {
  if (view === 'tomt') return viewTomt(P, x0, x1, y0, y1, night);
  if (view === 'betong') return viewBetong(P, x0, x1, y0, y1, night);
  if (view === 'tradgard') return viewTradgard(P, x0, x1, y0, y1, night);
  if (view === 'stad') return viewStad(P, x0, x1, y0, y1, night);
  const sky0 = night ? 0x101838 : 0x8ed0ea, sky1 = night ? 0x1c2140 : 0xbfe6f2;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = mix(sky0, sky1, (y - y0) / (y1 - y0) + (bayer(x, y) - 0.5) * 0.08);
    if (!night && hash(x >> 2, y >> 1, 9) > 0.93) c = mix(c, 0xffffff, 0.5);
    if (night && hash(x, y, 10) > 0.985) c = 0xe8ecff;
    if (dirty && hash(x >> 1, y >> 1, 23) > 0.9) c = mix(c, 0x9a9070, 0.35); // smutsig ruta
    P.px(x, y, c);
  }
}
// himlen i utsikterna: dag ljusnar mot horisonten, natt med stjärnor (t = 0 överst, 1 vid horisonten)
function skyPx(x, y, t, night, seed) {
  if (night) {
    const c = mix(0x0a0f2a, 0x2c2a50, t + (bayer(x, y) - 0.5) * 0.12);
    return hash(x, y, seed) > 0.988 ? (hash(x, y, seed + 1) > 0.5 ? 0xfff6d8 : 0xb8c8f0) : c;
  }
  return mix(0x6aaee6, 0xd8ecf2, t + (bayer(x, y) - 0.5) * 0.1);
}
// små moln på fasta platser (samma moln i alla fönster)
function cloudsIn(P, x0, x1, y0, y1, seed) {
  for (let cx = Math.floor(x0 / 46) * 46 - 46; cx < x1 + 46; cx += 46) {
    const h = hash(cx, 1, seed);
    if (h < 0.35) continue;
    const mx = cx + Math.round(hash(cx, 2, seed) * 30), my = y0 + 3 + Math.round(hash(cx, 3, seed) * Math.max(0, y1 - y0 - 4)), s = 2 + Math.round(h * 3);
    for (let y = my - s; y <= my + 1; y++) for (let x = mx - s * 2; x <= mx + s * 2; x++) {
      const e = ((x - mx) / (s * 2)) ** 2 + ((y - my) / s) ** 2 + (hash(x, y, seed + 7) - 0.5) * 0.3;
      if (e < 1) P.px(x, y, y >= my ? 0xdce8f0 : 0xffffff, 0.9);
    }
  }
}
function viewTomt(P, x0, x1, y0, y1, night) {
  const H = y1 - y0, hz = y0 + Math.round(H * 0.6);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y < hz) c = skyPx(x, y, (y - y0) / (hz - y0), night, 11);
    else { // grus och ogräs
      c = mix(night ? 0x2e2c30 : 0x9a917c, night ? 0x242228 : 0x847a66, hash(x >> 1, y, 12));
      if (hash(x, y >> 1, 13) > 0.86) c = night ? 0x1e2a22 : [0x5a8a3a, 0x6a9a44, 0x4a7a32][(x + y) % 3];
    }
    P.px(x, y, c);
  }
  if (!night) cloudsIn(P, x0, x1, y0, hz - 14, 14);
  // förortens höghus långt bort
  for (let bx = Math.floor(x0 / 30) * 30 - 30; bx < x1; bx += 30) {
    const w = 18 + Math.round(hash(bx, 1, 15) * 8), h = 9 + Math.round(hash(bx, 2, 15) * 8), l = bx + Math.round(hash(bx, 3, 15) * 6);
    for (let y = hz - h; y < hz; y++) for (let x = l; x < l + w; x++) {
      let c = night ? 0x262a36 : mix(0xa4a8ac, 0xb8bcc0, hash(x >> 2, y, 16) * 0.5);
      if (x === l + w - 1) c = mul(c, 0.85);
      if ((x - l) % 3 === 1 && (y - (hz - h)) % 3 === 1 && y < hz - 1) c = night ? (hash(x, y, 17) > 0.6 ? 0xf0c878 : 0x1a1c26) : 0x7a8c9c;
      P.px(x, y, c);
    }
  }
  // gatlyktan på tomten (orange natriumljus på kvällen)
  const lx = 110;
  P.vl(lx, hz - 16, 20, night ? 0x2a2c30 : 0x5a5e62); P.hl(lx - 4, hz - 16, 5, night ? 0x2a2c30 : 0x5a5e62);
  P.rect(lx - 6, hz - 15, 3, 2, night ? 0xffc060 : 0x8a8e92);
  if (night) P.ell(lx - 5, hz - 11, 12, 9, 0xff9a40, 0.28, 4);
  // nätstängslet på stolpar
  const ft = hz - 7, fb = hz + 4;
  for (let y = ft; y <= fb; y++) for (let x = x0; x < x1; x++) if (((x + y) & 3) === 0 || ((x - y) & 3) === 0) P.px(x, y, night ? 0x4a4e56 : 0x6e7278, 0.7);
  P.hl(x0, ft, x1 - x0, night ? 0x3a3e46 : 0x5a5e64);
  for (let x = Math.floor(x0 / 20) * 20; x < x1; x += 20) P.vl(x, ft - 1, fb - ft + 3, night ? 0x3a3e46 : 0x55595e);
  // ett gammalt däck i gruset
  const tx = 94, ty = y1 - 5;
  for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 6; x <= tx + 6; x++) { const e = ((x - tx) / 6) ** 2 + ((y - ty) / 3) ** 2; if (e <= 1 && e > 0.3) P.px(x, y, e > 0.75 ? 0x16161a : 0x2a2a30); }
}
// Höghuset mittemot Förortsettan: rutnät av betongelement med ett fönster i varje
// (samma rutor används av grannarna som rör sig, se drawWindowLife)
const BET = { cw: 18, ch: 13 };
const betongTop = (y0, y1) => y0 + Math.round((y1 - y0) * 0.16);
function betongCells(x0, x1, y0, y1) {
  const top = betongTop(y0, y1), out = [];
  for (let cy = top + 3; cy + 5 < y1; cy += BET.ch) for (let cx = Math.floor(x0 / BET.cw) * BET.cw; cx < x1; cx += BET.cw) {
    const x = cx + 4, y = cy + 1, w = 10, h = 8;
    if (x + w <= x0 || x >= x1) continue;
    out.push({ x, y, w, h, key: cx * 1000 + cy });
  }
  return out;
}
const betongLit = (c, night) => { const k = hash(c.key, 3, 27); return { lit: night && k > 0.35, tv: night && k > 0.35 && k < 0.47 }; };
function viewBetong(P, x0, x1, y0, y1, night) {
  const top = betongTop(y0, y1);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y < top) c = night ? skyPx(x, y, (y - y0) / 8, true, 21) : mix(0xa8b8c4, 0xc8d0d4, (y - y0) / Math.max(1, top - y0) + (bayer(x, y) - 0.5) * 0.1);
    else { // betongelement med fogar och regnränder
      c = night ? mix(0x34363e, 0x3c3e46, hash(x >> 2, y >> 2, 22)) : mix(0xa8a498, 0xb4b0a4, hash(x >> 2, y >> 2, 22));
      const lx = ((x % BET.cw) + BET.cw) % BET.cw, ly = (y - top) % BET.ch;
      if (lx === 0 || ly === 0) c = mul(c, 0.84);
      if (hash(x, 0, 23) > 0.9 && hash(x, y >> 3, 24) > 0.3) c = mix(c, night ? 0x2a2a30 : 0x8a8272, 0.35);
      if (hash(x >> 1, y >> 1, 26) > 0.97) c = mul(c, 0.9);
    }
    P.px(x, y, c);
  }
  // takfoten med tv-antenner
  const ant = night ? 0x3a3c44 : 0x5a5e64;
  P.hl(x0, top, x1 - x0, night ? 0x24262e : 0x7a766c); P.hl(x0, top + 1, x1 - x0, night ? 0x2c2e36 : 0x969286);
  for (let ax = Math.floor(x0 / 37) * 37 + 11; ax < x1; ax += 37) { P.vl(ax, top - 6, 6, ant); P.hl(ax - 2, top - 5, 5, ant); P.hl(ax - 1, top - 3, 3, ant); }
  for (const c of betongCells(x0, x1, y0, y1)) {
    const { lit, tv } = betongLit(c, night);
    P.box(c.x - 1, c.y - 1, c.w + 2, c.h + 2, night ? 0x4a4c54 : 0xd8d4c8);
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
      let g;
      if (lit) g = tv ? mix(0x4a68b8, 0x7a98e0, (y - c.y) / c.h) : mix(0xf8d890, 0xd8903a, (y - c.y) / c.h);
      else if (night) g = mix(0x141824, 0x1e2230, (y - c.y) / c.h);
      else { g = mix(0x6a7c8c, 0x3a4a5a, (y - c.y) / c.h); const d = (x - c.x) + (y - c.y) * 0.6; if (d > 5 && d < 7) g = mix(g, 0xffffff, 0.3); }
      P.px(x, y, g);
    }
    // gardiner i vartannat fönster
    if (hash(c.key, 4, 27) > 0.5) {
      const gc = [0xd9433b, 0xf0c020, 0xe8e0d0, 0x3a7bd5, 0x46a35a][Math.floor(hash(c.key, 5, 27) * 5)];
      for (let y = c.y; y < c.y + c.h; y++) { P.px(c.x, y, gc, 0.8); P.px(c.x + c.w - 1, y, gc, 0.8); if (y < c.y + 2) { P.px(c.x + 1, y, gc, 0.7); P.px(c.x + c.w - 2, y, gc, 0.7); } }
    }
    // balkong med räcke under vartannat fönster, ibland en parabol eller tvätt på tork
    if (hash(c.key, 6, 27) > 0.45) {
      const by = c.y + c.h + 2;
      P.hl(c.x - 3, by, c.w + 6, night ? 0x2a2c34 : 0x8e8a80); P.hl(c.x - 3, by + 1, c.w + 6, night ? 0x1e2028 : 0x6a665e);
      for (let x = c.x - 3; x < c.x + c.w + 3; x += 2) P.px(x, by - 1, night ? 0x4a4c54 : 0x5a5e64);
      const r = hash(c.key, 7, 27);
      if (r > 0.7) { P.rect(c.x + c.w - 1, by - 4, 3, 3, night ? 0x8a8c94 : 0xf0f0ec); P.px(c.x + c.w, by - 3, night ? 0x5a5c64 : 0xb8b8b4); }
      else if (r > 0.4) for (let x = c.x; x < c.x + c.w; x++) if (x % 3) P.px(x, by - 2, [0xd9433b, 0xf4f1ea, 0x3a7bd5, 0xf0c020][x % 4], 0.9);
    }
  }
}
function viewTradgard(P, x0, x1, y0, y1, night) {
  const H = y1 - y0, roofY = y0 + Math.round(H * 0.3), fenceY = y0 + Math.round(H * 0.56), lawnY = y0 + Math.round(H * 0.8);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y < roofY) c = skyPx(x, y, (y - y0) / (roofY - y0), night, 31);
    else if (y < fenceY) { // grannarnas radhus: tegeltak och gul puts med fönster
      const ry = y - roofY;
      if (ry < 6) { c = night ? 0x3a2220 : ((y + (x >> 2)) & 1 ? 0xa04a32 : 0x8a3a28); if (ry === 0) c = night ? 0x2a1818 : 0x6a2a1c; }
      else {
        c = night ? 0x3a3630 : mix(0xe8d4a8, 0xdcc498, hash(x >> 2, y, 32));
        const lx = x % 22;
        if (lx === 0) c = mul(c, 0.8);
        if (lx >= 7 && lx <= 13 && ry >= 8 && ry <= 11) c = night ? (hash(x - lx, 1, 33) > 0.4 ? 0xf0c878 : 0x1c2030) : (lx === 10 ? 0xf0ece0 : 0x6a8aa8);
      }
    } else if (y < lawnY) { // plankstaketet
      const p = ((x % 4) + 4) % 4;
      c = p === 3 ? (night ? 0x1a1a14 : 0x5a3a20) : mix(night ? 0x3a2c20 : 0xb0804e, night ? 0x2e2218 : 0x8a5e38, (y - fenceY) / (lawnY - fenceY));
      if (y === fenceY + 3) c = mul(c, 0.82); // tvärslån
    } else { // gräsmattan med klipprandar
      c = ((x >> 3) & 1) ? (night ? 0x1a3020 : 0x5aa04a) : (night ? 0x1e3624 : 0x66ac52);
      if (hash(x, y, 34) > 0.9) c = mul(c, 0.85);
    }
    P.px(x, y, c);
  }
  if (!night) cloudsIn(P, x0, x1, y0, roofY - 6, 36);
  // häcken ovanför staketet
  for (let x = x0; x < x1; x++) { const h = 2 + Math.round(hash(x >> 1, 1, 35) * 2); for (let j = 0; j < h; j++) P.px(x, fenceY - 1 - j, j === h - 1 ? (night ? 0x1e3020 : 0x4a8a3a) : (night ? 0x16261a : 0x2e6a2e)); }
  // äppelträdet med en fågelholk
  const tx = 104, crownY = y0 + 9;
  P.rect(tx - 1, crownY + 6, 3, lawnY - crownY - 4, night ? 0x241a12 : 0x6a4424); P.vl(tx - 1, crownY + 6, lawnY - crownY - 4, night ? 0x2e2218 : 0x8a5a30);
  for (let y = crownY - 8; y <= crownY + 8; y++) for (let x = tx - 12; x <= tx + 12; x++) {
    const e = ((x - tx) / 12) ** 2 + ((y - crownY) / 8) ** 2 + (hash(x, y, 38) - 0.5) * 0.35;
    if (e > 1) continue;
    const lv = 1 - Math.hypot((x - tx + 4) / 14, (y - crownY + 4) / 10);
    let c = night ? (lv > 0.4 ? 0x1e3a24 : 0x142a1a) : (lv > 0.55 ? 0x8cc462 : lv > 0.3 ? 0x5a9e46 : lv > 0.1 ? 0x3a7e38 : 0x28602c);
    if (!night && hash(x, y, 39) > 0.94) c = 0xe0302a; // äpplen
    P.px(x, y, c);
  }
  P.rect(tx + 2, crownY + 9, 4, 4, night ? 0x3a2a1c : 0xc88a4a); P.px(tx + 3, crownY + 10, 0x2a1a10); P.hl(tx + 1, crownY + 8, 6, night ? 0x2a1e14 : 0x8a3a28);
  // grillen på gräsmattan (grannarna grillar på lördagar)
  const gx = 178, gy = lawnY + 3;
  for (let y = gy - 3; y <= gy; y++) for (let x = gx - 3; x <= gx + 3; x++) if (((x - gx) / 3.5) ** 2 + ((y - gy + 1) / 2.5) ** 2 <= 1) P.px(x, y, night ? 0x141418 : 0x2a2a30);
  P.hl(gx - 3, gy - 2, 7, night ? 0x2a2a30 : 0x4a4a54); P.px(gx, gy - 4, 0x8a8a94);
  P.vl(gx - 2, gy + 1, 3, 0x3a3a40); P.vl(gx + 2, gy + 1, 3, 0x3a3a40); P.vl(gx, gy + 1, 3, 0x3a3a40);
  if (night) P.ell(gx, gy - 2, 5, 3, 0xff6a2a, 0.35, 3);
  // rabatt med blommor längs nederkanten
  for (let x = x0; x < x1; x++) {
    P.px(x, y1 - 1, night ? 0x16261a : 0x2e6a2e);
    if (hash(x, 2, 37) > 0.55) P.px(x, y1 - 2 - (x & 1), night ? 0x5a4a60 : [0xd9433b, 0xf28bb3, 0xf0c020, 0xffffff, 0x8e5bd1][x % 5]);
  }
}
// Takvåningens panorama: var ligger horisonten, ån/bron och terrassen i fönstret?
const stadLayout = (y0, y1) => { const H = y1 - y0; return { hz: y0 + Math.round(H * 0.55), riv: y0 + Math.round(H * 0.7), deck: y1 - 5 }; };
const TOWER_X = 176; // TV-tornet mitt i panoramafönstret
function viewStad(P, x0, x1, y0, y1, night) {
  const { hz, riv, deck } = stadLayout(y0, y1);
  for (let y = y0; y < riv; y++) for (let x = x0; x < x1; x++) {
    let c = skyPx(x, y, (y - y0) / (hz - y0), night, 41);
    if (y > hz - 8) c = mix(c, night ? 0x4a3060 : 0xe8f0ee, (y - hz + 8) / 16); // dis/ljusskimmer vid horisonten
    P.px(x, y, c);
  }
  if (!night) cloudsIn(P, x0, x1, y0, hz - 14, 42);
  // stadens hus i tre lager: längst bort blekast
  const layer = (base, minH, maxH, seed, col, colN, lit) => {
    let x = Math.floor(x0 / 7) * 7 - 14;
    while (x < x1 + 14) {
      const w = 4 + Math.floor(hash(x, 1, seed) * 8), h = minH + Math.floor(hash(x, 2, seed) ** 1.6 * (maxH - minH));
      for (let y = base - h; y < base; y++) for (let xx = x; xx < x + w; xx++) {
        let c = night ? colN : col;
        if (xx === x + w - 1) c = mul(c, 0.86);
        if (y === base - h) c = night ? mul(colN, 0.8) : mix(col, 0xffffff, 0.25);
        if ((xx - x) % 2 === 1 && (y - (base - h)) % 3 === 2 && xx < x + w - 1 && y < base - 1) {
          c = night ? (hash(xx, y, seed + 5) < lit ? (hash(xx, y, seed + 6) > 0.3 ? 0xf8d890 : 0xd8e8ff) : mul(colN, 0.8)) : mix(c, 0x3a4a60, 0.35);
        }
        P.px(xx, y, c);
      }
      x += w + (hash(x, 3, seed) > 0.7 ? 1 : 0);
    }
  };
  layer(hz, 3, 11, 43, 0xb4c2d0, 0x262c48, 0.22);
  layer(hz + 3, 4, 16, 44, 0x8e9eb2, 0x1c2238, 0.34);
  // TV-tornet (lampan på spiran blinkar på kvällen, se drawWindowLife)
  const tc = night ? 0x2a3048 : 0x8a94a4;
  P.rect(TOWER_X - 1, hz - 24, 2, 26, tc); P.vl(TOWER_X - 2, hz - 8, 10, mul(tc, 0.9)); P.vl(TOWER_X + 1, hz - 8, 10, mul(tc, 0.9));
  P.rect(TOWER_X - 3, hz - 20, 6, 3, night ? 0x3a4260 : 0xa8b2c0); P.hl(TOWER_X - 3, hz - 18, 6, night ? 0xf0d890 : 0x5a6474);
  P.vl(TOWER_X, hz - 31, 7, night ? 0x3a4260 : 0x6a7484);
  // ån med bron
  for (let y = riv; y < riv + 5; y++) for (let x = x0; x < x1; x++) {
    let c = night ? mix(0x10183a, 0x182248, hash(x >> 2, y, 45)) : mix(0x3a7ab8, 0x5a9ad0, hash(x >> 2, y, 45));
    if (((x + y * 7) % 11) === 0) c = night ? 0x6a5a40 : 0xa8d8f8; // glitter/ljusens spegling
    P.px(x, y, c);
  }
  for (let x = Math.max(x0, 110); x < Math.min(x1, 252); x++) {
    P.px(x, riv - 1, night ? 0x2a2e3a : 0x5a5e6a); P.px(x, riv - 2, night ? 0x3a3e4a : 0x7a7e8a);
    const ax = (x - 110) % 20;
    if (ax === 0) P.vl(x, riv, 5, night ? 0x2a2e3a : 0x6a6e7a);
    else if (ax < 20) { const ay = riv + Math.round(Math.sin((ax / 20) * Math.PI) * -2 + 2); P.px(x, ay, night ? 0x2a2e3a : 0x6a6e7a); }
    if ((x - 110) % 12 === 6) { P.px(x, riv - 4, night ? 0xffe8a0 : 0x5a5e6a); P.px(x, riv - 3, night ? 0x2a2e3a : 0x5a5e6a); }
  }
  // de lägre hustaken nedanför terrassen
  for (let y = riv + 5; y < deck; y++) for (let x = x0; x < x1; x++) {
    const bx = Math.floor(x / 16), lx = x - bx * 16;
    let c = night ? [0x16181e, 0x1c1c24, 0x1a1a20][bx % 3] : [0x6a6a74, 0x7a6e66, 0x5e646e][bx % 3];
    if (lx === 0) c = mul(c, 0.7);
    if (y === riv + 5) c = night ? 0x24262e : mix(c, 0xffffff, 0.2);
    if (lx > 3 && lx < 7 && y === riv + 6 && hash(bx, 1, 46) > 0.4) c = night ? 0x2a2c34 : 0xb8bcc4; // fläktar på taken
    P.px(x, y, c);
  }
  // terrassen: trädäck och glasräcke
  for (let y = deck; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = ((x >> 2) & 1) ? (night ? 0x3a2a1e : 0x9a6a42) : (night ? 0x33251a : 0x8a5e3a);
    if ((x & 3) === 3) c = night ? 0x241a12 : 0x6a4428;
    P.px(x, y, c);
  }
  for (let y = deck - 7; y < deck; y++) for (let x = x0; x < x1; x++) P.px(x, y, 0xc8e4ec, night ? 0.08 : 0.16);
  P.hl(x0, deck - 8, x1 - x0, night ? 0x5a626c : 0xb8c0c8); P.hl(x0, deck - 7, x1 - x0, night ? 0x3a4048 : 0x8a929c);
  for (let x = Math.floor(x0 / 30) * 30 + 12; x < x1; x += 30) P.vl(x, deck - 7, 7, night ? 0x3a4048 : 0x8a929c);
}

// Det som lever utanför fönstren (ritas varje bildruta ovanpå bakgrunden, bara i glaset):
// grannarna i huset mittemot Förortsettan går omkring i sina rum och tittar på tv, bilar
// kör över bron och tornets flyglampa blinkar i takvåningen, grannkatten balanserar på
// radhusets staket och husvagnstomtens gatlykta fladdrar ibland.
function drawWindowLife(ctx, view, wins, wy0, wy1, t, night) {
  if (!wins.length || view === 'sky') return;
  for (const [x0, x1] of wins) {
    // fyll bara det som ligger i glaset
    const put = (x, y, w, h, col) => {
      const a = Math.max(x, x0), b = Math.min(x + w, x1), c = Math.max(y, wy0), d = Math.min(y + h, wy1);
      if (b > a && d > c) { ctx.fillStyle = col; ctx.fillRect(a, c, b - a, d - c); }
    };
    if (view === 'betong') {
      for (const c of betongCells(x0, x1, wy0, wy1)) {
        const { lit, tv } = betongLit(c, night), who = hash(c.key, 8, 27);
        const inCell = (x, y, w, h, col) => { // inom både fönsterrutan mittemot och vårt glas
          const a = Math.max(x, c.x), b = Math.min(x + w, c.x + c.w), e = Math.max(y, c.y), f = Math.min(y + h, c.y + c.h);
          if (b > a && f > e) put(a, e, b - a, f - e, col);
        };
        if (tv) inCell(c.x, c.y, c.w, c.h, ['rgba(160,190,255,0.35)', 'rgba(80,110,210,0.22)', 'rgba(210,225,255,0.3)', 'rgba(120,150,240,0.18)'][Math.floor(t * 2.6 + who * 13) % 4]);
        if (who < 0.4 || (night && !lit)) continue; // tomt rum, eller släckt (då syns ingen)
        const ph = t * (0.18 + hash(c.key, 9, 27) * 0.3) + who * 20;
        if (ph % 5 > 3.6) continue; // grannen har gått ut ur rummet en stund
        const u = Math.sin(ph * 1.9) * 0.5 + 0.5;
        const px = Math.round(c.x + 1 + u * (c.w - 5)), py = c.y + c.h - 7 + (Math.floor(t * 4 + who * 9) % 2);
        const skin = night ? '#4a3222' : '#c89070', shirt = night ? '#3a2418' : ['#d9433b', '#3a7bd5', '#46a35a', '#f0c020', '#8e5bd1'][Math.floor(who * 50) % 5];
        inCell(px, py, 2, 2, skin);             // huvudet
        inCell(px - 1, py + 2, 4, 4, shirt);    // kroppen
        if (hash(c.key, 10, 27) > 0.6) inCell(px + (Math.floor(t * 2 + who * 7) % 2 ? 3 : -2), py + 2, 1, 2, skin); // vinkar/diskar
      }
    } else if (view === 'stad') {
      const { hz, riv } = stadLayout(wy0, wy1);
      // bilar över bron (två filer), strålkastare på kvällen
      for (let i = 0; i < 7; i++) {
        const dirR = i % 2 === 0, v = 9 + (i % 3) * 3;
        const x = dirR ? 110 + ((t * v + i * 41) % 142) : 252 - ((t * v + i * 29) % 142);
        put(Math.round(x), riv - 3 + (dirR ? 0 : 1), 2, 1, night ? (dirR ? '#fff4c0' : '#ff5a44') : ['#c9323a', '#f0ece0', '#2d3a5c', '#f0c020'][i % 4]);
      }
      if (night && (t % 1.6) < 0.55) { put(TOWER_X, hz - 32, 1, 1, '#ff3a2a'); put(TOWER_X - 1, hz - 32, 3, 1, 'rgba(255,60,40,0.35)'); }
      // ett flygplan långt borta (blinkar på kvällen)
      const fx = ((t * 5) % 520) - 60, fy = wy0 + 6 + Math.round(Math.sin(t * 0.05) * 2);
      if (night) { if ((t % 1.1) < 0.3) put(Math.round(fx), fy, 1, 1, '#ffffff'); } else { put(Math.round(fx), fy, 3, 1, '#e8eef4'); put(Math.round(fx) + 1, fy - 1, 1, 1, '#e8eef4'); }
    } else if (view === 'tradgard') {
      // grannkatten promenerar längs staketet (och är borta en stund emellanåt)
      const H = wy1 - wy0, fenceY = wy0 + Math.round(H * 0.56);
      const cyc = t % 60;
      if (cyc < 34) {
        const x = Math.round(30 + cyc * 7), y = fenceY - 3, step = Math.floor(t * 5) % 2;
        const col = night ? '#16141a' : '#3a3438';
        put(x, y, 6, 2, col); put(x + 6, y - 2, 2, 2, col); put(x + 6, y - 3, 1, 1, col); put(x + 7, y - 3, 1, 1, col);
        put(x - 1, y - 1 - step, 1, 2, col);                       // svansen
        put(x + step, y + 2, 1, 1, col); put(x + 4 - step, y + 2, 1, 1, col); // tassarna
        if (night) put(x + 7, y - 2, 1, 1, '#e8e060');              // ögonen lyser
      }
    } else if (view === 'tomt' && night) {
      // natriumlyktan fladdrar ibland
      if ((t % 7) > 6.6 && Math.floor(t * 20) % 2) put(104, wy0 + Math.round((wy1 - wy0) * 0.6) - 16, 5, 3, 'rgba(20,14,30,0.55)');
    }
  }
}

// ---------- husvagnen ----------
// Linoleum i stora rutor, gulnad och sliten: ett gångstråk mitt i, fläckar och skarvar.
function caravanFloor(x, y, def) {
  const T = 12, yy = y - WALL_Y;
  const tx = Math.floor(x / T), ty = Math.floor(yy / T), lx = x - tx * T, ly = yy - ty * T;
  let c = ((tx + ty) & 1) ? def.floorA : def.floorB;
  c = mul(c, 0.96 + hash(tx, ty, 61) * 0.06);
  const wear = Math.max(0, 1 - Math.hypot((x - 70) / 60, (yy - 44) / 34));
  if (wear > 0 && bayer(x, y) < wear * 0.6) c = mix(c, 0xc8bca0, 0.25);
  const h = hash(x, y, 62);
  if (h > 0.95) c = mul(c, 0.9); else if (h < 0.03) c = mix(c, 0xffffff, 0.15);
  if (lx === 0 || ly === 0) c = mul(c, 0.82);
  if (hash(tx, ty, 63) > 0.86 && lx > 3 && lx < 9 && ly > 3 && ly < 9 && hash(x, y, 64) > 0.4) c = mul(c, 0.78);
  return c;
}
// Väggarna: gulnade plastpaneler med nitar under det rundade taket, träimiterad
// plastmatta längs nederkanten med en aluminiumlist, rostränder och silvertejp.
function paintCaravanWall(P, RIGHT, wall, wallDk) {
  const PANEL = 26, LOW = WALL_Y - 24;
  for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < RIGHT; x++) {
    let c;
    if (y < LOW) {
      c = mix(mul(wall, 0.7), wall, Math.min(1, (y - 5) / 12) + (bayer(x, y) - 0.5) * 0.1);
      const sx = x % PANEL;
      if (sx === 0) c = mul(c, 0.8); else if (sx === 1) c = mix(c, 0xffffff, 0.12);
      if (hash(x >> 1, y >> 1, 71) > 0.96) c = mul(c, 0.95);
      c = mix(c, 0xb09a60, 0.06 + (y - 5) / 500); // nikotingult
    } else if (y <= LOW + 1) c = y === LOW ? 0xc8ccd0 : 0x8a8e94; // aluminiumlisten
    else {
      const grain = hash((x + Math.round(Math.sin(y * 0.35 + x * 0.02) * 2)) >> 1, 0, 72);
      c = mix(wallDk, mul(wallDk, 0.78), grain > 0.7 ? 0.7 : grain > 0.4 ? 0.3 : 0);
      if (x % 13 === 0) c = mul(wallDk, 0.7);
      if (y >= WALL_Y - 2) c = mul(wallDk, 0.55);
    }
    P.px(x, y, c);
  }
  P.hl(4, 5, RIGHT - 4, mul(wall, 0.45)); P.hl(4, 6, RIGHT - 4, mul(wall, 0.58));
  for (let x = PANEL; x < RIGHT - 3; x += PANEL) for (let y = 12; y < LOW - 2; y += 9) { P.px(x, y, 0x8a8478); P.px(x + 1, y, 0xf0ece0); }
  for (let x = 8; x < RIGHT - 4; x += 9) { P.px(x, 9, 0x8a8478); P.px(x, 8, 0xf0ece0, 0.8); }
  caravanRust(P, PANEL * 3, 12, 14, 1); caravanRust(P, PANEL * 5, 12, 20, 2);
  // rostfläck vid golvlisten och silvertejp över en spricka
  for (let y = LOW + 2; y < WALL_Y - 2; y++) for (let x = RIGHT - 34; x < RIGHT - 18; x++) {
    const d = Math.hypot((x - (RIGHT - 26)) / 8, (y - (WALL_Y - 6)) / 7) + (hash(x, y, 74) - 0.5) * 0.5;
    if (d < 1) P.px(x, y, d < 0.5 ? 0x7a3a18 : 0x9a5226, d < 0.5 ? 0.8 : 0.5);
  }
  const tx = RIGHT - 30, ty = 24;
  P.line(tx - 4, ty - 6, tx + 3, ty + 9, mul(wall, 0.5));
  P.rect(tx - 5, ty, 12, 5, 0xb8bcc2); P.hl(tx - 5, ty, 12, 0xdce0e4); P.hl(tx - 5, ty + 4, 12, 0x8a8e94);
  P.rect(tx - 2, ty - 3, 5, 11, 0xb8bcc2, 0.9); P.vl(tx - 2, ty - 3, 11, 0xdce0e4, 0.8);
}
function caravanRust(P, x, y, len, seed) {
  P.px(x, y, 0x6a3418); P.px(x + 1, y, 0x9a5226);
  for (let i = 1; i < len; i++) {
    const a = 0.6 * (1 - i / len), xx = x + (hash(i >> 2, seed, 73) > 0.7 ? 1 : 0);
    P.px(xx, y + i, 0x8a4a22, a);
    if (i < len * 0.4) P.px(xx + 1, y + i, 0xb0642a, a * 0.6);
  }
}
// Kokvrån under fönstret (skåp, laminatskiva, två kokplattor, en bucklig kastrull och en
// liten diskho), rutiga gardiner på ett snöre, ett lysrör i taket, jackan på kroken vid
// dörren och en almanacka från 1987.
function caravanFixtures(P, RIGHT, wins, wy0, wy1, night, hasExit, wall, wallDk) {
  const [wx0, wx1] = wins[0] || [84, 118];
  caravanRust(P, wx0 - 3, wy1 + 3, 11, 5); caravanRust(P, wx1 + 2, wy1 + 3, 17, 6);
  // kokvrån
  const k0 = wx0, k1 = wx1, top = WALL_Y - 21;
  for (let y = top + 3; y < WALL_Y - 1; y++) for (let x = k0; x < k1; x++) {
    let c = mix(0x8a6a44, 0x7a5a3a, hash(x >> 1, 0, 75) * 0.7);
    if (x === k0 || x === k1 - 1 || x === (k0 + k1 >> 1)) c = 0x4a3420;
    if (y === top + 3) c = 0x5a4028;
    P.px(x, y, c);
  }
  P.rect(k0 + 1, WALL_Y - 2, k1 - k0 - 2, 1, 0x2a2018);
  const mid = k0 + k1 >> 1;
  P.rect(mid - 3, top + 8, 1, 4, 0xc8ccd0); P.rect(mid + 2, top + 8, 1, 4, 0xc8ccd0);
  P.vl(mid + 1, top + 4, WALL_Y - top - 6, 0x1a120c); // luckan står på glänt
  P.rect(k0 - 1, top, k1 - k0 + 2, 3, 0xc8c0b0); P.hl(k0 - 1, top, k1 - k0 + 2, 0xe0dace); P.hl(k0 - 1, top + 2, k1 - k0 + 2, 0x8a8478);
  // kokplattorna (vänster) och kastrullen
  P.rect(k0 + 2, top - 2, 15, 2, 0x1e1c20);
  for (const bx of [k0 + 5, k0 + 12]) { P.hl(bx - 2, top - 2, 5, 0x3a3438); P.hl(bx - 1, top - 1, 3, night ? 0x8a2a1a : 0x4a3a3a); }
  P.rect(k0 + 8, top + 4, 1, 1, 0xf0ece0); P.rect(k0 + 11, top + 4, 1, 1, 0xf0ece0);
  const px0 = k0 + 9;
  P.rect(px0, top - 7, 7, 5, 0xa8acb2); P.hl(px0, top - 7, 7, 0xd8dce0); P.vl(px0 + 6, top - 6, 4, 0x7a7e84); P.px(px0 + 2, top - 5, 0x8a8e94);
  P.hl(px0 + 7, top - 6, 4, 0x2a2a2e); P.hl(px0 - 1, top - 8, 9, 0x8a8e94);
  // diskhon (höger) med en droppande kran
  P.rect(k1 - 11, top, 8, 1, 0x7a7e84); P.vl(k1 - 7, top - 5, 5, 0xb8bcc2); P.hl(k1 - 9, top - 5, 3, 0xb8bcc2); P.px(k1 - 9, top - 4, 0x8ab8d8);
  // rutiga gardiner på ett snöre
  const sy = wy0 - 4;
  P.hl(wx0 - 7, sy, wx1 - wx0 + 14, 0x5a5e62);
  for (const [gx0, gx1, flip] of [[wx0 - 7, wx0 + 3, 0], [wx1 - 3, wx1 + 7, 1]]) {
    for (let y = sy + 1; y < wy0 + 16; y++) {
      const tie = y > wy0 + 8, inset = tie ? Math.min(4, Math.round((y - wy0 - 8) * 0.7)) : 0;
      for (let x = gx0; x < gx1; x++) {
        if (flip ? x > gx1 - 1 - inset : x < gx0 + inset) continue;
        const chk = ((x >> 1) + (y >> 1)) & 1;
        P.px(x, y, chk ? 0xc9423a : 0xf0e8d8);
      }
    }
    P.hl(gx0, wy0 + 16, gx1 - gx0, 0x8a2a24, 0.6);
  }
  // lysröret i taket
  const lx = Math.round(RIGHT / 2) - 10;
  P.rect(lx, 7, 22, 3, 0xe0dcd0); P.hl(lx, 9, 22, 0x9a968a); P.hl(lx + 1, 8, 20, night ? 0xfffbe0 : 0xf4f0e4);
  if (night) P.ell(lx + 11, 12, 30, 12, 0xf0f8ff, 0.2, 4);
  // jackan på kroken vid dörren
  if (hasExit) {
    const jx = 12, jy = 34;
    P.rect(jx + 4, jy - 2, 2, 2, 0x5a5e62);
    for (let y = 0; y < 22; y++) for (let x = 0; x < 11; x++) {
      const w = y < 4 ? 3 + y : y < 18 ? 9 + (y > 10 ? 1 : 0) : 10;
      const l = 5 - (w >> 1);
      if (x < l || x >= l + w) continue;
      let c = x === l || x === l + w - 1 ? 0x243a2a : 0x3a5a3e;
      if (x === 5 && y > 5) c = 0xa8acb2; // blixtlåset
      if (y > 12 && y < 15 && (x === l + 1 || x === l + w - 2)) c = 0x2a4430; // fickorna
      P.px(jx + x, jy + y, c);
    }
  }
  // almanacka från 1987 ovanför klädskåpet
  const ax = RIGHT - 24, ay = 16;
  P.rect(ax, ay, 11, 14, 0xf4efe0); P.rect(ax, ay, 11, 4, 0xc9323a); P.px(ax + 5, ay - 1, 0x3a3a40);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) P.px(ax + 2 + q * 2, ay + 6 + r * 2, r === 2 && q === 1 ? 0xc9323a : 0x8a8478);
  P.darken(ax + 11, ay + 1, 1, 14, 0.8); P.darken(ax + 1, ay + 14, 11, 1, 0.8);
}

// ---------- Förortsettan ----------
// 70-talstapet i bruna och orange ränder med ringar – solblekt upptill, smutsig nertill –
// med en sockel i stället för bröstpanel, ljusa fläckar där tavlor har hängt, en tapetvåd
// som släppt och en fuktfläck i taket.
function paintEttaWall(P, RIGHT, wall, wallDk) {
  const SKIRT = WALL_Y - 5;
  for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < RIGHT; x++) {
    let c;
    if (y >= SKIRT) { P.px(x, y, y === SKIRT ? mix(wallDk, 0xffffff, 0.25) : mul(wallDk, 0.85 - (y - SKIRT) * 0.06)); continue; }
    const band = Math.floor(x / 12) & 1, bx = x % 12;
    c = band ? mix(wall, 0xb88a50, 0.28) : mix(wall, 0xe8dcc0, 0.22);
    if (band) {
      const cy = ((y - 5) % 14) - 7, cx = bx - 6, r = Math.hypot(cx, cy);
      if (r > 2.2 && r < 3.6) c = mix(c, 0x8a4a22, 0.42);
      else if (r < 1.2) c = mix(c, 0xd8703a, 0.35);
    } else if ((bx === 5 || bx === 6) && ((y - 5) % 7) < 2) c = mix(c, 0x9a7a4a, 0.3);
    c = mix(c, 0xe8e0cc, Math.max(0, 0.22 - (y - 5) / 220));
    c = mix(c, 0x3a3226, Math.max(0, (y - 52) / 150));
    if (hash(x >> 1, y >> 1, 81) > 0.97) c = mul(c, 0.92);
    if (x % 48 === 47) c = mix(c, 0xf4ecdc, 0.45); // våderna
    P.px(x, y, c);
  }
  P.hl(4, 5, RIGHT - 4, mul(wall, 0.5)); P.hl(4, 6, RIGHT - 4, mul(wall, 0.7));
  // ljusa rektanglar där tavlor har hängt, med spikhålen kvar
  for (const [gx, gy, gw, gh] of [[RIGHT - 42, 20, 16, 13], [140, 24, 10, 12]]) {
    for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) P.px(x, y, mix(P.get(x, y), 0xf0e6d0, 0.3));
    P.px(gx + (gw >> 1), gy - 2, 0x3a3228);
  }
  // en tapetvåd har släppt i överkanten: fliken hänger ner, gipsen syns bakom
  const sx = 95;
  for (let i = 0; i < 9; i++) { for (let x = sx - i; x <= sx; x++) P.px(x, 6 + i, 0xd8d0c0); }
  for (let i = 0; i < 8; i++) for (let x = sx + 1; x < sx + 9 - i; x++) P.px(x, 7 + i, i === 7 || x === sx + 8 - i ? 0x8a7a58 : 0xe6dcc6);
  // fuktfläcken i taket
  for (let y = 6; y < 24; y++) for (let x = RIGHT - 30; x < RIGHT - 4; x++) {
    const d = Math.hypot((x - (RIGHT - 16)) / 13, (y - 8) / 11) + (hash(x, y, 82) - 0.5) * 0.3;
    if (d < 1) P.px(x, y, 0x6a5430, d > 0.82 ? 0.35 : 0.18);
  }
}
// Radiatorn under vänstra fönstret (med en strumpa på tork), pentryt under det högra
// (laminatskiva, två plattor, diskho med kran, diskställ, skåp), plafonden i taket med
// döda flugor, strömbrytare, porttelefon och ett eluttag.
function ettaFixtures(P, RIGHT, wins, wy0, wy1, night, hasExit, wall, wallDk) {
  const [a, b] = [wins[0], wins[1] || null];
  if (a) {
    const r0 = a[0] + 3, r1 = a[1] - 3, rt = WALL_Y - 20, rb = WALL_Y - 7;
    for (let y = rt; y < rb; y++) for (let x = r0; x < r1; x++) {
      let c = (x - r0) % 3 === 2 ? 0xbcb6aa : 0xe6e2d8;
      if (y === rt) c = 0xf6f4ee; if (y === rb - 1) c = 0x9a948a;
      if (hash(x, y, 83) > 0.97) c = 0x9a6a3a; // rostprickar
      P.px(x, y, c);
    }
    P.vl(r0 - 1, rt + 6, WALL_Y - rt - 6, 0xd8d4ca); P.vl(r1, rt + 6, WALL_Y - rt - 6, 0xb8b4aa);
    P.rect(r0 - 3, rt + 8, 3, 3, 0xc9323a); P.px(r0 - 2, rt + 9, 0x8a1a20);
    P.darken(r0, rb, r1 - r0, 2, 0.8);
    // strumpan
    const s = r0 + 8;
    P.rect(s, rt - 1, 4, 5, 0xf0c020); P.hl(s, rt + 1, 4, 0xd9433b); P.rect(s + 1, rt + 4, 3, 2, 0xf0c020); P.px(s + 3, rt + 5, 0xd9433b);
  }
  if (b) {
    const k0 = b[0] - 2, k1 = b[1] + 2, top = WALL_Y - 24;
    for (let y = top + 3; y < WALL_Y - 2; y++) for (let x = k0; x < k1; x++) {
      let c = mix(0x8a5a32, 0x7a4e2a, hash(x >> 1, y >> 3, 84) * 0.6);
      if ((x - k0) % 12 === 0) c = 0x4a2e18;
      if (y === top + 3) c = 0x5a3a20;
      P.px(x, y, c);
    }
    for (let x = k0 + 6; x < k1; x += 12) P.rect(x, top + 7, 2, 1, 0xe8b040);
    P.rect(k0, WALL_Y - 2, k1 - k0, 2, 0x1e1812);
    P.rect(k0 - 1, top, k1 - k0 + 2, 3, 0xd8843a); P.hl(k0 - 1, top, k1 - k0 + 2, 0xf0a860); P.hl(k0 - 1, top + 2, k1 - k0 + 2, 0x8a4a1a);
    // spisen med två plattor och ugnslucka
    P.rect(k0 + 1, top - 1, 16, 2, 0x2a2a2e);
    for (const px of [k0 + 5, k0 + 12]) { P.hl(px - 2, top - 1, 5, 0x4a4a52); P.hl(px - 1, top - 2, 3, 0x3a3a40); }
    P.rect(k0 + 1, top + 4, 16, 11, 0xe8e4dc); P.rect(k0 + 3, top + 7, 12, 6, 0x2a2a30); P.hl(k0 + 3, top + 6, 12, 0xb8b4aa);
    for (let i = 0; i < 4; i++) P.px(k0 + 3 + i * 4, top + 4, 0x2a2a2e);
    // diskhon med kran och diskstället
    const sx = k1 - 16;
    P.rect(sx, top, 12, 1, 0x7a7e84); P.hl(sx + 1, top + 1, 10, 0x5a5e64);
    P.vl(sx + 6, top - 6, 6, 0xb8bcc2); P.hl(sx + 4, top - 6, 3, 0xb8bcc2); P.px(sx + 4, top - 5, 0x9ac8e8);
    P.rect(sx - 10, top - 5, 8, 5, 0xc8ccd0, 0.5);
    for (const [dx, h] of [[1, 5], [3, 6], [5, 5]]) P.vl(sx - 10 + dx, top - h, h, 0xf6f4ee);
    P.rect(sx - 3, top - 3, 2, 3, 0xd9433b);
  }
  // plafonden i taket (med döda flugor i)
  const px = a && b ? Math.round((a[1] + b[0]) / 2) : Math.round(RIGHT / 2);
  P.rect(px - 6, 5, 12, 2, 0xd8d4c8); P.rect(px - 5, 7, 10, 2, night ? 0xfff6d8 : 0xf0ece0); P.hl(px - 4, 9, 8, night ? 0xf0e0b0 : 0xd8d2c4);
  P.px(px - 2, 8, 0x3a3228); P.px(px + 2, 7, 0x3a3228);
  if (night) { P.ell(px, 12, 34, 14, 0xfff0c0, 0.22, 4); P.ell(px, WALL_Y + 18, 40, 10, 0xfff3d0, 0.08, 4); }
  if (hasExit) {
    // porttelefon och strömbrytare bredvid dörren, med smuts runt omkring
    const ix = DOOR.x1 + 5;
    P.ell(ix + 2, 50, 7, 9, 0x3a3226, 0.12, 3);
    P.rect(ix, 34, 6, 9, 0xe0d8c0); P.box(ix, 34, 6, 9, 0x9a9278); for (let y = 36; y < 39; y++) for (let x = ix + 1; x < ix + 5; x += 2) P.px(x, y, 0x5a5448); P.px(ix + 3, 41, 0xc9323a);
    P.rect(ix + 1, 48, 4, 6, 0xe8e2cc); P.box(ix + 1, 48, 4, 6, 0xa8a088); P.rect(ix + 2, 50, 2, 2, 0xc8c0a8);
  }
  // eluttag nere vid sockeln
  const ox = a ? a[1] + 1 : 110;
  P.rect(ox, WALL_Y - 13, 5, 5, 0xe8e2cc); P.box(ox, WALL_Y - 13, 5, 5, 0xa8a088); P.px(ox + 1, WALL_Y - 11, 0x3a3228); P.px(ox + 3, WALL_Y - 11, 0x3a3228);
}
// takvåningens infällda spotlights i taket
function ceilingSpots(P, RIGHT, night) {
  for (let x = 40; x < RIGHT - 20; x += 64) {
    P.rect(x - 2, 6, 5, 2, 0xc8ccd4); P.hl(x - 1, 7, 3, night ? 0xfff6d8 : 0xf4f4f0);
    if (night) P.ell(x, 14, 12, 9, 0xfff0c8, 0.2, 4);
  }
}

// ---------- Lilla rummets förfall ----------
// Sprickor, fuktfläckar, flagnande tapet, spindelväv i hörnen, en naken glödlampa
// (lyser på natten) och slitet golv. Allt deterministiskt ur hash().
function paintShabby(P, RIGHT, wall, wallDk, night, hasExit, roomDef) {
  const crackDk = mul(wall, 0.42), crackLt = mix(wall, 0xffffff, 0.18);
  // sprickor: taggiga linjer nedåt från taklisten och ut från fönstret
  const crack = (x, y, len, seed, drift = 0) => {
    for (let i = 0; i < len; i++) {
      const h = hash(i, seed, 31);
      x += h < 0.3 ? -1 : h > 0.72 ? 1 : 0;
      x += drift && i % 3 === 0 ? drift : 0;
      y += hash(i, seed, 32) > 0.25 ? 1 : 0;
      if (y >= WALL_Y - 3 || x < 5 || x > RIGHT - 5) break;
      P.px(x, y, crackDk); P.px(x + 1, y, crackLt, 0.7);
      if (h > 0.9 && i > 3) { P.px(x - 1, y + 1, crackDk); P.px(x - 2, y + 2, crackDk, 0.7); } // förgrening
    }
  };
  crack(RIGHT - 60, 6, 34, 1); crack(RIGHT - 58, 20, 10, 5, 1);
  crack(12, 6, 26, 2, -0);
  crack(122, 30, 22, 3, 1);
  if (hasExit) crack(DOOR.x1 + 6, 6, 18, 4);
  // fuktfläckar: gulbruna, ditherade blaffor
  const stain = (cx, cy, rx, ry, seed) => {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (hash(x, y, seed) - 0.5) * 0.35;
      if (d >= 1 || y < 6 || y >= WALL_Y - 3 || x < 5 || x >= RIGHT - 4) continue;
      const a = d > 0.75 ? (bayer(x, y) < 1 - (d - 0.75) * 4 ? 0.35 : 0) : 0.35 + (1 - d) * 0.25;
      if (a) P.px(x, y, 0x5a4a28, a);
      if (d > 0.85 && d < 0.98 && bayer(x, y) > 0.5) P.px(x, y, 0x3e3220, 0.4); // mörk kant
    }
  };
  stain(RIGHT - 30, 14, 14, 8, 41); stain(RIGHT - 24, 40, 9, 12, 42); stain(70, 62, 8, 5, 43);
  // flagnande tapet: en flik i övre högra hörnet som hänger ner (baksidan gulvit, väggen bakom mörk)
  const fx0 = RIGHT - 22, fy0 = 6;
  for (let i = 0; i < 12; i++) {
    for (let x = fx0 + i; x < RIGHT - 5; x++) { const y = fy0 + i; if (y < WALL_Y - 3) P.px(x, y, mul(wallDk, 0.55)); } // bar vägg
  }
  for (let i = 0; i < 11; i++) { // fliken
    const y = fy0 + 12 + i, x0 = fx0 + i, x1 = fx0 + 12 + Math.max(0, 6 - i);
    for (let x = x0; x <= x1 && x < RIGHT - 5; x++) if (y < WALL_Y - 3) P.px(x, y, x === x0 || x === x1 || i === 10 ? 0x8a7a58 : 0xe6dcc0);
  }
  // spindelväv i övre hörnen: strålar + bågar
  const web = (cx, cy, dirX, r) => {
    const col = mix(wall, 0xffffff, 0.55);
    for (const a of [0, 0.3, 0.62, 0.95, 1.27, 1.57]) {
      for (let d = 2; d < r; d++) {
        const x = Math.round(cx + Math.cos(a) * d * dirX), y = Math.round(cy + Math.sin(a) * d);
        if (y >= 6 && x > 4 && x < RIGHT - 4 && (d + (a * 7 | 0)) % 2 === 0) P.px(x, y, col, 0.75);
      }
    }
    for (const rr of [5, 9, 13, 17]) {
      if (rr >= r) break;
      for (let a = 0; a <= 1.57; a += 0.08) {
        const sag = Math.sin(a * 2) * 1.5;
        const x = Math.round(cx + Math.cos(a) * rr * dirX), y = Math.round(cy + Math.sin(a) * rr + sag);
        if (y >= 6 && x > 4 && x < RIGHT - 4) P.px(x, y, col, 0.6);
      }
    }
  };
  web(5, 5, 1, 20); web(RIGHT - 5, 5, -1, 16);
  // naken glödlampa på sladd från taket – bredvid fönstret och dörren, inte framför dem
  const clear = (x) => x > 12 && x < RIGHT - 12 && !roomDef.windows.some(([a, b]) => x + 5 > a - 4 && x - 5 < b + 4) && !(hasExit && x + 5 > DOOR.x0 - 3 && x - 5 < DOOR.x1 + 3);
  const bx = [Math.round(RIGHT * 0.5) + 8, 70, RIGHT - 40, 20].find(clear) ?? Math.round(RIGHT * 0.5), by = 24;
  for (let y = 5; y < by - 4; y++) P.px(bx, y, 0x2a2420);
  P.rect(bx - 1, by - 5, 3, 3, 0x3a3530); P.px(bx - 1, by - 5, 0x5a5550);
  const glass = night ? 0xfff0a8 : 0xe4dfc8, glassDk = night ? 0xe6c860 : 0xb8b09a;
  P.rect(bx - 2, by - 2, 5, 5, glass); P.px(bx - 2, by - 2, glassDk); P.px(bx + 2, by - 2, glassDk); P.px(bx - 2, by + 2, glassDk); P.px(bx + 2, by + 2, glassDk);
  P.px(bx + 1, by + 1, glassDk); P.px(bx - 1, by - 1, 0xffffff);
  P.rect(bx - 1, by + 3, 3, 1, glassDk);
  if (night) { P.ell(bx, by + 2, 28, 16, 0xffe9a0, 0.16, 3); P.ell(bx, by, 9, 7, 0xfff6c8, 0.35, 2); P.ell(bx, WALL_Y + 14, 34, 9, 0xfff3d0, 0.1, 4); }
  else P.ell(bx, WALL_Y + 20, 26, 9, 0xfff3d0, 0.06, 4);
  // golvet: repor och en gammal fläck vid dörren
  const scratch = 0x6a5a40;
  for (let i = 0; i < 9; i++) {
    const sx = 14 + ((hash(i, 3, 51) * (RIGHT - 40)) | 0), sy = WALL_Y + 12 + ((hash(i, 7, 52) * (FH - WALL_Y - 24)) | 0);
    const len = 4 + ((hash(i, 9, 53) * 8) | 0), dx = hash(i, 11, 54) > 0.5 ? 1 : -1;
    for (let j = 0; j < len; j++) P.px(sx + j * dx, sy + (j >> 1), scratch, 0.5);
  }
  for (let y = FH - 30; y < FH - 12; y++) for (let x = RIGHT - 46; x < RIGHT - 18; x++) {
    const d = Math.hypot((x - (RIGHT - 32)) / 14, (y - (FH - 21)) / 9) + (hash(x, y, 55) - 0.5) * 0.3;
    if (d < 1 && bayer(x, y) < 1.1 - d) P.px(x, y, 0x4a3a24, 0.28);
  }
  // musfläck vid golvlisten
  for (let x = 8; x < 20; x++) P.px(x, WALL_Y, 0x2a2018, 0.5);
  P.rect(9, WALL_Y - 5, 5, 5, 0x1a1418); P.px(11, WALL_Y - 6, 0x1a1418); P.px(10, WALL_Y - 6, 0x1a1418);
}
// Spindeln: sitter i väven uppe till höger och firar sig ibland ner på en tråd,
// hänger och gungar lite och klättrar upp igen. Ritas varje bildruta (period 19 s).
function drawSpider(ctx, RIGHT, t) {
  const cx = RIGHT - 14, y0 = 12;
  const ph = t % 19;
  let dy = 0;
  if (ph < 1.6) dy = (ph / 1.6) * 16;
  else if (ph < 4.2) dy = 16 + Math.sin((ph - 1.6) * 3) * 1.2;
  else if (ph < 6) dy = 16 * (1 - (ph - 4.2) / 1.8);
  const sy = Math.round(y0 + dy), sx = cx + (ph > 1.6 && ph < 4.2 ? Math.round(Math.sin((ph - 1.6) * 3) * 1.5) : 0);
  if (dy > 0.5) { ctx.fillStyle = 'rgba(235,235,225,0.55)'; ctx.fillRect(sx, y0 - 4, 1, sy - y0 + 4); }
  ctx.fillStyle = '#1a1418';
  ctx.fillRect(sx - 1, sy, 3, 2); ctx.fillRect(sx, sy - 1, 1, 1);
  // ben
  const leg = dy > 0.5 && ((t * 6) | 0) % 2 ? 1 : 0;
  ctx.fillRect(sx - 3, sy + leg, 2, 1); ctx.fillRect(sx + 2, sy + leg, 2, 1);
  ctx.fillRect(sx - 3, sy + 2 - leg, 1, 1); ctx.fillRect(sx + 3, sy + 2 - leg, 1, 1);
  ctx.fillRect(sx - 2, sy - 1, 1, 1); ctx.fillRect(sx + 2, sy - 1, 1, 1);
}

function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?') + 6;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y | 0, w, 9);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 3, (y | 0) + 2, c.fg);
}

export function emoteBubble(ctx, x, y, e, k = 1) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 9 * k | 0, y - 15 * k, 18 * k, 16 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8 * k | 0, y - 14 * k, 16 * k, 14 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - k | 0, y, 3 * k, 3 * k);
  ctx.font = `${10 * k}px "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y - 7 * k);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

// Kylskåpet: ät något du köpt. Att äta tar en kvart.
function openFridge(A) {
  const g = A.game;
  const items = Object.entries(g.fridge).filter(([, n]) => n > 0);
  const body = items.length
    ? `<p style="font-size:19px;margin-top:0">Mätthet: <b>${Math.round(g.hunger)}/100</b></p><div class="plist">${items.map(([id, n]) => {
      const f = foodOf(id);
      return `<div class="prow"><span style="font-size:28px;text-align:center">${f.icon}</span>
        <span class="nm">${f.name} ×${n}<br><small class="sp">+${f.fill} mätthet</small></span>
        <button class="btn btn-small btn-go" data-eat="${id}">Ät</button></div>`;
    }).join('')}</div>`
    : `<p style="font-size:20px">Kylskåpet är tomt! 🕸️<br><small>Gå till MAT-butiken i Pixelstaden och handla.</small></p>`;
  const dlg = openModal('🧊 Kylskåpet', body, [{ label: 'Stäng', onClick: closeModal }]);
  dlg.querySelectorAll('[data-eat]').forEach((b) => (b.onclick = () => {
    const f = foodOf(b.dataset.eat);
    if (A.game.eatFromFridge(b.dataset.eat)) { play('ok'); toast(`${f.icon} Mums! +${f.fill} mätthet`, 'good'); openFridge(A); }
  }));
}
