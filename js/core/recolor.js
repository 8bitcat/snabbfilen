// Omfärgning av pixelmöbler. tintSprite(bild, [sx,sy,sw,sh], '#rrggbb') ger en
// cachad canvas där möbelns HUVUDMATERIAL (klädseln, lacken, träet …) har
// fått den valda kulören men behåller sin skuggning: varje nyans i materialets
// färgramp flyttas till samma kulör med sin egen ljushet (relativt materialets
// basnyans, som blir exakt den valda färgen). Konturer, vitt, grått,
// metallblått och andra material (t.ex. träben under en röd soffa, blommorna
// på ett täcke) lämnas orörda – det ska se ut som samma möbel i en ny färg,
// inte som en platt färgklick.
//
// Hur materialet hittas (per ruta, en gång – cachas):
//   1. paletten räknas ut: varje unik färg med antal pixlar
//   2. varje färg klassas: kontur (mörk), vit, trä (atlasens träramp),
//      rent grått, blågrå metall/glas (låg kroma eller atlasens metallspår)
//      eller färgad
//   3. färgade nyanser kedjas ihop till ramper (nära kulör, eller upp till
//      50° isär när de följer pixelkonstens kulörskifte); trä blir ett eget
//      material, grått och metall egna (kedjade på ljushet)
//   4. största materialet vinner – trä och grått väger lite lättare, så en
//      grön säng med träram blir en säng med ny täckesfärg, inte ny ram,
//      medan en bokhylla (nästan bara trä) får nytt trä.
// Möbler som nästan bara är gråa/svarta (TV, kylskåp, vit stol) omfärgas i
// gråskalan, så att varje möbel går att styla fritt.

const WOOD = new Set([0xae4924, 0x8a3625, 0xc46120, 0x4a2123, 0x32131e]);
const W_COLORED = 1, W_WOOD = 0.6, W_GREY = 0.5;
const HUE_LINK = 32;      // kulörsteg som alltid räknas som samma ramp
const HUE_SHIFT = 50;     // största kulörsteg när rampen skiftar mot blått i skuggan
const GREY_LINK = 0.22;   // max ljushetssteg mellan två gråa nyanser
const GREY_SPAN = 0.42;   // gråa nyanser längre än så från basen lämnas (svarta fötter)
const MAX_TINTS = 240;    // färgcachen per bild (egen färg kan ge många)

const analyses = new WeakMap(); // bild -> Map(rutnyckel -> analys | null)
const tints = new WeakMap();    // bild -> Map(rutnyckel|hex -> canvas)

const frameKey = (f) => `${f[0]},${f[1]},${f[2]},${f[3]}`;
const optKey = (o = {}) => (o.hue !== undefined || o.minL !== undefined || o.maxL !== undefined ? `~${o.hue ?? ''},${o.minL ?? ''},${o.maxL ?? ''}` : '');
const ready = (img) => !!img && (!('complete' in img) || (img.complete && img.naturalWidth > 0));

export const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Möbeln i ny färg (canvas i rutans storlek) – eller null om bilden inte har
// laddats än / färgen är ogiltig. Anroparen ritar då originalet.
// Tips för rutor där huvudmaterialet inte är det största:
//   opts.hue  = föredra materialet med den kulören (krukan, inte bladen)
//   opts.minL / opts.maxL = basnyansen ska vara minst/högst så ljus
//               (lampskärmen, inte foten; spegelns ram, inte glaset)
export function tintSprite(image, frame, hex, opts = {}) {
  if (!isHex(hex) || !frame || !ready(image)) return null;
  opts ||= {};
  hex = hex.toLowerCase();
  let per = tints.get(image);
  if (!per) { per = new Map(); tints.set(image, per); }
  const key = frameKey(frame) + optKey(opts) + '|' + hex;
  const hit = per.get(key);
  if (hit) return hit;
  const an = analyze(image, frame, opts);
  const c = document.createElement('canvas');
  c.width = frame[2]; c.height = frame[3];
  const x = c.getContext('2d');
  if (!an) x.drawImage(image, frame[0], frame[1], frame[2], frame[3], 0, 0, frame[2], frame[3]);
  else {
    const lut = buildLut(an, hex);
    const out = new ImageData(new Uint8ClampedArray(an.data), frame[2], frame[3]);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const rgb = lut.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (rgb === undefined) continue;
      d[i] = rgb >> 16; d[i + 1] = (rgb >> 8) & 255; d[i + 2] = rgb & 255;
    }
    x.putImageData(out, 0, 0);
  }
  if (per.size >= MAX_TINTS) per.delete(per.keys().next().value);
  per.set(key, c);
  return c;
}

// Materialets originalkulör ('#rrggbb') – till "Original"-rutan i färgvalet.
export function spriteBaseColor(image, frame, opts = {}) {
  if (!frame || !ready(image)) return null;
  const an = analyze(image, frame, opts || {});
  return an ? toHex(an.base.rgb) : null;
}

// ---------- analysen ----------
function analyze(image, frame, opts) {
  let per = analyses.get(image);
  if (!per) { per = new Map(); analyses.set(image, per); }
  const key = frameKey(frame) + optKey(opts);
  if (per.has(key)) return per.get(key);
  const [sx, sy, sw, sh] = frame;
  const cv = document.createElement('canvas');
  cv.width = sw; cv.height = sh;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  let data;
  try { data = x.getImageData(0, 0, sw, sh).data; } catch { per.set(key, null); return null; } // t.ex. file://
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(rgb, (counts.get(rgb) || 0) + 1);
  }
  const cols = [...counts].map(([rgb, n]) => ({ rgb, n, ...describe(rgb) }));
  for (const c of cols) c.cls = classify(c);

  // materialen: färgade ramper, träet, rent grått och metall
  const mats = [];
  for (const group of chain(cols.filter((c) => c.cls === 'col'), rampLink)) mats.push({ kind: 'col', cols: group });
  const wood = cols.filter((c) => c.cls === 'wood');
  if (wood.length) mats.push({ kind: 'wood', cols: wood });
  for (const cls of ['grey', 'metal']) {
    for (const group of chain(cols.filter((c) => c.cls === cls), (a, b) => Math.abs(a.l - b.l) <= GREY_LINK)) mats.push({ kind: 'grey', cols: group });
  }
  if (!mats.length) { per.set(key, null); return null; }
  for (const m of mats) {
    m.n = m.cols.reduce((a, c) => a + c.n, 0);
    m.score = m.n * (m.kind === 'col' ? W_COLORED : m.kind === 'wood' ? W_WOOD : W_GREY);
    m.hue = circMean(m.cols);
  }
  let pick = mats.reduce((a, b) => (b.score > a.score ? b : a));
  if (opts.hue !== undefined) {
    const near = mats.filter((m) => m.kind !== 'grey' && hueDist(m.hue, opts.hue) < 40).sort((a, b) => b.n - a.n)[0];
    if (near) pick = near;
  }
  // basen = materialets vanligaste mellanton (en mörk skuggyta som råkar vara
  // störst, t.ex. bokhyllans bakstycke, ska inte bli "den valda färgen")
  const baseW = (c) => c.n * (c.l < 0.2 ? 0.25 : c.l < 0.28 ? 0.6 : 1);
  const inRange = (c) => (opts.minL === undefined || c.l >= opts.minL) && (opts.maxL === undefined || c.l <= opts.maxL);
  const baseable = pick.cols.some(inRange) ? pick.cols.filter(inRange) : pick.cols;
  const base = baseable.reduce((a, b) => (baseW(b) > baseW(a) ? b : a));
  const members = pick.kind === 'grey' ? pick.cols.filter((c) => Math.abs(c.l - base.l) <= GREY_SPAN) : pick.cols;
  const an = { data: new Uint8ClampedArray(data), kind: pick.kind, base, members };
  per.set(key, an);
  return an;
}

function classify(c) {
  if (WOOD.has(c.rgb)) return 'wood';
  if (c.chroma < 0.07 && c.v > 0.93) return 'white';
  if (c.chroma < 0.04) return c.v < 0.16 ? 'line' : 'grey';   // rent grått (svarta dörrar, TV-ram)
  if (c.v < 0.2) return 'line';                                 // atlasens tonade konturer
  if (c.chroma < 0.12 || (c.h >= 195 && c.h <= 250 && c.sv < 0.55)) return 'metal'; // blågrå metall/glas
  return 'col';
}

// Två nyanser hör till samma ramp om kulören är nära – eller upp till 50° isär
// när de följer pixelkonstens kulörskifte: den mörkare nyansen ligger kallare
// (närmare blått), den ljusare varmare (grön soffa: gulgröna högdager,
// blågröna skuggor).
function rampLink(a, b) {
  const d = hueDist(a.h, b.h);
  if (d <= HUE_LINK) return true;
  if (d > HUE_SHIFT) return false;
  const [dk, lt] = a.v < b.v ? [a, b] : [b, a];
  return lt.v - dk.v >= 0.12 && hueDist(dk.h, 240) < hueDist(lt.h, 240);
}

// enkel länkning (union-find) – grupper där varje medlem når någon annan
function chain(list, near) {
  const parent = list.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (near(list[i], list[j])) parent[find(i)] = find(j);
  const groups = new Map();
  list.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  return [...groups.values()];
}

// ---------- färgbygget ----------
// Basnyansen blir exakt den valda färgen. Mörkare nyanser skalas med samma
// förhållande (en skugga som var 60 % av basen blir 60 % av den nya färgen),
// ljusare får samma andel av det som finns kvar upp till vitt – något mindre
// för mörka färger, så att en svart lampa inte får en ljusgrå skärm. Kulören
// följer med rampens egna små kulörskiften (varmare högdager, kallare skuggor).
function buildLut(an, hex) {
  const target = parseInt(hex.slice(1), 16);
  const T = describe(target);
  const base = an.base;
  const lt = Math.max(0.12, Math.min(0.97, T.l));
  const lift = 0.45 + 0.55 * Math.min(1, lt / 0.5);
  const lut = new Map();
  for (const c of an.members) {
    if (c === base) { lut.set(c.rgb, target); continue; }
    const l = c.l <= base.l
      ? lt * (base.l > 0 ? c.l / base.l : 1)
      : lt + (1 - lt) * lift * ((c.l - base.l) / Math.max(0.01, 1 - base.l));
    let s = T.s, h = T.h;
    if (an.kind !== 'grey' && base.s > 0.05) s = T.s * Math.max(0.6, Math.min(1.25, c.s / base.s));
    if (an.kind === 'col') h = T.h + Math.max(-18, Math.min(18, hueDiff(c.h, base.h) * 0.6));
    lut.set(c.rgb, hsl2rgb(h, Math.min(1, s), Math.max(0, Math.min(1, l))));
  }
  return lut;
}

// ---------- färgmatte ----------
function describe(rgb) {
  const r = (rgb >> 16) / 255, g = ((rgb >> 8) & 255) / 255, b = (rgb & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = mx - mn;
  let h = 0;
  if (ch > 0) {
    if (mx === r) h = ((g - b) / ch) % 6;
    else if (mx === g) h = (b - r) / ch + 2;
    else h = (r - g) / ch + 4;
    h = (h * 60 + 360) % 360;
  }
  const l = (mx + mn) / 2;
  const s = ch === 0 ? 0 : ch / (1 - Math.abs(2 * l - 1));
  return { h, s, l, v: mx, sv: mx ? ch / mx : 0, chroma: ch };
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const q = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}
const hueDiff = (a, b) => ((a - b + 540) % 360) - 180;
const hueDist = (a, b) => Math.abs(hueDiff(a, b));
function circMean(cols) {
  let x = 0, y = 0;
  for (const c of cols) { x += Math.cos(c.h * Math.PI / 180) * c.n; y += Math.sin(c.h * Math.PI / 180) * c.n; }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const toHex = (rgb) => '#' + rgb.toString(16).padStart(6, '0');
