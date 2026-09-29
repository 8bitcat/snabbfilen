// Nya frisyrer (omgång 2 – frisören): lockar, afro, dreads och twists. Samlas i HAIR_REG av
// hair.js. Varje post byggs med hs(label, grupp, { front, back, side }) – hs klipper frisyren
// under täckande huvudbonader (se hair-kit.js). Id:n får aldrig byta namn efter släpp.
import { hs, capF, backStd, backShort, sideTop, sideStd, sleekF, sleekB, sleekS, shaved, dims, nz, row, col, mask, paint, curls, TIE } from './hair-kit.js';
import { loc, BEAD } from './hair-lockar.js';
import { mix2 } from './hair-uppsatt.js';

const GOLD_LO = 0xa8782a; // guldhylsans skuggsida
// målar masken bara där inget redan är ritat (bakom kroppen)
const behindR = (R) => { const put = R.put, B = Object.create(R); B.put = (x, y, c) => { if (!R.has(x, y)) put(x, y, c); }; return B; };
// små täta permanentlockar (regelbundna pärlor)
// (varannan rad: en ljus lockrygg, raden under: en skugga snett nedanför – förskjutet per radpar)
const pebble = (x, y, t) => {
  if (t !== 'base' && t !== 'lo') return null;
  const k = (x + ((y >> 1) & 1) * 2 + (nz(x >> 2, y >> 1, 7) & 1)) % 4;
  if ((y & 1) === 0) return k === 0 ? (t === 'lo' ? 'base' : 'hi') : null;
  return k === 1 ? (t === 'lo' ? 'dk' : 'lo') : null;
};
// definierade spiraler (twist-out): lodräta korkskruvar
const coil = (x, y, t) => { if (t !== 'base' && t !== 'lo') return null; const k = (y + (x & 1) * 2) & 3; return k === 0 ? (t === 'lo' ? 'dk' : 'lo') : k === 2 ? (t === 'lo' ? 'base' : 'hi') : null; };
// ojämn ytterkant: hoppar in en pixel här och där (samma pixel ger alltid samma svar)
const jag = (x, y, s) => nz(x, y, s) % 2;
// liten rund knut (bantuknut): 2-4-2 pixlar
const knot = (R, cx, cy) => {
  const m = mask().oval(cx, cy, 1.5, 1.3);
  paint(R, m, { tex: (x, y, t) => (t === 'base' && (x + y) % 3 === 0 ? 'lo' : null) });
  // lindningen: en mörk skåra nere till höger och en glansprick uppe till vänster
  const x0 = Math.ceil(cx - 1.85), y0 = Math.ceil(cy - 1.3);
  R.put(x0 + 2, y0 + 2, R.hair.dk); R.put(x0 + 1, y0, R.hair.hi);
};
// repflätning (senegaltwist): 2 px bred med snedränder, guldhylsa i änden
const rope = (R, x, y0, y1, dark) => {
  const { put, hair: H } = R, P = dark ? [H.base, H.lo, H.dk] : [H.hi, H.base, H.lo];
  for (let y = y0; y <= y1; y++) { const k = (y - y0) % 3; put(x, y, P[k]); put(x + 1, y, P[(k + 1) % 3]); }
  put(x, y1 + 1, BEAD); put(x + 1, y1 + 1, GOLD_LO); put(x + (dark ? 1 : 0), y1 + 2, dark ? H.lo : H.base);
};
// flätmönstrad hårbotten (benor mellan flätor/knutar): prickar i benans färg
const partDots = (R, pts) => { const g = mix2(R); for (const [x, y] of pts) R.put(x, R.h0 + y, g); };

export const HAIR_KRULL = {
  // ================= Lockar =================
  perm: hs('Perma­nent', 'Lockar', {
    // 80-talets permanent: stor krullig volym med krullig lugg, ner på axlarna
    front(R) { const { h0, K } = R, { chin } = dims(R), end = chin + 2, full = h0 + (K ? 2 : 3);
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 5, 18]]).rect(4, h0, 16, 3).row(full, 7, 16);
      for (const x of [7, 8, 10, 11, 13, 14, 16]) m.set(x, full + 1);
      for (let y = h0 + 3; y <= end; y++) m.row(y, 3 + jag(3, y, 61), 7).row(y, 16, 20 - jag(20, y, 62));
      for (const x of [3, 4, 5, 6, 17, 18, 19, 20]) if (nz(x, end, 63) < 50) m.cut(x, end);
      paint(R, m, { tex: curls(64, 1.5) }); },
    back(R) { const { h0 } = R, { chin } = dims(R), end = chin + 2;
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 5, 18]]).rect(4, h0, 16, end - h0 + 1);
      for (let y = h0 + 3; y <= end; y++) { if (jag(3, y, 61)) m.set(3, y); if (jag(20, y, 62)) m.set(20, y); }
      for (let x = 3; x <= 20; x++) if (nz(x, end, 65) < 45) m.cut(x, end);
      paint(R, m, { tex: curls(66, 1.5) }); },
    side(R) { const { h0 } = R, { chin } = dims(R), end = chin + 2;
      const m = mask().rows([[h0 - 3, 10, 14], [h0 - 2, 8, 16], [h0 - 1, 7, 17]]).rect(6, h0, 12, 3).rect(3, h0 + 1, 9, end - h0).row(h0 + 3, 13, 17).set(15, h0 + 4).set(16, h0 + 4);
      for (let x = 3; x <= 11; x++) if (nz(x, end, 67) < 45) m.cut(x, end);
      for (let y = h0 + 2; y < end; y++) if (jag(2, y, 69)) m.set(2, y);
      paint(R, m, { tex: curls(68, 1.5) }); },
  }),
  shortCurls: hs('Korta lockar', 'Lockar', {
    // kort och krulligt över hela huvudet, små lockar i pannan
    front(R) { const { h0, eyeRow } = R;
      const m = mask().rows([[h0 - 3, 9, 13], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(6, h0, 12, 3).set(5, h0).set(18, h0 + 1)
        .col(6, h0 + 3, eyeRow - 2).col(17, h0 + 3, eyeRow - 2);
      for (const x of [7, 8, 10, 11, 13, 14, 16]) m.set(x, h0 + 3);
      paint(R, m, { tex: curls(71, 1.6) }); },
    back(R) { const { h0, headH } = R, b = h0 + headH - 3;
      const m = mask().rows([[h0 - 3, 9, 13], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(6, h0, 12, b - h0).set(5, h0 + 1).set(18, h0);
      for (const x of [7, 9, 10, 12, 14, 15]) m.set(x, b);
      paint(R, m, { tex: curls(72, 1.6) }); },
    side(R) { const { h0, eyeRow } = R;
      const m = mask().rows([[h0 - 3, 10, 14], [h0 - 2, 8, 16], [h0 - 1, 7, 17]]).rect(7, h0, 10, 3).rect(7, h0 + 3, 4, eyeRow - h0 - 1)
        .set(15, h0 + 3).set(16, h0 + 3).set(17, h0 + 2).set(6, h0 + 1).set(8, eyeRow + 1).set(6, h0 + 4);
      paint(R, m, { tex: curls(73, 1.6) }); },
  }),
  curlyBangs: hs('Lockig lugg', 'Lockar', {
    // axellånga lockar med en krullig lugg
    front(R) { const { h0, K } = R, { chin } = dims(R), end = chin + 3, full = h0 + (K ? 2 : 3);
      const m = mask().rows([[h0 - 2, 8, 15], [h0 - 1, 7, 16]]).rect(6, h0, 12, 3).row(full, 7, 16);
      for (const x of [7, 8, 10, 11, 13, 15, 16]) m.set(x, full + 1);
      for (let y = h0 + 1; y <= end; y++) m.row(y, 4 + jag(4, y, 81), 7).row(y, 16, 19 - jag(19, y, 82));
      for (const x of [4, 5, 6, 17, 18, 19]) if (nz(x, end, 83) < 50) m.cut(x, end);
      paint(R, m, { tex: curls(84, 1.4) }); },
    back(R) { const { h0 } = R, { chin } = dims(R), end = chin + 3;
      const m = mask().rows([[h0 - 2, 8, 15], [h0 - 1, 7, 16]]).rect(6, h0, 12, 2).rect(4, h0 + 1, 16, end - h0);
      for (let y = h0 + 1; y <= end; y++) { if (jag(4, y, 81)) m.cut(4, y); if (jag(19, y, 82)) m.cut(19, y); }
      for (let x = 4; x <= 19; x++) if (nz(x, end, 85) < 45) m.cut(x, end);
      paint(R, m, { tex: curls(86, 1.4) }); },
    side(R) { const { h0, K } = R, { chin } = dims(R), end = chin + 3, full = h0 + (K ? 2 : 3);
      const m = mask().rows([[h0 - 2, 9, 15], [h0 - 1, 8, 16]]).rect(7, h0, 10, 3).rect(4, h0 + 1, 7, end - h0).rect(13, full, 4, 1).set(14, full + 1).set(16, full + 1);
      for (let y = h0 + 1; y <= end; y++) if (jag(4, y, 87)) m.cut(4, y);
      for (let x = 4; x <= 10; x++) if (nz(x, end, 88) < 45) m.cut(x, end);
      paint(R, m, { tex: curls(89, 1.4) }); },
  }),
  grannyCurls: hs('Tant­lockar', 'Lockar', {
    // kort, rund permanent med små täta lockar – som hos farmor
    front(R) { const { h0, eyeRow } = R;
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(5, h0, 14, 2).row(h0 + 2, 6, 17).rect(5, h0 + 2, 2, eyeRow - h0 - 3).rect(17, h0 + 2, 2, eyeRow - h0 - 3);
      for (const x of [8, 10, 13, 15]) m.set(x, h0 + 3);
      m.cut(5, eyeRow - 2).cut(18, eyeRow - 2);
      paint(R, m, { tex: pebble }); },
    back(R) { const { h0, headH } = R, b = h0 + headH - 3;
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(5, h0, 14, b - h0 - 1).row(b - 1, 6, 17).row(b, 7, 16);
      paint(R, m, { tex: pebble }); },
    side(R) { const { h0, eyeRow } = R;
      const m = mask().rows([[h0 - 3, 10, 14], [h0 - 2, 8, 16], [h0 - 1, 7, 17]]).rect(6, h0, 11, 3).rect(6, h0 + 3, 5, eyeRow - h0 - 2).set(15, h0 + 3).set(16, h0 + 3).cut(6, eyeRow);
      paint(R, m, { tex: pebble }); },
  }),
  fingerWaves: hs('Finger­vågor', 'Lockar', {
    // 20-talets blanka vågor tätt mot huvudet, kort page och en lock på varje kind
    front(R) { const { put, hair: H, h0, eyeRow } = R;
      paint(R, mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 3).rect(6, h0 + 1, 2, eyeRow + 1 - h0).rect(16, h0 + 1, 2, eyeRow + 1 - h0).set(8, h0 + 3));
      // vågkammen: ljus ovanpå, mörk under – sicksack tvärs över huvudet
      for (let x = 7; x <= 16; x++) { const y = h0 + ((x >> 1) & 1); put(x, y, H.hi); put(x, y + 1, H.lo); }
      for (let y = h0 + 3; y <= eyeRow + 1; y++) { const o = ((y - h0) >> 1) & 1; put(6 + o, y, o ? H.lo : H.hi); put(16 + o, y, o ? H.dk : H.lo); }
      put(8, eyeRow + 1, H.base); put(8, eyeRow, H.lo); put(15, eyeRow + 1, H.lo); put(15, eyeRow, H.dk); put(9, h0 + 3, H.lo); },
    back(R) { const { put, hair: H, h0, eyeRow } = R, b = eyeRow + 2;
      paint(R, mask().row(h0 - 1, 8, 15).rect(7, h0, 10, 1).rect(6, h0 + 1, 12, b - h0 - 1));
      for (const y0 of [h0, h0 + 3, h0 + 6]) if (y0 + 1 < b) for (let x = 6; x <= 17; x++) { const y = y0 + ((x >> 1) & 1); put(x, y, H.hi); put(x, y + 1, H.lo); } },
    side(R) { const { rect, put, hair: H, h0, eyeRow } = R;
      sideTop(R); rect(7, h0 + 1, 5, eyeRow + 1 - h0, H.base); col(R, 7, h0 + 1, eyeRow + 1, H.lo); row(R, eyeRow + 1, 7, 11, H.lo);
      for (const y0 of [h0, h0 + 3, h0 + 6]) for (let x = 7; x <= 16; x++) { if (y0 > h0 && x > 11) continue; const y = y0 + ((x >> 1) & 1); put(x, y, H.hi); put(x, y + 1, H.lo); }
      put(12, eyeRow, H.base); put(12, eyeRow + 1, H.lo); put(13, eyeRow + 1, H.base); },
  }),

  // ================= Afro =================
  bantu: hs('Bantu­knutar', 'Afro', {
    // många små runda knutar på ett rutmönster av benor
    front(R) { const { h0 } = R; capF(R, 3); partDots(R, [[9, 0], [9, 1], [14, 0], [14, 1], [10, 2], [13, 2], [11, 1], [12, 1]]);
      knot(R, 8, h0 - 1.2); knot(R, 15, h0 - 1.2); knot(R, 11.5, h0 - 2.6); },
    back(R) { const { h0, headH } = R; backShort(R);
      const g = mix2(R); for (let y = h0; y < h0 + headH - 3; y++) { R.put(9, y, g); R.put(14, y, g); } for (let x = 7; x <= 16; x++) { R.put(x, h0 + 2, g); R.put(x, h0 + 6, g); }
      const ys = R.K ? [h0 - 1, h0 + 3, h0 + 6] : [h0 - 1, h0 + 3, h0 + 7];
      for (const y of ys) for (const x of [7, 11.5, 16]) knot(R, x, y); },
    side(R) { const { h0 } = R; sideStd(R); partDots(R, [[11, 0], [11, 1], [13, 2], [9, 3], [10, 3]]);
      knot(R, 10, h0 - 2); knot(R, 14, h0 - 1.5); knot(R, 7.5, h0 + 1.5); knot(R, 8.5, h0 + 5); },
  }),
  afroPart: hs('Afro med bena', 'Afro', {
    // mellanstor, rund afro med en rak sidbena
    front(R) { const { h0, headH, K } = R, g = mix2(R);
      const m = mask().oval(11.5, h0 + 2, K ? 7 : 7.5, K ? 6 : 6.5).cut(7, h0 + 3, 10, headH).cut(8, h0 + 2, 8, 1).set(9, h0 + 2).set(13, h0 + 2);
      paint(R, m, { tex: curls(91, 1.3) });
      let top = 0; while (top < 40 && !m.on(9, top)) top++;
      for (let y = top; y <= h0 + 1; y++) R.put(9, y, g); },
    back(R) { const { h0, K } = R; paint(R, mask().oval(11.5, h0 + 2.5, K ? 7 : 7.5, K ? 6.5 : 7), { tex: curls(92, 1.3) }); },
    side(R) { const { h0, headH, K } = R, g = mix2(R);
      const m = mask().oval(10, h0 + 2, K ? 6.5 : 7, K ? 6 : 6.5).cut(12, h0 + 3, 7, headH).set(13, h0 + 3).set(16, h0 + 2).cut(17, h0 + 2);
      for (let x = 17; x < 24; x++) for (let y = 0; y < 40; y++) m.cut(x, y);
      paint(R, m, { tex: curls(93, 1.3) });
      if (!R.flip) for (const [x, y] of [[15, -1], [14, -2], [13, -3], [12, -4]]) if (m.on(x, h0 + y)) R.put(x, h0 + y, g); },
  }),
  afroSide: hs('Sido­puff', 'Afro', {
    // håret slickat åt sidan och samlat i en stor puff ovanför vänstra örat (bildens högra)
    front(R) { const { put, h0 } = R; sleekF(R);
      paint(R, mask().oval(17.5, h0 + 0.5, 3.4, 3.2), { tex: curls(95, 1.3) });
      put(14, h0, TIE); put(14, h0 + 1, TIE); put(15, h0 + 1, TIE); },
    back(R) { const { put, h0 } = R; sleekB(R, false);
      paint(R, mask().oval(6, h0 + 0.5, 3.4, 3.2), { tex: curls(96, 1.3) });
      put(9, h0, TIE); put(9, h0 + 1, TIE); put(8, h0 + 1, TIE); },
    side(R) { const { put, h0 } = R; sleekS(R);
      if (!R.flip) { paint(behindR(R), mask().oval(10, h0 - 1.5, 3.2, 2.6), { tex: curls(97, 1.3) }); return; }
      paint(R, mask().oval(10.5, h0 + 0.5, 3.4, 3.2), { tex: curls(98, 1.3) }); put(14, h0, TIE); put(14, h0 + 1, TIE); },
  }),
  twistOut: hs('Twist-out', 'Afro', {
    // axellång, luftig volym med tydliga korkskruvar
    front(R) { const { h0 } = R, { chin } = dims(R), end = chin + 1;
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(5, h0, 14, 3).row(h0 + 3, 7, 9).row(h0 + 3, 14, 16).set(7, h0 + 4);
      for (let y = h0 + 3; y <= end; y++) m.row(y, 3 + jag(3, y, 101), 7).row(y, 16, 20 - jag(20, y, 102));
      for (const x of [3, 4, 5, 6, 17, 18, 19, 20]) if (nz(x, end, 103) < 50) m.cut(x, end);
      paint(R, m, { tex: coil }); },
    back(R) { const { h0 } = R, { chin } = dims(R), end = chin + 1;
      const m = mask().rows([[h0 - 3, 9, 14], [h0 - 2, 7, 16], [h0 - 1, 6, 17]]).rect(4, h0, 16, end - h0 + 1);
      for (let y = h0 + 2; y <= end; y++) { if (jag(3, y, 101)) m.set(3, y); if (jag(20, y, 102)) m.set(20, y); }
      for (let x = 3; x <= 20; x++) if (nz(x, end, 104) < 45) m.cut(x, end);
      paint(R, m, { tex: coil }); },
    side(R) { const { h0 } = R, { chin } = dims(R), end = chin + 1;
      const m = mask().rows([[h0 - 3, 10, 14], [h0 - 2, 8, 16], [h0 - 1, 7, 17]]).rect(6, h0, 11, 3).rect(3, h0 + 1, 8, end - h0).row(h0 + 3, 14, 16);
      for (let x = 3; x <= 10; x++) if (nz(x, end, 105) < 45) m.cut(x, end);
      paint(R, m, { tex: coil }); },
  }),

  // ================= Dreads & twists =================
  dreadsTop: hs('Dreads med fade', 'Dreads & twists', {
    // korta dreads på toppen som faller fram över pannan, tonade sidor och nacke
    front(R) { const { put, hair: H, h0, K } = R, s = shaved(R);
      col(R, 7, h0, h0 + 2, s.a); col(R, 16, h0, h0 + 2, s.b); col(R, 7, h0 + 3, h0 + 5, s.f); col(R, 16, h0 + 3, h0 + 5, s.f);
      const tip = [1, 3, 2, 4, 3, 4, 2, 1];
      for (let i = 0; i < 8; i++) {
        const x = 8 + i, y0 = h0 - 3 + (i === 0 || i === 7 ? 2 : i === 1 || i === 6 ? 1 : 0), y1 = h0 + tip[i] - (K && tip[i] > 2 ? 1 : 0);
        loc(R, x, y0, y1, 1, i % 2 === 1, false); put(x, y0, i % 2 ? H.base : H.hi); put(x, y1, i % 2 ? H.dk : H.lo);
      } },
    back(R) { const { rect, put, hair: H, h0, headH } = R, s = shaved(R);
      rect(7, h0 + 2, 10, 2, s.a); col(R, 16, h0 + 2, h0 + 3, s.b); rect(7, h0 + 4, 10, headH - 8, s.f); rect(8, h0 + headH - 4, 8, 1, s.f);
      for (let i = 0; i < 8; i++) { const x = 8 + i, y0 = h0 - 3 + (i === 0 || i === 7 ? 2 : i === 1 || i === 6 ? 1 : 0); loc(R, x, y0, h0 + 2 + (i % 3 === 0 ? 1 : 0), 1, i >= 4, false); put(x, y0, i >= 4 ? H.base : H.hi); } },
    side(R) { const { rect, put, hair: H, h0 } = R, s = shaved(R);
      rect(8, h0 + 1, 3, 1, s.a); rect(8, h0 + 2, 5, 1, s.a); rect(8, h0 + 3, 3, 4, s.f); put(8, h0 + 3, s.a); put(13, h0 + 3, s.f); put(13, h0 + 4, s.f);
      const L = [[9, 1, 1], [10, 0, 1], [11, -1, 2], [12, -1, 2], [13, -1, 3], [14, 0, 4], [15, 0, 3], [16, 1, 2]];
      L.forEach(([x, t, e], i) => { loc(R, x, h0 - 2 + t, h0 + e, 1, i % 2 === 1, false); put(x, h0 - 2 + t, i % 2 ? H.base : H.hi); });
      put(17, h0 + 1, H.lo); put(17, h0 + 2, H.dk); },
  }),
  longDreads: hs('Långa dreads', 'Dreads & twists', {
    // midjelånga dreads: framför axlarna ner på bröstet, sedan bakom kroppen
    front(R) { const { put, hair: H, h0 } = R, { chest, waist } = dims(R), B = behindR(R); capF(R, 3);
      for (let x = 8; x <= 15; x += 2) for (let y = h0; y <= h0 + 2; y++) if ((x + y) % 2 === 0) put(x, y, H.lo);
      put(9, h0 + 3, H.base); put(14, h0 + 3, H.lo);
      for (const [x, y0, e, d] of [[4, 3, 2, 0], [5, 1, 0, 1], [6, 1, 1, 0], [7, 3, 3, 1], [16, 3, 3, 1], [17, 1, 1, 1], [18, 1, 0, 0], [19, 3, 2, 1]]) {
        loc(R, x, h0 + y0, chest, 1, !!d, false); loc(B, x, chest + 1, waist - e, 1, !!d, false);
      } },
    back(R) { const { h0 } = R, { waist } = dims(R); backStd(R, h0 + 3, true);
      for (let x = 5; x <= 18; x++) loc(R, x, h0 + 2, waist - ((x * 5) % 3), 1, x > 11 || x % 2 === 1, false); },
    side(R) { const { put, hair: H, h0 } = R, { waist } = dims(R); sideTop(R); put(15, h0 + 3, H.base); put(16, h0 + 3, H.lo);
      for (let x = 4; x <= 10; x++) loc(R, x, h0 + 2, waist - (x % 3), 1, x % 2 === 0, false); },
  }),
  dreadsHalfUp: hs('Halv­upp­satta dreads', 'Dreads & twists', {
    // övre halvan i en knut på hjässan, resten hänger ner på bröstet
    front(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); capF(R, 3);
      for (let x = 8; x <= 15; x += 2) for (let y = h0; y <= h0 + 2; y++) if ((x + y) % 2 === 0) put(x, y, H.lo);
      if (!R.hatted) { paint(R, mask().oval(11.5, h0 - 2.5, 3.6, 2.4)); for (let y = h0 - 4; y <= h0 - 1; y += 2) row(R, y, 9, 14, H.lo); put(10, h0 - 3, H.dk); put(13, h0 - 3, H.dk); }
      for (const [x, y0, e, d] of [[5, 2, 1, 0], [6, 1, 0, 1], [7, 3, 2, 0], [16, 3, 2, 1], [17, 1, 0, 0], [18, 2, 1, 1]]) loc(R, x, h0 + y0, chest - e, 1, !!d, false); },
    back(R) { const { rect, put, hair: H, h0 } = R, { chest } = dims(R); backStd(R, h0 + 3, true);
      for (let x = 6; x <= 17; x++) loc(R, x, h0 + 3, chest - ((x * 7) % 3), 1, x > 11, false);
      paint(R, mask().oval(11.5, h0 - 1, 3.6, 2.4)); for (let y = h0 - 2; y <= h0; y += 2) row(R, y, 9, 14, H.lo); rect(10, h0 + 2, 4, 1, TIE); put(9, h0 + 1, H.lo); put(14, h0 + 1, H.lo); },
    side(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sideTop(R); put(15, h0 + 3, H.base); put(16, h0 + 3, H.lo);
      for (let x = 5; x <= 9; x++) loc(R, x, h0 + 3, chest - (x % 3), 1, x % 2 === 0, false);
      paint(R, mask().oval(9, h0 - 1.8, 3.2, 2.4)); for (let y = h0 - 3; y <= h0; y += 2) row(R, y, 7, 11, H.lo); put(8, h0 + 1, TIE); put(9, h0 + 1, TIE); },
  }),
  senegal: hs('Senegal­twists', 'Dreads & twists', {
    // långa repflätade twists med guldhylsor i ändarna
    front(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); capF(R, 3);
      partDots(R, [[9, 0], [12, 1], [14, 0], [10, 2], [13, 2]]); put(8, h0 + 3, H.base); put(15, h0 + 3, H.lo);
      rope(R, 4, h0 + 3, chest - 1, false); rope(R, 6, h0 + 1, chest + 1, false); rope(R, 16, h0 + 1, chest + 1, true); rope(R, 18, h0 + 3, chest - 1, true); },
    back(R) { const { h0 } = R, { chest } = dims(R); backStd(R, h0 + 3, true); partDots(R, [[9, 0], [12, 1], [15, 0]]);
      for (const x of [5, 7, 9, 11, 13, 15, 17]) rope(R, x, h0 + 2, chest - ((x * 3) % 4), x > 11); },
    side(R) { const { put, hair: H, h0 } = R, { chest } = dims(R); sideStd(R, false); partDots(R, [[12, 1], [14, 0], [10, 2]]); put(15, h0 + 3, H.base);
      for (const x of [4, 6, 8]) rope(R, x, h0 + 2, chest - (x % 3), x === 6); },
  }),
};
