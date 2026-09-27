// Gemensamma verktyg för figurernas register (hair.js, face.js, tops.js, bottoms.js, acc.js)
// och motorn i ../people.js. Importera härifrån – ALDRIG från people.js (cirkelberoende).
//
// Färger är heltal 0xRRGGBB. En "ramp" är { hi, base, lo, dk } – ljus, bas, skugga, djup.

export const SW = 24, SH = 40; // spritens storlek; fötterna står vid (12, 39)

export const toInt = (h, fb = 0x888888) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : fb);

export function mul(c, f) {
  const r = Math.min(255, ((c >> 16) & 255) * f) | 0, g = Math.min(255, ((c >> 8) & 255) * f) | 0, b = Math.min(255, (c & 255) * f) | 0;
  return (r << 16) | (g << 8) | b;
}

export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  return (((ar + (((b >> 16) & 255) - ar) * t) | 0) << 16) | (((ag + (((b >> 8) & 255) - ag) * t) | 0) << 8) | ((ab + ((b & 255) - ab) * t) | 0);
}

// ljus/bas/skugga/djup – ljusare toner drar lite mot varmt vitt, skuggor mot blålila
export const ramp = (c) => ({ hi: mix(mul(c, 1.12), 0xfff4e0, 0.12), base: c, lo: mix(mul(c, 0.74), 0x2a1f3a, 0.12), dk: mix(mul(c, 0.5), 0x1a1426, 0.2) });

// Mörkare ramp för saker som är längre bort (bortre ben/arm i sidovy)
export const far = (r) => ({ hi: r.lo, base: r.lo, lo: r.dk, dk: r.dk });

// Vilken ton i rampen är färgen c? → 'hi' | 'base' | 'lo' | 'dk' | null
export function toneOf(c, r) {
  if (!r) return null;
  if (c === r.base) return 'base';
  if (c === r.lo) return 'lo';
  if (c === r.hi) return 'hi';
  if (c === r.dk) return 'dk';
  return null;
}

export function shadeHex(h, f) {
  const n = parseInt(h.slice(1), 16);
  const r = Math.min(255, (n >> 16 & 255) * f) | 0, g = Math.min(255, (n >> 8 & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Etiketter för pixlarna: motorn sätter R.tag innan varje del ritas och put() märker
// pixeln. Tryck/mönster och hårfärgseffekter använder R.each / R.pattern på en etikett.
export const TAG = {
  none: 0,
  skin: 1,     // bar hud på ben/armar (händer, knän under kjol …)
  pants: 2,    // tyget på ben, höfter, kjol
  shoe: 3,
  belt: 4,
  torso: 5,    // tröjans grundyta (bålen) – överdelens tryck ritas här
  top: 6,      // överdelens detaljer (krage, dragkedja, ficka …)
  sleeve: 7,   // ärmar
  apron: 8,
  neck: 9,     // halsduk/slips/halsband
  bag: 10,
  head: 11,    // huvudets hud
  ear: 12,
  face: 13,    // ögon, näsa, mun, kinder, smink, märken
  brow: 14,
  beard: 15,
  glasses: 16,
  hair: 17,
  hairAcc: 18,
  hat: 19,
  phones: 20,
  jewel: 21,
  extra: 22,   // fritt för krokar
};
