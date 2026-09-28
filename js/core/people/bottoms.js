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
// Egna egenskaper för posterna i den här filen (motorn bryr sig inte om dem):
//   fx(R, row)  – detaljer per benrad; anropas både stående (via legRow) och för smalbenen
//                 när man sitter framifrån/bakifrån (row.sit = true). k = rader från fotleden.
//   onePiece    – helplagg (klänning, jumpsuit, overall): tryck på underdelen hamnar även på
//                 livet och ärmarna.
//
// Ändra inte de gamla posterna (jeans, pants, shorts, skirt, dress, none, normal) – de är
// pixellåsta av tools/people-regress.mjs.
import { TAG, mix, ramp } from './util.js';

// ---------- färger som inte kommer ur looken ----------
const GOLD = 0xc9b27a;      // knappar/spännen (samma som motorns bältesspänne)
const SILVER = 0xc4cad0;    // blixtlås, clips, skridskoskenor
const REFLEX = 0xdfe6e8;    // reflexband
const THREAD = 0xe6e0d2;    // fransar på slitna jeans
const STRING = 0xf2f0ea;    // dragsko (samma vita som huvtröjans)
const DARK_SOLE = 0x2b2622; // grova sulor
const WOOD = ramp(0xc8955a);   // träskornas sula
const FUR = ramp(0xe8dfcc);    // pälskant
const CREAM_SOLE = 0xe9e6dc;   // ljus gummisula (samma som vanliga skor)
const LEATHER = ramp(0x5a3d2b); // läder (kiltens skärp och sporran)
const EMBROID = 0xe8dfcc;       // broderi (läderhosen)
const STOCKING = ramp(0xece8de); // vita strumpor (folkdräkt)
const LEAF = ramp(0x46a35a);    // blad/skaft i mönster
const JUTE = ramp(0xcfae78);    // flätad jutesula (espadriller)
const MOON_SOLE = 0xd9d6cc;     // ljusgrå gummisula (moonboots)

// ---------- hjälpare ----------
// Rita med en viss etikett: hud och knappar ska inte färgas om av mönster på underdelen.
function withTag(R, tag, fn) { const k = R.tag; R.tag = tag; fn(); R.tag = k; }
// Mörkare ramp för bortre benet i sidovy (samma som motorn använder)
const legRamp = (R, row, rp) => (row.far ? { hi: rp.lo, base: rp.lo, lo: rp.dk, dk: rp.dk } : rp);
// En benrad i en ramp med motorns skuggning (fram/bak: ljus yttre kant på vänster ben;
// sida: mörk baksida, ljus framsida)
function paintRow(R, row, rp) {
  const { x, y, w } = row, c = legRamp(R, row, rp);
  R.rect(x, y, w, 1, c.base);
  if (row.side) { R.put(x, y, c.lo); R.put(x + w - 1, y, c.hi); }
  else { R.put(row.left ? x : x + w - 1, y, row.left ? c.hi : c.lo); R.put(row.left ? x + w - 1 : x, y, c.lo); }
}
const skinRow = (R, row) => withTag(R, TAG.skin, () => paintRow(R, row, R.skin));
// yttre/inre kolumnen på ett ben framifrån/bakifrån
const outerX = (row) => (row.left ? row.x : row.x + row.w - 1);
const innerX = (row) => (row.left ? row.x + row.w - 1 : row.x);
// En pixel utanför benets yttre kant (vida byxben): fram/bak åt sidan, från sidan fram och bak
function widen(R, row, n = 1, c) {
  const p = legRamp(R, row, R.pants);
  if (row.side) { for (let i = 1; i <= n; i++) { R.put(row.x - i, row.y, c ?? p.lo); R.put(row.x + 2 + i, row.y, c ?? p.hi); } return; }
  for (let i = 1; i <= n; i++) R.put(row.left ? row.x - i : row.x + row.w - 1 + i, row.y, c ?? (row.left ? p.hi : p.lo));
  R.put(outerX(row), row.y, p.base);
}
// Sittande framifrån/bakifrån anropar motorn inte legRow – samma rader för smalbenen här.
function sitShins(R, fn) {
  const t = R.hipTop + R.bob + R.hipH + 3, n = R.shoeTop - t, bare = !!(R.E.bottom.shinSkin || R.skirted);
  for (const left of [true, false]) {
    const x = left ? 12 - R.lw : 12;
    for (let j = 0; j < n; j++) fn({ x, y: t + j, w: R.lw, j, n, left, far: false, side: false, bare, sit: true });
  }
}
const lapTop = (R) => R.hipTop + R.bob + R.hipH; // sittande: lårens översta rad (fram/bak)
// Modell med detaljer per benrad (fx): kopplar in legRow och de sittande smalbenen.
// Sidovyn får sina detaljer via legRow (motorn anropar den för varje benrad, även sittande),
// så side() behövs bara för det som ligger utanför benen (linning, fickor …).
function legs(def) {
  const f0 = def.front, b0 = def.back, s0 = def.side;
  return {
    ...def,
    legRow(R, row) { this.fx(R, row); },
    front(R) { if (R.sit) sitShins(R, (row) => this.fx(R, row)); if (f0) f0.call(this, R); },
    back(R) { if (R.sit) sitShins(R, (row) => this.fx(R, row)); if (b0) b0.call(this, R); },
    side(R) { if (s0) s0.call(this, R); },
  };
}
const kOf = (row) => row.n - 1 - row.j; // rader kvar till fotleden (0 = nedersta)

// Linning utan spänne (mjukisbyxor, leggings …) med valfri dragsko
function waistband(R, { c, string = false } = {}) {
  const col = c ?? R.pants.lo;
  if (R.side) { R.rect(9, R.hy, 7, 1, col); if (string && !R.K) withTag(R, TAG.extra, () => R.put(15, R.hy + 1, STRING)); return; }
  R.rect(12 - R.tw, R.hy, R.tw * 2, 1, col);
  if (string && R.front) withTag(R, TAG.extra, () => { R.put(11, R.hy + 1, STRING); R.put(12, R.hy + 1, STRING); if (!R.K && !R.sit) R.put(11, R.hy + 2, STRING); });
}
// Bakfickor (jeans): två små fickor på stussen
function backPockets(R) {
  if (R.sit) return;
  const y = R.hy + R.hipH - 1, { lo, hi } = R.pants;
  for (const x of [12 - R.lw, 12 + R.lw - 2]) { R.put(x, y, lo); R.put(x + 1, y, lo); R.put(x, y + 1, hi); }
}
// Hög midja: underdelen går upp över tröjans nedersta rader (instoppad tröja)
function highWaist(R, h, { buttons = 1, band = true } = {}) {
  const { pants } = R, y0 = R.hy - h;
  if (R.side) {
    R.rect(9, y0, 7, h, pants.base); for (let y = y0; y < R.hy; y++) { R.put(9, y, pants.lo); R.put(15, y, pants.hi); }
    if (band) R.rect(9, y0, 7, 1, pants.lo);
    return;
  }
  R.rect(12 - R.tw, y0, R.tw * 2, h, pants.base);
  for (let y = y0; y < R.hy; y++) { R.put(12 - R.tw, y, pants.hi); R.put(11 + R.tw, y, pants.lo); }
  if (band) R.rect(12 - R.tw, y0, R.tw * 2, 1, pants.lo);
  if (R.front && buttons) withTag(R, TAG.belt, () => { R.put(12, y0 + (h > 1 ? 1 : 0), GOLD); if (buttons > 1) R.put(12, y0 + 2, GOLD); });
}
// Bröstlapp med hängslen (snickarbyxor, hängselkjol, täckbyxor) – ritas i afterTorso
function bib(R, { buttons = true, pocket = true, tall = 0 } = {}) {
  const { pants, hy, ty0, K } = R, bh = (K ? 3 : 4) + tall, y0 = hy - bh;
  if (R.front) {
    const bw = K ? 4 : 6, x0 = 12 - bw / 2, x1 = x0 + bw - 1;
    R.rect(x0, y0, bw, bh, pants.base);
    for (let y = y0; y < hy; y++) { R.put(x0, y, pants.hi); R.put(x1, y, pants.lo); }
    R.rect(x0 + 1, y0, bw - 2, 1, pants.hi);
    if (pocket && !K) R.rect(11, y0 + 2, 2, 1, pants.lo);
    for (let y = ty0; y < y0; y++) { R.put(x0, y, pants.base); R.put(x1, y, pants.lo); } // hängslen
    if (buttons) withTag(R, TAG.belt, () => { R.put(x0, y0, GOLD); R.put(x1, y0, GOLD); });
  } else if (R.back) {
    // korsade hängslen i ryggen + en liten lapp vid midjan
    const x0 = K ? 10 : 9, x1 = K ? 13 : 14, h = hy - 1 - ty0;
    for (let y = ty0; y < hy - 1; y++) {
      const t = (y - ty0) / Math.max(1, h - 1), d = Math.round(t * (x1 - x0));
      R.put(x0 + d, y, pants.base); R.put(x1 - d, y, pants.lo);
    }
    R.rect(K ? 10 : 10, hy - 1, K ? 4 : 4, 1, pants.base);
  } else {
    R.rect(14, y0, 2, bh, pants.base); R.put(15, y0, pants.hi); R.put(14, y0, pants.lo);
    for (let y = ty0; y < y0; y++) R.put(y - ty0 < 2 ? 12 : 13, y, pants.base); // hängslet över axeln
    if (buttons) withTag(R, TAG.belt, () => R.put(14, y0, GOLD));
  }
}
// Smala hängslen i kontrastfärg (look.pants2) med clips
function thinStraps(R, rp, clip = SILVER) {
  const { ty0, hy, tw } = R;
  withTag(R, TAG.extra, () => {
    if (R.front) {
      for (const x of [12 - tw + 2, 11 + tw - 2]) { for (let y = ty0; y < hy; y++) R.put(x, y, rp.base); R.put(x, hy - 1, clip); }
    } else if (R.back) {
      const a = 12 - tw + 2, b = 11 + tw - 2, m = ty0 + Math.min(4, hy - ty0 - 2);
      for (let y = ty0; y < hy; y++) {
        if (y < m) { const d = Math.round((y - ty0) / (m - ty0) * (11 - a)); R.put(a + d, y, rp.base); R.put(b - d, y, rp.lo); }
        else { R.put(11, y, rp.base); R.put(12, y, rp.lo); }
      }
      R.put(11, hy - 1, clip); R.put(12, hy - 1, clip);
    } else {
      for (let y = ty0; y < hy; y++) R.put(y - ty0 < 2 ? 12 : 13, y, rp.base);
      R.put(13, hy - 1, clip);
    }
  });
}
// Knytband i midjan (klänningar, jumpsuits): band i färgen rp + rosett på ena sidan
function sash(R, rp, { bow = true, tails = 2 } = {}) {
  withTag(R, TAG.extra, () => {
    if (R.side) { R.rect(9, R.hy, 7, 1, rp.base); R.put(15, R.hy, rp.hi); if (bow) { R.put(8, R.hy, rp.base); for (let i = 1; i <= tails; i++) R.put(8, R.hy + i, rp.lo); } return; }
    R.rect(12 - R.tw, R.hy, R.tw * 2, 1, rp.base); R.put(12 - R.tw, R.hy, rp.hi);
    if (!bow) return;
    if (R.back) { R.put(11, R.hy, rp.hi); R.put(10, R.hy, rp.lo); R.put(13, R.hy, rp.lo); R.put(11, R.hy + 1, rp.lo); R.put(12, R.hy + 1, rp.lo); return; }
    const x = 12 + R.tw - 3; R.put(x, R.hy, rp.hi); for (let i = 1; i <= tails; i++) R.put(x + (i & 1), R.hy + i, rp.lo);
  });
}
// Kjolens rader ([y0, y1)) – för mönster som bara hör till kjolen
const skirtRows = (R) => [R.hy, R.hy + R.skirtLen];
// Extra vidd på kjolen: rad j (0 = midjan) blir `add` pixlar bredare på varje sida
function flare(R, j, add, c) {
  const y = R.hy + j, { pants } = R;
  if (R.side) { const w = Math.min(2, (j + 1) >> 1); for (let i = 1; i <= add; i++) { R.put(9 - w - i, y, c ?? pants.lo); R.put(15 + w + i, y, c ?? pants.base); } return; }
  const w = R.tw + Math.min(2, (j + 1) >> 1);
  for (let i = 0; i < add; i++) { R.put(11 - w - i, y, c ?? pants.hi); R.put(12 + w + i, y, c ?? pants.lo); }
}
// Kjol ända ner till fotleden (maxikjol, balklänning …)
const toFloor = (R) => R.shoeTop - R.hy;
// Klänningar/jumpsuits: underdelen har tröjans färg, tryck hamnar även på livet
const DRESS = { crotch: false, colorField: 'shirt', onePiece: true, prep(R) { R.pants = R.shirt; } };
// Glitter som blinkar när man går (paljetter)
// n = hur glest (större = färre glittrande pixlar)
const sparkle = (R, x, y, n = 11) => { const v = (x * 5 + y * 3 + R.frame * 2) % n; return v === 0 ? mix(R.pants.hi, 0xffffff, 0.7) : v === 5 ? R.pants.hi : null; };

// ---------- underdelarna ----------
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

  // ================= jeans =================
  jeansRipped: legs({ // slitna jeans: hål på knäna och ett på låret, vita fransar
    label: 'Slitna jeans', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare || R.back || row.sit || row.far) return;
      const knee = R.K ? 2 : 4, { x, y, j } = row;
      if (row.side) {
        if (j === knee) withTag(R, TAG.skin, () => R.put(x + 2, y, R.skin.base));
        if (j === knee - 1 || j === knee + 1) withTag(R, TAG.extra, () => R.put(x + 2, y, THREAD));
        return;
      }
      const kj = row.left ? knee : knee + 1;
      if (j === kj) withTag(R, TAG.skin, () => { R.put(x + 1, y, R.skin.base); R.put(x + 2, y, R.skin.lo); });
      if (j === kj - 1 || j === kj + 1) withTag(R, TAG.extra, () => R.put(x + (j < kj ? 1 : 2), y, THREAD));
      if (!R.K && !row.left && j === 1) withTag(R, TAG.extra, () => { R.put(x + 1, y, THREAD); R.put(x + 2, y, R.skin.lo); });
    },
    front(R) {
      if (!R.sit) return;
      const t = lapTop(R) + 2;
      withTag(R, TAG.skin, () => { R.put(12 - R.lw, t, R.skin.base); R.put(11 - R.lw + 2, t, R.skin.lo); R.put(13, t, R.skin.base); });
    },
    back: backPockets,
  }),
  jeansCuffed: legs({ // uppvikta jeans: ljus uppvikning, bar fotled
    label: 'Uppvikta jeans', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = R.pants;
      if (k === 0) skinRow(R, row);
      else if (k === 1) paintRow(R, row, { hi: mix(p.hi, 0xffffff, 0.3), base: mix(p.hi, 0xffffff, 0.12), lo: p.base, dk: p.lo });
      else if (!row.side && !row.sit && row.j === (R.K ? 2 : 4)) R.put(row.x + 1, row.y, p.hi);
    },
    back: backPockets,
  }),
  jeansFlare: legs({ // utsvängda: vidare nertill
    label: 'Utsvängda jeans', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row);
      if (k <= (R.K ? 1 : 2)) widen(R, row, k === 0 && !R.K ? 2 : 1);
      if (!row.side && !row.sit && row.j === (R.K ? 1 : 3)) R.put(row.x + 1, row.y, R.pants.hi);
    },
    back: backPockets,
  }),
  jeansBaggy: legs({ // baggy: vida ben hela vägen, lågt gren, veck nertill
    label: 'Baggy jeans', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = legRamp(R, row, R.pants);
      if (row.j >= 1 || row.sit) widen(R, row, 1);
      if (k === 0) { if (row.side) { R.put(row.x, row.y, p.dk); R.put(row.x + 1, row.y, p.lo); } else { R.put(row.x + 1, row.y, p.lo); R.put(row.x + row.w - 2, row.y, p.lo); } }
      if (k === 2 && !row.side) R.put(row.left ? row.x + 1 : row.x + 2, row.y, p.lo);
      if (!row.side && !row.sit && row.j === 1) R.put(innerX(row), row.y, R.pants.dk);
    },
    back: backPockets,
  }),
  jeansHigh: legs({ // högmidjade: linningen går upp över tröjan
    label: 'Högmidjade jeans', group: 'Långbyxor', belt: false,
    fx(R, row) { if (!row.bare && !row.side && !row.sit && row.j === (R.K ? 2 : 4)) R.put(row.x + 1, row.y, R.pants.hi); },
    afterTorso(R) { highWaist(R, R.K ? 1 : 2, { buttons: 2 }); },
    back: backPockets,
  }),
  jeansPatched: legs({ // lappade: tygbitar i mönsterfärgen på knä och lår
    label: 'Lappade jeans', group: 'Långbyxor', uses: ['pants2'],
    fx(R, row) {
      if (row.bare || row.sit || R.back || row.far) return;
      const P = R.pants2, knee = R.K ? 2 : 4, { x, y, j } = row;
      withTag(R, TAG.extra, () => {
        if (row.side) { if (j === knee || j === knee + 1) { R.put(x + 1, y, j === knee ? P.hi : P.base); R.put(x + 2, y, P.base); } return; }
        if (row.left && (j === knee || j === knee + 1)) { R.put(x + 1, y, j === knee ? P.hi : P.base); R.put(x + 2, y, P.lo); }
        if (!row.left && (j === 1 || j === 2) && !R.K) { R.put(x + 1, y, j === 1 ? P.hi : P.base); R.put(x + 2, y, P.base); }
        if (!row.left && R.K && j === 3) R.put(x + 1, y, P.base);
      });
    },
    back(R) { backPockets(R); if (!R.sit) withTag(R, TAG.extra, () => { const y = R.hy + R.hipH; R.put(9, y + 1, R.pants2.hi); R.put(10, y + 1, R.pants2.base); R.put(9, y + 2, R.pants2.base); R.put(10, y + 2, R.pants2.lo); }); },
  }),

  // ================= långbyxor =================
  cargo: legs({ // cargobyxor: stora benfickor med lock
    label: 'Cargo\u00adbyxor', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare || row.sit) return;
      const pj = R.K ? 1 : 3, d = row.j - pj, p = legRamp(R, row, R.pants), { x, y } = row;
      if (d < 0 || d > (R.K ? 1 : 2)) return;
      if (row.side) {
        if (d === 0) { R.put(x, y, p.lo); R.put(x + 1, y, p.hi); R.put(x + 2, y, p.hi); }
        else { R.put(x + 1, y, d === (R.K ? 1 : 2) ? p.lo : p.base); R.put(x, y, p.dk); }
        return;
      }
      const o = outerX(row), i = row.left ? o + 1 : o - 1, last = d === (R.K ? 1 : 2);
      if (d === 0) { R.put(o, y, p.hi); R.put(i, y, p.hi); R.put(row.left ? i + 1 : i - 1, y, p.lo); }
      else { R.put(i, y, last ? p.dk : p.base); R.put(o, y, last ? p.dk : row.left ? p.base : p.lo); R.put(row.left ? i + 1 : i - 1, y, p.lo); }
    },
    back: backPockets,
  }),
  chinos: legs({ // chinos: pressveck, snedfickor och liten uppvikning
    label: 'Chinos', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = R.pants;
      if (k === 0 && !row.sit) { paintRow(R, row, { hi: mix(p.hi, 0xffffff, 0.2), base: p.hi, lo: p.base, dk: p.lo }); return; }
      if (!row.side && !row.sit) R.put(row.left ? row.x + 2 : row.x + 1, row.y, p.hi);
    },
    front(R) { if (R.sit) return; const y = R.hy + R.hipH - 1; R.put(12 - R.tw + 1, y, R.pants.lo); R.put(10 + R.tw, y, R.pants.lo); },
  }),
  suitPants: legs({ // kostymbyxor: skarpt pressveck och fall över skon
    label: 'Kostym\u00adbyxor', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare || row.side) return;
      R.put(row.left ? row.x + 2 : row.x + 1, row.y, R.pants.hi);
      if (kOf(row) === 0) R.put(row.left ? row.x + 1 : row.x + 2, row.y, R.pants.lo);
    },
  }),
  corduroy: legs({ // manchester: räfflor på längden
    label: 'Manchester\u00adbyxor', group: 'Långbyxor',
    fx() {},
    front(R) { const p = R.pants, m = mix(p.base, p.lo, 0.55); R.pattern(TAG.pants, (x, y, c) => ((x & 1) && c === p.base ? m : c === p.lo && (x & 1) ? p.dk : null)); },
    back(R) { this.front(R); },
    side(R) { const p = R.pants, m = mix(p.base, p.lo, 0.55), f = mix(p.lo, p.dk, 0.5); R.pattern(TAG.pants, (x, y, c) => (!(x & 1) ? null : c === p.base ? m : c === p.lo ? f : null)); },
  }),
  leather: legs({ // skinnbyxor: blanka högdagrar
    label: 'Skinn\u00adbyxor', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare) return;
      const s = mix(R.pants.hi, 0xffffff, row.far ? 0.12 : 0.32), { j } = row;
      const hit = row.sit ? j === 0 : R.K ? (j === 1 || j === 3) : (j === 1 || j === 2 || j === 5);
      if (!hit) return;
      withTag(R, TAG.extra, () => R.put(row.side ? row.x + 1 : row.left ? row.x + 1 : row.x + 2, row.y, s));
    },
  }),
  wide: legs({ // vida byxor: hög midja, vida ben som faller ner över skorna
    label: 'Vida byxor', group: 'Långbyxor', belt: false, crotch: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row);
      if (row.j >= 1 || row.sit) widen(R, row, k <= 1 && !R.K && !row.sit ? 2 : 1);
      if (!row.side && row.j >= 2) R.put(row.left ? row.x + 2 : row.x + 1, row.y, R.pants.lo);
    },
    afterTorso(R) { highWaist(R, R.K ? 1 : 2, { buttons: 0 }); },
  }),
  capri: legs({ // capribyxor: slutar mitt på vaden, uppvikta
    label: 'Capri\u00adbyxor', group: 'Långbyxor', bareFrom: (R) => (R.K ? 4 : 6), darkSole: true,
    fx(R, row) {
      const b = R.K ? 4 : 6, p = R.pants, cuff = { hi: mix(p.hi, 0xffffff, 0.2), base: p.hi, lo: p.base, dk: p.lo };
      if (row.sit) { const k = kOf(row); if (k <= (R.K ? 0 : 1)) skinRow(R, row); else if (k === 2) paintRow(R, row, cuff); return; }
      if (row.j === b - 1) paintRow(R, row, cuff);
    },
  }),
  jodhpurs: legs({ // ridbyxor: vida över låren, tighta under knät, knälapp på insidan
    label: 'Rid­byxor', group: 'Långbyxor',
    fx(R, row) {
      if (row.bare || row.sit) return;
      const { j } = row, K = R.K, kj = K ? 2 : 4;
      if (j >= 1 && j <= (K ? 1 : 3)) widen(R, row, !K && j === 2 ? 2 : 1);
      if (j !== kj && j !== kj + 1) return;
      const c = mix(legRamp(R, row, R.pants).lo, LEATHER.base, 0.6);
      withTag(R, TAG.extra, () => {
        if (row.side) { R.put(row.x + 1, row.y, c); return; }
        R.put(innerX(row), row.y, c); R.put(row.left ? row.x + row.w - 2 : row.x + 1, row.y, c);
      });
    },
  }),
  knickers: legs({ // knickers (golfbyxor): pösiga till under knät, mudd och mönstrade knästrumpor
    label: 'Knickers', group: 'Långbyxor', uses: ['pants2'],
    fx(R, row) {
      if (row.bare) return;
      const p = R.pants, pj = R.K ? 2 : 4, cuff = { hi: p.base, base: p.lo, lo: p.dk, dk: p.dk };
      const sock = () => withTag(R, TAG.extra, () => {
        paintRow(R, row, R.pants2);
        const S = legRamp(R, row, R.pants2), odd = row.y & 1; // sicksack i strumpan
        R.put(row.side ? row.x + 1 : row.x + 1 + odd, row.y, odd ? S.hi : S.lo);
      });
      if (row.sit) { if (row.j === 0) paintRow(R, row, cuff); else sock(); return; }
      if (row.j === pj) widen(R, row, 1);
      else if (row.j === pj + 1) paintRow(R, row, cuff);
      else if (row.j > pj + 1) sock();
    },
  }),
  culottes: legs({ // byxkjol: vida ben som slutar nedanför knät – ser ut som en kjol
    label: 'Byxkjol', group: 'Långbyxor', bareFrom: (R) => (R.K ? 3 : 5), belt: false, crotch: false, darkSole: true,
    fx(R, row) {
      const K = R.K, p = R.pants;
      if (row.sit) { if (kOf(row) <= (K ? 0 : 1)) skinRow(R, row); else widen(R, row, 1); return; }
      if (row.bare || row.j < 1) return;
      const hem = row.j === (K ? 2 : 4), n = row.j >= (K ? 2 : 3) ? 2 : 1;
      if (hem) paintRow(R, row, { hi: p.base, base: p.lo, lo: p.dk, dk: p.dk });
      widen(R, row, n, hem ? legRamp(R, row, p).lo : undefined);
      if (hem && !row.side) R.put(outerX(row), row.y, legRamp(R, row, p).lo);
    },
    front(R) { waistband(R); if (R.front) withTag(R, TAG.belt, () => R.put(12, R.hy, GOLD)); },
    back(R) { waistband(R); },
    side(R) { waistband(R); },
  }),

  // ================= mjukis & träning =================
  joggers: legs({ // joggers: resår i midjan, mudd vid fotleden
    label: 'Joggers', group: 'Mjukis & träning', belt: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = R.pants;
      if (k === 0) paintRow(R, row, { hi: p.base, base: p.lo, lo: p.dk, dk: p.dk });
      else if (k === 1 && !row.side) R.put(row.left ? row.x + 1 : row.x + 2, row.y, p.hi);
    },
    front(R) { waistband(R, { string: true }); },
    back(R) { waistband(R); },
    side(R) { waistband(R, { string: true }); },
  }),
  sweatpants: legs({ // mjukisbyxor: påsiga, ljus resår, dragsko
    label: 'Mjukis\u00adbyxor', group: 'Mjukis & träning', belt: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = R.pants;
      if (k === 0) { paintRow(R, row, { hi: p.base, base: p.lo, lo: p.dk, dk: p.dk }); return; }
      if (k <= 2 && !row.sit) widen(R, row, 1);
      if (!row.side && row.j === (R.K ? 2 : 4) && !row.sit) R.put(row.left ? row.x + 1 : row.x + 2, row.y, p.hi);
    },
    front(R) { waistband(R, { c: R.pants.hi, string: true }); },
    back(R) { waistband(R, { c: R.pants.hi }); },
    side(R) { waistband(R, { c: R.pants.hi, string: true }); },
  }),
  trackPants: legs({ // träningsbyxor: rand längs sidan i mönsterfärgen
    label: 'Tränings\u00adbyxor', group: 'Mjukis & träning', belt: false, uses: ['pants2'],
    fx(R, row) {
      if (row.bare) return;
      const P = legRamp(R, row, R.pants2);
      withTag(R, TAG.extra, () => R.put(row.side ? row.x + 1 : outerX(row), row.y, row.side ? P.base : row.left ? P.hi : P.base));
    },
    front(R) {
      waistband(R, { string: true });
      if (R.sit) withTag(R, TAG.extra, () => { const t = lapTop(R); for (let j = 0; j < 3; j++) { R.put(12 - R.lw - 1, t + j, R.pants2.hi); R.put(12 + R.lw, t + j, R.pants2.base); } });
    },
    back(R) { waistband(R); },
    side(R) { waistband(R); withTag(R, TAG.extra, () => R.rect(12, R.hy + 1, 1, R.hipH - 1, R.pants2.base)); },
  }),
  leggings: legs({ // leggings: ingen gylf, blank högdager, bar fotled
    label: 'Leggings', group: 'Mjukis & träning', belt: false, crotch: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row);
      if (k === 0) { skinRow(R, row); return; }
      if (!row.side && !row.sit && row.j >= 1 && row.j <= (R.K ? 2 : 4)) R.put(row.left ? row.x + 1 : row.x + 2, row.y, R.pants.hi);
    },
    front(R) { waistband(R, { c: R.pants.dk }); },
    back(R) { waistband(R, { c: R.pants.dk }); },
    side(R) { waistband(R, { c: R.pants.dk }); },
  }),
  pajamas: legs({ // pyjamasbyxor: vida, resår med rosett, kantband nertill
    label: 'Pyjamas\u00adbyxor', group: 'Mjukis & träning', belt: false, uses: ['pants2'],
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row);
      if (k <= 1 && !row.sit) widen(R, row, 1);
      if (k === 0) withTag(R, TAG.extra, () => paintRow(R, row, R.pants2));
    },
    front(R) { waistband(R, { c: R.pants.hi }); if (!R.side) withTag(R, TAG.extra, () => { R.put(11, R.hy, R.pants2.base); R.put(12, R.hy, R.pants2.base); R.put(11, R.hy + 1, R.pants2.lo); }); },
    back(R) { waistband(R, { c: R.pants.hi }); },
    side(R) { waistband(R, { c: R.pants.hi }); },
  }),
  harem: legs({ // haremsbyxor: pösiga, låg gren, tajt mudd vid fotleden
    label: 'Harems­byxor', group: 'Mjukis & träning', belt: false, crotch: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = R.pants;
      if (k === 0) { paintRow(R, row, { hi: p.base, base: p.lo, lo: p.dk, dk: p.dk }); return; }
      if (row.sit) return;
      if (row.j >= 1) widen(R, row, k >= 2 && row.j >= (R.K ? 2 : 3) ? 2 : 1);
      if (!row.side && (k === 2 || k === 4)) R.put(row.left ? row.x + 1 : row.x + 2, row.y, p.lo); // veck
    },
    front(R) {
      waistband(R, { c: R.pants.hi });
      if (R.sit) return;
      const y = R.legTop + (R.K ? 2 : 4); // grenen hänger lågt
      R.put(11, y - 1, R.pants.lo); R.put(12, y - 1, R.pants.lo); R.put(11, y, R.pants.dk); R.put(12, y, R.pants.dk);
    },
    back(R) { waistband(R, { c: R.pants.hi }); },
    side(R) { waistband(R, { c: R.pants.hi }); },
  }),

  // ================= shorts =================
  bermuda: legs({ // bermudashorts: till knät, vida med uppvikning
    label: 'Bermuda\u00adshorts', group: 'Shorts', bareFrom: (R) => (R.K ? 3 : 5), shinSkin: true, darkSole: true,
    fx(R, row) {
      if (row.bare || row.sit) return;
      if (row.j === (R.K ? 2 : 4)) { const p = R.pants; paintRow(R, row, { hi: mix(p.hi, 0xffffff, 0.2), base: p.hi, lo: p.base, dk: p.lo }); widen(R, row, 1, row.side ? undefined : p.base); }
    },
  }),
  cargoShorts: legs({ // cargoshorts: knälånga med benfickor
    label: 'Cargo\u00adshorts', group: 'Shorts', bareFrom: (R) => (R.K ? 3 : 5), shinSkin: true, darkSole: true,
    fx(R, row) {
      if (row.bare || row.sit) return;
      const pj = R.K ? 1 : 2, d = row.j - pj, p = legRamp(R, row, R.pants), { x, y } = row;
      if (d < 0 || d > 1) { if (row.j === (R.K ? 2 : 4) && !row.side) R.put(outerX(row), y, p.lo); return; }
      if (row.side) { if (d === 0) { R.put(x, y, p.lo); R.put(x + 1, y, p.hi); R.put(x + 2, y, p.hi); } else R.put(x + 1, y, p.lo); return; }
      const o = outerX(row), i = row.left ? o + 1 : o - 1;
      if (d === 0) { R.put(o, y, p.hi); R.put(i, y, p.hi); } else R.put(i, y, p.lo);
    },
  }),
  denimShorts: legs({ // jeansshorts: korta med fransar och fickfoder som sticker ut
    label: 'Jeans\u00adshorts', group: 'Shorts', bareFrom: (R) => (R.K ? 1 : 2), lapSkin: true, shinSkin: true, darkSole: true,
    fx(R, row) {
      if (row.sit || row.far) return;
      const b = R.K ? 1 : 2;
      if (row.j === b) withTag(R, TAG.extra, () => { if (row.side) R.put(row.x + 1, row.y, THREAD); else { R.put(row.x + (row.left ? 1 : 2), row.y, THREAD); R.put(outerX(row), row.y, THREAD); } });
    },
    front(R) { if (!R.sit) withTag(R, TAG.extra, () => { R.put(12 - R.tw, R.hy + R.hipH, THREAD); R.put(11 + R.tw, R.hy + R.hipH, THREAD); }); },
    back(R) { backPockets(R); },
  }),
  swimTrunks: legs({ // badbyxor: resår, dragsko, slits i sidan
    label: 'Bad\u00adbyxor', group: 'Shorts', bareFrom: (R) => (R.K ? 2 : 3), lapSkin: true, shinSkin: true, darkSole: true, belt: false,
    fx(R, row) {
      if (row.bare || row.sit || row.side) return;
      if (row.j === (R.K ? 1 : 2)) withTag(R, TAG.skin, () => R.put(outerX(row), row.y, R.skin.lo));
    },
    front(R) { waistband(R, { string: true }); },
    back(R) { waistband(R); },
    side(R) { waistband(R, { string: true }); },
  }),
  bikeShorts: legs({ // cykelbyxor: tighta, till mitten av låret, kantband
    label: 'Cykel\u00adbyxor', group: 'Shorts', bareFrom: (R) => (R.K ? 3 : 4), shinSkin: true, darkSole: true, belt: false, crotch: false,
    fx(R, row) { if (!row.bare && !row.sit && row.j === (R.K ? 2 : 3)) paintRow(R, row, { hi: R.pants.lo, base: R.pants.dk, lo: R.pants.dk, dk: R.pants.dk }); },
    front(R) { waistband(R, { c: R.pants.dk }); },
    back(R) { waistband(R, { c: R.pants.dk }); },
    side(R) { waistband(R, { c: R.pants.dk }); },
  }),
  sportShorts: legs({ // träningsshorts: kantband i mönsterfärgen och slits
    label: 'Tränings\u00adshorts', group: 'Shorts', bareFrom: (R) => (R.K ? 2 : 3), lapSkin: true, shinSkin: true, darkSole: true, belt: false, uses: ['pants2'],
    fx(R, row) {
      if (row.bare || row.sit) return;
      if (row.j === (R.K ? 1 : 2)) {
        withTag(R, TAG.extra, () => paintRow(R, row, R.pants2));
        if (!row.side) withTag(R, TAG.skin, () => R.put(outerX(row), row.y, R.skin.lo));
      }
    },
    front(R) { waistband(R, { string: true }); },
    back(R) { waistband(R); },
    side(R) { waistband(R, { string: true }); withTag(R, TAG.extra, () => R.rect(12, R.hy + 1, 1, R.hipH, R.pants2.base)); },
  }),

  // ================= kjolar =================
  miniSkirt: { // minikjol: kort och rak, linning
    label: 'Minikjol', group: 'Kjolar', skirt: (R) => (R.K ? 2 : 3), bareFrom: 1, crotch: false,
    front(R) { R.rect(12 - R.tw, R.hy, R.tw * 2, 1, R.pants.lo); if (!R.K) R.rect(13 - R.tw, R.hy + 1, R.tw * 2 - 1, 1, R.pants.base); },
    back(R) { this.front(R); },
    side(R) { R.rect(9, R.hy, 7, 1, R.pants.lo); },
  },
  pleated: { // plisserad kjol: veck hela vägen runt
    label: 'Plisserad kjol', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 5), bareFrom: (R) => (R.K ? 2 : 3), crotch: false,
    front(R) {
      const p = R.pants, [y0, y1] = skirtRows(R);
      R.rect(12 - R.tw, y0, R.tw * 2, 1, p.lo);
      R.pattern(TAG.pants, (x, y, c) => (y > y0 && y < y1 - 1 && (x & 1) && c !== p.lo ? p.lo : y === y1 - 1 && !(x & 1) ? p.base : null));
    },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  tutu: { // tyllkjol: puffig, tyllstruktur, satinlinning
    label: 'Tyllkjol', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 4), bareFrom: (R) => (R.K ? 1 : 2), crotch: false,
    front(R) {
      const p = R.pants, [y0, y1] = skirtRows(R);
      for (let j = 1; j < R.skirtLen; j++) flare(R, j, j === R.skirtLen - 1 ? 1 : 2, p.base);
      R.pattern(TAG.pants, (x, y, c) => (y > y0 && y < y1 ? ((x + y) % 3 === 0 ? p.hi : y === y1 - 1 && (x & 1) ? p.lo : c === p.lo && y < y1 - 1 ? p.base : null) : null));
      R.rect(R.side ? 9 : 12 - R.tw, y0, R.side ? 7 : R.tw * 2, 1, p.dk);
    },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  denimSkirt: { // jeanskjol: mittsöm, knapp, fickor
    label: 'Jeanskjol', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 4), bareFrom: (R) => (R.K ? 1 : 2), crotch: false,
    front(R) {
      const p = R.pants, y0 = R.hy;
      R.rect(12 - R.tw, y0, R.tw * 2, 1, p.lo);
      for (let y = y0 + 1; y < y0 + R.skirtLen - 1; y++) R.put(12, y, p.lo);
      withTag(R, TAG.belt, () => R.put(12, y0, GOLD));
      if (!R.K) { R.put(12 - R.tw + 1, y0 + 1, p.lo); R.put(10 + R.tw, y0 + 1, p.lo); }
      R.rect(13 - R.tw, y0 + R.skirtLen - 2, R.tw * 2 - 2, 1, p.hi);
    },
    back(R) { const p = R.pants; R.rect(12 - R.tw, R.hy, R.tw * 2, 1, p.lo); R.put(10, R.hy + 1, p.lo); R.put(9, R.hy + 1, p.lo); R.put(13, R.hy + 1, p.lo); R.put(14, R.hy + 1, p.lo); },
    side(R) { R.rect(9, R.hy, 7, 1, R.pants.lo); R.put(12, R.hy + 1, R.pants.lo); },
  },
  longSkirt: { // lång kjol: ända ner till fotleden, mjuka veck
    label: 'Lång kjol', group: 'Kjolar', skirt: toFloor, crotch: false,
    front(R) {
      const p = R.pants, y0 = R.hy, y1 = R.hy + R.skirtLen;
      R.rect(12 - R.tw, y0, R.tw * 2, 1, p.lo);
      for (let y = y0 + 3; y < y1 - 1; y++) { R.put(12 - R.tw + 1 - (y > y0 + 5 ? 1 : 0), y, p.lo); R.put(10 + R.tw + (y > y0 + 5 ? 1 : 0), y, p.lo); }
      flare(R, R.skirtLen - 1, 1, p.lo);
    },
    back(R) { this.front(R); },
    side(R) { const p = R.pants; R.rect(9, R.hy, 7, 1, p.lo); for (let y = R.hy + 3; y < R.hy + R.skirtLen - 1; y++) R.put(12, y, p.lo); flare(R, R.skirtLen - 1, 1, p.lo); },
  },
  pencil: { // pennkjol: smal och rak till knät, slits bak
    label: 'Pennkjol', group: 'Kjolar', bareFrom: (R) => (R.K ? 3 : 5), crotch: false, belt: false, shinSkin: true,
    legRow(R, row) { // kom ihåg benens tygrader så att kjolen kan täcka mellanrummet
      if (row.bare) return;
      const m = (R._pencil ||= {}), r = m[row.y];
      m[row.y] = r ? [Math.min(r[0], row.x), Math.max(r[1], row.x + row.w - 1)] : [row.x, row.x + row.w - 1];
    },
    front(R) {
      const p = R.pants;
      R.rect(12 - R.tw, R.hy, R.tw * 2, 1, p.lo);
      if (R.sit) return;
      const m = R._pencil || {};
      for (const y in m) { const [a, b] = m[y]; R.rect(a, +y, b - a + 1, 1, p.base); R.put(a, +y, p.hi); R.put(b, +y, p.lo); }
      const last = Math.max(...Object.keys(m).map(Number));
      if (isFinite(last)) { const [a, b] = m[last]; R.rect(a, last, b - a + 1, 1, p.lo); }
      if (R.back && isFinite(last)) withTag(R, TAG.skin, () => { R.put(11, last, R.skin.lo); R.put(12, last, R.skin.lo); });
    },
    back(R) { this.front(R); },
    side(R) {
      const p = R.pants;
      R.rect(9, R.hy, 7, 1, p.lo);
      const m = R._pencil || {};
      for (const y in m) { const [a, b] = m[y]; R.rect(a, +y, b - a + 1, 1, p.base); R.put(a, +y, p.lo); R.put(b, +y, p.hi); }
    },
  },
  ruffle: { // volangkjol: två volanger, vid kant nertill
    label: 'Volangkjol', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 5), bareFrom: (R) => (R.K ? 2 : 3), crotch: false,
    front(R) {
      const p = R.pants, y0 = R.hy, n = R.skirtLen, mid = y0 + (R.K ? 1 : 2);
      R.rect(12 - R.tw, y0, R.tw * 2, 1, p.lo);
      R.pattern(TAG.pants, (x, y) => (y === mid ? ((x & 1) ? p.hi : p.base) : y === mid - 1 && !R.K ? p.lo : y === y0 + n - 1 ? ((x & 1) ? p.hi : p.lo) : null));
      flare(R, n - 1, 1, p.hi);
    },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  kilt: { // kilt: rak, veckad bak, skärp med spänne, fransad kant och sporran framtill
    label: 'Kilt', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 5), bareFrom: (R) => (R.K ? 2 : 3), crotch: false,
    front(R) {
      const p = R.pants, y0 = R.hy, y1 = y0 + R.skirtLen;
      withTag(R, TAG.belt, () => { R.rect(12 - R.tw, y0, R.tw * 2, 1, LEATHER.dk); if (R.front) R.put(12, y0, SILVER); });
      if (R.back) { R.pattern(TAG.pants, (x, y, c) => (y > y0 && y < y1 - 1 && (x & 1) && c !== p.lo ? p.lo : null)); return; }
      const ex = 9 + R.tw; // förklädets kant
      for (let y = y0 + 1; y < y1; y++) R.put(ex, y, p.lo);
      withTag(R, TAG.extra, () => {
        for (let y = y0 + 2; y < y1; y += 2) R.put(ex + 1, y, THREAD); // fransar
        if (R.sit) return;
        R.rect(11, y0 + 1, 2, 1, LEATHER.base); R.put(12, y0 + 1, LEATHER.hi); // sporran
        R.put(11, y0 + 2, FUR.base); R.put(12, y0 + 2, FUR.hi);
        if (!R.K) { R.put(11, y0 + 3, LEATHER.dk); R.put(12, y0 + 3, LEATHER.dk); } // tofsar
      });
    },
    back(R) { this.front(R); },
    side(R) {
      const p = R.pants, y0 = R.hy, n = R.skirtLen;
      withTag(R, TAG.belt, () => R.rect(9, y0, 7, 1, LEATHER.dk));
      for (let j = 1; j < n - 1; j++) { const w = Math.min(2, (j + 1) >> 1); for (let x = 9 - w; x < 12; x += 2) R.put(x, y0 + j, p.lo); } // veck bak
      if (!R.sit) withTag(R, TAG.extra, () => { R.put(16, y0 + 1, LEATHER.base); R.put(16, y0 + 2, FUR.lo); R.put(17, y0 + 2, FUR.base); });
    },
  },
  wrapSkirt: { // omlottkjol: snett omlott framtill och knytband i sidan
    label: 'Omlott­kjol', group: 'Kjolar', skirt: (R) => (R.K ? 3 : 5), bareFrom: (R) => (R.K ? 2 : 3), crotch: false, uses: ['pants2'],
    front(R) {
      const p = R.pants, P = R.pants2, y0 = R.hy, n = R.skirtLen;
      R.rect(12 - R.tw, y0, R.tw * 2, 1, p.lo);
      flare(R, n - 1, 1, p.lo);
      if (R.back) { for (let y = y0 + 2; y < y0 + n - 1; y++) R.put(12, y, p.lo); return; }
      const x0 = 12 - R.tw + 3;
      for (let j = 1; j < n; j++) { const x = x0 + j - 1; R.put(x, y0 + j, p.lo); R.put(x + 1, y0 + j, p.hi); } // omlottet
      withTag(R, TAG.extra, () => { const bx = 12 - R.tw + 1; R.put(bx, y0, P.hi); R.put(bx - 1, y0 + 1, P.base); R.put(bx, y0 + 1, P.lo); if (!R.K) R.put(bx - 1, y0 + 2, P.lo); });
    },
    back(R) { this.front(R); },
    side(R) {
      const p = R.pants, P = R.pants2, y0 = R.hy, n = R.skirtLen;
      R.rect(9, y0, 7, 1, p.lo);
      for (let j = 1; j < n - 1; j++) R.put(13 + Math.min(1, j >> 1), y0 + j, p.lo);
      flare(R, n - 1, 1, p.lo);
      withTag(R, TAG.extra, () => { R.put(15, y0, P.hi); R.put(16, y0 + 1, P.base); if (!R.K) R.put(16, y0 + 2, P.lo); });
    },
  },
  tennisSkirt: { // tenniskjol: kort och veckad med rand nertill
    label: 'Tennis­kjol', group: 'Kjolar', skirt: (R) => (R.K ? 2 : 3), bareFrom: 1, crotch: false, uses: ['pants2'],
    front(R) {
      const p = R.pants, P = R.pants2, [y0, y1] = skirtRows(R);
      R.rect(R.side ? 9 : 12 - R.tw, y0, R.side ? 7 : R.tw * 2, 1, p.lo);
      flare(R, R.skirtLen - 1, 1);
      R.pattern(TAG.pants, (x, y, c) => (y >= y1 || y <= y0 ? null : y === y1 - 1 ? ((x & 1) ? P.base : P.hi) : (x & 1) && c !== p.lo ? p.lo : null));
    },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  folkdrakt: { // folkdräktskjol: lång mörk kjol, randigt förkläde framtill och vita strumpor
    label: 'Folkdräkts­kjol', group: 'Kjolar', skirt: (R) => R.shoeTop - R.hy - (R.K ? 1 : 2), bareFrom: 3, crotch: false, uses: ['pants2'],
    legRow(R, row) { if (row.bare) withTag(R, TAG.extra, () => paintRow(R, row, STOCKING)); },
    stripes(R) { const P = R.pants2; return [P.base, 0xf2cf2e, P.lo, 0x46a35a]; },
    front(R) {
      const y0 = R.hy, n = R.skirtLen, P = R.pants2, y1 = y0 + n;
      if (R.sit) sitShins(R, (row) => { if (row.y >= y1) withTag(R, TAG.extra, () => paintRow(R, row, STOCKING)); });
      withTag(R, TAG.extra, () => {
        R.rect(12 - R.tw, y0, R.tw * 2, 1, P.dk); // linning
        if (R.back) { R.put(10, y0, P.hi); R.put(13, y0, P.hi); R.put(11, y0 + 1, P.base); R.put(12, y0 + 1, P.lo); return; } // knuten bak
        const a = 12 - R.tw + 2, b = 11 + R.tw - 2, S = this.stripes(R);
        for (let y = y0 + 1; y < y1 - 2; y++) for (let x = a; x <= b; x++) R.put(x, y, x === b ? mix(S[(x - a) & 3], 0x000000, 0.2) : S[(x - a) & 3]);
        R.rect(a, y1 - 2, b - a + 1, 1, P.dk);
      });
    },
    back(R) { this.front(R); },
    side(R) {
      const y0 = R.hy, n = R.skirtLen, P = R.pants2, S = this.stripes(R);
      withTag(R, TAG.extra, () => {
        R.rect(9, y0, 7, 1, P.dk);
        for (let j = 1; j < n - 1; j++) { const x = 16 + Math.min(2, (j + 1) >> 1); R.put(x, y0 + j, j === n - 2 ? P.dk : P.base); R.put(x - 1, y0 + j, S[(j + 1) & 3]); }
      });
    },
  },

  // ================= klänningar (tröjans färg) =================
  sundress: { ...DRESS, // sommarklänning: knytband i midjan, spetskant
    label: 'Sommar\u00adklänning', group: 'Klänningar', skirt: (R) => (R.K ? 4 : 6), bareFrom: (R) => (R.K ? 3 : 4), folds: true, uses: ['pants2'],
    front(R) { sash(R, R.pants2); const y = R.hy + R.skirtLen - 1; R.pattern(TAG.pants, (x, yy) => (yy === y && (x & 1) ? mix(R.pants.hi, 0xffffff, 0.45) : null)); },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  gown: { ...DRESS, // balklänning: golvlång, mycket vid, släp från sidan, glitter
    label: 'Bal\u00adklänning', group: 'Klänningar', skirt: toFloor, uses: ['pants2'],
    front(R) {
      const n = R.skirtLen, p = R.pants;
      for (let j = 3; j < n; j++) flare(R, j, j >= n - 3 ? 2 : 1, j === n - 1 ? p.lo : undefined);
      R.pattern(TAG.pants, (x, y) => (y > R.hy + 1 ? sparkle(R, x, y, 19) : null));
      sash(R, R.pants2, { bow: R.back });
    },
    back(R) { this.front(R); },
    side(R) {
      const n = R.skirtLen, p = R.pants;
      for (let j = 3; j < n; j++) flare(R, j, 1);
      for (let j = n - 3; j < n; j++) { const w = Math.min(2, (j + 1) >> 1); R.rect(9 - w - 4 + (n - 1 - j), R.hy + j, 3 - (n - 1 - j), 1, j === n - 1 ? p.lo : p.base); } // släp
      R.pattern(TAG.pants, (x, y) => (y > R.hy + 1 ? sparkle(R, x, y, 19) : null));
      sash(R, R.pants2, { bow: false });
    },
  },
  princess: { ...DRESS, // prinsessklänning: klockformad med volanger, puffärmar, glitter
    label: 'Prinsess\u00adklänning', group: 'Klänningar', skirt: toFloor, uses: ['pants2'],
    front(R) {
      const n = R.skirtLen, p = R.pants, t1 = R.hy + (R.K ? 2 : 3), t2 = R.hy + (R.K ? 4 : 6);
      for (let j = 1; j < n; j++) flare(R, j, j >= n - 2 ? 3 : j >= (R.K ? 3 : 4) ? 2 : 1, j === n - 1 ? p.lo : undefined);
      R.pattern(TAG.pants, (x, y) => (y === t1 || (y === t2 && !R.K) ? ((x & 1) ? p.hi : p.base) : y > R.hy ? sparkle(R, x, y, 17) : null));
      withTag(R, TAG.extra, () => R.rect(R.side ? 9 : 12 - R.tw, R.hy, R.side ? 7 : R.tw * 2, 1, R.pants2.base));
    },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
    afterArms(R) { // puffärmar
      if (R.eat || R.carry) return;
      const p = R.pants, t = R.torsoTop;
      withTag(R, TAG.extra, () => {
        if (R.side) { R.rect(11, t, 3, 2, p.base); R.put(13, t, p.hi); R.put(11, t + 1, p.lo); return; }
        const a = 12 - R.tw - 2, b = 12 + R.tw;
        R.rect(a - 1, t, 3, 2, p.base); R.put(a - 1, t, p.hi); R.put(a - 1, t + 1, p.lo);
        R.rect(b, t, 3, 2, p.base); R.put(b + 2, t, p.lo); R.put(b + 2, t + 1, p.dk);
      });
    },
  },
  maxiDress: { ...DRESS, // maxiklänning: lång och fladdrig med slits
    label: 'Maxi\u00adklänning', group: 'Klänningar', skirt: toFloor,
    front(R) {
      const p = R.pants, y1 = R.hy + R.skirtLen;
      R.rect(12 - R.tw, R.hy, R.tw * 2, 1, p.lo);
      for (let y = R.hy + 2; y < y1 - 1; y++) R.put(12 - R.tw + 1 + ((y >> 1) & 1), y, p.lo);
      if (R.front && !R.sit && !R.K) withTag(R, TAG.skin, () => { for (let y = y1 - 4; y < y1; y++) R.put(13, y, y === y1 - 4 ? R.skin.lo : R.skin.base); });
    },
    back(R) { this.front(R); },
    side(R) { R.rect(9, R.hy, 7, 1, R.pants.lo); for (let y = R.hy + 2; y < R.hy + R.skirtLen - 1; y++) R.put(11 + ((y >> 1) & 1), y, R.pants.lo); },
  },
  shirtDress: { ...DRESS, // skjortklänning: knappslå hela vägen och skärp
    label: 'Skjort\u00adklänning', group: 'Klänningar', skirt: (R) => (R.K ? 4 : 5), bareFrom: (R) => (R.K ? 3 : 3),
    front(R) {
      const p = R.pants, y1 = R.hy + R.skirtLen;
      withTag(R, TAG.belt, () => { R.rect(12 - R.tw, R.hy, R.tw * 2, 1, mix(p.dk, 0x1c1814, 0.4)); R.rect(11, R.hy, 2, 1, GOLD); });
      if (R.back) return;
      for (let y = R.hy + 1; y < y1 - 1; y++) R.put(12, y, p.lo);
      withTag(R, TAG.extra, () => { for (let y = R.hy + 2; y < y1 - 1; y += 2) R.put(11, y, R.acc.base); });
    },
    back(R) { this.front(R); },
    side(R) { withTag(R, TAG.belt, () => R.rect(9, R.hy, 7, 1, mix(R.pants.dk, 0x1c1814, 0.4))); },
  },
  partyDress: { ...DRESS, // festklänning: kort, svängig, paljetter som glittrar
    label: 'Fest\u00adklänning', group: 'Klänningar', skirt: (R) => (R.K ? 3 : 4), bareFrom: (R) => (R.K ? 1 : 2),
    front(R) {
      flare(R, R.skirtLen - 1, 1, R.pants.lo);
      if (!R.K) flare(R, R.skirtLen - 2, 1);
      R.pattern(TAG.pants, (x, y) => sparkle(R, x, y));
    },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
    afterTorso(R) { R.pattern(TAG.torso, (x, y) => sparkle(R, x, y)); },
  },
  sweaterDress: { ...DRESS, // tröjklänning: stickad, långa ärmar, ribbad kant
    label: 'Tröj\u00adklänning', group: 'Klänningar', skirt: (R) => (R.K ? 3 : 4), bareFrom: 2,
    prep(R) { R.pants = R.shirt; R.longSleeve = true; R.noSleeve = false; },
    front(R) { const p = R.pants, y = R.hy + R.skirtLen - 1; R.pattern(TAG.pants, (x, yy) => (yy === y ? ((x & 1) ? p.dk : p.lo) : null)); },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  lucia: { ...DRESS, // luciaklänning: vit, golvlång, långa ärmar och rött band i midjan
    label: 'Lucia\u00adklänning', group: 'Klänningar', skirt: toFloor, uses: ['pants2'],
    prep(R) { R.pants = R.shirt; R.longSleeve = true; R.noSleeve = false; },
    front(R) {
      const p = R.pants;
      for (let y = R.hy + 3; y < R.hy + R.skirtLen - 1; y++) { R.put(12 - R.tw + 2, y, p.lo); R.put(9 + R.tw, y, p.lo); }
      sash(R, R.pants2, { tails: R.K ? 3 : 5 });
    },
    back(R) { this.front(R); },
    side(R) { sash(R, R.pants2, { tails: R.K ? 3 : 5 }); },
  },
  weddingDress: { ...DRESS, // brudklänning: vid, spetsmönster och släp
    label: 'Brud\u00adklänning', group: 'Klänningar', skirt: toFloor,
    front(R) {
      const n = R.skirtLen, p = R.pants;
      for (let j = 2; j < n; j++) flare(R, j, j >= n - 4 ? 2 : 1, j === n - 1 ? p.lo : undefined);
      R.pattern(TAG.pants, (x, y) => (y > R.hy && ((x + y * 2) % 5 === 0) ? p.lo : null));
      if (R.back && !R.sit) R.rect(12 - R.tw + 1, R.shoeTop, R.tw * 2 - 2, 1, p.lo); // släpet syns bakom fötterna
    },
    back(R) { this.front(R); },
    side(R) {
      const n = R.skirtLen, p = R.pants;
      for (let j = 2; j < n; j++) flare(R, j, 1);
      for (let j = n - 4; j < n; j++) { const w = Math.min(2, (j + 1) >> 1), l = 1 + (j - (n - 4)) * 2; R.rect(9 - w - 1 - l, R.hy + j, l, 1, j === n - 1 ? p.lo : p.base); }
      R.pattern(TAG.pants, (x, y) => (y > R.hy && ((x + y * 2) % 5 === 0) ? p.lo : null));
    },
  },

  // ================= overaller & hängsel =================
  jumpsuit: { ...DRESS, // jumpsuit: byxor och liv i ett, knytband i midjan
    label: 'Jumpsuit', group: 'Overaller & hängsel', crotch: true, belt: false,
    legRow(R, row) { if (!row.bare && kOf(row) === 0) widen(R, row, 1); },
    front(R) { sash(R, { hi: R.pants.base, base: R.pants.lo, lo: R.pants.dk, dk: R.pants.dk }); },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  playsuit: { ...DRESS, // kort jumpsuit (byxdress)
    label: 'Byxdress', group: 'Overaller & hängsel', crotch: true, belt: false, bareFrom: (R) => (R.K ? 2 : 3), lapSkin: true, shinSkin: true, darkSole: true,
    legRow(R, row) { if (!row.bare && row.j === (R.K ? 1 : 2)) widen(R, row, 1); },
    front(R) { sash(R, { hi: R.pants.base, base: R.pants.lo, lo: R.pants.dk, dk: R.pants.dk }); },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
  },
  dungarees: legs({ // snickarbyxor: bröstlapp med hängslen och knappar
    label: 'Snickar\u00adbyxor', group: 'Overaller & hängsel', belt: false,
    fx(R, row) { if (!row.bare && !row.sit && kOf(row) === 0) { const p = R.pants; paintRow(R, row, { hi: mix(p.hi, 0xffffff, 0.2), base: p.hi, lo: p.base, dk: p.lo }); } },
    afterTorso(R) { bib(R); },
    front(R) { if (!R.sit) withTag(R, TAG.belt, () => { R.put(12 - R.tw, R.hy, GOLD); R.put(11 + R.tw, R.hy, GOLD); }); },
  }),
  dungareeShorts: legs({ // snickarshorts
    label: 'Snickar\u00adshorts', group: 'Overaller & hängsel', belt: false, bareFrom: (R) => (R.K ? 2 : 3), lapSkin: true, shinSkin: true, darkSole: true,
    fx(R, row) { if (!row.bare && !row.sit && row.j === (R.K ? 1 : 2)) { const p = R.pants; paintRow(R, row, { hi: mix(p.hi, 0xffffff, 0.2), base: p.hi, lo: p.base, dk: p.lo }); } },
    afterTorso(R) { bib(R); },
    front(R) { if (!R.sit) withTag(R, TAG.belt, () => { R.put(12 - R.tw, R.hy, GOLD); R.put(11 + R.tw, R.hy, GOLD); }); },
  }),
  pinafore: { // hängselkjol: kjol med bröstlapp
    label: 'Hängsel\u00adkjol', group: 'Overaller & hängsel', skirt: (R) => (R.K ? 3 : 5), bareFrom: (R) => (R.K ? 2 : 3), crotch: false,
    afterTorso(R) { bib(R, { pocket: true }); },
    front(R) { const p = R.pants; R.rect(13 - R.tw, R.hy + R.skirtLen - 2, R.tw * 2 - 2, 1, p.hi); },
    back(R) { this.front(R); },
    side(R) { const p = R.pants; R.rect(10, R.hy + R.skirtLen - 2, 5, 1, p.hi); },
  },
  suspenders: { // hängselbyxor: smala hängslen i kontrastfärg
    label: 'Hängsel\u00adbyxor', group: 'Overaller & hängsel', belt: false, uses: ['pants2'],
    afterTorso(R) { thinStraps(R, R.pants2); },
    front(R) { R.rect(12 - R.tw, R.hy, R.tw * 2, 1, R.pants.lo); },
    back(R) { this.front(R); },
    side(R) { R.rect(9, R.hy, 7, 1, R.pants.lo); },
  },
  rainPants: legs({ // regnbyxor: blanka, hängslen, reflexband och resår nertill
    label: 'Regn\u00adbyxor', group: 'Overaller & hängsel', belt: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = legRamp(R, row, R.pants);
      if (k === 0) { paintRow(R, row, { hi: R.pants.base, base: R.pants.lo, lo: R.pants.dk, dk: R.pants.dk }); return; }
      if (k === (R.K ? 1 : 2) && !row.sit) { withTag(R, TAG.extra, () => paintRow(R, row, ramp(row.far ? mix(REFLEX, 0x6a7078, 0.35) : REFLEX))); return; }
      if (!row.sit) withTag(R, TAG.extra, () => R.put(row.side ? row.x + 1 : row.left ? row.x + 1 : row.x + 2, row.y, mix(p.hi, 0xffffff, row.far ? 0.1 : 0.4)));
    },
    afterTorso(R) { thinStraps(R, R.pants, R.pants.lo); },
    front(R) { waistband(R); },
    back(R) { waistband(R); },
    side(R) { waistband(R); },
  }),
  skiPants: legs({ // täckbyxor: vadderade, stickningar, reflex och hög bröstlapp
    label: 'Täck\u00adbyxor', group: 'Overaller & hängsel', belt: false,
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = legRamp(R, row, R.pants);
      if (!row.sit) widen(R, row, 1);
      if (k === 0) { if (row.side) R.rect(row.x, row.y, 3, 1, p.lo); else R.rect(row.x, row.y, row.w, 1, p.lo); return; }
      if (k === 1 && !row.sit) { withTag(R, TAG.extra, () => { const c = row.far ? mix(REFLEX, 0x6a7078, 0.35) : REFLEX; if (row.side) R.rect(row.x, row.y, 3, 1, c); else R.rect(row.x, row.y, row.w, 1, c); }); return; }
      if (row.j % 3 === 2 && !row.sit) { if (row.side) R.put(row.x + 1, row.y, p.lo); else R.put(row.left ? row.x + 2 : row.x + 1, row.y, p.lo); }
    },
    afterTorso(R) { bib(R, { pocket: false, buttons: false, tall: 1 }); },
  }),
  coverall: legs({ // overall: hel dräkt i underdelens färg, blixtlås, bröstficka, reflex på benen
    label: 'Overall', group: 'Overaller & hängsel', belt: false, onePiece: true,
    prep(R) { R.shirt = R.pants; R.longSleeve = true; R.noSleeve = false; },
    fx(R, row) {
      if (row.bare) return;
      if (kOf(row) === (R.K ? 1 : 2) && !row.sit) withTag(R, TAG.extra, () => paintRow(R, row, ramp(row.far ? mix(REFLEX, 0x6a7078, 0.35) : REFLEX)));
    },
    afterTorso(R) {
      const p = R.pants, { ty0, hy } = R;
      if (R.front) {
        withTag(R, TAG.extra, () => { for (let y = ty0 + 1; y < hy + R.hipH; y++) R.put(12, y, SILVER); });
        R.put(10, ty0, p.hi); R.put(13, ty0, p.hi); R.put(11, ty0, p.dk); R.put(12, ty0, p.dk);
        if (!R.K) { R.rect(13, ty0 + 2, 2, 2, p.lo); R.rect(13, ty0 + 2, 2, 1, p.dk); }
        R.rect(12 - R.tw, hy - 1, R.tw * 2, 1, p.lo);
      } else if (R.back) { R.rect(12 - R.tw + 1, ty0, R.tw * 2 - 2, 1, p.lo); R.rect(12 - R.tw, hy - 1, R.tw * 2, 1, p.lo); }
      else { R.rect(9, hy - 1, 7, 1, p.lo); R.put(14, ty0, p.dk); R.put(15, ty0, p.hi); }
    },
  }),
  snowsuit: legs({ // vinteroverall: vadderad hel dräkt, reflexer, mudd
    label: 'Vinter\u00adoverall', group: 'Overaller & hängsel', belt: false, onePiece: true,
    prep(R) { R.shirt = R.pants; R.longSleeve = true; R.noSleeve = false; },
    fx(R, row) {
      if (row.bare) return;
      const k = kOf(row), p = legRamp(R, row, R.pants);
      if (!row.sit) widen(R, row, 1);
      if (k === 0) { if (row.side) R.rect(row.x, row.y, 3, 1, p.dk); else R.rect(row.x, row.y, row.w, 1, p.dk); return; }
      if (k === 1 && !row.sit) { withTag(R, TAG.extra, () => { const c = row.far ? mix(REFLEX, 0x6a7078, 0.35) : REFLEX; if (row.side) R.rect(row.x, row.y, 3, 1, c); else R.rect(row.x, row.y, row.w, 1, c); }); return; }
      if (row.j % 3 === 2 && !row.sit) { if (row.side) R.put(row.x + 1, row.y, p.lo); else R.put(row.left ? row.x + 2 : row.x + 1, row.y, p.lo); }
    },
    afterTorso(R) {
      const p = R.pants, { ty0, hy } = R;
      R.pattern(TAG.torso, (x, y, c) => ((y - ty0) % 3 === 2 && y < hy - 1 && c === p.base ? p.lo : null));
      if (R.front) { withTag(R, TAG.extra, () => { for (let y = ty0 + 1; y < hy; y++) R.put(12, y, SILVER); }); R.rect(10, ty0, 4, 1, p.hi); }
      else if (R.back) R.rect(10, ty0, 4, 1, p.hi);
      else R.rect(11, ty0, 4, 1, p.hi);
    },
  }),
};

// ---------- tryck/mönster på underdelen (look.bottomPrint, färg look.pants2 → R.pants2) ----------
// Ritas efter höften/kjolen med R.tag = TAG.pants: R.pattern(TAG.pants, (x, y) => … ? R.pants2 : null).
// Mönstret är en funktion fn(R, x, y, färg) → ramp | heltalsfärg | null. printEntry lägger det
// även på bröstlappar/hög midja (ritas efter tröjan) och på livet + ärmarna på helplagg.
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const onePiece = (R) => !!R.E.bottom.onePiece || R.id.bottom === 'dress';
function printEntry(label, group, fn) {
  return {
    label, group,
    front(R) { R.pattern(TAG.pants, (x, y, c) => fn(R, x, y, c)); },
    back(R) { this.front(R); },
    side(R) { this.front(R); },
    afterTorso(R) {
      R.pattern(TAG.pants, (x, y, c) => (y < R.hy ? fn(R, x, y, c) : null)); // bröstlapp / hög midja
      if (onePiece(R)) R.pattern(TAG.torso, (x, y, c) => fn(R, x, y, c));   // klänningens liv
    },
    afterArms(R) { if (onePiece(R)) R.pattern(TAG.sleeve, (x, y, c) => fn(R, x, y, c)); },
  };
}
// små motiv i ett förskjutet rutnät: cell w×h, varannan rad förskjuten w/2 → lokala (lx, ly)
const cell = (x, y, w, h) => { const cy = Math.floor(y / h), lx = (((x + (cy & 1) * (w >> 1)) % w) + w) % w; return [lx, y - cy * h]; };
const RAINBOW = [0xe23b3b, 0xf08a24, 0xf2cf2e, 0x46a35a, 0x3a7bd5, 0x8e5bd1].map(ramp);
const TIEDYE = [0xf28bb3, 0xf2cf2e, 0x2aa39a];
export const BOTTOM_PRINT_REG = {
  none: { label: 'Inget' },
  checks: printEntry('Rutor', 'Rutor & ränder', (R, x, y) => ((((x >> 1) + (y >> 1)) & 1) ? R.pants2 : null)),
  tartan: printEntry('Skotskrutig', 'Rutor & ränder', (R, x, y) => {
    const a = x % 4 === 1, b = y % 4 === 1;
    return a && b ? R.pants2.dk : a || b ? R.pants2 : (x % 4 === 3 && y % 4 === 3 ? R.pants.dk : null);
  }),
  pinstripe: printEntry('Kritstreck', 'Rutor & ränder', (R, x) => (x % 3 === 0 ? R.pants2 : null)),
  stripesH: printEntry('Tvärränder', 'Rutor & ränder', (R, x, y) => ((y & 1) ? R.pants2 : null)),
  dots: printEntry('Prickar', 'Små motiv', (R, x, y) => { const [lx, ly] = cell(x, y, 4, 3); return lx === 1 && ly === 1 ? R.pants2 : null; }),
  flowers: printEntry('Blommor', 'Små motiv', (R, x, y) => {
    const [lx, ly] = cell(x, y, 6, 5);
    if (lx === 2 && ly === 2) return R.pants2.base === 0xf2cf2e ? 0xf4f1ea : 0xf2cf2e; // mitten
    return (Math.abs(lx - 2) + Math.abs(ly - 2) === 1) ? R.pants2 : null;
  }),
  hearts: printEntry('Hjärtan', 'Små motiv', (R, x, y) => {
    const [lx, ly] = cell(x, y, 6, 5);
    return (ly === 1 && (lx === 1 || lx === 3)) || (ly === 2 && lx >= 1 && lx <= 3) || (ly === 3 && lx === 2) ? R.pants2 : null;
  }),
  stars: printEntry('Stjärnor', 'Små motiv', (R, x, y) => {
    const [lx, ly] = cell(x, y, 6, 5);
    if (lx === 2 && ly === 2) return mix(R.pants2.hi, 0xffffff, 0.5);
    return Math.abs(lx - 2) === 1 && Math.abs(ly - 2) === 1 ? R.pants2 : null;
  }),
  camo: printEntry('Kamouflage', 'Djur & natur', (R, x, y) => {
    const h = hash(x >> 1, y >> 1) % 7;
    return h < 2 ? R.pants2 : h === 2 ? { hi: R.pants.lo, base: R.pants.dk, lo: R.pants.dk, dk: R.pants.dk } : null;
  }),
  leopard: printEntry('Leopard', 'Djur & natur', (R, x, y) => {
    const [lx, ly] = cell(x, y, 4, 4);
    return (ly === 1 && lx === 1) || (ly === 2 && lx === 0) ? R.pants2 : ly === 2 && lx === 1 ? R.pants.hi : null;
  }),
  zebra: printEntry('Zebra', 'Djur & natur', (R, x, y) => ((y + ((x >> 1) & 1) + ((x >> 2) & 1)) % 3 === 0 ? R.pants2 : null)), // vågiga tvärränder
  stonewash: printEntry('Stentvättad', 'Effekter', (R, x, y, c) => (hash(x, y) % 4 === 0 || (hash(x >> 1, y >> 1) % 5 === 0) ? mix(c, 0xffffff, 0.22) : null)),
  sequins: printEntry('Paljetter', 'Effekter', (R, x, y) => sparkle(R, x, y)),
  splatter: printEntry('Färgstänk', 'Effekter', (R, x, y) => { const h = hash(x, y) % 13; return h === 0 ? R.pants2 : h === 1 ? 0xf28bb3 : h === 2 ? 0xf2cf2e : null; }),
  rainbow: printEntry('Regnbåge', 'Effekter', (R, x, y) => { // sex band över hela plagget, uppifrån och ner
    const top = onePiece(R) ? R.ty0 : R.hy;
    const end = R.skirted ? R.hy + R.skirtLen : R.bareFrom != null ? R.legTop + R.bareFrom : R.shoeTop;
    return RAINBOW[Math.max(0, Math.min(5, Math.floor((y - top) * 6 / Math.max(1, end - top))))];
  }),
  tiedye: printEntry('Batik', 'Effekter', (R, x, y) => { const d = ((x - 12) * (x - 12) + (y - 30) * (y - 30)) >> 3; return d % 3 === 1 ? TIEDYE[(d >> 2) % 3] : d % 3 === 2 ? R.pants2 : null; }),
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

// --- hjälpare för de nya skorna ---
const sRamp = (R, s, rp) => (s.far ? R.far(rp) : rp);           // bortre foten mörkare
const lace = (R, s) => s.x + (s.left ? (R.K ? 2 : 3) : (R.K ? 1 : 1)); // mitt på foten framifrån
// skaft (stövlar/kängor) över de k nedersta benraderna; wide = extra pixel utåt/runt om
function shaftFB(R, s, k, rp, wide = 0) {
  const rows = s.rows.slice(-k);
  for (const r of rows) {
    const x0 = r.x - (wide && s.left ? wide : 0), w = r.w + wide;
    R.rect(x0, r.y, w, 1, rp.base);
    R.put(s.left ? x0 : x0 + w - 1, r.y, s.left ? rp.hi : rp.lo); R.put(s.left ? x0 + w - 1 : x0, r.y, rp.lo);
  }
  return rows;
}
function shaftSide(R, s, k, rp, back = 0, front = 0) {
  const c = sRamp(R, s, rp), rows = s.rows.slice(-k);
  for (const r of rows) { R.rect(r.x - back, r.y, 3 + back + front, 1, c.base); R.put(r.x - back, r.y, c.lo); R.put(r.x + 2 + front, r.y, c.hi); }
  return rows;
}
// ovandel + sula framifrån/bakifrån, och från sidan (x-1 … x+3)
function footFB(R, s, rp, sole) {
  const { x, y, left } = s, w = R.lw + 1;
  R.rect(x, y, w, 1, rp.base);
  if (R.back) R.rect(x + 1, y, w - 2, 1, rp.lo); else R.put(left ? x + 1 : x + w - 2, y, rp.hi);
  if (sole != null) R.rect(x, y + 1, w, 1, sole);
}
function footSide(R, s, rp, sole, toe = 0) {
  const c = sRamp(R, s, rp), { x, y } = s;
  R.rect(x - 1, y, 5 + toe, 1, c.base); R.put(x + 3 + toe, y, c.hi);
  if (sole != null) R.rect(x - 1, y + 1, 5 + toe, 1, s.far ? mix(sole, 0x000000, 0.25) : sole);
}
const skinFeet = (R, fn) => withTag(R, TAG.skin, fn);
const BLINK = [0xff4d6d, 0x4de1ff, 0x7dff6b, 0xffd23f];

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

  // ================= sneakers =================
  sneakers: { // vit sula, snörning och rand i detaljfärgen
    label: 'Sneakers', group: 'Sneakers', uses: ['shoes2'],
    front(R, s) { footFB(R, s, R.shoe, R.shoe2.base); R.put(lace(R, s), s.y, R.shoe2.hi); R.put(s.left ? s.x : s.x + R.lw, s.y + 1, R.shoe2.lo); },
    back(R, s) { footFB(R, s, R.shoe, R.shoe2.base); R.put(s.x + (R.lw >> 1), s.y, R.shoe2.base); },
    side(R, s) { const c = sRamp(R, s, R.shoe2); footSide(R, s, R.shoe, c.base); R.put(s.x, s.y, c.base); R.put(s.x + 1, s.y, c.hi); },
  },
  highTops: { // höga sneakers: skaft över fotleden, vit tåhätta och snörning
    label: 'Höga sneakers', group: 'Sneakers', uses: ['shoes2'],
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 1 : 2, R.shoe);
      footFB(R, s, R.shoe, R.shoe2.base);
      for (const r of rows) R.put(lace(R, s), r.y, R.shoe2.hi);
      R.put(lace(R, s), s.y, R.shoe2.base);
    },
    back(R, s) { shaftFB(R, s, R.K ? 1 : 2, R.shoe); footFB(R, s, R.shoe, R.shoe2.base); },
    side(R, s) {
      const rows = shaftSide(R, s, R.K ? 1 : 2, R.shoe), c2 = sRamp(R, s, R.shoe2);
      footSide(R, s, R.shoe, c2.base);
      R.put(s.x + 3, s.y, c2.hi);
      if (!s.far && rows.length) R.put(rows[rows.length - 1].x + 1, rows[rows.length - 1].y, c2.base); // ankelmärke
    },
  },
  slipOn: { // rutiga tygskor
    label: 'Rutiga tygskor', group: 'Sneakers', uses: ['shoes2'],
    front(R, s) { footFB(R, s, R.shoe, STRING); for (let i = 0; i <= R.lw; i++) if (((s.x + i) & 1) === 0) R.put(s.x + i, s.y, R.shoe2.base); },
    back(R, s) { this.front(R, s); },
    side(R, s) { const c2 = sRamp(R, s, R.shoe2); footSide(R, s, R.shoe, s.far ? 0xb8b4aa : STRING); for (let i = -1; i <= 3; i++) if (((s.x + i) & 1) === 0) R.put(s.x + i, s.y, c2.base); },
  },
  lightUp: { // blinkskor: sulan lyser i olika färger när man går
    label: 'Blinkskor', group: 'Sneakers', uses: ['shoes2'],
    front(R, s) {
      footFB(R, s, R.shoe, R.shoe2.base); R.put(lace(R, s), s.y, R.shoe2.hi);
      for (let i = 0; i <= R.lw; i++) if ((i & 1) === 0) R.put(s.x + i, s.y + 1, BLINK[(i + R.frame + (s.left ? 0 : 2)) & 3]);
    },
    back(R, s) { this.front(R, s); },
    side(R, s) {
      footSide(R, s, R.shoe, sRamp(R, s, R.shoe2).base); R.put(s.x, s.y, sRamp(R, s, R.shoe2).hi);
      if (!s.far) for (let i = -1; i <= 3; i += 2) R.put(s.x + i, s.y + 1, BLINK[(i + 1 + R.frame) & 3]);
    },
  },
  velcro: { // kardborreskor: band över foten
    label: 'Kardborre\u00adskor', group: 'Sneakers', uses: ['shoes2'],
    front(R, s) {
      const r = s.rows[s.rows.length - 1];
      if (r) { R.rect(r.x, r.y, r.w, 1, R.shoe.base); R.put(s.left ? r.x : r.x + r.w - 1, r.y, s.left ? R.shoe.hi : R.shoe.lo); }
      footFB(R, s, R.shoe, CREAM_SOLE); R.rect(s.x + 1, s.y, R.lw - 1, 1, R.shoe2.base); R.put(s.left ? s.x + 1 : s.x + R.lw - 1, s.y, R.shoe2.hi);
    },
    back(R, s) { footFB(R, s, R.shoe, CREAM_SOLE); },
    side(R, s) {
      const r = s.rows[s.rows.length - 1], c = sRamp(R, s, R.shoe), c2 = sRamp(R, s, R.shoe2);
      if (r) R.rect(r.x, r.y, 3, 1, c.base);
      footSide(R, s, R.shoe, s.far ? mix(CREAM_SOLE, 0, 0.25) : CREAM_SOLE);
      R.put(s.x + 1, s.y, c2.base); R.put(s.x + 2, s.y, c2.base); if (r) R.put(r.x + 1, r.y, c2.hi);
    },
  },

  // ================= kängor & stövlar =================
  boots: { // kängor: skaft, snörning, grov mörk sula
    label: 'Kängor', group: 'Kängor & stövlar',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 1 : 2, R.shoe);
      footFB(R, s, R.shoe, DARK_SOLE);
      for (const r of rows) R.put(lace(R, s), r.y, R.shoe.hi);
      R.put(s.left ? s.x + 1 : s.x + R.lw - 1, s.y + 1, 0x3d3530);
    },
    back(R, s) { shaftFB(R, s, R.K ? 1 : 2, R.shoe); footFB(R, s, R.shoe, DARK_SOLE); },
    side(R, s) { shaftSide(R, s, R.K ? 1 : 2, R.shoe); footSide(R, s, R.shoe, DARK_SOLE); if (!s.far) { R.put(s.x + 2, s.y - 1, R.shoe.hi); R.put(s.x + 1, s.y + 1, 0x3d3530); } },
  },
  rubberBoots: { // gummistövlar: höga, vida i skaftet, blank rand
    label: 'Gummi\u00adstövlar', group: 'Kängor & stövlar',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 3 : 5, R.shoe, 1);
      footFB(R, s, R.shoe, DARK_SOLE);
      if (rows.length) { const t = rows[0]; R.rect(s.left ? t.x - 1 : t.x, t.y, t.w + 1, 1, R.shoe.lo); }
      const sx = s.left ? s.x + 1 : s.x + R.lw - 1;
      for (const r of rows.slice(1)) R.put(sx, r.y, mix(R.shoe.hi, 0xffffff, 0.35));
    },
    back(R, s) { const rows = shaftFB(R, s, R.K ? 3 : 5, R.shoe, 1); footFB(R, s, R.shoe, DARK_SOLE); if (rows.length) { const t = rows[0]; R.rect(s.left ? t.x - 1 : t.x, t.y, t.w + 1, 1, R.shoe.lo); } },
    side(R, s) {
      const rows = shaftSide(R, s, R.K ? 3 : 5, R.shoe, 1, 0), c = sRamp(R, s, R.shoe);
      footSide(R, s, R.shoe, DARK_SOLE);
      if (rows.length) R.rect(rows[0].x - 1, rows[0].y, 4, 1, c.lo);
      if (!s.far) for (const r of rows.slice(1)) R.put(r.x + 1, r.y, mix(R.shoe.hi, 0xffffff, 0.35));
    },
  },
  ridingBoots: { // ridstövlar: smala, knähöga, klack
    label: 'Rid\u00adstövlar', group: 'Kängor & stövlar',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 3 : 6, R.shoe);
      footFB(R, s, R.shoe, R.shoe.dk);
      if (rows.length) R.rect(rows[0].x, rows[0].y, rows[0].w, 1, R.shoe.dk);
      const sx = s.left ? s.x + 2 : s.x + R.lw - 2;
      for (const r of rows.slice(2, -1)) R.put(sx, r.y, R.shoe.hi);
    },
    back(R, s) { const rows = shaftFB(R, s, R.K ? 3 : 6, R.shoe); footFB(R, s, R.shoe, R.shoe.dk); if (rows.length) R.rect(rows[0].x, rows[0].y, rows[0].w, 1, R.shoe.dk); },
    side(R, s) {
      const rows = shaftSide(R, s, R.K ? 3 : 6, R.shoe), c = sRamp(R, s, R.shoe);
      footSide(R, s, R.shoe, null);
      R.put(s.x - 1, s.y + 1, c.dk); R.rect(s.x + 1, s.y + 1, 3, 1, c.dk);
      if (rows.length) R.rect(rows[0].x, rows[0].y, 3, 1, c.dk);
    },
  },
  cowboyBoots: { // cowboystövlar: sömmar, v-skuren kant, klack och spetsig tå
    label: 'Cowboy\u00adstövlar', group: 'Kängor & stövlar',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 2 : 3, R.shoe);
      footFB(R, s, R.shoe, R.shoe.dk);
      for (const [i, r] of rows.entries()) if (i > 0) R.put(r.x + 1 + (i & 1), r.y, R.shoe.hi);
      if (rows.length) R.rect(rows[0].x, rows[0].y, rows[0].w, 1, R.shoe.lo);
    },
    back(R, s) { const rows = shaftFB(R, s, R.K ? 2 : 3, R.shoe); footFB(R, s, R.shoe, R.shoe.dk); if (rows.length) R.rect(rows[0].x, rows[0].y, rows[0].w, 1, R.shoe.lo); },
    side(R, s) {
      const rows = shaftSide(R, s, R.K ? 2 : 3, R.shoe), c = sRamp(R, s, R.shoe);
      footSide(R, s, R.shoe, null, 1);
      R.put(s.x - 1, s.y + 1, c.dk); R.rect(s.x + 1, s.y + 1, 4, 1, c.lo);
      if (rows.length > 1 && !s.far) R.put(rows[1].x + 1, rows[1].y, c.hi);
      if (rows.length) { R.put(rows[0].x, rows[0].y, c.lo); R.put(rows[0].x + 2, rows[0].y, c.lo); }
    },
  },
  winterBoots: { // vinterkängor: pälskant, grov sula
    label: 'Vinter\u00adkängor', group: 'Kängor & stövlar',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 1 : 2, R.shoe, 1);
      footFB(R, s, R.shoe, DARK_SOLE);
      if (rows.length) { const t = rows[0]; for (let i = -1; i <= t.w; i++) R.put(t.x + i, t.y, (i & 1) ? FUR.hi : FUR.base); }
    },
    back(R, s) { this.front(R, s); },
    side(R, s) {
      const rows = shaftSide(R, s, R.K ? 1 : 2, R.shoe, 1, 1);
      footSide(R, s, R.shoe, DARK_SOLE);
      if (rows.length) { const t = rows[0], F = s.far ? R.far(FUR) : FUR; for (let i = -1; i <= 3; i++) R.put(t.x + i, t.y, (i & 1) ? F.hi : F.base); }
    },
  },
  ankleBoots: { // stövletter: korta med klack och blixtlås
    label: 'Stövletter', group: 'Kängor & stövlar',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 1 : 2, R.shoe);
      footFB(R, s, R.shoe, R.shoe.lo);
      for (const r of rows) R.put(s.left ? r.x + r.w - 1 : r.x, r.y, SILVER);
    },
    back(R, s) { shaftFB(R, s, R.K ? 1 : 2, R.shoe); R.rect(s.x, s.y, R.lw + 1, 1, R.shoe.base); R.rect(s.x + (R.lw >> 1), s.y + 1, 2, 1, R.shoe.dk); },
    side(R, s) {
      shaftSide(R, s, R.K ? 1 : 2, R.shoe); const c = sRamp(R, s, R.shoe);
      footSide(R, s, R.shoe, null);
      R.put(s.x - 1, s.y + 1, c.dk); R.rect(s.x + 2, s.y + 1, 2, 1, c.lo);
    },
  },

  // ================= fina skor =================
  dressShoes: { // finskor: blankputsade med mörk sula
    label: 'Finskor', group: 'Fina skor',
    front(R, s) { footFB(R, s, R.shoe, R.shoe.dk); R.put(s.left ? s.x + 1 : s.x + R.lw - 1, s.y, mix(R.shoe.hi, 0xffffff, 0.45)); R.put(lace(R, s), s.y, R.shoe.lo); },
    back(R, s) { footFB(R, s, R.shoe, R.shoe.dk); },
    side(R, s) { const c = sRamp(R, s, R.shoe); footSide(R, s, R.shoe, c.dk, 1); R.put(s.x + 3, s.y, s.far ? c.base : mix(R.shoe.hi, 0xffffff, 0.45)); R.put(s.x + 4, s.y, c.base); R.put(s.x + 4, s.y + 1, c.lo); },
  },
  ballerina: { // ballerinaskor: platta, vristen syns, liten rosett
    label: 'Ballerina\u00adskor', group: 'Fina skor', uses: ['shoes2'],
    front(R, s) {
      const { x, y } = s, w = R.lw + 1;
      R.rect(x, y, w, 1, R.shoe.base);
      skinFeet(R, () => R.rect(x + 1, y, w - 2, 1, R.skin.base));
      R.rect(x, y + 1, w, 1, R.shoe.base); R.put(s.left ? x : x + w - 1, y + 1, s.left ? R.shoe.hi : R.shoe.lo);
      R.put(lace(R, s), y + 1, R.shoe2.base);
    },
    back(R, s) { R.rect(s.x, s.y, R.lw + 1, 1, R.shoe.base); R.rect(s.x, s.y + 1, R.lw + 1, 1, R.shoe.lo); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      R.put(x - 1, y, c.base); skinFeet(R, () => R.rect(x, y, 2, 1, s.far ? R.skin.lo : R.skin.base)); R.rect(x + 2, y, 2, 1, c.base);
      R.rect(x - 1, y + 1, 5, 1, c.lo); if (!s.far) R.put(x + 2, y, sRamp(R, s, R.shoe2).base);
    },
  },
  heels: { // klackskor: spetsig tå, hög klack
    label: 'Klackskor', group: 'Fina skor',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1;
      R.rect(x, y, w, 1, R.shoe.base);
      skinFeet(R, () => R.rect(x + 1, y, w - 2, 1, R.skin.base));
      R.rect(x + 1, y + 1, w - 2, 1, R.shoe.base); R.put(s.left ? x + 1 : x + w - 2, y + 1, R.shoe.hi);
    },
    back(R, s) { R.rect(s.x, s.y, R.lw + 1, 1, R.shoe.base); R.put(s.x + (R.lw >> 1) + (s.left ? 1 : 0), s.y + 1, R.shoe.dk); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      R.rect(x - 1, y, 2, 1, c.base); skinFeet(R, () => R.put(x + 1, y, s.far ? R.skin.lo : R.skin.base)); R.rect(x + 2, y, 2, 1, c.base);
      R.put(x - 1, y + 1, c.dk); R.rect(x + 2, y + 1, 3, 1, c.base); R.put(x + 4, y + 1, c.hi);
    },
  },
  clogs: { // träskor: läderovandel med nitar på träsula
    label: 'Träskor', group: 'Fina skor',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1;
      R.rect(x, y, w, 1, R.shoe.base); R.put(s.left ? x + 1 : x + w - 2, y, R.shoe.hi);
      withTag(R, TAG.extra, () => { R.put(x, y, GOLD); R.put(x + w - 1, y, GOLD); });
      R.rect(x, y + 1, w, 1, WOOD.base); R.put(s.left ? x : x + w - 1, y + 1, WOOD.hi);
    },
    back(R, s) { R.rect(s.x, s.y, R.lw + 1, 1, WOOD.hi); R.rect(s.x, s.y + 1, R.lw + 1, 1, WOOD.base); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), W = sRamp(R, s, WOOD), { x, y } = s;
      R.put(x - 1, y, W.hi); R.rect(x, y, 4, 1, c.base); R.put(x + 3, y, c.hi);
      withTag(R, TAG.extra, () => R.put(x, y, s.far ? mix(GOLD, 0, 0.3) : GOLD));
      R.rect(x - 1, y + 1, 5, 1, W.base); R.put(x + 3, y + 1, W.hi); R.put(x - 1, y + 1, W.lo);
    },
  },

  // ================= sommar =================
  sandals: { // sandaler: remmar över foten och runt fotleden
    label: 'Sandaler', group: 'Sommar',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, r = s.rows[s.rows.length - 1];
      if (r) R.rect(r.x, r.y, r.w, 1, R.shoe.base);
      skinFeet(R, () => { R.rect(x, y, w, 1, R.skin.base); R.put(s.left ? x : x + w - 1, y, R.skin.lo); });
      R.put(x + 1, y, R.shoe.base); R.put(x + w - 2, y, R.shoe.base);
      R.rect(x, y + 1, w, 1, R.shoe.lo);
    },
    back(R, s) { this.front(R, s); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s, r = s.rows[s.rows.length - 1];
      if (r) R.rect(r.x, r.y, 3, 1, c.base);
      skinFeet(R, () => { R.rect(x - 1, y, 5, 1, s.far ? R.skin.lo : R.skin.base); R.put(x - 1, y, s.far ? R.skin.dk : R.skin.lo); });
      R.put(x, y, c.base); R.put(x + 2, y, c.base);
      R.rect(x - 1, y + 1, 5, 1, c.base);
    },
  },
  flipflops: { // flipflops: en rem mellan tårna, färgglad sula
    label: 'Flipflops', group: 'Sommar',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1;
      skinFeet(R, () => { R.rect(x, y, w, 1, R.skin.base); R.put(s.left ? x : x + w - 1, y, R.skin.lo); });
      R.put(lace(R, s), y, R.shoe.hi); R.put(lace(R, s) + (s.left ? -1 : 1), y, R.shoe.base);
      R.rect(x, y + 1, w, 1, R.shoe.base);
    },
    back(R, s) { skinFeet(R, () => R.rect(s.x, s.y, R.lw + 1, 1, R.skin.base)); R.rect(s.x, s.y + 1, R.lw + 1, 1, R.shoe.base); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      skinFeet(R, () => { R.rect(x - 1, y, 5, 1, s.far ? R.skin.lo : R.skin.base); R.put(x - 1, y, s.far ? R.skin.dk : R.skin.lo); });
      R.put(x + 1, y, c.base); R.put(x + 2, y, c.hi);
      R.rect(x - 1, y + 1, 5, 1, c.base);
    },
  },
  barefoot: { // barfota: tår och allt
    label: 'Barfota', group: 'Sommar',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, S = R.skin;
      skinFeet(R, () => {
        R.rect(x, y, w, 1, S.base); R.put(s.left ? x : x + w - 1, y, S.lo);
        R.rect(x, y + 1, w, 1, S.base); for (let i = 1; i < w; i += 2) R.put(x + i, y + 1, S.lo);
      });
    },
    back(R, s) { skinFeet(R, () => { R.rect(s.x, s.y, R.lw + 1, 1, R.skin.base); R.rect(s.x, s.y + 1, R.lw + 1, 1, R.skin.lo); }); },
    side(R, s) {
      const S = s.far ? R.far(R.skin) : R.skin, { x, y } = s;
      skinFeet(R, () => { R.rect(x - 1, y, 4, 1, S.base); R.rect(x - 1, y + 1, 5, 1, S.base); R.put(x - 1, y + 1, S.lo); R.put(x + 3, y + 1, S.hi); R.put(x + 1, y + 1, S.lo); });
    },
  },

  // ================= hemma =================
  slippers: { // tofflor: fluffiga, öppen häl
    label: 'Tofflor', group: 'Hemma',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, c = R.shoe;
      R.rect(x, y, w, 1, c.base); for (let i = 0; i < w; i += 2) R.put(x + i, y, c.hi);
      R.rect(x, y + 1, w, 1, c.lo); R.put(s.left ? x : x + w - 1, y + 1, c.dk);
    },
    back(R, s) { skinFeet(R, () => R.rect(s.x + 1, s.y, R.lw - 1, 1, R.skin.lo)); R.put(s.x, s.y, R.shoe.base); R.put(s.x + R.lw, s.y, R.shoe.base); R.rect(s.x, s.y + 1, R.lw + 1, 1, R.shoe.lo); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      skinFeet(R, () => R.put(x - 1, y, s.far ? R.skin.lo : R.skin.base));
      R.rect(x, y, 4, 1, c.base); R.put(x + 1, y, c.hi); R.put(x + 3, y, c.hi);
      R.rect(x - 1, y + 1, 5, 1, c.lo);
    },
  },
  animalSlippers: { // djurtofflor: öron, ögon och nos
    label: 'Djurtofflor', group: 'Hemma', uses: ['shoes2'],
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, c = R.shoe;
      R.rect(x, y, w, 1, c.base); R.rect(x, y + 1, w, 1, c.lo);
      R.put(x + 1, y - 1, c.base); R.put(x + w - 2, y - 1, c.base); // öron
      withTag(R, TAG.extra, () => { R.put(x + 1, y, 0x1c1814); R.put(x + w - 2, y, 0x1c1814); R.put(x + (w >> 1), y + 1, R.shoe2.base); });
    },
    back(R, s) { R.rect(s.x, s.y, R.lw + 1, 1, R.shoe.base); R.rect(s.x, s.y + 1, R.lw + 1, 1, R.shoe.lo); R.put(s.x + (R.lw >> 1), s.y, STRING); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      R.rect(x - 1, y, 5, 1, c.base); R.rect(x - 1, y + 1, 6, 1, c.lo); R.put(x + 1, y - 1, c.base);
      if (!s.far) withTag(R, TAG.extra, () => { R.put(x + 2, y, 0x1c1814); R.put(x + 4, y + 1, R.shoe2.base); });
    },
  },
  woolSocks: { // raggsockor: tjocka, uppvikt kant i detaljfärgen
    label: 'Ragg\u00adsockor', group: 'Hemma', uses: ['shoes2'],
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, c = R.shoe, r = s.rows[s.rows.length - 1];
      if (r) { R.rect(r.x - (s.left ? 1 : 0), r.y, r.w + 1, 1, R.shoe2.base); R.put(r.x + 1, r.y, R.shoe2.hi); }
      R.rect(x, y, w, 1, c.base); for (let i = 1; i < w; i += 2) R.put(x + i, y, c.hi);
      R.rect(x, y + 1, w, 1, c.lo);
    },
    back(R, s) { this.front(R, s); R.rect(s.x + 1, s.y + 1, R.lw - 1, 1, R.shoe2.lo); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), c2 = sRamp(R, s, R.shoe2), { x, y } = s, r = s.rows[s.rows.length - 1];
      if (r) R.rect(r.x - 1, r.y, 5, 1, c2.base);
      R.rect(x - 1, y, 5, 1, c.base); R.put(x + 1, y, c.hi);
      R.rect(x - 1, y + 1, 5, 1, c.lo); R.put(x - 1, y + 1, c2.lo); R.put(x + 3, y + 1, c2.lo);
    },
  },

  // ================= sport =================
  cleats: { // fotbollsskor: ränder och dobbar
    label: 'Fotbolls\u00adskor', group: 'Sport', uses: ['shoes2'],
    front(R, s) {
      footFB(R, s, R.shoe, DARK_SOLE); R.put(lace(R, s), s.y, R.shoe2.base);
      withTag(R, TAG.extra, () => { R.put(s.x + 1, s.y + 2, 0xd6d6cc); R.put(s.x + R.lw - 1, s.y + 2, 0xd6d6cc); });
    },
    back(R, s) { this.front(R, s); },
    side(R, s) {
      const c2 = sRamp(R, s, R.shoe2);
      footSide(R, s, R.shoe, DARK_SOLE); R.put(s.x, s.y, c2.base); R.put(s.x + 1, s.y, c2.base);
      withTag(R, TAG.extra, () => { for (const i of [-1, 1, 3]) R.put(s.x + i, s.y + 2, s.far ? 0x9a9a92 : 0xd6d6cc); });
    },
  },
  rollerSkates: { // rullskridskor: känga, platta och hjul
    label: 'Rull\u00adskridskor', group: 'Sport', uses: ['shoes2'],
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 1 : 2, R.shoe);
      footFB(R, s, R.shoe, SILVER);
      for (const r of rows) R.put(lace(R, s), r.y, R.shoe2.hi);
      withTag(R, TAG.extra, () => { R.put(s.x + 1, s.y + 2, R.shoe2.base); R.put(s.x + R.lw - 1, s.y + 2, R.shoe2.base); });
    },
    back(R, s) { this.front(R, s); },
    side(R, s) {
      shaftSide(R, s, R.K ? 1 : 2, R.shoe); footSide(R, s, R.shoe, s.far ? 0x8a9098 : SILVER);
      const c2 = sRamp(R, s, R.shoe2);
      withTag(R, TAG.extra, () => { R.rect(s.x - 1, s.y + 2, 2, 1, c2.base); R.rect(s.x + 2, s.y + 2, 2, 1, c2.base); R.put(s.x + 4, s.y + 1, 0x7a1e2a); });
    },
  },
  iceSkates: { // skridskor: vit känga med blank skena
    label: 'Skridskor', group: 'Sport',
    front(R, s) {
      const rows = shaftFB(R, s, R.K ? 1 : 2, R.shoe);
      footFB(R, s, R.shoe, R.shoe.lo);
      for (const r of rows) R.put(lace(R, s), r.y, R.shoe.lo);
      withTag(R, TAG.extra, () => R.put(lace(R, s), s.y + 2, SILVER));
    },
    back(R, s) { this.front(R, s); },
    side(R, s) {
      shaftSide(R, s, R.K ? 1 : 2, R.shoe); footSide(R, s, R.shoe, sRamp(R, s, R.shoe).lo);
      withTag(R, TAG.extra, () => { const b = s.far ? 0x8a9098 : SILVER; R.rect(s.x - 1, s.y + 2, 5, 1, b); R.put(s.x + 4, s.y + 1, b); });
    },
  },
  flippers: { // simfötter: långa fenor
    label: 'Simfötter', group: 'Sport',
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, c = R.shoe;
      R.rect(x, y, w, 1, c.base);
      R.rect(x - 1, y + 1, w + 2, 1, c.hi); R.put(x + 1, y + 1, c.lo); R.put(x + w - 2, y + 1, c.lo);
    },
    back(R, s) { R.rect(s.x, s.y, R.lw + 1, 1, R.shoe.base); R.rect(s.x, s.y + 1, R.lw + 1, 1, R.shoe.lo); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      R.rect(x - 1, y, 5, 1, c.base);
      R.rect(x - 1, y + 1, 9, 1, c.hi); R.put(x + 4, y + 1, c.lo); R.put(x + 6, y + 1, c.lo); R.put(x - 1, y + 1, c.lo);
    },
  },

  // ================= kul =================
  platforms: { // platåskor: tjock sula i två våningar
    label: 'Platåskor', group: 'Kul', uses: ['shoes2'],
    front(R, s) { footFB(R, s, R.shoe, R.shoe2.base); R.rect(s.x, s.y + 2, R.lw + 1, 1, R.shoe2.lo); },
    back(R, s) { this.front(R, s); },
    side(R, s) { const c2 = sRamp(R, s, R.shoe2); footSide(R, s, R.shoe, c2.base); R.rect(s.x - 1, s.y + 2, 5, 1, c2.lo); },
  },
  clownShoes: { // clownskor: jättestora och runda
    label: 'Clownskor', group: 'Kul', uses: ['shoes2'],
    front(R, s) {
      const { x, y } = s, w = R.lw + 1, c = R.shoe;
      R.rect(x - 1, y, w + 2, 1, c.base); R.put(s.left ? x : x + w - 1, y, c.hi);
      R.rect(x - 1, y + 1, w + 2, 1, c.lo);
      R.put(lace(R, s), y, R.shoe2.base);
    },
    back(R, s) { R.rect(s.x - 1, s.y, R.lw + 3, 1, R.shoe.base); R.rect(s.x - 1, s.y + 1, R.lw + 3, 1, R.shoe.lo); },
    side(R, s) {
      const c = sRamp(R, s, R.shoe), { x, y } = s;
      R.rect(x - 1, y, 7, 1, c.base); R.put(x + 4, y, c.hi); R.put(x + 5, y, c.hi);
      R.rect(x - 1, y + 1, 8, 1, c.lo);
      if (!s.far) R.put(x + 1, y, sRamp(R, s, R.shoe2).base);
    },
  },
};
