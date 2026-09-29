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
//
// Badrummen (Carl 2026-09-29: "toan aldrig mitt i rummet"): varje bostad har ett eget
// BADRUM (husvagnen en TOA-skrubb) som sista delrum, med dörr i bakväggen från ett av
// rummen (PLANS …bath/doors) och eget kakel, klinker, handdukar och lampa (BATH,
// paintBathWall, bathFixtures).
// Toaletten och handfatet står där i startmöbleringen – en sparad bostad där toan står
// i rummet får behålla den, och badrummet seedas då utan en toalett till (seedFor).
//
// Sömnen (scene.bedtime, anropas av A.sleepFlow i main.js och av golvmadrassen): har man
// gått fram till sängen lägger sig figuren under täcket (sleeperArt: samma sprite som när
// man går, med slutna ögon, huvudet på kudden), lamporna släcks, zzz stiger, månen lyser
// genom fönstren, sedan gryr det, figuren kliver upp och först då räknas natten
// (onWake: g.sleep + veckan). Klockan står still under tiden; ett klick spolar fram.
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
import { itemBox, itemSolid, PET_ITEMS } from '../pets/items.js';
import { openWeek } from '../core/week.js';

// Husdjursprylens fotavtryck på golvet – samma mått som lagret (js/pets/layer.js footprint)
// ställer ut prylar efter: korgar/lådor/bur/klösträd har ett eget (itemSolid), skålar,
// säckar och leksaker är prylens bredd × högst 5 px upp från fotlinjen.
function petFoot(k) {
  const s = itemSolid(k);
  if (s) return s;
  const d = PET_ITEMS[k] || { w: 8, h: 5 };
  return { x0: -(d.w >> 1), y0: -Math.min(5, d.h), x1: d.w - (d.w >> 1), y1: 0 };
}

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
// tipset om att toan kan flyttas in i badrummet visas en gång per spelomgång (fitRoom)
let toiletHinted = false;

export const ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (ATLAS) ATLAS.src = 'assets/interior.png';

// Bostädernas delrum: tema + fönster per rum. partition = hur bred lokalen är.
// shabby = Lilla rummet: sprickor, fuktfläckar, flagnande tapet, spindelväv, naken
// glödlampa och slitet golv (de finare bostäderna slipper). worn = 'husvagn' | 'hoghus':
// egen sjabbighet (rost och nitar / sliten tapet och radiator). view = vad man ser
// genom fönstren: 'sky' (standard), 'tomt', 'betong', 'tradgard', 'stad'. winY = glasets
// över-/underkant (takvåningen har högre fönster). Ordningen är billigast → dyrast.
// outside = vad som ritas UTANFÖR en smal lokal så att hela 384×216 används (Carls
// mobilfyllningsregel): 'gard' = husvagnens gårdsplätt, 'trapphus' = Förortsettans
// trapphus. Lokaler utan outside och partition < 384 beskärs i stället med contentBox.
//
// Badrummet (bath) är alltid det SISTA delrummet (deco-nycklarna hem:N för de gamla
// rummen ändras aldrig). doors = { delrum: dörrens vänsterkant } – bara de rummen har en
// dörr dit, på en plats som är fri i startmöbleringen; badrummet har dörrar tillbaka
// till just dem. Ett delrum kan ha egen partition, outside, winY och view (frostat glas i
// badrummen). Ett badrum är smalare än lokalen bara där utsidan (gården, trapphuset) fyller
// resten av skärmen – annars är det lika brett som lokalen, så att mobilfyllningen inte får
// större svarta fält i badrummet än i rummen. tiles = kakelstilen (BATH), towels = handdukskrokarnas x,
// lamp = taklampan. fixAt = var husvagnens/Ettans fasta detaljer (almanackan, tejpen,
// fuktfläcken …) sitter: lokalerna förlängdes åt höger för dörren till toan/badrummet.
const PLANS = {
  husvagn: {
    partition: 184, fixAt: 148, worn: 'husvagn', outside: 'gard',
    rooms: [
      { name: 'HUSVAGNEN', wall: 0xd8ccb0, wallDk: 0x8c7c62, floorA: 0x9c8c70, floorB: 0x80705a, windows: [[84, 118]], view: 'tomt' },
      { name: 'TOA', bath: true, doors: { 0: 144 }, partition: 124, wall: 0xd8ccb0, wallDk: 0x8c7c62, floorA: 0x9c8c70, floorB: 0x80705a, windows: [], towels: [64], lamp: 'lysror' },
    ],
  },
  rum: {
    partition: 176, shabby: true,
    rooms: [
      { name: 'RUMMET', wall: 0x8c7a62, wallDk: 0x6a5c48, floorA: 0xcbb894, floorB: 0xb09a74, windows: [[80, 120]] },
      { name: 'BADRUM', bath: true, tiles: 'sliten', doors: { 0: 138 }, wall: 0xe2ddd0, wallDk: 0xa39a86, floorA: 0x9c968a, floorB: 0x8c8678, windows: [[70, 92]], winY: [16, 34], view: 'frost', towels: [16], lamp: 'glodlampa' },
    ],
  },
  hoghus: {
    partition: 284, fixAt: 244, worn: 'hoghus', outside: 'trapphus',
    rooms: [
      { name: 'ETTAN', wall: 0xb4ac9c, wallDk: 0x787064, floorA: 0xb8a88a, floorB: 0x9e8e72, windows: [[72, 116], [150, 198]], view: 'betong' },
      { name: 'BADRUM', bath: true, tiles: '70tal', doors: { 0: 246 }, partition: 196, wall: 0xc88a3a, wallDk: 0x6a4020, floorA: 0x7a5236, floorB: 0x6a4630, windows: [[94, 118]], winY: [16, 36], view: 'frost', towels: [134], lamp: 'plafond' },
    ],
  },
  lagenhet: {
    partition: 310,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0x6e88a0, wallDk: 0x4e6478, floorA: 0xd9cbaf, floorB: 0xc0ac88, windows: [[80, 120], [134, 174]] },
      { name: 'SOVRUM', wall: 0x8a7f9a, wallDk: 0x685e78, floorA: 0xd0c2b0, floorB: 0xb8a892, windows: [[100, 140]] },
      { name: 'BADRUM', bath: true, tiles: 'vit', doors: { 0: 178 }, wall: 0xf0f0ea, wallDk: 0xc4c4bc, floorA: 0xb4b8bc, floorB: 0xa4a8ac, windows: [[96, 126], [206, 236]], winY: [16, 38], view: 'frost', towels: [146], lamp: 'plafond' },
    ],
  },
  radhus: { // hela bredden (mobilfyllningen) – tre trädgårdsfönster i rad i vardagsrummet
    partition: 0,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xd8c8a4, wallDk: 0xa08c68, floorA: 0xdcc8a4, floorB: 0xc2ac86, windows: [[80, 130], [150, 200], [284, 326]], view: 'tradgard' },
      { name: 'SOVRUM', wall: 0xa4b6c6, wallDk: 0x788a9a, floorA: 0xd6c8b2, floorB: 0xbeb096, windows: [[110, 160], [250, 300]], view: 'tradgard' },
      { name: 'BADRUM', bath: true, tiles: 'bla', doors: { 1: 30 }, wall: 0xa6cfe0, wallDk: 0x7aa4b8, floorA: 0xf0eee8, floorB: 0x6a9ec0, windows: [[150, 186], [250, 286]], winY: [16, 38], view: 'frost', towels: [128, 312], lamp: 'plafond' },
    ],
  },
  villa: {
    partition: 0, lyx: true,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xc4b190, wallDk: 0x9a8a6a, floorA: 0xefe6d2, floorB: 0xd9ccb2, windows: [[80, 120], [134, 172], [240, 280]] },
      { name: 'SOVRUM', wall: 0xb8a0a8, wallDk: 0x907880, floorA: 0xe8ded0, floorB: 0xd2c4b2, windows: [[110, 150], [210, 250]] },
      { name: 'KÖK', wall: 0xa8b8a0, wallDk: 0x808f78, floorA: 0xe2e6da, floorB: 0xc8cec0, windows: [[110, 150], [230, 270]] },
      { name: 'BADRUM', bath: true, tiles: 'marmor', doors: { 1: 30 }, wall: 0xf2eee8, wallDk: 0xb8ae9c, floorA: 0xece6da, floorB: 0xdcd4c6, windows: [[250, 296]], winY: [16, 40], view: 'frost', towels: [180, 314], lamp: 'spots' },
    ],
  },
  takvaning: {
    partition: 0, lyx: true, winY: [12, 56],
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xe6dcc8, wallDk: 0xb0a284, floorA: 0xf2eee6, floorB: 0xdcd6cc, windows: [[70, 280]], view: 'stad' },
      { name: 'SOVRUM', wall: 0x9c8cac, wallDk: 0x6e6082, floorA: 0xe8e0d4, floorB: 0xd2c8b8, windows: [[100, 150], [200, 250]], view: 'stad' },
      { name: 'KÖK', wall: 0xd2dad2, wallDk: 0x8a9a8c, floorA: 0xe8eae2, floorB: 0xcccec4, windows: [[100, 150], [230, 280]], view: 'stad' },
      { name: 'BADRUM', bath: true, tiles: 'skiffer', doors: { 1: 30 }, wall: 0x3e4248, wallDk: 0x2a2d32, floorA: 0x34373c, floorB: 0x2c2f34, windows: [[160, 272]], view: 'stad', towels: [128], lamp: 'spots' },
    ],
  },
};
const DOOR_W = 30; // dörrarna i bakväggen (skylten ovanför visar rummet bakom)
// det som syns utanför ett smalt delrum (badrummet kan ha ett eget)
const outsideOf = (plan, def) => (def.outside !== undefined ? def.outside : plan.outside) || null;

// Startmöbleringen per bostad och delrum. fx = startmöbel (kan flyttas, inte säljas).
const SEEDS = {
  'husvagn:0': [ // brits, litet kylskåp och klädskåp – kokvrån sitter i väggen under fönstret
    { k: 'enkelsang', v: 2, x: 12, y: 150, fx: 1 }, { k: 'kylskap', v: 0, x: 66, y: 94, fx: 1 },
    { k: 'kladskap', v: 1, x: 118, y: 94, fx: 1 }, { k: 'koksbord', v: 0, x: 80, y: 176 }, { k: 'pall', v: 0, x: 108, y: 180 },
    { k: 'lillmatta', v: 6, x: 38, y: 206 }, { k: 'soptunna', v: 0, x: 130, y: 206 },
  ],
  'rum:0': [ // garderoben och kylskåpet under fönstret, BADRUM-dörren längst till höger (dasset står i badrummet)
    { k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 71, y: 96, fx: 1 },
    { k: 'kylskap', v: 0, x: 118, y: 94, fx: 1 },
  ],
  'hoghus:0': [ // ett rum och kök: pentryt sitter under det högra fönstret, radiatorn under det vänstra
    { k: 'enkelsang', v: 4, x: 14, y: 140, fx: 1 }, { k: 'kylskap', v: 0, x: 122, y: 94, fx: 1 },
    { k: 'garderob', v: 10, x: 204, y: 96, fx: 1 },
    { k: 'koksbord', v: 0, x: 150, y: 175 }, { k: 'matstol', v: 0, x: 134, y: 173 }, { k: 'matstol', v: 0, x: 178, y: 173 },
    { k: 'lillmatta', v: 6, x: 36, y: 206 }, { k: 'retrotv', v: 0, x: 206, y: 202 },
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
  'radhus:0': [ // vardagsrum med kokvrå och trädgårdsfönster (SOVRUM-dörren börjar vid x=336)
    { k: 'bredhylla', v: 0, x: 82, y: 96 }, { k: 'tv', v: 1, x: 163, y: 96 },
    { k: 'diskbank', v: 1, x: 206, y: 96 }, { k: 'kylskap', v: 0, x: 258, y: 94, fx: 1 },
    { k: 'stormatta', v: 3, x: 126, y: 198 }, { k: 'soffa', v: 3, x: 160, y: 176, r: 2 }, { k: 'glasbord', v: 0, x: 159, y: 150 },
    { k: 'fatolj', v: 3, x: 128, y: 164, r: 1 }, { k: 'golvlampa', v: 0, x: 110, y: 150 },
    { k: 'koksbord', v: 2, x: 244, y: 176 }, { k: 'matstol', v: 2, x: 228, y: 174 }, { k: 'matstol', v: 2, x: 272, y: 174 },
    { k: 'vaxt', v: 0, x: 300, y: 206 }, { k: 'fredslilja', v: 0, x: 16, y: 206 },
  ],
  'radhus:1': [ // sovrummet åt trädgården
    { k: 'sang', v: 4, x: 40, y: 133, fx: 1 }, { k: 'nattduksbord', v: 1, x: 76, y: 120 },
    { k: 'byra', v: 1, x: 111, y: 96 }, { k: 'rundspegel', v: 0, x: 178, y: 44 }, { k: 'garderob', v: 2, x: 200, y: 96, fx: 1 },
    { k: 'rutmatta', v: 1, x: 56, y: 196 }, { k: 'skrivbord', v: 0, x: 240, y: 160 }, { k: 'kontorsstol', v: 0, x: 250, y: 174 },
    { k: 'blomkruka', v: 0, x: 300, y: 206 },
  ],
  'takvaning:0': [ // panoramafönstret upptar bakväggen 70–280: soffan vänd mot utsikten; dörrarna till KÖK (292) och SOVRUM (336)
    { k: 'stormatta', v: 3, x: 120, y: 208 }, { k: 'soffa', v: 6, x: 141, y: 186, r: 2 }, { k: 'glasbord', v: 0, x: 140, y: 162 },
    { k: 'fatolj', v: 5, x: 116, y: 180, r: 1 }, { k: 'fatolj', v: 5, x: 180, y: 180, r: 3 },
    { k: 'golvlampa', v: 2, x: 202, y: 186 }, { k: 'ljusgrupp', v: 0, x: 100, y: 204 },
    { k: 'piano', v: 1, x: 300, y: 150 }, { k: 'gummitrad', v: 0, x: 66, y: 104 },
    { k: 'vaxt', v: 0, x: 250, y: 206 }, { k: 'fredslilja', v: 0, x: 350, y: 206 },
  ],
  'takvaning:1': [ // sovrummet med stadsutsikt
    { k: 'nattduksbord', v: 3, x: 22, y: 120 }, { k: 'sang', v: 2, x: 40, y: 133, fx: 1 }, { k: 'nattduksbord', v: 3, x: 76, y: 120 },
    { k: 'lagbyra', v: 6, x: 112, y: 96 }, { k: 'rundspegel', v: 2, x: 168, y: 44 }, { k: 'garderob', v: 1, x: 254, y: 96, fx: 1 },
    { k: 'golvlampa', v: 2, x: 96, y: 150 }, { k: 'rundmatta', v: 4, x: 50, y: 188 },
    { k: 'tv', v: 1, x: 160, y: 204 }, { k: 'klockblomma', v: 0, x: 340, y: 206 },
  ],
  'takvaning:2': [ // köket: diskbänk under fönstret, köksö, matbord för sex (kylskåpet mellan spisen och fönstret)
    { k: 'diskbank', v: 1, x: 100, y: 96 }, { k: 'bankskap', v: 5, x: 150, y: 96 }, { k: 'koksspis', v: 0, x: 200, y: 96 },
    { k: 'kylskap', v: 0, x: 218, y: 94, fx: 1 }, { k: 'overskap', v: 1, x: 152, y: 60 },
    { k: 'kokso', v: 1, x: 110, y: 160 }, { k: 'bordM', v: 2, x: 200, y: 182 }, { k: 'matstol', v: 1, x: 186, y: 180 }, { k: 'matstol', v: 1, x: 254, y: 180 },
    { k: 'vaxtS', v: 0, x: 340, y: 140 }, { k: 'soptunna', v: 0, x: 60, y: 110 }, { k: 'lillblomma', v: 0, x: 30, y: 206 },
  ],
  // ---- badrummen (sista delrummet): toalett, handfat med spegel, dusch eller badkar, handdukar ----
  // Toaletten, handfatet och duschen/badkaret är startmöbler (fx: går att flytta, inte sälja).
  // Glest nog för att skyltarna (TOALETT, HANDFAT, BADKAR …) inte ska krocka.
  'husvagn:1': [ // toaskrubben: toa, litet tvättställ på väggen med spegel ovanför, soptunna
    { k: 'toalett', v: 3, x: 16, y: 100, fx: 1 }, { k: 'tvattstall', v: 1, x: 38, y: 80, fx: 1 },
    { k: 'rundspegel', v: 0, x: 38, y: 60 }, { k: 'soptunna', v: 1, x: 58, y: 104 }, { k: 'lillmatta', v: 0, x: 16, y: 128 },
  ],
  'rum:1': [ // Lilla rummets sjabbiga badrum: dasset, ett sprucket handfat och en dusch med plastdraperi
    { k: 'dass', v: 0, x: 10, y: 104, fx: 1 }, { k: 'handfat', v: 1, x: 49, y: 98, fx: 1 },
    { k: 'rundspegel', v: 1, x: 49, y: 66 }, { k: 'dusch', v: 1, x: 72, y: 120, fx: 1 }, { k: 'lillmatta', v: 4, x: 72, y: 142 },
  ],
  'hoghus:1': [ // 70-talsbadrummet: rosa toa, badkar och en hylla med handdukar
    { k: 'toalett', v: 2, x: 16, y: 100, fx: 1 }, { k: 'handfat', v: 1, x: 50, y: 98, fx: 1 },
    { k: 'rundspegel', v: 2, x: 50, y: 66 }, { k: 'badkar', v: 0, x: 78, y: 112, fx: 1 },
    { k: 'badhylla', v: 3, x: 108, y: 100 }, { k: 'lillmatta', v: 3, x: 76, y: 140 },
  ],
  'lagenhet:2': [ // vitkaklat: toa, handfat, dusch, handdukshylla, tvättmaskin + torktumlare och linneskåp
    { k: 'toalett', v: 3, x: 16, y: 100, fx: 1 }, { k: 'handfat', v: 1, x: 50, y: 98, fx: 1 },
    { k: 'rundspegel', v: 0, x: 50, y: 66 }, { k: 'dusch', v: 5, x: 73, y: 120, fx: 1 },
    { k: 'badhylla', v: 3, x: 106, y: 100 }, { k: 'tvattmaskin', v: 0, x: 126, y: 100, fx: 1 }, { k: 'torktumlare', v: 0, x: 144, y: 100 },
    { k: 'linneskap', v: 4, x: 176, y: 98 }, { k: 'fredslilja', v: 1, x: 234, y: 104 }, { k: 'lillmatta', v: 7, x: 73, y: 142 },
  ],
  'radhus:2': [ // blått kakel: badkar med badanka, tvättmaskin och torktumlare, en bänk under det andra fönstret
    { k: 'toalett', v: 0, x: 16, y: 100, fx: 1 }, { k: 'handfat', v: 1, x: 50, y: 98, fx: 1 },
    { k: 'rundspegel', v: 2, x: 50, y: 66 }, { k: 'badkar', v: 1, x: 78, y: 112, fx: 1 },
    { k: 'badhylla', v: 3, x: 108, y: 100 }, { k: 'blomkruka', v: 1, x: 128, y: 102 },
    { k: 'tvattmaskin', v: 0, x: 152, y: 100, fx: 1 }, { k: 'torktumlare', v: 0, x: 170, y: 100 },
    { k: 'linneskap', v: 1, x: 212, y: 98 }, { k: 'badbank', v: 1, x: 244, y: 102 }, { k: 'fredslilja', v: 0, x: 298, y: 104 },
    { k: 'lillmatta', v: 0, x: 76, y: 140 }, { k: 'rundmatta', v: 2, x: 250, y: 150 },
  ],
  'villa:3': [ // marmor: handfat under medicinskåpet, badkar, dusch, tvättpelare och en bänk under fönstret
    { k: 'toalett', v: 3, x: 16, y: 100, fx: 1 }, { k: 'handfat', v: 1, x: 50, y: 98, fx: 1 }, { k: 'medicinskap', v: 0, x: 42, y: 72 },
    { k: 'badkar', v: 1, x: 80, y: 112, fx: 1 }, { k: 'dusch', v: 4, x: 118, y: 120, fx: 1 },
    { k: 'badhylla', v: 3, x: 158, y: 100 }, { k: 'badhylla', v: 0, x: 176, y: 100 }, { k: 'tvattpelare', v: 0, x: 204, y: 104, fx: 1 },
    { k: 'badbank', v: 1, x: 248, y: 100 }, { k: 'fredslilja', v: 0, x: 314, y: 112 }, { k: 'rundmatta', v: 0, x: 82, y: 150 },
  ],
  'takvaning:3': [ // skiffer: vitt porslin mot det mörka kaklet, regndusch, badkaret under panoramafönstret och levande ljus
    { k: 'toalett', v: 5, x: 16, y: 100, fx: 1 }, { k: 'handfat', v: 1, x: 50, y: 98, fx: 1 }, { k: 'medicinskap', v: 0, x: 42, y: 72 },
    { k: 'dusch', v: 6, x: 80, y: 120, fx: 1 }, { k: 'badhylla', v: 3, x: 124, y: 100 },
    { k: 'badkar', v: 0, x: 202, y: 104, fx: 1 }, { k: 'ljusgrupp', v: 0, x: 232, y: 106 }, { k: 'gummitrad', v: 0, x: 300, y: 104 },
    { k: 'rundmatta', v: 1, x: 200, y: 130 },
  ],
};
// Startmöbleringen måste stå rätt från början (annars flyttas den vid första besöket
// med en toast) – tools/room-check.mjs kontrollerar varje delrum mot fits().
// have(i) = delrum i:s sparade lista (undefined = inte seedat än). Står det redan en
// toalett (startmöbel) i ett annat delrum – en sparad bostad där toan stod i rummet –
// seedas badrummet utan en toalett till (spelaren flyttar själv in den med Möblera);
// ligger Lilla rummets dass i förrådet seedas inget nytt dass heller.
function seedFor(home, sub, have = () => undefined, storage = []) {
  const list = (SEEDS[`${home}:${sub}`] || []).map((d) => ({ ...d }));
  const plan = PLANS[home];
  if (!plan?.rooms[sub]?.bath) return list;
  const toiletElsewhere = plan.rooms.some((r, i) => i !== sub && (have(i) || []).some((d) => d && d.fx && functionOf(d.k) === 'toalett'));
  return list.filter((d) => functionOf(d.k) !== 'toalett' || !(toiletElsewhere || (d.k === 'dass' && storage.some((it) => it?.k === 'dass'))));
}
// Startmöbler som har bytt plats i startmöbleringen: står de kvar orörda på den gamla
// platsen i en sparad bostad flyttas de till den nya (Lilla rummet fick BADRUM-dörren där
// garderoben och kylskåpet stod). Det spelaren själv har flyttat står kvar – och dasset
// som stod mitt i rummet får stå kvar tills spelaren flyttar det.
const MOVED_SEEDS = {
  'rum:0': [{ k: 'garderob', from: [106, 96], to: [71, 96] }, { k: 'kylskap', from: [150, 94], to: [118, 94] }],
};

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
// Småsaker som får stå PÅ bord, bänkar, byråer och låga hyllor: ställs de över en skiva hamnar
// de uppe på den. Posten får då up = hur många pixlar ovanför sin sorteringslinje (skivans
// fotlinje + 1) saken står – den ritas direkt efter bordet, har inget fotavtryck på golvet och
// följer med när bordet flyttas. Försvinner bordet (förrådet, sålt) hamnar saken på golvet där.
const ON_TABLE = new Set(['bordslampa', 'brodrost', 'fruktskal', 'kaffebryggare', 'tarta', 'mikro', 'telefon', 'dator', 'laptop', 'ljus',
  'ljusgrupp', 'lillblomma', 'blomkruka', 'julljus', 'julfigur', 'spelkonsol', 'retrotv', 'minigran', 'bokstapel', 'parmar', 'nattlampa',
  'gosedjur', 'gosegroda', 'byggklossar', 'palett', 'fredslilja', 'skivor', 'julklapp', 'datortorn', 'basketboll']);
const SURFACES = new Set(['bordR', 'byra', 'bordM', 'sidobord', 'pelarbord', 'laghylla', 'soffbord', 'glasbord', 'tvbank', 'nattduksbord',
  'kista', 'lagbyra', 'rullbord', 'koksbord', 'bankskap', 'diskbank', 'kokso', 'badbank', 'barnbord', 'skolbank', 'skrivbord', 'arbetsbank',
  'skobank', 'piano', 'bredhylla', 'leksakslada', 'backar']);
const TOP_IN = 4; // sakerna ställs så här många rader in på skivan (räknat från dess överkant i bilden)
const TOP_ROW = new Map(); // vyns rutnamn → raden i bilden där sakernas fötter står (null = atlasen inte laddad)
function surfaceRow(k, v, r) {
  const vw = viewOf(k, v, r), name = frameName(vw.k, vw.v);
  if (TOP_ROW.has(name)) return TOP_ROW.get(name);
  const f = frameOf(vw.k, vw.v);
  if (!f || typeof document === 'undefined' || !ATLAS?.complete || !ATLAS.naturalWidth) return null;
  let row = null;
  try { // skivans överkant = översta ogenomskinliga raden i bildens mittersta halva
    const c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
    const x = c.getContext('2d'); x.drawImage(ATLAS, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    const px = x.getImageData(0, 0, f[2], f[3]).data;
    let top = f[3];
    for (let col = Math.floor(f[2] * 0.25); col < Math.ceil(f[2] * 0.75); col++) for (let y = 0; y < top; y++) if (px[(y * f[2] + col) * 4 + 3] > 128) { top = y; break; }
    row = Math.min(f[3] - 2, top + TOP_IN);
  } catch { row = null; }
  TOP_ROW.set(name, row);
  return row;
}
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
// fönstren som ritas: inte utanför lokalen och inte bakom en dörr
const visibleWindows = (def, RIGHT, subDoors) => def.windows.filter(([wx0, wx1]) => !(wx1 > RIGHT - 5 || subDoors.some((sd) => wx1 > sd.x0 - 4 && wx0 < sd.x1 + 4)));

export function makeRoom(A, { visit = false } = {}) {
  const hopped = hopping; // kom vi genom en dörr i bakväggen (inte hem från staden)?
  hopping = false;
  const g = A.game;
  const home = visit ? A.visitTarget?.home || 'rum' : g.home;
  const plan = PLANS[home] || PLANS.rum;
  const sub = Math.max(0, Math.min(plan.rooms.length - 1, A.roomSub | 0));
  A.roomSub = sub;
  const roomDef = plan.rooms[sub];
  const RIGHT = roomDef.partition ?? (plan.partition || FW);
  const outside = outsideOf(plan, roomDef);
  const decoKey = `${home}:${sub}`;

  // deco-listan: min egen (seedas vid behov) eller värdens (read-only)
  const savedList = (i) => (visit ? A.visitTarget?.deco?.[`${home}:${i}`] : g.deco[`${home}:${i}`]);
  const seedHere = (i) => seedFor(home, i, savedList, visit ? [] : g.storage);
  // Vid besök: värdens lista rörs aldrig, men en sparfil som värden inte har öppnat sedan
  // badrummen kom (kylskåpet framför nya BADRUM-dörren …) visas som värden kommer att se
  // den – i en kopia där startmöblerna flyttats (MOVED_SEEDS) och det som står i vägen
  // knuffats undan (settle). Kopian görs en gång per lista som världen skickar.
  const visitCopies = new WeakMap();
  function decoList() {
    if (visit) {
      const own = A.visitTarget?.deco?.[decoKey];
      if (!Array.isArray(own)) return seedHere(sub);
      if (!visitCopies.has(own)) { const copy = own.map((d) => ({ ...d })); settle(copy, false); visitCopies.set(own, copy); }
      return visitCopies.get(own);
    }
    if (!g.deco[decoKey]) { g.deco[decoKey] = seedHere(sub); g.save(); }
    return g.deco[decoKey];
  }

  // husdjurslagret (skapas längre ner, bara i det egna hemmet) och dess prylars hinder
  let L = null, petObstacles = [], petHover = null;
  // alla husdjursprylar i delrummet (även skålar och säckar) – möbler får inte ställas på dem.
  // OBS: exakt samma fotavtryck som lagrets egen placering (layer.js footprint/canPlace:
  // itemSolid, annars prylens bredd × högst 5 px) och ingen extra marginal. Lagret
  // garanterar att fotavtrycket aldrig skär en möbels solid (furnGrid) – med klickytan
  // (itemBox) eller en marginal här kunde lagret ställa en korg där fits() sedan sa nej,
  // och startmöbler gick inte att ställa tillbaka på sin egen plats (allFit = false).
  const petRects = () => (L ? petStore().itemsIn(home, sub).map((it) => { const b = petFoot(it.k); return [it.x + b.x0, it.y + b.y0, it.x + b.x1, it.y + b.y1]; }) : []);
  // står en husdjurspryl bakom (högre upp än fotlinjen y) det möbeln med vänsterkant x ritar?
  // Prylens bild = fotavtryckets bredd (1 px in på varje sida) upp till bildens överkant,
  // nedtill 2 px ovanför fotlinjen – en pixel eller två bakom en möbelkant skymmer inget.
  const petBehind = (x, y, w, h) => !!L && petStore().itemsIn(home, sub).some((it) => {
    const f = petFoot(it.k), b = itemBox(it.k);
    return it.y < y && overlaps([x, y - h, x + w, y], [it.x + f.x0 + 1, it.y + Math.min(b.y0, f.y0), it.x + f.x1 - 1, it.y - 2]);
  });
  // lagret håller i en pryl (spöke på golvet) → nästa klick ställer den
  const petPlacing = () => !!L?.placing;

  // ---------- delrumsdörrar + bakgrund ----------
  // En dörr till varje annat delrum, från höger (RIGHT - 48, sedan 44 px åt vänster per
  // dörr) – utom badrummet: dit leder bara de rum som står i dess doors, och dörren sitter
  // på sin egen plats (de gamla dörrarna och möblerna står kvar där de alltid har stått).
  // I badrummet finns dörrar tillbaka till just de rummen.
  const subDoors = [];
  plan.rooms.forEach((r, i) => {
    if (i === sub) return;
    if (r.bath) { const at = r.doors?.[sub]; if (at != null) subDoors.push({ to: i, name: r.name, x0: at, x1: at + DOOR_W }); return; }
    if (roomDef.bath && roomDef.doors?.[i] == null) return;
    const n = subDoors.filter((sd) => !plan.rooms[sd.to].bath).length;
    subDoors.push({ to: i, name: r.name, x0: RIGHT - 48 - n * 44, x1: RIGHT - 18 - n * 44 });
  });
  const doorRects = [...(sub === 0 ? [[DOOR.x0 - 2, 26, DOOR.x1 + 2, WALL_Y]] : []), ...subDoors.map((sd) => [sd.x0 - 2, 26, sd.x1 + 2, WALL_Y])];
  // fönstren som faktiskt ritas (samma urval som i buildBg), med karm: väggsaker får inte hänga där
  const winY = roomDef.winY || plan.winY || WIN_Y;
  const winDrawn = visibleWindows(roomDef, RIGHT, subDoors);
  const windowRects = winDrawn.map(([wx0, wx1]) => [wx0 - 2, winY[0] - 2, wx1 + 2, winY[1] + 2]);
  // där möblernas skyltar inte får hamna: dörrarna med karm och skylt (paintDoor) och fönstren
  // med karm – exakt det som ritas, så att en skylt får plats i en smal glipa mellan dem
  const doorSign = (x0, x1, name) => { const w = textW(SMALL, name) + 8, sx = Math.round((x0 + x1) / 2 - w / 2); return [sx, 20, sx + w, 29]; };
  const plateAvoid = [
    ...(sub === 0 ? [[DOOR.x0 - 1, 27, DOOR.x1 + 1, WALL_Y], doorSign(DOOR.x0, DOOR.x1, visit ? 'HEM' : 'UT')] : []),
    ...subDoors.flatMap((sd) => [[sd.x0 - 1, 27, sd.x1 + 1, WALL_Y], doorSign(sd.x0, sd.x1, sd.name)]),
    ...winDrawn.map(([wx0, wx1]) => [wx0 - 2, winY[0] - 2, wx1 + 2, winY[1] + 3]),
  ];
  const bg = buildBg(roomDef, RIGHT, subDoors, sub === 0, plan, visit);
  let moonImg = null; // månljuset genom fönstren (sömnen) – ritas första gången det behövs
  const moonLayer = () => moonImg || (moonImg = buildMoon(winDrawn, winY, roomDef.view || 'sky', RIGHT));
  // två arbetsdukar för sömnen: gryningens blandade bakgrund och ljuslagret (se draw)
  let blendCv = null, lightCv = null;
  const canvasFW = () => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; c.getContext('2d').imageSmoothingEnabled = false; return c; };
  const lightLayer = () => lightCv || (lightCv = canvasFW());
  function blendBg(a, b, u) {
    const c = blendCv || (blendCv = canvasFW()), x = c.getContext('2d');
    x.globalAlpha = 1; x.drawImage(a, 0, 0);
    x.globalAlpha = u; x.drawImage(b, 0, 0);
    x.globalAlpha = 1;
    return c;
  }

  // ---------- småsaker på bord ----------
  const isRider = (d) => !!d && d.up > 0;
  // skivan som saken d står på (bordets fotlinje + 1, innanför kanterna), eller null
  function surfaceOf(d, list, skip = -1) {
    const { w } = dimsOf(d.k, d.v, d.r);
    return list.find((s, j) => j !== skip && s !== d && s && SURFACES.has(s.k) && !isRider(s) && d.y === s.y + 1
      && d.x >= s.x && d.x + w <= s.x + dimsOf(s.k, s.v, s.r).w) || null;
  }
  // hur högt en sak står på skivan s (up) – null = okänt än (atlasen laddas)
  const upOn = (s) => { const row = surfaceRow(s.k, s.v, s.r); return row == null ? null : dimsOf(s.k, s.v, s.r).h - row + 1; };
  // sakerna som står på bordet list[idx] (och var på skivan, räknat från bordets vänsterkant)
  const ridersOf = (list, idx) => list.filter((d) => isRider(d) && surfaceOf(d, list) === list[idx]).map((d) => ({ d, dx: d.x - list[idx].x }));

  // ---------- var får möbler stå? ----------
  // De andra möblernas fotavtryck (räknas en gång per sökning – fitRoom prövar tusentals lägen)
  // (saker som står på ett bord har inget fotavtryck på golvet)
  const feetOf = (list, skip) => list.map((o, i) => (i === skip || isRider(o) ? null : { wall: isWall(o.k), flat: o.k === 'matta' || isFlat(o.k), r: footOf(o.k, o.v, o.r, o.x, o.y).r }));
  // x/y som i deco-posten (vänsterkant + fotlinje; mattan överkant). skip = index i listan att bortse från.
  // up > 0 = saken står på en skiva: den måste stå på ett bord i listan (rätt höjd, innanför
  // kanterna) och inte på en annan sak där uppe.
  function fits(k, v, r, x, y, list, skip = -1, feet = feetOf(list, skip), up = 0) {
    const ft = footOf(k, v, r, x, y);
    if (up > 0) {
      const s = surfaceOf({ k, v, r, x, y }, list, skip);
      if (!s) return false;
      const u = upOn(s);
      if (u != null && Math.abs(u - up) > 1) return false;
      return !list.some((o, j) => j !== skip && isRider(o) && o.y === y && x < o.x + dimsOf(o.k, o.v, o.r).w && x + ft.w > o.x);
    }
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
    const drawn = list.filter((o, j) => j !== skip && !isWall(o.k) && o.k !== 'matta' && !isFlat(o.k) && !isRider(o))
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
  const homeHasFunction = (fn) => plan.rooms.some((r, i) => (g.deco[`${home}:${i}`] || seedHere(i)).some((d) => functionOf(d.k) === fn));

  // ---------- äldre sparfiler: se till att allt får plats i (den mindre) lokalen ----------
  // Lilla rummet krympte, väggsaker får inte längre hänga över fönstren och bostäderna
  // fick dörrar till badrummet: startmöbler som står orörda på en gammal startplats flyttas
  // till den nya (MOVED_SEEDS), annat som står fel knuffas till närmaste lediga plats,
  // annars till förrådet. Är förrådet fullt får möbeln stå kvar (inne i lokalen, så att
  // den går att plocka upp) – inget försvinner någonsin, spelaren flyttar den med Möblera.
  // (Dasset seedas numera i badrummet – ett dass som står i rummet får stå kvar.)
  // Badrumsdörrarna är nya (Carl 2026-09-29): det som knuffas undan för dem får en egen toast.
  const newDoorZones = subDoors.filter((sd) => roomDef.bath || plan.rooms[sd.to].bath).map((sd) => [sd.x0 - 2, 26, sd.x1 + 2, WALL_Y + 15]);
  const byNewDoor = (d) => { const r = footOf(d.k, d.v, d.r, d.x, d.y).r; return newDoorZones.some((z) => overlaps(r, z)); };
  // Flyttar orörda startmöbler till sina nya platser och knuffar det som står fel till
  // närmaste lediga plats. own = spelarens egen lista (då kan det som inte får plats alls
  // läggas i förrådet); vid besök (kopian) står det kvar. → vad som hände (till toasterna)
  function settle(list, own) {
    let changed = false, nudged = 0, stored = 0;
    const stuck = [], byDoor = [];
    for (const m of MOVED_SEEDS[decoKey] || []) {
      const i = list.findIndex((d) => d && d.fx && d.k === m.k && d.x === m.from[0] && d.y === m.from[1] && !d.r);
      if (i >= 0 && fits(m.k, list[i].v, 0, m.to[0], m.to[1], list, i)) { list[i].x = m.to[0]; list[i].y = m.to[1]; changed = true; }
    }
    // saker på ett bord som inte (längre) står där: ner på golvet, där bordet stod
    const fall = () => { let n = 0; list.forEach((d, i) => { if (isRider(d) && !fits(d.k, d.v, d.r, d.x, d.y, list, i, undefined, d.up)) { delete d.up; changed = true; n++; } }); return n; };
    fall();
    floorPass();
    if (fall()) floorPass(); // ett bord som hamnade i förrådet tappar det som stod på det
    return { changed, nudged, stored, stuck, byDoor };
    function floorPass() {
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i];
        if (!d || isRider(d) || !knownKind(d.k) || fits(d.k, d.v, d.r, d.x, d.y, list, i)) continue;
        const spot = nearestSpot(d, list, i);
        if (spot) { // startmöbler knuffas tyst – ett bord tar med sig det som står på det
          if (!d.fx) { nudged++; if (byNewDoor(d)) byDoor.push(nameOf(d.k)); }
          const rid = SURFACES.has(d.k) ? ridersOf(list, i) : [];
          d.x = spot.x; d.y = spot.y; changed = true;
          for (const q of rid) { q.d.x = d.x + q.dx; q.d.y = d.y + 1; }
          continue;
        }
        if (!own) continue;
        changed = true;
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
    }
  }
  function fitRoom() {
    if (visit) return;
    const { changed, nudged, stored, stuck, byDoor } = settle(decoList(), true);
    if (changed) g.save();
    const few = (names) => `${names.slice(0, 2).join(' och ')}${names.length > 2 ? ' m.fl.' : ''}`;
    if (stored) toast(`📦 ${home === 'rum' ? 'Rummet är mindre nu – ' : ''}${stored === 1 ? 'en möbel fick' : `${stored} möbler fick`} inte plats och ligger i förrådet.`);
    else if (byDoor.length) toast(`🚪 Nu finns en dörr till badrummet här – ${few(byDoor)} flyttades lite åt sidan.`);
    else if (nudged) toast(`🛋️ ${nudged === 1 ? 'En möbel knuffades' : `${nudged} möbler knuffades`} till en ledig plats.`);
    if (stuck.length) toast(`⚠️ Förrådet är fullt – ${stuck.slice(0, 2).join(', ')}${stuck.length > 2 ? ' m.fl.' : ''} står i vägen. Flytta med 🛋️ Möblera!`, 'bad');
    // En sparad bostad där toan står kvar i rummet (Lilla rummets dass): badrummet har ingen
    // – ett tips en gång per spelomgång om att den går att flytta in dit.
    const bathIdx = plan.rooms.findIndex((r) => r.bath);
    if (!toiletHinted && bathIdx >= 0 && bathIdx !== sub && decoList().some((d) => functionOf(d.k) === 'toalett')
      && !(g.deco[`${home}:${bathIdx}`] || seedHere(bathIdx)).some((d) => functionOf(d.k) === 'toalett')) {
      toiletHinted = true;
      const [it, pr] = decoList().some((d) => d.k === 'dass') ? ['dasset', 'det'] : ['toan', 'den'];
      toast(`🚽 Tips: ${it} kan stå i ${home === 'husvagn' ? 'toaskrubben' : 'badrummet'} nu – lägg ${pr} i förrådet med 🛋️ Möblera och ställ ut ${pr} där inne.`);
    }
  }
  fitRoom();

  // ---------- vad man gör vid funktionsmöblerna ----------
  // Sängen: man har gått fram till den (bedFor) – säger man ja till att sova lägger sig
  // figuren just där (bedtime). En ny promenad glömmer sängen.
  let bedFor = null, seq = null; // seq = pågående sömnsekvens (se bedtime)
  function actFor(fn, kind, p) {
    if (visit || !fn) return null;
    switch (fn) {
      case 'sova': return () => { bedFor = p ? { k: p.k, decoIdx: p.decoIdx } : null; A.sleepFlow(); };
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
    : () => { A.roomSub = 0; A.leftHome = true; play('door'); A.go('city'); }; // staden ställer en vid det egna husets dörr

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
      if (decor.carry?.riders?.some((q) => q.d === d)) return; // står på bordet man bär (ritas med spöket)
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
      if (m) { m.act = () => { bedFor = { k: m.k, decoIdx: undefined }; floorSleep(A); }; props.push(m); }
    }
    spreadPlates(props, plateAvoid, RIGHT);
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
      if (!p.solid && !p.hit) continue;
      const act = p.act || actFor(p.fn, p.k, p);
      if (!act) continue;
      // en sak på ett bord (datorn på skrivbordet): man går fram till bordets framkant
      if (!p.solid) { hotRects.push({ id: p.k, act, r: p.hit, go: [(p.hit[0] + p.hit[2]) / 2, p.sort + 5] }); continue; }
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
  // carry = möbeln man håller i: { src: 'deco'|'storage', idx, k, v, c, r, r0 (rotationen den hade), fx,
  //         riders (det som står på bordet man bär: [{ d, dx }] – följer med) }
  const decor = { on: false, carry: null, mx: 100, my: 150 };
  const carrySkip = () => (decor.carry?.src === 'deco' ? decor.carry.idx : -1);
  const carryDeco = (idx) => { const list = decoList(), d = list[idx]; return d && { src: 'deco', idx, k: d.k, v: d.v, c: d.c, fx: d.fx, r: d.r | 0, r0: d.r | 0, riders: SURFACES.has(d.k) ? ridersOf(list, idx) : [] }; };
  // var det man håller i hamnar: en småsak över en bordsskiva ställs uppe på skivan
  // ({ x, y, up }), annars på golvet eller väggen som vanligt (posFor)
  function placeFor(c, mx, my) {
    const pos = posFor(c.k, c.v, c.r, mx, my);
    if (!ON_TABLE.has(c.k)) return pos;
    const { w } = dimsOf(c.k, c.v, c.r), list = decoList(), skip = carrySkip();
    let best = null;
    list.forEach((s, j) => {
      if (j === skip || !s || !SURFACES.has(s.k) || isRider(s)) return;
      const sd = dimsOf(s.k, s.v, s.r), u = upOn(s);
      if (u == null || w > sd.w - 2 || mx < s.x || mx > s.x + sd.w || my < s.y - sd.h - 4 || my > s.y + 2) return;
      if (!best || s.y > best.s.y) best = { s, sd, u };
    });
    if (!best) return pos;
    const { s, sd, u } = best;
    return { x: Math.max(s.x + 1, Math.min(s.x + sd.w - 1 - w, Math.round(mx - w / 2))), y: s.y + 1, up: u };
  }
  function canPlaceCarry(mx, my) {
    const c = decor.carry;
    const { x, y, up } = placeFor(c, mx, my);
    return fits(c.k, c.v, c.r, x, y, decoList(), carrySkip(), undefined, up || 0);
  }
  const setUp = (d, up) => { if (!d) return; if (up > 0) d.up = up; else delete d.up; };
  // efter att ett bord flyttats, vänts, lagts i förrådet eller sålts: det som stod på det
  // följer med – eller hamnar på golvet om det inte får plats på skivan längre
  const settleRiders = () => { if (settle(decoList(), true).changed) g.save(); };
  function commitPlace() {
    const c = decor.carry;
    const pos = placeFor(c, decor.mx, decor.my);
    if (c.src === 'storage') {
      if (!g.placeFromStorage(c.idx, sub, pos.x, pos.y)) { play('fel'); toast('Rummet är fullt!', 'bad'); return; }
      const list = decoList();
      if (c.r) g.rotateDeco(sub, list.length - 1, c.r);
      setUp(list[list.length - 1], pos.up);
    } else {
      g.moveDeco(sub, c.idx, pos.x, pos.y);
      g.rotateDeco(sub, c.idx, c.r);
      const s = decoList()[c.idx];
      setUp(s, pos.up);
      if (c.riders?.length && s) {
        const u = upOn(s), sw = dimsOf(s.k, s.v, s.r).w;
        for (const { d, dx } of c.riders) { const w = dimsOf(d.k, d.v, d.r).w; d.x = Math.max(s.x + 1, Math.min(s.x + sw - 1 - w, s.x + dx)); d.y = s.y + 1; if (u != null) d.up = u; }
      }
    }
    g.save();
    decor.carry = null;
    if (c.riders?.length) settleRiders();
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
      toast(`📦 ${nameOf(c.k)} ligger i förrådet.${c.riders?.length ? ' Det som stod på skivan står nu på golvet.' : ''}`);
    }
    play('ok');
    decor.carry = null;
    if (c.riders?.length) settleRiders();
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
    if (seq && force !== false) return; // man möblerar inte om medan man sover
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
      if (c.riders?.length) settleRiders(); // det som stod på bordet hamnar på golvet
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
  function walkTo(x, y, cb) { bedFor = null; path = findPath(px, py, x, y); onArrive = cb || null; if (!path.length) { const d = onArrive; onArrive = null; d?.(); } }

  // ---------- sömnen: under täcket, zzz, natt → morgon ----------
  // bedtime(onWake): har man just gått fram till en säng (eller madrassen) lägger sig
  // figuren i den. Sekvensen (SLEEP) spelas upp i update/draw; klockan står still under
  // tiden (tickReal i main.js hinner inte räkna ner mättheten eller passera midnatt), och
  // när figuren har klivit upp anropas onWake – det är där natten räknas (g.sleep) och
  // veckan visas. false = ingen säng att lägga sig i (då sover anroparen direkt).
  const findBed = (key) => key && props.find((q) => q.k === key.k && q.decoIdx === key.decoIdx && q.fn === 'sova');
  function bedtime(onWake) {
    if (visit || seq) return false;
    const bed = findBed(bedFor);
    if (!bed) return false;
    if (decor.on) toggleDecor(false);
    path = []; onArrive = null;
    g.min = Math.min(g.min, 24 * 60 - 2); // högst 23:58: realtidsklockan får inte passera midnatt (svimma) under sekvensen
    seq = { t: 0, key: bedFor, onWake, x: px, y: py, min: g.min, hunger: g.hunger, energy: g.energy,
      night0: isNight(g), hold: null, sounds: new Set() };
    return true;
  }
  const sleepPhase = () => sleepState(seq);
  // spola fram: först till gryningen, sedan till slutet
  function skipSleep() {
    if (!seq) return;
    seq.t = seq.t < SLEEP.dawn ? SLEEP.dawn : Math.max(seq.t, SLEEP.light);
  }
  function finishSleep(now = true) {
    const s = seq;
    if (!s) return;
    seq = null; bedFor = null;
    g.min = s.min; g.hunger = s.hunger; g.energy = s.energy;
    px = s.x; py = s.y; dir = 'down';
    if (now) s.onWake?.(); else setTimeout(() => s.onWake?.(), 0);
  }
  function updateSleep(dt) {
    const s = seq;
    // klockan står still medan man somnar (tickReal har redan tickat den här rutan)
    g.min = s.min; g.hunger = s.hunger; g.energy = s.energy;
    if (s.hold == null) s.t += dt; else s.t = s.hold;
    const cue = (id, at, fn) => { if (s.t >= at && !s.sounds.has(id)) { s.sounds.add(id); fn(); } };
    cue('lie', SLEEP.lie, () => play('sleep'));
    cue('off', SLEEP.off, () => play('click'));
    cue('morning', SLEEP.dawn + 0.3, () => play('morning'));
    if (s.t >= SLEEP.end) finishSleep();
  }

  // ---------- husdjuren (bara i det egna hemmet) ----------
  // Lagret får möblernas gångbarhet (furnGrid – utan husdjurens egna prylar, djuren ska
  // kunna kliva in i korgen) minus fläcken framför dörrarna (där ställs inga prylar ut, så
  // att vägen ut aldrig blockeras). Prylarnas hinder läggs till spelarens gångbarhet.
  if (!visit) {
    const store = petStore();
    if (!hopped) {
      // hemkommen från staden (eller jobbet): först tickas tiden man var borta ikapp som
      // "borta" (djuren som var ute räknas som ute, inte som inne – staden har synkat
      // promenaden löpande, se js/pets/outdoors.js), sedan tas kopplet av
      try { store.syncTo(g.day, g.min, { home: g.home, playerHome: null, playerRoom: null, outdoors: false }); } catch (e) { console.error('husdjuren: synken vid hemkomst', e); }
      store.walkEnd();
    }
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
    // Mobilfyllningen (fit i main.js): smala lokaler utan egen utsida (Lilla rummet och
    // Lägenheten, med sina badrum) beskärs till lokalens verkliga bredd så att ingen död
    // yta fyller skärmen. Husvagnen och Förortsettan ritar i stället gården/trapphuset.
    contentBox: RIGHT < FW && !outside ? { x: 0, y: 0, w: RIGHT, h: FH } : undefined,
    toggleDecor,
    bedtime,
    get asleep() { return !!seq; },
    _debug: {
      // sömnsekvensen: läget just nu (null = vaken) och en fryst tidpunkt för skärmbilder
      // (hold(t) låser sekvensen vid t sekunder, hold(null) släpper den)
      sleep: () => {
        const st = sleepPhase();
        if (!st) return null;
        const bed = findBed(seq.key);
        return { t: st.t, lying: st.lying, dim: st.dim, warm: st.warm, moon: st.moon, bg: st.bg, zs: st.zs.length, bed: bed?.k || null, min: g.min, day: g.day };
      },
      hold: (tt) => { if (seq) seq.hold = tt; return !!seq; },
      bedFor: () => bedFor,
      // figuren i sängen som bild (för testerna: finns avatarens hudfärg på kudden?)
      sleeperArtFor: (d, look, covered = true) => { const a = sleeperArt(look || A.avatar.look, d, covered); return a ? { img: a.img, flip: a.flip, head: a.head } : null; },
      sleeperArt: (covered = true) => { const b = findBed(seq?.key || bedFor); if (!b) return null; const d = b.k === 'madrass' ? { k: 'madrass' } : decoList()[b.decoIdx]; return sleeperArt(A.avatar.look, d, covered)?.img || null; },
      rooms: () => plan.rooms.map((r, i) => ({ name: r.name, bath: !!r.bath, i })),
      subDoors: () => subDoors.map((sd) => ({ ...sd })),
      spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; },
      tile: (a, b) => ({ x: Math.min(RIGHT - 20, 30 + a * 40), y: Math.min(FH - 10, WALL_Y + 15 + b * 18) }),
      // för testerna: lyft möbel i (i deco-listan) / förrådspost, rotera, släpp vid (x, y)
      pick: (idx) => { const c = carryDeco(idx); if (!c) return false; decor.carry = c; rebuild(); return true; },
      pickStorage: (idx) => { const it = g.storage[idx]; if (!it) return false; decor.carry = { src: 'storage', idx, k: it.k, v: it.v, c: it.c, fx: it.fx, r: it.r | 0, r0: it.r | 0 }; return true; },
      rotate: () => rotateCarry(),
      store: () => storeCarry(),
      drop: (x, y) => { decor.mx = x; decor.my = y; if (!decor.carry || !canPlaceCarry(x, y)) return false; commitPlace(); return true; },
      canPlace: (x, y) => !!decor.carry && canPlaceCarry(x, y),
      props: () => props.map((p) => ({ k: p.k, fn: p.fn, solid: p.solid, hit: p.hit || null, decoIdx: p.decoIdx })),
      // småsaker på bord: var saken skulle hamna under pekaren, och vad som står på vilket bord
      placeFor: (x, y) => (decor.carry ? placeFor(decor.carry, x, y) : null),
      riders: () => decoList().map((d, i) => ({ d, i })).filter(({ d }) => isRider(d)).map(({ d, i }) => ({ i, k: d.k, x: d.x, y: d.y, up: d.up, on: decoList().indexOf(surfaceOf(d, decoList(), i)) })),
      surfaceUp: (idx) => { const s = decoList()[idx]; return s ? upOn(s) : null; },
      walls: () => wallItems.map((w) => ({ k: w.k, x: w.x, top: w.top })),
      // skyltarna över möblerna (rektangeln som ritas) och det de inte får täcka
      plates: () => props.filter((p) => p.label).map((p) => { const w = textW(SMALL, p.label) + 8; return { k: p.k, label: p.label, r: [p.plateX - w / 2, p.plateY - 1, p.plateX + w / 2, p.plateY + 8] }; }),
      plateAvoid: () => plateAvoid.map((r) => [...r]),
      // står varje post i listan rätt (som fitRoom ser det)? – för startmöbleringstestet
      allFit: () => { const list = decoList(); return list.every((d, i) => !knownKind(d.k) || fits(d.k, d.v, d.r, d.x, d.y, list, i, undefined, d.up)); },
      // de poster som inte står rätt, och om det är en husdjurspryl som stör (för testerna)
      misfits: () => {
        const list = decoList();
        return list.map((d, i) => ({ d, i })).filter(({ d, i }) => knownKind(d.k) && !fits(d.k, d.v, d.r, d.x, d.y, list, i, undefined, d.up)).map(({ d }) => {
          const ft = footOf(d.k, d.v, d.r, d.x, d.y);
          return { k: d.k, x: d.x, y: d.y, onPet: ft.t === 'solid' && petRects().some((r) => overlaps(ft.r, r)), hidesPet: ft.t === 'solid' && petBehind(d.x, d.y, ft.w, ft.h) };
        });
      },
      seeds: () => seedHere(sub),
      windows: windowRects, doors: doorRects,
      partition: RIGHT,
      // husdjurslagret (null vid besök) och figurens läge/väg – för tools/pets-home-test.mjs
      layer: () => L,
      me: () => ({ x: px, y: py, dir, walking: path.length > 0 }),
      walkable: (x, y) => walkable(x, y),
    },

    update(dt) {
      t += dt;
      if (seq) updateSleep(dt);
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

    move(x, y) { decor.mx = x; decor.my = y; if (!seq) L?.move(x, y); },
    // mobilen: dra möbeln med fingret och släpp – då ställs den där man släppte
    // (tryck för att plocka upp + tryck för att ställa ner fungerar som förut)
    up(x, y) {
      if (seq) return;
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
      if (seq) { skipSleep(); return; } // ett klick medan man sover spolar fram till morgonen
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
        // (en sak på ett bord ligger före bordet)
        const hit = [
          ...props.filter((p) => p.decoIdx !== undefined && (p.solid || p.hit))
            .map((p) => (p.solid ? { decoIdx: p.decoIdx, key: p.solid[3], r: [p.solid[0], p.top, p.solid[2], p.solid[3] + 2] } : { decoIdx: p.decoIdx, key: p.sort + 1, r: p.hit }))
            .sort((a, b) => b.key - a.key),
          ...wallItems.map((w) => ({ decoIdx: w.decoIdx, r: [w.x, w.top, w.x + w.w, w.top + w.h] })),
          ...rugs.map((r) => ({ decoIdx: r.decoIdx, r: [r.x, r.y, r.x + r.w, r.y + r.h] })),
        ].find((p) => x >= p.r[0] && x <= p.r[2] && y >= p.r[1] && y <= p.r[3]);
        if (hit) {
          decor.carry = carryDeco(hit.decoIdx);
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
      if (seq) { if (k === 'Escape' || k === ' ' || k === 'Enter') skipSleep(); return; }
      if (L && L.key(k)) return; // Esc: lägg tillbaka prylen/säcken man håller i
      if (k === 'Escape' && decor.on) toggleDecor(false);
      if ((k === 'r' || k === 'R') && decor.on && decor.carry) rotateCarry();
    },
    exit() {
      // byts scenen mitt i sömnen (sker inte i spelet – klicken spolar bara fram) sover man
      // ändå klart: natten räknas och veckan visas när den nya scenen har tagit över
      if (seq) finishSleep(false);
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
      // sömnen styr ljuset: som vanligt → natt med släckta lampor → morgon
      const st = sleepPhase();
      const night = !st || st.bg === 'now' ? isNight(g) : st.bg === 'dark' ? 'dark' : false;
      // gryningen: natten (släckta lampor) tonar över i dagsljus i takt med att det ljusnar
      const dawnU = st && st.bg === 'day' && st.t < SLEEP.light ? ease((st.t - SLEEP.dawn) / (SLEEP.light - SLEEP.dawn)) : null;
      const bgImg = dawnU == null ? bg(night) : blendBg(bg('dark'), bg(false), dawnU);
      ctx.drawImage(bgImg, 0, 0);
      drawWindowLife(ctx, roomDef.view || 'sky', winDrawn, winY[0], winY[1], t, dawnU == null ? !!night : dawnU < 0.5); // grannar, bilar, katten på staketet
      for (const w of wallItems) w.draw(ctx);
      if (plan.shabby) drawSpider(ctx, RIGHT, t);
      for (const r of rugs) r.draw(ctx);

      const folks = worldFolksHere(A);
      // sängen man sover i ritas med figuren under täcket
      const sleeper = st?.lying ? findBed(seq.key) : null;
      let headAt = null;
      const drawSleeper = (c, p) => {
        const d = p.k === 'madrass' ? { k: 'madrass', x: p.x, y: p.base } : decoList()[p.decoIdx];
        const art = d && sleeperArt(A.avatar.look, d, st.lying === 2);
        if (!art) { p.draw(c); return; }
        const top = p.top + art.oy, left = d.x + art.ox;
        if (p.k !== 'madrass') { c.fillStyle = 'rgba(20,12,28,0.22)'; c.fillRect(d.x + 1, p.sort - 1, art.bw - 2, 2); }
        drawArt(c, art, left, top);
        headAt = [left + art.head[0], top + art.head[1]];
      };
      const drawables = props.map((p) => ({ fy: p.sort, draw: () => { if (p === sleeper) drawSleeper(ctx, p); else p.draw(ctx); } }));
      for (const p of props) if (p.drawPlate && p.label && p !== sleeper) drawables.push({ fy: p.plateFy ?? p.sort + 0.01, draw: () => p.drawPlate(ctx) });
      const mine = worldMyEmote();
      // husdjuren, deras prylar och olyckor (plus mätare/bubblor/spöken med fy ≥ 10000 överst)
      if (L) for (const d of L.drawables()) drawables.push({ fy: d.fy, draw: () => d.draw(ctx) });
      if (!sleeper) drawables.push({ fy: py, draw: () => {
        // bär man en matsäck (A.carrying) ritas figuren med bär-bildrutorna; nyvaken: sträcker på sig
        const frame = st ? (st.t >= SLEEP.up && st.t < SLEEP.up + 0.35 ? 4 : 0)
          : A.carrying ? (path.length ? CARRY_SEQ[Math.floor(t * 8.5) % 4] : 9)
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
        const pos = placeFor(decor.carry, decor.mx, decor.my), lift = pos.up || 0;
        ctx.globalAlpha = 0.7;
        if (k === 'matta') ctx.drawImage(rugImg(v, c), pos.x, pos.y);
        else if (k === 'vaxt') { const p = makePlantProp(pos.x + 10, pos.y); p.draw(ctx); }
        else { const a = furnView(k, v, c, r); if (a) drawArt(ctx, a, pos.x, pos.y - lift - a.sh); }
        // bordet man bär har med sig det som står på det
        if (decor.carry.riders?.length) {
          const u = upOn({ k, v, r }), sw = dimsOf(k, v, r).w;
          for (const { d, dx } of decor.carry.riders) {
            const a = furnView(d.k, d.v, d.c, d.r);
            if (a) drawArt(ctx, a, Math.max(pos.x + 1, Math.min(pos.x + sw - 1 - a.sw, pos.x + dx)), pos.y + 1 - (u ?? d.up) - a.sh);
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = okHere ? 'rgba(80,220,110,0.8)' : 'rgba(230,60,60,0.8)';
        if (isWall(k)) ctx.fillRect(pos.x, pos.y + 1, dimsOf(k, v, r).w, 2);
        else if (lift) ctx.fillRect(pos.x, pos.y - lift, dimsOf(k, v, r).w, 1); // på skivan: linjen under saken
        else ctx.fillRect(decor.mx - 6 | 0, decor.my | 0, 12, 2);
      } else if (decor.on) {
        ctx.fillStyle = 'rgba(23,21,26,0.7)'; ctx.fillRect(4, 4, 150, 10);
        ctxText(ctx, SMALL, 'MÖBLERA: KLICKA PÅ EN MÖBEL', 7, 6, '#ffd23f');
      }

      if (!st) { if (night) { ctx.fillStyle = `rgba(10,12,40,${NIGHT_DIM})`; ctx.fillRect(0, 0, FW, FH); } return; }
      // sömnen: mörkret sänker sig, fönstren lyser svagt (himlen dämpas inte som rummet),
      // månljuset faller in över golvet, zzz stiger – och i gryningen ett rosa sken
      if (st.dim > 0) { ctx.fillStyle = `rgba(8,10,34,${st.dim.toFixed(3)})`; ctx.fillRect(0, 0, FW, FH); }
      // Ljuset genom fönstren (fönsterglaset, gryningshimlen och månljuset på vägg och golv)
      // ritas i ett eget lager som möblerna, väggsakerna och sängen sedan stansas ur – så att
      // månstrimmorna ligger på golvet bakom möblerna och inte ovanpå nattygsbordet.
      const glow = st.dim > 0.05, dawnSky = dawnU != null ? Math.sin(Math.PI * dawnU) * 0.5 : 0;
      if (winDrawn.length && (glow || st.moon > 0 || dawnSky > 0.01)) {
        const lc = lightLayer(), lx = lc.getContext('2d');
        lx.globalCompositeOperation = 'source-over';
        lx.clearRect(0, 0, FW, FH);
        if (glow) {
          lx.globalAlpha = Math.min(1, st.dim / SLEEP_DIM) * 0.8;
          for (const [x0, x1] of winDrawn) lx.drawImage(bgImg, x0, winY[0], x1 - x0, winY[1] - winY[0], x0, winY[0], x1 - x0, winY[1] - winY[0]);
        }
        if (dawnSky > 0.01) { // gryningshimlen: blekt lila uppe, persika nere vid horisonten
          lx.globalAlpha = dawnSky;
          const gr = lx.createLinearGradient(0, winY[0], 0, winY[1]);
          gr.addColorStop(0, '#b8b4ec'); gr.addColorStop(0.55, '#f4b0a0'); gr.addColorStop(1, '#ffc080');
          lx.fillStyle = gr;
          for (const [x0, x1] of winDrawn) lx.fillRect(x0, winY[0], x1 - x0, winY[1] - winY[0]);
        }
        if (st.moon > 0) { lx.globalAlpha = st.moon; lx.drawImage(moonLayer(), 0, 0); }
        lx.globalAlpha = 1;
        lx.globalCompositeOperation = 'destination-out';
        for (const w of wallItems) w.draw(lx);
        for (const p of props) { if (p === sleeper) drawSleeper(lx, p); else { p.draw(lx); p.drawPlate?.(lx); } }
        lx.globalCompositeOperation = 'source-over';
        ctx.drawImage(lc, 0, 0);
      }
      if (st.warm > 0) { ctx.fillStyle = `rgba(255,164,96,${st.warm.toFixed(3)})`; ctx.fillRect(0, 0, FW, FH); }
      if (headAt && st.zs.length) drawZzz(ctx, st.zs, headAt[0], headAt[1]);
    },
  };
}

const isNight = (g) => { const h = g.min / 60; return h >= 19.5 || h < 6.5; };

// 👁 Förhandsbilder till bostadsbyrån: ett delrum ritat precis som när man flyttar in
// (startmöbleringen, ens egen figur vid dörren), i en egen canvas. Går samma väg som ett
// besök – då sparas inget, inga husdjur skapas och inga möbler flyttas.
// → { canvas, rooms: [delrummens namn] } eller null för en okänd bostad.
export function renderHomePreview(A, homeId, sub = 0, { night = false } = {}) {
  const plan = PLANS[homeId];
  if (!plan) return null;
  const hop = hopping;
  const fakeG = { min: night ? 21 * 60 : 12 * 60, day: 1, deco: {}, storage: [], home: homeId, money: 0, passTime() {}, save() {} };
  const fake = { pxs: 1, W: FW, H: FH, game: fakeG, avatar: A.avatar, visitTarget: { id: '__visning', name: '', home: homeId, deco: {} },
    roomSub: sub, sceneName: '__visning', view: A.view, go() {} };
  let scene;
  try { scene = makeRoom(fake, { visit: true }); } finally { hopping = hop; }
  const w = scene.contentBox?.w || FW; // smala lokaler (och badrum): bara rummet, inte den mörka ytan bortom
  const full = document.createElement('canvas');
  full.width = FW; full.height = FH;
  const fctx = full.getContext('2d');
  fctx.imageSmoothingEnabled = false;
  scene.update(0);
  scene.draw(fctx);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = FH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(full, 0, 0);
  return { canvas, rooms: plan.rooms.map((r) => r.name) };
}

// ---------- sprite-props ----------
// En golvmöbel ur atlasen i sin rotationsvy: x = vänsterkant, y = fotlinje.
function spriteProp(d, decoIdx, sign) {
  const vw = viewOf(d.k, d.v, d.r);
  const f = frameOf(vw.k, vw.v);
  if (!f) return null;
  const [, , fw, fh] = f;
  // står saken på ett bord (up) ritas den så högt upp, direkt efter bordet – utan fotavtryck
  // på golvet; klickytan (hit) är bilden
  const lift = d.up > 0 ? d.up : 0;
  const x = d.x, base = d.y, foot = base - lift, top = foot - fh;
  const fn = functionOf(d.k);
  const label = sign ? labelOf(d.k) : null;
  const p = {
    k: d.k, fn, decoIdx, fx: d.fx, sort: base, top, label, plateX: x + fw / 2, plateY: top - 9,
    solid: lift ? null : [x - 1, base - solidH(d.k, fh), x + fw + 1, base + 1],
    hit: lift ? [x, top, x + fw, foot + 1] : null,
    draw(ctx) {
      ctx.fillStyle = 'rgba(20,12,28,0.22)';
      if (lift) ctx.fillRect(x + 1, foot - 1, fw - 2, 1); // skuggan på bordsskivan
      else { ctx.fillRect(x + 1, base - 1, fw - 2, 2); ctx.fillRect(x + 3, base + 1, fw - 6, 1); }
      const a = furnView(d.k, d.v, d.c, d.r); // cachad per (ruta, färg)
      if (a) drawArt(ctx, a, x, top);
    },
    // skylten ritas för sig (plateFy, se spreadPlates) – ovanpå möbler den hamnar över
    drawPlate(ctx) { if (label) ctxPlate(ctx, p.plateX, p.plateY, label); },
  };
  return p;
}
// Skyltarna över funktionsmöblerna får inte täcka varandra (badrummet: toa, handfat och
// badkar tätt ihop): den som står längst fram behåller sin plats, en skylt som krockar
// flyttas upp en rad i taget.
// Skyltarna ska inte heller hamna över dörrarna, dörrskyltarna eller fönstren (avoid):
// en skylt får då glida lite åt sidan (så länge den står över sin möbel), sjunka några
// pixlar ner på möbeln eller flyttas upp en rad – det som flyttar den minst vinner. Blir
// någon skylt utan fri plats prövas ordningen om med den skylten först (två skyltar som
// trängs under samma fönster).
const plateHits = (r, list) => list.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
function placePlates(list, avoid, right) {
  const placed = [], out = new Map(), stuck = [];
  for (const p of list) {
    const w = textW(SMALL, p.label) + 8, x = p.plateX;
    const rectAt = (cx, y) => [cx - w / 2, y - 1, cx + w / 2, y + 8];
    const lo = p.solid ? p.solid[0] + 1 : x, hi = p.solid ? p.solid[2] - 1 : x; // skylten mitt över möbeln
    const y0 = p.top - 9;
    let best = null;
    for (const dy of [0, 1, 2, 3, 4, 5, 6, 7, 8, -10, -20, -30]) for (let dx = -16; dx <= 16; dx++) {
      const cx = x + dx, r = rectAt(cx, y0 + dy);
      if ((dx && (cx < lo || cx > hi)) || r[0] < 1 || r[2] > right - 1 || r[1] < 1) continue;
      if (plateHits(r, placed) || plateHits(r, avoid)) continue;
      const cost = Math.abs(dx) + (dy > 0 ? dy * 3 : -dy);
      if (!best || cost < best.cost) best = { cx, y: y0 + dy, cost };
    }
    if (!best) { // inget fritt läge: som förr, uppåt tills den inte täcker en annan skylt
      stuck.push(p);
      let y = y0;
      for (let n = 0; n < 4 && plateHits(rectAt(x, y), placed); n++) y -= 10;
      best = { cx: x, y };
    }
    const r = rectAt(best.cx, best.y);
    placed.push(r);
    out.set(p, { cx: best.cx, y: best.y, r });
  }
  return { out, stuck };
}
function spreadPlates(props, avoid = [], right = FW) {
  const list = props.filter((q) => q.label).sort((a, b) => b.sort - a.sort || a.plateX - b.plateX);
  let res = placePlates(list, avoid, right);
  for (let n = 0; n < 3 && res.stuck.length; n++) {
    const again = placePlates([...res.stuck, ...list.filter((p) => !res.stuck.includes(p))], avoid, right);
    if (again.stuck.length >= res.stuck.length) break;
    res = again;
  }
  for (const p of list) {
    const { cx, y, r } = res.out.get(p);
    p.plateX = cx; p.plateY = y;
    // Skylten ritas i sorteringen strax efter den främsta möbel den hamnar över (en skylt
    // som glidit in över garderoben ska inte skymmas av den), men bakom figurer framför.
    p.plateFy = props.reduce((fy, q) => (q !== p && q.solid && plateHits(r, [[q.solid[0], q.top, q.solid[2], q.sort]]) ? Math.max(fy, q.sort) : fy), p.sort) + 0.01;
  }
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
    for (const o of list) { if (isWall(o.k) || o.k === 'matta' || isFlat(o.k) || o.up > 0) continue; if (overlaps(me, footOf(o.k, o.v, o.r, o.x, o.y).r)) return false; }
    return true;
  };
  for (let ty = FH - 8; y < 0 && ty > WALL_Y + 16; ty -= 6) for (let tx = 10; x < 0 && tx + w < RIGHT - 5; tx += 6) if (free(tx, ty)) { x = tx; y = ty; }
  if (x < 0) return null;
  const img = mattressArt();
  return {
    k: 'madrass', fn: 'sova', sort: y, top: y - h, x, base: y, w, h,
    solid: [x - 1, y - 8, x + w + 1, y + 1],
    act: null, // sätts av rummet: floorSleep (golvet ger sämre sömn)
    draw(ctx) { ctx.drawImage(img, x, y - h); ctxPlate(ctx, x + w / 2, y - h - 9, 'GOLVET'); },
  };
}
// Sova på golvet: som sängen, fast sämre (kvalitet 0,75) – och en påminnelse om förrådet.
// Samma sekvens som i sängen (figuren under en filt på madrassen), sedan veckan.
function floorSleep(A) {
  const g = A.game;
  openModal('😴 Sova på golvet', `<p style="font-size:20px">Ingen säng är utställd – den ligger i förrådet. Golvet är hårt, kallt och lite dammigt, men du somnar.</p>
    <p style="font-size:18px" class="bad">Sämre sömn än i en säng. Ställ ut sängen med 🛋️ Möblera!</p>`, [
    { label: 'Inte än', onClick: closeModal },
    { label: '😴 Sov ändå', cls: 'btn-go', onClick: () => {
      closeModal();
      const wake = () => {
        const { rent, eventText } = g.sleep(0.75);
        openWeek(A, { morning: true, rentPaid: rent, eventText });
        toast('🛏️ Aj, ryggen … Golvet är inget att sova på – ställ ut sängen med 🛋️ Möblera!', 'bad');
      };
      if (A.scene?.bedtime?.(wake)) return;
      play('sleep');
      wake();
      setTimeout(() => play('morning'), 600);
    } },
  ]);
}

// ================= sömnen =================
// Tidslinjen (sekunder): figuren lägger sig (lie), drar upp täcket (cover), lamporna
// släcks (off), mörkt (dark), gryning (dawn), ljust (light), täcket av (uncover), upp
// (up), klart (end → onWake). NIGHT_DIM = rummets vanliga kvällsdunkel.
const SLEEP = { lie: 0.35, cover: 0.62, off: 0.95, dark: 2.1, dawn: 3.25, light: 4.35, uncover: 4.45, up: 4.8, end: 5.35 };
const NIGHT_DIM = 0.22, SLEEP_DIM = 0.6;
const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
// Läget i sekvensen: dim = mörkret över rummet, warm = gryningens rosa, moon = månljuset,
// bg = vilken bakgrund ('now' = som vanligt, 'dark' = natt med släckta lampor, 'day'),
// lying = 0 står, 1 ligger med täcket nere vid bröstet, 2 under täcket.
function sleepState(s) {
  if (!s) return null;
  const t = s.t, a0 = s.night0 ? NIGHT_DIM : 0;
  const offAt = s.night0 ? SLEEP.off : (SLEEP.off + SLEEP.dark) / 2; // en dagslur: bytet sker i skymningen
  let dim = a0, warm = 0, moon = 0;
  if (t >= SLEEP.off && t < SLEEP.dawn) dim = a0 + (SLEEP_DIM - a0) * ease((t - SLEEP.off) / (SLEEP.dark - SLEEP.off));
  else if (t >= SLEEP.dawn) {
    const u = (t - SLEEP.dawn) / (SLEEP.light - SLEEP.dawn);
    dim = SLEEP_DIM * (1 - ease(u));
    warm = 0.2 * Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
  }
  if (t >= offAt && t < SLEEP.dawn) moon = ease((t - offAt) / (SLEEP.dark - offAt));
  else if (t >= SLEEP.dawn) moon = 1 - ease((t - SLEEP.dawn) / 0.5);
  const bg = t < offAt ? 'now' : t < SLEEP.dawn ? 'dark' : 'day';
  const lying = t < SLEEP.lie || t >= SLEEP.up ? 0 : t < SLEEP.cover || t >= SLEEP.uncover ? 1 : 2;
  return { t, dim, warm, moon, bg, lying, zs: zzzAt(t) };
}
// zzz: en bokstav var 0,55:e sekund medan det är mörkt, var och en lever 1,7 s
// (räknas ur tiden, så att en fryst bild – testernas hold – ändå visar flera)
function zzzAt(t) {
  const out = [];
  for (let i = 0; ; i++) {
    const born = SLEEP.off + 0.2 + i * 0.55;
    if (born > SLEEP.dawn - 0.2 || born > t) break;
    const age = t - born;
    if (age < 1.7) out.push({ i, age });
  }
  return out;
}
// bokstäverna: liten z (4×4) och stor Z (5×5)
const ZGLYPH = {
  s: ['1111', '0010', '0100', '1111'],
  b: ['11111', '00010', '00100', '01000', '11111'],
};
function drawZ(ctx, x, y, big, a) {
  const G = big ? ZGLYPH.b : ZGLYPH.s;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#17151a';
  for (let r = 0; r < G.length; r++) for (let c = 0; c < G[r].length; c++) if (G[r][c] === '1') ctx.fillRect(x + c - 1, y + r - 1, 3, 3);
  ctx.fillStyle = '#f4f1ea';
  for (let r = 0; r < G.length; r++) for (let c = 0; c < G[r].length; c++) if (G[r][c] === '1') ctx.fillRect(x + c, y + r, 1, 1);
  ctx.globalAlpha = 1;
}
// zzz ur huvudet (hx, hy = pannan): stiger snett uppåt, gungar lite, växer och tonar ut
function drawZzz(ctx, zs, hx, hy) {
  for (const z of zs) {
    const x = Math.round(hx + 3 + z.age * 7 + Math.sin(z.age * 4 + z.i) * 2);
    const y = Math.round(hy - 3 - z.age * 15);
    const a = z.age < 0.15 ? z.age / 0.15 : z.age > 1.3 ? Math.max(0, (1.7 - z.age) / 0.4) : 1;
    drawZ(ctx, x, y, z.age > 0.6, a);
  }
}

// Månljuset: ett svagt sken runt fönstren, blåvita fläckar på golvet snett nedanför dem
// (månen står högt till vänster) och månen själv i det första fönstret – genom frostat
// glas bara ett mjölkigt sken.
function buildMoon(wins, winY, view, RIGHT) {
  const P = new Pix(FW, FH);
  const [wy0, wy1] = winY;
  wins.forEach(([x0, x1], i) => {
    P.ell((x0 + x1) / 2, (wy0 + wy1) / 2, (x1 - x0) / 2 + 10, (wy1 - wy0) / 2 + 9, 0xb4c8ff, 0.14, 4);
    const len = 62;
    for (let y = WALL_Y; y < WALL_Y + len; y++) {
      const s = (y - WALL_Y) * 0.55, fade = 1 - (y - WALL_Y) / len;
      for (let x = Math.round(x0 + s); x < x1 + s && x < RIGHT - 4; x++) if (bayer(x, y) < fade * 0.9) P.px(x, y, 0xc8d8ff, 0.2);
    }
    if (i === 0 && view !== 'frost' && view !== 'betong') { // (Ettan: höghuset mittemot fyller fönstret – ingen måne)
      const mx = x0 + 8, my = wy0 + 7;
      P.ell(mx, my, 8, 8, 0xe8ecff, 0.3, 4);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (Math.hypot(dx, dy) > 3.3) continue;
        P.px(mx + dx, my + dy, (dx === 1 && dy === -1) || (dx === -1 && dy === 1) ? 0xd8d2b4 : dx + dy > 2 ? 0xe0dac0 : 0xf8f4e0);
      }
    }
  });
  return P.flush();
}

// ---------- figuren i sängen ----------
// Var huvudet hamnar i sängens bildruta (atlasens vy, ospeglad – speglade vyer speglas
// som hela bilden). front: huvudet uppåt, c = huvudets mittkolumn, fold = raden där
// täckets vikta kant ligger (hakan syns just ovanför), x0..x1 = kantens bredd, end =
// täckets nederkant. side: liggande med huvudet åt vänster (huvudet vridet ett kvarts
// varv), c = huvudets mittrad (dubbelsängen: den främre kudden), top = kolumnen där håret
// börjar, y0..y1 = täckets höjd, end = täckets högra kant. blanket = madrassen har inget
// täcke – en filt ritas.
const SLEEPER_AT = {
  sang: { c: 9, fold: 12, x0: 1, x1: 32, end: 24 },
  enkelsang: { c: 9, fold: 12, x0: 1, x1: 17, end: 24 },
  tvarsang: { side: true, c: 10, top: 3, y0: 4, y1: 20, end: 27 },
  tvardubbel: { side: true, c: 23, top: 3, y0: 5, y1: 29, end: 27 },
  madrass: { side: true, c: 9, top: 2, y0: 4, y1: 14, end: 32, blanket: true },
};
const SLEEP_TOP = 12; // luft ovanför sängen i bilden (håret når upp över sänggaveln)
// Avatarens huvud (samma sprite som när man går: hudfärg, frisyr, skägg – men utan hatt,
// glasögon, hörlurar och väska) med slutna ögon, plus översta tröjraderna. Ögonen ritas
// alltid som de vanliga (stjärn-, hjärt-, cyborg-, gråt- och spiralögon ska inte lysa i
// sömnen) och hittas genom att rita figuren en gång till med magentafärgade ögon: de
// pixlar som skiljer är ögonen (och glansen bredvid) – de målas över med huden och får
// ett stängt ögonlock (mörkare på ljus hud, nästan svart på mörk hud så att det syns).
// → { P: Pix (24 bred), PS: samma med benan igenfylld (sidvyerna), rows, torso: första
// tröjraden, skin, hair } (cachat per utseende)
const headCache = new WeakMap();
const lumOf = (c) => 0.299 * (c >> 16) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
function sleeperHead(look) {
  if (!look || typeof look !== 'object') return null;
  if (headCache.has(look)) return headCache.get(look);
  const L = { ...look, eyes: 'normal', hat: null, glasses: false, phones: false, bag: null };
  const kid = !!look.kid;
  const headTop = kid ? 14 : 6, torso = kid ? 25 : 18, eyeRow = headTop + (kid ? 6 : 7);
  const render = (lk) => {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 40;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    drawPerson(x, 12, 39, lk, 'down', 0);
    return x.getImageData(0, 0, 24, 40).data;
  };
  const a = render(L), b = render({ ...L, eyeColor: '#ff00ff' });
  const bottom = torso + 6;
  let hairTop = 0;
  while (hairTop < torso && ![...Array(24).keys()].some((x) => a[(hairTop * 24 + x) * 4 + 3] > 0)) hairTop++;
  const rows = bottom - hairTop;
  const P = new Pix(24, rows);
  for (let y = hairTop; y < bottom; y++) for (let x = 0; x < 24; x++) {
    const i = (y * 24 + x) * 4;
    if (a[i + 3] > 0) P.px(x, y - hairTop, (a[i] << 16) | (a[i + 1] << 8) | a[i + 2], a[i + 3] / 255);
  }
  // slutna ögon
  const eye = new Set();
  const key = (x, y) => y * 24 + x;
  for (let y = eyeRow - 3; y <= eyeRow + 2; y++) for (let x = 4; x < 20; x++) {
    const i = (y * 24 + x) * 4;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) eye.add(key(x, y));
  }
  if (eye.size) {
    for (const k of [...eye]) { // glansen (vita pixlar) intill ögat hör också till ögat
      const x = k % 24, y = (k / 24) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ((y + dy) * 24 + x + dx) * 4;
        if (a[i] > 235 && a[i + 1] > 235 && a[i + 2] > 235) eye.add(key(x + dx, y + dy));
      }
    }
    const skin = isHex(look.skin) ? parseInt(look.skin.slice(1), 16) : 0xeabf98;
    const lid = lumOf(skin) < 115 ? mix(skin, 0x080404, 0.72) : mix(skin, 0x2a1a14, 0.62);
    for (const k of eye) P.px(k % 24, ((k / 24) | 0) - hairTop, skin);
    // ett streck per öga i ögats nedersta rad (smala ögon förlängs utåt till två pixlar)
    const sides = [[...eye].filter((k) => k % 24 < 12), [...eye].filter((k) => k % 24 >= 12)];
    sides.forEach((ks, s) => {
      if (!ks.length) return;
      const xs = ks.map((k) => k % 24), ys = ks.map((k) => (k / 24) | 0);
      let x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y = Math.max(...ys);
      if (x1 === x0) { if (s === 0) x0--; else x1++; }
      for (let x = x0; x <= x1; x++) P.px(x, y - hairTop, lid);
    });
  }
  // Sidvyerna (huvudet vridet ett kvarts varv): benan i håret – en smal hudstrimma med hår
  // på båda sidor ovanför ögonbrynen – blir annars ett streck in i ansiktet (ett "+" med de
  // vridna ögonlocken). Den fylls med hårfärgen bredvid.
  const PS = new Pix(24, rows);
  PS.d.set(P.d);
  const d = PS.d, at = (x, y) => (y * 24 + x) * 4;
  const skinSet = new Set();
  for (let x = 10; x <= 13; x++) { const i = at(x, eyeRow + 1 - hairTop); if (d[i + 3] > 200) skinSet.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); }
  const isSkin = (x, y) => { const i = at(x, y); return d[i + 3] > 200 && skinSet.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); };
  const opaque = (x, y) => d[at(x, y) + 3] > 200;
  for (let y = 0; y < eyeRow - 3 - hairTop; y++) {
    for (let x = 1; x < 23; x++) {
      if (!isSkin(x, y) || isSkin(x - 1, y) || !opaque(x - 1, y)) continue;
      let e = x; while (e < 23 && isSkin(e, y)) e++;
      if (e - x <= 2 && e < 24 && opaque(e, y) && !isSkin(e, y)) {
        const i = at(x - 1, y), c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        for (let xx = x; xx < e; xx++) PS.px(xx, y, c);
      }
      x = e;
    }
  }
  const res = { P, PS, rows, torso: torso - hairTop, skin: isHex(look.skin) ? parseInt(look.skin.slice(1), 16) : 0xeabf98,
    hair: isHex(look.hair) ? parseInt(look.hair.slice(1), 16) : 0x3b2619 };
  headCache.set(look, res);
  return res;
}
// Bilden av figuren i sängen d (deco-posten, eller { k: 'madrass' }): sängens egen ruta i
// sin färg, huvudet på kudden och täcket med en vikt lakanskant under hakan och kroppens
// form under. covered = false: man har just lagt sig, täcket ligger nere vid bröstet.
// → { img, sx, sy, sw, sh, flip, oy: bildens överkant relativt sängens, head: [x, y] }
const sleeperCache = new WeakMap();
function sleeperArt(look, d, covered) {
  const vw = d.k === 'madrass' ? { k: 'madrass', v: 0, flip: false } : viewOf(d.k, d.v, d.r);
  const at = SLEEPER_AT[vw.k];
  const head = sleeperHead(look);
  if (!at || !head) return null;
  const bed = vw.k === 'madrass' ? { img: mattressArt(), sx: 0, sy: 0, sw: 34, sh: 16 } : furnArt(vw.k, vw.v, d.c);
  if (!bed) return null;
  let m = sleeperCache.get(look);
  if (!m) { m = new Map(); sleeperCache.set(look, m); }
  const ck = `${vw.k}|${vw.v}|${d.c || ''}|${covered ? 1 : 0}`;
  let out = m.get(ck);
  if (!out) { out = composeSleeper(bed, at, head, covered, vw.k === 'madrass'); if (m.size > 40) m.clear(); m.set(ck, out); }
  return { ...out, flip: vw.flip, head: vw.flip ? [out.sw - 1 - out.head[0], out.head[1]] : out.head };
}
// en hand som vilar på täckets kant: hud med ljus ovankant och mörk kontur
function sleeperHand(P, x, y, w, h, skin) {
  P.rect(x, y, w, h, skin);
  if (w > h) P.hl(x, y, w, mix(skin, 0xffffff, 0.25)); else P.vl(x, y, h, mix(skin, 0xffffff, 0.25));
  P.box(x - 1, y - 1, w + 2, h + 2, mul(skin, 0.45), 0.55);
}
// Filten på golvmadrassen: den ullfärg som skiljer sig mest från håret (rött hår på en
// rödbrun filt flöt ihop) – [bas, mörk, ränder]
const BLANKETS = [[0x9a4a3a, 0x7a3a2e, 0xe8dcc0], [0x3e5a86, 0x2e4468, 0xe8dcc0], [0x5a7040, 0x44562e, 0xf0e4b8]];
const colDist = (a, b) => Math.hypot((a >> 16) - (b >> 16), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255));
function composeSleeper(bed, at, head, covered, mattress) {
  // MX = luft på sidorna: stora frisyrer (afro) får sticka ut över sängkanten i stället för
  // att klippas rakt av. Bilden ritas MX px till vänster om sängen (ox).
  const MX = 5, M = SLEEP_TOP, W = bed.sw + MX * 2, H = bed.sh + M;
  const P = new Pix(W, H, -MX, 0); // koordinaterna nedan är sängens egna (0 = sängens vänsterkant)
  P.ctx.imageSmoothingEnabled = false;
  P.ctx.drawImage(bed.img, bed.sx, bed.sy, bed.sw, bed.sh, MX, M, bed.sw, bed.sh);
  P.img = P.ctx.getImageData(0, 0, W, H); P.d = P.img.data;
  const bedPx = P.d.slice(); // sängen före figuren (sidvyernas sänggavel ritas om ovanpå håret)
  const hd = (at.side ? head.PS : head.P).d, HR = head.rows, T = head.torso;
  const shift = covered ? 0 : 4;          // täcket nere: kanten 4 px längre ner, tröjan syns
  const upTo = covered ? T : T + 5;       // källrader som ritas (huvudet, och tröjan om täcket är nere)
  const src = (x, y) => { const i = (y * 24 + x) * 4; return hd[i + 3] ? [(hd[i] << 16) | (hd[i + 1] << 8) | hd[i + 2], hd[i + 3] / 255] : null; };
  const SHEET = 0xf4f0e6, SHEET_LO = 0xcfc8b8, SHEET_END = 0x8a8478;
  let hx, hy;
  if (!at.side) {
    // huvudet uppåt: källans första tröjrad hamnar på kantens rad
    const ox = at.c - 12, oy = M + at.fold - T;
    for (let y = 0; y < Math.min(HR, upTo); y++) for (let x = 0; x < 24; x++) { const p = src(x, y); if (p) P.px(ox + x, oy + y, p[0], p[1]); }
    const fy = M + at.fold + shift;
    for (let x = at.x0; x < at.x1; x++) {
      const end = x === at.x0 || x === at.x1 - 1;
      P.px(x, fy, end ? SHEET_END : SHEET); P.px(x, fy + 1, end ? SHEET_END : SHEET_LO);
    }
    P.darken(at.x0 + 1, fy + 2, at.x1 - at.x0 - 2, 1, 0.78);
    // kroppen under täcket: skugga längs sidorna, ljus kant till vänster, fötterna längst ner
    const yEnd = M + at.end;
    for (let y = fy + 3; y < yEnd - 1; y++) {
      const hw = y < fy + 6 ? 6 : 5;
      P.darken(at.c - hw - 1, y, 1, 1, 0.84); P.darken(at.c + hw, y, 1, 1, 0.84);
      P.px(at.c - hw, y, 0xffffff, 0.12);
    }
    for (const fx of [at.c - 3, at.c + 1]) { P.px(fx, yEnd - 3, 0xffffff, 0.16); P.px(fx + 1, yEnd - 3, 0xffffff, 0.16); P.darken(fx, yEnd - 2, 2, 1, 0.85); }
    if (covered) for (const hx0 of [at.c - 7, at.c + 5]) sleeperHand(P, hx0, fy - 1, 3, 2, head.skin); // händerna på täcket
    hx = at.c; hy = oy + T - 11;
  } else {
    // liggande åt vänster: källan vrids ett kvarts varv moturs (håret åt vänster)
    const ox = at.top, oy = M + at.c - 12;
    for (let y = 0; y < Math.min(HR, upTo); y++) for (let x = 0; x < 24; x++) { const p = src(x, y); if (p) P.px(ox + y, oy + 23 - x, p[0], p[1]); }
    // sänggaveln står framför huvudet: dess pixlar ritas om ovanpå håret (madrassen har ingen)
    if (!mattress) for (let y = 0; y < H; y++) for (let x = 0; x < at.top; x++) {
      const i = (y * W + x + MX) * 4;
      if (bedPx[i + 3] > 200) P.px(x, y, (bedPx[i] << 16) | (bedPx[i + 1] << 8) | bedPx[i + 2]);
    }
    const fx = at.top + T + shift;
    const y0 = M + at.y0, y1 = M + at.y1;
    if (mattress) { // filten: ull med två ljusa ränder vid fotänden, i en färg som skiljer sig från håret
      const [wool, woolDk, stripe] = BLANKETS.reduce((b, cand) => (colDist(cand[0], head.hair) > colDist(b[0], head.hair) ? cand : b));
      for (let y = y0 + 1; y <= y1; y++) for (let x = fx; x < at.end; x++) {
        let c = mix(wool, woolDk, hash(x >> 1, y, 77) * 0.5);
        if (x === at.end - 4 || x === at.end - 6) c = stripe;
        if (y === y0 + 1) c = mix(c, 0xffffff, 0.12);
        if (y === y1 || x === at.end - 1) c = mul(woolDk, 0.45);
        P.px(x, y, c);
      }
    }
    for (let y = y0; y < y1 + (mattress ? 1 : 0); y++) {
      const end = y === y0 || y === y1 - (mattress ? 0 : 1);
      P.px(fx, y, end ? SHEET_END : SHEET); P.px(fx + 1, y, end ? SHEET_END : SHEET_LO);
    }
    P.darken(fx + 2, y0 + 1, 1, y1 - y0 - 1, 0.78);
    const c = M + at.c;
    for (let x = fx + 3; x < at.end - 1; x++) {
      const hw = x < fx + 6 ? 6 : 5;
      P.darken(x, c - hw - 1, 1, 1, 0.84); P.darken(x, c + hw, 1, 1, 0.84);
      P.px(x, c - hw, 0xffffff, 0.12);
    }
    for (const fy of [c - 3, c + 1]) { P.px(at.end - 3, fy, 0xffffff, 0.16); P.px(at.end - 3, fy + 1, 0xffffff, 0.16); P.darken(at.end - 2, fy, 1, 2, 0.85); }
    if (covered) for (const hy0 of [c - 7, c + 5]) sleeperHand(P, fx - 1, hy0, 2, 3, head.skin);
    hx = ox + 6; hy = oy + 4;
  }
  // ox/oy = bildens hörn relativt sängens, bw = sängens egen bredd (skuggan under den)
  return { img: P.flush(), sx: 0, sy: 0, sw: W, sh: H, ox: -MX, oy: -M, bw: bed.sw, head: [hx + MX, hy] };
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
  const bath = roomDef.bath ? BATH[roomDef.tiles] || null : null; // kakelstilen (husvagnens toa har plastväggar)
  const outside = outsideOf(plan, roomDef);
  const anchor = roomDef.bath ? RIGHT : plan.fixAt || RIGHT; // var de fasta detaljerna sitter
  const [wy0, wy1] = roomDef.winY || plan.winY || WIN_Y;
  const view = roomDef.view || 'sky', style = winStyle(plan, view);
  // fönstren som faktiskt ritas (inte bakom en dörr eller utanför lokalen)
  const wins = visibleWindows(roomDef, RIGHT, subDoors);
  const cache = {};
  // night: false = dag, true = kväll med lamporna tända, 'dark' = natt med släckta lampor (sömnen)
  return (night) => {
    const key = night === 'dark' ? 'o' : night ? 'n' : 'd';
    if (cache[key]) return cache[key];
    const lit = !!night && night !== 'dark';
    const P = new Pix(FW, FH);
    const wall = night ? mul(roomDef.wall, 0.8) : roomDef.wall;
    const wallDk = night ? mul(roomDef.wallDk, 0.8) : roomDef.wallDk;

    // golvet
    const TW2 = 23, TH2 = 15;
    for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (bath) { P.px(x, y, bathFloor(x, y, bath)); continue; }
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

    // väggen med bröstpanel (badrummen har kakel, husvagnen och Förortsettan egna väggar)
    if (bath) paintBathWall(P, RIGHT, bath, !!night);
    else if (worn === 'husvagn') paintCaravanWall(P, RIGHT, wall, wallDk, anchor, !roomDef.bath);
    else if (worn === 'hoghus') paintEttaWall(P, RIGHT, wall, wallDk, anchor);
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
    if (!worn && !bath) {
      P.hl(4, 5, FW - 8, mul(wall, 0.6));
      P.hl(4, WALL_Y - 2, FW - 8, mix(wallDk, 0xffffff, 0.25));
    }
    if (lyx && !bath) { P.hl(4, WALL_Y - 20, FW - 8, 0xf0d070); P.hl(4, WALL_Y - 19, FW - 8, 0xc8a24a); }
    if (view === 'stad' && !roomDef.bath) ceilingSpots(P, RIGHT, lit); // takvåningens infällda spotlights

    // fönster: karm, utsikten (samma landskap genom alla fönster i rummet), spröjs, bänk
    for (const [wx0, wx1] of wins) {
      const ww = wx1 - wx0, wh = wy1 - wy0;
      const frame = style === 'steel' ? 0x2a2e36 : style === 'caravan' ? 0x2e2c30 : shabby ? 0xd8d0bc : worn === 'hoghus' ? 0xe2ddcc : 0xf0ece0;
      P.rect(wx0 - 2, wy0 - 2, ww + 4, wh + 4, frame);
      if (style !== 'caravan') P.box(wx0 - 2, wy0 - 2, ww + 4, wh + 4, style === 'steel' ? 0x14161c : mul(wall, 0.5));
      P.clip(wx0, wy0, wx1, wy1);
      paintView(P, view, wx0, wx1, wy0, wy1, night, shabby);
      if (worn === 'hoghus' && !roomDef.bath) for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) if (hash(x >> 1, y >> 2, 25) > 0.93) P.px(x, y, 0xb8b09a, 0.25); // flottiga rutor
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
    if (roomDef.bath) bathFixtures(P, RIGHT, roomDef, bath, lit, !!night, wall);
    else if (worn === 'husvagn') caravanFixtures(P, RIGHT, wins, wy0, wy1, lit, hasExit, wall, wallDk, anchor);
    else if (worn === 'hoghus') ettaFixtures(P, RIGHT, wins, wy0, wy1, lit, hasExit, wall, wallDk);

    // avdelarvägg + världen utanför lokalen: husvagnen har sin gårdsplätt och
    // Förortsettan trapphuset (Carls mobilfyllningsregel: ingen död yta i bild) –
    // övriga smala lokaler blir mörka och beskärs i fyll-läget av contentBox
    if (RIGHT < FW) {
      if (outside === 'gard') paintGard(P, RIGHT, !!night);
      else if (outside === 'trapphus') paintTrapphus(P, RIGHT, !!night);
      else for (let y = 5; y < FH; y++) for (let x = RIGHT; x < FW; x++) P.px(x, y, mix(0x17131c, 0x221c28, (bayer(x, y) - 0.5) * 0.4 + 0.5));
      for (let y = 5; y < FH; y++) {
        P.px(RIGHT - 3, y, mul(wallDk, 0.5)); P.px(RIGHT - 2, y, mix(wallDk, 0xffffff, 0.15));
        P.px(RIGHT - 1, y, wallDk);
      }
    }

    if (shabby && !roomDef.bath) paintShabby(P, RIGHT, wall, wallDk, lit, hasExit, roomDef, subDoors);

    // dörrarna: ut (bara rum 0) + delrumsdörrar – sist på väggen, så att sprickor, fläckar
    // och flagnande tapet aldrig hamnar ovanpå en dörr eller dess skylt
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

    // ljuskäglor + AO
    if (!shabby && !worn && night !== 'dark') for (let sx = 60; sx < RIGHT - 20; sx += 85) P.ell(sx, WALL_Y + 23, 22, 10, 0xfff3d0, night ? 0.05 : 0.1, 4);
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
//   frost    – badrummens frostade glas (ingen utsikt)
function paintView(P, view, x0, x1, y0, y1, night, dirty) {
  if (view === 'tomt') return viewTomt(P, x0, x1, y0, y1, night);
  if (view === 'betong') return viewBetong(P, x0, x1, y0, y1, night);
  if (view === 'tradgard') return viewTradgard(P, x0, x1, y0, y1, night);
  if (view === 'stad') return viewStad(P, x0, x1, y0, y1, night);
  if (view === 'frost') { // badrummens frostade glas: mjölkigt, ljusare upptill, ett svagt kornigt mönster
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = (y - y0) / (y1 - y0);
      let c = night ? mix(0x3a4666, 0x262c44, t) : mix(0xf0f4f6, 0xc8d6e0, t);
      if (((x + y) % 3) === 0) c = mix(c, 0xffffff, night ? 0.06 : 0.25);
      if (hash(x, y, 26) > 0.9) c = mul(c, 0.94);
      if (dirty && hash(x >> 1, y >> 1, 23) > 0.9) c = mix(c, 0x9a9070, 0.3);
      P.px(x, y, c);
    }
    return;
  }
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

// ================= badrummen =================
// Kakel och klinker per stil. wall/wall2 = plattorna (wall2 varannan platta), grout = fogen,
// tw×th = plattans mått, offset = förskjutna rader, half = kaklat upp från den höjden (ovanför
// målad vägg i färgen paint), band = en rad dekorplattor, vein = marmorådring, gold =
// mässingslist, worn = sprucket och smutsigt (Lilla rummet). Golvet: floor/floor2 (checker =
// schackrutor), fgrout, fw×fh. towel = handdukarnas färger.
const BATH = {
  sliten: { wall: 0xe2ddd0, grout: 0x9c9280, tw: 8, th: 8, floor: 0x9c968a, floor2: 0x8c8678, fgrout: 0x5e584c, fw: 7, fh: 5, towel: [0xc9423a, 0xd8ccb0], worn: true },
  '70tal': { wall: 0xc88a3a, wall2: 0xa8682c, grout: 0x5a3a1c, tw: 9, th: 9, band: 0x5a8a3a, floor: 0x7a5236, floor2: 0x6a4630, fgrout: 0x3a2618, fw: 8, fh: 6, towel: [0xe07a2e, 0x46a35a] },
  vit: { wall: 0xf0f0ea, grout: 0xc4c4bc, tw: 12, th: 6, offset: true, band: 0x3a7bd5, floor: 0xb4b8bc, floor2: 0xa4a8ac, fgrout: 0x74787c, fw: 8, fh: 6, towel: [0x3a7bd5, 0xf4f1ea] },
  bla: { wall: 0xa6cfe0, wall2: 0x96c2d6, grout: 0x7aa4b8, tw: 9, th: 9, half: 38, paint: 0xf2efe6, floor: 0xf0eee8, floor2: 0x6a9ec0, fgrout: 0xb8c4c8, fw: 10, fh: 7, checker: true, towel: [0xf0c020, 0xf4f1ea] },
  marmor: { wall: 0xf2eee8, grout: 0xd6cfc2, tw: 24, th: 14, vein: 0xb0a898, gold: true, floor: 0xece6da, floor2: 0xdcd4c6, fgrout: 0xc4baa8, fw: 23, fh: 15, towel: [0x2f6a64, 0xd8b24a] },
  skiffer: { wall: 0x3e4248, wall2: 0x363a40, grout: 0x25282c, tw: 20, th: 10, offset: true, gold: true, floor: 0x34373c, floor2: 0x2c2f34, fgrout: 0x1e2024, fw: 23, fh: 15, towel: [0xf4f1ea, 0x8a6a4a] },
};
function bathFloor(x, y, B) {
  const yy = y - WALL_Y;
  const tx = Math.floor(x / B.fw), ty = Math.floor(yy / B.fh), lx = x - tx * B.fw, ly = yy - ty * B.fh;
  let c = B.checker ? (((tx + ty) & 1) ? B.floor2 : B.floor) : mix(B.floor, B.floor2, hash(tx, ty, 131) * 0.7);
  c = mul(c, 0.97 + hash(tx, ty, 132) * 0.05);
  if (B.vein) { const v = Math.sin(x * 0.21 + yy * 0.43 + Math.sin(x * 0.07 + yy * 0.05) * 3); if (v > 0.97) c = mix(c, B.vein, 0.4); else if (v > 0.94) c = mix(c, B.vein, 0.15); }
  if (B.worn) { if (hash(tx, ty, 133) > 0.85) c = mix(c, 0x6a6048, 0.2); if (hash(x >> 1, y >> 1, 134) > 0.97) c = mul(c, 0.85); }
  if (lx === 0 || ly === 0) return B.worn ? mix(B.fgrout, 0x3a3226, hash(x, y, 135) * 0.6) : B.fgrout;
  if (lx === 1 || ly === 1) return mix(c, 0xffffff, 0.12);
  return c;
}
// Kaklet på bakväggen (och golvlisten); night = dämpat
function paintBathWall(P, RIGHT, B, night) {
  const y0 = B.half || 5;
  const bandRow = B.band ? Math.floor((WALL_Y - 26 - y0) / B.th) : -1;
  for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < RIGHT; x++) {
    let c;
    if (B.half && y < B.half) c = mix(mul(B.paint, 0.86), B.paint, Math.min(1, (y - 5) / 16) + (bayer(x, y) - 0.5) * 0.08);
    else {
      const row = Math.floor((y - y0) / B.th), ox = B.offset && (row & 1) ? B.tw >> 1 : 0;
      const tx = Math.floor((x - 4 + ox) / B.tw), lx = (x - 4 + ox) - tx * B.tw, ly = (y - y0) - row * B.th;
      c = B.wall2 && ((tx + row) & 1) ? B.wall2 : B.wall;
      if (row === bandRow) c = ((tx & 1) ? mix(B.band, 0xffffff, 0.15) : B.band);
      c = mul(c, 0.97 + hash(tx, row, 141) * 0.05);
      if (B.vein) { const v = Math.sin(x * 0.17 + y * 0.29 + Math.sin(x * 0.05 + y * 0.11) * 3.2); if (v > 0.97) c = mix(c, B.vein, 0.45); else if (v > 0.93) c = mix(c, B.vein, 0.16); }
      if (lx > 1 && ly > 1 && lx - ly === 2 && lx < B.tw - 2 && hash(tx, row, 142) > 0.45) c = mix(c, 0xffffff, 0.2); // glansen
      if (B.worn) {
        const k = hash(tx, row, 143);
        if (k > 0.965) c = mix(0x9a9488, 0x8a8478, hash(x, y, 144)); // en platta har ramlat ner – bruket syns
        else if (k > 0.88 && Math.abs(lx - ly - 1) === 0 && lx > 0) c = mul(B.grout, 0.8); // spricka
        c = mix(c, 0x8a7a58, Math.max(0, (y - (WALL_Y - 26)) / 90)); // smutsigt nertill
      }
      if (lx === 0 || ly === 0) c = B.worn && hash(x, y, 145) > 0.8 ? 0x4a4a36 : B.grout; // mögel i fogarna
      else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.14);
      else if (lx === B.tw - 1 || ly === B.th - 1) c = mul(c, 0.93);
    }
    if (y >= WALL_Y - 2) c = mul(B.grout, 0.7); // golvlisten
    P.px(x, y, night ? mul(c, 0.8) : c);
  }
  const top = B.half ? B.paint : B.wall;
  P.hl(4, 5, RIGHT - 4, mul(top, night ? 0.45 : 0.6));
  if (B.half) { P.hl(4, B.half - 1, RIGHT - 4, mul(B.paint, night ? 0.6 : 0.75)); P.hl(4, B.half, RIGHT - 4, night ? 0xb8b8b4 : 0xf8f8f4); } // kakelkanten
  if (B.gold) { P.hl(4, WALL_Y - 22, RIGHT - 4, night ? 0xa88a3a : 0xd8b24a); P.hl(4, WALL_Y - 21, RIGHT - 4, night ? 0x86682c : 0xa8823a); }
}
// Badrummets fasta detaljer: taklampan (lit = tänd på kvällen), handdukar på krokar,
// ventilen uppe i hörnet och (Lilla rummet) spindelväv och fuktfläck, (husvagnen)
// takluckan och toapappret.
function bathFixtures(P, RIGHT, def, B, lit, night, wall) {
  const wins = def.windows || [];
  const clear = (x, r) => x - r > 8 && x + r < RIGHT - 52 && !wins.some(([a, b]) => x + r > a - 4 && x - r < b + 4);
  const lampX = [Math.round(RIGHT * 0.3), Math.round(RIGHT * 0.45), Math.round(RIGHT * 0.2), 40].find((x) => clear(x, 7)) ?? 40;
  if (def.lamp === 'glodlampa') bareBulb(P, lampX, 24, lit);
  else if (def.lamp === 'plafond') {
    P.rect(lampX - 7, 5, 14, 2, 0xd8d4c8); P.rect(lampX - 6, 7, 12, 3, lit ? 0xfff6d8 : night ? 0x9a968a : 0xf4f0e6);
    P.hl(lampX - 5, 10, 10, lit ? 0xf0e0b0 : 0xc8c2b4);
    if (lit) { P.ell(lampX, 13, 34, 14, 0xfff0c0, 0.2, 4); P.ell(lampX, WALL_Y + 18, 40, 10, 0xfff3d0, 0.08, 4); }
  } else if (def.lamp === 'spots') ceilingSpots(P, RIGHT - 40, lit);
  else if (def.lamp === 'lysror') {
    const lx = Math.round(RIGHT / 2) - 18;
    P.rect(lx, 7, 22, 3, 0xe0dcd0); P.hl(lx, 9, 22, 0x9a968a); P.hl(lx + 1, 8, 20, lit ? 0xfffbe0 : 0xf4f0e4);
    if (lit) P.ell(lx + 11, 12, 30, 12, 0xf0f8ff, 0.2, 4);
    // takluckan (ventilationen) och toapappret på väggen bredvid toan
    const vx = Math.round(RIGHT / 2) + 10;
    P.rect(vx, 6, 14, 3, 0xb8bcc2); P.hl(vx, 6, 14, 0xdce0e4); P.hl(vx + 1, 8, 12, 0x6a6e74);
    for (let x = vx + 2; x < vx + 13; x += 3) P.px(x, 7, 0x4a4e54);
    P.rect(26, 66, 6, 2, 0xa8acb2); P.rect(27, 68, 4, 5, 0xf4f0e6); P.vl(30, 68, 5, 0xc8c4b8); P.px(28, 73, 0xf4f0e6);
  }
  // ventilen uppe till vänster
  if (B) {
    P.rect(8, 9, 9, 6, mix(B.grout, 0xffffff, 0.5)); P.box(8, 9, 9, 6, mul(B.grout, 0.8));
    for (let y = 10; y < 14; y += 2) P.hl(9, y, 7, mul(B.grout, 0.6));
  }
  // handdukar: en blank stång med två handdukar, skugga på väggen bakom
  const [t1, t2] = B?.towel || [0xc9423a, 0xf0e8d8];
  for (const tx of def.towels || []) {
    P.rect(tx - 7, 41, 15, 1, 0xd8dce0); P.hl(tx - 7, 42, 15, 0x8a8e94);
    P.rect(tx - 8, 40, 2, 4, 0x9a9ea4); P.rect(tx + 7, 40, 2, 4, 0x9a9ea4);
    [[tx - 6, t1, 15], [tx + 1, t2, 12]].forEach(([x0, col, len]) => {
      P.darken(x0 + 5, 44, 1, len, 0.82);
      for (let y = 42; y < 42 + len; y++) for (let x = x0; x < x0 + 5; x++) {
        let c = col;
        if (y === 42) c = mul(col, 0.85);                      // över stången
        else if (x === x0) c = mix(col, 0xffffff, 0.2);
        else if (x === x0 + 4) c = mul(col, 0.8);
        if (y >= 42 + len - 4 && y < 42 + len - 2) c = mix(c, 0xffffff, 0.45); // randen nertill
        if (y === 42 + len - 1 && (x & 1)) c = mul(c, 0.7);   // fransarna
        P.px(x, y, night ? mul(c, 0.8) : c);
      }
    });
  }
  if (B?.worn) { // Lilla rummets badrum: spindelväv, fuktfläck i taket, rostrand
    paintWeb(P, RIGHT - 5, 5, -1, 16, wall, RIGHT);
    for (let y = 6; y < 22; y++) for (let x = RIGHT - 44; x < RIGHT - 18; x++) {
      const d = Math.hypot((x - (RIGHT - 31)) / 13, (y - 9) / 9) + (hash(x, y, 146) - 0.5) * 0.35;
      if (d < 1) P.px(x, y, 0x6a5430, d > 0.8 ? 0.35 : 0.18);
    }
  }
}
// spindelväv i ett hörn: strålar + bågar (dirX = 1 åt höger, -1 åt vänster)
function paintWeb(P, cx, cy, dirX, r, wall, RIGHT) {
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
}
// naken glödlampa på sladd från taket (lit = tänd)
function bareBulb(P, bx, by, lit) {
  for (let y = 5; y < by - 4; y++) P.px(bx, y, 0x2a2420);
  P.rect(bx - 1, by - 5, 3, 3, 0x3a3530); P.px(bx - 1, by - 5, 0x5a5550);
  const glass = lit ? 0xfff0a8 : 0xe4dfc8, glassDk = lit ? 0xe6c860 : 0xb8b09a;
  P.rect(bx - 2, by - 2, 5, 5, glass); P.px(bx - 2, by - 2, glassDk); P.px(bx + 2, by - 2, glassDk); P.px(bx - 2, by + 2, glassDk); P.px(bx + 2, by + 2, glassDk);
  P.px(bx + 1, by + 1, glassDk); P.px(bx - 1, by - 1, 0xffffff);
  P.rect(bx - 1, by + 3, 3, 1, glassDk);
  if (lit) { P.ell(bx, by + 2, 28, 16, 0xffe9a0, 0.16, 3); P.ell(bx, by, 9, 7, 0xfff6c8, 0.35, 2); P.ell(bx, WALL_Y + 14, 34, 9, 0xfff3d0, 0.1, 4); }
  else P.ell(bx, WALL_Y + 20, 26, 9, 0xfff3d0, 0.06, 4);
}

// ---------- husvagnen ----------
// Linoleum i stora rutor, gulnad och sliten: ett gångstråk mitt i, fläckar och skarvar.
function caravanFloor(x, y, def) {
  const T = 12, yy = y - WALL_Y;
  const tx = Math.floor(x / T), ty = Math.floor(yy / T), lx = x - tx * T, ly = yy - ty * T;
  let c = mix(def.floorA, def.floorB, ((tx + ty) & 1) ? 0.25 : 0.7);
  c = mul(c, 0.97 + hash(tx, ty, 61) * 0.05);
  const wear = Math.max(0, 1 - Math.hypot((x - 70) / 60, (yy - 44) / 34));
  if (wear > 0 && bayer(x, y) < wear * 0.6) c = mix(c, 0xc8bca0, 0.22);
  const h = hash(x, y, 62);
  if (h > 0.96) c = mul(c, 0.92); else if (h < 0.025) c = mix(c, 0xffffff, 0.12);
  // gamla fläckar: mjuka, mörkare blaffor på några rutor
  if (hash(tx, ty, 63) > 0.91) { const d = Math.hypot(lx - 6, ly - 6) / 4.5 + (hash(x, y, 64) - 0.5) * 0.4; if (d < 1) c = mul(c, d < 0.6 ? 0.84 : 0.9); }
  if (lx === 0 || ly === 0) c = mul(c, 0.84);
  else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.06);
  return c;
}
// Väggarna: gulnade plastpaneler med nitar under det rundade taket, träimiterad
// plastmatta längs nederkanten med en aluminiumlist, rostränder och silvertejp.
// E = där rostfläcken och tejpen sitter (husvagnens gamla gavel – vagnen förlängdes för
// toadörren); details = false i toaskrubben (där får bara rostränderna plats).
function paintCaravanWall(P, RIGHT, wall, wallDk, E = RIGHT, details = true) {
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
  if (!details) return;
  // rostfläck vid golvlisten och silvertejp över en spricka
  for (let y = LOW + 2; y < WALL_Y - 2; y++) for (let x = E - 34; x < E - 18; x++) {
    const d = Math.hypot((x - (E - 26)) / 8, (y - (WALL_Y - 6)) / 7) + (hash(x, y, 74) - 0.5) * 0.5;
    if (d < 1) P.px(x, y, d < 0.5 ? 0x7a3a18 : 0x9a5226, d < 0.5 ? 0.8 : 0.5);
  }
  const tx = E - 30, ty = 24;
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
function caravanFixtures(P, RIGHT, wins, wy0, wy1, lit, hasExit, wall, wallDk, E = RIGHT) {
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
  for (const bx of [k0 + 5, k0 + 12]) { P.hl(bx - 2, top - 2, 5, 0x3a3438); P.hl(bx - 1, top - 1, 3, lit ? 0x8a2a1a : 0x4a3a3a); }
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
  const lx = Math.round(E / 2) - 10;
  P.rect(lx, 7, 22, 3, 0xe0dcd0); P.hl(lx, 9, 22, 0x9a968a); P.hl(lx + 1, 8, 20, lit ? 0xfffbe0 : 0xf4f0e4);
  if (lit) P.ell(lx + 11, 12, 30, 12, 0xf0f8ff, 0.2, 4);
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
  const ax = E - 24, ay = 16;
  P.rect(ax, ay, 11, 14, 0xf4efe0); P.rect(ax, ay, 11, 4, 0xc9323a); P.px(ax + 5, ay - 1, 0x3a3a40);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) P.px(ax + 2 + q * 2, ay + 6 + r * 2, r === 2 && q === 1 ? 0xc9323a : 0x8a8478);
  P.darken(ax + 11, ay + 1, 1, 14, 0.8); P.darken(ax + 1, ay + 14, 11, 1, 0.8);
}

// ---------- Förortsettan ----------
// 70-talstapet i bruna och orange ränder med ringar – solblekt upptill, smutsig nertill –
// med en sockel i stället för bröstpanel, ljusa fläckar där tavlor har hängt, en tapetvåd
// som släppt och en fuktfläck i taket.
function paintEttaWall(P, RIGHT, wall, wallDk, E = RIGHT) {
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
  for (const [gx, gy, gw, gh] of [[E - 42, 20, 16, 13], [140, 24, 10, 12]]) {
    for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) P.px(x, y, mix(P.get(x, y), 0xf0e6d0, 0.3));
    P.px(gx + (gw >> 1), gy - 2, 0x3a3228);
  }
  // en tapetvåd har släppt i överkanten: fliken hänger ner, gipsen syns bakom
  const sx = 95;
  for (let i = 0; i < 9; i++) { for (let x = sx - i; x <= sx; x++) P.px(x, 6 + i, 0xd8d0c0); }
  for (let i = 0; i < 8; i++) for (let x = sx + 1; x < sx + 9 - i; x++) P.px(x, 7 + i, i === 7 || x === sx + 8 - i ? 0x8a7a58 : 0xe6dcc6);
  // fuktfläcken i taket
  for (let y = 6; y < 24; y++) for (let x = E - 30; x < E - 4; x++) {
    const d = Math.hypot((x - (E - 16)) / 13, (y - 8) / 11) + (hash(x, y, 82) - 0.5) * 0.3;
    if (d < 1) P.px(x, y, 0x6a5430, d > 0.82 ? 0.35 : 0.18);
  }
}
// Radiatorn under vänstra fönstret (med en strumpa på tork), pentryt under det högra
// (laminatskiva, två plattor, diskho med kran, diskställ, skåp), plafonden i taket med
// döda flugor, strömbrytare, porttelefon och ett eluttag.
function ettaFixtures(P, RIGHT, wins, wy0, wy1, lit, hasExit, wall, wallDk) {
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
  P.rect(px - 6, 5, 12, 2, 0xd8d4c8); P.rect(px - 5, 7, 10, 2, lit ? 0xfff6d8 : 0xf0ece0); P.hl(px - 4, 9, 8, lit ? 0xf0e0b0 : 0xd8d2c4);
  P.px(px - 2, 8, 0x3a3228); P.px(px + 2, 7, 0x3a3228);
  if (lit) { P.ell(px, 12, 34, 14, 0xfff0c0, 0.22, 4); P.ell(px, WALL_Y + 18, 40, 10, 0xfff3d0, 0.08, 4); }
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
// ---------- husvagnens gårdsplätt ----------
// Utanför gaveln (Carls mobilfyllningsregel: hela 384×216 används): himlen och
// förortens skivhus bortom nätstängslet, grusplätten med tvättlina, klotgrill,
// campingstol, gasoltub, stödben vid vagnen, trampstenar och ett gammalt däck
// med blommor i. På kvällen lyser natriumlyktan vid stängslet orange.
function paintGard(P, x0, night) {
  const hz = 98;
  const sh = (c) => (night ? mul(c, 0.62) : c);
  // himlen och marken
  for (let y = 5; y < FH; y++) for (let x = x0; x < FW; x++) {
    if (y < hz) { P.px(x, y, skyPx(x, y, (y - 5) / (hz - 5), night, 91)); continue; }
    let c = mix(night ? 0x33312e : 0x9a917c, night ? 0x282624 : 0x847a66, hash(x >> 1, y, 92));
    if (hash(x, y >> 1, 93) > 0.88) c = night ? 0x203024 : [0x5a8a3a, 0x6a9a44, 0x4a7a32][(x + y) % 3]; // ogräs
    if (hash(x >> 2, y >> 2, 94) > 0.94) c = mul(c, 0.86); // gamla oljefläckar
    P.px(x, y, c);
  }
  if (!night) cloudsIn(P, x0 + 2, FW - 4, 10, hz - 26, 95);
  // förortens skivhus bortom stängslet
  for (let bx = x0 - 10; bx < FW; bx += 44) {
    const w = 26 + Math.round(hash(bx, 1, 96) * 12), h = 14 + Math.round(hash(bx, 2, 96) * 12), l = bx + Math.round(hash(bx, 3, 96) * 8);
    for (let y = hz - h; y < hz; y++) for (let x = Math.max(x0, l); x < Math.min(FW, l + w); x++) {
      let c = night ? 0x262a36 : mix(0xa4a8ac, 0xb8bcc0, hash(x >> 2, y, 97) * 0.5);
      if (x === l + w - 1) c = mul(c, 0.85);
      if (y === hz - h) c = night ? mul(c, 0.8) : mix(c, 0xffffff, 0.25);
      if ((x - l) % 4 === 1 && (y - (hz - h)) % 4 === 1 && y < hz - 1) c = night ? (hash(x, y, 98) > 0.55 ? 0xf0c878 : 0x1a1c26) : 0x7a8c9c;
      P.px(x, y, c);
    }
  }
  // nätstängslet på stolpar
  const ft = hz - 13, fb = hz + 2;
  for (let y = ft; y <= fb; y++) for (let x = x0; x < FW; x++) if (((x + y) & 3) === 0 || ((x - y) & 3) === 0) P.px(x, y, night ? 0x4a4e56 : 0x767a80, 0.7);
  P.hl(x0, ft, FW - x0, night ? 0x3a3e46 : 0x5a5e64);
  for (let x = x0 + 8; x < FW; x += 26) { P.vl(x, ft - 2, fb - ft + 5, night ? 0x3a3e46 : 0x55595e); P.px(x, ft - 3, night ? 0x2e3238 : 0x45494e); }
  // natriumlyktan vid stängslet
  const lx = FW - 30;
  P.vl(lx, hz - 34, 36, night ? 0x2a2c30 : 0x5a5e62); P.hl(lx - 6, hz - 34, 7, night ? 0x2a2c30 : 0x5a5e62);
  P.rect(lx - 8, hz - 33, 4, 3, night ? 0xffc060 : 0x8a8e92);
  if (night) { P.ell(lx - 6, hz - 27, 20, 14, 0xff9a40, 0.3, 4); P.ell(lx - 6, hz + 8, 30, 10, 0xff9a40, 0.12, 4); }
  // vagnens stödben och rostrand nere vid gaveln
  for (const [sx, sy] of [[x0 + 4, FH - 34], [x0 + 4, FH - 8]]) {
    P.line(x0, sy - 6, sx + 6, sy + 4, sh(0x8a8e94)); P.rect(sx + 5, sy + 4, 4, 2, sh(0x5a5e64)); P.rect(sx + 4, sy + 6, 6, 1, sh(0x3a3e44));
  }
  caravanRust(P, x0 + 1, 108, 16, 9);
  // gasoltuben vid vagnen
  const gx = x0 + 14, gy = 156;
  P.rect(gx, gy - 12, 9, 12, sh(0x2f6fae)); P.vl(gx + 1, gy - 11, 10, sh(0x5a9ade)); P.vl(gx + 7, gy - 11, 10, sh(0x1e4a78));
  P.hl(gx + 1, gy - 13, 7, sh(0x2f6fae)); P.rect(gx + 3, gy - 16, 3, 3, sh(0x8a8e94)); P.px(gx + 2, gy - 15, sh(0xb8bcc2));
  P.ell(gx + 4, gy + 1, 6, 2, 0x140c1c, 0.3, 3);
  // trampstenar från gaveln ut till grillen
  for (const [px, py] of [[x0 + 22, 190], [x0 + 36, 181], [x0 + 50, 190], [x0 + 43, 202]]) {
    P.ell(px, py, 6, 3, sh(0xa8a296), 1, 2); P.ell(px - 1, py - 1, 4, 2, sh(0xbcb6aa), 1, 2);
  }
  // tvättlinan: två stolpar, en handduk och strumpor på tork
  const p1 = x0 + 66, p2 = x0 + 124, py = 148;
  P.vl(p1, py - 34, 34, sh(0x6a4a2c)); P.vl(p1 + 1, py - 34, 34, sh(0x8a5e38)); P.hl(p1 - 3, py - 34, 7, sh(0x6a4a2c));
  P.vl(p2, py - 30, 30, sh(0x6a4a2c)); P.vl(p2 + 1, py - 30, 30, sh(0x8a5e38)); P.hl(p2 - 3, py - 30, 7, sh(0x6a4a2c));
  for (let x = p1 + 2; x < p2; x++) { const t = (x - p1) / (p2 - p1); P.px(x, Math.round(py - 33 + Math.sin(t * Math.PI) * 3 + t * 3), sh(0xd8d4c8), 0.9); }
  for (let i = 0; i < 12; i++) for (let j = 0; j < 14; j++) { // handduken
    const x = p1 + 12 + i, y = Math.round(py - 32 + Math.sin(((x - p1) / (p2 - p1)) * Math.PI) * 3 + (x - p1) / (p2 - p1) * 3) + 1 + j;
    P.px(x, y, sh(((j >> 2) & 1) ? 0xd9433b : 0xf0e8d8));
  }
  for (const sx of [p1 + 34, p1 + 42]) for (let j = 0; j < 6; j++) { // strumporna
    const y0 = Math.round(py - 32 + Math.sin(((sx - p1) / (p2 - p1)) * Math.PI) * 3 + (sx - p1) / (p2 - p1) * 3) + 1;
    P.px(sx, y0 + j, sh(j > 3 ? 0xd9433b : 0xf0c020)); P.px(sx + 1, y0 + j, sh(j > 3 ? 0xa82a24 : 0xc89a10), j > 1 ? 1 : 0);
  }
  // klotgrillen på tre ben
  const bx = x0 + 58, by = 184;
  P.ell(bx, by + 1, 9, 2.5, 0x140c1c, 0.35, 3);
  for (const [dx, dy] of [[-6, 0], [6, 0], [0, 1]]) P.line(bx + dx * 0.4, by - 7, bx + dx, by + dy, sh(0x3a3a40));
  for (let y = -14; y <= -6; y++) for (let x = -8; x <= 8; x++) {
    const e = (x / 8.5) ** 2 + ((y + 10) / 4.5) ** 2;
    if (e > 1) continue;
    let c = e > 0.75 ? 0x1e1e24 : 0x2e2e36;
    if (x + y < -16) c = 0x4a4a54;
    P.px(bx + x, by + y, sh(c));
  }
  P.hl(bx - 8, by - 10, 17, sh(0x16161a));
  P.rect(bx - 1, by - 17, 3, 2, sh(0x4a4a54)); P.px(bx, by - 18, sh(0x6a6a74)); // locket och knoppen
  P.rect(bx + 9, by - 12, 3, 1, sh(0x8a6a3a)); // sidohandtaget
  if (night) P.ell(bx, by - 8, 5, 2, 0xff6a2a, 0.4, 3);
  // campingstolen (randig duk, sedd snett framifrån)
  const cx = x0 + 94, cy = 188;
  P.ell(cx + 1, cy + 1, 8, 2.5, 0x140c1c, 0.3, 3);
  P.line(cx - 6, cy, cx - 2, cy - 10, sh(0x8a8e94)); P.line(cx + 6, cy, cx + 2, cy - 10, sh(0x8a8e94));
  P.line(cx - 5, cy, cx + 3, cy - 9, sh(0x6a6e74)); P.line(cx + 5, cy, cx - 3, cy - 9, sh(0x6a6e74));
  for (let j = 0; j < 5; j++) P.hl(cx - 5, cy - 10 - j, 10, sh((j & 1) ? 0xf0e8d8 : 0x3a7bd5)); // sitsen
  for (let j = 0; j < 9; j++) P.hl(cx - 4, cy - 24 + j, 9, sh(((j >> 1) & 1) ? 0xf0e8d8 : 0x3a7bd5)); // ryggen
  P.vl(cx - 5, cy - 24, 10, sh(0x8a8e94)); P.vl(cx + 5, cy - 24, 10, sh(0x8a8e94));
  // däcket med blommor i
  const tx = FW - 26, ty = FH - 12;
  for (let y = ty - 4; y <= ty + 3; y++) for (let x = tx - 8; x <= tx + 8; x++) {
    const e = ((x - tx) / 8) ** 2 + ((y - ty) / 4) ** 2;
    if (e <= 1 && e > 0.32) P.px(x, y, sh(e > 0.72 ? 0x16161a : 0x2a2a30));
  }
  for (const [dx, c] of [[-3, 0xd9433b], [0, 0xf0c020], [3, 0xf28bb3]]) {
    P.px(tx + dx, ty - 2, sh(c)); P.px(tx + dx, ty - 1, sh(0x2e6a2e));
  }
  if (night) { P.rect(x0, 5, FW - x0, FH - 5, 0x0a0f2a, 0.12); }
}

// ---------- Förortsettans trapphus ----------
// Utanför lägenhetsväggen: trapphuset på våning 7 – grönmålad bröstning, terrazzo,
// hissen med TRASIG-lapp (hissen går ibland!), anslagstavlan, trappautomaten som
// lyser på kvällen, pizzakartonger vid dörren och trappan ner mot våning 6.
function paintTrapphus(P, x0, night) {
  const sh = (c) => (night ? mul(c, 0.7) : c);
  const GRN = WALL_Y - 30;
  // väggen: ljus puts upptill, sliten grönmålad bröstning nertill
  for (let y = 5; y < WALL_Y; y++) for (let x = x0; x < FW; x++) {
    let c;
    if (y < GRN) {
      c = mix(0xd6d0be, 0xc8c2b0, hash(x >> 1, y >> 1, 101) * 0.6);
      if (hash(x >> 2, y >> 2, 102) > 0.96) c = mul(c, 0.9);
    } else if (y === GRN) c = 0x4a5a4e;
    else {
      c = mix(0x6f8f7a, 0x5f7f6a, hash(x >> 1, y, 103) * 0.7);
      if (y === GRN + 1) c = mix(c, 0xffffff, 0.15);
      if (hash(x, y, 104) > 0.965) c = mul(c, 0.85); // avskavd färg
      if (y >= WALL_Y - 3) c = mul(c, 0.6);
    }
    P.px(x, y, sh(c));
  }
  P.hl(x0, 5, FW - x0, sh(0xa8a292)); P.hl(x0, 6, FW - x0, sh(0xbcb6a4));
  // terrazzogolvet med stänk
  for (let y = WALL_Y; y < FH; y++) for (let x = x0; x < FW; x++) {
    let c = mix(0xb0aca0, 0xa39f92, hash(x, y, 105) * 0.5);
    const h = hash(x * 3 + 1, y * 7 + 2, 106);
    if (h > 0.9) c = 0x6a675e; else if (h < 0.04) c = 0xd8d4c8; else if (h > 0.885 && h <= 0.9) c = 0x8a5a4a;
    if ((x - x0) % 48 === 0 || (y - WALL_Y) % 32 === 0) c = mul(c, 0.88); // plattskarvar
    P.px(x, y, sh(c));
  }
  for (let i = 0; i < 4; i++) P.darken(x0, WALL_Y + i, FW - x0, 1, 0.78 + i * 0.05);
  // hissen: ståldörr med rombfönster, HISS-skylt och en tejpad TRASIG-lapp
  const hx = x0 + 12, hw = 34, ht = 24;
  P.rect(hx - 2, ht - 2, hw + 4, WALL_Y - ht + 2, sh(0x5a5e64)); P.hl(hx - 2, ht - 2, hw + 4, sh(0x7a7e84));
  for (let y = ht; y < WALL_Y; y++) for (let x = hx; x < hx + hw; x++) {
    let c = mix(0x9aa0a8, 0x8a9098, hash(x >> 2, y >> 2, 107) * 0.7);
    if (x === hx + (hw >> 1) - 1) c = 0x5a5e64; if (x === hx + (hw >> 1)) c = 0xb8bcc2;
    if (y === ht) c = 0xc8ccd2; if (y === WALL_Y - 1) c = 0x4a4e54;
    P.px(x, y, sh(c));
  }
  for (const [dx, dy] of [[0, -4], [1, -3], [2, -2], [1, -1], [0, 0], [-1, -1], [-2, -2], [-1, -3]]) // rombfönstret (vänster dörrblad)
    P.px(hx + 9 + dx, ht + 12 + dy, sh(night ? 0x1a1c22 : 0x2a3038));
  P.px(hx + 9, ht + 10, sh(0x4a5a6a));
  const hs = 'HISS', hsw = textW(SMALL, hs) + 6, hsx = hx + ((hw - hsw) >> 1);
  P.rect(hsx, ht - 11, hsw, 9, sh(0x1d2b1f)); P.box(hsx, ht - 11, hsw, 9, sh(0x0e1510));
  text(P, SMALL, hs, hsx + 3, ht - 9, night ? 0x9aba7a : 0xffd23f);
  // lappen: snett tejpad, rödpennat TRASIG
  const nx = hx + 6, ny = ht + 22;
  for (let j = 0; j < 11; j++) P.hl(nx + (j > 5 ? 1 : 0), ny + j, 26, sh(0xf4efe0));
  P.hl(nx + 1, ny - 1, 8, sh(0xd8d4c8), 0.8); // tejpbiten
  text(P, SMALL, 'TRASIG', nx + 2, ny + 3, 0xc9323a);
  P.hl(nx + 2, ny + 9, 22, sh(0x8a8478), 0.6);
  // 7 TR målat på putsen + anslagstavlan med lappar
  text(P, SMALL, '7 TR', x0 + 58, 16, sh(0x6a675e));
  const ax = x0 + 56, ay = 28;
  P.rect(ax, ay, 34, 24, sh(0x5a4632)); P.rect(ax + 2, ay + 2, 30, 20, sh(0x9a7a4e));
  for (let j = 0; j < 20; j++) for (let i = 0; i < 30; i++) if (hash(i, j, 108) > 0.88) P.px(ax + 2 + i, ay + 2 + j, sh(0x8a6a40));
  for (const [dx, dy, w, h, c] of [[4, 4, 9, 11, 0xf4efe0], [16, 5, 10, 8, 0xf0e0a0], [7, 13, 12, 7, 0xf4efe0]]) {
    P.rect(ax + dx, ay + dy, w, h, sh(c));
    for (let l = 2; l < h - 1; l += 2) P.hl(ax + dx + 1, ay + dy + l, w - 3, sh(0xa8a292));
    P.px(ax + dx + (w >> 1), ay + dy, sh(0xc9323a));
  }
  // trappautomaten (lyser varmt på kvällen)
  const tx = Math.min(x0 + 100, FW - 14), ty = 56; // (smalt trapphus när Ettan fick badrumsdörren: automaten får plats ändå)
  P.rect(tx, ty, 6, 8, sh(0xe8e2cc)); P.box(tx, ty, 6, 8, sh(0xa8a088));
  P.rect(tx + 2, ty + 3, 2, 2, night ? 0xffa040 : 0xc08030);
  if (night) P.ell(tx + 3, ty + 4, 7, 6, 0xffa040, 0.3, 3);
  // plafonden i taket
  const px = x0 + 66;
  P.rect(px - 6, 5, 12, 2, sh(0xd8d4c8)); P.rect(px - 5, 7, 10, 2, night ? 0xfff6d8 : sh(0xf0ece0)); P.hl(px - 4, 9, 8, night ? 0xf0e0b0 : sh(0xd8d2c4));
  if (night) { P.ell(px, 12, 30, 12, 0xfff0c0, 0.22, 4); P.ell(px, WALL_Y + 14, 34, 9, 0xfff3d0, 0.08, 4); }
  // pizzakartonger utanför grannens dörr
  const kx = x0 + 6, ky = 104;
  for (let i = 0; i < 3; i++) {
    const yy = ky - i * 5, xx = kx + (i & 1);
    P.rect(xx, yy - 4, 18, 5, sh(0xc8a878)); P.hl(xx, yy - 4, 18, sh(0xe0c294)); P.hl(xx, yy, 18, sh(0x8a6a40));
    P.px(xx + 4, yy - 2, sh(0xc9323a)); P.px(xx + 8, yy - 2, sh(0x46a35a)); P.hl(xx + 11, yy - 2, 4, sh(0x8a6a40));
  }
  P.ell(kx + 9, ky + 2, 10, 2.5, 0x140c1c, 0.3, 3);
  // trappan ner mot våning 6: öppning i golvet med räcke och nedåtgående steg
  const sx0 = FW - 78, sy0 = 132, sw = 64;
  P.hl(sx0 - 2, sy0 - 1, sw + 4, sh(0xd8d4c8)); // kantlisten
  for (let s = 0; s < 7; s++) {
    const yy = sy0 + s * 11, xx = sx0 + s * 3, w = sw - s * 3;
    if (yy >= FH) break;
    for (let j = 0; j < 11 && yy + j < FH; j++) for (let i = 0; i < w; i++) {
      let c = j < 3 ? mix(0xa8a496, 0x9a968a, hash(xx + i, yy, 109) * 0.5) : mix(0x6a675e, 0x54524a, j / 11);
      c = mul(c, 1 - s * 0.09);
      P.px(xx + i, yy + j, sh(c));
    }
    P.hl(xx, yy, w, sh(mul(0xd8d4c8, 1 - s * 0.08)));
  }
  // räcket längs öppningen: stolpar och en ledstång i trä som följer trappan ner
  for (let s = 0; s < 5; s++) {
    const bx = sx0 - 3 + s * 6, by = sy0 - 2 + s * 11;
    if (by > FH - 6) break;
    P.vl(bx, by - 16, 17, sh(0x4a4e56)); P.px(bx, by - 16, sh(0x6a6e76));
  }
  P.line(sx0 - 3, sy0 - 18, sx0 + 24, sy0 + 30, sh(0x8a5a30));
  P.line(sx0 - 2, sy0 - 18, sx0 + 25, sy0 + 30, sh(0xa87038));
  if (night) P.rect(x0, 5, FW - x0, FH - 5, 0x0a0f2a, 0.1);
}

// takvåningens infällda spotlights i taket
function ceilingSpots(P, RIGHT, lit) {
  for (let x = 40; x < RIGHT - 20; x += 64) {
    P.rect(x - 2, 6, 5, 2, 0xc8ccd4); P.hl(x - 1, 7, 3, lit ? 0xfff6d8 : 0xf4f4f0);
    if (lit) P.ell(x, 14, 12, 9, 0xfff0c8, 0.2, 4);
  }
}

// ---------- Lilla rummets förfall ----------
// Sprickor, fuktfläckar, flagnande tapet, spindelväv i hörnen, en naken glödlampa
// (lit = tänd på kvällen) och slitet golv. Allt deterministiskt ur hash().
function paintShabby(P, RIGHT, wall, wallDk, lit, hasExit, roomDef, subDoors = []) {
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
  // spindelväv i övre hörnen
  paintWeb(P, 5, 5, 1, 20, wall, RIGHT); paintWeb(P, RIGHT - 5, 5, -1, 16, wall, RIGHT);
  // naken glödlampa på sladd från taket – bredvid fönstret och dörrarna, inte framför dem
  const clear = (x) => x > 12 && x < RIGHT - 12 && !roomDef.windows.some(([a, b]) => x + 5 > a - 4 && x - 5 < b + 4) && !(hasExit && x + 5 > DOOR.x0 - 3 && x - 5 < DOOR.x1 + 3)
    && !subDoors.some((sd) => x + 5 > sd.x0 - 3 && x - 5 < sd.x1 + 3);
  bareBulb(P, [Math.round(RIGHT * 0.5) + 8, 70, RIGHT - 40, 20].find(clear) ?? Math.round(RIGHT * 0.5), 24, lit);
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
