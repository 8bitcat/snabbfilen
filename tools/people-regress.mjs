// Regressionstest för figurerna (js/core/people.js): renderar en fast uppsättning
// utseenden × 4 riktningar × bildrutor 0–9 och jämför en hash per sprite mot
// baslinjen i tools/people-baseline.json. Körs i Node (ingen webbläsare/server
// behövs) med en liten canvas-attrapp – renderingen är ren heltalsmatematik i
// ImageData, så resultatet blir bit för bit detsamma som i webbläsaren.
//
//   node tools/people-regress.mjs            jämför mot baslinjen (exit 1 vid skillnad)
//   node tools/people-regress.mjs --update   skriv ny baslinje (BARA när du vet att
//                                            skillnaden är avsiktlig – gamla looks ska
//                                            vara pixelidentiska!)
//   node tools/people-regress.mjs --list     visa alla skillnader, inte bara de 40 första
//   node tools/people-regress.mjs --png      skriv tools/out/regress-diff.png (gammal hash
//                                            saknar pixlar, så bilden visar NYA spriten för
//                                            varje avvikande look, 4 riktningar × 10 rutor)
//
// Uppsättningen utseenden fryses i baslinjen (fältet looks) så att nya val som
// läggs till i registren inte ändrar vad som jämförs. makeLook(frö) kontrolleras
// också: samma frö måste ge samma kund som när baslinjen skrevs.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BASE = path.join(ROOT, 'tools', 'people-baseline.json');
const arg = (k) => process.argv.includes('--' + k);

// ---------- canvas-attrapp ----------
function fakeCanvas() {
  const cv = { width: 0, height: 0, _img: null, _last: null };
  const ctx = {
    canvas: cv, fillStyle: '#000', imageSmoothingEnabled: false,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (img) => { cv._img = img; },
    drawImage: (src) => { cv._last = src; },
    fillRect() {}, setTransform() {}, clearRect() {}, save() {}, restore() {}, fillText() {}, strokeRect() {}, beginPath() {}, fill() {}, stroke() {},
  };
  cv.getContext = () => ctx;
  return cv;
}
globalThis.document = globalThis.document || { createElement: () => fakeCanvas() };

const P = await import(pathToFileURL(path.join(ROOT, 'js', 'core', 'people.js')).href);

// ---------- deterministisk slump (mulberry32) ----------
function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- uppsättningen utseenden (bara när baslinjen skrivs) ----------
function buildLooks() {
  const base = {
    skin: '#e0a97f', hair: '#3b2619', style: 'short', top: 'tee', shirt: '#3a7bd5', accent: '#f0b429',
    bottom: 'jeans', pants: '#2d3a5c', shoes: '#c23b3b', hat: null, cap: '#46a35a', glasses: false, beard: false,
    phones: false, phoneColor: '#c9323a', bag: null, bagColor: '#8e5bd1', build: 5, blush: false, kid: false,
  };
  const out = [];
  const add = (id, look) => out.push({ id, look });
  for (const kid of [false, true]) {
    const k = kid ? 'barn' : 'vuxen';
    const B = { ...base, kid, build: kid ? 4 : 5 };
    add(`${k}/bas`, B);
    const vary = (field, values) => values.forEach((v) => add(`${k}/${field}=${JSON.stringify(v)}`, { ...B, [field]: v }));
    vary('style', P.HAIR_STYLES);
    vary('top', P.TOP_TYPES);
    vary('bottom', P.BOTTOM_TYPES);
    vary('hat', P.HAT_TYPES.filter((v) => v));
    vary('glasses', P.GLASSES_TYPES.filter((v) => v));
    if (!kid) vary('beard', P.BEARD_TYPES.filter((v) => v));
    vary('bag', P.BAG_TYPES.filter((v) => v));
    vary('phones', [true]);
    vary('blush', [true]);
    vary('apron', [true]);
    vary('skin', P.SKIN);
    vary('hair', P.HAIR);
    vary('shoes', P.SHOES);
    vary('shirt', ['#e8e3d6', '#2f3440', '#f4f1ea']);
    vary('pants', P.PANTS.slice(0, 4));
    P.PHONE_COLORS.forEach((c) => add(`${k}/phones+phoneColor=${c}`, { ...B, phones: true, phoneColor: c }));
    P.BAG_COLORS.forEach((c) => add(`${k}/bag+bagColor=${c}`, { ...B, bag: 'backpack', bagColor: c }));
    ['#f0b429', '#2f3440', '#e8e3d6'].forEach((c) => add(`${k}/hat+cap=${c}`, { ...B, hat: 'tophat', cap: c, accent: '#d9433b' }));
    if (!kid) vary('build', P.BUILDS);
    // kombinationer där lagren påverkar varandra
    for (const h of P.HAT_TYPES.filter((v) => v)) for (const s of P.HAIR_STYLES) add(`${k}/hat=${h}+style=${s}`, { ...B, hat: h, style: s });
    for (const s of P.HAIR_STYLES) add(`${k}/phones+style=${s}`, { ...B, phones: true, style: s });
    for (const t of P.TOP_TYPES) for (const b of P.BAG_TYPES.filter((v) => v)) add(`${k}/top=${t}+bag=${b}`, { ...B, top: t, bag: b });
    for (const t of P.TOP_TYPES) for (const b of P.BOTTOM_TYPES) add(`${k}/top=${t}+bottom=${b}`, { ...B, top: t, bottom: b });
    for (const t of P.TOP_TYPES) add(`${k}/top=${t}+apron`, { ...B, top: t, apron: true });
    for (const b of P.BOTTOM_TYPES) for (const s of ['#1c1c1c', '#f2f2f2', '#2f2f36']) add(`${k}/bottom=${b}+shoes=${s}`, { ...B, bottom: b, shoes: s });
    for (const g of P.GLASSES_TYPES.filter((v) => v)) for (const s of ['long', 'bob', 'afro', 'bald', 'curly']) add(`${k}/glasses=${g}+style=${s}`, { ...B, glasses: g, style: s });
    if (!kid) for (const b of P.BEARD_TYPES.filter((v) => v)) for (const g of P.GLASSES_TYPES.filter((v) => v)) add(`${k}/beard=${b}+glasses=${g}`, { ...B, beard: b, glasses: g, blush: true });
    if (!kid) for (const w of P.BUILDS) for (const t of P.TOP_TYPES) add(`${k}/build=${w}+top=${t}`, { ...B, build: w, top: t, bag: 'shoulder' });
  }
  // gamla/trasiga format som norm() tar hand om
  add('legacy/style=cap', { ...base, style: 'cap' });
  add('legacy/glasses=true', { ...base, glasses: true });
  add('legacy/beard=true', { ...base, beard: true });
  add('legacy/tom', {});
  add('legacy/bara-hud', { skin: '#a06a43' });
  add('legacy/konstiga-farger', { ...base, shirt: 'röd', pants: '#12', hair: null });
  add('legacy/barn-med-skagg', { ...base, kid: true, beard: 'full', build: 6 });
  add('shopkeeper', { ...P.SHOPKEEPER });
  // 40 slumpade kunder med fast frö
  const r = rng32(20260927);
  for (let i = 0; i < 40; i++) add(`makeLook#${i}`, P.makeLook(r));
  return out;
}

// makeLook-kontroll: 40 kunder från ett annat frö, jämförs som JSON
const makeLookSample = () => { const r = rng32(777); return Array.from({ length: 40 }, () => P.makeLook(r)); };

// ---------- rendering ----------
const DIRS = ['down', 'up', 'right', 'left'];
const FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
function renderAll(looks) {
  const map = {}, imgs = {};
  const ctx = fakeCanvas().getContext('2d');
  let n = 0;
  const t0 = performance.now();
  for (const { id, look } of looks) {
    const L = JSON.parse(JSON.stringify(look)); // nytt objekt → cachemiss
    for (const dir of DIRS) for (const fr of FRAMES) {
      P.drawPerson(ctx, 12, 39, L, dir, fr);
      const img = ctx.canvas._last._img;
      const key = `${id}|${dir}|${fr}`;
      map[key] = crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex').slice(0, 16);
      imgs[key] = img;
      n++;
    }
  }
  const ms = performance.now() - t0;
  return { map, imgs, n, ms };
}

// ---------- PNG (för --png) ----------
function png(w, h, rgba) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- kör ----------
if (arg('update') || !fs.existsSync(BASE)) {
  const looks = buildLooks();
  const { map, n, ms } = renderAll(looks);
  fs.writeFileSync(BASE, JSON.stringify({ skapad: new Date().toISOString(), antal: n, looks, makeLook: makeLookSample(), sprites: map }));
  console.log(`Baslinje skriven: ${looks.length} utseenden, ${n} sprites (${(ms / n).toFixed(3)} ms/sprite) → ${path.relative(ROOT, BASE)}`);
  process.exit(0);
}

const B = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const { map, imgs, n, ms } = renderAll(B.looks);
const diff = [], missing = [];
for (const [k, h] of Object.entries(B.sprites)) {
  if (!(k in map)) missing.push(k);
  else if (map[k] !== h) diff.push(k);
}
const mlNow = JSON.stringify(makeLookSample()), mlOk = mlNow === JSON.stringify(B.makeLook);
console.log(`${B.looks.length} utseenden, ${n} sprites, ${(ms / n).toFixed(3)} ms/sprite i snitt.`);
console.log(`makeLook(frö): ${mlOk ? 'samma kunder som baslinjen ✓' : 'SKILJER SIG ✗ – makeLook ger andra kunder än förut!'}`);
if (!diff.length && !missing.length) {
  console.log('0 skillnader – alla sprites är pixelidentiska med baslinjen ✓');
  process.exit(mlOk ? 0 : 1);
}
console.log(`${diff.length} sprites skiljer sig${missing.length ? `, ${missing.length} saknas` : ''}:`);
const byLook = new Map();
for (const k of diff) { const [id, dir, fr] = k.split('|'); if (!byLook.has(id)) byLook.set(id, []); byLook.get(id).push(`${dir}/${fr}`); }
let shown = 0;
for (const [id, list] of byLook) {
  if (!arg('list') && shown++ >= 40) { console.log(`  … och ${byLook.size - 40} utseenden till (kör med --list)`); break; }
  console.log(`  ${id}: ${list.length === 40 ? 'alla 40' : list.join(' ')}`);
}
if (arg('png') && byLook.size) {
  const ids = [...byLook.keys()].slice(0, 40);
  const W = 24 * 40, H = 40 * ids.length;
  const buf = new Uint8ClampedArray(W * H * 4);
  ids.forEach((id, row) => DIRS.forEach((dir, di) => FRAMES.forEach((fr) => {
    const img = imgs[`${id}|${dir}|${fr}`]; if (!img) return;
    const ox = (di * 10 + fr) * 24, oy = row * 40;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 24; x++) { const s = (y * 24 + x) * 4, d = ((oy + y) * W + ox + x) * 4; for (let c = 0; c < 4; c++) buf[d + c] = img.data[s + c]; }
  })));
  fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'regress-diff.png'), png(W, H, buf));
  console.log('skrev tools/out/regress-diff.png');
}
process.exit(1);
