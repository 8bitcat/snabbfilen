// SKOBUTIKEN – butiken för ENBART skor (scen 'skor' i js/main.js; huset med samma namn står
// på Södergatan i downtown, js/city/buildings-downtown.js). Gåbar och bredare än skärmen
// (640 px, kameran följer figuren; viewMax visar mer på breda skärmar). Svart och guld som
// fasaden, varm puts och fiskbensparkett i ek. Från vänster till höger längs bakväggen:
//
//   SNEAKERSVÄGGEN   svart ribbvägg med neonskylt och svävande hyllor med ljuslister:
//                    sneakers, höga sneakers, rutiga tygskor, blinkskor, kardborreskor,
//                    platåskor och clownskor. Blinkskornas sulor blinkar på hyllan.
//   SPEGELN          helfigursspegel i guldram – man ser sig själv i den när man står nära.
//   DÖRREN           glasdörr med guldram → staden.
//   KASSAN           disk i svart lack framför en vägg av skokartonger (med rullstege) och
//                    skylten SKOBUTIKEN. Kassörskan hälsar, tackar och ger en kartong.
//   KÄNGOR + STÖVLAR ekhylla med kängor, gummi-, rid-, cowboy- och vinterstövlar, stövletter.
//   FINA SKOR        vitt lackskåp med guldkant och glashyllor: klackskor, ballerinaskor,
//                    finskor, träskor, sandaler och flipflops.
// På golvet:
//   SPORTSTÄLLET     perforerad skiva med rull- och isskridskor och simfötter på krokar och
//                    en hylla med fotbollsskor i fem färger (neongula, gulgröna, rosa, svarta, vita).
//   PROVHÖRNAN       sammetsprovpall på en rund matta, golvspegel, skohorn på ställ,
//                    fotmätare och en öppen kartong. En kund provar stövletter. Sätter man sig
//                    på provpallen öppnas PROVHÖRNAN – alla skor i butiken i ett rutnät.
//   JÄTTESKON        en röd jättesneaker på en rund podie (samma som fasadens takskylt).
//   HEMMABORDET      tofflor, djurtofflor och raggsockor på ett lågt bord.
//   SKOPUTSEN        upphöjd putsstol med fotstöd; skoputsaren läser tidningen tills man sätter
//                    sig – då borstar han skorna blanka (gratis) och de glittrar en stund.
//   VECKANS SKO      svart podie med sammetskudde – en ny sko varje speldag (klick = prova den).
//   Ett barn i blinkskor springer mellan pallen och golvspegeln och pratar med kunden.
//   REA-dagar (g.eventIs('rea')) står en gatupratare med REA -25 % innanför dörren och
//   prislapparna blir röda.
//
// Sortimentet = klädkatalogens skor (js/data/wardrobe.js, slot 'shoes', utom gratisplaggen).
// SHOW nedan säger var varje modell står och i vilka färger; en ny sko i katalogen som inte
// står i SHOW hamnar automatiskt på NYHETER-podiet längst fram. Klick på en sko → figuren går
// dit → köpdialogen: prova skon (i den färg man klickade på) på DIN figur, med närbild av
// fötterna, byt färg/detaljfärg, köp och ta på direkt.
//
// KOPPLING TILL game.js – se shopApi() nedan. Butiken använder A.game.ownsItem(id),
// A.game.itemPrice(item) och A.game.buyItem(id) när de finns (katalog-id som 'shoes-sneakers');
// före integrationen finns en reserv som lägger id:t i g.wardrobe.
//
// MOBILEN (fyll-läget NÄRA) visar bara ett band av bildens höjd – då följer kameran figuren även
// i höjdled (band(), cam.wy nedan): vid väggarna syns hyllorna ända upp, längst fram hela golvet.
//
// _debug: spot(id) → { x, y } i SKÄRMkoordinater (kameran tittar dit om platsen är utanför
//   bild), items() (varje sko som visas: id, modell, spot, färger), buy(id) → { ok, msg?, price? },
//   owns(id), open(id[, färgIndex]) (köpdialogen), catalog() (provhörnans dialog), sit() (sätt
//   dig på provpallen), shine() (skoputsen), teleport(x, y), lockCam(x|null[, wy]), cam(),
//   camY() (höjdkameran: synlig ruta, översta världsraden, dy), tick(sek), state(),
//   panorama() (hela butiken som data-URL), spots() (alla klickbara platser).
import { drawPerson, entryOf } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { fmt } from '../game.js';
import { play } from '../core/sound.js';
import { saveAvatar } from '../core/avatar.js';
import { itemsForSlot, lookForItem, isWorn, groupOf } from '../data/wardrobe.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, nameTag, WALK_SEQ } from './walkable.js';
import { $t, $n } from '../core/i18n.js';

// ======================= koppling till spelet =======================
// Nya katalogsystemet (game.js efter integrationen): ownsItem(id) / itemPrice(item) / buyItem(id).
// Reserven (före integrationen): ägda katalog-id i g.wardrobe, REA −25 % som i klädaffären.
function shopApi(g) {
  const has = (k) => typeof g?.[k] === 'function';
  const rea = () => !!g?.eventIs?.('rea');
  const api = {
    owns: (it) => !!it && (!!it.free || (has('ownsItem') ? !!g.ownsItem(it.id) : Array.isArray(g.wardrobe) && (g.wardrobe.includes(it.id) || (!!it.legacy && g.wardrobe.includes(it.legacy))))),
    price: (it) => (has('itemPrice') ? g.itemPrice(it) : Math.round(it.price * (rea() ? 0.75 : 1))),
    rea: (it) => api.price(it) < it.price,
    buy(it) {
      if (!it) return { ok: false, msg: $t('Finns inte.') };
      if (has('buyItem')) return g.buyItem(it.id) || { ok: false, msg: $t('Köpet gick inte.') };
      if (api.owns(it)) return { ok: false, msg: $t('Dem har du redan!') };
      const price = api.price(it);
      if (g.money < price) return { ok: false, msg: $t('Du har inte råd – dags att jobba ett pass!') };
      g.money -= price;
      if (!Array.isArray(g.wardrobe)) g.wardrobe = [];
      g.wardrobe.push(it.id);
      g.save?.();
      return { ok: true, price };
    },
  };
  return api;
}

// ======================= mått (världskoordinater) =======================
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till butiken
const W = 640, H = 216, WALL_Y = 92;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const UNITS = {
  A: { x0: 8, x1: 196, top: 12, rows: [40, 60, 80], name: $t('SNEAKERS'), where: $n('Sneakersväggen') },
  B: { x0: 392, x1: 514, top: 12, rows: [54, 80], name: $t('KÄNGOR + STÖVLAR'), where: $n('Kängor och stövlar') },
  C: { x0: 522, x1: 632, top: 12, rows: [40, 60, 80], name: $t('FINA SKOR'), where: $n('Fina skor') },
};
const MIRROR = { x0: 203, x1: 229, top: 17, y: 90 };        // helfigursspegeln (ram)
const GLASS = { x0: 207, x1: 225, y0: 24, y1: 87 };
const DOOR = { x0: 238, x1: 270, top: 32 };
const DOOR_SPOT = [254, WALL_Y + 10];
const BOXW = { x0: 278, x1: 386 };                          // kartongväggen bakom kassan
const DESK = { x0: 290, x1: 374, top: 100, y: 124 };        // kassadisken (y = framkantens fot)
const CLERK_AT = [336, 108];
const PAY = [332, 134];
const PEG = { x0: 6, x1: 102, top: 103, y: 166 };           // sportstället
const PEG_HOOK = PEG.top + 11, PEG_SHELF = PEG.top + 46;
const BENCH = { x0: 136, x1: 216, y: 152 };                 // provpallen (y = golvet vid benen)
const SEAT_KUND = 152, SEAT_ME = 202;                       // sittplatsernas x
const FMIRROR = { x: 124, y: 153 };                         // golvspegeln
const HORN = { x: 224, y: 152 };                            // skohornet
const MEASURE = { x: 202, y: 170 };                         // fotmätaren på golvet
const OPENBOX = { x: 176, y: 166 };                         // öppna kartongen vid kunden
const STACK = { x: 240, y: 180 };                           // kartongtraven
const RUG = { cx: 178, cy: 156, rx: 72, ry: 25 };
const GIANT = { x: 304, y: 206 };                           // jätteskon (mitt, fot)
const TABLE = { x0: 396, x1: 508, y: 164 };                 // hemmabordet
const TABLE_TOP = TABLE.y - 13;                              // skornas fotlinje på bordet
const SHINE = { x0: 536, x1: 632, y: 180 };                 // skoputsens podium
const CHAIR = { x: 598, fy: 158 };                          // den som sitter i putsstolen (fötterna)
const SHINER_AT = [574, 163];                               // skoputsaren när han jobbar
const SHINE_GO = [548, 190];
const NEWS = { x0: 430, x1: 520, y: 208 };                  // NYHETER-podiet (bara om det behövs)
const PLANTS = [[14, 206], [628, 208], [382, 132]];
const VECKA = { x: 474, y: 206 };                           // VECKANS SKO-podiet
const REA_AT = [224, 119];                                  // gatupratare med REA (bara REA-dagar)
const LAMPS = [52, 150, 330, 452, 578];                     // takspottar

// ======================= var skorna står (modell → plats, rad, färger) =======================
// [shoeType, plats, rad, [[shoes, shoes2], …]] – första färgen = katalogens förslag.
// Platser: A/B/C = väggarna, PEG = sportstället (rad 0 = krokarna, 1 = hyllan), TABLE = hemmabordet.
const SHOW = [
  ['sneakers', 'A', 0, [['#3a7bd5', '#f4f1ea'], ['#c9323a', '#f4f1ea'], ['#2b2b30', '#f4f1ea']]],
  ['highTops', 'A', 0, [['#c9323a', '#f4f1ea'], ['#2b2b30', '#f4f1ea'], ['#46a35a', '#f4f1ea']]],
  ['slipOn', 'A', 1, [['#2b2b30', '#f4f1ea'], ['#c9323a', '#f4f1ea']]],
  ['lightUp', 'A', 1, [['#f28bb3', '#f4f1ea'], ['#3a7bd5', '#f4f1ea']]],
  ['velcro', 'A', 1, [['#3a7bd5', '#f0b429'], ['#46a35a', '#f4f1ea']]],
  ['platforms', 'A', 2, [['#2b2b30', '#f4f1ea'], ['#f28bb3', '#f4f1ea']]],
  ['clownShoes', 'A', 2, [['#c9323a', '#f0b429']]],
  ['ridingBoots', 'B', 0, [['#3b2619', '#3b2619']]],
  ['cowboyBoots', 'B', 0, [['#a86b32', '#a86b32'], ['#2b2b30', '#2b2b30']]],
  ['rubberBoots', 'B', 0, [['#3f7a3a', '#3f7a3a'], ['#f0b429', '#f0b429'], ['#c9323a', '#c9323a']]],
  ['boots', 'B', 1, [['#6b3e1e', '#6b3e1e'], ['#2b2b30', '#2b2b30']]],
  ['winterBoots', 'B', 1, [['#2f3440', '#2f3440'], ['#8a5a32', '#8a5a32']]],
  ['ankleBoots', 'B', 1, [['#2b2b30', '#2b2b30'], ['#8a5a32', '#8a5a32']]],
  ['heels', 'C', 0, [['#c9323a', '#c9323a'], ['#2b2b30', '#2b2b30'], ['#f28bb3', '#f28bb3']]],
  ['ballerina', 'C', 0, [['#c9323a', '#f4f1ea'], ['#2b2b30', '#f28bb3']]],
  ['dressShoes', 'C', 1, [['#2b2b30', '#2b2b30'], ['#6b3e1e', '#6b3e1e']]],
  ['clogs', 'C', 1, [['#7a2e2e', '#7a2e2e'], ['#2b2b30', '#2b2b30']]],
  ['sandals', 'C', 2, [['#6b3e1e', '#6b3e1e'], ['#f4f1ea', '#f4f1ea']]],
  ['flipflops', 'C', 2, [['#2aa39a', '#2aa39a'], ['#f28bb3', '#f28bb3'], ['#f0b429', '#f0b429']]],
  ['rollerSkates', 'PEG', 0, [['#f4f1ea', '#f28bb3']]],
  ['iceSkates', 'PEG', 0, [['#f4f1ea', '#f4f1ea']]],
  ['flippers', 'PEG', 0, [['#f0b429', '#f0b429']]],
  // Carls fotbollsskor: neongula, gulgröna, rosa, svarta och vita
  ['cleats', 'PEG', 1, [['#e8f030', '#2b2b30'], ['#b8e830', '#2b2b30'], ['#ff5fa8', '#2b2b30'], ['#2b2b30', '#f0b429'], ['#f4f1ea', '#2b2b30']]],
  ['slippers', 'TABLE', 0, [['#f28bb3', '#f28bb3'], ['#b9a3e8', '#b9a3e8']]],
  ['animalSlippers', 'TABLE', 0, [['#b98a5e', '#f28bb3'], ['#f4f1ea', '#f28bb3']]],
  ['woolSocks', 'TABLE', 0, [['#b9b3ab', '#f4f1ea'], ['#c9323a', '#f4f1ea']]],
];
const WHERE = { A: UNITS.A.where, B: UNITS.B.where, C: UNITS.C.where, PEG: $n('Sportstället'), TABLE: $n('Hemmabordet'), NEWS: $n('Nyheter') };

// ======================= skorna på hyllorna =======================
// Figurens skor är bara 5×2 px, så varje modell (SHOE_REG-id) har en egen sidovy för hyllan
// (tån åt höger, ~14 px lång) i samma pixelkorn som resten av spelet. Bokstäver:
//   b h l d  huvudfärgens ramp (look.shoes)   B H L D  detaljfärgens (look.shoes2)
//   w W vit sula/skugga · c C krämvit · n N mörk gummisula · i foder · k svart · g G guld
//   s S silver · u U päls · x y z trä · r röd · e vit snörning · q rutmönster (huvud/detalj)
//   1–4 blinkljus (byter färg med bildrutan)
// Konturen läggs på automatiskt och tonas efter grannen – precis som figurernas.
export const SHOE_ART = {
  sneakers: [
    '..hhh.........',
    '.hbbbih.......',
    '.bbbbbeHh.....',
    'bbbbbbbeHhh...',
    'bbbbbbbbbbbhh.',
    'bBBBBBbbbbbbbh',
    'BBBBBBBBBBBBBB',
    '.LLLLLLLLLLLL.',
  ],
  highTops: [
    '.hhhh.........',
    '.bbbbh........',
    '.bbbbeH.......',
    '.bwbbbeH......',
    '.bbbbbbeh.....',
    '.bbbbbbbeHhh..',
    'bbbbbbbbbbbHH.',
    'bbbbbbbbbbHHHH',
    'BBBBBBBBBBBBBB',
    '.LLLLLLLLLLLL.',
  ],
  slipOn: [
    '..qqq.........',
    '.qqqqii.......',
    '.qqqqqiih.....',
    'qqqqqqqqqhh...',
    'qqqqqqqqqqqhh.',
    'qqqqqqqqqqqqqh',
    'cccccccccccccc',
    '.CCCCCCCCCCCC.',
  ],
  lightUp: [
    '..hhh.........',
    '.hbbbih.......',
    '.bbbbbeHh.....',
    'bbbbbbbeHhh...',
    'bbbbbbbbbbbhh.',
    'bbbbbbbbbbbbbh',
    'B1BB2BB3BB4BBB',
    '.LLLLLLLLLLLL.',
  ],
  velcro: [
    '..hhh.........',
    '.hbbbih.......',
    '.bbbbHBBh.....',
    'bbbbbbbbbhh...',
    'bbbbbbHBBBbhh.',
    'bbbbbbbbbbbbbh',
    'cccccccccccccc',
    '.CCCCCCCCCCCC.',
  ],
  platforms: [
    '..hhh.........',
    '.hbbbih.......',
    '.bbbbbeHh.....',
    'bbbbbbbeHhh...',
    'bbbbbbbbbbbhh.',
    'bbbbbbbbbbbbbh',
    'HHHHHHHHHHHHHH',
    'BBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBB',
    'LLLLLLLLLLLLLL',
    '.DDDDDDDDDDDD.',
  ],
  clownShoes: [
    '..hhh.............',
    '.hbbbiH......hhh..',
    '.bbbbbBH...hhbbbh.',
    'bbbbbbbBhhhbbbbbbh',
    'bbbbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbbbb',
    'llllllllllllllllll',
    '.dddddddddddddddd.',
  ],
  boots: [
    '.hhhhh.......',
    '.bbbbbl......',
    '.bbbbbgh.....',
    '.bbbbbbgl....',
    '.lbbbbbbgh...',
    '.lbbbbbbbbhh.',
    'lbbbbbbbbbbbh',
    'lbbbbbbbbbbbb',
    'nnnnnnnnnnnnn',
    'NnNnNnNnNnNnN',
  ],
  rubberBoots: [
    'lllllll.....',
    'bhbbbbl.....',
    'bwhbbbb.....',
    'bwhbbbb.....',
    'bwhbbbb.....',
    'bwhbbbb.....',
    'bwhbbbb.....',
    'bwhbbbbh....',
    'bbhbbbbbhh..',
    'bbbbbbbbbbh.',
    'bbbbbbbbbbbh',
    'lbbbbbbbbbbb',
    'nnnnnnnnnnnn',
    '.NNNNNNNNNN.',
  ],
  ridingBoots: [
    'dddddd......',
    'bhbbbl......',
    'bhbbbl......',
    'bhbbbl......',
    'bhbbbl......',
    'bhbbbl......',
    'bhbbbl......',
    'bhbbbbl.....',
    'bbbbbbbhh...',
    'bbbbbbbbbhh.',
    'lbbbbbbbbbbh',
    'dddlldddddd.',
    'ddd.........',
  ],
  cowboyBoots: [
    'l....l.......',
    'bl..lb.......',
    'bbllbb.......',
    'bbbbbb.......',
    'bhbbhb.......',
    'bbhhbb.......',
    'bhbbhbl......',
    'bbbbbbbhh....',
    'bbbbbbbbbhh..',
    'lbbbbbbbbbbhh',
    'ddlllllllllll',
    '.dd..........',
  ],
  winterBoots: [
    'uUuUuUu.....',
    'UuUuUuUu....',
    '.bbbbbbh....',
    '.bbbbbbbh...',
    '.lbbbbbbbh..',
    'blbbbblbbbh.',
    'bbbbbbbbbbbh',
    'lbbbbbbbbbbb',
    'nnnnnnnnnnnn',
    'NnNnNnNnNnNN',
  ],
  ankleBoots: [
    '.l..........',
    '.hhhhhh.....',
    '.bblllbh....',
    '.bbblbbbh...',
    '.bbbbbbbbh..',
    '.bbbbbbbbbhh',
    '.lbbbbbbbbbb',
    'ddddlldddddd',
    'ddd.........',
  ],
  dressShoes: [
    '.hhh..........',
    'hbbbih........',
    'bbbbbbdh......',
    'bbbbbbbdhhh...',
    'lbbbbbbbbbbwhh',
    'llbbbbbbbbbbbb',
    'dddddddddddddd',
    'ddd...........',
  ],
  ballerina: [
    '.hh.....BHB..',
    'hbiiiiiibBbh.',
    'bbbbbbbbbbbbh',
    'lbbbbbbbbbbbb',
    '.dddddddddddd',
  ],
  heels: [
    '.hh...........',
    '.bbh..........',
    '.bbbih........',
    '.bbbbiih......',
    '.lbbbbbbhh....',
    '..llbbbbbbhh..',
    '.d..ldbbbbbbbh',
    '.d....dddddddd',
    '.d............',
    'dd............',
  ],
  clogs: [
    '.....hhh....',
    '....gbbbbh..',
    '...gbbbbbbh.',
    'x.gbbbbbbbbh',
    'xxxxxxxxxxxx',
    'yyyyyyyyyyyy',
    '.zzzzzzzzzz.',
  ],
  sandals: [
    '.hbbh.......',
    '.bxxb..hbbh.',
    '.bxxbhbbxxbh',
    '.bxxxbxxxxxb',
    'hhhhhhhhhhhh',
    'bbbbbbbbbbbb',
    '.llllllllll.',
  ],
  flipflops: [
    '.......hh....',
    '...hbbbb.b...',
    'hbbbbbbbbbbbh',
    '.lllllllllll.',
  ],
  slippers: [
    '....uUuUu....',
    '...Ubbbbbbh..',
    '..ubbbbbbbbbh',
    'hhbbbbbbbbbbb',
    'lllllllllllll',
    '.ddddddddddd.',
  ],
  animalSlippers: [
    '.....bb..bb..',
    '....bhbbbhbb.',
    '...bbbbbbkbbb',
    '..bbbbbbbbbbB',
    'hlbbbbbbbbbb.',
    'llllllllllll.',
  ],
  woolSocks: [
    'HHHHH......',
    'BHBHB......',
    'bhbhb......',
    'bbhbb......',
    'bhbhb......',
    'bbbbbh.....',
    'bhbbbbhbh..',
    'bbbhbbbbbbh',
    'Lbbbbbbbbbb',
    '.lllllllll.',
  ],
  cleats: [
    '..hhh.........',
    '.hbbbih.......',
    '.bbbbbeHh.....',
    'bbbbbbbeHhh...',
    'bBBBBBBbbbbhh.',
    'bbbbbbbbbbbbbh',
    'nnnnnnnnnnnnnn',
    '.w..w...w..w..',
  ],
  rollerSkates: [
    '.hhhhh........',
    '.bbbbbH.......',
    '.bbbbbbH......',
    '.bbbbbbbH.....',
    '.bbbbbbbbH....',
    '.bbbbbbbbbhh..',
    'bbbbbbbbbbbbh.',
    'bbbbbbbbbbbbbh',
    'ssssssssssssrr',
    '.S.S.....S.Sr.',
    'BBBB....BBBB..',
    'LBBL....LBBL..',
  ],
  iceSkates: [
    '.hhhhh.......',
    '.bbbbbl......',
    '.bbbbbbl.....',
    '.bbbbbbbl....',
    '.bbbbbbbbhh..',
    'bbbbbbbbbbbh.',
    'lbbbbbbbbbbbh',
    'llllllllllll.',
    '.S......S....',
    'sssssssssssss',
  ],
  flippers: [
    '..hhh...............',
    '.hbbbbh.............',
    'bbbbbbbbhhhhhhhh....',
    'lbbbbbbbblbbbblbbbhh',
    '.llllllllllllllllll.',
  ],
  normal: [
    '..hhh.........',
    '.hbbbih.......',
    '.bbbbbbbh.....',
    'bbbbbbbbbhh...',
    'bbbbbbbbbbbhh.',
    'bbbbbbbbbbbbbh',
    'nnnnnnnnnnnnnn',
    '.NNNNNNNNNNNN.',
  ],
};

// fasta färger i kartorna
const FIX = {
  w: 0xf6f3ec, W: 0xcfc8b8, e: 0xf6f3ec, c: 0xefe3c4, C: 0xc8b894, n: 0x3d3530, N: 0x25201c, k: 0x1c1814,
  g: 0xf0d060, G: 0xb08a2a, s: 0xe4e8ee, S: 0x9098a4, u: 0xf6f1e6, U: 0xd8cfbe, x: 0xe8c088, y: 0xc89858, z: 0x9a6c38, r: 0xc9323a,
};
const BLINK = [0xff4d6d, 0x4de1ff, 0x7dff6b, 0xffd23f];
const rampOf = (c) => ({ hi: mix(mul(c, 1.12), 0xfff4e0, 0.12), base: c, lo: mix(mul(c, 0.74), 0x2a1f3a, 0.12), dk: mix(mul(c, 0.5), 0x1a1426, 0.2) });
const hexInt = (h, fb) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : fb);
const ICONS = new Map();
const blinks = (model) => /[1-4]/.test((SHOE_ART[model] || []).join(''));

// Skons bild för hyllan: { img, w, h } (w/h inklusive kontur). frame byter blinkljusen.
export function shoeIcon(model, main = '#3a7bd5', second = '#f4f1ea', frame = 0) {
  const map = SHOE_ART[model] || SHOE_ART.normal;
  const f = blinks(model) ? frame & 3 : 0;
  const key = model + main + second + f;
  let ic = ICONS.get(key);
  if (ic) return ic;
  const M = rampOf(hexInt(main, 0x3a7bd5)), S = rampOf(hexInt(second, 0xf4f1ea));
  const lining = mix(M.dk, 0x100c14, 0.5);
  const w = map[0].length + 2, h = map.length + 2;
  const c = mkCanvas(w, h);
  const x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const put = (px, py, col) => { const i = (py * w + px) * 4; d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255; d[i + 3] = 255; };
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      let col;
      switch (ch) {
        case 'h': col = M.hi; break; case 'b': col = M.base; break; case 'l': col = M.lo; break; case 'd': col = M.dk; break;
        case 'H': col = S.hi; break; case 'B': col = S.base; break; case 'L': col = S.lo; break; case 'D': col = S.dk; break;
        case 'i': col = lining; break;
        case 'q': col = (i + j) & 1 ? S.base : M.base; break;
        case '1': case '2': case '3': case '4': col = BLINK[(+ch + f) & 3]; break;
        default: col = FIX[ch] ?? M.base;
      }
      put(i + 1, j + 1, col);
    }
  });
  // kontur: varje tom pixel intill skon får en mörk ton av grannen (ovan > vänster > höger > under)
  const src = new Uint8ClampedArray(d), ROW = w * 4;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = (py * w + px) * 4;
    if (src[i + 3]) continue;
    let b = -1;
    if (py > 0 && src[i - ROW + 3]) b = i - ROW;
    else if (px > 0 && src[i - 1]) b = i - 4;
    else if (px < w - 1 && src[i + 7]) b = i + 4;
    else if (py < h - 1 && src[i + ROW + 3]) b = i + ROW;
    if (b < 0) continue;
    d[i] = src[b] * 0.28 + 14; d[i + 1] = src[b + 1] * 0.24 + 10; d[i + 2] = src[b + 2] * 0.3 + 20; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  ic = { img: c, w, h };
  ICONS.set(key, ic);
  return ic;
}

// ======================= små verktyg =======================
const WHITE = 0xffffff, INK = 0x17151a, GOLD = 0xd8b060, GOLD_HI = 0xf6e0a0, GOLD_LO = 0x8a6a2a, LACK = 0x1c1c20;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = fn(x + i, y + j, i, j);
    if (c !== null && c !== undefined) P.px(x + i, y + j, c);
  }
}
function spr(P, x, y, rows, pal) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = pal[rows[j][i]]; if (c !== undefined) P.px(x + i, y + j, c); }
}
function glowImg(rx, ry, c, amax, steps = 4) {
  const P = new Pix(Math.ceil(rx) * 2 + 2, Math.ceil(ry) * 2 + 2);
  P.ell(P.w / 2, P.h / 2, rx, ry, c, amax, steps);
  return P.flush();
}
function glowText(P, F, s, x, y, c, glow, scale = 1, a = 0.35) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) text(P, F, s, x + dx, y + dy, glow, a, scale);
  text(P, F, s, x, y, c, 1, scale);
}
// kontur runt allt som är målat i en Pix (tonad efter grannen, som figurerna)
function outline(P) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d), ROW = w * 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let b = -1;
    if (y > 0 && src[i - ROW + 3] > 200) b = i - ROW;
    else if (x > 0 && src[i - 1] > 200) b = i - 4;
    else if (x < w - 1 && src[i + 7] > 200) b = i + 4;
    else if (y < h - 1 && src[i + ROW + 3] > 200) b = i + ROW;
    if (b < 0) continue;
    d[i] = src[b] * 0.28 + 14; d[i + 1] = src[b + 1] * 0.24 + 10; d[i + 2] = src[b + 2] * 0.3 + 20; d[i + 3] = 255;
  }
}
// text i spelets pixeltypsnitt: versaler, ÅÄÖÉ, siffror och några tecken
const safeTxt = (s) => String(s).replace(/­/g, '').toUpperCase().replace(/[–—]/g, '-').replace(/&/g, '+').replace(/[^A-ZÅÄÖÉ0-9 \-+!.:,?/%'=ÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿€$]/g, '');
const plain = (s) => String(s).replace(/­/g, '');
const isNight = (h) => h >= 19.5 || h < 6.5;
function darkness(hour) {
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}

// ======================= figurerna =======================
const CLERK = { skin: '#eec3a0', hair: '#6b4226', style: 'bun', top: 'blouse', shirt: '#1c1c20', accent: '#d8b060', neck: 'necklace', neckColor: '#d8b060', bottom: 'pants', pants: '#2b2b30', shoeType: 'heels', shoes: '#c9323a', build: 5, cheeks: 'blush', glasses: false, hat: null, bag: null, phones: false, beard: false };
const KUND = { skin: '#f6d7bf', hair: '#b7392b', style: 'wavy', top: 'cardigan', shirt: '#26605a', accent: '#f4f1ea', bottom: 'skirt', pants: '#2b2b30', shoeType: 'ankleBoots', shoes: '#6b3e1e', build: 5, glasses: 'round', hat: null, bag: null, phones: false, beard: false };
const SHINER = { skin: '#c68a5c', hair: '#b9b3ab', style: 'short', beard: 'mustache', top: 'waistcoat', shirt: '#3a2a22', accent: '#f4f1ea', hat: 'flatCap', cap: '#5a5048', bottom: 'suitPants', pants: '#2f3440', shoeType: 'dressShoes', shoes: '#1c1c1c', apron: true, build: 5, glasses: false, bag: null, phones: false };
const KID = { kid: true, build: 4, skin: '#eec3a0', hair: '#d9a95c', style: 'pigtails', top: 'tee', shirt: '#f0b429', accent: '#f4f1ea', bottom: 'dungareeShorts', pants: '#6a8fc4', shoeType: 'lightUp', shoes: '#f28bb3', shoes2: '#f4f1ea', glasses: false, hat: null, bag: null, phones: false, beard: false };
const KID_ROUTE = [[132, 176, 'up', 2.6], [178, 198, 'down', 1.2], [238, 202, 'left', 1.5], [150, 190, 'up', 1.2]];
const KUND_SAYS = [$t('De här klämmer lite vid tån...'), $t('Har ni dem i storlek 38?'), $t('Hmm, bruna eller svarta?'), $t('Jag tar nog stövletterna!'), $t('Så sköna! 😊')];
const KID_SAYS = [$t('Titta, de blinkar! ✨'), $t('Mamma, titta på mina skor!'), $t('Jag springer jättefort i dem!'), $t('Pip pip! 👟')];
const KUND_TO_KID = [$t('Jättefina, gumman!'), $t('Ja, jag ser! 😄'), $t('Spring inte in i spegeln nu!')];
const CLERK_SAYS = [$t('Hej och välkommen! 👋 Sätt dig på provpallen så får du se alla skor.'), $t('Klicka på en sko så får du prova den på dig.'), $t('Behöver du hjälp med storleken? Fotmätaren ligger vid pallen!')];
const SHINE_SAYS = [$t('Blanka som speglar! ✨ Välkommen åter!'), $t('Så där – nu glänser de! ✨'), $t('Klart! Nu kan du spegla dig i tårna. ✨')];

// ======================= scenen =======================
export function makeShopSkor(A) {
  const g = A.game;
  const api = shopApi(g);
  let t = 0, lockedCam = null, peekCam = null, hoverId = null, hoverT = -9, hoverShoe = null;
  const me = { mode: 'free', boxUntil: 0, shinyUntil: 0, arrived: null, seat: null };
  const shine = { state: 'idle', t0: 0, doneT: 0 };

  // ---------- sortimentet: katalogens skor, placerade enligt SHOW ----------
  const catalog = itemsForSlot('shoes').filter((it) => !it.free);
  const byModel = new Map(catalog.map((it) => [it.look.shoeType, it]));
  const groups = [];
  const shown = new Set();
  for (const [model, where, row, colors] of SHOW) {
    const it = byModel.get(model);
    if (!it) continue;
    shown.add(it.id);
    groups.push({ id: 'g-' + model, item: it, model, where, row, colors });
  }
  // sådant i katalogen som inte står i SHOW: NYHETER-podiet
  for (const it of catalog) if (!shown.has(it.id)) {
    const c = it.colors || {};
    groups.push({ id: 'g-' + (it.look.shoeType || it.id), item: it, model: it.look.shoeType || 'normal', where: 'NEWS', row: 0, colors: [[c.shoes || '#3a7bd5', c.shoes2 || '#f4f1ea']] });
  }
  const hasNews = groups.some((G) => G.where === 'NEWS');
  layoutAll(groups);
  // veckans sko: en ny modell varje speldag
  const pool = groups.filter((G) => G.where !== 'NEWS');
  const vecka = pool[((g.day | 0) * 7 + 3) % pool.length];

  // ---------- gången ----------
  const OBST = [
    [DESK.x0 - 1, WALL_Y, DESK.x1 + 1, DESK.y + 1],
    [PEG.x0 - 2, PEG.y - 8, PEG.x1 + 2, PEG.y + 1],
    [BENCH.x0 - 1, BENCH.y - 12, BENCH.x1 + 1, BENCH.y + 1],
    [SEAT_KUND - 8, BENCH.y, SEAT_KUND + 8, BENCH.y + 4],           // kundens fötter
    [OPENBOX.x - 10, OPENBOX.y - 7, OPENBOX.x + 10, OPENBOX.y + 1],
    [FMIRROR.x - 6, FMIRROR.y - 8, FMIRROR.x + 6, FMIRROR.y + 1],
    [HORN.x - 4, HORN.y - 5, HORN.x + 4, HORN.y + 1],
    [STACK.x - 13, STACK.y - 8, STACK.x + 13, STACK.y + 1],
    [TABLE.x0 - 1, TABLE.y - 12, TABLE.x1 + 1, TABLE.y + 1],
    [GIANT.x - 34, GIANT.y - 12, GIANT.x + 34, GIANT.y + 2],
    [SHINE.x0, SHINE.y - 34, SHINE.x1 + 4, SHINE.y + 1],
    ...PLANTS.map(([x, y]) => [x - 7, y - 5, x + 7, y + 1]),
    [VECKA.x - 16, VECKA.y - 6, VECKA.x + 16, VECKA.y + 1],
    ...(hasNews ? [[NEWS.x0, NEWS.y - 8, NEWS.x1, NEWS.y + 1]] : []),
    ...(g.eventIs?.('rea') ? [[REA_AT[0] - 9, REA_AT[1] - 4, REA_AT[0] + 9, REA_AT[1] + 1]] : []),
  ];
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 4, bottom: H - 4, spawn: [DOOR_SPOT[0], DOOR_SPOT[1]] });
  walker.setObstacles(OBST);
  walker.snapFree();
  const kid = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 4, bottom: H - 4, spawn: [KID_ROUTE[0][0], KID_ROUTE[0][1]] });
  kid.setObstacles(OBST);
  kid.speed = 40;
  const kidS = { i: 0, wait: 2, dir: 'up' };

  const camTarget = () => lockedCam ?? peekCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  // ---------- mobilens beskärning: kameran följer figuren även i höjdled ----------
  // Fyll-läget NÄRA (mobilen) visar bara ett band av bilden: på en bred mobil klipps ~55 rader
  // upptill och ~23 nertill – då syns varken skyltarna eller de översta hyllraderna. band() är
  // den synliga rutan (canvasrader, A.view.safe) och cam.wy den världsrad som syns överst i den:
  // står man vid väggarna syns hyllorna ända upp till skyltarna, längst fram syns golvet ända ner.
  // Utan beskärning (datorn, VID, RAM, testrobotar) är bandet hela höjden och dy alltid 0.
  const band = () => {
    const s = A.view?.safe;
    const y0 = clamp(s?.y0 | 0, 0, H - 64), y1 = clamp(Math.round(s?.y1 ?? H), y0 + 64, H);
    return { y0, y1, vh: y1 - y0 };
  };
  let lockedWy = null, peekWy = null;
  const meY = () => (me.mode === 'bench' ? BENCH.y + 1 : me.mode === 'shine' ? CHAIR.fy : walker.py);
  const wyTarget = () => {
    const b = band(), max = H - b.vh;
    if (max <= 0) return 0;
    if (lockedWy !== null) return clamp(lockedWy, 0, max);
    if (peekWy !== null) return clamp(peekWy, 0, max);
    const py = meY();
    // väggen (py ≈ 102) → överst, främre golvet (py ≈ 204) → nederst; figuren hela i bild
    const lin = clamp((py - (WALL_Y + 14)) / (H - 12 - (WALL_Y + 14)), 0, 1) * max;
    return clamp(Math.round(clamp(lin, py + 12 - b.vh, py - 52)), 0, max);
  };
  const cam = { x: camTarget(), wy: 0 };
  cam.wy = wyTarget();
  // hur långt världen flyttas ner på canvasen (världsrad y ritas på canvasrad y + dy)
  const curDy = () => Math.round(band().y0 - cam.wy);

  // ---------- bilder ----------
  const cache = {};
  const bg = paintBg();
  const deskImg = paintDesk();
  const benchImg = paintBench();
  const fmirImg = paintFloorMirror();
  const hornImg = paintHorn();
  const openBoxImg = paintOpenBox();
  const stackImg = paintStack();
  const giantImg = paintGiant();
  const tableImg = paintTable();
  const standImg = paintShineStand();
  const plantImg = paintPlant();
  const pegImg = paintPeg();
  const newsImg = hasNews ? paintNews() : null;
  const paperImg = paintPaper();
  const brushImg = paintBrush();
  const boxCarry = paintCarryBox();
  const glows = { lamp: glowImg(22, 16, 0xffd890, 0.28) };
  const reaImg = paintReaSign();
  const plinthImg = paintPlinth();
  const nightLight = () => (cache.light ||= paintNightLight());

  // Hyllornas skor + prislappar i ett lager (byggs om när något köps, vid REA eller ny dag)
  const stockKey = () => (g.eventIs?.('rea') ? 'R' : 'r') + groups.map((G) => (api.owns(G.item) ? 1 : 0)).join('');
  const stock = () => {
    const k = stockKey();
    if (cache.stockKey !== k) { cache.stockKey = k; cache.stock = paintStock(groups, api); cache.floorStock = {}; }
    return cache.stock;
  };
  // golvställens varor (sportstället, bordet, nyheter) ritas i ställets egen bild
  const floorStock = (ctx, where) => {
    stock();
    const fs = (cache.floorStock[where] ||= paintFloorStock(groups.filter((G) => G.where === where), api, where));
    ctx.drawImage(fs.img, fs.x, fs.y);
  };

  // ---------- pratbubblor ----------
  const talkMe = createSpeech(), talkClerk = createSpeech(), talkKund = createSpeech(), talkKid = createSpeech(), talkShiner = createSpeech();
  const meAt = () => (me.mode === 'bench' ? { x: SEAT_ME, y: BENCH.y - 40 } : me.mode === 'shine' ? { x: CHAIR.x, y: CHAIR.fy - 42 } : { x: walker.px, y: walker.py - 44 });
  const clerkAt = () => ({ x: CLERK_AT[0], y: CLERK_AT[1] - 44 });
  const kundAt = () => ({ x: SEAT_KUND, y: BENCH.y - 40 });
  const kidAt = () => ({ x: kid.px, y: kid.py - 34 });
  const shinerAt = () => (shine.state === 'idle' ? { x: CHAIR.x, y: CHAIR.fy - 42 } : { x: SHINER_AT[0], y: SHINER_AT[1] - 44 });
  const speakers = () => [
    { talk: talkMe, at: meAt }, { talk: talkClerk, at: clerkAt }, { talk: talkKund, at: kundAt },
    { talk: talkKid, at: kidAt }, { talk: talkShiner, at: shinerAt },
  ];
  const seenX = (x, m = 0) => x >= cam.x + m && x <= cam.x + VW - m;
  let chatT = 6, lastSay = 0, answer = null;
  const idleChat = (dt) => {
    if (answer && t >= answer.at) { if (!talkKid.active() && seenX(SEAT_KUND, 10)) talkKund.say(answer.text, kundAt, 2.6, { voice: KUND }); answer = null; }
    chatT -= dt;
    if (chatT > 0) return;
    chatT = 7 + hash(Math.floor(t), 3, 7) * 7;
    if (speakers().some((S) => S.talk.active())) return;
    const n = Math.floor(t * 7) + lastSay++;
    if (seenX(kid.px, 10) && n % 3 !== 2) {
      talkKid.say(KID_SAYS[n % KID_SAYS.length], kidAt, 2.6, { voice: KID });
      answer = { at: t + 2.9, text: KUND_TO_KID[n % KUND_TO_KID.length] };
    } else if (seenX(SEAT_KUND, 10)) talkKund.say(KUND_SAYS[n % KUND_SAYS.length], kundAt, 3, { voice: KUND });
  };

  // ---------- klickbara platser ----------
  const standUp = () => {
    if (me.mode === 'bench') { walker.px = SEAT_ME; walker.py = BENCH.y + 8; walker.dir = 'down'; }
    if (me.mode === 'shine') { walker.px = SHINE_GO[0]; walker.py = SHINE_GO[1]; walker.dir = 'down'; if (shine.state !== 'idle') { shine.state = 'leaving'; shine.doneT = t; } }
    me.mode = 'free'; me.seat = null;
  };
  const sayMe = (s, secs) => talkMe.say(s, meAt, secs);
  const spots = [
    { id: 'barn', label: $t('BARNET I BLINKSKORNA'), dyn: () => [kid.px - 7, kid.py - 30, kid.px + 7, kid.py + 1], go: () => [kid.px + 16, kid.py + 2], act: () => { play('click'); talkKid.say(KID_SAYS[Math.floor(t) % KID_SAYS.length], kidAt, 2.6, { voice: KID }); } },
    { id: 'kund', label: $t('KUNDEN PROVAR STÖVLETTER'), r: [SEAT_KUND - 9, BENCH.y - 36, SEAT_KUND + 9, BENCH.y + 1], go: [SEAT_KUND - 20, BENCH.y + 14], act: () => { play('click'); talkKund.say(KUND_SAYS[Math.floor(t * 3) % KUND_SAYS.length], kundAt, 3, { voice: KUND }); } },
    ...groups.map((G) => ({ id: G.id, group: G, r: G.r, go: G.go })),
    { id: 'dorr', label: $t('UT TILL STADEN'), r: [DOOR.x0 - 2, DOOR.top - 10, DOOR.x1 + 2, WALL_Y + 6], go: DOOR_SPOT, act: () => { play('door'); A.go('city'); } },
    { id: 'spegel', label: $t('SPEGELN'), r: [MIRROR.x0, MIRROR.top, MIRROR.x1, MIRROR.y], go: [216, WALL_Y + 12], act: () => { walker.dir = 'up'; play('click'); sayMe(mirrorLine()); } },
    { id: 'kassa', label: $t('KASSAN'), r: [DESK.x0, 64, DESK.x1, DESK.y], go: PAY, act: () => { play('click'); talkClerk.say(CLERK_SAYS[Math.floor(t) % CLERK_SAYS.length], clerkAt, 4, { voice: CLERK }); } },
    { id: 'lager', label: $t('KARTONGVÄGGEN'), r: [BOXW.x0, 12, BOXW.x1, 64], go: PAY, act: () => { play('click'); talkClerk.say($t('Alla storlekar finns i kartongerna – från 20 till 46! 📦'), clerkAt, 4, { voice: CLERK }); } },
    { id: 'provpall', label: $t('PROVPALLEN - PROVA ALLA SKOR'), r: [BENCH.x0, BENCH.y - 18, BENCH.x1, BENCH.y + 2], go: [SEAT_ME, BENCH.y + 8], act: () => sitBench() },
    { id: 'golvspegel', label: $t('GOLVSPEGELN'), r: [FMIRROR.x - 7, FMIRROR.y - 24, FMIRROR.x + 7, FMIRROR.y + 1], go: [FMIRROR.x + 4, FMIRROR.y + 14], act: () => { walker.dir = 'up'; play('click'); sayMe($t('Snygga fötter! 👀')); } },
    { id: 'skohorn', label: $t('SKOHORNET'), r: [HORN.x - 5, HORN.y - 36, HORN.x + 5, HORN.y + 1], go: [HORN.x + 12, HORN.y + 8], act: () => { play('click'); sayMe($t('Ett skohorn – så glider hälen i utan att trampa ner skon. 🥄')); } },
    { id: 'fotmatare', label: $t('FOTMÄTAREN'), r: [MEASURE.x - 10, MEASURE.y - 4, MEASURE.x + 10, MEASURE.y + 3], go: [MEASURE.x, MEASURE.y + 4], act: () => { play('chirp'); sayMe($t`📏 Storlek ${footSize(A)}! Alla skor finns i min storlek.`); } },
    { id: 'jattesko', label: $t('JÄTTESKON'), r: [GIANT.x - 34, GIANT.y - 34, GIANT.x + 34, GIANT.y + 2], go: [GIANT.x + 42, GIANT.y - 2], act: () => { play('click'); sayMe($t('Världens största sneaker – storlek 312! 👟')); } },
    { id: 'kartonger', label: $t('KARTONGER'), r: [STACK.x - 13, STACK.y - 22, STACK.x + 13, STACK.y + 1], go: [STACK.x, STACK.y + 10], act: () => { play('click'); sayMe($t('Kartonger så långt ögat når. 📦')); } },
    { id: 'veckans', label: $t`VECKANS SKO: ${safeTxt(vecka.item.name)}`, r: [VECKA.x - 18, VECKA.y - 38, VECKA.x + 18, VECKA.y + 1], go: [VECKA.x - 26, VECKA.y - 2], act: () => { walker.dir = 'right'; hoverId = null; openBuy(vecka, 0); } },
    { id: 'skoputs', label: $t('SKOPUTSEN - GRATIS'), r: [SHINE.x0, 110, SHINE.x1, SHINE.y + 2], go: SHINE_GO, act: () => startShine() },
  ];
  const rectOf = (s) => (s.dyn ? s.dyn() : s.r);
  const goOf = (s) => (typeof s.go === 'function' ? s.go() : s.go);
  const spotAt = (x, y) => spots.find((s) => { const r = rectOf(s); return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; });
  const spotById = (id) => spots.find((s) => s.id === id) || null;
  // vilken sko i gruppen pekar man på (för färgen i dialogen)
  const shoeAt = (G, x, y) => {
    let best = 0, bd = 1e9;
    G.shoes.forEach((s, i) => { const d = Math.abs(x - (s.x + s.ic.w / 2)) + Math.abs(y - (s.y - s.ic.h / 2)) * 0.5; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && spotById(hoverId);
    if (h) return h;
    if (walker.path.length || me.mode !== 'free') return null;
    if (me.arrived) { const s = spotById(me.arrived); const go = s && goOf(s); if (go && Math.abs(walker.px - go[0]) < 5 && Math.abs(walker.py - go[1]) < 5) return s; }
    return spots.find((s) => s.group && Math.abs(walker.px - s.go[0]) < 5 && Math.abs(walker.py - s.go[1]) < 5) || null;
  };
  const goSpot = (s, x, y) => {
    const ci = s.group ? shoeAt(s.group, x, y) : 0;
    const [gx, gy] = goOf(s);
    walker.walkTo(gx, gy, () => {
      me.arrived = s.id;
      if (s.group) { walker.dir = 'up'; hoverId = null; openBuy(s.group, ci); } else s.act?.();
    });
  };

  // ---------- provpallen, skoputsen ----------
  function sitBench() {
    me.mode = 'bench'; me.seat = [SEAT_ME, BENCH.y + 1];
    walker.stop();
    play('click');
    openCatalog();
  }
  function startShine() {
    if (shine.state === 'working') return;
    me.mode = 'shine'; me.seat = [CHAIR.x, CHAIR.fy];
    walker.stop();
    shine.state = 'working'; shine.t0 = t;
    play('click');
    talkShiner.say($t('Slå dig ner! Jag borstar dem blanka på nolltid. 🧽'), () => ({ x: SHINER_AT[0], y: SHINER_AT[1] - 44 }), 3, { voice: SHINER });
  }
  const mirrorLine = () => {
    const it = catalog.find((x) => isWorn(x, A.avatar.look));
    return it ? $t`Snygga ${plain(it.name).toLowerCase()}! 😎` : $t('Hmm... nya skor kanske? 🤔');
  };

  // ---------- köp ----------
  const buy = (it) => {
    const r = api.buy(it);
    if (r?.ok) {
      play('buy');
      me.boxUntil = t + 6;
      talkClerk.say($t`Tack för köpet! 👟 Här är kartongen.`, clerkAt, 3.5, { voice: CLERK });
    } else if (r && !api.owns(it)) {
      play('fel');
      talkClerk.say($t`De kostar ${fmt(api.price(it))}. Jobba ett pass och kom tillbaka! 💪`, clerkAt, 4, { voice: CLERK });
    }
    return r;
  };
  function openBuy(G, ci = 0, opts = {}) {
    openShoeDialog(A, api, G.item, { colors: G.colors, ci, where: WHERE[G.where] || '', onBuy: buy, ...opts });
  }
  function openCatalog() {
    openCatalogDialog(A, api, groups, (G, ci) => openBuy(G, ci, { back: openCatalog }));
  }

  // ---------- uppdatering ----------
  function update(dt) {
    t += dt;
    if (me.mode === 'free') walker.update(dt);
    // barnet springer sin runda (stannar vid golvspegeln och tittar)
    if (!kid.update(dt)) {
      if (kidS.wait > 0) { kidS.wait -= dt; kid.dir = kidS.dir; }
      else {
        kidS.i = (kidS.i + 1) % KID_ROUTE.length;
        const [x, y, dir, w] = KID_ROUTE[kidS.i];
        kidS.dir = dir; kidS.wait = w;
        kid.walkTo(x, y);
      }
    }
    // skoputsen: borsta i tre och en halv sekund, sedan blankt
    if (shine.state === 'working' && t - shine.t0 > 3.6) {
      shine.state = 'done'; shine.doneT = t;
      me.shinyUntil = t + 25;
      play('ok');
      talkShiner.say(SHINE_SAYS[Math.floor(t) % SHINE_SAYS.length], () => ({ x: SHINER_AT[0], y: SHINER_AT[1] - 44 }), 3.5, { voice: SHINER });
    }
    if (shine.state === 'leaving' && t - shine.doneT > 2.5) shine.state = 'idle';
    if (shine.state === 'done' && me.mode !== 'shine') { shine.state = 'leaving'; shine.doneT = t; }
    idleChat(dt);
    const k = lockedCam !== null || peekCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (camTarget() - cam.x) * k;
    cam.x = clamp(cam.x, 0, Math.max(0, W - VW));
    const ky = lockedWy !== null || peekWy !== null ? 1 : Math.min(1, dt * 5);
    cam.wy += (wyTarget() - cam.wy) * ky;
    cam.wy = clamp(cam.wy, 0, Math.max(0, H - band().vh));
  }

  // ---------- ritning ----------
  function drawWorld(ctx, cx, vw) {
    const hour = g.min / 60, dark = darkness(hour), night = isNight(hour);
    ctx.drawImage(bg, 0, 0);
    // ljuset från spottarna
    for (const lx of LAMPS) ctx.drawImage(glows.lamp, lx - 23, 4);
    const focus = focusSpot();
    const fg = focus?.group || null;
    // markering bakom gruppen man står vid/pekar på
    if (fg && ['A', 'B', 'C'].includes(fg.where)) {
      ctx.fillStyle = 'rgba(255,236,150,.38)'; ctx.fillRect(fg.x0 - 3, fg.y0 - 3, fg.x1 - fg.x0 + 6, fg.foot - fg.y0 + 5);
    }
    ctx.drawImage(stock(), 0, 0);
    // blinkskorna blinkar på hyllan
    const bf = Math.floor(t * 4);
    for (const G of groups) if (['A', 'B', 'C'].includes(G.where) && blinks(G.model)) for (const s of G.shoes) ctx.drawImage(shoeIcon(G.model, s.colors[0], s.colors[1], bf).img, s.x, s.y - s.ic.h + 1);
    if (fg && ['A', 'B', 'C'].includes(fg.where)) sparkle(ctx, fg.x0 - 2, fg.y0 + 2, t);
    // speglingen i helfigursspegeln
    drawReflection(ctx);

    // ---- golvet i djupordning ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(DESK.y, () => { drawPerson(ctx, CLERK_AT[0], CLERK_AT[1], CLERK, talkClerk.active() ? 'down' : 'down', Math.sin(t * 1.7) > 0.93 ? 4 : 0); ctx.drawImage(deskImg.img, DESK.x0 - deskImg.ox, DESK.y - deskImg.oy); });
    add(PEG.y, () => {
      ctx.drawImage(pegImg.img, PEG.x0 - pegImg.ox, PEG.y - pegImg.oy);
      floorStock(ctx, 'PEG');
      if (fg?.where === 'PEG') { hiliteFloor(ctx, fg); sparkle(ctx, fg.x0 - 2, fg.y0 + 2, t); }
    });
    add(BENCH.y - 1, () => ctx.drawImage(benchImg.img, BENCH.x0 - benchImg.ox, BENCH.y - benchImg.oy));
    add(BENCH.y, () => drawPerson(ctx, SEAT_KUND, BENCH.y + 1, KUND, 'down', 5));
    add(OPENBOX.y, () => ctx.drawImage(openBoxImg.img, OPENBOX.x - openBoxImg.ox, OPENBOX.y - openBoxImg.oy));
    add(FMIRROR.y, () => { ctx.drawImage(fmirImg.img, FMIRROR.x - fmirImg.ox, FMIRROR.y - fmirImg.oy); floorMirrorFeet(ctx); });
    add(HORN.y, () => ctx.drawImage(hornImg.img, HORN.x - hornImg.ox, HORN.y - hornImg.oy));
    add(STACK.y, () => ctx.drawImage(stackImg.img, STACK.x - stackImg.ox, STACK.y - stackImg.oy));
    add(TABLE.y, () => {
      ctx.drawImage(tableImg.img, TABLE.x0 - tableImg.ox, TABLE.y - tableImg.oy);
      floorStock(ctx, 'TABLE');
      if (fg?.where === 'TABLE') { hiliteFloor(ctx, fg); sparkle(ctx, fg.x0 - 2, fg.y0 + 1, t); }
    });
    if (newsImg) add(NEWS.y, () => {
      ctx.drawImage(newsImg.img, NEWS.x0 - newsImg.ox, NEWS.y - newsImg.oy);
      floorStock(ctx, 'NEWS');
      if (fg?.where === 'NEWS') { hiliteFloor(ctx, fg); sparkle(ctx, fg.x0 - 2, fg.y0 + 1, t); }
    });
    add(GIANT.y, () => ctx.drawImage(giantImg.img, GIANT.x - giantImg.ox, GIANT.y - giantImg.oy));
    add(SHINE.y, () => {
      ctx.drawImage(standImg.img, SHINE.x0 - standImg.ox, SHINE.y - standImg.oy);
      // i stolen: skoputsaren med tidningen – eller jag
      if (me.mode === 'shine') drawMeSeated(ctx, CHAIR.x, CHAIR.fy);
      else if (shine.state === 'idle') { drawPerson(ctx, CHAIR.x, CHAIR.fy, SHINER, 'down', 5); ctx.drawImage(paperImg.img, CHAIR.x - 7 + (Math.sin(t * 0.7) > 0.96 ? 1 : 0), CHAIR.fy - 20); }
    });
    if (shine.state !== 'idle') add(SHINE.y + 0.5, () => {
      const work = shine.state === 'working';
      const fr = work ? [7, 9, 8, 9][Math.floor(t * 8) % 4] : 0;
      drawPerson(ctx, SHINER_AT[0], SHINER_AT[1], SHINER, 'right', fr);
      if (work) {
        const bx = CHAIR.x - 9 + Math.round(Math.sin(t * 16) * 2);
        ctx.drawImage(brushImg, bx, CHAIR.fy - 4);
        if (Math.floor(t * 10) % 3 === 0) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(CHAIR.x - 4 + (Math.floor(t * 13) % 9), CHAIR.fy - 3 - (Math.floor(t * 7) % 3), 1, 1); }
      }
    });
    for (const [x, y] of PLANTS) add(y, () => ctx.drawImage(plantImg.img, x - plantImg.ox, y - plantImg.oy));
    add(VECKA.y, () => {
      ctx.drawImage(plinthImg.img, VECKA.x - plinthImg.ox, VECKA.y - plinthImg.oy);
      const c = vecka.colors[0], ic = shoeIcon(vecka.model, c[0], c[1], Math.floor(t * 4));
      ctx.drawImage(ic.img, VECKA.x - (ic.w >> 1), VECKA.y - 23 - ic.h + 1);
      if (Math.floor(t * 1.5) % 3 === 0) sparkle(ctx, VECKA.x + (ic.w >> 1) - 1, VECKA.y - 23 - ic.h + 3, t);
    });
    if (g.eventIs?.('rea')) add(REA_AT[1], () => { ctx.drawImage(reaImg.img, REA_AT[0] - reaImg.ox, REA_AT[1] - reaImg.oy); if (Math.floor(t * 2) % 2) sparkle(ctx, REA_AT[0] + 9, REA_AT[1] - 19, t); });
    add(kid.py, () => {
      const walking = kid.path.length > 0;
      drawPerson(ctx, kid.px, kid.py, KID, kid.dir, walking ? WALK_SEQ[Math.floor(t * 9) % 4] : (Math.sin(t * 2.3) > 0.9 ? 4 : 0));
    });
    for (const d of folkDrawables(A, t)) add(d.fy, (c) => d.draw(c));
    if (me.mode === 'bench') add(BENCH.y + 0.2, () => drawMeSeated(ctx, SEAT_ME, BENCH.y + 1));
    else if (me.mode !== 'shine') {
      const carry = me.boxUntil > t;
      const sd = selfDrawable(A, walker, t, { carry, folksHere: A.worldFolksHere?.().length || 0 });
      const kidB = A.avatar.look?.kid ? 7 : 0; // barn bär kartongen lägre (kortare figur)
      add(walker.py + 0.01, (c) => {
        if (carry && walker.dir === 'up') c.drawImage(boxCarry, Math.round(walker.px) - 6, Math.round(walker.py) - 25 + kidB);
        sd.draw(c);
        if (carry && walker.dir !== 'up') c.drawImage(boxCarry, Math.round(walker.px) - 6 + (walker.dir === 'left' ? -4 : walker.dir === 'right' ? 4 : 0), Math.round(walker.py) - 23 + kidB);
        if (me.shinyUntil > t) shinyFeet(c, walker.px, walker.py);
      });
    }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw(ctx);

    // ---- kvällsljuset ----
    if (night || dark > 0.2) {
      const k = night ? 1 : Math.min(1, (dark - 0.2) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = k * 0.85;
      ctx.fillStyle = '#7a6a98';
      ctx.fillRect(cx, -H, vw, H * 3); // även kantremsorna ovanför/under butiken (mobilens höjdkamera)
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k * 0.8;
      ctx.drawImage(nightLight(), 0, 0);
      ctx.restore();
    }
  }
  // jag sittande (provpallen/putsstolen), med namnskylt/emote som vanligt
  function drawMeSeated(ctx, x, fy) {
    drawPerson(ctx, x, fy, A.avatar.look, 'down', 5);
    if ((A.worldFolksHere?.().length || 0) > 0) nameTag(ctx, x, fy - 48, A.avatar);
    if (me.shinyUntil > t || shine.state === 'working') shinyFeet(ctx, x, fy);
  }
  function shinyFeet(ctx, x, y) {
    const ph = Math.floor(t * 6);
    const pts = [[-4, -2], [3, -1], [-1, -3], [5, -3], [-5, 0]];
    const [dx, dy] = pts[ph % pts.length];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
    if (ph % 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(Math.round(x) + dx - 1, Math.round(y) + dy, 3, 1); ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy - 1, 1, 3); }
  }
  // Spegeln på väggen: jag syns i den när jag står nära (vänd mot den = framsidan)
  function drawReflection(ctx) {
    const px = me.mode === 'free' ? walker.px : null;
    const ghosts = [];
    if (px !== null && Math.abs(px - (GLASS.x0 + GLASS.x1) / 2) < 30 && walker.py < 150) ghosts.push({ x: px, y: walker.py, look: A.avatar.look, dir: walker.dir, walking: walker.path.length > 0 });
    if (Math.abs(kid.px - (GLASS.x0 + GLASS.x1) / 2) < 26 && kid.py < 150) ghosts.push({ x: kid.px, y: kid.py, look: KID, dir: kid.dir, walking: kid.path.length > 0 });
    ctx.save();
    ctx.beginPath(); ctx.rect(GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, GLASS.y1 - GLASS.y0); ctx.clip();
    for (const o of ghosts) {
      const rd = { up: 'down', down: 'up', left: 'left', right: 'right' }[o.dir] || 'down';
      const ry = GLASS.y1 - 3 - Math.round(clamp((o.y - WALL_Y) * 0.35, 0, 18));
      ctx.globalAlpha = 0.82;
      drawPerson(ctx, o.x, ry, o.look, rd, o.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : 0);
      ctx.globalAlpha = 1;
    }
    // glaset: blåaktig ton + diagonala blänk ovanpå speglingen
    ctx.fillStyle = 'rgba(190,220,236,.22)'; ctx.fillRect(GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, GLASS.y1 - GLASS.y0);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 70; i++) { const y = GLASS.y0 + i; const x = GLASS.x0 + 2 + Math.round(i * 0.45) % 40; if (x < GLASS.x1) { ctx.fillRect(x, y, 2, 1); } }
    ctx.restore();
  }
  // golvspegeln visar fötterna på den som står framför
  function floorMirrorFeet(ctx) {
    const who = [];
    if (me.mode === 'free' && Math.abs(walker.px - FMIRROR.x) < 12 && walker.py > FMIRROR.y && walker.py < FMIRROR.y + 26) who.push({ x: walker.px, look: A.avatar.look });
    if (Math.abs(kid.px - FMIRROR.x) < 12 && kid.py > FMIRROR.y && kid.py < FMIRROR.y + 26) who.push({ x: kid.px, look: KID });
    if (!who.length) return;
    const gx0 = FMIRROR.x - 4, gy0 = FMIRROR.y - 17, gw = 8, gh = 13;
    ctx.save();
    ctx.beginPath(); ctx.rect(gx0, gy0, gw, gh); ctx.clip();
    for (const o of who) drawPerson(ctx, FMIRROR.x + Math.round((o.x - FMIRROR.x) * 0.5), gy0 + gh + 1, o.look, 'up', Math.floor(t * 4) % 2 ? 0 : 4);
    ctx.fillStyle = 'rgba(190,220,236,.25)'; ctx.fillRect(gx0, gy0, gw, gh);
    ctx.restore();
  }
  function hiliteFloor(ctx, G) {
    ctx.fillStyle = 'rgba(255,236,150,.35)';
    ctx.fillRect(G.x0 - 2, G.y0 - 2, G.x1 - G.x0 + 4, G.foot - G.y0 + 3);
    for (const s of G.shoes) ctx.drawImage(shoeIcon(G.model, s.colors[0], s.colors[1], Math.floor(t * 4)).img, s.x, s.y - s.ic.h + 1);
  }

  function draw(ctx) {
    syncView(A);
    const cx = Math.round(cam.x), dy = curDy();
    ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, dy * A.pxs);
    ctx.imageSmoothingEnabled = false;
    // canvasraderna utanför butiken (bara när höjdkameran står i ett ytterläge): samma mörka
    // ton som butikens ram, så att kanten ser likadan ut som på datorn
    if (dy > 0) { ctx.fillStyle = '#0e0d12'; ctx.fillRect(cx, -dy, VW, dy); }
    if (dy < 0) { ctx.fillStyle = '#0e0d12'; ctx.fillRect(cx, H, VW, -dy); }
    drawWorld(ctx, cx, VW);
    const view = { x0: cx, x1: cx + VW };
    for (const S of speakers()) if (S.talk.active()) { const p = S.at(); if (p && seenX(p.x, -2)) S.talk.draw(ctx, view); }
    // skyltar i skärmens kant och nertill – innanför den synliga rutan (mobilens beskärning)
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    const b = band(), low = b.y1, top = b.y0;
    const f = hoverId && t - hoverT < 4 ? spotById(hoverId) : focusSpot();
    // namnskylten flyttas upp bara när den annars skulle täcka figurens fötter
    if (f?.group) bigLabel(ctx, f.group, api, t, low, me.mode === 'free' && walker.py + dy > low - 32, f.id === hoverId && hoverShoe != null ? hoverShoe : 0, top);
    else if (f?.label) smallLabel(ctx, f.label, low);
    else if (me.mode === 'bench') smallLabel(ctx, $t('PROVHÖRNAN - KLICKA FÖR ATT RESA DIG'), low);
    else if (me.mode === 'shine') smallLabel(ctx, shine.state === 'working' ? $t('SKOPUTSAREN BORSTAR...') : $t('BLANKA SKOR! KLICKA FÖR ATT GÅ'), low);
    if (cx > 50) edgeSign(ctx, true, $t('SNEAKERS + SPORT'), '#ff6a6a', low);
    if (cx < W - VW - 50) edgeSign(ctx, false, $t('STÖVLAR + FINA SKOR'), '#f0d048', low);
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return me.mode === 'bench' ? SEAT_ME : me.mode === 'shine' ? CHAIR.x : walker.px; },
    get worldY() { return me.mode === 'bench' ? BENCH.y + 1 : me.mode === 'shine' ? CHAIR.fy : walker.py; },
    exit() { for (const S of speakers()) S.talk.clear(); },
    update,
    draw,
    down(sx, sy) {
      const x = sx + cam.x, y = sy - curDy();
      hoverId = null; peekCam = null; peekWy = null;
      const h = spotAt(x, y);
      if (me.mode !== 'free') {
        // sitter man: klick på samma sak igen öppnar den igen, allt annat = res dig
        if (me.mode === 'bench' && h?.id === 'provpall') { openCatalog(); return; }
        if (me.mode === 'shine' && h?.id === 'skoputs') return;
        standUp();
      }
      if (h) { goSpot(h, x, y); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) {
      const x = sx + cam.x, y = sy - curDy();
      const h = spotAt(x, y);
      hoverId = h?.id || null; hoverT = t;
      hoverShoe = h?.group ? shoeAt(h.group, x, y) : null;
    },
    key(k) { if (k === 'Escape') { walker.stop(); if (me.mode !== 'free') standUp(); } },
    _debug: {
      spot: (id) => {
        const s = spotById(id);
        if (!s) return null;
        const r = rectOf(s), x = (r[0] + r[2]) / 2, y = (r[1] + r[3]) / 2;
        if (lockedCam === null && (x - cam.x < 8 || x - cam.x > VW - 8)) { peekCam = clamp(x - VW / 2, 0, W - VW); cam.x = peekCam; }
        // mobilens beskärning: kameran tittar upp/ner om platsen ligger utanför den synliga rutan
        const b = band();
        if (lockedWy === null && (y - cam.wy < 6 || y - cam.wy > b.vh - 6)) { peekWy = clamp(Math.round(y - b.vh / 2), 0, Math.max(0, H - b.vh)); cam.wy = peekWy; }
        return { x: x - cam.x, y: y + curDy() };
      },
      spots: () => spots.map((s) => ({ id: s.id, r: rectOf(s).map(Math.round), go: goOf(s).map(Math.round) })),
      items: () => groups.map((G) => ({ id: G.item.id, model: G.model, spot: G.id, where: G.where, colors: G.colors, price: api.price(G.item), owned: api.owns(G.item), shoes: G.shoes.map((s) => ({ x: s.x, y: s.y, w: s.ic.w, h: s.ic.h })), tag: { x: G.tagX, y: G.tagY } })),
      buy: (id) => { const G = groups.find((x) => x.item.id === id); return G ? buy(G.item) : { ok: false, msg: 'okänd' }; },
      owns: (id) => { const G = groups.find((x) => x.item.id === id); return !!G && api.owns(G.item); },
      open: (id, ci = 0) => { const G = groups.find((x) => x.item.id === id || x.id === id); if (G) openBuy(G, ci); return !!G; },
      catalog: () => openCatalog(),
      sit: () => { walker.px = SEAT_ME; walker.py = BENCH.y + 8; sitBench(); },
      shine: () => { walker.px = SHINE_GO[0]; walker.py = SHINE_GO[1]; startShine(); },
      teleport: (x, y) => { if (me.mode !== 'free') standUp(); walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); peekCam = null; peekWy = null; cam.x = camTarget(); cam.wy = wyTarget(); },
      // lockCam(x[, wy]): x = vänsterkanten, wy = översta synliga världsraden (bara med mobilens beskärning)
      lockCam: (x, wy) => {
        lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); peekCam = null; cam.x = camTarget();
        lockedWy = wy === null || wy === undefined ? null : wy; peekWy = null; cam.wy = wyTarget();
      },
      // höjdkameran: synliga rutan (canvasrader), översta världsraden och förskjutningen
      camY: () => { const b = band(); return { top: b.y0, low: b.y1, vh: b.vh, wy: Math.round(cam.wy), dy: curDy(), target: wyTarget() }; },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      face: (dir) => { walker.dir = dir; },
      // går det att gå från dörren till platsens ståplats?
      canReach: (id) => {
        const s = spotById(id);
        if (!s) return false;
        const [gx, gy] = goOf(s);
        const path = walker.findPath(DOOR_SPOT[0], DOOR_SPOT[1], gx, gy), end = path[path.length - 1];
        return !!end && Math.hypot(end[0] - gx, end[1] - gy) < 8;
      },
      cam: () => cam.x,
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      state: () => ({
        mode: me.mode, x: Math.round(walker.px), y: Math.round(walker.py), money: g.money, cam: Math.round(cam.x), vw: VW,
        shine: shine.state, shiny: me.shinyUntil > t, box: me.boxUntil > t,
        kid: { x: Math.round(kid.px), y: Math.round(kid.py), say: talkKid.text() },
        say: { me: talkMe.text(), clerk: talkClerk.text(), kund: talkKund.text(), shiner: talkShiner.text() },
        shoe: A.avatar.look.shoeType, shoes: A.avatar.look.shoes, shoes2: A.avatar.look.shoes2,
        vecka: vecka.item.id,
      }),
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W);
        return c.toDataURL('image/png');
      },
    },
  };
}

// ======================= placering av skorna =======================
const ICON_GAP = 1, GROUP_PAD = 5;
const tagW = (lbl) => textW(SMALL, lbl) + 6;
// Alla grupper i sina rader: skorna i rad, prislappen centrerad under gruppen.
function layoutAll(groups) {
  for (const G of groups) G.icons = G.colors.map((c) => shoeIcon(G.model, c[0], c[1], 0));
  const place = (list, x0, x1, foot, tagY, hang = null) => {
    if (!list.length) return;
    // får raden inte plats: ta bort färger från den största gruppen tills det går
    const width = (G) => G.icons.reduce((a, ic) => a + ic.w, 0) + ICON_GAP * (G.icons.length - 1);
    const foot1 = (G) => Math.max(width(G), tagW(`${G.item.price}:-`) + 2);
    for (let guard = 0; guard < 20; guard++) {
      const total = list.reduce((a, G) => a + foot1(G), 0) + GROUP_PAD * (list.length - 1);
      if (total <= x1 - x0) break;
      const big = list.filter((G) => G.icons.length > 1).sort((a, b) => width(b) - width(a))[0];
      if (!big) break;
      big.icons.pop(); big.colors = big.colors.slice(0, big.icons.length);
    }
    const total = list.reduce((a, G) => a + foot1(G), 0);
    const gap = (x1 - x0 - total) / (list.length + 1);
    let x = x0 + gap;
    for (const G of list) {
      const fw = foot1(G), gw = width(G);
      let sx = Math.round(x + (fw - gw) / 2);
      G.shoes = G.icons.map((ic, i) => {
        const s = { x: sx, y: hang ? hang + 2 + ic.h - 1 : foot, ic, colors: G.colors[i], ci: i };
        sx += ic.w + ICON_GAP;
        return s;
      });
      G.x0 = Math.round(x + (fw - gw) / 2); G.x1 = G.x0 + gw;
      G.foot = Math.max(...G.shoes.map((s) => s.y));
      G.y0 = Math.min(...G.shoes.map((s) => s.y - s.ic.h + 1));
      G.tagX = Math.round(x + fw / 2); G.tagY = tagY;
      G.cx = G.tagX;
      x += fw + gap;
    }
  };
  for (const [key, U] of Object.entries(UNITS)) {
    U.rows.forEach((foot, row) => place(groups.filter((G) => G.where === key && G.row === row), U.x0 + 4, U.x1 - 4, foot, foot + 4));
  }
  // sportstället: krokarna (rad 0) och hyllan (rad 1)
  place(groups.filter((G) => G.where === 'PEG' && G.row === 0), PEG.x0 + 4, PEG.x1 - 4, 0, PEG_HOOK + 19, PEG_HOOK);
  place(groups.filter((G) => G.where === 'PEG' && G.row === 1), PEG.x0 + 2, PEG.x1 - 2, PEG_SHELF, PEG_SHELF + 4);
  place(groups.filter((G) => G.where === 'TABLE'), TABLE.x0 + 4, TABLE.x1 - 4, TABLE_TOP, TABLE.y - 7);
  place(groups.filter((G) => G.where === 'NEWS'), NEWS.x0 + 4, NEWS.x1 - 4, NEWS.y - 12, NEWS.y - 7);
  // klickytor och var man ställer sig
  for (const G of groups) {
    const r = [G.x0 - 2, G.y0 - 3, G.x1 + 2, G.tagY + 8];
    r[0] = Math.min(r[0], G.tagX - 13); r[2] = Math.max(r[2], G.tagX + 13);
    G.r = r;
    if (['A', 'B', 'C'].includes(G.where)) {
      // bredvid gruppen (mot butikens mitt) så att figuren inte skymmer skorna
      const U = UNITS[G.where], right = G.cx < (U.x0 + U.x1) / 2 || G.where === 'A';
      let gx = right ? G.x1 + 9 : G.x0 - 9;
      if (G.where === 'A') gx = Math.min(gx, U.x1 - 2);
      G.go = [gx, WALL_Y + 8 + G.row * 2];
    } else if (G.where === 'PEG') G.go = [PEG.x1 + 10, PEG.y - 4 + G.row * 4];
    else if (G.where === 'TABLE') G.go = [G.cx, TABLE.y - 18];
    else G.go = [G.cx, NEWS.y - 16];
  }
}

// ======================= prislappar, skyltar =======================
function priceTag(ctx, cx, y, lbl, kind) {
  const w = tagW(lbl) - 2, x0 = Math.round(cx - w / 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, 9);
  ctx.fillStyle = kind === 'own' ? '#45b964' : kind === 'rea' ? '#ff8a80' : '#f0d048'; ctx.fillRect(x0, y, w, 7);
  ctx.fillStyle = kind === 'own' ? '#8fe0a2' : kind === 'rea' ? '#ffc4bc' : '#fff4a8'; ctx.fillRect(x0, y, w, 1);
  ctxText(ctx, SMALL, lbl, x0 + 2, y + 1, kind === 'own' ? '#ffffff' : '#3a2a10');
}
const tagOf = (api, it) => (api.owns(it) ? [$t('DIN'), 'own'] : [$t`${api.price(it)}:-`, api.rea(it) ? 'rea' : 'price']);
// väggarnas skor + lappar i ett genomskinligt lager
function paintStock(groups, api) {
  const c = mkCanvas(W, WALL_Y), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  for (const G of groups) {
    if (!['A', 'B', 'C'].includes(G.where)) continue;
    drawGroup(x, G, api, true);
  }
  return c;
}
function drawGroup(x, G, api, clip) {
  for (const s of G.shoes) {
    // skugga under skon på hyllplanet
    x.fillStyle = 'rgba(20,12,30,.28)'; x.fillRect(s.x + 2, s.y + 1, s.ic.w - 3, 1);
    x.drawImage(s.ic.img, s.x, s.y - s.ic.h + 1);
  }
  const [lbl, kind] = tagOf(api, G.item);
  if (clip) { x.fillStyle = '#9098a4'; x.fillRect(G.tagX, G.tagY - 3, 1, 3); x.fillStyle = '#e4e8ee'; x.fillRect(G.tagX, G.tagY - 3, 1, 1); }
  priceTag(x, G.tagX, G.tagY, lbl, kind);
}
// golvställets varor i en bild som bara täcker ställets varor: { img, x, y }
function paintFloorStock(list, api, where) {
  if (!list.length) return { img: mkCanvas(1, 1), x: 0, y: 0 };
  const bx = Math.min(...list.map((G) => G.r[0])) - 3, by = Math.min(...list.map((G) => G.r[1]), where === 'PEG' ? PEG_HOOK - 3 : 1e9) - 3;
  const bw = Math.max(...list.map((G) => G.r[2])) + 3 - bx, bh = Math.max(...list.map((G) => G.r[3])) + 3 - by;
  const c = mkCanvas(bw, bh), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.translate(-bx, -by);
  for (const G of list) {
    if (where === 'PEG' && G.row === 0) {
      // krok + snöre som skon hänger i
      for (const sh of G.shoes) {
        const hx0 = sh.x + Math.round(sh.ic.w * 0.35);
        x.fillStyle = '#6a6e78'; x.fillRect(hx0, PEG_HOOK - 1, 1, 2); x.fillStyle = '#c8ccd6'; x.fillRect(hx0, PEG_HOOK - 2, 2, 1);
        x.fillStyle = '#f4f1ea'; x.fillRect(hx0 - 1, PEG_HOOK + 1, 1, 2); x.fillRect(hx0 + 1, PEG_HOOK + 1, 1, 2);
      }
      for (const sh of G.shoes) x.drawImage(sh.ic.img, sh.x, sh.y - sh.ic.h + 1);
      const [lbl, kind] = tagOf(api, G.item);
      priceTag(x, G.tagX, G.tagY, lbl, kind);
      continue;
    }
    drawGroup(x, G, api, false);
  }
  return { img: c, x: bx, y: by };
}

function sparkle(ctx, x, y, t) {
  const ph = Math.floor(t * 5) % 4;
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(x, y - 1 - (ph === 1 ? 1 : 0), 1, 3 + (ph === 1 ? 2 : 0));
  ctx.fillRect(x - 1 - (ph === 1 ? 1 : 0), y, 3 + (ph === 1 ? 2 : 0), 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
}
// Namnskylt för skon man står vid / pekar på: skon i liten bild, namn, pris och tips
function bigLabel(ctx, G, api, t, low, atTop, si = 0, top = 0) {
  const it = G.item, owned = api.owns(it);
  const name = safeTxt(it.name), price = owned ? $t('DIN!') : $t`${api.price(it)} KR`;
  const hint = owned ? $t('KLICKA SÅ TAR DU PÅ DIG DEM') : $t('KLICKA SÅ PROVAR DU DEM PÅ DIG');
  const ic = (G.shoes[si] || G.shoes[0])?.ic;
  const nw = textW(BIG, name), pw = textW(BIG, price), hw = textW(SMALL, hint);
  const iw = ic ? ic.w + 4 : 0;
  const w = Math.max(nw + pw + 12, hw + 4) + iw + 8, h = 22;
  const x0 = Math.round((VW - w) / 2), y0 = atTop ? top + 3 : low - h - 3;
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = '#d8b060'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
  if (ic) ctx.drawImage(ic.img, x0 + 4, y0 + Math.round((h - ic.h) / 2));
  const tx = x0 + 4 + iw;
  ctxText(ctx, BIG, name, tx, y0 + 3, '#ffffff');
  ctxText(ctx, BIG, price, tx + nw + 8, y0 + 3, owned ? '#6fe08a' : api.rea(it) ? '#ff8a80' : '#f0d048');
  ctxText(ctx, SMALL, hint, tx, y0 + 14, Math.floor(t * 2) % 2 ? '#f0d048' : '#c9c2d2');
}
function smallLabel(ctx, lbl, low) {
  const w = textW(SMALL, lbl) + 10, by = low - 14;
  ctx.fillStyle = '#17151a'; ctx.fillRect((VW - w) >> 1, by, w, 11);
  ctx.fillStyle = '#d8b060'; ctx.fillRect(((VW - w) >> 1) + 1, by + 1, w - 2, 1);
  ctxText(ctx, SMALL, lbl, ((VW - w) >> 1) + 5, by + 4, '#fbf4e4');
}
function edgeSign(ctx, left, lbl, col, low) {
  const w = textW(SMALL, lbl) + 14, y = low - 28, x = left ? 3 : VW - 3 - w;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, w - 2, 8);
  ctxText(ctx, SMALL, lbl, x + (left ? 9 : 4), y + 3, '#17151a');
  ctx.fillStyle = '#17151a';
  const ax = left ? x + 3 : x + w - 5;
  for (let j = -2; j <= 2; j++) ctx.fillRect(ax + (left ? Math.abs(j) : 2 - Math.abs(j)), y + 5 + j, 1, 1);
}
// skostorleken ur figuren (samma figur = samma storlek)
function footSize(A) {
  const L = A.avatar.look || {};
  let h = 7;
  for (const ch of String(A.avatar.name || '') + (L.skin || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return L.kid ? 26 + (h % 9) : 36 + (h % 9);
}

// ======================= förmålade bilder =======================
// { img, ox, oy }: bilden ritas vid (x - ox, fot - oy)
const OAK = 0xc8955a, WALNUT = 0x6a4428;
function paintBg() {
  const P = new Pix(W, H);
  // ---- väggen: varm puts, lite mörkare nertill ----
  area(P, 0, 0, W, WALL_Y, (x, y) => {
    let c = mix(0xf4ead8, 0xe6d8bc, hash(x >> 1, y >> 1, 9) * 0.3 + (bayer(x, y) - 0.5) * 0.14);
    return mix(c, 0xcdb898, Math.max(0, (y - 56) / 36) * 0.3);
  });
  // tak med skena och guldlist
  P.rect(0, 0, W, 6, LACK); P.hl(0, 2, W, 0x3a3a42); P.hl(0, 5, W, 0x2a2a30);
  P.hl(0, 6, W, GOLD); P.hl(0, 7, W, GOLD_LO);
  P.rect(0, 8, W, 2, 0xfbf6ea); P.hl(0, 10, W, 0xd8ccb4);
  for (const lx of LAMPS) { P.rect(lx - 3, 2, 7, 3, 0x2a2a30); P.rect(lx - 2, 5, 5, 2, 0x3a3a42); P.hl(lx - 1, 6, 3, 0xfff6c8); P.px(lx, 7, WHITE); }
  // bröstpanel: svart lack med guldlist
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 12; y < WALL_Y; y++) {
    let c = y === WALL_Y - 12 ? GOLD : y === WALL_Y - 11 ? GOLD_LO : y >= WALL_Y - 2 ? 0x101014 : jit(LACK, x, y, 3, 0.05);
    if (y > WALL_Y - 11 && y < WALL_Y - 2 && x % 32 === 0) c = 0x2e2e36;
    P.px(x, y, c);
  }

  // ---- A: SNEAKERSVÄGGEN (svart ribbvägg, neon, ljuslister) ----
  {
    const U = UNITS.A, x0 = U.x0, x1 = U.x1;
    P.rect(x0 - 3, U.top - 1, x1 - x0 + 6, WALL_Y - U.top + 1, 0x101014);
    area(P, x0, U.top + 19, x1 - x0, WALL_Y - U.top - 20, (x, y) => { const r = (y - U.top) % 4; return jit(r === 0 ? 0x34343c : r === 3 ? 0x1a1a20 : 0x26262c, x, y, 5, 0.05); });
    P.box(x0 - 3, U.top - 1, x1 - x0 + 6, WALL_Y - U.top + 1, GOLD);
    // skylten
    P.rect(x0, U.top + 1, x1 - x0, 17, 0x121216);
    P.ell((x0 + x1) / 2, U.top + 9, 70, 12, 0xff3a4a, 0.22, 4);
    const tw = textW(BIG, U.name, 2);
    glowText(P, BIG, U.name, Math.round((x0 + x1) / 2 - tw / 2), U.top + 3, 0xfff0f0, 0xff3a4a, 2, 0.4);
    P.hl(x0, U.top + 18, x1 - x0, GOLD_LO);
    // hyllplan med ljuslist under och ljusspill på väggen
    for (const y of U.rows) {
      P.ell((x0 + x1) / 2, y - 7, (x1 - x0) / 2, 9, 0xfff4dc, 0.16, 4);
      P.rect(x0 + 2, y, x1 - x0 - 4, 2, 0xf4f4f6); P.hl(x0 + 2, y, x1 - x0 - 4, WHITE); P.hl(x0 + 2, y + 2, x1 - x0 - 4, 0xbfe8ff);
      P.ell((x0 + x1) / 2, y + 4, (x1 - x0) / 2 - 4, 3, 0xbfe8ff, 0.3, 3);
    }
  }

  // ---- spegeln ----
  {
    const { x0, x1, top, y } = MIRROR;
    P.rect(x0, top, x1 - x0, y - top, 0xb08a2a);
    P.box(x0, top, x1 - x0, y - top, GOLD_LO);
    P.box(x0 + 1, top + 1, x1 - x0 - 2, y - top - 2, GOLD_HI);
    P.box(x0 + 2, top + 2, x1 - x0 - 4, y - top - 4, GOLD);
    // krön
    spr(P, (x0 + x1) / 2 - 5, top - 5, ['...gGg...', '..gGyGg..', '.gG.y.Gg.', 'gGGGGGGGg', 'GGGGGGGGG'].map((r) => r.padEnd(11, '.')), { g: GOLD_HI, G: GOLD, y: 0xfff8d0 });
    area(P, GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, GLASS.y1 - GLASS.y0, (x, yy) => {
      let c = mix(0xe4eef0, 0x9fb6c0, (yy - GLASS.y0) / (GLASS.y1 - GLASS.y0));
      // speglad vägg + golv i glaset
      if (yy > GLASS.y1 - 12) c = mix(c, 0xb8946a, 0.35);
      return c;
    });
    P.hl(GLASS.x0, GLASS.y1 - 12, GLASS.x1 - GLASS.x0, 0x8a7a68);
    P.rect(x0 - 1, y - 2, x1 - x0 + 2, 2, GOLD_LO);
  }

  // ---- dörren ----
  {
    const { x0, x1, top } = DOOR;
    P.rect(x0 - 3, top - 3, x1 - x0 + 6, WALL_Y - top + 3, LACK);
    P.box(x0 - 3, top - 3, x1 - x0 + 6, WALL_Y - top + 3, GOLD);
    for (let i = 0; i < 2; i++) {
      const gx = x0 + i * 16;
      area(P, gx + 1, top, 14, WALL_Y - top - 1, (x, y) => {
        let c = mix(0xb8dcec, 0x7aa6bc, (y - top) / 50);
        if ((x - y + 400) % 19 < 2) c = mix(c, WHITE, 0.35);
        return c;
      });
      P.vl(gx, top, WALL_Y - top, GOLD); P.vl(gx + 15, top, WALL_Y - top, GOLD_LO);
      P.rect(gx + (i ? 2 : 11), top + 26, 2, 12, GOLD_HI); P.vl(gx + (i ? 3 : 12), top + 26, 12, GOLD_LO);
    }
    // UT-skylten
    P.rect((x0 + x1) / 2 - 9, top - 13, 18, 9, 0x1d2b1f); P.box((x0 + x1) / 2 - 9, top - 13, 18, 9, 0x2f8f46);
    text(P, SMALL, $t('UT'), (x0 + x1) / 2 - 3, top - 11, 0x6fe08a);
  }

  // ---- kartongväggen + SKOBUTIKEN-skylten ----
  {
    const { x0, x1 } = BOXW;
    P.rect(x0, 12, x1 - x0, 18, 0x121216);
    P.box(x0, 12, x1 - x0, 18, GOLD);
    const nm = $t('SKOBUTIKEN'), tw = textW(BIG, nm);
    text(P, BIG, nm, Math.round((x0 + x1) / 2 - tw / 2) + 1, 18, 0x5a4a2a);
    text(P, BIG, nm, Math.round((x0 + x1) / 2 - tw / 2), 17, 0xf0d060);
    // små sneakers i skylten
    stampShoe(P, x0 + 4, 27, 'sneakers', '#d83a3a', '#f4f1ea');
    stampShoe(P, x1 - 20, 27, 'heels', '#d83a3a', '#d83a3a', true);
    // hyllfacken med kartonger
    const top = 32, bot = WALL_Y - 2, cw = 13, rh = 8;
    P.rect(x0, top - 2, x1 - x0, bot - top + 2, 0x4a3020);
    const BOX = [0x1c1c20, 0xe8743a, 0xf4f1ea, 0x3a7bd5, 0xc9323a, 0x46a35a, 0xf28bb3, 0xd8b060, 0x8a5a32, 0x2aa39a];
    for (let r = 0; top + r * rh < bot - 2; r++) for (let c = 0; x0 + 2 + c * cw < x1 - cw + 2; c++) {
      const bx = x0 + 2 + c * cw, by = top + r * rh;
      P.rect(bx - 1, by - 1, cw, rh, 0x2e1c10);
      if (hash(c, r, 71) < 0.1) { P.rect(bx, by, cw - 2, rh - 2, 0x1a100a); continue; }   // tomt fack
      const col = BOX[Math.floor(hash(c, r, 72) * BOX.length)];
      P.rect(bx, by + 1, cw - 2, rh - 3, col);
      P.hl(bx, by, cw - 2, mix(col, WHITE, 0.25));                // locket
      P.hl(bx, by + rh - 3, cw - 2, mul(col, 0.7));
      const lc = col === 0xf4f1ea ? 0x2b2b30 : 0xf4f1ea;
      P.rect(bx + 3, by + 2, 5, 2, lc);                           // etiketten
      P.px(bx + 4 + ((c + r) % 3), by + 2, col === 0xf4f1ea ? 0xf4f1ea : 0x3a3440);
    }
    // rullstegen
    for (let i = 0; i <= 58; i++) {
      const y = 28 + i, xa = 350 + Math.round(i * 0.22), xb = xa + 8;
      if (y >= WALL_Y) break;
      P.px(xa, y, 0x8a5a32); P.px(xb, y, 0x8a5a32); P.px(xa + 1, y, 0x5a3a20); P.px(xb + 1, y, 0x5a3a20);
      if (i % 7 === 3) P.hl(xa + 1, y, 7, 0xa8703e);
    }
    P.rect(x0, 29, x1 - x0, 1, 0xc9ccd6);                          // stegens skena
  }

  // ---- B: KÄNGOR + STÖVLAR (ekhylla) ----
  {
    const U = UNITS.B, x0 = U.x0, x1 = U.x1;
    area(P, x0, U.top, x1 - x0, WALL_Y - U.top, (x, y) => {
      const pl = Math.floor((x - x0) / 9), sx = (x - x0) % 9;
      let c = mul(WALNUT, 0.9 + hash(pl, 1, 91) * 0.2);
      if (sx === 0) c = mul(c, 0.72);
      else if (hash(x, y >> 2, 92) > 0.9) c = mul(c, 0.9);
      return c;
    });
    for (const [a, w] of [[x0 - 4, 4], [x1, 4]]) area(P, a, U.top - 2, w, WALL_Y - U.top + 2, (x, y) => jit(x === a ? mix(OAK, WHITE, 0.2) : OAK, x, y, 93, 0.06));
    P.rect(x0 - 4, U.top - 3, x1 - x0 + 8, 3, mix(OAK, WHITE, 0.15));
    // skylten: ljus planka med inbränd text
    P.rect(x0 + 2, U.top + 2, x1 - x0 - 4, 14, 0xe0b27a); P.box(x0 + 2, U.top + 2, x1 - x0 - 4, 14, 0x8a5a32);
    P.hl(x0 + 3, U.top + 3, x1 - x0 - 6, 0xf0cc98);
    const tw = textW(BIG, U.name);
    text(P, BIG, U.name, Math.round((x0 + x1) / 2 - tw / 2), U.top + 6, 0xf6dcb0);
    text(P, BIG, U.name, Math.round((x0 + x1) / 2 - tw / 2), U.top + 5, 0x4a2c16);
    for (const y of U.rows) {
      P.ell((x0 + x1) / 2, y - 10, (x1 - x0) / 2, 12, 0xffe0b0, 0.14, 4);
      P.rect(x0 - 2, y, x1 - x0 + 4, 3, OAK); P.hl(x0 - 2, y, x1 - x0 + 4, mix(OAK, WHITE, 0.35)); P.hl(x0 - 2, y + 2, x1 - x0 + 4, mul(OAK, 0.7));
      P.hl(x0, y + 3, x1 - x0, mul(WALNUT, 0.55));
    }
  }

  // ---- C: FINA SKOR (vitt lackskåp med guldkant) ----
  {
    const U = UNITS.C, x0 = U.x0, x1 = U.x1;
    P.rect(x0 - 4, U.top - 2, x1 - x0 + 8, WALL_Y - U.top + 2, 0xf8f4ee);
    P.vl(x0 - 4, U.top - 2, WALL_Y - U.top + 2, WHITE); P.vl(x1 + 3, U.top - 2, WALL_Y - U.top + 2, 0xd8d0c4);
    area(P, x0, U.top + 17, x1 - x0, WALL_Y - U.top - 18, (x, y) => {
      const d = ((x - x0) + (y - U.top)) % 8, e = ((x - x0) - (y - U.top) + 800) % 8;
      let c = 0xf2dcd6;
      if (d === 0 || e === 0) c = 0xf8e8e2;
      return jit(c, x, y, 94, 0.04);
    });
    P.box(x0 - 1, U.top + 16, x1 - x0 + 2, WALL_Y - U.top - 16, GOLD);
    // skylten: svart oval med guldtext
    P.rect(x0 + 8, U.top + 1, x1 - x0 - 16, 14, LACK); P.box(x0 + 8, U.top + 1, x1 - x0 - 16, 14, GOLD);
    P.box(x0 + 10, U.top + 3, x1 - x0 - 20, 10, GOLD_LO);
    const tw = textW(BIG, U.name);
    text(P, BIG, U.name, Math.round((x0 + x1) / 2 - tw / 2), U.top + 5, 0xf0d060);
    for (const y of U.rows) {
      P.ell((x0 + x1) / 2, y - 8, (x1 - x0) / 2, 10, 0xfff4e4, 0.18, 4);
      P.rect(x0, y, x1 - x0, 2, 0xd8eef4); P.hl(x0, y, x1 - x0, WHITE); P.hl(x0, y + 2, x1 - x0, 0x9ab8c4);
      for (const bx of [x0 + 3, x1 - 5]) { P.rect(bx, y + 2, 2, 2, GOLD); P.px(bx, y + 2, GOLD_HI); }
      P.hl(x0, y + 3, x1 - x0, 0xe0c4bc);
    }
  }

  // ---- golvet: fiskbensparkett i ek ----
  area(P, 0, WALL_Y, W, H - WALL_Y, (x, y) => parquet(x, y));
  // mörk kant längs väggen, skugga
  P.rect(0, WALL_Y, W, 3, 0x4a2e1a); P.hl(0, WALL_Y + 3, W, 0x7a5030);
  for (let i = 0; i < 6; i++) P.darken(0, WALL_Y + 3 + i, W, 1, 0.82 + i * 0.03);
  // dörrmattan
  P.rect(DOOR.x0 - 5, WALL_Y, DOOR.x1 - DOOR.x0 + 10, 11, 0x1c1c20);
  P.box(DOOR.x0 - 5, WALL_Y, DOOR.x1 - DOOR.x0 + 10, 11, GOLD_LO);
  P.box(DOOR.x0 - 3, WALL_Y + 2, DOOR.x1 - DOOR.x0 + 6, 7, 0x2e2e36);
  stampShoe(P, (DOOR.x0 + DOOR.x1) / 2 - 7, WALL_Y + 8, 'sneakers', '#d8b060', '#8a6a2a', true);
  // rund matta i provhörnan
  for (let y = RUG.cy - RUG.ry; y <= RUG.cy + RUG.ry; y++) for (let x = RUG.cx - RUG.rx; x <= RUG.cx + RUG.rx; x++) {
    const d = Math.hypot((x + 0.5 - RUG.cx) / RUG.rx, (y + 0.5 - RUG.cy) / RUG.ry);
    if (d > 1) continue;
    let c = d > 0.9 ? GOLD : d > 0.86 ? 0x7a5a20 : d > 0.8 ? 0x2a5a48 : d > 0.76 ? 0xc8a050 : 0x2e6a52;
    if (d < 0.76 && (Math.round(x / 2) + Math.round(y)) % 9 === 0) c = 0x3a7a62;
    c = jit(c, x, y, 95, 0.06);
    P.px(x, y, c);
  }
  // ljuspölar framför väggarna
  for (const lx of LAMPS) P.ell(lx, WALL_Y + 12, 34, 9, 0xfff4dc, 0.2, 4);
  P.ell(GIANT.x, GIANT.y - 4, 44, 10, 0xfff0d0, 0.18, 4);
  // fotmätaren (platt på golvet)
  {
    const { x, y } = MEASURE;
    P.rect(x - 9, y - 3, 19, 6, 0x9098a4); P.box(x - 9, y - 3, 19, 6, 0x4a4e58);
    P.hl(x - 8, y - 2, 17, 0xd8dce4);
    for (let i = 0; i < 15; i += 2) P.px(x - 7 + i, y, 0x2a2a30);
    for (let i = 0; i < 15; i += 4) P.px(x - 7 + i, y + 1, 0x2a2a30);
    P.rect(x + 3, y - 2, 3, 4, 0xc9323a); P.hl(x + 3, y - 2, 3, 0xf07a7a);
  }
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
// fiskbensparkett: plankor 8×4 i trappsteg (vågräta/lodräta om vartannat)
function parquet(x, y) {
  const w = 4, i = Math.floor(x / w), j = Math.floor(y / w), s = ((i + j) % 4 + 4) % 4;
  const hor = s < 2;
  const pid = hor ? (i - s) * 7919 + j * 31 : i * 7919 + (j - (s - 2)) * 31;
  const px = x - i * w, py = y - j * w;
  let c = mul(OAK, 0.93 + hash(pid, 3, 41) * 0.11);
  if (hor ? hash(x >> 2, y, 42) > 0.88 : hash(x, y >> 2, 43) > 0.88) c = mul(c, 0.965);
  const seam = hor ? (py === 0 || (s === 0 && px === 0)) : (px === 0 || (s === 2 && py === 0));
  if (seam) c = mul(c, 0.87);
  else if (hor ? py === 1 : px === 1) c = mix(c, WHITE, 0.05);
  return jit(c, x, y, 44, 0.02);
}
// liten sko direkt i en Pix (skyltar, mattan)
function stampShoe(P, x, footY, model, main, second, flat = false) {
  const map = SHOE_ART[model] || SHOE_ART.normal;
  const M = rampOf(hexInt(main, 0xd83a3a)), S = rampOf(hexInt(second, 0xf4f1ea));
  const y0 = footY - map.length;
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '.') continue;
    let c = 'hbld'.includes(ch) ? M[{ h: 'hi', b: 'base', l: 'lo', d: 'dk' }[ch]] : 'HBLD'.includes(ch) ? S[{ H: 'hi', B: 'base', L: 'lo', D: 'dk' }[ch]] : FIX[ch] ?? M.base;
    if (ch === 'i') c = M.dk;
    if (flat) c = 'HBLDwWce'.includes(ch) ? S.base : M.base;
    P.px(x + i, y0 + j, c);
  } });
}

function paintDesk() {
  const w = DESK.x1 - DESK.x0, h = 32, oy = h, P = new Pix(w, h);
  const topY = 8;
  // bänkskiva i ljus marmor
  area(P, 0, topY, w, 5, (x, y) => { let c = 0xf2eee6; if ((x * 3 + y * 7) % 23 === 0 || (x + y * 5) % 31 === 0) c = 0xc8c4bc; return jit(c, x, y, 61, 0.04); });
  P.hl(0, topY, w, WHITE); P.hl(0, topY + 4, w, 0xb8b0a4);
  // front i svart lack med guldlister och paneler
  area(P, 1, topY + 5, w - 2, h - topY - 7, (x, y) => jit(LACK, x, y, 62, 0.05));
  P.hl(1, topY + 5, w - 2, GOLD); P.hl(1, topY + 6, w - 2, GOLD_LO);
  for (let px = 6; px < w - 8; px += 19) { P.box(px, topY + 9, 15, h - topY - 14, 0x3a3a44); P.hl(px + 1, topY + 10, 13, 0x2a2a32); }
  P.hl(1, h - 3, w - 2, GOLD_LO); P.rect(1, h - 2, w - 2, 2, 0x0a0a0c);
  // kassaapparat, kortläsare, påsar, en kartong, en skål med godis
  P.rect(52, 0, 16, 9, 0x2a2a32); P.rect(53, 1, 14, 4, 0x6fe08a); P.hl(54, 2, 6, 0x1d5a2c); P.hl(54, 3, 9, 0x2f8f46);
  P.rect(51, 6, 18, 3, 0x3a3a44); P.hl(51, 6, 18, 0x5a5a64);
  P.rect(71, 3, 5, 6, 0x2a2a32); P.hl(72, 4, 3, 0x8fa0b8); P.px(73, 6, 0x6fe08a);
  // papperspåse med sko-loggan
  P.rect(34, 0, 11, 9, 0xe8d8b8); P.box(34, 0, 11, 9, 0x8a7050); P.hl(36, -1, 7, 0x8a7050);
  P.rect(37, 3, 5, 3, 0xc9323a); P.hl(37, 5, 5, 0xf4f1ea);
  // kartong med lock
  P.rect(6, 2, 22, 7, 0xe8743a); P.hl(6, 2, 22, 0xf4a070); P.rect(5, 1, 24, 2, 0xf08a50); P.hl(5, 1, 24, 0xf8b890);
  P.rect(12, 4, 9, 3, 0xf4f1ea); P.hl(13, 5, 5, 0x3a3440);
  // godisskål
  P.rect(80 - 4, 5, 7, 3, 0xd8eef4); P.hl(76, 5, 7, WHITE); P.px(77, 4, 0xc9323a); P.px(79, 4, 0xf0b429); P.px(81, 4, 0x46a35a);
  P.box(0, topY, w, h - topY, 0x0e0d12);
  return { img: P.flush(), ox: 0, oy };
}

function paintBench() {
  const w = BENCH.x1 - BENCH.x0, h = 14, P = new Pix(w, h);
  const V = { hi: 0x4a9a78, base: 0x2e6a52, lo: 0x1f4e3c, dk: 0x143628 };
  // dyna: knappad sammet
  area(P, 1, 0, w - 2, 4, (x, y) => (y === 0 ? V.hi : jit(V.base, x, y, 63, 0.06)));
  for (let x = 6; x < w - 4; x += 10) { P.px(x, 2, V.dk); P.px(x - 1, 1, V.hi); P.px(x + 5, 1, V.dk); }
  // front med guldkant och veck
  P.hl(0, 4, w, GOLD); P.hl(0, 5, w, GOLD_LO);
  area(P, 1, 6, w - 2, 4, (x, y) => ((x % 5) === 0 ? V.lo : (x % 5) === 1 ? V.hi : V.base));
  P.hl(1, 9, w - 2, V.dk);
  // mässingsben
  for (const lx of [3, (w >> 1) - 1, w - 5]) { P.rect(lx, 10, 2, 3, GOLD); P.px(lx, 10, GOLD_HI); P.rect(lx - 1, 13, 4, 1, GOLD_LO); }
  outline(P);
  return { img: P.flush(), ox: 0, oy: h };
}

function paintFloorMirror() {
  const w = 12, h = 24, P = new Pix(w, h);
  // lutande spegel med guldram på en liten fot
  for (let j = 0; j < 18; j++) {
    const inset = j < 2 ? 1 : 0;
    for (let i = 1 + inset; i < w - 1 - inset; i++) {
      const edge = i === 1 + inset || i === w - 2 - inset || j === 0 || j === 17;
      P.px(i, j + 1, edge ? (i < 4 ? GOLD_HI : GOLD) : mix(0xe0ecf0, 0x98b0bc, j / 18));
    }
  }
  for (let j = 3; j < 16; j += 5) P.px(4 + (j % 3), j, WHITE);
  P.rect(2, 19, 8, 2, GOLD_LO); P.hl(2, 19, 8, GOLD);
  P.rect(1, 21, 10, 2, 0x3a3440); P.hl(1, 21, 10, 0x5a5460);
  outline(P);
  return { img: P.flush(), ox: 6, oy: 23 };
}

function paintHorn() {
  const w = 10, h = 38, P = new Pix(w, h);
  // ställ i mässing med ett långt skohorn på kroken
  P.vl(4, 3, 32, GOLD); P.vl(5, 3, 32, GOLD_LO);
  P.rect(1, 35, 8, 2, GOLD_LO); P.hl(1, 35, 8, GOLD);
  P.rect(3, 2, 4, 2, GOLD_HI); P.px(6, 4, GOLD);
  // skohornet (sköldpaddsmönstrat)
  for (let j = 0; j < 26; j++) {
    const wdt = j > 20 ? 4 : 2, x0 = 6 + (j > 20 ? -1 : 0);
    for (let i = 0; i < wdt; i++) P.px(x0 + i, 5 + j, ((i + j) % 3 === 0) ? 0x5a3018 : j % 4 < 2 ? 0x9a5a2a : 0xb8763a);
  }
  P.px(7, 30, 0xd89a58);
  outline(P);
  return { img: P.flush(), ox: 5, oy: 37 };
}

function paintOpenBox() {
  const w = 24, h = 14, P = new Pix(w, h);
  // öppen kartong: botten, silkespapper, en stövlett, locket lutat bakom
  P.rect(12, 0, 11, 7, 0xe8743a); P.hl(12, 0, 11, 0xf8b890); P.vl(22, 1, 6, 0xb8542a);   // locket
  P.rect(1, 5, 18, 7, 0xe8743a); P.hl(1, 5, 18, 0xf4a070); P.hl(1, 11, 18, 0xa84a22);
  P.rect(2, 4, 16, 2, 0xf8f4ee); P.px(4, 3, 0xf8f4ee); P.px(13, 3, 0xf8f4ee); P.px(16, 4, WHITE);       // silkespapper
  P.rect(6, 8, 7, 2, 0xf4f1ea); P.hl(7, 9, 4, 0x3a3440);                                               // etikett
  outline(P);
  const img = P.flush(), x = img.getContext('2d');
  const ic = shoeIcon('ankleBoots', '#6b3e1e', '#6b3e1e');
  x.drawImage(ic.img, 0, 0, ic.w, 8, 4, -3, ic.w, 8);
  return { img, ox: 11, oy: 13 };
}

function paintStack() {
  const w = 28, h = 24, P = new Pix(w, h);
  const boxes = [[1, 14, 24, 8, 0x1c1c20], [3, 7, 22, 7, 0xf4f1ea], [0, 0, 20, 7, 0xe8743a]];
  for (const [x, y, bw, bh, c] of boxes) {
    P.rect(x, y, bw, bh, c); P.hl(x, y, bw, mix(c, WHITE, 0.3)); P.rect(x, y + 1, bw, 1, mix(c, WHITE, 0.12));
    P.vl(x + bw - 1, y + 1, bh - 1, mul(c, 0.72)); P.hl(x, y + bh - 1, bw, mul(c, 0.7));
    const lc = c === 0xf4f1ea ? 0x2b2b30 : 0xf4f1ea;
    P.rect(x + 3, y + 3, 6, 2, lc); P.px(x + bw - 5, y + 3, c === 0x1c1c20 ? GOLD : 0xc9323a);
  }
  outline(P);
  return { img: P.flush(), ox: 13, oy: 23 };
}

function paintTable() {
  const w = TABLE.x1 - TABLE.x0, h = 16, P = new Pix(w, h);
  // bordsskiva i valnöt med vit löpare, låg sarg och ben
  P.rect(0, 2, w, 3, 0x8a5a32); P.hl(0, 2, w, 0xb07a44); P.hl(0, 4, w, 0x5a3a20);
  P.rect(6, 1, w - 12, 2, 0xf8f4ee); P.hl(6, 1, w - 12, WHITE);
  area(P, 1, 5, w - 2, 4, (x, y) => jit(WALNUT, x, y, 64, 0.06));
  P.hl(1, 8, w - 2, 0x3a2414);
  for (const lx of [3, w - 6]) { P.rect(lx, 9, 3, 6, WALNUT); P.vl(lx, 9, 6, 0x8a5a32); }
  outline(P);
  return { img: P.flush(), ox: 0, oy: h - 1 };
}

function paintPeg() {
  const w = PEG.x1 - PEG.x0, h = PEG.y - PEG.top + 1, P = new Pix(w, h);
  // svart skylt med SPORT och en fotboll
  P.rect(0, 0, w, 9, LACK); P.hl(0, 8, w, GOLD);
  const tw = textW(BIG, $t('SPORT'));
  text(P, BIG, $t('SPORT'), Math.round(w / 2 - tw / 2), 1, 0xf6f1e6);
  spr(P, 5, 1, ['.kwk.', 'kwkwk', 'wkwkw', 'kwkwk', '.kwk.'].map((r) => r), { k: 0x1c1c20, w: 0xf6f1e6 });
  spr(P, w - 10, 1, ['.kwk.', 'kwkwk', 'wkwkw', 'kwkwk', '.kwk.'], { k: 0x1c1c20, w: 0xf6f1e6 });
  // perforerad skiva
  const by0 = 9, by1 = PEG_SHELF - PEG.top + 12;
  area(P, 1, by0, w - 2, by1 - by0, (x, y) => ((x % 4 === 2 && y % 4 === 1) ? 0xb8ac96 : jit(0xe6dcc8, x, y, 65, 0.04)));
  P.vl(0, by0, by1 - by0, LACK); P.vl(w - 1, by0, by1 - by0, LACK); P.hl(0, by1, w, LACK);
  // trådhyllan för fotbollsskorna
  const sy = PEG_SHELF - PEG.top;
  P.hl(1, sy + 1, w - 2, 0xc8ccd6); P.hl(1, sy + 2, w - 2, 0x6a6e78);
  for (let x = 4; x < w - 3; x += 6) P.px(x, sy, 0x9098a4);
  // ben
  for (const lx of [4, w - 6]) { P.rect(lx, by1 + 1, 2, h - by1 - 2, LACK); P.rect(lx - 2, h - 2, 6, 2, 0x2a2a32); }
  return { img: P.flush(), ox: 0, oy: h - 1 };
}

function paintNews() {
  const w = NEWS.x1 - NEWS.x0, h = 14, P = new Pix(w, h);
  P.rect(0, 4, w, 8, LACK); P.hl(0, 4, w, GOLD); P.hl(0, 11, w, GOLD_LO);
  P.rect(2, 0, w - 4, 5, 0xf8f4ee); P.hl(2, 0, w - 4, WHITE);
  const tw = textW(SMALL, $t('NYHETER'));
  text(P, SMALL, $t('NYHETER'), Math.round(w / 2 - tw / 2), 6, 0xf0d060);
  outline(P);
  return { img: P.flush(), ox: 0, oy: h - 1 };
}

// Jättesneakern på en rund podie – samma röda sneaker som fasadens takskylt, i stort
function paintGiant() {
  const w = 72, h = 40, P = new Pix(w, h);
  // podien: rund ovansida (guldkant) och en låg cylindersida i svart lack
  for (let y = 26; y < 40; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - 36) / 35;
    if (Math.abs(dx) >= 1) continue;
    const e = Math.sqrt(1 - dx * dx) * 4, top = 30 - e, bot = 30 + e;
    if (y < Math.floor(top)) continue;
    if (y <= bot) P.px(x, y, y - top < 1.2 || bot - y < 0.8 || Math.abs(dx) > 0.94 ? GOLD : jit(0x26262c, x, y, 66, 0.06));
    else if (y <= bot + 4) P.px(x, y, y > bot + 3 ? 0x0a0a0c : y <= bot + 1 ? GOLD_LO : jit(LACK, x, y, 70, 0.05));
  }
  P.ell(36, 31, 22, 3, 0xfff4dc, 0.25, 3);
  // skon: tån åt höger
  const sx = 8, sy = 4;
  const topLine = (x) => (x <= 13 ? 2 : x <= 38 ? 3 + (x - 13) * 8 / 25 : 11 + (x - 38) * 4 / 16);
  const inShoe = (x, y) => x >= 0 && x <= 56 && y >= topLine(x) && y < 24 && !(x > 53 && y < 16 + (x - 53) * 2);
  for (let y = 0; y < 24; y++) for (let x = 0; x <= 56; x++) {
    if (!inShoe(x, y)) continue;
    let c;
    if (y >= 19) c = y === 19 ? 0xd8d8dc : y === 23 ? 0x3a3a40 : (y === 21 && x % 4 === 0 ? 0xc8c8cc : 0xf4f4f6);   // sulan med mönster
    else if (x > 43 && y > 13) c = y === 14 ? 0xffffff : 0xf0f0f2;                                          // tåhättan
    else if (x <= 3 && y >= 2 && y <= 12) c = LACK;                                                        // hälfliken
    else if (x >= 4 && x <= 12 && y >= 13 && y <= 18) c = x === 4 || y === 13 ? 0xf8f8fa : 0xe8e8ec;        // hälkappan
    else if (y < topLine(x) + 2) c = 0xf05a4a;                                                             // kanten, ljus
    else if (Math.abs(y - (15 - (x - 8) * 5 / 30)) < 1 && x > 7 && x < 40) c = WHITE;                       // ränderna
    else c = x < 16 ? 0xc83030 : y > 16 ? 0xc03030 : 0xd83a3a;
    if (x > 13 && x < 38 && y > topLine(x) + 1 && y < topLine(x) + 4 && (x % 4) === 1) c = 0xe0e0e4;        // snörhålen
    P.px(sx + x, sy + y, c);
  }
  // snörningen
  for (let x = 15; x < 38; x += 4) { const y = Math.round(topLine(x)) + 1; P.px(sx + x, sy + y, WHITE); P.px(sx + x + 1, sy + y + 1, 0xe8e8ec); P.px(sx + x + 2, sy + y, WHITE); }
  // plös som sticker upp
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if (i + j < 8) P.px(sx + 12 + i, sy + j, j === 0 ? 0xf05a4a : 0xd83a3a);
  // sömmar och blänk
  for (let x = 6; x < 50; x += 2) P.px(sx + x, sy + 18, 0xa82828);
  P.px(sx + 24, sy + 8, 0xff8a7a); P.px(sx + 25, sy + 8, 0xff8a7a); P.px(sx + 46, sy + 15, WHITE);
  outline(P);
  return { img: P.flush(), ox: 36, oy: 38 };
}

function paintShineStand() {
  const w = SHINE.x1 - SHINE.x0 + 4, h = 66, P = new Pix(w, h), oy = h - 1;
  const base = h - 1;                         // golvet (SHINE.y)
  const topY = base - 20;                     // podiets ovansida
  const cx = CHAIR.x - SHINE.x0;              // stolens mitt
  // podiet: mörkt trä med mässingskant och två trappsteg till vänster
  area(P, 14, topY, w - 14, 20, (x, y) => (y === topY ? 0xa8703e : y === topY + 1 ? GOLD : jit(0x5a3a22, x, y, 67, 0.06)));
  for (let x = 20; x < w - 2; x += 12) P.vl(x, topY + 3, 16, 0x4a2e1a);
  P.hl(14, base - 1, w - 14, 0x2a1a10);
  for (const [sx, sy2, sw] of [[0, base - 7, 14], [6, base - 13, 8]]) {
    area(P, sx, sy2, sw, base - sy2, (x, y) => (y === sy2 ? 0xc89058 : jit(0x6a4428, x, y, 68, 0.06)));
    P.hl(sx, sy2 + 1, sw, GOLD_LO);
  }
  // SKOPUTS i guld på podiets front
  const tw = textW(SMALL, $t('SKOPUTS'));
  text(P, SMALL, $t('SKOPUTS'), 14 + Math.round((w - 14) / 2 - tw / 2), topY + 8, 0xf0d060);
  text(P, SMALL, $t('GRATIS'), 14 + Math.round((w - 14) / 2 - textW(SMALL, $t('GRATIS')) / 2), topY + 14, 0xc8a050);
  // stolen: hög rygg i oxblodsläder med mässingsnitar
  const LE = { hi: 0xa84040, base: 0x7a2a2a, lo: 0x5a1c1c, dk: 0x3a1010 };
  const seatY = CHAIR.fy - SHINE.y + base - 9;        // sitsens ovansida
  area(P, cx - 9, seatY - 30, 18, 30, (x, y) => (x === cx - 9 ? LE.hi : x >= cx + 7 ? LE.lo : jit(LE.base, x, y, 69, 0.05)));
  for (let y = seatY - 28; y < seatY - 2; y += 5) for (const nx of [cx - 7, cx + 6]) P.px(nx, y, GOLD);
  for (let i = -8; i <= 8; i += 4) P.px(cx + i, seatY - 30, GOLD_HI);
  P.hl(cx - 9, seatY - 31, 18, LE.hi);
  // armstöd
  for (const ax of [cx - 12, cx + 9]) { P.rect(ax, seatY - 8, 3, 8, LE.lo); P.hl(ax, seatY - 8, 3, LE.hi); P.rect(ax, seatY, 3, topY - seatY, GOLD_LO); }
  // sits
  P.rect(cx - 10, seatY, 20, 3, LE.base); P.hl(cx - 10, seatY, 20, LE.hi); P.hl(cx - 10, seatY + 3, 20, LE.dk);
  P.rect(cx - 8, seatY + 4, 16, topY - seatY - 4, 0x3a2414);
  // fotstöden (mässingssulor på stolpar)
  const fy = CHAIR.fy - SHINE.y + base;
  for (const fx of [cx - 5, cx + 1]) { P.rect(fx, fy, 5, 1, GOLD_HI); P.rect(fx, fy + 1, 5, 1, GOLD); P.vl(fx + 2, fy + 2, topY - fy - 2, GOLD_LO); }
  // putslådan med burkar och borstar
  const bx = w - 20, by = topY - 7;
  P.rect(bx, by, 14, 7, 0x8a5a32); P.hl(bx, by, 14, 0xb07a44); P.rect(bx + 5, by - 4, 4, 4, 0x6a4428);
  for (const [i, c] of [[1, 0x1c1c20], [5, 0x8a5a32], [10, 0xc9323a]]) { P.rect(bx + i, by + 2, 3, 2, c); P.hl(bx + i, by + 2, 3, 0xe0e0e4); }
  outline(P);
  return { img: P.flush(), ox: 0, oy };
}

function paintPlant() {
  const w = 22, h = 34, P = new Pix(w, h);
  const L = [[11, 7, 5, 6, 0x2f7a3e], [6, 12, 5, 4, 0x3a8f48], [16, 12, 5, 4, 0x2f7a3e], [8, 17, 5, 4, 0x46a35a], [14, 18, 5, 3, 0x3a8f48], [11, 11, 3, 4, 0x56b866]];
  for (const [x, y, rx, ry, c] of L) for (let yy = y - ry; yy <= y + ry; yy++) for (let xx = x - rx; xx <= x + rx; xx++) {
    if (((xx + 0.5 - x) / rx) ** 2 + ((yy + 0.5 - y) / ry) ** 2 <= 1) P.px(xx, yy, yy < y - ry / 2 ? mix(c, WHITE, 0.2) : c);
  }
  P.vl(11, 16, 7, 0x2a5a2e);
  P.rect(6, 23, 10, 10, LACK); P.hl(5, 23, 12, 0x3a3a42); P.hl(6, 25, 10, GOLD); P.vl(15, 24, 9, 0x0a0a0c);
  outline(P);
  return { img: P.flush(), ox: 11, oy: 33 };
}

// Podiet för VECKANS SKO: sammetskudde på en svart cylinder med guldband och text
function paintPlinth() {
  const w = 36, h = 28, P = new Pix(w, h), cx = w / 2;
  // cylindern: ovansida (ellips), sida i svart lack med guldband
  for (let y = 4; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - cx) / (cx - 1);
    if (Math.abs(dx) >= 1) continue;
    const e = Math.sqrt(1 - dx * dx) * 3, top = 7 - e, bot = 7 + e;
    if (y < Math.floor(top)) continue;
    let c;
    if (y <= bot) c = y - top < 1 || Math.abs(dx) > 0.9 ? GOLD : 0x2a2a30;
    else if (y >= h - 2) c = y === h - 1 ? 0x0a0a0c : GOLD_LO;
    else if (y <= bot + 1) c = GOLD;
    else c = jit(dx < -0.6 ? 0x2e2e36 : dx > 0.6 ? 0x141418 : LACK, x, y, 72, 0.05);
    P.px(x, y, c);
  }
  // sammetskudden
  P.rect(cx - 9, 3, 18, 4, 0x7a2a3a); P.hl(cx - 9, 3, 18, 0xa8405a); P.hl(cx - 9, 6, 18, 0x4a1422);
  P.px(cx - 10, 4, 0xf0d060); P.px(cx + 9, 4, 0xf0d060);
  // VECKANS / SKO i guld
  const l1 = $t('VECKANS'), l2 = $t('SKO');
  text(P, SMALL, l1, Math.round(cx - textW(SMALL, l1) / 2), 13, 0xf0d060);
  text(P, SMALL, l2, Math.round(cx - textW(SMALL, l2) / 2), 19, 0xf0d060);
  outline(P);
  return { img: P.flush(), ox: Math.round(cx), oy: h - 1 };
}

// Gatupratare (A-skylt) med REA -25 % – står innanför dörren REA-dagar
function paintReaSign() {
  const w = 22, h = 24, P = new Pix(w, h);
  // ben (A-form) i trä
  for (let j = 0; j < 5; j++) { P.px(2 - (j >> 2), 18 + j, 0x6a4428); P.px(w - 3 + (j >> 2), 18 + j, 0x6a4428); }
  // tavlan med ram
  P.rect(0, 0, w, 19, 0x8a5a32); P.hl(0, 0, w, 0xb07a44);
  area(P, 2, 2, w - 4, 15, (x, y) => jit(0x24302a, x, y, 71, 0.08));
  text(P, BIG, $t('REA'), 3, 3, 0xffd0c8);
  text(P, BIG, $t('REA'), 2, 3, 0xff4a3a);
  text(P, SMALL, '-25%', 4, 12, 0xf6f1e6);
  P.px(w - 5, 4, 0xf0d060); P.px(w - 4, 5, 0xf0d060); P.px(w - 5, 6, 0xf0d060);    // krita-stjärna
  outline(P);
  return { img: P.flush(), ox: 11, oy: 23 };
}

function paintPaper() {
  const P = new Pix(15, 10);
  P.rect(0, 0, 15, 10, 0xeee8da); P.vl(7, 0, 10, 0xb8b0a0);
  for (let y = 2; y < 9; y += 2) { P.hl(1, y, 5, 0x6a6470); P.hl(9, y, 5, 0x6a6470); }
  P.rect(1, 1, 5, 2, 0x3a3440); P.rect(9, 5, 4, 3, 0x8aa0b8);
  outline(P);
  return { img: P.flush() };
}
function paintBrush() {
  const P = new Pix(9, 5);
  P.rect(1, 0, 7, 2, 0x8a5a32); P.hl(1, 0, 7, 0xb07a44);
  for (let x = 1; x < 8; x++) P.vl(x, 2, 2, x % 2 ? 0x2a2420 : 0x4a4038);
  return P.flush();
}
function paintCarryBox() {
  const P = new Pix(13, 9);
  P.rect(1, 1, 11, 7, 0xe8743a); P.hl(1, 1, 11, 0xf8b890); P.rect(0, 0, 13, 2, 0xf08a50); P.hl(0, 0, 13, 0xf8b890);
  P.rect(4, 4, 5, 2, 0xf4f1ea); P.vl(11, 2, 6, 0xb8542a);
  outline(P);
  return P.flush();
}
function paintNightLight() {
  const P = new Pix(W, H);
  for (const lx of LAMPS) P.ell(lx, 30, 40, 34, 0xffc890, 0.3, 5);
  for (const U of Object.values(UNITS)) for (const y of U.rows) P.ell((U.x0 + U.x1) / 2, y - 6, (U.x1 - U.x0) / 2, 10, 0xfff0c0, 0.25, 4);
  P.ell(GIANT.x, GIANT.y - 14, 40, 20, 0xffd0a0, 0.2, 4);
  P.ell((UNITS.A.x0 + UNITS.A.x1) / 2, UNITS.A.top + 9, 64, 12, 0xff4a5a, 0.35, 4);   // neonskylten
  P.ell((BOXW.x0 + BOXW.x1) / 2, 21, 50, 8, 0xffe070, 0.3, 4);                        // SKOBUTIKEN
  P.ell((UNITS.C.x0 + UNITS.C.x1) / 2, UNITS.C.top + 8, 40, 7, 0xffe070, 0.22, 4);
  return P.flush();
}

// ======================= köpdialogen: prova skorna på DIN figur =======================
const SWATCHES = ['#1c1c20', '#2b2b30', '#f4f1ea', '#6b3e1e', '#8a5a32', '#a86b32', '#c9323a', '#e07a2e', '#f0b429', '#e8f030', '#46a35a', '#2aa39a', '#3a7bd5', '#2d3a5c', '#8e5bd1', '#f28bb3', '#ff5fa8', '#b9b3ab'];
const DETAILS = ['#f4f1ea', '#1c1c20', '#f0b429', '#c9323a', '#f28bb3', '#3a7bd5', '#46a35a', '#8e5bd1', '#2aa39a', '#e07a2e'];
const DIRS = ['down', 'left', 'up', 'right'];
const DIR_NAMES = [$t('Framifrån'), $t('Från sidan'), $t('Bakifrån'), $t('Från sidan')];

// figuren i heltalsskala (hela enhetspixlar) – aldrig suddig. crop = [x, y, w, h] i spriten
function figure(look, dir, S, crop = null, frame = 0) {
  const src = mkCanvas(28, 44);
  drawPerson(src.getContext('2d'), 14, 41, look, dir, frame);
  const [cx, cy, cw, ch] = crop || [0, 0, 28, 44];
  const dpr = globalThis.devicePixelRatio || 1;
  const D = Math.max(1, Math.round(S * dpr));
  const c = mkCanvas(cw * D, ch * D);
  c.style.width = (cw * D / dpr) + 'px'; c.style.height = (ch * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height);
  return c;
}
function iconCanvas(ic, S) {
  const dpr = globalThis.devicePixelRatio || 1, D = Math.max(1, Math.round(S * dpr));
  const c = mkCanvas(ic.w * D, ic.h * D);
  c.style.width = (ic.w * D / dpr) + 'px'; c.style.height = (ic.h * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(ic.img, 0, 0, c.width, c.height);
  return c;
}
const uniq = (a) => [...new Set(a.map((c) => String(c).toLowerCase()))];

function openShoeDialog(A, api, item, { colors = [], ci = 0, where = '', onBuy, back = null } = {}) {
  const g = A.game, model = item.look.shoeType;
  const uses2 = !!entryOf('shoeType', model)?.uses?.includes('shoes2');
  const first = colors[ci] || colors[0] || [item.colors?.shoes || '#3a7bd5', item.colors?.shoes2 || '#f4f1ea'];
  let main = first[0], det = first[1];
  const mainSw = uniq([...colors.map((c) => c[0]), ...SWATCHES]).slice(0, 20);
  const detSw = uniq([...colors.map((c) => c[1]), ...DETAILS]).slice(0, 12);
  let dirI = 0;
  const owned = api.owns(item), price = api.price(item), short = price - g.money;
  const name = plain(item.name);
  const withIt = () => ({ ...lookForItem(item, A.avatar.look), shoes: main, ...(uses2 ? { shoes2: det } : {}) });
  const swBtn = (c, on, attr) => `<button class="skb-sw ${on ? 'on' : ''}" ${attr}="${c}" style="--c:${c}" aria-label="${$t`Färg ${c}`}"></button>`;
  const body = `<style>
    .skb{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
    .skb-l{display:flex;flex-direction:column;gap:6px;align-items:center;flex:none}
    .skb-stage{display:flex;align-items:flex-end;gap:6px;padding:10px 12px 0;border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);
      background:linear-gradient(#f4ead8 0 70%, #8a6a2a 70% 71%, #c8955a 71% 100%)}
    .skb-fig{display:flex;flex-direction:column;align-items:center}
    .skb-fig canvas,.skb-zoom canvas,.skb-shelf canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
    .skb-fig small,.skb-zoom small{font-size:var(--f1);line-height:1;background:var(--ink);color:#fff;padding:2px 6px 1px;margin-bottom:6px;white-space:nowrap}
    .skb-arrow{font-size:var(--f2);padding-bottom:40px;color:var(--ink)}
    .skb-zooms{display:flex;gap:8px;align-items:flex-end}
    .skb-zoom{display:flex;flex-direction:column;align-items:center;border:3px solid var(--ink);background:#e9dcc4;padding:6px 6px 0}
    .skb-turn{display:flex;gap:6px;align-items:center}
    .skb-view{font-size:var(--f2);min-width:92px;text-align:center}
    .skb-r{flex:1;min-width:230px;display:flex;flex-direction:column;gap:8px}
    .skb-dept{font-size:var(--f1);color:var(--muted);margin:0;display:flex;gap:8px;align-items:center}
    .skb-price{font-size:var(--f3);margin:0;line-height:1}
    .skb-money{font-size:var(--f2);margin:0}
    .skb-sws{display:flex;flex-wrap:wrap;gap:6px}
    .skb-sw{width:28px;height:28px;padding:0;border:3px solid var(--ink);background:var(--c);cursor:pointer;box-shadow:2px 2px 0 var(--ink)}
    .skb-sws.small .skb-sw{width:24px;height:24px}
    .skb-sw.on{outline:3px solid #ffd23f;outline-offset:1px;transform:translate(-1px,-1px)}
    .skb-hint{font-size:var(--f2);line-height:1.1;color:var(--muted);margin:0}
    .skb-wear{font-size:var(--f2);display:flex;gap:8px;align-items:center;cursor:pointer}
    .skb-wear input{width:20px;height:20px}
  </style>
  <div class="skb">
    <div class="skb-l">
      <div class="skb-stage">
        <div class="skb-fig" data-fig="now"><i></i><small>${$t('Du nu')}</small></div>
        <div class="skb-arrow">➜</div>
        <div class="skb-fig" data-fig="new"><i></i><small>${$t`Med ${esc(name.toLowerCase())}`}</small></div>
      </div>
      <div class="skb-turn">
        <button class="btn btn-small" data-turn="-1" aria-label="${$t('Vrid åt vänster')}">⟲ ${$t('Vrid')}</button>
        <b class="skb-view" data-view>${DIR_NAMES[dirI]}</b>
        <button class="btn btn-small" data-turn="1" aria-label="${$t('Vrid åt höger')}">${$t('Vrid')} ⟳</button>
      </div>
      <div class="skb-zooms">
        <div class="skb-zoom" data-zoom="side"><i></i><small>${$t('Närbild')}</small></div>
        <div class="skb-zoom" data-zoom="front"><i></i><small>${$t('Framifrån')}</small></div>
        <div class="skb-zoom skb-shelf" data-zoom="shelf"><i></i><small>${$t('På hyllan')}</small></div>
      </div>
    </div>
    <div class="skb-r">
      <p class="skb-dept">${esc(where ? $t(where) : $t('Skobutiken'))}</p>
      <p class="skb-price">${owned ? `<b class="ok">${$t('✓ De här är dina!')}</b>` : `${$t`Pris: <b>${price !== item.price ? `<s>${fmt(item.price)}</s> ` : ''}${fmt(price)}</b>`}${price !== item.price ? ` <b class="bad">${$t('REA')}</b>` : ''}`}</p>
      <p class="skb-money">💰 ${$t`Du har <b>${fmt(g.money)}</b>`}${owned ? '' : short > 0 ? ` · <b class="bad">${$t`du saknar ${fmt(short)}`}</b>` : ` · ${$t`kvar efter köpet: <b>${fmt(g.money - price)}</b>`}`}</p>
      <div><b style="font-size:var(--f2)">${$t('Prova färg:')}</b></div>
      <div class="skb-sws" data-sws>${mainSw.map((c) => swBtn(c, c === main.toLowerCase(), 'data-c')).join('')}</div>
      ${uses2 ? `<div><b style="font-size:var(--f2)">${$t('Detaljfärg')}</b> <span class="skb-hint">${$t('(sula, snören, ränder):')}</span></div>
      <div class="skb-sws small" data-dts>${detSw.map((c) => swBtn(c, c === det.toLowerCase(), 'data-a')).join('')}</div>` : ''}
      <p class="skb-hint">${$t('🎨 Färgerna är bara för att prova – när skorna är dina väljer du fritt bland alla färger i garderoben där hemma.')}</p>
      ${colors.length > 1 ? `<p class="skb-hint">${$t('👟 Första färgerna är de som står på hyllan.')}</p>` : ''}
      ${owned ? '' : `<label class="skb-wear"><input type="checkbox" data-wear checked> ${$t('Ta på mig dem direkt')}</label>`}
    </div>
  </div>`;
  const wear = () => { A.avatar = saveAvatar({ ...A.avatar, look: withIt() }); };
  const buttons = [
    back ? { label: $t('⬅ Alla skor'), onClick: () => back() } : { label: $t('Stäng'), onClick: closeModal },
    owned
      ? { label: $t('👟 Ta på mig dem'), cls: 'btn-go', onClick: () => { wear(); play('ok'); toast($t`👟 Snyggt! Du har ${name.toLowerCase()} på dig.`, 'good'); closeModal(); } }
      : { label: $t`🛍️ Köp (${fmt(price)})`, cls: 'btn-go', disabled: short > 0, onClick: () => {
        const wearIt = dlg.querySelector('[data-wear]')?.checked;
        const r = onBuy ? onBuy(item) : api.buy(item);
        if (!r?.ok) { toast(r?.msg || $t('Köpet gick inte.'), 'bad'); return; }
        if (wearIt) wear();
        toast(wearIt ? $t`👟 ${name} är dina! Du har dem på dig.` : $t`👟 ${name} är dina! De står i garderoben där hemma.`, 'good');
        closeModal();
      } },
  ];
  const dlg = openModal(`${item.icon || '👟'} ${esc(name)}`, body, buttons);
  const big = window.innerHeight >= 620 && window.innerWidth >= 560 ? 5 : 4;
  const render = () => {
    const now = A.avatar.look, L = withIt();
    dlg.querySelector('[data-fig="now"] i').replaceChildren(figure(now, DIRS[dirI], 2));
    dlg.querySelector('[data-fig="new"] i').replaceChildren(figure(L, DIRS[dirI], big));
    dlg.querySelector('[data-view]').textContent = DIR_NAMES[dirI];
    // närbild av fötterna från sidan och framifrån (spriten rad 30–41)
    dlg.querySelector('[data-zoom="side"] i').replaceChildren(figure(L, 'right', big, [6, 29, 16, 13]));
    dlg.querySelector('[data-zoom="front"] i').replaceChildren(figure(L, 'down', big, [6, 29, 16, 13]));
    dlg.querySelector('[data-zoom="shelf"] i').replaceChildren(iconCanvas(shoeIcon(model, main, uses2 ? det : main), 3));
  };
  dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { dirI = (dirI + +b.dataset.turn + 4) % 4; play('click'); render(); }));
  dlg.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    main = b.dataset.c;
    dlg.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
    play('click'); render();
  }));
  dlg.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    det = b.dataset.a;
    dlg.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('on', x === b));
    play('click'); render();
  }));
  render();
  return dlg;
}

// ======================= provhörnan: alla skor i butiken =======================
const SEC_ORDER = ['Sneakers', 'Kängor & stövlar', 'Fina skor', 'Sommar', 'Sport', 'Hemma', 'Kul'];
function openCatalogDialog(A, api, groups, onPick) {
  const g = A.game;
  const secs = [];
  for (const G of groups) {
    const sec = groupOf(G.item) || WHERE[G.where] || $n('Skor');
    let s = secs.find((x) => x.name === sec);
    if (!s) secs.push((s = { name: sec, list: [] }));
    s.list.push(G);
  }
  const ord = (n) => { const i = SEC_ORDER.indexOf(n); return i < 0 ? 99 : i; };
  secs.sort((a, b) => ord(a.name) - ord(b.name));
  const cell = (G) => {
    const it = G.item, own = api.owns(it), worn = isWorn(it, A.avatar.look);
    return `<button class="skk-it ${own ? 'own' : ''}" data-g="${esc(G.id)}"><i></i><span>${esc(plain(it.name))}</span>
      <b>${worn ? $t('👟 På dig') : own ? $t('✓ Din') : fmt(api.price(it))}</b></button>`;
  };
  const body = `<style>
    .skk-sec h3{margin:8px 0 4px;font-size:var(--f2)}
    .skk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px}
    .skk-it{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;border:3px solid var(--ink);background:#f4ead8;cursor:pointer;box-shadow:2px 2px 0 var(--ink);font:inherit}
    .skk-it.own{background:#dff3e2}
    .skk-it canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
    .skk-it span{font-size:var(--f1);line-height:1;text-align:center}
    .skk-it b{font-size:var(--f1)}
    .skk-top{margin:0 0 4px;font-size:var(--f2)}
  </style>
  <p class="skk-top">${$t`🪑 Du sitter på provpallen. Välj ett par så får du prova dem! 💰 Du har <b>${fmt(g.money)}</b>.`}</p>
  ${secs.map((s) => `<div class="skk-sec"><h3>${esc($t(s.name))}</h3><div class="skk-grid">${s.list.map(cell).join('')}</div></div>`).join('')}`;
  const dlg = openModal($t('🪑 Provhörnan – alla skor'), body, [{ label: $t('Stäng'), onClick: closeModal }]);
  dlg.querySelectorAll('[data-g]').forEach((b) => {
    const G = groups.find((x) => x.id === b.dataset.g);
    if (!G) return;
    const c = G.colors[0] || ['#3a7bd5', '#f4f1ea'];
    b.querySelector('i').replaceChildren(iconCanvas(shoeIcon(G.model, c[0], c[1]), 3));
    b.onclick = () => { play('click'); onPick(G, 0); };
  });
  return dlg;
}
