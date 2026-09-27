// Verktyg för de nya frisyrerna (hair-kort.js, hair-langt.js) och hårfärgseffekterna
// (hair-fx.js). Importerar bara från util.js. Se docs/PEOPLE-ARKITEKTUR.md.
import { SW, SH, mix } from './util.js';

// Deterministiskt brus 0–99 för struktur (lockar, rufs, stubb) – samma pixel ger alltid samma värde
export const nz = (x, y, s = 0) => {
  let h = (Math.imul(x + 11, 374761393) + Math.imul(y + 7, 668265263) + Math.imul(s + 3, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 100;
};

// Rakat/snaggat hår: hudton blandad med hårfärgen (a = ljus sida, b = skuggsida, f = nästan bar hud)
export const shaved = (R) => ({
  a: mix(R.hair.base, R.skin.base, 0.3),
  b: mix(R.hair.lo, R.skin.lo, 0.35),
  f: mix(R.hair.base, R.skin.base, 0.55),
  s: mix(R.skin.base, R.hair.base, 0.35), // stubb
});

// Hårsnodd (samma röda som i hair.js)
export const TIE = 0xc9323a;

// ---------- huvudbonader ----------
// Hatten ritas ovanpå håret. En hatt som täcker hjässan (keps, mössa, hög hatt, fiskehatt –
// och nya poster som täcker på samma sätt) provritas först, osynligt, så att vi vet var den
// hamnar. Sedan klipps frisyren: i hattens kolumner syns inget hår ovanför hattens överkant,
// och utanför hatten börjar håret först under brättet. Hårband, rosetter och kronor (som
// lägger sig ovanpå håret) täcker inte hjässan och klipper därför ingenting.
function hatClip(R) {
  if (!R.id || R.id.hat === 'none' || !R.E) return null;
  const E = R.E.hat, fn = E && E[R.view];
  if (!fn) return null;
  const m = new Uint8Array(SW * SH);
  const mark = (x, y) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < SW && y < SH) m[y * SW + x] = 1; };
  const P = Object.create(R);
  P.put = mark;
  P.rect = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mark(x + i, y + j); };
  P.pattern = P.each = P.draw = () => {};
  try { fn.call(E, P); } catch { return null; }
  const at = (x, y) => y >= 0 && y < SH && m[y * SW + x] === 1;
  const h0 = R.h0;
  if (!(at(12, h0 - 1) && at(R.side ? 8 : 7, h0) && at(16, h0))) return null; // täcker inte hjässan
  const top = new Int16Array(SW).fill(99), bot = new Int16Array(SW).fill(-1);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (m[y * SW + x]) { if (y < top[x]) top[x] = y; if (y > bot[x]) bot[x] = y; }
  let a = -1, b = -1;
  for (let x = 0; x < SW; x++) if (bot[x] >= 0) { if (a < 0) a = x; b = x; }
  const lim = new Int16Array(SW);
  for (let x = 0; x < SW; x++) lim[x] = bot[x] >= 0 ? top[x] : x < a ? bot[a] + 1 : x > b ? bot[b] + 1 : -99;
  const put = R.put;
  const C = Object.create(R);
  C.put = (x, y, c) => { if (x >= 0 && x < SW && y < lim[x]) return; put(x, y, c); };
  C.rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) C.put(x + i, y + j, c); };
  C.hatted = true;
  return C;
}

// Registerpost för en ny frisyr: vyfunktionerna körs med hattklippning.
// R.hatted är true i vyfunktionen när en täckande hatt sitter på (t.ex. för att flytta
// en hög knut ner till nacken).
const clip = (fn) => fn && function view(R, a) { fn(hatClip(R) || R, a); };
export const hs = (label, group, e) => ({ label, group, ...e, front: clip(e.front), back: clip(e.back), side: clip(e.side) });

// ---------- enkla ritverktyg ----------
// vågrät rad från x0 till x1 (inklusive)
export const row = (R, y, x0, x1, c) => { if (x1 >= x0) R.rect(x0, y, x1 - x0 + 1, 1, c); };
// lodrät kolumn från y0 till y1 (inklusive)
export const col = (R, x, y0, y1, c) => { if (y1 >= y0) R.rect(x, y0, 1, y1 - y0 + 1, c); };
// symmetrisk rad kring mitten (x 11|12) med halvbredden hw → x 12-hw … 11+hw
export const rowC = (R, y, hw, c) => { if (hw > 0) R.rect(12 - hw, y, hw * 2, 1, c); };
// Hårpixlarnas ljus: gör vänsterkanten ljus och högerkanten mörk på en rad (framifrån/bakifrån)
export const edges = (R, y, x0, x1) => { const H = R.hair; R.put(x0, y, H.hi); R.put(x1, y, H.lo); };

// Fläta: 2 px bred med flätmönster från y0 till y1 (inklusive), snodd + tofs i änden.
// xs(y) ger vänsterkolumnen för raden (för flätor som böjer sig). dark = skuggsidan.
export const plait = (R, xs, y0, y1, dark, tie = true) => {
  const { put, hair: H } = R;
  const A = dark ? [H.lo, H.dk] : [H.base, H.lo], B = dark ? [H.base, H.lo] : [H.hi, H.base];
  for (let y = y0; y <= y1; y++) { const x = xs(y), c = (y - y0) % 2 ? B : A; put(x, y, c[0]); put(x + 1, y, c[1]); }
  if (!tie) return;
  const xe = xs(y1);
  put(xe, y1 + 1, TIE); put(xe + 1, y1 + 1, TIE);
  put(xe + (dark ? 1 : 0), y1 + 2, H.base); put(xe + (dark ? 0 : 1), y1 + 2, H.lo);
};

// Lockstruktur: prickar ljus/mörk i redan ritat hår inom rektangeln (bara hårpixlar)
export const curlTex = (R, x0, y0, x1, y1, seed = 0, keep) => {
  const { put, get, hair: H } = R;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = get(x, y);
    if (c !== H.base && c !== H.lo) continue;
    if (keep && !keep(x, y)) continue;
    const n = nz(x, y, seed);
    if (n < 18) put(x, y, c === H.lo ? H.dk : H.lo);
    else if (n > 84) put(x, y, c === H.lo ? H.base : H.hi);
  }
};
