// Hårfärgseffekter (look.hairFx) – slingor, toppar, ombré, tvåfärgat, grått, regnbåge …
// Samlas i HAIR_FX_REG av hair.js. Andra färgen är look.hair2 → R.hair2 (ramp).
//
// Effekten körs direkt efter frisyren i samma vy och färgar om frisyrens pixlar med
// R.pattern(TAG.hair, …): returnera en ramp så behålls tonen (hi/base/lo/dk) och därmed
// skuggningen. Bara "riktiga" hårpixlar färgas (hårsnoddar, pärlor och rakat/snaggat
// som är blandat med hudfärgen lämnas i fred). Fungerar med alla frisyrer, gamla som nya.
import { TAG, ramp, mix } from './util.js';
import { nz } from './hair-kit.js';

// är färgen en av hårets toner?
const isHair = (R, c) => c === R.hair.base || c === R.hair.lo || c === R.hair.hi || c === R.hair.dk;
// hårets utbredning i vyn: översta/nedersta raden totalt och per kolumn
const bounds = (R) => {
  const top = new Int16Array(24).fill(99), bot = new Int16Array(24).fill(-1);
  let y0 = 99, y1 = -1;
  R.each(TAG.hair, (x, y, c) => {
    if (!isHair(R, c)) return;
    if (y < top[x]) top[x] = y; if (y > bot[x]) bot[x] = y;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  });
  return { top, bot, y0, y1, h: Math.max(1, y1 - y0) };
};
// färga om hårpixlar där fn(x, y) ger en ramp/färg (null = orörd)
const fx = (R, fn) => R.pattern(TAG.hair, (x, y, c) => (isHair(R, c) ? fn(x, y, c) : null));
// samma effekt i alla tre vyer
const all = (fn, extra = {}) => ({ uses: ['hair2'], front: fn, back: fn, side: fn, ...extra });

const GRAY = (R) => ramp(mix(R.hair.base, 0xc9c5bd, 0.72));
const RAINBOW = [0xd9433b, 0xe8872e, 0xf0c93a, 0x46a35a, 0x3a7bd5, 0x8e5bd1].map(ramp);

export const HAIR_FX = {
  highlights: { label: 'Slingor', group: 'Slingor & toppar',
    ...all((R) => fx(R, (x, y) => ((x + (y >> 3)) % 3 === 0 ? R.hair2 : null))) },
  tips: { label: 'Färgade toppar', group: 'Slingor & toppar',
    ...all((R) => { const b = bounds(R); fx(R, (x, y) => (b.bot[x] - b.top[x] >= 3 && y >= b.bot[x] - (b.bot[x] - b.top[x] >= 8 ? 2 : 1) ? R.hair2 : null)); }) },
  frosted: { label: 'Frostade toppar', group: 'Slingor & toppar',
    ...all((R) => { const b = bounds(R); fx(R, (x, y) => (y <= b.top[x] + (b.top[x] < R.h0 - 1 ? 1 : 0) ? R.hair2 : null)); }) },
  streak: { label: 'Lugg­slinga', group: 'Slingor & toppar', uses: ['hair2'],
    front(R) { fx(R, (x) => (x === 9 || x === 10 ? R.hair2 : null)); },
    back(R) { fx(R, (x, y) => ((x === 9 || x === 10) && y <= R.h0 ? R.hair2 : null)); },
    side(R) { fx(R, (x, y) => (x >= 14 || (x >= 12 && y <= R.h0) ? R.hair2 : null)); } },
  moneyPiece: { label: 'Fram­slingor', group: 'Slingor & toppar', uses: ['hair2'],
    front(R) { const { h0 } = R; fx(R, (x, y) => ((x <= 8 || x >= 15) && y >= h0 + 1) || ((x === 9 || x === 14) && y >= h0 - 1) ? R.hair2 : null); },
    back(R) { const { h0 } = R; fx(R, (x, y) => ((x <= 6 || x >= 17) && y >= h0 + 2 ? R.hair2 : null)); },
    side(R) { const { h0 } = R; fx(R, (x, y) => (x >= 13 && y >= h0 - 1 ? R.hair2 : null)); } },
  neon: { label: 'Neon­strimmor', group: 'Slingor & toppar', uses: ['hair2'],
    front(R) { neonAt(R, (x) => x === 8 || x === 14); },
    back(R) { neonAt(R, (x) => x === 9 || x === 15); },
    side(R) { neonAt(R, (x) => x === 9 || x === 13); } },

  ombre: { label: 'Ombré', group: 'Tvåfärgat',
    ...all((R) => { const b = bounds(R); fx(R, (x, y) => { const t = (y - b.y0) / b.h; return t > 0.62 || (t > 0.48 && (x + y) % 2 === 0) ? R.hair2 : null; }); }) },
  roots: { label: 'Utväxt', group: 'Tvåfärgat',
    ...all((R) => { const b = bounds(R); fx(R, (x, y) => { const t = (y - b.y0) / b.h; return t < 0.22 || (t < 0.34 && (x + y) % 2 === 0) ? R.hair2 : null; }); }) },
  split: { label: 'Halvt & halvt', group: 'Tvåfärgat', uses: ['hair2'],
    // personens högra halva i andra färgen: framifrån bildens vänstra, bakifrån den högra
    front(R) { fx(R, (x) => (x <= 11 ? R.hair2 : null)); },
    back(R) { fx(R, (x) => (x >= 12 ? R.hair2 : null)); },
    side(R) { if (!R.flip) fx(R, () => R.hair2); } },
  peekaboo: { label: 'Peekaboo', group: 'Tvåfärgat', uses: ['hair2'],
    front(R) { const { eyeRow } = R; fx(R, (x, y) => ((x <= 7 || x >= 16) && y >= eyeRow - 1 ? R.hair2 : null)); },
    back(R) { const { eyeRow } = R; fx(R, (x, y) => (y >= eyeRow ? R.hair2 : null)); },
    side(R) { const { eyeRow } = R; fx(R, (x, y) => (x <= 11 && y >= eyeRow - 1 ? R.hair2 : null)); } },
  sunkissed: { label: 'Solblekt', group: 'Tvåfärgat',
    ...all((R) => { const b = bounds(R); fx(R, (x, y, c) => (c === R.hair.hi || ((y - b.y0) / b.h < 0.4 && nz(x, y, 17) < 22) ? R.hair2 : null)); }) },

  grayTemples: { label: 'Grå tinningar', group: 'Grått',
    // bara vid tinningarna och ovanför öronen – långt hår blir inte grått ända ner
    front(R) { const g = GRAY(R), { h0, eyeRow } = R; fx(R, (x, y) => ((x <= 7 || x >= 16) && y >= h0 + 2 && y <= eyeRow + 1 ? g : null)); },
    back(R) { const g = GRAY(R), { h0, eyeRow } = R; fx(R, (x, y) => ((x <= 7 || x >= 16) && y >= h0 + 2 && y <= eyeRow + 1 ? g : null)); },
    side(R) { const g = GRAY(R), { h0, eyeRow } = R; fx(R, (x, y) => (y >= h0 + 2 && y <= eyeRow + 1 && x >= 8 ? g : null)); } },
  saltPepper: { label: 'Grå­sprängt', group: 'Grått',
    // även skägget blir gråsprängt
    ...all((R) => { const g = GRAY(R); fx(R, (x, y) => (nz(x, y, 23) < 32 ? g : null)); R.pattern(TAG.beard, (x, y) => (nz(x, y, 24) < 32 ? g : null)); }, { uses: [] }) },

  rainbow: { label: 'Regn­båge', group: 'Färgglatt',
    ...all((R) => { const b = bounds(R); fx(R, (x, y) => RAINBOW[Math.min(5, Math.floor(((y - b.y0) / (b.h + 1)) * 6))]); }, { uses: [] }) },
  leopard: { label: 'Leopard', group: 'Färgglatt',
    ...all((R) => fx(R, (x, y) => {
      const cx = x % 5, cy = (y + 2 * Math.floor(x / 5)) % 5;
      if ((cx === 1 || cx === 2) && (cy === 1 || cy === 2)) return R.hair2;
      if ((cx === 0 || cx === 3) && (cy === 1 || cy === 2)) return R.hair.dk;
      return null;
    })) },
  glitter: { label: 'Glitter', group: 'Färgglatt',
    ...all((R) => fx(R, (x, y) => { const n = nz(x, y, 31); return n < 6 ? 0xffffff : n < 10 ? 0xffe08a : null; }), { uses: [] }) },
};

// Neon: tunna strimmor som lyser – andra färgen ett steg ljusare än håret runt omkring
function neonAt(R, cond) {
  const N = R.hair2, glow = mix(N.hi, 0xffffff, 0.35);
  R.pattern(TAG.hair, (x, y, c) => {
    if (!isHair(R, c) || !cond(x)) return null;
    return c === R.hair.hi ? glow : c === R.hair.base ? N.hi : c === R.hair.lo ? N.base : N.lo;
  });
}
