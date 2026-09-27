// Underdelar (byxor, shorts, kjolar, klänningar, overaller), tryck på underdelen och skor.
// Se docs/PEOPLE-ARKITEKTUR.md.
//
// Benen ritar motorn själv (stå/gå/sitta, alla riktningar). En post i BOTTOM_REG styr
// HUR de ritas med egenskaper, och kan lägga till detaljer med funktioner:
//   bareFrom   – rad (0 = översta benraden) där bar hud börjar när man står; tal eller
//                (R) => tal. Saknas = byxben hela vägen ner. (shorts 3)
//   skirt      – (R) => antal rader kjol nedanför höften (0/saknas = ingen kjol). Kjol ⇒
//                inget bälte, bara smalben när man sitter, lätt skugga på benen under kjolen.
//   lapSkin    – sittande: låren är bar hud (shorts)
//   shinSkin   – sittande: smalbenen är bar hud (shorts; kjol ger det automatiskt)
//   belt       – false = inget bälte (standard: bälte på vuxna utan kjol)
//   crotch     – false = ingen mörk grenpixel (klänning)
//   folds      – true = veck i kjolen framifrån (klänning)
//   darkSole   – true = lite mörkare sula (shorts)
//   prep(R)    – t.ex. R.pants = R.shirt (klänningen har tröjans färg)
//   colorField – vilket färgfält redigeraren visar som underdelens färg (standard 'pants';
//                klänningen 'shirt'). uses: ['pants2', …] = fler färgfält att visa.
//   legRow(R, row) – anropas efter varje stående benrad: row = { x, y, w, j, n, left, far, side, bare }
//   front/back/side(R) – ritas efter höften/kjolen (R.hy = höftens översta rad)
// Färger: R.pants (underdelen), R.pants2 (look.pants2 – mönster/detaljer), R.skin.
//
// Ändra inte de gamla posterna – de är pixellåsta av tools/people-regress.mjs.
import { mix } from './util.js';

export const BOTTOM_REG = {
  jeans: {
    label: 'Jeans', group: 'Långbyxor',
    legRow(R, row) { if (!row.side && row.j === 4 && !row.bare) R.put(row.x + 1, row.y, R.pants.hi); }, // knäsöm
  },
  pants: { label: 'Byxor', group: 'Långbyxor' },
  shorts: { label: 'Shorts', group: 'Shorts', bareFrom: 3, lapSkin: true, shinSkin: true, darkSole: true },
  skirt: { label: 'Kjol', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 5), bareFrom: 3 },
  dress: { // klänning = kjol i tröjans färg (lite längre, utan bälte)
    label: 'Klän\u00adning', group: 'Klänningar',
    skirt: (R) => (R.K ? 3 : 5) + 1, bareFrom: (R) => (R.K ? 3 : 4), crotch: false, folds: true,
    colorField: 'shirt', // redigeraren: underdelens färg = tröjans
    prep(R) { R.pants = R.shirt; },
  },
};

// ---------- tryck/mönster på underdelen (look.bottomPrint, färg look.pants2 → R.pants2) ----------
// Ritas efter höften/kjolen med R.tag = TAG.pants: R.pattern(TAG.pants, (x, y) => … ? R.pants2 : null).
export const BOTTOM_PRINT_REG = {
  none: { label: 'Inget' },
};

// ---------- skor (look.shoeType, färg look.shoes → R.shoe, andra färg look.shoes2 → R.shoe2) ----------
// Skor ritas per fot med ett andra argument s:
//   front/back(R, s): s = { x, y, left, rows } – x = skons vänsterkant (bredd R.lw + 1),
//                     y = skons översta rad (sulan är y + 1), rows = benets rader [{ x, y, w }]
//   side(R, s):       s = { x, y, far, rows } – skon är x-1 … x+3 (tån åt höger), far = bortre foten
// Stövlar ritar uppåt över benets rader (rows).
const shoeFB = (R, s) => {
  const { rect, put, shoe, lw, back } = R, { x: sx, y: sy, left } = s;
  rect(sx, sy, lw + 1, 1, shoe.base);
  put(left ? sx + 1 : sx + lw - 1, sy, shoe.hi);
  rect(sx, sy + 1, lw + 1, 1, R.darkShoe ? shoe.lo : R.sole);
  if (back) rect(sx + 1, sy, lw - 1, 1, shoe.lo);
};
export const SHOE_REG = {
  normal: {
    label: 'Vanliga',
    front: shoeFB, back: shoeFB,
    side(R, s) {
      const { rect, put, shoe, L } = R, { x, y: sy, far } = s;
      const S = far ? { base: shoe.lo, hi: shoe.lo, lo: shoe.dk } : shoe;
      rect(x - 1, sy, 5, 1, S.base); put(x + 3, sy, S.hi);
      rect(x - 1, sy + 1, 5, 1, L.shoes === '#1c1c1c' ? shoe.lo : far ? mix(R.sole, 0x000000, 0.25) : R.sole);
    },
  },
};
