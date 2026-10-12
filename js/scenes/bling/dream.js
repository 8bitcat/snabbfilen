// Strykmärkena, pärlorna, berlockerna och mobilskalen i BLING BLING (js/scenes/shop-bling.js) – från Pixelskolans
// butik DREAM LAND (Carl 2026-10-12: "att man själv får sätta märken … designa halsbandet pärla för pärla och sätta på
// iron on patches på väskan, eller sina vanliga kläder" + "designa mobilskal"). Här finns bilderna och sortimentet:
// märkena (broderade, med kantsöm som riktiga strykmärken), pärlorna, plaggen man stryker märken på, pärlhalsbandet på
// bysten, berlockerna och mobilen. Dialogerna ligger i butiken; figuren ritar märkena, pärlorna och mobilen själv
// (people.js decorate: look.patches / look.beads / look.mobil – avatar.js cleanLook behåller dem).
// Källan är Pixelskolans dream.js (D:\GamesProjects\pixelskolan) – håll dem lika om något ändras i bilderna.
import { Pix, SMALL, BIG, textW, eachTextPixel, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { $t } from '../../core/i18n.js';

// Priserna: dubbla Pixelskolans (Carl 2026-10-11, samma som resten av BLING BLING – Pixelcitys löner är högre)
const PRIS = 2;

const hexOf = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const toInt = (h, fb = 0x888888) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : fb);

// ---------- märkena: motiv i pixlar (färgerna i C), kantsömmen och konturen läggs på av patchImg ----------
const C = { k: 0x2a2230, w: 0xffffff, W: 0xe4e6ee, s: 0xa8b0bc, S: 0x6a7280, r: 0xe8394f, R: 0xa8203a, p: 0xffb8d8, P: 0xf07ab0, m: 0xc83a7a,
  o: 0xf0902e, y: 0xffe066, Y: 0xe8b84a, g: 0x5cc070, G: 0x2e8a4a, l: 0xb8e070, b: 0x3a7bd5, B: 0x1d4a9a, c: 0x9ad8f8, v: 0xa070e0, V: 0xd8c0f8,
  n: 0x8a5a30, N: 0xc8905a, t: 0xf6d2b0, e: 0xffd8c0, x: 0xfff0f6 };
const MOTIF = {
  hjarta: ['.PPP...PPP.', 'PppPP.PPPPP', 'PpPPPPPPPPP', 'PPPPPPPPPPP', 'PPPPPPPPPPm', '.PPPPPPPPm.', '..PPPPPPm..', '...PPPPm...', '....PPm....', '.....m.....'],
  regnbage: ['....rrrrr....', '..rrooooorr..', '.rooyyyyyoor.', '.roygggggyor.', 'roygbbbbbgyor', 'roygb...bgyor', 'wwwwb...bwwww', '.wwww...wwww.', '..ww.....ww..'],
  stjarna: ['.....y.....', '....yyy....', '....yyy....', 'yyyyyyyyyyy', '.yyyywyyyy.', '..yyyyyyY..', '..yyyyyyY..', '.yyyyYyyyY.', '.yyY...yYY.', 'yY.......YY'],
  blixt: ['....yyyy', '...yyyY.', '..yyyY..', '.yyyY...', 'yyyyyyyY', '...yyyY.', '...yyY..', '..yyY...', '..yY....', '.yY.....', '.Y......'],
  smiley: ['...yyyy...', '.yyyyyyyy.', '.ywyyyyyy.', 'yyykyykyyy', 'yyykyykyyy', 'yyyyyyyyyy', 'ykyyyyyyky', 'yykkkkkkyy', '.yyyyyyyY.', '...yyyY...'],
  blomma: ['....www....', '.ww.wWw.ww.', '.wwwwwwwww.', '..wwyyyww..', 'wwwyyyyywww', 'wwwyyoyywWw', 'wwwyyyyywww', '..wwyyyww..', '.wwwwwwwww.', '.ww.wWw.ww.', '....www....'],
  ros: ['..rrrrr...', '.rRrrrRr..', 'rrRRrRRrr.', 'rRrrRrrRr.', 'rrRrrrRrr.', '.rrRRRrr..', '..rrrrr...', '....G.....', '.gg.G.gg..', '..ggGgg...', '....G.....'],
  korsbar: ['......ggg..', '.....gGg...', '....G..G...', '...G....G..', '..G.....G..', '.rr.....rr.', 'rwrr...rwrr', 'rrrr...rrrr', 'RrrR...RrrR', '.RR.....RR.'],
  jordgubbe: ['...ggg...', '.ggGgGgg.', '.rrgggrr.', 'rryrrryrr', 'rrrrrrrrr', 'rrrryrrrr', '.ryrrrry.', '.rrrrrrr.', '..rryrr..', '...rrr...', '....R....'],
  glass: ['...rr...', '..PPPP..', '.PPpPPP.', 'PPPPPPPP', 'PbPPPyPP', 'PPPPPPPP', 'NNNNNNNN', '.NnNnNN.', '.NNnNnN.', '..NnNN..', '..NNnN..', '...NN...'],
  munk: ['...NNNNN...', '.NNPPPPPNN.', '.NPPyPPbPN.', 'NPrPPPPPyPN', 'NPPP...PPPN', 'NPbP...PrPN', 'NPPP...PPPN', 'NPyPPPPPPbN', '.NPPPrPPPN.', '.NNPPPPPNN.', '...NNNNN...'],
  cupcake: ['....rr....', '...pPPp...', '..pPPPPp..', '.pPPyPPPp.', 'pPPPPPbPPp', 'PPPPPPPPPP', '.VvVvVvVv.', '.VvVvVvVv.', '..VvVvVv..', '..VvVvVv..'],
  fjaril: ['....k..k....', '.PPP.kk.PPP.', 'PpyPPkkPPypP', 'PppPPkkPPppP', 'PPPPPkkPPPPP', '.PPPPkkPPPP.', '..VVVkkVVV..', '.VVvVkkVvVV.', '.VVVV..VVVV.', '..VV....VV..'],
  flamingo: ['.PPP.....', 'PPkPPw...', 'PP...k...', '.PP......', '..PP.....', '..PP.....', '.PPPPPP..', 'PPPPPPPPP', '.PpPPPPPP', '..PPPPPP.', '....n....', '....n....', '...nn....'],
  katt: ['ww.......ww', 'wpw.....wpw', 'wwwwwwwwwww', 'wwwwwwwwwww', 'wwkwwwwwkww', 'wwwwwPwwwww', 'wwwwkwkwwww', 'wwwwwwwwwww', '.wwwwwwwww.', '..wwwwwww..'],
  nalle: ['.NN.....NN.', 'NeNNNNNNNeN', 'NNNNNNNNNNN', '.NNkNNNkNN.', '.NNNeeeNNN.', '.NNeekeeNN.', '.NNNeeeNNN.', '..NNNNNNN..', '.NNNNPNNNN.', 'NNNNNNNNNNN', '.NN.....NN.'],
  kanin: ['.ww...ww.', '.wp...pw.', '.wp...pw.', '.wp...pw.', '.ww...ww.', '.wwwwwww.', 'wwwwwwwww', 'wwkwwwkww', 'wpwwPwwpw', 'wwwwkwwww', '.wwwwwww.', '..wwwww..'],
  planet: ['....PPPP....', '...PpPPPP...', '..PPPPPPPP..', 'cccPPPPPPccc', '.cccccccccc.', '..PPPPPPPP..', '...PPPPPP...', '....PPPP....'],
  raket: ['...rr...', '..rrrr..', '..wwww..', '.wwwwww.', '.wwbbww.', '.wbccbw.', '.wwbbww.', '.wwwwww.', 'rwwwwwwr', 'rrwwwwrr', 'r.oyyo.r', '..oyyo..', '...oo...'],
  sol: ['.....yy.....', '.y...yy...y.', '..y.oooo.y..', '...oyyyyo...', 'yyoyyyyyyoyy', 'yyoyyyyyyoyy', '...oyyyyo...', '..y.oooo.y..', '.y...yy...y.', '.....yy.....'],
  svamp: ['...rrrrr...', '.rrwrrrwrr.', 'rrrrrrrrrrr', 'rwrrrwrrrwr', 'rrrrrrrrrrr', '..eeeeeee..', '...wwwww...', '...wwwww...', '...wwwww...', '..wwwwwww..'],
  fred: ['...vvvvv...', '.vvxxvxxvv.', '.vxxxvxxxv.', 'vxxxxvxxxxv', 'vxxxxvxxxxv', 'vxxxxvxxxxv', 'vxxxvvvxxxv', 'vxxvxvxvxxv', '.vvxxvxxvv.', '.vvxxvxxvv.', '...vvvvv...'],
  lappar: ['..rrr..rrr..', '.rwrrrrrrrr.', 'rrrrrrrrrrrr', 'RRRRRRRRRRRR', '.rrrrrrrrrr.', '..rrrrrrrr..', '....rrrr....'],
  rosett: ['PP........PP', 'PpPP....PPpP', 'PppPPmmPPppP', 'PpppPmmPpppP', 'PppPPmmPPppP', 'PpPP.mm.PPpP', 'PP..m..m..PP', '...m....m...'],
  disco: ['...WsWs...', '.WsWsWsWs.', '.sWwWsWsW.', 'WsWsWsWsWs', 'sWsWsWsWsW', 'WsWsWsWsWs', 'sWsWsWsWsS', '.WsWsWsWS.', '.sWsWsWSS.', '...WsSS...'],
};
for (const [k, rows] of Object.entries(MOTIF)) if (rows.some((r) => r.length !== rows[0].length)) console.warn(`[dream] motivet ${k}: raderna är olika långa`);

// ordmärken (rundad platta + text) och bokstäver/siffror (rund collegemärke)
function textMotif(word, bg, fg) {
  const w = textW(SMALL, word) + 4, h = 9, rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ((x === 0 || x === w - 1) && (y === 0 || y === h - 1) ? '.' : 'B')));
  eachTextPixel(SMALL, word, 2, 2, 1, (x, y) => { if (rows[y]?.[x]) rows[y][x] = 'F'; });
  return { rows: rows.map((r) => r.join('')), pal: { B: bg, F: fg } };
}
function letterMotif(ch, bg, fg) {
  const n = 13, r = 6, rows = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => ((x - r) ** 2 + (y - r) ** 2 <= r * r + 2 ? 'B' : '.')));
  const lw = textW(BIG, ch), lx = r - (lw >> 1), up = BIG[ch]?.up?.length || 0, ly = 3 + Math.ceil(up / 2);
  const px = []; eachTextPixel(BIG, ch, lx, ly, 1, (x, y) => px.push([x, y]));
  for (const [x, y] of px) if (rows[y + 1]?.[x + 1] === 'B') rows[y + 1][x + 1] = 'D';   // skuggan snett nedanför
  for (const [x, y] of px) if (rows[y]?.[x]) rows[y][x] = 'F';
  return { rows: rows.map((rr) => rr.join('')), pal: { B: bg, F: fg, D: mul(bg, 0.62) } };
}

// ---------- sortimentet (kategorier som Dream Lands: Bästsäljare, Crush, Djur … och bokstäver) ----------
export const PATCH_CATS = [
  { id: 'best', label: $t('⭐ Bästsäljare') }, { id: 'crush', label: $t('💗 Crush') }, { id: 'djur', label: $t('🐾 Djur') }, { id: 'godis', label: $t('🍩 Godis') },
  { id: 'natur', label: $t('🌈 Natur & rymd') }, { id: 'glitter', label: $t('✨ Glitter') }, { id: 'ord', label: $t('💬 Ord') }, { id: 'abc', label: $t('🔤 ABC') },
];
const M = (id, name, price, cats, o = {}) => ({ id, name, price: price * PRIS, cats, art: o.art || id, ...o });
const LIST = [
  M('hjarta', $t('Hjärta'), 20, ['best', 'crush']), M('regnbage', $t('Regnbåge'), 30, ['best', 'natur']), M('stjarna', $t('Stjärna'), 20, ['natur']),
  M('blixt', $t('Blixt'), 20, ['natur']), M('smiley', $t('Smiley'), 20, ['best']), M('blomma', $t('Prästkrage'), 20, ['natur']),
  M('ros', $t('Ros'), 25, ['crush', 'natur']), M('korsbar', $t('Körsbär'), 20, ['godis', 'crush']), M('jordgubbe', $t('Jordgubbe'), 20, ['best', 'godis']),
  M('glass', $t('Glass'), 25, ['godis']), M('munk', $t('Munk'), 25, ['godis']), M('cupcake', $t('Cupcake'), 25, ['godis']),
  M('fjaril', $t('Fjäril'), 30, ['best', 'djur']), M('flamingo', $t('Flamingo'), 30, ['djur']), M('katt', $t('Katt'), 25, ['djur'], { edge: 0xffb8d8 }),
  M('nalle', $t('Nalle'), 25, ['best', 'djur']), M('kanin', $t('Kanin'), 25, ['djur'], { edge: 0xffb8d8 }), M('planet', $t('Planet'), 25, ['natur']),
  M('raket', $t('Raket'), 30, ['natur']), M('sol', $t('Sol'), 20, ['natur']), M('svamp', $t('Svamp'), 20, ['natur']), M('fred', $t('Fredsmärke'), 20, ['ord']),
  M('lappar', $t('Läppar'), 20, ['crush']), M('rosett', $t('Rosett'), 20, ['crush']), M('disco', $t('Discokula'), 40, ['glitter'], { glitter: true }),
  M('g-hjarta', $t('Glitterhjärta'), 40, ['glitter', 'crush'], { art: 'hjarta', glitter: true }),
  M('g-stjarna', $t('Guldstjärna'), 40, ['glitter', 'best'], { art: 'stjarna', glitter: true, recolor: { y: 0xf2c14e, Y: 0xb9862a, w: 0xfff6c0 } }),
  M('g-smiley', $t('Glittersmiley'), 40, ['glitter'], { art: 'smiley', glitter: true }),
  M('g-blixt', $t('Silverblixt'), 40, ['glitter'], { art: 'blixt', glitter: true, recolor: { y: 0xe4e8f0, Y: 0x9aa2ac } }),
  ...[['LOVE', 0xf07ab0, 0xffffff], ['GIRL', 0xd8c0f8, 0xc83a7a], ['BFF', 0xffe066, 0xc83a7a], ['WOW', 0x9ad8f8, 0x1d4a9a], ['COOL', 0x3a7bd5, 0xffffff], ['QUEEN', 0xe8b84a, 0x2a2230]]
    .map(([w, bg, fg]) => M('t-' + w.toLowerCase(), w, 25, w === 'LOVE' ? ['ord', 'crush', 'best'] : ['ord'], { text: [w, bg, fg] })),
  ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789'].map((ch, i) => {
    const bg = [0xe8394f, 0xf07ab0, 0xa070e0, 0x3a7bd5, 0x2a9a8a, 0x5cc070, 0xf0902e][i % 7];
    return M('l-' + 'abcdefghijklmnopqrstuvwxyzaao0123456789'[i] + (ch === 'Å' ? '1' : ch === 'Ä' ? '2' : ch === 'Ö' ? '3' : ''), /\d/.test(ch) ? $t`Siffran ${ch}` : $t`Bokstaven ${ch}`, 10, ['abc'], { letter: [ch, bg, 0xffffff] });
  }),
];
export const PATCHES = LIST;
export const PATCH_BY = Object.fromEntries(LIST.map((p) => [p.id, p]));

function motifOf(p) {
  if (p.text) { const t = textMotif(...p.text); return { rows: t.rows, pal: { ...C, ...t.pal } }; }
  if (p.letter) { const t = letterMotif(...p.letter); return { rows: t.rows, pal: { ...C, ...t.pal } }; }
  return { rows: MOTIF[p.art], pal: { ...C, ...(p.recolor || {}) } };
}
// Märket som bild (1×): motivet med broderiets stygn, kantsöm runt om (edge) och mörk kontur. Glittermärken får
// paljetter (varannan pixel ljusare). Bilden sparas – samma canvas används överallt.
const IMG = new Map();
export function patchImg(id) {
  if (IMG.has(id)) return IMG.get(id);
  const p = PATCH_BY[id]; if (!p) return null;
  const { rows, pal } = motifOf(p), w = rows[0].length + 4, h = rows.length + 4, P = new Pix(w, h);
  const on = (i, j) => (rows[j - 2]?.[i - 2] ?? '.') !== '.';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!on(i, j)) continue;
    let c = pal[rows[j - 2][i - 2]] ?? 0xff00ff;
    c = p.glitter ? ((i + j) % 2 ? mix(c, 0xffffff, 0.42) : mul(c, 0.94)) : mix(c, j % 2 ? 0xffffff : 0x000000, 0.05);   // paljetter / stygnrader
    P.px(i, j, c);
  }
  const edge = p.edge ?? (p.letter || p.text ? 0xffffff : 0xfff8f0), near = (i, j, d) => { for (let y = -d; y <= d; y++) for (let x = -d; x <= d; x++) if (on(i + x, j + y)) return true; return false; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!on(i, j) && near(i, j, 1)) P.px(i, j, (i + j) % 2 ? edge : mul(edge, 0.9));
  const filled = (i, j) => P.d[(j * w + i) * 4 + 3] > 0;
  const out = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!filled(i, j) && ((i > 0 && filled(i - 1, j)) || (i < w - 1 && filled(i + 1, j)) || (j > 0 && filled(i, j - 1)) || (j < h - 1 && filled(i, j + 1)))) out.push([i, j]);
  for (const [i, j] of out) P.px(i, j, 0x4a3048);
  const img = P.flush(); IMG.set(id, img); return img;
}
// Märkets två vanligaste färger: så ser det ut på figuren (2 × 2 pixlar)
export function patchColors(id) {
  const p = PATCH_BY[id]; if (!p) return ['#ffffff', '#ffffff'];
  const { rows, pal } = motifOf(p), n = new Map();
  for (const r of rows) for (const ch of r) if (ch !== '.') n.set(ch, (n.get(ch) || 0) + 1);
  const top = [...n.entries()].sort((a, b) => b[1] - a[1]).map(([ch]) => pal[ch]);
  return [hexOf(top[0] ?? 0xffffff), hexOf(top[1] ?? top[0] ?? 0xffffff)];
}

// ---------- plaggen man stryker märken på (96 × 72) och ytan märkena får sitta på ----------
// Väskan ritas av butiken (bling.js drawBag); här finns tröjan och byxorna/kjolen i figurens egna färger.
const bgArt = (P, a = 0xfbe6ef, b = 0xf3d6e6) => { for (let y = 0; y < 72; y++) for (let x = 0; x < 96; x++) P.px(x, y, mix(a, b, y / 72 + (bayer(x, y) - 0.5) * 0.06)); P.ell(48, 30, 42, 30, 0xffffff, 0.35, 5); };
function inPoly(x, y, pts) { let o = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o; } return o; }
function shade(P, inside, base, x0, x1) {
  const lite = mix(base, 0xffffff, 0.3), dark = mul(base, 0.74), line = mul(base, 0.5);
  for (let y = 0; y < 72; y++) for (let x = 0; x < 96; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
    P.px(x, y, edge ? line : x < x0 + 3 ? lite : x > x1 - 4 ? dark : base);
  }
}
export function garmentArt(area, look) {
  const P = new Pix(96, 72); bgArt(P);
  if (area === 'top') {
    const base = toInt(look.shirt, 0x3a7bd5), acc = toInt(look.accent, 0xf4f1ea), tank = /tank|linne/i.test(look.top || ''), hood = /hood/i.test(look.top || '');
    const body = [[30, 12], [66, 12], [66, 68], [30, 68]];
    const sl = tank ? null : [[[30, 12], [14, 22], [10, 34], [22, 38], [30, 26]], [[66, 12], [82, 22], [86, 34], [74, 38], [66, 26]]];
    if (hood) shade(P, (x, y) => ((x - 48) / 13) ** 2 + ((y - 12) / 9) ** 2 <= 1 && y < 14, mul(base, 0.85), 35, 61);
    shade(P, (x, y) => inPoly(x, y, body) || (sl && (inPoly(x, y, sl[0]) || inPoly(x, y, sl[1]))), base, 10, 86);
    for (let x = 0; x < 96; x++) for (let y = 0; y < 72; y++) { const e = ((x + 0.5 - 48) / 9) ** 2 + ((y + 0.5 - 11) / 5) ** 2; if (e <= 1) P.px(x, y, e < 0.55 ? mul(base, 0.45) : acc); }   // halsringningen
    for (let y = 22; y < 68; y += 7) P.px(34 + (y % 3), y, mul(base, 0.85));   // veck
    if (hood) { P.rect(38, 50, 20, 10, mul(base, 0.88)); P.hl(38, 50, 20, mul(base, 0.6)); }
    return { canvas: P.flush(), zone: [33, 18, 63, 64] };
  }
  const base = toInt(look.pants, 0x2d3a5c), skirt = /skirt|kjol|dress|tutu/i.test(look.bottom || '');
  if (skirt) {
    shade(P, (x, y) => y >= 10 && y <= 54 && Math.abs(x - 48) <= 18 + (y - 10) * 0.3, base, 18, 78);
    for (let x = 30; x < 67; x++) { P.px(x, 10, mul(base, 0.6)); P.px(x, 11, mul(base, 0.8)); }
    for (let k = 0; k < 6; k++) P.line(36 + k * 5, 14, 30 + k * 7, 52, mul(base, 0.85));
    return { canvas: P.flush(), zone: [27, 13, 69, 52] };
  }
  const legs = (x, y) => y >= 8 && y <= 68 && ((x >= 28 + (y - 8) * 0.04 && x <= 47) || (x >= 49 && x <= 68 - (y - 8) * 0.04) || (y < 26 && x >= 28 && x <= 68));
  shade(P, legs, base, 28, 68);
  for (let x = 28; x <= 68; x++) for (let y = 8; y < 12; y++) P.px(x, y, y === 8 ? mix(base, 0xffffff, 0.2) : mul(base, 0.78));   // linningen
  for (const lx of [33, 48, 63]) P.rect(lx, 8, 2, 4, mul(base, 0.6));                                                          // hällorna
  P.rect(47, 9, 2, 2, 0xc9b27a); P.vl(48, 12, 12, mul(base, 0.6));                                                             // knapp och gylf
  P.line(30, 14, 37, 20, mul(base, 0.62)); P.line(66, 14, 59, 20, mul(base, 0.62));                                             // fickorna
  return { canvas: P.flush(), zone: [29, 12, 67, 66] };
}

// ---------- pärlorna: glas, pärlemor och metall, kristaller, former och bokstavspärlor ----------
export const BEAD_CATS = [{ id: 'glas', label: $t('Glaspärlor') }, { id: 'parlemor', label: $t('Pärlemor & metall') }, { id: 'kristall', label: $t('✨ Kristaller') }, { id: 'form', label: $t('💗 Former') }, { id: 'abc', label: $t('🔤 Bokstäver') }];
const B = (id, name, cat, price, kind, c, c2) => ({ id, name, cat, price: price * PRIS, kind, c, c2 });
const GLAS = [['rod', $t('Röd'), 0xe8394f], ['orange', $t('Orange'), 0xf0902e], ['gul', $t('Gul'), 0xf6d02f], ['lime', $t('Limegrön'), 0xa8d84a], ['gron', $t('Grön'), 0x3fae5a], ['turkos', $t('Turkos'), 0x2ab0b0],
  ['ljusbla', $t('Ljusblå'), 0x7fc8f0], ['bla', $t('Blå'), 0x3a6ad5], ['lila', $t('Lila'), 0x9a62d8], ['rosa', $t('Rosa'), 0xf07ab0], ['vit', $t('Vit'), 0xf4f4f6], ['svart', $t('Svart'), 0x2a2830]];
export const BEADS = [
  ...GLAS.map(([k, n, c]) => B('g-' + k, n, 'glas', 5, 'round', c)),
  B('parla', $t('Vit pärla'), 'parlemor', 10, 'round', 0xf6f0e6), B('parla-rosa', $t('Rosa pärla'), 'parlemor', 10, 'round', 0xf8d6dc),
  B('guld', $t('Guldpärla'), 'parlemor', 15, 'metal', 0xe8b84a), B('silver', $t('Silverpärla'), 'parlemor', 12, 'metal', 0xc8d0da),
  B('k-klar', $t('Kristall'), 'kristall', 20, 'crystal', 0xe8f6ff), B('k-rosa', $t('Rosa kristall'), 'kristall', 20, 'crystal', 0xffb8d8),
  B('k-lila', $t('Lila kristall'), 'kristall', 20, 'crystal', 0xc8a8f0), B('k-bla', $t('Blå kristall'), 'kristall', 20, 'crystal', 0x9ad8f8),
  B('f-hjarta', $t('Rött hjärta'), 'form', 8, 'heart', 0xe8394f), B('f-hjarta-rosa', $t('Rosa hjärta'), 'form', 8, 'heart', 0xf07ab0),
  B('f-stjarna', $t('Stjärna'), 'form', 8, 'star', 0xf6d02f), B('f-blomma', $t('Blomma'), 'form', 8, 'flower', 0xf8a4c8, 0xf6d02f),
  B('f-blomma-vit', $t('Vit blomma'), 'form', 8, 'flower', 0xffffff, 0xf6d02f), B('f-smiley', $t('Smiley'), 'form', 10, 'smiley', 0xf6d02f),
  ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'].map((ch, i) => ({ ...B('b-' + i, ch, 'abc', 6, 'letter', 0xffffff), ch })),
];
export const BEAD_BY = Object.fromEntries(BEADS.map((b) => [b.id, b]));
export const beadW = (b) => (b && b.kind === 'letter' ? 7 : 5);
export const beadColor = (b) => hexOf(b.kind === 'letter' ? 0xf4f4f6 : b.c);
const SHAPE = {
  round: ['.HBB.', 'HWBBL', 'HBBBL', 'BBBLL', '.LLL.'],
  metal: ['.HBB.', 'HWHBL', 'HBBBL', 'BBBLL', '.LLL.'],
  crystal: ['..H..', '.HWB.', 'HBWBL', '.BLL.', '..L..'],
  heart: ['HB.BB', 'BWBBB', 'BBBBL', '.BBL.', '..L..'],
  star: ['..B..', '.BWB.', 'BBBBB', '.BBL.', '.B.L.'],
  flower: ['.B.B.', 'BBYBB', '.YYY.', 'BBYBB', '.B.L.'],
  smiley: ['.BBB.', 'BkBkB', 'BBBBB', 'BkkkB', '.BBB.'],
};
// pärlan i (x, y) = övre vänstra hörnet; bokstavspärlan är en vit kub (7 × 7) med bokstaven
export function drawBead(P, b, x, y) {
  if (b.kind === 'letter') {
    P.rect(x, y, 7, 7, 0xf8f8fa); P.hl(x, y, 7, 0xffffff); P.vl(x + 6, y + 1, 6, 0xc8ccd6); P.hl(x + 1, y + 6, 6, 0xb8bcc8);
    const F = SMALL, w = textW(F, b.ch); eachTextPixel(F, b.ch, x + 3 - (w >> 1) + (w >= 4 ? 0 : 0), y + 1, 1, (px, py) => P.px(Math.min(px, x + 5), py, 0x2a2230));
    return;
  }
  const c = b.c, pal = { H: mix(c, 0xffffff, 0.5), B: c, L: mul(c, b.kind === 'metal' ? 0.66 : 0.74), W: 0xffffff, Y: b.c2 ?? 0xf6d02f, k: 0x2a2230 };
  SHAPE[b.kind].forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P.px(x + i, y + j, pal[ch]); }));
}
export const LENGTHS = [['kort', $t('Kort'), 12], ['mellan', $t('Mellan'), 16], ['lang', $t('Lång'), 20]];
export const TRAD = [['klar', $t('Genomskinlig tråd'), 0, 0xdce6f0], ['silver', $t('Silverkedja'), 30, 0xc8d0da], ['guld', $t('Guldkedja'), 60, 0xe8b84a]].map(([id, n, pr, c]) => [id, n, pr * PRIS, c]);

// Pärlhalsbandet på bysten (128 × 88): tråden och pärlorna i ordning. slots = var varje pärla sitter (för klick).
export function drawBeadNecklace(st, selIdx = -1, blink = false) {
  const W = 128, H = 88, P = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(0xfbe6ef, 0xf1cde0, y / H + (bayer(x, y) - 0.5) * 0.06));
  P.ell(64, 28, 58, 40, 0xffffff, 0.35, 5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // sammetsbysten
    const neck = Math.abs(x - 64) <= 13 && y < 44, sh = y >= 38 && Math.abs(x - 64) <= 13 + (y - 38) * 2.1 + Math.sqrt(Math.max(0, y - 38)) * 3;
    if (neck || sh) P.px(x, y, x - 64 < -5 - (y > 38 ? (y - 38) * 0.8 : 0) ? 0x3a3c78 : 0x23244f);
  }
  // tråden: en båge från axlarna (där bysten börjar) och ner över bröstet – längre halsband hänger lägre
  const n = LENGTHS.find((l) => l[0] === st.len)?.[2] || 16, sag = n <= 12 ? 18 : n <= 16 ? 28 : 40, half = n <= 12 ? 24 : n <= 16 ? 25 : 26, y0 = 42;
  const pts = []; for (let t = 0; t <= 600; t++) { const u = (t / 600) * 2 - 1; pts.push([64 + half * u, y0 + sag * (1 - u * u)]); }
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (s) => { let i = len.findIndex((v) => v >= s); if (i < 0) i = len.length - 1; return pts[i]; };
  const trad = TRAD.find((t) => t[0] === st.trad) || TRAD[0];
  for (const [x, y] of pts) P.px(Math.round(x), Math.round(y), trad[3]);
  const beads = st.beads.slice(0, n), widths = beads.map((id) => beadW(BEAD_BY[id]) + 1), total = widths.reduce((a, b) => a + b, 0);
  const L = len[len.length - 1], k = Math.min(1, (L - 2) / Math.max(1, total));   // trångt: pärlorna skjuts ihop
  let s = (L - total * k) / 2;
  const slots = [];
  beads.forEach((id, i) => {
    const w = widths[i] * k, [cx, cy] = at(s + w / 2), b = BEAD_BY[id], bw = beadW(b), bh = b && b.kind === 'letter' ? 7 : 5;
    const x = Math.round(cx - bw / 2), y = Math.round(cy - bh / 2);
    if (b) drawBead(P, b, x, y); else { P.px(Math.round(cx), Math.round(cy), 0x9aa2ac); P.px(Math.round(cx) - 1, Math.round(cy), 0xd8dce4); P.px(Math.round(cx) + 1, Math.round(cy), 0xd8dce4); }
    if (i === selIdx) { const c = blink ? 0xffffff : 0xf07ab0; P.box(x - 2, y - 2, bw + 4, bh + 4, c); }
    slots.push({ x: cx, y: cy, w: bw + 2 });
    s += w;
  });
  return { canvas: P.flush(), slots, w: W, h: H };
}

// ---------- mobilskalen: skalen, berlockerna (blanka 3D-figurer som Dream Lands) och mobilbanden ----------
// Berlockerna är egna bilder: samma motiv som märkena men emaljblanka (ljus kant uppe/vänster, mörk nere/höger,
// kontur och skugga), glitterstenar med fasetter, figurer och tjocka bokstäver.
const CH_MOTIF = {
  dino: ['......wwwwww', '......wkwwww', '......wwwwww', '......www...', '......wwwww.', 'w....wwww...', 'ww..wwwwww..', 'wwwwwwwww...', '.wwwwwww....', '..wwwww.....', '...ww.ww....', '...w...w....'],
  alien: ['..gggggg..', '.gggggggg.', 'gggggggggg', 'gkkggggkkg', 'gkkkggkkkg', 'ggkkggkkgg', 'gggggggggg', '.gggggggg.', '..ggGGgg..', '...gggg...', '....gg....'],
  spoke: ['...wwww...', '.wwwwwwww.', '.wwwwwwww.', 'wwkwwwwkww', 'wwkwwwwkww', 'wpwwkkwwpw', 'wwwwkkwwww', 'wwwwwwwwww', 'wwwwwwwwww', '.ww.ww.ww.'],
  groda: ['.ggg....ggg.', 'gwkwg..gwkwg', 'gggggggggggg', 'gggggggggggg', 'gpggggggggpg', 'ggkkkkkkkkgg', '.gggggggggg.', '..gggggggg..'],
};
for (const [k, rows] of Object.entries(CH_MOTIF)) if (rows.some((r) => r.length !== rows[0].length)) console.warn(`[dream] berlocken ${k}: raderna är olika långa`);
const GEM = {
  diamant: ['..wabbbab..', '.aabbabbbc.', 'aaabbabbbcc', '.aabbbbbcc.', '..abbbbbc..', '...abbbc...', '....abc....', '.....b.....'],
  hjarta: ['.aaa..bbb.', 'awaabbbbbc', 'aaabbbbbcc', 'aabbbbbbcc', '.abbbbbcc.', '..abbbcc..', '...abcc...', '....bc....'],
  stjarna: ['.....a.....', '....aab....', '....abb....', 'aaaaabbbbbc', '.aaawbbbbc.', '..aabbbcc..', '..abbbbcc..', '.abbc.bbcc.', '.ac.....cc.', 'a.........c'],
  smaragd: ['.aaaaaa.', 'awabbbbc', 'aabbbbcc', 'aabbbbcc', 'aabbbbcc', 'aabbbbcc', 'aabbbbcc', 'aabbbbcc', '.cccccc.'],
  droppe: ['...a...', '..aab..', '..abb..', '.aabbc.', '.awbbc.', 'aabbbcc', 'aabbbcc', 'aabbbcc', '.abbcc.', '..bcc..'],
  rund: ['..aaabb..', '.awaabbc.', 'aaabbbbcc', 'aabbbbbcc', 'abbbbbbbc', 'abbbbbbcc', 'aabbbbccc', '.abbbccc.', '..bcccc..'],
};
for (const [k, rows] of Object.entries(GEM)) if (rows.some((r) => r.length !== rows[0].length)) console.warn(`[dream] stenen ${k}: raderna är olika långa`);
const GEMC = { rosa: [0xffd8ec, 0xf5a3c7, 0xd76a9a], iris: [0xffffff, 0xd8f0ff, 0xb8a8f0], turkos: [0xb8f4f0, 0x3ccfc8, 0x1a8a8a], lila: [0xd8c0ff, 0x9a62d8, 0x6a3aa8],
  hallon: [0xffb0c8, 0xe8306a, 0xa81848], gron: [0xb8f0c8, 0x3fbf6a, 0x23885a], svart: [0x6a6a7a, 0x2a2a34, 0x16161c], champagne: [0xfff0d0, 0xe8c890, 0xb8945a], klar: [0xffffff, 0xe8f2fa, 0xb8c8d8] };
export const CHARM_CATS = [
  { id: 'best', label: $t('⭐ Bästsäljare') }, { id: 'glitter', label: $t('💎 Glitter') }, { id: 'crush', label: $t('💗 Crush') }, { id: 'figur', label: $t('🐾 Figurer') },
  { id: 'godis', label: $t('🍩 Godis') }, { id: 'natur', label: $t('🌈 Natur & rymd') }, { id: 'abc', label: $t('🔤 Bokstäver') }, { id: 'num', label: $t('🔢 Siffror') },
];
const CHM = (id, name, price, cats, o = {}) => ({ id, name, price: price * PRIS, cats, ...o });
const PASTEL = [[0xf8b8d8, 0xd86a9a], [0xa8e8d0, 0x3aa880], [0xfff0a0, 0xd8a820], [0xd8c0f8, 0x8a62c8], [0xffc8a8, 0xd8784a], [0xb8dcff, 0x4a88d8]];
export const CHARMS = [
  CHM('c-hjarta', $t('Hjärta'), 15, ['best', 'crush'], { motif: 'hjarta' }), CHM('c-smiley', $t('Smiley'), 15, ['best', 'figur'], { motif: 'smiley' }),
  CHM('c-regnbage', $t('Regnbåge'), 15, ['best', 'natur'], { motif: 'regnbage' }), CHM('c-jordgubbe', $t('Jordgubbe'), 15, ['best', 'godis'], { motif: 'jordgubbe' }),
  CHM('c-dino', $t('Pixeldino'), 20, ['best', 'figur'], { motif: 'dino', ch: true }), CHM('c-alien', $t('Rymdvarelse'), 20, ['figur'], { motif: 'alien', ch: true }),
  CHM('c-spoke', $t('Spöke'), 20, ['figur'], { motif: 'spoke', ch: true }), CHM('c-groda', $t('Groda'), 20, ['figur'], { motif: 'groda', ch: true }),
  CHM('c-nalle', $t('Nalle'), 15, ['figur'], { motif: 'nalle' }), CHM('c-katt', $t('Katt'), 15, ['figur'], { motif: 'katt' }), CHM('c-kanin', $t('Kanin'), 15, ['figur'], { motif: 'kanin' }),
  CHM('c-flamingo', $t('Flamingo'), 15, ['figur'], { motif: 'flamingo' }), CHM('c-fjaril', $t('Fjäril'), 15, ['best', 'natur'], { motif: 'fjaril' }),
  CHM('c-glass', $t('Glass'), 15, ['godis'], { motif: 'glass' }), CHM('c-munk', $t('Munk'), 15, ['godis'], { motif: 'munk' }), CHM('c-cupcake', $t('Cupcake'), 15, ['godis'], { motif: 'cupcake' }),
  CHM('c-korsbar', $t('Körsbär'), 15, ['godis', 'crush'], { motif: 'korsbar' }), CHM('c-lappar', $t('Läppar'), 15, ['crush'], { motif: 'lappar' }), CHM('c-rosett', $t('Rosett'), 15, ['crush'], { motif: 'rosett' }),
  CHM('c-ros', $t('Ros'), 15, ['crush', 'natur'], { motif: 'ros' }), CHM('c-blomma', $t('Prästkrage'), 15, ['natur'], { motif: 'blomma' }), CHM('c-stjarna', $t('Stjärna'), 15, ['natur'], { motif: 'stjarna' }),
  CHM('c-blixt', $t('Blixt'), 15, ['natur'], { motif: 'blixt' }), CHM('c-planet', $t('Planet'), 15, ['natur'], { motif: 'planet' }), CHM('c-raket', $t('Raket'), 15, ['natur'], { motif: 'raket' }),
  CHM('c-svamp', $t('Svamp'), 15, ['natur'], { motif: 'svamp' }), CHM('c-sol', $t('Sol'), 15, ['natur'], { motif: 'sol' }), CHM('c-disco', $t('Discokula'), 20, ['glitter'], { motif: 'disco' }),
  ...[['diamant', 'rosa', $t('Rosa diamant')], ['stjarna', 'iris', $t('Regnbågsstjärna')], ['hjarta', 'iris', $t('Regnbågshjärta')], ['stjarna', 'rosa', $t('Rosa stjärnsten')], ['hjarta', 'hallon', $t('Hallonhjärta')],
    ['smaragd', 'lila', $t('Lila smaragd')], ['droppe', 'gron', $t('Grön droppe')], ['diamant', 'turkos', $t('Turkos diamant')], ['rund', 'lila', $t('Lila sten')], ['droppe', 'klar', $t('Kristalldroppe')],
    ['smaragd', 'svart', $t('Svart smaragd')], ['rund', 'champagne', $t('Champagnesten')], ['diamant', 'klar', $t('Klar diamant')], ['droppe', 'hallon', $t('Rosa droppe')]]
    .map(([g, c, n], i) => CHM(`c-${g}-${c}`, n, 20, i < 3 ? ['glitter', 'best'] : ['glitter'], { gem: g, gc: c })),
  ...[['LOVE', 0xf07ab0, 0xffffff], ['BFF', 0xf8b8d8, 0xc83a7a], ['QUEEN', 0xe8b84a, 0x2a2230], ['WOW', 0x9ad8f8, 0x1d4a9a]].map(([w, bg, fg]) => CHM('c-t-' + w.toLowerCase(), w, 20, ['crush'], { text: [w, bg, fg] })),
  ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'].map((ch, i) => CHM(`c-l-${i}`, $t`Bokstaven ${ch}`, 10, ['abc'], { big: ch, pc: PASTEL[i % PASTEL.length] })),
  ...[...'0123456789'].map((ch, i) => CHM(`c-n-${ch}`, $t`Siffran ${ch}`, 10, ['num'], { big: ch, pc: PASTEL[(i + 2) % PASTEL.length] })),
];
export const CHARM_BY = Object.fromEntries(CHARMS.map((c) => [c.id, c]));
// motivet som rader + färger (berlockerna lånar märkenas motiv; glitterstenarna har tre fasettfärger)
function charmCells(cm) {
  if (cm.gem) { const [a, b, c] = GEMC[cm.gc]; return { rows: GEM[cm.gem], pal: { a, b, c, w: 0xffffff }, gem: true }; }
  if (cm.text) { const t = textMotif(...cm.text); return { rows: t.rows, pal: { ...C, ...t.pal } }; }
  if (cm.big) {   // tjock bokstav: BIG dubbelt så stor, med en 3D-kant snett nedåt höger
    const [fill, side] = cm.pc, w = textW(BIG, cm.big) * 2 + 2, up = (BIG[cm.big]?.up?.length || 0) * 2, h = 14 + up + 2;
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    eachTextPixel(BIG, cm.big, 0, up, 2, (x, y) => { for (const d of [1, 2]) if (g[y + d]?.[x + d] === '.') g[y + d][x + d] = 'S'; });
    eachTextPixel(BIG, cm.big, 0, up, 2, (x, y) => { if (g[y]) g[y][x] = 'F'; });
    return { rows: g.map((r) => r.join('')), pal: { F: fill, S: side } };
  }
  return { rows: (cm.ch ? CH_MOTIF : MOTIF)[cm.motif], pal: C };
}
function colorsByCount(rows, pal) { const n = new Map(); for (const r of rows) for (const ch of r) if (ch !== '.') n.set(ch, (n.get(ch) || 0) + 1); return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([ch]) => pal[ch] ?? 0xffffff); }
const CIMG = new Map();
export function charmImg(id) {
  if (CIMG.has(id)) return CIMG.get(id);
  const cm = CHARM_BY[id]; if (!cm) return null;
  const { rows, pal, gem } = charmCells(cm), w = rows[0].length + 3, h = rows.length + 3, P = new Pix(w, h);
  const on = (i, j) => (rows[j]?.[i] ?? '.') !== '.';
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) if (on(i, j)) P.px(i + 2, j + 2, 0x000000, 0.28);   // skuggan
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) {
    if (!on(i, j)) continue;
    let c = pal[rows[j][i]] ?? 0xff00ff;
    if (!gem) { if (!on(i, j - 1) || !on(i - 1, j)) c = mix(c, 0xffffff, 0.38); else if (!on(i, j + 1) || !on(i + 1, j)) c = mul(c, 0.8); }   // emaljens glans
    P.px(i + 1, j + 1, c);
  }
  const main = colorsByCount(rows, pal)[0];
  for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= rows[0].length; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) P.px(i + 1, j + 1, gem ? mul(pal.c, 0.7) : mix(mul(main, 0.42), 0x2a1a30, 0.4));   // konturen
  const img = P.flush(); CIMG.set(id, img); return img;
}
export const charmColor = (id) => { const cm = CHARM_BY[id]; if (!cm) return '#ffffff'; const { rows, pal, gem } = charmCells(cm); return hexOf(gem ? pal.b : colorsByCount(rows, pal)[0]); };

export const CASES = [['rosa', $t('Sockervadd'), 60, 0xf07ab0], ['lila', $t('Lila dis'), 60, 0x9a74d8], ['svart', $t('Rymdsvart'), 60, 0x34323e], ['bla', $t('Himmelsblå'), 60, 0x6fb4e8],
  ['vit', $t('Molnvit'), 60, 0xdfe6f0], ['mint', $t('Mintgrön'), 60, 0x6fd0aa], ['glitter', $t('Glitterskal'), 80, 0xf0a0d0]].map(([id, n, pr, c]) => [id, n, pr * PRIS, c]);
export const STRAPS = [['inget', $t('Inget band'), 0, null], ['parlor', $t('Pärlband'), 40, 0xf6f0e6], ['regnbage', $t('Regnbågspärlor'), 40, 0xe8394f], ['hjarta', $t('Hjärtband'), 50, 0xf8a4c8], ['guld', $t('Guldkedja'), 60, 0xe8b84a]].map(([id, n, pr, c]) => [id, n, pr * PRIS, c]);
// Mobilen bakifrån med skalet (80 × 136): genomskinlig färg, kameraön, knapparna och mobilbandet under. zone = där berlockerna får sitta.
export function drawPhone(st) {
  const W = 80, H = 136, P = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(0xfbf6ee, 0xf3eadf, y / H + (bayer(x, y) - 0.5) * 0.05));
  const cs = CASES.find((c) => c[0] === st.case) || CASES[0], base = cs[3], x0 = 18, x1 = 62, y0 = 4, y1 = 100, r = 8;
  const inside = (x, y, inset = 0) => {
    const ax = x0 + inset, bx = x1 - inset, ay = y0 + inset, by = y1 - inset, rr = Math.max(1, r - inset);
    if (x < ax || x >= bx || y < ay || y >= by) return false;
    const cx = x < ax + rr ? ax + rr : x >= bx - rr ? bx - rr - 1 : x, cy = y < ay + rr ? ay + rr : y >= by - rr ? by - rr - 1 : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    let c = !inside(x, y, 3) ? (inside(x, y, 1) ? base : mul(base, 0.7)) : mix(base, 0xffffff, 0.6);
    if (inside(x, y, 3) && x > x0 + 6 && x < x0 + 10) c = mix(c, 0xffffff, 0.35);   // glansen i plasten
    if (st.case === 'glitter' && inside(x, y, 3) && hash(x, y, 31) > 0.86) c = hash(x, y, 32) > 0.5 ? 0xffffff : 0xffd8f0;
    if (!inside(x, y, 1) && x < x0 + 4) c = mix(base, 0xffffff, 0.25);
    P.px(x, y, c);
  }
  for (const by of [22, 34, 44]) P.rect(x1, by, 2, by === 22 ? 6 : 8, mul(base, 0.75));   // knapparna
  for (let y = 8; y < 32; y++) for (let x = 22; x < 42; x++) { const e = ((x - 31.5) / 10) ** 2 + ((y - 19.5) / 12) ** 2; if (e <= 1) P.px(x, y, e > 0.8 ? mul(base, 0.75) : 0x3a3a46); }   // kameraön
  for (const [cx, cy] of [[28, 15], [28, 25]]) { for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = x * x + y * y; if (d <= 10) P.px(cx + x, cy + y, d > 6 ? 0x16161c : d > 2 ? 0x2a3a5a : 0x5a7ab8); } P.px(cx - 1, cy - 1, 0xffffff); }
  P.rect(35, 13, 3, 3, 0xfff6c0);
  const sp = STRAPS.find((q) => q[0] === st.strap) || STRAPS[0];
  if (sp[3] != null) {   // mobilbandet: fästet, ringen och två pärlslingor
    P.rect(37, 100, 6, 4, mix(base, 0xffffff, 0.4)); P.box(37, 100, 6, 4, mul(base, 0.7));
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; P.px(Math.round(40 + Math.cos(t) * 4), Math.round(109 + Math.sin(t) * 4), sp[0] === 'guld' ? 0xe8b84a : 0xc8ccd6); }
    const RB = [0xe8394f, 0xf0902e, 0xf6d02f, 0x3fae5a, 0x3a6ad5, 0x9a62d8];
    for (const side of [-1, 1]) for (let k = 0; k < 8; k++) {
      const t = k / 7, x = Math.round(40 + side * (3 + t * 9)), y = Math.round(114 + t * 18);
      if (sp[0] === 'guld') { P.px(x, y, k % 2 ? 0xfff0b0 : 0xe8b84a); P.px(x, y + 1, 0xb9862a); continue; }
      const c = sp[0] === 'regnbage' ? RB[(k + (side > 0 ? 3 : 0)) % 6] : sp[0] === 'hjarta' ? (k % 2 ? 0xf8a4c8 : 0xffffff) : k % 3 === 2 ? 0xd8f0ff : 0xe8e4ea;
      P.rect(x - 1, y - 1, 3, 3, c); P.px(x - 1, y - 1, 0xffffff); P.px(x + 1, y + 1, mul(c, 0.7));
    }
    if (sp[0] === 'hjarta') ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') P.px(46 + i, 124 + j, j < 2 && i < 3 ? 0xffffff : mix(0xf8d0e8, 0xd8f0ff, (i + j) / 12)); }));
  }
  return { canvas: P.flush(), zone: [22, 10, 58, 96] };
}
