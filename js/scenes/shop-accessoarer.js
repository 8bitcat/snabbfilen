// ACCESSOARER – accessoarbutiken downtown (scen 'accessoarer' i js/main.js). Gåbar och
// bredare än skärmen (980 px, kameran följer figuren). Säljer klädkatalogens accessoarer
// (js/data/wardrobe-acc.js): platserna hat, glasses, bag, neck, jewel, hairAcc och phones.
// Allt i katalogen står framme – nya katalogposter hamnar automatiskt på rätt hylla.
//
// Från vänster till höger längs bakväggen:
//   HATTVÄGGEN     tre valnötshyllor med byster, varje hatt på en egen byst, prislappar
//                  i hyllkanten (grön DIN när den är din).
//   SPEGELN        stor helfigursspegel – man ser sig själv (och kunderna) i den.
//   GLASÖGONSKÅPET optikerskåp med upplysta glashyllor och huvudformar med bågarna på.
//   ENTRÉN         veckans look på en docka, glasdörren UT och skylten ACCESSOARER.
//   KASSAN         disk med kassaapparat, presentpapper och påsar; expediten pratar.
//   HÖRLURAR       mörk ljudvägg med neonskylt och equalizer, lurarna på byster.
//   VÄSKVÄGGEN     spårpanel med krokar: ryggsäckar, handväskor, gitarr, vingar …
//   HALSVITRINEN   glasskåp med halsbyster: halsdukar, slipsar, halsband.
// På golvet: SMYCKESDISKEN (glasdisk med sammetsbrickor: örhängen på kort, piercingar,
// klockor på kuddar, armband, ringar i ask, handskar), HÅRSMYCKESBORDET (trappbord med
// peruk-huvuden som bär spännen och byglar), en rund sammetspuff och krukväxter.
// Två kunder går runt, provar saker, visar upp dem och köper ibland.
//
// Köp: klick på en vara (eller hover + klick) → figuren går dit → köpdialogen: varan på
// DIN figur i stor skala, vrid runt, prova färger (bara där färgen syns på plagget), köp
// (pengarna dras, sparas) och ta på direkt. Ägda saker: "Ta på mig" / "Ta av mig".
// Skyltarna ovanför avdelningarna (och klick i dialogens lista) öppnar hela sortimentet
// för platsen som ett rutnät med dig själv i varje ruta.
//
// Ägande via game.js: g.ownsItem(id), g.itemPrice(item), g.buyItem(id) när de finns
// (garderoben med katalog-id). Saknas de (äldre game.js) används en reserv: gamla plagg
// (legacy 'kind:v') köps med g.buyClothes, nya id läggs i g.wardrobe (sparfilen behåller
// dem orörda i _keep) – butiken fungerar alltså även före integrationen.
//
// Mobilen (NÄRA-läget) ser bara ett band av raderna: då följer en lodrät kamera figuren
// och varan man går till – väggen med takskyltarna syns när man står vid den.
//
// _debug: spot(id) → { x, y } i SKÄRMkoordinater (kameran tittar dit om platsen ligger
//   utanför bild, även i höjdled; släpps vid nästa klick). id = katalog-id (t.ex.
//   'hat-fedora') eller 'dorr', 'kassa', 'spegel', 'docka', 'puff', 'hattstang', 'ljud',
//   'skylt-<sektion>'. items() → [{ id, slot, sec, x, y }] alla varor som står framme,
//   sections(), open(id) (köpdialogen), openKat(sektion), buy(id) → resultat, owns(id),
//   price(id), state(), teleport(x, y), lockCam(x|null), cam(), camY() → { y, ty, band },
//   hover(id), tick(sek), shoppers() (kundernas läge), panorama() (hela butiken), iconSheet().
import { drawPerson, entryOf, makeLookRich } from '../core/people.js';
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash, bayer, hex, css } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { fmt } from '../game.js';
import { play } from '../core/sound.js';
import { saveAvatar } from '../core/avatar.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, WALK_SEQ } from './walkable.js';
import { itemsForSlot, itemById, lookForItem, lookWithoutSlot, isWorn, groupOf } from '../data/wardrobe.js';
import { $t } from '../core/i18n.js';

// ======================= mått (världskoordinater) =======================
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till butiken
const W = 980, H = 216;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const CEIL = 8, WALL_Y = 104;
const UNIT_Y = 121;                                            // väggmöblernas framkant på golvet
const HAT = { x0: 10, x1: 258, bases: [44, 77, 110] };          // hattväggen (bystens fot = hyllplanet)
const MIR = { x0: 264, x1: 292, top: 16, y: 119 };              // spegeln (ram inräknad)
const OPT = { x0: 298, x1: 410, bases: [42, 65, 88, 111] };     // glasögonskåpet
const MANQ = { x: 432, y: 124 };                               // veckans look
const DOOR = { x0: 456, x1: 488, top: 40 };
const DOOR_SPOT = [472, 113];
const DESK = { x0: 500, x1: 572, top: 110, face: 124, y: 138 }; // kassadisken
const CLERK_AT = [538, 118];
const PAY = [538, 146];
const SND = { x0: 580, x1: 664, bases: [68, 106] };             // hörlurarna
const BAGW = { x0: 670, x1: 820, hooks: [24, 54, 84] };         // väskväggen
const NECK = { x0: 826, x1: 970, bases: [42, 65, 88, 111] };    // halsvitrinen
const JEW = { x0: 118, x1: 294, top: 144, face: 177, y: 192 };  // smyckesdisken
const HAIRT = { x0: 710, x1: 838, back: 158, front: 176, y: 196 }; // hårsmyckesbordet (formens fot per steg)
const POUF = { x: 490, y: 180 };
const STAND = { x: 58, y: 178 };                               // hattstången
const PLANTS = [[16, 208], [330, 208], [636, 208], [966, 208]];
const SPOTS = [40, 100, 160, 220, 278, 354, 472, 536, 622, 710, 780, 860, 940]; // takspottar

// ======================= färger =======================
const WHITE = 0xffffff, INK = 0x1d1822;
const PLUM = { hi: 0x8e4f82, base: 0x6a3560, lo: 0x4e2446, dk: 0x2e1430 };
const GOLD = { hi: 0xfff0a0, base: 0xe8c050, lo: 0xb88a2a, dk: 0x7a5a18 };
const WALNUT = { hi: 0xa8764e, base: 0x86593a, lo: 0x66422a, dk: 0x3e2618 };
const OAK = { hi: 0xe6c08a, base: 0xcf9f62, lo: 0xab7d46, dk: 0x7a5530 };
const CREAM = { hi: 0xfbf4e8, base: 0xf1e6d6, lo: 0xe0d0ba, dk: 0xb8a48a };
const LACQ = { hi: 0xffffff, base: 0xf4f0ea, lo: 0xd8d0c6, dk: 0x9a9088 };
const CHAR = { hi: 0x4a4656, base: 0x2e2c38, lo: 0x201e28, dk: 0x141218 };
const TEAL = { hi: 0x4fb8a8, base: 0x2a8a80, lo: 0x1c6660, dk: 0x0e3a36 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const ramp = (c) => ({ hi: mix(mul(c, 1.15), 0xfff4e0, 0.18), base: c, lo: mix(mul(c, 0.74), 0x2a1f3a, 0.12), dk: mix(mul(c, 0.5), 0x1a1426, 0.2) });
function jit(c, x, y, s = 0, amt = 0.06) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const safeTxt = (s) => String(s).replace(/­/g, '').toUpperCase().replace(/[–—]/g, '-').replace(/&/g, '+').replace(/[^A-ZÅÄÖÉÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿0-9 \-+!.:,?/%'=]/g, '');   // (accenterna: de andra språken, docs/SPRAK.md)
const plain = (s) => String(s).replace(/­/g, '');

// ======================= ägande och köp =======================
// Ny garderob (katalog-id) när game.js har den, annars reserven på g.wardrobe.
function owns(g, it) {
  if (!it) return false;
  if (typeof g.ownsItem === 'function') { try { return !!g.ownsItem(it.id); } catch { /* reserven */ } }
  if (it.free) return true;
  const w = Array.isArray(g.wardrobe) ? g.wardrobe : [];
  const kept = Array.isArray(g._keep?.wardrobe) ? g._keep.wardrobe : [];
  return w.includes(it.id) || kept.includes(it.id) || (!!it.legacy && w.includes(it.legacy));
}
function priceOf(g, it) {
  if (typeof g.itemPrice === 'function') { try { const p = g.itemPrice(it); if (Number.isFinite(p)) return p; } catch { /* reserven */ } }
  return Math.round(it.price * (g.eventIs?.('rea') ? 0.75 : 1));
}
const isRea = (g, it) => priceOf(g, it) < it.price;
function buyIt(g, it) {
  if (typeof g.buyItem === 'function') return g.buyItem(it.id) || { ok: false, msg: $t('Köpet gick inte igenom.') };
  if (owns(g, it)) return { ok: false, msg: $t('Den har du redan!') };
  const price = priceOf(g, it);
  if (g.money < price) return { ok: false, msg: $t('Du har inte råd – dags att jobba ett pass!') };
  if (it.legacy && typeof g.buyClothes === 'function') {
    const i = it.legacy.indexOf(':'), raw = it.legacy.slice(i + 1);
    const r = g.buyClothes(it.legacy.slice(0, i), raw === 'true' ? true : raw);
    if (r?.ok || owns(g, it)) return { ok: true, item: it, price };
  }
  g.money -= price;
  if (Array.isArray(g.wardrobe) && !g.wardrobe.includes(it.id)) g.wardrobe.push(it.id);
  g.save?.();
  return { ok: true, item: it, price };
}

// ======================= avdelningarna =======================
const SECTIONS = [
  { id: 'hattar', slot: 'hat', sign: $t('HATTAR'), title: $t('Hattar & mössor'), icon: '🎩' },
  { id: 'glasogon', slot: 'glasses', sign: $t('GLASÖGON'), title: $t('Glasögon'), icon: '👓' },
  { id: 'horlurar', slot: 'phones', sign: $t('HÖRLURAR'), title: $t('Hörlurar'), icon: '🎧' },
  { id: 'vaskor', slot: 'bag', sign: $t('VÄSKOR'), title: $t('Väskor'), icon: '👜' },
  { id: 'hals', slot: 'neck', sign: $t('HALS'), title: $t('Halsdukar, slipsar & halsband'), icon: '🧣' },
  { id: 'smycken', slot: 'jewel', sign: $t('SMYCKEN'), title: $t('Smycken, klockor & handskar'), icon: '💍' },
  { id: 'har', slot: 'hairAcc', sign: $t('I HÅRET'), title: $t('Spännen & byglar i håret'), icon: '🎀' },
];
const secOf = (slot) => SECTIONS.find((s) => s.slot === slot) || SECTIONS[0];

// ======================= varornas pixelkonst =======================
// Karta: rader av tecken, '.' = genomskinligt. pal: tecken → färg.
function mapImg(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length, P = new Pix(w, h);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined && c !== null) P.px(i, j, c); } });
  return P.flush();
}
// vänster halva → hel, spegelvänd (vingar)
const mirrorRows = (rows) => rows.map((r) => r + [...r].reverse().join(''));

// ---- väskor (sedda framifrån, hängande i en krok) ----
// o kontur, h ljus, b bas, l skugga, d mörk (väskans färg), s rem, m/M metall, w vitt,
// k svart, K grått, A/a detalj, C/c liggunderlag, S/z silver, f/F/Y låga, n nos, e öga
const BAG_ART = {
  backpack: [
    '....oooo....', '...o.dd.o...', '.oooooooooo.', 'ohhhhhhhhhbo', 'ohbbbbbbbblo', 'ohbbbbmbbblo', 'ohbbbbbbbblo',
    'ohbddddddblo', 'ohdlllllldlo', 'ohdllmllldlo', 'ohdlllllldlo', 'ohbddddddblo', 'olllllllllll', '.oooooooooo.'],
  shoulder: [
    '...ssssss...', '..s......s..', '.s........s.', '.s........s.', 'oooooooooooo', 'ohhhhhhhhhbo', 'ohbbbbbbbblo',
    'odddddmddddo', 'ohbbbbbbbblo', 'ohbbbbbbbblo', 'ollllllllllo', '.oooooooooo.'],
  schoolBag: [
    '...oooooo...', '..o.dddd.o..', '.oooooooooo.', 'ohhhhhhhhhbo', 'ohAAAAAAAAlo', 'ohAaaaaaaAlo', 'ohAaaamaaAlo',
    'ohbbbbbbbblo', 'ohbwwwwwwblo', 'ohbbbbbbbblo', 'ohbbbbbbbblo', 'olllllllllll', '.oooooooooo.'],
  hikingPack: [
    '..oooooooo..', '.oCCcCCcCCo.', '.oCcCCcCCco.', '..oooooooo..', '.ohhhhhhhho.', 'ohbbbbbbbblo', 'ohbbbbbbbblo',
    'ohbddddddblo', 'ohbdmbbmdblo', 'ohbbbbbbbblo', 'ohbbbbbbbblo', 'ohddddddddlo', 'ohdllllllldo', 'ohdllmlllldo',
    'olllllllllll', '.oooooooooo.'],
  teddyPack: [
    '.oo......oo.', 'obbo....obbo', 'obdoooooodbo', '.obbbbbbbbo.', 'obbbbbbbbbbo', 'obbeebbeebbo', 'obbbbbbbbbbo',
    'obbbnnnnbbbo', 'obbnnkknnbbo', 'obbbnnnnbbbo', '.obbbbbbbbo.', '..oooooooo..'],
  fannyPack: [
    '...oooooooo...', '..ohhhhhhhbo..', 'ssohbbbbbbloss', 'ssodddmddddoss', '..ohbbbbbblo..', '...ollllllo...', '....oooooo....'],
  sling: [
    '..........ss', '.........ss.', '........ss..', '.......ss...', '..oooooooo..', '.ohhhhhhhbo.', '.ohAAAAAAlo.',
    '.odddmddddo.', '.ohbbbbbblo.', '.olllllllo..', '..ooooooo...', '..ss........', '.ss.........'],
  messenger: [
    '..ssssssss..', '.s........s.', 's..........s', 's..........s', 'oooooooooooo', 'ohhhhhhhhhbo', 'ohbbbbbbbblo',
    'ohbbbbbbbblo', 'odddddddddlo', 'ohbbbmbbbblo', 'ohbbbbbbbblo', 'ohbbbbbbbblo', 'olllllllllll', '.oooooooooo.'],
  handbag: [
    '....oooo....', '...o....o...', '...o....o...', '..oooooooo..', '.ohhhhhhhho.', 'ohhbbbbbbblo', 'ohbbbmmbbblo',
    'ohbbbbbbbblo', 'ohbbbbbbbblo', '.olllllllll.', '..oooooooo..'],
  briefcase: [
    '....oooo....', '....o..o....', 'oooooooooooo', 'ohhhhhhhhhbo', 'ohbbbbbbbblo', 'ohbmbbbbmblo', 'oddddddddddo',
    'ohbbbbbbbblo', 'ohbbbbbbbblo', 'olllllllllll', '.oooooooooo.'],
  shoppingBag: [
    '...o....o...', '..o.o..o.o..', '..o..oo..o..', 'oooooooooooo', 'ohhhhhhhhhbo', 'ohbbbbbbbblo', 'ohbbbAAbbblo',
    'ohbbAbbAbblo', 'ohbbbAAbbblo', 'ohbbbbbbbblo', 'ohbbbbbbbblo', 'olllllllllll', '.oooooooooo.'],
  sportsBag: [
    '....oooooo....', '...o......o...', '.oooooooooooo.', 'ohhhhhhhhhhhbo', 'ohbbbbbbbbbblo', 'owwwwwwwwwwwlo',
    'ohbbbbbbbbbblo', 'ohdddmdddddddo', '.oooooooooooo.'],
  guitar: [
    '....ooo....', '...oMdMo...', '...odddo...', '...oMdMo...', '....odo....', '....odo....', '....oAo....',
    '....odo....', '....oAo....', '....odo....', '..oooAooo..', '.ohhhdbbbo.', '.ohbbbbbblo', '..obbbbbo..',
    '..obkkkbo..', '.ohbkkkbblo', 'ohbbbkbbbblo', 'ohbbbbbbbblo', 'ohbbMMMbbblo', '.ohbbbbbblo.', '..olllllo..', '...ooooo...'],
  skateboard: [
    '...ooo...', '..ohbbo..', '..ohbbo..', 'KKohbboKK', 'KKohbboKK', '..ohbbo..', '..ohAAo..', '..ohAao..',
    '..ohbbo..', '..ohAAo..', '..ohAao..', '..ohbbo..', 'KKohbboKK', 'KKohbboKK', '..ohbbo..', '..olllo..', '...ooo...'],
  wings: mirrorRows([
    '.oo.......', 'owwo......', 'owWwo.....', 'owWWwo....', '.owWWwo...', '.owWWWwoo.', '..owWWWwwo',
    '..owzWWWwo', '...owzWWwo', '...owWzwo.', '....owWwo.', '.....owo..', '......o...']),
  fairyWings: mirrorRows([
    '.ooo......', 'oLbbo.....', 'oLhhbo....', 'oLhhhbo...', '.oLhhhbo..', '..oLhhhboo', '...oLLLbLo',
    '....oobbLo', '....oLhhbo', '...oLhhbo.', '...oLhbo..', '....ooo...']),
  jetpack: [
    '.oooo..oooo.', 'ozSSSooSSSzo', 'ozSSSkkSSSzo', 'ozSSkrkkSSzo', 'ozSSSkkSSSzo', 'ozSSSooSSSzo', 'ozSSSooSSSzo',
    'ozSSSooSSSzo', '.oKKo..oKKo.', '..oo....oo..', '..fF....Ff..', '..FY....YF..', '...Y....Y...'],
};
// väskans färg (bagColor-förslaget i katalogen) → palett
function bagPal(id, color) {
  const R = ramp(hex(color, 0x3a7bd5));
  const base = { o: INK, h: R.hi, b: R.base, l: R.lo, d: R.dk, s: mix(R.dk, 0x1a1426, 0.25), m: 0xe8d890, M: 0xe8d890, w: 0xf4f1ea, k: 0x2a2830, K: 0x55525e,
    A: 0xf0c040, a: 0xd09820, C: 0x7f9cc4, c: 0x5a78a0, S: 0xd8dce6, z: 0x8a90a0, f: 0xffd23f, F: 0xff8a30, Y: 0xfff6a0, n: 0xf0dcc0, e: 0x1e1c24, W: 0xe6e2ea, L: R.dk, r: 0xd83a4a };
  if (id === 'wings') Object.assign(base, { w: 0xffffff, W: 0xe8e4ee, z: 0xc4c0d0 });
  if (id === 'shoppingBag') Object.assign(base, { A: 0xc65fa0 });
  if (id === 'skateboard') Object.assign(base, { A: 0xf0c040, a: 0xd83a4a });
  if (id === 'guitar') Object.assign(base, { A: 0xe8d890, M: 0x3e2618 });
  if (id === 'sling') Object.assign(base, { A: R.hi });
  return base;
}

// ---- smycken (liggande på sammet i disken) ----
// o kontur, c kort, C kortskugga, G/g/y guld, w vitt, s/S silver, k/K svart, r/R röd,
// p rosa, b/B blå, t/T turkos, v violett, q/Q pärla, f/F fjäder, x skärm, e/E grön, Y gul, n/N läder
const J = {
  o: 0x2a1f2e, c: 0xfbf6ee, C: 0xd8cfc0, G: 0xfff2a8, g: 0xe8b830, y: 0xa87818, w: 0xffffff, s: 0xd8dce6, S: 0x8a90a0,
  k: 0x1e1c24, K: 0x3a3844, r: 0xd83a4a, R: 0x9a2230, p: 0xf2a0b8, b: 0xa8e8ff, B: 0x3a7bd5, t: 0x2aa39a, T: 0x1a6a64,
  v: 0x8e5bd1, V: 0x5e3a98, q: 0xf4efe6, Q: 0xcfc8bc, f: 0x9ad0c0, F: 0x4a8a80, x: 0x5fd8ff, X: 0xe8fbff, e: 0x46a35a, E: 0x2f7a42,
  Y: 0xf0c030, n: 0x6b4a33, N: 0x3e2a1c, u: 0xf0e6ea, U: 0xd6c6ce,
};
// örhängen på ett litet kort (motivet ritas två gånger)
const EAR = {
  studGold: ['Gg', 'gy'], studDiamond: ['wb', 'bS'], hoops: ['.g.', 'g.y', 'g.y', '.y.'],
  pearlEar: ['.g.', '.g.', 'qwq', 'qqQ', '.Q.'], drops: ['.g.', '.g.', '.t.', 'ttT', 'tTT', '.T.'],
  starEar: ['.g.', '.G.', 'GgG', '.g.', 'g.y'], heartEar: ['.g.', 'r.r', 'rrR', '.R.'],
  featherEar: ['.g.', '.f.', 'ffF', 'fFF', 'fF.', '.F.'],
};
// piercingar: motiv mitt på en svart sammetsbit
const PIERCE = {
  punk: ['s.S.s', 's.S.s', '.s.s.'], noseRing: ['.s.', 's.S', '.S.'], noseStud: ['.w.', 'wbS', '.S.'],
  septum: ['s.s', 's.S', '.S.'], browPierce: ['s..', '.S.', '..s'], lipPierce: ['.s.', 's.S', '.b.'],
};
const JEWEL_ART = {
  watch: ['...sss....', 'kkswkwSkkk', 'kkswwkSkkk', '...SSS....'],
  goldWatch: ['...GGg....', 'gygwywyggy', 'yggwwyggyg', '...yyy....'],
  smartwatch: ['..kkkkk...', 'KKkxXxkKKK', 'KKkxxxkKKK', '..kkkkk...'],
  bracelet: ['.GGgg.', 'G....y', 'g....y', '.yyyy.'],
  beadBracelet: ['.rBe.', 'Y...r', 'p...B', '.eYp.'],
  friendship: ['rYeBrYe', 'YeBrYeB', 'rYeBrYe'],
  rings: ['.KKKKKKK.', 'KRRRRRRRK', 'KRGgRGgRK', 'KRyRRyRRK', 'KNNNNNNNK', '.KKKKKKK.'],
  goldSet: ['.KKKKKKKK.', 'KvvvvvvvvK', 'KvgvvvvgvK', 'KvGvgGvGvK', 'KvvgvvgvvK', 'KvvvgGvvvK', 'KNNNNNNNNK', '.KKKKKKKK.'],
};
// handskar (ett par): h/b/l/d handskens ramp, c/C mudd
const GLOVE = {
  gloves: { rows: ['.hbh.', '.bbbb', 'bbbbb', '.bbbl', '.bbl.', '.dd..'], c: 0x2e2c34, cuff: null },
  whiteGloves: { rows: ['.hbh.', '.bbbb', 'bbbbb', '.bbbl', '.bbl.', '.cc..'], c: 0xf0eee8, cuff: 0xd6d0c6 },
  mittens: { rows: ['.hb..', '.bbb.', 'bbbbb', '.bbbl', '.bbl.', '.cc..'], c: 0x3a7bd5, cuff: 0xf4f1ea },
  gardening: { rows: ['.hbh.', '.bbbb', 'bbbbb', '.bbbl', '.bbl.', '.cc..'], c: 0x46a35a, cuff: 0xf0c030 },
  boxing: { rows: ['.hbb.', 'hbbbl', 'hbbbl', 'hbbbl', '.bbl.', '.cc..'], c: 0xd83a4a, cuff: 0xf4f1ea },
};
function jewelImg(id) {
  const v = entryKey('jewel', id);
  if (EAR[v]) {
    const P = new Pix(9, 10);
    P.rect(0, 0, 9, 10, J.c); P.box(0, 0, 9, 10, J.o); P.hl(1, 8, 7, J.C); P.vl(7, 1, 7, J.C); P.px(4, 1, J.C);
    const m = EAR[v], mw = Math.max(...m.map((r) => r.length));
    for (const ox of mw >= 3 ? [1, 5] : [2, 5]) m.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = J[r[i]]; if (c !== undefined) P.px(ox + i, 2 + j, c); } });
    return P.flush();
  }
  if (PIERCE[v]) {
    const P = new Pix(9, 7);
    P.rect(0, 0, 9, 7, J.K); P.box(0, 0, 9, 7, J.o); P.hl(1, 1, 7, 0x4a4856);
    const m = PIERCE[v], mw = Math.max(...m.map((r) => r.length)), ox = Math.floor((9 - mw) / 2), oy = Math.floor((7 - m.length) / 2);
    m.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = J[r[i]]; if (c !== undefined) P.px(ox + i, oy + j, c); } });
    return P.flush();
  }
  if (GLOVE[v]) {
    const G = GLOVE[v], R = ramp(G.c), pal = { h: R.hi, b: R.base, l: R.lo, d: R.dk, c: G.cuff ?? R.dk };
    const L = G.rows, Rr = L.map((r) => [...r].reverse().join(''));
    return mapImg(L.map((r, j) => r + '.' + Rr[j]), pal);
  }
  if (JEWEL_ART[v]) return mapImg(JEWEL_ART[v], J);
  return mapImg(['.w.', 'wbb', '.bS'], J); // okänt smycke: en liten sten
}
// katalogplaggets registervärde i platsen (t.ex. 'studGold' för jewel-studgold)
function entryKey(slot, id) {
  const it = itemById(id);
  const f = { hat: 'hat', glasses: 'glasses', bag: 'bag', neck: 'neck', jewel: 'jewel', hairAcc: 'hairAcc', phones: 'phones' }[slot];
  const v = it?.look?.[f];
  return v === true ? 'over' : v;
}
function bagImg(it) {
  const v = entryKey('bag', it.id), rows = BAG_ART[v] || BAG_ART.backpack;
  return mapImg(rows, bagPal(v, it.colors?.bagColor || (v === 'jetpack' ? '#9aa0aa' : v === 'wings' ? '#f4f1ea' : '#3a7bd5')));
}

// ======================= skyltdockor och formar =======================
// Byster (hattar, hörlurar), huvudformar (glasögon), perukhuvuden (hårsmycken) och
// halsformar ritas med figurmotorn – samma pixlar som när man bär saken själv.
const FORM = { skin: '#ebe3e8', style: 'bald', hair: '#ecd489', top: 'tee', shirt: '#dcd3cc', accent: '#dcd3cc', bottom: 'jeans', pants: '#cfc6c0', shoes: '#cfc6c0', build: 5, beard: false, glasses: false, hat: null, bag: null, phones: false };
const HAIRS = ['#1d1714', '#6b4226', '#d9a95c', '#3b2619', '#ecd489', '#b7392b', '#a5692f', '#e6e2da'];
const WIGS = ['long', 'bob', 'bun', 'wavy', 'ponytail', 'pigtails', 'long', 'bob'];
const rgbOf = (h) => { const n = typeof h === 'number' ? h : parseInt(String(h || '').replace('#', '').slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// "redmean"-avstånd (0 … ~765): grovt hur olika två färger ser ut
function cdist(a, b) {
  const [r1, g1, b1] = rgbOf(a), [r2, g2, b2] = rgbOf(b), rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
const lum = (c) => { const [r, g, b] = rgbOf(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const hairFor = (color, i) => { for (let k = 0; k < HAIRS.length; k++) { const h = HAIRS[(i + k) % HAIRS.length]; if (!color || cdist(h, color) >= 170) return h; } return HAIRS[i % HAIRS.length]; };

// figuren beskuren: (rx0, ry0) = utsnittets övre vänstra hörn relativt fötterna
function crop(look, rx0, ry0, w, h, pad = 0) {
  const c = mkCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.save(); x.beginPath(); x.rect(pad, pad, w, h); x.clip();
  drawPerson(x, pad - rx0, pad - ry0, look, 'down', 0);
  x.restore();
  return c;
}
// motorns kontur runt det som är ritat (för utsnitt som skurits genom figuren)
function outlined(c) {
  const x = c.getContext('2d'), w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data, src = new Uint8ClampedArray(d), R = w * 4;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const k = (y * w + i) * 4;
    if (src[k + 3]) continue;
    let b = -1;
    if (y > 0 && src[k - R + 3]) b = k - R; else if (i > 0 && src[k - 1]) b = k - 4; else if (i < w - 1 && src[k + 7]) b = k + 4; else if (y < h - 1 && src[k + R + 3]) b = k + R;
    if (b < 0) continue;
    d[k] = src[b] * 0.28 + 14; d[k + 1] = src[b + 1] * 0.24 + 10; d[k + 2] = src[b + 2] * 0.3 + 20; d[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return c;
}
// ogenomskinliga kolumner i en bild → { x0, x1 }
function spanOf(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, x1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  return x1 < 0 ? { x0: 0, x1: c.width - 1 } : { x0, x1 };
}
// stativ under en form: ett stag och en fot (mässing på valnöt)
function stand(x, cx, y, pole, foot) {
  x.fillStyle = css(GOLD.lo); x.fillRect(cx - 1, y, 2, pole);
  x.fillStyle = css(GOLD.hi); x.fillRect(cx - 1, y, 1, pole);
  x.fillStyle = css(WALNUT.lo); x.fillRect(cx - (foot >> 1), y + pole, foot, 2);
  x.fillStyle = css(WALNUT.hi); x.fillRect(cx - (foot >> 1), y + pole, foot, 1);
}
// bara plaggets pixlar (skillnaden mot en naken docka), med kontur och beskuren –
// t.ex. hattarna som hänger på hattstången
function isolated(it, dir = 'down') {
  const a = crop(FORM, -14, -42, 28, 44), b = crop(lookForItem(it, FORM, { colors: true }), -14, -42, 28, 44);
  const ad = a.getContext('2d').getImageData(0, 0, 28, 44).data, bx = b.getContext('2d'), bi = bx.getImageData(0, 0, 28, 44), bd = bi.data;
  for (let k = 0; k < bd.length; k += 4) if (ad[k] === bd[k] && ad[k + 1] === bd[k + 1] && ad[k + 2] === bd[k + 2] && ad[k + 3] === bd[k + 3]) bd[k + 3] = 0;
  bx.putImageData(bi, 0, 0);
  outlined(b);
  const d = bx.getImageData(0, 0, 28, 44).data;
  let x0 = 28, y0 = 44, x1 = -1, y1 = -1;
  for (let y = 0; y < 44; y++) for (let x = 0; x < 28; x++) if (d[(y * 28 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return mkCanvas(1, 1);
  const c = mkCanvas(x1 - x0 + 1, y1 - y0 + 1);
  c.getContext('2d').drawImage(b, -x0, -y0);
  return c;
}
// byst (huvud + axlar), 24×26, foten mitt nertill
function bustImg(look) {
  const c = mkCanvas(24, 26), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(crop(look, -12, -39, 24, 21), 0, 0);
  x.fillStyle = '#4a4250'; x.fillRect(6, 20, 13, 1);            // snittet vid axlarna
  stand(x, 12, 21, 3, 11);
  return c;
}
// huvudform (glasögon), 18×16
function headImg(look) {
  const c = mkCanvas(18, 16), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(crop(look, -9, -34, 18, 13), 0, 0);
  stand(x, 9, 13, 1, 8);
  return c;
}
// perukhuvud (hårsmycken), 18×20
function wigImg(look) {
  const c = mkCanvas(18, 20), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(crop(look, -9, -37, 18, 16), 0, 0);
  stand(x, 9, 16, 2, 8);
  return c;
}
// halsform (byst utan huvud och armar), 12×16. Dockan formas med en mask (smal hals,
// sluttande axlar, lite midja) – plaggets egna pixlar (skillnaden mot en naken docka)
// behålls alltid, även där de sticker ut.
const NECK_MASK = [2, 2, 3, 4, 5, 5, 5, 5, 5, 4, 4, 4]; // halv bredd per rad från hakan
function neckImg(look, bare) {
  const a = crop(bare, -5, -22, 10, 12, 1), b = crop(look, -5, -22, 10, 12, 1);
  const ad = a.getContext('2d').getImageData(0, 0, 12, 14).data, bx = b.getContext('2d'), bi = bx.getImageData(0, 0, 12, 14), bd = bi.data;
  for (let y = 0; y < 14; y++) for (let x = 0; x < 12; x++) {
    const k = (y * 12 + x) * 4;
    if (!bd[k + 3]) continue;
    const item = ad[k] !== bd[k] || ad[k + 1] !== bd[k + 1] || ad[k + 2] !== bd[k + 2] || ad[k + 3] !== bd[k + 3];
    const hw = NECK_MASK[y - 1] ?? 0, inside = x - 1 >= 5 - hw && x - 1 < 5 + hw;
    if (!item && !inside) bd[k + 3] = 0;
  }
  bx.putImageData(bi, 0, 0);
  const c = mkCanvas(12, 16), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(outlined(b), 0, 0);
  stand(x, 6, 14, 0, 8);
  return c;
}

// halsformens ton: mörk sammet under ljusa saker, linne under mörka
const NECK_TONE = { pearls: 'dark', chain: 'dark', dogTag: 'dark', lei: 'dark', ruff: 'dark', camera: 'light', bolo: 'light' };
function neckForm(it) {
  const v = it.look.neck, c = it.colors?.neckColor;
  const dark = NECK_TONE[v] ? NECK_TONE[v] === 'dark' : c ? lum(c) > 0.42 : true;
  const tone = dark ? '#4a2a48' : '#efe6da', bare = { ...FORM, skin: tone, shirt: tone, accent: tone, top: 'tee' };
  return neckImg(lookForItem(it, bare, { colors: true }), bare);
}
function bustLook(it, i) {
  const col = it.colors?.cap || it.colors?.phoneColor || '#c9323a';
  const style = it.dept === 'kille' ? ['short', 'buzz', 'side'][i % 3] : it.dept === 'tjej' ? WIGS[i % WIGS.length] : ['short', 'bob', 'side', 'long'][i % 4];
  return lookForItem(it, { ...FORM, style, hair: hairFor(col, i), build: it.dept === 'tjej' ? 4 : 5 }, { colors: true });
}
function wigLook(it, i) {
  const acc = ['#ff5dc8', '#3fc4ff', '#f0b429', '#8e5bd1', '#46a35a', '#d9433b'][i % 6];
  const hair = hairFor(acc, i + 2);
  return lookForItem(it, { ...FORM, style: WIGS[i % WIGS.length], hair, accent: acc, build: 4 }, { colors: true });
}
const headLook = (it) => lookForItem(it, { ...FORM, skin: '#e2dad4' }, { colors: true });

// ======================= prislappar =======================
const tagStr = (g, it, short = false) => (owns(g, it) ? $t('DIN') : short ? String(priceOf(g, it)) : $t`${String(priceOf(g, it))}:-`);
const tagW = (s) => textW(SMALL, s) + 4;

// ======================= utställningen (var varje vara står) =======================
// Varje post: { it, sec, kind, img, ax, ay (bildens ankare), x, y (ankaret i världen),
// r (klickruta), go (där figuren ställer sig), face, tag: { x, y, style } | null }
function buildDisplays() {
  const out = [];
  const add = (it, kind, img, ax, ay, x, y, r, go, tag, face = 'up') => out.push({ it, sec: secOf(it.slot).id, kind, img, ax, ay, x: Math.round(x), y, r, go, tag, face });

  // ---- hattväggen: tre rader, bredden efter hatten ----
  const hats = itemsForSlot('hat').map((it, i) => {
    const img = bustImg(bustLook(it, i)), s = spanOf(img);
    return { it, img, sw: s.x1 - s.x0 + 1, cx: (s.x0 + s.x1 + 1) / 2, need: Math.max(s.x1 - s.x0 + 3, tagW(String(it.price)) + 1, 14) };
  });
  const rowsOf = (list, n) => {
    const tot = list.reduce((a, b) => a + b.need, 0), rows = Array.from({ length: n }, () => []);
    let r = 0, acc = 0;
    for (const e of list) { if (r < n - 1 && acc + e.need / 2 > tot / n * (r + 1)) r++; rows[r].push(e); acc += e.need; }
    return rows;
  };
  const place = (row, x0, x1) => {
    const used = row.reduce((a, b) => a + b.need, 0), gap = Math.max(0, (x1 - x0 - used) / (row.length + 1)), k = used > x1 - x0 ? (x1 - x0) / used : 1;
    let x = x0 + gap;
    return row.map((e) => { const cx = x + e.need * k / 2; x += e.need * k + gap; return cx; });
  };
  rowsOf(hats, HAT.bases.length).forEach((row, ri) => {
    const base = HAT.bases[ri], xs = place(row, HAT.x0 + 5, HAT.x1 - 5);
    row.forEach((e, i) => {
      const x = xs[i], ax = Math.round(e.cx);
      add(e.it, 'bust', e.img, ax, 26, x, base, [x - e.sw / 2 - 1, base - 27, x + e.sw / 2 + 1, base + 7], [x, UNIT_Y + 6], { x, y: base + 2, style: 'rail' });
    });
  });

  // ---- glasögonskåpet: 4 hyllor ----
  const grid = (list, bases, x0, x1, mk) => {
    const cols = Math.max(1, Math.ceil(list.length / bases.length)), pitch = (x1 - x0) / cols;
    list.forEach((it, i) => { const r = Math.floor(i / cols), c = i % cols, n = Math.min(cols, list.length - r * cols); mk(it, i, x0 + pitch * (c + 0.5 + (cols - n) / 2), bases[r]); });
  };
  grid(itemsForSlot('glasses'), OPT.bases, OPT.x0 + 6, OPT.x1 - 6, (it, i, x, base) => {
    add(it, 'head', headImg(headLook(it)), 9, 16, x, base, [x - 8, base - 17, x + 8, base + 6], [x, UNIT_Y + 6], { x, y: base, style: 'glass' });
  });
  // ---- halsvitrinen: 4 hyllor ----
  grid(itemsForSlot('neck'), NECK.bases, NECK.x0 + 7, NECK.x1 - 7, (it, i, x, base) => {
    add(it, 'neck', neckForm(it), 6, 16, x, base, [x - 7, base - 17, x + 7, base + 6], [x, UNIT_Y + 6], { x, y: base, style: 'glass' });
  });
  // ---- hörlurarna: byster på ljudväggen ----
  grid(itemsForSlot('phones'), SND.bases, SND.x0 + 6, SND.x1 - 6, (it, i, x, base) => {
    const img = bustImg(bustLook(it, i + 3)), s = spanOf(img);
    add(it, 'bust', img, Math.round((s.x0 + s.x1 + 1) / 2), 26, x, base, [x - 11, base - 27, x + 11, base + 7], [x, UNIT_Y + 6], { x, y: base + 2, style: 'neon' });
  });

  // ---- väskväggen: tre rader krokar, höga saker i nedersta raden ----
  const bags = itemsForSlot('bag').map((it) => { const img = bagImg(it); return { it, img, need: Math.max(img.width + 5, tagW(String(it.price)) + 2), tall: img.height > 17 }; });
  const bagRows = [[], [], []];
  const short = bags.filter((b) => !b.tall), tall = bags.filter((b) => b.tall);
  const per = Math.ceil(bags.length / 3);
  short.forEach((b) => { const r = bagRows[0].length < per ? 0 : bagRows[1].length < per ? 1 : 2; bagRows[r].push(b); });
  bagRows[2].push(...tall);
  bagRows.forEach((row, ri) => {
    const hy = BAGW.hooks[ri] + (ri === 2 && row.some((b) => b.tall) ? -4 : 0), xs = place(row, BAGW.x0 + 6, BAGW.x1 - 6);
    const ty = hy + 3 + Math.max(...row.map((b) => b.img.height));   // radens lappar på samma höjd
    row.forEach((b, i) => {
      const x = xs[i], w = b.img.width, h = b.img.height, top = hy + 2;
      add(b.it, 'bag', b.img, w >> 1, 0, x, top, [x - (w >> 1) - 1, hy - 1, x + (w >> 1) + 1, ty + 7], [x, UNIT_Y + 6], { x, y: ty, from: top + h, style: 'hang' });
      out[out.length - 1].hook = hy;
    });
  });

  // ---- smyckesdisken: tre rader sammetsbrickor ----
  const ORDER = ['studGold', 'studDiamond', 'hoops', 'pearlEar', 'drops', 'starEar', 'heartEar', 'featherEar', 'goldSet',
    'punk', 'noseRing', 'noseStud', 'septum', 'browPierce', 'lipPierce', 'bracelet', 'beadBracelet', 'friendship',
    'watch', 'goldWatch', 'smartwatch', 'rings', 'gloves', 'whiteGloves', 'mittens', 'gardening', 'boxing'];
  const jew = itemsForSlot('jewel').slice().sort((a, b) => { const ia = ORDER.indexOf(a.look.jewel), ib = ORDER.indexOf(b.look.jewel); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const jcols = Math.max(9, Math.ceil(jew.length / 3)), jx0 = JEW.x0 + 20, jpitch = (JEW.x1 - 8 - jx0) / jcols;
  jew.forEach((it, i) => {
    const r = Math.floor(i / jcols), c = i % jcols, img = jewelImg(it.id);
    const x = jx0 + jpitch * (c + 0.5), bot = JEW.top + 11 + r * 10;
    add(it, 'jewel', img, img.width >> 1, img.height, x, bot, [x - jpitch / 2, bot - 10, x + jpitch / 2, bot], [x, JEW.top - 4], null, 'down');
  });

  // ---- hårsmyckesbordet: två steg ----
  const hairs = itemsForSlot('hairAcc'), nBack = Math.floor(hairs.length / 2);
  [[hairs.slice(0, nBack), HAIRT.back], [hairs.slice(nBack), HAIRT.front]].forEach(([list, base], ri) => {
    const pitch = Math.min(15, (HAIRT.x1 - HAIRT.x0 - 12) / Math.max(1, list.length)), x0 = (HAIRT.x0 + HAIRT.x1) / 2 - pitch * list.length / 2;
    list.forEach((it, i) => {
      const x = x0 + pitch * (i + 0.5);
      add(it, 'wig', wigImg(wigLook(it, i + ri * 7)), 9, 20, x, base, [x - 7, base - 20, x + 7, base + 1], [x, HAIRT.back - 26], null, 'down');
    });
  });
  return out;
}

// ======================= butiken: väggar, golv, inredning =======================
function paintRoom(night = false) {
  const P = new Pix(W, H);
  // ---- tak: mörk list med mässingsskena och spottar ----
  for (let y = 0; y < CEIL; y++) for (let x = 0; x < W; x++) P.px(x, y, jit(y < 5 ? 0x2a1a2a : 0x22141f, x, y, 1, 0.05));
  P.hl(0, 5, W, GOLD.lo); P.hl(0, 6, W, GOLD.dk); P.hl(0, 7, W, 0x160c14);
  // ---- väggen: varm puts med damastmönster, plommonfärgad bröstpanel ----
  const WAIN = 82;
  for (let y = CEIL; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y < WAIN) {
      const mx = x % 16, my = (y - CEIL) % 16, d = Math.abs(mx - 8) + Math.abs(my - 8);
      c = CREAM.base;
      if (d === 5 || (d === 0) || (d === 2 && (mx === 8 || my === 8))) c = mix(CREAM.base, CREAM.lo, 0.7);
      if (y < CEIL + 6) c = mix(c, 0x8a6a70, (CEIL + 6 - y) * 0.06);        // skugga under taklisten
      c = jit(c, x, y, 2, 0.05);
    } else if (y < WAIN + 3) c = y === WAIN ? GOLD.hi : y === WAIN + 1 ? GOLD.base : GOLD.lo;
    else if (y >= WALL_Y - 4) c = y === WALL_Y - 4 ? PLUM.hi : PLUM.dk;
    else {
      const px = (x % 40), py = y - WAIN - 3;
      c = PLUM.base;
      if (px === 3 || px === 36) c = px === 3 ? PLUM.hi : PLUM.dk;
      else if ((py === 3 || py === 14) && px > 3 && px < 36) c = py === 3 ? PLUM.dk : PLUM.hi;
      else if (px > 3 && px < 36 && py > 3 && py < 14) c = mix(PLUM.base, PLUM.lo, 0.35);
      c = jit(c, x, y, 5, 0.05);
    }
    P.px(x, y, c);
  }
  // ---- golvet: fiskbensparkett i honungsek ----
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const col = Math.floor(x / 8), lx = x - col * 8, v = y - WALL_Y + (col & 1 ? lx : 7 - lx), pl = Math.floor(v / 4), pv = v - pl * 4;
    let c = mul(OAK.base, 0.9 + hash(col, pl, 7) * 0.16);
    if (pv === 0) c = mul(c, 0.8); else if (pv === 1) c = mix(c, WHITE, 0.08);
    if (lx === 0) c = mul(c, 0.84);
    c = mix(c, 0x3a2418, Math.max(0, 0.22 - (y - WALL_Y) * 0.012));   // mörkare in mot väggen
    P.px(x, y, jit(c, x, y, 3, 0.04));
  }
  // golvlist
  P.hl(0, WALL_Y, W, PLUM.dk); P.hl(0, WALL_Y + 1, W, 0x3a1c34);
  // rund matta mitt i butiken (under puffen)
  rug(P, POUF.x, POUF.y + 2, 74, 24);
  // mattor framför spegeln och vid entrén
  runner(P, 250, 124, 58, 12);
  // ---- inredningen längs bakväggen ----
  paintHatWall(P);
  paintMirror(P);
  paintCabinet(P, OPT, LACQ, 0xeaf2f0, 0xd6e4e2, 0xffffff);
  paintEntrance(P, night);
  paintKassaWall(P);
  paintSoundWall(P);
  paintBagWall(P);
  paintCabinet(P, NECK, WALNUT, 0xf4e8e0, 0xdcc6c2, 0xfff0d8);
  // takspottarnas ljuskäglor över väggmöblerna
  for (const x of SPOTS) {
    P.rect(x - 2, 7, 5, 3, 0x1d1219); P.hl(x - 1, 9, 3, 0xfff6c8);
    P.ell(x, 30, 20, 34, 0xfff2d8, night ? 0.1 : 0.14, 5);
  }
  // hängande skyltar (klickbara → hela sortimentet)
  for (const s of HANG_SIGNS) hangSign(P, s.x, s.label);
  // skugga längs väggen på golvet
  for (let i = 0; i < 6; i++) P.darken(0, UNIT_Y + i, W, 1, 0.78 + i * 0.04);
  // ljuspölar på golvet
  for (const x of [134, 354, 472, 622, 745, 898]) P.ell(x, UNIT_Y + 12, 50, 9, 0xfff4dc, 0.16, 4);
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
const HANG_SIGNS = [
  { id: 'hattar', x: 134, label: $t('HATTAR') }, { id: 'glasogon', x: 354, label: $t('GLASÖGON') },
  { id: 'vaskor', x: 745, label: $t('VÄSKOR') }, { id: 'hals', x: 898, label: $t('HALSDUKAR + HALSBAND') },
];
const signW = (label) => textW(SMALL, label) + 12;
function hangSign(P, cx, label) {
  const w = signW(label), x0 = Math.round(cx - w / 2), y0 = 3, h = 9;
  P.vl(x0 + 3, 0, y0, GOLD.lo); P.vl(x0 + w - 4, 0, y0, GOLD.lo);
  P.rect(x0, y0, w, h, PLUM.dk); P.box(x0, y0, w, h, GOLD.base); P.hl(x0 + 1, y0 + 1, w - 2, PLUM.lo);
  P.px(x0 + 3, y0 + 4, GOLD.hi); P.px(x0 + w - 4, y0 + 4, GOLD.hi);
  text(P, SMALL, label, x0 + 6, y0 + 2, GOLD.hi);
}
function rug(P, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t > 1) continue;
    let c = t > 0.9 ? GOLD.lo : t > 0.84 ? PLUM.dk : t > 0.8 ? GOLD.base : mix(TEAL.lo, TEAL.base, 0.5);
    if (t < 0.8 && ((x + y * 2) % 10 === 0 || (x - y * 2 + 1000) % 10 === 0)) c = mix(c, TEAL.hi, 0.4);
    if (t < 0.36 && t > 0.3) c = GOLD.lo;
    P.px(x, y, jit(c, x, y, 11, 0.06));
  }
}
function runner(P, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const e = Math.min(x - x0, x0 + w - 1 - x, y - y0, y0 + h - 1 - y);
    let c = e < 1 ? PLUM.dk : e < 2 ? GOLD.lo : PLUM.base;
    if (e >= 2 && (x + y) % 6 === 0) c = PLUM.hi;
    P.px(x, y, jit(c, x, y, 13, 0.06));
  }
}

// ---- hattväggen: valnötspanel, tre hyllor med prisskena ----
function paintHatWall(P) {
  const { x0, x1, bases } = HAT, top = 16, bot = UNIT_Y, w = x1 - x0;
  for (let y = top; y < bot; y++) for (let x = x0 + 3; x < x1 - 3; x++) {
    const bx = (x - x0 - 3) % 9;
    let c = bx === 0 ? WALNUT.dk : bx === 1 ? WALNUT.lo : mix(WALNUT.lo, WALNUT.base, 0.55 + hash((x - x0) / 9 | 0, 1, 4) * 0.3);
    // varmt ljus under varje hylla (LED-list), mörkare längre ner
    const above = [top - 6, ...bases].filter((b) => b + 8 <= y).pop() ?? top;
    c = mix(c, 0xffe0a8, Math.max(0, 0.34 - (y - above - 8) * 0.03));
    P.px(x, y, jit(c, x, y, 21, 0.05));
  }
  // krön och stolpar
  P.rect(x0 - 2, top - 4, w + 4, 5, WALNUT.base); P.hl(x0 - 2, top - 4, w + 4, WALNUT.hi); P.hl(x0 - 2, top, w + 4, WALNUT.dk);
  P.hl(x0 - 2, top - 2, w + 4, GOLD.lo);
  for (const sx of [x0, x1 - 3]) { P.rect(sx, top, 3, bot - top, WALNUT.base); P.vl(sx, top, bot - top, WALNUT.hi); P.vl(sx + 2, top, bot - top, WALNUT.dk); }
  for (const b of bases) shelf(P, x0 + 3, x1 - 3, b);
  // sockel
  P.rect(x0 - 1, bot - 4, w + 2, 4, WALNUT.dk); P.hl(x0 - 1, bot - 4, w + 2, WALNUT.lo);
}
// hyllplan med prisskena (lapparna ritas ovanpå, levande)
function shelf(P, x0, x1, b) {
  const w = x1 - x0;
  P.hl(x0, b, w, OAK.hi); P.hl(x0, b + 1, w, OAK.base);
  P.rect(x0, b + 2, w, 6, 0x2a1a14); P.hl(x0, b + 2, w, GOLD.lo); P.hl(x0, b + 7, w, 0x160e0a);
  P.darken(x0, b + 8, w, 2, 0.72);
}

// ---- spegeln: guldram, glaset ritas med spegelbilden ovanpå ----
function paintMirror(P) {
  const { x0, x1, top, y } = MIR, w = x1 - x0, h = y - top;
  P.rect(x0, top, w, h, GOLD.base);
  P.box(x0, top, w, h, GOLD.dk); P.box(x0 + 1, top + 1, w - 2, h - 2, GOLD.hi);
  P.vl(x0 + 2, top + 2, h - 4, GOLD.lo); P.vl(x1 - 3, top + 2, h - 4, GOLD.lo);
  // krön med ornament
  P.rect(x0 - 2, top - 3, w + 4, 4, GOLD.base); P.hl(x0 - 2, top - 3, w + 4, GOLD.hi); P.hl(x0 - 2, top, w + 4, GOLD.dk);
  P.rect(((x0 + x1) >> 1) - 3, top - 6, 6, 3, GOLD.base); P.hl(((x0 + x1) >> 1) - 2, top - 6, 4, GOLD.hi);
  // glaset
  const g = mirrorGlass();
  for (let yy = g.y0; yy < g.y1; yy++) for (let xx = g.x0; xx < g.x1; xx++) P.px(xx, yy, glassAt(xx, yy));
  // fötter
  P.rect(x0 + 2, y, 3, 2, GOLD.dk); P.rect(x1 - 5, y, 3, 2, GOLD.dk);
}
const mirrorGlass = () => ({ x0: MIR.x0 + 3, y0: MIR.top + 3, x1: MIR.x1 - 3, y1: MIR.y - 3 });
// spegelglasets bakgrund: butiken bakom en själv, mjukt och kallt tonad
function glassAt(x, y) {
  const g = mirrorGlass(), t = (y - g.y0) / (g.y1 - g.y0);
  let c = t < 0.72 ? mix(0xdfe4e6, 0xc8d2d8, t / 0.72) : mix(0xb89c86, 0x9a7e6a, (t - 0.72) / 0.28); // vägg / golv
  if (Math.abs(t - 0.72) < 0.012) c = 0x6a4a5a;
  return jit(c, x, y, 17, 0.04);
}

// ---- skåp med glasdörrar (optikern och halsvitrinen) ----
function paintCabinet(P, U, F, back0, back1, led) {
  const { x0, x1, bases } = U, top = 14, bot = UNIT_Y, w = x1 - x0;
  P.rect(x0, top, w, bot - top, F.base);
  P.hl(x0, top, w, F.hi); P.vl(x0, top, bot - top, F.hi); P.vl(x1 - 1, top, bot - top, F.dk);
  // krön med guldlist
  P.rect(x0 - 2, top - 3, w + 4, 4, F.base); P.hl(x0 - 2, top - 3, w + 4, F.hi); P.hl(x0 - 2, top, w + 4, F.lo); P.hl(x0 - 2, top - 1, w + 4, GOLD.lo);
  // bakpanelen, upplyst
  const ix0 = x0 + 4, ix1 = x1 - 4, iy0 = top + 5, iy1 = bot - 9;
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) {
    const e = Math.min(x - ix0, ix1 - 1 - x);
    let c = mix(back0, back1, (y - iy0) / (iy1 - iy0));
    if (e < 2) c = mix(c, led, 0.55 - e * 0.2);
    P.px(x, y, jit(c, x, y, 23, 0.04));
  }
  P.box(ix0 - 1, iy0 - 1, ix1 - ix0 + 2, iy1 - iy0 + 2, F.dk);
  // glashyllor
  for (const b of bases) {
    P.hl(ix0, b, ix1 - ix0, 0xd8eef4); P.hl(ix0, b + 1, ix1 - ix0, 0x9cc4d0);
    P.darken(ix0, b + 2, ix1 - ix0, 1, 0.85);
  }
  // låda med handtag nertill
  P.rect(x0 + 2, bot - 8, w - 4, 7, F.lo); P.hl(x0 + 2, bot - 8, w - 4, F.hi); P.hl(x0 + 2, bot - 2, w - 4, F.dk);
  P.rect(((x0 + x1) >> 1) - 6, bot - 5, 12, 2, GOLD.base); P.hl(((x0 + x1) >> 1) - 6, bot - 5, 12, GOLD.hi);
}
// glasdörrarnas blänk (ritas ovanpå varorna)
function paintCabinetGlass(P, U) {
  const { x0, x1 } = U, top = 14, bot = UNIT_Y, ix0 = x0 + 4, ix1 = x1 - 4, iy0 = top + 5, iy1 = bot - 9, mid = (x0 + x1) >> 1;
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) {
    const d = (x - ix0) + (y - iy0) * 0.5;
    if (d % 46 < 3 || (d % 46 > 7 && d % 46 < 8)) P.px(x, y, WHITE, 0.16);
  }
  P.vl(mid, iy0, iy1 - iy0, U === OPT ? LACQ.lo : WALNUT.lo); // dörrarnas möte
  P.px(mid - 2, (iy0 + iy1) >> 1, GOLD.hi); P.px(mid + 1, (iy0 + iy1) >> 1, GOLD.hi);
}

// ---- entrén: dörren, skylten och dörrmattan ----
function paintEntrance(P, night) {
  const { x0, x1, top } = DOOR, cx = (x0 + x1) >> 1;
  // stor skylt ACCESSOARER
  const lbl = $t('ACCESSOARER'), tw = textW(BIG, lbl), sub = $t('HATTAR  VÄSKOR  SMYCKEN'), subw = textW(SMALL, sub);
  const sw = Math.max(tw, subw) + 20, sx = Math.round(cx - sw / 2), sy = 11;
  P.ell(cx, sy + 11, sw * 0.62, 17, 0xffd890, 0.22, 5);
  P.rect(sx, sy, sw, 24, PLUM.dk); P.box(sx, sy, sw, 24, GOLD.dk); P.box(sx + 1, sy + 1, sw - 2, 22, GOLD.base);
  P.hl(sx + 2, sy + 2, sw - 4, PLUM.lo);
  const tx = Math.round(cx - tw / 2);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, BIG, lbl, tx + dx, sy + 4 + dy, GOLD.lo, 0.45);
  text(P, BIG, lbl, tx, sy + 4, GOLD.hi);
  P.hl(sx + 6, sy + 13, sw - 12, GOLD.lo, 0.6);
  text(P, SMALL, sub, Math.round(cx - subw / 2), sy + 16, 0xf2d8e8);
  for (const d of [-1, 1]) { const px = Math.round(cx + d * (sw / 2 + 5)); P.px(px, sy + 12, GOLD.hi); P.px(px, sy + 11, GOLD.base); P.px(px, sy + 13, GOLD.base); P.px(px - 1, sy + 12, GOLD.base); P.px(px + 1, sy + 12, GOLD.base); }
  // dörrkarm
  P.rect(x0 - 3, top - 3, x1 - x0 + 6, WALL_Y - top + 3, GOLD.lo); P.rect(x0 - 2, top - 2, x1 - x0 + 4, WALL_Y - top + 2, 0x2a1a24);
  // två glasdörrar mot gatan
  for (let i = 0; i < 2; i++) {
    const gx = x0 + 1 + i * 16;
    for (let y = top; y < WALL_Y - 1; y++) for (let x = gx; x < gx + 14; x++) {
      const t = (y - top) / (WALL_Y - top);
      let c = night ? mix(0x1c2240, 0x2a2438, t) : mix(0xb8dcec, 0x7faac0, t);
      if (!night && y > WALL_Y - 22) c = mix(0x8a8e96, 0x6a6e76, (y - WALL_Y + 22) / 22);   // trottoaren
      if (night && (x + y * 3) % 23 === 0 && y < top + 30) c = 0xfff0a0;                     // gatlyktor långt bort
      if ((x - y + 400) % 17 < 2) c = mix(c, WHITE, night ? 0.08 : 0.3);
      P.px(x, y, c);
    }
    P.rect(gx + (i ? 1 : 10), top + 26, 3, 12, GOLD.base); P.vl(gx + (i ? 1 : 10), top + 26, 12, GOLD.hi);
  }
  P.rect(cx - 1, top, 2, WALL_Y - top, 0x2a1a24);
  P.rect(cx - 9, top + 4, 18, 9, 0x1d2b1f); P.box(cx - 9, top + 4, 18, 9, 0x0e160f); text(P, SMALL, $t('UT'), cx - 3, top + 6, 0x6fe08a);
  // dörrmatta
  P.rect(x0 - 5, WALL_Y + 1, x1 - x0 + 10, 9, 0x3a2e38); P.box(x0 - 5, WALL_Y + 1, x1 - x0 + 10, 9, 0x5a4a56);
  for (let x = x0 - 3; x < x1 + 3; x += 2) P.vl(x, WALL_Y + 3, 5, 0x2e2430);
  // en guldklistrad NYHET-cirkel på väggen till vänster
  const nx = 424, ny = 54;
  P.ell(nx, ny, 12, 12, 0xffe6a0, 0.25, 4);
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x, y); if (d <= 9) P.px(nx + x, ny + y, d > 8 ? GOLD.dk : d > 7 ? GOLD.hi : GOLD.base); }
  text(P, SMALL, $t('NYTT'), nx - 7, ny - 2, PLUM.dk);
  for (const [a, b] of [[0, -11], [0, 11], [-11, 0], [11, 0]]) P.px(nx + a, ny + b, GOLD.hi);
}

// ---- väggen bakom kassan: presentaskar, papper, KASSA-skylt ----
function paintKassaWall(P) {
  const x0 = 494, x1 = 576;
  const kw = textW(SMALL, $t('KASSA')) + 12, kx = Math.round((x0 + x1) / 2 - kw / 2);
  P.rect(kx, 34, kw, 11, PLUM.dk); P.box(kx, 34, kw, 11, GOLD.base); text(P, SMALL, $t('KASSA'), kx + 6, 37, GOLD.hi);
  for (const sy of [58, 76]) {
    P.rect(x0 + 4, sy, x1 - x0 - 8, 2, WALNUT.hi); P.hl(x0 + 4, sy + 2, x1 - x0 - 8, WALNUT.dk); P.darken(x0 + 4, sy + 3, x1 - x0 - 8, 1, 0.8);
    P.rect(x0 + 6, sy + 3, 2, 3, WALNUT.lo); P.rect(x1 - 8, sy + 3, 2, 3, WALNUT.lo);
  }
  // presentaskar med band
  const boxes = [[502, 58, 9, 7, 0xd8a0c0], [513, 58, 7, 5, 0x7fc8c0], [522, 58, 10, 8, 0xf0d890], [534, 58, 6, 4, 0xc06090], [554, 58, 8, 6, 0x8a70c8], [564, 58, 6, 9, 0xe8e0d0]];
  for (const [x, y, w, h, c] of boxes) {
    P.rect(x, y - h, w, h, c); P.hl(x, y - h, w, mix(c, WHITE, 0.35)); P.vl(x + w - 1, y - h, h, mul(c, 0.78));
    P.vl(x + (w >> 1), y - h, h, GOLD.base); P.hl(x, y - h + (h >> 1), w, GOLD.base); P.px(x + (w >> 1) - 1, y - h - 1, GOLD.hi); P.px(x + (w >> 1) + 1, y - h - 1, GOLD.hi);
  }
  // papersrullar och påsar på nedre hyllan
  for (let i = 0; i < 5; i++) { const c = [0xf2a0b8, 0x7fe0b0, 0xf0d048, 0xb9a3e8, 0x7fb8e8][i]; P.rect(504 + i * 5, 62, 4, 14, c); P.vl(504 + i * 5, 62, 14, mix(c, WHITE, 0.4)); P.hl(504 + i * 5, 62, 4, mul(c, 0.8)); }
  for (const [x, c] of [[536, PLUM.base], [550, 0xf4f1ea], [562, TEAL.base]]) {
    P.rect(x, 66, 10, 10, c); P.hl(x, 66, 10, mix(c, WHITE, 0.3)); P.vl(x + 9, 66, 10, mul(c, 0.75));
    P.px(x + 3, 64, GOLD.lo); P.px(x + 6, 64, GOLD.lo); P.px(x + 2, 65, GOLD.lo); P.px(x + 7, 65, GOLD.lo); P.hl(x + 3, 70, 4, c === 0xf4f1ea ? PLUM.base : GOLD.hi);
  }
}

// ---- ljudväggen: mörk panel, neonlister och hyllor ----
function paintSoundWall(P) {
  const { x0, x1, bases } = SND, top = 14, bot = UNIT_Y, w = x1 - x0;
  for (let y = top; y < bot; y++) for (let x = x0; x < x1; x++) {
    let c = (x + y) % 4 === 0 ? CHAR.lo : CHAR.base;                   // perforerad akustikpanel
    if ((x - x0) % 4 === 1 && (y - top) % 4 === 1) c = CHAR.dk;
    P.px(x, y, jit(c, x, y, 29, 0.04));
  }
  P.hl(x0, top, w, 0x3fe0d0); P.hl(x0, top + 1, w, 0x1f8a80);        // neonlister
  P.vl(x0, top, bot - top, 0xff5dc8); P.vl(x1 - 1, top, bot - top, 0xff5dc8);
  P.ell(x0, 60, 8, 50, 0xff5dc8, 0.14, 4); P.ell(x1, 60, 8, 50, 0xff5dc8, 0.14, 4);
  // neonskylten
  const lbl = $t('HÖRLURAR'), tw = textW(SMALL, lbl), tx = Math.round((x0 + x1) / 2 - tw / 2);
  P.ell((x0 + x1) >> 1, 24, 36, 8, 0x3fe0d0, 0.2, 4);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, SMALL, lbl, tx + dx, 21 + dy, 0x1f8a80, 0.6);
  text(P, SMALL, lbl, tx, 21, 0xb8fff4);
  for (const b of bases) {
    P.rect(x0 + 2, b, w - 4, 2, 0x3a3846); P.hl(x0 + 2, b, w - 4, 0x5a5866);
    P.rect(x0 + 2, b + 2, w - 4, 6, 0x18161e); P.hl(x0 + 2, b + 7, w - 4, 0x3fe0d0);
    P.ell((x0 + x1) >> 1, b + 10, w / 2, 3, 0x3fe0d0, 0.18, 3);
  }
  P.rect(x0, bot - 4, w, 4, CHAR.dk); P.hl(x0, bot - 4, w, 0x3fe0d0);
}

// ---- väskväggen: salviagrön spårpanel ----
function paintBagWall(P) {
  const { x0, x1 } = BAGW, top = 16, bot = UNIT_Y, w = x1 - x0;
  const S = { hi: 0xd2dcc8, base: 0xb4c2aa, lo: 0x94a28c, dk: 0x5e6c5a };
  for (let y = top; y < bot; y++) for (let x = x0 + 3; x < x1 - 3; x++) {
    const r = (y - top) % 6;
    P.px(x, y, jit(r === 5 ? S.dk : r === 0 ? S.hi : r === 4 ? S.lo : S.base, x, y, 31, 0.05));
  }
  P.rect(x0 - 2, top - 4, w + 4, 5, WALNUT.base); P.hl(x0 - 2, top - 4, w + 4, WALNUT.hi); P.hl(x0 - 2, top, w + 4, WALNUT.dk); P.hl(x0 - 2, top - 2, w + 4, GOLD.lo);
  for (const sx of [x0, x1 - 3]) { P.rect(sx, top, 3, bot - top, WALNUT.base); P.vl(sx, top, bot - top, WALNUT.hi); P.vl(sx + 2, top, bot - top, WALNUT.dk); }
  P.rect(x0 - 1, bot - 4, w + 2, 4, WALNUT.dk); P.hl(x0 - 1, bot - 4, w + 2, WALNUT.lo);
}

// ======================= golvmöblerna (egna bilder, ritas i djupordning) =======================
// Smyckesdisken: glasskiva över sammetsbrickor, valnötsfront med mässingsskylt, bordsspegel
function paintCounter(displays) {
  const ox = JEW.x0 - 2, oy = JEW.top - 16, w = JEW.x1 - JEW.x0 + 4, h = JEW.y - oy + 1;
  const P = new Pix(w, h, ox, oy);
  const { x0, x1, top, face, y } = JEW;
  // ovansidan: mässingsram och brickor
  P.rect(x0, top, x1 - x0, face - top, GOLD.lo);
  P.hl(x0, top, x1 - x0, GOLD.hi); P.hl(x0 + 1, top + 1, x1 - x0 - 2, GOLD.base);
  const trays = [[PLUM.lo, PLUM.base], [0xcab8b0, 0xe8dcd2], [TEAL.lo, TEAL.base]];
  for (let r = 0; r < 3; r++) {
    const ty = top + 2 + r * 10, [lo, base] = trays[r];
    for (let yy = ty; yy < ty + 10; yy++) for (let xx = x0 + 2; xx < x1 - 2; xx++) {
      const e = Math.min(yy - ty, ty + 9 - yy);
      P.px(xx, yy, jit(e === 0 ? mul(lo, 0.8) : e === 1 ? lo : base, xx, yy, 41 + r, 0.08));
    }
  }
  P.hl(x0 + 2, face - 2, x1 - x0 - 4, GOLD.dk);
  // varorna på brickorna
  const c = P.flush(), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  for (const d of displays) if (d.kind === 'jewel') x.drawImage(d.img, Math.round(d.x - d.ax - ox), Math.round(d.y - d.ay - oy));
  // glasets blänk ovanpå
  const Q = new Pix(w, h, ox, oy);
  for (let yy = top + 2; yy < face - 1; yy++) for (let xx = x0 + 2; xx < x1 - 2; xx++) { const dd = (xx - x0) + (yy - top) * 1.4; if (dd % 52 < 2 || dd % 52 === 5) Q.px(xx, yy, WHITE, 0.22); }
  // fronten: valnöt, ett upplyst glasfönster med askar, mässingsskylt
  for (let yy = face; yy <= y; yy++) for (let xx = x0; xx < x1; xx++) {
    let cc = yy === face ? WALNUT.hi : yy >= y - 2 ? WALNUT.dk : WALNUT.base;
    if ((xx - x0) % 44 === 0 && yy > face) cc = WALNUT.lo;
    Q.px(xx, yy, jit(cc, xx, yy, 43, 0.05));
  }
  // fyllningar (upphöjda paneler) med mässingsknopp
  for (let k = 0; k < 4; k++) {
    if (k === 1 || k === 2) continue;                              // skylten sitter i mitten
    const wx = x0 + 5 + k * 44, ww = 34, wy = face + 3, wh = 10;
    Q.rect(wx, wy, ww, wh, WALNUT.lo); Q.hl(wx, wy, ww, WALNUT.dk); Q.vl(wx, wy, wh, WALNUT.dk);
    Q.hl(wx + 1, wy + wh - 1, ww - 1, WALNUT.hi); Q.vl(wx + ww - 1, wy + 1, wh - 1, WALNUT.hi);
    Q.rect(wx + 3, wy + 2, ww - 6, wh - 4, WALNUT.base); Q.hl(wx + 3, wy + 2, ww - 6, WALNUT.hi);
    Q.px(wx + (ww >> 1), wy + (wh >> 1), GOLD.hi); Q.px(wx + (ww >> 1), wy + (wh >> 1) + 1, GOLD.lo);
  }
  const lbl = $t('SMYCKEN + KLOCKOR'), lw = textW(SMALL, lbl) + 10, lx = Math.round((x0 + x1) / 2 - lw / 2);
  Q.rect(lx, face + 3, lw, 9, GOLD.base); Q.box(lx, face + 3, lw, 9, GOLD.dk); Q.hl(lx + 1, face + 4, lw - 2, GOLD.hi);
  text(Q, SMALL, lbl, lx + 5, face + 5, PLUM.dk);
  // bordsspegeln till vänster på disken
  const mx = x0 + 9;
  Q.rect(mx - 1, top - 1, 3, 4, GOLD.dk); Q.rect(mx - 4, top + 2, 9, 2, GOLD.base); Q.hl(mx - 4, top + 2, 9, GOLD.hi);
  for (let yy = -7; yy <= 7; yy++) for (let xx = -5; xx <= 5; xx++) {
    const dd = Math.hypot(xx / 5.5, yy / 7.5);
    if (dd > 1) continue;
    Q.px(mx + xx, top - 9 + yy, dd > 0.8 ? (yy < 0 ? GOLD.hi : GOLD.lo) : ((xx + yy) % 5 === 0 ? 0xf4fbff : mix(0xcfe0e6, 0x9ab8c4, (yy + 7) / 14)));
  }
  x.drawImage(Q.flush(), 0, 0);
  return { img: c, x: ox, y: oy };
}

// Hårsmyckesbordet: vitlackat trappbord med sammet, perukhuvudena står på stegen
function paintHairTable(displays) {
  const { x0, x1, back, front, y } = HAIRT, ox = x0 - 2, oy = back - 22, w = x1 - x0 + 4, h = y - oy + 1;
  const P = new Pix(w, h, ox, oy);
  const step = (sy0, sy1, fy1) => {
    // ovansida (sammetslöpare på vit lack) och front
    for (let yy = sy0; yy < sy1; yy++) for (let xx = x0; xx < x1; xx++) {
      const e = Math.min(xx - x0, x1 - 1 - xx);
      let cc = yy === sy0 ? LACQ.hi : e < 3 ? LACQ.base : yy === sy0 + 1 ? PLUM.hi : PLUM.base;
      P.px(xx, yy, jit(cc, xx, yy, 47, 0.05));
    }
    for (let yy = sy1; yy < fy1; yy++) for (let xx = x0; xx < x1; xx++) {
      let cc = yy === sy1 ? LACQ.hi : yy === fy1 - 1 ? LACQ.dk : LACQ.base;
      if ((xx - x0) % 32 === 0) cc = LACQ.lo;
      P.px(xx, yy, jit(cc, xx, yy, 49, 0.03));
    }
    P.hl(x0, sy1 + 1, x1 - x0, GOLD.lo);
  };
  step(back - 8, back, front - 8);
  step(front - 8, front, y);
  P.vl(x0, back - 8, y - back + 8, LACQ.dk); P.vl(x1 - 1, back - 8, y - back + 8, LACQ.dk);
  const lbl = $t('I HÅRET'), lw = textW(SMALL, lbl) + 10, lx = Math.round((x0 + x1) / 2 - lw / 2);
  P.rect(lx, front + 7, lw, 9, PLUM.dk); P.box(lx, front + 7, lw, 9, GOLD.base); text(P, SMALL, lbl, lx + 5, front + 9, GOLD.hi);
  const c = P.flush(), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const heads = displays.filter((d) => d.kind === 'wig').sort((a, b) => a.y - b.y);
  for (const d of heads) x.drawImage(d.img, Math.round(d.x - d.ax - ox), Math.round(d.y - d.ay - oy));
  return { img: c, x: ox, y: oy };
}

// Kassadisken: marmorskiva, plommonfront med guld-A, kassaapparat och påsar
function paintDesk() {
  const { x0, x1, top, face, y } = DESK, ox = x0 - 2, oy = top - 16, w = x1 - x0 + 4, h = y - oy + 1;
  const P = new Pix(w, h, ox, oy);
  for (let yy = top; yy < face; yy++) for (let xx = x0; xx < x1; xx++) {
    let cc = yy === top ? WHITE : 0xefeae4;
    if (((xx * 3 + yy * 7) % 29 === 0) || ((xx - yy * 2 + 300) % 37 === 0)) cc = 0xc8c0c8;   // marmorådror
    P.px(xx, yy, jit(cc, xx, yy, 51, 0.03));
  }
  P.hl(x0, face - 1, x1 - x0, 0xb8b0b8);
  for (let yy = face; yy <= y; yy++) for (let xx = x0; xx < x1; xx++) {
    const e = Math.min(xx - x0, x1 - 1 - xx);
    let cc = yy === face ? PLUM.hi : yy >= y - 1 ? PLUM.dk : e < 2 ? PLUM.lo : PLUM.base;
    if ((xx - x0) % 12 === 6 && yy > face + 1 && yy < y - 1) cc = PLUM.lo;
    P.px(xx, yy, jit(cc, xx, yy, 53, 0.04));
  }
  P.hl(x0, face + 2, x1 - x0, GOLD.lo);
  // guldmedaljong med ett A
  const cx = (x0 + x1) >> 1, cy = face + 8;
  for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) { const d = Math.hypot(xx, yy); if (d <= 5.2) P.px(cx + xx, cy + yy, d > 4.2 ? GOLD.dk : d > 3.4 ? GOLD.hi : PLUM.dk); }
  text(P, SMALL, 'A', cx - 1, cy - 2, GOLD.hi);
  // kassaapparat
  P.rect(x1 - 26, top - 10, 18, 10, 0x2a2a32); P.rect(x1 - 25, top - 9, 16, 4, 0x6fe08a); P.hl(x1 - 24, top - 8, 7, 0x1d5a2c); P.hl(x1 - 24, top - 7, 10, 0x2f8f46);
  P.rect(x1 - 27, top - 4, 20, 4, 0x3a3a44); P.hl(x1 - 27, top - 4, 20, 0x5a5a64);
  for (let i = 0; i < 4; i++) P.px(x1 - 25 + i * 4, top - 2, 0xd8dce6);
  // kortläsare
  P.rect(x1 - 6, top - 5, 4, 5, 0x2a2a32); P.hl(x1 - 5, top - 4, 2, 0x8fa0b8);
  // påsar med guld-A och silkespapper
  for (const [bx, bc] of [[x0 + 4, PLUM.base], [x0 + 15, 0xf4f1ea]]) {
    P.rect(bx, top - 9, 10, 10, bc); P.hl(bx, top - 9, 10, mix(bc, WHITE, 0.3)); P.vl(bx + 9, top - 9, 10, mul(bc, 0.75));
    P.px(bx + 3, top - 11, GOLD.lo); P.px(bx + 6, top - 11, GOLD.lo); P.px(bx + 2, top - 10, GOLD.lo); P.px(bx + 7, top - 10, GOLD.lo);
    P.px(bx + 4, top - 10, 0xf2a0b8); P.px(bx + 5, top - 11, 0xf2a0b8);
    text(P, SMALL, 'A', bx + 4, top - 6, bc === 0xf4f1ea ? PLUM.base : GOLD.hi);
  }
  // en liten skål med godis
  P.rect(x0 + 30, top - 3, 9, 3, 0xd8eef4); P.hl(x0 + 31, top - 4, 7, 0xf0fbff);
  for (const [dx, cc] of [[31, 0xd83a4a], [33, 0xf0c030], [35, 0x46a35a], [37, 0xff5dc8]]) P.px(x0 + dx, top - 4, cc);
  return { img: P.flush(), x: ox, y: oy };
}

// Rund sammetspuff (cylinder): knappad ovansida med guldpassepoal, veckad sida
function paintPouf() {
  const ox = POUF.x - 18, oy = POUF.y - 18, P = new Pix(37, 20, ox, oy);
  const cx = POUF.x, rx = 16, ry = 5, topY = POUF.y - 11, botY = POUF.y - 2;
  // sidan
  for (let x = -rx; x <= rx; x++) {
    const e = Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2)), yB = botY + Math.round(e * 3);
    for (let y = topY; y <= yB; y++) {
      const sh = x / rx;
      let c = sh < -0.55 ? TEAL.base : sh > 0.5 ? TEAL.dk : TEAL.lo;
      if ((x + 40) % 5 === 0) c = mul(c, 0.82);                          // veck
      if (y >= yB - 1) c = mul(TEAL.dk, 0.8);
      P.px(cx + x, y, jit(c, cx + x, y, 57, 0.06));
    }
  }
  // ovansidan
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const d = Math.hypot((x + 0.5) / (rx + 0.6), (y + 0.5) / (ry + 0.6));
    if (d > 1) continue;
    let c = d > 0.86 ? (y < 0 ? GOLD.hi : GOLD.lo) : mix(TEAL.hi, TEAL.base, Math.min(1, (y + ry) / (ry * 2) + (x > 0 ? 0.25 : 0)));
    P.px(cx + x, topY + y, jit(c, cx + x, topY + y, 59, 0.05));
  }
  // knappar
  for (const [x, y] of [[-8, -1], [0, -2], [8, -1], [-4, 2], [4, 2], [0, 0]]) { P.px(cx + x, topY + y, TEAL.dk); P.px(cx + x - 1, topY + y - 1, mix(TEAL.hi, WHITE, 0.3)); }
  return { img: P.flush(), x: ox, y: oy };
}

// Hattstång i mässing med tre hattar på krokarna (motorns egna hattar)
const STAND_HATS = ['hat-fedora', 'hat-pompom', 'hat-straw'];
function paintHatStand() {
  const { x, y } = STAND, ox = x - 16, oy = y - 50, P = new Pix(33, 53, ox, oy);
  for (let yy = -3; yy <= 3; yy++) for (let xx = -9; xx <= 9; xx++) { const d = Math.hypot(xx / 9.5, yy / 3.2); if (d <= 1) P.px(x + xx, y - 1 + yy, d > 0.75 ? WALNUT.dk : yy < 0 ? WALNUT.hi : WALNUT.base); }
  P.rect(x - 1, y - 44, 2, 43, GOLD.lo); P.vl(x - 1, y - 44, 43, GOLD.hi); P.vl(x, y - 44, 43, GOLD.base);
  P.rect(x - 2, y - 47, 4, 3, GOLD.base); P.hl(x - 1, y - 47, 2, GOLD.hi);
  for (const [dx, dy] of [[-1, -40], [1, -40], [-1, -30], [1, -30]]) for (let i = 1; i <= 6; i++) P.px(x + dx * i, y + dy - (i > 4 ? i - 4 : 0), i === 6 ? GOLD.hi : GOLD.lo);
  const c = P.flush(), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const hooks = [[-6, -42], [6, -42], [-6, -32]];
  STAND_HATS.forEach((id, i) => { const it = itemById(id); if (!it) return; const h = isolated(it); const [hx, hy] = hooks[i]; g.drawImage(h, Math.round(x + hx - h.width / 2 - ox), Math.round(y + hy - h.height + 5 - oy)); });
  // en halsduk över den fjärde kroken
  const sc = [[-1, 0, 0xc9323a], [0, 1, 0xc9323a], [1, 2, 0xa82a30], [1, 3, 0xc9323a], [1, 4, 0xe85a60], [1, 5, 0xc9323a], [1, 6, 0xa82a30], [2, 7, 0xf4f1ea], [1, 8, 0xc9323a]];
  for (const [dx, dy, cc] of sc) { g.fillStyle = css(cc); g.fillRect(x + 6 + dx - ox, y - 32 + dy - oy, 3, 1); }
  return { img: c, x: ox, y: oy };
}

function paintPlant() {
  const P = new Pix(22, 38);
  const leaves = [[11, 6, 4, 5], [6, 11, 4, 4], [16, 10, 4, 5], [9, 16, 5, 4], [15, 17, 4, 4], [5, 20, 4, 3], [17, 23, 4, 3], [11, 11, 3, 4], [11, 21, 4, 3]];
  for (const [x, y, rx, ry] of leaves) for (let yy = -ry - 1; yy <= ry + 1; yy++) for (let xx = -rx - 1; xx <= rx + 1; xx++) if ((xx / (rx + 0.6)) ** 2 + (yy / (ry + 0.6)) ** 2 <= 1) P.px(x + xx, y + yy, 0x173d22);
  leaves.forEach(([x, y, rx, ry], i) => {
    const c = [0x2f7a3e, 0x3a8f48, 0x46a35a][i % 3];
    for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) if ((xx / rx) ** 2 + (yy / ry) ** 2 <= 1) P.px(x + xx, y + yy, xx + yy < -2 ? mix(c, WHITE, 0.22) : c);
    P.vl(x, y - ry + 1, ry * 2 - 1, mul(c, 0.78));
  });
  P.vl(11, 24, 5, 0x5a3a24); P.vl(10, 26, 3, 0x5a3a24);
  // guldkruka
  for (let yy = 28; yy < 38; yy++) { const hw = yy < 30 ? 7 : 6 - ((yy - 30) >> 2); P.hl(11 - hw, yy, hw * 2, yy === 28 ? GOLD.hi : yy === 37 ? GOLD.dk : GOLD.base); P.px(11 + hw - 1, yy, GOLD.lo); P.px(11 - hw, yy, GOLD.hi); }
  P.hl(5, 29, 12, GOLD.lo);
  return P.flush();
}

function paintPodium() {
  const P = new Pix(28, 10);
  for (let x = 0; x < 28; x++) {
    const dx = (x + 0.5 - 14) / 13.5;
    if (Math.abs(dx) >= 1) continue;
    const e = Math.sqrt(1 - dx * dx) * 3, y0 = Math.round(3 - e), y1 = Math.round(3 + e);
    for (let y = y0; y <= y1 + 5; y++) {
      let c = y <= y1 ? (y === y0 ? WHITE : LACQ.base) : y === y1 + 1 ? GOLD.base : mix(PLUM.base, 0, (y - y1) * 0.05 + (dx > 0.4 ? 0.1 : 0));
      if (y === y1 + 5) c = PLUM.dk;
      P.px(x, y, c);
    }
  }
  return P.flush();
}

// Veckans look på dockan vid entrén
const WEEK_LOOK = ['hat-fedora', 'glasses-roundtint', 'neck-scarflong', 'bag-messenger', 'jewel-watch'];
function weekLook() {
  let L = { ...FORM, skin: '#e9e2ea', top: 'sweater', shirt: '#e8dccb', accent: '#e8dccb', bottom: 'pants', pants: '#3a4458', shoes: '#6b3e1e', build: 5 };
  for (const id of WEEK_LOOK) { const it = itemById(id); if (it) L = lookForItem(it, L, { colors: true }); }
  return L;
}

// ======================= repliker =======================
const CLERK_LOOK = { skin: '#8d5a3b', hair: '#1d1714', style: 'bun', top: 'shirt', shirt: '#2e2c38', accent: '#e8c050', bottom: 'pants', pants: '#2e2c38', shoes: '#1c1c1c', glasses: 'catEye', neck: 'pearls', jewel: 'hoops', beard: false, phones: false, bag: null, hat: null, build: 5, cheeks: 'blush' };
const CLERK_TIPS = [
  $t('Hej och välkommen! 👋 Klicka på något du gillar så får du prova det på dig.'),
  $t('Tips: spegeln bredvid hattarna visar hur du ser ut just nu! 🪞'),
  $t('Skyltarna i taket visar hela sortimentet för avdelningen.'),
  $t('Smyckena ligger i glasdisken – örhängen, klockor och handskar.'),
  $t('Allt du köper hänger i garderoben där hemma sen.'),
];
const TRY_LINES = [$t('Passar den mig? 😄'), $t('Den här är ju söt!'), $t('Hmm …'), $t('Oj, vad fin!'), $t('Vad tycker du?'), $t('Snyggt, va?')];
const BACK_LINES = [$t('Nja, inte min stil.'), $t('Lite för dyr …'), $t('Jag tänker på saken.'), $t('Kanske nästa gång!')];
const BUY_LINES = [$t('Den tar jag!'), $t('Den måste jag ha! 💖'), $t('Köper!')];
const THANKS = [$t('Tack för köpet! 💖'), $t('Tack! Den klär dig! ✨'), $t('Tack så mycket – välkommen åter!')];
const MINE = [$t('Den är min! ✨'), $t('Yes! 🛍️'), $t('Så fin! 💖')];

// ======================= scenen =======================
export function makeShopAccessoarer(A, opts = {}) {
  const g = A.game;
  syncView(A);
  let t = 0, lockedCam = null, peekCam = null, hoverId = null, hoverT = -9;
  const displays = buildDisplays();
  const byId = new Map(displays.map((d) => [d.it.id, d]));
  const nightNow = () => { const h = g.min / 60; return h >= 19.5 || h < 6.5; };

  // ---------- bilder ----------
  const cache = {};
  const stock = () => {
    const k = 'bg' + nightNow();
    if (!cache[k]) {
      const c = paintRoom(nightNow()), x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      for (const d of displays) {
        if (d.kind === 'jewel' || d.kind === 'wig') continue;           // står på golvmöblerna
        if (d.kind === 'bag') hookAt(x, d.x, d.hook);
        x.drawImage(d.img, Math.round(d.x - d.ax), Math.round(d.y - d.ay));
      }
      cache[k] = c;
    }
    return cache[k];
  };
  const glassImg = (() => { const P = new Pix(W, H); paintCabinetGlass(P, OPT); paintCabinetGlass(P, NECK); return P.flush(); })();
  const sheen = (() => { const gl = mirrorGlass(), P = new Pix(gl.x1 - gl.x0, gl.y1 - gl.y0, gl.x0, gl.y0); for (let y = gl.y0; y < gl.y1; y++) for (let x = gl.x0; x < gl.x1; x++) { const d = (x - gl.x0) + (y - gl.y0) * 0.45; if (d % 30 < 2 || d % 30 === 5) P.px(x, y, WHITE, 0.3); } return P.flush(); })();
  const counter = paintCounter(displays), table = paintHairTable(displays), desk = paintDesk(), pouf = paintPouf(), plantImg = paintPlant(), podium = paintPodium(), hatStand = paintHatStand();
  const manq = weekLook();

  // prislapparna (bero på ägande och REA) i ett eget lager
  let tagKey = '', tagLayer = null;
  const tagsNow = () => {
    const k = displays.map((d) => (d.tag ? tagStr(g, d.it) : '')).join('|');
    if (k !== tagKey) { tagKey = k; tagLayer = paintTags(displays, g); }
    return tagLayer;
  };

  // ---------- gången ----------
  const OBST = [
    [HAT.x0 - 3, WALL_Y - 4, HAT.x1 + 3, UNIT_Y + 1],
    [MIR.x0 - 1, WALL_Y - 4, MIR.x1 + 1, MIR.y + 2],
    [OPT.x0 - 3, WALL_Y - 4, OPT.x1 + 3, UNIT_Y + 1],
    [MANQ.x - 13, MANQ.y - 5, MANQ.x + 13, MANQ.y + 3],
    [DESK.x0, DESK.top - 4, DESK.x1, DESK.y + 1],
    [SND.x0 - 1, WALL_Y - 4, SND.x1 + 1, UNIT_Y + 1],
    [BAGW.x0 - 3, WALL_Y - 4, BAGW.x1 + 3, UNIT_Y + 1],
    [NECK.x0 - 3, WALL_Y - 4, NECK.x1 + 3, UNIT_Y + 1],
    [JEW.x0 - 1, JEW.top - 2, JEW.x1 + 1, JEW.y + 1],
    [HAIRT.x0 - 1, HAIRT.back - 9, HAIRT.x1 + 1, HAIRT.y + 1],
    [POUF.x - 17, POUF.y - 8, POUF.x + 17, POUF.y + 1],
    [STAND.x - 9, STAND.y - 4, STAND.x + 9, STAND.y + 2],
    ...PLANTS.map(([x, y]) => [x - 7, y - 5, x + 7, y + 1]),
  ];
  const mkWalker = (spawn) => { const w = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 5, bottom: H - 5, spawn }); w.setObstacles(OBST); w.snapFree(); return w; };
  const walker = mkWalker([DOOR_SPOT[0], DOOR_SPOT[1] + 3]);
  // De synliga kolumnerna: fyll-läget (VID på datorn/paddan, t.ex. 41 px på var sida i
  // 1920×1080) beskär kanterna. Kameran klämms mot det SYNLIGA, annars går hattväggens
  // första och halsvitrinens sista varor aldrig att se.
  const visX = () => {
    const s = A.view?.safe;
    const x0 = clamp(Math.round(s?.x0 ?? 0), 0, VW - 64);
    return { x0, x1: clamp(Math.round(s?.x1 ?? VW), x0 + 64, VW) };
  };
  const camClamp = (c) => { const v = visX(), lo = -v.x0, hi = W - v.x1; return lo > hi ? (lo + hi) / 2 : clamp(c, lo, hi); };
  const camTarget = () => { if (lockedCam !== null || peekCam !== null) return lockedCam ?? peekCam; const v = visX(); return camClamp(walker.px - (v.x0 + v.x1) / 2); };
  const cam = { x: camTarget(), y: 0 };
  // ---------- lodrät kamera (mobilens NÄRA-läge) ----------
  // Fyll-läget på mobilen beskär upptill och nertill (main.js v.safe). Mätarremsan tar två
  // rader på en liggande mobil, då syns bara ~136 av butikens 216 rader. Då följer en
  // lodrät kamera figuren: står man vid väggen syns HELA väggen (takskyltarna och översta
  // hyllan), går man mot smyckesdisken, puffen eller hattstången glider bilden ner.
  // Datorn, VID och RAM ser hela höjden – där är camY alltid 0.
  let aim = null, peekY = null, ty = 0; // ty = radförskjutningen i senaste ritningen (skärm-y = värld-y + ty)
  const band = () => {
    const s = A.view?.safe;
    const y0 = clamp(Math.round(s?.y0 ?? 0), 0, H - 96);
    const y1 = clamp(Math.round(s?.y1 ?? H), y0 + 96, H);
    return { y0, y1, v: y1 - y0 };
  };
  // Figuren (huvud + pratbubbla … fötterna) och varan man går till eller står vid ska synas.
  // Väggvaror (ovanför fötterna) får namnskylten under figuren, så där räknas skylten in.
  // Får allt plats hamnar bilden så högt som möjligt (väggen), annars vinner varan.
  const camYs = () => {
    const b = band();
    if (b.v >= H) return 0;
    if (peekY !== null) return clamp(peekY, 0, H - b.v);
    const fy = walker.py, s = aim || standingAt();
    let a = fy - 50, z = fy + 4;                      // fötterna precis ovanför nederkanten
    if (s) { a = Math.min(a, s.r[1] - 3); z = Math.max(z, s.r[3] + 3, s.disp && s.r[3] < fy ? fy + 29 : 0); }
    return clamp(Math.round(z - a <= b.v || !s ? z - b.v : a), 0, H - b.v);
  };
  const tyNow = () => band().y0 - Math.round(cam.y);
  // pratbubblor hålls inom det synliga bandet (annars hamnar t.ex. expeditens under remsan)
  const inBand = (p) => ({ x: p.x, y: Math.max(p.y, Math.round(cam.y) + 34) });
  const me = { bagT: -9 };
  const meAt = () => inBand({ x: walker.px, y: walker.py - 44 });
  const talkMe = createSpeech(), talkClerk = createSpeech();
  const clerkAt = () => inBand({ x: CLERK_AT[0], y: CLERK_AT[1] - 42 });
  let tipI = 0;
  const seen = (x, m = 0) => { const v = visX(); return x >= cam.x + v.x0 - m && x <= cam.x + v.x1 + m; };

  // ---------- kunderna ----------
  let seed = (g.day * 7919 + 17) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let z = seed; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const pickDisp = (other) => { for (let k = 0; k < 8; k++) { const d = displays[(rnd() * displays.length) | 0]; if (!other || Math.abs(d.go[0] - other.go[0]) > 40) return d; } return displays[0]; };
  const shoppers = [0, 1].map((i) => {
    const look = makeLookRich(rnd);
    const w = mkWalker(i ? [760, 200] : [330, 150]);
    w.speed = 38 + i * 6;
    return { i, w, base: look, look, state: 'idle', until: 1 + i * 2.5, target: null, talk: createSpeech(), bagT: -9 };
  });
  const shopperSay = (s, lines) => { if (seen(s.w.px, 20)) s.talk.say(lines[(rnd() * lines.length) | 0], () => inBand({ x: s.w.px, y: s.w.py - 44 }), 2.6, { voice: s.base }); };
  function updShopper(s, dt) {
    s.w.update(dt);
    if (s.w.path.length || t < s.until) return;
    const other = shoppers[1 - s.i].target;
    switch (s.state) {
      case 'idle': {
        s.target = pickDisp(other);
        s.state = 'walk';
        s.w.walkTo(s.target.go[0] + (rnd() - 0.5) * 10, s.target.go[1] + (s.target.face === 'up' ? 3 : 0));
        break;
      }
      case 'walk': s.w.dir = s.target.face; s.state = 'look'; s.until = t + 2 + rnd() * 2.5; break;
      case 'look':
        if (rnd() < 0.6) { s.look = lookForItem(s.target.it, s.base, { colors: true }); s.w.dir = 'down'; s.state = 'try'; s.until = t + 3.4; shopperSay(s, TRY_LINES); }
        else { s.state = 'idle'; s.until = t + 0.6; }
        break;
      case 'try': {
        const r = rnd();
        if (r < 0.3) { s.state = 'mirror'; s.w.walkTo(278 + (s.i ? 6 : -6), UNIT_Y + 7); }
        else if (r < 0.52) { s.state = 'pay'; s.w.walkTo(PAY[0] + (s.i ? 14 : -14), PAY[1] + 4); shopperSay(s, BUY_LINES); }
        else { s.look = s.base; s.state = 'idle'; s.until = t + 1.5; shopperSay(s, BACK_LINES); }
        break;
      }
      case 'mirror': s.w.dir = 'up'; s.state = 'try2'; s.until = t + 2.6; break;
      case 'try2': if (rnd() < 0.5) { s.state = 'pay'; s.w.walkTo(PAY[0] + (s.i ? 14 : -14), PAY[1] + 4); } else { s.look = s.base; s.state = 'idle'; s.until = t + 1; shopperSay(s, BACK_LINES); } break;
      case 'pay':
        s.w.dir = 'up'; s.base = s.look; s.bagT = t + 9; s.state = 'idle'; s.until = t + 2.8;
        if (seen(CLERK_AT[0], 20)) talkClerk.say(THANKS[(rnd() * THANKS.length) | 0], clerkAt, 2.6, { voice: CLERK_LOOK });
        break;
      default: s.state = 'idle';
    }
  }

  // ---------- klickbara platser ----------
  const spots = [
    ...displays.map((d) => ({ id: d.it.id, r: d.r, go: d.go, face: d.face, disp: d, act: () => openBuy(A, d.it, { onBought }) })),
    { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 4, DOOR.x1 + 3, WALL_Y + 6], go: DOOR_SPOT, label: $t('UT PÅ GATAN'), act: () => { play('door'); A.go('city'); } },
    { id: 'kassa', r: [DESK.x0, DESK.top - 30, DESK.x1, DESK.y], go: PAY, face: 'up', label: $t('KASSAN'), act: () => { play('click'); talkClerk.say(CLERK_TIPS[tipI++ % CLERK_TIPS.length], clerkAt, 4.5, { voice: CLERK_LOOK }); } },
    { id: 'spegel', r: [MIR.x0, MIR.top - 6, MIR.x1, MIR.y], go: [278, UNIT_Y + 6], face: 'up', label: $t('SPEGELN'), act: () => { play('click'); talkMe.say(mirrorLine(), meAt, 3); } },
    { id: 'docka', r: [MANQ.x - 12, MANQ.y - 46, MANQ.x + 12, MANQ.y + 4], go: [MANQ.x + 20, MANQ.y + 4], face: 'left', label: $t('VECKANS LOOK'), act: () => openKat(A, { title: $t('✨ Veckans look'), ids: WEEK_LOOK, onBought }) },
    { id: 'hattstang', r: [STAND.x - 14, STAND.y - 50, STAND.x + 14, STAND.y + 2], go: [STAND.x + 16, STAND.y + 2], face: 'left', label: $t('HATTSTÅNGEN - SE ALLA HATTAR'), act: () => openKat(A, { sec: 'hattar', onBought }) },
    { id: 'puff', r: [POUF.x - 17, POUF.y - 16, POUF.x + 17, POUF.y + 2], go: [POUF.x, POUF.y + 10], face: 'up', label: $t('PUFFEN'), act: () => { play('click'); talkMe.say($t('Skönt att vila fötterna en stund. 😌'), meAt, 3); } },
    { id: 'ljud', r: [SND.x0 + 4, 16, SND.x1 - 4, 32], go: [(SND.x0 + SND.x1) >> 1, UNIT_Y + 6], face: 'up', label: $t('HÖRLURAR - SE ALLA'), act: () => { notes(); openKat(A, { sec: 'horlurar', onBought }); } },
    ...HANG_SIGNS.map((s) => ({ id: 'skylt-' + s.id, r: [s.x - signW(s.label) / 2, 0, s.x + signW(s.label) / 2, 14], go: [s.x, UNIT_Y + 6], face: 'up', label: $t`${s.label} - SE ALLA`, act: () => openKat(A, { sec: s.id, onBought }) })),
    { id: 'skylt-smycken', r: [(JEW.x0 + JEW.x1) / 2 - 40, JEW.face, (JEW.x0 + JEW.x1) / 2 + 40, JEW.y], go: [(JEW.x0 + JEW.x1) >> 1, JEW.y + 8], face: 'up', label: $t('SMYCKEN - SE ALLA'), act: () => openKat(A, { sec: 'smycken', onBought }) },
    { id: 'skylt-har', r: [(HAIRT.x0 + HAIRT.x1) / 2 - 24, HAIRT.front + 4, (HAIRT.x0 + HAIRT.x1) / 2 + 24, HAIRT.y], go: [(HAIRT.x0 + HAIRT.x1) >> 1, HAIRT.y + 8], face: 'up', label: $t('I HÅRET - SE ALLA'), act: () => openKat(A, { sec: 'har', onBought }) },
  ];
  // klickrutorna för golvmöblernas varor ligger ovanpå möblerna – de vinner över skyltarna
  const spotAt = (x, y) => spots.find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const spotById = (id) => spots.find((s) => s.id === id);
  const mirrorLine = () => {
    const n = ['hat', 'glasses', 'bag', 'neck', 'jewel', 'hairAcc', 'phones'].reduce((a, slot) => a + (itemsForSlot(slot).some((it) => isWorn(it, A.avatar.look)) ? 1 : 0), 0);
    return n ? (n === 1 ? $t`🪞 Snygg! Jag har ${n} accessoar på mig.` : $t`🪞 Snygg! Jag har ${n} accessoarer på mig.`) : $t('🪞 Hmm, lite naket … en hatt kanske?');
  };
  function goSpot(s) {
    peekCam = null; peekY = null; aim = s;
    walker.walkTo(s.go[0], s.go[1], () => { if (s.face) walker.dir = s.face; s.act?.(); });
  }
  function onBought(it) {
    me.bagT = t + 8;
    const d = byId.get(it.id);
    if (d) sparkle(d.x, d.kind === 'bust' ? d.y - 14 : d.y - 6);
    // expediten tackar om hon syns, annars blir man glad själv
    if (seen(CLERK_AT[0], 30)) talkClerk.say(THANKS[(rnd() * THANKS.length) | 0], clerkAt, 3, { voice: CLERK_LOOK });
    else talkMe.say(MINE[(rnd() * MINE.length) | 0], meAt, 2.6);
  }

  // ---------- partiklar: glitter och noter ----------
  const parts = [];
  const sparkle = (x, y) => { for (let i = 0; i < 12; i++) parts.push({ kind: 'glitter', x: x + (rnd() - 0.5) * 16, y: y + (rnd() - 0.5) * 12, vx: (rnd() - 0.5) * 8, vy: -8 - rnd() * 10, age: -i * 0.03, max: 0.9 }); };
  const notes = () => { play('chirp'); for (let i = 0; i < 6; i++) parts.push({ kind: 'note', x: SND.x0 + 12 + rnd() * (SND.x1 - SND.x0 - 24), y: 60 + rnd() * 30, vx: (rnd() - 0.5) * 6, vy: -12, age: -i * 0.18, max: 1.6 }); };

  // varan man står vid, och vad man står vid (eller pekar på)
  function standingAt() {
    if (walker.path.length) return null;
    const at = (s) => s.disp && Math.abs(walker.px - s.go[0]) < 5 && Math.abs(walker.py - s.go[1]) < 5;
    // i smyckesdisken delar raderna ståplats – varan man gick till vinner
    return (aim && at(aim) ? aim : spots.find(at)) || null;
  }
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 ? spotById(hoverId) : null;
    return h || standingAt();
  };
  cam.y = camYs(); ty = tyNow();

  function update(dt) {
    t += dt;
    walker.update(dt);
    for (const s of shoppers) updShopper(s, dt);
    for (const p of parts) { p.age += dt; if (p.age > 0) { p.x += p.vx * dt; p.y += p.vy * dt; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (camTarget() - cam.x) * k;
    const ky = camYs() - cam.y;
    cam.y = Math.abs(ky) < 0.5 ? camYs() : cam.y + ky * Math.min(1, dt * 5);
  }

  // ---------- ritning ----------
  function drawWorld(ctx, cx, vw, focus) {
    ctx.drawImage(stock(), 0, 0);
    // equalizern på ljudväggen
    for (let i = 0; i < 6; i++) {
      const hgt = 2 + Math.round((Math.sin(t * (5 + i * 1.3) + i * 2) * 0.5 + 0.5) * 6);
      for (const bx of [SND.x0 + 6 + i * 2, SND.x1 - 18 + i * 2]) { ctx.fillStyle = i % 2 ? '#ff5dc8' : '#3fe0d0'; ctx.fillRect(bx, 31 - hgt, 1, hgt); }
    }
    ctx.drawImage(tagsNow(), 0, 0);
    drawReflections(ctx);
    ctx.drawImage(sheen, mirrorGlass().x0, mirrorGlass().y0);
    ctx.drawImage(glassImg, 0, 0);
    // markering runt väggvaran man står vid/pekar på
    const fd = focus?.disp;
    if (fd && !['jewel', 'wig'].includes(fd.kind)) brackets(ctx, fd.r, t);

    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(JEW.y, () => { ctx.drawImage(counter.img, counter.x, counter.y); if (fd?.kind === 'jewel') brackets(ctx, fd.r, t); });
    add(HAIRT.y, () => { ctx.drawImage(table.img, table.x, table.y); if (fd?.kind === 'wig') brackets(ctx, fd.r, t); });
    add(DESK.y, () => {
      drawPerson(ctx, CLERK_AT[0], CLERK_AT[1], CLERK_LOOK, 'down', Math.sin(t * 1.7) > 0.93 ? 4 : 0);
      ctx.drawImage(desk.img, desk.x, desk.y);
    });
    add(MANQ.y, () => { ctx.drawImage(podium, MANQ.x - 14, MANQ.y - 5); drawPerson(ctx, MANQ.x, MANQ.y - 2, manq, 'down', 0); });
    add(POUF.y, () => ctx.drawImage(pouf.img, pouf.x, pouf.y));
    add(STAND.y, () => ctx.drawImage(hatStand.img, hatStand.x, hatStand.y));
    for (const [x, y] of PLANTS) add(y, () => ctx.drawImage(plantImg, x - 11, y - 37));
    for (const s of shoppers) add(s.w.py, () => {
      const walking = s.w.path.length > 0;
      drawPerson(ctx, s.w.px, s.w.py, s.look, s.w.dir, walking ? WALK_SEQ[Math.floor(t * 7 + s.i) % 4] : (Math.sin(t * 2 + s.i * 3) > 0.92 ? 4 : 0));
      if (s.bagT > t) carryBag(ctx, s.w.px, s.w.py, s.w.dir, s.i ? PLUM.base : 0xf4f1ea);
    });
    for (const d of folkDrawables(A, t)) add(d.fy, (c) => d.draw(c));
    const sd = selfDrawable(A, walker, t, { folksHere: A.worldFolksHere?.().length || 0 });
    add(walker.py + 0.01, (c) => { sd.draw(c); if (me.bagT > t) carryBag(c, walker.px, walker.py, walker.dir, PLUM.base); });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw(ctx);

    for (const p of parts) {
      if (p.age < 0) continue;
      const X = Math.round(p.x), Y = Math.round(p.y), k = 1 - p.age / p.max;
      if (p.kind === 'glitter') { ctx.fillStyle = (Math.floor(p.age * 20) & 1) ? '#ffffff' : '#fff27a'; ctx.fillRect(X, Y, 1, 1); if (k > 0.5) { ctx.fillRect(X - 1, Y, 3, 1); ctx.fillRect(X, Y - 1, 1, 3); } }
      else if (p.kind === 'note') { ctx.fillStyle = rgba(p.x % 2 < 1 ? 0x3fe0d0 : 0xff5dc8, Math.min(1, k * 1.5).toFixed(2)); ctx.fillRect(X, Y, 2, 2); ctx.fillRect(X + 1, Y - 4, 1, 4); ctx.fillRect(X + 2, Y - 4, 1, 1); }
    }
    // kvällsljus: mörkare, varmt ljus kvar vid hyllorna
    if (nightNow()) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(120,104,150,0.45)'; ctx.fillRect(cx, 0, vw, H);
      ctx.restore();
    }
  }
  // spegelbilder av alla som står framför spegeln
  function drawReflections(ctx) {
    const gl = mirrorGlass(), figs = [];
    const add = (x, y, look, dir, fr) => { if (x > gl.x0 - 10 && x < gl.x1 + 10 && y >= UNIT_Y && y < UNIT_Y + 44) figs.push({ x, y, look, dir, fr }); };
    const flip = { up: 'down', down: 'up', left: 'left', right: 'right' };
    add(walker.px, walker.py, A.avatar.look, flip[walker.dir], walker.path.length ? WALK_SEQ[Math.floor(t * 8.5) % 4] : 0);
    for (const s of shoppers) add(s.w.px, s.w.py, s.look, flip[s.w.dir], s.w.path.length ? WALK_SEQ[Math.floor(t * 7 + s.i) % 4] : 0);
    if (!figs.length) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(gl.x0, gl.y0, gl.x1 - gl.x0, gl.y1 - gl.y0); ctx.clip();
    figs.sort((a, b) => b.y - a.y); // längst bort i spegeln = närmast spegeln, ritas sist
    for (const f of figs) drawPerson(ctx, f.x, Math.round(MIR.y - 5 - (f.y - UNIT_Y) * 0.45), f.look, f.dir, f.fr);
    ctx.fillStyle = 'rgba(200,220,232,0.16)'; ctx.fillRect(gl.x0, gl.y0, gl.x1 - gl.x0, gl.y1 - gl.y0);
    ctx.restore();
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() { if (seen(CLERK_AT[0])) talkClerk.say($t('Välkommen in! ✨'), clerkAt, 2.5, { voice: CLERK_LOOK }); },
    exit() { talkMe.clear(); talkClerk.clear(); for (const s of shoppers) s.talk.clear(); },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy - ty; // skärm → värld (radbandet kan vara förskjutet)
      hoverId = null; peekCam = null; peekY = null; aim = null;
      const h = spotAt(x, y);
      if (h) { goSpot(h); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy - ty)?.id || null; hoverT = t; },
    key(k) { if (k === 'Escape') walker.stop(); },
    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x);
      ty = tyNow();
      if (ty !== 0 || cx < 0 || cx > W - VW) {
        // bandet är förskjutet (eller kameran står utanför butikens kant): raderna och
        // kolumnerna utanför butiken – som ändå ligger under beskärningen – blir mörka
        // i stället för rester av förra bilden
        ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
        ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, 0, VW, Math.max(H, A.H || H));
      }
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, ty * A.pxs);
      ctx.imageSmoothingEnabled = false;
      const focus = focusSpot();
      drawWorld(ctx, cx, VW, focus);
      const vx = visX(), view = { x0: cx + vx.x0, x1: cx + vx.x1 }; // bubblorna hålls i det synliga
      // bubblor bara när den som pratar syns (annars hänger de ensamma i bildkanten)
      if (seen(CLERK_AT[0], 16)) talkClerk.draw(ctx, view);
      for (const s of shoppers) if (seen(s.w.px, 16)) s.talk.draw(ctx, view);
      talkMe.draw(ctx, view);
      // skyltar i skärmkoordinater
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const safe = globalThis.SF?.view?.safe || { y0: 0, y1: H };
      const bottom = Math.min(H, safe.y1);
      let lab = null;
      if (focus) {
        // namnskylten nertill – upptill om den skulle skymma varan eller figurens fötter
        // (men aldrig över varan: hellre över benen när varan står på översta hyllan)
        const top = Math.max(0, safe.y0) + 3, bot = bottom - 25;
        const r0 = focus.r[1] + ty, r1 = focus.r[3] + ty, feet = walker.py + ty;
        const hides = (y) => r1 > y - 2 && r0 < y + 24;
        lab = bigLabel(ctx, focus, g, t, !hides(top) && (hides(bot) || feet > bot - 2) ? top : bot);
      }
      // pilskyltarna till butikens andra ände ligger i nederkanten (på golvet, inte över
      // hyllorna) och viker undan för namnskylten. Är fler spelare här ligger emoji-knapparna
      // i nedre högra hörnet – då lyfts den högra skylten över dem.
      if (cx + vx.x0 > 60) edgeSign(ctx, true, $t('HATTAR + SMYCKEN'), bottom, lab, vx);
      if (cx + vx.x1 < W - 60) edgeSign(ctx, false, $t('VÄSKOR + HALSBAND'), bottom - (A.worldFolksHere?.().length ? 26 : 0), lab, vx);
    },
    _debug: {
      spot: (id) => {
        const h = spotById(id);
        if (!h) return null;
        const x = (h.r[0] + h.r[2]) / 2, y = (h.r[1] + h.r[3]) / 2;
        const v = visX();
        if (lockedCam === null && (x - cam.x < v.x0 + 10 || x - cam.x > v.x1 - 10)) { peekCam = camClamp(x - (v.x0 + v.x1) / 2); cam.x = peekCam; }
        const b = band();
        if (b.v < H && (y - cam.y < 6 || y - cam.y > b.v - 6)) { peekY = clamp(Math.round(y - b.v / 2), 0, H - b.v); cam.y = peekY; }
        ty = tyNow();
        return { x: x - cam.x, y: y + ty };
      },
      items: () => displays.map((d) => ({ id: d.it.id, slot: d.it.slot, sec: d.sec, kind: d.kind, x: d.x, y: d.y, r: d.r.map(Math.round) })),
      sections: () => SECTIONS.map((s) => ({ ...s, n: itemsForSlot(s.slot).length, shown: displays.filter((d) => d.it.slot === s.slot).length })),
      open: (id) => { const it = itemById(id); if (it) openBuy(A, it, { onBought }); return !!it; },
      openKat: (sec) => openKat(A, { sec, onBought }),
      buy: (id) => { const it = itemById(id); if (!it) return { ok: false, msg: 'okänt id' }; const r = buyIt(g, it); if (r.ok) onBought(it); return r; },
      owns: (id) => owns(g, itemById(id)),
      price: (id) => priceOf(g, itemById(id)),
      state: () => ({
        x: Math.round(walker.px), y: Math.round(walker.py), dir: walker.dir, walking: walker.path.length > 0, money: g.money, cam: Math.round(cam.x), camY: Math.round(cam.y),
        focus: focusSpot()?.id || null, clerk: talkClerk.text(), say: talkMe.text(), bag: me.bagT > t, night: nightNow(),
      }),
      shoppers: () => shoppers.map((s) => ({ x: Math.round(s.w.px), y: Math.round(s.w.py), state: s.state, target: s.target?.it.id || null, trying: s.look !== s.base, say: s.talk.text() })),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); peekCam = null; peekY = null; aim = null; cam.x = camTarget(); cam.y = camYs(); ty = tyNow(); },
      face: (dir) => { walker.dir = dir; },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); peekCam = null; cam.x = camTarget(); },
      cam: () => cam.x,
      // lodräta kameran: y = översta synliga världsraden, ty = skärmförskjutningen, band = synliga skärmrader
      camY: () => ({ y: cam.y, ty, band: band() }),
      hover: (id) => { hoverId = id || null; hoverT = t; },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      walkable: (x, y) => walker.walkable(x, y),
      reach: (id) => { const s = spotById(id); if (!s) return null; const p = walker.findPath(walker.px, walker.py, s.go[0], s.go[1]); const e = p[p.length - 1]; return { n: p.length, end: e ? e.map(Math.round) : null, go: s.go.map(Math.round) }; },
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W, null);
        return c.toDataURL('image/png');
      },
      iconSheet: (scale = 4) => {
        const list = displays.filter((d) => d.kind === 'bag' || d.kind === 'jewel' || d.kind === 'neck' || d.kind === 'wig' || d.kind === 'head').sort((a, b) => a.kind.localeCompare(b.kind));
        const cols = 16, cw = 26, ch = 30, c = mkCanvas(cols * cw * scale, Math.ceil(list.length / cols) * ch * scale), x = c.getContext('2d');
        x.imageSmoothingEnabled = false; x.fillStyle = '#d9cfc2'; x.fillRect(0, 0, c.width, c.height);
        list.forEach((d, i) => x.drawImage(d.img, ((i % cols) * cw + 2) * scale, (Math.floor(i / cols) * ch + 2) * scale, d.img.width * scale, d.img.height * scale));
        return c.toDataURL('image/png');
      },
    },
  };
}

// krok i spårpanelen (väskorna hänger på den)
function hookAt(x, cx, hy) {
  x.fillStyle = '#8a8e9a'; x.fillRect(cx - 1, hy - 2, 3, 2);
  x.fillStyle = '#d8dce6'; x.fillRect(cx, hy - 2, 1, 4); x.fillRect(cx, hy + 1, 2, 1);
}
// liten butikspåse i handen efter ett köp
function carryBag(ctx, x, y, dir, color) {
  if (dir === 'up') return;
  const bx = Math.round(x) + (dir === 'left' ? -9 : dir === 'right' ? 4 : 5), by = Math.round(y) - 17;
  ctx.fillStyle = '#1d1822'; ctx.fillRect(bx - 1, by - 1, 7, 9);
  ctx.fillStyle = css(color); ctx.fillRect(bx, by, 5, 7);
  ctx.fillStyle = css(mix(color, WHITE, 0.35)); ctx.fillRect(bx, by, 5, 1);
  ctx.fillStyle = css(GOLD.base); ctx.fillRect(bx + 2, by + 3, 1, 2);
  ctx.fillStyle = '#1d1822'; ctx.fillRect(bx + 1, by - 3, 1, 2); ctx.fillRect(bx + 3, by - 3, 1, 2); ctx.fillRect(bx + 1, by - 3, 3, 1);
}
// blinkande hörn runt en vara
function brackets(ctx, r, t) {
  const on = Math.floor(t * 4) % 2 === 0, [x0, y0, x1, y1] = r.map(Math.round);
  ctx.fillStyle = on ? '#fff27a' : '#ffffff';
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { ctx.fillRect(Math.min(x, x + dx * 2), y, 3, 1); ctx.fillRect(x, Math.min(y, y + dy * 2), 1, 3); }
}

// prislapparna: skena (valnöt), glashylla, neon och hänglapp
function paintTags(displays, g) {
  const c = mkCanvas(W, H), x = c.getContext('2d');
  // lappar i samma rad får inte krocka: kortare text först, sedan knuffas de isär
  const rows = new Map();
  for (const d of displays) if (d.tag) { const k = d.tag.style + ':' + d.tag.y; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(d); }
  for (const list of rows.values()) {
    list.sort((a, b) => a.tag.x - b.tag.x);
    // plats för ":-" överallt i raden? annars utan på alla (lika lappar i samma rad)
    const room = (d) => Math.min(...list.filter((o) => o !== d).map((o) => Math.abs(o.tag.x - d.tag.x)), 40);
    const full = list.every((d) => tagW(tagStr(g, d.it)) <= room(d) - 1);
    const lab = list.map((d) => { const s = tagStr(g, d.it, !full); return { d, s, w: tagW(s), x0: 0 }; });
    let last = -1e9;
    for (const L of lab) { L.x0 = Math.max(Math.round(L.d.tag.x - L.w / 2), last + 1); last = L.x0 + L.w; }
    for (const L of lab) {
      const { style, y } = L.d.tag, own = owns(g, L.d.it), rea = !own && isRea(g, L.d.it);
      const bg = own ? '#45b964' : style === 'neon' ? '#18161e' : '#fbf6ea';
      const fg = own ? '#ffffff' : rea ? '#d83a4a' : style === 'neon' ? '#b8fff4' : '#3a2a10';
      if (style === 'hang') { const f = L.d.tag.from ?? y - 1; x.fillStyle = '#6d6570'; x.fillRect(Math.round(L.d.tag.x), f, 1, Math.max(1, y - f)); }
      const ih = 6;
      x.fillStyle = style === 'neon' ? '#3fe0d0' : '#17151a'; x.fillRect(L.x0 - 1, y - 1, L.w + 2, ih + 2);
      x.fillStyle = bg; x.fillRect(L.x0, y, L.w, ih);
      if (!own && style === 'rail') { x.fillStyle = '#e8c050'; x.fillRect(L.x0, y, 1, ih); }
      ctxText(x, SMALL, L.s, L.x0 + 2, y + ih - 5, fg);
    }
  }
  return c;
}

// namnskylten för det man står vid / pekar på
function bigLabel(ctx, spot, g, t, y0) {
  const d = spot.disp;
  let name, price = null, hint, own = false;
  if (d) {
    own = owns(g, d.it);
    name = safeTxt(d.it.name);
    price = own ? $t('DIN!') : $t`${priceOf(g, d.it)} KR`;
    hint = own ? $t('KLICKA SÅ TAR DU PÅ DIG DEN') : $t('KLICKA SÅ PROVAR DU DEN PÅ DIG');
  } else { name = spot.label || ''; hint = $t('KLICKA'); }
  if (!name) return;
  const nw = textW(BIG, name), pw = price ? textW(BIG, price) : 0, hw = textW(SMALL, hint);
  const w = Math.max(nw + (price ? pw + 10 : 0) + 20, hw + 20), h = 22, x0 = Math.round((VW - w) / 2);
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = css(GOLD.base); ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = css(PLUM.dk); ctx.fillRect(x0, y0, w, h);
  // liten guldpil/diamant
  ctx.fillStyle = css(GOLD.hi); ctx.fillRect(x0 + 5, y0 + 5, 3, 3); ctx.fillRect(x0 + 6, y0 + 4, 1, 5); ctx.fillRect(x0 + 4, y0 + 6, 5, 1);
  ctxText(ctx, BIG, name, x0 + 12, y0 + 3, '#ffffff');
  if (price) ctxText(ctx, BIG, price, x0 + 18 + nw, y0 + 3, own ? '#6fe08a' : d && isRea(g, d.it) ? '#ff8a80' : '#f0d048');
  ctxText(ctx, SMALL, hint, x0 + 12, y0 + 14, Math.floor(t * 2) % 2 === 0 ? '#f2a0d0' : '#c9c2d2');
  return [x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2];
}
// lab = namnskyltens ruta [x0, y0, x1, y1] (eller null) – pilskylten ritas inte under den.
// vx = de synliga kolumnerna { x0, x1 } (fyll-läget kan beskära kanterna).
function edgeSign(ctx, left, lbl, bottom, lab = null, vx = { x0: 0, x1: VW }) {
  const w = textW(SMALL, lbl) + 14, y = bottom - 15, x = left ? vx.x0 + 3 : vx.x1 - 3 - w;
  if (lab && x - 1 < lab[2] && x + w + 1 > lab[0] && y - 1 < lab[3] && y + 11 > lab[1]) return;
  ctx.fillStyle = css(GOLD.base); ctx.fillRect(x - 1, y - 1, w + 2, 12);
  ctx.fillStyle = css(PLUM.dk); ctx.fillRect(x, y, w, 10);
  ctxText(ctx, SMALL, lbl, x + (left ? 9 : 4), y + 3, css(GOLD.hi));
  ctx.fillStyle = css(GOLD.hi);
  const ax = left ? x + 3 : x + w - 5;
  for (let j = -2; j <= 2; j++) ctx.fillRect(ax + (left ? Math.abs(j) : 2 - Math.abs(j)), y + 5 + j, 1, 1);
}

// ======================= dialogerna =======================
const SWATCHES = ['#f28bb3', '#ff7a6b', '#d9433b', '#e07a2e', '#f0b429', '#9fd356', '#46a35a', '#2aa39a', '#7fb8e8', '#3a7bd5', '#2d3a5c', '#8e5bd1', '#b9a3e8', '#b83d7a', '#6b4a33', '#f4f1ea', '#1d1d22'];
const DIRS = ['down', 'left', 'up', 'right'];
const DIR_NAMES = [$t('Framifrån'), $t('Från sidan'), $t('Bakifrån'), $t('Från sidan')];
const FIELD_OF = { hat: 'cap', bag: 'bagColor', phones: 'phoneColor', neck: 'neckColor', hairAcc: 'accent' };
const AGAINST = { hat: $t('ditt hår'), phones: $t('ditt hår'), hairAcc: $t('ditt hår'), bag: $t('dina kläder'), neck: $t('din tröja') };

const figPx = (look, dir) => {
  const c = mkCanvas(28, 44), x = c.getContext('2d', { willReadFrequently: true });
  drawPerson(x, 14, 41, look, dir, 0);
  return x.getImageData(0, 0, 28, 44).data;
};
const diffPx = (a, b) => { let n = 0; for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) n++; return n; };
// Syns färgen på just den här varan? (t.ex. pärlhalsbandet är alltid vitt) – räknas en gång
const FIELD_CACHE = new Map();
function colorFieldOf(it) {
  if (FIELD_CACHE.has(it.id)) return FIELD_CACHE.get(it.id);
  const f = FIELD_OF[it.slot] || null;
  let res = null;
  if (f) {
    try {
      const base = lookForItem(it, { ...FORM, style: 'short', hair: '#3b2619' });
      for (const dir of ['down', 'up', 'right']) if (diffPx(figPx({ ...base, [f]: '#d9433b' }, dir), figPx({ ...base, [f]: '#3a7bd5' }, dir)) > 0) { res = f; break; }
    } catch { res = null; }
  }
  FIELD_CACHE.set(it.id, res);
  return res;
}
// Från vilket håll syns varan bäst på DIN figur? (framifrån vinner vid ungefär lika)
function bestDir(now, withIt) {
  try {
    const s = DIRS.map((dir, i) => diffPx(figPx(now, dir), figPx(withIt, dir)) * (i === 0 ? 1.6 : 1));
    return s.indexOf(Math.max(...s));
  } catch { return 0; }
}
function avoidFor(it, L) {
  const hair = L.style === 'bald' ? null : L.hair;
  switch (it.slot) {
    case 'hat': case 'phones': case 'hairAcc': return [[hair, 170], [L.skin, 90]];
    case 'bag': return [[L.shirt, 150], [L.pants, 120]];
    case 'neck': return [[L.shirt, 150], [L.skin, 90]];
    default: return [];
  }
}
function pickColor(cands, avoid) {
  const list = avoid.filter(([c]) => c);
  let best = cands[0], bestScore = -Infinity;
  for (const c of cands) {
    const score = Math.min(Infinity, ...list.map(([x, m]) => cdist(c, x) - m));
    if (score >= 0) return c;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
// Figuren i heltalsskala (hela enhetspixlar) – aldrig suddig. cropR = [x, y, w, h] i 28×44-rutan.
function figure(look, dir, S, cropR = [0, 0, 28, 44]) {
  const src = mkCanvas(28, 44);
  drawPerson(src.getContext('2d'), 14, 41, look, dir, 0);
  const dpr = globalThis.devicePixelRatio || 1, D = Math.max(1, Math.round(S * dpr)), [cx, cy, cw, ch] = cropR;
  const c = mkCanvas(cw * D, ch * D);
  c.style.width = (cw * D / dpr) + 'px'; c.style.height = (ch * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height);
  return c;
}

// Köpdialogen: varan på DIN figur, vrid runt, prova färg, köp / ta på / ta av
function openBuy(A, it, { onBought, back } = {}) {
  const g = A.game, me = A.avatar.look, sec = secOf(it.slot);
  const field = colorFieldOf(it);
  const sug = (field && (it.colors?.[field] || (field === 'accent' ? '#ff5dc8' : null))) || null;
  const sw = field ? [...new Set([sug || SWATCHES[9], ...SWATCHES])] : [];
  let color = field ? pickColor(sw, avoidFor(it, me)) : null;
  const patch = (L) => ({ ...lookForItem(it, L), ...(field ? { [field]: color } : {}) });
  let dirI = bestDir(me, patch(me));
  const turned = dirI !== 0;
  const own = owns(g, it), worn = own && isWorn(it, me), price = priceOf(g, it), short = price - g.money, rea = price < it.price;
  const name = plain(it.name), group = plain($t(groupOf(it)));
  const note = {
    glasses: $t('Bågarna har sin egen färg – just den här modellen.'),
    jewel: entryOf('jewel', it.look.jewel)?.tile === 'torso' ? $t('Sitter på handen eller handleden – vrid figuren så ser du den bäst.') : $t('Smycket har sin egen färg.'),
  }[it.slot] || '';
  const mot = AGAINST[it.slot] || $t('dig');
  const swBtn = (c, on) => `<button class="acb-sw ${on ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="${$t`Färg ${c}`}"></button>`;
  const body = `<style>
    .acb{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
    .acb-l{display:flex;flex-direction:column;gap:6px;align-items:center;flex:none}
    .acb-stage{display:flex;align-items:flex-end;gap:6px;padding:10px 12px 0;border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);
      background:linear-gradient(#f6ecf2 0 70%, #b88ab0 70% 71%, #e3cfe0 71% 100%)}
    .acb-fig{display:flex;flex-direction:column;align-items:center}
    .acb-fig canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
    .acb-fig small{font-size:var(--f1);line-height:1;background:var(--ink);color:#fff;padding:2px 6px 1px;margin-bottom:6px;white-space:nowrap}
    .acb-arrow{font-size:var(--f2);padding-bottom:40px;color:var(--ink)}
    .acb-turn{display:flex;gap:6px;align-items:center}
    .acb-view{font-size:var(--f2);min-width:92px;text-align:center}
    .acb-r{flex:1;min-width:230px;display:flex;flex-direction:column;gap:8px}
    .acb-dept{font-size:var(--f1);color:var(--muted);margin:0}
    .acb-price{font-size:var(--f3);margin:0;line-height:1}
    .acb-money{font-size:var(--f2);margin:0}
    .acb-sws{display:flex;flex-wrap:wrap;gap:6px}
    .acb-sw{width:28px;height:28px;padding:0;border:3px solid var(--ink);background:var(--c);cursor:pointer;box-shadow:2px 2px 0 var(--ink)}
    .acb-sw.on{outline:3px solid #ffd23f;outline-offset:1px;transform:translate(-1px,-1px)}
    .acb-hint{font-size:var(--f2);line-height:1.1;color:var(--muted);margin:0}
    .acb-wear{font-size:var(--f2);display:flex;gap:8px;align-items:center;cursor:pointer}
    .acb-wear input{width:20px;height:20px}
  </style>
  <div class="acb">
    <div class="acb-l">
      <div class="acb-stage">
        <div class="acb-fig" data-fig="now"><i></i><small>${$t('Du nu')}</small></div>
        <div class="acb-arrow">➜</div>
        <div class="acb-fig" data-fig="new"><i></i><small>${worn ? $t`Utan ${esc(name.toLowerCase())}` : $t`Med ${esc(name.toLowerCase())}`}</small></div>
      </div>
      <div class="acb-turn">
        <button class="btn btn-small" data-turn="-1" aria-label="${$t('Vrid åt vänster')}">${$t('⟲ Vrid')}</button>
        <b class="acb-view" data-view>${DIR_NAMES[dirI]}</b>
        <button class="btn btn-small" data-turn="1" aria-label="${$t('Vrid åt höger')}">${$t('Vrid ⟳')}</button>
      </div>
    </div>
    <div class="acb-r">
      <p class="acb-dept">${esc(sec.title)}${group ? ' · ' + esc(group) : ''}</p>
      <p class="acb-price">${own ? `<b class="ok">${$t('✓ Den här är din!')}</b>` : `${$t('Pris:')} <b>${rea ? `<s>${fmt(it.price)}</s> ` : ''}${fmt(price)}</b>${rea ? ` <b class="bad">${$t('REA')}</b>` : ''}`}</p>
      <p class="acb-money">${$t`💰 Du har <b>${fmt(g.money)}</b>`}${own ? '' : short > 0 ? ` · <b class="bad">${$t`du saknar ${fmt(short)}`}</b>` : ` · ${$t`kvar efter köpet: <b>${fmt(g.money - price)}</b>`}`}</p>
      ${field && !worn ? `<div><b style="font-size:var(--f2)">${$t('Prova färg:')}</b></div>
      <div class="acb-sws" data-sws>${sw.map((c) => swBtn(c, c === color)).join('')}</div>
      ${sug && color !== sug ? `<p class="acb-hint">${$t`👀 Första rutan är skyltdockans färg – vi valde en som syns mot ${mot}.`}</p>` : ''}
      <p class="acb-hint">${$t('🎨 Färgerna här är bara för att prova – när den är din väljer du fritt i garderoben där hemma.')}</p>` : ''}
      ${note ? `<p class="acb-hint">${note}</p>` : ''}
      ${turned ? `<p class="acb-hint">${$t`🔄 ${esc(name)} syns bäst ${DIR_NAMES[dirI].toLowerCase()} på dig.`}</p>` : ''}
      ${own ? '' : `<label class="acb-wear"><input type="checkbox" data-wear checked> ${$t('Ta på mig den direkt')}</label>`}
    </div>
  </div>`;
  const icon = it.icon || sec.icon;
  const newLook = () => (worn ? lookWithoutSlot(it.slot, A.avatar.look) : patch(A.avatar.look));
  const wear = () => { A.avatar = saveAvatar({ ...A.avatar, look: newLook() }); };
  const leave = () => { closeModal(); back?.(); };
  const dlg = openModal(`${icon} ${esc(name)}`, body, [
    { label: back ? $t('← Tillbaka') : $t('Stäng'), onClick: leave },
    own
      ? worn
        ? { label: $t('🧺 Ta av mig den'), cls: 'btn-go', onClick: () => { wear(); play('click'); toast(`${icon} ${$t`Du tog av dig ${name.toLowerCase()}.`}`, 'good'); leave(); } }
        : { label: $t('✨ Ta på mig den'), cls: 'btn-go', onClick: () => { wear(); play('ok'); toast(`${icon} ${$t`Snyggt! Du har ${name.toLowerCase()} på dig.`}`, 'good'); closeModal(); } }
      : { label: $t`🛍️ Köp (${fmt(price)})`, cls: 'btn-go', disabled: short > 0, onClick: () => {
        const wearIt = dlg.querySelector('[data-wear]')?.checked;
        const r = buyIt(g, it);
        if (!r?.ok) { toast(r?.msg || $t('Köpet gick inte igenom.'), 'bad'); play('fel'); return; }
        play('buy');
        if (wearIt) wear();
        toast(`${icon} ${wearIt ? $t`${name} är din! Du har den på dig.` : $t`${name} är din! Den ligger i garderoben där hemma.`}`, 'good');
        closeModal();
        onBought?.(it);
      } },
  ]);
  const big = window.innerHeight >= 620 && window.innerWidth >= 560 ? 5 : 4;
  const render = () => {
    const dir = DIRS[dirI], now = A.avatar.look;
    dlg.querySelector('[data-fig="now"] i').replaceChildren(figure(now, dir, 2));
    dlg.querySelector('[data-fig="new"] i').replaceChildren(figure(newLook(), dir, big));
    dlg.querySelector('[data-view]').textContent = DIR_NAMES[dirI];
  };
  dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { dirI = (dirI + +b.dataset.turn + 4) % 4; play('click'); render(); }));
  dlg.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    dlg.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
    play('click'); render();
  }));
  render();
  return dlg;
}

// Hela sortimentet för en avdelning (eller en lista id) som ett rutnät med dig själv i varje ruta
const KAT_CROP = { head: [2, 0, 24, 24], torso: [2, 14, 24, 24], hands: [2, 14, 24, 28], full: [2, 0, 24, 44] };
function katCropOf(it) {
  if (['hat', 'glasses', 'hairAcc', 'phones'].includes(it.slot)) return 'head';
  if (it.slot === 'neck') return 'torso';
  if (it.slot === 'jewel') return entryOf('jewel', it.look.jewel)?.tile === 'torso' ? 'hands' : 'head';
  return 'full';
}
function openKat(A, { sec, ids, title, onBought } = {}) {
  const g = A.game, S = sec ? SECTIONS.find((s) => s.id === sec) : null;
  const list = ids ? ids.map(itemById).filter(Boolean) : S ? itemsForSlot(S.slot) : [];
  if (!list.length) return null;
  const me = A.avatar.look;
  const groups = new Map();
  for (const it of list) { const k = ids ? '' : plain($t(groupOf(it))); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const nOwn = list.filter((it) => owns(g, it)).length;
  const tile = (it) => {
    const own = owns(g, it), p = priceOf(g, it);
    return `<button class="ack-t ${own ? 'own' : p > g.money ? 'dyr' : ''}" data-id="${esc(it.id)}" title="${esc(plain(it.name))}">
      <i data-fig="${esc(it.id)}"></i><b>${esc(plain(it.name))}</b><small>${own ? $t('✓ Din') : (p < it.price ? '🔥 ' : '') + fmt(p)}</small></button>`;
  };
  const body = `<style>
    .ack-top{font-size:var(--f2);margin:0 0 6px}
    .ack-g{font-size:var(--f2);margin:10px 0 4px;color:var(--muted)}
    .ack-grid{display:flex;flex-wrap:wrap;gap:6px}
    .ack-t{width:92px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px 3px;border:3px solid var(--ink);background:#fbf3f8;cursor:pointer;box-shadow:2px 2px 0 var(--ink);font:inherit}
    .ack-t i{display:flex;align-items:flex-end;justify-content:center;min-height:48px;background:linear-gradient(#f6ecf2 0 78%, #e3cfe0 78%);width:100%}
    .ack-t canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
    .ack-t b{font-size:var(--f1);line-height:1;text-align:center;min-height:28px;display:flex;align-items:center}
    .ack-t small{font-size:var(--f1);line-height:1}
    .ack-t.own{background:#e2f6e6}.ack-t.own small{color:#2f8f46;font-weight:bold}
    .ack-t.dyr small{color:#b83d3d}
  </style>
  <p class="ack-top">${$t`💰 Du har <b>${fmt(g.money)}</b> · du äger <b>${nOwn}</b> av ${list.length}. Klicka så provar du på dig.`}</p>
  ${[...groups].map(([k, its]) => `${k ? `<p class="ack-g">${esc(k)}</p>` : ''}<div class="ack-grid">${its.map(tile).join('')}</div>`).join('')}`;
  const dlg = openModal(title || `${S.icon} ${esc(S.title)}`, body, [{ label: $t('Stäng'), cls: 'btn-go', onClick: closeModal }]);
  dlg.querySelectorAll('[data-fig]').forEach((el) => {
    const it = itemById(el.dataset.fig);
    if (!it) return;
    const look = { ...lookForItem(it, me, { colors: true }) };
    const kind = katCropOf(it);
    const dir = kind === 'full' || it.slot === 'jewel' ? DIRS[bestDir(me, look)] : 'down';
    el.replaceChildren(figure(look, dir, 2, KAT_CROP[kind]));
  });
  dlg.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
    const it = itemById(b.dataset.id);
    if (!it) return;
    play('click');
    closeModal();
    openBuy(A, it, { onBought, back: () => openKat(A, { sec, ids, title, onBought }) });
  }));
  return dlg;
}
