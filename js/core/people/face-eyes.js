// Nya ögon och ögonbryn (spreds in i EYE_REG / BROW_REG i face.js).
// Pixelkartorna ritas med pix() ur face-kit.js – se förklaringen där.
// Ögonen ligger på raderna eyeRow−2 … eyeRow (vänster öga x 7–10, höger speglas),
// från sidan x 13–16. Ansiktet syns inte bakifrån, så posterna saknar back().
import { mix, ramp, TAG } from './util.js';
import { pix, pal, mapEntry, tint, irisOf, WHITE, SHINE, LASH } from './face-kit.js';
import { $t, $n } from '../i18n.js';

// ---------- hjälpare ----------
// det vanliga ögat (samma som EYE_REG.normal) för ena sidan
const normalL = (R) => { const { rect, put, eye, eyeRow: E } = R; if (R.K) { rect(8, E - 1, 2, 2, eye); put(8, E - 1, SHINE); } else rect(9, E - 1, 1, 2, eye); };
const normalR = (R) => { const { rect, put, eye, eyeRow: E } = R; if (R.K) { rect(14, E - 1, 2, 2, eye); put(14, E - 1, SHINE); } else rect(14, E - 1, 1, 2, eye); };
const normalS = (R) => { const { rect, put, eye, eyeRow: E } = R; if (R.K) { rect(14, E - 1, 2, 2, eye); put(15, E - 1, SHINE); } else rect(15, E - 1, 1, 2, eye); };
const E = (label, group, spec) => mapEntry(label, group, spec);
// metallplåt + lysdiod för cyborgögat
const cyborgPal = (R) => { const led = R.eyeC ? R.eyeC.base : 0xff3a30; return { z: 0x8a929e, Z: 0xd4dae2, d: 0x4a505a, r: led, R: mix(led, 0xffffff, 0.6) }; };

// ---------- ögon ----------
export const EYES_NEW = {
  // --- former ---
  dots: E($t('Prickar'), $n('Former'), { f: [9, 0, ['e']], s: [15, 0, ['e']] }),
  round: E($t('Runda'), $n('Former'), { f: [8, -1, ['he', 'ee'], 2], s: [14, -1, ['eh', 'ee']], kf: [8, -1, ['he', 'eh'], 2], ks: [14, -1, ['eh', 'he']] }),
  big: E($t('Stora'), $n('Former'), { f: [8, -2, ['he', 'ee', 'ee'], 2], s: [14, -2, ['eh', 'ee', 'ee']] }),
  almond: E($t('Mandel'), $n('Former'), { f: [8, -1, ['lll', 'wew']], s: [14, -1, ['ll', 'we']] }),
  narrow: E($t('Smala'), $n('Former'), { f: [8, -1, ['ll', '.e']], s: [14, -1, ['ll', '.e']] }),
  wide: E($t('Uppspärrade'), $n('Former'), { f: [8, -2, ['.w.', 'wew', '.w.']], s: [14, -2, ['w.', 'we', 'w.']] }),
  anime: E($t('Anime'), $n('Former'), {
    // stora ögon som sitter lågt: frans överst, ljusreflex, irisen i ögonfärgen
    p: (R) => { const I = irisOf(R, 0x8a5a30); return { i: I.base, j: I.lo }; },
    f: [7, -1, ['lll', '.hj', '.ij']], s: [13, -1, ['lll', '.hj', '.ij']],
  }),
  doll: E($t('Dockögon'), $n('Former'), { f: [7, -2, ['l..', '.he', '.ee'], 1], s: [13, -2, ['l..', '.eh', '.ee']] }),
  lashes: E($t('Fransar'), $n('Former'), { f: [8, -2, ['l.', 'le', '.e']], s: [14, -2, ['l.', 'le', '.e']], kf: [7, -2, ['l..', 'lhe', '.ee']], ks: [13, -2, ['l..', 'leh', '.ee']] }),
  cat: E($t('Kattögon'), $n('Former'), {
    p: (R) => { const I = irisOf(R, 0xb8d43a); return { i: I.base, j: I.lo, I: I.hi, x: LASH }; },
    f: [8, -1, ['IxI', 'jxj']], s: [14, -1, ['Ix', 'jx']],
  }),
  hetero: {
    label: $t('Två färger'), group: $n('Former'),
    front(R) { const E = R.eyeRow, a = R.eyeC ? R.eyeC.base : 0x3f6fb0, b = 0x5aa84a;
      if (R.K) { R.rect(8, E - 1, 2, 2, a); R.put(8, E - 1, SHINE); R.rect(14, E - 1, 2, 2, b); R.put(14, E - 1, SHINE); }
      else { R.rect(9, E - 1, 1, 2, a); R.rect(14, E - 1, 1, 2, b); } },
    side(R) { const E = R.eyeRow, b = 0x5aa84a; if (R.K) { R.rect(14, E - 1, 2, 2, b); R.put(15, E - 1, SHINE); } else R.rect(15, E - 1, 1, 2, b); },
  },
  // --- blickar ---
  glanceR: E($t('Sneglar höger'), $n('Blickar'), { f: [8, -1, ['we', 'we'], 2], s: [15, -1, ['e', 'e']] }),
  glanceL: E($t('Sneglar vänster'), $n('Blickar'), { f: [8, -1, ['ew', 'ew'], 2], s: [14, -1, ['e.', 'e.']] }),
  crossed: E($t('Korsögda'), $n('Blickar'), { f: [8, -1, ['we', 'we'], 1], s: [15, -1, ['e', 'e']] }),
  lookUp: E($t('Tittar upp'), $n('Blickar'), { f: [8, -1, ['ee', 'ww'], 2], s: [14, -1, ['.e', 'ww']] }),
  // --- humör ---
  happy: E($t('Glada ^^'), $n('Humör'), { f: [8, -1, ['.l.', 'l.l']], s: [14, -1, ['.l.', 'l.l']] }),
  closed: E($t('Stängda'), $n('Humör'), { f: [8, 0, ['lll']], s: [14, 0, ['ll']] }),
  sleeping: E($t('Sover'), $n('Humör'), { f: [8, -1, ['l.l', '.l.']], s: [14, -1, ['l.', '.l']] }),
  sleepy: E($t('Sömniga'), $n('Humör'), {
    p: (R) => ({ d: mix(R.skin.lo, LASH, 0.35) }),
    f: [8, -1, ['dd', 'ee']], s: [14, -1, ['dd', '.e']],
  }),
  tired: {
    label: $t('Trötta'), group: $n('Humör'),
    // påsar under ögonen (lila ton över huden, skuggningen behålls)
    front(R) { const y = R.eyeRow + 1, c = 0x4a2a6a; normalL(R); normalR(R); for (const x of [8, 9, 10, 13, 14, 15]) tint(R, x, y, c, x === 8 || x === 15 ? 0.22 : 0.4); },
    side(R) { normalS(R); tint(R, 14, R.eyeRow + 1, 0x4a2a6a, 0.4); tint(R, 15, R.eyeRow + 1, 0x4a2a6a, 0.4); },
  },
  angry: E($t('Arga'), $n('Humör'), { f: [8, -1, ['e.', 'ee']], s: [14, -1, ['e.', 'ee']] }),
  furious: E($t('Rasande'), $n('Humör'), { f: [8, -2, ['l..', '.le', '.ee']], s: [13, -2, ['l..', '.le', '.ee']] }),
  sad: E($t('Ledsna'), $n('Humör'), { f: [8, -1, ['.e', 'ee']], s: [14, -1, ['.e', 'ee']] }),
  crying: E($t('Gråter'), $n('Humör'), { f: [8, 0, ['lll', 'q..', 'Q..']], s: [14, 0, ['ll', '.q', '.Q']] }),
  teary: E($t('Tårögda'), $n('Humör'), { f: [8, -1, ['he', 'eh', 'q.'], 2], s: [14, -1, ['eh', 'he', '.q']] }),
  wink: {
    label: $t('Blinkar'), group: $n('Humör'),
    front(R) { normalL(R); pix(R, 13, R.eyeRow - 1, ['.l.', 'l.l'], pal(R)); },
    side(R) { pix(R, 14, R.eyeRow - 1, ['.l.', 'l.l'], pal(R)); },
  },
  sparkle: E($t('Gnistrande'), $n('Humör'), { f: [8, -2, ['..h', 'he.', 'ee.'], 2], s: [14, -2, ['..h', 'eh.', 'ee.']] }),
  // --- roliga ---
  stars: E($t('Stjärnögon'), $n('Roliga'), { p: () => ({ y: 0xffc928, Y: 0xfff6c0 }), f: [8, -2, ['.y.', 'yYy', '.y.']], s: [14, -2, ['.y.', 'yYy', '.y.']] }),
  hearts: E($t('Hjärtögon'), $n('Roliga'), { p: () => ({ r: 0xe0304a, R: 0xff8a9a }), f: [8, -2, ['R.r', 'rrr', '.r.'], 2], s: [14, -2, ['R.r', 'rrr', '.r.']] }),
  dizzy: E($t('Kryss x_x'), $n('Roliga'), { f: [8, -2, ['l.l', '.l.', 'l.l']], s: [14, -2, ['l.l', '.l.', 'l.l']] }),
  spiral: E($t('Snurriga'), $n('Roliga'), { f: [8, -1, ['lll', 'l.l', 'll.'], 2], s: [14, -1, ['lll', 'l.l', 'll.']] }),
  crazy: {
    label: $t('Virriga'), group: $n('Roliga'),
    // ett stort uppspärrat öga och ett litet
    front(R) { const E = R.eyeRow, P = pal(R); pix(R, 8, E - 2, ['.w.', 'wew', '.w.'], P); R.put(14, E, R.eye); },
    side(R) { pix(R, 14, R.eyeRow - 2, ['w.', 'we', 'w.'], pal(R)); },
  },
  glow: {
    label: $t('Lysande'), group: $n('Roliga'),
    // lysande ögon med ett svagt sken runt omkring (ögonfärgen styr skenet)
    front(R) { const E = R.eyeRow, g = R.eyeC ? R.eyeC.base : 0x5ff0ff, G = mix(g, 0xffffff, 0.65);
      for (const [x, y] of [[7, -1], [7, 0], [10, -1], [10, 0], [8, -2], [9, -2], [8, 1], [9, 1]]) { tint(R, x, E + y, g, 0.3); tint(R, 23 - x, E + y, g, 0.3); }
      pix(R, 8, E - 1, ['GG', 'gg'], { G, g }, 2); },
    side(R) { const E = R.eyeRow, g = R.eyeC ? R.eyeC.base : 0x5ff0ff, G = mix(g, 0xffffff, 0.65);
      for (const [x, y] of [[13, -1], [13, 0], [14, -2], [15, -2], [14, 1], [15, 1], [16, -1], [16, 0]]) tint(R, x, E + y, g, 0.3);
      pix(R, 14, E - 1, ['GG', 'gg'], { G, g }); },
  },
  cyborg: {
    label: $t('Cyborgöga'), group: $n('Roliga'),
    // ena ögat är en lysdiod i en metallplåt (ögonfärgen styr diodens färg, annars röd)
    front(R) {
      const E = R.eyeRow, P = cyborgPal(R);
      normalL(R);
      if (R.K) pix(R, 13, E - 2, ['Zzzz', 'zRrd', 'zrrd', 'zddd'], P); else pix(R, 13, E - 2, ['Zzz', 'zrd', 'zdd'], P);
    },
    side(R) {
      const E = R.eyeRow, P = cyborgPal(R);
      if (R.K) pix(R, 13, E - 2, ['Zzzz', 'zRrd', 'zrrd', 'zddd'], P); else pix(R, 14, E - 2, ['Zzz', 'zrd', 'zdd'], P);
    },
  },
  blank: E($t('Tomma'), $n('Roliga'), { p: (R) => ({ W: mix(WHITE, R.skin.lo, 0.25) }), f: [8, -1, ['ww', 'WW'], 2], s: [14, -1, ['ww', 'WW']] }),
  patch: {
    label: $t('Ögonlapp'), group: $n('Roliga'),
    // piratlapp över högra ögat, bandet snett över pannan (håret täcker resten)
    front(R) { const E = R.eyeRow, P = pal(R, { p: 0x1c1a20, P: 0x3c3844 });
      normalL(R); pix(R, 13, E - 2, ['Ppp', 'ppp', '.p.'], P);
      pix(R, 9, E - 5, ['p...', '.p..', '..p.', '...p'], P); R.put(16, E - 1, P.p); },
    side(R) { const E = R.eyeRow, P = pal(R, { p: 0x1c1a20, P: 0x3c3844 });
      pix(R, 14, E - 2, ['Ppp', 'ppp', '.p.'], P); pix(R, 8, E - 3, ['pp....', '..ppp.'], P); },
    // bandet ligger UTANPÅ håret: rita om det där frisyren täcker (bakifrån snett över nacken)
    afterHair(R) {
      const E = R.eyeRow, p = 0x1c1a20;
      const over = (x, y, head) => { const t = R.tagAt(x, y); if (t === TAG.hair || (head && t === TAG.head)) R.put(x, y, p); };
      if (R.front) for (const [x, dy] of [[12, -2], [11, -3], [10, -4], [9, -5], [8, -6], [7, -7]]) over(x, E + dy);
      else if (R.side) for (const [x, dy] of [[8, -3], [9, -3], [10, -2], [11, -2], [12, -2], [13, -2]]) over(x, E + dy);
      else for (let x = 7; x <= 16; x++) over(x, E - 2 - Math.floor((x - 7) / 3), true);
    },
  },
};

// ---------- ögonbryn (färgen följer håret: o = hair.lo, O = hair.dk, a = hair.base, A = hair.hi) ----------
// Raden B = eyeRow − 3 (vuxen: rad 10, barn: rad 17 – barnets lugg täcker ibland brynen).
const B = (label, group, spec) => mapEntry(label, group, { base: (R) => R.eyeRow - 3, ...spec });
const thin = (R) => ({ t: mix(R.hair.lo, R.skin.base, 0.45) });
const light = (R) => ({ t: mix(R.hair.hi, R.skin.hi, 0.35) });
export const BROWS_NEW = {
  thin: B($t('Tunna'), $n('Former'), { p: thin, f: [8, 0, ['ttt']], s: [14, 0, ['ttt']] }),
  short: B($t('Korta'), $n('Former'), { f: [9, 0, ['oo']], s: [15, 0, ['oo']] }),
  thick: B($t('Tjocka'), $n('Former'), { f: [8, -1, ['.oo', 'OOO']], s: [14, -1, ['oo.', 'OOO']] }),
  bushy: B($t('Buskiga'), $n('Former'), { f: [7, -1, ['o.o.', 'oOOo']], s: [14, -1, ['o.o', 'OOO']] }),
  straight: B($t('Raka'), $n('Former'), { f: [7, 0, ['OOOO']], s: [14, 0, ['OOO']] }),
  light: B($t('Ljusa'), $n('Former'), { p: light, f: [8, 0, ['ttt']], s: [14, 0, ['ttt']] }),
  grey: B($t('Gråa'), $n('Former'), { p: () => ({ t: 0xcfcac2, T: 0x9a948c }), f: [8, -1, ['t..', 'tTT']], s: [14, -1, ['..t', 'TTt']] }),
  unibrow: B($t('Ihop­växta'), $n('Former'), { f: [8, 0, ['oooo'], 1], s: [14, 0, ['ooo']], after: (R) => { R.put(11, R.eyeRow - 3, R.hair.base); R.put(12, R.eyeRow - 3, R.hair.base); } }),
  arched: B($t('Bågade'), $n('Former'), { f: [8, 0, ['.oo', 'o..']], s: [14, 0, ['.oo', 'o..']] }),
  // tunna, högt plockade bågar (spetsen en rad ovanför de vanliga brynen)
  plucked: B($t('Plockade'), $n('Former'), { p: (R) => ({ t: mix(R.hair.lo, R.skin.base, 0.2) }), f: [7, -1, ['.tt.', 't..t']], s: [14, -1, ['.tt', 't..']] }),
  angry: B($t('Arga'), $n('Humör'), { f: [8, 0, ['oo.', '..o']], s: [14, 0, ['oo.', '..o']] }),
  stern: B($t('Bistra'), $n('Humör'), { f: [7, 0, ['OOO.', '..OO']], s: [13, 0, ['OOO.', '..OO']] }),
  sad: B($t('Ledsna'), $n('Humör'), { f: [8, -1, ['..o', 'oo.']], s: [14, -1, ['..o', 'oo.']] }),
  worried: B($t('Oroliga'), $n('Humör'), { f: [8, -1, ['..o', '.o.', 'o..']], s: [14, -1, ['..o', '.o.', 'o..']] }),
  raised: B($t('Lyfta'), $n('Humör'), { f: [8, -1, ['ooo']], s: [14, -1, ['ooo']] }),
  surprised: B($t('Förvånade'), $n('Humör'), { f: [8, -1, ['.o.', 'o.o']], s: [14, -1, ['.o.', 'o.o']] }),
  skeptic: {
    label: $t('Skeptiska'), group: $n('Humör'),
    // vänster bryn rakt, höger lyft i en båge
    front(R) { const y = R.eyeRow - 3, P = pal(R); pix(R, 8, y, ['ooo'], P); pix(R, 13, y - 1, ['.oo', 'o..'], P); },
    side(R) { pix(R, 14, R.eyeRow - 4, ['.oo', 'o..'], pal(R)); },
  },
  slit: B($t('Rakad skåra'), $n('Stil'), { f: [8, 0, ['ooo'], 0], s: [14, 0, ['o.o']], after: (R) => pix(R, 13, R.eyeRow - 3, ['o.o'], pal(R)) }),
  doubleSlit: B($t('Skåror i båda'), $n('Stil'), { f: [7, 0, ['o.oo'], 1], s: [13, 0, ['o.oo']] }),
  pierced: B($t('Piercing'), $n('Stil'), {
    f: [8, 0, ['ooo'], 1], s: [14, 0, ['ooo']],
    after: (R) => { const y = R.eyeRow - 3; R.put(15, y - 1, 0xe8ecf2); R.put(15, y + 1, 0x9aa4b2); },
    afterS: (R) => { const y = R.eyeRow - 3; R.put(14, y - 1, 0xe8ecf2); R.put(14, y + 1, 0x9aa4b2); },
  }),
  ring: B($t('Brynring'), $n('Stil'), {
    f: [8, 0, ['ooo'], 1], s: [14, 0, ['ooo']],
    after: (R) => { const y = R.eyeRow - 3; R.put(16, y, 0xf0c040); R.put(16, y + 1, 0xb88a20); },
    afterS: (R) => { const y = R.eyeRow - 3; R.put(13, y, 0xf0c040); R.put(13, y + 1, 0xb88a20); },
  }),
  // färgade bryn i hårets andra färg (samma som slingor/toppar)
  colored: B($t('Färgade'), $n('Stil'), { p: (R) => ({ c: R.hair2.base, C: R.hair2.lo }), f: [8, 0, ['ccC']], s: [14, 0, ['Ccc']], uses: ['hair2'] }),
};
