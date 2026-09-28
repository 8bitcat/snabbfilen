// Ansiktet: ögon, bryn, näsa, mun, öron, kinder, smink, märken (fräknar/ansiktsmålning)
// och skägg. Se docs/PEOPLE-ARKITEKTUR.md.
//
// Varje post: { label, group?, front(R), back(R)?, side(R), prep(R)?, ...krokar }.
// Ritordning i ansiktet: öron → ögon → bryn → näsa → mun → kinder → smink → märken
// → skägg → (glasögon, acc.js). Håret ritas EFTER ansiktet, huvudbonaderna sist.
// Ansiktet syns inte bakifrån – bara öronen har back().
//
// Färger: R.eye (ögonfärgen, heltal – mörk om look.eyeColor saknas), R.eyeC (ramp
// eller null), R.lip (läppfärg – smink kan byta den i prep), R.lipC / R.shadowC /
// R.markC (rampar, alltid satta – med standardfärg om fältet saknas), R.skin, R.hair.
//
// Ändra inte posterna 'normal'/'none'/'blush'/gamla skägg – de är pixellåsta av
// tools/people-regress.mjs.
import { mix } from './util.js';
import { EYES_NEW, BROWS_NEW } from './face-eyes.js';
import { MOUTHS_NEW, NOSES_NEW, EARS_NEW } from './face-mouth.js';
import { CHEEKS_NEW, MAKEUP_NEW, MARKS_NEW } from './face-paint.js';
import { BEARDS_NEW } from './face-beard.js';

// Förslag i redigerarens färgrutor (valfri egen färg går alltid)
export const EYE_COLORS = ['#2a1d1a', '#5a3a22', '#3f6fb0', '#3f8f5a', '#7a8a96', '#8a6a2a'];
export const LIP_COLORS = ['#c0304a', '#e0607a', '#a0303a', '#8e2f5e', '#e07a5a', '#6b2a3a'];
export const SHADOW_COLORS = ['#8e5bd1', '#3a7bd5', '#46a35a', '#d98a3a', '#b83d7a', '#2f3440'];
export const MARK_COLORS = ['#3a7bd5', '#d9433b', '#46a35a', '#f0b429', '#f4f1ea', '#8e5bd1'];

// ---------- ögon (look.eyes, färg look.eyeColor) ----------
export const EYE_REG = {
  normal: {
    label: 'Vanliga',
    front(R) { const { rect, put, eye, eyeRow, K } = R;
      if (K) { rect(8, eyeRow - 1, 2, 2, eye); rect(14, eyeRow - 1, 2, 2, eye); put(8, eyeRow - 1, 0xffffff); put(14, eyeRow - 1, 0xffffff); }
      else { rect(9, eyeRow - 1, 1, 2, eye); rect(14, eyeRow - 1, 1, 2, eye); } },
    side(R) { const { rect, put, eye, eyeRow, K } = R;
      if (K) { rect(14, eyeRow - 1, 2, 2, eye); put(15, eyeRow - 1, 0xffffff); } else rect(15, eyeRow - 1, 1, 2, eye); },
  },
  ...EYES_NEW, // nya ögon: face-eyes.js
};

// ---------- ögonbryn (look.brows) – färgen följer håret ----------
export const BROW_REG = {
  normal: {
    label: 'Vanliga',
    front(R) { const { rect, hair, eyeRow, K } = R; if (!K) { rect(8, eyeRow - 3, 3, 1, hair.lo); rect(13, eyeRow - 3, 3, 1, hair.lo); } },
    side(R) { const { rect, hair, eyeRow, K } = R; if (!K) rect(14, eyeRow - 3, 3, 1, hair.lo); },
  },
  ...BROWS_NEW, // nya bryn: face-eyes.js
};

// ---------- näsa (look.nose) ----------
export const NOSE_REG = {
  normal: {
    label: 'Vanlig',
    front(R) { R.put(12, R.eyeRow + 2, R.skin.lo); },
    side(R) { const { put, skin, eyeRow } = R; put(17, eyeRow + 1, skin.base); put(17, eyeRow + 2, skin.lo); },
  },
  ...NOSES_NEW, // nya näsor: face-mouth.js
};

// ---------- mun (look.mouth) – färg R.lip ----------
export const MOUTH_REG = {
  normal: {
    label: 'Vanlig',
    front(R) { R.rect(11, R.eyeRow + (R.K ? 3 : 4), 2, 1, R.lip); },
    side(R) { R.put(16, R.eyeRow + (R.K ? 3 : 4), R.lip); },
  },
  ...MOUTHS_NEW, // nya munnar: face-mouth.js
};

// ---------- öron (look.ears) – syns även bakifrån ----------
const earsFB = (R) => { const { rect, put, skin, eyeRow } = R; rect(6, eyeRow - 1, 1, 3, skin.base); put(6, eyeRow, skin.lo); rect(17, eyeRow - 1, 1, 3, skin.lo); };
export const EAR_REG = {
  normal: {
    label: 'Vanliga',
    front: earsFB, back: earsFB,
    side(R) { const { rect, put, skin, eyeRow } = R; rect(11, eyeRow - 1, 2, 3, skin.base); put(11, eyeRow, skin.lo); put(12, eyeRow, skin.dk); },
  },
  ...EARS_NEW, // nya öron: face-mouth.js
};

// ---------- kinder (look.cheeks; gamla look.blush=true ⇒ 'blush') ----------
// 'none' = naturliga: barn har ändå alltid lite rosiga kinder.
const blushF = (R) => { const { put, skin, eyeRow } = R; put(8, eyeRow + 2, mix(skin.base, 0xe06070, 0.35)); put(15, eyeRow + 2, mix(skin.lo, 0xe06070, 0.35)); };
const blushS = (R) => { R.put(14, R.eyeRow + 2, mix(R.skin.base, 0xe06070, 0.35)); };
export const CHEEK_REG = {
  none: {
    label: 'Naturliga',
    front(R) { if (R.K) blushF(R); },
    side(R) { if (R.K) blushS(R); },
  },
  blush: { label: 'Rosiga', front: blushF, side: blushS },
  ...CHEEKS_NEW, // nya kinder: face-paint.js
};

// ---------- smink (look.makeup; färger look.lipColor → R.lipC, look.shadowColor → R.shadowC) ----------
// Tips: läppstift byter läppfärgen i prep(R) { R.lip = R.lipC.base; } så att munnen
// (och helskägget) ritas i den färgen. Ögonskugga ritas bäst i kroken afterHead(R)
// (före ögonen) så att ögonen hamnar ovanpå.
export const MAKEUP_REG = {
  none: { label: 'Inget' },
  ...MAKEUP_NEW, // nytt smink: face-paint.js
};

// ---------- märken: fräknar, födelsemärken, ansiktsmålning (look.marks, färg look.markColor → R.markC) ----------
export const MARK_REG = {
  none: { label: 'Inga' },
  ...MARKS_NEW, // nya märken och ansiktsmålningar: face-paint.js
};

// ---------- skägg (look.beard; false = inget, gamla true ⇒ 'full') – färgen följer håret ----------
export const BEARD_REG = {
  none: { label: 'Inget' },
  full: {
    label: 'Hel\u00adskägg',
    front(R) { const { rect, put, hair, skin, eyeRow, h0, headH } = R;
      for (let y = eyeRow + 2; y < h0 + headH; y++) { const e = y >= h0 + headH - 1 ? 9 : y >= h0 + headH - 2 ? 8 : 7; rect(e, y, 24 - e * 2, 1, hair.base); }
      if (R.id.mouth === 'normal') rect(11, eyeRow + 4, 2, 1, R.lip); else R.draw('mouth'); // munnen syns genom skägget
      put(12, eyeRow + 2, skin.lo); rect(8, eyeRow + 2, 8, 1, hair.lo); rect(10, eyeRow + 2, 4, 1, skin.base); },
    side(R) { const { rect, put, hair, eyeRow, h0, headH } = R;
      rect(11, eyeRow + 2, 6, h0 + headH - eyeRow - 2, hair.base);
      if (R.id.mouth === 'normal') put(16, eyeRow + 4, R.lip); else R.draw('mouth');
      rect(11, eyeRow + 2, 1, 2, hair.lo); },
  },
  mustache: {
    label: 'Mus\u00adtasch',
    front(R) { R.rect(10, R.eyeRow + 3, 4, 1, R.hair.base); },
    side(R) { R.rect(15, R.eyeRow + 3, 3, 1, R.hair.base); },
  },
  stubble: {
    label: 'Stubb',
    front(R) { const { put, hair, skin, eyeRow, h0, headH } = R;
      for (let y = eyeRow + 3; y < h0 + headH; y++) for (let x = 8; x < 16; x++) if ((x + y) % 2 === 0 && x !== 11 && x !== 12) put(x, y, mix(skin.base, hair.base, 0.35)); },
    side(R) { const { put, hair, skin, eyeRow, h0, headH } = R;
      for (let y = eyeRow + 3; y < h0 + headH; y++) for (let x = 11; x < 17; x++) if ((x + y) % 2 === 0) put(x, y, mix(skin.base, hair.base, 0.35)); },
  },
  goatee: {
    label: 'Pip\u00adskägg',
    front(R) { const { rect, put, hair, eyeRow, h0, headH } = R;
      rect(10, eyeRow + 3, 4, 1, hair.base); put(10, eyeRow + 4, hair.lo); put(13, eyeRow + 4, hair.lo); rect(11, h0 + headH, 2, 1, hair.base); put(12, h0 + headH, hair.lo); },
    side(R) { const { rect, put, hair, eyeRow, h0, headH } = R;
      rect(15, eyeRow + 3, 3, 1, hair.base); put(15, eyeRow + 4, hair.lo); rect(14, h0 + headH, 2, 1, hair.base); },
  },
  ...BEARDS_NEW, // nya skägg och mustascher: face-beard.js
};
