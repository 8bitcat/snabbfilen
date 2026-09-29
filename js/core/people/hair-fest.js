// Nya frisyrer (omgång 2 – frisören): uppsatt hår, hästsvansar, flätor och gruppen Kul
// (kattöron, hjärtknutar, enhörningsknut …). Samlas i HAIR_REG av hair.js. Varje post byggs med
// hs(label, grupp, { front, back, side }) – hs klipper frisyren under täckande huvudbonader
// (se hair-kit.js); R.hatted = en täckande hatt sitter på. Id:n får aldrig byta namn efter släpp.
// Gruppen 'Kul' står i RICH_SKIP i people.js, så stadens slumpfolk får aldrig de frisyrerna.
import { hs, capF, backStd, backShort, sideStd, sleekF, sleekB, sleekS, dims, nz, row, col, mask, paint, plait, curls, TIE } from './hair-kit.js';
import { hang, bun, partF, braidBand, mix2 } from './hair-uppsatt.js';
import { curtF, longS, backTo, strands, bangsF, bangsS } from './hair-mellan.js';
import { BEAD } from './hair-lockar.js';

// ---------- färger som inte är hår ----------
const BOW = 0xe8606a;                                          // rosettens ljusa öglor (snodden är TIE)
const CLAW = 0x8a4a22, CLAW_HI = 0xd08a3a, CLAW_DK = 0x4e2410; // hårklämma i sköldpaddsmönster
const SCR = 0xe86a9a, SCR_HI = 0xf6aac6, SCR_LO = 0xa8406a;    // scrunchie (rosa sammet)
const PIN = 0xe0b24a;                                          // hårnål i guld

// ---------- hjälpare ----------
const behindR = (R) => { const put = R.put, B = Object.create(R); B.put = (x, y, c) => { if (!R.has(x, y)) put(x, y, c); }; return B; };
// fylld triangel i en mask (hörnen i heltal) – taggar och öron
const tri = (m, ax, ay, bx, by, cx, cy) => {
  const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  for (let y = Math.min(ay, by, cy); y <= Math.max(ay, by, cy); y++) for (let x = Math.min(ax, bx, cx); x <= Math.max(ax, bx, cx); x++) {
    const d1 = s(x, y, ax, ay, bx, by), d2 = s(x, y, bx, by, cx, cy), d3 = s(x, y, cx, cy, ax, ay);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) m.set(x, y);
  }
  return m;
};
// rund blank knut med en spiral (ballerina)
const roundBun = (R, cx, cy, rx, ry) => {
  bun(R, cx, cy, rx, ry, false);
  const x = Math.round(cx), y = Math.round(cy), H = R.hair;
  R.put(x - 1, y, H.lo); R.put(x, y + 1, H.lo); R.put(x + 1, y, H.lo); R.put(x, y - 1, H.hi); R.put(x - 1, y - 1, H.hi);
};
// fiskbensfläta: 4 px bred med V-mönster (smalnar av i slutet), snodd + tofs. xs(y) = vänsterkanten
const fish = (R, xs, y0, y1, dark) => {
  const { put, hair: H } = R;
  for (let y = y0; y <= y1; y++) {
    const end = y >= y1 - 1, x0 = xs(y);
    for (let j = end ? 1 : 0; j < (end ? 3 : 4); j++) {
      const k = ((j < 2 ? j : 3 - j) + y) & 1;
      put(x0 + j, y, k ? (dark ? H.dk : H.lo) : j < 2 ? (dark ? H.base : H.hi) : dark ? H.lo : H.base);
    }
  }
  const xe = xs(y1); put(xe + 1, y1 + 1, TIE); put(xe + 2, y1 + 1, TIE); put(xe + 1, y1 + 2, H.base); put(xe + 2, y1 + 2, H.lo);
};
// rosett i flätans ände (över snodden som plait ritar på raden y)
const bow = (R, x, y) => { R.put(x - 1, y, BOW); R.put(x + 2, y, BOW); R.put(x - 1, y - 1, BOW); R.put(x + 2, y + 1, TIE); };
// tunn fläta med guldpärlor (fulaniflätor)
const beadBraid = (R, x, y0, y1, dark) => {
  const { put, hair: H } = R;
  for (let y = y0; y <= y1; y++) put(x, y, (y - y0) % 2 ? (dark ? H.dk : H.lo) : dark ? H.lo : H.base);
  if (x % 2 === 0 && y1 - y0 > 6) put(x, y0 + 4 + (x % 3), BEAD); put(x, y1 + 1, BEAD);
};
// corn rows över hjässan framifrån (mönstret från 'cornrows', men egna rader)
const rowsF = (R) => {
  const { put, hair: H, h0 } = R, gap = mix2(R);
  for (let y = h0 - 1; y <= h0 + 2; y++) for (let x = 7; x <= 16; x++) {
    if (y === h0 - 1 && (x < 8 || x > 15)) continue;
    put(x, y, x % 2 ? gap : (y & 1) ? H.lo : x < 12 ? H.hi : H.base);
  }
};
// hjärta 5×4 (vänsterkant x, överkant y)
const HEART = [[1, 2, 4, 5], [0, 1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5], [2, 3, 4], [3]];
const heart = (R, x, y) => { const m = mask(); HEART.forEach((xs, j) => xs.forEach((i) => m.set(x + i, y + j))); paint(R, m, { split: 99 }); R.put(x + 1, y + 1, R.hair.hi); R.put(x + 2, y, R.hair.hi); R.put(x + 3, y + 1, R.hair.lo); };
// kattöra: triangel med spetsen uppåt-utåt (dir −1 = vänster öra, 1 = höger), inre skugga
const catEar = (R, x0, dir) => {
  const { h0, hair: H } = R, m = mask();
  for (let j = 0; j < 5; j++) for (let i = 0; i <= Math.min(j, 3); i++) m.set(dir < 0 ? x0 + i : x0 + 3 - i, h0 - 5 + j);
  paint(R, m, { split: 99 });
  const ix = dir < 0 ? x0 + 1 : x0 + 2; R.put(ix, h0 - 3, H.lo); R.put(ix, h0 - 2, H.dk); R.put(dir < 0 ? ix + 1 : ix - 1, h0 - 2, H.lo);
};

export const HAIR_FEST = {
  // ================= Uppsatt =================
  ballerina: hs('Ballerina­knut', 'Uppsatt', {
    // allt slickat upp i en hög, rund och blank knut
    front(R) { sleekF(R); roundBun(R, 11.5, R.h0 - 3, 2.8, 2.3); },
    back(R) { sleekB(R, true); roundBun(R, 11.5, R.h0 - 2.5, 2.8, 2.3); },
    side(R) { sleekS(R); roundBun(R, 10.5, R.h0 - 3, 2.6, 2.3); },
  }),
  beehive: hs('Bi­kupa', 'Uppsatt', {
    // 60-talets höga, rundade tupering med utåtvippade toppar
    front(R) { const { put, hair: H, h0, eyeRow } = R;
      const m = mask().rows([[h0 - 5, 9, 14], [h0 - 4, 8, 15], [h0 - 3, 7, 16], [h0 - 2, 7, 16], [h0 - 1, 7, 16]]).rect(7, h0, 10, 3)
        .rect(6, h0 + 1, 2, eyeRow + 1 - h0).rect(16, h0 + 1, 2, eyeRow + 1 - h0).set(5, eyeRow + 1).set(18, eyeRow + 1);
      paint(R, m);
      row(R, h0 - 1, 9, 14, H.lo); put(8, h0 - 1, H.lo); put(15, h0 - 1, H.dk);
      put(9, h0 - 4, H.hi); put(8, h0 - 3, H.hi); put(10, h0 - 5, H.hi); put(9, h0 - 3, H.hi);
      row(R, h0 + 3, 8, 11, H.base); put(8, h0 + 4, H.base); put(11, h0 + 3, H.lo); put(10, h0 + 1, H.lo); put(12, h0 + 2, H.lo); put(15, h0 + 3, H.lo);
      put(5, eyeRow + 1, H.hi); put(18, eyeRow + 1, H.dk); },
    back(R) { const { put, hair: H, h0, headH } = R, b = h0 + headH - 2;
      const m = mask().rows([[h0 - 5, 9, 14], [h0 - 4, 8, 15], [h0 - 3, 7, 16], [h0 - 2, 7, 16], [h0 - 1, 7, 16]]).rect(7, h0, 10, b - h0).rect(6, h0 + 1, 12, b - h0 - 2).set(5, b - 2).set(18, b - 2);
      paint(R, m); col(R, 12, h0 - 3, b - 2, H.lo); put(11, b - 1, H.lo); put(9, h0 - 4, H.hi); put(8, h0 - 3, H.hi); },
    side(R) { const { put, hair: H, h0, eyeRow } = R;
      const m = mask().rows([[h0 - 5, 9, 13], [h0 - 4, 8, 14], [h0 - 3, 7, 15], [h0 - 2, 7, 16], [h0 - 1, 7, 16]]).rect(8, h0, 9, 3).rect(7, h0 + 1, 5, eyeRow + 1 - h0).set(6, eyeRow + 1).row(h0 + 3, 13, 16);
      paint(R, m); row(R, h0 - 1, 10, 15, H.lo); put(10, h0 - 4, H.hi); put(9, h0 - 3, H.hi); put(8, h0 + 5, H.lo); put(6, eyeRow + 1, H.lo); },
  }),
  frenchTwist: hs('Fransk rulle', 'Uppsatt', {
    // elegant: sidbena och volym fram, bak en lodrät rulle fäst med en hårnål
    front(R) { const { put, hair: H, skin, h0 } = R;
      paint(R, mask().rows([[h0 - 2, 10, 14], [h0 - 1, 8, 16], [h0, 7, 16], [h0 + 1, 7, 16], [h0 + 2, 7, 16]]).row(h0 + 3, 11, 16).set(16, h0 + 4).set(7, h0 + 3).set(7, h0 + 4));
      put(9, h0, skin.base); put(9, h0 - 1, H.lo); put(10, h0 - 2, H.hi); put(11, h0 - 2, H.hi); put(12, h0 + 1, H.lo); put(14, h0 + 2, H.lo); put(13, h0 + 3, H.lo);
      col(R, 17, h0, h0 + 3, H.lo); put(17, h0 + 4, H.dk); },
    back(R) { const { put, hair: H, h0, headH } = R, b = h0 + headH - 3;
      backStd(R, b, false);
      for (let k = 0; k < b - h0 - 1; k++) put(8 + (k >> 1), h0 + 1 + k, H.lo); // håret svept in mot rullen
      paint(R, mask().rect(12, h0 - 1, 3, b - h0 + 1).set(13, h0 - 2).set(15, h0 + 1).set(15, h0 + 2), { split: 14 });
      col(R, 11, h0, b - 1, H.dk); put(12, h0 + 1, H.hi); put(12, h0 + 2, H.hi); put(14, h0 + 3, PIN); put(15, h0 + 2, PIN); },
    side(R) { const { put, hair: H, h0 } = R; sleekS(R);
      paint(R, mask().rect(6, h0, 3, 6).set(7, h0 - 1).set(7, h0 + 6).cut(6, h0));
      col(R, 8, h0, h0 + 5, H.dk); put(6, h0 + 2, PIN); put(15, h0 + 3, H.base); put(16, h0 + 2, H.lo); },
  }),
  clawClip: hs('Klämma', 'Uppsatt', {
    // håret vridet upp i nacken och fäst med en stor klämma; topparna spretar ovanför
    front(R) { const { put, hair: H, h0, eyeRow } = R; capF(R, 3); partF(R);
      col(R, 7, h0 + 3, eyeRow + 2, H.base); col(R, 16, h0 + 3, eyeRow + 2, H.lo); put(8, h0 + 3, H.base); put(15, h0 + 3, H.lo); put(6, eyeRow + 2, H.lo); put(17, eyeRow + 2, H.dk);
      if (!R.hatted) { const B = behindR(R); for (const [x, t] of [[9, 3], [10, 4], [12, 4], [13, 3], [14, 2]]) col(B, x, h0 - t, h0 - 1, x > 11 ? H.lo : H.base); } },
    back(R) { const { put, hair: H, h0, headH } = R, b = h0 + headH - 3;
      sleekB(R, true);
      for (let y = h0 + 2; y < b; y++) { put(11, y, (y & 1) ? H.lo : H.hi); put(12, y, (y & 1) ? H.base : H.lo); } // vridningen
      for (const [x, t] of [[8, 2], [9, 4], [10, 3], [12, 4], [13, 3], [15, 2]]) col(R, x, h0 - t, h0 - 2, x > 11 ? H.lo : H.base);
      row(R, h0 - 1, 8, 15, CLAW_HI); row(R, h0, 8, 15, CLAW); row(R, h0 + 1, 9, 14, CLAW_DK);
      for (let x = 9; x <= 14; x += 2) put(x, h0 + 1, CLAW); put(10, h0, CLAW_HI); put(13, h0 - 1, CLAW); },
    side(R) { const { put, hair: H, h0 } = R; sleekS(R);
      for (const [x, t] of [[6, 3], [7, 4], [9, 3]]) col(R, x, h0 - t, h0 - 2, H.base); put(8, h0 - 2, H.lo);
      put(6, h0 - 1, CLAW_HI); put(7, h0 - 1, CLAW_HI); put(5, h0, CLAW); put(5, h0 + 1, CLAW); put(6, h0 + 2, CLAW_DK); put(7, h0 + 2, CLAW_DK); put(6, h0, CLAW); put(6, h0 + 1, CLAW_DK);
      put(15, h0 + 3, H.base); },
  }),
  halfBuns: hs('Halva knutar', 'Uppsatt', {
    // två små knutar högt upp på huvudet, resten av håret hänger ner
    front(R) { const { rect, hair: H, h0 } = R, { chest } = dims(R); capF(R, 3); partF(R); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      curtF(R, chest - 1, 2, h0 + 1);
      if (!R.hatted) { bun(R, 8.5, h0 - 1.8, 2, 1.6, false); bun(R, 14.5, h0 - 1.8, 2, 1.6, false); R.put(9, h0 - 1, TIE); R.put(14, h0 - 1, TIE); } },
    back(R) { const { h0 } = R, { chest } = dims(R); backTo(R, chest - 1); strands(R, h0 + 3, chest - 3, [9, 14]); col(R, 11, h0 - 1, h0 + 2, R.hair.lo);
      bun(R, 8.5, h0 - 1.5, 2, 1.6, false); bun(R, 14.5, h0 - 1.5, 2, 1.6, false); R.put(9, h0, TIE); R.put(14, h0, TIE); },
    side(R) { const { h0 } = R, { chest } = dims(R); longS(R, chest - 1); bun(R, 10, h0 - 2, 2, 1.6, false); R.put(10, h0 - 1, TIE); },
  }),
  bunBangs: hs('Knut med lugg', 'Uppsatt', {
    // hög knut på hjässan och en rak lugg
    front(R) { const { hair: H, h0 } = R; capF(R, 3); bangsF(R); col(R, 7, h0 + 3, h0 + 5, H.base); col(R, 16, h0 + 3, h0 + 5, H.lo); bun(R, 11.5, h0 - 2.6, 3, 2.2); },
    back(R) { sleekB(R, true); bun(R, 11.5, R.h0 - 2, 3, 2.2); },
    side(R) { sleekS(R); bangsS(R); bun(R, 9.5, R.h0 - 2.3, 2.6, 2.1); },
  }),

  // ================= Hästsvansar =================
  longPony: hs('Lång häst­svans', 'Hästsvansar', {
    // hög, blank hästsvans som räcker ända ner till midjan
    front(R) { const { rect, put, hair: H, h0, eyeRow } = R; sleekF(R);
      if (!R.hatted) { rect(11, h0 - 2, 2, 1, TIE); put(11, h0 - 3, H.hi); put(12, h0 - 3, H.base); put(12, h0 - 4, H.lo); }
      const B = behindR(R); for (let y = h0; y <= eyeRow + 4; y++) { B.put(17, y, H.lo); if (y > h0 + 1) B.put(18, y, H.dk); } },
    back(R) { const { rect, put, hair: H, h0 } = R, { waist } = dims(R); sleekB(R, true);
      if (R.hatted) { rect(11, h0 + 2, 2, 1, TIE); hang(R, 10, h0 + 3, waist, 3); return; }
      put(11, h0 - 3, H.hi); put(12, h0 - 3, H.base); rect(11, h0 - 2, 2, 1, TIE); hang(R, 10, h0 - 1, waist, 3); col(R, 11, h0 + 2, waist - 3, H.hi); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { waist } = dims(R); sleekS(R);
      if (R.hatted) { put(8, h0 + 2, TIE); hang(R, 6, h0 + 3, waist, 2, true); return; }
      const m = mask().row(h0 - 3, 6, 8).row(h0 - 2, 5, 8).rect(4, h0 - 1, 3, eyeRow - h0 + 2).rect(5, eyeRow + 1, 2, waist - eyeRow - 1).set(5, waist);
      paint(R, m); put(8, h0 - 2, TIE); put(9, h0 - 2, TIE); put(8, h0 - 1, TIE); put(5, h0 + 2, H.lo); col(R, 6, eyeRow + 2, waist - 2, H.lo); },
  }),
  curlyPony: hs('Lockig svans', 'Hästsvansar', {
    // hög hästsvans som slår ut i en stor krullig tofs
    front(R) { const { rect, h0 } = R; sleekF(R);
      if (!R.hatted) rect(11, h0 - 2, 2, 1, TIE);
      paint(behindR(R), mask().oval(18, h0 + 4, 2.2, 4), { tex: curls(111, 1.4) }); },
    back(R) { const { rect, h0 } = R; sleekB(R, true);
      const top = R.hatted ? h0 + 3 : h0 - 1;
      const m = mask().oval(11.5, top + 5, 3.6, 5); for (let y = top; y < top + 11; y++) { if (nz(7, y, 112) % 2) m.set(7, y); if (nz(16, y, 113) % 2) m.set(16, y); }
      paint(R, m, { tex: curls(114, 1.5) }); rect(11, top - 1, 2, 1, TIE); },
    side(R) { const { put, h0 } = R; sleekS(R);
      if (R.hatted) { put(8, h0 + 2, TIE); paint(R, mask().oval(6.5, h0 + 6, 2.6, 3.6), { tex: curls(115, 1.5) }); return; }
      const m = mask().oval(5.5, h0 + 3, 3.2, 5).row(h0 - 2, 6, 8).row(h0 - 1, 5, 8);
      for (let y = h0 - 1; y < h0 + 8; y++) if (nz(2, y, 116) % 2) m.set(2, y);
      paint(R, m, { tex: curls(117, 1.5) }); put(8, h0 - 2, TIE); put(9, h0 - 2, TIE); put(8, h0 - 1, TIE); },
  }),
  bangsPony: hs('Svans med lugg', 'Hästsvansar', {
    // hästsvans mitt på bakhuvudet och en rak lugg
    front(R) { const { hair: H, h0, eyeRow } = R, { chin } = dims(R); capF(R, 3); bangsF(R); col(R, 7, h0 + 3, h0 + 5, H.base); col(R, 16, h0 + 3, h0 + 5, H.lo);
      const B = behindR(R); for (let y = eyeRow - 1; y <= chin + 1; y++) { B.put(17, y, H.lo); B.put(18, y, H.dk); } },
    back(R) { const { rect, h0 } = R, { chest } = dims(R); sleekB(R, false); rect(11, h0 + 3, 2, 1, TIE); hang(R, 10, h0 + 4, chest, 3); },
    side(R) { const { put, h0 } = R, { chest } = dims(R); sleekS(R); bangsS(R); put(8, h0 + 3, TIE); put(8, h0 + 4, TIE); hang(R, 6, h0 + 4, chest - 1, 2, true); put(7, h0 + 3, R.hair.base); },
  }),
  scrunchiePony: hs('Scrunchie­svans', 'Hästsvansar', {
    // 90-tal: hög hästsvans med en stor rosa scrunchie
    front(R) { const { put, hair: H, h0, eyeRow } = R; sleekF(R);
      if (!R.hatted) { row(R, h0 - 3, 10, 13, SCR_HI); row(R, h0 - 2, 9, 14, SCR); row(R, h0 - 1, 10, 13, SCR_LO); put(9, h0 - 2, SCR_HI); put(11, h0 - 2, SCR_HI); put(13, h0 - 2, SCR_LO); put(14, h0 - 2, SCR_LO); put(12, h0 - 3, SCR); }
      const B = behindR(R); for (let y = h0 + 1; y <= eyeRow + 2; y++) { B.put(17, y, H.lo); if (y > h0 + 2) B.put(18, y, H.dk); } },
    back(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sleekB(R, true);
      const y = R.hatted ? h0 + 2 : h0 - 2;
      hang(R, 10, y + 2, chest, 3);
      row(R, y, 9, 14, SCR); row(R, y - 1, 10, 13, SCR_HI); row(R, y + 1, 10, 13, SCR_LO); put(9, y, SCR_HI); put(12, y, SCR_HI); put(14, y, SCR_LO); put(11, y + 1, SCR); put(12, y + 2, H.lo); },
    side(R) { const { put, hair: H, h0, eyeRow } = R, { chest } = dims(R); sleekS(R);
      if (R.hatted) { put(8, h0 + 2, SCR); put(7, h0 + 2, SCR); hang(R, 6, h0 + 3, chest, 2, true); return; }
      const m = mask().rect(4, h0, 3, eyeRow - h0 + 1).rect(5, eyeRow + 1, 2, chest - eyeRow - 1).set(5, chest);
      paint(R, m); col(R, 5, h0 + 2, eyeRow, H.lo);
      row(R, h0 - 3, 6, 8, SCR_HI); row(R, h0 - 2, 5, 9, SCR); row(R, h0 - 1, 5, 8, SCR_LO); put(7, h0 - 2, SCR_HI); put(9, h0 - 2, SCR_LO); put(5, h0 - 2, SCR_HI); },
  }),
  twinTails: hs('Långa tofsar', 'Hästsvansar', {
    // två höga tofsar som hänger ner till bröstet
    front(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sleekF(R); partF(R);
      bun(R, 6, h0 - 0.5, 1.7, 1.5, false); bun(R, 17, h0 - 0.5, 1.7, 1.5, false);
      hang(R, 4, h0 + 1, chest, 3); hang(R, 17, h0 + 1, chest, 3, true); put(7, h0, TIE); put(7, h0 + 1, TIE); put(16, h0, TIE); put(16, h0 + 1, TIE); },
    back(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sleekB(R, false); col(R, 11, h0 - 1, h0 + R.headH - 5, H.lo);
      bun(R, 6, h0 - 0.5, 1.7, 1.5, false); bun(R, 17, h0 - 0.5, 1.7, 1.5, false);
      hang(R, 4, h0 + 1, chest, 3); hang(R, 17, h0 + 1, chest, 3, true); put(7, h0, TIE); put(7, h0 + 1, TIE); put(16, h0, TIE); put(16, h0 + 1, TIE); },
    side(R) { const { put, h0 } = R, { chest } = dims(R); sleekS(R); bun(R, 8.5, h0 - 1, 1.7, 1.5, false); hang(R, 6, h0 + 1, chest - 1, 3, true); put(9, h0 + 1, TIE); put(9, h0, TIE); },
  }),

  // ================= Flätor =================
  fishtail: hs('Fisk­bens­fläta', 'Flätor', {
    // en bred fiskbensfläta över personens högra axel (framifrån bildens vänstra)
    front(R) { const { rect, put, hair: H, skin, h0, eyeRow } = R, { chin, waist } = dims(R); capF(R, 3);
      put(13, h0, skin.base); put(13, h0 - 1, H.lo); rect(8, h0 + 3, 5, 1, H.base); put(8, h0 + 4, H.base); put(10, h0 + 3, H.lo);
      col(R, 16, h0 + 3, eyeRow - 2, H.lo); rect(6, h0 + 1, 2, eyeRow - h0, H.base); put(6, h0 + 2, H.hi);
      fish(R, (y) => (y < chin ? 5 : 6), eyeRow, waist, false); },
    back(R) { const { rect, hair: H, h0, eyeRow } = R, { shoulder } = dims(R); backShort(R);
      rect(15, h0 + 2, 3, eyeRow - h0 - 1, H.base); col(R, 17, h0 + 2, eyeRow, H.lo); for (let k = 0; k < 4; k++) R.put(10 + k, h0 + 2 + k, H.lo);
      fish(R, () => 15, eyeRow + 1, shoulder + 1, true); },
    side(R) { const { hair: H, h0, eyeRow } = R, { chin, waist } = dims(R); sleekS(R); R.put(15, h0 + 3, H.base);
      if (R.flip) return;
      R.rect(8, h0 + 3, 3, eyeRow - h0 - 2, H.base); fish(R, (y) => (y < chin ? 8 : y < chin + 2 ? 9 : 10), eyeRow + 1, waist, false); },
  }),
  fulani: hs('Fulani­flätor', 'Flätor', {
    // corn rows över hjässan, en fläta mitt på huvudet och tunna flätor med guldpärlor
    front(R) { const { h0, eyeRow } = R, { chest } = dims(R); rowsF(R);
      braidBand(R, mask().rect(11, h0 - 1, 2, 4), true);
      col(R, 7, h0 + 3, eyeRow - 3, R.hair.lo); col(R, 16, h0 + 3, eyeRow - 3, R.hair.dk);
      for (const [x, y0, e] of [[4, 3, 2], [6, 1, 0], [17, 1, 0], [19, 3, 2]]) beadBraid(R, x, h0 + y0, chest - e, x > 11);
      col(R, 5, h0 + 2, eyeRow, R.hair.lo); col(R, 18, h0 + 2, eyeRow, R.hair.dk); },
    back(R) { const { put, hair: H, h0, headH } = R, { chest } = dims(R), gap = mix2(R), b = h0 + headH - 4;
      for (let y = h0 - 1; y <= b; y++) for (let x = 7; x <= 16; x++) { if ((y === h0 - 1 || y === b) && (x < 8 || x > 15)) continue; put(x, y, x % 2 ? gap : (y & 1) ? H.lo : x < 12 ? H.hi : H.base); }
      for (const x of [6, 8, 10, 13, 15, 17]) beadBraid(R, x, b + 1, chest - ((x * 5) % 3), x > 11); },
    side(R) { const { put, hair: H, h0 } = R, { chest } = dims(R), gap = mix2(R);
      for (let y = h0 - 1; y <= h0 + 6; y++) for (let x = 8; x <= 16; x++) { if (y === h0 - 1 && (x < 9 || x > 15)) continue; if (y > h0 + 2 && x > 10) continue; put(x, y, y % 2 === 0 ? gap : (x & 1) ? H.lo : H.base); }
      for (const x of [5, 7, 9]) beadBraid(R, x, h0 + 4 + (x % 2), chest - (x % 3), x === 7); },
  }),
  braidBun: hs('Flät­knut', 'Flätor', {
    // en fläta upp längs bakhuvudet som lindas till en knut på hjässan
    front(R) { const { h0 } = R; sleekF(R); partF(R); if (!R.hatted) braidBand(R, mask().oval(11.5, h0 - 2.5, 3.2, 2.3), false); },
    back(R) { const { h0, headH } = R; sleekB(R, true);
      braidBand(R, mask().rect(10, h0, 4, headH - 3).rect(11, h0 + headH - 3, 2, 1), true);
      braidBand(R, mask().oval(11.5, h0 - 2, 3.2, 2.3), false); },
    side(R) { const { h0 } = R; sleekS(R); braidBand(R, mask().rows([[h0, 8, 9], [h0 + 1, 8, 9], [h0 + 2, 8, 9], [h0 + 3, 8, 9]]), true); braidBand(R, mask().oval(9.5, h0 - 2.2, 2.8, 2.3), false); },
  }),
  waterfall: hs('Vatten­falls­fläta', 'Flätor', {
    // en fläta runt bakhuvudet från tinning till tinning; resten av håret faller fritt
    front(R) { const { rect, hair: H, h0 } = R, { chest } = dims(R); capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      curtF(R, chest, 2, h0 + 1);
      braidBand(R, mask().rect(6, h0 + 1, 2, 3), false); braidBand(R, mask().rect(16, h0 + 1, 2, 3), false); },
    back(R) { const { put, hair: H, h0, eyeRow } = R, { chest } = dims(R); backTo(R, chest);
      braidBand(R, mask().rect(6, eyeRow - 3, 12, 2).set(5, eyeRow - 4).set(18, eyeRow - 4), false);
      for (const x of [7, 9, 11, 14, 16]) { col(R, x, eyeRow - 1, chest - 2 - (x % 3), H.lo); put(x + 1, eyeRow - 1, H.hi); } },
    side(R) { const { hair: H, h0, eyeRow } = R, { chest } = dims(R); longS(R, chest);
      const m = mask(); for (let t = 0; t <= 7; t++) { const x = 14 - t, y = h0 + 2 + Math.round(t * (eyeRow - 4 - h0) / 7); m.set(x, y).set(x, y + 1); }
      braidBand(R, m, false); col(R, 9, eyeRow - 1, chest - 2, H.lo); },
  }),
  braidsLong: hs('Långa flätor', 'Flätor', {
    // två långa flätor ner till midjan med rosetter i ändarna
    front(R) { const { rect, hair: H, h0, eyeRow } = R, { chin, waist } = dims(R); capF(R, 3); partF(R); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
      col(R, 7, h0 + 3, eyeRow - 2, H.base); col(R, 16, h0 + 3, eyeRow - 2, H.lo); col(R, 6, h0 + 1, eyeRow - 2, H.base); col(R, 17, h0 + 1, eyeRow - 2, H.lo);
      plait(R, (y) => (y < chin ? 5 : 6), eyeRow - 1, waist, false); plait(R, (y) => (y < chin ? 17 : 16), eyeRow - 1, waist, true);
      bow(R, 6, waist + 1); bow(R, 16, waist + 1); },
    back(R) { const { hair: H, h0, headH } = R, { shoulder } = dims(R); backShort(R); col(R, 11, h0 - 1, h0 + headH - 4, H.dk); col(R, 12, h0 - 1, h0 + headH - 4, H.lo);
      plait(R, (y) => (y < h0 + headH ? 8 : 7), h0 + headH - 4, shoulder + 1, false, false); plait(R, (y) => (y < h0 + headH ? 14 : 15), h0 + headH - 4, shoulder + 1, true, false); },
    side(R) { const { eyeRow } = R, { chin, waist } = dims(R); sideStd(R);
      plait(R, (y) => (y < chin ? 8 : y < chin + 2 ? 9 : 11), eyeRow - 1, waist, false); bow(R, 11, waist + 1); },
  }),
  boxBun: hs('Box braids i knut', 'Flätor', {
    // tunna box braids samlade i en stor knut på hjässan, två flätor ramar in ansiktet
    front(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); capF(R, 3);
      const g = mix2(R); for (const [x, y] of [[9, 0], [12, 1], [14, 0], [10, 2], [13, 2]]) put(x, h0 + y, g);
      for (const [x, d] of [[6, false], [17, true]]) for (let y = h0 + 2; y <= chin; y++) put(x, y, (y + (d ? 1 : 0)) % 3 === 0 ? (d ? H.dk : H.lo) : d ? H.lo : H.base);
      if (!R.hatted) paint(R, mask().oval(11.5, h0 - 2.8, 3.6, 2.5), { tex: (x, y, t) => (t === 'hi' ? null : x % 2 ? 'lo' : (y + (x >> 1)) % 3 === 0 ? 'hi' : null) }); },
    back(R) { const { put, hair: H, h0, headH } = R, b = h0 + headH - 4; sleekB(R, true);
      for (let x = 7; x <= 16; x++) for (let y = h0; y <= b; y++) if (x % 2) put(x, y, H.lo); else if ((y + (x >> 1)) % 3 === 0) put(x, y, H.hi);
      paint(R, mask().oval(11.5, h0 - 2.3, 3.6, 2.5), { tex: (x, y, t) => (t === 'hi' ? null : x % 2 ? 'lo' : (y + (x >> 1)) % 3 === 0 ? 'hi' : null) }); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); sleekS(R);
      for (let y = h0 + 3; y <= chin; y++) put(10, y, y % 3 ? H.base : H.lo);
      paint(R, mask().oval(9.5, h0 - 2.5, 3.2, 2.5), { tex: (x, y, t) => (t === 'hi' ? null : x % 2 ? 'lo' : (y + (x >> 1)) % 3 === 0 ? 'hi' : null) }); },
  }),

  // ================= Kul =================
  catEars: hs('Katt­öron', 'Kul', {
    // två knutar formade som kattöron och en page med lugg
    front(R) { const { rect, hair: H, h0 } = R, { chin } = dims(R); capF(R, 3); bangsF(R); curtF(R, chin, 2, h0 + 1); rect(7, h0 + 3, 1, 1, H.base);
      catEar(R, 7, -1); catEar(R, 13, 1); },
    back(R) { const { chin } = dims(R); backTo(R, chin); strands(R, R.h0 + 3, chin - 2, [9, 14]); catEar(R, 7, -1); catEar(R, 13, 1); },
    side(R) { const { put, hair: H, h0 } = R, { chin } = dims(R); longS(R, chin); bangsS(R);
      const B = behindR(R); for (const [x, y] of [[8, 5], [8, 4], [9, 4], [8, 3], [9, 3], [10, 3], [8, 2], [9, 2], [10, 2], [11, 2]]) B.put(x, h0 - y, H.lo);
      const m = mask(); for (let j = 0; j < 5; j++) for (let i = 0; i <= Math.min(j, 3); i++) m.set(14 - i, h0 - 5 + j);
      paint(R, m, { split: 99 }); put(13, h0 - 3, H.lo); put(13, h0 - 2, H.dk); put(12, h0 - 2, H.lo); },
  }),
  hearts: hs('Hjärt­knutar', 'Kul', {
    // två knutar formade som hjärtan högt upp på huvudet
    front(R) { const { put, h0 } = R; sleekF(R); partF(R); heart(R, 2, h0 - 4); heart(R, 15, h0 - 4); put(8, h0, TIE); put(15, h0, TIE); },
    back(R) { const { put, hair: H, h0 } = R; sleekB(R, false); col(R, 11, h0 - 1, h0 + R.headH - 5, H.lo); heart(R, 2, h0 - 4); heart(R, 15, h0 - 4); put(8, h0, TIE); put(15, h0, TIE); },
    side(R) { const { put, h0 } = R; sleekS(R); heart(R, 7, h0 - 5); put(10, h0, TIE); },
  }),
  professor: hs('Galet proffs', 'Kul', {
    // flint på toppen och vilt, spretigt hår åt alla håll (som en galen uppfinnare)
    front(R) { const { put, hair: H, skin, h0, eyeRow } = R;
      const m = mask().oval(4.8, h0 + 3, 2.6, 4).oval(19.2, h0 + 3, 2.6, 4);
      tri(m, 6, h0, 7, h0 + 2, 2, h0 - 2); tri(m, 5, h0 + 4, 5, h0 + 6, 1, h0 + 6); tri(m, 6, h0 + 6, 7, eyeRow, 3, eyeRow + 2);
      tri(m, 17, h0, 16, h0 + 2, 21, h0 - 2); tri(m, 18, h0 + 4, 18, h0 + 6, 22, h0 + 6); tri(m, 17, h0 + 6, 16, eyeRow, 20, eyeRow + 2);
      m.col(9, h0 - 2, h0 - 1).set(8, h0 - 3).col(14, h0 - 3, h0 - 1).set(15, h0 - 4).set(11, h0 - 1).set(12, h0 - 2);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && nz(x, y, 121) < 26 ? 'lo' : null) });
      put(10, h0, skin.hi); put(11, h0, skin.hi); put(10, h0 + 1, skin.hi); },
    back(R) { const { h0 } = R;
      const m = mask().oval(11.5, h0 + 4, 7.5, 5.5).cut(9, h0 - 1, 6, 2);
      tri(m, 5, h0 + 1, 6, h0 + 4, 1, h0); tri(m, 18, h0 + 1, 17, h0 + 4, 22, h0); tri(m, 6, h0 + 6, 7, h0 + 9, 2, h0 + 10); tri(m, 17, h0 + 6, 16, h0 + 9, 21, h0 + 10);
      tri(m, 9, h0, 11, h0, 8, h0 - 4); tri(m, 13, h0, 15, h0, 16, h0 - 4);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && nz(x, y, 122) < 26 ? 'lo' : null) });
      R.put(11, h0, R.skin.hi); R.put(12, h0, R.skin.hi); },
    side(R) { const { put, skin, h0, eyeRow } = R;
      const m = mask().oval(7.5, h0 + 3, 3.6, 4.5).cut(11, h0 + 3, 3, 8);
      tri(m, 8, h0, 10, h0 - 1, 5, h0 - 4); tri(m, 6, h0 + 2, 6, h0 + 5, 1, h0 + 2); tri(m, 6, h0 + 5, 7, eyeRow + 1, 2, eyeRow + 2); tri(m, 11, h0, 12, h0, 13, h0 - 3);
      paint(R, m, { tex: (x, y, t) => (t === 'base' && nz(x, y, 123) < 26 ? 'lo' : null) });
      put(13, h0, skin.hi); put(12, h0 + 1, skin.hi); },
  }),
  anime: hs('Anime­taggar', 'Kul', {
    // stora spetsiga taggar åt alla håll – som en tecknad hjälte
    front(R) { const { put, hair: H, h0, K } = R, f = h0 + (K ? 4 : 5);
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 3);
      tri(m, 8, h0, 11, h0 - 1, 5, h0 - 5); tri(m, 10, h0 - 1, 13, h0 - 1, 12, h0 - 5); tri(m, 12, h0 - 1, 15, h0, 18, h0 - 5);
      tri(m, 7, h0, 7, h0 + 3, 3, h0 - 1); tri(m, 16, h0, 16, h0 + 3, 20, h0 - 1); tri(m, 7, h0 + 2, 7, h0 + 5, 4, h0 + 6); tri(m, 16, h0 + 2, 16, h0 + 5, 19, h0 + 6);
      tri(m, 8, h0 + 2, 10, h0 + 2, 9, f); tri(m, 11, h0 + 2, 13, h0 + 2, 12, f - 1); tri(m, 13, h0 + 2, 15, h0 + 2, 15, f);
      paint(R, m); put(7, h0 - 3, H.hi); put(11, h0 - 3, H.hi); put(12, h0 - 4, H.hi); put(10, h0, H.lo); put(13, h0 + 1, H.lo); },
    back(R) { const { hair: H, h0, headH } = R, b = h0 + headH - 3;
      const m = mask().row(h0 - 1, 8, 15).rect(7, h0, 10, b - h0);
      tri(m, 8, h0, 11, h0 - 1, 5, h0 - 5); tri(m, 10, h0 - 1, 13, h0 - 1, 12, h0 - 5); tri(m, 12, h0 - 1, 15, h0, 18, h0 - 5);
      tri(m, 7, h0, 7, h0 + 3, 3, h0 - 1); tri(m, 16, h0, 16, h0 + 3, 20, h0 - 1); tri(m, 7, h0 + 3, 7, h0 + 6, 3, h0 + 7); tri(m, 16, h0 + 3, 16, h0 + 6, 20, h0 + 7);
      tri(m, 8, b - 1, 11, b - 1, 9, b + 3); tri(m, 12, b - 1, 15, b - 1, 14, b + 3);
      paint(R, m); col(R, 11, h0 + 1, b - 1, H.lo); },
    side(R) { const { hair: H, h0 } = R;
      const m = mask().row(h0 - 1, 9, 15).rect(8, h0, 9, 3).rect(8, h0 + 3, 4, 4);
      tri(m, 9, h0, 13, h0 - 1, 4, h0 - 5); tri(m, 12, h0 - 1, 16, h0, 11, h0 - 6); tri(m, 8, h0 + 1, 8, h0 + 4, 2, h0 + 1); tri(m, 8, h0 + 4, 10, h0 + 7, 3, h0 + 7);
      tri(m, 14, h0 + 2, 17, h0 + 2, 17, h0 + 5);
      paint(R, m); R.put(12, h0 + 1, H.lo); R.put(9, h0 + 4, H.lo); },
  }),
  clown: hs('Clown­frilla', 'Kul', {
    // flint på toppen och två stora krulliga tofsar vid öronen
    front(R) { const { put, hair: H, skin, h0 } = R;
      paint(R, mask().oval(4.5, h0 + 3.5, 3.3, 3.6).oval(19.5, h0 + 3.5, 3.3, 3.6), { tex: curls(131, 1.6) });
      paint(R, mask().row(h0 - 2, 11, 12).row(h0 - 1, 10, 13).set(12, h0 - 3), { tex: curls(132, 1.2) });
      put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); put(14, h0, skin.base); put(11, h0 - 3, H.lo); },
    back(R) { const { rect, eyeRow, h0, headH } = R;
      paint(R, mask().oval(4.5, h0 + 3.5, 3.3, 3.6).oval(19.5, h0 + 3.5, 3.3, 3.6).rect(7, eyeRow - 2, 10, h0 + headH - 3 - eyeRow + 2), { tex: curls(133, 1.6) });
      paint(R, mask().row(h0 - 2, 11, 12).row(h0 - 1, 10, 13), { tex: curls(134, 1.2) }); rect(10, h0 + 1, 2, 1, R.skin.hi); },
    side(R) { const { put, skin, h0 } = R;
      paint(R, mask().oval(6.5, h0 + 4, 3.8, 3.8).cut(11, h0 + 7, 1, 2), { tex: curls(135, 1.6) });
      paint(R, mask().row(h0 - 2, 11, 12).row(h0 - 1, 10, 13), { tex: curls(136, 1.2) }); put(13, h0 + 1, skin.hi); put(14, h0 + 1, skin.hi); },
  }),
  unicorn: hs('Enhörnings­knut', 'Kul', {
    // en snurrad knut som ett horn mitt på hjässan, resten av håret långt
    front(R) { const { rect, hair: H, h0 } = R, { chest } = dims(R); capF(R, 3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); curtF(R, chest, 2, h0 + 1);
      horn(R, [[h0 - 5, 11, 12], [h0 - 4, 11, 12], [h0 - 3, 10, 13], [h0 - 2, 10, 13], [h0 - 1, 9, 14]]); },
    back(R) { const { h0 } = R, { chest } = dims(R); backTo(R, chest); strands(R, h0 + 3, chest - 2, [9, 12, 15]);
      horn(R, [[h0 - 5, 11, 12], [h0 - 4, 11, 12], [h0 - 3, 10, 13], [h0 - 2, 10, 13], [h0 - 1, 9, 14]]); },
    side(R) { const { h0 } = R, { chest } = dims(R); longS(R, chest);
      horn(R, [[h0 - 5, 13, 13], [h0 - 4, 12, 13], [h0 - 3, 12, 14], [h0 - 2, 11, 14], [h0 - 1, 10, 14]]); },
  }),
};

// snurrat horn: rader [y, x0, x1], spiralränder och ljus vänsterkant
function horn(R, rows) {
  const H = R.hair, m = mask().rows(rows);
  paint(R, m, { split: 99, tex: (x, y, t) => ((x + y) % 3 === 0 ? 'lo' : (x + y) % 3 === 1 && t === 'base' ? 'hi' : null) });
  const [yb, xb0, xb1] = rows[rows.length - 1]; row(R, yb, xb0, xb1, H.lo); R.put(xb0, yb, H.dk);
}
