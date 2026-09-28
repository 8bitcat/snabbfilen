// Verktyg för frisyrerna (hair.js + hair-kort.js, hair-mellan.js, hair-lockar.js,
// hair-uppsatt.js) och hårfärgseffekterna (hair-fx.js). Importerar bara från util.js.
// Se docs/PEOPLE-ARKITEKTUR.md.
//
// Koordinater: spritens 24×40 i vyns egna koordinater (vänstervyn speglas av motorn).
// Framifrån: huvudet x 7–16, ögonen x 9/14 (barn 8–9/14–15), öronen x 6/17, mitten mellan
// x 11 och 12. Från sidan (ansiktet åt höger): huvudet x 8–16, örat x 11–12, pannan x 15–16.
// Ljuset kommer uppifrån vänster: ovankant till vänster = hi, högersida/bakkant = lo.
import { SW, SH, mix } from './util.js';

// ================= de gamla hjälparna (flyttade hit ur hair.js – oförändrade, pixellåsta) =================
// hårkalott: rows rader under hjässan
export const capF = (R, rows) => {
  const { rect, put, hair: H, h0 } = R;
  rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, rows, H.base);
  rect(9, h0 - 1, 3, 1, H.hi); rect(8, h0, 2, 1, H.hi);
  for (let j = 0; j < rows; j++) put(16, h0 + j, H.lo);
};
export const TIE = 0xc9323a; // hårsnodd
// fläta: 2 px bred, flätmönster, snodd + tofs i änden. xa bredvid ansiktet, xb nedanför hakan
export const braid = (R, xa, xb, y0, dark) => {
  const { put, rect, hair: H, h0, headH, K } = R;
  const braidEnd = h0 + headH + (K ? 2 : 4);
  const A = dark ? [H.lo, H.dk] : [H.base, H.lo], B = dark ? [H.base, H.lo] : [H.hi, H.base];
  for (let y = y0; y < braidEnd; y++) { const x = y < h0 + headH ? xa : xb, c = (y - y0) % 2 ? B : A; put(x, y, c[0]); put(x + 1, y, c[1]); }
  rect(xb, braidEnd, 2, 1, TIE); put(xb + (dark ? 1 : 0), braidEnd + 1, H.base); put(xb + (dark ? 0 : 1), braidEnd + 1, H.lo);
};
// tofs (råttsvans) på sidan av huvudet; x speglas med mx
export const TAIL = [[5], [4, 5], [3, 4, 5], [3, 4, 5], [3, 4], [3, 4], [4]];
export const tail = (R, mx, dark) => {
  const { put, hair: H, h0 } = R;
  TAIL.forEach((xs, j) => xs.forEach((x, i) => put(mx(x), h0 + j, j === TAIL.length - 1 ? H.lo : i === 0 && j > 1 ? (dark ? H.lo : H.hi) : dark ? H.lo : H.base)));
  put(mx(6), h0 + 1, TIE); put(mx(6), h0 + 2, TIE);
};
export const L2R = (x) => x, R2L = (x) => 23 - x;
// Standardnacken: hår ner till raden `bottom`; long = bredare (x 6–17)
export const backStd = (R, bottom, long) => {
  const { rect, put, hair: H, h0 } = R;
  rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, bottom - h0, H.base);
  if (long) rect(6, h0 + 1, 12, bottom - h0 - 1, H.base);
  rect(9, h0 - 1, 3, 1, H.hi); rect(8, h0, 3, 1, H.hi); put(8, h0 + 1, H.hi);
  for (let y = h0; y < bottom; y++) put(long ? 17 : 16, y, H.lo);
  rect(long ? 7 : 8, bottom - 1, long ? 10 : 8, 1, H.lo);
  return bottom;
};
export const backShort = (R) => backStd(R, R.h0 + R.headH - 3, false); // kort nacke
export const backLong = (R) => backStd(R, R.h0 + R.headH + 3, true);   // ner på axlarna
export const sideTop = (R) => { const { rect, put, hair: H, h0 } = R; rect(9, h0 - 1, 7, 1, H.base); rect(8, h0, 9, 3, H.base); rect(10, h0 - 1, 3, 1, H.hi); put(9, h0, H.hi); };
// hjässa + nacke (nape=false: ingen kort nacke, t.ex. när långt hår ritas ovanpå) + lugg vid pannan
export const sideStd = (R, nape = true) => {
  const { rect, put, hair: H, h0 } = R;
  sideTop(R);
  rect(8, h0 + 3, 3, nape ? 4 : 0, H.base);
  rect(16, h0 + 3, 1, 1, H.base); put(15, h0 + 3, H.base);
};

// ================= nya verktyg =================
// Deterministiskt brus 0–99 för struktur (lockar, rufs, stubb) – samma pixel ger alltid samma värde
export const nz = (x, y, s = 0) => {
  let h = (Math.imul(x + 11, 374761393) + Math.imul(y + 7, 668265263) + Math.imul(s + 3, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 100;
};

// Rakat/snaggat hår: hudton blandad med hårfärgen (a = ljus sida, b = skuggsida,
// f = nästan bar hud, s = stubb, d = tydligare stubbprick)
export const shaved = (R) => ({
  a: mix(R.hair.base, R.skin.base, 0.3),
  b: mix(R.hair.lo, R.skin.lo, 0.35),
  f: mix(R.hair.base, R.skin.base, 0.55),
  s: mix(R.skin.base, R.hair.base, 0.3),
  d: mix(R.skin.base, R.hair.base, 0.55),
});

// Mått som frisyrerna delar (radnummer i spriten)
//   chin = första raden under huvudet (halsen), shoulder = axlarna, chest = bröstet, waist = midjan
export const dims = (R) => {
  const chin = R.h0 + R.headH;
  return { chin, shoulder: chin + (R.K ? 2 : 3), chest: chin + (R.K ? 4 : 6), waist: chin + (R.K ? 5 : 8) };
};

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
  // masken ligger i vyns egna koordinater (samma som put() får – motorn speglar först vid ritning)
  const mark = (x, y) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < SW && y < SH) m[y * SW + x] = 1; };
  const P = Object.create(R);
  P.put = mark;
  P.rect = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mark(x + i, y + j); };
  P.pattern = P.each = P.draw = () => {};
  try { fn.call(E, P); } catch { return null; }
  const at = (x, y) => y >= 0 && y < SH && x >= 0 && x < SW && m[y * SW + x] === 1;
  const h0 = R.h0;
  if (!(at(12, h0 - 1) && at(R.side ? 8 : 7, h0) && at(16, h0))) return null; // täcker inte hjässan
  const top = new Int16Array(SW).fill(99), bot = new Int16Array(SW).fill(-1);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (at(x, y)) { if (y < top[x]) top[x] = y; if (y > bot[x]) bot[x] = y; }
  let a = -1, b = -1;
  for (let x = 0; x < SW; x++) if (bot[x] >= 0) { if (a < 0) a = x; b = x; }
  const lim = new Int16Array(SW);
  for (let x = 0; x < SW; x++) lim[x] = bot[x] >= 0 ? top[x] : x < a ? bot[a] + 1 : x > b ? bot[b] + 1 : -99;
  const put = R.put;
  const C = Object.create(R);
  C.put = (x, y, c) => { if (x >= 0 && x < SW && y < lim[x]) return; put(x, y, c); };
  C.rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) C.put(x + i, y + j, c); };
  C.hatted = true;
  C.hatTop = (x) => (x >= 0 && x < SW ? lim[x] : 99);
  return C;
}

// Registerpost för en ny frisyr: vyfunktionerna körs med hattklippning.
// R.hatted är true i vyfunktionen när en täckande hatt sitter på (t.ex. för att flytta
// en hög knut ner till nacken).
const clip = (fn) => fn && function view(R, a) { return fn.call(this, hatClip(R) || R, a); };
export const hs = (label, group, e) => ({ label, group, ...e, front: clip(e.front), back: clip(e.back), side: clip(e.side) });

// ---------- enkla ritverktyg ----------
// vågrät rad från x0 till x1 (inklusive)
export const row = (R, y, x0, x1, c) => { if (x1 >= x0) R.rect(x0, y, x1 - x0 + 1, 1, c); };
// lodrät kolumn från y0 till y1 (inklusive)
export const col = (R, x, y0, y1, c) => { if (y1 >= y0) R.rect(x, y0, 1, y1 - y0 + 1, c); };

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

// ---------- mask + automatisk skuggning (för runda/organiska former) ----------
// const m = mask(); m.rect(…); m.oval(…); m.cut(…); paint(R, m, { tex });
export function mask() {
  const a = new Uint8Array(SW * SH);
  const ok = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH;
  const m = {
    on: (x, y) => ok(x, y) && a[y * SW + x] === 1,
    set(x, y, v = 1) { if (ok(x, y)) a[y * SW + x] = v; return m; },
    rect(x, y, w, h, v = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m.set(x + i, y + j, v); return m; },
    row(y, x0, x1, v = 1) { for (let x = x0; x <= x1; x++) m.set(x, y, v); return m; },
    col(x, y0, y1, v = 1) { for (let y = y0; y <= y1; y++) m.set(x, y, v); return m; },
    cut(x, y, w = 1, h = 1) { return m.rect(x, y, w, h, 0); },
    // rader [y, x0, x1] (inklusive)
    rows(list) { for (const [y, x0, x1] of list) m.row(y, x0, x1); return m; },
    // ellips med mitten (cx, cy) och halvaxlarna rx, ry (cx = 11.5 = spritens mitt); bara rader y0…y1
    oval(cx, cy, rx, ry, y0 = -99, y1 = 99) {
      for (let y = Math.max(0, Math.ceil(cy - ry)); y <= Math.min(SH - 1, Math.floor(cy + ry)); y++) {
        if (y < y0 || y > y1) continue;
        const dy = (y - cy) / (ry + 0.35), hw = Math.sqrt(Math.max(0, 1 - dy * dy)) * (rx + 0.35);
        for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) m.set(x, y);
      }
      return m;
    },
  };
  return m;
}
// Målar masken med ljus uppifrån vänster (som de gamla frisyrerna): hjässans vänstra
// ovankant hi, högerkanten + det som hänger till höger om ansiktet lo, nederkanten lo/dk.
// Från sidan: bakkanten (vänster) lo, hjässan hi. o.tex(x, y, ton) kan byta ton
// ('hi' | 'base' | 'lo' | 'dk'); o.split = kolumnen där högra skuggsidan börjar (16).
export function paint(R, m, o = {}) {
  const H = R.hair, sideV = R.side, split = o.split ?? 16, yTop = R.h0 + 2;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (!m.on(x, y)) continue;
    const top = !m.on(x, y - 1), bot = !m.on(x, y + 1), lft = !m.on(x - 1, y), rgt = !m.on(x + 1, y);
    let t = 'base';
    if (sideV) {
      if ((lft && y > yTop) || (bot && y > yTop)) t = 'lo';
      if (top && x >= 9 && x <= 13) t = 'hi';
    } else {
      if ((x >= split && y > yTop) || rgt) t = 'lo';
      if (bot && y > yTop) t = x >= split ? 'dk' : 'lo';
      if (top && x >= 8 && x <= 11) t = 'hi';
      else if (lft && top && x < 8) t = 'hi';
    }
    if (o.tex) { const u = o.tex(x, y, t); if (u) t = u; }
    R.put(x, y, H[t]);
  }
}
// ---------- slätt uppsatt hår (allt kammat mot en knut, puff eller svans) ----------
// framifrån: kalott, håret draget bakom öronen, kamspår mot hjässan
export const sleekF = (R) => {
  const { put, hair: H, h0 } = R;
  capF(R, 3); col(R, 7, h0 + 3, h0 + 4, H.base); col(R, 16, h0 + 3, h0 + 4, H.lo);
  put(9, h0 + 2, H.lo); put(10, h0 + 1, H.lo); put(14, h0 + 2, H.lo); put(13, h0 + 1, H.lo);
};
// bakifrån: kort nacke med kamspår mot hjässan (up = true) eller mot nacken
export const sleekB = (R, up = true) => {
  const { put, hair: H, h0 } = R;
  const b = backStd(R, h0 + R.headH - 3, false);
  const n = b - h0 - 1;
  for (let k = 0; k < n; k++) {
    const t = up ? k : n - 1 - k, y = up ? b - 2 - k : h0 + 1 + k, dx = Math.floor(t / 2);
    put(9 + dx, y, H.lo); put(14 - dx, y, H.lo);
  }
};
// från sidan: hjässa + nacke, kamspår bakåt
export const sleekS = (R) => {
  const { put, hair: H, h0 } = R;
  sideTop(R); R.rect(8, h0 + 3, 3, 4, H.base); put(8, h0 + 6, H.lo);
  put(13, h0 + 1, H.lo); put(12, h0 + 2, H.lo); put(11, h0 + 1, H.lo); put(10, h0 + 3, H.lo); put(15, h0 + 2, H.lo);
};

// Lockig/krullig struktur för paint(): mörka och ljusa lockprickar
export const curls = (seed = 0, amt = 1) => (x, y, t) => {
  if (t === 'hi' || t === 'dk') return null;
  const n = nz(x, y, seed);
  if (n < 16 * amt) return t === 'lo' ? 'dk' : 'lo';
  if (n > 100 - 14 * amt) return t === 'lo' ? 'base' : 'hi';
  return null;
};
