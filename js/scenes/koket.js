// KÖKET – matlagningen hemma (Carl 2026-10-01: "som när man gör pizzan: man väljer ett recept så
// hjälper spelet dig med hur du lagar allting … koka pastan, steka baconet och lägga allt på samma
// ställe och blanda ihop det. Man kan ha flera grytor och stekpannor, max fyra på spisen" +
// "samma scen för alla recept … storkok 5X och megakok 10X").
//
// En närbild av köksbänken. Samma scen för alla rätter – receptet (STEG) säger vad som ska göras:
//   väggen:   receptkortet (stegen, det aktuella i guld), grytlisten med två grytor och två
//             stekpannor, en hylla med ugnsformen och ingredienshyllan (receptets råvaror × n)
//   bänken:   skärbrädan (hacka), bunken (vispa/blanda), mixern, spishällen med fyra plattor
//             (vreden på fronten), diskhon med kranen (fyll vatten / häll av) och tallriken
//   under:    ugnen (formen in – den sätts på av sig själv)
// Man tar något i handen (klick) och klickar där det ska. En gul pil och textraden högst upp visar
// nästa steg; fel sak på fel ställe säger "inte nu" och visar steget. Plattorna värmer, vattnet
// kokar (bubblor och ånga), det som steks fräser – varje råvara har sin tid (KOK/STEK/UGN) och en
// liten mätare som blir ✓. När allt är upplagt ligger rätten (kok.js dishCanvas) på tallriken.
// Klockan står still här inne; Game.cook räknar tiden, råvarorna (× portionerna), matlådorna och
// kockvanan när man är klar. Avbryter man går inget åt.
import { Pix, SMALL, ctxText, textW, mix, mul, hash, bayer, css } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { receptOf, ravaraOf, portionOf, KOCK_TITLAR } from '../game.js';
import { ravaraIcon, choppedBits, ravaraPal } from '../core/ravara-art.js';
import { dishCanvas, dishFood, DW, DH } from './kok.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;

// ================= stegen per recept =================
// Typer: vatten (fyll grytan i diskhon) · stall (kärlet på en platta) · varme (vrid på plattan) ·
// i (råvaran i kärlet; hack = den hackade från skärbrädan) · hacka (på skärbrädan) · vanta (tills
// allt i kärlet är klart) · avrinn (häll av vattnet i diskhon) · hall (häll ett kärl i ett annat) ·
// vispa (klicka n gånger – vispa/röra/knåda) · ugn (formen in i ugnen) · mixa · upp (på tallriken).
// Kärlen är roller: gryta, panna, form, skal (bunken), mixer, tallrik – vilken av de två grytorna
// eller stekpannorna man tar spelar ingen roll (den första man använder blir "grytan").
const V = (v = 'gryta') => ({ t: 'vatten', v }), ST = (v) => ({ t: 'stall', v }), VA = (v) => ({ t: 'varme', v });
const I = (ing, v, hack = false) => ({ t: 'i', ing, v, hack }), H = (ing) => ({ t: 'hacka', ing });
const HI = (ing, v) => [H(ing), I(ing, v, true)], W = (v) => ({ t: 'vanta', v }), AV = (v = 'gryta') => ({ t: 'avrinn', v });
const HA = (from, to) => ({ t: 'hall', from, to }), VI = (v, n = 4) => ({ t: 'vispa', v, n }), UG = () => ({ t: 'ugn', v: 'form' });
const MX = () => ({ t: 'mixa', v: 'mixer' }), UP = (v) => ({ t: 'upp', v });
const KOKA = (ing) => [V('gryta'), ST('gryta'), VA('gryta'), I(ing, 'gryta')];   // vatten, på spisen, värme, i med det
const STEK = () => [ST('panna'), VA('panna')];
export const STEG = {
  fruktsallad: [...HI('applR', 'skal'), ...HI('banan', 'skal'), ...HI('apels', 'skal'), VI('skal', 3), UP('skal')],
  omelett: [I('agg', 'skal'), VI('skal', 4), ...STEK(), HA('skal', 'panna'), ...HI('tomat', 'panna'), I('ost', 'panna'), W('panna'), UP('panna')],
  ostmacka: [...HI('brod', 'tallrik'), I('smor', 'tallrik'), I('ost', 'tallrik'), ...HI('paprika', 'tallrik')],
  pannkakor: [I('mjol', 'skal'), I('agg', 'skal'), I('mjolk', 'skal'), VI('skal', 5), ...STEK(), HA('skal', 'panna'), W('panna'), UP('panna'), I('bar', 'tallrik')],
  grot: [...KOKA('havre'), I('mjolk', 'gryta'), W('gryta'), UP('gryta'), ...HI('applR', 'tallrik')],
  smoothie: [...HI('banan', 'mixer'), I('bar', 'mixer'), I('yoghurt', 'mixer'), MX(), UP('mixer')],
  pastapomodoro: [...KOKA('pasta'), ...STEK(), ...HI('lok', 'panna'), I('krossade', 'panna'), W('panna'), W('gryta'), AV(), HA('gryta', 'panna'), VI('panna', 3), UP('panna'), I('ost', 'tallrik')],
  potatissoppa: [V('gryta'), ST('gryta'), VA('gryta'), ...HI('potatis', 'gryta'), ...HI('morot', 'gryta'), ...HI('lok', 'gryta'), I('smor', 'gryta'), W('gryta'), VI('gryta', 4), UP('gryta')],
  tacos: [...STEK(), I('kottfars', 'panna'), W('panna'), I('tortilla', 'tallrik'), UP('panna'), ...HI('tomat', 'tallrik'), I('ost', 'tallrik')],
  kottbullar: [I('kottfars', 'skal'), I('agg', 'skal'), VI('skal', 5), ...KOKA('potatis'), ...STEK(), I('smor', 'panna'), HA('skal', 'panna'), W('panna'), W('gryta'), AV(), UP('gryta'), UP('panna')],
  kottfarssas: [...KOKA('pasta'), ...STEK(), ...HI('lok', 'panna'), I('kottfars', 'panna'), I('krossade', 'panna'), W('panna'), W('gryta'), AV(), UP('gryta'), UP('panna')],
  chili: [ST('gryta'), VA('gryta'), ...HI('lok', 'gryta'), I('kottfars', 'gryta'), I('krossade', 'gryta'), I('bonor', 'gryta'), W('gryta'), VI('gryta', 3), UP('gryta')],
  kycklingris: [...KOKA('ris'), ...STEK(), ...HI('kyckling', 'panna'), ...HI('paprika', 'panna'), W('panna'), W('gryta'), AV(), UP('gryta'), UP('panna')],
  ugnskyckling: [...HI('potatis', 'form'), I('kyckling', 'form'), ...HI('citron', 'form'), I('smor', 'form'), UG(), W('form'), UP('form')],
  kycklingwrap: [...STEK(), ...HI('kyckling', 'panna'), W('panna'), I('tortilla', 'tallrik'), UP('panna'), ...HI('tomat', 'tallrik'), I('ost', 'tallrik')],
  carbonara: [...KOKA('pasta'), ...STEK(), ...HI('bacon', 'panna'), I('agg', 'skal'), I('ost', 'skal'), VI('skal', 4), W('panna'), W('gryta'), AV(), HA('gryta', 'panna'), HA('skal', 'panna'), VI('panna', 3), UP('panna')],
  bonchili: [ST('gryta'), VA('gryta'), ...HI('lok', 'gryta'), ...HI('paprika', 'gryta'), I('krossade', 'gryta'), I('bonor', 'gryta'), W('gryta'), UP('gryta')],
  hempizza: [I('mjol', 'skal'), VI('skal', 5), HA('skal', 'form'), I('krossade', 'form'), I('ost', 'form'), ...HI('champ', 'form'), UG(), W('form'), UP('form')],
  fiskpotatis: [...KOKA('potatis'), I('fisk', 'form'), ...HI('citron', 'form'), I('smor', 'form'), UG(), W('form'), W('gryta'), AV(), UP('gryta'), UP('form')],
  svamprisotto: [...KOKA('ris'), ...STEK(), ...HI('lok', 'panna'), ...HI('champ', 'panna'), W('panna'), W('gryta'), AV(), HA('panna', 'gryta'), I('ost', 'gryta'), VI('gryta', 4), UP('gryta')],
  wok: [...KOKA('ris'), ...STEK(), ...HI('paprika', 'panna'), ...HI('morot', 'panna'), ...HI('aubergine', 'panna'), VI('panna', 3), W('panna'), W('gryta'), AV(), UP('gryta'), UP('panna')],
  guacamole: [...HI('avokado', 'skal'), ...HI('lime', 'skal'), ...HI('tomat', 'skal'), ...HI('rodlok', 'skal'), VI('skal', 4), I('tortilla', 'form'), UG(), W('form'), UP('skal'), UP('form')],
  appelkaka: [...HI('applG', 'form'), I('mjol', 'skal'), I('smor', 'skal'), I('agg', 'skal'), VI('skal', 4), HA('skal', 'form'), UG(), W('form'), UP('form')],
  tropisk: [...HI('ananas', 'skal'), ...HI('melon', 'skal'), ...HI('kiwi', 'skal'), ...HI('granat', 'skal'), VI('skal', 2), UP('skal')],
};
// sekunder på värmen innan råvaran är klar: i kokande vatten / i pannan (eller en torr gryta) / i ugnen
const KOK = { pasta: 7, ris: 8, potatis: 8, havre: 4, mjolk: 2, morot: 6, lok: 4, smor: 0 };
const STEKT = { bacon: 5, kyckling: 6, kottfars: 6, lok: 3, champ: 4, paprika: 3, morot: 4, aubergine: 4, agg: 4, mjol: 4, mjolk: 3, krossade: 3, bonor: 3, smor: 0, tomat: 1, ost: 1, potatis: 6 };
const UGN = { fisk: 7, kyckling: 8, potatis: 8, mjol: 7, applG: 6, tortilla: 4, krossade: 4, ost: 3, champ: 4 };
const RAW = new Set(['skal', 'mixer', 'tallrik']);   // här lagas inget (blanda, mixa, lägga upp)

// ================= namnen i texterna =================
const BEST = { pasta: $t('PASTAN'), ris: $t('RISET'), potatis: $t('POTATISEN'), havre: $t('HAVREGRYNEN'), mjolk: $t('MJÖLKEN'), morot: $t('MOROTEN'), lok: $t('LÖKEN'), rodlok: $t('RÖDLÖKEN'),
  smor: $t('SMÖRET'), bacon: $t('BACONET'), kyckling: $t('KYCKLINGEN'), kottfars: $t('KÖTTFÄRSEN'), champ: $t('CHAMPINJONERNA'), paprika: $t('PAPRIKAN'), aubergine: $t('AUBERGINEN'),
  agg: $t('ÄGGEN'), mjol: $t('MJÖLET'), krossade: $t('TOMATERNA'), bonor: $t('BÖNORNA'), tomat: $t('TOMATEN'), ost: $t('OSTEN'), fisk: $t('FISKEN'), bar: $t('BÄREN'), tortilla: $t('TORTILLAN'),
  brod: $t('LIMPAN'), yoghurt: $t('YOGHURTEN'), applR: $t('ÄPPLET'), applG: $t('ÄPPLET'), apels: $t('APELSINEN'), banan: $t('BANANEN'), citron: $t('CITRONEN'), lime: $t('LIMEN'),
  avokado: $t('AVOKADON'), ananas: $t('ANANASEN'), melon: $t('MELONEN'), kiwi: $t('KIWIN'), granat: $t('GRANATÄPPLET') };
const best = (ing) => BEST[ing] || (ravaraOf(ing)?.name || ing).toUpperCase();
const PLURAL = new Set(['champ', 'bonor', 'agg', 'bar', 'havre', 'krossade']);
const KARL = { gryta: $t('GRYTAN'), panna: $t('STEKPANNAN'), form: $t('FORMEN'), skal: $t('BUNKEN'), mixer: $t('MIXERN'), tallrik: $t('TALLRIKEN') };
const KORT = { gryta: $t('grytan'), panna: $t('pannan'), form: $t('formen'), skal: $t('bunken'), mixer: $t('mixern'), tallrik: $t('tallriken') };
const kort = (ing) => (ravaraOf(ing)?.name || ing).replace(/^Krossade tomater$/, $t('Tomater'));
function stepText(s, k) {
  switch (s.t) {
    case 'vatten': return $t`FYLL ${KARL[s.v]} MED VATTEN I DISKHON`;
    case 'stall': return $t`STÄLL ${KARL[s.v]} PÅ SPISEN`;
    case 'varme': return $t`VRID PÅ PLATTAN UNDER ${KARL[s.v]}`;
    case 'i': return s.hack ? (PLURAL.has(s.ing) ? $t`LÄGG DE HACKADE ${best(s.ing)} I ${KARL[s.v]}` : $t`LÄGG DEN HACKADE ${best(s.ing)} I ${KARL[s.v]}`) : $t`LÄGG ${best(s.ing)} I ${KARL[s.v]}`;
    case 'hacka': return $t`HACKA ${best(s.ing)} PÅ SKÄRBRÄDAN`;
    case 'vanta': return $t`VÄNTA TILLS ${KARL[s.v]} ÄR KLAR`;
    case 'avrinn': return $t('HÄLL AV VATTNET I DISKHON');
    case 'hall': return $t`HÄLL ${KARL[s.from]} I ${KARL[s.to]}`;
    case 'vispa': return s.v === 'skal' ? (k?.knad ? $t`KNÅDA I ${KARL[s.v]} (${Math.min(s.n, k?.stirs || 0)}/${s.n})` : $t`VISPA I ${KARL[s.v]} (${Math.min(s.n, k?.stirs || 0)}/${s.n})`) : $t`RÖR OM I ${KARL[s.v]} (${Math.min(s.n, k?.stirs || 0)}/${s.n})`;
    case 'ugn': return $t('IN MED FORMEN I UGNEN');
    case 'mixa': return $t('TRYCK PÅ MIXERN');
    case 'upp': return $t`LÄGG UPP ${KARL[s.v]} PÅ TALLRIKEN`;
  }
  return '';
}
function cardText(s) {
  switch (s.t) {
    case 'vatten': return $t('Vatten i grytan');
    case 'stall': return $t`${KORT[s.v][0].toUpperCase() + KORT[s.v].slice(1)} på spisen`;
    case 'varme': return $t('Värme på');
    case 'i': return $t`${kort(s.ing)} i ${KORT[s.v]}`;
    case 'hacka': return $t`Hacka: ${kort(s.ing).toLowerCase()}`;
    case 'vanta': return $t`Vänta på ${KORT[s.v]}`;
    case 'avrinn': return $t('Häll av vattnet');
    case 'hall': return $t`${KORT[s.from][0].toUpperCase() + KORT[s.from].slice(1)} i ${KORT[s.to]}`;
    case 'vispa': return s.v === 'skal' ? $t('Vispa i bunken') : $t`Rör om i ${KORT[s.v]}`;
    case 'ugn': return $t('Formen i ugnen');
    case 'mixa': return $t('Mixa');
    case 'upp': return $t`Lägg upp: ${KORT[s.v]}`;
  }
  return '';
}

// ================= geometrin =================
const BURN = [{ x: 166, y: 113 }, { x: 226, y: 113 }, { x: 166, y: 136 }, { x: 226, y: 136 }]; // bak v, bak h, fram v, fram h
const KNOB = [{ x: 152, b: 0 }, { x: 174, b: 2 }, { x: 214, b: 1 }, { x: 236, b: 3 }];      // vreden på fronten (y 155)
const RACK = { gryta1: { x: 142, y: 32 }, gryta2: { x: 178, y: 32 }, panna1: { x: 216, y: 30 }, panna2: { x: 256, y: 30 }, form: { x: 344, y: 55 } };
const BOARD = { x0: 8, x1: 70, y0: 106, y1: 140 };
const BOWL = { x: 92, y: 120 };
const MIXER = { x: 120, y: 132 };
const SINK = { x0: 262, x1: 318, y0: 104, y1: 142 };
const PLATE = { x: 350, y: 126 };
const OVEN = { x0: 142, x1: 246, y0: 164, y1: 212 };
const SHELF = { x0: 124, x1: 306, y: 74 };   // ingredienshyllan (hyllplanets ovansida)
const CARD = { x0: 4, x1: 112, y0: 4, y1: 94 };
const KIND = { gryta1: 'gryta', gryta2: 'gryta', panna1: 'panna', panna2: 'panna', form: 'form', skal: 'skal', mixer: 'mixer', tallrik: 'tallrik' };

// ================= målat en gång: väggen, bänken, spisen, ugnen =================
let BG = null;
function paintBg() {
  const P = new Pix(FW, FH);
  // kakelväggen: vitt tunnelbanekakel med grå fogar, lite gulare upptill (köksljus)
  for (let y = 0; y < 96; y++) for (let x = 0; x < FW; x++) {
    const row = Math.floor(y / 6), off = row & 1 ? 6 : 0, fx = (x + off) % 12, fy = y % 6;
    let c = mix(0xf4f0e6, 0xe2ddd0, y / 96);
    if (fy === 5 || fx === 11) c = 0xc8c2b4;
    else if (fy === 0 || fx === 0) c = mix(c, 0xffffff, 0.5);
    P.px(x, y, mix(c, 0x000000, (hash(x >> 2, y >> 2, 3) - 0.5) * 0.04));
  }
  // grytlisten (stålrör med krokar)
  P.rect(124, 20, 168, 2, 0x8a909a); P.hl(124, 20, 168, 0xd8dce4); P.rect(122, 18, 3, 6, 0x5a606a); P.rect(291, 18, 3, 6, 0x5a606a);
  for (const k of ['gryta1', 'gryta2', 'panna1', 'panna2']) { const x = RACK[k].x; P.vl(x, 22, 4, 0x5a606a); P.px(x + 1, 25, 0x5a606a); }
  // hyllan för formen (till höger)
  P.rect(312, 62, 68, 3, 0x8a5a30); P.hl(312, 62, 68, 0xb07a48); P.hl(312, 64, 68, 0x5a3a1e);
  for (const x of [318, 372]) { P.vl(x, 65, 5, 0x5a3a1e); P.px(x - 1, 69, 0x5a3a1e); }
  // ingredienshyllan
  P.rect(SHELF.x0, SHELF.y, SHELF.x1 - SHELF.x0, 3, 0x9a6a3a); P.hl(SHELF.x0, SHELF.y, SHELF.x1 - SHELF.x0, 0xc89a68); P.hl(SHELF.x0, SHELF.y + 3, SHELF.x1 - SHELF.x0, 0x5a3a1e);
  for (const x of [SHELF.x0 + 6, SHELF.x1 - 8]) { P.rect(x, SHELF.y + 3, 2, 5, 0x5a3a1e); }
  // bänkskivan: ljus sten med kant
  for (let y = 96; y < 150; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0xd8d2c4, 0xc4bcac, (y - 96) / 54);
    if (hash(x, y, 11) > 0.93) c = mix(c, 0x8a8478, 0.35);
    P.px(x, y, c);
  }
  P.hl(0, 96, FW, 0xa8a090); P.hl(0, 149, FW, 0xf2eee4); P.rect(0, 150, FW, 3, 0x8a8274);
  // skåpen under (trä), handtag
  for (let y = 153; y < FH; y++) for (let x = 0; x < FW; x++) {
    const door = x < 138 ? Math.floor(x / 69) : x > 250 ? 2 + Math.floor((x - 251) / 67) : -1;
    if (door < 0) continue;
    const dx0 = x < 138 ? door * 69 : 251 + (door - 2) * 67, lx = x - dx0;
    let c = mix(0x9a6a3a, 0x7a5028, (y - 153) / 63);
    if (lx < 2 || y === 156 || y === FH - 3) c = mul(c, 0.72);
    else if (lx === 2 || y === 157) c = mix(c, 0xffffff, 0.15);
    P.px(x, y, mix(c, 0x3a2410, (hash(x >> 1, y, 13) - 0.5) * 0.12));
  }
  for (const x of [60, 78, 300, 318]) { P.rect(x, 172, 2, 10, 0xd8d8de); P.px(x, 172, 0xffffff); }
  P.rect(0, FH - 3, FW, 3, 0x3a2a1e);
  // spishällen: svart glas med fyra plattor (ringar) och en reflex
  for (let y = 100; y < 148; y++) for (let x = 138; x < 252; x++) P.px(x, y, mix(0x1a1a20, 0x2a2a32, (y - 100) / 48));
  P.hl(138, 100, 114, 0x4a4a56); P.hl(138, 147, 114, 0x0a0a0e); P.vl(138, 100, 48, 0x3a3a44); P.vl(251, 100, 48, 0x0a0a0e);
  for (let k = 0; k < 18; k++) P.px(144 + k, 106 + (k >> 2), 0x5a5a68);
  for (const b of BURN) ring(P, b.x, b.y, 17, 6.5, 0x4a4a56, 0x34343c);
  // panelen med vreden
  P.rect(138, 152, 114, 10, 0x2a2a32); P.hl(138, 152, 114, 0x5a5a66);
  // ugnen
  P.rect(OVEN.x0, OVEN.y0, OVEN.x1 - OVEN.x0, OVEN.y1 - OVEN.y0, 0x2e2e36); P.hl(OVEN.x0, OVEN.y0, OVEN.x1 - OVEN.x0, 0x6a6a76);
  P.rect(OVEN.x0 + 6, OVEN.y0 + 3, OVEN.x1 - OVEN.x0 - 12, 3, 0xc8ccd4); P.hl(OVEN.x0 + 6, OVEN.y0 + 3, OVEN.x1 - OVEN.x0 - 12, 0xffffff); // handtaget
  P.rect(OVEN.x0 + 10, OVEN.y0 + 10, OVEN.x1 - OVEN.x0 - 20, 30, 0x101014); P.box(OVEN.x0 + 9, OVEN.y0 + 9, OVEN.x1 - OVEN.x0 - 18, 32, 0x4a4a56);
  // diskhon: stålho med kant och kran
  for (let y = SINK.y0; y < SINK.y1; y++) for (let x = SINK.x0; x < SINK.x1; x++) {
    const e = Math.min(x - SINK.x0, SINK.x1 - 1 - x, y - SINK.y0, SINK.y1 - 1 - y);
    P.px(x, y, e < 2 ? 0xd8dce4 : e < 4 ? 0x9aa0aa : mix(0x7a808a, 0xa8aeb8, (y - SINK.y0) / 38));
  }
  P.rect(289, 140 - 3, 2, 1, 0x3a3e46);
  for (let y = 84; y < 106; y++) P.rect(288, y, 3, 1, y < 86 ? 0xd8dce4 : 0xb8bec8);   // kranen
  for (let x = 288; x < 302; x++) P.rect(x, 84, 1, 3, 0xd8dce4);
  P.rect(300, 86, 3, 4, 0xb8bec8); P.rect(284, 100, 11, 4, 0x9aa0aa); P.hl(284, 100, 11, 0xd8dce4);
  // skärbrädan (trä med ådring) och kniven
  for (let y = BOARD.y0; y < BOARD.y1; y++) for (let x = BOARD.x0; x < BOARD.x1; x++) {
    const e = Math.min(x - BOARD.x0, BOARD.x1 - 1 - x, y - BOARD.y0, BOARD.y1 - 1 - y);
    let c = mix(0xd8a868, 0xc08a4a, ((y + Math.sin(x * 0.3) * 2) % 5) / 5);
    if (e === 0) c = 0x7a4a20; else if (e === 1) c = 0xe8c088;
    P.px(x, y, c);
  }
  P.rect(BOARD.x1 - 12, BOARD.y0 + 6, 2, 22, 0xd8dce4); P.vl(BOARD.x1 - 12, BOARD.y0 + 6, 22, 0xffffff); P.rect(BOARD.x1 - 13, BOARD.y0 + 26, 4, 8, 0x2a2a32); // kniven
  // mixerns fot
  P.rect(MIXER.x - 8, MIXER.y - 8, 16, 9, 0x2a2a32); P.hl(MIXER.x - 8, MIXER.y - 8, 16, 0x5a5a66); P.rect(MIXER.x - 2, MIXER.y - 5, 4, 3, 0xd84a3a);
  return P.flush();
}
function ring(P, cx, cy, rx, ry, c, c2) {
  for (let a = 0; a < 120; a++) { const th = a / 120 * Math.PI * 2; P.px(Math.round(cx + Math.cos(th) * rx), Math.round(cy + Math.sin(th) * ry), c); P.px(Math.round(cx + Math.cos(th) * (rx - 4)), Math.round(cy + Math.sin(th) * (ry - 1.6)), c2); }
}

// ================= kärlen =================
const ENAMEL = { gryta1: [0x6a0e14, 0xa81c24, 0xd83a3a, 0xf06a5a, 0xffa898], gryta2: [0x1a2e6a, 0x2a4aa8, 0x3a6ad8, 0x6a9af0, 0xb0ccff] };
const VSIZE = { gryta: { rx: 13, ry: 4.5, h: 15 }, panna: { rx: 15, ry: 5.5, h: 5 }, form: { rx: 15, ry: 5, h: 6 }, skal: { rx: 14, ry: 5, h: 10 }, mixer: { rx: 6, ry: 2.5, h: 26 }, tallrik: { rx: 20, ry: 8.5, h: 2 } };
const r1 = (c, x, y, w, h, col) => { c.fillStyle = typeof col === 'number' ? css(col) : col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const tone = (pal, v, x, y) => { const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t); return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))]; };
// rita kärlet v (med innehåll) med öppningens mitt i (cx, cy)
function drawVessel(c, v, cx, cy, t, opts = {}) {
  const kind = KIND[v.id], S = VSIZE[kind];
  cx = Math.round(cx); cy = Math.round(cy);
  if (kind === 'gryta') {
    const pal = ENAMEL[v.id];
    for (let y = 0; y <= S.h; y++) for (let x = -S.rx; x <= S.rx; x++) { const k = y / S.h; const w = S.rx - (y > S.h - 3 ? (y - S.h + 3) : 0); if (Math.abs(x) > w) continue; r1(c, cx + x, cy + y, 1, 1, tone(pal, 0.66 - x / S.rx * 0.3 - k * 0.2, cx + x, cy + y)); }
    for (const s of [-1, 1]) { r1(c, cx + s * (S.rx + 1) - (s < 0 ? 3 : 0), cy + 3, 4, 2, 0x2a2a32); r1(c, cx + s * (S.rx + 1) - (s < 0 ? 3 : 0), cy + 3, 4, 1, 0x5a5a66); }
    opening(c, v, cx, cy, S.rx, S.ry, pal, t);
  } else if (kind === 'panna') {
    const steel = v.id === 'panna1' ? [0x141418, 0x24242a, 0x34343c, 0x4a4a56, 0x6a6a78] : [0x6a3a1a, 0x9a5a2a, 0xc87a3a, 0xe8a060, 0xffd0a0];
    for (let y = 0; y <= S.h; y++) for (let x = -S.rx; x <= S.rx; x++) { const nx = x / S.rx, ny = Math.sqrt(Math.max(0, 1 - nx * nx)); if (y > S.ry * ny + 2) continue; r1(c, cx + x, cy + y, 1, 1, tone(steel, 0.5 - nx * 0.3, cx + x, cy + y)); }
    r1(c, cx + S.rx, cy - 1, 12, 3, steel[1]); r1(c, cx + S.rx, cy - 1, 12, 1, steel[3]); r1(c, cx + S.rx + 8, cy - 1, 5, 3, 0x2a1e18);   // skaftet
    opening(c, v, cx, cy, S.rx, S.ry, steel, t);
  } else if (kind === 'form') {
    const cer = [0x9aa0b0, 0xc8ccd8, 0xe8eaf0, 0xf6f6fa, 0xffffff];
    for (let y = 0; y <= S.h; y++) for (let x = -S.rx; x <= S.rx; x++) { const nx = x / S.rx; if (Math.abs(nx) > 1 - y / (S.h * 6)) continue; r1(c, cx + x, cy + y, 1, 1, y === 2 ? 0x3a6ab8 : tone(cer, 0.6 - nx * 0.25, cx + x, cy + y)); }
    opening(c, v, cx, cy, S.rx, S.ry, cer, t);
  } else if (kind === 'skal') {
    const st = [0x8a909a, 0xb0b6c0, 0xd0d6de, 0xe8ecf2, 0xffffff];
    for (let y = 0; y <= S.h; y++) for (let x = -S.rx; x <= S.rx; x++) { const nx = x / S.rx, w = Math.sqrt(Math.max(0, 1 - (y / (S.h + 2)) ** 2)); if (Math.abs(nx) > w) continue; r1(c, cx + x, cy + y, 1, 1, tone(st, 0.65 - nx * 0.3 - y / 30, cx + x, cy + y)); }
    opening(c, v, cx, cy, S.rx, S.ry, st, t);
  } else if (kind === 'mixer') {
    // glaskannan: innehållet fyller nerifrån, snurrar när den mixar
    const top = cy, bot = cy + S.h, fillH = Math.min(S.h - 4, v.items.length * 5);
    for (let y = top; y < bot; y++) for (let x = -S.rx; x <= S.rx; x++) {
      const inside = Math.abs(x) < S.rx;
      const lvl = bot - y <= fillH;
      let col = inside ? (lvl ? mixColor(v, x, y, t) : 0xdceef6) : 0x9ab8c8;
      r1(c, cx + x, y, 1, 1, col);
    }
    r1(c, cx - S.rx, top - 2, S.rx * 2 + 1, 2, 0x2a2a32);   // locket
    r1(c, cx - S.rx + 1, top + 2, 1, S.h - 4, 'rgba(255,255,255,.55)');
  } else if (kind === 'tallrik') {
    if (v.dish) { c.drawImage(dishFood(v.dish), cx - (DW >> 1), cy - DH + 9); return; }   // den färdiga rätten (med egen tallrik)
    for (let y = -S.ry; y <= S.ry; y++) for (let x = -S.rx; x <= S.rx; x++) { const d = (x / S.rx) ** 2 + (y / S.ry) ** 2; if (d > 1) continue; r1(c, cx + x, cy + y, 1, 1, d > 0.9 ? (y > 0 ? 0xa8acbc : 0xe4e6ee) : d > 0.62 ? 0x6a8ac8 : d > 0.55 ? 0xf8f8fc : 0xeef0f6); }
    drawItems(c, v, cx, cy, S.rx * 0.6, S.ry * 0.55, t, 1);
  }
  // mätaren över kärlet medan det lagas: grön stapel, ✓ när allt är klart
  if (opts.bar && v.items.length && !RAW.has(kind)) {
    const p = progressOf(v), w = 22, x = cx - 11, y = cy - (kind === 'gryta' ? 10 : 9) - (kind === 'mixer' ? 4 : 0);
    if (p >= 1) { r1(c, x + 7, y - 1, 9, 7, 0x1a6a2a); ctxText(c, SMALL, $t('KLAR'), x + 3, y, '#ffffff'); }
    else if (v.heat > 0) { r1(c, x - 1, y - 1, w + 2, 5, 0x1a1a20); r1(c, x, y, Math.round(w * p), 3, p > 0.7 ? 0x6fe08a : 0xf0c040); }
  }
}
// öppningen: kanten, vatten (blått, bubblor när det kokar) och det som ligger i
function opening(c, v, cx, cy, rx, ry, pal, t) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -rx; x <= rx; x++) {
    const d = (x / rx) ** 2 + (y / ry) ** 2;
    if (d > 1) continue;
    let col;
    if (d > 0.7) col = y < 0 ? pal[4] : pal[3];
    else if (v.water) col = tone([0x2a5aa8, 0x3a7ac8, 0x5a9ae0, 0x8ac0f0, 0xc8e4ff], 0.55 - x / rx * 0.2 + (v.heat >= 1 ? Math.sin(t * 9 + x * 0.8 + y) * 0.12 : 0), cx + x, cy + y);
    else col = mul(pal[1], 0.6);
    r1(c, cx + x, cy + y, 1, 1, col);
  }
  drawItems(c, v, cx, cy, rx * 0.68, ry * 0.6, t, v.n || 1);
  if (v.water && v.heat >= 1) for (let k = 0; k < 5; k++) { const a = hash(k, Math.floor(t * 6), 3) * 6.28, r = hash(k, 9, Math.floor(t * 6)); r1(c, cx + Math.cos(a) * rx * 0.6 * r, cy + Math.sin(a) * ry * 0.6 * r, 1, 1, 0xffffff); }
}
// bitarna: varje råvara som små klumpar i sina färger (fler vid storkok), brynta när de är klara
function drawItems(c, v, cx, cy, rx, ry, t, n = 1) {
  const many = Math.min(3, 1 + (n >= 5 ? 1 : 0) + (n >= 10 ? 1 : 0));
  v.items.forEach((it, i) => {
    const pal = ravaraPal(it.ing), cooked = it.prog >= 1 && !RAW.has(KIND[v.id]);
    const cnt = (it.ing === 'pasta' || it.ing === 'ris' ? 9 : 5) * many;
    for (let k = 0; k < cnt; k++) {
      const a = hash(k, i, 41) * 6.28 + (v.stirSpin || 0), r = Math.sqrt(hash(k, i, 42));
      const x = Math.round(cx + Math.cos(a) * rx * r), y = Math.round(cy + Math.sin(a) * ry * r);
      const col = cooked ? pal[1 + (k & 1)] : pal[2 + (k & 1)];
      if (it.ing === 'pasta') { r1(c, x - 1, y, 3, 1, col); r1(c, x, y + 1, 2, 1, pal[1]); continue; }
      if (it.ing === 'ris') { r1(c, x, y, 1, 1, col); continue; }
      if (it.ing === 'agg' && !it.prog && KIND[v.id] !== 'panna') { r1(c, x, y, 2, 1, 0xf4cc40); continue; }
      r1(c, x, y, 2, 2, col); r1(c, x, y, 1, 1, pal[4]);
    }
  });
}
function mixColor(v, x, y, t) {
  if (!v.items.length) return 0xdceef6;
  const i = Math.abs(Math.floor((y + (v.mixed ? 0 : Math.sin(t * 20 + x) * (v.mixT > 0 ? 3 : 0)))) % v.items.length);
  const pal = ravaraPal(v.mixed ? v.items[0].ing : v.items[i].ing);
  return v.mixed ? mix(0xe07ab8, pal[2], 0.3) : pal[2];
}
function progressOf(v) { if (!v.items.length) return 0; return Math.min(...v.items.map((it) => Math.min(1, it.prog))); }
function needOf(it, v, ovenOn) {
  const kind = KIND[v.id];
  if (RAW.has(kind)) return 0;
  if (kind === 'form') return ovenOn ? (UGN[it.ing] ?? 5) : Infinity;
  if (kind === 'gryta' && v.water) return KOK[it.ing] ?? 4;
  return STEKT[it.ing] ?? 3;
}

// ================= scenen =================
export function makeKoket(A) {
  const g = A.game, plan = A.kokPlan || { id: 'fruktsallad', n: 1 };
  const R = receptOf(plan.id) || receptOf('fruktsallad');
  const N = portionOf(plan.n).n;
  const steps = (STEG[R.id] || STEG.fruktsallad).map((s) => ({ ...s, done: false }));
  if (!BG) BG = paintBg();
  let t = 0, cur = 0, hand = null, hover = null, finished = false, finT = 0, msgT = -9, msg = '', abortAsk = false;
  const ingList = [...new Set(R.ing)];
  const ves = {};
  for (const id of ['gryta1', 'gryta2', 'panna1', 'panna2', 'form']) ves[id] = { id, place: 'rack', water: false, heat: 0, items: [], stirs: 0, n: N };
  ves.skal = { id: 'skal', place: 'skal', items: [], stirs: 0, heat: 0, n: N };
  ves.mixer = { id: 'mixer', place: 'mixer', items: [], stirs: 0, heat: 0, mixed: false, mixT: 0, n: N };
  ves.tallrik = { id: 'tallrik', place: 'tallrik', items: [], heat: 0, served: [], n: N };
  const burners = [{ on: false, v: null }, { on: false, v: null }, { on: false, v: null }, { on: false, v: null }];
  const oven = { v: null };
  const board = { ing: null, chops: 0 };
  const bind = {};                           // roll ('gryta', 'panna') → kärlets id
  const particles = [];
  const roleOf = (id) => (Object.entries(bind).find(([, v]) => v === id)?.[0]) || null;
  // passar kärlet id rollen? (obunden roll binds av samma sorts kärl som inte redan har en annan roll)
  const fits = (role, id) => (bind[role] ? bind[role] === id : KIND[id] === role && !roleOf(id));
  const doBind = (role, id) => { if (!bind[role] && (role === 'gryta' || role === 'panna')) bind[role] = id; };
  const remaining = () => steps.slice(cur).filter((s) => !s.done);
  const findStep = (pred) => steps.slice(cur).find((s) => !s.done && pred(s));
  const burnerOf = (id) => burners.findIndex((b) => b.v === id);
  const say = (s) => { msg = s; msgT = t; };
  // ska det som läggs i kärlet (rollen) lagas där? Bara om receptet längre fram väntar på det kärlet
  // (eller ugnen) – annars är det en sås eller topping som är klar direkt (carbonarans ägg och ost)
  const needsCook = (role) => remaining().some((x) => (x.t === 'vanta' && x.v === role) || (x.t === 'ugn' && role === 'form'));
  // ska vattnet hällas av innan grytan töms? (bara om receptet har ett avrinn-steg för den – soppa och gröt äter man med vattnet)
  const mustDrain = (id) => remaining().some((x) => x.t === 'avrinn' && fits(x.v, id));
  const notNow = () => { play('fel'); say($t`INTE NU - ${stepText(steps[cur], ves[bind[steps[cur]?.v]] || ves[steps[cur]?.v])}`); };

  // ---------- är steget klart? (läses av tillståndet; flaggsteg sätts när handlingen görs) ----------
  function checkDone(s) {
    const v = s.v ? (bind[s.v] ? ves[bind[s.v]] : ['skal', 'mixer', 'tallrik', 'form'].includes(s.v) ? ves[s.v] : null) : null;
    switch (s.t) {
      case 'vatten': return !!v && (v.water || v.items.length > 0);
      case 'stall': return !!v && burnerOf(v.id) >= 0;
      case 'varme': return !!v && burnerOf(v.id) >= 0 && burners[burnerOf(v.id)].on;
      case 'i': return !!v && v.items.some((it) => it.ing === s.ing);
      case 'hacka': return (board.ing === s.ing && board.chops >= 3) || Object.values(ves).some((x) => x.items.some((it) => it.ing === s.ing && it.hack));
      case 'vanta': return !!v && v.items.length > 0 && progressOf(v) >= 1;
      case 'ugn': return oven.v === 'form' || ves.form.items.every((it) => it.prog >= 1) && ves.form.items.length > 0 && ves.form.wasIn;
      case 'vispa': return !!v && v.stirs >= s.n;
      default: return !!s.flag;
    }
  }
  function advance() {
    let moved = false;
    while (cur < steps.length && (steps[cur].done || checkDone(steps[cur]))) { steps[cur].done = true; cur++; moved = true; }
    // steg längre fram som redan är gjorda (man var före) bockas av när man kommer dit
    if (moved) play('ok');
    if (cur >= steps.length && !finished) finish();
  }

  // ---------- handlingarna ----------
  function takeIng(id) { hand = { type: 'ing', id }; play('click'); }
  function putIng(vId) {
    const s = findStep((x) => x.t === 'i' && x.ing === hand.id && (fits(x.v, vId) || x.v === vId) && x.hack === !!hand.hack);
    if (!s) { notNow(); return; }
    doBind(s.v, vId);
    const v = ves[vId];
    v.items.push({ ing: hand.id, hack: !!hand.hack, prog: RAW.has(KIND[vId]) || !needsCook(s.v) ? 1 : 0 });
    if (KIND[vId] === 'mixer') v.mixed = false;
    v.stirs = 0;
    hand = null;
    play('ok'); puff(vesPos(v), 0xffffff, 3);
  }
  function boardDown() {
    if (hand?.type === 'ing') {
      if (!findStep((x) => x.t === 'hacka' && x.ing === hand.id)) { notNow(); return; }
      if (board.ing) { say($t('SKÄRBRÄDAN ÄR UPPTAGEN')); return; }
      board.ing = hand.id; board.chops = 0; hand = null; play('click'); return;
    }
    if (!hand && board.ing) {
      if (board.chops < 3) { board.chops++; play('click'); for (let k = 0; k < 3; k++) particles.push({ x: 40 + (Math.random() - 0.5) * 20, y: 120, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 20, life: 0.4, col: ravaraPal(board.ing)[3] }); return; }
      hand = { type: 'ing', id: board.ing, hack: true }; board.ing = null; board.chops = 0; play('click');
    }
  }
  function pickVessel(id) {
    const v = ves[id];
    if (id === 'skal' || id === 'mixer' || id === 'tallrik') return;
    const b = burnerOf(id);
    if (b >= 0) burners[b].v = null;
    if (oven.v === id) oven.v = null;
    v.place = 'hand'; v.heat = Math.min(v.heat, 0.6); v.fromBurner = b;
    hand = { type: 'ves', id };
    play('click');
  }
  function returnToRack() {
    const v = ves[hand.id];
    if (v.items.length || v.water) { say($t('TÖM DEN FÖRST - ELLER STÄLL DEN PÅ SPISEN')); play('fel'); return; }
    v.place = 'rack'; v.heat = 0; hand = null; play('click');
  }
  function burnerDown(i) {
    const B = burners[i];
    if (hand?.type === 'ves') {
      const k = KIND[hand.id];
      if (k !== 'gryta' && k !== 'panna') { say($t('DEN SKA INTE PÅ SPISEN')); play('fel'); return; }
      if (B.v) { say($t('DEN PLATTAN ÄR UPPTAGEN - TA EN ANNAN')); play('fel'); return; }
      const s = findStep((x) => x.t === 'stall' && fits(x.v, hand.id));
      if (s) doBind(s.v, hand.id);
      B.v = hand.id; ves[hand.id].place = 'b' + i; hand = null; play('click');
      return;
    }
    if (!hand && B.v) {
      const s = steps[cur];
      if (s && s.t === 'vispa' && bind[s.v] === B.v) { stir(B.v); return; }
      pickVessel(B.v);
      return;
    }
    if (!hand) knob(i);
  }
  function knob(i) { burners[i].on = !burners[i].on; play('click'); }
  function sinkDown() {
    if (hand?.type !== 'ves') { if (!hand) say($t('TA EN GRYTA FRÅN LISTEN - SEN KRANEN')); return; }
    const v = ves[hand.id];
    if (KIND[v.id] !== 'gryta') { say($t('BARA GRYTORNA BEHÖVER VATTEN')); play('fel'); return; }
    if (v.water && v.items.length) {
      const s = findStep((x) => x.t === 'avrinn' && fits(x.v, v.id));
      if (!s) { notNow(); return; }
      if (progressOf(v) < 1) { say($t`${best(v.items.find((it) => it.prog < 1)?.ing || '')} ÄR INTE KLAR ÄN - VÄNTA`); play('fel'); return; }
      v.water = false; s.flag = true; play('slide'); pour(SINK.x0 + 28, SINK.y0 + 20, 0x8ac0f0);
      // nästa steg häller eller lägger upp grytan? då behåller man den i handen – annars tillbaka på sin platta
      const role = roleOf(v.id), next = remaining().find((x) => x !== s);
      const keep = next && ((next.t === 'hall' && next.from === role) || (next.t === 'upp' && next.v === role));
      if (!keep && v.fromBurner >= 0 && !burners[v.fromBurner].v) { burners[v.fromBurner].v = v.id; v.place = 'b' + v.fromBurner; hand = null; }
      return;
    }
    if (!v.water && !v.items.length) {
      const s = findStep((x) => x.t === 'vatten' && fits(x.v, v.id));
      if (!s) { notNow(); return; }
      doBind(s.v, v.id);
      v.water = true; play('slide'); pour(SINK.x0 + 28, SINK.y0 + 20, 0x8ac0f0); return;
    }
    say($t('DEN HAR REDAN VATTEN'));
  }
  function pourInto(toId) {
    const from = ves[hand.id], to = ves[toId];
    if (toId === 'tallrik') { serve(); return; }
    const s = findStep((x) => x.t === 'hall' && fits(x.from, from.id) && (fits(x.to, toId) || x.to === toId));
    if (!s) { notNow(); return; }
    if (from.water && mustDrain(from.id)) { say($t('HÄLL AV VATTNET FÖRST')); play('fel'); return; }
    if (progressOf(from) < 1 && !RAW.has(KIND[from.id]) && from.items.length) { say($t('DET ÄR INTE KLART ÄN - VÄNTA')); play('fel'); return; }
    doBind(s.to, toId);
    to.items.push(...from.items.map((it) => ({ ...it })));
    from.items = []; from.stirs = 0; to.stirs = 0; s.flag = true;
    if (KIND[from.id] !== 'skal') { from.place = 'rack'; from.heat = 0; hand = null; } else hand = null;
    play('slide'); puff(vesPos(to), 0xffffff, 4);
  }
  // bunken/mixern tas inte upp: klick på dem med tom hand vispar/mixar; med en sak i handen = i med den
  function pourFromBowl(toId) {
    const s = findStep((x) => x.t === 'hall' && x.from === 'skal' && (fits(x.to, toId) || x.to === toId));
    if (!s) { notNow(); return; }
    const to = ves[toId];
    doBind(s.to, toId);
    to.items.push(...ves.skal.items.map((it) => ({ ...it, prog: needsCook(s.to) ? 0 : 1 })));
    ves.skal.items = []; s.flag = true; hand = null; to.stirs = 0;
    play('slide'); puff(vesPos(to), 0xffffff, 4);
  }
  function serve() {
    const from = ves[hand.id];
    const s = findStep((x) => x.t === 'upp' && (fits(x.v, from.id) || x.v === from.id));
    if (!s) { notNow(); return; }
    if (from.water && mustDrain(from.id)) { say($t('HÄLL AV VATTNET FÖRST')); play('fel'); return; }
    if (progressOf(from) < 1 && !RAW.has(KIND[from.id])) { say($t('DET ÄR INTE KLART ÄN - VÄNTA')); play('fel'); return; }
    from.water = false;   // (soppan och gröten: vattnet följer med på tallriken)
    ves.tallrik.items.push(...from.items.map((it) => ({ ...it })));
    from.items = []; s.flag = true;
    if (!RAW.has(KIND[from.id])) { from.place = 'rack'; from.heat = 0; }
    hand = null; play('ok'); puff([PLATE.x, PLATE.y - 4], 0xfff6c8, 6);
  }
  function stir(id) {
    const s = findStep((x) => x.t === 'vispa' && (fits(x.v, id) || x.v === id));
    if (!s) { notNow(); return; }
    const v = ves[id];
    if (!v.items.length) { say($t('DET FINNS INGET ATT RÖRA I')); return; }
    v.stirs++; v.stirSpin = (v.stirSpin || 0) + 0.8; play('click');
    puff(vesPos(v), 0xffffff, 2);
  }
  function mixerDown() {
    if (hand?.type === 'ing') { putIng('mixer'); return; }
    if (ves.mixer.mixT > 0) { say($t('MIXERN SNURRAR...')); return; }
    if (!hand && ves.mixer.items.length && !ves.mixer.mixed) {
      const s = findStep((x) => x.t === 'mixa');
      if (!s) { notNow(); return; }
      ves.mixer.mixT = 1.4; play('slide'); return;
    }
    if (!hand && ves.mixer.mixed) { const s = findStep((x) => x.t === 'upp' && x.v === 'mixer'); if (s) { s.flag = true; ves.tallrik.items.push(...ves.mixer.items); ves.mixer.items = []; play('ok'); puff([PLATE.x, PLATE.y - 4], 0xfff6c8, 6); } }
  }
  function bowlDown() {
    if (hand?.type === 'ing') { putIng('skal'); return; }
    if (!hand) {
      const s = steps[cur];
      // häll bunken: klicka bunken, sen målet (handen håller "bunken")
      if (findStep((x) => x.t === 'hall' && x.from === 'skal') && ves.skal.items.length && (!s || s.t !== 'vispa' || s.v !== 'skal' || ves.skal.stirs >= s.n)) { hand = { type: 'bowl' }; play('click'); return; }
      if (findStep((x) => x.t === 'upp' && x.v === 'skal') && ves.skal.items.length && !findStep((x) => x.t === 'vispa' && x.v === 'skal' && ves.skal.stirs < x.n)) { hand = { type: 'ves', id: 'skal' }; play('click'); return; }
      stir('skal');
    }
  }
  function ovenDown() {
    if (hand?.type === 'ves' && hand.id === 'form') {
      if (!findStep((x) => x.t === 'ugn') && !ves.form.items.length) { notNow(); return; }
      oven.v = 'form'; ves.form.place = 'ugn'; ves.form.wasIn = true; hand = null; play('slide'); return;
    }
    if (!hand && oven.v) { pickVessel(oven.v); return; }
    if (!hand) say($t('UGNEN SÄTTS PÅ NÄR FORMEN ÄR INNE'));
  }

  // ---------- kärlens plats på skärmen ----------
  function vesPos(v) {
    if (v.place === 'rack') return [RACK[v.id].x, RACK[v.id].y];
    if (v.place?.startsWith('b')) { const b = BURN[+v.place.slice(1)]; return [b.x, b.y - (KIND[v.id] === 'gryta' ? 12 : 4)]; }
    if (v.place === 'ugn') return [(OVEN.x0 + OVEN.x1) / 2, OVEN.y0 + 26];
    if (v.place === 'skal') return [BOWL.x, BOWL.y - 6];
    if (v.place === 'mixer') return [MIXER.x, MIXER.y - 36];
    if (v.place === 'tallrik') return [PLATE.x, PLATE.y];
    return hover ? [hover.x, hover.y - 6] : [340, 30];
  }
  // klickytorna, i ordning
  function spots() {
    const L = [];
    L.push({ id: 'avbryt', r: [366, 2, 382, 16], act: () => askAbort() });
    ingList.forEach((ing, i) => { const x = SHELF.x0 + 10 + i * 24; L.push({ id: 'ing:' + ing, r: [x - 2, SHELF.y - 16, x + 14, SHELF.y + 2], act: () => (hand?.type === 'ing' && hand.id === ing && !hand.hack ? (hand = null) : !hand ? takeIng(ing) : null) }); });
    for (const id of ['gryta1', 'gryta2', 'panna1', 'panna2', 'form']) {
      const v = ves[id];
      if (v.place === 'rack') { const [x, y] = vesPos(v); L.push({ id: 'rack:' + id, r: [x - 18, y - 8, x + 18 + (KIND[id] === 'panna' ? 12 : 0), y + 18], act: () => {
        if (!hand) return pickVessel(id);
        if (hand.type === 'ves' && hand.id === id) return returnToRack();
        if (hand.type === 'ing') return putIng(id);                     // t.ex. potatisen i formen på hyllan
        if (hand.type === 'bowl') return pourFromBowl(id);
        if (hand.type === 'ves') return pourInto(id);
      } }); }
    }
    BURN.forEach((b, i) => L.push({ id: 'platta' + i, r: [b.x - 20, b.y - 26, b.x + 20, b.y + 8], act: () => {
      const B = burners[i];
      if (B.v && hand?.type === 'ing') return putIng(B.v);
      if (B.v && hand?.type === 'ves' && hand.id !== B.v) return pourInto(B.v);
      if (B.v && hand?.type === 'bowl') return pourFromBowl(B.v);
      return burnerDown(i);
    } }));
    KNOB.forEach((k) => L.push({ id: 'vred' + k.b, r: [k.x - 6, 151, k.x + 6, 163], act: () => knob(k.b) }));
    L.push({ id: 'diskho', r: [SINK.x0, 82, SINK.x1, SINK.y1], act: () => sinkDown() });
    L.push({ id: 'bradan', r: [BOARD.x0, BOARD.y0, BOARD.x1, BOARD.y1], act: () => boardDown() });
    L.push({ id: 'bunken', r: [BOWL.x - 16, BOWL.y - 14, BOWL.x + 16, BOWL.y + 8], act: () => (hand?.type === 'ves' && hand.id !== 'skal' ? pourInto('skal') : bowlDown()) });
    L.push({ id: 'mixer', r: [MIXER.x - 9, MIXER.y - 40, MIXER.x + 9, MIXER.y + 2], act: () => mixerDown() });
    L.push({ id: 'tallrik', r: [PLATE.x - 24, PLATE.y - 14, PLATE.x + 24, PLATE.y + 12], act: () => {
      if (hand?.type === 'ing') return putIng('tallrik');
      if (hand?.type === 'ves') return serve();
      if (hand?.type === 'bowl') { hand = { type: 'ves', id: 'skal' }; return serve(); }
    } });
    L.push({ id: 'ugn', r: [OVEN.x0, OVEN.y0, OVEN.x1, OVEN.y1], act: () => ovenDown() });
    L.push({ id: 'form-hylla', r: [312, 40, 380, 66], act: () => { if (hand?.type === 'ves' && hand.id === 'form') returnToRack(); else if (!hand && ves.form.place === 'rack') pickVessel('form'); } });
    // ett kärl i handen kan också hällas i formen när den står i ugnen eller på hyllan
    return L;
  }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);

  // ---------- guiden: vad ska man klicka på nu? ----------
  function guideTarget() {
    const s = steps[cur];
    if (!s || finished) return null;
    const vid = bind[s.v] || (['skal', 'mixer', 'tallrik', 'form'].includes(s.v) ? s.v : null);
    const anyFree = (kind) => ['gryta1', 'gryta2', 'panna1', 'panna2'].find((id) => KIND[id] === kind && !roleOf(id) && ves[id].place === 'rack');
    const posOf = (id) => { const v = ves[id]; if (v.place?.startsWith('b')) return 'platta' + v.place.slice(1); if (v.place === 'rack') return 'rack:' + id; if (v.place === 'ugn') return 'ugn'; return { skal: 'bunken', mixer: 'mixer', tallrik: 'tallrik' }[id] || null; };
    switch (s.t) {
      case 'vatten': return hand?.type === 'ves' ? 'diskho' : 'rack:' + (vid || anyFree('gryta'));
      case 'stall': return hand?.type === 'ves' ? 'platta' + Math.max(0, burners.findIndex((b) => !b.v)) : 'rack:' + (vid || anyFree(s.v));
      case 'varme': { const b = vid ? burnerOf(vid) : -1; return b >= 0 ? 'vred' + b : null; }
      case 'i': if (hand?.type === 'ing') return vid ? posOf(vid) : null; return s.hack ? (board.ing === s.ing ? 'bradan' : 'ing:' + s.ing) : 'ing:' + s.ing;
      case 'hacka': return hand?.type === 'ing' || board.ing ? 'bradan' : 'ing:' + s.ing;
      case 'vanta': return null;
      case 'avrinn': return hand?.type === 'ves' ? 'diskho' : vid ? posOf(vid) : null;
      case 'hall': { const f = bind[s.from] || s.from, to = bind[s.to] || s.to; return hand ? posOf(to) : posOf(f); }
      case 'vispa': return vid ? posOf(vid) : null;
      case 'ugn': return hand?.type === 'ves' && hand.id === 'form' ? 'ugn' : ves.form.place === 'rack' ? 'form-hylla' : posOf('form');
      case 'mixa': return ves.mixer.mixT > 0 ? null : 'mixer';
      case 'upp': return hand ? 'tallrik' : vid ? posOf(vid) : null;
    }
    return null;
  }
  // håller man något som inte är klart (och ska lagas vidare)? ställ tillbaka det på spisen
  function guideTargetSafe() {
    if (hand?.type === 'ves' && !RAW.has(KIND[hand.id]) && ves[hand.id].items.length && progressOf(ves[hand.id]) < 1) {
      if (hand.id === 'form') return 'ugn';
      const free = burners.findIndex((b) => !b.v);
      return free >= 0 ? 'platta' + free : null;
    }
    return guideTarget();
    return null;
  }

  // ---------- slutet ----------
  function finish() {
    finished = true; finT = t;
    ves.tallrik.dish = R.id;
    play('fanfare');
    for (let k = 0; k < 40; k++) particles.push({ x: PLATE.x, y: PLATE.y - 10, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60, life: 1.2 + Math.random(), col: [0xffd23f, 0xff6a8a, 0x6fe08a, 0x8ad8ff][k % 4], grav: 1 });
    setTimeout(() => result(), 1600);
  }
  function result() {
    const res = g.cook(R.id, N);
    if (!res.ok) { toast(res.msg || $t('Något gick fel i köket.'), 'bad'); A.go('room'); return; }
    const titel = KOCK_TITLAR[res.niva - 1];
    openModal($t`${R.icon} ${R.name} – smaklig måltid!`, `<div class="kok-res">${'<canvas class="kok-dish" data-dish="' + R.id + '" width="' + DW * 3 + '" height="' + DH * 3 + '"></canvas>'}
      <p style="font-size:var(--f2);margin-top:0">${$t`Du åt en portion: <b>+${res.fill} mätthet</b>${res.glad ? `, <b>+${res.glad} 😊</b>` : ''}${res.energi ? `, <b>+${res.energi} ⚡</b>` : ''}.`}</p>
      ${res.lador ? `<p style="font-size:var(--f2)">${$t`🍱 <b>${res.lador} matlådor</b> står i kylskåpet – värm och ät när du vill!`}</p>` : ''}
      ${res.overflow ? `<p style="font-size:var(--f2)" class="bad">${$t`Kylen var full – ${res.overflow} portioner fick inte plats.`}</p>` : ''}
      <p style="font-size:var(--f2)">👩‍🍳 ${res.betterNow ? `${$t`Du blir bättre på ${R.name.toLowerCase()}: ${'★'.repeat(res.stars)}!`} ` : ''}${res.nyNiva ? $t`<b>Ny kocknivå: ${titel}!</b>` : $t`Kocknivå: ${titel}`}</p></div>`,
    [{ label: $t('🍽️ Tack för maten!'), cls: 'btn-go', onClick: () => { closeModal(); A.go('room'); } }], { closable: false });
    const cv = document.querySelector('#modal canvas[data-dish]');
    if (cv) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(dishCanvas(R.id), 0, 0, DW, DH, 0, 0, cv.width, cv.height); }
    if (res.nyNiva) play('fanfare');
  }
  function askAbort() {
    if (finished) return;
    openModal($t('🍳 Sluta laga mat?'), `<p style="font-size:var(--f2)">${$t('Råvarorna ligger kvar i kylskåpet – inget går åt om du slutar nu.')}</p>`, [
      { label: $t('Laga vidare'), cls: 'btn-go', onClick: closeModal },
      { label: $t('Sluta'), onClick: () => { closeModal(); A.go('room'); } },
    ]);
  }

  // ---------- effekter ----------
  function puff([x, y], col, n) { for (let k = 0; k < n; k++) particles.push({ x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 16, vy: -12 - Math.random() * 14, life: 0.7, col }); }
  function pour(x, y, col) { for (let k = 0; k < 14; k++) particles.push({ x: x + (Math.random() - 0.5) * 4, y: y - 14, vx: (Math.random() - 0.5) * 6, vy: 30 + Math.random() * 30, life: 0.5, col }); }

  // ---------- uppdatering ----------
  function update(dt) {
    t += dt;
    for (const id of Object.keys(ves)) {
      const v = ves[id], b = burnerOf(id), onB = b >= 0 && burners[b].on, inOven = oven.v === id;
      const heated = onB || inOven;
      v.heat = Math.max(0, Math.min(1, v.heat + (heated ? dt / 1.6 : -dt / 2)));
      if (id === 'mixer' && v.mixT > 0) { v.mixT -= dt; if (v.mixT <= 0) { v.mixed = true; for (const it of v.items) it.prog = 1; play('ok'); const s = findStep((x) => x.t === 'mixa'); if (s) s.flag = true; } }
      if (RAW.has(KIND[id])) { for (const it of v.items) it.prog = 1; continue; }
      if (v.heat >= 1) for (const it of v.items) { const need = needOf(it, v, inOven); if (need === 0) it.prog = 1; else if (need < Infinity) it.prog = Math.min(1, it.prog + dt / need); }
      for (const it of v.items) if (needOf(it, v, inOven) === 0) it.prog = 1;
      // ånga när vattnet kokar, fräs när pannan steker
      if (v.heat >= 1 && (v.water || v.items.length) && Math.random() < dt * (v.water ? 6 : 9)) { const [x, y] = vesPos(v); particles.push({ x: x + (Math.random() - 0.5) * 18, y: y - 2, vx: (Math.random() - 0.5) * 6, vy: v.water ? -16 : -26, life: v.water ? 1.2 : 0.4, col: v.water ? 0xf0f4f8 : 0xfff0a0, steam: v.water }); }
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += 120 * dt; p.life -= dt; }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    if (!finished) advance();
  }

  // ---------- ritning ----------
  function draw(ctx) {
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(BG, 0, 0);
    const gt = guideTargetSafe(), pulse = 0.5 + Math.sin(t * 6) * 0.5;
    // receptkortet
    drawCard(ctx);
    // vreden (rött ljus när plattan är på) och plattornas glöd
    KNOB.forEach((k) => {
      const on = burners[k.b].on;
      r1(ctx, k.x - 4, 154, 8, 7, 0xb8bcc6); r1(ctx, k.x - 3, 155, 6, 5, 0xe0e4ec); r1(ctx, k.x - 1, 155, 2, 3, 0x2a2a32);
      r1(ctx, k.x - 3, 162, 2, 1, on ? 0xff4a2a : 0x5a2a2a);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy], q) => r1(ctx, k.x + 6 + dx * 2, 155 + dy * 2, 1, 1, q === k.b ? 0xffd23f : 0x6a6a76));   // vilken platta vredet styr
    });
    BURN.forEach((b, i) => {
      const B = burners[i];
      if (!B.on) return;
      const glow = 0.55 + Math.sin(t * 3 + i) * 0.1;
      for (let a = 0; a < 90; a++) { const th = a / 90 * Math.PI * 2; for (const rr of [17, 14, 11]) r1(ctx, b.x + Math.cos(th) * rr, b.y + Math.sin(th) * rr * 0.38, 1, 1, `rgba(255,${rr === 17 ? 60 : 110},30,${glow.toFixed(2)})`); }
    });
    // kärlen: listen och hyllan, spisen, ugnen, bunken, mixern, tallriken
    for (const id of ['gryta1', 'gryta2', 'panna1', 'panna2', 'form']) { const v = ves[id]; if (v.place === 'rack') { const [x, y] = vesPos(v); drawVessel(ctx, v, x, y, t); } }
    // ugnen: ljus och formen bakom glaset
    if (oven.v) {
      ctx.fillStyle = 'rgba(255,170,60,.35)'; ctx.fillRect(OVEN.x0 + 10, OVEN.y0 + 10, OVEN.x1 - OVEN.x0 - 20, 30);
      const [x, y] = vesPos(ves.form); drawVessel(ctx, ves.form, x, y, t, { bar: true });
      ctx.fillStyle = 'rgba(40,20,10,.25)'; ctx.fillRect(OVEN.x0 + 10, OVEN.y0 + 10, OVEN.x1 - OVEN.x0 - 20, 30);
    }
    if (!(hand?.type === 'bowl' || (hand?.type === 'ves' && hand.id === 'skal'))) drawVessel(ctx, ves.skal, BOWL.x, BOWL.y - 6, t);
    drawVessel(ctx, ves.mixer, MIXER.x, MIXER.y - 36, t);
    burners.forEach((B) => { if (B.v) { const [x, y] = vesPos(ves[B.v]); drawVessel(ctx, ves[B.v], x, y, t, { bar: true }); } });
    drawVessel(ctx, ves.tallrik, PLATE.x, PLATE.y, t);
    // skärbrädan
    if (board.ing) {
      const cx = (BOARD.x0 + BOARD.x1) / 2 - 6, cy = (BOARD.y0 + BOARD.y1) / 2;
      if (board.chops >= 3) ctx.drawImage(choppedBits(board.ing), cx - 12, cy - 4, 24, 16);
      else { ctx.drawImage(ravaraIcon(board.ing), cx - 12, cy - 12, 24, 24); for (let k = 0; k < board.chops; k++) r1(ctx, cx - 8 + k * 7, cy - 12, 1, 24, 0x5a3a1e); }
    }
    // ingredienshyllan: råvarorna × portionerna (avbockade när de är använda)
    ingList.forEach((ing, i) => {
      const x = SHELF.x0 + 10 + i * 24, used = !remaining().some((s) => s.ing === ing);
      ctx.globalAlpha = used ? 0.35 : 1;
      ctx.drawImage(ravaraIcon(ing), x, SHELF.y - 12);
      ctx.globalAlpha = 1;
      ctxText(ctx, SMALL, used ? $t('OK') : `X${N}`, x + 1, SHELF.y + 5, used ? '#3a8a4a' : '#5a3a1e');
    });
    // partiklar (ånga, fräs, vatten, konfetti)
    for (const p of particles) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * (p.steam ? 0.7 : 1.5))); r1(ctx, p.x, p.y, p.steam ? 2 : 1, 1, p.col); }
    ctx.globalAlpha = 1;
    // guidepilen och målets glöd
    if (gt) {
      const s = spots().find((x) => x.id === gt);
      if (s) {
        const [x0, y0, x1, y1] = s.r, a = (0.35 + pulse * 0.4).toFixed(2);
        ctx.fillStyle = `rgba(255,214,60,${a})`;
        ctx.fillRect(x0, y0, x1 - x0, 1); ctx.fillRect(x0, y1, x1 - x0, 1); ctx.fillRect(x0, y0, 1, y1 - y0); ctx.fillRect(x1, y0, 1, y1 - y0 + 1);
        const ax = Math.round((x0 + x1) / 2), ay = Math.round(y0 - 6 - Math.abs(Math.sin(t * 5)) * 4);
        for (let k = 0; k < 5; k++) r1(ctx, ax - 4 + k, ay - 6 + k, 9 - k * 2, 1, k === 4 ? 0xb07a10 : 0xffd23f);
        r1(ctx, ax - 1, ay - 11, 3, 5, 0xffd23f);
      }
    }
    // det man håller i
    if (hand) {
      const [hx, hy] = hover ? [hover.x, hover.y] : [350, 28];
      if (!hover) { r1(ctx, 330, 16, 50, 30, 'rgba(20,18,26,.85)'); ctxText(ctx, SMALL, $t('I HANDEN'), 334, 18, '#e8b230'); }
      if (hand.type === 'ing') { if (hand.hack) ctx.drawImage(choppedBits(hand.id), hx - 6, hy - 10); else ctx.drawImage(ravaraIcon(hand.id), hx - 6, hy - 14); }
      else if (hand.type === 'ves') drawVessel(ctx, ves[hand.id], hx, hy - 8, t);
      else if (hand.type === 'bowl') { ctx.globalAlpha = 0.85; drawVessel(ctx, ves.skal, hx, hy - 6, t); ctx.globalAlpha = 1; }
    }
    // textraden högst upp: nästa steg (eller ett besked)
    const st = steps[cur];
    let line = finished ? $t('SMAKLIG MÅLTID!') : t - msgT < 2.2 ? msg : st ? `${cur + 1}/${steps.length}: ${stepText(st, ves[bind[st.v]] || ves[st.v])}` : '';
    if (st?.t === 'vanta' && !finished && t - msgT >= 2.2) { const v = ves[bind[st.v]] || ves[st.v]; const wait = v?.items.find((it) => it.prog < 1); line = `${cur + 1}/${steps.length}: ${KIND[v?.id] === 'form' ? (wait ? $t`VÄNTA - ${best(wait.ing)} ÄR I UGNEN` : $t('VÄNTA - ÄR I UGNEN')) : (wait ? $t`VÄNTA - ${best(wait.ing)} LAGAS` : $t('VÄNTA - LAGAS'))}${v?.heat < 1 ? ` (${$t('VÄRME PÅ?')})` : ''}`; }
    const w = Math.min(248, textW(SMALL, line) + 12), x0 = Math.round(116 + (250 - w) / 2);
    r1(ctx, x0, 2, w, 12, 'rgba(20,18,26,.9)'); r1(ctx, x0, 13, w, 1, '#e8b230');
    ctxText(ctx, SMALL, line, x0 + 6, 5, t - msgT < 2.2 && !finished ? '#ff9a7a' : '#ffd23f');
    // avbryt-knappen
    r1(ctx, 366, 2, 15, 13, 0x5a1a1a); ctxText(ctx, SMALL, 'X', 371, 5, '#ffffff');
  }
  function drawCard(ctx) {
    const { x0, x1, y0, y1 } = CARD;
    r1(ctx, x0 + 2, y0 + 2, x1 - x0, y1 - y0, 'rgba(40,30,20,.25)');
    r1(ctx, x0, y0, x1 - x0, y1 - y0, 0xfaf4e4);
    for (let y = y0 + 20; y < y1; y += 8) r1(ctx, x0 + 3, y + 6, x1 - x0 - 6, 1, 0xe0d8c4);
    r1(ctx, (x0 + x1) / 2 - 2, y0 - 1, 4, 4, 0xd83a3a); r1(ctx, (x0 + x1) / 2 - 1, y0 - 1, 1, 1, 0xff9a9a);
    const name = R.name.toUpperCase();
    ctxText(ctx, SMALL, name.length > 24 ? name.slice(0, 23) + '.' : name, x0 + 4, y0 + 6, '#7a1e2e');
    ctxText(ctx, SMALL, `${N > 1 ? portionOf(N).name.toUpperCase() + ' X' + N : $t('1 PORTION')}`, x0 + 4, y0 + 13, '#9a7a5a');
    const first = Math.max(0, Math.min(cur - 3, steps.length - 9));
    steps.slice(first, first + 9).forEach((s, k) => {
      const i = first + k, y = y0 + 22 + k * 8, now = i === cur;
      const txt = `${s.done ? '+' : now ? ' ' : '-'} ${cardText(s)}`;
      if (now) { r1(ctx, x0 + 2, y - 2, x1 - x0 - 4, 8, 0xfff0b0); for (let k = 0; k < 3; k++) r1(ctx, x0 + 4 + k, y + k, 1, 5 - k * 2, 0x7a1e2e); }   // pilen vid steget man är på
      ctxText(ctx, SMALL, txt.length > 26 ? txt.slice(0, 25) + '.' : txt, x0 + 4, y, s.done ? '#9a9a8a' : now ? '#7a1e2e' : '#3a2e24');
    });
  }

  return {
    update, draw,
    get worldX() { return hover?.x ?? 192; }, get worldY() { return hover?.y ?? 120; },
    down(x, y) {
      hover = { x, y };
      if (finished) return;
      const s = spotAt(x, y);
      if (s) { s.act(); return; }
      if (hand?.type === 'ing') { hand = null; play('click'); }               // klick på bänken: lägg tillbaka
    },
    move(x, y) { hover = { x, y }; },
    exit() {},
    // testkrokar
    _debug: {
      state: () => ({ cur, n: steps.length, step: steps[cur] ? { ...steps[cur] } : null, finished, hand: hand ? { ...hand } : null, bind: { ...bind },
        ves: Object.fromEntries(Object.entries(ves).map(([k, v]) => [k, { place: v.place, water: !!v.water, heat: v.heat, items: v.items.map((it) => ({ ...it })), stirs: v.stirs }])),
        burners: burners.map((b) => ({ ...b })), board: { ...board }, target: guideTargetSafe(), recipe: R.id, portions: N }),
      click: (id) => { const s = spots().find((x) => x.id === id); if (!s) return false; s.act(); return true; },
      spot: (id) => { const s = spots().find((x) => x.id === id); return s ? { x: Math.round((s.r[0] + s.r[2]) / 2), y: Math.round((s.r[1] + s.r[3]) / 2) } : null; },
      skip: (sec) => { for (let k = 0; k < sec * 20; k++) update(0.05); },
    },
  };
}
