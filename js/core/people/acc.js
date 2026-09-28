// Accessoarer: huvudbonader, glasögon, väskor, hals (halsdukar/slipsar/halsband),
// smycken, hårspännen och hörlurar. Se docs/PEOPLE-ARKITEKTUR.md.
//
// Varje post: { label, group?, front(R), back(R), side(R), prep?, ...krokar }.
// Lagerordning (tidigast först): … bål → [hals] → [väska] → armar → huvud → ansikte →
// [glasögon] → hår → [hårspänne] → [huvudbonad] → [hörlurar] → [smycken] → kontur.
// Väskor har ofta en del bakom ryggen från sidan: lägg den i kroken beforeTorso(R)
// (kolla R.side) – då hamnar bålen framför.
// Färger: R.cap (look.cap – huvudbonaden), R.bagC (look.bagColor), R.phone (look.phoneColor),
// R.neckC (look.neckColor, annars detaljfärgen), R.acc (look.accent), R.skin, R.hair.
//
// Ändra inte de gamla posterna – de är pixellåsta av tools/people-regress.mjs.
import { mix, SW, SH, TAG, toneOf, far } from './util.js';

// ---------- pixelmallar (för de nya accessoarerna) ----------
// En mall är en lista rader med tecken. "3o" = "ooo" (en siffra före ett tecken upprepar det).
// '.' och tecken som saknas i paletten hoppas över. Mallarna packas upp en gång vid inläsning.
// Mallar för fram-/bakifrån ska vara centrerade (x0 + bredd/2 = 12) så att de kan spegelvändas.
const unpack = (rows) => rows.map((s) => s.replace(/(\d+)(\D)/g, (_, n, c) => c.repeat(+n)));
const mirror = (rows) => rows.map((s) => [...s].reverse().join(''));
const stamp = (R, x0, y0, rows, pal, yMax = SH) => { // rader på y ≥ yMax ritas inte
  for (let j = 0; j < rows.length && y0 + j < yMax; j++) {
    const s = rows[j];
    for (let i = 0; i < s.length; i++) { const c = pal[s[i]]; if (c !== undefined) R.put(x0 + i, y0 + j, c); }
  }
};
// Fasta färger i mallarna (versal = ljusare/annan ton)
const FIX = {
  w: 0xf4f1ea, W: 0xd2cdc0,                 // vitt, vit skugga
  k: 0x1e1c24, K: 0x46444f,                 // svart, svart glans
  g: 0xe8b830, G: 0xfff0a0, y: 0xa87a1c,    // guld: bas, glans, skugga
  s: 0xc4c9d4, S: 0xf4f6fa, z: 0x80879a,    // silver: bas, glans, skugga
  r: 0xd83a4a, R: 0x9a2230,                 // röd
  p: 0xf2a0b8, P: 0xe0607a,                 // rosa
  b: 0x3a7bd5, B: 0x2a5aa8,                 // blå
  e: 0x46a35a, E: 0x2f7a42,                 // grön
  v: 0x8e5bd1, c: 0x6fd8f4, t: 0xf8d860,    // lila, cyan, stjärngult
  n: 0x2d3a5c, N: 0x46608f, m: 0xe0e4ec,    // marinblå, marin glans, metall
  u: 0x8a5a33, U: 0x5e3a1e,                 // läder
};
// Palett: FIX + huvudfärgens ramp (h o l d) + andra rampen (H O L D) + egna tecken
const pal = (C, A, extra) => ({ ...FIX, h: C.hi, o: C.base, l: C.lo, d: C.dk, ...(A ? { H: A.hi, O: A.base, L: A.lo, D: A.dk } : {}), ...extra });
// Översta ritade pixeln (hår eller huvud) i kolumnerna, begränsad till [lo, hi]
const topOf = (R, xs, lo, hi) => { let t = R.h0; for (const x of xs) t = Math.min(t, R.topAt(x, R.h0)); return Math.max(lo, Math.min(hi, t)); };

// Accessoar ur mallar: t.f / t.b / t.s = [x0, rader]. t.b = 'mirror' ⇒ framsidans mall
// spegelvänd; utan t.b används framsidans mall även bakifrån. top(R) = mallens översta rad.
function tpl(label, group, top, t, palette, more = {}) {
  const f = t.f && [t.f[0], unpack(t.f[1])];
  const b = t.b === 'mirror' ? [f[0], mirror(f[1])] : t.b ? [t.b[0], unpack(t.b[1])] : f;
  const s = t.s && [t.s[0], unpack(t.s[1])];
  for (const m of [f, b, s]) if (m && m[1].some((r) => r.length !== m[1][0].length)) console.warn(`[acc] ${label}: mallens rader är olika långa`, m[1]);
  const mk = (m) => m && function (R) { stamp(R, m[0], top(R), m[1], palette(R)); };
  return { label, group, front: mk(f), back: mk(b), side: mk(s), ...more };
}
// Huvudbonad som täcker hjässan. H = antal rader ovanför huvudets överkant. Den gamla höga
// afron får hatten lyft så att den sitter ovanpå håret (nya frisyrer klipps i stället under
// hatten av hair-kit.js – hatten måste då täcka (12, h0-1), (7|8, h0) och (16, h0)).
const coverTop = (H) => (R) => (R.id && R.id.style === 'afro' ? R.h0 - Math.max(0, 5 - H) : R.h0) - H;
const capPal = (R) => pal(R.cap, R.acc);
const hatT = (label, group, H, t, palette = capPal, more) => tpl(label, group, coverTop(H), t, palette, more);

// ---------- huvudbonader (look.hat; null = ingen) ----------
const capFB = (R) => {
  const { rect, put, cap: C, skin, hair, h0, back } = R;
  rect(8, h0 - 2, 8, 1, C.base); rect(7, h0 - 1, 10, 3, C.base);
  rect(8, h0 - 2, 3, 1, C.hi); rect(7, h0 - 1, 2, 2, C.hi);
  for (let y = h0 - 1; y < h0 + 2; y++) put(16, y, C.lo);
  if (!back) { rect(6, h0 + 2, 12, 1, C.lo); rect(7, h0 + 3, 10, 1, mix(skin.lo, 0x201818, 0.25)); rect(11, h0, 2, 1, 0xf4f1ea); }
  else { rect(7, h0 + 2, 10, 1, C.lo); rect(11, h0 + 2, 2, 1, hair.base); }
};
const beanieFB = (R) => {
  const { rect, put, cap: C, h0 } = R;
  rect(9, h0 - 3, 6, 1, C.base); rect(8, h0 - 2, 8, 1, C.base); rect(7, h0 - 1, 10, 3, C.base);
  rect(7, h0 + 1, 10, 2, C.lo); for (let x = 7; x < 17; x += 2) put(x, h0 + 1, C.dk);
  rect(9, h0 - 3, 3, 1, C.hi); put(8, h0 - 2, C.hi);
  rect(11, h0 - 5, 2, 2, 0xf4f1ea); put(12, h0 - 4, 0xd8d4c8);
};
const headbandFB = (R) => { // hårband längs hela frisyrens bredd
  const { rect, put, has, cap: C, h0 } = R;
  let a = 11, b = 12;
  while (a > 0 && has(a - 1, h0)) a--;
  while (b < SW - 1 && has(b + 1, h0)) b++;
  rect(a, h0, b - a + 1, 1, C.base); put(a, h0, C.hi); put(b, h0, C.lo);
};
const bowFB = (R) => { // rosett på ena sidan av huvudet
  const { rect, put, topAt, cap: C, h0, back } = R;
  const bx = back ? 6 : 13, by = Math.max(1, topAt(bx + 2, h0) + 1);
  put(bx, by - 1, C.hi); put(bx + 1, by - 1, C.base); put(bx + 3, by - 1, C.base); put(bx + 4, by - 1, C.lo);
  rect(bx, by, 5, 1, C.base); put(bx, by, C.hi); put(bx + 2, by, C.dk); put(bx + 4, by, C.lo);
  put(bx, by + 1, C.lo); put(bx + 1, by + 1, C.lo); put(bx + 3, by + 1, C.lo); put(bx + 4, by + 1, C.dk);
};
const crownFB = (R) => {
  const { rect, put, topAt, cap: C, h0, back } = R;
  const cy = Math.max(3, topAt(9, h0));
  rect(8, cy - 1, 8, 2, C.base); rect(8, cy - 1, 8, 1, C.hi); put(15, cy - 1, C.base); put(15, cy, C.lo);
  put(8, cy - 2, C.hi); put(15, cy - 2, C.base); rect(11, cy - 3, 2, 2, C.base); put(11, cy - 3, C.hi);
  if (!back) { put(9, cy, 0x3a8ae0); rect(11, cy, 2, 1, 0xd83a4a); put(14, cy, 0x3a8ae0); }
};
const bucketFB = (R) => { // fiskehatt: kupol + nedvinklat brätte
  const { rect, put, cap: C, h0 } = R;
  rect(9, h0 - 4, 6, 1, C.base); rect(8, h0 - 3, 8, 3, C.base);
  rect(9, h0 - 4, 3, 1, C.hi); put(8, h0 - 3, C.hi); put(15, h0 - 2, C.lo);
  rect(6, h0, 12, 1, C.lo); put(6, h0 + 1, C.dk); put(17, h0 + 1, C.dk);
};
const tophatFB = (R) => { // hög hatt med band i detaljfärgen
  const { rect, put, cap: C, acc, h0 } = R;
  rect(8, h0 - 7, 8, 7, C.base); rect(8, h0 - 7, 8, 1, C.hi); put(8, h0 - 6, C.hi);
  for (let y = h0 - 6; y < h0 - 1; y++) put(15, y, C.lo);
  rect(8, h0 - 1, 8, 1, acc.base);
  rect(6, h0, 12, 1, C.dk);
};

// Hippieband: tunt pannband med pärlor och en fjäder som hänger vid tinningen
const HIPPIE = { f: unpack(['2.hoO2oO2oOl2.', '.O12.', '.w12.', 'wW12.', 'W13.']), s: unpack(['.h2oO4ol', '2.O7.', '2.w7.', '.wW7.', '.W8.']) };
HIPPIE.b = mirror(HIPPIE.f);
// Öronmuffar: fluffiga kuddar över öronen + bygel över hjässan
const MUFF = { l: unpack(['.o.', 'hoo', 'oho', '.l.']), r: unpack(['.o.', 'ool', 'ohl', '.l.']), s: unpack(['.oo.', 'hooo', 'oohl', '.ll.']) };
function muffs(R) {
  const { rect, put, h0, eyeRow } = R, P = capPal(R);
  rect(9, h0 - 3, 6, 1, P.d); put(8, h0 - 2, P.d); put(15, h0 - 2, P.d); put(7, h0 - 1, P.d); put(16, h0 - 1, P.d);
  rect(6, h0, 1, eyeRow - 2 - h0, P.d); rect(17, h0, 1, eyeRow - 2 - h0, P.d);
  stamp(R, 4, eyeRow - 2, MUFF.l, P); stamp(R, 17, eyeRow - 2, MUFF.r, P);
}
// Pälsmössa (ushanka): pälskant + öronlappar ner över öronen
const USH = { f: unpack(['3.h6ol3.', '2.hoohoohool2.', '.hohoohoohool.', '.ohoohoohoohl.']), s: unpack(['3.h5ol2.', '2.hoohoohol.', '.hoohoohoohl', '.ohoohoohool']) };
function ushanka(R, side) {
  const y = coverTop(3)(R), P = capPal(R), y2 = R.eyeRow + 1;
  stamp(R, side ? 6 : 5, y, side ? USH.s : USH.f, P);
  const fur = (x, yy) => (((x * 3 + yy * 5) & 3) === 0 ? P.h : P.o);
  for (let yy = y + 4; yy <= y2; yy++) {
    const last = yy === y2;
    if (side) { for (let x = 10; x < 14; x++) R.put(x, yy, fur(x, yy)); R.put(13, yy, P.l); if (last) { R.put(10, yy, P.l); R.put(13, yy, P.d); } continue; }
    for (const [a, b, inner] of [[5, 7, 7], [16, 18, 16]]) {
      for (let x = a; x <= b; x++) R.put(x, yy, x === inner ? P.l : fur(x, yy));
      if (last) R.put(a === 5 ? 5 : 18, yy, P.l);
    }
    R.put(18, yy, P.l);
  }
}
// Sjalett: knuten under hakan, ramar in ansiktet. Prickarna läggs sist med R.pattern.
function scarfHead(R) {
  const { rect, put, h0, headH, side, back } = R, P = capPal(R), y = coverTop(2)(R), chin = h0 + headH - 1;
  if (side) {
    rect(9, y, 7, 1, P.o); put(9, y, P.h); rect(8, y + 1, 9, 3, P.o); put(8, y + 1, P.h); rect(8, y + 3, 9, 1, P.l);
    rect(8, h0 + 2, 6, chin - h0 - 2, P.o); for (let yy = h0 + 2; yy < chin; yy++) { put(8, yy, P.l); put(13, yy, P.l); }
    rect(11, chin, 3, 1, P.l); rect(13, chin + 1, 2, 1, P.o); put(13, chin + 2, P.l);
  } else {
    rect(8, y, 8, 1, P.o); put(8, y, P.h); rect(7, y + 1, 10, 3, P.o); put(7, y + 1, P.h); put(16, y + 1, P.l); put(16, y + 2, P.l);
    if (back) {
      rect(7, h0 + 2, 10, chin - h0 - 2, P.o); for (let yy = h0 + 2; yy < chin; yy++) { put(7, yy, P.h); put(16, yy, P.l); }
      rect(9, chin, 6, 1, P.o); rect(11, chin + 1, 2, 1, P.l);
    } else {
      rect(7, y + 3, 10, 1, P.l);
      for (let yy = h0 + 2; yy < chin - 1; yy++) { put(6, yy, P.h); put(7, yy, P.l); put(16, yy, P.l); put(17, yy, P.o); }
      rect(7, chin - 1, 2, 1, P.o); rect(15, chin - 1, 2, 1, P.l); put(9, chin, P.o); put(14, chin, P.l);
      rect(11, chin + 1, 2, 1, P.o); put(10, chin + 2, P.l); put(13, chin + 2, P.l);
    }
  }
  R.pattern(TAG.hat, (x, yy, c) => (c !== P.l && (x * 5 + yy * 3) % 7 === 0 ? FIX.w : null));
}

export const HAT_REG = {
  none: { label: 'Ingen' },
  cap: {
    label: 'Keps', group: 'Kepsar & hattar', front: capFB, back: capFB,
    side(R) { const { rect, cap: C, h0 } = R; rect(9, h0 - 2, 7, 1, C.base); rect(8, h0 - 1, 9, 3, C.base); rect(9, h0 - 2, 3, 1, C.hi); rect(16, h0 + 2, 4, 1, C.lo); rect(8, h0 + 2, 9, 1, C.lo); },
  },
  beanie: {
    label: 'Mössa', group: 'Mössor', front: beanieFB, back: beanieFB,
    side(R) { const { rect, cap: C, h0 } = R; rect(10, h0 - 3, 5, 1, C.base); rect(9, h0 - 2, 7, 1, C.base); rect(8, h0 - 1, 9, 2, C.base); rect(8, h0 + 1, 9, 2, C.lo); rect(11, h0 - 5, 2, 2, 0xf4f1ea); },
  },
  headband: {
    label: 'Hårband', group: 'Hårband & rosetter', front: headbandFB, back: headbandFB,
    side(R) { const { rect, put, has, cap: C, h0 } = R;
      let a = 12, b = 12;
      while (a > 0 && has(a - 1, h0)) a--;
      while (b < SW - 1 && has(b + 1, h0)) b++;
      rect(a, h0, b - a + 1, 1, C.base); put(b, h0, C.hi); put(a, h0, C.lo); },
  },
  bow: {
    label: 'Rosett', group: 'Hårband & rosetter', front: bowFB, back: bowFB,
    side(R) { const { rect, put, topAt, cap: C, h0 } = R;
      const bx = 8, by = Math.max(1, topAt(10, h0) + 1);
      put(bx, by - 1, C.lo); put(bx + 1, by - 1, C.base); put(bx + 3, by - 1, C.base); put(bx + 4, by - 1, C.hi);
      rect(bx, by, 5, 1, C.base); put(bx + 2, by, C.dk); put(bx + 4, by, C.hi);
      put(bx, by + 1, C.dk); put(bx + 1, by + 1, C.lo); put(bx + 3, by + 1, C.lo); put(bx + 4, by + 1, C.lo); },
  },
  crown: {
    label: 'Krona', group: 'Fest', front: crownFB, back: crownFB,
    side(R) { const { rect, put, topAt, cap: C, h0 } = R;
      const cy = Math.max(3, topAt(10, h0));
      rect(9, cy - 1, 7, 2, C.base); rect(9, cy - 1, 7, 1, C.hi); put(9, cy, C.lo);
      put(9, cy - 2, C.base); put(15, cy - 2, C.hi); rect(12, cy - 3, 1, 2, C.base);
      put(13, cy, 0xd83a4a); },
  },
  bucket: {
    label: 'Fiske\u00adhatt', group: 'Kepsar & hattar', front: bucketFB, back: bucketFB,
    side(R) { const { rect, put, cap: C, h0 } = R; rect(10, h0 - 4, 5, 1, C.base); rect(9, h0 - 3, 7, 3, C.base); rect(10, h0 - 4, 2, 1, C.hi); rect(7, h0, 11, 1, C.lo); put(7, h0 + 1, C.dk); put(17, h0 + 1, C.dk); },
  },
  tophat: {
    label: 'Hög hatt', group: 'Fest', uses: ['accent'], front: tophatFB, back: tophatFB,
    side(R) { const { rect, put, cap: C, acc, h0 } = R; rect(9, h0 - 7, 7, 7, C.base); rect(9, h0 - 7, 7, 1, C.hi); put(9, h0 - 6, C.hi); rect(9, h0 - 1, 7, 1, acc.base); rect(7, h0, 11, 1, C.dk); },
  },
  // ---------- nya huvudbonader (ritas ur mallarna ovan; färg = look.cap) ----------
  fedora: hatT('Fedora', 'Kepsar & hattar', 4, {
    f: [5, ['4.ho2l2o4.', '3.h6ol3.', '3.h6ol3.', 'o2.8b2.l', 'h12ol', '3.8l3.']],
    b: [5, ['4.h5o4.', '3.h6ol3.', '3.h6ol3.', 'o2.8b2.l', 'h12ol']],
    s: [5, ['6.h3o4.', '5.h4ol3.', '5.h4ol3.', '.l3.6b3.', '.h11ol', '12.2l']],
  }, (R) => pal(R.cap, null, { b: mix(R.cap.dk, 0x141018, 0.5) })),
  cowboy: hatT('Cowboy\u00adhatt', 'Kepsar & hattar', 4, {
    f: [3, ['6.2h2.2o6.', '5.h2o2l2ol5.', '.h3.h6ol3.l.', '.3o.4bm3b.3l.', '3.h10ol3.', '6.6l6.']],
    b: [3, ['6.2h2.2o6.', '5.h6ol5.', '.h3.h6ol3.l.', '.3o.8b.3l.', '3.h10ol3.']],
    s: [4, ['7.hl2o5.', '6.h4ol4.', '.l4.h4ol3.l', '.2l3.6b2.2o', '3.h9ol2.']],
  }, (R) => pal(R.cap, null, { b: mix(R.cap.dk, 0x20140c, 0.45) })),
  straw: hatT('Halm\u00adhatt', 'Kepsar & hattar', 3, {
    f: [3, ['6.hohoho6.', '5.ohohohol5.', '5.8O5.', 'hohohohohohohohohl', 'l16.l']],
    s: [4, ['7.hoho6.', '6.ohohol5.', '6.6O5.', '.hohohohohohohohl', '.l14.l']],
  }, capPal, { uses: ['accent'] }),
  capBack: hatT('Keps bakåt', 'Kepsar & hattar', 2, {
    f: [7, ['.3h5o.', '2h7ol', '2h7ol', 'l2od2xd2ol']],
    b: [6, ['2.3h5o2.', '.2h7ol.', '.2h2o2w3ol.', '.2h7ol.', '12l', '.10d.']],
    s: [4, ['5.3h4o.', '4.2h6ol', '4.2h6ol', '4d9l']],
  }, (R) => pal(R.cap, null, { x: R.hair.lo })),
  sombrero: hatT('Sombrero', 'Kepsar & hattar', 5, {
    f: [1, ['9.h3o9.', '8.h4ol8.', '8.h4ol8.', '8.ewrrwe8.', '.h.h14ol.l.', 'h20ol']],
    s: [2, ['9.h2o8.', '8.h3ol7.', '8.h3ol7.', '8.ewrwe7.', '.h.h12ol.l.', '.h16ol.']],
  }),
  beret: hatT('Basker', 'Mössor', 3, {
    f: [5, ['7.d6.', '2.2h6o4.', '2h9ol2.', '2.10l2.']],
    b: 'mirror',
    s: [5, ['7.d6.', '3.h6o4.', '.2h8ol2.', '3.9l2.']],
  }),
  pompom: hatT('Toppluva', 'Mössor', 5, {
    f: [7, ['4.2H4.', '3.H2OL3.', '2.h4ol2.', '.h6ol.', 'hOoOoOoOol', 'h8ol', 'H8OL', 'OLOLOLOLOL']],
    s: [7, ['2.2H6.', '2.HOL5.', '3.h3ol2.', '2.h5ol.', '.hOoOoOoOl', '.h7ol', '.H7OL', '.OLOLOLOLO']],
  }, capPal, { uses: ['accent'] }),
  bandana: hatT('Bandana', 'Sjaletter & bandanas', 2, {
    f: [7, ['.h3ow3o.', 'hw5owol', 'h3ow4ol', '4lW5l']],
    b: [7, ['.h3ow3o.', 'hw5owol', 'h3ow4ol', '4lW5l', '4.2o4.', '3.l2.l3.', '3.d2.d3.']],
    s: [6, ['3.h2ow2ol.', '2.hw6ol', '2.h3ow3ol', '.o4lW4l', '2l9.', 'd10.']],
  }),
  bikeHelmet: hatT('Cykel\u00adhjälm', 'Hjälmar', 3, {
    f: [6, ['3.hoHHol3.', '.hodo2Oodol.', 'h2odo2Ood2ol', 'h4o2O4ol', '2l8d2l']],
    b: [6, ['3.hoHHol3.', '.hodo2Oodol.', 'h2odo2Ood2ol', 'h4o2O4ol', '12l']],
    s: [5, ['4.hoHHol4.', '3.hod2Oodol2.', '2.h2od2Oodol2.', '.lh3o2O3ol2.', '11l2d.']],
  }, capPal, { uses: ['accent'] }),
  sailor: hatT('Sjömans\u00admössa', 'Uniform & yrken', 3, {
    f: [7, ['.7wW.', '10W', '.Nngnngnn.', '.8k.']],
    b: [7, ['.7wW.', '10W', '.N7n.', '.8k.', '4.Nn4.', '4.Nn4.', '4.Nn4.', '3.k2.k3.']],
    s: [6, ['3.7wW.', '2.10W', '3.Nngnnnn2.', '3.7k2.', '2.n9.', '.2n9.', '.n10.', '.k10.']],
  }, (R) => pal(R.cap, null, { k: 0x1c2640 })),
  pirate: hatT('Pirat\u00adhatt', 'Utklädnad', 4, {
    f: [5, ['5.4g5.', '3.2g4o2g3.', '.2g3o2w3o2g.', 'g4o4W4og', '2.10l2.']],
    b: [5, ['5.4g5.', '3.2g4o2g3.', '.2g8o2g.', 'g12og', '2.10l2.']],
    s: [5, ['6.2g6.', '5.g3og4.', '3.g7og2.', '2.g9og.', '4.7l3.']],
  }),
  wizard: hatT('Troll\u00adkarls\u00adhatt', 'Utklädnad', 5, {
    f: [5, ['8.2o4.', '6.h2o5.', '5.hosl5.', '4.h4ol4.', '3.hos4ol3.', 'h12ol']],
    b: [5, ['8.2o4.', '6.h2o5.', '5.h2ol5.', '4.h4ol4.', '3.h6ol3.', 'h12ol']],
    s: [5, ['3.2o9.', '5.h2o6.', '5.hosl5.', '5.h3ol4.', '4.h5ol3.', '.h11ol']],
  }, (R) => pal(R.cap, null, { s: 0xf8d860 })),
  // Ligger ovanpå håret (täcker inte hjässan, klipper inget): placeras efter hårets topp
  catEars: tpl('Kattöron', 'Utklädnad', (R) => topOf(R, R.side ? [11, 14] : [9, 14], R.h0 - 2, R.h0) - 3, {
    f: [8, ['h6.h', '2o4.2o', 'opo2.opo', '8l']],
    b: [8, ['h6.h', '2o4.2o', '3o2.3o', '8l']],
    s: [10, ['.h2.l.', '.2o.2l', '.opo2l', '6l']],
  }, capPal),
  bunnyEars: tpl('Kaninöron', 'Utklädnad', (R) => topOf(R, R.side ? [11, 13] : [10, 13], R.h0 - 1, R.h0) - 4, {
    f: [8, ['.ho3.2o', '.op2.po.', '.op2.po.', '.op2.po.', '8l']],
    b: [8, ['.ho3.2o', '.2o2.2o.', '.2o2.2o.', '.2o2.2o.', '8l']],
    s: [10, ['.ho.2l', '.op2l.', '.op2l.', '.op2l.', '6l']],
  }, capPal),
  tiara: tpl('Tiara', 'Fest', (R) => topOf(R, R.side ? [11, 14] : [10, 13], R.h0 - 3, R.h0) - 2, {
    f: [9, ['2.2S2.', 's.2r.s', 'S4sz']],
    b: [9, ['2.2S2.', 's.2s.s', 'S4sz']],
    s: [10, ['3.S2.', '.s.r2.', '.S2sz.']],
  }, () => FIX),
  sweatband: tpl('Svett\u00adband', 'Hårband & rosetter', (R) => R.h0 + 2, {
    f: [7, ['h4oH3ol', '10l']],
    s: [8, ['h7ol', '9l']],
  }, capPal),
  hippie: {
    label: 'Hippie\u00adband', group: 'Hårband & rosetter', uses: ['accent'],
    front(R) { stamp(R, 5, R.h0 + 2, HIPPIE.f, capPal(R)); },
    back(R) { stamp(R, 5, R.h0 + 2, HIPPIE.b, capPal(R)); },
    side(R) { stamp(R, 7, R.h0 + 2, HIPPIE.s, capPal(R)); },
  },
  flatCap: hatT('Gubb\u00adkeps', 'Kepsar & hattar', 2, {
    f: [6, ['2.h6ol2.', '.hodooodool.', 'h2od4od2ol', '2.8d2.']],
    b: [6, ['2.h6ol2.', '.hodooodool.', 'h2od4od2ol']],
    s: [5, ['4.h4ol4.', '3.hod3odol2.', '3.h2od5ol.', '10.4d']],
  }),
  visor: tpl('Sol\u00adskärm', 'Kepsar & hattar', (R) => R.h0 + 1, {
    f: [6, ['.h8ol.', 'h10ol', '.10f.']],
    b: [6, ['.h8ol.']],
    s: [8, ['h7ol4.', '7.h4ol']],
  }, (R) => pal(R.cap, null, { f: mix(R.skin.lo, 0x201818, 0.25) })),
  ushanka: {
    label: 'Päls\u00admössa', group: 'Mössor',
    front(R) { ushanka(R, false); }, back(R) { ushanka(R, false); }, side(R) { ushanka(R, true); },
  },
  earmuffs: {
    label: 'Öron\u00admuffar', group: 'Mössor', front: muffs, back: muffs,
    side(R) { const P = capPal(R); R.rect(11, R.h0 - 2, 2, R.eyeRow - R.h0, P.d); R.put(11, R.h0 - 2, P.l); stamp(R, 9, R.eyeRow - 2, MUFF.s, P); },
  },
  headscarf: { label: 'Sjalett', group: 'Sjaletter & bandanas', front: scarfHead, back: scarfHead, side: scarfHead },
  hardhat: hatT('Bygg\u00adhjälm', 'Hjälmar', 3, {
    f: [5, ['4.ho2hol4.', '3.h2o2h2ol3.', '2.h3o2h3ol2.', '2.h3o2h3ol2.', 'h12ol']],
    s: [5, ['5.h3ol4.', '4.h5ol3.', '3.h7ol2.', '3.h7ol2.', '.h11ol']],
  }),
  captain: hatT('Kaptens\u00admössa', 'Uniform & yrken', 3, {
    f: [6, ['.9wW.', '12W', '2.3k2g3k2.', '2.8g2.', '2.K7k2.']],
    b: [6, ['.9wW.', '12W', '2.8k2.', '2.8k2.']],
    s: [6, ['2.8wW.', '.11W', '3.6kg2.', '3.5k2g2.', '8.K3k']],
  }),
  chef: hatT('Kock\u00admössa', 'Uniform & yrken', 5, {
    f: [6, ['2.3w2.3w2.', '.4wW4wW.', '5wW5wW', '.9wW.', '2.wWwWwWwW2.', '2.8W2.']],
    s: [6, ['3.3w.3w2.', '2.4wW3wW.', '.5wW4wW', '2.8wW.', '3.wWwWwWw2.', '3.7W2.']],
  }),
  student: hatT('Student\u00admössa', 'Fest', 3, {
    f: [6, ['.9wW.', '11wW', '2.3kbt3k2.', '2.8k2.', '2.K7k2.']],
    b: [6, ['.9wW.', '11wW', '2.8k2.', '2.8k2.']],
    s: [6, ['2.8wW.', '.10wW', '3.6kb2.', '3.7k2.', '8.K3k']],
  }, (R) => pal(R.cap, null, { t: 0xf0c030 })),
  party: tpl('Party\u00adhatt', 'Fest', (R) => topOf(R, [11, 12], R.h0 - 1, R.h0) - 4, {
    f: [9, ['2.2t2.', '2.oO2.', '.hoOo.', '.OooO.', 'hOoOoO']],
    s: [9, ['2.2t2.', '2.Oo2.', '.hOoo.', '.oOoO.', 'hoOoOl']],
  }, capPal, { uses: ['accent'] }),
  santa: hatT('Tomte\u00adluva', 'Fest', 4, {
    f: [5, ['5.h5o3.', '4.h5o.l2.', '3.h6ol.wW', '2.h8ol2W', '2.10w2.', '2.10W2.']],
    b: 'mirror',
    s: [4, ['5.lh3o4.', '4.lh5o3.', '2.2w.h5ol2.', '2.2Wh7ol.', '4.9w.', '4.9W.']],
  }),
  viking: hatT('Vikinga\u00adhjälm', 'Utklädnad', 4, {
    f: [4, ['q14.q', 'qQ4.hool4.Qq', '.qQ.h2o2d2ol.Qq.', '2.qQh2o2d2olQq2.', '3.dm2d2m2dmd3.']],
    s: [6, ['9.q2.', '4.hoolqQ2.', '3.h3oqQl2.', '2.h3o2d2ol.', '2.dm2dm2dmd.']],
  }, (R) => pal(R.cap, null, { q: 0xf0e6ca, Q: 0xc8b890, m: 0xe8ecf2 })),
  propeller: hatT('Propeller\u00adkeps', 'Utklädnad', 4, {
    f: [6, ['.3r.2k.3b.', '5.2K5.', '2.ho2O2oOl2.', '.h2O2o2O2ol.', '.h2O2o2O2ol.', '3.6l3.']],
    b: [6, ['.3r.2k.3b.', '5.2K5.', '2.ho2O2oOl2.', '.h2O2o2O2ol.', '.h2O2o2O2ol.']],
    s: [6, ['3.3rk3b2.', '6.K5.', '3.h2O2oOl2.', '2.h2o2O3ol.', '2.h2o2O3ol.', '9.3l']],
  }, capPal, { uses: ['accent'] }),
  halo: tpl('Gloria', 'Utklädnad', (R) => topOf(R, [10, 13], R.h0 - 1, R.h0) - 4, {
    f: [8, ['.6G.', 'g6.g', '.6y.']],
    s: [9, ['7.', 'G5gy', '7.']],
  }, () => FIX),
  devil: tpl('Djävuls\u00adhorn', 'Utklädnad', (R) => topOf(R, R.side ? [11, 14] : [9, 14], R.h0 - 2, R.h0) - 2, {
    f: [8, ['h6.h', '.o4.o.', '.ol2.lo.']],
    s: [10, ['4.h.', '3.o2.', '2.2ol.']],
  }, capPal),
  unicorn: tpl('Enhörning', 'Utklädnad', (R) => topOf(R, R.side ? [11, 14] : [10, 13], R.h0 - 1, R.h0) - 4, {
    f: [8, ['4.G3.', '3.gy3.', '3.Gg3.', 'o2.gy2.o', 'h6ol']],
    s: [10, ['5.G', '4.g.', '3.Gy.', '3.g2.', 'h4ol']],
  }, capPal),
};

// ---------- glasögon (look.glasses; false = inga, gamla true ⇒ 'square') ----------
// Ritas sist i ansiktet (före håret). Syns inte bakifrån.
const framesF = (R, fc) => {
  const { rect, put, skin, eyeRow } = R;
  const lens = mix(skin.base, 0xd8f0ff, 0.45);
  for (const lx of [8, 13]) { rect(lx, eyeRow - 1, 3, 2, lens); put(lx + 1, eyeRow - 1, 0x2a1d1a); put(lx + 1, eyeRow, 0x2a1d1a); }
  rect(8, eyeRow - 2, 3, 1, fc); rect(13, eyeRow - 2, 3, 1, fc); rect(11, eyeRow - 1, 2, 1, fc);
  rect(8, eyeRow + 1, 3, 1, mix(fc, skin.base, 0.45)); rect(13, eyeRow + 1, 3, 1, mix(fc, skin.base, 0.45));
  put(7, eyeRow - 1, fc); put(16, eyeRow - 1, fc);
};
const framesS = (R, fc) => {
  const { rect, put, skin, eyeRow } = R;
  rect(12, eyeRow - 2, 5, 1, fc); put(16, eyeRow - 1, mix(fc, 0xd8f0ff, 0.3)); put(16, eyeRow, fc);
  put(14, eyeRow + 1, mix(fc, skin.base, 0.5)); put(15, eyeRow + 1, mix(fc, skin.base, 0.5));
};
// Nya glasögon ur mallar (översta raden = top(R), oftast ögonraden − 2). 'i' = klart glas:
// med clear ritas ögonen om ovanpå glaset och sedan bågarna igen, så att ögonen (alla
// ögontyper) syns genom glaset. hair = ritas efter håret (skid-/simglasögon med rem) – då
// används även bakifrån-mallen (remmen över bakhuvudet).
const glassPal = (R, extra) => ({ ...FIX, i: mix(R.skin.base, 0xd8f0ff, 0.45), E: 0xf4f6fa, ...extra });
function tplG(label, group, top, t, palette = glassPal, { clear = false, hair = false, ...more } = {}) {
  const m = (k) => t[k] && [t[k][0], unpack(t[k][1])];
  for (const k of ['f', 's', 'b']) { const x = m(k); if (x && x[1].some((r) => r.length !== x[1][0].length)) console.warn(`[acc] ${label}: mallens rader är olika långa`, x[1]); }
  const mk = (x) => x && function (R) {
    const P = palette(R), y = top(R);
    stamp(R, x[0], y, x[1], P);
    if (clear) { R.draw('eyes'); const Q = { ...P }; delete Q.i; stamp(R, x[0], y, x[1], Q); }
  };
  const F = mk(m('f')), S = mk(m('s')), B = mk(m('b'));
  if (hair) return { label, group, ...more, afterHair(R) { const fn = R.side ? S : R.back ? B : F; if (fn) fn(R); } };
  return { label, group, front: F, side: S, back: B, ...more };
}
const eyeTop = (d) => (R) => R.eyeRow + d;

export const GLASSES_REG = {
  none: { label: 'Inga' },
  square: { label: 'Fyr\u00adkantiga', group: 'Glasögon', front: (R) => framesF(R, 0x1f1f26), side: (R) => framesS(R, 0x1f1f26) },
  round: { label: 'Runda', group: 'Glasögon', front: (R) => framesF(R, 0x6b3e1e), side: (R) => framesS(R, 0x6b3e1e) },
  sun: {
    label: 'Sol\u00adglasögon', group: 'Solglasögon',
    front(R) { const { rect, put, eyeRow } = R; rect(8, eyeRow - 1, 3, 2, 0x16161c); rect(13, eyeRow - 1, 3, 2, 0x16161c); rect(11, eyeRow - 1, 2, 1, 0x16161c); put(8, eyeRow - 1, 0x8fa0b8); put(13, eyeRow - 1, 0x8fa0b8); },
    side(R) { const { rect, put, eyeRow } = R; rect(14, eyeRow - 1, 3, 2, 0x16161c); rect(11, eyeRow - 1, 3, 1, 0x16161c); put(15, eyeRow - 1, 0x8fa0b8); },
  },
  // ---------- nya glasögon ----------
  nerd: tplG('Nörd\u00adbågar', 'Glasögon', eyeTop(-2), {
    f: [6, ['.4k2.4k.', '.k2ik2wk2ik.', '.k2ik2Wk2ik.', '.4k2.4k.']],
    s: [12, ['6k', '2.k2ik', '2.k2ik', '2.4k']],
  }, glassPal, { clear: true }),
  catEye: tplG('Katt\u00adögon\u00adbågar', 'Glasögon', eyeTop(-3), {
    f: [6, ['.k8.k.', '.4k2.4k.', '.k3i2k3ik.', '2.3i2.3i2.', '3.2k2.2k3.']],
    s: [12, ['.k4.', '5k.', '3.2ik', '3.2i.', '4.k.']],
  }, glassPal, { clear: true }),
  bigFrames: tplG('80-tals\u00adbågar', 'Glasögon', eyeTop(-2), {
    f: [6, ['.4v2.4v.', '.v3i2v3iv.', '.v3i2.3iv.', '.4v2.4v.']],
    s: [12, ['6v', '2.v2iv', '2.v2iv', '2.4v']],
  }, (R) => glassPal(R, { i: mix(R.skin.base, 0xf0b0e0, 0.4) }), { clear: true }),
  halfRim: tplG('Halv\u00adbågar i guld', 'Glasögon', eyeTop(-2), {
    f: [6, ['.gG2g2gG2gg.', '2.3i2.3i2.', '2.3i2.3i2.']],
    s: [12, ['4gG.', '3.2i.', '3.2i.']],
  }, glassPal, { clear: true }),
  monocle: tplG('Monokel', 'Glasögon', eyeTop(-2), {
    f: [6, ['8.2g2.', '7.g2ig.', '7.g2ig.', '8.2gy.', '11.y', '11.y', '10.y.', '9.y2.']],
    s: [13, ['3.g.', '3.g.', '3.g.', '2.yg.', '.y3.', '.y3.', 'y4.']],
  }, glassPal, { clear: true }),
  roundTint: tplG('Tonade runda', 'Solglasögon', eyeTop(-2), {
    f: [6, ['2.3g2.3g2.', '.g3i2g3ig.', '2.3i2.3i2.', '3.g4.g3.']],
    s: [12, ['5g.', '3.3i', '3.3i', '4.g.']],
  }, (R) => glassPal(R, { i: mix(R.skin.base, 0xc0602a, 0.55) }), { clear: true }),
  aviator: tplG('Pilot\u00adglasögon', 'Solglasögon', eyeTop(-2), {
    f: [6, ['2.8g2.', '.gS2k2.S2kg.', '2.3a2.3a2.', '2.2a4.2a2.']],
    s: [12, ['5g.', '3.S2k', '3.3a', '3.2a.']],
  }, (R) => glassPal(R, { a: 0x5a5048 })),
  sport: tplG('Sport\u00adglasögon', 'Solglasögon', eyeTop(-2), {
    f: [6, ['.10k.', '.S9c.', '.4b2k4b.']],
    s: [12, ['6k', '3.S2c', '3.3b']],
  }),
  heart: tplG('Hjärt\u00adglasögon', 'Roliga glasögon', eyeTop(-2), {
    f: [6, ['2.p.r2.p.r2.', '.kp2r2Rp2rk.', '3.R4.R3.']],
    s: [12, ['3.p.r', '3kp2r', '4.R.']],
  }),
  star: tplG('Stjärn\u00adglasögon', 'Roliga glasögon', eyeTop(-2), {
    f: [6, ['3.t4.t3.', '.k3t2y3tk.', '2.t.t2.t.t2.']],
    s: [12, ['4.t.', '3k3t', '3.t.t']],
  }),
  shutter: tplG('Galler\u00adglasögon', 'Roliga glasögon', eyeTop(-2), {
    f: [6, ['.10p.', '.p3k2p3kp.', '.10P.']],
    s: [12, ['6p', '3.p2k', '3.3P']],
  }),
  threeD: tplG('3D-glasögon', 'Roliga glasögon', eyeTop(-2), {
    f: [6, ['.10w.', '.w3r2w3cw.', '.w3R2W3Cw.', '.10W.']],
    s: [12, ['6w', '3.w2r', '3.w2R', '3.3W']],
  }, (R) => glassPal(R, { C: 0x3aa8c8 })),
  ski: tplG('Skid\u00adglasögon', 'Sport', eyeTop(-2), {
    f: [5, ['.12k.', 'nkS9xkn', 'nk10Xkn', '.5k2.5k.']],
    s: [8, ['6.4k', '6nkS2x', '6nk3X', '6.4k']],
    b: [6, ['12.', '5nm6n', '12n', '12.']],
  }, (R) => glassPal(R, { x: 0xf0a040, X: 0xd05a8a, n: 0x2d3a5c, m: 0xc4c9d4 }), { hair: true }),
  swim: tplG('Sim\u00adglasögon', 'Sport', eyeTop(-1), {
    f: [6, ['.k3c2k3ck.', '2.S2b2.3b2.']],
    s: [8, ['7kS2c', '7.3b']],
    b: [6, ['12k', '12.']],
  }, glassPal, { hair: true }),
  eyepatch: tplG('Ögon\u00adlapp', 'Utklädnad', eyeTop(-5), {
    f: [6, ['.k10.', '2.k9.', '3.2k7.', '5.2kK2k2.', '7.5k', '7.3k2.', '8.k3.']],
    s: [11, ['6.', '6.', '6.', '3kK2k', '3.3k', '3.3k', '4.k.']],
  }),
  heroMask: tplG('Hjälte\u00admask', 'Utklädnad', eyeTop(-2), {
    f: [6, ['.10k.', '3kE4kE3k', '.2kE4kE2k.', '2.3k2.3k2.']],
    s: [11, ['6k.', '.3kEk.', '.3kEk.', '2.3k2.']],
  }),
};

// ---------- väskor (look.bag; null = ingen; färg look.bagColor → R.bagC) ----------
const shoulderFB = (R) => {
  const { rect, put, bagC: B, ty0, ty1, tw, back } = R;
  const n = ty1 - ty0;
  for (let i = 0; i < n; i++) put(back ? 10 + tw - Math.round(i * (tw * 2 - 3) / n) : 13 - tw + Math.round(i * (tw * 2 - 3) / n), ty0 + i, B.dk);
  const bx = back ? 12 - tw - 3 : 11 + tw;
  rect(bx, ty1 - 3, 4, 4, B.base); rect(bx, ty1 - 3, 4, 1, B.hi); put(bx + 3, ty1, B.lo);
};
export const BAG_REG = {
  none: { label: 'Ingen' },
  backpack: {
    label: 'Rygg\u00adsäck', group: 'Ryggsäckar',
    front(R) { const { put, bagC: B, ty0, tw, K } = R; for (let y = ty0; y < ty0 + (K ? 4 : 6); y++) { put(12 - tw + 1, y, B.lo); put(10 + tw, y, B.lo); } }, // axelremmarna
    back(R) { const { rect, put, bagC: B, ty0, tw, K } = R;
      rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, (K ? 6 : 9), B.base);
      rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, 1, B.hi);
      put(12 - tw + 1, ty0 + 2, B.hi);
      for (let y = ty0 + 2; y < ty0 + (K ? 7 : 10); y++) put(10 + tw, y, B.lo);
      rect(12 - tw + 2, ty0 + (K ? 4 : 5), tw * 2 - 4, 1, B.dk);
      rect(11, ty0, 2, 1, B.lo); },
    beforeTorso(R) { // från sidan: säcken bakom ryggen
      if (!R.side) return;
      const { rect, put, bagC: B, torsoTop, K } = R;
      rect(5, torsoTop + 1, 4, K ? 6 : 8, B.base); rect(5, torsoTop + 1, 4, 1, B.hi); put(5, torsoTop + 2, B.lo);
      rect(6, torsoTop + (K ? 4 : 5), 3, 1, B.dk); },
    side(R) { R.rect(10, R.torsoTop, 1, 5, R.bagC.dk); }, // remmen över axeln
  },
  shoulder: {
    label: 'Axel\u00adväska', group: 'Axelväskor', front: shoulderFB, back: shoulderFB,
    side(R) { const { rect, put, bagC: B, torsoTop, hipTop } = R; for (let i = 0; i < 7; i++) put(10 + (i >> 1), torsoTop + i, B.dk); rect(13, hipTop - 3, 4, 4, B.base); rect(13, hipTop - 3, 4, 1, B.hi); },
  },
};

// ---------- hals: halsdukar, slipsar, flugor, halsband (look.neck; färg look.neckColor → R.neckC) ----------
// Ritas efter överdelen och förklädet, före väskan och armarna. Huvudet ritas efter –
// det som ska ligga över hakan läggs i kroken afterHead(R).
//
// Nya poster ur mallar: t.f/t.b/t.s börjar på bålens översta rad (R.ty0) och klipps vid
// bålens slut (hängande delar blir kortare på barn). t.h = { f, b?, s } är raden över
// hakan/nacken (R.ty0 − 1), ritad efter huvudet. Framifrån x0 = 6 (x 6–17), från sidan x0 = 9.
const neckPal = (R) => pal(R.neckC, null);
function tplN(label, group, t, palette = neckPal, more = {}) {
  const e = tpl(label, group, (R) => R.ty0, {}, palette, more);
  const m = (v) => v && [v[0], unpack(v[1])];
  const F = m(t.f), B = t.b ? m(t.b) : F, S = m(t.s);
  const mk = (x) => x && function (R) { stamp(R, x[0], R.ty0, x[1], palette(R), R.ty1); };
  Object.assign(e, { front: mk(F), back: mk(B), side: mk(S) });
  if (t.h) {
    const hf = m(t.h.f), hb = t.h.b ? m(t.h.b) : hf, hs = m(t.h.s);
    e.afterHead = function (R) { const x = R.side ? hs : R.back ? hb : hf; if (x) stamp(R, x[0], R.ty0 - 1, x[1], palette(R)); };
  }
  for (const x of [F, B, S]) if (x && x[1].some((r) => r.length !== x[1][0].length)) console.warn(`[acc] ${label}: mallens rader är olika långa`, x[1]);
  return e;
}

export const NECK_REG = {
  none: { label: 'Inget' },
  // ---- halsdukar ----
  scarf: tplN('Halsduk', 'Halsdukar', {
    f: [6, ['2.h6ol2.', '3.4lho3.', '7.ol3.', '7.ol3.', '7.2d3.']],
    b: [6, ['2.h6ol2.', '3.6l3.']],
    s: [9, ['.h4ol.', '5.ol.', '5.ol.', '5.2d.']],
    h: { f: [6, ['3.h4ol3.']], s: [9, ['.h4ol.']] },
  }),
  scarfStripe: tplN('Randig halsduk', 'Halsdukar', {
    f: [6, ['2.hwowowol2.', '3.4l2w3.', '7.ol3.', '7.2w3.', '7.ol3.', '7.2d3.']],
    b: [6, ['2.hwowowol2.', '3.6l3.']],
    s: [9, ['.hwowol.', '5.2w.', '5.ol.', '5.2w.', '5.2d.']],
    h: { f: [6, ['3.hwowol3.']], s: [9, ['.hwowol.']] },
  }),
  scarfLong: tplN('Lång halsduk', 'Halsdukar', {
    f: [6, ['2.h6ol2.', '3.ho2.ho3.', '3.ol2.ol3.', '3.ol2.ol3.', '3.ol2.ol3.', '3.2d2.2d3.']],
    b: [6, ['2.h6ol2.', '3.6l3.']],
    s: [9, ['.h4ol.', '5.ho.', '5.ol.', '5.ol.', '5.ol.', '5.2d.']],
    h: { f: [6, ['3.h4ol3.']], s: [9, ['.h4ol.']] },
  }),
  boa: tplN('Fjäder\u00adboa', 'Halsdukar', {
    f: [6, ['.hohoohoohl.', '2.ho4.oh2.', '2.oh4.ho2.', '2.ho4.oh2.', '2.oh4.lo2.', '2.lo4.ol2.']],
    b: [6, ['.hohoohoohl.']],
    s: [9, ['.hohoho.', '5.ho.', '5.oh.', '5.ho.', '5.lo.']],
    h: { f: [6, ['2.hohoohol2.']], s: [9, ['.hohool.']] },
  }),
  bandanaNeck: tplN('Hals\u00adbandana', 'Halsdukar', {
    f: [6, ['2.h6ol2.', '3.owoowl3.', '4.ow2l4.', '5.ol5.']],
    b: [6, ['2.h6ol2.', '5.2d5.', '4.l2.l4.']],
    s: [9, ['.h4ol.', '4.owl.', '5.ol.', '6.l.']],
  }),
  // ---- slipsar & flugor ----
  tie: tplN('Slips', 'Slipsar & flugor', {
    f: [6, ['4.whow4.', '5.ho5.', '5.ol5.', '5.ol5.', '5.ol5.', '5.ol5.', '5.dl5.']],
    b: [6, ['4.4w4.']],
    s: [9, ['5.wo.', '6.o.', '6.o.', '6.o.', '6.o.', '6.o.', '6.l.']],
  }),
  bowtie: tplN('Fluga', 'Slipsar & flugor', {
    f: [6, ['3.ho2dol3.', '3.ol2.ld3.']],
    b: [6, ['4.4l4.']],
    s: [9, ['5.ho.', '5.ol.']],
  }),
  cravat: tplN('Kravatt', 'Slipsar & flugor', {
    f: [6, ['4.h2ol4.', '5.ho5.', '5.ol5.', '5.ld5.']],
    b: [6, ['4.4l4.']],
    s: [9, ['4.h2o.', '5.ho.', '5.ol.', '5.2l.']],
  }),
  bolo: tplN('Bolo\u00adslips', 'Slipsar & flugor', {
    f: [6, ['4.u2.u4.', '4.s2cs4.', '5.2u5.', '5.2u5.', '5.2s5.']],
    b: [6, ['4.4u4.']],
    s: [9, ['5.u2.', '5.cs.', '6.u.', '6.u.', '6.s.']],
  }, (R) => pal(R.neckC, null, { c: 0x3ac0b0 })),
  // ---- halsband & kedjor ----
  necklace: tplN('Halsband med berlock', 'Halsband & kedjor', {
    f: [6, ['3.g4.g3.', '4.g2.g4.', '5.2g5.', '5.ho5.']],
    b: [6, ['4.y2.y4.']],
    s: [9, ['4.g3.', '5.g2.', '6.g.', '6.o.']],
  }),
  pearls: tplN('Pärl\u00adhalsband', 'Halsband & kedjor', {
    f: [6, ['3.w4.w3.', '3.Ww2.wW3.', '4.W2wW4.', '5.2W5.']],
    b: [6, ['4.w2.w4.']],
    s: [9, ['4.w3.', '4.Ww2.', '5.wW.', '6.W.']],
  }),
  chain: tplN('Guld\u00adkedja', 'Halsband & kedjor', {
    f: [6, ['2.gy4.yg2.', '3.Gy2.yG3.', '4.y2gy4.']],
    b: [6, ['3.gy2.yg3.']],
    s: [9, ['3.gy3.', '4.Gy2.', '5.yg.']],
  }),
  dogTag: tplN('Hund\u00adbricka', 'Halsband & kedjor', {
    f: [6, ['3.z4.z3.', '4.z2.z4.', '5.2z5.', '5.Ss5.', '6.z5.']],
    b: [6, ['4.z2.z4.']],
    s: [9, ['4.z3.', '5.z2.', '6.z.', '6.S.', '6.s.']],
  }),
  choker: tplN('Choker', 'Halsband & kedjor', {
    f: [6, ['4.kK2k4.', '5.ho5.']],
    b: [6, ['4.4k4.']],
    s: [9, ['3.3kK.', '6.o.']],
  }),
  lei: tplN('Blomster\u00adkrans', 'Halsband & kedjor', {
    f: [6, ['3.pr2.tp3.', '3.te2.er3.', '4.rptr4.']],
    b: [6, ['3.prtptr3.']],
    s: [9, ['3.prtp.', '5.te.', '5.rp.']],
  }),
  ruff: tplN('Pip\u00adkrage', 'Halsband & kedjor', {
    f: [6, ['.WwWwWwWwWw.']],
    s: [9, ['wWwWwWw.']],
    h: { f: [6, ['2.wWwWwWwW2.']], s: [9, ['.wWwWwW.']] },
  }),
  // ---- runt halsen ----
  medal: tplN('Medalj', 'Runt halsen', {
    f: [6, ['4.o2.o4.', '4.l2.l4.', '5.ol5.', '5.Gg5.', '5.gy5.']],
    b: [6, ['4.4o4.']],
    s: [9, ['4.o3.', '5.o2.', '5.l2.', '5.Gg.', '5.gy.']],
  }),
  lanyard: tplN('Nyckel\u00adband', 'Runt halsen', {
    f: [6, ['4.o2.o4.', '4.o2.o4.', '5.lo5.', '5.2b5.', '5.wn5.', '5.2W5.']],
    b: [6, ['4.4o4.']],
    s: [9, ['4.o3.', '5.o2.', '5.o2.', '5.b2.', '5.W2.', '5.W2.']],
  }),
  whistle: tplN('Vissel\u00adpipa', 'Runt halsen', {
    f: [6, ['4.o2.o4.', '5.2o5.', '5.Ssz4.']],
    b: [6, ['4.4o4.']],
    s: [9, ['4.o3.', '5.o2.', '5.Ssz']],
  }),
  camera: tplN('Kamera', 'Runt halsen', {
    f: [6, ['4.k2.k4.', '4.k2.k4.', '4.w3k4.', '4.kSmk4.', '4.k2mk4.']],
    b: [6, ['4.4k4.']],
    s: [9, ['4.k3.', '5.k2.', '5.2k.', '5.kmS', '5.2k.']],
  }, (R) => pal(R.neckC, null, { m: 0x6a7280 })),
  phonesNeck: tplN('Lurar runt halsen', 'Runt halsen', {
    f: [6, ['2.ho4.ol2.', '2.ol4.ld2.']],
    b: [6, ['2.ho4kol2.', '2.ol4.ld2.']],
    s: [9, ['.3kho2.', '4.ol2.']],
  }),
  bib: tplN('Haklapp', 'Runt halsen', {
    f: [6, ['4.oWWo4.', '3.o4wo3.', '3.owppwo3.', '3.o4wo3.', '4.4o4.']],
    b: [6, ['5.2o5.']],
    s: [9, ['5.o2.', '6.wo', '6.po', '6.wo', '6.o.']],
  }),
};

// ---------- smycken: örhängen, piercingar, armband, klockor (look.jewel) ----------
// Ritas sist, efter huvudbonaden (örhängen syns även med mössa). Armband: kroken afterArms(R).
//
// Örhängen: en mall för ETT öra, 3 px bred med örat i mitten, första raden = örats översta
// rad (ögonraden − 1; örsnibben är rad 2). Framifrån/bakifrån x 5–7 och spegelvänd x 16–18,
// från sidan x 10–12.
function earring(label, group, rows, more = {}) {
  const T = unpack(rows), M = mirror(T);
  const draw = (R) => { const y = R.eyeRow - 1; if (R.side) stamp(R, 10, y, T, FIX); else { stamp(R, 5, y, T, FIX); stamp(R, 16, y, M, FIX); } };
  return { label, group, front: draw, back: draw, side: draw, ...more };
}
// Händer och handleder – samma geometri som motorns armar (people.js). Framifrån/bakifrån
// har armen x0 = 12-tw-2 (vänster i bild, left) eller 12+tw (höger i bild); handen är armens
// två nedersta rader och handleden raden ovanför. Från sidan: left = false är närmaste armen,
// true den bortre (syns bara när den svänger). Ger [[x, y], …] (handleden: yttersta pixeln sist
// framifrån, mittpixeln i mitten från sidan).
function armPx(R, left, part) {
  const { torsoTop: t, tw, armLen, sit, eat, carry, walkA, walkB } = R;
  const hand = part === 'hand', out = [];
  if (!R.side) {
    const x0 = left ? 12 - tw - 2 : 12 + tw;
    if (eat) return hand ? [[left ? 11 : 12, t - 1], [left ? 10 : 13, t - 1], [left ? x0 + 4 : x0 - 3, t]] : [[left ? x0 + 3 : x0 - 2, t + 1]];
    const len = carry ? armLen - 2 : sit ? armLen : armLen + (left ? 1 : -1) * (walkA ? 1 : walkB ? -1 : 0);
    for (const j of hand ? [len - 2, len - 1] : [len - 3]) {
      const d = carry ? Math.round((j / len) * (tw + 1)) : 0, x = left ? x0 + d : x0 - d;
      if (left) out.push([x + 1, t + 1 + j], [x, t + 1 + j]); else out.push([x, t + 1 + j], [x + 1, t + 1 + j]);
    }
    if (sit && hand && !carry) out.push([left ? x0 + 2 : x0 - 1, t + len], [left ? x0 + 3 : x0 - 2, t + len]);
    return out;
  }
  const armSw = walkA ? -3 : walkB ? 3 : 0;
  if (left && (!armSw || eat || carry)) return out;
  if (eat) return hand ? [[15, t - 1], [16, t - 1], [15, t], [16, t]] : [[14, t + 1], [15, t + 1], [15, t + 1]];
  if (carry) return hand ? [[16, t + 4], [17, t + 4], [15, t + 5], [16, t + 5]] : [[14, t + 4], [15, t + 4], [15, t + 4]];
  const swing = left ? -armSw : armSw, len = sit ? armLen - 2 : armLen;
  for (const j of hand ? [len - 2, len - 1] : [len - 3]) {
    const tt = (j + 1) / len, x = 11 + Math.round(swing * tt * tt) + (sit ? Math.round(tt * 3) : 0);
    out.push([x, t + 1 + j], [x + 1, t + 1 + j], [x + 2, t + 1 + j]);
  }
  return out;
}
const isArm = (R, x, y) => { const g = R.tagAt(x, y); return g === TAG.skin || g === TAG.sleeve || g === TAG.jewel; };
// Handskar: färgar om händerna (tonen behålls) + ev. mudd på handleden. big = boxhandskar
function gloveHook(G, cuff, big = false) {
  return function (R) {
    const { put, get, tagAt, skin } = R;
    for (const left of [true, false]) {
      const far = R.side && left;
      for (const [x, y] of armPx(R, left, 'hand')) if (tagAt(x, y) === TAG.skin) put(x, y, G[toneOf(get(x, y), skin) || 'base']);
      if (cuff) for (const [x, y] of armPx(R, left, 'wrist')) if (isArm(R, x, y)) put(x, y, far ? cuff.lo : cuff.base);
      if (big && !R.side && !R.eat && !R.carry) for (const [x, y] of armPx(R, left, 'hand')) if (R.sit ? false : true) put(left ? x - 1 : x + 1, y, G.lo);
    }
  };
}
// Klocka/armband på en handled. wearer = 'left' (bärarens vänstra: höger i bild framifrån,
// vänster bakifrån) eller 'right'. Från sidan alltid närmaste armen. cols(i, n) → färg
function wristHook(wearer, cols) {
  return function (R) {
    const left = R.side ? false : (wearer === 'left') === !!R.back;
    const px = armPx(R, left, 'wrist');
    px.forEach(([x, y], i) => { if (isArm(R, x, y)) R.put(x, y, cols(i, px.length)); });
  };
}
const SHINE = { k: FIX.k, m: 0xd8dce4, g: FIX.g, G: FIX.G, y: FIX.y };

export const JEWEL_REG = {
  none: { label: 'Inga' },
  // ---- örhängen ----
  studGold: earring('Guld­knappar', 'Örhängen', ['3.', '3.', '.G.']),
  studDiamond: earring('Diamant­knappar', 'Örhängen', ['3.', '3.', '.S.']),
  hoops: earring('Ring­örhängen', 'Örhängen', ['3.', '3.', '3.', '.g.', 'G.y', '.y.']),
  pearlEar: earring('Pärl­örhängen', 'Örhängen', ['3.', '3.', '.y.', '.w.']),
  drops: earring('Dropp­örhängen', 'Örhängen', ['3.', '3.', '.y.', '.y.', '.b.', '.B.']),
  starEar: earring('Stjärn­örhängen', 'Örhängen', ['3.', '3.', '.y.', '.t.', 'ttt', 't.t']),
  heartEar: earring('Hjärt­örhängen', 'Örhängen', ['3.', '3.', '.y.', 'p.p', '.P.']),
  featherEar: earring('Fjäder­örhängen', 'Örhängen', ['3.', '3.', '.y.', '.t.', '.e.', '.e.', '.E.']),
  punk: earring('Punk­piercingar', 'Piercingar', ['.s.', '3.', '.s.', '.z.']),
  // ---- piercingar i ansiktet (syns inte bakifrån) ----
  noseRing: {
    label: 'Näsring', group: 'Piercingar',
    front(R) { R.put(13, R.eyeRow + 2, FIX.S); R.put(13, R.eyeRow + 3, FIX.z); },
    side(R) { R.put(16, R.eyeRow + 2, FIX.S); },
  },
  browPierce: {
    label: 'Ögonbryns­piercing', group: 'Piercingar',
    front(R) { R.put(15, R.eyeRow - 4, FIX.S); R.put(15, R.eyeRow - 2, FIX.s); },
    side(R) { R.put(15, R.eyeRow - 4, FIX.S); R.put(15, R.eyeRow - 2, FIX.s); },
  },
  lipPierce: {
    label: 'Läpp­piercing', group: 'Piercingar',
    front(R) { R.put(12, R.eyeRow + (R.K ? 4 : 5), FIX.S); },
    side(R) { R.put(15, R.eyeRow + (R.K ? 4 : 5), FIX.S); },
  },
  // ---- klockor & armband ----
  watch: { label: 'Armbands­ur', group: 'Klockor & armband', afterArms: wristHook('left', (i, n) => (i === n - 1 && n < 3) || (n === 3 && i === 1) ? 0xe8ecf2 : 0x2a2830) },
  goldWatch: { label: 'Guld­klocka', group: 'Klockor & armband', afterArms: wristHook('left', (i, n) => (i === n - 1 && n < 3) || (n === 3 && i === 1) ? FIX.G : FIX.y) },
  smartwatch: { label: 'Smart­klocka', group: 'Klockor & armband', afterArms: wristHook('left', (i, n) => (i === n - 1 && n < 3) || (n === 3 && i === 1) ? 0x5fd8ff : 0x1e1c24) },
  bracelet: { label: 'Guld­armband', group: 'Klockor & armband', afterArms: wristHook('right', (i) => (i % 2 ? FIX.g : FIX.G)) },
  beadBracelet: { label: 'Pärl­armband', group: 'Klockor & armband', afterArms: wristHook('right', (i) => [FIX.r, FIX.t, FIX.b][i % 3]) },
  // ---- handskar ----
  gloves: { label: 'Skinn­handskar', group: 'Handskar', afterArms: gloveHook({ hi: 0x55525e, base: 0x2e2c34, lo: 0x1e1c24, dk: 0x141218 }, null) },
  whiteGloves: { label: 'Vita handskar', group: 'Handskar', afterArms: gloveHook({ hi: 0xffffff, base: 0xf0eee8, lo: 0xcfcac0, dk: 0xa8a298 }, null) },
  mittens: { label: 'Tum­vantar', group: 'Handskar', afterArms: gloveHook({ hi: 0x5a9ae8, base: 0x3a7bd5, lo: 0x2a5aa8, dk: 0x1e4080 }, { base: 0xf4f1ea, lo: 0xd2cdc0 }) },
  gardening: { label: 'Trädgårds­handskar', group: 'Handskar', afterArms: gloveHook({ hi: 0x6cc27a, base: 0x46a35a, lo: 0x2f7a42, dk: 0x205a30 }, { base: 0xf0c030, lo: 0xc09018 }) },
  boxing: { label: 'Box­handskar', group: 'Handskar', afterArms: gloveHook({ hi: 0xf06070, base: 0xd83a4a, lo: 0x9a2230, dk: 0x6a1420 }, { base: 0xf4f1ea, lo: 0xd2cdc0 }, true) },
  // ---- set ----
  goldSet: {
    label: 'Guld­set', group: 'Set',
    ...earring('', '', ['3.', '3.', '3.', '.g.', 'G.y', '.y.']),
    label2: undefined,
    afterArms: wristHook('right', (i) => (i % 2 ? FIX.g : FIX.G)),
  },
};
JEWEL_REG.goldSet.label = 'Guld­set'; JEWEL_REG.goldSet.group = 'Set'; delete JEWEL_REG.goldSet.label2;

// ---------- hårspännen, diadem, blommor i håret (look.hairAcc) ----------
// Ritas direkt efter håret (och hårfärgseffekten), före huvudbonaden.
// R.topAt(x, fb) ger hårets/huvudets översta pixel i kolumnen x.
export const HAIR_ACC_REG = {
  none: { label: 'Inget' },
};

// ---------- hörlurar (look.phones; false = inga, true = 'over'; färg look.phoneColor → R.phone) ----------
const phonesFB = (R) => {
  const { rect, put, phone: pc, h0, eyeRow } = R;
  rect(9, h0 - 3, 6, 1, 0x2a2a30); put(8, h0 - 2, 0x2a2a30); put(15, h0 - 2, 0x2a2a30); put(7, h0 - 1, 0x2a2a30); put(16, h0 - 1, 0x2a2a30);
  rect(5, eyeRow - 2, 2, 4, pc.base); put(5, eyeRow - 2, pc.hi);
  rect(17, eyeRow - 2, 2, 4, pc.lo);
};
export const PHONES_REG = {
  none: { label: 'Inga' },
  over: {
    label: 'Hörlurar', group: 'Hörlurar', front: phonesFB, back: phonesFB,
    side(R) { const { rect, put, phone: pc, h0, eyeRow } = R; rect(11, h0 - 2, 2, eyeRow - h0, 0x2a2a30); rect(10, eyeRow - 2, 3, 4, pc.base); put(10, eyeRow - 2, pc.hi); },
  },
};
