// Nya munnar, näsor och öron (spreds in i MOUTH_REG / NOSE_REG / EAR_REG i face.js).
//
// Munnen: framifrån ligger två-radiga munnar på raderna eyeRow+3 och eyeRow+4 (vuxen:
// rad 16–17, där 17 är hakraden; barn: rad 23–24). Från sidan räknas raderna från den
// vanliga munnens rad (mouthRow: vuxen eyeRow+4, barn eyeRow+3) och läpparna sitter vid x 16.
// Färger ur paletten i face-kit.js: m = läppfärgen (R.lip – läppstift byter den i prep),
// M = mörkare läpp, k = munhålan, t/T = tänder, g = tunga, z/Z = metall, y/Y = guld.
// Näsan: framifrån x 11–13 runt raden eyeRow+2, från sidan sticker den ut vid x 17–18.
// Öronen: framifrån x 6 och 17 (syns även bakifrån), från sidan x 11–12.
import { mix, ramp, TAG } from './util.js';
import { pix, pal, mapEntry, tint, tintRect, mouthRow, WHITE } from './face-kit.js';

// ---------- munnar ----------
const Mo = (label, group, spec) => mapEntry(label, group, { base: (R) => R.eyeRow + 3, sbase: mouthRow, ...spec, f: spec.f && [...spec.f, spec.f[3] ?? 0], kf: spec.kf && [...spec.kf, spec.kf[3] ?? 0] });
const lipsC = (R) => { const c = R.L.lipColor ? R.lipC : ramp(0xc0304a); return { c: c.base, C: c.lo, h: c.hi }; };
export const MOUTHS_NEW = {
  // --- glada ---
  smile: Mo('Leende', 'Glada', { f: [10, 0, ['M..M', '.MM.']], s: [15, -1, ['M.', '.M']] }),
  smallSmile: Mo('Litet leende', 'Glada', { f: [10, 0, ['M..M', '.mm.']], kf: [10, 0, ['M..M', '.mm.']], s: [15, -1, ['M.', '.m']] }),
  bigSmile: Mo('Stort leende', 'Glada', { f: [10, 0, ['MttM', '.kk.']], s: [15, -1, ['Mt', '.k']] }),
  grin: Mo('Flin', 'Glada', { f: [9, 0, ['MttttM', '.MMMM.']], s: [14, -1, ['Mtt', '..M']] }),
  laugh: Mo('Skrattar', 'Glada', { f: [10, 0, ['tttt', 'kggk']], s: [15, -1, ['tt', 'kg']] }),
  smirk: Mo('Snett leende', 'Glada', { f: [11, 0, ['..M', 'MM.']], s: [15, -1, ['M.', '.M']] }),
  catMouth: Mo('Kattmun :3', 'Glada', { f: [10, 0, ['M.M.M', '.M.M.']], s: [15, -1, ['.M', 'M.']] }),
  // --- neutrala & sura ---
  flat: Mo('Rak', 'Neutrala & sura', { f: [10, 1, ['MMMM']], kf: [10, 0, ['MMMM']], s: [15, 0, ['MM']] }),
  tiny: Mo('Liten', 'Neutrala & sura', { f: [11, 1, ['M']], kf: [11, 0, ['M']], s: [16, 0, ['M']] }),
  frown: Mo('Sur', 'Neutrala & sura', { f: [10, 0, ['.MM.', 'M..M']], s: [15, -1, ['.M', 'M.']] }),
  wavy: Mo('Nervös', 'Neutrala & sura', { f: [10, 0, ['.M.M', 'M.M.']], s: [15, -1, ['.M', 'MM']] }),
  bite: Mo('Biter i läppen', 'Neutrala & sura', { f: [10, 0, ['.tt.', 'MmmM']], s: [15, -1, ['.t', '.m']] }),
  // --- öppna ---
  open: Mo('Öppen', 'Öppna', { f: [10, 0, ['MkkM', '.gg.']], s: [16, -1, ['k', 'g']] }),
  surprised: Mo('Förvånad', 'Öppna', { f: [10, 0, ['.kk.', '.kk.']], s: [16, -1, ['k', 'k']] }),
  shout: Mo('Skriker', 'Öppna', { f: [9, 0, ['MttttM', '.kggk.']], s: [15, -1, ['tt', 'kg']] }),
  tongue: Mo('Räcker ut tungan', 'Öppna', { f: [10, 0, ['MMMM', '.gg.']], s: [16, -1, ['M.', 'gg']] }),
  // --- tänder ---
  braces: Mo('Tandställning', 'Tänder', { f: [9, 0, ['MtztzM', '.MMMM.']], s: [14, -1, ['Mzt', '..M']] }),
  vampire: Mo('Vampyrtänder', 'Tänder', { f: [10, 0, ['MkkM', 't..t']], s: [16, -1, ['k', 't']] }),
  buck: Mo('Kaninänder', 'Tänder', { f: [10, 0, ['MMMM', '.tt.']], s: [16, -1, ['M', 't']] }),
  gap: Mo('Tandlucka', 'Tänder', { f: [9, 0, ['MtkttM', '.MMMM.']], s: [14, -1, ['Mkt', '..M']] }),
  goldTooth: Mo('Guldtand', 'Tänder', { f: [9, 0, ['MttytM', '.MMMM.']], s: [14, -1, ['Mty', '..M']] }),
  // --- läppar ---
  fullLips: Mo('Fylliga läppar', 'Läppar', { p: (R) => ({ n: mix(R.lip, 0xffffff, 0.22) }), f: [10, 0, ['mMMm', '.nn.']], s: [15, -1, ['mm', '.n']] }),
  redLips: Mo('Röda läppar', 'Läppar', { p: lipsC, f: [10, 0, ['cCCc', '.hh.']], s: [15, -1, ['cc', '.h']], uses: ['lipColor'] }),
  kiss: Mo('Pussmun', 'Läppar', { p: lipsC, f: [11, 0, ['cc', 'hC']], s: [16, -1, ['cc', 'C.']], uses: ['lipColor'] }),
  // --- saker i munnen ---
  bubble: Mo('Tuggummi­bubbla', 'Saker i munnen', {
    p: () => ({ p: 0xf28bb3, P: 0xffd2e4, q: 0xc85a8a }),
    f: [10, -1, ['.PP.', 'pPpp', '.pq.']], s: [16, -1, ['.pp', 'pPp', '.qp']],
  }),
  pacifier: Mo('Napp', 'Saker i munnen', {
    p: () => ({ c: 0x8fc7f0, C: 0x5a9ad0, h: WHITE, H: 0xc8c2b8 }),
    f: [10, 0, ['cCCc', '.hH.']], s: [16, -1, ['c.', 'Ch']],
  }),
  straw: {
    label: 'Grässtrå', group: 'Saker i munnen',
    // ett strå i mungipan (den vanliga munnen + strået snett uppåt)
    front(R) { const y = mouthRow(R), a = 0xc8a830, b = 0x8a6a18; R.rect(11, y, 2, 1, R.lip); R.put(13, y, b); R.put(14, y - 1, b); R.put(15, y - 1, a); R.put(16, y - 2, a); R.put(17, y - 2, 0xf0d860); },
    side(R) { const y = mouthRow(R), a = 0xc8a830; R.put(16, y, R.lip); R.put(17, y, 0x8a6a18); R.put(18, y - 1, a); R.put(19, y - 1, 0xf0d860); },
  },
};

// ---------- näsor ----------
const No = (label, group, spec) => mapEntry(label, group, { ...spec, f: spec.f && [...spec.f, spec.f[3] ?? 0] });
export const NOSES_NEW = {
  button: No('Knappnäsa', 'Former', { f: [11, 1, ['.H', 'ss']], s: [17, 2, ['b']] }),
  big: No('Stor', 'Former', { f: [11, 1, ['.s.', 'sSs']], s: [17, 0, ['b.', 'bb', 'ss']] }),
  long: No('Lång', 'Former', { f: [12, 0, ['s', 's', 'S']], s: [17, 0, ['b..', 'bb.', '.sS']] }),
  hooked: No('Örnnäsa', 'Former', { f: [12, 1, ['s', 'S']], s: [17, 0, ['bb', '.b', '.s']] }),
  upturned: No('Uppnäsa', 'Former', { f: [11, 2, ['SS']], s: [17, 1, ['.b', 'S.']] }),
  wide: No('Bred', 'Former', { f: [11, 1, ['.s.', 'S.S']], s: [17, 1, ['b', 's']], afterS: (R) => R.put(16, R.eyeRow + 2, R.skin.dk) }),
  red: {
    label: 'Röd av kyla', group: 'Former',
    front(R) { R.put(12, R.eyeRow + 2, R.skin.lo); tintRect(R, 11, R.eyeRow + 1, 2, 2, 0xe03a3a, 0.4); },
    side(R) { R.put(17, R.eyeRow + 1, R.skin.base); R.put(17, R.eyeRow + 2, R.skin.lo); tintRect(R, 16, R.eyeRow + 1, 2, 2, 0xe03a3a, 0.4); },
  },
  clown: No('Clownnäsa', 'Roliga', { p: () => ({ r: 0xe0302a, R: 0xff8a80, d: 0xa82020 }), f: [11, 1, ['Rr', 'rd']], s: [17, 1, ['Rr', 'rd']] }),
  pig: No('Grisnäsa', 'Roliga', { p: () => ({ p: 0xf2a6b0, P: 0x8a3a52, q: 0xd8808e }), f: [11, 1, ['pp', 'PP']], s: [17, 1, ['pq', 'pP']] }),
  septum: No('Septumring', 'Piercing', { f: [12, 2, ['s']], s: [17, 1, ['b', 's']], after: (R) => { R.put(11, R.eyeRow + 3, 0xd8dde4); R.put(12, R.eyeRow + 3, 0x9aa4b2); }, afterS: (R) => R.put(17, R.eyeRow + 3, 0xd8dde4) }),
  noseRing: No('Näsring', 'Piercing', { f: [12, 2, ['s']], s: [17, 1, ['b', 's']], after: (R) => R.put(13, R.eyeRow + 2, 0xf0c040), afterS: (R) => R.put(16, R.eyeRow + 2, 0xf0c040) }),
  noseStud: No('Nässtift', 'Piercing', { f: [12, 2, ['s']], s: [17, 1, ['b', 's']], after: (R) => R.put(11, R.eyeRow + 2, 0xeef2f6), afterS: (R) => R.put(16, R.eyeRow + 1, 0xeef2f6) }),
};

// ---------- öron (vänster öra ritas, högra speglas med skuggfärg) ----------
// L = vänster örats pixelkarta (x0 = vänsterkant), dy relativt eyeRow. Tecknen b/s/S = hud.
// tip = pixlar som sticker ut genom håret (ritas igen efter frisyren).
// overHair = rita bara där frisyren redan ligger (öronspetsar som sticker ut genom håret)
const pixOver = (R, x0, y0, rows, P) => {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const c = P[rows[j][i]];
    if (c != null && R.tagAt(x0 + i, y0 + j) === TAG.hair) R.put(x0 + i, y0 + j, c);
  }
};
const earPair = (R, x0, dy, rows, overHair = false) => {
  const P = pal(R), Q = { ...P, b: R.skin.lo, H: R.skin.base, s: R.skin.dk }, draw = overHair ? pixOver : pix;
  const w = Math.max(...rows.map((r) => r.length));
  draw(R, x0, R.eyeRow + dy, rows, P);
  draw(R, 23 - (x0 + w - 1), R.eyeRow + dy, rows.map((r) => [...r.padEnd(w, '.')].reverse().join('')), Q);
};
const Ear = (label, group, spec) => {
  const fb = (R) => earPair(R, spec.f[0], spec.f[1], spec.f[2]);
  const e = {
    label, group, front: fb, back: fb,
    side(R) { pix(R, spec.s[0], R.eyeRow + spec.s[1], spec.s[2], pal(R)); },
  };
  if (spec.tipF || spec.tipS) e.afterHair = function (R) {
    if (R.side) { if (spec.tipS) pixOver(R, spec.tipS[0], R.eyeRow + spec.tipS[1], spec.tipS[2], pal(R)); }
    else if (spec.tipF) earPair(R, spec.tipF[0], spec.tipF[1], spec.tipF[2], true);
  };
  if (spec.after) { const f = e.front, s = e.side; e.front = e.back = (R) => { f(R); spec.after(R); }; e.side = function (R) { s.call(this, R); spec.after(R); }; }
  return e;
};
export const EARS_NEW = {
  small: Ear('Små', 'Former', { f: [6, 0, ['b', 's']], s: [11, 0, ['bb', 'sS']] }),
  big: Ear('Stora', 'Former', { f: [5, -2, ['.b', 'bs', 'bS', 'bs', '.b']], s: [10, -2, ['.bb', 'bbs', 'bsS', 'bbs', '.bb']] }),
  jug: Ear('Utstående', 'Former', { f: [4, -2, ['bb.', 'bsb', '.bs', '..b']], s: [11, -2, ['bb', 'bs', 'bS', 'bb']], tipF: [4, -2, ['bb', 'bs', '.b']] }),
  elf: Ear('Alvöron', 'Sagoväsen', {
    f: [4, -3, ['b..', '.b.', '.bb', '..s', '..b']], s: [9, -3, ['s...', '.s..', '..bb', '..sS', '..bb']],
    tipF: [4, -3, ['b', '.b', '.b']], tipS: [9, -3, ['b.', '.b']],
  }),
  longElf: Ear('Långa alvöron', 'Sagoväsen', {
    f: [2, -4, ['b....', '.bb..', '..bbb', '...bs', '....b']], s: [7, -4, ['s.....', '.ss...', '..ssbb', '....sS', '....bb']],
    tipF: [2, -4, ['b...', '.bb.', '..bb']], tipS: [7, -4, ['b..', '.bb', '..bb']],
  }),
  goblin: Ear('Trollöron', 'Sagoväsen', {
    f: [2, -2, ['bb...', '.bbbb', '..bss', '....b']], s: [8, -2, ['ss...', '.sbbb', '...sS', '...bb']],
    tipF: [2, -2, ['bb..', '.bbb', '..bs']], tipS: [8, -2, ['bb...', '.bbbb']],
  }),
  cold: Ear('Frusna', 'Former', {
    f: [6, -1, ['b', 's', 'b']], s: [11, -1, ['bb', 'sS', 'bb']],
    // rödfärgade av kylan
    after: (R) => { if (R.side) tintRect(R, 11, R.eyeRow - 1, 2, 3, 0xe03a3a, 0.35); else { tintRect(R, 6, R.eyeRow - 1, 1, 3, 0xe03a3a, 0.35); tintRect(R, 17, R.eyeRow - 1, 1, 3, 0xe03a3a, 0.35); } },
  }),
};
