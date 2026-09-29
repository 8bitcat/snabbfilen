// Gemensamma hjälpare för ansiktsfilerna (face-eyes.js, face-mouth.js, face-paint.js,
// face-beard.js). Importerar bara från util.js – aldrig från people.js.
//
// Pixelkartor: ett ansiktsdrag skrivs som rader med tecken, '.' = ingen pixel, och
// ritas med pix(R, x0, y0, rader, palett, läge). Läge:
//   0 = bara där det står
//   1 = även spegelvänt på andra sidan ansiktet (x → 23 − x, raderna vänds) –
//       för symmetriska drag som bryn och ögon med sneda former
//   2 = även på den spegelvända platsen men med samma innehåll (inte vänt) –
//       för ögon med ljusreflex som ska sitta åt samma håll på båda ögonen
// Framifrån är ansiktets mitt mellan x 11 och 12, så vänster öga (x 9) ↔ höger (x 14).
import { mix, ramp } from './util.js';

export const MX = (x) => 23 - x;
export const WHITE = 0xf4f1ea;   // ögonvitor, tänder
export const SHINE = 0xffffff;   // ljusreflex
export const LASH = 0x241a22;    // fransar, stängda ögon, pupiller i färgade ögon
export const MOUTH_IN = 0x4a1822; // munhålan
export const TONGUE = 0xe0707e;
export const TEAR = 0x7cc8f0, TEAR_HI = 0xc4e9fb;
export const METAL = 0xb4bcc8, METAL_HI = 0xeef2f6, GOLD = 0xf0c040, GOLD_HI = 0xfff0a8;

// Grundpaletten: tecken → färg. extra (objekt) läggs ovanpå.
export function pal(R, extra) {
  const P = {
    e: R.eye, l: LASH, w: WHITE, h: SHINE,
    b: R.skin.base, H: R.skin.hi, s: R.skin.lo, S: R.skin.dk,
    a: R.hair.base, A: R.hair.hi, o: R.hair.lo, O: R.hair.dk,
    m: R.lip, M: mix(R.lip, 0x2a1020, 0.35), k: MOUTH_IN, t: WHITE, T: 0xd6cfc4, g: TONGUE,
    q: TEAR, Q: TEAR_HI, z: METAL, Z: METAL_HI, y: GOLD, Y: GOLD_HI,
  };
  return extra ? Object.assign(P, extra) : P;
}

export function pix(R, x0, y0, rows, P, mode = 0) {
  let w = 0;
  for (const r of rows) if (r.length > w) w = r.length; // läge 2: hela kartans bredd
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = P[row[i]];
      if (c == null) continue;
      R.put(x0 + i, y0 + j, c);
      if (mode === 1) R.put(23 - (x0 + i), y0 + j, c);
      else if (mode === 2) R.put(23 - (x0 + w - 1) + i, y0 + j, c);
    }
  }
}

// Tona pixeln som redan finns (behåller skuggningen under): t = hur mycket av färgen c
export function tint(R, x, y, c, t) { const o = R.get(x, y); if (o >= 0) R.put(x, y, mix(o, c, t)); }
export function tintRect(R, x, y, w, h, c, t) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) tint(R, x + i, y + j, c, t); }

// Ögonfärgens ramp (irisen), med en egen standard när spelaren inte valt färg
export const irisOf = (R, def) => R.eyeC || ramp(def);
// En färg som följer ett valfritt färgfält i looken, annars postens egen standard
export const colorOr = (R, field, rampKey, def) => (R.L[field] ? R[rampKey] : ramp(def));

// Munnen: vilken rad den vanliga munnen ligger på (vuxen: hakraden, barn: raden ovanför)
export const mouthRow = (R) => R.eyeRow + (R.K ? 3 : 4);
// Två-radiga munnar ligger alltid på eyeRow+3 och eyeRow+4
export const mouthTop = (R) => R.eyeRow + 3;
// Hakans nedersta rad (huvudets sista rad) och raden under hakan
export const chinRow = (R) => R.h0 + R.headH - 1;

// Hjälpare för att bygga poster av pixelkartor: spec = { f: [x0, dy, rader, läge], s: [x0, dy, rader],
// kf/ks = barnets varianter, base: (R) => y (standard eyeRow), sbase = samma för sidovyn (standard base),
// p: (R) => extra palett, after/afterS: (R) => extra ritning efter kartan }
export function mapEntry(label, group, spec) {
  const P = (R) => pal(R, spec.p ? spec.p(R) : null);
  const y = (R) => (spec.base ? spec.base(R) : R.eyeRow);
  const ys = spec.sbase || y;
  const e = { label, group };
  if (spec.f) e.front = function (R) { const s = (R.K && spec.kf) || spec.f; pix(R, s[0], y(R) + s[1], s[2], P(R), s[3] ?? 1); if (spec.after) spec.after(R); };
  if (spec.s) e.side = function (R) { const s = (R.K && spec.ks) || spec.s; pix(R, s[0], ys(R) + s[1], s[2], P(R), 0); if (spec.afterS) spec.afterS(R); };
  if (spec.uses) e.uses = spec.uses;
  return e;
}
