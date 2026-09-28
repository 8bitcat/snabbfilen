// Nya ögon och ögonbryn (spreds in i EYE_REG / BROW_REG i face.js).
// Pixelkartorna ritas med pix() ur face-kit.js – se förklaringen där.
// Ögonen ligger på raderna eyeRow−2 … eyeRow (vänster öga x 7–10, höger speglas),
// från sidan x 13–16. Ansiktet syns inte bakifrån, så posterna saknar back().
import { mix, ramp } from './util.js';
import { pix, pal, mapEntry, tint, irisOf, WHITE, SHINE, LASH } from './face-kit.js';

// ---------- hjälpare ----------
// det vanliga ögat (samma som EYE_REG.normal) för ena sidan
const normalL = (R) => { const { rect, put, eye, eyeRow: E } = R; if (R.K) { rect(8, E - 1, 2, 2, eye); put(8, E - 1, SHINE); } else rect(9, E - 1, 1, 2, eye); };
const normalR = (R) => { const { rect, put, eye, eyeRow: E } = R; if (R.K) { rect(14, E - 1, 2, 2, eye); put(14, E - 1, SHINE); } else rect(14, E - 1, 1, 2, eye); };
const normalS = (R) => { const { rect, put, eye, eyeRow: E } = R; if (R.K) { rect(14, E - 1, 2, 2, eye); put(15, E - 1, SHINE); } else rect(15, E - 1, 1, 2, eye); };
const E = (label, group, spec) => mapEntry(label, group, spec);

// ---------- ögon ----------
export const EYES_NEW = {
  // --- former ---
  dots: E('Prickar', 'Former', { f: [9, 0, ['e']], s: [15, 0, ['e']] }),
  round: E('Runda', 'Former', { f: [8, -1, ['he', 'ee'], 2], s: [14, -1, ['eh', 'ee']], kf: [8, -1, ['he', 'eh'], 2], ks: [14, -1, ['eh', 'he']] }),
  big: E('Stora', 'Former', { f: [8, -2, ['he', 'ee', 'ee'], 2], s: [14, -2, ['eh', 'ee', 'ee']] }),
  almond: E('Mandel', 'Former', { f: [8, -1, ['lll', 'wew']], s: [14, -1, ['ll', 'we']] }),
  narrow: E('Smala', 'Former', { f: [8, -1, ['ll', '.e']], s: [14, -1, ['ll', '.e']] }),
  wide: E('Uppspärrade', 'Former', { f: [8, -2, ['.w.', 'wew', '.w.']], s: [14, -2, ['w.', 'we', 'w.']] }),
  anime: E('Anime', 'Former', {
    // stora ögon som sitter lågt: frans överst, ljusreflex, irisen i ögonfärgen
    p: (R) => { const I = irisOf(R, 0x8a5a30); return { i: I.base, j: I.lo }; },
    f: [7, -1, ['lll', '.hj', '.ij']], s: [13, -1, ['lll', '.hj', '.ij']],
  }),
  doll: E('Dockögon', 'Former', { f: [7, -2, ['l..', '.he', '.ee'], 1], s: [13, -2, ['l..', '.eh', '.ee']] }),
  lashes: E('Fransar', 'Former', { f: [8, -2, ['l.', 'le', '.e']], s: [14, -2, ['l.', 'le', '.e']], kf: [7, -2, ['l..', 'lhe', '.ee']], ks: [13, -2, ['l..', 'leh', '.ee']] }),
  cat: E('Kattögon', 'Former', {
    p: (R) => { const I = irisOf(R, 0xb8d43a); return { i: I.base, j: I.lo, I: I.hi, x: LASH }; },
    f: [8, -1, ['IxI', 'jxj']], s: [14, -1, ['Ix', 'jx']],
  }),
  hetero: {
    label: 'Två färger', group: 'Former',
    front(R) { const E = R.eyeRow, a = R.eyeC ? R.eyeC.base : 0x3f6fb0, b = 0x5aa84a;
      if (R.K) { R.rect(8, E - 1, 2, 2, a); R.put(8, E - 1, SHINE); R.rect(14, E - 1, 2, 2, b); R.put(14, E - 1, SHINE); }
      else { R.rect(9, E - 1, 1, 2, a); R.rect(14, E - 1, 1, 2, b); } },
    side(R) { const E = R.eyeRow, b = 0x5aa84a; if (R.K) { R.rect(14, E - 1, 2, 2, b); R.put(15, E - 1, SHINE); } else R.rect(15, E - 1, 1, 2, b); },
  },
  // --- blickar ---
  glanceR: E('Sneglar höger', 'Blickar', { f: [8, -1, ['we', 'we'], 2], s: [15, -1, ['e', 'e']] }),
  glanceL: E('Sneglar vänster', 'Blickar', { f: [8, -1, ['ew', 'ew'], 2], s: [14, -1, ['e.', 'e.']] }),
  crossed: E('Korsögda', 'Blickar', { f: [8, -1, ['we', 'we'], 1], s: [15, -1, ['e', 'e']] }),
  lookUp: E('Tittar upp', 'Blickar', { f: [8, -1, ['ee', 'ww'], 2], s: [14, -1, ['.e', 'ww']] }),
  // --- humör ---
  happy: E('Glada ^^', 'Humör', { f: [8, -1, ['.l.', 'l.l']], s: [14, -1, ['.l.', 'l.l']] }),
  closed: E('Stängda', 'Humör', { f: [8, 0, ['lll']], s: [14, 0, ['ll']] }),
  sleeping: E('Sover', 'Humör', { f: [8, -1, ['l.l', '.l.']], s: [14, -1, ['l.', '.l']] }),
  sleepy: E('Sömniga', 'Humör', {
    p: (R) => ({ d: mix(R.skin.lo, LASH, 0.35) }),
    f: [8, -1, ['dd', 'ee']], s: [14, -1, ['dd', '.e']],
  }),
  tired: {
    label: 'Trötta', group: 'Humör',
    // påsar under ögonen (lila ton över huden, skuggningen behålls)
    front(R) { const y = R.eyeRow + 1, c = 0x4a2a6a; normalL(R); normalR(R); for (const x of [8, 9, 10, 13, 14, 15]) tint(R, x, y, c, x === 8 || x === 15 ? 0.22 : 0.4); },
    side(R) { normalS(R); tint(R, 14, R.eyeRow + 1, 0x4a2a6a, 0.4); tint(R, 15, R.eyeRow + 1, 0x4a2a6a, 0.4); },
  },
  angry: E('Arga', 'Humör', { f: [8, -1, ['e.', 'ee']], s: [14, -1, ['e.', 'ee']] }),
  furious: E('Rasande', 'Humör', { f: [8, -2, ['l..', '.le', '.ee']], s: [13, -2, ['l..', '.le', '.ee']] }),
  sad: E('Ledsna', 'Humör', { f: [8, -1, ['.e', 'ee']], s: [14, -1, ['.e', 'ee']] }),
  crying: E('Gråter', 'Humör', { f: [8, 0, ['lll', 'q..', 'Q..']], s: [14, 0, ['ll', '.q', '.Q']] }),
  teary: E('Tårögda', 'Humör', { f: [8, -1, ['he', 'eh', 'q.'], 2], s: [14, -1, ['eh', 'he', '.q']] }),
  wink: {
    label: 'Blinkar', group: 'Humör',
    front(R) { normalL(R); pix(R, 13, R.eyeRow - 1, ['.l.', 'l.l'], pal(R)); },
    side(R) { pix(R, 14, R.eyeRow - 1, ['.l.', 'l.l'], pal(R)); },
  },
  sparkle: E('Gnistrande', 'Humör', { f: [8, -2, ['..h', 'he.', 'ee.'], 2], s: [14, -2, ['..h', 'eh.', 'ee.']] }),
  // --- roliga ---
  stars: E('Stjärnögon', 'Roliga', { p: () => ({ y: 0xffc928, Y: 0xfff6c0 }), f: [8, -2, ['.y.', 'yYy', '.y.']], s: [14, -2, ['.y.', 'yYy', '.y.']] }),
  hearts: E('Hjärtögon', 'Roliga', { p: () => ({ r: 0xe0304a, R: 0xff8a9a }), f: [8, -2, ['R.r', 'rrr', '.r.'], 2], s: [14, -2, ['R.r', 'rrr', '.r.']] }),
  dizzy: E('Kryss x_x', 'Roliga', { f: [8, -2, ['l.l', '.l.', 'l.l']], s: [14, -2, ['l.l', '.l.', 'l.l']] }),
  spiral: E('Snurriga', 'Roliga', { f: [8, -1, ['lll', 'l.l', 'll.'], 2], s: [14, -1, ['lll', 'l.l', 'll.']] }),
  crazy: {
    label: 'Virriga', group: 'Roliga',
    // ett stort uppspärrat öga och ett litet
    front(R) { const E = R.eyeRow, P = pal(R); pix(R, 8, E - 2, ['.w.', 'wew', '.w.'], P); R.put(14, E, R.eye); },
    side(R) { pix(R, 14, R.eyeRow - 2, ['w.', 'we', 'w.'], pal(R)); },
  },
  glow: {
    label: 'Lysande', group: 'Roliga',
    // lysande ögon med ett svagt sken runt omkring (ögonfärgen styr skenet)
    front(R) { const E = R.eyeRow, g = R.eyeC ? R.eyeC.base : 0x5ff0ff, G = mix(g, 0xffffff, 0.65);
      for (const [x, y] of [[7, -1], [7, 0], [10, -1], [10, 0], [8, -2], [9, -2], [8, 1], [9, 1]]) { tint(R, x, E + y, g, 0.3); tint(R, 23 - x, E + y, g, 0.3); }
      pix(R, 8, E - 1, ['GG', 'gg'], { G, g }, 2); },
    side(R) { const E = R.eyeRow, g = R.eyeC ? R.eyeC.base : 0x5ff0ff, G = mix(g, 0xffffff, 0.65);
      for (const [x, y] of [[13, -1], [13, 0], [14, -2], [15, -2], [14, 1], [15, 1], [16, -1], [16, 0]]) tint(R, x, E + y, g, 0.3);
      pix(R, 14, E - 1, ['GG', 'gg'], { G, g }); },
  },
  blank: E('Tomma', 'Roliga', { p: (R) => ({ W: mix(WHITE, R.skin.lo, 0.25) }), f: [8, -1, ['ww', 'WW'], 2], s: [14, -1, ['ww', 'WW']] }),
  patch: {
    label: 'Ögonlapp', group: 'Roliga',
    // piratlapp över högra ögat, bandet snett över pannan (håret täcker resten)
    front(R) { const E = R.eyeRow, P = pal(R, { p: 0x1c1a20, P: 0x3c3844 });
      normalL(R); pix(R, 13, E - 2, ['Ppp', 'ppp', '.p.'], P);
      pix(R, 9, E - 5, ['p...', '.p..', '..p.', '...p'], P); R.put(16, E - 1, P.p); },
    side(R) { const E = R.eyeRow, P = pal(R, { p: 0x1c1a20, P: 0x3c3844 });
      pix(R, 14, E - 2, ['Ppp', 'ppp', '.p.'], P); pix(R, 8, E - 3, ['pp....', '..ppp.'], P); },
  },
};

// ---------- ögonbryn (färgen följer håret: o = hair.lo, O = hair.dk, a = hair.base, A = hair.hi) ----------
// Raden B = eyeRow − 3 (vuxen: rad 10, barn: rad 17 – barnets lugg täcker ibland brynen).
const B = (label, group, spec) => mapEntry(label, group, { base: (R) => R.eyeRow - 3, ...spec });
const thin = (R) => ({ t: mix(R.hair.lo, R.skin.base, 0.45) });
const light = (R) => ({ t: mix(R.hair.hi, R.skin.hi, 0.35) });
export const BROWS_NEW = {
  thin: B('Tunna', 'Former', { p: thin, f: [8, 0, ['ttt']], s: [14, 0, ['ttt']] }),
  short: B('Korta', 'Former', { f: [9, 0, ['oo']], s: [15, 0, ['oo']] }),
  thick: B('Tjocka', 'Former', { f: [8, -1, ['.oo', 'OOO']], s: [14, -1, ['oo.', 'OOO']] }),
  bushy: B('Buskiga', 'Former', { f: [7, -1, ['o.o.', 'oOOo']], s: [14, -1, ['o.o', 'OOO']] }),
  straight: B('Raka', 'Former', { f: [7, 0, ['OOOO']], s: [14, 0, ['OOO']] }),
  light: B('Ljusa', 'Former', { p: light, f: [8, 0, ['ttt']], s: [14, 0, ['ttt']] }),
  grey: B('Gråa', 'Former', { p: () => ({ t: 0xcfcac2, T: 0x9a948c }), f: [8, -1, ['t..', 'tTT']], s: [14, -1, ['..t', 'TTt']] }),
  unibrow: B('Ihop­växta', 'Former', { f: [8, 0, ['oooo'], 1], s: [14, 0, ['ooo']], after: (R) => { R.put(11, R.eyeRow - 3, R.hair.base); R.put(12, R.eyeRow - 3, R.hair.base); } }),
  arched: B('Bågade', 'Former', { f: [8, 0, ['.oo', 'o..']], s: [14, 0, ['.oo', 'o..']] }),
  angry: B('Arga', 'Humör', { f: [8, 0, ['oo.', '..o']], s: [14, 0, ['oo.', '..o']] }),
  stern: B('Bistra', 'Humör', { f: [7, 0, ['OOO.', '..OO']], s: [13, 0, ['OOO.', '..OO']] }),
  sad: B('Ledsna', 'Humör', { f: [8, -1, ['..o', 'oo.']], s: [14, -1, ['..o', 'oo.']] }),
  worried: B('Oroliga', 'Humör', { f: [8, -1, ['..o', '.o.', 'o..']], s: [14, -1, ['..o', '.o.', 'o..']] }),
  raised: B('Lyfta', 'Humör', { f: [8, -1, ['ooo']], s: [14, -1, ['ooo']] }),
  surprised: B('Förvånade', 'Humör', { f: [8, -1, ['.o.', 'o.o']], s: [14, -1, ['.o.', 'o.o']] }),
  skeptic: {
    label: 'Skeptiska', group: 'Humör',
    // vänster bryn rakt, höger lyft i en båge
    front(R) { const y = R.eyeRow - 3, P = pal(R); pix(R, 8, y, ['ooo'], P); pix(R, 13, y - 1, ['.oo', 'o..'], P); },
    side(R) { pix(R, 14, R.eyeRow - 4, ['.oo', 'o..'], pal(R)); },
  },
  slit: B('Rakad skåra', 'Stil', { f: [8, 0, ['ooo'], 0], s: [14, 0, ['o.o']], after: (R) => pix(R, 13, R.eyeRow - 3, ['o.o'], pal(R)) }),
  doubleSlit: B('Skåror i båda', 'Stil', { f: [7, 0, ['o.oo'], 1], s: [13, 0, ['o.oo']] }),
  pierced: B('Piercing', 'Stil', {
    f: [8, 0, ['ooo'], 1], s: [14, 0, ['ooo']],
    after: (R) => { const y = R.eyeRow - 3; R.put(15, y - 1, 0xe8ecf2); R.put(15, y + 1, 0x9aa4b2); },
    afterS: (R) => { const y = R.eyeRow - 3; R.put(14, y - 1, 0xe8ecf2); R.put(14, y + 1, 0x9aa4b2); },
  }),
  ring: B('Brynring', 'Stil', {
    f: [8, 0, ['ooo'], 1], s: [14, 0, ['ooo']],
    after: (R) => { const y = R.eyeRow - 3; R.put(16, y, 0xf0c040); R.put(16, y + 1, 0xb88a20); },
    afterS: (R) => { const y = R.eyeRow - 3; R.put(13, y, 0xf0c040); R.put(13, y + 1, 0xb88a20); },
  }),
  // färgade bryn i hårets andra färg (samma som slingor/toppar)
  colored: B('Färgade', 'Stil', { p: (R) => ({ c: R.hair2.base, C: R.hair2.lo }), f: [8, 0, ['ccC']], s: [14, 0, ['Ccc']], uses: ['hair2'] }),
};
