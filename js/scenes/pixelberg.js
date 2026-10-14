// 🎡 PIXELBERG – tivolit på berget (kartan, marken och byggnaderna: js/pixelberg/karta.js). Hit kommer man med
// BERGBUSSEN från vilken busshållplats som helst i staden (city.js: raden "🎡 PIXELBERG" i hållplatsdialogen) och
// hem igen från bergbussens hållplats här uppe.
//
//   • 🎟️ BILJETTLUCKAN: åkband för hela dagen (100 kr) – annars kostar varje tur en kupong (20 kr)
//   • 🎠 KARUSELLEN: hästarna snurrar och guppar; man sitter själv på en häst två varv
//   • 🎡 PARISERHJULET: ett varv i en gondol – kameran följer med upp, och högst upp syns hela Pixelstaden
//   • 🍭 SOCKERVADD & POPCORN och 🎰 LYCKOHJULET (vinster: kortpaket, pengar, godis – eller en nitlott)
//   • 🎢 BERG-OCH-DALBANAN (Carl 2026-10-13: "man ska kunna åka berg-och-dalbanan med en kompis"): tåget går på
//     KLOCKAN – var 32:a sekund, 10 s vid stationen och 21 s ute på banan – så alla spelare ser samma tåg på samma
//     ställe. Man kliver på vid stationen (är tåget ute ställer man sig först i kön till nästa); kliver en kompis på
//     samma tåg sitter ni ihop (världen skickar 'bana:<avgång>:<plats>', js/net/world.js) – ni ser varandra i
//     vagnarna med namnlapp, armarna åker upp i nedförsbackarna. Tre vagnar × två platser; lediga platser fylls av
//     besökare.
//   • 🚗 RADIOBILARNA (v0.126): en runda på 45 s – man kör själv med piltangenterna/WASD (på pekskärm: en dra-styrspak)
//     och krockar med besökarnas bilar och med kompisarnas (världen skickar 'radio:<färg>' och bilens x/y). Varje
//     spelare räknar sina egna studsar; en kompis bil studsar hos kompisen.
//   • 👻 SPÖKHUSET (v0.127): spöktåget går på klockan som berg-och-dalbanan (js/pixelberg/spokhus.js) – två platser i
//     vagnen ('spok:<avgång>:<plats>'), så man åker med en kompis och ser samma spöken samtidigt. Inne i huset ritas
//     korridoren över hela skärmen.
//   • 🥫 BURKTORNET och 🎯 SKJUTBANAN (v0.128, js/pixelberg/stand.js): vinsterna är leksaker till leksakslådan hemma.
// Besökare med ballonger, björnmaskoten Pixel-Nalle som vinkar, och på kvällen tänds glödlamporna överallt.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, folkTapAt, createSpeech, WALK_SEQ, nameTag } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW, hash } from '../core/floor-pix.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { BUS_STOPS } from '../city/map.js';
import { laggTill, draPaket } from '../core/pixelkort.js';
import { TW, TH, P, HALLPLATS, PORT, BILJETT, KARUSELL, HJUL, STAND, BANA, RADIO, RADIO_H, BANKAR, LYKTOR, BUSKAR, SPAR, hinder, paintGround, utsiktCanvas, biljettBild, UTESERVERING, stationBild, banaBild, portBild, radioBild } from '../pixelberg/karta.js';
import { SPOK, SPOK_H, SPOK_SPAR, SPOK_VINDSFONSTER, spokBild } from '../pixelberg/karta.js';
import { openKast, openSkjut } from '../pixelberg/stand.js';
import { standBilder, put as putKiosk, ritaLampor, ritaSken } from '../pixelberg/kiosk.js';   // 🎪 stånden i full prakt (v0.131)
import { knippe, enBallong, vimpelband, glodlampa, jonglerar, BALLONG_FARG } from '../pixelberg/liv.js';   // 🎈 livet: ballonger, vimpelband, slingor, jonglören
import { STALL, MARKNAD_Y, DEKO, stallBilder, putS } from '../pixelberg/marknad.js';   // 🏮 marknadsgatan – ministaden (v0.132)
import { ritaPortal, ritaTekopparGolv, ritaKopp, koppPos, ritaFontan, ritaBubblor, ritaKonfetti, ritaFlagga, ritaTivolilykta } from '../pixelberg/deko.js';   // 🎉 dekorationerna
import { ENTRE, ritaStaket, ritaStaketstolpe, ritaPort, ritaBusskur, ritaHallplatsskylt, ritaBuss, ritaKarta, ritaCykelstall, ritaPlantering, ritaFontanStor, ritaTopiary } from '../pixelberg/entre.js';   // 🎟️ entrén (v0.135)
import { FASADER, MAINSTREET_Y, ritaFasad, FASAD_PRAT } from '../pixelberg/mainstreet.js';   // 🏪 Main Street – butiksfasaderna innanför entrén
import { ritaMonorail } from '../pixelberg/monorail.js';   // 🚝 Pixelberg Express
import { LADOR, LADOR_Y, ritaLada, pumpaSken } from '../pixelberg/lador.js';   // 🪴 blomlådorna längs promenaden (v0.136)
import { ritaIHand, TUGGOR, TUGGTID } from '../pixelberg/ihand.js';   // 🧇 maten i handen (v0.136)
import { openSpelarkort } from '../core/vannerapp.js';   // 💛 spelarkortet: bli vänner med den man står bredvid (v0.136)
import { TEMAN, ritaOnskebrunn, ritaSvampar, ritaKaktus, ritaVagn, ritaDottTrad, ritaGravsten, ritaKrypta, ritaKyrkogardsstaket, ritaDimma } from '../pixelberg/teman.js';   // 🎭 temaländerna
import { addToy, toyOf, toyNamn } from '../data/toys.js';   // 🦆 fiskdammens vinster
import { SPOK_CYKEL, SPOK_PASTIG, SPOK_LJUD, spokLage, spokVagn, ritaSpokVagn, ritaSpokInne, ritaSpoktitt, ritaFladdermus } from '../pixelberg/spokhus.js';
import { $t } from '../core/i18n.js';

const SPOKTUR = /^spok:(\d+):([01])$/;
const GANG = 100, KUPONG = 20, BAND = 100, HJULVARV = 26, KARUSELLVARV = 9;
const GONDOLER = 10, HASTAR = 8;
// 🎢 berg-och-dalbanan går på klockan (samma för alla spelare): CYKEL s per avgång, PASTIG s vid stationen, TUR s ute
const CYKEL = 32, PASTIG = 10, TUR = 21, PLATSER = 6, START = 15, VAGNAVSTAND = 6;
const nuS = () => (globalThis.__tivoliNu ?? Date.now()) / 1000;   // (testerna styr klockan)
// tidtabellen längs spåret: kedjan drar sakta upp för första backen, sedan går det fortare ju lägre tåget är
const TID = (() => {
  const n = SPAR.length, t = [0];
  for (let k = 1; k <= n; k++) {
    const a = SPAR[(START + k - 1) % n], b = SPAR[(START + k) % n], ds = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const kedja = b[1] < a[1] - 0.3 && a[0] < 1380;
    t.push(t[k - 1] + ds / (kedja ? 14 : 30 + Math.max(0, b[1] - 96) * 1.4));
  }
  return t.map((x) => x / t[n] * TUR);
})();
const indexVid = (tau) => {
  if (tau <= 0) return 0;
  if (tau >= TUR) return SPAR.length;
  let lo = 0, hi = SPAR.length;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TID[m] <= tau) lo = m; else hi = m; }
  return lo + (tau - TID[lo]) / Math.max(1e-6, TID[hi] - TID[lo]);
};
export function banLage() { const s = nuS(), n = Math.floor(s / CYKEL), u = s - n * CYKEL; return { n, u, station: u < PASTIG, tau: Math.max(0, u - PASTIG), kvar: PASTIG - u }; }
// vagn c (0 = den främsta): punkten på spåret och om den åker nedför
function vagn(c, L) {
  const n = SPAR.length, i = (START + (L.station ? 0 : indexVid(L.tau)) - c * VAGNAVSTAND + n * 4) % n;
  const i0 = Math.floor(i), u = i - i0, a = SPAR[i0], b = SPAR[(i0 + 1) % n];
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ner: !L.station && b[1] > a[1] + 0.25 };
}
const AKTUR = /^bana:(\d+):([0-5])$/;
// 🚗 radiobilarna: en runda RUNDA s, bilens radie, toppfart och gas; åtta lackfärger (världen skickar färgens nummer)
const RUNDA = 45, BIL_R = 9, BIL_MAX = 72, BIL_ACC = 170;
const RFARG = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#d060a0', '#f08a2a', '#9a6ad8', '#2ab8c8'];
const RADIOTUR = /^radio:([0-7])$/;
const RX0 = RADIO.x + 13, RX1 = RADIO.x + RADIO.w - 13, RY0 = RADIO.y + 12, RY1 = RADIO.y + RADIO.h - 9;
const PRAT = [
  $t('Pariserhjulet är bäst – man ser ända bort till bron!'), $t('Jag har åkt karusell fem gånger i dag!'), $t('Sockervadden här är rosa OCH blå!'),
  $t('Vågar du åka berg-och-dalbanan när den öppnar?'), $t('Jag vann ett kortpaket på lyckohjulet!'), $t('På kvällen lyser hela tivolit.'),
  $t('Radiobilarna är roligast – bom bom!'), $t('Spökhuset var inte ALLS läskigt … nästan inte.'), $t('Jag vann en nalle på skjutbanan!'),
];
// 🍦🍭🍿🍔 matstånden (v0.131): vad de säljer – mättnad och glädje per sak
const MAT = {
  glass: [
    { id: 'glass-jordgubb', namn: $t('🍓 Jordgubbsglass'), pris: 25, hunger: 6, glad: 3 }, { id: 'glass-choklad', namn: $t('🍫 Chokladglass'), pris: 25, hunger: 6, glad: 3 },
    { id: 'mjukglass', namn: $t('🍦 Mjukglass med strössel'), pris: 30, hunger: 7, glad: 3 }, { id: 'tva-kulor', namn: $t('🍨 Två kulor'), pris: 40, hunger: 10, glad: 4 },
  ],
  sockervadd: [
    { id: 'sockervadd', namn: $t('🍭 Sockervadd'), pris: 20, hunger: 8, glad: 3 }, { id: 'sockervadd-bla', namn: $t('🍭 Blå sockervadd'), pris: 20, hunger: 8, glad: 3 },
    { id: 'klubba', namn: $t('🍬 Tivoliklubba'), pris: 15, hunger: 3, glad: 2 },
  ],
  popcorn: [
    { id: 'popcorn', namn: $t('🍿 Popcorn'), pris: 25, hunger: 12, glad: 2 }, { id: 'popcorn-stor', namn: $t('🍿 Stor popcorn'), pris: 40, hunger: 20, glad: 3 },
    { id: 'lask', namn: $t('🥤 Läsk'), pris: 15, hunger: 2, glad: 1 },
  ],
  hamburgare: [
    { id: 'hamburgare', namn: $t('🍔 Hamburgare'), pris: 55, hunger: 35, glad: 2 }, { id: 'ostburgare', namn: $t('🧀 Ostburgare'), pris: 65, hunger: 40, glad: 3 },
    { id: 'pommes', namn: $t('🍟 Pommes frites'), pris: 30, hunger: 18, glad: 2 }, { id: 'lask', namn: $t('🥤 Läsk'), pris: 15, hunger: 2, glad: 1 },
  ],
};
// 🏮 marknadsgatans tältstånd (v0.132)
Object.assign(MAT, {
  saft: [{ id: 'hallonsaft', namn: $t('🍹 Hallonsaft'), pris: 15, hunger: 2, glad: 1 }, { id: 'lemonad', namn: $t('🍋 Lemonad'), pris: 20, hunger: 2, glad: 2 }],
  smagodis: [{ id: 'smagodis', namn: $t('🍬 En påse smågodis'), pris: 25, hunger: 6, glad: 3 }, { id: 'godisband', namn: $t('🌈 Sura godisband'), pris: 15, hunger: 3, glad: 2 }],
  vafflor: [{ id: 'vaffla', namn: $t('🧇 Våffla med sylt och grädde'), pris: 35, hunger: 18, glad: 3 }, { id: 'vaffla-glass', namn: $t('🧇 Våffla med glass'), pris: 40, hunger: 20, glad: 4 }],
  churros: [{ id: 'churros', namn: $t('🥖 Churros med kanelsocker'), pris: 30, hunger: 14, glad: 3 }, { id: 'churros-choklad', namn: $t('🍫 Churros med chokladsås'), pris: 38, hunger: 16, glad: 4 }],
  korv: [{ id: 'korv', namn: $t('🌭 Korv med bröd'), pris: 30, hunger: 25, glad: 2 }, { id: 'korv-mos', namn: $t('🌭 Korv med mos'), pris: 45, hunger: 35, glad: 2 }],
});
const MAT_TITEL = { glass: $t('🍦 Glasståndet'), sockervadd: $t('🍭 Sockervadden'), popcorn: $t('🍿 Popcornståndet'), hamburgare: $t('🍔 Hamburgerståndet'),
  saft: $t('🍹 Saftståndet'), smagodis: $t('🍬 Smågodiset'), vafflor: $t('🧇 Våffelståndet'), churros: $t('🥖 Churrosståndet'), korv: $t('🌭 Korvståndet') };
// 🦆 fiskdammens vinster efter ankans nummer
const FISK_VINST = [null, 'nalle-liten', 'nalle-liten', 'badanka', 'badanka', 'badanka', 'klubba', 'klubba', 'klubba', 'klubba'];
// 🐱 Pixel-Katten – tivolits andra maskot (vit och orange, stort huvud, vinkar)
const KATTEN = ['..k........k..', '.kok......kok.', '.kook....koook', '.kwwkkkkkkwwk.', 'kwwwwwwwwwwwwk', 'kwwkpwwwwpkwwk', 'kwwwwwwwwwwwwk', 'kwwwwwnnwwwwwk', '.kwwwkwwkwwwk.', '..kkkkkkkkkk..', '..kooooooook..', '.kooowwwwooook', '.kowwwwwwwwok.', 'kook.wwwww.kook', '....oooooo....', '....oo..oo....', '...koo..ook...', '...kkk..kkk...'];
// lyckohjulets åtta fält (samma ordning som färgerna på hjulet)
const LYCKA = [
  { id: 'paket', namn: $t('🃏 Ett kortpaket!') }, { id: 'niete', namn: $t('Nitlott – försök igen!') }, { id: 'p50', namn: $t('💰 50 kr!') }, { id: 'niete', namn: $t('Nitlott – försök igen!') },
  { id: 'godis', namn: $t('🍬 En tivoliklubba!') }, { id: 'niete', namn: $t('Nitlott – försök igen!') }, { id: 'p20', namn: $t('💰 20 kr!') }, { id: 'godis', namn: $t('🍭 En sockervadd!') },
];
const LYCKA_FARG = ['#e04848', '#f4f1ea', '#3a7bd5', '#f4f1ea', '#46a35a', '#f4f1ea', '#d060a0', '#f4f1ea'];

export function makePixelberg(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.pixelbergFran || null; A.pixelbergFran = null;
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: P.TOP, bottom: P.BOTTOM, spawn: [HALLPLATS.x + 16, ENTRE.STAKET_Y + 26] });
  walker.speed = GANG;
  walker.setObstacles(hinder());
  walker.snapFree();
  walker.dir = 'right';
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  let aka = null;   // pågående åktur: { typ: 'hjul' | 'karusell', t, i (gondolen/hästen) } eller { typ: 'bana', n (avgången), plats }
  let hand = null;   // 🧇 maten i handen: { id, t, bit } – äts upp i TUGGOR tuggor medan man går (ihand.js)
  const sitterIBana = () => aka?.typ === 'bana' && banLage().n === aka.n;
  const spokL = () => spokLage(nuS());
  const sitterISpok = () => aka?.typ === 'spok' && spokL().n === aka.n;
  const iKo = () => (aka?.typ === 'bana' && !sitterIBana()) || (aka?.typ === 'spok' && !sitterISpok());
  const jagPos = () => { if (!aka || (aka.typ === 'bana' && !sitterIBana())) return { x: walker.px, y: walker.py }; if (aka.typ === 'radio') return { x: aka.bil.x, y: aka.bil.y }; if (aka.typ === 'kopp') { const p = koppPos(aka.i, t, DEKO.tekopp.x, DEKO.tekopp.y); return { x: p.x, y: p.y }; } if (aka.typ === 'spok') { const v = spokVagn(spokL()); return { x: v.x, y: v.y - 14 }; } if (aka.typ === 'bana') { const v = vagn(Math.floor(aka.plats / 2), banLage()); return { x: v.x, y: v.y - 14 }; } if (aka.typ === 'hjul') { const p = gondol(aka.i); return { x: p.x, y: p.y + 8 }; } const h = hast(aka.i); return { x: h.x, y: h.y }; };
  // (i radiobilen står kameran still över banan – hela golvet och framkanten syns, bakväggen så långt det räcker)
  const camTarget = () => { if (aka?.typ === 'radio') return { x: Math.max(0, Math.min(TW - VW, RADIO.x + RADIO.w / 2 - VW / 2)), y: Math.max(0, Math.min(TH - VH, RADIO.y + RADIO.h + 14 - VH)) }; const p = jagPos(); return { x: Math.max(0, Math.min(TW - VW, p.x - VW / 2)), y: Math.max(0, Math.min(TH - VH, p.y - VH * (aka?.typ === 'hjul' || sitterIBana() ? 0.5 : aka?.typ === 'radio' ? 0.62 : sitterISpok() ? 0.72 : 0.8))) }; };
  Object.assign(cam, camTarget());
  if (!A.attract && from) { const h = g.glad?.(3, '', 'pixelberg', 3); setTimeout(() => toast(h ? $t`🎡 Välkommen till Pixelbergs tivoli! +${h} 😊` : $t('🎡 Välkommen till Pixelbergs tivoli!'), 'good'), 900); }
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren på Pixelberg startade inte:', e); }

  // ---------- biljetterna ----------
  const harBand = () => g.tivoli?.band === g.day;
  function betala(vad) {
    if (harBand()) return true;
    if (g.money < KUPONG) { toast($t`🎟️ En åkkupong kostar ${fmt(KUPONG)} – du har inte råd. (Eller köp ett åkband i biljettluckan.)`, 'bad'); return false; }
    g.money -= KUPONG; g.save(); play('coin'); toast($t`🎟️ ${vad}: en kupong, ${fmt(KUPONG)}.`);
    return true;
  }

  // ---------- pariserhjulet och karusellen ----------
  const hjulVinkel = () => t * (Math.PI * 2 / HJULVARV);
  const gondol = (i) => { const v = hjulVinkel() + i * (Math.PI * 2 / GONDOLER); return { x: HJUL.x + Math.cos(v) * HJUL.r, y: HJUL.y + Math.sin(v) * HJUL.r + 12, v }; };
  const karVinkel = () => t * (Math.PI * 2 / KARUSELLVARV);
  const hast = (i) => { const v = karVinkel() + i * (Math.PI * 2 / HASTAR); return { x: KARUSELL.x + Math.cos(v) * (KARUSELL.rx - 16), y: KARUSELL.y + Math.sin(v) * (KARUSELL.ry - 6), v, upp: Math.round(Math.sin(t * 3 + i * 1.7) * 2), dir: Math.sin(v) > 0 ? 'left' : 'right' }; };
  // NPC:er i några gondoler och på några hästar
  const gondolFolk = new Map([[1, makeLook()], [4, makeLook()], [7, makeLook()]]);
  const hastFolk = new Map([[0, { ...makeLook(), kid: true }], [3, makeLook()], [5, { ...makeLook(), kid: true }]]);
  function akHjul() {
    if (aka || !betala($t('Pariserhjulet'))) return;
    // närmaste lediga gondol längst ner
    let basta = 0, bastY = -1e9;
    for (let i = 0; i < GONDOLER; i++) { if (gondolFolk.has(i)) continue; const p = gondol(i); if (p.y > bastY) { bastY = p.y; basta = i; } }
    aka = { typ: 'hjul', t: 0, i: basta, toppen: false };
    walker.stop(); play('door');
    toast($t('🎡 Du kliver in i gondolen – håll i dig!'));
  }
  // ☕ tekopparna: en kupong, 14 sekunder i en kopp som snurrar (de andra kopparna har barn i)
  const KOPPFOLK = [null, { ...makeLook(), kid: true }, { ...makeLook(), kid: true }, makeLook()];
  function akKopp() {
    if (aka || !betala($t('Tekopparna'))) return;
    aka = { typ: 'kopp', t: 0, i: 0 };
    walker.stop(); play('fanfare');
    toast($t('☕ Du sätter dig i en tekopp – snurra runt!'), 'good');
  }
  function akKarusell() {
    if (aka || !betala($t('Karusellen'))) return;
    let ledig = 0; for (let i = 0; i < HASTAR; i++) if (!hastFolk.has(i)) { ledig = i; break; }
    aka = { typ: 'karusell', t: 0, i: ledig };
    walker.stop(); play('fanfare');
    toast($t('🎠 Håll i dig! Tryck var som helst när du vill hoppa av.'), 'good');
  }
  // 🎢 vem sitter var i tåget för avgången L.n: jag, kompisarna (world.js ak) och påhittade besökare på några lediga platser
  const NPC_BANA = [0, 1, 2, 3, 4, 5, 6, 7].map(() => makeLook());
  function aakare(L) {
    const p = new Array(PLATSER).fill(null);
    if (aka?.typ === 'bana' && aka.n === L.n) p[aka.plats] = { jag: true, look: A.avatar.look, namn: A.avatar.name };
    for (const f of worldFolksHere(A)) { const m = AKTUR.exec(f.ak || ''); if (m && +m[1] === L.n && !p[+m[2]]) p[+m[2]] = { look: f.av.look, namn: f.av.name, av: f.av }; }
    for (let i = 0; i < PLATSER; i++) if (!p[i] && hash(L.n, i, 61) < 0.4) p[i] = { look: NPC_BANA[(L.n + i) % NPC_BANA.length], npc: true };
    return p;
  }
  // kliv på vid stationen (står tåget inne – är det ute ställer man sig i kön till nästa)
  function akBana() {
    if (aka) return;
    const L = banLage(), n = L.station && L.u < PASTIG - 1.5 ? L.n : L.n + 1;
    if (!betala($t('Berg-och-dalbanan'))) return;
    const tagna = new Set(worldFolksHere(A).map((f) => AKTUR.exec(f.ak || '')).filter((m) => m && +m[1] === n).map((m) => +m[2]));
    let plats = 0; while (plats < PLATSER - 1 && tagna.has(plats)) plats += 1;
    aka = { typ: 'bana', n, plats, ihop: new Set(), skrek: false };
    walker.stop(); walker.px = BANA.station.x + 40; walker.py = BANA.station.y + 10; walker.dir = 'up';
    if (n === L.n) { play('door'); toast($t`🎢 Du sätter dig i vagn ${Math.floor(plats / 2) + 1} – tåget går om ${Math.max(1, Math.ceil(L.kvar))} sekunder!`, 'good'); }
    else toast($t`🎢 Tåget är ute på banan – du ställer dig först i kön. Nästa tåg går om ${Math.max(1, Math.ceil(CYKEL - L.u))} sekunder.`, 'good');
  }
  // 👻 spöktåget: vem sitter i vagnen för avgången L.n (två platser) – jag, kompisarna och ibland en besökare
  const NPC_SPOK = [0, 1, 2, 3].map((i) => (i % 2 ? { ...makeLook(), kid: true } : makeLook()));
  function spokAkare(L) {
    const p = [null, null];
    if (aka?.typ === 'spok' && aka.n === L.n) p[aka.plats] = { jag: true, look: A.avatar.look, namn: A.avatar.name };
    for (const f of worldFolksHere(A)) { const m = SPOKTUR.exec(f.ak || ''); if (m && +m[1] === L.n && !p[+m[2]]) p[+m[2]] = { look: f.av.look, namn: f.av.name, av: f.av }; }
    for (let i = 0; i < 2; i++) if (!p[i] && hash(L.n, i, 62) < 0.35) p[i] = { look: NPC_SPOK[(L.n + i) % NPC_SPOK.length], npc: true };
    return p;
  }
  function akSpok() {
    if (aka) return;
    const L = spokL(), tagna = (n) => new Set(worldFolksHere(A).map((f) => SPOKTUR.exec(f.ak || '')).filter((m) => m && +m[1] === n).map((m) => +m[2]));
    let n = L.station && L.u < SPOK_PASTIG - 1.5 ? L.n : L.n + 1;
    if (tagna(n).size >= 2) n += 1;   // (två kompisar sitter redan där – ta nästa vagn)
    if (!betala($t('Spökhuset'))) return;
    const t0 = tagna(n), plats = t0.has(0) ? 1 : 0;
    aka = { typ: 'spok', n, plats, ihop: new Set(), ljudI: -1 };
    walker.stop(); walker.px = SPOK_SPAR.cx + (plats ? 14 : -14); walker.py = SPOK_SPAR.y1 + 12; walker.dir = 'up';
    if (n === L.n) { play('door'); toast($t`👻 Du sätter dig i spökvagnen – den går om ${Math.max(1, Math.ceil(L.kvar))} sekunder!`, 'good'); }
    else toast($t`👻 Vagnen är inne i huset – du ställer dig först i kön. Nästa vagn går om ${Math.max(1, Math.ceil(SPOK_CYKEL * (n - L.n) - L.u))} sekunder.`, 'good');
  }
  function avAka() {
    const typ = aka.typ, krockar = aka.krockar || 0;
    aka = null;
    if (typ === 'hjul') { walker.px = HJUL.x; walker.py = HJUL.fot + 12; const h = g.glad?.(4, '', 'pariserhjul', 4) || 0; toast(h ? $t`🎡 Vilken utsikt! +${h} 😊` : $t('🎡 Vilken utsikt!'), 'good'); }
    else if (typ === 'bana') { walker.px = BANA.station.x + 70; walker.py = BANA.station.y + 12; const h = g.glad?.(5, '', 'bana', 5) || 0; toast(h ? $t`🎢 Wow, vilken fart! +${h} 😊` : $t('🎢 Wow, vilken fart!'), 'good'); }
    else if (typ === 'kopp') { walker.px = DEKO.tekopp.x; walker.py = DEKO.tekopp.y + 16; const h = g.glad?.(3, '', 'tekopp', 3) || 0; toast(h ? $t`☕ Snurrigt! +${h} 😊` : $t('☕ Snurrigt!'), 'good'); }
    else if (typ === 'spok') { walker.px = SPOK_SPAR.cx; walker.py = SPOK_SPAR.y1 + 16; const h = g.glad?.(4, '', 'spokhus', 4) || 0; toast(h ? $t`👻 Puh! Du tog dig ut ur spökhuset! +${h} 😊` : $t('👻 Puh! Du tog dig ut ur spökhuset!'), 'good'); }
    else if (typ === 'radio') {
      walker.px = RADIO.x + RADIO.w / 2; walker.py = RADIO.y + RADIO.h + 12; tangent.clear(); spak = null;
      const n = krockar, h = n ? g.glad?.(4, '', 'radiobil', 4) || 0 : 0;
      toast(!n ? $t('🚗 En lugn runda – inga krockar alls!') : h ? $t`🚗 Bom bom! Krockar: ${n}. +${h} 😊` : $t`🚗 Bom bom! Krockar: ${n}.`, 'good');
    }
    else { walker.px = KARUSELL.x; walker.py = KARUSELL.y + KARUSELL.ry + 10; const h = g.glad?.(3, '', 'karusell', 3) || 0; toast(h ? $t`🎠 Wiii! +${h} 😊` : $t('🎠 Wiii!'), 'good'); }
    walker.stop(); walker.snapFree(); walker.dir = 'down';
    g.passTime?.(10); g.save();
  }

  // ---------- besökarna och maskoten ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  // (besökarna går i den främre halvan av torget – borden, köerna och karusellen ligger bakom – några i östra delen)
  // (besökarna går i ministadens gator: gången bakom tältstånden eller promenaden framför – samma gata hela tiden,
  // så att ingen går rakt igenom ett stånd; några håller till i östra delen)
  const mal = (o) => (o?.plats ? { x: rnd(30, 300), y: rnd(250, 372) } : o?.ost ? { x: rnd(1730, 2540), y: rnd(432, LADOR_Y - 16) } : o?.bak ? { x: rnd(380, 1740), y: rnd(MARKNAD_Y - 42, MARKNAD_Y - 20) } : { x: rnd(350, 1760), y: rnd(MARKNAD_Y + 12, LADOR_Y - 16) });   // (ovanför lådraden längs framkanten)   // (väster om banorna – besökarna går raka vägar)
  const BALLONG = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#d060a0'];
  const besok = Array.from({ length: 20 }, (_, i) => i).map((i) => { const m = mal({ ost: i >= 16, bak: i % 3 === 1 && i < 16, plats: i === 2 || i === 5 || i === 8 }); return { ost: i >= 16, bak: i % 3 === 1 && i < 16, plats: i === 2 || i === 5 || i === 8, look: i % 3 === 0 ? { ...makeLook(), kid: true } : makeLook(), x: m.x, y: m.y, tx: m.x, ty: m.y, dir: 'right', vila: rnd(0, 3), ballong: i % 2 === 0 ? BALLONG[i % BALLONG.length] : null, rad: PRAT[i % PRAT.length] }; });
  const nalle = { x: 700, y: 400, tx: 700, ty: 400, dir: 'right', vila: 2, vinkar: 0 };
  function updLiv(dt) {
    for (const o of [...besok, nalle]) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy), step = 22 * dt;
      if (d <= step) { o.x = o.tx; o.y = o.ty; o.vila = rnd(2, 6); const m = mal(o); o.tx = m.x; o.ty = m.y; if (o === nalle) nalle.vinkar = 2; continue; }
      o.x += dx / d * step; o.y += dy / d * step; o.dir = dx < 0 ? 'left' : 'right';
    }
    if (nalle.vinkar > 0) nalle.vinkar -= dt;
  }

  // ---------- 🎈 livet (v0.131): köerna vid matstånden, de som äter vid borden, jonglören och ballongförsäljaren ----------
  const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const LR = lcg(9091);
  const KOFOLK = STAND.filter((s) => s.mat).flatMap((s) => [0, 1].map((k) => ({ s, k, look: LR() < 0.35 ? { ...makeLook(LR), kid: true } : makeLook(LR) })));
  const ATARE = UTESERVERING.flatMap((u, i) => [-1, 1].filter((side, j) => (i + j) % 3 !== 2).map((side) => ({ x: u.x + side * 9, y: u.y - 1, dir: side < 0 ? 'right' : 'left', look: LR() < 0.3 ? { ...makeLook(LR), kid: true } : makeLook(LR) })));
  const JONGLOR = { x: 262, y: 332, look: makeLook(LR) };   // (på entréplatsen, höger om fontänen)
  const BALLONGIS = { x: 620, y: 384, tx: 900, dir: 'right', vila: 0, look: makeLook(LR) };
  function updBallongis(dt) {
    const o = BALLONGIS;
    if (o.vila > 0) { o.vila -= dt; return; }
    const dx = o.tx - o.x, step = 12 * dt;
    if (Math.abs(dx) <= step) { o.x = o.tx; o.vila = rnd(4, 9); o.tx = o.x > 900 ? rnd(560, 760) : rnd(1000, 1220); return; }
    o.x += Math.sign(dx) * step; o.dir = dx < 0 ? 'left' : 'right';
  }
  const ballongisAt = (x, y) => Math.abs(BALLONGIS.x - x) < 9 && y < BALLONGIS.y + 2 && y > BALLONGIS.y - 60;
  const jonglorAt = (x, y) => Math.abs(JONGLOR.x - x) < 9 && y < JONGLOR.y + 2 && y > JONGLOR.y - 34;
  const minBallong = () => (g.tivoli?.ballong?.dag === g.day ? BALLONG_FARG[(g.tivoli.ballong.f | 0) % BALLONG_FARG.length] : null);
  function kopBallong() {
    play('click');
    openModal($t('🎈 Ballongförsäljaren'), `<p style="font-size:var(--f2);margin-top:0">${$t`En ballong kostar ${fmt(15)}. Den följer med dig på tivolit hela dagen!`}</p>`, [
      { label: $t`🎈 Köp en ballong · ${fmt(15)}`, cls: 'btn-go', disabled: g.money < 15, onClick: () => {
        if (g.money < 15) return;
        g.money -= 15; g.tivoli = { ...(g.tivoli || {}), ballong: { dag: g.day, f: Math.floor(Math.random() * BALLONG_FARG.length) } };
        const h = g.glad?.(2, '', 'tivoli-ballong', 2) || 0;
        g.save(); closeModal(); play('buy'); toast(h ? $t`🎈 En ballong! +${h} 😊` : $t('🎈 En ballong!'), 'good');
      } },
      { label: $t('Nej tack'), onClick: closeModal },
    ]);
  }
  // 🤡 clownerna och 🐱 Pixel-Katten på promenaden: delar ut ballonger (till barnen – och till en själv)
  const CLOWNLOOK = (hair, shirt, pants) => ({ skin: '#f6d7bf', style: 'clown', hair, marks: 'clown', nose: 'clown', hat: 'party', cap: '#3a7bd5', top: 'tee', topPrint: 'dots', shirt, accent: '#f4f1ea', bottom: 'pants', pants, shoeType: 'clownShoes', shoes: '#c9323a', shoes2: '#f0b429' });
  const CLOWNER = [
    { x: 520, y: 446, tx: 1000, dir: 'right', vila: 0, look: CLOWNLOOK('#e04848', '#f0c030', '#3a7bd5'), fro: 1 },
    { x: 1500, y: 440, tx: 1100, dir: 'left', vila: 1, look: CLOWNLOOK('#3a7bd5', '#46a35a', '#d060a0'), fro: 4 },
    { x: 2100, y: 448, tx: 2350, dir: 'right', vila: 2, katt: true, fro: 6 },
  ];
  function updClowner(dt) {
    for (const c of CLOWNER) {
      if (c.vila > 0) { c.vila -= dt; continue; }
      const dx = c.tx - c.x, step = 16 * dt;
      if (Math.abs(dx) <= step) { c.x = c.tx; c.vila = rnd(3, 7); c.tx = c.katt ? rnd(2080, 2540) : rnd(360, 1760); continue; }
      c.x += Math.sign(dx) * step; c.dir = dx < 0 ? 'left' : 'right';
      // ett barn utan ballong i närheten får en
      for (const o of besok) if (!o.ballong && o.look.kid && Math.abs(o.x - c.x) < 18 && Math.abs(o.y - c.y) < 16) { o.ballong = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#d060a0'][(c.fro + Math.floor(t)) % 5]; c.vila = 1.5; talk.say($t('Varsågod! 🎈'), () => ({ x: c.x, y: c.y - 40 }), 2, { silent: true }); break; }
    }
  }
  const clownAt = (x, y) => CLOWNER.find((c) => Math.abs(c.x - x) < 9 && y < c.y + 2 && y > c.y - 60);
  function fanBallong(c) {
    const f = Math.floor(Math.random() * BALLONG_FARG.length);
    g.tivoli = { ...(g.tivoli || {}), ballong: { dag: g.day, f } };
    const h = g.glad?.(2, '', 'tivoli-ballong', 2) || 0;
    g.save(); play('ok'); c.vila = 3;
    talk.say(c.katt ? $t('*Pixel-Katten ger dig en ballong och spinner!*') : $t('Varsågod, en ballong till dig! 🎈'), () => ({ x: c.x, y: c.y - 40 }), 3, { silent: !!c.katt });
    toast(h ? $t`🎈 Du fick en ballong! +${h} 😊` : $t('🎈 Du fick en ballong!'), 'good');
  }
  // 🎈 ballongståndet: välj färg (15 kr)
  function ballongStand() {
    play('click');
    const knapp = (c, i) => `<button class="btn btn-small" data-bf="${i}" style="background:#${c.toString(16).padStart(6, '0')};min-width:34px" ${g.money < 15 ? 'disabled' : ''}>🎈</button>`;
    const dlg = openModal($t('🎈 Ballongståndet'), `<p style="font-size:var(--f2);margin-top:0">${$t`Välj färg – en ballong kostar ${fmt(15)}. Den följer med dig på tivolit hela dagen!`}</p><div style="display:flex;flex-wrap:wrap;gap:6px">${BALLONG_FARG.map(knapp).join('')}</div>`, [{ label: $t('Nej tack'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-bf]').forEach((b) => (b.onclick = () => {
      if (g.money < 15) return;
      g.money -= 15; g.tivoli = { ...(g.tivoli || {}), ballong: { dag: g.day, f: +b.dataset.bf } };
      const h = g.glad?.(2, '', 'tivoli-ballong', 2) || 0;
      g.save(); closeModal(); play('buy'); toast(h ? $t`🎈 En ballong! +${h} 😊` : $t('🎈 En ballong!'), 'good');
    }));
  }
  // 🦆 fiskdammen: 20 kr – fiska upp en anka, numret under bestämmer vinsten
  function fiskdammen() {
    play('click');
    if (g.money < 20) { toast($t`🦆 Fiskdammen kostar ${fmt(20)} – du har inte råd.`, 'bad'); return; }
    const W = 120, H = 60;
    const dlg = openModal($t('🦆 Fiskdammen'), `<canvas class="pb-spel" width="${W}" height="${H}"></canvas><div class="pb-spel-text">${esc($t`Tryck på en anka för att fiska upp den (${fmt(20)}). Numret under ankan avgör vinsten!`)}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    const cv = dlg.querySelector('.pb-spel'), x = cv.getContext('2d'), info = dlg.querySelector('.pb-spel-text');
    let tt = 0, sist = performance.now(), fangad = null;
    const ankor = Array.from({ length: 8 }, (_, k) => ({ k, nr: 1 + Math.floor(Math.random() * 9) }));
    const pos = (a) => { const v = tt * 0.7 + a.k / 8 * Math.PI * 2; return { x: W / 2 + Math.cos(v) * 44, y: 30 + Math.sin(v) * 16 }; };
    const rita = () => {
      x.fillStyle = '#e8f0f0'; x.fillRect(0, 0, W, H);
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const d = ((xx - W / 2) / 56) ** 2 + ((yy - 30) / 26) ** 2; if (d > 1) continue; x.fillStyle = d > 0.86 ? '#2a8c96' : (xx + yy * 3 + Math.floor(tt * 4)) % 23 === 0 ? '#d8f4ff' : '#4aa8d8'; x.fillRect(xx, yy, 1, 1); }
      for (const a of ankor) {
        const p = pos(a), ax = Math.round(p.x), ay = Math.round(p.y);
        if (fangad === a) continue;
        x.fillStyle = '#ffe060'; x.fillRect(ax - 4, ay - 2, 8, 4); x.fillRect(ax - 2, ay - 5, 4, 3); x.fillStyle = '#f08a2a'; x.fillRect(ax + 2, ay - 4, 2, 1); x.fillStyle = '#1e1a24'; x.fillRect(ax, ay - 4, 1, 1); x.fillStyle = '#c8a020'; x.fillRect(ax - 4, ay + 1, 8, 1);
      }
      if (fangad) { x.fillStyle = 'rgba(20,18,26,.85)'; x.fillRect(W / 2 - 14, 4, 28, 20); x.fillStyle = '#ffe060'; x.fillRect(W / 2 - 4, 8, 8, 5); x.fillRect(W / 2 - 2, 6, 4, 2); ctxText(x, BIG, String(fangad.nr), W / 2 - 2, 14, '#f4f1ea'); }
    };
    const steg = (nu) => { if (!document.body.contains(cv)) return; const dt = Math.min(0.05, (nu - sist) / 1000); sist = nu; if (!fangad) tt += dt; rita(); requestAnimationFrame(steg); };
    cv.addEventListener('pointerdown', (e) => {
      if (fangad) return;
      const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
      const a = ankor.map((q) => ({ q, d: Math.hypot(pos(q).x - px, pos(q).y - py) })).sort((p, q) => p.d - q.d)[0];
      if (!a || a.d > 9) return;
      fiska(a.q);
    });
    function fiska(a) {
      if (g.money < 20) return;
      g.money -= 20; fangad = a; play('coin');
      const vinst = FISK_VINST[a.nr];
      if (vinst === 'klubba' || !toyOf(vinst)) { const h = g.glad?.(1, '', 'tivoli-fiskdam', 2) || 0; info.textContent = $t`Nummer ${a.nr}: en tivoliklubba! 🍬` + (h ? ` +${h} 😊` : ''); play('ok'); }
      else { addToy(g, vinst, 1); const h = g.glad?.(3, '', 'tivoli-fiskdam', 3) || 0; info.textContent = $t`Nummer ${a.nr}: ${toyNamn(toyOf(vinst))}! Vinsten ligger i leksakslådan hemma.` + (h ? ` +${h} 😊` : ''); play('fanfare'); }
      g.save();
    }
    globalThis.__fiskdam = { ankor, fiska: (k) => fiska(ankor[k]) };
    requestAnimationFrame(steg);
  }

  // vimpelstängerna längs torgets framkant (vimpelbanden hänger mellan dem)
  const STANGER = [200, 420, 640, 860, 1080, 1300, 1520, 1740, 1960, 2180, 2400];

  // ---------- 🚗 radiobilarna ----------
  // Besökarnas bilar kör hela tiden (banan ser levande ut); min bil finns under en runda (aka.typ === 'radio').
  // Kompisarnas bilar (world.js ak 'radio:<färg>') står där deras x/y är: jag studsar mot dem här, de mot mig hos sig.
  const nyBil = (x, y, c, look) => ({ x, y, vx: 0, vy: 0, dir: 'down', c, look, mal: null, malT: 0, bom: 0 });
  const npcBilar = [0, 1, 2, 3].map((i) => nyBil(RX0 + 30 + i * 55, RY0 + 20 + (i % 2) * 50, RFARG[[2, 5, 0, 3][i]], i === 2 ? { ...makeLook(), kid: true } : makeLook()));
  let npcPark = false;   // (testerna: besökarna parkerar längst in så att de inte krockar med proven)
  const bommar = [];     // krockstjärnorna { x, y, t, stor }
  const fjarr = new Map();   // kompisarnas bilar: id → bil + { namn, av }
  const tangent = new Set();
  let spak = null, skak = 0;   // dra-styrspaken { x0, y0, x, y } (skärmkoordinater) · skakningen när man krockar
  // (tangenternas plats, e.code – WASD sitter där ZQSD sitter på ett franskt tangentbord)
  const TANGENT = { ArrowLeft: 'v', KeyA: 'v', ArrowRight: 'h', KeyD: 'h', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'n', KeyS: 'n' };
  const tNer = (e) => { const k = TANGENT[e.code]; if (!k || aka?.typ !== 'radio' || modalOpen() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; tangent.add(k); if (e.code.startsWith('Arrow')) e.preventDefault(); };
  const tUpp = (e) => { const k = TANGENT[e.code]; if (k) tangent.delete(k); };
  const tBort = () => tangent.clear();
  window.addEventListener('keydown', tNer, true); window.addEventListener('keyup', tUpp, true); window.addEventListener('blur', tBort);
  function styrning() {
    let ix = 0, iy = 0;
    if (tangent.has('v')) ix -= 1; if (tangent.has('h')) ix += 1; if (tangent.has('u')) iy -= 1; if (tangent.has('n')) iy += 1;
    if (spak) { const dx = spak.x - spak.x0, dy = spak.y - spak.y0, d = Math.hypot(dx, dy); if (d > 4) { const k = Math.min(1, d / 16); ix = dx / d * k; iy = dy / d * k; } }
    const d = Math.hypot(ix, iy); return d > 1 ? { x: ix / d, y: iy / d } : { x: ix, y: iy };
  }
  const riktning = (vx, vy, gammal) => (Math.hypot(vx, vy) < 6 ? gammal : Math.abs(vx) > Math.abs(vy) * 0.8 ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down');
  // en bil ett steg: gas åt (ax, ay), luftmotstånd, toppfart, studs mot gummikanten – svarar hur hårt den tog i kanten
  function korBil(b, ax, ay, max, dt) {
    b.vx += ax * dt; b.vy += ay * dt;
    const drag = Math.exp(-(ax || ay ? 1.2 : 2.6) * dt); b.vx *= drag; b.vy *= drag;
    const v = Math.hypot(b.vx, b.vy); if (v > max) { b.vx *= max / v; b.vy *= max / v; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    let kant = 0;
    if (b.x < RX0) { kant = Math.max(kant, -b.vx); b.x = RX0; b.vx = Math.abs(b.vx) * 0.55; }
    if (b.x > RX1) { kant = Math.max(kant, b.vx); b.x = RX1; b.vx = -Math.abs(b.vx) * 0.55; }
    if (b.y < RY0) { kant = Math.max(kant, -b.vy); b.y = RY0; b.vy = Math.abs(b.vy) * 0.55; }
    if (b.y > RY1) { kant = Math.max(kant, b.vy); b.y = RY1; b.vy = -Math.abs(b.vy) * 0.55; }
    b.dir = riktning(b.vx, b.vy, b.dir);
    return kant;
  }
  // två bilar som går in i varandra studsar isär (lika tunga) – bara = bara a flyttas (b är en kompis bil:
  // den flyttas hos kompisen). Svarar hur hårt de krockade (farten mot varandra), 0 = ingen krock.
  // En kompis bil har 3 px marginal: kompisens eget spel har redan knuffat isär bilarna innan läget skickas, så här
  // når den bara fram till kanten – kommer den farande mot mig räknas beröringen som en krock.
  function krock(a, b, bara) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= BIL_R * 2 + (bara ? 3 : 0) || d < 0.01) return 0;
    const nx = dx / d, ny = dy / d, over = Math.max(0, BIL_R * 2 - d);
    if (bara) { a.x -= nx * over; a.y -= ny * over; } else { a.x -= nx * over / 2; a.y -= ny * over / 2; b.x += nx * over / 2; b.y += ny * over / 2; }
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv >= 0) return 0;
    const j = -(1 + 0.85) * rv / 2;
    a.vx -= j * nx; a.vy -= j * ny;
    if (!bara) { b.vx += j * nx; b.vy += j * ny; }
    return -rv;
  }
  function kompisBilar(dt) {
    const sett = new Set();
    for (const f of worldFolksHere(A)) {
      // (bilen följer nätets senaste läge tätt – inte gånggliden – och hoppar dit direkt när kompisen just klivit i)
      const m = RADIOTUR.exec(f.ak || ''), tx = f.tx ?? f.x, ty = f.ty ?? f.y;
      if (!m || tx < RADIO.x || tx > RADIO.x + RADIO.w || ty < RADIO.y || ty > RADIO.y + RADIO.h) continue;
      sett.add(f.id);
      let b = fjarr.get(f.id);
      if (!b) { b = nyBil(tx, ty, RFARG[+m[1]], f.av.look); fjarr.set(f.id, b); }
      else if (Math.hypot(tx - b.x, ty - b.y) > 40) { b.x = tx; b.y = ty; b.vx = b.vy = 0; }
      else if (dt > 0) {
        const u = Math.min(1, dt * 15), nx = b.x + (tx - b.x) * u, ny = b.y + (ty - b.y) * u, k = Math.min(1, dt * 8);
        b.vx += ((nx - b.x) / dt - b.vx) * k; b.vy += ((ny - b.y) / dt - b.vy) * k; b.x = nx; b.y = ny;
      }
      b.c = RFARG[+m[1]]; b.look = f.av.look; b.av = f.av; b.namn = f.av.name; b.dir = riktning(b.vx, b.vy, b.dir);
    }
    for (const id of [...fjarr.keys()]) if (!sett.has(id)) fjarr.delete(id);
  }
  // besökarna kör mot en slumpad punkt – ibland jagar de mig
  function npcGas(b, dt, jag) {
    b.malT -= dt;
    if (!b.mal || b.malT <= 0 || (b.mal.jag && !jag) || (!b.mal.jag && Math.hypot(b.mal.x - b.x, b.mal.y - b.y) < 12)) { b.mal = jag && Math.random() < 0.35 ? { jag: true } : { x: rnd(RX0, RX1), y: rnd(RY0, RY1) }; b.malT = rnd(1.5, 3.5); }
    const mx = b.mal.jag ? jag.x : b.mal.x, my = b.mal.jag ? jag.y : b.mal.y, dx = mx - b.x, dy = my - b.y, d = Math.hypot(dx, dy) || 1;
    return [dx / d * 120, dy / d * 120];
  }
  function minKrock(kompis) {
    aka.krockar += 1; play('bump'); skak = 0.22;
    if (kompis && !aka.med.has(kompis.namn)) { aka.med.add(kompis.namn); toast($t`💥 Du krockade med ${kompis.namn}!`, 'good'); }
  }
  function updRadio(dt) {
    const min = aka?.typ === 'radio' ? aka.bil : null;
    kompisBilar(dt);
    if (min) {
      const s = aka.t < RUNDA - 3 ? styrning() : { x: 0, y: 0 };   // de sista sekunderna bryts strömmen
      if (korBil(min, s.x * BIL_ACC, s.y * BIL_ACC, BIL_MAX, dt) > 30) { play('bump'); skak = 0.12; bommar.push({ x: min.x, y: min.y - 6, t: 0, stor: false }); }
    }
    for (const b of npcBilar) {
      if (npcPark) { b.vx = b.vy = 0; continue; }
      const [ax, ay] = npcGas(b, dt, min); korBil(b, ax, ay, 52, dt);
    }
    const alla = min ? [min, ...npcBilar] : npcBilar;
    for (let i = 0; i < alla.length; i++) for (let j = i + 1; j < alla.length; j++) {
      const a = alla[i], b = alla[j], k = krock(a, b, false);
      if (k > 14) { bommar.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8, t: 0, stor: k > 45 }); a.bom = b.bom = 0.5; if (a === min) minKrock(null); }
    }
    for (const a of npcBilar) for (const b of fjarr.values()) if (krock(a, b, true) > 14) a.bom = b.bom = 0.5;   // besökarna studsar mot kompisarnas bilar också
    if (min) for (const b of fjarr.values()) { const k = krock(min, b, true); if (k > 14) { bommar.push({ x: (min.x + b.x) / 2, y: (min.y + b.y) / 2 - 8, t: 0, stor: k > 45 }); min.bom = b.bom = 0.5; minKrock(b); } }
    for (const b of [...alla, ...fjarr.values()]) if (b.bom > 0) b.bom -= dt;
    for (let i = bommar.length - 1; i >= 0; i--) if ((bommar[i].t += dt) > 0.6) bommar.splice(i, 1);
    if (skak > 0) skak -= dt;
    if (min && !aka.slut && aka.t >= RUNDA - 3) { aka.slut = true; play('pling'); }
  }
  function akRadio() {
    if (aka || !betala($t('Radiobilarna'))) return;
    const tagna = new Set([...npcBilar, ...fjarr.values()].map((b) => b.c));
    const c = [1, 4, 6, 7, 0, 2, 3, 5].find((i) => !tagna.has(RFARG[i])) ?? 1;
    aka = { typ: 'radio', t: 0, c, bil: nyBil(RADIO.x + RADIO.w / 2, RY1, RFARG[c], A.avatar.look), krockar: 0, med: new Set(), slut: false };
    aka.bil.dir = 'up';
    walker.stop(); tangent.clear(); spak = null; play('door');
    toast($t('🚗 Kör med piltangenterna eller WASD (på mobilen: dra med fingret). Krocka så mycket du vill!'), 'good wrap');
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'hjul', r: [HJUL.x - 40, HJUL.fot - 40, HJUL.x + 40, HJUL.fot + 4], go: [HJUL.x, HJUL.fot + 10], label: $t('PARISERHJULET – ETT VARV MED UTSIKT'), act: akHjul },
    { id: 'karusell', r: [KARUSELL.x - KARUSELL.rx, KARUSELL.y - 80, KARUSELL.x + KARUSELL.rx, KARUSELL.y + KARUSELL.ry], go: [KARUSELL.x, KARUSELL.y + KARUSELL.ry + 10], label: $t('KARUSELLEN'), act: akKarusell },
    { id: 'biljett', r: [BILJETT.x, BILJETT.y - 64, BILJETT.x + BILJETT.w, BILJETT.y], go: [BILJETT.x + BILJETT.w / 2, BILJETT.y + 4], label: $t('BILJETTER – ÅKBAND OCH KUPONGER'), act: biljetter },
    { id: 'port', r: [ENTRE.PORT.cx - 50, ENTRE.STAKET_Y - 112, ENTRE.PORT.cx + 50, ENTRE.STAKET_Y - 20], go: [ENTRE.PORT.cx, ENTRE.STAKET_Y + 12], label: $t('PIXELBERGS TIVOLI – ENTRÉN'), act: () => { walker.walkTo(ENTRE.PORT.cx, ENTRE.STAKET_Y - 16); } },
    ...FASADER.map((Fa) => ({ id: 'fasad-' + Fa.id, r: [Fa.x, MAINSTREET_Y - 96, Fa.x + Fa.w, MAINSTREET_Y], go: [Fa.x + Fa.w - 10, MAINSTREET_Y + 10], label: Fa.namn, act: () => { play('click'); const rad = FASAD_PRAT[Fa.id]; talk.say(rad[Math.floor(t) % rad.length], () => ({ x: Fa.x + Fa.w - 10, y: MAINSTREET_Y - 30 }), 4, { voice: KOPPFOLK[3] }); } })),
    { id: 'fontan', r: [ENTRE.FONTAN.x - 40, ENTRE.FONTAN.y - 66, ENTRE.FONTAN.x + 40, ENTRE.FONTAN.y + 12], go: [ENTRE.FONTAN.x, ENTRE.FONTAN.y + 20], label: $t('PIXEL-NALLE-FONTÄNEN'), act: () => { play('coin'); toast($t('⛲ Pixel-Nalle i brons! Alla som kommer till tivolit tar en bild här.')); } },
    { id: 'karta', r: [ENTRE.KARTA.x - 22, ENTRE.KARTA.y - 54, ENTRE.KARTA.x + 22, ENTRE.KARTA.y], go: [ENTRE.KARTA.x, ENTRE.KARTA.y + 6], label: $t('PARKKARTAN'), act: () => toast($t('🗺️ Entréplatsen – Sagolandet med karusellen, tekopparna och pariserhjulet – berg-och-dalbanan – radiobilarna – Spökgränd. Marknadsgatan går längs hela parken.'), 'wrap') },
    { id: 'kopp', r: [DEKO.tekopp.x - 40, DEKO.tekopp.y - 34, DEKO.tekopp.x + 40, DEKO.tekopp.y + 12], go: [DEKO.tekopp.x, DEKO.tekopp.y + 16], label: $t('TEKOPPARNA – SNURRA RUNT!'), act: akKopp },
    // 🏮 tältstånden på marknadsgatan
    ...STALL.map((s) => ({ id: s.id, r: [s.x, s.y - 62, s.x + s.w, s.y], go: [s.cx, s.y + 8], label: s.def.namn, act: s.typ === 'ballong' ? ballongStand : s.typ === 'fiskdam' ? fiskdammen : () => matStand(s.typ) })),
    // 🎪 stånden: matstånden öppnar sin meny, lyckohjulet, burktornet och skjutbanan sina spel
    ...STAND.map((s) => ({ id: s.id, r: [s.x, s.y - 100, s.x + s.w, s.y], go: [s.cx, s.y + 8],
      label: s.mat ? $t`${s.namn} – KÖP NÅGOT GOTT!` : s.id === 'kast' ? $t('BURKTORNET – FÄLL ALLA SEX BURKAR!') : s.id === 'skjut' ? $t('SKJUTBANAN – TRÄFFA PLÅTANKORNA!') : s.namn,
      act: s.mat ? () => matStand(s.id) : s.id === 'lycka' ? lyckohjulet : s.id === 'kast' ? () => openKast(A) : () => openSkjut(A) })),
    { id: 'bana', r: [BANA.station.x, BANA.station.y - 50, BANA.station.x + BANA.station.w, BANA.station.y], go: [BANA.station.x + BANA.station.w / 2, BANA.station.y + 8], label: $t('BERG-OCH-DALBANAN – ÅK MED EN KOMPIS!'), act: akBana },

    { id: 'spok', r: [SPOK.x, SPOK.y - SPOK_H, SPOK.x + SPOK.w, SPOK_SPAR.y1 + 14], go: [SPOK_SPAR.cx, SPOK_SPAR.y1 + 12], label: $t('SPÖKHUSET – ÅK MED EN KOMPIS OM DU VÅGAR!'), act: akSpok },
    { id: 'radio', r: [RADIO.x, RADIO.y - RADIO_H + 6, RADIO.x + RADIO.w, RADIO.y + RADIO.h + 2], go: [RADIO.x + RADIO.w / 2, RADIO.y + RADIO.h + 10], label: $t('RADIOBILAR – KROCKA MED KOMPISAR!'), act: akRadio },
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 46, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 10, HALLPLATS.y - 8], label: $t('BERGBUSSEN NER TILL STAN'), act: bussen },
    { id: 'bergbuss', r: [ENTRE.BUSS.x - 92, ENTRE.BUSS.y - 40, ENTRE.BUSS.x + 4, ENTRE.BUSS.y], go: [ENTRE.BUSS.x - 60, ENTRE.GATA[0] - 4], label: $t('BERGBUSSEN NER TILL STAN'), act: bussen },
  ];
  function biljetter() {
    play('click');
    openModal($t('🎟️ Biljetter'), `<p style="font-size:var(--f2);margin-top:0">${harBand() ? $t('Du har åkband i dag – åk hur mycket du vill! 🎉') : $t`Varje åktur kostar en kupong (${fmt(KUPONG)}). Med ett åkband åker du hur mycket du vill hela dagen.`}</p>`, [
      { label: $t`🎟️ Åkband · ${fmt(BAND)}`, cls: 'btn-go', hidden: harBand(), disabled: g.money < BAND, onClick: () => { if (g.money < BAND) return; g.money -= BAND; g.tivoli = { ...(g.tivoli || {}), band: g.day }; g.save(); closeModal(); play('buy'); toast($t('🎟️ Åkbandet sitter på handleden – åk hur mycket du vill i dag!'), 'good'); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
  }
  function matStand(id) {
    play('click');
    const lista = MAT[id] || [];
    const rad = (m) => `<div class="prow" style="grid-template-columns:1fr auto"><span class="nm">${esc(m.namn)}</span><button class="btn btn-small btn-go" data-mat="${m.id}" ${g.money < m.pris ? 'disabled' : ''}>${esc(fmt(m.pris))}</button></div>`;
    const dlg = openModal(MAT_TITEL[id] || '🎪', `<div class="plist">${lista.map(rad).join('')}</div>`, [{ label: $t('Inget, tack'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-mat]').forEach((b) => (b.onclick = () => {
      const m = lista.find((x) => x.id === b.dataset.mat); if (!m || g.money < m.pris) return;
      g.money -= m.pris; g.hunger = Math.min(100, (g.hunger || 0) + m.hunger);
      const h = g.glad?.(m.glad, '', `tivoli-${m.id}`, m.glad) || 0;
      g.save(); closeModal(); play('buy'); toast(`${m.namn.split(' ')[0]} ${h ? $t`Mums! +${h} 😊` : $t('Mums!')}`, 'good');
      hand = { id: m.id, t: 0, bit: 0 };   // 🧇 och så går man runt med det i handen tills det är uppätet
    }));
  }
  // 🎰 lyckohjulet: 10 kr, hjulet snurrar och stannar på ett fält
  function lyckohjulet() {
    play('click');
    const dlg = openModal($t('🎰 Lyckohjulet'), `<canvas class="pb-lycka" width="96" height="96"></canvas><p class="pb-lycka-text">${$t`Ett snurr kostar ${fmt(10)}. Vinster: kortpaket, pengar och godis!`}</p>`, [
      { label: $t`🎰 Snurra · ${fmt(10)}`, cls: 'btn-go', disabled: g.money < 10, onClick: () => snurra() },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    const cv = dlg.querySelector('.pb-lycka'), x = cv.getContext('2d'), txt = dlg.querySelector('.pb-lycka-text');
    let vinkel = 0, snurrar = false;
    const rita = () => {
      x.clearRect(0, 0, 96, 96);
      const cx = 48, cy = 50, r = 40;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const d = Math.hypot(xx, yy); if (d > r) continue;
        const seg = Math.floor((((Math.atan2(yy, xx) - vinkel) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2)) / (Math.PI / 4));
        x.fillStyle = d > r - 3 ? '#f0c030' : d > r - 4 ? '#8a6a1a' : LYCKA_FARG[seg]; x.fillRect(cx + xx, cy + yy, 1, 1);
      }
      x.fillStyle = '#f0c030'; x.fillRect(cx - 3, cy - 3, 7, 7); x.fillStyle = '#8a6a1a'; x.fillRect(cx - 1, cy - 1, 3, 3);
      x.fillStyle = '#1e1a24'; x.fillRect(cx - 4, 2, 9, 3); x.fillRect(cx - 2, 5, 5, 3); x.fillRect(cx - 1, 8, 3, 2);   // pilen
    };
    rita();
    function snurra() {
      if (snurrar || g.money < 10) return;
      g.money -= 10; g.save(); snurrar = true; play('click');
      const vinst = Math.floor(Math.random() * 8), mal0 = vinkel + Math.PI * 2 * (4 + Math.random()) ;
      // pilen pekar uppåt (-90°): fältet under pilen ska bli 'vinst' när hjulet stannar
      const slut = -Math.PI / 2 - (vinst + 0.5) * (Math.PI / 4), varv = Math.ceil((mal0 - slut) / (Math.PI * 2));
      const malV = slut + varv * Math.PI * 2, start = vinkel, t0 = performance.now(), T = 3200;
      const steg = (nu) => {
        if (!document.body.contains(cv)) return;
        const u = Math.min(1, (nu - t0) / T), e = 1 - Math.pow(1 - u, 3);
        const fore = vinkel; vinkel = start + (malV - start) * e;
        if (Math.floor(fore / (Math.PI / 4)) !== Math.floor(vinkel / (Math.PI / 4))) play('click');
        rita();
        if (u < 1) { requestAnimationFrame(steg); return; }
        snurrar = false;
        const V = LYCKA[vinst];
        if (V.id === 'paket') { const ids = draPaket(3); laggTill(g, ids); play('fanfare'); }
        else if (V.id === 'p50') { g.money += 50; play('coin'); }
        else if (V.id === 'p20') { g.money += 20; play('coin'); }
        else if (V.id === 'godis') { g.glad?.(2, '', 'tivoli-lycka', 2); play('ok'); }
        else play('miss');
        g.save();
        txt.textContent = V.namn;
      };
      requestAnimationFrame(steg);
    }
  }
  function bussen() {
    const rad = (s) => `<div class="prow shoprow"><span style="font-size:28px;text-align:center">🚌</span><span class="nm">${esc($t(s.name))}<br><small class="sp">${esc($t(s.district))}</small></span><button class="btn btn-small btn-go" data-bb="${s.id}" ${g.money < 10 ? 'disabled' : ''}>${$t('Åk hit')}</button></div>`;
    const dlg = openModal($t('🚌 Bergbussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bergbussen går ner till stan. Biljetten kostar ${fmt(10)}.`}</p><div class="plist">${BUS_STOPS.filter((s) => !s.broken).map(rad).join('')}</div>`, [{ label: $t('Stanna kvar'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-bb]').forEach((b) => (b.onclick = () => {
      const s = BUS_STOPS.find((q) => q.id === b.dataset.bb); if (!s || g.money < 10) return;
      g.money -= 10; g.passTime(15); g.save(); closeModal(); play('door');
      go(() => { A.cityPos = [s.x + 6, s.y + 8]; A.go('city'); });
    }));
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => besok.find((o) => Math.abs(o.x - x) < 8 && y < o.y + 2 && y > o.y - 34);
  const nalleAt = (x, y) => Math.abs(nalle.x - x) < 10 && y < nalle.y + 2 && y > nalle.y - 32;

  // ---------- ritning ----------
  const KIT = propKit();
  // 🎪 stånden: expediten (en egen figur per stånd, i förkläde) står bakom disken mellan bak- och frambilden
  const rngAv = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const SALJARE = new Map(STAND.map((s, i) => [s.id, { ...makeLook(rngAv(4100 + i * 977)), apron: true }]));
  // 🏮 tältstånden: tältet, expediten bakom bordet, bordet, det som rör sig och glödlamporna
  const STALLSALJARE = new Map(STALL.map((s, i) => [s.id, { ...makeLook(rngAv(7300 + i * 613)), apron: true }]));
  function ritaStall(ctx, s, N) {
    const b = stallBilder(s.def, N);
    putS(ctx, b.talt, s.cx, s.y);
    ctx.save(); ctx.beginPath(); ctx.rect(s.x + 3, s.y - 44, s.w - 6, 31); ctx.clip();
    drawPerson(ctx, s.cx + (s.def.expedit?.dx || 0), s.y - 2, STALLSALJARE.get(s.id), 'down', Math.sin(t * 1.1 + s.cx) > 0.93 ? 4 : 0);
    ctx.restore();
    putS(ctx, b.bord, s.cx, s.y);
    s.def.live?.(ctx, s.cx, s.y, t, N);
    ritaLampor(ctx, s.cx, s.y, b.lampor, t, N, s.cx & 7);
  }
  function ritaStand(ctx, s, N) {
    const b = standBilder(s.def, N);
    putKiosk(ctx, b.bak, s.cx, s.y);
    ctx.save(); ctx.beginPath(); ctx.rect(s.x + 6, s.y - 62, s.w - 12, 47); ctx.clip();
    drawPerson(ctx, s.cx + (s.def.expedit?.dx || 0), s.y - 3, SALJARE.get(s.id), 'down', Math.sin(t * 1.3 + s.cx) > 0.93 ? 4 : 0);
    ctx.restore();
    putKiosk(ctx, b.fram, s.cx, s.y);
    s.def.live?.(ctx, s.cx, s.y, t, N);
    ritaLampor(ctx, s.cx, s.y, b.lampor, t, N, s.cx & 7);
  }
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  // pariserhjulet: A-ställningen, fälgen med ekrar, gondolerna (färgade, med folk), glödlampor på kvällen
  const GFARG = [0xe04848, 0xf0c030, 0x3a7bd5, 0x46a35a, 0xd060a0, 0xf08a2a, 0x9a6ad8, 0x2ab8c8, 0xe04848, 0xf0c030];
  function ritaHjul(ctx, N, framfor) {
    const { x: cx, y: cy, r } = HJUL, v0 = hjulVinkel();
    if (!framfor) {
      ctx.fillStyle = '#8a8a98'; for (const sx of [-34, 34]) for (let k = 0; k <= 40; k++) { const u = k / 40; ctx.fillRect(Math.round(cx + sx * u), Math.round(cy + (HJUL.fot - cy) * u), 3, 1); }
      ctx.fillStyle = '#c8c8d4'; for (let k = 0; k <= 40; k++) { const u = k / 40; ctx.fillRect(Math.round(cx - 34 * u), Math.round(cy + (HJUL.fot - cy) * u), 1, 1); }
      for (let k = 0; k < 16; k++) { const v = v0 + k * Math.PI / 8; ctx.fillStyle = 'rgba(200,200,212,.9)'; for (let j = 4; j < r; j += 2) ctx.fillRect(Math.round(cx + Math.cos(v) * j), Math.round(cy + Math.sin(v) * j), 1, 1); }   // ekrarna
      for (let k = 0; k < 220; k++) { const v = k / 220 * Math.PI * 2; ctx.fillStyle = k % 2 ? '#e8e8f0' : '#b8b8c8'; ctx.fillRect(Math.round(cx + Math.cos(v) * r), Math.round(cy + Math.sin(v) * r), 2, 2); }   // fälgen
      if (N) for (let k = 0; k < 40; k++) { const v = v0 * 0.5 + k / 40 * Math.PI * 2; ctx.fillStyle = ['#ff5858', '#ffe060', '#58b0ff', '#78f078'][k % 4]; ctx.fillRect(Math.round(cx + Math.cos(v) * (r + 1)), Math.round(cy + Math.sin(v) * (r + 1)), 2, 2); }
      ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 4, cy - 4, 9, 9); ctx.fillStyle = '#8a6a1a'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(cx - 50, HJUL.fot - 4, 100, 5); ctx.fillStyle = '#8a8a98'; ctx.fillRect(cx - 50, HJUL.fot - 5, 100, 1);   // plattformen
      return;
    }
    for (let i = 0; i < GONDOLER; i++) {
      const p = gondol(i), gx = Math.round(p.x), gy = Math.round(p.y);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(gx, gy - 12, 1, 6);
      const f = GFARG[i];
      ctx.fillStyle = hex(f); ctx.fillRect(gx - 7, gy - 7, 15, 3);   // taket
      const folk = aka?.typ === 'hjul' && aka.i === i ? A.avatar.look : gondolFolk.get(i);
      if (folk) { ctx.save(); ctx.beginPath(); ctx.rect(gx - 7, gy - 30, 15, 31); ctx.clip(); drawPerson(ctx, gx, gy + 18, folk, 'down', 5); ctx.restore(); }
      ctx.fillStyle = hex(f); ctx.fillRect(gx - 7, gy, 15, 7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(gx - 7, gy, 15, 1); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(gx - 7, gy + 6, 15, 1);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(gx - 7, gy - 4, 1, 4); ctx.fillRect(gx + 7, gy - 4, 1, 4);
    }
  }
  // karusellen: plattformen, hästarna på stänger (de bakre före mittstången), taket med bården och lampor
  const HAST = ['..kkk.......', '.kwwwk......', 'kwkwwwkkkkk.', '.kwwwwwwwwwk', '...kwwwwwwwk', '...kw.k..kwk', '...kk.....kk'];
  function ritaHast(ctx, x, y, dir, farg) {
    const s = dir === 'left' ? 1 : -1;
    HAST.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; ctx.fillStyle = ch === 'k' ? '#3a2a3a' : farg; ctx.fillRect(Math.round(x + (i - 6) * s), Math.round(y - 12 + j), 1, 1); } });
    ctx.fillStyle = '#e04848'; ctx.fillRect(Math.round(x - 1), Math.round(y - 10), 3, 1);   // sadeln
  }
  function ritaKarusell(ctx, N, del) {
    const { x: cx, y: cy, rx, ry } = KARUSELL;
    if (del === 'golv') {
      for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(1 - (j / ry) ** 2)); ctx.fillStyle = j > ry - 4 ? '#7a4a2a' : '#c8945a'; ctx.fillRect(cx - w, cy + j, w * 2, 1); }
      ctx.fillStyle = '#a8703e'; for (let j = -ry + 2; j < ry - 3; j += 4) { const w = Math.round(rx * Math.sqrt(1 - (j / ry) ** 2)); ctx.fillRect(cx - w + 2, cy + j, w * 2 - 4, 1); }
      return;
    }
    if (del === 'tak') {
      ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 2, cy - 74, 5, 74);   // mittstången
      for (let j = 0; j < 30; j++) { const w = Math.round(6 + j * (rx - 2) / 30); for (let i = -w; i <= w; i++) { const seg = Math.floor((i + w) / 7 + j / 30) % 2; ctx.fillStyle = seg ? '#e04848' : '#f4f1ea'; ctx.fillRect(cx + i, cy - 104 + j, 1, 1); } }   // det randiga taket
      for (let i = -rx; i <= rx; i++) { const bå = Math.floor((i + rx) / 6) % 2 ? 2 : 4; ctx.fillStyle = '#2a5aa8'; ctx.fillRect(cx + i, cy - 74, 1, bå + 2); }   // bården
      ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 1, cy - 112, 3, 8); ctx.fillStyle = '#e04848'; ctx.fillRect(cx + 1, cy - 112, 6, 4);   // flaggan
      if (N) for (let i = -rx + 3; i <= rx; i += 6) { ctx.fillStyle = ['#ffe060', '#ff8888', '#88ccff'][(i + rx) % 3]; ctx.fillRect(cx + i, cy - 70, 2, 2); }
    }
  }
  const drawHast = (ctx, i) => {
    const h = hast(i), y = h.y - 8 + h.upp;
    ctx.fillStyle = '#f0c030'; ctx.fillRect(Math.round(h.x), KARUSELL.y - 74, 1, Math.round(y - (KARUSELL.y - 74)));   // stången
    ritaHast(ctx, h.x, y, h.dir, ['#f4f1ea', '#c8905a', '#f8c8d8', '#a8d4ff'][i % 4]);
    const ryttare = aka?.typ === 'karusell' && aka.i === i ? A.avatar.look : hastFolk.get(i);
    if (ryttare) { ctx.save(); ctx.beginPath(); ctx.rect(h.x - 12, y - 60, 24, 49); ctx.clip(); drawPerson(ctx, h.x, y + 1, ryttare, h.dir, 5); ctx.restore(); }
  };
  // berg-och-dalbanans tåg: tre vagnar längs spåret (på klockan) med de åkande – två i varje vagn; i nedförsbackarna
  // åker armarna upp. Kompisar har sin namnlapp. Vid stationen: hur länge det är kvar tills tåget går.
  function ritaTag(ctx) {
    const L = banLage(), sitt = aakare(L);
    for (let c = 2; c >= 0; c--) {
      const v = vagn(c, L), x = Math.round(v.x), y = Math.round(v.y);
      for (let s = 0; s < 2; s++) {
        const r = sitt[c * 2 + s]; if (!r) continue;
        const px = x + (s ? 3 : -3);
        ctx.save(); ctx.beginPath(); ctx.rect(px - 9, y - 44, 18, 41); ctx.clip();
        drawPerson(ctx, px, y + 14, r.look, 'down', v.ner ? 10 : 5);
        ctx.restore();
      }
      const farg = ['#f0c030', '#e04848', '#3a7bd5'][c];
      ctx.fillStyle = farg; ctx.fillRect(x - 8, y - 6, 17, 6); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 8, y - 6, 17, 1); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 8, y - 2, 17, 1);
      ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 8, y, 17, 1); ctx.fillRect(x - 6, y + 1, 3, 1); ctx.fillRect(x + 4, y + 1, 3, 1);
      if (c === 0) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 8, y - 5, 2, 2); }   // strålkastaren längst fram
    }
    for (let c = 0; c < 3; c++) { const v = vagn(c, L); for (let s = 0; s < 2; s++) { const r = sitt[c * 2 + s]; if (r?.av) nameTag(ctx, Math.round(v.x) + (s ? 3 : -3), Math.round(v.y) - 36, r.av); } }
    if (L.station) { const s = $t`TÅGET GÅR OM ${Math.max(1, Math.ceil(L.kvar))}`, w = textW(SMALL, s) + 8, sx = BANA.station.x + (BANA.station.w >> 1); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(sx - (w >> 1), BANA.station.y - 66, w, 10); ctxText(ctx, SMALL, s, sx - (w >> 1) + 4, BANA.station.y - 64, '#ffd23f'); }
  }
  // kompisar som står i kön till nästa tåg (deras ak är en senare avgång) – de ritas här, inte av walkable
  const koande = () => { const L = banLage(), S = spokL(); return worldFolksHere(A).filter((f) => { const m = AKTUR.exec(f.ak || ''), s = SPOKTUR.exec(f.ak || ''); return (m && +m[1] > L.n) || (s && +s[1] > S.n); }); };
  // björnmaskoten Pixel-Nalle (brun dräkt, stort huvud, vinkar)
  const NALLE = ['..kk......kk..', '.kbbk....kbbk.', '.kbbbkkkkbbbk.', '..kbbbbbbbbk..', '.kbbwkbbkwbbk.', '.kbbbbbbbbbbk.', '.kbbbbppbbbbk.', '..kbbbkkbbbk..', '...kkkkkkkk...', '..kbbbbbbbbk..', '.kbbbbwwbbbbk.', '.kbbbwwwwbbbk.', 'kbbkbwwwwbkbbk', 'kbk.bbwwbb.kbk', '....bbbbbb....', '....bb..bb....', '...kbb..bbk...', '...kkk..kkk...'];
  function ritaNalle(ctx) {
    const x0 = Math.round(nalle.x) - 7, y0 = Math.round(nalle.y) - 18, vink = nalle.vinkar > 0 && Math.floor(t * 6) % 2;
    ctx.fillStyle = 'rgba(30,20,20,.2)'; ctx.fillRect(x0 + 1, y0 + 17, 12, 2);
    NALLE.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; if (vink && j >= 12 && j <= 13 && i >= 11) continue; ctx.fillStyle = ch === 'k' ? '#3a2418' : ch === 'w' ? '#e8c8a0' : ch === 'p' ? '#2a1a14' : '#a8703e'; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
    if (vink) { ctx.fillStyle = '#a8703e'; ctx.fillRect(x0 + 13, y0 + 9, 2, 4); ctx.fillStyle = '#3a2418'; ctx.fillRect(x0 + 15, y0 + 9, 1, 4); }
  };
  const drawBallong = (ctx, o) => { const bx = Math.round(o.x) + (o.dir === 'left' ? -5 : 5), by = Math.round(o.y) - 44 + Math.round(Math.sin(t * 2 + o.x) * 1); ctx.fillStyle = 'rgba(240,240,240,.7)'; for (let y = by + 6; y < o.y - 22; y++) ctx.fillRect(bx + (y % 4 === 0 ? 1 : 0), y, 1, 1); ctx.fillStyle = o.ballong; ctx.fillRect(bx - 3, by - 3, 7, 8); ctx.fillRect(bx - 2, by - 4, 5, 10); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(bx - 1, by - 2, 2, 2); };
  const drawHallplats = (ctx) => { const { x, y } = HALLPLATS; ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y - 30, 2, 30); ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 6, y - 34, 14, 10); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 6, y - 34, 14, 1); ctxText(ctx, SMALL, $t('BUSS'), x - 5, y - 32, '#1e1a24'); };
  // glödlampsslingor mellan lyktstolparna (tänds på kvällen)
  function ritaSlingor(ctx, N) {
    for (let k = 0; k < LYKTOR.length - 1; k++) {
      const a = LYKTOR[k], b = LYKTOR[k + 1], n = Math.round((b.x - a.x) / 6);
      if (b.x > SPOK.x && a.x < SPOK.x + SPOK.w) continue;   // (ingen slinga tvärs över spökhuset)
      ctx.fillStyle = '#5a5662'; for (let i = 0; i <= n * 2; i++) { const u = i / (n * 2); ctx.fillRect(Math.round(a.x + (b.x - a.x) * u), Math.round(a.y - 31 + Math.sin(u * Math.PI) * 10), 1, 1); }   // kabeln
      for (let i = 1; i < n; i++) { const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y - 30 + Math.sin(u * Math.PI) * 10; glodlampa(ctx, Math.round(x), Math.round(y), i + k * 7, t, N); }   // (tända även på dagen – de gnistrar)
    }
  }


  // 🚗 en radiobil: gummikant runt om, lackad kaross, ryggstödet med strömstången (gnistor när den kör fort) och
  // föraren – armarna upp en stund efter en krock. Kompisar får sin namnlapp.
  function ritaBil(ctx, b, kompis) {
    const x = Math.round(b.x), y = Math.round(b.y), sid = b.dir === 'left' || b.dir === 'right';
    const w = sid ? 22 : 18, h = sid ? 8 : 10, x0 = x - (w >> 1), y0 = y - h + 2, f = b.c;
    const stang = b.dir === 'left' ? x + 7 : b.dir === 'right' ? x - 8 : x;
    ctx.fillStyle = 'rgba(10,10,20,.35)'; ctx.fillRect(x0 + 1, y + 2, w, 2);   // skuggan
    const ritaStang = () => {
      ctx.fillStyle = '#9a9aa8'; ctx.fillRect(stang, y0 - 27, 1, 26); ctx.fillStyle = '#5a5a66'; ctx.fillRect(stang + 1, y0 - 27, 1, 26);
      ctx.fillStyle = '#3a3a46'; ctx.fillRect(stang - 2, y0 - 28, 6, 2);
      if (Math.hypot(b.vx, b.vy) > 28 || b.bom > 0) for (let k = 0; k < 2; k++) { ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#9ad8ff'; ctx.fillRect(stang + Math.round(rnd(-4, 5)), y0 - 30 + Math.round(rnd(-2, 2)), 1, 1); }
    };
    const ryggstod = () => { ctx.fillStyle = f; if (sid) ctx.fillRect(b.dir === 'left' ? x0 + w - 7 : x0 + 3, y0 - 5, 4, 6); else ctx.fillRect(x0 + 3, y0 - 5, w - 6, 6); ctx.fillStyle = 'rgba(0,0,0,.28)'; if (sid) ctx.fillRect(b.dir === 'left' ? x0 + w - 7 : x0 + 3, y0 - 5, 4, 6); else ctx.fillRect(x0 + 3, y0 - 5, w - 6, 6); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(sid ? (b.dir === 'left' ? x0 + w - 7 : x0 + 3) : x0 + 3, y0 - 5, sid ? 4 : w - 6, 1); };
    if (b.dir !== 'up') { ritaStang(); ryggstod(); }
    if (b.look) { ctx.save(); ctx.beginPath(); ctx.rect(x - 11, y0 - 42, 22, 45); ctx.clip(); drawPerson(ctx, x + (b.dir === 'left' ? -1 : b.dir === 'right' ? 1 : 0), y0 + (b.look.kid ? 15 : 20), b.look, b.dir, b.bom > 0 ? 10 : 5); ctx.restore(); }
    if (b.dir === 'up') { ryggstod(); ritaStang(); }
    ctx.fillStyle = f; ctx.fillRect(x0 + 1, y0, w - 2, h - 2);                                       // karossen
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x0 + 2, y0, w - 4, 1);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x0 + 1, y0 + h - 4, w - 2, 2);
    if (b.dir === 'right') { ctx.fillStyle = f; ctx.fillRect(x0 + w - 1, y0 + 1, 2, h - 3); ctx.fillStyle = '#fff6c0'; ctx.fillRect(x0 + w, y0 + 2, 1, 2); }
    else if (b.dir === 'left') { ctx.fillStyle = f; ctx.fillRect(x0 - 1, y0 + 1, 2, h - 3); ctx.fillStyle = '#fff6c0'; ctx.fillRect(x0 - 1, y0 + 2, 1, 2); }
    else if (b.dir === 'down') { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x0 + 3, y0 + h - 5, 2, 1); ctx.fillRect(x0 + w - 5, y0 + h - 5, 2, 1); }
    else { ctx.fillStyle = '#e04848'; ctx.fillRect(x0 + 3, y0 + h - 5, 2, 1); ctx.fillRect(x0 + w - 5, y0 + h - 5, 2, 1); }
    ctx.fillStyle = '#2a2830'; ctx.fillRect(x0, y0 + h - 2, w, 3); ctx.fillRect(x0, y0 + 1, 1, h - 2); ctx.fillRect(x0 + w - 1, y0 + 1, 1, h - 2);   // gummikanten
    ctx.fillStyle = '#56545e'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
    if (kompis && b.av) nameTag(ctx, x, y0 - 40, b.av);
  }
  // krockstjärnan: en gul smäll med BOM! som bleknar
  function ritaBom(ctx, o) {
    const r = (o.stor ? 8 : 5) + o.t * 6, x = Math.round(o.x), y = Math.round(o.y);
    ctx.globalAlpha = Math.max(0, 1 - o.t / 0.6);
    ctx.fillStyle = '#ffe060';
    for (let k = 0; k < 8; k++) { const v = k * Math.PI / 4 + 0.2, l = k % 2 ? r * 0.6 : r; for (let j = 2; j < l; j++) ctx.fillRect(Math.round(x + Math.cos(v) * j), Math.round(y + Math.sin(v) * j * 0.8), 1, 1); }
    if (o.stor || o.t < 0.35) { const s = $t('BOM!'), tw = textW(SMALL, s); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - (tw >> 1) - 2, y - 4, tw + 4, 8); ctxText(ctx, SMALL, s, x - (tw >> 1), y - 2, '#ffe060'); }
    ctx.globalAlpha = 1;
  }
  // gummikanterna längs sidorna (bakom bilarna) och fram (framför bilarna, med öppningen där man kliver i)
  function ritaRadioKant(ctx, del) {
    const { x, y, w, h } = RADIO, cx = x + (w >> 1);
    if (del === 'sidor') {
      for (const sx of [x - 3, x + w - 1]) for (let yy = y - 2; yy < y + h; yy++) { const r = Math.floor(yy / 8) % 2; ctx.fillStyle = r ? '#d8343c' : '#f4f1ea'; ctx.fillRect(sx, yy, 3, 1); ctx.fillStyle = '#2a2830'; ctx.fillRect(sx + 3, yy, 1, 1); }
      return;
    }
    for (let xx = x - 3; xx < x + w + 3; xx++) {
      if (Math.abs(xx - cx) < 12) continue;
      const r = Math.floor((xx - x) / 10) % 2, yy = y + h - 6;
      ctx.fillStyle = r ? '#f8a0a0' : '#ffffff'; ctx.fillRect(xx, yy, 1, 1);
      ctx.fillStyle = r ? '#d8343c' : '#f4f1ea'; ctx.fillRect(xx, yy + 1, 1, 2);
      ctx.fillStyle = r ? '#b02a30' : '#d8d4c8'; ctx.fillRect(xx, yy + 3, 1, 1);
      ctx.fillStyle = '#2a2830'; ctx.fillRect(xx, yy + 4, 1, 2);
    }
    for (const px of [cx - 13, cx + 12]) { ctx.fillStyle = '#c89a20'; ctx.fillRect(px, y + h - 12, 2, 12); ctx.fillStyle = '#f0c030'; ctx.fillRect(px - 1, y + h - 14, 4, 3); ctx.fillStyle = '#ffe080'; ctx.fillRect(px, y + h - 14, 2, 1); }
  }

  function night() { const h = g.min / 60; return h >= 20 || h < 5.5; }
  function dusk() { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 5.5 && h < 7); }

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return aka?.typ === 'radio' ? aka.bil.x : walker.px; }, get worldY() { return aka?.typ === 'radio' ? aka.bil.y : walker.py; },
    get worldRide() { return null; },
    get worldAka() { return aka?.typ === 'bana' ? `bana:${aka.n}:${aka.plats}` : aka?.typ === 'spok' ? `spok:${aka.n}:${aka.plats}` : aka?.typ === 'radio' ? `radio:${aka.c}` : ''; },   // (js/net/world.js)
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; if (!aka) walker.update(dt); }
      else if (!aka) walker.update(dt);
      if (hand) { hand.t += dt; const b = Math.floor(hand.t / TUGGTID); if (b >= TUGGOR) hand = null; else hand.bit = b; }   // 🧇 en tugga i taget
      if (aka) {
        aka.t += dt;
        if (aka.typ === 'hjul') {
          const p = gondol(aka.i);
          if (!aka.toppen && p.y < HJUL.y - HJUL.r + 20) { aka.toppen = true; toast($t('🎡 Högst upp! Där nere ligger hela Pixelstaden – floden, bron och alla husen.'), 'good wrap'); }
          if (aka.t >= HJULVARV) avAka();
        } else if (aka.typ === 'karusell' && aka.t >= KARUSELLVARV * 2) avAka();
        else if (aka.typ === 'radio' && aka.t >= RUNDA) avAka();
        else if (aka.typ === 'kopp' && aka.t >= 14) avAka();
        else if (aka.typ === 'spok') {
          const L = spokL();
          if (L.n > aka.n) avAka();   // vagnen är tillbaka vid perrongen och nästa avgång har börjat: kliv av
          else if (L.n === aka.n) {
            for (const p of spokAkare(L)) if (p && !p.jag && !p.npc && !aka.ihop.has(p.namn)) { aka.ihop.add(p.namn); play('ok'); toast($t`👻 Du och ${p.namn} åker spöktåget tillsammans!`, 'good'); }
            if (L.inne) { for (const [at, ljud] of SPOK_LJUD) if (aka.ljudI < at && L.i >= at) play(ljud); aka.ljudI = L.i; }
          }
        }
        else if (aka.typ === 'bana') {
          const L = banLage();
          if (L.n > aka.n) avAka();   // nästa avgång har börjat – tåget är inne: kliv av
          else if (L.n === aka.n) {
            for (const p of aakare(L)) if (p && !p.jag && !p.npc && !aka.ihop.has(p.namn)) { aka.ihop.add(p.namn); play('ok'); toast($t`🎢 Du och ${p.namn} åker tillsammans!`, 'good'); }
            const v = vagn(Math.floor(aka.plats / 2), L);
            if (v.ner && !aka.skrek && L.tau > 2) { aka.skrek = true; talk.say($t('AAAAH! 😱'), () => { const q = vagn(Math.floor(aka?.plats / 2) || 0, banLage()); return { x: q.x, y: q.y - 38 }; }, 1.6, { silent: true }); }
            if (!v.ner) aka.skrek = false;
          }
        }
      }
      updLiv(dt);
      updBallongis(dt);
      updClowner(dt);
      updRadio(dt);
      if (pets && !aka) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren på Pixelberg:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 6); cam.y += (c.y - cam.y) * Math.min(1, dt * 6);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x) + (skak > 0 ? Math.round(Math.sin(t * 90) * 2) : 0), cy = Math.round(cam.y) + (skak > 0 ? Math.round(Math.cos(t * 70)) : 0);
      // himlen ovanför och utsikten ner över staden precis bakom bergets kant (hjulet och banan står mot himlen)
      const ut = utsiktCanvas(N), utY = P.HIMMEL + 6 - cy - ut.height, sky = skyCanvas(VW, N, D);
      ctx.fillStyle = N ? '#141c3a' : D ? '#4a5a98' : '#5aa0e0'; ctx.fillRect(0, 0, VW, Math.max(0, utY + 50));
      ctx.drawImage(sky, 0, utY + 60 - sky.height);
      const off = -Math.round(cx * 0.4) % ut.width;
      for (let x = off; x < VW; x += ut.width) ctx.drawImage(ut, x, utY);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      ritaMonorail(ctx, t, cx, VW);
      ctx.drawImage(banaBild(), 0, 0);
      ritaTag(ctx);
      const items = [];
      items.push({ fy: HJUL.fot - 6, draw: () => ritaHjul(ctx, N, false) });   // ställningen (gondolerna strax efter)
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      items.push({ fy: HJUL.fot - 5, draw: () => ritaHjul(ctx, N, true) });
      items.push({ fy: KARUSELL.y - KARUSELL.ry - 1, draw: () => ritaKarusell(ctx, N, 'golv') });
      for (let i = 0; i < HASTAR; i++) { const h = hast(i); items.push({ fy: h.y, draw: () => drawHast(ctx, i) }); }
      items.push({ fy: KARUSELL.y + 0.5, draw: () => ritaKarusell(ctx, N, 'tak') });
      items.push({ fy: BILJETT.y, draw: () => ctx.drawImage(biljettBild(N), BILJETT.x, BILJETT.y - 64) });
      for (const Fa of FASADER) if (syns(Fa.x + Fa.w / 2, 100)) items.push({ fy: MAINSTREET_Y, draw: () => ritaFasad(ctx, Fa, N) });
      // 🎭 temaländerna: sagolandets brunn och svampar, västerns kaktusar och hövagn, Spökgränds kyrkogård
      if (syns(TEMAN.BRUNN.x)) items.push({ fy: TEMAN.BRUNN.y, draw: () => ritaOnskebrunn(ctx, TEMAN.BRUNN.x, TEMAN.BRUNN.y, t) });
      for (const [sx, sy, si] of TEMAN.SVAMPAR) if (syns(sx)) items.push({ fy: sy, draw: () => ritaSvampar(ctx, sx, sy, si) });
      for (const [kx, ky] of TEMAN.KAKTUSAR) if (syns(kx)) items.push({ fy: ky, draw: () => ritaKaktus(ctx, kx, ky) });
      if (syns(TEMAN.VAGN.x)) items.push({ fy: TEMAN.VAGN.y, draw: () => ritaVagn(ctx, TEMAN.VAGN.x, TEMAN.VAGN.y) });
      if (syns(TEMAN.KYRKOGARD.x0, 200)) {
        const KG = TEMAN.KYRKOGARD;
        items.push({ fy: KG.y0 - 20, draw: () => ritaKyrkogardsstaket(ctx, KG.x0, KG.x1, KG.y0 - 4) });
        for (const [gx, gy, gi] of TEMAN.GRAVAR) items.push({ fy: gy, draw: () => ritaGravsten(ctx, gx, gy, gi) });
        items.push({ fy: TEMAN.KRYPTA.y, draw: () => ritaKrypta(ctx, TEMAN.KRYPTA.x, TEMAN.KRYPTA.y, N) });
        items.push({ fy: KG.y1, draw: () => ritaKyrkogardsstaket(ctx, KG.x0, KG.x1, KG.y1) });
      }
      for (const [dx, dy] of TEMAN.DODA_TRAD) if (syns(dx)) items.push({ fy: dy, draw: () => ritaDottTrad(ctx, dx, dy, t) });
      // 🎟️ entrén: staketet med porten, bussgatan med kuren och bergbussen, kartan, cykelstället, planteringarna – och
      // entréplatsen innanför med fontänen, topiaryerna, flaggstängerna, lyktorna och bänkarna
      if (cx < ENTRE.STAKET_X1 + 120) {
        const E = ENTRE, pw = E.PORT.w >> 1;
        items.push({ fy: E.STAKET_Y, draw: () => { ritaStaket(ctx, 0, E.PORT.cx - pw - 14, E.STAKET_Y); ritaStaket(ctx, E.PORT.cx + pw + 14, E.STAKET_X1, E.STAKET_Y); } });
        for (let y = E.STAKET_Y + 4; y <= TH; y += 4) items.push({ fy: y, draw: () => ritaStaketstolpe(ctx, E.STAKET_X1, y, (y - E.STAKET_Y) % 24 === 4) });
        items.push({ fy: E.STAKET_Y + 0.5, draw: () => ritaPort(ctx, t, N) });
        items.push({ fy: E.KUR.y, draw: () => ritaBusskur(ctx, E.KUR.x, E.KUR.y, N) }, { fy: E.HALLPLATS.y, draw: () => ritaHallplatsskylt(ctx, E.HALLPLATS.x, E.HALLPLATS.y) });
        items.push({ fy: E.BUSS.y, draw: () => ritaBuss(ctx, E.BUSS.x, E.BUSS.y, t) }, { fy: E.KARTA.y, draw: () => ritaKarta(ctx, E.KARTA.x, E.KARTA.y) }, { fy: E.CYKLAR.y, draw: () => ritaCykelstall(ctx, E.CYKLAR.x, E.CYKLAR.y) });
        for (const [px, py] of E.PLANTERINGAR) items.push({ fy: py, draw: () => ritaPlantering(ctx, px, py) });
        items.push({ fy: E.FONTAN.y + 12, draw: () => ritaFontanStor(ctx, E.FONTAN.x, E.FONTAN.y, t) });
        for (const [tx, ty, typ] of E.TOPIARY) items.push({ fy: ty, draw: () => ritaTopiary(ctx, tx, ty, typ) });
        E.FLAGGOR.forEach((fx, i) => items.push({ fy: E.STAKET_Y - 6, draw: () => ritaFlagga(ctx, fx, E.STAKET_Y - 6, t, [0xe04848, 0x3a7bd5, 0xf0c030, 0x46a35a][i % 4], i) }));
        for (const [lx, ly] of E.LYKTOR) items.push({ fy: ly, draw: () => KIT.lamp(ctx, lx, ly, 1) });
        for (const [bx, by] of E.BANKAR) items.push({ fy: by, draw: () => KIT.bench(ctx, bx, by) });
      }
      for (const s of STAND) if (syns(s.cx, 120)) items.push({ fy: s.y, draw: () => ritaStand(ctx, s, N) });
      for (const u of UTESERVERING) if (syns(u.x)) items.push({ fy: u.y, draw: () => KIT.cafe(ctx, u.x, u.y, u.f) });
      // 🎈 de som äter vid borden, köerna vid matstånden, jonglören, ballongförsäljaren och ens egen ballong
      for (const a of ATARE) if (syns(a.x)) items.push({ fy: a.y + 0.6, draw: () => drawPerson(ctx, a.x, a.y, a.look, a.dir, Math.sin(t * 1.7 + a.x) > 0.3 ? 6 : 5) });
      for (const q of KOFOLK) {
        const fas = Math.floor(t / 17 + q.s.cx * 0.013) % 3;
        if ((q.k === 0 && fas === 0) || (q.k === 1 && fas !== 2) || !syns(q.s.cx)) continue;
        const qx = q.s.cx - 8 + q.k * 14, qy = q.s.y + 12 + q.k * 3;
        items.push({ fy: qy, draw: () => drawPerson(ctx, qx, qy, q.look, 'up', Math.sin(t * 2 + qx) > 0.95 ? 4 : 0) });
      }
      for (const s of STALL) if (syns(s.cx, 60)) items.push({ fy: s.y, draw: () => ritaStall(ctx, s, N) });
      // 🎉 dekorationerna: flaggorna, portalerna, tekopparna, fontänen, såpbubblorna, konfettin och tivolilyktorna
      for (const f of DEKO.flaggor) if (syns(f.x)) items.push({ fy: f.y, draw: () => ritaFlagga(ctx, f.x, f.y, t, f.f, f.x * 0.01) });
      for (const p of DEKO.portaler) if (p.x1 > cx - 60 && p.x0 < cx + VW + 60) items.push({ fy: p.y + 0.5, draw: () => ritaPortal(ctx, p.x0, p.x1, p.y, p.namn, t, N || D, p.f) });
      const K = DEKO.tekopp;
      if (syns(K.x)) {
        items.push({ fy: K.y - 10, draw: () => ritaTekopparGolv(ctx, K.x, K.y, t, N || D) });
        for (let i = 0; i < 4; i++) { const p = koppPos(i, t, K.x, K.y); items.push({ fy: p.y + 1, draw: () => ritaKopp(ctx, i, K.x, K.y, t, aka?.typ === 'kopp' && aka.i === i ? A.avatar.look : KOPPFOLK[i]) }); }
      }
      if (syns(DEKO.fontan.x)) items.push({ fy: DEKO.fontan.y + 9, draw: () => ritaFontan(ctx, DEKO.fontan.x, DEKO.fontan.y, t) });
      if (syns(DEKO.bubbel.x)) items.push({ fy: DEKO.bubbel.y, draw: () => ritaBubblor(ctx, DEKO.bubbel.x, DEKO.bubbel.y, t) });
      if (syns(DEKO.konfetti.x)) items.push({ fy: DEKO.konfetti.y, draw: () => ritaKonfetti(ctx, DEKO.konfetti.x, DEKO.konfetti.y, t) });
      for (const l of DEKO.lyktor) if (syns(l.x)) items.push({ fy: l.y, draw: () => ritaTivolilykta(ctx, l.x, l.y, t, N || D) });
      for (const c of CLOWNER) if (syns(c.x)) items.push({ fy: c.y, draw: () => {
        if (c.katt) {
          const x0 = Math.round(c.x) - 7, y0 = Math.round(c.y) - 18, vink = c.vila > 0 && Math.floor(t * 6) % 2;
          ctx.fillStyle = 'rgba(30,20,20,.2)'; ctx.fillRect(x0 + 1, y0 + 17, 12, 2);
          KATTEN.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; if (vink && j >= 13 && i >= 12) continue; ctx.fillStyle = ch === 'k' ? '#3a2418' : ch === 'w' ? '#fffaf0' : ch === 'o' ? '#f08a2a' : ch === 'p' ? '#1e1a24' : '#ff9ac0'; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
          if (vink) { ctx.fillStyle = '#f08a2a'; ctx.fillRect(x0 + 13, y0 + 9, 2, 4); }
        } else drawPerson(ctx, c.x, c.y, c.look, c.dir, c.vila > 0 ? (Math.floor(t * 2) % 2 ? 11 : 0) : WALK_SEQ[Math.floor(t * 7 + c.fro) % 4]);
        knippe(ctx, c.x + (c.dir === 'left' ? -6 : 6), c.y - (c.katt ? 12 : 16), t, c.fro, 6, 20);
      } });
      if (syns(JONGLOR.x)) items.push({ fy: JONGLOR.y, draw: () => { drawPerson(ctx, JONGLOR.x, JONGLOR.y, JONGLOR.look, 'down', Math.floor(t * 2.8) % 2 ? 10 : 0); jonglerar(ctx, JONGLOR.x, JONGLOR.y, t); } });
      if (syns(BALLONGIS.x)) items.push({ fy: BALLONGIS.y, draw: () => { drawPerson(ctx, BALLONGIS.x, BALLONGIS.y, BALLONGIS.look, BALLONGIS.dir, BALLONGIS.vila > 0 ? 0 : WALK_SEQ[Math.floor(t * 6) % 4]); knippe(ctx, BALLONGIS.x + (BALLONGIS.dir === 'left' ? -5 : 5), BALLONGIS.y - 15, t, 2, 9, 26); } });
      const mb = minBallong();
      if (mb && (!aka || iKo())) items.push({ fy: walker.py + 0.3, draw: () => enBallong(ctx, walker.px + (walker.dir === 'left' ? -5 : 5), walker.py - 15, mb, t) });
      for (const s of STAND) if (syns(s.cx, 120)) items.push({ fy: s.y + 0.2, draw: () => knippe(ctx, s.mat ? s.x + s.w + 10 : s.x - 2, s.mat ? s.y - 15 : s.y - 6, t, s.cx & 7, 3, 16) });
      items.push({ fy: BANA.station.y, draw: () => ctx.drawImage(stationBild(N), BANA.station.x, BANA.station.y - 50) });

      if (syns(SPOK.x + SPOK.w / 2, 200)) {
        const SL = spokL(), sv = spokVagn(SL);
        items.push({ fy: SPOK.y, draw: () => {
          ctx.drawImage(spokBild(N), SPOK.x, SPOK.y - SPOK_H);
          ritaSpoktitt(ctx, SPOK.x + SPOK_VINDSFONSTER.x, SPOK.y - SPOK_H + SPOK_VINDSFONSTER.y, t);
          for (let k = 0; k < 3; k++) { const v = t * 1.3 + k * 2.1; ritaFladdermus(ctx, Math.round(SPOK.x + 20 + Math.cos(v) * 26), Math.round(SPOK.y - SPOK_H + 2 + Math.sin(v * 1.7) * 8), t, k); }
        } });
        if (sv.synlig) items.push({ fy: sv.y + 4, draw: () => {
          const sitt = spokAkare(SL);
          ritaSpokVagn(ctx, sv.x, sv.y, sitt, t, false);
          sitt.forEach((r, s) => { if (r?.av) nameTag(ctx, Math.round(sv.x) + (s ? 5 : -4), Math.round(sv.y) - 38, r.av); });
        } });
        if (SL.station) items.push({ fy: SPOK_SPAR.y1 + 30, draw: () => { const s = $t`VAGNEN GÅR OM ${Math.max(1, Math.ceil(SL.kvar))}`, w = textW(SMALL, s) + 8; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(SPOK_SPAR.cx - (w >> 1), SPOK_SPAR.y1 + 18, w, 10); ctxText(ctx, SMALL, s, SPOK_SPAR.cx - (w >> 1) + 4, SPOK_SPAR.y1 + 20, '#a8ff78'); } });
      }
      if (syns(RADIO.x + RADIO.w / 2, 200)) {
        items.push({ fy: RADIO.y - 1, draw: () => { ctx.drawImage(radioBild(N), RADIO.x, RADIO.y - RADIO_H + 6); ritaRadioKant(ctx, 'sidor'); } });
        for (const b of npcBilar) items.push({ fy: b.y, draw: () => ritaBil(ctx, b, false) });
        for (const b of fjarr.values()) items.push({ fy: b.y, draw: () => ritaBil(ctx, b, true) });
        if (aka?.typ === 'radio') items.push({ fy: aka.bil.y, draw: () => ritaBil(ctx, aka.bil, false) });
        items.push({ fy: RADIO.y + RADIO.h + 1, draw: () => ritaRadioKant(ctx, 'fram') });
      }

      for (const b of BANKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.bench(ctx, b.x, b.y) });
      for (const l of LYKTOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => KIT.lamp(ctx, l.x, l.y, 1) });
      for (const b of BUSKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.tree(ctx, 'lind', b.x, b.y, { vind: Math.round(Math.sin(t + b.x) * 0.5) }) });
      for (const l of LADOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => ritaLada(ctx, l.x, l.y, l.typ) });   // 🪴 lådraden längs promenaden
      for (const o of besok) if (syns(o.x)) items.push({ fy: o.y, draw: () => { drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8 + o.x) % 4] : 0); if (o.ballong) drawBallong(ctx, o); } });
      items.push({ fy: nalle.y, draw: () => ritaNalle(ctx) });
      items.push(...folkDrawables(A, t));
      if (pets && !aka) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      if (!aka || iKo()) items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: null }));
      // 🧇 maten i handen: framför figuren åt det håll man går, bakom när man går uppåt
      if (hand && (!aka || iKo())) { const bak = walker.dir === 'up', hx = walker.px + (walker.dir === 'down' ? 5 : bak ? -5 : walker.dir === 'left' ? -6 : 6); items.push({ fy: walker.py + (bak ? -0.3 : 0.3), draw: () => ritaIHand(ctx, hx, walker.py - 13, hand.id, hand.bit, walker.dir) }); }
      for (const f of koande()) items.push({ fy: f.y, draw: () => { drawPerson(ctx, f.x, f.y, f.av.look, 'up', 0); nameTag(ctx, f.x, f.y - 50, f.av); } });
      ritaSlingor(ctx, N || D);   // (slingorna hänger mellan lyktorna längst bak – bakom stånden)
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      for (const o of bommar) ritaBom(ctx, o);
      // vimpelstängerna och vimpelbanden längs torgets framkant (längst fram)
      for (let k = 0; k < STANGER.length; k++) {
        const x = STANGER[k];
        if (x < cx - 240 || x > cx + VW + 240) continue;
        for (let y = 428; y < 476; y++) { ctx.fillStyle = Math.floor(y / 4) % 2 ? '#e04848' : '#f4f1ea'; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = 'rgba(30,20,40,.35)'; ctx.fillRect(x + 2, y, 1, 1); }
        ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 1, 425, 4, 3); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 1, 425, 1, 1);
        if (k < STANGER.length - 1) vimpelband(ctx, x + 1, 429, STANGER[k + 1] + 1, 429, t, 11, k * 2);
      }
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.5)' : 'rgba(60,40,90,0.18)'; ctx.fillRect(0, 0, VW, VH);
        ctx.save(); ctx.translate(-cx, -cy); for (const l of [...LYKTOR, ...ENTRE.LYKTOR.map(([x, y]) => ({ x, y }))]) if (l.x > cx - 40 && l.x < cx + VW + 40) { KIT.lampGlow(ctx, l.x, l.y, N ? 1 : 0.5); KIT.lampLit(ctx, l.x, l.y); } ctx.restore();
        // 🎪 stånden lyser genom mörkret: skylten och den övre delen av insidan ritas igen ovanpå hinnan (inte där folk
        // står framför disken), lamporna tänds och skenet läggs på
        ctx.save(); ctx.translate(-cx, -cy);
        for (const s of STAND) if (syns(s.cx, 120)) {
          const sk = s.def.skyltRuta;
          ctx.save(); ctx.globalAlpha = N ? 0.82 : 0.5; ctx.beginPath(); ctx.rect(s.x + 6, s.y - 61, s.w - 12, 31); if (sk) ctx.rect(s.cx + sk.x0, s.y + sk.y0, sk.bw, sk.bh); ctx.clip();
          ritaStand(ctx, s, N); ctx.restore();
          ritaLampor(ctx, s.cx, s.y, standBilder(s.def, N).lampor, t, true, s.cx & 7);
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const s of STAND) if (syns(s.cx, 120)) ritaSken(ctx, s.cx, s.y, s.def, standBilder(s.def, N).lampor, t);
        for (const l of DEKO.lyktor) if (syns(l.x)) { const gr = ctx.createRadialGradient(l.x, l.y - 41, 1, l.x, l.y - 41, 24); gr.addColorStop(0, 'rgba(255,236,170,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(l.x - 24, l.y - 65, 48, 48); }
        for (const s of STALL) if (syns(s.cx, 60)) { const gr = ctx.createRadialGradient(s.cx, s.y - 26, 2, s.cx, s.y - 26, 40); gr.addColorStop(0, 'rgba(255,210,140,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(s.cx - 40, s.y - 66, 80, 80); }
        ctx.globalCompositeOperation = 'source-over';
        for (const s of STALL) if (syns(s.cx, 60)) ritaLampor(ctx, s.cx, s.y, stallBilder(s.def, N).lampor, t, true, s.cx & 7);
        ctx.restore();
        if (N) {
          // tivolits sken: hjulet, karusellen och stånden lyser genom mörkret
          ctx.save(); ctx.translate(-cx, -cy); ctx.globalCompositeOperation = 'lighter';
          const sken = (x, y, r, c) => { const gr = ctx.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
          sken(HJUL.x, HJUL.y, HJUL.r + 30, 'rgba(255,170,90,.28)'); sken(KARUSELL.x, KARUSELL.y - 60, 80, 'rgba(255,210,120,.3)');
          for (const l of LADOR) { const p = pumpaSken(l); if (p && syns(l.x)) sken(p.x, p.y, 12, 'rgba(255,150,40,.35)'); }   // 🎃 pumporna i Spökgränd

          sken(PORT.x, PORT.y - PORT.h + 10, 60, 'rgba(255,230,140,.25)'); sken(ENTRE.FONTAN.x, ENTRE.FONTAN.y - 30, 50, 'rgba(160,210,255,.2)');
          for (const Fa of FASADER) { sken(Fa.x - 2, MAINSTREET_Y - 20, 16, 'rgba(255,220,140,.3)'); sken(Fa.x + Fa.w + 1, MAINSTREET_Y - 20, 16, 'rgba(255,220,140,.3)'); }
          sken(RADIO.x + RADIO.w / 2, RADIO.y - 50, 90, 'rgba(255,120,140,.22)');
          for (const [wx, wy] of [[58, 72], [142, 72], [100, 34], [20, 62], [180, 70]]) sken(SPOK.x + wx, SPOK.y - SPOK_H + wy, 26, 'rgba(180,255,120,.22)');
          for (const b of [...npcBilar, ...fjarr.values(), ...(aka?.typ === 'radio' ? [aka.bil] : [])]) sken(b.x, b.y - 30, 10, 'rgba(160,210,255,.35)');
          for (const l of LYKTOR) sken(l.x + 10, l.y - 56, 30, 'rgba(255,200,140,.18)');
          ctx.restore();
        }
      }
      if ((N || D) && cx + VW > TEMAN.DIMMA.x0) { ctx.save(); ctx.translate(-cx, -cy); ritaDimma(ctx, TEMAN.DIMMA, t, N ? 0.2 : 0.1); ctx.restore(); }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      // 👻 inne i spökhuset: korridoren över hela skärmen
      if (sitterISpok()) { const L = spokL(); if (L.inne) ritaSpokInne(ctx, VW, VH, L.i, spokAkare(L), t); }
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('PIXELBERG'), s2 = $t('TIVOLIT PÅ BERGET'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#ff8ac8', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      if (aka?.typ === 'radio') {
        // 🚗 tiden och krockarna överst; de sista sekunderna bryts strömmen
        const kvar = Math.max(0, Math.ceil(RUNDA - aka.t)), s1 = aka.slut ? $t('STRÖMMEN BRYTS!') : $t`TID ${kvar}   KROCKAR ${aka.krockar}`, w = textW(SMALL, s1) + 10;
        ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, VH - 15, w, 11); ctxText(ctx, SMALL, s1, ((VW - w) >> 1) + 5, VH - 12, aka.slut ? '#ff8a8a' : '#ffd23f');
        if (spak) {   // dra-styrspaken
          ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 48; k++) { const v = k / 48 * Math.PI * 2; ctx.fillRect(Math.round(spak.x0 + Math.cos(v) * 18), Math.round(spak.y0 + Math.sin(v) * 18), 1, 1); }
          const dx = spak.x - spak.x0, dy = spak.y - spak.y0, d = Math.hypot(dx, dy), k = d > 14 ? 14 / d : 1, kx = Math.round(spak.x0 + dx * k), ky = Math.round(spak.y0 + dy * k);
          ctx.fillStyle = 'rgba(255,210,63,.75)'; ctx.fillRect(kx - 4, ky - 3, 9, 7); ctx.fillRect(kx - 3, ky - 4, 7, 9);
        }
      }
      const s = !aka && hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (aka?.typ === 'radio') { spak = { x0: sx, y0: sy, x: sx, y: sy }; return; }   // 🚗 dra-styrspaken
      // i kön till nästa tåg: ett tryck någon annanstans = lämna kön (kupongen tillbaka)
      if (aka?.typ === 'bana' && !sitterIBana()) { aka = null; if (!harBand()) { g.money += KUPONG; g.save(); } toast($t('🎢 Du lämnade kön.')); return; }
      if (aka?.typ === 'spok' && !sitterISpok()) { aka = null; if (!harBand()) { g.money += KUPONG; g.save(); } toast($t('👻 Du lämnade kön.')); return; }
      // 🎠 karusellen och tekopparna: ett tryck var som helst = hoppa av (Carl 2026-10-14: "man måste kunna hoppa av
      // karusellen som går runt runt och inte tvingas åka flera varv")
      if ((aka?.typ === 'karusell' || aka?.typ === 'kopp') && aka.t > 1) { avAka(); return; }
      if (fade.phase === 1 || aka) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const fk = folkTapAt(A, x, y);   // 💛 en annan spelare: spelarkortet (bli vänner, SMS)
      if (fk) { openSpelarkort(A, fk); return; }
      const cl = clownAt(x, y);
      if (cl) { cl.vila = Math.max(cl.vila, 4); walker.walkTo(cl.x + (walker.px < cl.x ? -16 : 16), cl.y + 2, () => fanBallong(cl)); return; }
      if (ballongisAt(x, y)) { walker.walkTo(BALLONGIS.x + (walker.px < BALLONGIS.x ? -14 : 14), BALLONGIS.y + 2, () => { BALLONGIS.vila = 5; kopBallong(); }); return; }
      if (jonglorAt(x, y)) { walker.walkTo(JONGLOR.x + (walker.px < JONGLOR.x ? -16 : 16), JONGLOR.y + 2, () => { talk.say($t('*Jonglören fångar alla tre käglorna och bugar!*'), () => ({ x: JONGLOR.x, y: JONGLOR.y - 50 }), 3, { silent: true }); const h = g.glad?.(1, '', 'tivoli-jonglor', 1); if (h) toast(`🤹 +${h} 😊`); }); return; }
      if (nalleAt(x, y)) { walker.walkTo(nalle.x + (walker.px < nalle.x ? -14 : 14), nalle.y + 2, () => { nalle.vinkar = 2.5; nalle.vila = 3; talk.say($t('*Pixel-Nalle vinkar och gör en high five!*'), () => ({ x: nalle.x, y: nalle.y - 30 }), 3, { silent: true }); const h = g.glad?.(1, '', 'pixelnalle', 1); if (h) toast(`🐻 +${h} 😊`); }); return; }
      const o = folkAt(x, y);
      if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look })); return; }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; if (spak) { spak.x = sx; spak.y = sy; } },
    up() { spak = null; },
    key(k) { if (k === 'Escape' && aka?.typ === 'radio') avAka(); else if ((k === 'Escape' || k === ' ') && (aka?.typ === 'karusell' || aka?.typ === 'kopp') && aka.t > 1) avAka(); },
    exit() { talk.clear(); window.removeEventListener('keydown', tNer, true); window.removeEventListener('keyup', tUpp, true); window.removeEventListener('blur', tBort); },
    _debug: {
      pos: () => ({ x: walker.px, y: walker.py }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      spots: () => spots().map((q) => q.id),
      aka: () => (aka ? { typ: aka.typ, t: aka.t, i: aka.i, toppen: !!aka.toppen } : null),
      snabba: (sek) => { t += sek; if (aka) aka.t += sek; if (hand) hand.t += sek; },   // (testerna: spola fram åkturen och tuggorna)
      hand: () => (hand ? { id: hand.id, bit: hand.bit } : null),
      lador: () => LADOR.map((l) => [l.x, l.y, l.typ]),
      band: () => harBand(),
      bana: () => { const L = banLage(); return { n: L.n, station: L.station, tau: L.tau, aka: aka?.typ === 'bana' ? { n: aka.n, plats: aka.plats } : null, platser: aakare(L).map((p) => (p ? (p.jag ? 'jag' : p.npc ? 'npc' : p.namn) : null)) }; },
      akBana: () => akBana(),
      spok: () => { const L = spokL(), v = spokVagn(L); return { n: L.n, u: L.u, station: L.station, inne: L.inne, i: L.i, vagn: v, aka: aka?.typ === 'spok' ? { n: aka.n, plats: aka.plats } : null, platser: spokAkare(L).map((p) => (p ? (p.jag ? 'jag' : p.npc ? 'npc' : p.namn) : null)) }; },
      akSpok: () => akSpok(),
      ballongis: () => ({ x: BALLONGIS.x, y: BALLONGIS.y }), clowner: () => CLOWNER.map((c) => ({ x: c.x, y: c.y, katt: !!c.katt })), fanBallong: (i) => fanBallong(CLOWNER[i]), stall: () => STALL.map((s) => s.id), akKopp: () => akKopp(), kopBallong: () => kopBallong(), minBallong: () => minBallong(),
      radio: () => ({ aka: aka?.typ === 'radio' ? { t: aka.t, c: aka.c, krockar: aka.krockar, x: aka.bil.x, y: aka.bil.y, vx: aka.bil.vx, vy: aka.bil.vy, dir: aka.bil.dir, med: [...aka.med] } : null, kompisar: [...fjarr.values()].map((b) => ({ namn: b.namn, x: b.x, y: b.y })), npc: npcBilar.map((b) => ({ x: b.x, y: b.y })), ruta: { RX0, RX1, RY0, RY1 } }),
      radioSatt: (x, y, vx, vy) => { if (aka?.typ === 'radio') Object.assign(aka.bil, { x, y, vx, vy }); },
      radioPark: (pa) => { npcPark = !!pa; if (pa) npcBilar.forEach((b, i) => Object.assign(b, { x: RX0 + i * 22, y: RY0, vx: 0, vy: 0 })); },
      prat: () => talk.text(),
    },
  };
}
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
