// LEKSAKSLÅDAN – leksaksaffären i Pixelstaden (scen 'leksaker' i js/main.js). Gåbar och
// dubbelt så bred som skärmen (768 px, kameran följer figuren). Från vänster till höger:
//
//   SQUISHYVÄGGEN    hyllor fulla med squishy-mat och dumplings under en randig markis
//                    och ett rosa band med texten SQUISHY. På golvet framför står
//                    BAMBUKORGS-PYRAMIDEN på ett rött lackbord: staplade ångkorgar med
//                    dumplings i – två har lock, klick lyfter locket (lite ånga och hjärtan).
//   KAPSELAUTOMATEN  och DÖRREN – glasdörr med regnbåge runt och en ringklocka.
//   KLÄMBORDET       rosa duk med spetskant, sex squishies på små spetsdukar och en
//                    molnskylt TESTA MIG! Klick på bordet → figuren går dit och ställer
//                    sig bakom bordet. Sedan: TRYCK OCH HÅLL på en squishy = den trycks ihop
//                    (press) så länge man håller, SLÄPP = den fjädrar tillbaka med studs
//                    (release). Kameran står still över bordet så länge man är där, så att
//                    squishyn aldrig glider undan under fingret. Under varje squishy hänger en
//                    prislapp i ett snöre – klick på lappen = köpdialogen för just den.
//                    Två barn klämmer och fnissar, en förälder står bredvid och svarar.
//   KASSAN           disk med kassaapparat, klubbor, presentpapper och ballonger. Kassören
//                    hälsar, slår in det man köpt och säger tack i en pratbubbla.
//   FIGURHYLLAN      Klämkompisarna som småfigurer på podier i upplysta fack med
//                    namnskyltar. Framför den PLYSCHBERGET – en låda som svämmar över.
//   LEKSAKSHYLLORNA  bilar och tåg, spel och klossar, dockor och badankor. På golvet en
//                    inhägnad lekmatta där ett tåg kör runt i en slinga genom en tunnel.
//
// Köp: klick på en vara (eller en hylla) → figuren går dit → dialog med bild, namn och pris
// (squishies går att klämma på i dialogen också) → A.game.money dras, A.game.toys[id] ökar
// med ett och A.game.save(); figuren hämtar paketet i kassan och kassören tackar. För lite
// pengar = en vänlig pratbubbla. Dörren → A.go('city').
//
// Pratbubblor: bara den som syns i bild pratar, och en ny replik väntar tills grannens
// bubbla är borta (barnen vid bordet tar tur, föräldern svarar efteråt).
//
// Sortimentet kommer från js/data/toys.js (TOYS, drawToy) och klämmandet från
// js/core/squish.js (createSquishy). De läses in dynamiskt: saknas de eller går de sönder
// används en enkel reserv här i filen med samma kontrakt, så att butiken aldrig kan krascha
// spelet – och byts mot de riktiga så fort de finns.
//
// _debug: spot(id) → { x, y } i SKÄRMkoordinater (kameran tittar dit om platsen ligger
//   utanför bild; släpps vid nästa klick), id ∈ 'dorr', 'disk', 'kassor', 'klambord',
//   'hylla-squishy', 'hylla-figur', 'hylla-plysch', 'hylla-leksak', 'pyramid',
//   'korg-0'…'korg-5', 'bord-0'…'bord-5' (squishiesarna på klämbordet), 'lapp-0'…'lapp-5'
//   (prislapparna under dem), 'tag', 'automat',
//   'hast', 'giraff', 'barn-0'…'barn-3', 'foralder' och varje leksaks id.
//   squeeze(i, sek = 0.45) – kläm nr i på bordet (trycks ihop, släpps efter sek sekunder)
//   press(i) / release(i), goTable() (figuren ställer sig vid bordet direkt),
//   buy(id) → { ok, poor?, money }, owned() → A.game.toys, state(), open(id) (köpdialogen),
//   openKat(kategori), lid(i) (lyft locket på korg i), lockCam(x|null), teleport(x, y),
//   tick(sek), cam(), panorama() (hela butiken som data-URL), toys() (sortimentet),
//   kidsSay() (två barn i tur och ordning + förälderns svar), roamTo(x, y, dir, sek)
//   (ställ springbarnet med nallen). state() har också bubbles (aktiva pratbubblor med
//   ruta och om talaren syns), tags, roam, parent och toTable.
import { Pix, SMALL, BIG, text, textW, eachTextPixel, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson } from '../core/people.js';
import { openModal, closeModal, esc } from '../core/ui.js';
import { fmt } from '../game.js';
import { play, isMuted, audioContext } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech, sayLines } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { $t, $n } from '../core/i18n.js';

// ======================= sortimentet och klämmotorn (dynamiskt) =======================
let TOYMOD = null, SQMOD = null;
import('../data/toys.js').then((m) => { if (Array.isArray(m?.TOYS) && typeof m.drawToy === 'function') TOYMOD = m; }).catch(() => { /* reserven nedan */ });
import('../core/squish.js').then((m) => { if (typeof m?.createSquishy === 'function') SQMOD = m; }).catch(() => { /* reserven nedan */ });
const modKey = () => (TOYMOD ? 'T' : 't') + (SQMOD ? 'S' : 's');

// ======================= mått (världskoordinater) =======================
let VW = 384; // mobilfyllning: vyn följer skärmen, klampad till butiken
const W = 768, H = 216;
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); };
const CEIL = 8, WAIN = 58, WALL_Y = 88;
const SQW = { x0: 10, x1: 194, top: 30, base: 97 };          // squishyväggen
const SQW_F = [52, 74, 94];                                  // hyllplanen = främre radens fötter
const CAPS = { x: 212, y: 99 };                              // kapselautomaten
const DOOR = { x0: 232, x1: 262, top: 34 };
const DOOR_SPOT = [247, 100];
const CNT = { x0: 292, x1: 386, top: 100, face: 107, y: 124 }; // kassadisken
const PAY = [338, 134];                                      // där man hämtar paketet
const CASH_Y = 110;                                          // kassörens fötter (bakom disken)
const FIG = { x0: 396, x1: 532, top: 30, base: 97 };         // figurfacken 4×2
const FIG_ROWS = [{ y0: 33, y1: 57, plate: 57 }, { y0: 65, y1: 87, plate: 87 }];
const GIR = { x: 539, y: 102 };                              // jättegiraffen
const TS = { x0: 548, x1: 762, top: 16, base: 97 };          // leksakshyllorna
const TS_F = [50, 72, 94];
const BAYS = [{ x0: 551, x1: 619 }, { x0: 621, x1: 689 }, { x0: 691, x1: 759 }];
const BAY_NAMES = [$t('BILAR + TÅG'), $t('SPEL + KLOSSAR'), $t('DOCKOR + BOLLAR')];
const TABLE = { x0: 144, x1: 284, top: 138, front: 152, y: 165 }; // klämbordet
const SQ_Y = 148;                                            // squishiesarnas fotlinje på bordet
const ME_TABLE = [240, 146];                                 // min plats bakom bordet
const BACK_X0 = 206, BACK_X1 = 276;                          // där jag kan stå bakom bordet (barnet står till vänster)
const PYR = { x: 80, y: 150 };                               // pyramidbordets mitt
const CRATE = { x0: 414, x1: 490, top: 178, y: 206 };        // plyschberget
const HORSE = { x: 520, y: 150 };
const MAT = { x0: 556, x1: 756, y0: 124, y1: 204 };          // lekmattan med tåget
const TRK = { cxL: 606, cxR: 702, cy: 164, rx: 34, ry: 21 };
const LAMPS = [214, 389, 620];
const BALLS = { x: 30, y: 204 };                             // korgen med bollar
const GIFTS = { x: 532, y: 208 };                            // presentstapeln
const PALM = { x: 312, y: 210 };                             // krukväxten
const SIGN = { x: 152, y: 110 };                             // molnskylten TESTA MIG! på en pinne i bordet

// ======================= små målarverktyg =======================
const WHITE = 0xffffff, INK = 0x3a2238;
const P_PINK = { hi: 0xffe2ec, base: 0xf8bcd0, lo: 0xe890ac, dk: 0xb45a7e };
const P_MINT = { hi: 0xdcf8ec, base: 0xaee6d0, lo: 0x78c8aa, dk: 0x3e9676 };
const P_LILAC = { hi: 0xefe6fc, base: 0xd4c0f4, lo: 0xa88ede, dk: 0x6e58aa };
const P_BUTTER = { hi: 0xfff6cc, base: 0xfce290, lo: 0xecc05a, dk: 0xb08a2c };
const P_SKY = { hi: 0xe2f4fe, base: 0xb6def6, lo: 0x84c0e8, dk: 0x4a88ba };
const P_CORAL = { hi: 0xffd2c4, base: 0xfa9e86, lo: 0xe4705c, dk: 0xa8443a };
const P_WOOD = { hi: 0xf6e0bc, base: 0xe2bc8a, lo: 0xbe8e5a, dk: 0x7e5634 };
const P_WHITE = { hi: 0xffffff, base: 0xf8f2ee, lo: 0xe0d6d2, dk: 0xa89ca6 };
const P_RED = { hi: 0xf0706a, base: 0xc8323a, lo: 0x961e2a, dk: 0x5e1018 };
const P_GOLD = { hi: 0xfff0a8, base: 0xe8c050, lo: 0xb88a2a, dk: 0x7a5a18 };
const PASTELS = [P_PINK, P_MINT, P_BUTTER, P_LILAC, P_SKY, P_CORAL];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hx = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
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
function rowsOf(P, x, y, w, cols) { cols.forEach((c, i) => { if (c !== null) area(P, x, y + i, w, 1, (X, Y) => jit(c, X, Y, 9 + i, 0.04)); }); }
function spr(P, x, y, rows, pal, a = 1) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.px(x + i, y + j, c, a); }
  }
}
// mjuk kontur runt allt som är målat i en Pix (tonad efter grannfärgen)
function outline(P, dark = INK, k = 0.3) {
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
    const o = mix(dark, (src[best] << 16) | (src[best + 1] << 8) | src[best + 2], k);
    d[i] = (o >> 16) & 255; d[i + 1] = (o >> 8) & 255; d[i + 2] = o & 255; d[i + 3] = 255;
  }
}
function textMask(F, s) {
  const w = textW(F, s), pts = [];
  eachTextPixel(F, s, 0, 0, 1, (x, y) => pts.push([x, y]));
  return { w, pts, set: new Set(pts.map(([a, b]) => a + ',' + b)) };
}
function drawText(P, M, x, y, o) {
  const has = (a, b) => M.set.has(a + ',' + b);
  if (o.shadow !== undefined) for (const [a, b] of M.pts) if (!has(a + 1, b + 1)) P.px(x + a + 1, y + b + 1, o.shadow, o.sa ?? 0.6);
  if (o.out !== undefined) for (const [a, b] of M.pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], ...(o.out8 ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : [])]) if (!has(a + dx, b + dy)) P.px(x + a + dx, y + b + dy, o.out, o.oa ?? 1);
  for (const [a, b] of M.pts) {
    let c = typeof o.fill === 'function' ? o.fill(a, b) : o.fill;
    if (o.hi !== undefined && !has(a, b - 1)) c = o.hi;
    else if (o.lo !== undefined && !has(a, b + 1)) c = o.lo;
    P.px(x + a, y + b, c, o.a ?? 1);
  }
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
function glowImg(rx, ry, c, amax, steps = 4) {
  const P = new Pix(Math.ceil(rx) * 2 + 2, Math.ceil(ry) * 2 + 2);
  P.ell(P.w / 2, P.h / 2, rx, ry, c, amax, steps);
  return P.flush();
}
// fyll ett cirkel-/ellipsområde med en färgfunktion
function disc(P, cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) continue;
    const c = fn(x, y, d);
    if (c !== null && c !== undefined) P.px(x, y, c);
  }
}
// pixelkarta direkt på en canvas ('.' = genomskinligt)
function ctxSpr(ctx, x, y, rows, pal) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c === undefined) continue; ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); }
  }
}
function fpx(ctx, x, y, c, w = 1, h = 1) { ctx.fillStyle = typeof c === 'number' ? hx(c) : c; ctx.fillRect(x, y, w, h); }
function ctxLine(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 300; n++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
const isNight = (h) => h >= 19.5 || h < 6.5;
function darkness(hour) {
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}
// text i spelets pixeltypsnitt: versaler, ÅÄÖÉ, siffror och några tecken
const safeTxt = (s) => String(s).toUpperCase().replace(/[–—]/g, '-').replace(/&/g, '+').replace(/[^A-ZÅÄÖÉÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿€$0-9 \-+!.:,?/%'=]/g, '');

// ======================= reservsortimentet =======================
// Samma kontrakt som js/data/toys.js – används bara tills (eller om) den inte går att läsa.
const FB_TOYS = [
  { id: 'dumpling', namn: $n('Dumplingen Degis'), pris: 39, kategori: 'squishy', squish: true, beskrivning: $t('Nyångad och mjuk som ett moln – kläm, så ler den.') },
  { id: 'dumpling-rosa', namn: $n('Rosa dumplingen'), pris: 39, kategori: 'squishy', squish: true, beskrivning: $t('Doftar lite jordgubb. Blir alldeles platt och studsar tillbaka.') },
  { id: 'dumpling-glitter', namn: $n('Glitterdumplingen'), pris: 59, kategori: 'squishy', squish: true, beskrivning: $t('Full av glitter som gnistrar när man klämmer.') },
  { id: 'bao-panda', namn: $n('Pandabaon'), pris: 45, kategori: 'squishy', squish: true, beskrivning: $t('En ångad bulle med små pandaöron.') },
  { id: 'mochi', namn: $n('Mochin Mjuka'), pris: 35, kategori: 'squishy', squish: true, beskrivning: $t('Rund och rosa med en jordgubbe på toppen.') },
  { id: 'munk', namn: $n('Strösselmunken'), pris: 49, kategori: 'squishy', squish: true, beskrivning: $t('Rosa glasyr och strössel i alla färger.') },
  { id: 'rostbrod', namn: $n('Rostbrödet Rulle'), pris: 45, kategori: 'squishy', squish: true, beskrivning: $t('En skiva rostbröd som alltid är glad.') },
  { id: 'risboll', namn: $n('Risbollen'), pris: 39, kategori: 'squishy', squish: true, beskrivning: $t('Trekantig risboll med ett sjögräsbälte.') },
  { id: 'fig-kanin', namn: $n('Fluffa'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Kaninen Fluffa – Klämkompisarnas mjukaste.') },
  { id: 'fig-bjorn', namn: $n('Brumme'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Björnen Brumme somnar gärna i en honungsburk.') },
  { id: 'fig-groda', namn: $n('Hoppsan'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Grodan Hoppsan hoppar högst av alla.') },
  { id: 'fig-pingvin', namn: $n('Pingla'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Pingvinen Pingla åker kana på magen.') },
  { id: 'fig-rav', namn: $n('Ruffe'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Räven Ruffe har alltid ett hyss på gång.') },
  { id: 'fig-uggla', namn: $n('Hoho'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Ugglan Hoho kan alla godnattsagor utantill.') },
  { id: 'fig-anka', namn: $n('Snadder'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Ankan Snadder pratar jämt – mest om bad.') },
  { id: 'fig-katt', namn: $n('Mjölle'), pris: 69, kategori: 'figur', squish: false, beskrivning: $t('Katten Mjölle spinner när man håller henne.') },
  { id: 'plysch-kanin', namn: $n('Fluffa-gosedjur'), pris: 149, kategori: 'plysch', squish: false, beskrivning: $t('Stor och mjuk Fluffa att krama.') },
  { id: 'plysch-bjorn', namn: $n('Brumme-gosedjur'), pris: 149, kategori: 'plysch', squish: false, beskrivning: $t('Brumme som gosedjur – bäst att somna med.') },
  { id: 'plysch-groda', namn: $n('Hoppsan-gosedjur'), pris: 129, kategori: 'plysch', squish: false, beskrivning: $t('En gosig groda med stora ögon.') },
  { id: 'plysch-pingvin', namn: $n('Pingla-gosedjur'), pris: 129, kategori: 'plysch', squish: false, beskrivning: $t('Pingla med extra mjuk mage.') },
  { id: 'plysch-katt', namn: $n('Mjölle-gosedjur'), pris: 139, kategori: 'plysch', squish: false, beskrivning: $t('Mjölle som gosedjur – hon spinner inte, men nästan.') },
  { id: 'bil', namn: $n('Racerbilen'), pris: 59, kategori: 'leksak', squish: false, beskrivning: $t('En röd racerbil med dragåterfjäder.') },
  { id: 'brandbil', namn: $n('Brandbilen'), pris: 89, kategori: 'leksak', squish: false, beskrivning: $t('Med stege som går att fälla upp.') },
  { id: 'tag', namn: $n('Tåget'), pris: 129, kategori: 'leksak', squish: false, beskrivning: $t('Ett litet lok i trä – precis som det på lekmattan.') },
  { id: 'klossar', namn: $n('Byggklossarna'), pris: 79, kategori: 'leksak', squish: false, beskrivning: $t('ABC-klossar i trä att bygga torn av.') },
  { id: 'spel', namn: $n('Knuffspelet'), pris: 99, kategori: 'leksak', squish: false, beskrivning: $t('Ett brädspel för hela familjen – knuffa hem dina pjäser!') },
  { id: 'docka', namn: $n('Dockan Ella'), pris: 119, kategori: 'leksak', squish: false, beskrivning: $t('Docka med rosa klänning i en fin kartong.') },
  { id: 'badanka', namn: $n('Badankan'), pris: 29, kategori: 'leksak', squish: false, beskrivning: $t('Klassisk gul badanka som piper.') },
  { id: 'boll', namn: $n('Randiga bollen'), pris: 39, kategori: 'leksak', squish: false, beskrivning: $t('Studsar högt och är lagom stor.') },
];
function pal3(base) { return { base, hi: mix(base, WHITE, 0.55), lo: mul(base, 0.85), o: mix(mul(base, 0.5), INK, 0.5) }; }
const FB_SQ = {
  dumpling: { shape: 'dome', w: 14, h: 10, pal: pal3(0xfbf1e0), deco: 'pleats' },
  'dumpling-rosa': { shape: 'dome', w: 14, h: 10, pal: pal3(0xf8c2d4), deco: 'pleats' },
  'dumpling-glitter': { shape: 'dome', w: 14, h: 10, pal: pal3(0xd6c2f6), deco: 'pleats', glitter: true },
  'bao-panda': { shape: 'dome', w: 14, h: 11, pal: pal3(0xfcfaf6), deco: 'panda' },
  mochi: { shape: 'mochi', w: 13, h: 9, pal: pal3(0xf8d0dc), deco: 'berry' },
  munk: { shape: 'mochi', w: 15, h: 9, pal: pal3(0xe2b27c), deco: 'icing' },
  rostbrod: { shape: 'loaf', w: 13, h: 12, pal: pal3(0xf6e0b0), deco: 'crust' },
  risboll: { shape: 'tri', w: 14, h: 12, pal: pal3(0xfcfcf8), deco: 'nori' },
};
const SHAPES = {
  dome: (v) => Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, v * 1.12), 2))) * (v > 0.92 ? 0.9 : 1),
  mochi: (v) => Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.56) / 0.62, 2))),
  tri: (v) => Math.min(1, 0.28 + v * 0.9) * (v > 0.9 ? 0.9 : 1),
  loaf: (v) => (v < 0.2 ? 0.8 + v : 1) * (v > 0.92 ? 0.9 : 1),
};
// kropp: rader med bredd enligt formen, kontur, ljus uppe till vänster → radernas [vänster, höger]
function blob(ctx, shape, cx, fy, w, h, pal) {
  const x0 = cx - (w >> 1), y0 = fy - h, rows = [];
  for (let j = 0; j < h; j++) {
    const v = h === 1 ? 1 : j / (h - 1);
    let rw = Math.max(1, Math.round(w * SHAPES[shape](v)));
    if ((w - rw) & 1) rw = Math.min(w, rw + 1);
    const l = x0 + ((w - rw) >> 1);
    rows.push([l, l + rw - 1]);
  }
  for (let j = 0; j < h; j++) {
    const [l, r] = rows[j];
    for (let x = l; x <= r; x++) {
      const up = j > 0 && x >= rows[j - 1][0] && x <= rows[j - 1][1];
      const dn = j < h - 1 && x >= rows[j + 1][0] && x <= rows[j + 1][1];
      let c;
      if (x === l || x === r || !up || !dn) c = pal.o;
      else {
        const nx = (x - cx + 0.5) / (w / 2), ny = (j - h * 0.35) / h;
        const L = -nx * 0.55 - ny * 1.1;
        c = L > 0.5 ? pal.hi : L < -0.45 ? pal.lo : pal.base;
      }
      fpx(ctx, x, y0 + j, c);
    }
  }
  return { rows, x0, y0 };
}
// kawaii-ansiktet: vanligt (prickögon + liten mun) eller hopknipet (> < och en liten o-mun)
function kawaii(ctx, cx, ey, w, mood) {
  const dx = Math.max(2, Math.round(w * 0.2)), e = hx(INK);
  if (mood === 'squint') {
    fpx(ctx, cx - dx - 1, ey - 1, e); fpx(ctx, cx - dx, ey, e); fpx(ctx, cx - dx - 1, ey + 1, e);
    fpx(ctx, cx + dx, ey - 1, e); fpx(ctx, cx + dx - 1, ey, e); fpx(ctx, cx + dx, ey + 1, e);
    fpx(ctx, cx - 1, ey + 2, e, 2, 1); fpx(ctx, cx - 1, ey + 3, e, 2, 1);
  } else {
    fpx(ctx, cx - dx, ey, e, 1, 2); fpx(ctx, cx + dx - 1, ey, e, 1, 2);
    fpx(ctx, cx - 1, ey + 2, e); fpx(ctx, cx, ey + 2, e);
  }
  fpx(ctx, cx - dx - 2, ey + 2, '#f48cab', 2, 1); fpx(ctx, cx + dx, ey + 2, '#f48cab', 2, 1);
}
function fbSquishFrame(ctx, id, x, y, step = 0, t = 0) {
  const d = FB_SQ[id];
  if (!d) return;
  const k = clamp(step, -2, 6);
  let w = d.w + (k > 0 ? Math.round(d.w * 0.34 * k / 6) : k * 1);
  const h = Math.max(3, d.h - (k > 0 ? Math.round(d.h * 0.42 * k / 6) : k));
  if ((w - d.w) & 1) w++;
  const cx = Math.round(x), fy = Math.round(y);
  if (d.deco === 'panda') for (const s of [-1, 1]) fpx(ctx, cx + s * (w >> 2) - 1, fy - h - 1, '#2a2430', 3, 2);
  const b = blob(ctx, d.shape, cx, fy, w, h, d.pal);
  const top = b.y0;
  const mood = k >= 3 ? 'squint' : 'normal';
  let ey = fy - Math.max(2, Math.round(h * 0.45));
  if (d.deco === 'pleats') {
    const c = hx(d.pal.lo);
    for (let i = 1; i <= Math.min(3, h - 4); i++) { fpx(ctx, cx - 2 - i, top + i, c); fpx(ctx, cx + 1 + i, top + i, c); if (i < 3) fpx(ctx, cx, top + i, c); }
    fpx(ctx, cx - 1, top - 1, hx(d.pal.o), 2, 1);
  } else if (d.deco === 'panda') {
    for (const s of [-1, 1]) fpx(ctx, cx + s * Math.max(2, Math.round(w * 0.2)) - (s > 0 ? 2 : 1), ey - 1, '#3a3440', 3, 3);
  } else if (d.deco === 'berry') {
    fpx(ctx, cx - 1, top - 2, '#e8404e', 3, 2); fpx(ctx, cx - 1, top - 3, '#5aa84a', 3, 1); fpx(ctx, cx, top - 2, '#ffb0b0');
  } else if (d.deco === 'icing') {
    const n = Math.max(2, Math.round(h * 0.55));
    for (let j = 1; j < n && j < b.rows.length; j++) { const [l, r] = b.rows[j]; for (let x2 = l + 1; x2 < r; x2++) fpx(ctx, x2, top + j, j === 1 ? '#ffd4e2' : ((x2 * 7 + j * 3) % 11 === 0 ? ['#6ad0f0', '#fff27a', '#8ae07a', '#ffffff'][(x2 + j) & 3] : '#f890b4')); }
    fpx(ctx, cx - 1, top + 2, '#8a5030', 3, 1);
    ey = fy - Math.max(2, Math.round(h * 0.3));
  } else if (d.deco === 'crust') {
    const c = hx(0xc8884a);
    for (let j = 0; j < b.rows.length; j++) { const [l, r] = b.rows[j]; fpx(ctx, l + 1, top + j, c); fpx(ctx, r - 1, top + j, c); if (j === 1) for (let x2 = l + 1; x2 < r; x2++) fpx(ctx, x2, top + j, c); }
  } else if (d.deco === 'nori') {
    const nw = Math.max(4, Math.round(w * 0.42)), nh = Math.max(2, Math.round(h * 0.4));
    fpx(ctx, cx - (nw >> 1), fy - nh - 1, '#2e4a3a', nw, nh); fpx(ctx, cx - (nw >> 1), fy - nh - 1, '#4a6a54', nw, 1);
    ey = fy - Math.max(3, Math.round(h * 0.62));
  }
  kawaii(ctx, cx, ey, w, mood);
  if (d.glitter) for (let n = 0; n < 6; n++) {
    const gx = cx - (w >> 1) + 2 + Math.floor(hash(n, 1, 77) * (w - 4)), gy = top + 2 + Math.floor(hash(n, 2, 77) * Math.max(1, h - 4));
    const on = Math.sin(t * 5 + n * 1.9) > 0.2 || k >= 2;
    if (on) fpx(ctx, gx, gy, n & 1 ? '#ffffff' : '#fff2a8');
  }
}
// Klämkompisarna i reserven: tvåbollsfigurer (kropp + stort huvud) med öron per djur
const FB_CRIT = {
  kanin: { c: 0xfaf4f0, belly: 0xffe0ea, ear: 'long', earIn: 0xf8b4c8 },
  bjorn: { c: 0xc89060, belly: 0xf2d6b2, ear: 'round', earIn: 0xa06a40 },
  groda: { c: 0x9cd87c, belly: 0xe6f6c8, ear: 'frog' },
  pingvin: { c: 0x4a5a78, belly: 0xfcfaf4, ear: 'none', beak: 0xf4b040 },
  rav: { c: 0xf08a48, belly: 0xfff4e8, ear: 'tri', earIn: 0x5a3020 },
  uggla: { c: 0xb88ac8, belly: 0xf4e4c8, ear: 'tuft', beak: 0xf4b040 },
  anka: { c: 0xfce27a, belly: 0xfff4c0, ear: 'none', beak: 0xf49a40 },
  katt: { c: 0xbcc0cc, belly: 0xfcfaf6, ear: 'tri', earIn: 0xf8b4c8 },
};
function fbCritter(ctx, kind, x, y, big) {
  const K = FB_CRIT[kind];
  if (!K) return;
  const hw = big ? 17 : 11, hh = big ? 13 : 9, bw = big ? 13 : 9, bh = big ? 10 : 6;
  const cx = Math.round(x), fy = Math.round(y), pal = pal3(K.c), hfy = fy - bh + 3, htop = hfy - hh;
  const o = hx(pal.o), c = hx(K.c), ci = hx(K.earIn || pal.lo);
  const ex = Math.round(hw * 0.28);
  if (K.ear === 'long') for (const s of [-1, 1]) { const eh = big ? 9 : 6, ew = big ? 4 : 3; fpx(ctx, cx + s * ex - (ew >> 1), htop - eh + 2, o, ew, eh); fpx(ctx, cx + s * ex - (ew >> 1) + 1, htop - eh + 3, c, ew - 2, eh - 1); if (big) fpx(ctx, cx + s * ex - (ew >> 1) + 1, htop - eh + 4, ci, ew - 2, eh - 3); }
  if (K.ear === 'round') for (const s of [-1, 1]) { const r = big ? 4 : 3; fpx(ctx, cx + s * (ex + 1) - (r >> 1), htop - 1, o, r, r); fpx(ctx, cx + s * (ex + 1) - (r >> 1) + 1, htop, ci, r - 2, r - 2); }
  if (K.ear === 'tri' || K.ear === 'tuft') for (const s of [-1, 1]) { const eh = K.ear === 'tuft' ? 2 : big ? 5 : 3; for (let j = 0; j < eh; j++) { const ww = j + 1; fpx(ctx, cx + s * (ex + 1) - (ww >> 1), htop - eh + 1 + j, j === 0 ? o : c, ww, 1); } if (K.earIn && eh > 2) fpx(ctx, cx + s * (ex + 1), htop - 1, ci); }
  blob(ctx, 'mochi', cx, fy, bw, bh, pal);
  if (K.belly) { const bwi = Math.max(3, bw - 4); fpx(ctx, cx - (bwi >> 1), fy - bh + 2, hx(K.belly), bwi, Math.max(1, bh - 3)); }
  fpx(ctx, cx - (bw >> 1) + 1, fy - 1, o, 2, 1); fpx(ctx, cx + (bw >> 1) - 2, fy - 1, o, 2, 1);
  blob(ctx, 'mochi', cx, hfy, hw, hh, pal);
  if (kind === 'pingvin') fpx(ctx, cx - (hw >> 1) + 2, hfy - hh + Math.round(hh * 0.4), hx(K.belly), hw - 4, Math.round(hh * 0.45));
  const ey = hfy - Math.round(hh * 0.5);
  if (K.ear === 'frog') {
    for (const s of [-1, 1]) { const r = big ? 5 : 4; fpx(ctx, cx + s * ex - (r >> 1), htop - 2, o, r, r - 1); fpx(ctx, cx + s * ex - (r >> 1) + 1, htop - 1, '#ffffff', r - 2, r - 2); fpx(ctx, cx + s * ex, htop - 1 + (big ? 1 : 0), hx(INK)); }
    fpx(ctx, cx - 2, ey + 2, hx(INK), 4, 1);
    fpx(ctx, cx - ex - 2, ey + 1, '#f48cab', 2, 1); fpx(ctx, cx + ex, ey + 1, '#f48cab', 2, 1);
  } else if (kind === 'uggla') {
    for (const s of [-1, 1]) { fpx(ctx, cx + s * ex - 1, ey - 1, '#fff8e8', 3, 3); fpx(ctx, cx + s * ex, ey, hx(INK)); }
    fpx(ctx, cx - 1, ey + 2, hx(K.beak), 2, 1);
  } else {
    kawaii(ctx, cx, ey, hw, 'normal');
    if (K.beak) fpx(ctx, cx - 1, ey + 2, hx(K.beak), 2, 1);
  }
}
const FBP = { k: '#3a2238', r: '#e2323e', R: '#ff7a78', w: '#cfe8f8', g: '#8a8a96', G: '#c8c8d0', y: '#ffd23a', Y: '#fff2a0', b: '#3a7bd5', B: '#8ab8f0', o: '#f49a40', p: '#f8a8c4', P: '#ffd8e6', m: '#6ec8a0', l: '#b8e8d0', s: '#f6d7bf', h: '#8a5a2e', W: '#ffffff', n: '#c89060', v: '#9a6ad8' };
const FB_MAPS = {
  bil: ['...kkkkk....', '..kRwwwrk...', '.kkrrrrrrkkk', 'kRrrrrrrrrrk', 'krrrrrrrrrYk', '.kgkkkkkgkk.', '..k.....k...'],
  brandbil: ['.GkGkGkG.......', '.kkkkkkkkkkk...', '.krrrrrrrkwwk..', 'kRrrrrrrrkwwrk.', 'krrrrrrrrrrrrYk', 'kyyyyyyyyyyyyyk', '.kgk....kgk.kgk', '..k......k...k.'],
  tag: ['..........kk..', '.rrrr.....kk..', 'rrrrrr..kkkkk.', '.rwwr.bbbbbbb.', '.rwwr.bBBBBBbY', '.rrrrrbbbbbbbY', 'yyyyyyyyyyyyyy', '.kgk.kgk..kgk.', '..k...k....k..'],
  klossar: ['...kkkk...', '...kbWbk..', '...kbbbk..', 'kkkkkkkkkk', 'krWrkymyk.', 'krrrkyyyk.', 'kkkkkkkkkk'],
  spel: ['kkkkkkkkkkkkkk', 'kyyrrryymmbbyk', 'kyWyyyyyyyyyWk', 'kyyyykkkkyyyyk', 'kkkkkkkkkkkkkk', 'khhhhhhhhhhhhk', 'kkkkkkkkkkkkkk'],
  docka: ['kkkkkkkkkk', 'kPPPPPPPPk', 'kPwhhhhwPk', 'kPwhsshwPk', 'kPwhsshwPk', 'kPwwpppwPk', 'kPwppppwPk', 'kPwppppwPk', 'kPwwsswwPk', 'kPwwkkwwPk', 'kPPPPPPPPk', 'kpppppppk.', 'kkkkkkkkkk'],
  badanka: ['..kkk....', '.kyyyk...', '.kykyyko.', '.kyyyyoo.', 'kyyyyyk..', 'kyYYyyyyk', 'kyyyyyyyk', '.kkkkkkk.'],
  boll: ['..kkkk..', '.krrWWk.', 'kyyyyyyk', 'kbbbbbbk', 'krrrrrrk', 'kyyyyyyk', '.kbbbbk.', '..kkkk..'],
};
function fbDrawToy(ctx, id, x, y, t = 0) {
  if (FB_SQ[id]) { fbSquishFrame(ctx, id, x, y, 0, t); return; }
  const m = /^(fig|plysch)-(.+)$/.exec(id);
  if (m) { fbCritter(ctx, m[2], x, y, m[1] === 'plysch'); return; }
  const M = FB_MAPS[id];
  if (M) ctxSpr(ctx, Math.round(x) - (M[0].length >> 1), Math.round(y) - M.length, M, FBP);
}

// ======================= ljud (samma mute som sound.js) =======================
function synth(fn) {
  if (isMuted()) return;
  const c = audioContext();
  if (!c) return;
  try { fn(c, c.currentTime); } catch { /* ljud är aldrig ett krav */ }
}
function blip(c, t0, f0, f1, dur, vol, type = 'sine') {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
// reservens klämpip: ett mjukt gnissel uppåt när den trycks, nedåt när den släpps
const squeak = (down) => synth((c, t0) => blip(c, t0, down ? 620 : 1050, down ? 1200 : 700, down ? 0.1 : 0.13, 0.06));
// tåget på lekmattan: tuut-tuut
const toot = () => synth((c, t0) => { blip(c, t0, 523, 520, 0.16, 0.035, 'triangle'); blip(c, t0, 659, 655, 0.16, 0.025, 'triangle'); blip(c, t0 + 0.22, 523, 520, 0.24, 0.035, 'triangle'); blip(c, t0 + 0.22, 659, 655, 0.24, 0.025, 'triangle'); });
// locket lyfts: ett litet "plopp"
const plopp = () => synth((c, t0) => blip(c, t0, 300, 900, 0.09, 0.05));
// kapselautomaten skramlar
const rattle = () => synth((c, t0) => { for (let i = 0; i < 5; i++) blip(c, t0 + i * 0.06, 1800 + i * 90, 1400, 0.03, 0.02, 'square'); });

// ======================= sortimentet (riktigt eller reserv) =======================
const KATS = ['squishy', 'figur', 'plysch', 'leksak'];
const KAT_NAME = { squishy: $t('Squishy'), figur: $t('Klämkompisar (figur)'), plysch: $t('Gosedjur'), leksak: $t('Leksak') };
const KAT_ICON = { squishy: '🥟', figur: '⭐', plysch: '🧸', leksak: '🚂' };
// Klämkompisarna får sitt eget djur i rubriken (Mysan är en katt, inte en kanin)
const ART_ICON = { kanin: '🐰', bjorn: '🐻', groda: '🐸', pingvin: '🐧', rav: '🦊', uggla: '🦉', katt: '🐱', anka: '🐥' };
function emojiOf(T) {
  const art = T.o?.art || /^(?:fig|plysch)-(.+)$/.exec(T.id)?.[1];
  if (art && ART_ICON[art]) return ART_ICON[art];
  if (/nalle/i.test(T.id)) return '🧸';
  return KAT_ICON[T.kategori] || '🎁';
}
function allToys() {
  const list = TOYMOD ? TOYMOD.TOYS : FB_TOYS;
  return list.filter((t) => t && typeof t.id === 'string' && KATS.includes(t.kategori) && Number.isFinite(+t.pris));
}
const toyById = (id) => allToys().find((t) => t.id === id) || null;
// namnet på spelarens språk (T.namn är svenskt – DUMP_RE/BAY_RE/glitterOf söker i det)
const toyName = (T) => (TOYMOD?.toyNamn ? TOYMOD.toyNamn(T) : $t(T.namn));
// namnet som det låter i en pratbubbla: "Pösa (plysch)" → "Pösa i plysch"
const sayName = (T) => String(toyName(T)).replace(/\s*\(plysch\)/i, ' i plysch').replace(/\s*\(figur\)/i, '-figuren').replace(/[()]/g, '');
function drawToyAt(ctx, id, x, y, t) {
  if (TOYMOD) { try { TOYMOD.drawToy(ctx, id, x, y, t); return; } catch { /* reserven */ } }
  fbDrawToy(ctx, id, x, y, t);
}
// Leksakernas bilder i vila, beskurna kring pixlarna: fyra tidslägen per leksak (glittret
// blinkar), ritade en gång och sedan bara kopierade – { c, ox, oy, w, h }
const TOY_CACHE = new Map();
function toyImg(id, slot = 0) {
  const key = (TOYMOD ? 'm' : 'f') + slot + ':' + id;
  let e = TOY_CACHE.get(key);
  if (e) return e;
  const S = 96, fx = 48, fy = 76;
  const big = mkCanvas(S, S), bx = big.getContext('2d', { willReadFrequently: true });
  bx.imageSmoothingEnabled = false;
  try { drawToyAt(bx, id, fx, fy, slot * 0.37); } catch { /* tom bild */ }
  const d = bx.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = fx - 4; x1 = fx + 3; y0 = fy - 6; y1 = fy - 1; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const c = mkCanvas(w, h), cx = c.getContext('2d');
  cx.drawImage(big, x0, y0, w, h, 0, 0, w, h);
  e = { c, ox: fx - x0, oy: fy - y0, w, h };
  TOY_CACHE.set(key, e);
  return e;
}
// Leksaken i vila på (x, y) = fotpunkten. Med toys.js ritas den direkt (cachade bildrutor,
// glitter och blinkningar); reserven kopieras ur cachen ovan.
function blitToy(ctx, id, x, y, t = 0, opts = null) {
  if (TOYMOD) { try { TOYMOD.drawToy(ctx, id, Math.round(x), Math.round(y), t, opts || { levande: true }); return; } catch { /* reserven */ } }
  const e = toyImg(id, Math.floor(t * 2.2) & 3);
  ctx.drawImage(e.c, Math.round(x) - e.ox, Math.round(y) - e.oy);
}
// storleken i vila: w = bredd, h = höjd ovanför fotlinjen, ox = fotpunktens avstånd från vänsterkanten
function dims(id, size = 1) {
  if (TOYMOD?.toyBox) { try { const b = TOYMOD.toyBox(id, size); return { w: b.x1 - b.x0, h: -b.y0, ox: -b.x0 }; } catch { /* reserven */ } }
  const e = toyImg(id, 0);
  return { w: e.w, h: e.oy, ox: e.ox };
}

// Reservens klämleksak (samma kontrakt som squish.js): egna reservleksaker ritas om i varje
// klämsteg (lägre och bredare, ögonen kniper, munnen blir ett o); en riktig leksak utan
// squish.js får förberäknade pixelsteg ur sin egen bild (rader tas bort, kolumner dubblas).
function fbSquishy(id) {
  const own = !!FB_SQ[id] && !TOYMOD;
  let s = 0, v = 0, pressed = false, t = 0;
  let frames = null;
  const stepFrames = () => {
    if (frames) return frames;
    const e = toyImg(id, 0);
    frames = [];
    for (let k = -2; k <= 6; k++) {
      const w2 = Math.max(2, e.w + (k > 0 ? Math.round(e.w * 0.3 * k / 6) : k)), h2 = Math.max(2, e.h - (k > 0 ? Math.round(e.h * 0.4 * k / 6) : k));
      const src = e.c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, e.w, e.h).data;
      const c = mkCanvas(w2, h2), x = c.getContext('2d'), img = x.createImageData(w2, h2);
      for (let j = 0; j < h2; j++) for (let i = 0; i < w2; i++) {
        const sx = Math.min(e.w - 1, Math.floor((i + 0.5) * e.w / w2)), sy = Math.min(e.h - 1, Math.floor((j + 0.5) * e.h / h2));
        for (let q = 0; q < 4; q++) img.data[(j * w2 + i) * 4 + q] = src[(sy * e.w + sx) * 4 + q];
      }
      x.putImageData(img, 0, 0);
      frames.push({ c, ox: Math.round(e.ox * w2 / e.w), oy: e.oy - (e.h - h2) });
    }
    return frames;
  };
  return {
    get pressed() { return pressed; },
    press() { if (pressed) return; pressed = true; squeak(true); },
    release() { if (!pressed) return; pressed = false; squeak(false); },
    update(dt) {
      t += dt;
      if (pressed) { s += (1 - s) * Math.min(1, dt * 16); v = 0; return; }
      // dämpad fjäder: två–tre svängningar tillbaka till vila
      for (let n = 0; n < 3; n++) { const h = dt / 3; v += (-190 * s - 6.5 * v) * h; s += v * h; }
      if (Math.abs(s) < 0.01 && Math.abs(v) < 0.08) { s = 0; v = 0; }
    },
    draw(ctx, x, y) {
      const step = s >= 0 ? Math.round(s * 6) : Math.max(-2, Math.round(s * 5));
      if (own) { fbSquishFrame(ctx, id, x, y, step, t); return; }
      const f = stepFrames()[step + 2];
      ctx.drawImage(f.c, Math.round(x) - f.ox, Math.round(y) - f.oy);
    },
  };
}
function makeSquishy(id, opts = {}) {
  if (SQMOD && TOYMOD) { try { const q = SQMOD.createSquishy(id, opts); if (q && typeof q.draw === 'function') return q; } catch { /* reserven */ } }
  return fbSquishy(id);
}
// Köpta leksaker: A.game.toys (id → antal). Finns fältet i sparfilen men inte i spelets
// tillstånd (game.js känner inte till det än) ligger det orört i _keep – då tas det in här,
// så att nästa save() inte skriver över tidigare köp.
// Har någon annan modul hunnit skapa ett tomt g.toys (t.ex. "A.game.toys ??= {}") slås det
// sparade ihop med det (största antalet per leksak vinner), så inget tidigare köp försvinner.
function toysOf(g) {
  if (!g.toys || typeof g.toys !== 'object' || Array.isArray(g.toys)) g.toys = {};
  const kept = g._keep?.top?.toys;
  if (kept && typeof kept === 'object' && !Array.isArray(kept) && !TOYS_MERGED.has(g)) {
    TOYS_MERGED.add(g);
    let back = false;
    for (const [k, v] of Object.entries(kept)) if ((v | 0) > (g.toys[k] | 0)) { g.toys[k] = Math.min(999, v | 0); back = true; }
    if (back) try { g.save?.(); } catch { /* sparas vid nästa save() */ }   // tillbaka i sparfilen direkt
  }
  return g.toys;
}
const TOYS_MERGED = new WeakSet();
const DUMP_RE = /dumpl|bao|gyoza|jiaozi|dim.?sum|klimp|momo|wonton|xiao|knyte/i;
const BAY_RE = [/bil|tåg|tag\b|lok|buss|flyg|båt|raket|traktor|polis|brand|motor/i, /spel|kloss|pussel|kub|domino|jojo|snurr|boll|kort|lego|bygg|ritb|krit/i, /dock|anka|bad|nalle|robot|prinsess|docka|tekopp|kök|mus/i];

// ======================= bakgrunden (målas en gång per dag/natt) =======================
function wallpaperPx(X, Y) {
  let c = (X % 14) < 7 ? 0xfde6ee : 0xfbdee8;
  const row = Math.floor((Y - CEIL) / 12), cx = ((X + (row & 1) * 7) % 14 + 14) % 14, cy = (Y - CEIL) % 12;
  const dx = Math.abs(cx - 7), dy = Math.abs(cy - 6);
  if ((row & 1) === 0) { if ((dx === 0 && dy <= 1) || (dy === 0 && dx <= 1)) c = dx + dy === 0 ? 0xffffff : 0xfff4f8; }   // små stjärnor
  else if (dx <= 1 && dy === 0) c = 0xf6c8d8;                                                                            // hjärtan (små)
  else if (dy === 1 && cy === 5 && (dx === 1 || dx === 2) && false) c = 0xf6c8d8;
  if (Y < CEIL + 4) c = mul(c, 0.9 + (Y - CEIL) * 0.025);
  return jit(c, X, Y, 1, 0.03);
}
function paintWall(P) {
  const ceil = [0x4a2e44, 0x6a4a60, 0xfff8f2, 0xf4e8e8, 0xe4d4d8, 0xcdb8c4, 0xa48ea0, 0x7a6478];
  for (let y = 0; y < CEIL; y++) area(P, 0, y, W, 1, (X, Y) => (y === 4 && X % 3 === 0 ? 0xd8c4cc : y === 3 && X % 6 === 0 ? 0xffffff : jit(ceil[y], X, Y, 2, 0.04)));
  area(P, 0, CEIL, W, WAIN - CEIL, wallpaperPx);
  // bågkant (festong) under taklisten
  for (let x = 0; x < W; x++) {
    const d = Math.abs((x % 8) - 3.5), h = d < 1.6 ? 4 : d < 2.6 ? 3 : 2;
    for (let j = 0; j < h; j++) P.px(x, CEIL + j, j === h - 1 ? P_PINK.lo : j === 0 ? P_PINK.hi : P_PINK.base);
    if (d < 1) P.px(x, CEIL + 1, WHITE);
  }
  rowsOf(P, 0, WAIN, W, [0xffffff, 0xf6eef0, 0xdccfd6, 0xa8949e]);
  // pärlspont i mint
  area(P, 0, WAIN + 4, W, WALL_Y - 5 - WAIN - 4, (X, Y) => { const k = X % 5; return jit(k === 0 ? P_MINT.lo : k === 1 ? P_MINT.hi : P_MINT.base, X, Y, 3, 0.05); });
  P.darken(0, WAIN + 4, W, 1, 0.8);
  rowsOf(P, 0, WALL_Y - 5, W, [0xffffff, 0xf8f2f0, 0xece2e2, 0xc8bcc2, 0x8a7a86]);
}
// planksgolv i ljus ek (smalare plankor längst bak), fogar, ådring och kvistar
function paintFloor(P, night) {
  let y = WALL_Y, r = 0;
  while (y < H) {
    const h = Math.min(H - y, 4 + Math.floor((y - WALL_Y) / 28)), off = Math.floor(hash(r, 1, 300) * 44);
    for (let yy = y; yy < y + h; yy++) for (let x = 0; x < W; x++) {
      const u = x + off, plank = Math.floor(u / 46), px = ((u % 46) + 46) % 46, j = yy - y;
      const tone = hash(plank, r, 301);
      let c = mix(0xf0d2a4, 0xdcb482, tone);
      if (tone > 0.84) c = mix(c, 0xcc9c6a, 0.45);
      if (j === 0) c = mix(c, WHITE, 0.2);
      else if (j === h - 1) c = mul(c, 0.74);
      if (px === 0) c = mul(c, 0.72); else if (px === 1) c = mix(c, WHITE, 0.12);
      if (j > 0 && j < h - 1 && hash(Math.floor(u / 6), yy, 302) > 0.84) c = mul(c, 0.94);          // ådring
      const kx = Math.floor(hash(plank, r, 304) * 40) + 3;
      if (hash(plank, r, 305) > 0.72 && Math.abs(px - kx) <= 1 && j === (h >> 1)) c = mul(c, px === kx ? 0.72 : 0.86); // kvist
      c = mul(c, 0.84 + Math.min(1, (yy - WALL_Y) / 64) * 0.16);
      P.px(x, yy, jit(c, x, yy, 303, 0.035));
    }
    y += h; r++;
  }
  for (let x = 0; x < W; x++) for (let j = 0; j < 3; j++) if (hash(x, j, 83) > 0.6 + j * 0.14) P.px(x, WALL_Y + j, 0x5a3a2a, 0.3);
  for (let j = 0; j < 4; j++) P.darken(0, WALL_Y + j, W, 1, 0.7 + j * 0.08);
  // dagsljuset genom dörren
  if (!night) for (let j = 0; j < 30; j++) { const sh = j * 0.5, a = 0.24 * (1 - j / 30) + 0.05; for (let x = Math.round(DOOR.x0 + 3 + sh); x < Math.round(DOOR.x1 - 3 + sh); x++) if (bayer(x, WALL_Y + 2 + j) < 0.8) P.px(x, WALL_Y + 2 + j, 0xfff4d8, a); }
  // REGNBÅGSMATTAN under klämbordet: koncentriska ringar med tuftad yta och kantband
  const RING = [0xf6b8cc, 0xfccab0, 0xfce6a0, 0xbfe8cc, 0xb6dcf6, 0xd4c2f4];
  disc(P, 214, 170, 92, 30, (X, Y, d) => {
    if (d > 0.965) return jit(0xf6eef2, X, Y, 310, 0.06);
    const k = Math.min(RING.length - 1, Math.floor((1 - d / 0.965) * RING.length * 1.05));
    let c = RING[RING.length - 1 - k];
    if (hash(X, Y, 311) > 0.9) c = mix(c, WHITE, 0.3);
    if ((X + Y * 2) % 5 === 0) c = mul(c, 0.95);
    return jit(c, X, Y, 312, 0.06);
  });
  // MOLNMATTAN under plyschberget
  for (const [cx, cy, rx, ry] of [[452, 204, 60, 10], [410, 201, 22, 8], [496, 200, 24, 8], [440, 196, 26, 7], [472, 197, 24, 7]])
    disc(P, cx, cy, rx, ry, (X, Y, d) => jit(d > 0.88 ? 0xd8e8f4 : hash(X, Y, 313) > 0.92 ? 0xffffff : 0xf2f8fe, X, Y, 314, 0.05));
  // dörrmattan
  area(P, DOOR.x0 + 1, WALL_Y + 2, DOOR.x1 - DOOR.x0 - 2, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === DOOR.x1 - DOOR.x0 - 3 || j === 8 ? 0x8a3a5a : jit(hash(X, Y, 315) > 0.5 ? 0xe06a90 : 0xd05a82, X, Y, 316, 0.1)));
  text(P, SMALL, $t('LEK!'), DOOR.x0 + 7, WALL_Y + 4, 0xffe0ec);
  // skuggor under allt som står på golvet
  P.ell(PYR.x, PYR.y + 15, 44, 5, 0x2a1420, 0.35, 3);
  P.ell((TABLE.x0 + TABLE.x1) / 2, TABLE.y, 72, 4, 0x2a1420, 0.4, 3);
  P.ell((CNT.x0 + CNT.x1) / 2, CNT.y + 1, 50, 3, 0x2a1420, 0.4, 3);
  P.ell((CRATE.x0 + CRATE.x1) / 2, CRATE.y + 1, 42, 4, 0x2a1420, 0.35, 3);
  P.ell(HORSE.x, HORSE.y, 14, 2.5, 0x2a1420, 0.4, 2);
  P.ell(CAPS.x, CAPS.y, 12, 2.4, 0x2a1420, 0.4, 2);
  P.ell(GIR.x, GIR.y, 10, 2.4, 0x2a1420, 0.4, 2);
  P.ell(BALLS.x, BALLS.y, 18, 3, 0x2a1420, 0.35, 2);
  P.ell(GIFTS.x, GIFTS.y, 14, 2.4, 0x2a1420, 0.35, 2);
  P.ell(PALM.x, PALM.y, 9, 2.2, 0x2a1420, 0.4, 2);
  P.darken(SQW.x0, SQW.base, SQW.x1 - SQW.x0, 2, 0.7);
  P.darken(FIG.x0, FIG.base, FIG.x1 - FIG.x0, 2, 0.7);
  P.darken(TS.x0, TS.base, TS.x1 - TS.x0, 2, 0.7);
}
// Utsikten genom dörrens glas: himmel, huset mittemot med randig markis, lyktstolpe, trottoar
function paintOutside(P, night) {
  const x0 = DOOR.x0, x1 = DOOR.x1, y0 = DOOR.top, y1 = WALL_Y;
  area(P, x0, y0, x1 - x0, y1 - y0, (X, Y) => {
    if (Y < y0 + 8) return qmix(night ? 0x141a3a : 0x9ccfee, night ? 0x24305a : 0xcce8f6, (Y - y0) / 8, X, Y, 3);
    if (Y < y0 + 30) {                                         // huset mittemot: tegel
      const br = ((Y - y0) % 4 === 0) || ((X + (Math.floor((Y - y0) / 4) & 1) * 3) % 6 === 0);
      let c = br ? (night ? 0x2a1a1e : 0x9a5a4a) : (night ? 0x3a2228 : 0xc0705a);
      if (X > x0 + 5 && X < x0 + 14 && Y > y0 + 12 && Y < y0 + 24) c = night ? 0xffd890 : 0x5a7a98;        // fönster
      if (X > x0 + 18 && X < x1 - 3 && Y > y0 + 12 && Y < y0 + 24) c = night ? 0x3a3a50 : 0x6a8aa8;
      return jit(c, X, Y, 320, 0.08);
    }
    if (Y < y0 + 33) return (Math.floor(X / 3) & 1) ? (night ? 0x5a2a3a : 0xe86a8a) : (night ? 0x6a6068 : 0xf8f0ea); // markisen
    if (Y < y0 + 40) return jit(night ? 0x1a1a22 : 0x6a6670, X, Y, 321, 0.1);                                          // gatan
    if (Y < y0 + 41) return night ? 0x6a6660 : 0xe6dece;
    return jit(night ? 0x3a3436 : 0xc8c0b2, X, Y, 322, 0.08);                                                         // trottoaren
  });
  // lyktstolpen
  P.vl(x1 - 6, y0 + 4, 44, night ? 0x10141a : 0x2a3a34); P.rect(x1 - 7, y0 + 2, 3, 3, night ? 0xffe6a0 : 0x2a3a34);
  if (night) P.ell(x1 - 5.5, y0 + 4, 7, 5, 0xffd890, 0.4);
}
function paintDoorSurround(P) {
  const d0 = DOOR.x0, d1 = DOOR.x1, cx = (d0 + d1) / 2;
  // regnbågen runt dörren
  const RB = [0xe8505a, 0xf49a4a, 0xf8d860, 0x7ac87a, 0x6aa8e8, 0x9a7ad8];
  for (let y = 12; y < WALL_Y - 5; y++) for (let x = d0 - 20; x < d1 + 20; x++) {
    const dx = (x + 0.5 - cx) / 1, dy = Math.max(0, DOOR.top + 2 - (y + 0.5));
    const r = Math.hypot(dx / 1.0, dy * 1.35);
    const k = Math.floor(r - 17);
    if (k >= 0 && k < RB.length) P.px(x, y, jit(RB[k], x, y, 330, 0.05));
  }
  // små moln vid regnbågens fötter
  for (const [mx, my] of [[d0 - 16, 76], [d1 + 16, 76]]) for (const [ox, oy, r] of [[0, 0, 5], [-5, 2, 4], [5, 2, 4], [0, 3, 4]]) disc(P, mx + ox, my + oy, r, r * 0.8, (X, Y, dd) => (dd > 0.8 ? 0xd8e4f4 : 0xffffff));
  // dörrens foder i mint
  const CAS = [P_MINT.dk, P_MINT.hi, P_MINT.base, P_MINT.lo];
  for (let i = 0; i < 4; i++) { area(P, d0 - 4 + i, DOOR.top - 4, 1, WALL_Y - DOOR.top + 4, (X, Y) => jit(CAS[i], X, Y, 14, 0.04)); area(P, d1 + 3 - i, DOOR.top - 4, 1, WALL_Y - DOOR.top + 4, (X, Y) => jit(CAS[i], X, Y, 14, 0.04)); }
  rowsOf(P, d0 - 4, DOOR.top - 4, d1 - d0 + 8, [P_MINT.dk, P_MINT.hi, P_MINT.base, P_MINT.lo]);
  // UT-skylten
  const ux = Math.round(cx) - 8;
  P.rect(ux, 22, 17, 8, 0x1a2a1e); P.box(ux, 22, 17, 8, 0x0e1812);
  text(P, SMALL, $t('UT'), ux + 5, 24, 0x6fe08a);
  P.ell(ux + 8.5, 26, 12, 6, 0x6fe08a, 0.1, 2);
  P.hl(d0, WALL_Y - 1, d1 - d0, 0x2a1e18);
}
// ränderna på markisen över squishyväggen: rosa/vitt med bågad underkant
function paintAwning(P, x0, x1, y0) {
  for (let x = x0; x < x1; x++) {
    const k = ((x - x0) % 12 + 12) % 12, pink = k < 6, d = Math.abs((k % 6) - 2.5);
    const len = 8 + (d < 1.5 ? 2 : d < 2.5 ? 1 : 0);
    for (let j = 0; j < len; j++) {
      let c = pink ? P_PINK.base : 0xfffaf6;
      if (j < 2) c = mix(c, WHITE, 0.3);
      if (j === len - 1) c = pink ? P_PINK.dk : 0xd8c8cc;
      else if (k % 6 === 5) c = mul(c, 0.9);
      P.px(x, y0 + j, jit(c, x, y0 + j, 340, 0.03));
    }
    P.px(x, y0 + len, 0x6a4a5a, 0.35);
  }
  P.hl(x0 - 1, y0 - 1, x1 - x0 + 2, P_PINK.dk);
}
// skyltband med vikta ändar och text i BIG (fyllning, kontur, blank överkant)
function paintBanner(P, cx, y, s, col) {
  const M = textMask(BIG, s), w = M.w + 18, x0 = Math.round(cx - w / 2), h = 13;
  for (const [ex, dir] of [[x0 - 7, 1], [x0 + w, -1]]) {
    area(P, ex, y + 3, 8, h, (X, Y, i, j) => { const ii = dir > 0 ? i : 7 - i; if (j < 1 || j > h - 2) return null; if (ii < 3 && (j < 3 || j > h - 4) && Math.abs(j - h / 2) > (ii + 1.5)) return null; return jit(j === 1 ? col.base : j === h - 2 ? col.dk : col.lo, X, Y, 341, 0.04); });
  }
  area(P, x0, y, w, h, (X, Y, i, j) => (j === 0 ? col.hi : j === h - 1 ? col.dk : jit(j < 3 ? mix(col.base, WHITE, 0.3) : j > h - 4 ? col.lo : col.base, X, Y, 342, 0.04)));
  for (const ex of [x0, x0 + w - 1]) P.vl(ex, y, h, col.dk);
  for (const [a, b] of M.pts) if (!M.set.has(a + ',' + (b + 1))) P.px(x0 + 9 + a, y + 3 + b + 1, col.dk);
  drawText(P, M, x0 + 9, y + 3, { fill: (a, b) => (b < 2 ? 0xffffff : b > 4 ? 0xffe4ee : 0xfff6fa) });
}
// SQUISHYVÄGGEN: stommen, markisen, fackens bakstycken med prickar och hyllplanen
function paintSquishyWall(P) {
  const { x0, x1, top, base } = SQW;
  paintBanner(P, (x0 + x1) / 2, 9, $t('SQUISHY'), P_PINK);
  // två små dumplings på bandets sidor
  const dump = ['..ooo..', '.oWWWo.', 'oWwWwWo', 'oWWWWWo', 'oWkWkWo', 'oWWpWWo', '.ooooo.'];
  for (const dx of [-62, 56]) spr(P, (x0 + x1) / 2 + dx, 11, dump, { o: 0xb89a88, W: 0xfff6ea, w: 0xe8d4c0, k: INK, p: 0xf48cab });
  paintAwning(P, x0, x1, top - 8);
  const BACK = [P_PINK, P_MINT, P_BUTTER];
  const foots = SQW_F;
  for (let c = 0; c < 3; c++) {
    const yt = c === 0 ? top + 2 : foots[c - 1] + 3, yb = foots[c];
    const col = BACK[c];
    area(P, x0 + 3, yt, x1 - x0 - 6, yb - yt, (X, Y, i, j) => {
      let cc = col.base;
      const dx = (X - x0) % 8, dy = (Y - yt) % 8;
      if ((dx === 2 || dx === 3) && (dy === 2 || dy === 3)) cc = col.hi;                       // prickar
      else if (((dx === 6 || dx === 7) && (dy === 6 || dy === 7))) cc = mix(col.base, WHITE, 0.25);
      if (j < 3) cc = mul(cc, 0.8 + j * 0.06);                                                  // skugga under planet ovanför
      return jit(cc, X, Y, 343 + c, 0.04);
    });
    // lilla trappsteget längst bak (bakre raden står på det)
    area(P, x0 + 3, yb - 4, x1 - x0 - 6, 4, (X, Y, i, j) => (j === 0 ? 0xffffff : j === 1 ? P_WHITE.base : jit(P_WHITE.lo, X, Y, 346, 0.04)));
  }
  // hyllplanen: vitlackerade med rosa kant
  for (const f of foots) {
    rowsOf(P, x0 + 1, f, x1 - x0 - 2, [0xffffff, P_PINK.base, P_PINK.lo]);
    P.darken(x0 + 3, f + 3, x1 - x0 - 6, 1, 0.75);
  }
  // stolparna och topplisten
  for (const [px, flip] of [[x0, false], [x1 - 4, true]]) area(P, px, top - 1, 4, base - top + 1, (X, Y, i) => { const k = flip ? 3 - i : i; return jit([P_WHITE.hi, P_WHITE.base, P_WHITE.lo, P_WHITE.dk][k], X, Y, 347, 0.03); });
  P.rect(x0, base - 3, x1 - x0, 3, P_PINK.dk); P.hl(x0, base - 3, x1 - x0, P_PINK.lo);
}
// Väggen bakom kassan: perforerad tavla med nyckelringar, hylla med presentaskar
function paintPegboard(P) {
  const x0 = 298, x1 = 382, y0 = 22, y1 = 70;
  area(P, x0, y0, x1 - x0, y1 - y0, (X, Y, i, j) => {
    if (i === 0 || j === 0 || i === x1 - x0 - 1 || j === y1 - y0 - 1) return P_WOOD.dk;
    if (i === 1 || j === 1) return P_WOOD.hi;
    return (X % 4 === 1 && Y % 4 === 1) ? 0x9a7048 : jit(0xe4c496, X, Y, 350, 0.04);
  });
  P.darken(x1, y0 + 2, 2, y1 - y0, 0.8); P.darken(x0 + 2, y1, x1 - x0, 2, 0.8);
  // nyckelringar med mini-squishies på krokar
  const MINI = [0xfbf1e0, 0xf8c2d4, 0xd6c2f6, 0xfce290, 0xaee6d0, 0xb6def6];
  for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) {
    const hxp = x0 + 7 + k * 11 + (r & 1) * 5, hy = y0 + 5 + r * 20;
    if (hxp > x1 - 6) continue;
    P.hl(hxp, hy, 3, 0x8a8a96); P.px(hxp, hy + 1, 0x6a6a76);
    for (let n = 0; n < 2; n++) {
      const cx = hxp + 1 + n * 2 - 1, cy = hy + 5 + n * 1;
      P.px(cx + 1, cy - 2, 0xd8d8e0); P.px(cx, cy - 1, 0xd8d8e0);
      const c = MINI[(k + r * 3 + n) % MINI.length];
      disc(P, cx + 1, cy + 3, 3, 2.6, (X, Y, d) => (d > 0.78 ? mix(mul(c, 0.55), INK, 0.4) : Y < cy + 2 ? mix(c, WHITE, 0.4) : c));
      P.px(cx, cy + 3, INK); P.px(cx + 2, cy + 3, INK);
    }
    // kartongen bakom (blisterförpackning)
    P.rect(hxp - 2, hy + 2, 7, 1, 0xfff4f8);
  }
  // hyllan överst med presentaskar
  rowsOf(P, x0 - 2, y0 - 3, x1 - x0 + 4, [0xffffff, P_WHITE.lo, P_WHITE.dk]);
  let gx = x0;
  for (const [w, h, col, rib] of [[12, 8, P_PINK, 0xffffff], [9, 11, P_MINT, 0xf8505a], [14, 7, P_BUTTER, 0x6aa8e8], [10, 10, P_LILAC, 0xfff2a0], [12, 9, P_SKY, 0xf890b4], [11, 6, P_CORAL, 0xffffff]]) {
    if (gx + w > x1) break;
    area(P, gx, y0 - 3 - h, w, h, (X, Y, i, j) => (i === 0 || j === 0 || i === w - 1 ? col.dk : j === 1 ? col.hi : i === (w >> 1) || j === (h >> 1) ? rib : jit(col.base, X, Y, 351, 0.04)));
    P.px(gx + (w >> 1) - 1, y0 - 4 - h, rib); P.px(gx + (w >> 1) + 1, y0 - 4 - h, rib);
    gx += w + 2;
  }
}
// FIGURHYLLAN: vit lackad hylla med 4×2 upplysta fack, podier och skyltlister
function paintFigWall(P) {
  const { x0, x1, top, base } = FIG;
  // molnskylten KLÄMKOMPISARNA
  const M = textMask(BIG, $t('KLÄMKOMPISARNA')), cx = (x0 + x1) >> 1;
  for (const [ox, oy, rx, ry] of [[0, 0, 50, 8], [-40, 2, 12, 7], [40, 2, 12, 7], [-22, -3, 14, 7], [20, -3, 15, 7]])
    disc(P, cx + ox, 17 + oy, rx, ry, (X, Y, d) => (d > 0.9 ? 0xc8d4ec : Y < 14 ? 0xffffff : 0xf4f8fe));
  drawText(P, M, cx - (M.w >> 1), 13, { fill: (a, b) => [0xf890b4, 0xf49a4a, 0xe8c040, 0x6ac88a, 0x6aa8e8, 0x9a7ad8][Math.floor(a / 6) % 6], out: 0xffffff, out8: true });
  for (const [sx, sy] of [[x0 - 2, 12], [x1 - 6, 10]]) spr(P, sx, sy, ['..y..', '.yYy.', 'yYWYy', '.yYy.', '..y..'], { y: P_GOLD.lo, Y: P_GOLD.hi, W: WHITE });
  // stommen
  area(P, x0, top, x1 - x0, base - top, (X, Y, i, j) => jit(j === 0 ? 0xffffff : i === 0 ? P_WHITE.lo : i === x1 - x0 - 1 ? P_WHITE.dk : P_WHITE.base, X, Y, 360, 0.03));
  FIG_ROWS.forEach((R, r) => {
    for (let c = 0; c < 4; c++) {
      const fx0 = x0 + 3 + c * 33, fx1 = fx0 + 31, col = PASTELS[(c + r * 2) % 4 === 3 ? 4 : (c + r * 2) % 4];
      area(P, fx0, R.y0, fx1 - fx0, R.y1 - R.y0, (X, Y, i, j) => {
        const lx = Math.abs(i - 15) / 16, t = j / (R.y1 - R.y0);
        let cc = qmix(mix(col.hi, WHITE, 0.4), col.base, t * 0.9 + lx * 0.5, X, Y, 4);
        if (i < 2) cc = mul(cc, 0.86); if (j < 2) cc = mul(cc, 0.8);                 // skugga i facket
        return cc;
      });
      // lampslingan i taket på facket
      P.hl(fx0 + 4, R.y0, 23, 0xfffae0); P.hl(fx0 + 8, R.y0 + 1, 15, 0xfff4d0, 0.6);
      // podiet: rund pelare med guldkant
      const pcx = fx0 + 15.5, py = R.y1 - 4;
      disc(P, pcx, py, 10, 2.6, (X, Y, d) => (d > 0.82 ? P_GOLD.base : Y < py - 0.5 ? mix(col.hi, WHITE, 0.5) : col.hi));
      area(P, fx0 + 6, py, 20, 3, (X, Y, i, j) => (i === 0 || i === 19 ? null : j === 2 ? P_GOLD.lo : jit(i < 5 ? col.base : i > 14 ? col.lo : mix(col.base, col.hi, 0.4), X, Y, 361, 0.03)));
    }
    // skyltlisten under raden (namnen skrivs i scenen)
    rowsOf(P, x0 + 2, R.plate, x1 - x0 - 4, [0xffffff, P_WHITE.base, P_WHITE.base, P_WHITE.base, P_WHITE.base, P_WHITE.lo, P_WHITE.lo, P_WHITE.dk]);
  });
  for (let c = 1; c < 4; c++) { const dx = x0 + 1 + c * 33; P.vl(dx, top + 2, base - top - 5, P_WHITE.lo); P.vl(dx + 1, top + 2, base - top - 5, P_WHITE.hi); }
  rowsOf(P, x0, base - 3, x1 - x0, [P_MINT.lo, P_MINT.dk, 0x2a5a48]);
}
// LEKSAKSHYLLORNA: tre fack i ljust trä med skyltar och kartonger längst in
function paintToyShelves(P) {
  const { x0, x1, top, base } = TS;
  area(P, x0, top, x1 - x0, base - top, (X, Y, i, j) => jit(j === 0 ? P_WOOD.hi : P_WOOD.base, X, Y, 370, 0.05));
  BAYS.forEach((B, b) => {
    const col = [P_SKY, P_BUTTER, P_LILAC][b];
    // skylten
    area(P, B.x0 + 2, top + 1, B.x1 - B.x0 - 4, 7, (X, Y, i, j) => (j === 0 ? col.hi : j === 6 ? col.dk : jit(col.base, X, Y, 371, 0.03)));
    const M = textMask(SMALL, BAY_NAMES[b]);
    drawText(P, M, ((B.x0 + B.x1) >> 1) - (M.w >> 1), top + 2, { fill: INK });
    for (let c = 0; c < TS_F.length; c++) {
      const yt = c === 0 ? top + 8 : TS_F[c - 1] + 3, yb = TS_F[c];
      area(P, B.x0, yt, B.x1 - B.x0, yb - yt, (X, Y, i, j) => { let cc = (Y + X) % 7 === 0 ? mix(col.hi, P_WOOD.hi, 0.5) : mix(col.hi, P_WOOD.hi, 0.35); if (j < 3) cc = mul(cc, 0.8 + j * 0.06); return jit(cc, X, Y, 372 + c, 0.04); });
      // kartonger längst in (utfyllnad – de riktiga leksakerna står framför)
      let bx = B.x0 + 1;
      let n = 0;
      while (bx < B.x1 - 6) {
        const bw = 8 + Math.floor(hash(b * 9 + c, n, 373) * 10), bh = Math.min(yb - yt - 3, 10 + Math.floor(hash(b * 9 + c, n, 374) * 14));
        const bc = PASTELS[Math.floor(hash(b * 9 + c, n, 375) * PASTELS.length)], ww = Math.min(bw, B.x1 - 1 - bx);
        const by = yb - 4 - bh;
        area(P, bx, by, ww, bh, (X, Y, i, j) => {
          if (i === 0 || j === 0) return mix(bc.dk, INK, 0.2);
          if (j === 1) return bc.hi;
          if (i > 1 && i < ww - 2 && j > 2 && j < bh - 3 && (b === 2 || c === 1)) return j === 3 ? 0xffffff : mix(0xd8ecf8, bc.hi, 0.4); // fönster i kartongen
          return jit(i === ww - 1 ? bc.lo : bc.base, X, Y, 376, 0.04);
        });
        if (b === 0 && c !== 1) { P.hl(bx + 2, by + bh - 3, Math.max(1, ww - 4), 0xffffff); }
        bx += ww + 1; n++;
      }
      P.darken(B.x0, yb - 4, B.x1 - B.x0, 4, 0.82);
    }
  });
  for (const f of TS_F) { rowsOf(P, x0 + 1, f, x1 - x0 - 2, [P_WOOD.hi, P_WOOD.base, P_WOOD.lo]); P.darken(x0 + 3, f + 3, x1 - x0 - 6, 1, 0.75); }
  for (const px of [x0, BAYS[0].x1, BAYS[1].x1, x1 - 3]) area(P, px, top, 3 - (px === BAYS[0].x1 || px === BAYS[1].x1 ? 1 : 0), base - top, (X, Y, i) => jit([P_WOOD.hi, P_WOOD.base, P_WOOD.dk][i], X, Y, 377, 0.04));
  rowsOf(P, x0, base - 3, x1 - x0, [P_WOOD.lo, P_WOOD.dk, 0x4a3020]);
}
// Tågets bana: stadion (två raksträckor, två halvbågar) – s ∈ [0, L) → { x, y }
const TRK_LS = TRK.cxR - TRK.cxL, TRK_A = Math.PI * Math.sqrt((TRK.rx * TRK.rx + TRK.ry * TRK.ry) / 2), TRK_L = 2 * TRK_LS + 2 * TRK_A;
function trackAt(s) {
  s = ((s % TRK_L) + TRK_L) % TRK_L;
  const { cxL, cxR, cy, rx, ry } = TRK;
  if (s < TRK_LS) return { x: cxL + s, y: cy + ry };
  s -= TRK_LS;
  if (s < TRK_A) { const th = Math.PI / 2 - (s / TRK_A) * Math.PI; return { x: cxR + rx * Math.cos(th), y: cy + ry * Math.sin(th) }; }
  s -= TRK_A;
  if (s < TRK_LS) return { x: cxR - s, y: cy - ry };
  s -= TRK_LS;
  const th = -Math.PI / 2 - (s / TRK_A) * Math.PI;
  return { x: cxL + rx * Math.cos(th), y: cy + ry * Math.sin(th) };
}
// LEKMATTAN: tryckt lekmatta med gräs, damm, vägar och husrader; rälsen; bakre staketet
function paintMat(P) {
  const { x0, x1, y0, y1 } = MAT;
  area(P, x0, y0, x1 - x0, y1 - y0, (X, Y, i, j) => {
    const e = Math.min(i, j, x1 - x0 - 1 - i, y1 - y0 - 1 - j);
    if (e < 3) return e === 0 ? 0x3a6a9a : jit(0x6aa8e0, X, Y, 380, 0.05);
    let c = hash(X >> 1, Y, 385) > 0.7 ? 0x86cc76 : (X + Y * 3) % 7 === 0 ? 0x6cb862 : 0x7cc46e;
    if (hash(X, Y, 381) > 0.992) c = [0xffffff, 0xfff27a, 0xf8a8c4][Math.floor(hash(X, Y, 382) * 3)];
    return jit(c, X, Y, 383, 0.04);
  });
  // en tryckt väg runt kanten och en damm i mitten av slingan
  for (let x = x0 + 5; x < x1 - 5; x++) for (const yy of [y0 + 5, y1 - 8]) { P.rect(x, yy, 1, 3, 0x9a9aa4); if (x % 6 < 3) P.px(x, yy + 1, 0xf4f0e0); }
  disc(P, 660, 164, 16, 6, (X, Y, d) => (d > 0.82 ? 0x5a9ad0 : hash(X, Y, 384) > 0.9 ? 0xd8f0ff : 0x8ac4f0));
  // små tryckta hus inne i slingan
  for (const [hxp, col] of [[626, P_CORAL], [690, P_BUTTER]]) {
    area(P, hxp, 158, 9, 7, (X, Y, i, j) => (i === 0 || i === 8 || j === 6 ? mix(col.dk, INK, 0.3) : j === 3 && (i === 2 || i === 6) ? 0x5a7ab0 : col.base));
    for (let j = 0; j < 4; j++) P.hl(hxp - 1 + j, 157 - j, 11 - j * 2, j === 0 ? 0x8a2a2a : 0xc8404a);
  }
  // rälsen: syllar och två skenor längs banan
  for (let s = 0; s < TRK_L; s += 3.2) {
    const a = trackAt(s), b = trackAt(s + 0.5), dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n, ny = dx / n;
    for (let k = -3; k <= 3; k++) P.px(a.x + nx * k * 1.1, a.y + ny * k * 0.7, k === -3 || k === 3 ? 0x6a4424 : 0x8a5a34);
  }
  for (let s = 0; s < TRK_L; s += 0.4) {
    const a = trackAt(s), b = trackAt(s + 0.5), dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n, ny = dx / n;
    for (const k of [-2, 2]) P.px(a.x + nx * k * 1.1, a.y + ny * k * 0.7, k < 0 ? 0xd8dee8 : 0xa8b0bc);
  }
  // stationen vid övre raksträckan: perrong och tak med skylt
  const sx = 664, sy = TRK.cy - TRK.ry - 5;
  area(P, sx - 14, sy, 28, 3, (X, Y, i, j) => (j === 0 ? 0xf4ecdc : j === 1 ? 0xd8ccb4 : 0x8a7a64));
  for (const px of [sx - 11, sx + 10]) P.vl(px, sy - 9, 9, 0x8a5a34);
  for (let j = 0; j < 4; j++) P.hl(sx - 14 + j, sy - 12 + j, 28 - j * 2, j === 0 ? 0x8a2a3a : (j & 1) ? 0xe8505a : 0xfff4f0);
  P.rect(sx - 6, sy - 7, 12, 4, 0xfffaf0); P.box(sx - 6, sy - 7, 12, 4, 0x3a6a9a);
}
// Vimpelgirlanger i bågar under taket
function paintBunting(P) {
  const hooks = [4, 96, 196, 290, 392, 494, 596, 700, 764];
  let n = 0;
  for (let h = 0; h < hooks.length - 1; h++) {
    const a = hooks[h], b = hooks[h + 1], sag = 7;
    for (let x = a; x <= b; x++) { const u = (x - a) / (b - a), y = CEIL + 2 + Math.round(Math.sin(u * Math.PI) * sag); P.px(x, y, 0x8a6a7a); }
    for (let x = a + 5; x < b - 5; x += 9, n++) {
      const u = (x - a) / (b - a), y = CEIL + 3 + Math.round(Math.sin(u * Math.PI) * sag);
      const col = PASTELS[n % PASTELS.length];
      for (let j = 0; j < 6; j++) for (let i = -3 + (j >> 1); i <= 3 - (j >> 1); i++) P.px(x + i, y + j, j === 0 ? col.hi : i === 3 - (j >> 1) ? col.lo : col.base);
    }
  }
}
function paintSides(P) {
  for (const [x0, flip] of [[0, false], [W - 6, true]]) area(P, x0, 0, 6, H, (X, Y, i) => {
    const k = flip ? 5 - i : i;
    if (Y >= WALL_Y + (5 - k) * 2) return null;
    return jit(Y < CEIL ? 0x4a2e44 : Y < WAIN ? mul(0xfbdee8, 0.7 + k * 0.03) : Y < WALL_Y - 5 ? mul(P_MINT.base, 0.66 + k * 0.03) : 0xb8a8b0, X, Y, 391, 0.04);
  });
  P.box(0, 0, W, H, 0x1a1218);
}
function paintBg(night) {
  const P = new Pix(W, H);
  paintWall(P);
  paintFloor(P, night);
  paintBunting(P);
  paintOutside(P, night);
  paintDoorSurround(P);
  paintSquishyWall(P);
  paintPegboard(P);
  paintFigWall(P);
  paintToyShelves(P);
  paintMat(P);
  paintSides(P);
  return P.flush();
}

// ======================= möbler och föremål (egna bilder) =======================
// Glasdörren i bildrutor där den svänger in mot oss (samma grepp som kaféet)
function paintDoorFrames(N = 5) {
  const w = DOOR.x1 - DOOR.x0, h = WALL_Y - DOOR.top;
  const S = new Pix(w, h);
  area(S, 0, 0, w, h, (X, Y) => jit(P_MINT.base, X, Y, 392, 0.05));
  S.bevel(0, 0, w, h, P_MINT.hi, P_MINT.dk);
  S.erase(4, 4, w - 8, 32);
  for (let j = 0; j < 32; j++) for (let i = 0; i < w - 8; i++) { const X = 4 + i, Y = 4 + j, s = ((X * 2 - Y * 3) % 40 + 40) % 40; S.px(X, Y, 0xd8eef0, 0.1 + (s < 3 ? 0.22 : 0)); }
  S.box(3, 3, w - 6, 34, P_MINT.dk);
  S.hl(4, 4, w - 8, 0xffffff, 0.3);
  // hjärtat på glaset och sparkplåten
  spr(S, (w >> 1) - 3, 12, ['.pp.pp.', 'pPPpPPp', 'pPPPPPp', '.pPPPp.', '..pPp..', '...p...'], { p: 0xd84a78, P: 0xf890b4 });
  S.bevel(4, 40, w - 8, 10, P_MINT.hi, P_MINT.dk);
  area(S, 2, h - 6, w - 4, 4, (X, Y, i, j) => [P_GOLD.hi, P_GOLD.base, P_GOLD.base, P_GOLD.lo][j]);
  S.vl(w - 6, 24, 12, P_GOLD.base); S.vl(w - 5, 24, 12, P_GOLD.lo); S.px(w - 6, 24, P_GOLD.hi);
  const frames = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * 1.25, pw = Math.max(3, Math.round(w * Math.cos(th))), shade = 1 - 0.35 * Math.sin(th);
    const F = new Pix(w, h + 6);
    for (let c = 0; c < pw; c++) {
      const sc = Math.min(w - 1, Math.floor((c * w) / pw)), drop = Math.round((c / Math.max(1, pw - 1)) * Math.sin(th) * 5);
      for (let y = 0; y < h; y++) { const i = (y * w + sc) * 4, a = S.d[i + 3]; if (a) F.px(c, y + drop, mul((S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2], shade), a / 255); }
    }
    frames.push(F.flush());
  }
  return frames;
}
// Kassadisken: vit skiva, smörgul front med regnbågsvåg och butikens namn, saker på disken
function paintCounter() {
  const ox = CNT.x0 - 2, oy = 74, P = new Pix(CNT.x1 - CNT.x0 + 4, CNT.y - oy + 1, ox, oy);
  const x0 = CNT.x0, x1 = CNT.x1, w = x1 - x0;
  area(P, x0, CNT.top, w, CNT.face - CNT.top, (X, Y, i, j) => (j === 0 ? 0xffffff : j === CNT.face - CNT.top - 1 ? P_PINK.base : jit(j < 3 ? 0xfdf8f8 : 0xf4ecee, X, Y, 400, 0.03)));
  P.hl(x0, CNT.face, w, P_PINK.dk);
  area(P, x0, CNT.face + 1, w, CNT.y - CNT.face - 1, (X, Y, i, j) => {
    const yy = j - 3 - Math.round(Math.sin((i) / 7) * 1.5);
    if (yy >= 0 && yy < 3) return [0xf890b4, 0xfce290, 0x8ad8b4][yy];                              // vågen
    if (Y >= CNT.y - 3) return [P_BUTTER.lo, P_BUTTER.dk, 0x6a4a1a][Y - (CNT.y - 3)];
    return jit(i % 16 === 0 ? P_BUTTER.lo : i % 16 === 1 ? P_BUTTER.hi : P_BUTTER.base, X, Y, 401, 0.04);
  });
  // skylten med butikens namn
  const M = textMask(SMALL, $t('LEKSAKSLÅDAN')), sx = ((x0 + x1) >> 1) - (M.w >> 1) - 4;
  area(P, sx, CNT.face + 7, M.w + 8, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === M.w + 7 || j === 8 ? P_PINK.dk : 0xffffff));
  drawText(P, M, sx + 4, CNT.face + 9, { fill: (a) => [0xe8505a, 0xf49a4a, 0x4aa86a, 0x4a88d0, 0x8a5ad0][Math.floor(a / 4) % 5] });
  for (const hxp of [x0 + 8, x1 - 14]) spr(P, hxp, CNT.face + 8, ['.pp.pp.', 'pPPpPPp', 'pPPPPPp', '.pPPPp.', '..pPp..', '...p...'], { p: 0xd84a78, P: 0xf890b4 });
  P.vl(x0, CNT.top, CNT.y - CNT.top, P_PINK.dk); P.vl(x1 - 1, CNT.top, CNT.y - CNT.top, P_PINK.dk);
  // kassaapparaten (mint)
  const rx = 297;
  area(P, rx, 91, 22, 10, (X, Y, i, j) => (j === 0 || i === 0 ? P_MINT.hi : i === 21 || j === 9 ? P_MINT.dk : jit(P_MINT.base, X, Y, 402, 0.04)));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) P.px(rx + 3 + i * 3, 93 + j * 2, j === 0 && i === 4 ? 0xf8505a : 0xfffaf4);
  area(P, rx + 4, 84, 14, 7, (X, Y, i, j) => (j === 0 ? P_MINT.hi : i === 0 || i === 13 ? P_MINT.dk : 0x2a3a3a));
  P.rect(rx + 6, 86, 10, 3, 0x7ae0a0); text(P, SMALL, '39', rx + 9, 86, 0x1a4a2a);
  area(P, rx - 1, 99, 24, 2, (X, Y, i, j) => (j === 0 ? P_MINT.lo : P_MINT.dk));
  // kortterminalen
  P.rect(rx + 24, 94, 6, 7, 0x3a3a44); P.rect(rx + 25, 95, 4, 2, 0x8ae0c0); P.hl(rx + 25, 98, 4, 0x6a6a76);
  // klubbburken
  const jx = 353;
  area(P, jx, 90, 10, 11, (X, Y, i, j) => (i === 0 || i === 9 ? 0xc8dce8 : j === 0 ? 0xa8b8c4 : j < 2 ? 0xf4fafe : j === 10 ? 0xb8ccd8 : jit(0xe8f4fa, X, Y, 403, 0.03)));
  for (const [lx, c1, c2] of [[jx + 2, 0xf890b4, 0xffffff], [jx + 5, 0x8ad8b4, 0xfff27a], [jx + 7, 0xfce290, 0xf8505a]]) {
    P.vl(lx, 82, 8, 0xfffaf4);
    disc(P, lx + 0.5, 80.5, 2.6, 2.6, (X, Y, d) => (((X + Y) & 1) ? c1 : c2));
  }
  // presentpappersrullen på ett stativ, pappret hänger över kanten
  const gx = 365;
  P.vl(gx, 88, 12, 0x8a8a96); P.vl(gx + 20, 88, 12, 0x8a8a96);
  area(P, gx + 1, 88, 19, 5, (X, Y, i, j) => (j === 0 ? 0xffd8e6 : j === 4 ? 0xc85a82 : ((i + j) % 4 === 0 ? 0xffffff : 0xf890b4)));
  area(P, gx + 3, 93, 15, CNT.face + 5 - 93, (X, Y, i, j) => (Y < CNT.top ? null : ((i + Math.floor(j / 2)) % 4 === 0 ? 0xffffff : (i + j) % 7 === 0 ? 0xfff27a : 0xf890b4)));
  // en liten korg med mini-squishies och en ringklocka
  area(P, 340, 97, 9, 4, (X, Y, i, j) => (j === 0 ? 0xd8a860 : (X + Y) & 1 ? 0xa8783a : 0xc89050));
  for (const [bx, c] of [[341, 0xf8c2d4], [344, 0xfce290], [346, 0xaee6d0]]) { P.rect(bx, 95, 2, 2, c); P.px(bx, 95, WHITE); }
  disc(P, 332, 97.5, 3, 2.6, (X, Y, d) => (Y < 97 ? P_GOLD.hi : P_GOLD.base)); P.hl(329, 99, 7, P_GOLD.lo); P.px(332, 94, P_GOLD.dk);
  outline(P, INK, 0.35);
  return { img: P.flush(), ox, oy };
}
// Klämbordet: rosa prickig duk, veckad framsida, spetskant och små spetsdukar
function paintTable() {
  const ox = TABLE.x0 - 2, oy = TABLE.top - 1, P = new Pix(TABLE.x1 - TABLE.x0 + 4, TABLE.y - oy + 4, ox, oy);
  const x0 = TABLE.x0, x1 = TABLE.x1, w = x1 - x0;
  area(P, x0, TABLE.top, w, TABLE.front - TABLE.top, (X, Y, i, j) => {
    if ((i === 0 || i === w - 1) && j === 0) return null;
    let c = j === 0 ? P_PINK.hi : P_PINK.base;
    if (((X >> 2) + (Y >> 1)) % 3 === 0 && X % 4 === 1 && (Y & 1) === 0) c = 0xfff6fa;          // prickar
    if (j === TABLE.front - TABLE.top - 1) c = mix(c, WHITE, 0.4);
    return jit(c, X, Y, 410, 0.04);
  });
  area(P, x0, TABLE.front, w, TABLE.y - TABLE.front - 2, (X, Y, i, j) => {
    const f = i % 12;
    let c = f < 2 ? P_PINK.hi : f > 9 ? P_PINK.lo : P_PINK.base;
    if (((X >> 2) + (Y >> 1)) % 3 === 0 && X % 4 === 1 && (Y & 1) === 0) c = mix(c, WHITE, 0.6);
    if (j === 0) c = P_PINK.lo;
    return jit(c, X, Y, 411, 0.04);
  });
  // spetskanten: vita bågar med hål
  for (let x = x0; x < x1; x++) {
    const k = (x - x0) % 6, d = Math.abs(k - 2.5);
    const len = d < 1.5 ? 4 : d < 2.5 ? 3 : 2;
    for (let j = 0; j < len; j++) P.px(x, TABLE.y - 3 + j, j === len - 1 ? 0xd8c8cc : (k === 2 || k === 3) && j === 1 ? P_PINK.base : 0xffffff);
  }
  // spetsdukarna under squishiesarna
  // ett litet bordskort: KLÄM MJUKT!
  const M = textMask(SMALL, $t('KLÄM MJUKT'));
  const cx = x0 + 6;
  outline(P, INK, 0.35);
  return { img: P.flush(), ox, oy, card: M, cardX: cx };
}
// Spetsduken under en squishy på klämbordet
function paintDoily(w) {
  const rx = Math.max(7, (w >> 1) + 2), P = new Pix(rx * 2 + 3, 8, -rx - 1, -4);
  disc(P, 0, 0, rx, 2.9, (X, Y, d) => (d > 0.84 ? (((X + Y) & 1) ? 0xffffff : null) : d > 0.6 && ((X + Y) % 3 === 0) ? 0xf4e6ea : 0xffffff));
  return { img: P.flush(), ox: rx + 1, oy: 4 };
}
// Pyramidbordet: rött lackbord med guldkant och molnslingor på kjolen
function paintRoundTable() {
  const ox = PYR.x - 46, oy = PYR.y - 12, P = new Pix(92, 32, ox, oy);
  const cx = PYR.x, cy = PYR.y;
  for (const lx of [cx - 34, cx + 32]) { P.rect(lx, cy + 8, 3, 9, P_RED.dk); P.hl(lx - 1, cy + 16, 5, P_RED.dk); }
  area(P, cx - 42, cy, 84, 9, (X, Y, i, j) => {
    const e = Math.abs(i - 41.5) / 42, bot = Math.round(Math.sqrt(Math.max(0, 1 - e * e)) * 3);
    if (j > 5 + bot) return null;
    if (j === 0) return P_GOLD.base;
    let c = jit(i < 10 ? P_RED.hi : i > 72 ? P_RED.lo : P_RED.base, X, Y, 420, 0.04);
    const u = (i % 14), v = j - 3;
    if (Math.abs(v) <= 1 && (u === 5 || u === 6 || u === 8) || (v === -1 && u === 7) || (v === 1 && u === 7)) c = P_GOLD.base;       // molnslingor
    if (j === 5 + bot) c = P_GOLD.lo;
    return c;
  });
  disc(P, cx, cy, 42, 8.5, (X, Y, d) => (d > 0.93 ? P_GOLD.hi : d > 0.86 ? P_GOLD.base : jit(Y < cy - 3 ? mix(P_RED.base, P_RED.hi, 0.4) : P_RED.base, X, Y, 421, 0.05)));
  P.ell(cx - 14, cy - 3, 12, 2, 0xffffff, 0.25, 2);
  outline(P, INK, 0.3);
  return { img: P.flush(), ox, oy };
}
// Ångkorgen i tre delar: bakre halvan (insidan + bakre kanten), främre bandet, locket
const BK = { rx: 12, ry: 3, hb: 8 };
function paintBasketBack() {
  const P = new Pix(26, 20, -13, -18);
  disc(P, 0, -11, 12, 3.2, (X, Y, d) => (d > 0.72 ? (Y < -11 ? 0xe8c888 : null) : Y < -11 ? 0x6a4a28 : 0x8a6232));
  for (let x = -9; x <= 9; x += 3) P.px(x, -11, 0x5a3a1c);
  return { img: P.flush(), ox: 13, oy: 18 };
}
function paintBasketFront() {
  const P = new Pix(26, 20, -13, -18);
  for (let x = -12; x <= 12; x++) {
    const e = Math.sqrt(Math.max(0, 1 - (x / 12.5) ** 2));
    const top = Math.round(-11 + e * 3), bot = Math.round(-3 + e * 3);
    for (let y = top; y <= bot; y++) {
      let c = ((x + 13) >> 1) & 1 ? 0xd8b070 : 0xc8a060;
      if (y === top) c = 0xf4dca0;
      else if (y === top + 1) c = 0xe0bc7c;
      else if (y === top + 4) c = 0x9a7038;                        // bindningen
      else if (y === bot) c = 0x8a6030;
      if (x <= -11) c = mix(c, WHITE, 0.2); else if (x >= 11) c = mul(c, 0.8);
      P.px(x, y, c);
    }
  }
  outline(P, 0x4a2a14, 0.3);
  return { img: P.flush(), ox: 13, oy: 18 };
}
function paintLid(tilt) {
  const P = new Pix(28, 22, -14, -24);
  for (let x = -12; x <= 12; x++) {
    const e = Math.sqrt(Math.max(0, 1 - (x / 12.5) ** 2)), sh = tilt ? Math.round(x * 0.16) : 0;
    const top = Math.round(-11 - 3 * e - 5 * e) - sh, bot = Math.round(-11 + 3 * e) - sh;
    for (let y = top; y <= bot; y++) {
      let c = ((y - top) % 3 === 0) ? 0xc8a060 : 0xe0bc7c;
      if (y === top) c = 0xf6e0a8;
      if (y === bot) c = 0x9a7038;
      if (x < -9) c = mix(c, WHITE, 0.18); else if (x > 9) c = mul(c, 0.82);
      P.px(x, y, c);
    }
  }
  P.rect(-2, -21, 4, 2, 0x9a7038); P.hl(-2, -21, 4, 0xf4dca0);                     // knoppen
  outline(P, 0x4a2a14, 0.3);
  return { img: P.flush(), ox: 14, oy: 24 };
}
// Locket till toys.js-korgen (samma geometri och toner som paintKorg i js/data/toys.js),
// eget så att det kan lyftas och tippas medan korgen står öppen. tilt = skjuts hela pixlar.
function paintKorgLid(tilt) {
  const u = 1, Wk = 24, half = 12, ry = Math.max(2, Math.round(Wk * 0.13)), bodyH = Math.round(Wk * 0.3), lh = Math.round(Wk * 0.22);
  const rimY = -2 - bodyH + 1;
  const B = [0xf8dea0, 0xeac47e, 0xd6a85e, 0xa8763a, 0x7a4e24];
  const pickB = (L, x, y) => { const v = L + (hash(x, y, 470) - 0.5) * 0.1; return v > 0.8 ? B[0] : v > 0.62 ? B[1] : v > 0.44 ? B[2] : v > 0.26 ? B[3] : B[4]; };
  const S = new Pix(30, 24, -15, -22);
  for (let x = -half - u; x < half + u; x++) {
    const nx = (x + 0.5) / (half + u), sq = Math.sqrt(Math.max(0, 1 - nx * nx));
    const yb = Math.floor(rimY + (ry + 0.5) * sq);
    const yt = Math.floor(rimY - ry - lh * Math.pow(Math.max(0, 1 - nx * nx), 0.7) + ry * (1 - sq));
    for (let y = yt; y <= yb; y++) {
      const v = (y - yt) / Math.max(1, yb - yt), L = 0.72 - 0.34 * nx - 0.2 * v;
      let col = pickB(L, x, y);
      if (Math.abs(v * 5 - Math.round(v * 5)) < 0.18) col = mix(col, B[4], 0.3);
      if ((Math.floor((Math.atan2(nx, 1 - v) + 3) * 6) & 1) && v > 0.2 && v < 0.8) col = mix(col, B[3], 0.2);
      if (y >= yb - u) col = pickB(L - 0.12, x, y);
      S.px(x, y, col);
    }
  }
  const ky = Math.floor(rimY - ry - lh) - u;
  spr(S, -2, ky - 2, ['.hh.', 'h..h', 'hhhh'], { h: B[3] });
  const P = new Pix(30, 24, -15, -22);
  for (let y = -22; y < 2; y++) for (let x = -15; x < 15; x++) {
    const i = ((y + 22) * 30 + (x + 15)) * 4, a = S.d[i + 3];
    if (a) P.px(x, y - (tilt ? Math.round((x + 12) * 0.14) : 0), (S.d[i] << 16) | (S.d[i + 1] << 8) | S.d[i + 2], a / 255);
  }
  outline(P, 0x2e1a2c, 0.3);
  return { img: P.flush(), ox: 15, oy: 22 };
}
// Trådkorgen full av bollar
function paintBallBasket() {
  const P = new Pix(40, 34, -20, -32);
  const BC = [[0xe8404a, 0xffffff], [0x4a88e0, 0xfff27a], [0xffd23a, 0xe8404a], [0x6ac88a, 0xffffff], [0xf890b4, 0xffffff], [0xb89ae8, 0xfff4b0], [0xf49a4a, 0x4a88e0]];
  const balls = [[-11, -14, 4], [-3, -15, 4], [5, -14, 4], [12, -13, 4], [-7, -19, 4], [2, -20, 4], [9, -19, 3], [-2, -24, 4], [-12, -19, 3]];
  balls.forEach(([bx, by, r], i) => {
    const [c1, c2] = BC[i % BC.length];
    disc(P, bx, by, r, r, (X, Y, d) => {
      const dx = X + 0.5 - bx, dy = Y + 0.5 - by;
      let c = (i % 3 === 0 && Math.abs(dy) < 1) ? c2 : c1;
      if (dx + dy < -r * 0.7) c = mix(c, WHITE, 0.45); else if (dx + dy > r * 0.6) c = mul(c, 0.78);
      if (d > 0.86) c = mul(c, 0.7);
      return c;
    });
    P.px(bx - Math.round(r * 0.5), by - Math.round(r * 0.5), WHITE);
  });
  // korgen: vit tråd i rutmönster, rund överkant
  for (let x = -16; x <= 16; x++) {
    const e = Math.sqrt(Math.max(0, 1 - (x / 16.5) ** 2)), top = Math.round(-14 + e * 3), bot = Math.round(-2 + e * 2);
    for (let y = top; y <= bot; y++) {
      const wire = (x + 40) % 4 === 0 || (y + 40) % 4 === 0;
      if (y === top || y === top + 1) P.px(x, y, y === top ? 0xffffff : 0xd8d0e0);
      else if (wire) P.px(x, y, x > 10 ? 0xb8b0c8 : 0xf4f0f8);
    }
  }
  P.px(-17, -12, 0xd8d0e0); P.px(17, -12, 0xd8d0e0);
  outline(P, INK, 0.35);
  return { img: P.flush(), ox: 20, oy: 32 };
}
// Presentstapeln: tre inslagna paket med rosett
function paintGiftStack() {
  const P = new Pix(30, 34, -15, -32);
  const box = (x, y, w, h, col, rib) => {
    area(P, x, y, w, h, (X, Y, i, j) => (i === (w >> 1) || j === (h >> 1) ? rib : j === 0 ? col.hi : i === w - 1 ? col.lo : jit(col.base, X, Y, 480, 0.04)));
    spr(P, x + (w >> 1) - 3, y - 3, ['rr.rr', '.rrr.', '..r..'].map((r) => r + '..'), { r: rib });
  };
  box(-13, -12, 16, 12, P_PINK, 0xffffff);
  box(3, -10, 10, 10, P_SKY, 0xfff27a);
  box(-9, -23, 13, 11, P_MINT, 0xf8505a);
  box(-4, -31, 8, 8, P_BUTTER, 0xb89ae8);
  outline(P, INK, 0.3);
  return { img: P.flush(), ox: 15, oy: 32 };
}
// Krukväxt (palm) i en rosa kruka
function paintPalm() {
  const P = new Pix(30, 50, -15, -48);
  for (const [ex, ey] of [[-12, -10], [-9, -19], [-3, -24], [4, -23], [10, -17], [13, -8], [-13, -2], [8, -11], [-5, -13]]) {
    for (let k = 1; k <= 16; k++) {
      const u = k / 16, x = ex * u, y = -18 + ey * u + u * u * 5;
      P.px(x, y, 0x3f8a3a);
      if (k > 3 && k % 2 === 0) { P.px(x + (ex > 0 ? 1 : -1), y + 1, 0x6ab04a); P.px(x, y + 2, 0x2e6a2a); }
    }
  }
  P.vl(0, -19, 6, 0x6a4424); P.vl(-1, -18, 4, 0x8a5a34);
  area(P, -7, -14, 14, 14, (X, Y, i, j) => (j === 0 ? P_PINK.hi : j === 1 ? P_PINK.dk : j === 13 ? P_PINK.dk : jit(i < 3 ? P_PINK.hi : i > 10 ? P_PINK.lo : P_PINK.base, X, Y, 481, 0.05)));
  for (let i = 0; i < 3; i++) P.px(-3 + i * 3, -7, 0xffffff);
  outline(P, INK, 0.3);
  return { img: P.flush(), ox: 15, oy: 48 };
}
// Plyschlådan: ljusa brädor, bakkant och framsida (högen ritas emellan)
function paintCrate(front) {
  const { x0, x1, top, y } = CRATE, w = x1 - x0;
  const P = new Pix(w + 4, y - top + 12, x0 - 2, top - 10);
  if (!front) {
    area(P, x0 + 2, top - 6, w - 4, 7, (X, Y, i, j) => (j === 0 ? P_WOOD.hi : jit(mul(P_WOOD.base, 0.72), X, Y, 430, 0.05)));
  } else {
    area(P, x0, top, w, y - top, (X, Y, i, j) => {
      const slat = Math.floor(j / 8), k = j % 8;
      if (k === 7) return P_WOOD.dk;
      let c = hash(slat, 1, 431) > 0.5 ? P_WOOD.base : mix(P_WOOD.base, P_WOOD.hi, 0.4);
      if (k === 0) c = P_WOOD.hi;
      if (i < 3 || i > w - 4) c = mul(P_WOOD.lo, i < 3 ? 1.05 : 0.9);
      return jit(c, X, Y, 432, 0.05);
    });
    // skylten KRAMA MIG!
    const M = textMask(SMALL, $t('KRAMA MIG!')), sx = ((x0 + x1) >> 1) - (M.w >> 1) - 3;
    area(P, sx, top + 10, M.w + 6, 9, (X, Y, i, j) => (i === 0 || j === 0 || i === M.w + 5 || j === 8 ? P_PINK.dk : j === 1 ? 0xffffff : P_PINK.hi));
    drawText(P, M, sx + 3, top + 12, { fill: 0xc8406a });
    for (const hxp of [x0 + 5, x1 - 12]) spr(P, hxp, top + 12, ['.pp.pp.', 'pPPpPPp', '.pPPPp.', '..pPp..', '...p...'], { p: 0xd84a78, P: 0xf890b4 });
    for (const nx of [x0 + 3, x1 - 4]) for (let ny = top + 3; ny < y - 2; ny += 8) P.px(nx, ny, 0x6a5a4a);
  }
  outline(P, INK, 0.3);
  return { img: P.flush(), ox: x0 - 2, oy: top - 10 };
}
// Kapselautomaten: röd fot med myntinkast och vred, glaskula full av kapslar
function paintCapsule(shake) {
  const P = new Pix(24, 44, -12, -42);
  area(P, -9, -18, 18, 18, (X, Y, i, j) => (j === 0 ? P_RED.hi : i === 0 ? P_RED.hi : i === 17 ? P_RED.dk : j === 17 ? P_RED.dk : jit(P_RED.base, X, Y, 440, 0.04)));
  disc(P, -3.5, -11.5, 3, 3, (X, Y, d) => (d > 0.7 ? 0xc8c8d0 : 0xf4f4f8)); P.hl(-6, -12, 6, 0x8a8a96);
  area(P, 2, -14, 5, 3, (X, Y, i, j) => (j === 1 && i > 0 && i < 4 ? INK : 0xd8d8e0));
  text(P, SMALL, '10', 2, -9, 0xfff2a0);
  area(P, -3, -5, 7, 4, (X, Y, i, j) => (j === 0 ? 0x2a1a1e : 0x4a3a40));
  rowsOf(P, -10, -20, 20, [P_RED.dk, P_GOLD.hi, P_GOLD.base]);
  // glaskulan med kapslar
  const CAP = [0xf8505a, 0x6aa8e8, 0xfce290, 0x8ad8b4, 0xf890b4, 0xb89ae8];
  disc(P, 0, -30, 10, 10, (X, Y, d) => (d > 0.9 ? 0xb8d0dc : null));
  for (let n = 0; n < 16; n++) {
    const a = hash(n, 1, 441) * Math.PI * 2, r = Math.sqrt(hash(n, 2, 441)) * 6.5;
    const px = Math.round(Math.cos(a) * r + (shake ? (n & 1 ? 1 : -1) : 0)), py = Math.round(-26 + Math.abs(Math.sin(a)) * 2 - Math.sqrt(hash(n, 3, 441)) * 9 + (shake ? (n % 3) - 1 : 0));
    const c = CAP[n % CAP.length];
    P.rect(px - 1, py - 1, 3, 3, c); P.hl(px - 1, py - 1, 3, WHITE); P.px(px + 1, py + 1, mul(c, 0.7));
  }
  disc(P, 0, -30, 10, 10, (X, Y, d) => (d > 0.9 ? null : ((X - Y) % 9 === 0 && Y < -30) ? 0xffffff : null));
  P.ell(-4, -35, 3, 2, WHITE, 0.6, 2);
  rowsOf(P, -5, -41, 10, [P_RED.hi, P_RED.base]);
  outline(P, INK, 0.3);
  return { img: P.flush(), ox: 12, oy: 42 };
}
// Jättegiraffen (gosedjur) som står vid väggen
function paintGiraffe() {
  const P = new Pix(22, 80, -11, -78);
  const Y1 = 0xf8d070, Y2 = 0xe8b050, SP = 0xc8783a;
  for (const lx of [-6, -3, 2, 5]) { P.rect(lx, -14, 2, 14, lx < 0 ? Y1 : Y2); P.rect(lx, -2, 2, 2, 0x8a5a2a); }
  disc(P, 0, -18, 9, 6, (X, Y, d) => ((hash(X >> 2, Y >> 2, 450) > 0.55 && d < 0.8) ? SP : Y < -20 ? mix(Y1, WHITE, 0.3) : Y1));
  P.px(9, -21, 0x8a5a2a); P.px(10, -20, 0x8a5a2a); P.px(10, -19, 0x3a2a1a);
  for (let j = 0; j < 44; j++) { const nx = Math.round(-2 + j * 0.05); P.rect(nx - 2, -22 - j, 5, 1, ((j >> 2) & 1) && j % 4 === 1 ? SP : j % 7 === 3 ? SP : Y1); P.px(nx + 2, -22 - j, Y2); P.px(nx - 3, -22 - j, 0xf4a848, 0.9); }
  disc(P, -1, -69, 6, 4.4, (X, Y, d) => (Y > -67 && X > -2 ? 0xf8e0a8 : Y1));
  for (const ex of [-5, 3]) { P.vl(ex, -76, 4, 0x8a5a2a); P.rect(ex - 1, -77, 3, 2, 0x5a3a1a); }
  P.px(-4, -70, INK); P.px(1, -70, INK); P.px(-2, -66, INK); P.px(0, -66, INK);
  P.px(-6, -68, 0xf48cab); P.px(3, -68, 0xf48cab);
  outline(P, INK, 0.3);
  return { img: P.flush(), ox: 11, oy: 78 };
}
// Gunghästen i tre lägen (kolumnerna skjuts hela pixlar – ingen rotation)
function paintHorse() {
  const base = new Pix(32, 30, -16, -28);
  const Wd = 0xf6f0ea, Wl = 0xdcd2cc, MN = 0xf890b4, SAD = 0x6aa8e8;
  for (let x = -13; x <= 13; x++) { const y = Math.round(-1 - (x * x) / 70); base.px(x, y, P_RED.base); base.px(x, y + 1, P_RED.dk); }
  for (const lx of [-8, -5, 4, 7]) base.rect(lx, -9, 2, 7, lx < 0 ? Wl : Wd);
  disc(base, 0, -11, 10, 4, (X, Y) => (Y < -13 ? 0xffffff : Wd));
  area(base, -3, -16, 7, 4, (X, Y, i, j) => (j === 0 ? mix(SAD, WHITE, 0.4) : SAD));
  for (let j = 0; j < 9; j++) base.rect(6 + (j >> 2), -13 - j, 4, 1, Wd);
  disc(base, 11, -22, 4.5, 3, (X, Y) => Wd); base.px(14, -21, INK); base.px(15, -20, Wl);
  for (let j = 0; j < 10; j++) base.px(6 + (j >> 2), -14 - j, MN);
  for (let j = 0; j < 6; j++) base.px(-10 - (j >> 1), -12 + j, MN);
  base.px(10, -23, INK); base.px(9, -26, Wl); base.px(9, -25, Wd);
  outline(base, INK, 0.3);
  const frames = [];
  for (const k of [0, 0.1, -0.1]) {
    const F = new Pix(32, 32, -16, -30);
    for (let y = -28; y < 2; y++) for (let x = -16; x < 16; x++) {
      const i = ((y + 28) * 32 + (x + 16)) * 4, a = base.d[i + 3];
      if (!a) continue;
      F.px(x, y + Math.round(x * k), (base.d[i] << 16) | (base.d[i + 1] << 8) | base.d[i + 2], a / 255);
    }
    frames.push(F.flush());
  }
  return { frames, ox: 16, oy: 30 };
}
// Ballonger (hjärta, rund, stjärna) och luftballongslampor under taket
function paintBalloon(kind, col) {
  const P = new Pix(14, 14, -7, -12);
  if (kind === 'heart') spr(P, -6, -11, ['.oo...oo.', 'oPPo.oPPo', 'oPWPoPPPo', 'oPPPPPPPo', '.oPPPPPo.', '..oPPPo..', '...oPo...', '....o....'].map((r) => r + '...'), { o: col.dk, P: col.base, W: WHITE });
  else if (kind === 'star') spr(P, -6, -11, ['....o....', '...oPo...', 'oooPPPooo', 'oPPWPPPPo', '.oPPPPPo.', '..oPPPo..', '.oPPoPPo.', '.oo...oo.'], { o: col.dk, P: col.base, W: WHITE });
  else disc(P, 0, -6, 5, 6, (X, Y, d) => (d > 0.85 ? col.dk : X < -1 && Y < -8 ? WHITE : Y > -3 ? col.lo : col.base));
  P.px(0, 0, col.dk); P.px(-1, 1, col.dk); P.px(1, 1, col.dk);
  return { img: P.flush(), ox: 7, oy: 12 };
}
function paintLampBalloon(col) {
  const P = new Pix(16, 22, -8, -20);
  disc(P, 0, -13, 7, 7, (X, Y, d) => { if (d > 0.88) return col.dk; const s = Math.floor((X + 7) / 3) & 1; return Y < -16 ? mix(s ? col.base : 0xffffff, WHITE, 0.3) : s ? col.base : 0xfffaf6; });
  for (let j = 0; j < 3; j++) P.hl(-4 + j, -6 + j, 9 - j * 2, col.lo);
  P.line(-3, -4, -2, -1, 0x8a6a4a); P.line(3, -4, 2, -1, 0x8a6a4a);
  area(P, -3, -1, 7, 3, (X, Y, i, j) => (j === 0 ? 0xd8a860 : (X + Y) & 1 ? 0xa8783a : 0xc89050));
  P.hl(-2, 2, 5, 0xfff4c8);
  return { img: P.flush(), ox: 8, oy: 20 };
}
// Molnskylten TESTA MIG! som hänger över klämbordet
function paintSign() {
  const M = textMask(BIG, $t('TESTA MIG!')), w = M.w + 26;
  const P = new Pix(w, 26, -(w >> 1), -13);
  for (const [ox, oy, rx, ry] of [[0, 0, (w >> 1) - 3, 9], [-(w >> 1) + 8, 2, 8, 7], [(w >> 1) - 8, 2, 8, 7], [-14, -5, 12, 7], [12, -5, 13, 7]])
    disc(P, ox, oy, rx, ry, (X, Y, d) => (Y < -5 ? 0xffffff : d > 0.8 ? 0xeaf2fc : 0xfdfdff));
  drawText(P, M, -(M.w >> 1), -3, { fill: (a, b) => (b < 3 ? 0xf8709a : 0xe8507e), out: 0xffffff, out8: true, shadow: 0xc8d4ec, sa: 1 });
  spr(P, (M.w >> 1) + 4, -6, ['.pp.pp.', 'pPPpPPp', '.pPPPp.', '..pPp..', '...p...'], { p: 0xd84a78, P: 0xf890b4 });
  outline(P, 0x6a5a8a, 0.4);
  return { img: P.flush(), ox: w >> 1, oy: 13, w };
}
// Tåget: lok och två vagnar i fyra vyer (höger/vänster från sidan, bakifrån, framifrån)
const TP = { R: 0xe8404a, r: 0xa8202e, B: 0x4a88e0, b: 0x2a5aa8, Y: 0xffd23a, y: 0xc89a1a, k: 0x2a1a24, g: 0x8a8a96, w: 0xbfe6fa, W: 0xffffff, S: 0x7ac87a, s: 0x3a8a4a, P: 0xf890b4, p: 0xc8507a, T: 0xc89060, t: 0x8a5a2a, o: 0xf49a4a, m: 0x8ad8b4, l: 0xb89ae8 };
const TRAIN_MAPS = {
  loco: {
    side: ['............kk..', '.RRRRR......kk..', 'RRRRRRR....kkkk.', '.RwwwR.BBBBBBBB.', '.RwwwR.BbbbbbbBY', '.RRRRRBBBBBBBBBY', '.RrrrrBbbbbbbbb.', 'YYYYYYYYYYYYYYYY', '.kgk..kgk..kgk..', '..k....k....k...'],
    back: ['...kk....', '.RRRRRRR.', 'RRRRRRRRR', 'RwwRRRwwR', 'RwwRRRwwR', 'RRRRRRRRR', 'RrrrrrrrR', 'YYYYYYYYY', 'kgk...kgk', '.k.....k.'],
    front: ['...kkk...', '...kkk...', '..BBBBB..', '.BBBBBBB.', '.BBBYBBB.', '.BBBBBBB.', 'RRbbbbbRR', 'YYYYYYYYY', 'kYkYkYkYk', 'kk.....kk'],
  },
  wag1: {
    side: ['.RR.BB.YY...', '.RR.BB.YY.SS', 'PPPPPPPPPPPP', 'PpppppppppPP', 'PPPPPPPPPPPP', 'YYYYYYYYYYYY', '.kgk....kgk.', '..k......k..'],
    back: ['.RR.YY.', '.RR.YY.', 'PPPPPPP', 'PpppppP', 'PPPPPPP', 'YYYYYYY', 'kg...gk', '.k...k.'],
  },
  wag2: {
    side: ['...tt.tt....', '...tTTTt....', '...TkTkT....', 'mmmmmmmmmmmm', 'mWWmWWmWWmWm', 'mmmmmmmmmmmm', 'YYYYYYYYYYYY', '.kgk....kgk.', '..k......k..'],
    back: ['.tt.tt.', '.tTTTt.', 'mmmmmmm', 'mWWmWWm', 'mmmmmmm', 'YYYYYYY', 'kg...gk', '.k...k.'],
  },
};
function paintTrain() {
  const out = {};
  for (const [name, views] of Object.entries(TRAIN_MAPS)) {
    out[name] = {};
    for (const [v, rows] of Object.entries(views)) {
      const w = rows[0].length, h = rows.length;
      const mk = (mirror) => {
        const P = new Pix(w + 2, h + 2, -1, -1);
        spr(P, 0, 0, mirror ? rows.map((r) => [...r].reverse().join('')) : rows, TP);
        outline(P, INK, 0.3);
        return { img: P.flush(), ox: ((w + 2) >> 1), oy: h + 1 };
      };
      if (v === 'side') { out[name].right = mk(false); out[name].left = mk(true); }
      else if (v === 'back') { out[name].up = mk(false); if (!views.front) out[name].down = mk(false); }
      else out[name].down = mk(false);
    }
  }
  return out;
}
// Tunnelberget över vänstra kurvan (grönt, stenar, en liten gran och portalerna)
function paintHill() {
  const cx = TRK.cxL - 12, cy = TRK.cy + 1, rx = 38, ry = 31, H0 = 24, xr = TRK.cxL + 6;   // xr = stenmuren med portalerna
  const x0 = cx - rx - 1, y0 = cy - ry - H0 - 14;
  const P = new Pix(xr - x0 + 3, cy + ry - y0 + 3, x0, y0);
  const hAt = (x, y) => { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); return d >= 1 ? -1 : H0 * Math.pow(1 - d * d, 0.62) + Math.sin(x * 0.35 + y * 0.2) * 1.2 * (1 - d); };
  const G = [0x3e8a44, 0x55a452, 0x6cbc5e, 0x86d070, 0xa8e488];
  for (let x = x0; x <= xr; x++) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      const h = hAt(x + 0.5, y + 0.5);
      if (h < 0) continue;
      const s = Math.round(y - h);
      const dx = hAt(x + 1.5, y + 0.5) - hAt(x - 0.5, y + 0.5), dy = hAt(x + 0.5, y + 1.5) - hAt(x + 0.5, y - 0.5);
      let L = 2.2 - dx * 0.55 + dy * 0.25 + (hash(x >> 1, y >> 1, 463) - 0.5) * 0.9;
      if (x >= xr - 2) L = -9;                                              // stenmuren
      for (let yy = s; yy <= y; yy++) {
        let c;
        if (L < -5) { const blk = ((yy >> 2) + (x & 1)) & 1; c = yy % 4 === 0 ? 0x8a8078 : blk ? 0xc8c0b4 : 0xb4aca0; if (x === xr) c = mul(c, 0.8); }
        else {
          c = G[clamp(Math.round(L), 0, 4)];
          if (yy > s + 1) c = mul(c, 0.93);
          if (hash(x, yy, 461) > 0.985) c = [0xffffff, 0xfff27a, 0xf8a8c4][Math.floor(hash(x, yy, 462) * 3)];
        }
        P.px(x, yy, c);
      }
    }
  }
  // portalerna: mörka valv i muren där rälsen går in (uppe) och ut (nere)
  const ARCH = ['..sSs..', '.sSsSs.', 'sSdddSs', 'sdDDDds', 'SdDDDdS', 'sdDDDds', 'sdDDDdS', 'SdDDDds', 'sdDDDds', 'sdDDDdS', 'SdDDDds', 'sdDDDds', 'sdDDDdS'];
  for (const py of [TRK.cy - TRK.ry, TRK.cy + TRK.ry]) spr(P, xr - 4, py - 12, ARCH, { s: 0xd8d0c4, S: 0x9a9088, d: 0x3a2a30, D: 0x140e14 });
  // stenar, en stig och en gran på toppen
  for (const [sx, sy] of [[cx - 14, cy - 12], [cx + 6, cy + 2], [cx - 22, cy + 10]]) { P.rect(sx, sy, 4, 2, 0xb8b0a8); P.hl(sx, sy, 4, 0xe0d8d0); P.px(sx + 4, sy + 1, 0x6a6258); }
  const tx = cx - 6, ty = cy - H0 - 2;
  for (let j = 0; j < 12; j++) P.hl(tx - (j >> 1), ty - 12 + j, 1 + (j >> 1) * 2, j & 1 ? 0x2e6a3a : 0x3f8a48);
  P.vl(tx, ty, 2, 0x6a4424);
  const t2x = cx + 10, t2y = cy - H0 + 6;
  for (let j = 0; j < 8; j++) P.hl(t2x - (j >> 1), t2y - 8 + j, 1 + (j >> 1) * 2, j & 1 ? 0x2e6a3a : 0x4a9a52);
  P.vl(t2x, t2y, 2, 0x6a4424);
  outline(P, 0x234a2a, 0.35);
  return { img: P.flush(), ox: -x0, oy: -y0 };
}
// Främre staketet runt lekmattan (sidorna och framsidan)
function paintFrontFence() {
  const { x0, x1, y0, y1 } = MAT;
  const P = new Pix(x1 - x0 + 6, y1 - y0 + 12, x0 - 3, y0 - 8);
  for (let x = x0; x < x1; x++) { P.px(x, y0 - 4, 0xfffaf4); P.px(x, y0 - 1, 0xe8dcd8); }
  for (let x = x0; x <= x1; x += 4) { P.vl(x, y0 - 6, 6, 0xfffaf4); P.px(x, y0 - 7, 0xfffaf4); P.px(x + 1, y0 - 5, 0xd8ccc8); }
  for (let x = x0; x <= x1; x++) { P.px(x, y1 - 4, 0xfffaf4); P.px(x, y1 - 1, 0xe8dcd8); }
  for (let x = x0; x <= x1; x += 4) { P.vl(x, y1 - 6, 6, 0xfffaf4); P.px(x, y1 - 7, 0xfffaf4); P.px(x + 1, y1 - 5, 0xd8ccc8); }
  for (const x of [x0, x1]) for (let y = y0 - 6; y <= y1; y += 3) { P.vl(x, y, 2, 0xfffaf4); }
  for (const x of [x0, x1]) { P.vl(x, y0 - 7, y1 - y0 + 8, 0xfffaf4); P.vl(x + (x === x0 ? 1 : -1), y0 - 6, y1 - y0 + 6, 0xd8ccc8); }
  outline(P, 0x6a5a6a, 0.4);
  return { img: P.flush(), ox: x0 - 3, oy: y0 - 8 };
}
// Flygplanet i mobilen över leksakshyllorna
function paintPlane() {
  const P = new Pix(18, 10, -9, -5);
  spr(P, -8, -4, ['.......R.........', '.......RR........', 'kWWWWWWWWWWWBBk..', 'kBBBBBBBBBBBBBBBk', '.kkkkRRRRkkkkkkk.', '......RR.........', '......R..........'], { R: 0xe8404a, W: 0xffffff, B: 0x6aa8e8, k: 0x3a5a8a });
  outline(P, INK, 0.3);
  return { img: P.flush(), ox: 9, oy: 5 };
}

// Kvällens ljuskarta: varma pölar i dithrade steg (läggs på med 'lighter')
function paintNightLight() {
  const P = new Pix(W, H);
  const AMB = 0xff9c68;
  for (const lx of LAMPS) { P.ell(lx, 60, 42, 44, AMB, 0.24, 5); P.ell(lx, 34, 9, 7, 0xffe0b0, 0.55, 3); P.ell(lx, 150, 50, 16, AMB, 0.18, 4); }
  for (const B of BAYS) P.ell((B.x0 + B.x1) / 2, 58, 40, 38, 0xfff0d0, 0.14, 4);
  P.ell(CAPS.x, CAPS.y - 30, 12, 12, 0xffe0f0, 0.3, 3);
  P.ell((SQW.x0 + SQW.x1) / 2, 16, 70, 12, 0xff6aa8, 0.28, 4);                     // bandet SQUISHY i rosa sken
  for (const f of SQW_F) P.ell((SQW.x0 + SQW.x1) / 2, f - 8, 90, 9, 0xffd8e8, 0.12, 3);
  for (const R of FIG_ROWS) for (let c = 0; c < 4; c++) P.ell(FIG.x0 + 18 + c * 33, (R.y0 + R.y1) / 2, 16, 13, 0xfff0c8, 0.42, 4);
  P.ell(339, 96, 56, 22, AMB, 0.22, 4);                                             // kassan
  P.ell(214, 150, 90, 22, AMB, 0.14, 4);                                             // klämbordet
  P.ell(656, 164, 100, 40, 0xfff0c0, 0.08, 3);
  P.ell(247, 60, 22, 30, 0x6a8ad8, 0.12, 3);                                         // gatlyktan utanför
  return P.flush();
}

// ======================= köpdialogerna =======================
const DIALOG_CSS = `<style>
  .lk{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
  .lk-l{display:flex;flex-direction:column;gap:6px;align-items:center;flex:none}
  .lk-pic{border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);line-height:0;touch-action:none;user-select:none}
  .lk canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
  .lk-r{flex:1;min-width:230px;display:flex;flex-direction:column;gap:6px}
  .lk-kat{font-size:var(--f1);margin:0;color:var(--muted)}
  .lk-desc{font-size:var(--f2);line-height:1.15;margin:0}
  .lk-own{font-size:var(--f2);margin:0}
  .lk-price{font-size:var(--f3);margin:2px 0 0;line-height:1}
  .lk-money{font-size:var(--f2);margin:0;display:flex;flex-wrap:wrap;gap:0 14px}
  .lk-money span{white-space:nowrap}
  .lk-hint{font-size:var(--f1);line-height:1.15;color:var(--muted);margin:0;text-align:center}
  .lk-list .prow{grid-template-columns:auto 1fr auto;cursor:pointer}
  .lk-list .ico{border:2px solid var(--ink);line-height:0}
  .lk-list .nm small{color:var(--muted);font-size:var(--f1)}
</style>`;
function crispCanvas(w, h, S) {
  const dpr = globalThis.devicePixelRatio || 1, D = Math.max(1, Math.round(S * dpr));
  const c = document.createElement('canvas');
  c.width = w * D; c.height = h * D;
  c.style.width = (w * D / dpr) + 'px'; c.style.height = (h * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  return { c, x, D };
}
function moneyLine(money, tot) {
  const short = tot - money;
  return `<span>${$t`💰 Du har <b>${fmt(money)}</b>`}</span>${short > 0 ? `<span class="bad">${$t`du saknar <b>${fmt(short)}</b>`}</span>` : `<span>${$t`kvar efter köpet: <b>${fmt(money - tot)}</b>`}</span>`}`;
}
const PIC_BG = { squishy: 0xfbe0ea, figur: 0xe2f0fc, plysch: 0xfff0d0, leksak: 0xdcf4e6 };
// Bildrutan i dialogen: leksaken i heltalsskala på rutig bakgrund. Squishies lever: tryck
// och håll på bilden så trycks den ihop, släpp så studsar den tillbaka.
function mountPic(el, T) {
  // med toys.js ritas leksaken om i storlek 3 (samma pixelkorn, tre gånger så mycket detalj)
  const big = !!TOYMOD, u = big ? 3 : 1, live = !!T.squish;
  const d = dims(T.id, u);
  // klämbara: plats ovanför för den utsträckta studsen och hjärtat som stiger (squish.js
  // ritar hjärtat 1:1, ca 18 px ovanför den utsträckta formen)
  const head = live ? 6 * u + 20 : 3 * u;
  const w = Math.max(28 * u, d.w + (live ? 12 * u : 6 * u)), h = Math.max(20 * u, d.h + 3 * u + 1 + head);
  const S = clamp(Math.round(210 / Math.max(w, h)), 2, 9);
  const { c, x } = crispCanvas(w, h, S);
  el.replaceChildren(c);
  const src = mkCanvas(w, h), sx = src.getContext('2d');
  sx.imageSmoothingEnabled = false;
  const base = PIC_BG[T.kategori] || 0xf4ecdf;
  const bgc = mkCanvas(w, h), bx = bgc.getContext('2d');
  bx.fillStyle = hx(base); bx.fillRect(0, 0, w, h);
  const q = 2 * u;
  for (let yy = 0; yy < h; yy += q) for (let xx = 0; xx < w; xx += q) if (((xx + yy) / q) % 2 === 0) fpx(bx, xx, yy, mul(base, 0.95), q, q);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const r = Math.hypot((xx - w / 2 + 0.5) / (w * 0.42), (yy - h * 0.5) / (h * 0.5)); if (r < 1 && ((Math.floor(xx / u) + Math.floor(yy / u)) % 2 === 0 || r < 0.7)) fpx(bx, xx, yy, mix(base, WHITE, 0.4)); }
  const fx = Math.round(w / 2 - d.w / 2 + d.ox), fy = h - 3 * u - 1;
  if (!big) { bx.fillStyle = 'rgba(58,34,56,.18)'; bx.fillRect(fx - (d.w >> 1), fy, d.w, 1); }
  const sq = live ? makeSquishy(T.id, { size: u }) : null;
  let last = performance.now(), t = 0;
  const frame = (now) => {
    if (!c.isConnected) { sq?.release(); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    sq?.update(dt);
    sx.clearRect(0, 0, w, h);
    sx.drawImage(bgc, 0, 0);
    if (sq) sq.draw(sx, fx, fy);
    else blitToy(sx, T.id, fx, fy, t, big ? { size: 3, levande: true } : null);
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0, c.width, c.height);
    requestAnimationFrame(frame);
  };
  if (sq) {
    el.style.cursor = 'pointer';
    const up = () => sq.release();
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); try { el.setPointerCapture(ev.pointerId); } catch { /* ok */ } sq.press(); });
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  requestAnimationFrame(frame);
  return { S };
}
function toyIcon(id, S = 2) {
  const e = toyImg(id, 0), w = e.w + 4, h = e.h + 4;
  const { c, x, D } = crispCanvas(w, h, S);
  x.fillStyle = '#fff6f8'; x.fillRect(0, 0, c.width, c.height);
  const src = mkCanvas(w, h), s = src.getContext('2d');
  s.drawImage(e.c, 2, 2);
  x.drawImage(src, 0, 0, w * D, h * D);
  return c;
}

// ======================= personerna =======================
const CASHIER = { skin: '#eec3a0', hair: '#c65fa0', style: 'bun', hat: null, top: 'tee', shirt: '#f8a8c4', accent: '#f4f1ea', bottom: 'pants', pants: '#3f4fa8', shoes: '#f2f2f2', glasses: 'round', beard: false, phones: false, bag: null, apron: true, blush: true, build: 5, kid: false };
const KID_LOOKS = [
  { skin: '#f6d7bf', hair: '#d9a95c', style: 'ponytail', hat: null, top: 'tee', shirt: '#f28bb3', accent: '#f4f1ea', bottom: 'skirt', pants: '#8e5bd1', shoes: '#f2f2f2', glasses: false, beard: false, phones: false, bag: null, blush: true, build: 4, kid: true },
  { skin: '#a06a43', hair: '#1d1714', style: 'curly', hat: 'cap', cap: '#f0b429', top: 'hoodie', shirt: '#3a7bd5', accent: '#f4f1ea', bottom: 'shorts', pants: '#2d3a5c', shoes: '#c23b3b', glasses: false, beard: false, phones: false, bag: 'backpack', bagColor: '#46a35a', blush: false, build: 4, kid: true },
  { skin: '#e0a97f', hair: '#6b4226', style: 'bob', hat: null, top: 'stripes', shirt: '#46a35a', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#3a6bc2', glasses: 'round', beard: false, phones: false, bag: null, blush: true, build: 4, kid: true },
  { skin: '#c68a5c', hair: '#3b2619', style: 'buzz', hat: null, top: 'tee', shirt: '#6cb8ec', accent: '#f4f1ea', bottom: 'shorts', pants: '#556b3a', shoes: '#e0b24a', glasses: false, beard: false, phones: false, bag: null, blush: true, build: 4, kid: true },
];
const PARENT = { skin: '#f6d7bf', hair: '#d9a95c', style: 'long', hat: null, top: 'jacket', shirt: '#7a2e3e', accent: '#f4f1ea', bottom: 'jeans', pants: '#2d3a5c', shoes: '#6b3e1e', glasses: false, beard: false, phones: false, bag: 'shoulder', bagColor: '#6b4a33', blush: false, build: 5, kid: false };
// (barnens repliker är svenska: /mamma/ i updateKids avgör om föräldern svarar – översätts där de sägs)
const KID_LINES = [$n('hihi!'), $n('den piper!'), $n('mamma, får jag den här?'), $n('den är så mjuk!'), $n('titta, den blir platt!'), $n('kläm på den rosa!'), $n('hihihi!'), $n('boing boing!'), $n('den luktar jordgubb!'), $n('jag vill ha alla!')];
const PARENT_ANSWERS = [$t('Vi får se, gumman! 😊'), $t('Kanske på lördag.'), $t('En liten då – sen går vi.'), $t('Du har ju tre hemma!')];
const PARENT_LINES = [$t('Försiktigt nu!'), $t('Oj, den där var söt.'), $t('Fem minuter till, sen går vi!')];
const TRAIN_LINES = [$t('TUT TUT!'), $t('tåget kommer!'), $t('nu åker den in i tunneln!'), $t('igen, igen!')];
const ROAM_LINES = [$t('wiiii!'), $t('jag har en nalle!'), $t('kom och titta på tåget!'), $t('hihi!')];
// Springbarnets lilla nalle (9×9): barnet är bara ~26 px högt, så en hel leksak ur hyllan
// skulle täcka ansiktet – den här ryms i famnen mellan hakan och knäna.
const MINI_NALLE = [
  '.kk...kk.',
  'kNnkkknNk',
  '.knNNNnk.',
  '.kenmnek.',
  '.knmmmnk.',
  '..krRrk..',
  '.knNNNnk.',
  'knnNmNnnk',
  '.knnknnk.',
];
const MINI_PAL = { k: '#5a3418', n: '#c88a4a', N: '#e2b070', m: '#f6dcb4', e: '#2a1a10', r: '#d8303e', R: '#ff7a86' };
let miniNalle = null;
function miniNalleImg() {
  if (miniNalle) return miniNalle;
  miniNalle = mkCanvas(9, 9);
  ctxSpr(miniNalle.getContext('2d'), 0, 0, MINI_NALLE, MINI_PAL);
  return miniNalle;
}
const CASH_TIPS = [$t('Squishiesarna är mjukast i hela stan! 🥟'), $t('Dumplingsen i bambukorgarna är nya i dag!'), $t('Klämkompisarna finns som gosedjur också – titta i lådan!'), $t('Tåget på lekmattan kör hela dagen.'), $t('Klämbordet får man klämma på hur mycket man vill!')];

// ======================= scenen =======================
export function makeShopLeksaker(A, opts = {}) {
  const g = A.game;
  let t = 0, lockedCam = null, peekCam = null, hoverId = null, hoverT = -9, hoverSq = -1;
  let builtKey = '';

  // ---------- gången ----------
  const KID_SPOTS = [[132, 152, 'right'], [194, 146, 'down'], [652, 117, 'down']];
  const PARENT_SPOT = [298, 154, 'left'];
  const OBST = [
    [SQW.x0 - 2, WALL_Y, SQW.x1 + 2, SQW.base + 1],
    [CAPS.x - 11, WALL_Y, CAPS.x + 11, CAPS.y + 1],
    [CNT.x0 - 1, WALL_Y, CNT.x1 + 1, CNT.y + 1],
    [FIG.x0 - 2, WALL_Y, FIG.x1 + 2, FIG.base + 1],
    [GIR.x - 8, GIR.y - 6, GIR.x + 8, GIR.y + 1],
    [TS.x0 - 2, WALL_Y, TS.x1 + 2, TS.base + 1],
    [TABLE.x0, TABLE.front - 1, TABLE.x1, TABLE.y + 1],
    [PYR.x - 43, PYR.y - 9, PYR.x + 43, PYR.y + 17],
    [CRATE.x0 - 2, CRATE.top - 8, CRATE.x1 + 2, CRATE.y + 1],
    [HORSE.x - 13, HORSE.y - 5, HORSE.x + 13, HORSE.y + 1],
    [MAT.x0 - 1, MAT.y0 - 2, MAT.x1 + 1, MAT.y1 + 1],
    [BALLS.x - 17, BALLS.y - 8, BALLS.x + 17, BALLS.y + 1],
    [GIFTS.x - 13, GIFTS.y - 6, GIFTS.x + 13, GIFTS.y + 1],
    [PALM.x - 8, PALM.y - 5, PALM.x + 8, PALM.y + 1],
    ...[...KID_SPOTS, PARENT_SPOT].map(([x, y]) => [x - 5, y - 3, x + 5, y + 1]),
  ];
  const walker = createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 6, bottom: H - 5, spawn: [DOOR_SPOT[0], DOOR_SPOT[1] + 4] });
  walker.setObstacles(OBST);
  walker.snapFree();
  // Kameran följer figuren – utom vid klämbordet: där står den still över bordet (även på
  // väg dit, medan man håller och under studsen), annars glider squishyn iväg under fingret
  // när figuren tar ett kliv i sidled mot den man klämmer.
  const tableCamX = () => clamp(((TABLE.x0 + TABLE.x1) >> 1) - VW / 2, 0, W - VW);
  const atTableCam = () => me.toTable || me.mode === 'table' || myHold >= 0;
  const camTarget = () => lockedCam ?? peekCam ?? (atTableCam() ? tableCamX() : clamp(walker.px - VW / 2, 0, W - VW));
  const cam = { x: 0 };            // sätts när figuren (me) finns, längre ner

  // ---------- bilder ----------
  const cache = {};
  const nightNow = () => isNight(g.min / 60);
  const bgRaw = () => (cache['bg' + nightNow()] ||= paintBg(nightNow()));
  // bakgrunden med prislappar och namnskyltar (beror på sortimentet) i en enda bild
  const bg = () => {
    const k = 'bgs' + nightNow() + builtKey + stockGen;
    if (!cache[k]) { const c = mkCanvas(W, H), x = c.getContext('2d'); x.drawImage(bgRaw(), 0, 0); if (stockLayer) x.drawImage(stockLayer, 0, 0); for (const key of Object.keys(cache)) if (key.startsWith('bgs')) delete cache[key]; cache[k] = c; }
    return cache[k];
  };
  let stockGen = 0;
  const nightLight = () => (cache.light ||= paintNightLight());
  const doorFr = paintDoorFrames();
  const counter = paintCounter();
  const table = paintTable();
  const roundTable = paintRoundTable();
  const bBack = paintBasketBack(), bFront = paintBasketFront(), lidFlat = paintLid(false), lidTilt = paintLid(true);
  const crateBack = paintCrate(false), crateFront = paintCrate(true);
  const capsImg = [paintCapsule(false), paintCapsule(true)];
  const girImg = paintGiraffe();
  const horseImg = paintHorse();
  const balloons = [paintBalloon('heart', P_PINK), paintBalloon('round', P_MINT), paintBalloon('star', P_BUTTER), paintBalloon('round', P_LILAC)];
  const lampImg = LAMPS.map((_, i) => paintLampBalloon([P_PINK, P_MINT, P_SKY][i % 3]));
  const signImg = paintSign();
  const trainImg = paintTrain();
  const hillImg = paintHill();
  const fenceImg = paintFrontFence();
  const planeImg = paintPlane();
  const ballImg = paintBallBasket(), giftImg = paintGiftStack(), palmImg = paintPalm();
  const glows = { lamp: glowImg(26, 20, 0xffc890, 0.3), fig: glowImg(14, 12, 0xfff0c0, 0.3), head: glowImg(3, 3, 0xfff6c0, 0.7) };

  // ---------- sortimentet på hyllorna (byggs om när toys.js/squish.js blir klara) ----------
  let wallItems = [], wallGroups = [], figs = [], shelfItems = [], shelfGroups = [], heap = null, heapTop = null, baskets = [], tableSq = [], stockLayer = null;
  // Ett hyllfack: sorterna i tur och ordning som små grupper (framme + en bakom på
  // trappsteget), sedan breddas grupperna med fler exemplar tills facket är fullt.
  // Returnerar { items, groups, rest } – rest = sorter som inte fick plats.
  function layoutComp(ids, x0, x1, foot, clear, riser, fill = []) {
    const W0 = x1 - x0, row = [], rest = [];
    let used = 0;
    for (const id of ids) {
      const d = dims(id);
      if (d.h > clear + 2) continue;
      if (used + d.w + 2 > W0) { rest.push(id); continue; }
      row.push({ id, d, n: 1 }); used += d.w + 2;
    }
    // tomt fack: fyll med sådant som redan står i hyllan
    if (!row.length) for (const id of fill) { const d = dims(id); if (d.h <= clear + 2 && used + d.w + 2 <= W0) { row.push({ id, d, n: 1 }); used += d.w + 2; } }
    let grew = true;
    while (grew) { grew = false; for (const G of row) { if (G.n >= 3) continue; const add = G.d.w + 1; if (used + add + row.length + 1 <= W0) { G.n++; used += add; grew = true; } } }
    const gap = row.length ? (W0 - used) / (row.length + 1) : 0;
    const items = [], groups = [];
    let x = x0 + gap;
    for (const G of row) {
      const { w, h, ox } = G.d, gw = G.n * (w + 1) + 1, gx0 = Math.round(x);
      const back = riser && h + 4 <= clear;
      for (let i = 0; i < G.n; i++) {
        const ix = gx0 + 1 + i * (w + 1) + ox;
        if (back && (G.n === 1 || i < G.n - 1)) items.push({ id: G.id, x: G.n === 1 ? ix + Math.round(w * 0.4) : ix + ((w + 1) >> 1), y: foot - 4, back: true, ph: hash(ix, foot, 5) * 5 });
        items.push({ id: G.id, x: ix, y: foot, back: false, ph: hash(ix, foot, 6) * 5 });
      }
      groups.push({ id: G.id, r: [gx0 - 1, foot - Math.min(clear, h + (back ? 5 : 1)) - 1, gx0 + gw + (back && G.n === 1 ? Math.round(w * 0.4) : 0) + 1, foot + 3], cx: gx0 + (gw >> 1), foot });
      x += gw + gap;
    }
    return { items, groups, rest };
  }
  function layoutUnit(lists, x0, x1, foots, clears, riser) {
    const items = [], groups = [];
    let carry = [];
    const all = lists.flat();
    foots.forEach((foot, c) => {
      const L = layoutComp([...carry, ...(lists[c] || [])], x0, x1, foot, clears[c], riser, all);
      items.push(...L.items); groups.push(...L.groups); carry = L.rest;
    });
    items.sort((a, b) => (a.back === b.back ? a.y - b.y : a.back ? -1 : 1));
    return { items, groups };
  }
  const grp = (T) => T.grupp || '';
  function buildStock() {
    builtKey = modKey();
    const toys = allToys();
    const byKat = (k) => toys.filter((x) => x.kategori === k);
    const sqs = byKat('squishy'), fig = byKat('figur'), plu = byKat('plysch'), lek = byKat('leksak');
    const sqIds = sqs.map((x) => x.id);
    const isDump = (T) => ['dumpling', 'glitter', 'jul'].includes(grp(T)) || (!grp(T) && DUMP_RE.test(T.id + ' ' + T.namn));
    // squishyväggen: glitterdumplings överst, juldumplings i mitten, squishy-mat längst ner
    let lists;
    if (sqs.some((T) => grp(T))) {
      const of = (g) => sqs.filter((T) => grp(T) === g).map((T) => T.id);
      lists = [of('glitter'), of('jul'), [...of('mat'), ...sqs.filter((T) => !['dumpling', 'glitter', 'jul', 'mat', 'korg'].includes(grp(T))).map((T) => T.id), ...of('korg')]];
      if (!lists[0].length || !lists[1].length) lists = [sqIds.slice(0, 8), sqIds.slice(8, 16), sqIds.slice(16)];
    } else { const n = Math.ceil(sqIds.length / 3); lists = [sqIds.slice(0, n), sqIds.slice(n, 2 * n), sqIds.slice(2 * n)]; }
    const wall = layoutUnit(lists, SQW.x0 + 5, SQW.x1 - 5, SQW_F, [SQW_F[0] - SQW.top - 3, SQW_F[1] - SQW_F[0] - 3, SQW_F[2] - SQW_F[1] - 3], true);
    wallItems = wall.items; wallGroups = wall.groups;
    // figurerna i facken
    figs = (fig.length ? fig : plu).slice(0, 8).map((T, i) => {
      const c = i % 4, R = FIG_ROWS[i >> 2];
      return { id: T.id, namn: T.kompis || T.namn, x: FIG.x0 + 3 + c * 33 + 16, y: R.y1 - 4, r: [FIG.x0 + 3 + c * 33, R.y0, FIG.x0 + 34 + c * 33, R.plate + 8], plateY: R.plate + 1, ph: i * 0.7 };
    });
    // leksakshyllorna: bilar och tåg | spel och klossar | dockor, bad och bollar
    const BAY_GRP = [['bil', 'tag'], ['klossar', 'spel', 'jojo', 'snurra', 'pussel'], ['docka', 'bad', 'boll']];
    const bays = [[], [], []];
    lek.forEach((T, i) => {
      let b = BAY_GRP.findIndex((gs) => gs.includes(grp(T)));
      if (b < 0) b = BAY_RE.findIndex((re) => re.test(T.id + ' ' + T.namn));
      bays[b >= 0 ? b : i % 3].push(T.id);
    });
    shelfItems = []; shelfGroups = [];
    const clears = [TS_F[0] - TS.top - 9, TS_F[1] - TS_F[0] - 3, TS_F[2] - TS_F[1] - 3];
    bays.forEach((ids, b) => {
      if (!ids.length) return;
      // största först i det höga översta facket
      const sorted = [...ids].sort((p, q) => dims(q).h - dims(p).h);
      const L = layoutUnit([sorted, [], []], BAYS[b].x0 + 1, BAYS[b].x1 - 1, TS_F, clears, false);
      shelfItems.push(...L.items); shelfGroups.push(...L.groups.map((q) => ({ ...q, bay: b })));
    });
    // bambukorgarna: pastelldumplings (eller andra dumplings/squishies), två korgar med lock
    const pastell = sqs.filter((T) => grp(T) === 'dumpling').map((T) => T.id);
    const dumps = pastell.length ? pastell : sqs.filter(isDump).map((T) => T.id);
    const dIds = dumps.length ? dumps : sqIds;
    const BPOS = [[-25, 7], [0, 8], [25, 7], [-12, -4], [12, -4], [0, -15]];
    baskets = BPOS.map(([dx, dy], i) => ({ i, x: Math.round(PYR.x + dx), y: Math.round(PYR.y + dy), id: dIds[i % Math.max(1, dIds.length)] || null, lid: i === 5 || i === 2, openT: -9 }));
    // klämbordets sex squishies: några favoriter, annars de första klämbara
    const soft = sqs.filter((T) => T.squish !== false).map((T) => T.id);
    const FAV = ['jordgubbslada', 'glitter-rosa', 'dumpling-vit', 'jul-renhorn', 'appel', 'kattass'];
    const chosen = FAV.filter((id) => soft.includes(id));
    for (const id of soft) { if (chosen.length >= 6) break; if (!chosen.includes(id) && !dIds.includes(id)) chosen.push(id); }
    for (const id of soft) { if (chosen.length >= 6) break; if (!chosen.includes(id)) chosen.push(id); }
    for (const q of tableSq) { q.holders.clear(); try { q.sq.release(); } catch { /* ok */ } }
    // platserna längs bordet efter leksakernas bredd
    const ws = chosen.map((id) => dims(id).w), inner = TABLE.x1 - TABLE.x0 - 8;
    const gapT = Math.max(1, (inner - ws.reduce((a, v) => a + v, 0)) / (chosen.length + 1));
    let tx = TABLE.x0 + 4 + gapT;
    tableSq = chosen.map((id, i) => { const d = dims(id), q = { id, i, sq: makeSquishy(id), x: Math.round(tx + d.ox), y: SQ_Y, w: d.w, h: d.h, holders: new Set(), tag: null }; tx += d.w + gapT; return q; });
    buildHeap(plu.length ? plu : fig);
    buildStockLayer();
    tableTags();
  }
  // Prislapparna som hänger i snören från klämbordets kant, en under varje squishy
  // (klick = köpdialogen). Lapparna trängs aldrig: blir det trångt tappar de ":-".
  function tableTags() {
    let last = TABLE.x0 + 2;
    const n = tableSq.length;
    tableSq.forEach((q, i) => {
      const T = toyById(q.id);
      if (!T) { q.tag = null; return; }
      const next = i + 1 < n ? tableSq[i + 1].x : TABLE.x1 + 30;
      const room = Math.min(q.x - last, next - q.x) * 2 - 2;
      let str = $t`${Math.round(T.pris)}:-`;
      if (textW(SMALL, str) + 4 > room) str = String(Math.round(T.pris));
      const img = tagImg(str), w = img.width;
      const x0 = clamp(Math.round(q.x - w / 2), last, TABLE.x1 - 2 - w);
      last = x0 + w + 1;
      q.tag = { x0, y: TAG_Y, w, img, sx: clamp(q.x, x0 + 1, x0 + w - 2), r: [x0 - 1, TAG_Y - 2, x0 + w, TAG_Y + 8] };
    });
  }
  const TAG_Y = TABLE.front + 3;                  // lappens överkant (snöret går från bordskanten)
  const tableTagAt = (x, y) => tableSq.findIndex((q) => q.tag && x >= q.tag.r[0] && x <= q.tag.r[2] && y >= q.tag.r[1] && y <= q.tag.r[3]);
  // plyschberget: en hög gosedjur i lådan (ritas en gång) och en stor Klämkompis överst
  // som går att klämma
  function buildHeap(list) {
    const ids = list.map((x) => x.id);
    if (!ids.length) { heap = null; heapTop = null; return; }
    const { x0, x1, top } = CRATE, cx = (x0 + x1) >> 1;
    const P0 = { x: x0 - 22, y: 96 }, cw = x1 - x0 + 44, ch = CRATE.y - P0.y + 6;
    const c = mkCanvas(cw, ch), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.translate(-P0.x, -P0.y);
    x.drawImage(crateBack.img, x0 - 2, top - 10);
    const kompis = list.filter((T) => grp(T) === 'klamkompis' || /^plysch-/.test(T.id)).map((T) => T.id);
    const others = ids.filter((id) => !kompis.includes(id));
    const order = [];
    for (let i = 0; i < Math.max(kompis.length, others.length) * 2; i++) { const a = kompis[i % Math.max(1, kompis.length)], b = others[i % Math.max(1, others.length)]; if (a) order.push(a); if (b && i % 2 === 0) order.push(b); }
    const pick = (n) => order[n % order.length] || ids[n % ids.length];
    const hMax = Math.max(...ids.map((id) => dims(id).h));
    const step = Math.max(6, Math.round(hMax * 0.4));
    const rows = [[-27, -14, -1, 12, 25], [-21, -7, 6, 19], [-15, 13]];
    let n = 0;
    rows.forEach((row, r) => { for (const dx of row) { blitToy(x, pick(n), cx + dx + ((r * 5 + n) % 3) - 1, top + 6 - r * step, 0, { levande: false }); n++; } });
    x.drawImage(crateFront.img, x0 - 2, top - 10);
    blitToy(x, pick(n + 1), x1 + 10, CRATE.y + 1, 0, { levande: false });            // ramlat ut på mattan
    blitToy(x, pick(n + 3), x0 - 9, CRATE.y, 0, { levande: false });
    heap = { c, x: P0.x, y: P0.y };
    const topId = kompis[0] || pick(n);
    const big = !!(TOYMOD && SQMOD);
    heapTop = { id: topId, x: cx + 1, y: top + 6 - 2 * step - 2, bounce: -9, sq: big ? makeSquishy(topId, { size: 2 }) : null, squeezeT: -9 };
  }
  // prislappar och namnskyltar (text som beror på sortimentet) i ett eget lager
  function buildStockLayer() {
    const P = new Pix(W, H);
    const tag = (cx, y, price, room, last) => {
      let str = $t`${Math.round(price)}:-`;
      if (textW(SMALL, str) + 4 > room) str = String(Math.round(price));
      const M = textMask(SMALL, str), w = M.w + 4;
      let x0 = Math.round(cx - w / 2);
      if (x0 < last.x) x0 = last.x;
      if (x0 + w > cx + room / 2 + 6) return;                       // ingen plats – hoppa över
      last.x = x0 + w + 1;
      tags.push({ x: x0, y, img: tagImg(str) });
    };
    tags = [];
    const lasts = new Map();
    for (const G of [...wallGroups, ...shelfGroups].sort((p, q) => p.foot - q.foot || p.cx - q.cx)) {
      const T = toyById(G.id);
      if (!T) continue;
      const key = G.foot + ':' + (G.bay ?? 'w');
      if (!lasts.has(key)) lasts.set(key, { x: -1e9 });
      tag(G.cx, G.foot + 1, T.pris, G.r[2] - G.r[0], lasts.get(key));
    }
    for (const F of figs) {
      const s = safeTxt($t(F.namn)).split(' ')[0].slice(0, 7), M = textMask(SMALL, s);
      drawText(P, M, F.x - (M.w >> 1), F.plateY, { fill: 0x5a3a5a });
    }
    stockLayer = P.flush(); stockGen++;
  }
  let tags = [];
  const TAGS = new Map();
  // gul prislapp ("39:-") som liten bild
  const tagImg = (str) => {
    if (TAGS.has(str)) return TAGS.get(str);
    const M = textMask(SMALL, str), w = M.w + 4, P = new Pix(w, 7);
    area(P, 0, 0, w, 7, (X, Y, i, j) => (i === 0 || j === 0 || i === w - 1 || j === 6 ? 0x8a6a1a : j === 1 ? 0xfff6c0 : 0xfce078));
    drawText(P, M, 2, 1, { fill: 0x3a2a10 });
    const c = P.flush(); TAGS.set(str, c); return c;
  };
  const doilies = new Map();
  const doilyOf = (w) => { if (!doilies.has(w)) doilies.set(w, paintDoily(w)); return doilies.get(w); };
  const korgLid = [paintKorgLid(false), paintKorgLid(true)];
  buildStock();

  // ---------- klämandet ----------
  function holdSq(i, who) {
    const q = tableSq[i];
    if (!q) return;
    const was = q.holders.size;
    q.holders.add(who);
    if (!was) { try { q.sq.press(); } catch { /* ok */ } burst(q, false); }
  }
  function letGo(i, who) {
    const q = tableSq[i];
    if (!q || !q.holders.has(who)) return;
    q.holders.delete(who);
    if (!q.holders.size) { try { q.sq.release(); } catch { /* ok */ } burst(q, true); }
  }
  let myHold = -1;
  const glitterOf = (id) => /glitter|glitt|stjärn|regnbåg/i.test(id + ' ' + (toyById(id)?.namn || ''));
  function burst(q, up) {
    if (SQMOD && TOYMOD) return;          // squish.js ritar egna hjärtan, gnistor och klämstreck
    if (up) {
      for (let k = 0; k < 2; k++) parts.push({ kind: 'heart', x: q.x + (k ? 5 : -5), y: q.y - 12, vx: (k ? 6 : -6), vy: -18 - Math.random() * 6, age: 0, max: 1.1 });
    } else {
      for (let k = 0; k < (glitterOf(q.id) ? 10 : 4); k++) { const a = Math.random() * Math.PI * 2; parts.push({ kind: glitterOf(q.id) ? 'glitter' : 'puff', x: q.x + Math.cos(a) * 7, y: q.y - 5 + Math.sin(a) * 3, vx: Math.cos(a) * 16, vy: Math.sin(a) * 8 - 6, age: 0, max: 0.5 + Math.random() * 0.3 }); }
    }
  }
  function pressMine(i) {
    if (myHold >= 0) letGo(myHold, 'me');
    myHold = i;
    holdSq(i, 'me');
    // figuren tar ett kliv i sidled bakom bordet mot den hon klämmer
    const tx = clamp(tableSq[i].x + 5, BACK_X0, BACK_X1);
    if (Math.abs(tx - walker.px) > 10) walker.walkTo(tx, ME_TABLE[1], () => { walker.dir = 'down'; });
    squeezes++;
    if (Math.random() < 0.35) kidReact();
  }
  function releaseMine() { if (myHold < 0) return; letGo(myHold, 'me'); myHold = -1; }
  let squeezes = 0;

  // ---------- figuren (jag) ----------
  // toTable = på väg till platsen bakom klämbordet (kameran ställer sig över bordet direkt)
  const me = { mode: 'free', gift: -9, waitT: -9, hinted: false, bagId: null, toTable: false };
  cam.x = camTarget();
  toysOf(g);                       // ta in tidigare köp ur sparfilen direkt (se toysOf)
  const talkMe = hushing(createSpeech()), talkCash = createSpeech(), talkParent = createSpeech();
  const meAt = () => ({ x: walker.px, y: walker.py - 44 });
  const cashier = { x: 338, tx: 338, dir: 'down', face: 'down', idleT: 4, wrapT: 0, pending: null };
  const cashAt = () => ({ x: Math.round(cashier.x), y: CASH_Y - 44 });
  // står bakom klämbordet (även medan figuren tar ett kliv i sidled där)
  const atTable = () => me.mode === 'table' && Math.abs(walker.py - ME_TABLE[1]) < 3 && walker.px >= BACK_X0 - 2 && walker.px <= BACK_X1 + 2;

  // ---------- köpet ----------
  const bought = [];
  function buyToy(id) {
    const T = toyById(id);
    if (!T) return { ok: false, msg: 'Den finns inte i butiken.' };
    const pris = Math.round(+T.pris);
    if (g.money < pris) return { ok: false, poor: true, money: g.money, pris };
    g.money -= pris;
    const own = toysOf(g);
    own[id] = (own[id] | 0) + 1;
    g.glad?.(3, '', 'nytt', 10);                                                            // nya saker gör en glad (samma tak som kläderna)
    g.save();
    play('buy');
    bought.push({ id, pris, t: Math.round(t * 10) / 10 });
    // paketet hämtas i kassan: figuren går dit och kassören slår in det
    releaseMine();
    me.mode = 'toPay'; me.bagId = id;
    cashier.pending = { id, namn: sayName(T) };
    walker.walkTo(PAY[0], PAY[1], payArrive);
    return { ok: true, pris, money: g.money, count: own[id] };
  }
  // framme vid kassan (eller avbruten på vägen): kassören slår in paketet
  function payArrive() {
    if (me.mode !== 'toPay') return;
    me.mode = 'free'; walker.dir = 'up';
    cashier.wrapT = 1.3; cashier.x = cashier.tx = 338;
  }
  function sayPoor(T) {
    const vis = cashier.x > cam.x + 10 && cashier.x < cam.x + VW - 10;
    const m = Math.max(0, Math.floor(g.money));
    if (vis) talkCash.say($t`Oj! ${sayName(T)} kostar ${Math.round(T.pris)} kr och du har ${m} kr. Jobba ett pass, så väntar den här på dig! 💛`, cashAt, 5);
    else talkMe.say($t`Hmm, ${Math.round(T.pris)} kr … jag har bara ${m} kr. Jag får spara lite först! 💸`, meAt, 4.5);
    play('miss');
  }
  function openToy(id) {
    const T = toyById(id);
    if (!T) return;
    hoverId = null;
    releaseMine();
    const owned = toysOf(g)[id] | 0;
    const body = `${DIALOG_CSS}<div class="lk">
      <div class="lk-l"><div class="lk-pic" data-pic></div>${T.squish ? `<p class="lk-hint">${$t('🤏 Tryck och håll på bilden!')}</p>` : ''}</div>
      <div class="lk-r">
        <p class="lk-kat">${KAT_ICON[T.kategori]} ${KAT_NAME[T.kategori]}</p>
        <p class="lk-desc">${esc(T.beskrivning || '')}</p>
        <p class="lk-own">${$t`🎁 Du har: <b>${owned}</b> st`}</p>
        <p class="lk-price">${$t`Pris: <b>${fmt(T.pris)}</b>`}</p>
        <p class="lk-money">${moneyLine(g.money, T.pris)}</p>
      </div></div>`;
    const dlg = openModal(`${emojiOf(T)} ${esc(toyName(T))}`, body, [
      { label: $t('Stäng'), onClick: closeModal },
      { label: $t`🛍️ Köp ${fmt(T.pris)}`, cls: 'btn-go', onClick: () => { closeModal(); const r = buyToy(id); if (!r.ok && r.poor) sayPoor(T); } },
    ]);
    mountPic(dlg.querySelector('[data-pic]'), T);
  }
  function openKat(kat, ids = null, title = null) {
    hoverId = null;
    releaseMine();
    const list = (ids || allToys().filter((x) => kat === 'alla' || x.kategori === kat).map((x) => x.id)).map(toyById).filter(Boolean);
    if (!list.length) return;
    const own = toysOf(g);
    const rows = list.map((T, i) => `<div class="prow" data-open="${esc(T.id)}">
        <span class="ico" data-ico="${esc(T.id)}"></span>
        <span class="nm">${emojiOf(T)} <b>${esc(toyName(T))}</b><br><small>${esc(T.beskrivning || '')}${own[T.id] ? ` · ${$t`du har ${own[T.id]}`}` : ''}</small></span>
        <button class="btn btn-small btn-go" data-buy="${esc(T.id)}" ${i < 9 ? `data-key="${i + 1}"` : ''}>🛍️ ${fmt(T.pris)}${i < 9 ? ` <kbd>${i + 1}</kbd>` : ''}</button>
      </div>`).join('');
    const head = title || (kat === 'alla' ? $t('🧸 Leksakslådan – hela sortimentet') : `${KAT_ICON[kat]} ${KAT_NAME[kat]}`);
    const dlg = openModal(head, `${DIALOG_CSS}<p style="font-size:var(--f2);margin:0 0 8px">${$t`💰 Du har <b>${fmt(g.money)}</b> · klicka på en leksak för att se den närmare.`}</p><div class="plist lk-list">${rows}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-ico]').forEach((el) => el.replaceChildren(toyIcon(el.dataset.ico, 2)));
    dlg.querySelectorAll('[data-open]').forEach((el) => (el.onclick = (e) => { if (e.target.closest('[data-buy]')) return; openToy(el.dataset.open); }));
    dlg.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => { const T = toyById(b.dataset.buy); closeModal(); const r = buyToy(b.dataset.buy); if (!r.ok && r.poor && T) sayPoor(T); }));
  }

  // ---------- barnen, föräldern, kassören ----------
  const kids = KID_SPOTS.map(([x, y, dir], i) => ({ i, look: KID_LOOKS[i], x, y, dir, talk: createSpeech(), T: 1.5 + i * 2.2, hold: -1, holdT: 0, hop: 0, reach: i === 0 ? [0, 1] : i === 1 ? [0, 1, 2] : [] }));
  const kidAt = (k) => () => ({ x: k.x, y: k.y - 34 });
  let chatT = 3, answerT = -1, answerWait = 0, trainTalkT = 6;
  function kidReact() {
    const k = kids[Math.random() < 0.5 ? 0 : 1];
    if (k.talk.active()) return;
    if (npcSay(k.talk, kidAt(k), $t(KID_LINES[Math.floor(Math.random() * 3)]), 2.2, { voice: k.look })) k.hop = 0.6;
  }
  // barnet som springer runt med en liten nalle i famnen
  const roam = { look: KID_LOOKS[3], w: createWalker({ W, H, left: 8, right: W - 8, top: WALL_Y + 6, bottom: H - 5, spawn: [520, 186] }), talk: createSpeech(), wait: 2, stop: 0, toy: null };
  const roamAt = () => ({ x: roam.w.px, y: roam.w.py - 34 });
  const parentAt = () => ({ x: PARENT_SPOT[0], y: PARENT_SPOT[1] - 44 });
  const roamLine = () => ROAM_LINES[Math.floor(Math.random() * ROAM_LINES.length)];

  // ---------- pratbubblorna: bara den som syns pratar, och aldrig i munnen på varandra ----------
  // Varje talare = { talk, at } där at() är ankaret som bubblan ritas ovanför.
  const seenX = (x, m = 6) => x >= cam.x + m && x <= cam.x + VW - m;
  // bubblans ruta (samma mått som sayBubble i walkable.js: w 124, 5 rader, hålls i bild)
  function bubbleBox(text, pos) {
    if (!text || !pos) return null;
    const lines = sayLines(String(text), 124, 5);
    if (!lines.length) return null;
    const w = Math.max(...lines.map((l) => l.reduce((a, q) => a + q.w, 0))) + 7;
    const h = lines.reduce((a, l) => a + (l.some((q) => q.emoji) ? 10 : 7), 0) + 4;
    const x0 = clamp(Math.round(pos.x - w / 2), Math.round(cam.x) + 2, Math.round(cam.x) + VW - w - 2);
    return { x0: x0 - 1, x1: x0 + w + 1, y0: pos.y - h - 5, y1: pos.y + 3 };
  }
  const overlap = (a, b) => !!(a && b) && a.x0 < b.x1 + 3 && b.x0 < a.x1 + 3 && a.y0 < b.y1 + 2 && b.y0 < a.y1 + 2;
  const npcs = () => [...kids.map((k) => ({ talk: k.talk, at: kidAt(k) })), { talk: roam.talk, at: roamAt }, { talk: talkParent, at: parentAt }];
  const speakers = () => [...npcs(), { talk: talkCash, at: cashAt }, { talk: talkMe, at: meAt }];
  // Får talaren säga det här nu? Den måste synas, och ingen annan bubbla får ligga i vägen.
  function npcSay(talk, at, text, secs, opts) {
    const pos = at();
    if (!pos || !seenX(pos.x)) return false;
    const box = bubbleBox(text, pos);
    for (const S of speakers()) if (S.talk !== talk && S.talk.active() && overlap(box, bubbleBox(S.talk.text(), S.at()))) return false;
    talk.say(text, at, secs, opts);
    return true;
  }
  // Något jag själv har bett om (klickat på barnet, min egen replik): säg det direkt och
  // tysta de barn- och föräldrabubblor som skulle hamna i vägen.
  function hushNear(text, at, except) {
    const box = bubbleBox(text, typeof at === 'function' ? at() : at);
    if (box) for (const S of npcs()) if (S.talk !== except && S.talk.active() && overlap(box, bubbleBox(S.talk.text(), S.at()))) S.talk.clear();
  }
  function hushing(sp) {
    const w = { ...sp, say(text, at, secs, o) { hushNear(text, at, w); sp.say(text, at, secs, o); } };
    return w;
  }
  function forceSay(talk, at, text, secs, opts) { hushNear(text, at, talk); talk.say(text, at, secs, opts); }
  roam.w.setObstacles(OBST.slice(0, 11));
  roam.w.speed = 44;
  const ROAM_PTS = [[520, 186], [548, 114], [506, 200], [340, 186], [112, 196], [300, 116], [530, 124]];
  let roamI = 0;

  function updateKids(dt) {
    for (const k of kids) {
      k.hop = Math.max(0, k.hop - dt);
      // köade repliker (två barn som vill prata samtidigt): nästa när det finns plats
      if (k.queue?.length && !k.talk.active()) {
        const [s, secs] = k.queue[0];
        if (!seenX(k.x)) k.queue.length = 0;
        else if (npcSay(k.talk, kidAt(k), $t(s), secs, { voice: k.look })) { k.queue.shift(); k.hop = 0.7; if (/mamma/.test(s)) { answerT = 1.6; answerWait = 3; } }
      }
      if (k.reach.length === 0) {                                  // tågtittaren
        continue;
      }
      if (k.hold >= 0) {
        k.holdT -= dt;
        if (k.holdT <= 0) {
          letGo(k.hold, 'kid' + k.i); k.hold = -1; k.T = 5 + Math.random() * 7;
          if (Math.random() < 0.55 && !k.talk.active()) { const s = KID_LINES[Math.floor(Math.random() * KID_LINES.length)]; if (npcSay(k.talk, kidAt(k), $t(s), 2.4, { voice: k.look })) { k.hop = 0.7; if (/mamma/.test(s)) { answerT = 1.6; answerWait = 3; } } }
        }
        continue;
      }
      k.T -= dt;
      const onScreen = TABLE.x1 > cam.x && TABLE.x0 < cam.x + VW;
      if (k.T <= 0 && !onScreen) k.T = 1;
      else if (k.T <= 0) {
        const i = k.reach[Math.floor(Math.random() * k.reach.length)];
        if (tableSq[i]) { k.hold = i; k.holdT = 0.35 + Math.random() * 0.8; holdSq(i, 'kid' + k.i); }
        else k.T = 2;
      }
    }
    // föräldern svarar på "mamma, får jag …?" när barnets bubbla inte är i vägen (annars
    // väntar hon lite; dröjer det för länge får frågan vara)
    if (answerT > 0) answerT -= dt;
    else if (answerWait > 0) {
      answerWait -= dt;
      if (!seenX(PARENT_SPOT[0])) answerWait = 0;
      else if (npcSay(talkParent, parentAt, PARENT_ANSWERS[Math.floor(Math.random() * PARENT_ANSWERS.length)], 3, { voice: PARENT })) answerWait = 0;
    }
    chatT -= dt;
    if (chatT <= 0) {
      chatT = 9 + Math.random() * 8;
      if (Math.random() < 0.4 && !talkParent.active()) npcSay(talkParent, parentAt, PARENT_LINES[Math.floor(Math.random() * PARENT_LINES.length)], 2.6, { voice: PARENT });
    }
    // tågtittaren jublar när tåget kommer förbi
    const kc = kids[2];
    trainTalkT -= dt;
    const loco = trackAt(train.s);
    if (trainTalkT <= 0 && Math.abs(loco.x - kc.x) < 18 && loco.y < TRK.cy && !kc.talk.active()) {
      if (npcSay(kc.talk, kidAt(kc), TRAIN_LINES[Math.floor(Math.random() * TRAIN_LINES.length)], 2.2, { voice: kc.look })) kc.hop = 0.8;
      trainTalkT = 9 + Math.random() * 7;
    }
    // springbarnet
    const R = roam;
    R.w.update(dt);
    if (!R.w.path.length) {
      R.wait -= dt;
      if (R.wait <= 0) {
        roamI = (roamI + 1 + Math.floor(Math.random() * 2)) % ROAM_PTS.length;
        const [x, y] = ROAM_PTS[roamI];
        R.w.walkTo(x, y);
        R.wait = 1.5 + Math.random() * 3;
        if (Math.random() < 0.3 && !R.talk.active()) npcSay(R.talk, roamAt, roamLine(), 2, { voice: R.look });
      }
    }
  }
  function updateCashier(dt) {
    const C = cashier;
    if (C.wrapT > 0) {
      C.wrapT -= dt; C.dir = 'down';
      if (C.wrapT <= 0 && C.pending) {
        const p = C.pending; C.pending = null;
        talkCash.say($t`Varsågod! ${p.namn} – inslagen med rosett! 🎀 Tack för att du handlar hos oss!`, cashAt, 4.5);
        play('coin');
        me.gift = t + 9;
      }
      return;
    }
    const dx = C.tx - C.x;
    if (Math.abs(dx) > 0.5) { C.x += Math.sign(dx) * Math.min(Math.abs(dx), 30 * dt); C.dir = dx < 0 ? 'left' : 'right'; return; }
    C.x = C.tx;
    C.idleT -= dt;
    if (C.idleT <= 0) { C.tx = [338, 338, 342, 374, 334][Math.floor(Math.random() * 5)]; C.idleT = 3 + Math.random() * 5; C.face = C.tx === 374 ? 'up' : 'down'; }
    else C.dir = C.face;
  }

  // ---------- tåget ----------
  const train = { s: 40, v: 22, stopT: 0, stopped: false, smokeT: 0 };
  const STATION_S = TRK_LS + TRK_A + (TRK.cxR - 664);
  function updateTrain(dt) {
    const T = train;
    if (T.stopT > 0) { T.stopT -= dt; if (T.stopT <= 0) { T.v = 0; } }
    else {
      T.v = Math.min(22, T.v + dt * 14);
      const before = T.s % TRK_L;
      T.s += T.v * dt;
      const after = T.s % TRK_L;
      if (before < STATION_S && after >= STATION_S) { T.stopT = 1.6; T.v = 0; if (Math.abs(664 - (cam.x + VW / 2)) < VW / 2) toot(); }
    }
    T.smokeT -= dt;
    if (T.smokeT <= 0 && T.stopT <= 0) {
      const p = trackAt(T.s), inHill = p.x < TRK.cxL + 1;
      if (!inHill) { const d = trackAt(T.s + 1); const dir = d.x >= p.x ? 1 : -1; parts.push({ kind: 'smoke', x: p.x + dir * 4, y: p.y - 11, vx: -dir * 3, vy: -8, age: 0, max: 1 }); }
      T.smokeT = 0.35;
    }
  }
  function carView(s) {
    const a = trackAt(s - 0.8), b = trackAt(s + 0.8), dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy) * 0.9) return dx >= 0 ? 'right' : 'left';
    return dy < 0 ? 'up' : 'down';
  }

  // ---------- partiklar (hjärtan, glitter, ånga, rök) ----------
  const parts = [];
  function updateParts(dt) {
    for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'heart' || p.kind === 'steam') p.x += Math.sin(p.age * 7 + p.y) * dt * 6; if (p.kind === 'glitter' || p.kind === 'puff') { p.vx *= 0.9; p.vy *= 0.9; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].max) parts.splice(i, 1);
    if (parts.length > 220) parts.splice(0, parts.length - 220);
  }
  // korgarna: locken lyfts och sänks, ånga när de är öppna
  function liftLid(i) {
    const b = baskets[i];
    if (!b || !b.lid) return false;
    if (b.openT > t - 0.2) return false;
    b.openT = t;
    plopp();
    for (let k = 0; k < 6; k++) parts.push({ kind: 'steam', x: b.x - 6 + k * 2.4, y: b.y - 14, vx: 0, vy: -10 - Math.random() * 6, age: -k * 0.08, max: 1.2 });
    parts.push({ kind: 'heart', x: b.x, y: b.y - 20, vx: 0, vy: -14, age: 0, max: 1.2 });
    return true;
  }
  const lidUp = (b) => (b.lid ? clamp(Math.min((t - b.openT) / 0.25, (b.openT + 4.2 - t) / 0.35), 0, 1) : 1);

  // ---------- dörren ----------
  let doorOpen = 0, doorWas = false;
  const peds = [];
  let pedT = 1;
  function updateDoor(dt) {
    const near = (x, y) => x > DOOR.x0 - 10 && x < DOOR.x1 + 10 && y < WALL_Y + 16;
    const any = near(walker.px, walker.py) || near(roam.w.px, roam.w.py);
    doorOpen += ((any ? 1 : 0) - doorOpen) * Math.min(1, dt * 7);
    if (any && !doorWas) play('chirp');
    doorWas = any;
    pedT -= dt;
    if (pedT <= 0) { const dir = Math.random() < 0.5 ? 'left' : 'right'; peds.push({ x: dir === 'right' ? DOOR.x0 - 16 : DOOR.x1 + 16, dir, look: pedLook(), sp: 14 + Math.random() * 10, ph: Math.random() }); pedT = 3 + Math.random() * 6; }
    for (const p of peds) { p.x += (p.dir === 'right' ? 1 : -1) * p.sp * dt; p.ph += dt * p.sp / 22; }
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].x < DOOR.x0 - 20 || peds[i].x > DOOR.x1 + 20) peds.splice(i, 1);
  }
  const PED_LOOKS = [PARENT, KID_LOOKS[1], { ...PARENT, hair: '#1d1714', style: 'short', shirt: '#3a7bd5', top: 'hoodie', bag: null }, KID_LOOKS[2], { ...CASHIER, apron: false, shirt: '#46a35a', hair: '#b9b3ab', glasses: 'square' }];
  const pedLook = () => PED_LOOKS[Math.floor(Math.random() * PED_LOOKS.length)];

  // ---------- klickbara platser ----------
  const nearTableGo = () => ME_TABLE;
  const shelfGo = (x) => [clamp(x, 16, 760), WALL_Y + 12];
  function spots() {
    const out = [];
    // prislapparna på klämbordets kjol: köp det man just klämt på
    tableSq.forEach((q) => { if (q.tag) out.push({ id: 'lapp-' + q.i, r: q.tag.r, go: [q.x, TABLE.y + 9], act: () => openToy(q.id), toy: q.id, buy: true }); });
    tableSq.forEach((q) => out.push({ id: 'bord-' + q.i, r: [q.x - 10, q.y - 18, q.x + 10, q.y + 3], go: nearTableGo, act: toTableAct, label: $t('TESTA MIG! TRYCK OCH HÅLL') }));
    kids.forEach((k) => out.push({ id: 'barn-' + k.i, r: [k.x - 6, k.y - 30, k.x + 6, k.y + 1], go: [k.x + (k.x < walker.px ? 16 : -16), k.y + 4], act: () => { forceSay(k.talk, kidAt(k), k.i === 2 ? TRAIN_LINES[Math.floor(Math.random() * 4)] : $t(KID_LINES[Math.floor(Math.random() * KID_LINES.length)]), 2.4, { voice: k.look }); k.hop = 0.7; play('click'); } }));
    out.push({ id: 'barn-3', r: [roam.w.px - 6, roam.w.py - 30, roam.w.px + 6, roam.w.py + 1], go: [roam.w.px + 14, roam.w.py + 4], act: () => { forceSay(roam.talk, roamAt, roamLine(), 2, { voice: roam.look }); play('click'); } });
    out.push({ id: 'foralder', r: [PARENT_SPOT[0] - 7, PARENT_SPOT[1] - 40, PARENT_SPOT[0] + 7, PARENT_SPOT[1] + 1], go: [PARENT_SPOT[0] + 14, PARENT_SPOT[1] + 6], act: () => { forceSay(talkParent, parentAt, $t('Hej! Barnen älskar klämbordet – vi kommer hit varje lördag. 😊'), 3.5, { voice: PARENT }); play('click'); } });
    [...baskets].reverse().forEach((b) => out.push({ id: 'korg-' + b.i, r: [b.x - 12, b.y - 22, b.x + 12, b.y], go: [b.x + (b.i % 3 - 1) * 4, PYR.y + 24], act: () => { if (b.lid && lidUp(b) < 0.5 && liftLid(b.i)) return; if (b.id) openToy(b.id); }, label: b.lid ? $t('LYFT PÅ LOCKET') : null, toy: b.id }));
    wallGroups.forEach((G) => out.push({ id: G.id, r: G.r, go: () => shelfGo(G.cx), act: () => openToy(G.id), toy: G.id }));
    figs.forEach((F) => out.push({ id: F.id, r: F.r, go: () => shelfGo(F.x), act: () => openToy(F.id), toy: F.id }));
    shelfGroups.forEach((G) => out.push({ id: G.id, r: G.r, go: () => shelfGo(G.cx), act: () => openToy(G.id), toy: G.id }));
    if (heapTop) {
      const d = dims(heapTop.id, heapTop.sq ? 2 : 1);
      out.push({ id: 'topp', r: [heapTop.x - (d.w >> 1), heapTop.y - d.h, heapTop.x + (d.w >> 1), heapTop.y], go: [CRATE.x0 - 8, CRATE.y - 2], act: () => {
        // kläm på den stora Klämkompisen – sen visas den i en dialog
        heapTop.bounce = t;
        if (heapTop.sq) { try { heapTop.sq.press(); } catch { /* ok */ } heapTop.squeezeT = t + 0.35; }
        else play('chirp');
        setTimeout(() => { if (A.scene && A.sceneName === 'leksaker') openToy(heapTop.id); }, 900);
      }, toy: heapTop.id });
    }
    out.push(
      { id: 'kassor', r: [cashier.x - 7, CASH_Y - 40, cashier.x + 7, CNT.top - 1], go: PAY, act: () => { talkCash.say(CASH_TIPS[Math.floor(Math.random() * CASH_TIPS.length)], cashAt, 3.8); play('click'); } },
      { id: 'disk', r: [CNT.x0, 76, CNT.x1, CNT.y], go: PAY, act: () => { talkCash.say($t('Här är hela sortimentet! 🧸'), cashAt, 2.5); play('click'); openKat('alla'); }, label: $t('KASSAN - HELA SORTIMENTET') },
      { id: 'klambord', r: [TABLE.x0, TABLE.top - 4, TABLE.x1, TABLE.y], go: nearTableGo, act: toTableAct, label: $t('KLÄMBORDET - TESTA MIG!') },
      { id: 'skylt', r: [SIGN.x - 36, SIGN.y - 14, SIGN.x + 36, SIGN.y + 14], go: nearTableGo, act: toTableAct, label: $t('KLÄMBORDET - TESTA MIG!') },
      { id: 'pyramid', r: [PYR.x - 44, PYR.y - 40, PYR.x + 44, PYR.y + 18], go: [PYR.x, PYR.y + 24], act: () => { const d = allToys().filter((x) => x.kategori === 'squishy' && DUMP_RE.test(x.id + ' ' + x.namn)).map((x) => x.id); openKat('squishy', d.length ? d : null, $t('🥟 Dumplings i bambukorgar')); }, label: $t('BAMBUKORGARNA - DUMPLINGS') },
      { id: 'hylla-squishy', r: [SQW.x0, 6, SQW.x1, SQW.base], go: () => shelfGo(102), act: () => openKat('squishy'), label: $t('SQUISHYVÄGGEN') },
      { id: 'hylla-figur', r: [FIG.x0, 6, FIG.x1, FIG.base], go: () => shelfGo(464), act: () => openKat('figur'), label: $t('KLÄMKOMPISARNA') },
      { id: 'hylla-plysch', r: [CRATE.x0 - 10, 110, CRATE.x1 + 14, CRATE.y + 4], go: [(CRATE.x0 + CRATE.x1) / 2, CRATE.y + 10], act: () => openKat('plysch'), label: $t('PLYSCHBERGET - KRAMA MIG!') },
      { id: 'hylla-leksak', r: [TS.x0, 20, TS.x1, TS.base], go: () => shelfGo(655), act: () => openKat('leksak'), label: $t('LEKSAKSHYLLORNA') },
      { id: 'automat', r: [CAPS.x - 10, CAPS.y - 42, CAPS.x + 10, CAPS.y], go: [CAPS.x, CAPS.y + 8], act: () => { capsShake = t; rattle(); talkMe.say($t('Kapselautomaten är tom – påfyllning på måndag, står det. 🙃'), meAt, 3.2); } },
      { id: 'hast', r: [HORSE.x - 14, HORSE.y - 26, HORSE.x + 14, HORSE.y + 2], go: [HORSE.x, HORSE.y + 8], act: () => { horseT = t; play('click'); talkMe.say($t('Gunghästen gungar! 🐴'), meAt, 2); } },
      { id: 'bollar', r: [BALLS.x - 18, BALLS.y - 30, BALLS.x + 18, BALLS.y + 1], go: [BALLS.x + 22, BALLS.y - 2], act: () => { const b = allToys().filter((x) => x.grupp === 'boll').map((x) => x.id); if (b.length) openKat('leksak', b, $t('⚽ Bollar')); else talkMe.say($t('En hel korg med bollar! ⚽'), meAt, 2); } },
      { id: 'giraff', r: [GIR.x - 8, GIR.y - 76, GIR.x + 8, GIR.y], go: [GIR.x, GIR.y + 10], act: () => { girT = t; play('chirp'); talkMe.say($t('Jättegiraffen är inte till salu – hon heter Långa Lisa. 🦒'), meAt, 3); } },
      { id: 'tag', r: [MAT.x0, MAT.y0 - 8, MAT.x1, MAT.y1], go: [clamp(walker.px, MAT.x0 + 10, MAT.x1 - 10), MAT.y1 + 8], act: () => { toot(); train.v = 22; talkMe.say($t('TUT TUT! 🚂'), meAt, 2); }, label: $t('LEKMATTAN MED TÅGET') },
      { id: 'dorr', r: [DOOR.x0 - 3, DOOR.top - 14, DOOR.x1 + 3, WALL_Y + 10], go: DOOR_SPOT, act: () => { play('door'); A.go('city'); }, label: $t('GÅ UT') },
    );
    return out;
  }
  let capsShake = -9, horseT = -9, girT = -9;
  const inR = (s, x, y) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3];
  const spotAt = (x, y) => spots().find((s) => inR(s, x, y)) || null;
  const ALIAS = { 'dörr': 'dorr', 'klämbord': 'klambord', kassa: 'disk', 'kassör': 'kassor', 'förälder': 'foralder', 'tåg': 'tag', 'häst': 'hast' };
  const spotById = (id) => { const k = ALIAS[id] || id; return spots().find((s) => s.id === k) || null; };
  const tableSqAt = (x, y) => tableSq.findIndex((q) => x >= q.x - (q.w >> 1) - 3 && x <= q.x + (q.w >> 1) + 3 && y >= q.y - q.h - 4 && y <= q.y + 4);
  function goSpot(h, x, y) {
    const go = typeof h.go === 'function' ? h.go(x, y) : h.go;
    me.toTable = h.go === nearTableGo;
    walker.walkTo(go[0], go[1], () => { walker.dir = 'up'; h.act(); });
  }
  // klämbordets platser (bordet, skylten, squishiesarna): figuren ställer sig bakom bordet
  function toTableAct() {
    me.mode = 'table'; me.toTable = false; walker.dir = 'down';
    if (!me.hinted) { me.hinted = true; talkMe.say($t('Tryck och håll på en squishy! 🤏 Prislappen = köp.'), meAt, 3.8); }
  }

  // ---------- släpp klämmet även om pekaren släpps utanför spelytan ----------
  const onWinUp = () => releaseMine();
  for (const ev of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(ev, onWinUp);

  // ---------- uppdatering ----------
  let greeted = false, enterT = 0;
  function update(dt) {
    dt = Math.min(0.1, Math.max(0, dt));
    t += dt;
    if (builtKey !== modKey()) buildStock();
    walker.update(dt);
    if (me.mode === 'toPay' && !walker.path.length) payArrive();
    if (me.toTable && !walker.path.length && me.mode !== 'table') me.toTable = false;      // kom aldrig fram
    if (me.mode === 'table' && !atTable() && !walker.path.length) me.mode = 'free';
    if (me.mode === 'table' && !walker.path.length) walker.dir = 'down';
    for (const q of tableSq) { try { q.sq.update(dt); } catch { /* ok */ } }
    if (heapTop?.sq) { try { heapTop.sq.update(dt); if (heapTop.squeezeT > 0 && t > heapTop.squeezeT) { heapTop.sq.release(); heapTop.squeezeT = -9; } } catch { /* ok */ } }
    updateKids(dt);
    updateCashier(dt);
    updateTrain(dt);
    updateDoor(dt);
    updateParts(dt);
    for (const b of baskets) if (b.lid && t - b.openT > 0 && t - b.openT < 3.8 && Math.random() < dt * 5) parts.push({ kind: 'steam', x: b.x - 7 + Math.random() * 14, y: b.y - 14, vx: 0, vy: -9, age: 0, max: 1 });
    // nyångade dumplings: lite ånga ur de öppna korgarna överst
    for (const b of baskets) if (!b.lid && b.i >= 3 && Math.random() < dt * 0.9) parts.push({ kind: 'steam', x: b.x - 5 + Math.random() * 10, y: b.y - 16, vx: 0, vy: -7, age: 0, max: 1.1 });
    enterT += dt;
    if (!greeted && enterT > 0.7) { greeted = true; talkCash.say($t('Hej och välkommen till Leksakslådan! 🧸 Klämbordet får man klämma på!'), cashAt, 4.2); }
    const k = lockedCam !== null || peekCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (camTarget() - cam.x) * k;
  }
  // låt tåget, röken och folket komma igång direkt
  for (let i = 0; i < 60; i++) { updateTrain(1 / 20); updateParts(1 / 20); }

  // ---------- ritning ----------
  function drawWall(ctx) {
    for (const it of wallItems) blitToy(ctx, it.id, it.x, it.y, t + it.ph);
    for (const it of shelfItems) blitToy(ctx, it.id, it.x, it.y, t + it.ph);
    for (const F of figs) blitToy(ctx, F.id, F.x, F.y, t + F.ph);
    for (const T of tags) ctx.drawImage(T.img, T.x, T.y);
    // klockan på pelaren vid kassan (kaninöron)
    const cx = 281, cy = 46;
    ctx.fillStyle = '#f8bcd0'; ctx.fillRect(cx - 4, cy - 12, 2, 6); ctx.fillRect(cx + 3, cy - 12, 2, 6);
    ctx.fillStyle = '#b45a7e'; ctx.fillRect(cx - 6, cy - 5, 13, 11); ctx.fillRect(cx - 5, cy - 6, 11, 13);
    ctx.fillStyle = '#fffaf4'; ctx.fillRect(cx - 5, cy - 4, 11, 9); ctx.fillRect(cx - 4, cy - 5, 9, 11);
    ctx.fillStyle = '#c8a8b8';
    for (let k = 0; k < 12; k += 3) { const a = k / 12 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.sin(a) * 4), Math.round(cy - Math.cos(a) * 4), 1, 1); }
    const m = g.min % 60, h = (g.min / 60) % 12;
    ctx.fillStyle = '#3a2238'; ctxLine(ctx, cx, cy, cx + Math.sin(h / 12 * Math.PI * 2) * 2.5, cy - Math.cos(h / 12 * Math.PI * 2) * 2.5);
    ctx.fillStyle = '#6a4a60'; ctxLine(ctx, cx, cy, cx + Math.sin(m / 60 * Math.PI * 2) * 4, cy - Math.cos(m / 60 * Math.PI * 2) * 4);
    ctx.fillStyle = '#f8505a'; ctx.fillRect(cx, cy, 1, 1);
  }
  function drawPyramid(ctx) {
    ctx.drawImage(roundTable.img, roundTable.ox, roundTable.oy);
    const real = !!(TOYMOD && TOYMOD.drawKorg);
    let seat = { dx: 0, dy: -8 };
    if (real && TOYMOD.korgSeat) { try { seat = TOYMOD.korgSeat(1); } catch { /* ok */ } }
    for (const b of baskets) {
      const up = lidUp(b);
      if (real && b.lid && up <= 0.02) { TOYMOD.drawKorg(ctx, b.x, b.y, { open: false }); continue; }
      if (real) TOYMOD.drawKorg(ctx, b.x, b.y, { open: true, part: 'bak' }); else ctx.drawImage(bBack.img, b.x - bBack.ox, b.y - bBack.oy);
      if (b.id && (!b.lid || up > 0.15)) blitToy(ctx, b.id, b.x + seat.dx, b.y + seat.dy, t + b.i * 0.7);
      if (real) TOYMOD.drawKorg(ctx, b.x, b.y, { open: true, part: 'fram' }); else ctx.drawImage(bFront.img, b.x - bFront.ox, b.y - bFront.oy);
      if (b.lid) {
        const L = real ? korgLid[up > 0.4 ? 1 : 0] : (up > 0.4 ? lidTilt : lidFlat);
        ctx.drawImage(L.img, b.x - L.ox + Math.round(up * 3), b.y - L.oy - Math.round(up * 9));
      }
    }
    // prisskylten på en pinne
    const d = baskets.find((b) => b.id);
    if (d) {
      const T = toyById(d.id);
      if (T) {
        const s = $t`DUMPLINGS ${Math.round(T.pris)}:-`, w = textW(SMALL, s) + 6, x0 = PYR.x - (w >> 1), y0 = PYR.y + 4;
        ctx.fillStyle = '#6a3a2a'; ctx.fillRect(PYR.x - 1, y0 - 2, 2, 3);
        ctx.fillStyle = '#5e1018'; ctx.fillRect(x0 - 1, y0, w + 2, 9);
        ctx.fillStyle = '#fff4e0'; ctx.fillRect(x0, y0 + 1, w, 7);
        ctxText(ctx, SMALL, s, x0 + 3, y0 + 2, '#c8323a');
      }
    }
  }
  function drawTable(ctx) {
    ctx.drawImage(table.img, table.ox, table.oy);
    // molnskylten TESTA MIG! på en pinne i bordets bakre hörn
    ctx.fillStyle = '#b45a7e'; ctx.fillRect(SIGN.x, SIGN.y + 8, 1, TABLE.top + 3 - SIGN.y - 8); ctx.fillStyle = '#f890b4'; ctx.fillRect(SIGN.x + 1, SIGN.y + 8, 1, TABLE.top + 3 - SIGN.y - 8);
    ctx.drawImage(signImg.img, SIGN.x - signImg.ox, SIGN.y - signImg.oy + (Math.sin(t * 1.6) > 0.7 ? -1 : 0));
    for (const q of tableSq) { const D = doilyOf(q.w); ctx.drawImage(D.img, q.x - D.ox, q.y - 1 - D.oy); }
    // prislapparna i sina snören (den man pekar på gungar lite och lyser upp)
    tableSq.forEach((q, i) => {
      const T = q.tag;
      if (!T) return;
      const hot = hoverId === 'lapp-' + i && t - hoverT < 3;
      const sw = hot ? (Math.floor(t * 6) & 1) : 0;
      ctx.fillStyle = '#8a6a7a'; ctx.fillRect(T.sx, TABLE.front - 1, 1, TAG_Y - TABLE.front + 1);
      ctx.fillStyle = '#f8505a'; ctx.fillRect(T.sx, TABLE.front - 1, 1, 1);        // knappnålen i bordskanten
      ctx.drawImage(T.img, T.x0 + sw, T.y);
      if (hot) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(T.x0 + 1 + sw, T.y + 1, T.w - 2, 1); }
    });
    tableSq.forEach((q, i) => {
      try { q.sq.draw(ctx, q.x, q.y); } catch { blitToy(ctx, q.id, q.x, q.y, 0); }
      if (atTable() && (i === hoverSq || i === myHold)) {
        // en liten pil ovanför den man pekar på
        const by = q.y - 22 - (Math.floor(t * 4) & 1);
        ctx.fillStyle = '#e8507e'; ctx.fillRect(q.x - 2, by, 5, 1); ctx.fillRect(q.x - 1, by + 1, 3, 1); ctx.fillRect(q.x, by + 2, 1, 1);
      }
    });
  }
  function drawCounterGroup(ctx) {
    // kassören (bakom disken) – slår in paket med armarna fram
    const C = cashier, walking = Math.abs(C.tx - C.x) > 0.5;
    const fr = C.wrapT > 0 ? 9 : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : (Math.sin(t * 1.7) > 0.93 ? 4 : 0);
    drawPerson(ctx, Math.round(C.x), CASH_Y, CASHIER, C.wrapT > 0 ? 'down' : C.dir, fr);
    if (C.wrapT > 0) drawGift(ctx, Math.round(C.x) - 5, CASH_Y - 22, t);
    ctx.drawImage(counter.img, counter.ox, counter.oy);
    // ballongerna vid diskens vänstra ände
    const bx = CNT.x0 + 3, by = CNT.top - 1;
    [[-8, 44, 0], [3, 38, 1], [10, 50, 2], [-2, 56, 3]].forEach(([dx, y, k]) => {
      const sway = Math.round(Math.sin(t * 1.3 + k * 1.7) * 1.2), top = y + Math.round(Math.sin(t * 2 + k) * 0.8);
      ctx.fillStyle = 'rgba(90,70,90,.8)';
      ctxLine(ctx, bx + dx + sway, top + 1, bx, by);
      const B = balloons[k];
      ctx.drawImage(B.img, bx + dx + sway - B.ox, top - B.oy + 1);
    });
  }
  function drawGift(ctx, x, y) {
    ctx.fillStyle = '#b45a7e'; ctx.fillRect(x - 1, y - 1, 12, 9);
    ctx.fillStyle = '#f8bcd0'; ctx.fillRect(x, y, 10, 7);
    ctx.fillStyle = '#ffe2ec'; ctx.fillRect(x, y, 10, 1);
    ctx.fillStyle = '#8ad8b4'; ctx.fillRect(x + 4, y, 2, 7); ctx.fillRect(x, y + 3, 10, 1);
    ctx.fillRect(x + 2, y - 3, 2, 2); ctx.fillRect(x + 6, y - 3, 2, 2); ctx.fillRect(x + 4, y - 2, 2, 2);
  }
  function drawMat(ctx, night) {
    // tåget (sorterat bakifrån), sedan berget över vänstra kurvan och det främre staketet
    const cars = [{ n: 'loco', s: train.s }, { n: 'wag1', s: train.s - 15 }, { n: 'wag2', s: train.s - 28 }].map((c) => ({ ...c, p: trackAt(c.s), v: carView(c.s) }));
    cars.sort((a, b) => a.p.y - b.p.y);
    for (const c of cars) {
      const im = trainImg[c.n][c.v] || trainImg[c.n].right;
      const bob = train.v > 1 && (Math.floor(t * 10 + c.s) & 1) ? -1 : 0;
      ctx.drawImage(im.img, Math.round(c.p.x) - im.ox, Math.round(c.p.y) - im.oy + 1 + bob);
      if (night && c.n === 'loco' && (c.v === 'right' || c.v === 'left' || c.v === 'down')) {
        const hx2 = Math.round(c.p.x) + (c.v === 'right' ? 8 : c.v === 'left' ? -9 : 0), hy = Math.round(c.p.y) - 5;
        ctx.fillStyle = 'rgba(255,240,170,.9)'; ctx.fillRect(hx2, hy, 1, 1);
      }
    }
    ctx.drawImage(hillImg.img, -hillImg.ox, -hillImg.oy);
    ctx.drawImage(fenceImg.img, fenceImg.ox, fenceImg.oy);
  }
  function drawKid(ctx, k) {
    const hop = k.hop > 0 ? -Math.round(Math.abs(Math.sin(k.hop * 12)) * 2) : 0;
    const fr = k.hold >= 0 ? 9 : (Math.sin(t * 2 + k.i) > 0.9 ? 4 : 0);
    drawPerson(ctx, k.x, k.y + hop, k.look, k.dir, fr);
  }
  function drawWorld(ctx, cx, vw) {
    const hour = g.min / 60, night = isNight(hour), dark = darkness(hour);
    ctx.drawImage(bg(), 0, 0);
    // ---- utanför dörren: folk som går förbi (klippt till glaset) ----
    ctx.save();
    ctx.beginPath();
    if (doorOpen > 0.05) ctx.rect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top);
    else ctx.rect(DOOR.x0 + 4, DOOR.top + 4, DOOR.x1 - DOOR.x0 - 8, 32);
    ctx.clip();
    for (const p of peds) drawPerson(ctx, p.x, WALL_Y - 6, p.look, p.dir, WALK_SEQ[Math.floor(p.ph * 8.5) % 4]);
    if (!night && dark > 0) { ctx.fillStyle = `rgba(14,16,44,${dark})`; ctx.fillRect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, WALL_Y - DOOR.top); }
    ctx.restore();
    ctx.drawImage(doorFr[Math.round(clamp(doorOpen, 0, 1) * (doorFr.length - 1))], DOOR.x0, DOOR.top);
    const swing = doorOpen > 0.1 ? Math.round(Math.sin(t * 18)) : 0;
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(DOOR.x0 + 3, DOOR.top - 1, 1, 2);
    ctx.fillStyle = '#e8c050'; ctx.fillRect(DOOR.x0 + 2 + swing, DOOR.top + 1, 3, 3);
    ctx.fillStyle = '#fff0a8'; ctx.fillRect(DOOR.x0 + 2 + swing, DOOR.top + 1, 1, 1);
    drawWall(ctx);

    // ---- allt på golvet i djupordning ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(CNT.y, () => drawCounterGroup(ctx));
    add(TABLE.y, () => drawTable(ctx));
    add(PYR.y + 16, () => drawPyramid(ctx));
    add(CRATE.y, () => {
      if (heap) ctx.drawImage(heap.c, heap.x, heap.y);
      if (heapTop) {
        if (heapTop.sq) heapTop.sq.draw(ctx, heapTop.x, heapTop.y);
        else { const b = t - heapTop.bounce < 0.6 ? -Math.round(Math.abs(Math.sin((t - heapTop.bounce) * 10)) * 3) : 0; blitToy(ctx, heapTop.id, heapTop.x, heapTop.y + b, t); }
      }
    });
    add(CAPS.y, () => { const sh = t - capsShake < 0.6; const im = capsImg[sh && (Math.floor(t * 20) & 1) ? 1 : 0]; ctx.drawImage(im.img, CAPS.x - im.ox + (sh ? (Math.floor(t * 30) & 1) : 0), CAPS.y - im.oy); });
    add(GIR.y, () => { const nod = t - girT < 0.8 ? (Math.floor(t * 8) & 1) : 0; ctx.drawImage(girImg.img, GIR.x - girImg.ox + nod, GIR.y - girImg.oy); });
    add(HORSE.y, () => { const f = t - horseT < 2.4 ? [0, 1, 0, 2][Math.floor((t - horseT) * 5) % 4] : 0; ctx.drawImage(horseImg.frames[f], HORSE.x - horseImg.ox, HORSE.y - horseImg.oy); });
    add(MAT.y1, () => drawMat(ctx, night));
    add(BALLS.y, () => ctx.drawImage(ballImg.img, BALLS.x - ballImg.ox, BALLS.y - ballImg.oy));
    add(GIFTS.y, () => ctx.drawImage(giftImg.img, GIFTS.x - giftImg.ox, GIFTS.y - giftImg.oy));
    add(PALM.y, () => ctx.drawImage(palmImg.img, PALM.x - palmImg.ox, PALM.y - palmImg.oy));
    for (const k of kids) add(k.y, () => drawKid(ctx, k));
    add(PARENT_SPOT[1], () => drawPerson(ctx, PARENT_SPOT[0], PARENT_SPOT[1], PARENT, talkParent.active() ? 'down' : PARENT_SPOT[2], Math.sin(t * 1.3) > 0.94 ? 4 : 0));
    add(roam.w.py, () => {
      const walking = roam.w.path.length > 0, fr = walking ? [7, 9, 8, 9][Math.floor(t * 8) % 4] : 9, dir = roam.w.dir;
      drawPerson(ctx, roam.w.px, roam.w.py, roam.look, dir, fr);
      // nallen kramas mot magen (i profil lite framför) – huvudet syns ovanför
      if (dir !== 'up') { const bob = walking && (Math.floor(t * 8) & 1) ? 1 : 0; ctx.drawImage(miniNalleImg(), Math.round(roam.w.px) - 4 + (dir === 'left' ? -3 : dir === 'right' ? 3 : 0), Math.round(roam.w.py) - 15 + bob); }
    });
    for (const d of folkDrawables(A, t)) add(d.fy, (c) => d.draw(c));
    const carry = (me.gift > t && me.mode !== 'table') || myHold >= 0;
    const sd = selfDrawable(A, walker, t, { carry, folksHere: worldFolksHere(A).length });
    add(walker.py + 0.01, (c) => {
      const gift = me.gift > t && me.mode !== 'table';
      if (gift && walker.dir === 'up') drawGift(c, Math.round(walker.px) - 5, Math.round(walker.py) - 24);
      sd.draw(c);
      if (gift && walker.dir !== 'up') drawGift(c, Math.round(walker.px) - 5 + (walker.dir === 'left' ? -5 : walker.dir === 'right' ? 5 : 0), Math.round(walker.py) - 22);
    });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw(ctx);

    // ---- partiklar ----
    for (const p of parts) {
      if (p.age < 0) continue;
      const k = 1 - p.age / p.max, X = Math.round(p.x), Y = Math.round(p.y);
      if (p.kind === 'heart') { ctx.fillStyle = rgba(0xf0507e, Math.min(1, k * 1.6).toFixed(2)); for (const [a, b] of [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) ctx.fillRect(X + a - 1, Y + b, 1, 1); }
      else if (p.kind === 'glitter') { ctx.fillStyle = (Math.floor(p.age * 20) & 1) ? '#ffffff' : '#fff27a'; ctx.fillRect(X, Y, 1, 1); if (k > 0.5) { ctx.fillRect(X - 1, Y, 3, 1); ctx.fillRect(X, Y - 1, 1, 3); } }
      else if (p.kind === 'puff') { ctx.fillStyle = `rgba(255,255,255,${(k * 0.8).toFixed(2)})`; ctx.fillRect(X, Y, 1, 1); }
      else if (p.kind === 'steam') { ctx.fillStyle = `rgba(255,255,255,${(k * 0.6).toFixed(2)})`; ctx.fillRect(X, Y, p.age < 0.4 ? 1 : 2, 1); }
      else if (p.kind === 'smoke') { ctx.fillStyle = `rgba(250,246,250,${(k * 0.75).toFixed(2)})`; const s = p.age < 0.3 ? 1 : 2; ctx.fillRect(X, Y, s, s); }
    }

    // ---- under taket: lampor, molnskylten, flygplanet ----
    LAMPS.forEach((lx, i) => {
      const L = lampImg[i], sw = Math.round(Math.sin(t * 0.9 + i) * 0.6);
      ctx.fillStyle = '#8a6a7a'; ctx.fillRect(lx, CEIL, 1, 14);
      ctx.drawImage(L.img, lx - L.ox + sw, 36 - L.oy);
    });
    const pa = Math.sin(t * 0.8) * 0.5, px = 612 + Math.round(Math.sin(pa) * 10), py = 44 + Math.round((1 - Math.cos(pa)) * 4);
    ctx.fillStyle = '#8a6a7a'; ctxLine(ctx, 612, CEIL, px, py - 4);
    ctx.drawImage(planeImg.img, px - planeImg.ox, py - planeImg.oy);

    // ---- kvällsljuset ----
    if (night || dark > 0.2) {
      const k = night ? 1 : Math.min(1, (dark - 0.2) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = k;
      ctx.fillStyle = '#7a6a98';
      ctx.fillRect(cx, 0, vw, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.drawImage(nightLight(), 0, 0);
      for (const lx of LAMPS) ctx.drawImage(glows.lamp, lx - 27, 28);
      ctx.globalAlpha = k * (0.6 + 0.4 * Math.sin(t * 3));
      for (let x = 12, n = 0; x < W; x += 19, n++) { ctx.globalAlpha = k * (0.4 + 0.4 * Math.sin(t * 2.4 + n * 1.3)); ctx.drawImage(glows.head, x - 3, CEIL + 3 + Math.round(Math.sin(((x % 100) / 100) * Math.PI) * 5)); }
      ctx.restore();
    }
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() { enterT = 0; },
    exit() {
      for (const ev of ['pointerup', 'pointercancel', 'blur']) window.removeEventListener(ev, onWinUp);
      releaseMine();
      for (const q of tableSq) { q.holders.clear(); try { q.sq.release(); } catch { /* ok */ } }
      talkMe.clear(); talkCash.clear(); talkParent.clear();
      for (const k of kids) k.talk.clear();
      roam.talk.clear();
    },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hoverId = null; peekCam = null;
      if (me.mode === 'toPay') { if (t - me.waitT > 2) { talkMe.say($t('Jag hämtar paketet i kassan först! 🎁'), meAt, 2); me.waitT = t; } return; }
      if (atTable()) {
        const ti = tableTagAt(x, y);
        if (ti >= 0) { releaseMine(); play('click'); openToy(tableSq[ti].id); return; }   // prislappen: köp
        const i = tableSqAt(x, y);
        if (i >= 0) { pressMine(i); return; }
        if (x >= TABLE.x0 && x <= TABLE.x1 && y >= TABLE.top - 4 && y <= TABLE.y) return;   // duken: stå kvar
        me.mode = 'free';
      }
      releaseMine();
      me.toTable = false;
      const h = spotAt(x, y);
      if (h) { if (me.mode === 'table') me.mode = 'free'; goSpot(h, x, y); return; }
      me.mode = 'free';
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    up() { releaseMine(); },
    move(sx, sy) {
      const x = sx + cam.x;
      hoverSq = atTable() && tableTagAt(x, sy) < 0 ? tableSqAt(x, sy) : -1;
      hoverId = hoverSq >= 0 ? 'bord-' + hoverSq : spotAt(x, sy)?.id || null; hoverT = t;
    },
    key(k) { if (k === 'Escape') { walker.stop(); releaseMine(); me.toTable = false; if (me.mode === 'table') me.mode = 'free'; } },
    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      drawWorld(ctx, cx, VW);
      const view = { x0: cx, x1: cx + VW };
      // bara bubblor vars talare syns i bild (ingen röst ur tomma luften vid skärmkanten)
      for (const S of speakers()) if (S.talk.active()) { const p = S.at(); if (p && seenX(p.x, -2)) S.talk.draw(ctx, view); }
      // skylt i nederkanten: vad man pekar på
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      let label = null;
      if (me.mode === 'table') { const q = tableSq[hoverSq]; label = myHold >= 0 ? $t('SLÄPP SÅ STUDSAR DEN!') : q && toyById(q.id) ? $t`${safeTxt(toyName(toyById(q.id)))} - TRYCK OCH HÅLL` : $t('TRYCK OCH HÅLL - PRISLAPPEN = KÖP'); }
      const h = hoverId && t - hoverT < 3 ? spotById(hoverId) : null;
      if (h && !(atTable() && h.id.startsWith('bord-'))) {
        if (h.toy) { const T = toyById(h.toy); if (T) label = h.buy ? $t`KÖP ${safeTxt(toyName(T))} - ${Math.round(T.pris)}:-` : $t`${safeTxt(toyName(T))} - ${Math.round(T.pris)}:-`; if (h.label && baskets.some((b) => 'korg-' + b.i === h.id && b.lid && lidUp(b) < 0.5)) label = h.label; }
        else if (h.label) label = h.label;
      }
      if (label) {
        const safe = globalThis.SF?.view?.safe || { y1: H };
        const by = Math.min(H, safe.y1) - 14, w = textW(SMALL, label) + 10;
        ctx.fillStyle = '#3a2238'; ctx.fillRect((VW - w) >> 1, by, w, 11);
        ctx.fillStyle = '#f890b4'; ctx.fillRect(((VW - w) >> 1) + 1, by + 1, w - 2, 1);
        ctxText(ctx, SMALL, label, ((VW - w) >> 1) + 5, by + 4, '#fff4f8');
      }
      // pilar mot resten av butiken
      if (cx > 60) edgeSign(ctx, true, $t('SQUISHY'), '#f890b4');
      if (cx < W - VW - 60) edgeSign(ctx, false, $t('TÅG + GOSEDJUR'), '#8ad8b4');
    },
    _debug: {
      spot: (id) => {
        const h = spotById(id);
        if (!h) return null;
        const x = (h.r[0] + h.r[2]) / 2, y = (h.r[1] + h.r[3]) / 2;
        if (lockedCam === null && (x - cam.x < 8 || x - cam.x > VW - 8)) { peekCam = clamp(x - VW / 2, 0, W - VW); cam.x = peekCam; }
        return { x: x - cam.x, y };
      },
      squeeze: (i, sek = 0.45) => {
        const q = tableSq[i | 0];
        if (!q) return null;
        holdSq(q.i, 'dbg');
        const until = t + sek;
        const chk = () => { if (t >= until) letGo(q.i, 'dbg'); else setTimeout(chk, 16); };
        setTimeout(chk, 16);
        return { id: q.id, pressed: true };
      },
      press: (i) => { if (tableSq[i | 0]) holdSq(i | 0, 'dbg'); return !!tableSq[i | 0]; },
      release: (i) => { if (tableSq[i | 0]) letGo(i | 0, 'dbg'); return !!tableSq[i | 0]; },
      goTable: () => { walker.px = ME_TABLE[0]; walker.py = ME_TABLE[1]; walker.stop(); me.mode = 'table'; me.toTable = false; walker.dir = 'down'; peekCam = null; cam.x = camTarget(); },
      buy: (id) => { const r = buyToy(id); if (!r.ok && r.poor) { const T = toyById(id); if (T) sayPoor(T); } return r; },
      owned: () => ({ ...toysOf(g) }),
      toys: () => allToys().map((x) => ({ id: x.id, namn: x.namn, pris: x.pris, kategori: x.kategori, squish: !!x.squish })),
      state: () => ({
        me: me.mode, x: Math.round(walker.px), y: Math.round(walker.py), atTable: atTable(), holding: myHold,
        money: g.money, toys: { ...toysOf(g) }, bought: bought.slice(),
        table: tableSq.map((q) => ({ id: q.id, pressed: !!q.sq.pressed, holders: [...q.holders] })),
        baskets: baskets.map((b) => ({ id: b.id, lid: b.lid, up: +lidUp(b).toFixed(2) })),
        kids: kids.map((k) => ({ x: k.x, y: k.y, hold: k.hold, say: k.talk.text() })),
        roam: { x: Math.round(roam.w.px), y: Math.round(roam.w.py), dir: roam.w.dir, toy: 'mini-nalle', say: roam.talk.text() },
        parent: { say: talkParent.text() }, toTable: me.toTable,
        tags: tableSq.map((q) => (q.tag ? { id: q.id, x0: q.tag.x0, y: q.tag.y, w: q.tag.w } : null)),
        // aktiva pratbubblor: text, ankare, om talaren syns och bubblans ruta (världskoordinater)
        bubbles: speakers().filter((S) => S.talk.active()).map((S) => { const p = S.at(); return { text: S.talk.text(), x: Math.round(p.x), y: Math.round(p.y), seen: seenX(p.x, -2), box: bubbleBox(S.talk.text(), p) }; }),
        cashier: { x: Math.round(cashier.x), wrap: cashier.wrapT > 0, say: talkCash.text() }, say: talkMe.text(),
        train: { x: Math.round(trackAt(train.s).x), y: Math.round(trackAt(train.s).y), v: +train.v.toFixed(1) },
        modules: { toys: !!TOYMOD, squish: !!SQMOD }, cam: Math.round(cam.x),
      }),
      open: (id) => openToy(id),
      openKat: (k) => openKat(k),
      lid: (i) => liftLid(i | 0),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); peekCam = null; cam.x = camTarget(); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); releaseMine(); me.toTable = false; if (me.mode === 'table') me.mode = 'free'; peekCam = null; cam.x = camTarget(); },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); },
      // ställ springbarnet på (x, y) och låt det stå kvar (sek sekunder) – för bilder
      roamTo: (x, y, dir = 'down', sek = 30) => { roam.w.px = x; roam.w.py = y; roam.w.stop(); roam.w.dir = dir; roam.wait = sek; return 'mini-nalle'; },
      cam: () => cam.x,
      kidsSay: () => { forceSay(kids[0].talk, kidAt(kids[0]), 'den piper!', 2.2, { voice: kids[0].look }); kids[1].queue = [['mamma, får jag den här?', 3]]; },
      panorama: () => {
        const c = mkCanvas(W, H), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W);
        return c.toDataURL('image/png');
      },
    },
  };
}

// Pil i skärmkanten mot resten av butiken
function edgeSign(ctx, left, lbl, col) {
  const w = textW(SMALL, lbl) + 14, safe = globalThis.SF?.view?.safe || { y1: H };
  const y = Math.min(H, safe.y1) - 26, x = left ? 3 : VW - 3 - w;
  ctx.fillStyle = '#3a2238'; ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, w - 2, 8);
  ctxText(ctx, SMALL, lbl, x + (left ? 9 : 4), y + 3, '#3a2238');
  ctx.fillStyle = '#3a2238';
  const ax = left ? x + 3 : x + w - 5;
  for (let j = -2; j <= 2; j++) ctx.fillRect(ax + (left ? Math.abs(j) : 2 - Math.abs(j)), y + 5 + j, 1, 1);
}
