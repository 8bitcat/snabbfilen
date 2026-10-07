// LEKSAKSKATALOGEN – allt som leksaksaffären säljer, ritat i kod pixel för pixel
// (samma pixelkorn som resten av spelet: inga skalade bilder, ingen utjämning).
//
// Från Carls referensbilder:
//   DUMPLINGS      – pastelldumplings, GLITTERDUMPLINGS (gnistrar) och JULDUMPLINGS med
//                    renhorn, tomteluva, stickad mössa, halsduk, järnekskvist och ljusslinga,
//                    plus den flätade bambukorgen med lock som de bor i (en egen vara).
//   SQUISHY-MAT    – ostkub och osttriangel med hål, smörpaket (SMÖR + smiley), rosa
//                    jordgubbslåda (JORDGUBB), en limpa, ett rosa halvgenomskinligt äpple,
//                    iskub med snöflinga, havskub med snäcka och sjöstjärna och en turkos
//                    glittrig kattass med pärlor.
//   KLÄMKOMPISARNA – åtta EGNA kawaiifigurer (Pösa, Brumme, Lilja, Isa, Glöd, Hoa, Mysan,
//                    Pipp) som små plastfigurer och som klämbara plyschdjur. Inga lånade
//                    figurer – spelet ligger publikt.
//   ANDRA LEKSAKER – nallar i tre storlekar, bilar, tågset, byggklossar, bollar, jojo,
//                    pussel, brädspel, badanka, snurra och dockor.
//
// ============================== API ==============================
// TOYS = [{ id, namn, pris, kategori, squish, beskrivning, grupp, form, w, h, farg }]
//   kategori ∈ 'squishy' | 'figur' | 'plysch' | 'leksak'   (kontraktet)
//   grupp    ∈ 'dumpling' | 'glitter' | 'jul' | 'korg' | 'mat' | 'klamkompis' | 'nalle'
//              | 'bil' | 'tag' | 'klossar' | 'boll' | 'jojo' | 'spel' | 'bad' | 'snurra' | 'docka'
//   w, h     = storleken i vila i spelpixlar (med kontur, utan skugga) – för hyllorna
//   farg     = '#rrggbb' – leksakens huvudfärg (för dialoger/listor)
// toyOf(id) → posten eller null.  KOMPISAR = Klämkompisarnas presentation [{ art, namn, text }]
// drawToy(ctx, id, x, y, t = 0, opts = {})
//   Leksaken i vila. (x, y) = fotpunkten, mitten nertill: leksaken står PÅ raden y
//   (lägsta pixeln i raden y − 1) och en svag skugga läggs i raden y. t = sekunder för
//   små idle-detaljer: glitter som gnistrar, ljusslingan som blinkar, polisbilens blåljus,
//   tågets rök. opts: { size: 1|2|3 (större, ritad om – aldrig uppskalad),
//   levande: true (blinkar ibland, snurran snurrar), skugga: false }
// toyBox(id, size = 1) → { x0, y0, x1, y1 } klickyta relativt fotpunkten (x1/y1 exklusiva)
// toyHit(id, dx, dy, size = 1) → true om pixeln (relativt fotpunkten) täcks av leksaken
// toyFrame(id, steg = 0, ansikte = 'vila', size = 1) → cachad bildruta
//   { c: canvas, x0, y0, w, h, sp, li, mask } – rita med ctx.drawImage(c, x + x0, y + y0).
//   steg −3 … 7 för klämbara (0 = vila, 7 = helt hopklämd, negativa = utsträckt i studsen),
//   ansikte ∈ 'vila' | 'blink' | 'klamd' | 'glad'. sp = glitterpunkter, li = lampor.
// toyFx(ctx, frame, x, y, t, id, gnist = 1) – idle-lagret ovanpå en bildruta (glitter,
//   ljus, rök); squish-motorn (js/core/squish.js) använder samma.
// drawKorg(ctx, x, y, { open = false, part = 'hel', size = 1 }) – bambukorgen
//   open: false = med locket på (varan), true = öppen som i butiken.
//   part (öppen): 'bak' = bakre kanten + insidan, 'fram' = framväggen (ritas ÖVER
//   dumplingen), 'hel' = båda.
// korgSeat(size = 1) → { dx, dy } där en dumplings fotpunkt hamnar i en öppen korg.
// drawToyIKorg(ctx, id, x, y, t = 0, squishy = null, size = 1)
//   En dumpling i en öppen korg (korgens fotpunkt x, y). Ge squishy (createSquishy)
//   för en klämbar – annars ritas leksaken i vila.
// toyIconURL(id, scale = 3) → data-URL med leksaken (heltalsförstorad, för HTML-dialoger
//   med style="image-rendering: pixelated").
// prewarmToy(id, size = 1) → bygger alla bildrutor i förväg (klämbar ≈ 17 ms, 44 rutor).
// KÖPTA LEKSAKER: toyBag(game) → { id: antal } (säker mot omladdning, se nedan),
//   addToy(game, id, n = 1) → nytt antal (sparar), toyCount(game, id) → antal.
//   Skriv INTE "game.toys ??= {}" direkt: game.js läser inte in fältet, så efter en
//   omladdning skulle ett nytt köp skriva över de gamla (testat: tools/out/leksaker-squish/save-test.mjs).
// ==================================================================
import { Pix, SMALL, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t, $n } from '../core/i18n.js';

const WHITE = 0xffffff;
const INK = 0x2b1622;            // ögon och mun
const MOUTH = 0xc23a58;          // munnens insida
const BLUSH = 0xff7c9c;          // rosiga kinder
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = Math.round;
export const SQUISH_STEPS = 7, STRETCH_STEPS = 3;
const SQ = SQUISH_STEPS, ST = STRETCH_STEPS;

// ======================= färger och små målarverktyg =======================
// Fem toner ur en färg: högdager, ljus, bas, skugga (mot lila) och djup skugga.
function tonesOf(c) {
  return {
    hi: mix(c, WHITE, 0.62), li: mix(c, WHITE, 0.3), ba: c,
    sh: mix(mul(c, 0.86), 0x8a70c8, 0.14), dp: mix(mul(c, 0.68), 0x5a3a88, 0.24),
  };
}
// mättade toner för gelé/glitter (mörkare skuggor, lysande kärna)
function tonesGel(c) {
  return {
    hi: mix(c, WHITE, 0.55), li: mix(c, WHITE, 0.25), ba: c,
    sh: mix(mul(c, 0.8), 0x4a2a8a, 0.12), dp: mix(mul(c, 0.58), 0x2a1a5a, 0.22),
  };
}
// ljusvärde → ton, med bayer-dither i övergångarna
function pick(T, L, x, y, dith = 0.14) {
  const v = L + (bayer(x, y) - 0.5) * dith;
  return v > 0.88 ? T.hi : v > 0.66 ? T.li : v > 0.4 ? T.ba : v > 0.2 ? T.sh : T.dp;
}
// färg med lätt brus (tyg, trä, skorpa)
function jit(c, x, y, s = 0, amt = 0.07) {
  const n = (hash(x, y, s) - 0.5) * amt;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
// fn(x, y, nx, ny) för varje pixel i ellipsen – cx = 0 ger en spegelsymmetrisk form
function ellEach(cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny <= 1) fn(x, y, nx, ny);
  }
}
// skuggat klot/ellips (ljus uppifrån vänster)
function ball(P, cx, cy, rx, ry, T, lift = 0, dith = 0.14, tex = 0) {
  ellEach(cx, cy, rx, ry, (x, y, nx, ny) => {
    let c = pick(T, 0.64 - 0.28 * nx - 0.36 * ny + 0.2 * (1 - nx * nx - ny * ny) + lift, x, y, dith);
    if (tex) c = jit(c, x, y, 5, tex);
    P.px(x, y, c);
  });
}
// pixelkarta: en sträng per rad, tecknet slås upp i paletten ('.' = inget)
function blit(P, x, y, rows, pal, mirror = false, a = 1) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const col = pal[r[mirror ? r.length - 1 - i : i]];
      if (col !== undefined) P.px(x + i, y + j, col, a);
    }
  }
}
function alphaAt(P, x, y) {
  const X = Math.floor(x) - P.ox, Y = Math.floor(y) - P.oy;
  if (X < 0 || Y < 0 || X >= P.w || Y >= P.h) return 0;
  return P.d[(Y * P.w + X) * 4 + 3];
}
// Text i spelets 3×5-typsnitt där raderna kan tryckas ihop (5 → 4 → 3 rader) och
// bokstäverna glida isär – så ser ett tryck på en klämd squishy ut i pixelkorn.
const KEEP = { 5: [0, 1, 2, 3, 4], 4: [0, 1, 3, 4], 3: [0, 2, 4], 2: [0, 4] };
function sqTextW(s, sp = 1) { let w = 0; for (const ch of s) w += (SMALL[ch] || SMALL['?']).w + sp; return w - sp; }
function sqText(P, s, x, y, rows, col, sp = 1, upCol = col) {
  const keep = KEEP[clamp(rows, 2, 5)];
  let cx = x;
  for (const ch of s) {
    const G = SMALL[ch] || SMALL['?'];
    keep.forEach((ri, j) => { const row = G.rows[ri]; for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(cx + i, y + j, col); });
    G.up.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(cx + i, y - G.up.length + j, upCol); });
    cx += G.w + sp;
  }
}

// ======================= kawaiiansiktet =======================
// Vänster öga ritas som kartan, höger speglat (> blir <). Ansiktet är symmetriskt kring
// cx (en pixelgräns). ey = ögonens översta rad, gap = avståndet från mitten till ögat.
const F1 = {
  open: ['wk', 'kk'], blink: ['..', 'kk'], glad: ['.k.', 'k.k'], klam: ['kk.', '..k', 'kk.'],
  klamDy: -1, gladDy: 0,
  mVila: ['k..k', '.kk.'], mO: ['kk', 'kk'], mGlad: ['kkkk', '.rr.'],
  mBred: ['k....k', '.kkkk.'], mBredGlad: ['kkkkkk', '.krrk.'],
  mKatt: ['k.kk.k', '.k..k.'],
  blush: ['pp'], blushK: ['ppp'], blushDy: 2,
  nos: ['kk'], nosRosa: ['pp'],
  nabb: ['OO', 'oo'], nabbO: ['OO', 'rr', 'oo'],
  bill: ['.OO.', 'OOOO', 'oooo'], billO: ['.OO.', 'OOOO', 'rrrr', 'oooo'],
};
const F2 = {
  open: ['.kk.', 'kwkk', 'kkgk', '.kk.'], blink: ['....', '....', 'kkkk', '....'], glad: ['.kk.', 'k..k'],
  klam: ['kk..', '.kk.', '..kk', '.kk.', 'kk..'],
  klamDy: 0, gladDy: 1,
  mVila: ['k....k', '.kkkk.'], mO: ['.kk.', 'krrk', 'krrk', '.kk.'], mGlad: ['kkkkkk', 'krrrrk', '.krrk.'],
  mBred: ['k........k', '.kk....kk.', '...kkkk...'], mBredGlad: ['kkkkkkkkkk', '.krrrrrrk.', '..krrrrk..'],
  mKatt: ['k..kk..k', '.kk..kk.'],
  blush: ['.p.p', 'p.p.'], blushK: ['.p.p', 'p.p.', '.p.p'], blushDy: 4,
  nos: ['kkkk', '.kk.'], nosRosa: ['pppp', '.pp.'],
  nabb: ['OOOO', '.oo.'], nabbO: ['OOOO', 'rrrr', '.oo.'],
  bill: ['.OOOO.', 'OOOOOO', 'oooooo'], billO: ['.OOOO.', 'OOOOOO', 'rrrrrr', 'oooooo'],
};
// o: { cx, ink, blush (färg | false), mun: 'u'|'bred'|'katt'|'nabb'|'bill'|'ingen',
//      nos: 'kk'|'rosa'|'ren' (näsa ovanför munnen, munnen flyttas ner), nabbFarg }
function face(c, ey, gap, o = {}) {
  const { P, u } = c, mode = c.face;
  const F = u >= 2 ? F2 : F1, cx = o.cx ?? 0;
  const nb = o.nabbFarg ?? 0xffb030;
  const pal = { k: o.ink ?? INK, w: WHITE, g: 0xd6d0ea, r: o.tongue ?? MOUTH, p: o.blush ?? BLUSH, O: mix(nb, WHITE, 0.25), o: mul(nb, 0.82) };
  const eye = mode === 'klamd' ? F.klam : mode === 'glad' ? F.glad : mode === 'blink' ? F.blink : F.open;
  const ew = eye[0].length, dy = mode === 'klamd' ? F.klamDy : mode === 'glad' ? F.gladDy : 0;
  const mun = o.mun ?? 'u';
  let m = null;
  if (mun === 'nabb') m = mode === 'klamd' || mode === 'glad' ? F.nabbO : F.nabb;
  else if (mun === 'bill') m = mode === 'klamd' || mode === 'glad' ? F.billO : F.bill;
  else if (mun === 'ingen') m = null;
  else if (mode === 'klamd') m = F.mO;
  else if (mun === 'bred') m = mode === 'glad' ? F.mBredGlad : F.mBred;
  else if (mun === 'katt') m = mode === 'glad' ? F.mGlad : F.mKatt;
  else m = mode === 'glad' ? F.mGlad : F.mVila;
  // näsans höjd (renens mule är ett helt litet klot) och munnens rad, räknat från ögonraden
  const nosOn = o.nos && mode !== 'klamd';
  const nosH = !nosOn ? 0 : o.nos === 'ren' ? (u >= 2 ? 2 : 1) * 2 + 1 : (o.nos === 'rosa' ? F.nosRosa : F.nos).length;
  const mRel = mode === 'klamd' && mun !== 'nabb' && mun !== 'bill' ? (u >= 2 ? 1 : 0) + (o.nos ? (u >= 2 ? 2 : 1) : 0) : (u >= 2 ? 3 : 1) + nosH;
  if (o.maxY !== undefined) {
    // som förut, men aldrig så lågt att näsa eller mun hamnar under maxY
    const low = Math.max(dy + eye.length, m ? mRel + m.length : 0);
    // (det klämda ansiktets ögon sitter en rad högre i liten storlek – då räcker en rad mindre)
    ey = Math.min(ey, o.maxY - (u >= 2 ? 5 : mode === 'klamd' ? 1 : 2) - (o.nos && mode !== 'klamd' ? (u >= 2 ? 2 : 1) : 0), o.maxY - low + 1);
  }
  const sym = mode === 'klamd' || mode === 'glad';
  blit(P, cx - gap - ew, ey + dy, eye, pal);
  blit(P, cx + gap, ey + dy, eye, pal, sym);
  // kinderna
  if (o.blush !== false) {
    const bm = mode === 'klamd' ? F.blushK : F.blush, bw = bm[0].length;
    const by = ey + F.blushDy + (mode === 'klamd' && u < 2 ? 0 : 0);
    const a = mode === 'klamd' ? 1 : 0.8;
    const bx = u >= 2 ? gap + 1 : mode === 'klamd' ? gap : gap + 1;
    blit(P, cx - bx - bw, by, bm, pal, false, a);
    blit(P, cx + bx, by, bm, pal, true, a);
  }
  // näsa
  let my = ey + (u >= 2 ? 3 : 1);
  if (nosOn) {
    const nm = o.nos === 'rosa' ? F.nosRosa : F.nos;
    if (o.nos === 'ren') {                           // renens röda mule med glans
      const r = u >= 2 ? 2 : 1;
      ellEach(cx, my + r, r + 0.6, r + 0.4, (x, y, nx, ny) => P.px(x, y, nx < -0.1 && ny < -0.1 ? 0xff8a8a : ny > 0.4 ? 0xa81c2a : 0xe0303a));
      P.px(cx - r, my + (u >= 2 ? 1 : 0), WHITE);
      my += r * 2 + 1;
    } else { blit(P, cx - (nm[0].length >> 1), my, nm, pal); my += nm.length; }
  }
  if (!m) return;
  blit(P, cx - (m[0].length >> 1), ey + mRel, m, pal);
}

// ======================= katalogen =======================
const PASTELL = [
  ['rosa', $n('Rosa dumpling'), 0xffc4d8, $t('Mjuk som en nybakad bulle och lika rosa som en jordgubbsmilkshake.')],
  ['bla', $n('Himmelsblå dumpling'), 0xbcd8ff, $t('Ljusblå och luftig som ett moln. Sjunker ihop när du klämmer och reser sig igen.')],
  ['mint', $n('Mintgrön dumpling'), 0xbdefd2, $t('Frisk som en mintkaramell. Perfekt att klämma på när bussen är sen.')],
  ['lila', $n('Lavendeldumpling'), 0xdcc8ff, $t('Lavendellila och alltid lite sömnig. Somnar nästan i handen.')],
  ['gul', $n('Solgul dumpling'), 0xfff0a4, $t('Solgul och glad – den lyser upp vilken hylla som helst.')],
  ['vit', $n('Vit dumpling'), 0xfbf7f0, $t('Den klassiska ångade dumplingen. Mjukast av dem alla.')],
];
const GLITTER = [
  ['lila', $n('Lila glitterdumpling'), 0xa864ee, 0xffb4f0, $t('Full av lila glitter som gnistrar när du klämmer.')],
  ['gron', $n('Grön glitterdumpling'), 0x3cc46c, 0xeaff86, $t('Skogsgrön gelé med gula glitterflingor.')],
  ['rosa', $n('Rosa glitterdumpling'), 0xff68b6, 0xfff0a6, $t('Knallrosa och glittrig som en discokula.')],
  ['rod', $n('Röd glitterdumpling'), 0xe63a4c, 0xffd276, $t('Röd som ett smultron, med guldglitter i.')],
  ['turkos', $n('Turkos glitterdumpling'), 0x22c6cc, 0xd4fff2, $t('Turkos som en lagun – det glittrar som solkatter.')],
  ['guld', $n('Guldglittrig dumpling'), 0xe8b632, 0xfffbd8, $t('Guld rakt igenom. Den finaste i hela korgen.')],
];
const JUL = [
  ['renhorn', $n('Rendumpling'), 0xe8c69e, $t('Med renhorn och röd mule. Drar tomtens släde – om den orkar.'), 59],
  ['tomteluva', $n('Tomtedumpling'), 0xfbf6ee, $t('Röd tomteluva med vit tofs. God jul, klämmigt!'), 59],
  ['mossa', $n('Mössdumpling'), 0xffd2dc, $t('Stickad mössa med pompom – redo för snöbollskrig.'), 59],
  ['halsduk', $n('Halsduksdumpling'), 0xc8f0dc, $t('Randig stickad halsduk mot vinterkylan.'), 59],
  ['jarnek', $n('Järnekdumpling'), 0xfbf6ee, $t('En järnekskvist med röda bär på toppen.'), 59],
  ['ljusslinga', $n('Ljusslingedumpling'), 0xe4f2c8, $t('Insnurrad i en ljusslinga som blinkar i alla färger.'), 69],
];
// Klämkompisarna – spelets EGNA kawaiifigurer
export const KOMPISAR = [
  { art: 'kanin', id: 'posa', namn: $n('Pösa'), col: 0xd6c2f2, text: $t('Lavendelkanin med ett vikt öra. Älskar morötter och långa tupplurar.') },
  { art: 'bjorn', id: 'brumme', namn: $n('Brumme'), col: 0xe2a462, text: $t('Honungsbjörn med en rutig lapp på magen – där gick han sönder av för mycket kramar.') },
  { art: 'groda', id: 'lilja', namn: $n('Lilja'), col: 0x98dc9a, text: $t('Mintgrön groda med en blomma på huvudet. Bor på ett näckrosblad och hoppar i vattenpölar.') },
  { art: 'pingvin', id: 'isa', namn: $n('Isa'), col: 0x8cbcec, text: $t('Ljusblå pingvin med stickad halsduk. Fryser aldrig.') },
  { art: 'rav', id: 'glod', namn: $n('Glöd'), col: 0xf4944a, text: $t('Nyfiken räv med vit svanstipp. Hittar allt du tappat.') },
  { art: 'uggla', id: 'hoa', namn: $n('Hoa'), col: 0xb48c68, text: $t('Klok uggla som är vaken hela natten och läser serietidningar.') },
  { art: 'katt', id: 'mysan', namn: $n('Mysan'), col: 0xfff2e4, text: $t('Trefärgad katt som spinner när man klämmer henne.') },
  { art: 'anka', id: 'pipp', namn: $n('Pipp'), col: 0xffe064, text: $t('Gul ankunge med ett litet skott på huvudet.') },
];
const hexOf = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');

export const TOYS = [
  // --- dumplings ---
  ...PASTELL.map(([k, namn, col, b]) => ({ id: 'dumpling-' + k, namn, pris: 39, kategori: 'squishy', squish: true, grupp: 'dumpling', form: 'dumpling', bw: 18, bh: 13, o: { col }, beskrivning: b })),
  ...GLITTER.map(([k, namn, col, acc2, b]) => ({ id: 'glitter-' + k, namn, pris: k === 'guld' ? 59 : 49, kategori: 'squishy', squish: true, grupp: 'glitter', form: 'dumpling', bw: 18, bh: 13, o: { col, glitter: true, acc2, seed: namn.length * 7 }, beskrivning: b })),
  ...JUL.map(([k, namn, col, b, pris]) => ({ id: 'jul-' + k, namn, pris, kategori: 'squishy', squish: true, grupp: 'jul', form: 'dumpling', bw: 18, bh: 13, o: { col, acc: k }, beskrivning: b })),
  { id: 'korg', namn: $n('Bambukorg med lock'), pris: 45, kategori: 'squishy', squish: false, grupp: 'korg', form: 'korg', bw: 24, bh: 16, o: {}, beskrivning: $t('Flätad ångkorg av bambu med lock – ett mysigt hem åt dina dumplings.') },
  // --- squishy-mat ---
  { id: 'ostkub', namn: $n('Ostkub'), pris: 45, kategori: 'squishy', squish: true, grupp: 'mat', form: 'cube', cube: 3, bw: 15, bh: 14, syMin: 0.62, o: { typ: 'ost' }, beskrivning: $t('En gul ostbit med hål. Luktar inte ost – det lovar vi.') },
  { id: 'osttriangel', namn: $n('Osttriangel'), pris: 45, kategori: 'squishy', squish: true, grupp: 'mat', form: 'wedge', cube: 3, bw: 21, bh: 13, o: {}, beskrivning: $t('En ostbit som en tårtbit. Klämmig ända ut i spetsen.') },
  { id: 'smor', namn: $n('Smörpaket'), pris: 49, kategori: 'squishy', squish: true, grupp: 'mat', form: 'cube', cube: 3, bw: 27, bh: 15, syMin: 0.72, o: { typ: 'smor' }, beskrivning: $t('Mjukt som smör – för det ÄR smör. Nästan.') },
  { id: 'jordgubbslada', namn: $n('Jordgubbslåda'), pris: 55, kategori: 'squishy', squish: true, grupp: 'mat', form: 'carton', cube: 3, bw: 21, bh: 27, syMin: 0.74, o: {}, beskrivning: $t('Rosa låda med jordgubbsmjölk. Luktar faktiskt jordgubb!') },
  { id: 'brodlimpa', namn: $n('Brödlimpa'), pris: 49, kategori: 'squishy', squish: true, grupp: 'mat', form: 'brod', bw: 24, bh: 12, o: {}, beskrivning: $t('Nybakad limpa med knaprig skorpa – ändå mjuk som en kudde.') },
  { id: 'appel', namn: $n('Rosa äpple'), pris: 49, kategori: 'squishy', squish: true, grupp: 'mat', form: 'appel', bw: 16, bh: 15, o: {}, beskrivning: $t('Halvgenomskinligt rosa äpple – solen lyser rakt igenom.') },
  { id: 'iskub', namn: $n('Iskub'), pris: 45, kategori: 'squishy', squish: true, grupp: 'mat', form: 'cube', cube: 3, bw: 15, bh: 15, syMin: 0.62, o: { typ: 'is' }, beskrivning: $t('Kall och klar som is, med en snöflinga fångad inuti.') },
  { id: 'havskub', namn: $n('Havskub'), pris: 55, kategori: 'squishy', squish: true, grupp: 'mat', form: 'cube', cube: 3, bw: 17, bh: 16, syMin: 0.62, o: { typ: 'hav' }, beskrivning: $t('En bit av havet: snäcka, sjöstjärna och sand i en kub.') },
  { id: 'kattass', namn: $n('Glitterkattass'), pris: 59, kategori: 'squishy', squish: true, grupp: 'mat', form: 'kattass', bw: 20, bh: 15, o: { col: 0x34ccc4, acc2: 0xd8fff8, seed: 41 }, beskrivning: $t('En turkos glittrig kattrumpa med pärlor inuti. Kläm – svansen reser sig!') },
  // --- Klämkompisarna ---
  ...KOMPISAR.flatMap((K) => [
    { id: 'figur-' + K.id, namn: K.namn + '-figur', pris: 29, kategori: 'figur', squish: false, grupp: 'klamkompis', form: 'kompis', bw: 14, bh: 14, o: { art: K.art, stil: 'figur' }, kompis: K.namn, beskrivning: $t`Klämkompisarna: ${K.text} Liten figur i blank plast.` },
    { id: 'plysch-' + K.id, namn: K.namn + '-plysch', pris: 99, kategori: 'plysch', squish: true, grupp: 'klamkompis', form: 'kompis', bw: 18, bh: 18, syMin: 0.66, o: { art: K.art, stil: 'plysch' }, kompis: K.namn, beskrivning: $t`Klämkompisarna: ${K.text} Mjukt plyschdjur – kläm så blir hen glad.` },
  ]),
  // --- andra leksaker ---
  { id: 'nalle-liten', namn: $n('Liten nalle'), pris: 79, kategori: 'plysch', squish: false, grupp: 'nalle', form: 'nalle', bw: 12, bh: 15, o: { s: 0 }, beskrivning: $t('En liten honungsnalle med röd rosett. Får plats i fickan.') },
  { id: 'nalle-mellan', namn: $n('Mellannalle'), pris: 149, kategori: 'plysch', squish: false, grupp: 'nalle', form: 'nalle', bw: 16, bh: 20, o: { s: 1 }, beskrivning: $t('Brun nalle med blå rosett och trampdynor under fötterna.') },
  { id: 'nalle-stor', namn: $n('Stor nalle'), pris: 249, kategori: 'plysch', squish: false, grupp: 'nalle', form: 'nalle', bw: 22, bh: 27, o: { s: 2 }, beskrivning: $t('Jättenalle i ljus kola med rutig rosett. Kramas bäst av alla.') },
  { id: 'bil-racer', namn: $n('Racerbil'), pris: 49, kategori: 'leksak', squish: false, grupp: 'bil', form: 'bil', bw: 24, bh: 11, o: { typ: 'racer' }, beskrivning: $t('Röd racerbil med nummer 7 och spoiler. Brum brum!') },
  { id: 'bil-polis', namn: $n('Polisbil'), pris: 59, kategori: 'leksak', squish: false, grupp: 'bil', form: 'bil', bw: 24, bh: 13, o: { typ: 'polis' }, beskrivning: $t('Polisbil med blåljus som blinkar på riktigt.') },
  { id: 'bil-brand', namn: $n('Brandbil'), pris: 69, kategori: 'leksak', squish: false, grupp: 'bil', form: 'bil', bw: 30, bh: 14, o: { typ: 'brand' }, beskrivning: $t('Brandbil med stege på taket. Tuut-tuut!') },
  { id: 'tagset', namn: $n('Tågset'), pris: 299, kategori: 'leksak', squish: false, grupp: 'tag', form: 'tag', bw: 44, bh: 16, o: {}, beskrivning: $t('Ånglok och godsvagn i trä på en bit räls. Loket puffar rök.') },
  { id: 'klossar', namn: $n('Byggklossar'), pris: 89, kategori: 'leksak', squish: false, grupp: 'klossar', form: 'klossar', bw: 20, bh: 20, o: {}, beskrivning: $t('Klossar i trä med A, B och C – och ett rött tak ovanpå.') },
  { id: 'boll-bad', namn: $n('Badboll'), pris: 35, kategori: 'leksak', squish: false, grupp: 'boll', form: 'boll', bw: 12, bh: 12, o: { typ: 'bad' }, beskrivning: $t('Randig badboll för stranden – eller vardagsrummet.') },
  { id: 'boll-fot', namn: $n('Fotboll'), pris: 59, kategori: 'leksak', squish: false, grupp: 'boll', form: 'boll', bw: 12, bh: 12, o: { typ: 'fot' }, beskrivning: $t('En riktig fotboll. Mål!') },
  { id: 'boll-studs', namn: $n('Studsboll'), pris: 15, kategori: 'leksak', squish: false, grupp: 'boll', form: 'boll', bw: 6, bh: 6, o: { typ: 'studs' }, beskrivning: $t('Liten glittrig studsboll som studsar ända upp till taket.') },
  { id: 'jojo', namn: $n('Jojo'), pris: 29, kategori: 'leksak', squish: false, grupp: 'jojo', form: 'jojo', bw: 10, bh: 15, o: {}, beskrivning: $t('Röd jojo med stjärna. Kan du gå med hunden?') },
  { id: 'pussel', namn: $n('Pussel 500 bitar'), pris: 79, kategori: 'leksak', squish: false, grupp: 'spel', form: 'pussel', bw: 24, bh: 18, o: {}, beskrivning: $t('Femhundra bitar: en stuga vid sjön i solnedgång.') },
  { id: 'bradspel', namn: $n('Fia med knuff'), pris: 149, kategori: 'leksak', squish: false, grupp: 'spel', form: 'fia', bw: 24, bh: 19, o: {}, beskrivning: $t('Klassiskt brädspel för 2–4. Knuffa hem pjäserna!') },
  { id: 'badanka', namn: $n('Badanka'), pris: 25, kategori: 'leksak', squish: false, grupp: 'bad', form: 'anka', bw: 12, bh: 10, o: {}, beskrivning: $t('Gul badanka som flyter och piper.') },
  { id: 'snurra', namn: $n('Snurra'), pris: 35, kategori: 'leksak', squish: false, grupp: 'snurra', form: 'snurra', bw: 12, bh: 15, o: {}, beskrivning: $t('Randig snurra i trä. Snurrar i en hel minut!') },
  { id: 'docka', namn: $n('Docka'), pris: 129, kategori: 'leksak', squish: false, grupp: 'docka', form: 'docka', bw: 12, bh: 24, o: { typ: 'flicka' }, beskrivning: $t('Docka med garnflätor och prickig klänning.') },
  { id: 'docka-bebis', namn: $n('Bebisdocka'), pris: 149, kategori: 'leksak', squish: false, grupp: 'docka', form: 'docka', bw: 14, bh: 17, o: { typ: 'bebis' }, beskrivning: $t('Sovande bebis i rosa filt, med napp och spetsmössa.') },
];
const BY_ID = new Map(TOYS.map((t) => [t.id, t]));
export const toyOf = (id) => BY_ID.get(id) || null;
// Namnet på spelarens språk. namn/kompis är svenska ($n) eftersom leksaksaffären söker i dem
// (DUMP_RE, glitterOf); Klämkompisarnas varor blir "<kompisens lokala namn>-figur/-plysch".
export const toyNamn = (T) => (!T ? '' : T.kompis ? (T.kategori === 'figur' ? $t`${$t(T.kompis)}-figur` : $t`${$t(T.kompis)}-plysch`) : $t(T.namn));

// ======================= köpta leksaker i sparfilen =======================
// Game.load() i js/game.js känner inte till fältet 'toys': efter en omladdning ligger det i
// game._keep.top.toys (orört) och game.toys saknas. Skulle en scen då köra
// "A.game.toys ??= {}" och spara, skriver den TOMMA samlingen över den gamla (köpen försvinner).
// toyBag() hämtar tillbaka det sparade först – använd den i stället för att röra game.toys direkt.
// (Fungerar också när game.js en dag läser in toys själv.)
export function toyBag(g) {
  if (!g) return {};
  if (!g.toys || typeof g.toys !== 'object') {
    const kept = g._keep?.top?.toys;
    g.toys = kept && typeof kept === 'object' ? { ...kept } : {};
    if (g._keep?.top) delete g._keep.top.toys;
  }
  return g.toys;
}
export const toyCount = (g, id) => Math.max(0, toyBag(g)[id] | 0);
export function addToy(g, id, n = 1) {
  const b = toyBag(g);
  b[id] = Math.max(0, (b[id] | 0) + (n | 0));
  if (!b[id]) delete b[id];
  g?.save?.();
  return b[id] | 0;
}

// ======================= bildrutor (cache) =======================
const FR = new Map();
// former med kawaiiansikte (får blinka i drawToy med opts.levande)
const FACE_FORMS = new Set(['dumpling', 'cube', 'wedge', 'carton', 'brod', 'appel', 'kompis']);
// Bygg alla bildrutor för en leksak i förväg (t.ex. i scenens enter()), så att första
// klämningen inte hackar. Klämbara: 11 steg × 4 ansikten; övriga: vilobilden.
export function prewarmToy(id, size = 1) {
  const def = BY_ID.get(id);
  if (!def) return 0;
  let n = 0;
  if (!def.squish) { toyFrame(id, 0, 'vila', size); return 1; }
  for (let k = -ST; k <= SQ; k++) for (const f of ['vila', 'blink', 'klamd', 'glad']) { toyFrame(id, k, f, size); n++; }
  return n;
}
// Klämd (k > 0): lägre och bredare – ner till def.syMin av höjden (standard 55 %).
// Utsträckt (k < 0): smalare och högre.
function dimsOf(def, k, u) {
  const lo = def.syMin ?? 0.55;
  const sy = k >= 0 ? 1 - (1 - lo) * k / SQ : 1 - 0.064 * k;
  const sx = k >= 0 ? 1 + 0.35 * ((1 - lo) / 0.45) * k / SQ : 1 + 0.05 * k;   // mindre hopklämd → mindre bred
  const par = def.cube ? (def.cube * u) & 1 : 0;      // kuber: framsidan jämn → symmetriskt ansikte
  const W = Math.max(4, R((def.bw * u * sx - par) / 2) * 2 + par);
  const H = Math.max(4, R(def.bh * u * sy));
  return { W, H };
}
// mörk kontur runt allt som är målat (tonad efter grannen, ljusare ovanpå saker)
function outline(P, dark = 0x2e1a2c, amt = 0.3, minA = 90) {
  const { w, h, d } = P, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3] >= minA) continue;
    let best = -1, below = false;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] >= minA) { best = j; below = dy === 1; break; }
    }
    if (best < 0) continue;
    const nb = (src[best] << 16) | (src[best + 1] << 8) | src[best + 2];
    let o = mix(dark, nb, amt);
    if (below) o = mix(o, nb, 0.14);           // ovankanten lite ljusare (ljuset kommer uppifrån)
    d[i] = (o >> 16) & 255; d[i + 1] = (o >> 8) & 255; d[i + 2] = o & 255; d[i + 3] = 255;
  }
}
// svag skugga i raden y = 0 under allt som når ner till y = −1
function dropShadow(P) {
  let x0 = 1e9, x1 = -1e9;
  for (let x = -P.w; x < P.w; x++) if (alphaAt(P, x, -1) > 100) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  if (x1 < x0) return;
  for (let x = x0 + 1; x < x1; x++) P.px(x, 0, 0x1a0e18, 0.22);
  if (x1 - x0 > 6) { P.px(x0, 0, 0x1a0e18, 0.1); P.px(x1, 0, 0x1a0e18, 0.1); }
}
function crop(P, c) {
  P.flush();
  let bx0 = P.w, by0 = P.h, bx1 = -1, by1 = -1;
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.d[(y * P.w + x) * 4 + 3]) {
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  if (bx1 < 0) { bx0 = by0 = 0; bx1 = by1 = 0; }
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(P.canvas, bx0, by0, w, h, 0, 0, w, h);
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = P.d[((y + by0) * P.w + x + bx0) * 4 + 3] > 120 ? 1 : 0;
  return { c: cv, x0: bx0 + P.ox, y0: by0 + P.oy, w, h, sp: c.sp, li: c.li, mask, W: c.W, H: c.H, meta: c.meta || null };
}
function buildFrame(def, k, face, u) {
  const { W, H } = dimsOf(def, k, u);
  const PW = W + 2 * (14 * u + 6), PT = H + 22 * u + 8, PB = 3;
  const P = new Pix(PW + (PW & 1), PT + PB, -((PW + (PW & 1)) >> 1), -PT);
  const c = { P, W, H, k, q: k / SQ, u, face, sp: [], li: [], o: def.o || {}, def, after: [], outline: true, shadow: true };
  FORMS[def.form](c);
  if (c.outline) outline(P, c.olDark ?? 0x2e1a2c, c.olAmt ?? 0.3);
  for (const fn of c.after) fn(P);
  if (c.shadow) dropShadow(P);
  return crop(P, c);
}
export function toyFrame(id, step = 0, face = 'vila', size = 1) {
  const def = BY_ID.get(id);
  if (!def) return null;
  const k = def.squish ? clamp(step | 0, -ST, SQ) : 0;
  const u = clamp(size | 0 || 1, 1, 4);
  const key = id + '|' + k + '|' + face + '|' + u;
  let f = FR.get(key);
  if (!f) { f = buildFrame(def, k, face, u); FR.set(key, f); }
  return f;
}
export function toyBox(id, size = 1) {
  const f = toyFrame(id, 0, 'vila', size);
  return f ? { x0: f.x0, y0: f.y0, x1: f.x0 + f.w, y1: f.y0 + f.h - 1 } : { x0: -6, y0: -12, x1: 6, y1: 0 };
}
export function toyHit(id, dx, dy, size = 1) {
  const f = toyFrame(id, 0, 'vila', size);
  if (!f) return false;
  const x = Math.floor(dx) - f.x0, y = Math.floor(dy) - f.y0;
  return x >= 0 && y >= 0 && x < f.w && y < f.h && !!f.mask[y * f.w + x];
}
// storleken i vila (med kontur, utan skuggraden) – räknas fram en gång
for (const t of TOYS) {
  t.farg = hexOf(t.o.col ?? { ostkub: 0xffd24a, osttriangel: 0xffd24a, smor: 0xfff0a0, jordgubbslada: 0xffa8c8, brodlimpa: 0xd89048, appel: 0xff9ec0, iskub: 0xc4ecff, havskub: 0x6ad8e0, korg: 0xd8aa5e }[t.id] ?? KOMPISAR.find((K) => K.art === t.o.art)?.col ?? { nalle: 0xa86c3a, bil: 0xe8303a, tag: 0xd84a3a, klossar: 0x3a7bd5, boll: 0xf0c040, jojo: 0xe8303a, spel: 0x46a35a, bad: 0xffd23a, snurra: 0xe8603a, docka: 0xff9ec0 }[t.grupp] ?? 0x888888);
  Object.defineProperty(t, 'w', { enumerable: true, configurable: true, get() { const b = toyBox(t.id); return b.x1 - b.x0; } });
  Object.defineProperty(t, 'h', { enumerable: true, configurable: true, get() { const b = toyBox(t.id); return b.y1 - b.y0; } });
}

// ======================= idle-lagret (glitter, ljus, rök) =======================
const LIGHT = [0xff4a5a, 0xffd23a, 0x5ae06a, 0x4aa8ff, 0xff7ad8];
function dot(ctx, x, y, col, a = 1) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
export function toyFx(ctx, f, x, y, t, id, gnist = 1) {
  if (!f) return;
  ctx.save();
  // glitterflingor som blixtrar till (fler och starkare när man klämmer: gnist > 1)
  for (const p of f.sp) {
    const ph = (t * (0.45 + p.r * 0.8) * gnist + p.r * 17.3) % 1;
    const len = 0.1 * Math.min(2, gnist);
    if (ph > len) continue;
    const a = 1 - ph / len, X = x + p.x, Y = y + p.y;
    dot(ctx, X, Y, '#ffffff', a);
    if (p.r > 0.72 && a > 0.4) {                       // de största blir små korsstjärnor
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(ctx, X + dx, Y + dy, '#fffbe8', a * 0.55);
    }
  }
  // lampor: ljusslingan (jagar runt), polisbilens blåljus
  for (let i = 0; i < f.li.length; i++) {
    const L = f.li[i];
    if (L.k === 'ljus') {
      const on = (i + Math.floor(t * 3)) % 3 !== 0;
      if (!on) continue;
      const cs = hexOf(L.c), s = L.s || 1, X = x + L.x, Y = y + L.y;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) dot(ctx, X + i, Y + j, cs, 1);
      if (s > 1) dot(ctx, X, Y, '#ffffff', 0.85);
      for (let k = 0; k < s; k++) { dot(ctx, X - 1, Y + k, cs, 0.3); dot(ctx, X + s, Y + k, cs, 0.3); dot(ctx, X + k, Y - 1, cs, 0.3); dot(ctx, X + k, Y + s, cs, 0.3); }
    } else if (L.k === 'bla' || L.k === 'rod') {
      const on = (Math.floor(t * 4) & 1) === (L.k === 'bla' ? 0 : 1);
      if (!on) continue;
      const cs = L.k === 'bla' ? '#8ad0ff' : '#ff8a8a';
      for (let j = 0; j < (L.w || 1); j++) dot(ctx, x + L.x + j, y + L.y, cs, 1);
      for (let j = -1; j <= (L.w || 1); j++) dot(ctx, x + L.x + j, y + L.y - 1, cs, 0.35);
    } else if (L.k === 'rok') {                        // tågets rökpuffar
      for (let n = 0; n < 3; n++) {
        const ph = (t * 0.7 + n / 3) % 1, r = ph < 0.35 ? 1 : 2;
        const X = x + L.x + Math.round(ph * -4), Y = y + L.y - Math.round(ph * 9);
        const a = 0.75 * (1 - ph);
        for (let dy = -r + 1; dy < r; dy++) for (let dx = -r + 1; dx < r; dx++) if (Math.abs(dx) + Math.abs(dy) < r + (r > 1 ? 1 : 0)) dot(ctx, X + dx, Y + dy, '#f4f4f8', a);
      }
    }
  }
  ctx.restore();
}
export function drawToy(ctx, id, x, y, t = 0, opts = {}) {
  const def = BY_ID.get(id);
  if (!def) return;
  const u = opts.size || 1;
  let face = 'vila';
  if (def.form === 'snurra') face = opts.levande ? 'r' + (Math.floor(t * 12) & 3) : 'r0';
  else if (opts.levande && FACE_FORMS.has(def.form)) {
    const ph = (t + hash(x | 0, y | 0, 3) * 5) % 5;    // blinkar en gång var femte sekund
    if (ph < 0.14) face = 'blink';
  }
  const f = toyFrame(id, 0, face, u);
  x = Math.round(x); y = Math.round(y);
  if (opts.skugga === false) {                         // bara raderna ovanför fotpunkten
    const hh = Math.min(f.h, -f.y0);
    if (hh > 0) ctx.drawImage(f.c, 0, 0, f.w, hh, x + f.x0, y + f.y0, f.w, hh);
  } else ctx.drawImage(f.c, x + f.x0, y + f.y0);
  toyFx(ctx, f, x, y, t, id);
}
export function toyIconURL(id, scale = 3) {
  const f = toyFrame(id, 0, 'vila', 1);
  if (!f) return '';
  const cv = document.createElement('canvas');
  cv.width = f.w * scale; cv.height = f.h * scale;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(f.c, 0, 0, f.w * scale, f.h * scale);
  return cv.toDataURL('image/png');
}

// ======================= DUMPLINGEN =======================
// Kupolen beskrivs av halvbredden per rad. Klämd: lägre, bredare, plattare topp och
// buken glider nedåt. Utsträckt (studsen): smalare och högre.
// knutens höjd i steg k (krymper när dumplingen kläms, växer lite i studsen)
function knotOf(k, u) {
  const q = k / SQ, qq = Math.max(0, q), st = Math.max(0, -q) / (ST / SQ);
  return Math.max(1, R((2 - 1.1 * qq + 0.4 * st) * u));
}
function dumplingShape(c) {
  const { W, H, q, u } = c;
  const qq = Math.max(0, q), st = Math.max(0, -q) / (ST / SQ);
  // Kupolen får aldrig bli högre i ett senare steg: när knuten krymper utan att hela
  // dumplingen blir lägre skulle kupolen (och hatten, hornen, mössan som sitter på den)
  // annars hoppa upp en pixel mitt i klämningen. Knuten behåller då sin höjd ett steg till.
  let domeH = Infinity;
  for (let j = -ST; j <= c.k; j++) domeH = Math.min(domeH, dimsOf(c.def, j, u).H - knotOf(j, u));
  const knot = H - domeH, half = W / 2;
  const tb = 0.58 + 0.24 * qq - 0.08 * st, p = 2.6 + 1.2 * qq - 0.5 * st;
  const rows = [];
  for (let j = 0; j < domeH; j++) {
    const t = (j + 0.5) / domeH;
    let r;
    if (t < tb) { const a = (tb - t) / tb; r = Math.pow(Math.max(0, 1 - Math.pow(a, p)), 1 / p); }
    else { const b = (t - tb) / (1 - tb); r = 1 - 0.06 * b * b - 0.12 * Math.pow(b, 8); }
    rows.push(Math.max(2 * u + 1, R(half * r)));
  }
  const bot = -2, domeTop = bot - domeH + 1;
  c.meta = { domeTop, knot };                         // för testerna (toyFrame(...).meta)
  return { rows, knot, domeH, half, bot, domeTop, top: domeTop - knot, qq, st, hwAt: (y) => rows[clamp(y - domeTop, 0, domeH - 1)] };
}
function paintDumpling(c) {
  const { P, u, o } = c;
  const g = dumplingShape(c);
  const { rows, knot, domeH, half, domeTop, top, qq } = g;
  const T = o.glitter ? tonesGel(o.col) : tonesOf(o.col);
  const inBody = (x, y) => y >= domeTop && y <= g.bot && x >= -g.hwAt(y) && x < g.hwAt(y);
  const hat = o.acc === 'tomteluva' || o.acc === 'mossa';
  // kroppen
  for (let j = 0; j < domeH; j++) {
    const hw = rows[j], y = domeTop + j, v = j / Math.max(1, domeH - 1);
    for (let x = -hw; x < hw; x++) {
      const nx = (x + 0.5) / hw;
      let L = 0.62 - 0.3 * nx - 0.46 * v + 0.26 * (1 - nx * nx);
      if (j < u) L += 0.06;
      if (j >= domeH - u) L -= 0.1;
      if (o.glitter) L += 0.2 * Math.max(0, 1 - Math.hypot(nx * 0.9, (v - 0.55) * 2.2));
      let col = pick(T, L, x, y, 0.07);
      if (x === hw - 1 && v > 0.3 && v < 0.9) col = mix(col, T.li, 0.35);   // reflex i högerkanten
      if (o.glitter) {
        const h = hash(x * 3 + 17, y * 5 + 3, o.seed);
        if (h > 0.86) {
          col = h > 0.975 ? WHITE : h > 0.93 ? T.hi : mix(o.acc2, col, 0.3);
          if (h > 0.93) c.sp.push({ x, y, r: hash(x, y, 99) });
        }
      }
      P.px(x, y, col);
    }
  }
  // vecken som vrids upp mot knuten
  if (!hat) {
    // vecken: raka pixellinjer från knuten ut mot sidorna, lite vridna (som en snurrad topp)
    const dirs = u >= 2 ? [-1, -0.6, -0.2, 0.2, 0.6, 1] : [-1, -0.4, 0.4, 1];
    const span = Math.max(2, R(domeH * (0.42 - 0.14 * qq)));
    const set = new Set(), pts = [];
    for (const d of dirs) {
      const y1 = domeTop + span - (Math.abs(d) < 0.5 ? 1 : 0), hw = g.hwAt(y1);
      const x0 = d * 0.9 * u - 0.5, x1 = d * hw * (Math.abs(d) < 0.5 ? 0.42 : 0.78) + 0.8 * u - 0.5;
      const n = Math.max(1, (y1 - domeTop) * 4);
      for (let i = 0; i <= n; i++) {
        const s = i / n, x = R(x0 + (x1 - x0) * Math.pow(s, 0.8)), y = domeTop + R(s * (y1 - domeTop));
        const key = x + ',' + y;
        if (!set.has(key)) { set.add(key); pts.push([x, y]); }
      }
    }
    for (const [x, y] of pts) if (inBody(x - 1, y) && !set.has((x - 1) + ',' + y)) P.px(x - 1, y, T.hi);
    for (const [x, y] of pts) if (inBody(x, y)) P.px(x, y, T.sh);
  }
  // knuten överst
  for (let j = 0; j < knot; j++) {
    const y = top + j, hw = j === knot - 1 && knot > 1 ? 2 * u : u;
    for (let x = -hw; x < hw; x++) P.px(x, y, x < -u / 2 ? T.li : x < u / 2 ? T.ba : T.sh);
  }
  P.px(-1, top, T.hi);
  // glans
  const gx = R(-half * 0.52), gy = domeTop + Math.max(1, R(domeH * 0.24));
  if (!hat || o.acc === 'tomteluva') {
    if (inBody(gx, gy)) P.px(gx, gy, WHITE);
    if (inBody(gx + 1, gy - 1)) P.px(gx + 1, gy - 1, WHITE);
    if (u >= 2) { if (inBody(gx, gy + 1)) P.px(gx, gy + 1, WHITE); if (inBody(gx + 2, gy - 2)) P.px(gx + 2, gy - 2, T.hi); }
  }
  // tillbehör och ansikte
  let ey = domeTop + R(domeH * 0.5) - (u >= 2 ? 1 : 0), fo = {};
  if (o.glitter) fo.blush = mix(BLUSH, WHITE, 0.3);
  if (o.col === 0xffc4d8 || o.col === 0xffd2dc) fo.blush = 0xf0507e;
  if (o.acc) ey = ACC[o.acc](c, g, T, ey, fo) ?? ey;
  fo.maxY = c.faceMaxY ?? g.bot - 1;
  face(c, ey, Math.max(u + 1, R(half * 0.34)), fo);
  if (o.acc && ACC_AFTER[o.acc]) ACC_AFTER[o.acc](c, g);
}
// Juldumplingarnas tillbehör – ritas i dumplingens form (klämd hatt blir bredare/lägre).
// Returnerar ev. ny ögonrad.
const ACC = {
  renhorn(c, g, T, ey, fo) {
    const { P, u } = c;
    const B = { a: 0x8a5a30, b: 0xb88450, c: 0xdcae72 };
    // öron åt sidorna
    for (const s of [-1, 1]) {
      const ex = s * (g.half * 0.78), eyy = g.domeTop + 2 * u;
      ellEach(ex, eyy, 2.2 * u, 1.1 * u + 0.2, (x, y, nx) => P.px(x, y, s * nx > 0.2 ? T.sh : T.li));
      P.px(Math.floor(ex), eyy, 0xf8a8b8);
    }
    // hornen: stam upp och utåt med två taggar
    const hgt = (5.5 - 1.5 * g.qq) * u;
    for (const s of [-1, 1]) {
      const bx = s * g.half * 0.36, by = g.domeTop + u * 0.6;
      const L = (x0, y0, x1, y1, col) => {
        const n = Math.max(1, R(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
        for (let i = 0; i <= n; i++) { const t = i / n; const X = x0 + (x1 - x0) * t, Y = y0 + (y1 - y0) * t; P.px(s < 0 ? Math.floor(X) : Math.floor(X), Math.floor(Y), col); if (u >= 2) P.px(Math.floor(X) + 1, Math.floor(Y), col === B.c ? B.b : B.a); }
      };
      const tx = bx + s * 1.6 * u, ty = by - hgt;
      L(bx, by, tx, ty, B.b);
      L(bx + s * 0.6 * u, by - hgt * 0.45, bx - s * 1.4 * u, by - hgt * 0.8, B.b);    // inre tagg
      L(tx, ty + 1.2 * u, tx + s * 1.8 * u, ty - 0.2 * u, B.b);                         // yttre tagg
      P.px(Math.floor(tx), Math.floor(ty), B.c); P.px(Math.floor(bx - s * 1.4 * u), Math.floor(by - hgt * 0.8), B.c);
    }
    fo.nos = 'ren';
    return ey - u;
  },
  tomteluva(c, g, T, ey) {
    const { P, u } = c;
    const RED = { li: 0xf05060, ba: 0xd42a3c, sh: 0xa01c30, dp: 0x78142a };
    const brimY = g.domeTop + u, bh = 2 * u;
    // spetsen: smalnar av uppåt och viker sig åt höger
    const hh = R((7 - 2.5 * g.qq) * u), w0 = g.hwAt(brimY) - u;
    let tipX = 0, tipY = brimY - hh;
    for (let i = 0; i < hh; i++) {
      const y = brimY - 1 - i, f = 1 - i / hh, bend = Math.pow(i / hh, 2) * 5 * u;
      const xl = R(-w0 * f + bend), xr = R(w0 * f + bend * 1.25);
      for (let x = xl; x < Math.max(xl + 1, xr); x++) {
        const t = (x - xl) / Math.max(1, xr - xl);
        P.px(x, y, t < 0.3 ? RED.li : t < 0.75 ? RED.ba : RED.sh);
      }
      if (i === hh - 1) { tipX = Math.max(xl + 1, xr); tipY = y; }
    }
    // hängande spets och tofs
    for (let i = 0; i < 2 * u; i++) P.px(tipX + i - u, tipY + (i >> 1), RED.sh);
    const px = tipX + u, py = tipY + 2 * u;
    ellEach(px, py, 1.9 * u + 0.2, 1.9 * u + 0.2, (x, y, nx, ny) => P.px(x, y, nx + ny < -0.4 ? WHITE : hash(x, y, 8) > 0.6 ? 0xdcd6e6 : 0xf4f0f8));
    // vit pälskant
    for (let j = 0; j < bh; j++) {
      const y = brimY - (j === 0 ? 0 : 0) + j - 1, hw = g.hwAt(Math.max(g.domeTop, y)) + (j < bh - 1 ? 1 : 0);
      for (let x = -hw; x < hw; x++) {
        const h = hash(x, y, 12);
        P.px(x, y, j === 0 && h > 0.55 ? WHITE : h > 0.72 ? 0xd8d2e4 : x > hw - 3 ? 0xe4e0ee : 0xfaf8fc);
      }
    }
    return ey + (g.qq > 0.6 ? 0 : 0);
  },
  mossa(c, g, T, ey) {
    const { P, u } = c;
    const K = { hi: 0x8ab4f0, a: 0x5a86d8, b: 0x4a74c8, c: 0x3456a0 };
    // mössan sitter en pixel utanför huvudet och en rad högre (den är stickad och tjock)
    const capH = Math.max(4 * u, R(g.domeH * (0.46 - 0.1 * g.qq)));
    const y0 = g.domeTop - u;
    for (let j = 0; j < capH + u; j++) {
      const y = y0 + j, cuff = j >= capH + u - 2 * u;
      const hw = g.hwAt(Math.max(g.domeTop, y)) + (j === 0 ? -1 : 1) + (cuff ? 0 : 0);
      for (let x = -hw; x < hw; x++) {
        const nx = (x + 0.5) / hw, v = j / (capH + u);
        let col;
        if (cuff) {                                                       // uppvikt kant med vitt mönster
          const cj = j - (capH + u - 2 * u);
          col = nx > 0.55 ? 0x243e80 : nx < -0.6 ? 0x4a6ac0 : 0x3454a8;
          if (cj % 2 === 0 && (x + 100) % 3 === 1) col = cj === 0 ? WHITE : 0xdce4f8;
          if (cj % 2 === 1 && (x + 100) % 3 !== 1 && (x + 100) % 3 !== 2) col = mix(col, WHITE, 0.25);
        } else {                                                          // resårstickning: ränder
          const L = 0.62 - 0.35 * nx - 0.25 * v;
          col = L > 0.8 ? K.hi : L > 0.5 ? K.a : L > 0.3 ? K.b : K.c;
          if ((x + 100) % 2 === 1) col = mix(col, 0x1a2a60, 0.18);
        }
        P.px(x, y, col);
      }
    }
    // pompom: rund och luddig
    const py = y0 - 2.1 * u;
    ellEach(0, py, 3 * u + 0.2, 2.6 * u + 0.2, (x, y, nx, ny) => {
      if (nx * nx + ny * ny > 0.72 && hash(x, y, 22) > 0.62) return;     // luddig kant
      const h = hash(x, y, 21), L = -nx - ny;
      P.px(x, y, L > 0.7 ? WHITE : L < -0.8 ? 0xc0bcd4 : h > 0.55 ? 0xe6e2f0 : 0xfaf8fc);
    });
    return ey + (u >= 2 ? 1 : 1);
  },
  halsduk(c, g, T, ey) {
    const { P, u } = c;
    const S = { a: 0xe0384a, b: 0xb82838, w: 0xfff4f0 };
    // halsduken blir en rad smalare när dumplingen är hopklämd, så att ansiktet ryms ovanför
    const bandH = g.domeH < 8 * u ? 2 * u : 2 * u + 1;
    const by = g.bot - R(g.domeH * 0.24) - bandH + 2;
    for (let j = 0; j < bandH; j++) {
      const y = by + j, hw = g.hwAt(y) + 1;
      for (let x = -hw; x < hw; x++) {
        const nx = (x + 0.5) / hw;
        let col = ((x - j + 100) % 4 === 0) ? S.w : S.a;
        if (nx > 0.6 || j === bandH - 1) col = mix(col, S.b, 0.6);
        if (j === 0 && nx < 0.3) col = mix(col, WHITE, 0.15);
        P.px(x, y, col);
      }
    }
    // hängande ände med fransar (slutar i kroppens nedersta rad – står på hyllan, inte under den)
    const ex = R(-g.half * 0.5);
    for (let y = by + bandH - 1; y <= g.bot; y++) for (let x = ex; x < ex + 2 * u + 1; x++) {
      if (y === g.bot && (x - ex) % 2 === 1) continue;
      P.px(x, y, ((y + 100) % 3 === 0) ? S.w : x === ex + 2 * u ? S.b : S.a);
    }
    c.faceMaxY = by - 1;                                  // ansiktet slutar ovanför halsduken
    return g.domeTop + R(g.domeH * 0.36) - (u >= 2 ? 1 : 0);
  },
  jarnek(c, g) {
    const { P, u } = c;
    const G = { a: 0x2a8a3e, b: 0x4cb85a, c: 0x1a5a2a };
    const y0 = g.top + (g.knot > 1 ? u : 0);
    for (const s of [-1, 1]) {
      // blad: spetsigt med taggar
      const cx = s * 3.2 * u, cy = y0 - 0.2 * u;
      ellEach(cx, cy, 3.4 * u, 1.4 * u + 0.3, (x, y, nx, ny) => {
        if (Math.abs(nx) > 0.75 && hash(x, y, 30) > 0.5) return;
        P.px(x, y, ny < -0.2 ? G.b : ny > 0.35 ? G.c : G.a);
      });
      P.px(R(cx + s * 3.4 * u) - (s > 0 ? 1 : 0), R(cy - u), G.a);       // taggspets
      for (let i = 1; i < 3 * u; i++) P.px(R(cx - s * (1.5 * u - i)) - (s > 0 ? 1 : 0), R(cy), G.c);  // nerv
    }
    // bären
    const berries = u >= 2 ? [[-2.5, -1.5], [2.5, -1.5], [0, -4]] : [[-1.6, -1.2], [1.6, -1.2], [0, -2.8]];
    for (const [bx, by] of berries) {
      ellEach(bx * (u >= 2 ? 1 : 1), y0 + by * (u >= 2 ? 1 : 1), 1.1 * u + 0.1, 1.1 * u + 0.1, (x, y, nx, ny) => P.px(x, y, nx + ny < -0.6 ? 0xff8a8a : ny > 0.3 ? 0xa01828 : 0xe02a38));
    }
  },
  ljusslinga(c, g, T, ey) {
    const { P, u } = c;
    // två girlanger: en över pannan och en runt nederkanten, lägst på mitten. Hopklämd
    // sträcks de ut (mindre häng), så att ansiktet syns mellan dem.
    const sagK = g.domeH * 0.22 * (1 - 0.7 * g.qq);
    const strands = [[g.domeTop + g.domeH * 0.12, sagK], [g.domeTop + g.domeH * 0.7, sagK]];
    // ögonens kolumner (samma avstånd som face() får) – där hänger inga lampor från den övre
    // girlangen när det är trångt, annars skymmer de ögonen
    const gap = Math.max(u + 1, R(g.half * 0.34)), tight = g.domeH < 9 * u;
    const byEye = (x) => { const ax = x < 0 ? -x - 1 : x; return ax >= gap - 1 && ax <= gap + 3 * u; };
    let n = 0;
    const WIRE = 0x2a5a3a;
    for (const [si, [yEdge, sag]] of strands.entries()) {
      let prev = null;
      const pts = [];
      for (let x = -g.half - 1; x <= g.half; x++) {
        const nx = (x + 0.5) / g.half;
        const y = Math.min(R(yEdge + sag * (1 - nx * nx)), g.bot - (u >= 2 ? 2 : 1));   // lamporna hänger inte under kroppen
        const hw = g.hwAt(y);
        if (x < -hw - 1 || x > hw) { prev = null; continue; }
        P.px(x, y, WIRE);
        if (prev !== null && Math.abs(prev - y) > 1) P.px(x, (prev + y) >> 1, WIRE);
        prev = y;
        pts.push([x, y, hw]);
      }
      // lamporna hänger under sladden, var tredje pixel
      for (let i = 1; i < pts.length - 1; i += 3 * u) {
        const [x, y, hw] = pts[i];
        if (x <= -hw || x >= hw - 1) continue;
        if (si === 0 && tight && (byEye(x) || (u >= 2 && byEye(x + 1)))) continue;
        const col = LIGHT[n % LIGHT.length];
        P.px(x, y + 1, mix(col, 0x303038, 0.35));
        if (u >= 2) { P.px(x + 1, y + 1, mix(col, 0x303038, 0.45)); P.px(x, y + 2, mix(col, 0x303038, 0.5)); P.px(x + 1, y + 2, mix(col, 0x303038, 0.55)); }
        c.li.push({ x, y: y + 1, c: col, k: 'ljus', s: u });
        n++;
      }
    }
    return ey;
  },
};
const ACC_AFTER = {};

// ======================= KUBER: ost, smör, is, hav =======================
// En rundad kub snett framifrån: framsida, ovansida (uppåt/höger) och högersida.
// Klämd: framsidan blir lägre och bredare och buktar ut på mitten.
function cubeGeom(c) {
  const { W, H, u } = c, qq = Math.max(0, c.q);
  const d = c.def.cube * u;
  const fw = W - d, fh = H - d, bot = -2;
  const x0 = -(W >> 1) - (W & 1 ? 0 : 0), xr = x0 + fw, yF = bot - fh + 1;
  const bulge = qq * 1.6 * u;
  const ex = (y) => R(bulge * Math.sin(clamp((y - yF + 0.5) / fh, 0, 1) * Math.PI));
  return { d, fw, fh, bot, x0, xr, yF, cx: x0 + fw / 2, ex, qq };
}
function cubeRegion(g, x, y) {
  const { d, x0, xr, yF, bot } = g;
  if (y >= yF && y <= bot) {
    const e = g.ex(y);
    if (x >= x0 - e && x < xr) {
      // rundade hörn
      if ((y === bot || y === yF) && x === x0 - e) return null;
      return 'F';
    }
  }
  if (y < yF && y >= yF - d) { const m = yF - y; if (x >= x0 + m && x < xr + m) { if (m === d && (x === x0 + m || x === xr + m - 1)) return null; return 'T'; } }
  if (x >= xr) {
    const m = x - xr + 1;
    if (m <= d) {
      const e = g.ex(y + m);
      if (y >= yF - m && y <= bot - m) { if (m === d && y === bot - m) return null; return 'S'; }
      if (e && m === d && y > yF - m && y < bot - m) return 'S';
    } else if (m <= d + g.ex(y + d)) { if (y > yF - d && y < bot - d) return 'S'; }
  }
  return null;
}
// alpha: tal eller fn(x, y, region) – halvgenomskinliga kuber (is, hav) släpper igenom
// det som redan är målat inuti (snöflinga, sand, snäcka) tydligare än tomrummet.
function paintCubeBody(c, g, TF, TT, TS, alpha = 1, texture = null) {
  const { P } = c;
  const y0 = g.yF - g.d - 1, y1 = g.bot + 1, xa = g.x0 - 4 * c.u, xb = g.xr + g.d + 4 * c.u;
  for (let y = y0; y <= y1; y++) for (let x = xa; x <= xb; x++) {
    const r = cubeRegion(g, x, y);
    if (!r) continue;
    let col;
    if (r === 'F') {
      const v = (y - g.yF) / Math.max(1, g.fh - 1), nx = (x + 0.5 - g.cx) / (g.fw / 2);
      let L = 0.62 - 0.32 * v - 0.1 * nx;
      if (y === g.yF) L += 0.26;
      if (x <= g.x0 - g.ex(y)) L += 0.14;
      if (y === g.bot) L -= 0.14;
      if (x === g.xr - 1) L -= 0.08;
      col = pick(TF, L, x, y, 0.08);
    } else if (r === 'T') {
      const m = g.yF - y;
      col = pick(TT, 0.84 - 0.12 * (m / g.d) + (x < g.x0 + m + 2 ? 0.1 : 0), x, y, 0.08);
    } else {
      const v = (y - g.yF) / Math.max(1, g.fh);
      col = pick(TS, 0.38 - 0.2 * v + (x === g.xr ? 0.1 : 0), x, y, 0.08);
    }
    if (texture) col = texture(col, r, x, y);
    P.px(x, y, col, typeof alpha === 'function' ? alpha(x, y, r) : alpha);
  }
}
const SNO1 = ['...w...', '.w.w.w.', '..www..', 'wwwWwww', '..www..', '.w.w.w.', '...w...'];
const SJOSTJ1 = ['..O..', 'ooOoo', '.oOo.', '.o.o.', 'o...o'];
const SNACKA1 = ['.sss.', 'sSsSs', 'sSsSs', '.sSs.', '..d..'];
function paintCube(c) {
  const { P, u, o } = c;
  const g = cubeGeom(c);
  const faceGap = Math.max(u + 1, R(g.fw * 0.2));
  let ey = g.yF + R(g.fh * 0.42);
  const glassEdges = (edge, top) => {
    for (let x = g.x0 + 1; x < g.xr - 1; x++) P.px(x, g.yF, edge, 0.95);
    for (let y = g.yF + 1; y < g.bot; y++) P.px(g.x0 - g.ex(y), y, edge, 0.9);
    for (let m = 1; m < g.d; m++) P.px(g.x0 + m, g.yF - m, WHITE, 0.95);
    for (let x = g.x0 + g.d + 1; x < g.xr + g.d - 1; x++) P.px(x, g.yF - g.d, top, 0.9);
    P.px(g.x0 + u, g.yF + u, WHITE); P.px(g.x0 + u, g.yF + 2 * u, WHITE); P.px(g.x0 + 2 * u, g.yF + u, WHITE);
    if (u >= 2) { P.px(g.x0 + u, g.yF + 3 * u, WHITE, 0.8); P.px(g.x0 + 3 * u, g.yF + u, WHITE, 0.8); }
  };
  const under = (x, y) => alphaAt(P, x, y) > 0;
  if (o.typ === 'ost') {
    const Y = 0xffd24a;
    paintCubeBody(c, g, tonesOf(Y), tonesOf(0xffe680), tonesOf(0xf0b830));
    // hål: mörk överkant (skugga i hålet), ljus nederkant
    const hole = (hx, hy, rx, ry, reg) => ellEach(hx, hy, rx, ry, (x, y, nx, ny) => {
      if (cubeRegion(g, x, y) !== reg) return;
      P.px(x, y, ny < 0.2 ? 0xc88a1c : ny < 0.6 ? 0xe0a42a : 0xfff0a0);
    });
    hole(g.x0 + g.fw * 0.2, g.yF + g.fh * 0.22, 1.5 * u + 0.1, 1.2 * u + 0.2, 'F');
    hole(g.x0 + g.fw * 0.86, g.yF + g.fh * 0.78, 1.1 * u + 0.2, 1.1 * u, 'F');
    hole(g.x0 + g.fw * 0.12, g.yF + g.fh * 0.86, 1 * u, 0.9 * u + 0.1, 'F');
    hole(g.x0 + g.fw * 0.6 + g.d * 0.5, g.yF - g.d * 0.5, 1.6 * u, 0.8 * u + 0.1, 'T');
    hole(g.xr + g.d * 0.5, g.yF + g.fh * 0.4, 0.8 * u + 0.1, 1.4 * u, 'S');
    face(c, ey, faceGap, { cx: g.cx, maxY: g.bot - 1 });
  } else if (o.typ === 'smor') {
    const Y = 0xfff0a0;
    paintCubeBody(c, g, tonesOf(Y), tonesOf(0xfff8c8), tonesOf(0xf0d078), 1, (col, r, x, y) => {
      if (r === 'S') { // pappret vikt över kortsidan: två diagonala veck
        const m = x - g.xr, yy = y - g.yF + m;
        if (yy === m + 1 || yy === g.fh - m - 2) return mix(col, 0xb89040, 0.45);
      }
      if (r === 'T' && (x + y + 200) % (6 * u) === 0) return mix(col, 0xe8c870, 0.4);   // pappersveck på ovansidan
      return col;
    });
    // guldkant längst ner
    for (let x = g.x0 - g.ex(g.bot); x < g.xr; x++) P.px(x, g.bot, x < g.x0 + 2 ? 0xf0c850 : 0xd8a830);
    const rows = g.fh >= 11 * u ? 5 : g.fh >= 9 * u ? 4 : 3;
    const sp = 1 + (g.qq > 0.55 ? 1 : 0);
    const tw = sqTextW($t('SMÖR'), sp);
    const ty = g.yF + (g.fh >= 10 * u ? u + 1 : 1);
    sqText(P, $t('SMÖR'), R(g.cx - tw / 2), ty, rows, 0x2a4aa8, sp, 0x2a4aa8);
    ey = ty + rows + 1 + (c.face === 'klamd' ? 1 : 0);
    face(c, ey, Math.max(u + 2, R(g.fw * 0.18)), { cx: g.cx, maxY: g.bot - 1 });
  } else if (o.typ === 'is') {
    const B = 0x9ad6f6;
    // snöflingan inuti (ritas först – isen läggs halvgenomskinligt över)
    const sx = R(g.cx + g.d * 0.5), sy = R(g.yF + g.fh * 0.3 - g.d * 0.5);
    if (u < 2) blit(P, sx - 3, sy - 3, SNO1, { w: WHITE, W: 0xd8f0ff });
    else {
      const r = 5 * u;
      for (let a = 0; a < 6; a++) {
        const ang = a * Math.PI / 3 + Math.PI / 2;
        for (let i = 0; i <= r; i++) {
          const X = Math.floor(sx + Math.cos(ang) * i), Y = Math.floor(sy - Math.sin(ang) * i);
          P.px(X, Y, WHITE);
          if (i === R(r * 0.55) || i === R(r * 0.8)) for (const s of [-1, 1]) { const a2 = ang + s * 0.9; for (let k = 1; k <= (i === R(r * 0.55) ? 2 : 1); k++) P.px(Math.floor(X + Math.cos(a2) * k), Math.floor(Y - Math.sin(a2) * k), 0xf0f8ff); }
        }
      }
    }
    paintCubeBody(c, g, tonesOf(B), tonesOf(0xdcf4ff), tonesOf(0x68ace0), (x, y) => (under(x, y) ? 0.3 : 0.64));
    glassEdges(0xeaf8ff, 0xf4fcff);
    // bubblor
    P.px(g.x0 + 2 * u, g.bot - 2 * u, WHITE, 0.8); P.px(g.xr - 2 * u, g.bot - 3 * u, WHITE, 0.7);
    c.olAmt = 0.45; c.olDark = 0x1a2a50;
    face(c, g.yF + R(g.fh * 0.6), faceGap, { cx: g.cx, ink: 0x1e2a58, blush: 0xff8ab0, maxY: g.bot - 1 });
  } else if (o.typ === 'hav') {
    const S = 0x4cc8dc;
    // sanden i botten, sjöstjärnan och snäckan (ritas först – vattnet läggs över)
    const sandTop = g.bot - Math.max(2, R(g.fh * 0.18));
    for (let y = sandTop - 3 * u; y <= g.bot + 1; y++) for (let x = g.x0 - 3 * u; x < g.xr + g.d + 3 * u; x++) {
      const r = cubeRegion(g, x, y);
      if (!r || r === 'T') continue;
      const top = r === 'S' ? sandTop - (x - g.xr + 1) : sandTop + (hash(x >> 1, 0, 3) > 0.6 ? 1 : 0);
      if (y < top) continue;
      P.px(x, y, hash(x, y, 4) > 0.8 ? 0xd8b070 : hash(x, y, 5) > 0.85 ? 0xfff4d8 : r === 'S' ? 0xd8b478 : 0xf2d49a);
    }
    const stx = R(g.x0 + g.fw * 0.28), shx = R(g.x0 + g.fw * 0.72);
    if (u < 2) {
      blit(P, stx - 2, sandTop - 4, SJOSTJ1, { o: 0xff7a3a, O: 0xffb070 });
      blit(P, shx - 2, sandTop - 4, SNACKA1, { s: 0xf8a8a8, S: 0xffe4dc, d: 0xd08080 });
    } else {
      const sty = sandTop - 3 * u;
      for (let a = 0; a < 5; a++) {
        const ang = -Math.PI / 2 + a * 2 * Math.PI / 5;
        for (let i = 0; i <= 2.6 * u; i += 0.5) { const X = Math.floor(stx + Math.cos(ang) * i), Y = Math.floor(sty + Math.sin(ang) * i); P.px(X, Y, i < 1.2 ? 0xffb070 : 0xff7a3a); if (i < 2 * u) P.px(X + 1, Y, 0xff8a4a); }
      }
      ellEach(shx, sandTop - 2.2 * u, 2.6 * u, 2.4 * u, (x, y, nx, ny) => { if (ny > 0.6) return; P.px(x, y, (x + 100) % 2 === 0 ? 0xffe4dc : 0xf8a8a8); });
      P.px(shx - 1, sandTop - 1, 0xd08080); P.px(shx, sandTop - 1, 0xd08080);
    }
    // vattnet: ljusare upptill, djupare nertill
    paintCubeBody(c, g, tonesOf(S), tonesOf(0x98ecf0), tonesOf(0x1e98bc), (x, y) => (under(x, y) ? 0.34 : 0.62),
      (col, r, x, y) => (r === 'F' ? mix(col, 0x1a7ab0, clamp((y - g.yF) / g.fh, 0, 1) * 0.3) : col));
    // bubblor som stiger
    for (const [bx, by] of [[0.52, 0.5], [0.6, 0.3], [0.18, 0.4]]) {
      const X = R(g.x0 + g.fw * bx), Y = R(g.yF + g.fh * by);
      P.px(X, Y, WHITE, 0.85); if (u >= 2) { P.px(X + 1, Y, 0xd8ffff, 0.8); P.px(X, Y + 1, 0xd8ffff, 0.8); }
    }
    glassEdges(0xd8ffff, 0xe0ffff);
    c.olAmt = 0.42; c.olDark = 0x10304a;
    face(c, g.yF + Math.max(2 * u, R(g.fh * 0.2)), faceGap, { cx: g.cx, ink: 0x14304a, blush: 0xff8ab0, maxY: g.bot - 1 });
  }
}

// ======================= OSTTRIANGEL =======================
// En ostbit snett framifrån: trekantig framsida (hög till höger), den sluttande
// ovansidan som en ljus remsa och kanten (skorpan) till höger.
function paintWedge(c) {
  const { P, u } = c, qq = Math.max(0, c.q);
  const d = c.def.cube * u, fw = c.W - d, fh = c.H - d, bot = -2;
  const x0 = -(c.W >> 1), xr = x0 + fw, yF = bot - fh + 1;
  const TF = tonesOf(0xffd24a), TT = tonesOf(0xffe888), TS = tonesOf(0xf0a830);
  // framsidans vänstra kant för rad y (sluttning); klämd buktar den ut
  const edge = (y) => { const v = (y - yF + 1) / fh; return xr - Math.max(2 * u, R(v * fw + qq * 1.4 * u * Math.sin(v * Math.PI))); };
  const inF = (x, y) => y >= yF && y <= bot && x >= edge(y) && x < xr;
  const reg = (x, y) => {
    if (inF(x, y)) return 'F';
    if (x >= xr && x < xr + d) { const m = x - xr + 1; if (y >= yF - m && y <= bot - m) return 'S'; }
    for (let m = 1; m <= d; m++) if (inF(x - m, y + m)) return 'T';   // ovansidan: sluttningen flyttad (m, −m)
    return null;
  };
  for (let y = yF - d - 1; y <= bot; y++) for (let x = x0 - 3 * u; x < xr + d + 1; x++) {
    const r = reg(x, y);
    if (!r) continue;
    let col;
    if (r === 'F') {
      const v = (y - yF) / Math.max(1, fh - 1);
      let L = 0.62 - 0.28 * v;
      if (x === edge(y)) L += 0.22;
      if (y === bot) L -= 0.14;
      col = pick(TF, L, x, y);
    } else if (r === 'T') col = pick(TT, 0.8, x, y);
    else col = pick(TS, 0.34 - 0.2 * (y - yF) / fh, x, y);
    P.px(x, y, col);
  }
  // hål
  const hole = (hx, hy, rx, ry) => ellEach(hx, hy, rx, ry, (x, y, nx, ny) => { if (reg(x, y) !== 'F') return; P.px(x, y, ny < 0.2 ? 0xc88a1c : ny < 0.6 ? 0xe0a42a : 0xfff0a0); });
  hole(xr - fw * 0.28, yF + fh * 0.3, 1.3 * u + 0.1, 1.1 * u + 0.1);
  hole(xr - fw * 0.62, bot - fh * 0.2, 1.4 * u, 1.1 * u);
  hole(xr - fw * 0.1, bot - fh * 0.12, 0.9 * u + 0.1, 0.9 * u + 0.1);
  for (let y = yF + 2 * u; y < bot - u; y += 3 * u) P.px(xr + (d >> 1), y - (d >> 1), 0xc88420);   // prickar i skorpan
  const fcx = R(xr - fw * 0.36);
  face(c, bot - R(fh * 0.52) - (u >= 2 ? 1 : 0), Math.max(u + 1, R(fw * 0.12)), { cx: fcx, maxY: bot - 1 });
}

// ======================= JORDGUBBSLÅDAN (mjölkpaket med gavel) =======================
function paintCarton(c) {
  const { P, u } = c, qq = Math.max(0, c.q);
  const d = c.def.cube * u;
  const gab = Math.max(2 * u, R((6 - 2.5 * qq) * u * (1 + Math.max(0, -c.q) * 0.4)));
  const fw = c.W - d, fh = c.H - d - gab, bot = -2;
  const x0 = -(c.W >> 1), xr = x0 + fw, yF = bot - fh + 1, cx = x0 + fw / 2;
  const bulge = qq * 1.6 * u;
  const ex = (y) => R(bulge * Math.sin(clamp((y - yF + 0.5) / fh, 0, 1) * Math.PI));
  const TF = tonesOf(0xffa8c8), TS = tonesOf(0xf07aa6), TG = tonesOf(0xffc4da);
  // gavelns framsida: triangel ovanpå framsidan
  const gTop = yF - gab;
  const gx = (y) => R(((y - gTop) / gab) * fw / 2);         // halvbredd på gaveltriangeln
  const reg = (x, y) => {
    if (y >= yF && y <= bot && x >= x0 - ex(y) && x < xr) return (y === bot || y === yF) && x === x0 - ex(y) ? null : 'F';
    if (y >= gTop && y < yF) { const hw = gx(y); if (x >= cx - hw && x < cx + hw + (hw === 0 ? 1 : 0)) return 'G'; }
    // takfall: gavelns högra kant förskjuten (m, −m)
    for (let m = 1; m <= d; m++) { const yy = y + m, xx = x - m; if (yy >= gTop && yy < yF) { const hw = gx(yy); if (xx >= cx + hw - 1 && xx < xr && xx >= cx) return 'T'; } }
    if (x >= xr && x < xr + d) { const m = x - xr + 1; if (y >= yF - m && y <= bot - m) return 'S'; }
    return null;
  };
  for (let y = gTop - d - 2; y <= bot; y++) for (let x = x0 - 3 * u; x < xr + d + 2; x++) {
    const r = reg(x, y);
    if (!r) continue;
    let col;
    if (r === 'F') {
      const v = (y - yF) / Math.max(1, fh - 1);
      let L = 0.62 - 0.26 * v; if (x <= x0 - ex(y)) L += 0.16; if (y === bot) L -= 0.14;
      col = pick(TF, L, x, y);
    } else if (r === 'G') col = pick(TG, 0.7 - 0.2 * (y - gTop) / gab, x, y);
    else if (r === 'T') col = pick(TG, 0.9, x, y);
    else col = pick(TS, 0.36 - 0.18 * (y - yF) / fh, x, y);
    P.px(x, y, col);
  }
  // förseglingsfenan längs nocken
  for (let m = 0; m <= d; m++) { P.px(Math.floor(cx) + m, gTop - 1 - m, 0xfff0f6); P.px(Math.floor(cx) + m - 1, gTop - 1 - m, 0xffd8e8); }
  // jordgubbe på gaveln
  const berry = (bx, by, s) => {
    const sm = s >= 2;
    const map = sm ? ['.gGg.', 'rrrrr', 'rwrrr', 'rrryr', '.rrr.', '..r..'] : ['gGg', 'ryr', '.r.'];
    blit(P, bx - (map[0].length >> 1), by, map, { r: 0xe8304a, w: 0xffe0e0, y: 0xffe070, g: 0x3aa04a, G: 0x6ad060 });
  };
  if (gab >= 4 * u) berry(Math.floor(cx), gTop + R(gab * 0.35), 2);
  // etiketten: vit ruta med JORD / GUBB
  const rowsTxt = fh >= 17 * u ? 5 : fh >= 14 * u ? 4 : 3;
  const sp = 1 + (qq > 0.55 ? 1 : 0);
  const [rad1, rad2 = ''] = $t('JORD\nGUBB').split('\n');   // ett ord på två rader (en nyckel)
  const tw = sqTextW(rad1, sp);
  const lx0 = R(cx - tw / 2) - u, ly0 = yF + 2 * u, lh = rowsTxt * 2 + 3 * u;
  for (let y = ly0; y < ly0 + lh; y++) for (let x = lx0 - ex(y); x < lx0 + tw + 2 * u + ex(y); x++) P.px(x, y, (y === ly0 + lh - 1) ? 0xf0d0dc : WHITE);
  sqText(P, rad1, R(cx - tw / 2), ly0 + u, rowsTxt, 0xe0306a, sp);
  sqText(P, rad2, R(cx - tw / 2), ly0 + u + rowsTxt + u, rowsTxt, 0xe0306a, sp);
  // småjordgubbar längs botten
  const by = bot - (u >= 2 ? 6 : 3);                  // stora jordgubbar är 6 rader – de får inte sticka ut under lådan
  if (by > ly0 + lh + 4 * u) for (let x = x0 + 2 * u; x < xr - 2 * u; x += 6 * u) berry(x + 1, by, u >= 2 ? 2 : 1);
  const ey = ly0 + lh + Math.max(1, R((bot - 4 * u - (ly0 + lh)) * 0.25));
  face(c, ey, Math.max(u + 2, R(fw * 0.2)), { cx, maxY: bot - 1 });
}

// ======================= BRÖDLIMPAN =======================
function paintBrod(c) {
  const { P, W, H, u } = c, qq = Math.max(0, c.q), st = Math.max(0, -c.q);
  const half = W / 2, bot = -2, top = bot - H + 1;
  const T = { hi: 0xf8d49a, li: 0xe8a860, ba: 0xd08840, sh: 0xa8642c, dp: 0x7a4420 };
  const rows = [];
  for (let j = 0; j < H; j++) {
    const t = (j + 0.5) / H, tb = 0.55 + 0.25 * qq - 0.1 * st;
    let r;
    if (t < tb) { const a = (tb - t) / tb; r = Math.pow(Math.max(0, 1 - Math.pow(a, 2.3 + qq)), 1 / (2.3 + qq)); }
    else { const b = (t - tb) / (1 - tb); r = 1 - 0.05 * b * b - 0.08 * Math.pow(b, 6); }
    rows.push(Math.max(2, R(half * r)));
  }
  for (let j = 0; j < H; j++) {
    const hw = rows[j], y = top + j, v = j / (H - 1);
    for (let x = -hw; x < hw; x++) {
      const nx = (x + 0.5) / hw;
      let L = 0.6 - 0.26 * nx - 0.5 * v + 0.24 * (1 - nx * nx) + (v < 0.3 ? 0.1 : 0);
      if (j >= H - u) L -= 0.12;
      P.px(x, y, jit(pick(T, L, x, y, 0.18), x, y, 7, 0.06));
    }
  }
  // skåror: ljusa snitt snett över ovansidan
  const n = u >= 2 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const sx = R(-half * 0.62 + i * (half * 1.24) / (n - 1)) - u;
    const len = R((3.2 - 1.2 * qq) * u);
    for (let k = 0; k <= len; k++) {
      const x = sx + k, y = top + u + R(k * 0.55) + (i === 0 || i === n - 1 ? 1 : 0);
      P.px(x, y, 0xfbe4b4); P.px(x, y + 1, 0xa8642c);
      if (u >= 2) P.px(x, y - 1, 0xf6d8a0);
    }
  }
  // mjöl
  for (let x = -half; x < half; x++) for (let y = top; y < top + R(H * 0.3); y++) if (hash(x, y, 60) > 0.93 && alphaAt(P, x, y)) P.px(x, y, 0xfff8ec);
  face(c, top + R(H * 0.52) - (u >= 2 ? 1 : 0), Math.max(u + 2, R(half * 0.3)), { maxY: bot - 1 });
}

// ======================= ÄPPLET (rosa, halvgenomskinligt) =======================
function paintAppel(c) {
  const { P, W, H, u } = c, qq = Math.max(0, c.q);
  const half = W / 2, bot = -2, top = bot - H + 1;
  const stem = Math.max(2, R((3 - qq) * u));
  const bodyTop = top + stem;
  const bh = H - stem;
  const rows = [];
  for (let j = 0; j < bh; j++) {
    const t = (j + 0.5) / bh, tb = 0.5 + 0.2 * qq;
    let r = t < tb ? Math.sqrt(Math.max(0, 1 - Math.pow((tb - t) / tb, 2))) : Math.sqrt(Math.max(0, 1 - Math.pow((t - tb) / (1 - tb), 2.6)));
    rows.push(Math.max(2, R(half * Math.pow(r, 0.8))));
  }
  const T = { hi: 0xffe0ec, li: 0xffb4cc, ba: 0xff8ab0, sh: 0xe8608e, dp: 0xc03a6e };
  // kärnan och kärnorna syns genom
  ellEach(0, bodyTop + bh * 0.55, half * 0.32, bh * 0.28, (x, y) => P.px(x, y, 0xffe4ee));
  P.px(-1, R(bodyTop + bh * 0.6), 0x7a3a2a); P.px(0, R(bodyTop + bh * 0.6) + 1, 0x7a3a2a);
  for (let j = 0; j < bh; j++) {
    const hw = rows[j], y = bodyTop + j, v = j / (bh - 1);
    for (let x = -hw; x < hw; x++) {
      if (j < 2 * u && Math.abs(x + 0.5) < (2 * u - j) * 0.9) continue;           // gropen upptill
      const nx = (x + 0.5) / hw;
      const L = 0.6 - 0.3 * nx - 0.42 * v + 0.26 * (1 - nx * nx);
      const edge = Math.abs(nx) > 0.82 || j === bh - 1;
      P.px(x, y, pick(T, L, x, y), edge ? 0.95 : 0.74);
    }
  }
  // skaft och blad
  for (let i = 0; i < stem + u; i++) P.px(i > stem * 0.6 ? 0 : -1 + (i < 1 ? 1 : 0), bodyTop + u - i, 0x7a4a2a);
  ellEach(2.6 * u + 0.5, top + 0.9 * u + 0.3, 2.4 * u, 1.1 * u + 0.1, (x, y, nx, ny) => P.px(x, y, ny < 0 ? 0x7ad060 : 0x3a9a44));
  // glans
  P.px(R(-half * 0.5), bodyTop + 2 * u, WHITE); P.px(R(-half * 0.5), bodyTop + 3 * u, WHITE); P.px(R(-half * 0.5) + 1, bodyTop + u + 1, 0xffffff, 0.9);
  c.olAmt = 0.4;
  face(c, bodyTop + R(bh * 0.46), Math.max(u + 1, R(half * 0.34)), { blush: 0xe8306a, maxY: bot - 1 });
}

// ======================= GLITTERKATTASSEN =======================
// En turkos glittrig katt sedd bakifrån: huvudet med två öron, en rund kropp som breder
// ut sig, bakfötterna med rosa trampdynor och pärlor inuti. Den har inget ansikte –
// SVANSEN reagerar i stället: ringlad i vila, rakt upp och burrig när man klämmer,
// och viftar åt andra hållet när den är glad.
function paintKattass(c) {
  const { P, W, H, u, o } = c;
  const half = W / 2, bot = -2, top = bot - H + 1;
  const T = tonesGel(o.col);
  const mode = c.face;
  const hd = { cy: top + H * 0.31, rx: half * 0.6, ry: H * 0.31 };
  const bd = { cy: bot + 1 - H * 0.4, rx: half, ry: H * 0.43 };
  const glit = (col, x, y, seed) => {
    const h = hash(x * 3 + 5, y * 7 + 1, seed);
    if (h <= 0.925) return col;
    if (h > 0.955) c.sp.push({ x, y, r: hash(x, y, 98) });
    return h > 0.98 ? WHITE : h > 0.955 ? T.hi : mix(o.acc2, col, 0.45);
  };
  const shadeE = (TTT, nx, ny, x, y, core = 0.14) => pick(TTT, 0.62 - 0.26 * nx - 0.36 * ny + 0.2 * (1 - nx * nx - ny * ny) + core * Math.max(0, 1 - Math.hypot(nx, ny) * 1.3), x, y, 0.07);
  // öronen (bakifrån: släta trekanter)
  for (const s of [-1, 1]) {
    const ex = s * hd.rx * 0.56, by = R(hd.cy - hd.ry * 0.5), n = 3 * u + 1;
    for (let i = 0; i < n; i++) {
      const hw = Math.max(0.5, 1.9 * u * (1 - i / n)), cx = ex + s * i * 0.25;
      for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) P.px(x, by - i, (x + 0.5 - cx) * s > 0 ? T.sh : i > n - 2 ? T.li : T.ba);
    }
  }
  // kroppen och huvudet
  ellEach(0, bd.cy, bd.rx, bd.ry, (x, y, nx, ny) => { if (y <= bot) P.px(x, y, glit(shadeE(T, nx, ny, x, y), x, y, o.seed)); });
  ellEach(0, hd.cy, hd.rx, hd.ry, (x, y, nx, ny) => P.px(x, y, glit(shadeE(T, nx, ny, x, y, 0.08), x, y, o.seed + 1)));
  // nacken: en mjuk skugga under huvudet
  for (let x = -R(hd.rx * 0.8); x < R(hd.rx * 0.8); x++) {
    const nx = (x + 0.5) / hd.rx, y = Math.floor(hd.cy + hd.ry * Math.sqrt(Math.max(0, 1 - nx * nx)));
    if (alphaAt(P, x, y)) P.px(x, y, T.sh, 0.7);
  }
  // pärlorna inuti kroppen
  const pearls = [[-0.55, 0.62], [0.5, 0.58], [-0.18, 0.78], [0.2, 0.9], [-0.72, 0.86], [0.7, 0.8], [0.02, 0.62]];
  for (const [px, py] of pearls) {
    const X = R(px * half), Y = top + R(py * H) - u;
    if (!alphaAt(P, X - u, Y) || !alphaAt(P, X + 2 * u, Y + 2 * u)) continue;
    blit(P, X, Y, u >= 2 ? ['.ww.', 'wWws', 'wwss', '.ss.'] : ['Ww', 'ws'], { W: WHITE, w: 0xf0f0ff, s: 0xb4c0e8 });
  }
  // skåran mellan skinkorna (under svansroten)
  for (let y = bot - R(H * 0.3); y <= bot; y++) { P.px(-1, y, T.sh); P.px(0, y, mix(T.sh, T.ba, 0.5)); }
  // svansen: från svansroten upp längs ryggen med en krok i spetsen (vila), rakt upp och
  // burrig (klämd) eller åt andra hållet (glad)
  const TT = tonesGel(mix(o.col, 0x0a5a6a, 0.3));
  const path = mode === 'klamd'
    ? [[0, 0.22], [0.02, 0.5], [-0.03, 0.8], [0.02, 1.1], [0, 1.32]]
    : [[0, 0.2], [0.18, 0.34], [0.38, 0.48], [0.52, 0.62], [0.54, 0.76], [0.44, 0.84], [0.33, 0.8]];
  const dir = mode === 'glad' ? -1 : 1, rad = (mode === 'klamd' ? 1.5 : 1.15) * u + 0.3;
  const tailSet = new Set(), tailPts = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1];
    for (let t = 0; t < 1; t += 0.1) tailPts.push([dir * (ax + (bx - ax) * t) * half, bot + 1 - (ay + (by - ay) * t) * H]);
  }
  tailPts.push([dir * path[path.length - 1][0] * half, bot + 1 - path[path.length - 1][1] * H]);
  for (const [tx, ty] of tailPts) ellEach(tx, ty, rad, rad, (x, y) => tailSet.add(x + ',' + y));
  // mörk kant runt hela svansen (så att den syns mot ryggen), sedan själva svansen
  for (const key of tailSet) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      if (tailSet.has((x + dx) + ',' + (y + dy)) || !alphaAt(P, x + dx, y + dy)) continue;
      P.px(x + dx, y + dy, dy === -1 ? T.sh : T.dp, dy === -1 ? 0.55 : 0.8);
    }
  }
  const cxT = tailPts.reduce((a, p) => a + p[0], 0) / tailPts.length;
  for (const key of tailSet) {
    const [x, y] = key.split(',').map(Number);
    const edgeL = !tailSet.has((x - 1) + ',' + y), edgeR = !tailSet.has((x + 1) + ',' + y);
    let col = edgeL ? TT.li : edgeR ? TT.sh : TT.ba;
    if (!tailSet.has(x + ',' + (y - 1)) && !edgeR) col = TT.hi;
    if (mode === 'klamd' && (edgeL || edgeR) && hash(x, y, 5) > 0.5) col = TT.li;   // burrig
    P.px(x, y, glit(col, x, y, o.seed + 2));
  }
  void cxT;
  // bakfötterna med trampdynor (sulorna mot oss)
  for (const s of [-1, 1]) {
    const fx = s * half * 0.6, fy = bot - 0.8 * u;
    ellEach(fx, fy, half * 0.3 + 0.3, 1.6 * u + 0.3, (x, y, nx, ny) => { if (y <= bot) P.px(x, y, ny < -0.3 ? T.li : T.ba); });
    const px0 = Math.floor(fx) - (u >= 2 ? 2 : 1);
    blit(P, px0, bot - (u >= 2 ? 3 : 1), u >= 2 ? ['p.p.p', '.....', '.ppp.', '.ppp.'] : ['p.p', '.p.'], { p: 0xff9ab8 });
  }
  // glans
  P.px(R(-hd.rx * 0.5), R(hd.cy - hd.ry * 0.4), WHITE); P.px(R(-hd.rx * 0.5) + 1, R(hd.cy - hd.ry * 0.4) - 1, WHITE);
  P.px(R(-half * 0.62), R(bd.cy - bd.ry * 0.3), WHITE, 0.9);
  c.olAmt = 0.3;
}

// ======================= KLÄMKOMPISARNA =======================
const ARTER = {
  kanin: { col: 0xd6c2f2, mag: 0xf6eefe, inner: 0xffb4cc },
  bjorn: { col: 0xe2a462, mag: 0xfbe6c4, inner: 0xb8773c },
  groda: { col: 0x98dc9a, mag: 0xe6f8cc },
  pingvin: { col: 0x8cbcec, mag: 0xffffff },
  rav: { col: 0xf4944a, mag: 0xfff2e2, tip: 0x5a3426 },
  uggla: { col: 0xb48c68, mag: 0xf4e2c4 },
  katt: { col: 0xfff2e4, mag: 0xffffff, inner: 0xffb0c4 },
  anka: { col: 0xffe064, mag: 0xfff4b4 },
};
function paintKompis(c) {
  const { P, W, H, u, o } = c;
  const A = ARTER[o.art], ply = o.stil === 'plysch';
  const T = tonesOf(A.col), M = tonesOf(A.mag);
  // bot = kroppens nedersta rad; fötterna sticker ut en rad under den (−2) och konturen
  // hamnar i −1, så figuren står PÅ fotraden precis som alla andra leksaker
  const bot = -3, top = bot - H + 1, half = W / 2;
  const hry = H * 0.37, hcy = top + hry, hrx = half;
  const bry = H * 0.27, brx = W * 0.35, bcy = bot + 1 - bry;
  const tex = ply ? 0.05 : 0, dith = ply ? 0.15 : 0.08;
  const el = (cx, cy, rx, ry, TT, lift = 0) => ball(P, cx, cy, rx, ry, TT, lift, dith, tex);
  const sym = (fn) => { fn(-1); fn(1); };
  const eyY = R(hcy + hry * 0.08) - (u >= 2 ? 1 : 0);
  const gap = Math.max(u + 1, R(half * 0.36));
  const fo = {};
  // --- bakom: svans och öron ---
  if (o.art === 'rav') {
    const tx = W * 0.4, ty = bcy - bry * 0.4;
    ellEach(tx, ty, W * 0.2, H * 0.24, (x, y, nx, ny) => {
      const tip = ny < -0.35 - nx * 0.2;
      let col = pick(tip ? M : T, 0.6 - 0.3 * nx - 0.3 * ny, x, y, dith);
      if (tex) col = jit(col, x, y, 5, tex);
      P.px(x, y, col);
    });
  }
  if (o.art === 'kanin') {
    sym((s) => {
      const fold = s > 0;
      const ex = s * W * 0.2, ery = H * (fold ? 0.2 : 0.3), ecy = top - ery * 0.5 + (fold ? H * 0.06 : 0);
      el(ex, ecy, Math.max(1.6 * u, W * 0.11), ery, T, 0.05);
      ellEach(ex, ecy + ery * 0.15, Math.max(0.6, W * 0.045), ery * 0.66, (x, y) => P.px(x, y, A.inner));
      if (fold) el(ex + W * 0.12, ecy - ery * 0.8, W * 0.1, H * 0.07 + 0.3, T, -0.15);
    });
  } else if (o.art === 'bjorn') {
    sym((s) => { const ex = s * W * 0.34, ecy = top + H * 0.06; el(ex, ecy, W * 0.14 + 0.3, W * 0.14 + 0.3, T); ellEach(ex, ecy + 0.3, W * 0.07 + 0.2, W * 0.07 + 0.2, (x, y) => P.px(x, y, A.inner)); });
  } else if (o.art === 'groda') {
    sym((s) => { el(s * W * 0.26, top + H * 0.06, W * 0.17, H * 0.13, T, 0.06); });
  } else if (o.art === 'rav' || o.art === 'katt' || o.art === 'uggla') {
    const ew = o.art === 'uggla' ? W * 0.12 : o.art === 'rav' ? W * 0.17 : W * 0.15, eh = o.art === 'uggla' ? H * 0.22 : o.art === 'katt' ? H * 0.3 : H * 0.38;
    const ex0 = W * (o.art === 'uggla' ? 0.36 : 0.3);
    sym((s) => {
      const baseY = top + (o.art === 'uggla' ? 1 * u : hry * 0.4), n = Math.max(2, R(eh));
      for (let i = 0; i < n; i++) {
        const y = R(baseY) - i, f = 1 - i / n, hw = Math.max(0.5, ew * f);
        const cxE = s * (ex0 + (o.art === 'uggla' ? i * 0.35 : i * 0.12));
        for (let x = Math.floor(cxE - hw); x < Math.ceil(cxE + hw); x++) {
          const inner = Math.abs(x + 0.5 - cxE) < hw * 0.45 && i < n * 0.7 && i > 0;
          let col = (o.art === 'rav' && i >= n * 0.62) ? A.tip : inner && A.inner ? A.inner : inner && o.art === 'rav' ? M.ba : (x + 0.5 - cxE) * s > 0 ? T.sh : T.ba;
          if (o.art === 'katt' && s > 0 && !inner) col = mix(0x6a4a3c, col, 0.2);         // mörk fläck på högra örat
          if (o.art === 'katt' && s < 0 && !inner) col = mix(0xf4a24e, col, 0.15);        // orange på vänstra
          P.px(x, y, tex ? jit(col, x, y, 5, tex) : col);
        }
      }
    });
  }
  // --- fötter, kropp, mage, armar ---
  const FT = o.art === 'anka' ? tonesOf(0xff9a3a) : o.art === 'pingvin' ? tonesOf(0xffb040) : T;
  sym((s) => el(s * W * 0.2, bot + 1 - H * 0.07, W * 0.14 + 0.3, H * 0.08 + 0.4, FT, -0.05));
  el(0, bcy, brx, bry, T);
  if (o.art !== 'groda') ellEach(0, bcy + bry * 0.18, brx * 0.62, bry * 0.72, (x, y, nx, ny) => { let col = pick(M, 0.66 - 0.2 * nx - 0.25 * ny, x, y, dith); if (tex) col = jit(col, x, y, 6, tex); P.px(x, y, col); });
  else ellEach(0, bcy + bry * 0.18, brx * 0.62, bry * 0.72, (x, y, nx, ny) => P.px(x, y, pick(tonesOf(0xe6f8cc), 0.7 - 0.25 * ny, x, y, dith)));
  if (o.art === 'bjorn' && W >= 16) {
    // en rutig tyglapp fastsydd lite snett till höger på magen (där han gick sönder av
    // för mycket kramar): mörkblå kant, vita stygn och blårutigt tyg
    const LP = { d: 0x3a64ac, a: 0x7eaee8, m: 0xacccf4, b: 0xe2eeff, w: 0xffffff };
    // precis under hakan (huvudet ritas ovanpå magen) – hopklämd skjuter huvudet ner över lappen
    const pw = u >= 2 ? 9 : 5, ph = u >= 2 ? 7 : 3;
    const lx = u >= 2 ? -3 : -2, ly = Math.min(R(hcy + hry) + 1, bot - ph);
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const edgeX = i === 0 || i === pw - 1, edgeY = j === 0 || j === ph - 1;
      let col;
      if (u < 2) {
        // liten: blå kant, vita stygnknutar i hörnen och ljust rutigt tyg i mitten
        col = edgeX && edgeY ? LP.w : edgeX || edgeY ? LP.d : (i & 1 ? LP.m : LP.b);
      } else if (edgeX || edgeY) col = LP.d;
      else if ((i === 1 || j === 1 || i === pw - 2 || j === ph - 2) && ((i + j) & 1) === 0) col = LP.w;   // stygnen
      else {                                                                                               // gingham: 2×2-rutor
        const cr = (i >> 1) & 1, rr = (j >> 1) & 1;
        col = cr && rr ? LP.a : cr || rr ? LP.m : LP.b;
      }
      if (i >= pw - 2 && !edgeX && col !== LP.w) col = mix(col, LP.d, 0.18);   // lite skugga mot högerkanten
      P.px(lx + i, ly + j, tex ? jit(col, lx + i, ly + j, 7, tex * 0.6) : col);
    }
  }
  const AT = o.art === 'uggla' || o.art === 'pingvin' || o.art === 'anka' ? tonesOf(mul(A.col, 0.88)) : T;
  sym((s) => el(s * (brx - W * 0.02), bcy - bry * 0.3, W * 0.1 + 0.3, H * 0.13, AT, -0.04));
  // --- huvudet ---
  el(0, hcy, hrx, hry, T);
  // skugga under hakan
  for (let x = -R(brx * 0.8); x < R(brx * 0.8); x++) { const y = R(hcy + hry); if (alphaAt(P, x, y)) P.px(x, y, T.sh, 0.6); }
  // --- artens detaljer ---
  if (o.art === 'kanin') { fo.nos = 'rosa'; fo.blush = 0xff8cb0; }
  if (o.art === 'bjorn') {
    ellEach(0, eyY + 2.6 * u, W * 0.17, H * 0.1 + 0.2, (x, y, nx, ny) => P.px(x, y, pick(M, 0.72 - 0.2 * ny, x, y, dith)));
    fo.nos = 'kk';
  }
  if (o.art === 'groda') {
    fo.mun = 'bred'; fo.blush = 0xff8aa8;
    // blomman på vänstra bulan
    const fx = Math.floor(-W * 0.26), fy = R(top + H * 0.06 - H * 0.13);
    blit(P, fx - 1, fy - 1, u >= 2 ? ['.pp.', 'pyyp', 'pyyp', '.pp.'] : ['.p.', 'pyp', '.p.'], { p: 0xff8ac0, y: 0xffe04a });
  }
  if (o.art === 'pingvin') {
    sym((s) => ellEach(s * W * 0.15, hcy + hry * 0.18, W * 0.23, hry * 0.64, (x, y, nx, ny) => P.px(x, y, pick(M, 0.72 - 0.15 * nx - 0.2 * ny, x, y, dith))));
    fo.mun = 'nabb'; fo.nabbFarg = 0xffb830;
    // halsduk: röd med vita ränder, hänger på vänster sida
    const sy = R(hcy + hry) - u;
    for (let j = 0; j < 2 * u; j++) for (let x = -R(brx) - 1; x < R(brx) + 1; x++) P.px(x, sy + j, (x + j + 100) % 4 === 0 ? WHITE : j === 2 * u - 1 ? 0xb02838 : 0xe0384a);
    for (let y = sy + 2 * u; y < Math.min(sy + 5 * u, bot + 1); y++) for (let x = -R(brx * 0.6); x < -R(brx * 0.6) + 2 * u; x++) P.px(x, y, (y + 100) % 3 === 0 ? WHITE : 0xd83040);
    // tofs
    P.px(-1, top - 1, T.ba); P.px(0, top - 2, T.ba); P.px(0, top - 1, T.sh);
  }
  if (o.art === 'rav') {
    // vita kinder som går ihop under ögonen
    sym((s) => ellEach(s * W * 0.26, hcy + hry * 0.52, W * 0.22, hry * 0.44, (x, y, nx, ny) => { if (alphaAt(P, x, y)) P.px(x, y, pick(M, 0.72 - 0.2 * ny, x, y, dith)); }));
    fo.nos = 'kk';
  }
  if (o.art === 'uggla') {
    // ögonskivorna: ljusa ringar runt ögonen med en mörkare kant
    sym((s) => {
      const ex = s * (gap + (u >= 2 ? 2 : 1)), eyc = eyY + (u >= 2 ? 2 : 1), r = W * 0.2 + 0.3;
      ellEach(ex, eyc, r, r, (x, y, nx, ny) => P.px(x, y, nx * nx + ny * ny > 0.7 ? M.sh : pick(M, 0.78 - 0.2 * ny, x, y, dith)));
    });
    fo.mun = 'nabb'; fo.nabbFarg = 0xf2a23a;
    // fjädermönster på magen: små v
    for (const [vx, vy] of [[-2, 0.1], [1, 0.1], [-0.5, 0.45]]) {
      const X = R(vx * u), Y = R(bcy + bry * vy);
      P.px(X, Y, M.sh); P.px(X + 1, Y + 1, M.sh); P.px(X + 2, Y, M.sh);
    }
  }
  if (o.art === 'katt') {
    // fläckar: orange runt vänster öga, mörk på höger sida av huvudet
    ellEach(-W * 0.28, hcy - hry * 0.3, W * 0.22, hry * 0.5, (x, y, nx, ny) => { if (alphaAt(P, x, y)) P.px(x, y, pick(tonesOf(0xf4a24e), 0.64 - 0.25 * nx - 0.3 * ny, x, y, dith)); });
    ellEach(W * 0.36, hcy - hry * 0.55, W * 0.18, hry * 0.36, (x, y, nx, ny) => { if (alphaAt(P, x, y)) P.px(x, y, pick(tonesOf(0x6a4a3c), 0.6 - 0.3 * ny, x, y, dith)); });
    fo.nos = 'rosa'; fo.mun = 'katt';
    // morrhår (efter konturen)
    c.after.push((PP) => {
      const wy = eyY + (u >= 2 ? 4 : 2);
      sym((s) => {
        for (let i = 0; i < 3 * u; i++) { const x = s < 0 ? -R(half) - i + 1 : R(half) + i - 2; PP.px(x, wy + (i > 1.5 * u ? -1 : 0), 0x4a3a44, 0.85); PP.px(x, wy + 2 + (i > 1.5 * u ? 1 : 0), 0x4a3a44, 0.7); }
      });
    });
  }
  if (o.art === 'anka') {
    fo.mun = 'bill'; fo.nabbFarg = 0xff9636;
    // skottet på huvudet
    for (let i = 1; i <= 2 * u; i++) P.px(-1 + (i > u ? 1 : 0), top - i + 1, 0x3a9a44);
    sym((s) => ellEach(s * 1.6 * u, top - 2 * u + 0.5, 1.5 * u + 0.2, 0.9 * u + 0.2, (x, y, nx, ny) => P.px(x, y, ny < 0 ? 0x7ad060 : 0x3a9a44)));
  }
  // --- ansiktet ---
  face(c, eyY, gap, fo);
  // --- material: blank plast eller plysch ---
  if (!ply) {
    const gx = R(-hrx * 0.52), gy = R(top + hry * 0.45);
    P.px(gx, gy, WHITE); P.px(gx + 1, gy - 1, WHITE); if (u >= 2) { P.px(gx, gy + 1, WHITE); P.px(gx + 2, gy - 2, 0xffffff, 0.8); }
    P.px(R(-brx * 0.5), R(bcy - bry * 0.3), mix(A.col, WHITE, 0.8));
    c.olAmt = 0.25;
  } else {
    // sömmen över hjässan och en liten tygetikett på sidan
    for (let y = top + (o.art === 'anka' ? 1 : 0); y < R(top + hry * 0.5); y += 2) if (alphaAt(P, -1, y)) P.px(-1, y, T.sh, 0.7);
    const lx = R(brx * 0.72), ly = R(bcy + bry * 0.1);
    blit(P, lx, ly, u >= 2 ? ['rr.', 'www', 'www', 'www'] : ['r', 'w', 'w'], { r: 0xe03a4a, w: 0xf8f8f8 });
    c.olAmt = 0.42;
  }
}

// ======================= NALLAR =======================
function paintNalle(c) {
  const { P, W, H, u, o } = c, s = o.s;
  const col = [0xd49a54, 0xa86c3a, 0xe8c48c][s];
  const T = tonesOf(col), PAD = tonesOf(s === 2 ? 0xfff4e0 : 0xf6e2c0), IN = tonesOf(mul(col, 0.8));
  const bot = -2, top = bot - H + 1;
  const tex = 0.06, dith = 0.16;
  const el = (cx, cy, rx, ry, TT, lift = 0) => ball(P, cx, cy, rx, ry, TT, lift, dith, tex);
  const sym = (fn) => { fn(-1); fn(1); };
  const hry = H * 0.27, hcy = top + H * 0.08 + hry, hrx = W * 0.42;
  const bry = H * 0.26, brx = W * 0.33, bcy = bot + 1 - H * 0.12 - bry * 0.7;
  // öron
  sym((sd) => { const ex = sd * W * 0.32, ey = top + H * 0.1; el(ex, ey, W * 0.13 + 0.2, W * 0.13 + 0.2, T); ellEach(ex, ey + 0.4, W * 0.065 + 0.2, W * 0.065 + 0.2, (x, y) => P.px(x, y, PAD.sh)); });
  // armar bakom kroppen, kropp, mage
  sym((sd) => el(sd * W * 0.36, bcy - bry * 0.2, W * 0.12 + 0.3, H * 0.15, IN));
  el(0, bcy, brx, bry, T);
  ellEach(0, bcy + bry * 0.2, brx * 0.58, bry * 0.66, (x, y, nx, ny) => P.px(x, y, jit(pick(PAD, 0.6 - 0.2 * ny, x, y, dith), x, y, 6, 0.06)));
  // benen framåt med trampdynor
  sym((sd) => {
    const lx = sd * W * 0.22, ly = bot + 1 - H * 0.12;
    el(lx, ly, W * 0.16 + 0.3, H * 0.12 + 0.3, T, 0.04);
    ellEach(lx + sd * 0.3, ly + 0.2, W * 0.08 + 0.3, H * 0.07 + 0.3, (x, y, nx, ny) => P.px(x, y, pick(PAD, 0.6 - 0.3 * ny, x, y, 0.1)));
  });
  // huvudet
  el(0, hcy, hrx, hry, T);
  // rosett under hakan
  const bowY = R(hcy + hry) - (s === 0 ? 0 : 1), bw = s === 2 ? 4 * u : 3 * u;
  const BOW = [0xe03a4a, 0x3a7bd5, 0x46a35a][s];
  const BT = tonesOf(BOW);
  for (let i = 1; i <= bw; i++) {
    const hh = Math.floor((i - 1) * 0.55) + (i === bw ? 0 : 0);
    for (let dy = -hh; dy <= hh; dy++) {
      let cc = dy < 0 ? BT.li : dy > 0 ? BT.sh : BT.ba;
      if (s === 2 && (i + dy + 20) % 2 === 0) cc = mix(cc, WHITE, 0.35);   // rutig
      P.px(-1 - i, bowY + dy, cc); P.px(i, bowY + dy, cc);
    }
  }
  P.px(-1, bowY, BT.dp); P.px(0, bowY, BT.sh); if (s > 0) { P.px(-1, bowY - 1, BT.sh); P.px(0, bowY - 1, BT.sh); }
  // nosparti, nos, mun, ögon
  const my = R(hcy + hry * 0.4);
  ellEach(0, my + 0.3, W * 0.17 + 0.4, H * 0.08 + 0.7, (x, y, nx, ny) => P.px(x, y, pick(PAD, 0.72 - 0.2 * nx - 0.25 * ny, x, y, 0.08)));
  const eyy = R(hcy - hry * 0.2), eg = Math.max(2, R(W * 0.15));
  const pal = { k: INK, w: WHITE, n: 0x3a2020, m: 0x6a3a30 };
  if (s === 0) {
    blit(P, -eg - 1, eyy, ['k'], pal); blit(P, eg, eyy, ['k'], pal);                     // knappögon
    blit(P, -1, my - 1, ['nn', 'm.'], pal); P.px(0, my, pal.m);                            // nos och mun
  } else if (s === 1) {
    blit(P, -eg - 2, eyy, ['wk', 'kk'], pal); blit(P, eg, eyy, ['wk', 'kk'], pal);
    blit(P, -2, my - 1, ['.nn.', 'm..m', '.mm.'], pal);
  } else {
    blit(P, -eg - 2, eyy, ['wk', 'kk'], pal); blit(P, eg, eyy, ['wk', 'kk'], pal);
    blit(P, -2, my - 1, ['nnnn', '.nn.', 'm..m', '.mm.'], pal);
  }
  if (s > 0) { P.px(-eg - 3, eyy + 2, BLUSH, 0.6); P.px(-eg - 2, eyy + 2, BLUSH, 0.5); P.px(eg + 1, eyy + 2, BLUSH, 0.5); P.px(eg + 2, eyy + 2, BLUSH, 0.6); }
  c.olAmt = 0.36;
}

// ======================= BILAR =======================
function wheel(P, cx, cy, r) {
  ellEach(cx, cy, r, r, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    P.px(x, y, d < 0.45 ? (nx + ny < 0 ? 0xe8ecf2 : 0xa8aebc) : d < 0.6 ? 0x6a6e7c : nx + ny < -0.6 ? 0x5a5a68 : 0x2a2a34);
  });
}
function paintBil(c) {
  const { P, u, o } = c, bot = -2;
  const typ = o.typ;
  if (typ === 'racer') {
    // formelbil från sidan, fronten åt höger: motorkåpa bak, förare i mitten, lång nos
    const T = tonesOf(0xe8303a), x0 = -11, x1 = 11;
    const topAt = (x) => (x < -4 ? bot - 6 : x < 2 ? bot - 5 : bot - 5 + Math.floor((x - 2) / 3));
    for (let x = x0; x < x1; x++) for (let y = topAt(x); y <= bot - 2; y++) {
      if (x === x0 && y === topAt(x)) continue;
      const k = y - topAt(x);
      P.px(x, y, k === 0 ? T.li : pick(T, 0.62 - 0.12 * k, x, y, 0.06));
    }
    for (let x = x0 + 1; x < x1 - 1; x++) P.px(x, bot - 3, x < -4 ? 0xf4f4f8 : WHITE);               // racerrand
    for (let x = -4; x < 1; x++) P.px(x, bot - 5, 0x2a1418);                                         // cockpit
    // föraren: gul hjälm med mörkt visir
    ellEach(-1.5, bot - 6.5, 2.1, 2.1, (x, y, nx, ny) => P.px(x, y, nx > 0.15 && ny > -0.5 && ny < 0.5 ? 0x2a3a5a : nx + ny < -0.6 ? 0xfff4b0 : ny > 0.4 ? 0xd8a820 : 0xffd23a));
    // vinge bak på två stöttor
    for (let x = x0 - 2; x < x0 + 3; x++) { P.px(x, bot - 10, 0xff5a5a); P.px(x, bot - 9, 0xa01828); }
    for (let y = bot - 8; y < bot - 6; y++) P.px(x0, y, 0x4a4a54);
    // framvinge och avgasrör
    for (let x = x1 - 2; x < x1 + 2; x++) P.px(x, bot - 2, 0x8a1422);
    P.px(x0 - 1, bot - 4, 0x8a8e9a);
    // nummerskiva med en sjua
    ellEach(4.5, bot - 4.5, 2.4, 2.4, (x, y) => P.px(x, y, WHITE));
    blit(P, 3, bot - 6, ['kkk', '..k', '.k.'], { k: 0x1a1a22 });
    wheel(P, -7, bot - 2, 3); wheel(P, 7.5, bot - 1.5, 2.5);
  } else if (typ === 'polis') {
    // polisbil med blågul rutning (som de svenska) och blåljusramp
    const x0 = -12, x1 = 12;
    const W1 = tonesOf(0xf6f6fa), B1 = tonesOf(0x2a5ab8);
    for (let x = x0; x < x1; x++) for (let y = bot - 6; y <= bot - 1; y++) {
      if ((x === x0 || x === x1 - 1) && (y === bot - 6 || y === bot - 1)) continue;
      const k = y - (bot - 6);
      let col = k === 0 ? W1.hi : pick(W1, 0.78 - 0.1 * k, x, y, 0.05);
      if (k === 1 || k === 2) col = ((Math.floor((x + 100) / 2) + k) & 1) ? 0x2a5ab8 : 0xffd23a;   // rutningen
      if (k === 5) col = B1.sh;
      P.px(x, y, col);
    }
    // kupén med två fönster
    const rows = [[-4, 4], [-5, 5], [-6, 6], [-7, 7]];
    rows.forEach(([xl, xr], i) => {
      const y = bot - 10 + i;
      for (let x = xl; x < xr; x++) {
        const win = i >= 1 && i <= 2 && x > xl && x < xr - 1 && x !== -1 && x !== 0;
        P.px(x, y, win ? (x < -1 ? (i === 1 ? 0xd8f0ff : 0x8ac4e8) : (i === 1 ? 0xc8e8ff : 0x7ab8e0)) : i === 0 ? W1.hi : pick(W1, 0.76, x, y));
      }
    });
    // blåljusramp på taket
    P.px(-3, bot - 11, 0x3a78e8); P.px(-2, bot - 11, 0x3a78e8); P.px(-1, bot - 11, 0xb8bcc8); P.px(0, bot - 11, 0xb8bcc8); P.px(1, bot - 11, 0xe83a3a); P.px(2, bot - 11, 0xe83a3a);
    c.li.push({ x: -3, y: bot - 11, k: 'bla', w: 2 }, { x: 1, y: bot - 11, k: 'rod', w: 2 });
    P.px(x1 - 1, bot - 5, 0xffe070); P.px(x0, bot - 5, 0xe83a3a);                                  // lyktor
    wheel(P, -7, bot - 1.5, 2.5); wheel(P, 7, bot - 1.5, 2.5);
  } else {
    const x0 = -15, x1 = 15, yb = bot - 6;
    const Rt = tonesOf(0xd82a34);
    // flaket bak och hytten fram
    for (let x = x0; x < x1; x++) {
      const t0 = x >= 6 ? yb - 4 : yb;
      for (let y = t0; y <= bot - 1; y++) {
        if (x === x1 - 1 && y === t0) continue;
        P.px(x, y, pick(Rt, 0.74 - 0.45 * (y - t0) / (bot - t0), x, y, 0.08));
      }
    }
    for (let y = yb - 3; y < yb; y++) for (let x = 8; x < 13; x++) P.px(x, y, x + y < 5 ? 0xd8f0ff : 0x7ab8e0);      // fönster
    for (let x = x0; x < x1; x++) P.px(x, bot - 3, WHITE);
    for (let x = x0 + 2; x < 4; x += 5) { for (let y = yb + 1; y < bot - 3; y++) P.px(x, y, 0xa01c28); }             // luckor
    // stegen
    for (let x = x0 + 1; x < 7; x++) { P.px(x, yb - 2, 0xd8dce4); P.px(x, yb - 1, 0x9aa0ac); if ((x & 1) === 0) P.px(x, yb - 3, 0xb8bcc8); }
    P.px(x0 + 1, yb - 3, 0xd8dce4); P.px(6, yb - 3, 0xd8dce4);
    // blåljus på hytten
    P.px(9, yb - 5, 0x3a78e8); P.px(10, yb - 5, 0x3a78e8);
    c.li.push({ x: 9, y: yb - 5, k: 'bla', w: 2 });
    P.px(x1 - 1, bot - 4, 0xffe070);
    wheel(P, -10, bot - 1, 2.5); wheel(P, -4, bot - 1, 2.5); wheel(P, 10, bot - 1, 2.5);
  }
}

// ======================= TÅGSETET =======================
function paintTag(c) {
  const { P } = c, bot = -2;
  const WOOD = tonesOf(0xe8c890);
  // rälsen: träbana med två spår
  for (let x = -22; x < 22; x++) for (let y = bot - 1; y <= bot; y++) P.px(x, y, jit(y === bot ? WOOD.sh : WOOD.li, x, y, 3, 0.08));
  for (let x = -22; x < 22; x++) P.px(x, bot - 1, (x + 100) % 5 === 0 ? WOOD.sh : WOOD.hi);
  // godsvagnen (vänster)
  const B = tonesOf(0x3a7bd5);
  for (let x = -20; x < -4; x++) for (let y = bot - 7; y < bot - 2; y++) P.px(x, y, pick(B, y === bot - 7 ? 0.9 : 0.6 - 0.3 * (y - bot + 7) / 5, x, y, 0.06));
  blit(P, -18, bot - 11, ['rrrr.yyy..gggg', 'rrrr.yyy..gggg', 'RRRRyyyYGGGGgg', 'RRRRYYYYGGGGgg'], { r: 0xe84a3a, R: 0xc0302a, y: 0xffd23a, Y: 0xe0a820, g: 0x5ac05a, G: 0x3a9a44 });
  for (const wx of [-16, -8]) wheel(P, wx, bot - 2, 2);
  P.px(-4, bot - 4, 0x6a4a2a); P.px(-3, bot - 4, 0x6a4a2a);                      // koppel
  // loket (höger): hytt, panna med band, skorsten, dom
  const Rl = tonesOf(0xd83a3a), G = tonesOf(0x2a7a4a);
  for (let x = -2; x < 5; x++) for (let y = bot - 12; y < bot - 2; y++) P.px(x, y, pick(G, 0.7 - 0.4 * (y - bot + 12) / 10 - (x === 4 ? 0.2 : 0), x, y, 0.06));
  for (let x = -3; x < 6; x++) P.px(x, bot - 13, 0x1a3a2a);                     // taket
  for (let y = bot - 10; y < bot - 7; y++) for (let x = -1; x < 3; x++) P.px(x, y, y === bot - 10 ? 0xd8f0ff : 0x9ad0f0);
  for (let x = 5; x < 19; x++) for (let y = bot - 9; y < bot - 2; y++) {
    const v = (y - bot + 9) / 7;
    let col = pick(Rl, 0.8 - 0.55 * v, x, y, 0.06);
    if (x === 9 || x === 14) col = y === bot - 9 ? 0xfff0a0 : 0xe0b030;          // mässingsband
    P.px(x, y, col);
  }
  for (let y = bot - 9; y < bot - 3; y++) P.px(19, y, 0x3a3a44);                // front
  for (let y = bot - 13; y < bot - 9; y++) for (let x = 15; x < 18; x++) P.px(x, y, x === 15 ? 0x4a4a54 : 0x2a2a34);   // skorsten
  P.px(14, bot - 14, 0x2a2a34); P.px(15, bot - 14, 0x4a4a54); P.px(16, bot - 14, 0x2a2a34); P.px(17, bot - 14, 0x2a2a34); P.px(18, bot - 14, 0x2a2a34);
  ellEach(10.5, bot - 9.5, 2, 1.6, (x, y, nx, ny) => P.px(x, y, ny < 0 ? 0xfff0a0 : 0xe0b030));  // dom
  blit(P, 18, bot - 4, ['kk.', 'k.k', 'kkk'], { k: 0x3a3a44 });                                  // plogen
  P.px(19, bot - 8, 0xfff4a0);
  for (const wx of [2, 8, 14]) wheel(P, wx, bot - 2.5, 2.5);
  for (let x = 2; x < 15; x++) P.px(x, bot - 3, 0xb8bcc8);                                       // vevstaken
  c.li.push({ x: 16, y: bot - 16, k: 'rok' });
}

// ======================= BYGGKLOSSAR =======================
function paintKlossar(c) {
  const { P } = c, bot = -2;
  const kloss = (x0, yb, col, ch, chc) => {
    const T = tonesOf(col), s = 7, d = 2;
    for (let y = yb - s + 1; y <= yb; y++) for (let x = x0; x < x0 + s; x++) P.px(x, y, jit(pick(T, 0.62 - 0.2 * (y - yb + s) / s + (x === x0 ? 0.12 : 0), x, y, 0.08), x, y, 2, 0.05));
    for (let m = 1; m <= d; m++) for (let x = x0 + m; x < x0 + s + m; x++) P.px(x, yb - s + 1 - m, T.li);
    for (let m = 1; m <= d; m++) for (let y = yb - s + 1 - m; y <= yb - m; y++) P.px(x0 + s - 1 + m, y, T.sh);
    const G = SMALL[ch];
    G.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(x0 + 2 + i, yb - s + 2 + j, chc); });
  };
  kloss(-10, bot, 0xe84a3a, 'A', WHITE);
  kloss(-2, bot, 0x3a7bd5, 'B', 0xffe070);
  kloss(-6, bot - 9, 0xffc830, 'C', 0x3a4ab0);
  // taket: grön trekant
  for (let j = 0; j < 5; j++) for (let x = -6 + j; x < 1 - j + 1; x++) P.px(x, bot - 17 - j + 0, j === 0 ? 0x2a8a3a : x === -6 + j ? 0x7ad070 : 0x46b050);
}

// ======================= BOLLAR =======================
const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  return v.map(([a, b, cc]) => { const l = Math.hypot(a, b, cc); return [a / l, b / l, cc / l]; });
})();
function paintBoll(c) {
  const { P, u, o } = c, bot = -2;
  if (o.typ === 'bad') {
    const r = 6 * u, cy = bot + 1 - r;
    // klotet lutat mot oss så att klyftorna möts i en vit polkapsyl upptill
    const cols = [0xe8303a, WHITE, 0x3a7bd5, 0xffd23a];
    const tilt = 0.75, ct = Math.cos(tilt), stt = Math.sin(tilt);
    ellEach(0, cy, r, r, (x, y, nx, ny) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const Y = ny * ct - nz * stt, Z = ny * stt + nz * ct;
      const lon = Math.atan2(nx, Z) + 0.3;
      let col = Y < -0.86 ? WHITE : cols[((Math.floor((lon + Math.PI) / (Math.PI / 4)) % 4) + 4) % 4];
      const L = 0.5 - 0.3 * nx - 0.35 * ny + 0.25 * nz;
      col = L > 0.72 ? mix(col, WHITE, 0.35) : L < 0.25 ? mix(col, 0x3a2a5a, 0.32) : L < 0.4 ? mix(col, 0x3a2a5a, 0.15) : col;
      P.px(x, y, col);
    });
    P.px(-3 * u, cy - 3 * u, WHITE); P.px(-3 * u + 1, cy - 4 * u, WHITE);
  } else if (o.typ === 'fot') {
    const r = 6 * u, cy = bot + 1 - r, rot = 0.5;
    ellEach(0, cy, r, r, (x, y, nx, ny) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const X = nx * Math.cos(rot) + nz * Math.sin(rot), Z = -nx * Math.sin(rot) + nz * Math.cos(rot), Y = ny;
      let best = -2; for (const v of ICO) best = Math.max(best, v[0] * X + v[1] * Y + v[2] * Z);
      let col = best > 0.962 ? 0x22222a : best > 0.945 ? 0x8a8a98 : WHITE;
      const L = 0.5 - 0.3 * nx - 0.35 * ny + 0.25 * nz;
      if (col === WHITE) col = L > 0.62 ? WHITE : L > 0.42 ? 0xe4e4ee : L > 0.25 ? 0xc4c4d4 : 0x9a9ab0;
      else if (L > 0.6) col = 0x4a4a58;
      P.px(x, y, col);
    });
    P.px(-3 * u, cy - 3 * u, WHITE);
  } else {
    const r = 3 * u, cy = bot + 1 - r, T = tonesGel(0xb04ae8);
    ellEach(0, cy, r, r, (x, y, nx, ny) => {
      let col = pick(T, 0.62 - 0.3 * nx - 0.35 * ny + 0.2 * (1 - nx * nx - ny * ny), x, y);
      if (Math.abs(nx * 0.8 - ny + 0.1) < 0.2) col = 0xff8ad8;                    // virvel
      const h = hash(x, y, 70);
      if (h > 0.78) { col = h > 0.9 ? WHITE : 0xfff0a0; c.sp.push({ x, y, r: hash(x, y, 71) }); }
      P.px(x, y, col);
    });
    P.px(-1 * u - 1, cy - u - 1, WHITE);
  }
}

// ======================= JOJO =======================
function paintJojo(c) {
  const { P } = c, bot = -2, r = 5, cy = bot + 1 - r;
  const T = tonesOf(0xe8303a);
  ellEach(0, cy, r, r, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    let col = d > 0.78 ? pick(T, 0.5 - 0.35 * nx - 0.35 * ny, x, y) : d > 0.62 ? 0xf8f0f0 : pick(T, 0.7 - 0.3 * nx - 0.3 * ny, x, y);
    if (d < 0.2) col = 0xc8ccd6;
    P.px(x, y, col);
  });
  blit(P, -2, cy - 3, ['..y..', '.yyy.', 'yyyyy', '.y.y.'].map((r) => r.slice(0, 5)), { y: 0xffe04a });
  P.px(-4, cy - 3, WHITE); P.px(-3, cy - 4, WHITE);
  for (let y = cy - r - 4; y < cy - r + 1; y++) P.px(0, y, 0xf4f0e0);       // snöret
  blit(P, -1, cy - r - 7, ['.k.', 'k.k', '.k.'], { k: 0xf4f0e0 });            // fingerslingan
}

// ======================= PUSSEL OCH FIA (kartonger) =======================
function paintKartong(c, art) {
  const { P, W, H } = c, bot = -2, d = 2;
  const fw = W - d, fh = H - d, x0 = -(W >> 1), yF = bot - fh + 1;
  for (let m = 1; m <= d; m++) {
    for (let x = x0 + m; x < x0 + fw + m; x++) P.px(x, yF - m, art === 'pussel' ? 0xf4ecd8 : 0xf8f4ec);
    for (let y = yF - m; y <= bot - m; y++) P.px(x0 + fw - 1 + m, y, art === 'pussel' ? 0xa8b8d0 : 0xc0c8b8);
  }
  if (art === 'pussel') {
    // motivet: en röd stuga vid en sjö i solnedgång
    const hor = yF + R(fh * 0.6);                                                             // horisonten
    const hill = (x) => hor - 1 - R(2.2 * Math.sin((x - x0) / fw * Math.PI * 1.3 + 0.4)) - (x - x0 < fw * 0.45 ? 1 : 0);
    const sunX = x0 + fw * 0.68, sunY = hor - 1;
    for (let y = yF; y <= bot; y++) for (let x = x0; x < x0 + fw; x++) {
      let col;
      if (y < hill(x)) {
        const v = (y - yF) / (hor - yF);
        col = v < 0.3 ? 0xf08aa8 : v < 0.55 ? 0xff9a7a : v < 0.8 ? 0xffb870 : 0xffd88a;          // solnedgång i band
        if (Math.hypot(x + 0.5 - sunX, (y + 0.5 - sunY) * 1.1) < 3.2) col = y < sunY ? 0xfff4c0 : col;
      } else if (y < hor) col = (x + y) % 3 === 0 ? 0x2a5a3a : 0x3a7a4a;                          // kullen
      else {
        const v = (y - hor) / (bot - hor + 1);
        col = v < 0.35 ? 0x5a8ad8 : v < 0.7 ? 0x4474c4 : 0x2e5aa8;                               // sjön
        if (Math.abs(x + 0.5 - sunX) < 2.5 - v * 1.5 && (y - hor) % 2 === 0) col = 0xffd88a;      // solstråken i vattnet
      }
      P.px(x, y, col);
    }
    // stugan på kullen: röd med vita knutar och mörkt tak
    const hx = x0 + 4, hy = hill(hx + 2) - 4;
    blit(P, hx, hy, ['..kk..', '.kkkk.', 'kkkkkk', 'wrrrrw', 'wryrrw'], { k: 0x3a2a2a, r: 0xc83a2a, w: WHITE, y: 0xffe070 });
    // pusselbitarnas skarvar (svaga)
    for (let x = x0; x < x0 + fw; x++) if ((x - x0) % 7 !== 3) P.px(x, yF + R(fh * 0.74), WHITE, 0.22);
    for (let y = yF + 7; y <= bot; y++) if ((y - yF) % 6 !== 2) P.px(x0 + 15, y, WHITE, 0.22);
    // etikett nere till höger över sjön: 500 och en pusselbit
    const lx = x0 + fw - 14, ly = bot - 6;
    for (let y = ly; y < ly + 7; y++) for (let x = lx; x < lx + 14; x++) if (!(y === ly && x === lx)) P.px(x, y, y === ly + 6 ? 0xd8d0c4 : WHITE);
    sqText(P, '500', lx + 2, ly + 1, 5, 0xe0306a, 1);
    c.olAmt = 0.25;
  } else {
    for (let y = yF; y <= bot; y++) for (let x = x0; x < x0 + fw; x++) {
      const i = x - x0, j = y - yF, mx = i < fw / 2, my = j < fh / 2 + 3;
      let col = j < 7 ? 0xfaf6ee : mx && my ? 0xe84a3a : !mx && my ? 0x3a7bd5 : mx ? 0xffc830 : 0x46a35a;
      if (j >= 7 && (Math.abs(i - fw / 2 + 0.5) < 1.6 || Math.abs(j - (fh + 7) / 2 + 0.5) < 1.6)) col = 0xf4f0e6;   // korset
      P.px(x, y, col);
    }
    // FIA i rött på vit list
    sqText(P, $t('FIA'), R(x0 + fw / 2 - 5.5), yF + 1, 5, 0xc8283a, 1);
    // pjäser i hörnen
    const pj = (px, py, col) => blit(P, px, py, ['.h.', 'hbh', 'bbb'], { h: mix(col, WHITE, 0.4), b: col });
    pj(x0 + 2, yF + 9, 0xa01c28); pj(x0 + fw - 5, yF + 9, 0x1a4a98); pj(x0 + 2, bot - 3, 0xc89010); pj(x0 + fw - 5, bot - 3, 0x2a7a3a);
    // tärning
    blit(P, R(x0 + fw / 2) - 2, R(yF + (fh + 7) / 2) - 2, ['wwww', 'wkww', 'wwkw', 'wwww'], { w: WHITE, k: 0x1a1a22 });
    c.olAmt = 0.25;
  }
}

// ======================= BADANKA =======================
function paintAnka(c) {
  const { P } = c, bot = -2;
  const T = tonesOf(0xffd23a);
  ball(P, 0.5, bot - 2.5, 5.5, 3.2, T);                     // kroppen
  // stjärten uppåt bak (höger)
  blit(P, 4, bot - 6, ['.y', 'yy', 'yY'], { y: T.li, Y: T.ba });
  ball(P, -2.5, bot - 7, 3.4, 3.2, T, 0.04);                // huvudet
  blit(P, -8, bot - 7, ['ooo.', 'Oooo', '.OO.'], { o: 0xff9030, O: 0xe06a20 });    // näbben
  blit(P, -4, bot - 9, ['wk', 'kk'], { k: INK, w: WHITE });
  P.px(-5, bot - 6, BLUSH, 0.6);
  // vingen
  for (const [x, y] of [[0, bot - 4], [1, bot - 3], [2, bot - 3], [3, bot - 3], [4, bot - 4]]) P.px(x, y, T.sh);
  P.px(-2, bot - 9, WHITE);
}

// ======================= SNURRA (fyra rotationslägen) =======================
function paintSnurra(c) {
  const { P, face } = c, bot = -2;
  const ph = +(String(face).slice(1)) || 0;
  // profilen: knopp, handtag, bred skiva, avsmalnande kropp och metallspets
  const prof = [2, 1, 1, 3, 5, 6, 6, 6, 5, 4, 3, 2, 1, 1];
  const top = bot - prof.length + 1;
  const bands = [0xe84a3a, 0xffd23a, 0x3a7bd5, 0x46a35a, 0xff8ac0];
  const bandOf = [0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 0, 0];
  prof.forEach((hw, j) => {
    const y = top + j;
    for (let x = -hw; x < hw; x++) {
      const nx = (x + 0.5) / hw;
      let col;
      if (j < 3) col = j === 0 ? (x < 0 ? 0xe84a3a : 0xb83028) : x < 0 ? 0xc8945a : 0x8a5a34;   // knopp och handtag
      else if (j >= prof.length - 2) col = x < 0 ? 0xb8bcc8 : 0x6a6a74;                        // metallspetsen
      else {
        col = bands[bandOf[j]];
        // små vita prickar som vandrar runt när den snurrar
        const lon = Math.asin(clamp(nx, -1, 1)) / Math.PI + 0.5;
        if (j === 6 || j === 9) { const k = (lon * 8 + ph * 0.5 + (j === 9 ? 0.5 : 0)) % 2; if (k < 0.5) col = WHITE; }
        const L = 0.58 - 0.4 * nx - (j === 3 ? -0.15 : 0);
        col = L > 0.8 ? mix(col, WHITE, 0.4) : L > 0.62 ? mix(col, WHITE, 0.15) : L < 0.3 ? mix(col, 0x2a1a3a, 0.32) : L < 0.45 ? mix(col, 0x2a1a3a, 0.14) : col;
      }
      P.px(x, y, col);
    }
  });
  P.px(-4, top + 5, WHITE); P.px(-3, top + 4, WHITE);
}

// ======================= DOCKOR =======================
function paintDocka(c) {
  const { P, o } = c, bot = -2;
  const SK = tonesOf(0xf8d2b4);
  if (o.typ === 'flicka') {
    const HR = tonesOf(0x9a5230), DR = tonesOf(0xff8ab4);
    // ben och skor
    for (const s of [-1, 1]) {
      const lx = s < 0 ? -3 : 1;
      for (let y = bot - 5; y <= bot - 2; y++) { P.px(lx, y, WHITE); P.px(lx + 1, y, 0xe8e4f0); }
      P.px(lx, bot - 1, 0xc8283a); P.px(lx + 1, bot - 1, 0xc8283a); P.px(lx + (s < 0 ? -1 : 2), bot - 1, 0xa01c28);
    }
    // klänningen (A-linje) med prickar och krage
    for (let j = 0; j < 9; j++) {
      const y = bot - 14 + j, hw = 3 + Math.floor(j * 0.5);
      for (let x = -hw; x < hw; x++) {
        let col = pick(DR, 0.66 - 0.25 * (x + 0.5) / hw - 0.15 * j / 9, x, y, 0.1);
        if ((x + j * 2 + 100) % 4 === 0 && j % 2 === 1) col = WHITE;
        if (j === 8) col = 0xfff0f6;
        P.px(x, y, col);
      }
    }
    blit(P, -3, bot - 14, ['ww..ww'], { w: WHITE });
    // armar
    for (const s of [-1, 1]) for (let j = 0; j < 5; j++) P.px(s < 0 ? -5 - (j > 2 ? 0 : 0) : 4, bot - 13 + j, j === 4 ? SK.ba : DR.sh);
    P.px(-5, bot - 8, SK.ba); P.px(4, bot - 8, SK.ba);
    // flätorna (bakom huvudet), huvudet, luggen
    for (const s of [-1, 1]) for (let j = 0; j < 7; j++) P.px(s < 0 ? -6 + (j > 4 ? 0 : 0) : 5, bot - 18 + j, (j % 2) ? HR.sh : HR.ba);
    P.px(-6, bot - 11, 0x3a7bd5); P.px(5, bot - 11, 0x3a7bd5);
    ball(P, 0, bot - 18.5, 4.6, 4.4, SK, 0.05, 0.08);
    ellEach(0, bot - 20.2, 4.9, 3.2, (x, y, nx, ny) => { if (ny < 0.35 || Math.abs(nx) > 0.75) P.px(x, y, pick(HR, 0.66 - 0.3 * nx - 0.3 * ny, x, y, 0.12)); });
    blit(P, -3, bot - 18, ['k....k'], { k: INK });
    P.px(-3, bot - 16, BLUSH, 0.8); P.px(2, bot - 16, BLUSH, 0.8);                           // kinderna (inne på huvudet)
    P.px(-1, bot - 16, 0xd04a5a); P.px(0, bot - 16, 0xd04a5a);
  } else {
    const BL = tonesOf(0xffa8c8);
    // filten: en rund bylte med vit kant
    ellEach(0, bot - 6.5, 6.8, 6.5, (x, y, nx, ny) => {
      let col = pick(BL, 0.64 - 0.3 * nx - 0.3 * ny, x, y, 0.16);
      if (Math.abs(nx + ny * 0.4) < 0.12 && ny > -0.2) col = BL.sh;                          // vecket
      if ((x + y + 100) % 5 === 0 && ny > -0.1) col = mix(col, WHITE, 0.5);                  // små hjärtan-prickar
      P.px(x, y, col);
    });
    // ansiktet med spetsmössa
    ellEach(0, bot - 11.5, 4.6, 4.4, (x, y, nx, ny) => P.px(x, y, ny < -0.35 || Math.abs(nx) > 0.8 ? (hash(x, y, 3) > 0.5 ? WHITE : 0xeae6f2) : pick(SK, 0.7 - 0.25 * nx - 0.2 * ny, x, y, 0.08)));
    for (let x = -5; x < 5; x++) if ((x & 1) === 0) P.px(x, bot - 16, WHITE);
    blit(P, -3, bot - 12, ['k....k', '.k..k.'].map((r) => r), { k: INK });                    // sovande ögon
    P.px(-3, bot - 10, BLUSH, 0.8); P.px(2, bot - 10, BLUSH, 0.8);
    blit(P, -1, bot - 10, ['bb', 'BB'], { b: 0x5ab0f0, B: 0x3a7bd5 });                        // nappen
  }
  c.olAmt = 0.34;
}

// ======================= BAMBUKORGEN =======================
// En ångkorg av bambu snett ovanifrån: kort cylinder med två bambuband (med mörka
// snörningsstygn) åtskilda av en mörk skarv, och ett lock som sticker ut lite över kanten
// med en ljus flätad ovansida, en ring längs kanten och en knopp.
// Stängd = varan. Öppen = som i butiken: 'bak' (bakre kanten och insidan) och 'fram'
// (framväggen, ritas över dumplingen så att den sitter NERE i korgen).
const BAMBU = { hi: 0xfae6b0, li: 0xeccb88, ba: 0xd8aa60, sh: 0xa8763a, dp: 0x7a4e24 };
const BT = [BAMBU.dp, BAMBU.sh, BAMBU.ba, BAMBU.li, BAMBU.hi];
// ton 0–4 flyttad efter var på cylindern pixeln sitter (ljus från vänster)
const bt = (i, nx) => BT[clamp(i + (nx > 0.6 ? -2 : nx > 0.2 ? -1 : nx < -0.55 ? 1 : 0), 0, 4)];
function korgGeom(u) {
  const half = 12 * u, ry = 2.5 * u, hW = 7 * u, lidH = 2 * u, bot = -2;
  return { half, ry, hW, lidH, bot, rimY: bot - hW - ry };      // rimY = kantellipsens mittlinje
}
export function korgSeat(size = 1) {
  const u = clamp(size | 0 || 1, 1, 4), g = korgGeom(u);
  return { dx: 0, dy: R(g.rimY + g.ry) + u };               // en rad av dumplingen döljs av kanten
}
function paintKorg(c) {
  const { P, u } = c, part = c.face === 'vila' ? 'stangd' : c.face;
  const g = korgGeom(u), { half, ry, hW, rimY } = g;
  const E = (x, h = half) => Math.sqrt(Math.max(0, 1 - Math.pow((x + 0.5) / h, 2)));
  // framväggen: rad k (0 = kanten) → ton
  const wallTone = (k, x) => {
    const kk = Math.floor(k / u), bands = [4, 3, 3, 2, 1, 3, 3, 2];
    let t = bands[Math.min(kk, bands.length - 1)];
    if ((kk === 2 || kk === 6) && (x + 100 + (kk === 6 ? 1 : 0)) % (3 * u) === 0) t = 1;   // snörningsstygn
    if (kk === 4) t = 0.5;                                                                  // skarven
    return t;
  };
  const wall = () => {
    for (let x = -half; x < half; x++) {
      const nx = (x + 0.5) / half, e = E(x), yt = R(rimY + ry * e);
      for (let k = 0; k <= hW; k++) {
        if (k === hW && Math.abs(nx) > 0.88) continue;                  // rundad nederkant
        const t = wallTone(k, x);
        P.px(x, yt + k, t === 0.5 ? mix(bt(1, nx), BAMBU.dp, 0.5) : bt(t, nx));
      }
    }
  };
  if (part === 'stangd') {
    wall();
    const hl = half + u, lry = ry + 0.5 * u, cy = rimY - g.lidH;
    for (let x = -hl; x < hl; x++) {
      const nx = (x + 0.5) / hl, e = E(x, hl);
      const yT0 = R(cy - lry * e), yT1 = R(cy + lry * e), yB = R(rimY + lry * e) + u;
      if (Math.abs(x + 0.5) < half) P.px(x, yB + 1, mix(bt(2, nx), BAMBU.dp, 0.55));   // skugga under locket
      for (let y = yT0; y <= yB; y++) {
        let col;
        if (y <= yT1) {                                                // ovansidan: ljus, flätad
          const v = (y - yT0) / Math.max(1, yT1 - yT0);
          col = bt(v < 0.2 ? 4 : 3, nx - 0.2);
          if ((x + y * 2 + 100) % (3 * u) === 0 && y > yT0) col = mix(col, BAMBU.ba, 0.6);
        } else {                                                       // kantbandet
          const k = y - yT1 - 1;
          col = y === yB ? bt(1, nx) : k === 0 ? bt(4, nx) : bt(3, nx);
          if (k > 0 && y < yB && (x + 100) % (3 * u) === 1) col = bt(1, nx);
        }
        P.px(x, y, col);
      }
    }
    // ringen längs lockets kant och knoppen i mitten
    const rx = hl - 2.2 * u, rr = lry - 1.1 * u, seen = new Set();
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const X = Math.floor(Math.cos(a) * rx), Y = R(cy + Math.sin(a) * rr);
      if (seen.has(X + ',' + Y)) continue;
      seen.add(X + ',' + Y);
      P.px(X, Y, Math.sin(a) < 0 ? BAMBU.ba : BAMBU.sh);
    }
    blit(P, -u - 1, R(cy) - u, u >= 2 ? ['.HHh.', 'HHhhd', 'hhhdd', '.ddd.'] : ['Hh.', 'hdd'], { H: BAMBU.hi, h: BAMBU.ba, d: BAMBU.dp });
  } else if (part === 'bak') {
    // insidan: bakre innerväggen (mörk) och botten med ribbor
    for (let x = -half; x < half; x++) {
      const e = E(x), yb = R(rimY - ry * e), yf = R(rimY + ry * e);
      for (let y = yb; y <= yf; y++) {
        const v = (y - yb) / Math.max(1, yf - yb);
        let col;
        if (y === yb) col = BAMBU.hi;
        else if (y === yb + 1) col = BAMBU.li;
        else if (v < 0.5) col = ((x + 100) % (2 * u) === 0) ? mix(BAMBU.sh, BAMBU.dp, 0.6) : mix(BAMBU.sh, BAMBU.dp, 0.2 + v * 0.5);
        else col = ((x + 100) % (3 * u) === 0 || (y + 100) % (2 * u) === 0) ? 0x5a3616 : mix(BAMBU.ba, BAMBU.sh, 0.55);
        P.px(x, y, col);
      }
    }
    c.shadow = false;
  } else if (part === 'fram') {
    wall();
  }
}

// ======================= formerna =======================
const FORMS = {
  dumpling: paintDumpling, cube: paintCube, wedge: paintWedge, carton: paintCarton,
  brod: paintBrod, appel: paintAppel, kattass: paintKattass, kompis: paintKompis,
  nalle: paintNalle, bil: paintBil, tag: paintTag, klossar: paintKlossar, boll: paintBoll,
  jojo: paintJojo, pussel: (c) => paintKartong(c, 'pussel'), fia: (c) => paintKartong(c, 'fia'),
  anka: paintAnka, snurra: paintSnurra, docka: paintDocka, korg: paintKorg,
};

// ======================= korgen i butiken =======================
const KORG_PART = { hel: 'stangd', stangd: 'stangd', bak: 'bak', fram: 'fram' };
export function drawKorg(ctx, x, y, { open = false, part = 'hel', size = 1 } = {}) {
  x = Math.round(x); y = Math.round(y);
  if (!open) { const f = toyFrame('korg', 0, 'stangd', size); ctx.drawImage(f.c, x + f.x0, y + f.y0); return; }
  if (part === 'hel' || part === 'bak') { const f = toyFrame('korg', 0, 'bak', size); ctx.drawImage(f.c, x + f.x0, y + f.y0); }
  if (part === 'hel' || part === 'fram') { const f = toyFrame('korg', 0, 'fram', size); ctx.drawImage(f.c, x + f.x0, y + f.y0); }
}
export function drawToyIKorg(ctx, id, x, y, t = 0, squishy = null, size = 1) {
  const s = korgSeat(size);
  drawKorg(ctx, x, y, { open: true, part: 'bak', size });
  if (squishy) squishy.draw(ctx, x + s.dx, y + s.dy);
  else drawToy(ctx, id, x + s.dx, y + s.dy, t, { size });
  drawKorg(ctx, x, y, { open: true, part: 'fram', size });
}
void KORG_PART;
